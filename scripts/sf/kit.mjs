/**
 * Pixel toolkit for the effects this module draws itself in the Sprite Fusion style (extra.mjs).
 * Same conventions as the Sprite Fusion files: positions in world units (2 per art pixel), a frame of two
 * ABGR buffers (color, drawn normally, and light, drawn additively), flat color ramps from bright to dark,
 * and fades done with a 4 x 4 Bayer dither instead of transparency.
 * The pixel buffer helpers follow the Sprite Fusion code (MIT, Copyright (c) 2026 Hugo Duprez).
 */

export const PX = 2;
export const TAU = Math.PI * 2;

export function rgb(r, g, b, a = 255) {
	return ((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
}
export function hex(h) {
	const v = parseInt(String(h).replace('#', ''), 16);
	return rgb((v >> 16) & 255, (v >> 8) & 255, v & 255);
}
export function mix(c1, c2, t) {
	const f = (s) => Math.round(((c1 >>> s) & 255) * (1 - t) + ((c2 >>> s) & 255) * t);
	return rgb(f(0), f(8), f(16));
}
export function scale(c, k) {
	return rgb(Math.min(255, (c & 255) * k), Math.min(255, ((c >>> 8) & 255) * k), Math.min(255, ((c >>> 16) & 255) * k), c >>> 24);
}
export const WHITE = hex('#ffffff');

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
	const t = clamp((x - a) / (b - a));
	return t * t * (3 - 2 * t);
};
export const outCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const outExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
export const outBack = (t, s = 1.7) => {
	const u = clamp(t) - 1;
	return 1 + (s + 1) * u * u * u + s * u * u;
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

export class Rng {
	constructor(seed = 1) {
		this.s = seed >>> 0 || 1;
	}
	next() {
		let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
	range(a, b) {
		return a + (b - a) * this.next();
	}
	int(a, b) {
		return Math.floor(this.range(a, b + 1));
	}
	pick(list) {
		return list[Math.floor(this.next() * list.length)];
	}
	chance(p) {
		return this.next() < p;
	}
	sign() {
		return this.next() < 0.5 ? -1 : 1;
	}
}

/** A frame buffer seen in art pixels */
export class Px {
	constructor(f, data) {
		this.w = f.w;
		this.h = f.h;
		this.ox = f.ox;
		this.oy = f.oy;
		this.data = data;
	}
	at(x, y) {
		x = Math.floor(x - this.ox);
		y = Math.floor(y - this.oy);
		return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : y * this.w + x;
	}
	set(x, y, c) {
		const i = this.at(x, y);
		if (i >= 0) this.data[i] = c;
	}
	add(x, y, c, k) {
		const i = this.at(x, y);
		if (i < 0) return;
		const d = this.data[i];
		const r = Math.min(255, (d & 255) + (c & 255) * k);
		const g = Math.min(255, ((d >>> 8) & 255) + ((c >>> 8) & 255) * k);
		const b = Math.min(255, ((d >>> 16) & 255) + ((c >>> 16) & 255) * k);
		this.data[i] = (255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
	}
	/** a dithered dot: drawn when the alpha beats the Bayer threshold */
	dot(x, y, c, a = 1) {
		const px = Math.floor(x);
		const py = Math.floor(y);
		if (a >= 1 || a > bayer(px, py)) this.set(px, py, c);
	}
	line(x0, y0, x1, y1, c, a = 1) {
		x0 = Math.round(x0);
		y0 = Math.round(y0);
		x1 = Math.round(x1);
		y1 = Math.round(y1);
		const dx = Math.abs(x1 - x0);
		const dy = -Math.abs(y1 - y0);
		const sx = x0 < x1 ? 1 : -1;
		const sy = y0 < y1 ? 1 : -1;
		let err = dx + dy;
		for (let n = 0; n < 4096; n++) {
			this.dot(x0, y0, c, a);
			if (x0 === x1 && y0 === y1) break;
			const e2 = 2 * err;
			if (e2 >= dy) {
				err += dy;
				x0 += sx;
			}
			if (e2 <= dx) {
				err += dx;
				y0 += sy;
			}
		}
	}
	/** a thick line: a row of discs */
	stroke(x0, y0, x1, y1, w, c, a = 1) {
		const L = Math.hypot(x1 - x0, y1 - y0);
		const n = Math.max(1, Math.ceil(L));
		for (let i = 0; i <= n; i++) this.disc(lerp(x0, x1, i / n), lerp(y0, y1, i / n), w / 2, c, a);
	}
	disc(cx, cy, r, c, a = 1) {
		if (r < 0.5) return this.dot(cx, cy, c, a);
		for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
			for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
				const dx = x + 0.5 - cx;
				const dy = y + 0.5 - cy;
				if (dx * dx + dy * dy <= r * r) this.dot(x, y, c, a);
			}
	}
	ring(cx, cy, r, th, c, a = 1, sy = 1, keep = null) {
		const n = Math.max(8, Math.ceil(r * TAU * 1.4));
		for (let j = 0; j < n; j++) {
			const ang = (j / n) * TAU;
			if (keep && !keep(ang)) continue;
			for (let o = -th / 2; o <= th / 2; o += 0.5) this.dot(cx + Math.cos(ang) * (r + o), cy + Math.sin(ang) * (r + o) * sy, c, a);
		}
	}
	glow(cx, cy, r, c, k) {
		if (r < 1 || k <= 0.01) return;
		const x0 = Math.max(this.ox, Math.floor(cx - r));
		const x1 = Math.min(this.ox + this.w - 1, Math.ceil(cx + r));
		const y0 = Math.max(this.oy, Math.floor(cy - r));
		const y1 = Math.min(this.oy + this.h - 1, Math.ceil(cy + r));
		for (let y = y0; y <= y1; y++) {
			const dy = (y + 0.5 - cy) / r;
			for (let x = x0; x <= x1; x++) {
				const dx = (x + 0.5 - cx) / r;
				const d = dx * dx + dy * dy;
				if (d >= 1) continue;
				const f = 1 - Math.sqrt(d);
				this.add(x, y, c, f * f * k);
			}
		}
	}
	/** stamp a bitmap (rows of characters, '.' or ' ' empty) with a color per character */
	stamp(bmp, x, y, colors, a = 1, s = 1) {
		const h = bmp.length;
		const w = bmp[0].length;
		const x0 = Math.round(x - (w * s) / 2);
		const y0 = Math.round(y - (h * s) / 2);
		for (let r = 0; r < h; r++)
			for (let c = 0; c < w; c++) {
				const ch = bmp[r][c];
				if (ch === '.' || ch === ' ') continue;
				const col = colors[ch];
				if (col == null) continue;
				for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) this.dot(x0 + c * s + xx, y0 + r * s + yy, col, a);
			}
	}
}

/** A ramp of any length read off a longer one, bright to dark */
export function resample(ramp, n) {
	if (!ramp?.length) return ramp;
	if (ramp.length === n) return ramp.slice();
	return Array.from({ length: n }, (_, i) => ramp[Math.round((i / Math.max(1, n - 1)) * (ramp.length - 1))]);
}

/** Particles with a hot head and a cooling tail: sparks (gravity, bounce), motes (drag), puffs (rising) */
export const SPARK = 0;
export const MOTE = 1;
export const PUFF = 2;
export class Particles {
	constructor(ground = () => Infinity) {
		this.list = [];
		this.ground = ground;
	}
	spawn(k, x, y, vx, vy, life, col, size = 1, ramp = null) {
		this.list.push({ k, x, y, vx, vy, life, max: life, col, size, ramp });
	}
	update(dt) {
		const L = this.list;
		for (let i = L.length - 1; i >= 0; i--) {
			const p = L[i];
			if ((p.life -= dt) <= 0) {
				L.splice(i, 1);
				continue;
			}
			if (p.k === SPARK) {
				p.vy += 1900 * 0.45 * dt;
				p.vx -= p.vx * 2.2 * dt;
				p.vy -= p.vy * 2.2 * dt;
				const g = this.ground(p.x);
				const ny = p.y + p.vy * dt;
				p.x += p.vx * dt;
				if (p.vy > 0 && p.y <= g && ny >= g) {
					p.vy = -p.vy * 0.45;
					p.vx *= 0.7;
					p.y = g - 0.5;
				} else p.y = ny;
			} else if (p.k === PUFF) {
				p.vx -= p.vx * 1.6 * dt;
				p.vy -= p.vy * 1.6 * dt + 14 * dt;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
			} else {
				p.vx -= p.vx * 1.2 * dt;
				p.vy -= p.vy * 1.2 * dt;
				p.x += p.vx * dt;
				p.y += p.vy * dt;
			}
		}
	}
	draw(buf, light) {
		for (const p of this.list) {
			const k = p.life / p.max;
			const ax = p.x / PX;
			const ay = p.y / PX;
			const sp = Math.hypot(p.vx, p.vy) || 1;
			const ux = p.vx / sp;
			const uy = p.vy / sp;
			const R = p.ramp;
			const head = R ? R[Math.min(R.length - 1, Math.floor((1 - k) * R.length))] : p.col;
			if (p.k === PUFF) {
				const r = p.size * (1 + (1 - k) * 1.5);
				buf.disc(ax, ay, r, head, k * 0.9);
				if (R && k > 0.55) light.glow(ax, ay, r * 2.2, R[Math.min(R.length - 1, 3)], 0.22 * k);
				continue;
			}
			const len = Math.min(p.k === SPARK ? 9 : 6, 0.5 + sp * (p.k === SPARK ? 0.011 : 0.008)) * p.size;
			if (k < 0.35 && bayer(Math.floor(ax), Math.floor(ay)) > k / 0.35) continue;
			buf.line(ax - ux * len, ay - uy * len, ax - ux * len * 0.4, ay - uy * len * 0.4, scale(head, 0.6));
			buf.line(ax - ux * len * 0.45, ay - uy * len * 0.45, ax, ay, head);
			light.glow(ax, ay, 2.5 + p.size, head, 0.4 * k);
		}
	}
}

/** 3 x 5 pixel letters, for the few effects that write something */
const FONT = {
	A: ['###', '#.#', '###', '#.#', '#.#'],
	H: ['#.#', '#.#', '###', '#.#', '#.#'],
	Z: ['###', '..#', '.#.', '#..', '###'],
	'!': ['#', '#', '#', '.', '#'],
	'?': ['###', '..#', '.##', '...', '.#.'],
};
/** A word as a bitmap: '#' body, 'o' outline around it */
export function word(text, gap = 1) {
	const glyphs = [...String(text).toUpperCase()].map((ch) => FONT[ch]).filter(Boolean);
	const w = glyphs.reduce((s, g) => s + g[0].length, 0) + gap * Math.max(0, glyphs.length - 1);
	const rows = Array.from({ length: 5 }, () => Array(w).fill('.'));
	let x = 0;
	for (const g of glyphs) {
		for (let r = 0; r < 5; r++) for (let c = 0; c < g[r].length; c++) if (g[r][c] === '#') rows[r][x + c] = '#';
		x += g[0].length + gap;
	}
	return outline(rows.map((r) => r.join('')));
}
/** Add a one pixel 'o' outline around the '#'-type pixels of a bitmap */
export function outline(bmp) {
	const h = bmp.length + 2;
	const w = bmp[0].length + 2;
	const at = (r, c) => (r >= 1 && c >= 1 && r <= bmp.length && c <= bmp[0].length ? bmp[r - 1][c - 1] : '.');
	const out = [];
	for (let r = 0; r < h; r++) {
		let row = '';
		for (let c = 0; c < w; c++) {
			const ch = at(r, c);
			if (ch !== '.' && ch !== ' ') row += ch;
			else {
				let near = false;
				for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && !['.', ' ', 'o'].includes(at(r + dy, c + dx))) near = true;
				row += near ? 'o' : '.';
			}
		}
		out.push(row);
	}
	return out;
}

/** A four-point glint, as in the Sprite Fusion sparkle */
export function glint(buf, light, x, y, arm, c, tip) {
	const px = Math.round(x);
	const py = Math.round(y);
	const n = Math.round(arm);
	if (n < 1) return;
	for (let d = 1; d <= n; d++) {
		const cc = d > n * 0.6 ? tip : c;
		buf.set(px + d, py, cc);
		buf.set(px - d, py, cc);
		buf.set(px, py + d, cc);
		buf.set(px, py - d, cc);
	}
	if (n >= 3) for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) buf.set(px + dx, py + dy, c);
	buf.set(px, py, WHITE);
	light.glow(x, y, 4 + n * 2, c, 0.6);
}

/** A ground-anchored helper: the ground function every effect takes */
export const groundOf = (g) => (x) => (g === undefined ? Infinity : typeof g === 'number' ? g : g(x));
