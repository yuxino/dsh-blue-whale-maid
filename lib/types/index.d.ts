/**
 * Host half types. The host plugin registers local HTTP routes so the browser
 * pet can show DeepSeek balance / session cost without the API key leaving
 * the host:
 *
 *   GET /api/blue-whale-maid/balance       → { ok, balance, todayConsumed }
 *   GET /api/blue-whale-maid/session-cost  → { ok, sessionId, cost, … }
 *
 * The key is resolved per request through the credentials seam (the same
 * `DEEPSEEK_API_KEY` reference the llm-deepseek adapter uses).
 */
export function apply(ctx: import('@deepseek-ai/cordis').Context): void;
export const name: string;
export const inject: string[];
