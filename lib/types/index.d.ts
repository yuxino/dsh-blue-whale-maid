/**
 * Host half types. The host plugin registers local HTTP routes so the browser
 * pet can show DeepSeek balance / session cost without exposing the API key
 * to browser code:
 *
 *   GET /api/blue-whale-maid/balance       → { ok, balance, todayConsumed }
 *   GET /api/blue-whale-maid/session-cost  → { ok, sessionId, cost, … }
 *
 * The key is resolved per request through the credentials seam and forwarded
 * by the host to the configured DeepSeek-compatible balance endpoint.
 */
export function apply(ctx: import('@deepseek-ai/cordis').Context): void;
export const name: string;
export const inject: string[];
