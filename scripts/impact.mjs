import { ELEMENT_LOOK, getSetting } from './presets.mjs';
import { now, wait } from './clock.mjs';
import { center, ease, tweenOffset } from './player.mjs';

/**
 * Game feel: the things that make a hit land. Wind-ups, afterimages, hit flashes, debris, scorch marks,
 * camera pushes, background dimming with the fighters spotlit, punchy damage numbers, and cut-ins.
 */

const rand = (a, b) => a + Math.random() * (b - a);
const g = () => canvas.grid.size;

let fxLayer = null;
let underLayer = null;
let dimLayer = null;
let numLayer = null;

/** Layers inside the canvas: scorch marks under everything we draw, a dimmer, and a top layer for particles */
function layers() {
	const parent = canvas.interface ?? canvas.stage;
	if (!fxLayer || fxLayer.destroyed || !fxLayer.parent) {
		underLayer = new PIXI.Container();
		dimLayer = new PIXI.Container();
		fxLayer = new PIXI.Container();
		numLayer = new PIXI.Container();
		underLayer.zIndex = 9990;
		dimLayer.zIndex = 9995;
		fxLayer.zIndex = 10010;
		numLayer.zIndex = 10030;
		for (const l of [underLayer, dimLayer, fxLayer, numLayer]) l.eventMode = 'none';
		// ground marks sit with the scene objects, above tiles and below tokens
		const ground = canvas.primary;
		if (ground) {
			Object.assign(underLayer, { elevation: 0, sortLayer: 650, sort: 0, zIndex: -1 });
			ground.addChild(underLayer);
			ground.sortableChildren = true;
			ground.sortChildren?.();
		} else parent.addChild(underLayer);
		for (const l of [dimLayer, fxLayer, numLayer]) parent.addChild(l);
		parent.sortableChildren = true;
		parent.sortChildren?.();
	}
	return { fxLayer, underLayer, dimLayer, numLayer };
}

export function resetImpactLayers() {
	fxLayer = underLayer = dimLayer = numLayer = null;
}

function tick(fn) {
	canvas.app.ticker.add(fn);
	return () => canvas.app.ticker.remove(fn);
}

function run(ms, step) {
	return new Promise((resolve) => {
		const start = now();
		const stop = tick(() => {
			const t = Math.min(1, (now() - start) / ms);
			step(t);
			if (t >= 1) {
				stop();
				resolve();
			}
		});
	});
}

const colorOf = (element) => (ELEMENT_LOOK[element] ?? ELEMENT_LOOK.none).color;

/* ------------------------------------------------------------------ */
/*  Bodies                                                             */
/* ------------------------------------------------------------------ */

/** Crouch and pull back before an attack */
export async function anticipate(token, ux, uy, ms = 220) {
	const mesh = token.mesh;
	const sx = mesh?.scale?.x ?? 1;
	const sy = mesh?.scale?.y ?? 1;
	const back = tweenOffset(token, { x: -ux * g() * 0.18, y: -uy * g() * 0.18 }, ms, ease.out);
	if (mesh) {
		await run(ms, (t) => {
			const k = Math.sin(Math.PI * Math.min(1, t * 1.2)) * 0.08;
			mesh.scale.set(sx * (1 + k), sy * (1 - k));
		});
		mesh.scale.set(sx, sy);
	}
	await back;
}

/** Ghost copies trailing a moving token */
export function afterimages(token, ms = 400, color = 0xbfe2ff) {
	const mesh = token.mesh;
	if (!mesh?.texture) return () => {};
	const { underLayer: L } = layers();
	let last = 0;
	const ghosts = [];
	const stop = tick(() => {
		const t = now();
		if (t - last > 28) {
			last = t;
			const s = new PIXI.Sprite(mesh.texture);
			s.anchor.set(mesh.anchor?.x ?? 0.5, mesh.anchor?.y ?? 0.5);
			s.position.set(mesh.x, mesh.y);
			s.scale.set(mesh.scale.x, mesh.scale.y);
			s.rotation = mesh.rotation ?? 0;
			s.tint = color;
			s.alpha = 0.6;
			s.blendMode = PIXI.BLEND_MODES.ADD;
			L.addChild(s);
			ghosts.push({ s, born: t });
		}
		for (let i = ghosts.length - 1; i >= 0; i--) {
			const age = (t - ghosts[i].born) / 260;
			if (age >= 1) {
				ghosts[i].s.destroy();
				ghosts.splice(i, 1);
			} else ghosts[i].s.alpha = 0.6 * (1 - age);
		}
	});
	const end = () => {
		stop();
		const fade = tick(() => {
			const t = now();
			for (let i = ghosts.length - 1; i >= 0; i--) {
				const age = (t - ghosts[i].born) / 260;
				if (age >= 1) {
					ghosts[i].s.destroy();
					ghosts.splice(i, 1);
				} else ghosts[i].s.alpha = 0.6 * (1 - age);
			}
			if (!ghosts.length) fade();
		});
	};
	if (ms) setTimeout(end, ms);
	return end;
}

/** Flash a token white for a beat */
export function flashToken(token, ms = 110) {
	const mesh = token.mesh;
	const Filter = PIXI.ColorMatrixFilter ?? PIXI.filters?.ColorMatrixFilter;
	if (!mesh || !Filter) return Promise.resolve();
	const f = new Filter();
	// keep alpha, push every color to white
	f.matrix = [0.5, 0, 0, 0, 0.55, 0, 0.5, 0, 0, 0.55, 0, 0, 0.5, 0, 0.55, 0, 0, 0, 1, 0];
	const before = mesh.filters;
	mesh.filters = [...(before ?? []), f];
	return wait(ms).then(() => {
		f.matrix = [1, 0, 0, 0, 0.6, 0, 1, 0, 0, 0.3, 0, 0, 1, 0, 0.3, 0, 0, 0, 1, 0];
		return wait(60);
	}).then(() => {
		mesh.filters = (mesh.filters ?? []).filter((x) => x !== f);
		if (!mesh.filters.length) mesh.filters = before ?? null;
	});
}

/** Stagger: a quick shudder on the spot */
export async function stagger(token, power = 1) {
	const amp = g() * 0.05 * power;
	await run(260, (t) => {
		const k = (1 - t) * amp;
		token.mesh && (token.mesh.rotation = Math.sin(t * 40) * 0.06 * (1 - t) * power);
		void k;
	});
	if (token.mesh) token.mesh.rotation = 0;
}

/* ------------------------------------------------------------------ */
/*  Particles and marks                                                */
/* ------------------------------------------------------------------ */

/** Sparks, embers or chips flying out of an impact, with gravity */
export function debris(at, { color = 0xfff1c4, count = 18, power = 1, dir = null, kind = 'spark' } = {}) {
	const { fxLayer: L } = layers();
	const gr = new PIXI.Graphics();
	gr.blendMode = kind === 'chip' ? PIXI.BLEND_MODES.NORMAL : PIXI.BLEND_MODES.ADD;
	L.addChild(gr);
	const ps = Array.from({ length: count }, () => {
		let a = rand(0, Math.PI * 2);
		if (dir != null) a = dir + rand(-0.9, 0.9);
		const sp = rand(0.6, 1.4) * power * g() * 4;
		return { x: at.x, y: at.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - g() * rand(0.5, 2), life: rand(0.35, 0.8), r: rand(0.015, 0.04) * g() };
	});
	let last = now();
	const start = last;
	return new Promise((resolve) => {
		const stop = tick(() => {
			const t = now();
			const dt = Math.min(0.05, (t - last) / 1000);
			last = t;
			gr.clear();
			let alive = 0;
			for (const p of ps) {
				const age = (t - start) / 1000 / p.life;
				if (age >= 1) continue;
				alive++;
				p.vy += g() * 9 * dt;
				p.vx *= 0.96;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				const a = 1 - age;
				if (kind === 'spark') {
					gr.lineStyle(p.r, color, a).moveTo(p.x, p.y).lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
				} else {
					gr.lineStyle(0).beginFill(color, a).drawCircle(p.x, p.y, p.r * (kind === 'ember' ? 1.2 : 1.6)).endFill();
				}
			}
			if (!alive) {
				stop();
				gr.destroy();
				resolve();
			}
		});
	});
}

/** Expanding white ring on contact */
export function impactRing(at, { color = 0xffffff, size = 1, ms = 260 } = {}) {
	const { fxLayer: L } = layers();
	const gr = new PIXI.Graphics();
	gr.blendMode = PIXI.BLEND_MODES.ADD;
	L.addChild(gr);
	return run(ms, (t) => {
		gr.clear();
		const r = g() * size * (0.2 + ease.out(t) * 0.9);
		gr.lineStyle(g() * 0.12 * (1 - t) * size, color, 0.9 * (1 - t)).drawCircle(at.x, at.y, r);
	}).then(() => gr.destroy());
}

/** A big flash of light behind the hit, a frame or two long */
export function burstFlash(at, { color = 0xffffff, size = 1.6 } = {}) {
	const { fxLayer: L } = layers();
	const gr = new PIXI.Graphics();
	gr.blendMode = PIXI.BLEND_MODES.ADD;
	L.addChild(gr);
	return run(160, (t) => {
		gr.clear();
		const f = (1 - t) * (1 - t);
		for (let i = 3; i >= 0; i--) gr.beginFill(i ? color : 0xffffff, (i ? 0.14 : 0.35) * f).drawCircle(at.x, at.y, g() * size * (0.18 + i * 0.22) * (1 + t * 0.4)).endFill();
		// light streaks
		gr.lineStyle(g() * 0.04 * (1 - t), 0xffffff, 1 - t);
		for (let i = 0; i < 6; i++) {
			const a = (i / 6) * Math.PI * 2 + 0.3;
			gr.moveTo(at.x + Math.cos(a) * g() * 0.2, at.y + Math.sin(a) * g() * 0.2).lineTo(at.x + Math.cos(a) * g() * size * 1.1, at.y + Math.sin(a) * g() * size * 1.1);
		}
	}).then(() => gr.destroy());
}

/** A mark left on the ground that fades out */
/** A dark mark on the ground; at is where the target stands (its feet) */
export function scorch(at, { color = 0x1a0d06, size = 1, ms = 2600 } = {}) {
	const { underLayer: L } = layers();
	const gr = new PIXI.Graphics();
	L.addChild(gr);
	const blobs = Array.from({ length: 7 }, () => ({ x: rand(-0.35, 0.35), y: rand(-0.15, 0.2), r: rand(0.18, 0.35) }));
	return run(ms, (t) => {
		gr.clear();
		const a = t < 0.1 ? t / 0.1 : 1 - Math.max(0, (t - 0.5) / 0.5);
		for (const b of blobs) gr.beginFill(color, 0.32 * a).drawEllipse(at.x + b.x * g() * size, at.y + b.y * g() * size * 0.5, b.r * g() * size, b.r * g() * size * 0.45).endFill();
	}).then(() => gr.destroy());
}

/* ------------------------------------------------------------------ */
/*  Camera and screen                                                  */
/* ------------------------------------------------------------------ */

/** Lean the camera toward a point, then settle back */
export async function cameraPush(point, { zoom = 1.12, inMs = 180, hold = 300, outMs = 420 } = {}) {
	if (getSetting('camera') === false || !canvas?.stage || !zoom || zoom === 1) return;
	const stage = canvas.stage;
	const from = { x: stage.pivot.x, y: stage.pivot.y, s: stage.scale.x };
	const to = { x: from.x + (point.x - from.x) * 0.35, y: from.y + (point.y - from.y) * 0.35, s: from.s * zoom };
	// Foundry: go through the camera so the rest of the canvas follows; stay put if the player pans meanwhile
	if (typeof canvas.animatePan === 'function') {
		await canvas.animatePan({ x: to.x, y: to.y, scale: to.s, duration: inMs });
		await wait(hold);
		const moved = Math.abs(stage.pivot.x - to.x) > 2 || Math.abs(stage.pivot.y - to.y) > 2 || Math.abs(stage.scale.x - to.s) > 0.01;
		if (!moved) await canvas.animatePan({ x: from.x, y: from.y, scale: from.s, duration: outMs });
		return;
	}
	const set = (k) => {
		stage.pivot.set(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
		const s = from.s + (to.s - from.s) * k;
		stage.scale.set(s, s);
	};
	await run(inMs, (t) => set(ease.out(t)));
	await wait(hold);
	await run(outMs, (t) => set(1 - ease.inOut(t)));
}

/** Hard kick of the whole view */
export async function shake(power = 1, ms = 260) {
	if (getSetting('shake') === false || !canvas?.stage) return;
	const stage = canvas.stage;
	let ox = 0;
	let oy = 0;
	await run(ms, (t) => {
		const p = g() * 0.08 * power * (1 - t) * (1 - t);
		stage.pivot.x -= ox;
		stage.pivot.y -= oy;
		ox = rand(-1, 1) * p;
		oy = rand(-1, 1) * p;
		stage.pivot.x += ox;
		stage.pivot.y += oy;
	});
	stage.pivot.x -= ox;
	stage.pivot.y -= oy;
}

/**
 * Darken everything except the fighters. Returns a function that brings the light back.
 * @param {Token[]} spotlit tokens drawn above the dark
 */
export function dimScene(spotlit = [], { alpha = 0.6, ms = 220 } = {}) {
	const { dimLayer: L } = layers();
	const rect = new PIXI.Graphics();
	const d = canvas.dimensions ?? { width: canvas.app.screen.width * 4, height: canvas.app.screen.height * 4 };
	rect.beginFill(0x02040a, 1).drawRect(-d.width, -d.height, d.width * 3, d.height * 3).endFill();
	rect.alpha = 0;
	L.addChild(rect);
	const copies = spotlit
		.filter((t) => t?.mesh?.texture && t.visible !== false && !t.document?.hidden)
		.map((t) => {
			const s = new PIXI.Sprite(t.mesh.texture);
			s.anchor.set(t.mesh.anchor?.x ?? 0.5, t.mesh.anchor?.y ?? 0.5);
			L.addChild(s);
			return { s, t };
		});
	const follow = tick(() => {
		for (const { s, t } of copies) {
			s.position.set(t.mesh.x, t.mesh.y);
			s.scale.set(t.mesh.scale.x, t.mesh.scale.y);
			s.rotation = t.mesh.rotation ?? 0;
			s.filters = t.mesh.filters;
			s.alpha = rect.alpha / alpha;
		}
	});
	run(ms, (t) => (rect.alpha = alpha * ease.out(t)));
	return async (outMs = 320) => {
		const a0 = rect.alpha;
		await run(outMs, (t) => (rect.alpha = a0 * (1 - t)));
		follow();
		rect.destroy();
		for (const { s } of copies) s.destroy();
	};
}

/** Power gathering on a caster: lifts a little, motes rise around it */
export async function gather(token, { color = 0xffd9a0, ms = 450, lift = 0.16 } = {}) {
	const c = center(token);
	const r = Math.max(token.w ?? g(), token.h ?? g()) / 2;
	const up = tweenOffset(token, { x: 0, y: -g() * lift }, ms, ease.out);
	const n = Math.max(2, Math.round(ms / 110));
	for (let i = 0; i < n; i++) {
		debris({ x: c.x + rand(-r, r) * 0.7, y: c.y + r * 0.6 }, { color, count: 7, power: 0.35, kind: 'ember' });
		await wait(ms / n);
	}
	await up;
	return () => tweenOffset(token, { x: 0, y: 0 }, 280, ease.inOut);
}

/** Whole-view flash of light */
export function screenFlash(color = 0xffffff, alpha = 0.5, ms = 180) {
	const { fxLayer: L } = layers();
	const d = canvas.dimensions ?? { width: canvas.app.screen.width * 4, height: canvas.app.screen.height * 4 };
	const gr = new PIXI.Graphics();
	gr.beginFill(color, 1).drawRect(-d.width, -d.height, d.width * 3, d.height * 3).endFill();
	gr.blendMode = PIXI.BLEND_MODES.ADD;
	gr.alpha = alpha;
	L.addChild(gr);
	return run(ms, (t) => (gr.alpha = alpha * (1 - t) * (1 - t))).then(() => gr.destroy());
}

/** Warning circle that tightens on the spot where something is about to land */
export function telegraph(at, { color = 0xffffff, size = 1.5, ms = 600 } = {}) {
	const { fxLayer: L } = layers();
	const gr = new PIXI.Graphics();
	gr.blendMode = PIXI.BLEND_MODES.ADD;
	L.addChild(gr);
	return run(ms, (t) => {
		gr.clear();
		const r = g() * size * (1.8 - ease.out(t) * 0.8);
		const a = Math.min(1, t * 2.5);
		gr.beginFill(color, 0.16 * a).drawEllipse(at.x, at.y, r, r * 0.5).endFill();
		gr.lineStyle(g() * 0.05, color, a);
		const spin = t * 2.4;
		for (let i = 0; i < 8; i++) {
			const a0 = spin + (i / 8) * Math.PI * 2;
			const pts = 6;
			for (let j = 0; j <= pts; j++) {
				const aa = a0 + (j / pts) * 0.45;
				const px = at.x + Math.cos(aa) * r;
				const py = at.y + Math.sin(aa) * r * 0.5;
				j ? gr.lineTo(px, py) : gr.moveTo(px, py);
			}
		}
	}).then(() => gr.destroy());
}

/**
 * A blazing body with a tapered tail and shedding embers. Used for fireballs, comets, big bolts.
 * Resolves on arrival; the tail and embers finish fading on their own.
 */
export function blazingProjectile(from, to, { color = 0xff7a2a, glow = null, size = 0.4, ms = 420, arc = 0, fall = false, embers = 3 } = {}) {
	const { fxLayer: L } = layers();
	const gr = new PIXI.Graphics();
	gr.blendMode = PIXI.BLEND_MODES.ADD;
	L.addChild(gr);
	const R = g() * size;
	const outer = glow ?? color;
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const len = Math.hypot(dx, dy) || 1;
	const nx = -dy / len;
	const ny = dx / len;
	const trail = [];
	const parts = [];
	let last = now();
	const start = last;
	let arrived = null;
	return new Promise((resolve) => {
		const stop = tick(() => {
			const tn = now();
			const dt = Math.min(0.05, (tn - last) / 1000);
			last = tn;
			const t = Math.min(1, (tn - start) / ms);
			const k = fall ? Math.pow(t, fall === true ? 2 : fall) : t;
			const bend = Math.sin(Math.PI * k) * arc * g();
			const hx = from.x + dx * k + nx * bend;
			const hy = from.y + dy * k + ny * bend;
			if (!arrived) {
				trail.push({ x: hx, y: hy, born: tn });
				for (let i = 0; i < embers; i++) {
					const a = Math.atan2(-dy, -dx) + rand(-0.7, 0.7);
					const sp = rand(0.4, 1.4) * g();
					parts.push({ x: hx + rand(-R, R) * 0.5, y: hy + rand(-R, R) * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, born: tn, life: rand(180, 420), r: rand(0.25, 0.55) * R * 0.35 });
				}
			}
			const tailMs = 200 + size * 220;
			while (trail.length && tn - trail[0].born > tailMs) trail.shift();
			gr.clear();
			// tail, tapering away from the head
			for (let i = 0; i < trail.length; i++) {
				const p = trail[i];
				const f = 1 - (tn - p.born) / tailMs;
				gr.beginFill(outer, 0.22 * f).drawCircle(p.x, p.y, R * (0.35 + f * 0.95)).endFill();
				gr.beginFill(color, 0.35 * f * f).drawCircle(p.x, p.y, R * 0.55 * f).endFill();
			}
			// embers
			for (let i = parts.length - 1; i >= 0; i--) {
				const p = parts[i];
				const age = (tn - p.born) / p.life;
				if (age >= 1) {
					parts.splice(i, 1);
					continue;
				}
				p.vy += g() * 2.5 * dt;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				gr.beginFill(color, 0.9 * (1 - age)).drawCircle(p.x, p.y, p.r * (1 - age * 0.5)).endFill();
			}
			// head
			if (!arrived) {
				const fl = 1 + Math.sin(tn / 18) * 0.07;
				gr.beginFill(outer, 0.18).drawCircle(hx, hy, R * 2.1 * fl).endFill();
				gr.beginFill(outer, 0.35).drawCircle(hx, hy, R * 1.35 * fl).endFill();
				gr.beginFill(color, 0.8).drawCircle(hx, hy, R * 0.95 * fl).endFill();
				gr.beginFill(0xffffff, 0.95).drawCircle(hx, hy, R * 0.5).endFill();
			}
			if (t >= 1 && !arrived) {
				arrived = tn;
				resolve();
			}
			if (arrived && !trail.length && !parts.length) {
				stop();
				gr.destroy();
			}
		});
	});
}

/* ------------------------------------------------------------------ */
/*  Numbers                                                            */
/* ------------------------------------------------------------------ */

/** Damage number that slams in, overshoots, bounces and floats away */
/** token id -> stack slots in use, so a MISS and a hit (or several hits) sit one above the other */
const numberSlots = new Map();

const NUMBER_LOOK = {
	miss: { color: 0xbcd0ff, size: 0.36 },
	immune: { color: 0xc9cfdd, size: 0.36 },
	weak: { color: 0xffa25e, size: 0.52 },
	resist: { color: 0xb7c3db, size: 0.44 },
};

/**
 * @param {Token} token
 * @param {string} text
 * @param {{crit?:boolean, heal?:boolean, sub?:string, kind?:'miss'|'immune'|'weak'|'resist'|''}} [opts]
 */
export function damageNumber(token, text, { crit = false, heal = false, sub = '', kind = '' } = {}) {
	const { numLayer: L } = layers();
	const c = center(token);
	const used = numberSlots.get(token.id) ?? new Set();
	let slot = 0;
	while (used.has(slot)) slot++;
	used.add(slot);
	numberSlots.set(token.id, used);
	const lift = slot * g() * 0.42;
	const look = NUMBER_LOOK[kind] ?? null;
	const box = new PIXI.Container();
	box.position.set(c.x, c.y - g() * 0.35 - lift);
	const color = heal ? 0x7dffb0 : crit ? 0xffd34d : (look?.color ?? 0xffffff);
	const num = new PIXI.Text(text, {
		fontFamily: 'FBUI Antonio, Antonio, Arial Black, Arial',
		fontWeight: '700',
		fontSize: g() * (crit ? 0.62 : (look?.size ?? 0.48)),
		fill: color,
		stroke: 0x10060a,
		strokeThickness: g() * 0.07,
		dropShadow: true,
		dropShadowColor: crit ? 0xff6a00 : 0x000000,
		dropShadowBlur: g() * 0.08,
		dropShadowDistance: 0,
	});
	num.anchor.set(0.5);
	box.addChild(num);
	if (sub || crit) {
		const s = new PIXI.Text(sub || 'CRITICAL', { fontFamily: 'FBUI Antonio, Antonio, Arial Black, Arial', fontWeight: '700', fontSize: g() * 0.2, fill: crit ? 0xffb347 : 0xd9e6ff, stroke: 0x10060a, strokeThickness: g() * 0.04, letterSpacing: g() * 0.02 });
		s.anchor.set(0.5);
		s.y = -g() * 0.42;
		box.addChild(s);
	}
	L.addChild(box);
	const side = slot ? 0 : rand(-0.25, 0.25);
	return run(1150, (t) => {
		const pop = t < 0.12 ? ease.back(t / 0.12) * (crit ? 1.5 : 1.25) : t < 0.22 ? 1.25 - (t - 0.12) * 2 : 1;
		box.scale.set(Math.max(0.01, pop));
		box.x = c.x + side * g() * t;
		box.y = c.y - g() * 0.35 - lift - g() * 0.55 * ease.out(t);
		box.alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
	}).then(() => {
		box.destroy({ children: true });
		used.delete(slot);
		if (!used.size) numberSlots.delete(token.id);
	});
}

/* ------------------------------------------------------------------ */
/*  Cut-in                                                             */
/* ------------------------------------------------------------------ */

/**
 * Full-screen cut-in for big moves: dark band, portrait sweeping across, move name.
 * Plain DOM over the canvas, so it looks the same at any zoom. kind 'limit' is the limit-break version: a
 * shattering white flash, two crossing bands and a kicker ("ZERO POWER"); 'boss' is red and heavier.
 */
export function cutIn({ name, user, img, color = '#f2c45a', ms = 1250, force = false, kind = '', kicker = '' }) {
	if (!force && getSetting('cutins') === false) return Promise.resolve();
	const el = document.createElement('div');
	el.className = `fua-cutin ${kind}`;
	el.style.setProperty('--c', color);
	el.style.setProperty('--ms', `${ms}ms`);
	const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
	el.innerHTML = `
		<div class="veil"></div>
		${kind === 'limit' ? '<div class="flash"></div><div class="band back"></div><div class="rays"></div>' : ''}
		<div class="band">
			<div class="streaks"></div>
			${img ? `<img class="por" src="${esc(img)}" alt="">` : ''}
			<div class="txt">${kicker ? `<em>${esc(kicker)}</em>` : ''}<small>${esc(user)}</small><b>${esc(name)}</b></div>
		</div>`;
	document.body.appendChild(el);
	return new Promise((resolve) => {
		setTimeout(() => el.classList.add('out'), ms - 280);
		setTimeout(() => {
			el.remove();
			resolve();
		}, ms);
	});
}

/* ------------------------------------------------------------------ */
/*  Limit breaks and bosses                                            */
/* ------------------------------------------------------------------ */

/** Cinema bars top and bottom of the screen. Returns a function that slides them away */
export function letterbox(ms = 380) {
	const el = document.createElement('div');
	el.className = 'fua-bars';
	el.style.setProperty('--ms', `${ms}ms`);
	el.innerHTML = '<i></i><i></i>';
	document.body.appendChild(el);
	requestAnimationFrame(() => el.classList.add('in'));
	return (outMs = 420) =>
		new Promise((resolve) => {
			el.style.setProperty('--ms', `${outMs}ms`);
			el.classList.remove('in');
			setTimeout(() => {
				el.remove();
				resolve();
			}, outMs + 30);
		});
}

/** A magic circle on the ground: two turning rings, runes, a star. Returns a function that fades it */
export function runeCircle(at, { color = 0xffd9a0, size = 1.6, spin = 1 } = {}) {
	const { underLayer, dimLayer } = layers();
	const gr = new PIXI.Graphics();
	gr.blendMode = PIXI.BLEND_MODES.ADD;
	// while the scene is darkened, glow above the dark but under the spotlit fighters; else on the ground
	if (dimLayer.children.length) dimLayer.addChildAt(gr, 1);
	else underLayer.addChild(gr);
	const R = g() * size;
	let alpha = 0;
	let target = 1;
	let done = null;
	const start = now();
	const stop = tick(() => {
		const t = (now() - start) / 1000;
		alpha += (target - alpha) * 0.12;
		const grow = Math.min(1, t * 2.5);
		const r = R * (0.4 + 0.6 * ease.out(grow));
		gr.clear();
		const ell = (rad, w, a) => gr.lineStyle(w, color, a * alpha).drawEllipse(at.x, at.y, rad, rad * 0.5);
		ell(r, g() * 0.05, 0.9);
		ell(r * 0.86, g() * 0.025, 0.7);
		ell(r * 0.5, g() * 0.03, 0.6);
		// runes between the outer rings
		const n = 16;
		for (let i = 0; i < n; i++) {
			const a = t * 0.9 * spin + (i / n) * Math.PI * 2;
			const x = at.x + Math.cos(a) * r * 0.93;
			const y = at.y + Math.sin(a) * r * 0.93 * 0.5;
			gr.lineStyle(g() * 0.025, color, 0.85 * alpha).moveTo(x - g() * 0.04, y).lineTo(x + g() * 0.04, y - g() * 0.05);
		}
		// a six-pointed star (two triangles), turning the other way
		gr.lineStyle(g() * 0.03, color, 0.75 * alpha);
		for (const off of [0, Math.PI / 3]) {
			for (let i = 0; i <= 3; i++) {
				const aa = -t * 0.6 * spin + off + (i / 3) * Math.PI * 2;
				const x = at.x + Math.cos(aa) * r * 0.84;
				const y = at.y + Math.sin(aa) * r * 0.84 * 0.5;
				i ? gr.lineTo(x, y) : gr.moveTo(x, y);
			}
		}
		gr.beginFill(color, 0.08 * alpha).drawEllipse(at.x, at.y, r, r * 0.5).endFill();
		if (done && alpha < 0.02) {
			stop();
			gr.destroy();
			done();
		}
	});
	return () =>
		new Promise((resolve) => {
			target = 0;
			done = resolve;
		});
}

/** Anime focus lines rushing toward a point. Returns a function that stops them */
export function focusLines(at, { color = 0xffffff, alpha = 0.32 } = {}) {
	const { fxLayer: L } = layers();
	const gr = new PIXI.Graphics();
	L.addChild(gr);
	let fade = 1;
	let ending = false;
	let resolveEnd = null;
	const stop = tick(() => {
		gr.clear();
		if (ending) fade -= 0.08;
		if (fade <= 0) {
			stop();
			gr.destroy();
			resolveEnd?.();
			return;
		}
		for (let i = 0; i < 46; i++) {
			const a = Math.random() * Math.PI * 2;
			const r0 = g() * rand(3.2, 5.5);
			const r1 = g() * rand(9, 14);
			const w = rand(0.004, 0.02);
			gr.beginFill(color, alpha * fade * rand(0.4, 1));
			gr.moveTo(at.x + Math.cos(a) * r0, at.y + Math.sin(a) * r0);
			gr.lineTo(at.x + Math.cos(a - w) * r1, at.y + Math.sin(a - w) * r1);
			gr.lineTo(at.x + Math.cos(a + w) * r1, at.y + Math.sin(a + w) * r1);
			gr.closePath().endFill();
		}
	});
	return () =>
		new Promise((resolve) => {
			ending = true;
			resolveEnd = resolve;
		});
}

/**
 * Charging a limit break: a magic circle under the user, a pillar of light rising, motes spiralling in, the
 * user lifting and trembling. Resolves when it peaks, with a function that brings the user back down.
 */
export async function chargeUp(token, { color = 0xffd9a0, ms = 1600 } = {}) {
	const c = center(token);
	const r = Math.max(token.w ?? g(), token.h ?? g()) / 2;
	const feet = { x: c.x, y: c.y + r * 0.85 };
	const circle = runeCircle(feet, { color, size: Math.max(1.4, (r / g()) * 2.6) });
	const lines = focusLines(c, { color: 0xffffff });
	const { fxLayer: L } = layers();
	const pillar = new PIXI.Graphics();
	pillar.blendMode = PIXI.BLEND_MODES.ADD;
	L.addChild(pillar);
	const motes = [];
	const up = tweenOffset(token, { x: 0, y: -g() * 0.22 }, ms * 0.6, ease.out);
	const mesh = token.mesh;
	const jit = { x: 0, y: 0 };
	await run(ms, (t) => {
		// pillar: grows wider and brighter, flickers
		pillar.clear();
		const w = r * (0.3 + 1.1 * ease.in(t)) * rand(0.92, 1.08);
		const h = g() * (2.5 + 3 * ease.out(t));
		// soft sides (nested columns) and a top that fades out (stacked slices)
		const SL = 8;
		for (let i = 4; i >= 0; i--) {
			const k = 1 + i * 0.45;
			for (let j = 0; j < SL; j++) {
				const fade = 1 - j / SL;
				pillar.beginFill(i ? color : 0xffffff, (i ? 0.09 : 0.3) * fade * Math.min(1, t * 3)).drawRect(c.x - (w * k) / 2, feet.y - (h * (j + 1)) / SL, w * k, h / SL).endFill();
			}
		}
		// motes: born on a wide ring, spiral in
		if (Math.random() < 0.9) for (let i = 0; i < 3; i++) motes.push({ a: Math.random() * Math.PI * 2, d: g() * rand(2, 3.4), s: rand(1.6, 3) });
		for (let i = motes.length - 1; i >= 0; i--) {
			const m = motes[i];
			m.d -= g() * 0.06 * m.s;
			m.a += 0.06 * m.s;
			if (m.d <= r * 0.25) {
				motes.splice(i, 1);
				continue;
			}
			pillar.beginFill(i % 3 ? color : 0xffffff, 0.9).drawCircle(c.x + Math.cos(m.a) * m.d, c.y + Math.sin(m.a) * m.d * 0.6, g() * 0.035 * m.s).endFill();
		}
		// tremble harder as it peaks (each frame undoes the last jitter, so nothing drifts)
		if (mesh) {
			const p = g() * 0.02 * t * t;
			mesh.x -= jit.x;
			mesh.y -= jit.y;
			jit.x = rand(-p, p);
			jit.y = rand(-p, p);
			mesh.x += jit.x;
			mesh.y += jit.y;
		}
	});
	if (mesh) {
		mesh.x -= jit.x;
		mesh.y -= jit.y;
	}
	await up;
	// the pillar flares and goes
	run(260, (t) => {
		pillar.clear();
		pillar.beginFill(0xffffff, 0.6 * (1 - t)).drawRect(c.x - r * 1.6 * (1 + t), feet.y - g() * 6, r * 3.2 * (1 + t), g() * 6).endFill();
	}).then(() => pillar.destroy());
	lines();
	return () => {
		circle();
		return tweenOffset(token, { x: 0, y: 0 }, 420, ease.inOut);
	};
}

/** Rings of force rolling out from a point, one after another */
export async function shockwaves(at, { color = 0xffffff, size = 2, count = 3, gap = 140 } = {}) {
	const jobs = [];
	for (let i = 0; i < count; i++) {
		jobs.push(impactRing(at, { color: i % 2 ? 0xffffff : color, size: size * (1 + i * 0.55), ms: 420 + i * 120 }));
		await wait(gap);
	}
	return Promise.all(jobs);
}

/** Embers and light drifting up from where a limit break landed */
export async function aftermath(points, { color = 0xffd9a0, ms = 1500 } = {}) {
	const n = Math.round(ms / 160);
	for (let i = 0; i < n; i++) {
		for (const p of points) debris({ x: p.x + rand(-0.4, 0.4) * g(), y: p.y + g() * 0.3 }, { color: i % 2 ? color : 0xffffff, count: 4, power: 0.3, kind: 'ember' });
		await wait(160);
	}
}

/** A boss winding up: a red flare and a circle at its feet */
export async function menace(token, { color = 0xff3b4e, ms = 520 } = {}) {
	const c = center(token);
	const r = Math.max(token.w ?? g(), token.h ?? g()) / 2;
	const circle = runeCircle({ x: c.x, y: c.y + r * 0.85 }, { color, size: Math.max(1.1, (r / g()) * 2), spin: -1.6 });
	burstFlash(c, { color, size: 0.8 + r / g() });
	const settle = await gather(token, { color, ms, lift: 0.1 });
	return () => {
		circle();
		settle();
	};
}

export { colorOf };
