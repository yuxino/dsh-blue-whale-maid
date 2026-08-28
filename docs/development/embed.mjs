#!/usr/bin/env node
/**
 * Rebuilds `lib/client.js` from `src/client.template.js` by inlining the
 * lightweight original character image as a base64 data URL.
 *
 * The Store scans runtime source with a 256 KiB per-file bound. Keep this
 * generated bundle below that limit and commit it for deterministic installs.
 *
 * Usage: node docs/development/embed.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const template = readFileSync(join(root, "src", "client.template.js"), "utf8");
const character = readFileSync(join(root, "assets", "blue-whale-maid-v2.png"));

const characterPlaceholder = 'const CHARACTER_DATA_URL = "__CHARACTER_DATA_URL__";';
if (!template.includes(characterPlaceholder)) {
	throw new Error("template placeholder not found — did src/client.template.js change?");
}

const dataUrl = `data:image/png;base64,${character.toString("base64")}`;
const out = template.replace(
	characterPlaceholder,
	`const CHARACTER_DATA_URL = ${JSON.stringify(dataUrl)};`
);
const bytes = Buffer.byteLength(out);
const maxBytes = 256 * 1024;
if (bytes > maxBytes) {
	throw new Error(`generated lib/client.js is ${bytes} bytes (maximum ${maxBytes})`);
}

writeFileSync(join(root, "lib", "client.js"), out);
console.log(`wrote lib/client.js (${bytes} bytes)`);
