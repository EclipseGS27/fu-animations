/**
 * Pixel effects drawn for this module in the Sprite Fusion style, for what their library has no effect for:
 * bites, an evil eye, sleepy Zs, dizzy stars, laughter, music notes, flying cards, webs, chains, swarms,
 * rune circles, shockwaves, sound waves, whirlwinds, breath, jets, symbols, wisps, smoke, a tether,
 * and the arrow, bullet and boulder projectiles.
 *
 * Each one works like a Sprite Fusion effect: const fx = make(options); every frame fx.update(dt) then
 * fx.draw(frame, 'back') and fx.draw(frame, 'front'); drop it once fx.done(). Positions are in world units
 * (2 per art pixel). Common options: x, y (centre of the target), ground, from / to ([x, y], for effects that
 * travel), ramp (colors from bright to dark, ABGR), seed, size. Projectiles call o.shake() when they land.
 */
import { MOTE, PUFF, PX, Particles, Px, Rng, SPARK, TAU, WHITE, bayer, clamp, glint, groundOf, hex, lerp, mix, outBack, outCubic, outline, resample, scale, smooth, word } from './kit.mjs';

const R8 = (list) => list.map(hex);
const STEEL = R8(['#ffffff', '#e8f1ff', '#b8c9e8', '#8fa6c8', '#62789e', '#44567a', '#2e3a57', '#1a2033']);
const GOLD = R8(['#ffffff', '#fffbe2', '#fff0a6', '#ffd862', '#f6aa3c', '#cf722b', '#7e3c1f', '#40200f']);
const ARCANE = R8(['#ffffff', '#f4ddff', '#d6a0ff', '#a862ff', '#773ae4', '#4c25ab', '#2b1569', '#170b3b']);
const BLOODR = R8(['#ffffff', '#ffd6d0', '#ff8a7a', '#f2384a', '#c71e33', '#931327', '#5e0c1b', '#350711']);
const HEAT = R8(['#ffffff', '#fff3a6', '#ffe26b', '#ffc23d', '#ff8a2a', '#f2561d', '#c9281f', '#8a1f17', '#4a1712']);
const SMOKE = R8(['#9a8f92', '#7b6f72', '#5d5660', '#433d48', '#2b2630', '#1a171e']);
const AIR = R8(['#ffffff', '#e6fff2', '#b8f5d6', '#7fe3b0', '#45c08a', '#2b8a6a', '#1d5a4c', '#12332e']);
const PINK = R8(['#ffffff', '#ffe0f0', '#ffb3d9', '#ff7fbf', '#e0559f', '#a8357a', '#6a2052', '#3a112e']);
const INK = R8(['#ffffff', '#d9dde8', '#a9b0c4', '#7a829c', '#525a74', '#363c52', '#22263a', '#121420']);
const BONE = R8(['#ffffff', '#f4efe2', '#e2d8bf', '#c4b794', '#9a8c6a', '#6e6248', '#463d2c', '#262017']);

const ramp = (o, def, n = 8) => resample(o.ramp?.length ? o.ramp : def, n);
const seedOf = (o, k = 0) => new Rng((o.seed ?? 1) * 7 + k);
const fadeIO = (t, inT, outFrom, end) => (t < inT ? t / inT : t > outFrom ? clamp(1 - (t - outFrom) / (end - outFrom)) : 1);
const P = (v) => v / PX;

/** Boilerplate: a timed effect with its own particles */
function timed(dur, step, opts = {}) {
	const ps = new Particles(opts.ground ?? (() => Infinity));
	let t = 0;
	const fx = {
		ps,
		update(dt) {
			t += dt;
			step.update?.(t, dt, ps);
			ps.update(dt);
		},
		draw(f, layer) {
			const buf = new Px(f, f.color);
			const light = new Px(f, f.light);
			if (layer === 'back') return step.back?.(buf, light, t);
			step.front(buf, light, t);
			ps.draw(buf, light);
		},
		stop() {
			step.stop?.(t);
		},
		done: () => t >= (step.end?.() ?? dur) && ps.list.length === 0,
	};
	return fx;
}

/* ------------------------------------------------------------------ */
/*  Creatures                                                          */
/* ------------------------------------------------------------------ */

const JAW = ['#.#.#.#.#.#', '###########', 'ooooooooooo'];

/** Two rows of fangs snapping shut */
export function bite(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const cy = P(o.y ?? 560);
	const C = ramp(o, BONE);
	const red = ramp({ ramp: o.blood }, BLOODR);
	const R = seedOf(o);
	const CLOSE = 0.2;
	let snapped = false;
	const teeth = Math.round(5 * S) * 2 + 1;
	const upper = [Array.from({ length: teeth }, (_, i) => (i % 2 ? '.' : '#')).join(''), '#'.repeat(teeth), '#'.repeat(teeth)];
	const lower = [...upper].reverse();
	return timed(0.62, {
		update(t, dt, ps) {
			if (!snapped && t >= CLOSE) {
				snapped = true;
				o.shake?.(0.2 * S);
				for (let i = 0; i < 14; i++) {
					const a = R.range(0, TAU);
					const sp = R.range(120, 380) * S;
					ps.spawn(SPARK, cx * PX, cy * PX, Math.cos(a) * sp, Math.sin(a) * sp - 60, R.range(0.2, 0.45), red[R.int(2, 4)], 1);
				}
			}
		},
		front(buf, light, t) {
			const close = t < CLOSE ? Math.pow(t / CLOSE, 2) : 1;
			const fade = fadeIO(t, 0.05, 0.38, 0.62);
			const gap = lerp(16 * S, 1, close);
			const cols = { '#': C[1], o: C[5] };
			const s = Math.max(1, Math.round(S * 1.4));
			buf.stamp(outline(upper), cx, cy - gap - 2 * s, { ...cols, o: C[6] }, fade, s);
			buf.stamp(outline(lower), cx, cy + gap + 2 * s, { ...cols, o: C[6] }, fade, s);
			if (t > CLOSE - 0.02 && t < CLOSE + 0.14) {
				const k = (t - CLOSE) / 0.14;
				light.glow(cx, cy, 18 * S, red[3], 0.8 * (1 - k));
				buf.ring(cx, cy, 6 + 14 * outCubic(k), 1.5, red[2], 1 - k, 0.55);
			}
		},
	});
}

const EYE = [
	'....ooooooo....',
	'..oo#######oo..',
	'.o###########o.',
	'o#####iiii####o',
	'o####iippii###o',
	'.o###iiiii###o.',
	'..oo#######oo..',
	'....ooooooo....',
];

/** A huge eye opening above the target, its stare rolling down in rings */
export function gaze(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const cy = P(o.y ?? 560);
	const C = ramp(o, R8(['#ffffff', '#ffd6e4', '#ff8fb0', '#ff5577', '#d42a55', '#8f1638', '#4f0c22', '#26060f']));
	const ey = cy - 30 * S;
	const s = Math.max(2, Math.round(2 * S));
	let rung = false;
	return timed(1.15, {
		update(t) {
			if (!rung && t > 0.38) {
				rung = true;
				o.shake?.(0.1);
			}
		},
		front(buf, light, t) {
			const open = t < 0.3 ? outCubic(t / 0.3) : t > 0.85 ? clamp(1 - (t - 0.85) / 0.25) : 1;
			const rows = Math.round(EYE.length * open);
			const top = Math.floor((EYE.length - rows) / 2);
			const bmp = EYE.map((r, i) => (i >= top && i < top + rows ? r : '.'.repeat(r.length)));
			buf.stamp(bmp, cx, ey, { o: C[7], '#': WHITE, i: C[3], p: C[7] }, 1, s);
			light.glow(cx, ey, 30 * S, C[3], 0.5 * open);
			for (let i = 0; i < 3; i++) {
				const k = clamp((t - 0.35 - i * 0.12) / 0.45);
				if (k <= 0 || k >= 1) continue;
				buf.ring(cx, lerp(ey + 8 * S, cy + 6 * S, k), lerp(6, 26, k) * S, 1.5, k < 0.5 ? C[2] : C[4], 1 - k, 0.4);
			}
		},
	});
}

/** A cloud of buzzing bugs */
export function swarm(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const cy = P(o.y ?? 560);
	const R = seedOf(o);
	const C = ramp(o, INK);
	const bugs = Array.from({ length: Math.round(46 * S) }, () => ({ p: R.range(0, TAU), r: R.range(6, 26) * S, w: R.range(5, 11) * R.sign(), o: R.range(0, 6), sy: R.range(0.4, 0.8) }));
	return timed(1.45, {
		front(buf, light, t) {
			const fade = fadeIO(t, 0.15, 1.1, 1.45);
			for (const b of bugs) {
				const a = b.p + t * b.w;
				const x = cx + Math.cos(a) * b.r + Math.sin(t * 30 + b.o) * 2;
				const y = cy + Math.sin(a * 1.3) * b.r * b.sy + Math.cos(t * 26 + b.o) * 2;
				buf.dot(x, y, C[6], fade);
				buf.dot(x + 1, y, C[7], fade);
				if (Math.floor(t * 40 + b.o) % 2) buf.dot(x, y - 1, C[2], fade * 0.8);
			}
		},
	});
}

/* ------------------------------------------------------------------ */
/*  Status                                                             */
/* ------------------------------------------------------------------ */

/** Zs drifting up and away */
export function zzz(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const cy = P(o.y ?? 560);
	const C = ramp(o, R8(['#ffffff', '#e4ecff', '#bfd6ff', '#8fb0f0', '#5f7fd0', '#3e55a0', '#26346a', '#141b3a']));
	const Z = word('Z');
	return timed(1.8, {
		front(buf, light, t) {
			for (let i = 0; i < 3; i++) {
				const k = clamp((t - i * 0.25) / 1.1);
				if (k <= 0 || k >= 1) continue;
				const a = Math.sin(Math.PI * k);
				const x = cx + (10 + i * 8) * S + Math.sin(k * 6) * 4 * S;
				const y = cy - (14 + k * 32 + i * 4) * S;
				const s = Math.max(1, Math.round((1 + i * 0.5) * S));
				buf.stamp(Z, x, y, { '#': C[1], o: C[6] }, a, s);
				light.glow(x, y, 8 * s, C[3], 0.3 * a);
			}
		},
	});
}

const STAR = ['..#..', '.###.', '#####', '.#.#.'];

/** Stars circling the head */
export function dizzy(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const cy = P(o.y ?? 560) - 26 * S;
	const C = ramp(o, GOLD);
	const star = outline(STAR);
	return timed(1.5, {
		front(buf, light, t) {
			const fade = fadeIO(t, 0.12, 1.2, 1.5);
			for (let i = 0; i < 4; i++) {
				const a = t * 8 + (i * TAU) / 4;
				const x = cx + Math.cos(a) * 18 * S;
				const y = cy + Math.sin(a) * 5 * S;
				const front = Math.sin(a) > 0;
				buf.stamp(star, x, y, { '#': front ? C[2] : C[3], o: C[6] }, fade, Math.max(1, Math.round(S)));
				if (front) light.glow(x, y, 6 * S, C[3], 0.35 * fade);
			}
		},
	});
}

/** "HA HA HA!" popping over the target */
export function laugh(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const cy = P(o.y ?? 560);
	const C = ramp(o, PINK);
	const words = [word('HA'), word('HA'), word('HA!')];
	return timed(1.45, {
		front(buf, light, t) {
			words.forEach((w, i) => {
				const k = clamp((t - i * 0.16) / 0.85);
				if (k <= 0 || k >= 1) return;
				const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
				const pop = outBack(Math.min(1, k * 4));
				const s = Math.max(1, Math.round(S * (1 + pop * 0.6)));
				const x = cx + (i - 1) * 18 * S;
				const y = cy - (20 + k * 16) * S + Math.sin(t * 40 + i) * 1.2;
				buf.stamp(w, x, y, { '#': C[2], o: C[6] }, a, s);
			});
		},
	});
}

const NOTE = ['..##', '..#.', '..#.', '###.', '###.'];
const NOTE2 = ['.####', '.#..#', '.#..#', '##.##', '##.##'];

/** Music notes floating up in a wave */
export function notes(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const cy = P(o.y ?? 560);
	const R = seedOf(o);
	const C = ramp(o, R8(['#ffffff', '#f2fff8', '#c8ffe8', '#8ff0c9', '#4fd0a0', '#2a9a78', '#1d5a4c', '#0f2f28']));
	const list = Array.from({ length: 6 }, (_, i) => ({ t0: i * 0.14, x: R.range(-22, 22) * S, bmp: outline(i % 2 ? NOTE : NOTE2), sw: R.range(3, 6) }));
	return timed(1.5, {
		front(buf, light, t) {
			for (const n of list) {
				const k = clamp((t - n.t0) / 0.9);
				if (k <= 0 || k >= 1) continue;
				const a = Math.sin(Math.PI * k);
				const x = cx + n.x + Math.sin(k * n.sw) * 6 * S;
				const y = cy + 10 * S - k * 50 * S;
				buf.stamp(n.bmp, x, y, { '#': C[2], o: C[6] }, a, Math.max(1, Math.round(S)));
				light.glow(x, y, 7 * S, C[3], 0.3 * a);
			}
		},
	});
}

const SYMBOLS = {
	alert: ['.##.', '.##.', '.##.', '.##.', '....', '.##.'],
	question: ['.###.', '##.##', '...##', '..##.', '.....', '..##.'],
	crown: ['#.#.#', '#####', '#####', '#####'],
	up: ['..#..', '.###.', '#####', '..#..', '..#..'],
	down: ['..#..', '..#..', '#####', '.###.', '..#..'],
	skull: ['.####.', '######', '#..#.#', '######', '.#.#..'],
	heart: ['##.##', '#####', '#####', '.###.', '..#..'],
	check: ['....#', '...##', '#.##.', '###..', '.#...'],
	cross: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
	shield: ['#####', '#####', '#####', '.###.', '..#..'],
	sword: ['....#', '...#.', '#.#..', '.#...', '#.#..'],
	star: ['..#..', '.###.', '#####', '.###.', '#...#'],
	bulb: ['.###.', '#####', '#####', '.###.', '.###.', '..#..'],
};

/** A symbol popping up over the head and bobbing (alert, question, crown, up, down, skull, heart...) */
export function symbol(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const cy = P(o.y ?? 560) - 30 * S;
	const C = ramp(o, GOLD);
	const bmp = outline(SYMBOLS[o.kind] ?? SYMBOLS.alert);
	const R = seedOf(o);
	let popped = false;
	return timed(1.5, {
		update(t, dt, ps) {
			if (!popped) {
				popped = true;
				for (let i = 0; i < 10; i++) {
					const a = R.range(0, TAU);
					const sp = R.range(60, 160);
					ps.spawn(MOTE, cx * PX, cy * PX, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.3, 0.6), C[R.int(1, 3)], 0.8);
				}
			}
		},
		front(buf, light, t) {
			const pop = outBack(Math.min(1, t / 0.22));
			const a = t > 1.15 ? clamp(1 - (t - 1.15) / 0.35) : 1;
			const s = Math.max(1, Math.round(2 * S * pop));
			const y = cy + Math.sin(t * 5) * 2;
			buf.stamp(bmp, cx, y, { '#': C[2], o: C[6] }, a, s);
			light.glow(cx, y, 12 * S, C[3], 0.4 * a);
		},
	});
}

/** Glowing wisps circling in and fading */
export function wisps(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const cy = P(o.y ?? 560);
	const C = ramp(o, R8(['#ffffff', '#e0fbff', '#a6ecff', '#7fd8ff', '#3fa8e6', '#2a6fb0', '#1d3f6a', '#0f1f38']));
	const ws = Array.from({ length: 5 }, (_, i) => ({ p: (i / 5) * TAU, trail: [] }));
	return timed(1.5, {
		update(t) {
			const R2 = (36 - t * 22) * S;
			for (const w of ws) {
				const a = w.p + t * 6;
				w.trail.push([cx + Math.cos(a) * R2, cy + Math.sin(a) * R2 * 0.55]);
				if (w.trail.length > 9) w.trail.shift();
			}
		},
		front(buf, light, t) {
			const fade = fadeIO(t, 0.15, 1.15, 1.5);
			for (const w of ws) {
				w.trail.forEach(([x, y], i) => buf.dot(x, y, i > 6 ? C[1] : C[4], fade * (i / w.trail.length)));
				const [x, y] = w.trail[w.trail.length - 1] ?? [cx, cy];
				buf.disc(x, y, 1.6 * S, C[1], fade);
				buf.dot(x, y, WHITE, fade);
				light.glow(x, y, 9 * S, C[3], 0.6 * fade);
			}
		},
	});
}

/** Smoke puffing out and rising */
export function smoke(o = {}) {
	const S = o.size ?? 1;
	const X = o.x ?? 600;
	const Y = o.y ?? 560;
	const R = seedOf(o);
	const C = ramp(o, SMOKE, 6);
	let spawned = false;
	const fx = timed(1.2, {
		update(t, dt, ps) {
			if (spawned) return;
			spawned = true;
			for (let i = 0; i < 18 * S; i++) {
				const a = R.range(0, TAU);
				const sp = R.range(30, 120) * S;
				ps.spawn(PUFF, X + Math.cos(a) * 8, Y + Math.sin(a) * 8, Math.cos(a) * sp, Math.sin(a) * sp * 0.6 - 30, R.range(0.6, 1.1), C[1], R.range(3, 6) * S, C);
			}
		},
		front() {},
	});
	return fx;
}

/* ------------------------------------------------------------------ */
/*  Traps and binds                                                    */
/* ------------------------------------------------------------------ */

/** A web spun out over the target */
export function web(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const cy = P(o.y ?? 560);
	const C = ramp(o, R8(['#ffffff', '#f2f2f2', '#d8d8e0', '#b0b0c0', '#8a8aa0', '#606078', '#3a3a50', '#1e1e2c']));
	const R = seedOf(o);
	const spokes = Array.from({ length: 9 }, (_, i) => (i / 9) * TAU + R.range(-0.12, 0.12));
	return timed(1.4, {
		front(buf, light, t) {
			const k = outCubic(clamp(t * 2.6));
			const fade = t > 1.05 ? clamp(1 - (t - 1.05) / 0.35) : 1;
			const RR = 30 * S * k;
			for (const a of spokes) buf.line(cx, cy, cx + Math.cos(a) * RR, cy + Math.sin(a) * RR, C[2], fade);
			for (let ring = 1; ring <= 4; ring++) {
				const rr = (RR * ring) / 4.3;
				for (let i = 0; i < spokes.length; i++) {
					const a0 = spokes[i];
					const a1 = spokes[(i + 1) % spokes.length];
					const sag = 0.86;
					const mid = (a0 + a1 + (i === spokes.length - 1 ? TAU : 0)) / 2;
					const p0 = [cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr];
					const pm = [cx + Math.cos(mid) * rr * sag, cy + Math.sin(mid) * rr * sag];
					const p1 = [cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr];
					buf.line(p0[0], p0[1], pm[0], pm[1], ring % 2 ? C[1] : C[3], fade);
					buf.line(pm[0], pm[1], p1[0], p1[1], ring % 2 ? C[1] : C[3], fade);
				}
			}
			if (t < 0.4) light.glow(cx, cy, 30 * S, C[2], 0.25 * (1 - t / 0.4));
		},
	});
}

/** Chains wrapping round and pulling tight */
export function chains(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const cy = P(o.y ?? 560);
	const C = ramp(o, STEEL);
	let locked = false;
	return timed(1.3, {
		update(t, dt, ps) {
			if (!locked && t > 0.42) {
				locked = true;
				o.shake?.(0.15);
				for (let i = 0; i < 10; i++) ps.spawn(SPARK, cx * PX + (i - 5) * 6, cy * PX, (i - 5) * 30, -200, 0.3, C[1], 1);
			}
		},
		front(buf, light, t) {
			const close = outCubic(clamp(t / 0.45));
			const fade = t > 1.0 ? clamp(1 - (t - 1.0) / 0.3) : 1;
			for (let band = 0; band < 2; band++) {
				const RR = (50 - close * 30) * S;
				const yy = cy + (band ? 7 : -7) * S;
				const links = 16;
				for (let i = 0; i < links; i++) {
					const a = (i / links) * TAU + t * (band ? 2.4 : -2.4);
					const front = Math.sin(a) > 0;
					const x = cx + Math.cos(a) * RR;
					const y = yy + Math.sin(a) * RR * 0.3;
					const col = front ? (i % 2 ? C[1] : C[3]) : C[5];
					buf.ring(x, y, 2.2 * S, 1, col, fade, i % 2 ? 0.6 : 1);
				}
			}
		},
	});
}

/** A rune circle drawn on the ground, spinning, with motes rising off it */
export function glyph(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const cy = P(o.ground ?? o.y ?? 600) - 2;
	const C = ramp(o, GOLD);
	const R = seedOf(o);
	const RR = 30 * S;
	const SY = 0.42;
	return timed(1.4, {
		update(t, dt, ps) {
			if (t < 1 && R.chance(0.6)) {
				const a = R.range(0, TAU);
				ps.spawn(MOTE, (cx + Math.cos(a) * RR * 0.8) * PX, (cy + Math.sin(a) * RR * 0.8 * SY) * PX, 0, -R.range(60, 140), R.range(0.4, 0.8), C[R.int(1, 3)], 0.7);
			}
		},
		back(buf, light, t) {
			const k = outCubic(clamp(t * 2.4));
			const fade = t > 1.05 ? clamp(1 - (t - 1.05) / 0.35) : 1;
			const r = RR * k;
			const rot = t * 1.8;
			buf.ring(cx, cy, r, 1, C[2], fade, SY);
			buf.ring(cx, cy, r * 0.8, 1, C[3], fade, SY);
			const pts = Array.from({ length: 6 }, (_, i) => [cx + Math.cos(rot + (i * TAU) / 6) * r * 0.8, cy + Math.sin(rot + (i * TAU) / 6) * r * 0.8 * SY]);
			for (const [a, b] of [[0, 2], [2, 4], [4, 0], [1, 3], [3, 5], [5, 1]]) buf.line(pts[a][0], pts[a][1], pts[b][0], pts[b][1], C[1], fade);
			for (let i = 0; i < 12; i++) {
				const a = -rot + (i * TAU) / 12;
				buf.dot(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9 * SY, C[0], fade);
			}
			light.glow(cx, cy, r * 1.1, C[3], 0.35 * fade * k);
		},
		front() {},
	});
}

/* ------------------------------------------------------------------ */
/*  Waves                                                              */
/* ------------------------------------------------------------------ */

/** Rings of force bursting out along the ground, kicking up dust */
export function shockwave(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const cy = P(o.y ?? 560);
	const C = ramp(o, R8(['#ffffff', '#e8f6ff', '#bfe3ff', '#8cc4f0', '#5a8fd0', '#3a5fa0', '#24386a', '#121c38']));
	const R = seedOf(o);
	let kicked = false;
	return timed(0.95, {
		update(t, dt, ps) {
			if (kicked) return;
			kicked = true;
			o.shake?.(0.3 * S);
			for (let i = 0; i < 16; i++) {
				const a = R.range(0, TAU);
				const sp = R.range(150, 380) * S;
				ps.spawn(MOTE, cx * PX, cy * PX, Math.cos(a) * sp, Math.sin(a) * sp * 0.5, R.range(0.25, 0.5), C[R.int(1, 3)], 1);
			}
		},
		front(buf, light, t) {
			for (let i = 0; i < 3; i++) {
				const k = clamp(t * 1.5 - i * 0.2);
				if (k <= 0 || k >= 1) continue;
				const r = (8 + outCubic(k) * 60) * S;
				buf.ring(cx, cy, r, Math.max(1, 3 * (1 - k) * S), k < 0.3 ? C[0] : k < 0.6 ? C[2] : C[4], 1.1 - k, 0.55);
			}
			if (t < 0.15) light.glow(cx, cy, 30 * S, C[2], 0.8 * (1 - t / 0.15));
		},
	});
}

/** Arcs of sound rolling from the user to the target */
export function soundwave(o = {}) {
	const S = o.size ?? 1;
	const [fx0, fy0] = (o.from ?? [400, 560]).map(P);
	const [tx, ty] = (o.to ?? [o.x ?? 700, o.y ?? 560]).map(P);
	const a = Math.atan2(ty - fy0, tx - fx0);
	const d = Math.hypot(tx - fx0, ty - fy0) || 1;
	const C = ramp(o, R8(['#ffffff', '#f2e8ff', '#d9b8ff', '#b88aff', '#8f5fe0', '#6640b0', '#40287a', '#201440']));
	return timed(1.0, {
		front(buf, light, t) {
			for (let i = 0; i < 5; i++) {
				const k = clamp(t * 1.6 - i * 0.14);
				if (k <= 0 || k >= 1) continue;
				const r = 8 * S + d * k;
				const span = 0.38 + k * 0.12;
				const col = i % 2 ? C[2] : C[0];
				const n = Math.ceil(r * span * 2 * 1.3);
				for (let j = 0; j <= n; j++) {
					const aa = a - span + (2 * span * j) / n;
					buf.dot(fx0 + Math.cos(aa) * r, fy0 + Math.sin(aa) * r, col, 1.1 - k * 0.8);
					buf.dot(fx0 + Math.cos(aa) * (r - 1), fy0 + Math.sin(aa) * (r - 1), C[4], 0.9 - k * 0.8);
				}
			}
		},
	});
}

/** A whirlwind spinning up over the target */
export function tornado(o = {}) {
	const S = o.size ?? 1;
	const cx = P(o.x ?? 600);
	const base = P(o.ground ?? (o.y ?? 560) + 30);
	const C = ramp(o, AIR);
	const R = seedOf(o);
	const debris = Array.from({ length: 14 }, () => ({ h: R.range(0, 1), p: R.range(0, TAU), c: R.int(4, 6) }));
	return timed(1.35, {
		front(buf, light, t) {
			const grow = outCubic(clamp(t * 3));
			const fade = t > 1.0 ? clamp(1 - (t - 1.0) / 0.35) : 1;
			const H = 70 * S * grow;
			for (let i = 0; i < 11; i++) {
				const h = i / 10;
				const r = (5 + h * 22) * S;
				const yy = base - H * h;
				const ph = t * 22 + i;
				const xx = cx + Math.sin(ph * 0.3) * 2 * S;
				const keep = (ang) => ((ang + ph) % 1.2) < 0.8;
				buf.ring(xx, yy, r, 1, i % 2 ? C[2] : C[0], fade * 0.95, 0.24, keep);
			}
			for (const b of debris) {
				const ang = b.p + t * 14;
				const r = (5 + b.h * 22) * S;
				const x = cx + Math.cos(ang) * r;
				const y = base - H * b.h + Math.sin(ang) * r * 0.24;
				buf.dot(x, y, C[b.c], fade);
				buf.dot(x + 1, y, C[b.c + 1], fade);
			}
		},
	});
}

/** Breath or spray: a cone of puffs from the user, hot to dark, rolling over the target */
export function breath(o = {}) {
	const S = o.size ?? 1;
	const [fx0, fy0] = o.from ?? [400, 560];
	const [tx, ty] = o.to ?? [o.x ?? 700, o.y ?? 560];
	const a = Math.atan2(ty - fy0, tx - fx0);
	const d = Math.hypot(tx - fx0, ty - fy0) + 40 * S;
	const C = ramp(o, HEAT, 9);
	const R = seedOf(o);
	let acc = 0;
	let hit = false;
	return timed(1.25, {
		update(t, dt, ps) {
			if (!hit && t > (d / 700) * 0.6) {
				hit = true;
				o.shake?.(0.15);
			}
			if (t > 0.8) return;
			acc += dt;
			while (acc > 0.007) {
				acc -= 0.007;
				const s = R.range(-0.3, 0.3);
				const sp = (d / 0.5) * R.range(0.8, 1.15);
				ps.spawn(PUFF, fx0, fy0, Math.cos(a + s) * sp, Math.sin(a + s) * sp, R.range(0.45, 0.65), C[1], R.range(2.5, 4.5) * S, C);
			}
		},
		front(buf, light, t) {
			if (t < 0.8) light.glow(P(fx0) + Math.cos(a) * 6, P(fy0) + Math.sin(a) * 6, 12 * S, C[3], 0.6);
		},
	});
}

/** A jet of water, acid or fire: a wobbling stream that splashes on the target */
export function jet(o = {}) {
	const S = o.size ?? 1;
	const [fx0, fy0] = (o.from ?? [400, 560]).map(P);
	const [tx, ty] = (o.to ?? [o.x ?? 700, o.y ?? 560]).map(P);
	const a = Math.atan2(ty - fy0, tx - fx0);
	const d = Math.hypot(tx - fx0, ty - fy0) || 1;
	const C = ramp(o, R8(['#ffffff', '#e0f6ff', '#a6dcff', '#6fc8ff', '#3a8bd8', '#2c58aa', '#212f6b', '#151a3d']));
	const R = seedOf(o);
	let arrived = false;
	return timed(0.95, {
		update(t, dt, ps) {
			const head = Math.min(1, t * 2.4);
			if (head >= 1 && t < 0.75) {
				if (!arrived) {
					arrived = true;
					o.shake?.(0.12);
				}
				for (let i = 0; i < 2; i++) {
					const aa = a + Math.PI + R.range(-1.2, 1.2);
					const sp = R.range(120, 320);
					ps.spawn(SPARK, tx * PX, ty * PX, Math.cos(aa) * sp, Math.sin(aa) * sp - 80, R.range(0.2, 0.4), C[R.int(0, 3)], 0.8);
				}
			}
		},
		front(buf, light, t) {
			const head = Math.min(1, t * 2.4);
			const tail = Math.max(0, t * 1.7 - 0.62);
			const nx = -Math.sin(a);
			const ny = Math.cos(a);
			const n = Math.ceil(d);
			for (let i = 0; i <= n; i++) {
				const k = lerp(tail, head, i / n);
				const wob = Math.sin(k * 18 + t * 30) * 1.5 * S;
				const x = fx0 + Math.cos(a) * d * k + nx * wob;
				const y = fy0 + Math.sin(a) * d * k + ny * wob;
				const w = (1.2 + Math.sin((i / n) * Math.PI) * 1.4) * S;
				buf.disc(x, y, w, i % 5 ? C[3] : C[1], 1);
				buf.dot(x, y, C[0], 1);
			}
			light.glow(fx0 + Math.cos(a) * d * head, fy0 + Math.sin(a) * d * head, 10 * S, C[2], 0.5);
		},
	});
}

/** A wavy thread from the target back to the user, with motes running along it */
export function tether(o = {}) {
	const S = o.size ?? 1;
	const [ux, uy] = (o.from ?? [400, 560]).map(P);
	const [tx, ty] = (o.to ?? [o.x ?? 700, o.y ?? 560]).map(P);
	const a = Math.atan2(uy - ty, ux - tx);
	const d = Math.hypot(ux - tx, uy - ty) || 1;
	const C = ramp(o, BLOODR);
	return timed(1.35, {
		front(buf, light, t) {
			const fade = fadeIO(t, 0.15, 1.05, 1.35);
			const nx = -Math.sin(a);
			const ny = Math.cos(a);
			const n = Math.ceil(d);
			for (let i = 0; i <= n; i++) {
				const k = i / n;
				const wob = Math.sin(k * 14 - t * 30) * 3 * S * Math.sin(Math.PI * k);
				buf.disc(tx + Math.cos(a) * d * k + nx * wob, ty + Math.sin(a) * d * k + ny * wob, 0.9 * S, C[4], fade);
			}
			for (let i = 0; i < 7; i++) {
				const k = (t * 1.8 + i / 7) % 1;
				const wob = Math.sin(k * 14 - t * 30) * 3 * S * Math.sin(Math.PI * k);
				const x = tx + Math.cos(a) * d * k + nx * wob;
				const y = ty + Math.sin(a) * d * k + ny * wob;
				buf.disc(x, y, 2 * S, C[1], fade);
				buf.dot(x, y, C[0], fade);
				light.glow(x, y, 9 * S, C[3], 0.6 * fade);
			}
		},
	});
}

/* ------------------------------------------------------------------ */
/*  Thrown things                                                      */
/* ------------------------------------------------------------------ */

const CARD = ['#####', '#...#', '#.r.#', '#...#', '#####'];

/** A fan of playing cards spinning to the target */
export function cards(o = {}) {
	const S = o.size ?? 1;
	const [fx0, fy0] = (o.from ?? [400, 560]).map(P);
	const [tx, ty] = (o.to ?? [o.x ?? 700, o.y ?? 560]).map(P);
	const a = Math.atan2(ty - fy0, tx - fx0);
	const d = Math.hypot(tx - fx0, ty - fy0) || 1;
	const C = ramp(o, R8(['#ffffff', '#ffffff', '#f2eee4', '#d8d0c0', '#a89c88', '#6e6452', '#3a3428', '#1a1712']));
	const list = Array.from({ length: 5 }, (_, i) => ({ t0: i * 0.07, s: (i - 2) * 0.22, red: i % 2 === 0 }));
	let hits = 0;
	return timed(1.1, {
		update(t) {
			for (const c of list) if (!c.hit && t - c.t0 >= 0.5) {
				c.hit = true;
				if (hits++ === 0) o.shake?.(0.08);
			}
		},
		front(buf, light, t) {
			for (const c of list) {
				const k = clamp((t - c.t0) / 0.5);
				if (k <= 0) continue;
				const fade = k >= 1 ? clamp(1 - (t - c.t0 - 0.5) * 4) : 1;
				const ang = a + c.s * Math.sin(Math.PI * k);
				const x = fx0 + Math.cos(ang) * d * k;
				const y = fy0 + Math.sin(ang) * d * k;
				const w = Math.abs(Math.cos(k * 14));
				const bmp = w > 0.4 ? CARD : ['#', '#', '#', '#', '#'];
				buf.stamp(bmp, x, y, { '#': C[1], r: c.red ? hex('#d23a3a') : hex('#222222'), '.': undefined }, fade, Math.max(1, Math.round(S)));
				buf.stamp(['ooooooo'], x, y + 3 * S + 1, { o: C[5] }, fade * 0.5, 1);
			}
		},
	});
}

/** An arrow: shaft, head and fletching, with a faint trail */
export function arrow(o = {}) {
	return flying(o, { speed: o.speed ?? 1500, draw: drawArrow, trail: 0.5 });
}
/** A bullet tracer */
export function bullet(o = {}) {
	return flying(o, { speed: o.speed ?? 3400, draw: drawTracer, trail: 0 });
}
/** A boulder tumbling on a high arc, shedding dust */
export function rock(o = {}) {
	return flying(o, { speed: o.speed ?? 700, draw: drawRock, arc: 0.35, dust: true });
}

function flying(o, kind) {
	const S = o.size ?? 1;
	const [fx0, fy0] = o.from ?? [400, 560];
	const [tx, ty] = o.to ?? [o.x ?? 700, o.y ?? 560];
	const d = Math.hypot(tx - fx0, ty - fy0) || 1;
	const T = Math.max(0.12, d / kind.speed);
	const arc = Math.min(d * (kind.arc ?? 0), 220);
	const C = ramp(o, kind.draw === drawRock ? BONE : kind.draw === drawTracer ? HEAT : STEEL);
	const R = seedOf(o);
	let landed = false;
	const pos = (t) => {
		const u = clamp(t / T);
		return [lerp(fx0, tx, u), lerp(fy0, ty, u) - Math.sin(Math.PI * u) * arc];
	};
	return timed(T + 0.05, {
		update(t, dt, ps) {
			const [x, y] = pos(t);
			if (!landed && t >= T) {
				landed = true;
				o.shake?.(0.1 * S);
			}
			if (!landed && kind.dust && R.chance(0.7)) ps.spawn(PUFF, x, y, R.range(-20, 20), R.range(-20, 10), R.range(0.25, 0.45), C[4], 1.5 * S, SMOKE);
			if (!landed && kind.trail && R.chance(kind.trail)) ps.spawn(MOTE, x, y, 0, 0, 0.18, C[3], 0.6);
		},
		front(buf, light, t) {
			if (t >= T) return;
			const [x, y] = pos(t);
			const [x2, y2] = pos(t + 0.01);
			kind.draw(buf, light, P(x), P(y), Math.atan2(y2 - y, x2 - x), S, C, t, o);
		},
	});
}

function drawArrow(buf, light, x, y, a, S, C) {
	const L = 14 * S;
	const ux = Math.cos(a);
	const uy = Math.sin(a);
	buf.line(x - ux * L, y - uy * L, x, y, BONE[3]);
	buf.line(x - ux * L + uy, y - uy * L - ux, x - ux * (L - 3), y - uy * (L - 3), PINK[4]);
	buf.line(x - ux * L - uy, y - uy * L + ux, x - ux * (L - 3), y - uy * (L - 3), PINK[4]);
	buf.disc(x, y, 1.1 * S, C[1]);
	buf.dot(x + ux, y + uy, C[0]);
}
function drawTracer(buf, light, x, y, a, S, C) {
	const L = 16 * S;
	const ux = Math.cos(a);
	const uy = Math.sin(a);
	buf.line(x - ux * L, y - uy * L, x - ux * L * 0.4, y - uy * L * 0.4, C[4]);
	buf.line(x - ux * L * 0.45, y - uy * L * 0.45, x, y, C[1]);
	light.glow(x, y, 6, C[2], 0.6);
}
function drawRock(buf, light, x, y, a, S, C, t) {
	const r = 5 * S;
	const spin = t * 12;
	for (let yy = -r; yy <= r; yy++)
		for (let xx = -r; xx <= r; xx++) {
			const ang = Math.atan2(yy, xx) - spin;
			const rr = r * (0.82 + 0.18 * Math.sin(ang * 3));
			if (xx * xx + yy * yy > rr * rr) continue;
			const lit = (-xx - yy) / (r * 2);
			buf.set(x + xx, y + yy, lit > 0.25 ? C[3] : lit > -0.15 ? C[4] : C[5]);
		}
}

export const EXTRA = { bite, gaze, swarm, zzz, dizzy, laugh, notes, symbol, wisps, smoke, web, chains, glyph, shockwave, soundwave, tornado, breath, jet, tether, cards, arrow, bullet, rock };
export { mix, scale, smooth, bayer };
