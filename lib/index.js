/**
 * dsh-blue-whale-maid — host half.
 *
 * Registers local HTTP routes on the dsh web server so the browser pet can
 * show DeepSeek account info WITHOUT the API key ever leaving the host:
 *
 *   GET /api/blue-whale-maid/balance       — remaining balance (official)
 *   GET /api/blue-whale-maid/session-cost  — current session's accumulated cost
 *
 * The key is resolved per request through the credentials seam (the same
 * `DEEPSEEK_API_KEY` reference the llm-deepseek adapter uses), so the user
 * never enters it in the pet UI and the browser only ever talks to these
 * local routes.
 *
 * Pricing engine: ported from bpc-oss/dsh-web-billing (MIT) via
 * dsh-deepseek-quota (MIT); see lib/pricing.js.
 */
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { costOf, priceAt } from "./pricing.js";

const name = "dsh-blue-whale-maid";
const inject = ["credentials", "webServer"];

const PUBLIC_BASE_URL = "https://api.deepseek.com";
const BASE_URL_ENV = "DEEPSEEK_BASE_URL";
const CREDENTIAL_REF = credentialRef("DEEPSEEK_API_KEY");
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

function sendJson(res, status, body) {
	res.writeHead(status, JSON_HEADERS);
	res.end(JSON.stringify(body));
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
		if (
			parsed !== null &&
			typeof parsed === "object" &&
			typeof parsed.date === "string" &&
			typeof parsed.opening === "number" &&
			typeof parsed.last === "number"
		) {
			return parsed;
		}
	} catch {}
	return null;
}

function saveDayState(path, state) {
	try {
		mkdirSync(dirname(path), { recursive: true });
		const tmp = `${path}.tmp`;
		writeFileSync(tmp, JSON.stringify(state), "utf8");
		renameSync(tmp, path);
	} catch {}
}

/** Advance the daily meter with one observed balance → today's consumption estimate. */
function computeTodayConsumed(ctx, balance) {
	if (!Number.isFinite(balance)) return null;
	const path = dayStatePath(ctx);
	const today = localDate();
	const stored = loadDayState(path);
	const opening = stored !== null && stored.date === today ? stored.opening : (stored !== null ? stored.last : balance);
	saveDayState(path, { date: today, opening, last: balance });
	const consumed = Math.max(0, opening - balance);
	return Math.round(consumed * 100) / 100;
}

// ---- session cost ---------------------------------------------------------

/** Round a cost to 6 decimals for the wire. */
function roundCost(value) {
	return Math.round(value * 1e6) / 1e6;
}

function emptyCostRecord() {
	return {
		calls: 0,
		cost: 0,
		costUsd: 0,
		inputTokens: 0,
		cacheReadTokens: 0,
		outputTokens: 0
	};
}

/** Price one `assistant/message` event into a cost record. */
function priceEventInto(record, event) {
	const data = event.data;
	const usage = data?.usage;
	if (usage === void 0 || usage === null) return false;
	if (typeof usage.outputTokens !== "number" && typeof usage.inputTokens !== "number") return false;
	const source = data.message?.source;
	const model = typeof source?.model === "string" ? source.model : "unknown";
	const unit = priceAt(model, event.time ?? Date.now());
	const sample = costOf(usage, unit);
	record.calls += 1;
	record.cost += sample.cost;
	record.costUsd += sample.costUsd;
	record.inputTokens += sample.inputTokens;
	record.cacheReadTokens += sample.cacheReadTokens;
	record.outputTokens += sample.outputTokens;
	return true;
}

const REPLAY_MIN_INTERVAL_MS = 2000;
const logCostCache = new Map();

/**
 * Replay a session's persisted log and price every assistant/message event so
 * the reported cost covers the whole conversation (including messages from
 * before this plugin loaded). Cached per session by log revision.
 */
async function replaySessionCost(ctx, sessionId) {
	const persistence = ctx.get("sessionPersistence");
	if (persistence === void 0 || typeof persistence.readRaw !== "function" || typeof persistence.readStoredRevision !== "function") {
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
	const cached = logCostCache.get(sessionId);
	if (cached !== void 0) {
		if (cached.revision === revision) return cached;
		if (Date.now() - cached.at < REPLAY_MIN_INTERVAL_MS) return cached;
	}
	try {
		const raw = await persistence.readRaw(sessionId);
		if (raw === void 0 || raw === null || typeof raw.content !== "string") return null;
		const record = emptyCostRecord();
		for (const line of raw.content.split("\n")) {
			if (line === "") continue;
			let event;
			try {
				event = JSON.parse(line);
			} catch {
				continue;
			}
			if (event === null || typeof event !== "object" || event.type !== "assistant/message") continue;
			try {
				priceEventInto(record, event);
			} catch {}
		}
		const result = { ...record, revision, at: Date.now() };
		logCostCache.set(sessionId, result);
		return result;
	} catch (error) {
		ctx.logger.warn("dsh-blue-whale-maid: failed to replay session log for costing");
		ctx.logger.warn(error);
		return null;
	}
}

function apply(ctx) {
	// Live in-memory ledger (covers in-flight messages not yet persisted).
	const bySession = new Map();

	ctx.on("session/event", (session, event) => {
		try {
			if (event?.type !== "assistant/message") return;
			let record = bySession.get(session.id);
			if (record === void 0) {
				record = emptyCostRecord();
				bySession.set(session.id, record);
			}
			priceEventInto(record, event);
		} catch (error) {
			ctx.logger.warn("dsh-blue-whale-maid: failed to price an assistant/message event");
			ctx.logger.warn(error);
		}
	});

	// GET /api/blue-whale-maid/balance — remaining balance + today's estimate.
	ctx.effect(
		() => ctx.webServer.register({
			kind: "exact",
			path: BALANCE_ROUTE,
			handler: async (req, res) => {
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
					const response = await fetch(balanceUrl(), {
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
					const todayConsumed = Number.isFinite(total) ? computeTodayConsumed(ctx, total) : null;
					sendJson(res, 200, { ok: true, balance: body, todayConsumed });
				} catch (error) {
					ctx.logger.warn("dsh-blue-whale-maid: failed to fetch DeepSeek balance");
					ctx.logger.warn(error);
					sendJson(res, 502, {
						ok: false,
						error: "fetch-failed",
						message: error instanceof Error ? error.message : String(error)
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
				try {
					const sessionId = new URL(req.url ?? "/", "http://x").searchParams.get("sessionId") ?? "";
					let record = null;
					let source = null;
					if (sessionId !== "") {
						const replay = await replaySessionCost(ctx, sessionId);
						if (replay !== null) {
							record = replay;
							source = "log";
						} else {
							const live = bySession.get(sessionId);
							if (live !== void 0) {
								record = live;
								source = "live";
							}
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
							outputTokens: 0
						});
						return;
					}
					sendJson(res, 200, {
						ok: true,
						sessionId,
						source,
						cost: roundCost(record.cost),
						costUsd: roundCost(record.costUsd),
						calls: record.calls,
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
