import test from "node:test";
import assert from "node:assert/strict";

import { isPeak, priceAt } from "../lib/pricing.js";

const shanghai = (value) => Date.parse(`${value}+08:00`);

test("DeepSeek peak windows apply only on Shanghai weekdays", () => {
	assert.equal(isPeak(shanghai("2026-08-24T08:59:59")), false);
	assert.equal(isPeak(shanghai("2026-08-24T09:00:00")), true);
	assert.equal(isPeak(shanghai("2026-08-24T11:59:59")), true);
	assert.equal(isPeak(shanghai("2026-08-24T12:00:00")), false);
	assert.equal(isPeak(shanghai("2026-08-24T13:59:59")), false);
	assert.equal(isPeak(shanghai("2026-08-24T14:00:00")), true);
	assert.equal(isPeak(shanghai("2026-08-24T17:59:59")), true);
	assert.equal(isPeak(shanghai("2026-08-24T18:00:00")), false);
	assert.equal(isPeak(shanghai("2026-08-22T10:00:00")), false, "Saturday is always off-peak");
	assert.equal(isPeak(shanghai("2026-08-23T15:00:00")), false, "Sunday is always off-peak");
});

test("weekend pricing uses the off-peak table", () => {
	assert.equal(priceAt("deepseek-v4-pro", shanghai("2026-08-21T10:00:00")).mode, "peak");
	assert.equal(priceAt("deepseek-v4-pro", shanghai("2026-08-22T10:00:00")).mode, "offPeak");
});

test("the official V4 Flash vision experiment uses the published Flash rates", () => {
	const peak = priceAt("deepseek-v4-flash-vision-exp", shanghai("2026-08-24T10:00:00"));
	assert.equal(peak.priced, true);
	assert.deepEqual(peak.cny, { input: 3, cacheRead: 0.1, output: 9 });
	assert.deepEqual(peak.usd, { input: 0.44, cacheRead: 0.014, output: 1.32 });

	const offPeak = priceAt("deepseek-v4-flash-vision-exp", shanghai("2026-08-24T12:00:00"));
	assert.equal(offPeak.priced, true);
	assert.deepEqual(offPeak.cny, { input: 1.5, cacheRead: 0.05, output: 4.5 });
	assert.deepEqual(offPeak.usd, { input: 0.22, cacheRead: 0.007, output: 0.66 });
});

test("unknown official-provider models are explicitly unpriced", () => {
	const price = priceAt("private-gateway-model", shanghai("2026-08-24T10:00:00"));
	assert.equal(price.priced, false);
	assert.deepEqual(price.cny, { input: 0, cacheRead: 0, output: 0 });
	assert.deepEqual(price.usd, { input: 0, cacheRead: 0, output: 0 });
});
