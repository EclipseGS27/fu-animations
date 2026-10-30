import { ELEMENT_LOOK, FX, MODULE_ID, getSetting } from './presets.mjs';
import { PROC, isProc } from './procedural.mjs';
import { now, wait } from './clock.mjs';
import { isJb, jbDuration, playJb, preloadJb } from './jb2a.mjs';

/**
 * Canvas side: sprite effects, projectiles, and visual-only token motion (lunges, knockback, dodges, idle hover).
 * Nothing here writes to documents; every client plays the same plan on its own canvas.
 */

const ROOT = `modules/${MODULE_ID}/vfx/`;
const ease = {
	linear: (t) => t,
	in: (t) => t * t,
	out: (t) => 1 - (1 - t) * (1 - t),
	inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
	back: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
};

/* ------------------------------------------------------------------ */
/*  Textures                                                           */
/* ------------------------------------------------------------------ */

const frameCache = new Map();

async function loadTex(src) {
	const load = foundry.canvas?.loadTexture ?? globalThis.loadTexture;
	return load(src);
}

/** All frames of an effect sheet, cut once and cached */
export function framesOf(id) {
	if (frameCache.has(id)) return frameCache.get(id);
	const fx = FX[id];
	if (!fx) return Promise.resolve(null);
	const p = loadTex(ROOT + fx.src).then((tex) => {
		if (!tex) return null;
		const base = tex.baseTexture;
		if (fx.pixel) base.scaleMode = PIXI.SCALE_MODES.NEAREST;
		const out = [];
		for (let i = 0; i < fx.frames; i++) {
			const c = i % fx.cols;
			const r = Math.floor(i / fx.cols);
			out.push(new PIXI.Texture(base, new PIXI.Rectangle(c * fx.fw, r * fx.fh, fx.fw, fx.fh)));
		}
		return out;
	});
	frameCache.set(id, p);
	return p;
}

export function preload(ids) {
	const list = [...new Set(ids.filter(Boolean))];
	return Promise.all([...list.filter((id) => FX[id] && !isProc(id)).map(framesOf), preloadJb(list.filter(isJb))]);
}

/* ------------------------------------------------------------------ */
/*  Effect layer                                                       */
/* ------------------------------------------------------------------ */

let layer = null;

export function getLayer() {
	if (layer && !layer.destroyed && layer.parent) return layer;
	const parent = canvas.interface ?? canvas.stage;
	layer = new PIXI.Container();
	layer.name = 'fu-animations';
	layer.eventMode = 'none';
	layer.zIndex = 10000;
	parent.addChild(layer);
	parent.sortableChildren = true;
	parent.sortChildren?.();
	return layer;
}

export function resetLayer() {
	layer = null;
}

const CMF = () => PIXI.ColorMatrixFilter ?? PIXI.filters?.ColorMatrixFilter;

/** Recolor an effect toward an element: rotate the hue of colored effects, tint white ones */
export function applyElement(sprite, fxDef, element) {
	const look = ELEMENT_LOOK[element];
	if (!look || element === 'none') return;
	if (fxDef.hue == null || look.hue == null) {
		if (element !== 'physical') sprite.tint = look.color;
		return;
	}
	const Filter = CMF();
	if (!Filter) return;
	const f = new Filter();
	let delta = look.hue - fxDef.hue;
	f.hue(delta, false);
	if (look.sat) f.saturate(look.sat, true);
	if (look.bright) f.brightness(look.bright, true);
	sprite.filters = [f];
}

export function userScale() {
	return Number(getSetting('scale') ?? 1) || 1;
}

/**
 * Play one effect sheet at a point.
 * @param {string} id effect id
 * @param {{x:number,y:number,rotation?:number,scale?:number,element?:string,alpha?:number,flip?:boolean,tokenSize?:number}} at
 * @returns {Promise<void>} resolves when the effect ends
 */
export async function playFx(id, at) {
	if (isProc(id)) return playProc(id, at);
	if (isJb(id)) return playJb(id, at);
	const fx = FX[id];
	if (!fx || !canvas?.ready) return;
	const frames = await framesOf(id);
	if (!frames?.length) return;
	const sprite = new PIXI.AnimatedSprite(frames);
	sprite.anchor.set(0.5);
	sprite.position.set(at.x, at.y);
	const px = canvas.grid.size * fx.size * (at.scale ?? 1) * userScale() * Math.max(1, (at.tokenSize ?? 1) * 0.85);
	const s = px / fx.fw;
	sprite.scale.set(at.flip ? -s : s, s);
	if (fx.dir && at.rotation != null) sprite.rotation = at.rotation;
	sprite.alpha = at.alpha ?? 1;
	if (fx.blend === 'add') sprite.blendMode = PIXI.BLEND_MODES.ADD;
	applyElement(sprite, fx, at.element);
	sprite.loop = false;
	sprite.autoUpdate = false;
	sprite.animationSpeed = fx.fps / 60;
	getLayer().addChild(sprite);
	const loops = fx.loop ? 2 : 1;
	return new Promise((resolve) => {
		let played = 0;
		const tick = (delta) => {
			if (sprite.destroyed) return finish();
			sprite.update(delta);
		};
		const finish = () => {
			canvas.app.ticker.remove(tick);
			if (!sprite.destroyed) {
				sprite.parent?.removeChild(sprite);
				sprite.destroy({ children: true, texture: false, baseTexture: false });
			}
			resolve();
		};
		sprite.onComplete = () => {
			played++;
			if (played < loops) {
				sprite.gotoAndPlay(0);
				return;
			}
			// short fade so effects don't pop out
			const start = now();
			const fade = () => {
				const t = (now() - start) / 140;
				if (sprite.destroyed || t >= 1) {
					canvas.app.ticker.remove(fade);
					return finish();
				}
				sprite.alpha = (at.alpha ?? 1) * (1 - t);
			};
			canvas.app.ticker.add(fade);
		};
		canvas.app.ticker.add(tick);
		sprite.play();
		// safety net
		setTimeout(finish, (fx.frames / fx.fps) * 1000 * loops + 2500);
	});
}

/** Run a code-drawn effect on the scene */
export function playProc(id, at) {
	const def = PROC[id];
	if (!def || !canvas?.ready) return Promise.resolve();
	const root = getLayer();
	const box = new PIXI.Container();
	root.addChild(box);
	const look = ELEMENT_LOOK[at.element];
	const point = { x: at.x, y: at.y };
	const ctx = {
		g: canvas.grid.size * (at.scale ?? 1) * userScale() * Math.max(1, (at.tokenSize ?? 1) * 0.85),
		x: at.x,
		y: at.y,
		from: at.from ?? point,
		to: at.to ?? point,
		color: at.element && at.element !== 'none' && look ? look.color : def.color,
		add: (o) => {
			if (at.alpha != null) o.alpha = at.alpha;
			box.addChild(o);
		},
		tick: (fn) => canvas.app.ticker.add(fn),
		untick: (fn) => canvas.app.ticker.remove(fn),
	};
	return def.run(ctx).finally(() => {
		if (!box.destroyed) box.destroy({ children: true });
	});
}

export function fxDuration(id) {
	if (isProc(id)) return PROC[id].dur;
	if (isJb(id)) return jbDuration(id);
	const fx = FX[id];
	return fx ? (fx.frames / fx.fps) * 1000 * (fx.loop ? 2 : 1) : 0;
}

/* ------------------------------------------------------------------ */
/*  Projectiles                                                        */
/* ------------------------------------------------------------------ */

function colorFor(element) {
	return (ELEMENT_LOOK[element] ?? ELEMENT_LOOK.none).color;
}

/**
 * Draw something flying from one point to another.
 * @returns {Promise<void>} resolves on arrival
 */
export function projectile(kind, from, to, element = 'none') {
	if (!kind || !canvas?.ready) return Promise.resolve();
	const g = canvas.grid.size;
	const color = colorFor(element);
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const dist = Math.hypot(dx, dy) || 1;
	const angle = Math.atan2(dy, dx);
	const root = getLayer();
	const obj = new PIXI.Container();
	root.addChild(obj);
	const gr = new PIXI.Graphics();
	obj.addChild(gr);
	const trail = [];
	let speed = 900; // px per second at grid 100
	if (kind === 'beam') {
		const ms = 160;
		const hold = 220;
		const start = now();
		return new Promise((resolve) => {
			const tick = () => {
				const t = (now() - start) / ms;
				const k = Math.min(1, t);
				const fadeT = Math.max(0, (now() - start - ms - hold) / 160);
				gr.clear();
				const ex = from.x + dx * k;
				const ey = from.y + dy * k;
				gr.blendMode = PIXI.BLEND_MODES.ADD;
				gr.lineStyle(g * 0.22, color, 0.35 * (1 - fadeT)).moveTo(from.x, from.y).lineTo(ex, ey);
				gr.lineStyle(g * 0.08, 0xffffff, 0.9 * (1 - fadeT)).moveTo(from.x, from.y).lineTo(ex, ey);
				if (fadeT >= 1) {
					canvas.app.ticker.remove(tick);
					obj.destroy({ children: true });
				}
			};
			canvas.app.ticker.add(tick);
			setTimeout(resolve, ms);
		});
	}
	if (kind === 'bullet') speed = 2600;
	if (kind === 'arrow') speed = 1500;
	if (kind === 'rock') speed = 700;
	const ms = Math.max(140, (dist / (speed * (g / 100))) * 1000);
	const arc = kind === 'rock' ? Math.min(dist * 0.35, g * 2) : kind === 'orb' ? Math.min(dist * 0.08, g * 0.4) : 0;
	const start = now();
	const drawHead = () => {
		gr.clear();
		if (kind === 'arrow') {
			gr.lineStyle(Math.max(2, g * 0.03), 0xe8dcc0, 1).moveTo(-g * 0.28, 0).lineTo(g * 0.12, 0);
			gr.beginFill(color === ELEMENT_LOOK.none.color ? 0xd9d9d9 : color).drawPolygon([g * 0.18, 0, g * 0.08, -g * 0.05, g * 0.08, g * 0.05]).endFill();
		} else if (kind === 'bullet') {
			gr.blendMode = PIXI.BLEND_MODES.ADD;
			gr.lineStyle(g * 0.04, 0xfff3c4, 1).moveTo(-g * 0.22, 0).lineTo(0, 0);
		} else if (kind === 'rock') {
			gr.beginFill(0x7a6248).drawCircle(0, 0, g * 0.16).endFill();
			gr.beginFill(0x9c8160).drawCircle(-g * 0.04, -g * 0.04, g * 0.08).endFill();
		} else {
			gr.blendMode = PIXI.BLEND_MODES.ADD;
			gr.beginFill(color, 0.35).drawCircle(0, 0, g * 0.16).endFill();
			gr.beginFill(color, 0.8).drawCircle(0, 0, g * 0.09).endFill();
			gr.beginFill(0xffffff, 0.95).drawCircle(0, 0, g * 0.045).endFill();
		}
	};
	drawHead();
	obj.rotation = kind === 'rock' || kind === 'orb' ? 0 : angle;
	return new Promise((resolve) => {
		const tick = () => {
			const t = Math.min(1, (now() - start) / ms);
			const x = from.x + dx * t;
			const y = from.y + dy * t - Math.sin(Math.PI * t) * arc;
			obj.position.set(x, y);
			if (kind === 'rock') obj.rotation += 0.15;
			if (kind === 'orb' || kind === 'rock') {
				const p = new PIXI.Graphics();
				p.blendMode = kind === 'orb' ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL;
				p.beginFill(kind === 'orb' ? color : 0x8a7055, 0.6).drawCircle(0, 0, g * (kind === 'orb' ? 0.07 : 0.05)).endFill();
				p.position.set(x, y);
				root.addChild(p);
				trail.push({ p, born: now() });
			}
			for (let i = trail.length - 1; i >= 0; i--) {
				const age = (now() - trail[i].born) / 260;
				if (age >= 1) {
					trail[i].p.destroy();
					trail.splice(i, 1);
				} else {
					trail[i].p.alpha = 0.6 * (1 - age);
					trail[i].p.scale.set(1 - age * 0.6);
				}
			}
			if (t >= 1) {
				canvas.app.ticker.remove(tick);
				obj.destroy({ children: true });
				const cleanup = () => {
					for (const tr of trail) tr.p.destroy();
					trail.length = 0;
				};
				setTimeout(cleanup, 260);
				resolve();
			}
		};
		canvas.app.ticker.add(tick);
	});
}

/* ------------------------------------------------------------------ */
/*  Token motion                                                       */
/* ------------------------------------------------------------------ */

/** tokenId -> {x, y} visual offset for actions (moves the whole token) */
const actionOffset = new Map();
/** tokens currently bobbing, tokenId -> phase */
const bobbing = new Map();
/** tokens we have moved, so they get put back exactly once they stop */
const touched = new Set();
let motionTicking = false;

/**
 * Add an offset to a display object without fighting Foundry: if Foundry moved it since our last write,
 * take its new position as the base.
 */
function applyOffset(obj, ox, oy) {
	if (!obj || obj.destroyed) return;
	const st = (obj.__fuAnim ??= { ex: null, ey: null, ax: 0, ay: 0 });
	const baseX = st.ex !== null && obj.x === st.ex ? obj.x - st.ax : obj.x;
	const baseY = st.ey !== null && obj.y === st.ey ? obj.y - st.ay : obj.y;
	obj.x = baseX + ox;
	obj.y = baseY + oy;
	st.ex = obj.x;
	st.ey = obj.y;
	st.ax = ox;
	st.ay = oy;
}

function motionTick() {
	const sec = now() / 1000;
	const bobOn = getSetting('idleBob') !== false;
	const amp = (Number(getSetting('bobAmount') ?? 1) || 0) * (canvas.grid?.size ?? 100) * 0.035;
	const ids = new Set([...actionOffset.keys(), ...bobbing.keys(), ...touched]);
	for (const id of ids) {
		const token = canvas.tokens?.get(id);
		if (!token || token.destroyed) {
			actionOffset.delete(id);
			bobbing.delete(id);
			touched.delete(id);
			continue;
		}
		touched.add(id);
		const off = actionOffset.get(id) ?? { x: 0, y: 0 };
		let bob = 0;
		const busy = actionOffset.has(id) || token._dragHandle || token.isPreview || token.animationContexts?.size;
		if (bobOn && bobbing.has(id) && !busy) bob = Math.sin(sec * 2.1 + bobbing.get(id)) * amp;
		applyOffset(token, off.x, off.y);
		if (token.mesh && token.mesh.parent !== token) applyOffset(token.mesh, off.x, off.y + bob);
		// back to rest: the zero offset was just written above, so stop tracking it
		if (!actionOffset.has(id) && !bobbing.has(id)) touched.delete(id);
	}
}

function ensureTicker() {
	if (motionTicking || !canvas?.app) return;
	canvas.app.ticker.add(motionTick);
	motionTicking = true;
}

export function resetMotion() {
	actionOffset.clear();
	bobbing.clear();
	touched.clear();
}

/** Tween a token's visual offset */
export function tweenOffset(token, to, ms, fn = ease.out) {
	ensureTicker();
	const id = token.id;
	const from = { ...(actionOffset.get(id) ?? { x: 0, y: 0 }) };
	const start = now();
	return new Promise((resolve) => {
		const step = () => {
			const t = Math.min(1, (now() - start) / ms);
			const k = fn(t);
			actionOffset.set(id, { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
			if (t >= 1) {
				canvas.app.ticker.remove(step);
				if (to.x === 0 && to.y === 0) actionOffset.delete(id);
				resolve();
			}
		};
		canvas.app.ticker.add(step);
	});
}

export function center(token) {
	const c = token.center ?? { x: token.x + token.w / 2, y: token.y + token.h / 2 };
	return { x: c.x, y: c.y };
}

function radius(token) {
	return Math.max(token.w ?? canvas.grid.size, token.h ?? canvas.grid.size) / 2;
}

/** Dash next to the target. Resolves at the moment of impact; call back() to return */
export async function lunge(source, target) {
	const a = center(source);
	const b = center(target);
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const dist = Math.hypot(dx, dy) || 1;
	const ux = dx / dist;
	const uy = dy / dist;
	const travel = Math.max(0, dist - (radius(source) + radius(target)) * 0.7);
	const g = canvas.grid.size;
	await tweenOffset(source, { x: -ux * g * 0.1, y: -uy * g * 0.1 }, 90, ease.out);
	await tweenOffset(source, { x: ux * travel, y: uy * travel }, Math.min(320, 120 + travel * 0.35), ease.in);
	return { back: () => tweenOffset(source, { x: 0, y: 0 }, Math.min(420, 200 + travel * 0.4), ease.inOut), ux, uy };
}

/** Recoil when struck */
export async function knockback(target, ux, uy, strength = 1) {
	const g = canvas.grid.size * 0.12 * strength;
	await tweenOffset(target, { x: ux * g, y: uy * g }, 70, ease.out);
	await tweenOffset(target, { x: 0, y: 0 }, 180, ease.out);
}

/** Step aside on a miss */
export async function dodge(target, ux, uy) {
	const g = canvas.grid.size * 0.22;
	const side = Math.random() < 0.5 ? 1 : -1;
	await tweenOffset(target, { x: -uy * g * side, y: ux * g * side }, 110, ease.out);
	await wait(90);
	await tweenOffset(target, { x: 0, y: 0 }, 220, ease.inOut);
}

/** Small screen shake for critical hits */
export async function shake(ms = 220, power = 6) {
	if (getSetting('shake') === false || !canvas?.stage) return;
	const stage = canvas.stage;
	const ox = stage.pivot.x;
	const oy = stage.pivot.y;
	const start = now();
	await new Promise((resolve) => {
		const tick = () => {
			const t = (now() - start) / ms;
			if (t >= 1) {
				canvas.app.ticker.remove(tick);
				resolve();
				return;
			}
			const p = power * (1 - t);
			stage.pivot.set(ox + (Math.random() * 2 - 1) * p, oy + (Math.random() * 2 - 1) * p);
		};
		canvas.app.ticker.add(tick);
	});
	// the camera may have panned meanwhile; only undo our jitter if it hasn't
	if (Math.abs(stage.pivot.x - ox) < power * 2 && Math.abs(stage.pivot.y - oy) < power * 2) stage.pivot.set(ox, oy);
}

/* ------------------------------------------------------------------ */
/*  Idle hover                                                         */
/* ------------------------------------------------------------------ */

/** Combatants on the viewed scene hover gently while a conflict is running */
export function refreshBobbing() {
	const combat = game.combat;
	const want = new Set();
	if (getSetting('idleBob') !== false && combat?.started && canvas?.ready && combat.scene?.id === canvas.scene?.id) {
		for (const c of combat.combatants) {
			if (c.tokenId && !c.isDefeated) want.add(c.tokenId);
		}
	}
	for (const id of [...bobbing.keys()]) if (!want.has(id)) bobbing.delete(id);
	let i = 0;
	for (const id of want) {
		if (!bobbing.has(id)) bobbing.set(id, (i++ * 1.7) % (Math.PI * 2));
	}
	if (want.size) ensureTicker();
	else {
		// settle the meshes back exactly
		motionTick();
	}
}

export { wait, ease };
