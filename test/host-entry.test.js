import test from "node:test";
import assert from "node:assert/strict";

test("host entry loads from a dependency-free local DSH link", async () => {
	const plugin = await import("../lib/index.js");

	assert.equal(plugin.name, "dsh-blue-whale-maid");
	assert.deepEqual(plugin.inject, ["credentials", "webServer"]);
	assert.equal(typeof plugin.apply, "function");
});
