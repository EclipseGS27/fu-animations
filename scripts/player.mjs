import { ELEMENT_LOOK, getSetting } from './presets.mjs';
import { now, wait } from './clock.mjs';
import { isJb, jbDuration, playJb, preloadJb } from './jb2a.mjs';
import { isPixel, pixelDuration, playPixel } from './pixel.mjs';

/**
 * Canvas side: playing effects (pixel art or JB2A) and visual-only token motion (lunges, knockback, dodges, idle hover).
 * Nothing here writes to documents; every client plays the same plan on its own canvas.
 */

const ease = {
	linear: (t) => t,
	in: (t) => t * t,
	out: (t) => 1 - (1 - t) * (1 - t),
	inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
	back: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
};

/** Get JB2A videos ready before a move starts (pixel effects need nothing) */
export function preload(ids) {
	return preloadJb([...new Set(ids.filter(Boolean))].filter(isJb));
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
 * Play one effect at a point: a pixel effect, or a JB2A video.
 * @param {string} id effect id
 * @param {{x:number,y:number,rotation?:number,scale?:number,element?:string,alpha?:number,flip?:boolean,tokenSize?:number}} at
 * @returns {Promise<void>} resolves when the effect ends
 */
export async function playFx(id, at) {
	if (isJb(id)) return playJb(id, at);
	if (isPixel(id)) return playPixel(id, at);
}

export function fxDuration(id) {
	if (isJb(id)) return jbDuration(id);
	if (isPixel(id)) return pixelDuration(id);
	return 0;
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
