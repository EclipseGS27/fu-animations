import { ABILITIES, BESTIARY, ELEMENTS, ELEMENT_LOOK, MODULE_ID, PRESETS, ACTIONS, STYLES, WEAPON_CATEGORIES, abilityKey, bossOf, isHexColor, itemKind, weaponOne, activePreset, defaultFor, defaultSpec, describe, entryFor, fxGroups, fxLabel, presetFor, projectileGroups, resolveSpec, weaponKey, worldOverrides } from './presets.mjs';
import { JBFX, isJb, jbModule } from './jbcore.mjs';
import { resolveElement, runPlan } from './sequence.mjs';
import { autoSounds, playSound, soundGroups, soundLabel } from './audio.mjs';
import { IMPACT_FIELDS, autoText, feelOf } from './feel.mjs';
import { cutIn } from './impact.mjs';
import { PIXEL, PixelPreview, isPixel, pixelDuration } from './pixel.mjs';
import { ELEMENT_HIT, ZERO_EFFECTS, ZERO_STAGES, stageField, stageOf, zeroKeyOf, zeroTypesOf } from './zero.mjs';

const { ApplicationV2 } = foundry.applications.api;

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const SOURCE_TEXT = {
	item: 'This item has its own animation.',
	world: 'Using the world choice for this ability.',
	category: 'Using the world choice for this kind of weapon.',
	default: 'Using the built-in animation for this ability',
	guess: 'Picked automatically from the item',
};

const opts = (map, selected) => Object.entries(map).map(([k, l]) => `<option value="${k}" ${k === (selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');

/* ------------------------------------------------------------------ */
/*  Small looping preview of one effect, drawn on a 2D canvas          */
/* ------------------------------------------------------------------ */

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

/* JB2A clips are big videos served by Foundry: keep the few in use instead of fetching them again on every
   re-render, and remember still frames so the picker opens instantly the second time. */
const VIDEOS = new Map(); // url -> <video>, most recent last
const STILLS = new Map(); // "id|element" (pixel) or "id" (JB2A) -> small canvas
const MAX_VIDEOS = 6;

function jbUrl(id) {
	const fx = JBFX[id];
	if (!fx || !jbModule()) return null;
	const file = fx.file ?? (fx.variants.find((x) => x.ft === 30) ?? fx.variants[0]).file;
	return `modules/${jbModule()}/${file}`;
}

/** A looping muted video for a JB2A clip, shared between the editor's previews */
function pooledVideo(url) {
	let v = VIDEOS.get(url);
	if (v) VIDEOS.delete(url);
	else v = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, preload: 'auto', src: url });
	VIDEOS.set(url, v);
	while (VIDEOS.size > MAX_VIDEOS) {
		const [old, ov] = VIDEOS.entries().next().value;
		VIDEOS.delete(old);
		ov.pause();
		ov.removeAttribute('src');
		ov.load();
	}
	return v;
}

function copyCanvas(src) {
	const c = document.createElement('canvas');
	c.width = src.width;
	c.height = src.height;
	c.getContext('2d').drawImage(src, 0, 0);
	return c;
}

const once = (el, ev, ms = 8000) =>
	new Promise((res, rej) => {
		const t = setTimeout(() => rej(new Error('timeout')), ms);
		el.addEventListener(ev, () => (clearTimeout(t), res()), { once: true });
		el.addEventListener('error', () => (clearTimeout(t), rej(new Error('error'))), { once: true });
	});

/** One frame of a JB2A clip (around where it hits), loaded once and kept */
async function jbStill(id, size) {
	if (STILLS.has(id)) return STILLS.get(id);
	const url = jbUrl(id);
	if (!url) return null;
	const v = Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto', src: url });
	try {
		await once(v, 'loadeddata');
		const fx = JBFX[id];
		v.currentTime = Math.max(0, (v.duration || (fx.dur ?? 1000) / 1000) * (fx.hitAt ?? 0.45));
		await once(v, 'seeked');
		const c = document.createElement('canvas');
		c.width = c.height = size;
		const k = Math.min(size / v.videoWidth, size / v.videoHeight) * (fx.mode === 'point' ? 0.95 : 1);
		const w = v.videoWidth * k;
		const h = v.videoHeight * k;
		c.getContext('2d').drawImage(v, (size - w) / 2, (size - h) / 2, w, h);
		STILLS.set(id, c);
		return c;
	} catch {
		return null;
	} finally {
		v.removeAttribute('src');
		v.load();
	}
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
		this.el.style.filter = !id ? 'none' : isPixel(id) ? (PIXEL[id].ramp ? 'none' : cssFilter(PIXEL[id], element)) : cssFilter(JBFX[id], element);
		if (isPixel(id)) {
			this.pixel ??= new PixelPreview(this.el);
			this.pixel.set(id, element);
		}
		this.#video(id);
	}

	/** JB2A effects preview from their video (shared, so a re-render doesn't download it again) */
	#video(id) {
		const url = isJb(id) ? jbUrl(id) : null;
		if (!url) {
			this.vid?.pause();
			this.vid = null;
			return;
		}
		if (this.vid?.dataset.url === url) return;
		this.vid = pooledVideo(url);
		this.vid.dataset.url = url;
		this.vid.play().catch(() => {});
	}

	draw = () => {
		this.raf = requestAnimationFrame(this.draw);
		if (!this.id || document.hidden) return;
		const { ctx, el } = this;
		if (isPixel(this.id)) {
			const t = performance.now();
			const dt = this.lastPixel ? (t - this.lastPixel) / 1000 : 1 / 60;
			this.lastPixel = t;
			this.pixel?.frame(dt);
			return;
		}
		ctx.clearRect(0, 0, el.width, el.height);
		if (isJb(this.id)) {
			const vd = this.vid;
			if (!vd || vd.readyState < 2) {
				// while the clip loads, show its still if the picker made one
				const st = STILLS.get(this.id);
				if (st) ctx.drawImage(st, 0, 0, el.width, el.height);
				return;
			}
			ctx.imageSmoothingEnabled = true;
			ctx.globalCompositeOperation = 'source-over';
			const s = Math.min(el.width / vd.videoWidth, el.height / vd.videoHeight) * (JBFX[this.id].mode === 'point' ? 0.95 : 1);
			const w = vd.videoWidth * s;
			const h = vd.videoHeight * s;
			ctx.drawImage(vd, (el.width - w) / 2, (el.height - h) / 2, w, h);
		}
	};
	stop() {
		this.stopped = true;
		// pooled videos stay loaded for the next render; only pause them
		this.vid?.pause();
		this.vid = null;
		cancelAnimationFrame(this.raf);
	}
}

/* ------------------------------------------------------------------ */
/*  Editor: one item, or one ability for the whole world               */
/* ------------------------------------------------------------------ */

export class AnimationEditor extends ApplicationV2 {
	static DEFAULT_OPTIONS = {
		classes: ['fua-app', 'fua-editor'],
		window: { title: 'Animation', icon: 'fa-solid fa-wand-sparkles', resizable: true },
		position: { width: 620, height: 'auto' },
		actions: {
			playSound: AnimationEditor.#onPlaySound,
			pick: AnimationEditor.#onPick,
			pickZero: AnimationEditor.#onPickZero,
			resetZero: AnimationEditor.#onResetZero,
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
		/** a weapon's category entry ("wpn:sword"), for "every sword in this world" */
		this.catKey = target.item ? weaponKey(target.item) : null;
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
		this.scope = this.item ? (['world', 'category'].includes(this.source) && game.user.isGM ? this.source : 'item') : 'world';
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
		const self = s.style === 'self';
		const slots = [
			['cast', 'On the user first'],
			...(self ? [] : [['projectile', 'Projectile']]),
			['hit', self ? 'On the user' : 'On each target'],
			['after', 'Back on the user'],
		];
		const scopes = this.item
			? [
					['item', 'This item'],
					...(canWorld ? [['world', `Every “${this.name}”`]] : []),
					...(game.user.isGM && this.catKey ? [['category', `Every ${weaponOne(this.catKey)}`]] : []),
				]
			: [];
		const colorKey = isHexColor(s.element) ? 'custom' : (s.element ?? 'auto');
		div.innerHTML = `
			<header>
				<div class="ttl">
					<b>${esc(this.name)}</b>
					<small>${esc(SOURCE_TEXT[this.source] ?? '')}${['default', 'guess'].includes(this.source) ? ` (${esc(PRESETS[activePreset()])} preset).` : ''}</small>
				</div>
				<label class="style"><span>Style</span><select data-k="style">${opts(STYLES, s.style)}</select></label>
			</header>
			${none ? '' : this.#isLimit() ? this.#limitHTML() : ''}
			${
				none
					? '<p class="empty">No animation. Pick a style to give it one.</p>'
					: `${this.#zeroKey() ? '' : `<section class="slots n${slots.length}">${slots.map(([f, l]) => this.#slot(f, l)).join('')}</section>
			<p class="hint">Click a box to choose its effect. Each one loops here as it will play.</p>`}
			<div class="row ${this.#zeroKey() ? 'zsize' : ''}">
				<div class="fld colorpick"><span>Color</span><div class="in"><select data-k="element" aria-label="Color">${opts({ ...ELEMENTS, custom: 'Custom color…' }, colorKey)}</select>${isHexColor(s.element) ? `<input type="color" data-k="elementColor" value="${esc(s.element)}" aria-label="Custom color" data-tooltip="Any color: recolors this animation in every preset, JB2A Free included">` : ''}</div></div>
				<label class="fld size"><span>Size <output>${Number(s.scale ?? 1).toFixed(1)}×</output></span><input type="range" data-k="scale" min="0.5" max="2.5" step="0.1" value="${s.scale ?? 1}"></label>
			</div>
			<div class="row ${this.#zeroKey() ? 'hide' : ''}">
				<div class="fld"><span>Sound on use</span><div class="in"><select data-k="castSound">${this.#soundOptions(s.castSound, auto.cast ?? auto.projectile)}</select><button type="button" class="play" data-action="playSound" data-which="cast" aria-label="Play the use sound" data-tooltip="Play">▶</button></div></div>
				<div class="fld"><span>Sound on hit</span><div class="in"><select data-k="hitSound">${this.#soundOptions(s.hitSound, auto.hit)}</select><button type="button" class="play" data-action="playSound" data-which="hit" aria-label="Play the hit sound" data-tooltip="Play">▶</button></div></div>
			</div>
			${this.#impactHTML()}`
			}
			${
				scopes.length > 1
					? `<div class="scope" role="radiogroup" aria-label="Save for"><span>Save for</span>${scopes.map(([v, l]) => `<label class="${this.scope === v ? 'on' : ''}"><input type="radio" name="scope" value="${v}" ${this.scope === v ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div>`
					: this.item
						? ''
						: `<p class="note">${
								this.fuid?.startsWith('wpn:')
									? `Applies to every ${esc(weaponOne(this.fuid))} in this world, unless that weapon has its own animation (or one set for its name).`
									: `Applies to every character and NPC with ${esc(this.name)}, unless one of their items has its own animation.`
							}</p>`
			}
			<footer>
				<button type="button" data-action="preview" data-tooltip="Plays from your selected token at your targets"><i class="fa-solid fa-play"></i> Try on the scene</button>
				<label class="crit"><input type="checkbox" data-crit ${this.previewCrit ? 'checked' : ''}> as a critical</label>
				<span class="sp"></span>
				<button type="button" data-action="reset">Reset</button>
				<button type="button" data-action="save" class="gold">Save</button>
			</footer>`;
		return div;
	}

	/** An effect slot: a live preview of the choice; click it for the grid picker */
	#slot(field, label) {
		const id = this.spec[field];
		const name = id ? fxLabel(id) : 'None';
		return `<button type="button" class="slot ${id ? '' : 'empty'}" data-action="pick" data-field="${field}" aria-label="${esc(label)}: ${esc(name)}. Choose">
			<span class="pv"><canvas width="150" height="150" data-prev="${field}"></canvas>${id ? '' : '<i class="fa-solid fa-plus"></i>'}</span>
			<small>${esc(label)}</small><b>${esc(name)}</b>
		</button>`;
	}

	static #onPick(event, target) {
		const field = target.dataset.field;
		const labels = { cast: 'on the user first', projectile: 'projectile', hit: 'on the target', after: 'back on the user' };
		EffectPicker.open({
			title: `${this.name}: ${labels[field]}`,
			current: this.spec[field] ?? '',
			element: field === 'after' ? (this.spec.afterElement ?? 'none') : this.previewElement,
			groups: field === 'projectile' ? projectileGroups() : fxGroups(),
			near: this,
			onPick: (id) => {
				if (id) this.spec[field] = id;
				else delete this.spec[field];
				this.render();
			},
		});
	}

	/** What "automatic" means for this ability, before anyone's comfort settings */
	#feel(over = {}) {
		const offensive = ['melee', 'ranged', 'spell'].includes(this.spec.style);
		return feelOf({ spec: { ...this.spec, ...over }, offensive, element: this.previewElement, itemType: itemKind(this.item) ?? (this.fuid && ABILITIES[this.fuid]?.group === 'Heroic Skills' ? 'heroic' : null), crit: false, targets: [{}] }, { targets: 1, ignoreSettings: true, ignoreBoss: true });
	}

	/** A limit break: a Zero Power, or anything set to the Limit break impact level */
	#isLimit() {
		return itemKind(this.item) === 'zeroPower' || this.#feel().base === 'ultimate';
	}

	/** The Zero Power scene that will play, or null for the general limit break */
	#zeroKey() {
		if (!this.#isLimit()) return null;
		const pick = this.spec.zero ?? 'auto';
		if (pick === 'generic') return null;
		if (ZERO_EFFECTS[pick]) return pick;
		const found = this.item ? zeroKeyOf(this.item) : null;
		return found;
	}

	/** The effect a stage card shows: the player's, else the scene's (Elements' main follows its first element) */
	#stageId(key, st) {
		const id = stageOf(this.spec, key, st);
		if (id === 'auto') return ELEMENT_HIT[(this.item ? zeroTypesOf(this.item) : [])[0] ?? 'fire'];
		return id;
	}

	/** Limit break: which scene, its color, and its three stages, each a live preview to click and change */
	#limitHTML() {
		const found = this.item ? zeroKeyOf(this.item) : null;
		const key = this.#zeroKey();
		const cur = this.spec.zero ?? 'auto';
		const o = (v, l) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`;
		const z = key ? ZERO_EFFECTS[key] : null;
		const color = this.spec.zeroColor;
		const sceneHex = z ? `#${z.color.toString(16).padStart(6, '0')}` : '#ffffff';
		const cards = z
			? ZERO_STAGES.map((st) => {
					const field = stageField(st);
					const id = this.#stageId(key, st);
					const own = this.spec[field];
					const name = own === 'none' ? 'None' : id ? fxLabel(id) : 'None';
					return `<div class="zcard"><button type="button" class="slot ${id ? '' : 'empty'}" data-action="pickZero" data-stage="${st}" aria-label="${esc(z.roles[st])}: ${esc(name)}. Choose">
						<span class="pv"><canvas width="150" height="150" data-prev="${field}"></canvas>${id ? '' : '<i class="fa-solid fa-plus"></i>'}</span>
						<small>${esc(st)}</small><b>${esc(name)}</b><em>${esc(z.roles[st])}</em>
					</button>${own ? `<button type="button" class="zreset" data-action="resetZero" data-stage="${st}" data-tooltip="Back to the scene's own">↺</button>` : ''}</div>`;
				}).join('')
			: '';
		return `<section class="limit">
			<div class="row">
				<label class="fld"><span>Limit break scene</span><select data-k="zero">${o('auto', `Automatic: ${found ? ZERO_EFFECTS[found].label : 'general limit break'}`)}${Object.entries(ZERO_EFFECTS)
					.map(([k, x]) => o(k, x.label))
					.join('')}${o('generic', 'General limit break (the effects below)')}</select></label>
				${z ? `<div class="fld colorpick"><span>Color</span><div class="in"><select data-k="zeroColorMode" aria-label="Color"><option value="" ${color ? '' : 'selected'}>Scene colors</option><option value="custom" ${color ? 'selected' : ''}>Custom color…</option></select>${color ? `<input type="color" data-k="zeroColor" value="${esc(color)}" aria-label="Custom color">` : ''}</div></div>` : ''}
			</div>
			${z ? `<section class="slots n3 zero">${cards}</section><p class="hint">${esc(z.label)}: click a stage to choose any effect for it (or None). The scene keeps its own motion and timing; Size and the Impact settings below still apply.</p>` : ''}
		</section>`;
	}

	static #onPickZero(event, target) {
		const key = this.#zeroKey();
		if (!key) return;
		const st = target.dataset.stage;
		const field = stageField(st);
		EffectPicker.open({
			title: `${this.name}: ${ZERO_EFFECTS[key].roles[st]}`,
			current: this.#stageId(key, st) ?? '',
			element: this.spec.zeroColor || 'none',
			groups: fxGroups(),
			near: this,
			onPick: (id) => {
				this.spec[field] = id || 'none';
				this.render();
			},
		});
	}

	static #onResetZero(event, target) {
		delete this.spec[stageField(target.dataset.stage)];
		this.render();
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
		const custom = Object.keys(imp).length;
		return `<details class="impact" ${this.impactOpen ? 'open' : ''}><summary><b>Impact</b><span>${esc(IMPACT_FIELDS.power.options[imp.power] ?? `Automatic: ${autoText('power', this.#feel({ impact: {} }))}`)}${custom ? ` · ${custom} changed` : ''}</span></summary>
			<p class="hint">How hard it lands: freeze, shake, camera, darkening, debris and a cut-in for big moves. Critical hits go one level up. Each player can turn these off for themselves in the module settings.</p>
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
		</details>`;
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
		// keep the scroll position: most changes re-draw the window
		const top = content.scrollTop;
		content.replaceChildren(result);
		content.scrollTop = top;
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
			el.addEventListener(['range', 'color'].includes(el.type) ? 'input' : 'change', () => {
				let k = el.dataset.k;
				let val = el.value;
				// custom color: the picker's hex code is the "element" every recolor reads
				if (k === 'element' && val === 'custom') val = this.#customStart();
				if (k === 'elementColor') {
					k = 'element';
					this.spec.element = val;
					return this.#syncPreviews();
				}
				if (k === 'zeroColorMode') {
					if (val === 'custom') this.spec.zeroColor = `#${(ZERO_EFFECTS[this.#zeroKey()]?.color ?? 0xffffff).toString(16).padStart(6, '0')}`;
					else delete this.spec.zeroColor;
					return this.render();
				}
				if (k === 'zeroColor') {
					this.spec.zeroColor = val;
					return this.#syncPreviews();
				}
				if (k === 'scale') {
					val = Number(val);
					el.closest('label').querySelector('output').textContent = `${val.toFixed(1)}×`;
				}
				if (val === '' || val == null) delete this.spec[k];
				else this.spec[k] = val;
				if (['style', 'cast', 'hit', 'projectile', 'element', 'zero'].includes(k)) return this.render();
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
		root.querySelectorAll('input[name="scope"]').forEach((el) =>
			el.addEventListener('change', () => {
				this.scope = el.value;
				root.querySelectorAll('.scope label').forEach((l) => l.classList.toggle('on', l.contains(el)));
			}),
		);
		root.querySelector('details.impact')?.addEventListener('toggle', (ev) => (this.impactOpen = ev.target.open));
	}

	/** Where the color picker starts: the color the animation shows now */
	#customStart() {
		const el = this.previewElement;
		const look = ELEMENT_LOOK[el] ?? ELEMENT_LOOK.none;
		return `#${(el === 'none' || el === 'auto' ? 0xff4fa3 : look.color).toString(16).padStart(6, '0')}`;
	}

	#syncPreviews() {
		const el = this.previewElement;
		const zk = this.#zeroKey();
		for (const p of this.previews) {
			const st = ZERO_STAGES.find((x) => stageField(x) === p.key);
			if (st) {
				p.set(zk ? this.#stageId(zk, st) : null, this.spec.zeroColor || 'none');
				continue;
			}
			const id = this.spec[p.key];
			p.set(id, p.key === 'after' ? (this.spec.afterElement ?? 'none') : el);
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
		} else if (this.item && this.scope === 'category' && this.catKey) {
			const all = foundry.utils.deepClone(worldOverrides());
			all[this.catKey] = spec;
			await game.settings.set(MODULE_ID, 'overrides', all);
			if (this.item.getFlag(MODULE_ID, 'spec')) await this.item.unsetFlag(MODULE_ID, 'spec');
			ui.notifications.info(`Animation saved for every ${weaponOne(this.catKey)}.`);
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
		} else if (this.item && this.scope === 'category' && this.catKey) {
			const all = foundry.utils.deepClone(worldOverrides());
			if (this.catKey in all) {
				delete all[this.catKey];
				await game.settings.set(MODULE_ID, 'overrides', all);
			}
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
			itemType: itemKind(this.item) ?? (ABILITIES[this.fuid]?.group === 'Heroic Skills' ? 'heroic' : null),
			zero: this.item ? zeroKeyOf(this.item) : null,
			zeroTypes: this.item ? zeroTypesOf(this.item) : [],
			boss: bossOf(src.actor),
			user: src.document?.name ?? src.actor?.name ?? '',
			portrait: src.actor?.img ?? null,
		});
		if (!targets.length && this.spec.style !== 'self') ui.notifications.info('Target a token to see the hit too.');
	}
}

/* ------------------------------------------------------------------ */
/*  Effect picker: every effect as a tile, still until you hover it     */
/* ------------------------------------------------------------------ */

/** One tile's preview: a still frame (kept between picker opens), played on hover */
class Tile {
	constructor(el, id, element) {
		this.el = el;
		this.id = id;
		this.element = element;
		this.canvas = el.querySelector('canvas');
	}
	#paint(src) {
		const ctx = this.canvas.getContext('2d');
		ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		ctx.drawImage(src, 0, 0, this.canvas.width, this.canvas.height);
	}
	/** a frame from the middle of the effect, drawn once */
	still() {
		if (this.drawn || !isPixel(this.id)) return;
		this.drawn = true;
		this.canvas.style.filter = PIXEL[this.id].ramp ? 'none' : cssFilter(PIXEL[this.id], this.element);
		const key = `${this.id}|${this.element}`;
		const kept = STILLS.get(key);
		if (kept) return this.#paint(kept);
		this.px = new PixelPreview(this.canvas);
		this.px.set(this.id, this.element);
		// projectiles are caught mid-flight, the rest around their peak
		const at = PIXEL[this.id].proj || PIXEL[this.id].line ? 0.6 : 0.45;
		const steps = Math.round(Math.min(1.4, (pixelDuration(this.id) / 1000) * at) * 30);
		for (let i = 0; i < steps; i++) this.px.frame(1 / 30);
		STILLS.set(key, copyCanvas(this.canvas));
	}
	/** JB2A: one frame from its video, fetched in the background */
	async jbStill() {
		if (this.drawn || !isJb(this.id)) return;
		this.drawn = true;
		this.canvas.style.filter = cssFilter(JBFX[this.id], this.element);
		const st = await jbStill(this.id, this.canvas.width);
		if (st && !this.vid) this.#paint(st);
	}
	get kind() {
		return isPixel(this.id) ? 'pixel' : isJb(this.id) && jbModule() ? 'jb' : null;
	}
	play() {
		if (isPixel(this.id)) {
			this.still();
			this.px ??= new PixelPreview(this.canvas);
			this.px.set(this.id, this.element);
			let last = performance.now();
			const loop = (t) => {
				this.raf = requestAnimationFrame(loop);
				this.px.frame(Math.min(0.05, (t - last) / 1000));
				last = t;
			};
			this.raf = requestAnimationFrame(loop);
		} else if (this.kind === 'jb') {
			if (!this.vid) {
				this.vid = Object.assign(document.createElement('video'), { muted: true, loop: true, playsInline: true, preload: 'auto', src: jbUrl(this.id) });
				this.vid.style.filter = cssFilter(JBFX[this.id], this.element);
				// keep the still showing until the clip can play
				this.vid.addEventListener(
					'playing',
					() => {
						this.vid.classList.remove('loading');
						if (this.canvas.isConnected) this.canvas.replaceWith(this.vid);
					},
					{ once: true },
				);
				this.canvas.after(this.vid);
				this.vid.classList.add('loading');
			}
			this.el.classList.add('busy');
			this.vid.addEventListener('playing', () => this.el.classList.remove('busy'), { once: true });
			this.vid.play().catch(() => {});
		}
	}
	stop() {
		cancelAnimationFrame(this.raf);
		this.vid?.pause();
		this.el.classList.remove('busy');
	}
	destroy() {
		this.stop();
		if (this.vid) {
			this.vid.removeAttribute('src');
			this.vid.load();
		}
	}
}

export class EffectPicker extends ApplicationV2 {
	static DEFAULT_OPTIONS = {
		id: 'fua-picker',
		classes: ['fua-app', 'fua-picker'],
		window: { title: 'Pick an effect', icon: 'fa-solid fa-table-cells-large', resizable: true },
		position: { width: 760, height: 660 },
	};

	/** @param {{title:string, current:string, element:string, groups:Array, onPick:Function, near?:ApplicationV2}} opts */
	static open(opts) {
		foundry.applications.instances.get('fua-picker')?.close();
		const app = new EffectPicker(opts);
		const n = opts.near?.position;
		const pos = {};
		if (n && n.left + n.width + 770 < window.innerWidth) Object.assign(pos, { left: n.left + n.width + 8, top: n.top });
		return app.render({ force: true, position: pos });
	}

	constructor(opts) {
		super({ window: { title: opts.title } });
		this.opts = opts;
		this.tiles = [];
		this.cat = 'all';
	}

	async _renderHTML() {
		const { groups, current } = this.opts;
		const div = document.createElement('div');
		div.className = 'fua-pick';
		const tile = (id, label, cat) =>
			`<button type="button" class="tile ${id === current ? 'on' : ''}" data-id="${esc(id)}" data-cat="${esc(cat)}" data-search="${esc(`${label} ${cat}`.toLowerCase())}" title="${esc(label)}"><span class="pv">${id ? '<canvas width="120" height="120"></canvas>' : '<i class="fa-solid fa-ban"></i>'}${isJb(id) ? '<em>JB2A</em>' : ''}</span><span class="nm">${esc(label)}</span></button>`;
		div.innerHTML = `
			<div class="top">
				<input type="search" placeholder="Search effects" aria-label="Search effects">
				<div class="chips"><button type="button" class="chip on" data-cat="all">All</button>${groups.map(([cat]) => `<button type="button" class="chip" data-cat="${esc(cat)}">${esc(cat.replace(/^Pixel /, ''))}</button>`).join('')}</div>
			</div>
			<div class="grid-wrap">
				<section data-cat="none"><div class="tiles">${tile('', 'None', 'none')}</div></section>
				${groups.map(([cat, list]) => `<section data-cat="${esc(cat)}"><h4>${esc(cat)}</h4><div class="tiles">${list.map(([id, label]) => tile(id, label, cat)).join('')}</div></section>`).join('')}
			</div>
			<p class="note">Hover a tile to play it, click to choose. Colors follow the animation's color setting.</p>`;
		return div;
	}

	_replaceHTML(result, content) {
		this.#teardown();
		content.replaceChildren(result);
	}

	_onRender() {
		const root = this.element;
		this.closing = false;
		const search = root.querySelector('input[type="search"]');
		const filter = () => {
			const q = search.value.trim().toLowerCase();
			for (const sec of root.querySelectorAll('section[data-cat]')) {
				let any = false;
				for (const t of sec.querySelectorAll('.tile')) {
					const show = (this.cat === 'all' || t.dataset.cat === this.cat || t.dataset.cat === 'none') && (!q || t.dataset.search.includes(q));
					t.hidden = !show;
					any ||= show;
				}
				sec.hidden = !any;
			}
		};
		search.addEventListener('input', filter);
		root.querySelectorAll('.chip').forEach((c) =>
			c.addEventListener('click', () => {
				this.cat = c.dataset.cat;
				root.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === c));
				filter();
			}),
		);
		// still frames for the tiles that scroll into view: pixel ones one per tick so the window stays
		// responsive, JB2A ones three videos at a time
		const pixelQ = [];
		const jbQ = [];
		let busy = false;
		let jbBusy = 0;
		const pump = () => {
			if (!busy && pixelQ.length) {
				busy = true;
				const step = () => {
					const t = pixelQ.shift();
					if (!t || this.closing) return (busy = false);
					t.still();
					setTimeout(step, 0);
				};
				step();
			}
			while (jbBusy < 3 && jbQ.length && !this.closing) {
				const t = jbQ.shift();
				jbBusy++;
				t.jbStill().finally(() => {
					jbBusy--;
					pump();
				});
			}
		};
		this.io = new IntersectionObserver((entries) => {
			for (const e of entries) if (e.isIntersecting) {
				const t = e.target._tile;
				(t.kind === 'jb' ? jbQ : pixelQ).push(t);
				this.io.unobserve(e.target);
			}
			pump();
		}, { root: root.querySelector('.grid-wrap'), rootMargin: '160px' });
		for (const el of root.querySelectorAll('.tile')) {
			const id = el.dataset.id;
			if (id) {
				el._tile = new Tile(el, id, this.opts.element);
				this.tiles.push(el._tile);
				if (el._tile.kind) this.io.observe(el);
				el.addEventListener('mouseenter', () => el._tile.play());
				el.addEventListener('mouseleave', () => el._tile.stop());
			}
			el.addEventListener('click', () => {
				this.opts.onPick(id);
				this.close();
			});
		}
		root.querySelector('.tile.on')?.scrollIntoView({ block: 'center' });
		search.focus();
	}

	#teardown() {
		this.closing = true;
		this.io?.disconnect();
		for (const t of this.tiles) t.destroy();
		this.tiles = [];
	}

	_onClose(options) {
		this.#teardown();
		return super._onClose?.(options);
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
		for (const id of Object.keys(ACTIONS)) (groups.Actions ??= []).push([`act:${id}`, { name: ACTIONS[id].name, spec: defaultFor(`act:${id}`) }]);
		// one entry per kind of weapon: every sword, every bow... unless a weapon has its own
		for (const cat of Object.keys(WEAPON_CATEGORIES)) {
			const key = `wpn:${cat}`;
			(groups.Weapons ??= []).push([key, { name: entryFor(key).name, spec: defaultFor(key) }]);
		}
		const late = (g) => (g.startsWith('Bestiary') ? 5 : g === 'Heroic Skills' ? 4 : g === 'NPC Spells' ? 3 : g === 'Weapons' ? 2 : g === 'Actions' ? 1.5 : g === 'Items' ? 1 : 0);
		const order = Object.keys(groups).sort((a, b) => late(a) - late(b) || a.localeCompare(b));
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
			<p class="note">NPC attacks and spells from the bestiaries match by name, so an NPC you build with a book attack's name gets its animation. Weapons pick one from their category and damage type; set one for every weapon of a kind under Weapons. Any other NPC attack is guessed from its name and damage type. Change a single item from the Animation button in its sheet's header.</p>
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

