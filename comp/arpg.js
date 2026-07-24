/* ============================================================
   VEILFALL — an ARPG in a window on the UreOS desktop.
   Early Access: the story isn't written yet. The violence is.
   A dark isometric proving ground: one arena, one exile, one
   very patient training dummy. Nine spells with real damage
   math (crits, ignite/chill/freeze/shock/umbral, resistances
   capped at 75% like civilization intended), liquid health and
   mana globes, flasks, a passive web, generated loot, floating
   numbers, a DPS meter, and a combat log that remembers what
   you did. Saves under comp_arpg. Exposes window.ARPG
   { render, init, close, steamAch } for the comp.js APPS
   entry; achievements feed the Steam client live, playtime
   lands on the library page.
   ============================================================ */
(function () {
'use strict';

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
var lerp = function (a, b, t) { return a + (b - a) * t; };
var TAU = Math.PI * 2;
function rnd(a, b) { return a + Math.random() * (b - a); }
function irnd(a, b) { return Math.floor(rnd(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function fmtN(n) {  // 12842 -> 12.8k
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'm';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return Math.round(n).toLocaleString();
}

/* ─────────────── arena constants ─────────────── */
var VW = 1080, VH = 560;                   // world canvas internal px
var TILE_W = 56, TILE_H = 28;              // iso diamond
var GRID = 15;                             // arena is GRID×GRID tiles
var ORX = VW / 2, ORY = 96;                // iso origin on canvas
function isoX(x, y) { return ORX + (x - y) * (TILE_W / 2); }
function isoY(x, y) { return ORY + (x + y) * (TILE_H / 2); }

/* ─────────────── the five elements ─────────────── */
var ELEMS = ['phys', 'fire', 'cold', 'light', 'chaos'];
var ECOL = { phys: '#c8c2b8', fire: '#ff7a2e', cold: '#6fd4ff', light: '#ffe66e', chaos: '#c06aff' };
var EDARK = { phys: '#6a675f', fire: '#a33c0e', cold: '#2a7ba8', light: '#a8922e', chaos: '#6a2a9c' };

/* ─────────────── spells ───────────────
   dmg: [min,max] at level 1 · per-level +12% base
   tags drive both tooltips and the damage pipeline. */
var SPELLS = {
    emberbolt: {
        n: 'Emberbolt', el: 'fire', tags: ['Spell', 'Projectile', 'Fire'],
        mana: 9, cd: 0, castT: 0.32, dmg: [34, 52], speed: 9.5,
        d: 'Hurl a searing bolt that bursts on impact. 25% chance to ignite, because fire remembers.',
        ignite: 0.25
    },
    glacialray: {
        n: 'Glacial Ray', el: 'cold', tags: ['Spell', 'Channelled', 'Cold', 'AoE'],
        mana: 14, cd: 0, castT: 0, dmg: [11, 16], tick: 0.12, ramp: 3,
        d: 'Channel a beam of murdering cold. Ramps to 3 intensity stages while held; chills, then freezes what it touches.'
    },
    arc: {
        n: 'Arc', el: 'light', tags: ['Spell', 'Lightning', 'Chaining'],
        mana: 17, cd: 0, castT: 0.4, dmg: [8, 118],
        d: 'Lightning does not aim. It decides. Wild damage range, forks into branches, 30% chance to shock (+40% damage taken).',
        shock: 0.3
    },
    meteor: {
        n: 'Voidfall Meteor', el: 'fire', tags: ['Spell', 'Fire', 'AoE', 'Duration'],
        mana: 52, cd: 8, castT: 0.55, dmg: [280, 420], radius: 2.6, delay: 1.1,
        d: 'Mark the ground. Regret arrives 1.1 seconds later from a very great height. Guaranteed ignite on a direct hit.'
    },
    frostnova: {
        n: 'Frost Nova', el: 'cold', tags: ['Spell', 'Cold', 'AoE', 'Nova'],
        mana: 21, cd: 2.5, castT: 0.3, dmg: [46, 72], radius: 3.4,
        d: 'A ring of expanding winter centered on you. Chills everything it passes through. SHATTERS frozen targets for 250% damage.'
    },
    umbralcoil: {
        n: 'Umbral Coil', el: 'chaos', tags: ['Spell', 'Chaos', 'Duration', 'Projectile'],
        mana: 24, cd: 0.8, castT: 0.45, dmg: [12, 18], dot: [22, 30], dotT: 6, maxStk: 5,
        d: 'A lance of living dark that leaves a coil feeding on the target. Stacks 5 times. Chaos damage ignores half of resistance, because chaos.'
    },
    flamedash: {
        n: 'Flame Dash', el: 'fire', tags: ['Spell', 'Movement', 'Fire', 'Travel'],
        mana: 12, cd: 3.2, charges: 2, castT: 0, dmg: [0, 0],
        d: 'Be somewhere else, leave fire where you were. Two charges. The trail lightly singes regret into the floor.'
    },
    arcanesurge: {
        n: 'Arcane Surge', el: 'light', tags: ['Spell', 'Buff', 'Arcane'],
        mana: 30, cd: 14, castT: 0.25, dmg: [0, 0], buffT: 8,
        d: 'Overclock the veil for 8s: +30% cast speed, +20% spell damage, mana regeneration doubled. The comedown is not modelled. Yet.'
    },
    sigil: {
        n: 'Sigil of Ruin', el: 'chaos', tags: ['Spell', 'Curse', 'Mark', 'Duration'],
        mana: 26, cd: 6, castT: 0.35, dmg: [0, 0], curseT: 9,
        d: 'Brand the target with a slow-turning ring of bad decisions. Cursed targets take 25% increased damage from everything, including opinions.'
    },
    basalt: {
        n: 'Basalt Spear', el: 'phys', tags: ['Spell', 'Projectile', 'Physical'],
        mana: 11, cd: 0, castT: 0.38, dmg: [58, 86], speed: 11,
        d: 'A spear of honest rock. No element, no tricks — the one thing on this list the dummy’s armour actually argues with.'
    }
};
var SPELL_IDS = Object.keys(SPELLS);
// slot keys deliberately avoid WASD: W is for walking, not for machine-gunning Arc
var SLOT_KEYS = ['LMB', 'RMB', 'Q', 'E', 'R', 'T'];
var DEFAULT_BINDS = { LMB: 'emberbolt', RMB: 'frostnova', Q: 'glacialray', E: 'arc', R: 'meteor', T: 'umbralcoil' };

/* ─────────────── the passive web ───────────────
   Three branches out of a core: PYRE (fire/crit), RIME
   (cold/defence), STORM (lightning/speed) + a chaos spine.
   pos is layout-space; the tree panel pans around it. */
var PASSIVES = [
    { id: 'core', n: 'The First Spark', x: 0, y: 0, m: {}, d: 'Where every exile starts. Allocating this costs nothing and means everything.', free: 1 },
    // spine north — life & mana
    { id: 'n1', n: 'Vital Thread', x: 0, y: -70, m: { life: 30 }, req: ['core'] },
    { id: 'n2', n: 'Deep Reserves', x: 0, y: -140, m: { mana: 40 }, req: ['n1'] },
    { id: 'n3', n: 'Twin Currents', x: -55, y: -195, m: { life: 20, mana: 20 }, req: ['n2'] },
    { id: 'n4', n: 'Overflowing Veil', x: 55, y: -195, m: { manaRegen: 35 }, req: ['n2'] },
    { id: 'n5', n: 'HEARTWOOD', x: 0, y: -265, m: { life: 60, lifeRegen: 1 }, req: ['n3', 'n4'], notable: 1, d: 'The dummy respects nothing but staying power.' },
    // PYRE branch — west
    { id: 'p1', n: 'Kindling', x: -80, y: 30, m: { fire: 12 }, req: ['core'] },
    { id: 'p2', n: 'Dry Season', x: -150, y: 55, m: { fire: 12, sd: 6 }, req: ['p1'] },
    { id: 'p3', n: 'First Degree', x: -220, y: 30, m: { igniteCh: 10 }, req: ['p2'] },
    { id: 'p4', n: 'Accelerant', x: -220, y: 105, m: { igniteDmg: 25 }, req: ['p3'] },
    { id: 'p5', n: 'Searing Focus', x: -150, y: 130, m: { fire: 15, crit: 3 }, req: ['p2'] },
    { id: 'p6', n: 'PYRECALLER', x: -290, y: 70, m: { fire: 30, igniteCh: 15, igniteDmg: 30 }, req: ['p3', 'p4'], notable: 1, d: 'Everything you cast smells faintly of campfire. This is a buff.' },
    { id: 'p7', n: 'Ashen Path', x: -290, y: 145, m: { move: 8, fire: 8 }, req: ['p6'] },
    // RIME branch — east
    { id: 'r1', n: 'First Frost', x: 80, y: 30, m: { cold: 12 }, req: ['core'] },
    { id: 'r2', n: 'Thick Ice', x: 150, y: 55, m: { cold: 12, life: 15 }, req: ['r1'] },
    { id: 'r3', n: 'Deep Winter', x: 220, y: 30, m: { chillPow: 20 }, req: ['r2'] },
    { id: 'r4', n: 'Long Night', x: 220, y: 105, m: { freezeCh: 8 }, req: ['r3'] },
    { id: 'r5', n: 'Glacier Blood', x: 150, y: 130, m: { cold: 15, mana: 25 }, req: ['r2'] },
    { id: 'r6', n: 'THE STILL POINT', x: 290, y: 70, m: { cold: 30, freezeCh: 12, shatter: 50 }, req: ['r3', 'r4'], notable: 1, d: 'Frozen things break beautifully. +50% shatter damage.' },
    { id: 'r7', n: 'Rimewalk', x: 290, y: 145, m: { move: 8, cold: 8 }, req: ['r6'] },
    // STORM branch — south
    { id: 's1', n: 'Static Charge', x: 0, y: 85, m: { light: 12 }, req: ['core'] },
    { id: 's2', n: 'Conductor', x: -55, y: 150, m: { light: 12, cast: 5 }, req: ['s1'] },
    { id: 's3', n: 'Live Wire', x: 55, y: 150, m: { shockCh: 10 }, req: ['s1'] },
    { id: 's4', n: 'Storm Vessel', x: 0, y: 215, m: { light: 15, crit: 4 }, req: ['s2', 's3'] },
    { id: 's5', n: 'TEMPEST LOGIC', x: 0, y: 290, m: { light: 30, shockCh: 15, cast: 10 }, req: ['s4'], notable: 1, d: 'Lightning does not aim. You, however, have started to.' },
    // chaos spine — the corners
    { id: 'c1', n: 'Whisper', x: -120, y: -80, m: { chaos: 14 }, req: ['n1', 'p1'] },
    { id: 'c2', n: 'Umbral Taste', x: 120, y: -80, m: { chaos: 14 }, req: ['n1', 'r1'] },
    { id: 'c3', n: 'VOIDTOUCHED', x: 0, y: -60, m: { chaos: 25, dotDmg: 30 }, req: ['c1', 'c2'], notable: 1, d: 'Your damage-over-time now ticks with intent.' },
    // generic power ring
    { id: 'g1', n: 'Focused Mind', x: -80, y: -35, m: { sd: 8 }, req: ['core'] },
    { id: 'g2', n: 'Sharpened Will', x: 80, y: -35, m: { sd: 8 }, req: ['core'] },
    { id: 'g3', n: 'Lethality', x: -150, y: -20, m: { crit: 5 }, req: ['g1'] },
    { id: 'g4', n: 'Ruthless Arithmetic', x: 150, y: -20, m: { critMul: 20 }, req: ['g2'] },
    { id: 'g5', n: 'Quick Study', x: -80, y: -110, m: { cast: 8 }, req: ['g1'] },
    { id: 'g6', n: 'Patient Study', x: 80, y: -110, m: { manaRegen: 20 }, req: ['g2'] },
    { id: 'g7', n: 'THE LONG GAME', x: 0, y: -340, m: { sd: 20, life: 40, mana: 40 }, req: ['n5'], notable: 1, d: 'One must imagine the exile levelling.' },
    // ── keystones: behavioural forks, not stat sticks (see KEYSTONES) ──
    { id: 'ks_avatar', n: 'AVATAR OF FIRE', x: -360, y: 175, m: {}, req: ['p7'], keystone: 'avatar' },
    { id: 'ks_glass', n: 'GLASS CANNON', x: 360, y: 175, m: {}, req: ['r7'], keystone: 'glass' },
    { id: 'ks_overload', n: 'ELEMENTAL OVERLOAD', x: 0, y: 360, m: {}, req: ['s5'], keystone: 'overload' },
    { id: 'ks_resolute', n: 'RESOLUTE TECHNIQUE', x: 215, y: -25, m: {}, req: ['g4'], keystone: 'resolute' }
];
var PASS_BY_ID = {}; PASSIVES.forEach(function (p) { PASS_BY_ID[p.id] = p; });

/* what each stat key means in the character sheet */
var STAT_LABELS = {
    sd: 'increased Spell Damage', fire: 'increased Fire Damage', cold: 'increased Cold Damage',
    light: 'increased Lightning Damage', chaos: 'increased Chaos Damage', crit: 'to Critical Strike Chance',
    critMul: 'to Critical Strike Multiplier', cast: 'increased Cast Speed', mana: 'to Maximum Mana',
    manaRegen: 'increased Mana Regeneration', life: 'to Maximum Life', lifeRegen: 'Life Regeneration per second',
    move: 'increased Movement Speed', igniteCh: 'chance to Ignite', igniteDmg: 'increased Ignite Damage',
    chillPow: 'increased Chill Effect', freezeCh: 'chance to Freeze', shockCh: 'chance to Shock',
    shatter: 'increased Shatter Damage', dotDmg: 'increased Damage over Time'
};

/* ─────────────── loot ───────────────
   The dummy is generous in death. Bases × rarities × affixes. */
var BASES = [
    { id: 'staff', n: 'Ashwood Staff', slot: 'weapon', imp: { sd: 10 } },
    { id: 'sceptre', n: 'Void Sceptre', slot: 'weapon', imp: { chaos: 12 } },
    { id: 'wand', n: 'Spiral Wand', slot: 'weapon', imp: { cast: 6 } },
    { id: 'ring', n: 'Iron Ring', slot: 'ring', imp: { life: 10 } },
    { id: 'moonring', n: 'Moonstone Ring', slot: 'ring', imp: { mana: 15 } },
    { id: 'amulet', n: 'Jade Amulet', slot: 'amulet', imp: { manaRegen: 10 } },
    { id: 'onyx', n: 'Onyx Amulet', slot: 'amulet', imp: { sd: 6, crit: 2 } }
];
var AFFIXES = [
    ['of Embers', { fire: 10 }, 'Flaming', { fire: 14 }],
    ['of Sleet', { cold: 10 }, 'Frosted', { cold: 14 }],
    ['of Sparks', { light: 10 }, 'Humming', { light: 14 }],
    ['of the Void', { chaos: 10 }, 'Umbral', { chaos: 14 }],
    ['of Precision', { crit: 3 }, 'Keen', { crit: 5 }],
    ['of Ferocity', { critMul: 12 }, 'Cruel', { critMul: 18 }],
    ['of Haste', { cast: 6 }, 'Nimble', { cast: 9 }],
    ['of the Well', { mana: 20 }, 'Brimming', { mana: 30 }],
    ['of the Oak', { life: 20 }, 'Stalwart', { life: 30 }],
    ['of Focus', { sd: 8 }, 'Potent', { sd: 12 }]
];
var RARITY = { normal: '#c8c2b8', magic: '#8888ff', rare: '#ffff77', unique: '#af6025' };

/* the one unique. every arpg needs its first unique. */
var UNIQUE_BOX = {
    uid: 'thebox', n: 'The Box', base: 'Intercooler-Shaped Reliquary', slot: 'amulet', rarity: 'unique',
    mods: { sd: 25, fire: 20, life: 30 },
    flavor: 'It has been in the trunk since session one.\nIt is fine. It is FINE.'
};

/* ─────────────── achievements ─────────────── */
var ACH = [
    ['spark', 'First Spark', 'Cast your first spell in the proving grounds'],
    ['blood', 'First Blood', 'Hit the training dummy. It forgives you'],
    ['slain', 'Dummy Slain', 'Reduce the dummy to its component philosophies'],
    ['serial', 'Serial Offender', 'Destroy the dummy 10 times'],
    ['crit10', 'Critical Acclaim', 'Land 10 critical strikes'],
    ['overkill', 'Overkill', 'Deal 1,000+ damage in a single hit'],
    ['storm', 'Perfect Storm', 'Have a target ignited, chilled and shocked at once'],
    ['shatter', 'Glass Cannon', 'Shatter a frozen dummy with Frost Nova'],
    ['direct', 'Orbital Opinion', 'Land Voidfall Meteor dead centre'],
    ['level5', 'Ascendant', 'Reach level 5'],
    ['web10', 'Web of Fate', 'Allocate 10 passive skills'],
    ['patient', 'The Patient One', 'Stand in the arena for 60 seconds without casting'],
    ['speed', 'Speedrun Strats', 'Destroy a fresh dummy in under 15 seconds'],
    ['unique', 'It Was In The Trunk', 'Loot The Box']
];

/* ═══════════════ DEPTH EXPANSION DATA ═══════════════
   Enemies, support gems, keystones, and the Trials mode —
   everything the story-less proving grounds needs to become
   an actual game loop. Kept data-first so the systems below
   read clean. */

/* ─────────────── enemy archetypes ───────────────
   hp/dmg are BASE (wave 1); waveScale() grows them.
   ai: 'melee' chases + touches, 'charger' rushes + detonates,
   'ranged' kites + lobs, 'boss' has a phase script. */
var ENEMIES = {
    wretch: {
        n: 'Wretch', ai: 'melee', hp: 34, dmg: 8, speed: 2.7, r: 0.42,
        xp: 42, shards: [0, 1], col: ['#5a6a4a', '#3c4832', '#8fb06a'], atkCd: 0.9, atkRange: 0.75, tell: 0.28,
        d: 'A thin, fast thing. Comes in numbers. Individually unremarkable, collectively a problem.'
    },
    brute: {
        n: 'Brute', ai: 'melee', hp: 170, dmg: 26, speed: 1.5, r: 0.62,
        xp: 140, shards: [1, 3], col: ['#6a4a3a', '#4a3228', '#a8704a'], atkCd: 1.7, atkRange: 1.0, tell: 0.6, slam: 1,
        d: 'Slow, enormous, and telegraphs its swing a country mile in advance. Punish the wind-up.'
    },
    caster: {
        n: 'Hex-Caster', ai: 'ranged', hp: 72, dmg: 16, speed: 2.0, r: 0.46,
        xp: 110, shards: [1, 2], col: ['#4a3a6a', '#322850', '#8a6ad0'], atkCd: 2.0, atkRange: 6.5, kite: 3.2, tell: 0.5,
        d: 'Keeps its distance and lobs void-bolts. Close the gap or eat them.'
    },
    exploder: {
        n: 'Bloatling', ai: 'charger', hp: 48, dmg: 44, speed: 3.4, r: 0.5,
        xp: 90, shards: [1, 2], col: ['#6a6a2a', '#4a4a1e', '#c0c040'], atkRange: 1.1, tell: 0.55, boom: 2.2,
        d: 'Runs at you and detonates. The blast radius is generous. So is the warning, barely.'
    },
    warden: {
        n: 'THE WARDEN', ai: 'boss', hp: 2600, dmg: 34, speed: 1.35, r: 1.05, boss: 1,
        xp: 1400, shards: [12, 20], col: ['#3a2c5c', '#241a3c', '#a06adf'], atkCd: 2.4, atkRange: 1.4, tell: 0.7,
        d: 'The proving grounds keep one. It slams, it sweeps a beam, and when wounded it calls the Wretches in. It does not have a name in the story yet either.'
    }
};

/* ─────────────── support gems ───────────────
   sockets modify the linked spell. `mod` folds into spellDmg /
   cast; `flags` drive behaviour (echo, chain, added element). */
var GEMS = {
    aoe:     { n: 'Increased Area', col: '#6fd4ff', d: 'Area of effect +45%. Bigger meteors, wider novas, splashier bolts.', area: 0.45 },
    fast:    { n: 'Faster Casting', col: '#ffe66e', d: 'Cast speed +35% for the linked spell (mana cost +15%).', cast: 35, manaInc: 0.15 },
    echo:    { n: 'Spell Echo', col: '#c896ff', d: 'The linked spell repeats once, a beat later. Mana cost +40%.', echo: 1, manaInc: 0.4 },
    chain:   { n: 'Chaining', col: '#9fe0c8', d: 'Projectiles and Arc leap to a second nearby target for 70% damage.', chain: 1 },
    addcold: { n: 'Added Cold', col: '#6fd4ff', d: 'Adds a cold hit worth 40% of the spell, and can chill.', add: 'cold', addPct: 0.4 },
    addfire: { n: 'Added Fire', col: '#ff7a2e', d: 'Adds a fire hit worth 40% of the spell, and can ignite.', add: 'fire', addPct: 0.4 },
    iron:    { n: 'Iron Will', col: '#c8c2b8', d: 'Linked spell deals +40% damage, but costs +45% mana.', more: 0.4, manaInc: 0.45 },
    pierce:  { n: 'Deep Cut', col: '#ff6a8a', d: 'Projectiles pass through the first target and keep going.', pierce: 1 }
};
var GEM_IDS = Object.keys(GEMS);

/* ─────────────── keystones (tree nodes with teeth) ───────────────
   applied as flags in statSum; each is a real behavioural fork. */
var KEYSTONES = {
    resolute:  { n: 'RESOLUTE TECHNIQUE', d: 'Your hits can never be critical — but they deal +45% more damage and never stray. Consistency is its own violence.' },
    overload:  { n: 'ELEMENTAL OVERLOAD', d: 'Fire, Cold and Lightning damage +50% — but your critical multiplier is fixed at 1.5. The elements do not care how sharp your knife is.' },
    avatar:    { n: 'AVATAR OF FIRE', d: 'Half of all your non-fire damage is converted to Fire, and you gain +25% chance to ignite. Everything burns eventually.' },
    glass:     { n: 'GLASS CANNON', d: '+60% spell damage. -45% maximum life. The proving grounds will teach you why the name.' }
};

/* ─────────────── the Trials — escalating waves ───────────────
   sandbox stays the default; a rune at arena centre starts a run. */
function waveScale(w) { return { hp: 1 + (w - 1) * 0.42 + Math.pow(w, 1.5) * 0.03, dmg: 1 + (w - 1) * 0.22, count: Math.min(14, 3 + Math.floor(w * 1.35)) }; }
function waveIsBoss(w) { return w % 5 === 0; }
function wavePool(w) {
    // early waves: wretches; mix in brutes/casters/exploders as depth grows
    var pool = ['wretch', 'wretch'];
    if (w >= 2) pool.push('exploder');
    if (w >= 3) pool.push('caster', 'wretch');
    if (w >= 4) pool.push('brute');
    if (w >= 6) pool.push('caster', 'brute', 'exploder');
    return pool;
}

/* extra achievements for the new content (appended to ACH in ar_01) */
ACH.push(
    ['firstkill', 'It Fights Back', 'Kill something that was trying to kill you'],
    ['wave5', 'Depths', 'Reach wave 5 of the Trials'],
    ['wave10', 'The Long Dark', 'Reach wave 10 of the Trials'],
    ['warden', 'Warden Down', 'Defeat THE WARDEN'],
    ['nohit', 'Untouched', 'Clear a Trial wave without taking damage'],
    ['socket', 'Well Linked', 'Socket a support gem into a spell'],
    ['keystone', 'Point of No Return', 'Allocate a keystone'],
    ['craft', 'Bench Time', 'Reforge an item at the crafting bench'],
    ['die', 'Mortal After All', 'Fall in the proving grounds (it happens to everyone)']
);

/* ─────────────── save state ─────────────── */
var S = null;
function sLoad() {
    if (S) return;
    try { S = JSON.parse(localStorage.getItem('comp_arpg') || 'null'); } catch (e) { S = null; }
    if (!S) S = {};
    S.lv = S.lv || 1; S.xp = S.xp || 0; S.pts = S.pts == null ? 2 : S.pts;
    S.alloc = S.alloc || { core: 1 };
    S.binds = S.binds || JSON.parse(JSON.stringify(DEFAULT_BINDS));
    // migrate/sanitize binds: old saves used W as a slot key, and a bind may
    // point at a spell id that no longer exists — either would brick init
    if (S.binds.W !== undefined) S.binds = JSON.parse(JSON.stringify(DEFAULT_BINDS));
    SLOT_KEYS.forEach(function (k) { if (S.binds[k] && !SPELLS[S.binds[k]]) S.binds[k] = null; });
    S.gear = S.gear || {};             // slot -> item
    S.stash = S.stash || [];           // unequipped items (cap 8)
    S.shards = S.shards || 0;
    S.kills = S.kills || 0;
    S.ach = S.ach || {};
    S.crits = S.crits || 0;
    S.sound = S.sound == null ? true : S.sound;
    S.dummy = S.dummy || { hpm: 10000, armor: 0, res: { fire: 0, cold: 0, light: 0, chaos: 0 }, regen: false };
    // depth expansion
    S.sockets = S.sockets || {};       // slot -> [gemId, gemId] (max 2)
    S.gems = S.gems || {};             // gemId -> owned count in the bag
    S.bestWave = S.bestWave || 0;      // deepest Trial reached
    S.opts = S.opts || {};
    if (S.opts.shake == null) S.opts.shake = true;
    if (S.opts.nums == null) S.opts.nums = true;
    if (S.opts.parts == null) S.opts.parts = 2;   // 0 low / 1 med / 2 high
    // sockets pointing at a slot with no bound spell, or holding a retired gem, are dropped
    Object.keys(S.sockets).forEach(function (k) {
        if (SLOT_KEYS.indexOf(k) < 0 || !S.binds[k]) { delete S.sockets[k]; return; }
        S.sockets[k] = (S.sockets[k] || []).filter(function (g) { return GEMS[g]; }).slice(0, 2);
    });
}
function sSave() { try { localStorage.setItem('comp_arpg', JSON.stringify(S)); } catch (e) {} }
function xpNeed(lv) { return Math.floor(800 * Math.pow(1.55, lv - 1)); }

/* ─────────────── derived stats ───────────────
   base + passives + gear + buffs, computed fresh each time —
   nothing in the sheet is ever stale. */
function statSum() {
    var m = { sd: 0, fire: 0, cold: 0, light: 0, chaos: 0, crit: 0, critMul: 0, cast: 0, mana: 0, manaRegen: 0, life: 0, lifeRegen: 0, move: 0, igniteCh: 0, igniteDmg: 0, chillPow: 0, freezeCh: 0, shockCh: 0, shatter: 0, dotDmg: 0 };
    PASSIVES.forEach(function (p) {
        if (!S.alloc[p.id] || !p.m) return;
        Object.keys(p.m).forEach(function (k) { m[k] = (m[k] || 0) + p.m[k]; });
    });
    ['weapon', 'ring', 'amulet'].forEach(function (slot) {
        var it = S.gear[slot]; if (!it) return;
        [it.imp, it.mods].forEach(function (mm) {
            if (mm) Object.keys(mm).forEach(function (k) { m[k] = (m[k] || 0) + mm[k]; });
        });
    });
    if (RT && RT.buffs.surge > 0) { m.cast += 30; m.sd += 20; m.manaRegen += 100; }
    return m;
}
function hasKs(id) { return !!(S.alloc['ks_' + id]); }
function stats() {
    var m = statSum();
    var ks = { resolute: hasKs('resolute'), overload: hasKs('overload'), avatar: hasKs('avatar'), glass: hasKs('glass') };
    if (ks.glass) m.sd += 60;
    if (ks.overload) { m.fire += 50; m.cold += 50; m.light += 50; }
    if (ks.avatar) m.igniteCh += 25;
    var lifeMax = Math.round((320 + (S.lv - 1) * 22 + m.life) * (ks.glass ? 0.55 : 1));
    return {
        m: m, ks: ks,
        lifeMax: lifeMax,
        manaMax: Math.round((180 + (S.lv - 1) * 14 + m.mana)),
        manaRegen: 8 * (1 + m.manaRegen / 100),
        lifeRegen: m.lifeRegen || 0,
        castSpd: 1 * (1 + m.cast / 100),
        critCh: ks.resolute ? 0 : clamp(8 + m.crit, 0, 95),
        critMul: ks.overload ? 1.5 : 1.5 + m.critMul / 100,
        moreMul: ks.resolute ? 1.45 : 1,        // Resolute trades crits for flat "more"
        move: 3.1 * (1 + m.move / 100),
        igniteCh: m.igniteCh, igniteDmg: m.igniteDmg, chillPow: m.chillPow,
        freezeCh: m.freezeCh, shockCh: m.shockCh, shatter: m.shatter, dotDmg: m.dotDmg
    };
}
/* which support gems are linked to a slot (max 2), and to a spell for tooltips */
function slotGems(slot) { return (S.sockets[slot] || []).filter(function (g) { return GEMS[g]; }); }
function gemMod(gems, key) { var v = 0; (gems || []).forEach(function (g) { if (GEMS[g] && GEMS[g][key]) v += GEMS[g][key]; }); return v; }
function gemHas(gems, key) { return (gems || []).some(function (g) { return GEMS[g] && GEMS[g][key]; }); }
/* a spell's damage range with every modifier applied (for tooltips AND for hits).
   `gems` are the support gems linked to the slot casting it. */
function spellDmg(id, gems) {
    var sp = SPELLS[id], st = stats(), m = st.m;
    var lvMul = 1 + (S.lv - 1) * 0.12;
    var inc = 1 + (m.sd + (m[sp.el] || 0)) / 100;
    var more = st.moreMul * (1 + gemMod(gems, 'more'));
    return { lo: sp.dmg[0] * lvMul * inc * more, hi: sp.dmg[1] * lvMul * inc * more, st: st, gems: gems || [] };
}
function spellManaCost(id, gems) { return Math.round(SPELLS[id].mana * (1 + gemMod(gems, 'manaInc'))); }

/* ─────────────── item generation ─────────────── */
function rollItem() {
    // 1-in-40 The Box (once); 15% rare; 45% magic; rest normal
    if (!S.ach.unique && Math.random() < 0.025) {
        var u = JSON.parse(JSON.stringify(UNIQUE_BOX));
        return u;
    }
    var base = pick(BASES), r = Math.random();
    var rarity = r < 0.15 ? 'rare' : r < 0.6 ? 'magic' : 'normal';
    var it = { uid: 'i' + Date.now() + irnd(0, 999), base: base.n, slot: base.slot, imp: base.imp, rarity: rarity, mods: {} };
    var nAff = rarity === 'rare' ? irnd(3, 4) : rarity === 'magic' ? irnd(1, 2) : 0;
    var used = {}, prefix = '', suffix = '';
    for (var i = 0; i < nAff; i++) {
        var ai = irnd(0, AFFIXES.length - 1); if (used[ai]) continue; used[ai] = 1;
        var a = AFFIXES[ai], hi = Math.random() < 0.4;
        var mods = hi ? a[3] : a[1];
        Object.keys(mods).forEach(function (k) { it.mods[k] = (it.mods[k] || 0) + mods[k]; });
        if (!prefix && hi) prefix = a[2];
        else if (!suffix) suffix = a[0];
    }
    it.n = rarity === 'rare' ? rareName() : ((prefix ? prefix + ' ' : '') + base.n + (suffix ? ' ' + suffix : ''));
    if (rarity !== 'rare' && rarity !== 'normal' && !prefix && !suffix) it.n = base.n;
    if (rarity === 'normal') it.n = base.n;
    return it;
}
var RARE_A = ['Doom', 'Ember', 'Ghoul', 'Storm', 'Vex', 'Rune', 'Sol', 'Grim', 'Ash', 'Dusk'];
var RARE_B = ['whisper', 'bite', 'call', 'weaver', 'brand', 'ward', 'song', 'coil', 'mark', 'fall'];
function rareName() { return pick(RARE_A) + pick(RARE_B); }
function itemTip(it) {
    var lines = ['<b class="ar-it-n" style="color:' + RARITY[it.rarity] + '">' + esc(it.n) + '</b>'];
    if (it.rarity !== 'normal' && it.base !== it.n) lines.push('<i class="ar-it-b">' + esc(it.base) + '</i>');
    lines.push('<i class="ar-it-b dim">' + esc(it.slot.toUpperCase()) + '</i>', '<span class="ar-sep"></span>');
    if (it.imp) Object.keys(it.imp).forEach(function (k) { lines.push('<span class="ar-it-imp">+' + it.imp[k] + (isPct(k) ? '%' : '') + ' ' + esc(STAT_LABELS[k] || k) + '</span>'); });
    if (it.mods && Object.keys(it.mods).length) {
        lines.push('<span class="ar-sep"></span>');
        Object.keys(it.mods).forEach(function (k) { lines.push('<span class="ar-it-mod">+' + it.mods[k] + (isPct(k) ? '%' : '') + ' ' + esc(STAT_LABELS[k] || k) + '</span>'); });
    }
    if (it.flavor) lines.push('<span class="ar-sep"></span>', '<i class="ar-it-fl">' + esc(it.flavor).replace(/\n/g, '<br>') + '</i>');
    return lines.join('');
}
function isPct(k) { return !(k === 'mana' || k === 'life' || k === 'critMul' || k === 'lifeRegen'); }

/* ─────────────── achievements ─────────────── */
function ach(id) {
    if (S.ach[id]) return;
    S.ach[id] = 1; sSave();
    var a = null; ACH.forEach(function (x) { if (x[0] === id) a = x; });
    if (a && RT) {
        RT.achToasts.push({ t: 3.6, n: a[1], d: a[2] });
        logLine('<b class="ar-log-ach">Achievement — ' + esc(a[1]) + '</b>', 'ach');
    }
}

/* ─────────────── DOM scaffold ───────────────
   One world canvas underneath; the HUD is DOM (crisp text,
   real tooltips) with small canvases where liquid or icons
   need to breathe: two globes, six skill icons, the tree. */
function render() {
    var slots = SLOT_KEYS.map(function (k) {
        return '<div class="ar-slot" data-slot="' + k + '"><canvas width="46" height="46"></canvas>' +
            '<span class="ar-slot-cd"></span><span class="ar-slot-key">' + k + '</span></div>';
    }).join('');
    var flasks = [1, 2, 3].map(function (i) {
        return '<div class="ar-flask" data-flask="' + i + '"><div class="ar-flask-liq"></div><div class="ar-flask-glass"></div>' +
            '<span class="ar-flask-pips"></span><span class="ar-slot-key">' + i + '</span></div>';
    }).join('');
    return '<div class="ar" tabindex="0">' +
        '<canvas class="ar-cv" width="' + VW + '" height="' + VH + '"></canvas>' +

        // top: dummy boss bar + buffs + arena title
        '<div class="ar-boss"><span class="ar-boss-n">TRAINING DUMMY, THE PATIENT</span>' +
          '<div class="ar-boss-bar"><i></i><em></em></div><span class="ar-boss-hp"></span>' +
          '<div class="ar-boss-status"></div></div>' +
        '<div class="ar-buffs"></div>' +
        '<div class="ar-zone"><b>THE PROVING GROUNDS</b><i>act 0 · the story is still being written</i></div>' +

        // trials control + wave/shards readout
        '<div class="ar-trials"><button class="ar-trialbtn" data-ar="trial" type="button">▶ ENTER THE TRIALS</button>' +
          '<div class="ar-wave" hidden><b class="ar-wave-n"></b><span class="ar-wave-sub"></span><button class="ar-mini" data-ar="abandon" type="button">abandon</button></div>' +
          '<div class="ar-shards">◈ <b class="ar-shards-n">0</b> shards · best wave <b class="ar-best">0</b></div></div>' +

        // right column: dps meter + minimap-ish ornament
        '<div class="ar-dps"><b>DPS</b><span class="ar-dps-now">0</span>' +
          '<div class="ar-dps-rows"><span>peak <i class="ar-dps-peak">0</i></span><span>total <i class="ar-dps-total">0</i></span><span>time <i class="ar-dps-time">0.0s</i></span></div>' +
          '<button class="ar-mini" data-ar="dpsreset" type="button">reset</button></div>' +

        // combat log
        '<div class="ar-log"><div class="ar-log-scroll"></div><span class="ar-log-title">combat log</span></div>' +

        // bottom HUD: globes, skills, flasks, xp
        '<div class="ar-hud">' +
          '<div class="ar-globe ar-globe-hp"><canvas width="104" height="104"></canvas><span class="ar-globe-t"></span></div>' +
          '<div class="ar-mid">' +
            '<div class="ar-flasks">' + flasks + '</div>' +
            '<div class="ar-slots">' + slots + '</div>' +
            '<div class="ar-panelbtns">' +
              '<button class="ar-pbtn" data-ar="char" type="button" title="Character (C)">C</button>' +
              '<button class="ar-pbtn" data-ar="book" type="button" title="Spellbook (B)">B</button>' +
              '<button class="ar-pbtn" data-ar="tree" type="button" title="Passives (P)">P</button>' +
              '<button class="ar-pbtn" data-ar="craft" type="button" title="Crafting bench (K)">K</button>' +
              '<button class="ar-pbtn" data-ar="dummy" type="button" title="Dummy config (O)">O</button>' +
              '<button class="ar-pbtn" data-ar="opts" type="button" title="Options">⚙</button>' +
              '<button class="ar-pbtn" data-ar="snd" type="button" title="Sound">♪</button>' +
            '</div>' +
          '</div>' +
          '<div class="ar-globe ar-globe-mp"><canvas width="104" height="104"></canvas><span class="ar-globe-t"></span></div>' +
        '</div>' +
        '<div class="ar-xp"><i></i><span class="ar-xp-t"></span></div>' +

        // panels (hidden until toggled)
        '<div class="ar-panel ar-p-char" hidden><header>CHARACTER<button class="ar-x" type="button">×</button></header><div class="ar-p-body"></div></div>' +
        '<div class="ar-panel ar-p-book" hidden><header>SPELLBOOK<button class="ar-x" type="button">×</button></header><div class="ar-p-body"></div></div>' +
        '<div class="ar-panel ar-p-tree" hidden><header>THE WEB OF FATE<span class="ar-tree-pts"></span><button class="ar-x" type="button">×</button></header>' +
          '<canvas class="ar-tree-cv" width="560" height="430"></canvas><div class="ar-tree-tip" hidden></div></div>' +
        '<div class="ar-panel ar-p-dummy" hidden><header>DUMMY CONFIGURATION<button class="ar-x" type="button">×</button></header><div class="ar-p-body"></div></div>' +
        '<div class="ar-panel ar-p-craft" hidden><header>THE CRAFTING BENCH<span class="ar-craft-sh"></span><button class="ar-x" type="button">×</button></header><div class="ar-p-body"></div></div>' +
        '<div class="ar-panel ar-p-opts" hidden><header>OPTIONS<button class="ar-x" type="button">×</button></header><div class="ar-p-body"></div></div>' +

        // floating layers
        '<div class="ar-tip" hidden></div>' +
        '<div class="ar-achq"></div>' +
        '<div class="ar-vig"></div>' +
    '</div>';
}

/* ─────────────── runtime ─────────────── */
var RT = null;
function init(el) {
    sLoad();
    var root = el.querySelector('.ar');
    var cv = root.querySelector('.ar-cv'), cx = cv.getContext('2d');
    RT = {
        el: el, root: root, cv: cv, cx: cx,
        started: Date.now(), t: 0, raf: 0, last: 0, timers: [],
        keys: {}, mouse: { x: VW / 2, y: VH / 2, wx: 0, wy: 0, down: false, rdown: false },
        px: GRID / 2, py: GRID / 2 + 3.5, vx: 0, vy: 0, face: 0,        // exile world pos (tiles)
        moveTo: null, casting: null, channel: null, castHold: null,
        dashCharges: 2, dashCd: 0, dashTrail: [],
        life: 0, mana: 0,                                              // set from stats below
        cds: {}, gcd: 0,
        buffs: { surge: 0, quick: 0 },
        flasks: [
            { n: 'Bubbling Life Flask', kind: 'life', charges: 3, max: 3, anim: 0 },
            { n: 'Sapphire Mana Flask', kind: 'mana', charges: 3, max: 3, anim: 0 },
            { n: 'Quicksilver Flask', kind: 'quick', charges: 2, max: 2, anim: 0 }
        ],
        dummy: mkDummy(),
        mode: 'sandbox',                                              // 'sandbox' | 'trial'
        enemies: [], eproj: [],                                       // enemies + their projectiles
        trial: null,                                                  // { wave, phase, timer, cleared, tookHit, score }
        dead: false, deadT: 0, invuln: 0, hurtT: 0,                   // player mortality
        banner: null,                                                 // { txt, sub, t }
        parts: [], projs: [], beams: [], rings: [], decals: [], bolts: [], nums: [], meteors: [],
        shake: 0, flash: 0, hitstop: 0,
        dps: { total: 0, peak: 0, t0: 0, hist: [] },
        idleT: 0, castAny: false,
        achToasts: [],
        treePan: { x: 0, y: 0, drag: null },
        panel: null, logN: 0,
        ac: null
    };
    var st = stats();
    RT.life = st.lifeMax; RT.mana = st.manaMax;
    wireInput(root, cv);
    buildFloor();
    paintSlots();
    updateHud(0);
    logLine('<b>Welcome to the proving grounds.</b> The dummy has been informed.', 'sys');
    logLine('WASD or click to move · LMB/RMB + Q/E/R/T to cast · Space to dash · C B P O for panels', 'dim');
    RT.last = performance.now();
    RT.raf = requestAnimationFrame(frame);
    // test handle for headless driving (rAF is frozen there — tick() advances manually)
    if (/[?&]dev=/.test(location.search)) {
        window.__arpg = {
            tick: function (n, dt) { for (var i = 0; i < (n || 1); i++) step(dt || 1 / 60); draw(); },
            cast: function (id, gems) { tryCast(id, RT.mouse.wx, RT.mouse.wy, gems || []); },
            aimAtDummy: function () { var d = RT.dummy; RT.mouse.wx = d.x; RT.mouse.wy = d.y; RT.mouse.x = isoX(d.x, d.y); RT.mouse.y = isoY(d.x, d.y); },
            aimAt: function (x, y) { RT.mouse.wx = x; RT.mouse.wy = y; RT.mouse.x = isoX(x, y); RT.mouse.y = isoY(x, y); },
            startTrial: function () { startTrial(); }, endTrial: function () { endTrial(false); },
            spawn: function (kind, x, y) { return spawnEnemy(kind, x == null ? GRID / 2 : x, y == null ? GRID / 2 - 3 : y, { hp: 1, dmg: 1 }); },
            state: function () { return { life: RT.life, mana: RT.mana, dummyHp: RT.dummy.hp, lv: S.lv, xp: S.xp, kills: S.kills, dps: RT.dps, statuses: RT.dummy.st, mode: RT.mode, enemies: RT.enemies.filter(function (e) { return !e.dead; }).length, dead: RT.dead, wave: RT.trial ? RT.trial.wave : 0, shards: S.shards }; },
            S: function () { return S; }, RT: function () { return RT; }
        };
    }
    // headless screenshot state: pre-simulate a combat burst synchronously
    // (?dev=arpg&adev=demo — rAF may be frozen there, so we advance by hand)
    if (/adev=demo/.test(location.search)) {
        var d0 = RT.dummy;
        RT.mouse.wx = d0.x; RT.mouse.wy = d0.y;
        RT.mouse.x = isoX(d0.x, d0.y); RT.mouse.y = isoY(d0.x, d0.y);
        function tk(n) { for (var i = 0; i < n; i++) step(1 / 60); }
        tryCast('emberbolt', d0.x, d0.y); tk(50);
        tryCast('arc', d0.x, d0.y); tk(30);
        tryCast('sigil', d0.x, d0.y); tk(30);
        tryCast('meteor', d0.x, d0.y); tk(96);   // land mid-explosion
        draw();
    }
    if (/adev=trial/.test(location.search)) {   // action shot: a live wave mid-fight
        function tk2(n) { for (var i = 0; i < n; i++) step(1 / 60); }
        S.gems.aoe = 1; S.gems.echo = 1;
        startTrial(); tk2(110);                  // wave 1 spawns
        for (var q = 0; q < 4; q++) { spawnEnemy('wretch', rnd(4, 11), rnd(4, 11), { hp: 1, dmg: 1 }); }
        spawnEnemy('brute', 10, 5, { hp: 1, dmg: 1 }); spawnEnemy('caster', 4, 10, { hp: 1, dmg: 1 });
        RT.life = stats().lifeMax * 0.62; RT.invuln = 99;
        var en = RT.enemies[0]; RT.mouse.wx = en.x; RT.mouse.wy = en.y;
        tryCast('emberbolt', en.x, en.y); tk2(14);
        tryCast('arc', en.x, en.y); tk2(10);
        tryCast('meteor', en.x, en.y); tk2(64);
        draw();
    }
    setTimeout(function () { root.focus(); }, 30);
}
function mkStatus() { return { ignite: [], chill: 0, freeze: 0, shock: 0, sigil: 0, coils: [] }; }
function mkDummy() {
    sLoad();
    return {
        isDummy: 1, kind: 'dummy', name: 'the dummy', r: 0.55,
        x: GRID / 2, y: GRID / 2 - 3.2, hp: S.dummy.hpm, hpm: S.dummy.hpm,
        dead: 0, respawn: 0, wobble: 0, flashT: 0, spawnT: 0,
        st: mkStatus(), lastReset: 0, bornAt: 0
    };
}

/* ─────────────── input ─────────────── */
function wireInput(root, cv) {
    function toWorld(e) {
        // the canvas letterboxes (object-fit: contain) — undo that mapping
        // exactly or every cast aims a little to the side of the cursor
        var r = cv.getBoundingClientRect();
        var scale = Math.min(r.width / VW, r.height / VH) || 1;
        var offX = (r.width - VW * scale) / 2, offY = (r.height - VH * scale) / 2;
        var mx = (e.clientX - r.left - offX) / scale, my = (e.clientY - r.top - offY) / scale;
        // invert iso: x-y = (mx-ORX)/(TW/2) ; x+y = (my-ORY)/(TH/2)
        var a = (mx - ORX) / (TILE_W / 2), b = (my - ORY) / (TILE_H / 2);
        return { x: mx, y: my, wx: (a + b) / 2, wy: (b - a) / 2 };
    }
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) {
        if (!RT) return;                          // bfcache can revive dead DOM
        var p = toWorld(e);
        RT.mouse.x = p.x; RT.mouse.y = p.y; RT.mouse.wx = p.wx; RT.mouse.wy = p.wy;
    });
    cv.addEventListener('pointerdown', function (e) {
        if (!RT) return;
        root.focus();
        var p = toWorld(e);
        RT.mouse.x = p.x; RT.mouse.y = p.y; RT.mouse.wx = p.wx; RT.mouse.wy = p.wy;
        if (RT.dead) return;
        if (e.button === 2) { RT.mouse.rdown = true; slotCast('RMB'); }
        else if (e.button === 0) {
            RT.mouse.down = true;
            // the arpg law: LMB moves on ground, casts on a target under the cursor; Shift forces the cast
            var near = nearestUnit(p.wx, p.wy, 1.35);
            if (e.shiftKey || near) slotCast('LMB');
            else RT.moveTo = { x: clamp(p.wx, 0.8, GRID - 0.8), y: clamp(p.wy, 0.8, GRID - 0.8) };
        }
    });
    window.addEventListener('pointerup', RT.mup = function (e) {
        if (!RT) return;
        if (e.button === 2) RT.mouse.rdown = false;
        if (e.button === 0) RT.mouse.down = false;
    });
    root.addEventListener('keydown', function (e) {
        if (!RT) return;
        if (e.altKey) return;                     // Alt belongs to the OS
        var k = e.key.toLowerCase();
        if (k === 'escape') { if (RT.panel) { togglePanel(null); e.stopPropagation(); } return; }
        RT.keys[k] = true;
        if (e.repeat && 'qert'.indexOf(k) >= 0) { e.preventDefault(); return; }   // holds walk, taps cast
        if (k === 'q') slotCast('Q');
        else if (k === 'e') slotCast('E');
        else if (k === 'r') slotCast('R');
        else if (k === 't') slotCast('T');
        else if (k === ' ') { e.preventDefault(); doDash(); }
        else if (k === '1') useFlask(0);
        else if (k === '2') useFlask(1);
        else if (k === '3') useFlask(2);
        else if (k === 'c') togglePanel('char');
        else if (k === 'b') togglePanel('book');
        else if (k === 'p') togglePanel('tree');
        else if (k === 'o') togglePanel('dummy');
        else if (k === 'k') togglePanel('craft');
        else if (k === 'h') RT.root.querySelector('.ar-log').classList.toggle('open');
        else return;
        e.preventDefault(); e.stopPropagation();
    });
    root.addEventListener('keyup', function (e) { if (RT) RT.keys[e.key.toLowerCase()] = false; });
    root.addEventListener('focusout', function (e) {
        // focus left the arena ENTIRELY (blur doesn't bubble; focusout does):
        // forget held keys so channels and walks don't run on keyups we'll never get
        if (!RT || (e.relatedTarget && root.contains(e.relatedTarget))) return;
        RT.keys = {}; RT.mouse.down = false; RT.mouse.rdown = false;
        endChannel();
    });
    wireHud(root);
}

/* ─────────────── the arena floor ───────────────
   Pre-rendered once to an offscreen canvas: cracked basalt
   diamonds, a rune circle at centre, torch mounts at the
   corners, everything falling away into void at the edges. */
var FLOOR = null;
function buildFloor() {
    FLOOR = document.createElement('canvas'); FLOOR.width = VW; FLOOR.height = VH;
    var g = FLOOR.getContext('2d');
    var seed = 114; function fr() { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; }
    g.fillStyle = '#07060c'; g.fillRect(0, 0, VW, VH);
    for (var y = 0; y < GRID; y++) for (var x = 0; x < GRID; x++) {
        var sx = isoX(x, y), sy = isoY(x, y);
        var edge = Math.min(x, y, GRID - 1 - x, GRID - 1 - y);
        var base = 18 + fr() * 10 + edge * 1.5;
        // diamond
        g.beginPath();
        g.moveTo(sx, sy); g.lineTo(sx + TILE_W / 2, sy + TILE_H / 2);
        g.lineTo(sx, sy + TILE_H); g.lineTo(sx - TILE_W / 2, sy + TILE_H / 2); g.closePath();
        var checker = (x + y) % 2 ? 3 : 0;
        g.fillStyle = 'rgb(' + Math.round(base + checker) + ',' + Math.round(base + checker - 2) + ',' + Math.round(base + checker + 6) + ')';
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1; g.stroke();
        // cracks
        if (fr() < 0.3) {
            g.strokeStyle = 'rgba(0,0,0,.5)';
            g.beginPath();
            var cx0 = sx + rnd2(fr) * 18, cy0 = sy + TILE_H / 2 + rnd2(fr) * 7;
            g.moveTo(cx0, cy0);
            for (var s = 0; s < 3; s++) { cx0 += rnd2(fr) * 10; cy0 += rnd2(fr) * 5; g.lineTo(cx0, cy0); }
            g.stroke();
        }
        // faint moss/ember flecks
        if (fr() < 0.2) { g.fillStyle = fr() < 0.5 ? 'rgba(120,60,20,.18)' : 'rgba(40,90,80,.14)'; g.fillRect(sx - 6 + fr() * 12, sy + 8 + fr() * 10, 3, 2); }
    }
    function rnd2(f) { return (f() - 0.5) * 2; }
    // rune circle at centre
    var ccx = isoX(GRID / 2, GRID / 2), ccy = isoY(GRID / 2, GRID / 2);
    g.save(); g.translate(ccx, ccy); g.scale(1, 0.5);
    g.strokeStyle = 'rgba(138,74,224,.28)'; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 118, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(138,74,224,.16)';
    g.beginPath(); g.arc(0, 0, 96, 0, TAU); g.stroke();
    for (var r = 0; r < 14; r++) {
        var an = r / 14 * TAU;
        g.fillStyle = 'rgba(160,110,240,.30)';
        g.save(); g.translate(Math.cos(an) * 107, Math.sin(an) * 107); g.rotate(an);
        g.fillRect(-3, -3, 6, 6); g.restore();
    }
    g.restore();
    // void edge: darken the outer ring of tiles
    var grad = g.createRadialGradient(VW / 2, VH / 2 - 30, 160, VW / 2, VH / 2, 520);
    grad.addColorStop(0, 'rgba(4,3,8,0)'); grad.addColorStop(1, 'rgba(4,3,8,.96)');
    g.fillStyle = grad; g.fillRect(0, 0, VW, VH);
}

/* braziers at the four corners (drawn live for flicker) */
var BRAZIERS = [[1.6, 1.6], [GRID - 2.6, 1.6], [1.6, GRID - 2.6], [GRID - 2.6, GRID - 2.6]];
function drawBrazier(cx, b, t) {
    var sx = isoX(b[0], b[1]), sy = isoY(b[0], b[1]) + TILE_H / 2;
    var fl = 0.75 + Math.sin(t * 9 + b[0] * 7) * 0.14 + Math.sin(t * 23 + b[1] * 3) * 0.09;
    // light pool
    cx.save(); cx.globalCompositeOperation = 'lighter';
    var lg = cx.createRadialGradient(sx, sy - 20, 4, sx, sy - 20, 130 * fl);
    lg.addColorStop(0, 'rgba(255,150,50,.20)'); lg.addColorStop(1, 'rgba(255,120,30,0)');
    cx.fillStyle = lg; cx.beginPath(); cx.arc(sx, sy - 20, 130 * fl, 0, TAU); cx.fill();
    cx.restore();
    // stand
    cx.fillStyle = '#141018'; cx.fillRect(sx - 3, sy - 26, 6, 24);
    cx.fillStyle = '#1e1824'; cx.fillRect(sx - 9, sy - 30, 18, 6);
    cx.fillStyle = '#2a2232'; cx.fillRect(sx - 7, sy - 32, 14, 3);
    // flame (stacked wobbling ellipses)
    for (var i = 0; i < 3; i++) {
        var fy = sy - 34 - i * 6, w = (9 - i * 2.4) * fl, hgt = 8 - i * 1.6;
        cx.fillStyle = ['rgba(255,90,20,.85)', 'rgba(255,160,40,.85)', 'rgba(255,230,140,.9)'][i];
        cx.beginPath(); cx.ellipse(sx + Math.sin(t * 13 + i * 2) * 1.6, fy, w, hgt, 0, 0, TAU); cx.fill();
    }
    // rising embers
    if (Math.random() < 0.25) spawnPart({ x: b[0], y: b[1], z: 34, vz: rnd(14, 26), vx: rnd(-0.25, 0.25), vy: rnd(-0.25, 0.25), life: rnd(0.7, 1.6), size: rnd(1, 2.4), col: '255,170,60', add: 1, grav: -2 });
}

/* ambient drifting ash */
function ambient(dt) {
    if (Math.random() < 0.5) {
        RT.parts.push({
            x: rnd(0, GRID), y: rnd(0, GRID), z: rnd(20, 90),
            vx: rnd(-0.15, 0.15), vy: rnd(-0.1, 0.1), vz: rnd(-6, -2),
            life: rnd(2, 5), max: 5, size: rnd(0.8, 1.8), col: '150,140,160', alpha: 0.25, add: 0, grav: 0
        });
    }
}

/* screen shake, gated by the option; every += goes through here */
function shake(amt, cap) { if (!S.opts || !S.opts.shake) return RT.shake; return Math.min(cap == null ? 12 : cap, RT.shake + amt); }
/* particle-density option scales spawn counts: low halves, high full */
function pq(n) { var d = S.opts ? S.opts.parts : 2; return Math.max(1, Math.round(n * (d === 0 ? 0.4 : d === 1 ? 0.7 : 1))); }

/* ─────────────── particles ───────────────
   world-space (tile coords + z px above floor), painter-drawn
   after entities. col is 'r,g,b'; add uses lighter composite. */
function spawnPart(p) {
    p.max = p.max || p.life;
    p.alpha = p.alpha == null ? 1 : p.alpha;
    p.grav = p.grav == null ? 60 : p.grav;    // px/s² downward on z
    if (RT.parts.length < 1400) RT.parts.push(p);
}
function burst(x, y, z, n, opt) {
    n = pq(n);
    for (var i = 0; i < n; i++) {
        var an = rnd(0, TAU), sp = rnd(opt.sp0 || 0.5, opt.sp1 || 2.4);
        spawnPart({
            x: x, y: y, z: z + rnd(-4, 6),
            vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, vz: rnd(opt.vz0 == null ? 20 : opt.vz0, opt.vz1 == null ? 90 : opt.vz1),
            life: rnd(opt.l0 || 0.3, opt.l1 || 0.9), size: rnd(opt.s0 || 1.5, opt.s1 || 3.5),
            col: opt.col, add: opt.add == null ? 1 : opt.add, grav: opt.grav == null ? 140 : opt.grav, drag: opt.drag
        });
    }
}
function stepParts(dt) {
    for (var i = RT.parts.length - 1; i >= 0; i--) {
        var p = RT.parts[i];
        p.life -= dt;
        if (p.life <= 0) { RT.parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vz -= (p.grav || 0) * dt;
        if (p.drag) { p.vx *= (1 - p.drag * dt); p.vy *= (1 - p.drag * dt); }
        if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
    }
}
function drawParts(cx) {
    for (var i = 0; i < RT.parts.length; i++) {
        var p = RT.parts[i];
        var sx = isoX(p.x, p.y), sy = isoY(p.x, p.y) + TILE_H / 2 - p.z;
        var a = clamp(p.life / p.max, 0, 1) * p.alpha;
        cx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
        cx.fillStyle = 'rgba(' + p.col + ',' + a.toFixed(3) + ')';
        var s = p.size * (0.5 + 0.5 * (p.life / p.max));
        cx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
    cx.globalCompositeOperation = 'source-over';
}

/* ground decals (scorch, frost) — under entities, fade out */
function decal(x, y, r, col, life) {
    RT.decals.push({ x: x, y: y, r: r, col: col, life: life, max: life });
    if (RT.decals.length > 24) RT.decals.shift();
}
function drawDecals(cx, dt) {
    for (var i = RT.decals.length - 1; i >= 0; i--) {
        var d = RT.decals[i]; d.life -= dt;
        if (d.life <= 0) { RT.decals.splice(i, 1); continue; }
        var a = clamp(d.life / d.max, 0, 1) * 0.5;
        var sx = isoX(d.x, d.y), sy = isoY(d.x, d.y) + TILE_H / 2;
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5);
        var g = cx.createRadialGradient(0, 0, 2, 0, 0, d.r);
        g.addColorStop(0, 'rgba(' + d.col + ',' + a.toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + d.col + ',0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(0, 0, d.r, 0, TAU); cx.fill();
        cx.restore();
    }
}

/* floating combat numbers */
function num(x, y, txt, col, big, crit) {
    RT.nums.push({ x: x, y: y, z: 46 + rnd(0, 10), vx: rnd(-0.35, 0.35), txt: txt, col: col, big: big, crit: crit, life: crit ? 1.5 : 1.05, max: crit ? 1.5 : 1.05 });
    if (RT.nums.length > 60) RT.nums.shift();
}
function drawNums(cx, dt) {
    for (var i = RT.nums.length - 1; i >= 0; i--) {
        var n = RT.nums[i]; n.life -= dt;
        if (n.life <= 0) { RT.nums.splice(i, 1); continue; }
        n.z += 34 * dt; n.x += n.vx * dt;
        var a = clamp(n.life / n.max * 1.4, 0, 1);
        var sx = isoX(n.x, n.y), sy = isoY(n.x, n.y) - n.z;
        var size = n.crit ? 21 : n.big ? 16 : 12;
        if (n.crit) size += Math.sin((1 - n.life / n.max) * 8) * 2;
        cx.font = size + 'px "VT323", monospace';
        cx.textAlign = 'center';
        cx.globalAlpha = a;
        cx.fillStyle = '#000'; cx.fillText(n.txt, sx + 1, sy + 1);
        cx.fillStyle = n.col; cx.fillText(n.txt, sx, sy);
        if (n.crit) { cx.font = '9px "Pixelify Sans"'; cx.fillText('CRIT', sx + String(n.txt).length * 5 + 12, sy - 8); }
        cx.globalAlpha = 1;
    }
    cx.textAlign = 'left';
}

/* ─────────────── the exile ─────────────── */
function stepPlayer(dt) {
    var st = stats();
    // channelling ROOTS you — the beam is a commitment, not a suggestion
    if (RT.channel) {
        RT.walking = false; RT.moveTo = null;
        if (RT.dashCharges < (SPELLS.flamedash.charges || 2)) {
            RT.dashCd -= dt;
            if (RT.dashCd <= 0) { RT.dashCharges++; RT.dashCd = SPELLS.flamedash.cd; }
        }
        for (var j = RT.dashTrail.length - 1; j >= 0; j--) { RT.dashTrail[j].t -= dt; if (RT.dashTrail[j].t <= 0) RT.dashTrail.splice(j, 1); }
        return;
    }
    var spd = st.move * (RT.buffs.quick > 0 ? 1.4 : 1);
    var mx = 0, my = 0;
    // WASD maps to screen directions; convert to iso axes
    if (RT.keys.w) { mx -= 1; my -= 1; }
    if (RT.keys.s) { mx += 1; my += 1; }
    if (RT.keys.a) { mx -= 1; my += 1; }
    if (RT.keys.d) { mx += 1; my -= 1; }
    if (mx || my) {
        RT.moveTo = null;
        var l = Math.hypot(mx, my); mx /= l; my /= l;
        RT.px += mx * spd * dt; RT.py += my * spd * dt;
        RT.face = Math.atan2(my, mx);
        RT.walking = true;
    } else if (RT.moveTo) {
        var dx = RT.moveTo.x - RT.px, dy = RT.moveTo.y - RT.py;
        var d = Math.hypot(dx, dy);
        if (d < 0.12) { RT.moveTo = null; RT.walking = false; }
        else {
            RT.px += dx / d * spd * dt; RT.py += dy / d * spd * dt;
            RT.face = Math.atan2(dy, dx); RT.walking = true;
        }
    } else RT.walking = false;
    RT.px = clamp(RT.px, 0.8, GRID - 0.8); RT.py = clamp(RT.py, 0.8, GRID - 0.8);
    // dash charge regen
    if (RT.dashCharges < (SPELLS.flamedash.charges || 2)) {
        RT.dashCd -= dt;
        if (RT.dashCd <= 0) { RT.dashCharges++; RT.dashCd = SPELLS.flamedash.cd; }
    }
    // trail fade
    for (var i = RT.dashTrail.length - 1; i >= 0; i--) { RT.dashTrail[i].t -= dt; if (RT.dashTrail[i].t <= 0) RT.dashTrail.splice(i, 1); }
}
function doDash() {
    if (RT.dashCharges <= 0 || RT.mana < SPELLS.flamedash.mana) return;
    endChannel();                                  // you cannot be a beam and a blur at once
    var tx = RT.mouse.wx, ty = RT.mouse.wy;
    var dx = tx - RT.px, dy = ty - RT.py, d = Math.hypot(dx, dy) || 1;
    var dist = Math.min(d, 3.4);
    RT.mana -= SPELLS.flamedash.mana;
    if (RT.dashCharges === (SPELLS.flamedash.charges || 2)) RT.dashCd = SPELLS.flamedash.cd;
    RT.dashCharges--;
    // afterimages along the path + scorch
    for (var i = 0; i < 5; i++) {
        var t = i / 5;
        RT.dashTrail.push({ x: RT.px + dx / d * dist * t, y: RT.py + dy / d * dist * t, t: 0.4 - t * 0.05, face: RT.face });
    }
    burst(RT.px, RT.py, 8, 16, { col: '255,140,40', sp0: 0.6, sp1: 2, l0: 0.3, l1: 0.7 });
    decal(RT.px + dx / d * dist / 2, RT.py + dy / d * dist / 2, 26, '200,90,20', 2.2);
    RT.px = clamp(RT.px + dx / d * dist, 0.8, GRID - 0.8);
    RT.py = clamp(RT.py + dy / d * dist, 0.8, GRID - 0.8);
    RT.face = Math.atan2(dy, dx);
    burst(RT.px, RT.py, 6, 14, { col: '255,180,80', sp0: 0.4, sp1: 1.6, l0: 0.25, l1: 0.55 });
    sfx('dash'); RT.moveTo = null;
    ach('spark'); RT.castAny = true; RT.idleT = 0;
}

/* draw the robed exile at world pos. pose: idle/walk/cast/channel */
function drawExile(cx, x, y, face, t, ghost) {
    var sx = isoX(x, y), sy = isoY(x, y) + TILE_H / 2;
    var bob = RT.walking && !ghost ? Math.sin(t * 11) * 1.6 : Math.sin(t * 2.4) * 0.8;
    var castK = RT.casting ? clamp(1 - (RT.casting.t / RT.casting.max), 0, 1) : (RT.channel ? 1 : 0);
    var west = Math.cos(face) < 0 ? -1 : 1;
    cx.save(); cx.translate(sx, sy - bob);
    if (ghost) cx.globalAlpha = ghost;
    // shadow
    cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(0, bob, 10, 4, 0, 0, TAU); cx.fill();
    cx.scale(west, 1);
    // robe (layered trapezoids)
    cx.fillStyle = '#241a33'; cx.beginPath();
    cx.moveTo(-7, 0); cx.lineTo(-5, -18); cx.lineTo(5, -18); cx.lineTo(7, 0); cx.closePath(); cx.fill();
    cx.fillStyle = '#31244a'; cx.fillRect(-5, -19, 10, 8);
    cx.fillStyle = '#3d2c5c'; cx.fillRect(-5, -24, 10, 6);     // chest
    // trim
    cx.fillStyle = '#8a4ae0'; cx.fillRect(-1, -18, 2, 16);
    cx.fillStyle = '#5a3a8c'; cx.fillRect(-7, -1, 14, 2);
    // hood + face shadow
    cx.fillStyle = '#31244a'; cx.beginPath(); cx.arc(0, -27, 6, 0, TAU); cx.fill();
    cx.fillStyle = '#0c0a14'; cx.beginPath(); cx.arc(1, -26.5, 4, 0, TAU); cx.fill();
    cx.fillStyle = '#9fe0c8'; cx.fillRect(1, -28, 2, 2);       // one cold eye
    // staff arm: raises with castK
    var armA = lerp(0.5, -0.9, castK) + (RT.walking ? Math.sin(t * 11) * 0.14 : 0);
    cx.save(); cx.translate(4, -20); cx.rotate(armA);
    cx.fillStyle = '#241a33'; cx.fillRect(0, -1.5, 9, 3);      // arm
    // staff
    cx.save(); cx.translate(9, 0); cx.rotate(-0.5);
    cx.fillStyle = '#4a3524'; cx.fillRect(-1.5, -20, 3, 30);
    var pul = 0.6 + Math.sin(t * 6) * 0.25 + castK * 0.6;
    cx.globalCompositeOperation = 'lighter';
    cx.fillStyle = 'rgba(160,110,240,' + (0.5 * pul) + ')';
    cx.beginPath(); cx.arc(0, -22, 4.5 + castK * 2.5, 0, TAU); cx.fill();
    cx.fillStyle = 'rgba(220,190,255,' + (0.8 * pul) + ')';
    cx.beginPath(); cx.arc(0, -22, 2, 0, TAU); cx.fill();
    cx.globalCompositeOperation = 'source-over';
    cx.restore(); cx.restore();
    cx.restore();
}

/* ─────────────── shared unit status ticking ───────────────
   ignite/umbral DoTs deal damage (mitigated once, via dealRaw),
   timers decay, ambient status particles. Dummy AND enemies. */
function stepUnitStatuses(u, dt) {
    var st = u.st;
    for (var i = st.ignite.length - 1; i >= 0; i--) {
        var ig = st.ignite[i]; ig.next -= dt; ig.t -= dt;
        if (ig.next <= 0 && !u.dead) { ig.next = 0.5; dealRaw(ig.dps * 0.5, 'fire', { u: u, dot: true, tag: 'ignite' }); }
        if (ig.t <= 0) st.ignite.splice(i, 1);
    }
    for (var j = st.coils.length - 1; j >= 0; j--) {
        var c = st.coils[j]; c.next -= dt; c.t -= dt;
        if (c.next <= 0 && !u.dead) { c.next = 0.5; dealRaw(c.dps * 0.5, 'chaos', { u: u, dot: true, tag: 'umbral' }); }
        if (c.t <= 0) st.coils.splice(j, 1);
    }
    st.chill = Math.max(0, st.chill - dt);
    st.freeze = Math.max(0, st.freeze - dt);
    st.shock = Math.max(0, st.shock - dt);
    st.sigil = Math.max(0, st.sigil - dt);
    if (Math.random() < 0.08) {
        if (st.ignite.length) burst(u.x, u.y, rnd(10, 40), 1, { col: '255,120,30', sp0: 0.1, sp1: 0.6, l0: 0.3, l1: 0.8 });
        if (st.freeze > 0) burst(u.x, u.y, rnd(6, 44), 1, { col: '160,220,255', sp0: 0.05, sp1: 0.3, l0: 0.4, l1: 1, grav: 30 });
        if (st.shock > 0) spawnPart({ x: u.x + rnd(-0.3, 0.3), y: u.y + rnd(-0.3, 0.3), z: rnd(8, 46), vx: 0, vy: 0, vz: 0, life: 0.1, size: rnd(1, 2.5), col: '255,240,140', add: 1, grav: 0 });
    }
}

/* ─────────────── the dummy ─────────────── */
function stepDummy(dt) {
    var d = RT.dummy;
    d.wobble = Math.max(0, d.wobble - dt * 3);
    d.flashT = Math.max(0, d.flashT - dt);
    d.spawnT = Math.max(0, d.spawnT - dt);
    if (d.dead) {
        if (RT.mode !== 'sandbox') return;   // in a Trial the dummy stays gone
        d.respawn -= dt;
        if (d.respawn <= 0) {
            RT.dummy = mkDummy();
            RT.dummy.spawnT = 0.5; RT.dummy.bornAt = RT.t;
            logLine(pick([
                'The dummy returns. It holds no grudge. It holds nothing. It is a dummy.',
                'A new dummy is winched into place. The old one is compost now.',
                'The dummy respawns. One must imagine it happy.',
                'Management sends another dummy. Management says nothing.'
            ]), 'sys');
            burst(RT.dummy.x, RT.dummy.y, 10, 26, { col: '190,170,140', sp0: 0.5, sp1: 2, add: 0, l0: 0.4, l1: 1 });
        }
        return;
    }
    stepUnitStatuses(d, dt);
    if (S.dummy.regen && d.hp < d.hpm) d.hp = Math.min(d.hpm, d.hp + d.hpm * 0.02 * dt);
}
function drawDummy(cx, t) {
    var d = RT.dummy;
    var sx = isoX(d.x, d.y), sy = isoY(d.x, d.y) + TILE_H / 2;
    if (d.dead) {  // collapsed heap
        cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(sx, sy, 16, 6, 0, 0, TAU); cx.fill();
        cx.fillStyle = '#6b5637'; cx.fillRect(sx - 12, sy - 6, 24, 5);
        cx.fillStyle = '#8a7048'; cx.fillRect(sx - 6, sy - 9, 14, 4);
        cx.fillStyle = '#4a3b26'; cx.fillRect(sx - 2, sy - 4, 5, 3);
        return;
    }
    var wob = Math.sin(t * 26) * d.wobble * 4;
    var pop = d.spawnT > 0 ? 1 + d.spawnT * 0.5 : 1;
    var frozen = d.st.freeze > 0, chilled = d.st.chill > 0;
    cx.save(); cx.translate(sx, sy); cx.rotate(wob * 0.04); cx.scale(pop, pop);
    // shadow + post
    cx.fillStyle = 'rgba(0,0,0,.45)'; cx.beginPath(); cx.ellipse(0, 0, 12, 5, 0, 0, TAU); cx.fill();
    cx.fillStyle = '#3a2c1c'; cx.fillRect(-2.5, -26, 5, 26);
    cx.fillStyle = '#4a3826'; cx.fillRect(-9, -4, 18, 4);       // base
    // straw body
    var bodyC = frozen ? '#9cc8e8' : chilled ? '#a8b49c' : '#b89a5e';
    var darkC = frozen ? '#6a9cc4' : chilled ? '#84927c' : '#96793f';
    cx.fillStyle = bodyC; cx.fillRect(-8, -40, 16, 18);
    cx.fillStyle = darkC; cx.fillRect(-8, -40, 16, 4);
    cx.fillStyle = darkC; cx.fillRect(-8, -26, 16, 3);
    // cross arms
    cx.fillStyle = '#3a2c1c'; cx.fillRect(-16, -38, 32, 3);
    cx.fillStyle = bodyC; cx.fillRect(-16, -40, 5, 7); cx.fillRect(11, -40, 5, 7);
    // head (burlap sack)
    cx.fillStyle = bodyC; cx.beginPath(); cx.arc(0, -46, 7, 0, TAU); cx.fill();
    cx.fillStyle = darkC; cx.fillRect(-4, -47, 3, 2); cx.fillRect(2, -47, 3, 2);   // stitched eyes
    cx.strokeStyle = darkC; cx.beginPath(); cx.moveTo(-3, -43); cx.lineTo(3, -43); cx.stroke();
    // battle scars: a few arrows/scorches proportional to kills
    cx.fillStyle = '#2a2018'; cx.fillRect(4, -34, 2, 6);
    if (d.flashT > 0) {  // hit flash
        cx.globalCompositeOperation = 'lighter';
        cx.globalAlpha = d.flashT * 3;
        cx.fillStyle = '#fff'; cx.fillRect(-9, -54, 18, 54);
        cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
    }
    if (frozen) {  // ice casing
        cx.globalAlpha = 0.5; cx.fillStyle = '#bfe6ff';
        cx.beginPath(); cx.moveTo(-11, 0); cx.lineTo(-9, -50); cx.lineTo(0, -56); cx.lineTo(9, -50); cx.lineTo(11, 0); cx.closePath(); cx.fill();
        cx.globalAlpha = 1;
    }
    if (d.st.sigil > 0) {  // curse ring
        cx.save(); cx.scale(1, 0.5); cx.rotate(0);
        cx.strokeStyle = 'rgba(192,106,255,.6)'; cx.lineWidth = 2;
        cx.beginPath(); cx.arc(0, 0, 24 + Math.sin(t * 3) * 2, 0, TAU); cx.stroke();
        for (var r = 0; r < 5; r++) {
            var an = t * 0.8 + r / 5 * TAU;
            cx.fillStyle = 'rgba(192,106,255,.8)';
            cx.fillRect(Math.cos(an) * 24 - 2, Math.sin(an) * 24 - 2, 4, 4);
        }
        cx.restore();
    }
    cx.restore();
    // overhead hp sliver + statuses
    var w = 44, hpF = clamp(d.hp / d.hpm, 0, 1);
    cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(sx - w / 2, sy - 66, w, 5);
    cx.fillStyle = hpF > 0.35 ? '#b02a2a' : '#e05a2a'; cx.fillRect(sx - w / 2 + 1, sy - 65, (w - 2) * hpF, 3);
    var icons = statusIcons();
    for (var k = 0; k < icons.length; k++) {
        cx.fillStyle = icons[k][1];
        cx.fillRect(sx - icons.length * 5 + k * 10, sy - 74, 8, 6);
        cx.fillStyle = 'rgba(0,0,0,.35)'; cx.fillRect(sx - icons.length * 5 + k * 10, sy - 74, 8, 1);
    }
}
function statusIconsOf(u) {
    var st = u.st, out = [];
    if (st.ignite.length) out.push(['ignite', '#ff7a2e']);
    if (st.chill > 0) out.push(['chill', '#6fd4ff']);
    if (st.freeze > 0) out.push(['freeze', '#bfe6ff']);
    if (st.shock > 0) out.push(['shock', '#ffe66e']);
    if (st.sigil > 0) out.push(['sigil', '#c06aff']);
    if (st.coils.length) out.push(['umbral', '#8a4ae0']);
    return out;
}
function statusIcons() { return statusIconsOf(RT.dummy); }

/* ═══════════════ ENEMIES + TARGETING + PLAYER MORTALITY ═══════════════ */

/* every alive damageable thing right now (dummy in sandbox, enemies always) */
function units() {
    var out = [];
    if (RT.mode === 'sandbox' && RT.dummy && !RT.dummy.dead) out.push(RT.dummy);
    for (var i = 0; i < RT.enemies.length; i++) if (!RT.enemies[i].dead) out.push(RT.enemies[i]);
    return out;
}
function nearestUnit(x, y, maxR, exclude) {
    var us = units(), best = null, bd = (maxR || 999) * (maxR || 999);
    for (var i = 0; i < us.length; i++) {
        if (exclude && us[i] === exclude) continue;
        var d2 = (us[i].x - x) * (us[i].x - x) + (us[i].y - y) * (us[i].y - y);
        if (d2 < bd) { bd = d2; best = us[i]; }
    }
    return best;
}
function unitsInRadius(x, y, r) {
    var us = units(), out = [];
    for (var i = 0; i < us.length; i++) if (Math.hypot(us[i].x - x, us[i].y - y) <= r + us[i].r) out.push(us[i]);
    return out;
}
/* the unit a spell aimed at (tx,ty) should home to: one under/near the cursor,
   else the closest in a small cone. Falls back to null (aim at the ground). */
function aimUnit(tx, ty) {
    var u = nearestUnit(tx, ty, 1.6);
    return u || nearestUnit(RT.px, RT.py, 99);   // else whatever's closest to the exile
}

/* ─────────────── spawn ─────────────── */
function spawnEnemy(kind, x, y, scale) {
    var def = ENEMIES[kind]; if (!def) return null;
    scale = scale || { hp: 1, dmg: 1 };
    var e = {
        kind: kind, name: 'the ' + def.n, def: def, boss: def.boss || 0,
        x: x, y: y, r: def.r, hpm: Math.round(def.hp * scale.hp), dead: 0,
        st: mkStatus(), wobble: 0, flashT: 0, spawnT: 0.4, bornAt: RT.t,
        vx: 0, vy: 0, face: 0, anim: rnd(0, TAU),
        armor: 0, res: { fire: 0, cold: 0, light: 0, chaos: def.boss ? 20 : 0 },
        dmg: def.dmg * scale.dmg, speed: def.speed, atkCd: 0, atkT: 0, state: 'walk', tell: 0,
        phase: 1, summonCd: 6
    };
    e.hp = e.hpm;
    if (RT.enemies.length < 60) RT.enemies.push(e);
    burst(x, y, 8, 14, { col: def.col[2].slice(1).match(/../g).map(function (h) { return parseInt(h, 16); }).join(','), sp0: 0.4, sp1: 1.8, l0: 0.3, l1: 0.7 });
    return e;
}
function chill01(u) { return u.st.freeze > 0 ? 0 : u.st.chill > 0 ? 0.4 : 0; }  // slow factor

/* ─────────────── enemy step / AI ─────────────── */
function stepEnemies(dt) {
    var alive = 0;
    for (var i = RT.enemies.length - 1; i >= 0; i--) {
        var e = RT.enemies[i];
        if (!e) continue;                              // array truncated under us (defensive)
        e.wobble = Math.max(0, e.wobble - dt * 3);
        e.flashT = Math.max(0, e.flashT - dt);
        e.spawnT = Math.max(0, e.spawnT - dt);
        e.anim += dt;
        if (e.dead) { RT.enemies.splice(i, 1); continue; }
        alive++;
        stepUnitStatuses(e, dt);
        if (e.st.freeze > 0) continue;                 // frozen solid: no acting
        var slow = 1 - chill01(e);
        var dx = RT.px - e.x, dy = RT.py - e.y, dist = Math.hypot(dx, dy) || 0.0001;
        e.face = Math.atan2(dy, dx);
        e.atkT = Math.max(0, e.atkT - dt);
        if (e.def.ai === 'boss') { stepBoss(e, dt, dist, dx, dy, slow); }
        else if (e.def.ai === 'ranged') {
            // kite to preferred range, then lob
            var want = e.def.kite;
            var mv = dist < want ? -1 : dist > e.def.atkRange ? 1 : 0;
            if (mv) moveEnemy(e, dx / dist * mv, dy / dist * mv, dt, slow);
            if (e.atkT <= 0 && dist <= e.def.atkRange && e.state === 'walk') { e.state = 'tell'; e.tell = e.def.tell; }
            tickTelegraph(e, dt, function () { enemyProjectile(e); e.atkT = e.def.atkCd; });
        } else if (e.def.ai === 'charger') {
            moveEnemy(e, dx / dist, dy / dist, dt, slow);
            if (dist <= e.def.atkRange && e.state === 'walk') { e.state = 'tell'; e.tell = e.def.tell; }
            tickTelegraph(e, dt, function () { enemyBoom(e); });
        } else {   // melee
            if (dist > e.def.atkRange - 0.1) moveEnemy(e, dx / dist, dy / dist, dt, slow);
            if (e.atkT <= 0 && dist <= e.def.atkRange && e.state === 'walk') { e.state = 'tell'; e.tell = e.def.tell; }
            tickTelegraph(e, dt, function () { if (Math.hypot(RT.px - e.x, RT.py - e.y) <= e.def.atkRange + 0.5) hurtPlayer(e.dmg, e); e.atkT = e.def.atkCd; if (e.def.slam) { ringFx(e.x, e.y, 1.3, '200,120,60'); RT.shake = shake(3); } });
        }
    }
    // enemy projectiles
    for (var p = RT.eproj.length - 1; p >= 0; p--) {
        var pr = RT.eproj[p]; if (!pr) continue;       // array truncated under us (defensive)
        pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
        if (Math.random() < 0.5) spawnPart({ x: pr.x, y: pr.y, z: pr.z, vx: 0, vy: 0, vz: rnd(-4, 6), life: 0.3, size: rnd(1, 2.4), col: '150,90,220', add: 1, grav: 0 });
        if (Math.hypot(pr.x - RT.px, pr.y - RT.py) < 0.6) { hurtPlayer(pr.dmg, pr); RT.eproj.splice(p, 1); continue; }
        if (pr.life <= 0 || pr.x < -1 || pr.x > GRID + 1 || pr.y < -1 || pr.y > GRID + 1) RT.eproj.splice(p, 1);
    }
    return alive;
}
function moveEnemy(e, nx, ny, dt, slow) {
    // separation: shove off overlapping neighbours so they don't stack into one dot
    var sx = 0, sy = 0;
    for (var i = 0; i < RT.enemies.length; i++) {
        var o = RT.enemies[i]; if (o === e || o.dead) continue;
        var ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy);
        if (od > 0.01 && od < e.r + o.r + 0.2) { sx += ox / od; sy += oy / od; }
    }
    var mx = nx + sx * 0.5, my = ny + sy * 0.5, ml = Math.hypot(mx, my) || 1;
    e.x = clamp(e.x + mx / ml * e.speed * slow * dt, 0.6, GRID - 0.6);
    e.y = clamp(e.y + my / ml * e.speed * slow * dt, 0.6, GRID - 0.6);
}
function tickTelegraph(e, dt, fire) {
    if (e.state !== 'tell') return;
    e.tell -= dt;
    if (e.tell <= 0) { e.state = 'walk'; fire(); }
}
function enemyProjectile(e) {
    var a = Math.atan2(RT.py - e.y, RT.px - e.x);
    RT.eproj.push({ x: e.x, y: e.y, z: 26, vx: Math.cos(a) * 6.5, vy: Math.sin(a) * 6.5, life: 2.4, dmg: e.dmg });
    sfx('void');
}
function enemyBoom(e) {
    var R = e.def.boom;
    ringFx(e.x, e.y, R, '220,220,80');
    burst(e.x, e.y, 6, 40, { col: '220,220,60', sp0: 1, sp1: 3.6, l0: 0.3, l1: 0.9 });
    if (Math.hypot(RT.px - e.x, RT.py - e.y) <= R) hurtPlayer(e.dmg, e);
    RT.shake = shake(7); sfx('nova');
    e.dead = 1; enemyDeath(e, true);   // the bloatling dies to its own blast
}
function stepBoss(e, dt, dist, dx, dy, slow) {
    // phase shift at 50% -> summons come online
    if (e.phase === 1 && e.hp < e.hpm * 0.5) { e.phase = 2; banner('THE WARDEN AWAKENS', 'it calls for help now', 2); ringFx(e.x, e.y, 3, '160,110,240'); RT.shake = shake(8); }
    e.summonCd -= dt;
    if (e.phase === 2 && e.summonCd <= 0) {
        e.summonCd = 8;
        for (var s = 0; s < 3; s++) { var an = rnd(0, TAU); spawnEnemy('wretch', clamp(e.x + Math.cos(an) * 1.5, 1, GRID - 1), clamp(e.y + Math.sin(an) * 1.5, 1, GRID - 1), RT.trial ? waveScale(RT.trial.wave) : { hp: 1, dmg: 1 }); }
        logLine('<b style="color:#a06adf">THE WARDEN</b> calls the Wretches in.', 'st');
    }
    if (dist > e.def.atkRange - 0.1) moveEnemy(e, dx / dist, dy / dist, dt, slow);
    if (e.atkT <= 0 && e.state === 'walk') {
        // alternate slam (close) and beam sweep (any range)
        if (dist <= e.def.atkRange + 0.4) { e.state = 'tell'; e.tell = e.def.tell; e.pend = 'slam'; }
        else { e.state = 'tell'; e.tell = 0.9; e.pend = 'beam'; e.beamA = Math.atan2(dy, dx); }
    }
    tickTelegraph(e, dt, function () {
        if (e.pend === 'slam') {
            ringFx(e.x, e.y, 2.4, '200,120,60'); RT.shake = shake(9);
            if (Math.hypot(RT.px - e.x, RT.py - e.y) <= 2.4) hurtPlayer(e.dmg * 1.4, e);
            burst(e.x, e.y, 4, 30, { col: '200,120,60', sp0: 1, sp1: 3, l0: 0.3, l1: 0.8 });
        } else {   // beam: a line from the boss along beamA
            RT.bossBeam = { x: e.x, y: e.y, a: e.beamA, t: 0.4 };
            var bx = Math.cos(e.beamA), by = Math.sin(e.beamA);
            var tproj = ((RT.px - e.x) * bx + (RT.py - e.y) * by);
            var px2 = e.x + bx * tproj, py2 = e.y + by * tproj;
            if (tproj > 0 && Math.hypot(RT.px - px2, RT.py - py2) < 0.8) hurtPlayer(e.dmg * 1.1, e);
            sfx('zap'); RT.flash = 0.1;
        }
        e.atkT = e.def.atkCd;
    });
}

/* ─────────────── enemy death ─────────────── */
function enemyDeath(e, quiet) {
    if (e._counted) return; e._counted = 1;
    e.dead = 1;
    S.kills++; if (S.kills >= 10) ach('serial');
    ach('firstkill');
    var rgb = e.def.col[2].slice(1).match(/../g).map(function (h) { return parseInt(h, 16); }).join(',');
    burst(e.x, e.y, 12, e.boss ? 60 : 24, { col: rgb, add: 0, sp0: 1, sp1: e.boss ? 4 : 3, l0: 0.4, l1: 1.1, grav: 150 });
    RT.shake = shake(e.boss ? 12 : 3);
    if (!quiet) sfx('death');
    var sh = irnd(e.def.shards[0], e.def.shards[1]); S.shards += sh;
    gainXp(e.def.xp);
    if (e.boss) {
        ach('warden');
        banner('WARDEN DOWN', 'the proving grounds are quiet again', 3);
        dropLoot(e.x, e.y, 1, 0.15); dropLoot(e.x, e.y, 1, 0.4);
        logLine('<b style="color:#a06adf">THE WARDEN falls.</b> +' + sh + ' shards.', 'kill');
    } else {
        var gemBias = e.kind === 'caster' ? 0.14 : 0.05;
        dropLoot(e.x, e.y, e.kind === 'brute' ? 0.5 : 0.2, gemBias);
    }
    if (RT.trial) RT.trial.killed++;
    sSave();
    if (RT.panel) refreshPanels();
}

/* ─────────────── the exile takes damage ─────────────── */
function hurtPlayer(amount, src) {
    if (RT.dead || RT.invuln > 0) return;
    var st = stats();
    amount = Math.max(1, Math.round(amount));
    RT.life -= amount;
    RT.hurtT = 0.35;
    RT.shake = shake(3);
    if (RT.trial) RT.trial.tookHit = true;
    if (S.opts.nums) num(RT.px + rnd(-0.2, 0.2), RT.py, '-' + amount, '#ff5a6a', amount > st.lifeMax * 0.15, false);
    burst(RT.px, RT.py, 22, 8, { col: '200,40,60', sp0: 0.4, sp1: 1.6, l0: 0.2, l1: 0.5 });
    sfx('hurt');
    if (RT.life <= 0) playerDie();
}
function playerDie() {
    RT.dead = true; RT.deadT = 2.4; RT.life = 0;
    RT.channel = null; RT.casting = null;
    ach('die');
    RT.shake = shake(12); RT.flash = 0.3;
    burst(RT.px, RT.py, 10, 40, { col: '200,40,60', sp0: 0.6, sp1: 3, l0: 0.5, l1: 1.2 });
    sfx('death');
    var wasTrial = RT.mode === 'trial';
    banner('YOU FELL', wasTrial ? 'the Trial ends at wave ' + RT.trial.wave : 'the veil catches you — one moment', 3);
    logLine('<b class="ar-log-crit">You fall in the proving grounds.</b> ' + (wasTrial ? 'The Trial is over.' : 'A breath, and you are set back on your feet.'), 'kill');
    // DEFER the trial teardown: playerDie can fire from inside stepEnemies' loop
    // over RT.enemies, and endTrial empties that array in place — clearing it now
    // would strand the loop on an undefined element. step() drains this after.
    if (wasTrial) RT.endQueued = true;
}
function respawnPlayer() {
    RT.dead = false; RT.invuln = 2;
    RT.px = GRID / 2; RT.py = GRID / 2 + 3.5;
    RT.life = stats().lifeMax; RT.mana = stats().manaMax;
    RT.keys = {};
    burst(RT.px, RT.py, 12, 30, { col: '160,110,240', sp0: 0.5, sp1: 2.4, l0: 0.4, l1: 1, vz0: 30, vz1: 120 });
    ringFx(RT.px, RT.py, 1.8, '160,110,240');
    logLine('You are set back on your feet at the veil-mark. Try that again.', 'sys');
}

/* ─────────────── draw an enemy ─────────────── */
function drawEnemy(cx, e, t) {
    var sx = isoX(e.x, e.y), sy = isoY(e.x, e.y) + TILE_H / 2;
    var frozen = e.st.freeze > 0, chilled = e.st.chill > 0;
    var pop = e.spawnT > 0 ? 0.6 + (0.4 - e.spawnT) : 1;
    var wob = Math.sin(t * 24) * e.wobble * 3;
    var telePulse = e.state === 'tell' ? 0.5 + 0.5 * Math.sin(t * 30) : 0;
    var col = e.def.col, west = Math.cos(e.face) < 0 ? -1 : 1;
    // telegraph ground ring
    if (e.state === 'tell') {
        var rr = (e.def.ai === 'charger' ? e.def.boom : e.def.ai === 'ranged' ? 0.5 : e.def.atkRange);
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5);
        cx.strokeStyle = 'rgba(255,80,60,' + (0.4 + telePulse * 0.4) + ')'; cx.lineWidth = 2;
        cx.beginPath(); cx.arc(0, 0, rr * TILE_W / 2, 0, TAU); cx.stroke(); cx.restore();
    }
    cx.save(); cx.translate(sx, sy - Math.abs(wob)); cx.rotate(wob * 0.03); cx.scale(pop, pop);
    cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(0, 0, e.r * 20, e.r * 8, 0, 0, TAU); cx.fill();
    cx.scale(west, 1);
    var h = e.r * 62, w = e.r * 30;
    var body = frozen ? '#bfe6ff' : chilled ? mix(col[0], '#a8c4d8', 0.4) : col[0];
    if (e.def.ai === 'boss') drawWarden(cx, e, body, col, t, telePulse);
    else if (e.def.ai === 'charger') {  // bloated round thing
        cx.fillStyle = body; cx.beginPath(); cx.arc(0, -w, w * 1.2 + telePulse * 3, 0, TAU); cx.fill();
        cx.fillStyle = col[1]; cx.beginPath(); cx.arc(0, -w, w * 1.2 + telePulse * 3, 0.2, Math.PI - 0.2); cx.fill();
        cx.fillStyle = '#1a1a10'; cx.fillRect(-w * 0.5, -w * 1.3, 3, 3); cx.fillRect(w * 0.3, -w * 1.3, 3, 3);
        if (telePulse > 0) { cx.globalCompositeOperation = 'lighter'; cx.fillStyle = 'rgba(255,255,120,' + telePulse * 0.5 + ')'; cx.beginPath(); cx.arc(0, -w, w * 1.4, 0, TAU); cx.fill(); cx.globalCompositeOperation = 'source-over'; }
    } else if (e.def.ai === 'ranged') {  // hooded caster
        cx.fillStyle = body; cx.beginPath(); cx.moveTo(-w * 0.7, 0); cx.lineTo(-w * 0.4, -h * 0.8); cx.lineTo(w * 0.4, -h * 0.8); cx.lineTo(w * 0.7, 0); cx.closePath(); cx.fill();
        cx.fillStyle = col[1]; cx.beginPath(); cx.arc(0, -h * 0.85, w * 0.5, 0, TAU); cx.fill();
        cx.fillStyle = '#c9a1ff'; cx.fillRect(-w * 0.15, -h * 0.9, w * 0.3, 2);
        if (e.state === 'tell') { cx.globalCompositeOperation = 'lighter'; cx.fillStyle = 'rgba(150,90,220,' + (0.4 + telePulse * 0.5) + ')'; cx.beginPath(); cx.arc(w * 0.6, -h * 0.5, 4 + telePulse * 3, 0, TAU); cx.fill(); cx.globalCompositeOperation = 'source-over'; }
    } else if (e.r > 0.55) {  // brute: big blocky
        cx.fillStyle = body; cx.fillRect(-w, -h, w * 2, h);
        cx.fillStyle = col[1]; cx.fillRect(-w, -h, w * 2, h * 0.28);
        cx.fillStyle = '#1a0e08'; cx.fillRect(-w * 0.5, -h * 0.8, 4, 4); cx.fillRect(w * 0.2, -h * 0.8, 4, 4);
        var swing = e.state === 'tell' ? -telePulse * 0.9 : 0;   // arm winds back
        cx.save(); cx.translate(w, -h * 0.7); cx.rotate(swing); cx.fillStyle = col[0]; cx.fillRect(0, -3, w * 1.4, 6); cx.fillStyle = '#3a2418'; cx.fillRect(w * 1.2, -8, 10, 16); cx.restore();
    } else {  // wretch: thin biped
        cx.fillStyle = body; cx.fillRect(-w * 0.5, -h, w, h);
        cx.fillStyle = col[2]; cx.beginPath(); cx.arc(0, -h, w * 0.6, 0, TAU); cx.fill();
        cx.fillStyle = '#0c0c06'; cx.fillRect(-w * 0.25, -h - 1, 2, 2); cx.fillRect(w * 0.1, -h - 1, 2, 2);
        var legK = Math.sin(t * 12 + e.anim) * 3;
        cx.fillStyle = col[1]; cx.fillRect(-w * 0.5, -3, 3, 6 + legK); cx.fillRect(w * 0.2, -3, 3, 6 - legK);
    }
    if (e.flashT > 0) { cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = e.flashT * 3.2; cx.fillStyle = '#fff'; cx.fillRect(-w * 1.4, -h * 1.4, w * 2.8, h * 1.5); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; }
    if (frozen) { cx.globalAlpha = 0.45; cx.fillStyle = '#dff2ff'; cx.fillRect(-w * 1.3, -h * 1.2, w * 2.6, h * 1.25); cx.globalAlpha = 1; }
    cx.restore();
    // health bar + statuses
    var barW = e.boss ? 0 : (e.r * 70), hpF = clamp(e.hp / e.hpm, 0, 1);
    if (barW) {
        cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(sx - barW / 2, sy - h - 12, barW, 4);
        cx.fillStyle = hpF > 0.35 ? '#c33' : '#e85a2a'; cx.fillRect(sx - barW / 2 + 1, sy - h - 11, (barW - 2) * hpF, 2);
    }
    var icons = statusIconsOf(e);
    for (var k = 0; k < icons.length; k++) { cx.fillStyle = icons[k][1]; cx.fillRect(sx - icons.length * 4 + k * 8, sy - h - 20, 6, 4); }
}
function drawWarden(cx, e, body, col, t, tp) {
    var w = e.r * 30, h = e.r * 62;
    cx.fillStyle = body; cx.fillRect(-w, -h, w * 2, h);
    cx.fillStyle = col[1]; cx.fillRect(-w, -h, w * 2, h * 0.3);
    // shoulder crests
    cx.fillStyle = col[2]; cx.beginPath(); cx.moveTo(-w, -h); cx.lineTo(-w * 1.4, -h * 1.2); cx.lineTo(-w * 0.5, -h * 0.95); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(w, -h); cx.lineTo(w * 1.4, -h * 1.2); cx.lineTo(w * 0.5, -h * 0.95); cx.fill();
    // eye visor
    cx.globalCompositeOperation = 'lighter';
    cx.fillStyle = 'rgba(200,120,255,' + (0.6 + Math.sin(t * 4) * 0.2 + tp * 0.3) + ')';
    cx.fillRect(-w * 0.7, -h * 0.82, w * 1.4, 4);
    cx.globalCompositeOperation = 'source-over';
    // phase-2 aura
    if (e.phase === 2) { cx.globalCompositeOperation = 'lighter'; cx.fillStyle = 'rgba(160,110,240,.12)'; cx.beginPath(); cx.arc(0, -h * 0.5, w * 2.4, 0, TAU); cx.fill(); cx.globalCompositeOperation = 'source-over'; }
}
function mix(a, b, t) {
    var pa = a.slice(1).match(/../g).map(function (h) { return parseInt(h, 16); });
    var pb = b.slice(1).match(/../g).map(function (h) { return parseInt(h, 16); });
    return 'rgb(' + pa.map(function (v, i) { return Math.round(lerp(v, pb[i], t)); }).join(',') + ')';
}

/* ─────────────── the Trials ─────────────── */
function startTrial() {
    if (RT.mode === 'trial') return;
    RT.mode = 'trial';
    RT.enemies.length = 0; RT.eproj.length = 0;
    RT.dummy.dead = 1;                              // dummy steps aside during a run
    RT.trial = { wave: 0, phase: 'gap', timer: 1.4, spawned: 0, killed: 0, toSpawn: 0, queue: [], tookHit: false, score: 0, start: RT.t };
    banner('THE TRIALS BEGIN', 'survive. it is the whole design.', 2.2);
    logLine('<b class="ar-log-lv">THE TRIALS BEGIN.</b> Kill everything. Stay standing.', 'sys');
    sfx('surge');
}
function endTrial(won) {
    var tr = RT.trial;
    if (tr && tr.wave > S.bestWave) { S.bestWave = tr.wave; sSave(); }
    RT.mode = 'sandbox';
    RT.trial = null;
    RT.enemies.length = 0; RT.eproj.length = 0;
    RT.bossBeam = null;
    RT.dummy = mkDummy(); RT.dummy.spawnT = 0.5; RT.dummy.bornAt = RT.t;
    if (won) banner('TRIAL CLEARED', 'the arena exhales', 3);
}
function stepTrial(dt) {
    var tr = RT.trial; if (!tr) return;
    tr.score = tr.wave * 100 + S.kills;
    var aliveCount = RT.enemies.filter(function (e) { return !e.dead; }).length;
    if (tr.phase === 'gap') {
        tr.timer -= dt;
        if (tr.timer <= 0) beginWave(tr.wave + 1);
    } else if (tr.phase === 'spawn') {
        tr.timer -= dt;
        if (tr.timer <= 0 && tr.queue.length) {
            var k = tr.queue.shift();
            var an = rnd(0, TAU), edge = GRID / 2 - 1.5;
            spawnEnemy(k, clamp(GRID / 2 + Math.cos(an) * edge, 1, GRID - 1), clamp(GRID / 2 + Math.sin(an) * edge, 1, GRID - 1), waveScale(tr.wave));
            tr.timer = waveIsBoss(tr.wave) ? 0 : rnd(0.3, 0.7);
            if (!tr.queue.length) tr.phase = 'fight';
        }
    } else if (tr.phase === 'fight') {
        if (aliveCount === 0) {   // wave cleared
            if (!tr.tookHit) ach('nohit');
            if (tr.wave >= 5) ach('wave5');
            if (tr.wave >= 10) ach('wave10');
            flaskGain(2);
            banner('WAVE ' + tr.wave + ' CLEARED', tr.wave % 5 === 4 ? 'a Warden stirs…' : 'breathe. the next is worse.', 1.8);
            tr.phase = 'gap'; tr.timer = 3.2; tr.tookHit = false;
            sSave();
        }
    }
}
function beginWave(w) {
    var tr = RT.trial;
    tr.wave = w; tr.phase = 'spawn'; tr.timer = 0.4; tr.queue = []; tr.tookHit = false;
    if (waveIsBoss(w)) {
        banner('WAVE ' + w + ' — WARDEN', 'the proving grounds keep one', 2);
        tr.queue.push('warden');
    } else {
        var sc = waveScale(w), pool = wavePool(w);
        for (var i = 0; i < sc.count; i++) tr.queue.push(pick(pool));
        banner('WAVE ' + w, sc.count + ' incoming', 1.6);
    }
    logLine('<b>Wave ' + w + '.</b> ' + (waveIsBoss(w) ? 'THE WARDEN approaches.' : tr.queue.length + ' enemies inbound.'), 'sys');
}
function banner(txt, sub, dur) { RT.banner = { txt: txt, sub: sub, t: dur || 2, max: dur || 2 }; }

/* ─────────────── damage pipeline (unit-agnostic) ───────────────
   Every damageable thing — the dummy AND every enemy — is a "unit"
   with {hp,hpm,st,dead,...}. opt.u selects the target (default: the
   sandbox dummy). hit → crit → mitigation → number/log/dps/xp →
   statuses → death. Chaos pierces half of resistance; Avatar of Fire
   converts half of non-fire damage to fire at the mitigation step. */
function unitArmor(u) { return u.isDummy ? S.dummy.armor : (u.armor || 0); }
function unitRes(u, el) { var r = u.isDummy ? (S.dummy.res[el] || 0) : ((u.res && u.res[el]) || 0); return clamp(r, -100, 75); }
function dealHit(base, el, opt) {
    opt = opt || {};
    var u = opt.u || RT.dummy; if (!u || u.dead) return 0;
    var st = opt.st || stats();
    var crit = st.critCh > 0 && Math.random() * 100 < st.critCh;
    var pre = base * (crit ? st.critMul : 1);   // pre-mitigation: statuses scale off THIS,
    var dmg = dealRaw(pre, el, { u: u, crit: crit, tag: opt.tag, quiet: opt.quiet, spell: opt.spell, shatterMul: opt.shatterMul, st: st });
    if (crit) { S.crits++; if (S.crits >= 10) ach('crit10'); }
    // ...because the tick path mitigates again on its own — no double-dipping resists
    if (dmg > 0 && !u.dead) applyStatus(u, el, pre, st, opt);
    return dmg;
}
function mitigate(u, dmg, el, st) {
    // Avatar of Fire: half of non-fire is mitigated as fire instead
    if (st && st.ks && st.ks.avatar && el !== 'fire' && el !== 'phys') {
        return mitigate(u, dmg * 0.5, el, null) + mitigate(u, dmg * 0.5, 'fire', null);
    }
    if (el === 'phys') { var ar = unitArmor(u); return ar > 0 ? dmg * (1 - clamp(ar / (ar + 5 * dmg), 0, 0.9)) : dmg; }
    var res = unitRes(u, el);
    if (el === 'chaos') res /= 2;               // chaos does not read the resistance sheet fully
    return dmg * (1 - res / 100);
}
function dealRaw(dmg, el, opt) {
    opt = opt || {};
    var u = opt.u || RT.dummy; if (!u || u.dead) return 0;
    dmg = mitigate(u, dmg, el, opt.st);
    if (u.st.shock > 0) dmg *= 1.4;
    if (u.st.sigil > 0) dmg *= 1.25;
    if (opt.shatterMul) dmg *= opt.shatterMul;
    dmg = Math.max(1, Math.round(dmg));
    u.hp -= dmg;
    u.wobble = Math.min(1, u.wobble + (opt.dot ? 0.1 : 0.5));
    if (!opt.dot) u.flashT = 0.09;
    if (S.opts.nums) {   // dots small + tinted, crits huge
        var col = opt.dot ? 'rgba(' + hex2rgb(ECOL[el]) + ',.85)' : (opt.crit ? '#ffd24a' : ECOL[el]);
        num(u.x + rnd(-0.25, 0.25), u.y + rnd(-0.15, 0.15), fmtN(dmg), col, dmg > 200, opt.crit);
    }
    // dps + xp + flask charges + achievements
    dpsAdd(dmg);
    gainXp(Math.max(1, Math.round(dmg / (u.isDummy ? 6 : 3))));
    if (!opt.dot) { RT.hitN = (RT.hitN || 0) + 1; if (RT.hitN % 6 === 0) flaskGain(1); }
    ach('blood');
    if (dmg >= 1000) ach('overkill');
    var s2 = u.st;
    if (s2.ignite.length && s2.chill > 0 && s2.shock > 0) ach('storm');
    if (!opt.quiet && u.isDummy) {
        logLine((opt.spell ? '<b>' + esc(opt.spell) + '</b> ' : '') + (opt.crit ? '<b class="ar-log-crit">CRITS</b> the dummy for ' : opt.dot ? '<i>' + esc(opt.tag || 'dot') + '</i> ticks for ' : 'hits the dummy for ') + '<b style="color:' + ECOL[el] + '">' + fmtN(dmg) + '</b>', opt.dot ? 'dot' : 'hit');
    }
    if (u.hp <= 0) unitDeath(u);
    return dmg;
}
function hex2rgb(h) { return parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' + parseInt(h.slice(5, 7), 16); }
function applyStatus(u, el, dmg, st, opt) {
    var sp = opt.spellId ? SPELLS[opt.spellId] : null;
    // Avatar of Fire lets the fire half of any spell ignite
    var canFire = el === 'fire' || (st.ks && st.ks.avatar);
    if (canFire) {
        var ch = (sp && sp.ignite ? sp.ignite * 100 : 0) + st.igniteCh + (opt.forceIgnite ? 100 : 0);
        if (Math.random() * 100 < ch) {
            u.st.ignite.push({ dps: dmg * (el === 'fire' ? 0.35 : 0.18) * (1 + (st.igniteDmg + st.dotDmg) / 100), t: 3, next: 0.5 });
            if (u.st.ignite.length > 4) u.st.ignite.shift();
            if (u.isDummy) logLine('the dummy is <b style="color:#ff7a2e">ignited</b>. it does not scream. it never screams.', 'st');
        }
    }
    if (el === 'cold') {
        u.st.chill = Math.max(u.st.chill, 2.4 * (1 + st.chillPow / 100));
        if (Math.random() * 100 < st.freezeCh + (opt.freezeBonus || 0)) {
            if (u.st.freeze <= 0 && u.isDummy) logLine('the dummy is <b style="color:#bfe6ff">frozen solid</b>.', 'st');
            u.st.freeze = Math.max(u.st.freeze, u.boss ? 0.8 : 1.6);   // bosses shrug freezes faster
        }
    }
    if (el === 'light') {
        var sh = (sp && sp.shock ? sp.shock * 100 : 0) + st.shockCh;
        if (Math.random() * 100 < sh) {
            if (u.st.shock <= 0 && u.isDummy) logLine('the dummy is <b style="color:#ffe66e">shocked</b> (+40% damage taken).', 'st');
            u.st.shock = Math.max(u.st.shock, 4);
        }
    }
}
function unitDeath(u) {
    if (u.dead) return;
    u.dead = 1; u.hp = 0;
    if (u.isDummy) return dummyDeath(u);
    enemyDeath(u);
}
function dummyDeath(d) {
    d.respawn = 2.2;
    S.kills++;
    ach('slain'); if (S.kills >= 10) ach('serial');
    if (RT.t - d.bornAt < 15) ach('speed');
    // straw explosion + loot
    burst(d.x, d.y, 20, 46, { col: '184,154,94', add: 0, sp0: 1, sp1: 3.4, l0: 0.5, l1: 1.4, grav: 160 });
    burst(d.x, d.y, 26, 22, { col: '255,200,120', sp0: 0.5, sp1: 2, l0: 0.3, l1: 0.8 });
    RT.shake = shake(6, 10);
    sfx('death');
    var shGain = irnd(2, 5);
    S.shards += shGain;
    flaskGain(3);                                       // a kill refills the belt. tradition.
    logLine('<b>The dummy is destroyed.</b> +' + shGain + ' <b style="color:#ffe66e">void shards</b>. It will be back. It is always back.', 'kill');
    dropLoot(d.x, d.y, 0.65, 0);
    sSave();
    refreshPanels();
}
/* loot roll shared by dummy + enemies. chance = base drop chance,
   gemBias raises the odds a support gem falls instead of gear. */
function dropLoot(x, y, chance, gemBias) {
    if (Math.random() < (gemBias || 0)) {   // a support gem
        var gid = pick(GEM_IDS);
        S.gems[gid] = (S.gems[gid] || 0) + 1;
        logLine('a <b style="color:' + GEMS[gid].col + '">' + esc(GEMS[gid].n) + '</b> support gem drops — socket it in the Spellbook (B).', 'loot');
        lootBeam(x, y, GEMS[gid].col);
        return;
    }
    if (Math.random() >= chance && S.stash.length) return;
    var it = rollItem();
    if (S.stash.length >= 8) {   // evict the oldest NON-unique; The Box is never compost
        var evict = 0; while (evict < S.stash.length && S.stash[evict].rarity === 'unique') evict++;
        S.stash.splice(Math.min(evict, S.stash.length - 1), 1);
    }
    S.stash.push(it);
    if (it.rarity === 'unique') { ach('unique'); logLine('<b style="color:#af6025">THE BOX DROPS.</b> It has been in the trunk since session one.', 'loot'); }
    else logLine('drops <b style="color:' + RARITY[it.rarity] + '">' + esc(it.n) + '</b> — check your Character panel (C).', 'loot');
    lootBeam(x, y, RARITY[it.rarity]);
}
function lootBeam(x, y, col) {
    var rgb = hex2rgb(col);
    for (var i = 0; i < 20; i++) spawnPart({ x: x + rnd(-0.1, 0.1), y: y + rnd(-0.1, 0.1), z: i * 6, vx: 0, vy: 0, vz: rnd(10, 40), life: rnd(0.6, 1.3), size: rnd(1, 3), col: rgb, add: 1, grav: -10 });
}
function gainXp(x) {
    S.xp += x;
    var lvled = false;
    while (S.xp >= xpNeed(S.lv)) { S.xp -= xpNeed(S.lv); S.lv++; S.pts += 1; lvled = true; }
    if (lvled) {
        logLine('<b class="ar-log-lv">LEVEL UP — you are now level ' + S.lv + '.</b> +1 passive point.', 'lv');
        burst(RT.px, RT.py, 4, 50, { col: '255,230,140', sp0: 0.4, sp1: 2.6, l0: 0.6, l1: 1.4, vz0: 40, vz1: 140 });
        ringFx(RT.px, RT.py, 2.2, '255,230,140');
        sfx('level');
        if (S.lv >= 5) ach('level5');
        RT.life = stats().lifeMax;   // a level heals. tradition.
        sSave();
    }
    refreshXp();
}
function dpsAdd(dmg) {
    var p = RT.dps;
    if (!p.t0) p.t0 = RT.t;
    p.total += dmg;
    p.hist.push({ t: RT.t, d: dmg });
}
function dpsNow() {
    var p = RT.dps, cut = RT.t - 5;
    while (p.hist.length && p.hist[0].t < cut) p.hist.shift();
    var sum = 0; for (var i = 0; i < p.hist.length; i++) sum += p.hist[i].d;
    var v = sum / Math.min(5, Math.max(0.5, RT.t - (p.hist.length ? p.hist[0].t : RT.t) + 0.5));
    if (v > p.peak) p.peak = v;
    return v;
}

/* ─────────────── casting ─────────────── */
function slotCast(slot) {
    var id = S.binds[slot]; if (!id) return;
    tryCast(id, RT.mouse.wx, RT.mouse.wy, slotGems(slot));
}
function castSpell(id, tx, ty, gems) {   // the raw dispatch (also the echo re-entry)
    if (id === 'emberbolt') castEmberbolt(tx, ty, gems);
    else if (id === 'basalt') castBasalt(tx, ty, gems);
    else if (id === 'arc') castArc(tx, ty, gems);
    else if (id === 'meteor') castMeteor(tx, ty, gems);
    else if (id === 'frostnova') castFrostNova(tx, ty, gems);
    else if (id === 'umbralcoil') castUmbral(tx, ty, gems);
    else if (id === 'arcanesurge') castSurge();
    else if (id === 'sigil') castSigil(tx, ty);
}
function tryCast(id, tx, ty, gems) {
    var sp = SPELLS[id]; if (!sp || !RT || RT.dead || RT.casting) return;
    gems = gems || [];
    if (RT.channel) { if (RT.channel.id === id) return; endChannel(); }   // a new intent breaks the beam
    if (id === 'flamedash') { doDash(); return; }
    if (id === 'glacialray') { startChannel(id, tx, ty, gems); return; }
    if ((RT.cds[id] || 0) > 0) { hudNudge(id); return; }
    var cost = spellManaCost(id, gems);
    if (RT.mana < cost) { logLine('<i>not enough mana.</i> the globe judges you.', 'dim'); hudNudgeMana(); return; }
    var st = stats();
    RT.mana -= cost;
    RT.cds[id] = sp.cd || 0;
    RT.face = Math.atan2(ty - RT.py, tx - RT.px);
    RT.castAny = true; RT.idleT = 0;
    ach('spark');
    var castT = (sp.castT || 0.3) / (st.castSpd * (1 + gemMod(gems, 'cast') / 100));
    RT.casting = { id: id, t: castT, max: castT, tx: tx, ty: ty, gems: gems };
    sfx('charge');
}
function finishCast(id, tx, ty, gems) {
    var sp = SPELLS[id];
    castSpell(id, tx, ty, gems);
    logLine('cast <b style="color:' + ECOL[sp.el] + '">' + esc(sp.n) + '</b>', 'cast');
    if (gemHas(gems, 'echo')) {   // Spell Echo: one repeat a beat later, aimed anew
        RT.timers.push(setTimeout(function () {
            if (RT && !RT.dead) castSpell(id, RT.mouse.wx, RT.mouse.wy, gems.filter(function (g) { return g !== 'echo'; }));
        }, 170));
    }
}
function startChannel(id, tx, ty, gems) {
    var sp = SPELLS[id];
    if (RT.channel) return;
    if (RT.mana < spellManaCost(id, gems)) { hudNudgeMana(); return; }
    RT.channel = { id: id, t: 0, stage: 1, tick: 0, drain: sp.mana, gems: gems || [] };
    RT.castAny = true; RT.idleT = 0; ach('spark');
    logLine('channelling <b style="color:' + ECOL.cold + '">' + esc(sp.n) + '</b>…', 'cast');
    sfx('beam');
}
function stepCast(dt) {
    var st = stats();
    // mana regen (always)
    RT.mana = Math.min(st.manaMax, RT.mana + st.manaRegen * dt);
    RT.life = Math.min(st.lifeMax, RT.life + st.lifeRegen * dt);
    // cooldowns
    Object.keys(RT.cds).forEach(function (k) { if (RT.cds[k] > 0) RT.cds[k] -= dt; });
    // one-shot cast wind-up
    if (RT.casting) {
        RT.casting.t -= dt;
        if (RT.casting.t <= 0) { var c = RT.casting; RT.casting = null; finishCast(c.id, c.tx, c.ty, c.gems || []); }
    }
    // channel: held Q (or key rebound to glacialray)
    if (RT.channel) {
        var ch = RT.channel, sp = SPELLS[ch.id];
        var held = keyHeldFor(ch.id);
        // per-tick drain honours the same gem mana modifier the start-gate charged
        var drain = spellManaCost(ch.id, ch.gems) * (1 + (ch.stage - 1) * 0.5) * dt;
        if (!held || RT.mana < drain) { endChannel(); }
        else {
            RT.mana -= drain;
            ch.t += dt;
            ch.stage = clamp(1 + Math.floor(ch.t / 1.1), 1, sp.ramp);
            ch.tick -= dt;
            RT.face = Math.atan2(RT.mouse.wy - RT.py, RT.mouse.wx - RT.px);
            if (ch.tick <= 0) {
                ch.tick = sp.tick;
                beamTick(ch);
            }
        }
    }
    // buffs
    RT.buffs.surge = Math.max(0, RT.buffs.surge - dt);
    RT.buffs.quick = Math.max(0, RT.buffs.quick - dt);
    // idle achievement (sandbox only — you can't stand still in a Trial and live)
    RT.idleT += dt;
    if (RT.idleT > 60 && RT.mode === 'sandbox' && !RT.dummy.dead) ach('patient');
}
function keyHeldFor(id) {
    for (var i = 0; i < SLOT_KEYS.length; i++) {
        if (S.binds[SLOT_KEYS[i]] !== id) continue;
        var k = SLOT_KEYS[i];
        if (k === 'LMB') { if (RT.mouse.down) return true; }
        else if (k === 'RMB') { if (RT.mouse.rdown) return true; }
        else if (RT.keys[k.toLowerCase()]) return true;
    }
    return false;
}
function endChannel() {
    if (!RT.channel) return;
    RT.channel = null;
    RT.beams.length = 0;
}

/* ─────────────── the spells themselves ───────────────
   Every spell now targets any UNIT (dummy or enemy) via units().
   Support gems linked to the casting slot ride along in `gems`:
   aoe widens, chain leaps, pierce passes through, add* bolt on an
   extra element, echo repeats (handled in finishCast). */

/* deal a spell's hit to one unit, plus any added-element gem hits */
function spellHit(u, id, r, el, gems, opt) {
    opt = opt || {}; opt.u = u; opt.st = r.st; opt.spellId = id; opt.spell = SPELLS[id].n;
    var dmg = dealHit(rnd(r.lo, r.hi), el, opt);
    (gems || []).forEach(function (g) {
        if (GEMS[g] && GEMS[g].add && !u.dead) {
            dealHit(rnd(r.lo, r.hi) * GEMS[g].addPct, GEMS[g].add, { u: u, st: r.st, spellId: id, quiet: true, spell: SPELLS[id].n, forceIgnite: false });
        }
    });
    return dmg;
}
function areaMul(gems) { return 1 + gemMod(gems, 'area'); }

/* EMBERBOLT / BASALT / UMBRAL — projectiles */
function castEmberbolt(tx, ty, gems) {
    var a = Math.atan2(ty - RT.py, tx - RT.px);
    RT.projs.push({ kind: 'ember', gems: gems || [], x: RT.px + Math.cos(a) * 0.5, y: RT.py + Math.sin(a) * 0.5, z: 26, vx: Math.cos(a) * SPELLS.emberbolt.speed, vy: Math.sin(a) * SPELLS.emberbolt.speed, life: 2.4, hitU: [] });
    sfx('fire');
}
function castBasalt(tx, ty, gems) {
    var a = Math.atan2(ty - RT.py, tx - RT.px);
    RT.projs.push({ kind: 'stone', gems: gems || [], x: RT.px + Math.cos(a) * 0.5, y: RT.py + Math.sin(a) * 0.5, z: 28, vx: Math.cos(a) * SPELLS.basalt.speed, vy: Math.sin(a) * SPELLS.basalt.speed, life: 2, hitU: [] });
    sfx('stone');
}
function castUmbral(tx, ty, gems) {
    var a = Math.atan2(ty - RT.py, tx - RT.px);
    RT.projs.push({ kind: 'umbral', gems: gems || [], x: RT.px + Math.cos(a) * 0.5, y: RT.py + Math.sin(a) * 0.5, z: 28, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, life: 3, hitU: [] });
    sfx('void');
}
function projImpact(p, u) {
    var gems = p.gems || [];
    if (p.kind === 'stone') {
        var rs = spellDmg('basalt', gems);
        spellHit(u, 'basalt', rs, 'phys', gems); u.wobble = 1;
        burst(p.x, p.y, p.z, 16, { col: '170,162,150', sp0: 0.7, sp1: 2.6, l0: 0.3, l1: 0.7, add: 0, grav: 220 });
        burst(p.x, p.y, p.z, 6, { col: '220,214,200', sp0: 0.3, sp1: 1.2, l0: 0.15, l1: 0.35 });
        RT.shake = shake(2); sfx('hit');
    } else if (p.kind === 'ember') {
        var r = spellDmg('emberbolt', gems);
        spellHit(u, 'emberbolt', r, 'fire', gems);
        burst(p.x, p.y, p.z, 22, { col: '255,140,40', sp0: 0.8, sp1: 3, l0: 0.25, l1: 0.6 });
        burst(p.x, p.y, p.z, 8, { col: '255,220,120', sp0: 0.4, sp1: 1.4, l0: 0.2, l1: 0.4 });
        decal(p.x, p.y, 20 * areaMul(gems), '190,80,20', 3.5);
        if (gemHas(gems, 'area')) unitsInRadius(p.x, p.y, 1.2 * areaMul(gems)).forEach(function (o) { if (o !== u) spellHit(o, 'emberbolt', spellDmg('emberbolt', gems), 'fire', gems, { quiet: true }); });
        RT.shake = shake(1.2); sfx('hit');
    } else if (p.kind === 'umbral') {
        var r2 = spellDmg('umbralcoil', gems), st2 = r2.st;
        spellHit(u, 'umbralcoil', r2, 'chaos', gems);
        if (!u.dead) {
            var dot = SPELLS.umbralcoil;
            var dps = rnd(dot.dot[0], dot.dot[1]) * (1 + (S.lv - 1) * 0.12) * (1 + (st2.m.sd + st2.m.chaos + st2.dotDmg) / 100) * (1 + gemMod(gems, 'more'));
            u.st.coils.push({ dps: dps, t: dot.dotT, next: 0.5 });
            while (u.st.coils.length > dot.maxStk) u.st.coils.shift();
            if (u.isDummy) logLine('an <b style="color:#c06aff">umbral coil</b> latches on (' + u.st.coils.length + '/' + dot.maxStk + ')', 'st');
        }
        burst(p.x, p.y, p.z, 18, { col: '150,80,230', sp0: 0.6, sp1: 2.2, l0: 0.3, l1: 0.7 }); sfx('void');
    }
    // CHAIN gem: leap to a second nearby target for 70%
    if (gemHas(gems, 'chain')) {
        var next = nearestUnit(p.x, p.y, 3.2, u);
        if (next && p.hitU.indexOf(next) < 0) {
            p.hitU.push(next);
            boltFx(p.x, p.y, next.x, next.y, 0);
            var el = p.kind === 'stone' ? 'phys' : p.kind === 'ember' ? 'fire' : 'chaos';
            var id = p.kind === 'stone' ? 'basalt' : p.kind === 'ember' ? 'emberbolt' : 'umbralcoil';
            spellHit(next, id, { lo: spellDmg(id, gems).lo * 0.7, hi: spellDmg(id, gems).hi * 0.7, st: spellDmg(id, gems).st }, el, gems, { quiet: true });
        }
    }
}
function stepProjs(dt) {
    for (var i = RT.projs.length - 1; i >= 0; i--) {
        var p = RT.projs[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        var out = p.x < -1 || p.x > GRID + 1 || p.y < -1 || p.y > GRID + 1;
        if (p.kind === 'ember') {
            spawnPart({ x: p.x, y: p.y, z: p.z + rnd(-2, 2), vx: rnd(-0.3, 0.3), vy: rnd(-0.3, 0.3), vz: rnd(4, 18), life: rnd(0.2, 0.45), size: rnd(1.5, 3), col: '255,140,40', add: 1, grav: 20 });
        } else if (p.kind === 'umbral') {
            spawnPart({ x: p.x + Math.sin(p.life * 22) * 0.14, y: p.y + Math.cos(p.life * 22) * 0.14, z: p.z, vx: 0, vy: 0, vz: rnd(-4, 6), life: rnd(0.3, 0.6), size: rnd(1.5, 3), col: '150,80,230', add: 1, grav: 0 });
        } else if (p.kind === 'stone' && Math.random() < 0.5) {
            spawnPart({ x: p.x, y: p.y, z: p.z + rnd(-2, 2), vx: rnd(-0.2, 0.2), vy: rnd(-0.2, 0.2), vz: rnd(-6, 4), life: rnd(0.25, 0.5), size: rnd(1, 2.2), col: '150,145,135', add: 0, alpha: 0.6, grav: 40 });
        }
        // hit test against every unit not yet struck by this projectile
        var us = units(), struck = false;
        for (var u = 0; u < us.length; u++) {
            var t = us[u];
            if (p.hitU.indexOf(t) >= 0) continue;
            if (Math.hypot(t.x - p.x, t.y - p.y) <= 0.4 + t.r) {
                p.hitU.push(t);
                projImpact(p, t);
                struck = true;
                break;
            }
        }
        // pierce keeps the projectile alive through the first target
        if (struck && !gemHas(p.gems, 'pierce')) { RT.projs.splice(i, 1); continue; }
        if (p.life <= 0 || out) RT.projs.splice(i, 1);
    }
}
function drawProjs(cx) {
    for (var i = 0; i < RT.projs.length; i++) {
        var p = RT.projs[i];
        var sx = isoX(p.x, p.y), sy = isoY(p.x, p.y) + TILE_H / 2 - p.z;
        cx.globalCompositeOperation = 'lighter';
        var core = p.kind === 'ember' ? ['255,220,140', '255,120,30'] : p.kind === 'stone' ? ['225,218,205', '120,115,108'] : ['230,190,255', '140,60,220'];
        var g = cx.createRadialGradient(sx, sy, 1, sx, sy, 9);
        g.addColorStop(0, 'rgba(' + core[0] + ',.95)'); g.addColorStop(0.5, 'rgba(' + core[1] + ',.55)'); g.addColorStop(1, 'rgba(' + core[1] + ',0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(sx, sy, 9, 0, TAU); cx.fill();
        cx.globalCompositeOperation = 'source-over';
    }
}

/* GLACIAL RAY — channelled beam; hits every unit near the segment */
function beamTick(ch) {
    var gems = ch.gems || [], r = spellDmg('glacialray', gems), st = r.st;
    var stageMul = 1 + (ch.stage - 1) * 0.75;
    var a = Math.atan2(RT.mouse.wy - RT.py, RT.mouse.wx - RT.px);
    var ex = RT.px + Math.cos(a) * 7, ey = RT.py + Math.sin(a) * 7;
    RT.beams = [{ x0: RT.px, y0: RT.py, x1: ex, y1: ey, stage: ch.stage, t: 0.14 }];
    var us = units();
    for (var i = 0; i < us.length; i++) {
        var d = us[i];
        var t = clamp(((d.x - RT.px) * (ex - RT.px) + (d.y - RT.py) * (ey - RT.py)) / 49, 0, 1);
        var px2 = RT.px + (ex - RT.px) * t, py2 = RT.py + (ey - RT.py) * t;
        if (Math.hypot(d.x - px2, d.y - py2) < 0.7 + d.r) {
            spellHit(d, 'glacialray', { lo: r.lo * stageMul, hi: r.hi * stageMul, st: st }, 'cold', gems, { quiet: true, freezeBonus: ch.stage * 4 });
            burst(d.x, d.y, rnd(10, 40), 3, { col: '140,210,255', sp0: 0.3, sp1: 1.4, l0: 0.2, l1: 0.5, grav: 60 });
        }
    }
    for (var k = 0; k < 2 + ch.stage; k++) {
        var tt = Math.random();
        spawnPart({ x: RT.px + (ex - RT.px) * tt, y: RT.py + (ey - RT.py) * tt, z: 24 + rnd(-6, 6), vx: rnd(-0.4, 0.4), vy: rnd(-0.4, 0.4), vz: rnd(-10, 10), life: rnd(0.2, 0.5), size: rnd(1, 2.6), col: '160,220,255', add: 1, grav: 0 });
    }
}
function drawBeams(cx, dt) {
    for (var i = RT.beams.length - 1; i >= 0; i--) {
        var b = RT.beams[i]; b.t -= dt;
        if (b.t <= 0 && !RT.channel) { RT.beams.splice(i, 1); continue; }
        var x0 = isoX(b.x0, b.y0), y0 = isoY(b.x0, b.y0) + TILE_H / 2 - 26;
        var x1 = isoX(b.x1, b.y1), y1 = isoY(b.x1, b.y1) + TILE_H / 2 - 18;
        cx.save(); cx.globalCompositeOperation = 'lighter';
        var w = 2 + b.stage * 2 + Math.sin(RT.t * 40) * 1.2;
        cx.strokeStyle = 'rgba(120,190,255,.35)'; cx.lineWidth = w + 6;
        cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke();
        cx.strokeStyle = 'rgba(170,225,255,.7)'; cx.lineWidth = w;
        cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke();
        cx.strokeStyle = 'rgba(240,252,255,.9)'; cx.lineWidth = Math.max(1, w * 0.35);
        cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke();
        cx.restore();
    }
}

/* ARC — instant lightning, seeks a unit near the aim, chains if socketed */
function castArc(tx, ty, gems) {
    var target = nearestUnit(tx, ty, 2.6) || nearestUnit(RT.px, RT.py, 4);
    var ex = target ? target.x : tx, ey = target ? target.y : ty;
    boltFx(RT.px, RT.py, ex, ey, 2);
    RT.flash = 0.12; RT.shake = shake(2.4); sfx('zap');
    if (target) {
        var r = spellDmg('arc', gems);
        spellHit(target, 'arc', r, 'light', gems);
        burst(ex, ey, 30, 14, { col: '255,240,140', sp0: 1, sp1: 3.4, l0: 0.15, l1: 0.4, grav: 40 });
        var jumps = gemHas(gems, 'chain') ? 2 : 1, from = target, hitSet = [target];
        for (var j = 0; j < jumps; j++) {
            var nx = nearestUnit(from.x, from.y, 3.5, null);
            // pick nearest not already hit
            var us = units(), best = null, bd = 3.5 * 3.5;
            for (var u = 0; u < us.length; u++) { if (hitSet.indexOf(us[u]) >= 0) continue; var d2 = (us[u].x - from.x) * (us[u].x - from.x) + (us[u].y - from.y) * (us[u].y - from.y); if (d2 < bd) { bd = d2; best = us[u]; } }
            if (!best) break;
            hitSet.push(best); boltFx(from.x, from.y, best.x, best.y, 0);
            spellHit(best, 'arc', { lo: r.lo * 0.6, hi: r.hi * 0.6, st: r.st }, 'light', gems, { quiet: true });
            from = best;
        }
    } else { burst(ex, ey, 4, 10, { col: '255,240,140', sp0: 0.5, sp1: 2, l0: 0.1, l1: 0.3 }); decal(ex, ey, 14, '200,190,90', 1.2); }
}
function boltFx(x0, y0, x1, y1, depth) {
    var pts = [[isoX(x0, y0), isoY(x0, y0) - 22]], seg = 7;
    for (var i = 1; i < seg; i++) {
        var t = i / seg;
        pts.push([lerp(isoX(x0, y0), isoX(x1, y1), t) + rnd(-14, 14), lerp(isoY(x0, y0) - 22, isoY(x1, y1) - 8, t) + rnd(-10, 10)]);
    }
    pts.push([isoX(x1, y1), isoY(x1, y1) - 8]);
    RT.bolts.push({ pts: pts, t: 0.16, w: 2.6 });
    if (depth > 0) for (var b = 0; b < 2; b++) {
        var bi = irnd(2, seg - 2), bp = pts[bi], bpts = [bp];
        for (var j = 1; j <= 3; j++) bpts.push([bp[0] + rnd(-30, 30), bp[1] + rnd(-4, 26) * j / 2]);
        RT.bolts.push({ pts: bpts, t: 0.12, w: 1.3 });
    }
}
function drawBolts(cx, dt) {
    for (var i = RT.bolts.length - 1; i >= 0; i--) {
        var b = RT.bolts[i]; b.t -= dt;
        if (b.t <= 0) { RT.bolts.splice(i, 1); continue; }
        cx.save(); cx.globalCompositeOperation = 'lighter';
        var a = clamp(b.t / 0.16, 0, 1);
        [['rgba(200,220,255,', b.w * 3, 0.25], ['rgba(255,250,190,', b.w, 0.9], ['rgba(255,255,255,', b.w * 0.4, 1]].forEach(function (L) {
            cx.strokeStyle = L[0] + (L[2] * a) + ')'; cx.lineWidth = L[1];
            cx.beginPath(); b.pts.forEach(function (p, k) { k ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }); cx.stroke();
        });
        cx.restore();
    }
}

/* VOIDFALL METEOR — hits every unit in the (gem-widened) blast */
function castMeteor(tx, ty, gems) {
    RT.meteors.push({ x: tx, y: ty, gems: gems || [], radius: SPELLS.meteor.radius * areaMul(gems), t: SPELLS.meteor.delay, max: SPELLS.meteor.delay, fell: false });
    sfx('meteorMark');
}
function stepMeteors(dt) {
    for (var i = RT.meteors.length - 1; i >= 0; i--) {
        var m = RT.meteors[i]; m.t -= dt;
        if (m.t <= 0 && !m.fell) { m.fell = true; meteorImpact(m); RT.meteors.splice(i, 1); }
    }
}
function meteorImpact(m) {
    var gems = m.gems || [], r = spellDmg('meteor', gems), R = m.radius;
    unitsInRadius(m.x, m.y, R).forEach(function (u) {
        var dist = Math.hypot(u.x - m.x, u.y - m.y), falloff = 1 - (dist / R) * 0.5;
        spellHit(u, 'meteor', { lo: r.lo * falloff, hi: r.hi * falloff, st: r.st }, 'fire', gems, { forceIgnite: dist < 0.9 });
        if (dist < 0.9 && u.isDummy) ach('direct');
    });
    RT.shake = shake(12, 16); RT.flash = 0.2; RT.hitstop = 0.06;
    burst(m.x, m.y, 6, 60, { col: '255,120,30', sp0: 1, sp1: 4.5, l0: 0.4, l1: 1.1, vz0: 40, vz1: 220, grav: 220 });
    burst(m.x, m.y, 4, 30, { col: '255,220,120', sp0: 0.6, sp1: 3, l0: 0.3, l1: 0.8 });
    burst(m.x, m.y, 10, 24, { col: '90,80,90', sp0: 0.4, sp1: 2, l0: 0.8, l1: 2, add: 0, alpha: 0.5, grav: 30 });
    ringFx(m.x, m.y, R, '255,140,50'); decal(m.x, m.y, 54 * areaMul(gems), '160,60,10', 8); sfx('meteor');
    for (var i = 0; i < pq(16); i++) {
        (function (k) { RT.timers.push(setTimeout(function () { if (RT) burst(m.x + rnd(-1.6, 1.6) * areaMul(gems), m.y + rnd(-1.6, 1.6) * areaMul(gems), rnd(20, 80), 2, { col: '255,150,50', sp0: 0.1, sp1: 0.8, l0: 0.3, l1: 0.9 }); }, k * 60)); })(i);
    }
}
function ringFx(x, y, r, col) { RT.rings.push({ x: x, y: y, r: 0.2, max: r, col: col, t: 0.5, life: 0.5 }); }
function drawRings(cx, dt) {
    for (var i = RT.rings.length - 1; i >= 0; i--) {
        var g = RT.rings[i]; g.t -= dt;
        if (g.t <= 0) { RT.rings.splice(i, 1); continue; }
        var k = 1 - g.t / g.life, rr = g.max * (0.2 + 0.8 * k);
        var sx = isoX(g.x, g.y), sy = isoY(g.x, g.y) + TILE_H / 2;
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5); cx.globalCompositeOperation = 'lighter';
        cx.strokeStyle = 'rgba(' + g.col + ',' + (0.8 * (1 - k)) + ')'; cx.lineWidth = 4 * (1 - k) + 1;
        cx.beginPath(); cx.arc(0, 0, rr * TILE_W / 2, 0, TAU); cx.stroke(); cx.restore();
    }
}
function drawMeteorMarks(cx) {
    for (var i = 0; i < RT.meteors.length; i++) {
        var m = RT.meteors[i], k = 1 - m.t / m.max;
        var sx = isoX(m.x, m.y), sy = isoY(m.x, m.y) + TILE_H / 2;
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5);
        cx.strokeStyle = 'rgba(255,90,20,' + (0.35 + k * 0.5) + ')'; cx.lineWidth = 2;
        var rr = m.radius * TILE_W / 2;
        cx.beginPath(); cx.arc(0, 0, rr, 0, TAU); cx.stroke();
        cx.beginPath(); cx.arc(0, 0, rr * (1 - k), 0, TAU); cx.stroke();
        cx.beginPath(); cx.moveTo(-rr, 0); cx.lineTo(rr, 0); cx.moveTo(0, -rr); cx.lineTo(0, rr);
        cx.strokeStyle = 'rgba(255,90,20,.25)'; cx.stroke(); cx.restore();
        if (k > 0.7) {
            var fall = (k - 0.7) / 0.3, my = sy - 420 * (1 - fall);
            cx.globalCompositeOperation = 'lighter';
            var gr = cx.createRadialGradient(sx + 60 * (1 - fall), my, 2, sx + 60 * (1 - fall), my, 22);
            gr.addColorStop(0, 'rgba(255,230,160,.95)'); gr.addColorStop(0.5, 'rgba(255,120,30,.7)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
            cx.fillStyle = gr; cx.beginPath(); cx.arc(sx + 60 * (1 - fall), my, 22, 0, TAU); cx.fill();
            cx.globalCompositeOperation = 'source-over';
        }
    }
}

/* FROST NOVA — ring from the exile; shatters frozen units in range */
function castFrostNova(tx, ty, gems) {
    var R = SPELLS.frostnova.radius * areaMul(gems), r = spellDmg('frostnova', gems);
    ringFx(RT.px, RT.py, R, '140,210,255'); ringFx(RT.px, RT.py, R * 0.7, '200,240,255');
    burst(RT.px, RT.py, 10, 40, { col: '160,220,255', sp0: 1.4, sp1: 3.6, l0: 0.3, l1: 0.8, grav: 80 });
    decal(RT.px, RT.py, 60 * areaMul(gems), '90,160,230', 5); RT.shake = shake(3); sfx('nova');
    unitsInRadius(RT.px, RT.py, R).forEach(function (u) {
        var frozen = u.st.freeze > 0, mul = frozen ? 2.5 * (1 + r.st.shatter / 100) : 1;
        spellHit(u, 'frostnova', r, 'cold', gems, { shatterMul: mul, freezeBonus: 6 });
        if (frozen) {
            if (u.isDummy) ach('shatter');
            u.st.freeze = 0;
            if (u.isDummy) logLine('<b style="color:#bfe6ff">SHATTER!</b> the ice goes everywhere. beautiful.', 'st');
            burst(u.x, u.y, 20, 40, { col: '210,240,255', sp0: 1, sp1: 4, l0: 0.4, l1: 1, grav: 200 }); RT.hitstop = 0.05;
        }
    });
}

/* ARCANE SURGE — the self-buff (gems irrelevant) */
function castSurge() {
    RT.buffs.surge = SPELLS.arcanesurge.buffT;
    burst(RT.px, RT.py, 20, 30, { col: '200,230,255', sp0: 0.5, sp1: 2, l0: 0.4, l1: 1, vz0: 30, vz1: 120 });
    ringFx(RT.px, RT.py, 1.6, '200,230,255');
    logLine('<b style="color:#ffe66e">Arcane Surge</b> — the veil hums. +30% cast, +20% damage, 8s.', 'st');
    sfx('surge'); refreshBuffs();
}

/* SIGIL OF RUIN — curse the aimed unit */
function castSigil(tx, ty) {
    var u = nearestUnit(tx, ty, 3) || nearestUnit(RT.px, RT.py, 99); if (!u) return;
    u.st.sigil = SPELLS.sigil.curseT;
    burst(u.x, u.y, 4, 24, { col: '192,106,255', sp0: 0.4, sp1: 1.8, l0: 0.4, l1: 1 });
    decal(u.x, u.y, 34, '140,60,220', SPELLS.sigil.curseT);
    if (u.isDummy) logLine('the dummy is branded with a <b style="color:#c06aff">Sigil of Ruin</b> (+25% damage taken).', 'st');
    sfx('curse');
}

/* ─────────────── tiny synth ─────────────── */
function sfx(kind) {
    if (!S.sound) return;
    try {
        if (!RT.ac) RT.ac = new (window.AudioContext || window.webkitAudioContext)();
        if (RT.ac.state === 'suspended') RT.ac.resume();
        if (RT.ac.state !== 'running') return;
        var ac = RT.ac, t0 = ac.currentTime;
        function tone(type, f0, f1, dur, vol, delay) {
            var o = ac.createOscillator(), g = ac.createGain();
            o.type = type;
            o.frequency.setValueAtTime(f0, t0 + (delay || 0));
            o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + (delay || 0) + dur);
            g.gain.setValueAtTime(vol, t0 + (delay || 0));
            g.gain.exponentialRampToValueAtTime(0.0005, t0 + (delay || 0) + dur);
            o.connect(g); g.connect(ac.destination);
            o.start(t0 + (delay || 0)); o.stop(t0 + (delay || 0) + dur + 0.05);
        }
        function noise(dur, vol, delay) {
            var len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), dt2 = buf.getChannelData(0);
            for (var i = 0; i < len; i++) dt2[i] = (Math.random() * 2 - 1) * (1 - i / len);
            var src = ac.createBufferSource(), g = ac.createGain();
            src.buffer = buf; g.gain.value = vol;
            src.connect(g); g.connect(ac.destination); src.start(t0 + (delay || 0));
        }
        if (kind === 'fire') { tone('square', 300, 90, 0.18, 0.05); noise(0.12, 0.03); }
        else if (kind === 'hit') { noise(0.09, 0.06); tone('triangle', 140, 60, 0.12, 0.06); }
        else if (kind === 'zap') { tone('sawtooth', 1200, 80, 0.14, 0.05); noise(0.05, 0.05); }
        else if (kind === 'nova') { tone('sine', 700, 120, 0.3, 0.06); noise(0.14, 0.03, 0.02); }
        else if (kind === 'beam') { tone('sine', 220, 340, 0.4, 0.025); }
        else if (kind === 'void') { tone('sine', 160, 40, 0.35, 0.06); }
        else if (kind === 'meteorMark') { tone('sine', 90, 55, 0.5, 0.05); }
        else if (kind === 'meteor') { noise(0.5, 0.1); tone('sine', 90, 24, 0.7, 0.12); tone('square', 60, 28, 0.5, 0.05, 0.05); }
        else if (kind === 'dash') { tone('sawtooth', 500, 900, 0.1, 0.03); noise(0.06, 0.02); }
        else if (kind === 'surge') { tone('sine', 300, 900, 0.4, 0.04); tone('sine', 450, 1300, 0.4, 0.03, 0.06); }
        else if (kind === 'curse') { tone('triangle', 200, 70, 0.5, 0.05); }
        else if (kind === 'death') { noise(0.3, 0.07); tone('triangle', 200, 40, 0.5, 0.08); }
        else if (kind === 'hurt') { noise(0.12, 0.08); tone('sawtooth', 180, 70, 0.16, 0.06); }
        else if (kind === 'level') { [440, 554, 659, 880].forEach(function (f, i) { tone('square', f, f, 0.12, 0.035, i * 0.09); }); }
        else if (kind === 'flask') { tone('sine', 500, 800, 0.15, 0.04); }
        else if (kind === 'stone') { noise(0.07, 0.05); tone('triangle', 220, 90, 0.14, 0.05); }
        else if (kind === 'charge') { tone('sine', 200, 400, 0.1, 0.015); }
        else if (kind === 'alloc') { tone('square', 330, 660, 0.12, 0.03); }
    } catch (e) {}
}

/* ─────────────── frame loop ─────────────── */
function frame(now) {
    if (!RT) return;
    var dt = Math.min(0.05, (now - RT.last) / 1000);
    RT.last = now;
    if (RT.hitstop > 0) { RT.hitstop -= dt; dt *= 0.15; }   // impact frames: the world holds its breath
    step(dt);
    draw();
    RT.raf = requestAnimationFrame(frame);
}
function step(dt) {
    RT.t += dt;
    // player death: freeze inputs, run the clock, then set back on your feet
    if (RT.dead) {
        RT.deadT -= dt;
        stepEnemies(dt); stepParts(dt);
        if (RT.deadT <= 0) respawnPlayer();
    } else {
        RT.invuln = Math.max(0, RT.invuln - dt);
        RT.hurtT = Math.max(0, RT.hurtT - dt);
        stepPlayer(dt);
        stepCast(dt);
        stepDummy(dt);
        stepEnemies(dt);
        stepProjs(dt);
        stepMeteors(dt);
        stepParts(dt);
        ambient(dt);
        if (RT.trial) stepTrial(dt);
    }
    // a queued trial teardown (from a death that fired mid-enemy-loop) runs here,
    // safely outside any iteration over RT.enemies / RT.eproj
    if (RT.endQueued) { RT.endQueued = false; endTrial(false); }
    if (RT.bossBeam) { RT.bossBeam.t -= dt; if (RT.bossBeam.t <= 0) RT.bossBeam = null; }
    if (RT.banner) { RT.banner.t -= dt; if (RT.banner.t <= 0) RT.banner = null; }
    RT.shake = Math.max(0, RT.shake - dt * 22);
    RT.flash = Math.max(0, RT.flash - dt * 2);
    // flask + hud + achievement toasts on a soft cadence
    RT.hudT = (RT.hudT || 0) - dt;
    if (RT.hudT <= 0) { RT.hudT = 0.05; updateHud(dt); }
    for (var i = RT.achToasts.length - 1; i >= 0; i--) { RT.achToasts[i].t -= dt; if (RT.achToasts[i].t <= 0) RT.achToasts.splice(i, 1); }
}
function draw() {
    var cx = RT.cx;
    cx.save();
    if (S.opts.shake && RT.shake > 0.2) cx.translate(rnd(-RT.shake, RT.shake) * 0.5, rnd(-RT.shake, RT.shake) * 0.35);
    cx.clearRect(-20, -20, VW + 40, VH + 40);
    cx.drawImage(FLOOR, 0, 0);
    drawDecals(cx, 1 / 60);
    drawMeteorMarks(cx);
    // the boss beam sweeps under everything
    if (RT.bossBeam) {
        var bb = RT.bossBeam, x0 = isoX(bb.x, bb.y), y0 = isoY(bb.x, bb.y) + TILE_H / 2 - 20;
        var ex = bb.x + Math.cos(bb.a) * 10, ey = bb.y + Math.sin(bb.a) * 10;
        var x1 = isoX(ex, ey), y1 = isoY(ex, ey) + TILE_H / 2 - 20;
        cx.save(); cx.globalCompositeOperation = 'lighter'; cx.lineCap = 'round';
        cx.strokeStyle = 'rgba(160,110,240,' + (bb.t * 0.9) + ')'; cx.lineWidth = 10 + bb.t * 10;
        cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke();
        cx.strokeStyle = 'rgba(230,200,255,' + bb.t + ')'; cx.lineWidth = 3;
        cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke(); cx.restore();
    }
    // click-to-move marker
    if (RT.moveTo && !RT.dead) {
        var mx = isoX(RT.moveTo.x, RT.moveTo.y), my = isoY(RT.moveTo.x, RT.moveTo.y) + TILE_H / 2;
        cx.save(); cx.translate(mx, my); cx.scale(1, 0.5);
        cx.strokeStyle = 'rgba(159,224,200,.5)'; cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(0, 0, 8 + Math.sin(RT.t * 8) * 2, 0, TAU); cx.stroke();
        cx.restore();
    }
    // entities painter-sorted by world (x+y)
    var ents = [];
    if (RT.mode === 'sandbox') ents.push({ k: (RT.dummy.x + RT.dummy.y), fn: function () { drawDummy(cx, RT.t); } });
    if (!RT.dead) ents.push({ k: (RT.px + RT.py), fn: function () { drawExile(cx, RT.px, RT.py, RT.face, RT.t, RT.invuln > 0 ? 0.55 + Math.sin(RT.t * 20) * 0.35 : 0); } });
    RT.enemies.forEach(function (en) { if (!en.dead) ents.push({ k: (en.x + en.y), fn: function () { drawEnemy(cx, en, RT.t); } }); });
    BRAZIERS.forEach(function (b) { ents.push({ k: b[0] + b[1], fn: function () { drawBrazier(cx, b, RT.t); } }); });
    RT.dashTrail.forEach(function (g) { ents.push({ k: g.x + g.y - 0.01, fn: function () { drawExile(cx, g.x, g.y, g.face, RT.t, g.t * 1.4); } }); });
    ents.sort(function (a, b) { return a.k - b.k; });
    ents.forEach(function (e) { e.fn(); });
    drawBeams(cx, 1 / 60);
    drawBolts(cx, 1 / 60);
    drawProjs(cx);
    drawEproj(cx);
    drawRings(cx, 1 / 60);
    drawParts(cx);
    drawNums(cx, 1 / 60);
    // full-screen flash (arc, meteor)
    if (RT.flash > 0) {
        cx.fillStyle = 'rgba(255,250,230,' + (RT.flash * 0.5) + ')';
        cx.fillRect(-20, -20, VW + 40, VH + 40);
    }
    // hurt vignette
    if (RT.hurtT > 0 || RT.dead) {
        cx.fillStyle = 'rgba(150,10,20,' + (RT.dead ? 0.4 : RT.hurtT * 0.7) + ')';
        cx.fillRect(-20, -20, VW + 40, VH + 40);
    }
    cx.restore();
    drawBanner(cx);
    drawMinimap(cx);
    if (RT.dead) drawDeathOverlay(cx);
    // achievement toasts (canvas-top so they ride above everything)
    for (var i = 0; i < RT.achToasts.length; i++) {
        var a = RT.achToasts[i], aY = 64 + i * 44;
        var slide = a.t > 3.2 ? (3.6 - a.t) / 0.4 : a.t < 0.4 ? a.t / 0.4 : 1;
        cx.globalAlpha = clamp(slide, 0, 1);
        cx.fillStyle = 'rgba(10,8,18,.92)';
        cx.fillRect(VW - 268, aY, 248, 38);
        cx.strokeStyle = '#8a4ae0'; cx.strokeRect(VW - 268 + 0.5, aY + 0.5, 247, 37);
        cx.fillStyle = '#ffe66e'; cx.font = '13px "Pixelify Sans"';
        cx.fillText('★ ' + a.n, VW - 258, aY + 16);
        cx.fillStyle = '#9a93a8'; cx.font = '10px "Pixelify Sans"';
        cx.fillText(a.d.length > 40 ? a.d.slice(0, 39) + '…' : a.d, VW - 258, aY + 29);
        cx.globalAlpha = 1;
    }
}
function drawEproj(cx) {
    for (var i = 0; i < RT.eproj.length; i++) {
        var p = RT.eproj[i], sx = isoX(p.x, p.y), sy = isoY(p.x, p.y) + TILE_H / 2 - p.z;
        cx.globalCompositeOperation = 'lighter';
        var g = cx.createRadialGradient(sx, sy, 1, sx, sy, 8);
        g.addColorStop(0, 'rgba(220,180,255,.95)'); g.addColorStop(0.5, 'rgba(150,80,220,.5)'); g.addColorStop(1, 'rgba(120,40,200,0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(sx, sy, 8, 0, TAU); cx.fill();
        cx.globalCompositeOperation = 'source-over';
    }
}
/* the big centred wave / event banner */
function drawBanner(cx) {
    if (!RT.banner) return;
    var b = RT.banner, k = clamp(b.t / b.max, 0, 1);
    var slide = b.t > b.max - 0.3 ? (b.max - b.t) / 0.3 : b.t < 0.4 ? b.t / 0.4 : 1;
    cx.globalAlpha = clamp(slide, 0, 1);
    cx.textAlign = 'center';
    cx.fillStyle = 'rgba(6,4,12,.55)'; cx.fillRect(0, VH * 0.28, VW, 74);
    cx.fillStyle = '#160a20'; cx.fillRect(0, VH * 0.28, VW, 3); cx.fillRect(0, VH * 0.28 + 71, VW, 3);
    cx.fillStyle = '#e8dcff'; cx.font = '30px "Press Start 2P", monospace';
    cx.fillText(b.txt, VW / 2, VH * 0.28 + 36);
    cx.fillStyle = '#9a86c8'; cx.font = '13px "Pixelify Sans"';
    cx.fillText(b.sub || '', VW / 2, VH * 0.28 + 58);
    cx.textAlign = 'left'; cx.globalAlpha = 1;
}
/* minimap: arena square with the exile, dummy, and enemy blips */
function drawMinimap(cx) {
    var S2 = 108, ox = VW - S2 - 12, oy = VH - S2 - 118, sc = S2 / GRID;
    cx.fillStyle = 'rgba(8,6,14,.8)'; cx.fillRect(ox - 3, oy - 3, S2 + 6, S2 + 6);
    cx.strokeStyle = '#2a2436'; cx.strokeRect(ox - 3.5, oy - 3.5, S2 + 7, S2 + 7);
    cx.strokeStyle = 'rgba(138,74,224,.25)'; cx.strokeRect(ox + 0.5, oy + 0.5, S2 - 1, S2 - 1);
    function blip(x, y, r, col) { cx.fillStyle = col; cx.beginPath(); cx.arc(ox + x * sc, oy + y * sc, r, 0, TAU); cx.fill(); }
    if (RT.mode === 'sandbox' && !RT.dummy.dead) blip(RT.dummy.x, RT.dummy.y, 2.5, '#b89a5e');
    RT.enemies.forEach(function (e) { if (!e.dead) blip(e.x, e.y, e.boss ? 4 : 2, e.boss ? '#c896ff' : '#e05a4a'); });
    if (!RT.dead) blip(RT.px, RT.py, 3, '#9fe0c8');
    cx.fillStyle = '#5a5468'; cx.font = '8px "Pixelify Sans"'; cx.textAlign = 'right';
    cx.fillText(RT.mode === 'trial' ? 'TRIAL' : 'PROVING GROUNDS', ox + S2, oy - 6); cx.textAlign = 'left';
}
function drawDeathOverlay(cx) {
    cx.fillStyle = 'rgba(6,2,6,.5)'; cx.fillRect(0, 0, VW, VH);
    cx.textAlign = 'center';
    cx.fillStyle = '#ff5a6a'; cx.font = '40px "Press Start 2P", monospace';
    cx.fillText('YOU FELL', VW / 2, VH / 2 - 6);
    cx.fillStyle = '#c8b0b4'; cx.font = '13px "Pixelify Sans"';
    cx.fillText(RT.deadT > 0 ? 'rising in ' + Math.ceil(RT.deadT) + '…' : 'rising…', VW / 2, VH / 2 + 24);
    cx.textAlign = 'left';
}

/* ─────────────── HUD ─────────────── */
function updateHud(dt) {
    var st = stats();
    // real elapsed time since the last HUD pass — we run on a 50ms cadence but
    // were being handed a single frame's dt, so lag animations crawled
    var hdt = RT.hudPrev == null ? 0 : Math.min(0.5, RT.t - RT.hudPrev);
    RT.hudPrev = RT.t;
    dt = hdt;
    drawGlobe(RT.root.querySelector('.ar-globe-hp canvas'), RT.life / st.lifeMax, ['#7a1420', '#c22536', '#e8556a'], RT.t);
    drawGlobe(RT.root.querySelector('.ar-globe-mp canvas'), RT.mana / st.manaMax, ['#122a6a', '#2a4fc2', '#5a86e8'], RT.t + 2);
    RT.root.querySelector('.ar-globe-hp .ar-globe-t').textContent = Math.ceil(RT.life) + '/' + st.lifeMax;
    RT.root.querySelector('.ar-globe-mp .ar-globe-t').textContent = Math.ceil(RT.mana) + '/' + st.manaMax;
    // slot cooldown sweeps
    SLOT_KEYS.forEach(function (k) {
        var slot = RT.root.querySelector('.ar-slot[data-slot="' + k + '"]');
        var id = S.binds[k], cdEl = slot.querySelector('.ar-slot-cd');
        if (!id) { cdEl.style.height = '0'; slot.classList.remove('nomana', 'channeling'); return; }
        var sp = SPELLS[id];
        var frac = 0;
        if (id === 'flamedash') frac = RT.dashCharges > 0 ? 0 : clamp(RT.dashCd / sp.cd, 0, 1);
        else if (sp.cd) frac = clamp((RT.cds[id] || 0) / sp.cd, 0, 1);
        cdEl.style.height = (frac * 100) + '%';
        slot.classList.toggle('nomana', RT.mana < sp.mana);
        slot.classList.toggle('channeling', !!(RT.channel && RT.channel.id === id));
    });
    // top boss bar: the WARDEN if one is alive, else the dummy in sandbox, else hidden
    var boss = RT.root.querySelector('.ar-boss');
    var warden = null; for (var wi = 0; wi < RT.enemies.length; wi++) if (RT.enemies[wi].boss && !RT.enemies[wi].dead) warden = RT.enemies[wi];
    var d = warden || (RT.mode === 'sandbox' ? RT.dummy : null);
    var showBar = !!d;
    boss.style.display = showBar ? '' : 'none';
    if (showBar) {
        boss.querySelector('.ar-boss-n').textContent = warden ? 'THE WARDEN' + (warden.phase === 2 ? ' — AWAKENED' : '') : 'TRAINING DUMMY, THE PATIENT';
        boss.classList.toggle('dead', !!d.dead);
        boss.querySelector('.ar-boss-bar i').style.width = clamp(d.hp / d.hpm * 100, 0, 100) + '%';
        var em = boss.querySelector('.ar-boss-bar em');   // lagging white ghost bar
        var cur = parseFloat(em.style.width); if (isNaN(cur)) cur = 100;
        var want = clamp(d.hp / d.hpm * 100, 0, 100);
        em.style.width = Math.max(want, cur - 26 * dt) + '%';
        boss.querySelector('.ar-boss-hp').textContent = d.dead ? 'composting…' : fmtN(Math.max(0, d.hp)) + ' / ' + fmtN(d.hpm);
        var stEl = boss.querySelector('.ar-boss-status');
        var icons = statusIconsOf(d);
        var html = icons.map(function (ic2) {
            var extra = ic2[0] === 'ignite' ? '×' + d.st.ignite.length : ic2[0] === 'umbral' ? '×' + d.st.coils.length : '';
            return '<span class="ar-st" style="border-color:' + ic2[1] + ';color:' + ic2[1] + '" title="' + ic2[0] + '">' + ic2[0] + extra + '</span>';
        }).join('');
        if (stEl._h !== html) { stEl._h = html; stEl.innerHTML = html; }
    }
    // trials + shards readout
    var trialsEl = RT.root.querySelector('.ar-trials');
    var trialActive = RT.mode === 'trial';
    trialsEl.querySelector('.ar-trialbtn').style.display = trialActive ? 'none' : '';
    var waveEl = trialsEl.querySelector('.ar-wave');
    waveEl.hidden = !trialActive;
    if (trialActive && RT.trial) {
        waveEl.querySelector('.ar-wave-n').textContent = 'WAVE ' + RT.trial.wave;
        var aliveN = RT.enemies.filter(function (e) { return !e.dead; }).length;
        waveEl.querySelector('.ar-wave-sub').textContent = RT.trial.phase === 'gap' ? 'next wave incoming…' : aliveN + ' left · score ' + fmtN(RT.trial.score);
    }
    var shN = RT.root.querySelector('.ar-shards-n'); if (shN.textContent !== String(S.shards)) shN.textContent = S.shards;
    var bestN = RT.root.querySelector('.ar-best'); if (bestN.textContent !== String(S.bestWave)) bestN.textContent = S.bestWave;
    // zone title tracks the mode
    var zt = RT.root.querySelector('.ar-zone b'), zi = RT.root.querySelector('.ar-zone i');
    var wantZ = trialActive ? 'THE TRIALS' : 'THE PROVING GROUNDS';
    if (zt.textContent !== wantZ) { zt.textContent = wantZ; zi.textContent = trialActive ? 'wave ' + (RT.trial ? RT.trial.wave : 1) + ' · one must imagine it survivable' : 'act 0 · the story is still being written'; }
    // socket dots on skill slots
    SLOT_KEYS.forEach(function (k) {
        var slot = RT.root.querySelector('.ar-slot[data-slot="' + k + '"]');
        var n = slotGems(k).length, cur = +(slot.getAttribute('data-socks') || 0);
        if (n !== cur) {
            slot.setAttribute('data-socks', n);
            var dots = slot.querySelector('.ar-slot-socks');
            if (!dots && n) { dots = document.createElement('span'); dots.className = 'ar-slot-socks'; slot.appendChild(dots); }
            if (dots) dots.innerHTML = n ? Array(n + 1).join('<i></i>') : '';
        }
    });
    // dps
    RT.root.querySelector('.ar-dps-now').textContent = fmtN(dpsNow());
    RT.root.querySelector('.ar-dps-peak').textContent = fmtN(RT.dps.peak);
    RT.root.querySelector('.ar-dps-total').textContent = fmtN(RT.dps.total);
    RT.root.querySelector('.ar-dps-time').textContent = RT.dps.t0 ? (RT.t - RT.dps.t0).toFixed(1) + 's' : '0.0s';
    // flasks
    RT.flasks.forEach(function (f, i) {
        var el = RT.root.querySelector('.ar-flask[data-flask="' + (i + 1) + '"]');
        f.anim = Math.max(0, f.anim - dt);
        el.querySelector('.ar-flask-liq').style.height = (f.charges / f.max * 82) + '%';
        el.classList.toggle('using', f.anim > 0);
        el.classList.toggle('empty', f.charges <= 0);
        var pips = ''; for (var p = 0; p < f.max; p++) pips += '<i class="' + (p < f.charges ? 'on' : '') + '"></i>';
        var pe = el.querySelector('.ar-flask-pips');
        if (pe._h !== pips) { pe._h = pips; pe.innerHTML = pips; }
    });
    refreshBuffs();
}

/* liquid globes: two sine surfaces + bubbles, clipped to a circle */
function drawGlobe(cv, frac, cols, t) {
    var g = cv.getContext('2d'), W2 = cv.width, R = W2 / 2 - 3;
    frac = clamp(frac, 0, 1);
    g.clearRect(0, 0, W2, W2);
    g.save();
    g.beginPath(); g.arc(W2 / 2, W2 / 2, R, 0, TAU); g.clip();
    // back glass
    g.fillStyle = 'rgba(8,6,14,.88)'; g.fillRect(0, 0, W2, W2);
    var lvl = W2 / 2 + R - frac * R * 2;
    // deep liquid
    g.fillStyle = cols[0];
    g.beginPath(); g.moveTo(0, lvl);
    for (var x = 0; x <= W2; x += 4) g.lineTo(x, lvl + Math.sin(x / 9 + t * 2.1) * 2.2);
    g.lineTo(W2, W2); g.lineTo(0, W2); g.closePath(); g.fill();
    // bright surface layer
    g.fillStyle = cols[1];
    g.beginPath(); g.moveTo(0, lvl + 3);
    for (var x2 = 0; x2 <= W2; x2 += 4) g.lineTo(x2, lvl + 3 + Math.sin(x2 / 7 - t * 2.7) * 2);
    g.lineTo(W2, W2); g.lineTo(0, W2); g.closePath(); g.fill();
    // surface glint
    g.strokeStyle = cols[2]; g.lineWidth = 1.5;
    g.beginPath();
    for (var x3 = 0; x3 <= W2; x3 += 3) { var yy = lvl + Math.sin(x3 / 9 + t * 2.1) * 2.2; x3 ? g.lineTo(x3, yy) : g.moveTo(0, yy); }
    g.stroke();
    // bubbles
    var seed2 = Math.floor(t * 2);
    for (var b = 0; b < 5; b++) {
        var bt = (t * 0.35 + b * 0.21) % 1;
        var bx = W2 / 2 + Math.sin(b * 37.7) * R * 0.5;
        var by = W2 - 6 - bt * (W2 - lvl - 8);
        if (by > lvl + 3) {
            g.fillStyle = 'rgba(255,255,255,' + (0.25 * (1 - bt)) + ')';
            g.beginPath(); g.arc(bx, by, 1.4 + (b % 3) * 0.7, 0, TAU); g.fill();
        }
    }
    g.restore();
    // rim + top glass shine
    g.strokeStyle = '#3a3346'; g.lineWidth = 3;
    g.beginPath(); g.arc(W2 / 2, W2 / 2, R + 1, 0, TAU); g.stroke();
    g.strokeStyle = '#141019'; g.lineWidth = 1;
    g.beginPath(); g.arc(W2 / 2, W2 / 2, R - 1.5, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.09)';
    g.beginPath(); g.ellipse(W2 / 2 - R * 0.3, W2 / 2 - R * 0.45, R * 0.34, R * 0.2, -0.6, 0, TAU); g.fill();
}

/* spell icons: hand-painted 46×46 per spell */
function paintSlots() {
    SLOT_KEYS.forEach(function (k) {
        var slot = RT.root.querySelector('.ar-slot[data-slot="' + k + '"]');
        paintSpellIcon(slot.querySelector('canvas'), S.binds[k]);
    });
}
function paintSpellIcon(cv, id) {
    var g = cv.getContext('2d'), W2 = cv.width;
    g.clearRect(0, 0, W2, W2);
    g.fillStyle = '#0c0a14'; g.fillRect(0, 0, W2, W2);
    if (!id || !SPELLS[id]) { g.strokeStyle = '#241f30'; g.strokeRect(3.5, 3.5, W2 - 7, W2 - 7); return; }
    var sp = SPELLS[id], base = ECOL[sp.el], dark = EDARK[sp.el];
    // element wash
    var bg = g.createRadialGradient(W2 / 2, W2 / 2, 2, W2 / 2, W2 / 2, W2 / 2);
    bg.addColorStop(0, dark); bg.addColorStop(1, '#0c0a14');
    g.fillStyle = bg; g.fillRect(2, 2, W2 - 4, W2 - 4);
    g.strokeStyle = dark; g.strokeRect(1.5, 1.5, W2 - 3, W2 - 3);
    g.fillStyle = base; g.strokeStyle = base; g.lineWidth = 2;
    var c = W2 / 2;
    if (id === 'emberbolt') {         // comet
        g.beginPath(); g.arc(c + 6, c - 6, 6, 0, TAU); g.fill();
        g.globalAlpha = 0.6; g.beginPath(); g.moveTo(c + 2, c - 2); g.lineTo(c - 14, c + 12); g.lineTo(c + 6, c + 2); g.closePath(); g.fill(); g.globalAlpha = 1;
    } else if (id === 'glacialray') { // beam + crystal
        g.beginPath(); g.moveTo(6, c + 8); g.lineTo(W2 - 8, c - 10); g.stroke();
        g.beginPath(); g.moveTo(W2 - 12, c - 16); g.lineTo(W2 - 6, c - 10); g.lineTo(W2 - 12, c - 4); g.lineTo(W2 - 18, c - 10); g.closePath(); g.fill();
    } else if (id === 'arc') {        // zigzag
        g.beginPath(); g.moveTo(10, 8); g.lineTo(c + 4, c - 4); g.lineTo(c - 6, c + 2); g.lineTo(W2 - 10, W2 - 8); g.stroke();
    } else if (id === 'meteor') {     // rock + reticle
        g.globalAlpha = 0.5; g.beginPath(); g.arc(c, W2 - 12, 10, Math.PI, TAU); g.stroke(); g.globalAlpha = 1;
        g.beginPath(); g.arc(c + 4, 14, 7, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(c + 1, 18); g.lineTo(c - 10, 30); g.stroke();
    } else if (id === 'frostnova') {  // snowflake ring
        g.beginPath(); g.arc(c, c, 12, 0, TAU); g.stroke();
        for (var i = 0; i < 6; i++) { var an = i / 6 * TAU; g.beginPath(); g.moveTo(c + Math.cos(an) * 6, c + Math.sin(an) * 6); g.lineTo(c + Math.cos(an) * 17, c + Math.sin(an) * 17); g.stroke(); }
    } else if (id === 'umbralcoil') { // spiral
        g.beginPath();
        for (var a2 = 0; a2 < TAU * 2.2; a2 += 0.2) { var rr = 2 + a2 * 2.4; var px2 = c + Math.cos(a2) * rr, py2 = c + Math.sin(a2) * rr * 0.8; a2 ? g.lineTo(px2, py2) : g.moveTo(px2, py2); }
        g.stroke();
    } else if (id === 'flamedash') {  // chevrons
        for (var d2 = 0; d2 < 3; d2++) { g.globalAlpha = 0.4 + d2 * 0.3; g.beginPath(); g.moveTo(8 + d2 * 9, 12); g.lineTo(16 + d2 * 9, c); g.lineTo(8 + d2 * 9, W2 - 12); g.stroke(); }
        g.globalAlpha = 1;
    } else if (id === 'arcanesurge') { // rising sun
        g.beginPath(); g.arc(c, c + 4, 8, 0, TAU); g.fill();
        for (var s2 = 0; s2 < 5; s2++) { var an2 = Math.PI + s2 / 4 * Math.PI; g.beginPath(); g.moveTo(c - Math.cos(an2) * 12, c + 4 + Math.sin(an2) * 12); g.lineTo(c - Math.cos(an2) * 18, c + 4 + Math.sin(an2) * 18); g.stroke(); }
    } else if (id === 'basalt') {     // spear of rock
        g.save(); g.translate(c, c); g.rotate(-Math.PI / 4);
        g.fillRect(-2, -16, 4, 24);
        g.beginPath(); g.moveTo(0, -22); g.lineTo(6, -12); g.lineTo(-6, -12); g.closePath(); g.fill();
        g.globalAlpha = 0.5; g.fillRect(-5, 8, 10, 3); g.restore(); g.globalAlpha = 1;
    } else if (id === 'sigil') {      // rune ring
        g.beginPath(); g.arc(c, c, 13, 0, TAU); g.stroke();
        for (var r3 = 0; r3 < 4; r3++) { var an3 = r3 / 4 * TAU + 0.4; g.fillRect(c + Math.cos(an3) * 13 - 2.5, c + Math.sin(an3) * 13 - 2.5, 5, 5); }
        g.fillRect(c - 2, c - 2, 4, 4);
    }
}

/* buffs row */
function refreshBuffs() {
    var el2 = RT.root.querySelector('.ar-buffs');
    var out = [];
    if (RT.buffs.surge > 0) out.push(['ARCANE SURGE', RT.buffs.surge, '#ffe66e']);
    if (RT.buffs.quick > 0) out.push(['QUICKSILVER', RT.buffs.quick, '#9fe0c8']);
    var html = out.map(function (b) {
        return '<span class="ar-buff" style="border-color:' + b[2] + '"><b style="color:' + b[2] + '">' + b[0] + '</b><i>' + b[1].toFixed(1) + 's</i></span>';
    }).join('');
    if (el2._h !== html) { el2._h = html; el2.innerHTML = html; }
}

/* flasks */
function useFlask(i) {
    var f = RT.flasks[i]; if (!f || f.charges <= 0) { if (f) logLine('<i>the ' + esc(f.n) + ' is empty.</i> hit things to refill it.', 'dim'); return; }
    var st = stats();
    f.charges--; f.anim = 0.6;
    if (f.kind === 'life') { RT.life = Math.min(st.lifeMax, RT.life + st.lifeMax * 0.35); burst(RT.px, RT.py, 16, 14, { col: '230,70,90', sp0: 0.3, sp1: 1.2, l0: 0.3, l1: 0.8, vz0: 20, vz1: 80 }); }
    else if (f.kind === 'mana') { RT.mana = Math.min(st.manaMax, RT.mana + st.manaMax * 0.4); burst(RT.px, RT.py, 16, 14, { col: '90,134,232', sp0: 0.3, sp1: 1.2, l0: 0.3, l1: 0.8, vz0: 20, vz1: 80 }); }
    else if (f.kind === 'quick') { RT.buffs.quick = 4; refreshBuffs(); }
    logLine('drinks the <b>' + esc(f.n) + '</b>.', 'cast');
    sfx('flask');
}
function flaskGain(n) { RT.flasks.forEach(function (f) { f.charges = Math.min(f.max, f.charges + n); }); }

/* combat log */
function logLine(html, cls) {
    if (!RT) return;
    var sc = RT.root.querySelector('.ar-log-scroll');
    var d = document.createElement('div');
    d.className = 'ar-log-row' + (cls ? ' ar-log-' + cls : '');
    d.innerHTML = '<i>' + fmtClock(RT.t) + '</i> ' + html;
    sc.appendChild(d);
    while (sc.children.length > 60) sc.removeChild(sc.firstChild);
    sc.scrollTop = sc.scrollHeight;
}
function fmtClock(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }

/* xp strip */
function refreshXp() {
    var need = xpNeed(S.lv);
    RT.root.querySelector('.ar-xp i').style.width = clamp(S.xp / need * 100, 0, 100) + '%';
    RT.root.querySelector('.ar-xp-t').textContent = 'LEVEL ' + S.lv + '  ·  ' + fmtN(S.xp) + ' / ' + fmtN(need) + ' xp' + (S.pts ? '  ·  ' + S.pts + ' passive point' + (S.pts > 1 ? 's' : '') + ' waiting (P)' : '');
}

/* nudges: flash a slot red when it refuses */
function hudNudge(id) {
    SLOT_KEYS.forEach(function (k) {
        if (S.binds[k] !== id) return;
        var el2 = RT.root.querySelector('.ar-slot[data-slot="' + k + '"]');
        el2.classList.remove('deny'); void el2.offsetWidth; el2.classList.add('deny');
    });
}
function hudNudgeMana() {
    var g = RT.root.querySelector('.ar-globe-mp');
    g.classList.remove('deny'); void g.offsetWidth; g.classList.add('deny');
}

/* ─────────────── panels ─────────────── */
var AR_PANELS = ['char', 'book', 'tree', 'dummy', 'craft', 'opts'];
function togglePanel(name) {
    var open = RT.panel === name ? null : name;
    RT.panel = open;
    AR_PANELS.forEach(function (p) { RT.root.querySelector('.ar-p-' + p).hidden = open !== p; });
    if (open) refreshPanels();
    if (open === 'tree') drawTree();
}
function refreshPanels() {
    if (!RT) return;
    hideTip();   // panel rebuilds orphan hovered nodes; their pointerleave never fires
    if (RT.panel === 'char') fillChar();
    else if (RT.panel === 'book') fillBook();
    else if (RT.panel === 'dummy') fillDummy();
    else if (RT.panel === 'craft') fillCraft();
    else if (RT.panel === 'opts') fillOpts();
    else if (RT.panel === 'tree') drawTree();
    refreshXp();
}

/* — character sheet: stats + gear + stash — */
function fillChar() {
    var st = stats(), m = st.m;
    hideTip();
    var body = RT.root.querySelector('.ar-p-char .ar-p-body');
    function row(l, v) { return '<div class="ar-crow"><span>' + l + '</span><b>' + v + '</b></div>'; }
    var gearHtml = ['weapon', 'ring', 'amulet'].map(function (slot) {
        var it = S.gear[slot];
        return '<div class="ar-gslot' + (it ? ' filled r-' + it.rarity : '') + '" data-gslot="' + slot + '">' +
            (it ? '<b style="color:' + RARITY[it.rarity] + '">' + esc(it.n) + '</b><i>click to unequip</i>' : '<i>' + slot + ' — empty</i>') + '</div>';
    }).join('');
    var stashHtml = S.stash.length ? S.stash.map(function (it, i) {
        return '<div class="ar-sitem r-' + it.rarity + '" data-stash="' + i + '"><b style="color:' + RARITY[it.rarity] + '">' + esc(it.n) + '</b><i>' + esc(it.slot) + ' · click to equip</i></div>';
    }).join('') : '<div class="ar-empty">the dummy has not been generous yet. correct this.</div>';
    body.innerHTML =
        '<div class="ar-char-cols"><div>' +
        '<h4>THE EXILE <i>· level ' + S.lv + '</i></h4>' +
        row('Life', st.lifeMax) + row('Mana', st.manaMax) +
        row('Mana regen', st.manaRegen.toFixed(1) + '/s') +
        row('Cast speed', '×' + st.castSpd.toFixed(2)) +
        row('Crit chance', st.critCh.toFixed(1) + '%') + row('Crit multi', '×' + st.critMul.toFixed(2)) +
        row('Move speed', '×' + (st.move / 3.1).toFixed(2)) +
        '<h4>DAMAGE</h4>' +
        row('Spell damage', '+' + (m.sd || 0) + '%') +
        row('<span style="color:' + ECOL.fire + '">Fire</span>', '+' + (m.fire || 0) + '%') +
        row('<span style="color:' + ECOL.cold + '">Cold</span>', '+' + (m.cold || 0) + '%') +
        row('<span style="color:' + ECOL.light + '">Lightning</span>', '+' + (m.light || 0) + '%') +
        row('<span style="color:' + ECOL.chaos + '">Chaos</span>', '+' + (m.chaos || 0) + '%') +
        row('Ignite chance', '+' + (m.igniteCh || 0) + '%') + row('Freeze chance', '+' + (m.freezeCh || 0) + '%') + row('Shock chance', '+' + (m.shockCh || 0) + '%') +
        '<h4>LEDGER</h4>' +
        row('Dummies destroyed', S.kills) + row('Critical strikes', S.crits) + row('Void shards', S.shards) +
        '</div><div>' +
        '<h4>EQUIPPED</h4>' + gearHtml +
        '<h4>STASH <i>· loot drops land here</i></h4><div class="ar-stash">' + stashHtml + '</div>' +
        '</div></div>';
    // wiring: equip/unequip + hover tooltips
    body.querySelectorAll('[data-stash]').forEach(function (el2) {
        var it = S.stash[+el2.getAttribute('data-stash')];
        el2.addEventListener('click', function () {
            var idx = +el2.getAttribute('data-stash');
            var item = S.stash[idx]; if (!item) return;
            var old = S.gear[item.slot];
            S.stash.splice(idx, 1);
            if (old) S.stash.push(old);
            S.gear[item.slot] = item;
            logLine('equips <b style="color:' + RARITY[item.rarity] + '">' + esc(item.n) + '</b>.', 'loot');
            sfx('alloc'); sSave(); fillChar(); paintSlots();
            RT.root.focus();
        });
        tipWire(el2, function () { return itemTip(it); });
    });
    body.querySelectorAll('[data-gslot]').forEach(function (el2) {
        var slot = el2.getAttribute('data-gslot'), it = S.gear[slot];
        if (!it) return;
        el2.addEventListener('click', function () {
            if (S.stash.length >= 8) { logLine('<i>stash is full.</i>', 'dim'); return; }
            delete S.gear[slot];
            S.stash.push(it);
            sSave(); fillChar();
            RT.root.focus();
        });
        tipWire(el2, function () { return itemTip(it); });
    });
}

/* — spellbook: bind spells + socket support gems — */
function fillBook() {
    var body = RT.root.querySelector('.ar-p-book .ar-p-body');
    if (!RT.socketSel || !S.binds[RT.socketSel]) RT.socketSel = SLOT_KEYS.filter(function (k) { return S.binds[k]; })[0] || null;
    // gem bag
    var bag = GEM_IDS.filter(function (g) { return (S.gems[g] || 0) > 0; });
    var bagHtml = bag.length ? bag.map(function (g) {
        return '<button class="ar-gem" data-gem="' + g + '" style="border-color:' + GEMS[g].col + '" type="button"><b style="color:' + GEMS[g].col + '">' + esc(GEMS[g].n) + '</b><i>×' + S.gems[g] + '</i></button>';
    }).join('') : '<div class="ar-empty">no support gems yet — they drop from enemies in the Trials.</div>';
    // per-slot socket rows
    var linkHtml = SLOT_KEYS.filter(function (k) { return S.binds[k]; }).map(function (k) {
        var id = S.binds[k], gems = slotGems(k), sel = RT.socketSel === k;
        var socks = [0, 1].map(function (i) {
            var g = gems[i];
            return '<button class="ar-sock' + (g ? ' filled' : '') + '" data-sock="' + k + ':' + i + '"' + (g ? ' style="border-color:' + GEMS[g].col + ';color:' + GEMS[g].col + '"' : '') + ' type="button">' + (g ? esc(GEMS[g].n) : '+') + '</button>';
        }).join('');
        return '<div class="ar-link' + (sel ? ' sel' : '') + '" data-linksel="' + k + '"><span class="ar-link-k">' + k + '</span>' +
            '<span class="ar-link-sp" style="color:' + ECOL[SPELLS[id].el] + '">' + esc(SPELLS[id].n) + '</span><span class="ar-socks">' + socks + '</span></div>';
    }).join('') || '<div class="ar-empty">bind a spell below, then socket gems into it.</div>';
    var spellHtml = SPELL_IDS.map(function (id) {
        var sp = SPELLS[id], r = spellDmg(id);
        return '<div class="ar-spell" data-spell="' + id + '">' +
            '<canvas width="46" height="46"></canvas>' +
            '<div class="ar-spell-b"><b style="color:' + ECOL[sp.el] + '">' + esc(sp.n) + '</b>' +
            '<i class="ar-tags">' + sp.tags.join(' · ') + '</i>' +
            '<p>' + esc(sp.d) + '</p>' +
            '<i class="ar-spell-nums">' + (sp.dmg[1] ? 'deals ' + Math.round(r.lo) + '–' + Math.round(r.hi) + (sp.tick ? ' per ' + sp.tick + 's tick' : '') : 'utility') +
            ' · ' + sp.mana + ' mana' + (sp.cd ? ' · ' + sp.cd + 's cd' : '') + '</i></div>' +
            '<div class="ar-bindrow">' + SLOT_KEYS.map(function (k) {
                return '<button class="ar-bind' + (S.binds[k] === id ? ' on' : '') + '" data-bind="' + k + '" data-of="' + id + '" type="button">' + k + '</button>';
            }).join('') + '</div></div>';
    }).join('');
    body.innerHTML =
        '<h4>LINKS <i>· click a link, then a gem to socket it</i></h4><div class="ar-links">' + linkHtml + '</div>' +
        '<h4>SUPPORT GEMS <i>· bag</i></h4><div class="ar-gembag">' + bagHtml + '</div>' +
        '<h4>SPELLS <i>· click a slot key to bind</i></h4>' + spellHtml;
    body.querySelectorAll('.ar-spell canvas').forEach(function (cv2) { paintSpellIcon(cv2, cv2.closest('.ar-spell').getAttribute('data-spell')); });
    body.querySelectorAll('[data-bind]').forEach(function (b) {
        b.addEventListener('click', function () {
            var k = b.getAttribute('data-bind'), id = b.getAttribute('data-of');
            if (S.binds[k] === id) {   // unbinding: return any socketed gems to the bag, don't destroy them
                (S.sockets[k] || []).forEach(function (g) { S.gems[g] = (S.gems[g] || 0) + 1; });
                delete S.sockets[k]; S.binds[k] = null;
            } else S.binds[k] = id;
            sSave(); paintSlots(); fillBook(); sfx('alloc'); RT.root.focus();
        });
    });
    body.querySelectorAll('[data-linksel]').forEach(function (b) {
        b.addEventListener('click', function () { RT.socketSel = b.getAttribute('data-linksel'); fillBook(); RT.root.focus(); });
    });
    body.querySelectorAll('[data-sock]').forEach(function (b) {
        tipWire(b, function () { var g = slotGems(b.getAttribute('data-sock').split(':')[0])[+b.getAttribute('data-sock').split(':')[1]]; return g ? gemTip(g) : '<b>empty socket</b><i>click a gem in the bag to fill it</i>'; });
        b.addEventListener('click', function () {   // click a socketed gem to pop it back to the bag
            var a = b.getAttribute('data-sock').split(':'), k = a[0], i = +a[1], gems = (S.sockets[k] || []);
            RT.socketSel = k;
            if (gems[i]) { var g = gems.splice(i, 1)[0]; S.gems[g] = (S.gems[g] || 0) + 1; S.sockets[k] = gems; sSave(); }
            fillBook(); RT.root.focus();
        });
    });
    body.querySelectorAll('[data-gem]').forEach(function (b) {
        var g = b.getAttribute('data-gem');
        tipWire(b, function () { return gemTip(g); });
        b.addEventListener('click', function () {
            var k = RT.socketSel; if (!k || !S.binds[k]) { logLine('<i>select a link first (click one under LINKS).</i>', 'dim'); return; }
            var socks = S.sockets[k] || [];
            if (socks.indexOf(g) >= 0) return;             // one of each per link
            if (socks.length >= 2) { var out = socks.pop(); S.gems[out] = (S.gems[out] || 0) + 1; }
            socks.push(g); S.sockets[k] = socks;
            S.gems[g]--; if (S.gems[g] <= 0) delete S.gems[g];
            ach('socket'); sSave(); fillBook(); sfx('alloc'); RT.root.focus();
        });
    });
}
function gemTip(g) {
    return '<b style="color:' + GEMS[g].col + '">' + esc(GEMS[g].n) + '</b><span class="ar-sep"></span><span>' + esc(GEMS[g].d) + '</span>';
}

/* — dummy config — */
function fillDummy() {
    var body = RT.root.querySelector('.ar-p-dummy .ar-p-body');
    var cfg = S.dummy;
    function resRow(el2) {
        return '<div class="ar-crow"><span style="color:' + ECOL[el2] + '">' + el2 + ' resistance</span>' +
            '<span class="ar-cfg"><button data-dc="res:' + el2 + ':-25" type="button">−</button><b>' + (cfg.res[el2] || 0) + '%</b><button data-dc="res:' + el2 + ':25" type="button">+</button></span></div>';
    }
    body.innerHTML =
        '<div class="ar-crow"><span>Maximum life</span><span class="ar-cfg"><button data-dc="hp:-" type="button">−</button><b>' + fmtN(cfg.hpm) + '</b><button data-dc="hp:+" type="button">+</button></span></div>' +
        '<div class="ar-crow"><span>Armour (vs physical)</span><span class="ar-cfg"><button data-dc="ar:-" type="button">−</button><b>' + cfg.armor + '</b><button data-dc="ar:+" type="button">+</button></span></div>' +
        resRow('fire') + resRow('cold') + resRow('light') + resRow('chaos') +
        '<div class="ar-crow"><span>Regenerate 2%/s</span><button class="ar-mini" data-dc="regen" type="button">' + (cfg.regen ? 'ON' : 'OFF') + '</button></div>' +
        '<div class="ar-crow"><span>Resistances cap at 75%. Chaos ignores half. The dummy read the patch notes.</span></div>' +
        '<button class="ar-mini wide" data-dc="reset" type="button">RESET DUMMY + DPS</button>';
    body.querySelectorAll('[data-dc]').forEach(function (b) {
        b.addEventListener('click', function () {
            var a = b.getAttribute('data-dc').split(':');
            if (a[0] === 'hp') cfg.hpm = clamp(a[1] === '+' ? cfg.hpm * 2 : cfg.hpm / 2, 1000, 1280000);
            else if (a[0] === 'ar') cfg.armor = clamp(cfg.armor + (a[1] === '+' ? 500 : -500), 0, 10000);
            else if (a[0] === 'res') cfg.res[a[1]] = clamp((cfg.res[a[1]] || 0) + (+a[2]), -100, 75);
            else if (a[0] === 'regen') cfg.regen = !cfg.regen;
            else if (a[0] === 'reset') {
                RT.dummy = mkDummy(); RT.dummy.bornAt = RT.t;
                RT.dps = { total: 0, peak: 0, t0: 0, hist: [] };
                logLine('dummy and DPS meter reset. clean slate. new sins.', 'sys');
            }
            cfg.hpm = Math.round(cfg.hpm);
            sSave();
            if (a[0] === 'hp') { RT.dummy.hpm = cfg.hpm; RT.dummy.hp = Math.min(RT.dummy.hp, cfg.hpm); }
            fillDummy();
            RT.root.focus();
        });
    });
}

/* — the crafting bench: spend void shards to reshape loot — */
var CRAFT_PREF = ['Honed', 'Warded', 'Blazing', 'Chilling', 'Charged', 'Cruel', 'Vital', 'Runed'];
function craftReroll(it) {
    it.mods = {};
    var n = it.rarity === 'rare' ? irnd(3, 4) : it.rarity === 'magic' ? irnd(1, 2) : 0;
    var used = {};
    for (var i = 0; i < n; i++) {
        var ai = irnd(0, AFFIXES.length - 1); if (used[ai]) continue; used[ai] = 1;
        var a = AFFIXES[ai], hi = Math.random() < 0.45, mods = hi ? a[3] : a[1];
        Object.keys(mods).forEach(function (k) { it.mods[k] = (it.mods[k] || 0) + mods[k]; });
    }
    it.n = it.rarity === 'rare' ? rareName() : it.rarity === 'magic' ? (pick(CRAFT_PREF) + ' ' + it.base) : it.base;
}
function craftCost(it, op) {
    if (op === 'reforge') return it.rarity === 'rare' ? 40 : it.rarity === 'magic' ? 20 : 12;
    if (op === 'augment') return 16;
    if (op === 'upgrade') return it.rarity === 'normal' ? 10 : 25;
    return 0;
}
function fillCraft() {
    var body = RT.root.querySelector('.ar-p-craft .ar-p-body');
    RT.root.querySelector('.ar-craft-sh').textContent = '◈ ' + S.shards + ' shards';
    var items = [];
    ['weapon', 'ring', 'amulet'].forEach(function (s) { if (S.gear[s]) items.push({ it: S.gear[s], where: 'gear', slot: s }); });
    S.stash.forEach(function (it, i) { items.push({ it: it, where: 'stash', idx: i }); });
    if (!items.length) { body.innerHTML = '<div class="ar-empty">No items to craft. The Trials are generous to the violent.</div>'; return; }
    body.innerHTML = '<div class="ar-craft-hint">Void shards reshape loot. Uniques are beyond the bench.</div>' + items.map(function (e, n) {
        var it = e.it, uniq = it.rarity === 'unique';
        var affN = Object.keys(it.mods || {}).length, cap = it.rarity === 'rare' ? 4 : it.rarity === 'magic' ? 2 : 0;
        var mods = Object.keys(it.mods || {}).map(function (k) { return '+' + it.mods[k] + (isPct(k) ? '%' : '') + ' ' + (STAT_LABELS[k] || k); }).join(' · ') || '—';
        return '<div class="ar-craft-it r-' + it.rarity + '" data-ci="' + n + '">' +
            '<div class="ar-craft-h"><b style="color:' + RARITY[it.rarity] + '">' + esc(it.n) + '</b><i>' + esc(it.where === 'gear' ? 'equipped' : it.slot) + '</i></div>' +
            '<i class="ar-craft-mods">' + esc(mods) + '</i>' +
            (uniq ? '<div class="ar-craft-ops"><i class="ar-unbound">The Box keeps its own counsel.</i></div>' :
            '<div class="ar-craft-ops">' +
              '<button class="ar-mini" data-craft="reforge:' + n + '">Reforge ◈' + craftCost(it, 'reforge') + '</button>' +
              (affN < cap ? '<button class="ar-mini" data-craft="augment:' + n + '">Augment ◈' + craftCost(it, 'augment') + '</button>' : '') +
              (it.rarity !== 'rare' ? '<button class="ar-mini" data-craft="upgrade:' + n + '">Upgrade ◈' + craftCost(it, 'upgrade') + '</button>' : '') +
              '<button class="ar-mini" data-craft="sell:' + n + '">Sell +◈' + (it.rarity === 'rare' ? 18 : it.rarity === 'magic' ? 8 : 4) + '</button>' +
            '</div>') + '</div>';
    }).join('');
    body.querySelectorAll('[data-craft]').forEach(function (b) {
        b.addEventListener('click', function () {
            var a = b.getAttribute('data-craft').split(':'), op = a[0], e = items[+a[1]], it = e.it;
            if (op === 'sell') {
                var v = it.rarity === 'rare' ? 18 : it.rarity === 'magic' ? 8 : 4;
                S.shards += v;
                if (e.where === 'gear') delete S.gear[e.slot]; else S.stash.splice(e.idx, 1);
                logLine('sold <b style="color:' + RARITY[it.rarity] + '">' + esc(it.n) + '</b> for ' + v + ' shards.', 'loot');
            } else {
                var cost = craftCost(it, op);
                if (S.shards < cost) { logLine('<i>not enough shards.</i> the Trials await.', 'dim'); return; }
                if (op === 'upgrade' && it.rarity === 'rare') return;
                S.shards -= cost;
                if (op === 'reforge') { craftReroll(it); ach('craft'); }
                else if (op === 'upgrade') { it.rarity = it.rarity === 'normal' ? 'magic' : 'rare'; craftReroll(it); }
                else if (op === 'augment') {
                    var cap2 = it.rarity === 'rare' ? 4 : 2, tries = 0;
                    while (Object.keys(it.mods).length < cap2 && tries++ < 12) {
                        var af = AFFIXES[irnd(0, AFFIXES.length - 1)], hi = Math.random() < 0.45, mm = hi ? af[3] : af[1], nk = Object.keys(mm)[0];
                        if (!it.mods[nk]) Object.keys(mm).forEach(function (k) { it.mods[k] = mm[k]; });
                    }
                }
                logLine('the bench reshapes <b style="color:' + RARITY[it.rarity] + '">' + esc(it.n) + '</b>.', 'loot');
                sfx('alloc');
            }
            sSave(); fillCraft(); paintSlots(); RT.root.focus();
        });
        var e = items[+b.getAttribute('data-craft').split(':')[1]];
        tipWire(b, function () { return itemTip(e.it); });
    });
}

/* — options — */
function fillOpts() {
    var body = RT.root.querySelector('.ar-p-opts .ar-p-body');
    var o = S.opts;
    function toggle(key, label, on) { return '<div class="ar-crow"><span>' + label + '</span><button class="ar-mini" data-opt="' + key + '">' + (on ? 'ON' : 'OFF') + '</button></div>'; }
    body.innerHTML =
        toggle('shake', 'Screen shake', o.shake) +
        toggle('nums', 'Floating damage numbers', o.nums) +
        toggle('sound', 'Sound', S.sound) +
        '<div class="ar-crow"><span>Particle density</span><span class="ar-cfg"><button data-opt="parts-" type="button">−</button><b>' + ['Low', 'Medium', 'High'][o.parts] + '</b><button data-opt="parts+" type="button">+</button></span></div>' +
        '<div class="ar-crow"><span>Controls: WASD/click move · LMB-RMB-Q-E-R-T cast · Space dash · 1/2/3 flasks</span></div>' +
        '<div class="ar-crow"><span>Panels: C char · B spells+gems · P passives · K bench · O dummy</span></div>' +
        '<button class="ar-mini wide danger" data-opt="wipe">ERASE SAVE (start over)</button>';
    body.querySelectorAll('[data-opt]').forEach(function (b) {
        b.addEventListener('click', function () {
            var k = b.getAttribute('data-opt');
            if (k === 'shake' || k === 'nums') o[k] = !o[k];
            else if (k === 'sound') { S.sound = !S.sound; RT.root.querySelector('.ar-pbtn[data-ar="snd"]').classList.toggle('off', !S.sound); }
            else if (k === 'parts+') o.parts = clamp(o.parts + 1, 0, 2);
            else if (k === 'parts-') o.parts = clamp(o.parts - 1, 0, 2);
            else if (k === 'wipe') {
                dlgWipe();
                return;
            }
            sSave(); fillOpts(); RT.root.focus();
        });
    });
}
function dlgWipe() {
    if (RT._wipeArm) { try { localStorage.removeItem('comp_arpg'); } catch (e) {} S = null; sLoad(); logLine('<b>Save erased.</b> A clean exile. Reopen VEILFALL for a fresh start.', 'kill'); RT._wipeArm = false; fillOpts(); return; }
    RT._wipeArm = true;
    var b = RT.root.querySelector('[data-opt="wipe"]'); if (b) b.textContent = 'CLICK AGAIN TO CONFIRM';
    setTimeout(function () { RT._wipeArm = false; if (RT && RT.panel === 'opts') fillOpts(); }, 3000);
}

/* — the passive web — */
function treeCtx() { return RT.root.querySelector('.ar-tree-cv').getContext('2d'); }
function drawTree() {
    var cv = RT.root.querySelector('.ar-tree-cv'), g = cv.getContext('2d');
    var W2 = cv.width, H2 = cv.height;
    RT.root.querySelector('.ar-tree-pts').textContent = S.pts + ' point' + (S.pts === 1 ? '' : 's');
    g.clearRect(0, 0, W2, H2);
    g.fillStyle = '#0a0812'; g.fillRect(0, 0, W2, H2);
    // faint constellation dust
    var seed3 = 9; function fr3() { seed3 = (seed3 * 1103515245 + 12345) >>> 0; return (seed3 >>> 8) / 16777216; }
    for (var i = 0; i < 70; i++) { g.fillStyle = 'rgba(160,140,200,' + (fr3() * 0.12) + ')'; g.fillRect(fr3() * W2, fr3() * H2, 1.4, 1.4); }
    var ox = W2 / 2 + RT.treePan.x, oy = H2 / 2 + 40 + RT.treePan.y;
    // edges
    PASSIVES.forEach(function (p) {
        (p.req || []).forEach(function (rq) {
            var q = PASS_BY_ID[rq];
            var on = S.alloc[p.id] && S.alloc[q.id];
            var can = S.alloc[q.id] || S.alloc[p.id];
            g.strokeStyle = on ? 'rgba(196,150,255,.9)' : can ? 'rgba(140,110,190,.45)' : 'rgba(70,60,95,.4)';
            g.lineWidth = on ? 2.5 : 1.5;
            g.beginPath(); g.moveTo(ox + p.x, oy + p.y); g.lineTo(ox + q.x, oy + q.y); g.stroke();
        });
    });
    // nodes
    PASSIVES.forEach(function (p) {
        var x = ox + p.x, y = oy + p.y;
        var on = !!S.alloc[p.id], can = canAlloc(p);
        if (p.keystone) {   // keystones: gold hexish frame
            var kr = 15;
            g.save(); g.translate(x, y);
            g.beginPath(); for (var s = 0; s < 6; s++) { var an = s / 6 * TAU + Math.PI / 6; g[s ? 'lineTo' : 'moveTo'](Math.cos(an) * kr, Math.sin(an) * kr); } g.closePath();
            g.fillStyle = on ? '#4a3410' : '#1c1608'; g.fill();
            g.strokeStyle = on ? '#ffcf5a' : can ? '#b08a3a' : '#5a4a28'; g.lineWidth = 2.5; g.stroke();
            if (on) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,200,90,.22)'; g.beginPath(); g.arc(0, 0, kr + 6, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; }
            g.restore();
            return;
        }
        var r = p.notable ? 11 : 7;
        if (p.notable) {  // notable frame
            g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
            g.fillStyle = on ? '#3d2c5c' : '#1a1524';
            g.fillRect(-r - 3, -r - 3, (r + 3) * 2, (r + 3) * 2);
            g.strokeStyle = on ? '#c896ff' : can ? '#8a6ac0' : '#463c5f';
            g.strokeRect(-r - 3, -r - 3, (r + 3) * 2, (r + 3) * 2);
            g.restore();
        }
        g.beginPath(); g.arc(x, y, r, 0, TAU);
        g.fillStyle = on ? '#8a4ae0' : can ? '#31244a' : '#161020';
        g.fill();
        g.strokeStyle = on ? '#d8bcff' : can ? '#7a5ab0' : '#3a3346';
        g.lineWidth = 2; g.stroke();
        if (on) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(160,110,240,.25)'; g.beginPath(); g.arc(x, y, r + 5, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; }
    });
    g.fillStyle = '#5a5468'; g.font = '10px "Pixelify Sans"';
    g.fillText('drag to pan · click to allocate · diamonds are notables · gold hexes are keystones', 10, H2 - 10);
}
function canAlloc(p) {
    if (S.alloc[p.id]) return false;
    if (p.free) return true;
    if (S.pts <= 0) return false;
    return (p.req || []).some(function (r) { return S.alloc[r]; });
}
function wireTree(cv) {
    var drag = null, moved = false;
    cv.addEventListener('pointerdown', function (e) {
        drag = { x: e.clientX, y: e.clientY, px: RT.treePan.x, py: RT.treePan.y }; moved = false;
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}   // synthetic pointers have no capture
    });
    cv.addEventListener('pointermove', function (e) {
        var tip = RT.root.querySelector('.ar-tree-tip');
        if (drag) {
            var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
            RT.treePan.x = clamp(drag.px + dx, -320, 320);
            RT.treePan.y = clamp(drag.py + dy, -260, 380);
            drawTree();
        }
        // hover tooltip
        var p = treeHit(cv, e);
        if (p) {
            tip.hidden = false;
            var mods = Object.keys(p.m || {}).map(function (k) { return '+' + p.m[k] + (isPct(k) ? '%' : '') + ' ' + (STAT_LABELS[k] || k); }).join('<br>');
            var ksd = p.keystone ? KEYSTONES[p.keystone].d : p.d;
            tip.innerHTML = '<b class="' + (p.keystone ? 'ar-tt-ks' : p.notable ? 'ar-tt-not' : '') + '">' + esc(p.n) + '</b>' + (mods ? '<span>' + mods + '</span>' : '') +
                (ksd ? '<i>' + esc(ksd) + '</i>' : '') +
                (S.alloc[p.id] ? '<em>allocated</em>' : canAlloc(p) ? '<em class="ok">click to allocate</em>' : '<em>needs a connected node' + (S.pts <= 0 ? ' + a point' : '') + '</em>');
            var r2 = cv.getBoundingClientRect();
            tip.style.left = clamp(e.clientX - r2.left + 14, 0, r2.width - 190) + 'px';
            tip.style.top = clamp(e.clientY - r2.top + 10, 0, r2.height - 90) + 'px';
        } else tip.hidden = true;
    });
    cv.addEventListener('pointerup', function (e) {
        if (drag && !moved) {
            var p = treeHit(cv, e);
            if (p && canAlloc(p)) {
                S.alloc[p.id] = 1;
                if (!p.free) S.pts--;
                var na = 0; Object.keys(S.alloc).forEach(function () { na++; });
                if (na >= 10) ach('web10');
                if (p.keystone) ach('keystone');
                logLine('allocates <b style="color:' + (p.keystone ? '#ffcf5a' : '#c896ff') + '">' + esc(p.n) + '</b>.', 'lv');
                sfx('alloc'); sSave(); drawTree(); refreshXp();
                // life/mana maxima may have grown
            } else if (p && S.alloc[p.id] && !p.free) {
                // refund on click of an allocated LEAF (nothing depends on it)
                var isLeaf = !PASSIVES.some(function (q) { return S.alloc[q.id] && (q.req || []).indexOf(p.id) >= 0 && !hasOtherPath(q, p); });
                if (isLeaf) { delete S.alloc[p.id]; S.pts++; sfx('curse'); sSave(); drawTree(); refreshXp(); logLine('refunds <b>' + esc(p.n) + '</b>. the web forgets nothing, but it forgives.', 'dim'); }
            }
        }
        drag = null;
        RT.root.focus();
    });
    cv.addEventListener('pointerleave', function () { RT.root.querySelector('.ar-tree-tip').hidden = true; });
}
function hasOtherPath(q, skip) { return (q.req || []).some(function (r) { return r !== skip.id && S.alloc[r]; }); }
function treeHit(cv, e) {
    var r = cv.getBoundingClientRect();
    var mx = (e.clientX - r.left) * (cv.width / r.width), my = (e.clientY - r.top) * (cv.height / r.height);
    var ox = cv.width / 2 + RT.treePan.x, oy = cv.height / 2 + 40 + RT.treePan.y;
    var hit = null;
    PASSIVES.forEach(function (p) {
        var rr = (p.keystone ? 17 : p.notable ? 14 : 9);
        if (Math.hypot(mx - (ox + p.x), my - (oy + p.y)) <= rr) hit = p;
    });
    return hit;
}

/* — shared tooltip plumbing (skill bar + items) — */
function tipWire(el2, htmlFn) {
    el2.addEventListener('pointerenter', function (e) { showTip(htmlFn(), e); });
    el2.addEventListener('pointermove', function (e) { showTip(htmlFn(), e); });
    el2.addEventListener('pointerleave', hideTip);
}
function showTip(html, e) {
    var tip = RT.root.querySelector('.ar-tip'), r = RT.root.getBoundingClientRect();
    tip.innerHTML = html; tip.hidden = false;
    var x = e.clientX - r.left + 16, y = e.clientY - r.top - 10;
    tip.style.left = clamp(x, 4, r.width - 240) + 'px';
    tip.style.top = clamp(y - tip.offsetHeight, 4, r.height - 40) + 'px';
}
function hideTip() { var t = RT && RT.root.querySelector('.ar-tip'); if (t) t.hidden = true; }
function spellTip(id, gems) {
    var sp = SPELLS[id]; if (!sp) return '';
    var r = spellDmg(id, gems), mana = spellManaCost(id, gems);
    var gemLine = (gems && gems.length) ? '<span class="ar-sep"></span><span style="color:#9fe0c8">linked: ' + gems.map(function (g) { return GEMS[g].n; }).join(', ') + '</span>' : '';
    return '<b style="color:' + ECOL[sp.el] + '">' + esc(sp.n) + '</b>' +
        '<i class="ar-tags">' + sp.tags.join(' · ') + '</i><span class="ar-sep"></span>' +
        (sp.dmg[1] ? '<span>Deals <b>' + Math.round(r.lo) + '–' + Math.round(r.hi) + '</b> ' + sp.el + ' damage' + (sp.tick ? ' per ' + sp.tick + 's tick (ramps ×' + sp.ramp + ')' : '') + '</span>' : '<span>Utility</span>') +
        '<span>' + mana + ' mana' + (sp.cd ? ' · ' + sp.cd + 's cooldown' : '') + (sp.charges ? ' · ' + sp.charges + ' charges' : '') + '</span>' +
        gemLine + '<span class="ar-sep"></span><i class="ar-it-fl">' + esc(sp.d) + '</i>';
}

/* HUD wiring: panel buttons, slot tooltips + click-to-open-book, log toggle, dps reset */
function wireHud(root) {
    root.querySelectorAll('.ar-pbtn').forEach(function (b) {
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            var a = b.getAttribute('data-ar');
            if (a === 'snd') { S.sound = !S.sound; sSave(); b.classList.toggle('off', !S.sound); logLine('sound ' + (S.sound ? 'on' : 'off') + '.', 'dim'); }
            else togglePanel(a);
            root.focus();
        });
    });
    root.querySelector('.ar-pbtn[data-ar="snd"]').classList.toggle('off', !S.sound);
    root.querySelectorAll('.ar-panel .ar-x').forEach(function (x) {
        x.addEventListener('click', function () { togglePanel(null); root.focus(); });
    });
    root.querySelectorAll('.ar-slot').forEach(function (slot) {
        var k = slot.getAttribute('data-slot');
        tipWire(slot, function () { return spellTip(S.binds[k], slotGems(k)) || '<b>empty slot</b><i>bind a spell in the book (B)</i>'; });
        slot.addEventListener('click', function (e) { e.stopPropagation(); togglePanel('book'); });
    });
    RT.flasks.forEach(function (f, i) {
        var el2 = root.querySelector('.ar-flask[data-flask="' + (i + 1) + '"]');
        tipWire(el2, function () {
            return '<b>' + esc(f.n) + '</b><span>' + f.charges + '/' + f.max + ' charges</span>' +
                '<i class="ar-it-fl">' + (f.kind === 'life' ? 'Restores 35% life. Tastes like cranberry and denial.' : f.kind === 'mana' ? 'Restores 40% mana. Carbonated. Do not shake.' : '+40% movement speed for 4s. Legal in most leagues.') + '</i>';
        });
        el2.addEventListener('click', function () { useFlask(i); root.focus(); });
    });
    root.querySelector('[data-ar="dpsreset"]').addEventListener('click', function () {
        RT.dps = { total: 0, peak: 0, t0: 0, hist: [] };
        logLine('DPS meter reset.', 'dim'); root.focus();
    });
    root.querySelector('[data-ar="trial"]').addEventListener('click', function (e) { e.stopPropagation(); startTrial(); root.focus(); });
    root.querySelector('[data-ar="abandon"]').addEventListener('click', function (e) { e.stopPropagation(); if (RT.mode === 'trial') { logLine('You step out of the Trials.', 'sys'); endTrial(false); } root.focus(); });
    root.querySelector('.ar-log-title').addEventListener('click', function () {
        root.querySelector('.ar-log').classList.toggle('open');
    });
    wireTree(root.querySelector('.ar-tree-cv'));
    refreshXp();
}

/* ─────────────── lifecycle + Steam surface ─────────────── */
function close() {
    var hrs = RT ? (Date.now() - RT.started) / 3600000 : 0;
    if (RT) {
        cancelAnimationFrame(RT.raf);
        RT.timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
        window.removeEventListener('pointerup', RT.mup);
        if (RT.ac) { try { RT.ac.close(); } catch (e) {} }
        RT = null;
    }
    if (S) sSave();
    if (window.__arpg) delete window.__arpg;
    return hrs;   // raw — the caller accumulates, display rounds
}
function steamAch() {
    sLoad();
    var n = 0; ACH.forEach(function (a) { if (S.ach[a[0]]) n++; });
    return { n: n, total: ACH.length, list: ACH.map(function (a) { return [a[1], a[2], S.ach[a[0]] ? 1 : 0]; }) };
}

window.ARPG = { render: render, init: init, close: close, steamAch: steamAch };
})();
