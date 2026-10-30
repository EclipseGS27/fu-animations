import { getSetting } from './presets.mjs';
import { damageNumber } from './impact.mjs';
import { SOCKET, recentHits } from './sequence.mjs';

/**
 * Damage and healing numbers that slam onto the token, styled by the hit that caused it: bigger and gold on a
 * critical, with the element and the Affinity that applied (VULNERABLE, RESISTED, IMMUNE, ABSORBED) under it.
 *
 * Two sources:
 * - Project FU's damage event, which knows the damage type and Affinity. It only fires on the client that
 *   applied the damage, so that client sends it to everyone. It also covers hits that change nothing (immune).
 * - HP changes, for everything else (healing, manual edits). They wait a moment so a damage event for the same
 *   change can replace them, then show the plain number.
 */

const lastHp = new Map();
/** actor uuid -> HP change waiting to be shown: { timer, diff } */
const pending = new Map();
/** actor uuid -> when a number was last shown from a damage event / from an HP change */
const byEvent = new Map();
const byHp = new Map();
const seenIds = new Set();
const hpOf = (actor) => Number(actor?.system?.resources?.hp?.value);
const WAIT = 350;

const AFF_WORD = { vulnerability: 'VULNERABLE', resistance: 'RESISTED', immunity: 'IMMUNE', absorption: 'ABSORBED' };
const PLAIN = new Set(['', 'physical', 'untyped', 'none', 'auto']);

const numbersOn = () => getSetting('numbers') !== false && getSetting('enabled') !== false;

export function primeNumbers() {
	lastHp.clear();
	for (const t of canvas?.tokens?.placeables ?? []) if (t.actor) lastHp.set(t.actor.uuid, hpOf(t.actor));
}

function tokensOf(actor) {
	return (actor?.getActiveTokens?.(false, false) ?? []).filter((token) => {
		const sceneId = token.document?.parent?.id ?? token.scene?.id;
		if (sceneId && sceneId !== canvas.scene?.id) return false;
		return token.visible && !token.document?.hidden;
	});
}

/**
 * @param {Actor} actor
 * @param {number} diff HP change: negative for damage
 * @param {{type?:string, affinity?:string}} [info] from the damage event
 */
function show(actor, diff, info = {}) {
	for (const token of tokensOf(actor)) {
		const hit = recentHits.get(token.id);
		const fresh = hit && Date.now() - hit.at < 20000;
		const type = String(info.type || (fresh ? hit.element : '') || '').toLowerCase();
		const word = AFF_WORD[info.affinity] ?? '';
		// the element shows when it isn't plain physical, or when an Affinity applied to it
		const typeWord = type && (!PLAIN.has(type) || word) ? type.toUpperCase() : '';
		const crit = !!(fresh && hit.crit);
		if (info.affinity === 'immunity' && !diff) damageNumber(token, 'IMMUNE', { kind: 'immune', sub: typeWord });
		else if (diff < 0) damageNumber(token, String(-diff), { crit, sub: [typeWord, word].filter(Boolean).join(' · '), kind: info.affinity === 'vulnerability' ? 'weak' : info.affinity === 'resistance' ? 'resist' : '' });
		else if (diff > 0) damageNumber(token, `+${diff}`, { heal: true, sub: word ? [typeWord, word].filter(Boolean).join(' · ') : 'HP' });
		if (fresh) recentHits.delete(token.id);
	}
}

function onHpChange(actor) {
	if (!canvas?.ready || !actor) return;
	const hp = hpOf(actor);
	if (!Number.isFinite(hp)) return;
	const uuid = actor.uuid;
	const before = lastHp.get(uuid);
	lastHp.set(uuid, hp);
	if (!numbersOn() || before == null || before === hp) return;
	const prev = pending.get(uuid);
	if (prev) clearTimeout(prev.timer);
	const diff = (prev?.diff ?? 0) + (hp - before);
	const timer = setTimeout(() => {
		pending.delete(uuid);
		if (Date.now() - (byEvent.get(uuid) ?? 0) < 1500) return;
		byHp.set(uuid, Date.now());
		show(actor, diff);
	}, WAIT);
	pending.set(uuid, { timer, diff });
}

/**
 * A damage event, from this client or another one.
 * @param {{id:string, actorUuid:string, amount:number, type:string, affinity:string}} data
 */
export function onDamageInfo(data) {
	if (!data?.actorUuid || !canvas?.ready || !numbersOn()) return;
	if (data.id) {
		if (seenIds.has(data.id)) return;
		seenIds.add(data.id);
		if (seenIds.size > 200) seenIds.delete(seenIds.values().next().value);
	}
	let actor = null;
	try {
		actor = fromUuidSync(data.actorUuid);
	} catch {
		return;
	}
	if (!actor) return;
	const uuid = actor.uuid;
	// the HP change already showed its number (the event came late): leave it
	if (Date.now() - (byHp.get(uuid) ?? 0) < 1200) return;
	const p = pending.get(uuid);
	if (p) {
		clearTimeout(p.timer);
		pending.delete(uuid);
	}
	byEvent.set(uuid, Date.now());
	const amount = Math.abs(Number(data.amount) || 0);
	show(actor, data.affinity === 'absorption' ? amount : -amount, data);
}

/** Project FU fires the damage event on the client that applied it; pass it on to everyone */
function onDamageEvent(ev) {
	try {
		if (!ev?.actor || seenEvents.has(ev)) return;
		seenEvents.add(ev);
		const data = { id: foundry.utils.randomID(), actorUuid: ev.actor.uuid, amount: Number(ev.amount) || 0, type: String(ev.type ?? ''), affinity: String(ev.affinity ?? '') };
		game.socket.emit(SOCKET, { type: 'dmg', data });
		onDamageInfo(data);
	} catch (err) {
		console.warn('fu-animations | damage number', err);
	}
}
const seenEvents = new WeakSet();

async function hookDamageEvents() {
	const name = game.projectfu?.hooks?.DAMAGE_EVENT ?? 'projectfu.events.damage';
	Hooks.on(name, onDamageEvent);
	// older Project FU versions dispatched it through their own AsyncHooks module
	try {
		const { AsyncHooks } = await import(foundry.utils.getRoute('systems/projectfu/module/helpers/async-hooks.mjs'));
		AsyncHooks?.on?.(name, onDamageEvent);
	} catch {
		/* current Project FU: the plain hook covers it */
	}
}

/** The system's own "-12 HP" floating text would double up with ours */
function muteSystemText() {
	const iface = canvas?.interface;
	if (!iface?.createScrollingText || iface.createScrollingText.fuaWrapped) return;
	const orig = iface.createScrollingText;
	const wrapped = function (origin, text, options) {
		if (numbersOn() && typeof text === 'string' && /^[-+]?\d+\s*hp$/i.test(text.trim())) return Promise.resolve();
		return orig.call(this, origin, text, options);
	};
	wrapped.fuaWrapped = true;
	iface.createScrollingText = wrapped;
}

export function registerNumbers() {
	Hooks.on('canvasReady', () => {
		primeNumbers();
		muteSystemText();
	});
	Hooks.once('ready', hookDamageEvents);
	Hooks.on('createToken', (doc) => doc.actor && lastHp.set(doc.actor.uuid, hpOf(doc.actor)));
	Hooks.on('updateActor', (actor, changes) => {
		if (foundry.utils.hasProperty(changes, 'system.resources.hp')) onHpChange(actor);
	});
	// unlinked tokens keep their changes in the token's delta
	Hooks.on('updateToken', (doc, changes) => {
		if (foundry.utils.hasProperty(changes, 'delta.system.resources.hp') || foundry.utils.hasProperty(changes, 'actorData.system.resources.hp')) onHpChange(doc.actor);
	});
}
