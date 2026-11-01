import { playSound } from './audio.mjs';
import { center, knockback, playFx, tweenOffset, wait } from './player.mjs';
import { hitstop } from './clock.mjs';
import { ELEMENT_HIT } from './zero.mjs';
import * as I from './impact.mjs';

/**
 * Boss moves: signature scenes for champions and villains, so a boss's big actions feel like a boss fight.
 * Each move is a short cinematic built from the impact helpers and the pixel effects, tinted by the element.
 * The move is picked from the ability (its name and text, then its damage type and style), or set per item in
 * the animation editor ("Boss move"). Ordinary champion attacks keep their own animation with the boss wind-up.
 */

const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const sizeOf = (t) => Math.max(t?.document?.width ?? 1, t?.document?.height ?? 1);
const g = () => canvas.grid.size;
const strip = (html) => String(html ?? '').replace(/<[^>]+>/g, ' ');

/** One color per element for rings, circles and flashes */
export const ELEMENT_COLOR = { fire: 0xff6a2a, ice: 0x7fd8ff, bolt: 0xffe14a, air: 0x9ff0d0, earth: 0xc9965a, light: 0xfff0a8, dark: 0x9b5cff, poison: 0xb46cff, physical: 0xff3b4e, none: 0xff3b4e };

export const BOSS_MOVES = {
	breath: { label: 'Cataclysm Breath', desc: 'Rears up and floods the targets with its element, leaving the ground scorched.', words: /breath|exhal|spit|spew|spray|vomit|bile|gout/i },
	quake: { label: 'Earthshaker', desc: 'Leaps and slams down: the ground cracks in rings across every target.', words: /stomp|slam|quake|tremor|crush|smash|pound|trampl|earthshak|ground/i },
	rampage: { label: 'Savage Onslaught', desc: 'A blur of claws and fangs from every side, then one crushing blow.', words: /claw|bite|fang|maul|rend|frenzy|fury|rampage|savage|ravag|flurry|combo|gore|horn/i },
	meteor: { label: 'Calamity Rain', desc: 'The sky darkens over the battlefield and its element rains down on every target.', words: /rain|meteor|storm|barrage|volley|hail|missile|artillery|bombard|downpour|cataclysm/i },
	beam: { label: 'Annihilation Ray', desc: 'A long charge, a magic circle, then a ray that tears through the targets.', words: /beam|ray|laser|cannon|blast|lance|pierc/i },
	abyss: { label: 'Abyssal Grasp', desc: 'Hex sigils open under the targets and drag their strength back to the boss.', words: /drain|curse|hex|doom|soul|life|shadow|void|abyss|wither|decay|death|necro|leech|devour/i },
	summon: { label: 'Call of the Horde', desc: 'A rune circle opens and reinforcements answer, pillars of light where they land.', words: /summon|call|reinforc|spawn|minion|servant|egg|brood|swarm|raise|animate/i },
	roar: { label: 'Terrifying Roar', desc: 'A roar that shakes the screen; shockwaves wash over every enemy.', words: /roar|howl|shriek|scream|cry|bellow|intimidat|enrage|fear|terror|dread|menac|taunt/i },
	bastion: { label: 'Unbreakable Bastion', desc: 'A dome of force and a rising aura: the boss hardens or recovers.', words: /guard|shield|barrier|ward|regenerat|heal|recover|harden|armor|shell|fortif|protect|bastion|aegis/i },
	judgment: { label: 'Judgment', desc: 'Pillars of light or lightning crash down on every target in turn.', words: /judg|smite|holy|divine|thunder|lightning|heaven|wrath|punish|sentence/i },
};

/** The move for a plan: the item's choice, else its words, else its damage type and style */
export function bossMoveOf(plan, item = null) {
	const own = plan?.spec?.bossMove;
	if (own === 'none') return null;
	if (own && BOSS_MOVES[own]) return own;
	const text = `${item?.name ?? plan?.itemName ?? ''} ${strip(item?.system?.description)} ${strip(item?.system?.summary?.value)}`;
	for (const [k, m] of Object.entries(BOSS_MOVES)) if (m.words.test(item?.name ?? plan?.itemName ?? '')) return k;
	for (const [k, m] of Object.entries(BOSS_MOVES)) if (m.words.test(text)) return k;
	const el = plan?.element;
	const style = plan?.spec?.style;
	if (!plan?.offensive) return style === 'self' || style === 'support' ? 'bastion' : 'roar';
	if (el === 'earth') return 'quake';
	if (el === 'dark' || el === 'poison') return 'abyss';
	if (el === 'light' || el === 'bolt') return 'judgment';
	if (style === 'spell') return el === 'fire' || el === 'ice' || el === 'air' ? 'meteor' : 'beam';
	if (style === 'ranged') return 'beam';
	return 'rampage';
}

/** Play a pixel effect on a token; resolves when it lands */
function on(id, token, { element = 'none', scale = 1, from = null } = {}) {
	if (!id || !token) return Promise.resolve();
	const c = center(token);
	const run = playFx(id, { ...c, from: from ?? c, to: c, tokenSize: sizeOf(token), token, element, scale });
	return Promise.resolve(run?.hit ?? run);
}
/** A line effect from one point to a token */
function line(id, from, token, { element = 'none', scale = 1 } = {}) {
	const to = center(token);
	const run = playFx(id, { x: to.x, y: to.y, from, to, rotation: angleTo(from, to), tokenSize: sizeOf(token), token, element, scale });
	return Promise.resolve(run?.hit ?? run);
}
const feet = (t) => {
	const c = center(t);
	return { x: c.x, y: c.y + (t.h ?? g()) * 0.42 };
};
const mid = (tokens) => {
	const cs = tokens.map(center);
	return { x: cs.reduce((s, c) => s + c.x, 0) / cs.length, y: cs.reduce((s, c) => s + c.y, 0) / cs.length };
};
/** The element's big hit on every target that was hit, pushed away from the boss */
const hitAll = (src, targets, el, k = 1) =>
	Promise.all(
		targets.map(async (t, i) => {
			await wait(i * 110);
			if (t.result === 'miss') return I.afterimages(t.token, 220, 0xffffff);
			I.flashToken(t.token, 120);
			const a = center(src);
			const b = center(t.token);
			const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
			knockback(t.token, (b.x - a.x) / d, (b.y - a.y) / d, 2 * k);
			return on(ELEMENT_HIT[el] ?? ELEMENT_HIT.none, t.token, { element: el, scale: 0.9 * k });
		}),
	);

const SCENES = {
	async breath({ src, targets, el, color, keep }) {
		const a = center(src);
		keep(I.letterbox(380));
		playSound('aura-rise');
		keep(I.focusLines(a, { color, alpha: 0.28 }));
		await on('sf-pfx-spell-charge', src, { element: el, scale: 1.3 });
		await I.pulseScale(src, 1.18, 380);
		playSound('eruption');
		I.shake(1.6, 1100);
		I.screenFlash(color, 0.25, 300);
		await Promise.all(targets.map((t, i) => wait(i * 120).then(() => line('sf-breath', a, t.token, { element: el, scale: 1.4 }))));
		await hitAll(src, targets, el, 1.1);
		for (const t of targets) I.scorch(feet(t.token), { color: 0x1a0d06, size: 1.4 });
		I.aftermath(targets.map((t) => center(t.token)), { color, ms: 1400 });
		await wait(500);
	},

	async quake({ src, targets, el, color, keep }) {
		playSound('high-powering-up');
		keep(I.runeCircle(feet(src), { color, size: 1.4 * Math.min(2, sizeOf(src)) }));
		await tweenOffset(src, { x: 0, y: -g() * 1.1 }, 320);
		await wait(160);
		await tweenOffset(src, { x: 0, y: 0 }, 110);
		playSound('mecha-limb-explosion');
		await hitstop(140);
		I.shake(3.2, 900);
		I.screenFlash(0xffffff, 0.35, 200);
		on('sf-quake', src, { element: el === 'none' ? 'earth' : el, scale: 1.6 });
		I.shockwaves(feet(src), { color, size: 4, count: 3, gap: 160 });
		await Promise.all(
			targets.map(async (t, i) => {
				await wait(180 + i * 140);
				I.debris(feet(t.token), { color: 0x6b5236, count: 22, power: 1.4, kind: 'chip' });
				on('sf-rock-spikes', t.token, { element: el, scale: 1.1 });
				if (t.result !== 'miss') I.stagger(t.token, 1.4);
			}),
		);
		await hitAll(src, targets, el, 1);
		await wait(400);
	},

	async rampage({ src, targets, el, color, keep }) {
		const main = targets[0]?.token;
		if (!main) return;
		const a = center(src);
		const b = center(main);
		const trail = I.afterimages(src, 0, 0xff8a8a);
		const ids = ['sf-claw', 'sf-bite', 'sf-slash-x', 'sf-claw', 'sf-slash-heavy'];
		for (let i = 0; i < 5; i++) {
			const ang = (i / 5) * Math.PI * 2 + 0.4;
			const r = g() * 0.8;
			playSound('swoosh-grain', { volume: 0.75 });
			await tweenOffset(src, { x: b.x + Math.cos(ang) * r - a.x, y: b.y + Math.sin(ang) * r * 0.6 - a.y }, 80);
			on(ids[i], main, { element: el, scale: 1.1 });
			I.flashToken(main, 70);
			I.shake(0.6, 110);
			await hitstop(40);
			await wait(90);
		}
		trail();
		playSound('critical-strike');
		await on('sf-pfx-heavy-cleave', main, { element: el, scale: 1.5 });
		I.screenFlash(color, 0.45, 240);
		await hitstop(180);
		I.shake(2.6, 520);
		knockback(main, Math.sign(b.x - a.x) || 1, 0, 3);
		for (const t of targets.slice(1)) on(ELEMENT_HIT[el] ?? ELEMENT_HIT.none, t.token, { element: el, scale: 0.8 });
		await wait(260);
		await tweenOffset(src, { x: 0, y: 0 }, 380);
	},

	async meteor({ src, targets, el, color, keep }) {
		const all = targets.map((t) => t.token);
		playSound('panic-energy');
		keep(I.letterbox(380));
		const dim = I.dimScene([src, ...all], { alpha: 0.55, ms: 300 });
		await on('sf-pfx-storm-cloud', src, { element: el, scale: 1.2 });
		for (const t of all) I.telegraph(feet(t), { color, size: 1.4, ms: 900 });
		await wait(500);
		for (let wave = 0; wave < 2; wave++) {
			await Promise.all(
				targets.map(async (t, i) => {
					await wait(i * 140 + Math.random() * 120);
					const c = center(t.token);
					const from = { x: c.x - g() * 2.5, y: c.y - g() * 5 };
					await I.blazingProjectile(from, c, { color, size: 0.6, ms: 420, fall: true, embers: 5 });
					I.burstFlash(c, { color, size: 1.2 });
					I.shake(1.2, 200);
				}),
			);
		}
		playSound('magisplosion');
		await hitAll(src, targets, el, 1.2);
		I.aftermath(all.map(center), { color, ms: 1500 });
		await wait(400);
		await dim?.(400);
	},

	async beam({ src, targets, el, color, keep }) {
		const a = center(src);
		playSound('mecha-laser-prepare');
		keep(I.letterbox(380));
		keep(I.runeCircle(a, { color, size: 1.8 * Math.min(2, sizeOf(src)), spin: 2 }));
		keep(await I.chargeUp(src, { color, ms: 1300 }));
		playSound('mecha-laser-release');
		I.screenFlash(color, 0.5, 260);
		I.shake(2.2, 900);
		await Promise.all(targets.map((t, i) => wait(i * 90).then(() => line('sf-pfx-arcane-beam', a, t.token, { element: el, scale: 1.3 }))));
		await hitAll(src, targets, el, 1.2);
		await wait(450);
	},

	async abyss({ src, targets, el, color, keep }) {
		playSound('dark-energy-sphere');
		const dim = I.dimScene([src, ...targets.map((t) => t.token)], { alpha: 0.65, ms: 300 });
		await Promise.all(targets.map((t, i) => wait(i * 120).then(() => on('sf-pfx-hex-sigil', t.token, { element: el, scale: 1.2 }))));
		I.linkLines([center(src), ...targets.map((t) => center(t.token))], { color, ms: 1300, closed: false });
		await Promise.all(targets.map((t) => (t.result === 'miss' ? null : on('sf-pfx-curse', t.token, { element: el, scale: 1 }))));
		playSound('teleport-downer');
		for (const t of targets) if (t.result !== 'miss') I.blazingProjectile(center(t.token), center(src), { color, size: 0.35, ms: 600, arc: 0.3, embers: 2 });
		await wait(600);
		I.orbit(src, [color, 0xffffff], { ms: 1200, count: 8 });
		await I.pulseScale(src, 1.15, 500);
		await hitAll(src, targets, el, 0.9);
		await dim?.(400);
	},

	async summon({ src, targets, el, color, keep }) {
		const a = feet(src);
		playSound('sharpest-summon');
		keep(I.runeCircle(a, { color, size: 2.6, spin: 1.5 }));
		await on('sf-pfx-magic-circle', src, { element: el, scale: 1.6 });
		const spots = [0, 1, 2].map((i) => ({ x: a.x + (i - 1) * g() * 1.4, y: a.y + g() * 0.6 }));
		for (const p of spots) {
			I.beamDown(p, { color, width: 0.6, ms: 800 });
			await wait(160);
		}
		I.shake(1.4, 500);
		playSound('noise-summon');
		I.burstFlash(a, { color, size: 2 });
		if (targets.length) await hitAll(src, targets, el, 0.9);
		await wait(400);
	},

	async roar({ src, targets, el, color, keep }) {
		const a = center(src);
		playSound('aura-rise');
		keep(await I.menace(src, { color, ms: 520 }));
		keep(I.focusLines(a, { color: 0xffffff, alpha: 0.4 }));
		playSound('eruption');
		const big = I.pulseScale(src, 1.28, 700);
		I.shake(3, 1000);
		I.shockwaves(a, { color, size: 6, count: 4, gap: 120 });
		on('sf-soundwave', src, { element: el, scale: 1.8 });
		await wait(300);
		await Promise.all(targets.map((t, i) => wait(i * 90).then(() => (t.result === 'miss' ? null : I.stagger(t.token, 1.2)))));
		if (targets.some((t) => t.result !== 'miss')) await Promise.all(targets.filter((t) => t.result !== 'miss').map((t) => on('sf-pfx-curse', t.token, { element: el })));
		await big;
		await wait(300);
	},

	async bastion({ src, el, color, keep }) {
		playSound('bonus-max-shield');
		keep(I.runeCircle(feet(src), { color, size: 1.8, spin: 0.7 }));
		const done = I.dome(center(src), { radius: 1.6 * Math.min(2, sizeOf(src)), color, ms: 1800 });
		await on('sf-pfx-divine-shield', src, { element: el, scale: 1.4 });
		I.orbit(src, [color, 0xffffff], { ms: 1400, count: 6 });
		await I.pulseScale(src, 1.12, 600);
		on('sf-pfx-stat-rise', src, { element: el });
		await done;
	},

	async judgment({ src, targets, el, color, keep }) {
		playSound('jacobs-ladder');
		keep(I.letterbox(380));
		await on('sf-pfx-spell-charge', src, { element: el, scale: 1.2 });
		for (const t of targets) I.telegraph(feet(t.token), { color, size: 1.3, ms: 700 });
		await wait(380);
		for (const [i, t] of targets.entries()) {
			await wait(i ? 160 : 0);
			I.beamDown(center(t.token), { color, width: 0.9, ms: 700 });
			on(el === 'bolt' ? 'sf-lightning' : 'sf-smite', t.token, { element: el, scale: 1.3 });
			I.screenFlash(0xffffff, 0.3, 140);
			I.shake(1.6, 260);
		}
		await hitAll(src, targets, el, 1.1);
		await wait(400);
	},
};

/**
 * Play a boss move for a plan. The caller has done the boss wind-up (menace, cut-in).
 * @returns {Promise<boolean>} false when there is nothing to play
 */
export async function playBossMove(key, { plan, src, targets }) {
	const scene = SCENES[key];
	if (!scene || !src) return false;
	const el = plan.element && plan.element !== 'auto' ? plan.element : 'none';
	const color = ELEMENT_COLOR[el] ?? ELEMENT_COLOR.none;
	if (plan.offensive && targets.length) I.cameraPush(mid(targets.map((t) => t.token)), { zoom: 1.1, inMs: 380, hold: 1600, outMs: 600 });
	// cinema bars, magic circles and focus lines stay up for the whole move, then go away together
	const open = [];
	const keep = (close) => (typeof close === 'function' && open.push(close), close);
	try {
		await scene({ plan, src, targets, el, color, keep });
	} finally {
		await Promise.all(open.map((close) => Promise.resolve(close()).catch(() => null)));
	}
	return true;
}
