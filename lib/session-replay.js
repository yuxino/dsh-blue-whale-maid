/**
 * Read a persisted session as logical events without mutating recovery state.
 * Modern DSH exposes readFrom for every first-party backend, including SQLite.
 * The raw JSONL branch keeps compatibility with older raw-capable services.
 */
export async function readPersistedSessionEvents(persistence, sessionId) {
	if (persistence === null || typeof persistence !== "object") return null;
	if (typeof persistence.readFrom === "function") {
		const stored = await persistence.readFrom(sessionId, 0);
		return Array.isArray(stored?.events) ? stored.events : null;
	}
	if (persistence.supportsRawArtifacts !== true || typeof persistence.readRaw !== "function") return null;

	const raw = await persistence.readRaw(sessionId);
	if (raw === void 0 || raw === null || typeof raw.content !== "string") return null;
	const events = [];
	for (const line of raw.content.split("\n")) {
		if (line === "") continue;
		try {
			const event = JSON.parse(line);
			if (event !== null && typeof event === "object") events.push(event);
		} catch {}
	}
	return events;
}
