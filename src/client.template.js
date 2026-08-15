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
  background:rgba(30,41,59,.65);color:#fff;font:12px/18px sans-serif;text-align:center;
  cursor:pointer;opacity:0;transition:opacity .15s;padding:0}
.bwm-root:hover .bwm-hide{opacity:1}
.bwm-hide:hover{background:rgba(220,38,38,.85)}
.bwm-bubble{position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);
  width:max-content;max-width:300px;min-width:96px;background:#fff;border:1px solid #d8e2f2;
  border-radius:12px;box-shadow:0 4px 14px rgba(15,23,42,.12);padding:8px 12px;
  font:13px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#334155;
  white-space:pre-wrap;opacity:0;pointer-events:none;transition:opacity .18s;text-align:left}
.bwm-bubble.bwm-on{opacity:1}
.bwm-bubble.bwm-action{pointer-events:auto}
.bwm-bubble::after{content:"";position:absolute;left:50%;top:100%;margin-left:-6px;
  border:6px solid transparent;border-top-color:#fff;filter:drop-shadow(0 1px 0 #d8e2f2)}
.bwm-bubble-action{margin-top:6px;display:inline-block;border:0;border-radius:8px;padding:4px 12px;
  background:#2563eb;color:#fff;font:12px/1.6 inherit;cursor:pointer}
.bwm-bubble-action:hover{background:#1d4ed8}
.bwm-keycard{position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);
  width:230px;background:#fff;border:1px solid #d8e2f2;border-radius:12px;
  box-shadow:0 4px 14px rgba(15,23,42,.14);padding:10px 12px;z-index:1501;
  font:12px/1.5 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#334155}
.bwm-keycard-label{display:block;margin-bottom:6px;font-weight:600}
.bwm-keycard-hint{display:block;color:#94a3b8;font-size:11px;line-height:1.5;margin-bottom:8px}
.bwm-keycard input{box-sizing:border-box;width:100%;border:1px solid #cbd5e1;border-radius:8px;
  padding:6px 8px;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f172a;
  outline:0;margin-bottom:8px}
.bwm-keycard input:focus{border-color:#2563eb}
.bwm-keycard-actions{display:flex;gap:8px}
.bwm-keycard-save{flex:1;border:0;border-radius:8px;padding:5px 10px;background:#2563eb;
  color:#fff;font:12px/1.6 inherit;cursor:pointer}
.bwm-keycard-save:hover{background:#1d4ed8}
.bwm-keycard-cancel{flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:5px 10px;
  background:#fff;color:#475569;font:12px/1.6 inherit;cursor:pointer}
.bwm-keycard-cancel:hover{background:#f1f5f9}
.bwm-restore{position:fixed;right:14px;bottom:14px;z-index:1500;border:1px solid #d8e2f2;
  background:rgba(255,255,255,.92);color:#475569;border-radius:999px;padding:5px 12px;
  font:12px/1 -apple-system,"PingFang SC",sans-serif;cursor:pointer;
  box-shadow:0 2px 8px rgba(15,23,42,.10);pointer-events:auto}
.bwm-restore:hover{background:#eff6ff}
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
			done: (t) => `「${t}」完成啦！辛苦啦~`,
			doneExtra: (n) => `还有 ${n} 个任务也完成了`,
			failed: (t) => `「${t}」好像出了点问题…`,
			workStart: (t) => `收到！去忙「${t}」啦~`,
			workProgress: (t) => `还在忙「${t}」…`,
			jobProgress: (j) => `正在跑「${j}」…`,
			pending: [
				(t) => `「${t}」等你拍板呢~`,
				(t) => `「${t}」的问题不抢答，等你点头~`,
				(t) => `「${t}」卡住了？别急，我盯着呢~`
			],
			busy: [
				"忙得很，鲸尾都摇出火星子了~",
				"token 烧着呢，别催~",
				"推理中，请稍候……",
				"在深度求索，你在深度等我~"
			],
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
		const STORE_KEY_DEEPSEEK = "dsh-blue-whale-maid:deepseek-key";

		// DeepSeek account balance (official endpoint, no payload).
		const DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance";
		const BALANCE_ACTION_LABEL = "💰 查余额";
		const KEY_CRED_REF = "DEEPSEEK_API_KEY";

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
		 * `show(text, ms, action)` shows a bubble; `action` = { label, fn }
		 * renders a jump-to-session button inside it.
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

			// ------------------------------------------- deepseek balance
			/**
			 * Query the DeepSeek account balance for the stored API key.
			 * Renders the result (or an error) into the bubble.
			 */
			async function queryBalance() {
				let key = null;
				try {
					key = localStorage.getItem(STORE_KEY_DEEPSEEK);
				} catch { /* storage unavailable */ }
				if (!key || key.trim().length === 0) {
					openKeyCard("还没配 DeepSeek key，输入一次就能查余额啦~（只存在本机浏览器）");
					return;
				}
				show("💰 查询中…", 0);
				try {
					const res = await fetch(DEEPSEEK_BALANCE_URL, {
						headers: { Authorization: `Bearer ${key.trim()}` },
						cache: "no-store",
						signal: AbortSignal.timeout(10000)
					});
					if (res.status === 401) {
						gesture("fail");
						show("🔑 key 无效或已失效，重新输入试试", 5000, { label: "换 key", fn: () => openKeyCard() });
						return;
					}
					if (!res.ok) {
						gesture("fail");
						show(`查询失败（${res.status}），稍后再试`, 4500);
						return;
					}
					const data = await res.json();
					gesture("jump");
					emitHearts(6);
					show(balanceText(data), 7000, { label: "刷新", fn: () => queryBalance() });
				} catch {
					gesture("fail");
					show("连不上 DeepSeek，检查网络后再试", 4500);
				}
			}

			/** Format the /user/balance response into a bubble-friendly card. */
			function balanceText(data) {
				if (!data || typeof data !== "object") return "查询结果有点怪…再试一次？";
				if (data.is_available === false) return "💸 余额不足，无法调用 API";
				const infos = Array.isArray(data.balance_infos) ? data.balance_infos : [];
				if (infos.length === 0) return "💰 账户暂无余额信息";
				const lines = infos.map((info) => {
					const symbol = info.currency === "CNY" ? "¥" : "$";
					const parts = [`${symbol}${info.total_balance ?? "?"}`];
					const extra = [];
					if (info.granted_balance !== void 0) extra.push(`赠金 ${symbol}${info.granted_balance}`);
					if (info.topped_up_balance !== void 0) extra.push(`充值 ${symbol}${info.topped_up_balance}`);
					if (extra.length > 0) parts.push(`（${extra.join(" · ")}）`);
					return `💰 余额 ${parts.join(" ")}`;
				});
				return lines.join("\n");
			}

			/**
			 * Show an inline key-entry card above the pet. On save the key is
			 * stored in localStorage and the balance is queried immediately.
			 */
			function openKeyCard(hint) {
				closeKeyCard();
				const card = document.createElement("div");
				card.className = "bwm-keycard";
				card.dataset.bwmKeycard = "1";
				const label = document.createElement("span");
				label.className = "bwm-keycard-label";
				label.textContent = "DeepSeek API Key";
				const hintEl = document.createElement("span");
				hintEl.className = "bwm-keycard-hint";
				hintEl.textContent = hint ?? "只存在本机浏览器 localStorage，不写入日志，随时可换。";
				const input = document.createElement("input");
				input.type = "password";
				input.placeholder = "sk-…";
				input.autocomplete = "off";
				input.spellcheck = false;
				const actions = document.createElement("div");
				actions.className = "bwm-keycard-actions";
				const save = document.createElement("button");
				save.className = "bwm-keycard-save";
				save.textContent = "保存并查询";
				const cancel = document.createElement("button");
				cancel.className = "bwm-keycard-cancel";
				cancel.textContent = "取消";
				actions.append(save, cancel);
				card.append(label, hintEl, input, actions);
				root.appendChild(card);
				const commit = () => {
					const value = input.value.trim();
					if (value.length === 0) {
						input.focus();
						return;
					}
					try {
						localStorage.setItem(STORE_KEY_DEEPSEEK, value);
					} catch { /* storage unavailable — still try the query */ }
					closeKeyCard();
					queryBalance();
				};
				save.addEventListener("click", (ev) => {
					ev.stopPropagation();
					commit();
				});
				cancel.addEventListener("click", (ev) => {
					ev.stopPropagation();
					closeKeyCard();
				});
				input.addEventListener("keydown", (ev) => {
					ev.stopPropagation();
					if (ev.key === "Enter") commit();
					else if (ev.key === "Escape") closeKeyCard();
				});
				setTimeout(() => input.focus(), 30);
			}

			function closeKeyCard() {
				const card = root.querySelector(".bwm-keycard");
				if (card) card.remove();
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
			function pushNotify(kind, sessionId, title) {
				if (notifyQueue.length >= 5) return; // drop oldest-flow noise
				notifyQueue.push({ kind, sessionId, title });
			}

			/** Show the next queued completion notification, if any. */
			function pumpNotify(now) {
				if (notifyQueue.length === 0) return;
				if (notifyShowingUntil !== 0 && now < notifyShowingUntil) return;
				const item = notifyQueue.shift();
				notifyShowingUntil = now + 6500;
				const isCurrent = getSignal().current === item.sessionId;
				const action = !isCurrent && openSession
					? { label: GO_LOOK_LABEL, fn: () => openSession(item.sessionId) }
					: undefined;
				if (item.kind === "failed") {
					gesture("fail");
					show(LINES.failed(truncate(item.title, 20)), 6000, action);
				} else {
					gesture("jump");
					emitHearts(6);
					let text = LINES.done(truncate(item.title, 20));
					if (notifyQueue.length > 0) text += `\n${LINES.doneExtra(notifyQueue.length)}`;
					show(text, 6000, action);
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
							show(LINES.workStart(truncate(r.title, 18)), 3200);
							nextLineAt = now + rand(30000, 50000);
						}
					} else if (!r.running && prev && prev.running) {
						// a task just finished — notify
						const duration = now - (prev.since ?? now);
						prevRun.set(r.id, { running: false, since: 0 });
						if (duration > 3000 && !r.blank) {
							const failedJob = (r.jobs ?? []).some((j) => j && j.status === "failed");
							pushNotify(failedJob ? "failed" : "done", r.id, r.title ?? r.id);
						}
					}
				}
				for (const [id, prev] of prevRun) {
					if (!rowsById.has(id)) prevRun.delete(id);
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
						const t = pendingRow ? truncate(pendingRow.title ?? pendingRow.id, 18) : "…";
						const action = pendingRow && pendingRow.id !== sig.current && openSession
							? { label: GO_LOOK_LABEL, fn: () => openSession(pendingRow.id) }
							: undefined;
						show(pick(LINES.pending)(t), 5000, action);
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
					// periodic "what I'm doing" bubble for the current session
					if (now >= nextLineAt && notifyQueue.length === 0) {
						nextLineAt = now + rand(35000, 55000);
						const job = (currentRow?.jobs ?? []).find((j) => j && j.status === "running");
						if (job && job.label) show(LINES.jobProgress(truncate(job.label, 26)), 3600);
						else if (currentRow && Math.random() < 0.5) show(pick(LINES.busy), 3200);
						else if (currentRow) show(LINES.workProgress(truncate(currentRow.title ?? currentRow.id, 20)), 3200);
					}
				} else {
					// all quiet — nothing to do beyond idle loiter
					// idle loiter: look around or run in place — never wander
					if (!dragging && !once && transientUntil === 0 && state === "idle" && now >= nextActionAt) {
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
			function onPointerDown(ev) {
				if (ev.button !== 0 || disposed) return;
				// Bubble action buttons and the key card own their clicks: when
				// the press starts on them, don't preventDefault / capture the
				// pointer / start a drag — that would swallow their click and
				// the "去看看" jump / key input would never work.
				if (ev.target instanceof Element && ev.target.closest(".bwm-bubble-action, .bwm-keycard")) return;
				// pressing the pet itself dismisses an open key card
				closeKeyCard();
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
						show(pick(LINES.jump), 3200);
					} else {
						lastClickAt = now;
						gesture("wave");
						emitHearts(3);
						show(pick(LINES.wave), 6000, { label: BALANCE_ACTION_LABEL, fn: () => queryBalance() });
					}
				} else {
					show(pick(LINES.pickup), 2000);
					setState("idle");
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
				dispose() {
					disposed = true;
					cancelAnimationFrame(raf);
					closeKeyCard();
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

			// Session snapshot: rows carry title / running / completed /
			// pendingInteraction / jobs; current marks the selected session.
			const sig = props.useSessions
				? props.useSessions((s) => {
					const byId = s && s.byId ? s.byId : {};
					const jobs = s && s.jobsBySession ? s.jobsBySession : {};
					const rows = Object.values(byId).map((r) => ({
						id: r && r.id,
						title: r && (r.displayTitle ?? r.title),
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

			// Bubble controller: text (optional action button), hover pauses the hide timer.
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
				const showFn = (text, ms, action) => {
					const b = bubbleRef.current;
					if (!b) return;
					if (!hoverBound) {
						hoverBound = true;
						b.addEventListener("mouseenter", () => { hover = true; clearTimeout(timer); });
						b.addEventListener("mouseleave", () => { hover = false; });
					}
					b.textContent = "";
					b.className = "bwm-bubble bwm-on" + (action ? " bwm-action" : "");
					const span = document.createElement("span");
					span.textContent = text;
					b.appendChild(span);
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
					// ms === 0 keeps the bubble up until the next show() replaces
					// it (used for the query-in-progress state).
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
