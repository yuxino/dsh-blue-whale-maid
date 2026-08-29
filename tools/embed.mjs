#!/usr/bin/env node
/**
 * Rebuilds `lib/client.js` from `src/client.template.js` by inlining
 * `assets/spritesheet.webp` as a base64 data URL.
 *
 * Usage: node tools/embed.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const template = readFileSync(join(root, "src", "client.template.js"), "utf8");
const atlas = readFileSync(join(root, "assets", "spritesheet.webp"));

if (!template.includes('const ATLAS_DATA_URL = "__ATLAS_DATA_URL__";')) {
	throw new Error("template placeholder not found — did src/client.template.js change?");
}

const dataUrl = `data:image/webp;base64,${atlas.toString("base64")}`;
const out = template.replace('const ATLAS_DATA_URL = "__ATLAS_DATA_URL__";', `const ATLAS_DATA_URL = ${JSON.stringify(dataUrl)};`);

writeFileSync(join(root, "lib", "client.js"), out);
console.log(`wrote lib/client.js (${(out.length / 1024 / 1024).toFixed(2)} MiB)`);
