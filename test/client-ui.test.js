import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const template = readFileSync(new URL("../src/client.template.js", import.meta.url), "utf8");
const bundle = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

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
		assert.match(source, /closest\("\.bwm-bubble, \.bwm-balance-btn"\)/);
		assert.match(source, /btn\.type = "button"/);
		assert.match(source, /className: "bwm-balance-btn",\s+type: "button"/);
		assert.match(source, /addEventListener\("focusin", onFocusIn\)/);
		assert.match(source, /addEventListener\("focusout", onFocusOut\)/);
		assert.match(source, /role: "status"/);
		assert.match(source, /"aria-live": "polite"/);
		assert.match(source, /"aria-atomic": "true"/);
	}
});
