import { getSetting } from './presets.mjs';
import { now } from './clock.mjs';
import { tokenArtBox } from './pixel.mjs';

/**
 * Conditions you can see on the map: while a token has a status, a small looping pixel-art effect plays on it and
 * its sprite takes on a tint. Several tints take turns. Everything follows the token's own image, so it moves
 * with the hover, dashes and knockbacks.
 *
 *   poisoned  green bubbles rising off it, green tint
 *   dazed     stars circling over its head
 *   shaken    trembling lines either side and a sweat drop
 *   slow      slow ripples spreading at its feet, cold tint
 *   weak      arrows sinking past it, drained tint
 *   enraged   a throbbing anger mark, red tint
 *   sleep     Zs floating up
 */

/* tiny pixel sprites: '#' main color, 'o' highlight, '.' empty */
const ART = {
	bubble: ['.##.', '#o.#', '#..#', '.##.'],
	star: ['..#..', '.###.', '##o##', '.###.', '.#.#.'],
	drop: ['.#.', '.#.', '#o#', '###', '.#.'],
	arrow: ['.###.', '.###.', '#####', '.###.', '..#..'],
	anger: ['.#...#.', '##...##', '.......', '.......', '.......', '##...##', '.#...#.'],
	z: ['####', '..#.', '.#..', '####'],
	shakeL: ['.#', '#.', '#.', '.#'],
	shakeR: ['#.', '.#', '.#', '#.'],
};

/** what each status looks like */
const LOOKS = {
	poisoned: { tint: 0x7fe05a, strength: 0.32, color: 0x8ee65a, light: 0xd8ffb0, draw: bubbles },
	dazed: { color: 0xffe14d, light: 0xffffff, draw: stars },
	shaken: { color: 0x9fd0ff, light: 0xffffff, draw: shaken },
	slow: { tint: 0x6fb4ff, strength: 0.28, color: 0x8fd8ff, draw: ripples },
	weak: { tint: 0x9a8fb8, strength: 0.42, desat: true, color: 0xc7a6ff, light: 0xf0e6ff, draw: sinking },
	enraged: { tint: 0xff4a4a, strength: 0.38, color: 0xff5a5a, light: 0xffd0d0, draw: anger },
	sleep: { tint: 0x5a6aa8, strength: 0.18, color: 0xbfd6ff, light: 0xffffff, draw: zzz },
};
const TINT_CYCLE = 1.6;

/** tokenId -> { box, g, filter, ids } */
const states = new Map();
let layer = null;
let ticking = false;

const on = () => getSetting('statusLoops') !== false && getSetting('enabled') !== false;

function getStatusLayer() {
	if (layer && !layer.destroyed && layer.parent) return layer;
	const parent = canvas.interface ?? canvas.stage;
	layer = new PIXI.Container();
	layer.name = 'fu-animations-statuses';
	layer.eventMode = 'none';
	layer.zIndex = 9980;
	parent.addChild(layer);
	parent.sortableChildren = true;
	parent.sortChildren?.();
	return layer;
}

/* ------------------------------------------------------------------ */
/*  Drawing                                                            */
/* ------------------------------------------------------------------ */

/** Paint a pixel sprite centred on (x, y); p is the size of one art pixel */
function sprite(g, art, x, y, p, color, light, alpha = 1) {
	const rows = ART[art];
	const w = rows[0].length;
	const h = rows.length;
	const x0 = Math.round(x / p - w / 2) * p;
	const y0 = Math.round(y / p - h / 2) * p;
	for (let r = 0; r < h; r++) {
		for (let c = 0; c < w; c++) {
			const ch = rows[r][c];
			if (ch === '.') continue;
			g.beginFill(ch === 'o' ? (light ?? color) : color, alpha).drawRect(x0 + c * p, y0 + r * p, p, p).endFill();
		}
	}
}

const frac = (v) => v - Math.floor(v);

/** Bubbles rise from the body and pop */
function bubbles(g, b, t, look, seed) {
	for (let i = 0; i < 4; i++) {
		const k = frac(t / 2.2 + i / 4 + seed);
		const x = b.x + Math.sin(seed * 9 + i * 2.3) * b.hw * 0.55 + Math.sin(t * 3 + i) * b.p * 2;
		const y = b.y + b.bottom * 0.3 - k * (b.bottom * 0.3 - b.top - b.p * 6);
		const a = k < 0.15 ? k / 0.15 : k > 0.85 ? (1 - k) / 0.15 : 1;
		sprite(g, 'bubble', x, y, b.q, look.color, look.light, a * 0.9);
	}
}

/** Stars circling over the head */
function stars(g, b, t, look) {
	const n = 3;
	for (let i = 0; i < n; i++) {
		const ang = t * 3.2 + (i * Math.PI * 2) / n;
		const x = b.x + Math.cos(ang) * b.hw * 0.5;
		const y = b.y + b.top - b.p * 3 + Math.sin(ang) * b.p * 3;
		// the ones going round the back fade a little
		sprite(g, 'star', x, y, b.q, look.color, look.light, Math.sin(ang) < 0 ? 0.75 : 1);
	}
}

/** Trembling lines either side, and a sweat drop sliding off the head */
function shaken(g, b, t, look) {
	const jitter = Math.round(Math.sin(t * 40)) * b.p;
	const flick = frac(t * 1.4) < 0.7 ? 1 : 0;
	if (flick) {
		const y = b.y + b.top * 0.35;
		sprite(g, 'shakeL', b.x - b.hw * 0.62 + jitter, y, b.p, look.color, null, 0.9);
		sprite(g, 'shakeR', b.x + b.hw * 0.62 - jitter, y, b.p, look.color, null, 0.9);
	}
	const k = frac(t / 1.8);
	const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
	sprite(g, 'drop', b.x + b.hw * 0.35, b.y + b.top + b.p * 3 + k * b.p * 8, b.q, look.color, look.light, a);
}

/** Slow ripples spreading at the feet */
function ripples(g, b, t, look) {
	for (let i = 0; i < 2; i++) {
		const k = frac(t / 2.6 + i / 2);
		const rx = b.hw * (0.35 + k * 0.6);
		g.lineStyle(b.p, look.color, (1 - k) * 0.8).drawEllipse(b.x, b.y + b.bottom - b.p, rx, rx * 0.3);
	}
	g.lineStyle(0);
}

/** Arrows sinking past the body */
function sinking(g, b, t, look) {
	for (let i = 0; i < 2; i++) {
		const k = frac(t / 1.9 + i / 2);
		const x = b.x + (i ? 1 : -1) * b.hw * 0.62;
		const y = b.y + b.top * 0.6 + k * b.p * 12;
		const a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
		sprite(g, 'arrow', x, y, b.q, look.color, look.light, a * 0.9);
	}
}

/** The anger mark, throbbing by the head */
function anger(g, b, t, look) {
	const beat = frac(t * 1.6);
	const big = beat < 0.18 ? 2 : 1;
	const p = Math.round(b.q * (big === 2 ? 1.35 : 1));
	sprite(g, 'anger', b.x + b.hw * 0.42, b.y + b.top + b.p * 2, p, look.color, look.light, 1);
}

/** Zs floating up from the head */
function zzz(g, b, t, look) {
	for (let i = 0; i < 3; i++) {
		const k = frac(t / 2.4 + i / 3);
		const x = b.x + b.hw * 0.3 + k * b.p * 6 + Math.sin(k * 6) * b.p * 1.5;
		const y = b.y + b.top - k * b.p * 12;
		const a = Math.sin(Math.PI * k);
		sprite(g, 'z', x, y, Math.max(1, Math.round(b.q * (0.7 + k * 0.5))), look.color, null, a);
	}
}

/* ------------------------------------------------------------------ */
/*  Tint                                                               */
/* ------------------------------------------------------------------ */

const CMF = () => PIXI.ColorMatrixFilter ?? PIXI.filters?.ColorMatrixFilter;

/**
 * Blend toward a color by brightness, so the sprite keeps its shading: out = (1-k)·base + k·color·luma.
 * With desat the base is washed half way to grey first (weak looks drained, not just purple).
 */
function tintMatrix(color, k, desat) {
	const c = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
	const L = [0.3, 0.59, 0.11];
	const d = desat ? 0.6 * Math.min(1, k * 2.5) : 0;
	const gain = 1.2;
	const m = [];
	for (let i = 0; i < 3; i++) {
		for (let j = 0; j < 3; j++) {
			const base = (i === j ? 1 - d : 0) + d * L[j];
			m.push((1 - k) * base + k * c[i] * L[j] * gain);
		}
		m.push(0, 0);
	}
	m.push(0, 0, 0, 1, 0);
	return m;
}

function setTint(st, mesh, look, k) {
	const Filter = CMF();
	if (!Filter || !mesh || mesh.destroyed) return;
	if (!st.filter) st.filter = new Filter();
	st.filter.matrix = tintMatrix(look.tint, k, look.desat);
	if (!(mesh.filters ?? []).includes(st.filter)) mesh.filters = [...(mesh.filters ?? []), st.filter];
}

function clearTint(st, mesh) {
	if (!st.filter || !mesh || mesh.destroyed || !mesh.filters) return;
	const rest = mesh.filters.filter((f) => f !== st.filter);
	mesh.filters = rest.length ? rest : null;
}

/* ------------------------------------------------------------------ */
/*  Upkeep                                                             */
/* ------------------------------------------------------------------ */

function statusesOf(token) {
	const set = token?.actor?.statuses;
	if (!set?.size) return [];
	return Object.keys(LOOKS).filter((id) => set.has(id));
}

function drop(id) {
	const st = states.get(id);
	if (!st) return;
	clearTint(st, st.mesh);
	if (!st.box.destroyed) st.box.destroy({ children: true });
	states.delete(id);
}

/** Start, change or stop the effects on one token */
export function refreshToken(token) {
	if (!token || token.destroyed || !canvas?.ready) return;
	const ids = on() ? statusesOf(token) : [];
	if (!ids.length) return drop(token.id);
	let st = states.get(token.id);
	if (!st || st.box.destroyed) {
		const box = new PIXI.Container();
		const g = new PIXI.Graphics();
		box.addChild(g);
		getStatusLayer().addChild(box);
		st = { box, g, filter: null, mesh: token.mesh, seed: Math.random(), art: null, artAt: 0 };
		states.set(token.id, st);
	}
	st.ids = ids;
	ensureTicker();
}

export function refreshAll() {
	for (const id of [...states.keys()]) if (!canvas?.tokens?.get(id)) drop(id);
	for (const t of canvas?.tokens?.placeables ?? []) refreshToken(t);
}

export function resetStatuses() {
	for (const id of [...states.keys()]) drop(id);
	layer = null;
}

function tick() {
	if (!states.size) return;
	const t = now() / 1000;
	for (const [id, st] of states) {
		const token = canvas.tokens?.get(id);
		const mesh = token?.mesh;
		if (!token || token.destroyed || !mesh || mesh.destroyed) {
			drop(id);
			continue;
		}
		if (st.mesh !== mesh) {
			clearTint(st, st.mesh);
			st.mesh = mesh;
		}
		const shown = token.visible && mesh.visible && mesh.worldAlpha > 0.05;
		st.box.visible = shown;
		st.g.clear();
		if (!shown) continue;
		// where the figure's head and feet are: read from the art now and then (it can change)
		if (!st.art || t - st.artAt > 5) {
			st.art = tokenArtBox(token);
			st.artAt = t;
		}
		const size = Math.max(1, Math.max(token.document?.width ?? 1, token.document?.height ?? 1) * 0.85);
		const b = {
			x: mesh.x,
			y: mesh.y,
			hw: Math.abs(mesh.width) / 2,
			top: st.art.top,
			bottom: st.art.bottom,
			p: Math.max(1, Math.round((canvas.grid.size / 36) * size)),
		};
		// the icons (stars, bubbles, Zs...) a size up from the art pixel, so they read at a glance
		b.q = Math.max(2, Math.round(b.p * 1.5));
		for (const sid of st.ids) LOOKS[sid].draw(st.g, b, t, LOOKS[sid], st.seed);
		// tints take turns, each fading in and out so the hand-over is smooth
		const tints = st.ids.filter((sid) => LOOKS[sid].tint != null);
		if (tints.length) {
			const turn = Math.floor(t / TINT_CYCLE);
			const look = LOOKS[tints[turn % tints.length]];
			const phase = (t % TINT_CYCLE) / TINT_CYCLE;
			const k = look.strength * (tints.length > 1 ? Math.sin(Math.PI * phase) : 0.65 + 0.35 * Math.sin(phase * Math.PI * 2));
			setTint(st, mesh, look, k);
		} else clearTint(st, mesh);
	}
}

function ensureTicker() {
	if (ticking || !canvas?.app) return;
	canvas.app.ticker.add(tick);
	ticking = true;
}

export function registerStatuses() {
	// the PIXI app (and its ticker) outlives scenes; only the layer and the per-token state are rebuilt
	Hooks.on('canvasReady', () => {
		resetStatuses();
		refreshAll();
	});
	Hooks.on('canvasTearDown', () => resetStatuses());
	const forActor = (actor) => {
		for (const t of actor?.getActiveTokens?.(false, false) ?? []) refreshToken(t);
	};
	for (const h of ['createActiveEffect', 'deleteActiveEffect', 'updateActiveEffect']) {
		Hooks.on(h, (effect) => {
			const parent = effect?.parent;
			forActor(parent instanceof Actor ? parent : parent?.actor);
		});
	}
	Hooks.on('updateActor', (actor) => forActor(actor));
	Hooks.on('createToken', (doc) => setTimeout(() => refreshToken(doc.object), 0));
	Hooks.on('updateToken', (doc) => refreshToken(doc.object));
	Hooks.on('deleteToken', (doc) => drop(doc.id));
}
