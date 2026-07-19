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
    }
};
var SPELL_IDS = Object.keys(SPELLS);
var SLOT_KEYS = ['LMB', 'RMB', 'Q', 'W', 'E', 'R'];
var DEFAULT_BINDS = { LMB: 'emberbolt', RMB: 'frostnova', Q: 'glacialray', W: 'arc', E: 'umbralcoil', R: 'meteor' };

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
    { id: 'g7', n: 'THE LONG GAME', x: 0, y: -340, m: { sd: 20, life: 40, mana: 40 }, req: ['n5'], notable: 1, d: 'One must imagine the exile levelling.' }
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

/* ─────────────── save state ─────────────── */
var S = null;
function sLoad() {
    if (S) return;
    try { S = JSON.parse(localStorage.getItem('comp_arpg') || 'null'); } catch (e) { S = null; }
    if (!S) S = {};
    S.lv = S.lv || 1; S.xp = S.xp || 0; S.pts = S.pts == null ? 2 : S.pts;
    S.alloc = S.alloc || { core: 1 };
    S.binds = S.binds || JSON.parse(JSON.stringify(DEFAULT_BINDS));
    S.gear = S.gear || {};             // slot -> item
    S.stash = S.stash || [];           // unequipped items (cap 8)
    S.shards = S.shards || 0;
    S.kills = S.kills || 0;
    S.ach = S.ach || {};
    S.crits = S.crits || 0;
    S.sound = S.sound == null ? true : S.sound;
    S.dummy = S.dummy || { hpm: 10000, armor: 0, res: { fire: 0, cold: 0, light: 0, chaos: 0 }, regen: false };
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
function stats() {
    var m = statSum();
    return {
        m: m,
        lifeMax: Math.round((320 + (S.lv - 1) * 22 + m.life)),
        manaMax: Math.round((180 + (S.lv - 1) * 14 + m.mana)),
        manaRegen: 8 * (1 + m.manaRegen / 100),
        lifeRegen: m.lifeRegen || 0,
        castSpd: 1 * (1 + m.cast / 100),
        critCh: clamp(8 + m.crit, 0, 95),
        critMul: 1.5 + m.critMul / 100,
        move: 3.1 * (1 + m.move / 100),
        igniteCh: m.igniteCh, igniteDmg: m.igniteDmg, chillPow: m.chillPow,
        freezeCh: m.freezeCh, shockCh: m.shockCh, shatter: m.shatter, dotDmg: m.dotDmg
    };
}
/* a spell's damage range with every modifier applied (for tooltips AND for hits) */
function spellDmg(id) {
    var sp = SPELLS[id], st = stats(), m = st.m;
    var lvMul = 1 + (S.lv - 1) * 0.12;
    var inc = 1 + (m.sd + (m[sp.el] || 0)) / 100;
    return { lo: sp.dmg[0] * lvMul * inc, hi: sp.dmg[1] * lvMul * inc, st: st };
}

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
              '<button class="ar-pbtn" data-ar="dummy" type="button" title="Dummy config (T)">T</button>' +
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
    logLine('WASD or click to move · LMB/RMB/Q/W/E/R to cast · Space to dash · C B P T for panels', 'dim');
    RT.last = performance.now();
    RT.raf = requestAnimationFrame(frame);
    // test handle for headless driving (rAF is frozen there — tick() advances manually)
    if (/[?&]dev=/.test(location.search)) {
        window.__arpg = {
            tick: function (n, dt) { for (var i = 0; i < (n || 1); i++) step(dt || 1 / 60); draw(); },
            cast: function (id) { tryCast(id, RT.mouse.wx, RT.mouse.wy); },
            aimAtDummy: function () { var d = RT.dummy; RT.mouse.wx = d.x; RT.mouse.wy = d.y; RT.mouse.x = isoX(d.x, d.y); RT.mouse.y = isoY(d.x, d.y); },
            state: function () { return { life: RT.life, mana: RT.mana, dummyHp: RT.dummy.hp, lv: S.lv, xp: S.xp, kills: S.kills, dps: RT.dps, statuses: RT.dummy.st }; },
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
    setTimeout(function () { root.focus(); }, 30);
}
function mkDummy() {
    sLoad();
    return {
        x: GRID / 2, y: GRID / 2 - 3.2, hp: S.dummy.hpm, hpm: S.dummy.hpm,
        dead: 0, respawn: 0, wobble: 0, flashT: 0, spawnT: 0,
        st: { ignite: [], chill: 0, freeze: 0, shock: 0, sigil: 0, coils: [] },
        lastReset: 0, bornAt: 0
    };
}

/* ─────────────── input ─────────────── */
function wireInput(root, cv) {
    function toWorld(e) {
        var r = cv.getBoundingClientRect();
        var mx = (e.clientX - r.left) * (VW / r.width), my = (e.clientY - r.top) * (VH / r.height);
        // invert iso: x-y = (mx-ORX)/(TW/2) ; x+y = (my-ORY)/(TH/2)
        var a = (mx - ORX) / (TILE_W / 2), b = (my - ORY) / (TILE_H / 2);
        return { x: mx, y: my, wx: (a + b) / 2, wy: (b - a) / 2 };
    }
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) {
        var p = toWorld(e);
        RT.mouse.x = p.x; RT.mouse.y = p.y; RT.mouse.wx = p.wx; RT.mouse.wy = p.wy;
    });
    cv.addEventListener('pointerdown', function (e) {
        root.focus();
        var p = toWorld(e);
        RT.mouse.x = p.x; RT.mouse.y = p.y; RT.mouse.wx = p.wx; RT.mouse.wy = p.wy;
        if (e.button === 2) { RT.mouse.rdown = true; slotCast('RMB'); }
        else if (e.button === 0) {
            RT.mouse.down = true;
            // the arpg law: LMB moves on ground, casts on the enemy; Shift forces the cast
            var d = RT.dummy, nearDummy = !d.dead && Math.hypot(d.x - p.wx, d.y - p.wy) < 1.35;
            if (e.shiftKey || nearDummy) slotCast('LMB');
            else RT.moveTo = { x: clamp(p.wx, 0.8, GRID - 0.8), y: clamp(p.wy, 0.8, GRID - 0.8) };
        }
    });
    window.addEventListener('pointerup', RT.mup = function (e) {
        if (e.button === 2) RT.mouse.rdown = false;
        if (e.button === 0) RT.mouse.down = false;
    });
    root.addEventListener('keydown', function (e) {
        if (e.altKey) return;                     // Alt belongs to the OS
        var k = e.key.toLowerCase();
        if (k === 'escape') { if (RT.panel) { togglePanel(null); e.stopPropagation(); } return; }
        RT.keys[k] = true;
        if (k === 'q') slotCast('Q');
        else if (k === 'w') slotCast('W');
        else if (k === 'e') slotCast('E');
        else if (k === 'r') slotCast('R');
        else if (k === ' ') { e.preventDefault(); doDash(); }
        else if (k === '1') useFlask(0);
        else if (k === '2') useFlask(1);
        else if (k === '3') useFlask(2);
        else if (k === 'c') togglePanel('char');
        else if (k === 'b') togglePanel('book');
        else if (k === 'p') togglePanel('tree');
        else if (k === 't') togglePanel('dummy');
        else if (k === 'h') RT.root.querySelector('.ar-log').classList.toggle('open');
        else return;
        e.preventDefault(); e.stopPropagation();
    });
    root.addEventListener('keyup', function (e) { RT.keys[e.key.toLowerCase()] = false; });
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
    // channelling roots you gently (arpg law)
    if (RT.channel) RT.walking = false;
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

/* ─────────────── the dummy ─────────────── */
function stepDummy(dt) {
    var d = RT.dummy;
    d.wobble = Math.max(0, d.wobble - dt * 3);
    d.flashT = Math.max(0, d.flashT - dt);
    d.spawnT = Math.max(0, d.spawnT - dt);
    if (d.dead) {
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
    var st = d.st;
    // ignite stacks tick
    for (var i = st.ignite.length - 1; i >= 0; i--) {
        var ig = st.ignite[i];
        ig.next -= dt; ig.t -= dt;
        if (ig.next <= 0) {
            ig.next = 0.5;
            dealRaw(ig.dps * 0.5, 'fire', { dot: true, tag: 'ignite' });
            S.igniteTicks = (S.igniteTicks || 0) + 1;
        }
        if (ig.t <= 0) st.ignite.splice(i, 1);
    }
    // umbral coils tick
    for (var j = st.coils.length - 1; j >= 0; j--) {
        var c = st.coils[j];
        c.next -= dt; c.t -= dt;
        if (c.next <= 0) { c.next = 0.5; dealRaw(c.dps * 0.5, 'chaos', { dot: true, tag: 'umbral' }); }
        if (c.t <= 0) st.coils.splice(j, 1);
    }
    st.chill = Math.max(0, st.chill - dt);
    st.freeze = Math.max(0, st.freeze - dt);
    st.shock = Math.max(0, st.shock - dt);
    st.sigil = Math.max(0, st.sigil - dt);
    if (S.dummy.regen && d.hp < d.hpm) d.hp = Math.min(d.hpm, d.hp + d.hpm * 0.02 * dt);
    // status particles
    if (st.ignite.length && Math.random() < 0.35) burst(d.x, d.y, rnd(10, 40), 1, { col: '255,120,30', sp0: 0.1, sp1: 0.6, l0: 0.3, l1: 0.8 });
    if (st.freeze > 0 && Math.random() < 0.2) burst(d.x, d.y, rnd(6, 44), 1, { col: '160,220,255', sp0: 0.05, sp1: 0.3, l0: 0.4, l1: 1, grav: 30 });
    if (st.shock > 0 && Math.random() < 0.3) spawnPart({ x: d.x + rnd(-0.3, 0.3), y: d.y + rnd(-0.3, 0.3), z: rnd(8, 46), vx: 0, vy: 0, vz: 0, life: 0.1, size: rnd(1, 2.5), col: '255,240,140', add: 1, grav: 0 });
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
function statusIcons() {
    var st = RT.dummy.st, out = [];
    if (st.ignite.length) out.push(['ignite', '#ff7a2e']);
    if (st.chill > 0) out.push(['chill', '#6fd4ff']);
    if (st.freeze > 0) out.push(['freeze', '#bfe6ff']);
    if (st.shock > 0) out.push(['shock', '#ffe66e']);
    if (st.sigil > 0) out.push(['sigil', '#c06aff']);
    if (st.coils.length) out.push(['umbral', '#8a4ae0']);
    return out;
}

/* ─────────────── damage pipeline ───────────────
   hit → crit roll → dummy armor/res/shock/sigil → number,
   log, dps, xp, statuses, death. Chaos pierces half of res. */
function dealHit(base, el, opt) {
    opt = opt || {};
    var d = RT.dummy; if (d.dead) return 0;
    var st = opt.st || stats();
    var crit = Math.random() * 100 < st.critCh;
    var dmg = base * (crit ? st.critMul : 1);
    dmg = dealRaw(dmg, el, { crit: crit, tag: opt.tag, quiet: opt.quiet, spell: opt.spell });
    if (crit) { S.crits++; if (S.crits >= 10) ach('crit10'); }
    // status application
    if (dmg > 0 && !d.dead) applyStatus(el, dmg, st, opt);
    return dmg;
}
function dealRaw(dmg, el, opt) {
    opt = opt || {};
    var d = RT.dummy; if (d.dead) return 0;
    var cfg = S.dummy;
    if (el === 'phys' && cfg.armor > 0) dmg *= 1 - clamp(cfg.armor / (cfg.armor + 5 * dmg), 0, 0.9);
    else if (el !== 'phys') {
        var res = clamp(cfg.res[el] || 0, -100, 75);
        if (el === 'chaos') res /= 2;                       // chaos does not read the resistance sheet fully
        dmg *= 1 - res / 100;
    }
    if (d.st.shock > 0) dmg *= 1.4;
    if (d.st.sigil > 0) dmg *= 1.25;
    if (opt.shatterMul) dmg *= opt.shatterMul;
    dmg = Math.max(1, Math.round(dmg));
    d.hp -= dmg;
    d.wobble = Math.min(1, d.wobble + (opt.dot ? 0.1 : 0.5));
    if (!opt.dot) d.flashT = 0.09;
    // numbers: dots small + tinted, crits huge
    var col = opt.dot ? 'rgba(' + hex2rgb(ECOL[el]) + ',.85)' : (opt.crit ? '#ffd24a' : ECOL[el]);
    num(d.x + rnd(-0.25, 0.25), d.y + rnd(-0.15, 0.15), fmtN(dmg), col, dmg > 200, opt.crit);
    // dps + xp + flask charges + achievements
    dpsAdd(dmg);
    gainXp(Math.round(dmg / 6));
    if (!opt.dot) { RT.hitN = (RT.hitN || 0) + 1; if (RT.hitN % 6 === 0) flaskGain(1); }
    ach('blood');
    if (dmg >= 1000) ach('overkill');
    var s2 = d.st;
    if (s2.ignite.length && s2.chill > 0 && s2.shock > 0) ach('storm');
    if (!opt.quiet) {
        logLine((opt.spell ? '<b>' + esc(opt.spell) + '</b> ' : '') + (opt.crit ? '<b class="ar-log-crit">CRITS</b> the dummy for ' : opt.dot ? '<i>' + esc(opt.tag || 'dot') + '</i> ticks for ' : 'hits the dummy for ') + '<b style="color:' + ECOL[el] + '">' + fmtN(dmg) + '</b>', opt.dot ? 'dot' : 'hit');
    }
    if (d.hp <= 0) dummyDeath();
    return dmg;
}
function hex2rgb(h) { return parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' + parseInt(h.slice(5, 7), 16); }
function applyStatus(el, dmg, st, opt) {
    var d = RT.dummy, sp = opt.spellId ? SPELLS[opt.spellId] : null;
    if (el === 'fire') {
        var ch = (sp && sp.ignite ? sp.ignite * 100 : 0) + st.igniteCh + (opt.forceIgnite ? 100 : 0);
        if (Math.random() * 100 < ch) {
            d.st.ignite.push({ dps: dmg * 0.35 * (1 + (st.igniteDmg + st.dotDmg) / 100), t: 3, next: 0.5 });
            if (d.st.ignite.length > 3) d.st.ignite.shift();
            logLine('the dummy is <b style="color:#ff7a2e">ignited</b>. it does not scream. it never screams.', 'st');
        }
    }
    if (el === 'cold') {
        d.st.chill = Math.max(d.st.chill, 2.4 * (1 + st.chillPow / 100));
        if (Math.random() * 100 < st.freezeCh + (opt.freezeBonus || 0)) {
            if (d.st.freeze <= 0) logLine('the dummy is <b style="color:#bfe6ff">frozen solid</b>.', 'st');
            d.st.freeze = Math.max(d.st.freeze, 1.6);
        }
    }
    if (el === 'light') {
        var sh = (sp && sp.shock ? sp.shock * 100 : 0) + st.shockCh;
        if (Math.random() * 100 < sh) {
            if (d.st.shock <= 0) logLine('the dummy is <b style="color:#ffe66e">shocked</b> (+40% damage taken).', 'st');
            d.st.shock = Math.max(d.st.shock, 4);
        }
    }
}
function dummyDeath() {
    var d = RT.dummy;
    d.dead = 1; d.respawn = 2.2; d.hp = 0;
    S.kills++;
    ach('slain'); if (S.kills >= 10) ach('serial');
    if (RT.t - d.bornAt < 15) ach('speed');
    // straw explosion + loot
    burst(d.x, d.y, 20, 46, { col: '184,154,94', add: 0, sp0: 1, sp1: 3.4, l0: 0.5, l1: 1.4, grav: 160 });
    burst(d.x, d.y, 26, 22, { col: '255,200,120', sp0: 0.5, sp1: 2, l0: 0.3, l1: 0.8 });
    RT.shake = Math.min(10, RT.shake + 6);
    sfx('death');
    S.shards += irnd(2, 5);
    flaskGain(3);                                       // a kill refills the belt. tradition.
    logLine('<b>The dummy is destroyed.</b> +' + '<b style="color:#ffe66e">shards</b>. It will be back. It is always back.', 'kill');
    if (Math.random() < 0.65 || !S.stash.length) {
        var it = rollItem();
        if (S.stash.length >= 8) S.stash.shift();
        S.stash.push(it);
        if (it.rarity === 'unique') { ach('unique'); logLine('<b style="color:#af6025">THE BOX DROPS.</b> It has been in the trunk since session one.', 'loot'); }
        else logLine('the dummy drops <b style="color:' + RARITY[it.rarity] + '">' + esc(it.n) + '</b> — check your Character panel.', 'loot');
        lootBeam(d.x, d.y, RARITY[it.rarity]);
    }
    sSave();
    refreshPanels();
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
    tryCast(id, RT.mouse.wx, RT.mouse.wy);
}
function tryCast(id, tx, ty) {
    var sp = SPELLS[id]; if (!sp || !RT || RT.casting) return;
    if (id === 'flamedash') { doDash(); return; }
    if (id === 'glacialray') { startChannel(id, tx, ty); return; }
    if ((RT.cds[id] || 0) > 0) { hudNudge(id); return; }
    if (RT.mana < sp.mana) { logLine('<i>not enough mana.</i> the globe judges you.', 'dim'); hudNudgeMana(); return; }
    var st = stats();
    RT.mana -= sp.mana;
    RT.cds[id] = sp.cd || 0;
    RT.face = Math.atan2(ty - RT.py, tx - RT.px);
    RT.castAny = true; RT.idleT = 0;
    ach('spark');
    var castT = (sp.castT || 0.3) / st.castSpd;
    RT.casting = { id: id, t: castT, max: castT, tx: tx, ty: ty };
    sfx('charge');
}
function finishCast(id, tx, ty) {
    var sp = SPELLS[id];
    if (id === 'emberbolt') castEmberbolt(tx, ty);
    else if (id === 'arc') castArc(tx, ty);
    else if (id === 'meteor') castMeteor(tx, ty);
    else if (id === 'frostnova') castFrostNova();
    else if (id === 'umbralcoil') castUmbral(tx, ty);
    else if (id === 'arcanesurge') castSurge();
    else if (id === 'sigil') castSigil();
    logLine('cast <b style="color:' + ECOL[sp.el] + '">' + esc(sp.n) + '</b>', 'cast');
}
function startChannel(id, tx, ty) {
    var sp = SPELLS[id];
    if (RT.channel) return;
    if (RT.mana < sp.mana) { hudNudgeMana(); return; }
    RT.channel = { id: id, t: 0, stage: 1, tick: 0, drain: sp.mana };
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
        if (RT.casting.t <= 0) { var c = RT.casting; RT.casting = null; finishCast(c.id, c.tx, c.ty); }
    }
    // channel: held Q (or key rebound to glacialray)
    if (RT.channel) {
        var ch = RT.channel, sp = SPELLS[ch.id];
        var held = keyHeldFor(ch.id);
        var drain = sp.mana * (1 + (ch.stage - 1) * 0.5) * dt;
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
    // idle achievement
    RT.idleT += dt;
    if (RT.idleT > 60 && !RT.dummy.dead) ach('patient');
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

/* ─────────────── the spells themselves ─────────────── */
function dummyHitRadius(x, y, r) {
    var d = RT.dummy;
    return !d.dead && Math.hypot(d.x - x, d.y - y) <= r;
}

/* EMBERBOLT — projectile with a flame tail */
function castEmberbolt(tx, ty) {
    var a = Math.atan2(ty - RT.py, tx - RT.px);
    RT.projs.push({ kind: 'ember', x: RT.px + Math.cos(a) * 0.5, y: RT.py + Math.sin(a) * 0.5, z: 26, vx: Math.cos(a) * SPELLS.emberbolt.speed, vy: Math.sin(a) * SPELLS.emberbolt.speed, life: 2.4 });
    sfx('fire');
}
function stepProjs(dt) {
    for (var i = RT.projs.length - 1; i >= 0; i--) {
        var p = RT.projs[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        var out = p.x < -1 || p.x > GRID + 1 || p.y < -1 || p.y > GRID + 1;
        // trail
        if (p.kind === 'ember') {
            spawnPart({ x: p.x, y: p.y, z: p.z + rnd(-2, 2), vx: rnd(-0.3, 0.3), vy: rnd(-0.3, 0.3), vz: rnd(4, 18), life: rnd(0.2, 0.45), size: rnd(1.5, 3), col: '255,140,40', add: 1, grav: 20 });
            if (Math.random() < 0.4) spawnPart({ x: p.x, y: p.y, z: p.z, vx: 0, vy: 0, vz: rnd(6, 14), life: 0.5, size: rnd(1, 2), col: '120,120,130', add: 0, alpha: 0.4, grav: -8 });
        } else if (p.kind === 'umbral') {
            spawnPart({ x: p.x + Math.sin(p.life * 22) * 0.14, y: p.y + Math.cos(p.life * 22) * 0.14, z: p.z, vx: 0, vy: 0, vz: rnd(-4, 6), life: rnd(0.3, 0.6), size: rnd(1.5, 3), col: '150,80,230', add: 1, grav: 0 });
        }
        if (dummyHitRadius(p.x, p.y, 0.55)) {
            if (p.kind === 'ember') {
                var r = spellDmg('emberbolt');
                dealHit(rnd(r.lo, r.hi), 'fire', { st: r.st, spell: 'Emberbolt', spellId: 'emberbolt' });
                burst(p.x, p.y, p.z, 22, { col: '255,140,40', sp0: 0.8, sp1: 3, l0: 0.25, l1: 0.6 });
                burst(p.x, p.y, p.z, 8, { col: '255,220,120', sp0: 0.4, sp1: 1.4, l0: 0.2, l1: 0.4 });
                decal(p.x, p.y, 20, '190,80,20', 3.5);
                RT.shake = Math.min(6, RT.shake + 1.2);
                sfx('hit');
            } else if (p.kind === 'umbral') {
                var r2 = spellDmg('umbralcoil'), st2 = r2.st;
                dealHit(rnd(r2.lo, r2.hi), 'chaos', { st: st2, spell: 'Umbral Coil', spellId: 'umbralcoil' });
                var d = RT.dummy;
                if (!d.dead) {
                    var dot = SPELLS.umbralcoil;
                    var dps = rnd(dot.dot[0], dot.dot[1]) * (1 + (S.lv - 1) * 0.12) * (1 + (st2.m.sd + st2.m.chaos + st2.dotDmg) / 100);
                    d.st.coils.push({ dps: dps, t: dot.dotT, next: 0.5 });
                    while (d.st.coils.length > dot.maxStk) d.st.coils.shift();
                    logLine('an <b style="color:#c06aff">umbral coil</b> latches on (' + d.st.coils.length + '/' + dot.maxStk + ')', 'st');
                }
                burst(p.x, p.y, p.z, 18, { col: '150,80,230', sp0: 0.6, sp1: 2.2, l0: 0.3, l1: 0.7 });
                sfx('void');
            }
            RT.projs.splice(i, 1); continue;
        }
        if (p.life <= 0 || out) RT.projs.splice(i, 1);
    }
}
function drawProjs(cx) {
    for (var i = 0; i < RT.projs.length; i++) {
        var p = RT.projs[i];
        var sx = isoX(p.x, p.y), sy = isoY(p.x, p.y) + TILE_H / 2 - p.z;
        cx.globalCompositeOperation = 'lighter';
        var core = p.kind === 'ember' ? ['255,220,140', '255,120,30'] : ['230,190,255', '140,60,220'];
        var g = cx.createRadialGradient(sx, sy, 1, sx, sy, 9);
        g.addColorStop(0, 'rgba(' + core[0] + ',.95)'); g.addColorStop(0.5, 'rgba(' + core[1] + ',.55)'); g.addColorStop(1, 'rgba(' + core[1] + ',0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(sx, sy, 9, 0, TAU); cx.fill();
        cx.globalCompositeOperation = 'source-over';
    }
}

/* GLACIAL RAY — the channelled beam; beamTick does the damage */
function beamTick(ch) {
    var sp = SPELLS.glacialray, r = spellDmg('glacialray'), st = r.st;
    var stageMul = 1 + (ch.stage - 1) * 0.75;
    // beam endpoint: toward mouse, max 7 tiles
    var a = Math.atan2(RT.mouse.wy - RT.py, RT.mouse.wx - RT.px);
    var ex = RT.px + Math.cos(a) * 7, ey = RT.py + Math.sin(a) * 7;
    RT.beams = [{ x0: RT.px, y0: RT.py, x1: ex, y1: ey, stage: ch.stage, t: 0.14 }];
    // hit test: distance from dummy to the beam segment
    var d = RT.dummy;
    if (!d.dead) {
        var t = clamp(((d.x - RT.px) * (ex - RT.px) + (d.y - RT.py) * (ey - RT.py)) / (49), 0, 1);
        var px2 = RT.px + (ex - RT.px) * t, py2 = RT.py + (ey - RT.py) * t;
        if (Math.hypot(d.x - px2, d.y - py2) < 0.7) {
            dealHit(rnd(r.lo, r.hi) * stageMul, 'cold', { st: st, quiet: true, spellId: 'glacialray', freezeBonus: ch.stage * 4 });
            burst(d.x, d.y, rnd(10, 40), 3, { col: '140,210,255', sp0: 0.3, sp1: 1.4, l0: 0.2, l1: 0.5, grav: 60 });
            if (Math.random() < 0.15) decal(d.x, d.y, 22, '80,150,220', 2.5);
        }
    }
    // frost motes along the beam
    for (var i = 0; i < 2 + ch.stage; i++) {
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

/* ARC — instant jagged lightning with branches */
function castArc(tx, ty) {
    var d = RT.dummy;
    // arc SEEKS: if the dummy is anywhere near the aim line, it takes the hit
    var hit = !d.dead && Math.hypot(d.x - tx, d.y - ty) < 2.6;
    var ex = hit ? d.x : tx, ey = hit ? d.y : ty;
    boltFx(RT.px, RT.py, ex, ey, 2);
    RT.flash = 0.12; RT.shake = Math.min(7, RT.shake + 2.4);
    sfx('zap');
    if (hit) {
        var r = spellDmg('arc');
        dealHit(rnd(r.lo, r.hi), 'light', { st: r.st, spell: 'Arc', spellId: 'arc' });
        burst(ex, ey, 30, 14, { col: '255,240,140', sp0: 1, sp1: 3.4, l0: 0.15, l1: 0.4, grav: 40 });
    } else {
        burst(ex, ey, 4, 10, { col: '255,240,140', sp0: 0.5, sp1: 2, l0: 0.1, l1: 0.3 });
        decal(ex, ey, 14, '200,190,90', 1.2);
    }
}
function boltFx(x0, y0, x1, y1, depth) {
    var pts = [[isoX(x0, y0), isoY(x0, y0) - 22]];
    var seg = 7;
    for (var i = 1; i < seg; i++) {
        var t = i / seg;
        pts.push([
            lerp(isoX(x0, y0), isoX(x1, y1), t) + rnd(-14, 14),
            lerp(isoY(x0, y0) - 22, isoY(x1, y1) - 8, t) + rnd(-10, 10)
        ]);
    }
    pts.push([isoX(x1, y1), isoY(x1, y1) - 8]);
    RT.bolts.push({ pts: pts, t: 0.16, w: 2.6 });
    // branches
    if (depth > 0) for (var b = 0; b < 2; b++) {
        var bi = irnd(2, seg - 2), bp = pts[bi];
        var bpts = [bp];
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
            cx.beginPath();
            b.pts.forEach(function (p, k) { k ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); });
            cx.stroke();
        });
        cx.restore();
    }
}

/* VOIDFALL METEOR — reticle, dread, impact */
function castMeteor(tx, ty) {
    RT.meteors.push({ x: tx, y: ty, t: SPELLS.meteor.delay, max: SPELLS.meteor.delay, fell: false });
    sfx('meteorMark');
}
function stepMeteors(dt) {
    for (var i = RT.meteors.length - 1; i >= 0; i--) {
        var m = RT.meteors[i];
        m.t -= dt;
        if (m.t <= 0 && !m.fell) {
            m.fell = true;
            meteorImpact(m);
            RT.meteors.splice(i, 1);
        }
    }
}
function meteorImpact(m) {
    var sp = SPELLS.meteor, r = spellDmg('meteor');
    var d = RT.dummy;
    var dist = Math.hypot(d.x - m.x, d.y - m.y);
    if (!d.dead && dist <= sp.radius) {
        var falloff = 1 - (dist / sp.radius) * 0.5;
        dealHit(rnd(r.lo, r.hi) * falloff, 'fire', { st: r.st, spell: 'Voidfall Meteor', spellId: 'meteor', forceIgnite: dist < 0.9 });
        if (dist < 0.9) ach('direct');
    }
    // the show
    RT.shake = Math.min(16, RT.shake + 12);
    RT.flash = 0.2; RT.hitstop = 0.06;
    burst(m.x, m.y, 6, 60, { col: '255,120,30', sp0: 1, sp1: 4.5, l0: 0.4, l1: 1.1, vz0: 40, vz1: 220, grav: 220 });
    burst(m.x, m.y, 4, 30, { col: '255,220,120', sp0: 0.6, sp1: 3, l0: 0.3, l1: 0.8 });
    burst(m.x, m.y, 10, 24, { col: '90,80,90', sp0: 0.4, sp1: 2, l0: 0.8, l1: 2, add: 0, alpha: 0.5, grav: 30 });
    ringFx(m.x, m.y, sp.radius, '255,140,50');
    decal(m.x, m.y, 54, '160,60,10', 8);
    sfx('meteor');
    // ember rain
    for (var i = 0; i < 16; i++) {
        (function (k) {
            RT.timers.push(setTimeout(function () {
                if (RT) burst(m.x + rnd(-1.6, 1.6), m.y + rnd(-1.6, 1.6), rnd(20, 80), 2, { col: '255,150,50', sp0: 0.1, sp1: 0.8, l0: 0.3, l1: 0.9 });
            }, k * 60));
        })(i);
    }
}
function ringFx(x, y, r, col) { RT.rings.push({ x: x, y: y, r: 0.2, max: r, col: col, t: 0.5, life: 0.5 }); }
function drawRings(cx, dt) {
    for (var i = RT.rings.length - 1; i >= 0; i--) {
        var g = RT.rings[i]; g.t -= dt;
        if (g.t <= 0) { RT.rings.splice(i, 1); continue; }
        var k = 1 - g.t / g.life;
        var rr = g.max * (0.2 + 0.8 * k);
        var sx = isoX(g.x, g.y), sy = isoY(g.x, g.y) + TILE_H / 2;
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5);
        cx.globalCompositeOperation = 'lighter';
        cx.strokeStyle = 'rgba(' + g.col + ',' + (0.8 * (1 - k)) + ')';
        cx.lineWidth = 4 * (1 - k) + 1;
        cx.beginPath(); cx.arc(0, 0, rr * TILE_W / 2, 0, TAU); cx.stroke();
        cx.restore();
    }
}
function drawMeteorMarks(cx) {
    for (var i = 0; i < RT.meteors.length; i++) {
        var m = RT.meteors[i], k = 1 - m.t / m.max;
        var sx = isoX(m.x, m.y), sy = isoY(m.x, m.y) + TILE_H / 2;
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5);
        cx.strokeStyle = 'rgba(255,90,20,' + (0.35 + k * 0.5) + ')';
        cx.lineWidth = 2;
        var rr = SPELLS.meteor.radius * TILE_W / 2;
        cx.beginPath(); cx.arc(0, 0, rr, 0, TAU); cx.stroke();
        cx.beginPath(); cx.arc(0, 0, rr * (1 - k), 0, TAU); cx.stroke();
        // crosshair
        cx.beginPath(); cx.moveTo(-rr, 0); cx.lineTo(rr, 0); cx.moveTo(0, -rr); cx.lineTo(0, rr);
        cx.strokeStyle = 'rgba(255,90,20,.25)'; cx.stroke();
        cx.restore();
        // the incoming rock (last 30%)
        if (k > 0.7) {
            var fall = (k - 0.7) / 0.3;
            var my = sy - 420 * (1 - fall);
            cx.globalCompositeOperation = 'lighter';
            var gr = cx.createRadialGradient(sx + 60 * (1 - fall), my, 2, sx + 60 * (1 - fall), my, 22);
            gr.addColorStop(0, 'rgba(255,230,160,.95)'); gr.addColorStop(0.5, 'rgba(255,120,30,.7)'); gr.addColorStop(1, 'rgba(255,80,20,0)');
            cx.fillStyle = gr; cx.beginPath(); cx.arc(sx + 60 * (1 - fall), my, 22, 0, TAU); cx.fill();
            cx.globalCompositeOperation = 'source-over';
        }
    }
}

/* FROST NOVA — ring out from the exile */
function castFrostNova() {
    var sp = SPELLS.frostnova, r = spellDmg('frostnova');
    ringFx(RT.px, RT.py, sp.radius, '140,210,255');
    ringFx(RT.px, RT.py, sp.radius * 0.7, '200,240,255');
    burst(RT.px, RT.py, 10, 40, { col: '160,220,255', sp0: 1.4, sp1: 3.6, l0: 0.3, l1: 0.8, grav: 80 });
    decal(RT.px, RT.py, 60, '90,160,230', 5);
    RT.shake = Math.min(8, RT.shake + 3);
    sfx('nova');
    var d = RT.dummy;
    if (!d.dead && Math.hypot(d.x - RT.px, d.y - RT.py) <= sp.radius) {
        var frozen = d.st.freeze > 0;
        var st = r.st;
        var mul = frozen ? 2.5 * (1 + st.shatter / 100) : 1;
        dealHit(rnd(r.lo, r.hi), 'cold', { st: st, spell: 'Frost Nova', spellId: 'frostnova', shatterMul: mul, freezeBonus: 6 });
        if (frozen) {
            ach('shatter');
            d.st.freeze = 0;
            logLine('<b style="color:#bfe6ff">SHATTER!</b> the ice goes everywhere. beautiful.', 'st');
            burst(d.x, d.y, 20, 40, { col: '210,240,255', sp0: 1, sp1: 4, l0: 0.4, l1: 1, grav: 200 });
            RT.hitstop = 0.05;
        }
    }
}

/* UMBRAL COIL — slow homing-ish lance */
function castUmbral(tx, ty) {
    var a = Math.atan2(ty - RT.py, tx - RT.px);
    RT.projs.push({ kind: 'umbral', x: RT.px + Math.cos(a) * 0.5, y: RT.py + Math.sin(a) * 0.5, z: 28, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, life: 3 });
    sfx('void');
}

/* ARCANE SURGE — the self-buff */
function castSurge() {
    RT.buffs.surge = SPELLS.arcanesurge.buffT;
    burst(RT.px, RT.py, 20, 30, { col: '200,230,255', sp0: 0.5, sp1: 2, l0: 0.4, l1: 1, vz0: 30, vz1: 120 });
    ringFx(RT.px, RT.py, 1.6, '200,230,255');
    logLine('<b style="color:#ffe66e">Arcane Surge</b> — the veil hums. +30% cast, +20% damage, 8s.', 'st');
    sfx('surge');
    refreshBuffs();
}

/* SIGIL OF RUIN — the curse */
function castSigil() {
    var d = RT.dummy; if (d.dead) return;
    d.st.sigil = SPELLS.sigil.curseT;
    burst(d.x, d.y, 4, 24, { col: '192,106,255', sp0: 0.4, sp1: 1.8, l0: 0.4, l1: 1 });
    decal(d.x, d.y, 34, '140,60,220', SPELLS.sigil.curseT);
    logLine('the dummy is branded with a <b style="color:#c06aff">Sigil of Ruin</b> (+25% damage taken).', 'st');
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
        else if (kind === 'level') { [440, 554, 659, 880].forEach(function (f, i) { tone('square', f, f, 0.12, 0.035, i * 0.09); }); }
        else if (kind === 'flask') { tone('sine', 500, 800, 0.15, 0.04); }
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
    stepPlayer(dt);
    stepCast(dt);
    stepDummy(dt);
    stepProjs(dt);
    stepMeteors(dt);
    stepParts(dt);
    ambient(dt);
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
    if (RT.shake > 0.2) cx.translate(rnd(-RT.shake, RT.shake) * 0.5, rnd(-RT.shake, RT.shake) * 0.35);
    cx.clearRect(-20, -20, VW + 40, VH + 40);
    cx.drawImage(FLOOR, 0, 0);
    drawDecals(cx, 1 / 60);
    drawMeteorMarks(cx);
    // click-to-move marker
    if (RT.moveTo) {
        var mx = isoX(RT.moveTo.x, RT.moveTo.y), my = isoY(RT.moveTo.x, RT.moveTo.y) + TILE_H / 2;
        cx.save(); cx.translate(mx, my); cx.scale(1, 0.5);
        cx.strokeStyle = 'rgba(159,224,200,.5)'; cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(0, 0, 8 + Math.sin(RT.t * 8) * 2, 0, TAU); cx.stroke();
        cx.restore();
    }
    // entities painter-sorted by world (x+y)
    var ents = [];
    ents.push({ k: (RT.dummy.x + RT.dummy.y), fn: function () { drawDummy(cx, RT.t); } });
    ents.push({ k: (RT.px + RT.py), fn: function () { drawExile(cx, RT.px, RT.py, RT.face, RT.t); } });
    BRAZIERS.forEach(function (b) { ents.push({ k: b[0] + b[1], fn: function () { drawBrazier(cx, b, RT.t); } }); });
    RT.dashTrail.forEach(function (g) { ents.push({ k: g.x + g.y - 0.01, fn: function () { drawExile(cx, g.x, g.y, g.face, RT.t, g.t * 1.4); } }); });
    ents.sort(function (a, b) { return a.k - b.k; });
    ents.forEach(function (e) { e.fn(); });
    drawBeams(cx, 1 / 60);
    drawBolts(cx, 1 / 60);
    drawProjs(cx);
    drawRings(cx, 1 / 60);
    drawParts(cx);
    drawNums(cx, 1 / 60);
    // full-screen flash (arc, meteor)
    if (RT.flash > 0) {
        cx.fillStyle = 'rgba(255,250,230,' + (RT.flash * 0.5) + ')';
        cx.fillRect(-20, -20, VW + 40, VH + 40);
    }
    cx.restore();
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

/* ─────────────── HUD ─────────────── */
function updateHud(dt) {
    var st = stats();
    drawGlobe(RT.root.querySelector('.ar-globe-hp canvas'), RT.life / st.lifeMax, ['#7a1420', '#c22536', '#e8556a'], RT.t);
    drawGlobe(RT.root.querySelector('.ar-globe-mp canvas'), RT.mana / st.manaMax, ['#122a6a', '#2a4fc2', '#5a86e8'], RT.t + 2);
    RT.root.querySelector('.ar-globe-hp .ar-globe-t').textContent = Math.ceil(RT.life) + '/' + st.lifeMax;
    RT.root.querySelector('.ar-globe-mp .ar-globe-t').textContent = Math.ceil(RT.mana) + '/' + st.manaMax;
    // slot cooldown sweeps
    SLOT_KEYS.forEach(function (k) {
        var slot = RT.root.querySelector('.ar-slot[data-slot="' + k + '"]');
        var id = S.binds[k], cdEl = slot.querySelector('.ar-slot-cd');
        if (!id) { cdEl.style.height = '0'; return; }
        var sp = SPELLS[id];
        var frac = 0;
        if (id === 'flamedash') frac = RT.dashCharges > 0 ? 0 : clamp(RT.dashCd / sp.cd, 0, 1);
        else if (sp.cd) frac = clamp((RT.cds[id] || 0) / sp.cd, 0, 1);
        cdEl.style.height = (frac * 100) + '%';
        slot.classList.toggle('nomana', RT.mana < sp.mana);
        slot.classList.toggle('channeling', !!(RT.channel && RT.channel.id === id));
    });
    // boss bar
    var d = RT.dummy, boss = RT.root.querySelector('.ar-boss');
    boss.classList.toggle('dead', !!d.dead);
    boss.querySelector('.ar-boss-bar i').style.width = clamp(d.hp / d.hpm * 100, 0, 100) + '%';
    var em = boss.querySelector('.ar-boss-bar em');   // lagging white ghost bar
    var cur = parseFloat(em.style.width) || 100;
    var want = clamp(d.hp / d.hpm * 100, 0, 100);
    em.style.width = Math.max(want, cur - 26 * (dt || 0.05)) + '%';
    boss.querySelector('.ar-boss-hp').textContent = d.dead ? 'composting…' : fmtN(d.hp) + ' / ' + fmtN(d.hpm);
    var stEl = boss.querySelector('.ar-boss-status');
    var icons = statusIcons();
    var html = icons.map(function (ic2) {
        var extra = ic2[0] === 'ignite' ? '×' + RT.dummy.st.ignite.length : ic2[0] === 'umbral' ? '×' + RT.dummy.st.coils.length : '';
        return '<span class="ar-st" style="border-color:' + ic2[1] + ';color:' + ic2[1] + '" title="' + ic2[0] + '">' + ic2[0] + extra + '</span>';
    }).join('');
    if (stEl._h !== html) { stEl._h = html; stEl.innerHTML = html; }
    // dps
    RT.root.querySelector('.ar-dps-now').textContent = fmtN(dpsNow());
    RT.root.querySelector('.ar-dps-peak').textContent = fmtN(RT.dps.peak);
    RT.root.querySelector('.ar-dps-total').textContent = fmtN(RT.dps.total);
    RT.root.querySelector('.ar-dps-time').textContent = RT.dps.t0 ? (RT.t - RT.dps.t0).toFixed(1) + 's' : '0.0s';
    // flasks
    RT.flasks.forEach(function (f, i) {
        var el = RT.root.querySelector('.ar-flask[data-flask="' + (i + 1) + '"]');
        f.anim = Math.max(0, f.anim - (dt || 0.05));
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
    if (!id) { g.strokeStyle = '#241f30'; g.strokeRect(3.5, 3.5, W2 - 7, W2 - 7); return; }
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
function togglePanel(name) {
    var open = RT.panel === name ? null : name;
    RT.panel = open;
    ['char', 'book', 'tree', 'dummy'].forEach(function (p) {
        RT.root.querySelector('.ar-p-' + p).hidden = open !== p;
    });
    if (open) refreshPanels();
    if (open === 'tree') drawTree();
}
function refreshPanels() {
    if (!RT) return;
    if (RT.panel === 'char') fillChar();
    else if (RT.panel === 'book') fillBook();
    else if (RT.panel === 'dummy') fillDummy();
    else if (RT.panel === 'tree') drawTree();
    refreshXp();
}

/* — character sheet: stats + gear + stash — */
function fillChar() {
    var st = stats(), m = st.m;
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
        });
        tipWire(el2, function () { return itemTip(it); });
    });
}

/* — spellbook: all spells, bind to slots — */
function fillBook() {
    var body = RT.root.querySelector('.ar-p-book .ar-p-body');
    body.innerHTML = '<div class="ar-book-hint">click a spell, then a slot key — or drag your eyes across the tags like a real arpg player.</div>' +
        SPELL_IDS.map(function (id) {
            var sp = SPELLS[id], r = spellDmg(id);
            var bound = SLOT_KEYS.filter(function (k) { return S.binds[k] === id; });
            return '<div class="ar-spell" data-spell="' + id + '">' +
                '<canvas width="46" height="46"></canvas>' +
                '<div class="ar-spell-b"><b style="color:' + ECOL[sp.el] + '">' + esc(sp.n) + '</b>' +
                '<i class="ar-tags">' + sp.tags.join(' · ') + '</i>' +
                '<p>' + esc(sp.d) + '</p>' +
                '<i class="ar-spell-nums">' + (sp.dmg[1] ? 'deals ' + Math.round(r.lo) + '–' + Math.round(r.hi) + (sp.tick ? ' per ' + sp.tick + 's tick' : '') : 'utility') +
                ' · ' + sp.mana + ' mana' + (sp.cd ? ' · ' + sp.cd + 's cd' : '') + '</i></div>' +
                '<div class="ar-bindrow">' + SLOT_KEYS.map(function (k) {
                    return '<button class="ar-bind' + (S.binds[k] === id ? ' on' : '') + '" data-bind="' + k + '" data-of="' + id + '" type="button">' + k + '</button>';
                }).join('') + (bound.length ? '' : '<i class="ar-unbound">unbound</i>') + '</div></div>';
        }).join('');
    body.querySelectorAll('.ar-spell canvas').forEach(function (cv2) {
        paintSpellIcon(cv2, cv2.closest('.ar-spell').getAttribute('data-spell'));
    });
    body.querySelectorAll('[data-bind]').forEach(function (b) {
        b.addEventListener('click', function () {
            var k = b.getAttribute('data-bind'), id = b.getAttribute('data-of');
            S.binds[k] = S.binds[k] === id ? null : id;
            sSave(); paintSlots(); fillBook();
            sfx('alloc');
        });
    });
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
        });
    });
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
    g.fillText('drag to pan · click to allocate · notables are the big diamonds', 10, H2 - 10);
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
            tip.innerHTML = '<b class="' + (p.notable ? 'ar-tt-not' : '') + '">' + esc(p.n) + '</b>' + (mods ? '<span>' + mods + '</span>' : '') +
                (p.d ? '<i>' + esc(p.d) + '</i>' : '') +
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
                logLine('allocates <b style="color:#c896ff">' + esc(p.n) + '</b>.', 'lv');
                sfx('alloc'); sSave(); drawTree(); refreshXp();
                // life/mana maxima may have grown
            } else if (p && S.alloc[p.id] && !p.free) {
                // refund on click of an allocated LEAF (nothing depends on it)
                var isLeaf = !PASSIVES.some(function (q) { return S.alloc[q.id] && (q.req || []).indexOf(p.id) >= 0 && !hasOtherPath(q, p); });
                if (isLeaf) { delete S.alloc[p.id]; S.pts++; sfx('curse'); sSave(); drawTree(); refreshXp(); logLine('refunds <b>' + esc(p.n) + '</b>. the web forgets nothing, but it forgives.', 'dim'); }
            }
        }
        drag = null;
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
        var rr = (p.notable ? 14 : 9);
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
function spellTip(id) {
    var sp = SPELLS[id]; if (!sp) return '';
    var r = spellDmg(id);
    return '<b style="color:' + ECOL[sp.el] + '">' + esc(sp.n) + '</b>' +
        '<i class="ar-tags">' + sp.tags.join(' · ') + '</i><span class="ar-sep"></span>' +
        (sp.dmg[1] ? '<span>Deals <b>' + Math.round(r.lo) + '–' + Math.round(r.hi) + '</b> ' + sp.el + ' damage' + (sp.tick ? ' per ' + sp.tick + 's tick (ramps ×' + sp.ramp + ')' : '') + '</span>' : '<span>Utility</span>') +
        '<span>' + sp.mana + ' mana' + (sp.cd ? ' · ' + sp.cd + 's cooldown' : '') + (sp.charges ? ' · ' + sp.charges + ' charges' : '') + '</span>' +
        '<span class="ar-sep"></span><i class="ar-it-fl">' + esc(sp.d) + '</i>';
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
        tipWire(slot, function () { return spellTip(S.binds[slot.getAttribute('data-slot')]) || '<b>empty slot</b><i>bind a spell in the book (B)</i>'; });
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
