import { ABILITIES, MODULE_ID, PRESETS, describe, resolveSpec } from './presets.mjs';
import { jbAvailable } from './jbcore.mjs';
import { refreshBobbing, resetLayer, resetMotion } from './player.mjs';
import { SOCKET, planFromMessage, runPlan } from './sequence.mjs';
import { AnimationEditor, AnimationLibrary } from './editor.mjs';
import { resetImpactLayers } from './impact.mjs';
import { resetPixelLayers } from './pixel.mjs';
import { onDamageInfo, registerNumbers } from './numbers.mjs';
import { refreshAll as refreshStatuses, registerStatuses } from './statuses.mjs';

registerNumbers();
registerStatuses();

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

Hooks.once('init', () => {
	const reg = (key, data) => game.settings.register(MODULE_ID, key, { config: true, ...data });
	reg('preset', {
		name: 'Animation preset',
		hint: 'Original: the sprite and pixel effects that come with this module. Pixel VFX: every ability, spell and bestiary attack redone as pixel art drawn in code (Sprite Fusion\'s open source effects and more in their style), recolored by element; needs no asset packs. JB2A: every ability, spell and bestiary attack uses JB2A effects instead (needs the free "JB2A - Free Content" module or JB2A Patreon). Animations you changed yourself, on an item or for the world, stay the same in every preset.',
		scope: 'world',
		type: String,
		choices: PRESETS,
		default: 'original',
		onChange: () => foundry.applications.instances.get('fua-library')?.render(),
	});
	reg('enabled', { name: 'Play animations', hint: 'Show attack, spell and skill animations on the scene.', scope: 'client', type: Boolean, default: true, onChange: () => refreshStatuses() });
	reg('moveMelee', { name: 'Melee attacks dash to the target', hint: 'The attacker lunges next to its target, strikes, then returns to its spot. Visual only: the token never really moves.', scope: 'world', type: Boolean, default: true });
	reg('idleBob', { name: 'Hover during conflicts', hint: 'Tokens in the active conflict gently bob in place while they wait.', scope: 'client', type: Boolean, default: true, onChange: () => refreshBobbing() });
	reg('bobAmount', { name: 'Hover height', scope: 'client', type: Number, range: { min: 0.5, max: 3, step: 0.5 }, default: 1 });
	reg('statusLoops', { name: 'Show conditions on tokens', hint: 'While a token is poisoned, dazed, shaken, slow, weak, enraged or asleep, a small looping effect plays on it and its sprite is tinted.', scope: 'client', type: Boolean, default: true, onChange: () => refreshStatuses() });
	reg('scale', { name: 'Effect size', hint: 'Multiplier for every effect, on top of each animation’s own size.', scope: 'client', type: Number, range: { min: 0.5, max: 2, step: 0.1 }, default: 1 });
	reg('sound', { name: 'Play sound effects', hint: 'Animations play their sounds on the Environment volume channel.', scope: 'client', type: Boolean, default: true });
	reg('soundVolume', { name: 'Sound effect volume', scope: 'client', type: Number, range: { min: 0, max: 1, step: 0.05 }, default: 0.7 });
	reg('freeze', { name: 'Freeze frame on hits', hint: 'The scene holds still for a split second when a hit lands, like in fighting games.', scope: 'client', type: Boolean, default: true });
	reg('shake', { name: 'Screen shake', hint: 'Hits shake the view, harder for heavy and heroic moves.', scope: 'client', type: Boolean, default: true });
	reg('camera', { name: 'Camera push on big hits', hint: 'The view leans in toward heavy impacts, then settles back.', scope: 'client', type: Boolean, default: true });
	reg('dim', { name: 'Darken the scene for big moves', hint: 'Everything but the fighters goes dark during heavy spells and heroic moves.', scope: 'client', type: Boolean, default: true });
	reg('cutins', { name: 'Cut-ins for heroic moves', hint: 'Full-screen banner with the character portrait before big moves.', scope: 'client', type: Boolean, default: true });
	reg('numbers', { name: 'Battle damage numbers', hint: 'Damage and healing pop off the token when HP changes: gold and larger on a critical, with the element under it. Replaces the system’s plain HP text.', scope: 'client', type: Boolean, default: true });
	reg('animateUnmapped', { name: 'Animate homebrew abilities', hint: 'Skills, spells and features that are not in the Project FU compendium get an animation guessed from their type and damage. Weapons and basic attacks always animate.', scope: 'world', type: Boolean, default: true });
	game.settings.register(MODULE_ID, 'overrides', { scope: 'world', config: false, type: Object, default: {} });
	game.settings.registerMenu(MODULE_ID, 'library', { name: 'Ability animations', label: 'Open the list', hint: 'See and change the animation of every class ability, spell and Core item for the whole world.', icon: 'fa-solid fa-wand-sparkles', type: AnimationLibrary, restricted: true });

	game.modules.get(MODULE_ID).api = {
		play: (plan) => {
			game.socket.emit(SOCKET, { type: 'play', plan });
			return runPlan(plan);
		},
		edit: (item) => AnimationEditor.open({ item }),
		library: () => new AnimationLibrary().render({ force: true }),
		resolve: resolveSpec,
		describe,
		abilities: ABILITIES,
	};
});

Hooks.once('ready', () => {
	if (game.system.id !== 'projectfu') return ui.notifications.warn('Fabula Ultima Battle Animations needs the Project FU system.');
	if (game.user.isGM && game.settings.get(MODULE_ID, 'preset') === 'jb2a' && !jbAvailable()) ui.notifications.warn('Battle Animations: the JB2A preset is on but the JB2A module is not active, so the Original preset plays. Turn on "JB2A - Free Content" in Manage Modules.');
	game.socket.on(SOCKET, (msg) => {
		if (msg?.type === 'play') runPlan(msg.plan);
		else if (msg?.type === 'dmg') onDamageInfo(msg.data);
	});
	refreshBobbing();
});

/* ------------------------------------------------------------------ */
/*  Trigger: the client that rolled the card plans it and tells others */
/* ------------------------------------------------------------------ */

Hooks.on('createChatMessage', (msg) => {
	const authorId = msg.author?.id ?? msg.user?.id ?? msg.author;
	if (authorId !== game.user.id) return;
	let plan = null;
	try {
		plan = planFromMessage(msg);
	} catch (err) {
		console.warn(`${MODULE_ID} | could not plan an animation`, err);
	}
	if (!plan) return;
	game.socket.emit(SOCKET, { type: 'play', plan });
	runPlan(plan).catch((err) => console.warn(`${MODULE_ID} | animation failed`, err));
});

/* ------------------------------------------------------------------ */
/*  Canvas and combat upkeep                                           */
/* ------------------------------------------------------------------ */

Hooks.on('canvasReady', () => {
	resetLayer();
	resetImpactLayers();
	resetPixelLayers();
	resetMotion();
	refreshBobbing();
});
for (const h of ['combatStart', 'updateCombat', 'deleteCombat', 'createCombatant', 'deleteCombatant', 'updateCombatant', 'createToken', 'deleteToken']) {
	Hooks.on(h, () => setTimeout(refreshBobbing, 0));
}

/* ------------------------------------------------------------------ */
/*  Where to change an animation                                       */
/* ------------------------------------------------------------------ */

const ANIMATABLE = new Set(['weapon', 'customWeapon', 'shield', 'basic', 'spell', 'skill', 'heroic', 'miscAbility', 'classFeature', 'optionalFeature', 'consumable', 'ritual']);

/* "Animation" in the header menu of item sheets */
Hooks.on('getHeaderControlsDocumentSheetV2', (app, controls) => {
	const doc = app.document;
	if (!(doc instanceof Item) || !ANIMATABLE.has(doc.type) || !doc.isOwner) return;
	app.options.actions ??= {};
	app.options.actions.fuaAnimation ??= () => AnimationEditor.open({ item: app.document });
	if (controls.some((c) => c.action === 'fuaAnimation')) return;
	controls.push({ action: 'fuaAnimation', icon: 'fa-solid fa-wand-sparkles', label: 'Animation', ownership: 'OWNER' });
});

/* Items directory right-click */
for (const hook of ['getItemContextOptions', 'getItemDirectoryEntryContext']) {
	Hooks.on(hook, (app, options) => {
		if (options.some((o) => o.name === 'Animation')) return;
		const itemOf = (li) => game.items.get(li?.dataset?.entryId ?? li?.[0]?.dataset?.entryId ?? li?.dataset?.documentId);
		options.push({
			name: 'Animation',
			icon: '<i class="fa-solid fa-wand-sparkles"></i>',
			condition: (li) => {
				const item = itemOf(li);
				return !!item && ANIMATABLE.has(item.type) && item.isOwner;
			},
			callback: (li) => {
				const item = itemOf(li);
				if (item) AnimationEditor.open({ item });
			},
		});
	});
}
