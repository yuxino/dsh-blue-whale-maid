import test from "node:test";
import assert from "node:assert/strict";

import { costOf, priceAt } from "../lib/pricing.js";
import {
	countUnpricedSessionCostSamples,
	createSessionCostLedger,
	foldSessionCostEvent,
	foldSessionCostEvents,
	isOfficialDeepSeekProvider,
	mergeSessionCostLedgers,
	summarizeSessionCost
} from "../lib/session-cost.js";

const shanghai = (value) => Date.parse(`${value}+08:00`);

function stepStart(turn, step, time, seq) {
	return { type: "step/start", seq, time, data: { turn, step } };
}

function requestContext(turn, step, provider, model, time, seq) {
	return {
		type: "request/context",
		seq,
		time,
		data: { turn, step, provider, model }
	};
}

function usageChunk(turn, step, usage, time, seq) {
	return {
		type: "assistant/chunk",
		seq,
		time,
		data: { turn, step, chunk: { type: "usage", usage } }
	};
}

function finishChunk(turn, step, kind, time, seq) {
	return {
		type: "assistant/chunk",
		seq,
		time,
		data: {
			turn,
			step,
			chunk: {
				type: "finish",
				reason: {
					kind,
					failure: { code: kind.toUpperCase(), message: `${kind} request` }
				}
			}
		}
	};
}

function finalMessage(turn, step, provider, model, usage, time, seq, interrupted = false) {
	return {
		type: "assistant/message",
		seq,
		time,
		data: {
			turn,
			step,
			message: {
				role: "assistant",
				content: [],
				source: { kind: "model", provider, model }
			},
			usage,
			...(interrupted ? { interrupted: true } : {})
		}
	};
}

function compactionStart(compactionId, time, seq) {
	return {
		type: "compaction/start",
		seq,
		time,
		data: { compactionId, turn: null }
	};
}

function compactionSummary(compactionId, provider, model, usage, time, seq, options = {}) {
	const { llmStreamCall = true } = options;
	return {
		type: "compaction/summary",
		seq,
		time,
		data: {
			compactionId,
			summary: [],
			shadowedRange: { start: 1, end: 1 },
			shadowedSeqs: [1],
			shadowedTokenCount: 1,
			provider,
			model,
			...(usage === void 0 ? {} : { usage }),
			...(llmStreamCall ? { rawOutput: [], llmStreamCall: true } : {})
		}
	};
}

function compactionEnd(compactionId, time, seq) {
	return {
		type: "compaction/end",
		seq,
		time,
		data: { compactionId, turn: null }
	};
}

function sumCostRecords(records) {
	return records.reduce((total, record) => ({
		calls: total.calls + 1,
		cost: total.cost + record.cost,
		costUsd: total.costUsd + record.costUsd,
		inputTokens: total.inputTokens + record.inputTokens,
		cacheReadTokens: total.cacheReadTokens + record.cacheReadTokens,
		outputTokens: total.outputTokens + record.outputTokens
	}), {
		calls: 0,
		cost: 0,
		costUsd: 0,
		inputTokens: 0,
		cacheReadTokens: 0,
		outputTokens: 0
	});
}

test("only the exact official DeepSeek provider is billable", () => {
	assert.equal(isOfficialDeepSeekProvider("deepseek-official"), true);
	for (const provider of ["openai", "qwen", "local", "deepseek", "deepseek-official-proxy"]) {
		assert.equal(isOfficialDeepSeekProvider(provider), false);
	}

	const at = shanghai("2026-08-24T10:00:00");
	const events = [];
	for (const [index, provider] of ["openai", "qwen", "local"].entries()) {
		const turn = index + 1;
		events.push(
			stepStart(turn, 1, at, index * 3),
			requestContext(turn, 1, provider, "deepseek-v4-pro", at, index * 3 + 1),
			finalMessage(turn, 1, provider, "deepseek-v4-pro", { inputTokens: 1000, outputTokens: 100 }, at, index * 3 + 2)
		);
	}
	assert.deepEqual(summarizeSessionCost(foldSessionCostEvents(events)), {
		calls: 0,
		cost: 0,
		costUsd: 0,
		inputTokens: 0,
		cacheReadTokens: 0,
		outputTokens: 0
	});
});

test("an explicit official DeepSeek message source is billable without prior context", () => {
	const at = shanghai("2026-08-24T10:00:00");
	const usage = { inputTokens: 1000, cacheReadTokens: 200, outputTokens: 100 };
	const ledger = foldSessionCostEvents([
		finalMessage(1, 1, "deepseek-official", "deepseek-v4-pro", usage, at, 1)
	]);
	const expected = costOf(usage, priceAt("deepseek-v4-pro", at));
	assert.deepEqual(summarizeSessionCost(ledger), { calls: 1, ...expected });
});

test("an unknown model on the official provider remains unpriced", () => {
	const at = shanghai("2026-08-24T10:00:00");
	const ledger = foldSessionCostEvents([
		finalMessage(1, 1, "deepseek-official", "private-gateway-model", { inputTokens: 1000, outputTokens: 100 }, at, 1)
	]);
	assert.deepEqual(summarizeSessionCost(ledger), {
		calls: 0,
		cost: 0,
		costUsd: 0,
		inputTokens: 0,
		cacheReadTokens: 0,
		outputTokens: 0
	});
	assert.equal(countUnpricedSessionCostSamples(ledger), 1);
});

test("no priced usage is distinct from a genuine zero-token priced call", () => {
	const at = shanghai("2026-08-24T10:00:00");
	const contextOnly = foldSessionCostEvents([
		stepStart(1, 1, at, 1),
		requestContext(1, 1, "deepseek-official", "deepseek-v4-flash", at, 2)
	]);
	assert.equal(summarizeSessionCost(contextOnly).calls, 0);

	const zeroTokenCall = foldSessionCostEvents([
		finalMessage(1, 1, "deepseek-official", "deepseek-v4-flash", { inputTokens: 0, outputTokens: 0 }, at, 1)
	]);
	assert.deepEqual(summarizeSessionCost(zeroTokenCall), {
		calls: 1,
		cost: 0,
		costUsd: 0,
		inputTokens: 0,
		cacheReadTokens: 0,
		outputTokens: 0
	});
});

test("legacy assistant provenance still identifies the official provider", () => {
	const at = shanghai("2026-08-24T10:00:00");
	const usage = { inputTokens: 600, outputTokens: 30 };
	const ledger = foldSessionCostEvents([{
		type: "assistant/message",
		seq: 1,
		time: at,
		data: {
			turn: 1,
			step: 1,
			content: [],
			provenance: { provider: "deepseek-official", model: "deepseek-v4-flash" },
			usage
		}
	}]);
	assert.deepEqual(summarizeSessionCost(ledger), {
		calls: 1,
		...costOf(usage, priceAt("deepseek-v4-flash", at))
	});
});

test("final assistant usage replaces the same step's usage chunk", () => {
	const startedAt = shanghai("2026-08-24T11:59:59");
	const contextAt = shanghai("2026-08-24T12:00:01");
	const chunkUsage = { inputTokens: 800, cacheReadTokens: 100, outputTokens: 40 };
	const finalUsage = { inputTokens: 1000, cacheReadTokens: 250, outputTokens: 80 };
	const ledger = foldSessionCostEvents([
		stepStart(1, 1, startedAt, 1),
		requestContext(1, 1, "deepseek-official", "deepseek-v4-pro", contextAt, 2),
		usageChunk(1, 1, chunkUsage, contextAt, 3),
		finalMessage(1, 1, "deepseek-official", "deepseek-v4-pro", finalUsage, contextAt + 1, 4)
	]);
	const expected = costOf(finalUsage, priceAt("deepseek-v4-pro", startedAt));
	assert.deepEqual(summarizeSessionCost(ledger), { calls: 1, ...expected });
});

test("a non-DeepSeek final source removes an earlier same-step charge", () => {
	const at = shanghai("2026-08-24T10:00:00");
	const ledger = foldSessionCostEvents([
		stepStart(1, 1, at, 1),
		requestContext(1, 1, "deepseek-official", "deepseek-v4-pro", at, 2),
		usageChunk(1, 1, { inputTokens: 1000, outputTokens: 50 }, at, 3),
		finalMessage(1, 1, "openai", "gpt-5", { inputTokens: 1000, outputTokens: 50 }, at + 1, 4)
	]);
	assert.equal(summarizeSessionCost(ledger).calls, 0);
});

test("a usage chunk still accounts for a failed request with no final message", () => {
	const at = shanghai("2026-08-24T10:00:00");
	const usage = { inputTokens: 500, outputTokens: 20 };
	const ledger = foldSessionCostEvents([
		stepStart(1, 1, at, 1),
		requestContext(1, 1, "deepseek-official", "deepseek-v4-flash", at, 2),
		usageChunk(1, 1, usage, at + 1, 3)
	]);
	assert.deepEqual(summarizeSessionCost(ledger), {
		calls: 1,
		...costOf(usage, priceAt("deepseek-v4-flash", at))
	});
});

test("error and aborted retries in one step retain every billable attempt", () => {
	const at = shanghai("2026-08-24T10:00:00");
	const first = { inputTokens: 500, outputTokens: 20 };
	const second = { inputTokens: 700, cacheReadTokens: 100, outputTokens: 30 };
	const final = { inputTokens: 900, cacheReadTokens: 200, outputTokens: 40 };
	const events = [
		stepStart(1, 1, at, 1),
		requestContext(1, 1, "deepseek-official", "deepseek-v4-flash", at, 2),
		usageChunk(1, 1, first, at + 1, 3),
		finishChunk(1, 1, "error", at + 2, 4),
		usageChunk(1, 1, second, at + 3, 5),
		finishChunk(1, 1, "aborted", at + 4, 6),
		usageChunk(1, 1, { inputTokens: 800, outputTokens: 35 }, at + 5, 7),
		finalMessage(1, 1, "deepseek-official", "deepseek-v4-flash", final, at + 6, 8)
	];
	const expected = sumCostRecords([
		costOf(first, priceAt("deepseek-v4-flash", at)),
		costOf(second, priceAt("deepseek-v4-flash", at)),
		costOf(final, priceAt("deepseek-v4-flash", at))
	]);
	const replay = foldSessionCostEvents(events);
	const live = foldSessionCostEvents(events);

	assert.deepEqual(summarizeSessionCost(replay), expected);
	assert.deepEqual(summarizeSessionCost(mergeSessionCostLedgers(replay, live)), expected);
});

test("replay and live ledgers merge by step without double counting", () => {
	const at = shanghai("2026-08-24T10:00:00");
	const chunkUsage = { inputTokens: 900, outputTokens: 45 };
	const finalUsage = { inputTokens: 1000, outputTokens: 50 };
	const prefix = [
		stepStart(1, 1, at, 1),
		requestContext(1, 1, "deepseek-official", "deepseek-v4-pro", at, 2),
		usageChunk(1, 1, chunkUsage, at + 1, 3)
	];
	const replay = foldSessionCostEvents(prefix);
	const live = createSessionCostLedger();
	for (const event of prefix) foldSessionCostEvent(live, event);
	foldSessionCostEvent(live, finalMessage(1, 1, "deepseek-official", "deepseek-v4-pro", finalUsage, at + 2, 4, true));

	const expected = costOf(finalUsage, priceAt("deepseek-v4-pro", at));
	assert.deepEqual(summarizeSessionCost(mergeSessionCostLedgers(replay, live)), {
		calls: 1,
		...expected
	});
});

test("an actual official DeepSeek compaction call is billed independently at its start time", () => {
	const startedAt = shanghai("2026-08-24T11:59:59");
	const completedAt = shanghai("2026-08-24T12:00:01");
	const usage = { inputTokens: 1600, cacheReadTokens: 400, outputTokens: 120 };
	const ledger = foldSessionCostEvents([
		compactionStart("compact-1", startedAt, 1),
		compactionSummary("compact-1", "deepseek-official", "deepseek-v4-pro", usage, completedAt, 2),
		compactionEnd("compact-1", completedAt + 1, 3)
	]);

	assert.deepEqual(summarizeSessionCost(ledger), {
		calls: 1,
		...costOf(usage, priceAt("deepseek-v4-pro", startedAt))
	});
});

test("non-call, non-official, model-less, and invalid compaction summaries are not billed", () => {
	const at = shanghai("2026-08-24T10:00:00");
	const validUsage = { inputTokens: 1000, outputTokens: 50 };
	const ineligible = [
		compactionSummary("not-a-call", "deepseek-official", "deepseek-v4-pro", validUsage, at, 1, { llmStreamCall: false }),
		compactionSummary("other-provider", "openai", "deepseek-v4-pro", validUsage, at, 2),
		compactionSummary("no-model", "deepseek-official", "", validUsage, at, 3),
		compactionSummary("no-usage", "deepseek-official", "deepseek-v4-pro", void 0, at, 4),
		compactionSummary("bad-usage", "deepseek-official", "deepseek-v4-pro", { inputTokens: -1, outputTokens: 50 }, at, 5),
		compactionSummary("partial-usage", "deepseek-official", "deepseek-v4-pro", { inputTokens: 1000 }, at, 6)
	];

	assert.deepEqual(summarizeSessionCost(foldSessionCostEvents(ineligible)), {
		calls: 0,
		cost: 0,
		costUsd: 0,
		inputTokens: 0,
		cacheReadTokens: 0,
		outputTokens: 0
	});
});

test("multiple successful compaction attempts keep distinct billable identities", () => {
	const at = shanghai("2026-08-24T10:00:00");
	const firstUsage = { inputTokens: 1200, cacheReadTokens: 300, outputTokens: 80 };
	const secondUsage = { inputTokens: 700, cacheReadTokens: 100, outputTokens: 40 };
	const ledger = foldSessionCostEvents([
		compactionStart("compact-first", at, 1),
		compactionSummary("compact-first", "deepseek-official", "deepseek-v4-pro", firstUsage, at + 1, 2),
		compactionEnd("compact-first", at + 2, 3),
		compactionStart("compact-retry", at + 3, 4),
		compactionSummary("compact-retry", "deepseek-official", "deepseek-v4-flash", secondUsage, at + 4, 5),
		compactionEnd("compact-retry", at + 5, 6)
	]);
	const expected = sumCostRecords([
		costOf(firstUsage, priceAt("deepseek-v4-pro", at)),
		costOf(secondUsage, priceAt("deepseek-v4-flash", at + 3))
	]);

	assert.deepEqual(summarizeSessionCost(ledger), expected);
});

test("replay and live compaction samples merge by compaction id without double counting", () => {
	const at = shanghai("2026-08-24T10:00:00");
	const persistedUsage = { inputTokens: 1000, outputTokens: 60 };
	const liveUsage = { inputTokens: 500, cacheReadTokens: 100, outputTokens: 30 };
	const persistedEvents = [
		compactionStart("compact-persisted", at, 1),
		compactionSummary("compact-persisted", "deepseek-official", "deepseek-v4-pro", persistedUsage, at + 1, 2),
		compactionEnd("compact-persisted", at + 2, 3)
	];
	const replay = foldSessionCostEvents(persistedEvents);
	const live = foldSessionCostEvents([
		...persistedEvents,
		compactionStart("compact-live", at + 3, 4),
		compactionSummary("compact-live", "deepseek-official", "deepseek-v4-flash", liveUsage, at + 4, 5)
	]);
	const expected = sumCostRecords([
		costOf(persistedUsage, priceAt("deepseek-v4-pro", at)),
		costOf(liveUsage, priceAt("deepseek-v4-flash", at + 3))
	]);

	assert.deepEqual(summarizeSessionCost(mergeSessionCostLedgers(replay, live)), expected);
});
