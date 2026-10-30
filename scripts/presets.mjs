import { ABILITIES } from './abilities.mjs';
import { BESTIARY } from './bestiary.mjs';
import { FX } from './library.mjs';
import { PROC } from './procedural.mjs';
import { specFromName } from './keywords.mjs';
import { JBFX, jbAvailable } from './jbcore.mjs';
import { toJb } from './jbmap.mjs';
import { PIXEL, PIXEL_PROJECTILES } from './pixelfx.mjs';
import { toPixel } from './pixelmap.mjs';

export const MODULE_ID = 'fu-animations';

export const STYLES = {
	melee: 'Melee: dash to the target and strike',
	ranged: 'Ranged: shoot from where you stand',
	spell: 'Spell: cast, then hit the targets',
	support: 'Support: cast on allies',
	self: 'Self: effect on the user only',
	none: 'No animation',
};

export const PROJECTILES = { '': 'None', orb: 'Magic orb', arrow: 'Arrow', bullet: 'Bullet', beam: 'Beam', rock: 'Boulder', meteor: 'Meteor from the sky' };

export const PRESETS = { original: 'Original', pixel: 'Pixel VFX (drawn in code)', jb2a: 'JB2A (free)' };

/** The preset in use: JB2A only when the world chose it and the JB2A module is on */
export function activePreset() {
	const p = getSetting('preset');
	if (p === 'pixel') return 'pixel';
	return p === 'jb2a' && jbAvailable() ? 'jb2a' : 'original';
}

export const ELEMENTS = {
	auto: 'From damage type',
	none: 'Original colors',
	physical: 'Physical',
	fire: 'Fire',
	ice: 'Ice',
	bolt: 'Bolt',
	air: 'Air',
	earth: 'Earth',
	light: 'Light',
	dark: 'Dark',
	poison: 'Poison',
};

/** Hue (degrees) each element recolors to, and a color for tinting white effects and drawing projectiles */
const BASE_LOOK = {
	physical: { hue: null, color: 0xf2e6c9 },
	fire: { hue: 14, color: 0xff7a3d },
	ice: { hue: 198, color: 0x8fd8ff },
	bolt: { hue: 52, color: 0xffe14d },
	air: { hue: 150, color: 0x9ff0c9 },
	earth: { hue: 32, color: 0xc49a5a, sat: -0.35 },
	light: { hue: 48, color: 0xfff6c9, sat: -0.55, bright: 1.2 },
	dark: { hue: 272, color: 0x9b6bff },
	poison: { hue: 96, color: 0xb4e05a },
	none: { hue: null, color: 0xffd9a0 },
};

/* ------------------------------------------------------------------ */
/*  Custom colors: any #rrggbb works where an element name does         */
/* ------------------------------------------------------------------ */

export const isHexColor = (s) => /^#[0-9a-f]{6}$/i.test(String(s ?? ''));

/** "#ff2a6d" -> {h: degrees, s: 0..1, l: 0..1} */
export function hexHsl(hexStr) {
	const n = parseInt(String(hexStr).slice(1), 16);
	const r = ((n >> 16) & 255) / 255;
	const g = ((n >> 8) & 255) / 255;
	const b = (n & 255) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	const d = max - min;
	if (!d) return { h: 0, s: 0, l };
	const s = d / (1 - Math.abs(2 * l - 1));
	let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	h = (h * 60 + 360) % 360;
	return { h, s, l };
}

/** The recolor for a custom color: rotate colored effects to its hue, match its saturation and lightness, tint white ones */
function hexLook(hexStr) {
	const { h, s, l } = hexHsl(hexStr);
	const look = { hue: s < 0.12 ? null : Math.round(h), color: parseInt(hexStr.slice(1), 16) };
	if (s < 0.6) look.sat = Math.max(-0.95, (s - 0.6) * 1.6);
	if (l > 0.7) look.bright = 1 + (l - 0.7) * 0.8;
	else if (l < 0.3) look.bright = 0.55 + l * 1.5;
	return look;
}

const hexLooks = new Map();
/**
 * Element looks by name, and custom colors by their hex code ("#ff2a6d"), computed on first use. A proxy so every
 * place that recolors by element (sprite effects, JB2A videos, drawn effects, impact colors) takes custom colors too.
 */
export const ELEMENT_LOOK = new Proxy(BASE_LOOK, {
	get(target, key) {
		if (typeof key === 'string' && isHexColor(key)) {
			const k = key.toLowerCase();
			if (!hexLooks.has(k)) hexLooks.set(k, hexLook(k));
			return hexLooks.get(k);
		}
		return target[key];
	},
});

const ELEMENT_HIT = {
	physical: 'px-impact-sym-1',
	fire: 'px-explosion-sym-1',
	ice: 'px-impact-sym-2',
	bolt: 'px-lightning-burst-1',
	air: 'slash-wave-3',
	earth: 'px-smoke-ring',
	light: 'px-light-burst',
	dark: 'px-explosion-stylized-2',
	poison: 'px-poison-cloud',
	untyped: 'impact-flash-2',
};

const MELEE_BY_ELEMENT = {
	physical: ['slash-down-red-1', 'slash-down-circ-1', 'px-impact-sym-1'],
	fire: ['px-fire-loop-3a'],
	ice: ['px-impact-sym-2'],
	bolt: ['px-lightning-burst-1'],
	air: ['slash-wave-2'],
	earth: ['px-impact-sym-3'],
	light: ['px-light-burst'],
	dark: ['slash-down-red-3'],
	poison: ['px-poison-bubbles'],
	untyped: ['impact-flash-2'],
};

const WEAPON_POOLS = {
	sword: ['slash-down-circ-2', 'slash-up-arch-2', 'slash-down-2', 'slash-up-circ-2', 'slash-down-red-2'],
	dagger: ['slash-up-1', 'slash-down-1', 'slash-up-arch-1'],
	spear: ['slash-front-2', 'slash-front-3'],
	heavy: ['slash-down-red-3', 'slash-down-circ-3'],
	brawling: ['px-impact-sym-1', 'px-impact-dir-4', 'impact-flash-2'],
	flail: ['slash-wave-2', 'slash-wave-3'],
	arcane: ['cast-glow-6'],
};

const v = (x) => (x && typeof x === 'object' && 'value' in x ? x.value : x);

function hash(str) {
	let h = 2166136261;
	for (const ch of String(str ?? '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
	return h;
}
const pick = (list, seed) => list[hash(seed) % list.length];

export function fuidOf(item) {
	return item?.system?.fuid || '';
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[\u2018\u2019]/g, "'").trim();
const NAME_INDEX = new Map(Object.entries(ABILITIES).map(([fuid, a]) => [`${a.type}:${norm(a.name)}`, fuid]));
const NO_BESTIARY = new Set(['weapon', 'customWeapon', 'shield', 'armor', 'accessory', 'consumable']);

/**
 * Which table entry an item is: its Fabula Ultima ID when the compendium has it, else a compendium ability
 * with the same name and type, else a bestiary attack or spell with the same name ("bst:melee:claw").
 */
export function abilityKey(item) {
	if (!item) return null;
	const fuid = fuidOf(item);
	if (fuid && ABILITIES[fuid]) return fuid;
	const n = norm(item.name);
	const byName = NAME_INDEX.get(`${item.type}:${n}`);
	if (byName) return byName;
	if (!NO_BESTIARY.has(item.type)) {
		const kinds = item.type === 'basic' ? [v(item.system?.type) === 'ranged' ? 'ranged' : 'melee', 'melee', 'ranged'] : item.type === 'spell' ? ['spell'] : ['spell', 'melee', 'ranged'];
		for (const k of kinds) if (BESTIARY[`${k}:${n}`]) return `bst:${k}:${n}`;
	}
	return fuid || null;
}

/* ------------------------------------------------------------------ */
/*  Weapon categories: one world-wide animation per kind of weapon      */
/* ------------------------------------------------------------------ */

/** Project FU's weapon categories, plus shields, as the editor and the list name them */
export const WEAPON_CATEGORIES = { arcane: 'Arcane', bow: 'Bow', brawling: 'Brawling', dagger: 'Dagger', firearm: 'Firearm', flail: 'Flail', heavy: 'Heavy', spear: 'Spear', sword: 'Sword', thrown: 'Thrown', shield: 'Shield' };
/** [list name, one of them] for each category */
const WEAPON_WORDS = { arcane: ['Arcane weapons', 'arcane weapon'], bow: ['Bows', 'bow'], brawling: ['Brawling weapons', 'brawling weapon'], dagger: ['Daggers', 'dagger'], firearm: ['Firearms', 'firearm'], flail: ['Flails', 'flail'], heavy: ['Heavy weapons', 'heavy weapon'], spear: ['Spears', 'spear'], sword: ['Swords', 'sword'], thrown: ['Thrown weapons', 'thrown weapon'], shield: ['Shields', 'shield'] };
/** "sword" for "wpn:sword" */
export const weaponOne = (key) => WEAPON_WORDS[String(key ?? '').slice(4)]?.[1] ?? 'weapon';
const RANGED_CATS = new Set(['bow', 'firearm', 'thrown']);

/** A stand-in weapon of a category, so each preset picks that category's look (JB2A swings by category) */
function sampleWeapon(cat) {
	return { type: cat === 'shield' ? 'shield' : 'weapon', name: '', system: { category: { value: cat === 'shield' ? 'brawling' : cat }, type: { value: RANGED_CATS.has(cat) ? 'ranged' : 'melee' } } };
}

/** "wpn:sword" for a sword, "wpn:shield" for a shield: the world entry every weapon of that kind falls back to */
export function weaponKey(item) {
	if (!item || !['weapon', 'customWeapon', 'shield'].includes(item.type)) return null;
	if (item.type === 'shield') return 'wpn:shield';
	const cat = v(item.system?.category);
	return cat && WEAPON_CATEGORIES[cat] ? `wpn:${cat}` : null;
}

/** Built-in animation for a table key */
export function defaultFor(key) {
	if (!key) return null;
	if (key.startsWith('bst:')) return BESTIARY[key.slice(4)]?.spec ?? null;
	if (key.startsWith('wpn:')) return WEAPON_CATEGORIES[key.slice(4)] ? weaponSpec(sampleWeapon(key.slice(4))) : null;
	return ABILITIES[key]?.spec ?? null;
}

/** Name and group of a table key, for the editor and the list */
export function entryFor(key) {
	if (!key) return null;
	if (key.startsWith('bst:')) {
		const b = BESTIARY[key.slice(4)];
		return b ? { name: b.name, group: `Bestiary: ${b.book}` } : null;
	}
	if (key.startsWith('wpn:')) {
		const words = WEAPON_WORDS[key.slice(4)];
		return words ? { name: words[0], group: 'Weapons' } : null;
	}
	const a = ABILITIES[key];
	return a ? { name: a.name, group: a.group } : null;
}

/** The item's own damage type, when it has one */
export function itemDamageType(item) {
	const s = item?.system ?? {};
	return v(s.damageType) ?? v(s.rollInfo?.damage?.type) ?? v(s.damage?.type) ?? v(s.damage?.type?.value) ?? null;
}

function weaponSpec(item) {
	const s = item.system ?? {};
	const cat = v(s.category) ?? 'sword';
	const ranged = v(s.type) === 'ranged' || ['bow', 'firearm', 'thrown'].includes(cat);
	const name = item.name ?? '';
	if (ranged) {
		if (cat === 'firearm') return { style: 'ranged', cast: 'px-muzzle-1', projectile: 'bullet', hit: 'px-spark-burst', element: 'auto' };
		if (cat === 'bow') return { style: 'ranged', projectile: 'arrow', hit: 'arrow-hit-1', element: 'auto' };
		if (cat === 'arcane') return { style: 'ranged', cast: 'cast-glow-3', projectile: 'orb', hit: 'px-impact-sym-6', element: 'auto' };
		return { style: 'ranged', projectile: 'arrow', hit: 'px-impact-dir-1', element: 'auto' };
	}
	if (cat === 'heavy' && /hammer|mace|maul|club/i.test(name)) return { style: 'melee', hit: 'px-impact-sym-3', element: 'auto' };
	return { style: 'melee', hit: pick(WEAPON_POOLS[cat] ?? WEAPON_POOLS.sword, name), element: 'auto' };
}

function basicSpec(item) {
	const ranged = v(item.system?.type) === 'ranged';
	const el = v(item.system?.damageType) ?? 'physical';
	if (ranged) return { style: 'ranged', projectile: el === 'physical' ? 'arrow' : 'orb', hit: ELEMENT_HIT[el] ?? ELEMENT_HIT.physical, element: 'auto' };
	return { style: 'melee', hit: pick(MELEE_BY_ELEMENT[el] ?? MELEE_BY_ELEMENT.physical, item.name), element: 'auto' };
}

/**
 * Best guess for anything not in the compendium table (homebrew skills, NPC abilities, custom spells)
 * @param {{offensive?:boolean, hasTargets?:boolean, damageType?:string}} ctx
 */
export function fallbackSpec(item, ctx = {}) {
	if (!item) return { style: 'none' };
	switch (item.type) {
		case 'weapon':
		case 'customWeapon':
		case 'shield':
			return weaponSpec(item);
		case 'basic':
			return specFromName(v(item.system?.type) === 'ranged' ? 'ranged' : 'melee', item.name, v(item.system?.damageType)) ?? basicSpec(item);
		case 'spell': {
			const named = specFromName('spell', item.name, ctx.damageType ?? itemDamageType(item));
			if (named) return named;
			const offensive = v(item.system?.isOffensive) || ctx.offensive;
			const el = ctx.damageType ?? itemDamageType(item);
			if (offensive) return { style: 'spell', cast: 'cast-glow-3', hit: ELEMENT_HIT[el] ?? 'px-impact-sym-1', element: 'auto' };
			if (/heal|cure|recover|regen|life/i.test(item.name)) return { style: 'support', cast: 'heal-cross-1', hit: 'heal-long-1', element: 'none' };
			return { style: 'support', cast: 'cast-glow-1', hit: 'buff-sparks-2', element: 'none' };
		}
		case 'consumable':
			return ctx.hasTargets ? { style: 'support', hit: 'heal-puff-1', element: 'none' } : { style: 'self', hit: 'heal-puff-1', element: 'none' };
		default: {
			const named = specFromName('any', item.name, ctx.damageType ?? itemDamageType(item));
			if (named) return named;
			if (ctx.hasTargets && (ctx.offensive || ctx.damageType)) return { style: 'spell', cast: null, hit: ELEMENT_HIT[ctx.damageType] ?? 'px-impact-sym-1', element: 'auto' };
			if (ctx.hasTargets) return { style: 'support', cast: null, hit: 'star-magic-3', element: 'none' };
			return { style: 'self', hit: 'buff-sparks-1', element: 'none' };
		}
	}
}

export function getSetting(key) {
	try {
		return game.settings.get(MODULE_ID, key);
	} catch {
		return undefined;
	}
}

export function worldOverrides() {
	return getSetting('overrides') ?? {};
}

/**
 * Where an item's animation comes from, in priority order:
 * the item's own choice, the world's choice for that ability, the built-in table, then a guess from the item.
 * @returns {{spec: object, source: 'item'|'world'|'default'|'guess'}}
 */
export function resolveSpec(item, ctx = {}) {
	const own = item?.getFlag?.(MODULE_ID, 'spec');
	if (own?.style) return { spec: own, source: 'item' };
	const key = abilityKey(item);
	const world = key ? worldOverrides()[key] : null;
	if (world?.style) return { spec: world, source: 'world' };
	const wk = weaponKey(item);
	const kind = wk ? worldOverrides()[wk] : null;
	if (kind?.style) return { spec: kind, source: 'category' };
	const def = presetFor(key, { item, damageType: ctx.damageType });
	if (def) return { spec: def, source: 'default' };
	return { spec: inPreset(fallbackSpec(item, ctx), { item, damageType: ctx.damageType }), source: 'guess' };
}

/** An original animation as the active preset plays it */
export function inPreset(spec, ctx = {}) {
	const p = activePreset();
	if (p === 'jb2a') return toJb(spec, ctx);
	if (p === 'pixel') return toPixel(spec, ctx);
	return spec;
}

/** The built-in animation for a table key in the active preset */
export function presetFor(key, ctx = {}) {
	const def = defaultFor(key);
	if (!def) return null;
	const item = ctx.item ?? (key?.startsWith('wpn:') ? sampleWeapon(key.slice(4)) : undefined);
	return inPreset(def, { ...ctx, item, key });
}

/** The table entry (or a guess) without any overrides, for "reset" */
export function defaultSpec(item, ctx = {}) {
	const key = abilityKey(item);
	return presetFor(key, { item, damageType: ctx.damageType }) || inPreset(fallbackSpec(item, ctx), { item, damageType: ctx.damageType });
}

export function fxLabel(id) {
	return id ? (FX[id]?.label ?? PROC[id]?.label ?? PIXEL[id]?.label ?? JBFX[id]?.label ?? id) : '';
}

export function describe(spec) {
	if (!spec || spec.style === 'none') return 'No animation';
	const parts = [spec.style[0].toUpperCase() + spec.style.slice(1)];
	if (spec.cast) parts.push(`${fxLabel(spec.cast)} on user`);
	if (spec.projectile) parts.push(PROJECTILES[spec.projectile]?.toLowerCase() ?? fxLabel(spec.projectile).toLowerCase());
	if (spec.hit) parts.push(`${fxLabel(spec.hit)}${spec.style === 'self' ? '' : ' on target'}`);
	if (spec.after) parts.push(`${fxLabel(spec.after)} back`);
	if (spec.element && !['auto', 'none'].includes(spec.element)) parts.push(isHexColor(spec.element) ? `color ${spec.element}` : spec.element);
	if (spec.impact?.power) parts.push(`${spec.impact.power} impact`);
	if (spec.impact?.cutin === 'on') parts.push('cut-in');
	if (spec.castSound === 'none' && spec.hitSound === 'none') parts.push('silent');
	else if (spec.castSound || spec.hitSound) parts.push('custom sound');
	return parts.filter(Boolean).join(' · ');
}

/** Effect ids grouped for <select> menus */
export function fxGroups() {
	const groups = {};
	for (const [id, f] of Object.entries(FX)) (groups[f.cat] ??= []).push([id, f.label]);
	groups.Custom = Object.entries(PROC).map(([id, p]) => [id, p.label]);
	for (const g of Object.values(groups)) g.sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
	const out = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
	// pixel effects are drawn in code, so they can be picked in any preset
	const px = {};
	for (const [id, f] of Object.entries(PIXEL)) (px[f.cat] ??= []).push([id, f.label]);
	for (const g of Object.values(px)) g.sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
	const pxGroups = Object.entries(px).sort((a, b) => a[0].localeCompare(b[0]));
	if (activePreset() === 'pixel') out.unshift(...pxGroups);
	else out.push(...pxGroups);
	// JB2A effects can be picked in any preset, when the module is installed
	if (jbAvailable()) {
		const jb = {};
		for (const [id, f] of Object.entries(JBFX)) (jb[f.cat] ??= []).push([id, f.label]);
		for (const g of Object.values(jb)) g.sort((a, b) => a[1].localeCompare(b[1], undefined, { numeric: true }));
		out.unshift(...Object.entries(jb).sort((a, b) => a[0].localeCompare(b[0])));
	}
	return out;
}

/** Projectile choices: the drawn ones, plus every JB2A bolt, beam and thrown weapon */
export function projectileGroups() {
	const groups = [['Drawn', Object.entries(PROJECTILES).filter(([k]) => k)], ['Pixel', [...PIXEL_PROJECTILES].sort((a, b) => a[1].localeCompare(b[1]))]];
	if (jbAvailable()) {
		const jb = {};
		for (const [id, f] of Object.entries(JBFX)) if (f.mode === 'stretch') (jb[f.cat] ??= []).push([id, f.label]);
		for (const [cat, list] of Object.entries(jb)) groups.push([cat, list.sort((a, b) => a[1].localeCompare(b[1]))]);
	}
	return groups;
}

export { ABILITIES, BESTIARY, FX };
