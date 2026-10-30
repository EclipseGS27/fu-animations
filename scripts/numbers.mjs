import { getSetting } from './presets.mjs';
import { damageNumber } from './impact.mjs';
import { recentHits } from './sequence.mjs';

/**
 * Damage and healing numbers that slam onto the token when HP actually changes (after affinities, when the
 * damage is applied), styled by the hit that caused it: bigger and gold on a critical, with the element under it.
 */

const lastHp = new Map();
const hpOf = (actor) => Number(actor?.system?.resources?.hp?.value);

export function primeNumbers() {
	lastHp.clear();
	for (const t of canvas?.tokens?.placeables ?? []) if (t.actor) lastHp.set(t.actor.uuid, hpOf(t.actor));
}

function onHpChange(actor) {
	if (!canvas?.ready || !actor) return;
	const hp = hpOf(actor);
	if (!Number.isFinite(hp)) return;
	const before = lastHp.get(actor.uuid);
	lastHp.set(actor.uuid, hp);
	if (getSetting('numbers') === false || getSetting('enabled') === false || before == null || before === hp) return;
	const diff = hp - before;
	for (const token of actor.getActiveTokens?.(false, false) ?? []) {
		const sceneId = token.document?.parent?.id ?? token.scene?.id;
		if (sceneId && sceneId !== canvas.scene?.id) continue;
		if (!token.visible || token.document?.hidden) continue;
		const hit = recentHits.get(token.id);
		const fresh = hit && Date.now() - hit.at < 20000;
		const el = fresh && hit.element && !['none', 'physical', 'auto'].includes(hit.element) ? hit.element.toUpperCase() : '';
		if (diff < 0) damageNumber(token, String(-diff), { crit: !!(fresh && hit.crit), sub: el });
		else damageNumber(token, `+${diff}`, { heal: true, sub: 'HP' });
		if (fresh) recentHits.delete(token.id);
	}
}

/** The system's own "-12 HP" floating text would double up with ours */
function muteSystemText() {
	const iface = canvas?.interface;
	if (!iface?.createScrollingText || iface.createScrollingText.fuaWrapped) return;
	const orig = iface.createScrollingText;
	const wrapped = function (origin, text, options) {
		if (getSetting('numbers') !== false && getSetting('enabled') !== false && typeof text === 'string' && /^[-+]?\d+\s*hp$/i.test(text.trim())) return Promise.resolve();
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
	Hooks.on('createToken', (doc) => doc.actor && lastHp.set(doc.actor.uuid, hpOf(doc.actor)));
	Hooks.on('updateActor', (actor, changes) => {
		if (foundry.utils.hasProperty(changes, 'system.resources.hp')) onHpChange(actor);
	});
	// unlinked tokens keep their changes in the token's delta
	Hooks.on('updateToken', (doc, changes) => {
		if (foundry.utils.hasProperty(changes, 'delta.system.resources.hp') || foundry.utils.hasProperty(changes, 'actorData.system.resources.hp')) onHpChange(doc.actor);
	});
}
