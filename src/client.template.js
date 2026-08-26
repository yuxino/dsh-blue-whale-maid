/**
 * dsh-blue-whale-maid — browser half (template).
 *
 * `tools/embed.mjs` replaces the `__ATLAS_DATA_URL__` placeholder with the
 * base64 data URL of `assets/spritesheet.webp` and writes `lib/client.js`.
 * Do not edit `lib/client.js` directly.
 *
 * The bundle registers a `shell.overlay` entry (the frame-wide floating
 * layer of the DSH web GUI) and renders 蓝鲸女仆 (Blue Whale Maid) — a
 * draggable, session-aware desktop pet that doubles as a task-completion
 * notifier.
 *
 * Character and animation: a fan-made chibi adaptation for this project.
 * It is not an official DeepSeek character or endorsed brand mascot.
 * Sprite layout: Codex Pet v2 atlas, 8 cols x 11 rows, cell 192x208:
 *   0 idle · 1 running-right · 2 running-left · 3 waving · 4 jumping
 *   5 failed · 6 waiting · 7 running · 8 review · 9-10 look-directions (v2)
 *
 * Notification scheme (root-scope signals only):
 *   - a session stops running     -> neutral 「任务名」这一轮结束了 + jump-to-session button
 *   - one of this run's jobs newly fails -> "failed" animation + problem notice
 *   - session blocked on a user question -> "waiting" + wave + 「任务名」等你确认
 *   - while working -> occasional bubbles naming the running job / task
 *   - switching session          -> greeting wave
 *
 * @module dsh-blue-whale-maid/client
 */
window.__ModuleLoader__.load({
	id: "dsh-blue-whale-maid",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const { createElement: h, useEffect, useRef, useMemo } = React;

		// ---------------------------------------------------------------- css
		const CSS = `
.bwm-root{position:fixed;z-index:1500;width:144px;height:156px;pointer-events:auto;
  user-select:none;-webkit-user-select:none;touch-action:none;cursor:grab;box-sizing:border-box}
.bwm-root.bwm-dragging{cursor:grabbing}
.bwm-root canvas{display:block;width:144px;height:156px;image-rendering:auto}
.bwm-bubble{--bwm-paper:#fffdf8;--bwm-line:#758ba6;--bwm-accent:#315783;
  --bwm-bubble-shift:0px;--bwm-enter-y:7px;
  position:absolute;left:50%;bottom:calc(100% + 24px);
  margin-left:var(--bwm-bubble-shift);
  transform:translateX(-50%) translateY(var(--bwm-enter-y)) scale(.94);
  transform-origin:50% 100%;
  width:max-content;max-width:min(320px,calc(100vw - 24px));min-width:112px;
  box-sizing:border-box;background:var(--bwm-paper);border:2px solid var(--bwm-line);
  border-radius:20px;box-shadow:0 0 0 3px rgba(255,255,255,.88),
    0 5px 0 rgba(62,83,112,.09),0 12px 26px rgba(15,23,42,.16);
  padding:10px 14px;font:13px/1.55 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  color:#26384d;letter-spacing:.01em;white-space:pre-wrap;overflow-wrap:anywhere;
  opacity:0;pointer-events:none;text-align:left;isolation:isolate}
.bwm-bubble.bwm-on{opacity:1;transform:translateX(-50%) translateY(0) scale(1);
  animation:bwm-bubble-pop .28s cubic-bezier(.2,.9,.3,1.28) both}
.bwm-bubble.bwm-on.bwm-action,.bwm-bubble.bwm-on.bwm-hoverable{pointer-events:auto}
.bwm-bubble::after,.bwm-bubble::before{content:"";position:absolute;box-sizing:border-box;
  border:2px solid var(--bwm-line);border-radius:50%;background:var(--bwm-paper);
  box-shadow:0 0 0 2px rgba(255,255,255,.88)}
.bwm-bubble::after{left:clamp(18px,calc(63% - var(--bwm-bubble-shift)),calc(100% - 24px));
  bottom:-15px;width:12px;height:12px}
.bwm-bubble::before{left:clamp(22px,calc(69% - var(--bwm-bubble-shift)),calc(100% - 14px));
  bottom:-25px;width:7px;height:7px}
.bwm-bubble.bwm-below{--bwm-enter-y:-7px;top:calc(100% + 24px);bottom:auto;transform-origin:50% 0}
.bwm-bubble.bwm-below::after{top:-15px;bottom:auto}
.bwm-bubble.bwm-below::before{top:-25px;bottom:auto}
.bwm-bubble.bwm-plain{text-align:center;padding:9px 14px}
.bwm-bubble.bwm-plain>span{display:block;color:#31465e;font-weight:600;letter-spacing:.02em}
.bwm-bubble-title{display:block;font:700 14px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  color:var(--bwm-accent);margin-bottom:2px}
.bwm-bubble-meta{display:block;color:#737d8c;font-size:11px;line-height:1.6}
.bwm-bubble-body{display:block;color:#3e4a58}
.bwm-balance-card{display:flex;flex-direction:column;gap:2px;min-width:150px}
.bwm-balance-label{color:#687485;font-size:11px;line-height:1.4}
.bwm-balance-value{color:#315783;font:700 26px/1.25 -apple-system,"PingFang SC",sans-serif;
  letter-spacing:-.5px;margin:2px 0 4px}
.bwm-balance-divider{height:1px;background:#e2e6eb;margin:4px 0}
.bwm-balance-row{display:flex;justify-content:space-between;gap:16px;
  font-size:12px;line-height:1.7;color:#465362}
.bwm-balance-row-label{color:#737d8c}
.bwm-balance-row-value{font-variant-numeric:tabular-nums;color:#263240}
.bwm-balance-card .bwm-bubble-meta{margin-top:3px}
.bwm-bubble-action{margin-top:8px;display:inline-block;border:1px solid #24486f;border-radius:999px;padding:5px 12px;
  background:var(--bwm-accent);color:#fff;font:700 12px/1.6 inherit;cursor:pointer;
  transition:background .12s,transform .08s}
.bwm-bubble-action:hover{background:#27496f;transform:translateY(-1px)}
.bwm-bubble-action:active{transform:translateY(0)}
.bwm-bubble.bwm-kind-ended{--bwm-line:#8faac4;--bwm-accent:#315783;
  box-shadow:0 0 0 3px rgba(255,255,255,.88),0 5px 0 rgba(49,87,131,.08),0 12px 26px rgba(30,64,100,.15)}
.bwm-bubble.bwm-kind-ended .bwm-bubble-action{background:#315783;border-color:#24486f}
.bwm-bubble.bwm-kind-failed{--bwm-line:#d36a6f;--bwm-accent:#b91c1c;
  box-shadow:0 0 0 3px rgba(255,255,255,.88),0 5px 0 rgba(153,27,27,.07),0 12px 26px rgba(153,27,27,.14)}
.bwm-bubble.bwm-kind-failed .bwm-bubble-action{background:#b7353b;border-color:#94272c}
.bwm-bubble.bwm-kind-wait{--bwm-line:#d7a653;--bwm-accent:#a65a0a;
  box-shadow:0 0 0 3px rgba(255,255,255,.88),0 5px 0 rgba(146,89,10,.07),0 12px 26px rgba(146,89,10,.13)}
.bwm-bubble.bwm-kind-wait .bwm-bubble-action{background:#b87919;border-color:#936014}
.bwm-bubble.bwm-kind-balance{--bwm-line:#8faac4;--bwm-accent:#315783;
  box-shadow:0 0 0 3px rgba(255,255,255,.88),0 5px 0 rgba(49,87,131,.08),0 12px 26px rgba(30,64,100,.15)}
.bwm-balance-btn{position:absolute;right:2px;bottom:3px;height:22px;border:1px solid #24486f;
  border-radius:999px;background:#315783;color:#fff;padding:0 8px;
  font:700 11px/20px -apple-system,"PingFang SC",sans-serif;text-align:center;cursor:pointer;
  box-shadow:0 2px 6px rgba(15,23,42,.2);
  opacity:.76;transition:opacity .15s,transform .08s,background .12s;z-index:1501;
  white-space:nowrap;letter-spacing:-.2px}
.bwm-root:hover .bwm-balance-btn{opacity:1}
.bwm-balance-btn:hover{opacity:1;background:#27496f;transform:translateY(-1px)}
.bwm-balance-btn:active{transform:translateY(0)}
.bwm-balance-btn.bwm-loading{animation:bwm-blink 1s steps(2) infinite}
@keyframes bwm-blink{50%{opacity:.35}}
@keyframes bwm-bubble-pop{
  0%{opacity:0;transform:translateX(-50%) translateY(var(--bwm-enter-y)) scale(.94)}
  72%{opacity:1;transform:translateX(-50%) translateY(-1px) scale(1.018)}
  100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}
}
@media (prefers-reduced-motion: reduce){
  .bwm-bubble.bwm-on{animation:none;transform:translateX(-50%) translateY(0) scale(1)}
  .bwm-balance-btn.bwm-loading{animation:none}
}
`;
		const CSS_TAG_ID = "dsh-blue-whale-maid/styles";
		if (typeof document !== "undefined") {
			let tag = document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_TAG_ID)}]`);
			if (tag === null) {
				tag = document.createElement("style");
				tag.dataset.plugin = "dsh-blue-whale-maid";
				tag.dataset.pluginCss = CSS_TAG_ID;
				document.head.appendChild(tag);
			}
			// Reuse the tag across HMR, but always refresh its contents.
			tag.textContent = CSS;
		}

		// ------------------------------------------------------------- atlas
		// Replaced by tools/embed.mjs with "data:image/webp;base64,…".
		const ATLAS_DATA_URL = "__ATLAS_DATA_URL__";

		const CELL_W = 192;
		const CELL_H = 208;
		const ATLAS_COLS = 8;
		// On-screen size (CSS px): 75% of the sprite cell — desktop-pet scale.
		const PET_W = 144;
		const PET_H = 156;

		// Codex Pet v2 standard row layout (see codexpet.xyz spec).
		const STATES = {
			idle: { row: 0, frames: 6, fps: 5 },
			runRight: { row: 1, frames: 8, fps: 9 },
			runLeft: { row: 2, frames: 8, fps: 9 },
			wave: { row: 3, frames: 4, fps: 5, once: true },
			jump: { row: 4, frames: 5, fps: 6, once: true },
			fail: { row: 5, frames: 8, fps: 6, once: true },
			wait: { row: 6, frames: 6, fps: 4 },
			run: { row: 7, frames: 6, fps: 8 },
			review: { row: 8, frames: 6, fps: 4 },
			lookA: { row: 9, frames: 8, fps: 3, once: true },
			lookB: { row: 10, frames: 8, fps: 3, once: true }
		};

		const truncate = (s, n) => (s && s.length > n ? `${s.slice(0, n)}…` : s);

		const LINES = {
			idle: [
				"我在这里。",
				"暂时没有新任务。",
				"需要时点一下我。",
				"先休息一会儿。",
				"我会留意新任务。",
				"现在很安静。"
			],
			wave: [
				"在呢。",
				"听见啦。",
				"需要我做什么？",
				"好，我在。",
				"你好呀。"
			],
			jump: [
				"好耶！",
				"跳一下。",
				"收到啦。",
				"今天也辛苦了。"
			],
			workStart: (t) => `开始处理「${t}」。`,
			pending: [
				(t) => `「${t}」正在等你确认。`,
				(t) => `「${t}」需要你的回复。`,
				(t) => `请确认「${t}」。`
			],
			busy: [
				"正在处理。",
				"任务还在进行中。",
				"我在继续处理。",
				"正在检查结果。"
			],
			workTitle: (t) => `正在处理「${t}」。`,
			switch: [
				"已切换到新会话。",
				"我跟过来啦。",
				"现在查看这个会话。",
				"好，在这里继续。"
			],
			pickup: ["好，放在这里。", "位置记住了。", "我就待在这里。"],
			ended: ["结果已经出来了。", "可以验收了。", "去看看结果吧。"],
			failed: ["任务出错了。", "这里遇到了问题。", "任务没有完成。", "这次需要重试。"],
			offline: ["暂时连不上。", "连接中断了。", "还没有收到响应。", "请稍后再试。"],
			intro: ["你好，我是小鲸。", "有新动静，我会告诉你。"]
		};
		const pickBags = new WeakMap();
		const pick = (list) => {
			let state = pickBags.get(list);
			if (!state) {
				state = { bag: [], lastIndex: null };
				pickBags.set(list, state);
			}
			if (state.bag.length === 0) {
				const bag = list.map((_, index) => index);
				for (let i = bag.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[bag[i], bag[j]] = [bag[j], bag[i]];
				}
				// pop() chooses the next line. Avoid repeating the previous cycle's
				// last line at the refill boundary when another choice exists.
				if (bag.length > 1 && bag[bag.length - 1] === state.lastIndex) {
					[bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
				}
				state.bag = bag;
			}
			const index = state.bag.pop();
			state.lastIndex = index;
			return list[index];
		};
		const GO_LOOK_LABEL = "去看看 →";

		const STORE_KEY_POS = "dsh-blue-whale-maid:pos";
		const STORE_KEY_INTRODUCED = "dsh-blue-whale-maid:introduced:v2";
		// Long-running nudge: warn when a session has been running this long.
		const LONG_RUN_MS = 5 * 60 * 1000;
		const NUDGE_INTERVAL_MS = 3 * 60 * 1000;

		// Format a duration as "3 分 42 秒" / "1 小时 5 分" / "45 秒".
		const fmtDur = (ms) => {
			const s = Math.round(ms / 1000);
			if (s < 60) return `${s} 秒`;
			const m = Math.floor(s / 60);
			const sec = s % 60;
			if (m < 60) return sec > 0 ? `${m} 分 ${sec} 秒` : `${m} 分`;
			const h = Math.floor(m / 60);
			const min = m % 60;
			return min > 0 ? `${h} 小时 ${min} 分` : `${h} 小时`;
		};

		// ---- DeepSeek account info (the credential is never sent to the browser)
		const BALANCE_ROUTE = "/api/blue-whale-maid/balance";
		const SESSION_COST_ROUTE = "/api/blue-whale-maid/session-cost";

		const fmtMoney = (value, currency) => {
			const symbol = currency === "USD" ? "$" : "¥";
			if (typeof value !== "number" || !Number.isFinite(value)) return `${symbol}?`;
			return `${symbol}${value.toFixed(2)}`;
		};
		const fmtCost = (value, currency = "CNY") => {
			if (typeof value !== "number" || !Number.isFinite(value)) return null;
			const symbol = currency === "USD" ? "$" : "¥";
			if (value >= 1) return `${symbol}${value.toFixed(2)}`;
			if (value >= 0.01) return `${symbol}${value.toFixed(4)}`;
			return `${symbol}${value.toFixed(6)}`;
		};
		/** Balance bubble content from the host route payload. */
		function balanceText(payload, todayConsumed) {
			const infos = payload && Array.isArray(payload.balance_infos) ? payload.balance_infos : [];
			const info = infos[0];
			if (!info) return { balance: { label: "余额不可用", value: "—" }, rows: [] };
			const currency = info.currency ?? "CNY";
			const total = Number(info.total_balance);
			const lowLine = currency === "USD" ? 1 : 5;
			const balanceLabel = !Number.isFinite(total)
				? "余额不可用"
				: total <= 0
					? "余额不足"
					: total < lowLine
						? "余额较低"
						: "账户余额";
			const rows = [];
			if (info.topped_up_balance !== void 0) rows.push({ label: "充值", value: fmtMoney(Number(info.topped_up_balance), currency) });
			if (info.granted_balance !== void 0) rows.push({ label: "赠金", value: fmtMoney(Number(info.granted_balance), currency) });
			if (typeof todayConsumed === "number" && Number.isFinite(todayConsumed)) {
				rows.push({ label: "今日约消费", value: `≈${fmtMoney(todayConsumed, currency)}` });
			}
			return {
				balance: { label: balanceLabel, value: fmtMoney(total, currency) },
				rows
			};
		}

		/**
		 * A human-meaningful session title, or null. `displayTitle` falls back
		 * to the cwd basename and then the session id — those are machine
		 * labels, not things to read out loud. Only a human-meaningful title
		 * (one that differs from the cwd basename and isn't an id) qualifies.
		 */
		function goodTitle(row) {
			const t = row && typeof row.rawTitle === "string" ? row.rawTitle : void 0;
			if (t === void 0 || t.trim().length < 2) return null;
			if (/^session-|^sess-|^[0-9a-f]{8,}$/i.test(t)) return null;
			const base = row && typeof row.cwd === "string" ? row.cwd.split(/[\\/]/).pop() : "";
			if (base !== "" && t === base) return null;
			return t.trim();
		}

		// Pixel heart (6x7) drawn with fillRect.
		const HEART = [
			".XX.XX.",
			"XXXXXXX",
			"XXXXXXX",
			".XXXXX.",
			"..XXX..",
			"...X..."
		];
		const HEART_COLORS = ["#fb7185", "#f472b6", "#f87171"];

		const rand = (min, max) => min + Math.random() * (max - min);
		const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

		/**
		 * Self-contained animation/behavior engine. Vanilla JS + rAF; the
		 * React wrapper only owns mounting and the session signal.
		 *
		 * The pet never moves on its own (no wandering): all animation is
		 * in place. Movement happens only while the user drags her.
		 *
		 * `getSignal()` returns { rows, current } where rows are session
		 * summaries { id, title, running, completed, pending, jobs }.
		 * `show(text, ms, opts)` shows a bubble; `opts` = { action?: { label,
		 * fn }, kind?: 'ended'|'failed'|'wait'|'balance', onHoverChange?: fn }.
		 */
		function createPetEngine({ root, canvas, getSignal, show, openSession }) {
			const atlas = new Image();
			atlas.src = ATLAS_DATA_URL;
			const ctx = canvas.getContext("2d");

			const reducedMotion =
				typeof matchMedia !== "undefined" &&
				matchMedia("(prefers-reduced-motion: reduce)").matches;

			let state = "idle";
			let frame = 0;
			let frameElapsed = 0;
			let resumeState = "idle"; // state to return to after a one-shot gesture
			let transientUntil = 0; // revert time for non-once transient states (run-in-place, review)
			let dragging = false;
			let dragStart = null;
			let lastClickAt = null;
			let nextActionAt = performance.now() + rand(3000, 7000);
			let nextHeartAt = 0;
			let nextLineAt = performance.now() + rand(30000, 60000);
			let nextWaveAt = 0;
			let lastCurrent = null;
			let lastTime = performance.now();
			let raf = 0;
			let disposed = false;
			const hearts = [];
			// per-session running tracking, including the job state observed when
			// each run began. Job snapshots are tracked independently so a quiet
			// background failure cannot disappear while its owner Session is idle.
			const prevRun = new Map();
			const observedJobs = new Map();
			const MAX_TRACKED_JOB_IDS = 512;
			// completion notifications waiting to be shown
			const notifyQueue = [];
			let notifyShowingUntil = 0;
			let notifyHoverStartedAt = null;
			// nap (all-idle) state: true while every session is quiet
			let napping = false;
			let wasNapping = false;
			let napUntil = 0;
			let nextNapAt = performance.now() + rand(24000, 42000);
			let nextNapZAt = 0;
			const napZ = []; // floating "z" particles { x, y, vy, life, ttl, size }

			const stateDef = () => STATES[state] ?? STATES.idle;

			function clampPos(x, y) {
				const vw = document.documentElement.clientWidth;
				const vh = document.documentElement.clientHeight;
				return {
					x: clamp(x, -100, vw - PET_W * 0.375),
					y: clamp(y, 0, vh - PET_H)
				};
			}

			function applyPos(x, y) {
				root.style.left = `${Math.round(x)}px`;
				root.style.top = `${Math.round(y)}px`;
			}

			function persistPos() {
				try {
					localStorage.setItem(
						STORE_KEY_POS,
						JSON.stringify({ x: parseFloat(root.style.left), y: parseFloat(root.style.top) })
					);
				} catch { /* storage unavailable — position just won't persist */ }
			}

			function fitPosToViewport() {
				if (disposed || dragging) return;
				const x = parseFloat(root.style.left);
				const y = parseFloat(root.style.top);
				if (!Number.isFinite(x) || !Number.isFinite(y)) return;
				const vw = document.documentElement.clientWidth;
				const vh = document.documentElement.clientHeight;
				applyPos(
					clamp(x, 0, Math.max(0, vw - PET_W)),
					clamp(y, 0, Math.max(0, vh - PET_H))
				);
				persistPos();
			}

			function setState(next) {
				if (reducedMotion) {
					state = "idle";
					frame = 0;
					frameElapsed = 0;
					return;
				}
				state = next;
				frame = 0;
				frameElapsed = 0;
			}

			function gesture(name, nextState) {
				if (reducedMotion || dragging) return;
				// Never resume another one-shot animation. If a second gesture
				// interrupts the first, retain its underlying steady state instead.
				// Review and idle loiter animations are transient, so resuming them
				// after their deadline was cleared would leave the pet stuck forever.
				const steadyState = state === "review"
					? "run"
					: state === "runRight" || state === "runLeft"
						? "idle"
						: state;
				resumeState = nextState ?? (STATES[state]?.once === true ? resumeState : steadyState);
				transientUntil = 0;
				setState(name);
			}

			function emitHearts(n) {
				if (reducedMotion) return;
				for (let i = 0; i < n; i++) {
					hearts.push({
						x: 96 + rand(-14, 14),
						y: 34 + rand(-8, 4),
						vy: rand(14, 26),
						life: 0,
						ttl: rand(1000, 1500),
						color: HEART_COLORS[(Math.random() * HEART_COLORS.length) | 0]
					});
				}
			}

			function onGestureEnd() {
				if (state === "wave") emitHearts(4);
				setState(resumeState);
				resumeState = "idle";
			}

			// Jobs normally have stable ids. For older/partial session snapshots
			// that omit them, only a rise in the anonymous failed-job count is
			// treated as a new failure; an old anonymous failure alone is harmless.
			function snapshotJobs(jobs) {
				const failedIds = [];
				let anonymousFailed = 0;
				for (const job of Array.isArray(jobs) ? jobs : []) {
					if (!job || typeof job !== "object") continue;
					let key = null;
					for (const field of ["id", "jobId"]) {
						const value = job[field];
						if ((typeof value === "string" && value.trim() !== "") || typeof value === "number") {
							key = `${field}:${String(value)}`;
							break;
						}
					}
					if (job.status !== "failed") continue;
					if (key !== null) failedIds.push(key);
					else anonymousFailed += 1;
				}
				return { failedIds, anonymousFailed };
			}

			function startRun(now, sawNewFailure = false) {
				return {
					running: true,
					since: now,
					sawNewFailure
				};
			}

			function observeJobFailures(sessionId, jobs) {
				const current = snapshotJobs(jobs);
				let history = observedJobs.get(sessionId);
				if (history === undefined) {
					const initialFailedIds = new Set(current.failedIds);
					const failedIds = new Set([...initialFailedIds].slice(0, MAX_TRACKED_JOB_IDS));
					history = {
						failedIds,
						stableFailureOverflow: initialFailedIds.size > failedIds.size,
						anonymousFailedHighWater: current.anonymousFailed
					};
					observedJobs.set(sessionId, history);
					return false;
				}
				let sawNewFailure = false;
				for (const id of current.failedIds) {
					if (history.failedIds.has(id)) continue;
					if (history.failedIds.size < MAX_TRACKED_JOB_IDS) {
						history.failedIds.add(id);
						sawNewFailure = true;
					} else if (!history.stableFailureOverflow) {
						// At the hard bound, report the first overflow once and then fail
						// quiet. Rotating ids out would make a still-visible failure repeat
						// on every React/rAF observation.
						history.stableFailureOverflow = true;
						sawNewFailure = true;
					}
				}
				// Retain every remembered failed id even while absent: reconnect
				// baselines must not make an old terminal job look newly failed.
				// Without an id there is no sound way to distinguish a reappearing old
				// row from a new one, so a monotonic high-water also chooses no duplicate.
				if (current.anonymousFailed > history.anonymousFailedHighWater) sawNewFailure = true;
				history.anonymousFailedHighWater = Math.max(
					history.anonymousFailedHighWater,
					current.anonymousFailed
				);
				return sawNewFailure;
			}

			// ------------------------------------------- notifications
			function pushNotify(kind, sessionId, title, durationMs) {
				if (notifyQueue.length >= 5) {
					// A failure should not disappear just because several neutral end notices
					// arrived first. Replace the newest queued end, while preserving
					// FIFO order for every item that remains.
					if (kind !== "failed") return;
					let replaceAt = -1;
					for (let i = notifyQueue.length - 1; i >= 0; i--) {
						if (notifyQueue[i].kind === "ended") {
							replaceAt = i;
							break;
						}
					}
					if (replaceAt === -1) return;
					notifyQueue.splice(replaceAt, 1);
				}
				notifyQueue.push({ kind, sessionId, title, durationMs });
			}

			function clearNotifyOwnership() {
				notifyShowingUntil = 0;
				notifyHoverStartedAt = null;
			}

			function setNotifyHovered(hovered) {
				const now = performance.now();
				if (hovered) {
					if (notifyShowingUntil !== 0 && notifyHoverStartedAt === null) notifyHoverStartedAt = now;
				} else if (notifyHoverStartedAt !== null) {
					if (notifyShowingUntil !== 0) {
						notifyShowingUntil += Math.max(0, now - notifyHoverStartedAt);
					}
					notifyHoverStartedAt = null;
				}
			}

			function isNotifyActive(now = performance.now()) {
				return notifyShowingUntil !== 0 && (notifyHoverStartedAt !== null || now < notifyShowingUntil);
			}

			/** Show the next queued completion notification, if any. */
			function pumpNotify(now) {
				// A notice that arrives between pointerdown and pointerup must wait;
				// otherwise pointerup can immediately replace the notice with a click
				// or pickup line.
				if (dragging) return false;
				if (isNotifyActive(now)) return false;
				clearNotifyOwnership();
				if (notifyQueue.length === 0) return false;
				const item = notifyQueue.shift();
				notifyShowingUntil = now + (item.kind === "failed" ? 9000 : 12000);
				// A fresh callback identity lets the bubble controller hand hover
				// ownership cleanly from one FIFO item to the next.
				const onHoverChange = (hovered) => setNotifyHovered(hovered);
				const isCurrent = getSignal().current === item.sessionId;
				const action = !isCurrent && openSession
					? {
						label: GO_LOOK_LABEL,
						fn: () => {
							clearNotifyOwnership();
							openSession(item.sessionId);
						}
					}
					: undefined;
				const dur = typeof item.durationMs === "number" ? fmtDur(item.durationMs) : "";
				const named = item.title !== null && item.title !== undefined ? `「${truncate(item.title, 20)}」` : "";
				if (item.kind === "failed") {
					gesture("fail", "idle");
					show(
						{
							title: named ? `${named}遇到问题。` : "有个任务遇到问题。",
							meta: dur ? `运行 ${dur}` : undefined,
							body: pick(LINES.failed)
						},
						9000,
						{ action, kind: "failed", onHoverChange }
					);
				} else {
					gesture("wave", "idle");
					emitHearts(3);
					let body = pick(LINES.ended);
					const queuedEnded = notifyQueue.filter((entry) => entry.kind === "ended").length;
					const queuedFailed = notifyQueue.filter((entry) => entry.kind === "failed").length;
					if (queuedEnded > 0) body += `\n还有 ${queuedEnded} 个任务也结束了`;
					if (queuedFailed > 0) body += `\n另有 ${queuedFailed} 个任务出了问题`;
					show(
						{
							title: named ? `${named}这一轮结束了。` : "有个任务已停止。",
							meta: dur ? `耗时 ${dur}` : undefined,
							body
						},
						12000,
						{ action, kind: "ended", onHoverChange }
					);
				}
				return true;
			}

			function observeSessionTransitions(sig, now, allowStartBubble) {
				const rows = sig && Array.isArray(sig.rows) ? sig.rows : [];
				const runningIds = new Set();
				const rowsById = new Map();
				for (const r of rows) {
					if (!r || !r.id) continue;
					rowsById.set(r.id, r);
					if (r.running) runningIds.add(r.id);
					const sawJobFailure = observeJobFailures(r.id, r.jobs);
					const prev = prevRun.get(r.id);
					if (r.running && (!prev || !prev.running)) {
						prevRun.set(r.id, startRun(now, sawJobFailure));
						if (
							allowStartBubble &&
							r.id === sig.current &&
							!r.blank &&
							notifyQueue.length === 0 &&
							!isNotifyActive(now)
						) {
							const gt = goodTitle(r);
							const target = gt !== null ? truncate(gt, 18) : null;
							const line = target !== null ? LINES.workStart(target) : "开始处理。";
							show(line, 3200);
							nextLineAt = now + rand(30000, 50000);
						}
					} else if (r.running && prev && prev.running) {
						if (sawJobFailure) prev.sawNewFailure = true;
					} else if (!r.running && prev && prev.running) {
						const duration = now - (prev.since ?? now);
						if (sawJobFailure) prev.sawNewFailure = true;
						prevRun.set(r.id, { running: false, since: 0 });
						if (!r.blank && (prev.sawNewFailure || duration > 3000)) {
							// SessionListState exposes activity, not a durable turn outcome.
							// Without an observed failed job, report a neutral end instead of
							// claiming that the main model turn succeeded.
							pushNotify(prev.sawNewFailure ? "failed" : "ended", r.id, goodTitle(r), duration);
						}
					} else if (!r.running && sawJobFailure && !r.blank) {
						// Jobs can finish through the quiet delivery lane while the owner
						// Session remains idle. This notice has no trustworthy run duration.
						pushNotify("failed", r.id, goodTitle(r));
					}
				}
				for (const id of prevRun.keys()) {
					if (!rowsById.has(id)) prevRun.delete(id);
				}
				for (const id of observedJobs.keys()) {
					if (!rowsById.has(id)) observedJobs.delete(id);
				}
				return { rows, runningIds, rowsById };
			}

			function update(dt) {
				const now = performance.now();
				const sig = getSignal(); // { rows, current }

				// Observe transitions outside rAF too (see observeSignal below), so a
				// background tab cannot swallow an entire start -> finish cycle.
				const { rows, runningIds, rowsById } = observeSessionTransitions(sig, now, true);

				// ---- long-running nudge: a session running a long time gets a
				// gentle "still going?" bubble (never asserts it is stuck).
				if (!dragging && notifyQueue.length === 0 && !isNotifyActive(now)) {
					for (const [id, prev] of prevRun) {
						if (!prev.running) continue;
						const elapsed = now - (prev.since ?? now);
						if (elapsed > LONG_RUN_MS && now - (prev.lastNudgeAt ?? 0) > NUDGE_INTERVAL_MS) {
							prev.lastNudgeAt = now;
							const row = rowsById.get(id);
							const gt = row ? goodTitle(row) : null;
							const t = gt !== null ? `「${truncate(gt, 18)}」` : "有个任务";
							show(`${t}已运行 ${fmtDur(elapsed)}，仍在进行中。`, 5000);
							break;
						}
					}
				}

				// ---- pump queued notifications first (they own the bubble)
				if (notifyQueue.length > 0 || isNotifyActive(now)) {
					pumpNotify(now);
				}
				const notifyActive = isNotifyActive(now);

				// session switch → greeting wave
				if (lastCurrent !== null && sig.current !== lastCurrent && !dragging && !notifyActive) {
					gesture("wave");
					show(pick(LINES.switch), 2800);
				}
				lastCurrent = sig.current;

				// transient (run-in-place / review) expiry
				if (transientUntil !== 0 && now >= transientUntil && !dragging) {
					transientUntil = 0;
					setState("idle");
				}

				// ---- the current session's state drives the animation
				const currentRow = sig.current !== undefined ? rowsById.get(sig.current) : undefined;
				const anyRunning = runningIds.size > 0;
				const anyPending = rows.some((r) => r && !!r.pendingInteraction);
				const pendingRow = rows.find((r) => r && !!r.pendingInteraction);
				if (anyRunning || anyPending) {
					if (napping) {
						napping = false;
						napZ.length = 0;
					}
					nextNapAt = now + rand(24000, 42000);
				}
				// Read this after notification/session-switch gestures so a gesture
				// created in this frame cannot be overwritten by the base state.
				const once = STATES[state]?.once === true;

				if (notifyActive || once) {
					// Notifications and one-shot gestures own this frame. The latter
					// also covers async balance success/failure gestures.
				} else if (anyPending) {
					// a session is blocked on a user question → waiting
					if (!dragging && !once && state !== "wait") setState("wait");
					if (now >= nextHeartAt) {
						nextHeartAt = now + rand(2600, 4200);
						emitHearts(1);
					}
					if (now >= nextWaveAt) {
						nextWaveAt = now + rand(6000, 10000);
						if (Math.random() < 0.35) gesture("wave");
					}
					if (now >= nextLineAt) {
						nextLineAt = now + rand(20000, 32000);
						const gt = pendingRow ? goodTitle(pendingRow) : null;
						const action = pendingRow && pendingRow.id !== sig.current && openSession
							? { label: GO_LOOK_LABEL, fn: () => openSession(pendingRow.id) }
							: undefined;
						if (gt !== null) show({ title: pick(LINES.pending)(truncate(gt, 18)) }, 6000, { action, kind: "wait" });
						else show({ title: "有个任务正在等你确认。" }, 6000, { action, kind: "wait" });
					}
				} else if (anyRunning) {
					// the agent is working → codex-style running + occasional review
					if (!dragging && !once && state !== "run" && state !== "review") setState("run");
					if (!dragging && !once && state === "run" && Math.random() < dt * 0.00005) {
						setState("review");
						transientUntil = now + rand(2500, 4000);
					}
					if (now >= nextHeartAt) {
						nextHeartAt = now + rand(2200, 3800);
						emitHearts(1);
					}
					// periodic "what I'm doing" bubble for the current session —
					// say it like a colleague, never echo raw commands
					if (now >= nextLineAt && notifyQueue.length === 0) {
						nextLineAt = now + rand(40000, 70000);
						const gt = goodTitle(currentRow);
						if (gt !== null) show(LINES.workTitle(truncate(gt, 18)), 3600);
						else show(pick(LINES.busy), 3200);
					}
				} else {
					// A finished task must release its base work/wait animation. Review
					// also belongs to work, so cancel its pending transient expiry.
					if (!dragging && !once && (state === "run" || state === "wait" || state === "review")) {
						transientUntil = 0;
						setState("idle");
					}
					// All quiet: loiter first, then nap for a bounded stretch.
					if (!napping && !dragging && !once && state === "idle" && now >= nextNapAt) {
						napping = true;
						napUntil = now + rand(7000, 12000);
						nextNapZAt = now + rand(1200, 2600);
					}
					if (napping && now >= napUntil && state === "idle") {
						napping = false;
						nextNapAt = now + rand(24000, 42000);
						nextActionAt = now + rand(3000, 8000);
					}
					if (!reducedMotion && napping && now >= nextNapZAt) {
						nextNapZAt = now + rand(2200, 4200);
						napZ.push({
							x: 104 + rand(-8, 10),
							y: 44 + rand(-6, 4),
							vy: rand(10, 18),
							life: 0,
							ttl: rand(1600, 2400),
							size: rand(7, 11)
						});
						if (napZ.length > 6) napZ.shift();
					}
					if (!napping && !dragging && !once && state === "idle" && now >= nextLineAt) {
						nextLineAt = now + rand(50000, 90000);
						show(pick(LINES.idle), 3200);
					}
					// idle loiter: look around or run in place — never wander
					if (!napping && !dragging && !once && transientUntil === 0 && state === "idle" && now >= nextActionAt) {
						nextActionAt = now + rand(8000, 20000);
						const roll = Math.random();
						if (roll < 0.3) gesture(roll < 0.15 ? "lookA" : "lookB");
						else if (roll < 0.65) {
							setState(Math.random() < 0.5 ? "runRight" : "runLeft");
							transientUntil = now + rand(2500, 4500);
						}
					}
				}

				// animation clock
				const def = stateDef();
				if (!reducedMotion) {
					frameElapsed += dt;
					const frameDur = 1000 / def.fps;
					if (frameElapsed >= frameDur) {
						frameElapsed -= frameDur;
						frame = (frame + 1) % def.frames;
						if (frame === 0 && def.once) onGestureEnd();
					}
				}

				// hearts physics
				for (let i = hearts.length - 1; i >= 0; i--) {
					const hh = hearts[i];
					hh.life += dt;
					hh.y -= (hh.vy * dt) / 1000;
					if (hh.life >= hh.ttl) hearts.splice(i, 1);
				}
				// nap "z" particles physics
				for (let i = napZ.length - 1; i >= 0; i--) {
					const z = napZ[i];
					z.life += dt;
					z.y -= (z.vy * dt) / 1000;
					if (z.life >= z.ttl) napZ.splice(i, 1);
				}
			}

			function draw() {
				const dpr = window.devicePixelRatio || 1;
				if (canvas.width !== CELL_W * dpr) canvas.width = CELL_W * dpr;
				if (canvas.height !== CELL_H * dpr) canvas.height = CELL_H * dpr;
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
				ctx.clearRect(0, 0, CELL_W, CELL_H);
				if (atlas.complete && atlas.naturalWidth > 0) {
					const def = stateDef();
					ctx.drawImage(
						atlas,
						frame * CELL_W,
						def.row * CELL_H,
						CELL_W,
						CELL_H,
						0,
						0,
						CELL_W,
						CELL_H
					);
				}
				for (const hh of hearts) {
					const alpha = 1 - hh.life / hh.ttl;
					ctx.globalAlpha = alpha;
					ctx.fillStyle = hh.color;
					for (let ry = 0; ry < HEART.length; ry++) {
						for (let rx = 0; rx < HEART[ry].length; rx++) {
							if (HEART[ry][rx] !== "X") continue;
							ctx.fillRect(hh.x + rx * 3, hh.y + ry * 3, 3, 3);
						}
					}
					ctx.globalAlpha = 1;
				}
				// nap "z" particles (only while napping)
				if (napping) {
					for (const z of napZ) {
						const alpha = 1 - z.life / z.ttl;
						ctx.globalAlpha = alpha * 0.85;
						ctx.fillStyle = "#64748b";
						ctx.font = `bold ${z.size}px -apple-system, "PingFang SC", sans-serif`;
						ctx.fillText("z", z.x, z.y);
					}
					ctx.globalAlpha = 1;
				}
			}

			function loop(now) {
				if (disposed) return;
				const dt = Math.min(64, now - lastTime);
				lastTime = now;
				update(dt);
				draw();
				raf = requestAnimationFrame(loop);
			}

			// ----------------------------------------------------- pointer
			/**
			 * Query DeepSeek balance + today's consumption (host route), plus
			 * the current session's cost, and show the result in the bubble.
			 * The credential is never sent to browser code. The host route forwards
			 * it only to the configured DeepSeek-compatible balance endpoint.
			 * Also updates the corner balance badge and schedules auto-refresh.
			 */
			const BADGE_REFRESH_MS = 5 * 60 * 1000;
			let badgeTimer = 0;
			let accountQuerySeq = 0;
			let manualAccountQuerySeq = 0;
			function badgeEl() {
				return root.querySelector(".bwm-balance-btn");
			}
			function setBadge(text, loading) {
				const el = badgeEl();
				if (!el) return;
				el.textContent = text;
				el.classList.toggle("bwm-loading", !!loading);
			}
			function scheduleBadgeRefresh(requestSeq) {
				if (disposed || requestSeq !== accountQuerySeq) return;
				clearTimeout(badgeTimer);
				badgeTimer = setTimeout(() => {
					if (!disposed && !document.hidden) queryAccount(true);
				}, BADGE_REFRESH_MS);
			}
			async function queryAccount(silent) {
				if (disposed) return;
				silent = silent === true;
				// Completion/failure notices own the bubble. A background refresh must
				// also never supersede a manual balance request already in progress.
				if (!silent && (notifyQueue.length > 0 || isNotifyActive())) return;
				if (silent && manualAccountQuerySeq !== 0) return;
				const requestSeq = ++accountQuerySeq;
				if (!silent) manualAccountQuerySeq = requestSeq;
				try {
					if (!silent) show("正在查询余额。", 0);
					setBadge("…", true);
					clearTimeout(badgeTimer);
					let balance = null;
					let todayConsumed = null;
					let accountCurrency = "CNY";
					try {
						const res = await fetch(BALANCE_ROUTE, { cache: "no-store", signal: AbortSignal.timeout(15000) });
						const body = await res.json().catch(() => null);
						if (disposed || requestSeq !== accountQuerySeq) return;
						if (!res.ok || !body || body.ok !== true) {
							const msg = body && typeof body.message === "string" ? body.message : `查询失败（${res.status}）`;
							if (!silent && !dragging && notifyQueue.length === 0 && !isNotifyActive()) {
								gesture("fail");
								show({ title: "余额查询失败。", body: msg }, 5000, { kind: "failed" });
							} else if (!silent && dragging) {
								show.hide?.();
							}
							setBadge("?", false);
							scheduleBadgeRefresh(requestSeq);
							return;
						}
						balance = body.balance ?? null;
						todayConsumed = typeof body.todayConsumed === "number" ? body.todayConsumed : null;
						// show the total on the corner badge
						const infos = balance && Array.isArray(balance.balance_infos) ? balance.balance_infos : [];
						const info = infos[0];
						if (info) {
							accountCurrency = info.currency ?? "CNY";
							setBadge(fmtMoney(Number(info.total_balance), accountCurrency), false);
						} else setBadge("?", false);
					} catch {
						if (disposed || requestSeq !== accountQuerySeq) return;
						if (!silent && !dragging && notifyQueue.length === 0 && !isNotifyActive()) {
							gesture("fail");
							show(pick(LINES.offline), 4500, { kind: "failed" });
						} else if (!silent && dragging) {
							show.hide?.();
						}
						setBadge("?", false);
						scheduleBadgeRefresh(requestSeq);
						return;
					}
					// silent refresh = badge only, no bubble, reschedule quietly
					if (silent) {
						scheduleBadgeRefresh(requestSeq);
						return;
					}
					// current session cost (best-effort; may be null)
					let sessionCost = null;
					let sessionUnpricedCalls = 0;
					const currentId = getSignal().current;
					if (currentId !== undefined) {
						try {
							const res = await fetch(`${SESSION_COST_ROUTE}?sessionId=${encodeURIComponent(currentId)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
							const body = await res.json().catch(() => null);
							if (disposed || requestSeq !== accountQuerySeq) return;
							if (res.ok && body && body.ok === true) {
								sessionUnpricedCalls = Number.isSafeInteger(body.unpricedCalls) && body.unpricedCalls > 0
									? body.unpricedCalls
									: 0;
								const amount = accountCurrency === "USD" ? body.costUsd : body.cost;
								if (typeof amount === "number" && Number.isFinite(amount)) sessionCost = amount;
							}
						} catch { /* session cost is optional */ }
					}
					if (disposed || requestSeq !== accountQuerySeq) return;
					// The selected session may have changed while the optional cost call
					// was in flight; never label an old session's cost as the new one's.
					if (getSignal().current !== currentId) {
						sessionCost = null;
						sessionUnpricedCalls = 0;
					}
					// A notice (or an in-progress drag) that appeared during the request
					// takes precedence. The corner badge is already up to date.
					if (dragging) {
						show.hide?.();
						scheduleBadgeRefresh(requestSeq);
						return;
					}
					if (notifyQueue.length > 0 || isNotifyActive()) {
						scheduleBadgeRefresh(requestSeq);
						return;
					}
					gesture("jump");
					emitHearts(6);
					const content = balanceText(balance, todayConsumed);
					const cost = fmtCost(sessionCost, accountCurrency);
					const costMeta = cost !== null
						? `本会话已用 ${cost}${sessionUnpricedCalls > 0 ? " · 另有未定价调用" : ""}`
						: sessionUnpricedCalls > 0
							? "本会话含未定价模型，暂不估算"
							: undefined;
					show(
						{
							balance: content.balance,
							rows: content.rows,
							meta: costMeta
						},
						10000,
						{ action: { label: "刷新", fn: () => queryAccount() }, kind: "balance" }
					);
					// auto-refresh the badge every 5 minutes while the tab is visible
					scheduleBadgeRefresh(requestSeq);
				} finally {
					if (manualAccountQuerySeq === requestSeq) manualAccountQuerySeq = 0;
				}
			}

			function onPointerDown(ev) {
				if (ev.button !== 0 || disposed) return;
				// The bubble and balance icon own their clicks: pressing a card,
				// its action, or the badge must never start a pet drag.
				if (ev.target instanceof Element && ev.target.closest(".bwm-bubble, .bwm-balance-btn")) return;
				// Keep an active completion/failure notification intact and let its
				// action button remain the explicit way to interact with it.
				if (isNotifyActive()) return;
				// touching the pet wakes her from a nap
				wasNapping = napping;
				nextNapAt = performance.now() + rand(24000, 42000);
				if (napping) {
					napping = false;
					napZ.length = 0;
					nextNapAt = performance.now() + rand(24000, 42000);
				}
				ev.preventDefault();
				root.setPointerCapture?.(ev.pointerId);
				dragging = true;
				dragStart = {
					x: ev.clientX,
					y: ev.clientY,
					lastX: ev.clientX,
					ox: parseFloat(root.style.left),
					oy: parseFloat(root.style.top),
					moved: false
				};
				root.classList.add("bwm-dragging");
			}

			function onPointerMove(ev) {
				if (!dragging || disposed) return;
				const nx = dragStart.ox + (ev.clientX - dragStart.x);
				const ny = dragStart.oy + (ev.clientY - dragStart.y);
				if (Math.abs(ev.clientX - dragStart.x) + Math.abs(ev.clientY - dragStart.y) > 6) {
					dragStart.moved = true;
				}
				const p = clampPos(nx, ny);
				applyPos(p.x, p.y);
				if (dragStart.moved) {
					const stepDx = ev.clientX - dragStart.lastX;
					dragStart.lastX = ev.clientX;
					if (Math.abs(stepDx) >= 1 && state !== (stepDx > 0 ? "runRight" : "runLeft")) {
						setState(stepDx > 0 ? "runRight" : "runLeft");
					}
				}
			}

			function finishDrag(ev) {
				const moved = !!dragStart?.moved;
				dragging = false;
				root.classList.remove("bwm-dragging");
				try { root.releasePointerCapture?.(ev.pointerId); } catch { /* capture may already be gone */ }
				const p = clampPos(parseFloat(root.style.left), parseFloat(root.style.top));
				applyPos(p.x, p.y);
				persistPos();
				transientUntil = 0;
				dragStart = null;
				return moved;
			}

			function onPointerUp(ev) {
				if (!dragging || disposed) return;
				const moved = finishDrag(ev);
				const now = performance.now();
				// Notices queued during the drag win over both click and pickup copy.
				if (notifyQueue.length > 0) {
					clearNotifyOwnership();
					pumpNotify(now);
					wasNapping = false;
					return;
				}
				if (!moved) {
					if (lastClickAt !== null && now - lastClickAt < 350) {
						// double click → celebrate
						lastClickAt = null;
						gesture("jump");
						emitHearts(6);
						show(pick(LINES.jump), 3200);
					} else {
						lastClickAt = now;
						gesture("wave");
						emitHearts(3);
						if (wasNapping) show("醒啦，我在。", 3600);
						else show(pick(LINES.wave), 3000);
						wasNapping = false;
					}
				} else {
					show(pick(LINES.pickup), 2000);
					setState("idle");
					wasNapping = false;
				}
			}

			function onPointerCancel(ev) {
				if (!dragging || disposed) return;
				finishDrag(ev);
				wasNapping = false;
				const now = performance.now();
				if (notifyQueue.length > 0) {
					clearNotifyOwnership();
					pumpNotify(now);
				} else if (!isNotifyActive(now)) {
					setState("idle");
				}
			}

			root.addEventListener("pointerdown", onPointerDown);
			root.addEventListener("pointermove", onPointerMove);
			root.addEventListener("pointerup", onPointerUp);
			root.addEventListener("pointercancel", onPointerCancel);

			// refresh the balance badge when the page becomes visible again
			// (tab switch back / window focus); the very first mount is handled
			// by the mount-time silent fetch, so only fire after a hide cycle.
			let seenHidden = false;
			const onVisibility = () => {
				if (document.hidden) {
					seenHidden = true;
					return;
				}
				if (seenHidden && !disposed) { try { queryAccount(true); } catch {} }
			};
			document.addEventListener("visibilitychange", onVisibility);

			// initial position
			try {
				const saved = JSON.parse(localStorage.getItem(STORE_KEY_POS));
				if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
					const p = clampPos(saved.x, saved.y);
					applyPos(p.x, p.y);
				} else {
					const vw = document.documentElement.clientWidth;
					applyPos(vw - PET_W - 28, Math.max(0, document.documentElement.clientHeight - PET_H - 28));
				}
			} catch {
				const vw = document.documentElement.clientWidth;
				applyPos(vw - PET_W - 28, Math.max(0, document.documentElement.clientHeight - PET_H - 28));
			}
			window.addEventListener("resize", fitPosToViewport);

			raf = requestAnimationFrame(loop);

			return {
				queryAccount,
				canShowIntro() {
					return !disposed && !dragging && notifyQueue.length === 0 && !isNotifyActive();
				},
				observeSignal(sig, observedAt = performance.now()) {
					if (disposed) return;
					observeSessionTransitions(sig, observedAt, !document.hidden);
				},
				dispose() {
					disposed = true;
					cancelAnimationFrame(raf);
					clearTimeout(badgeTimer);
					document.removeEventListener("visibilitychange", onVisibility);
					window.removeEventListener("resize", fitPosToViewport);
					root.removeEventListener("pointerdown", onPointerDown);
					root.removeEventListener("pointermove", onPointerMove);
					root.removeEventListener("pointerup", onPointerUp);
					root.removeEventListener("pointercancel", onPointerCancel);
				}
			};
		}

		// ----------------------------------------------------------- react
		function WhaleMaidPet(props) {
			const rootRef = useRef(null);
			const canvasRef = useRef(null);
			const bubbleRef = useRef(null);
			const engineRef = useRef(null);

			// Session snapshot: rows carry title / cwd / running /
			// pendingInteraction / jobs; current marks the selected session.
			const sig = props.useSessions
				? props.useSessions((s) => {
					const byId = s && s.byId ? s.byId : {};
					const jobs = s && s.jobsBySession ? s.jobsBySession : {};
					const rows = Object.values(byId).map((r) => ({
						id: r && r.id,
						title: r && (r.displayTitle ?? r.title),
						rawTitle: r && r.title,
						cwd: r && r.cwd,
						running: !!(r && r.running),
						blank: !!(r && r.blank),
						pendingInteraction: !!(r && r.pendingInteraction),
						jobs: (r && jobs[r.id]) || []
					}));
					return { rows, current: s ? s.current : undefined };
				})
				: { rows: [], current: undefined };
			const sigRef = useRef(sig);
			sigRef.current = sig;

			// Bubble controller: structured content (title/meta/body), optional
			// action button; hover pauses the hide timer.
			//
			//   show(text, ms, opts?)                      plain text bubble
			//   show({title, meta, body}, ms, opts?)       structured bubble
			//     opts = { action?, kind?, onHoverChange? } (the last is an engine timing seam)
			const show = useMemo(() => {
				let timer = 0;
				let hover = false;
				let pointerInside = false;
				let focusInside = false;
				let boundBubble = null;
				let hoverOwner = null;
				let hideAt = 0;
				let remainingMs = 0;
				let resizeRaf = 0;
				const notifyHoverOwner = (owner, value) => {
					try { owner?.(value); } catch { /* bubble timing must remain usable */ }
				};
				const setHoverOwner = (next) => {
					const owner = typeof next === "function" ? next : null;
					if (owner === hoverOwner) return;
					if (hover && hoverOwner) notifyHoverOwner(hoverOwner, false);
					hoverOwner = owner;
					if (hover && hoverOwner) notifyHoverOwner(hoverOwner, true);
				};
				const cancelHide = () => {
					clearTimeout(timer);
					timer = 0;
					hideAt = 0;
					remainingMs = 0;
				};
				const hide = () => {
					cancelHide();
					setHoverOwner(null);
					hover = false;
					pointerInside = false;
					focusInside = false;
					if (bubbleRef.current) {
						bubbleRef.current.textContent = "";
						bubbleRef.current.className = "bwm-bubble";
					}
				};
				const armHide = () => {
					clearTimeout(timer);
					if (remainingMs <= 0) {
						hide();
						return;
					}
					hideAt = performance.now() + remainingMs;
					timer = setTimeout(() => {
						timer = 0;
						hideAt = 0;
						remainingMs = 0;
						if (!hover && bubbleRef.current) hide();
					}, remainingMs);
				};
				const hideSoon = (ms) => {
					clearTimeout(timer);
					timer = 0;
					hideAt = 0;
					remainingMs = Math.max(0, ms);
					if (!hover) armHide();
				};
				const updateHover = () => {
					const next = pointerInside || focusInside;
					if (next === hover) return;
					hover = next;
					if (hoverOwner) notifyHoverOwner(hoverOwner, hover);
					if (hover) {
						if (timer !== 0) {
							remainingMs = Math.max(0, hideAt - performance.now());
							clearTimeout(timer);
							timer = 0;
							hideAt = 0;
						}
					} else if (remainingMs > 0 && boundBubble?.classList.contains("bwm-on")) {
						armHide();
					}
				};
				const onMouseEnter = () => { pointerInside = true; updateHover(); };
				const onMouseLeave = () => { pointerInside = false; updateHover(); };
				const onFocusIn = () => { focusInside = true; updateHover(); };
				const onFocusOut = (ev) => {
					if (ev.relatedTarget instanceof Node && boundBubble?.contains(ev.relatedTarget)) return;
					focusInside = false;
					updateHover();
				};
				const placeBubble = () => {
					const b = boundBubble ?? bubbleRef.current;
					const rootRect = rootRef.current?.getBoundingClientRect();
					if (!b || !rootRect || b.childNodes.length === 0) return;
					b.style.setProperty("--bwm-bubble-shift", "0px");
					const bubbleWidth = b.offsetWidth;
					const bubbleHeight = b.offsetHeight;
					const centerX = rootRect.left + rootRect.width / 2;
					const inset = 12;
					let shift = 0;
					if (centerX - bubbleWidth / 2 < inset) {
						shift = inset - (centerX - bubbleWidth / 2);
					} else if (centerX + bubbleWidth / 2 > window.innerWidth - inset) {
						shift = window.innerWidth - inset - (centerX + bubbleWidth / 2);
					}
					b.style.setProperty("--bwm-bubble-shift", `${Math.round(shift)}px`);
					const aboveSpace = rootRect.top - 24;
					const belowSpace = window.innerHeight - rootRect.bottom - 24;
					b.classList.toggle("bwm-below", aboveSpace < bubbleHeight && belowSpace > aboveSpace);
				};
				const onResize = () => {
					cancelAnimationFrame(resizeRaf);
					resizeRaf = requestAnimationFrame(placeBubble);
				};
				const bindBubble = (bubble) => {
					if (boundBubble === bubble) return;
					if (boundBubble) {
						boundBubble.removeEventListener("mouseenter", onMouseEnter);
						boundBubble.removeEventListener("mouseleave", onMouseLeave);
						boundBubble.removeEventListener("focusin", onFocusIn);
						boundBubble.removeEventListener("focusout", onFocusOut);
						window.removeEventListener("resize", onResize);
					}
					boundBubble = bubble;
					boundBubble.addEventListener("mouseenter", onMouseEnter);
					boundBubble.addEventListener("mouseleave", onMouseLeave);
					boundBubble.addEventListener("focusin", onFocusIn);
					boundBubble.addEventListener("focusout", onFocusOut);
					window.addEventListener("resize", onResize);
				};
				const showFn = (text, ms, opts) => {
					const b = bubbleRef.current;
					if (!b) return;
					const action = opts && opts.action;
					const hoverable = action || (opts && typeof opts.onHoverChange === "function");
					const plain = typeof text !== "object" || text === null;
					const kind = opts && opts.kind ? `bwm-kind-${opts.kind}` : "";
					bindBubble(b);
					setHoverOwner(opts && opts.onHoverChange);
					b.textContent = "";
					b.style.setProperty("--bwm-bubble-shift", "0px");
					b.className = [
						"bwm-bubble",
						plain ? "bwm-plain" : "",
						action ? "bwm-action" : "",
						hoverable ? "bwm-hoverable" : "",
						kind
					].filter(Boolean).join(" ");
					if (typeof text === "object" && text !== null) {
						if (text.balance !== undefined) {
							// balance card: label → big value → divider → rows → meta
							const card = document.createElement("div");
							card.className = "bwm-balance-card";
							const label = document.createElement("span");
							label.className = "bwm-balance-label";
							label.textContent = text.balance.label;
							card.appendChild(label);
							const value = document.createElement("span");
							value.className = "bwm-balance-value";
							value.textContent = text.balance.value;
							card.appendChild(value);
							if (Array.isArray(text.rows) && text.rows.length > 0) {
								const div = document.createElement("div");
								div.className = "bwm-balance-divider";
								card.appendChild(div);
								for (const row of text.rows) {
									const r = document.createElement("div");
									r.className = "bwm-balance-row";
									const rl = document.createElement("span");
									rl.className = "bwm-balance-row-label";
									rl.textContent = row.label;
									const rv = document.createElement("span");
									rv.className = "bwm-balance-row-value";
									rv.textContent = row.value;
									r.append(rl, rv);
									card.appendChild(r);
								}
							}
							if (text.meta !== undefined) {
								const m = document.createElement("span");
								m.className = "bwm-bubble-meta";
								m.textContent = text.meta;
								card.appendChild(m);
							}
							b.appendChild(card);
						} else {
							if (text.title !== undefined) {
								const t = document.createElement("span");
								t.className = "bwm-bubble-title";
								t.textContent = text.title;
								b.appendChild(t);
							}
							if (text.meta !== undefined) {
								const m = document.createElement("span");
								m.className = "bwm-bubble-meta";
								m.textContent = text.meta;
								b.appendChild(m);
							}
							if (text.body !== undefined) {
								const d = document.createElement("span");
								d.className = "bwm-bubble-body";
								d.textContent = text.body;
								b.appendChild(d);
							}
						}
					} else {
						const span = document.createElement("span");
						span.textContent = text;
						b.appendChild(span);
					}
					if (action) {
						const btn = document.createElement("button");
						btn.className = "bwm-bubble-action";
						btn.type = "button";
						btn.textContent = action.label;
						btn.addEventListener("click", (ev) => {
							ev.stopPropagation();
							hide();
							action.fn();
						});
						b.appendChild(btn);
					}
					// Keep the whole sticker visible when the pet sits near an edge. If
					// there is no room above her, place the bubbles below instead.
					placeBubble();
					// Restart the short entrance motion when an existing bubble changes.
					void b.offsetWidth;
					b.classList.add("bwm-on");
					// ms === 0 keeps the bubble until replaced; hover pauses otherwise
					if (ms !== 0) hideSoon(ms ?? 3000);
					else cancelHide();
				};
				showFn.dispose = () => {
					const bubble = boundBubble ?? bubbleRef.current;
					hide();
					hover = false;
					if (boundBubble) {
						boundBubble.removeEventListener("mouseenter", onMouseEnter);
						boundBubble.removeEventListener("mouseleave", onMouseLeave);
						boundBubble.removeEventListener("focusin", onFocusIn);
						boundBubble.removeEventListener("focusout", onFocusOut);
						window.removeEventListener("resize", onResize);
						boundBubble = null;
					}
					cancelAnimationFrame(resizeRaf);
					if (bubble) {
						bubble.textContent = "";
						bubble.className = "bwm-bubble";
					}
				};
				showFn.hide = hide;
				return showFn;
			}, []);

			useEffect(() => {
				const engine = createPetEngine({
					root: rootRef.current,
					canvas: canvasRef.current,
					getSignal: () => sigRef.current,
					show,
					openSession: props.openSession
				});
				engineRef.current = engine;
				engine.observeSignal(sigRef.current, performance.now());
				// One-time character introduction for this chibi v2 design.
				let introTimer = 0;
				try {
					if (localStorage.getItem(STORE_KEY_INTRODUCED) !== "1") {
						introTimer = setTimeout(() => {
							// First-run copy is disposable. Never let it replace a task notice,
							// a user-requested balance card, or any other active bubble.
							if (!engine.canShowIntro() || bubbleRef.current?.classList.contains("bwm-on")) return;
							show(LINES.intro.join("\n"), 5200);
							try { localStorage.setItem(STORE_KEY_INTRODUCED, "1"); } catch { /* ignore */ }
						}, 900);
					}
				} catch { /* ignore */ }
				// silently fetch the balance for the corner badge on mount
				const first = setTimeout(() => { try { engine.queryAccount(true); } catch {} }, 1500);
				return () => {
					clearTimeout(first);
					clearTimeout(introTimer);
					engine.dispose();
					show.dispose?.();
					if (engineRef.current === engine) engineRef.current = null;
				};
			}, [show, props.openSession]);

			useEffect(() => {
				engineRef.current?.observeSignal(sig, performance.now());
			}, [sig]);

			return h(
				"div",
				{
					ref: rootRef,
					className: "bwm-root",
					title: "小鲸 · 蓝鲸女仆 · 非官方 DSH 社区插件"
				},
				h("div", {
					ref: bubbleRef,
					className: "bwm-bubble",
					role: "status",
					"aria-live": "polite",
					"aria-atomic": "true"
				}),
				h("canvas", { ref: canvasRef, width: 192, height: 208 }),
				h(
					"button",
					{
						className: "bwm-balance-btn",
						type: "button",
						title: "DeepSeek 余额（点击查看明细）",
						"aria-label": "DeepSeek 余额",
						onClick: (ev) => {
							ev.stopPropagation();
							engineRef.current?.queryAccount();
						}
					},
					"¥…"
				)
			);
		}

		// ---------------------------------------------------------- plugin
		/**
		 * `slots` mounts the companion after `shell.overlay` is declared;
		 * `sessions` powers the jump-to-session button on notifications.
		 */
		const inject = ["slots", "sessions"];

		/**
		 * Registers the pet into the shell-wide floating layer.
		 * @param ctx - Client root context.
		 */
		function apply(ctx) {
			const openSession = (id) => {
				try {
					ctx.sessions.open(id);
				} catch (error) {
					ctx.logger?.warn?.(error);
				}
			};
			ctx.slots.inject(
				"shell.overlay",
				() =>
					ctx.slots.register(
						{
							name: "shell.overlay",
							id: "blue-whale-maid",
							order: 100,
							label: "蓝鲸女仆"
						},
						(props) => h(WhaleMaidPet, { ...props, openSession })
					)
			);
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
