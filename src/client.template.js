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
 * Artwork: simashui @ codex-pets.net (https://codex-pets.net/#/pets/blue-whale-maid).
 * Sprite layout: Codex Pet v2 atlas, 8 cols x 11 rows, cell 192x208:
 *   0 idle · 1 running-right · 2 running-left · 3 waving · 4 jumping
 *   5 failed · 6 waiting · 7 running · 8 review · 9-10 look-directions (v2)
 *
 * Notification scheme (root-scope signals only):
 *   - a session finishes running  -> "jumping" + 「任务名」完成啦 + jump-to-session button
 *   - its jobs carry a failure   -> "failed" animation + problem notice
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
		const { createElement: h, useEffect, useRef, useState, useMemo } = React;

		// ---------------------------------------------------------------- css
		const CSS = `
.bwm-root{position:fixed;z-index:1500;width:144px;height:156px;pointer-events:auto;
  user-select:none;-webkit-user-select:none;touch-action:none;cursor:grab;box-sizing:border-box}
.bwm-root.bwm-dragging{cursor:grabbing}
.bwm-root canvas{display:block;width:144px;height:156px;image-rendering:pixelated}
.bwm-hide{position:absolute;top:2px;right:2px;width:20px;height:20px;border:0;border-radius:50%;
  background:rgba(72,84,166,.55);color:#fff;font:12px/18px sans-serif;text-align:center;
  cursor:pointer;opacity:0;transition:opacity .15s;padding:0}
.bwm-root:hover .bwm-hide{opacity:1}
.bwm-hide:hover{background:rgba(220,38,38,.85)}
.bwm-bubble{position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);
  width:max-content;max-width:320px;min-width:120px;
  background:linear-gradient(180deg,#ffffff 0%,#f3f6ff 100%);border:1px solid #d8def5;
  border-radius:14px;box-shadow:0 8px 24px rgba(72,84,166,.14),0 2px 6px rgba(72,84,166,.08);
  padding:10px 14px;font:13px/1.55 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  color:#334155;white-space:pre-wrap;opacity:0;pointer-events:none;transition:opacity .18s;text-align:left}
.bwm-bubble.bwm-on{opacity:1}
.bwm-bubble.bwm-action{pointer-events:auto}
.bwm-bubble::after{content:"";position:absolute;left:50%;top:100%;margin-left:-7px;
  border:7px solid transparent;border-top-color:#d8def5;filter:drop-shadow(0 1px 0 #d8def5)}
.bwm-bubble::before{content:"";position:absolute;left:50%;top:100%;margin-left:-6px;
  border:6px solid transparent;border-top-color:#f3f6ff}
.bwm-bubble-title{display:block;font:600 14px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  color:#3c3f66;margin-bottom:2px}
.bwm-bubble-meta{display:block;color:#8b93c0;font-size:11px;line-height:1.6}
.bwm-bubble-body{display:block;color:#334155}
.bwm-balance-card{display:flex;flex-direction:column;gap:2px;min-width:150px}
.bwm-balance-label{color:#8b93c0;font-size:11px;line-height:1.4}
.bwm-balance-value{color:#4854a6;font:700 26px/1.25 -apple-system,"PingFang SC",sans-serif;
  letter-spacing:-.5px;margin:2px 0 4px}
.bwm-balance-divider{height:1px;background:linear-gradient(90deg,#d8def5,#eef1fb);margin:4px 0}
.bwm-balance-row{display:flex;justify-content:space-between;gap:16px;
  font-size:12px;line-height:1.7;color:#475569}
.bwm-balance-row-label{color:#8b93c0}
.bwm-balance-row-value{font-variant-numeric:tabular-nums;color:#3c3f66}
.bwm-balance-card .bwm-bubble-meta{margin-top:3px}
.bwm-bubble-close{position:absolute;top:6px;right:6px;width:18px;height:18px;border:0;border-radius:50%;
  background:rgba(139,147,192,.2);color:#6b74a8;font:11px/18px sans-serif;text-align:center;
  cursor:pointer;opacity:0;transition:opacity .15s;padding:0;line-height:18px}
.bwm-bubble:hover .bwm-bubble-close{opacity:1}
.bwm-bubble-close:hover{background:rgba(220,38,38,.85);color:#fff}
.bwm-bubble-action{margin-top:8px;display:inline-block;border:0;border-radius:9px;padding:5px 14px;
  background:linear-gradient(180deg,#4d5ab5 0%,#4854a6 100%);color:#fff;
  font:600 12px/1.6 inherit;cursor:pointer;transition:filter .12s}
.bwm-bubble-action:hover{filter:brightness(1.12)}
.bwm-bubble.bwm-kind-done{border-color:#bbe7c8}
.bwm-bubble.bwm-kind-done::after{border-top-color:#bbe7c8}
.bwm-bubble.bwm-kind-done .bwm-bubble-title{color:#15803d}
.bwm-bubble.bwm-kind-done .bwm-bubble-action{background:linear-gradient(180deg,#2eaf6a 0%,#1f9d57 100%)}
.bwm-bubble.bwm-kind-done .bwm-bubble-action:hover{filter:brightness(1.1)}
.bwm-bubble.bwm-kind-failed{border-color:#f6c9c9}
.bwm-bubble.bwm-kind-failed::after{border-top-color:#f6c9c9}
.bwm-bubble.bwm-kind-failed .bwm-bubble-title{color:#b91c1c}
.bwm-bubble.bwm-kind-failed .bwm-bubble-action{background:linear-gradient(180deg,#e5484d 0%,#d03a40 100%)}
.bwm-bubble.bwm-kind-failed .bwm-bubble-action:hover{filter:brightness(1.1)}
.bwm-bubble.bwm-kind-wait{border-color:#f2e3b6}
.bwm-bubble.bwm-kind-wait::after{border-top-color:#f2e3b6}
.bwm-bubble.bwm-kind-wait .bwm-bubble-title{color:#b45309}
.bwm-bubble.bwm-kind-wait .bwm-bubble-action{background:linear-gradient(180deg,#e2a43a 0%,#d18f22 100%)}
.bwm-bubble.bwm-kind-wait .bwm-bubble-action:hover{filter:brightness(1.1)}
.bwm-bubble.bwm-kind-balance{border-color:#c6cff2}
.bwm-bubble.bwm-kind-balance::after{border-top-color:#c6cff2}
.bwm-bubble.bwm-kind-balance .bwm-bubble-title{color:#3b4799}
.bwm-bubble.bwm-kind-balance .bwm-bubble-action{background:linear-gradient(180deg,#5a68c8 0%,#4854a6 100%)}
.bwm-bubble.bwm-kind-balance .bwm-bubble-action:hover{filter:brightness(1.12)}
.bwm-restore{position:fixed;right:14px;bottom:14px;z-index:1500;border:1px solid #c6cff2;
  background:rgba(255,255,255,.94);color:#4854a6;border-radius:999px;padding:5px 12px;
  font:12px/1 -apple-system,"PingFang SC",sans-serif;cursor:pointer;
  box-shadow:0 2px 8px rgba(72,84,166,.12);pointer-events:auto}
.bwm-restore:hover{background:#eef1fb}
.bwm-balance-btn{position:absolute;right:-6px;bottom:6px;width:26px;height:26px;border:0;border-radius:50%;
  background:linear-gradient(180deg,#5a68c8 0%,#4854a6 100%);color:#fff;
  font:14px/26px sans-serif;text-align:center;cursor:pointer;
  box-shadow:0 2px 10px rgba(72,84,166,.45);padding:0;line-height:26px;
  transition:transform .12s,filter .12s;z-index:1501}
.bwm-balance-btn:hover{filter:brightness(1.15);transform:scale(1.12)}
.bwm-balance-btn:active{transform:scale(.95)}
@media (prefers-reduced-motion: reduce){.bwm-bubble{transition:none}}
`;
		const CSS_TAG_ID = "dsh-blue-whale-maid/styles";
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_TAG_ID)}]`) === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-blue-whale-maid";
			tag.dataset.pluginCss = CSS_TAG_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
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
			idle: { row: 0, frames: 7, fps: 5 },
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
			wave: [
				"嗯？叫我干嘛~",
				"在呢在呢~",
				"咋了，要我搭把手？",
				"摸鱼时间到！",
				"今天也要加油哦！",
				"有啥事快说，我听着呢~",
				"鲸尾摇摇，心情好好~",
				"刚打了个盹，正好醒~",
				// —— DeepSeek 梗 ——
				"我是鲸鱼女仆，不是鲨鱼啊喂~",
				"深度求索，也求你摸摸~",
				"我可不会『服务器繁忙』，随叫随到~",
				"思考过程都写在鲸尾上了，随便看~",
				"养我不用 550 万美元，小鱼干就行~",
				"开源女仆，心（源）意全透明~",
				"V4 女仆在此，家务推理两手抓~",
				"偶尔也会记岔，但绝不瞎编~",
				"AGI 什么时候来？先给我小鱼干~"
			],
			jump: [
				"好耶——！",
				"太棒了！",
				"呱唧呱唧，给你鼓掌！",
				"这速度，R1 都得服！",
				"成了！这一跳震撼华尔街~",
				"深夜更新？不，是深夜庆祝！"
			],
			workStart: (t) => `收到！去忙「${t}」啦~`,
			pending: [
				(t) => `「${t}」等你拍板呢~`,
				(t) => `「${t}」的问题不抢答，等你点头~`,
				(t) => `「${t}」卡住了？别急，我盯着呢~`
			],
			busy: [
				"努力干活中…",
				"思考中，别打扰~",
				"在攒 token 呢~",
				"忙得很，鲸尾都摇出火星子了~",
				"推理中，请稍候……",
				"在深度求索，你在深度等我~"
			],
			workTitle: (t) => `在处理「${t}」呢~`,
			switch: [
				"换会话啦？我还在哦~",
				"新会话，新气象！",
				"上下文切了，鲸鱼就位~",
				"会话无缝衔接，跟我的鲸尾一样顺滑~"
			],
			pickup: ["呜哇，飞起来了！", "诶诶诶——", "别晃了，token 要撒了！"],
			credit: [
				"蓝鲸女仆参上！图源 simashui（codex-pets.net）",
				"我是蓝鲸女仆，原作者 simashui，来自 codex-pets.net"
			]
		};
		const pick = (list) => list[Math.floor(Math.random() * list.length)];
		const GO_LOOK_LABEL = "去看看 →";

		const STORE_KEY_POS = "dsh-blue-whale-maid:pos";
		const STORE_KEY_HIDDEN = "dsh-blue-whale-maid:hidden";
		const STORE_KEY_CREDITED = "dsh-blue-whale-maid:credited";
		const STORE_KEY_COMPANION = "dsh-blue-whale-maid:companion";

		// Companion growth: purely local counters (no content, no credentials).
		const COMPANION_LEVELS = [
			{ min: 0, name: "小鲸鱼", lines: ["嗯？叫我干嘛~", "在呢在呢~"] },
			{ min: 10, name: "伙伴", lines: ["嘿，今天也一起加油！", "有我在，放心干~"] },
			{ min: 30, name: "挚友", lines: ["老搭档了，默契~", "一个眼神就懂你~"] },
			{ min: 60, name: "深海羁绊", lines: ["这辈子就认你这个主人了~", "深海之下，也听得到你的声音~"] }
		];
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

		// Tiny Web-Audio success chime (no files, no system commands).
		let audioCtx = null;
		function ensureAudio() {
			try {
				if (audioCtx === null) {
					const AC = window.AudioContext || window.webkitAudioContext;
					if (AC) audioCtx = new AC();
				}
				if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
				return audioCtx;
			} catch {
				return null;
			}
		}
		function playChime() {
			const actx = ensureAudio();
			if (!actx) return;
			try {
				const now = actx.currentTime;
				const notes = [880, 1108.73, 1318.51]; // A5, C#6, E6 — bright major arpeggio
				for (let i = 0; i < notes.length; i++) {
					const osc = actx.createOscillator();
					const gain = actx.createGain();
					osc.type = "sine";
					osc.frequency.value = notes[i];
					gain.gain.setValueAtTime(0.0001, now + i * 0.09);
					gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.09 + 0.02);
					gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.5);
					osc.connect(gain).connect(actx.destination);
					osc.start(now + i * 0.09);
					osc.stop(now + i * 0.09 + 0.55);
				}
			} catch { /* audio unavailable — silence is fine */ }
		}

		// Companion counter (local-only, no content).
		function readCompanion() {
			try {
				const raw = JSON.parse(localStorage.getItem(STORE_KEY_COMPANION));
				if (raw && typeof raw.score === "number") return { score: raw.score };
			} catch { /* ignore */ }
			return { score: 0 };
		}
		function addCompanion(n) {
			const cur = readCompanion();
			const score = Math.min(100, cur.score + n);
			try {
				localStorage.setItem(STORE_KEY_COMPANION, JSON.stringify({ score }));
			} catch { /* storage unavailable — session-only growth */ }
			return score;
		}
		function companionLevel(score) {
			let level = COMPANION_LEVELS[0];
			for (const l of COMPANION_LEVELS) if (score >= l.min) level = l;
			return level;
		}

		// ---- DeepSeek account info (via host routes; key never leaves host)
		const BALANCE_ROUTE = "/api/blue-whale-maid/balance";
		const SESSION_COST_ROUTE = "/api/blue-whale-maid/session-cost";

		const fmtMoney = (value, currency) => {
			const symbol = currency === "USD" ? "$" : "¥";
			if (typeof value !== "number" || !Number.isFinite(value)) return `${symbol}?`;
			return `${symbol}${value.toFixed(2)}`;
		};
		const fmtCost = (value) => {
			if (typeof value !== "number" || !Number.isFinite(value)) return null;
			if (value >= 1) return `¥${value.toFixed(2)}`;
			if (value >= 0.01) return `¥${value.toFixed(4)}`;
			return `¥${value.toFixed(6)}`;
		};
		/** Balance bubble content from the host route payload. */
		function balanceText(payload, todayConsumed) {
			const infos = payload && Array.isArray(payload.balance_infos) ? payload.balance_infos : [];
			const info = infos[0];
			if (!info) return { title: "💰 账户暂无余额信息" };
			const currency = info.currency ?? "CNY";
			const rows = [];
			if (info.topped_up_balance !== void 0) rows.push({ label: "充值", value: fmtMoney(Number(info.topped_up_balance), currency) });
			if (info.granted_balance !== void 0) rows.push({ label: "赠金", value: fmtMoney(Number(info.granted_balance), currency) });
			if (typeof todayConsumed === "number" && Number.isFinite(todayConsumed)) {
				rows.push({ label: "今日约消费", value: `≈${fmtMoney(todayConsumed, currency)}` });
			}
			return {
				balance: { label: "账户余额", value: fmtMoney(Number(info.total_balance), currency) },
				rows
			};
		}

		/**
		 * A human-meaningful session title, or null. `displayTitle` falls back
		 * to the cwd basename and then the session id — those are machine
		 * labels, not things to read out loud. Only a real user-set title
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
		 * fn }, kind?: 'done'|'failed'|'wait'|'balance' }.
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
			let nextLineAt = 0;
			let nextWaveAt = 0;
			let lastCurrent = null;
			let lastTime = performance.now();
			let raf = 0;
			let disposed = false;
			const hearts = [];
			// per-session running tracking: id -> { since, sawStart }
			const prevRun = new Map();
			// completion notifications waiting to be shown
			const notifyQueue = [];
			let notifyShowingUntil = 0;
			// nap (all-idle) state: true while every session is quiet
			let napping = false;
			let wasNapping = false;
			let napSince = 0;
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

			function setState(next) {
				if (reducedMotion && next !== "idle") return;
				state = next;
				frame = 0;
				frameElapsed = 0;
			}

			function gesture(name) {
				if (reducedMotion || dragging) return;
				resumeState = state === name ? "idle" : state;
				transientUntil = 0;
				setState(name);
			}

			function emitHearts(n) {
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

			// ------------------------------------------- notifications
			function pushNotify(kind, sessionId, title, durationMs) {
				if (notifyQueue.length >= 5) return; // drop oldest-flow noise
				notifyQueue.push({ kind, sessionId, title, durationMs });
			}

			/** Show the next queued completion notification, if any. */
			function pumpNotify(now) {
				if (notifyQueue.length === 0) return;
				if (notifyShowingUntil !== 0 && now < notifyShowingUntil) return;
				const item = notifyQueue.shift();
				notifyShowingUntil = now + 12500;
				const isCurrent = getSignal().current === item.sessionId;
				const action = !isCurrent && openSession
					? { label: GO_LOOK_LABEL, fn: () => openSession(item.sessionId) }
					: undefined;
				const dur = typeof item.durationMs === "number" ? fmtDur(item.durationMs) : "";
				const named = item.title !== null && item.title !== undefined ? `「${truncate(item.title, 20)}」` : "";
				if (item.kind === "failed") {
					gesture("fail");
					show(
						{ title: named ? `${named}出问题了…` : "有个任务出问题了…", meta: dur ? `跑了 ${dur}` : undefined },
						9000,
						{ action, kind: "failed" }
					);
				} else {
					gesture("jump");
					emitHearts(6);
					playChime();
					const score = addCompanion(1);
					const level = companionLevel(score);
					let body = "";
					if (notifyQueue.length > 0) body += `还有 ${notifyQueue.length} 个任务也完成了\n`;
					if (level.min > 0 && (score === level.min || score === level.min + 1)) {
						body += `${level.name} · ${score} 分`;
					}
					show(
						{
							title: named ? `${named}完成啦！` : "有个任务完成啦！",
							meta: dur ? `耗时 ${dur}` : undefined,
							body: body || undefined
						},
						12000,
						{ action, kind: "done" }
					);
				}
			}

			function update(dt) {
				const now = performance.now();
				const sig = getSignal(); // { rows, current }
				const once = STATES[state]?.once === true;

				// ---- session transitions: start bubbles, completion/failure notices
				const runningIds = new Set();
				const rowsById = new Map();
				for (const r of sig.rows) {
					if (!r || !r.id) continue;
					rowsById.set(r.id, r);
					if (r.running) runningIds.add(r.id);
					const prev = prevRun.get(r.id);
					if (r.running && (!prev || !prev.running)) {
						prevRun.set(r.id, { running: true, since: now });
						if (r.id === sig.current && !r.blank) {
							// level-aware work-start line (name only good titles)
							const lvl = companionLevel(readCompanion().score);
							const gt = goodTitle(r);
							const target = gt !== null ? truncate(gt, 18) : null;
							const line = lvl.lines.length > 0
								? (target !== null ? `${lvl.lines[0]} 去忙「${target}」啦~` : `${lvl.lines[0]} 有活干了~`)
								: (target !== null ? LINES.workStart(target) : "收到！开工~");
							show(line, 3200);
							nextLineAt = now + rand(30000, 50000);
						}
					} else if (!r.running && prev && prev.running) {
						// a task just finished — notify
						const duration = now - (prev.since ?? now);
						prevRun.set(r.id, { running: false, since: 0 });
						if (duration > 3000 && !r.blank) {
							const failedJob = (r.jobs ?? []).some((j) => j && j.status === "failed");
							pushNotify(failedJob ? "failed" : "done", r.id, goodTitle(r), duration);
						}
					}
				}
				for (const [id, prev] of prevRun) {
					if (!rowsById.has(id)) prevRun.delete(id);
				}

				// ---- long-running nudge: a session running a long time gets a
				// gentle "still going?" bubble (never asserts it is stuck).
				if (!dragging && notifyQueue.length === 0) {
					for (const [id, prev] of prevRun) {
						if (!prev.running) continue;
						const elapsed = now - (prev.since ?? now);
						if (elapsed > LONG_RUN_MS && now - (prev.lastNudgeAt ?? 0) > NUDGE_INTERVAL_MS) {
							prev.lastNudgeAt = now;
							const row = rowsById.get(id);
							const gt = row ? goodTitle(row) : null;
							const t = gt !== null ? `「${truncate(gt, 18)}」` : "有个任务";
							show(`${t}跑了 ${fmtDur(elapsed)} 了，还在忙呢，要看看吗？`, 5000);
							break;
						}
					}
				}

				// ---- pump queued notifications first (they own the bubble)
				if (notifyQueue.length > 0 || (notifyShowingUntil !== 0 && now < notifyShowingUntil)) {
					pumpNotify(now);
				}

				// session switch → greeting wave
				if (lastCurrent !== null && sig.current !== lastCurrent && !dragging) {
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
				const anyPending = sig.rows.some((r) => r && !!r.pendingInteraction);
				const pendingRow = sig.rows.find((r) => r && !!r.pendingInteraction);
				if ((anyRunning || anyPending) && napping) napping = false;

				if (anyPending) {
					// a session is blocked on a user question → waiting
					if (!dragging && !once && notifyQueue.length === 0) setState("wait");
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
						else show({ title: "有个任务在等你拍板呢~" }, 6000, { action, kind: "wait" });
					}
				} else if (anyRunning) {
					// the agent is working → codex-style running + occasional review
					if (!dragging && !once && notifyQueue.length === 0 && state !== "run" && state !== "review") setState("run");
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
					// all quiet — nap time when nothing at all is running
					if (!napping && !dragging && notifyQueue.length === 0 && !once && state === "idle") {
						napping = true;
						napSince = now;
						nextNapZAt = now + rand(1200, 2600);
					}
					if (napping && now - napSince > 4000 && state === "idle") {
						// after a nap's worth of quiet, drift into look-around loiter
						napping = false;
						nextActionAt = now + rand(3000, 8000);
					}
					if (napping && now >= nextNapZAt) {
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
				frameElapsed += dt;
				const frameDur = 1000 / def.fps;
				if (frameElapsed >= frameDur) {
					frameElapsed -= frameDur;
					frame = (frame + 1) % def.frames;
					if (frame === 0 && def.once) onGestureEnd();
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
			 * The API key never leaves the host — this only calls local routes.
			 */
			async function queryAccount() {
				show("💰 查询中…", 0);
				let balance = null;
				let todayConsumed = null;
				try {
					const res = await fetch(BALANCE_ROUTE, { cache: "no-store", signal: AbortSignal.timeout(15000) });
					const body = await res.json().catch(() => null);
					if (!res.ok || !body || body.ok !== true) {
						const msg = body && typeof body.message === "string" ? body.message : `查询失败（${res.status}）`;
						gesture("fail");
						show(msg, 5000);
						return;
					}
					balance = body.balance ?? null;
					todayConsumed = typeof body.todayConsumed === "number" ? body.todayConsumed : null;
				} catch {
					gesture("fail");
					show("连不上本地服务，稍后再试", 4500);
					return;
				}
				// current session cost (best-effort; may be null)
				let sessionCost = null;
				const currentId = getSignal().current;
				if (currentId !== undefined) {
					try {
						const res = await fetch(`${SESSION_COST_ROUTE}?sessionId=${encodeURIComponent(currentId)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
						const body = await res.json().catch(() => null);
						if (res.ok && body && body.ok === true && typeof body.cost === "number") sessionCost = body.cost;
					} catch { /* session cost is optional */ }
				}
				gesture("jump");
				emitHearts(6);
				const content = balanceText(balance, todayConsumed);
				const cost = fmtCost(sessionCost);
				show(
					{
						balance: content.balance,
						rows: content.rows,
						meta: cost !== null ? `本会话已用 ${cost}` : undefined
					},
					10000,
					{ action: { label: "刷新", fn: () => queryAccount() }, kind: "balance" }
				);
			}

			function onPointerDown(ev) {
				if (ev.button !== 0 || disposed) return;
				// Bubble action buttons and the balance icon own their clicks:
				// when the press starts on them, don't preventDefault / capture
				// the pointer / start a drag — that would swallow their click.
				if (ev.target instanceof Element && ev.target.closest(".bwm-bubble-action, .bwm-balance-btn")) return;
				// touching the pet wakes her from a nap
				wasNapping = napping;
				if (napping) { napping = false; napZ.length = 0; }
				ev.preventDefault();
				root.setPointerCapture?.(ev.pointerId);
				dragging = true;
				dragStart = {
					x: ev.clientX,
					y: ev.clientY,
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
					const dx = ev.clientX - dragStart.x;
					if (dx !== 0 && state !== (dx > 0 ? "runRight" : "runLeft")) {
						setState(dx > 0 ? "runRight" : "runLeft");
					} else if (dx === 0 && state !== "idle") setState("idle");
				}
			}

			function onPointerUp(ev) {
				if (!dragging || disposed) return;
				dragging = false;
				root.classList.remove("bwm-dragging");
				root.releasePointerCapture?.(ev.pointerId);
				const p = clampPos(parseFloat(root.style.left), parseFloat(root.style.top));
				applyPos(p.x, p.y);
				persistPos();
				transientUntil = 0;
				if (!dragStart.moved) {
					const now = performance.now();
					// pending completion notifications take priority on click
					if (notifyQueue.length > 0) {
						notifyShowingUntil = 0;
						pumpNotify(now);
						return;
					}
					if (lastClickAt !== null && now - lastClickAt < 350) {
						// double click → celebrate
						lastClickAt = null;
						gesture("jump");
						emitHearts(6);
						addCompanion(1);
						show(pick(LINES.jump), 3200);
					} else {
						lastClickAt = now;
						gesture("wave");
						emitHearts(3);
						if (wasNapping) show("呼啊……醒啦！刚才梦到小鱼干山了~", 3600);
						else show(pick(LINES.wave), 3000);
						wasNapping = false;
					}
				} else {
					show(pick(LINES.pickup), 2000);
					setState("idle");
					wasNapping = false;
				}
			}

			root.addEventListener("pointerdown", onPointerDown);
			root.addEventListener("pointermove", onPointerMove);
			root.addEventListener("pointerup", onPointerUp);
			root.addEventListener("pointercancel", onPointerUp);

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

			raf = requestAnimationFrame(loop);

			return {
				queryAccount,
				dispose() {
					disposed = true;
					cancelAnimationFrame(raf);
					root.removeEventListener("pointerdown", onPointerDown);
					root.removeEventListener("pointermove", onPointerMove);
					root.removeEventListener("pointerup", onPointerUp);
					root.removeEventListener("pointercancel", onPointerUp);
				}
			};
		}

		// ----------------------------------------------------------- react
		function WhaleMaidPet(props) {
			const rootRef = useRef(null);
			const canvasRef = useRef(null);
			const bubbleRef = useRef(null);
			const engineRef = useRef(null);
			const [hidden, setHidden] = useState(() => {
				try {
					return localStorage.getItem(STORE_KEY_HIDDEN) === "1";
				} catch {
					return false;
				}
			});

			// Session snapshot: rows carry title / cwd / running / completed /
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
						completed: !!(r && r.completed),
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
			// action button + manual close; hover pauses the hide timer.
			//
			//   show(text, ms, opts?)                      plain text bubble
			//   show({title, meta, body}, ms, opts?)       structured bubble
			//     opts = { action?: {label, fn}, kind?: 'done'|'failed'|'wait'|'balance' }
			const show = useMemo(() => {
				let timer = 0;
				let hover = false;
				let hoverBound = false;
				const hideSoon = (ms) => {
					clearTimeout(timer);
					timer = setTimeout(() => {
						if (!hover && bubbleRef.current) hide();
					}, ms);
				};
				const hide = () => {
					if (bubbleRef.current) bubbleRef.current.classList.remove("bwm-on");
				};
				const showFn = (text, ms, opts) => {
					const b = bubbleRef.current;
					if (!b) return;
					const action = opts && opts.action;
					const kind = opts && opts.kind ? ` bwm-kind-${opts.kind}` : "";
					if (!hoverBound) {
						hoverBound = true;
						b.addEventListener("mouseenter", () => { hover = true; clearTimeout(timer); });
						b.addEventListener("mouseleave", () => { hover = false; });
					}
					b.textContent = "";
					b.className = "bwm-bubble bwm-on" + (action ? " bwm-action" : "") + kind;
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
					// manual close (✕)
					const close = document.createElement("button");
					close.className = "bwm-bubble-close";
					close.textContent = "\u00d7";
					close.setAttribute("aria-label", "关闭气泡");
					close.addEventListener("click", (ev) => {
						ev.stopPropagation();
						hide();
					});
					b.appendChild(close);
					if (action) {
						const btn = document.createElement("button");
						btn.className = "bwm-bubble-action";
						btn.textContent = action.label;
						btn.addEventListener("click", (ev) => {
							ev.stopPropagation();
							hide();
							action.fn();
						});
						b.appendChild(btn);
					}
					// ms === 0 keeps the bubble until replaced; hover pauses otherwise
					if (ms !== 0) hideSoon(ms ?? 3000);
				};
				return showFn;
			}, []);

			useEffect(() => {
				if (hidden) return undefined;
				const engine = createPetEngine({
					root: rootRef.current,
					canvas: canvasRef.current,
					getSignal: () => sigRef.current,
					show,
					openSession: props.openSession
				});
				engineRef.current = engine;
				// one-time attribution notice
				try {
					if (localStorage.getItem(STORE_KEY_CREDITED) !== "1") {
						localStorage.setItem(STORE_KEY_CREDITED, "1");
						setTimeout(() => show(pick(LINES.credit), 5200), 900);
					}
				} catch { /* ignore */ }
				return () => engine.dispose();
			}, [hidden, show, props.openSession]);

			const restore = h(
				"button",
				{ className: "bwm-restore", onClick: () => setHidden(false) },
				"🐳 召唤蓝鲸女仆"
			);

			if (hidden) return restore;

			const hide = h(
				"button",
				{
					className: "bwm-hide",
					title: "隐藏蓝鲸女仆",
					"aria-label": "隐藏蓝鲸女仆",
					onClick: (ev) => {
						ev.stopPropagation();
						try {
							localStorage.setItem(STORE_KEY_HIDDEN, "1");
						} catch { /* ignore */ }
						setHidden(true);
					}
				},
				"\u00d7"
			);

			return h(
				"div",
				{
					ref: rootRef,
					className: "bwm-root",
					title: "蓝鲸女仆 · 原作者 simashui（codex-pets.net）· DSH 插件 yuxino/dsh-blue-whale-maid"
				},
				h("div", { ref: bubbleRef, className: "bwm-bubble" }),
				h("canvas", { ref: canvasRef, width: 192, height: 208 }),
				h(
					"button",
					{
						className: "bwm-balance-btn",
						title: "DeepSeek 余额",
						"aria-label": "DeepSeek 余额",
						onClick: (ev) => {
							ev.stopPropagation();
							engineRef.current?.queryAccount();
						}
					},
					"💰"
				),
				hide
			);
		}

		// ---------------------------------------------------------- plugin
		/**
		 * Services required by this plugin. `layout` is injected for ordering,
		 * not for use: ui-layout's AppFrame entry declares the `shell.overlay`
		 * slot when it mounts, and the cordis service dependency guarantees our
		 * apply runs only after that declaration exists. `sessions` powers the
		 * jump-to-session button on completion notifications.
		 */
		const inject = ["slots", "layout", "sessions"];

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
			ctx.effect(
				() =>
					ctx.slots.register(
						{
							name: "shell.overlay",
							id: "blue-whale-maid",
							order: 100,
							label: "蓝鲸女仆"
						},
						(props) => h(WhaleMaidPet, { ...props, openSession })
					),
				"dsh-blue-whale-maid: shell.overlay entry"
			);
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
