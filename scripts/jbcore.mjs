import { JBFX } from './jbfx.mjs';

/** JB2A basics with no canvas code, safe to import anywhere */
export const isJb = (id) => typeof id === 'string' && id.startsWith('jb-');

const MODULES = ['JB2A_DnD5e', 'jb2a_patreon'];

/** The installed JB2A module, or null */
export function jbModule() {
	for (const id of MODULES) if (globalThis.game?.modules?.get(id)?.active) return id;
	return null;
}

export const jbAvailable = () => !!jbModule();

export { JBFX };
