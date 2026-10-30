import { PROC } from './procedural.mjs';

/**
 * Name-reading rules for NPC attacks and abilities that are not in any table (homebrew, renamed or new book content):
 * "Acid Spit" sprays, "Savage Bite" bites, "Thunder Roar" shakes the air. Generated from the same rules as the bestiary table.
 */

const ELEMENT_HIT = { physical: 'px-impact-sym-1', fire: 'px-explosion-sym-1', ice: 'px-impact-sym-2', bolt: 'pr-chain-lightning', air: 'pr-tornado', earth: 'pr-spikes', light: 'px-light-burst', dark: 'pr-void', poison: 'pr-cloud', '': 'px-impact-sym-1' };
const SLASHES = ['slash-down-circ-2', 'slash-up-arch-2', 'slash-down-2', 'slash-up-circ-2', 'slash-down-red-2'];
const SMASH = ['px-impact-sym-3', 'px-impact-sym-1', 'px-impact-sym-4'];
const FROM = new Set(Object.entries(PROC).filter(([, p]) => p.needsFrom).map(([id]) => id));

function pick(list, seed) {
	let h = 0;
	for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return list[h % list.length];
}
const reach = (hit, element = 'auto', cast = null, extra = {}) => ({ style: 'spell', cast, hit, element, ...extra });
const melee = (hit, element = 'auto', extra = {}) => ({ style: 'melee', hit, element, ...extra });
const ranged = (hit, projectile = null, cast = null, element = 'auto') => ({ style: 'ranged', hit, element, ...(projectile ? { projectile } : {}), ...(cast ? { cast } : {}) });
const spell = (hit, cast = 'cast-glow-3', element = 'auto') => ({ style: 'spell', cast: FROM.has(hit) ? null : cast, hit, element });
const support = (hit, cast = 'cast-glow-1', element = 'none') => ({ style: 'support', cast, hit, element });
const self_ = (hit, element = 'none') => ({ style: 'self', hit, element });

function common(n, el) {
	if (/snor|yawn|goodnight|lullab|sleep|slow epilogue/.test(n)) return reach('pr-zzz', 'none');
	if (/laugh|cackle|giggle|smirk|jester|mock/.test(n)) return reach('pr-laugh', 'none');
	if (/breath|belch|exhale|puke|regurgitat|bad breath|bogbreath/.test(n)) return reach('pr-breath');
	if (/swarm|flies|fly |locust|bees|insect|fleshfly|vipers/.test(n)) return reach('pr-swarm', el ? 'auto' : 'poison');
	if (/petal|blossom|bloom|flower|leaf|leafy|frond|season|scarlet harvest/.test(n)) return reach('pr-petals');
	if (/whirlwind|tornado|cyclone|vortex|maelstrom|typhoon|eddy|turbulence|winds of|sandstorm|blisterwind|phlogiston/.test(n)) return reach('pr-tornado');
	if (/\brain\b|deluge|hail|blizzard|thunderstorm/.test(n)) return reach('pr-rain');
	if (/chain lightning|aetherwave|discharge|static|crackling|current|lightning|thunder|zeus|truebolt|electro|taser|ion cannon|jammer/.test(n)) return reach('pr-chain-lightning', el ? 'auto' : 'bolt');
	if (/laser|beam|\bray\b|rays|cannon|annihilator|gamma/.test(n)) return reach('pr-beam');
	if (/gaze|glare|\beye\b|stare|doomgaze|eyeless/.test(n)) return reach('pr-gaze');
	if (/gatling|autofire|salvo|suppress|repeating|batteries|rapid/.test(n)) return reach('pr-volley');
	if (/rocket|missile|ordnance|torpedo|grenade|explosive|special delivery/.test(n)) return reach('pr-missiles');
	if (/broadside|cannonade|barrage|meteor|armageddon|bombard|collapsing celestia/.test(n)) return reach('pr-meteors');
	if (/web|silk|\bnet\b|entangl|sticky/.test(n)) return reach('pr-web', 'none');
	if (/chain|bind|cage|shackle|cocytus|feathercage|grasp of purgatory|grip of/.test(n)) return reach('pr-chains');
	if (/steal|tribute|greed|midas|cutpurse|gilding|covetous|acquire/.test(n)) return reach('pr-steal', 'none');
	if (/drain|leech|drinker|bloodletting|parasite|vampir|absorb|bioclepsis|soul compression/.test(n)) return reach('pr-tether');
	if (/wisp|ghostfire|soulflare|wraithfire|ghost|spirit energy|ecto/.test(n)) return reach('pr-wisps');
	if (/judg|penance|divine|holy|smite|bonis|malis|goddess|roaring light|solar|arborlight|blinding light|conviction|truth/.test(n)) return reach('pr-pillar', el ? 'auto' : 'light');
	if (/hex|curse|rune|sigil|glyph|seal|doom|omicron|gospel/.test(n)) return reach('pr-glyph');
	if (/mist|gas|spore|smog|miasma|smoke|fog|pollen|powder|puff|vapou?r|cloud|reek|pheromone|pestilence|plague|stench|fetid|sulphur/.test(n)) return reach('pr-cloud', el ? 'auto' : 'poison');
	if (/void|abyss|despair|aster|umbral|eldritch|nether|enveloping shadow|lunar blanket|stygian/.test(n)) return reach('pr-void', el ? 'auto' : 'dark');
	if (/scream|screech|shriek|wail|bleat|sonic|cry|whisper|lie|doubt|question|call|toll|draw|raze/.test(n)) return reach('pr-soundwave');
	if (/roar|bellow|howl/.test(n)) return reach('pr-shockwave');
	if (/shard|quill|needle|myriad|blossomblade|bone throw|crystal/.test(n)) return reach('pr-shards');
	if (/spike|thorn|pillar|spire|speleothem|bramble|amethyst|roots|mycelium|teraquake|quake|bastion/.test(n)) return reach('pr-spikes');
	if (/stun|daze|bonk|dizzy|confus|puzzl|flash grenade|wobble|please stand/.test(n)) return reach('pr-dizzy', 'none');
	if (/jet|spit|toxin|spray|squirt|hose|vomit|deluge|ocean|briny|tide/.test(n)) return reach('pr-jet');
	return null;
}

function meleeSpec(n, el) {
	if (/bite|fang|jaw|maw|gnaw|chomp|munch|crunch|devour|teeth|gorger|eater|nibble|mandible/.test(n)) return melee('pr-bite');
	if (/claw|talon|scratch|rake|rend|swipe|nail|lacerat|scraper|carver|shred|tear it|rip |rip out|zombie/.test(n)) return melee('pr-claw');
	if (/cyclone|whirling|spinner|sawblade/.test(n)) return melee('slash-up-circ-3');
	if (/tail|sweep|swat|thrash|flail|fieldsweeper|woodsweep|erratic|wheels|tires/.test(n)) return melee('pr-sweep');
	if (/stomp|trample|quak|landing|terrain|seismic|crushing roots/.test(n)) return melee('pr-stomp');
	if (/peck/.test(n)) return melee('px-impact-dir-4');
	if (/sting|needle|spike|lance|spear|horn|tusk|antler|gore|goring|jab|poke|lunge|pierc|impale|syringe|forkstaff|scrapjab/.test(n)) return melee(pick(['slash-front-2', 'slash-front-3'], n));
	if (/tentacle|tendril|vine|root|branch|\blash|whip|coil|tongue|hook|pincer|barbed/.test(n)) return reach('pr-vines');
	if (/web|silk|\bnet\b/.test(n)) return reach('pr-web', 'none');
	if (/drink|leech|bloodletting|drain/.test(n)) return melee('pr-tether');
	if (/touch|caress|hand|grasp|grip|hold|acquire|lay bare/.test(n)) return melee('star-magic-2');
	if (/blade|sword|slash|saber|scythe|axe|dagger|knife|cut|cleave|ichimonji|edge|strike|swing|lumenslash|rend|reap|blades|deathrend|featherslash|silver/.test(n)) return melee(pick(SLASHES, n));
	if (/staff|baton|club|scepter|gavel|urn|cane|caduceus|ferula|branch|bonk/.test(n)) return melee('px-impact-sym-3');
	if (/shield/.test(n)) return melee('px-impact-sym-4');
	if (/slam|smash|bash|punch|kick|slap|headbutt|ram|charge|rush|tackle|dive|pounce|hug|elbow|gallop|leap|hop|roll|lick|frenzy|flailing|step|wush|leg|glove|attack|challenge/.test(n)) return melee(pick(SMASH, n));
	return null;
}

function rangedSpec(n, el) {
	if (/gun|pistol|handgun|shot|rifle|sniper|fire!|flick/.test(n)) return ranged('px-spark-burst', 'bullet', 'px-muzzle-1');
	if (/bow|arrow|crossbow|dart/.test(n)) return ranged('arrow-hit-1', 'arrow');
	if (/throw|stone|knife|spikeball|toss|rock|boulder/.test(n)) return ranged('px-impact-dir-1', /stone|rock|boulder|spikeball/.test(n) ? 'rock' : 'arrow');
	if (/orb|star|blast|burst|bolt|wave|proof|life|light|fan|flame|soul|ember/.test(n)) return ranged((ELEMENT_HIT[el] ?? 'px-impact-sym-1'), 'orb', 'cast-glow-3');
	return null;
}

function spellSpec(n, el, off) {
	if (/heal|regenerat|patch|photosynthesis|cherry|feather|rekindle|recalibrat|in corpore|corpore sano/.test(n)) return support('heal-long-2', 'heal-cross-1');
	if (/shell|bastion|wall|barrier|ward|armor|stance|guard|testudo|hardened|foamy|shield/.test(n)) return self_('shield-hex');
	if (/dance|kata|choreo|choweo/.test(n)) return self_('px-music-1');
	if (/charge!|rally|inspir|hunting horn|war|macho|augment|magicharge/.test(n)) return support('buff-sparks-2', 'px-sym-attack-up');
	if (/smokescreen|invigorating smoke/.test(n)) return self_('px-smoke-loop-1');
	if (/fireball|explos|deflagration|heatblast|deathblaze|pandemonic|kaleidomachy/.test(n)) return spell(pick(['px-explosion-sym-1', 'px-explosion-sym-2', 'px-explosion-stylized-3'], n), 'charge-blaze-1');
	return null;
}

/**
 * @param {'melee'|'ranged'|'spell'|'any'} kind
 * @param {string} name
 * @param {string} element damage type, if known
 * @returns {object|null} an animation, or null when the name says nothing useful
 */
export function specFromName(kind, name, element = '') {
	const n = String(name ?? '').toLowerCase().replace(/[\u2018\u2019]/g, "'");
	const el = element && element !== 'physical' ? element : '';
	if (kind === 'melee') return meleeSpec(n, el) ?? common(n, el);
	if (kind === 'ranged') return common(n, el) ?? rangedSpec(n, el);
	if (kind === 'spell') return spellSpec(n, el) ?? common(n, el);
	return common(n, el) ?? spellSpec(n, el) ?? null;
}
