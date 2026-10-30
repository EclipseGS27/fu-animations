import { FX, MODULE_ID, activePreset, getSetting, itemDamageType, resolveSpec } from './presets.mjs';
import { playSound, soundsFor } from './audio.mjs';
import { center, dodge, ease, fxDuration, knockback, lunge, playFx, preload, projectile, tweenOffset, wait } from './player.mjs';
import { hitstop } from './clock.mjs';
import { feelOf } from './feel.mjs';
import * as I from './impact.mjs';
import { isJb, playJb } from './jb2a.mjs';
import { isPixel, playPixel } from './pixel.mjs';
import { PIXEL_CRIT } from './pixelmap.mjs';

/**
 * Turning a chat card into an animation plan (on the client that rolled it), and playing a plan (on every client).
 */

const PLAIN = new Set(['physical', 'untyped', '', null, undefined]);

function tokenFromUuid(uuid) {
	if (!uuid || !canvas?.ready) return null;
	let doc = null;
	try {
		doc = fromUuidSync(uuid);
	} catch {
		return null;
	}
	const actor = doc?.documentName === 'Actor' ? doc : doc?.actor;
	if (doc?.documentName === 'Token') return canvas.tokens.get(doc.id) ?? null;
	if (actor?.isToken && actor.token) return canvas.tokens.get(actor.token.id) ?? null;
	return actor?.getActiveTokens?.(false, false)?.[0] ?? null;
}

function sourceToken(msg, item) {
	const sp = msg.speaker ?? {};
	if (sp.token && (!sp.scene || sp.scene === canvas.scene?.id)) {
		const t = canvas.tokens.get(sp.token);
		if (t) return t;
	}
	const actor = item?.actor ?? (sp.actor ? game.actors.get(sp.actor) : null);
	return actor?.getActiveTokens?.(false, false)?.[0] ?? null;
}

export function resolveElement(spec, damageType, item) {
	if (!spec.element || spec.element === 'none') return 'none';
	if (spec.element !== 'auto') return spec.element;
	const t = damageType ?? itemDamageType(item);
	return PLAIN.has(t) ? 'none' : t;
}

/**
 * @param {ChatMessage} msg
 * @returns {object|null} a plan, or null when there is nothing to animate
 */
export function planFromMessage(msg) {
	if (!canvas?.ready) return null;
	const check = msg.getFlag?.('projectfu', 'Check');
	const itemUuid = check?.itemUuid ?? msg.getFlag?.('projectfu', 'Item');
	if (!itemUuid) return null;
	let item = null;
	try {
		item = fromUuidSync(itemUuid);
	} catch {
		return null;
	}
	if (!item) return null;
	const src = sourceToken(msg, item);
	if (!src) return null;

	const listed = Array.isArray(check?.additionalData?.targets) ? check.additionalData.targets : null;
	let targets = [];
	if (listed?.length) {
		targets = listed.map((t) => ({ token: tokenFromUuid(t.uuid), result: t.result ?? 'none' })).filter((t) => t.token);
	} else {
		targets = [...(game.user.targets ?? [])].map((t) => ({ token: t, result: 'none' }));
	}
	const damageType = check?.additionalData?.damage?.type ?? null;
	const offensive = ['accuracy', 'magic'].includes(check?.type) || !!damageType;
	const { spec, source } = resolveSpec(item, { offensive, hasTargets: targets.length > 0, damageType });
	if (!spec || spec.style === 'none') return null;
	if (getSetting('animateUnmapped') === false && source === 'guess' && !['weapon', 'customWeapon', 'basic', 'shield'].includes(item.type)) return null;

	return {
		scene: canvas.scene.id,
		source: src.id,
		targets: targets.map((t) => ({ id: t.token.id, result: t.result })),
		spec,
		element: resolveElement(spec, damageType, item),
		afterElement: spec.afterElement ?? 'none',
		offensive: offensive || ['melee', 'ranged', 'spell'].includes(spec.style),
		crit: !!check?.critical,
		fumble: !!check?.fumble,
		name: item.name,
		itemType: item.type,
		user: src.document?.name ?? src.actor?.name ?? '',
		portrait: src.actor?.img ?? src.document?.texture?.src ?? null,
	};
}

/* ------------------------------------------------------------------ */
/*  Playback                                                           */
/* ------------------------------------------------------------------ */

const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const sizeOf = (token) => Math.max(token?.document?.width ?? 1, token?.document?.height ?? 1);
const hex = (n) => `#${Number(n).toString(16).padStart(6, '0')}`;

/** Darker shade of a color, for the outer glow of projectiles */
function shade(color, k = 0.55) {
	const r = ((color >> 16) & 255) * k;
	const g = ((color >> 8) & 255) * k;
	const b = (color & 255) * k;
	return (r << 16) | (g << 8) | b;
}

/** tokenId -> what last hit it, so damage numbers know crits and elements */
export const recentHits = new Map();

/** The moment of contact: flash, debris, freeze, shake, knockback */
async function land(plan, F, src, token, at, { crit, miss, ux, uy, first }) {
	const b = { x: at.x, y: at.y };
	const size = sizeOf(token);
	recentHits.set(token.id, { crit, element: plan.element, at: Date.now() });
	if (miss) {
		I.afterimages(token, 220, 0xffffff);
		return dodge(token, ux, uy);
	}
	if (!F.offensive) return;
	const color = F.color;
	I.flashToken(token, Math.max(70, F.freeze * 0.8));
	if (F.burst) I.burstFlash(b, { color, size: F.burst * Math.min(1.6, size) });
	if (F.ring) I.impactRing(b, { color, size: F.ring * Math.min(1.6, size) });
	if (F.debris !== 'none' && F.debrisCount) {
		const dir = src && src !== token && plan.spec.style === 'melee' ? angleTo(center(src), b) : null;
		const kinds = F.debris === 'mixed' ? ['spark', 'chip'] : [F.debris];
		for (const kind of kinds) I.debris(b, { color: kind === 'chip' ? 0x3a2f28 : color, count: Math.round(F.debrisCount / kinds.length), power: 0.7 + F.ring * 0.4, dir, kind });
	}
	if (F.scorch) I.scorch(b, { color: F.mark, size: Math.min(3, F.ring * size * 0.9) });
	if (first) {
		if (F.screen) I.screenFlash(color, F.screen, 160);
		if (F.freeze) {
			await wait(35);
			await hitstop(F.freeze);
		}
		if (F.shake) I.shake(F.shake, 220 + F.shake * 110);
		if (F.camera && !plan._camera) {
			plan._camera = true;
			I.cameraPush(b, { zoom: F.camera, inMs: 120, hold: 260 + F.freeze, outMs: 480 });
		}
	}
	if (src !== token) knockback(token, ux, uy, F.knock);
	if (F.level !== 'light') I.stagger(token, F.knock * 0.6);
}

async function strike(plan, F, src, t, first) {
	const { spec } = plan;
	const token = t.token;
	const a = src ? center(src) : center(token);
	const b = center(token);
	const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
	const ux = (b.x - a.x) / dist;
	const uy = (b.y - a.y) / dist;
	const miss = plan.offensive && t.result === 'miss';
	const crit = plan.offensive && plan.crit && !miss;
	const at = {
		x: b.x,
		y: b.y,
		from: a,
		to: b,
		rotation: src && src !== token ? angleTo(a, b) : null,
		flip: src && b.x < a.x,
		element: plan.element,
		scale: (spec.scale ?? 1) * (crit ? 1.35 : 1) * (miss ? 0.8 : 1) * (F.level === 'heroic' ? 1.25 : 1),
		alpha: miss ? 0.4 : 1,
		tokenSize: sizeOf(token),
		token,
		source: src,
	};
	const jobs = [];
	const snd = plan._snd;
	// JB2A swings, beams and breaths, and pixel strikes from the sky, take a moment to reach the target: land the hit then
	let contact = Promise.resolve();
	if (spec.hit) {
		if (isJb(spec.hit)) {
			const from = src && src.mesh && src !== token ? { x: src.mesh.x, y: src.mesh.y } : a;
			const p = playJb(spec.hit, { ...at, from });
			jobs.push(p);
			contact = p.hit;
		} else if (isPixel(spec.hit)) {
			const p = playPixel(spec.hit, at);
			jobs.push(p);
			contact = p.hit;
		} else jobs.push(playFx(spec.hit, at));
	}
	jobs.push(
		contact.then(() => {
			if (snd && !plan._heard) {
				// one sound per action even with several targets
				plan._heard = true;
				if (miss) playSound(snd.dodge, { volume: 0.7 });
				else playSound(snd.hit);
				if (crit) playSound(snd.crit);
			}
			if (crit) playFx(activePreset() === 'pixel' ? PIXEL_CRIT : 'impact-flash-3', { x: b.x, y: b.y, from: a, to: b, rotation: at.rotation, scale: 1.2, element: 'none', tokenSize: at.tokenSize, token });
			return land(plan, F, src, token, at, { crit, miss, ux, uy, first });
		}),
	);
	return Promise.all(jobs);
}

/** Something flying from the user to a target */
function fly(plan, F, kind, from, to, i) {
	const color = F.color;
	if (isJb(kind)) return playJb(kind, { x: to.x, y: to.y, from, to, element: plan.element, scale: plan.spec.scale && plan.spec.scale > 1 ? 1.15 : 1 }).hit;
	if (isPixel(kind)) {
		if (kind === 'sf-meteor') I.telegraph(to, { color, size: 1.2 * F.ring, ms: 900 });
		return playPixel(kind, { x: to.x, y: to.y, from, to, element: plan.element, scale: plan.spec.scale && plan.spec.scale > 1 ? 1.15 : 1 }).hit;
	}
	if (kind === 'orb') {
		const dist = Math.hypot(to.x - from.x, to.y - from.y);
		const g = canvas.grid.size;
		const ms = Math.max(260, Math.min(650, (dist / (9 * g)) * 1000 * 1.1));
		return I.blazingProjectile(from, to, { color, glow: shade(color), size: F.orb, ms, arc: i % 2 ? 0.7 : -0.7, embers: F.level === 'light' ? 1 : F.level === 'normal' ? 2 : 4 });
	}
	if (kind === 'meteor') {
		const g = canvas.grid.size;
		const start = { x: to.x - g * 2.6, y: to.y - g * 4.2 };
		I.telegraph(to, { color, size: 1.2 * F.ring, ms: 820 });
		return wait(220).then(() => I.blazingProjectile(start, to, { color, glow: shade(color, 0.6), size: Math.max(0.6, F.orb * 1.8), ms: 600, fall: 1.5, embers: 6 }));
	}
	return projectile(kind, from, to, plan.element);
}

/** Melee approach: wind-up, dash with or without afterimages. Returns how to go back */
async function approach(plan, F, src, main) {
	if (!F.windup) return lunge(src, main);
	const a = center(src);
	const b = center(main);
	const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
	const ux = (b.x - a.x) / dist;
	const uy = (b.y - a.y) / dist;
	const rad = (t) => Math.max(t.w ?? canvas.grid.size, t.h ?? canvas.grid.size) / 2;
	const travel = Math.max(0, dist - (rad(src) + rad(main)) * 0.7);
	await I.anticipate(src, ux, uy, F.level === 'heroic' ? 320 : F.level === 'heavy' ? 260 : 200);
	const stop = F.trail ? I.afterimages(src, 0) : null;
	await tweenOffset(src, { x: ux * travel, y: uy * travel }, Math.min(260, 110 + travel * 0.25), ease.in);
	stop?.();
	return { back: () => tweenOffset(src, { x: 0, y: 0 }, Math.min(420, 200 + travel * 0.4), ease.inOut), ux, uy };
}

/** Banner before a big move */
function cutInFor(plan, F) {
	if (!F.cutin) return Promise.resolve();
	const spec = plan.spec;
	const color = spec.cutinColor || hex(F.color === 0xffd9a0 ? 0xf2c45a : F.color);
	return I.cutIn({ name: spec.cutinText || plan.name || '', user: plan.user ?? '', img: spec.cutinImg || plan.portrait, color, ms: 1300 });
}

/**
 * Play a plan on this client's canvas.
 * @param {object} plan from planFromMessage (or the editor preview)
 */
export async function runPlan(plan) {
	if (!plan || getSetting('enabled') === false || !canvas?.ready) return;
	if (plan.scene && plan.scene !== canvas.scene?.id) return;
	const { spec } = plan;
	const src = canvas.tokens.get(plan.source) ?? null;
	const targets = (plan.targets ?? []).map((t) => ({ token: canvas.tokens.get(t.id), result: t.result })).filter((t) => t.token);
	await preload([spec.cast, spec.hit, spec.after, isJb(spec.projectile) ? spec.projectile : null, plan.crit && activePreset() !== 'pixel' ? 'impact-flash-3' : null].filter(Boolean));
	const snd = (plan._snd = soundsFor(spec, plan.element));
	plan._heard = false;
	plan._camera = false;
	const F = feelOf(plan, { targets: targets.length });
	const lit = [src, ...targets.map((t) => t.token)].filter(Boolean);
	const undim = F.dim ? I.dimScene(lit, { alpha: F.dim, ms: 240 }) : null;
	try {
		await cutInFor(plan, F);
		if (F.level === 'heroic' && F.camera && targets.length) {
			// lean in on the targets for the whole move
			plan._camera = true;
			const cs = targets.map((t) => center(t.token));
			const mid = { x: cs.reduce((s, c) => s + c.x, 0) / cs.length, y: cs.reduce((s, c) => s + c.y, 0) / cs.length };
			I.cameraPush(mid, { zoom: F.camera, inMs: 380, hold: 1500, outMs: 600 });
		}
		await perform(plan, F, src, targets, snd);
		if (undim) await wait(F.level === 'heroic' ? 380 : 260);
	} finally {
		if (undim) await undim(F.level === 'heroic' ? 500 : 340);
	}
}

async function perform(plan, F, src, targets, snd) {
	const { spec } = plan;
	if (spec.style === 'self' || (!targets.length && ['support'].includes(spec.style))) {
		if (!src) return;
		const c = center(src);
		if (spec.cast) {
			playSound(snd.cast);
			playFx(spec.cast, { ...c, from: c, to: c, element: plan.element, scale: spec.scale, tokenSize: sizeOf(src), token: src });
			await wait(Math.min(700, fxDuration(spec.cast) * 0.45));
		}
		playSound(snd.hit);
		await playFx(spec.hit, { ...c, from: c, to: c, element: plan.element, scale: spec.scale, tokenSize: sizeOf(src), token: src });
		return;
	}

	if (spec.style === 'melee') {
		const main = targets[0]?.token;
		if (src && main && main !== src && getSetting('moveMelee') !== false && !src.document?.hidden) {
			playSound(snd.dash, { volume: 0.6 });
			const { back } = await approach(plan, F, src, main);
			await Promise.all([...targets.map((t, i) => strike(plan, F, src, t, i === 0)), wait(260 + F.freeze).then(back)]);
		} else if (targets.length) {
			await Promise.all(targets.map((t, i) => strike(plan, F, src, t, i === 0)));
		} else if (src) {
			playSound(snd.hit);
			await playFx(spec.hit, { ...center(src), element: plan.element, scale: spec.scale, tokenSize: sizeOf(src), token: src });
		}
		if (spec.after && src) {
			playSound(snd.after);
			await playFx(spec.after, { ...center(src), element: plan.afterElement, tokenSize: sizeOf(src), token: src });
		}
		return;
	}

	// ranged, spell, support: cast where you stand, send it over, land it on every target
	if (src && spec.cast) {
		const c = center(src);
		const first = targets[0]?.token;
		playSound(snd.cast);
		playFx(spec.cast, {
			...c,
			from: c,
			to: first ? center(first) : c,
			rotation: first && first !== src ? angleTo(c, center(first)) : null,
			element: FX[spec.cast]?.cat === 'Healing' ? 'none' : plan.element,
			scale: F.level === 'heroic' ? 1.3 : 1,
			tokenSize: sizeOf(src),
			token: src,
		});
		const hold = Math.min(spec.projectile ? 260 : 650, fxDuration(spec.cast) * 0.45);
		if (F.offensive && (F.level === 'heavy' || F.level === 'heroic') && spec.style === 'spell') {
			const settle = await I.gather(src, { color: F.color, ms: Math.max(hold, F.level === 'heroic' ? 600 : 420) });
			I.burstFlash(c, { color: F.color, size: 0.9 });
			settle();
		} else await wait(hold);
	}
	if (!targets.length) return;
	if (spec.projectile && src) playSound(snd.projectile, { volume: 0.8 });
	let firstHit = true;
	await Promise.all(
		targets.map(async (t, i) => {
			await wait(i * (spec.projectile ? 150 : 90));
			if (spec.projectile && src && t.token !== src) await fly(plan, F, spec.projectile, center(src), center(t.token), i);
			const first = firstHit;
			firstHit = false;
			return strike(plan, F, src, t, first || F.level === 'heavy' || F.level === 'heroic');
		}),
	);
	if (spec.after && src) {
		playSound(snd.after);
		await playFx(spec.after, { ...center(src), element: plan.afterElement, tokenSize: sizeOf(src), token: src });
	}
}

export const SOCKET = `module.${MODULE_ID}`;
