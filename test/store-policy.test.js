import test from "node:test";
import assert from "node:assert/strict";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|json|ya?ml|sh|py|rb|go|rs)$/i;
const NATIVE_FILE = /\.(?:node|wasm|dll|dylib|so|exe|bin)$/i;
const EXCLUDED_DIRECTORY = /(?:^|\/)(?:node_modules|vendor|test|tests|docs?|examples?|fixtures?|benchmarks?|coverage|\.github)(?:\/|$)/i;
const MAX_RUNTIME_FILES = 240;
const MAX_FILE_BYTES = 262144;
const MAX_TOTAL_BYTES = 2097152;

const moduleImport = (names) => new RegExp(
	`(?:\\bfrom\\s*|\\bimport\\s*(?:\\(\\s*)?|\\brequire\\s*\\(\\s*)["'](?:node:)?(?:${names})["']`,
	"i"
);
const FILE_MODULE = moduleImport("fs|fs/promises");
const NETWORK_MODULE = moduleImport("http|https|net|tls|dgram|axios|got|undici");
const COMMAND_MODULE = moduleImport("child_process");

function permissionSignals(source) {
	return {
		files: FILE_MODULE.test(source)
			|| /\b(?:readFile|writeFile|appendFile|rename|unlink|mkdir|rmdir|rm)\s*\(/i.test(source)
			|| /\$DSH_HOME|\.dsh\/profiles/i.test(source),
		network: NETWORK_MODULE.test(source)
			|| /\b(?:fetch|WebSocket|EventSource)\s*\(/i.test(source)
			|| /\b(?:axios|got|undici)\s*(?:\.|\()/i.test(source),
		commands: COMMAND_MODULE.test(source)
			|| /\b(?:exec|execFile|spawn|fork)\s*\(|shell\s*:\s*true|Bun\.spawn|new\s+Deno\.Command/i.test(source),
		credentials: /process\.env/i.test(source)
			|| /\b(?:keychain|credentials?|oauth)\b\s*(?:\.|\[|\()/i.test(source)
			|| /\b(?:api[_-]?key|apiKey|access[_-]?token|accessToken|client[_-]?secret|clientSecret|password)\b/i.test(source),
		protectedDsh: /(?:__ModuleLoader__[^\n]{0,120}(?:unload|remove)|\bFiber\b[^\n]{0,120}(?:remove|disable|replace)|@deepseek-ai\/[^\n]{0,160}disabled\s*:\s*true|tool\.call\.toolview)/i.test(source)
	};
}

function repositoryFiles(dir = root) {
	const files = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === ".git") continue;
		const path = join(dir, entry.name);
		const rel = relative(root, path).replaceAll("\\", "/");
		if (EXCLUDED_DIRECTORY.test(rel)) continue;
		if (entry.isDirectory()) files.push(...repositoryFiles(path));
		else files.push({ path, rel, stat: lstatSync(path) });
	}
	return files;
}

test("repository satisfies the Store bounded low-permission source policy", () => {
	const files = repositoryFiles();
	assert.deepEqual(
		files.filter(({ rel, stat }) => NATIVE_FILE.test(rel) || (stat.mode & 0o111) !== 0).map(({ rel }) => rel),
		[],
		"runtime tree must not contain native artifacts or executable files"
	);
	assert.deepEqual(
		files.filter(({ stat }) => stat.isSymbolicLink()).map(({ rel }) => rel),
		[],
		"runtime tree must not contain symlinks"
	);

	const runtime = files.filter(({ rel, stat }) => stat.isFile() && SOURCE_FILE.test(rel));
	assert.ok(runtime.length > 0 && runtime.length <= MAX_RUNTIME_FILES);
	const sizes = runtime.map(({ stat }) => stat.size);
	assert.ok(Math.max(...sizes) <= MAX_FILE_BYTES, `largest runtime file is ${Math.max(...sizes)} bytes`);
	assert.ok(sizes.reduce((sum, size) => sum + size, 0) <= MAX_TOTAL_BYTES);

	const combined = runtime.map(({ path }) => readFileSync(path, "utf8")).join("\n");
	assert.deepEqual(permissionSignals(combined), {
		files: false,
		network: false,
		commands: false,
		credentials: false,
		protectedDsh: false
	});
});

test("manifest and root license declare one reviewable package contract", () => {
	const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	assert.equal(manifest.license, "MIT");
	assert.equal(manifest.repository.url, "git+https://github.com/yuxino/dsh-blue-whale-maid.git");
	assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0);
	assert.equal(manifest.dependencies, undefined);
	assert.equal(manifest.optionalDependencies, undefined);
	assert.equal(manifest.bundledDependencies, undefined);
	assert.equal(manifest.bundleDependencies, undefined);
	assert.equal(manifest.dsh?.compatibility?.dsh, "^0.1.1-rc.2");
	assert.deepEqual(manifest.dsh?.compatibility?.profiles, ["web"]);
	const latestDshReleases = ["rc.8", "0.1.1-rc.1", "0.1.1-rc.2"];
	assert.ok(latestDshReleases.every((release) =>
		["compatible", "incompatible", "unknown"].includes(manifest.dsh?.compatibility?.dshReleases?.[release])
	));
	assert.ok(latestDshReleases.some((release) =>
		manifest.dsh?.compatibility?.dshReleases?.[release] === "compatible"
	), "at least one current DSH release needs exact compatible evidence");
	for (const script of ["preinstall", "install", "postinstall", "prepare"]) {
		assert.equal(manifest.scripts?.[script], undefined);
	}
	const license = readFileSync(join(root, "LICENSE"), "utf8");
	assert.match(license, /^MIT License\n/);
	assert.doesNotMatch(license, /^---$/m);
});
