import test from "node:test";
import assert from "node:assert/strict";

import {
	advanceDayMeterState,
	balanceMeterIdentity,
	isTrustedHostRequest
} from "../lib/host-utils.js";

test("daily balance meter accumulates spending across top-ups", () => {
	let state = null;
	let update = advanceDayMeterState(state, "account-a", 10, "2026-08-26");
	assert.equal(update.todayConsumed, null);
	state = update.state;

	update = advanceDayMeterState(state, "account-a", 8, "2026-08-26");
	assert.equal(update.todayConsumed, 2);
	state = update.state;

	update = advanceDayMeterState(state, "account-a", 108, "2026-08-26");
	assert.equal(update.todayConsumed, 2, "a top-up must not erase prior spending");
	state = update.state;

	update = advanceDayMeterState(state, "account-a", 103, "2026-08-26");
	assert.equal(update.todayConsumed, 7);
	state = update.state;

	update = advanceDayMeterState(state, "account-a", 100, "2026-08-27");
	assert.equal(update.todayConsumed, null, "a new local day starts a fresh baseline");
});

test("daily meter keeps account and endpoint identities isolated without storing secrets", () => {
	const endpoint = "https://api.deepseek.com/user/balance";
	const first = balanceMeterIdentity(endpoint, "secret-key-a");
	const same = balanceMeterIdentity(endpoint, "secret-key-a");
	const otherKey = balanceMeterIdentity(endpoint, "secret-key-b");
	const otherEndpoint = balanceMeterIdentity("https://gateway.example/user/balance", "secret-key-a");
	assert.equal(first, same);
	assert.notEqual(first, otherKey);
	assert.notEqual(first, otherEndpoint);
	assert.match(first, /^[a-f0-9]{64}$/);
	assert.equal(first.includes("secret-key-a"), false);

	let state = advanceDayMeterState(null, first, 20, "2026-08-26").state;
	state = advanceDayMeterState(state, first, 18, "2026-08-26").state;
	let switched = advanceDayMeterState(state, otherKey, 100, "2026-08-26");
	assert.equal(switched.todayConsumed, null);
	state = switched.state;
	switched = advanceDayMeterState(state, first, 17, "2026-08-26");
	assert.equal(switched.todayConsumed, 3, "switching back resumes the original account segment");
});

test("host financial routes trust loopback addresses through common Node request fields", () => {
	for (const request of [
		{ headers: { host: "127.0.0.1:3080" }, socket: { remoteAddress: "127.0.0.1" } },
		{ headers: { host: "127.42.1.9:3080" }, socket: { remoteAddress: "127.42.1.9" } },
		{ headers: { host: "[::1]:3080" }, socket: { remoteAddress: "::1" } },
		{ headers: { host: "localhost:3080" }, socket: { remoteAddress: "::ffff:127.0.0.1" } },
		{ headers: { host: "localhost:3080" }, connection: { remoteAddress: "127.0.0.1" } },
		{ headers: { host: "localhost:3080" }, client: { remoteAddress: "::1" } },
		{ raw: { headers: { host: "127.0.0.1:3080" }, socket: { remoteAddress: "127.0.0.1" } } },
		{
			headers: new Headers({
				host: "127.0.0.1:3080",
				origin: "http://127.0.0.1:3080",
				"sec-fetch-site": "same-origin"
			}),
			socket: { remoteAddress: "127.0.0.1" }
		},
		{
			headers: {
				host: "127.0.0.1:3080",
				origin: "http://127.0.0.1",
				"sec-fetch-site": "same-origin"
			},
			socket: { remoteAddress: "127.0.0.1" }
		},
		{
			headers: {
				host: "localhost:3080",
				referer: "http://localhost:3080/conversation/one",
				"sec-fetch-site": "same-origin"
			},
			socket: { remoteAddress: "127.0.0.1" }
		},
		{
			headers: {
				host: "localhost:3443",
				origin: "https://localhost:3443",
				"sec-fetch-site": "same-origin"
			},
			socket: { remoteAddress: "127.0.0.1", encrypted: true }
		}
	]) {
		assert.equal(isTrustedHostRequest(request), true);
	}
	for (const request of [
		{},
		{ headers: { host: "127.0.0.1:3080" }, socket: {} },
		{ headers: { host: "127.0.0.1:3080" }, socket: { remoteAddress: "192.168.1.5" } },
		{ headers: { host: "127.0.0.1:3080" }, socket: { remoteAddress: "::ffff:192.168.1.5" } },
		{ headers: { host: "127.0.0.1:3080" }, socket: { remoteAddress: "localhost" } },
		{
			headers: { host: "127.0.0.1:3080" },
			socket: { remoteAddress: "192.168.1.5" },
			connection: { remoteAddress: "127.0.0.1" }
		},
		{ headers: {}, socket: { remoteAddress: "127.0.0.1" } },
		{ headers: { host: "evil.example" }, socket: { remoteAddress: "127.0.0.1" } },
		{ headers: { host: "evil.example@127.0.0.1" }, socket: { remoteAddress: "127.0.0.1" } },
		{
			headers: { host: "127.0.0.1:3080", origin: "https://evil.example" },
			socket: { remoteAddress: "127.0.0.1" }
		},
		{
			headers: { host: "127.0.0.1:3080", origin: "null" },
			socket: { remoteAddress: "127.0.0.1" }
		},
		{
			headers: { host: "127.0.0.1:3080", "sec-fetch-site": "cross-site" },
			socket: { remoteAddress: "127.0.0.1" }
		},
		{
			headers: { host: "127.0.0.1:3080", "sec-fetch-site": "same-site" },
			socket: { remoteAddress: "127.0.0.1" }
		},
		{
			headers: {
				host: "127.0.0.1:3080",
				origin: "http://127.0.0.1",
				"sec-fetch-site": "same-site"
			},
			socket: { remoteAddress: "127.0.0.1" }
		},
		{
			headers: { host: "127.0.0.1:3080", origin: "http://127.0.0.1" },
			socket: { remoteAddress: "127.0.0.1" }
		},
		{
			headers: { host: "127.0.0.1:3080", referer: "https://evil.example/page" },
			socket: { remoteAddress: "127.0.0.1" }
		},
		{
			headers: { host: "127.0.0.1:3080", origin: ["https://evil.example", "http://127.0.0.1:3080"] },
			socket: { remoteAddress: "127.0.0.1" }
		},
		{
			headers: {
				host: "127.0.0.1:3080",
				origin: "https://127.0.0.1:3080",
				"sec-fetch-site": "same-origin"
			},
			socket: { remoteAddress: "127.0.0.1", encrypted: false }
		}
	]) {
		assert.equal(isTrustedHostRequest(request), false);
	}
});
