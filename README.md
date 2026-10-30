# Fabula Ultima Battle Animations

Animations for Project FU (Foundry v13, Project FU 4.14+). Works on its own, and alongside Fabula Ultima Battle UI.

## What plays
- **Every class ability, spell, NPC spell and Core item in the Project FU compendium has an animation** (446 entries), picked to fit: Glacies freezes, Ignis burns, Heal glows green over your allies, Omega drops a death mark, Arcana flare up when summoned, dances, verses, therioforms, magiseeds and symbols each get their own. Passive Skills that never get used in a fight (Fortress, Dodge, Well-Traveled...) have none.
- **Weapons and NPC basic attacks** animate from their category and damage type: swords, daggers and flails slash, heavy weapons and fists smash, spears thrust, bows fire arrows, firearms flash and shoot, thrown weapons fly, magic damage recolors the hit.
- **Every NPC attack and spell in the bestiaries** (611: Core Rulebook, Bestiary vol. 1, Natural, High and Techno Fantasy Atlases). They match by name, so an NPC built with a book attack's name (Claw, Flamebreath, Laser Beams, Yawn...) gets its animation automatically. NPC spells that are player spells (Ignis, Glacies...) use the player animation.
- **Custom effects** drawn in code where the sprite packs had nothing that fits: claw marks, snapping jaws, wide sweeps, ground slams, breath cones, jet streams, energy beams, an evil eye, shockwaves, sound waves, whirlwinds, downpours, falling barrages, erupting spikes, shard sprays, insect swarms, lashing tendrils, webs, binding chains, a dark vortex, billowing clouds, rapid fire, rocket salvos, sleepy Zs, dizzy stars, petal storms, a drain tether, rune circles, flying cards, a snatch, mocking laughter, a pillar of light, arcing lightning and spirit wisps. They recolor by element like the rest, and show up under "Custom" in the editor with live previews.
- **Homebrew** skills, spells and NPC attacks read their name the same way: "Acid Spit" sprays, "Savage Bite" bites, "Thunder Roar" arcs lightning. Anything the name doesn't explain falls back to its type and damage (setting to turn guesses off).

## Presets: Original, Pixel VFX or JB2A
Settings → **Animation preset** (GM, whole world):
- **Original**: the sprite and pixel effects that ship with this module.
- **Pixel VFX (drawn in code)**: every ability, spell, weapon and bestiary attack redone as pixel art drawn in code, after Sprite Fusion's open source pixel art VFX library. Needs no asset packs. See below.
- **JB2A (free)**: every ability, spell, weapon and bestiary attack plays JB2A effects instead. Needs the free **JB2A - Free Content** module (JB2A Patreon works too). Swords, axes, maces, daggers and fists swing their JB2A weapon; bows, crossbows, guns, thrown knives, bombs and flasks fly as JB2A projectiles; Ignis throws a fire bolt into an explosion, Glacies a ray of frost, Fulgur chain lightning, breaths become JB2A breath cones, heals, shields, curses, sleep, webs, roots and summon circles use their JB2A versions, and every spell starts on a JB2A rune circle in its element's color. A handful of custom effects JB2A has nothing for (meteor showers, petal storms, steals, mocking laughter) keep their drawing.
- Switching back and forth is instant and loses nothing. **Your own changes are universal**: an animation you set on an item, or for the whole world, plays the same in either preset, and the editor lists both libraries (JB2A effects under "JB2A ..." groups, JB2A bolts and beams in the Projectile list), so you can mix them freely.
- The impact layer (freeze, shake, debris, camera, cut-ins, damage numbers) works the same on both. JB2A swings and bolts land their hit on the frame the blade or bolt reaches the target.
- If the preset is JB2A but the JB2A module is off, the Original preset plays and the GM gets a warning.

## Pixel VFX preset
Every Original animation (the 152 sprite effects and the 34 custom drawings) has a pixel counterpart, so all 446 compendium entries and 611 bestiary attacks play in pixel art:
- **From Sprite Fusion's library** (all 25 of their effects, run as they are): slashes, impacts and ricochets, muzzle flashes, blood, dashes and blinks, burning outlines, lightning strikes, chain arcs and electrified bodies, frost novas, ice spikes, crystals, shattering blocks and frozen bodies, toxic clouds, puddles and poisoned bodies, power gathering, energy beams, bolts and orbs, hex shield domes, a black hole, pillars of light and smites, healing crosses and mana drops, power-up auras, gems and coins, sparkles, and rain, snow, fog, embers, fireflies, falling leaves and bubbles.
- **Drawn for this module in the same style**: snapping jaws, an evil eye, insect swarms, sleepy Zs, dizzy stars, laughter, music notes, symbols (alert, question, crown, arrows, skull, heart...), wisps, smoke, webs, chains, rune circles, shockwaves, sound waves, whirlwinds, breath, jets, vines, a life-drain tether, flying cards, and arrow, bullet and boulder projectiles.
- **Combined** for bigger moves: slash combos and cross slashes, claw marks, thrusts, meteors with explosions, falling barrages, rocket salvos, shard volleys, rapid fire, attack/magic/defense up, curses and death marks.
- Each one is recolored by element with its own pixel-art palette (fire, ice, bolt, air, earth, light, dark, poison), so a fire sword swings a fire slash and Fulgur's arc is yellow. Spells start on a rune circle in their element's color; signature spells (Ignis, Glacies, Fulgur, Flare, Comet, Drain Vigor...) are hand-picked.
- Effects draw behind and in front of tokens (shield domes wrap around them, scorch and ground glow sit under them), and flames, frost, poison and electricity follow the token's own image.
- Lightning, pillars of light, meteors, beams and bolts land the hit (freeze, shake, debris, damage) on the frame they reach the target, like the JB2A preset. Critical hits get a heavy pixel impact.
- The whole impact layer, cut-ins, sounds and damage numbers work the same. Pixel effects are listed under "Pixel ..." groups in the editor (with live previews) and in the Projectile list, and can be picked in any preset.
- One art pixel is 1/36 of a grid square at effect size 1; the Effect size setting and big tokens make the pixels bigger.

## How it plays
- It follows the chat card: when a Check or an ability is posted, the animation runs from the speaker's token to the targets on that card (or your current targets when the card has none). Everyone sees it.
- **Melee**: the attacker dashes next to the first target, strikes, and walks back to its spot. Only the picture moves; the token's position never changes.
- **Spells and ranged**: cast effect on the user, a projectile when there is one (magic orb, arrow, bullet, beam, boulder, meteor), then the hit on every target.
- **Misses**: the target sidesteps with a blur and the hit fades.
- **Impact**: every move has an impact level, Light, Normal, Heavy or Heroic, which decides how hard it lands:
  - the hit freezes the scene for a split second, the target flashes, sparks, embers or rubble fly off along the blow, the view shakes and the target is knocked back;
  - melee attackers wind up and dash in, leaving afterimages on heavy moves;
  - fire, magic orbs and other projectiles fly as blazing bolts with tails, sized by the impact;
  - heavy spells darken the scene with the fighters spotlit, the caster rises while power gathers, the camera leans in and the ground keeps a scorch mark for a moment;
  - heroic moves open with a full-screen **cut-in** (character portrait and move name), and a **Meteor** projectile falls from the sky onto a warning circle.
  - Automatic levels: Heroic Skills are Heroic, spells on two or more targets are Heavy, attacks and other spells are Normal, support and self effects are Light. **Critical hits go one level up** (a crit sword swing lands like a heavy blow); fumbles drop to Light.
- **Damage numbers**: when HP actually changes (after affinities, when damage is applied), the number slams onto the token and bounces: gold and larger after a critical, with the element under it, green for healing. They replace the system's plain "-12 HP" text.
- **Drains** (Drain Vigor, Drain Spirit, Soul Steal...) send a heal back to the user.
- **Hover**: while a conflict runs, combatants on the scene bob gently in place. Defeated ones stay still.

## Sound effects
Every animation plays sounds from Helton Yan's Pixel Combat (317 sounds, up to three takes each, picked at random so repeats don't sound identical):
- a sound when the move starts (the cast effect, or the launch for a projectile or a breath, beam, jet...), a whoosh when a melee attacker dashes in, and a sound when it lands;
- misses play a deflect instead of the hit, critical hits add a critical strike;
- elemental spells with a plain hit use their element's sound (fire hit, electric hit, crystal for ice...).
Sounds play on each player's Environment volume channel. Client settings: sound effects on or off, sound effect volume.

## Changing an animation
- **One item**: open the item sheet, header menu → **Animation**. Or right-click it in the Items directory. The choice is stored on that copy of the item, so two characters can animate the same sword differently, and everyone sees each attacker's own choice.
- **An ability for the whole world** (GM): Settings → Ability animations → **Open the list**, search, **Edit**. Bestiary attacks are in the list too, grouped by book. Or save from an item's Animation window with "Every … in this world".
- The editor sets the style (melee, ranged, spell, support, self, none), the effect on the user, the projectile, the effect on each target, a follow-up back on the user, the color (from damage type, original, or any element), the size, the **sound on use** and the **sound on hit** (Automatic, Silent, or any of the 317 sounds, with a play button), with looping previews. **Preview on the scene** plays it from your selected token at your targets, only for you. **Reset** goes back to the built-in choice.
- The **Impact** section sets the level and each part of it on its own: freeze on hit (none to very long), screen shake (none to earthquake), camera push, darkening, wind-up and afterimages (melee), debris (sparks, embers, rubble, mixed or none), the mark on the ground, and the cut-in. Every choice starts on Automatic, which shows what it does for that ability. With the cut-in on you can set its title, color and portrait (the character art by default) and preview it. **As a critical** next to Preview plays the critical version.
- Priority: the item's own choice, then the world choice for that ability, then the built-in table, then the guess.

## Settings
Client (each player for themselves): play animations, hover during conflicts, hover height, effect size, sound effects, sound volume, freeze frame on hits, screen shake, camera push, darkening, cut-ins, battle damage numbers. Turning one off wins over every ability's choice, for that player only.
World: melee attacks dash to the target, animate homebrew abilities, the ability list.

## Credits
- Super Pixel Effects Gigapack - Will Tice / unTied Games
- 2D VFX Pack - Casting and Buffs, 2D VFX Pack - Slashes and Impacts - MagusVFX
- Pixel Combat sound effects - Helton Yan
- JB2A preset: plays effects from JB2A - Jules and Ben's Animated Assets (not included; install their module)
- Pixel VFX preset: Sprite Fusion's open source pixel art VFX (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez. Included in `scripts/sf/` (converted to JavaScript), with the license next to them.

These packs forbid redistributing their files. Keep this module private while the vfx and sfx folders are inside it.

## Assets not included
This repository holds the code only. The sprite effects and sounds are paid packs whose licenses don't allow redistribution. To run the module, buy them and place them as:
- `vfx/pixel/` and `vfx/magus/`: Super Pixel Effects Gigapack (unTied Games) and the MagusVFX 2D VFX packs, as PNG sprite sheets with the file names listed in `scripts/library.mjs`
- `sfx/`: Helton Yan's Pixel Combat sounds as `.ogg`, with the file names listed in `scripts/sounds.mjs`

The JB2A preset needs only the free "JB2A - Free Content" Foundry module. The Pixel VFX preset needs nothing: it is all code (sounds still come from `sfx/`).
