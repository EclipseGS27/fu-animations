import { ELEMENT_LOOK } from './presets.mjs';
import { playSound } from './audio.mjs';
import { center, fxDuration, knockback, playFx, tweenOffset, wait } from './player.mjs';
import { hitstop } from './clock.mjs';
import * as I from './impact.mjs';

/**
 * Zero Powers (High Fantasy Atlas): one limit break per zero effect. Players name their powers freely, so the
 * effect is read from the item (Project FU's "Zero effect" field, then its text, then its name). Each one shares
 * the limit-break opening (cinema bars, darkness, a banner naming the effect) and then plays its own scene.
 */

const DAMAGE = ['air', 'bolt', 'dark', 'earth', 'fire', 'ice', 'light', 'poison'];
const colorOf = (el) => (ELEMENT_LOOK[el] ?? ELEMENT_LOOK.none).color;
const hex = (n) => `#${Number(n).toString(16).padStart(6, '0')}`;
const sizeOf = (t) => Math.max(t?.document?.width ?? 1, t?.document?.height ?? 1);
const g = () => canvas.grid.size;

/** The big hit for each damage type */
const ELEMENT_HIT = { fire: 'sf-explosion-big', ice: 'sf-ice-nova', bolt: 'sf-lightning-storm', air: 'sf-tornado', earth: 'sf-quake', light: 'sf-smite', dark: 'sf-black-hole', poison: 'sf-poison-cloud', physical: 'sf-impact-heavy', none: 'sf-impact-heavy' };

export const ZERO_EFFECTS = {
	blitz: { label: 'Zero Blitz', color: 0xffc94a, words: /blitz/i },
	chance: { label: 'Zero Chance', color: 0xb07cff, words: /chance|3d6|odd or even/i },
	cost: { label: 'Zero Cost', color: 0x5fe39a, words: /\bcost\b|inventory point/i },
	elements: { label: 'Zero Elements', color: 0xff8a3d, words: /elements?\b/i },
	limits: { label: 'Zero Limits', color: 0xff5a3c, words: /limits?\b|die size higher/i },
	magic: { label: 'Zero Magic', color: 0x8a7cff, words: /magic|spell action for free/i },
	objective: { label: 'Zero Objective', color: 0x4fd8d0, words: /objective|sections of a clock/i },
	remedy: { label: 'Zero Remedy', color: 0xfff0b0, words: /remedy|recover from all status/i },
	scourge: { label: 'Zero Scourge', color: 0x9b5cff, words: /scourge/i },
	shield: { label: 'Zero Shield', color: 0x7fe0ff, words: /shield|damage suffered .* halved/i },
	triangle: { label: 'Zero Triangle', color: 0xff6bd5, words: /triangle|up to two allies/i },
};

const strip = (html) => String(html ?? '').replace(/<[^>]+>/g, ' ');

/** Which zero effect an item has: its Zero effect field first, then its text, then its name */
export function zeroKeyOf(item) {
	const z = item?.system?.data;
	const fields = [z?.zeroEffect?.value, strip(z?.zeroEffect?.description), item?.name, strip(item?.system?.description), strip(z?.description)];
	for (const f of fields) {
		if (!f) continue;
		for (const [k, e] of Object.entries(ZERO_EFFECTS)) if (new RegExp(`zero\\s*${k}`, 'i').test(f)) return k;
	}
	for (const f of fields) {
		if (!f) continue;
		for (const [k, e] of Object.entries(ZERO_EFFECTS)) if (e.words.test(f)) return k;
	}
	return null;
}

/** Damage types a Zero Elements or Zero Scourge power names in its text (the first two) */
export function zeroTypesOf(item) {
	const z = item?.system?.data;
	const text = `${z?.zeroEffect?.value ?? ''} ${strip(z?.zeroEffect?.description)} ${strip(item?.system?.description)} ${item?.name ?? ''}`.toLowerCase();
	return DAMAGE.filter((d) => new RegExp(`\\b${d}\\b`).test(text)).slice(0, 2);
}

/** Tokens on the user's side (for Remedy, Shield, Cost, Triangle) */
function alliesOf(src) {
	if (!src) return [];
	const disp = src.document?.disposition;
	return (canvas.tokens?.placeables ?? []).filter((t) => t.visible && !t.document.hidden && t.document.disposition === disp && t.actor);
}

const at = (token, extra = {}) => ({ ...center(token), from: center(token), to: center(token), tokenSize: sizeOf(token), token, element: 'none', ...extra });

/* ------------------------------------------------------------------ */
/*  The scenes                                                         */
/* ------------------------------------------------------------------ */

const SCENES = {
	/** A rush of afterimage dash-slashes, then one giant cut */
	async blitz({ src, targets, color }) {
		const main = targets[0]?.token;
		if (!src || !main) return SCENES.limits({ src, targets, color });
		await I.chargeUp(src, { color, ms: 800 }).then((s) => s());
		const a = center(src);
		const b = center(main);
		const slashes = ['sf-slash', 'sf-slash-x', 'sf-slash-up', 'sf-slash-wide', 'sf-slash-combo'];
		const stop = I.afterimages(src, 0, color);
		for (let i = 0; i < 5; i++) {
			const ang = (i / 5) * Math.PI * 2 + Math.random();
			const r = g() * 0.9;
			const to = { x: b.x + Math.cos(ang) * r - a.x, y: b.y + Math.sin(ang) * r * 0.6 - a.y };
			playSound('swoosh-grain', { volume: 0.7 });
			await tweenOffset(src, to, 90);
			playFx(slashes[i], at(main, { from: { x: b.x - Math.cos(ang) * g(), y: b.y - Math.sin(ang) * g() }, rotation: ang + Math.PI, scale: 1.2 }));
			I.flashToken(main, 80);
			I.debris(b, { color, count: 10, power: 0.8, kind: 'spark' });
			I.shake(0.5, 120);
			await hitstop(50);
		}
		stop();
		await tweenOffset(src, { x: b.x - a.x - g() * 0.9, y: b.y - a.y }, 120);
		await wait(160);
		playSound('critical-strike');
		playFx('sf-slash-heavy', at(main, { scale: 2.2, rotation: -0.4 }));
		I.screenFlash(0xffffff, 0.8, 300);
		I.burstFlash(b, { color, size: 3 });
		await hitstop(220);
		I.shake(3, 600);
		knockback(main, 1, 0, 3);
		I.shockwaves(b, { color, size: 2 });
		await wait(300);
		await tweenOffset(src, { x: 0, y: 0 }, 420);
	},

	/** Three dice tumble across the screen, then a jackpot */
	async chance({ src, targets, color }) {
		const c = src ? center(src) : null;
		const circle = c ? I.runeCircle({ x: c.x, y: c.y + g() * 0.4 }, { color, size: 1.8 }) : null;
		playSound('magic-sparkles');
		const faces = await I.diceRoll({ color: hex(color) });
		const odd = faces.filter((f) => f % 2).length;
		const doubles = faces[0] === faces[1] && faces[1] === faces[2];
		playSound(doubles ? 'dramatic-finish' : 'coin-impact');
		if (src) {
			playFx('sf-coins', at(src, { scale: 1.6 }));
			playFx('sf-firework', at(src, { scale: 1.8 }));
			I.burstFlash(c, { color, size: 2.4 });
		}
		// the luckier the roll looks, the bigger the payoff
		const spots = targets.length ? targets.map((t) => t.token) : alliesOf(src);
		for (const t of spots) {
			await wait(120);
			playFx(targets.length ? 'sf-impact-heavy' : 'sf-heal-burst', at(t, { scale: 1.3 + odd * 0.15 }));
			I.impactRing(center(t), { color, size: 1.5 + odd * 0.3 });
		}
		if (doubles) I.screenFlash(color, 0.6, 400);
		await wait(500);
		await circle?.();
	},

	/** An alchemy circle, and gems and coins pouring out */
	async cost({ src, color }) {
		if (!src) return;
		const c = center(src);
		const circle = I.runeCircle({ x: c.x, y: c.y + g() * 0.4 }, { color, size: 2.2, spin: 1.8 });
		playSound('buff-pickup');
		await I.orbit(src, [color, 0xffd27a, 0xffffff], { ms: 900, count: 8 });
		for (let i = 0; i < 4; i++) {
			playFx(i % 2 ? 'sf-gem' : 'sf-coins', at(src, { scale: 1.2 + i * 0.25 }));
			I.debris({ x: c.x, y: c.y - g() * 0.3 }, { color: i % 2 ? color : 0xffd27a, count: 14, power: 0.9, kind: 'spark' });
			playSound('coin-impact', { volume: 0.6 });
			await wait(220);
		}
		for (const t of alliesOf(src)) playFx('sf-sparkle', at(t, { scale: 1.2 }));
		I.impactRing(c, { color, size: 2.2 });
		await wait(500);
		await circle();
	},

	/** Two element orbs circle the user, then strike in turn; the user keeps a two-color aura */
	async elements({ src, targets, types }) {
		const [a, b] = types.length >= 2 ? types : types.length === 1 ? [types[0], types[0] === 'fire' ? 'ice' : 'fire'] : ['fire', 'ice'];
		const ca = colorOf(a);
		const cb = colorOf(b);
		if (src) {
			playSound('energy-riser');
			await I.orbit(src, [ca, cb], { ms: 1400, count: 6 });
			I.burstFlash(center(src), { color: ca, size: 2 });
			I.burstFlash(center(src), { color: cb, size: 1.4 });
		}
		let i = 0;
		for (const t of targets) {
			const el = i++ % 2 ? b : a;
			if (src && t.token !== src) await I.blazingProjectile(center(src), center(t.token), { color: colorOf(el), size: 0.45, ms: 380 });
			playFx(ELEMENT_HIT[el], at(t.token, { element: el, scale: 1.4 }));
			I.shockwaves(center(t.token), { color: colorOf(el), size: 1.5, count: 2 });
			I.shake(1.2, 260);
			await wait(160);
		}
		if (src) {
			await wait(300);
			const settle = await I.gather(src, { color: ca, ms: 500, lift: 0.08 });
			I.debris(center(src), { color: cb, count: 18, power: 0.4, kind: 'ember' });
			settle();
		}
	},

	/** A transformation: the user grows, sigils of all four Attributes rise */
	async limits({ src, color }) {
		if (!src) return;
		const settle = await I.chargeUp(src, { color, ms: 1300 });
		playSound('high-powering-up');
		const words = I.risingWords(src, ['DEX', 'INS', 'MIG', 'WLP'], { color: 0xffd27a, gap: 160 });
		for (const id of ['sf-attack-up', 'sf-magic-up', 'sf-defense-up', 'sf-power-up']) {
			playFx(id, at(src, { scale: 1.3 }));
			await wait(170);
		}
		await words;
		playSound('growing-strength');
		await I.pulseScale(src, 1.3, 650);
		I.screenFlash(color, 0.5, 300);
		I.shockwaves(center(src), { color, size: 2.2 });
		I.shake(2, 400);
		settle();
		await wait(400);
	},

	/** Magic circles above the targets, light falling from the sky */
	async magic({ src, targets, color }) {
		if (src) {
			playFx('sf-glyph', at(src, { scale: 1.6 }));
			playSound('casting-buff');
			await I.orbit(src, [color, 0xffffff], { ms: 900, count: 5 });
		}
		const spots = targets.length ? targets.map((t) => t.token) : src ? [src] : [];
		const circles = spots.map((t) => I.runeCircle({ x: center(t).x, y: center(t).y + g() * 0.3 }, { color, size: 1.6, spin: 2 }));
		await wait(500);
		for (const t of spots) {
			playSound('jacobs-ladder', { volume: 0.6 });
			I.beamDown(center(t), { color, width: 0.9, ms: 900 });
			await wait(160);
			playFx(targets.length ? 'sf-explosion-big' : 'sf-magic-up', at(t, { scale: 1.5 }));
			I.impactRing(center(t), { color, size: 2 });
		}
		I.shake(1.6, 400);
		await wait(600);
		await Promise.all(circles.map((c) => c()));
	},

	/** A giant clock spins and fills, and time ripples out */
	async objective({ src, color }) {
		playSound('teleport-downer');
		const clock = I.clockSpin({ color: hex(color), fill: 3 });
		if (src) for (let i = 0; i < 3; i++) setTimeout(() => I.impactRing(center(src), { color, size: 2 + i, ms: 700 }), 350 + i * 300);
		await clock;
		if (src) {
			playFx('sf-twinkle', at(src, { scale: 1.6 }));
			I.shockwaves(center(src), { color, size: 3, count: 3, gap: 200 });
		}
		await wait(500);
	},

	/** Light from above, feathers falling, every ally healed */
	async remedy({ src, targets, color }) {
		const allies = targets.length ? targets.map((t) => t.token) : alliesOf(src);
		if (src && !allies.includes(src)) allies.unshift(src);
		playSound('healing-gusts');
		const fall = I.feathers(allies.map((t) => center(t)), { color: 0xfff6dc, ms: 1800 });
		for (const t of allies) {
			I.beamDown(center(t), { color, width: 0.8, ms: 1100 });
			await wait(140);
		}
		await wait(450);
		for (const t of allies) {
			playFx('sf-heal-burst', at(t, { scale: 1.3 }));
			I.impactRing(center(t), { color: 0x9dffb0, size: 1.3 });
		}
		playSound('simple-heal');
		await fall;
	},

	/** Warning circles on every target, then all of them struck at once, with lingering statuses */
	async scourge({ targets, types, color }) {
		const el = types[0] ?? 'dark';
		const c = types[0] ? colorOf(el) : color;
		const spots = targets.map((t) => t.token);
		playSound('panic-energy');
		await Promise.all(spots.map((t) => I.telegraph(center(t), { color: c, size: 1.6, ms: 800 })));
		playSound('magisplosion');
		for (const t of spots) {
			playFx(ELEMENT_HIT[el] ?? 'sf-explosion-big', at(t, { element: el, scale: 1.5 }));
			I.flashToken(t, 120);
		}
		I.screenFlash(c, 0.6, 300);
		I.shake(2.6, 500);
		await hitstop(160);
		await wait(500);
		for (const t of spots) playFx(Math.random() < 0.5 ? 'sf-dizzy' : 'sf-curse', at(t));
		await wait(700);
	},

	/** A hexagonal dome spreads over the party */
	async shield({ src, color }) {
		const allies = alliesOf(src);
		if (src && !allies.includes(src)) allies.unshift(src);
		if (!allies.length) return;
		const cs = allies.map((t) => center(t));
		const mid = { x: cs.reduce((n, p) => n + p.x, 0) / cs.length, y: cs.reduce((n, p) => n + p.y, 0) / cs.length };
		const radius = Math.max(2, ...cs.map((p) => Math.hypot(p.x - mid.x, p.y - mid.y) / g() + 1.2));
		playSound('mecha-barrier-fail', { volume: 0.5 });
		playSound('appear-firewall');
		const d = I.dome(mid, { radius, color, ms: 2000 });
		await wait(400);
		for (const t of allies) {
			playFx('sf-shield', at(t, { scale: 1.3 }));
			await wait(90);
		}
		await d;
	},

	/** A triangle links the user and two allies; three beams converge on the target */
	async triangle({ src, targets, color }) {
		const main = targets[0]?.token;
		const team = [src, ...alliesOf(src).filter((t) => t !== src)].filter(Boolean).slice(0, 3);
		if (!team.length) return;
		const pts = team.map((t) => center(t));
		playSound('energy-crystal');
		if (pts.length >= 2) await I.linkLines(pts, { color, ms: 900, closed: pts.length === 3 });
		const colors = [color, 0x7fe0ff, 0xffd27a];
		await Promise.all(team.map((t, i) => I.gather(t, { color: colors[i % 3], ms: 450, lift: 0.08 }).then((s) => s())));
		if (!main) return;
		const b = center(main);
		playSound('mecha-white-laser');
		await Promise.all(team.map((t, i) => I.blazingProjectile(center(t), b, { color: colors[i % 3], size: 0.35, ms: 420 })));
		playFx('sf-explosion-big', at(main, { scale: 1.8 }));
		I.burstFlash(b, { color, size: 3 });
		I.shockwaves(b, { color, size: 2 });
		I.shake(2.4, 500);
		await hitstop(160);
		await wait(400);
	},
};

/**
 * Play a Zero Power. The finale wrapper (bars, darkness, cut-in) is done by the caller; this plays the scene.
 * @returns {Promise<boolean>} false when the effect has no scene (the caller then plays the generic limit break)
 */
export async function playZero(key, { plan, src, targets }) {
	const scene = SCENES[key];
	if (!scene) return false;
	const color = ZERO_EFFECTS[key].color;
	await scene({ plan, src, targets, color, types: plan.zeroTypes ?? [] });
	const spots = (targets.length ? targets.map((t) => t.token) : [src]).filter(Boolean);
	await I.aftermath(spots.map((t) => center(t)), { color, ms: 700 });
	return true;
}

export { fxDuration };
