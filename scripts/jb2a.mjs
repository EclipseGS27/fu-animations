import { JBFX, isJb, jbAvailable, jbModule } from './jbcore.mjs';
import { applyElement, getLayer, userScale } from './player.mjs';
import { freezeListeners, now } from './clock.mjs';

/**
 * JB2A effects: transparent webm videos from the "JB2A - Free Content" module (or the Patreon module, same paths).
 * Four ways to place one:
 *   stretch  a bolt, beam or thrown thing from the user to the target (picks the 5/15/30/60/90 ft file that fits)
 *   melee    a weapon swing from the attacker onto the target
 *   cone     breath, sprays and lines aimed from the user, at least long enough to reach the target
 *   point    centered on a token (impacts, explosions, auras, healing, rune circles)
 */

function src(path) {
	const mod = jbModule() ?? 'JB2A_DnD5e';
	return `modules/${mod}/${path}`;
}

/** Which file of an effect fits a distance in pixels: {file, w, h, dur, hitAt} */
function pickFile(fx, dist) {
	if (!fx.variants) return fx;
	const grid = canvas?.grid?.size ?? 100;
	const feet = (dist / grid) * 5;
	for (const v of fx.variants) if (v.ft + 2.5 >= feet) return v;
	return fx.variants[fx.variants.length - 1];
}

/* videos that are playing, so a hit freeze can pause them with the rest of the canvas */
const playing = new Set();
freezeListeners.add((on) => {
	for (const v of playing) {
		if (on) v.pause();
		else v.play().catch(() => {});
	}
});

function makeVideo(url) {
	const v = document.createElement('video');
	v.src = url;
	v.muted = true;
	v.playsInline = true;
	v.preload = 'auto';
	v.crossOrigin = 'anonymous';
	return v;
}

function ready(v) {
	if (v.readyState >= 2) return Promise.resolve(true);
	return new Promise((resolve) => {
		const done = (ok) => {
			v.removeEventListener('loadeddata', yes);
			v.removeEventListener('error', no);
			resolve(ok);
		};
		const yes = () => done(true);
		const no = () => done(false);
		v.addEventListener('loadeddata', yes);
		v.addEventListener('error', no);
		setTimeout(() => done(v.readyState >= 2), 6000);
	});
}

/** Warm the browser cache so the first play doesn't stall */
const warmed = new Set();
export function preloadJb(ids, dist = 600) {
	if (!jbAvailable()) return Promise.resolve();
	const jobs = [];
	for (const id of ids) {
		const fx = JBFX[id];
		if (!fx) continue;
		const url = src(pickFile(fx, dist).file);
		if (warmed.has(url)) continue;
		warmed.add(url);
		const v = makeVideo(url);
		jobs.push(ready(v).then(() => v.removeAttribute('src')));
	}
	return Promise.all(jobs);
}

export function jbDuration(id) {
	const fx = JBFX[id];
	return fx ? (fx.dur ?? fx.variants?.[2]?.dur ?? fx.variants?.[0]?.dur ?? 0) : 0;
}

/**
 * Play a JB2A effect.
 * @param {string} id
 * @param {{x:number,y:number,from?:{x:number,y:number},to?:{x:number,y:number},scale?:number,element?:string,alpha?:number,tokenSize?:number}} at
 * @returns {Promise<void> & {hit: Promise<void>}} resolves when the video ends; .hit resolves when it reaches the target
 */
export function playJb(id, at) {
	const fx = JBFX[id];
	let hitResolve;
	const hit = new Promise((r) => (hitResolve = r));
	const done = (async () => {
		if (!fx || !canvas?.ready || !jbAvailable()) return hitResolve();
		const grid = canvas.grid.size;
		const from = at.from ?? { x: at.x, y: at.y };
		const to = at.to ?? { x: at.x, y: at.y };
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const dist = Math.hypot(dx, dy);
		const angle = Math.atan2(dy, dx);
		const pick = pickFile(fx, dist);
		const v = makeVideo(src(pick.file));
		if (!(await ready(v))) return hitResolve();
		const dur = (v.duration && Number.isFinite(v.duration) ? v.duration * 1000 : pick.dur) || 1500;
		const hitMs = (pick.hitAt ?? fx.hitAt ?? (fx.mode === 'cone' ? 0.3 : 0)) * dur;
		// swings and breaths build up for a second or more in JB2A; start close to the moment they land
		// rune circles, flames and claws take a while to grow in too
		const lead = fx.mode === 'melee' ? 320 : fx.mode === 'cone' ? 420 : fx.mode === 'stretch' ? 1000 : 450;
		const skip = fx.mode === 'side' ? 0 : Math.max(0, hitMs - lead);
		if (skip) {
			v.currentTime = skip / 1000;
			await new Promise((r) => {
				v.addEventListener('seeked', r, { once: true });
				setTimeout(r, 800);
			});
		}
		// breaths roll in over a few frames: land the hit once the cloud is on the target
		const hitAt = hitMs - skip + (fx.mode === 'cone' ? 200 : 0);
		// long breaths, loops and rune circles stop a little after they land, with a fade
		const cap = fx.mode === 'cone' ? hitAt + 1700 : fx.cat === 'JB2A Casting' ? 2200 : fx.mode === 'point' ? 3200 : dur;
		const tex = PIXI.Texture.from(v, { resourceOptions: { autoPlay: false, updateFPS: 0 } });
		// uploads happen on the canvas ticker below, so a hit freeze holds the frame
		if (tex.baseTexture.resource && 'autoUpdate' in tex.baseTexture.resource) tex.baseTexture.resource.autoUpdate = false;
		const sprite = new PIXI.Sprite(tex);
		const w = v.videoWidth || pick.w;
		const [gsz, start, end] = fx.template;
		const mult = (at.scale ?? 1) * userScale();
		if (fx.mode === 'stretch' || fx.mode === 'melee') {
			let len = dist;
			let origin = from;
			if (fx.mode === 'melee') {
				// a swing always looks one or two squares long, ending on the target
				len = Math.max(grid * 1.2, Math.min(dist || grid, grid * 1.8));
				origin = { x: to.x - Math.cos(angle) * len, y: to.y - Math.sin(angle) * len };
			}
			const s = Math.max(0.05, len / Math.max(1, w - start - end));
			sprite.anchor.set(start / w, 0.5);
			sprite.position.set(origin.x, origin.y);
			sprite.rotation = angle;
			sprite.scale.set(s, s * (fx.mode === 'melee' ? Math.min(1.25, mult) : 1));
		} else if (fx.mode === 'cone') {
			const base = (grid / gsz) * mult;
			const reach = (dist / Math.max(1, w - start - end)) * 1.05;
			const s = Math.max(base, Math.min(reach, base * 2.5));
			sprite.anchor.set(start / w, 0.5);
			sprite.position.set(from.x, from.y);
			sprite.rotation = angle;
			sprite.scale.set(s, s);
		} else {
			// point: sized in squares, bigger on big tokens
			const px = grid * fx.size * mult * Math.max(1, (at.tokenSize ?? 1) * 0.85);
			const s = px / w;
			sprite.anchor.set(0.5, 0.5);
			sprite.position.set(at.x, at.y);
			sprite.scale.set(s, s);
			if (fx.mode === 'side' && dist > 1) {
				sprite.anchor.set(start / w, 0.5);
				sprite.rotation = angle;
			}
		}
		sprite.alpha = at.alpha ?? 1;
		applyElement(sprite, fx, at.element);
		getLayer().addChild(sprite);
		playing.add(v);
		// the texture follows the video through the canvas ticker, so a freeze holds the frame too
		const pull = () => tex.baseTexture.resource?.update?.();
		canvas.app.ticker.add(pull);
		const t0 = now();
		const watch = () => {
			if (now() - t0 >= hitAt) {
				canvas.app.ticker.remove(watch);
				hitResolve();
			}
		};
		canvas.app.ticker.add(watch);
		await v.play().catch(() => {});
		await new Promise((resolve) => {
			let fading = false;
			const finish = () => {
				clearTimeout(safety);
				canvas.app.ticker.remove(limit);
				v.removeEventListener('ended', finish);
				resolve();
			};
			const limit = () => {
				const t = now() - t0;
				if (t < cap || fading) return;
				fading = true;
				const f0 = now();
				const base = sprite.alpha;
				const fade = () => {
					const k = (now() - f0) / 300;
					if (k >= 1 || sprite.destroyed) {
						canvas.app.ticker.remove(fade);
						finish();
					} else sprite.alpha = base * (1 - k);
				};
				canvas.app.ticker.add(fade);
			};
			canvas.app.ticker.add(limit);
			v.addEventListener('ended', finish);
			const safety = setTimeout(finish, dur - skip + 4000);
		});
		hitResolve();
		canvas.app.ticker.remove(pull);
		canvas.app.ticker.remove(watch);
		playing.delete(v);
		sprite.destroy({ texture: true, baseTexture: true });
		v.pause();
		v.removeAttribute('src');
		v.load();
	})();
	done.hit = hit;
	return done;
}

export { JBFX, isJb, jbAvailable, jbModule };
