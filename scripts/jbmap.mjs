/**
 * The JB2A preset: every built-in animation translated to JB2A (free) effects.
 * Each original effect has a JB2A counterpart for its role (on the user, on the target, flying across),
 * chosen by what it depicts and by element. Effects JB2A has nothing for (meteor showers, petals, laughter...)
 * keep their original drawing. A few abilities get hand-picked JB2A animations on top.
 */

import { pixelSoundAs } from './pixelmap.mjs';

const v = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);

/* ------------------------------------------------------------------ */
/*  By element                                                         */
/* ------------------------------------------------------------------ */

const EL_HIT = {
	physical: 'jb-impact-007',
	fire: 'jb-explosion-01',
	ice: 'jb-frost-impact',
	bolt: 'jb-static',
	air: 'jb-whirlwind',
	earth: 'jb-ground-crack',
	light: 'jb-sacred-flame',
	dark: 'jb-annihilation',
	poison: 'jb-poisoned',
	none: 'jb-impact-006',
};
const EL_BIG = {
	physical: 'jb-impact-008',
	fire: 'jb-explosion-fireball',
	ice: 'jb-ice-spikes',
	bolt: 'jb-call-lightning',
	air: 'jb-whirlwind',
	earth: 'jb-ground-crack-2',
	light: 'jb-smite',
	dark: 'jb-explosion-04',
	poison: 'jb-darkness-green',
	none: 'jb-explosion-04',
};
const EL_BOLT = {
	physical: 'jb-shot-yellow',
	fire: 'jb-fire-bolt',
	ice: 'jb-ray-of-frost',
	bolt: 'jb-witch-bolt',
	air: 'jb-shot-teal',
	earth: 'jb-boulder',
	light: 'jb-guiding-bolt',
	dark: 'jb-eldritch-blast',
	poison: 'jb-shot-green',
	none: 'jb-shot-yellow',
};
const EL_BEAM = {
	physical: 'jb-beam-orange',
	fire: 'jb-scorching-ray',
	ice: 'jb-ray-of-frost',
	bolt: 'jb-witch-bolt',
	air: 'jb-beam-blue',
	earth: 'jb-beam-orange-2',
	light: 'jb-beam-pink',
	dark: 'jb-strands',
	poison: 'jb-disintegrate',
	none: 'jb-beam-blue',
};
const EL_BREATH = {
	fire: 'jb-breath-fire',
	ice: 'jb-breath-cold',
	bolt: 'jb-breath-lightning',
	poison: 'jb-breath-poison',
	earth: 'jb-breath-acid',
	air: 'jb-gust',
	dark: 'jb-breath-poison',
	light: 'jb-burst-fire',
	physical: 'jb-gust',
	none: 'jb-breath-fire',
};
const EL_SIGN = {
	fire: 'jb-sign-evocation',
	ice: 'jb-sign-abjuration',
	bolt: 'jb-sign-divination',
	air: 'jb-sign-enchantment',
	earth: 'jb-sign-transmutation',
	light: 'jb-sign-conjuration',
	dark: 'jb-sign-illusion',
	poison: 'jb-sign-necromancy',
	physical: 'jb-sign-abjuration',
	none: 'jb-sign-illusion',
};

/* ------------------------------------------------------------------ */
/*  Original effect -> JB2A, as an effect on a target                  */
/* ------------------------------------------------------------------ */

const HIT = {
	// strikes (a melee hit becomes a weapon swing, see below)
	'slash-wave-1': 'jb-shockwave',
	'slash-wave-2': 'jb-shockwave',
	'slash-wave-3': 'jb-whirlwind',
	// hits
	'arrow-hit-1': 'jb-impact-008',
	'beam-hit-2': 'jb-impact-011',
	'beam-hit-4': 'jb-impact-012',
	'bolt-hit-1': 'jb-impact-001',
	'bolt-hit-2': 'jb-impact-002',
	'dualbolt-hit-1': 'jb-impact-003',
	'impact-flash-1': 'jb-impact-007',
	'impact-flash-2': 'jb-impact-007',
	'impact-flash-3': 'jb-impact-013',
	'px-impact-dir-1': 'jb-impact-009',
	'px-impact-dir-2': 'jb-impact-010',
	'px-impact-dir-3': 'jb-impact-009',
	'px-impact-dir-4': 'jb-impact-010',
	'px-impact-sym-1': 'jb-impact-007',
	'px-impact-sym-2': 'jb-frost-impact',
	'px-impact-sym-3': 'jb-ground-crack',
	'px-impact-sym-4': 'jb-impact-008',
	'px-impact-sym-6': 'jb-impact-012',
	// explosions
	'px-explosion-epic-1': 'jb-explosion-01',
	'px-explosion-epic-2': 'jb-explosion-04',
	'px-explosion-stylized-1': 'jb-explosion-fireball',
	'px-explosion-stylized-2': 'jb-annihilation',
	'px-explosion-stylized-3': 'jb-explosion-08',
	'px-explosion-sym-1': 'jb-explosion-01',
	'px-explosion-sym-2': 'jb-explosion-04',
	'px-explosion-sym-4': 'jb-explosion-08',
	// fire, lightning, smoke
	'px-fire-loop-3a': 'jb-flames',
	'px-fire-loop-3b': 'jb-flames',
	'px-fire-loop-4a': 'jb-fire-ring',
	'px-fire-loop-4b': 'jb-flames',
	'px-lightning-aura': 'jb-lightning-ball',
	'px-lightning-burst-1': 'jb-static',
	'px-lightning-burst-2': 'jb-static-2',
	'px-lightning-burst-3': 'jb-lightning-ball',
	'px-lightning-strike': 'jb-call-lightning',
	'px-skull-smoke': 'jb-skull',
	'px-smoke-dir': 'jb-fumes',
	'px-smoke-loop-1': 'jb-fog',
	'px-smoke-loop-2': 'jb-fumes',
	'px-smoke-ring': 'jb-ground-crack-2',
	'px-splatter-burst-1': 'jb-impact-010',
	'px-splatter-burst-3': 'jb-impact-010',
	'px-splatter-dir-1': 'jb-impact-009',
	'px-splatter-dir-3': 'jb-impact-009',
	// bursts
	'px-bubble-burst': 'jb-water-splash',
	'px-coin-burst': 'jb-firework-2',
	'px-firework-1': 'jb-firework',
	'px-firework-2': 'jb-firework-2',
	'px-heart-burst': 'jb-charm',
	'px-light-burst': 'jb-sacred-flame',
	'px-music-1': 'jb-music',
	'px-music-2': 'jb-music',
	'px-sparkle-burst-1': 'jb-star-burst',
	'px-sparkle-burst-2': 'jb-star-burst',
	'px-sparkle-burst-3': 'jb-particle-burst',
	// status
	'px-absorb': 'jb-hadar',
	'px-attack-up': 'jb-buff-purple',
	'px-death': 'jb-toll',
	'px-defense-up': 'jb-shield',
	'px-haste': 'jb-buff-white',
	'px-heal-heart': 'jb-charm',
	'px-poison-bubbles': 'jb-poisoned',
	'px-poison-cloud': 'jb-darkness-green',
	'px-sparkles': 'jb-sparkles',
	// symbols
	'px-sym-alert-1': 'jb-fear',
	'px-sym-alert-2': 'jb-fear',
	'px-sym-attack-up': 'jb-buff-purple',
	'px-sym-crown': 'jb-boon',
	'px-sym-defense-up': 'jb-shield',
	'px-sym-failure': 'jb-curse',
	'px-sym-lightbulb': 'jb-inspire',
	'px-sym-magic-up': 'jb-buff',
	'px-sym-question': 'jb-dizzy',
	'px-sym-success': 'jb-boon',
	'px-sym-thumbs-down': 'jb-curse',
	'px-sym-thumbs-up': 'jb-boon',
	'px-sym-warning': 'jb-fear',
	// tech
	'px-charge-up': 'jb-energy-field',
	'px-spark-burst': 'jb-impact-007',
	'px-warp-1': 'jb-teleport',
	'px-warp-2': 'jb-misty-step',
	'px-warp-3': 'jb-misty-step',
	// healing
	'heal-cross-1': 'jb-cure',
	'heal-cross-2': 'jb-cure',
	'heal-cross-3': 'jb-cure',
	'heal-long-1': 'jb-heal-green',
	'heal-long-2': 'jb-heal-yellow',
	'heal-long-3': 'jb-heal-green',
	'heal-puff-1': 'jb-heal-burst',
	'heal-puff-2': 'jb-heal-burst-2',
	'heal-puff-3': 'jb-heal-burst',
	'heal-quick-1': 'jb-heal-blue',
	'heal-quick-2': 'jb-heal-green',
	'heal-quick-3': 'jb-heal-yellow',
	'heal-quick-4': 'jb-heal-purple',
	'heal-quick-5': 'jb-heal-green',
	'heal-quick-6': 'jb-heal-yellow',
	// buffs
	barrier: 'jb-shield',
	'shield-hex': 'jb-energy-field',
	'buff-sparks-1': 'jb-buff',
	'buff-sparks-2': 'jb-buff-gold',
	'buff-sparks-3': 'jb-buff-purple',
	'star-up': 'jb-buff-gold',
	// magic used as a hit
	'astral-1': 'jb-rune-burst',
	'astral-2': 'jb-rune-burst',
	'astral-3': 'jb-ward-star',
	'star-magic-1': 'jb-particle-burst',
	'star-magic-2': 'jb-particle-burst',
	'star-magic-3': 'jb-star-burst',
	'time-magic-1': 'jb-detect-magic',
	'time-magic-2': 'jb-ward-rune',
	'time-magic-3': 'jb-detect-magic',
	'cast-glow-1': 'jb-shimmer',
	'cast-glow-2': 'jb-shimmer',
	'cast-glow-3': 'jb-shimmer',
	'cast-glow-4': 'jb-shimmer',
	'cast-glow-5': 'jb-shimmer',
	'cast-glow-6': 'jb-shimmer',
	'cast-glow-7': 'jb-shimmer',
	'charge-back': 'jb-energy-gather',
	'charge-blaze-1': 'jb-flames',
	'charge-blaze-2': 'jb-flames',
	'charge-flame-1': 'jb-flames',
	'charge-flame-2': 'jb-energy-gather',
	'charge-flame-3': 'jb-energy-gather',
	'charge-flame-4': 'jb-energy-gather',
	// custom (code-drawn) effects
	'pr-claw': 'jb-claws',
	'pr-bite': 'jb-bite',
	'pr-sweep': 'jb-greataxe',
	'pr-stomp': 'jb-ground-crack',
	'pr-gaze': 'jb-horror',
	'pr-shockwave': 'jb-thunderwave',
	'pr-soundwave': 'jb-soundwave',
	'pr-tornado': 'jb-whirlwind',
	'pr-rain': 'jb-sleet',
	'pr-swarm': 'jb-bats',
	'pr-vines': 'jb-vines',
	'pr-web': 'jb-web',
	'pr-chains': 'jb-chains',
	'pr-void': 'jb-annihilation',
	'pr-zzz': 'jb-sleep',
	'pr-dizzy': 'jb-dizzy',
	'pr-tether': 'jb-strands',
	'pr-glyph': 'jb-sign-abjuration',
	'pr-cards': 'jb-card',
	'pr-pillar': 'jb-moonbeam',
	'pr-chain-lightning': 'jb-chain-lightning',
	'pr-wisps': 'jb-sparkles',
	'pr-missiles': 'jb-missile',
	'pr-volley': 'jb-bullet-2',
	'px-muzzle-1': 'jb-impact-009',
	'px-muzzle-3': 'jb-impact-009',
};

/* ------------------------------------------------------------------ */
/*  Original effect -> JB2A, as the effect on the user first           */
/* ------------------------------------------------------------------ */

const CAST = {
	'cast-glow-1': 'jb-sign-abjuration',
	'cast-glow-2': 'jb-sign-transmutation',
	'astral-1': 'jb-sign-divination',
	'astral-2': 'jb-sign-divination',
	'astral-3': 'jb-sign-abjuration',
	'star-magic-1': 'jb-sign-illusion',
	'star-magic-2': 'jb-sign-necromancy',
	'star-magic-3': 'jb-sign-illusion',
	'time-magic-1': 'jb-sign-divination',
	'time-magic-2': 'jb-sign-divination',
	'time-magic-3': 'jb-sign-divination',
	'heal-cross-1': 'jb-sacred-cast',
	'heal-cross-2': 'jb-sacred-cast',
	'heal-cross-3': 'jb-sacred-cast',
	'heal-puff-1': 'jb-sacred-cast',
	'buff-sparks-1': 'jb-sparkles',
	'buff-sparks-2': 'jb-sparkles',
	'buff-sparks-3': 'jb-sparkles',
	'charge-back': 'jb-energy-gather',
	'px-charge-up': 'jb-cast',
	'px-coin-burst': 'jb-firework-2',
	'px-muzzle-1': null,
	'px-muzzle-3': null,
};

const SWING = new Set(['slash-down-1', 'slash-down-2', 'slash-down-3', 'slash-down-circ-1', 'slash-down-circ-2', 'slash-down-circ-3', 'slash-down-red-1', 'slash-down-red-2', 'slash-down-red-3', 'slash-front-1', 'slash-front-2', 'slash-front-3', 'slash-up-1', 'slash-up-2', 'slash-up-3', 'slash-up-arch-1', 'slash-up-arch-2', 'slash-up-arch-3', 'slash-up-circ-1', 'slash-up-circ-2', 'slash-up-circ-3']);
const BLUNT = new Set(['px-impact-sym-1', 'px-impact-dir-4', 'impact-flash-2', 'px-impact-sym-3', 'px-impact-dir-1']);

/** Weapon swing for a weapon item, by category and name */
function weaponSwing(item, hitId) {
	const s = item?.system ?? {};
	const cat = v(s.category);
	const name = String(item?.name ?? '').toLowerCase();
	if (/kick/.test(name)) return 'jb-kick';
	if (/claw|talon|scratch|rend/.test(name)) return 'jb-claws';
	if (/bite|fang|jaw|maw|chomp/.test(name)) return 'jb-bite';
	if (/laser|beam ?sword|plasma/.test(name)) return 'jb-lasersword';
	switch (cat) {
		case 'dagger':
			return 'jb-dagger';
		case 'spear':
			return 'jb-dagger';
		case 'brawling':
			return /flurry|combo|barrage/.test(name) ? 'jb-flurry' : 'jb-punch';
		case 'flail':
			return 'jb-greatclub';
		case 'arcane':
			return 'jb-punch-magic';
		case 'heavy':
			if (/hammer|mace|maul|club|morning ?star|cudgel/.test(name)) return 'jb-maul';
			if (/axe|cleaver|halberd/.test(name)) return 'jb-greataxe';
			return 'jb-greatsword';
		case 'sword':
			return /axe/.test(name) ? 'jb-handaxe' : 'jb-greatsword';
	}
	if (/axe/.test(name)) return 'jb-handaxe';
	if (/hammer|mace|club|maul|staff|rod/.test(name)) return 'jb-greatclub';
	if (/dagger|knife|stab|sting|pierce|lance|spear|horn|tail/.test(name)) return 'jb-dagger';
	if (/punch|fist|slam|smash|headbutt|tackle|ram|charge|strike|blow/.test(name)) return 'jb-punch';
	if (BLUNT.has(hitId)) return 'jb-punch';
	return 'jb-greatsword';
}

/** Thrown or shot weapon for a ranged weapon item */
function rangedShot(item, el) {
	const s = item?.system ?? {};
	const cat = v(s.category);
	const name = String(item?.name ?? '').toLowerCase();
	if (cat === 'firearm' || /gun|pistol|rifle|musket|blaster|shot/.test(name)) return /rifle|snipe/.test(name) ? 'jb-snipe' : /blaster|laser|plasma|ray/.test(name) ? 'jb-bullet-blue' : 'jb-bullet';
	if (/crossbow/.test(name)) return 'jb-bolt';
	if (cat === 'bow' || /bow|arrow/.test(name)) return el === 'poison' ? 'jb-arrow-poison' : el && !['none', 'physical'].includes(el) ? 'jb-arrow-blue' : 'jb-arrow';
	if (/card/.test(name)) return 'jb-card';
	if (/bomb|grenade/.test(name)) return 'jb-bomb';
	if (/flask|potion|vial/.test(name)) return 'jb-flask';
	if (/rock|stone|boulder/.test(name)) return 'jb-boulder';
	if (/cannon/.test(name)) return 'jb-cannonball';
	if (/missile|rocket/.test(name)) return 'jb-missile';
	if (cat === 'thrown' || /knife|dagger|javelin|shuriken|throw/.test(name)) return 'jb-dagger-throw';
	if (cat === 'arcane') return EL_BOLT[el] ?? 'jb-shot-yellow';
	return null;
}

/** Hand-picked JB2A animations for abilities whose translation isn't the best fit */
export const JB_PICKS = {
	ignis: { style: 'spell', cast: 'jb-sign-evocation', projectile: 'jb-fire-bolt', hit: 'jb-explosion-01', element: 'auto' },
	glacies: { style: 'spell', cast: 'jb-sign-abjuration', projectile: 'jb-ray-of-frost', hit: 'jb-frost-impact', element: 'auto' },
	fulgur: { style: 'spell', cast: 'jb-sign-divination', projectile: 'jb-chain-lightning', hit: 'jb-static', element: 'auto' },
	thunderbolt: { style: 'spell', cast: 'jb-sign-divination', projectile: null, hit: 'jb-call-lightning', element: 'auto' },
	flare: { style: 'spell', cast: 'jb-sign-evocation', projectile: 'jb-fireball-beam', hit: 'jb-explosion-fireball', element: 'auto' },
	iceberg: { style: 'spell', cast: 'jb-sign-abjuration', projectile: 'jb-ice-shard', hit: 'jb-ice-spikes', element: 'auto' },
	terra: { style: 'spell', cast: 'jb-sign-transmutation', hit: 'jb-ground-crack-2', element: 'auto' },
	boulder: { style: 'spell', cast: 'jb-sign-transmutation', projectile: 'jb-boulder', hit: 'jb-ground-crack', element: 'auto' },
	ventus: { style: 'spell', cast: 'jb-sign-enchantment', hit: 'jb-gust', element: 'auto' },
	vortex: { style: 'spell', cast: 'jb-sign-enchantment', hit: 'jb-whirlwind', element: 'auto', scale: 1.3 },
	lux: { style: 'spell', cast: 'jb-sacred-cast', projectile: 'jb-guiding-bolt', hit: 'jb-sacred-flame', element: 'auto' },
	umbra: { style: 'spell', cast: 'jb-sign-necromancy', projectile: 'jb-eldritch-blast', hit: 'jb-annihilation', element: 'auto' },
	omega: { style: 'spell', cast: 'jb-sign-necromancy', hit: 'jb-toll', element: 'none', scale: 1.3 },
	volcano: { style: 'spell', cast: 'jb-sign-evocation', hit: 'jb-eruption', element: 'auto', scale: 1.4 },
	comet: { style: 'spell', cast: 'jb-sign-divination', projectile: 'meteor', hit: 'jb-explosion-04', element: 'none', scale: 1.5 },
	heal: { style: 'support', cast: 'jb-sacred-cast', hit: 'jb-cure', element: 'none' },
	'drain-vigor': { style: 'spell', cast: 'jb-sign-necromancy', projectile: 'jb-strands', hit: 'jb-hadar', after: 'jb-heal-green', element: 'none' },
	'drain-spirit': { style: 'spell', cast: 'jb-sign-necromancy', projectile: 'jb-strands', hit: 'jb-hadar', after: 'jb-heal-blue', element: 'none' },
	barrier: { style: 'support', cast: 'jb-sign-abjuration', hit: 'jb-shield', element: 'none' },
	aura: { style: 'support', cast: 'jb-sign-abjuration', hit: 'jb-antilife', element: 'none' },
	breath: { style: 'spell', cast: null, hit: 'jb-breath-fire', element: 'auto' },
};

/** Pick a target effect for an original one, in this element */
function hitFor(id, spec, el, ctx) {
	if (!id) return id;
	if (id.startsWith('jb-')) return id;
	if (spec.style === 'melee' && (SWING.has(id) || BLUNT.has(id) || id.startsWith('slash-'))) return weaponSwing(ctx.item, id);
	if (id === 'pr-breath') return EL_BREATH[el] ?? 'jb-breath-fire';
	if (id === 'pr-jet') return el === 'fire' ? 'jb-breath-fire-line' : el === 'bolt' ? 'jb-breath-lightning' : el === 'poison' || el === 'earth' ? 'jb-breath-acid' : 'jb-water-cone';
	if (id === 'pr-beam') return EL_BEAM[el] ?? 'jb-beam-blue';
	if (id === 'pr-spikes') return el === 'ice' ? 'jb-ice-spikes' : 'jb-ground-crack-2';
	if (id === 'pr-shards') return el === 'ice' ? 'jb-ice-shard' : 'jb-side-ice';
	if (id === 'pr-cloud') return el === 'poison' ? 'jb-darkness-green' : el === 'dark' ? 'jb-darkness' : 'jb-fog';
	if (SWING.has(id)) return EL_HIT[el] ?? 'jb-impact-007';
	if (HIT[id]) return HIT[id];
	// pr-* without a JB2A counterpart keep their drawing
	return id;
}

function castFor(id, el) {
	if (!id) return id;
	if (id.startsWith('jb-')) return id;
	if (id in CAST) return CAST[id];
	if (/^cast-glow-|^charge-/.test(id)) return EL_SIGN[el] ?? 'jb-cast';
	return HIT[id] ?? 'jb-cast';
}

function projectileFor(p, el, ctx) {
	if (!p || p.startsWith?.('jb-') || p === 'meteor') return p;
	const shot = ctx.item && ['weapon', 'customWeapon', 'basic'].includes(ctx.item.type) ? rangedShot(ctx.item, el) : null;
	if (shot) return shot;
	switch (p) {
		case 'orb':
			return EL_BOLT[el] ?? 'jb-shot-yellow';
		case 'beam':
			return EL_BEAM[el] ?? 'jb-beam-blue';
		case 'arrow':
			return el === 'poison' ? 'jb-arrow-poison' : el && !['none', 'physical'].includes(el) ? 'jb-arrow-blue' : 'jb-arrow';
		case 'bullet':
			return 'jb-bullet';
		case 'rock':
			return 'jb-boulder';
	}
	return p;
}

/**
 * The JB2A version of an animation.
 * @param {object} spec the original animation
 * @param {{key?: string, item?: Item, damageType?: string}} ctx
 */
export function toJb(spec, ctx = {}) {
	if (!spec || spec.style === 'none') return spec;
	const pick = ctx.key && JB_PICKS[ctx.key];
	if (pick) return { ...pick };
	const auto = ctx.damageType ?? v(ctx.item?.system?.damageType) ?? v(ctx.item?.system?.rollInfo?.damage?.type) ?? v(ctx.item?.system?.damage?.type);
	let el = spec.element && !['auto', 'none'].includes(spec.element) ? spec.element : auto;
	if (!el || el === 'untyped') el = 'none';
	const out = { ...spec };
	if ('cast' in spec) out.cast = castFor(spec.cast, el);
	if (spec.hit) out.hit = hitFor(spec.hit, spec, el, ctx);
	if (spec.after) out.after = HIT[spec.after] ?? spec.after;
	if (spec.projectile) out.projectile = projectileFor(spec.projectile, el, ctx);
	// a ranged weapon with no projectile in the original still throws its thing in JB2A
	if (spec.style === 'ranged' && !spec.projectile && ctx.item) {
		const shot = rangedShot(ctx.item, el);
		if (shot) out.projectile = shot;
	}
	// JB2A bolts already burst on arrival; keep a plain physical impact small
	if (out.projectile?.startsWith?.('jb-') && ['jb-impact-007', 'jb-impact-008'].includes(out.hit)) out.hit = 'jb-impact-009';
	if (out.cast === null) delete out.cast;
	return out;
}

export { EL_HIT, EL_BIG };

/* ------------------------------------------------------------------ */
/*  Sounds: a JB2A effect sounds like the original effect it replaces   */
/* ------------------------------------------------------------------ */

const SOUND_AS = {
	'jb-greatsword': 'slash-down-2',
	'jb-greataxe': 'slash-down-red-3',
	'jb-handaxe': 'slash-down-red-1',
	'jb-maul': 'px-impact-sym-3',
	'jb-greatclub': 'px-impact-sym-3',
	'jb-dagger': 'slash-up-1',
	'jb-punch': 'px-impact-sym-1',
	'jb-kick': 'px-impact-dir-4',
	'jb-punch-magic': 'px-impact-sym-6',
	'jb-kick-magic': 'px-impact-sym-6',
	'jb-flurry': 'px-impact-dir-4',
	'jb-flurry-magic': 'px-impact-sym-6',
	'jb-flurry-magic-2': 'px-impact-sym-6',
	'jb-lasersword': 'slash-front-2',
	'jb-lasersword-2': 'slash-front-3',
	'jb-claws': 'pr-claw',
	'jb-bite': 'pr-bite',
	'jb-breath-fire': 'pr-breath',
	'jb-breath-fire-line': 'pr-jet',
	'jb-breath-cold': 'pr-breath',
	'jb-breath-lightning': 'pr-beam',
	'jb-breath-acid': 'pr-jet',
	'jb-breath-poison': 'pr-breath',
	'jb-burst-fire': 'pr-breath',
	'jb-burning-hands': 'pr-breath',
	'jb-cone-of-cold': 'pr-breath',
	'jb-lightning-bolt': 'pr-chain-lightning',
	'jb-lightning-narrow': 'pr-chain-lightning',
	'jb-gust': 'slash-wave-2',
	'jb-water-cone': 'pr-jet',
	'jb-cast': 'cast-glow-3',
	'jb-helix-cast': 'cast-glow-5',
	'jb-missile-cast': 'cast-glow-6',
	'jb-smite-cast': 'astral-1',
	'jb-sacred-cast': 'heal-cross-1',
	'jb-energy-gather': 'charge-back',
};
/** JB2A projectile -> the drawn projectile whose launch sound it uses */
const PROJ_AS = {
	'jb-arrow': 'arrow',
	'jb-arrow-blue': 'arrow',
	'jb-arrow-poison': 'arrow',
	'jb-bolt': 'arrow',
	'jb-bullet': 'bullet',
	'jb-bullet-2': 'bullet',
	'jb-bullet-blue': 'bullet',
	'jb-snipe': 'bullet',
	'jb-dagger-throw': 'arrow',
	'jb-card': 'arrow',
	'jb-shield-bash': 'rock',
	'jb-boulder': 'rock',
	'jb-snowball': 'rock',
	'jb-bomb': 'rock',
	'jb-flask': 'rock',
	'jb-cannonball': 'bullet',
	'jb-missile': 'meteor',
};
for (const [orig, jb] of Object.entries(HIT)) if (!(jb in SOUND_AS)) SOUND_AS[jb] = orig;
for (const [orig, jb] of Object.entries(CAST)) if (jb && !(jb in SOUND_AS)) SOUND_AS[jb] = orig;
for (const jb of Object.values(EL_SIGN)) SOUND_AS[jb] ??= 'cast-glow-3';

/** The animation as the sound tables see it: JB2A effects replaced by the originals they stand for */
export function soundView(spec) {
	if (!spec) return spec;
	const out = { ...spec };
	for (const k of ['cast', 'hit', 'after']) {
		if (out[k]?.startsWith?.('jb-')) out[k] = SOUND_AS[out[k]] ?? (k === 'cast' ? 'cast-glow-3' : 'impact-flash-2');
		else if (out[k]?.startsWith?.('sf-')) out[k] = pixelSoundAs(out[k], k);
	}
	if (out.projectile?.startsWith?.('jb-')) out.projectile = PROJ_AS[out.projectile] ?? (/beam|ray|strands|conduit|disintegrate|witch|chain/.test(out.projectile) ? 'beam' : 'orb');
	else if (out.projectile?.startsWith?.('sf-')) out.projectile = pixelSoundAs(out.projectile, 'projectile');
	return out;
}
