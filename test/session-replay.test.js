import test from "node:test";
import assert from "node:assert/strict";

import { readPersistedSessionEvents } from "../lib/session-replay.js";

test("persistence replay uses readFrom for no-raw backends such as SQLite", async () => {
	const events = [{ type: "step/start", seq: 1, time: 1, data: { turn: 1, step: 1 } }];
	const calls = [];
	const persistence = {
		supportsRawArtifacts: false,
		async readFrom(id, fromSeq) {
			calls.push([id, fromSeq]);
			return { meta: { id }, events };
		}
	};
	assert.deepEqual(await readPersistedSessionEvents(persistence, "session-a"), events);
	assert.deepEqual(calls, [["session-a", 0]]);
});

test("persistence replay falls back to raw JSONL on older raw-capable services", async () => {
	const event = { type: "step/end", seq: 2, time: 2, data: { turn: 1, step: 1 } };
	const persistence = {
		supportsRawArtifacts: true,
		async readRaw() {
			return {
				meta: { id: "session-a" },
				content: `${JSON.stringify({ type: "session", version: 1 })}\ninvalid\n${JSON.stringify(event)}\n`
			};
		}
	};
	assert.deepEqual(await readPersistedSessionEvents(persistence, "session-a"), [
		{ type: "session", version: 1 },
		event
	]);
});

test("persistence replay degrades honestly when neither logical nor raw reads exist", async () => {
	assert.equal(await readPersistedSessionEvents({ supportsRawArtifacts: false }, "session-a"), null);
});
