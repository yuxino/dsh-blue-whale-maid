/**
 * dsh-blue-whale-maid — browser half (template).
 *
 * `tools/embed.mjs` replaces the `__ATLAS_DATA_URL__` placeholder with the
 * base64 data URL of `assets/spritesheet.webp` and writes `lib/client.js`.
 * Do not edit `lib/client.js` directly.
 *
 * The bundle registers a `shell.overlay` entry (the frame-wide floating
 * layer of the DSH web GUI) and renders 蓝鲸女仆 (Blue Whale Maid) — a
 * draggable, session-aware desktop pet.
 *
 * Artwork: simashui @ codex-pets.net (https://codex-pets.net/#/pets/blue-whale-maid).
 * Sprite layout: Codex Pet v2 atlas, 8 cols x 11 rows, cell 192x208:
 *   0 idle · 1 running-right · 2 running-left · 3 waving · 4 jumping
 *   5 failed · 6 waiting · 7 running · 8 review · 9-10 look-directions (v2)
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
.bwm-root{position:fixed;z-index:1500;width:192px;height:208px;pointer-events:auto;
  user-select:none;-webkit-user-select:none;touch-action:none;cursor:grab;box-sizing:border-box}
.bwm-root.bwm-dragging{cursor:grabbing}
.bwm-root canvas{display:block;width:192px;height:208px;image-rendering:pixelated}
.bwm-hide{position:absolute;top:2px;right:2px;width:20px;height:20px;border:0;border-radius:50%;
  background:rgba(30,41,59,.65);color:#fff;font:12px/18px sans-serif;text-align:center;
  cursor:pointer;opacity:0;transition:opacity .15s;padding:0}
.bwm-root:hover .bwm-hide{opacity:1}
.bwm-hide:hover{background:rgba(220,38,38,.85)}
.bwm-bubble{position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);
  max-width:240px;background:#fff;border:1px solid #d8e2f2;border-radius:12px;
  box-shadow:0 4px 14px rgba(15,23,42,.12);padding:7px 11px;font:13px/1.5 -apple-system,
  "PingFang SC","Microsoft YaHei",sans-serif;color:#334155;white-space:pre-wrap;
  opacity:0;pointer-events:none;transition:opacity .18s;text-align:left}
.bwm-bubble.bwm-on{opacity:1}
.bwm-bubble::after{content:"";position:absolute;left:50%;top:100%;margin-left:-6px;
  border:6px solid transparent;border-top-color:#fff;filter:drop-shadow(0 1px 0 #d8e2f2)}
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

		const LINES = {
			wave: [
				"主人，有什么吩咐吗？",
				"我在哟~",
				"今天也要加油哦！",
				"有我在，不会让你一个人的。",
				"嗯？需要帮忙吗？",
				"鲸尾摇摇，心情好好~"
			],
			jump: ["好耶——！", "太棒了！", "任务完成，辛苦啦！", "为你鼓掌！啪叽啪叽~"],
			busy: ["正在认真工作中…", "马上就好，稍等一下下~", "干活中，勿扰啦~", "交给我吧！"],
			pickup: ["呜哇，飞起来了！", "诶诶诶——"],
			credit: [
				"蓝鲸女仆参上！图源 simashui（codex-pets.net）",
				"我是蓝鲸女仆，原作者 simashui，来自 codex-pets.net"
			]
		};
		const pick = (list) => list[Math.floor(Math.random() * list.length)];

		const STORE_KEY_POS = "dsh-blue-whale-maid:pos";
		const STORE_KEY_HIDDEN = "dsh-blue-whale-maid:hidden";
		const STORE_KEY_CREDITED = "dsh-blue-whale-maid:credited";

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
		 * React wrapper only owns mounting and the busy signal.
		 */
		function createPetEngine({ root, canvas, getBusy, say }) {
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
			let dragging = false;
			let dragStart = null;
			let targetX = null;
			let dir = 1;
			let busyDuration = 0;
			let nextActionAt = performance.now() + rand(4000, 9000);
			let nextHeartAt = 0;
			let lastTime = performance.now();
			let raf = 0;
			let disposed = false;
			let lastClickAt = null;
			const hearts = [];

			const stateDef = () => STATES[state] ?? STATES.idle;

			function clampPos(x, y) {
				const vw = document.documentElement.clientWidth;
				const vh = document.documentElement.clientHeight;
				return {
					x: clamp(x, -120, vw - 72),
					y: clamp(y, 0, vh - CELL_H)
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

			function update(dt) {
				const busy = getBusy();
				if (busy) {
					busyDuration += dt;
					if (!dragging && !STATES[state]?.once && state !== "wait") setState("wait");
					if (performance.now() >= nextHeartAt) {
						nextHeartAt = performance.now() + rand(1800, 3400);
						emitHearts(1);
					}
					if (Math.random() < dt * 0.00025) say(pick(LINES.busy), 3500);
				} else if (busyDuration > 0) {
					if (busyDuration > 20000) {
						busyDuration = 0;
						gesture("jump");
						say(pick(LINES.jump), 3200);
					} else {
						busyDuration = 0;
						if (!STATES[state]?.once) setState("idle");
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

				// idle loiter: occasionally look around or wander
				if (!busy && !dragging && !STATES[state]?.once) {
					if (state === "idle" && performance.now() >= nextActionAt) {
						nextActionAt = performance.now() + rand(7000, 20000);
						const roll = Math.random();
						if (roll < 0.3) gesture(roll < 0.15 ? "lookA" : "lookB");
						else if (roll < 0.7) {
							const vw = document.documentElement.clientWidth;
							targetX = rand(30, Math.max(31, vw - CELL_W - 30));
							dir = targetX > parseFloat(root.style.left) ? 1 : -1;
							setState(dir > 0 ? "runRight" : "runLeft");
						}
					}
					if (targetX !== null) {
						const x = parseFloat(root.style.left);
						const step = (dir > 0 ? 62 : -62) * (dt / 1000);
						const nx = dir > 0 ? Math.min(targetX, x + step) : Math.max(targetX, x + step);
						applyPos(nx, parseFloat(root.style.top));
						if (nx === targetX) {
							targetX = null;
							setState("idle");
							persistPos();
						}
					}
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
				ev.preventDefault();
				root.setPointerCapture?.(ev.pointerId);
				dragging = true;
				targetX = null;
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
				if (!dragStart.moved) {
					const now = performance.now();
					if (lastClickAt !== null && now - lastClickAt < 350) {
						// double click → celebrate
						lastClickAt = null;
						gesture("jump");
						emitHearts(6);
						say(pick(LINES.jump), 3200);
					} else {
						lastClickAt = now;
						gesture("wave");
						emitHearts(3);
						say(pick(LINES.wave), 3000);
					}
				} else {
					say(pick(LINES.pickup), 2000);
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
					applyPos(vw - CELL_W - 28, Math.max(0, document.documentElement.clientHeight - CELL_H - 28));
				}
			} catch {
				const vw = document.documentElement.clientWidth;
				applyPos(vw - CELL_W - 28, Math.max(0, document.documentElement.clientHeight - CELL_H - 28));
			}

			raf = requestAnimationFrame(loop);

			return {
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

			// any session running → the agent is working → the pet waits
			const busy = props.useSessions
				? props.useSessions((s) => {
					const rows = s && s.byId ? Object.values(s.byId) : [];
					return rows.some((r) => r && r.running === true);
				})
				: false;
			const busyRef = useRef(busy);
			busyRef.current = busy;

			const say = useMemo(() => {
				let timer = 0;
				return (text, ms) => {
					if (!bubbleRef.current) return;
					bubbleRef.current.textContent = text;
					bubbleRef.current.classList.add("bwm-on");
					clearTimeout(timer);
					timer = setTimeout(() => {
						if (bubbleRef.current) bubbleRef.current.classList.remove("bwm-on");
					}, ms ?? 3000);
				};
			}, []);

			useEffect(() => {
				if (hidden) return undefined;
				const engine = createPetEngine({
					root: rootRef.current,
					canvas: canvasRef.current,
					getBusy: () => busyRef.current,
					say
				});
				engineRef.current = engine;
				// one-time attribution notice
				try {
					if (localStorage.getItem(STORE_KEY_CREDITED) !== "1") {
						localStorage.setItem(STORE_KEY_CREDITED, "1");
						setTimeout(() => say(pick(LINES.credit), 5200), 900);
					}
				} catch { /* ignore */ }
				return () => engine.dispose();
			}, [hidden, say]);

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
		/** Services required by this plugin. */
		const inject = ["slots"];

		/**
		 * Registers the pet into the shell-wide floating layer.
		 * @param ctx - Client root context.
		 */
		function apply(ctx) {
			ctx.effect(
				() =>
					ctx.slots.register(
						{
							name: "shell.overlay",
							id: "blue-whale-maid",
							order: 100,
							label: "蓝鲸女仆"
						},
						WhaleMaidPet
					),
				"dsh-blue-whale-maid: shell.overlay entry"
			);
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
