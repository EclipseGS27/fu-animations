import { ELEMENT_RAMPS, PIXEL, isPixel } from './pixelfx.mjs';
import { now } from './clock.mjs';
import { getLayer, userScale } from './player.mjs';
import { bayer, hex, resample } from './sf/kit.mjs';

/**
 * Playing pixel effects (pixelfx.mjs) on the Foundry canvas.
 *
 * Each play gets its own little pixel world: the target sits at a fixed spot, the effect draws into four
 * buffers of art pixels (color and light, behind the tokens and in front of them), and every frame those are
 * uploaded as textures and scaled up without smoothing. One art pixel is 1/36 of a grid square at effect
 * size 1 (bigger tokens and bigger moves get bigger pixels, like the sprite effects).
 * The clock is the module's freezable clock, so a hit freeze holds the pixels too.
 */

export const ART_PER_GRID = 36;
const PX = 2; // Sprite Fusion world units per art pixel
const ORIGIN = 4096; // art pixel where the target sits

/* ------------------------------------------------------------------ */
/*  Layers                                                             */
/* ------------------------------------------------------------------ */

let backLayer = null;

/** Behind the tokens, above the tiles: the "back" half of each effect */
function behind() {
	if (backLayer && !backLayer.destroyed && backLayer.parent) return backLayer;
	backLayer = new PIXI.Container();
	backLayer.name = 'fu-animations-pixel-back';
	backLayer.eventMode = 'none';
	const ground = canvas.primary;
	if (ground) {
		Object.assign(backLayer, { elevation: 0, sortLayer: 660, sort: 0, zIndex: -1 });
		ground.addChild(backLayer);
		ground.sortableChildren = true;
		ground.sortChildren?.();
	} else getLayer().addChild(backLayer);
	return backLayer;
}

export function resetPixelLayers() {
	backLayer = null;
}

/* ------------------------------------------------------------------ */
/*  Shapes of the fighters                                             */
/* ------------------------------------------------------------------ */

const silCache = new Map();

/** A plain body shape when the token image can't be read: a rounded capsule */
function capsule(w, h) {
	const data = new Uint32Array(w * h);
	const r = w / 2;
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const cx = x + 0.5 - r;
			const cy = Math.min(Math.max(y + 0.5, r), h - r) - (y + 0.5);
			if (cx * cx + cy * cy <= r * r) data[y * w + x] = 0xff808080;
		}
	return data;
}

/**
 * The token's outline in art pixels: its image, read at art resolution, alpha only.
 * @returns {{w:number,h:number,data:Uint32Array}}
 */
function shapeOf(token, artPx) {
	const tw = Math.max(4, Math.min(200, Math.round((token?.w ?? canvas.grid.size) / artPx)));
	const th = Math.max(4, Math.min(200, Math.round((token?.h ?? canvas.grid.size) / artPx)));
	const tex = token?.mesh?.texture;
	const src = tex?.baseTexture?.resource?.source;
	const key = `${tex?.baseTexture?.uid ?? 'none'}:${tw}x${th}`;
	if (silCache.has(key)) return silCache.get(key);
	let out = null;
	try {
		if (src && (src instanceof HTMLImageElement || src instanceof HTMLCanvasElement || (globalThis.ImageBitmap && src instanceof ImageBitmap))) {
			const fr = tex.frame;
			const mesh = token.mesh;
			// the image as it shows inside the token's square (fit and scale like the mesh)
			const mw = Math.abs(mesh.width) / artPx;
			const mh = Math.abs(mesh.height) / artPx;
			const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(tw, th) : Object.assign(document.createElement('canvas'), { width: tw, height: th });
			const g = cv.getContext('2d', { willReadFrequently: true });
			g.imageSmoothingEnabled = true;
			g.translate(tw / 2, th / 2);
			if (mesh.scale.x < 0) g.scale(-1, 1);
			g.drawImage(src, fr.x, fr.y, fr.width, fr.height, -mw / 2, -mh / 2, mw, mh);
			const img = g.getImageData(0, 0, tw, th);
			const data = new Uint32Array(img.data.buffer.slice(0));
			let solid = 0;
			for (let i = 0; i < data.length; i++) if (data[i] >>> 24 > 96) solid++;
			if (solid > data.length * 0.08) out = { w: tw, h: th, data };
		}
	} catch {
		out = null; // a cross-origin image can't be read
	}
	out ??= { w: Math.round(tw * 0.6), h: Math.round(th * 0.85), data: null };
	if (!out.data) out.data = capsule(out.w, out.h);
	if (silCache.size > 200) silCache.clear();
	silCache.set(key, out);
	return out;
}

/** The token at a point: the one passed along, else the one whose centre is there */
function tokenAt(token, point) {
	if (token && !token.destroyed) return token;
	if (!point || !canvas?.tokens) return null;
	let best = null;
	let bestD = Infinity;
	for (const t of canvas.tokens.placeables) {
		const c = t.center;
		const d = Math.hypot(c.x - point.x, c.y - point.y);
		if (d < bestD && d < Math.max(t.w, t.h) / 2) {
			best = t;
			bestD = d;
		}
	}
	return best;
}

/* ------------------------------------------------------------------ */
/*  Where an effect plays                                              */
/* ------------------------------------------------------------------ */

function rampOf(element) {
	const r = ELEMENT_RAMPS[element];
	return { ramp: (n) => (r ? resample(r.map(hex), n) : undefined), hexRamp: (n) => (r ? resample(r, n) : undefined) };
}

/**
 * The placement an effect is built from, in Sprite Fusion world units.
 * @param {{anchor:{x,y}, from?:{x,y}, aim?:{x,y}, artPx:number, element?:string, seed?:number, target?:{w,h,shape}, source?:{w,h}}} o
 * sizes (w, h) are in art pixels; aim: where an effect on the user points (its target) when there is no from
 */
export function placement(o) {
	const toLocal = (p) => [(ORIGIN + (p.x - o.anchor.x) / o.artPx) * PX, (ORIGIN + (p.y - o.anchor.y) / o.artPx) * PX];
	const [x, y] = toLocal(o.anchor);
	const [fx, fy] = o.from ? toLocal(o.from) : [x, y];
	const dx = x - fx;
	const dy = y - fy;
	const dist = Math.hypot(dx, dy);
	const [ax, ay] = o.aim ? toLocal(o.aim) : [x, y];
	const aimed = dist <= 1 && Math.hypot(ax - x, ay - y) > 1;
	const angle = dist > 1 ? Math.atan2(dy, dx) : aimed ? Math.atan2(ay - y, ax - x) : 0;
	const facing = (dist > 1 ? dx : aimed ? ax - x : 1) < -1 ? -1 : 1;
	const T = o.target ?? { w: ART_PER_GRID, h: ART_PER_GRID };
	const S = o.source ?? T;
	const hT = (T.h * PX) / 2;
	const ground = y + hT * 0.62;
	const head = y - hT * 0.8;
	const reach = (Math.max(S.w, S.h) * PX) / 2;
	const hand = dist > 1 ? { x: fx + Math.cos(angle) * reach * 0.55, y: fy + Math.sin(angle) * reach * 0.55, a: angle } : { x: x + Math.cos(angle) * reach * 0.55, y: y + Math.sin(angle) * reach * 0.55, a: angle };
	const shape = T.shape;
	const target = {
		feet: () => [x, ground],
		head: () => [x, head],
		hand: () => ({ x, y, a: angle }),
		silhouette: () => (shape ? { x: Math.round(x / PX - shape.w / 2), y: Math.round(y / PX - shape.h / 2), w: shape.w, h: shape.h, data: shape.data } : null),
	};
	const source = {
		feet: () => [fx, fy + ((S.h * PX) / 2) * 0.62],
		head: () => [fx, fy - ((S.h * PX) / 2) * 0.8],
		hand: () => hand,
		silhouette: () => null,
	};
	return { x, y, ground, head, from: [fx, fy], to: [x, y], hand, angle, facing, dist, seed: o.seed ?? 1, element: o.element, ...rampOf(o.element), target, source, hook: {}, toLocal };
}

/** The art-pixel rectangle an effect may draw in */
function bounds(def, P) {
	const [x0, y0, x1, y1] = def.box ?? [-60, -60, 60, 60];
	const cx = P.x / PX;
	const cy = P.y / PX;
	let b = [cx + x0, cy + y0, cx + x1, cy + y1];
	if (def.line) {
		const hx = P.from[0] / PX;
		const hy = P.from[1] / PX;
		b = [Math.min(b[0], hx - 40), Math.min(b[1], hy - 50), Math.max(b[2], hx + 40), Math.max(b[3], hy + 50)];
	}
	const w = Math.min(1600, Math.ceil(b[2] - b[0]));
	const h = Math.min(1600, Math.ceil(b[3] - b[1]));
	return { ox: Math.floor(b[0]), oy: Math.floor(b[1]), w, h };
}

/* ------------------------------------------------------------------ */
/*  Running an effect                                                  */
/* ------------------------------------------------------------------ */

/**
 * The parts of an effect, stepped together: each starts at its time, or when another part lands.
 * Works the same on the scene and in the editor preview.
 */
export class PixelRun {
	constructor(id, P, { onHit } = {}) {
		this.def = PIXEL[id];
		this.P = P;
		this.t = 0;
		this.hitDone = false;
		this.onHit = onHit;
		const parts = this.def.make(P);
		this.parts = parts.map((p, i) => ({ ...p, i, fx: null, make: p.fx, hitAt: null, started: false }));
		const main = this.parts.find((p) => p.main) ?? this.parts[0];
		this.main = main;
		this.stopped = false;
	}
	#start(part) {
		part.started = true;
		this.P.hook = {
			shake: () => this.#landed(part),
			flash: () => this.#landed(part),
			ripple: () => this.#landed(part),
		};
		try {
			part.fx = part.make();
		} catch (err) {
			console.warn('fu-animations | pixel effect', err);
			part.fx = null;
		}
		this.P.hook = {};
	}
	#landed(part) {
		if (part.hitAt != null) return;
		part.hitAt = this.t;
		if (part === this.main && this.def.hit === 'hook') this.#hit();
	}
	#hit() {
		if (this.hitDone) return;
		this.hitDone = true;
		this.onHit?.();
	}
	update(dt) {
		this.t += dt;
		const { def, t } = this;
		for (const p of this.parts) {
			if (p.started) continue;
			const after = p.after != null ? this.parts[p.after] : null;
			if (after ? after.hitAt != null : t >= (p.at ?? 0)) this.#start(p);
		}
		if (typeof def.hit === 'number' && t >= def.hit) this.#hit();
		if (!this.hitDone && t >= def.cap * 0.75) this.#hit();
		if (def.stopAt && !this.stopped && t >= def.stopAt) {
			this.stopped = true;
			for (const p of this.parts) p.fx?.stop?.();
		}
		for (const p of this.parts) {
			if (!p.fx) continue;
			try {
				p.tick?.(p.fx, t - (p.at ?? 0));
				p.fx.update(dt);
			} catch (err) {
				console.warn('fu-animations | pixel effect', err);
				p.fx = null;
			}
		}
	}
	draw(back, front) {
		for (const p of this.parts) {
			if (!p.fx) continue;
			try {
				if (back) p.fx.draw(back, 'back');
				p.fx.draw(front, 'front');
			} catch (err) {
				console.warn('fu-animations | pixel effect', err);
				p.fx = null;
			}
		}
	}
	get over() {
		return this.parts.every((p) => p.started && (!p.fx || p.fx.done()));
	}
}

/**
 * Dither away the outer band of a frame, so area effects (rain, snow...) have no hard edges.
 * lightOnly: just the glow, which every effect gets so big glows never end on a straight line.
 */
function soften(f, m = 22, lightOnly = false) {
	const { w, h, color, light } = f;
	for (let y = 0; y < h; y++) {
		const dy = Math.min(y, h - 1 - y);
		const band = dy < m;
		for (let x = 0; x < w; x++) {
			const d = band ? Math.min(dy, x, w - 1 - x) : Math.min(x, w - 1 - x);
			if (d >= m) {
				if (w - 1 - m > x) x = w - 1 - m; // skip the middle of the row
				continue;
			}
			if (bayer(x + f.ox, y + f.oy) >= d / m) {
				const i = y * w + x;
				if (!lightOnly) color[i] = 0;
				light[i] = 0;
			}
		}
	}
}

function frame(b) {
	return { w: b.w, h: b.h, ox: b.ox, oy: b.oy, color: new Uint32Array(b.w * b.h), light: new Uint32Array(b.w * b.h) };
}

/** Glow pixels with their brightness as alpha, so additive blending is right on any surface */
function glowInto(light, out) {
	let any = false;
	for (let i = 0; i < light.length; i++) {
		const c = light[i];
		if (!c) {
			out[i] = 0;
			continue;
		}
		const r = c & 255;
		const g = (c >>> 8) & 255;
		const b = (c >>> 16) & 255;
		const m = r > g ? (r > b ? r : b) : g > b ? g : b;
		if (!m) {
			out[i] = 0;
			continue;
		}
		any = true;
		const k = 255 / m;
		out[i] = ((m << 24) | (Math.min(255, Math.round(b * k)) << 16) | (Math.min(255, Math.round(g * k)) << 8) | Math.min(255, Math.round(r * k))) >>> 0;
	}
	return any;
}

/** Upload a frame's buffers into its two sprites; hide the sprites with nothing to show */
function upload(f, sprites) {
	let any = false;
	for (let i = 0; i < f.color.length; i++)
		if (f.color[i]) {
			any = true;
			break;
		}
	sprites.color.visible = any;
	if (any) sprites.color.texture.baseTexture.resource.update();
	const lit = glowInto(f.light, sprites.glow);
	sprites.light.visible = lit;
	if (lit) sprites.light.texture.baseTexture.resource.update();
}

function sprites(f, parent) {
	const box = new PIXI.Container();
	const make = (buf, add) => {
		const tex = PIXI.Texture.fromBuffer(new Uint8Array(buf.buffer), f.w, f.h, { scaleMode: PIXI.SCALE_MODES.NEAREST });
		const s = new PIXI.Sprite(tex);
		if (add) s.blendMode = PIXI.BLEND_MODES.ADD;
		box.addChild(s);
		return s;
	};
	const glow = new Uint32Array(f.w * f.h);
	const light = make(glow, true);
	const color = make(f.color, false);
	parent.addChild(box);
	return { box, light, color, glow };
}

const CMF = () => PIXI.ColorMatrixFilter ?? PIXI.filters?.ColorMatrixFilter;
const HUE = { fire: 14, ice: 198, bolt: 52, air: 150, earth: 32, light: 48, dark: 272, poison: 96 };

/** Effects that keep their own palette get hue-rotated toward the element instead */
function hueFilter(def, element) {
	if (def.ramp || def.hue == null || !(element in HUE)) return null;
	const Filter = CMF();
	if (!Filter) return null;
	const f = new Filter();
	f.hue(HUE[element] - def.hue, false);
	if (element === 'light') f.saturate(-0.3, true);
	if (element === 'earth') f.saturate(-0.3, true);
	return f;
}

/**
 * Play a pixel effect at a point.
 * @param {string} id
 * @param {{x:number,y:number,from?:{x,y},to?:{x,y},scale?:number,element?:string,alpha?:number,tokenSize?:number,token?:Token,source?:Token}} at
 * @returns {Promise<void> & {hit: Promise<void>}} resolves when it ends; .hit when it lands
 */
export function playPixel(id, at) {
	const def = PIXEL[id];
	let hitResolve;
	const hit = new Promise((r) => (hitResolve = r));
	const done = (async () => {
		if (!def || !canvas?.ready) return hitResolve();
		const grid = canvas.grid.size;
		const mult = (at.scale ?? 1) * userScale() * Math.max(1, (at.tokenSize ?? 1) * 0.85) * (def.scale ?? 1);
		const artPx = (grid * mult) / ART_PER_GRID;
		const anchor = { x: at.x, y: at.y };
		const from = at.from && Math.hypot(at.from.x - at.x, at.from.y - at.y) > 1 ? at.from : null;
		const aim = !from && at.to && Math.hypot(at.to.x - at.x, at.to.y - at.y) > 1 ? at.to : null;
		const tTok = tokenAt(at.token, anchor);
		const sTok = from ? tokenAt(at.source, from) : tTok;
		const size = (tok) => ({ w: (tok?.w ?? grid) / artPx, h: (tok?.h ?? grid) / artPx });
		const P = placement({
			anchor,
			from,
			aim,
			artPx,
			element: at.element,
			seed: Math.floor(Math.random() * 1e6),
			target: { ...size(tTok), shape: shapeOf(tTok, artPx) },
			source: size(sTok),
		});
		const run = new PixelRun(id, P, { onHit: hitResolve });
		const b = bounds(def, P);
		const fb = frame(b);
		const ff = frame(b);
		const place = (s) => {
			s.box.position.set(anchor.x + (b.ox - ORIGIN) * artPx, anchor.y + (b.oy - ORIGIN) * artPx);
			s.box.scale.set(artPx);
			s.box.alpha = at.alpha ?? 1;
		};
		const back = sprites(fb, behind());
		const front = sprites(ff, getLayer());
		place(back);
		place(front);
		// a filter flattens what it covers: the glow gets its own, which adds up like the glow itself
		for (const s of [back, front]) {
			const fc = hueFilter(def, at.element);
			if (!fc) break;
			const fl = hueFilter(def, at.element);
			fl.blendMode = PIXI.BLEND_MODES.ADD;
			s.color.filters = [fc];
			s.light.filters = [fl];
		}
		let last = now();
		const start = last;
		let fadeFrom = null;
		await new Promise((resolve) => {
			const tick = () => {
				// the scene changed under us: its layers are gone
				if (back.box.destroyed || front.box.destroyed) {
					canvas.app?.ticker?.remove(tick);
					return resolve();
				}
				const t = now();
				const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
				last = t;
				run.update(dt);
				fb.color.fill(0);
				fb.light.fill(0);
				ff.color.fill(0);
				ff.light.fill(0);
				run.draw(fb, ff);
				soften(fb, def.soft ? 22 : 14, !def.soft);
				soften(ff, def.soft ? 22 : 14, !def.soft);
				upload(fb, back);
				upload(ff, front);
				const age = (t - start) / 1000;
				if (fadeFrom == null && (run.over || age >= def.cap)) fadeFrom = run.over ? age - 0.25 : age;
				if (fadeFrom != null) {
					const k = (age - fadeFrom) / 0.25;
					const a = (at.alpha ?? 1) * Math.max(0, 1 - k);
					back.box.alpha = front.box.alpha = a;
					if (k >= 1) {
						canvas.app.ticker.remove(tick);
						resolve();
					}
				}
			};
			canvas.app.ticker.add(tick);
			// safety net if the ticker never runs again (scene change)
			setTimeout(() => {
				canvas.app?.ticker?.remove(tick);
				resolve();
			}, (def.cap + 6) * 1000);
		});
		hitResolve();
		for (const s of [back, front]) if (!s.box.destroyed) s.box.destroy({ children: true, texture: true, baseTexture: true });
	})();
	done.hit = hit;
	return done;
}

export function pixelDuration(id) {
	const def = PIXEL[id];
	return def ? Math.min(def.dur, def.cap) * 1000 : 0;
}

/* ------------------------------------------------------------------ */
/*  Editor preview: a small 2D canvas, no PIXI needed                  */
/* ------------------------------------------------------------------ */

/** The glow buffer as see-through pixels: its brightness becomes its alpha, so it adds light over anything */
function glowPixels(light) {
	const out = new Uint8ClampedArray(light.length * 4);
	for (let i = 0; i < light.length; i++) {
		const c = light[i];
		if (!c) continue;
		const r = c & 255;
		const gg = (c >>> 8) & 255;
		const b = (c >>> 16) & 255;
		const m = Math.max(r, gg, b);
		if (!m) continue;
		const k = 255 / m;
		const j = i * 4;
		out[j] = r * k;
		out[j + 1] = gg * k;
		out[j + 2] = b * k;
		out[j + 3] = m;
	}
	return out;
}

/**
 * Loops a pixel effect on a <canvas>: a target on the right, its user on the left.
 */
export class PixelPreview {
	constructor(canvasEl) {
		this.el = canvasEl;
		this.ctx = canvasEl.getContext('2d');
		this.id = null;
		this.element = 'none';
		this.seed = 1;
	}
	set(id, element) {
		if (id === this.id && element === this.element) return;
		this.id = isPixel(id) ? id : null;
		this.element = element;
		this.#restart();
	}
	#restart() {
		this.run = null;
		if (!this.id) return;
		const W = this.el.width;
		const H = this.el.height;
		// one art pixel per screen pixel in the small previews, chunkier in big ones
		this.scale = W >= 260 ? 2 : 1;
		const AW = Math.ceil(W / this.scale);
		const AH = Math.ceil(H / this.scale);
		const artPx = 1;
		const anchor = { x: AW * 0.62, y: AH * 0.55 };
		const from = { x: AW * 0.14, y: AH * 0.62 };
		const def = PIXEL[this.id];
		const T = { w: 30, h: 34, shape: { w: 18, h: 30, data: capsule(18, 30) } };
		this.P = placement({ anchor, from: def.line || def.proj ? from : { x: AW * 0.2, y: AH * 0.55 }, artPx, element: this.element, seed: this.seed++, target: T, source: { w: 30, h: 34 } });
		this.run = new PixelRun(this.id, this.P);
		const ox = ORIGIN - Math.round(anchor.x);
		const oy = ORIGIN - Math.round(anchor.y);
		this.back = { w: AW, h: AH, ox, oy, color: new Uint32Array(AW * AH), light: new Uint32Array(AW * AH) };
		this.front = { w: AW, h: AH, ox, oy, color: new Uint32Array(AW * AH), light: new Uint32Array(AW * AH) };
		this.anchor = anchor;
		this.fromPt = from;
		this.buf ??= document.createElement('canvas');
		this.buf.width = AW;
		this.buf.height = AH;
		this.hold = 0;
	}
	/** Advance and draw one frame */
	frame(dt) {
		const { ctx, el } = this;
		ctx.clearRect(0, 0, el.width, el.height);
		if (!this.run) return;
		const def = PIXEL[this.id];
		if (this.run.over || this.run.t > def.cap) {
			this.hold += dt;
			if (this.hold > 0.35) this.#restart();
			if (!this.run) return;
		}
		this.run.update(Math.min(0.05, dt));
		for (const f of [this.back, this.front]) {
			f.color.fill(0);
			f.light.fill(0);
		}
		this.run.draw(this.back, this.front);
		if (def.soft) {
			soften(this.back, 12);
			soften(this.front, 12);
		}
		const g = this.buf.getContext('2d');
		ctx.imageSmoothingEnabled = false;
		// stand-ins for the two fighters
		ctx.fillStyle = 'rgba(255,255,255,0.08)';
		const s = this.scale;
		const tok = (p) => ctx.fillRect((p.x - 9) * s, (p.y - 15) * s, 18 * s, 30 * s);
		const drawLayer = (f, mode) => {
			g.putImageData(new ImageData(glowPixels(f.light), f.w, f.h), 0, 0);
			ctx.globalCompositeOperation = 'lighter';
			ctx.drawImage(this.buf, 0, 0, f.w * s, f.h * s);
			g.putImageData(new ImageData(new Uint8ClampedArray(f.color.buffer.slice(0)), f.w, f.h), 0, 0);
			ctx.globalCompositeOperation = mode;
			ctx.drawImage(this.buf, 0, 0, f.w * s, f.h * s);
		};
		drawLayer(this.back, 'source-over');
		ctx.globalCompositeOperation = 'source-over';
		tok(this.anchor);
		if (def.line || def.proj) tok(this.fromPt);
		drawLayer(this.front, 'source-over');
		ctx.globalCompositeOperation = 'source-over';
	}
}

export { isPixel, PIXEL };
