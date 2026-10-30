import { now } from './clock.mjs';
/**
 * Custom effects drawn in code, for abilities the sprite packs don't cover (claws, bites, breath, beams, roars, swarms...).
 * Each effect gets a context: {g: grid size, x, y: where it plays, from/to: user and target centers, color, add(obj), tick(fn)}
 * and returns a promise that resolves when it is done.
 */

const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;

function lighten(color, k = 0.5) {
	const r = (color >> 16) & 255;
	const gr = (color >> 8) & 255;
	const b = color & 255;
	return (Math.round(r + (255 - r) * k) << 16) | (Math.round(gr + (255 - gr) * k) << 8) | Math.round(b + (255 - b) * k);
}

/** Run draw(t) every frame for ms; t goes 0..1. Cleans up the graphics it was given. */
function animate(ctx, ms, draw, objs = []) {
	return new Promise((resolve) => {
		const start = now();
		const step = () => {
			const t = clamp01((now() - start) / ms);
			try {
				draw(t);
			} catch (err) {
				console.warn('fu-animations | effect', err);
				ctx.untick(step);
				for (const o of objs) o.destroy?.({ children: true });
				return resolve();
			}
			if (t >= 1) {
				ctx.untick(step);
				for (const o of objs) if (!o.destroyed) o.destroy({ children: true });
				resolve();
			}
		};
		ctx.tick(step);
	});
}

function gfx(ctx, add = true) {
	const g = new PIXI.Graphics();
	if (add) g.blendMode = PIXI.BLEND_MODES.ADD;
	ctx.add(g);
	return g;
}

const dirOf = (ctx) => {
	const dx = ctx.to.x - ctx.from.x;
	const dy = ctx.to.y - ctx.from.y;
	const d = Math.hypot(dx, dy) || 1;
	return { ux: dx / d, uy: dy / d, d, a: Math.atan2(dy, dx) };
};

/* ------------------------------------------------------------------ */

export const PROC = {
	'pr-claw': {
		label: 'Claw Marks',
		dur: 520,
		color: 0xffe1d0,
		run(ctx) {
			const g = gfx(ctx);
			const { a } = dirOf(ctx);
			const ang = a + Math.PI / 2 + rand(-0.4, 0.4);
			const len = ctx.g * 0.9;
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					for (let i = -1; i <= 1; i++) {
						const k = clamp01(t * 3.2 - (i + 1) * 0.18);
						const fade = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
						const off = i * ctx.g * 0.2;
						const ox = Math.cos(ang + Math.PI / 2) * off;
						const oy = Math.sin(ang + Math.PI / 2) * off;
						const sx = ctx.x + ox - Math.cos(ang) * len * 0.5;
						const sy = ctx.y + oy - Math.sin(ang) * len * 0.5;
						const ex = sx + Math.cos(ang) * len * easeOut(k);
						const ey = sy + Math.sin(ang) * len * easeOut(k);
						g.lineStyle(ctx.g * 0.12, ctx.color, 0.35 * fade).moveTo(sx, sy).lineTo(ex, ey);
						g.lineStyle(ctx.g * 0.045, 0xffffff, 0.95 * fade).moveTo(sx, sy).lineTo(ex, ey);
					}
				},
				[g],
			);
		},
	},

	'pr-bite': {
		label: 'Snapping Jaws',
		dur: 520,
		color: 0xffffff,
		run(ctx) {
			const g = gfx(ctx, false);
			const r = ctx.g * 0.8;
			const teeth = 6;
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const close = t < 0.45 ? easeIn(t / 0.45) : 1;
					const fade = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
					const gap = r * (1 - close) * 0.9;
					for (const side of [-1, 1]) {
						const baseY = ctx.y + side * (gap + r * 0.05);
						g.lineStyle(ctx.g * 0.035, 0x2a0a0a, fade).beginFill(ctx.color, fade);
						const pts = [ctx.x - r, baseY + side * r * 0.25];
						for (let i = 0; i <= teeth; i++) {
							const x = ctx.x - r + (2 * r * i) / teeth;
							pts.push(x, baseY + side * r * 0.25);
							if (i < teeth) pts.push(x + r / teeth, baseY - side * r * 0.32);
						}
						pts.push(ctx.x + r, baseY + side * r * 0.25);
						g.drawPolygon(pts).endFill();
					}
					if (t > 0.42 && t < 0.62) {
						g.lineStyle(0).beginFill(0xff3344, 0.6 * fade).drawCircle(ctx.x, ctx.y, r * 0.3 * (1 + (t - 0.42) * 5)).endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-sweep': {
		label: 'Wide Sweep',
		dur: 560,
		color: 0xfff1d6,
		run(ctx) {
			const g = gfx(ctx);
			const { a } = dirOf(ctx);
			const r = ctx.g * 1.1;
			const cx = ctx.x - Math.cos(a) * ctx.g * 0.4;
			const cy = ctx.y - Math.sin(a) * ctx.g * 0.4;
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const head = a - 1.3 + 2.6 * easeOut(clamp01(t * 1.6));
					const tail = a - 1.3 + 2.6 * easeOut(clamp01(t * 1.6 - 0.35));
					const fade = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
					for (let w = 0; w < 3; w++) {
						g.lineStyle(ctx.g * (0.22 - w * 0.07), w === 2 ? 0xffffff : ctx.color, (0.25 + w * 0.3) * fade);
						g.moveTo(cx + Math.cos(tail) * r, cy + Math.sin(tail) * r);
						g.arc(cx, cy, r, tail, head);
					}
				},
				[g],
			);
		},
	},

	'pr-stomp': {
		label: 'Ground Slam',
		dur: 700,
		color: 0xd8c3a0,
		run(ctx) {
			const g = gfx(ctx, false);
			const cracks = Array.from({ length: 7 }, () => ({ a: rand(0, Math.PI * 2), l: rand(0.5, 1) }));
			const dust = Array.from({ length: 14 }, () => ({ a: rand(0, Math.PI * 2), s: rand(0.5, 1.2) }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const fade = 1 - t;
					g.lineStyle(ctx.g * 0.05, ctx.color, 0.8 * fade).drawEllipse(ctx.x, ctx.y + ctx.g * 0.25, ctx.g * (0.3 + t * 1.1), ctx.g * (0.12 + t * 0.4));
					for (const c of cracks) {
						const L = ctx.g * 0.7 * c.l * easeOut(clamp01(t * 3));
						g.lineStyle(ctx.g * 0.03, 0x3a2a1a, 0.9 * fade).moveTo(ctx.x, ctx.y + ctx.g * 0.25);
						g.lineTo(ctx.x + Math.cos(c.a) * L * 0.5 + rand(-2, 2), ctx.y + ctx.g * 0.25 + Math.sin(c.a) * L * 0.2);
						g.lineTo(ctx.x + Math.cos(c.a) * L, ctx.y + ctx.g * 0.25 + Math.sin(c.a) * L * 0.4);
					}
					for (const d of dust) {
						const k = easeOut(t);
						g.lineStyle(0).beginFill(ctx.color, 0.55 * fade).drawCircle(ctx.x + Math.cos(d.a) * ctx.g * k * d.s, ctx.y + ctx.g * 0.2 - Math.abs(Math.sin(d.a)) * ctx.g * 0.5 * k * d.s, ctx.g * 0.09 * (1 + t)).endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-breath': {
		label: 'Breath Cone',
		dur: 1100,
		color: 0xff7a3d,
		needsFrom: true,
		run(ctx) {
			const g = gfx(ctx);
			const { a, d } = dirOf(ctx);
			const parts = [];
			let last = 0;
			return animate(
				ctx,
				this.dur,
				(t) => {
					const now = t * this.dur;
					if (t < 0.7) {
						while (last < now) {
							parts.push({ born: last, spread: rand(-0.38, 0.38), sp: rand(0.8, 1.15), r: rand(0.08, 0.16) });
							last += 14;
						}
					}
					g.clear();
					const reach = d + ctx.g * 0.6;
					for (const p of parts) {
						const age = (now - p.born) / 520;
						if (age < 0 || age > 1) continue;
						const dist = reach * easeOut(age) * p.sp;
						const ang = a + p.spread * Math.min(1, age * 1.5);
						const x = ctx.from.x + Math.cos(ang) * dist;
						const y = ctx.from.y + Math.sin(ang) * dist;
						const col = age < 0.3 ? lighten(ctx.color, 0.6) : ctx.color;
						g.beginFill(col, 0.8 * (1 - age)).drawCircle(x, y, ctx.g * p.r * (0.6 + age * 1.6)).endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-jet': {
		label: 'Jet Stream',
		dur: 900,
		color: 0x6fc8ff,
		needsFrom: true,
		run(ctx) {
			const g = gfx(ctx);
			const { a, d } = dirOf(ctx);
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const head = Math.min(1, t * 2.2);
					const tail = Math.max(0, t * 1.6 - 0.6);
					for (let i = 0; i < 26; i++) {
						const k = lerp(tail, head, i / 25);
						const wob = Math.sin(k * 18 + t * 30) * ctx.g * 0.05;
						const x = ctx.from.x + Math.cos(a) * d * k - Math.sin(a) * wob;
						const y = ctx.from.y + Math.sin(a) * d * k + Math.cos(a) * wob;
						g.beginFill(i % 3 ? ctx.color : 0xffffff, 0.7).drawCircle(x, y, ctx.g * (0.05 + 0.05 * Math.sin((i / 25) * Math.PI))).endFill();
					}
					if (head >= 1 && t < 0.85) {
						for (let s = 0; s < 6; s++) g.beginFill(ctx.color, 0.6).drawCircle(ctx.to.x + rand(-1, 1) * ctx.g * 0.35, ctx.to.y + rand(-1, 1) * ctx.g * 0.35, ctx.g * 0.05).endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-beam': {
		label: 'Energy Beam',
		dur: 900,
		color: 0xff4d6d,
		needsFrom: true,
		run(ctx) {
			const g = gfx(ctx);
			const { a, d } = dirOf(ctx);
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const grow = easeOut(clamp01(t * 4));
					const fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
					const w = ctx.g * (0.18 + Math.sin(t * 40) * 0.03) * fade;
					const ex = ctx.from.x + Math.cos(a) * d * grow;
					const ey = ctx.from.y + Math.sin(a) * d * grow;
					g.lineStyle(w * 2.2, ctx.color, 0.25).moveTo(ctx.from.x, ctx.from.y).lineTo(ex, ey);
					g.lineStyle(w, ctx.color, 0.7).moveTo(ctx.from.x, ctx.from.y).lineTo(ex, ey);
					g.lineStyle(w * 0.35, 0xffffff, 0.95).moveTo(ctx.from.x, ctx.from.y).lineTo(ex, ey);
					g.lineStyle(0).beginFill(0xffffff, 0.8 * fade).drawCircle(ctx.from.x, ctx.from.y, w * 0.9).endFill();
					if (grow >= 1) g.beginFill(ctx.color, 0.6 * fade).drawCircle(ex, ey, w * (1.3 + Math.sin(t * 30) * 0.3)).endFill();
				},
				[g],
			);
		},
	},

	'pr-gaze': {
		label: 'Evil Eye',
		dur: 1100,
		color: 0xff5577,
		run(ctx) {
			const g = gfx(ctx, false);
			const glow = gfx(ctx);
			const y = ctx.y - ctx.g * 0.75;
			const w = ctx.g * 0.5;
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					glow.clear();
					const open = t < 0.3 ? easeOut(t / 0.3) : t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
					const h = w * 0.55 * open;
					g.lineStyle(ctx.g * 0.03, 0x1a0a14, 1).beginFill(0xfff4f0, 0.95);
					g.moveTo(ctx.x - w, y).quadraticCurveTo(ctx.x, y - h * 2, ctx.x + w, y).quadraticCurveTo(ctx.x, y + h * 2, ctx.x - w, y).endFill();
					if (open > 0.2) g.lineStyle(0).beginFill(ctx.color, 1).drawCircle(ctx.x, y, h * 0.75).endFill().beginFill(0x120008, 1).drawEllipse(ctx.x, y, h * 0.18, h * 0.6).endFill();
					if (t > 0.35 && t < 0.85) {
						const k = (t - 0.35) / 0.5;
						glow.lineStyle(ctx.g * 0.05, ctx.color, 0.6 * (1 - k)).drawCircle(ctx.x, ctx.y, ctx.g * (0.3 + k * 0.6));
					}
				},
				[g, glow],
			);
		},
	},

	'pr-shockwave': {
		label: 'Shockwave Rings',
		dur: 900,
		color: 0xbfe3ff,
		run(ctx) {
			const g = gfx(ctx);
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					for (let i = 0; i < 3; i++) {
						const k = clamp01(t * 1.5 - i * 0.2);
						if (k <= 0 || k >= 1) continue;
						g.lineStyle(ctx.g * 0.08 * (1 - k), i === 0 ? 0xffffff : ctx.color, 0.85 * (1 - k)).drawCircle(ctx.x, ctx.y, ctx.g * (0.3 + easeOut(k) * 1.4));
					}
				},
				[g],
			);
		},
	},

	'pr-soundwave': {
		label: 'Sound Waves',
		dur: 1000,
		color: 0xd9b8ff,
		needsFrom: true,
		run(ctx) {
			const g = gfx(ctx);
			const { a, d } = dirOf(ctx);
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					for (let i = 0; i < 5; i++) {
						const k = clamp01(t * 1.6 - i * 0.14);
						if (k <= 0 || k >= 1) continue;
						const r = ctx.g * 0.25 + d * k;
						const span = 0.35 + k * 0.15;
						g.lineStyle(ctx.g * 0.06, i % 2 ? ctx.color : 0xffffff, 0.8 * (1 - k * 0.7));
						g.moveTo(ctx.from.x + Math.cos(a - span) * r, ctx.from.y + Math.sin(a - span) * r);
						g.arc(ctx.from.x, ctx.from.y, r, a - span, a + span);
					}
				},
				[g],
			);
		},
	},

	'pr-tornado': {
		label: 'Whirlwind',
		dur: 1300,
		color: 0xbff5dc,
		run(ctx) {
			const g = gfx(ctx);
			const debris = Array.from({ length: 10 }, () => ({ h: rand(0, 1), p: rand(0, Math.PI * 2) }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const grow = easeOut(clamp01(t * 3));
					const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
					const H = ctx.g * 1.6 * grow;
					const base = ctx.y + ctx.g * 0.4;
					for (let i = 0; i < 9; i++) {
						const h = i / 8;
						const r = ctx.g * (0.15 + h * 0.6);
						const yy = base - H * h;
						const ph = t * 22 + i;
						g.lineStyle(ctx.g * 0.04, i % 2 ? ctx.color : 0xffffff, 0.6 * fade).drawEllipse(ctx.x + Math.sin(ph * 0.3) * ctx.g * 0.05, yy, r, r * 0.22);
					}
					for (const b of debris) {
						const ang = b.p + t * 14;
						const r = ctx.g * (0.15 + b.h * 0.6);
						g.lineStyle(0).beginFill(0xd8d0c0, 0.8 * fade).drawCircle(ctx.x + Math.cos(ang) * r, base - H * b.h + Math.sin(ang) * r * 0.22, ctx.g * 0.035).endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-rain': {
		label: 'Downpour',
		dur: 1300,
		color: 0x8fd8ff,
		run(ctx) {
			const g = gfx(ctx);
			const drops = Array.from({ length: 40 }, () => ({ x: rand(-0.8, 0.8), t0: rand(0, 0.65), s: rand(0.8, 1.2) }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					for (const d of drops) {
						const k = (t - d.t0) / 0.3;
						if (k < 0 || k > 1) continue;
						const x = ctx.x + d.x * ctx.g;
						const y = ctx.y - ctx.g * 1.5 + ctx.g * 1.9 * k * d.s;
						g.lineStyle(ctx.g * 0.025, ctx.color, 0.8).moveTo(x, y).lineTo(x - ctx.g * 0.04, y - ctx.g * 0.18);
						if (k > 0.85) g.lineStyle(ctx.g * 0.02, 0xffffff, 0.7).drawEllipse(x, ctx.y + ctx.g * 0.4, ctx.g * 0.08, ctx.g * 0.03);
					}
				},
				[g],
			);
		},
	},

	'pr-meteors': {
		label: 'Falling Barrage',
		dur: 1400,
		color: 0xff9a4d,
		run(ctx) {
			const g = gfx(ctx);
			const rocks = Array.from({ length: 6 }, (_, i) => ({ x: rand(-0.6, 0.6), y: rand(-0.4, 0.4), t0: i * 0.1 + rand(0, 0.05) }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					for (const r of rocks) {
						const k = (t - r.t0) / 0.28;
						const tx = ctx.x + r.x * ctx.g;
						const ty = ctx.y + r.y * ctx.g;
						if (k >= 0 && k < 1) {
							const x = tx + ctx.g * 1.2 * (1 - k);
							const y = ty - ctx.g * 2 * (1 - k);
							g.lineStyle(ctx.g * 0.08, ctx.color, 0.4).moveTo(x, y).lineTo(x + ctx.g * 0.35, y - ctx.g * 0.55);
							g.lineStyle(0).beginFill(lighten(ctx.color, 0.5), 1).drawCircle(x, y, ctx.g * 0.09).endFill();
						} else if (k >= 1 && k < 2.2) {
							const e = (k - 1) / 1.2;
							g.lineStyle(0).beginFill(ctx.color, 0.7 * (1 - e)).drawCircle(tx, ty, ctx.g * (0.15 + e * 0.35)).endFill();
							g.beginFill(0xffffff, 0.8 * (1 - e)).drawCircle(tx, ty, ctx.g * 0.1 * (1 - e)).endFill();
						}
					}
				},
				[g],
			);
		},
	},

	'pr-spikes': {
		label: 'Erupting Spikes',
		dur: 1000,
		color: 0xb08a5a,
		run(ctx) {
			const g = gfx(ctx, false);
			const sp = Array.from({ length: 7 }, (_, i) => ({ x: (i - 3) * 0.2 + rand(-0.05, 0.05), h: rand(0.6, 1.1) * (1 - Math.abs(i - 3) * 0.13), t0: Math.abs(i - 3) * 0.05 }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const base = ctx.y + ctx.g * 0.4;
					const fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
					for (const s of sp) {
						const k = easeOut(clamp01((t - s.t0) * 5));
						const sink = t > 0.7 ? (t - 0.7) / 0.3 : 0;
						const h = ctx.g * s.h * k * (1 - sink);
						const x = ctx.x + s.x * ctx.g * 2;
						const w = ctx.g * 0.11;
						g.lineStyle(ctx.g * 0.02, 0x2a1f14, fade).beginFill(ctx.color, fade).drawPolygon([x - w, base, x, base - h, x + w, base]).endFill();
						g.lineStyle(0).beginFill(lighten(ctx.color, 0.45), 0.8 * fade).drawPolygon([x - w * 0.2, base, x, base - h, x + w * 0.45, base]).endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-shards': {
		label: 'Shard Spray',
		dur: 800,
		color: 0xbfe9ff,
		needsFrom: true,
		run(ctx) {
			const g = gfx(ctx);
			const { a, d } = dirOf(ctx);
			const sh = Array.from({ length: 9 }, (_, i) => ({ s: rand(-0.25, 0.25), t0: i * 0.04, sp: rand(0.9, 1.1) }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					for (const s of sh) {
						const k = clamp01((t - s.t0) / 0.55);
						if (k <= 0) continue;
						const dist = d * easeIn(k) * s.sp;
						const ang = a + s.s * (1 - k);
						const x = ctx.from.x + Math.cos(ang) * dist;
						const y = ctx.from.y + Math.sin(ang) * dist;
						const L = ctx.g * 0.22;
						const fade = k >= 1 ? Math.max(0, 1 - (t - s.t0 - 0.55) * 5) : 1;
						g.lineStyle(ctx.g * 0.05, ctx.color, 0.9 * fade).moveTo(x, y).lineTo(x - Math.cos(ang) * L, y - Math.sin(ang) * L);
						g.lineStyle(ctx.g * 0.02, 0xffffff, fade).moveTo(x, y).lineTo(x - Math.cos(ang) * L * 0.6, y - Math.sin(ang) * L * 0.6);
					}
				},
				[g],
			);
		},
	},

	'pr-swarm': {
		label: 'Insect Swarm',
		dur: 1400,
		color: 0x2a2a20,
		run(ctx) {
			const g = gfx(ctx, false);
			const bugs = Array.from({ length: 48 }, () => ({ p: rand(0, Math.PI * 2), r: rand(0.2, 0.75), w: rand(5, 11), o: rand(0, 6) }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const fade = t < 0.15 ? t / 0.15 : t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
					for (const b of bugs) {
						const ang = b.p + t * b.w;
						const x = ctx.x + Math.cos(ang) * ctx.g * b.r + Math.sin(t * 30 + b.o) * ctx.g * 0.06;
						const y = ctx.y + Math.sin(ang * 1.3) * ctx.g * b.r * 0.6 + Math.cos(t * 26 + b.o) * ctx.g * 0.06;
						g.beginFill(ctx.color, 0.95 * fade).drawCircle(x, y, ctx.g * 0.04).endFill();
						g.beginFill(0xffffff, 0.35 * fade).drawEllipse(x, y - ctx.g * 0.02, ctx.g * 0.03, ctx.g * 0.012).endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-vines': {
		label: 'Lashing Tendrils',
		dur: 1000,
		color: 0x6dbb5a,
		needsFrom: true,
		run(ctx) {
			const g = gfx(ctx, false);
			const { a, d } = dirOf(ctx);
			const n = 3;
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const reach = t < 0.4 ? easeOut(t / 0.4) : t > 0.7 ? 1 - easeIn((t - 0.7) / 0.3) : 1;
					for (let v = 0; v < n; v++) {
						const off = (v - 1) * 0.35;
						g.lineStyle(ctx.g * (0.07 - v * 0.012), v === 1 ? ctx.color : lighten(ctx.color, 0.15), 0.95);
						let first = true;
						for (let i = 0; i <= 20; i++) {
							const k = (i / 20) * reach;
							const wob = Math.sin(k * 10 + t * 18 + v * 2) * ctx.g * 0.18 * Math.sin(Math.PI * Math.min(1, k + 0.001)) + off * ctx.g * Math.sin(Math.PI * k) * 0.6;
							const x = ctx.from.x + Math.cos(a) * d * k - Math.sin(a) * wob;
							const y = ctx.from.y + Math.sin(a) * d * k + Math.cos(a) * wob;
							if (first) {
								g.moveTo(x, y);
								first = false;
							} else g.lineTo(x, y);
						}
					}
				},
				[g],
			);
		},
	},

	'pr-web': {
		label: 'Sticky Web',
		dur: 1300,
		color: 0xf2f2f2,
		run(ctx) {
			const g = gfx(ctx, false);
			const spokes = 8;
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const k = easeOut(clamp01(t * 2.5));
					const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
					const R = ctx.g * 0.75 * k;
					g.lineStyle(ctx.g * 0.018, ctx.color, 0.9 * fade);
					for (let i = 0; i < spokes; i++) {
						const ang = (i / spokes) * Math.PI * 2;
						g.moveTo(ctx.x, ctx.y).lineTo(ctx.x + Math.cos(ang) * R, ctx.y + Math.sin(ang) * R);
					}
					for (let ring = 1; ring <= 4; ring++) {
						const rr = (R * ring) / 4;
						for (let i = 0; i <= spokes; i++) {
							const ang = (i / spokes) * Math.PI * 2;
							const sag = i % 2 ? 0.88 : 1;
							const x = ctx.x + Math.cos(ang) * rr * sag;
							const y = ctx.y + Math.sin(ang) * rr * sag;
							if (i === 0) g.moveTo(x, y);
							else g.lineTo(x, y);
						}
					}
				},
				[g],
			);
		},
	},

	'pr-chains': {
		label: 'Binding Chains',
		dur: 1200,
		color: 0xb9c2d6,
		run(ctx) {
			const g = gfx(ctx, false);
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const close = easeOut(clamp01(t * 2.2));
					const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
					for (let band = 0; band < 2; band++) {
						const R = ctx.g * (1.2 - close * 0.65);
						const yy = ctx.y + (band ? 0.18 : -0.18) * ctx.g;
						const links = 14;
						for (let i = 0; i < links; i++) {
							const ang = (i / links) * Math.PI * 2 + t * (band ? 2 : -2);
							const x = ctx.x + Math.cos(ang) * R;
							const y = yy + Math.sin(ang) * R * 0.32;
							g.lineStyle(ctx.g * 0.025, i % 2 ? ctx.color : lighten(ctx.color, 0.5), fade).drawEllipse(x, y, ctx.g * 0.07, ctx.g * 0.04);
						}
					}
				},
				[g],
			);
		},
	},

	'pr-void': {
		label: 'Dark Vortex',
		dur: 1300,
		color: 0x7a3cff,
		run(ctx) {
			const g = gfx(ctx, false);
			const parts = Array.from({ length: 30 }, () => ({ a: rand(0, Math.PI * 2), r: rand(0.6, 1.2), s: rand(0.7, 1.3) }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const fade = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
					const core = ctx.g * 0.35 * Math.sin(Math.PI * clamp01(t * 1.2));
					g.beginFill(0x05010c, 0.85 * fade).drawCircle(ctx.x, ctx.y, core).endFill();
					g.lineStyle(ctx.g * 0.04, ctx.color, 0.8 * fade).drawCircle(ctx.x, ctx.y, core * 1.1);
					for (const p of parts) {
						const k = ((t * p.s * 1.6) % 1);
						const r = ctx.g * p.r * (1 - k);
						const ang = p.a + k * 5;
						g.lineStyle(0).beginFill(lighten(ctx.color, 0.3), 0.8 * fade * k).drawCircle(ctx.x + Math.cos(ang) * r, ctx.y + Math.sin(ang) * r, ctx.g * 0.035).endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-cloud': {
		label: 'Billowing Cloud',
		dur: 1500,
		color: 0x9fbf6a,
		run(ctx) {
			const g = gfx(ctx, false);
			const puffs = Array.from({ length: 12 }, () => ({ x: rand(-0.6, 0.6), y: rand(-0.4, 0.3), r: rand(0.25, 0.45), t0: rand(0, 0.25) }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					for (const p of puffs) {
						const k = clamp01((t - p.t0) / (1 - p.t0));
						const fade = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
						g.beginFill(ctx.color, 0.45 * fade).drawCircle(ctx.x + p.x * ctx.g * (1 + k * 0.4), ctx.y + p.y * ctx.g - k * ctx.g * 0.2, ctx.g * p.r * (0.6 + k * 0.7)).endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-volley': {
		label: 'Rapid Fire',
		dur: 1000,
		color: 0xfff1b0,
		needsFrom: true,
		run(ctx) {
			const g = gfx(ctx);
			const { a, d } = dirOf(ctx);
			const shots = Array.from({ length: 10 }, (_, i) => ({ t0: i * 0.06, s: rand(-0.1, 0.1) }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					for (const s of shots) {
						const k = (t - s.t0) / 0.14;
						if (k < 0 || k > 1.6) continue;
						if (k <= 1) {
							const ang = a + s.s * 0.3;
							const x = ctx.from.x + Math.cos(ang) * d * k;
							const y = ctx.from.y + Math.sin(ang) * d * k;
							g.lineStyle(ctx.g * 0.035, ctx.color, 1).moveTo(x, y).lineTo(x - Math.cos(ang) * ctx.g * 0.3, y - Math.sin(ang) * ctx.g * 0.3);
							if (k < 0.15) g.lineStyle(0).beginFill(0xffd27a, 0.9).drawCircle(ctx.from.x + Math.cos(a) * ctx.g * 0.35, ctx.from.y + Math.sin(a) * ctx.g * 0.35, ctx.g * 0.1).endFill();
						} else {
							const e = (k - 1) / 0.6;
							const x = ctx.to.x + s.s * ctx.g * 3;
							const y = ctx.to.y + s.s * ctx.g * 2;
							g.lineStyle(0).beginFill(0xfff5d0, 0.9 * (1 - e)).drawCircle(x, y, ctx.g * 0.08 * (1 + e)).endFill();
						}
					}
				},
				[g],
			);
		},
	},

	'pr-missiles': {
		label: 'Rocket Salvo',
		dur: 1300,
		color: 0xff8a3d,
		needsFrom: true,
		run(ctx) {
			const g = gfx(ctx, false);
			const fx = gfx(ctx);
			const { ux, uy, d } = dirOf(ctx);
			const ms = Array.from({ length: 3 }, (_, i) => ({ t0: i * 0.1, bend: (i - 1) * 0.6 + rand(-0.2, 0.2) }));
			const smoke = [];
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					fx.clear();
					for (const m of ms) {
						const k = (t - m.t0) / 0.45;
						const nx = -uy;
						const ny = ux;
						if (k >= 0 && k <= 1) {
							const c = Math.sin(Math.PI * k) * d * 0.35 * m.bend;
							const x = ctx.from.x + ux * d * k + nx * c;
							const y = ctx.from.y + uy * d * k + ny * c;
							smoke.push({ x, y, b: t });
							fx.beginFill(0xffe08a, 1).drawCircle(x, y, ctx.g * 0.05).endFill();
						} else if (k > 1 && k < 1.9) {
							const e = (k - 1) / 0.9;
							fx.beginFill(ctx.color, 0.8 * (1 - e)).drawCircle(ctx.to.x + m.bend * ctx.g * 0.25, ctx.to.y, ctx.g * (0.2 + e * 0.45)).endFill();
							fx.beginFill(0xffffff, 0.9 * (1 - e)).drawCircle(ctx.to.x + m.bend * ctx.g * 0.25, ctx.to.y, ctx.g * 0.12 * (1 - e)).endFill();
						}
					}
					for (const s of smoke) {
						const age = (t - s.b) / 0.4;
						if (age > 1) continue;
						g.beginFill(0x9a9a9a, 0.5 * (1 - age)).drawCircle(s.x, s.y, ctx.g * (0.04 + age * 0.08)).endFill();
					}
				},
				[g, fx],
			);
		},
	},

	'pr-zzz': {
		label: 'Sleepy Zs',
		dur: 1700,
		color: 0xbfd6ff,
		run(ctx) {
			const box = new PIXI.Container();
			ctx.add(box);
			const zs = [0, 1, 2].map((i) => {
				const z = new PIXI.Text('Z', { fontFamily: 'Arial Black, Arial', fontWeight: '900', fontSize: ctx.g * (0.4 + i * 0.14), fill: ctx.color, stroke: 0x1a2340, strokeThickness: ctx.g * 0.04 });
				z.anchor.set(0.5);
				box.addChild(z);
				return z;
			});
			return animate(
				ctx,
				this.dur,
				(t) => {
					zs.forEach((z, i) => {
						const k = clamp01((t - i * 0.18) / 0.6);
						z.alpha = k <= 0 ? 0 : Math.sin(Math.PI * k);
						z.position.set(ctx.x + ctx.g * (0.25 + i * 0.18) + Math.sin(k * 6) * ctx.g * 0.08, ctx.y - ctx.g * (0.4 + k * 0.7 + i * 0.1));
					});
				},
				[box],
			);
		},
	},

	'pr-dizzy': {
		label: 'Dizzy Stars',
		dur: 1500,
		color: 0xffe14d,
		run(ctx) {
			const g = gfx(ctx, false);
			const star = (x, y, r) => {
				const pts = [];
				for (let i = 0; i < 10; i++) {
					const ang = -Math.PI / 2 + (i * Math.PI) / 5;
					const rr = i % 2 ? r * 0.45 : r;
					pts.push(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
				}
				return pts;
			};
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const fade = t < 0.1 ? t / 0.1 : t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;
					for (let i = 0; i < 4; i++) {
						const ang = t * 9 + (i * Math.PI) / 2;
						const x = ctx.x + Math.cos(ang) * ctx.g * 0.38;
						const y = ctx.y - ctx.g * 0.55 + Math.sin(ang) * ctx.g * 0.12;
						g.lineStyle(ctx.g * 0.015, 0x5a3d00, fade).beginFill(ctx.color, fade).drawPolygon(star(x, y, ctx.g * 0.09)).endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-petals': {
		label: 'Petal Storm',
		dur: 1500,
		color: 0xffa8d0,
		run(ctx) {
			const g = gfx(ctx, false);
			const ps = Array.from({ length: 26 }, () => ({ a: rand(0, Math.PI * 2), r: rand(0.2, 0.9), w: rand(4, 8), rot: rand(0, 6), c: Math.random() < 0.3 }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const fade = t < 0.12 ? t / 0.12 : t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
					for (const p of ps) {
						const ang = p.a + t * p.w;
						const x = ctx.x + Math.cos(ang) * ctx.g * p.r;
						const y = ctx.y + Math.sin(ang) * ctx.g * p.r * 0.7 - t * ctx.g * 0.3;
						const r = p.rot + t * 10;
						const c = p.c ? 0xffffff : ctx.color;
						g.beginFill(c, 0.9 * fade);
						g.drawPolygon([x + Math.cos(r) * ctx.g * 0.07, y + Math.sin(r) * ctx.g * 0.07, x + Math.cos(r + 1.9) * ctx.g * 0.03, y + Math.sin(r + 1.9) * ctx.g * 0.03, x - Math.cos(r) * ctx.g * 0.07, y - Math.sin(r) * ctx.g * 0.07, x + Math.cos(r - 1.9) * ctx.g * 0.03, y + Math.sin(r - 1.9) * ctx.g * 0.03]);
						g.endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-tether': {
		label: 'Life Drain Tether',
		dur: 1300,
		color: 0xff3355,
		needsFrom: true,
		run(ctx) {
			const g = gfx(ctx);
			const { d, a } = dirOf(ctx);
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const fade = t < 0.15 ? t / 0.15 : t > 0.85 ? 1 - (t - 0.85) / 0.15 : 1;
					g.lineStyle(ctx.g * 0.05, ctx.color, 0.5 * fade);
					for (let i = 0; i <= 24; i++) {
						const k = i / 24;
						const wob = Math.sin(k * 14 - t * 30) * ctx.g * 0.08 * Math.sin(Math.PI * k);
						const x = ctx.to.x - Math.cos(a) * d * k - Math.sin(a) * wob;
						const y = ctx.to.y - Math.sin(a) * d * k + Math.cos(a) * wob;
						if (i === 0) g.moveTo(x, y);
						else g.lineTo(x, y);
					}
					for (let i = 0; i < 6; i++) {
						const k = ((t * 1.8 + i / 6) % 1);
						g.lineStyle(0).beginFill(lighten(ctx.color, 0.4), fade).drawCircle(ctx.to.x - Math.cos(a) * d * k, ctx.to.y - Math.sin(a) * d * k, ctx.g * 0.06).endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-glyph': {
		label: 'Rune Circle',
		dur: 1400,
		color: 0xf2c45a,
		run(ctx) {
			const g = gfx(ctx);
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const k = easeOut(clamp01(t * 2.5));
					const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
					const R = ctx.g * 0.75 * k;
					const rot = t * 2;
					g.lineStyle(ctx.g * 0.03, ctx.color, 0.9 * fade).drawCircle(ctx.x, ctx.y, R).drawCircle(ctx.x, ctx.y, R * 0.78);
					const pts = [];
					for (let i = 0; i < 6; i++) pts.push(ctx.x + Math.cos(rot + (i * Math.PI) / 3) * R * 0.78, ctx.y + Math.sin(rot + (i * Math.PI) / 3) * R * 0.78);
					g.moveTo(pts[0], pts[1]).lineTo(pts[4], pts[5]).lineTo(pts[8], pts[9]).lineTo(pts[0], pts[1]);
					g.moveTo(pts[2], pts[3]).lineTo(pts[6], pts[7]).lineTo(pts[10], pts[11]).lineTo(pts[2], pts[3]);
					for (let i = 0; i < 12; i++) {
						const ang = -rot + (i * Math.PI) / 6;
						g.lineStyle(ctx.g * 0.02, 0xffffff, 0.8 * fade).moveTo(ctx.x + Math.cos(ang) * R * 0.85, ctx.y + Math.sin(ang) * R * 0.85).lineTo(ctx.x + Math.cos(ang) * R * 0.95, ctx.y + Math.sin(ang) * R * 0.95);
					}
				},
				[g],
			);
		},
	},

	'pr-cards': {
		label: 'Flying Cards',
		dur: 1100,
		color: 0xffffff,
		needsFrom: true,
		run(ctx) {
			const g = gfx(ctx, false);
			const { a, d } = dirOf(ctx);
			const cards = Array.from({ length: 5 }, (_, i) => ({ t0: i * 0.07, s: (i - 2) * 0.22, suit: [0xd23a3a, 0x222222][i % 2] }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					for (const c of cards) {
						const k = clamp01((t - c.t0) / 0.5);
						if (k <= 0) continue;
						const fade = k >= 1 ? Math.max(0, 1 - (t - c.t0 - 0.5) * 4) : 1;
						const ang = a + c.s * Math.sin(Math.PI * k);
						const x = ctx.from.x + Math.cos(ang) * d * k;
						const y = ctx.from.y + Math.sin(ang) * d * k;
						const rot = k * 12 + c.s;
						const w = ctx.g * 0.13;
						const h = ctx.g * 0.19;
						const cs = Math.cos(rot);
						const sn = Math.sin(rot);
						const corner = (px, py) => [x + px * cs - py * sn, y + px * sn + py * cs];
						g.lineStyle(ctx.g * 0.012, 0x333333, fade).beginFill(ctx.color, fade).drawPolygon([...corner(-w, -h), ...corner(w, -h), ...corner(w, h), ...corner(-w, h)]).endFill();
						g.lineStyle(0).beginFill(c.suit, fade).drawCircle(x, y, ctx.g * 0.045).endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-steal': {
		label: 'Snatch',
		dur: 1000,
		color: 0xffd34d,
		needsFrom: true,
		run(ctx) {
			const g = gfx(ctx, false);
			const { d, a } = dirOf(ctx);
			const coins = Array.from({ length: 7 }, (_, i) => ({ t0: i * 0.05, s: rand(-0.4, 0.4) }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					for (const c of coins) {
						const k = clamp01((t - c.t0) / 0.6);
						if (k <= 0 || k >= 1) continue;
						const ang = a + Math.PI + c.s * Math.sin(Math.PI * k);
						const x = ctx.to.x + Math.cos(ang) * d * easeIn(k);
						const y = ctx.to.y + Math.sin(ang) * d * easeIn(k) - Math.sin(Math.PI * k) * ctx.g * 0.5;
						g.lineStyle(ctx.g * 0.015, 0x7a5200, 1).beginFill(ctx.color, 1).drawEllipse(x, y, ctx.g * 0.06 * Math.abs(Math.cos(k * 12)) + 1, ctx.g * 0.06).endFill();
					}
				},
				[g],
			);
		},
	},

	'pr-laugh': {
		label: 'Mocking Laughter',
		dur: 1400,
		color: 0xff6fb0,
		run(ctx) {
			const box = new PIXI.Container();
			ctx.add(box);
			const hs = ['HA', 'HA', 'HA!'].map((s, i) => {
				const tx = new PIXI.Text(s, { fontFamily: 'Arial Black, Arial', fontWeight: '900', fontSize: ctx.g * 0.38, fill: ctx.color, stroke: 0x1a0a14, strokeThickness: ctx.g * 0.04 });
				tx.anchor.set(0.5);
				box.addChild(tx);
				return tx;
			});
			return animate(
				ctx,
				this.dur,
				(t) => {
					hs.forEach((h, i) => {
						const k = clamp01((t - i * 0.15) / 0.65);
						h.alpha = k <= 0 ? 0 : Math.sin(Math.PI * k);
						h.scale.set(0.7 + easeOut(Math.min(1, k * 3)) * 0.4);
						h.position.set(ctx.x + (i - 1) * ctx.g * 0.45, ctx.y - ctx.g * (0.5 + k * 0.5) + Math.sin(t * 40 + i) * ctx.g * 0.03);
					});
				},
				[box],
			);
		},
	},

	'pr-pillar': {
		label: 'Pillar of Light',
		dur: 1200,
		color: 0xfff1b8,
		run(ctx) {
			const g = gfx(ctx);
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const drop = easeIn(clamp01(t * 4));
					const fade = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
					const top = ctx.y - ctx.g * 3;
					const bottom = lerp(top, ctx.y + ctx.g * 0.3, drop);
					const w = ctx.g * (0.35 + Math.sin(t * 25) * 0.03) * fade;
					g.beginFill(ctx.color, 0.3 * fade).drawRect(ctx.x - w, top, w * 2, bottom - top).endFill();
					g.beginFill(0xffffff, 0.7 * fade).drawRect(ctx.x - w * 0.35, top, w * 0.7, bottom - top).endFill();
					if (drop >= 1) g.beginFill(ctx.color, 0.5 * fade).drawEllipse(ctx.x, ctx.y + ctx.g * 0.3, ctx.g * (0.5 + t * 0.4), ctx.g * 0.15).endFill();
				},
				[g],
			);
		},
	},

	'pr-chain-lightning': {
		label: 'Arcing Lightning',
		dur: 800,
		color: 0xbfd8ff,
		needsFrom: true,
		run(ctx) {
			const g = gfx(ctx);
			const { d, a } = dirOf(ctx);
			let jitter = 0;
			let path = [];
			const mk = () => {
				path = [];
				for (let i = 0; i <= 12; i++) {
					const k = i / 12;
					const off = i === 0 || i === 12 ? 0 : rand(-1, 1) * ctx.g * 0.25;
					path.push([ctx.from.x + Math.cos(a) * d * k - Math.sin(a) * off, ctx.from.y + Math.sin(a) * d * k + Math.cos(a) * off]);
				}
			};
			mk();
			return animate(
				ctx,
				this.dur,
				(t) => {
					if (t * this.dur - jitter > 60) {
						mk();
						jitter = t * this.dur;
					}
					g.clear();
					const fade = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
					for (const [w, c, al] of [
						[0.14, ctx.color, 0.35],
						[0.05, 0xffffff, 1],
					]) {
						g.lineStyle(ctx.g * w, c, al * fade).moveTo(...path[0]);
						for (const p of path.slice(1)) g.lineTo(...p);
					}
					g.lineStyle(0).beginFill(ctx.color, 0.6 * fade).drawCircle(ctx.to.x, ctx.to.y, ctx.g * (0.25 + Math.random() * 0.1)).endFill();
				},
				[g],
			);
		},
	},

	'pr-wisps': {
		label: 'Spirit Wisps',
		dur: 1400,
		color: 0x7fd8ff,
		run(ctx) {
			const g = gfx(ctx);
			const ws = Array.from({ length: 5 }, (_, i) => ({ p: (i / 5) * Math.PI * 2 }));
			return animate(
				ctx,
				this.dur,
				(t) => {
					g.clear();
					const fade = t < 0.15 ? t / 0.15 : t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
					const R = ctx.g * (0.7 - t * 0.45);
					for (const w of ws) {
						const ang = w.p + t * 7;
						const x = ctx.x + Math.cos(ang) * R;
						const y = ctx.y + Math.sin(ang) * R * 0.6;
						for (let k = 0; k < 4; k++) g.beginFill(k ? ctx.color : 0xffffff, (0.7 - k * 0.15) * fade).drawCircle(x - Math.cos(ang + 1.6) * k * ctx.g * 0.05, y - k * ctx.g * 0.05, ctx.g * (0.08 - k * 0.012)).endFill();
					}
				},
				[g],
			);
		},
	},
};

export const PROC_IDS = Object.keys(PROC);
export const isProc = (id) => typeof id === 'string' && id.startsWith('pr-') && !!PROC[id];
