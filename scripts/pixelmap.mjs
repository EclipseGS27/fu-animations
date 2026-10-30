import { PIXEL } from './pixelfx.mjs';

/**
 * The Pixel VFX preset: every built-in animation redone with pixel effects (Sprite Fusion's library and the
 * ones drawn for this module in its style). Like the JB2A preset, each original effect gets a pixel counterpart
 * for its role (on the user, on the target, flying across), recolored by element; a few signature spells are
 * hand-picked. Pixel effects need no asset packs: everything is drawn in code.
 */

const v = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);

/* ------------------------------------------------------------------ */
/*  Original effect -> pixel effect, as the effect on a target         */
/* ------------------------------------------------------------------ */

const HIT = {
	// buffs
	barrier: 'sf-shield',
	'shield-hex': 'sf-shield',
	'buff-sparks-1': 'sf-power-up',
	'buff-sparks-2': 'sf-power-up',
	'buff-sparks-3': 'sf-power-up',
	'star-up': 'sf-sparkle',
	// bursts
	'px-bubble-burst': 'sf-bubbles',
	'px-coin-burst': 'sf-coins',
	'px-firework-1': 'sf-firework',
	'px-firework-2': 'sf-firework',
	'px-heart-burst': 'sf-heart',
	'px-light-burst': 'sf-smite',
	'px-music-1': 'sf-notes',
	'px-music-2': 'sf-notes',
	'px-sparkle-burst-1': 'sf-sparkle',
	'px-sparkle-burst-2': 'sf-sparkle',
	'px-sparkle-burst-3': 'sf-twinkle',
	// explosions
	'px-explosion-epic-1': 'sf-explosion-big',
	'px-explosion-epic-2': 'sf-explosion-big',
	'px-explosion-stylized-1': 'sf-explosion',
	'px-explosion-stylized-2': 'sf-explosion',
	'px-explosion-stylized-3': 'sf-explosion',
	'px-explosion-sym-1': 'sf-explosion',
	'px-explosion-sym-2': 'sf-explosion-small',
	'px-explosion-sym-4': 'sf-explosion',
	// fire
	'px-fire-loop-3a': 'sf-burn',
	'px-fire-loop-3b': 'sf-burn',
	'px-fire-loop-4a': 'sf-burn',
	'px-fire-loop-4b': 'sf-burn',
	// healing
	'heal-cross-1': 'sf-heal-burst',
	'heal-cross-2': 'sf-heal-burst',
	'heal-cross-3': 'sf-heal-burst',
	'heal-long-1': 'sf-heal',
	'heal-long-2': 'sf-heal',
	'heal-long-3': 'sf-heal',
	'heal-puff-1': 'sf-heal-burst',
	'heal-puff-2': 'sf-heal-burst',
	'heal-puff-3': 'sf-heal-burst',
	'heal-quick-1': 'sf-mana',
	'heal-quick-2': 'sf-heal',
	'heal-quick-3': 'sf-heal-burst',
	'heal-quick-4': 'sf-mana',
	'heal-quick-5': 'sf-heal',
	'heal-quick-6': 'sf-heal-burst',
	// hits
	'arrow-hit-1': 'sf-impact',
	'beam-hit-2': 'sf-impact',
	'beam-hit-4': 'sf-impact-heavy',
	'bolt-hit-1': 'sf-impact',
	'bolt-hit-2': 'sf-impact',
	'dualbolt-hit-1': 'sf-impact-heavy',
	'impact-flash-1': 'sf-impact',
	'impact-flash-2': 'sf-impact',
	'impact-flash-3': 'sf-impact-heavy',
	'px-impact-dir-1': 'sf-spark',
	'px-impact-dir-2': 'sf-impact',
	'px-impact-dir-3': 'sf-spark',
	'px-impact-dir-4': 'sf-impact',
	'px-impact-sym-1': 'sf-impact',
	'px-impact-sym-2': 'sf-ice-crystals',
	'px-impact-sym-3': 'sf-impact-heavy',
	'px-impact-sym-4': 'sf-impact-heavy',
	'px-impact-sym-6': 'sf-impact',
	// lightning
	'px-lightning-aura': 'sf-electrified',
	'px-lightning-burst-1': 'sf-zap',
	'px-lightning-burst-2': 'sf-zap',
	'px-lightning-burst-3': 'sf-zap',
	'px-lightning-strike': 'sf-lightning',
	// magic used as a hit
	'astral-1': 'sf-sparkle',
	'astral-2': 'sf-sparkle',
	'astral-3': 'sf-glyph',
	'cast-glow-1': 'sf-twinkle',
	'cast-glow-2': 'sf-twinkle',
	'cast-glow-3': 'sf-twinkle',
	'cast-glow-4': 'sf-twinkle',
	'cast-glow-5': 'sf-twinkle',
	'cast-glow-6': 'sf-orb',
	'cast-glow-7': 'sf-twinkle',
	'charge-back': 'sf-charge',
	'charge-blaze-1': 'sf-burn',
	'charge-blaze-2': 'sf-burn',
	'charge-flame-1': 'sf-burn',
	'charge-flame-2': 'sf-charge',
	'charge-flame-3': 'sf-charge',
	'charge-flame-4': 'sf-charge',
	'star-magic-1': 'sf-sparkle',
	'star-magic-2': 'sf-sparkle',
	'star-magic-3': 'sf-twinkle',
	'time-magic-1': 'sf-glyph',
	'time-magic-2': 'sf-glyph',
	'time-magic-3': 'sf-glyph',
	// smoke
	'px-skull-smoke': 'sf-death',
	'px-smoke-dir': 'sf-smoke',
	'px-smoke-loop-1': 'sf-smoke',
	'px-smoke-loop-2': 'sf-fog',
	'px-smoke-ring': 'sf-quake',
	// splatters
	'px-splatter-burst-1': 'sf-blood',
	'px-splatter-burst-3': 'sf-blood',
	'px-splatter-dir-1': 'sf-blood',
	'px-splatter-dir-3': 'sf-blood',
	// status
	'px-absorb': 'sf-charge',
	'px-attack-up': 'sf-attack-up',
	'px-death': 'sf-death',
	'px-defense-up': 'sf-defense-up',
	'px-haste': 'sf-power-up',
	'px-heal-heart': 'sf-heart',
	'px-poison-bubbles': 'sf-poisoned',
	'px-poison-cloud': 'sf-poison-cloud',
	'px-sparkles': 'sf-sparkle',
	// strikes
	'slash-down-1': 'sf-slash',
	'slash-down-2': 'sf-slash',
	'slash-down-3': 'sf-slash',
	'slash-down-circ-1': 'sf-slash-combo',
	'slash-down-circ-2': 'sf-slash-combo',
	'slash-down-circ-3': 'sf-slash-x',
	'slash-down-red-1': 'sf-slash-heavy',
	'slash-down-red-2': 'sf-slash-heavy',
	'slash-down-red-3': 'sf-slash-heavy',
	'slash-front-1': 'sf-thrust',
	'slash-front-2': 'sf-thrust',
	'slash-front-3': 'sf-thrust',
	'slash-up-1': 'sf-slash-up',
	'slash-up-2': 'sf-slash-up',
	'slash-up-3': 'sf-slash-up',
	'slash-up-arch-1': 'sf-slash-up',
	'slash-up-arch-2': 'sf-slash-up',
	'slash-up-arch-3': 'sf-slash-up',
	'slash-up-circ-1': 'sf-slash-combo',
	'slash-up-circ-2': 'sf-slash-combo',
	'slash-up-circ-3': 'sf-slash-x',
	'slash-wave-1': 'sf-slash-wide',
	'slash-wave-2': 'sf-slash-wide',
	'slash-wave-3': 'sf-tornado',
	// symbols
	'px-sym-alert-1': 'sf-sym-alert',
	'px-sym-alert-2': 'sf-sym-alert',
	'px-sym-warning': 'sf-sym-alert',
	'px-sym-attack-up': 'sf-attack-up',
	'px-sym-crown': 'sf-sym-crown',
	'px-sym-defense-up': 'sf-defense-up',
	'px-sym-failure': 'sf-sym-cross',
	'px-sym-lightbulb': 'sf-sym-bulb',
	'px-sym-magic-up': 'sf-magic-up',
	'px-sym-question': 'sf-sym-question',
	'px-sym-success': 'sf-sym-check',
	'px-sym-thumbs-down': 'sf-curse',
	'px-sym-thumbs-up': 'sf-sym-up',
	// tech
	'px-charge-up': 'sf-charge',
	'px-muzzle-1': 'sf-muzzle',
	'px-muzzle-3': 'sf-muzzle',
	'px-spark-burst': 'sf-spark',
	'px-warp-1': 'sf-blink',
	'px-warp-2': 'sf-blink',
	'px-warp-3': 'sf-blink',
	// custom (code-drawn) effects
	'pr-claw': 'sf-claw',
	'pr-bite': 'sf-bite',
	'pr-sweep': 'sf-slash-wide',
	'pr-stomp': 'sf-quake',
	'pr-breath': 'sf-breath',
	'pr-jet': 'sf-jet',
	'pr-beam': 'sf-beam',
	'pr-gaze': 'sf-gaze',
	'pr-shockwave': 'sf-shockwave',
	'pr-soundwave': 'sf-soundwave',
	'pr-tornado': 'sf-tornado',
	'pr-rain': 'sf-rain',
	'pr-meteors': 'sf-meteors',
	'pr-spikes': 'sf-rock-spikes',
	'pr-shards': 'sf-shards',
	'pr-swarm': 'sf-swarm',
	'pr-vines': 'sf-vines',
	'pr-web': 'sf-web',
	'pr-chains': 'sf-chains',
	'pr-void': 'sf-black-hole',
	'pr-cloud': 'sf-poison-cloud',
	'pr-volley': 'sf-volley',
	'pr-missiles': 'sf-missiles',
	'pr-zzz': 'sf-zzz',
	'pr-dizzy': 'sf-dizzy',
	'pr-petals': 'sf-petals',
	'pr-tether': 'sf-tether',
	'pr-glyph': 'sf-glyph',
	'pr-cards': 'sf-cards',
	'pr-steal': 'sf-steal',
	'pr-laugh': 'sf-laugh',
	'pr-pillar': 'sf-pillar',
	'pr-chain-lightning': 'sf-arc',
	'pr-wisps': 'sf-wisps',
};

/** Plain hits that say nothing about the element: a spell of an element lands as that element instead */
const PLAIN = new Set(['impact-flash-1', 'impact-flash-2', 'px-impact-sym-1', 'px-impact-sym-6', 'bolt-hit-1', 'bolt-hit-2', 'beam-hit-2']);
const EL_HIT = {
	fire: 'sf-explosion-small',
	ice: 'sf-ice-crystals',
	bolt: 'sf-zap',
	air: 'sf-tornado',
	earth: 'sf-quake',
	light: 'sf-smite',
	dark: 'sf-black-hole',
	poison: 'sf-poison-cloud',
};

/* ------------------------------------------------------------------ */
/*  Original effect -> pixel effect, as the effect on the user first   */
/* ------------------------------------------------------------------ */

const CAST = {
	'heal-cross-1': 'sf-twinkle',
	'heal-cross-2': 'sf-twinkle',
	'heal-cross-3': 'sf-twinkle',
	'heal-puff-1': 'sf-twinkle',
	'heal-long-2': 'sf-twinkle',
	'buff-sparks-1': 'sf-sparkle',
	'buff-sparks-2': 'sf-sparkle',
	'buff-sparks-3': 'sf-sparkle',
	'charge-back': 'sf-charge',
	'charge-flame-2': 'sf-charge',
	'charge-flame-3': 'sf-charge',
	'charge-flame-4': 'sf-charge',
	'px-charge-up': 'sf-charge',
	'charge-blaze-1': 'sf-burn',
	'charge-blaze-2': 'sf-burn',
	'charge-flame-1': 'sf-burn',
	'px-coin-burst': 'sf-coins',
	'px-muzzle-1': 'sf-muzzle',
	'px-muzzle-3': 'sf-muzzle',
	'px-sym-attack-up': 'sf-attack-up',
	'px-music-1': 'sf-notes',
	'pr-shockwave': 'sf-shockwave',
};
/** Spell circles: every cast-glow, astral, star and time effect becomes a rune circle in the element's color */
const CIRCLE = /^(cast-glow-|astral-|star-magic-|time-magic-)/;

/* ------------------------------------------------------------------ */
/*  Projectiles                                                        */
/* ------------------------------------------------------------------ */

const PROJECTILE = { orb: 'sf-bolt', arrow: 'sf-arrow', bullet: 'sf-bullet', beam: 'sf-beam', rock: 'sf-rock', meteor: 'sf-meteor' };

/** Hand-picked pixel animations for the signature spells */
export const PIXEL_PICKS = {
	ignis: { style: 'spell', cast: 'sf-glyph', projectile: 'sf-bolt', hit: 'sf-explosion', element: 'auto' },
	glacies: { style: 'spell', cast: 'sf-glyph', projectile: 'sf-shards', hit: 'sf-ice-crystals', element: 'auto' },
	fulgur: { style: 'spell', cast: 'sf-glyph', projectile: 'sf-arc', hit: 'sf-zap', element: 'auto' },
	thunderbolt: { style: 'spell', cast: 'sf-glyph', hit: 'sf-lightning', element: 'auto' },
	flare: { style: 'spell', cast: 'sf-charge', projectile: 'sf-beam', hit: 'sf-explosion-big', element: 'auto' },
	iceberg: { style: 'spell', cast: 'sf-glyph', hit: 'sf-ice-nova', element: 'auto', scale: 1.3 },
	terra: { style: 'spell', cast: 'sf-glyph', hit: 'sf-rock-spikes', element: 'auto' },
	boulder: { style: 'spell', cast: 'sf-glyph', projectile: 'sf-rock', hit: 'sf-quake', element: 'auto', scale: 1.2 },
	ventus: { style: 'spell', cast: 'sf-glyph', hit: 'sf-tornado', element: 'auto' },
	vortex: { style: 'spell', cast: 'sf-glyph', hit: 'sf-tornado', element: 'auto', scale: 1.4 },
	lux: { style: 'spell', cast: 'sf-glyph', projectile: 'sf-bolt', hit: 'sf-smite', element: 'auto' },
	umbra: { style: 'spell', cast: 'sf-glyph', projectile: 'sf-bolt', hit: 'sf-black-hole', element: 'auto' },
	omega: { style: 'spell', cast: 'sf-glyph', hit: 'sf-black-hole', after: null, element: 'dark', scale: 1.4 },
	volcano: { style: 'spell', cast: 'sf-charge', hit: 'sf-explosion-big', element: 'auto', scale: 1.4 },
	comet: { style: 'spell', cast: 'sf-glyph', projectile: 'sf-meteor', hit: 'sf-shockwave', element: 'none', scale: 1.4 },
	heal: { style: 'support', cast: 'sf-twinkle', hit: 'sf-heal', element: 'none' },
	'drain-vigor': { style: 'spell', cast: 'sf-glyph', hit: 'sf-tether', after: 'sf-heal', element: 'dark' },
	'drain-spirit': { style: 'spell', cast: 'sf-glyph', hit: 'sf-tether', after: 'sf-mana', element: 'none', afterElement: 'ice' },
	barrier: { style: 'support', cast: 'sf-glyph', hit: 'sf-shield', element: 'none' },
	aura: { style: 'support', cast: 'sf-glyph', hit: 'sf-shield', element: 'none' },
	breath: { style: 'spell', hit: 'sf-breath', element: 'auto' },
};

function hitFor(id, spec, el) {
	if (!id || id.startsWith('sf-') || id.startsWith('jb-')) return id;
	if (PLAIN.has(id) && spec.style !== 'melee' && EL_HIT[el]) return EL_HIT[el];
	return HIT[id] ?? id;
}

function castFor(id) {
	if (!id || id.startsWith('sf-') || id.startsWith('jb-')) return id;
	if (id in CAST) return CAST[id];
	if (CIRCLE.test(id)) return 'sf-glyph';
	return HIT[id] ?? 'sf-glyph';
}

/**
 * The pixel version of an animation.
 * @param {object} spec the original animation
 * @param {{key?: string, item?: Item, damageType?: string}} ctx
 */
export function toPixel(spec, ctx = {}) {
	if (!spec || spec.style === 'none') return spec;
	const pick = ctx.key && PIXEL_PICKS[ctx.key];
	if (pick) {
		const out = { ...pick };
		for (const k of ['after', 'afterElement']) if (out[k] == null) delete out[k];
		return out;
	}
	const auto = ctx.damageType ?? v(ctx.item?.system?.damageType) ?? v(ctx.item?.system?.rollInfo?.damage?.type) ?? v(ctx.item?.system?.damage?.type);
	let el = spec.element && !['auto', 'none'].includes(spec.element) ? spec.element : auto;
	if (!el || el === 'untyped') el = 'none';
	const out = { ...spec };
	if (spec.cast) out.cast = castFor(spec.cast);
	if (spec.hit) out.hit = hitFor(spec.hit, spec, el);
	if (spec.after) out.after = HIT[spec.after] ?? spec.after;
	if (spec.projectile) out.projectile = PROJECTILE[spec.projectile] ?? spec.projectile;
	// a bullet already flashes at the muzzle
	if (out.projectile === 'sf-bullet' && out.cast === 'sf-muzzle') delete out.cast;
	// a weapon with a muzzle flash and no bullet still fires one
	if (spec.style === 'ranged' && !out.projectile && out.cast === 'sf-muzzle') {
		out.projectile = 'sf-bullet';
		delete out.cast;
	}
	// effects that already fly to the target don't need a projectile on top
	if (out.projectile && PIXEL[out.hit]?.line) delete out.projectile;
	return out;
}

/** The critical-hit flash in this preset */
export const PIXEL_CRIT = 'sf-impact-heavy';

/* ------------------------------------------------------------------ */
/*  Sounds: a pixel effect sounds like the original effect it stands for */
/* ------------------------------------------------------------------ */

export function pixelSoundAs(id, role) {
	const def = PIXEL[id];
	if (!def) return role === 'cast' ? 'cast-glow-3' : 'impact-flash-2';
	if (role === 'projectile') return def.proj ?? (/beam|arc|tether|breath|jet|soundwave/.test(id) ? 'beam' : 'orb');
	if (role === 'cast' && id === 'sf-glyph') return 'cast-glow-3';
	return def.as;
}
