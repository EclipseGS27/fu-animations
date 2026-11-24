import { CAST_SOUND, ELEMENT_HIT_SOUND, HIT_SOUND, MOTION_SOUND, ORB_SOUND, PROJECTILE_SOUND, RELEASE_SOUND, SOUNDS } from './sounds.mjs';
import { MODULE_ID, getSetting } from './presets.mjs';
import { soundView } from './jbmap.mjs';

/**
 * Sound effects for animations. Each client plays them locally, in step with the animation it is drawing.
 */

const ROOT = `modules/${MODULE_ID}/sfx/`;

/** Effects too plain to say anything about the element: elemental spells use the element's sound instead */
const PLAIN_HITS = new Set(['px-impact-sym-1', 'px-impact-sym-6', 'impact-flash-1', 'impact-flash-2', 'impact-flash-3', 'cast-glow-3', 'cast-glow-4']);

/**
 * @param {string} id sound id from SOUNDS
 * @param {{volume?: number}} opts
 */
export function playSound(id, { volume = 1 } = {}) {
	if (!id || id === 'none' || getSetting('sound') === false) return null;
	const s = SOUNDS[id];
	if (!s?.files?.length) return null;
	const file = s.files[Math.floor(Math.random() * s.files.length)];
	const vol = Math.max(0, Math.min(1, Number(getSetting('soundVolume') ?? 0.7) * volume));
	if (vol <= 0) return null;
	const AH = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
	try {
		return AH?.play({ src: ROOT + file, volume: vol, autoplay: true, loop: false, channel: 'environment' }, false);
	} catch (err) {
		console.warn(`${MODULE_ID} | sound`, err);
		return null;
	}
}

/** The sounds an animation makes when nobody picked any: read off its effects */
export function autoSounds(spec, element = 'none') {
	spec = soundView(spec);
	const hit = spec.hit;
	let hitSnd = RELEASE_SOUND[hit] ?? HIT_SOUND[hit] ?? null;
	if (ELEMENT_HIT_SOUND[element] && PLAIN_HITS.has(hit) && spec.style !== 'melee') hitSnd = ELEMENT_HIT_SOUND[element];
	const castSnd = spec.cast ? (CAST_SOUND[spec.cast] ?? null) : null;
	let projectile = null;
	if (spec.projectile) projectile = spec.projectile === 'orb' ? (ORB_SOUND[element] ?? PROJECTILE_SOUND.orb) : (PROJECTILE_SOUND[spec.projectile] ?? (spec.projectile === 'meteor' ? 'mecha-propulsor-ignition' : null));
	return { cast: castSnd, hit: hitSnd, projectile, after: spec.after ? (HIT_SOUND[spec.after] ?? null) : null };
}

/**
 * Final sounds for a plan: the ability's own choices ('' = automatic, 'none' = silent), else the automatic ones.
 * @returns {{cast:?string, hit:?string, projectile:?string, after:?string, dash:?string, dodge:?string, crit:?string}}
 */
export function soundsFor(spec, element = 'none') {
	const auto = autoSounds(spec, element);
	const choose = (own, fallback) => (own === 'none' ? null : own || fallback || null);
	const silent = spec.castSound === 'none' && spec.hitSound === 'none';
	return {
		cast: choose(spec.castSound, auto.cast),
		hit: choose(spec.hitSound, auto.hit),
		// a picked use sound replaces the automatic launch sound
		projectile: spec.castSound ? null : auto.projectile,
		after: silent ? null : auto.after,
		dash: silent ? null : MOTION_SOUND.dash,
		dodge: silent ? null : MOTION_SOUND.dodge,
		crit: silent ? null : MOTION_SOUND.crit,
	};
}

export function soundLabel(id) {
	return SOUNDS[id]?.label ?? '';
}

/** Sound ids grouped by kind, for <select> menus */
export function soundGroups() {
	const groups = {};
	for (const [id, s] of Object.entries(SOUNDS)) (groups[s.type] ??= []).push([id, s.label]);
	return Object.entries(groups);
}

export { SOUNDS };
