import blackHole from './sf/black-hole.mjs';
import blood from './sf/blood.mjs';
import bubbles from './sf/bubbles.mjs';
import embers from './sf/embers.mjs';
import energy from './sf/energy.mjs';
import explosion from './sf/explosion.mjs';
import fallingLeaves from './sf/falling-leaves.mjs';
import fire from './sf/fire.mjs';
import fireflies from './sf/fireflies.mjs';
import fog from './sf/fog.mjs';
import heal from './sf/heal.mjs';
import holyLight from './sf/holy-light.mjs';
import ice from './sf/ice.mjs';
import impact from './sf/impact.mjs';
import lightning from './sf/lightning.mjs';
import movement from './sf/movement.mjs';
import muzzleFlash from './sf/muzzle-flash.mjs';
import pickup from './sf/pickup.mjs';
import poison from './sf/poison.mjs';
import powerUp from './sf/power-up.mjs';
import rain from './sf/rain.mjs';
import shield from './sf/shield.mjs';
import slash from './sf/slash.mjs';
import snow from './sf/snow.mjs';
import sparkle from './sf/sparkle.mjs';
import { EXTRA } from './sf/extra.mjs';
import { hex, resample } from './sf/kit.mjs';
import { createFx } from './pfx/core/index.js';
import * as fireBreath from './pfx/fx/fire/fire-breath.js';
import * as waterJet from './pfx/fx/water/water-jet.js';
import * as pfxTornado from './pfx/fx/nature/tornado.js';
import * as pfxWisp from './pfx/fx/critters/wisp.js';
import * as pfxPoof from './pfx/fx/spawn/poof.js';

/**
 * The pixel effects: Sprite Fusion's open source pixel art VFX (scripts/sf), plus the ones drawn for this module
 * in the same style (scripts/sf/extra.mjs), each set up for one role in a fight.
 *
 * Every entry: label and cat (editor), as (the original effect whose sounds it uses), dur (seconds, how long it
 * reads as playing), cap (seconds before it fades out, whatever is still on screen), hit (seconds until it lands,
 * or 'hook' for the moment the effect itself reports contact), box (art pixels around the target it may draw in,
 * x0 y0 x1 y1), line (true: it travels from the user, the box also covers the user), ramp (true: it takes the
 * element's colors as a palette; otherwise hue says how to hue-rotate it), and make(P), which returns its parts:
 * [{ fx: () => effect, at?: seconds, after?: index of a part whose landing starts this one, tick?(fx, t) }].
 *
 * P is where it plays, in Sprite Fusion world units (2 per art pixel): x, y (target centre), ground, head,
 * from ([x, y] user centre), hand ({x, y, a}: the user's edge facing the target), angle, facing (1 right, -1 left),
 * dist, seed, ramp(n) / hexRamp(n) (the element's colors, or undefined to keep the effect's own), target and
 * source (actors: feet, head, hand, silhouette), and hook: the shake / flash / ripple callbacks every effect gets,
 * which is how the runtime knows the moment a part lands.
 */

/* ------------------------------------------------------------------ */
/*  Element palettes, bright to dark                                   */
/* ------------------------------------------------------------------ */

export const ELEMENT_RAMPS = {
	fire: ['#ffffff', '#fff3a6', '#ffe26b', '#ffc23d', '#ff8a2a', '#f2561d', '#c9281f', '#8a1f17', '#4a1712'],
	ice: ['#ffffff', '#dcfbff', '#a6ecff', '#62c8f4', '#3a8bd8', '#2c58aa', '#212f6b', '#151a3d'],
	bolt: ['#ffffff', '#fffbd6', '#fff27a', '#ffe14d', '#f2b62a', '#c97f1b', '#7e4a16', '#3d220d'],
	air: ['#ffffff', '#e6fff2', '#b8f5d6', '#7fe3b0', '#45c08a', '#2b8a6a', '#1d5a4c', '#12332e'],
	earth: ['#fff6e0', '#f2d9a6', '#d9b47a', '#c49a5a', '#9c7440', '#74522c', '#4a331c', '#2a1d10'],
	light: ['#ffffff', '#fffbe2', '#fff0a6', '#ffd862', '#f6aa3c', '#cf722b', '#7e3c1f', '#40200f'],
	dark: ['#ffffff', '#f4ddff', '#d6a0ff', '#a862ff', '#773ae4', '#4c25ab', '#2b1569', '#170b3b'],
	poison: ['#f6ffc2', '#cfff63', '#8eea3f', '#55b92f', '#318232', '#23552e', '#173320', '#0e1d14'],
};
const NAMED = {
	crimson: ['#ffffff', '#ffe8e0', '#ffb0a0', '#ff5a4a', '#d42a3a', '#8f1630', '#4f0c22', '#26060f'],
	steel: ['#ffffff', '#e8f1ff', '#b8c9e8', '#62c8f4', '#3a8bd8', '#2c58aa', '#212f6b'],
	gold: ELEMENT_RAMPS.light,
	pink: ['#ffffff', '#ffe0f0', '#ffb3d9', '#ff7fbf', '#e0559f', '#a8357a', '#6a2052', '#3a112e'],
	ink: ['#ffffff', '#d9dde8', '#a9b0c4', '#7a829c', '#525a74', '#363c52', '#22263a', '#121420'],
	shadow: ['#e8dcff', '#b9a6e0', '#8a74b8', '#5e4c8a', '#3e3060', '#281e40', '#181228', '#0c0814'],
	heal: ['#ffffff', '#e6ffdc', '#acff92', '#62e26a', '#30b55b', '#20804c', '#175237', '#0f3125'],
	rose: ['#ffffff', '#ffe4ea', '#ffb0c4', '#ff7898', '#e04870', '#a82c50', '#6a1a34', '#3a0e1c'],
};
export const named = (name, n = 8) => resample(NAMED[name].map(hex), n);
const namedHex = (name, n = 8) => resample(NAMED[name], n);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const one = (fx, more = {}) => [{ fx, ...more }];
const or = (a, b) => (a?.length ? a : b);
const sky = (P, k = 1) => [P.x - 130 * k * P.facing, P.y - 470 * k];
const handOf = (P) => [P.hand.x, P.hand.y];
const nearby = (P, i, r = 34) => {
	const a = i * 2.4 + P.seed;
	const d = r * (0.35 + ((i * 0.37) % 1) * 0.65);
	return [P.x + Math.cos(a) * d, P.y + Math.sin(a) * d * 0.7];
};

/**
 * An effect from the pixelfx library (scripts/pfx: patch-gg/pixelfx, MIT). Those draw in art pixels and face right;
 * P is in Sprite Fusion units (2 per art pixel), so positions are halved, and a target to the left mirrors the
 * effect instead of turning it upside down. Our palettes run bright to dark, theirs dark to bright.
 */
function lib(mod, P, at, { aim = false, ramp = true, ...opts } = {}) {
	const o = { x: at[0] / 2, y: at[1] / 2, seed: (P.seed % 997) + 1, ...opts };
	if (aim) {
		o.flip = Math.cos(P.angle) < 0;
		o.angle = o.flip ? P.angle - Math.PI : P.angle;
	}
	const n = mod.meta?.options?.palette?.length;
	const pal = ramp && n ? P.hexRamp(n) : undefined;
	if (pal) o.palette = [...pal].reverse();
	return createFx(mod, o);
}

const W = 'Pixel Weather';

/* ------------------------------------------------------------------ */
/*  The catalog                                                        */
/* ------------------------------------------------------------------ */

export const PIXEL = {
	/* ---- Strikes ---- */
	'sf-slash': {
		label: 'Slash', cat: 'Pixel Strikes', as: 'slash-down-2', ramp: true, dur: 0.45, cap: 0.9, hit: 0.06, box: [-60, -60, 60, 60],
		make: (P) => one(() => slash({ x: P.x - P.facing * 8, y: P.y - 4, radius: 74, width: 22, facing: P.facing, tilt: -0.38 + ((P.seed % 5) - 2) * 0.08, ramp: P.ramp(7), ground: P.ground, ...P.hook, seed: P.seed })),
	},
	'sf-slash-up': {
		label: 'Rising slash', cat: 'Pixel Strikes', as: 'slash-up-2', ramp: true, dur: 0.45, cap: 0.9, hit: 0.06, box: [-60, -60, 60, 60],
		make: (P) => one(() => slash({ x: P.x - P.facing * 8, y: P.y, radius: 72, width: 22, facing: P.facing, tilt: 0.3, from: 2.3, to: 5.6, ramp: P.ramp(7), ground: P.ground, ...P.hook, seed: P.seed })),
	},
	'sf-slash-wide': {
		label: 'Wide sweep', cat: 'Pixel Strikes', as: 'pr-sweep', ramp: true, dur: 0.5, cap: 1, hit: 0.07, box: [-80, -60, 80, 60],
		make: (P) => one(() => slash({ x: P.x - P.facing * 18, y: P.y - 2, radius: 104, squash: 0.42, tilt: -0.1, from: -3.0, to: 1.3, width: 26, sweep: 0.07, facing: P.facing, ramp: P.ramp(7), ground: P.ground, ...P.hook, seed: P.seed, sparks: 14 })),
	},
	'sf-slash-heavy': {
		label: 'Heavy cleave', cat: 'Pixel Strikes', as: 'slash-down-red-3', ramp: true, dur: 0.5, cap: 1, hit: 0.07, box: [-70, -70, 70, 70],
		make: (P) => one(() => slash({ x: P.x - P.facing * 10, y: P.y - 6, radius: 92, width: 34, facing: P.facing, tilt: -0.5, sweep: 0.07, hold: 0.08, ramp: or(P.ramp(7), named('crimson', 7)), ground: P.ground, ...P.hook, seed: P.seed, sparks: 18 })),
	},
	'sf-slash-combo': {
		label: 'Slash combo', cat: 'Pixel Strikes', as: 'slash-down-circ-2', ramp: true, dur: 0.6, cap: 1.1, hit: 0.06, box: [-60, -60, 60, 60],
		make: (P) => [
			{ fx: () => slash({ x: P.x - P.facing * 4, y: P.y - 4, radius: 64, squash: 0.55, tilt: -0.55, from: -2.7, to: 0.65, width: 17, facing: P.facing, ramp: P.ramp(7), ground: P.ground, ...P.hook, seed: P.seed }) },
			{ at: 0.16, fx: () => slash({ x: P.x + P.facing * 8, y: P.y - 12, radius: 64, squash: 0.55, tilt: 0.6, from: 0.55, to: -2.75, width: 17, facing: P.facing, ramp: P.ramp(7), ground: P.ground, ...P.hook, seed: P.seed + 1 }) },
		],
	},
	'sf-slash-x': {
		label: 'Cross slash', cat: 'Pixel Strikes', as: 'slash-down-circ-3', ramp: true, dur: 0.6, cap: 1.1, hit: 0.06, box: [-70, -70, 70, 70],
		make: (P) => [
			{ fx: () => slash({ x: P.x, y: P.y - 4, radius: 80, width: 24, facing: P.facing, tilt: -0.55, ramp: P.ramp(7), ground: P.ground, ...P.hook, seed: P.seed }) },
			{ at: 0.09, fx: () => slash({ x: P.x, y: P.y - 4, radius: 80, width: 24, facing: -P.facing, tilt: -0.55, ramp: P.ramp(7), ground: P.ground, ...P.hook, seed: P.seed + 1 }) },
		],
	},
	'sf-thrust': {
		label: 'Thrust', cat: 'Pixel Strikes', as: 'slash-front-2', ramp: true, dur: 0.4, cap: 0.8, hit: 0.06, box: [-70, -50, 70, 50],
		make: (P) => one(() => slash({ x: P.x - Math.cos(P.angle) * 14, y: P.y - Math.sin(P.angle) * 14, radius: 78, squash: 0.24, tilt: P.angle, facing: 1, from: -2.95, to: -0.2, width: 22, sweep: 0.05, ramp: P.ramp(7), ground: P.ground, ...P.hook, seed: P.seed, sparks: 8 })),
	},
	'sf-claw': {
		label: 'Claw marks', cat: 'Pixel Strikes', as: 'pr-claw', ramp: true, dur: 0.45, cap: 0.9, hit: 0.06, box: [-60, -60, 60, 60],
		make: (P) =>
			[-1, 0, 1].map((i) => ({
				at: (i + 1) * 0.035,
				fx: () => slash({ x: P.x + i * 16 * P.facing, y: P.y - 4 - i * 12, radius: 62, squash: 0.26, tilt: 0.95, from: -2.9, to: -0.25, width: 13, sweep: 0.05, facing: P.facing, ramp: or(P.ramp(7), named('crimson', 7)), ground: P.ground, ...P.hook, seed: P.seed + i, sparks: 4 }),
			})),
	},

	/* ---- Hits ---- */
	'sf-impact': {
		label: 'Impact', cat: 'Pixel Hits', as: 'px-impact-sym-1', ramp: true, dur: 0.3, cap: 0.8, hit: 0, box: [-70, -45, 70, 60],
		make: (P) => one(() => impact({ x: P.x, y: P.y, angle: P.angle, size: 1.2, ramp: P.ramp(6), ground: P.ground, ...P.hook, seed: P.seed })),
	},
	'sf-impact-heavy': {
		label: 'Heavy impact', cat: 'Pixel Hits', as: 'px-impact-sym-3', ramp: true, dur: 0.5, cap: 1, hit: 0, box: [-90, -70, 90, 60],
		make: (P) => [
			{ fx: () => impact({ x: P.x, y: P.y, angle: P.angle, size: 2, ramp: P.ramp(6), ground: P.ground, ...P.hook, seed: P.seed }) },
			{ fx: () => EXTRA.shockwave({ x: P.x, y: P.y + 10, size: 0.9, ramp: P.ramp(8), ...P.hook, seed: P.seed }) },
		],
	},
	'sf-spark': {
		label: 'Spark hit', cat: 'Pixel Hits', as: 'px-spark-burst', ramp: true, dur: 0.25, cap: 0.7, hit: 0, box: [-50, -35, 50, 50],
		make: (P) => one(() => impact({ x: P.x, y: P.y, angle: P.angle, size: 0.7, ramp: P.ramp(6), ground: P.ground, ...P.hook, seed: P.seed })),
	},
	'sf-ricochet': {
		label: 'Ricochet', cat: 'Pixel Hits', as: 'px-impact-dir-1', ramp: true, dur: 0.5, cap: 1, hit: 0, box: [-50, -40, 90, 30],
		make: (P) => one(() => impact({ kind: 'ricochet', x: P.x, y: P.ground - 4, angle: P.angle, surface: hex('#6e6248'), ground: P.ground, ramp: P.ramp(6), ...P.hook, seed: P.seed })),
	},
	'sf-blood': {
		label: 'Blood spray', cat: 'Pixel Hits', as: 'px-splatter-burst-1', ramp: true, dur: 0.6, cap: 1.4, hit: 0, box: [-110, -60, 110, 40],
		make: (P) => one(() => blood({ x: P.x, y: P.y, angle: P.angle, size: 0.8, ramp: P.ramp(6), ground: P.ground, stainLife: 0.8, ...P.hook, seed: P.seed })),
	},
	'sf-shockwave': {
		label: 'Shockwave', cat: 'Pixel Hits', as: 'pr-shockwave', ramp: true, dur: 0.8, cap: 1.1, hit: 0, box: [-80, -50, 80, 50],
		make: (P) => one(() => EXTRA.shockwave({ x: P.x, y: P.y + 8, size: 1.1, ramp: P.ramp(8), ...P.hook, seed: P.seed })),
	},

	/* ---- Explosions ---- */
	'sf-explosion': {
		label: 'Explosion', cat: 'Pixel Explosions', as: 'px-explosion-sym-1', hue: 25, dur: 0.9, cap: 1.7, hit: 0, box: [-130, -170, 130, 45],
		make: (P) => one(() => explosion({ x: P.x, ground: P.ground, size: 0.9, chunks: 14, ...P.hook, seed: P.seed })),
	},
	'sf-explosion-big': {
		label: 'Big explosion', cat: 'Pixel Explosions', as: 'px-explosion-epic-1', hue: 25, dur: 1.1, cap: 2.1, hit: 0, box: [-200, -250, 200, 55],
		make: (P) => one(() => explosion({ x: P.x, ground: P.ground, size: 1.5, chunks: 24, ...P.hook, seed: P.seed })),
	},
	'sf-explosion-small': {
		label: 'Small blast', cat: 'Pixel Explosions', as: 'px-explosion-sym-2', hue: 25, dur: 0.6, cap: 1.2, hit: 0, box: [-80, -110, 80, 35],
		make: (P) => one(() => explosion({ x: P.x, ground: P.ground, size: 0.55, chunks: 6, ...P.hook, seed: P.seed })),
	},
	'sf-quake': {
		label: 'Earth burst', cat: 'Pixel Explosions', as: 'px-impact-sym-3', hue: 32, dur: 0.9, cap: 1.6, hit: 0, box: [-150, -170, 150, 45],
		make: (P) => one(() => explosion({ x: P.x, ground: P.ground, size: 1, fire: 0, earth: 2.6, shockwave: 110, chunks: 22, ...P.hook, seed: P.seed })),
	},

	/* ---- Elements ---- */
	'sf-burn': {
		label: 'Burning', cat: 'Pixel Elements', as: 'px-fire-loop-3b', ramp: true, dur: 1.2, cap: 2.2, hit: 0, box: [-45, -90, 45, 15],
		make: (P) => one(() => fire({ actor: P.target, duration: 1.1, size: 1.6, ramp: P.ramp(9), ...P.hook, seed: P.seed })),
	},
	'sf-lightning': {
		label: 'Lightning strike', cat: 'Pixel Elements', as: 'px-lightning-strike', ramp: true, dur: 1.2, cap: 2, hit: 'hook', box: [-140, -215, 140, 60],
		make: (P) => one(() => lightning({ kind: 'strike', x: P.x, ground: P.ground, top: P.ground - 400, clouds: false, strokes: 2, colors: P.ramp(7), ...P.hook, seed: P.seed })),
	},
	'sf-lightning-storm': {
		label: 'Thunderstorm', cat: 'Pixel Elements', as: 'px-lightning-strike', ramp: true, dur: 1.6, cap: 2.5, hit: 'hook', box: [-170, -240, 170, 60],
		make: (P) => one(() => lightning({ kind: 'strike', x: P.x, ground: P.ground, top: P.ground - 440, clouds: false, strokes: 3, colors: P.ramp(7), ...P.hook, seed: P.seed })),
	},
	'sf-zap': {
		label: 'Electric burst', cat: 'Pixel Elements', as: 'px-lightning-burst-1', ramp: true, dur: 0.5, cap: 1.2, hit: 0, box: [-90, -70, 90, 60],
		make: (P) => one(() => lightning({ kind: 'impact', x: P.x, y: P.y, size: 0.8, sparks: 36, colors: P.ramp(7), ...P.hook, seed: P.seed })),
	},
	'sf-arc': {
		label: 'Chain lightning', cat: 'Pixel Bolts', as: 'pr-chain-lightning', ramp: true, line: true, dur: 0.6, cap: 1.3, hit: 'hook', box: [-50, -50, 50, 50],
		make: (P) => one(() => lightning({ kind: 'arc', from: handOf(P), to: [[P.x, P.y]], duration: 0.5, colors: P.ramp(7), ...P.hook, seed: P.seed })),
	},
	'sf-electrified': {
		label: 'Electrified', cat: 'Pixel Elements', as: 'px-lightning-aura', ramp: true, dur: 1.1, cap: 1.8, hit: 0, box: [-50, -70, 50, 35],
		make: (P) => one(() => lightning({ kind: 'crackle', actor: P.target, duration: 1.0, colors: P.ramp(7), ...P.hook, seed: P.seed })),
	},
	'sf-ice-nova': {
		label: 'Frost nova', cat: 'Pixel Elements', as: 'px-impact-sym-2', ramp: true, dur: 1.1, cap: 2, hit: 'hook', box: [-110, -110, 110, 45],
		make: (P) => one(() => ice({ kind: 'nova', x: P.x, ground: P.ground, size: 0.6, reach: 170, charge: 0.3, hold: 0.25, palette: P.hexRamp(8), ...P.hook, seed: P.seed })),
	},
	'sf-ice-spikes': {
		label: 'Ice spikes', cat: 'Pixel Elements', as: 'pr-spikes', ramp: true, dur: 1, cap: 1.7, hit: 'hook', box: [-90, -80, 90, 30],
		make: (P) => one(() => ice({ kind: 'spikes', x: P.x - P.facing * 96, dir: P.facing, count: 3, spacing: 34, ground: P.ground, size: 0.8, palette: P.hexRamp(8), ...P.hook, seed: P.seed })),
	},
	'sf-rock-spikes': {
		label: 'Erupting spikes', cat: 'Pixel Elements', as: 'pr-spikes', ramp: true, dur: 1, cap: 1.7, hit: 'hook', box: [-90, -80, 90, 30],
		make: (P) => one(() => ice({ kind: 'spikes', x: P.x - P.facing * 96, dir: P.facing, count: 3, spacing: 34, ground: P.ground, size: 0.85, palette: or(P.hexRamp(8), ELEMENT_RAMPS.earth), ...P.hook, seed: P.seed })),
	},
	'sf-vines': {
		label: 'Lashing vines', cat: 'Pixel Bolts', as: 'pr-vines', ramp: true, line: true, dur: 0.85, cap: 1.2, hit: 'hook', box: [-40, -40, 40, 40],
		make: (P) => one(() => EXTRA.jet({ from: handOf(P), to: [P.x, P.y], size: 1.3, ramp: or(P.ramp(8), named('heal')), ...P.hook, seed: P.seed })),
	},
	'sf-ice-crystals': {
		label: 'Ice crystals', cat: 'Pixel Elements', as: 'pr-shards', ramp: true, dur: 0.9, cap: 1.7, hit: 0, box: [-70, -85, 70, 40],
		make: (P) => one(() => ice({ kind: 'crystals', x: P.x, ground: P.ground, size: 0.9, hold: 0.6, end: 'shatter', palette: P.hexRamp(8), ...P.hook, seed: P.seed })),
	},
	'sf-ice-shatter': {
		label: 'Ice shatter', cat: 'Pixel Elements', as: 'px-impact-sym-2', ramp: true, dur: 0.9, cap: 1.7, hit: 'hook', box: [-90, -100, 140, 40],
		make: (P) => one(() => ice({ kind: 'shatter', x: P.x, ground: P.ground, size: 0.8, crack: 0.25, angle: P.facing > 0 ? 0 : Math.PI, palette: P.hexRamp(8), ...P.hook, seed: P.seed })),
	},
	'sf-freeze': {
		label: 'Frozen solid', cat: 'Pixel Elements', as: 'px-impact-sym-2', ramp: true, dur: 1.3, cap: 2.2, hit: 'hook', box: [-90, -110, 90, 45],
		make: (P) => one(() => ice({ kind: 'freeze', actor: P.target, ground: P.ground, hold: 0.6, palette: P.hexRamp(8), ...P.hook, seed: P.seed })),
	},
	'sf-poison-cloud': {
		label: 'Toxic cloud', cat: 'Pixel Elements', as: 'px-poison-cloud', ramp: true, dur: 1.2, cap: 2.2, hit: 'hook', box: [-120, -100, 120, 45],
		make: (P) => one(() => poison({ kind: 'cloud', x: P.x, ground: P.ground, size: 0.8, colors: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-poison-puddle': {
		label: 'Toxic puddle', cat: 'Pixel Elements', as: 'px-poison-bubbles', ramp: true, dur: 1.2, cap: 2.2, hit: 0, box: [-100, -100, 100, 45],
		make: (P) => one(() => poison({ kind: 'puddle', x: P.x, ground: P.ground, size: 0.7, colors: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-poisoned': {
		label: 'Poisoned', cat: 'Pixel Elements', as: 'px-poison-bubbles', ramp: true, dur: 1.2, cap: 2, hit: 0, box: [-50, -70, 50, 25],
		make: (P) => one(() => poison({ kind: 'aura', actor: P.target, ground: P.ground, colors: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-breath': {
		label: 'Breath', cat: 'Pixel Bolts', as: 'pr-breath', ramp: true, line: true, dur: 1.3, cap: 1.7, stopAt: 1.15, hit: 0.35, box: [-90, -70, 90, 60],
		make: (P) => one(() => lib(fireBreath, P, handOf(P), { aim: true })),
	},
	'sf-jet': {
		label: 'Jet stream', cat: 'Pixel Bolts', as: 'pr-jet', hue: 205, line: true, dur: 1.1, cap: 1.5, stopAt: 0.95, hit: 0.3, box: [-100, -50, 100, 50],
		make: (P) => one(() => lib(waterJet, P, handOf(P), { aim: true, ramp: false })),
	},
	'sf-tornado': {
		label: 'Whirlwind', cat: 'Pixel Elements', as: 'pr-tornado', ramp: true, dur: 1.4, cap: 1.9, stopAt: 1.4, hit: 0.25, box: [-70, -110, 70, 30],
		make: (P) => one(() => lib(pfxTornado, P, [P.x, P.ground], { height: 76 })),
	},

	/* ---- Magic ---- */
	'sf-charge': {
		label: 'Power gathering', cat: 'Pixel Magic', as: 'charge-back', ramp: true, dur: 0.75, cap: 1.4, hit: 0.7, box: [-110, -130, 110, 70],
		make: (P) => one(() => energy({ kind: 'charge', x: P.x, y: P.y, charge: 0.7, colors: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-glyph': {
		label: 'Rune circle', cat: 'Pixel Magic', as: 'pr-glyph', ramp: true, dur: 1.1, cap: 1.6, hit: 0.3, box: [-45, -60, 45, 30],
		make: (P) => one(() => EXTRA.glyph({ x: P.x, ground: P.ground, ramp: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-orb': {
		label: 'Floating orb', cat: 'Pixel Magic', as: 'cast-glow-6', ramp: true, dur: 1, cap: 1.3, hit: 0.2, box: [-55, -60, 55, 55],
		make: (P) => one(() => energy({ kind: 'orb', x: P.x, y: P.y - 20, radius: 13, every: [9, 9], colors: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-beam': {
		label: 'Energy beam', cat: 'Pixel Bolts', as: 'pr-beam', ramp: true, line: true, dur: 0.9, cap: 1.5, hit: 'hook', box: [-45, -60, 45, 80],
		make: (P) => one(() => energy({ kind: 'beam', x: P.hand.x, y: P.hand.y, to: [P.x, P.y], charge: 0.22, hold: 0.45, width: 6, colors: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-bolt': {
		label: 'Energy bolt', cat: 'Pixel Bolts', as: 'bolt-hit-1', proj: 'orb', ramp: true, line: true, dur: 0.5, cap: 3, hit: 'hook', box: [-40, -60, 40, 80],
		make: (P) => one(() => energy({ kind: 'bolt', x: P.hand.x, y: P.hand.y, to: [P.x, P.y], charge: 0.1, speed: 1300, colors: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-meteor': {
		label: 'Meteor', cat: 'Pixel Bolts', as: 'px-explosion-epic-1', proj: 'meteor', ramp: true, dur: 1, cap: 3, hit: 'hook', box: [-200, -560, 200, 55],
		make: (P) => [
			{ fx: () => energy({ kind: 'bolt', x: sky(P)[0], y: sky(P)[1], to: [P.x, P.y], charge: 0.05, speed: 1150, colors: or(P.ramp(8), resample(ELEMENT_RAMPS.fire.map(hex), 8)), ...P.hook, seed: P.seed }) },
			{ after: 0, fx: () => explosion({ x: P.x, ground: P.ground, size: 1.3, chunks: 20, ...P.hook, seed: P.seed }) },
		],
	},
	'sf-meteors': {
		label: 'Falling barrage', cat: 'Pixel Explosions', as: 'pr-meteors', ramp: true, dur: 1.3, cap: 2.4, hit: 'hook', box: [-170, -560, 170, 55],
		make: (P) => {
			const parts = [];
			for (let i = 0; i < 5; i++) {
				const [x, y] = nearby(P, i, 60);
				const start = [x - 110 * P.facing, y - 420];
				parts.push({ at: i * 0.13, fx: () => energy({ kind: 'bolt', x: start[0], y: start[1], to: [x, y], charge: 0.02, speed: 1400, colors: or(P.ramp(8), resample(ELEMENT_RAMPS.fire.map(hex), 8)), ...P.hook, seed: P.seed + i }) });
			}
			for (let i = 0; i < 5; i++) {
				const [x, y] = nearby(P, i, 60);
				parts.push({ after: i, fx: () => explosion({ x, ground: y + 22, size: 0.45, chunks: 4, ...P.hook, seed: P.seed + i }) });
			}
			return parts;
		},
	},
	'sf-black-hole': {
		label: 'Black hole', cat: 'Pixel Magic', as: 'pr-void', hue: 25, dur: 1.4, cap: 2.3, hit: 0.4, box: [-110, -110, 110, 110],
		make: (P) => one(() => blackHole({ x: P.x, y: P.y, radius: 18, life: 1.0, pull: 0.5, ground: P.ground, ...P.hook, seed: P.seed })),
	},
	'sf-pillar': {
		label: 'Pillar of light', cat: 'Pixel Magic', as: 'pr-pillar', ramp: true, dur: 1.1, cap: 1.8, hit: 'hook', box: [-60, -260, 60, 45],
		make: (P) => one(() => holyLight({ x: P.x, ground: P.ground, hold: 0.55, width: 13, colors: P.ramp(7), ...P.hook, seed: P.seed })),
	},
	'sf-smite': {
		label: 'Smite', cat: 'Pixel Magic', as: 'px-light-burst', ramp: true, dur: 0.8, cap: 1.3, hit: 'hook', box: [-50, -260, 50, 45],
		make: (P) => one(() => holyLight({ x: P.x, ground: P.ground, hold: 0.1, width: 8, colors: P.ramp(7), ...P.hook, seed: P.seed })),
	},
	'sf-shards': {
		label: 'Shard volley', cat: 'Pixel Bolts', as: 'pr-shards', ramp: true, line: true, dur: 0.8, cap: 2.5, hit: 'hook', box: [-50, -60, 50, 80],
		make: (P) => {
			const C = or(P.ramp(8), resample(ELEMENT_RAMPS.ice.map(hex), 8));
			return [0, 1, 2, 3, 4].map((i) => ({ at: i * 0.06, fx: () => energy({ kind: 'bolt', x: P.hand.x, y: P.hand.y, to: nearby(P, i, 26), charge: 0.04, speed: 1600, colors: C, ...P.hook, seed: P.seed + i }) }));
		},
	},
	'sf-missiles': {
		label: 'Rocket salvo', cat: 'Pixel Bolts', as: 'pr-missiles', ramp: true, line: true, dur: 1, cap: 2.8, hit: 'hook', box: [-90, -120, 90, 50],
		make: (P) => {
			const C = or(P.ramp(8), resample(ELEMENT_RAMPS.fire.map(hex), 8));
			const parts = [0, 1, 2].map((i) => ({ at: i * 0.12, fx: () => energy({ kind: 'bolt', x: P.hand.x, y: P.hand.y, to: nearby(P, i, 30), charge: 0.05, speed: 1000, colors: C, ...P.hook, seed: P.seed + i }) }));
			for (let i = 0; i < 3; i++) {
				const [x, y] = nearby(P, i, 30);
				parts.push({ after: i, fx: () => explosion({ x, ground: y + 24, size: 0.45, chunks: 5, ...P.hook, seed: P.seed + i }) });
			}
			return parts;
		},
	},
	'sf-volley': {
		label: 'Rapid fire', cat: 'Pixel Bolts', as: 'pr-volley', line: true, dur: 0.8, cap: 1.6, hit: 'hook', box: [-50, -45, 50, 55],
		make: (P) => {
			const parts = [{ fx: () => muzzleFlash({ x: P.hand.x, y: P.hand.y, angle: P.angle, size: 0.8, casing: false, ...P.hook, seed: P.seed }) }];
			for (let i = 0; i < 6; i++) parts.push({ at: i * 0.07, fx: () => EXTRA.bullet({ from: handOf(P), to: nearby(P, i, 20), ...P.hook, seed: P.seed + i }) });
			for (let i = 0; i < 6; i++) parts.push({ after: i + 1, fx: () => impact({ x: nearby(P, i, 20)[0], y: nearby(P, i, 20)[1], angle: P.angle, size: 0.6, ground: P.ground, ...P.hook, seed: P.seed + i }) });
			parts[1].main = true;
			return parts;
		},
	},
	'sf-tether': {
		label: 'Life drain', cat: 'Pixel Bolts', as: 'pr-tether', ramp: true, line: true, dur: 1.2, cap: 1.5, hit: 0.15, box: [-30, -30, 30, 30],
		make: (P) => one(() => EXTRA.tether({ from: handOf(P), to: [P.x, P.y], ramp: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-soundwave': {
		label: 'Sound waves', cat: 'Pixel Bolts', as: 'pr-soundwave', ramp: true, line: true, dur: 0.9, cap: 1.1, hit: 0.35, box: [-40, -50, 40, 50],
		make: (P) => one(() => EXTRA.soundwave({ from: handOf(P), to: [P.x, P.y], ramp: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-cards': {
		label: 'Flying cards', cat: 'Pixel Bolts', as: 'pr-cards', line: true, dur: 0.9, cap: 1.2, hit: 'hook', box: [-30, -30, 30, 30],
		make: (P) => one(() => EXTRA.cards({ from: handOf(P), to: [P.x, P.y], size: 2, ...P.hook, seed: P.seed })),
	},
	'sf-arrow': {
		label: 'Arrow', cat: 'Pixel Bolts', as: 'arrow-hit-1', proj: 'arrow', ramp: true, line: true, dur: 0.3, cap: 3, hit: 'hook', box: [-30, -30, 30, 30],
		make: (P) => one(() => EXTRA.arrow({ from: handOf(P), to: [P.x, P.y], ramp: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-bullet': {
		label: 'Bullet', cat: 'Pixel Bolts', as: 'px-spark-burst', proj: 'bullet', line: true, dur: 0.15, cap: 2, hit: 'hook', box: [-30, -30, 30, 30],
		make: (P) => [
			{ fx: () => EXTRA.bullet({ from: handOf(P), to: [P.x, P.y], ...P.hook, seed: P.seed }), main: true },
			{ fx: () => muzzleFlash({ x: P.hand.x, y: P.hand.y, angle: P.angle, size: 0.7, casing: true, ground: P.from[1] + 40, ...P.hook, seed: P.seed }) },
		],
	},
	'sf-rock': {
		label: 'Boulder', cat: 'Pixel Bolts', as: 'px-impact-sym-3', proj: 'rock', ramp: true, line: true, dur: 0.6, cap: 3, hit: 'hook', box: [-40, -120, 40, 40],
		make: (P) => one(() => EXTRA.rock({ from: handOf(P), to: [P.x, P.y], ramp: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-muzzle': {
		label: 'Muzzle flash', cat: 'Pixel Bolts', as: 'px-muzzle-1', dur: 0.2, cap: 0.9, hit: 0, box: [-40, -40, 40, 60],
		make: (P) => one(() => muzzleFlash({ x: P.hand.x, y: P.hand.y, angle: P.angle, size: 0.8, casing: true, ground: P.ground, ...P.hook, seed: P.seed })),
	},

	/* ---- Support ---- */
	'sf-heal': {
		label: 'Healing', cat: 'Pixel Support', as: 'heal-long-1', ramp: true, dur: 1.3, cap: 2.3, hit: 0, box: [-45, -80, 45, 25],
		make: (P) => one(() => heal({ kind: 'heal', actor: P.target, palette: P.hexRamp(8), ...P.hook, seed: P.seed })),
	},
	'sf-mana': {
		label: 'Mind restore', cat: 'Pixel Support', as: 'heal-quick-1', ramp: true, dur: 1.3, cap: 2.3, hit: 0, box: [-45, -80, 45, 25],
		make: (P) => one(() => heal({ kind: 'mana', actor: P.target, palette: P.hexRamp(8), ...P.hook, seed: P.seed })),
	},
	'sf-heal-burst': {
		label: 'Healing burst', cat: 'Pixel Support', as: 'heal-puff-1', ramp: true, dur: 1, cap: 2, hit: 0, box: [-50, -80, 50, 40],
		make: (P) => [
			{ fx: () => heal({ kind: 'heal', actor: P.target, palette: P.hexRamp(8), ...P.hook, seed: P.seed, count: 6 }) },
			{ fx: () => sparkle({ x: P.x, y: P.y - 6, size: 0.7, warm: or(P.hexRamp(7), namedHex('heal', 7)), ...P.hook, seed: P.seed }) },
		],
	},
	'sf-power-up': {
		label: 'Power up', cat: 'Pixel Support', as: 'buff-sparks-1', ramp: true, dur: 1.2, cap: 2.4, hit: 'hook', box: [-60, -75, 60, 35],
		make: (P) => one(() => powerUp({ actor: P.target, palette: P.hexRamp(7), ...P.hook, seed: P.seed })),
	},
	'sf-attack-up': {
		label: 'Attack up', cat: 'Pixel Support', as: 'px-attack-up', dur: 1.2, cap: 2.4, hit: 'hook', box: [-60, -90, 60, 35],
		make: (P) => [
			{ fx: () => powerUp({ actor: P.target, palette: namedHex('crimson', 7), ...P.hook, seed: P.seed }), main: true },
			{ at: 0.3, fx: () => EXTRA.symbol({ kind: 'up', x: P.x, y: P.y - 10, ramp: named('crimson'), ...P.hook, seed: P.seed }) },
		],
	},
	'sf-magic-up': {
		label: 'Magic up', cat: 'Pixel Support', as: 'px-sym-magic-up', dur: 1.2, cap: 2.4, hit: 'hook', box: [-60, -90, 60, 35],
		make: (P) => [
			{ fx: () => powerUp({ actor: P.target, palette: ELEMENT_RAMPS.dark.slice(0, 7), ...P.hook, seed: P.seed }), main: true },
			{ at: 0.3, fx: () => EXTRA.symbol({ kind: 'star', x: P.x, y: P.y - 10, ramp: resample(ELEMENT_RAMPS.dark.map(hex), 8), ...P.hook, seed: P.seed }) },
		],
	},
	'sf-defense-up': {
		label: 'Defense up', cat: 'Pixel Support', as: 'px-defense-up', dur: 1.2, cap: 2.2, hit: 0.3, box: [-50, -90, 50, 20],
		make: (P) => [
			{ fx: () => shield({ x: P.x, y: P.ground - 6, radius: 30, hold: 0.9, hits: [], ground: P.ground, ...P.hook, seed: P.seed }) },
			{ at: 0.25, fx: () => EXTRA.symbol({ kind: 'shield', x: P.x, y: P.y - 14, ramp: resample(ELEMENT_RAMPS.ice.map(hex), 8), ...P.hook, seed: P.seed }) },
		],
	},
	'sf-shield': {
		label: 'Shield dome', cat: 'Pixel Support', as: 'barrier', ramp: true, dur: 1.2, cap: 2.2, hit: 0.45, box: [-50, -50, 50, 20],
		make: (P) => one(() => shield({ x: P.x, y: P.ground - 6, radius: 30, hold: 1.1, colors: P.hexRamp(8), hits: [{ t: 0.55, lon: 0.6 * P.facing, lat: 0.5 }], ground: P.ground, ...P.hook, seed: P.seed })),
	},
	'sf-sparkle': {
		label: 'Sparkle', cat: 'Pixel Support', as: 'px-sparkles', ramp: true, dur: 1, cap: 2, hit: 0, box: [-45, -45, 45, 45],
		make: (P) => one(() => sparkle({ x: P.x, y: P.y - 6, size: 1.2, warm: P.hexRamp(7), ...P.hook, seed: P.seed })),
	},
	'sf-twinkle': {
		label: 'Twinkle', cat: 'Pixel Support', as: 'px-sparkle-burst-3', ramp: true, dur: 0.8, cap: 1.6, hit: 0, box: [-35, -35, 35, 35],
		make: (P) => one(() => sparkle({ x: P.x, y: P.y - 6, size: 0.8, flares: 3, warm: P.hexRamp(7), ...P.hook, seed: P.seed })),
	},
	'sf-firework': {
		label: 'Fireworks', cat: 'Pixel Support', as: 'px-firework-1', dur: 1, cap: 1.8, hit: 0, box: [-60, -70, 60, 50],
		make: (P) =>
			['gold', 'pink', 'heal'].map((k, i) => ({ at: i * 0.12, fx: () => sparkle({ x: nearby(P, i, 30)[0], y: nearby(P, i, 30)[1] - 20, size: 0.9, warm: namedHex(k, 7), ...P.hook, seed: P.seed + i }) })),
	},
	'sf-gem': {
		label: 'Gem', cat: 'Pixel Support', as: 'px-coin-burst', dur: 1, cap: 2, hit: 'hook', box: [-50, -55, 50, 45],
		make: (P) => one(() => pickup({ x: P.x, y: P.y - 8, item: 'gem', ...P.hook, seed: P.seed })),
	},
	'sf-coins': {
		label: 'Coin burst', cat: 'Pixel Support', as: 'px-coin-burst', dur: 1, cap: 2, hit: 'hook', box: [-50, -55, 50, 45],
		make: (P) => one(() => pickup({ x: P.x, y: P.y - 8, item: 'coin', ...P.hook, seed: P.seed })),
	},
	'sf-steal': {
		label: 'Snatch', cat: 'Pixel Bolts', as: 'pr-steal', line: true, dur: 0.9, cap: 2.2, hit: 0.1, box: [-50, -50, 50, 45],
		make: (P) => one(() => pickup({ x: P.x, y: P.y - 8, item: 'coin', actor: P.source, magnet: true, ...P.hook, seed: P.seed }), { tick: (fx, t) => t > 0.12 && fx.collect() }),
	},
	'sf-blink': {
		label: 'Blink', cat: 'Pixel Support', as: 'px-warp-1', dur: 0.9, cap: 1.8, hit: 'hook', box: [-75, -100, 75, 45],
		make: (P) => one(() => movement({ kind: 'blink', actor: P.target, to: P.x + 30 * P.facing, ground: P.ground, ...P.hook, seed: P.seed })),
	},
	'sf-dash': {
		label: 'Dash', cat: 'Pixel Support', as: 'px-haste', dur: 0.8, cap: 1.5, hit: 0, box: [-100, -60, 100, 25],
		make: (P) => one(() => movement({ kind: 'dash', actor: P.target, facing: P.facing, ground: P.ground, ...P.hook, seed: P.seed })),
	},
	'sf-wisps': {
		label: 'Spirit wisps', cat: 'Pixel Support', as: 'pr-wisps', hue: 170, dur: 1.5, cap: 2, stopAt: 1.6, hit: 0.2, box: [-70, -110, 70, 30],
		make: (P) => one(() => lib(pfxWisp, P, [P.x, P.ground], { ramp: false })),
	},

	/* ---- Status ---- */
	'sf-bite': {
		label: 'Snapping jaws', cat: 'Pixel Status', as: 'pr-bite', ramp: false, dur: 0.6, cap: 0.8, hit: 'hook', box: [-40, -40, 40, 40],
		make: (P) => one(() => EXTRA.bite({ x: P.x, y: P.y, size: 1.5, ...P.hook, seed: P.seed })),
	},
	'sf-gaze': {
		label: 'Evil eye', cat: 'Pixel Status', as: 'pr-gaze', ramp: true, dur: 1.1, cap: 1.3, hit: 'hook', box: [-40, -60, 40, 30],
		make: (P) => one(() => EXTRA.gaze({ x: P.x, y: P.y, ramp: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-swarm': {
		label: 'Insect swarm', cat: 'Pixel Status', as: 'pr-swarm', dur: 1.3, cap: 1.5, hit: 0.2, box: [-45, -40, 45, 40],
		make: (P) => one(() => EXTRA.swarm({ x: P.x, y: P.y, size: 1.3, ...P.hook, seed: P.seed })),
	},
	'sf-web': {
		label: 'Sticky web', cat: 'Pixel Status', as: 'pr-web', dur: 1.3, cap: 1.5, hit: 0.3, box: [-45, -45, 45, 45],
		make: (P) => one(() => EXTRA.web({ x: P.x, y: P.y, ...P.hook, seed: P.seed })),
	},
	'sf-chains': {
		label: 'Binding chains', cat: 'Pixel Status', as: 'pr-chains', ramp: true, dur: 1.2, cap: 1.4, hit: 'hook', box: [-60, -40, 60, 40],
		make: (P) => one(() => EXTRA.chains({ x: P.x, y: P.y, ramp: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-zzz': {
		label: 'Sleepy Zs', cat: 'Pixel Status', as: 'pr-zzz', dur: 1.6, cap: 1.9, hit: 0.2, box: [-20, -80, 50, 10],
		make: (P) => one(() => EXTRA.zzz({ x: P.x, y: P.y, size: 1.4, ...P.hook, seed: P.seed })),
	},
	'sf-dizzy': {
		label: 'Dizzy stars', cat: 'Pixel Status', as: 'pr-dizzy', dur: 1.4, cap: 1.6, hit: 0.2, box: [-35, -50, 35, 0],
		make: (P) => one(() => EXTRA.dizzy({ x: P.x, y: P.y, size: 1.3, ...P.hook, seed: P.seed })),
	},
	'sf-laugh': {
		label: 'Mocking laughter', cat: 'Pixel Status', as: 'pr-laugh', ramp: true, dur: 1.3, cap: 1.5, hit: 0.2, box: [-50, -60, 50, 0],
		make: (P) => one(() => EXTRA.laugh({ x: P.x, y: P.y, ramp: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-notes': {
		label: 'Music notes', cat: 'Pixel Status', as: 'px-music-1', ramp: true, dur: 1.3, cap: 1.6, hit: 0.2, box: [-40, -60, 40, 20],
		make: (P) => one(() => EXTRA.notes({ x: P.x, y: P.y, size: 1.3, ramp: P.ramp(8), ...P.hook, seed: P.seed })),
	},
	'sf-smoke': {
		label: 'Smoke puff', cat: 'Pixel Status', as: 'px-smoke-loop-1', dur: 1.2, cap: 1.6, hit: 0.05, box: [-60, -90, 60, 20],
		make: (P) => one(() => lib(pfxPoof, P, [P.x, P.ground], { ramp: false })),
	},
	'sf-death': {
		label: 'Death mark', cat: 'Pixel Status', as: 'px-death', dur: 1.4, cap: 1.7, hit: 0.3, box: [-60, -80, 60, 30],
		make: (P) => [
			{ fx: () => EXTRA.smoke({ x: P.x, y: P.y, ramp: named('shadow', 6), ...P.hook, seed: P.seed }) },
			{ at: 0.1, fx: () => EXTRA.symbol({ kind: 'skull', x: P.x, y: P.y, ramp: named('ink'), ...P.hook, seed: P.seed }) },
		],
	},
	'sf-heart': {
		label: 'Hearts', cat: 'Pixel Status', as: 'px-heart-burst', dur: 1.3, cap: 1.6, hit: 0.2, box: [-50, -70, 50, 40],
		make: (P) => [
			{ fx: () => EXTRA.symbol({ kind: 'heart', x: P.x, y: P.y, ramp: named('rose'), ...P.hook, seed: P.seed }) },
			{ fx: () => sparkle({ x: P.x, y: P.y - 6, size: 0.6, warm: namedHex('rose', 7), ...P.hook, seed: P.seed }) },
		],
	},
	'sf-curse': {
		label: 'Curse', cat: 'Pixel Status', as: 'px-sym-thumbs-down', dur: 1.3, cap: 1.6, hit: 0.3, box: [-50, -80, 50, 25],
		make: (P) => [
			{ fx: () => poison({ kind: 'aura', actor: P.target, ground: P.ground, colors: resample(ELEMENT_RAMPS.dark.map(hex), 8), ...P.hook, seed: P.seed }) },
			{ at: 0.15, fx: () => EXTRA.symbol({ kind: 'down', x: P.x, y: P.y, ramp: resample(ELEMENT_RAMPS.dark.map(hex), 8), ...P.hook, seed: P.seed }) },
		],
	},

	/* ---- Weather, around the target ---- */
	'sf-rain': {
		label: 'Rain', cat: W, soft: true, as: 'pr-rain', dur: 1.4, cap: 2, stopAt: 1.1, hit: 0.4, box: [-110, -200, 110, 10],
		make: (P) => one(() => rain({ area: { x: P.x - 150, y: P.ground - 340, w: 300, h: 340 }, ground: P.ground, density: 1.4, ...P.hook, seed: P.seed })),
	},
	'sf-snow': {
		label: 'Snowfall', cat: W, soft: true, as: 'px-sparkles', dur: 1.4, cap: 2.2, stopAt: 1.2, hit: 0.4, box: [-100, -150, 100, 10],
		make: (P) => one(() => snow({ area: { x: P.x - 180, y: P.ground - 280, w: 360, h: 280 }, ground: P.ground, density: 2, ...P.hook, seed: P.seed })),
	},
	'sf-fog': {
		label: 'Fog', cat: W, soft: true, as: 'px-smoke-loop-2', dur: 1.5, cap: 2.4, stopAt: 1.4, hit: 0.3, box: [-100, -70, 100, 20],
		make: (P) => one(() => fog({ area: { x: P.x - 180, y: P.ground - 120, w: 360, h: 130 }, density: 1.2, ...P.hook, seed: P.seed })),
	},
	'sf-embers': {
		label: 'Embers', cat: W, soft: true, as: 'charge-blaze-1', dur: 1.4, cap: 2.2, stopAt: 1.2, hit: 0.3, box: [-90, -150, 90, 10],
		make: (P) => one(() => embers({ area: { x: P.x - 160, y: P.ground - 260, w: 320, h: 270 }, density: 1.6, heat: false, ...P.hook, seed: P.seed })),
	},
	'sf-fireflies': {
		label: 'Fireflies', cat: W, soft: true, as: 'pr-wisps', dur: 1.5, cap: 2.4, stopAt: 1.4, hit: 0.3, box: [-90, -100, 90, 15],
		make: (P) => one(() => fireflies({ area: { x: P.x - 160, y: P.ground - 180, w: 320, h: 180 }, ground: P.ground, density: 1.5, grass: false, ...P.hook, seed: P.seed })),
	},
	'sf-leaves': {
		label: 'Falling leaves', cat: W, soft: true, as: 'pr-petals', dur: 1.5, cap: 2.4, stopAt: 1.4, hit: 0.3, box: [-90, -130, 90, 10],
		make: (P) => one(() => fallingLeaves({ area: { x: P.x - 160, y: P.ground - 240, w: 320, h: 240 }, ground: P.ground, leaves: 26, litter: false, ...P.hook, seed: P.seed })),
	},
	'sf-petals': {
		label: 'Petal storm', cat: W, soft: true, as: 'pr-petals', dur: 1.5, cap: 2.4, stopAt: 1.4, hit: 0.3, box: [-90, -130, 90, 10],
		make: (P) =>
			one(() =>
				fallingLeaves({
					area: { x: P.x - 160, y: P.ground - 240, w: 320, h: 240 },
					ground: P.ground,
					leaves: 34,
					drift: 1.6,
					litter: false,
					colors: [
						['#ffe0f0', '#ffb3d9', '#e0559f', '#6a2052'],
						['#ffffff', '#ffe4ea', '#ffb0c4', '#a82c50'],
					],
					...P.hook, seed: P.seed,
				}),
			),
	},
	'sf-bubbles': {
		label: 'Bubbles', cat: W, soft: true, as: 'px-bubble-burst', dur: 1.4, cap: 2.2, stopAt: 1.2, hit: 0.3, box: [-90, -150, 90, 10],
		make: (P) => one(() => bubbles({ area: { x: P.x - 160, y: P.ground - 280, w: 320, h: 280 }, ground: P.ground, vents: [P.x - 40, P.x + 30], surface: false, caustics: false, tint: false, ...P.hook, seed: P.seed })),
	},
};

for (const [name, kind] of Object.entries({ alert: 'Alert', question: 'Question mark', crown: 'Crown', up: 'Arrow up', down: 'Arrow down', check: 'Check mark', cross: 'Cross', bulb: 'Light bulb', star: 'Star' })) {
	PIXEL[`sf-sym-${name}`] = {
		label: kind,
		cat: 'Pixel Symbols',
		as: { alert: 'px-sym-alert-1', question: 'px-sym-question', crown: 'px-sym-crown', up: 'px-sym-attack-up', down: 'px-sym-thumbs-down', check: 'px-sym-success', cross: 'px-sym-failure', bulb: 'px-sym-lightbulb', star: 'px-sym-magic-up' }[name],
		ramp: true,
		dur: 1.3,
		cap: 1.6,
		hit: 0.15,
		box: [-30, -70, 30, 0],
		make: (P) => one(() => EXTRA.symbol({ kind: name, x: P.x, y: P.y, size: 1.3, ramp: P.ramp(8), ...P.hook, seed: P.seed })),
	};
}

export const isPixel = (id) => typeof id === 'string' && id.startsWith('sf-') && !!PIXEL[id];

/** Pixel effects that fly from the user to the target, for the projectile menu */
export const PIXEL_PROJECTILES = Object.entries(PIXEL)
	.filter(([, d]) => d.cat === 'Pixel Bolts')
	.map(([id, d]) => [id, d.label]);
