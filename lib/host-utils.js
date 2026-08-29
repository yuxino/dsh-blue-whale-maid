import { createHash } from "node:crypto";

const DAY_STATE_VERSION = 2;
const MAX_METER_IDENTITIES = 16;

function roundCents(value) {
	return Math.round(value * 100) / 100;
}

/** Derive a stable, non-reversible meter partition without persisting credentials. */
export function balanceMeterIdentity(endpoint, credential) {
	return createHash("sha256")
		.update(String(endpoint))
		.update("\0")
		.update(String(credential))
		.digest("hex");
}

/**
 * Advance one account's daily balance-delta meter.
 *
 * Positive balance deltas are top-ups and start a new segment without erasing
 * earlier consumption. Negative deltas add to the accumulated daily amount.
 */
export function advanceDayMeterState(state, identity, balance, date) {
	if (typeof identity !== "string" || identity === "") throw new TypeError("invalid meter identity");
	if (!Number.isFinite(balance)) throw new TypeError("invalid balance");
	if (typeof date !== "string" || date === "") throw new TypeError("invalid meter date");

	const meters = state?.version === DAY_STATE_VERSION && state.meters !== null && typeof state.meters === "object"
		? { ...state.meters }
		: {};
	const previous = meters[identity];
	const canContinue = previous !== null && typeof previous === "object" &&
		previous.date === date && Number.isFinite(previous.last) &&
		Number.isFinite(previous.consumed) && previous.consumed >= 0;
	const consumed = canContinue
		? roundCents(previous.consumed + Math.max(0, previous.last - balance))
		: 0;

	// Reinsert the current identity last so object insertion order acts as a
	// compact recency list when old account partitions are pruned.
	delete meters[identity];
	meters[identity] = { date, last: balance, consumed };
	while (Object.keys(meters).length > MAX_METER_IDENTITIES) {
		delete meters[Object.keys(meters)[0]];
	}

	return {
		state: { version: DAY_STATE_VERSION, meters },
		todayConsumed: canContinue ? consumed : null
	};
}

function isIpv4Loopback(address) {
	const octets = address.split(".");
	return octets.length === 4 && octets[0] === "127" &&
		octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

export function isLoopbackAddress(address) {
	if (typeof address !== "string" || address === "") return false;
	const normalized = address.toLowerCase().split("%")[0];
	if (normalized === "::1") return true;
	if (normalized.startsWith("::ffff:")) return isIpv4Loopback(normalized.slice(7));
	return isIpv4Loopback(normalized);
}

function requestHeader(req, name) {
	const headers = req?.headers ?? req?.raw?.headers;
	if (headers === null || typeof headers !== "object") return undefined;
	if (typeof headers.get === "function") {
		const value = headers.get(name);
		return value === null ? undefined : typeof value === "string" ? value : null;
	}
	const value = headers[name.toLowerCase()];
	return value === undefined ? undefined : typeof value === "string" ? value : null;
}

function parseAuthority(authority) {
	if (typeof authority !== "string" || authority === "" || authority.trim() !== authority) return undefined;
	// A Host header is a bare authority. Reject URL/user-info shapes that the
	// WHATWG parser would otherwise quietly reinterpret as a loopback host.
	if (/[\\/@?#]/.test(authority)) return undefined;
	try {
		return new URL(`http://${authority}`);
	} catch {
		return undefined;
	}
}

function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	return isIpv4Loopback(hostname);
}

function requestProtocol(req) {
	const sockets = [req?.socket, req?.raw?.socket, req?.connection, req?.client];
	const encrypted = sockets
		.filter((socket) => socket !== null && typeof socket === "object")
		.map((socket) => socket.encrypted)
		.find((value) => typeof value === "boolean");
	return encrypted === true ? "https:" : "http:";
}

function parseBrowserUrl(value) {
	if (typeof value !== "string" || value === "" || value.trim() !== value) return undefined;
	try {
		const url = new URL(value);
		if (
			(url.protocol !== "http:" && url.protocol !== "https:") ||
			url.username !== "" ||
			url.password !== ""
		) return undefined;
		return url;
	} catch {
		return undefined;
	}
}

function matchesRequestAuthority(url, hostUrl, protocol, fetchSite, allowPortlessSameOrigin) {
	if (url === undefined || url.protocol !== protocol) return false;
	if (url.host === hostUrl.host) return true;
	return allowPortlessSameOrigin && fetchSite === "same-origin" &&
		url.hostname === hostUrl.hostname && url.port === "";
}

/**
 * Accept only a loopback socket addressed through a loopback Host authority.
 * The Host/Origin/Fetch-Metadata fence prevents a DNS-rebinding page from
 * reading local financial routes merely because its socket lands on 127/8.
 */
export function isTrustedHostRequest(req) {
	const addresses = [
		req?.socket?.remoteAddress,
		req?.connection?.remoteAddress,
		req?.client?.remoteAddress,
		req?.raw?.socket?.remoteAddress
	].filter((value) => value !== undefined);
	// Node aliases normally repeat the same socket. If a wrapper exposes
	// conflicting facts, every advertised address must still be loopback.
	if (addresses.length === 0 || !addresses.every(isLoopbackAddress)) return false;

	const host = requestHeader(req, "host");
	const hostUrl = parseAuthority(host);
	if (hostUrl === undefined || !isLoopbackHostname(hostUrl.hostname)) return false;

	const fetchSiteValue = requestHeader(req, "sec-fetch-site");
	if (fetchSiteValue === null) return false;
	const fetchSite = fetchSiteValue?.toLowerCase();
	if (
		fetchSite !== undefined &&
		fetchSite !== "same-origin" &&
		fetchSite !== "same-site" &&
		fetchSite !== "cross-site" &&
		fetchSite !== "none"
	) return false;
	if (fetchSite === "cross-site" || fetchSite === "same-site") return false;

	const origin = requestHeader(req, "origin");
	const referer = requestHeader(req, "referer");
	if (origin === null || referer === null) return false;
	const protocol = requestProtocol(req);
	if (!matchesRequestAuthority(parseBrowserUrl(origin), hostUrl, protocol, fetchSite, true) && origin !== undefined) {
		return false;
	}
	// Referer includes a path, but its origin must still name this page. Keep
	// this exact: the Chrome compatibility exception is specific to Origin.
	if (!matchesRequestAuthority(parseBrowserUrl(referer), hostUrl, protocol, fetchSite, false) && referer !== undefined) {
		return false;
	}
	return true;
}
