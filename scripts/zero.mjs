import { playSound } from './audio.mjs';
import { center, knockback, playFx, tweenOffset, wait } from './player.mjs';
import { hitstop } from './clock.mjs';
import { pixelDuration } from './pixel.mjs';
import * as I from './impact.mjs';

/**
 * Zero Powers (High Fantasy Atlas): one limit break per zero effect, built from pixelfx effects
 * (scripts/pfx, patch-gg/pixelfx). Each scene has three stages a player can change in the editor (charge, main,
 * finish: any effect from the grid, or none), a color that recolors all three, and its own motion and timing.
 * Players name their powers freely, so the effect is read from the item: Project FU's "Zero effect" field, then
 * its text, then its name.
 */

const DAMAGE = ['air', 'bolt', 'dark', 'earth', 'fire', 'ice', 'light', 'poison'];
const sizeOf = (t) => Math.max(t?.document?.width ?? 1, t?.document?.height ?? 1);
const g = () => canvas.grid.size;

/** The big hit for each damage type (Zero Elements, Zero Scourge) */
export const ELEMENT_HIT = { fire: 'sf-explosion-big', ice: 'sf-ice-nova', bolt: 'sf-lightning-storm', air: 'sf-tornado', earth: 'sf-quake', light: 'sf-smite', dark: 'sf-black-hole', poison: 'sf-poison-cloud', physical: 'sf-pfx-crit-hit', none: 'sf-pfx-crit-hit' };

/**
 * The eleven zero effects. color: the banner's (the stages keep their own palettes unless the player picks a
 * color). stages: the default effect for each stage, and what each stage is in this scene.
 */
export const ZERO_EFFECTS = {
	blitz: { label: 'Zero Blitz', color: 0xffc94a, words: /blitz/i, stages: { charge: 'sf-pfx-charge-up', main: 'sf-pfx-dagger-flurry', finish: 'sf-pfx-crit-hit' }, roles: { charge: 'Power gathering on the user', main: 'Each dash-strike', finish: 'The final blow' } },
	chance: { label: 'Zero Chance', color: 0xb07cff, words: /chance|3d6|odd or even/i, stages: { charge: 'sf-pfx-dice-roll', main: 'sf-pfx-firework-burst', finish: 'sf-pfx-coin-drop' }, roles: { charge: 'The roll', main: 'The jackpot over the user', finish: 'On each target or ally' } },
	cost: { label: 'Zero Cost', color: 0x5fe39a, words: /\bcost\b|inventory point/i, stages: { charge: 'sf-pfx-magic-circle', main: 'sf-pfx-chest-open', finish: 'sf-pfx-coin-drop' }, roles: { charge: 'Under the user', main: 'The treasure', finish: 'On each ally' } },
	elements: { label: 'Zero Elements', color: 0xff8a3d, words: /elements?\b/i, stages: { charge: 'sf-pfx-spell-charge', main: 'auto', finish: 'sf-pfx-mana-burst' }, roles: { charge: 'Charging both elements', main: 'Each strike (Automatic: by element)', finish: 'The aura it keeps' } },
	limits: { label: 'Zero Limits', color: 0xff5a3c, words: /limits?\b|die size higher/i, stages: { charge: 'sf-pfx-charge-up', main: 'sf-pfx-stat-rise', finish: 'sf-pfx-power-star' }, roles: { charge: 'Power gathering', main: 'The Attributes rising', finish: 'The transformation' } },
	magic: { label: 'Zero Magic', color: 0x8a7cff, words: /magic|spell action for free/i, stages: { charge: 'sf-pfx-spell-charge', main: 'sf-pfx-magic-circle', finish: 'sf-pfx-star-fall' }, roles: { charge: 'On the user', main: 'On each target', finish: 'Falling on each target' } },
	objective: { label: 'Zero Objective', color: 0x4fd8d0, words: /objective|sections of a clock/i, stages: { charge: 'sf-pfx-time-stop', main: 'sf-pfx-mana-burst', finish: 'sf-twinkle' }, roles: { charge: 'The clock', main: 'Time breaking free', finish: 'After' } },
	remedy: { label: 'Zero Remedy', color: 0xfff0b0, words: /remedy|recover from all status/i, stages: { charge: 'sf-pfx-holy-pillar', main: 'sf-pfx-heal-aoe', finish: 'sf-pfx-feather-burst' }, roles: { charge: 'Light on each ally', main: 'Healing each ally', finish: 'Over the user' } },
	scourge: { label: 'Zero Scourge', color: 0x9b5cff, words: /scourge/i, stages: { charge: 'sf-pfx-storm-cloud', main: 'sf-pfx-hex-sigil', finish: 'sf-pfx-curse' }, roles: { charge: 'Gathering over the targets', main: 'Marking each target (then its element strikes)', finish: 'The statuses' } },
	shield: { label: 'Zero Shield', color: 0x7fe0ff, words: /shield|damage suffered .* halved/i, stages: { charge: 'sf-pfx-divine-shield', main: 'sf-pfx-force-field', finish: 'sf-defense-up' }, roles: { charge: 'On the user', main: 'Over each ally', finish: 'After' } },
	triangle: { label: 'Zero Triangle', color: 0xff6bd5, words: /triangle|up to two allies/i, stages: { charge: 'sf-pfx-trinity-link', main: 'sf-pfx-arcane-beam', finish: 'sf-pfx-crit-hit' }, roles: { charge: 'Linking the three heroes', main: 'Each hero’s beam', finish: 'Where they meet' } },
};
export const ZERO_STAGES = ['charge', 'main', 'finish'];
export const stageField = (s) => `zero${s[0].toUpperCase()}${s.slice(1)}`;

const strip = (html) => String(html ?? '').replace(/<[^>]+>/g, ' ');

/** Which zero effect an item has: its Zero effect field first, then its text, then its name */
export function zeroKeyOf(item) {
	const z = item?.system?.data;
	const fields = [z?.zeroEffect?.value, strip(z?.zeroEffect?.description), item?.name, strip(item?.system?.description), strip(z?.description)];
	for (const f of fields) {
		if (!f) continue;
		for (const k of Object.keys(ZERO_EFFECTS)) if (new RegExp(`zero\\s*${k}`, 'i').test(f)) return k;
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

/** The effect a stage plays: the player's choice, else the scene's own ('none' plays nothing) */
export function stageOf(spec, key, stage) {
	const own = spec?.[stageField(stage)];
	const id = own || ZERO_EFFECTS[key]?.stages[stage];
	return id === 'none' ? null : id;
}

/** Tokens on the user's side (for Remedy, Shield, Cost, Triangle) */
function alliesOf(src) {
	if (!src) return [];
	const disp = src.document?.disposition;
	return (canvas.tokens?.placeables ?? []).filter((t) => t.visible && !t.document.hidden && t.document.disposition === disp && t.actor);
}

/**
 * Play one stage on a token. element: the player's color (a hex) or a damage type, else the effect's own palette.
 * Resolves when it lands (its hit), with .done for when it ends.
 */
function stage(id, token, { element = 'none', scale = 1, from = null, opts = null } = {}) {
	if (!id || !token) return Object.assign(Promise.resolve(), { done: Promise.resolve() });
	const c = center(token);
	const run = playFx(id, { ...c, from: from ?? c, to: c, tokenSize: sizeOf(token), token, element, scale, ...(opts ? { opts } : {}) });
	const hit = run?.hit ?? run ?? Promise.resolve();
	return Object.assign(Promise.resolve(hit), { done: Promise.resolve(run) });
}
const lasts = (id, k = 1) => (id ? Math.min(2600, pixelDuration(id) * k) : 0);
const feetOf = (t) => {
	const c = center(t);
	return { x: c.x, y: c.y + (t.h ?? g()) * 0.42 };
};

/* ------------------------------------------------------------------ */
/*  The scenes: motion and timing; the stages are the player's to change */
/* ------------------------------------------------------------------ */

const SCENES = {
	/** Dash-strikes from all sides, then one last blow */
	async blitz({ src, targets, S, el, scale }) {
		const main = targets[0]?.token;
		if (src) await stage(S.charge, src, { element: el, scale });
		if (!src || !main) return;
		const a = center(src);
		const b = center(main);
		const trail = I.afterimages(src, 0, 0xffe2a0);
		for (let i = 0; i < 4; i++) {
			const ang = (i / 4) * Math.PI * 2 + 0.6;
			const r = g() * 0.9;
			playSound('swoosh-grain', { volume: 0.7 });
			await tweenOffset(src, { x: b.x + Math.cos(ang) * r - a.x, y: b.y + Math.sin(ang) * r * 0.6 - a.y }, 90);
			stage(S.main, main, { element: el, scale, from: { x: b.x + Math.cos(ang) * r, y: b.y + Math.sin(ang) * r * 0.6 } });
			I.flashToken(main, 80);
			I.shake(0.5, 120);
			await hitstop(50);
			await wait(120);
		}
		trail();
		await tweenOffset(src, { x: b.x - a.x - g() * 0.9, y: b.y - a.y }, 120);
		playSound('critical-strike');
		await stage(S.finish, main, { element: el, scale: scale * 1.6 });
		I.screenFlash(0xffffff, 0.6, 260);
		await hitstop(200);
		I.shake(3, 600);
		knockback(main, 1, 0, 3);
		await wait(300);
		await tweenOffset(src, { x: 0, y: 0 }, 420);
	},

	/** Three dice roll at the user's feet; the better the roll, the bigger the payoff */
	async chance({ src, targets, S, el, scale }) {
		const faces = [0, 1, 2].map(() => 1 + Math.floor(Math.random() * 6));
		playSound('magic-sparkles');
		if (src) await stage(S.charge, src, { element: el, scale: scale * 1.3, opts: { faces } });
		const doubles = faces[0] === faces[1] && faces[1] === faces[2];
		playSound(doubles ? 'dramatic-finish' : 'coin-impact');
		if (src) stage(S.main, src, { element: el, scale: scale * (doubles ? 1.6 : 1.2) });
		await wait(500);
		const spots = targets.length ? targets.map((t) => t.token) : alliesOf(src);
		for (const t of spots) {
			stage(S.finish, t, { element: el, scale });
			await wait(150);
		}
		if (doubles) I.screenFlash(0xfff0b0, 0.5, 400);
		await wait(lasts(S.finish, 0.5));
	},

	/** A circle opens under the user and the treasure pours out over the party */
	async cost({ src, S, el, scale }) {
		if (!src) return;
		playSound('buff-pickup');
		stage(S.charge, src, { element: el, scale });
		await wait(Math.min(1200, lasts(S.charge, 0.4)));
		await stage(S.main, src, { element: el, scale: scale * 1.3 });
		playSound('coin-impact', { volume: 0.7 });
		for (const t of alliesOf(src)) {
			stage(S.finish, t, { element: el, scale });
			await wait(120);
		}
		await wait(lasts(S.finish, 0.5));
	},

	/** Both elements gather on the user, then strike the targets in turn; the user keeps the aura */
	async elements({ src, targets, S, el, scale, types, plan }) {
		const [a, b] = types.length >= 2 ? types : types.length === 1 ? [types[0], types[0] === 'fire' ? 'ice' : 'fire'] : ['fire', 'ice'];
		if (src) {
			playSound('energy-riser');
			stage(S.charge, src, { element: el !== 'none' ? el : a, scale });
			await wait(500);
			await stage(S.charge, src, { element: el !== 'none' ? el : b, scale: scale * 1.2 });
		}
		let i = 0;
		const own = plan.spec?.zeroMain;
		for (const t of targets) {
			const type = i++ % 2 ? b : a;
			const id = own && own !== 'auto' ? (own === 'none' ? null : own) : ELEMENT_HIT[type];
			if (src && t.token !== src) await I.blazingProjectile(center(src), center(t.token), { color: 0xffffff, size: 0.3, ms: 320 });
			stage(id, t.token, { element: el !== 'none' ? el : type, scale: scale * 1.3 });
			I.shake(1.2, 260);
			await wait(200);
		}
		if (src) await stage(S.finish, src, { element: el !== 'none' ? el : a, scale });
	},

	/** Power gathers, every Attribute rises, the user transforms */
	async limits({ src, S, el, scale }) {
		if (!src) return;
		playSound('high-powering-up');
		await stage(S.charge, src, { element: el, scale });
		playSound('growing-strength');
		stage(S.main, src, { element: el, scale: scale * 1.2 });
		await wait(1100);
		I.pulseScale(src, 1.25, 600);
		await stage(S.finish, src, { element: el, scale: scale * 1.4 });
		I.screenFlash(0xffd27a, 0.4, 300);
		I.shake(2, 400);
		await wait(500);
	},

	/** A spell gathers on the user; circles open under the targets and the sky falls on them */
	async magic({ src, targets, S, el, scale }) {
		playSound('casting-buff');
		if (src) await stage(S.charge, src, { element: el, scale });
		const spots = targets.length ? targets.map((t) => t.token) : src ? [src] : [];
		playSound('jacobs-ladder', { volume: 0.7 });
		const hits = spots.map((t) => stage(S.main, t, { element: el, scale: scale * 1.2 }));
		await Promise.all(hits);
		I.shake(1.6, 400);
		for (const t of spots) {
			stage(S.finish, t, { element: el, scale });
			await wait(140);
		}
		await wait(lasts(S.finish, 0.6));
	},

	/** The clock: time slows, stops, and breaks */
	async objective({ src, S, el, scale }) {
		if (!src) return;
		playSound('teleport-downer');
		await stage(S.charge, src, { element: el, scale: scale * 1.4 });
		await wait(Math.max(0, lasts(S.charge, 0.6) - 1700));
		playSound('magisplosion', { volume: 0.7 });
		await stage(S.main, src, { element: el, scale: scale * 1.3 });
		stage(S.finish, src, { element: el, scale });
		await wait(700);
	},

	/** Light on every ally, healing, and feathers over the user */
	async remedy({ src, targets, S, el, scale }) {
		const allies = targets.length ? targets.map((t) => t.token) : alliesOf(src);
		if (src && !allies.includes(src)) allies.unshift(src);
		playSound('healing-gusts');
		for (const t of allies) {
			stage(S.charge, t, { element: el, scale });
			await wait(120);
		}
		await wait(Math.min(1000, lasts(S.charge, 0.3)));
		playSound('simple-heal');
		await Promise.all(allies.map((t) => stage(S.main, t, { element: el, scale })));
		if (src) await stage(S.finish, src, { element: el, scale: scale * 1.2 });
		await wait(600);
	},

	/** A storm gathers, every target is marked, their element strikes them all at once, statuses linger */
	async scourge({ targets, S, el, scale, types }) {
		const type = types[0] ?? 'dark';
		const spots = targets.map((t) => t.token);
		playSound('panic-energy');
		for (const t of spots) stage(S.charge, t, { element: el, scale });
		await wait(600);
		await Promise.all(spots.map((t) => stage(S.main, t, { element: el, scale })));
		playSound('magisplosion');
		for (const t of spots) stage(ELEMENT_HIT[type], t, { element: el !== 'none' ? el : type, scale: scale * 1.3 });
		I.screenFlash(0xffffff, 0.4, 260);
		I.shake(2.6, 500);
		await hitstop(150);
		await wait(400);
		for (const t of spots) stage(S.finish, t, { element: el, scale });
		await wait(lasts(S.finish, 0.5));
	},

	/** A barrier on the user, then over every ally */
	async shield({ src, S, el, scale }) {
		const allies = alliesOf(src);
		if (src && !allies.includes(src)) allies.unshift(src);
		playSound('appear-firewall');
		if (src) await stage(S.charge, src, { element: el, scale });
		for (const t of allies) {
			stage(S.main, t, { element: el, scale });
			await wait(110);
		}
		await wait(900);
		for (const t of allies) stage(S.finish, t, { element: el, scale });
		await wait(600);
	},

	/** Three heroes linked by a triangle on the floor, three beams meeting on the target */
	async triangle({ src, targets, S, el, scale }) {
		const main = targets[0]?.token;
		const team = [src, ...alliesOf(src).filter((t) => t !== src)].filter(Boolean).slice(0, 3);
		if (!team.length) return;
		playSound('energy-crystal');
		// the triangle stands on the centre of the three, its corners on their feet
		const feet = team.map(feetOf);
		await stage(S.charge, team[0], { element: el, scale, opts: feet.length === 3 ? { points: feet } : null });
		if (!main) return;
		playSound('mecha-white-laser');
		await Promise.all(team.map((t) => stage(S.main, main, { element: el, scale, from: center(t) })));
		await stage(S.finish, main, { element: el, scale: scale * 1.8 });
		I.shake(2.4, 500);
		await hitstop(150);
		await wait(400);
	},
};

/**
 * Play a Zero Power's scene. The caller has done the bars, darkness and cut-in.
 * @returns {Promise<boolean>} false when there is no scene for this key
 */
export async function playZero(key, { plan, src, targets }) {
	const scene = SCENES[key];
	if (!scene) return false;
	const spec = plan.spec ?? {};
	const S = Object.fromEntries(ZERO_STAGES.map((s) => [s, stageOf(spec, key, s)]));
	const el = spec.zeroColor || 'none';
	await scene({ plan, src, targets, S, el, scale: Number(spec.scale) || 1, types: plan.zeroTypes ?? [] });
	return true;
}
