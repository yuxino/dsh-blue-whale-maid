/**
 * dsh-blue-whale-maid — host half.
 *
 * Registers local HTTP routes on the dsh web server so the browser pet can
 * show DeepSeek account info without exposing the API key to browser code:
 *
 *   GET /api/blue-whale-maid/balance       — remaining balance (official)
 *   GET /api/blue-whale-maid/session-cost  — current session's accumulated cost
 *
 * The key is resolved per request through the credentials seam (the same
 * `DEEPSEEK_API_KEY` reference the llm-deepseek adapter uses), so the user
 * never enters it in the pet UI. The host forwards it only to the configured
 * DeepSeek-compatible balance endpoint.
 *
 * Pricing engine: adapted from bpc-oss/dsh-web-billing (MIT); see
 * lib/pricing.js and THIRD_PARTY_NOTICES.md.
 */
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { chmodSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import {
	advanceDayMeterState,
	balanceMeterIdentity,
	isTrustedHostRequest
} from "./host-utils.js";
import { readPersistedSessionEvents } from "./session-replay.js";
import {
	countUnpricedSessionCostSamples,
	createSessionCostLedger,
	foldSessionCostEvent,
	mergeSessionCostLedgers,
	summarizeSessionCost
} from "./session-cost.js";

const name = "dsh-blue-whale-maid";
const inject = ["credentials", "webServer"];

const PUBLIC_BASE_URL = "https://api.deepseek.com";
const BASE_URL_ENV = "DEEPSEEK_BASE_URL";
// CredentialRef is a branded string at the type boundary. Keeping the runtime
// value dependency-free also lets DSH load a locally linked checkout: Node
// resolves imports from the link target, where the profile's peer packages are
// intentionally not installed.
const CREDENTIAL_REF = "DEEPSEEK_API_KEY";
const BALANCE_PATH = "/user/balance";
const BALANCE_ROUTE = "/api/blue-whale-maid/balance";
const SESSION_COST_ROUTE = "/api/blue-whale-maid/session-cost";
const TIMEOUT_MS = 15000;
const DAY_STATE_FILE = "blue-whale-maid-day.json";

const JSON_HEADERS = {
	"content-type": "application/json; charset=utf-8",
	"cache-control": "no-store"
};

function balanceUrl() {
	const base = process.env[BASE_URL_ENV] ?? PUBLIC_BASE_URL;
	return `${base.replace(/\/+$/, "")}${BALANCE_PATH}`;
}

function sendJson(res, status, body, headers) {
	res.writeHead(status, { ...JSON_HEADERS, ...headers });
	res.end(JSON.stringify(body));
}

function requireGet(req, res) {
	if (typeof req.method === "string" && req.method.toUpperCase() === "GET") return true;
	sendJson(res, 405, {
		ok: false,
		error: "method-not-allowed",
		message: "仅支持 GET 请求。"
	}, { Allow: "GET" });
	return false;
}

function requireTrustedHost(req, res) {
	if (isTrustedHostRequest(req)) return true;
	sendJson(res, 403, {
		ok: false,
		error: "request-not-trusted",
		message: "财务信息仅允许从本机同源页面访问。"
	});
	return false;
}

// ---- daily consumption estimate (balance delta) ---------------------------

/** Local calendar day as `YYYY-MM-DD`. */
function localDate(d = new Date()) {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function dayStatePath(ctx) {
	let storages;
	const homeFn = typeof ctx.get === "function" ? ctx.get("dshHomePath") : void 0;
	if (typeof homeFn === "function") {
		storages = homeFn("storages");
	} else if (process.env.DSH_HOME) {
		storages = join(process.env.DSH_HOME, "storages");
	} else {
		storages = join(homedir(), ".dsh", "storages");
	}
	return join(storages, DAY_STATE_FILE);
}

function loadDayState(path) {
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		if (parsed !== null && typeof parsed === "object") return parsed;
	} catch {}
	return null;
}

function saveDayState(path, state) {
	try {
		mkdirSync(dirname(path), { recursive: true });
		const tmp = `${path}.tmp`;
		writeFileSync(tmp, JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
		// mode is ignored when a stale tmp file already exists, so tighten it
		// explicitly before the atomic replacement as well.
		chmodSync(tmp, 0o600);
		renameSync(tmp, path);
	} catch {}
}

/** Advance the daily meter with one observed balance → today's consumption estimate. */
function computeTodayConsumed(ctx, balance, identity) {
	if (!Number.isFinite(balance)) return null;
	const path = dayStatePath(ctx);
	const today = localDate();
	const stored = loadDayState(path);
	const update = advanceDayMeterState(stored, identity, balance, today);
	saveDayState(path, update.state);
	return update.todayConsumed;
}

// ---- session cost ---------------------------------------------------------

/** Round a cost to 6 decimals for the wire. */
function roundCost(value) {
	return Math.round(value * 1e6) / 1e6;
}

const REPLAY_MIN_INTERVAL_MS = 2000;
const MAX_REPLAY_CACHE_SESSIONS = 128;
const MAX_LIVE_SESSIONS = 128;

function rememberBounded(map, key, value, maxSize) {
	map.delete(key);
	map.set(key, value);
	while (map.size > maxSize) {
		const oldest = map.keys().next().value;
		map.delete(oldest);
	}
}

function cachedReplay(cache, sessionId) {
	const cached = cache.get(sessionId);
	if (cached === void 0) return void 0;
	rememberBounded(cache, sessionId, cached, MAX_REPLAY_CACHE_SESSIONS);
	return cached;
}

/**
 * Replay a session's persisted log through the same turn/step reducer as live
 * events. Cached per session by log revision.
 */
async function replaySessionCost(ctx, cache, sessionId) {
	const persistence = ctx.get("sessionPersistence");
	if (
		persistence === void 0 ||
		typeof persistence.readStoredRevision !== "function"
	) {
		return null;
	}
	let revision;
	try {
		revision = await persistence.readStoredRevision(sessionId);
	} catch (error) {
		ctx.logger.warn("dsh-blue-whale-maid: failed to read session log revision");
		ctx.logger.warn(error);
		return null;
	}
	if (revision === void 0) return null;
	const cached = cachedReplay(cache, sessionId);
	if (cached !== void 0) {
		if (cached.revision === revision) return cached.ledger;
		if (Date.now() - cached.at < REPLAY_MIN_INTERVAL_MS) return cached.ledger;
	}
	try {
		const events = await readPersistedSessionEvents(persistence, sessionId);
		if (events === null) return null;
		const ledger = createSessionCostLedger();
		for (const event of events) {
			try {
				foldSessionCostEvent(ledger, event);
			} catch {}
		}
		rememberBounded(cache, sessionId, {
			ledger,
			revision,
			at: Date.now()
		}, MAX_REPLAY_CACHE_SESSIONS);
		return ledger;
	} catch (error) {
		ctx.logger.warn("dsh-blue-whale-maid: failed to replay session log for costing");
		ctx.logger.warn(error);
		return null;
	}
}

function apply(ctx) {
	// Live in-memory ledgers cover in-flight usage not yet persisted. The map is
	// LRU-bounded so a long-running host cannot retain every session forever.
	const bySession = new Map();
	const logCostCache = new Map();

	ctx.on("session/event", (session, event) => {
		try {
			const relevant = event?.type === "step/start" ||
				event?.type === "step/end" ||
				event?.type === "compaction/start" ||
				event?.type === "compaction/summary" ||
				event?.type === "compaction/end" ||
				event?.type === "request/header" ||
				event?.type === "request/context" ||
				(event?.type === "assistant/chunk" && (
					event.data?.chunk?.type === "usage" ||
					(event.data?.chunk?.type === "finish" && (
						event.data.chunk.reason?.kind === "error" || event.data.chunk.reason?.kind === "aborted"
					))
				)) ||
				(event?.type === "assistant/message" && (event.data?.usage !== void 0 || event.data?.message?.usage !== void 0));
			if (!relevant) return;
			let ledger = bySession.get(session.id);
			if (ledger === void 0) {
				ledger = createSessionCostLedger();
				// A plugin may activate in the middle of an open request. Seed from the
				// live session when available so an eventual failed usage chunk still
				// inherits its step start and request context.
				let includesCurrent = false;
				if (Array.isArray(session.events)) {
					for (const prior of session.events) {
						foldSessionCostEvent(ledger, prior);
						if (prior === event || (
							Number.isSafeInteger(prior?.seq) && prior.seq === event?.seq && prior.type === event?.type
						)) includesCurrent = true;
					}
				}
				if (!includesCurrent) foldSessionCostEvent(ledger, event);
			} else {
				foldSessionCostEvent(ledger, event);
			}
			rememberBounded(bySession, session.id, ledger, MAX_LIVE_SESSIONS);
		} catch (error) {
			ctx.logger.warn("dsh-blue-whale-maid: failed to fold a session cost event");
			ctx.logger.warn(error);
		}
	});

	// GET /api/blue-whale-maid/balance — remaining balance + today's estimate.
	ctx.effect(
		() => ctx.webServer.register({
			kind: "exact",
			path: BALANCE_ROUTE,
			handler: async (req, res) => {
				if (!requireTrustedHost(req, res)) return;
				if (!requireGet(req, res)) return;
				try {
					const hit = await ctx.credentials.resolve(CREDENTIAL_REF);
					if (hit === void 0) {
						sendJson(res, 503, {
							ok: false,
							error: "no-api-key",
							message: "未配置 DEEPSEEK_API_KEY：请在 设置 → 模型 中填写 DeepSeek API Key。"
						});
						return;
					}
					const endpoint = balanceUrl();
					const response = await fetch(endpoint, {
						headers: {
							Authorization: `Bearer ${hit.value}`,
							Accept: "application/json"
						},
						signal: AbortSignal.timeout(TIMEOUT_MS)
					});
					const text = await response.text();
					if (!response.ok) {
						sendJson(res, response.status, {
							ok: false,
							error: "provider",
							message: `DeepSeek 接口返回 HTTP ${response.status}`
						});
						return;
					}
					let body = null;
					try {
						body = JSON.parse(text);
					} catch {}
					const total = body && Array.isArray(body.balance_infos) ? Number(body.balance_infos[0]?.total_balance) : NaN;
					const identity = balanceMeterIdentity(endpoint, hit.value);
					const todayConsumed = Number.isFinite(total) ? computeTodayConsumed(ctx, total, identity) : null;
					sendJson(res, 200, { ok: true, balance: body, todayConsumed });
				} catch (error) {
					ctx.logger.warn("dsh-blue-whale-maid: failed to fetch DeepSeek balance");
					ctx.logger.warn(error);
					sendJson(res, 502, {
						ok: false,
						error: "fetch-failed",
						message: "暂时无法连接 DeepSeek 余额接口。"
					});
				}
			}
		}),
		"dsh-blue-whale-maid: balance route"
	);

	// GET /api/blue-whale-maid/session-cost?sessionId=<id>
	ctx.effect(
		() => ctx.webServer.register({
			kind: "exact",
			path: SESSION_COST_ROUTE,
			handler: async (req, res) => {
				if (!requireTrustedHost(req, res)) return;
				if (!requireGet(req, res)) return;
				try {
					// DSH SessionId is contractually any non-empty string. URL parsing and
					// the web server's request-line limit already bound this input; the
					// persistence service safely encodes it before filesystem access.
					const sessionId = new URL(req.url ?? "/", "http://x").searchParams.get("sessionId") ?? "";
					let record = null;
					let source = null;
					let unpricedCalls = 0;
					if (sessionId !== "") {
						const replay = await replaySessionCost(ctx, logCostCache, sessionId);
						const live = bySession.get(sessionId) ?? null;
						const ledger = mergeSessionCostLedgers(replay, live);
						if (ledger !== null) {
							record = summarizeSessionCost(ledger);
							unpricedCalls = countUnpricedSessionCostSamples(ledger);
							source = replay !== null ? "log" : "live";
						}
					}
					if (record === null) {
						sendJson(res, 200, {
							ok: true,
							sessionId,
							cost: null,
							costUsd: null,
							calls: 0,
							inputTokens: 0,
							cacheReadTokens: 0,
							outputTokens: 0,
							unpricedCalls: 0
						});
						return;
					}
					sendJson(res, 200, {
						ok: true,
						sessionId,
						source,
						// No priced usage sample means "unknown", not a confirmed zero bill.
						// A genuine zero-token priced call still has calls > 0 and may show 0.
						cost: record.calls === 0 ? null : roundCost(record.cost),
						costUsd: record.calls === 0 ? null : roundCost(record.costUsd),
						calls: record.calls,
						unpricedCalls,
						partial: record.calls > 0 && unpricedCalls > 0,
						inputTokens: record.inputTokens,
						cacheReadTokens: record.cacheReadTokens,
						outputTokens: record.outputTokens
					});
				} catch (error) {
					ctx.logger.warn("dsh-blue-whale-maid: session-cost lookup failed");
					ctx.logger.warn(error);
					sendJson(res, 500, { ok: false, error: "internal", message: "internal error" });
				}
			}
		}),
		"dsh-blue-whale-maid: session cost route"
	);
}

export { name, inject, apply };
