/**
 * Session-cost folding for DeepSeek Harness logs.
 *
 * This module deliberately has no host/runtime dependencies. Both persisted
 * JSONL replay and the live `session/event` listener feed the same reducer, so
 * a provider usage chunk and its final assistant message become one turn/step
 * sample instead of two billable calls. Auxiliary compaction calls are kept as
 * independent samples under their durable compaction ids.
 */
import { costOf, priceAt } from "./pricing.js";

export const OFFICIAL_DEEPSEEK_PROVIDER = "deepseek-official";

const SAMPLE_KIND_RANK = Object.freeze({ chunk: 1, final: 2, compaction: 3 });

/** Only the official DeepSeek adapter is priced by this plugin. */
export function isOfficialDeepSeekProvider(provider) {
	return provider === OFFICIAL_DEEPSEEK_PROVIDER;
}

/** Create one mutable reducer state. The reducer itself owns all mutation. */
export function createSessionCostLedger() {
	return {
		context: null,
		openStep: null,
		stepAttempts: new Map(),
		failedTerminalSeqs: new Set(),
		compactionStarts: new Map(),
		samples: new Map(),
		ordinal: 0
	};
}

function finiteNonNegative(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function tokenCount(value) {
	return Number.isSafeInteger(value) && value >= 0;
}

function eventTime(event) {
	return finiteNonNegative(event?.time) ? event.time : null;
}

function eventSeq(event) {
	return Number.isSafeInteger(event?.seq) && event.seq >= 0 ? event.seq : null;
}

function routeFrom(value, at) {
	if (value === null || typeof value !== "object") return null;
	const provider = typeof value.provider === "string" ? value.provider : null;
	const model = typeof value.model === "string" ? value.model : null;
	if (provider === null && model === null) return null;
	return { provider, model, at };
}

function eventRoute(event) {
	if (event?.type === "request/context") return routeFrom(event.data, eventTime(event));
	if (event?.type === "request/header") return routeFrom(event.data?.header?.config, eventTime(event));
	return null;
}

function stepIdentity(data) {
	if (!Number.isSafeInteger(data?.turn) || data.turn < 0) return null;
	if (!Number.isSafeInteger(data?.step) || data.step < 0) return null;
	return {
		turn: data.turn,
		step: data.step,
		key: `${data.turn}:${data.step}`
	};
}

function attemptIdentity(ledger, data) {
	const step = stepIdentity(data);
	if (step === null) return null;
	const attempt = ledger.stepAttempts.get(step.key) ?? 0;
	return {
		...step,
		attempt,
		key: `${step.key}:attempt:${attempt}`
	};
}

function compactionIdentity(data) {
	if (typeof data?.compactionId !== "string" || data.compactionId === "") return null;
	return {
		compactionId: data.compactionId,
		key: `compaction:${data.compactionId}`
	};
}

function usageSample(event) {
	if (event?.type === "assistant/chunk" && event.data?.chunk?.type === "usage") {
		return { kind: "chunk", usage: event.data.chunk.usage };
	}
	if (event?.type === "assistant/message") {
		const usage = event.data?.usage ?? event.data?.message?.usage;
		if (usage !== void 0) return { kind: "final", usage };
	}
	return null;
}

function failedTerminal(event) {
	if (event?.type !== "assistant/chunk" || event.data?.chunk?.type !== "finish") return null;
	const kind = event.data.chunk.reason?.kind;
	return kind === "error" || kind === "aborted" ? stepIdentity(event.data) : null;
}

function normalizeUsage(usage) {
	if (usage === null || typeof usage !== "object") return null;
	// DSH TokenUsage requires both input and output counts. Optional cache-read
	// usage must still be a valid token count when present.
	if (!tokenCount(usage.inputTokens) || !tokenCount(usage.outputTokens)) return null;
	if (usage.cacheReadTokens !== void 0 && !tokenCount(usage.cacheReadTokens)) return null;
	return {
		inputTokens: usage.inputTokens,
		cacheReadTokens: usage.cacheReadTokens ?? 0,
		outputTokens: usage.outputTokens
	};
}

function routeForSample(ledger, event) {
	const sourceValue = event.type === "assistant/message"
		? event.data?.message?.source ?? event.data?.provenance ?? event.data?.source
		: null;
	const source = routeFrom(sourceValue, eventTime(event));
	const step = ledger.openStep;
	const fallback = step ?? ledger.context;
	return {
		// An explicit message source is authoritative, including when it says the
		// final response came from a non-DeepSeek provider.
		provider: source?.provider ?? fallback?.provider ?? null,
		model: source?.model ?? fallback?.model ?? null,
		// Event logs normally always carry milliseconds. Zero is a deterministic
		// legacy fallback that selects the first known policy without consulting
		// wall-clock time during replay.
		at: step?.startedAt ?? fallback?.at ?? eventTime(event) ?? 0
	};
}

function emptySample(identity, event, kind, route, ordinal) {
	return {
		...identity,
		kind,
		provider: route.provider,
		model: route.model,
		pricedAt: route.at,
		eventSeq: eventSeq(event),
		eventTime: eventTime(event),
		ordinal,
		billable: false,
		unpriced: false,
		cost: 0,
		costUsd: 0,
		inputTokens: 0,
		cacheReadTokens: 0,
		outputTokens: 0
	};
}

function priceSample(identity, event, kind, route, normalized, ordinal) {
	let sample = emptySample(identity, event, kind, route, ordinal);
	if (isOfficialDeepSeekProvider(route.provider) && typeof route.model === "string" && route.model !== "") {
		const unit = priceAt(route.model, route.at);
		if (unit.priced === true) {
			const priced = costOf(normalized, unit);
			sample = {
				...sample,
				billable: true,
				...priced
			};
		} else {
			sample = { ...sample, unpriced: true };
		}
	}
	return sample;
}

function compareSamples(left, right) {
	if (left.eventSeq !== null && right.eventSeq !== null && left.eventSeq !== right.eventSeq) {
		return left.eventSeq - right.eventSeq;
	}
	if (left.eventTime !== null && right.eventTime !== null && left.eventTime !== right.eventTime) {
		return left.eventTime - right.eventTime;
	}
	const kindDelta = SAMPLE_KIND_RANK[left.kind] - SAMPLE_KIND_RANK[right.kind];
	if (kindDelta !== 0) return kindDelta;
	return left.ordinal - right.ordinal;
}

function keepNewerSample(ledger, sample) {
	const previous = ledger.samples.get(sample.key);
	if (previous === void 0 || compareSamples(previous, sample) <= 0) {
		ledger.samples.set(sample.key, sample);
	}
}

/**
 * Fold one DSH session event into a ledger.
 *
 * Returns true when the event changed pricing context or supplied a usage
 * sample. This is useful to touch a live-session LRU without treating every
 * text delta as activity worth retaining.
 */
export function foldSessionCostEvent(ledger, event) {
	if (
		ledger === null ||
		typeof ledger !== "object" ||
		!(ledger.samples instanceof Map) ||
		!(ledger.stepAttempts instanceof Map) ||
		!(ledger.failedTerminalSeqs instanceof Set) ||
		!(ledger.compactionStarts instanceof Map)
	) {
		throw new TypeError("invalid session cost ledger");
	}
	if (event === null || typeof event !== "object") return false;
	ledger.ordinal += 1;

	if (event.type === "step/start") {
		const identity = stepIdentity(event.data);
		if (identity === null) return false;
		ledger.openStep = {
			...identity,
			provider: ledger.context?.provider ?? null,
			model: ledger.context?.model ?? null,
			startedAt: eventTime(event) ?? ledger.context?.at ?? null
		};
		ledger.stepAttempts.set(identity.key, 0);
		return true;
	}

	if (event.type === "compaction/start") {
		const identity = compactionIdentity(event.data);
		if (identity === null) return false;
		ledger.compactionStarts.set(identity.compactionId, eventTime(event));
		return true;
	}

	if (event.type === "compaction/end") {
		const identity = compactionIdentity(event.data);
		if (identity === null) return false;
		ledger.compactionStarts.delete(identity.compactionId);
		return true;
	}

	if (event.type === "compaction/summary") {
		const data = event.data;
		const identity = compactionIdentity(data);
		if (
			identity === null ||
			data?.llmStreamCall !== true ||
			!isOfficialDeepSeekProvider(data.provider) ||
			typeof data.model !== "string" ||
			data.model === ""
		) {
			return false;
		}
		const normalized = normalizeUsage(data.usage);
		if (normalized === null) return false;
		const route = {
			provider: data.provider,
			model: data.model,
			at: ledger.compactionStarts.get(identity.compactionId) ?? eventTime(event) ?? 0
		};
		keepNewerSample(
			ledger,
			priceSample(identity, event, "compaction", route, normalized, ledger.ordinal)
		);
		return true;
	}

	const route = eventRoute(event);
	if (route !== null) {
		ledger.context = {
			provider: route.provider ?? ledger.context?.provider ?? null,
			model: route.model ?? ledger.context?.model ?? null,
			at: route.at ?? ledger.context?.at ?? null
		};
		if (ledger.openStep !== null) {
			ledger.openStep.provider = route.provider ?? ledger.openStep.provider;
			ledger.openStep.model = route.model ?? ledger.openStep.model;
			ledger.openStep.startedAt ??= route.at;
		}
		return true;
	}

	const terminalIdentity = failedTerminal(event);
	if (terminalIdentity !== null) {
		const seq = eventSeq(event);
		if (seq !== null && ledger.failedTerminalSeqs.has(seq)) return false;
		if (seq !== null) ledger.failedTerminalSeqs.add(seq);
		const attempt = ledger.stepAttempts.get(terminalIdentity.key) ?? 0;
		ledger.stepAttempts.set(terminalIdentity.key, attempt + 1);
		return true;
	}

	if (event.type === "step/end") {
		const identity = stepIdentity(event.data);
		if (identity !== null && ledger.openStep?.key === identity.key) ledger.openStep = null;
		return identity !== null;
	}

	const observed = usageSample(event);
	if (observed === null) return false;
	const identity = attemptIdentity(ledger, event.data);
	if (identity === null) return false;
	const normalized = normalizeUsage(observed.usage);
	if (normalized === null) return false;
	const sampleRoute = routeForSample(ledger, event);
	const sample = priceSample(identity, event, observed.kind, sampleRoute, normalized, ledger.ordinal);
	// Non-billable samples are retained as tombstones. A newer final event from
	// another provider must be able to replace a stale replay/live sample for the
	// same attempt rather than leave the earlier DeepSeek charge behind.
	keepNewerSample(ledger, sample);
	return true;
}

/** Fold an iterable (or array) of events into a fresh ledger. */
export function foldSessionCostEvents(events) {
	const ledger = createSessionCostLedger();
	for (const event of events) foldSessionCostEvent(ledger, event);
	return ledger;
}

/** Merge replay and live ledgers by durable step-attempt identity, keeping each call once. */
export function mergeSessionCostLedgers(left, right) {
	if (left === null) return right;
	if (right === null) return left;
	const merged = createSessionCostLedger();
	for (const sample of left.samples.values()) keepNewerSample(merged, sample);
	for (const sample of right.samples.values()) keepNewerSample(merged, sample);
	return merged;
}

/** Convert a ledger to the existing public session-cost response totals. */
export function summarizeSessionCost(ledger) {
	const record = {
		calls: 0,
		cost: 0,
		costUsd: 0,
		inputTokens: 0,
		cacheReadTokens: 0,
		outputTokens: 0
	};
	if (ledger === null) return record;
	for (const sample of ledger.samples.values()) {
		if (!sample.billable) continue;
		record.calls += 1;
		record.cost += sample.cost;
		record.costUsd += sample.costUsd;
		record.inputTokens += sample.inputTokens;
		record.cacheReadTokens += sample.cacheReadTokens;
		record.outputTokens += sample.outputTokens;
	}
	return record;
}

/** Count official-provider usage samples whose model has no explicit price. */
export function countUnpricedSessionCostSamples(ledger) {
	if (ledger === null) return 0;
	let count = 0;
	for (const sample of ledger.samples.values()) {
		if (sample.unpriced === true) count += 1;
	}
	return count;
}
