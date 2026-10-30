import { ELEMENT_LOOK, getSetting } from './presets.mjs';

/**
 * Impact: how hard a move lands. Each animation has an impact level (light, normal, heavy, heroic) that sets
 * the freeze on contact, screen shake, camera push, darkening, cut-in, debris and ground marks.
 * Every one of those can be overridden per ability in the editor; anything left on "auto" follows the level.
 */

export const LEVELS = ['light', 'normal', 'heavy', 'heroic'];

export const LEVEL_LABELS = { light: 'Light', normal: 'Normal', heavy: 'Heavy', heroic: 'Heroic' };

/** What each level does on its own */
const BASE = {
	light: { freeze: 0, shake: 0, camera: 0, dim: 0, cutin: false, windup: false, trail: false, debris: 6, ring: 0.8, burst: 0, screen: 0, scorch: false, knock: 0.8, orb: 0.2 },
	normal: { freeze: 60, shake: 0.6, camera: 0, dim: 0, cutin: false, windup: true, trail: false, debris: 14, ring: 1, burst: 1.1, screen: 0, scorch: false, knock: 1.2, orb: 0.26 },
	heavy: { freeze: 110, shake: 1.3, camera: 1.08, dim: 0.45, cutin: false, windup: true, trail: true, debris: 24, ring: 1.3, burst: 1.5, screen: 0.14, scorch: true, knock: 1.9, orb: 0.36 },
	heroic: { freeze: 170, shake: 2.4, camera: 1.12, dim: 0.7, cutin: true, windup: true, trail: true, debris: 36, ring: 2, burst: 2.2, screen: 0.4, scorch: true, knock: 2.6, orb: 0.5 },
};

/* Choices offered in the editor. '' always means automatic. */
export const IMPACT_FIELDS = {
	power: { label: 'Impact', options: { light: 'Light', normal: 'Normal', heavy: 'Heavy', heroic: 'Heroic' } },
	freeze: { label: 'Freeze on hit', options: { 0: 'None', 60: 'Short', 110: 'Medium', 170: 'Long', 260: 'Very long' } },
	shake: { label: 'Screen shake', options: { 0: 'None', 0.6: 'Light', 1.3: 'Medium', 2.4: 'Heavy', 3.5: 'Earthquake' } },
	camera: { label: 'Camera push', options: { off: 'Off', on: 'On' } },
	dim: { label: 'Darken the scene', options: { off: 'Off', on: 'On' } },
	windup: { label: 'Wind-up and trail', options: { off: 'Off', windup: 'Wind-up only', on: 'Wind-up and afterimages' } },
	debris: { label: 'Debris', options: { none: 'None', spark: 'Sparks', ember: 'Embers', chip: 'Rubble', mixed: 'Sparks and rubble' } },
	scorch: { label: 'Mark on the ground', options: { off: 'Off', on: 'On' } },
	cutin: { label: 'Cut-in', options: { off: 'Off', on: 'On' } },
};

const DEBRIS_BY_ELEMENT = { fire: 'ember', earth: 'chip', bolt: 'spark', ice: 'spark', air: 'spark', light: 'spark', dark: 'ember', poison: 'ember', physical: 'spark', none: 'spark' };
const MARK_BY_ELEMENT = { fire: 0x1a0d06, bolt: 0x0d0d14, earth: 0x2a1d10, dark: 0x0a0414, physical: 0x1a1512, none: 0x1a1512, poison: 0x14200a, ice: 0x0e1a24 };

/** The level an ability has when nobody chose one */
export function autoLevel({ style, itemType, targets = 1 } = {}) {
	if (itemType === 'heroic') return 'heroic';
	if (style === 'support' || style === 'self') return 'light';
	if (style === 'spell') return targets >= 2 ? 'heavy' : 'normal';
	return 'normal';
}

const bump = (level, n) => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, LEVELS.indexOf(level) + n))];

/**
 * Concrete numbers for one play of an animation.
 * @param {object} plan
 * @param {{targets?: number, ignoreSettings?: boolean}} ctx
 */
export function feelOf(plan, ctx = {}) {
	const spec = plan.spec ?? {};
	const imp = spec.impact ?? {};
	const base = imp.power && BASE[imp.power] ? imp.power : autoLevel({ style: spec.style, itemType: plan.itemType, targets: ctx.targets ?? plan.targets?.length ?? 1 });
	let level = base;
	if (plan.crit && plan.offensive) level = bump(level, 1);
	if (plan.fumble) level = 'light';
	const b = BASE[level];
	const offensive = !!plan.offensive;
	const el = plan.element && plan.element !== 'auto' ? plan.element : 'none';
	const f = {
		level,
		base,
		offensive,
		freeze: offensive ? b.freeze : 0,
		shake: offensive ? b.shake : 0,
		camera: b.camera,
		// darkening is for spells and big moves; a heavy sword crit stays in the light
		dim: base === 'heroic' ? b.dim : level === 'heavy' || level === 'heroic' ? (spec.style === 'spell' ? 0.45 : 0) : 0,
		cutin: base === 'heroic',
		windup: spec.style === 'melee' && b.windup,
		trail: spec.style === 'melee' && b.trail,
		debris: offensive ? (DEBRIS_BY_ELEMENT[el] ?? 'spark') : 'none',
		debrisCount: b.debris,
		ring: b.ring,
		burst: offensive ? b.burst : 0,
		screen: offensive ? b.screen : 0,
		scorch: offensive && b.scorch && el !== 'air' && el !== 'light',
		mark: MARK_BY_ELEMENT[el] ?? 0x1a1512,
		knock: b.knock,
		orb: b.orb,
		color: (ELEMENT_LOOK[el] ?? ELEMENT_LOOK.none).color,
	};
	// the ability's own choices
	if (imp.freeze != null && imp.freeze !== '') f.freeze = Number(imp.freeze) || 0;
	if (imp.shake != null && imp.shake !== '') f.shake = Number(imp.shake) || 0;
	if (imp.camera === 'on') f.camera = f.camera || 1.1;
	if (imp.camera === 'off') f.camera = 0;
	if (imp.dim === 'on') f.dim = f.dim || (level === 'heroic' ? 0.7 : 0.5);
	if (imp.dim === 'off') f.dim = 0;
	if (imp.cutin === 'on') f.cutin = true;
	if (imp.cutin === 'off') f.cutin = false;
	if (imp.windup === 'off') f.windup = f.trail = false;
	if (imp.windup === 'windup') {
		f.windup = true;
		f.trail = false;
	}
	if (imp.windup === 'on') f.windup = f.trail = true;
	if (imp.debris) f.debris = imp.debris;
	if (imp.scorch === 'on') f.scorch = true;
	if (imp.scorch === 'off') f.scorch = false;
	// each player's own comfort settings win
	if (ctx.ignoreSettings) return f;
	if (getSetting('freeze') === false) f.freeze = 0;
	if (getSetting('shake') === false) f.shake = 0;
	if (getSetting('camera') === false) f.camera = 0;
	if (getSetting('dim') === false) f.dim = 0;
	if (getSetting('cutins') === false) f.cutin = false;
	return f;
}

/** Short text for the editor's "Automatic" options */
export function autoText(field, f) {
	switch (field) {
		case 'power':
			return LEVEL_LABELS[f.base];
		case 'freeze':
			return IMPACT_FIELDS.freeze.options[f.freeze] ?? `${f.freeze} ms`;
		case 'shake':
			return IMPACT_FIELDS.shake.options[f.shake] ?? String(f.shake);
		case 'camera':
			return f.camera ? 'On' : 'Off';
		case 'dim':
			return f.dim ? 'On' : 'Off';
		case 'cutin':
			return f.cutin ? 'On' : 'Off';
		case 'windup':
			return f.trail ? 'Wind-up and afterimages' : f.windup ? 'Wind-up only' : 'Off';
		case 'debris':
			return IMPACT_FIELDS.debris.options[f.debris] ?? 'None';
		case 'scorch':
			return f.scorch ? 'On' : 'Off';
	}
	return '';
}
