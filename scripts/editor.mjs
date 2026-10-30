import { ABILITIES, BESTIARY, ELEMENTS, ELEMENT_LOOK, FX, MODULE_ID, PRESETS, STYLES, abilityKey, activePreset, defaultSpec, describe, entryFor, fxGroups, presetFor, projectileGroups, resolveSpec, worldOverrides } from './presets.mjs';
import { JBFX, isJb, jbModule } from './jbcore.mjs';
import { resolveElement, runPlan } from './sequence.mjs';
import { PROC, isProc } from './procedural.mjs';
import { autoSounds, playSound, soundGroups, soundLabel } from './audio.mjs';
import { IMPACT_FIELDS, autoText, feelOf } from './feel.mjs';
import { cutIn } from './impact.mjs';

const { ApplicationV2 } = foundry.applications.api;
const ROOT = `modules/${MODULE_ID}/vfx/`;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const SOURCE_TEXT = {
	item: 'This item has its own animation.',
	world: 'Using the world choice for this ability.',
	default: 'Using the built-in animation for this ability',
	guess: 'Picked automatically from the item',
};

function fxOptions(selected, allowNone = true) {
	let html = allowNone ? `<option value="" ${!selected ? 'selected' : ''}>None</option>` : '';
	for (const [cat, list] of fxGroups()) {
		html += `<optgroup label="${esc(cat)}">${list.map(([id, label]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${esc(label)}</option>`).join('')}</optgroup>`;
	}
	return html;
}

function projOptions(selected) {
	let html = `<option value="" ${!selected ? 'selected' : ''}>None</option>`;
	for (const [cat, list] of projectileGroups()) html += `<optgroup label="${esc(cat)}">${list.map(([id, label]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${esc(label)}</option>`).join('')}</optgroup>`;
	return html;
}

const opts = (map, selected) => Object.entries(map).map(([k, l]) => `<option value="${k}" ${k === (selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');

/* ------------------------------------------------------------------ */
/*  Small looping preview of one effect, drawn on a 2D canvas          */
/* ------------------------------------------------------------------ */

const images = new Map();
function image(src) {
	if (!images.has(src)) {
		const img = new Image();
		img.src = src;
		images.set(src, img);
	}
	return images.get(src);
}

function cssFilter(fx, element) {
	const look = ELEMENT_LOOK[element];
	if (!look || element === 'none' || !fx) return 'none';
	if (fx.hue == null || look.hue == null) {
		if (element === 'physical') return 'none';
		return `sepia(1) saturate(2.5) hue-rotate(${(look.hue ?? 40) - 40}deg)`;
	}
	let f = `hue-rotate(${look.hue - fx.hue}deg)`;
	if (look.sat) f += ` saturate(${1 + look.sat})`;
	if (look.bright) f += ` brightness(${look.bright})`;
	return f;
}

class Preview {
	constructor(canvasEl) {
		this.el = canvasEl;
		this.ctx = canvasEl.getContext('2d');
		this.id = null;
		this.start = performance.now();
		this.raf = requestAnimationFrame(this.draw);
	}
	set(id, element) {
		if (id !== this.id) this.start = performance.now();
		this.id = id;
		this.element = element;
		this.el.style.filter = isProc(id) ? 'none' : cssFilter(FX[id] ?? JBFX[id], element);
		this.#video(id);
		if (isProc(id)) this.#startProc();
		else this.#stopProc();
	}

	/** Code-drawn effects preview in a tiny PIXI stage of their own */
	#startProc() {
		if (!this.app) {
			try {
				this.app = new PIXI.Application({ width: this.el.width, height: this.el.height, backgroundAlpha: 0, antialias: true });
			} catch {
				return;
			}
			this.app.view.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
			this.el.parentElement.style.position = 'relative';
			this.el.parentElement.append(this.app.view);
		}
		this.app.view.style.display = '';
		this.el.style.visibility = 'hidden';
		this.#loop();
	}

	#stopProc() {
		if (this.app) this.app.view.style.display = 'none';
		this.el.style.visibility = '';
		this.procRun = (this.procRun ?? 0) + 1;
	}

	async #loop() {
		const run = (this.procRun = (this.procRun ?? 0) + 1);
		while (run === this.procRun && this.app && !this.stopped) {
			const def = PROC[this.id];
			if (!def) return;
			const W = this.el.width;
			const box = new PIXI.Container();
			this.app.stage.addChild(box);
			const look = ELEMENT_LOOK[this.element];
			await def.run({
				g: W * 0.3,
				x: W * 0.62,
				y: W * 0.52,
				from: { x: W * 0.15, y: W * 0.72 },
				to: { x: W * 0.62, y: W * 0.52 },
				color: this.element && this.element !== 'none' && look ? look.color : def.color,
				add: (o) => box.addChild(o),
				tick: (fn) => this.app.ticker.add(fn),
				untick: (fn) => this.app.ticker.remove(fn),
			});
			box.destroy({ children: true });
			await new Promise((r) => setTimeout(r, 350));
		}
	}
	/** JB2A effects preview from their video */
	#video(id) {
		const fx = JBFX[id];
		if (!fx || !jbModule()) {
			if (this.vid) {
				this.vid.pause();
				this.vid.removeAttribute('src');
				this.vid = null;
			}
			return;
		}
		const file = fx.file ?? (fx.variants.find((x) => x.ft === 30) ?? fx.variants[0]).file;
		const url = `modules/${jbModule()}/${file}`;
		if (this.vid?.dataset.url === url) return;
		if (!this.vid) {
			this.vid = document.createElement('video');
			this.vid.muted = true;
			this.vid.loop = true;
			this.vid.playsInline = true;
		}
		this.vid.dataset.url = url;
		this.vid.src = url;
		this.vid.play().catch(() => {});
	}

	draw = () => {
		this.raf = requestAnimationFrame(this.draw);
		const { ctx, el } = this;
		ctx.clearRect(0, 0, el.width, el.height);
		if (isJb(this.id)) {
			const vd = this.vid;
			if (!vd || vd.readyState < 2) return;
			ctx.imageSmoothingEnabled = true;
			ctx.globalCompositeOperation = 'source-over';
			const s = Math.min(el.width / vd.videoWidth, el.height / vd.videoHeight) * (JBFX[this.id].mode === 'point' ? 0.95 : 1);
			const w = vd.videoWidth * s;
			const h = vd.videoHeight * s;
			ctx.drawImage(vd, (el.width - w) / 2, (el.height - h) / 2, w, h);
			return;
		}
		const fx = FX[this.id];
		if (!fx) return;
		const img = image(ROOT + fx.src);
		if (!img.complete || !img.naturalWidth) return;
		const dur = (fx.frames / fx.fps) * 1000 + 500;
		const t = (performance.now() - this.start) % dur;
		const i = Math.min(fx.frames - 1, Math.floor((t / 1000) * fx.fps));
		const c = i % fx.cols;
		const r = Math.floor(i / fx.cols);
		ctx.imageSmoothingEnabled = !fx.pixel;
		ctx.globalCompositeOperation = fx.blend === 'add' ? 'lighter' : 'source-over';
		const s = Math.min(el.width / fx.fw, el.height / fx.fh) * (fx.pixel ? 0.95 : 1.15);
		const w = fx.fw * s;
		const h = fx.fh * s;
		ctx.drawImage(img, c * fx.fw, r * fx.fh, fx.fw, fx.fh, (el.width - w) / 2, (el.height - h) / 2, w, h);
	};
	stop() {
		this.stopped = true;
		if (this.vid) {
			this.vid.pause();
			this.vid.removeAttribute('src');
			this.vid = null;
		}
		cancelAnimationFrame(this.raf);
		this.procRun = (this.procRun ?? 0) + 1;
		this.app?.destroy(true, { children: true });
		this.app = null;
	}
}

/* ------------------------------------------------------------------ */
/*  Editor: one item, or one ability for the whole world               */
/* ------------------------------------------------------------------ */

export class AnimationEditor extends ApplicationV2 {
	static DEFAULT_OPTIONS = {
		classes: ['fua-app', 'fua-editor'],
		window: { title: 'Animation', icon: 'fa-solid fa-wand-sparkles', resizable: true },
		position: { width: 560, height: 'auto' },
		actions: {
			playSound: AnimationEditor.#onPlaySound,
			pickPortrait: AnimationEditor.#onPickPortrait,
			clearPortrait: AnimationEditor.#onClearPortrait,
			previewCutin: AnimationEditor.#onPreviewCutin,
			save: AnimationEditor.#onSave,
			reset: AnimationEditor.#onReset,
			preview: AnimationEditor.#onPreview,
		},
	};

	/**
	 * @param {{item?: Item, fuid?: string}} target
	 */
	constructor(target, options = {}) {
		const key = target.item ? `item-${target.item.uuid}` : `fuid-${target.fuid}`;
		super({ ...options, id: `fua-editor-${key.replace(/[^a-zA-Z0-9-]/g, '-')}` });
		this.item = target.item ?? null;
		this.fuid = target.item ? abilityKey(target.item) : target.fuid;
		const entry = entryFor(this.fuid);
		this.name = this.item?.name ?? entry?.name ?? this.fuid;
		if (this.item) {
			const r = resolveSpec(this.item);
			this.source = r.source;
			this.spec = foundry.utils.deepClone(r.spec);
		} else {
			const w = worldOverrides()[this.fuid];
			this.source = w ? 'world' : 'default';
			this.spec = foundry.utils.deepClone(w ?? presetFor(this.fuid) ?? { style: 'none' });
		}
		this.scope = this.item ? (this.source === 'world' && game.user.isGM ? 'world' : 'item') : 'world';
		this.previews = [];
	}

	get title() {
		return `Animation: ${this.name}`;
	}

	static open(target) {
		if (target.item && !target.item.isOwner) return ui.notifications.warn('You can only change animations on items you own.');
		if (!target.item && !game.user.isGM) return ui.notifications.warn('Only the GM can change animations for everyone.');
		const app = new AnimationEditor(target);
		const existing = foundry.applications.instances.get(app.id);
		if (existing) return existing.render({ force: true });
		return app.render({ force: true });
	}

	get previewElement() {
		const el = this.spec.element ?? 'auto';
		if (el !== 'auto') return el;
		return this.item ? resolveElement(this.spec, null, this.item) : 'none';
	}

	async _renderHTML() {
		const s = this.spec;
		const canWorld = game.user.isGM && !!this.fuid;
		const div = document.createElement('div');
		div.className = 'fua-ed';
		const none = s.style === 'none';
		const auto = autoSounds(s, this.previewElement);
		div.innerHTML = `
			<header>
				<b>${esc(this.name)}</b>
				<small>${esc(SOURCE_TEXT[this.source] ?? '')}${['default', 'guess'].includes(this.source) ? ` (${esc(PRESETS[activePreset()])} preset).` : ''}</small>
			</header>
			<div class="grid">
				<label class="wide"><span>Style</span><select data-k="style">${opts(STYLES, s.style)}</select></label>
				<label ${none ? 'class="off"' : ''}><span>On the user first</span><select data-k="cast">${fxOptions(s.cast)}</select></label>
				<label ${none || s.style === 'self' ? 'class="off"' : ''}><span>Projectile</span><select data-k="projectile">${projOptions(s.projectile)}</select></label>
				<label ${none ? 'class="off"' : ''}><span>${s.style === 'self' ? 'On the user' : 'On each target'}</span><select data-k="hit">${fxOptions(s.hit)}</select></label>
				<label ${none ? 'class="off"' : ''}><span>Back on the user after</span><select data-k="after">${fxOptions(s.after)}</select></label>
				<label ${none ? 'class="off"' : ''}><span>Color</span><select data-k="element">${opts(ELEMENTS, s.element ?? 'auto')}</select></label>
				<label ${none ? 'class="off"' : ''}><span>Size <output>${Number(s.scale ?? 1).toFixed(1)}×</output></span><input type="range" data-k="scale" min="0.5" max="2.5" step="0.1" value="${s.scale ?? 1}"></label>
				<div class="snd ${none ? 'off' : ''}"><span>Sound on use</span><div class="row"><select data-k="castSound">${this.#soundOptions(s.castSound, auto.cast ?? auto.projectile)}</select><button type="button" class="play" data-action="playSound" data-which="cast" aria-label="Play the use sound" data-tooltip="Play">▶</button></div></div>
				<div class="snd ${none ? 'off' : ''}"><span>Sound on hit</span><div class="row"><select data-k="hitSound">${this.#soundOptions(s.hitSound, auto.hit)}</select><button type="button" class="play" data-action="playSound" data-which="hit" aria-label="Play the hit sound" data-tooltip="Play">▶</button></div></div>
			</div>
			<div class="previews ${none ? 'off' : ''}">
				<figure><div class="pv"><canvas width="150" height="150" data-prev="cast"></canvas></div><figcaption>On the user</figcaption></figure>
				<figure><div class="pv"><canvas width="150" height="150" data-prev="hit"></canvas></div><figcaption>${s.style === 'self' ? 'On the user' : 'On the target'}</figcaption></figure>
				<figure><div class="pv"><canvas width="150" height="150" data-prev="after"></canvas></div><figcaption>Back on the user</figcaption></figure>
			</div>
			${none ? '' : this.#impactHTML()}
			${
				this.item
					? `<fieldset class="scope"><legend>Save for</legend>
				<label><input type="radio" name="scope" value="item" ${this.scope === 'item' ? 'checked' : ''}> This item only</label>
				${canWorld ? `<label><input type="radio" name="scope" value="world" ${this.scope === 'world' ? 'checked' : ''}> Every “${esc(this.name)}” in this world</label>` : ''}
			</fieldset>`
					: `<p class="note">Applies to every character and NPC with ${esc(this.name)}, unless one of their items has its own animation.</p>`
			}
			<footer>
				<button type="button" data-action="preview" data-tooltip="Plays from your selected token at your targets">Preview on the scene</button>
				<label class="crit"><input type="checkbox" data-crit ${this.previewCrit ? 'checked' : ''}> as a critical</label>
				<span class="sp"></span>
				<button type="button" data-action="reset">Reset</button>
				<button type="button" data-action="save" class="gold">Save</button>
			</footer>`;
		return div;
	}

	/** What "automatic" means for this ability, before anyone's comfort settings */
	#feel(over = {}) {
		const offensive = ['melee', 'ranged', 'spell'].includes(this.spec.style);
		return feelOf({ spec: { ...this.spec, ...over }, offensive, element: this.previewElement, itemType: this.item?.type ?? (this.fuid && ABILITIES[this.fuid]?.group === 'Heroic Skills' ? 'heroic' : null), crit: false, targets: [{}] }, { targets: 1, ignoreSettings: true });
	}

	#impactHTML() {
		const imp = this.spec.impact ?? {};
		// auto text for each field comes from the level actually chosen, so "Automatic: Long" follows Heroic
		const f = this.#feel();
		const fAuto = this.#feel({ impact: { power: imp.power } });
		const field = (k) => {
			const def = IMPACT_FIELDS[k];
			const cur = imp[k] ?? '';
			const autoLabel = k === 'power' ? autoText('power', this.#feel({ impact: {} })) : autoText(k, fAuto);
			let html = `<option value="" ${cur === '' ? 'selected' : ''}>Automatic: ${esc(autoLabel)}</option>`;
			html += Object.entries(def.options).map(([v, l]) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('');
			const off = k === 'windup' && this.spec.style !== 'melee';
			return `<label class="${off ? 'off' : ''}"><span>${esc(def.label)}</span><select data-imp="${k}">${html}</select></label>`;
		};
		const showCut = f.cutin;
		const color = this.spec.cutinColor || `#${(f.color === 0xffd9a0 ? 0xf2c45a : f.color).toString(16).padStart(6, '0')}`;
		return `<fieldset class="impact"><legend>Impact</legend>
			<p class="hint">How hard it lands. Critical hits go one level up. Each player can still turn off shake, freeze, camera, darkening and cut-ins for themselves in the module settings.</p>
			<div class="grid3">
				${field('power')}${field('freeze')}${field('shake')}
				${field('camera')}${field('dim')}${field('windup')}
				${field('debris')}${field('scorch')}${field('cutin')}
			</div>
			<div class="cutin ${showCut ? '' : 'off'}">
				<label class="wide"><span>Cut-in title</span><input type="text" data-k="cutinText" value="${esc(this.spec.cutinText ?? '')}" placeholder="${esc(this.name)}"></label>
				<label><span>Color</span><input type="color" data-k="cutinColor" value="${esc(color)}"></label>
				<div class="por"><span>Portrait</span><div class="row">
					<img src="${esc(this.spec.cutinImg || this.item?.actor?.img || 'icons/svg/mystery-man.svg')}" alt="">
					<button type="button" data-action="pickPortrait">Choose</button>
					${this.spec.cutinImg ? '<button type="button" data-action="clearPortrait" data-tooltip="Use the character art">✕</button>' : ''}
					<button type="button" data-action="previewCutin">Preview</button>
				</div></div>
			</div>
		</fieldset>`;
	}

	static #onPickPortrait() {
		const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
		new FP({ type: 'image', current: this.spec.cutinImg || this.item?.actor?.img || '', callback: (path) => {
			this.spec.cutinImg = path;
			this.render();
		} }).render(true);
	}

	static #onClearPortrait() {
		delete this.spec.cutinImg;
		this.render();
	}

	static #onPreviewCutin() {
		const f = this.#feel();
		const hex = `#${(f.color === 0xffd9a0 ? 0xf2c45a : f.color).toString(16).padStart(6, '0')}`;
		const actor = this.item?.actor ?? canvas.tokens?.controlled?.[0]?.actor;
		// ignore the player's own cut-in switch here: they asked to see it
		cutIn({ name: this.spec.cutinText || this.name, user: actor?.name ?? '', img: this.spec.cutinImg || actor?.img, color: this.spec.cutinColor || hex, ms: 1300, force: true });
	}

	#soundOptions(selected, autoId) {
		let html = `<option value="" ${!selected ? 'selected' : ''}>Automatic${autoId ? `: ${esc(soundLabel(autoId))}` : ' (silent)'}</option>`;
		html += `<option value="none" ${selected === 'none' ? 'selected' : ''}>Silent</option>`;
		for (const [type, list] of soundGroups()) {
			html += `<optgroup label="${esc(type)}">${list.map(([id, label]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${esc(label)}</option>`).join('')}</optgroup>`;
		}
		return html;
	}

	static #onPlaySound(event, target) {
		const auto = autoSounds(this.spec, this.previewElement);
		const which = target.dataset.which;
		const own = which === 'cast' ? this.spec.castSound : this.spec.hitSound;
		const id = own === 'none' ? null : own || (which === 'cast' ? (auto.cast ?? auto.projectile) : auto.hit);
		if (!id) return ui.notifications.info('This one is silent.');
		playSound(id);
	}

	_replaceHTML(result, content) {
		for (const p of this.previews) p.stop();
		this.previews = [];
		content.replaceChildren(result);
	}

	_onRender() {
		const root = this.element;
		for (const c of root.querySelectorAll('canvas[data-prev]')) {
			const p = new Preview(c);
			p.key = c.dataset.prev;
			this.previews.push(p);
		}
		this.#syncPreviews();
		root.querySelectorAll('[data-k]').forEach((el) =>
			el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
				const k = el.dataset.k;
				let val = el.value;
				if (k === 'scale') {
					val = Number(val);
					el.closest('label').querySelector('output').textContent = `${val.toFixed(1)}×`;
				}
				if (val === '' || val == null) delete this.spec[k];
				else this.spec[k] = val;
				if (['style', 'cast', 'hit', 'projectile', 'element'].includes(k)) return this.render();
				if (['castSound', 'hitSound'].includes(k) && val) playSound(val);
				this.#syncPreviews();
			}),
		);
		root.querySelectorAll('[data-imp]').forEach((el) =>
			el.addEventListener('change', () => {
				const k = el.dataset.imp;
				const imp = { ...(this.spec.impact ?? {}) };
				if (el.value === '') delete imp[k];
				else imp[k] = el.value;
				if (Object.keys(imp).length) this.spec.impact = imp;
				else delete this.spec.impact;
				this.render();
			}),
		);
		root.querySelector('[data-crit]')?.addEventListener('change', (ev) => (this.previewCrit = ev.target.checked));
		root.querySelectorAll('input[name="scope"]').forEach((el) => el.addEventListener('change', () => (this.scope = el.value)));
	}

	#syncPreviews() {
		const el = this.previewElement;
		for (const p of this.previews) {
			const id = this.spec[p.key];
			const healing = FX[id]?.cat === 'Healing';
			p.set(id, p.key === 'after' ? (this.spec.afterElement ?? 'none') : healing && p.key === 'cast' ? 'none' : el);
		}
	}

	_onClose(options) {
		for (const p of this.previews) p.stop();
		this.previews = [];
		return super._onClose?.(options);
	}

	static async #onSave() {
		const spec = foundry.utils.deepClone(this.spec);
		if (this.item && this.scope === 'item') {
			await this.item.setFlag(MODULE_ID, 'spec', spec);
			ui.notifications.info(`Animation saved for this ${this.name}.`);
		} else {
			const all = foundry.utils.deepClone(worldOverrides());
			all[this.fuid] = spec;
			await game.settings.set(MODULE_ID, 'overrides', all);
			if (this.item?.getFlag(MODULE_ID, 'spec')) await this.item.unsetFlag(MODULE_ID, 'spec');
			ui.notifications.info(`Animation saved for every ${this.name}.`);
		}
		this.close();
		foundry.applications.instances.get('fua-library')?.render();
	}

	static async #onReset() {
		if (this.item && this.scope === 'item') {
			if (this.item.getFlag(MODULE_ID, 'spec')) await this.item.unsetFlag(MODULE_ID, 'spec');
			const r = resolveSpec(this.item);
			this.source = r.source;
			this.spec = foundry.utils.deepClone(r.spec);
		} else {
			const all = foundry.utils.deepClone(worldOverrides());
			if (this.fuid in all) {
				delete all[this.fuid];
				await game.settings.set(MODULE_ID, 'overrides', all);
			}
			this.source = 'default';
			this.spec = foundry.utils.deepClone(this.item ? defaultSpec(this.item) : (presetFor(this.fuid) ?? { style: 'none' }));
		}
		this.render();
		foundry.applications.instances.get('fua-library')?.render();
	}

	static #onPreview() {
		const src = canvas.tokens?.controlled?.[0] ?? this.item?.actor?.getActiveTokens?.(false, false)?.[0];
		if (!src) return ui.notifications.warn('Select a token on the scene to preview from.');
		const targets = [...game.user.targets].filter((t) => t.scene?.id === canvas.scene?.id || t.document?.parent?.id === canvas.scene?.id);
		const offensive = ['melee', 'ranged', 'spell'].includes(this.spec.style);
		runPlan({
			scene: canvas.scene.id,
			source: src.id,
			targets: targets.map((t) => ({ id: t.id, result: 'hit' })),
			spec: this.spec,
			element: this.previewElement,
			afterElement: this.spec.afterElement ?? 'none',
			offensive,
			crit: !!this.previewCrit,
			name: this.name,
			itemType: this.item?.type ?? (ABILITIES[this.fuid]?.group === 'Heroic Skills' ? 'heroic' : null),
			user: src.document?.name ?? src.actor?.name ?? '',
			portrait: src.actor?.img ?? null,
		});
		if (!targets.length && this.spec.style !== 'self') ui.notifications.info('Target a token to see the hit too.');
	}
}

/* ------------------------------------------------------------------ */
/*  Library: every ability in the compendium, grouped by class         */
/* ------------------------------------------------------------------ */

export class AnimationLibrary extends ApplicationV2 {
	static DEFAULT_OPTIONS = {
		id: 'fua-library',
		classes: ['fua-app'],
		window: { title: 'Ability animations', icon: 'fa-solid fa-wand-sparkles', resizable: true },
		position: { width: 760, height: 720 },
		actions: { edit: AnimationLibrary.#onEdit },
	};

	async _renderHTML() {
		const over = worldOverrides();
		const groups = {};
		for (const [fuid, a] of Object.entries(ABILITIES)) (groups[a.group] ??= []).push([fuid, a]);
		for (const [key, b] of Object.entries(BESTIARY)) (groups[`Bestiary: ${b.book}`] ??= []).push([`bst:${key}`, { ...b, kindLabel: key.split(':')[0] }]);
		const order = Object.keys(groups).sort((a, b) => a.startsWith('Bestiary') - b.startsWith('Bestiary') || (a === 'Heroic Skills') - (b === 'Heroic Skills') || (a === 'NPC Spells') - (b === 'NPC Spells') || (a === 'Items') - (b === 'Items') || a.localeCompare(b));
		const body = order
			.map((g) => {
				const rows = groups[g]
					.sort((a, b) => a[1].name.localeCompare(b[1].name))
					.map(([fuid, a]) => {
						const spec = over[fuid] ?? presetFor(fuid) ?? a.spec;
						const changed = !!over[fuid];
						return `<li data-search="${esc(`${a.name} ${g} ${describe(spec)}`.toLowerCase())}" class="${spec.style === 'none' ? 'none' : ''}">
							<span class="n">${esc(a.name)}${a.kindLabel ? `<small>${esc(a.kindLabel)}</small>` : ''}${changed ? '<em>changed</em>' : ''}</span>
							<span class="d">${esc(describe(spec))}</span>
							<button type="button" data-action="edit" data-fuid="${esc(fuid)}">Edit</button>
						</li>`;
					})
					.join('');
				return `<section data-group><h3>${esc(g)}</h3><ul>${rows}</ul></section>`;
			})
			.join('');
		const div = document.createElement('div');
		div.className = 'fua-lib';
		div.innerHTML = `
			<div class="top">
				<input type="search" placeholder="Search abilities, classes or effects" aria-label="Search">
				<label><input type="checkbox" data-hide-none> Hide abilities with no animation</label>
			</div>
			<p class="note">NPC attacks and spells from the bestiaries match by name, so an NPC you build with a book attack's name gets its animation. Weapons and any other NPC attack pick one from the weapon category and damage type. Change a single item from the Animation button in its sheet's header.</p>
			<div class="list">${body}</div>`;
		return div;
	}

	_replaceHTML(result, content) {
		const q = content.querySelector('input[type="search"]')?.value ?? '';
		const hide = content.querySelector('[data-hide-none]')?.checked ?? false;
		const scroll = content.querySelector('.list')?.scrollTop ?? 0;
		content.replaceChildren(result);
		result.querySelector('input[type="search"]').value = q;
		result.querySelector('[data-hide-none]').checked = hide;
		this.#filter(result);
		result.querySelector('.list').scrollTop = scroll;
	}

	_onRender() {
		const root = this.element;
		root.querySelector('input[type="search"]')?.addEventListener('input', () => this.#filter(root));
		root.querySelector('[data-hide-none]')?.addEventListener('change', () => this.#filter(root));
	}

	#filter(root) {
		const q = root.querySelector('input[type="search"]').value.trim().toLowerCase();
		const hide = root.querySelector('[data-hide-none]').checked;
		for (const sec of root.querySelectorAll('[data-group]')) {
			let any = false;
			for (const li of sec.querySelectorAll('li')) {
				const show = (!q || li.dataset.search.includes(q)) && !(hide && li.classList.contains('none'));
				li.hidden = !show;
				any ||= show;
			}
			sec.hidden = !any;
		}
	}

	static #onEdit(event, target) {
		AnimationEditor.open({ fuid: target.dataset.fuid });
	}
}

