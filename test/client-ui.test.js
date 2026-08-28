import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../src/client.template.js", import.meta.url), "utf8");
const bundle = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
const characterDataUrl = `data:image/png;base64,${readFileSync(new URL("../assets/blue-whale-maid-v2.png", import.meta.url)).toString("base64")}`;

test("speech bubble keeps its sticker treatment and viewport-safe placement", () => {
	for (const source of [template, bundle]) {
		assert.match(source, /--bwm-paper:#fffdf8/);
		assert.match(source, /bwm-bubble-pop/);
		assert.match(source, /prefers-reduced-motion: reduce/);
		assert.match(source, /max-width:min\(320px,calc\(100vw - 24px\)\)/);
		assert.match(source, /classList\.toggle\("bwm-below"/);
		assert.match(source, /belowSpace > aboveSpace/);
		assert.match(source, /style\.setProperty\("--bwm-bubble-shift"/);
		assert.match(source, /window\.addEventListener\("resize", onResize\)/);
	}
});

test("interactive bubbles own their pointer and expose accessible controls", () => {
	for (const source of [template, bundle]) {
		assert.match(source, /closest\("\.bwm-bubble"\)/);
		assert.match(source, /btn\.type = "button"/);
		assert.match(source, /addEventListener\("focusin", onFocusIn\)/);
		assert.match(source, /addEventListener\("focusout", onFocusOut\)/);
		assert.match(source, /role: "status"/);
		assert.match(source, /"aria-live": "polite"/);
		assert.match(source, /"aria-atomic": "true"/);
	}
});

test("browser-only bundle keeps task behavior without privileged account access", () => {
	for (const source of [template, bundle]) {
		assert.doesNotMatch(source, /\bfetch\s*\(/);
		assert.doesNotMatch(source, /blue-whale-maid\/(?:balance|session-cost)/);
		assert.doesNotMatch(source, /bwm-balance/);
		assert.match(source, /const inject = \["slots", "sessions"\]/);
		assert.match(source, /observeSessionTransitions/);
		assert.match(source, /pushNotify\("failed"/);
		assert.match(source, /pushNotify\(prev\.sawNewFailure \? "failed" : "ended"/);
		assert.match(source, /pendingInteraction/);
		assert.match(source, /requestAnimationFrame\(loop\)/);
		for (const event of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
			assert.match(source, new RegExp(`addEventListener\\("${event}"`));
		}
	}
});

test("generated client embeds the compact character image", () => {
	assert.match(template, /__CHARACTER_DATA_URL__/);
	assert.match(bundle, /data:image\/png;base64,/);
	assert.doesNotMatch(bundle, /__CHARACTER_DATA_URL__/);
	assert.match(bundle, /character\.src = CHARACTER_DATA_URL/);
	const expected = template.replace(
		'const CHARACTER_DATA_URL = "__CHARACTER_DATA_URL__";',
		`const CHARACTER_DATA_URL = ${JSON.stringify(characterDataUrl)};`
	);
	assert.equal(bundle, expected, "committed bundle must exactly match the template and assets");
});
