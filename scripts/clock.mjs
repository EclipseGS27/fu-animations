/**
 * Animation clock that can be frozen. Hitstop freezes the canvas for a split second on contact;
 * every tween and effect in the module reads this clock so it resumes exactly where it stopped.
 */
let pausedTotal = 0;
let pauseStart = null;
let resumeTimer = null;

/** Things that run outside the canvas ticker (videos) and need pausing too */
export const freezeListeners = new Set();
const tell = (on) => {
	for (const f of freezeListeners) {
		try {
			f(on);
		} catch {}
	}
};

export const now = () => (pauseStart ?? performance.now()) - pausedTotal;
export const frozen = () => pauseStart !== null;

/** Freeze the frame for ms (extends a freeze already running) */
export function hitstop(ms) {
	const ticker = canvas?.app?.ticker;
	if (!ticker || ms <= 0) return Promise.resolve();
	if (pauseStart === null) {
		pauseStart = performance.now();
		ticker.stop();
		ticker.update(performance.now());
		tell(true);
	}
	clearTimeout(resumeTimer);
	return new Promise((resolve) => {
		resumeTimer = setTimeout(() => {
			pausedTotal += performance.now() - pauseStart;
			pauseStart = null;
			ticker.start();
			tell(false);
			resolve();
		}, ms);
	});
}

/** setTimeout that doesn't count frozen time */
export function wait(ms) {
	return new Promise((resolve) => {
		const end = now() + ms;
		const check = () => {
			const left = end - now();
			if (left <= 0 && !frozen()) resolve();
			else setTimeout(check, Math.max(8, frozen() ? 16 : left));
		};
		setTimeout(check, ms);
	});
}
