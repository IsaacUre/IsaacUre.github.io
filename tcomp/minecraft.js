/* ═══════════════════════════════════════════════════════════════
   minecraft.js — Minecraft, in a window, for real.
   A first-person WebGL voxel engine rendered at low internal
   resolution and upscaled nearest-neighbor, so the 3D world reads
   as pixel art like the rest of this desktop. Chunked infinite
   terrain from a seed, per-block sky+torch lighting with baked AO,
   the full survival loop (punch tree → craft → mine → smelt →
   build → don't get creeper'd), boxy mobs, hunger, farming, beds,
   TNT, and the game's own sounds and C418 soundtrack, from
   mc-sounds/ beside this file. Every texture is still painted onto
   the atlas at boot.
   Interface (for the launcher app): window.MC = { render(), init(el),
   close() → raw hours, ach() → {n,total,list}, hours() }.
   ═══════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* ── world constants ────────────────────────────────────── */
    var CW = 16, CH = 96;                 // chunk column: 16 × 96 × 16
    var SEA = 40;                          // water table
    var SNOWY = 62;                        // grass wears snow above this
    var VIEW = 4;                          // load radius, in chunks
    var DAY_MS = 7 * 60000, NIGHT_MS = 5 * 60000, CYCLE = DAY_MS + NIGHT_MS;
    var GRAV = 32, JUMP = 8.94, TERMV = 78;
    var WALK = 4.317, SPRINT = 5.612, SNEAK = 1.31, SWIM = 2.2;
    var FLY = 10.89, FLY_SPRINT = 21.78;   // creative flight, at the real game's speeds
    var FLY_VY = 7.5, SPECT_VY = 11;       // Space/Shift climb rate; spectators are quicker
    var SWING_T = 0.3;                     // 6 ticks: the real game's arm-swing duration
    var EQUIP_T = 0.14;                    // how long the hand takes to come back up after a swap
    var FLY_TAP = 350;                     // double-tap window, the game's 7 ticks
    var CREATIVE_DIG_CD = 0.3;             // held-button break period: destroyDelay 5 + the tick it is tested on
    var REACH = 5;
    var PW = 0.6, PH = 1.8, EYE = 1.62;   // player box + eye height
    var FOV = 1.22;                        // base vertical field of view, radians — the game's 70°

    var S = null;      // save state (persisted)
    var RT = null;     // runtime (rebuilt every open)
    var EMPTY_KEYS = {};   // stand-in for RT.keys while a GUI suppresses movement

    function sLoad() {
        try { var s = JSON.parse(localStorage.getItem('comp_mc') || 'null'); if (s && s.seed != null) return s; } catch (e) {}
        return null;
    }
    function sNew() {
        return {
            seed: (Math.random() * 2147483647) | 0,
            px: 8.5, py: 70, pz: 8.5, yaw: 0, pitch: 0,
            spawn: null,                   // [x,y,z] once a bed blesses one
            hp: 20, food: 20, sat: 5, air: 10,
            inv: [], sel: 0,               // 36 slots: 0-8 hotbar
            armor: [null, null, null, null],  // helm, chest, legs, boots
            xpl: 0, xp: 0,                 // level, points into the current level
            weather: 0, wt: 120,           // 0 clear / 1 rain / 2 thunder; seconds until it changes
            t: DAY_MS * 0.25,              // world clock, ms into the cycle (start mid-morning)
            edits: {},                     // 'cx,cz' → { idx: blockId }
            tents: {},                     // 'x,y,z' → furnace/chest tile state
            ents: [],                      // saved mobs + item drops
            ach: {}, achN: 0,
            rbk: [], rb: {},               // recipes known, in the order learned; each recipe book's open and filter settings
            hrs: 0,                        // lifetime raw hours
            snd: 1, mus: 1,               // 0..1 sliders; saves from before them hold true/false and read as 1/0
            deaths: 0,
            gm: 0,                         // 0 survival · 1 creative · 2 adventure · 3 spectator
            fly: false,                    // creative/spectator flight, remembered across a reload
            diff: 2,                       // 0 peaceful · 1 easy · 2 normal · 3 hard
            eff: {},                       // 'speed' → { amp, t } · t in seconds remaining (1e9 = infinite)
            rules: null                    // gamerules; filled from GR_DEF on load
        };
    }
    /* ── gamerules ──────────────────────────────────────────
       The subset this world actually simulates. A rule nobody reads is a lie,
       so every one of these is checked somewhere in the tick. */
    var GR_DEF = {
        doDaylightCycle: true, doWeatherCycle: true, doMobSpawning: true,
        keepInventory: false, mobGriefing: true, doTileDrops: true,
        naturalRegeneration: true, fallDamage: true, doImmediateRespawn: false
    };
    function rule(k) { return S && S.rules && S.rules[k] !== undefined ? S.rules[k] : GR_DEF[k]; }
    /* Bring a save (old, new, or scenario-swapped) up to the shape the console
       expects. Safe to call more than once. */
    function normalizeCmdState() {
        if (S.gm == null) S.gm = 0;
        // only creative and spectator can be airborne, so a stale flag from a
        // gamemode-swapped save must not leave a survival player hovering
        if (!mayFly()) S.fly = false;
        if (S.diff == null) S.diff = 2;
        if (!S.eff || typeof S.eff !== 'object' || S.eff instanceof Array) S.eff = {};
        if (S.off === undefined) S.off = null;   // the off hand, from before it existed
        // the recipe book, from before it existed: learn what the inventory already teaches, without a toast
        if (!Array.isArray(S.rbk)) { S.rbk = []; S.rbQuiet = 1; }
        if (!S.rules || typeof S.rules !== 'object' || S.rules instanceof Array) S.rules = {};
        for (var k in GR_DEF) if (S.rules[k] === undefined) S.rules[k] = GR_DEF[k];
    }
    /* ── the creative abilities ─────────────────────────────
       The real game does not have one "if creative" branch; it has a small
       set of ability flags that the rest of the code reads where it matters.
       Same here, so each rule is enforced at the one place it belongs:
         instaBuild  — stacks never shrink, blocks break in one hit
         mayFly      — Space-Space takes off
         invulnerable— nothing can hurt you
         unseen      — hostile mobs act as though you aren't there */
    function isCreative() { return S.gm === 1; }
    function isSpectator() { return S.gm === 3; }
    function noClip() { return S.gm === 3; }
    function invulnerable() { return S.gm === 1 || S.gm === 3; }
    function instaBuild() { return S.gm === 1; }
    function mayFly() { return S.gm === 1 || S.gm === 3; }
    function unseen() { return S.gm === 1 || S.gm === 3; }
    function setFly(on) {
        RT.fly = !!on && mayFly();
        S.fly = RT.fly;
        if (RT.fly) { RT.vy = 0; RT.fallY = S.py; }
    }
    /* ── status effects ─────────────────────────────────────
       Only the effects whose behaviour this engine can honestly express. */
    var EFFECTS = {
        speed:        { t: 'Speed', c: '#7cafc2' },
        slowness:     { t: 'Slowness', c: '#5a6c81' },
        haste:        { t: 'Haste', c: '#d9c043' },
        mining_fatigue: { t: 'Mining Fatigue', c: '#4a4217' },
        strength:     { t: 'Strength', c: '#932423' },
        instant_health: { t: 'Instant Health', c: '#f82423', instant: 1 },
        instant_damage: { t: 'Instant Damage', c: '#430a09', instant: 1 },
        jump_boost:   { t: 'Jump Boost', c: '#22ff4c' },
        regeneration: { t: 'Regeneration', c: '#cd5cab' },
        resistance:   { t: 'Resistance', c: '#99453a' },
        fire_resistance: { t: 'Fire Resistance', c: '#e49a3a' },
        water_breathing: { t: 'Water Breathing', c: '#2e5299' },
        invisibility: { t: 'Invisibility', c: '#7f8392' },
        night_vision: { t: 'Night Vision', c: '#1f1fa1' },
        weakness:     { t: 'Weakness', c: '#484d48' },
        glowing:      { t: 'Glowing', c: '#94a061' },
        levitation:   { t: 'Levitation', c: '#ceffff' },
        saturation:   { t: 'Saturation', c: '#f82423' },
        health_boost: { t: 'Health Boost', c: '#f87d23' }
    };
    function effLvl(id) {   // 0 when absent, else amplifier+1 (so "Speed II" → 2)
        var e = S && S.eff && S.eff[id];
        return e ? (e.amp || 0) + 1 : 0;
    }

    /* ── seeded noise ───────────────────────────────────────── */
    function mulb(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    // 2D lattice hash → smooth value noise; every terrain question is a pure function of (x,z)
    function hash2(x, z) {
        var h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(S.seed | 0, 2246822519)) | 0;
        h = Math.imul(h ^ h >>> 13, 1274126177);
        return ((h ^ h >>> 16) >>> 0) / 4294967296;
    }
    function hash3(x, y, z) {
        var h = (Math.imul(x, 374761393) + Math.imul(y, 2654435761) + Math.imul(z, 668265263) + Math.imul(S.seed | 0, 2246822519)) | 0;
        h = Math.imul(h ^ h >>> 13, 1274126177);
        return ((h ^ h >>> 16) >>> 0) / 4294967296;
    }
    function fade(t) { return t * t * (3 - 2 * t); }
    function noise2(x, z) {
        var xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
        var a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
        var u = fade(xf), v = fade(zf);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function noise3(x, y, z) {
        var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
        var xf = x - xi, yf = y - yi, zf = z - zi;
        var u = fade(xf), v = fade(yf), w = fade(zf);
        var n000 = hash3(xi, yi, zi), n100 = hash3(xi + 1, yi, zi), n010 = hash3(xi, yi + 1, zi), n110 = hash3(xi + 1, yi + 1, zi);
        var n001 = hash3(xi, yi, zi + 1), n101 = hash3(xi + 1, yi, zi + 1), n011 = hash3(xi, yi + 1, zi + 1), n111 = hash3(xi + 1, yi + 1, zi + 1);
        var x00 = n000 + (n100 - n000) * u, x10 = n010 + (n110 - n010) * u;
        var x01 = n001 + (n101 - n001) * u, x11 = n011 + (n111 - n011) * u;
        var y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
        return y0 + (y1 - y0) * w;
    }
    function fbm2(x, z, oct) {
        var v = 0, amp = 0.5, f = 1, tot = 0;
        for (var i = 0; i < oct; i++) { v += noise2(x * f, z * f) * amp; tot += amp; amp *= 0.5; f *= 2; }
        return v / tot;
    }

    /* ── world types ─────────────────────────────────────────
       The Create New World screen offers four, so all four have to mean
       something. Three of them are this same generator with its inputs bent —
       Large Biomes stretches the noise, AMPLIFIED exaggerates the deviation —
       which is what they are in the real game too. Superflat is the one that
       replaces the terrain function outright. */
    var FLAT_Y = 4;
    function wtFlat() { return !!S && S.wtype === 'Superflat'; }
    function wtScale() { return S && S.wtype === 'Large Biomes' ? 4 : 1; }

    /* ── terrain shape: pure functions of (x,z) ─────────────── */
    // biome: 0 plains, 1 forest, 2 desert, 3 mountains
    function biomeAt(x, z) {
        var s = wtScale();
        x /= s; z /= s;
        var b = noise2(x / 220 + 91, z / 220 - 37);
        var m = noise2(x / 300 - 53, z / 300 + 17);
        if (m > 0.68) return 3;
        if (b < 0.3) return 2;
        if (b < 0.62) return 0;
        return 1;
    }
    function heightAt(x, z) {
        if (wtFlat()) return FLAT_Y;
        var s = wtScale();
        x /= s; z /= s;
        var base = 44 + (fbm2(x / 60, z / 60, 4) - 0.5) * 14;
        var m = noise2(x / 300 - 53, z / 300 + 17);
        if (m > 0.6) base += (m - 0.6) * (m - 0.6) * 480 * fbm2(x / 40 + 7, z / 40 - 3, 3);   // mountains rear up
        var lake = noise2(x / 90 + 41, z / 90 + 83);
        if (lake < 0.22) base -= (0.22 - lake) * 42;                                          // depressions become lakes
        if (S && S.wtype === 'AMPLIFIED') base = 44 + (base - 44) * 2.6;   // "Just for fun! Requires a beefy computer."
        return Math.max(6, Math.min(CH - 8, Math.round(base)));
    }
    function treeAt(x, z) {   // deterministic per column, so chunk borders agree about their neighbors' trees
        if (wtFlat()) return 0;
        var b = biomeAt(x, z);
        if (b === 2) return 0;
        var d = b === 1 ? 0.014 : b === 0 ? 0.0022 : 0.004;
        if (hash2(x * 7 + 13, z * 7 - 5) >= d * 12) return 0;
        var h = heightAt(x, z);
        if (h <= SEA || h > CH - 12) return 0;
        return 4 + Math.floor(hash2(x + 31, z + 71) * 3);   // trunk height 4-6
    }

    /* ── blocks ─────────────────────────────────────────────── */
    var AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, COBBLE = 4, LOG = 5, LEAVES = 6, PLANKS = 7,
        SAND = 8, GRAVEL = 9, ORE_COAL = 10, ORE_IRON = 11, ORE_GOLD = 12, ORE_DIA = 13, BEDROCK = 14,
        WATER = 15, LAVA = 16, TABLE = 17, FURN = 18, FURN_LIT = 19, TORCH = 20, GLASS = 21,
        SNOWGRASS = 22, WOOL = 23, BED = 24, TALLGRASS = 25, DANDELION = 26, POPPY = 27,
        FARMLAND = 28, WHEAT0 = 29, WHEAT1 = 30, WHEAT2 = 31, WHEAT3 = 32, CHEST = 33, TNT = 34,
        // ── expansion blocks ──
        CACTUS = 35, SUGARCANE = 36, PUMPKIN = 37, MELON = 38, PSTEM = 39, MSTEM = 40,
        CARROT0 = 41, CARROT1 = 42, CARROT2 = 43, CARROT3 = 44,
        POTATO0 = 45, POTATO1 = 46, POTATO2 = 47, POTATO3 = 48,
        ORE_RED = 49, ORE_LAPIS = 50, ORE_EMERALD = 51, OBSIDIAN = 52,
        STONEBRICK = 53, SANDSTONE = 54, BRICKS = 55, BOOKSHELF = 56, LADDER = 57,
        RLAMP = 58, CAKE = 59, ETABLE = 60, ANVIL = 61, MUSHROOM = 62, MUSHROOM_R = 63, CLAY = 64;

    // B[id] = { n: item dropped ('' = nothing), hard: MC hardness (-1 unbreakable),
    //           tool: right tool, tier: min pick tier for a drop, solid, opaque,
    //           cross: render as X-plant, lite: emitted light, cull: box but not opaque }
    var B = [];
    B[AIR] = { hard: 0, solid: 0, opaque: 0 };
    B[GRASS] = { n: 'dirt', hard: 0.6, tool: 'shovel', solid: 1, opaque: 1 };
    B[DIRT] = { n: 'dirt', hard: 0.5, tool: 'shovel', solid: 1, opaque: 1 };
    B[STONE] = { n: 'cobble', hard: 1.5, tool: 'pick', tier: 1, solid: 1, opaque: 1 };
    B[COBBLE] = { n: 'cobble', hard: 2, tool: 'pick', tier: 1, solid: 1, opaque: 1 };
    B[LOG] = { n: 'log', hard: 2, tool: 'axe', solid: 1, opaque: 1 };
    B[LEAVES] = { n: '', hard: 0.2, solid: 1, opaque: 0, cull: 1 };
    B[PLANKS] = { n: 'planks', hard: 2, tool: 'axe', solid: 1, opaque: 1 };
    B[SAND] = { n: 'sand', hard: 0.5, tool: 'shovel', solid: 1, opaque: 1 };
    B[GRAVEL] = { n: 'gravel', hard: 0.6, tool: 'shovel', solid: 1, opaque: 1 };
    B[ORE_COAL] = { n: 'coal', hard: 3, tool: 'pick', tier: 1, solid: 1, opaque: 1 };
    B[ORE_IRON] = { n: 'ore_iron', hard: 3, tool: 'pick', tier: 2, solid: 1, opaque: 1 };
    B[ORE_GOLD] = { n: 'ore_gold', hard: 3, tool: 'pick', tier: 3, solid: 1, opaque: 1 };
    B[ORE_DIA] = { n: 'diamond', hard: 3, tool: 'pick', tier: 3, solid: 1, opaque: 1 };
    B[BEDROCK] = { n: '', hard: -1, solid: 1, opaque: 1 };
    B[WATER] = { n: '', hard: -1, solid: 0, opaque: 0 };
    B[LAVA] = { n: '', hard: -1, solid: 0, opaque: 0, lite: 15 };
    B[TABLE] = { n: 'table', hard: 2.5, tool: 'axe', solid: 1, opaque: 1 };
    B[FURN] = { n: 'furnace', hard: 3.5, tool: 'pick', tier: 1, solid: 1, opaque: 1 };
    B[FURN_LIT] = { n: 'furnace', hard: 3.5, tool: 'pick', tier: 1, solid: 1, opaque: 1, lite: 13 };
    B[TORCH] = { n: 'torch', hard: 0, solid: 0, opaque: 0, cross: 1, lite: 14 };
    B[GLASS] = { n: '', hard: 0.3, solid: 1, opaque: 0, cull: 1 };
    B[SNOWGRASS] = { n: 'dirt', hard: 0.6, tool: 'shovel', solid: 1, opaque: 1 };
    B[WOOL] = { n: 'wool', hard: 0.8, solid: 1, opaque: 1 };
    B[BED] = { n: 'bed', hard: 0.2, solid: 1, opaque: 0, cull: 1, half: 1 };
    B[TALLGRASS] = { n: '?seeds', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[DANDELION] = { n: 'dandelion', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[POPPY] = { n: 'poppy', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[FARMLAND] = { n: 'dirt', hard: 0.6, tool: 'shovel', solid: 1, opaque: 1 };
    B[WHEAT0] = { n: 'seeds', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[WHEAT1] = { n: 'seeds', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[WHEAT2] = { n: 'seeds', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[WHEAT3] = { n: 'wheat', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[CHEST] = { n: 'chest', hard: 2.5, tool: 'axe', solid: 1, opaque: 1 };
    B[TNT] = { n: 'tnt', hard: 0, solid: 1, opaque: 1 };
    // xp:[min,max] = orbs on harvest, mul:[min,max] = extra drops (fortune multiplies these)
    B[ORE_COAL].xp = [0, 2];
    B[ORE_DIA].xp = [3, 7];
    B[CACTUS] = { n: 'cactus', hard: 0.4, solid: 1, opaque: 1, hurt: 1 };
    B[SUGARCANE] = { n: 'sugarcane', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[PUMPKIN] = { n: 'pumpkin', hard: 1, tool: 'axe', solid: 1, opaque: 1 };
    B[MELON] = { n: '?melon', hard: 1, tool: 'axe', solid: 1, opaque: 1 };
    B[PSTEM] = { n: 'seeds_pumpkin', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[MSTEM] = { n: 'seeds_melon', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[CARROT0] = { n: 'carrot', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[CARROT1] = { n: 'carrot', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[CARROT2] = { n: 'carrot', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[CARROT3] = { n: 'carrot', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[POTATO0] = { n: 'potato', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[POTATO1] = { n: 'potato', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[POTATO2] = { n: 'potato', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[POTATO3] = { n: 'potato', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[ORE_RED] = { n: 'redstone', hard: 3, tool: 'pick', tier: 3, solid: 1, opaque: 1, xp: [1, 5], mul: [4, 5] };
    B[ORE_LAPIS] = { n: 'lapis', hard: 3, tool: 'pick', tier: 2, solid: 1, opaque: 1, xp: [2, 5], mul: [4, 8] };
    B[ORE_EMERALD] = { n: 'emerald', hard: 3, tool: 'pick', tier: 3, solid: 1, opaque: 1, xp: [3, 7] };
    B[OBSIDIAN] = { n: 'obsidian', hard: 50, tool: 'pick', tier: 5, solid: 1, opaque: 1, lite: 0 };
    B[STONEBRICK] = { n: 'stonebrick', hard: 1.5, tool: 'pick', tier: 1, solid: 1, opaque: 1 };
    B[SANDSTONE] = { n: 'sandstone', hard: 0.8, tool: 'pick', tier: 1, solid: 1, opaque: 1 };
    B[BRICKS] = { n: 'bricks', hard: 2, tool: 'pick', tier: 1, solid: 1, opaque: 1 };
    B[BOOKSHELF] = { n: '?books', hard: 1.5, tool: 'axe', solid: 1, opaque: 1 };
    B[LADDER] = { n: 'ladder', hard: 0.4, solid: 0, opaque: 0, cross: 1, climb: 1 };
    B[RLAMP] = { n: 'rlamp', hard: 0.3, solid: 1, opaque: 1, lite: 15 };
    B[CAKE] = { n: '', hard: 0.5, solid: 1, opaque: 0, cull: 1, half: 1, cake: 1 };
    B[ETABLE] = { n: 'etable', hard: 5, tool: 'pick', tier: 1, solid: 1, opaque: 1 };
    B[ANVIL] = { n: 'anvil', hard: 5, tool: 'pick', tier: 1, solid: 1, opaque: 1 };
    B[MUSHROOM] = { n: 'mushroom', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[MUSHROOM_R] = { n: 'mushroom_r', hard: 0, solid: 0, opaque: 0, cross: 1 };
    B[CLAY] = { n: '?clay', hard: 0.6, tool: 'shovel', solid: 1, opaque: 1 };

    /* ── items ──────────────────────────────────────────────── */
    // I[id] = { t: label, tile, place: block id, tool: {k, tier, mult, dmg, dur},
    //           food: {f, sat}, fuel: smelt-seconds, stk: stack size }
    var TIER_N = ['', 'wood', 'stone', 'iron', 'gold', 'diamond'];
    var TIER_MULT = [1, 2, 4, 6, 12, 8];
    var TIER_DUR = [0, 59, 131, 250, 32, 1561];
    var I = {
        dirt: { t: 'Dirt', place: DIRT }, cobble: { t: 'Cobblestone', place: COBBLE },
        stone: { t: 'Stone', place: STONE }, log: { t: 'Oak Log', place: LOG, fuel: 15 },
        planks: { t: 'Oak Planks', place: PLANKS, fuel: 15 }, sand: { t: 'Sand', place: SAND },
        gravel: { t: 'Gravel', place: GRAVEL }, glass: { t: 'Glass', place: GLASS },
        wool: { t: 'Wool', place: WOOL }, tnt: { t: 'TNT', place: TNT },
        table: { t: 'Crafting Table', place: TABLE, fuel: 15 },
        furnace: { t: 'Furnace', place: FURN }, chest: { t: 'Chest', place: CHEST, fuel: 15 },
        torch: { t: 'Torch', place: TORCH }, bed: { t: 'Bed', place: BED, stk: 1 },
        ore_iron: { t: 'Iron Ore', place: ORE_IRON }, ore_gold: { t: 'Gold Ore', place: ORE_GOLD },
        stick: { t: 'Stick', fuel: 5 }, coal: { t: 'Coal', fuel: 80 }, charcoal: { t: 'Charcoal', fuel: 80 },
        iron: { t: 'Iron Ingot' }, gold: { t: 'Gold Ingot' }, diamond: { t: 'Diamond' },
        flint: { t: 'Flint' }, feather: { t: 'Feather' }, leather: { t: 'Leather' },
        string: { t: 'String' }, gunpowder: { t: 'Gunpowder' }, bone: { t: 'Bone' },
        bonemeal: { t: 'Bone Meal' }, arrow: { t: 'Arrow' },
        seeds: { t: 'Wheat Seeds', place: WHEAT0, crop: 1 }, wheat: { t: 'Wheat' },
        dandelion: { t: 'Dandelion', place: DANDELION }, poppy: { t: 'Poppy', place: POPPY },
        bread: { t: 'Bread', food: { f: 5, sat: 6 } }, apple: { t: 'Apple', food: { f: 4, sat: 2.4 } },
        pork_raw: { t: 'Raw Porkchop', food: { f: 3, sat: 1.8 }, cook: 'pork' },
        pork: { t: 'Cooked Porkchop', food: { f: 8, sat: 12.8 } },
        beef_raw: { t: 'Raw Beef', food: { f: 3, sat: 1.8 }, cook: 'beef' },
        beef: { t: 'Steak', food: { f: 8, sat: 12.8 } },
        mutton_raw: { t: 'Raw Mutton', food: { f: 2, sat: 1.2 }, cook: 'mutton' },
        mutton: { t: 'Cooked Mutton', food: { f: 6, sat: 9.6 } },
        chicken_raw: { t: 'Raw Chicken', food: { f: 2, sat: 1.2 }, cook: 'chicken' },
        chicken: { t: 'Cooked Chicken', food: { f: 6, sat: 7.2 } },
        flesh: { t: 'Rotten Flesh', food: { f: 4, sat: 0.8 } },
        bow: { t: 'Bow', stk: 1, dur: 384 },
        // ── expansion: ores & materials ──
        redstone: { t: 'Redstone Dust' }, lapis: { t: 'Lapis Lazuli' }, emerald: { t: 'Emerald' },
        obsidian: { t: 'Obsidian', place: OBSIDIAN }, ender_pearl: { t: 'Ender Pearl', stk: 16 },
        slimeball: { t: 'Slimeball' }, ink_sac: { t: 'Ink Sac' }, egg: { t: 'Egg', stk: 16 },
        paper: { t: 'Paper' }, book: { t: 'Book' }, sugar: { t: 'Sugar' },
        bucket: { t: 'Bucket', stk: 16 }, water_bucket: { t: 'Water Bucket', stk: 1 },
        lava_bucket: { t: 'Lava Bucket', stk: 1 }, milk_bucket: { t: 'Milk', stk: 1 },
        flint_steel: { t: 'Flint and Steel', stk: 1, dur: 64 },
        ench_book: { t: 'Enchanted Book', stk: 1, glint: 1 },
        // ── expansion: placeable blocks ──
        cactus: { t: 'Cactus', place: CACTUS }, sugarcane: { t: 'Sugar Cane', place: SUGARCANE },
        pumpkin: { t: 'Pumpkin', place: PUMPKIN }, melon: { t: 'Melon', place: MELON },
        seeds_pumpkin: { t: 'Pumpkin Seeds', place: PSTEM, crop: 1 },
        seeds_melon: { t: 'Melon Seeds', place: MSTEM, crop: 1 },
        stonebrick: { t: 'Stone Bricks', place: STONEBRICK }, sandstone: { t: 'Sandstone', place: SANDSTONE },
        bricks: { t: 'Bricks', place: BRICKS }, bookshelf: { t: 'Bookshelf', place: BOOKSHELF, fuel: 15 },
        ladder: { t: 'Ladder', place: LADDER, fuel: 15 }, rlamp: { t: 'Redstone Lamp', place: RLAMP },
        etable: { t: 'Enchanting Table', place: ETABLE }, anvil: { t: 'Anvil', place: ANVIL, stk: 1 },
        cake: { t: 'Cake', place: CAKE, stk: 1 },
        mushroom: { t: 'Mushroom', place: MUSHROOM }, mushroom_r: { t: 'Red Mushroom', place: MUSHROOM_R },
        // ── expansion: foods ──
        carrot: { t: 'Carrot', place: CARROT0, crop: 1, food: { f: 3, sat: 3.6 } },
        potato: { t: 'Potato', place: POTATO0, crop: 1, food: { f: 1, sat: 0.6 }, cook: 'baked_potato' },
        baked_potato: { t: 'Baked Potato', food: { f: 5, sat: 6 } },
        golden_carrot: { t: 'Golden Carrot', food: { f: 6, sat: 14.4 } },
        golden_apple: { t: 'Golden Apple', food: { f: 4, sat: 9.6 }, heal: 4, glint: 1 },
        cookie: { t: 'Cookie', food: { f: 2, sat: 0.4 } },
        melon_slice: { t: 'Melon Slice', food: { f: 2, sat: 1.2 } },
        pumpkin_pie: { t: 'Pumpkin Pie', food: { f: 8, sat: 4.8 }, stk: 1 },
        mushroom_stew: { t: 'Mushroom Stew', food: { f: 6, sat: 7.2 }, stk: 1, bowl: 1 },
        bowl: { t: 'Bowl' }, clay_ball: { t: 'Clay Ball' }, brick: { t: 'Brick' }
    };
    // ── armor: 4 tiers × 4 slots ──
    var ARM_SLOT = { helm: 0, chest: 1, legs: 2, boots: 3 };
    var ARM_NAME = { helm: 'Helmet', chest: 'Chestplate', legs: 'Leggings', boots: 'Boots' };
    var ARM_TIERS = ['leather', 'iron', 'gold', 'diamond'];
    // defense points [helm,chest,legs,boots] per tier, then durability base, then toughness
    var ARM_DEF = { leather: [1, 3, 2, 1], iron: [2, 6, 5, 2], gold: [2, 5, 3, 1], diamond: [3, 8, 6, 3] };
    var ARM_DUR = { leather: 60, iron: 240, gold: 112, diamond: 528 };
    var ARM_TOUGH = { leather: 0, iron: 0, gold: 0, diamond: 2 };
    (function () {
        for (var ti = 0; ti < ARM_TIERS.length; ti++) {
            var tn = ARM_TIERS[ti], cap = tn.charAt(0).toUpperCase() + tn.slice(1);
            for (var sk in ARM_SLOT) {
                I[tn + '_' + sk] = {
                    t: cap + ' ' + ARM_NAME[sk], stk: 1,
                    armor: { slot: ARM_SLOT[sk], kind: sk, tier: tn, def: ARM_DEF[tn][ARM_SLOT[sk]], tough: ARM_TOUGH[tn], dur: Math.round(ARM_DUR[tn] * [0.6875, 1, 0.9375, 0.8125][ARM_SLOT[sk]]) }
                };
            }
        }
    })();
    /* the game's own numbers for the tool classes, per tier (wood, stone, iron,
       gold, diamond): what a hit does and how many full-strength hits a second */
    var TOOL_DMG = { pick: [0, 2, 3, 4, 2, 5], axe: [0, 7, 9, 9, 7, 9], shovel: [0, 2.5, 3.5, 4.5, 2.5, 5.5], hoe: [0, 1, 1, 1, 1, 1] };
    var TOOL_SPD = { sword: [0, 1.6, 1.6, 1.6, 1.6, 1.6], pick: [0, 1.2, 1.2, 1.2, 1.2, 1.2], shovel: [0, 1, 1, 1, 1, 1],
                     axe: [0, 0.8, 0.8, 0.9, 1, 1], hoe: [0, 1, 2, 3, 1, 4] };
    function attackSpeed(id) {
        var t = id && I[id] && I[id].tool;
        return t && TOOL_SPD[t.k] ? TOOL_SPD[t.k][t.tier] || 4 : 4;
    }
    function attackCooldown(id) { return 1 / attackSpeed(id); }   // seconds to a full-strength swing: 20 / speed ticks
    var SWORD_DMG = [0, 4, 5, 6, 4, 7];
    (function () {   // 5 tools × 5 tiers, generated
        var kinds = { pick: 'Pickaxe', axe: 'Axe', shovel: 'Shovel', sword: 'Sword', hoe: 'Hoe' };
        for (var tier = 1; tier <= 5; tier++) for (var k in kinds) {
            var cap = TIER_N[tier].charAt(0).toUpperCase() + TIER_N[tier].slice(1);
            I[TIER_N[tier] + '_' + k] = {
                t: cap + (tier === 4 ? 'en' : '') + ' ' + kinds[k], stk: 1,
                tool: { k: k, tier: tier, mult: TIER_MULT[tier], dmg: k === 'sword' ? SWORD_DMG[tier] : TOOL_DMG[k][tier], dur: TIER_DUR[tier] },
                fuel: tier === 1 ? 10 : 0
            };
        }
    })();
    /* ── blocks the world grows but survival could never hold ──
       Grass, leaves, the ores and bedrock had no item that places them, so a
       creative list built from I{} would have been missing half the world.
       Giving them one also fixes Silk Touch, whose whole job is to hand back
       the block itself: grass stays grass, coal ore stays coal ore. */
    I.grass_block = { t: 'Grass Block', place: GRASS };
    I.grass_snow = { t: 'Snowy Grass Block', place: SNOWGRASS };
    I.leaves = { t: 'Oak Leaves', place: LEAVES };
    I.tallgrass = { t: 'Grass', place: TALLGRASS };
    I.ore_coal = { t: 'Coal Ore', place: ORE_COAL };
    I.ore_diamond = { t: 'Diamond Ore', place: ORE_DIA };
    I.ore_redstone = { t: 'Redstone Ore', place: ORE_RED };
    I.ore_lapis = { t: 'Lapis Lazuli Ore', place: ORE_LAPIS };
    I.ore_emerald = { t: 'Emerald Ore', place: ORE_EMERALD };
    I.clay = { t: 'Clay', place: CLAY };
    I.bedrock = { t: 'Bedrock', place: BEDROCK };
    /* ── spawn eggs ─────────────────────────────────────────
       One per mob, right-click to summon. The colours are the real game's.
       They are painted procedurally in iconURL rather than burning eleven
       slots of an atlas that is already sixteen tiles wide. */
    var EGG_COL = {
        pig: ['#f0a5a2', '#db635f'], cow: ['#443626', '#a1a1a1'], sheep: ['#e7e7e7', '#ffb5b5'],
        chicken: ['#a1a1a1', '#ff0000'], squid: ['#223b4d', '#708899'],
        zombie: ['#00afaf', '#799c65'], skeleton: ['#c1c1c1', '#494949'], creeper: ['#0da70b', '#000000'],
        spider: ['#342d27', '#a80e0e'], enderman: ['#161616', '#000000'], slime: ['#51a03e', '#7ebf6e']
    };
    (function () {
        for (var mk in EGG_COL) I['egg_' + mk] = { t: mk.charAt(0).toUpperCase() + mk.slice(1) + ' Spawn Egg', egg: mk };
    })();
    function stkMax(id) { return I[id] && I[id].stk || 64; }
    function ench(st, id) { return (st && st.ench && st.ench[id]) || 0; }   // enchant level on a stack, 0 if none
    var PLACE2ITEM = {};   // block id → item that places it (for silk touch / self-drops); filled at texInit

    /* ── recipes ────────────────────────────────────────────── */
    // shaped patterns: rows of item ids ('' = empty); matched at any offset, mirrors included where marked
    var RECIPES = [
        { out: 'planks', n: 4, less: ['log'] },
        { out: 'stick', n: 4, shape: [['planks'], ['planks']] },
        { out: 'table', n: 1, shape: [['planks', 'planks'], ['planks', 'planks']] },
        { out: 'furnace', n: 1, shape: [['cobble', 'cobble', 'cobble'], ['cobble', '', 'cobble'], ['cobble', 'cobble', 'cobble']] },
        { out: 'chest', n: 1, shape: [['planks', 'planks', 'planks'], ['planks', '', 'planks'], ['planks', 'planks', 'planks']] },
        { out: 'torch', n: 4, shape: [['coal'], ['stick']] },
        { out: 'torch', n: 4, shape: [['charcoal'], ['stick']] },
        { out: 'bed', n: 1, shape: [['wool', 'wool', 'wool'], ['planks', 'planks', 'planks']] },
        { out: 'bread', n: 1, shape: [['wheat', 'wheat', 'wheat']] },
        { out: 'wool', n: 1, shape: [['string', 'string'], ['string', 'string']] },
        { out: 'bonemeal', n: 3, less: ['bone'] },
        { out: 'arrow', n: 4, shape: [['flint'], ['stick'], ['feather']] },
        { out: 'bow', n: 1, mirror: 1, shape: [['', 'stick', 'string'], ['stick', '', 'string'], ['', 'stick', 'string']] },
        { out: 'tnt', n: 1, shape: [['gunpowder', 'sand', 'gunpowder'], ['sand', 'gunpowder', 'sand'], ['gunpowder', 'sand', 'gunpowder']] },
        // ── expansion recipes ──
        { out: 'stonebrick', n: 4, shape: [['stone', 'stone'], ['stone', 'stone']] },
        { out: 'sandstone', n: 1, shape: [['sand', 'sand'], ['sand', 'sand']] },
        { out: 'bricks', n: 1, shape: [['brick', 'brick'], ['brick', 'brick']] },
        { out: 'paper', n: 3, shape: [['sugarcane', 'sugarcane', 'sugarcane']] },
        { out: 'sugar', n: 1, less: ['sugarcane'] },
        { out: 'book', n: 1, less: ['paper', 'paper', 'paper', 'leather'] },
        { out: 'bookshelf', n: 1, shape: [['planks', 'planks', 'planks'], ['book', 'book', 'book'], ['planks', 'planks', 'planks']] },
        { out: 'bowl', n: 4, shape: [['planks', '', 'planks'], ['', 'planks', '']] },
        { out: 'ladder', n: 3, shape: [['stick', '', 'stick'], ['stick', 'stick', 'stick'], ['stick', '', 'stick']] },
        { out: 'flint_steel', n: 1, less: ['iron', 'flint'] },
        { out: 'bucket', n: 1, shape: [['iron', '', 'iron'], ['', 'iron', '']] },
        { out: 'rlamp', n: 1, shape: [['', 'redstone', ''], ['redstone', 'glass', 'redstone'], ['', 'redstone', '']] },
        { out: 'etable', n: 1, shape: [['', 'book', ''], ['diamond', 'obsidian', 'diamond'], ['obsidian', 'obsidian', 'obsidian']] },
        { out: 'anvil', n: 1, shape: [['iron', 'iron', 'iron'], ['', 'iron', ''], ['iron', 'iron', 'iron']] },
        { out: 'melon', n: 1, shape: [['melon_slice', 'melon_slice', 'melon_slice'], ['melon_slice', 'melon_slice', 'melon_slice'], ['melon_slice', 'melon_slice', 'melon_slice']] },
        { out: 'seeds_melon', n: 1, less: ['melon_slice'] },
        { out: 'seeds_pumpkin', n: 4, less: ['pumpkin'] },
        { out: 'cookie', n: 8, shape: [['wheat', 'sugar', 'wheat']] },
        { out: 'pumpkin_pie', n: 1, less: ['pumpkin', 'sugar', 'egg'] },
        { out: 'mushroom_stew', n: 1, less: ['bowl', 'mushroom', 'mushroom_r'] },
        { out: 'golden_carrot', n: 1, shape: [['', 'gold', ''], ['gold', 'carrot', 'gold'], ['', 'gold', '']] },
        { out: 'golden_apple', n: 1, shape: [['gold', 'gold', 'gold'], ['gold', 'apple', 'gold'], ['gold', 'gold', 'gold']] },
        { out: 'cake', n: 1, shape: [['milk_bucket', 'milk_bucket', 'milk_bucket'], ['sugar', 'egg', 'sugar'], ['wheat', 'wheat', 'wheat']] }
    ];
    (function () {   // armor recipes per tier
        var mats = { leather: 'leather', iron: 'iron', gold: 'gold', diamond: 'diamond' };
        for (var tn in mats) {
            var m = mats[tn], p = tn + '_';
            RECIPES.push({ out: p + 'helm', n: 1, shape: [[m, m, m], [m, '', m]] });
            RECIPES.push({ out: p + 'chest', n: 1, shape: [[m, '', m], [m, m, m], [m, m, m]] });
            RECIPES.push({ out: p + 'legs', n: 1, shape: [[m, m, m], [m, '', m], [m, '', m]] });
            RECIPES.push({ out: p + 'boots', n: 1, shape: [[m, '', m], [m, '', m]] });
        }
    })();
    (function () {   // tool recipes per tier
        var mats = ['', 'planks', 'cobble', 'iron', 'gold', 'diamond'];
        for (var t = 1; t <= 5; t++) {
            var m = mats[t], p = TIER_N[t] + '_';
            RECIPES.push({ out: p + 'pick', n: 1, shape: [[m, m, m], ['', 'stick', ''], ['', 'stick', '']] });
            RECIPES.push({ out: p + 'axe', n: 1, mirror: 1, shape: [[m, m], [m, 'stick'], ['', 'stick']] });
            RECIPES.push({ out: p + 'shovel', n: 1, shape: [[m], ['stick'], ['stick']] });
            RECIPES.push({ out: p + 'sword', n: 1, shape: [[m], [m], ['stick']] });
            RECIPES.push({ out: p + 'hoe', n: 1, mirror: 1, shape: [[m, m], ['', 'stick'], ['', 'stick']] });
        }
    })();
    var SMELTS = { ore_iron: 'iron', ore_gold: 'gold', sand: 'glass', log: 'charcoal', cobble: 'stone',
                   pork_raw: 'pork', beef_raw: 'beef', mutton_raw: 'mutton', chicken_raw: 'chicken',
                   clay_ball: 'brick', potato: 'baked_potato' };
    var SMELT_S = 10;   // seconds per item

    /* ── the atlas: every texture painted at boot ───────────── */
    var ATLAS = null, actx = null, TILE = {}, tileN = 0, TX = 0, TY = 0, trnd = null;
    function tpx(x, y, c) { actx.fillStyle = c; actx.fillRect(TX + x, TY + y, 1, 1); }
    function trect(x, y, w, h, c) { actx.fillStyle = c; actx.fillRect(TX + x, TY + y, w, h); }
    function tclear(x, y, w, h) { actx.clearRect(TX + x, TY + y, w, h); }
    function sprinkle(colors, n) {
        for (var i = 0; i < n; i++) tpx((trnd() * 16) | 0, (trnd() * 16) | 0, colors[(trnd() * colors.length) | 0]);
    }
    function tile(name, fn) {
        var idx = tileN++;
        TX = (idx % 16) * 16; TY = ((idx / 16) | 0) * 16;
        var h = 0; for (var i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) | 0;
        trnd = mulb(h ^ 0x5DEECE6D);   // per-tile fixed seed: textures identical in every world
        fn();
        TILE[name] = idx;
        return idx;
    }
    function grainTile(name, base, specks, n) {
        return tile(name, function () { trect(0, 0, 16, 16, base); sprinkle(specks, n || 70); });
    }
    function oreTile(name, c1, c2) {
        return tile(name, function () {
            trect(0, 0, 16, 16, '#7a7a7a'); sprinkle(['#6f6f6f', '#858585', '#767676'], 70);
            for (var i = 0; i < 6; i++) {
                var x = 1 + (trnd() * 12) | 0, y = 1 + (trnd() * 12) | 0;
                trect(x, y, 2, 2, c1); tpx(x + (trnd() < 0.5 ? -1 : 2), y + (trnd() * 2 | 0), c2);
            }
        });
    }
    function buildAtlas() {
        ATLAS = document.createElement('canvas'); ATLAS.width = ATLAS.height = 256;
        actx = ATLAS.getContext('2d'); tileN = 0; TILE = {};

        grainTile('grass_top', '#5d9e3a', ['#4f8c31', '#6cb043', '#559636', '#7ec850'], 90);
        tile('grass_side', function () {
            trect(0, 0, 16, 16, '#79553a'); sprinkle(['#6b4a32', '#8a6142', '#75503a'], 60);
            trect(0, 0, 16, 3, '#5d9e3a'); sprinkle(['#4f8c31', '#6cb043'], 12);
            for (var x = 0; x < 16; x++) if (trnd() < 0.5) tpx(x, 3, '#4f8c31');   // fringe
        });
        grainTile('dirt', '#79553a', ['#6b4a32', '#8a6142', '#75503a', '#5f4029'], 80);
        grainTile('stone', '#7a7a7a', ['#6f6f6f', '#858585', '#767676', '#8d8d8d'], 80);
        tile('cobble', function () {
            trect(0, 0, 16, 16, '#585858');
            var st = [[0, 0, 5, 5], [6, 0, 6, 4], [13, 0, 3, 5], [0, 6, 4, 5], [5, 5, 6, 6], [12, 6, 4, 5], [0, 12, 6, 4], [7, 12, 5, 4], [13, 12, 3, 4]];
            for (var i = 0; i < st.length; i++) {
                trect(st[i][0], st[i][1], st[i][2], st[i][3], trnd() < 0.5 ? '#7d7d7d' : '#727272');
                tpx(st[i][0], st[i][1], '#8f8f8f');
            }
            sprinkle(['#6a6a6a', '#828282'], 30);
        });
        tile('planks', function () {
            trect(0, 0, 16, 16, '#a8834f');
            for (var y = 0; y < 16; y += 4) {
                trect(0, y + 3, 16, 1, '#6e5230');
                for (var x = 0; x < 16; x++) if (trnd() < 0.35) tpx(x, y + (trnd() * 3 | 0), trnd() < 0.5 ? '#9a7847' : '#b48d58');
            }
            trect(7, 0, 1, 4, '#6e5230'); trect(3, 8, 1, 4, '#6e5230'); trect(11, 4, 1, 4, '#6e5230');
        });
        tile('log_side', function () {
            trect(0, 0, 16, 16, '#6b502f');
            for (var x = 0; x < 16; x++) {
                var c = x % 4 === 0 ? '#4e3a20' : x % 4 === 2 ? '#7a5c38' : '#6b502f';
                trect(x, 0, 1, 16, c);
                if (trnd() < 0.4) tpx(x, (trnd() * 16) | 0, '#5a4326');
            }
        });
        tile('log_top', function () {
            trect(0, 0, 16, 16, '#6b502f');
            trect(2, 2, 12, 12, '#b08d55'); trect(4, 4, 8, 8, '#8f7040'); trect(6, 6, 4, 4, '#b08d55'); trect(7, 7, 2, 2, '#6b502f');
        });
        tile('leaves', function () {
            trect(0, 0, 16, 16, '#3e7a25');
            sprinkle(['#356b1e', '#4a8f2d', '#2f6019', '#57a338'], 120);
            for (var i = 0; i < 16; i++) tclear((trnd() * 16) | 0, (trnd() * 16) | 0, 1, 1);   // cutout holes
        });
        grainTile('sand', '#dbcf9c', ['#cfc28d', '#e6dcae', '#d5c795', '#c8ba85'], 80);
        tile('gravel', function () {
            trect(0, 0, 16, 16, '#8b8378');
            for (var i = 0; i < 26; i++) {
                var x = (trnd() * 14) | 0, y = (trnd() * 14) | 0;
                trect(x, y, 2, 2, ['#7a7268', '#9c948a', '#6d665c', '#a8a096'][(trnd() * 4) | 0]);
            }
        });
        tile('bedrock', function () {
            trect(0, 0, 16, 16, '#404040');
            for (var i = 0; i < 14; i++) trect((trnd() * 13) | 0, (trnd() * 13) | 0, 1 + (trnd() * 3 | 0), 1 + (trnd() * 3 | 0), trnd() < 0.5 ? '#242424' : '#5c5c5c');
        });
        grainTile('water', '#3355dd', ['#2e4ecf', '#3d61ea', '#2a48c4'], 50);
        tile('lava', function () {
            trect(0, 0, 16, 16, '#cf4a0e');
            for (var i = 0; i < 12; i++) {
                var x = (trnd() * 13) | 0, y = (trnd() * 13) | 0;
                trect(x, y, 2 + (trnd() * 2 | 0), 2, trnd() < 0.5 ? '#f5a324' : '#e6721a');
            }
            sprinkle(['#ffd75e', '#a83408'], 26);
        });
        tile('glass', function () {
            trect(0, 0, 16, 1, '#dff3f5'); trect(0, 15, 16, 1, '#dff3f5'); trect(0, 0, 1, 16, '#dff3f5'); trect(15, 0, 1, 16, '#dff3f5');
            tpx(3, 2, '#ffffff'); tpx(2, 3, '#ffffff'); tpx(4, 3, '#cfe9ec'); tpx(3, 4, '#cfe9ec');
        });
        grainTile('snow_top', '#eef4f8', ['#e2eaf0', '#f8fbfe', '#dae4ec'], 50);
        tile('snow_side', function () {
            trect(0, 0, 16, 16, '#79553a'); sprinkle(['#6b4a32', '#8a6142'], 50);
            trect(0, 0, 16, 4, '#eef4f8'); sprinkle(['#e2eaf0', '#f8fbfe'], 8);
            for (var x = 0; x < 16; x++) if (trnd() < 0.4) tpx(x, 4, '#eef4f8');
        });
        oreTile('ore_coal', '#2c2c2c', '#1c1c1c');
        oreTile('ore_iron', '#d8af93', '#b98a68');
        oreTile('ore_gold', '#fcee4b', '#d9b625');
        oreTile('ore_dia', '#63e0e0', '#3bb8c9');
        tile('table_top', function () {
            trect(0, 0, 16, 16, '#a8834f'); sprinkle(['#9a7847', '#b48d58'], 30);
            trect(0, 0, 16, 1, '#6e5230'); trect(0, 15, 16, 1, '#6e5230'); trect(0, 0, 1, 16, '#6e5230'); trect(15, 0, 1, 16, '#6e5230');
            trect(7, 1, 2, 14, '#8a6a3e'); trect(1, 7, 14, 2, '#8a6a3e');
        });
        tile('table_side', function () {
            trect(0, 0, 16, 16, '#a8834f'); sprinkle(['#9a7847', '#b48d58'], 30);
            trect(0, 0, 16, 2, '#6e5230');
            trect(2, 4, 3, 5, '#7d7d7d'); trect(3, 9, 1, 3, '#6e5230');    // a saw...
            trect(10, 4, 4, 4, '#c9c9c9'); trect(11, 8, 2, 4, '#6e5230');  // ...and a hammer, roughly
        });
        tile('furn_side', function () {
            trect(0, 0, 16, 16, '#6c6c6c');
            trect(0, 0, 16, 1, '#4c4c4c'); trect(0, 15, 16, 1, '#4c4c4c');
            sprinkle(['#606060', '#787878', '#555555'], 60);
        });
        tile('furn_front', function () {
            trect(0, 0, 16, 16, '#6c6c6c'); sprinkle(['#606060', '#787878'], 40);
            trect(4, 8, 8, 6, '#1e1e1e'); trect(5, 7, 6, 1, '#1e1e1e');
        });
        tile('furn_lit', function () {
            trect(0, 0, 16, 16, '#6c6c6c'); sprinkle(['#606060', '#787878'], 40);
            trect(4, 8, 8, 6, '#1e1e1e'); trect(5, 7, 6, 1, '#1e1e1e');
            trect(5, 9, 6, 4, '#e6721a'); trect(6, 10, 4, 2, '#ffd75e'); tpx(6, 9, '#f5a324'); tpx(9, 12, '#f5a324');
        });
        grainTile('furn_top', '#7a7a7a', ['#6f6f6f', '#858585'], 60);
        tile('torch', function () {
            trect(7, 6, 2, 10, '#a8834f'); tpx(7, 8, '#8a6a3e'); tpx(8, 12, '#8a6a3e');
            trect(7, 4, 2, 2, '#ffd75e'); trect(7, 3, 2, 1, '#f5a324'); tpx(7, 2, '#fff1a8');
        });
        tile('tallgrass', function () {
            for (var i = 0; i < 9; i++) {
                var x = 1 + (trnd() * 14) | 0, h = 5 + (trnd() * 9) | 0;
                for (var y = 0; y < h; y++) tpx(x + (y > h - 3 && trnd() < 0.4 ? 1 : 0), 15 - y, trnd() < 0.5 ? '#4f8c31' : '#5d9e3a');
            }
        });
        tile('dandelion', function () {
            trect(7, 8, 1, 8, '#4f8c31'); tpx(6, 10, '#4f8c31'); tpx(8, 12, '#4f8c31');
            trect(6, 4, 3, 3, '#ffe23c'); tpx(7, 3, '#fff1a8'); tpx(5, 5, '#e8c81e'); tpx(9, 5, '#e8c81e');
        });
        tile('poppy', function () {
            trect(7, 8, 1, 8, '#4f8c31'); tpx(8, 11, '#4f8c31');
            trect(6, 4, 3, 3, '#d43022'); tpx(7, 3, '#ef5a3c'); tpx(6, 6, '#a81e12'); tpx(8, 6, '#a81e12');
        });
        for (var ws = 0; ws < 4; ws++) (function (stg) {
            tile('wheat' + stg, function () {
                var h = 4 + stg * 3, c1 = stg === 3 ? '#d8b641' : '#5aa23c', c2 = stg === 3 ? '#c2a02e' : '#4a8c30';
                for (var i = 0; i < 7; i++) {
                    var x = 1 + i * 2 + ((trnd() * 2) | 0);
                    for (var y = 0; y < h; y++) tpx(x, 15 - y, trnd() < 0.5 ? c1 : c2);
                    if (stg === 3) { tpx(x, 15 - h, '#e8cb5a'); tpx(x, 14 - h, '#e8cb5a'); }
                }
            });
        })(ws);
        tile('farmland', function () {
            trect(0, 0, 16, 16, '#5f4029');
            for (var x = 0; x < 16; x += 4) trect(x, 0, 2, 16, '#4a3220');
            sprinkle(['#6b4a32', '#3d2a1a'], 40);
        });
        grainTile('wool', '#e8e8e8', ['#dcdcdc', '#f4f4f4', '#d2d2d2'], 90);
        tile('bed_top', function () {
            trect(0, 0, 16, 16, '#b02e26'); sprinkle(['#a02820', '#c23830'], 40);
            trect(0, 0, 5, 16, '#e8e8e8'); sprinkle(['#dcdcdc', '#f4f4f4'], 10);
            trect(5, 0, 1, 16, '#8c1e18');
        });
        tile('bed_side', function () {
            trect(0, 8, 16, 5, '#b02e26'); trect(0, 8, 5, 5, '#dcdcdc');
            trect(0, 13, 16, 3, '#6e5230'); trect(0, 8, 16, 1, '#c23830');
        });
        tile('tnt_side', function () {
            trect(0, 0, 16, 16, '#c9432a'); sprinkle(['#b83a22', '#d84e33'], 40);
            trect(0, 6, 16, 4, '#e8e0d0');
            actx.fillStyle = '#1e1e1e';
            trect(2, 7, 3, 1, '#1e1e1e'); trect(3, 7, 1, 3, '#1e1e1e');       // T
            trect(6, 7, 1, 3, '#1e1e1e'); trect(9, 7, 1, 3, '#1e1e1e'); tpx(7, 8, '#1e1e1e'); tpx(8, 8, '#1e1e1e');   // N, roughly
            trect(11, 7, 3, 1, '#1e1e1e'); trect(12, 7, 1, 3, '#1e1e1e');     // T
        });
        tile('tnt_top', function () {
            trect(0, 0, 16, 16, '#c9432a'); sprinkle(['#b83a22', '#d84e33'], 40);
            trect(6, 6, 4, 4, '#e8e0d0'); trect(7, 7, 2, 2, '#3a3a3a');
        });
        tile('chest_side', function () {
            trect(0, 0, 16, 16, '#9c6b35'); sprinkle(['#8f6130', '#a9763c'], 40);
            trect(0, 0, 16, 1, '#5e3f1c'); trect(0, 15, 16, 1, '#5e3f1c'); trect(0, 0, 1, 16, '#5e3f1c'); trect(15, 0, 1, 16, '#5e3f1c');
            trect(0, 6, 16, 1, '#5e3f1c');
        });
        tile('chest_front', function () {
            trect(0, 0, 16, 16, '#9c6b35'); sprinkle(['#8f6130', '#a9763c'], 40);
            trect(0, 0, 16, 1, '#5e3f1c'); trect(0, 15, 16, 1, '#5e3f1c'); trect(0, 0, 1, 16, '#5e3f1c'); trect(15, 0, 1, 16, '#5e3f1c');
            trect(0, 6, 16, 1, '#5e3f1c');
            trect(7, 4, 2, 4, '#c9c9c9'); tpx(7, 6, '#8f8f8f');   // latch
        });
        tile('chest_top', function () {
            trect(0, 0, 16, 16, '#9c6b35'); sprinkle(['#8f6130', '#a9763c'], 40);
            trect(0, 0, 16, 1, '#5e3f1c'); trect(0, 15, 16, 1, '#5e3f1c'); trect(0, 0, 1, 16, '#5e3f1c'); trect(15, 0, 1, 16, '#5e3f1c');
        });
        /* destroy_stage_0 to 9: one network of cracks, grown from the middle by
           random walks and branches, each stage showing the next tenth of it */
        var CRACK = (function () {
            var r = mulb(0xC2AC4), at = {}, order = 0, walkers = [[8, 8], [7, 8], [8, 7]];
            for (var st = 0; st < 170 && walkers.length; st++) {
                var w = walkers[(r() * walkers.length) | 0], d = (r() * 8) | 0;
                var nx = w[0] + [1, -1, 0, 0, 1, -1, 1, -1][d], ny = w[1] + [0, 0, 1, -1, 1, 1, -1, -1][d];
                if (nx < 0 || ny < 0 || nx > 15 || ny > 15) continue;
                if (at[nx + ',' + ny] == null) at[nx + ',' + ny] = order++;
                w[0] = nx; w[1] = ny;
                if (r() < 0.07 && walkers.length < 9) walkers.push([nx, ny]);
            }
            return { at: at, n: order };
        })();
        for (var cs = 0; cs < 10; cs++) (function (stg) {
            tile('crack' + stg, function () {
                var lim = CRACK.n * (stg + 1) / 10;
                for (var k in CRACK.at) if (CRACK.at[k] < lim) {
                    var p = k.split(',');
                    tpx(p[0] | 0, p[1] | 0, CRACK.at[k] < lim * 0.6 ? 'rgba(18,14,10,0.9)' : 'rgba(30,24,18,0.7)');
                }
            });
        })(cs);
        tile('sun', function () { trect(2, 2, 12, 12, '#fdf4b8'); trect(4, 4, 8, 8, '#fffbe0'); });
        tile('moon', function () { trect(3, 3, 10, 10, '#d9dee8'); trect(5, 5, 6, 6, '#eceff5'); tpx(6, 7, '#b8bfd0'); tpx(9, 6, '#b8bfd0'); tpx(8, 9, '#b8bfd0'); });

        /* mob skins: a face tile + a hide tile each */
        function hide(name, base, sp) { grainTile(name, base, sp, 60); }
        hide('pig_skin', '#efa3a0', ['#e59592', '#f7b1ae', '#dd8a87']);
        tile('pig_face', function () {
            trect(0, 0, 16, 16, '#efa3a0'); sprinkle(['#e59592', '#f7b1ae'], 30);
            trect(2, 5, 2, 3, '#ffffff'); trect(12, 5, 2, 3, '#ffffff'); trect(3, 6, 1, 2, '#1e1e1e'); trect(12, 6, 1, 2, '#1e1e1e');
            trect(5, 9, 6, 4, '#dd7a76'); tpx(6, 10, '#5e2a28'); tpx(9, 10, '#5e2a28');
        });
        hide('cow_skin', '#5e4530', ['#523c28', '#6b5038', '#e8e0d0']);
        tile('cow_face', function () {
            trect(0, 0, 16, 16, '#5e4530'); sprinkle(['#523c28', '#6b5038'], 30);
            trect(2, 4, 2, 3, '#ffffff'); trect(12, 4, 2, 3, '#ffffff'); tpx(3, 5, '#1e1e1e'); tpx(12, 5, '#1e1e1e');
            trect(4, 10, 8, 5, '#d8cfc0'); tpx(5, 12, '#8a7a68'); tpx(10, 12, '#8a7a68');
            trect(0, 1, 2, 2, '#d8cfc0'); trect(14, 1, 2, 2, '#d8cfc0');   // horn nubs
        });
        hide('sheep_skin', '#e8e8e8', ['#dcdcdc', '#f4f4f4', '#d2d2d2']);
        tile('sheep_face', function () {
            trect(0, 0, 16, 16, '#e8e8e8'); sprinkle(['#dcdcdc', '#f4f4f4'], 20);
            trect(3, 6, 10, 8, '#d8c0a8');
            trect(4, 8, 2, 2, '#1e1e1e'); trect(10, 8, 2, 2, '#1e1e1e');
            tpx(4, 8, '#ffffff'); tpx(10, 8, '#ffffff');
        });
        hide('chicken_skin', '#f0f0f0', ['#e4e4e4', '#fafafa', '#d8d8d8']);
        tile('chicken_face', function () {
            trect(0, 0, 16, 16, '#f0f0f0'); sprinkle(['#e4e4e4', '#fafafa'], 20);
            trect(3, 5, 2, 2, '#1e1e1e'); trect(11, 5, 2, 2, '#1e1e1e');
            trect(6, 8, 4, 3, '#e8a020'); trect(6, 11, 4, 2, '#d43022');
        });
        hide('zom_skin', '#3a7040', ['#2f5e35', '#46804c', '#2a5430']);
        tile('zom_face', function () {
            trect(0, 0, 16, 16, '#4a8a50'); sprinkle(['#3f7a45', '#569a5c'], 30);
            trect(3, 6, 3, 2, '#0f2812'); trect(10, 6, 3, 2, '#0f2812');
            trect(6, 11, 4, 2, '#0f2812'); tpx(6, 10, '#0f2812');
        });
        hide('zom_body', '#3a6a9c', ['#31598a', '#4478ae', '#2c507c']);
        hide('skel_skin', '#c9c9c9', ['#bcbcbc', '#d8d8d8', '#a8a8a8']);
        tile('skel_face', function () {
            trect(0, 0, 16, 16, '#c9c9c9'); sprinkle(['#bcbcbc', '#d8d8d8'], 30);
            trect(3, 6, 3, 2, '#3a3a3a'); trect(10, 6, 3, 2, '#3a3a3a');
            trect(5, 11, 6, 1, '#3a3a3a'); tpx(6, 12, '#3a3a3a'); tpx(9, 12, '#3a3a3a');
        });
        hide('creep_skin', '#4dae3a', ['#3f9a2e', '#5cbe48', '#348a24', '#6bcc58']);
        tile('creep_face', function () {
            trect(0, 0, 16, 16, '#4dae3a'); sprinkle(['#3f9a2e', '#5cbe48', '#348a24'], 50);
            trect(3, 4, 3, 3, '#0c1c08'); trect(10, 4, 3, 3, '#0c1c08');           // the eyes
            trect(6, 7, 4, 4, '#0c1c08');                                          // the scream
            trect(5, 9, 2, 4, '#0c1c08'); trect(9, 9, 2, 4, '#0c1c08');
        });
        hide('spider_skin', '#2e2430', ['#241c26', '#3a2e3e', '#1e1820']);
        tile('spider_face', function () {
            trect(0, 0, 16, 16, '#2e2430'); sprinkle(['#241c26', '#3a2e3e'], 40);
            trect(3, 6, 2, 2, '#c81e1e'); trect(11, 6, 2, 2, '#c81e1e');
            trect(6, 5, 1, 1, '#c81e1e'); trect(9, 5, 1, 1, '#c81e1e');
            tpx(5, 9, '#801212'); tpx(10, 9, '#801212');
        });
        hide('ender_skin', '#101018', ['#181822', '#0a0a10', '#1e1e2a']);
        tile('ender_face', function () { trect(0, 0, 16, 16, '#101018'); sprinkle(['#181822', '#0a0a10'], 30); trect(3, 7, 4, 2, '#c8a8ff'); trect(9, 7, 4, 2, '#c8a8ff'); tpx(4, 7, '#e8d8ff'); tpx(10, 7, '#e8d8ff'); });
        // the face it wears once you've looked at it: eyes wide, jaw open
        tile('ender_rage', function () {
            trect(0, 0, 16, 16, '#101018'); sprinkle(['#181822', '#0a0a10'], 30);
            trect(2, 6, 5, 3, '#e0c8ff'); trect(9, 6, 5, 3, '#e0c8ff');
            trect(3, 6, 3, 1, '#ffffff'); trect(10, 6, 3, 1, '#ffffff');
            trect(6, 11, 4, 3, '#050508'); trect(5, 12, 6, 1, '#050508');
        });
        hide('slime_skin', '#5bc44a', ['#4faa3e', '#6bd858', '#54b846']);
        tile('slime_face', function () { trect(0, 0, 16, 16, '#5bc44a'); sprinkle(['#4faa3e', '#6bd858'], 26); trect(4, 5, 2, 2, '#28401e'); trect(10, 5, 2, 2, '#28401e'); trect(6, 10, 4, 1, '#28401e'); });
        hide('squid_skin', '#5a3f8c', ['#4e357a', '#6a4fa0', '#472f6e']);
        tile('squid_face', function () { trect(0, 0, 16, 16, '#5a3f8c'); sprinkle(['#4e357a', '#6a4fa0'], 26); trect(4, 6, 2, 3, '#1a1024'); trect(10, 6, 2, 3, '#1a1024'); tpx(4, 6, '#c8b8e0'); tpx(10, 6, '#c8b8e0'); });
        /* the bits that hang off a head: a snout, a pair of horns, a beak and its
           wattle. They exist so that a head TURNING is legible — a plain cube can
           swivel all it likes and read as standing still. */
        hide('pig_snout', '#dd7a76', ['#c96b67', '#e88a86', '#b85f5b']);
        hide('cow_horn', '#d8cfc0', ['#c4bbac', '#e8e0d0', '#b0a798']);
        hide('sheep_wool', '#f4f2ee', ['#e6e4df', '#fbfaf7', '#dcd9d2']);
        hide('chick_beak', '#e8a020', ['#d08c15', '#f5b433', '#c07e10']);
        hide('chick_wattle', '#d43022', ['#b8261a', '#e6432f', '#a01f15']);
        // the player's own skin — a FULL tile, so the empty first-person hand reads as a limb.
        // (it used to borrow the flat leather ITEM sprite, which stretched over the box into a
        //  glitchy brown blob with the icon's stitched border floating around it)
        hide('hand', '#b0794f', ['#9c6a44', '#c48c5e', '#a5744e']);

        /* flat item sprites */
        tile('i_stick', function () { for (var i = 0; i < 10; i++) { tpx(3 + i, 12 - i, '#a8834f'); tpx(4 + i, 12 - i, '#8a6a3e'); } });
        // a FULL, opaque arrow — the flying arrow is a solid 3D box, so it can't use a transparent
        // item sprite (that stretched into an invisible sliver, same bug class as the leather hand)
        tile('arrow', function () {
            trect(0, 0, 16, 16, '#6e5334'); sprinkle(['#5e4529', '#7e6040'], 10);   // wood shaft
            trect(0, 0, 16, 3, '#c4c8d0'); trect(0, 1, 16, 1, '#e6eaf2');           // steel tip end
            trect(0, 12, 16, 4, '#eaeaea'); tpx(3, 13, '#d83030'); tpx(12, 14, '#d83030');   // fletching end
        });
        tile('i_coal', function () { trect(4, 5, 7, 6, '#2c2c2c'); trect(5, 4, 5, 8, '#2c2c2c'); tpx(6, 6, '#4a4a4a'); tpx(8, 8, '#111111'); });
        tile('i_charcoal', function () { trect(4, 5, 7, 6, '#3a2c22'); trect(5, 4, 5, 8, '#3a2c22'); tpx(6, 6, '#553f30'); tpx(8, 8, '#241a12'); });
        tile('i_iron', function () { trect(3, 8, 10, 4, '#d8d8d8'); trect(4, 6, 8, 2, '#eeeeee'); trect(3, 12, 10, 1, '#9a9a9a'); });
        tile('i_gold', function () { trect(3, 8, 10, 4, '#f5cf3a'); trect(4, 6, 8, 2, '#ffe985'); trect(3, 12, 10, 1, '#c9a01e'); });
        tile('i_diamond', function () { trect(5, 4, 6, 3, '#8ef2f2'); trect(4, 7, 8, 2, '#63e0e0'); trect(6, 9, 4, 2, '#3bb8c9'); tpx(7, 11, '#2a9cb0'); tpx(8, 11, '#2a9cb0'); tpx(6, 5, '#d8fbfb'); });
        tile('i_flint', function () { trect(5, 6, 6, 5, '#3a3a3a'); trect(6, 5, 4, 7, '#3a3a3a'); tpx(7, 6, '#565656'); tpx(9, 9, '#242424'); });
        tile('i_feather', function () { for (var i = 0; i < 9; i++) { tpx(4 + i, 12 - i, '#f4f4f4'); tpx(5 + i, 12 - i, '#e0e0e0'); if (i < 8) tpx(4 + i, 11 - i, '#ffffff'); } tpx(3, 13, '#c9c9c9'); });
        tile('i_leather', function () { trect(4, 5, 8, 7, '#b3652c'); tpx(4, 5, '#8f4f20'); tpx(11, 5, '#8f4f20'); tpx(4, 11, '#8f4f20'); tpx(11, 11, '#8f4f20'); sprinkle(['#a05a26', '#c07034'], 8); });
        tile('i_string', function () { for (var i = 0; i < 12; i++) tpx(2 + i, 8 + ((i % 4 < 2) ? 0 : 1), '#e8e8e8'); });
        tile('i_gunpowder', function () { for (var i = 0; i < 16; i++) tpx(4 + (trnd() * 8) | 0, 5 + (trnd() * 7) | 0, trnd() < 0.5 ? '#4a4a4a' : '#6a6a6a'); });
        tile('i_bone', function () { trect(4, 10, 8, 2, '#f0ead8'); trect(2, 9, 3, 2, '#f0ead8'); trect(2, 11, 3, 2, '#f0ead8'); trect(11, 9, 3, 2, '#f0ead8'); trect(11, 11, 3, 2, '#f0ead8'); });
        tile('i_bonemeal', function () { for (var i = 0; i < 14; i++) tpx(4 + (trnd() * 8) | 0, 5 + (trnd() * 7) | 0, trnd() < 0.5 ? '#f0ead8' : '#d8d2c0'); });
        tile('i_arrow', function () { for (var i = 0; i < 8; i++) tpx(4 + i, 11 - i, '#a8834f'); trect(10, 3, 3, 3, '#c9c9c9'); tpx(12, 3, '#e8e8e8'); tpx(3, 12, '#f4f4f4'); tpx(4, 13, '#f4f4f4'); tpx(3, 13, '#e0e0e0'); });
        tile('i_bow', function () {
            for (var i = 0; i < 9; i++) { tpx(5 + (i < 3 ? 2 - i : i > 5 ? i - 6 : 0) + 2, 3 + i, '#8a6a3e'); }
            trect(6, 3, 3, 1, '#a8834f'); trect(6, 11, 3, 1, '#a8834f');
            for (var j = 0; j < 9; j++) tpx(11, 3 + j, '#e8e8e8');
        });
        tile('i_seeds', function () { for (var i = 0; i < 9; i++) tpx(4 + (trnd() * 8) | 0, 5 + (trnd() * 7) | 0, trnd() < 0.5 ? '#4a8c30' : '#5aa23c'); });
        tile('i_wheat', function () { for (var i = 0; i < 3; i++) { trect(5 + i * 3, 4, 1, 9, '#c2a02e'); trect(4 + i * 3, 3, 3, 4, '#d8b641'); tpx(5 + i * 3, 2, '#e8cb5a'); } });
        tile('i_bread', function () { trect(3, 6, 10, 5, '#b3773a'); trect(4, 5, 8, 1, '#c9894a'); trect(3, 11, 10, 1, '#8f5c2a'); tpx(5, 7, '#d8a05e'); tpx(9, 8, '#d8a05e'); });
        tile('i_apple', function () { trect(5, 6, 6, 6, '#d43022'); trect(4, 7, 8, 4, '#d43022'); tpx(6, 7, '#ef5a3c'); trect(7, 4, 1, 2, '#6b502f'); tpx(9, 4, '#4f8c31'); tpx(10, 4, '#4f8c31'); });
        function meat(name, raw, mid, cooked) {
            tile('i_' + name + '_raw', function () { trect(4, 5, 8, 7, raw); trect(5, 6, 6, 5, mid); tpx(6, 7, '#f7b1ae'); tpx(9, 9, '#f7b1ae'); });
            tile('i_' + name, function () { trect(4, 5, 8, 7, cooked); trect(5, 6, 6, 5, '#a5683a'); tpx(6, 7, '#c9894a'); tpx(9, 9, '#c9894a'); });
        }
        meat('pork', '#ef8a86', '#f7b1ae', '#8f5c34');
        meat('beef', '#c0392b', '#d95948', '#6b4226');
        meat('mutton', '#d95948', '#ef8a86', '#8f5c34');
        meat('chicken', '#efc8b8', '#f7ddd2', '#c9894a');
        tile('i_flesh', function () { trect(4, 5, 8, 7, '#8f5c34'); trect(5, 6, 3, 3, '#4a8c30'); trect(9, 8, 2, 3, '#5aa23c'); tpx(6, 10, '#6b4226'); });
        tile('i_bed', function () { trect(2, 8, 12, 3, '#b02e26'); trect(2, 8, 4, 3, '#e8e8e8'); trect(2, 11, 2, 3, '#6e5230'); trect(12, 11, 2, 3, '#6e5230'); });

        /* tools: silhouette per kind, head colored per tier */
        var TIER_C = { wood: ['#a8834f', '#8a6a3e'], stone: ['#9a9a9a', '#7a7a7a'], iron: ['#e0e0e0', '#b8b8b8'], gold: ['#f5cf3a', '#d9b625'], diamond: ['#63e0e0', '#3bb8c9'] };
        function toolTile(kind, tierName) {
            tile('i_' + tierName + '_' + kind, function () {
                var c = TIER_C[tierName], hc = c[0], hd = c[1], i;
                for (i = 0; i < 8; i++) { tpx(3 + i, 12 - i, '#a8834f'); if (kind !== 'sword') tpx(4 + i, 12 - i, '#6e5230'); }   // handle
                if (kind === 'pick') { for (i = 0; i < 9; i++) { tpx(4 + i, 4 - (i < 3 ? 2 - i : i > 5 ? i - 6 : 0) + 1, hc); tpx(4 + i, 5 - (i < 3 ? 2 - i : i > 5 ? i - 6 : 0) + 1, i % 2 ? hd : hc); } }
                else if (kind === 'axe') { trect(8, 2, 4, 3, hc); trect(9, 5, 3, 2, hd); tpx(12, 3, hd); }
                else if (kind === 'shovel') { trect(10, 2, 3, 4, hc); tpx(11, 6, hd); tpx(10, 5, hd); tpx(12, 5, hd); }
                else if (kind === 'sword') { for (i = 0; i < 8; i++) { tpx(5 + i, 10 - i, hc); tpx(6 + i, 10 - i, hd); } tpx(4, 12, '#6e5230'); tpx(6, 12, '#6e5230'); tpx(4, 10, '#6e5230'); }
                else if (kind === 'hoe') { trect(8, 2, 4, 2, hc); tpx(8, 4, hd); tpx(9, 4, hd); }
            });
        }
        for (var tn = 1; tn <= 5; tn++) for (var kk in { pick: 1, axe: 1, shovel: 1, sword: 1, hoe: 1 }) toolTile(kk, TIER_N[tn]);

        /* HUD icons */
        tile('h_heart', function () { tpx(4, 5, '#c81e1e'); tpx(5, 4, '#c81e1e'); tpx(6, 4, '#c81e1e'); tpx(7, 5, '#c81e1e'); tpx(8, 4, '#c81e1e'); tpx(9, 4, '#c81e1e'); tpx(10, 5, '#c81e1e'); trect(3, 5, 9, 3, '#e83030'); trect(4, 8, 7, 2, '#e83030'); trect(5, 10, 5, 1, '#c81e1e'); trect(6, 11, 3, 1, '#c81e1e'); tpx(7, 12, '#a01414'); tpx(5, 6, '#ff8080'); });
        tile('h_heart_half', function () { trect(3, 5, 5, 3, '#e83030'); tpx(4, 4, '#c81e1e'); tpx(5, 4, '#c81e1e'); tpx(6, 4, '#c81e1e'); trect(4, 8, 4, 2, '#e83030'); trect(5, 10, 3, 1, '#c81e1e'); tpx(6, 11, '#c81e1e'); tpx(7, 12, '#a01414'); tpx(5, 6, '#ff8080'); trect(8, 5, 4, 7, 'rgba(40,20,20,0.35)'); });
        tile('h_heart_bg', function () { tpx(4, 5, '#3a2020'); tpx(5, 4, '#3a2020'); tpx(6, 4, '#3a2020'); tpx(7, 5, '#3a2020'); tpx(8, 4, '#3a2020'); tpx(9, 4, '#3a2020'); tpx(10, 5, '#3a2020'); trect(3, 5, 9, 3, '#4a2c2c'); trect(4, 8, 7, 2, '#4a2c2c'); trect(5, 10, 5, 1, '#3a2020'); trect(6, 11, 3, 1, '#3a2020'); tpx(7, 12, '#301818'); });
        tile('h_food', function () { trect(6, 4, 5, 5, '#b3652c'); tpx(6, 4, '#c9894a'); trect(5, 9, 2, 2, '#e8dcc8'); trect(9, 9, 2, 2, '#e8dcc8'); trect(4, 11, 2, 2, '#e8dcc8'); trect(10, 11, 2, 2, '#e8dcc8'); tpx(7, 5, '#d8a05e'); });
        tile('h_food_half', function () { trect(6, 4, 3, 5, '#b3652c'); tpx(6, 4, '#c9894a'); trect(5, 9, 2, 2, '#e8dcc8'); trect(4, 11, 2, 2, '#e8dcc8'); trect(9, 4, 3, 9, 'rgba(30,24,18,0.4)'); });
        tile('h_food_bg', function () { trect(6, 4, 5, 5, '#3a3028'); trect(5, 9, 2, 2, '#4a4038'); trect(9, 9, 2, 2, '#4a4038'); trect(4, 11, 2, 2, '#4a4038'); trect(10, 11, 2, 2, '#4a4038'); });
        tile('h_bubble', function () { trect(5, 4, 6, 2, '#cfe9f5'); trect(4, 5, 8, 6, '#a8d4ec'); trect(5, 11, 6, 1, '#cfe9f5'); tpx(6, 6, '#ffffff'); tpx(5, 7, '#e8f4fb'); });
        tile('h_armor', function () { trect(4, 3, 8, 2, '#c7ccd6'); trect(3, 5, 10, 6, '#aeb4c0'); trect(5, 5, 6, 4, '#c7ccd6'); trect(4, 11, 3, 2, '#9298a4'); trect(9, 11, 3, 2, '#9298a4'); tpx(4, 3, '#e6e9ef'); tpx(11, 3, '#e6e9ef'); });
        tile('h_armor_half', function () { trect(4, 3, 4, 2, '#c7ccd6'); trect(3, 5, 5, 6, '#aeb4c0'); trect(5, 5, 3, 4, '#c7ccd6'); trect(4, 11, 3, 2, '#9298a4'); trect(8, 3, 4, 8, 'rgba(24,26,32,0.5)'); });
        tile('h_armor_bg', function () { trect(4, 3, 8, 2, '#2b2f38'); trect(3, 5, 10, 6, '#33373f'); trect(4, 11, 3, 2, '#2b2f38'); trect(9, 11, 3, 2, '#2b2f38'); });
        /* ── expansion: block faces ── */
        tile('cactus_top', function () { trect(0, 0, 16, 16, '#4f7a2e'); trect(2, 2, 12, 12, '#5c8c36'); trect(5, 5, 6, 6, '#6ba03f'); sprinkle(['#4f7a2e', '#78b048'], 20); });
        tile('cactus_side', function () { trect(0, 0, 16, 16, '#4f7a2e'); trect(1, 0, 14, 16, '#5c8c36'); for (var y = 0; y < 16; y += 2) { tpx(2, y, '#3f6624'); tpx(13, y + 1, '#3f6624'); } sprinkle(['#6ba03f', '#4f7a2e'], 24); });
        tile('sugarcane', function () { for (var i = 0; i < 5; i++) { var x = 3 + i * 2 + ((trnd() * 2) | 0); for (var y = 0; y < 16; y++) tpx(x, y, y < 4 ? '#b7d98a' : trnd() < 0.5 ? '#7fb85a' : '#8fc86a'); } });
        tile('pumpkin_top', function () { trect(0, 0, 16, 16, '#d97e1e'); for (var x = 0; x < 16; x += 3) trect(x, 0, 1, 16, '#b3651a'); trect(6, 6, 4, 4, '#7a5a2a'); sprinkle(['#e8912e', '#c26e18'], 20); });
        tile('pumpkin_side', function () { trect(0, 0, 16, 16, '#d97e1e'); for (var x = 1; x < 16; x += 3) trect(x, 1, 2, 14, '#e0871f'); for (var x2 = 0; x2 < 16; x2 += 3) trect(x2, 0, 1, 16, '#a85e16'); trect(0, 0, 16, 1, '#b3651a'); trect(0, 15, 16, 1, '#b3651a'); });
        tile('melon_top', function () { trect(0, 0, 16, 16, '#5f8c2e'); for (var x = 0; x < 16; x += 4) trect(x, 0, 2, 16, '#3f6a1e'); sprinkle(['#6fa03a', '#4f7a26'], 24); });
        tile('melon_side', function () { trect(0, 0, 16, 16, '#5f8c2e'); for (var x = 1; x < 16; x += 4) { trect(x, 0, 2, 16, '#4f7a26'); trect(x + 2, 0, 1, 16, '#6fa03a'); } sprinkle(['#3f6a1e'], 16); });
        tile('pstem', function () { for (var i = 0; i < 4; i++) { var x = 5 + i; for (var y = 6; y < 16; y++) tpx(x, y, '#7a9a3a'); } tpx(6, 5, '#8caa46'); tpx(9, 6, '#8caa46'); });
        tile('mstem', function () { for (var i = 0; i < 4; i++) { var x = 6 + i; for (var y = 6; y < 16; y++) tpx(x, y, '#6f8f34'); } tpx(6, 5, '#82a240'); tpx(9, 7, '#82a240'); });
        (function () {
            var crop = ['#4f8c31', '#5aa23c', '#d8b641'];
            for (var s = 0; s < 4; s++) (function (stg) {
                tile('carrot' + stg, function () {
                    var h = 4 + stg * 3;
                    for (var i = 0; i < 6; i++) { var x = 2 + i * 2 + ((trnd() * 2) | 0); for (var y = 0; y < h; y++) tpx(x, 15 - y, trnd() < 0.5 ? '#4f8c31' : '#6cb043'); if (stg === 3) { tpx(x, 15, '#e0821e'); tpx(x, 14, '#e0821e'); } }
                });
                tile('potato' + stg, function () {
                    var h = 3 + stg * 3;
                    for (var i = 0; i < 6; i++) { var x = 2 + i * 2 + ((trnd() * 2) | 0); for (var y = 0; y < h; y++) tpx(x, 15 - y, trnd() < 0.5 ? '#4a8c30' : '#5aa23c'); } if (stg === 3) { tpx(6, 13, '#c8a86a'); tpx(9, 14, '#c8a86a'); }
                });
            })(s);
        })();
        oreTile('ore_red', '#c81e1e', '#8f1414'); oreTile('ore_lapis', '#274bb5', '#1a3688'); oreTile('ore_emerald', '#17c05a', '#0f9042');
        tile('obsidian', function () { trect(0, 0, 16, 16, '#160f26'); sprinkle(['#1e1533', '#0f0a1c', '#241a3d'], 60); for (var i = 0; i < 8; i++) tpx((trnd() * 16) | 0, (trnd() * 16) | 0, '#5a3f8c'); });
        tile('stonebrick', function () { trect(0, 0, 16, 16, '#7a7a7a'); sprinkle(['#727272', '#828282'], 40); actx.fillStyle = '#565656'; trect(0, 7, 16, 1, '#565656'); trect(0, 15, 16, 1, '#565656'); trect(7, 0, 1, 8, '#565656'); trect(3, 8, 1, 8, '#565656'); trect(11, 8, 1, 8, '#565656'); trect(0, 0, 1, 8, '#565656'); });
        tile('sandstone_top', function () { trect(0, 0, 16, 16, '#dbcf9c'); sprinkle(['#cfc28d', '#e6dcae'], 40); trect(0, 0, 16, 1, '#c8ba85'); trect(0, 15, 16, 1, '#c8ba85'); });
        tile('sandstone_side', function () { trect(0, 0, 16, 16, '#dbcf9c'); sprinkle(['#cfc28d', '#e6dcae', '#c8ba85'], 40); trect(0, 2, 16, 1, '#c8ba85'); trect(0, 13, 16, 1, '#c8ba85'); });
        tile('bricks', function () { trect(0, 0, 16, 16, '#9a4a34'); sprinkle(['#8f4530', '#a5533a'], 24); actx.fillStyle = '#c9b8a8'; for (var y = 0; y < 16; y += 4) trect(0, y + 3, 16, 1, '#c9b8a8'); for (var y2 = 0; y2 < 16; y2 += 8) { trect(7, y2, 1, 4, '#c9b8a8'); } for (var y3 = 4; y3 < 16; y3 += 8) { trect(3, y3, 1, 4, '#c9b8a8'); trect(11, y3, 1, 4, '#c9b8a8'); } });
        tile('bookshelf_side', function () { trect(0, 0, 16, 16, '#a8834f'); trect(0, 0, 16, 2, '#6e5230'); trect(0, 7, 16, 2, '#6e5230'); trect(0, 14, 16, 2, '#6e5230'); var cols = ['#b83a22', '#2e6bcf', '#3f9a2e', '#d8b641', '#8c3fc0', '#c96a1e']; for (var r = 0; r < 2; r++) for (var i = 0; i < 6; i++) { trect(1 + i * 2 + (i > 2 ? 1 : 0), 2 + r * 7, 1, 5, cols[(i + r) % 6]); } });
        tile('ladder', function () { for (var y = 0; y < 16; y++) { tpx(3, y, '#8a6a3e'); tpx(12, y, '#8a6a3e'); } for (var r = 1; r < 16; r += 4) trect(3, r, 10, 1, '#a8834f'); });
        tile('rlamp', function () { trect(0, 0, 16, 16, '#8a5a2e'); trect(2, 2, 12, 12, '#e8a83c'); trect(4, 4, 8, 8, '#ffd75e'); trect(6, 6, 4, 4, '#fff1a8'); sprinkle(['#f5c04a', '#ffcf6a'], 16); });
        tile('cake_top', function () { trect(0, 0, 16, 16, '#f0e8d8'); sprinkle(['#e8dfcc', '#f8f2e6'], 30); for (var i = 0; i < 5; i++) tpx(2 + (trnd() * 12) | 0, 2 + (trnd() * 12) | 0, '#d43022'); });
        tile('cake_side', function () { trect(0, 0, 16, 4, '#f0e8d8'); trect(0, 4, 16, 1, '#d43022'); trect(0, 5, 16, 9, '#c9945a'); trect(0, 14, 16, 2, '#8f5c2a'); });
        tile('cake_inner', function () { trect(0, 0, 16, 4, '#f0e8d8'); trect(0, 4, 16, 12, '#e8b878'); sprinkle(['#d8a868'], 20); });
        tile('etable_top', function () { trect(0, 0, 16, 16, '#160f26'); sprinkle(['#1e1533', '#241a3d'], 40); trect(4, 3, 8, 10, '#b02e26'); trect(5, 4, 6, 8, '#e8e0d0'); tpx(7, 6, '#8c1e18'); tpx(9, 9, '#8c1e18'); });
        tile('etable_side', function () { trect(0, 0, 16, 16, '#160f26'); sprinkle(['#1e1533', '#241a3d'], 40); trect(0, 0, 16, 3, '#3a2a55'); trect(2, 6, 2, 2, '#63e0e0'); trect(12, 10, 2, 2, '#63e0e0'); });
        tile('anvil_top', function () { trect(0, 0, 16, 16, '#3f4249'); trect(2, 2, 12, 12, '#4a4d55'); trect(4, 4, 8, 8, '#33363c'); trect(5, 6, 6, 4, '#26282d'); sprinkle(['#55585f', '#33363c'], 20); });
        tile('anvil_side', function () { trect(0, 0, 16, 4, '#4a4d55'); trect(2, 4, 12, 3, '#3f4249'); trect(4, 7, 8, 4, '#33363c'); trect(2, 11, 12, 5, '#4a4d55'); sprinkle(['#55585f', '#2b2d31'], 24); });
        tile('mushroom', function () { trect(7, 8, 2, 6, '#e8e0d0'); trect(5, 4, 6, 4, '#8f5a3a'); trect(4, 5, 8, 2, '#a06a44'); tpx(5, 4, '#6e4228'); tpx(10, 4, '#6e4228'); });
        tile('mushroom_r', function () { trect(7, 8, 2, 6, '#e8e0d0'); trect(4, 4, 8, 4, '#c81e1e'); trect(5, 3, 6, 2, '#d43022'); tpx(6, 5, '#ffffff'); tpx(9, 6, '#ffffff'); tpx(7, 4, '#ffffff'); });
        grainTile('clay', '#a6adba', ['#9aa1af', '#b2b9c6', '#8f96a4'], 50);
        /* ── expansion: item icons ── */
        tile('i_redstone', function () { for (var i = 0; i < 16; i++) tpx(3 + (trnd() * 9) | 0, 5 + (trnd() * 8) | 0, trnd() < 0.5 ? '#c81e1e' : '#e83030'); });
        tile('i_lapis', function () { for (var i = 0; i < 8; i++) { var x = 3 + (trnd() * 9) | 0, y = 4 + (trnd() * 8) | 0; trect(x, y, 2, 2, trnd() < 0.5 ? '#274bb5' : '#3a63d8'); } sprinkle(['#e8c81e'], 4); });
        tile('i_emerald', function () { trect(5, 4, 6, 3, '#3fe07a'); trect(4, 6, 8, 5, '#17c05a'); trect(6, 11, 4, 2, '#0f9042'); tpx(6, 5, '#a8f5c8'); tpx(9, 8, '#0c7838'); });
        tile('i_ender_pearl', function () { trect(5, 4, 6, 8, '#0d2a2a'); trect(4, 6, 8, 4, '#12403c'); trect(6, 6, 3, 3, '#1fb0a0'); tpx(7, 7, '#5fe8d8'); tpx(9, 9, '#0a5a52'); });
        tile('i_slimeball', function () { trect(4, 6, 8, 6, '#7fc85a'); trect(5, 5, 6, 8, '#7fc85a'); tpx(6, 7, '#a8e086'); tpx(9, 9, '#5a9a3a'); });
        tile('i_ink_sac', function () { trect(5, 5, 6, 7, '#1a1f33'); trect(4, 7, 8, 4, '#1a1f33'); tpx(6, 6, '#3a4260'); tpx(9, 10, '#0d1020'); });
        tile('i_egg', function () { trect(6, 4, 4, 2, '#f0ead8'); trect(5, 6, 6, 5, '#f0ead8'); trect(6, 11, 4, 1, '#e0d8c0'); tpx(7, 6, '#fffaf0'); tpx(9, 9, '#d8cfb0'); });
        tile('i_paper', function () { trect(3, 3, 10, 11, '#f0f0ea'); tpx(3, 3, '#d8d8d0'); tpx(12, 3, '#d8d8d0'); trect(5, 6, 6, 1, '#c8c8c0'); trect(5, 9, 6, 1, '#c8c8c0'); });
        tile('i_book', function () { trect(3, 3, 10, 11, '#8a4a26'); trect(4, 3, 1, 11, '#6e3818'); trect(11, 4, 2, 9, '#f0ead8'); tpx(4, 3, '#a05a30'); });
        tile('i_sugar', function () { for (var i = 0; i < 14; i++) tpx(3 + (trnd() * 10) | 0, 5 + (trnd() * 8) | 0, trnd() < 0.5 ? '#ffffff' : '#e8e8ea'); });
        (function () {
            function pail(name, fill) {
                tile(name, function () {
                    trect(3, 5, 10, 8, '#9298a4'); trect(4, 12, 8, 2, '#7a808c'); trect(3, 5, 10, 1, '#b0b6c0');
                    if (fill) { trect(5, 6, 6, 5, fill); }
                    tpx(3, 5, '#c0c6d0'); tpx(12, 5, '#7a808c');
                });
            }
            pail('i_bucket', null); pail('i_water_bucket', '#3a63d8'); pail('i_lava_bucket', '#e6721a'); pail('i_milk_bucket', '#f4f4f4');
        })();
        tile('i_flint_steel', function () { trect(4, 8, 5, 4, '#3a3a3a'); tpx(5, 9, '#565656'); trect(9, 3, 3, 8, '#c9c9c9'); trect(9, 3, 4, 2, '#9a9a9a'); tpx(11, 10, '#e8e8e8'); });
        tile('i_ench_book', function () { trect(3, 3, 10, 11, '#8c3fc0'); trect(4, 3, 1, 11, '#6a2a98'); trect(11, 4, 2, 9, '#f0e0ff'); tpx(6, 6, '#d8a8ff'); tpx(9, 9, '#e8c8ff'); });
        tile('i_carrot', function () { trect(7, 8, 2, 5, '#e0821e'); trect(6, 10, 4, 3, '#e8912e'); trect(8, 12, 2, 2, '#c26e18'); for (var i = 0; i < 4; i++) { tpx(6 - (i % 2), 8 - i, '#4f8c31'); tpx(9 + (i % 2), 8 - i, '#4f8c31'); } });
        tile('i_potato', function () { trect(5, 6, 7, 6, '#c8a86a'); trect(6, 5, 5, 8, '#c8a86a'); tpx(6, 7, '#b89858'); tpx(9, 9, '#d8b87a'); tpx(8, 6, '#a88848'); });
        tile('i_baked_potato', function () { trect(5, 6, 7, 6, '#b3814a'); trect(6, 5, 5, 8, '#b3814a'); trect(7, 7, 3, 3, '#e8c86a'); tpx(6, 6, '#8f5c2a'); tpx(10, 10, '#8f5c2a'); });
        tile('i_golden_carrot', function () { trect(7, 8, 2, 5, '#e0b81e'); trect(6, 10, 4, 3, '#f5cf3a'); trect(8, 12, 2, 2, '#c9a01e'); for (var i = 0; i < 4; i++) { tpx(6 - (i % 2), 8 - i, '#f5cf3a'); tpx(9 + (i % 2), 8 - i, '#f5cf3a'); } });
        tile('i_golden_apple', function () { trect(5, 6, 6, 6, '#f5cf3a'); trect(4, 7, 8, 4, '#f5cf3a'); tpx(6, 7, '#ffe985'); trect(7, 4, 1, 2, '#8a6a3e'); tpx(9, 4, '#f5cf3a'); tpx(4, 8, '#c9a01e'); });
        tile('i_cookie', function () { trect(4, 6, 8, 5, '#b3773a'); trect(5, 5, 6, 7, '#b3773a'); tpx(6, 7, '#5a3a1e'); tpx(9, 8, '#5a3a1e'); tpx(7, 9, '#5a3a1e'); tpx(8, 6, '#5a3a1e'); });
        tile('i_melon_slice', function () { for (var y = 0; y < 8; y++) { var w = y + 2; trect(8 - (w >> 1), 4 + y, w, 1, y > 5 ? '#3f6a1e' : '#d43022'); } trect(3, 12, 10, 1, '#5f8c2e'); sprinkle(['#8f1414'], 4); });
        tile('i_pumpkin_pie', function () { trect(3, 6, 10, 6, '#c9945a'); trect(3, 5, 10, 1, '#e0b878'); trect(4, 6, 8, 2, '#d97e1e'); trect(3, 11, 10, 1, '#8f5c2a'); tpx(6, 7, '#f0e8d8'); });
        tile('i_bowl', function () { trect(3, 8, 10, 1, '#a8834f'); trect(4, 9, 8, 3, '#8a6a3e'); trect(5, 12, 6, 1, '#6e5230'); trect(5, 9, 6, 1, '#6e5230'); });
        tile('i_mushroom_stew', function () { trect(3, 8, 10, 1, '#a8834f'); trect(4, 9, 8, 3, '#8a6a3e'); trect(4, 8, 8, 1, '#b3773a'); tpx(6, 8, '#c81e1e'); tpx(9, 8, '#e8e0d0'); });
        tile('i_clay_ball', function () { trect(5, 6, 6, 6, '#a6adba'); trect(6, 5, 4, 8, '#a6adba'); tpx(6, 6, '#b2b9c6'); tpx(9, 10, '#8f96a4'); });
        tile('i_brick', function () { trect(4, 6, 8, 5, '#9a4a34'); trect(5, 5, 6, 7, '#a5533a'); tpx(5, 6, '#8f4530'); tpx(10, 9, '#8f4530'); tpx(7, 8, '#c9b8a8'); });
        /* weather particles + xp orb */
        tile('rain', function () { trect(7, 0, 2, 16, '#7fb0e8'); tpx(7, 2, '#a8d0f5'); });
        tile('snow', function () { trect(6, 6, 4, 4, '#ffffff'); tpx(5, 7, '#e8f4ff'); tpx(10, 8, '#e8f4ff'); });
        /* the XP orb: a round lime ball, dark at the rim and pale at the heart, for
           the renderer to tint (ExperienceOrbRenderer multiplies it by a colour that
           pulses from green to yellow) */
        tile('xporb', function () {
            trect(5, 4, 6, 8, '#6f8f10'); trect(4, 5, 8, 6, '#6f8f10');
            trect(5, 5, 6, 6, '#d8f850'); trect(6, 4, 4, 1, '#b8dc30'); trect(6, 11, 4, 1, '#88aa18');
            trect(6, 6, 3, 3, '#f4ffa8'); tpx(6, 6, '#ffffe0'); tpx(10, 10, '#a0c028'); tpx(9, 10, '#a0c028');
        });
        /* fire_0 and fire_1, for anything that burns: three licks of flame a tile,
           each from a pale yellow root through orange to ragged dark red tips,
           low and broken between them, so what burns shows through */
        function paintFire(ph) {
            for (var x = 0; x < 16; x++) {
                var lick = Math.pow(0.5 + 0.5 * Math.sin(x * 1.25 + ph + trnd() * 0.6), 1.6);
                var hgt = Math.round(2 + lick * 12 + trnd() * 2);
                for (var y = 0; y < hgt; y++) {
                    var t = y / hgt;
                    if ((t > 0.5 && trnd() < 0.5 * t) || (y < 4 && lick < 0.25 && trnd() < 0.45)) continue;
                    tpx(x, 15 - y, t < 0.3 ? (lick > 0.6 ? '#ffe68a' : '#ffc933') : t < 0.6 ? '#ffa31c' : t < 0.85 ? '#ee640e' : '#bc360a');
                }
            }
        }
        tile('fire0', function () { paintFire(0); });
        tile('fire1', function () { paintFire(2.1); });
        /* the poof a mob leaves: generic_7, the biggest of the eight smoke puffs,
           a pale ring round a paler heart; the particle shrinks through the rest */
        tile('puff', function () {
            trect(5, 2, 6, 12, '#b4b4b4'); trect(2, 5, 12, 6, '#b4b4b4'); trect(3, 3, 10, 10, '#b4b4b4');
            trect(5, 3, 6, 10, '#dedede'); trect(3, 5, 10, 6, '#dedede'); trect(4, 4, 8, 8, '#dedede');
            trect(6, 5, 3, 3, '#f4f4f4');
        });
        /* armor icons: silhouette per slot × tier colour */
        (function () {
            var TC = { leather: ['#8a4f28', '#6e3f1e'], iron: ['#d0d0d0', '#a8a8a8'], gold: ['#f5cf3a', '#c9a01e'], diamond: ['#63e0e0', '#3bb8c9'] };
            function paintArmor(kind, hi, lo) {
                if (kind === 'helm') { trect(4, 3, 8, 3, hi); trect(3, 5, 10, 5, hi); trect(5, 6, 6, 3, lo); trect(3, 5, 1, 5, lo); trect(12, 5, 1, 5, lo); }
                else if (kind === 'chest') { trect(3, 3, 3, 2, hi); trect(10, 3, 3, 2, hi); trect(3, 4, 10, 9, hi); trect(5, 5, 6, 6, lo); tpx(4, 4, lo); tpx(11, 4, lo); }
                else if (kind === 'legs') { trect(3, 3, 10, 3, hi); trect(3, 6, 4, 8, hi); trect(9, 6, 4, 8, hi); trect(4, 8, 2, 5, lo); trect(10, 8, 2, 5, lo); }
                else { trect(3, 4, 4, 9, hi); trect(9, 4, 4, 9, hi); trect(3, 12, 5, 2, hi); trect(8, 12, 5, 2, hi); trect(4, 6, 2, 5, lo); trect(10, 6, 2, 5, lo); }
            }
            for (var tn in TC) for (var sk in { helm: 1, chest: 1, legs: 1, boots: 1 }) (function (t, s) {
                tile('i_' + t + '_' + s, function () { paintArmor(s, TC[t][0], TC[t][1]); });
            })(tn, sk);
        })();
        /* enchant glint overlay (sampled additively onto item icons) */
        tile('glint', function () { for (var i = 0; i < 10; i++) { var x = (trnd() * 14) | 0, y = (trnd() * 14) | 0; trect(x, y, 2, 1, 'rgba(180,120,255,0.55)'); tpx(x, y + 1, 'rgba(220,180,255,0.7)'); } });
    }

    /* face textures per block: [top, bottom, side] (front variants share sides) */
    var TEX = {};
    function texInit() {
        var t = TILE;
        TEX[GRASS] = [t.grass_top, t.dirt, t.grass_side];
        TEX[DIRT] = [t.dirt, t.dirt, t.dirt];
        TEX[STONE] = [t.stone, t.stone, t.stone];
        TEX[COBBLE] = [t.cobble, t.cobble, t.cobble];
        TEX[LOG] = [t.log_top, t.log_top, t.log_side];
        TEX[LEAVES] = [t.leaves, t.leaves, t.leaves];
        TEX[PLANKS] = [t.planks, t.planks, t.planks];
        TEX[SAND] = [t.sand, t.sand, t.sand];
        TEX[GRAVEL] = [t.gravel, t.gravel, t.gravel];
        TEX[ORE_COAL] = [t.ore_coal, t.ore_coal, t.ore_coal];
        TEX[ORE_IRON] = [t.ore_iron, t.ore_iron, t.ore_iron];
        TEX[ORE_GOLD] = [t.ore_gold, t.ore_gold, t.ore_gold];
        TEX[ORE_DIA] = [t.ore_dia, t.ore_dia, t.ore_dia];
        TEX[BEDROCK] = [t.bedrock, t.bedrock, t.bedrock];
        TEX[WATER] = [t.water, t.water, t.water];
        TEX[LAVA] = [t.lava, t.lava, t.lava];
        TEX[TABLE] = [t.table_top, t.planks, t.table_side];
        // per-face [d0=+X, d1=-X, d2=top, d3=bottom, d4=+Z front, d5=-Z] so the mouth shows on ONE
        // face, not all four (furn_side/chest_side were painted but never wired up)
        TEX[FURN] = [t.furn_side, t.furn_side, t.furn_top, t.furn_top, t.furn_front, t.furn_side];
        TEX[FURN_LIT] = [t.furn_side, t.furn_side, t.furn_top, t.furn_top, t.furn_lit, t.furn_side];
        TEX[TORCH] = [t.torch, t.torch, t.torch];
        TEX[GLASS] = [t.glass, t.glass, t.glass];
        TEX[SNOWGRASS] = [t.snow_top, t.dirt, t.snow_side];
        TEX[WOOL] = [t.wool, t.wool, t.wool];
        TEX[BED] = [t.bed_top, t.planks, t.bed_side];
        TEX[TALLGRASS] = [t.tallgrass, t.tallgrass, t.tallgrass];
        TEX[DANDELION] = [t.dandelion, t.dandelion, t.dandelion];
        TEX[POPPY] = [t.poppy, t.poppy, t.poppy];
        TEX[FARMLAND] = [t.farmland, t.dirt, t.dirt];
        TEX[WHEAT0] = [t.wheat0, t.wheat0, t.wheat0];
        TEX[WHEAT1] = [t.wheat1, t.wheat1, t.wheat1];
        TEX[WHEAT2] = [t.wheat2, t.wheat2, t.wheat2];
        TEX[WHEAT3] = [t.wheat3, t.wheat3, t.wheat3];
        TEX[CHEST] = [t.chest_side, t.chest_side, t.chest_top, t.chest_top, t.chest_front, t.chest_side];
        TEX[TNT] = [t.tnt_top, t.tnt_top, t.tnt_side];
        // ── expansion blocks ──
        TEX[CACTUS] = [t.cactus_top, t.cactus_top, t.cactus_side];
        TEX[SUGARCANE] = [t.sugarcane, t.sugarcane, t.sugarcane];
        TEX[PUMPKIN] = [t.pumpkin_top, t.pumpkin_top, t.pumpkin_side];
        TEX[MELON] = [t.melon_top, t.melon_top, t.melon_side];
        TEX[PSTEM] = [t.pstem, t.pstem, t.pstem];
        TEX[MSTEM] = [t.mstem, t.mstem, t.mstem];
        TEX[CARROT0] = [t.carrot0, t.carrot0, t.carrot0]; TEX[CARROT1] = [t.carrot1, t.carrot1, t.carrot1];
        TEX[CARROT2] = [t.carrot2, t.carrot2, t.carrot2]; TEX[CARROT3] = [t.carrot3, t.carrot3, t.carrot3];
        TEX[POTATO0] = [t.potato0, t.potato0, t.potato0]; TEX[POTATO1] = [t.potato1, t.potato1, t.potato1];
        TEX[POTATO2] = [t.potato2, t.potato2, t.potato2]; TEX[POTATO3] = [t.potato3, t.potato3, t.potato3];
        TEX[ORE_RED] = [t.ore_red, t.ore_red, t.ore_red];
        TEX[ORE_LAPIS] = [t.ore_lapis, t.ore_lapis, t.ore_lapis];
        TEX[ORE_EMERALD] = [t.ore_emerald, t.ore_emerald, t.ore_emerald];
        TEX[OBSIDIAN] = [t.obsidian, t.obsidian, t.obsidian];
        TEX[STONEBRICK] = [t.stonebrick, t.stonebrick, t.stonebrick];
        TEX[SANDSTONE] = [t.sandstone_top, t.sandstone_top, t.sandstone_side];
        TEX[BRICKS] = [t.bricks, t.bricks, t.bricks];
        TEX[BOOKSHELF] = [t.planks, t.planks, t.bookshelf_side];
        TEX[LADDER] = [t.ladder, t.ladder, t.ladder];
        TEX[RLAMP] = [t.rlamp, t.rlamp, t.rlamp];
        TEX[CAKE] = [t.cake_top, t.cake_inner, t.cake_side];
        TEX[ETABLE] = [t.etable_top, t.obsidian, t.etable_side];
        TEX[ANVIL] = [t.anvil_top, t.anvil_top, t.anvil_side];
        TEX[MUSHROOM] = [t.mushroom, t.mushroom, t.mushroom];
        TEX[MUSHROOM_R] = [t.mushroom_r, t.mushroom_r, t.mushroom_r];
        TEX[CLAY] = [t.clay, t.clay, t.clay];
        /* item sprite lookup + place→item reverse map (silk touch / self-drops) */
        for (var id in I) {
            var def = I[id];
            if (TILE['i_' + id] != null) def.tile = TILE['i_' + id];
            if (def.place != null && PLACE2ITEM[def.place] == null && !def.crop) PLACE2ITEM[def.place] = id;
        }
        I.coal.tile = TILE.i_coal; I.torch.tile = TILE.torch;
        I.dandelion.tile = TILE.dandelion; I.poppy.tile = TILE.poppy;
    }

    /* ── chunk store ────────────────────────────────────────── */
    // column = 16×96×16, idx = x | z<<4 | y<<8
    function ckey(cx, cz) { return cx + ',' + cz; }
    var _ccx = 1e9, _ccz = 1e9, _cc = null;   // last-chunk cache: BFS and meshing hammer this
    function chunkAt(wx, wz) {
        var cx = wx >> 4, cz = wz >> 4;
        if (cx === _ccx && cz === _ccz) return _cc;
        _ccx = cx; _ccz = cz;
        return (_cc = RT.chunks[cx + ',' + cz] || null);
    }
    function chunkCacheDrop() { _ccx = 1e9; _ccz = 1e9; _cc = null; }
    function lidx(wx, wy, wz) { return (wx & 15) | ((wz & 15) << 4) | (wy << 8); }
    function getB(wx, wy, wz) {
        if (wy < 0) return BEDROCK;
        if (wy >= CH) return AIR;
        var c = chunkAt(wx, wz);
        return c ? c.bl[lidx(wx, wy, wz)] : -1;   // -1: unloaded → opaque wall, solid floor
    }
    function getSky(wx, wy, wz) {
        if (wy >= CH) return 15;
        if (wy < 0) return 0;
        var c = chunkAt(wx, wz);
        return c ? c.sky[lidx(wx, wy, wz)] : 0;
    }
    function getBlk(wx, wy, wz) {
        if (wy < 0 || wy >= CH) return 0;
        var c = chunkAt(wx, wz);
        return c ? c.blk[lidx(wx, wy, wz)] : 0;
    }
    function solidAt(wx, wy, wz) { var b = getB(wx, wy, wz); return b === -1 || (B[b] && B[b].solid); }
    function opaqueAt(wx, wy, wz) { var b = getB(wx, wy, wz); return b === -1 || (B[b] && B[b].opaque); }

    /* ── terrain generation ─────────────────────────────────── */
    function caveAt(wx, y, wz) {
        if (wtFlat()) return false;   // a superflat world is four layers; there is nowhere to put a cave
        if (y < 4) return false;
        var n = noise3(wx / 26, y / 18, wz / 26);
        if (n > 0.44 && n < 0.56) return true;                                    // spaghetti
        return y < 38 && noise3(wx / 44 + 100, y / 30, wz / 44 - 60) > 0.72;      // caverns
    }
    function genChunk(cx, cz) {
        var c = { cx: cx, cz: cz, bl: new Uint8Array(CW * CH * CW), sky: new Uint8Array(CW * CH * CW), blk: new Uint8Array(CW * CH * CW), mesh: null, dirty: true };
        var bl = c.bl, lx, lz, y, wx, wz;
        for (lx = 0; lx < CW; lx++) for (lz = 0; lz < CW; lz++) {
            wx = cx * CW + lx; wz = cz * CW + lz;
            var h = heightAt(wx, wz), bio = biomeAt(wx, wz);
            for (y = 0; y <= h; y++) {
                var id;
                if (y === 0 || (y <= 2 && hash3(wx, y, wz) < 0.5)) id = BEDROCK;
                else if (caveAt(wx, y, wz)) id = y < 11 ? LAVA : AIR;
                else if (y > h - 4 && bio === 2) id = SAND;
                else if (y === h) id = h < SEA + 2 && h >= SEA - 1 ? SAND : (bio === 3 && h > SNOWY) ? SNOWGRASS : GRASS;
                else if (y > h - 4) id = DIRT;
                else id = STONE;
                bl[lx | (lz << 4) | (y << 8)] = id;
            }
            // lakes fill the low ground — but a superflat world sits below sea level by
            // design and flooding it would drown every one of its four layers
            if (!wtFlat()) for (y = h + 1; y <= SEA; y++) bl[lx | (lz << 4) | (y << 8)] = WATER;
            // cave mouths eat the surface: whatever is now the top solid gets grass back
            if (bl[lx | (lz << 4) | (h << 8)] === AIR) {
                for (y = h - 1; y > 2; y--) {
                    var t = bl[lx | (lz << 4) | (y << 8)];
                    if (t === DIRT) { bl[lx | (lz << 4) | (y << 8)] = GRASS; break; }
                    if (t !== AIR) break;
                }
            }
            // decor — only on dry land (never overwrite the water column of a submerged grass floor)
            var top = bl[lx | (lz << 4) | (h << 8)];
            var a1 = lx | (lz << 4) | ((h + 1) << 8);
            if (h < CH - 4 && bl[a1] === AIR) {
                var d = hash2(wx * 3 + 41, wz * 3 - 89);
                if (top === GRASS) {
                    if (d < 0.055) bl[a1] = TALLGRASS;
                    else if (d < 0.063) bl[a1] = hash2(wx, wz + 999) < 0.5 ? DANDELION : POPPY;
                    else if (d < 0.066) bl[a1] = hash2(wx + 7, wz - 3) < 0.62 ? MUSHROOM : MUSHROOM_R;
                    else if (d > 0.9955 && bio === 1) bl[a1] = hash2(wx - 5, wz + 11) < 0.55 ? PUMPKIN : MELON;
                } else if (top === SAND && bio === 2 && d < 0.011) {
                    var chh = 1 + (hash2(wx + 3, wz + 5) * 3 | 0);
                    for (var cc = 0; cc < chh && h + 1 + cc < CH; cc++) bl[lx | (lz << 4) | ((h + 1 + cc) << 8)] = CACTUS;
                }
                /* Sugar cane grows on grass/sand/dirt beside water. "Beside
                   water" is a neighbouring column below sea level — which in a
                   superflat world is EVERY column, since the ground sits at 4
                   and the sea that would have filled it is never placed. Ask
                   whether this world has a sea at all first, or the flat world
                   comes up carpeted in cane. */
                if (!wtFlat() && bl[a1] === AIR && (top === GRASS || top === SAND || top === DIRT) && hash2(wx * 5 - 17, wz * 5 + 23) < 0.05) {
                    if (heightAt(wx + 1, wz) < SEA || heightAt(wx - 1, wz) < SEA || heightAt(wx, wz + 1) < SEA || heightAt(wx, wz - 1) < SEA) {
                        var sh = 1 + (hash2(wx + 9, wz - 9) * 3 | 0);
                        for (var su = 0; su < sh && h + 1 + su < CH; su++) bl[lx | (lz << 4) | ((h + 1 + su) << 8)] = SUGARCANE;
                    }
                }
            }
            // clay patches on shallow lakebeds
            if (h < SEA && h > SEA - 5 && top !== BEDROCK && (top === DIRT || top === GRASS || top === SAND) && noise2(wx / 11 + 300, wz / 11 - 120) > 0.75) {
                bl[lx | (lz << 4) | (h << 8)] = CLAY;
            }
        }
        // ores: deterministic blobs, truncated at borders
        var org = mulb((Math.imul(cx, 341873128) + Math.imul(cz, 132897987) + S.seed) | 0);
        function blobs(n, id, ymin, ymax, size) {
            for (var i = 0; i < n; i++) {
                var x = (org() * CW) | 0, z = (org() * CW) | 0, yy = ymin + (org() * (ymax - ymin)) | 0;
                for (var s = 0; s < size; s++) {
                    if (x >= 0 && x < CW && z >= 0 && z < CW && yy > 2 && yy < CH) {
                        var ii = x | (z << 4) | (yy << 8);
                        if (bl[ii] === STONE) bl[ii] = id;
                    }
                    var dir = (org() * 6) | 0;
                    if (dir === 0) x++; else if (dir === 1) x--; else if (dir === 2) z++; else if (dir === 3) z--; else if (dir === 4) yy++; else yy--;
                }
            }
        }
        if (!wtFlat()) {   // there is no stone in a superflat world for an ore to replace
            blobs(14, ORE_COAL, 5, 70, 7);
            blobs(8, ORE_IRON, 5, 48, 5);
            blobs(3, ORE_GOLD, 5, 24, 4);
            blobs(5, ORE_RED, 5, 16, 6);
            if (org() < 0.6) blobs(1, ORE_LAPIS, 5, 30, 5);
            if (org() < 0.7) blobs(1, ORE_DIA, 5, 14, 4);
        }
        if (org() < 0.25) blobs(1, GRAVEL, 8, 50, 9);
        if (biomeAt(cx * CW + 8, cz * CW + 8) === 3 && org() < 0.5) blobs(1, ORE_EMERALD, 20, 70, 2);   // emeralds hide in the mountains
        // trees: anchors up to 2 out-of-chunk still drop leaves in ours
        for (wx = cx * CW - 2; wx < cx * CW + CW + 2; wx++) for (wz = cz * CW - 2; wz < cz * CW + CW + 2; wz++) {
            var th = treeAt(wx, wz);
            if (!th) continue;
            var gh = heightAt(wx, wz);
            if (caveAt(wx, gh, wz)) continue;   // no trees over a cave mouth
            // dirt under the trunk (vanilla): otherwise the buried grass slowly converts at runtime,
            // spamming relights and junk save edits for terrain nobody touched
            if (Math.floor(wx / CW) === cx && Math.floor(wz / CW) === cz && gh >= 0 && gh < CH) {
                var bui = (wx & 15) | ((wz & 15) << 4) | (gh << 8);
                if (bl[bui] === GRASS || bl[bui] === SNOWGRASS) bl[bui] = DIRT;
            }
            for (var dy = 0; dy <= th + 1; dy++) {
                var ty = gh + 1 + dy;
                if (ty >= CH) break;
                if (dy < th) put(wx, ty, wz, LOG);
                if (dy >= th - 2) {
                    var r = dy > th - 1 ? 1 : 2;
                    for (var ox = -r; ox <= r; ox++) for (var oz = -r; oz <= r; oz++) {
                        if (ox === 0 && oz === 0 && dy < th) continue;
                        if (Math.abs(ox) === r && Math.abs(oz) === r && hash3(wx + ox, ty, wz + oz) < 0.5) continue;   // clipped corners
                        put(wx + ox, ty, wz + oz, LEAVES);
                    }
                }
            }
        }
        function put(x, y, z, id) {
            if (Math.floor(x / CW) !== cx || Math.floor(z / CW) !== cz || y < 0 || y >= CH) return;
            var ii = (x & 15) | ((z & 15) << 4) | (y << 8);
            if (bl[ii] === AIR || (id === LOG && bl[ii] === LEAVES) || (id === LOG && (bl[ii] === TALLGRASS || bl[ii] === DANDELION || bl[ii] === POPPY))) bl[ii] = id;
        }
        // replay this column's saved edits
        var ed = S.edits[ckey(cx, cz)];
        if (ed) for (var k in ed) bl[k | 0] = ed[k];
        c.sunF = new Uint8Array(CW * CW);
        RT.chunks[ckey(cx, cz)] = c;
        chunkCacheDrop();
        return c;
    }

    /* ── light: sky + block channels, flood-filled ──────────── */
    // passage cost through a translucent block (opaque kills light entirely)
    function lightCost(b) { return b === WATER ? 3 : b === LEAVES ? 2 : 1; }
    // top-down sun pass for one column; records the column's "sun floor" (lowest y
    // that still holds full 15) and pushes attenuated (water/leaf-filtered) cells as seeds
    function skyColumn(c, lx, lz, seeds) {
        var v = 15, sf = 0, wx = c.cx * CW + lx, wz = c.cz * CW + lz;
        for (var y = CH - 1; y >= 0; y--) {
            var b = c.bl[lx | (lz << 4) | (y << 8)];
            if (b !== AIR) {
                if (B[b] && B[b].opaque) v = 0;
                else if (b === WATER) v = Math.max(0, v - 3);
                else if (b === LEAVES) v = Math.max(0, v - 2);
            }
            if (v < 15 && !sf) sf = y + 1;
            if (seeds && v > 1 && v < 15) seeds.push(wx, y, wz);
            c.sky[lx | (lz << 4) | (y << 8)] = v;
        }
        c.sunF[lx | (lz << 4)] = sf;
    }
    function colSunF(wx, wz) {   // a column's sun floor; unloaded columns spread nothing
        var c = chunkAt(wx, wz);
        return c ? c.sunF[(wx & 15) | ((wz & 15) << 4)] : -1;
    }
    // frontier seeds for one column: its full-sun cells that sit beside a shadowed column
    function skyFrontierCol(c, lx, lz, qs) {
        var sfA = c.sunF[lx | (lz << 4)], wx = c.cx * CW + lx, wz = c.cz * CW + lz;
        for (var d = 0; d < 4; d++) {
            var sfB = colSunF(wx + (d === 0 ? 1 : d === 1 ? -1 : 0), wz + (d === 2 ? 1 : d === 3 ? -1 : 0));
            if (sfB < 0) continue;
            for (var y = sfA; y < sfB && y < CH; y++) qs.push(wx, y, wz);
        }
    }
    function blkSeeds(c, qb) {   // light-emitting blocks (lava, torches, lit furnaces)
        for (var y = 0; y < CH; y++) for (var lz = 0; lz < CW; lz++) for (var lx = 0; lx < CW; lx++) {
            var i = lx | (lz << 4) | (y << 8), b = c.bl[i];
            if (B[b] && B[b].lite) {
                if (c.blk[i] < B[b].lite) c.blk[i] = B[b].lite;
                qb.push(c.cx * CW + lx, y, c.cz * CW + lz);
            }
        }
    }
    function lightSpread(queue, chan, touched) {   // BFS across loaded chunks; only ever brightens
        var qi = 0, isSky = chan === 'sky';
        while (qi < queue.length) {
            var wx = queue[qi], wy = queue[qi + 1], wz = queue[qi + 2]; qi += 3;
            var c0 = chunkAt(wx, wz); if (!c0) continue;
            var v = c0[chan][lidx(wx, wy, wz)];
            if (v <= 1) continue;
            for (var d = 0; d < 6; d++) {
                var nx = wx + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = wy + (d === 2 ? 1 : d === 3 ? -1 : 0), nz = wz + (d === 4 ? 1 : d === 5 ? -1 : 0);
                if (ny < 0 || ny >= CH) continue;
                var c = chunkAt(nx, nz); if (!c) continue;
                var ni = lidx(nx, ny, nz), nb = c.bl[ni];
                if (B[nb] && B[nb].opaque) continue;
                var cost = lightCost(nb);
                var nv = (isSky && d === 3 && v === 15 && cost === 1) ? 15 : v - cost;
                if (nv > c[chan][ni]) {
                    c[chan][ni] = nv;
                    if (touched) touched[c.cx + ',' + c.cz] = 1;
                    queue.push(nx, ny, nz);
                }
            }
        }
    }
    function lightInitAll() {   // once, after the spawn area generates
        var q = { s: [], b: [] }, k, c, lx, lz;
        for (k in RT.chunks) {
            c = RT.chunks[k];
            for (lx = 0; lx < CW; lx++) for (lz = 0; lz < CW; lz++) skyColumn(c, lx, lz, q.s);
        }
        for (k in RT.chunks) {
            c = RT.chunks[k];
            for (lx = 0; lx < CW; lx++) for (lz = 0; lz < CW; lz++) skyFrontierCol(c, lx, lz, q.s);
            blkSeeds(c, q.b);
        }
        lightSpread(q.s, 'sky'); lightSpread(q.b, 'blk');
    }
    function lightNewChunk(c) {   // a freshly walked-into chunk: light it + let borders flow both ways
        var q = { s: [], b: [] }, lx, lz, y, i;
        for (lx = 0; lx < CW; lx++) for (lz = 0; lz < CW; lz++) skyColumn(c, lx, lz, q.s);
        for (lx = 0; lx < CW; lx++) for (lz = 0; lz < CW; lz++) skyFrontierCol(c, lx, lz, q.s);
        // ...and the ring of neighbor columns facing us re-checks its frontier too
        var x0 = c.cx * CW, z0 = c.cz * CW;
        for (i = 0; i < CW; i++) {
            var ring = [[x0 - 1, z0 + i], [x0 + CW, z0 + i], [x0 + i, z0 - 1], [x0 + i, z0 + CW]];
            for (var r = 0; r < 4; r++) {
                var nc = chunkAt(ring[r][0], ring[r][1]);
                if (nc) skyFrontierCol(nc, ring[r][0] & 15, ring[r][1] & 15, q.s);
            }
        }
        blkSeeds(c, q.b);
        for (y = 0; y < CH; y++) for (i = 0; i < CW; i++) {   // neighbor border cells: torchlight flows in
            q.b.push(x0 - 1, y, z0 + i, x0 + CW, y, z0 + i, x0 + i, y, z0 - 1, x0 + i, y, z0 + CW);
        }
        lightSpread(q.s, 'sky'); lightSpread(q.b, 'blk');
    }
    // an edit relights a full-height box around it (sun shadows reach the floor), boundary values as seeds
    function relight(ex, ez) {
        var R = 15, x0 = ex - R, x1 = ex + R, z0 = ez - R, z1 = ez + R, wx, wz, y;
        var touched = {}, q = { s: [], b: [] };
        for (wx = x0; wx <= x1; wx++) for (wz = z0; wz <= z1; wz++) {   // wipe + fresh sun columns
            var c = chunkAt(wx, wz); if (!c) continue;
            touched[ckey(c.cx, c.cz)] = 1;
            var lx = wx & 15, lz = wz & 15;
            skyColumn(c, lx, lz, q.s);
            for (y = 0; y < CH; y++) c.blk[lx | (lz << 4) | (y << 8)] = 0;
        }
        for (wx = x0; wx <= x1; wx++) for (wz = z0; wz <= z1; wz++) {
            var cc = chunkAt(wx, wz); if (!cc) continue;
            skyFrontierCol(cc, wx & 15, wz & 15, q.s);
            for (y = 0; y < CH; y++) {
                var i = lidx(wx, y, wz), b = cc.bl[i];
                if (B[b] && B[b].lite) { cc.blk[i] = B[b].lite; q.b.push(wx, y, wz); }
            }
        }
        for (y = 0; y < CH; y++) {   // the box border: existing outside light flows back in
            for (wx = x0 - 1; wx <= x1 + 1; wx++) { q.s.push(wx, y, z0 - 1, wx, y, z1 + 1); q.b.push(wx, y, z0 - 1, wx, y, z1 + 1); }
            for (wz = z0; wz <= z1; wz++) { q.s.push(x0 - 1, y, wz, x1 + 1, y, wz); q.b.push(x0 - 1, y, wz, x1 + 1, y, wz); }
        }
        lightSpread(q.s, 'sky'); lightSpread(q.b, 'blk');
        for (var k in touched) dirtyChunk(k);
    }
    // incremental single-edit lighting: unlight BFS carrying old values, then re-spread.
    // ~100x cheaper than the box relight — mining must not hitch.
    function lightEdit(wx, wy, wz, newB) {
        var touched = {};
        var cEdit = chunkAt(wx, wz);
        if (!cEdit) return touched;
        var i0 = lidx(wx, wy, wz);
        for (var ci = 0; ci < 2; ci++) {
            var chan = ci === 0 ? 'sky' : 'blk', isSky = ci === 0;
            var oldV = cEdit[chan][i0], own = 0;
            if (!isSky && B[newB] && B[newB].lite) own = B[newB].lite;
            if (isSky && !(B[newB] && B[newB].opaque)) {
                var above = wy + 1 >= CH ? 15 : getSky(wx, wy + 1, wz);
                if (above === 15 && lightCost(newB) === 1) own = 15;   // the sun falls straight through
            }
            cEdit[chan][i0] = own;
            touched[cEdit.cx + ',' + cEdit.cz] = 1;
            var relQ = [];
            if (oldV > own) {
                var unQ = [wx, wy, wz, oldV], qi = 0;
                while (qi < unQ.length) {
                    var ux = unQ[qi], uy = unQ[qi + 1], uz = unQ[qi + 2], uv = unQ[qi + 3]; qi += 4;
                    for (var d = 0; d < 6; d++) {
                        var nx = ux + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = uy + (d === 2 ? 1 : d === 3 ? -1 : 0), nz = uz + (d === 4 ? 1 : d === 5 ? -1 : 0);
                        if (ny < 0 || ny >= CH) continue;
                        var c = chunkAt(nx, nz); if (!c) continue;
                        var ni = lidx(nx, ny, nz), nv = c[chan][ni];
                        if (nv === 0) continue;
                        // full sun below full sun rode the free downward pass: it dies with its parent
                        if (nv < uv || (isSky && d === 3 && nv === 15 && uv === 15)) {
                            c[chan][ni] = 0;
                            touched[c.cx + ',' + c.cz] = 1;
                            unQ.push(nx, ny, nz, nv);
                        } else relQ.push(nx, ny, nz);   // a surviving brighter neighbor re-floods the hole
                    }
                }
            }
            if (own > 1) relQ.push(wx, wy, wz);
            for (var d2 = 0; d2 < 6; d2++) {   // a removed block lets every side shine in
                var ax = wx + (d2 === 0 ? 1 : d2 === 1 ? -1 : 0), ay = wy + (d2 === 2 ? 1 : d2 === 3 ? -1 : 0), az = wz + (d2 === 4 ? 1 : d2 === 5 ? -1 : 0);
                if (ay >= 0 && ay < CH && chunkAt(ax, az)) relQ.push(ax, ay, az);
            }
            lightSpread(relQ, chan, touched);
        }
        // keep the column's sun floor honest for future frontier scans
        var lx = wx & 15, lz = wz & 15, sf = 0;
        for (var y2 = CH - 1; y2 >= 0; y2--) if (cEdit.sky[lx | (lz << 4) | (y2 << 8)] < 15) { sf = y2 + 1; break; }
        cEdit.sunF[lx | (lz << 4)] = sf;
        return touched;
    }

    /* ── edits ──────────────────────────────────────────────── */
    function dirtyChunk(k) { var c = RT.chunks[k]; if (c) { c.dirty = true; if (RT.meshQ.indexOf(k) < 0) RT.meshQ.push(k); } }
    function torchSupported(wx, wy, wz) {
        return solidAt(wx, wy - 1, wz) || solidAt(wx + 1, wy, wz) || solidAt(wx - 1, wy, wz) || solidAt(wx, wy, wz + 1) || solidAt(wx, wy, wz - 1);
    }
    function popCross(wx, wy, wz) {   // a plant/torch loses its footing: pop as a real drop, not into the void
        var b = getB(wx, wy, wz);
        if (b <= 0 || !B[b] || !B[b].cross) return;
        var ds = dropFor(b);
        setB(wx, wy, wz, AIR);
        for (var i = 0; i < ds.length; i++) dropItem(wx + 0.5, wy + 0.3, wz + 0.5, ds[i][0], ds[i][1]);
    }
    function popCactus(wx, wy, wz) {   // a cactus segment lost its support: drop it; setB cascades up the column
        if (getB(wx, wy, wz) !== CACTUS) return;
        var ds = dropFor(CACTUS);
        setB(wx, wy, wz, AIR);
        for (var i = 0; i < ds.length; i++) dropItem(wx + 0.5, wy + 0.3, wz + 0.5, ds[i][0], ds[i][1]);
    }
    function setB(wx, wy, wz, id, silent) {
        if (wy < 0 || wy >= CH) return;
        var c = chunkAt(wx, wz); if (!c) return;
        var i = lidx(wx, wy, wz), old = c.bl[i];
        // a freed cell beside or under water floods — no floating water walls, no permanent air bubbles
        if (id === AIR && !silent &&
            (getB(wx, wy + 1, wz) === WATER || getB(wx + 1, wy, wz) === WATER || getB(wx - 1, wy, wz) === WATER ||
             getB(wx, wy, wz + 1) === WATER || getB(wx, wy, wz - 1) === WATER)) id = WATER;
        if (old === id) return;
        c.bl[i] = id;
        var k = ckey(c.cx, c.cz);
        (S.edits[k] = S.edits[k] || {})[i] = id;
        // a furnace toggling lit/unlit keeps its tile entity; only a real removal breaks it
        var wasStation = old === FURN || old === FURN_LIT || old === CHEST || old === CAKE;
        var stillSame = (old === FURN || old === FURN_LIT) && (id === FURN || id === FURN_LIT);
        if (wasStation && !stillSame) tentBreak(wx, wy, wz);
        if (!silent) {
            var touched = lightEdit(wx, wy, wz, id);
            touched[k] = 1;   // border blocks also dirty the neighbor even if light didn't move
            if ((wx & 15) === 0) touched[(c.cx - 1) + ',' + c.cz] = 1; if ((wx & 15) === 15) touched[(c.cx + 1) + ',' + c.cz] = 1;
            if ((wz & 15) === 0) touched[c.cx + ',' + (c.cz - 1)] = 1; if ((wz & 15) === 15) touched[c.cx + ',' + (c.cz + 1)] = 1;
            for (var tk in touched) dirtyChunk(tk);
        }
        var gone = id === AIR || id === WATER;
        // gravity blocks fall; plants above a vanished floor pop as drops
        if ((gone || B[id].cross) && wy + 1 < CH) {
            var above = getB(wx, wy + 1, wz);
            if (above === SAND || above === GRAVEL) fallStart(wx, wy + 1, wz, above);
            // a ladder hangs off the WALL beside it, not the block underneath — only pop it when
            // it has lost every support, or breaking one rung took the whole climb down with it
            else if (gone && above === LADDER) { if (!torchSupported(wx, wy + 1, wz)) popCross(wx, wy + 1, wz); }
            else if (gone && B[above] && B[above].cross) popCross(wx, wy + 1, wz);
            else if (gone && above === CACTUS) popCactus(wx, wy + 1, wz);
        }
        // a wall torch loses its last support
        if (gone) {
            if (getB(wx + 1, wy, wz) === TORCH && !torchSupported(wx + 1, wy, wz)) popCross(wx + 1, wy, wz);
            if (getB(wx - 1, wy, wz) === TORCH && !torchSupported(wx - 1, wy, wz)) popCross(wx - 1, wy, wz);
            if (getB(wx, wy, wz + 1) === TORCH && !torchSupported(wx, wy, wz + 1)) popCross(wx, wy, wz + 1);
            if (getB(wx, wy, wz - 1) === TORCH && !torchSupported(wx, wy, wz - 1)) popCross(wx, wy, wz - 1);
        }
    }
    function fallStart(wx, wy, wz, id) {   // sand/gravel: the whole contiguous column falls at once (one relight, not 2N+1)
        var col = [], top = wy;
        while (top < CH) { var b = getB(wx, top, wz); if (b === SAND || b === GRAVEL) { col.push(b); top++; } else break; }
        // strip top-down: removing bottom-up would re-trigger the gravity hook for the sand still above
        for (var r = col.length - 1; r >= 0; r--) setB(wx, wy + r, wz, AIR, true);
        var y = wy;
        while (y > 0 && !solidAt(wx, y - 1, wz) && getB(wx, y - 1, wz) !== WATER) y--;
        while (y > 0 && getB(wx, y - 1, wz) === WATER) y--;   // sinks through water
        for (var p = 0; p < col.length && y + p < CH; p++) {
            var rest = getB(wx, y + p, wz);
            if (rest > 0 && B[rest] && B[rest].cross) {   // landing on a torch/plant pops it as a drop
                var ds = dropFor(rest);
                for (var di = 0; di < ds.length; di++) dropItem(wx + 0.5, y + p + 0.3, wz + 0.5, ds[di][0], ds[di][1]);
            }
            setB(wx, y + p, wz, col[p], true);
        }
        relight(wx, wz);   // one box pass for the whole column
    }

    /* ── random ticks: growth and decay ─────────────────────── */
    function randomTicks(dt) {
        var keys = RT.ckeys;
        if (!keys.length) return;
        // vanilla pace: ~3 ticks per 16³ section per game tick ≈ 360/s per loaded column (was ~16x too slow)
        RT.rtAcc = (RT.rtAcc || 0) + Math.min(dt, 0.05) * keys.length * 360;
        var budget = RT.rtAcc | 0;
        if (budget > 4000) budget = 4000;
        RT.rtAcc -= budget;
        for (var n = 0; n < budget; n++) {
            var c = RT.chunks[keys[(Math.random() * keys.length) | 0]];
            if (!c) continue;
            var lx = (Math.random() * CW) | 0, lz = (Math.random() * CW) | 0, y = (Math.random() * CH) | 0;
            var i = lx | (lz << 4) | (y << 8), b = c.bl[i];
            var wx = c.cx * CW + lx, wz = c.cz * CW + lz;
            var lit = Math.max(getSky(wx, y, wz), getBlk(wx, y, wz)) >= 9;
            if (b >= WHEAT0 && b < WHEAT3) {
                if (lit && Math.random() < 0.4) setB(wx, y, wz, b + 1);
            } else if (b >= CARROT0 && b < CARROT3) {
                if (lit && Math.random() < 0.4) setB(wx, y, wz, b + 1);
            } else if (b >= POTATO0 && b < POTATO3) {
                if (lit && Math.random() < 0.4) setB(wx, y, wz, b + 1);
            } else if (b === PSTEM || b === MSTEM) {
                // stem matures then throws a fruit onto an adjacent empty dirt/grass/farmland
                if (lit && Math.random() < 0.35) {
                    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]], picked = 0;
                    for (var di = 0; di < 4; di++) {
                        var fx = wx + dirs[di][0], fz = wz + dirs[di][1], gnd = getB(fx, y - 1, fz);
                        if (getB(fx, y, fz) === AIR && (gnd === DIRT || gnd === GRASS || gnd === FARMLAND)) {
                            setB(fx, y, fz, b === PSTEM ? PUMPKIN : MELON); picked = 1; break;
                        }
                    }
                }
            } else if (b === SUGARCANE) {
                // grow up to 3 tall if the cane below has ground and this is the top
                if (getB(wx, y + 1, wz) === AIR && y + 1 < CH && Math.random() < 0.25) {
                    var below = getB(wx, y - 1, wz), below2 = getB(wx, y - 2, wz);
                    var stackH = (below === SUGARCANE ? 1 : 0) + (below === SUGARCANE && below2 === SUGARCANE ? 1 : 0);
                    if (stackH < 2) setB(wx, y + 1, wz, SUGARCANE);
                }
            } else if (b === CACTUS) {
                if (getB(wx, y + 1, wz) === AIR && y + 1 < CH && Math.random() < 0.2) {
                    var cbelow = getB(wx, y - 1, wz), cbelow2 = getB(wx, y - 2, wz);
                    var ch2 = (cbelow === CACTUS ? 1 : 0) + (cbelow === CACTUS && cbelow2 === CACTUS ? 1 : 0);
                    if (ch2 < 2 && !solidAt(wx + 1, y + 1, wz) && !solidAt(wx - 1, y + 1, wz) && !solidAt(wx, y + 1, wz + 1) && !solidAt(wx, y + 1, wz - 1)) setB(wx, y + 1, wz, CACTUS);
                }
            } else if (b === LEAVES) {
                if (!logNear(wx, y, wz)) {
                    setB(wx, y, wz, AIR);
                    if (Math.random() < 0.05) dropItem(wx + 0.5, y + 0.4, wz + 0.5, 'apple', 1);
                    if (Math.random() < 0.02) dropItem(wx + 0.5, y + 0.4, wz + 0.5, 'stick', 1);
                }
            } else if (b === DIRT) {
                if (y + 1 < CH && !opaqueAt(wx, y + 1, wz) && getSky(wx, y + 1, wz) >= 9 && grassNear(wx, y, wz) && Math.random() < 0.3) setB(wx, y, wz, GRASS);
            } else if (b === GRASS || b === SNOWGRASS) {
                if (y + 1 < CH && opaqueAt(wx, y + 1, wz)) setB(wx, y, wz, DIRT);
            } else if (b === FARMLAND) {
                if (y + 1 < CH && solidAt(wx, y + 1, wz)) setB(wx, y, wz, DIRT);
            }
        }
    }
    function logNear(wx, wy, wz) {
        for (var dx = -4; dx <= 4; dx++) for (var dy = -4; dy <= 4; dy++) for (var dz = -4; dz <= 4; dz++) {
            if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 5) continue;
            var b = getB(wx + dx, wy + dy, wz + dz);
            if (b === LOG) return true;
            if (b === -1) return true;   // trunk may sit in an unloaded neighbor: don't decay blind
        }
        return false;
    }
    function grassNear(wx, wy, wz) {
        for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) for (var dz = -1; dz <= 1; dz++) {
            var b = getB(wx + dx, wy + dy, wz + dz);
            if (b === GRASS || b === SNOWGRASS) return true;
        }
        return false;
    }

    /* ── mesher: chunk → interleaved quads ──────────────────── */
    // vertex = x,y,z, u,v, sky,blk, ao, white  (9 floats)
    // faces: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z
    var FACE_N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    var FACE_C = [   // 4 corners each, CCW from outside (±z were wound inward once — sky slivers at every silhouette)
        [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
        [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
        [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
        [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
        [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
        [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]
    ];
    var TS16 = 1 / 16, INSET = 1 / 512;   // half-texel inset stops atlas bleed
    function tileUV(tid) { return [(tid % 16) * TS16, ((tid / 16) | 0) * TS16]; }
    // TEX is [top, bottom, side] (3) or per-face [d0..d5] (6, for directional blocks)
    function texTop(tx) { return tx.length === 6 ? tx[2] : tx[0]; }
    function texSide(tx) { return tx.length === 6 ? tx[0] : tx[2]; }
    function texFace(tx, d) { return tx.length === 6 ? tx[d] : tx[d === 2 ? 0 : d === 3 ? 1 : 2]; }
    function faceUV(d, cr) {   // texture coords per corner, v runs down the tile
        if (d === 2) return [cr[0], cr[2]];
        if (d === 3) return [cr[0], 1 - cr[2]];
        // opposite faces are seen from opposite sides, so +x and -z must flip u to
        // read the same way to an outside viewer (directional tiles: TNT text, table tools)
        if (d === 0) return [1 - cr[2], 1 - cr[1]];
        if (d === 1) return [cr[2], 1 - cr[1]];
        if (d === 5) return [1 - cr[0], 1 - cr[1]];
        return [cr[0], 1 - cr[1]];
    }
    function cornerLight(nx, ny, nz, s1, s2) {   // smooth light: 4-cell average + AO at one vertex
        var o1 = opaqueAt(nx + s1[0], ny + s1[1], nz + s1[2]);
        var o2 = opaqueAt(nx + s2[0], ny + s2[1], nz + s2[2]);
        var oc = o1 && o2;
        var sky = getSky(nx, ny, nz), blk = getBlk(nx, ny, nz), cnt = 1;
        if (!o1) { sky += getSky(nx + s1[0], ny + s1[1], nz + s1[2]); blk += getBlk(nx + s1[0], ny + s1[1], nz + s1[2]); cnt++; }
        if (!o2) { sky += getSky(nx + s2[0], ny + s2[1], nz + s2[2]); blk += getBlk(nx + s2[0], ny + s2[1], nz + s2[2]); cnt++; }
        var o3 = oc || opaqueAt(nx + s1[0] + s2[0], ny + s1[1] + s2[1], nz + s1[2] + s2[2]);
        if (!o3) { sky += getSky(nx + s1[0] + s2[0], ny + s1[1] + s2[1], nz + s1[2] + s2[2]); blk += getBlk(nx + s1[0] + s2[0], ny + s1[1] + s2[1], nz + s1[2] + s2[2]); cnt++; }
        var occ = (o1 ? 1 : 0) + (o2 ? 1 : 0) + (o3 ? 1 : 0);
        return [sky / cnt / 15, blk / cnt / 15, [1, 0.8, 0.65, 0.5][occ]];
    }
    function pushQuad(arr, verts) {   // verts: 4 × [x,y,z,u,v,sky,blk,ao]
        for (var i = 0; i < 4; i++) {
            var v = verts[i];
            arr.push(v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], 0);
        }
    }
    function meshChunk(c) {
        var op = [], cut = [], wat = [], x0 = c.cx * CW, z0 = c.cz * CW;
        for (var y = 0; y < CH; y++) for (var lz = 0; lz < CW; lz++) for (var lx = 0; lx < CW; lx++) {
            var b = c.bl[lx | (lz << 4) | (y << 8)];
            if (!b) continue;
            var wx = x0 + lx, wz = z0 + lz, def = B[b], d, uv0, k;
            if (b === WATER) {
                var above = getB(wx, y + 1, wz);
                var wh = above === WATER ? 1 : 0.875;
                for (d = 0; d < 6; d++) {
                    var wn = getB(wx + FACE_N[d][0], y + FACE_N[d][1], wz + FACE_N[d][2]);
                    if (wn === WATER || wn === -1 || (B[wn] && B[wn].opaque) || (d !== 2 && B[wn] && B[wn].solid)) continue;
                    uv0 = tileUV(TILE.water);
                    var wsky = getSky(wx, y, wz) / 15, wblk = getBlk(wx, y, wz) / 15, wq = [];
                    for (k = 0; k < 4; k++) {
                        var wc = FACE_C[d][k], wy2 = wc[1] === 1 ? wh : 0;
                        var wuv = faceUV(d, wc);
                        wq.push([wx + wc[0], y + wy2, wz + wc[2],
                            uv0[0] + INSET + wuv[0] * (TS16 - 2 * INSET), uv0[1] + INSET + wuv[1] * (TS16 - 2 * INSET),
                            wsky, wblk, 1]);
                    }
                    pushQuad(wat, wq);
                }
                continue;
            }
            if (def.cross) {
                uv0 = tileUV(TEX[b][0]);
                var csky = getSky(wx, y, wz) / 15, cblk = getBlk(wx, y, wz) / 15;
                var diag = [[[0, 0, 0], [1, 0, 1], [1, 1, 1], [0, 1, 0]], [[1, 0, 0], [0, 0, 1], [0, 1, 1], [1, 1, 0]]];
                for (d = 0; d < 2; d++) {
                    var cq = [];
                    for (k = 0; k < 4; k++) {
                        var cc = diag[d][k];
                        cq.push([wx + cc[0], y + cc[1], wz + cc[2],
                            uv0[0] + INSET + (k === 1 || k === 2 ? 1 : 0) * (TS16 - 2 * INSET), uv0[1] + INSET + (1 - cc[1]) * (TS16 - 2 * INSET),
                            csky, cblk, 1]);
                    }
                    pushQuad(cut, cq);
                }
                continue;
            }
            var hgt = def.half ? 0.5 : 1;
            for (d = 0; d < 6; d++) {
                var nx = wx + FACE_N[d][0], ny = y + FACE_N[d][1], nz = wz + FACE_N[d][2];
                var nb = getB(nx, ny, nz);
                if (nb === -1 || (B[nb] && B[nb].opaque)) continue;
                if (!def.opaque && nb === b) continue;                       // glass↔glass, leaves↔leaves inner faces
                if (def.half && d !== 2 && nb !== AIR && B[nb] && B[nb].solid && !B[nb].half) continue;
                // 3-slot TEX is [top, bottom, side]; a 6-slot TEX is per-face [d0..d5], letting
                // directional blocks (furnace/chest) show a front on one face instead of all four
                var tid = TEX[b].length === 6 ? TEX[b][d] : TEX[b][d === 2 ? 0 : d === 3 ? 1 : 2];
                uv0 = tileUV(tid);
                // tangent axes for AO sampling: the two axes perpendicular to the face normal
                var a1 = d < 2 ? 2 : 0;                     // ±x faces: z; else x
                var a2 = d === 2 || d === 3 ? 2 : 1;        // ±y faces: z; else y
                var quad = [], target = def.opaque ? op : cut;
                for (k = 0; k < 4; k++) {
                    var cr = FACE_C[d][k];
                    var s1 = [0, 0, 0], s2 = [0, 0, 0];
                    s1[a1] = cr[a1] * 2 - 1;
                    s2[a2] = cr[a2] * 2 - 1;
                    var L = def.opaque ? cornerLight(nx, ny, nz, s1, s2)
                                       : [getSky(nx, ny, nz) / 15, getBlk(nx, ny, nz) / 15, 1];
                    var fuv = faceUV(d, cr);
                    var vy = cr[1] === 1 ? hgt : 0;
                    var vv = def.half && d !== 2 && d !== 3 ? (cr[1] === 1 ? 0.5 : 1) : fuv[1];
                    quad.push([wx + cr[0], y + vy, wz + cr[2],
                        uv0[0] + INSET + fuv[0] * (TS16 - 2 * INSET), uv0[1] + INSET + vv * (TS16 - 2 * INSET),
                        L[0], L[1], L[2]]);
                }
                pushQuad(target, quad);
            }
        }
        uploadMesh(c, op, cut, wat);
    }

    /* ── tiny mat4 (column-major) ───────────────────────────── */
    function mIdent() { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }
    function mMul(a, b) {
        var o = new Float32Array(16);
        for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++)
            o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
        return o;
    }
    function mPersp(fovY, asp, n, f) {
        var m = new Float32Array(16), t = 1 / Math.tan(fovY / 2);
        m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f);
        return m;
    }
    function mRotX(a) { var m = mIdent(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
    function mRotY(a) { var m = mIdent(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
    function mTrans(x, y, z) { var m = mIdent(); m[12] = x; m[13] = y; m[14] = z; return m; }

    /* ── GL setup ───────────────────────────────────────────── */
    var VS = 'attribute vec3 aPos;attribute vec2 aUv;attribute vec2 aLt;attribute float aAo;attribute float aWh;' +
        'uniform mat4 uMvp;varying vec2 vUv;varying vec2 vLt;varying float vAo;varying float vWh;varying float vD;' +
        'void main(){gl_Position=uMvp*vec4(aPos,1.0);vUv=aUv;vLt=aLt;vAo=aAo;vWh=aWh;vD=gl_Position.w;}';
    var FS = 'precision mediump float;uniform sampler2D uTex;uniform float uDay;uniform vec3 uFogC;' +
        'uniform vec2 uFogR;uniform float uAlpha;varying vec2 vUv;varying vec2 vLt;varying float vAo;varying float vWh;varying float vD;' +
        'void main(){vec4 c=texture2D(uTex,vUv);if(c.a<0.5)discard;' +
        'float l=max(vLt.x*uDay,vLt.y);float b=l/(4.0-3.0*l);b=mix(0.045,1.0,b);' +
        'vec3 rgb=(vWh>1.5?c.rgb*vec3(sin(vWh*6.2831853)*0.5+0.5,1.0,(sin(vWh*6.2831853+4.1887903)+1.0)*0.1)' +
        ':vWh<0.0?mix(c.rgb,vec3(1.0,0.0,0.0),-vWh):mix(c.rgb,vec3(1.0),vWh))*b*vAo;' +
        'float f=smoothstep(uFogR.x,uFogR.y,vD);rgb=mix(rgb,uFogC,f);' +
        'gl_FragColor=vec4(rgb,c.a*uAlpha);}';
    var VS_FLAT = 'attribute vec3 aPos;uniform mat4 uMvp;void main(){gl_Position=uMvp*vec4(aPos,1.0);gl_PointSize=2.0;}';
    var FS_FLAT = 'precision mediump float;uniform vec4 uCol;void main(){gl_FragColor=uCol;}';
    var VS_SKYQ = 'attribute vec3 aPos;attribute vec2 aUv;uniform mat4 uMvp;varying vec2 vUv;void main(){gl_Position=uMvp*vec4(aPos,1.0);vUv=aUv;}';
    var FS_SKYQ = 'precision mediump float;uniform sampler2D uTex;uniform float uA;varying vec2 vUv;' +
        'void main(){vec4 c=texture2D(uTex,vUv);if(c.a<0.4)discard;gl_FragColor=vec4(c.rgb,c.a*uA);}';

    function mkShader(gl, type, src) {
        var sh = gl.createShader(type);
        gl.shaderSource(sh, src); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
        return sh;
    }
    function mkProg(gl, vs, fs) {
        var p = gl.createProgram();
        gl.attachShader(p, mkShader(gl, gl.VERTEX_SHADER, vs));
        gl.attachShader(p, mkShader(gl, gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
        return p;
    }
    var MAXQ = 16380;   // quads per mesh (16-bit indices)
    function glInit(cv) {
        var gl = cv.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true });
        if (!gl) return null;
        var G = { gl: gl, prog: mkProg(gl, VS, FS), flat: mkProg(gl, VS_FLAT, FS_FLAT), skyq: mkProg(gl, VS_SKYQ, FS_SKYQ) };
        G.a = {
            pos: gl.getAttribLocation(G.prog, 'aPos'), uv: gl.getAttribLocation(G.prog, 'aUv'),
            lt: gl.getAttribLocation(G.prog, 'aLt'), ao: gl.getAttribLocation(G.prog, 'aAo'), wh: gl.getAttribLocation(G.prog, 'aWh')
        };
        G.u = {
            mvp: gl.getUniformLocation(G.prog, 'uMvp'), tex: gl.getUniformLocation(G.prog, 'uTex'),
            day: gl.getUniformLocation(G.prog, 'uDay'), fogC: gl.getUniformLocation(G.prog, 'uFogC'),
            fogR: gl.getUniformLocation(G.prog, 'uFogR'), alpha: gl.getUniformLocation(G.prog, 'uAlpha')
        };
        G.uf = { mvp: gl.getUniformLocation(G.flat, 'uMvp'), col: gl.getUniformLocation(G.flat, 'uCol'), pos: gl.getAttribLocation(G.flat, 'aPos') };
        G.us = { mvp: gl.getUniformLocation(G.skyq, 'uMvp'), tex: gl.getUniformLocation(G.skyq, 'uTex'), a: gl.getUniformLocation(G.skyq, 'uA'), pos: gl.getAttribLocation(G.skyq, 'aPos'), uv: gl.getAttribLocation(G.skyq, 'aUv') };
        // atlas
        G.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, G.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ATLAS);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // shared quad index buffer
        var idx = new Uint16Array(MAXQ * 6);
        for (var q = 0; q < MAXQ; q++) {
            idx[q * 6] = q * 4; idx[q * 6 + 1] = q * 4 + 1; idx[q * 6 + 2] = q * 4 + 2;
            idx[q * 6 + 3] = q * 4; idx[q * 6 + 4] = q * 4 + 2; idx[q * 6 + 5] = q * 4 + 3;
        }
        G.ebo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, G.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
        G.dyn = gl.createBuffer();      // per-frame entity + hand geometry
        G.lineB = gl.createBuffer();    // block outline
        G.starB = null; G.starN = 0;
        G.cloudB = null; G.cloudN = 0;
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        return G;
    }
    function mkVbo(gl, arr) {
        var b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
        return b;
    }
    function uploadMesh(c, op, cut, wat) {
        var gl = RT.G.gl;
        if (window.__mcKeepArrays) { c.dbgOp = op.slice(); c.dbgCut = cut.slice(); }
        if (c.mesh) { gl.deleteBuffer(c.mesh.op.b); gl.deleteBuffer(c.mesh.cut.b); gl.deleteBuffer(c.mesh.wat.b); }
        function cap(a) { return a.length / 36 > MAXQ ? a.slice(0, MAXQ * 36) : a; }
        op = cap(op); cut = cap(cut); wat = cap(wat);
        c.mesh = {
            op: { b: mkVbo(gl, op), n: op.length / 36 * 6 },
            cut: { b: mkVbo(gl, cut), n: cut.length / 36 * 6 },
            wat: { b: mkVbo(gl, wat), n: wat.length / 36 * 6 }
        };
        c.dirty = false;
    }
    function bindMain(G, vbo) {
        var gl = G.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.vertexAttribPointer(G.a.pos, 3, gl.FLOAT, false, 36, 0);
        gl.vertexAttribPointer(G.a.uv, 2, gl.FLOAT, false, 36, 12);
        gl.vertexAttribPointer(G.a.lt, 2, gl.FLOAT, false, 36, 20);
        gl.vertexAttribPointer(G.a.ao, 1, gl.FLOAT, false, 36, 28);
        gl.vertexAttribPointer(G.a.wh, 1, gl.FLOAT, false, 36, 32);
        gl.enableVertexAttribArray(G.a.pos); gl.enableVertexAttribArray(G.a.uv);
        gl.enableVertexAttribArray(G.a.lt); gl.enableVertexAttribArray(G.a.ao); gl.enableVertexAttribArray(G.a.wh);
    }

    /* ── sky state: time → colors, sun angle ────────────────── */
    function skyState() {
        var day = S.t < DAY_MS;
        var a = day ? (S.t / DAY_MS) : ((S.t - DAY_MS) / NIGHT_MS);   // 0..1 across the current half
        var elev = Math.sin(a * Math.PI);                              // sun (or moon) height
        var sunE = day ? elev : -elev;
        function ss(e0, e1, v) { var t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); }
        var dayF = 0.22 + 0.78 * ss(-0.06, 0.18, sunE);
        var mixd = ss(-0.1, 0.22, sunE);
        var r = 0.015 + (0.47 - 0.015) * mixd, g = 0.02 + (0.65 - 0.02) * mixd, b2 = 0.06 + (1.0 - 0.06) * mixd;
        var glow = Math.max(0, 0.5 - Math.abs(sunE - 0.02) * 5);       // dawn/dusk band
        r += glow * 0.45; g += glow * 0.16;
        if (S.weather >= 1) {   // storms grey the sky and dim the daylight
            var dim = S.weather === 2 ? 0.45 : 0.62;
            dayF *= dim; var grey = 0.35;
            r = r * (1 - grey) + 0.28 * grey * dim; g = g * (1 - grey) + 0.3 * grey * dim; b2 = b2 * (1 - grey) + 0.34 * grey * dim;
        }
        return { day: day, a: a, dayF: dayF, sky: [Math.min(1, r), Math.min(1, g), Math.min(1, b2)], night: 1 - mixd, sunE: sunE, rain: S.weather >= 1 };
    }

    /* ── frame draw ─────────────────────────────────────────── */
    function mRotZ(a) { var m = mIdent(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
    var CLOUD_Y = 88;
    function buildSkyGeo(G) {
        var gl = G.gl, srnd = mulb(9021), pts = [], i;
        for (i = 0; i < 220; i++) {
            var t = srnd() * Math.PI * 2, p = Math.acos(srnd() * 2 - 1);
            pts.push(150 * Math.sin(p) * Math.cos(t), 150 * Math.cos(p), 150 * Math.sin(p) * Math.sin(t));
        }
        G.starB = mkVbo(gl, pts); G.starN = pts.length / 3;
        var cl = [], crnd = mulb(4477);
        for (var cx = 0; cx < 64; cx++) for (var cz = 0; cz < 64; cz++) {
            if (crnd() > 0.3) continue;
            var x = (cx - 32) * 12, z = (cz - 32) * 12;
            cl.push(x, CLOUD_Y, z, x + 12, CLOUD_Y, z, x + 12, CLOUD_Y, z + 12, x, CLOUD_Y, z, x + 12, CLOUD_Y, z + 12, x, CLOUD_Y, z + 12);
        }
        G.cloudB = mkVbo(gl, cl); G.cloudN = cl.length / 3;
    }
    function drawSkyQuad(G, pv, dir, tile, size, alpha) {
        var gl = G.gl, uv = tileUV(tile);
        // billboard basis perpendicular to the celestial direction
        var up = [0, 0, 1], rx = dir[1], ry = -dir[0];   // dir × z
        var v = [], corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (var i = 0; i < 4; i++) {
            var cx = corners[i][0] * size, cy = corners[i][1] * size;
            v.push(dir[0] * 100 + rx * cx, dir[1] * 100 + ry * cx + cy * 0, dir[2] * 100 + up[2] * cy,
                uv[0] + (corners[i][0] > 0 ? TS16 : 0), uv[1] + (corners[i][1] > 0 ? 0 : TS16));
        }
        gl.useProgram(G.skyq);
        gl.uniformMatrix4fv(G.us.mvp, false, pv);
        gl.uniform1f(G.us.a, alpha);
        gl.uniform1i(G.us.tex, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, G.dyn);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(G.us.pos, 3, gl.FLOAT, false, 20, 0);
        gl.vertexAttribPointer(G.us.uv, 2, gl.FLOAT, false, 20, 12);
        gl.enableVertexAttribArray(G.us.pos); gl.enableVertexAttribArray(G.us.uv);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, G.ebo);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        gl.disableVertexAttribArray(G.us.uv);
    }
    function drawFrame() {
        var G = RT.G, gl = G.gl, sky = skyState();
        var live = !RT.menu && !!CAM, pt = live ? camPt() : 0;
        var eyeY = S.py + (live ? camEye(pt) : EYE), headIn = getB(Math.floor(S.px), Math.floor(eyeY), Math.floor(S.pz));
        var under = headIn === WATER, inLava = headIn === LAVA;
        var fogC = under ? [0.04, 0.12, 0.4] : inLava ? [0.6, 0.2, 0.05] : sky.sky;
        var fogR = under ? [4, 16] : inLava ? [0.3, 3] : [(VIEW - 1.2) * CW, (VIEW + 0.4) * CW];
        gl.viewport(0, 0, RT.cv.width, RT.cv.height);
        gl.clearColor(fogC[0], fogC[1], fogC[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        /* RT.fov overrides the base entirely — the title screen's panorama is
           rendered at the cube renderer's 85°, not the game's 70°. RT.fovM is
           the sprint stretch, and is 1 whenever nobody is running. */
        /* the options' FOV (vertical, 70 = Normal) times the eased modifier, squeezed
           by death and by water or lava; the bob and the hurt tilt sit between the
           projection and the view, as GameRenderer puts them */
        var fovR = RT.fov ? RT.fov : (optLoad().fov || 70) * Math.PI / 180 * (live ? (CAM.fovO + (CAM.fov - CAM.fovO) * pt) * camFovK(pt) : 1);
        var proj = mPersp(fovR, RT.cv.width / RT.cv.height, 0.08, 260);
        if (live) proj = mMul(proj, emGl(camFx(pt)));
        var rot = mMul(mRotX(S.pitch), mRotY(S.yaw));
        var view = mMul(rot, mTrans(-S.px, -eyeY, -S.pz));
        var pv = mMul(proj, view);
        var pvRot = mMul(proj, rot);   // sky: rotation only
        // celestial sphere
        if (!under && !inLava) {
            gl.depthMask(false);
            gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.tex);
            var ang = sky.a * Math.PI;
            var dir = [Math.cos(ang), Math.sin(ang), 0];
            if (sky.night > 0.05) {   // stars
                gl.useProgram(G.flat);
                gl.uniformMatrix4fv(G.uf.mvp, false, mMul(pvRot, mRotZ(sky.a * 0.4)));
                gl.uniform4f(G.uf.col, 1, 1, 1, sky.night * 0.9);
                gl.bindBuffer(gl.ARRAY_BUFFER, G.starB);
                gl.vertexAttribPointer(G.uf.pos, 3, gl.FLOAT, false, 12, 0);
                gl.enableVertexAttribArray(G.uf.pos);
                gl.drawArrays(gl.POINTS, 0, G.starN);
            }
            drawSkyQuad(G, pvRot, dir, sky.day ? TILE.sun : TILE.moon, sky.day ? 9 : 6, 1);
            gl.disable(gl.BLEND);
            gl.depthMask(true);
        }
        // world
        gl.useProgram(G.prog);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.tex);
        gl.uniform1i(G.u.tex, 0);
        gl.uniform1f(G.u.day, sky.dayF);
        gl.uniform3f(G.u.fogC, fogC[0], fogC[1], fogC[2]);
        gl.uniform2f(G.u.fogR, fogR[0], fogR[1]);
        gl.uniform1f(G.u.alpha, 1);
        gl.uniformMatrix4fv(G.u.mvp, false, pv);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, G.ebo);
        var fx = Math.sin(S.yaw) * Math.cos(S.pitch), fz = -Math.cos(S.yaw) * Math.cos(S.pitch);   // forward (for a cheap behind-cull)
        var k, c, meshes = [];
        for (k in RT.chunks) {
            c = RT.chunks[k];
            if (!c.mesh) continue;
            var dx = c.cx * CW + 8 - S.px, dz = c.cz * CW + 8 - S.pz;
            if (dx * -fx + dz * -fz > 24) continue;   // fully behind the camera
            meshes.push(c);
        }
        var dbg = window.__mcDraw || 0;   // debug pass toggles (QC only; 0 in normal play)
        if (dbg.noCull) gl.disable(gl.CULL_FACE);
        if (!dbg.noOp) for (k = 0; k < meshes.length; k++) { c = meshes[k]; if (c.mesh.op.n) { bindMain(G, c.mesh.op.b); gl.drawElements(gl.TRIANGLES, c.mesh.op.n, gl.UNSIGNED_SHORT, 0); } }
        if (dbg.noCull) gl.enable(gl.CULL_FACE);
        gl.disable(gl.CULL_FACE);
        if (!dbg.noCut) for (k = 0; k < meshes.length; k++) { c = meshes[k]; if (c.mesh.cut.n) { bindMain(G, c.mesh.cut.b); gl.drawElements(gl.TRIANGLES, c.mesh.cut.n, gl.UNSIGNED_SHORT, 0); } }
        gl.enable(gl.CULL_FACE);
        // entities (built by entGeo() into RT.entV this frame)
        if (RT.entV.length && !dbg.noEnt) {
            gl.bindBuffer(gl.ARRAY_BUFFER, G.dyn);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(RT.entV), gl.DYNAMIC_DRAW);
            bindMain(G, G.dyn);
            gl.disable(gl.CULL_FACE);
            gl.drawElements(gl.TRIANGLES, Math.min(RT.entV.length / 36 * 6, MAXQ * 6), gl.UNSIGNED_SHORT, 0);
            gl.enable(gl.CULL_FACE);
        }
        // mining crack + target outline
        if (RT.target && RT.digT > 0 && RT.digAt) {
            var stg = Math.min(9, Math.floor(RT.digT / RT.digNeed * 10) - 1);   // stage (int)(progress x 10) - 1, none below a tenth
            var cr = stg < 0 ? [] : cubeQuads(RT.digAt[0], RT.digAt[1], RT.digAt[2], TILE['crack' + stg]);
            gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1.5, -1.5);
            gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.bindBuffer(gl.ARRAY_BUFFER, G.dyn);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cr), gl.DYNAMIC_DRAW);
            bindMain(G, G.dyn);
            if (cr.length) gl.drawElements(gl.TRIANGLES, cr.length / 36 * 6, gl.UNSIGNED_SHORT, 0);
            gl.disable(gl.BLEND); gl.disable(gl.POLYGON_OFFSET_FILL);
        }
        if (RT.target) {
            var t = RT.target, e = 0.004, x0 = t.x - e, y0 = t.y - e, z0 = t.z - e, x1 = t.x + 1 + e, y1 = t.y + 1 + e, z1 = t.z + 1 + e;
            var L = [x0, y0, z0, x1, y0, z0, x1, y0, z0, x1, y0, z1, x1, y0, z1, x0, y0, z1, x0, y0, z1, x0, y0, z0,
                x0, y1, z0, x1, y1, z0, x1, y1, z0, x1, y1, z1, x1, y1, z1, x0, y1, z1, x0, y1, z1, x0, y1, z0,
                x0, y0, z0, x0, y1, z0, x1, y0, z0, x1, y1, z0, x1, y0, z1, x1, y1, z1, x0, y0, z1, x0, y1, z1];
            gl.useProgram(G.flat);
            gl.uniformMatrix4fv(G.uf.mvp, false, pv);
            gl.uniform4f(G.uf.col, 0, 0, 0, 0.4);   // LevelRenderer's outline: black at alpha 0.4
            gl.bindBuffer(gl.ARRAY_BUFFER, G.lineB);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(L), gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(G.uf.pos, 3, gl.FLOAT, false, 12, 0);
            gl.enableVertexAttribArray(G.uf.pos);
            gl.drawArrays(gl.LINES, 0, 24);
            gl.useProgram(G.prog);
        }
        // water
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(G.prog);
        gl.uniform1f(G.u.alpha, 0.72);
        gl.disable(gl.CULL_FACE);
        if (!dbg.noWater) for (k = 0; k < meshes.length; k++) { c = meshes[k]; if (c.mesh.wat.n) { bindMain(G, c.mesh.wat.b); gl.drawElements(gl.TRIANGLES, c.mesh.wat.n, gl.UNSIGNED_SHORT, 0); } }
        gl.enable(gl.CULL_FACE);
        gl.uniform1f(G.u.alpha, 1);
        // clouds: 2×2 tiles toward the player's side of each wrap boundary, so no seam or bare half-sky ever shows
        if (!under && !inLava && !dbg.noClouds) {
            var drift = (RT.worldMs * 0.0008) % 768;
            gl.useProgram(G.flat);
            gl.uniform4f(G.uf.col, 1, 1, 1, 0.55 * (0.25 + 0.75 * sky.dayF));
            gl.depthMask(false);
            gl.disable(gl.CULL_FACE);
            var cbx = Math.round((S.px - drift) / 768) * 768 + drift;
            var cbz = Math.round(S.pz / 768) * 768;
            var cxs = [cbx, cbx + (S.px >= cbx ? 768 : -768)];
            var czs = [cbz, cbz + (S.pz >= cbz ? 768 : -768)];
            for (var ci = 0; ci < 2; ci++) for (var cj = 0; cj < 2; cj++) {
                gl.uniformMatrix4fv(G.uf.mvp, false, mMul(pv, mTrans(cxs[ci], 0, czs[cj])));
                gl.bindBuffer(gl.ARRAY_BUFFER, G.cloudB);
                gl.vertexAttribPointer(G.uf.pos, 3, gl.FLOAT, false, 12, 0);
                gl.enableVertexAttribArray(G.uf.pos);
                gl.drawArrays(gl.TRIANGLES, 0, G.cloudN);
            }
            gl.enable(gl.CULL_FACE);
            gl.depthMask(true);
        }
        gl.disable(gl.BLEND);
        // first-person hand: own little scene in front of everything
        var hv = handGeo(sky);
        if (hv.length) {
            gl.clear(gl.DEPTH_BUFFER_BIT);
            gl.useProgram(G.prog);
            // the hand keeps the base FOV while the world widens, exactly like the
            // real game — it is the world stretching past you that sells the speed
            gl.uniformMatrix4fv(G.u.mvp, false, mPersp(FOV * camFovK(camPt()), RT.cv.width / RT.cv.height, 0.05, 10));   // 70, whatever the options say
            gl.uniform2f(G.u.fogR, 50, 100);
            gl.bindBuffer(gl.ARRAY_BUFFER, G.dyn);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(hv), gl.DYNAMIC_DRAW);
            bindMain(G, G.dyn);
            gl.disable(gl.CULL_FACE);
            gl.drawElements(gl.TRIANGLES, hv.length / 36 * 6, gl.UNSIGNED_SHORT, 0);
            gl.enable(gl.CULL_FACE);
        }
    }
    function cubeQuads(x, y, z, tid) {   // a full textured cube at fullbright-ish local light (crack decal)
        var out = [], uv0 = tileUV(tid), sk = getSky(x, y, z + 1) / 15, bk = getBlk(x, y, z + 1) / 15;
        for (var d = 0; d < 6; d++) for (var k = 0; k < 4; k++) {
            var cr = FACE_C[d][k], f = faceUV(d, cr);
            out.push(x + cr[0], y + cr[1], z + cr[2],
                uv0[0] + INSET + f[0] * (TS16 - 2 * INSET), uv0[1] + INSET + f[1] * (TS16 - 2 * INSET),
                Math.max(0.6, sk), bk, 1, 0);
        }
        return out;
    }

    /* ── inventory data ─────────────────────────────────────── */
    function itemMaxDur(id) { var d = I[id]; return d ? (d.tool ? d.tool.dur : d.armor ? d.armor.dur : d.dur) : null; }
    function invGive(id, n, dur, enchObj, name) {   // returns the count that didn't fit
        /* Inventory.add: a matching stack with room is topped up in the selected
           slot first, then the off hand, then the rest in order; what is left
           goes into the first empty slot, the hotbar before the backpack */
        var max = stkMax(id), i, s, order = [S.sel, -1];
        for (i = 0; i < 36; i++) if (i !== S.sel) order.push(i);
        if (max > 1 && !enchObj) for (var k = 0; k < order.length && n > 0; k++) {
            s = order[k] < 0 ? S.off : S.inv[order[k]];
            if (s && s.id === id && s.c < max && !s.ench && (s.name || '') === (name || '')) { var add = Math.min(max - s.c, n); s.c += add; n -= add; }
        }
        for (i = 0; i < 36 && n > 0; i++) {
            if (!S.inv[i]) {
                var put = Math.min(max, n);
                S.inv[i] = { id: id, c: put };
                if (dur != null) S.inv[i].dur = dur;
                else { var md = itemMaxDur(id); if (md != null) S.inv[i].dur = md; }
                if (enchObj) S.inv[i].ench = enchObj;
                if (name) S.inv[i].name = name;
                n -= put;
            }
        }
        return n;
    }
    function invCount(id) { var n = 0; for (var i = 0; i < 36; i++) if (S.inv[i] && S.inv[i].id === id) n += S.inv[i].c; return n; }
    function invFree(id) {   // how many of `id` would fit right now (empty slots + partial stacks)
        var max = stkMax(id), free = 0;
        for (var i = 0; i < 36; i++) {
            var s = S.inv[i];
            if (!s) free += max;
            else if (s.id === id && s.dur == null) free += Math.max(0, max - s.c);
        }
        return free;
    }
    function invTake(id, n) {
        for (var i = 0; i < 36 && n > 0; i++) {
            var s = S.inv[i];
            if (s && s.id === id) { var take = Math.min(s.c, n); s.c -= take; n -= take; if (!s.c) S.inv[i] = null; }
        }
    }
    function held() { return S.inv[S.sel]; }
    function useOne() { if (instaBuild()) return; var h = held(); if (h) { h.c--; if (!h.c) S.inv[S.sel] = null; } }
    /* Consume 1 of the held item, hand back one of `id`.
       Creative spends nothing, and the real game splits the two directions:
       FILLING a bucket leaves the empty one in hand and quietly adds the full
       one to your inventory (only if you don't already have it), while
       EMPTYING one leaves the full bucket in hand and hands back nothing at
       all. Pass fill=true for the first kind. */
    function swapHeld(id, fill) {
        if (instaBuild()) {
            if (fill && invCount(id) < 1) invGive(id, 1);
            paintHotbar();
            return;
        }
        var h = held();
        if (h && h.c === 1) S.inv[S.sel] = { id: id, c: 1 };
        else { useOne(); invGive(id, 1); }
        paintHotbar();
    }
    function dirtyAround(x, y, z) {
        var c = chunkAt(x, z); if (!c) return;
        dirtyChunk(c.cx + ',' + c.cz);
        if ((x & 15) === 0) dirtyChunk((c.cx - 1) + ',' + c.cz); if ((x & 15) === 15) dirtyChunk((c.cx + 1) + ',' + c.cz);
        if ((z & 15) === 0) dirtyChunk(c.cx + ',' + (c.cz - 1)); if ((z & 15) === 15) dirtyChunk(c.cx + ',' + (c.cz + 1));
    }
    function obsidianAround(x, y, z) {   // freshly-placed water hardens adjacent lava
        var n = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        for (var i = 0; i < n.length; i++) if (getB(x + n[i][0], y + n[i][1], z + n[i][2]) === LAVA) {
            setB(x + n[i][0], y + n[i][1], z + n[i][2], OBSIDIAN); blockParticles(x + n[i][0], y + n[i][1], z + n[i][2], STONE);
            snd('fizz', 0, x + n[i][0] + 0.5, y + n[i][1] + 0.5, z + n[i][2] + 0.5);   // the hiss of lava going out
        }
    }
    function eatCake(x, y, z) {
        if (S.food >= 20 && !invulnerable()) return;   // a full stomach just refuses; creative bites regardless
        var t = tentAt(x, y, z, 'cake');
        S.food = Math.min(20, S.food + 2); S.sat = Math.min(S.food, S.sat + 0.4);
        t.bites = (t.bites || 0) + 1; snd('eat'); paintVitals(); stat('c', 'eat_cake_slice');
        if (t.bites >= 7) { setB(x, y, z, AIR); }
    }
    function wearHeld(n) {
        var h = held();
        if (!h || h.dur == null) return;
        wearItem(h, n);
        if (h.dur <= 0) { stat('b', h.id); S.inv[S.sel] = null; snd('break'); }
        paintHotbar();
    }
    function wearItem(st, n) {   // unbreaking gives each point a chance to not count
        if (!st || st.dur == null || instaBuild()) return;   // creative tools never wear out
        var u = ench(st, 'unbreaking');
        for (var i = 0; i < n; i++) if (!u || Math.random() < 1 / (u + 1)) st.dur--;
    }

    /* ── player physics ─────────────────────────────────────── */
    var HW = 0.3;
    function boxHits(px, py, pz) {
        var x0 = Math.floor(px - HW), x1 = Math.floor(px + HW);
        var y0 = Math.floor(py), y1 = Math.floor(py + PH - 0.001);
        var z0 = Math.floor(pz - HW), z1 = Math.floor(pz + HW);
        for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++)
            if (solidAt(x, y, z)) return true;
        return false;
    }
    function cactusTouch() {   // pressed against a cactus face (it's solid, so this is the adjacency test)
        var e = HW + 0.05;
        var x0 = Math.floor(S.px - e), x1 = Math.floor(S.px + e);
        // start one cell low so STANDING on a cactus stings too, not just brushing its side
        var y0 = Math.floor(S.py - 0.05), y1 = Math.floor(S.py + PH - 0.001);
        var z0 = Math.floor(S.pz - e), z1 = Math.floor(S.pz + e);
        for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++) if (getB(x, y, z) === CACTUS) return true;
        return false;
    }
    function onLadder() {
        var x0 = Math.floor(S.px - HW), x1 = Math.floor(S.px + HW);
        var y0 = Math.floor(S.py), y1 = Math.floor(S.py + PH - 0.001);
        var z0 = Math.floor(S.pz - HW), z1 = Math.floor(S.pz + HW);
        for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++) { var b = getB(x, y, z); if (b > 0 && B[b] && B[b].climb) return true; }
        return false;
    }
    function inFluid(which) {
        var x0 = Math.floor(S.px - HW), x1 = Math.floor(S.px + HW);
        var y0 = Math.floor(S.py), y1 = Math.floor(S.py + PH - 0.001);
        var z0 = Math.floor(S.pz - HW), z1 = Math.floor(S.pz + HW);
        for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++)
            if (getB(x, y, z) === which) return true;
        return false;
    }
    /* Resolve a collision by landing exactly ON the surface.
       Every collider in this world is a unit cube, so the contact plane is
       always an integer — which means the resting position can be computed
       instead of searched for. The old code backed out in fixed 0.01 steps and
       overshot by up to a centimetre; standing still, gravity pulled the player
       down 0.0089 a frame and the back-out shoved them up 0.010, so a player
       doing nothing at all climbed ~1mm per frame until they cleared the block
       boundary and snapped back down 9mm. That sawtooth rode the camera and
       made the entire world shimmer at this internal resolution.
       `nudge` stays as the fallback for the pathological case — being extruded
       from inside geometry, where there is no single contact plane to snap to. */
    var EPS = 1e-6;
    function nudge(axis, sgn, limit) {
        var g = 0;
        while (boxHits(S.px, S.py, S.pz) && g++ < limit) S[axis] -= sgn * 0.01;
    }
    function resolve(axis, sgn, exact, limit) {
        var was = S[axis];
        S[axis] = exact;
        if (boxHits(S.px, S.py, S.pz)) { S[axis] = was; nudge(axis, sgn, limit); }
    }
    function axisMove(dx, dy, dz) {
        var hit = { x: false, y: false, z: false };
        if (dx) {
            S.px += dx;
            if (boxHits(S.px, S.py, S.pz)) {
                var sx = dx > 0 ? 1 : -1;
                resolve('px', sx, sx > 0 ? Math.floor(S.px + HW) - HW - EPS : Math.floor(S.px - HW) + 1 + HW, 80);
                hit.x = true;
            }
        }
        if (dz) {
            S.pz += dz;
            if (boxHits(S.px, S.py, S.pz)) {
                var sz = dz > 0 ? 1 : -1;
                resolve('pz', sz, sz > 0 ? Math.floor(S.pz + HW) - HW - EPS : Math.floor(S.pz - HW) + 1 + HW, 80);
                hit.z = true;
            }
        }
        if (dy) {
            // sub-step the vertical move: a terminal-velocity frame must not tunnel through a thin floor
            var rem = dy, sy = dy > 0 ? 1 : -1;
            while (rem !== 0 && !hit.y) {
                var stp = Math.abs(rem) > 0.5 ? sy * 0.5 : rem;
                S.py += stp; rem -= stp;
                if (boxHits(S.px, S.py, S.pz)) {
                    // down: feet rest on the top of the row they sank into.
                    // up: head stops just under the row it struck.
                    resolve('py', sy, sy > 0 ? Math.floor(S.py + PH - 0.001) - PH : Math.floor(S.py) + 1, 200);
                    hit.y = true;
                }
            }
        }
        return hit;
    }
    function groundBelow(px, py, pz) {
        var x0 = Math.floor(px - HW), x1 = Math.floor(px + HW), z0 = Math.floor(pz - HW), z1 = Math.floor(pz + HW), y = Math.floor(py - 0.05);
        for (var x = x0; x <= x1; x++) for (var z = z0; z <= z1; z++) if (solidAt(x, y, z)) return true;
        return false;
    }
    function stepPlayer(dt) {
        if (RT.dead || RT.sleep) return;
        // a GUI is open: stop reading movement keys (no walking off ledges while sorting items)
        // but keep gravity + collision live so the body still settles
        var k = (RT.panel || RT.chat) ? EMPTY_KEYS : RT.keys, water = inFluid(WATER), lava = inFluid(LAVA), fluid = water || lava;
        var fwd = (k.w ? 1 : 0) - (k.s ? 1 : 0), str = (k.d ? 1 : 0) - (k.a ? 1 : 0);
        // Shift means "descend" while flying, not "crouch": no sneak speed, no
        // ledge guard, and it does NOT cancel a sprint, so you really can
        // sprint-fly diagonally downward at full tilt.
        var sneak = k.shift && !fluid && !RT.fly;
        // an empty stomach only stops a survival sprint — creative can always run
        RT.sprint = RT.sprint && fwd > 0 && (S.food > 6 || mayFly()) && !sneak;
        var sp = fluid ? SWIM : sneak ? SNEAK : RT.sprint ? SPRINT : WALK;
        if (lava) sp *= 0.45;
        // flight replaces the walk table outright rather than scaling it:
        // 10.89 m/s, doubled while sprinting, and unchanged by the descent
        if (RT.fly) sp = RT.sprint ? FLY_SPRINT : FLY;
        sp *= 1 + 0.2 * effLvl('speed') - 0.15 * effLvl('slowness');   // MC's ±20%/−15% per level
        if (sp < 0.05) sp = 0.05;
        var len = Math.sqrt(fwd * fwd + str * str) || 1;
        var mx = (fwd / len) * Math.sin(S.yaw) + (str / len) * Math.cos(S.yaw);
        var mz = (fwd / len) * -Math.cos(S.yaw) + (str / len) * Math.sin(S.yaw);
        var dx = mx * sp * dt, dz = mz * sp * dt;
        /* Flight is tested FIRST. A flying player is not affected by fluids at
           all in the real game — no buoyancy, no sinking, no lava slowdown —
           and does not grab ladders. With the fluid branch first, flying into a
           lake made you bob helplessly at swim speed. */
        if (RT.fly) {
            /* creative/spectator flight: no gravity, Space rises, Shift sinks,
               and letting go parks you in the air instead of dropping you */
            var climb = (k[' '] ? 1 : 0) - (k.shift ? 1 : 0);
            RT.vy = climb * (isSpectator() ? SPECT_VY : FLY_VY);
            RT.fallY = S.py;
        } else if (fluid) {
            RT.vy += -GRAV * 0.18 * dt;
            if (k[' ']) RT.vy = Math.min(RT.vy + GRAV * 0.5 * dt, lava ? 1.6 : 3.2);
            RT.vy *= Math.pow(0.42, dt * 3);
            if (RT.vy < -2.2) RT.vy = -2.2;
            RT.fallY = S.py;
        } else if (onLadder()) {
            // ladder: grip and climb — up with W/Space, hold with Shift, slow controlled slide otherwise
            RT.vy -= GRAV * dt;
            if (RT.vy < -2) RT.vy = -2;
            if (k.w || k[' ']) RT.vy = 3;
            else if (k.shift) RT.vy = 0;
            RT.fallY = S.py;
        } else {
            RT.vy -= GRAV * dt;
            if (RT.vy < -TERMV) RT.vy = -TERMV;
            if (k[' '] && RT.ground) {
                RT.vy = JUMP * (1 + 0.18 * effLvl('jump_boost'));
                RT.ground = false;
                stat('c', 'jump');
                addExh(RT.sprint ? 0.2 : 0.05);
            }
        }
        if (sneak && RT.ground) {   // sneaking never walks off an edge
            if (dx && !groundBelow(S.px + dx, S.py, S.pz)) dx = 0;
            if (dz && !groundBelow(S.px, S.py, S.pz + dz)) dz = 0;
        }
        var wasGround = RT.ground;
        if (noClip()) {   // spectators are not stopped by anything
            S.px += dx; S.pz += dz; S.py += RT.vy * dt;
            RT.ground = false; RT.fallY = S.py;
            ensureChunks();
            return;
        }
        var hit = axisMove(dx, 0, dz);
        if (hit.x || hit.z) RT.sprint = false;
        var hy = axisMove(0, RT.vy * dt, 0);
        if (hy.y) {
            if (RT.vy < 0) {
                /* Landing. The real game plays the material's FALL sound — a
                   louder, lower footstep — for any drop at all, before it works
                   out whether the drop also hurt. A jump on the spot lands with
                   a thump, and that thump is most of what jumping feels like. */
                if (!wasGround && RT.vy < -3 && !water && !RT.fly) {
                    var lb = getB(Math.floor(S.px), Math.floor(S.py - 0.2), Math.floor(S.pz));
                    if (lb !== AIR && lb !== WATER) snd('land', lb, S.px, S.py, S.pz);
                }
                RT.ground = true;
                var fall = RT.fallY - S.py;
                if (fall >= 2 && !RT.fly) stat('c', 'fall_one_cm', Math.round(fall * 100));   // Player.causeFallDamage counts two blocks and up
                // re-sample fluid at the landing box: a fast fall can plunge through a shallow
                // pond in one frame, so the frame-start `water` misses it
                if (fall > 3.5 && !water && !inFluid(WATER) && rule('fallDamage') && !RT.fly) {
                    var ff = S.armor[3] ? ench(S.armor[3], 'feather') : 0;   // feather falling boots soften the landing
                    var fdmg = Math.floor((fall - 3) * (1 - ff * 0.12));
                    if (fdmg > 0) { hurt(fdmg, null, false, true, null, { m: fall > 5 ? 'fallhigh' : 'fall' }); snd('fall', fdmg); }
                }
                // touching down ends creative flight, exactly like the real game.
                // Spectators never land, so they keep theirs.
                if (RT.fly && !isSpectator()) setFly(false);
                RT.fallY = S.py;
            }
            RT.vy = 0;
        } else if (Math.abs(RT.vy) > 1) RT.ground = false;
        if (!RT.ground && wasGround && RT.vy <= 0) RT.fallY = Math.max(RT.fallY, S.py);
        if (RT.ground) RT.fallY = S.py;
        if (fluid) RT.fallY = S.py;
        addExh(Math.sqrt(dx * dx + dz * dz) * (RT.sprint ? 0.1 : 0.01));
        // head bob drives the hand sway
        // drowning — creative and spectator hold their breath forever, so the
        // bubble row never appears for them
        var headWater = getB(Math.floor(S.px), Math.floor(S.py + EYE), Math.floor(S.pz)) === WATER && !invulnerable();
        RT.eyeWater = headWater;
        if (headWater) {
            var bubs = Math.ceil(S.air);
            S.air -= dt;
            if (S.air <= 0) { S.air = 0; RT.drownT = (RT.drownT || 0) + dt; if (RT.drownT > 1) { RT.drownT = 0; hurt(2, null, false, true, 'drown'); } }
            else if (Math.ceil(S.air) < bubs) snd('bubble', 10 - Math.ceil(S.air));   // a bubble just went out on the HUD, and pops
        } else { S.air = Math.min(10, S.air + dt * 4); RT.drownT = 0; }
        if (lava) { RT.lavaT = (RT.lavaT || 0) + dt; if (RT.lavaT > 0.5) { RT.lavaT = 0; hurt(4, null, false, true, 'fire'); } }
        else RT.lavaT = 0;
        // cactus: touching one hurts
        var fx2 = Math.floor(S.px), fz2 = Math.floor(S.pz), fy2 = Math.floor(S.py + 0.5);
        if (getB(fx2, fy2, fz2) === CACTUS || cactusTouch()) { RT.cactT = (RT.cactT || 0) + dt; if (RT.cactT > 0.5) { RT.cactT = 0; hurt(1, null, false, true, null, { m: 'cactus' }); } }
        else RT.cactT = 0;
        /* Footsteps. Entity.moveDist accumulates the horizontal distance at 0.6×
           and fires a step when it passes the next whole number, so the real
           game takes one step every 1/0.6 blocks — about 2.6 a second at a walk.
           2.2 blocks was nearly half that and it read as a limp.
           Sneaking is quiet in the real game because you move slower, not
           because the sound changes, so nothing special is needed here. */
        if ((dx || dz) && RT.ground) {
            RT.stepD = (RT.stepD || 0) + Math.sqrt(dx * dx + dz * dz) * 0.6;
            if (RT.stepD > 1) { RT.stepD = 0; stepSound(); }
        }
        /* Sprinting kicks dust off whatever you are running over — the tell you
           catch at your feet, the way the real game does it. Flight is excluded
           outright rather than trusted to RT.ground, which goes stale the moment
           you take off: a hovering flight never clears it. */
        if (RT.sprint && RT.ground && !RT.fly && !fluid && (dx || dz)) {
            RT.dustT = (RT.dustT || 0) + dt;
            if (RT.dustT >= 0.05 && RT.parts.length < 260) {
                RT.dustT = 0;
                var ub = getB(Math.floor(S.px), Math.floor(S.py - 0.2), Math.floor(S.pz));
                if (ub > 0 && TEX[ub]) {
                    var duv = tileUV(texSide(TEX[ub]));
                    RT.parts.push({ x: S.px + (Math.random() - 0.5) * PW, y: S.py + 0.1, z: S.pz + (Math.random() - 0.5) * PW,
                        vx: -dx / dt * 0.25, vy: 1.2 + Math.random() * 0.6, vz: -dz / dt * 0.25,
                        life: 0.45 + Math.random() * 0.3, u: duv[0] + Math.random() * TS16 * 0.8, v: duv[1] + Math.random() * TS16 * 0.8, s: 0.06, dim: 0.6 });
                }
            }
        } else RT.dustT = 0;
    }

    /* ── dynamic FOV ────────────────────────────────────────
       The real game never writes "sprinting" on the HUD — it widens the lens
       and eases it back when you stop, and that is the whole indicator. The
       multiplier is the movement-speed attribute over the walking speed,
       averaged with 1 (so sprint's +30% reads as +15% of view), times 1.1 in
       creative flight. Sneaking and swimming slow the *input* rather than the
       attribute, so they leave the lens alone — same as Minecraft. */
    function fovTarget() {
        if (RT.dead || RT.sleep) return 1;
        var ratio = (RT.sprint ? SPRINT / WALK : 1) * (1 + 0.2 * effLvl('speed') - 0.15 * effLvl('slowness'));
        if (ratio < 0) ratio = 0;   // Slowness VII and up would otherwise invert the lens
        var m = (RT.fly ? 1.1 : 1) * (ratio + 1) / 2;
        if (RT.bowT > 0) { var bp = Math.min(RT.bowT, 1); m *= 1 - bp * bp * 0.15; }   // a drawn bow zooms in
        return m < 0.1 ? 0.1 : m > 1.5 ? 1.5 : m;
    }
    function fovTick(dt) {
        // MC closes half the remaining gap every tick; expressed per-second so
        // the ease lands the same at 30fps as at 144
        var t = fovTarget();
        RT.fovM += (t - RT.fovM) * (1 - Math.pow(0.5, Math.min(dt, 0.25) * 20));
        if (Math.abs(t - RT.fovM) < 0.0005) RT.fovM = t;
    }
    // the block under your feet, sampled the way playStepSound samples it
    function groundBlock() {
        var gb = getB(Math.floor(S.px), Math.floor(S.py - 0.2), Math.floor(S.pz));
        return gb === AIR || gb === WATER ? getB(Math.floor(S.px), Math.floor(S.py - 0.7), Math.floor(S.pz)) : gb;
    }
    function stepSound() {
        if (inFluid(WATER)) return;   // you do not have footsteps while you are swimming
        var gb = groundBlock();
        if (gb === AIR || gb === WATER) return;
        snd('step', gb, S.px, S.py + 0.1, S.pz);
    }

    /* ── hunger, health ─────────────────────────────────────── */
    // creative and spectator never tire, so the hunger bar never moves for them
    function addExh(n) { if (!invulnerable()) RT.exh += n; }
    /* ── status effect tick ─────────────────────────────────
       Counts every active effect down and applies the ones with an
       ongoing behaviour. Effects survive in the save, so /effect give
       … 1000000 really does outlast a reload. */
    function effectTick(dt) {
        if (RT.dead) return;
        var any = false, changed = false;
        for (var id in S.eff) {
            if (!Object.prototype.hasOwnProperty.call(S.eff, id)) continue;
            var e = S.eff[id];
            if (!e || typeof e !== 'object') { delete S.eff[id]; changed = true; continue; }
            e.t -= dt;
            if (e.t <= 0) { delete S.eff[id]; changed = true; continue; }
            any = true;
        }
        if (any) {
            var lvl;
            if ((lvl = effLvl('regeneration'))) {
                RT.effRegen = (RT.effRegen || 0) + dt;
                var every = 2.5 / lvl;
                while (RT.effRegen >= every) { RT.effRegen -= every; if (S.hp < 20) { S.hp = Math.min(20, S.hp + 1); changed = true; } }
            }
            if ((lvl = effLvl('saturation'))) { S.food = Math.min(20, S.food + lvl * dt); S.sat = Math.min(20, S.sat + lvl * dt); changed = true; }
            if (effLvl('water_breathing') && S.air < 10) { S.air = 10; changed = true; }
            if ((lvl = effLvl('levitation'))) { RT.vy = lvl * 0.9; RT.fallY = S.py; }
        }
        if (changed) { paintVitals(); paintEffects(); }
        else if (RT.effDirty) { paintEffects(); RT.effDirty = false; }
    }
    function foodTick(dt) {
        if (RT.dead) return;
        while (RT.exh >= 4) {
            RT.exh -= 4;
            if (S.sat > 0) S.sat = Math.max(0, S.sat - 1);
            else S.food = Math.max(0, S.food - 1);
        }
        if (S.food >= 18 && S.hp < 20 && rule('naturalRegeneration')) {
            RT.regenT += dt;
            if (RT.regenT >= 4) { RT.regenT = 0; S.hp = Math.min(20, S.hp + 1); addExh(6); }
        } else RT.regenT = 0;
        if (S.food <= 0) {
            RT.starveT += dt;
            if (RT.starveT >= 4) { RT.starveT = 0; if (S.hp > 1) { hurt(1, null, true, false, null, { m: 'starve' }); } }
        } else RT.starveT = 0;
    }
    function weatherTick(dt) {
        if (rule('doWeatherCycle')) S.wt -= dt;
        if (S.wt <= 0 && rule('doWeatherCycle')) {
            if (S.weather === 0) { S.weather = Math.random() < 0.28 ? (Math.random() < 0.3 ? 2 : 1) : 0; S.wt = S.weather ? 45 + Math.random() * 120 : 180 + Math.random() * 240; }
            else { S.weather = 0; S.wt = 180 + Math.random() * 240; }
        }
        if (S.weather >= 1 && RT.parts.length < 260) {
            var bio = biomeAt(Math.floor(S.px), Math.floor(S.pz)), snow = bio === 3;
            var uv0 = tileUV(snow ? TILE.snow : TILE.rain);
            for (var n = 0; n < 5; n++) {
                var rx = S.px + (Math.random() - 0.5) * 22, rz = S.pz + (Math.random() - 0.5) * 22;
                if (getSky(Math.floor(rx), Math.min(CH - 1, Math.floor(S.py + 9)), Math.floor(rz)) < 10) continue;   // stays outside; roofs shelter you
                RT.parts.push({ x: rx, y: S.py + 8, z: rz, vx: 0, vy: snow ? -2.5 : -16, vz: snow ? (Math.random() - 0.5) : 0, life: snow ? 1.3 : 0.6,
                    u: uv0[0] + TS16 * 0.3, v: uv0[1] + TS16 * 0.3, s: snow ? 0.07 : 0.12, wx: 1 });
            }
            if (S.weather === 2 && Math.random() < dt * 0.03) lightning();
        }
    }
    function lightning() {
        var ang = Math.random() * 6.28, r = 8 + Math.random() * 22;
        var lx = Math.floor(S.px + Math.cos(ang) * r), lz = Math.floor(S.pz + Math.sin(ang) * r);
        if (!chunkAt(lx, lz)) return;
        var ly = CH - 1; while (ly > 2 && !solidAt(lx, ly, lz)) ly--;
        RT.lightning = 0.18; snd('thunder');   // non-positional: the sky is not a point source
        snd('impact', 0, lx + 0.5, ly + 1, lz + 0.5);         // but the strike itself is: the crack where it lands
        boomParticles(lx + 0.5, ly + 1, lz + 0.5, 2);
        for (var i = RT.foes.length - 1; i >= 0; i--) {
            var f = RT.foes[i];
            if (Math.abs(f.x - lx - 0.5) < 3 && Math.abs(f.z - lz - 0.5) < 3) { f.hp -= 8; f.hurtF = 0.3; f.fire = Math.max(f.fire || 0, 5); if (f.hp <= 0) { foeDie(f); RT.foes.splice(i, 1); } }
        }
        if (Math.abs(S.px - lx - 0.5) < 3 && Math.abs(S.pz - lz - 0.5) < 3) hurt(5, null, false, true, null, { m: 'lightning' });
    }
    // kind: 'drown' or 'fire' for the two damage sources with a cry of their own
    /* The death message, CombatTracker's line for whatever dealt the last hit,
       printed in chat and on the death screen */
    var DEATH_MSG = { generic: '%1 died', fall: '%1 hit the ground too hard', fallhigh: '%1 fell from a high place', drown: '%1 drowned',
        lava: '%1 tried to swim in lava', fire: '%1 burned to death', cactus: '%1 was pricked to death', starve: '%1 starved to death',
        lightning: '%1 was struck by lightning', explosion: '%1 blew up', magic: '%1 was killed by magic', kill: '%1 was killed',
        void: '%1 fell out of the world', wall: '%1 suffocated in a wall', mob: '%1 was slain by %2', arrow: '%1 was shot by %2',
        creeper: '%1 was blown up by %2' };
    function deathMsg() {
        var s = RT.lastSrc || { m: 'generic' };
        return (DEATH_MSG[s.m] || DEATH_MSG.generic).replace('%1', 'Steve').replace('%2', s.by || '');
    }
    // src: what dealt it, for the death message ({ m: kind of death, by: who })
    function hurt(n, dir, quiet, bypassArmor, kind, src) {
        if (RT.dead || !(n > 0)) return;   // !(n>0) also rejects NaN
        if (invulnerable()) return;                        // creative and spectator take nothing
        var resist = effLvl('resistance');
        if (resist >= 5) return;                           // Resistance V is full immunity, as in the real game
        if (resist) n = n * (1 - resist * 0.2);
        n = Math.min(99, Math.round(n));
        if (RT.iframe > 0 && !quiet) return;
        RT.iframe = 0.5;
        if (!bypassArmor) {
            var a = armorPoints(), tough = armorTough();
            if (a > 0) {
                var red = Math.min(20, Math.max(a / 5, a - n / (2 + tough / 4))) / 25;   // MC armor formula
                n = Math.round(n * (1 - red));
                for (var i = 0; i < 4; i++) if (S.armor[i]) { wearItem(S.armor[i], 1); if (S.armor[i].dur != null && S.armor[i].dur <= 0) { S.armor[i] = null; snd('break'); } }
                RT.panelDirty = 1;   // durability bars and a shattered piece both show in the panel
            }
        }
        if (dir) { RT.vy = Math.max(RT.vy, 4.5); axisMove(dir[0] * 0.35, 0, dir[1] * 0.35); }   // knockback fires even on a fully-absorbed hit
        if (n <= 0) return;
        RT.lastSrc = src || { m: kind === 'drown' ? 'drown' : kind === 'fire' ? 'lava' : 'generic' };
        stat('c', 'damage_taken', n * 10);
        camHurt(dir);
        S.hp -= n;
        if (!quiet) snd(kind === 'drown' ? 'hurtdrown' : kind === 'fire' ? 'hurtfire' : 'hurt');
        paintVitals();
        if (S.hp <= 0) die();
    }
    function die() {
        S.hp = 0;
        RT.dead = true;
        RT.digT = 0; RT.eatT = 0; RT.bowT = 0;
        S.eff = {}; paintEffects();
        closePanel(true);   // fold cursor + crafting-grid items into the inventory FIRST so they scatter too
        var keep = rule('keepInventory');
        for (var i = 0; i < 36 && !keep; i++) {   // your stuff scatters where you fell
            var s = S.inv[i];
            if (s) dropItem(S.px, S.py + 1, S.pz, s.id, s.c, s.dur, true, s.ench, s.name);
            S.inv[i] = null;
        }
        for (i = 0; i < 4 && !keep; i++) {   // worn armour drops too — you don't respawn still wearing it
            var a = S.armor[i];
            if (a) dropItem(S.px, S.py + 1, S.pz, a.id, a.c, a.dur, true, a.ench, a.name);
            S.armor[i] = null;
        }
        if (S.off && !keep) { dropItem(S.px, S.py + 1, S.pz, S.off.id, S.off.c, S.off.dur, true, S.off.ench, S.off.name); S.off = null; }
        // experience spills out, capped the way the real game caps it
        var spill = keep ? 0 : Math.min(100, 7 * S.xpl);
        if (!keep) { S.xpl = 0; S.xp = 0; }
        if (spill > 0) spawnXp(S.px, S.py + 0.5, S.pz, spill);
        // the bar under the death screen was still showing the gear you just dropped
        paintXp(); paintArmorBar(); paintHotbar();
        S.deaths++;
        // dying mid-sentence left the command line open and focused on top of the
        // death screen, so Respawn handed you back a locked pointer and a WASD that
        // typed into a box you could not see
        closeChat(false);
        unlockCursor();
        if (rule('showDeathMessages') !== false) chatSay(deathMsg());
        stat('c', 'deaths'); S.stats.c.time_since_death = 0;
        if (RT.lastSrc && RT.lastSrc.by) stat('kb', RT.lastSrc.by.toLowerCase());
        showDeath();
        snd('die');
    }
    function respawn() {
        var sp = S.spawn || S.wspawn;
        S.px = sp[0]; S.py = sp[1]; S.pz = sp[2];
        S.hp = 20; S.food = 20; S.sat = 5; S.air = 10; S.score = 0;
        RT.vy = 0; RT.fallY = S.py; RT.dead = false; RT.exh = 0; RT.statPos = null;
        hideDeath();
        ensureChunks(true);
        paintVitals(); paintHotbar();
    }

    /* ── raycast (Amanatides-Woo DDA) ───────────────────────── */
    function look() {   // must agree with the view matrix: V·look = (0,0,-1)
        var cp = Math.cos(S.pitch);
        return [Math.sin(S.yaw) * cp, -Math.sin(S.pitch), -Math.cos(S.yaw) * cp];
    }
    function raycast(fluids) {   // fluids=true also stops on water/lava (bucket scooping)
        var d = look(), ox = S.px, oy = S.py + EYE, oz = S.pz;
        var x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
        var stx = d[0] > 0 ? 1 : -1, sty = d[1] > 0 ? 1 : -1, stz = d[2] > 0 ? 1 : -1;
        var tdx = Math.abs(1 / (d[0] || 1e-9)), tdy = Math.abs(1 / (d[1] || 1e-9)), tdz = Math.abs(1 / (d[2] || 1e-9));
        var tx = (stx > 0 ? x + 1 - ox : ox - x) * tdx;
        var ty = (sty > 0 ? y + 1 - oy : oy - y) * tdy;
        var tz = (stz > 0 ? z + 1 - oz : oz - z) * tdz;
        var px = x, py = y, pz = z, t = 0;
        for (var i = 0; i < 64; i++) {
            px = x; py = y; pz = z;
            if (tx < ty && tx < tz) { x += stx; t = tx; tx += tdx; }
            else if (ty < tz) { y += sty; t = ty; ty += tdy; }
            else { z += stz; t = tz; tz += tdz; }
            if (t > REACH) return null;
            var b = getB(x, y, z);
            if (b > 0 && (fluids || (b !== WATER && b !== LAVA))) return { x: x, y: y, z: z, b: b, px: px, py: py, pz: pz, dist: t };
        }
        return null;
    }

    /* ── mining ─────────────────────────────────────────────── */
    function breakTime(b) {
        var def = B[b];
        if (instaBuild()) return 0;        // creative ignores hardness entirely
        if (def.hard < 0) return Infinity;
        if (def.hard === 0) return 0.05;
        var h = held(), tool = h && I[h.id] && I[h.id].tool;
        var right = tool && def.tool && tool.k === def.tool;
        var mult = right ? tool.mult : 1;
        if (right) { var e = ench(h, 'eff'); if (e > 0) mult += e * e + 1; }   // Efficiency speeds the right tool
        var harvest = !def.tier || (right && tool.tier >= def.tier && tool.k === 'pick');
        return def.hard * (harvest || !def.tier ? 1.5 : 5) / mult;
    }
    function canHarvest(b) {
        var def = B[b];
        if (!def.tier) return true;
        var h = held(), tool = h && I[h.id] && I[h.id].tool;
        return !!(tool && tool.k === 'pick' && tool.tier >= def.tier);
    }
    function dropFor(b, fortune, silk) {
        var def = B[b], n = def.n;
        // silk touch: harvest the block itself where a matching item exists
        if (silk && PLACE2ITEM[b] != null && n !== '' && def.hard >= 0) return [[PLACE2ITEM[b], 1]];
        fortune = fortune || 0;
        var fbonus = fortune > 0 ? 1 + ((Math.random() * (fortune + 1)) | 0) : 1;   // fortune multiplier on ore/crop yields
        if (b === GRAVEL) return Math.random() < Math.min(1, 0.1 + fortune * 0.14) ? [['flint', 1]] : [['gravel', 1]];
        if (b === LEAVES) { var lv = []; if (Math.random() < 0.05 + fortune * 0.02) lv.push(['apple', 1]); if (Math.random() < 0.02) lv.push(['stick', 1]); return lv; }
        if (b === CACTUS) return [['cactus', 1]];
        if (n === '?seeds') return Math.random() < Math.min(1, 0.3 + fortune * 0.1) ? [['seeds', 1]] : [];
        if (n === '?melon') return [['melon_slice', 3 + ((Math.random() * 4) | 0) + (fortune ? (Math.random() * fortune | 0) : 0)]];
        if (n === '?books') return [['book', 3]];
        if (n === '?clay') return [['clay_ball', 4]];
        if (b === WHEAT3) return [['wheat', 1], ['seeds', 1 + ((Math.random() * 2) | 0)]];
        if (b >= WHEAT0 && b < WHEAT3) return [['seeds', 1]];
        if (b === CARROT3) return [['carrot', 2 + ((Math.random() * 2) | 0) + (fortune ? (Math.random() * fortune | 0) : 0)]];
        if (b >= CARROT0 && b < CARROT3) return [['carrot', 1]];
        if (b === POTATO3) return [['potato', 2 + ((Math.random() * 2) | 0) + (fortune ? (Math.random() * fortune | 0) : 0)]];
        if (b >= POTATO0 && b < POTATO3) return [['potato', 1]];
        if (b === PUMPKIN) return [['pumpkin', 1]];
        if (!n || n.charAt(0) === '?') return [];
        if (def.mul) return [[n, def.mul[0] + ((Math.random() * (def.mul[1] - def.mul[0] + 1)) | 0) + (fortune ? (Math.random() * (fortune + 1) | 0) : 0)]];
        // Fortune multiplies ORES ONLY. `def.tier` is not the test — it is also set on stone,
        // cobble, furnaces, brick/sandstone variants, the enchanting table, the anvil and
        // obsidian, so keying off it duplicated all of those (mine an anvil, get three).
        // Iron and gold drop raw ore for smelting and are not multiplied, same as the real game.
        var oreDrop = b === ORE_COAL || b === ORE_DIA || b === ORE_EMERALD;
        return [[n, oreDrop ? fbonus : 1]];
    }
    function breakBlock(x, y, z) {
        var b = getB(x, y, z);
        // hardness is what stops a pickaxe, not what makes a block sacred: creative
        // takes bedrock out too. (y<0 still reads as bedrock, so the floor holds.)
        var creative = instaBuild();
        if (b <= 0 || (B[b].hard < 0 && !creative)) return;
        // creative earns nothing for the swing — no drops, no ore xp, no tool wear
        var harvest = !creative && canHarvest(b);
        var h = held();
        var fortune = ench(h, 'fortune'), silk = ench(h, 'silk');
        snd('dig', b, x + 0.5, y + 0.5, z + 0.5);
        blockParticles(x, y, z, b);
        setB(x, y, z, AIR);
        if (!creative) {   // Block.playerDestroy counts the block; ItemStack.mineBlock counts the tool
            var mid = PLACE2ITEM[b];
            if (mid && I[mid]) stat('m', mid);
            if (h && I[h.id] && I[h.id].tool) stat('u', h.id);
        }
        if (harvest) {
            var ds = dropFor(b, fortune, silk);
            for (var i = 0; i < ds.length; i++) dropItem(x + 0.5, y + 0.3, z + 0.5, ds[i][0], ds[i][1]);
            // ore blocks give experience (unless silk-touched into a block)
            if (B[b].xp && !(silk && PLACE2ITEM[b] != null)) {
                var xr = B[b].xp, amt = xr[0] + ((Math.random() * (xr[1] - xr[0] + 1)) | 0);
                if (amt > 0) spawnXp(x + 0.5, y + 0.5, z + 0.5, amt);
            }
        }
        if (h && I[h.id] && I[h.id].tool && B[b].hard > 0) wearHeld(1);
        addExh(0.005);
        if (b === LOG) {
            if (harvest) unlock('wood');   // the achievement is for HAVING the log, and creative gets none
            // chopping wood schedules the orphaned canopy for a quick decay (random ticks alone take minutes)
            for (var dx = -4; dx <= 4; dx++) for (var dy = -4; dy <= 4; dy++) for (var dz = -4; dz <= 4; dz++) {
                if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 5) continue;
                if (getB(x + dx, y + dy, z + dz) === LEAVES) RT.decayQ.push(x + dx, y + dy, z + dz);
            }
        }
        if (b === ORE_DIA && harvest) unlock('diamonds');
    }
    /* A fresh left-click in creative breaks whatever is under the crosshair at
       once. Holding the button is still rate-limited by RT.digCd — the real
       game's startDestroyBlock ignores the delay while continueDestroyBlock
       obeys it, which is why click-spam out-mines a held button. */
    /* A sword in creative cannot break a block at all — not even a torch. It
       still swings and still hits mobs at full damage; the block behind them is
       simply immune. (SwordItem.canAttackBlock returns !isCreative.) */
    function swordHeld() {
        var h = held();
        return !!(h && I[h.id] && I[h.id].tool && I[h.id].tool.k === 'sword');
    }
    function creativeInstaBreak() {
        if (!instaBuild() || RT.dead || RT.panel || RT.paused || RT.chat) return;
        if (entRay()) return;                  // that was a swing at a mob
        if (swordHeld()) return;
        var t = RT.target;
        if (!t) return;
        breakBlock(t.x, t.y, t.z);
        RT.digT = 0; RT.digAt = null; RT.digCd = CREATIVE_DIG_CD;
    }
    function digTick(dt) {
        if (!RT.mouse.l || RT.dead || RT.panel || RT.paused || RT.chat) { RT.digT = 0; return; }
        var hitEnt = entRay();
        if (hitEnt) { RT.digT = 0; return; }   // swinging at a mob, not a block
        var t = RT.target;
        if (!t) { RT.digT = 0; return; }
        /* Re-time on the block ID and the held item as well as the position.
           Keying on position alone let a stale break time stick: aim at bedrock
           (digNeed = Infinity), have that cell become stone — /setblock, a
           creeper, falling gravel, a crop growing a stage — and the new block
           was unmineable until you looked away and back. Swapping from a fist
           to a pickaxe mid-dig kept the fist's timing for the same reason;
           the real game restarts the swing on both. */
        var hid = (held() && held().id) || '';
        if (!RT.digAt || RT.digAt[0] !== t.x || RT.digAt[1] !== t.y || RT.digAt[2] !== t.z ||
            RT.digAt[3] !== t.b || RT.digAt[4] !== hid) {
            RT.digAt = [t.x, t.y, t.z, t.b, hid]; RT.digT = 0;
            RT.digNeed = breakTime(t.b);
        }
        if (RT.digCd > 0) return;
        RT.digT += dt;
        // holding the button chains swings; it must NOT pin the timer, or the arm
        // sits at phase zero and never actually moves while you mine
        swingArm(false);
        /* The mining tick. Every four ticks the real game plays the block's HIT
           sound: the same material, an eighth of the volume and HALF the pitch.
           It is the sound people actually associate with mining — the file had
           the break and nothing leading up to it, so a two-second obsidian dig
           was completely silent until it wasn't. */
        RT.digSnd = (RT.digSnd || 0) - dt;
        if (RT.digSnd <= 0) { RT.digSnd = 0.2; snd('mine', t.b, t.x + 0.5, t.y + 0.5, t.z + 0.5); }
        if (instaBuild() && swordHeld()) return;   // a creative sword never lands on the block
        if (RT.digT >= RT.digNeed) {
            breakBlock(t.x, t.y, t.z);
            RT.digT = 0; RT.digAt = null;
            RT.digCd = instaBuild() ? CREATIVE_DIG_CD : 0.25;
        }
    }

    /* ── placing / using ────────────────────────────────────── */
    var BREED = { cow: 'wheat', sheep: 'wheat', pig: 'carrot', chicken: 'seeds' };
    function tryUse() {
        if (RT.dead || RT.panel || RT.paused) return;
        var t = RT.target, h = held(), def = h && I[h.id];
        swingArm(true);
        // a mob under the crosshair takes priority (feed / breed / milk)
        var ef = entRay();
        if (ef && h) {
            if (ef.k === 'cow' && !ef.baby && h.id === 'bucket') { if (h.c > 1 && invFree('milk_bucket') < 1) return; swapHeld('milk_bucket', 1); snd('milk', 0, ef.x, ef.y + 0.4, ef.z); return; }
            var food = BREED[ef.k];
            if (food && h.id === food) {
                if (ef.baby > 0) { ef.baby = Math.max(0, ef.baby - 6); heartParticles(ef); useOne(); snd('eat', 0, ef.x, ef.y + ef.h * 0.7, ef.z); paintHotbar(); return; }
                if (ef.mateCd <= 0 && ef.love <= 0) { ef.love = 30; heartParticles(ef); useOne(); snd('eat', 0, ef.x, ef.y + ef.h * 0.7, ef.z); paintHotbar(); return; }
            }
        }
        // interactive blocks come first (sneak-place overrides)
        if (t && !RT.keys.shift) {
            if (t.b === TABLE) { openPanel('table'); return; }
            if (t.b === FURN || t.b === FURN_LIT) { openPanel('furnace', t); return; }
            if (t.b === CHEST) { openPanel('chest', t); return; }
            if (t.b === ETABLE) { openPanel('ench', t); return; }
            if (t.b === ANVIL) { openPanel('anvil', t); return; }
            if (t.b === CAKE) { eatCake(t.x, t.y, t.z); return; }
            if (t.b === BED) { trySleep(); return; }
            // TNT is NOT hand-primeable. It takes flint and steel (handled below with
            // the rest of the tools), a flaming arrow, or another blast — the same
            // three things that set it off in the real game.
        }
        if (!h) return;
        // right-click armor → wear it
        if (def && def.armor && !S.armor[def.armor.slot]) {
            S.armor[def.armor.slot] = { id: h.id, c: 1, dur: h.dur, ench: h.ench, name: h.name };
            S.inv[S.sel] = null; paintHotbar(); paintVitals(); snd('equip', def.armor.tier); unlock('armor'); return;
        }
        // buckets: scoop, pour, and obsidian-forming.
        // The normal target skips fluids (you can't mine water), so scooping needs its own
        // fluid-aware cast — without it a bucket could never be filled, which also made
        // obsidian (water on lava) and therefore the enchanting table unobtainable.
        if (h.id === 'bucket') {
            var ft = raycast(true);
            if (ft && ft.b === WATER) { setB(ft.x, ft.y, ft.z, AIR, true); relight(ft.x, ft.z); dirtyAround(ft.x, ft.y, ft.z); swapHeld('water_bucket', 1); snd('bucketfill', 0, ft.x + 0.5, ft.y + 0.5, ft.z + 0.5); return; }
            if (ft && ft.b === LAVA) { setB(ft.x, ft.y, ft.z, AIR, true); relight(ft.x, ft.z); dirtyAround(ft.x, ft.y, ft.z); swapHeld('lava_bucket', 1); snd('bucketfilllava', 0, ft.x + 0.5, ft.y + 0.5, ft.z + 0.5); return; }
        }
        if ((h.id === 'water_bucket' || h.id === 'lava_bucket') && t) {
            var bx0 = t.px, by0 = t.py, bz0 = t.pz;
            if (getB(bx0, by0, bz0) === AIR) {
                var fluidId = h.id === 'water_bucket' ? WATER : LAVA;
                setB(bx0, by0, bz0, fluidId);
                if (fluidId === WATER) obsidianAround(bx0, by0, bz0);   // water meeting lava hardens it
                // a bucket emptying is water or lava arriving, not a block being set down
                swapHeld('bucket'); snd(fluidId === WATER ? 'bucketempty' : 'bucketemptylava', 0, bx0 + 0.5, by0 + 0.5, bz0 + 0.5); return;
            }
        }
        if (h.id === 'milk_bucket') { swapHeld('bucket'); snd('drink'); snd('burp'); return; }   // drink → empty bucket
        // flint & steel: light TNT
        if (h.id === 'flint_steel' && t && t.b === TNT) { igniteTnt(t.x, t.y, t.z); wearHeld(1); return; }
        // hoe tills
        if (def.tool && def.tool.k === 'hoe' && t && (t.b === GRASS || t.b === DIRT) && getB(t.x, t.y + 1, t.z) === AIR) {
            setB(t.x, t.y, t.z, FARMLAND);
            snd('till', 0, t.x + 0.5, t.y + 0.5, t.z + 0.5); wearHeld(1); unlock('farm');
            return;
        }
        // bonemeal grows crops toward maturity
        if (h.id === 'bonemeal' && t) {
            var grew = null;
            if (t.b >= WHEAT0 && t.b < WHEAT3) grew = Math.min(WHEAT3, t.b + 1 + ((Math.random() * 2) | 0));
            else if (t.b >= CARROT0 && t.b < CARROT3) grew = Math.min(CARROT3, t.b + 1 + ((Math.random() * 2) | 0));
            else if (t.b >= POTATO0 && t.b < POTATO3) grew = Math.min(POTATO3, t.b + 1 + ((Math.random() * 2) | 0));
            if (grew != null) { setB(t.x, t.y, t.z, grew); blockParticles(t.x, t.y, t.z, WHEAT1); useOne(); paintHotbar(); return; }
        }
        // carrots & potatoes are both food and crop: plant on farmland when aimed there, else fall through to eating
        if (def.crop && def.place != null && t && getB(t.px, t.py, t.pz) === AIR && getB(t.px, t.py - 1, t.pz) === FARMLAND) {
            setB(t.px, t.py, t.pz, def.place); stat('u', held().id); useOne(); paintHotbar();
            if (CAM) CAM.mainH = 0;   // Minecraft.startUseItem's itemUsed: the next block rises into the hand snd('place', def.place, t.px + 0.5, t.py + 0.5, t.pz + 0.5); return;
        }
        // spawn eggs drop a mob onto the face you clicked
        if (def.egg && t) {
            if (!MOBS[def.egg] || RT.foes.length >= 64) return;
            var nf = mkFoe(def.egg, t.px + 0.5, t.py, t.pz + 0.5);
            RT.foes.push(nf);
            snd('mob:' + def.egg + ':idle', nf, t.px + 0.5, t.py + 0.5, t.pz + 0.5); useOne(); paintHotbar();
            return;
        }
        // food & bow are hold-to-use (handled in useTick); block placement is instant
        if (def.food || h.id === 'bow') return;
        if (def.place == null || !t) return;
        var bx = t.px, by = t.py, bz = t.pz;
        var cur = getB(bx, by, bz);
        if (B[t.b] && B[t.b].cross) { bx = t.x; by = t.y; bz = t.z; cur = t.b; }   // replace plants directly
        if (cur !== AIR && cur !== WATER && cur !== TALLGRASS) return;
        var id = def.place;
        // support rules
        if (def.crop) { if (getB(bx, by - 1, bz) !== FARMLAND) return; }
        if (id === DANDELION || id === POPPY || id === MUSHROOM || id === MUSHROOM_R) { var u = getB(bx, by - 1, bz); if (u !== GRASS && u !== DIRT && u !== STONE && u !== COBBLE && u !== SNOWGRASS) return; }
        if (id === SUGARCANE) { var us = getB(bx, by - 1, bz); if (us !== GRASS && us !== DIRT && us !== SAND && us !== SUGARCANE) return; }
        if (id === CACTUS) {
            var uc = getB(bx, by - 1, bz); if (uc !== SAND && uc !== CACTUS) return;
            if (solidAt(bx + 1, by, bz) || solidAt(bx - 1, by, bz) || solidAt(bx, by, bz + 1) || solidAt(bx, by, bz - 1)) return;
        }
        if (id === TORCH || id === LADDER) {
            if (!solidAt(bx, by - 1, bz) && !solidAt(bx + 1, by, bz) && !solidAt(bx - 1, by, bz) && !solidAt(bx, by, bz + 1) && !solidAt(bx, by, bz - 1)) return;
        }
        // never inside yourself or a mob
        if (B[id].solid) {
            if (boxOverlapsCell(S.px, S.py, S.pz, HW, PH, bx, by, bz)) return;
            for (var i = 0; i < RT.foes.length; i++) { var f = RT.foes[i]; if (boxOverlapsCell(f.x, f.y, f.z, f.hw, f.h, bx, by, bz)) return; }
        }
        setB(bx, by, bz, id);
        if (id === SAND || id === GRAVEL) { if (!solidAt(bx, by - 1, bz)) fallStart(bx, by, bz, id); }
        if (id === FURN) tentInit(bx, by, bz, 'furnace');
        if (id === CHEST) tentInit(bx, by, bz, 'chest');
        snd('place', id, bx + 0.5, by + 0.5, bz + 0.5);
        if (!instaBuild()) { h.c--; if (!h.c) S.inv[S.sel] = null; }   // creative stacks never run down
        paintHotbar();
        if (id === TABLE) unlock('table');
        if (id === FURN) unlock('furnace');
    }
    function boxOverlapsCell(px, py, pz, hw, hgt, bx, by, bz) {
        return px + hw > bx && px - hw < bx + 1 && py + hgt > by && py < by + 1 && pz + hw > bz && pz - hw < bz + 1;
    }
    /* ── pick block (middle mouse) ───────────────────────────
       Aim at a block and you get the item that places it; aim at a mob and you
       get its spawn egg. Already holding it? Just select that slot. Already own
       it? Pull it up into the hotbar. Otherwise creative conjures one, and
       survival — which may not conjure anything — comes away empty-handed. */
    function pickBlock() {
        if (!RT.ready || RT.dead || RT.panel || RT.paused || RT.chat) return;
        // an entity only yields its egg in creative; survival middle-click on a
        // mob does nothing at all
        var f = instaBuild() ? entRay() : null, id = null, i, s;
        if (f) id = 'egg_' + f.k;
        else if (RT.target) id = PLACE2ITEM[RT.target.b];
        if (id == null || !I[id]) return;
        for (i = 0; i < 9; i++) if (S.inv[i] && S.inv[i].id === id) { S.sel = i; paintHotbar(); return; }
        for (i = 9; i < 36; i++) if (S.inv[i] && S.inv[i].id === id) {   // in the backpack: swap it up
            var swap = S.inv[S.sel];
            S.inv[S.sel] = S.inv[i]; S.inv[i] = swap;
            paintHotbar(); snd('click');
            return;
        }
        if (!instaBuild()) return;
        // an empty hotbar slot wins, scanning forward from the one you're holding
        // and wrapping — the real game reaches for the nearest free finger, not slot 1
        var slot = -1;
        for (i = 0; i < 9; i++) { s = (S.sel + i) % 9; if (!S.inv[s]) { slot = s; break; } }
        if (slot < 0) {
            slot = S.sel;
            var old = S.inv[slot];
            if (old) { S.inv[slot] = null; if (invGive(old.id, old.c, old.dur, old.ench, old.name)) S.inv[slot] = old; }
        }
        if (S.inv[slot]) return;   // nowhere for the displaced stack to go; leave things alone
        var md = itemMaxDur(id);
        S.inv[slot] = { id: id, c: 1 };
        if (md != null) S.inv[slot].dur = md;
        S.sel = slot;
        paintHotbar(); snd('click');
    }
    function useTick(dt) {   // held-down right mouse: eating, bow
        var h = held(), def = h && I[h.id];
        if (!RT.mouse.r || RT.dead || RT.panel || RT.paused || RT.chat || !def) { finishUse(); return; }
        if (def.food) {
            // a full stomach stops a survival meal; creative can always eat (Player.canEat is true for invulnerable)
            if (S.food >= 20 && h.id !== 'flesh' && !invulnerable()) { RT.eatT = 0; return; }
            if (!RT.eatT && CAM) CAM.mainH = 0;   // starting to eat is an item use too
            RT.eatT += dt;
            if (RT.eatT > 0.25 && Math.floor(RT.eatT / 0.3) !== Math.floor((RT.eatT - dt) / 0.3)) snd(def.bowl || h.id === 'milk_bucket' ? 'drink' : 'eat');
            if (RT.eatT >= 1.6) {
                S.food = Math.min(20, S.food + def.food.f);
                S.sat = Math.min(S.food, S.sat + def.food.sat);
                if (def.heal) S.hp = Math.min(20, S.hp + def.heal);   // golden apple heals
                var wasId = h.id, wasBowl = def.bowl;
                stat('u', wasId);
                if (!instaBuild()) { h.c--; if (!h.c) S.inv[S.sel] = null; }
                if (wasBowl && !instaBuild()) invGive('bowl', 1);       // stew leaves the bowl
                RT.eatT = 0; snd('burp');
                paintHotbar(); paintVitals();
                if (wasId === 'bread') unlock('bread');
                if (wasId === 'golden_apple') unlock('gapple');
            }
        } else if (h.id === 'bow') {
            if (invCount('arrow') < 1 && RT.bowT === 0 && !instaBuild()) return;   // creative never runs out of arrows
            // the real bow draws in silence; how far it was drawn is heard in the release
            RT.bowT = Math.min(1, RT.bowT + dt);
        } else if (def.place != null || (def.tool && def.tool.k === 'hoe') || h.id === 'bonemeal') {
            // hold-to-build: repeat placement like the real game (mousedown already fired the first one)
            RT.placeCd -= dt;
            if (RT.placeCd <= 0) { tryUse(); RT.placeCd = 0.22; }
        }
    }
    function finishUse() {
        var hb0 = held(), infinite = (hb0 && hb0.id === 'bow' && ench(hb0, 'infinity') > 0) || instaBuild();
        if (RT.bowT > 0.15 && (invCount('arrow') > 0 || infinite) && !RT.dead && !RT.panel && !RT.paused) {
            var d = look(), pw = RT.bowT;
            if (!infinite) invTake('arrow', 1);
            var pwr = ench(hb0, 'power'), pun = ench(hb0, 'punch'), flm = ench(hb0, 'flame');
            RT.arrows.push({ x: S.px + d[0] * 0.6, y: S.py + EYE - 0.1 + d[1] * 0.6, z: S.pz + d[2] * 0.6,
                vx: d[0] * 34 * pw, vy: d[1] * 34 * pw, vz: d[2] * 34 * pw, mine: true,
                dmg: Math.max(1, Math.round(pw * 8)) + (pwr ? Math.ceil(pwr * 1.5) : 0), punch: pun, flame: flm, noPick: infinite, t: 0 });
            if (hb0 && hb0.id === 'bow') wearHeld(1);
            snd('bow', pw);
            paintHotbar();
        }
        RT.eatT = 0; RT.bowT = 0;
    }
    function trySleep() {
        var st = skyState();
        if (st.day && st.sunE > 0.05) { actionBar('You can sleep only at night and during thunderstorms'); return; }
        for (var i = 0; i < RT.foes.length; i++) {
            var f = RT.foes[i];
            if (f.hostile && Math.abs(f.x - S.px) < 12 && Math.abs(f.z - S.pz) < 12 && Math.abs(f.y - S.py) < 6) {
                actionBar('You may not rest now; there are monsters nearby'); return;
            }
        }
        var t = RT.target;
        var sp0 = S.spawn;
        S.spawn = [t.x + 0.5, t.y + 1.01, t.z + 0.5];
        if (!sp0 || sp0[0] !== S.spawn[0] || sp0[1] !== S.spawn[1] || sp0[2] !== S.spawn[2]) chatSay('Respawn point set');
        RT.sleep = 0.01;   // lying down makes no sound in the real game either
        RT.woke = 0;
        stat('c', 'sleep_in_bed'); S.stats.c.time_since_rest = 0;
        unlockCursor();    // InBedChatScreen frees the pointer for Leave Bed
        bedLayout();
        unlock('sleep');
    }

    /* ── mobs ───────────────────────────────────────────────── */
    var PX = 1.8 / 32;   // one skin-pixel in world units
    /* A part is [sx,sy,sz, cx,cy,cz, flags, role, idx, pivot].
       Sizes and the box centre are skin-pixels, measured from the mob's feet and
       its centre line; +z is the way it faces.
         flags — 1 face tile on the front · 8 alt tile
         role  — what the animator does with it. 'head' turns to watch you,
                 'leg'/'arm'/'wing' swing, 'snout'/'horn'/'beak'/'wattle'/'headfur'
                 ride the head, and anything it doesn't recognise rides the body.
         idx   — which one. Legs are numbered front-left, front-right, back-left,
                 back-right, so the diagonal pairs (0,3) and (1,2) share a phase:
                 that is the whole difference between a walk and a hop. A biped's
                 two legs fall out of the same rule.
         pivot — where it hinges, when the default is wrong. A limb hinges at its
                 top (hip, shoulder); everything else turns about its own centre,
                 which is right for a head sitting on a neck but not for one slung
                 out in front of a body, so quadrupeds name theirs. */
    var HUMANOID = [
        [8, 8, 8, 0, 28, 0, 1, 'head', 0, [0, 24, 0]],
        [8, 12, 4, 0, 18, 0, 8, 'body'],
        [4, 12, 4, -6, 18, 0, 0, 'arm', 0], [4, 12, 4, 6, 18, 0, 0, 'arm', 1],
        [4, 12, 4, -2, 6, 0, 0, 'leg', 0], [4, 12, 4, 2, 6, 0, 0, 'leg', 1]
    ];
    var QUAD = function (bw, bh, bl, by, hs, hy, hz, lw, lh, extra) {
        var p = [
            [bw, bh, bl, 0, by, 0, 8, 'body'],
            [hs, hs, hs, 0, hy, hz, 1, 'head', 0, [0, hy, hz - hs / 2]],
            [lw, lh, lw, -(bw / 2 - lw / 2), lh / 2, bl / 2 - lw / 2, 0, 'leg', 0],
            [lw, lh, lw, bw / 2 - lw / 2, lh / 2, bl / 2 - lw / 2, 0, 'leg', 1],
            [lw, lh, lw, -(bw / 2 - lw / 2), lh / 2, -(bl / 2 - lw / 2), 0, 'leg', 2],
            [lw, lh, lw, bw / 2 - lw / 2, lh / 2, -(bl / 2 - lw / 2), 0, 'leg', 3]
        ];
        return extra ? p.concat(extra) : p;
    };
    var MOBS = {
        pig: { hp: 10, hw: 0.45, h: 0.9, sp: 1.1, pass: 1, skin: 'pig_skin', face: 'pig_face', snd: 'pig',
               tex: { snout: 'pig_snout' }, graze: 1,
               drops: [['pork_raw', 1, 2]], parts: QUAD(10, 8, 16, 9, 8, 12, 10, 4, 6, [
                   [4, 3, 2, 0, 10, 14, 0, 'snout']]) },
        cow: { hp: 10, hw: 0.55, h: 1.4, sp: 1.0, pass: 1, skin: 'cow_skin', face: 'cow_face', snd: 'cow',
               tex: { horn: 'cow_horn' }, graze: 1,
               drops: [['beef_raw', 1, 2], ['leather', 0, 2]], parts: QUAD(12, 10, 18, 13, 8, 16, 11, 4, 10, [
                   [2, 2, 2, -5, 19, 10, 0, 'horn', 0], [2, 2, 2, 5, 19, 10, 0, 'horn', 1]]) },
        sheep: { hp: 8, hw: 0.5, h: 1.3, sp: 1.0, pass: 1, skin: 'sheep_skin', alt: 'sheep_wool', face: 'sheep_face', snd: 'sheep',
                 graze: 1,
                 drops: [['mutton_raw', 1, 2], ['wool', 1, 2]], parts: QUAD(12, 12, 18, 12, 6, 14, 9, 4, 8, [
                     [7, 7, 6, 0, 14, 8, 8, 'headfur']]) },
        // a chicken has two legs, not four, and wings that only work on the way down
        chicken: { hp: 4, hw: 0.25, h: 0.8, sp: 0.9, pass: 1, slow: 1, skin: 'chicken_skin', face: 'chicken_face', snd: 'chicken',
                   tex: { beak: 'chick_beak', wattle: 'chick_wattle' },
                   drops: [['chicken_raw', 1, 1], ['feather', 0, 2]], parts: [
                       [6, 6, 8, 0, 7, 0, 8, 'body'],
                       [4, 5, 4, 0, 12, 4, 1, 'head', 0, [0, 9.5, 2]],
                       [4, 2, 2, 0, 12, 7, 0, 'beak'], [2, 2, 2, 0, 10, 6.5, 0, 'wattle'],
                       [1, 4, 6, -3.5, 9, 0, 0, 'wing', 0, [-3, 11, 0]], [1, 4, 6, 3.5, 9, 0, 0, 'wing', 1, [3, 11, 0]],
                       [3, 5, 3, -2, 2.5, 1, 0, 'leg', 0], [3, 5, 3, 2, 2.5, 1, 0, 'leg', 1]] },
        zombie: { hp: 20, hw: 0.35, h: 1.9, sp: 1.5, dmg: 3, burns: 1, skin: 'zom_skin', alt: 'zom_body', face: 'zom_face', snd: 'zombie',
                  drops: [['flesh', 0, 2]], parts: HUMANOID },
        skeleton: { hp: 20, hw: 0.35, h: 1.9, sp: 1.6, ranged: 1, burns: 1, skin: 'skel_skin', alt: 'skel_skin', face: 'skel_face', snd: 'skel',
                    drops: [['bone', 0, 2], ['arrow', 0, 2]], parts: HUMANOID },
        creeper: { hp: 20, hw: 0.35, h: 1.5, sp: 1.4, fuse: 1, skin: 'creep_skin', alt: 'creep_skin', face: 'creep_face', snd: null,
                   drops: [['gunpowder', 1, 2]], parts: [
                       [8, 8, 8, 0, 22, 0, 1, 'head', 0, [0, 18, 0]], [8, 12, 4, 0, 12, 0, 8, 'body'],
                       [4, 6, 4, -2, 3, 3, 0, 'leg', 0], [4, 6, 4, 2, 3, 3, 0, 'leg', 1],
                       [4, 6, 4, -2, 3, -3, 0, 'leg', 2], [4, 6, 4, 2, 3, -3, 0, 'leg', 3]] },
        /* Eight legs that fan out from the thorax and paddle in four pairs, each a
           quarter-cycle behind the last — the real game's spider, whose gait is the
           only reason a box with legs reads as something that scuttles. */
        spider: { hp: 16, hw: 0.65, h: 0.9, sp: 1.9, dmg: 2, climbs: 1, skin: 'spider_skin', alt: 'spider_skin', face: 'spider_face', snd: 'spider',
                  drops: [['string', 0, 2]], parts: (function () {
                      var p = [[10, 8, 12, 0, 9, -3, 8, 'body'], [8, 7, 7, 0, 9, 7, 1, 'head', 0, [0, 9, 3.5]]];
                      for (var l = 0; l < 4; l++) {
                          var lz = 4 - l * 3;
                          p.push([12, 2, 2, 11, 10, lz, 0, 'sleg', l * 2, [5, 10, lz]]);
                          p.push([12, 2, 2, -11, 10, lz, 0, 'sleg', l * 2 + 1, [-5, 10, lz]]);
                      }
                      return p;
                  })() },
        enderman: { hp: 40, hw: 0.3, h: 2.9, sp: 1.7, dmg: 4, xp: 5, skin: 'ender_skin', alt: 'ender_skin', face: 'ender_face', rage: 'ender_rage', snd: null,
                    drops: [['ender_pearl', 0, 1]], parts: [
                        [6, 8, 6, 0, 47, 0, 1, 'head', 0, [0, 43, 0]],
                        [8, 22, 4, 0, 34, 0, 8, 'body'],
                        [2, 30, 2, -5, 28, 0, 0, 'arm', 0], [2, 30, 2, 5, 28, 0, 0, 'arm', 1],
                        [2, 26, 2, -2, 13, 0, 0, 'leg', 0], [2, 26, 2, 2, 13, 0, 0, 'leg', 1]] },
        // one cube, scaled to whatever size the slime happens to be, that squashes
        // when it lands and stretches when it leaves the ground
        slime: { hp: 4, hw: 0.5, h: 1.0, sp: 1.0, dmg: 2, split: 1, xp: 0, cube: 1, hop: 1, skin: 'slime_skin', alt: 'slime_skin', face: 'slime_face', snd: null,
                 drops: [['slimeball', 0, 2]], parts: [[8, 8, 8, 0, 4, 0, 1, 'body']] },
        squid: { hp: 10, hw: 0.45, h: 0.85, sp: 1.5, pass: 1, aquatic: 1, xp: 1, skin: 'squid_skin', alt: 'squid_skin', face: 'squid_face', snd: null,
                 drops: [['ink_sac', 1, 3]], parts: (function () {
                     var p = [[10, 10, 10, 0, 9, 0, 1, 'body']];
                     for (var l = 0; l < 8; l++) {
                         var a = l / 8 * 6.283, tx = Math.cos(a) * 3.5, tz = Math.sin(a) * 3.5;
                         p.push([2, 6, 2, tx, 1, tz, 8, 'tent', l, [tx, 4, tz]]);
                     }
                     return p;
                 })() }
    };
    var HEAD_KID = { snout: 1, horn: 1, beak: 1, wattle: 1, headfur: 1 };
    function mkFoe(kind, x, y, z, hp) {
        var d = MOBS[kind];
        var f = { k: kind, x: x, y: y, z: z, vx: 0, vy: 0, vz: 0, hp: hp != null ? hp : d.hp,
            hw: d.hw, h: d.h, yaw: Math.random() * 6.28, wt: 0, wd: null, anim: 0, ifr: 0,
            hostile: !d.pass, fuse: 0, burnT: 0, shootT: 0, flee: 0, hurtF: 0, voice: 2 + Math.random() * 6,
            fire: 0, love: 0, baby: 0, mateCd: 0, sz: 0, dmg: d.dmg, aggro: 0,
            /* animation. Two mobs spawned in the same tick must not breathe in
               lockstep, so the idle clock starts somewhere random. */
            age: Math.random() * 600, swAmt: 0, spd: 0, ground: false,
            hYaw: 0, hPitch: 0, lookT: 0, lookY: 0, lookP: 0,
            atk: 0, aim: 0, aiming: 0, chase: 0,
            squish: 0, wasGround: false, flap: 0, flapV: 0, wingT: Math.random() * 6.28,
            graze: 0, grazeT: 5 + Math.random() * 25, tentA: 0, pitchA: 0, dieT: null, dieSide: 1 };
        if (kind === 'slime') { f.sz = f.sz || 2; applySlimeSize(f); if (hp != null) f.hp = hp; }
        return f;
    }
    function applySlimeSize(f) {
        var sz = f.sz || 2; f.sz = sz;
        f.hw = 0.25 * sz; f.h = 0.5 * sz;
        f.dmg = sz === 1 ? 0 : sz === 2 ? 2 : 3;
        f.hp = sz === 3 ? 16 : sz === 2 ? 4 : 1;   // full HP for the size; mkFoe/restoreEnts reassign a saved value after
    }
    function entMove(f, dx, dy, dz) {
        var hit = { x: false, y: false, z: false };
        function hits() {
            var x0 = Math.floor(f.x - f.hw), x1 = Math.floor(f.x + f.hw);
            var y0 = Math.floor(f.y), y1 = Math.floor(f.y + f.h - 0.001);
            var z0 = Math.floor(f.z - f.hw), z1 = Math.floor(f.z + f.hw);
            for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++)
                if (solidAt(x, y, z)) return true;
            return false;
        }
        // a resolver that can't find free space must UNDO the move — never leave the body displaced
        var ox = f.x, oy = f.y, oz = f.z;
        if (dx) { f.x += dx; if (hits()) { var sx = dx > 0 ? 1 : -1, g = 0; while (hits() && g++ < 60) f.x -= sx * 0.02; if (hits()) f.x = ox; hit.x = true; } }
        if (dz) { f.z += dz; if (hits()) { var sz = dz > 0 ? 1 : -1, g2 = 0; while (hits() && g2++ < 60) f.z -= sz * 0.02; if (hits()) f.z = oz; hit.z = true; } }
        if (dy) {
            var rem = dy, sy = dy > 0 ? 1 : -1;
            while (rem !== 0 && !hit.y) {
                var stp = Math.abs(rem) > 0.5 ? sy * 0.5 : rem;
                f.y += stp; rem -= stp;
                if (hits()) { var g3 = 0; while (hits() && g3++ < 120) f.y -= sy * 0.02; if (hits()) f.y = oy; hit.y = true; }
            }
        }
        return hit;
    }
    function entInWater(f) { return getB(Math.floor(f.x), Math.floor(f.y + 0.3), Math.floor(f.z)) === WATER; }

    /* ── mob animation: the tick side ────────────────────────
       Everything below is a number the poser reads back when it builds geometry.

       The one that matters most is the walk cycle. The real game does not run it
       off a clock — it runs it off ground actually covered, through a pair of
       values called limbSwing (how far through the stride) and limbSwingAmount
       (how big a stride). Amount chases the mob's real speed and the phase
       advances by amount, so the two are the same knob: a fleeing pig's legs
       whirl, a wandering one ambles, and one walking into a wall stops dead
       instead of moon-walking on the spot. This file used to add a flat six
       radians a second no matter what, which is why every mob moved like every
       other mob. */
    var DIE_T = 1.0, ATK_T = 0.35;   // deathTime runs to 20 ticks
    function foeTick(f, dt) {
        var ox = f.x, oy = f.y, oz = f.z;
        var gone = foeUpdate(f, dt);
        if (!gone) animTick(f, MOBS[f.k], dt, ox, oy, oz);
        return gone;
    }
    function animTick(f, md, dt, ox, oy, oz) {
        f.age += dt * 20;                       // ticks, the unit the real game's idle curves are in
        if (f.age > 1e6) f.age -= 1e6;

        // the stride, from ground actually covered
        var dx = f.x - ox, dz = f.z - oz;
        f.spd = dt > 0 ? Math.sqrt(dx * dx + dz * dz) / dt : 0;
        var want = Math.min(f.spd * 0.2, 1);    // blocks/second → the game's per-tick figure, capped
        f.swAmt += (want - f.swAmt) * Math.min(1, dt * 8);
        f.anim += f.swAmt * 0.6662 * 20 * dt;
        if (f.anim > 6.2832) f.anim -= 6.2832;
        // footfalls off the same ground covered, at the 0.6-a-block stride the player's use
        if (f.ground && !md.hop && !md.aquatic && (dx || dz)) {
            f.stepD = (f.stepD || 0) + Math.sqrt(dx * dx + dz * dz) * 0.6;
            if (f.stepD > 1) { f.stepD = 0; foeStep(f); }
        }

        f.atk = Math.max(0, f.atk - dt);
        f.aim += ((f.aiming && f.shootT > 0.9 ? 1 : 0) - f.aim) * Math.min(1, dt * 9);

        headTick(f, dt);

        /* a chicken's wings only work on the way down — they beat hard the moment
           it leaves the ground and wind down over a second once it lands, which is
           the whole reason a falling chicken reads as a chicken */
        if (f.k === 'chicken') {
            f.flap += ((f.ground ? -1 : 4) * 0.3) * dt * 20;
            f.flap = Math.max(0, Math.min(1, f.flap));
            if (!f.ground && f.flapV < 1) f.flapV = 1;
            f.flapV *= Math.pow(0.9, dt * 20);
            f.wingT += f.flapV * 2 * 20 * dt;
            if (f.wingT > 6.2832) f.wingT -= 6.2832;
        }
        // slimes squash flat when they land and stretch as they leave the ground
        if (md.hop) {
            if (f.ground && !f.wasGround) {
                f.squish = -0.5;
                // and the landing is a squelch, from its first real landing on (not the frame it loads in)
                if (f.wasGround === false) snd('mob:slime:squish', f, f.x, f.y, f.z);
            }
            else if (!f.ground && f.wasGround) f.squish = 1;
            f.squish *= Math.pow(0.6, dt * 20);
            f.wasGround = f.ground;
        }
        // and a grazer puts its head in the grass when there is grass and nothing to run from
        if (md.graze) grazeTick(f, dt);
    }
    /* Mobs watch you. The head turns within the range a neck allows and eases
       back to straight ahead when you leave; with nobody about they glance at
       whatever a mob glances at. Nothing else in this file makes a standing
       animal look as alive as this does. */
    function headTick(f, dt) {
        var tYaw = 0, tPitch = 0, hx = S.px - f.x, hz = S.pz - f.z;
        var hd = Math.sqrt(hx * hx + hz * hz);
        var watch = !RT.dead && !unseen() && hd < (f.hostile ? 24 : 9) && (f.hostile || f.flee > 0 || hd < 8);
        if (watch) {
            tYaw = Math.atan2(-hx, hz) - f.yaw;
            tPitch = -Math.atan2((S.py + EYE) - (f.y + f.h * 0.85), Math.max(0.5, hd));
        } else {
            f.lookT -= dt;
            if (f.lookT <= 0) {
                f.lookT = 1.5 + Math.random() * 5;
                var glance = Math.random() < 0.55;
                f.lookY = glance ? (Math.random() - 0.5) * 2.2 : 0;
                f.lookP = glance ? (Math.random() - 0.5) * 0.5 : 0;
            }
            tYaw = f.lookY; tPitch = f.lookP;
        }
        while (tYaw > Math.PI) tYaw -= 6.2832;
        while (tYaw < -Math.PI) tYaw += 6.2832;
        // a head that can swivel further than a neck reads as a broken toy
        tYaw = Math.max(-1.3, Math.min(1.3, tYaw));
        tPitch = Math.max(-0.7, Math.min(0.7, tPitch));
        var e = Math.min(1, dt * (watch ? 9 : 4));
        f.hYaw += (tYaw - f.hYaw) * e;
        f.hPitch += (tPitch - f.hPitch) * e;
    }
    function grazeTick(f, dt) {
        if (f.graze > 0) {
            f.graze -= dt;
            if (f.graze <= 0) { f.graze = 0; f.grazeT = 10 + Math.random() * 24; }
            else if (f.spd > 0.6) { f.graze = 0; f.grazeT = 6 + Math.random() * 12; }   // spooked mid-mouthful
            return;
        }
        f.grazeT -= dt;
        if (f.grazeT > 0) return;
        var b = getB(Math.floor(f.x), Math.floor(f.y) - 1, Math.floor(f.z));
        if (f.spd < 0.25 && f.ground && !f.baby && !f.flee && (b === GRASS || b === SNOWGRASS)) f.graze = 2;
        else f.grazeT = 3 + Math.random() * 6;
    }
    function foeUpdate(f, dt) {
        // an unloaded chunk has no floor to stand on: freeze in place until the world comes back
        if (!chunkAt(Math.floor(f.x), Math.floor(f.z))) return false;
        var d = MOBS[f.k];
        if (f.hp <= 0) { foeDie(f); return true; }
        f.ifr = Math.max(0, f.ifr - dt); f.hurtF = Math.max(0, f.hurtF - dt);
        var px = S.px - f.x, pz = S.pz - f.z, py = (S.py + 0.9) - (f.y + f.h * 0.6);
        var dist = Math.sqrt(px * px + pz * pz + py * py);
        // set-on-fire (fire aspect / lava / the sun): damage over time, until water or rain puts it out
        if (f.fire > 0 && (getB(Math.floor(f.x), Math.floor(f.y + 0.2), Math.floor(f.z)) === WATER ||
            (S.weather > 0 && getSky(Math.floor(f.x), Math.floor(f.y + f.h), Math.floor(f.z)) >= 15))) f.fire = 0;
        if (f.fire > 0) {
            f.fire -= dt; f.fireT = (f.fireT || 0) + dt;
            if (f.fireT > 0.5) { f.fireT = 0; f.hp -= 1; f.hurtF = 0.2; fireParticles(f); if (f.hp <= 0) { foeDie(f); return true; } }
        }
        // baby → adult
        if (f.baby > 0) { f.baby -= dt; if (f.baby <= 0) f.baby = 0; }
        // breeding: two nearby in-love adults make a baby
        if (d.pass && f.love > 0 && !f.baby) {
            f.love -= dt; heartParticles(f);
            for (var mi = 0; mi < RT.foes.length; mi++) {
                var m = RT.foes[mi];
                if (m !== f && m.k === f.k && m.love > 0 && !m.baby && Math.abs(m.x - f.x) < 2.5 && Math.abs(m.z - f.z) < 2.5) {
                    f.love = 0; m.love = 0; f.mateCd = m.mateCd = 6;
                    var baby = mkFoe(f.k, (f.x + m.x) / 2, f.y, (f.z + m.z) / 2); baby.baby = 20;
                    if (RT.foes.length < 60) RT.foes.push(baby);
                    spawnXp(f.x, f.y + 0.4, f.z, 1 + ((Math.random() * 7) | 0));
                    unlock('breed'); stat('c', 'animals_bred');
                    break;
                }
            }
        }
        if (f.mateCd > 0) f.mateCd -= dt;
        // chickens lay — the only source of eggs, without which cake and pumpkin pie
        // are uncraftable (they were dead recipes before this)
        if (f.k === 'chicken' && !f.baby) {
            f.layT = (f.layT || 20 + Math.random() * 40) - dt;
            // the laying has its own sound, the plop, and it is placed at the chicken:
            // 'pop' is the cue that means "you picked something up", and has no distance
            if (f.layT <= 0) { f.layT = 20 + Math.random() * 40; dropItem(f.x, f.y + 0.3, f.z, 'egg', 1); snd('mob:chicken:egg', f, f.x, f.y + 0.6, f.z); }
        }
        // fully-custom movers take over here (they run their own physics + contact)
        if (f.k === 'enderman') return endermanUpdate(f, dt, px, pz, dist);
        if (f.k === 'squid') return squidUpdate(f, dt);
        // burn at dawn
        if (d.burns) {
            var st = skyState();
            if (st.day && st.sunE > 0.08 && getSky(Math.floor(f.x), Math.floor(f.y + f.h), Math.floor(f.z)) >= 14) {
                f.fire = Math.max(f.fire || 0, 8);   // Mob.isSunBurnTick: igniteForSeconds(8)
            }
        }
        // intent
        var want = null, sp = d.sp;
        f.chase = 0; f.aiming = 0;
        if (f.flee > 0) { f.flee -= dt; want = Math.atan2(-px, pz) + Math.PI; sp *= 1.4; }
        // hostiles look straight through a creative or spectator player: no chase,
        // no arrows, no creeper hiss. Exactly what the real game does.
        else if (f.hostile && dist < 18 && !RT.dead && !unseen()) {
            want = Math.atan2(-px, pz);   // face the player: movement dir is (-sin yaw, cos yaw)
            f.chase = 1;
            if (d.ranged) {
                f.aiming = dist < 15 ? 1 : 0;
                if (dist < 7) want += Math.PI;                       // skeletons keep their distance
                else if (dist < 13) { want = null; }
                f.shootT += dt;
                if (f.shootT > 2 && dist < 15) {
                    f.shootT = 0;
                    var dl = Math.sqrt(px * px + py * py + pz * pz) || 1;
                    RT.arrows.push({ x: f.x, y: f.y + f.h * 0.8, z: f.z, vx: px / dl * 22, vy: py / dl * 22 + dist * 0.09, vz: pz / dl * 22, mine: false, dmg: 3, t: 0 });
                    snd('skelshoot', 0, f.x, f.y + f.h * 0.7, f.z);
                }
            }
            if (d.fuse) {
                if (dist < 3) { if (!f.fuse) snd('fuse', 0, f.x, f.y + f.h * 0.6, f.z); f.fuse += dt; want = null; sp = 0; }
                else if (f.fuse > 0 && dist > 7) f.fuse = Math.max(0, f.fuse - dt * 2);
                else if (f.fuse > 0) f.fuse += dt * 0.4;   // committed once lit unless you really run
                if (f.fuse >= 1.5) { killFoe(f); explode(f.x, f.y + f.h / 2, f.z, 3, 22, 'Creeper'); return false; }
            }
        } else {
            f.wt -= dt;
            if (f.wt <= 0) { f.wt = 2 + Math.random() * 4; f.wd = Math.random() < 0.55 ? Math.random() * 6.28 : null; }
            want = f.wd; sp *= 0.5;
        }
        if (want != null) {
            var turn = want - f.yaw;
            while (turn > Math.PI) turn -= 6.283; while (turn < -Math.PI) turn += 6.283;
            f.yaw += Math.max(-3 * dt, Math.min(3 * dt, turn));
        }
        var mvx = 0, mvz = 0;
        if (want != null && sp > 0) { mvx = -Math.sin(f.yaw) * sp * dt; mvz = Math.cos(f.yaw) * sp * dt; }
        /* A slime does not walk, it hops — it is only under its own power while
           it is off the ground, and it leaves the ground on a beat. Without that
           the squash-and-stretch has nothing to squash against. */
        if (d.hop) {
            f.hopT = (f.hopT || 0.4 + Math.random() * 0.8) - dt;
            if (f.ground) {
                mvx = mvz = 0;
                if (f.hopT <= 0) { f.hopT = 0.5 + Math.random() * 1.1 - f.sz * 0.08; f.vy = 6.6 + f.sz * 0.6; f.ground = false; snd('mob:slime:jump', f, f.x, f.y, f.z); }
            } else { mvx *= 1.6; mvz *= 1.6; }
        }
        var water = entInWater(f);
        if (water) { f.vy += -GRAV * 0.15 * dt; f.vy *= Math.pow(0.4, dt * 3); if (f.hostile || Math.random() < 0.6) f.vy = Math.min(f.vy + GRAV * 0.4 * dt, 2.4); }
        else { f.vy -= GRAV * dt; if (f.vy < -TERMV) f.vy = -TERMV; }
        if (d.slow && f.vy < -1.5) f.vy = -1.5;   // chickens flap
        var hit = entMove(f, mvx, 0, mvz);
        if ((hit.x || hit.z)) {
            if (d.climbs && f.hostile && dist < 18) f.vy = 2.6;
            else if (f.ground) f.vy = JUMP;   // full player-height hop: 0.72x could never clear a 1-block step
        }
        var hy = entMove(f, 0, f.vy * dt, 0);
        if (hy.y) {
            if (f.vy < -14 && !water) { f.hp -= Math.floor(-f.vy * 0.28 - 3); f.hurtF = 0.25; }
            if (f.vy < 0) f.ground = true;
            f.vy = 0;
        } else if (Math.abs(f.vy) > 1) f.ground = false;
        if (f.hp <= 0) { foeDie(f); return true; }
        // lava is nobody's friend
        if (getB(Math.floor(f.x), Math.floor(f.y), Math.floor(f.z)) === LAVA) { f.hp -= 4 * dt * 2; f.hurtF = 0.2; }
        // contact damage
        var cdmg = f.dmg != null ? f.dmg : d.dmg;
        if (f.hostile && cdmg && f.ifr <= 0 && !RT.dead && !unseen() &&
            Math.abs(f.x - S.px) < f.hw + HW + 0.1 && Math.abs(f.z - S.pz) < f.hw + HW + 0.1 &&
            S.py < f.y + f.h && S.py + PH > f.y) {
            f.ifr = 1; f.atk = ATK_T;   // and it visibly takes a swing at you
            var kl = Math.sqrt(px * px + pz * pz) || 1;
            hurt(cdmg, [px / kl, pz / kl], false, false, null, { m: 'mob', by: targetName(f) });
            if (f.k === 'slime') snd('mob:slime:attack', f, f.x, f.y + f.h * 0.5, f.z);   // a slime's hit is a sound of its own
        }
        // idle voice
        f.voice -= dt;
        // Mob.getAmbientSoundInterval is 80 ticks and the roll is per-tick, so
        // idle calls land irregularly around every few seconds rather than on a timer
        if (f.voice <= 0) { f.voice = 3 + Math.random() * 9; if (d.snd) snd('mob:' + f.k + ':idle', f, f.x, f.y + f.h * 0.8, f.z); }
        // despawn: hostiles far away evaporate
        if (f.hostile && (Math.abs(px) > 64 || Math.abs(pz) > 64 || Math.abs(py) > 48)) return true;
        return false;
    }
    function foeDie(f, looting) {
        var d = MOBS[f.k];
        looting = looting || 0;
        for (var i = 0; i < d.drops.length; i++) {
            var dd = d.drops[i], n = dd[1] + ((Math.random() * (dd[2] - dd[1] + 1)) | 0);
            if (looting && n >= 0) n += (Math.random() * (looting + 1)) | 0;
            if (n > 0) dropItem(f.x, f.y + 0.4, f.z, dd[0], n);
        }
        // slimes fall apart into smaller slimes
        if (d.split && f.sz > 1) {
            for (var s = 0; s < 2 + ((Math.random() * 2) | 0); s++) {
                var nf = mkFoe('slime', f.x + (Math.random() - 0.5), f.y + 0.2, f.z + (Math.random() - 0.5));
                nf.sz = f.sz - 1; applySlimeSize(nf); nf.vy = 3;
                if (RT.foes.length < 60) RT.foes.push(nf);
            }
        }
        // the cry goes with the killing blow, not with the body hitting the floor
        snd('mob:' + f.k + ':death', f, f.x, f.y + f.h * 0.6, f.z);
        /* The body does not blink out — it keels over. Every caller of foeDie
           removes the mob from RT.foes on the very next line, so the corpse gets
           its own list: it renders and topples, but it has no AI, no hitbox, no
           place in the spawn cap and nothing to say to the save file. The puff of
           smoke that used to fire here now fires when the body finishes falling,
           which is where the real game puts it. */
        if (RT.dying.length < 24) { f.dieT = 0; f.dieSide = 1; RT.dying.push(f); }
        else poofParticles(f);
        if (f.pk) spawnXp(f.x, f.y + 0.5, f.z, d.xp != null ? d.xp : (f.hostile ? 5 : 1 + ((Math.random() * 3) | 0)));
        if (f.hostile) unlock('hunter');
        if (f.k === 'skeleton' && f.lastArrow) unlock('sniper');
        if (f.k === 'enderman') unlock('ender');
    }
    function dyingUpdate(f, dt) {
        f.dieT += dt;
        f.hurtF = Math.max(0, f.hurtF - dt);
        f.age += dt * 20;
        if (f.dieT < DIE_T) return false;
        poofParticles(f);   // silent, as the game's is: the death cry already went with the blow
        return true;
    }
    function killFoe(f) { var i = RT.foes.indexOf(f); if (i >= 0) RT.foes.splice(i, 1); }
    function heartParticles(f) {
        if (Math.random() > 0.15) return;
        var uv0 = tileUV(TILE.h_heart);
        RT.parts.push({ x: f.x + (Math.random() - 0.5) * 0.5, y: f.y + f.h + 0.2, z: f.z + (Math.random() - 0.5) * 0.5,
            vx: 0, vy: 0.6, vz: 0, life: 0.8, u: uv0[0] + 4 * TS16 / 16, v: uv0[1] + 4 * TS16 / 16, s: 0.1 });
    }
    function teleportEnder(f) {   // hop to a valid spot within ~24 blocks; false if none found
        for (var t = 0; t < 16; t++) {
            var tx = Math.floor(f.x) + ((Math.random() * 48) | 0) - 24, tz = Math.floor(f.z) + ((Math.random() * 48) | 0) - 24;
            if (!chunkAt(tx, tz)) continue;
            for (var ty = Math.min(CH - 3, Math.floor(f.y) + 8); ty > 4; ty--) {
                if (solidAt(tx, ty - 1, tz) && !solidAt(tx, ty, tz) && !solidAt(tx, ty + 1, tz) && !solidAt(tx, ty + 2, tz) && getB(tx, ty, tz) !== WATER) {
                    poofParticles(f); snd('teleport', 0, f.x, f.y + 1.4, f.z); f.x = tx + 0.5; f.y = ty; f.z = tz + 0.5; f.vy = 0; poofParticles(f); snd('teleport', 0, f.x, f.y + 1.4, f.z); return true;
                }
            }
        }
        return false;
    }
    function endermanUpdate(f, dt, px, pz, dist) {
        var inRain = S.weather >= 1 && getSky(Math.floor(f.x), Math.floor(f.y + f.h), Math.floor(f.z)) >= 14;
        var inWater = getB(Math.floor(f.x), Math.floor(f.y + 1), Math.floor(f.z)) === WATER;
        if (inRain || inWater) { f.waterT = (f.waterT || 0) + dt; if (f.waterT > 0.4) { f.waterT = 0; f.hp -= 1; f.hurtF = 0.25; fireParticles(f); if (!teleportEnder(f) && f.hp <= 0) { foeDie(f); return true; } } }
        // provoked by a direct look at close range, or when struck — but a
        // creative player isn't there to stare at
        if (!f.aggro && dist < 24 && !unseen()) {
            var la = look(), t = rayBox(S.px, S.py + EYE, S.pz, la, f.x - f.hw, f.y + f.h * 0.55, f.z - f.hw, f.x + f.hw, f.y + f.h, f.z + f.hw);
            if (t != null && (!RT.target || RT.target.dist > t)) { f.aggro = 12; snd('mob:enderman:stare', f, f.x, f.y + 2.4, f.z); }
        }
        if (f.hurtF > 0.24 && Math.random() < 0.35) { teleportEnder(f); f.aggro = 12; }   // flickers away when hit
        var want = null, sp = MOBS.enderman.sp;
        if (f.aggro > 0 && !RT.dead && !unseen()) {
            f.aggro = Math.max(0, f.aggro - dt); want = Math.atan2(-px, pz); sp *= 1.5;
            if (dist > 20 && Math.random() < 0.02) teleportEnder(f);   // close the gap
        } else { f.wt -= dt; if (f.wt <= 0) { f.wt = 2 + Math.random() * 4; f.wd = Math.random() < 0.5 ? Math.random() * 6.28 : null; } want = f.wd; sp *= 0.5; }
        if (want != null) { var turn = want - f.yaw; while (turn > Math.PI) turn -= 6.283; while (turn < -Math.PI) turn += 6.283; f.yaw += Math.max(-4 * dt, Math.min(4 * dt, turn)); }
        var mvx = 0, mvz = 0;
        if (want != null && sp > 0) { mvx = -Math.sin(f.yaw) * sp * dt; mvz = Math.cos(f.yaw) * sp * dt; }
        f.vy -= GRAV * dt; if (f.vy < -TERMV) f.vy = -TERMV;
        var hit = entMove(f, mvx, 0, mvz);
        if ((hit.x || hit.z) && f.ground) f.vy = JUMP;
        var hy = entMove(f, 0, f.vy * dt, 0);
        if (hy.y) { if (f.vy < 0) f.ground = true; f.vy = 0; } else if (Math.abs(f.vy) > 1) f.ground = false;
        if (f.hp <= 0) { foeDie(f); return true; }
        if (f.aggro > 0 && f.ifr <= 0 && !RT.dead && Math.abs(f.x - S.px) < f.hw + HW + 0.15 && Math.abs(f.z - S.pz) < f.hw + HW + 0.15 && S.py < f.y + f.h && S.py + PH > f.y) {
            f.ifr = 1; f.atk = ATK_T; var kl = Math.sqrt(px * px + pz * pz) || 1; hurt(4, [px / kl, pz / kl], false, false, null, { m: 'mob', by: 'Enderman' });
        }
        // a calm one mutters; a provoked one screams
        f.voice -= dt; if (f.voice <= 0) { f.voice = 8 + Math.random() * 16; snd('mob:enderman:' + (f.aggro > 0 ? 'scream' : 'idle'), f, f.x, f.y + 2.4, f.z); }
        if (Math.abs(px) > 72 || Math.abs(pz) > 72) return true;
        return false;
    }
    /* A squid does not swim, it pulses: the tentacles spread over the first half
       of a cycle and the kick that actually shoves it along lands three quarters
       of the way through the spread, so it lurches and coasts. It also noses into
       whichever way it is going, which is why the tentacles always trail. */
    function squidUpdate(f, dt) {
        var inWater = getB(Math.floor(f.x), Math.floor(f.y + 0.4), Math.floor(f.z)) === WATER;
        if (!inWater) {   // beached squid flops then despawns
            f.landT = (f.landT || 0) + dt; if (f.landT > 8) return true;
            f.vy -= GRAV * dt;
            f.tentA += (0.3 + Math.sin(f.age * 0.3) * 0.25 - f.tentA) * Math.min(1, dt * 5);   // limp, twitching
            f.pitchA += (1.45 - f.pitchA) * Math.min(1, dt * 2);
        } else {
            f.landT = 0;
            f.pulseV = f.pulseV || 0.16;
            f.pulse = (f.pulse || 0) + f.pulseV * 20 * dt;
            if (f.pulse > 6.2832) { f.pulse -= 6.2832; if (Math.random() < 0.35) f.pulseV = 0.1 + Math.random() * 0.13; }
            f.thrust = f.thrust || 0;
            if (f.pulse < Math.PI) {
                var q = f.pulse / Math.PI;
                f.tentA = Math.sin(q * Math.PI) * Math.PI * 0.25;
                if (q > 0.75) f.thrust = 1; else f.thrust *= Math.pow(0.8, dt * 20);
            } else {
                f.tentA += (0 - f.tentA) * Math.min(1, dt * 9);
                f.thrust *= Math.pow(0.9, dt * 20);
            }
            f.swimT = (f.swimT || 0) - dt;
            if (f.swimT <= 0) { f.swimT = 1.6 + Math.random() * 2.4; f.yaw = Math.random() * 6.28; f.pitchV = (Math.random() - 0.5) * 2; }
            var sp = MOBS.squid.sp;
            f.vy = f.pitchV * f.thrust;
            f.pitchA += (Math.atan2(sp, f.pitchV) - f.pitchA) * Math.min(1, dt * 3);
            entMove(f, -Math.sin(f.yaw) * sp * f.thrust * dt, 0, Math.cos(f.yaw) * sp * f.thrust * dt);
        }
        var hy = entMove(f, 0, f.vy * dt, 0);
        if (hy.y && !inWater) f.vy = 0;
        if (f.hp <= 0) { foeDie(f); return true; }
        f.hurtF = Math.max(0, f.hurtF - dt);
        // a squid's ambient is a small wet thing, but it has one
        f.voice -= dt; if (f.voice <= 0) { f.voice = 3 + Math.random() * 9; if (inWater) snd('mob:squid:idle', f, f.x, f.y + 0.4, f.z); }
        if (Math.abs(f.x - S.px) > 72 || Math.abs(f.z - S.pz) > 72) return true;
        return false;
    }

    /* ── the arm ────────────────────────────────────────────
       One swing per click; while a button is held the next one begins as the
       last one ends, so mining is a continuous chop rather than a single frozen
       pose. Haste shortens the swing and mining fatigue drags it out, exactly
       as they do in the real game. */
    function swingTime() {
        var haste = effLvl('haste'), fatigue = effLvl('mining_fatigue');
        var ticks = haste ? 6 - haste : fatigue ? 6 + fatigue * 2 : 6;
        return Math.max(1, ticks) / 20;
    }
    function swingArm(restart) {
        camSwing();
        // a fresh click restarts the swing mid-arc; a held button only queues the
        // next one, which is the difference between spamming and holding
        if (restart || RT.swing <= 0) { RT.swingT = swingTime(); RT.swing = RT.swingT; }
    }

    /* ── the player swings ──────────────────────────────────── */
    function entRay() {
        var d = look(), best = null, bestT = 3.2;
        for (var i = 0; i < RT.foes.length; i++) {
            var f = RT.foes[i];
            var t = rayBox(S.px, S.py + EYE, S.pz, d, f.x - f.hw, f.y, f.z - f.hw, f.x + f.hw, f.y + f.h, f.z + f.hw);
            if (t != null && t < bestT) { best = f; bestT = t; }
        }
        if (best && RT.target && RT.target.dist < bestT) return null;   // wall in the way
        return best;
    }
    function rayBox(ox, oy, oz, d, x0, y0, z0, x1, y1, z1) {
        var tmin = 0, tmax = 64, i, o = [ox, oy, oz], lo = [x0, y0, z0], hi = [x1, y1, z1];
        for (i = 0; i < 3; i++) {
            var di = d[i] || 1e-9, t1 = (lo[i] - o[i]) / di, t2 = (hi[i] - o[i]) / di;
            if (t1 > t2) { var tt = t1; t1 = t2; t2 = tt; }
            tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
            if (tmin > tmax) return null;
        }
        return tmin;
    }
    function attack() {
        if (RT.dead || RT.panel || RT.paused) return;
        swingArm(true);
        var f = entRay();
        var h = held(), tool = h && I[h.id] && I[h.id].tool;
        /* Player.attack: the swing's strength is how far the weapon has recharged
           (20 / attack speed ticks from the last swing), and it scales the hit by
           0.2 + 0.8 f squared and the Sharpness bonus by f; above 0.9 it counts as
           charged, which a critical needs. Every swing, hit or miss, starts over. */
        var cdMax = RT.atkCdMax || attackCooldown(h && h.id);
        var fch = RT.atkCd > 0 ? Math.max(0, Math.min(1, 1 - RT.atkCd / cdMax)) : 1, charged = fch > 0.9;
        RT.atkCd = RT.atkCdMax = attackCooldown(h && h.id);
        if (!f) return;
        if (f.ifr > 0.6) return;
        var dmg = (tool ? tool.dmg : 1) * (0.2 + fch * fch * 0.8);
        dmg += (ench(h, 'sharp') > 0 ? 0.5 * ench(h, 'sharp') + 0.5 : 0) * fch;
        // critical: mid-fall, charged, not sprinting, not in fluid or on a ladder
        var crit = charged && RT.vy < -0.1 && !RT.ground && !RT.sprint && !inFluid(WATER) && !onLadder();
        if (crit) { dmg *= 1.5; critParticles(f); }
        f.hp -= dmg;
        stat('c', 'damage_dealt', Math.round(Math.min(dmg, f.hp + dmg) * 10));
        f.ifr = 0.5; f.hurtF = 0.3;
        // fire aspect
        if (ench(h, 'fire') > 0) f.fire = Math.max(f.fire || 0, 4);
        var px = f.x - S.px, pz = f.z - S.pz, l = Math.sqrt(px * px + pz * pz) || 1;
        var kb = 0.5 + ench(h, 'knock') * 0.5 + (charged && RT.keys.shift ? 0 : 0);
        f.vy = Math.max(f.vy, 4.2);
        entMove(f, px / l * kb, 0, pz / l * kb);
        if (MOBS[f.k].pass) f.flee = 4;
        f.lastArrow = false; f.pk = 1;
        if (tool) wearHeld(1);
        addExh(0.1);
        snd(crit ? 'crit' : 'hit', 0, f.x, f.y + f.h * 0.6, f.z);
        if (f.hp > 0) snd('mob:' + f.k + ':hurt', f, f.x, f.y + f.h * 0.7, f.z);
        if (f.hp <= 0) { stat('c', 'mob_kills'); stat('k', f.k); foeDie(f, ench(h, 'looting')); killFoe(f); }
    }

    /* ── spawning ───────────────────────────────────────────── */
    function spawnTick() {
        if (!rule('doMobSpawning')) return;
        /* Peaceful used to be a lie: /difficulty wrote S.diff, the hostiles already
           standing there were culled, and the very next spawn tick put them back.
           Nothing else in the file ever read the value. */
        if (S.diff === 0) {
            for (var pk = RT.foes.length - 1; pk >= 0; pk--) if (RT.foes[pk].hostile) RT.foes.splice(pk, 1);
            return;
        }
        // only NEARBY animals count toward the cap, or eight sheep back at spawn starve every new biome of wildlife
        var hostiles = 0, passives = 0, i;
        for (i = 0; i < RT.foes.length; i++) {
            var f = RT.foes[i];
            if (Math.abs(f.x - S.px) > 64 || Math.abs(f.z - S.pz) > 64) continue;
            if (f.hostile) hostiles++; else passives++;
        }
        var st = skyState();
        if (hostiles < 10) trySpawn(true, st);
        if (passives < 8 && st.day) trySpawn(false, st);
        if (passives < 10 && Math.random() < 0.25) trySpawnSquid();
    }
    function trySpawn(hostile, st) {
        var keys = RT.ckeys;
        if (!keys.length) return;
        // Several candidate sites per tick, like the real game's spawn attempts. A hostile's Y is a
        // blind pick over the whole 96-block column, so a single try lands on a floor-with-headroom
        // barely 2% of the time — one attempt per second left nights all but empty while passives
        // (whose Y is the surface) filled their cap immediately. The gameplay gates below are
        // unchanged; only the number of sites sampled is.
        for (var att = 0; att < 24; att++) {
            var c = RT.chunks[keys[(Math.random() * keys.length) | 0]];
            if (!c) continue;
            var lx = (Math.random() * CW) | 0, lz = (Math.random() * CW) | 0;
            var wx = c.cx * CW + lx, wz = c.cz * CW + lz;
            var y = hostile ? 3 + ((Math.random() * (CH - 10)) | 0) : heightAt(wx, wz) + 1;
            if (y < 1 || y >= CH - 2) continue;
            // needs: solid floor, two air cells, nobody inside a wall (the Terraria lesson)
            if (!solidAt(wx, y - 1, wz)) continue;
            if (getB(wx, y, wz) !== AIR || getB(wx, y + 1, wz) !== AIR) continue;
            if (getB(wx, y - 1, wz) === -1) continue;
            var dx = wx + 0.5 - S.px, dz = wz + 0.5 - S.pz, dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 20 || dist > 52) continue;
            var kind;
            if (hostile) {
                var sky = getSky(wx, y, wz), blk = getBlk(wx, y, wz);
                if (blk >= 8) continue;                                   // torchlight keeps them out
                if (sky > 0 && (st.day || sky * st.dayF > 5)) continue;   // surface spawns only in darkness
                var r = Math.random();
                if (y < 40 && r < 0.14) kind = 'slime';                   // slimes deep down
                else if (r < 0.36) kind = 'zombie';
                else if (r < 0.55) kind = 'skeleton';
                else if (r < 0.72) kind = 'spider';
                else if (r < 0.9) kind = 'creeper';
                else kind = 'enderman';
            } else {
                if (getB(wx, y - 1, wz) !== GRASS) continue;
                if (getSky(wx, y, wz) < 9) continue;
                var r2 = Math.random();
                kind = r2 < 0.3 ? 'pig' : r2 < 0.55 ? 'cow' : r2 < 0.8 ? 'sheep' : 'chicken';
            }
            var nf = mkFoe(kind, wx + 0.5, y, wz + 0.5);
            if (kind === 'slime') { nf.sz = 1 + ((Math.random() * 3) | 0); applySlimeSize(nf); }
            RT.foes.push(nf);
            return;
        }
    }
    function trySpawnSquid() {   // squid live in water, ignore land rules
        var keys = RT.ckeys; if (!keys.length) return;
        var c = RT.chunks[keys[(Math.random() * keys.length) | 0]]; if (!c) return;
        var lx = (Math.random() * CW) | 0, lz = (Math.random() * CW) | 0;
        var wx = c.cx * CW + lx, wz = c.cz * CW + lz;
        for (var y = SEA; y > 6; y--) {
            if (getB(wx, y, wz) === WATER && getB(wx, y + 1, wz) === WATER && getB(wx, y - 1, wz) === WATER) {
                var dx = wx + 0.5 - S.px, dz = wz + 0.5 - S.pz, dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < 12 || dist > 48) return;
                RT.foes.push(mkFoe('squid', wx + 0.5, y, wz + 0.5));
                return;
            }
        }
    }

    /* ── experience ─────────────────────────────────────────── */
    function xpForLevel(l) { return l >= 31 ? 9 * l - 158 : l >= 16 ? 5 * l - 38 : 2 * l + 7; }
    function xpBarFrac() { return xpForLevel(S.xpl) ? S.xp / xpForLevel(S.xpl) : 0; }
    function addXp(amt) {
        if (amt <= 0) return;
        S.xp += amt;
        S.score = (S.score || 0) + amt;   // Player.increaseScore: the death screen's score is the experience you gathered
        var leveled = false;
        while (S.xp >= xpForLevel(S.xpl)) { S.xp -= xpForLevel(S.xpl); S.xpl++; leveled = true; }
        if (leveled) snd(S.xpl % 5 === 0 ? 'levelbig' : 'level', S.xpl);
        if (S.xpl >= 30) unlock('xp30');
        paintXp();
        if (leveled) RT.panelDirty = 1;   // enchant options go affordable as levels arrive
    }
    function takeXpLevels(n) {   // spend whole levels (anvil/enchant); returns true if affordable
        if (S.xpl < n) return false;
        var cap0 = xpForLevel(S.xpl), frac = cap0 ? S.xp / cap0 : 0;   // keep the same bar fraction across the drop
        S.xpl -= n; S.xp = Math.floor(frac * xpForLevel(S.xpl));
        paintXp(); return true;
    }
    function spawnXp(x, y, z, amt) {
        while (amt > 0) {
            var v = amt >= 17 ? 17 : amt >= 7 ? 7 : amt >= 3 ? 3 : 1;   // orb denominations, like the game
            amt -= v;
            if (RT.orbs.length > 120) { addXp(v); continue; }
            var a = Math.random() * 6.28;
            RT.orbs.push({ x: x, y: y, z: z, vx: Math.cos(a) * 1.2, vy: 1.5 + Math.random(), vz: Math.sin(a) * 1.2, v: v, age: 0 });
        }
    }
    function orbUpdate(o, dt) {
        if (!chunkAt(Math.floor(o.x), Math.floor(o.z))) return false;
        o.age += dt;
        if (o.age > 300 || RT.dead) return o.age > 300;
        o.vy -= GRAV * 0.55 * dt;
        var f = { x: o.x, y: o.y, z: o.z, hw: 0.1, h: 0.2 };
        entMove(f, o.vx * dt, 0, o.vz * dt);
        var hy = entMove(f, 0, o.vy * dt, 0);
        o.x = f.x; o.y = f.y; o.z = f.z;
        if (hy.y) { o.vy = 0; o.vx *= 0.7; o.vz *= 0.7; }
        var px = S.px - o.x, py = (S.py + 0.9) - o.y, pz = S.pz - o.z;
        var dist = Math.sqrt(px * px + py * py + pz * pz);
        if (dist < 5 && o.age > 0.4) { var s = Math.min(9, 3 / Math.max(0.4, dist)); o.x += px * s * dt; o.y += py * s * dt; o.z += pz * s * dt; }
        if (dist < 0.9 && o.age > 0.3) { addXp(o.v); snd('orb'); return true; }
        return false;
    }

    /* ── item drops, arrows, TNT, particles ─────────────────── */
    function dropItem(x, y, z, id, c, dur, isDeath, enchObj, name) {
        // the cap keeps blast rubble bounded, but die() nulls your slots whether or
        // not the drop landed — so a death with a busy world silently ATE your gear.
        // Death scatters at most 40 stacks; let it through.
        if (RT.drops.length > 200 && !isDeath) return;
        var a = Math.random() * 6.28, v = isDeath ? 2.2 : 1.1;
        RT.drops.push({ x: x, y: y, z: z, vx: Math.cos(a) * v * Math.random(), vy: 2.6, vz: Math.sin(a) * v * Math.random(),
            it: id, c: c, dur: dur, ench: enchObj || null, iname: name || null, age: 0, hw: 0.12, h: 0.24 });
    }
    function dropUpdate(d, dt) {
        if (!chunkAt(Math.floor(d.x), Math.floor(d.z))) return false;   // frozen with its chunk
        d.age += dt;
        if (d.age > 300) return true;
        var water = getB(Math.floor(d.x), Math.floor(d.y), Math.floor(d.z)) === WATER;
        if (getB(Math.floor(d.x), Math.floor(d.y), Math.floor(d.z)) === LAVA) return true;   // burnt
        d.vy = water ? Math.min(d.vy + GRAV * 0.2 * dt, 0.8) : d.vy - GRAV * 0.7 * dt;
        var f = { x: d.x, y: d.y, z: d.z, hw: d.hw, h: d.h };
        var hit = entMove(f, d.vx * dt, 0, d.vz * dt);
        var hy = entMove(f, 0, d.vy * dt, 0);
        d.x = f.x; d.y = f.y; d.z = f.z;
        if (hy.y) { d.vy = 0; d.vx *= 0.6; d.vz *= 0.6; }
        if (hit.x) d.vx = 0; if (hit.z) d.vz = 0;
        if (RT.dead || d.age < 0.6) return false;
        var px = S.px - d.x, py = (S.py + 0.8) - d.y, pz = S.pz - d.z;
        var dist = Math.sqrt(px * px + py * py + pz * pz);
        if (dist < 1.6) { d.x += px / dist * 6 * dt; d.y += py / dist * 6 * dt; d.z += pz / dist * 6 * dt; }
        if (dist < 0.6) {
            var before = [];
            for (var hb = 0; hb < 9; hb++) before.push(S.inv[hb] ? S.inv[hb].id + ':' + S.inv[hb].c : '');
            before.push(S.off ? S.off.id + ':' + S.off.c : '');
            var left = invGive(d.it, d.c, d.dur, d.ench, d.iname);
            if (left === d.c) return false;         // no room at all: it stays
            stat('p', d.it, d.c - left);
            snd('pop');
            for (hb = 0; hb < 9; hb++) if ((S.inv[hb] ? S.inv[hb].id + ':' + S.inv[hb].c : '') !== before[hb]) RT.pops[hb] = 5 * HUD_TICK;
            if ((S.off ? S.off.id + ':' + S.off.c : '') !== before[9]) RT.pops[9] = 5 * HUD_TICK;   // the off hand pops too
            paintHotbar();
            RT.panelDirty = 1;   // an open screen shows the same slots; keep it honest
            if (d.it === 'leather') unlock('cow');
            if (left) { d.c = left; return false; } // partial fit: the rest stays
            return true;
        }
        return false;
    }
    function arrowUpdate(a, dt) {
        a.t += dt;
        if (a.t > 30) return true;
        a.vy -= 20 * dt;
        var nx = a.x + a.vx * dt, ny = a.y + a.vy * dt, nz = a.z + a.vz * dt;
        if (solidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
            // a burning arrow lights TNT, which is one of the three ways to set it off
            if (a.flame && getB(Math.floor(nx), Math.floor(ny), Math.floor(nz)) === TNT) igniteTnt(Math.floor(nx), Math.floor(ny), Math.floor(nz));
            else if (a.mine && !a.noPick) dropItem(a.x, a.y, a.z, 'arrow', 1);
            snd('thud', 0, nx, ny, nz);
            return true;
        }
        a.x = nx; a.y = ny; a.z = nz;
        if (a.mine) {
            for (var i = 0; i < RT.foes.length; i++) {
                var f = RT.foes[i];
                if (a.x > f.x - f.hw && a.x < f.x + f.hw && a.y > f.y && a.y < f.y + f.h && a.z > f.z - f.hw && a.z < f.z + f.hw) {
                    f.hp -= a.dmg; f.hurtF = 0.3; f.ifr = 0.4; f.lastArrow = true; f.pk = 1;
                    if (a.flame) f.fire = Math.max(f.fire || 0, 5);
                    if (a.punch) { var pl = Math.sqrt(a.vx * a.vx + a.vz * a.vz) || 1; entMove(f, a.vx / pl * a.punch * 0.6, 0, a.vz / pl * a.punch * 0.6); f.vy = Math.max(f.vy, 3); }
                    if (MOBS[f.k].pass) f.flee = 4;
                    var alive = f.hp > 0;
                    if (!alive) { foeDie(f); RT.foes.splice(i, 1); }
                    snd('thud', 0, f.x, f.y + f.h * 0.6, f.z);   // an arrow landing sounds the same in a mob as in a block
                    if (alive) snd('mob:' + f.k + ':hurt', f, f.x, f.y + f.h * 0.7, f.z);
                    snd('arrowhit');
                    return true;
                }
            }
        } else if (!RT.dead &&
            a.x > S.px - HW && a.x < S.px + HW && a.y > S.py && a.y < S.py + PH && a.z > S.pz - HW && a.z < S.pz + HW) {
            var l = Math.sqrt(a.vx * a.vx + a.vz * a.vz) || 1;
            hurt(a.dmg, [a.vx / l, a.vz / l], false, false, null, { m: 'arrow', by: 'Skeleton' });
            return true;
        }
        return false;
    }
    function igniteTnt(x, y, z) {
        setB(x, y, z, AIR);
        RT.tnts.push({ x: x + 0.5, y: y, z: z + 0.5, vy: 0, fuse: 4 });
        snd('tntfuse', 0, x + 0.5, y + 0.5, z + 0.5);
    }
    function tntUpdate(t, dt) {
        t.fuse -= dt;
        t.vy -= GRAV * dt;
        var f = { x: t.x, y: t.y, z: t.z, hw: 0.49, h: 0.98 };
        var hy = entMove(f, 0, t.vy * dt, 0);
        t.y = f.y;
        if (hy.y) t.vy = 0;
        if (t.fuse <= 0) { explode(t.x, t.y + 0.5, t.z, 4, 26); return true; }
        return false;
    }
    function explode(ex, ey, ez, r, maxDmg, by) {
        var bx = Math.round(ex), by = Math.round(ey), bz = Math.round(ez), i;
        for (var dx = -r; dx <= r; dx++) for (var dy = -r; dy <= r; dy++) for (var dz = -r; dz <= r; dz++) {
            if (dx * dx + dy * dy + dz * dz > r * r + 0.5) continue;
            var x = bx + dx, y = by + dy, z = bz + dz, b = getB(x, y, z);
            if (b <= 0 || B[b].hard < 0) continue;
            if (b === TNT) { setB(x, y, z, AIR, true); RT.tnts.push({ x: x + 0.5, y: y, z: z + 0.5, vy: 2, fuse: 0.3 + Math.random() * 0.8 }); continue; }
            setB(x, y, z, AIR, true);
            if (Math.random() < 0.3) {
                var ds = dropFor(b);
                for (i = 0; i < ds.length; i++) dropItem(x + 0.5, y + 0.3, z + 0.5, ds[i][0], ds[i][1]);
            }
        }
        // underwater craters flood instead of leaving permanent air bubbles
        for (var wx2 = bx - r; wx2 <= bx + r; wx2++) for (var wy2 = by - r; wy2 <= by + r; wy2++) for (var wz2 = bz - r; wz2 <= bz + r; wz2++) {
            if (getB(wx2, wy2, wz2) !== AIR) continue;
            if (getB(wx2, wy2 + 1, wz2) === WATER || getB(wx2 + 1, wy2, wz2) === WATER || getB(wx2 - 1, wy2, wz2) === WATER ||
                getB(wx2, wy2, wz2 + 1) === WATER || getB(wx2, wy2, wz2 - 1) === WATER) setB(wx2, wy2, wz2, WATER, true);
        }
        relight(bx, bz);
        for (var k in RT.chunks) if (RT.chunks[k].dirty) dirtyChunk(k);
        // hurt everything by proximity
        var pd = Math.sqrt((S.px - ex) * (S.px - ex) + (S.py + 0.9 - ey) * (S.py + 0.9 - ey) + (S.pz - ez) * (S.pz - ez));
        if (pd < r * 2) {
            var l = Math.sqrt((S.px - ex) * (S.px - ex) + (S.pz - ez) * (S.pz - ez)) || 1;
            hurt(Math.round(maxDmg * (1 - pd / (r * 2))), [(S.px - ex) / l, (S.pz - ez) / l], false, false, null, by ? { m: 'creeper', by: by } : { m: 'explosion' });
        }
        for (i = RT.foes.length - 1; i >= 0; i--) {
            var fo = RT.foes[i];
            var fd = Math.sqrt((fo.x - ex) * (fo.x - ex) + (fo.y - ey) * (fo.y - ey) + (fo.z - ez) * (fo.z - ez));
            if (fd < r * 2) {
                fo.hp -= Math.round(maxDmg * (1 - fd / (r * 2))); fo.hurtF = 0.3;
                if (fo.hp <= 0) { foeDie(fo); RT.foes.splice(i, 1); }
            }
        }
        boomParticles(ex, ey, ez, r);
        snd('boom', 0, ex, ey, ez);
    }
    function blockParticles(x, y, z, b) {
        var uv0 = tileUV(texSide(TEX[b]));
        for (var i = 0; i < 10; i++) {
            RT.parts.push({ x: x + Math.random(), y: y + Math.random(), z: z + Math.random(),
                vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3.5, vz: (Math.random() - 0.5) * 3,
                life: 0.4 + Math.random() * 0.5, u: uv0[0] + Math.random() * TS16 * 0.8, v: uv0[1] + Math.random() * TS16 * 0.8, s: 0.09 });
        }
    }
    function fireParticles(f) {
        var uv0 = tileUV(TILE.lava);
        for (var i = 0; i < 4; i++)
            RT.parts.push({ x: f.x + (Math.random() - 0.5) * 0.6, y: f.y + Math.random() * f.h, z: f.z + (Math.random() - 0.5) * 0.6,
                vx: 0, vy: 1.5, vz: 0, life: 0.4, u: uv0[0] + Math.random() * TS16 * 0.8, v: uv0[1] + Math.random() * TS16 * 0.8, s: 0.09 });
    }
    /* LivingEntity.makePoofParticles and ExplodeParticle: twenty puffs spread
       through the body, drifting out on a little random push, slowed by 0.9 a
       tick and rising faintly, grey to white, a tenth of a block times 1 to 7
       (mostly small), living 18 to 82 ticks and shrinking through eight sizes */
    function poofParticles(f) {
        var uv0 = tileUV(TILE.puff), hw = f.hw || 0.3;
        for (var i = 0; i < 20; i++) {
            var g = function () { return (Math.random() + Math.random() + Math.random() - 1.5) * 0.02 * 20 + (Math.random() * 2 - 1) * 0.05 * 20; };
            var life = (Math.floor(16 / (Math.random() * 0.8 + 0.2)) + 2) / 20;
            RT.parts.push({ x: f.x + (Math.random() * 2 - 1) * hw, y: f.y + Math.random() * f.h, z: f.z + (Math.random() * 2 - 1) * hw,
                vx: g(), vy: g(), vz: g(), life: life, life0: life, puff: 1, u: uv0[0] + INSET, v: uv0[1] + INSET, us: TS16 - 2 * INSET,
                s: 0.1 * (Math.random() * Math.random() * 6 + 1), dim: Math.random() * 0.3 + 0.7 });
        }
    }
    function critParticles(f) {
        var uv0 = tileUV(TILE.rlamp);   // warm little sparks around the hit
        for (var i = 0; i < 8; i++)
            RT.parts.push({ x: f.x + (Math.random() - 0.5) * 0.6, y: f.y + f.h * 0.6 + (Math.random() - 0.5) * 0.5, z: f.z + (Math.random() - 0.5) * 0.6,
                vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2,
                life: 0.3, u: uv0[0] + 6 * TS16 / 16, v: uv0[1] + 6 * TS16 / 16, s: 0.06 });
    }
    function boomParticles(x, y, z, r) {
        var uv0 = tileUV(TILE.wool);
        for (var i = 0; i < 40; i++) {
            var a = Math.random() * 6.28, e = Math.random() * 3.14;
            RT.parts.push({ x: x, y: y, z: z,
                vx: Math.cos(a) * Math.sin(e) * r * 2.4 * Math.random(), vy: Math.cos(e) * r * 2 * Math.random(), vz: Math.sin(a) * Math.sin(e) * r * 2.4 * Math.random(),
                life: 0.5 + Math.random() * 0.6, u: uv0[0] + 4 * TS16 / 16, v: uv0[1] + 4 * TS16 / 16, s: 0.16 });
        }
    }
    function partUpdate(p, dt) {
        p.life -= dt;
        if (p.life <= 0) return true;
        if (p.puff) {   // no weight to speak of: friction 0.9 a tick, gravity -0.1
            var fr = Math.pow(0.9, dt * 20);
            p.vx *= fr; p.vz *= fr; p.vy = p.vy * fr + 0.04 * 0.1 * 20 * dt * 20;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            return false;
        }
        p.vy -= 10 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (solidAt(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) { p.vy = 0; p.vx = 0; p.vz = 0; p.y = Math.ceil(p.y); }
        return false;
    }

    /* ── entity geometry: rebuilt every frame into RT.entV ──── */
    var FACE_SHADE = [0.72, 0.72, 1, 0.5, 0.85, 0.62];
    function pushBox(v, wx, wy, wz, hx, hy, hz, yc, ys, sw, pivY, tileFn, sk, bl, wh) {
        var cw = Math.cos(sw), swn = Math.sin(sw);
        for (var d = 0; d < 6; d++) {
            var tid = tileFn(d), uv0 = tileUV(tid);
            for (var k = 0; k < 4; k++) {
                var cr = FACE_C[d][k];
                var lx = (cr[0] - 0.5) * 2 * hx, ly = (cr[1] - 0.5) * 2 * hy, lz = (cr[2] - 0.5) * 2 * hz;
                if (sw) { var ry = pivY + (ly - pivY) * cw - lz * swn, rz = (ly - pivY) * swn + lz * cw; ly = ry; lz = rz; }
                var ox = yc * lx - ys * lz, oz = ys * lx + yc * lz;
                var f = faceUV(d, cr);
                v.push(wx + ox, wy + ly, wz + oz,
                    uv0[0] + INSET + f[0] * (TS16 - 2 * INSET), uv0[1] + INSET + f[1] * (TS16 - 2 * INSET),
                    sk, bl, FACE_SHADE[d], wh);
            }
        }
    }
    /* ── mob animation: the pose side ────────────────────────
       A part is rotated about its own hinge, the whole body is then tipped (a
       death topple, a squid nosing into its swim), scaled (a creeper swelling, a
       slime landing), turned to face the mob's yaw and dropped into the world.
       Four transforms, folded into one 3×3 and an offset per part, so the inner
       loop stays a multiply-add over 24 corners.

       Rotations compose Rz·Ry·Rx, the order the real game's model parts use, and
       the yaw matrix is the engine's own (+z is forward, so a mob's face tile is
       the +z face). */
    function rotMat(m, rx, ry, rz) {
        var cx = Math.cos(rx), sx = Math.sin(rx);
        var cy = Math.cos(ry), sy = Math.sin(ry);
        var cz = Math.cos(rz), sz = Math.sin(rz);
        m[0] = cz * cy; m[1] = -cz * sy * sx - sz * cx; m[2] = -cz * sy * cx + sz * sx;
        m[3] = sz * cy; m[4] = -sz * sy * sx + cz * cx; m[5] = -sz * sy * cx - cz * sx;
        m[6] = sy;      m[7] = cy * sx;                 m[8] = cy * cx;
    }
    function mul3(o, a, b) {
        var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7], a8 = a[8];
        var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3], b4 = b[4], b5 = b[5], b6 = b[6], b7 = b[7], b8 = b[8];
        o[0] = a0 * b0 + a1 * b3 + a2 * b6; o[1] = a0 * b1 + a1 * b4 + a2 * b7; o[2] = a0 * b2 + a1 * b5 + a2 * b8;
        o[3] = a3 * b0 + a4 * b3 + a5 * b6; o[4] = a3 * b1 + a4 * b4 + a5 * b7; o[5] = a3 * b2 + a4 * b5 + a5 * b8;
        o[6] = a6 * b0 + a7 * b3 + a8 * b6; o[7] = a6 * b1 + a7 * b4 + a8 * b7; o[8] = a6 * b2 + a7 * b5 + a8 * b8;
    }
    var M_TIP = new Float64Array(9), M_YS = new Float64Array(9), M_ROOT = new Float64Array(9);
    var M_PART = new Float64Array(9), M_ALL = new Float64Array(9);
    var BABY_HEAD = 1.62;
    // scratch, reused: at sixty mobs and ten parts each, a fresh object per part
    // per frame is a hundred thousand a minute for the collector to sweep up
    var R = { rx: 0, rz: 0, sx: 1, sy: 1, sz: 1, py: 0, ox: 0, oz: 0 };
    var P = { rx: 0, ry: 0, rz: 0, ox: 0, oy: 0, oz: 0, s: 1, px: 0, py: 0, pz: 0 };
    var HEADP = { rx: 0, ry: 0, rz: 0, px: 0, py: 0, pz: 0, dy: 0, s: 1 };
    var SLEG_FAN = [0.7854, 0.3927, -0.3927, -0.7854];
    var SLEG_PH = [0, 3.1416, 1.5708, 4.7124];

    function mobRoot(f, md) {
        R.rx = 0; R.rz = 0; R.py = 0; R.ox = 0; R.oz = 0;
        var s = f.baby > 0 ? 0.55 : 1;
        if (md.cube) s *= f.h / (8 * PX) * 0.92;   // a slime is only ever as big as its own hitbox
        R.sx = R.sy = R.sz = s;
        if (f.dieT != null) {
            /* LivingEntityRenderer.setupRotations: over onto its side on
               sqrt((deathTime - 1) / 20 x 1.6), flat after about thirteen ticks,
               lying there until the twentieth, when it goes up in smoke */
            var dtk = f.dieT * 20;
            R.rz = Math.min(1, Math.sqrt(Math.max(0, (dtk - 1) / 20 * 1.6))) * 1.5708;
            return;
        }
        if (f.fuse > 0) {
            /* the swell: a creeper goes WIDE, barely taller, and shivers at a
               frequency that has nothing to do with either */
            var q = Math.min(1, f.fuse / 1.5); q = q * q; q = q * q;
            var jit = 1 + Math.sin(f.fuse * 100) * Math.min(1, f.fuse / 1.5) * 0.01;
            R.sx *= (1 + q * 0.4) * jit; R.sz *= (1 + q * 0.4) * jit; R.sy *= (1 + q * 0.1) / jit;
        }
        if (md.hop) {   // flat on landing, drawn out on the way up
            var f1 = f.squish / (f.sz * 0.5 + 1), f2 = 1 / (f1 + 1);
            R.sx *= f2; R.sz *= f2; R.sy /= f2;
        }
        if (f.k === 'squid') { R.rx = f.pitchA; R.py = 9; }
        /* An angry enderman shakes. It is two hundredths of a block of jitter and
           it is the entire tell that the thing you looked at has noticed. */
        if (f.aggro > 0) { R.ox = (Math.random() - 0.5) * 0.05; R.oz = (Math.random() - 0.5) * 0.05; }
    }
    // grow a part about its hinge rather than its middle, so a baby's head keeps
    // its neck where the neck was
    function scaleAbout(pt, o, s) {
        o.s = s;
        o.ox += (o.px - pt[3]) * (1 - s);
        o.oy += (o.py - pt[4]) * (1 - s);
        o.oz += (o.pz - pt[5]) * (1 - s);
    }
    /* Poses one part. Heads must be posed before anything bolted to them, which
       every model above satisfies by listing the head second. */
    function posePart(f, md, pt, o) {
        var role = pt[7] || '', i = pt[8] || 0;
        var amt = f.swAmt, ph = f.anim, age = f.age;
        o.rx = o.ry = o.rz = 0; o.ox = o.oy = o.oz = 0; o.s = 1;
        if (pt[9]) { o.px = pt[9][0]; o.py = pt[9][1]; o.pz = pt[9][2]; }
        else if (role === 'leg' || role === 'arm') { o.px = pt[3]; o.py = pt[4] + pt[1] / 2; o.pz = pt[5]; }
        else { o.px = pt[3]; o.py = pt[4]; o.pz = pt[5]; }

        if (HEAD_KID[role]) {
            o.rx = HEADP.rx; o.ry = HEADP.ry; o.rz = HEADP.rz;
            o.px = HEADP.px; o.py = HEADP.py; o.pz = HEADP.pz; o.oy = HEADP.dy;
            if (HEADP.s !== 1) scaleAbout(pt, o, HEADP.s);
            return;
        }
        switch (role) {
        case 'head':
            o.ry = f.hYaw; o.rx = f.hPitch;
            if (f.graze > 0) {
                /* down into the grass over a fifth of a second, held there while
                   it crops, and the head shakes as it tears — the real game's
                   sheepTimer curve, which is 40 ticks with a wobble on top */
                var g = f.graze > 1.8 ? (2 - f.graze) / 0.2 : f.graze < 0.2 ? f.graze / 0.2 : 1;
                o.rx = o.rx * (1 - g) + g * (0.628 + 0.22 * Math.sin(f.graze * 28.7));
                o.ry *= 1 - g;
                o.oy -= g * 1.5; o.py -= g * 1.5;
            }
            if (f.k === 'enderman' && f.aggro > 0) o.rx += 0.2;
            HEADP.rx = o.rx; HEADP.ry = o.ry; HEADP.rz = o.rz;
            HEADP.px = o.px; HEADP.py = o.py; HEADP.pz = o.pz; HEADP.dy = o.oy; HEADP.s = 1;
            if (f.baby > 0) { scaleAbout(pt, o, BABY_HEAD); HEADP.s = BABY_HEAD; }
            break;
        case 'body':
            if (f.k === 'enderman' && f.aggro > 0) o.rx = -0.12;   // leans in when it has decided about you
            break;
        case 'leg':
            // the diagonal pairs share a phase; a biped's two legs fall out of the same rule
            o.rx = Math.cos(ph + ((i === 0 || i === 3) ? 0 : Math.PI)) * 1.4 * amt;
            if (f.k === 'enderman') o.rx *= 0.5;                   // the long, gliding stride
            break;
        case 'arm':
            o.rx = Math.cos(ph + (i ? 0 : Math.PI)) * amt;         // opposite the leg on the same side
            if (f.k === 'zombie' && f.chase) {
                /* arms out, locked, swaying — the pose. It only holds them up
                   while it is actually coming for you; a wandering zombie walks
                   with its arms down, same as the real game. */
                o.rx = -1.5708 + Math.sin(age * 0.067) * 0.05 * (i ? -1 : 1);
                o.rz = (i ? 1 : -1) * (Math.cos(age * 0.09) * 0.05 + 0.05);
            }
            // long arms, half the swing of anything else, hanging and drifting
            if (f.k === 'enderman') {
                o.rx *= 0.5;
                o.rz = (i ? 1 : -1) * (0.05 + Math.cos(age * 0.09) * 0.05);
            }
            if (f.k === 'skeleton' && f.aim > 0) {   // both arms up on the bow, one swung wide
                o.rx = o.rx * (1 - f.aim) + (-1.5708 + f.hPitch) * f.aim;
                o.ry += f.aim * (i ? -0.1 : 0.5) + f.hYaw * f.aim;
            }
            if (f.atk > 0 && i === 1) {
                // the real game's two out-of-phase envelopes: the arm leaps out
                // and eases back, and the roll lags behind the reach
                var p = 1 - f.atk / ATK_T, q2 = 1 - (1 - p) * (1 - p) * (1 - p) * (1 - p);
                o.rx -= Math.sin(q2 * Math.PI) * 1.35;
                o.rz -= Math.sin(p * Math.PI) * 0.4;
            }
            break;
        case 'wing':
            // folded flat when it is standing, wide open the moment it is not
            o.rz = (Math.sin(f.wingT) + 1) * f.flap * (i ? 1 : -1);
            break;
        case 'sleg': {
            /* Eight legs in four pairs, each pair a quarter-cycle behind the
               last: they fan fore-and-aft while they lift and plant, which is
               what the real game does and the only reason this reads as a
               scuttle rather than eight sticks waving. */
            var side = (i & 1) ? -1 : 1, pair = i >> 1;
            var wob = -(Math.cos(ph * 2 + SLEG_PH[pair]) * 0.4) * amt;
            var lift = Math.abs(Math.sin(ph + SLEG_PH[pair]) * 0.4) * amt;
            o.ry = (SLEG_FAN[pair] + wob) * side;
            o.rz = (-((pair === 0 || pair === 3) ? 0.7854 : 0.5812) + lift) * side;
            break;
        }
        case 'tent': {
            var a = i / 8 * 6.2832;   // fan out radially, all eight together
            o.rz = Math.cos(a) * f.tentA;
            o.rx = -Math.sin(a) * f.tentA;
            break;
        }
        }
    }
    /* the tile a face wears: a named part tile if the mob has one, else the face
       on the front, the alt hide on the body, and the plain hide everywhere else */
    var TQ = { face: 0, alt: 0, skin: 0, tex: null, fl: 0, role: '' };
    function mobTile(d) {
        if (TQ.tex) { var t = TQ.tex[TQ.role]; if (t !== undefined) return t; }
        return (TQ.fl & 1) && d === 4 ? TQ.face : (TQ.fl & 8) ? TQ.alt : TQ.skin;
    }
    function pushMob(v, f) {
        var md = MOBS[f.k];
        if (!md) return;
        var L = cellLight(f.x, f.y + f.h * 0.5, f.z);
        /* OverlayTexture: a hurt or dying mob is drawn 30% red for its ten hurt
           ticks; a creeper about to blow flashes white on the beat of its swell */
        if (f.hpSeen == null) f.hpSeen = f.hp;
        if (f.hp < f.hpSeen) f.redT = RT.worldMs + 500;
        f.hpSeen = f.hp;
        var wh = f.dieT != null || RT.worldMs < (f.redT || 0) ? -0.3 : 0;
        if (f.fuse > 0 && ((f.fuse / 1.5 * 10) | 0) % 2) wh = Math.max(0.5, Math.min(1, f.fuse / 1.5));
        TQ.skin = TILE[md.skin]; TQ.alt = TILE[md.alt || md.skin];
        TQ.face = TILE[md.rage && f.aggro > 0 ? md.rage : md.face];
        TQ.tex = null;
        if (md.tex) { TQ.tex = md._tex || (md._tex = mobTex(md.tex)); }
        mobRoot(f, md);
        // yaw · scale, and again with the whole-body tip folded in
        var yc = Math.cos(f.yaw), ys = Math.sin(f.yaw);
        M_YS[0] = yc * R.sx; M_YS[1] = 0; M_YS[2] = -ys * R.sz;
        M_YS[3] = 0; M_YS[4] = R.sy; M_YS[5] = 0;
        M_YS[6] = ys * R.sx; M_YS[7] = 0; M_YS[8] = yc * R.sz;
        rotMat(M_TIP, R.rx, 0, R.rz);
        mul3(M_ROOT, M_YS, M_TIP);
        var rpy = R.py * PX;
        for (var p = 0; p < md.parts.length; p++) {
            var pt = md.parts[p];
            posePart(f, md, pt, P);
            rotMat(M_PART, P.rx, P.ry, P.rz);
            mul3(M_ALL, M_ROOT, M_PART);
            var cx = (pt[3] + P.ox) * PX, cy = (pt[4] + P.oy) * PX, cz = (pt[5] + P.oz) * PX;
            var vx = P.px * PX, vy = P.py * PX, vz = P.pz * PX;
            // u = pivot − (part rotation · pivot) − root pivot; the offset that keeps
            // a hinge exactly where the hinge is while everything turns around it
            var ux = vx - (M_PART[0] * vx + M_PART[1] * vy + M_PART[2] * vz);
            var uy = vy - (M_PART[3] * vx + M_PART[4] * vy + M_PART[5] * vz) - rpy;
            var uz = vz - (M_PART[6] * vx + M_PART[7] * vy + M_PART[8] * vz);
            var tx = M_TIP[0] * ux + M_TIP[1] * uy + M_TIP[2] * uz;
            var ty = M_TIP[3] * ux + M_TIP[4] * uy + M_TIP[5] * uz + rpy;
            var tz = M_TIP[6] * ux + M_TIP[7] * uy + M_TIP[8] * uz;
            var ox = f.x + R.ox + M_ALL[0] * cx + M_ALL[1] * cy + M_ALL[2] * cz + M_YS[0] * tx + M_YS[1] * ty + M_YS[2] * tz;
            var oy = f.y + M_ALL[3] * cx + M_ALL[4] * cy + M_ALL[5] * cz + M_YS[3] * tx + M_YS[4] * ty + M_YS[5] * tz;
            var oz = f.z + R.oz + M_ALL[6] * cx + M_ALL[7] * cy + M_ALL[8] * cz + M_YS[6] * tx + M_YS[7] * ty + M_YS[8] * tz;
            var hx = pt[0] / 2 * PX * P.s, hy = pt[1] / 2 * PX * P.s, hz = pt[2] / 2 * PX * P.s;
            TQ.fl = pt[6]; TQ.role = pt[7] || '';
            pushPosed(v, M_ALL, ox, oy, oz, hx, hy, hz, L[0], L[1], wh);
        }
    }
    function mobTex(names) {   // role → tile id, resolved once per mob kind
        var o = {};
        for (var k in names) o[k] = TILE[names[k]];
        return o;
    }
    /* One box through an arbitrary rotation. The face shade comes off the TURNED
       normal rather than the model face, because a leg swung through ninety
       degrees, or a body lying on its side, has to catch the light of the
       direction it now points; for an unrotated part the blend lands exactly on
       the old per-face constants, so nothing that used to face +y got darker. */
    function pushPosed(v, m, wx, wy, wz, hx, hy, hz, sk, bl, wh) {
        for (var d = 0; d < 6; d++) {
            var tid = mobTile(d), uv0 = tileUV(tid);
            var n = FACE_N[d];
            var nx = m[0] * n[0] + m[1] * n[1] + m[2] * n[2];
            var ny = m[3] * n[0] + m[4] * n[1] + m[5] * n[2];
            var nz = m[6] * n[0] + m[7] * n[1] + m[8] * n[2];
            var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;
            var shade = nx * nx * FACE_SHADE[nx > 0 ? 0 : 1] + ny * ny * FACE_SHADE[ny > 0 ? 2 : 3] + nz * nz * FACE_SHADE[nz > 0 ? 4 : 5];
            for (var k = 0; k < 4; k++) {
                var cr = FACE_C[d][k];
                var lx = (cr[0] - 0.5) * 2 * hx, ly = (cr[1] - 0.5) * 2 * hy, lz = (cr[2] - 0.5) * 2 * hz;
                var fu = faceUV(d, cr);
                v.push(wx + m[0] * lx + m[1] * ly + m[2] * lz,
                    wy + m[3] * lx + m[4] * ly + m[5] * lz,
                    wz + m[6] * lx + m[7] * ly + m[8] * lz,
                    uv0[0] + INSET + fu[0] * (TS16 - 2 * INSET), uv0[1] + INSET + fu[1] * (TS16 - 2 * INSET),
                    sk, bl, shade, wh);
            }
        }
    }
    function pushBillboard(v, x, y, z, size, u0, v0, u1, v1, sk, bl, wh, ao) {
        var r = RT.camR, u = RT.camU;
        var cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (var k = 0; k < 4; k++) {
            var a = cs[k][0] * size, b = cs[k][1] * size;
            v.push(x + r[0] * a + u[0] * b, y + r[1] * a + u[1] * b, z + r[2] * a + u[2] * b,
                cs[k][0] > 0 ? u1 : u0, cs[k][1] > 0 ? v0 : v1,
                sk, bl, ao === undefined ? 1 : ao, wh);
        }
    }
    /* EntityRenderDispatcher.renderFlame: a burning mob wears fire_0 and fire_1
       in turn, square quads 1.4 times its width stacked up its height 0.45
       apart, each 0.9 the width of the one below and set a little further back,
       turned to face you and pushed toward you, full bright. The game animates
       the two textures; here they trade places and mirror every tick or two. */
    function pushFlame(v, f) {
        var w = (f.hw || 0.3) * 2 * 1.4, h = f.h / w, x1 = 0.5, y0 = 0, z = 0, k = 0, tk = Math.floor(RT.worldMs / 50);
        var tx = S.px - f.x, tz = S.pz - f.z, tl = Math.sqrt(tx * tx + tz * tz) || 1;
        tx /= tl; tz /= tl;
        var rx = tz, rz = -tx, push = (0.3 - Math.floor(h) * 0.02) * w;
        var bx = f.x + tx * push, bz = f.z + tz * push;
        while (h > 0) {
            var uv = tileUV((k + tk) % 2 ? TILE.fire1 : TILE.fire0), u0 = uv[0] + INSET, u1 = uv[0] + TS16 - INSET, va = uv[1] + INSET, vb = uv[1] + TS16 - INSET;
            if (((k >> 1) + (tk >> 1)) % 2 === 0) { var sw = u0; u0 = u1; u1 = sw; }
            var cx = bx + tx * z * w, cz = bz + tz * z * w, ya = f.y + y0 * w, yb = f.y + (y0 + 1.4) * w, hx = rx * x1 * w, hz = rz * x1 * w;
            v.push(cx - hx, ya, cz - hz, u0, vb, 1, 1, 1, 0);
            v.push(cx + hx, ya, cz + hz, u1, vb, 1, 1, 1, 0);
            v.push(cx + hx, yb, cz + hz, u1, va, 1, 1, 1, 0);
            v.push(cx - hx, yb, cz - hz, u0, va, 1, 1, 1, 0);
            h -= 0.45; y0 += 0.45; x1 *= 0.9; z -= 0.03; k++;
        }
    }
    function cellLight(x, y, z) {
        return [Math.max(getSky(Math.floor(x), Math.floor(y), Math.floor(z)), 0) / 15,
                Math.max(getBlk(Math.floor(x), Math.floor(y), Math.floor(z)), 0) / 15];
    }
    function entGeo() {
        var v = RT.entV = [], i, d;
        // camera basis for billboards
        var cy = Math.cos(S.yaw), sy = Math.sin(S.yaw), cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
        RT.camR = [cy, 0, sy];
        RT.camU = [sy * sp, cp, -cy * sp];
        for (i = 0; i < RT.foes.length; i++) pushMob(v, RT.foes[i]);
        for (i = 0; i < RT.dying.length; i++) pushMob(v, RT.dying[i]);   // bodies still falling over
        for (i = 0; i < RT.foes.length; i++) if (RT.foes[i].fire > 0) pushFlame(v, RT.foes[i]);
        for (i = 0; i < RT.dying.length; i++) if (RT.dying[i].fire > 0) pushFlame(v, RT.dying[i]);
        for (i = 0; i < RT.tnts.length; i++) {
            var t = RT.tnts[i];
            var TL = cellLight(t.x, t.y + 0.5, t.z);
            pushBox(v, t.x, t.y + 0.5, t.z, 0.49, 0.49, 0.49, 1, 0, 0, 0,
                function (dd) { return dd === 2 || dd === 3 ? TILE.tnt_top : TILE.tnt_side; },
                TL[0], TL[1], (t.fuse * 5 & 1) ? 0.75 : 0.1);
        }
        /* ItemEntityRenderer: every drop the item's own model, bobbing
           sin(age / 10 + offset) x 0.1 + 0.1 and turning a radian a second from
           its own random start, at its ground size (a flat item at half size two
           pixels up, a block at a quarter three up); a stack shows 2 to 5 copies,
           a block's scattered 0.15 each way and a flat item's fanned 1.5 pixels
           apart */
        for (i = 0; i < RT.drops.length; i++) {
            var dr = RT.drops[i], def = I[dr.it];
            if (dr.bo == null) dr.bo = Math.random() * Math.PI * 2;
            var tk = RT.worldMs / 50 + (dr.bo * 7919 % 20), cube = isCubeItem(def);
            var DL = cellLight(dr.x, dr.y + 0.2, dr.z), gs = cube ? 0.25 : 0.5;
            var M0 = emMul(emT(dr.x, dr.y + Math.sin(tk / 10 + dr.bo) * 0.1 + 0.1 + 0.25 * gs, dr.z), emRy(tk / 20 + dr.bo));
            var n = dr.c > 48 ? 5 : dr.c > 32 ? 4 : dr.c > 16 ? 3 : dr.c > 1 ? 2 : 1, rnd = mulb(dr.it.length * 131 + dr.c);
            for (var cpy = 0; cpy < n; cpy++) {
                var M = M0;
                if (cube) {
                    if (cpy) M = emMul(M, emT((rnd() * 2 - 1) * 0.15, (rnd() * 2 - 1) * 0.15, (rnd() * 2 - 1) * 0.15));
                    M = emMul(M, emT(0, 3 / 16, 0)); M = emMul(M, emS(gs, gs, gs)); M = emMul(M, emT(-0.5, -0.5, -0.5));
                    pushCube(v, M, 0, 0, 0, 1, 1, 1, (function (pl) { return function (dd) { return texFace(TEX[pl], dd); }; })(def.place), DL[0], DL[1]);
                } else {
                    var zo = (cpy - (n - 1) / 2) * 0.09375;
                    M = emMul(M, emT(cpy ? (rnd() * 2 - 1) * 0.0375 : 0, cpy ? (rnd() * 2 - 1) * 0.0375 : 0, zo));
                    M = emMul(M, emT(0, 2 / 16, 0)); M = emMul(M, emS(gs, gs, gs)); M = emMul(M, emT(-0.5, -0.5, -0.5));
                    var tid2 = def && def.tile != null ? def.tile : (def && def.place != null ? texTop(TEX[def.place]) : TILE.i_stick);
                    pushModel(v, M, flatModel(tid2), 1 / 16, DL[0], DL[1]);
                }
            }
        }
        for (i = 0; i < RT.arrows.length; i++) {
            var ar = RT.arrows[i];
            var AL = cellLight(ar.x, ar.y, ar.z);
            var ayaw = Math.atan2(-ar.vx, ar.vz);
            var apitch = Math.atan2(ar.vy, Math.sqrt(ar.vx * ar.vx + ar.vz * ar.vz));   // tip with the trajectory
            pushBox(v, ar.x, ar.y, ar.z, 0.03, 0.03, 0.28, Math.cos(ayaw), Math.sin(ayaw), -apitch, 0,
                function () { return TILE.arrow; }, AL[0], AL[1], 0);
        }
        /* ExperienceOrbRenderer: 0.1 up, facing you, full bright, its colour
           (sin(t) + 1) / 2 red, full green and (sin(t + 4.19) + 1) / 10 blue at
           t = age / 2 in ticks, so it throbs green to yellow a couple of times a
           second; the shader reads the phase out of the overlay value */
        for (i = 0; i < RT.orbs.length; i++) {
            var o = RT.orbs[i], ou = tileUV(TILE.xporb), oph = ((o.age * 10) % 6.2831853) / 6.2831853;
            pushBillboard(v, o.x, o.y + 0.1, o.z, o.v >= 7 ? 0.16 : 0.11, ou[0] + INSET, ou[1] + INSET, ou[0] + TS16 - INSET, ou[1] + TS16 - INSET, 1, 1, 2 + oph);
        }
        for (i = 0; i < RT.parts.length; i++) {
            var pp = RT.parts[i];
            var PL = cellLight(pp.x, pp.y, pp.z);
            // dim: a flat tint on the mote, the way the real game darkens block
            // dust to 0.6 — without it, sand kicked off sand is invisible
            var ps = pp.puff ? pp.s * (8 - Math.min(7, Math.floor((1 - pp.life / pp.life0) * 8))) / 8 : pp.s, pus = pp.us || TS16 / 10;
            pushBillboard(v, pp.x, pp.y, pp.z, ps, pp.u, pp.v, pp.u + pus, pp.v + pus, Math.max(0.25, PL[0]), PL[1], 0, pp.dim || 1);
        }
        if (RT.sleep) {   // fade handled by overlay; nothing extra here
        }
    }

    /* ── the camera and the hands, on the game's tick ─────────────
       GameRenderer and ItemInHandRenderer keep their state on the 20 Hz tick
       and draw between ticks at the partial tick. Here that is: the view bob
       (walkDist and bob), the FOV modifier, the hurt tilt and the death roll,
       the eye easing down into a sneak, the hand lagging behind the look
       (xBob, yBob), both hands' equip heights, the swing, and the vignette's
       slow brightness. */
    var CAM = null;
    function camNew() {
        return { acc: 0, walk: 0, walkO: 0, bob: 0, bobO: 0, fov: 1, fovO: 1, hurt: 0, hurtDir: 0, death: 0, eye: EYE, eyeO: EYE,
            xb: S ? S.pitch * 180 / Math.PI : 0, yb: S ? S.yaw * 180 / Math.PI : 0, xbO: 0, ybO: 0, last: null,
            mainH: 0, mainHO: 0, offH: 0, offHO: 0, vMain: '', vOff: '', vMainSt: null, vOffSt: null, swOn: false, swT: 0, att: 0, attO: 0, vig: 0, vigO: 0 };
    }
    // canInstantlyReplace: the same item, count and components, damage aside
    function stackKey(st) { return st ? st.id + ':' + st.c + ':' + (st.name || '') + ':' + (st.ench ? JSON.stringify(st.ench) : '') : ''; }
    function swingDur() { var haste = effLvl('haste'), fat = effLvl('mining_fatigue'); return Math.max(1, haste ? 6 - haste : fat ? 6 + fat * 2 : 6); }
    function camTick() {
        var C = CAM;
        // LocalPlayer.move adds 0.6 of each tick's horizontal travel to walkDist; the bob chases min(0.1, speed) on the ground
        var hv = C.last ? Math.sqrt((S.px - C.last[0]) * (S.px - C.last[0]) + (S.pz - C.last[2]) * (S.pz - C.last[2])) : 0;
        if (hv > 2) hv = 0;   // a teleport, a respawn
        C.last = [S.px, S.py, S.pz];
        C.walkO = C.walk; C.bobO = C.bob;
        var swim = RT.sprint && getB(Math.floor(S.px), Math.floor(S.py + EYE), Math.floor(S.pz)) === WATER;
        C.bob += ((RT.ground && !RT.dead && !RT.fly && !swim ? Math.min(0.1, hv) : 0) - C.bob) * 0.4;
        C.walk += 0.6 * hv;
        C.fovO = C.fov;
        C.fov = Math.max(0.1, Math.min(1.5, C.fov + (fovTarget() - C.fov) * 0.5));
        if (C.hurt > 0) C.hurt--;
        C.death = RT.dead ? C.death + 1 : 0;
        // the eye: 1.62 standing, 1.27 crouched, half the gap a tick
        C.eyeO = C.eye;
        C.eye += ((RT.keys && RT.keys.shift && !RT.fly && !swim ? 1.27 : EYE) - C.eye) * 0.5;
        C.xbO = C.xb; C.ybO = C.yb;
        C.xb += (S.pitch * 180 / Math.PI - C.xb) * 0.5; C.yb += (S.yaw * 180 / Math.PI - C.yb) * 0.5;
        // the swing: attackAnim = swingTime / duration, six ticks unless Haste or Mining Fatigue
        C.attO = C.att;
        var dur = swingDur();
        if (C.swOn) { C.swT++; if (C.swT >= dur) { C.swT = 0; C.swOn = false; } } else C.swT = 0;
        C.att = C.swT / dur;
        // ItemInHandRenderer.tick: the old item drops, the new one rises on the cube of the attack recharge
        C.mainHO = C.mainH; C.offHO = C.offH;
        var hm = held() || null, ho = S.off || null, km = stackKey(hm), ko = stackKey(ho);
        if (C.vMain === km) C.vMainSt = hm;
        if (C.vOff === ko) C.vOffSt = ho;
        var c = RT.atkCdMax > 0 ? Math.max(0, Math.min(1, ((RT.atkCdMax - RT.atkCd) * 20 + 1) / (RT.atkCdMax * 20))) : 1;
        C.mainH += Math.max(-0.4, Math.min(0.4, (C.vMain !== km ? 0 : c * c * c) - C.mainH));
        C.offH += Math.max(-0.4, Math.min(0.4, (C.vOff !== ko ? 0 : 1) - C.offH));
        if (C.mainH < 0.1) { C.vMain = km; C.vMainSt = hm; }
        if (C.offH < 0.1) { C.vOff = ko; C.vOffSt = ho; }
        // Gui.updateVignetteBrightness: 1% of the way a tick toward 1 - brightness at the eye
        var L = cellLight(S.px, S.py + EYE, S.pz), f = Math.max(L[0] * skyState().dayF, L[1]);
        C.vigO = C.vig;
        C.vig += (Math.max(0, Math.min(1, 1 - f / (4 - 3 * f))) - C.vig) * 0.01;
    }
    function camFrame(dt) {
        if (!CAM) CAM = camNew();
        CAM.acc += Math.min(0.25, dt);
        while (CAM.acc >= HUD_TICK) { CAM.acc -= HUD_TICK; camTick(); }
    }
    function camPt() { return CAM ? Math.max(0, Math.min(1, CAM.acc / HUD_TICK)) : 0; }
    function camSwing() {   // LivingEntity.swing: a swing only starts over once it is past halfway
        if (!CAM) CAM = camNew();
        var dur = swingDur();
        if (!CAM.swOn || CAM.swT >= (dur >> 1) || CAM.swT < 0) { CAM.swT = -1; CAM.swOn = true; }
    }
    function camHurt(dir) {   // animateHurt: ten ticks of tilt, toward the side it came from when it came from somewhere
        if (!CAM) CAM = camNew();
        CAM.hurt = 10;
        if (dir) CAM.hurtDir = Math.atan2(-dir[1], -dir[0]) * 180 / Math.PI - (S.yaw * 180 / Math.PI + 180);
    }
    function emRz(a) { var c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]; }
    function emGl(E) { return [E[0], E[4], E[8], 0, E[1], E[5], E[9], 0, E[2], E[6], E[10], 0, E[3], E[7], E[11], 1]; }
    /* GameRenderer.bobHurt then bobView, in view space: the death roll, the
       hurt tilt (-sin(t^4 pi) x 14 degrees about the direction of the hit,
       times Damage Tilt) and the walking bob */
    function camFx(pt) {
        var M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], D = Math.PI / 180, o = optLoad();
        if (!CAM) return M;
        if (RT.dead) { var d = Math.min(CAM.death + pt, 20); M = emMul(M, emRz((40 - 8000 / (d + 200)) * D)); }
        var ht = CAM.hurt - pt;
        if (CAM.hurt > 0 && ht >= 0) {
            var t = ht / 10, s = Math.sin(t * t * t * t * Math.PI), tilt = o.tilt == null ? 1 : o.tilt;
            M = emMul(M, emRy(-CAM.hurtDir * D)); M = emMul(M, emRz(-s * 14 * tilt * D)); M = emMul(M, emRy(CAM.hurtDir * D));
        }
        if (o.bob !== false) {
            var P = -(CAM.walk + (CAM.walk - CAM.walkO) * pt) * Math.PI, b = CAM.bobO + (CAM.bob - CAM.bobO) * pt;
            M = emMul(M, emT(Math.sin(P) * b * 0.5, -Math.abs(Math.cos(P) * b), 0));
            M = emMul(M, emRz(Math.sin(P) * b * 3 * D));
            M = emMul(M, emRx(Math.abs(Math.cos(P - 0.2) * b) * 5 * D));
        }
        return M;
    }
    // the death and fluid squeeze on the field of view, shared by the world and the hand
    function camFovK(pt) {
        var k = 1;
        if (RT.dead && CAM) { var d = Math.min(CAM.death + pt, 20); k /= 1 + 2 * (1 - 500 / (d + 500)); }
        var hb = getB(Math.floor(S.px), Math.floor(S.py + camEye(pt)), Math.floor(S.pz));
        if (hb === WATER || hb === LAVA) k *= 6 / 7;
        return k;
    }
    function camEye(pt) { return CAM ? CAM.eyeO + (CAM.eye - CAM.eyeO) * pt : EYE; }

    /* ── the held item, drawn the game's way ──
       A flat item is its 16x16 sprite made solid, ItemModelGenerator's way: a
       front face and a mirrored back one pixel apart, and a one-pixel strip
       along every edge between an opaque pixel and a clear one, taking that
       pixel's colour. Built once per texture from the atlas's own alpha. */
    var HAND_MODEL = {};
    function flatModel(tid) {
        if (HAND_MODEL[tid]) return HAND_MODEL[tid];
        var tx = (tid % 16) * 16, ty = ((tid / 16) | 0) * 16, a = null;
        try { a = ATLAS.getContext('2d').getImageData(tx, ty, 16, 16).data; } catch (e) {}
        function op(x, y) { return x >= 0 && y >= 0 && x < 16 && y < 16 && (!a || a[(y * 16 + x) * 4 + 3] > 127); }
        var uv = tileUV(tid), q = [], U = TS16 / 16;
        function tex(px, py, ins) { return [uv[0] + (px + ins) * U, uv[1] + (py + ins) * U]; }
        // front (+z) and back (-z): the whole square, the clear texels discarded by the shader
        q.push({ p: [[0, 0, 8.5], [16, 0, 8.5], [16, 16, 8.5], [0, 16, 8.5]], t: [[uv[0] + INSET, uv[1] + TS16 - INSET], [uv[0] + TS16 - INSET, uv[1] + TS16 - INSET], [uv[0] + TS16 - INSET, uv[1] + INSET], [uv[0] + INSET, uv[1] + INSET]], sh: 1 });
        q.push({ p: [[16, 0, 7.5], [0, 0, 7.5], [0, 16, 7.5], [16, 16, 7.5]], t: [[uv[0] + TS16 - INSET, uv[1] + TS16 - INSET], [uv[0] + INSET, uv[1] + TS16 - INSET], [uv[0] + INSET, uv[1] + INSET], [uv[0] + TS16 - INSET, uv[1] + INSET]], sh: 0.85 });
        for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
            if (!op(x, y)) continue;
            var y0 = 15 - y, y1 = 16 - y, t0 = tex(x, y, 0.1), t1 = tex(x, y, 0.9), tt = [[t0[0], t1[1]], [t1[0], t1[1]], [t1[0], t0[1]], [t0[0], t0[1]]];
            if (!op(x - 1, y)) q.push({ p: [[x, y0, 7.5], [x, y0, 8.5], [x, y1, 8.5], [x, y1, 7.5]], t: tt, sh: 0.7 });
            if (!op(x + 1, y)) q.push({ p: [[x + 1, y0, 8.5], [x + 1, y0, 7.5], [x + 1, y1, 7.5], [x + 1, y1, 8.5]], t: tt, sh: 0.7 });
            if (!op(x, y - 1)) q.push({ p: [[x, y1, 8.5], [x + 1, y1, 8.5], [x + 1, y1, 7.5], [x, y1, 7.5]], t: tt, sh: 0.9 });
            if (!op(x, y + 1)) q.push({ p: [[x, y0, 7.5], [x + 1, y0, 7.5], [x + 1, y0, 8.5], [x, y0, 8.5]], t: tt, sh: 0.55 });
        }
        return (HAND_MODEL[tid] = q);
    }
    function pushModel(v, M, quads, scale, sk, bl) {
        for (var i = 0; i < quads.length; i++) {
            var Q = quads[i];
            for (var k = 0; k < 4; k++) {
                var p = emAt(M, Q.p[k][0] * scale, Q.p[k][1] * scale, Q.p[k][2] * scale);
                v.push(p[0], p[1], p[2], Q.t[k][0], Q.t[k][1], sk, bl, Q.sh, 0);
            }
        }
    }
    function pushCube(v, M, x0, y0, z0, x1, y1, z1, tileFn, sk, bl) {   // a box in model units, a tile a face
        for (var d = 0; d < 6; d++) {
            var uv0 = tileUV(tileFn(d));
            for (var k = 0; k < 4; k++) {
                var cr = FACE_C[d][k], f = faceUV(d, cr);
                var p = emAt(M, cr[0] ? x1 : x0, cr[1] ? y1 : y0, cr[2] ? z1 : z0);
                v.push(p[0], p[1], p[2], uv0[0] + INSET + f[0] * (TS16 - 2 * INSET), uv0[1] + INSET + f[1] * (TS16 - 2 * INSET), sk, bl, FACE_SHADE[d], 0);
            }
        }
    }
    function isCubeItem(def) { return !!(def && def.place != null && !B[def.place].cross && !B[def.place].half); }
    /* ItemInHandRenderer.renderArmWithItem for one hand (i = 1 right, -1 left):
       eating raises it to the mouth, a drawn bow comes round and stretches,
       anything else rides the swing; then the model's first-person display
       transform, the same for flat items and tools ([0, -90, 25] at
       [1.13, 3.2, 1.13] px, x0.68) and [0, 45, 0] at x0.4 for a block */
    function handItem(v, M, st, i, s, h, sk, bl) {
        var D = Math.PI / 180, def = I[st.id], sq = Math.sqrt(s);
        if (i === 1 && RT.eatT > 0 && def && def.food) {
            var f = 32 - RT.eatT * 20 + 1, r = Math.max(0, f / 32);
            if (r < 0.8) M = emMul(M, emT(0, Math.abs(Math.cos(f / 4 * Math.PI) * 0.1), 0));
            var k = 1 - Math.pow(r, 27);
            M = emMul(M, emT(k * 0.6 * i, k * -0.5, 0));
            M = emMul(M, emRy(i * k * 90 * D)); M = emMul(M, emRx(k * 10 * D)); M = emMul(M, emRz(i * k * 30 * D));
            M = emMul(M, emT(i * 0.56, -0.52 - 0.6 * h, -0.72));
        } else if (i === 1 && st.id === 'bow' && RT.bowT > 0) {
            M = emMul(M, emT(i * 0.56, -0.52 - 0.6 * h, -0.72));
            M = emMul(M, emT(i * -0.2785682, 0.18344387, 0.15731531));
            M = emMul(M, emRx(-13.935 * D)); M = emMul(M, emRy(i * 35.3 * D)); M = emMul(M, emRz(i * -9.785 * D));
            var t = RT.bowT * 20, pp = t / 20; pp = Math.min((pp * pp + 2 * pp) / 3, 1);
            if (pp > 0.1) M = emMul(M, emT(0, Math.sin((t - 0.1) * 1.3) * (pp - 0.1) * 0.004, 0));
            M = emMul(M, emT(0, 0, pp * 0.04));
            M = emMul(M, emS(1, 1, 1 + pp * 0.2));
            M = emMul(M, emRy(-i * 45 * D));
        } else {
            M = emMul(M, emT(i * -0.4 * Math.sin(sq * Math.PI), 0.2 * Math.sin(sq * 2 * Math.PI), -0.2 * Math.sin(s * Math.PI)));
            M = emMul(M, emT(i * 0.56, -0.52 - 0.6 * h, -0.72));
            M = emMul(M, emRy(i * (45 - 20 * Math.sin(s * s * Math.PI)) * D));
            M = emMul(M, emRz(i * -20 * Math.sin(sq * Math.PI) * D));
            M = emMul(M, emRx(-80 * Math.sin(sq * Math.PI) * D));
            M = emMul(M, emRy(i * -45 * D));
        }
        if (isCubeItem(def)) {
            M = emMul(M, emRy((i > 0 ? 45 : -225) * D));
            M = emMul(M, emS(0.4, 0.4, 0.4));
            M = emMul(M, emT(-0.5, -0.5, -0.5));
            pushCube(v, M, 0, 0, 0, 1, 1, 1, (function (pl) { return function (dd) { return texFace(TEX[pl], dd); }; })(def.place), sk, bl);
        } else {
            M = emMul(M, emT(i * 1.13 / 16, 3.2 / 16, 1.13 / 16));
            M = emMul(M, emRy(i * -90 * D)); M = emMul(M, emRz(i * 25 * D));
            M = emMul(M, emS(0.68, 0.68, 0.68));
            M = emMul(M, emT(-0.5, -0.5, -0.5));
            var tid = def && def.tile != null ? def.tile : (def && def.place != null ? texTop(TEX[def.place]) : TILE.i_stick);
            pushModel(v, M, flatModel(tid), 1 / 16, sk, bl);
        }
    }
    /* renderPlayerArm: the empty main hand, the right arm out of the player
       model (a 4x12x4 box pivoted at (-5, 2, 0), turned 0.1 rad) put where the
       game puts it, the swing sweeping it in and up */
    function handArm(v, M, i, s, h, sk, bl) {
        var D = Math.PI / 180, sq = Math.sqrt(s);
        M = emMul(M, emT(i * (0.64000005 - 0.3 * Math.sin(sq * Math.PI)), -0.6 + 0.4 * Math.sin(sq * 2 * Math.PI) - 0.6 * h, -0.71999997 - 0.4 * Math.sin(s * Math.PI)));
        M = emMul(M, emRy(i * 45 * D)); M = emMul(M, emRy(i * 70 * Math.sin(sq * Math.PI) * D)); M = emMul(M, emRz(i * -20 * Math.sin(s * s * Math.PI) * D));
        M = emMul(M, emT(i * -1, 3.6, 3.5)); M = emMul(M, emRz(i * 120 * D)); M = emMul(M, emRx(200 * D)); M = emMul(M, emRy(i * -135 * D));
        M = emMul(M, emT(i * 5.6, 0, 0));
        M = emMul(M, emT(-5 / 16 * i, 2 / 16, 0)); M = emMul(M, emRz(0.1 * i));
        pushCube(v, M, (i > 0 ? -3 : -1) / 16, -2 / 16, -2 / 16, (i > 0 ? 1 : 3) / 16, 10 / 16, 2 / 16, function () { return TILE.hand; }, sk, bl);
    }
    /* ── first-person hands (view space) ──
       The bob and the hurt tilt, then the sway toward where you were looking a
       tick ago, then each hand: the main hand's item, or its bare arm, and the
       off hand's item when it holds one (not while a bow is drawn). */
    function handGeo() {
        if (RT.menu) return [];         // nobody is holding anything on the title screen
        if (isSpectator()) return [];   // a CSS class cannot reach WebGL: the hand was still there
        if (RT.dead || RT.sleep || !CAM) return [];
        var v = [], pt = camPt(), D = Math.PI / 180;
        var L = cellLight(S.px, S.py + EYE, S.pz), sk = Math.max(0.18, L[0]), bl = L[1];
        var base = camFx(pt);
        base = emMul(base, emRx((S.pitch / D - (CAM.xbO + (CAM.xb - CAM.xbO) * pt)) * 0.1 * D));
        base = emMul(base, emRy((S.yaw / D - (CAM.ybO + (CAM.yb - CAM.ybO) * pt)) * 0.1 * D));
        var da = CAM.att - CAM.attO; if (da < 0) da += 1;
        var s = CAM.attO + da * pt;
        var hMain = 1 - (CAM.mainHO + (CAM.mainH - CAM.mainHO) * pt), hOff = 1 - (CAM.offHO + (CAM.offH - CAM.offHO) * pt);
        var hm = CAM.vMainSt, ho = CAM.vOffSt, bow = hm && hm.id === 'bow' && RT.bowT > 0;
        if (hm) handItem(v, base, hm, 1, s, hMain, sk, bl);
        else handArm(v, base, 1, s, hMain, sk, bl);
        if (ho && !bow) handItem(v, base, ho, -1, 0, hOff, sk, bl);
        return v;
    }

    /* ── item icons: fake-iso cubes off the atlas ─────────────
       An item in a slot is 16×16 GUI pixels. The game blits a flat item's
       16×16 texture at exactly that size, and renders a block's model into
       the same square at the screen's real resolution. So icons are built at
       16 × (device pixels per GUI pixel): flat items as exact squares of
       texels, blocks drawn at device resolution. One cache per scale. */
    /* Two creative-tab icons for things this world has no item for: the
       compass on Search Items and the oak sign on Functional Blocks. Our own
       drawings, sixteen pixels square like every item. */
    var ICON_ART = {
        compass: { pal: { k: '#1f1f1f', a: '#c8c8c8', A: '#8a8a8a', f: '#3c3c3c', r: '#e02b2b', R: '#9c1616', w: '#d8d8d8' }, rows: [
            '................',
            '.....kkkkkk.....',
            '...kkaaaaaakk...',
            '..kaaffffffAAk..',
            '..kaffffffffAk..',
            '.kaffffffffrfAk.',
            '.kaffffffffRfAk.',
            '.kafffffffrffAk.',
            '.kaffffffRfffAk.',
            '.kafffffwffffAk.',
            '.kaffffwfffffAk.',
            '..kafffffffffk..',
            '..kAAffffffAAk..',
            '...kkAAAAAAkk...',
            '.....kkkkkk.....',
            '................'] },
        oak_sign: { pal: { k: '#3b2a15', p: '#b8945f', P: '#9d7a47', q: '#a8864f', s: '#6b4f2a', S: '#4f3a1e' }, rows: [
            '................',
            '................',
            'kkkkkkkkkkkkkkkk',
            'kppppppppppppppk',
            'kpPPPPppqPPPPppk',
            'kppppppppppppppk',
            'kpqPPPPPppPPPqpk',
            'kppppppppppppppk',
            'kPPPPPPPPPPPPPPk',
            'kkkkkkksSkkkkkkk',
            '.......sSk......',
            '......ksSk......',
            '......ksSk......',
            '......ksSk......',
            '......ksSk......',
            '......kkkk......'] }
    };
    var ICON = {};
    function iconURL(id) {
        var r = Math.max(2, (RT && RT.gs) || 2), key = id + '@' + r;
        if (ICON[key]) return ICON[key];
        var def = I[id], cv = document.createElement('canvas'), k = r / 2;   // the drawings below are on a 32-unit square
        cv.width = cv.height = 16 * r;
        var c = cv.getContext('2d');
        c.imageSmoothingEnabled = false;
        function tsrc(tid) { return { x: (tid % 16) * 16, y: ((tid / 16) | 0) * 16 }; }
        if (def && def.place != null && !B[def.place].cross && !B[def.place].half) {
            var tx = TEX[def.place];
            var top = tsrc(texTop(tx)), side = tsrc(texSide(tx));
            function face(tf, sx, shade) {
                c.setTransform(tf[0] * k, tf[1] * k, tf[2] * k, tf[3] * k, tf[4] * k, tf[5] * k);
                c.drawImage(ATLAS, sx.x, sx.y, 16, 16, 0, 0, 16, 16);
                if (shade) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(8,8,16,' + shade + ')'; c.fillRect(0, 0, 16, 16); c.globalCompositeOperation = 'source-over'; }
                c.setTransform(1, 0, 0, 1, 0, 0);
            }
            face([0.72, 0.36, -0.72, 0.36, 16, 2.5], top, 0);
            face([0.72, 0.36, 0, 0.82, 4.5, 8.5], side, 0.28);
            face([0.72, -0.36, 0, 0.82, 16, 14.2], side, 0.45);
        } else if (def && def.egg) {
            // a fat oval in the mob's base colour, speckled with its spot colour.
            // Same shape for every mob, same as the real item; the speckle pattern
            // is hashed off the mob name so an egg looks identical every session.
            var col = EGG_COL[def.egg] || ['#c8c8c8', '#8a8a8a'];
            var band = [8, 14, 18, 20, 22, 22, 20, 14], bi;
            c.setTransform(k, 0, 0, k, 0, 0);
            c.fillStyle = col[0];
            for (bi = 0; bi < band.length; bi++) c.fillRect(16 - band[bi] / 2, 4 + bi * 3, band[bi], 3);
            var eh = 0;
            for (bi = 0; bi < def.egg.length; bi++) eh = (Math.imul(eh, 31) + def.egg.charCodeAt(bi)) | 0;
            var ernd = mulb(eh ^ 0x9E3779B9);
            c.fillStyle = col[1];
            for (bi = 0; bi < 7; bi++) {
                var eb = 1 + ((ernd() * 6) | 0), ew = band[eb] - 6;
                c.fillRect(16 - ew / 2 + ((ernd() * ew) | 0), 5 + eb * 3, 3, 3);
            }
            c.fillStyle = 'rgba(255,255,255,0.28)';
            c.fillRect(12, 7, 3, 4);
        } else if (!def && ICON_ART[id]) {
            c.setTransform(r, 0, 0, r, 0, 0);
            sprMap(c, ICON_ART[id].rows, ICON_ART[id].pal);
            c.setTransform(1, 0, 0, 1, 0, 0);
        } else {
            var tid = def && def.tile != null ? def.tile : (def && def.place != null ? texTop(TEX[def.place]) : TILE.i_stick);
            var s = tsrc(tid);
            c.drawImage(ATLAS, s.x, s.y, 16, 16, 0, 0, 16 * r, 16 * r);
        }
        ICON[key] = cv.toDataURL();
        return ICON[key];
    }

    /* ── GUI sprites ────────────────────────────────────────────
       Every piece of in-game chrome is painted here once, at 1×, in GUI pixels
       and at the sizes the game's own sprites have, then handed to the
       stylesheet as a --spr-<name> custom property on .mc. The DOM draws them
       at --gs with nearest-neighbour sampling, so one sprite pixel is always a
       whole square of device pixels. They are our own drawings of the same
       furniture, not copies of Mojang's textures, the same way the block atlas
       is. */
    var GSPR = null;
    function sprMap(cx, rows, pal, ox, oy) {
        for (var y = 0; y < rows.length; y++) for (var x = 0; x < rows[y].length; x++) {
            var c = pal[rows[y].charAt(x)];
            if (c) { cx.fillStyle = c; cx.fillRect((ox || 0) + x, (oy || 0) + y, 1, 1); }
        }
    }
    function sprRect(cx, x, y, w, h, c) { cx.fillStyle = c; cx.fillRect(x, y, w, h); }
    function guiSprites() {
        if (GSPR) return GSPR;
        GSPR = {};
        function mk(name, w, h, draw) {
            var cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            var cx = cv.getContext('2d');
            draw(cx, w, h);
            GSPR[name] = { cv: cv, w: w, h: h, url: cv.toDataURL() };
        }
        sprHud(mk);
        sprPanels(mk);
        sprWidgets(mk);
        sprAdv(mk);
        sprStats(mk);
        sprMenu(mk);
        var css = '.mc{';
        for (var k in GSPR) css += '--spr-' + k + ':url(' + GSPR[k].url + ');';
        css += '}';
        var st = document.getElementById('mc-gui-css');
        if (!st) { st = document.createElement('style'); st.id = 'mc-gui-css'; document.head.appendChild(st); }
        st.textContent = css;
        return GSPR;
    }

    /* ── HUD ────────────────────────────────────────────────────
       Laid out the way the game's Gui lays it out: on the scaled screen,
       from its bottom centre, in whole GUI pixels. Hotbar at (W/2 - 91, H - 22),
       the XP bar seven pixels above it, hearts and armour on the left from
       H - 39, food and air mirrored on the right. The parts that move do it on
       the game's own 20 Hz tick: the heart blink after a hit, the jitter at four
       health, the regeneration wave, hunger's shake when saturation runs out. */
    var HUD_TICK = 0.05;

    /* the HUD's sprites: the game's sizes and layout, our drawings */
    function sprHud(mk) {
        var rnd = mulb(0x40FBA2);
        function n(a) { return Math.round((rnd() * 2 - 1) * a); }
        function grey(v, a) { v = Math.max(0, Math.min(255, v + n(a || 0))); return 'rgb(' + v + ',' + v + ',' + v + ')'; }
        /* The hotbar: nine 20-pixel cells inside a black outline. Every cell is
           framed by a light line and then a dark one on each side, the bar's
           top-left corner catches the most light, and the 16×16 well in the
           middle is a dark tint the world shows through. */
        mk('hotbar', 182, 22, function (cx) {
            sprRect(cx, 0, 0, 182, 22, '#000000');
            for (var i = 0; i < 9; i++) for (var y = 0; y < 20; y++) for (var x = 0; x < 20; x++) {
                var X = 1 + i * 20 + x, Y = 1 + y, c;
                if (y === 0) c = grey(i === 0 && x < 2 ? 206 : i === 0 && x < 4 ? 171 : 147, 3);
                else if (x === 0) c = grey(i === 0 ? (y < 3 ? 171 : 147) : 126, 3);
                else if (y === 19 || x === 19) c = grey(96, 5);
                else if (x === 18) c = grey(y === 1 ? 112 : 126, 5);
                else if (y === 18) c = grey(x === 1 ? 112 : 126, 6);
                else if (y === 1 || x === 1) c = grey(97, 5);
                else c = 'rgba(' + (37 + n(8)) + ',' + (36 + n(7)) + ',' + (7 + n(3)) + ',0.73)';
                cx.clearRect(X, Y, 1, 1);
                sprRect(cx, X, Y, 1, 1, c);
            }
        });
        /* The selected slot's frame: 24 wide, one row shorter than it is wide so
           it stops at the bottom of the screen, a black line and then a raised
           light band four pixels deep round a hole the slot shows through. */
        mk('hotbar_sel', 24, 23, function (cx) {
            var band = ['#000000', '#ffffff', '#dcdcdc', '#a6a6a6'];
            for (var y = 0; y < 23; y++) for (var x = 0; x < 24; x++) {
                var d = Math.min(x, y, 23 - x, 23 - y);
                if (d < 4) sprRect(cx, x, y, 1, 1, band[d]);
            }
        });
        function bar(cx, edge, rows) {   // a 182×5 strip with a one-pixel outline and clipped corners
            sprRect(cx, 1, 0, 180, 1, edge); sprRect(cx, 1, 4, 180, 1, edge);
            sprRect(cx, 0, 1, 1, 3, edge); sprRect(cx, 181, 1, 1, 3, edge);
            for (var r = 0; r < 3; r++) for (var x = 1; x < 181; x++) {
                var b = rows[r];
                sprRect(cx, x, 1 + r, 1, 1, 'rgb(' + (b[0] + n(b[3])) + ',' + (b[1] + n(b[3])) + ',' + (b[2] + n(b[3] >> 1)) + ')');
            }
        }
        mk('xp_bg', 182, 5, function (cx) { bar(cx, '#000000', [[44, 44, 44, 3], [30, 30, 30, 3], [22, 22, 22, 3]]); });
        mk('xp_fg', 182, 5, function (cx) { bar(cx, '#102a18', [[100, 152, 60, 16], [150, 214, 106, 14], [104, 158, 66, 12]]); });
        /* 15×15, as the game's is, with the nine-pixel cross in the middle:
           drawn at ((W - 15) / 2, (H - 15) / 2), which puts the crossing one
           GUI pixel up and left of the true centre, like the real one */
        mk('cross', 15, 15, function (cx) { sprRect(cx, 7, 3, 1, 9, '#ffffff'); sprRect(cx, 3, 7, 9, 1, '#ffffff'); });

        /* the 9×9 icons. o outline, f fill, h highlight, s shade */
        var HEART = ['..oo.oo..', '.offoffo.', 'ofhfffffo', 'offfffffo', 'osfffffso', '.osfffso.', '..osfso..', '...oso...', '....o....'];
        var ARMOR = ['.oo...oo.', 'ohfo.ohfo', 'offfofffo', 'osfffffso', '.offfffo.', '.offfffo.', '.offfffo.', '.ossssso.', '..ooooo..'];
        var FOOD = ['..ooo....', '.orrro...', 'orrhtto..', 'orrttbo..', '.odtbbo..', '..oddbwo.', '...ooowo.', '.....owwo', '......oo.'];
        var BUBBLE = ['..oooo...', '.owwllo..', 'owllllbo.', 'owllllbo.', 'ollllbbo.', 'olllbbbo.', '.obbbbo..', '..oooo...', '.........'];
        function icon(name, rows, pal, keep) {   // keep(x, y) chooses which pixels a half icon carries
            mk(name, 9, 9, function (cx) {
                for (var y = 0; y < 9; y++) for (var x = 0; x < 9; x++) {
                    var k = rows[y].charAt(x), c = pal[k];
                    if (!c || (keep && !keep(x, y, k))) continue;
                    sprRect(cx, x, y, 1, 1, c);
                }
            });
        }
        function left(x) { return x <= 4; }
        function right(x) { return x >= 4; }
        var DARK = 'rgba(22,22,22,0.72)';
        // containers carry the outline; the hearts drawn over them carry only their colour
        icon('h_cont', HEART, { o: '#000000', f: DARK, h: DARK, s: DARK });
        icon('h_cont_bl', HEART, { o: '#ffffff', f: DARK, h: DARK, s: DARK });
        var HEARTS = {
            n: { f: '#ff1313', h: '#ffc8c8', s: '#bb1313' },       // normal
            bl: { f: '#ffffff', h: '#ffffff', s: '#d0d0d0' },      // the health just lost, flashing
            p: { f: '#94a41c', h: '#d4e27c', s: '#627012' },       // poisoned
            w: { f: '#343434', h: '#6e6e6e', s: '#161616' },       // withered
            fz: { f: '#7cc4f0', h: '#e2f6ff', s: '#3f86c0' },      // frozen
            a: { f: '#e8c21e', h: '#fff4a8', s: '#b08a0c' }        // absorbing
        };
        for (var hk in HEARTS) {
            var hp = { f: HEARTS[hk].f, h: HEARTS[hk].h, s: HEARTS[hk].s };
            icon('h_' + hk, HEART, hp);
            icon('h_' + hk + '_half', HEART, hp, left);
            // hardcore: the same heart with two dark eyes set in the upper humps
            var hc = { f: hp.f, h: hp.h, s: hp.s, e: '#000000' };
            var HH = HEART.slice(); HH[2] = 'ofhfffffo'; HH[3] = 'ofefffefo';
            icon('h_' + hk + '_hc', HH, hc);
            icon('h_' + hk + '_hc_half', HH, hc, left);
        }
        var AR = { o: '#000000', f: '#b8b9c4', h: '#e6e7f2', s: '#696a70' };
        icon('a_full', ARMOR, AR);
        icon('a_half', ARMOR, AR, function (x, y, k) { return k === 'o' || left(x); });
        icon('a_empty', ARMOR, { o: '#000000', f: DARK, h: DARK, s: DARK });
        var FD = { o: '#000000', r: '#d42a2a', h: '#dfb18f', t: '#b88458', b: '#9d6d43', d: '#613c1b', w: '#fff7dc' };
        var FH = { o: '#000000', r: '#7d9a2a', h: '#c3d890', t: '#96ad52', b: '#6f873a', d: '#3a4c15', w: '#e7f2c8' };
        icon('f_empty', FOOD, { o: '#000000', r: DARK, h: DARK, t: DARK, b: DARK, d: DARK, w: DARK });
        icon('f_full', FOOD, FD); icon('f_half', FOOD, FD, function (x, y, k) { return k === 'o' ? right(x) || y > 4 : right(x); });
        icon('f_hunger_empty', FOOD, { o: '#1e2a0a', r: 'rgba(24,34,10,0.72)', h: 'rgba(24,34,10,0.72)', t: 'rgba(24,34,10,0.72)', b: 'rgba(24,34,10,0.72)', d: 'rgba(24,34,10,0.72)', w: 'rgba(24,34,10,0.72)' });
        icon('f_hunger_full', FOOD, FH); icon('f_hunger_half', FOOD, FH, function (x, y, k) { return k === 'o' ? right(x) || y > 4 : right(x); });
        icon('air', BUBBLE, { o: '#274ea3', w: '#ffffff', l: '#aad7ff', b: '#6ea5e6' });
        icon('air_empty', BUBBLE, { o: '#1b3163', w: 'rgba(20,30,60,0.35)', l: 'rgba(20,30,60,0.35)', b: 'rgba(20,30,60,0.35)' });
        /* the attack indicator under the crosshair: a dim 16×4 bar, a white fill
           over it, and a small sword for "ready to hit what you are looking at";
           drawn in white and grey because they go through the crosshair's
           inverting blend */
        mk('atk_bg', 16, 4, function (cx) { sprRect(cx, 0, 0, 16, 4, '#303030'); sprRect(cx, 1, 1, 14, 2, '#101010'); });
        mk('atk_fg', 16, 4, function (cx) { sprRect(cx, 0, 0, 16, 4, '#303030'); sprRect(cx, 1, 1, 14, 2, '#f0f0f0'); });
        mk('atk_full', 16, 16, function (cx) {
            sprMap(cx, ['.............ww.', '............www.', '...........www..', '..........www...', '.........www....', '........www.....',
                        '..w....www......', '..ww..www.......', '...wwwww........', '....www.........', '...wwwww........', '..ww...ww.......',
                        '.ww.....w.......', 'ww..............', '................', '................'], { w: '#ffffff' });
        });
        mk('air_pop', 9, 9, function (cx) {
            sprMap(cx, ['.........', '.o.....o.', '..w...w..', '.........', 'ow.....wo', '.........', '..w...w..', '.o.....o.', '.........'],
                { o: '#274ea3', w: '#cfe8ff' });
        });
        /* A status effect's frame in the top-right corner: a raised grey tile;
           the ambient one (a beacon's) is tinted blue. */
        function effFrame(cx, face, lite, dark) {
            sprRect(cx, 1, 0, 22, 1, '#000000'); sprRect(cx, 1, 23, 22, 1, '#000000');
            sprRect(cx, 0, 1, 1, 22, '#000000'); sprRect(cx, 23, 1, 1, 22, '#000000');
            sprRect(cx, 1, 1, 22, 22, face);
            sprRect(cx, 1, 1, 21, 1, lite); sprRect(cx, 1, 1, 1, 21, lite);
            sprRect(cx, 2, 22, 21, 1, dark); sprRect(cx, 22, 2, 1, 21, dark);
        }
        mk('eff_bg', 24, 24, function (cx) { effFrame(cx, '#c6c6c6', '#ffffff', '#555555'); });
        /* An effect's 18×18 icon. The game draws every effect its own picture;
           ours is one bottle, filled with the effect's own colour, so the row of
           frames still reads at a glance. */
        function bottle(col) {
            return function (cx) {
                var fill = {}, x, y;
                for (y = 0; y < 18; y++) for (x = 0; x < 18; x++) {
                    var body = (x - 8.5) * (x - 8.5) + (y - 11.5) * (y - 11.5) <= 27.5, neck = x >= 7 && x <= 10 && y >= 3 && y <= 6, cork = x >= 7 && x <= 10 && y >= 1 && y <= 2;
                    if (body || neck || cork) fill[x + ',' + y] = cork ? 'c' : body && y >= 10 ? 'l' : 'g';
                }
                for (var k in fill) {
                    var xy = k.split(','), px = +xy[0], py = +xy[1];
                    var edge = !fill[(px - 1) + ',' + py] || !fill[(px + 1) + ',' + py] || !fill[px + ',' + (py - 1)] || !fill[px + ',' + (py + 1)];
                    var c = edge ? '#2a2a2a' : fill[k] === 'c' ? '#9a7442' : fill[k] === 'l' ? col : 'rgba(214,226,255,0.55)';
                    sprRect(cx, px, py, 1, 1, c);
                }
                sprRect(cx, 5, 10, 1, 2, 'rgba(255,255,255,0.85)'); sprRect(cx, 6, 9, 1, 1, 'rgba(255,255,255,0.85)');
            };
        }
        for (var eid in EFFECTS) mk('eff_' + eid, 18, 18, bottle(EFFECTS[eid].c));
        mk('eff_bg_amb', 24, 24, function (cx) { effFrame(cx, '#8fb3d8', '#d8ecff', '#3a5a82'); });
        /* A toast: 160×32, dark, in a thin light frame with the corners cut. */
        mk('toast', 160, 32, function (cx) {
            sprRect(cx, 2, 0, 156, 1, '#000000'); sprRect(cx, 2, 31, 156, 1, '#000000');
            sprRect(cx, 0, 2, 1, 28, '#000000'); sprRect(cx, 159, 2, 1, 28, '#000000');
            sprRect(cx, 1, 1, 1, 1, '#000000'); sprRect(cx, 158, 1, 1, 1, '#000000'); sprRect(cx, 1, 30, 1, 1, '#000000'); sprRect(cx, 158, 30, 1, 1, '#000000');
            sprRect(cx, 2, 1, 156, 30, '#212121'); sprRect(cx, 1, 2, 158, 28, '#212121');
            sprRect(cx, 2, 1, 156, 1, '#5a5a5a'); sprRect(cx, 1, 2, 1, 28, '#5a5a5a');
            sprRect(cx, 2, 30, 156, 1, '#101010'); sprRect(cx, 158, 2, 1, 28, '#101010');
        });
    }

    /* the item stack decorations, shared by the hotbar and every container: the
       icon in its own layer (so the pick-up pop can squash it without squashing
       the count), the count bottom-right in white with its shadow, and the
       durability bar under it */
    function paintSlot(el, st) {
        if (!st) {
            if (el._st !== null) {
                el._st = null; el.style.backgroundImage = ''; el.style.removeProperty('--ic');
                // an armour, off-hand or lapis slot shows its #555555 outline where the item would be
                var ei = el.getAttribute && el.getAttribute('data-ei');
                el.innerHTML = ei ? '<i class="mc-it mc-ei" style="--ic:var(--spr-' + ei + ')"></i>' : '';
            }
            el.className = el.className.replace(/ has| glint/g, '');
            return;
        }
        var url = 'url(' + iconURL(st.id) + ')';
        el.style.backgroundImage = url;
        el.style.setProperty('--ic', url);
        if (el.className.indexOf(' has') < 0) el.className += ' has';
        var glint = (st.ench && Object.keys(st.ench).length) || (I[st.id] && I[st.id].glint);
        el.className = el.className.replace(/ glint/g, '') + (glint ? ' glint' : '');
        var html = '<i class="mc-it"></i>';
        if (st.c > 1) html += mtHTML(String(st.c), null, 'mc-ct');
        var max = itemMaxDur(st.id);
        if (st.dur != null && max != null && st.dur < max) {
            // ItemStack.getBarWidth / getBarColor: 13 pixels at full, the hue running green to red
            var f = Math.max(0, st.dur / max), w = Math.round(13 * f), hue = f / 3;
            html += '<span class="mc-dur"><i style="width:calc(var(--px) * ' + w + ');background:' + hsvHex(hue, 1, 1) + '"></i></span>';
        }
        el._st = st;
        el.innerHTML = html;
    }
    function hsvHex(h, s, v) {   // Mth.hsvToRgb
        var i = Math.floor(h * 6) % 6, f = h * 6 - Math.floor(h * 6), p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
        var rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
        return '#' + rgb.map(function (c) { return ('0' + Math.round(c * 255).toString(16)).slice(-2); }).join('');
    }

    /* The whole HUD is placed in device pixels from GUI arithmetic, so it sits on
       the same grid as the menus at every scale. */
    function hudPlace(e, x, y) {
        if (!e) return;
        var s = RT.gs || 2, l = (x * s) + 'px', t = (y * s) + 'px';
        if (e.style.left !== l) e.style.left = l;
        if (e.style.top !== t) e.style.top = t;
    }
    function hudLayout() {
        if (!RT || !RT.el || !RT.gs) return;
        var el = RT.el, W = RT.gw, H = RT.gh, hx = (W >> 1) - 91, hy = H - 22;
        hudPlace(el.querySelector('.mc-hbbar'), hx, hy);
        hudPlace(el.querySelector('.mc-hotbar'), hx, hy);
        hudPlace(el.querySelector('.mc-xpbar'), hx, H - 29);
        hudPlace(el.querySelector('.mc-cross'), (W - 15) >> 1, (H - 15) >> 1);
        paintHotbar(); paintXp(); hudTick(true);
        chatLayout(); paintChat(); paintEffects(); toastFrame(0);
        if (RT.f3) paintDebug();
        if (RT.iw) iwRender(false);
        bedLayout();
    }
    function paintHotbar() {
        var bar = RT.el.querySelector('.mc-hotbar');
        if (!bar) return;
        var cells = bar.children;
        for (var i = 0; i < 9; i++) {
            var cls = 'mc-slot mc-hb' + (i === S.sel ? ' sel' : '') + (S.inv[i] ? ' has' : '');
            if (cells[i].className.replace(/ glint/g, '') !== cls) cells[i].className = cls;
            paintSlot(cells[i], S.inv[i]);
        }
        hudPlace(RT.el.querySelector('.mc-hbsel'), (RT.gw >> 1) - 91 - 1 + S.sel * 20, RT.gh - 23);
        /* Gui.renderItemHotbar: with something in the off hand, its cell (29x24) at
           (W/2 - 120, H - 23) on the side of the off hand, the item at (W/2 - 117, H - 19) */
        var off = RT.el.querySelector('.mc-offslot'), ofr = RT.el.querySelector('.mc-hboff');
        if (off && ofr) {
            var shw = S.off ? '' : 'none';
            if (off.style.display !== shw) { off.style.display = shw; ofr.style.display = shw; }
            paintSlot(off, S.off || null);
            hudPlace(ofr, (RT.gw >> 1) - 120, RT.gh - 23);
            hudPlace(off, (RT.gw >> 1) - 117, RT.gh - 19);
        }
        hudTipTick(false);
    }
    /* Gui.renderSelectedItemName: switching to a different item (or a differently
       named one) shows its name for 40 ticks, fully opaque until the last ten and
       fading over those; rarity picks the colour, a custom name goes italic. The
       line sits at H - 59, or 14 lower in creative where there are no bars. */
    function itemRarity(st) {
        var r = (I[st.id] && I[st.id].rarity) || 0;   // 0 common, 1 uncommon, 2 rare, 3 epic
        if (st.ench && Object.keys(st.ench).length) r = r < 2 ? 2 : 3;
        return r;
    }
    var RARITY_COL = ['#ffffff', '#ffff55', '#55ffff', '#ff55ff'];
    function itemName(st) { return st.name || (I[st.id] ? I[st.id].t : st.id); }
    function hudTipTick(tick) {
        var h = held(), tip = RT.el.querySelector('.mc-tip');
        if (!tip) return;
        var key = h ? h.id + '|' + (h.name || '') : null;
        if (!h) RT.tipTk = 0;
        else if (key !== RT.tipKey) {
            RT.tipTk = 40;
            mtSet(tip, itemName(h), RARITY_COL[itemRarity(h)]);
            tip.classList.toggle('it', !!h.name);
        } else if (tick && RT.tipTk > 0) RT.tipTk--;
        RT.tipKey = key;
        var a = Math.min(255, Math.floor(RT.tipTk * 256 / 10));
        tip.style.opacity = a > 0 ? (a / 255).toFixed(3) : '0';
        if (a > 0) {
            var w = mfWidth(tip.getAttribute('data-t') || '') + 1;
            hudPlace(tip, (RT.gw - w) >> 1, RT.gh - 59 + (invulnerable() ? 14 : 0));
        }
    }

    /* — hearts, armour, food, air, on the tick — */
    /* java.util.Random, which is what Gui's LegacyRandomSource is: reseeded with
       tickCount × 312871 before the hearts are drawn, then drawn from in the
       game's order (hearts high to low, food right to left, empty bubbles), so
       the jitter and the shake land on the same pixels they do in the game. */
    var JR_MUL = 0x5DEECE66Dn, JR_MASK = (1n << 48n) - 1n;
    function hudRand(seed) {
        var st = (BigInt(Math.trunc(seed)) ^ JR_MUL) & JR_MASK;
        function next(bits) { st = (st * JR_MUL + 0xBn) & JR_MASK; return Number(BigInt.asIntN(32, st >> BigInt(48 - bits))); }
        return {
            nextInt: function (n) {
                if ((n & -n) === n) return Number((BigInt(n) * BigInt(next(31))) >> 31n);
                var bits, val;
                do { bits = next(31); val = bits % n; } while (bits - val + (n - 1) > 2147483647);
                return val;
            }
        };
    }
    function hudIcons(box, n, list) {   // keep exactly n <i> children, then hand them to the painter
        while (box.children.length < n) box.appendChild(document.createElement('i'));
        while (box.children.length > n) box.removeChild(box.lastChild);
        return box.children;
    }
    function hudIcon(e, x, y, layers) {
        hudPlace(e, x, y);
        var bg = layers.map(function (k) { return 'var(--spr-' + k + ')'; }).join(',');
        if (e._bg !== bg) { e._bg = bg; e.style.backgroundImage = bg; }
    }
    function heartKind() {
        if (effLvl('poison')) return 'p';
        if (effLvl('wither')) return 'w';
        if (RT.frozen) return 'fz';
        return 'n';
    }
    function paintVitals() { hudTick(true); }
    /* Gui's attack indicator in its default crosshair mode, at (W/2 - 8, H/2 + 9):
       while the swing is recharging, the dim bar with (int)(f × 17) columns of
       white over it; charged, and looking at something alive with a weapon
       slower than the bare hand, the little sword instead. */
    function atkTick() {
        var e = RT.el.querySelector('.mc-atk');
        if (!e) return;
        var max = RT.atkCdMax || 0.35, f = RT.atkCd > 0 ? Math.max(0, Math.min(1, 1 - RT.atkCd / max)) : 1, show = '';
        if (!isSpectator() && !RT.f3) {
            if (f < 1) show = 'bar';
            else if (max > 0.25 && !RT.panel) { var tf = entRay(); if (tf && tf.hp > 0) show = 'full'; }
        }
        if (e._show !== show) { e._show = show; e.className = 'mc-atk' + (show ? ' ' + show : ''); }
        hudPlace(e, (RT.gw >> 1) - 8, (RT.gh >> 1) + 9);
        if (show === 'bar') { var fg = e.firstChild, w = 'calc(var(--px) * ' + Math.floor(f * 17) + ')'; if (fg.style.width !== w) fg.style.width = w; }
    }
    function paintArmorBar() { hudTick(true); }
    function hudTick(redraw) {
        if (!RT || !RT.el || !RT.gs) return;
        var el = RT.el, W = RT.gw, H = RT.gh, tk = RT.hudTk || 0;
        if (!redraw) RT.hudTk = ++tk;
        // Gui.renderPlayerHealth's bookkeeping: a hit sets a 20-tick blink, a heal
        // under invulnerability a 10-tick one, and the white "lost" hearts hold
        // the old health for a second before catching up
        var hp = Math.max(0, Math.ceil(S.hp)), now = RT.now * 1000;
        if (RT.hLast == null) { RT.hLast = hp; RT.hDisp = hp; RT.hLastT = now; RT.hBlink = 0; }
        if (hp < RT.hLast && RT.iframe > 0) { RT.hLastT = now; RT.hBlink = tk + 20; }
        else if (hp > RT.hLast && RT.iframe > 0) { RT.hLastT = now; RT.hBlink = tk + 10; }
        if (now - RT.hLastT > 1000) { RT.hDisp = hp; RT.hLastT = now; }
        RT.hLast = hp;
        var blink = RT.hBlink > tk && ((RT.hBlink - tk) / 3 | 0) % 2 === 1;
        var rnd = hudRand(tk * 312871);
        var lx = (W >> 1) - 91, rx = (W >> 1) + 91, hy = H - 39;
        var maxHp = Math.max(20, RT.hDisp, hp), abs = Math.ceil(RT.absorb || 0);
        var rows = Math.ceil((maxHp + abs) / 2 / 10), rowH = Math.max(10 - (rows - 2), 3);
        var wave = effLvl('regeneration') ? tk % Math.ceil(maxHp + 5) : -1;
        var hc = !!S.hardcore, kind = heartKind(), sfx = hc ? '_hc' : '';
        var nH = Math.ceil(maxHp / 2), nA = Math.ceil(abs / 2);
        var hearts = hudIcons(el.querySelector('.mc-hearts'), nH + nA);
        for (var l = nH + nA - 1; l >= 0; l--) {
            var x = lx + (l % 10) * 8, y = hy - ((l / 10) | 0) * rowH;
            if (hp + abs <= 4) y += rnd.nextInt(2);
            if (l < nH && l === wave) y -= 2;
            var layers = [], i2 = l * 2;
            if (i2 < hp) layers.push('h_' + kind + sfx + (i2 + 1 === hp ? '_half' : ''));
            if (blink && i2 < RT.hDisp) layers.push('h_bl' + sfx + (i2 + 1 === RT.hDisp ? '_half' : ''));
            if (l >= nH) { var j2 = i2 - nH * 2; if (j2 < abs) layers.push('h_' + (kind === 'w' ? 'w' : 'a') + sfx + (j2 + 1 === abs ? '_half' : '')); }
            layers.push(blink ? 'h_cont_bl' : 'h_cont');
            hudIcon(hearts[l], x, y, layers);
        }
        // armour: ten icons over the top row of hearts, only when there is any
        var pts = Math.round(armorPoints()), arm = el.querySelector('.mc-armor');
        var ai = hudIcons(arm, pts > 0 ? 10 : 0);
        for (var k = 0; k < ai.length; k++)
            hudIcon(ai[k], lx + k * 8, hy - (rows - 1) * rowH - 10, [k * 2 + 1 < pts ? 'a_full' : k * 2 + 1 === pts ? 'a_half' : 'a_empty']);
        // food, right to left, shaking while saturation is gone
        var fd = Math.max(0, Math.ceil(S.food)), hun = effLvl('hunger') ? 'f_hunger_' : 'f_';
        var fi = hudIcons(el.querySelector('.mc-food'), 10);
        for (var j = 0; j < 10; j++) {
            var fy = hy;
            if ((S.sat || 0) <= 0 && tk % (fd * 3 + 1) === 0) fy += rnd.nextInt(3) - 1;
            var fl = [hun + 'empty'];
            if (j * 2 + 1 < fd) fl.unshift(hun + 'full'); else if (j * 2 + 1 === fd) fl.unshift(hun + 'half');
            hudIcon(fi[j], rx - j * 8 - 9, fy, fl);
        }
        /* air, the 1.21.2 way: while the eyes are under or the supply is not yet
           back, full bubbles from the right, the one being used bursting for a
           moment, and the spent ones left as empty outlines, which wobble when
           there is nothing left at all */
        var air = Math.max(0, Math.min(300, Math.round((S.air == null ? 10 : S.air) * 30))), inW = !!RT.eyeWater, bubs = [];
        if (inW || air < 300) {
            var full = Math.ceil((air - 2) * 10 / 300), cur = Math.ceil(air * 10 / 300);
            var empty = 10 - Math.ceil((air + (air !== 0 && inW ? 1 : 0)) * 10 / 300), popping = full !== cur;
            for (var bn = 1; bn <= 10; bn++) {
                var bx = rx - (bn - 1) * 8 - 9;
                if (bn <= full) bubs.push([bx, hy - 10, 'air']);
                else if (popping && bn === cur && inW) bubs.push([bx, hy - 10, 'air_pop']);
                else if (bn > 10 - empty) bubs.push([bx, hy - 10 + (empty === 10 && tk % 2 === 0 ? rnd.nextInt(2) : 0), 'air_empty']);
            }
        }
        var bi = hudIcons(el.querySelector('.mc-air'), bubs.length);
        for (var b = 0; b < bubs.length; b++) hudIcon(bi[b], bubs[b][0], bubs[b][1], [bubs[b][2]]);
        atkTick();
        hudTipTick(!redraw);
        actionBarTick(!redraw);
    }
    /* The bar fills (int)(progress × 183) pixels of its 182, and the level sits
       over it in 0x80FF20, drawn five times: four black copies a pixel out in
       each direction, then the green one. That outline is not a shadow, so it
       is baked into an image rather than asked of CSS. */
    var XP_LVL = {};
    function xpLevelImg(n) {
        var s = String(n);
        if (XP_LVL[s]) return XP_LVL[s];
        var w = mfWidth(s) + 2, cv = document.createElement('canvas');
        cv.width = w; cv.height = MF_ROWS + 2;
        var cx = cv.getContext('2d');
        mfText(cx, s, 2, 1, '#000000', false); mfText(cx, s, 0, 1, '#000000', false);
        mfText(cx, s, 1, 2, '#000000', false); mfText(cx, s, 1, 0, '#000000', false);
        mfText(cx, s, 1, 1, '#80ff20', false);
        XP_LVL[s] = { url: 'url(' + cv.toDataURL() + ')', w: w, h: MF_ROWS + 2 };
        return XP_LVL[s];
    }
    function paintXp() {
        var el = RT.el, fill = el.querySelector('.mc-xpfill'), lvl = el.querySelector('.mc-xplvl');
        if (fill) fill.style.width = 'calc(var(--px) * ' + Math.min(182, Math.floor(xpBarFrac() * 183)) + ')';
        if (!lvl) return;
        if (S.xpl > 0) {
            var im = xpLevelImg(S.xpl);
            lvl.style.display = '';
            lvl.style.backgroundImage = im.url;
            lvl.style.width = 'calc(var(--px) * ' + im.w + ')'; lvl.style.height = 'calc(var(--px) * ' + im.h + ')';
            lvl.textContent = String(S.xpl);
            // (W - font.width(s)) / 2 at H - 35, less the one-pixel outline margin
            hudPlace(lvl, ((RT.gw - (mfWidth(String(S.xpl)) + 1)) >> 1) - 1, RT.gh - 35 - 1);
        } else { lvl.style.display = 'none'; lvl.textContent = ''; }
    }
    function armorPoints() { var p = 0; for (var i = 0; i < 4; i++) if (S.armor[i]) p += (I[S.armor[i].id].armor.def || 0) + (ench(S.armor[i], 'protection') * 0.5); return p; }
    function armorTough() { var p = 0; for (var i = 0; i < 4; i++) if (S.armor[i]) p += I[S.armor[i].id].armor.tough || 0; return p; }
    /* Creative hides the four bars that only mean something in survival —
       hearts, hunger, armour, experience — and spectator drops the hotbar and
       crosshair on top of that. Done with a class rather than four display
       flags so nothing can paint one of them back on the next tick. */
    function paintHudMode() {
        if (!RT || !RT.el) return;
        RT.el.classList.toggle('mc-nohud', invulnerable());
        RT.el.classList.toggle('mc-spect', isSpectator());
    }
    /* ItemStack popTime: for five ticks after a pick-up the hotbar draws that
       item squashed to 1/(1 + t/5) of its width and (2 + t/5)/2 of its height
       about the point (8, 12), easing back as t runs down. Done per frame with
       the fractional tick, like the game's partialTick. */
    /* With F3 up the crosshair is the three world axes as seen from the camera:
       X red, Y green, Z blue, ten GUI pixels long from the centre of the screen. */
    function cross3d() {
        var cv = RT.el.querySelector('.mc-cross3d');
        if (!cv) return;
        var on = !!RT.f3 && !isSpectator() && !RT.panel && !RT.menu;
        cv.style.display = on ? '' : 'none';
        RT.el.classList.toggle('mc-f3', !!RT.f3);
        if (!on) return;
        var s = RT.gs, n = 32 * s;
        if (cv.width !== n) { cv.width = cv.height = n; cv.style.width = cv.style.height = n + 'px'; }
        hudPlace(cv, (RT.gw >> 1) - 16, (RT.gh >> 1) - 16);
        var c = cv.getContext('2d'), yaw = S.yaw, p = S.pitch;
        c.clearRect(0, 0, n, n);
        // camera right and up, in world axes: yaw 0 faces +Z (south), positive pitch looks down
        var rgt = [-Math.cos(yaw), 0, -Math.sin(yaw)], up = [-Math.sin(yaw) * Math.sin(p), Math.cos(p), Math.cos(yaw) * Math.sin(p)];
        [[[1, 0, 0], '#ff0000'], [[0, 1, 0], '#00ff00'], [[0, 0, 1], '#0000ff']].forEach(function (ax) {
            var d = ax[0], sx = d[0] * rgt[0] + d[1] * rgt[1] + d[2] * rgt[2], sy = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
            c.strokeStyle = ax[1]; c.lineWidth = s; c.lineCap = 'butt';
            c.beginPath(); c.moveTo(n / 2, n / 2); c.lineTo(n / 2 + sx * 10 * s, n / 2 - sy * 10 * s); c.stroke();
        });
    }
    function hudFrame(dt) {
        if (!RT || !RT.el) return;
        toastFrame(dt);
        cross3d();
        if (RT.chat) paintChatInput(); else chatAlpha();
        if (RT.panel) panelFrame(dt);
        iwFrame();
        if (!RT.pops || RT.paused) return;
        var bar = RT.el.querySelector('.mc-hotbar');
        if (!bar) return;
        for (var i = 0; i < 10; i++) {
            var cell = i < 9 ? bar.children[i] : RT.el.querySelector('.mc-offslot'), p = RT.pops[i];
            if (!cell || (!(p > 0) && !cell._pop)) continue;
            p = Math.max(0, p - dt); RT.pops[i] = p;
            var f = p / HUD_TICK, it = cell.querySelector('.mc-it');
            if (it) it.style.transform = f > 0 ? 'scale(' + (1 / (1 + f / 5)).toFixed(4) + ',' + ((2 + f / 5) / 2).toFixed(4) + ')' : '';
            cell._pop = f > 0;
        }
    }

    /* ── toasts + achievements ──────────────────────────────── */
    var ACH = [
        { id: 'inventory', t: 'Taking Inventory', d: 'Press E to open your inventory' },
        { id: 'wood', t: 'Getting Wood', d: 'Punch a tree until a log pops out' },
        { id: 'table', t: 'Benchmarking', d: 'Craft a crafting table' },
        { id: 'pick', t: 'Time to Mine!', d: 'Craft a wooden pickaxe' },
        { id: 'upgrade', t: 'Getting an Upgrade', d: 'Craft a better pickaxe' },
        { id: 'furnace', t: 'Hot Topic', d: 'Construct a furnace' },
        { id: 'iron', t: 'Acquire Hardware', d: 'Smelt an iron ingot' },
        { id: 'sword', t: 'Time to Strike!', d: 'Craft a sword' },
        { id: 'hunter', t: 'Monster Hunter', d: 'Slay a hostile monster' },
        { id: 'cow', t: 'Cow Tipping', d: 'Obtain leather' },
        { id: 'bread', t: 'Bake Bread', d: 'Turn wheat into bread' },
        { id: 'farm', t: 'Time to Farm!', d: 'Till soil with a hoe' },
        { id: 'moar', t: 'MOAR Tools', d: 'Craft one of each tool type' },
        { id: 'diamonds', t: 'DIAMONDS!', d: 'Mine diamond with an iron pickaxe' },
        { id: 'sniper', t: 'Sniper Duel', d: 'Kill a skeleton with an arrow', ch: 1 },
        { id: 'sleep', t: 'Sweet Dreams', d: 'Sleep in a bed to change your respawn point' },
        { id: 'armor', t: 'Suit Up', d: 'Wear a piece of armor' },
        { id: 'enchant', t: 'Enchanter', d: 'Enchant an item at the table' },
        { id: 'anvil2', t: 'Repurpose', d: 'Rename or repair at an anvil' },
        { id: 'breed', t: 'Two by Two', d: 'Breed two animals into a baby' },
        { id: 'ender', t: 'Staring Contest', d: 'Defeat an Enderman' },
        { id: 'gapple', t: 'Golden Bite', d: 'Eat a golden apple' },
        { id: 'xp30', t: 'Seasoned', d: 'Reach experience level 30' }
    ];
    /* each advancement's toast icon, an item the game has */
    var ACH_IC = { inventory: 'table', wood: 'log', table: 'table', pick: 'wood_pick', upgrade: 'stone_pick', furnace: 'furnace',
        iron: 'iron', sword: 'wood_sword', hunter: 'iron_sword', cow: 'leather', bread: 'bread', farm: 'wood_hoe', moar: 'iron_pick',
        diamonds: 'diamond', sniper: 'arrow', sleep: 'bed', armor: 'iron_chest', enchant: 'etable', anvil2: 'anvil', breed: 'wheat',
        ender: 'ender_pearl', gapple: 'golden_apple', xp30: 'ench_book' };
    function achIcon(a) { var ic = ACH_IC[a.id]; return ic && I[ic] ? ic : 'table'; }
    function unlock(id) {
        if (!S || S.ach[id]) return;
        var a = null;
        for (var i = 0; i < ACH.length; i++) if (ACH[i].id === id) a = ACH[i];
        if (!a) return;   // ignore ids not in the list (keeps achN honest)
        S.ach[id] = Date.now();
        S.achN++;
        toastPush({ title: a.ch ? 'Challenge Complete!' : 'Advancement Made!', text: a.t, icon: achIcon(a), color: a.ch ? '#ff88ff' : '#ffff00' });
    }
    /* Toasts, the way ToastManager runs them: 160×32 each, down the top-right
       corner a 32-pixel slot at a time, as many as the screen has room for and
       the rest queued. Each slides in over 600 ms on a squared ease, holds for
       five seconds, and slides out the same way. An advancement's title is
       drawn without a shadow at (30, 7) — yellow, or light purple for a
       challenge — with the name in white at (30, 18) and its icon at (8, 8); a
       system toast has no icon and starts its text at 18. */
    var TOAST_SLIDE = 0.6, TOAST_HOLD = 5;
    function toastPush(t) {
        if (!RT || !RT.el) return;
        (RT.toastQ = RT.toastQ || []).push(t);
        toastFrame(0);
    }
    function toast(msg) {   // a plain message: a system toast, "<b>Title</b>text" or just a title
        var m = /^<b>(.*?)<\/b>(.*)$/.exec(String(msg));
        toastPush({ title: m ? m[1] : String(msg), text: m ? m[2] : '' });
    }
    function toastEl(t) {
        var d = document.createElement('div');
        d.className = 'mc-toast';
        var html = '';
        if (t.kind === 'recipe') {   // RecipeToast: the header in dark purple at (30, 7), the line under it in black, no shadows
            d.classList.add('mc-rtoast');
            html = '<i class="mc-tic mc-tcat"></i><i class="mc-tic mc-tit"></i>' +
                '<span class="mc-tl" style="left:calc(var(--px) * 30);top:calc(var(--px) * 7)">' + mtHTML('New Recipes Unlocked!', '#500050', 'ns') + '</span>' +
                '<span class="mc-tl" style="left:calc(var(--px) * 30);top:calc(var(--px) * 18)">' + mtHTML('Check your recipe book', '#000000', 'ns') + '</span>';
            t.w = 160;
        } else if (t.icon) {   // AdvancementToast: icon at (8, 8), header (30, 7), name (30, 18)
            html = '<i class="mc-tic" style="background-image:url(' + iconURL(t.icon) + ')"></i>' +
                '<span class="mc-tl" style="left:calc(var(--px) * 30);top:calc(var(--px) * 7)">' + mtHTML(t.title, t.color || '#ffff00', 'ns') + '</span>' +
                (t.text ? '<span class="mc-tl" style="left:calc(var(--px) * 30);top:calc(var(--px) * 18)">' + mtHTML(t.text, '#ffffff', 'ns') + '</span>' : '');
            t.w = 160;
        } else {   // SystemToast: title at (18, 7), or 12 alone; message lines 12 apart below it; as wide as it needs
            var lines = t.text ? [t.text] : [];
            html = '<span class="mc-tl" style="left:calc(var(--px) * 18);top:calc(var(--px) * ' + (lines.length ? 7 : 12) + ')">' + mtHTML(t.title, t.color || '#ffff00', 'ns') + '</span>';
            lines.forEach(function (ln, k) { html += '<span class="mc-tl" style="left:calc(var(--px) * 18);top:calc(var(--px) * ' + (19 + 12 * k) + ')">' + mtHTML(ln, '#ffffff', 'ns') + '</span>'; });
            var wmax = mfWidth(t.title) + 1;
            lines.forEach(function (ln) { wmax = Math.max(wmax, mfWidth(ln) + 1); });
            t.w = Math.max(160, wmax + 30);
            d.style.height = 'calc(var(--px) * ' + (20 + Math.max(1, lines.length) * 12) + ')';
        }
        d.style.width = 'calc(var(--px) * ' + t.w + ')';
        d.innerHTML = html;
        return d;
    }
    function toastFrame(dt) {
        var wrap = RT && RT.el && RT.el.querySelector('.mc-toasts');
        if (!wrap || !RT.gs) return;
        var list = RT.toasts = RT.toasts || [], slots = 5, i;
        while (RT.toastQ && RT.toastQ.length && list.length < slots) {
            var t = RT.toastQ.shift(), used = {};
            for (i = 0; i < list.length; i++) used[list[i].slot] = 1;
            for (i = 0; used[i]; i++) {}
            t.slot = i; t.age = 0; t.el = toastEl(t);
            wrap.appendChild(t.el);
            list.push(t);
            snd('ding');
        }
        for (var k = list.length - 1; k >= 0; k--) {
            var o = list[k];
            if (o.age < TOAST_SLIDE + TOAST_HOLD && o.age + dt >= TOAST_SLIDE + TOAST_HOLD) snd('toastout');
            o.age += dt;
            o.life = (o.life || 0) + dt;
            if (o.kind === 'recipe') {   // what was learned takes turns, five seconds shared between them, the station small behind it
                var rn = o.items.length, ri = Math.floor(o.life * 1000 / Math.max(1, 5000 / rn)) % rn;
                if (o.ri !== ri || o.rgs !== RT.gs) {
                    o.ri = ri; o.rgs = RT.gs;
                    o.el.querySelector('.mc-tcat').style.backgroundImage = 'url(' + iconURL(o.items[ri][0]) + ')';
                    o.el.querySelector('.mc-tit').style.backgroundImage = 'url(' + iconURL(o.items[ri][1]) + ')';
                }
            }
            if (o.age >= TOAST_SLIDE * 2 + TOAST_HOLD) { o.el.remove(); list.splice(k, 1); continue; }
            var v;
            if (o.age < TOAST_SLIDE) { v = o.age / TOAST_SLIDE; v *= v; }
            else if (o.age < TOAST_SLIDE + TOAST_HOLD) v = 1;
            else { v = (o.age - TOAST_SLIDE - TOAST_HOLD) / TOAST_SLIDE; v = 1 - v * v; }
            // the slide is sub-pixel in the game (a float translate), so it is here: device pixels, not GUI ones
            o.el.style.left = Math.round((RT.gw - (o.w || 160) * v) * RT.gs) + 'px';
            o.el.style.top = (o.slot * 32 * RT.gs) + 'px';
        }
    }
    /* Gui.setOverlayMessage: one line centred above the hotbar, its top at
       H - 72. Sixty ticks: fully opaque for forty, then fading over twenty. */
    function actionBar(text) {
        var e = RT && RT.el && RT.el.querySelector('.mc-actbar');
        if (!e) return;
        mtSet(e, text, '#ffffff');
        RT.actTk = 60;
        actionBarTick(false);
    }
    function actionBarTick(tick) {
        var e = RT.el.querySelector('.mc-actbar');
        if (!e) return;
        if (tick && RT.actTk > 0) RT.actTk--;
        var a = Math.min(255, Math.floor((RT.actTk || 0) * 255 / 20));
        e.style.opacity = a > 8 ? (a / 255).toFixed(3) : '0';
        if (a > 8) hudPlace(e, (RT.gw >> 1) - ((mfWidth(e.getAttribute('data-t') || '') + 1) >> 1), RT.gh - 72);
    }

    /* ── pause / death / sleep ──────────────────────────────── */
    function showPause() {
        if (RT.dead || RT.paused) return;
        RT.paused = true;
        /* Pausing mid-sleep used to freeze the black sheet at whatever opacity it had
           reached — sleepTick is the only thing that clears it and only runs while
           the sim does. It sits above the menu and eats clicks, so Back to Game,
           Achievements and both toggles all became dead buttons. Waking on pause is
           what the real game does anyway. */
        if (RT.sleep) leaveBed();
        closeChat(false);   // a half-typed command must not float over the menu
        sSave();
        iwShow('pause');
    }
    /* ── Open to LAN ────────────────────────────────────────
       The LAN World screen: a game mode for players who would join, an Allow
       Commands switch, a port, Start LAN World. There is nobody on this LAN,
       but the switch is the real game's only way to turn commands on in a
       world created without them, so it does exactly that, for the rest of the
       session, the way the real one does, and the button greys once the world
       is out. */
    function lanOpen() {
        if (!RT || !RT.paused || RT.lan) return;
        RT.lanUI = { gm: S.gm, cheats: cheatsOn(), port: '', pick: String(1024 + ((Math.random() * (65535 - 1024)) | 0)) };   // an empty box takes the picked port
        iwShow('lan');
    }
    function lanPortOk(p) { p = String(p).trim(); return p === '' || (/^\d{4,5}$/.test(p) && +p >= 1024 && +p <= 65535); }
    function lanClose() {
        if (!RT || !RT.el) return;
        RT.lanUI = null;
        if (RT.paused) iwShow('pause');
        RT.el.focus();
    }
    function lanStart() {
        var u = RT && RT.lanUI;
        if (!u || !lanPortOk(u.port)) { if (u) iwRender(false); return; }
        RT.lan = { gm: u.gm, cheats: !!u.cheats, port: +(String(u.port).trim() || u.pick) };
        RT.lanUI = null;
        chatSay('Local game hosted on port ' + RT.lan.port);
        hidePause();
        lockCursor();
    }
    function hidePause() {
        RT.paused = false;
        RT.lanUI = null;
        iwHide();
        RT.lastT = 0;   // don't count paused time as a frame
        RT.el.focus();  // the clicked button just vanished with the menu — keys must land on the game root
    }
    function showDeath() {
        unlockCursor();
        iwShow('death', { msg: deathMsg(), score: S.score || 0 });
    }
    function hideDeath() { iwHide(); RT.el.focus(); }
    /* InBedChatScreen: in bed the pointer is free and "Leave Bed" waits at
       (W/2 - 100, H - 40); taking it, or Escape, gets you up with the night
       still dark, and the overlay goes with you */
    function leaveBed() {
        RT.sleep = 0; RT.woke = 0;
        var ov = RT.el.querySelector('.mc-sleepov'); if (ov) ov.style.display = 'none';
        var b = RT.el.querySelector('.mc-bed'); if (b) b.style.display = 'none';
        RT.el.focus();
    }
    function bedLayout() {
        var b = RT.el.querySelector('.mc-bed');
        if (!b) return;
        var on = !!RT.sleep && !RT.woke && !RT.paused && !RT.dead;
        if (on && b.style.display === 'none') {
            b.innerHTML = iwBtn('mc-leavebed', 'leave', (RT.gw >> 1) - 100, RT.gh - 40, 200, 'Leave Bed');
            b._W = RT.gw; b._H = RT.gh;
        } else if (on && (b._W !== RT.gw || b._H !== RT.gh)) {
            b.innerHTML = iwBtn('mc-leavebed', 'leave', (RT.gw >> 1) - 100, RT.gh - 40, 200, 'Leave Bed');
            b._W = RT.gw; b._H = RT.gh;
        }
        b.style.display = on ? '' : 'none';
    }
    /* ── in-world screens ────────────────────────────────────────
       The Game Menu, the screens behind its buttons, the death screen and its
       confirmation: Screens over the world, laid out on the GUI grid where the
       game lays them out, their widgets the game's 20-pixel buttons. Each is a
       real <button> wearing the widget sprite, so Tab, Enter, Space and screen
       readers work the way the game's keyboard navigation does. Under the Game
       Menu and its sub-screens the world and the HUD are blurred, the game's
       Menu Background Blur of 5 (three box passes of radius 5, about a
       5.5-pixel Gaussian on the screen), beneath the in-world menu background;
       the death screens keep the world sharp under their red gradient. */
    var IW_SCR = {};
    function iwAt(x, y, w, h) { return pAt(x, y) + (w ? ';width:calc(var(--px) * ' + w + ')' : '') + (h ? ';height:calc(var(--px) * ' + h + ')' : ''); }
    function iwText(t, x, y, col, mcls) { return '<span class="mc-iwt" style="' + pAt(x, y) + '">' + mtHTML(t, col || '#ffffff', mcls) + '</span>'; }
    // drawCenteredString: x = W/2 - width/2, both whole pixels
    function iwCenter(t, W, y, col) { return iwText(t, (W >> 1) - ((mfWidth(t) + 1) >> 1), y, col); }
    function iwLabel(label, w, off) {
        var tw = mfWidth(label) + 1;
        return '<span class="mc-wbl" style="left:calc(var(--px) * ' + ((w >> 1) - (tw >> 1)) + ')">' + mtHTML(label, off ? '#a0a0a0' : '#ffffff') + '</span>';
    }
    function iwBtn(cls, act, x, y, w, label, off) {
        return '<button type="button" class="mc-wb' + (cls ? ' ' + cls : '') + '" data-act="' + act + '" data-w="' + w + '"' + (off ? ' disabled' : '') +
            ' style="' + iwAt(x, y, w) + '">' + iwLabel(label, w, off) + '</button>';
    }
    function iwIcon(cls, act, x, y, icon, name, off) {
        return '<button type="button" class="mc-wb mc-wbi' + (cls ? ' ' + cls : '') + '" data-act="' + act + '" data-tip="' + escHtml(name) + '" aria-label="' + escHtml(name) + '"' +
            (off ? ' disabled' : '') + ' style="' + iwAt(x, y, 20) + '"><i style="background-image:var(--spr-' + icon + ')"></i></button>';
    }
    function iwSetBtn(b, label, off) {   // a button whose label or state changed, updated in place so it keeps focus
        if (!b) return;
        var w = +b.getAttribute('data-w') || 200, html = iwLabel(label, w, off);
        if (b._html !== html) { b._html = html; b.innerHTML = html; }
        if (b.disabled !== !!off) {
            var had = document.activeElement === b;
            b.disabled = !!off;
            if (had && off) RT.el.focus();
        }
    }
    function iwShow(scr, d) {
        if (!IW_SCR[scr]) return;
        RT.iw = { scr: scr, t0: RT.now || 0, live: false, d: d || {} };
        iwRender(true);
    }
    function iwHide() {
        RT.iw = null;
        ['.mc-pause', '.mc-death'].forEach(function (q) { var h = RT.el.querySelector(q); if (h) h.style.display = 'none'; });
        RT.el.classList.remove('mc-blur');
    }
    function iwRender(full) {
        var iw = RT.iw;
        if (!iw || !RT.gs) return;
        var def = IW_SCR[iw.scr], host = RT.el.querySelector(def.host === 'death' ? '.mc-death' : '.mc-pause');
        var other = RT.el.querySelector(def.host === 'death' ? '.mc-pause' : '.mc-death');
        if (other) other.style.display = 'none';
        host.style.display = '';
        RT.el.classList.toggle('mc-blur', def.host !== 'death');
        RT.el.style.setProperty('--mblur', (5.5 / (window.devicePixelRatio || 1)).toFixed(2) + 'px');
        var layers = host.querySelectorAll('.mc-iwl'), layer = null;
        for (var i = 0; i < layers.length; i++) {
            var mine = layers[i].classList.contains(def.layer);
            layers[i].style.display = mine ? '' : 'none';
            if (mine) layer = layers[i];
        }
        if (full || layer._scr !== iw.scr || layer._W !== RT.gw || layer._H !== RT.gh) {
            var act = document.activeElement, keep = act && layer.contains(act) ? act.getAttribute('data-act') : null;
            layer._scr = iw.scr; layer._W = RT.gw; layer._H = RT.gh;
            layer.innerHTML = def.html(RT.gw, RT.gh, iw);
            if (def.wire) def.wire(layer, iw);
            if (keep) { var back = layer.querySelector('[data-act="' + keep + '"]'); if (back && !back.disabled) back.focus(); }
            tipRender(null, 0, 0, host.querySelector('.mc-iwtip'));
        }
        if (def.update) def.update(layer, iw);
    }
    /* per frame: the death screens' one-second lock, the text boxes' cursors */
    function iwFrame() {
        var iw = RT.iw;
        if (!iw) return;
        var def = IW_SCR[iw.scr];
        if (def.delay && !iw.live && (RT.now || 0) - iw.t0 >= 1) { iw.live = true; iwRender(false); }   // 20 ticks
        if (def.frame) def.frame(iw);
    }
    /* the widgets' shared plumbing, wired once on each host: a press plays the
       click (never on a greyed widget), a click acts, a hovered icon button names
       itself in a tooltip, and Escape is the screen's own */
    function iwWire(host) {
        host.addEventListener('mousedown', function (e) {
            var b = e.target.closest && e.target.closest('.mc-wb');
            if (b && !b.disabled && e.button === 0) { audioInit(); snd('click'); }
            if (!(e.target.closest && e.target.closest('input'))) e.preventDefault();   // a press must not park focus on the button
            e.stopPropagation();
        });
        host.addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('.mc-wb');
            if (!b || b.disabled || !RT.iw) return;
            if (!e.detail) { audioInit(); snd('click'); }   // Enter or Space: no press came first
            var def = IW_SCR[RT.iw.scr];
            if (def.act) def.act(b.getAttribute('data-act'), b);
            e.stopPropagation();
        });
        host.addEventListener('mousemove', function (e) {
            var b = e.target.closest && e.target.closest('[data-tip]'), tip = host.querySelector('.mc-iwtip');
            var lines = null;
            if (b) lines = b.getAttribute('data-tip').split('\n').map(function (t) { return { t: t }; });
            tipRender(lines, e.clientX, e.clientY, tip);
        });
        host.addEventListener('mouseleave', function () { tipRender(null, 0, 0, host.querySelector('.mc-iwtip')); });
        host.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                e.preventDefault(); e.stopPropagation();
                var def = RT.iw && IW_SCR[RT.iw.scr];
                if (def && def.esc) def.esc();
                return;
            }
            e.stopPropagation();   // Tab, Enter, Space and typing belong to the focused widget
        });
        host.addEventListener('keyup', function (e) { e.stopPropagation(); });
    }

    /* ── the Game Menu ──
       PauseScreen as 26.2 builds it: a 212x166 grid at ((W - 212) / 2,
       (H - 166) / 4) of 204-wide rows and 98-wide halves with 8 between them,
       its first row 50 down; the title 40 from the top. Report Bugs and Give
       Feedback open their links; this world's only other players would come
       over LAN, so Friends is where the LAN World screen lives; Player
       Reporting is greyed with nobody else here. */
    IW_SCR.pause = {
        host: 'pause', layer: 'mc-pmain',
        html: function (W, H) {
            var x0 = ((W - 212) * 0.5) | 0, y0 = ((H - 166) * 0.25) | 0;
            return iwCenter('Game Menu', W, 40) +
                iwBtn('mc-resume', 'resume', x0 + 4, y0 + 50, 204, 'Back to Game') +
                iwBtn('mc-advbtn', 'adv', x0 + 4, y0 + 74, 98, 'Advancements') +
                iwBtn('mc-statbtn', 'stats', x0 + 110, y0 + 74, 98, 'Statistics') +
                iwIcon('mc-bugbtn', 'bugs', x0 + 60, y0 + 98, 'ic_bug', 'Report Bugs') +
                iwIcon('mc-fbbtn', 'feedback', x0 + 84, y0 + 98, 'ic_feedback', 'Give Feedback') +
                iwIcon('mc-lanbtn', 'lan', x0 + 108, y0 + 98, 'ic_friends', 'Friends', !!RT.lan) +
                iwIcon('mc-repbtn', 'report', x0 + 132, y0 + 98, 'ic_report', 'Player Reporting', true) +
                iwBtn('mc-optbtn', 'options', x0 + 4, y0 + 122, 204, 'Options...') +
                iwBtn('mc-totitle', 'quit', x0 + 4, y0 + 146, 204, 'Save and Quit to Title');
        },
        update: function (layer) { var b = layer.querySelector('.mc-lanbtn'); if (b) b.disabled = !!RT.lan; },
        act: function (a) {
            if (a === 'resume') { hidePause(); lockCursor(); }
            else if (a === 'quit') mnToTitle();
            else if (a === 'lan') lanOpen();
            else if (a === 'options') iwOptions();
            else if (a === 'bugs') iwShow('link', { url: 'https://aka.ms/snapshotbugs?ref=game' });
            else if (a === 'feedback') iwShow('link', { url: 'https://aka.ms/javafeedback?ref=game' });
            else if (a === 'adv' || a === 'stats') iwShow(a);
        },
        esc: function () { hidePause(); lockCursor(); }
    };
    /* ConfirmLinkScreen for a trusted link: the question, the address under it,
       and Open in Browser, Copy to Clipboard and Cancel, 100 wide and 5 apart */
    IW_SCR.link = {
        host: 'pause', layer: 'mc-plink',
        html: function (W, H, iw) {
            var tt = Math.max(10, Math.min(80, ((H - 9) >> 1) - 29)), by = Math.max(((H / 6) | 0) + 96, Math.min(H - 24, tt + 20 + 9 + 20)), cx = W >> 1;
            return iwCenter('Do you want to open this link or copy it to your clipboard?', W, tt) + iwCenter(iw.d.url, W, tt + 20) +
                iwBtn('', 'open', cx - 155, by, 100, 'Open in Browser') + iwBtn('', 'copy', cx - 50, by, 100, 'Copy to Clipboard') + iwBtn('', 'cancel', cx + 55, by, 100, 'Cancel');
        },
        act: function (a) {
            var url = RT.iw.d.url;
            if (a === 'open') { try { window.open(url, '_blank', 'noopener'); } catch (e) {} }
            if (a === 'copy') { try { navigator.clipboard.writeText(url); } catch (e) {} }
            iwShow('pause');
        },
        esc: function () { iwShow('pause'); }
    };
    /* ShareToLanScreen: the title at 50, "Settings for Other Players" at 82,
       Game Mode and Allow Commands side by side at 100, "Port Number" at 142 over
       a 150-wide box at 160 whose hint is the port it picked, and Start LAN World
       and Cancel along the bottom. A bad port turns the box's text red, puts the
       reason in its tooltip and greys Start. */
    var LAN_GM = [0, 3, 1, 2];   // the cycle's order: Survival, Spectator, Creative, Adventure
    var LAN_BAD = 'Not a valid port.\nLeave the edit box empty or enter a number between 1024 and 65535.';
    IW_SCR.lan = {
        host: 'pause', layer: 'mc-lan',
        html: function (W, H) {
            var u = RT.lanUI, cx = W >> 1;
            return iwCenter('LAN World', W, 50) + iwCenter('Settings for Other Players', W, 82) +
                iwBtn('mc-langm', 'gm', cx - 155, 100, 150, 'Game Mode: ' + GM_NAME[u.gm]) +
                iwBtn('mc-lanch', 'ch', cx + 5, 100, 150, 'Allow Commands: ' + (u.cheats ? 'ON' : 'OFF')) +
                iwCenter('Port Number', W, 142) +
                '<div class="mc-iwfield" style="' + iwAt(cx - 75, 160, 150, 20) + '"><input class="mc-lanport" maxlength="5" inputmode="numeric" spellcheck="false" autocomplete="off" aria-label="Port Number">' +
                '<div class="mc-iwmir mc-fmir"></div></div><span class="mc-lanmsg" hidden></span>' +
                iwBtn('mc-lanstart', 'start', cx - 155, H - 28, 150, 'Start LAN World') +
                iwBtn('mc-lancancel', 'cancel', cx + 5, H - 28, 150, 'Cancel');
        },
        wire: function (layer) {
            var pin = layer.querySelector('.mc-lanport'), u = RT.lanUI;
            pin.value = u.port; pin.placeholder = u.pick;
            pin.addEventListener('input', function () { if (RT.lanUI) { RT.lanUI.port = pin.value; iwRender(false); } });
            pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); lanStart(); } });
            pin.addEventListener('focus', function () { pin._ft = performance.now(); });
        },
        update: function (layer) {
            var u = RT.lanUI, ok = lanPortOk(u.port), box = layer.querySelector('.mc-iwfield');
            iwSetBtn(layer.querySelector('.mc-langm'), 'Game Mode: ' + GM_NAME[u.gm]);
            iwSetBtn(layer.querySelector('.mc-lanch'), 'Allow Commands: ' + (u.cheats ? 'ON' : 'OFF'));
            iwSetBtn(layer.querySelector('.mc-lanstart'), 'Start LAN World', !ok);
            layer.querySelector('.mc-lanmsg').textContent = ok ? '' : LAN_BAD;
            if (ok) box.removeAttribute('data-tip'); else box.setAttribute('data-tip', LAN_BAD);
            IW_SCR.lan.frame(RT.iw);
        },
        frame: function () {
            var layer = RT.el.querySelector('.mc-pause .mc-lan'), pin = layer && layer.querySelector('.mc-lanport');
            if (!pin || !RT.lanUI) return;
            layer.querySelector('.mc-iwfield').classList.toggle('on', document.activeElement === pin);
            paintFieldMirror(pin, layer.querySelector('.mc-iwmir'), lanPortOk(RT.lanUI.port) ? '#e0e0e0' : '#df5050', 142, RT.lanUI.pick);
        },
        act: function (a) {
            var u = RT.lanUI;
            if (a === 'gm') { u.gm = LAN_GM[(LAN_GM.indexOf(u.gm) + 1) % 4]; iwRender(false); }
            else if (a === 'ch') { u.cheats = !u.cheats; iwRender(false); }
            else if (a === 'start') lanStart();
            else if (a === 'cancel') lanClose();
        },
        esc: function () { lanClose(); }
    };
    /* ── the death screen ──
       DeathScreen: the world stays sharp behind a gradient from 0x60500000 at
       the top to 0xA0803030 at the bottom; "You Died!" at twice the size, centred
       at y 60; the cause at 85; "Score: " and the score in yellow at 100; Respawn
       and Title Screen at H/4 + 72 and + 96, both dead for the first twenty ticks.
       Escape does nothing. */
    IW_SCR.death = {
        host: 'death', layer: 'mc-dmain', delay: true,
        html: function (W, H, iw) {
            var t = 'You Died!', x2 = ((W >> 1) >> 1) - ((mfWidth(t) + 1) >> 1);
            var sc = 'Score: ', n = String(iw.d.score || 0), sw = mfWidth(sc + n) + 1, sx = (W >> 1) - (sw >> 1);
            return iwText(t, x2 * 2, 60, '#ffffff', 'x2') + iwCenter(iw.d.msg || '', W, 85) +
                '<span class="mc-dscore">' + iwText(sc, sx, 100, '#ffffff') + iwText(n, sx + mfWidth(sc) + 1, 100, '#ffff55') + '</span>' +
                iwBtn('mc-respawn', 'respawn', (W >> 1) - 100, (H >> 2) + 72, 200, 'Respawn', true) +
                iwBtn('mc-dtitle', 'title', (W >> 1) - 100, (H >> 2) + 96, 200, 'Title Screen', true);
        },
        update: function (layer, iw) {
            iwSetBtn(layer.querySelector('.mc-respawn'), 'Respawn', !iw.live);
            iwSetBtn(layer.querySelector('.mc-dtitle'), 'Title Screen', !iw.live);
        },
        act: function (a) {
            if (a === 'respawn') { respawn(); lockCursor(); }
            else if (a === 'title') iwShow('dquit', RT.iw.d);
        }
    };
    /* its ConfirmScreen, on the same red: "Are you sure you want to quit?" with
       Title Screen and Respawn, and the same twenty-tick lock */
    IW_SCR.dquit = {
        host: 'death', layer: 'mc-dquit', delay: true,
        html: function (W, H) {
            var tt = Math.max(10, Math.min(80, (H >> 1) - 29)), by = Math.max(((H / 6) | 0) + 96, Math.min(H - 24, tt + 40));
            return iwCenter('Are you sure you want to quit?', W, tt) +
                iwBtn('mc-dqtitle', 'title', (W >> 1) - 155, by, 150, 'Title Screen', true) +
                iwBtn('mc-dqrespawn', 'respawn', (W >> 1) + 5, by, 150, 'Respawn', true);
        },
        update: function (layer, iw) {
            iwSetBtn(layer.querySelector('.mc-dqtitle'), 'Title Screen', !iw.live);
            iwSetBtn(layer.querySelector('.mc-dqrespawn'), 'Respawn', !iw.live);
        },
        act: function (a) {
            if (a === 'respawn') { respawn(); lockCursor(); }
            else if (a === 'title') mnToTitle();
        }
    };
    /* ── Advancements ──────────────────────────────────────────────
       AdvancementsScreen: "Advancements" over a 252x140 window at
       ((W - 252) / 2, (H - 140) / 2), a single tab, so no tab strip and the
       window titled with the tab's root, "Minecraft". Its 234x113 view shows
       the tree on tiled stone: every node 28 across and 27 down a step, joined
       by the game's white lines on black, a gold frame once earned and grey
       before; a node shows once it is done, or its parent or grandparent is,
       and so does everything on the way to it. Drag or scroll to move about.
       Hovering darkens the view and draws the node's bar, blue or gold, with
       its title and, under it, the description in the frame's colour. */
    var ADV_PARENT = { inventory: 'root', wood: 'inventory', table: 'wood', pick: 'table', upgrade: 'pick', furnace: 'upgrade', iron: 'furnace',
        diamonds: 'iron', enchant: 'diamonds', xp30: 'enchant', armor: 'iron', anvil2: 'iron', moar: 'pick', farm: 'table', bread: 'farm',
        gapple: 'bread', sword: 'table', hunter: 'sword', sniper: 'hunter', ender: 'hunter', cow: 'sword', breed: 'cow', sleep: 'root' };
    var ADV_KIND = { sniper: 'challenge', diamonds: 'goal', xp30: 'goal' };
    var ADV_ROOT = { id: 'root', t: 'Minecraft', d: 'The heart and story of the game', ic: 'grass_block' };
    function advTree() {
        var all = [ADV_ROOT].concat(ACH), by = {}, kids = {};
        all.forEach(function (a) { by[a.id] = a; if (a.id !== 'root') (kids[ADV_PARENT[a.id] || 'root'] = kids[ADV_PARENT[a.id] || 'root'] || []).push(a.id); });
        function done(id) { return id === 'root' ? S.achN > 0 : !!S.ach[id]; }
        // positions for the whole tree: a leaf a row, a parent midway down its children
        var pos = {}, row = 0;
        (function place(id, d) {
            var ch = kids[id] || [];
            if (!ch.length) { pos[id] = { x: d * 28, y: row++ * 27 }; return; }
            ch.forEach(function (c) { place(c, d + 1); });
            pos[id] = { x: d * 28, y: Math.floor((pos[ch[0]].y + pos[ch[ch.length - 1]].y) / 2) };
        })('root', 0);
        // AdvancementVisibilityEvaluator: done, or a done parent or grandparent, or a visible descendant
        var vis = {};
        (function visit(id, p1, p2) {
            var any = false;
            (kids[id] || []).forEach(function (c) { if (visit(c, done(id), p1)) any = true; });
            return (vis[id] = done(id) || p1 || p2 || any);
        })('root', false, false);
        var nodes = [], b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 };
        all.forEach(function (a) {
            if (!vis[a.id]) return;
            var p = pos[a.id], n = { id: a.id, a: a, x: p.x, y: p.y, done: done(a.id), kind: ADV_KIND[a.id] || 'task', parent: a.id === 'root' ? null : ADV_PARENT[a.id] || 'root' };
            nodes.push(n);
            b.x0 = Math.min(b.x0, n.x); b.x1 = Math.max(b.x1, n.x + 28); b.y0 = Math.min(b.y0, n.y); b.y1 = Math.max(b.y1, n.y + 27);
        });
        return { nodes: nodes, by: nodes.reduce(function (m, n) { m[n.id] = n; return m; }, {}), b: b, empty: S.achN === 0 };
    }
    function advLine(x0, x1, y, col) {   // hLine, both ends included
        var a = Math.min(x0, x1), w = Math.abs(x1 - x0) + 1;
        return '<i style="left:calc(var(--px) * ' + a + ');top:calc(var(--px) * ' + y + ');width:calc(var(--px) * ' + w + ');height:var(--px);background:' + col + '"></i>';
    }
    function advVLine(x, y0, y1, col) {   // vLine: both ends left out
        var a = Math.min(y0, y1) + 1, h = Math.abs(y1 - y0) - 1;
        return h > 0 ? '<i style="left:calc(var(--px) * ' + x + ');top:calc(var(--px) * ' + a + ');width:var(--px);height:calc(var(--px) * ' + h + ');background:' + col + '"></i>' : '';
    }
    function advContent(T) {
        var html = '', pass;
        // AdvancementWidget.drawConnectivity: the black shadow pass under the white one
        for (pass = 0; pass < 2; pass++) T.nodes.forEach(function (n) {
            var P = n.parent && T.by[n.parent];
            if (!P) return;
            var i = P.x + 13, j = P.x + 30, k = P.y + 13, l = n.x + 13, i1 = n.y + 13;
            if (!pass) {
                html += advLine(j, i, k - 1, '#000') + advLine(j + 1, i, k, '#000') + advLine(j, i, k + 1, '#000') +
                    advLine(l, j - 1, i1 - 1, '#000') + advLine(l, j - 1, i1, '#000') + advLine(l, j - 1, i1 + 1, '#000') +
                    advVLine(j - 1, i1, k, '#000') + advVLine(j + 1, i1, k, '#000');
            } else html += advLine(j, i, k, '#fff') + advLine(l, j, i1, '#fff') + advVLine(j, i1, k, '#fff');
        });
        T.nodes.forEach(function (n) {
            html += '<i class="mc-advf" style="' + pAt(n.x + 3, n.y) + ';background-image:var(--spr-adv_' + n.kind + (n.done ? '_o' : '_u') + ')"></i>' +
                '<i class="mc-advi" style="' + pAt(n.x + 8, n.y + 5) + ';background-image:url(' + iconURL(n.a.ic || achIcon(n.a)) + ')"></i>';
        });
        return html;
    }
    // AdvancementWidget's width and description lines: the title plus 29, the description split to fit round that
    function advMeasure(n) {
        if (n.w) return;
        var base = 29 + mfWidth(n.a.t) + 1, best = null, bd = 1e9;
        [0, 10, -10, 25, -25].some(function (o) {
            var ls = mfWrap(n.a.d, base - o), mw = ls.reduce(function (m, s) { return Math.max(m, mfWidth(s) + 1); }, 0), dd = Math.abs(mw - base);
            if (dd < bd) { bd = dd; best = ls; }
            return dd <= 10;
        });
        n.lines = best;
        n.w = best.reduce(function (m, s) { return Math.max(m, mfWidth(s) + 1); }, base) + 3 + 5;
    }
    function advHover(A, n) {
        var box = RT.el.querySelector('.mc-advs .mc-advhov');
        if (!box) return;
        if (!n) { if (box._id) { box._id = null; box.innerHTML = ''; } return; }
        var key = n.id + '|' + A.sx + '|' + A.sy;
        if (box._id === key) return;
        box._id = key;
        advMeasure(n);
        var sx = Math.floor(A.sx), sy = Math.floor(A.sy);
        var ox = A.wx + 9, oy = A.wy + 18, x = sx + n.x, l = sy + n.y, w = n.w, nl = n.lines.length;
        var right = A.wx + x + w + 26 >= RT.gw, low = 113 - sy - n.y - 26 <= 6 + nl * 9;
        var i1 = right ? x - w + 26 + 6 : x, j1 = 32 + nl * 9, half = w >> 1, t = n.done ? 'o' : 'u';
        var html = '';
        if (nl) html += '<i class="mc-advdesc" style="' + iwAt(ox + i1, oy + (low ? l + 26 - j1 : l), w, j1) + '"></i>';
        html += '<i class="mc-advbar" style="' + iwAt(ox + i1, oy + l, half, 26) + ';background-image:var(--spr-adv_bar_' + t + ')"></i>' +
            '<i class="mc-advbar" style="' + iwAt(ox + i1 + half, oy + l, w - half, 26) + ';background-image:var(--spr-adv_bar_' + t + ');background-position:right 0 top 0"></i>' +
            '<i class="mc-advf" style="' + pAt(ox + x + 3, oy + l) + ';background-image:var(--spr-adv_' + n.kind + '_' + t + ')"></i>' +
            '<i class="mc-advi" style="' + pAt(ox + x + 8, oy + l + 5) + ';background-image:url(' + iconURL(n.a.ic || achIcon(n.a)) + ')"></i>' +
            iwText(n.a.t, right ? ox + i1 + 5 : ox + x + 32, oy + l + 9, '#ffffff');
        var dc = n.kind === 'challenge' ? '#aa00aa' : '#55ff55';
        n.lines.forEach(function (s, k) { html += iwText(s, ox + i1 + 5, oy + (low ? l + 26 - j1 + 7 + k * 9 : l + 9 + 17 + k * 9), dc, 'ns'); });
        box.innerHTML = html;
    }
    IW_SCR.adv = {
        host: 'pause', layer: 'mc-advs',
        html: function (W, H, iw) {
            var A = iw.adv = iw.adv || {}, T = A.T = advTree();
            A.wx = (W - 252) >> 1; A.wy = (H - 140) >> 1;
            if (A.sx == null) { A.sx = Math.floor(117 - (T.b.x1 + T.b.x0) / 2); A.sy = Math.floor(56 - (T.b.y1 + T.b.y0) / 2); A.fade = 0; }
            var view = T.empty
                ? '<div class="mc-advview empty" style="' + iwAt(A.wx + 9, A.wy + 18, 234, 113) + '"></div>' +
                  iwCenter("There doesn't seem to be anything here...", 2 * (A.wx + 9 + 117), A.wy + 18 + 56 - 4) + iwCenter(':(', 2 * (A.wx + 9 + 117), A.wy + 18 + 113 - 9)
                : '<div class="mc-advview" style="' + iwAt(A.wx + 9, A.wy + 18, 234, 113) + '"><div class="mc-advc">' + advContent(T) + '</div><i class="mc-advfade"></i></div>';
            return iwCenter('Advancements', W, 12) + view +
                '<i class="mc-advwin" style="' + iwAt(A.wx, A.wy, 252, 140) + '"></i>' +
                iwText(T.empty ? 'Advancements' : 'Minecraft', A.wx + 8, A.wy + 6, '#404040', 'ns') +
                '<div class="mc-advhov"></div>' +
                iwBtn('mc-advdone', 'done', (W >> 1) - 100, H - 27, 200, 'Done');
        },
        wire: function (layer, iw) {
            var view = layer.querySelector('.mc-advview'), A = iw.adv;
            if (!view || A.T.empty) return;
            var drag = null;
            view.style.backgroundImage = 'url(' + advStone() + ')';
            function scrollBy(dx, dy) {
                var T = A.T;
                if (T.b.x1 - T.b.x0 > 234) A.sx = Math.max(-(T.b.x1 - 234), Math.min(0, A.sx + dx));
                if (T.b.y1 - T.b.y0 > 113) A.sy = Math.max(-(T.b.y1 - 113), Math.min(0, A.sy + dy));
                IW_SCR.adv.place(layer, iw);
            }
            view.addEventListener('mousedown', function (e) { if (e.button === 0) drag = { x: e.clientX, y: e.clientY }; });
            if (layer._mv) window.removeEventListener('mousemove', layer._mv);
            window.addEventListener('mousemove', layer._mv = function mv(e) {
                if (!RT || !RT.iw || RT.iw !== iw) { window.removeEventListener('mousemove', mv); layer._mv = null; return; }
                if (drag && (e.buttons & 1)) { scrollBy((e.clientX - drag.x) / RT.gs, (e.clientY - drag.y) / RT.gs); drag = { x: e.clientX, y: e.clientY }; }
                else drag = null;
                var r = RT.el.getBoundingClientRect(), mx = (e.clientX - r.left) / RT.gs - A.wx - 9, my = (e.clientY - r.top) / RT.gs - A.wy - 18, hit = null;
                if (mx > 0 && mx < 234 && my > 0 && my < 113 && !drag) A.T.nodes.forEach(function (n) {
                    var nx = Math.floor(A.sx) + n.x, ny = Math.floor(A.sy) + n.y;
                    if (mx >= nx && mx <= nx + 26 && my >= ny && my <= ny + 26) hit = n;
                });
                A.hover = hit;
                advHover(A, hit);
            });
            view.addEventListener('wheel', function (e) { scrollBy(-e.deltaX / 100 * 16, -e.deltaY / 100 * 16); e.preventDefault(); }, { passive: false });
            IW_SCR.adv.place(layer, iw);
        },
        place: function (layer, iw) {
            var c = layer.querySelector('.mc-advc'), view = layer.querySelector('.mc-advview'), A = iw.adv;
            if (!c) return;
            var x = Math.floor(A.sx), y = Math.floor(A.sy);
            c.style.transform = 'translate(calc(var(--px) * ' + x + '), calc(var(--px) * ' + y + '))';
            view.style.backgroundPosition = 'calc(var(--px) * ' + (x % 16) + ') calc(var(--px) * ' + (y % 16) + ')';
            if (A.hover) { var box = layer.querySelector('.mc-advhov'); if (box) box._id = null; advHover(A, A.hover); }
        },
        frame: function (iw) {   // the view darkens toward 0.3 while a node is hovered and clears twice as fast
            var A = iw.adv, f = RT.el.querySelector('.mc-advs .mc-advfade');
            if (!A || !f) return;
            A.fade = Math.max(0, Math.min(0.3, (A.fade || 0) + (A.hover ? 0.02 : -0.04)));
            var op = A.fade.toFixed(3);
            if (f._op !== op) { f._op = op; f.style.opacity = op; }
        },
        act: function (a) { if (a === 'done') IW_SCR.adv.esc(); },
        esc: function () { if (RT.iw && RT.iw.d.fromKey) { hidePause(); lockCursor(); } else iwShow('pause'); }
    };
    var ADV_STONE = null;
    function advStone() {   // the tab's background, the stone texture at a pixel a texel
        if (ADV_STONE) return ADV_STONE;
        var cv = document.createElement('canvas'), t = TILE.stone;
        cv.width = cv.height = 16;
        cv.getContext('2d').drawImage(ATLAS, (t % 16) * 16, ((t / 16) | 0) * 16, 16, 16, 0, 0, 16, 16);
        return (ADV_STONE = cv.toDataURL());
    }
    /* ── Statistics ───────────────────────────────────────────────
       The counters behind the Statistics screen, kept in the save the way the
       game keeps stats/<uuid>.json: custom stats by name (distances in
       centimetres, damage in tenths, times in ticks), and per item how often
       it was mined, broken, crafted, used, picked up and dropped, per mob how
       often you killed it and it killed you. */
    function stat(cat, key, n) {
        if (!S) return;
        var st = S.stats || (S.stats = {}), c = st[cat] || (st[cat] = {});
        c[key] = (c[key] || 0) + (n == null ? 1 : n);
    }
    function statGet(cat, key) { return (S.stats && S.stats[cat] && S.stats[cat][key]) || 0; }
    /* Player.checkMovementStatistics: a frame's movement into the right bucket */
    function statMove(dt) {
        var lp = RT.statPos, ticks = dt * 20;
        RT.statPos = [S.px, S.py, S.pz];
        stat('c', 'play_time', ticks); stat('c', 'total_world_time', ticks); stat('c', 'time_since_death', ticks); stat('c', 'time_since_rest', ticks);
        if (RT.keys && RT.keys.shift && RT.ground && !RT.fly) stat('c', 'sneak_time', ticks);
        if (!lp) return;
        var dx = S.px - lp[0], dy = S.py - lp[1], dz = S.pz - lp[2];
        var h = Math.round(Math.sqrt(dx * dx + dz * dz) * 100), d3 = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz) * 100);
        if (h > 1000 || d3 > 1000 || !d3) return;   // a teleport is not a walk
        var headW = getB(Math.floor(S.px), Math.floor(S.py + EYE), Math.floor(S.pz)) === WATER, feetW = inFluid(WATER);
        if (headW && RT.sprint) stat('c', 'swim_one_cm', d3);
        else if (headW) stat('c', 'walk_under_water_one_cm', d3);
        else if (feetW) stat('c', 'walk_on_water_one_cm', h);
        else if (onLadder()) { if (dy > 0) stat('c', 'climb_one_cm', Math.round(dy * 100)); }
        else if (RT.ground) stat('c', RT.sprint ? 'sprint_one_cm' : RT.keys && RT.keys.shift ? 'crouch_one_cm' : 'walk_one_cm', h);
        else stat('c', 'fly_one_cm', h);
    }
    // the General list: every custom stat the game counts, by its name, and how it is written
    var STAT_CUSTOM = [
        ['animals_bred', 'Animals Bred'], ['clean_armor', 'Armor Pieces Cleaned'], ['clean_banner', 'Banners Cleaned'], ['open_barrel', 'Barrels Opened'],
        ['bell_ring', 'Bells Rung'], ['eat_cake_slice', 'Cake Slices Eaten'], ['fill_cauldron', 'Cauldrons Filled'], ['open_chest', 'Chests Opened'],
        ['damage_absorbed', 'Damage Absorbed', 't'], ['damage_blocked_by_shield', 'Damage Blocked by Shield', 't'], ['damage_dealt', 'Damage Dealt', 't'],
        ['damage_dealt_absorbed', 'Damage Dealt (Absorbed)', 't'], ['damage_dealt_resisted', 'Damage Dealt (Resisted)', 't'], ['damage_resisted', 'Damage Resisted', 't'],
        ['damage_taken', 'Damage Taken', 't'], ['inspect_dispenser', 'Dispensers Searched'], ['boat_one_cm', 'Distance by Boat', 'd'], ['aviate_one_cm', 'Distance by Elytra', 'd'],
        ['horse_one_cm', 'Distance by Horse', 'd'], ['minecart_one_cm', 'Distance by Minecart', 'd'], ['pig_one_cm', 'Distance by Pig', 'd'], ['strider_one_cm', 'Distance by Strider', 'd'],
        ['climb_one_cm', 'Distance Climbed', 'd'], ['crouch_one_cm', 'Distance Crouched', 'd'], ['fall_one_cm', 'Distance Fallen', 'd'], ['fly_one_cm', 'Distance Flown', 'd'],
        ['sprint_one_cm', 'Distance Sprinted', 'd'], ['swim_one_cm', 'Distance Swum', 'd'], ['walk_one_cm', 'Distance Walked', 'd'], ['walk_on_water_one_cm', 'Distance Walked on Water', 'd'],
        ['walk_under_water_one_cm', 'Distance Walked under Water', 'd'], ['inspect_dropper', 'Droppers Searched'], ['open_enderchest', 'Ender Chests Opened'], ['fish_caught', 'Fish Caught'],
        ['leave_game', 'Games Quit'], ['inspect_hopper', 'Hoppers Searched'], ['interact_with_anvil', 'Interactions with Anvil'], ['interact_with_beacon', 'Interactions with Beacon'],
        ['interact_with_blast_furnace', 'Interactions with Blast Furnace'], ['interact_with_brewingstand', 'Interactions with Brewing Stand'], ['interact_with_campfire', 'Interactions with Campfire'],
        ['interact_with_cartography_table', 'Interactions with Cartography Table'], ['interact_with_crafting_table', 'Interactions with Crafting Table'], ['interact_with_furnace', 'Interactions with Furnace'],
        ['interact_with_grindstone', 'Interactions with Grindstone'], ['interact_with_lectern', 'Interactions with Lectern'], ['interact_with_loom', 'Interactions with Loom'],
        ['interact_with_smithing_table', 'Interactions with Smithing Table'], ['interact_with_smoker', 'Interactions with Smoker'], ['interact_with_stonecutter', 'Interactions with Stonecutter'],
        ['drop', 'Items Dropped'], ['enchant_item', 'Items Enchanted'], ['jump', 'Jumps'], ['mob_kills', 'Mob Kills'], ['play_record', 'Music Discs Played'], ['play_noteblock', 'Note Blocks Played'],
        ['tune_noteblock', 'Note Blocks Tuned'], ['deaths', 'Number of Deaths'], ['pot_flower', 'Plants Potted'], ['player_kills', 'Player Kills'], ['raid_trigger', 'Raids Triggered'],
        ['raid_win', 'Raids Won'], ['clean_shulker_box', 'Shulker Boxes Cleaned'], ['open_shulker_box', 'Shulker Boxes Opened'], ['sneak_time', 'Sneak Time', 'time'],
        ['talked_to_villager', 'Talked to Villagers'], ['target_hit', 'Targets Hit'], ['play_time', 'Time Played', 'time'], ['time_since_death', 'Time Since Last Death', 'time'],
        ['time_since_rest', 'Time Since Last Rest', 'time'], ['sleep_in_bed', 'Times Slept in a Bed'], ['total_world_time', 'Total World Time', 'time'],
        ['traded_with_villager', 'Traded with Villagers'], ['trigger_trapped_chest', 'Trapped Chests Triggered'], ['use_cauldron', 'Water Taken from Cauldron']
    ];
    // StatFormatter: two decimals always; distance steps cm to m to km past a half, time s to min to h to d to y
    function statDec(v) { return (Math.round(v * 100) / 100).toFixed(2); }
    function statFmt(v, kind) {
        v = Math.floor(v);
        if (kind === 'd') { var m = v / 100, km = m / 1000; return km > 0.5 ? statDec(km) + ' km' : m > 0.5 ? statDec(m) + ' m' : v + ' cm'; }
        if (kind === 'time') {
            var s = v / 20, mi = s / 60, h = mi / 60, d = h / 24, y = d / 365;
            return y > 0.5 ? statDec(y) + ' y' : d > 0.5 ? statDec(d) + ' d' : h > 0.5 ? statDec(h) + ' h' : mi > 0.5 ? statDec(mi) + ' min' : statDec(s) + ' s';
        }
        if (kind === 't') return statDec(v * 0.1);
        return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    /* StatsScreen: "Statistics" in the 33-pixel header, the list between it and
       a 58-pixel footer on the in-world list background with its separators,
       General, Items and Mobs (120 wide, 5 apart) over Done. General rows are
       14 tall, the name on the left and the value on the right, white and grey
       by turns; Items rows 20 tall with six columns 40 apart from 75; Mobs rows
       36 tall with what you did to each and what it did to you. */
    var STAT_COLS = [['m', 'Times Mined', 'st_mined'], ['b', 'Times Broken', 'st_broken'], ['cr', 'Times Crafted', 'st_crafted'],
        ['u', 'Times Used', 'st_used'], ['p', 'Times Picked Up', 'st_picked'], ['d', 'Times Dropped', 'st_dropped']];
    function statRows(tab) {
        if (tab === 'general') return STAT_CUSTOM.map(function (r) { return { t: r[1], v: statFmt(statGet('c', r[0]), r[2]) }; });
        var st = S.stats || {}, ids = {}, k;
        if (tab === 'items') {
            STAT_COLS.forEach(function (c) { for (k in (st[c[0]] || {})) if (I[k]) ids[k] = 1; });
            return Object.keys(ids).sort(function (a, b) { return I[a].t < I[b].t ? -1 : 1; }).map(function (id) { return { id: id }; });
        }
        for (k in (st.k || {})) ids[k] = 1;
        for (k in (st.kb || {})) ids[k] = 1;
        return Object.keys(ids).sort().map(function (m) { return { m: m }; });
    }
    function statsBody(W, H, iw) {
        var tab = iw.d.tab || 'general', rows = statRows(tab), top = 33, bot = H - 58, lh = bot - top;
        var rh = tab === 'general' ? 14 : tab === 'items' ? 20 : 36, rw = tab === 'items' ? 280 : 220, left = (W >> 1) - (rw >> 1) + 2;
        var head = tab === 'items' ? 20 : 0, total = rows.length * rh + head + 4, max = Math.max(0, total - lh);
        var sc = iw.d.scroll = Math.max(0, Math.min(max, iw.d.scroll || 0)), html = '';
        if (tab === 'items') STAT_COLS.forEach(function (c, i) {
            html += '<i class="mc-sthead" data-tip="' + c[1] + '" style="' + iwAt(left + 75 + 40 * i - 18, top + 5 - sc, 18, 18) + ';background-image:var(--spr-' + c[2] + ')"></i>';
        });
        rows.forEach(function (r, i) {
            var y = top + 4 - sc + head + i * rh, col = i % 2 === 0 ? '#ffffff' : (tab === 'general' ? '#bababa' : '#909090');
            if (y + rh < top || y > bot) return;
            if (tab === 'general') {
                var ty = y + (rh >> 1) - 4;
                html += iwText(r.t, left + 2, ty, col) + iwText(r.v, left + rw - 8 - (mfWidth(r.v) + 1), ty, col);
            } else if (tab === 'items') {
                html += '<i class="mc-stslot" style="' + iwAt(left, y, 18, 18) + '"><b style="background-image:url(' + iconURL(r.id) + ')"></b></i>';
                STAT_COLS.forEach(function (c, ci) {
                    var n = statGet(c[0], r.id), s = n ? statFmt(n) : '-';
                    html += iwText(s, left + 75 + 40 * ci - (mfWidth(s) + 1), y + 5, col);
                });
            } else {
                var nm = r.m.charAt(0).toUpperCase() + r.m.slice(1), kl = statGet('k', r.m), kb = statGet('kb', r.m);
                html += iwText(nm, left + 2, y + 1, '#ffffff') +
                    iwText(kl ? 'You killed ' + kl + ' ' + nm : 'You have never killed ' + nm, left + 12, y + 10, kl ? '#909090' : '#606060') +
                    iwText(kb ? nm + ' killed you ' + kb + ' time(s)' : 'You have never been killed by ' + nm, left + 12, y + 19, kb ? '#909090' : '#606060');
            }
        });
        if (max > 0) {   // the scroller: 6 wide at the list's right, as tall as the view is of the content
            var sx = left + rw + 4, th = Math.max(32, Math.min(lh - 8, Math.floor(lh * lh / total))), ty2 = top + Math.floor((lh - th) * sc / max);
            html += '<i class="mc-stbar" style="' + iwAt(sx, top, 6, lh) + '"></i><i class="mc-stthumb" style="' + iwAt(sx, ty2, 6, th) + '"></i>';
        }
        return html;
    }
    IW_SCR.stats = {
        host: 'pause', layer: 'mc-stats',
        html: function (W, H, iw) {
            var cx = W >> 1, noItems = !statRows('items').length, noMobs = !statRows('mobs').length;
            return '<i class="mc-stlist" style="' + iwAt(0, 33, W, H - 91) + '"></i><i class="mc-sep top" style="' + iwAt(0, 31, W, 2) + '"></i>' +
                '<i class="mc-sep bot" style="' + iwAt(0, H - 58, W, 2) + '"></i>' +
                '<div class="mc-stclip" style="' + iwAt(0, 33, W, H - 91) + '"><div class="mc-stbody" style="top:calc(var(--px) * -33)">' + statsBody(W, H, iw) + '</div></div>' +
                iwCenter('Statistics', W, 12) +
                iwBtn('mc-stgen', 'general', cx - 185, H - 52, 120, 'General') + iwBtn('mc-stitems', 'items', cx - 60, H - 52, 120, 'Items', noItems) +
                iwBtn('mc-stmobs', 'mobs', cx + 65, H - 52, 120, 'Mobs', noMobs) + iwBtn('mc-stdone', 'done', cx - 100, H - 27, 200, 'Done');
        },
        wire: function (layer, iw) {
            var clip = layer.querySelector('.mc-stclip');
            clip.addEventListener('wheel', function (e) {
                iw.d.scroll = (iw.d.scroll || 0) + (e.deltaY > 0 ? 1 : -1) * (iw.d.tab === 'mobs' ? 18 : 10);
                IW_SCR.stats.redraw(layer, iw); e.preventDefault();
            }, { passive: false });
        },
        redraw: function (layer, iw) { var b = layer && layer.querySelector('.mc-stbody'); if (b) b.innerHTML = statsBody(RT.gw, RT.gh, iw); },
        act: function (a) {
            if (a === 'done') { IW_SCR.stats.esc(); return; }
            RT.iw.d.tab = a; RT.iw.d.scroll = 0;
            IW_SCR.stats.redraw(RT.el.querySelector('.mc-pause .mc-stats'), RT.iw);
        },
        esc: function () { iwShow('pause'); }
    };
    /* the Game Menu's Options... is the title screen's options tree, drawn over
       the paused world instead of the panorama */
    function iwOptions() {
        var host = RT.el.querySelector('.mc-pause');
        if (host) host.style.display = 'none';
        RT.iw = null;
        mnOpen('options', false, true);
    }
    /* Player.sleepCounter and Gui's sleep overlay: the counter climbs a tick at a
       time to 100 (five seconds) while the screen fades to 0x101020 at alpha
       220; at 100 the night is skipped and the player wakes, the counter runs on
       to 110 and the overlay fades back out over that half second. */
    function sleepTick(dt) {
        if (!RT.sleep) return;
        RT.sleep += dt;
        var ov = RT.el.querySelector('.mc-sleepov');
        ov.style.display = '';
        var c = Math.min(100, RT.sleep * 20);
        if (!RT.woke && RT.sleep >= 5) { S.t = DAY_MS * 0.02; RT.woke = RT.sleep; bedLayout(); }   // sunrise
        if (RT.woke) c = 100 + (RT.sleep - RT.woke) * 20;
        var a = c <= 100 ? 220 * c / 100 : 220 * (1 - (c - 100) / 10);
        ov.style.opacity = Math.max(0, a / 255).toFixed(3);
        if (c >= 110) { RT.sleep = 0; RT.woke = 0; ov.style.display = 'none'; }
    }

    /* ── F3 ─────────────────────────────────────────────────── */
    /* F3, laid out the way DebugScreenOverlay lays it out: a column down each
       side from two pixels in, nine to a line, every line on its own grey
       backdrop (0x90505050) a pixel wider than the text all round, the text in
       0xE0E0E0 with no shadow, and the right column right-aligned. Blank lines
       carry no backdrop. The numbers are this engine's own. */
    var DBG_DIR = [['south', 'positive Z'], ['west', 'negative X'], ['north', 'negative Z'], ['east', 'positive X']];
    function pad2(n) { n = Math.abs(n); return (n < 10 ? '0' : '') + n; }
    /* F3 as 1.21.9 and later draw it by default: the entries of the default
       profile only (no light levels, no biome, no targeted block; those are for
       F3 + F6), fps and the version heading the two columns, then the memory,
       position and system groups. Rendered the way DebugScreenOverlay renders
       every line: two pixels in, nine apart, each on its own 0x90505050 backdrop
       a pixel wider than the text, 0xE0E0E0 and no shadow. */
    function dbgLines() {
        var bx = Math.floor(S.px), by = Math.floor(S.py), bz = Math.floor(S.pz), cx = bx >> 4, cy = by >> 4, cz = bz >> 4;
        var yawD = ((S.yaw * 180 / Math.PI) % 360 + 540) % 360 - 180, pitD = S.pitch * 180 / Math.PI;
        var dir = DBG_DIR[((Math.round(S.yaw / (Math.PI / 2)) % 4) + 4) % 4];
        var o = optLoad(), mem = performance && performance.memory, cores = navigator.hardwareConcurrency || 4;
        var used = mem ? Math.round(mem.usedJSHeapSize / 1048576) : 256, tot = mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : 2048;
        var alloc = ('00' + Math.max(1, Math.round((RT.parts.length + RT.foes.length) / 8))).slice(-3);
        var gpu = RT.dbgGpu || ['WebGL', 'WebGL'], dpr = window.devicePixelRatio || 1;
        var L = [
            RT.fps + ' fps T: ' + (o.vsync ? '60 (fifo)' : 'inf (immediate)') + ' @60Hz',
            '',
            (o.clouds ? (o.fancy ? 'fancy-clouds ' : 'fast-clouds ') : '') + 'B: 2',
            'Filtering: RGSS',
            '',
            'Mem: ' + Math.round(used / tot * 100) + '% ' + used + '/' + tot + 'MiB',
            'Allocation rate: ' + alloc + 'MiB/s',
            'Allocated: ' + Math.round(used / tot * 100) + '% ' + used + 'MiB',
            '',
            'XYZ: ' + S.px.toFixed(3) + ' / ' + S.py.toFixed(5) + ' / ' + S.pz.toFixed(3),
            'Block: ' + bx + ' ' + by + ' ' + bz,
            'Chunk: ' + cx + ' ' + cy + ' ' + cz + ' [' + (cx & 31) + ' ' + (cz & 31) + ' in r.' + (cx >> 5) + '.' + (cz >> 5) + '.mca]',
            'Facing: ' + dir[0] + ' (Towards ' + dir[1] + ') (' + yawD.toFixed(1) + ' / ' + pitD.toFixed(1) + ')',
            'minecraft:overworld FC: 0',
            'Section-relative: ' + pad2(bx & 15) + ' ' + pad2(by & 15) + ' ' + pad2(bz & 15),
            '',
            '',
            'Debug charts: [F3+1] Profiler hidden; [F3+2] fps + tps hidden;',
            '[F3+3] Ping hidden; [F3+4] Lightmap hidden',
            'To edit: press [F3+F6]'
        ];
        var R = [
            'Minecraft ' + RT.ver + ' (' + RT.ver + '/vanilla)',
            '',
            'Terrain Rendering: naive',
            'Integrated server @ ' + (1000 / Math.max(1, RT.fps)).toFixed(1) + '/50.0 ms, 0 tx, 0 rx',
            '',
            'Java: 21.0.7',
            'CPU: ' + cores + 'x ' + (navigator.platform || 'CPU'),
            'Display: ' + screen.width + 'x' + screen.height + ' (' + gpu[0] + ')',
            'Window: ' + RT.el.clientWidth + 'x' + RT.el.clientHeight + ' (' + dpr.toFixed(2) + 'x pixel density)',
            gpu[1] + ' (dGPU)',
            'WebGL ' + (RT.G && RT.G.gl && RT.G.gl.getParameter ? RT.G.gl.getParameter(RT.G.gl.VERSION) : '1.0'),
            ''
        ];
        return { L: L, R: R };
    }
    var BLOCK_KEY = null;
    function blockKey(id) {   // the item that places a block names it: "Grass Block" → grass_block
        if (!BLOCK_KEY) {
            BLOCK_KEY = {};
            for (var k in I) if (I[k].place != null && BLOCK_KEY[I[k].place] == null) BLOCK_KEY[I[k].place] = String(I[k].t || k).toLowerCase().replace(/[^a-z0-9]+/g, '_');
        }
        return BLOCK_KEY[id] || 'block_' + id;
    }
    function paintDebug() {
        var d = RT.el.querySelector('.mc-debug');
        if (!RT.f3) { d.style.display = 'none'; return; }
        d.style.display = '';
        if (!RT.dbgGpu && RT.G && RT.G.gl) {   // the renderer's own name, where the browser will say
            try {
                var ext = RT.G.gl.getExtension('WEBGL_debug_renderer_info');
                RT.dbgGpu = ext ? [RT.G.gl.getParameter(ext.UNMASKED_VENDOR_WEBGL), RT.G.gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)] : [RT.G.gl.getParameter(RT.G.gl.VENDOR), RT.G.gl.getParameter(RT.G.gl.RENDERER)];
                // the game names the card, not the browser's translation layer: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x…) Direct3D11 …)" → the middle
                var ang = /^ANGLE \(([^,]+),\s*(.+?)(?:\s*\(0x[0-9a-f]+\))?(?:\s+Direct3D.*|,\s*[^,]*)?\)$/i.exec(RT.dbgGpu[1] || '');
                if (ang) RT.dbgGpu = [ang[1].replace(/^Google$/, 'Google Inc.'), ang[2]];
            } catch (e) { RT.dbgGpu = ['WebGL', 'WebGL']; }
        }
        var ln = dbgLines(), all = [], s;
        ln.L.forEach(function (t, i) { all.push([t, 0, i]); });
        ln.R.forEach(function (t, i) { all.push([t, 1, i]); });
        var kids = hudIcons(d, all.length);
        for (var i = 0; i < all.length; i++) {
            var e = kids[i], txt = all[i][0];
            if (!e.firstChild) e.innerHTML = '<span class="mt ns"></span>';
            e.className = txt ? 'mc-dl' : 'mc-dl blank';
            mtSet(e.firstChild, txt, '#e0e0e0');
            var w = txt ? mfWidth(txt) + 1 : 0;
            hudPlace(e, (all[i][1] ? RT.gw - 2 - w : 2) - 1, 2 + all[i][2] * 9 - 1);
            e.style.width = 'calc(var(--px) * ' + (w + 2) + ')';
        }
    }

    /* ── tile entities: furnaces + chests ───────────────────── */
    function tentKey(x, y, z) { return x + ',' + y + ',' + z; }
    function tentInit(x, y, z, kind) {
        S.tents[tentKey(x, y, z)] = kind === 'furnace'
            ? { k: 'furnace', fin: null, fuel: null, out: null, burn: 0, burnMax: 0, prog: 0 }
            : kind === 'cake' ? { k: 'cake', bites: 0 }
            : { k: 'chest', inv: new Array(27).fill(null) };
    }
    function tentAt(x, y, z, kind) {
        var k = tentKey(x, y, z);
        if (!S.tents[k]) tentInit(x, y, z, kind);
        return S.tents[k];
    }
    function tentBreak(x, y, z) {
        var k = tentKey(x, y, z), t = S.tents[k];
        if (!t) return;
        var all = t.k === 'chest' ? t.inv : t.k === 'furnace' ? [t.fin, t.fuel, t.out] : [];
        for (var i = 0; i < all.length; i++) if (all[i]) dropItem(x + 0.5, y + 0.5, z + 0.5, all[i].id, all[i].c, all[i].dur, false, all[i].ench, all[i].name);
        delete S.tents[k];
        if (RT && RT.panel && RT.panel.key === k) closePanel();
    }
    function furnaceTick(dt) {
        for (var k in S.tents) {
            var t = S.tents[k];
            if (t.k !== 'furnace') continue;
            var pos = k.split(',');
            var x = pos[0] | 0, y = pos[1] | 0, z = pos[2] | 0;
            if (!chunkAt(x, z)) continue;   // unloaded furnaces wait patiently
            var cookable = t.fin && SMELTS[t.fin.id] && (!t.out || (t.out.id === SMELTS[t.fin.id] && t.out.c < stkMax(t.out.id)));
            var slotsMoved = false;   // did anything a SLOT shows actually change?
            if (t.burn > 0) t.burn -= dt;
            if (t.burn <= 0 && cookable && t.fuel && I[t.fuel.id] && I[t.fuel.id].fuel) {
                t.burnMax = t.burn = I[t.fuel.id].fuel;
                t.fuel.c--; if (!t.fuel.c) t.fuel = null;
                slotsMoved = true;
            }
            if (t.burn > 0 && cookable) {
                t.prog += dt;
                if (t.prog >= SMELT_S) {
                    t.prog = 0;
                    var outId = SMELTS[t.fin.id];
                    if (t.out) t.out.c++; else t.out = { id: outId, c: 1 };
                    t.fin.c--; if (!t.fin.c) t.fin = null;
                    slotsMoved = true;
                }
            } else if (t.prog > 0) t.prog = Math.max(0, t.prog - dt * 2);
            var want = t.burn > 0 ? FURN_LIT : FURN;
            if (getB(x, y, z) !== want && (getB(x, y, z) === FURN || getB(x, y, z) === FURN_LIT)) setB(x, y, z, want);
            if (RT.panel && RT.panel.key === k) {
                paintFurnaceBits(t);
                // paintFurnaceBits only moves the flame and the arrow; the SLOTS
                // need the panel repaint (see RT.panelDirty in frame)
                if (slotsMoved) RT.panelDirty = 1;
            }
        }
    }

    /* ── recipe matching ────────────────────────────────────── */
    function gridCrop(grid, w) {
        var x0 = 9, x1 = -1, y0 = 9, y1 = -1, x, y;
        for (y = 0; y < w; y++) for (x = 0; x < w; x++) if (grid[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 < 0) return null;
        var rows = [];
        for (y = y0; y <= y1; y++) { var r = []; for (x = x0; x <= x1; x++) { var s = grid[y * w + x]; r.push(s ? s.id : ''); } rows.push(r); }
        return rows;
    }
    function shapeEq(a, b) {
        if (a.length !== b.length || a[0].length !== b[0].length) return false;
        for (var y = 0; y < a.length; y++) for (var x = 0; x < a[0].length; x++) if ((a[y][x] || '') !== (b[y][x] || '')) return false;
        return true;
    }
    function mirrorShape(sh) {
        var out = [];
        for (var y = 0; y < sh.length; y++) out.push(sh[y].slice().reverse());
        return out;
    }
    function matchRecipe(grid, w) {
        var rows = gridCrop(grid, w);
        if (!rows) return null;
        var i, ids = [];
        for (i = 0; i < grid.length; i++) if (grid[i]) ids.push(grid[i].id);
        for (i = 0; i < RECIPES.length; i++) {
            var r = RECIPES[i];
            if (r.less) {
                if (ids.length !== r.less.length) continue;
                var pool = ids.slice(), ok = true;
                for (var j = 0; j < r.less.length; j++) { var at = pool.indexOf(r.less[j]); if (at < 0) { ok = false; break; } pool.splice(at, 1); }
                if (ok) return r;
                continue;
            }
            if (r.shape.length > w || r.shape[0].length > w) continue;
            if (shapeEq(rows, r.shape) || shapeEq(rows, mirrorShape(r.shape))) return r;
        }
        return null;
    }
    function craftHooks(id) {
        if (id === 'table') unlock('table');
        if (id === 'furnace') unlock('furnace');
        if (id === 'bread') unlock('bread');
        if (id === 'wood_pick') unlock('pick');
        var tl = I[id] && I[id].tool;
        if (tl) {
            if (tl.k === 'pick' && tl.tier >= 2) unlock('upgrade');
            if (tl.k === 'sword') unlock('sword');
            if (tl.k !== 'sword') {
                S.tk = S.tk || {};
                S.tk[tl.k] = 1;
                if (S.tk.pick && S.tk.axe && S.tk.shovel && S.tk.hoe) unlock('moar');
            }
        }
    }

    /* ── enchanting & anvil ─────────────────────────────────── */
    var ENCH_NAME = { eff: 'Efficiency', unbreaking: 'Unbreaking', fortune: 'Fortune', silk: 'Silk Touch',
        sharp: 'Sharpness', knock: 'Knockback', fire: 'Fire Aspect', looting: 'Looting',
        power: 'Power', punch: 'Punch', flame: 'Flame', infinity: 'Infinity',
        protection: 'Protection', feather: 'Feather Falling' };
    var ENCH_MAX = { eff: 5, unbreaking: 3, fortune: 3, silk: 1, sharp: 5, knock: 2, fire: 2, looting: 3, power: 5, punch: 2, flame: 1, infinity: 1, protection: 4, feather: 4 };
    var ENCH_POOL = {
        tool: ['eff', 'unbreaking', 'fortune', 'silk'],
        sword: ['sharp', 'knock', 'fire', 'looting', 'unbreaking'],
        bow: ['power', 'punch', 'flame', 'infinity', 'unbreaking'],
        armor: ['protection', 'unbreaking', 'feather'],
        book: ['eff', 'unbreaking', 'fortune', 'sharp', 'looting', 'protection', 'power', 'fire']
    };
    var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
    function enchCategory(st) {
        if (!st) return null;
        if (st.id === 'book' || st.id === 'ench_book') return 'book';
        var def = I[st.id]; if (!def) return null;
        if (def.armor) return 'armor';
        if (st.id === 'bow') return 'bow';
        if (def.tool) return def.tool.k === 'sword' ? 'sword' : def.tool.k === 'hoe' ? 'tool' : 'tool';
        return null;
    }
    function enchantable(st) { return !!enchCategory(st) && (st.c === 1) && !(st.ench && Object.keys(st.ench).length); }
    // rnd defaults to Math.random, but the enchanting table passes its SEEDED rng: the offered
    // enchantments have to stay put while the item sits on the table. Rolling them with
    // Math.random() let you pull the item out and drop it back to reroll until Silk Touch or
    // Fortune III came up at option-1 prices.
    function rollEnchants(st, level, rnd) {
        rnd = rnd || Math.random;
        var cat = enchCategory(st); if (!cat) return null;
        var pool = ENCH_POOL[cat].slice(), res = {}, count = 0;
        while (pool.length && count < 3) {
            var e = pool.splice((rnd() * pool.length) | 0, 1)[0];
            var maxL = ENCH_MAX[e];
            var lvl = Math.max(1, Math.min(maxL, Math.round(level / 30 * maxL * (0.5 + rnd() * 0.5))));
            res[e] = lvl; count++;
            if (e === 'silk') pool = pool.filter(function (x) { return x !== 'fortune'; });
            if (e === 'fortune') pool = pool.filter(function (x) { return x !== 'silk'; });
            if (rnd() > 0.35 + level / 45) break;   // higher levels → more enchants
        }
        return res;
    }
    function bookshelvesNear(t) {
        if (!t) return 0; var n = 0;
        for (var dx = -2; dx <= 2; dx++) for (var dz = -2; dz <= 2; dz++) {
            if (Math.abs(dx) < 2 && Math.abs(dz) < 2) continue;   // outer ring only, like the real table
            for (var dy = 0; dy <= 1; dy++) if (getB(t.x + dx, t.y + dy, t.z + dz) === BOOKSHELF) n++;
        }
        return Math.min(15, n);
    }
    function genEnchOptions() {
        RT.enchOpts = null;
        var it = RT.enchItem;
        if (!enchantable(it)) return;
        var pos = RT.panel.key ? RT.panel.key.split(',') : null;
        var shelves = pos ? bookshelvesNear({ x: pos[0] | 0, y: pos[1] | 0, z: pos[2] | 0 }) : 0;
        if (!RT.enchSeed) RT.enchSeed = (Math.random() * 1e9) | 0;
        var rng = mulb(RT.enchSeed ^ (it.id.length * 7));
        /* EnchantmentHelper.getEnchantmentCost, rolled afresh for each row:
           j = 1 + rand(8) + shelves/2 + rand(shelves + 1), then j/3 (at least 1),
           2j/3 + 1 and max(j, 2 x shelves); a row cheaper than its number is empty */
        function cost(n) {
            var j = 1 + (rng() * 8 | 0) + (shelves >> 1) + (rng() * (shelves + 1) | 0);
            return n === 0 ? Math.max((j / 3) | 0, 1) : n === 1 ? ((j * 2 / 3) | 0) + 1 : Math.max(j, shelves * 2);
        }
        var lv = [cost(0), cost(1), cost(2)];
        RT.enchOpts = [];
        for (var i = 0; i < 3; i++) {
            if (lv[i] < i + 1) { RT.enchOpts.push({ level: 0, lapis: i + 1, ench: null, label: '' }); continue; }
            var er = rollEnchants(it, lv[i], rng);
            var main = er ? Object.keys(er)[0] : null;
            RT.enchOpts.push({ level: lv[i], lapis: i + 1, ench: er, label: main ? ENCH_NAME[main] + ' ' + (ROMAN[er[main]] || er[main]) + (Object.keys(er).length > 1 ? ' …' : '') : '—' });
        }
    }
    function applyEnchOption(i) {
        var o = RT.enchOpts && RT.enchOpts[i]; if (!o || !o.ench) return;
        var it = RT.enchItem, lap = RT.enchLapis;
        if (!enchantable(it)) return;
        // an option you cannot afford is a dead button, not a message; creative pays nothing
        if (!instaBuild()) {
            if (S.xpl < o.level) return;
            if (!lap || lap.c < o.lapis) return;
            if (S.xpl < o.lapis) return;   // the slot number is the real level charge
            takeXpLevels(o.lapis);                       // enchanting costs levels
            lap.c -= o.lapis; if (!lap.c) RT.enchLapis = null;
        }
        if (it.id === 'book') it.id = 'ench_book';
        it.ench = o.ench;
        RT.enchSeed = (Math.random() * 1e9) | 0; RT.enchOpts = null;
        snd('enchant'); unlock('enchant'); stat('c', 'enchant_item');
        paintPanel();
    }
    function enchCostStr(e) { var s = []; for (var k in e) s.push(ENCH_NAME[k] + ' ' + (ROMAN[e[k]] || e[k])); return s.join(', '); }
    function anvilResult() {   // {out, cost} or null
        var a = RT.anvilA, b = RT.anvilB;
        if (!a) return null;
        // carry the existing name forward, or a repair with the name box left empty
        // silently threw away the rename you had already paid a level for
        var out = { id: a.id, c: a.c, dur: a.dur, ench: a.ench ? JSON.parse(JSON.stringify(a.ench)) : null, name: a.name };
        var cost = 0, did = false, usedB = false;
        /* AnvilMenu.createResult: a name that differs from what the item is called
           renames it, and a box cleared on a renamed item takes the name off; each
           costs a level */
        var nm = RT.anvilName || '';
        if (nm.trim()) { if (nm !== itemName(a)) { out.name = nm; cost += 1; did = true; } }
        else if (a.name) { delete out.name; cost += 1; did = true; }
        if (b) {
            var da = I[a.id], db = I[b.id];
            // repair with matching material or a second identical tool
            if (da && (da.tool || da.armor || da.dur != null) && a.dur != null) {
                if (b.id === a.id && b.dur != null) {   // combine two of the same: repair + merge enchants
                    var maxd = da.tool ? da.tool.dur : da.armor ? da.armor.dur : da.dur;
                    out.dur = Math.min(maxd, a.dur + b.dur + Math.floor(maxd * 0.12));
                    out.ench = mergeEnch(a.ench, b.ench); cost += 2; did = true; usedB = true;
                } else if (b.id === 'ench_book' && b.ench) {   // apply an enchanted book
                    out.ench = mergeEnch(a.ench, b.ench); cost += 2; did = true; usedB = true;
                }
            }
        }
        if (!did) return null;
        cost += enchLevelCost(out.ench) - enchLevelCost(a.ench);
        // usedB tells applyAnvil whether slot B was actually consumed — a rename-only result
        // must leave B alone instead of deleting whatever is sitting in it
        cost = Math.max(1, cost);
        return { out: out, cost: cost, usedB: usedB, tooExp: cost >= 40 && !instaBuild() };   // from 40 levels, "Too Expensive!" and no result
    }
    function mergeEnch(x, y) {
        var r = {}; var k;
        if (x) for (k in x) r[k] = x[k];
        if (y) for (k in y) r[k] = r[k] ? Math.min(ENCH_MAX[k], Math.max(r[k], y[k]) + (r[k] === y[k] ? 1 : 0)) : y[k];
        // resolve conflicts: silk vs fortune
        if (r.silk && r.fortune) delete r.fortune;
        return Object.keys(r).length ? r : null;
    }
    function enchLevelCost(e) { var c = 0; if (e) for (var k in e) c += e[k]; return c; }
    function applyAnvil(shift) {
        var res = anvilResult(); if (!res || res.tooExp) return;
        if (!shift && RT.cur) return;   // a click takes the result onto an empty cursor only
        if (!instaBuild() && S.xpl < res.cost) return;
        if (!instaBuild()) takeXpLevels(res.cost);
        var out = res.out;
        RT.anvilA = null; RT.anvilKey = null;
        if (res.usedB) RT.anvilB = null;   // a rename-only apply must not eat slot B
        RT.anvilName = '';
        // clear the visible name box too, or it keeps showing the old text while RT.anvilName is
        // empty and the next rename silently produces nothing until the player retypes
        var nameIn = RT.el && RT.el.querySelector('.mc-anvin');
        if (nameIn) nameIn.value = '';
        if (shift) {   // shift-click: backwards into the inventory, the hotbar's right-hand end first, enchant and name intact
            var left = moveStackTo(out, invOrder(0, 36), true);
            if (left > 0) dropItem(S.px, S.py + 1, S.pz, out.id, left, out.dur, false, out.ench, out.name);
        } else RT.cur = out;   // a plain click puts the result on the cursor
        snd('anvil'); unlock('anvil2');
        paintPanel(); paintHotbar();
    }

    /* ═══════════════ the creative inventory ═══════════════
       The real screen: a tab strip, a scrolling grid of every item in the
       game, a search tab, your hotbar along the bottom, and a survival tab
       carrying the 2×2 grid, the armour column and a bin. The grid is a
       CATALOGUE, not a container — taking from it costs nothing and anything
       dropped onto it is destroyed, which is exactly how the real one behaves
       and is why it can't reuse the ordinary slot plumbing. */
    var CCOLS = 9, CROWS = 5, CGRID = CCOLS * CROWS;
    /* The tabs the game has had since 1.19.3, each where CreativeModeTabs puts
       it: row 0 above the panel, row 1 below, columns 0-4 from the left at 27
       pixels a column and 5-6 flush right. Search stays 7 and Survival
       Inventory 8 so the old indices still land where they used to. */
    var CTABS = [
        { id: 'build',    t: 'Building Blocks',    ic: 'bricks',        row: 0, col: 0 },
        { id: 'color',    t: 'Colored Blocks',     ic: 'wool',          row: 0, col: 1 },
        { id: 'natural',  t: 'Natural Blocks',     ic: 'grass_block',   row: 0, col: 2 },
        { id: 'func',     t: 'Functional Blocks',  ic: 'oak_sign',      row: 0, col: 3 },
        { id: 'redstone', t: 'Redstone Blocks',    ic: 'redstone',      row: 0, col: 4 },
        { id: 'tools',    t: 'Tools & Utilities',  ic: 'diamond_pick',  row: 1, col: 0 },
        { id: 'combat',   t: 'Combat',             ic: 'diamond_sword', row: 1, col: 1 },
        { id: 'search',   t: 'Search Items',       ic: 'compass',       row: 0, col: 6 },
        { id: 'inv',      t: 'Survival Inventory', ic: 'chest',         row: 1, col: 6 },
        { id: 'food',     t: 'Food & Drinks',      ic: 'golden_apple',  row: 1, col: 2 },
        { id: 'ingr',     t: 'Ingredients',        ic: 'iron',          row: 1, col: 3 },
        { id: 'eggs',     t: 'Spawn Eggs',         ic: 'egg_pig',       row: 1, col: 4 },
        { id: 'hotbar',   t: 'Saved Hotbars',      ic: 'bookshelf',     row: 0, col: 5 }
    ];
    var CLIST = null;
    function creativeTables() {
        if (CLIST) return CLIST;
        var i, k, tools = [], combat = [];
        // each tier's shovel, pickaxe, axe and hoe together, wood to diamond, as the real tab lists them
        for (i = 1; i <= 5; i++) for (k = 0; k < 4; k++) tools.push(TIER_N[i] + '_' + ['shovel', 'pick', 'axe', 'hoe'][k]);
        tools.push('bucket', 'water_bucket', 'lava_bucket', 'milk_bucket', 'flint_steel', 'bonemeal', 'ender_pearl');
        for (i = 1; i <= 5; i++) combat.push(TIER_N[i] + '_sword');
        for (i = 1; i <= 5; i++) combat.push(TIER_N[i] + '_axe');
        for (i = 0; i < ARM_TIERS.length; i++) for (k = 0; k < 4; k++) combat.push(ARM_TIERS[i] + '_' + ['helm', 'chest', 'legs', 'boots'][k]);
        combat.push('egg', 'bow', 'arrow');
        CLIST = {
            build: ['log', 'planks', 'stone', 'cobble', 'stonebrick', 'bricks', 'sandstone'],
            color: ['wool', 'glass', 'bed'],
            natural: ['grass_block', 'grass_snow', 'dirt', 'clay', 'gravel', 'sand', 'sandstone', 'stone', 'obsidian',
                      'ore_coal', 'ore_iron', 'ore_gold', 'ore_redstone', 'ore_emerald', 'ore_lapis', 'ore_diamond',
                      'log', 'leaves', 'tallgrass', 'dandelion', 'poppy', 'mushroom', 'mushroom_r', 'sugarcane', 'cactus',
                      'seeds', 'seeds_pumpkin', 'seeds_melon', 'pumpkin', 'melon', 'bedrock'],
            func: ['torch', 'table', 'furnace', 'anvil', 'etable', 'ladder', 'bookshelf', 'chest', 'bed'],
            redstone: ['redstone', 'rlamp', 'tnt'],
            tools: tools,
            combat: combat,
            food: ['apple', 'golden_apple', 'melon_slice', 'carrot', 'golden_carrot', 'potato', 'baked_potato',
                   'beef_raw', 'beef', 'pork_raw', 'pork', 'mutton_raw', 'mutton', 'chicken_raw', 'chicken',
                   'bread', 'cookie', 'cake', 'pumpkin_pie', 'flesh', 'mushroom_stew', 'milk_bucket'],
            ingr: ['coal', 'charcoal', 'emerald', 'lapis', 'diamond', 'iron', 'gold', 'stick', 'flint', 'wheat', 'bone', 'bonemeal',
                   'string', 'feather', 'egg', 'leather', 'ink_sac', 'slimeball', 'clay_ball', 'ender_pearl', 'bowl', 'brick',
                   'paper', 'book', 'redstone', 'gunpowder', 'sugar', 'golden_carrot', 'ench_book'],
            // spawn eggs in alphabetical order, as the game sorts them
            eggs: Object.keys(EGG_COL).sort().map(function (m) { return 'egg_' + m; })
        };
        // a rename anywhere in I{} must leave a shorter list, never a hole in the grid
        for (k in CLIST) CLIST[k] = CLIST[k].filter(function (id) { return !!I[id]; });
        return CLIST;
    }
    function creativeItems() {
        var tab = CTABS[RT.cTab] || CTABS[0];
        if (tab.id === 'hotbar') return savedHotbarEntries();
        if (tab.id !== 'search') return creativeTables()[tab.id] || [];
        // Search is every category tab in order, each item once
        var tabs = creativeTables(), seen = {}, all = [];
        CTABS.forEach(function (T) { (tabs[T.id] || []).forEach(function (id) { if (!seen[id]) { seen[id] = 1; all.push(id); } }); });
        Object.keys(I).forEach(function (id) { if (!seen[id]) { seen[id] = 1; all.push(id); } });
        var q = String(RT.cSearch || '').trim().toLowerCase();
        if (!q) return all;
        return all.filter(function (id) {   // matches the label a player reads and the id a command takes
            return id.indexOf(q) >= 0 || String(I[id].t || '').toLowerCase().indexOf(q) >= 0;
        });
    }
    /* a catalogue entry as a stack: an item id is a full stack of it, a saved
       hotbar's entry is the stack that was saved (or the placeholder paper) */
    function creativeStack(e) {
        if (!e) return null;
        if (typeof e === 'object') return JSON.parse(JSON.stringify(e));
        if (!I[e]) return null;
        var st = { id: e, c: stkMax(e) }, md = itemMaxDur(e);
        if (md != null) st.dur = md;
        return st;
    }
    /* ── saved hotbars ──
       In creative, C and a number save the hotbar under that number and X and
       the number put it back, in every world: the game keeps them beside the
       options, in hotbar.nbt, not in the save. The Saved Hotbars tab shows all
       nine, a row each; an empty one is a sheet of paper under its own number
       that says which keys fill it. */
    var HB_KEY = 'comp_mc_hotbars';
    function hbLoad() {
        try { var v = JSON.parse(localStorage.getItem(HB_KEY) || 'null'); if (v && v.length === 9) return v; } catch (e) {}
        return [[], [], [], [], [], [], [], [], []];
    }
    function savedHotbarEntries() {
        var hb = hbLoad(), out = [];
        for (var r = 0; r < 9; r++) {
            var row = hb[r] || [], empty = !row.some(Boolean);
            for (var c = 0; c < 9; c++) out.push(empty ? (c === r ? { id: 'paper', c: 1, lock: 1, tname: 'Save hotbar with C+' + (r + 1) } : null) : (row[c] || null));
        }
        return out;
    }
    function hotbarLoadOrSave(i, load) {
        var hb = hbLoad(), k;
        if (load) {   // every slot comes back, the empty ones too
            var row = hb[i] || [];
            for (k = 0; k < 9; k++) S.inv[k] = row[k] ? JSON.parse(JSON.stringify(row[k])) : null;
            paintHotbar();
            return;
        }
        hb[i] = [];
        for (k = 0; k < 9; k++) hb[i].push(S.inv[k] ? JSON.parse(JSON.stringify(S.inv[k])) : null);
        try { localStorage.setItem(HB_KEY, JSON.stringify(hb)); } catch (e) {}
        actionBar('Item hotbar saved (restore with X+' + (i + 1) + ')');
    }
    function creativeRows() { return Math.max(CROWS, Math.ceil(((RT.cList || []).length) / CCOLS)); }
    function creativeMaxScroll() { return Math.max(0, creativeRows() - CROWS); }
    function creativeRefresh() {
        RT.cList = creativeItems();
        RT.cScroll = Math.max(0, Math.min(creativeMaxScroll(), RT.cScroll || 0));
    }
    function creativeScroll(d) {
        if (!RT.panel || RT.panel.kind !== 'creative') return;
        var was = RT.cScroll;
        RT.cScroll = Math.max(0, Math.min(creativeMaxScroll(), RT.cScroll + d));
        RT.cScrollF = null;   // a wheel notch lands the scroller on the row
        if (RT.cScroll !== was) paintPanel();
    }
    /* CreativeModeInventoryScreen.mouseDragged: the scroller follows the pointer,
       t = (y - top - 18 - 7.5) / (112 - 15), and the rows follow t rounded */
    function creativeBarTo(bar, clientY) {
        var max = creativeMaxScroll();
        if (max <= 0 || !RT.panel || !RT.gs) return;
        var r = RT.el.getBoundingClientRect(), my = (clientY - r.top) / RT.gs - RT.panel.ly;
        var t = Math.max(0, Math.min(1, (my - 18 - 7.5) / 97));
        RT.cScrollF = t;
        RT.cScroll = Math.max(0, Math.min(max, Math.round(t * max)));
        paintPanel();
    }
    function creativeTab(i) {
        i = Math.max(0, Math.min(CTABS.length - 1, i | 0));
        if (i === RT.cTab) return;
        RT.cTab = i;
        RT.cScroll = 0;
        if (CTABS[i].id === 'search') RT.cSearch = '';   // the real one opens the box empty
        RT.cScrollF = null;
        creativeRefresh();
        creativeRender();
        snd('click');
    }
    function creativeRender() {   // a tab switch replaces the markup; the carried stack survives it
        var wrap = RT.el.querySelector('.mc-panelwrap');
        if (!wrap) return;
        RT.qc = null;   // the slots a sweep was over are about to be replaced
        RT.hover = null;
        wrap.innerHTML = panelMarkup('creative');
        RT.hovEl = null;
        panelLayout();
        wirePanelFields(wrap);
        avatarAttach();
        paintPanel();   // re-places the carried ghost from RT.curXY, and re-finds what is under the pointer
        /* The innerHTML swap above destroys whatever had focus. Switching AWAY from
           the search tab therefore dropped focus onto <body>, and since the key
           handlers live on .mc the whole game went keyboard-dead — E, Esc and WASD
           all stopped, with nothing on screen to explain it. */
        var sb = wrap.querySelector('.mc-csearchin');
        if (sb) { sb.focus(); sb.setSelectionRange(sb.value.length, sb.value.length); }
        else RT.el.focus();
    }
    /* The catalogue's clicks are Java's (CreativeModeInventoryScreen.slotClicked):
       an empty cursor takes ONE of the entry, shift takes a full stack; the same
       item already on the cursor gains one on the left button (shift: fills it)
       and loses one on the right; anything else on the cursor is cleared by the
       left button and shrinks by one on the right — even over a gap in the last
       row. Middle-click is the clone: a full stack, only onto an empty cursor. */
    function creativeClick(idx, right, shift) {
        var e = (RT.cList || [])[RT.cScroll * CCOLS + idx], cur = RT.cur;
        var fresh = creativeStack(e);
        if (fresh && fresh.lock) return;   // the Saved Hotbars placeholder is instructions, not an item
        var saved = !!e && typeof e === 'object';
        // a damaged tool, an enchanted or a renamed one is a different item
        var same = !!(cur && fresh && cur.id === fresh.id && JSON.stringify(cur.ench || null) === JSON.stringify(fresh.ench || null) &&
            (cur.name || '') === (fresh.name || '') && (cur.dur == null || cur.dur === fresh.dur));
        if (same) {
            if (!right) { if (shift) cur.c = stkMax(cur.id); else if (cur.c < stkMax(cur.id)) cur.c++; }
            else { cur.c--; if (!cur.c) RT.cur = null; }
        } else if (!cur && fresh) {
            // one of a catalogue entry, or all of a saved stack; shift makes either a full stack
            if (shift) fresh.c = stkMax(fresh.id); else if (!saved) fresh.c = 1;
            RT.cur = fresh;
        } else if (cur) {
            if (!right) RT.cur = null;
            else { cur.c--; if (!cur.c) RT.cur = null; }
        } else return;
        snd('click');
        paintPanel(); paintHotbar();
    }

    /* ═══════════════ the inventory avatar ═══════════════
       The real inventory screen has you standing in a black box beside the
       armour slots, turning to watch the pointer. This is that: the six boxes
       of the player model, the armour you are wearing over them, the item in
       your hand — drawn by hand on a 2D canvas. Under an orthographic camera
       every face of a box is a parallelogram, and a parallelogram is an affine
       image of its texture, so each face is one setTransform and one
       drawImage: the same trick the item icons already use for their little
       cubes. Faces are sorted far-to-near and the ones turned away skipped.

       The numbers are the game's, as InventoryScreen drew it from 1.16 to
       1.20.1 (1.20.2 moved to centring the figure in the box and turning it
       about its middle; this is the older, feet-planted one). The boxes and
       pivots are HumanoidModel's, in skin pixels. The box is the real 49×70 at
       scale 30 (1.875 GUI px per skin pixel), the pointer tracking is
       renderEntityInInventory's atan(d/40) with the body turning 20° and the
       head 40° per radian and the whole figure tilting from the feet, the arms
       carry the idle sway (cos(t·0.09)·0.05 + 0.05 outward, sin(t·0.067)·0.05
       fore and aft) and the one holding something bends forward by π/10 as
       the ITEM arm pose does, the armour layers are the 1.0 / 0.5 pixel
       inflations of HumanoidArmorModel, and the hand holds what the hotbar
       has selected — a block as a small cube, anything flat as the real
       game's one-pixel extrusion, so a sword seen edge-on is still a sword.

       The skin is the launcher's: a 16×32 FRONT view, which is all it draws.
       The other faces are made from it — the sides carry the edge column
       round the corner, backs take each row's dominant colour, the top and
       back of the head take the hair. */
    var AV_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var AV_STEVE = { id: 'steve', n: 'Steve', model: 'classic',
        pal: { h: '#2b1c10', s: '#bd8b72', S: '#a5735c', e: '#ffffff', i: '#4a3fb0', m: '#8a5a45',
               t: '#00a8a8', T: '#008a8a', p: '#4234a0', P: '#362a86', o: '#5f5f5f', O: '#4a4a4a' },
        rows: ['....hhhhhhhh....', '....hhhhhhhh....', '....hssssssh....', '....ssssssss....',
               '....seissies....', '....sssSSsss....', '....ssmmmmss....', '....ssssssss....',
               'ssssttttttttssss', 'ssssttttttttssss', 'sssstttttttTssss', 'ssssttttttttssss',
               'ssssttttttttssss', 'sSsstttttttTssSs', 'ssssttttttttssss', 'ssssttttttttssss',
               'ssssttTtttttssss', 'sSsstttttttTssss', 'ssssttttttttsSss', 'ssssttttttttssss',
               '....pppppppp....', '....pppPPppp....', '....pppppppp....', '....pPpppppp....',
               '....pppppPpp....', '....pppppppp....', '....pPpppppp....', '....pppppppp....',
               '....pppppppp....', '....oooooooo....', '....oooOOooo....', '....oooooooo....'] };
    // undyed leather, then the three metals, each as [face, edge, glint]
    var AV_ARMOR_COL = { leather: ['#a06540', '#6b4128', '#b8805a'], iron: ['#dcdcdc', '#8c8c8c', '#f6f6f6'],
                         gold: ['#f3c53a', '#a8801a', '#fbe38a'], diamond: ['#57dfe6', '#2a9ba5', '#b9f4f7'] };
    // how each face catches the inventory's light, in the engine's face order +x −x +y −y +z −z
    var AV_SHADE = [0.68, 0.82, 1.0, 0.5, 0.95, 0.78];
    /* each face as seen from outside: the corner its texture starts at, which
       way the texture's u and v run, and its normal — all in unit-cube terms */
    var AV_FACES = [
        { o: [1, 1, 1], u: [0, 0, -1], v: [0, -1, 0], n: [1, 0, 0], k: 'right' },
        { o: [0, 1, 0], u: [0, 0, 1], v: [0, -1, 0], n: [-1, 0, 0], k: 'left' },
        { o: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], n: [0, 1, 0], k: 'top' },
        { o: [0, 0, 1], u: [1, 0, 0], v: [0, 0, -1], n: [0, -1, 0], k: 'bottom' },
        { o: [0, 1, 1], u: [1, 0, 0], v: [0, -1, 0], n: [0, 0, 1], k: 'front' },
        { o: [1, 1, 0], u: [-1, 0, 0], v: [0, -1, 0], n: [0, 0, -1], k: 'back' }
    ];
    var D2R = Math.PI / 180;
    function avValidSkin(sk) { return !!(sk && sk.rows && sk.rows.length === 32 && sk.pal); }
    function avatarSkin() {   // the launcher's live choice, else what it handed over at launch, else Steve
        var sk = null;
        try { var h = window.MCHOST; if (h && h.skin) sk = h.skin(); } catch (e) { sk = null; }
        if (!avValidSkin(sk)) sk = RT && RT.skin;
        if (!avValidSkin(sk)) sk = AV_STEVE;
        return sk;
    }
    function avPalMap(sk) {
        if (!(sk.pal instanceof Array)) return sk.pal;
        var m = {};
        for (var i = 0; i < sk.pal.length; i++) m[AV_CHARS.charAt(i)] = sk.pal[i];
        return m;
    }
    function avPixels(sk) {   // (x, y) → '#rrggbb' or null, with a slim skin's arm columns blanked as the launcher shows them
        var pal = avPalMap(sk), rows = sk.rows, slim = sk.model === 'slim';
        return function (x, y) {
            if (x < 0 || x > 15 || y < 0 || y > 31) return null;
            if (slim && y >= 8 && y < 20 && (x === 0 || x === 15)) return null;
            var ch = rows[y].charAt(x);
            return ch === '.' || ch === ' ' || !pal[ch] ? null : pal[ch];
        };
    }
    function avMode(list) {   // the dominant colour of a list (nulls ignored), and how many there were
        var n = {}, best = null, bn = 0;
        for (var i = 0; i < list.length; i++) {
            var c = list[i];
            if (!c) continue;
            n[c] = (n[c] || 0) + 1;
            if (n[c] > bn) { bn = n[c]; best = c; }
        }
        return { col: best, n: bn };
    }
    function avShade(col, f) {
        var v = parseInt(col.slice(1), 16);
        return 'rgb(' + Math.round(((v >> 16) & 255) * f) + ',' + Math.round(((v >> 8) & 255) * f) + ',' + Math.round((v & 255) * f) + ')';
    }
    function avPaintFace(w, h, fn, shade) {
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, w); cv.height = Math.max(1, h);
        var c = cv.getContext('2d');
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
            var col = fn(x, y);
            if (col) { c.fillStyle = avShade(col, shade); c.fillRect(x, y, 1, 1); }
        }
        return cv;
    }
    /* a box of the skin: w×h×d skin pixels, its front cut from the region at
       (x0, y0) of the 16×32 front view and the other five faces made from it */
    function avSkinBox(px, x0, y0, w, h, d, kind) {
        var y, x, rowMode = [], all = [], top2 = [];
        for (y = 0; y < h; y++) {
            var row = [];
            for (x = 0; x < w; x++) { var c = px(x0 + x, y0 + y); row.push(c); all.push(c); if (y < 2) top2.push(c); }
            rowMode.push(avMode(row).col);
        }
        var hair = null;
        if (kind === 'head') { var m2 = avMode(top2); hair = m2.n >= 8 ? m2.col : avMode(all).col; }
        var SH = AV_SHADE;
        // a side carries the row's outermost painted pixel round the corner, and a
        // transparent pixel on the front (a horn's gap) stays open on the top
        function firstOpaque(y, fromRight) {
            for (var i = 0; i < w; i++) { var c = px(x0 + (fromRight ? w - 1 - i : i), y0 + y); if (c) return c; }
            return null;
        }
        return {
            front: avPaintFace(w, h, function (x, y) { return px(x0 + x, y0 + y); }, SH[4]),
            back: avPaintFace(w, h, function (x, y) { return px(x0 + x, y0 + y) ? (hair || rowMode[y]) : null; }, SH[5]),
            left: avPaintFace(d, h, function (x, y) { return firstOpaque(y, false); }, SH[1]),
            right: avPaintFace(d, h, function (x, y) { return firstOpaque(y, true); }, SH[0]),
            top: avPaintFace(w, d, function (x) { return px(x0 + x, y0) ? (hair || rowMode[0]) : null; }, SH[2]),
            bottom: avPaintFace(w, d, function (x) { return px(x0 + x, y0 + h - 1) ? rowMode[h - 1] : null; }, SH[3])
        };
    }
    /* an armour box: the tier's colour wherever the piece covers, a darker
       edge along every boundary so the plates read as plates */
    function avArmorBox(tier, w, h, d, cover) {
        var col = AV_ARMOR_COL[tier] || AV_ARMOR_COL.iron;
        function mk(W, H, face, shade) {
            return avPaintFace(W, H, function (u, v) {
                if (!cover(face, u, v, W, H)) return null;
                var edge = !cover(face, u - 1, v, W, H) || !cover(face, u + 1, v, W, H) || !cover(face, u, v - 1, W, H) || !cover(face, u, v + 1, W, H);
                return edge ? col[1] : ((u * 5 + v * 3) % 17 === 0 ? col[2] : col[0]);   // a plate is mostly plate
            }, shade);
        }
        var SH = AV_SHADE;
        return { right: mk(d, h, 'right', SH[0]), left: mk(d, h, 'left', SH[1]), top: mk(w, d, 'top', SH[2]),
                 bottom: mk(w, d, 'bottom', SH[3]), front: mk(w, h, 'front', SH[4]), back: mk(w, h, 'back', SH[5]) };
    }
    function avIn(u, v, W, H) { return u >= 0 && v >= 0 && u < W && v < H; }
    var AV_COVER = {
        // a helmet leaves the face open — the real ones do, from the brow down
        helm: function (f, u, v, W, H) { if (!avIn(u, v, W, H) || f === 'bottom') return false; return f !== 'front' || !(u >= 2 && u <= W - 3 && v >= 4); },
        chest: function (f, u, v, W, H) { return avIn(u, v, W, H); },
        beltBody: function (f, u, v, W, H) { if (!avIn(u, v, W, H) || f === 'top') return false; return f === 'bottom' || v >= H - 4; },
        legs: function (f, u, v, W, H) { return avIn(u, v, W, H) && f !== 'top'; },
        boots: function (f, u, v, W, H) { if (!avIn(u, v, W, H) || f === 'top') return false; return f === 'bottom' || v >= H - 5; }
    };
    function avPart(faces, w, h, d, cx, cy, cz, pivot, role) {
        return { faces: faces, hx: w / 2, hy: h / 2, hz: d / 2, c: [cx, cy, cz], v: pivot, role: role };
    }
    function avModel(sk, armor) {
        var slim = sk.model === 'slim', aw = slim ? 3 : 4, ax = 4 + aw / 2, ay = slim ? 17.5 : 18, apy = slim ? 21.5 : 22;
        var px = avPixels(sk), parts = [], tier;
        parts.push(avPart(avSkinBox(px, 4, 0, 8, 8, 8, 'head'), 8, 8, 8, 0, 28, 0, [0, 24, 0], 'head'));
        parts.push(avPart(avSkinBox(px, 4, 8, 8, 12, 4, 'body'), 8, 12, 4, 0, 18, 0, [0, 24, 0], 'body'));
        // a slim skin's arms are 3 wide and hang half a pixel lower (PlayerModel's 2.5 pivot)
        parts.push(avPart(avSkinBox(px, slim ? 1 : 0, 8, aw, 12, 4, 'arm'), aw, 12, 4, -ax, ay, 0, [-5, apy, 0], 'armR'));
        parts.push(avPart(avSkinBox(px, 12, 8, aw, 12, 4, 'arm'), aw, 12, 4, ax, ay, 0, [5, apy, 0], 'armL'));
        parts.push(avPart(avSkinBox(px, 4, 20, 4, 12, 4, 'leg'), 4, 12, 4, -1.9, 6, 0, [-1.9, 12, 0], 'legR'));
        parts.push(avPart(avSkinBox(px, 8, 20, 4, 12, 4, 'leg'), 4, 12, 4, 1.9, 6, 0, [1.9, 12, 0], 'legL'));
        // the armour, worn over the top: helmet, chestplate and boots inflate the
        // box by a pixel all round, leggings by half of one
        if (armor[0]) { tier = I[armor[0].id].armor.tier; parts.push(avPart(avArmorBox(tier, 10, 10, 10, AV_COVER.helm), 10, 10, 10, 0, 28, 0, [0, 24, 0], 'head')); }
        if (armor[1]) {
            tier = I[armor[1].id].armor.tier;
            parts.push(avPart(avArmorBox(tier, 10, 14, 6, AV_COVER.chest), 10, 14, 6, 0, 18, 0, [0, 24, 0], 'body'));
            // the armour model has the classic arm on every skin, slim or not
            parts.push(avPart(avArmorBox(tier, 6, 14, 6, AV_COVER.chest), 6, 14, 6, -6, 18, 0, [-5, 22, 0], 'armR'));
            parts.push(avPart(avArmorBox(tier, 6, 14, 6, AV_COVER.chest), 6, 14, 6, 6, 18, 0, [5, 22, 0], 'armL'));
        }
        if (armor[2]) {
            tier = I[armor[2].id].armor.tier;
            parts.push(avPart(avArmorBox(tier, 9, 13, 5, AV_COVER.beltBody), 9, 13, 5, 0, 18, 0, [0, 24, 0], 'body'));
            parts.push(avPart(avArmorBox(tier, 5, 13, 5, AV_COVER.legs), 5, 13, 5, -1.9, 6, 0, [-1.9, 12, 0], 'legR'));
            parts.push(avPart(avArmorBox(tier, 5, 13, 5, AV_COVER.legs), 5, 13, 5, 1.9, 6, 0, [1.9, 12, 0], 'legL'));
        }
        if (armor[3]) {
            tier = I[armor[3].id].armor.tier;
            parts.push(avPart(avArmorBox(tier, 6, 14, 6, AV_COVER.boots), 6, 14, 6, -1.9, 6, 0, [-1.9, 12, 0], 'legR'));
            parts.push(avPart(avArmorBox(tier, 6, 14, 6, AV_COVER.boots), 6, 14, 6, 1.9, 6, 0, [1.9, 12, 0], 'legL'));
        }
        return parts;
    }
    /* the item in the right hand: a block is a small cube turned to show its
       top, a tool stands out forward and up with its flat to the side, and
       anything else lies flat in the palm pointing forward — the three
       third-person poses of the real game, at its sizes (0.375, 0.85, 0.55) */
    function avTileFace(tid, shade) {
        var cv = document.createElement('canvas');
        cv.width = cv.height = 16;
        var c = cv.getContext('2d');
        c.drawImage(ATLAS, (tid % 16) * 16, ((tid / 16) | 0) * 16, 16, 16, 0, 0, 16, 16);
        if (shade < 1) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(0,0,0,' + (1 - shade) + ')'; c.fillRect(0, 0, 16, 16); }
        return cv;
    }
    /* a flat item as the real game extrudes it: the sprite on both faces and,
       one pixel deep, the colour of the outermost painted pixel of each row
       and column along the edges */
    function avSpriteSlab(sp) {
        var c = sp.getContext('2d'), w = sp.width, h = sp.height, d;
        try { d = c.getImageData(0, 0, w, h).data; } catch (e) { return { front: sp, back: sp }; }
        function at(x, y) {   // the pixel as '#rrggbb', which avShade takes
            var i = (y * w + x) * 4;
            return d[i + 3] > 40 ? '#' + ((1 << 24) + (d[i] << 16) + (d[i + 1] << 8) + d[i + 2]).toString(16).slice(1) : null;
        }
        function rowEdge(y, fromRight) { for (var i = 0; i < w; i++) { var col = at(fromRight ? w - 1 - i : i, y); if (col) return col; } return null; }
        function colEdge(x, fromBottom) { for (var i = 0; i < h; i++) { var col = at(x, fromBottom ? h - 1 - i : i); if (col) return col; } return null; }
        function strip(n, vertical, fromEnd, shade) {
            var cv = document.createElement('canvas'); cv.width = vertical ? 1 : n; cv.height = vertical ? n : 1;
            var g = cv.getContext('2d');
            for (var i = 0; i < n; i++) {
                var col = vertical ? rowEdge(i, fromEnd) : colEdge(i, fromEnd);
                if (col) { g.fillStyle = avShade(col, shade); g.fillRect(vertical ? 0 : i, vertical ? i : 0, 1, 1); }
            }
            return cv;
        }
        return { front: sp, back: sp, left: strip(h, true, false, AV_SHADE[1]), right: strip(h, true, true, AV_SHADE[0]),
                 top: strip(w, false, false, AV_SHADE[2]), bottom: strip(w, false, true, AV_SHADE[3]) };
    }
    function avHeldPart(st) {
        var def = st && I[st.id];
        if (!def) return null;
        var mi = new Float64Array(9), a = new Float64Array(9), b = new Float64Array(9), faces, part;
        if (def.place != null && B[def.place] && !B[def.place].cross && !B[def.place].half) {
            var tx = TEX[def.place];
            faces = { right: avTileFace(texFace(tx, 0), AV_SHADE[0]), left: avTileFace(texFace(tx, 1), AV_SHADE[1]),
                      top: avTileFace(texFace(tx, 2), AV_SHADE[2]), bottom: avTileFace(texFace(tx, 3), AV_SHADE[3]),
                      front: avTileFace(texFace(tx, 4), AV_SHADE[4]), back: avTileFace(texFace(tx, 5), AV_SHADE[5]) };
            rotMat(a, 0, 45 * D2R, 0); rotMat(b, 30 * D2R, 0, 0); mul3(mi, b, a);
            part = { faces: faces, hx: 3, hy: 3, hz: 3, off: [-1, -10, 4.5], mi: mi };
        } else {
            var tid = def.tile != null ? def.tile : (def.place != null ? texTop(TEX[def.place]) : TILE.i_stick);
            faces = avSpriteSlab(avTileFace(tid, 1));
            var handheld = !!def.tool || st.id === 'bow';
            // columns of the matrix are where the sprite's right, up and normal go
            if (handheld) {
                /* the tool pose: flat to the side, pointing forward and up. Turned 20°
                   toward the viewer on top of that, or at rest the whole thing is one
                   pixel wide from the front; a block, food or a torch has no such problem */
                b.set([0, 0, -1, -0.259, 0.966, 0, 0.966, 0.259, 0]); rotMat(a, 0, 20 * D2R, 0); mul3(mi, a, b);
                part = { faces: faces, hx: 6.8, hy: 6.8, hz: 0.4, off: [-1.5, -9.5, 6], mi: mi };
            } else if (def.place != null) {   // a torch or a flower is a block model: it stands in the fist, turned like the cube would be
                rotMat(a, 0, 45 * D2R, 0); rotMat(b, 30 * D2R, 0, 0); mul3(mi, b, a);
                part = { faces: faces, hx: 3.5, hy: 3.5, hz: 0.4, off: [-1, -7.5, 4.5], mi: mi };
            } else { mi.set([-1, 0, 0, 0, 0, 1, 0, 1, 0]); part = { faces: faces, hx: 4.4, hy: 4.4, hz: 0.4, off: [-1.5, -10.5, 4], mi: mi }; }
        }
        part.follow = 'armR';
        return part;
    }
    var AV_CACHE = {}, AV_CACHE_KEYS = [];   // built models by signature, a handful deep: reopening the screen must not repaint 36 faces
    var AV_M_ROOT = new Float64Array(9), AV_M_A = new Float64Array(9), AV_M_B = new Float64Array(9), AV_M_P = new Float64Array(9), AV_M_Q = new Float64Array(9), AV_M_ARM = new Float64Array(9);
    var AV_CORNER = [0, 0, 0];   // scratch corner, so the inner loop allocates nothing
    var AV_POSE = { headPitch: 0, headYaw: 0, swX: 0, swZ: 0, item: false };
    function avatarAttach() {   // a panel with the box in it was just rendered
        var cv = RT.el.querySelector('.mc-av');
        if (!cv) { RT.av = null; return; }
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var r = cv.getBoundingClientRect();
        cv.width = Math.max(1, Math.round((r.width || 118) * dpr));
        cv.height = Math.max(1, Math.round((r.height || 170) * dpr));
        var mxy = RT.curXY;
        RT.av = { cv: cv, rect: r, rectT: 0, mx: mxy ? mxy[0] : null, my: mxy ? mxy[1] : null, sig: '', parts: null, itemId: null, item: null };
        avatarSync();
    }
    function avatarSync() {   // rebuild the model when the skin, the armour or the held item changed
        var av = RT.av;
        if (!av) return;
        var sk = avatarSkin();
        var sig = sk.id + '|' + sk.model + '|' + sk.rows.join('') + '|' + JSON.stringify(sk.pal) + '|' + S.armor.map(function (a) { return a ? a.id : '-'; }).join(',');
        if (sig !== av.sig) {
            av.sig = sig;
            if (!AV_CACHE[sig]) {
                AV_CACHE[sig] = avModel(sk, S.armor);
                AV_CACHE_KEYS.push(sig);
                if (AV_CACHE_KEYS.length > 6) delete AV_CACHE[AV_CACHE_KEYS.shift()];
            }
            av.parts = AV_CACHE[sig];
        }
        var h = held(), hid = h ? h.id : null;
        if (hid !== av.itemId) { av.itemId = hid; av.item = h ? avHeldPart(h) : null; }
    }
    function avPartMat(role, out) {
        var pose = AV_POSE;
        if (role === 'head') rotMat(out, pose.headPitch, pose.headYaw, 0);
        // the arm with something in it bends forward: HumanoidModel's ITEM pose, xRot·0.5 − π/10
        else if (role === 'armR') rotMat(out, pose.item ? pose.swX * 0.5 - Math.PI / 10 : pose.swX, 0, -pose.swZ);
        else if (role === 'armL') rotMat(out, -pose.swX, 0, pose.swZ);
        else rotMat(out, 0, 0, 0);
        return out;
    }
    /* one box: its six faces turned by the part, then the body, dropped on the
       screen; the ones facing away are skipped, the rest queued with their depth */
    function avPushFaces(quads, p, mp, root, cx, cy, cz, vx, vy, vz, s, feetX, feetY) {
        var cn = AV_CORNER;
        for (var k = 0; k < 6; k++) {
            var fd = AV_FACES[k], img = p.faces[fd.k];
            if (!img) continue;
            var nx = mp[0] * fd.n[0] + mp[1] * fd.n[1] + mp[2] * fd.n[2], ny = mp[3] * fd.n[0] + mp[4] * fd.n[1] + mp[5] * fd.n[2], nz = mp[6] * fd.n[0] + mp[7] * fd.n[1] + mp[8] * fd.n[2];
            if (root[6] * nx + root[7] * ny + root[8] * nz <= 0.001) continue;   // turned away
            var depth = 0, wz0 = 0, ox = 0, oy = 0, ux = 0, uy = 0, wx2 = 0, wy2 = 0;
            for (var j = 0; j < 3; j++) {
                cn[0] = fd.o[0] + (j === 1 ? fd.u[0] : j === 2 ? fd.v[0] : 0);
                cn[1] = fd.o[1] + (j === 1 ? fd.u[1] : j === 2 ? fd.v[1] : 0);
                cn[2] = fd.o[2] + (j === 1 ? fd.u[2] : j === 2 ? fd.v[2] : 0);
                var lx = (cn[0] - 0.5) * 2 * p.hx + cx - vx, ly = (cn[1] - 0.5) * 2 * p.hy + cy - vy, lz = (cn[2] - 0.5) * 2 * p.hz + cz - vz;
                var mx0 = mp[0] * lx + mp[1] * ly + mp[2] * lz + vx, my0 = mp[3] * lx + mp[4] * ly + mp[5] * lz + vy, mz0 = mp[6] * lx + mp[7] * ly + mp[8] * lz + vz;
                var wx = root[0] * mx0 + root[1] * my0 + root[2] * mz0, wy = root[3] * mx0 + root[4] * my0 + root[5] * mz0, wz = root[6] * mx0 + root[7] * my0 + root[8] * mz0;
                var sx = feetX + s * wx, sy = feetY - s * wy;
                if (j === 0) { ox = sx; oy = sy; wz0 = wz; depth = wz; }
                else if (j === 1) { ux = sx - ox; uy = sy - oy; depth += (wz - wz0) / 2; }
                else { wx2 = sx - ox; wy2 = sy - oy; depth += (wz - wz0) / 2; }
            }
            // the face's depth is its centre's: the origin corner plus half of each edge
            quads.push({ d: depth, ox: ox, oy: oy, ux: ux, uy: uy, vx: wx2, vy: wy2, img: img });
        }
    }
    function avatarDraw() {
        var av = RT.av;
        if (!av || !av.cv || !av.parts) return;
        var cv = av.cv, W = cv.width, H = cv.height, c = cv.getContext('2d');
        // the box's place on the page, re-measured now and then rather than every frame
        var now = RT.now || 0;
        if (!av.rect || now - av.rectT > 0.5) { av.rect = cv.getBoundingClientRect(); av.rectT = now; }
        var r = av.rect;
        if (!r.width || !r.height) return;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, W, H);
        c.imageSmoothingEnabled = false;
        /* renderEntityInInventoryFollowsMouse since 1.20.2: the pointer is measured
           from the middle of the box, and the figure stands with half its height
           plus a sixteenth of a block above that middle, at the screen's scale (30
           in the survival screen's 49x70 box, 20 in creative's 32x43) */
        var bw = +cv.getAttribute('data-w') || 49, bh = +cv.getAttribute('data-h') || 70, sc = +cv.getAttribute('data-s') || 30;
        var kg = r.height / bh;                                   // CSS px per GUI px
        var refX = r.left + kg * bw / 2, refY = r.top + kg * bh / 2;
        var mx = av.mx != null ? av.mx : refX, my = av.my != null ? av.my : refY;
        var f = Math.atan((refX - mx) / (kg * 40)), g = Math.atan((my - refY) / (kg * 40));
        var bodyYaw = f * 20 * D2R, tilt = g * 20 * D2R;
        var pose = AV_POSE, age = performance.now() / 50;
        pose.headYaw = f * 20 * D2R; pose.headPitch = g * 20 * D2R;
        pose.swZ = Math.cos(age * 0.09) * 0.05 + 0.05; pose.swX = Math.sin(age * 0.067) * 0.05; pose.item = !!av.item;
        var s = kg * (sc / 16) * (W / r.width);                    // canvas px per skin px
        var feetX = W / 2, feetY = H / 2 + s * 15.4;              // (0.9 + 0.0625) blocks below the middle
        rotMat(AV_M_A, 0, bodyYaw, 0); rotMat(AV_M_B, tilt, 0, 0); mul3(AV_M_ROOT, AV_M_B, AV_M_A);
        var root = AV_M_ROOT, quads = [], i, armV = null;
        for (i = 0; i < av.parts.length; i++) {
            var p = av.parts[i];
            if (p.role === 'armR' && !armV) armV = p.v;
            avPushFaces(quads, p, avPartMat(p.role, AV_M_P), root, p.c[0], p.c[1], p.c[2], p.v[0], p.v[1], p.v[2], s, feetX, feetY);
        }
        if (av.item && armV) {   // in the right hand: its own turn on top of the arm's, riding the arm's bend and sway
            var it = av.item, armM = avPartMat('armR', AV_M_ARM);
            mul3(AV_M_Q, armM, it.mi);
            var ox = armV[0] + armM[0] * it.off[0] + armM[1] * it.off[1] + armM[2] * it.off[2];
            var oy = armV[1] + armM[3] * it.off[0] + armM[4] * it.off[1] + armM[5] * it.off[2];
            var oz = armV[2] + armM[6] * it.off[0] + armM[7] * it.off[1] + armM[8] * it.off[2];
            avPushFaces(quads, it, AV_M_Q, root, ox, oy, oz, ox, oy, oz, s, feetX, feetY);
        }
        quads.sort(function (a, b) { return a.d - b.d; });
        for (i = 0; i < quads.length; i++) {
            var q = quads[i], iw = q.img.width, ih = q.img.height;
            c.setTransform(q.ux / iw, q.uy / iw, q.vx / ih, q.vy / ih, q.ox, q.oy);
            c.drawImage(q.img, -0.02, -0.02, iw + 0.04, ih + 0.04);   // a hair over, so seams between faces don't show through
        }
        c.setTransform(1, 0, 0, 1, 0, 0);
    }

    /* ── the container sprites ─────────────────────────────────
       Every screen's background is painted the way the game's container
       textures are drawn: the shared frame (a black outline with its corners
       cut 3 and 6 pixels, a 2-pixel white bevel top-left and a 2-pixel #555555
       one bottom-right), #C6C6C6 fill, and every slot a 1-pixel inset bevel
       round a #8B8B8B well at an 18-pixel pitch, so neighbouring frames touch.
       Geometry and colours follow the game's screens pixel for pixel; the
       pictures (the flame, the hammer, the orbs, the silhouettes) are ours. */
    /* ── widget sprites ──────────────────────────────────────────
       The 20-pixel button in its three states, as the current game's
       widget/button sprites have it: a 1-pixel frame (black, or white while
       hovered or focused), a #AAAAAA highlight along the top and down the left,
       two rows of #565656 along the bottom and a #555555 column down the right,
       round a face of stone-grey noise averaging #6F6F6F; the disabled one a
       dark flat face. Drawn at 200x20 and nine-sliced with a 3-pixel border,
       like the originals. Then the text field, the in-world menu background,
       and the pause menu's four icons. */
    function sprWidgets(mk) {
        var rnd = mulb(0x5EED1);
        function face(cx, x, y, w, h, base, spread) {
            for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
                var v = Math.max(0, Math.min(255, base + Math.round((rnd() + rnd() - 1) * spread)));
                cx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; cx.fillRect(x + xx, y + yy, 1, 1);
            }
        }
        function button(frame, base, spread, hi, lo, lo2) {
            return function (cx) {
                sprRect(cx, 0, 0, 200, 20, frame);
                face(cx, 1, 1, 198, 18, base, spread);
                if (hi) {
                    sprRect(cx, 1, 1, 197, 1, hi); sprRect(cx, 1, 1, 1, 16, hi);
                    sprRect(cx, 2, 17, 196, 2, lo); sprRect(cx, 198, 2, 1, 17, lo2);
                }
            };
        }
        mk('btn', 200, 20, button('#000000', 0x6f, 11, '#aaaaaa', '#565656', '#555555'));
        mk('btn_h', 200, 20, button('#ffffff', 0x77, 11, '#b4b4b4', '#5c5c5c', '#5a5a5a'));
        mk('btn_d', 200, 20, button('#000000', 0x31, 3, null));
        // EditBox's widget/text_field: #A0A0A0 round black, white round black when focused
        mk('field', 200, 20, function (cx) { sprRect(cx, 0, 0, 200, 20, '#a0a0a0'); sprRect(cx, 1, 1, 198, 18, '#000000'); });
        mk('field_h', 200, 20, function (cx) { sprRect(cx, 0, 0, 200, 20, '#ffffff'); sprRect(cx, 1, 1, 198, 18, '#000000'); });
        // inworld_menu_background: black at about half alpha with a faint grain, tiled every 32 GUI pixels
        mk('iwbg', 32, 32, function (cx) {
            for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
                cx.fillStyle = 'rgba(0,0,0,' + (0.47 + (rnd() - 0.5) * 0.07).toFixed(3) + ')'; cx.fillRect(x, y, 1, 1);
            }
        });
        var IC = {
            ic_bug: ['...............', '.....#...#.....', '......#.#......', '....#######....', '...##.###.##...', '..#.#######.#..', '....#######....',
                     '..#.#######.#..', '....#######....', '..#.#######.#..', '.....#####.....', '......###......', '...............', '...............', '...............'],
            ic_feedback: ['...............', '..###########..', '.#...........#.', '.#.#########.#.', '.#...........#.', '.#.#######...#.', '.#...........#.',
                          '.#.#########.#.', '.#...........#.', '..####..######.', '.....#.#.......', '.....##........', '.....#.........', '...............', '...............'],
            ic_friends: ['...............', '....###........', '...#####..###..', '...#####.#####.', '...#####.#####.', '....###..#####.', '..........###..',
                         '..#######......', '.#########.###.', '.#########.####', '.#########.####', '.#########.####', '...............', '...............', '...............'],
            ic_report: ['...............', '..#............', '..##########...', '..#########....', '..########.....', '..#########....', '..##########...',
                        '..#............', '..#............', '..#............', '..#............', '..#............', '..#............', '...............', '...............']
        };
        for (var ik in IC) (function (rows) { mk(ik, 15, 15, function (cx) { sprMap(cx, rows, { '#': '#ffffff' }); }); })(IC[ik]);
    }
    /* ── the advancement screen's sprites ─────────────────────────
       The 252x140 window with the hole its 234x113 view shows through, the
       26x26 frames (a square task, a rounded goal, a spiked challenge) in gold
       once done and in grey before, the 200x26 title bars the hover draws
       (gold for done, blue for not), and the dark box the description sits in.
       The game's sizes, our pictures. */
    function sprAdv(mk) {
        var K = '#000000', L = '#ffffff', D = '#555555', F = '#c6c6c6', SD = '#373737';
        function px(cx, x, y, c) { cx.fillStyle = c; cx.fillRect(x, y, 1, 1); }
        mk('adv_win', 252, 140, function (cx) {
            var W = 252, H = 140;
            sprRect(cx, 1, 1, W - 2, H - 2, F);
            sprRect(cx, 2, 1, W - 5, 1, L); sprRect(cx, 1, 2, W - 4, 1, L); sprRect(cx, 1, 3, 2, H - 6, L); px(cx, 3, 3, L);
            sprRect(cx, W - 3, 3, 2, H - 5, D); sprRect(cx, 3, H - 3, W - 6, 1, D); sprRect(cx, 3, H - 2, W - 5, 1, D); px(cx, W - 4, H - 4, D);
            sprRect(cx, 2, 0, W - 5, 1, K); sprRect(cx, 3, H - 1, W - 5, 1, K); sprRect(cx, 0, 2, 1, H - 5, K); sprRect(cx, W - 1, 3, 1, H - 5, K);
            px(cx, 1, 1, K); px(cx, W - 3, 1, K); px(cx, W - 2, 2, K); px(cx, 1, H - 3, K); px(cx, 2, H - 2, K); px(cx, W - 2, H - 2, K);
            cx.clearRect(W - 2, 1, 1, 1); cx.clearRect(1, H - 2, 1, 1);
            // the view's recess: dark above and left, white below and right, and the hole itself
            sprRect(cx, 8, 17, 236, 1, SD); sprRect(cx, 8, 17, 1, 115, SD);
            sprRect(cx, 9, 131, 235, 1, L); sprRect(cx, 243, 18, 1, 114, L);
            cx.clearRect(9, 18, 234, 113);
        });
        function inside(kind, x, y) {
            if (kind === 'task') return x >= 1 && x <= 24 && y >= 1 && y <= 24 && !((x === 1 || x === 24) && (y === 1 || y === 24));
            if (kind === 'goal') { var dx = Math.max(0, Math.abs(x - 12.5) - 5.5), dy = Math.max(0, Math.abs(y - 12.5) - 5.5); return dx * dx + dy * dy <= 42; }
            // the challenge frame: a square with a spike at each corner and each edge's middle
            var ax = Math.abs(x - 12.5), ay = Math.abs(y - 12.5);
            if (ax <= 9.5 && ay <= 9.5) return true;
            if (ax + ay >= 20 && ax <= 12.5 && ay <= 12.5 && Math.abs(ax - ay) <= 1.5) return true;
            return (ax <= 1.5 && ay <= 12.5) || (ay <= 1.5 && ax <= 12.5);
        }
        function frame(kind, done) {
            var body = done ? '#e0ac2f' : '#b4b4b4', lite = done ? '#fff08c' : '#ececec', dark = done ? '#9d6311' : '#727272', well = done ? '#c78f1c' : '#949494';
            return function (cx) {
                for (var y = 0; y < 26; y++) for (var x = 0; x < 26; x++) {
                    if (inside(kind, x, y)) {
                        var edgeTL = !inside(kind, x - 1, y) || !inside(kind, x, y - 1) || !inside(kind, x - 2, y) || !inside(kind, x, y - 2);
                        var edgeBR = !inside(kind, x + 1, y) || !inside(kind, x, y + 1) || !inside(kind, x + 2, y) || !inside(kind, x, y + 2);
                        var c = edgeTL && !edgeBR ? lite : edgeBR ? dark : body;
                        if (x >= 5 && x <= 20 && y >= 5 && y <= 20) c = well;   // where the item sits
                        px(cx, x, y, c);
                    } else if (inside(kind, x + 1, y) || inside(kind, x - 1, y) || inside(kind, x, y + 1) || inside(kind, x, y - 1)) px(cx, x, y, K);
                }
            };
        }
        ['task', 'goal', 'challenge'].forEach(function (k) { mk('adv_' + k + '_o', 26, 26, frame(k, true)); mk('adv_' + k + '_u', 26, 26, frame(k, false)); });
        function bar(face, lite, dark) {
            return function (cx) {
                sprRect(cx, 0, 0, 200, 26, K);
                sprRect(cx, 1, 1, 198, 24, face);
                sprRect(cx, 1, 1, 198, 2, lite); sprRect(cx, 1, 1, 2, 24, lite);
                sprRect(cx, 1, 23, 198, 2, dark); sprRect(cx, 197, 1, 2, 24, dark);
            };
        }
        mk('adv_bar_o', 200, 26, bar('#c9972a', '#f2d06a', '#7d5a13'));
        mk('adv_bar_u', 200, 26, bar('#1f59a6', '#4e8ad6', '#0d2d5c'));
        mk('adv_desc', 16, 16, function (cx) {   // the description's box, nine-sliced with a 2-pixel border
            sprRect(cx, 0, 0, 16, 16, K); sprRect(cx, 1, 1, 14, 14, '#555555'); sprRect(cx, 2, 2, 12, 12, '#212121');
        });
    }
    /* the Statistics screen's column headers, an 18x18 raised box with the
       column's picture, and the items' slot; our own little drawings */
    function sprStats(mk) {
        var W = '#ffffff';
        function box(cx) { sprRect(cx, 0, 0, 18, 18, '#8b8b8b'); sprRect(cx, 0, 0, 17, 1, W); sprRect(cx, 0, 0, 1, 17, W); sprRect(cx, 1, 17, 17, 1, '#373737'); sprRect(cx, 17, 1, 1, 17, '#373737'); }
        mk('st_slot', 18, 18, function (cx) { sprRect(cx, 0, 0, 18, 18, '#8b8b8b'); sprRect(cx, 0, 0, 17, 1, '#373737'); sprRect(cx, 0, 0, 1, 17, '#373737'); sprRect(cx, 1, 17, 17, 1, W); sprRect(cx, 17, 1, 1, 17, W); });
        var PIC = {
            st_mined: ['..........', '.####.....', '.#..#.....', '.####.....', '....#.....', '.....#....', '......#...', '.......#..', '..........', '..........'],
            st_broken: ['..........', '.####.....', '.#..#.....', '.###......', '....#.#...', '......#...', '.....#.#..', '.......#..', '..........', '..........'],
            st_crafted: ['..........', '.########.', '.#..#..#..', '.########.', '.#..#..#..', '.########.', '.#......#.', '.#......#.', '..........', '..........'],
            st_used: ['..........', '...##.....', '...##.....', '...####...', '..######..', '..######..', '...####...', '...###....', '..........', '..........'],
            st_picked: ['..........', '....#.....', '...###....', '..#####...', '....#.....', '....#.....', '....#.....', '..#####...', '..........', '..........'],
            st_dropped: ['..........', '..#####...', '....#.....', '....#.....', '....#.....', '..#####...', '...###....', '....#.....', '..........', '..........']
        };
        for (var k in PIC) (function (rows) { mk(k, 18, 18, function (cx) { box(cx); sprMap(cx, rows, { '#': '#202020' }, 4, 4); }); })(PIC[k]);
    }
    /* ── the menus' sprites ─────────────────────────────────────────
       What the title screen's menus are drawn over and with since 1.20.5: the
       menu background (black at about a third, a faint grain, tiled every 32
       GUI pixels) over the blurred panorama, the darker list background, the
       slider's track, the Create New World tabs, and the two icon buttons'
       pictures. The game's sizes and borders, our pixels. */
    function sprMenu(mk) {
        var rnd = mulb(0x3E7B6);
        function grain(a0, spread) {
            return function (cx) {
                for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
                    cx.fillStyle = 'rgba(0,0,0,' + (a0 + (rnd() - 0.5) * spread).toFixed(3) + ')'; cx.fillRect(x, y, 1, 1);
                }
            };
        }
        mk('mbg', 32, 32, grain(0.32, 0.06));
        mk('mlbg', 32, 32, grain(0.52, 0.06));
        function track(frame) {
            return function (cx) {
                sprRect(cx, 0, 0, 200, 20, frame);
                for (var y = 1; y < 19; y++) for (var x = 1; x < 199; x++) {
                    var v = 0x2e + Math.round((rnd() - 0.5) * 5);
                    cx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; cx.fillRect(x, y, 1, 1);
                }
            };
        }
        mk('slider', 200, 20, track('#000000'));
        mk('slider_h', 200, 20, track('#ffffff'));
        // MenuTabBar's tabs: nine-sliced with a 2-pixel border on the top and sides and none below, so they open onto the page
        function tab(outer, inner, fill) {
            return function (cx) {
                if (fill) sprRect(cx, 2, 2, 126, 22, fill);
                sprRect(cx, 0, 0, 130, 1, outer); sprRect(cx, 0, 0, 1, 24, outer); sprRect(cx, 129, 0, 1, 24, outer);
                sprRect(cx, 1, 1, 128, 1, inner); sprRect(cx, 1, 1, 1, 23, inner); sprRect(cx, 128, 1, 1, 23, inner);
            };
        }
        mk('tab', 130, 24, tab('#000000', '#4f4f4f', 'rgba(0,0,0,0.45)'));
        mk('tab_h', 130, 24, tab('#ffffff', '#8f8f8f', 'rgba(0,0,0,0.45)'));
        mk('tab_s', 130, 24, tab('#000000', '#a0a0a0', null));
        mk('tab_sh', 130, 24, tab('#ffffff', '#d0d0d0', null));
        var IC = {
            ic_lang: ['...............', '.....#####.....', '...##.#.#.##...', '..#..#...#..#..', '.#...#...#...#.', '.#############.', '#....#...#....#',
                      '#....#...#....#', '#....#...#....#', '.#############.', '.#...#...#...#.', '..#..#...#..#..', '...##.#.#.##...', '.....#####.....', '...............'],
            ic_acc: ['......###......', '......###......', '......###......', '...............', '.#############.', '......###......', '......###......',
                     '......###......', '......###......', '.....#...#.....', '.....#...#.....', '....#.....#....', '....#.....#....', '...#.......#...', '...............']
        };
        for (var ik in IC) (function (rows) { mk(ik, 15, 15, function (cx) { sprMap(cx, rows, { '#': '#ffffff' }); }); })(IC[ik]);
    }
    function sprPanels(mk) {
        var K = '#000000', L = '#ffffff', D = '#555555', F = '#c6c6c6', W8 = '#8b8b8b', SD = '#373737';
        function px(cx, x, y, c) { cx.fillStyle = c; cx.fillRect(x, y, 1, 1); }
        function frame(cx, W, H, fill) {
            sprRect(cx, 1, 1, W - 2, H - 2, fill || F);
            sprRect(cx, 2, 1, W - 5, 1, L); sprRect(cx, 1, 2, W - 4, 1, L); sprRect(cx, 1, 3, 2, H - 6, L); px(cx, 3, 3, L);
            sprRect(cx, W - 3, 3, 2, H - 5, D); sprRect(cx, 3, H - 3, W - 6, 1, D); sprRect(cx, 3, H - 2, W - 5, 1, D); px(cx, W - 4, H - 4, D);
            sprRect(cx, 2, 0, W - 5, 1, K); sprRect(cx, 3, H - 1, W - 5, 1, K);
            sprRect(cx, 0, 2, 1, H - 5, K); sprRect(cx, W - 1, 3, 1, H - 5, K);
            px(cx, 1, 1, K); px(cx, W - 3, 1, K); px(cx, W - 2, 2, K); px(cx, 1, H - 3, K); px(cx, 2, H - 2, K); px(cx, W - 2, H - 2, K);
            [[W - 2, 1], [1, H - 2]].forEach(function (p) { cx.clearRect(p[0], p[1], 1, 1); });
        }
        // a sunken box: dark top and left, white bottom and right, the two odd corners #8B8B8B
        function slot(cx, x, y, w, h, inner, dark) {
            w = w || 18; h = h || 18;
            sprRect(cx, x, y, w, h, inner || W8);
            sprRect(cx, x, y, w - 1, 1, dark || SD); sprRect(cx, x, y, 1, h - 1, dark || SD);
            sprRect(cx, x + 1, y + h - 1, w - 1, 1, L); sprRect(cx, x + w - 1, y + 1, 1, h - 1, L);
            px(cx, x + w - 1, y, W8); px(cx, x, y + h - 1, W8);
        }
        function slots(cx, ix, iy, cols, rows) { for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) slot(cx, ix - 1 + 18 * c, iy - 1 + 18 * r); }
        function arrow(cx, x, y, shaft, head, col) {
            sprRect(cx, x, y + (head >> 1) - 1, shaft, 3, col);
            for (var i = 0; i <= head >> 1; i++) sprRect(cx, x + shaft + i, y + i, 1, head - 2 * i, col);
        }
        function inv(cx, ix, iy, hy) { slots(cx, ix, iy, 9, 3); slots(cx, ix, hy, 9, 1); }
        // the flame's outline, for the unlit furnace
        var FLAME = ['......r.......', '.....ro.......', '.r...oy.....r.', '.ro..oy....ro.', '.oy.ryyo...oy.', '.oyyowyor.ryo.', '.oywwwyyoooyo.',
                     'ryywwwwyyyyyor', 'oywwwwwwwwyyyo', 'oywwwwwwwwwyyo', 'oyywwwwwwwwyyo', '.oyywwwwwwyyo.', '..ooyyyyyyoo..', '...oooooooo...'];
        function flameEdge(cx, ox, oy, col) {
            for (var y = 0; y < 14; y++) for (var x = 0; x < 14; x++) {
                if (FLAME[y].charAt(x) === '.') continue;
                var edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var yy = y + d[1], xx = x + d[0]; return yy < 0 || yy > 13 || xx < 0 || xx > 13 || FLAME[yy].charAt(xx) === '.'; });
                if (edge) px(cx, ox + x, oy + y, col);
            }
        }
        // empty-slot silhouettes: a 1-pixel #555555 outline, nothing inside
        var EMPTY = {
            helmet: ['', '', '', '....oooooooo....', '...o........o...', '...o........o...', '...o..oooo..o...', '...o..o..o..o...', '...o..o..o..o...', '...oooo..oooo...'],
            chest: ['', '', '.ooo........ooo.', '.o..oo....oo..o.', '.o...oooooo...o.', '.o............o.', '.oo..........oo.', '..o..........o..', '..o..........o..',
                    '..o..........o..', '..o..........o..', '..o..........o..', '..o..........o..', '..o..........o..', '..oooooooooooo..'],
            legs: ['', '', '...oooooooooo...', '...o........o...', '...o........o...', '...o...oo...o...', '...o..o..o..o...', '...o..o..o..o...', '...o..o..o..o...',
                   '...o..o..o..o...', '...o..o..o..o...', '...o..o..o..o...', '...oooo..oooo...'],
            boots: ['', '', '', '', '', '', '', '..oooo....oooo..', '..o..o....o..o..', '..o..o....o..o..', '..o..o....o..o..', '.o...o....o...o.', 'o....o....o....o', 'oooooo....oooooo'],
            shield: ['', '.oooooooooooooo.', '.o............o.', '.o............o.', '.o............o.', '.o............o.', '.o............o.', '.o............o.',
                     '..o..........o..', '..o..........o..', '...o........o...', '....o......o....', '.....o....o.....', '......oooo......'],
            lapis: ['', '', '......oooo......', '....oo....oo....', '...o........o...', '..o..........o..', '..o..........o..', '.o............o.', '..o..........o..',
                    '..o..........o..', '...o........o...', '....oo....oo....', '......oooo......']
        };
        for (var ek in EMPTY) (function (rows) { mk('e_' + ek, 16, 16, function (cx) { sprMap(cx, rows, { o: D }); }); })(EMPTY[ek]);

        // the survival inventory, 176x166
        mk('p_inv', 176, 166, function (cx) {
            frame(cx, 176, 166);
            for (var i = 0; i < 4; i++) slot(cx, 7, 7 + 18 * i);
            slot(cx, 25, 7, 51, 72, K);                // the player's box: a black well in the same bevel
            slot(cx, 76, 61);                          // off hand
            slots(cx, 98, 18, 2, 2);
            arrow(cx, 135, 29, 9, 13, W8);
            slot(cx, 153, 27);
            inv(cx, 8, 84, 142);
        });
        mk('p_table', 176, 166, function (cx) {
            frame(cx, 176, 166);
            slots(cx, 30, 17, 3, 3);
            arrow(cx, 90, 35, 14, 15, W8);
            slot(cx, 119, 30, 26, 26);
            inv(cx, 8, 84, 142);
        });
        mk('p_furn', 176, 166, function (cx) {
            frame(cx, 176, 166);
            slot(cx, 55, 16); slot(cx, 55, 52);
            flameEdge(cx, 56, 36, W8);
            arrow(cx, 80, 35, 14, 15, W8);
            slot(cx, 111, 30, 26, 26);
            inv(cx, 8, 84, 142);
        });
        mk('p_chest', 176, 167, function (cx) {   // 168 tall as a screen; the texture stops a row short
            frame(cx, 176, 167);
            slots(cx, 8, 18, 9, 3);
            inv(cx, 8, 85, 143);
        });
        mk('p_ench', 176, 166, function (cx) {
            frame(cx, 176, 166);
            slot(cx, 14, 46); slot(cx, 34, 46);
            // the recess the three options sit in: dark top, white right and bottom, and no left edge at all
            sprRect(cx, 59, 13, 109, 1, SD); sprRect(cx, 168, 14, 1, 58, L); sprRect(cx, 60, 71, 109, 1, L);
            for (var o = 0; o < 3; o++) { sprRect(cx, 59, 14 + 19 * o, 1, 18, '#6b614c'); sprRect(cx, 59, 32 + 19 * o, 1, 1, '#544c3b'); }
            inv(cx, 8, 84, 142);
        });
        mk('p_anvil', 176, 166, function (cx) {
            frame(cx, 176, 166);
            // the hammer, drawn at 2x like the game's: steel head top right, the handle running off bottom left
            var HAM = ['..........HH...', '.........HhhH..', '........HhhhhH.', '.......HhhhhhhH', '......Hsshhhh.H', '.....HHsssshH..', '....HwwHsssH...',
                       '...HwwH.HsH....', '..HwwH...H.....', '.HwwH..........', 'HwwH...........', 'HwH............', 'HH.............'];
            var HP = { H: '#181818', h: '#ffffff', s: '#c1c1c1', w: '#896727' };
            for (var y = 0; y < HAM.length; y++) for (var x = 0; x < 15; x++) { var c = HP[HAM[y].charAt(x)]; if (c) sprRect(cx, 17 + x * 2, 7 + (y + 1) * 2, 2, 2, c); }
            slot(cx, 26, 46); slot(cx, 75, 46);
            sprRect(cx, 58, 49, 3, 13, W8); sprRect(cx, 53, 54, 13, 3, W8);   // the plus
            arrow(cx, 102, 48, 14, 15, W8);
            slot(cx, 133, 46);
            inv(cx, 8, 84, 142);
        });
        function crPanel(extra) {
            return function (cx) {
                frame(cx, 195, 136);
                slots(cx, 9, 18, 9, 5); slots(cx, 9, 112, 9, 1);
                slot(cx, 174, 17, 14, 112);            // the scroll track
                if (extra) extra(cx);
            };
        }
        mk('p_cr_items', 195, 136, crPanel());
        mk('p_cr_search', 195, 136, crPanel(function (cx) { slot(cx, 80, 4, 90, 12, W8, D); }));
        mk('p_cr_inv', 195, 136, function (cx) {
            frame(cx, 195, 136);
            slot(cx, 53, 5); slot(cx, 53, 32); slot(cx, 107, 5); slot(cx, 107, 32);
            slot(cx, 34, 19);
            slot(cx, 72, 5, 34, 45, K);
            slots(cx, 9, 54, 9, 3); slots(cx, 9, 112, 9, 1);
            slot(cx, 172, 111, 18, 18, '#ab7f7f');     // Destroy Item: the rose well with a dark X
            for (var d = 0; d < 11; d++) { sprRect(cx, 175 + d, 114 + d, 2, 1, '#1f1f1f'); sprRect(cx, 185 - d, 114 + d, 2, 1, '#1f1f1f'); }
        });

        // the furnace's lit flame, 14x14 on the panel's grey, and its progress arrow, 24x16
        mk('flame', 14, 14, function (cx) {
            sprRect(cx, 0, 0, 14, 14, F);
            sprMap(cx, FLAME, { r: '#d84c45', o: '#ffb600', y: '#ffff1f', w: '#ffffff' });
            for (var y = 0; y < 14; y++) for (var x = 13; x >= 0; x--) if (FLAME[y].charAt(x) !== '.') { px(cx, x, y, W8); break; }   // the shade down each right side
        });
        // drawn over the panel's grey arrow at (79, 34), so its own arrow sits one row and column in
        mk('burn', 24, 16, function (cx) {
            sprRect(cx, 0, 0, 24, 16, F);
            arrow(cx, 1, 1, 14, 15, '#ffffff');
            sprRect(cx, 1, 9, 14, 1, '#d8d8d8');
            for (var i = 0; i < 8; i++) px(cx, 15 + i, 15 - i, '#d8d8d8');
        });
        /* the hotbar's off-hand cell: one 22-pixel cell of the bar's own frame, a row
           down in a 29x24 sprite drawn at (W/2 - 120, H - 23) */
        mk('hotbar_off', 29, 24, function (cx) {
            var hb = GSPR.hotbar && GSPR.hotbar.cv;
            if (hb) { cx.drawImage(hb, 0, 0, 21, 22, 0, 1, 21, 22); cx.drawImage(hb, 181, 0, 1, 22, 21, 1, 1, 22); }
        });
        // the enchanting table's three option plates
        function plate(face, lite, dark, dis) {
            return function (cx) {
                sprRect(cx, 0, 0, 108, 19, face);
                if (dis) { sprRect(cx, 0, 0, 107, 1, lite); sprRect(cx, 0, 0, 1, 18, lite); sprRect(cx, 0, 18, 108, 1, dark); sprRect(cx, 107, 0, 1, 19, dark); }
                else { sprRect(cx, 0, 0, 107, 1, lite); sprRect(cx, 0, 0, 1, 18, lite); sprRect(cx, 1, 18, 107, 1, dark); sprRect(cx, 107, 1, 1, 18, dark); }
            };
        }
        mk('ench_n', 108, 19, plate('#a09172', '#e0ca9f', '#544c3b'));
        mk('ench_h', 108, 19, plate('#b688ae', '#fab9ef', '#654c61'));
        mk('ench_d', 108, 19, plate('#51493a', '#211d17', '#332e24', true));
        // the lapis cost orbs, 1 2 3, bright and dull
        function orb(n, dull) {
            return function (cx) {
                var rim = dull ? '#8a8a6a' : '#d8e45a', hi = dull ? '#b4b49a' : '#f5ff8f', body = dull ? '#5e6a4a' : '#6fb02a', swirl = dull ? '#7a8a60' : '#a4e04a';
                var ol = dull ? '#47352f' : '#2d2102';
                for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
                    var dx = x - 7.5, dy = y - 7, r = Math.sqrt(dx * dx + dy * dy);
                    if (r > 6.4) continue;
                    px(cx, x, y, r > 5.5 ? ol : r > 4.6 ? (dx + dy < 0 ? hi : rim) : (dx < -1 && (x + y) % 3 === 0 ? swirl : body));
                }
                var g = mfBuild().g[String(n)], dig = dull ? '#8c605d' : '#c8ff8f';
                for (var gy = 0; gy < 7; gy++) for (var gx = 0; gx < g.w; gx++) if ((g.rows[gy] || '').charAt(gx) === '#') { px(cx, 8 + gx - 1, 4 + gy, ol); }
                for (gy = 0; gy < 7; gy++) for (gx = 0; gx < g.w; gx++) if ((g.rows[gy] || '').charAt(gx) === '#') px(cx, 7 + gx - 1, 3 + gy, dig);
            };
        }
        for (var ln = 1; ln <= 3; ln++) { mk('lvl_' + ln, 16, 16, orb(ln, false)); mk('lvl_' + ln + 'd', 16, 16, orb(ln, true)); }
        // the anvil's name plate: a slot-style inset round a raised tan field
        function field(face, lite, dark) {
            return function (cx) {
                slot(cx, 0, 0, 110, 16, face);
                px(cx, 109, 0, F); px(cx, 0, 15, F);
                sprRect(cx, 1, 1, 107, 1, lite); sprRect(cx, 1, 1, 1, 13, lite);
                sprRect(cx, 2, 14, 107, 1, dark); sprRect(cx, 108, 2, 1, 13, dark);
            };
        }
        mk('anvil_tf', 110, 16, field('#a09172', '#e0ca9f', '#544c3b'));
        mk('anvil_tfd', 110, 16, field('#4e4737', '#6d634d', '#29251c'));
        mk('anvil_err', 28, 21, function (cx) {
            sprRect(cx, 0, 0, 28, 21, F);
            arrow(cx, 3, 3, 14, 15, W8);
            for (var i = 0; i < 15; i++) {
                sprRect(cx, 6 + i, 3 + i, 1, 1, '#962300'); sprRect(cx, 7 + i, 3 + i, 1, 1, '#ba370f'); sprRect(cx, 8 + i, 3 + i, 1, 1, '#962300');
                sprRect(cx, 20 - i, 3 + i, 1, 1, '#962300'); sprRect(cx, 19 - i, 3 + i, 1, 1, '#ba370f'); sprRect(cx, 18 - i, 3 + i, 1, 1, '#962300');
            }
        });
        // creative tabs, 26x32: the unselected ones stand 26 above (or 24 below) the panel in #8B8B8B;
        // the selected one is panel-coloured and runs four rows into the panel to merge with it
        function tabBody(cx, y0, rows, fill) {
            sprRect(cx, 2, y0, 21, 1, K);
            px(cx, 1, y0 + 1, K); sprRect(cx, 2, y0 + 1, 21, 1, L); px(cx, 23, y0 + 1, K);
            px(cx, 0, y0 + 2, K); sprRect(cx, 1, y0 + 2, 22, 1, L); px(cx, 23, y0 + 2, fill); px(cx, 24, y0 + 2, K);
            for (var y = y0 + 3; y < y0 + rows; y++) {
                px(cx, 0, y, K); sprRect(cx, 1, y, 2, 1, L); sprRect(cx, 3, y, 20, 1, fill); sprRect(cx, 23, y, 2, 1, D); px(cx, 25, y, K);
            }
            px(cx, 3, y0 + 3, L);
        }
        mk('tab_t_un', 26, 32, function (cx) { tabBody(cx, 2, 30, W8); });
        function tabTopSel(variant) {
            return function (cx) {
                tabBody(cx, 0, 29, F);
                var r29, r30, r31;
                if (variant === 1) { r29 = 'KLLFD'; }
                // rows 29-31, where the tab meets the panel: left edge, right edge
                for (var y = 29; y < 32; y++) {
                    sprRect(cx, 3, y, 20, 1, F);
                    if (variant === 1) { px(cx, 0, y, K); sprRect(cx, 1, y, 2, 1, L); }
                    else sprRect(cx, 0, y, 3, 1, y < 31 ? L : F);
                    if (variant === 7) { sprRect(cx, 23, y, 2, 1, D); px(cx, 25, y, K); }
                    else if (y === 29) { sprRect(cx, 23, y, 2, 1, D); px(cx, 25, y, L); }
                    else if (y === 30) { px(cx, 23, y, D); sprRect(cx, 24, y, 2, 1, L); }
                    else sprRect(cx, 23, y, 3, 1, F);
                }
                if (variant === 1) { px(cx, 0, 31, K); sprRect(cx, 1, 31, 2, 1, L); }
            };
        }
        mk('tab_t_s1', 26, 32, tabTopSel(1)); mk('tab_t_sm', 26, 32, tabTopSel(2)); mk('tab_t_s7', 26, 32, tabTopSel(7));
        function tabBottom(cx, rows, fill, y0) {   // rows of body starting at y0, then the rounded foot
            for (var y = y0; y < y0 + rows; y++) {
                px(cx, 0, y, K); sprRect(cx, 1, y, 2, 1, L); sprRect(cx, 3, y, 20, 1, fill); sprRect(cx, 23, y, 2, 1, D); px(cx, 25, y, K);
            }
            var f = y0 + rows;
            px(cx, 1, f, K); px(cx, 2, f, fill); sprRect(cx, 3, f, 22, 1, D); px(cx, 25, f, K);
            px(cx, 2, f + 1, K); sprRect(cx, 3, f + 1, 21, 1, D); px(cx, 24, f + 1, K);
            sprRect(cx, 3, f + 2, 21, 1, K);
        }
        mk('tab_b_un', 26, 32, function (cx) { tabBottom(cx, 25, W8, 0); });
        function tabBotSel(variant) {
            return function (cx) {
                tabBottom(cx, 29, F, 0);
                if (variant === 1) { sprRect(cx, 3, 0, 23, 1, F); sprRect(cx, 23, 1, 3, 2, D); }
                else if (variant === 7) { sprRect(cx, 0, 0, 23, 1, F); sprRect(cx, 0, 1, 2, 1, D); px(cx, 2, 1, L); px(cx, 0, 2, D); }
                else { sprRect(cx, 0, 0, 26, 1, F); sprRect(cx, 0, 1, 2, 1, D); px(cx, 2, 1, L); px(cx, 0, 2, D); sprRect(cx, 23, 1, 3, 2, D); }
            };
        }
        mk('tab_b_s1', 26, 32, tabBotSel(1)); mk('tab_b_sm', 26, 32, tabBotSel(2)); mk('tab_b_s7', 26, 32, tabBotSel(7));
        function scroller(fill, grip) {
            return function (cx) {
                sprRect(cx, 0, 0, 12, 15, fill);
                sprRect(cx, 0, 0, 11, 1, L); sprRect(cx, 0, 1, 1, 13, L); px(cx, 11, 0, W8);
                sprRect(cx, 11, 1, 1, 14, D); sprRect(cx, 1, 14, 11, 1, D); px(cx, 0, 14, W8);
                for (var g = 2; g <= 12; g += 2) sprRect(cx, 2, g, 8, 1, grip);
            };
        }
        mk('scroller', 12, 15, scroller(F, W8));
        mk('scroller_d', 12, 15, scroller(W8, D));
        // the recipe-book button: a small raised panel with a green book on it, blue-grey when hovered
        function rbook(edge, face, shade) {
            return function (cx) {
                sprRect(cx, 1, 1, 18, 16, face);
                sprRect(cx, 2, 0, 16, 1, edge); sprRect(cx, 2, 17, 16, 1, edge); sprRect(cx, 0, 2, 1, 14, edge); sprRect(cx, 19, 2, 1, 14, edge);
                [[1, 1], [18, 1], [1, 16], [18, 16]].forEach(function (p) { px(cx, p[0], p[1], edge); });
                sprRect(cx, 2, 1, 16, 1, L); sprRect(cx, 1, 2, 1, 14, L);
                sprRect(cx, 18, 2, 1, 14, shade); sprRect(cx, 2, 16, 16, 1, shade);
                var BOOK = ['......gggg..', '....ggGGGGg.', '..ggGGGGGGGg', 'ggGGGGGGGGgp', 'gGGGGGGGGgpp', 'gGGGGGGGgppd', 'gGGGGGGgppd.', '.gGGGGgppd..', '..gGGgppd...', '...ggppd....', '....dd......'];
                sprMap(cx, BOOK, { g: '#1b361b', G: '#478e47', p: '#d6d6d6', d: '#999999' }, 4, 3);
            };
        }
        mk('rbook', 20, 18, rbook(K, F, D));
        mk('rbook_h', 20, 18, rbook('#00073e', '#8892c9', '#343e75'));
        /* the recipe book: its page is the panel's own frame at 147x166; the tabs
           down its left side are the creative tabs turned on their side, #8B8B8B
           and stopping at the book's edge, or panel grey and running into it when
           selected; 25x25 recipe buttons, grey for what you can make and red for
           what you cannot; the 26x16 switch, pressed in with its picture lit while
           it shows only what you can make; the 12x17 page arrows */
        mk('rb_bg', 147, 166, function (cx) { frame(cx, 147, 166); });
        function rbTab(sel) {
            return function (cx) {
                var end = sel ? 35 : 30, fill = sel ? F : W8;
                sprRect(cx, 1, 1, end - 1, 25, fill);
                sprRect(cx, 2, 0, end - 2, 1, K); sprRect(cx, 2, 26, end - 2, 1, K); sprRect(cx, 0, 2, 1, 23, K);
                px(cx, 1, 1, K); px(cx, 1, 25, K);
                sprRect(cx, 2, 1, end - 2, 2, L); sprRect(cx, 1, 2, 2, 22, L);
                sprRect(cx, 3, 24, end - 3, 2, D); px(cx, 2, 25, D);
                if (sel) {   // where it opens into the book: the book's white edge turns along the tab's
                    sprRect(cx, 32, 3, 3, 21, F);
                    sprRect(cx, 33, 0, 2, 3, L); sprRect(cx, 33, 24, 2, 3, L);
                }
            };
        }
        mk('rb_tab', 35, 27, rbTab(false)); mk('rb_tab_s', 35, 27, rbTab(true));
        function rbSlot(face, lite, dark) {
            return function (cx) {
                sprRect(cx, 1, 1, 23, 23, face);
                sprRect(cx, 1, 0, 23, 1, K); sprRect(cx, 1, 24, 23, 1, K); sprRect(cx, 0, 1, 1, 23, K); sprRect(cx, 24, 1, 1, 23, K);
                sprRect(cx, 1, 1, 22, 1, lite); sprRect(cx, 1, 2, 1, 21, lite);
                sprRect(cx, 2, 23, 22, 1, dark); sprRect(cx, 23, 2, 1, 21, dark);
            };
        }
        mk('rb_ok', 25, 25, rbSlot('#9d9d9d', '#d8d8d8', '#5b5b5b'));
        mk('rb_no', 25, 25, rbSlot('#b26363', '#e59a9a', '#6b2c2c'));
        var RB_FLAME = ['...o....', '..oy....', '..oyo.o.', '.oyyo.oy', '.oyyyoyy', 'oyywyyyo', 'oywwwyyo', '.oyyyyo.'];
        function rbFilter(on, hi, fur) {
            return function (cx) {
                var e = hi ? L : K;
                sprRect(cx, 1, 0, 24, 1, e); sprRect(cx, 1, 15, 24, 1, e); sprRect(cx, 0, 1, 1, 14, e); sprRect(cx, 25, 1, 1, 14, e);
                sprRect(cx, 1, 1, 24, 14, on ? '#7c7c7c' : W8);
                sprRect(cx, 1, 1, 24, 1, on ? D : L); sprRect(cx, 1, 2, 1, 13, on ? D : L);
                sprRect(cx, 2, 14, 23, 1, on ? L : D); sprRect(cx, 24, 2, 1, 12, on ? L : D);
                if (fur) sprMap(cx, RB_FLAME, on ? { o: '#c43c00', y: '#ff9a00', w: '#fff27a' } : { o: '#4a4a4a', y: '#6e6e6e', w: '#a0a0a0' }, 9, 4);
                else for (var gy = 0; gy < 3; gy++) for (var gx = 0; gx < 3; gx++) sprRect(cx, 8 + gx * 4, 2 + gy * 4, 3, 3, on ? '#46b446' : '#6e6e6e');
            };
        }
        [['rb_f', false], ['rb_ff', true]].forEach(function (v) {
            mk(v[0] + '0', 26, 16, rbFilter(false, false, v[1])); mk(v[0] + '0h', 26, 16, rbFilter(false, true, v[1]));
            mk(v[0] + '1', 26, 16, rbFilter(true, false, v[1])); mk(v[0] + '1h', 26, 16, rbFilter(true, true, v[1]));
        });
        function rbArrow(right, c) {
            return function (cx) {
                for (var i = 0; i < 9; i++) {
                    var h = 17 - 2 * i, x = right ? 1 + i : 10 - i;
                    sprRect(cx, x, i, 1, h, SD);
                    if (h > 2) sprRect(cx, x, i + 1, 1, h - 2, c);
                }
                sprRect(cx, right ? 0 : 11, 0, 1, 17, SD);
            };
        }
        mk('rb_next', 12, 17, rbArrow(true, '#c6c6c6')); mk('rb_nexth', 12, 17, rbArrow(true, '#ffffff'));
        mk('rb_prev', 12, 17, rbArrow(false, '#c6c6c6')); mk('rb_prevh', 12, 17, rbArrow(false, '#ffffff'));
        // the recipe toast's white card
        mk('toast_rc', 160, 32, function (cx) {
            sprRect(cx, 2, 0, 156, 1, K); sprRect(cx, 2, 31, 156, 1, K); sprRect(cx, 0, 2, 1, 28, K); sprRect(cx, 159, 2, 1, 28, K);
            px(cx, 1, 1, K); px(cx, 158, 1, K); px(cx, 1, 30, K); px(cx, 158, 30, K);
            sprRect(cx, 2, 1, 156, 30, '#f2f2f2'); sprRect(cx, 1, 2, 158, 28, '#f2f2f2');
            sprRect(cx, 2, 1, 156, 1, L); sprRect(cx, 1, 2, 1, 28, L);
            sprRect(cx, 2, 30, 156, 1, '#b4b4b4'); sprRect(cx, 158, 2, 1, 28, '#b4b4b4');
        });
    }
    /* ── the recipe book ─────────────────────────────────────────
       RecipeBookComponent, beside the inventory, the crafting table and the
       furnace. The green book opens a 147x166 page at ((W - 147) / 2 - 86,
       (H - 166) / 2) and the container slides right to 177 + (W - w - 200) / 2
       to make room; on a screen under 379 wide the page is centred and the
       container hidden until a recipe is picked or Esc closes the book.
       On the page: the search box at (25, 13), the switch at (110, 12) that
       shows only what you can make, the category tabs down the left edge
       (35x27, 27 apart, only those holding a recipe you know), and twenty
       recipes a page, five across from (11, 31) at 25 apart, with arrows and
       "1/3" under them. A recipe you can make fills the grid (shift for as
       many as you have for, a second click for one more each); one you cannot
       is laid out as a ghost. Recipes are learned the way the game's recipe
       advancements teach them, from an ingredient in your inventory, and a
       toast says so; each new one pops once, with its tab, the first time the
       book shows it. Open or shut, and the switch, are the world's: one pair
       for crafting, one for the furnace. */
    var RB_TABS = {
        craft: [{ id: 'search', ic: ['compass'] }, { id: 'equip', ic: ['iron_axe', 'gold_sword'] }, { id: 'build', ic: ['bricks'] },
                { id: 'misc', ic: ['lava_bucket', 'apple'] }, { id: 'red', ic: ['redstone'] }],
        furnace: [{ id: 'search', ic: ['compass'] }, { id: 'food', ic: ['pork_raw'] }, { id: 'blocks', ic: ['stone'] }, { id: 'misc', ic: ['lava_bucket', 'emerald'] }]
    };
    var RB_SEARCH = { craft: ['equip', 'build', 'misc', 'red'], furnace: ['food', 'blocks', 'misc'] };   // SearchRecipeBookCategory's order
    // each recipe's category as its recipe file files it; tools and armour are equipment, the rest misc
    var RB_CAT = { planks: 'build', wool: 'build', stonebrick: 'build', sandstone: 'build', bricks: 'build', bookshelf: 'build', melon: 'build',
                   tnt: 'red', rlamp: 'red', arrow: 'equip', bow: 'equip', flint_steel: 'equip' };
    var RB_ALL = null;
    function rbAll() {
        if (RB_ALL) return RB_ALL;
        var list = [];
        RECIPES.forEach(function (r) {
            // one recipe with a choice in it, the way the game writes the torch: coal or charcoal in the same cell
            for (var k = 0; k < list.length; k++) {
                var q = list[k], same = q.out === r.out && q.n === r.n && q.shape && r.shape && q.shape.length === r.shape.length && q.shape[0].length === r.shape[0].length;
                if (same) r.shape.forEach(function (row, y) { row.forEach(function (id, x) { if (!id !== !q.shape[y][x]) same = false; }); });
                if (!same) continue;
                r.shape.forEach(function (row, y) {
                    row.forEach(function (id, x) { var c = rbAlts(q.shape[y][x]); if (id && c.indexOf(id) < 0) q.shape[y][x] = c.concat([id]); });
                });
                return;
            }
            var d = I[r.out] || {};
            list.push({ key: 'c:' + r.out, book: 'craft', out: r.out, n: r.n, less: r.less ? r.less.slice() : null,
                shape: r.shape ? r.shape.map(function (row) { return row.slice(); }) : null, cat: RB_CAT[r.out] || (d.tool || d.armor ? 'equip' : 'misc') });
        });
        for (var inp in SMELTS) {
            var o = SMELTS[inp], od = I[o] || {};
            list.push({ key: 's:' + inp, book: 'furnace', out: o, n: 1, inp: inp, cat: od.food ? 'food' : od.place != null ? 'blocks' : 'misc' });
        }
        list.forEach(function (r) {   // what teaches it: any of its ingredients (the chest waits for ten filled slots, as its advancement does)
            var t = {};
            rbCellsOf(r, 3).forEach(function (c) { rbAlts(c[1]).forEach(function (id) { t[id] = 1; }); });
            r.trig = r.out === 'chest' ? null : Object.keys(t);
        });
        return (RB_ALL = list);
    }
    function rbAlts(c) { return Array.isArray(c) ? c : [c]; }
    function rbId(r) { return r.inp ? r.out + '_from_smelting_' + r.inp : r.out; }   // what /recipe calls it
    function rbKind() { var k = RT && RT.panel && RT.panel.kind; return k === 'inv' || k === 'table' ? 'craft' : k === 'furnace' ? 'furnace' : null; }
    function rbState() {
        var k = rbKind();
        if (!k) return null;
        S.rb = S.rb || {};
        return S.rb[k] || (S.rb[k] = { open: false, filter: false });
    }
    function rbShown() { var st = rbState(); return !!(st && st.open && RT.el.querySelector('.mc-panelwrap .mc-rb')); }
    function rbNarrow() { return RT.gw < 379; }
    function rbKnown() {
        var m = RT.rbKnown;
        if (!m || m.src !== S.rbk) { m = RT.rbKnown = { src: S.rbk }; S.rbk.forEach(function (k) { m[k] = 1; }); }
        return m;
    }
    // a stack the book will use: not renamed, enchanted or worn (Inventory.isUsableForCrafting)
    function rbPlain(st) {
        var m = st ? itemMaxDur(st.id) : null;
        return !!st && !st.name && !(st.ench && Object.keys(st.ench).length) && !(st.dur != null && m != null && st.dur < m);
    }
    /* StackedItemContents: what it could be made from, the inventory's plain
       stacks and what the grid (or the furnace's input and output) holds already */
    function rbHave(id) {
        var n = 0, i, k = rbKind();
        for (i = 0; i < 36; i++) if (S.inv[i] && S.inv[i].id === id && rbPlain(S.inv[i])) n += S.inv[i].c;
        if (k === 'craft') for (i = 0; i < 9; i++) if (RT.craft[i] && RT.craft[i].id === id && rbPlain(RT.craft[i])) n += RT.craft[i].c;
        if (k === 'furnace') { var t = S.tents[RT.panel.key]; if (t) [t.fin, t.out].forEach(function (s) { if (s && s.id === id && rbPlain(s)) n += s.c; }); }
        return n;
    }
    function rbTake(id, n) {   // out of the inventory in slot order, the off hand last
        for (var i = 0; i <= 36 && n > 0; i++) {
            var st = i < 36 ? S.inv[i] : S.off;
            if (!st || st.id !== id || !rbPlain(st)) continue;
            var k = Math.min(n, st.c);
            st.c -= k; n -= k;
            if (!st.c) { if (i < 36) S.inv[i] = null; else S.off = null; }
        }
    }
    // PlaceRecipeHelper: a recipe under half the grid's width or height is centred on that axis
    function rbCellsOf(r, w) {
        if (r.inp) return [[0, r.inp]];
        var out = [];
        if (r.less) { r.less.forEach(function (id, k) { out.push([k, id]); }); return out; }
        var rh = r.shape.length, rw = r.shape[0].length;
        var ox = rw < w / 2 ? Math.floor(w / 2 - rw / 2) : 0, oy = rh < w / 2 ? Math.floor(w / 2 - rh / 2) : 0;
        r.shape.forEach(function (row, y) { row.forEach(function (id, x) { if (id) out.push([(y + oy) * w + x + ox, id]); }); });
        return out;
    }
    function rbPick(r) {   // an item for every cell; of a choice, the one there is most of
        return rbCellsOf(r, r.inp ? 1 : RT.craftW).map(function (c) {
            var alts = rbAlts(c[1]), best = alts[0];
            alts.forEach(function (id) { if (rbHave(id) > rbHave(best)) best = id; });
            return [c[0], best];
        });
    }
    function rbMost(r) {   // getBiggestCraftableStack, clamped to the ingredients' stack size
        var need = {}, most = 64, k;
        rbPick(r).forEach(function (c) { need[c[1]] = (need[c[1]] || 0) + 1; });
        for (k in need) most = Math.min(most, Math.floor(rbHave(k) / need[k]), stkMax(k));
        return most;
    }
    function rbFits(r) { var w = RT.craftW; return !!r.inp || (r.less ? r.less.length <= w * w : r.shape.length <= w && r.shape[0].length <= w); }
    /* what the page lists: the tab's categories in the game's order, the recipes
       known and fitting this grid, matched against the search, and only the
       makeable ones while the switch is on */
    function rbList() {
        var kind = rbKind(), st = rbState(), v = RT.rbv, tab = RB_TABS[kind][v.tab].id, q = (v.q || '').trim().toLowerCase(), known = rbKnown(), out = [];
        (tab === 'search' ? RB_SEARCH[kind] : [tab]).forEach(function (cat) {
            rbAll().forEach(function (r) {
                if (r.book !== kind || r.cat !== cat || !known[r.key] || !rbFits(r)) return;
                if (q && itemName({ id: r.out, c: 1 }).toLowerCase().indexOf(q) < 0) return;
                var ok = rbMost(r) > 0;
                if (!st.filter || ok) out.push({ r: r, ok: ok });
            });
        });
        return out;
    }
    function rbTabsOn() {   // the search tab, then each category holding a recipe you know that fits
        var kind = rbKind(), known = rbKnown(), on = [];
        RB_TABS[kind].forEach(function (T, k) {
            if (!k || rbAll().some(function (r) { return r.book === kind && r.cat === T.id && known[r.key] && rbFits(r); })) on.push(k);
        });
        return on;
    }
    function rbTabsPop() {   // RecipeBookTabButton.startAnimation: a category with a recipe you have not been shown yet
        var kind = rbKind(), st = rbState(), now = performance.now();
        if (!S.rbNew) return;
        RT.rbPopT = RT.rbPopT || {};
        RB_TABS[kind].forEach(function (T, k) {
            if (k && rbAll().some(function (r) { return r.book === kind && r.cat === T.id && S.rbNew[r.key] && rbFits(r) && (!st.filter || rbMost(r) > 0); })) RT.rbPopT['t:' + T.id] = now;
        });
    }
    function rbPaint() {
        var el = RT.el.querySelector('.mc-panelwrap .mc-rb');
        if (!el || !RT.rbv) return;
        var kind = rbKind(), st = rbState(), v = RT.rbv, on = rbTabsOn(), now = performance.now(), pops = RT.rbPopT = RT.rbPopT || {};
        if (on.indexOf(v.tab) < 0) { v.tab = 0; v.page = 0; }
        function pop(id) { return pops[id] && now - pops[id] < 750 ? ' data-pop="' + pops[id] + '"' : ''; }
        var tabs = '';
        on.forEach(function (k, n) {
            var T = RB_TABS[kind][k], sel = k === v.tab;   // the selected tab is drawn two pixels further out
            tabs += '<button class="mc-rbtab' + (sel ? ' on' : '') + '" type="button" data-rbt="' + k + '"' + pop('t:' + T.id) + ' style="' + iwAt(sel ? -32 : -30, 3 + 27 * n, 35, 27) + '">' +
                T.ic.map(function (ic, j) { return '<i style="' + pAt(T.ic.length === 1 ? 9 : j ? 14 : 3, 5) + ';background-image:url(' + iconURL(ic) + ')"></i>'; }).join('') + '</button>';
        });
        var list = RT.rbList = rbList(), pages = Math.ceil(list.length / 20), html = '';
        if (v.page >= pages) v.page = 0;   // RecipeBookPage.updateCollections: past the end is back to the start
        for (var k = 0; k < 20; k++) {
            var c = list[v.page * 20 + k];
            if (!c) break;
            if (S.rbNew && S.rbNew[c.r.key]) { delete S.rbNew[c.r.key]; pops['r:' + c.r.key] = now; }   // shown, so no longer new: it pops the once
            html += '<button class="mc-rbr" type="button" data-rbr="' + (v.page * 20 + k) + '"' + pop('r:' + c.r.key) + ' style="' + iwAt(11 + 25 * (k % 5), 31 + 25 * ((k / 5) | 0), 25, 25) +
                ';background-image:var(--spr-rb_' + (c.ok ? 'ok' : 'no') + ')"><i style="background-image:url(' + iconURL(c.r.out) + ')"></i></button>';
        }
        if (pages > 1) {
            if (v.page < pages - 1) html += '<button class="mc-rbarr next" type="button" data-rb="next" style="' + iwAt(93, 137, 12, 17) + '"></button>';
            if (v.page > 0) html += '<button class="mc-rbarr prev" type="button" data-rb="prev" style="' + iwAt(38, 137, 12, 17) + '"></button>';
            var pg = (v.page + 1) + '/' + pages;   // white, no shadow, centred on x 73
            html += iwText(pg, 73 - ((mfWidth(pg) + 1) >> 1), 141, '#ffffff', 'ns');
        }
        var te = el.querySelector('.mc-rbtabs'), pe = el.querySelector('.mc-rbpage'), fb = el.querySelector('.mc-rbfilter');
        if (te._html !== tabs) { te._html = tabs; te.innerHTML = tabs; }
        if (pe._html !== html) { pe._html = html; pe.innerHTML = html; }
        fb.classList.toggle('on', !!st.filter);
        fb.classList.toggle('fur', kind === 'furnace');
    }
    // open, shut, or brought up to date: the book lives beside the panel, not in it
    function rbSync() {
        var wrap = RT.el.querySelector('.mc-panelwrap'), st = rbState(), el = wrap && wrap.querySelector('.mc-rb');
        if (!wrap) return;
        if (!st || !st.open) { if (el) el.parentNode.removeChild(el); tipRender(null); return; }
        RT.rbv = RT.rbv || { tab: 0, page: 0, q: '' };
        if (!el) {
            el = document.createElement('div');
            el.className = 'mc-rb';
            el.innerHTML = '<i class="mc-rbbg"></i><div class="mc-rbtabs"></div>' +
                '<div class="mc-rbq" style="' + iwAt(25, 13, 81, 14) + '"><input class="mc-rbqin" maxlength="50" spellcheck="false" autocomplete="off" aria-label="Search">' +
                '<div class="mc-rbqmir mc-fmir"></div></div>' +
                '<button class="mc-rbfilter" type="button" data-rb="filter" style="' + iwAt(110, 12, 26, 16) + '"></button><div class="mc-rbpage"></div>';
            wrap.insertBefore(el, wrap.querySelector('.mc-cur'));
            var qi = el.querySelector('.mc-rbqin');
            qi.value = RT.rbv.q;
            qi.addEventListener('input', function () { RT.rbv.q = qi.value; rbPaint(); panelHoverRefresh(); });
            qi.addEventListener('keydown', function (e) {
                e.stopPropagation();   // the box owns the keyboard while it has it; Esc still gets you out
                if (e.key === 'Escape') { e.preventDefault(); qi.blur(); RT.el.focus(); rbEscape(); }
            });
            qi.addEventListener('keyup', function (e) { e.stopPropagation(); });
            qi.addEventListener('mousedown', function (e) { e.stopPropagation(); });
            qi.addEventListener('focus', function () { qi._ft = performance.now(); });
            rbTabsPop();
        }
        rbPaint();
    }
    function rbEscape() {   // RecipeBookComponent.keyPressed: Esc shuts a book that covers the screen, otherwise the screen
        if (rbShown() && rbNarrow()) rbToggle(false); else closePanel();
    }
    function rbToggle(on) {
        rbState().open = on;
        rbSync();
        RT.panel.gs = 0;   // the container moves: lay it out and paint it again
        panelLayout();
    }
    // every part of the book is a widget, so every press clicks; the left button only, the right as well on a recipe
    function rbAct(el, btn, shift) {
        var st = rbState(), v = RT.rbv;
        snd('click');
        if (el.classList.contains('mc-rbook')) { rbToggle(!st.open); return; }
        if (el.hasAttribute('data-rbr')) { if (btn === 0) rbClick(+el.getAttribute('data-rbr'), shift); return; }   // the right button lists a recipe's others; ours have none
        if (el.hasAttribute('data-rbt')) {
            var k = +el.getAttribute('data-rbt');
            if (k !== v.tab) { v.tab = k; v.page = 0; }
        } else {
            var a = el.getAttribute('data-rb');
            if (a === 'filter') st.filter = !st.filter;
            else if (a === 'next') v.page++;
            else if (a === 'prev') v.page = Math.max(0, v.page - 1);
        }
        rbPaint();
        panelHoverRefresh();
    }
    function rbTip(el) {
        if (el.classList.contains('mc-rbfilter')) return [{ t: rbState().filter ? (rbKind() === 'furnace' ? 'Showing Smeltable' : 'Showing Craftable') : 'Showing All' }];
        var c = RT.rbList && RT.rbList[+el.getAttribute('data-rbr')];
        return c ? itemTipLines({ id: c.r.out, c: c.r.n }, 'rb') : null;
    }
    /* ServerPlaceRecipe.clearGrid and the test before it: the grid goes back into
       the inventory, and in survival nothing happens if it would not all fit;
       creative drops what does not */
    function rbClearGrid(slots) {
        var snap = { inv: S.inv.map(function (s) { return s && Object.assign({}, s); }), off: S.off && Object.assign({}, S.off) }, lost = [];
        slots.forEach(function (sl) {
            var st = sl.get();
            if (!st) return;
            var left = invGive(st.id, st.c, st.dur, st.ench, st.name);
            if (left) lost.push({ id: st.id, c: left, dur: st.dur, ench: st.ench, name: st.name });
        });
        if (lost.length && !instaBuild()) { S.inv = snap.inv; S.off = snap.off; return false; }
        slots.forEach(function (sl) { sl.set(null); });
        lost.forEach(function (st) { dropItem(S.px, S.py + 1, S.pz, st.id, st.c, st.dur, false, st.ench, st.name); });
        return true;
    }
    function rbGridHolds(r) {   // the grid's stacks, if what is in it already makes this
        var m = matchRecipe(RT.craft, RT.craftW), out = [];
        if (!m || m.out !== r.out || m.n !== r.n) return null;
        for (var i = 0; i < 9; i++) if (RT.craft[i]) out.push(RT.craft[i]);
        return out;
    }
    /* a recipe clicked: RecipeBookComponent.tryPlaceRecipe and ServerPlaceRecipe.
       One of each, or with shift as many as you have for, up to a stack; a click
       on the recipe the grid already holds adds one more to every stack, if each
       has room. What you cannot make is laid out as a ghost. On a screen too
       narrow for both, the book then closes to show the grid. */
    function rbClick(idx, shift) {
        var c = RT.rbList && RT.rbList[idx];
        if (!c) return;
        var r = c.r, most = rbMost(r), t = r.inp ? S.tents[RT.panel.key] : null, grid = [], i;
        if (most < 1 && RT.rbGhost === r) return;   // already showing where it goes
        if (r.inp && !t) return;
        rbGhostSet(null);
        if (r.inp) grid = [{ get: function () { return t.fin; }, set: function (v) { t.fin = v; } }, { get: function () { return t.out; }, set: function (v) { t.out = v; } }];
        else for (i = 0; i < 9; i++) (function (i) { grid.push({ get: function () { return RT.craft[i]; }, set: function (v) { RT.craft[i] = v; } }); })(i);
        if (most < 1) { if (rbClearGrid(grid)) rbGhostSet(r); }
        else {
            var n = 1, inGrid = r.inp ? (t.fin && t.fin.id === r.inp ? [t.fin] : null) : rbGridHolds(r), full = false;
            if (shift) n = most;
            else if (inGrid) {
                n = 64;
                inGrid.forEach(function (s) { n = Math.min(n, s.c); if (Math.min(most, stkMax(s.id)) < s.c + 1) full = true; });
                n++;
            }
            var cells = rbPick(r);   // chosen while the grid still counts
            if (!full && rbClearGrid(grid)) cells.forEach(function (cl) {
                rbTake(cl[1], n);
                if (r.inp) t.fin = { id: cl[1], c: n }; else RT.craft[cl[0]] = { id: cl[1], c: n };
            });
        }
        paintPanel(); paintHotbar();
        if (rbNarrow()) rbToggle(false);
    }
    /* GhostSlots: each slot of the recipe washed out over 0x30FF0000 (24x24
       round a big result slot) with 0x30FFFFFF over the item's own pixels; a
       choice of ingredient, and the fuel, take turns every 30 ticks (held
       while Ctrl is down); the result shows its count. It stays until a
       crafting slot is clicked, even with the book shut. */
    function rbGhostSet(r) {
        RT.rbGhost = r;
        var wrap = RT.el.querySelector('.mc-panelwrap');
        if (wrap) rbGhostPaint(wrap);
    }
    function rbGhostHit(g) {
        if (RT.rbGhost && (g === 'craft' || g === 'cout' || g === 'fin' || g === 'ffuel' || g === 'fout')) rbGhostSet(null);
    }
    function rbFuels() { return RT.rbFuels || (RT.rbFuels = Object.keys(I).filter(function (id) { return I[id].fuel > 0; })); }
    function rbCycle() { return Math.floor((RT.rbTime || 0) / 30); }
    function rbGhostPaint(wrap) {
        var old = wrap.querySelectorAll('.mc-slot.ghost'), i;
        for (i = 0; i < old.length; i++) {
            old[i].classList.remove('ghost', 'gbig');
            var gi = old[i].querySelectorAll('.mc-ghost, .mc-gct');
            for (var j = 0; j < gi.length; j++) gi[j].parentNode.removeChild(gi[j]);
        }
        RT.rbGhostAt = {};
        var gh = RT.rbGhost;
        if (!gh || !RT.panel) return;
        var ix = rbCycle(), list;
        if (gh.inp) {
            var t = S.tents[RT.panel.key], fu = rbFuels();
            list = [['fin', 0, gh.inp], ['fout', 0, gh.out, gh.n]];
            if (t && !t.fuel && fu.length) list.push(['ffuel', 0, fu[ix % fu.length]]);
        } else {
            list = rbCellsOf(gh, RT.craftW).map(function (c) { var a = rbAlts(c[1]); return ['craft', c[0], a[ix % a.length]]; });
            list.push(['cout', 0, gh.out, gh.n]);
        }
        list.forEach(function (c) {
            var el = wrap.querySelector('.mc-slot[data-g="' + c[0] + '"][data-i="' + c[1] + '"]');
            if (!el) return;
            RT.rbGhostAt[c[0] + ':' + c[1]] = c[2];
            el.classList.add('ghost');
            if ((c[0] === 'cout' && RT.panel.kind === 'table') || c[0] === 'fout') el.classList.add('gbig');
            el.insertAdjacentHTML('beforeend', '<i class="mc-it mc-ghost" style="--ic:url(' + iconURL(c[2]) + ')"></i>' + (c[3] > 1 ? mtHTML(String(c[3]), null, 'mc-ct mc-gct') : ''));
        });
    }
    // per frame: the search box, the ghost's turns, and the pops
    function rbFrameTick(dt) {
        if (!rbKind()) return;
        var was = rbCycle(), wrap = RT.el.querySelector('.mc-panelwrap');
        if (!(RT.keys && RT.keys.control)) RT.rbTime = (RT.rbTime || 0) + dt * 20;
        if (RT.rbGhost && rbCycle() !== was && wrap) { rbGhostPaint(wrap); panelHoverRefresh(); }
        var el = wrap && wrap.querySelector('.mc-rb');
        if (!el) return;
        var qi = el.querySelector('.mc-rbqin');
        paintFieldMirror(qi, el.querySelector('.mc-rbqmir'), '#ffffff', 73, { t: 'Search...', c: '#aaaaaa', cls: 'it' });
        el.querySelector('.mc-rbq').classList.toggle('on', document.activeElement === qi);
        // a pop is 1 + 0.1 sin(pi t / 15) over fifteen ticks, a button all over, a tab only up and down
        var pops = el.querySelectorAll('[data-pop]'), now = performance.now();
        for (var i = 0; i < pops.length; i++) {
            var a = (now - +pops[i].getAttribute('data-pop')) / 750, f = a >= 1 ? 1 : 1 + 0.1 * Math.sin(Math.PI * (1 - Math.max(0, a)));
            var tf = f === 1 ? '' : pops[i].classList.contains('mc-rbtab') ? 'scaleY(' + f.toFixed(4) + ')' : 'scale(' + f.toFixed(4) + ')';
            if (pops[i].style.transform !== tf) pops[i].style.transform = tf;
        }
    }
    /* Learning: a recipe is yours once one of its ingredients is in your
       inventory (the chest once ten slots are filled), when you make it, or by
       /recipe. RecipeToast says so, one card for the lot. */
    function rbLearn(keys, quiet) {
        if (!S || !S.rbk || !keys.length) return 0;
        var fresh = keys.filter(function (k, n) { return S.rbk.indexOf(k) < 0 && keys.indexOf(k) === n; });
        if (!fresh.length) return 0;
        fresh.forEach(function (k) { S.rbk.push(k); });
        RT.rbKnown = null;
        if (quiet) return fresh.length;
        S.rbNew = S.rbNew || {};
        var all = rbAll();
        fresh.forEach(function (k) {
            S.rbNew[k] = 1;
            for (var i = 0; i < all.length; i++) if (all[i].key === k) { recipeToast(all[i].book === 'furnace' ? 'furnace' : 'table', all[i].out); break; }
        });
        if (RT.panel && rbShown()) { rbTabsPop(); rbPaint(); }
        return fresh.length;
    }
    function rbScan() {
        if (!S || !S.rbk || !RT || !RT.ready || RT.menu) return;
        var have = {}, used = 0;
        [].concat(S.inv.slice(0, 36), S.armor || [], [S.off]).forEach(function (st) { if (st) { have[st.id] = 1; used++; } });
        var sig = Object.keys(have).sort().join() + (used >= 10 ? '+' : '');
        if (sig === RT.rbSig) return;
        RT.rbSig = sig;
        var learn = [];
        rbAll().forEach(function (r) { if (r.trig ? r.trig.some(function (id) { return have[id]; }) : used >= 10) learn.push(r.key); });
        var quiet = !!S.rbQuiet;
        delete S.rbQuiet;
        rbLearn(learn, quiet);
    }
    /* RecipeToast.addOrUpdate: a recipe toast still up takes the new one and
       starts its five seconds over; otherwise a new card */
    function recipeToast(cat, out) {
        var all = (RT.toasts || []).concat(RT.toastQ || []);
        for (var i = 0; i < all.length; i++) {
            var t = all[i];
            if (t.kind !== 'recipe' || t.age > TOAST_SLIDE + TOAST_HOLD) continue;
            t.items.push([cat, out]);
            if (t.age > TOAST_SLIDE) t.age = TOAST_SLIDE;
            return;
        }
        toastPush({ kind: 'recipe', items: [[cat, out]] });
    }

    /* Where a screen goes: centred on the scaled screen with the game's integer
       arithmetic, leftPos = (W - imageWidth) div 2, topPos = (H - imageHeight) div 2.
       Positions inside it are the game's own slot and label coordinates. */
    var PANEL_DIM = { inv: [176, 166], table: [176, 166], furnace: [176, 166], chest: [176, 168], ench: [176, 166], anvil: [176, 166], creative: [195, 136] };
    function panelLayout() {
        if (!RT || !RT.panel || !RT.gs) return;
        var wrap = RT.el.querySelector('.mc-panelwrap'), p = wrap && wrap.querySelector('.mc-panel');
        if (!p) return;
        var d = PANEL_DIM[RT.panel.kind] || [176, 166], rb = wrap.querySelector('.mc-rb'), narrow = rbNarrow();
        /* RecipeBookComponent.updateScreenPosition: with the book open the screen
           moves right to 177 + (W - w - 200) / 2 and the book sits at
           (W - 147) / 2 - 86; too narrow for both, the book is centred and the
           screen behind it hidden */
        RT.panel.lx = rb && !narrow ? 177 + ((RT.gw - d[0] - 200) >> 1) : (RT.gw - d[0]) >> 1;
        RT.panel.ly = (RT.gh - d[1]) >> 1;
        hudPlace(p, RT.panel.lx, RT.panel.ly);
        p.style.display = rb && narrow ? 'none' : '';
        if (rb) hudPlace(rb, ((RT.gw - 147) >> 1) - (narrow ? 0 : 86), (RT.gh - 166) >> 1);
        // a new GUI scale means new icons (they are baked per scale) and a new box for the figure
        if (RT.panel.gs !== RT.gs) { RT.panel.gs = RT.gs; if (RT.av) avatarAttach(); paintPanel(); }
        panelCurTo();
    }
    /* the markup a screen opens with: the panel at its real size, the carried stack, the tooltip */
    function panelMarkup(kind) {
        var d = PANEL_DIM[kind] || [176, 166];
        return '<div class="mc-panel' + (kind === 'creative' ? ' mc-cpanel' : '') + '" data-k="' + kind + '" style="width:calc(var(--px) * ' + d[0] + ');height:calc(var(--px) * ' + d[1] + ')">' +
            panelHTML(kind) + '</div><div class="mc-cur"></div><div class="mc-ptip"></div>';
    }

    /* ── panels ─────────────────────────────────────────────── */
    function slotGroup(g) {
        var t;
        if (g === 'inv') return { get: function (i) { return S.inv[i]; }, set: function (i, v) { S.inv[i] = v; } };
        // the creative catalogue: reads out of the item list, writes nowhere
        if (g === 'creat') return { get: function (i) { return creativeStack((RT.cList || [])[RT.cScroll * CCOLS + i]); }, set: function () {} };
        if (g === 'ctrash') return { get: function () { return null; }, set: function () {} };
        // every route into an armour slot goes through this setter, so the "Suit Up"
        // award lives here — it used to hang off right-clicking armour in the world
        // only, and stayed silent for shift-click, drag and right-click-place
        if (g === 'armor') return { get: function (i) { return S.armor[i]; }, set: function (i, v) { S.armor[i] = v; if (v) unlock('armor'); } };
        if (g === 'off') return { get: function () { return S.off || null; }, set: function (i, v) { S.off = v || null; } };
        if (g === 'craft') return { get: function (i) { return RT.craft[i]; }, set: function (i, v) { RT.craft[i] = v; } };
        if (g === 'ein') return { get: function () { return RT.enchItem; }, set: function (i, v) { RT.enchItem = v; genEnchOptions(); } };
        if (g === 'elapis') return { get: function () { return RT.enchLapis; }, set: function (i, v) { RT.enchLapis = v; } };
        if (g === 'anvA') return { get: function () { return RT.anvilA; }, set: function (i, v) { RT.anvilA = v; anvilNameSync(); } };
        if (g === 'anvB') return { get: function () { return RT.anvilB; }, set: function (i, v) { RT.anvilB = v; } };
        if (g === 'chest') { t = S.tents[RT.panel.key]; return { get: function (i) { return t.inv[i]; }, set: function (i, v) { t.inv[i] = v; } }; }
        t = S.tents[RT.panel.key];
        if (g === 'fin') return { get: function () { return t.fin; }, set: function (i, v) { t.fin = v; } };
        if (g === 'ffuel') return { get: function () { return t.fuel; }, set: function (i, v) { t.fuel = v; } };
        if (g === 'fout') return { get: function () { return t.out; }, set: function (i, v) { t.out = v; } };
        return null;
    }
    function slotsHTML(g, from, n, cls) {
        var out = '';
        for (var i = from; i < from + n; i++) out += '<div class="mc-slot ' + (cls || '') + '" data-g="' + g + '" data-i="' + i + '"></div>';
        return out;
    }
    function pAt(x, y) { return 'left:calc(var(--px) * ' + x + ');top:calc(var(--px) * ' + y + ')'; }
    /* a slot element is the game's 18x18 hover box: the frame's own rectangle, one
       pixel up and left of where the item is drawn */
    function pSlot(g, i, ix, iy, cls, ei) {
        return '<div class="mc-slot' + (cls ? ' ' + cls : '') + '" data-g="' + g + '" data-i="' + i + '"' + (ei ? ' data-ei="' + ei + '"' : '') + ' style="' + pAt(ix - 1, iy - 1) + '"></div>';
    }
    function pSlots(g, from, ix, iy, cols, rows) {
        var out = '';
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) out += pSlot(g, from + r * cols + c, ix + 18 * c, iy + 18 * r);
        return out;
    }
    function pLabel(text, x, y, cls) { return '<span class="mc-plab ' + (cls || 'mc-plabel') + '" style="' + pAt(x, y) + '">' + mtHTML(text, '#404040', 'ns') + '</span>'; }
    function pInv(iy, hy) { return pSlots('inv', 9, 8, iy, 9, 3) + pSlots('inv', 0, 8, hy, 9, 1); }
    var ARM_EI = ['e_helmet', 'e_chest', 'e_legs', 'e_boots'];
    /* the figure's box: InventoryScreen.renderEntityInInventoryFollowsMouse's rectangle and scale */
    function pAvatar(x, y, w, h, scale) {
        return '<div class="mc-avbox" style="' + pAt(x, y) + ';width:calc(var(--px) * ' + w + ');height:calc(var(--px) * ' + h + ')"><canvas class="mc-av" data-s="' + scale + '"></canvas></div>';
    }
    function panelHTML(kind) {
        var bg = function (name) {
            var sp = guiSprites()[name];
            return '<i class="mc-pbg" style="width:calc(var(--px) * ' + sp.w + ');height:calc(var(--px) * ' + sp.h + ');background-image:var(--spr-' + name + ')"></i>';
        };
        var rb = function (x, y) { return '<button class="mc-rbook" type="button" aria-label="Recipe Book" style="' + pAt(x, y) + '"></button>'; };
        var i, out;
        if (kind === 'inv') {
            out = bg('p_inv') + pLabel('Crafting', 97, 6, 'mc-phead');
            for (i = 0; i < 4; i++) out += pSlot('armor', i, 8, 8 + 18 * i, '', ARM_EI[i]);
            out += pAvatar(26, 8, 49, 70, 30);
            out += pSlot('off', 0, 77, 62, '', 'e_shield');
            for (i = 0; i < 4; i++) out += pSlot('craft', i, 98 + 18 * (i % 2), 18 + 18 * (i >> 1));
            return out + pSlot('cout', 0, 154, 28) + rb(104, 61) + pInv(84, 142);
        }
        if (kind === 'table') {
            out = bg('p_table') + pLabel('Crafting', 29, 6, 'mc-phead') + pLabel('Inventory', 8, 72);
            for (i = 0; i < 9; i++) out += pSlot('craft', i, 30 + 18 * (i % 3), 17 + 18 * ((i / 3) | 0));
            return out + pSlot('cout', 0, 124, 35) + rb(5, 34) + pInv(84, 142);
        }
        if (kind === 'furnace') {
            return bg('p_furn') + pLabel('Furnace', (176 - (mfWidth('Furnace') + 1)) >> 1, 6, 'mc-phead') + pLabel('Inventory', 8, 72) +
                pSlot('fin', 0, 56, 17) + pSlot('ffuel', 0, 56, 53) + pSlot('fout', 0, 116, 35) +
                '<i class="mc-flame" style="' + pAt(56, 36) + '"></i><i class="mc-farrow" style="' + pAt(79, 34) + '"></i>' + rb(20, 34) + pInv(84, 142);
        }
        if (kind === 'ench') {
            out = bg('p_ench') + '<canvas class="mc-ebook"></canvas>' + pLabel('Enchant', 8, 6, 'mc-phead') + pLabel('Inventory', 8, 72) +
                pSlot('ein', 0, 15, 47) + pSlot('elapis', 0, 35, 47, '', 'e_lapis');
            for (i = 0; i < 3; i++) out += '<button class="mc-enchopt" type="button" data-o="' + i + '" style="' + pAt(60, 14 + 19 * i) + '">' +
                '<i class="eo-ic"></i><span class="eo-rune"></span><span class="eo-lvl"></span></button>';
            return out + pInv(84, 142);
        }
        if (kind === 'anvil') {
            return bg('p_anvil') + pLabel('Repair & Name', 60, 6, 'mc-phead') + pLabel('Inventory', 8, 72) +
                '<i class="mc-anvtf" style="' + pAt(59, 20) + '"></i>' +
                '<input class="mc-anvin" maxlength="50" spellcheck="false" autocomplete="off" style="' + pAt(62, 24) + '"><div class="mc-anvmir mc-fmir" style="' + pAt(62, 24) + '"></div>' +
                pSlot('anvA', 0, 27, 47) + pSlot('anvB', 0, 76, 47) + pSlot('anvOut', 0, 134, 47, 'anvOut') +
                '<i class="mc-anverr" style="' + pAt(99, 45) + ';display:none"></i><div class="mc-anvcost" style="display:none"></div>' + pInv(84, 142);
        }
        if (kind === 'creative') {
            var tab = CTABS[RT.cTab] || CTABS[0], tabs = '', sel = '';
            for (var ti = 0; ti < CTABS.length; ti++) {
                var T = CTABS[ti], on = ti === RT.cTab, x = T.col < 5 ? 27 * T.col : 195 - 27 * (7 - T.col) + 1, y = T.row ? 132 : -28;
                var spr = 'tab_' + (T.row ? 'b' : 't') + '_' + (on ? (T.col === 0 ? 's1' : T.col === 6 ? 's7' : 'sm') : 'un');
                var html = '<button class="mc-ctab' + (on ? ' on' : '') + '" type="button" data-ct="' + ti + '" aria-label="' + escHtml(T.t) + '" style="' + pAt(x, y) +
                    ';background-image:var(--spr-' + spr + ')"><b class="mc-ctic" style="' + pAt(5, T.row ? 7 : 9) + ';background-image:url(' + iconURL(T.ic) + ')"></b></button>';
                if (on) sel = html; else tabs += html;
            }
            out = tabs + bg(tab.id === 'inv' ? 'p_cr_inv' : tab.id === 'search' ? 'p_cr_search' : 'p_cr_items') + sel;
            if (tab.id === 'inv') {   // the Survival Inventory tab carries no title
                var ap = [[54, 6], [54, 33], [108, 6], [108, 33]];
                for (i = 0; i < 4; i++) out += pSlot('armor', i, ap[i][0], ap[i][1], '', ARM_EI[i]);
                out += pSlot('off', 0, 35, 20, '', 'e_shield');
                out += pAvatar(73, 6, 32, 43, 20);
                return out + pSlots('inv', 9, 9, 54, 9, 3) + pSlots('inv', 0, 9, 112, 9, 1) + pSlot('ctrash', 0, 173, 112, 'ctrash');
            }
            out += pLabel(tab.t, 8, 6, 'mc-phead');
            if (tab.id === 'search') out += '<input class="mc-csearchin" maxlength="50" spellcheck="false" autocomplete="off" value="' + escHtml(RT.cSearch || '') + '" style="' + pAt(82, 6) + '">' +
                '<div class="mc-csmir mc-fmir" style="' + pAt(82, 6) + '"></div>';
            return out + pSlots('creat', 0, 9, 18, 9, 5) + '<div class="mc-cbar" style="' + pAt(175, 18) + '"><i></i></div>' + pSlots('inv', 0, 9, 112, 9, 1);
        }
        return bg('p_chest') + pLabel('Chest', 8, 6, 'mc-phead') + pLabel('Inventory', 8, 74) + pSlots('chest', 0, 8, 18, 9, 3) + pInv(85, 143);
    }
    function openPanel(kind, t) {
        closePanel(true);
        RT.panel = { kind: kind, key: t ? tentKey(t.x, t.y, t.z) : null, at: t ? [t.x + 0.5, t.y + 0.5, t.z + 0.5] : null };
        var ist = { table: 'interact_with_crafting_table', furnace: 'interact_with_furnace', chest: 'open_chest', anvil: 'interact_with_anvil' }[kind];
        if (ist) stat('c', ist);
        if (kind === 'furnace') tentAt(t.x, t.y, t.z, 'furnace');
        if (kind === 'chest') tentAt(t.x, t.y, t.z, 'chest');
        RT.craftW = kind === 'table' ? 3 : 2;
        RT.craft = [null, null, null, null, null, null, null, null, null];
        RT.hover = null;   // nothing is under the pointer in a screen that has not been drawn yet
        if (kind === 'ench') { RT.enchItem = null; RT.enchLapis = null; RT.enchOpts = null; RT.enchSeed = (Math.random() * 1e9) | 0; RT.ebook = null; }
        if (kind === 'anvil') { RT.anvilA = null; RT.anvilB = null; RT.anvilName = ''; }
        // the catalogue has to exist before panelHTML asks it how many rows it has
        if (kind === 'creative') { if (RT.cTab == null) RT.cTab = 0; RT.cScroll = 0; creativeRefresh(); }
        var wrap = RT.el.querySelector('.mc-panelwrap');
        wrap.innerHTML = panelMarkup(kind);
        wrap.style.display = '';
        RT.hovEl = null;
        RT.rbv = null; RT.rbGhost = null; RT.rbGhostAt = {}; RT.rbPopT = {};   // a new screen, a new book: the first tab, no search, no ghost
        rbSync();
        panelLayout();
        unlockCursor();
        // .mc-panelwrap is a PERSISTENT node — only its innerHTML is replaced per open. Re-running
        // wirePanel on it stacked another set of delegated listeners every time, so after N opens a
        // single slot click ran slotClick N times (items silently duplicated, vanished, or the click
        // appeared to do nothing at all on an even count).
        if (!wrap._wired) { wirePanel(wrap); wrap._wired = 1; }
        wirePanelFields(wrap);   // the anvil name box is inside the fresh markup, so it re-wires
        avatarAttach();          // the survival screen has you standing in it
        paintPanel();
        // reopening on the Search tab used to hand you an unfocused box with your old
        // query still in it, so the first letter you typed went to the world instead:
        // "emerald" closed the inventory on the e and strafed on the a
        var sb0 = wrap.querySelector('.mc-csearchin');
        if (sb0) { sb0.focus(); sb0.setSelectionRange(sb0.value.length, sb0.value.length); }
        if (kind === 'inv' || kind === 'table') unlock('inventory');
        if (kind === 'chest' && t) snd('chestopen', 0, t.x + 0.5, t.y + 0.5, t.z + 0.5);
        else snd('click');
    }
    function closePanel(silent) {
        if (!RT.panel) return;
        RT.qc = null;   // a sweep in progress ends with the screen
        RT.av = null;   // and so does the figure in the box
        RT.hover = null; RT.lastClk = null; RT.hovEl = null; RT.cDrag = 0;
        RT.rbGhost = null; RT.rbGhostAt = {}; RT.rbv = null;
        var i, give = [RT.cur, RT.enchItem, RT.enchLapis, RT.anvilA, RT.anvilB];
        for (i = 0; i < 9; i++) { give.push(RT.craft[i]); RT.craft[i] = null; }
        RT.cur = null; RT.enchItem = null; RT.enchLapis = null; RT.anvilA = null; RT.anvilB = null; RT.enchOpts = null;
        for (i = 0; i < give.length; i++) {
            if (!give[i]) continue;
            var left = invGive(give[i].id, give[i].c, give[i].dur, give[i].ench, give[i].name);
            if (left) dropItem(S.px, S.py + 1, S.pz, give[i].id, left, give[i].dur, false, give[i].ench, give[i].name);
        }
        var closing = RT.panel;
        RT.panel = null;
        if (!silent && closing.kind === 'chest' && closing.at) snd('chestclose', 0, closing.at[0], closing.at[1], closing.at[2]);
        var wrap = RT.el.querySelector('.mc-panelwrap');
        wrap.style.display = 'none'; wrap.innerHTML = '';
        paintHotbar();
        RT.el.focus();   // panel clicks may have focused a slot; keys go back to the game
        if (!silent) lockCursor();
    }
    function paintPanel() {
        if (!RT.panel) return;
        var wrap = RT.el.querySelector('.mc-panelwrap');
        var cells = wrap.querySelectorAll('.mc-slot');
        var washed = wrap.querySelectorAll('.mc-slot.qc');   // the sweep wash belongs to a live sweep only
        for (var wq = 0; wq < washed.length; wq++) washed[wq].classList.remove('qc');
        var kind = RT.panel.kind, anv = kind === 'anvil' ? anvilResult() : null;
        for (var i = 0; i < cells.length; i++) {
            var g = cells[i].getAttribute('data-g'), idx = cells[i].getAttribute('data-i') | 0;
            if (g === 'cout') { var r = matchRecipe(RT.craft, RT.craftW); paintSlot(cells[i], r ? { id: r.out, c: r.n } : null); }
            else if (g === 'anvOut') paintSlot(cells[i], anv && !anv.tooExp ? anv.out : null);
            else if (g === 'creat') {   // the catalogue shows items, not stacks; a saved hotbar shows what was saved
                var ce = (RT.cList || [])[RT.cScroll * CCOLS + idx], cst = creativeStack(ce);
                paintSlot(cells[i], cst ? (typeof ce === 'object' ? cst : { id: cst.id, c: 1, dur: cst.dur }) : null);
            }
            else if (g !== 'ctrash') paintSlot(cells[i], slotGroup(g).get(idx));
        }
        var cur = wrap.querySelector('.mc-cur');
        if (cur) {
            /* display:'block', NOT ''. Clearing the inline rule hands the element
               back to the stylesheet, which declares .mc-cur{display:none} — so
               for as long as this screen has existed, the stack you picked up
               vanished off the screen while RT.cur really was holding it. */
            if (RT.cur) { cur.style.display = 'block'; paintSlot(cur, RT.cur); panelCurTo(); }
            else cur.style.display = 'none';
        }
        if (kind === 'furnace') paintFurnaceBits(S.tents[RT.panel.key]);
        if (kind === 'ench') paintEnchOpts(wrap);
        if (kind === 'anvil') paintAnvil(wrap, anv);
        if (kind === 'creative') paintCreativeBar(wrap);
        if (RT.qc) qcPaint();   // a repaint mid-sweep (a furnace ticking behind the screen) keeps the preview
        if (RT.av) avatarSync();   // armour on or off, a different item in hand: the figure follows the slots
        if (rbKind()) rbPaint();   // the book redraws what you can make as the inventory changes
        rbGhostPaint(wrap);
        panelHoverRefresh();       // the same pointer may be over something new now
    }
    /* AbstractFurnaceScreen: the lit flame shows its bottom ceil(13p) + 1 rows,
       so it burns down from the top; the arrow fills ceil(24p) columns from the left */
    function paintFurnaceBits(t) {
        var wrap = RT.el.querySelector('.mc-panelwrap');
        if (!wrap || !t) return;
        var fl = wrap.querySelector('.mc-flame'), ar = wrap.querySelector('.mc-farrow');
        var lit = t.burn > 0 && t.burnMax > 0, h = lit ? Math.ceil(Math.max(0, Math.min(1, t.burn / t.burnMax)) * 13) + 1 : 0;
        if (fl) { fl.style.display = h ? '' : 'none'; fl.style.top = 'calc(var(--px) * ' + (36 + 14 - h) + ')'; fl.style.height = 'calc(var(--px) * ' + h + ')'; }
        var w = Math.ceil(Math.max(0, Math.min(1, t.prog / SMELT_S)) * 24);
        if (ar) { ar.style.display = w ? '' : 'none'; ar.style.width = 'calc(var(--px) * ' + w + ')'; }
    }
    /* The enchanting table's three plates: tan when you can take the option,
       mauve under the pointer, dark olive when you cannot (and nothing but the
       plate when the row has no enchantment at all). The runes are one line of
       the Standard Galactic alphabet in the plate's dark ink, the level
       requirement right-aligned at x 166 in green, or a darker green when out
       of reach, and the orb says how much lapis it takes. */
    var RUNE_WORDS = ['ember', 'hollow', 'lantern', 'moss', 'marrow', 'brine', 'thorn', 'echo', 'spindle', 'gale', 'cinder', 'frost', 'whisper', 'deep', 'bright',
        'weave', 'sunder', 'bind', 'mend', 'kindle', 'quell', 'ward', 'seek', 'veil', 'quartz', 'drift', 'root', 'bloom', 'vex', 'lumen', 'umbra', 'sable',
        'aurum', 'fern', 'shale', 'glint', 'hush', 'rime', 'wake', 'tide', 'spark', 'loam', 'crest', 'hearth', 'vale', 'wisp', 'rust', 'gleam'];
    function enchRunes(seed, row, maxW) {
        var rng = mulb((seed | 0) ^ (row * 0x9E3779B9)), n = 3 + ((rng() * 2) | 0), words = [];
        for (var k = 0; k < n; k++) words.push(RUNE_WORDS[(rng() * RUNE_WORDS.length) | 0]);
        var s = words.join(' ');
        while (s.length && sgaWidth(s) > maxW) s = s.slice(0, -1);
        return s;
    }
    function enchAffordable(op) {
        return !!(op && op.ench && RT.enchItem && RT.enchItem.c === 1 &&
            (instaBuild() || (S.xpl >= op.level && RT.enchLapis && RT.enchLapis.c >= op.lapis)));
    }
    function paintEnchOpts(wrap) {
        var opts = wrap.querySelectorAll('.mc-enchopt');
        for (var o = 0; o < opts.length; o++) {
            var op = RT.enchOpts && RT.enchOpts[o], btn = opts[o], has = !!(op && op.ench), aff = enchAffordable(op);
            btn.className = 'mc-enchopt ' + (!has ? 'none' : aff ? 'ok' : 'dis');
            btn.disabled = !has;
            var ic = btn.querySelector('.eo-ic'), rune = btn.querySelector('.eo-rune'), lvl = btn.querySelector('.eo-lvl');
            if (!has) { ic.style.backgroundImage = ''; rune.innerHTML = ''; lvl.innerHTML = ''; continue; }
            ic.style.backgroundImage = 'var(--spr-lvl_' + op.lapis + (aff ? '' : 'd') + ')';
            var cost = String(op.level), cw = mfWidth(cost) + 1;
            rune.innerHTML = mtHTML(enchRunes(RT.enchSeed, o, 86 - cw), aff ? '#685e4a' : '#342f25', 'ns sga');
            lvl.innerHTML = mtHTML(cost, aff ? '#80ff20' : '#407f10');
            lvl.style.left = 'calc(var(--px) * ' + (106 - cw) + ')';
        }
        enchBookTarget();
    }
    /* The anvil: the name plate lights up once there is something in the left
       slot to name; the red X covers the arrow while the inputs make nothing;
       the cost sits right-aligned at y 69 on a faint black box, green when you
       can pay it and #FF6060 when you cannot, or "Too Expensive!" from 40. */
    function paintAnvil(wrap, anv) {
        var tf = wrap.querySelector('.mc-anvtf'), inp = wrap.querySelector('.mc-anvin');
        if (tf) tf.style.backgroundImage = 'var(--spr-' + (RT.anvilA ? 'anvil_tf' : 'anvil_tfd') + ')';
        if (inp) {
            var had = document.activeElement === inp;
            inp.disabled = !RT.anvilA;
            if (had && inp.disabled) RT.el.focus();   // a disabled box drops focus onto nothing; the keys belong to the game
            if (document.activeElement !== inp && inp.value !== (RT.anvilName || '')) inp.value = RT.anvilName || '';
        }
        var err = wrap.querySelector('.mc-anverr');
        if (err) err.style.display = (RT.anvilA || RT.anvilB) && (!anv || anv.tooExp) ? '' : 'none';
        var box = wrap.querySelector('.mc-anvcost');
        if (box) {
            var txt = '', col = '#80ff20';
            if (anv && anv.cost > 0) {
                if (anv.cost >= 40 && !instaBuild()) { txt = 'Too Expensive!'; col = '#ff6060'; }
                else { txt = 'Enchantment Cost: ' + anv.cost; if (!instaBuild() && S.xpl < anv.cost) col = '#ff6060'; }
            }
            box.style.display = txt ? '' : 'none';
            if (txt) {
                var k = 166 - (mfWidth(txt) + 1);
                box.innerHTML = mtHTML(txt, col);
                hudPlaceRel(box, k - 2, 67);
                box.style.width = 'calc(var(--px) * ' + (168 - (k - 2)) + ')';
            }
        }
        paintFieldMirror(inp, wrap.querySelector('.mc-anvmir'), '#ffffff', 103);
    }
    /* the creative scroller: 12x15 at x 175, y = 18 + floor(95 t); greyed when the tab fits in
       five rows. t is the continuous scroll a drag leaves, the row a wheel notch lands on */
    function paintCreativeBar(wrap) {
        var bar = wrap.querySelector('.mc-cbar'), th = bar && bar.querySelector('i');
        if (th) {
            var mx = creativeMaxScroll(), t = mx ? (RT.cScrollF != null ? RT.cScrollF : RT.cScroll / mx) : 0;
            th.style.top = 'calc(var(--px) * ' + Math.floor(95 * Math.max(0, Math.min(1, t))) + ')';
            bar.classList.toggle('off', mx === 0);
        }
        paintFieldMirror(wrap.querySelector('.mc-csearchin'), wrap.querySelector('.mc-csmir'), '#ffffff', 80);
    }
    /* A real <input> keeps the caret, the selection and the keyboard, invisibly;
       what shows is this mirror, drawn the way EditBox.renderWidget draws: the
       visible run of the value in the game's font with its shadow; the cursor
       blinking 300 ms on and 300 ms off from the moment of focus, an underscore
       where the text ends (two pixels past the last glyph, since drawString
       hands back the x after the shadow) or a bar on the first column of the
       next glyph inside it; and a selection as the game's OR_REVERSE
       highlight, which inverts red and green and fills blue. */
    function paintFieldMirror(inp, mir, col, room, hint) {
        if (!inp || !mir) return;
        var v = inp.value || '', caret = inp.selectionStart == null ? v.length : inp.selectionStart, skip = 0;
        var s0 = inp.selectionStart == null ? caret : inp.selectionStart, s1 = inp.selectionEnd == null ? caret : inp.selectionEnd;
        if (inp.selectionDirection === 'backward') caret = s0; else caret = s1;
        while (skip < caret && mfWidth(v.slice(skip, caret)) > room - 6) skip++;
        var show = v.slice(skip), html = show ? mtHTML(show, inp.disabled ? '#707070' : col) : '';
        var focused = document.activeElement === inp && !inp.disabled;
        if (!v && hint && !focused) html = typeof hint === 'string' ? mtHTML(hint, '#555555') : mtHTML(hint.t, hint.c, hint.cls);   // the hint, dark grey, only while the box is empty and idle
        function xAt(k) { return k > skip ? mfWidth(v.slice(skip, k)) + 1 : 0; }
        var cx = xAt(caret);
        if (focused && (((performance.now() - (inp._ft || 0)) / 300) | 0) % 2 === 0) {
            html += caret < v.length ? '<i class="mc-fbar" style="left:calc(var(--px) * ' + cx + ');background:' + col + '"></i>'
                                     : '<span class="mc-fcur" style="left:calc(var(--px) * ' + (caret > skip ? cx + 1 : 0) + ')">' + mtHTML('_', col) + '</span>';
        }
        if (focused && s1 > s0) {
            var other = caret === s1 ? s0 : s1, ox = xAt(Math.max(skip, other)), a = Math.min(cx, ox), b = Math.max(cx, ox) - 1;
            // two layers: a difference with yellow inverts red and green, a lighten with blue fills blue
            var sel = 'left:calc(var(--px) * ' + a + ');width:calc(var(--px) * ' + (b - a) + ')';
            if (b > a) html += '<i class="mc-fsel a" style="' + sel + '"></i><i class="mc-fsel b" style="' + sel + '"></i>';
        }
        if (mir._html !== html) { mir._html = html; mir.innerHTML = html; }
    }
    function hudPlaceRel(e, x, y) { e.style.left = 'calc(var(--px) * ' + x + ')'; e.style.top = 'calc(var(--px) * ' + y + ')'; }
    function esc(s) { return String(s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); }
    /* AnvilScreen.slotChanged: whatever lands in the left slot resets the name
       box to what that item is called, and hands the box the keyboard */
    function anvilNameSync() {
        RT.anvilName = RT.anvilA ? itemName(RT.anvilA) : '';
        var inp = RT.el && RT.el.querySelector('.mc-anvin');
        if (!inp) return;
        var had = document.activeElement === inp;
        inp.value = RT.anvilName;
        inp.disabled = !RT.anvilA;
        if (RT.anvilA) { if (!had) { inp.focus(); inp._ft = performance.now(); } inp.setSelectionRange(inp.value.length, inp.value.length); }
        else if (had) RT.el.focus();
    }
    /* The Standard Galactic Alphabet, a to z, as the enchanting table writes
       it: the game's "alt" font. Seven rows like the capitals, drawn from the
       alphabet's shapes in our own pixels. Anything that is not a letter keeps
       the ordinary font's place. */
    var SGA_FAMILY = 'MCSGA', SGA = null;
    var SGA_ROWS = {
        a: ['####', '...#', '...#', '####', '#...', '#...', '#...'],
        b: ['###.', '...#', '...#', '..#.', '.#..', '.#..', '.#..'],
        c: ['#...', '#...', '####', '...#', '...#', '####', '....'],
        d: ['####', '##..', '#.#.', '#..#', '#...', '#...', '#...'],
        e: ['#..#', '#..#', '#..#', '#..#', '####', '.#..', '.#..'],
        f: ['####', '....', '#.##', '....', '....', '....', '....'],
        g: ['..#', '..#', '..#', '###', '..#', '..#', '..#'],
        h: ['#####', '.....', '..#..', '..#..', '..#..', '#####', '.....'],
        i: ['#', '#', '.', '#', '#', '.', '#'],
        j: ['#', '.', '.', '#', '.', '.', '#'],
        k: ['#..#', '#.#.', '##..', '#.#.', '#..#', '#..#', '....'],
        l: ['#...', '#...', '#...', '#.#.', '#.#.', '####', '....'],
        m: ['#...', '#...', '#..#', '#..#', '#..#', '####', '....'],
        n: ['#..#', '#..#', '#..#', '...#', '...#', '..#.', '##..'],
        o: ['####', '...#', '...#', '...#', '#..#', '.##.', '....'],
        p: ['#.#', '#..', '#.#', '#.#', '#.#', '..#', '#.#'],
        q: ['####', '#..#', '#..#', '.#.#', '...#', '...#', '....'],
        r: ['...', '#.#', '...', '#.#', '...', '...', '...'],
        s: ['####', '#..#', '#..#', '....', '.#..', '....', '....'],
        t: ['####', '...#', '...#', '...#', '...#', '...#', '....'],
        u: ['##.#', '....', '####', '....', '....', '....', '....'],
        v: ['..#..', '..#..', '..#..', '#####', '.....', '#####', '.....'],
        w: ['.....', '.....', '..#..', '.....', '#...#', '.....', '.....'],
        x: ['#..#', '..#.', '.#..', '#...', '....', '....', '....'],
        y: ['#.#', '#.#', '#.#', '#.#', '#.#', '#.#', '#.#'],
        z: ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '.....']
    };
    function sgaGlyphs() {
        if (SGA) return SGA;
        SGA = { ' ': { w: 3, rows: [] } };
        for (var ch in SGA_ROWS) {
            var rows = SGA_ROWS[ch].slice();
            while (rows.length < MF_ROWS) rows.push('');
            SGA[ch] = { w: SGA_ROWS[ch][0].length, rows: rows };
        }
        return SGA;
    }
    function sgaWidth(t) {
        var g = sgaGlyphs(), w = 0;
        for (var i = 0; i < t.length; i++) { var gl = g[t.charAt(i)]; w += gl ? gl.w + 1 : mfAdvance(t.charAt(i)); }
        return w ? w - 1 : 0;
    }
    /* ── the enchanting table's book ─────────────────────────────
       EnchantmentScreen.renderBook: BookModel drawn at (33, 31) in the screen,
       40 GUI pixels to the block, tipped 25 degrees towards you. tickBook
       opens it by 0.2 a tick while the table offers anything and shuts it
       while it offers nothing, and any change to what is on the table sends
       the pages flipping to a new random spot, easing there at 0.4 of the way
       a tick, never faster than 0.2. The boxes, pivots and texture layout are
       BookModel's; the texture is ours. Drawn like the inventory figure: every
       face an affine image of its patch of the texture, far to near, the ones
       turned away skipped. */
    var EB_TEX = null, EB_SHADE = [];
    function ebTexture() {
        if (EB_TEX) return EB_TEX;
        var cv = document.createElement('canvas'), c;
        cv.width = 64; cv.height = 32; c = cv.getContext('2d');
        function r(x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
        // the covers, outside and in: brown leather with a darker rim and a worn, lighter top edge
        [[0, 0], [6, 0], [16, 0], [22, 0]].forEach(function (o) {
            r(o[0], o[1], 6, 10, '#6c4527'); r(o[0], o[1], 6, 1, '#8b5d35'); r(o[0], o[1] + 9, 6, 1, '#4a2d17');
            r(o[0] + 1, o[1] + 3, 4, 1, '#7d5230'); r(o[0] + 1, o[1] + 6, 4, 1, '#5c3a20');
        });
        r(12, 0, 4, 10, '#4f311a'); r(12, 0, 4, 1, '#6c4527'); r(13, 2, 2, 6, '#5d3a1f');   // the spine
        // the two blocks of pages: cream faces with lines of writing, the edges striped
        [0, 12].forEach(function (u) {
            r(u, 10, 12, 9, '#d9d0b4');
            for (var y = 11; y < 19; y += 2) r(u, y, 12, 1, '#c7bd9e');
            [u + 1, u + 7].forEach(function (x) {
                r(x, 11, 5, 8, '#f1ead3');
                for (var ly = 12; ly < 18; ly += 2) r(x + 1, ly, (ly * 7 + x) % 3 ? 3 : 2, 1, '#b5aa91');
            });
        });
        [24, 29].forEach(function (x) {   // the loose pages, a side each
            r(x, 10, 5, 8, '#f4eed9');
            for (var ly = 11; ly < 17; ly += 2) r(x + 1, ly, (ly + x) % 3 ? 3 : 2, 1, '#b5aa91');
        });
        EB_TEX = cv;
        return cv;
    }
    function ebShaded(k) {   // the texture at brightness k/16, baked once per level
        if (EB_SHADE[k]) return EB_SHADE[k];
        var src = ebTexture(), cv = document.createElement('canvas'), c;
        cv.width = 64; cv.height = 32; c = cv.getContext('2d');
        c.drawImage(src, 0, 0);
        c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(0,0,0,' + (1 - k / 16).toFixed(3) + ')'; c.fillRect(0, 0, 64, 32);
        EB_SHADE[k] = cv;
        return cv;
    }
    // BookModel.createBodyLayer: texOffs, box origin and size, pivot, fixed rotation
    var EB_PARTS = [
        { k: 'llid', t: [0, 0], b: [-6, -5, -0.005, 6, 10, 0.005], p: [0, 0, -1] },
        { k: 'rlid', t: [16, 0], b: [0, -5, -0.005, 6, 10, 0.005], p: [0, 0, 1] },
        { k: 'seam', t: [12, 0], b: [-1, -5, 0, 2, 10, 0.005], p: [0, 0, 0], ry: Math.PI / 2 },
        { k: 'lpages', t: [0, 10], b: [0, -4, -0.99, 5, 8, 1], p: [0, 0, 0] },
        { k: 'rpages', t: [12, 10], b: [0, -4, -0.01, 5, 8, 1], p: [0, 0, 0] },
        { k: 'flip1', t: [24, 10], b: [0, -4, 0, 5, 8, 0.005], p: [0, 0, 0] },
        { k: 'flip2', t: [24, 10], b: [0, -4, 0, 5, 8, 0.005], p: [0, 0, 0] }
    ];
    // 3x4 affine matrices, row-major
    function emMul(A, B) {
        var o = new Array(12);
        for (var r = 0; r < 3; r++) {
            for (var c = 0; c < 3; c++) o[r * 4 + c] = A[r * 4] * B[c] + A[r * 4 + 1] * B[4 + c] + A[r * 4 + 2] * B[8 + c];
            o[r * 4 + 3] = A[r * 4] * B[3] + A[r * 4 + 1] * B[7] + A[r * 4 + 2] * B[11] + A[r * 4 + 3];
        }
        return o;
    }
    function emT(x, y, z) { return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z]; }
    function emS(x, y, z) { return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0]; }
    function emRx(a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]; }
    function emRy(a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0]; }
    function emAt(M, x, y, z) { return [M[0] * x + M[1] * y + M[2] * z + M[3], M[4] * x + M[5] * y + M[6] * z + M[7], M[8] * x + M[9] * y + M[10] * z + M[11]]; }
    function ebTick(B) {
        // ItemStack.matches: the same item, count and components, or the pages flip
        var it = RT.enchItem, key = it ? JSON.stringify(it) : '';
        if (key !== B.last) {
            B.last = key;
            do { B.flipT += ((Math.random() * 4) | 0) - ((Math.random() * 4) | 0); } while (B.flip <= B.flipT + 1 && B.flip >= B.flipT - 1);
        }
        B.oFlip = B.flip; B.oOpen = B.open;
        var any = !!(RT.enchOpts && RT.enchOpts.some(function (o) { return o && o.ench; }));   // menu.costs[i] != 0
        B.open = Math.max(0, Math.min(1, B.open + (any ? 0.2 : -0.2)));
        var f1 = Math.max(-0.2, Math.min(0.2, (B.flipT - B.flip) * 0.4));
        B.flipA += (f1 - B.flipA) * 0.9;
        B.flip += B.flipA;
    }
    function ebFrac(v) { return v - Math.floor(v); }
    var EB_BOX = [0, 2, 66, 60];   // the canvas's rectangle in the screen, round the book at (33, 31)
    function ebDraw(cv, B, pt) {
        var s = RT.gs || 2, bw = EB_BOX[2], bh = EB_BOX[3];
        if (cv.width !== bw * s || cv.height !== bh * s) {
            cv.width = bw * s; cv.height = bh * s;
            cv.style.left = 'calc(var(--px) * ' + EB_BOX[0] + ')'; cv.style.top = 'calc(var(--px) * ' + EB_BOX[1] + ')';
            cv.style.width = 'calc(var(--px) * ' + bw + ')'; cv.style.height = 'calc(var(--px) * ' + bh + ')';
        }
        var c = cv.getContext('2d');
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, cv.width, cv.height);
        c.imageSmoothingEnabled = false;
        var open = B.oOpen + (B.open - B.oOpen) * pt, flip = B.oFlip + (B.flip - B.oFlip) * pt;
        var D = Math.PI / 180, io = 1 - open;
        var M = emT((33 - EB_BOX[0]) * s, (31 - EB_BOX[1]) * s, 100);
        M = emMul(M, emS(-40 * s, 40 * s, 40 * s));
        M = emMul(M, emRx(25 * D));
        M = emMul(M, emT(io * 0.2, io * 0.1, io * 0.25));
        M = emMul(M, emRy((-io * 90 - 90) * D));
        M = emMul(M, emRx(180 * D));
        // BookModel.setupAnim(0, right flip, left flip, open)
        var rf = Math.max(0, Math.min(1, ebFrac(flip + 0.25) * 1.6 - 0.3)), lf = Math.max(0, Math.min(1, ebFrac(flip + 0.75) * 1.6 - 0.3));
        var f = 1.25 * open, sf = Math.sin(f);
        var pose = { llid: [0, Math.PI + f], rlid: [0, -f], seam: [0, Math.PI / 2], lpages: [sf, f], rpages: [sf, -f], flip1: [sf, f - f * 2 * rf], flip2: [sf, f - f * 2 * lf] };
        var quads = [];
        EB_PARTS.forEach(function (P) {
            var ps = pose[P.k], Mp = emMul(M, emT((P.p[0] + ps[0]) / 16, P.p[1] / 16, P.p[2] / 16));
            Mp = emMul(Mp, emRy(ps[1]));
            Mp = emMul(Mp, emS(1 / 16, 1 / 16, 1 / 16));
            var x0 = P.b[0], y0 = P.b[1], z0 = P.b[2], x1 = x0 + P.b[3], y1 = y0 + P.b[4], z1 = z0 + P.b[5];
            var dx = P.b[3], dy = P.b[4], dz = P.b[5], u = P.t[0], v = P.t[1];
            var V = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]].map(function (p) { return emAt(Mp, p[0], p[1], p[2]); });
            var u1 = u + dz, u2 = u1 + dx, u3 = u2 + dx, u4 = u2 + dz, u5 = u4 + dx, v1 = v + dz, v2 = v1 + dy;
            // ModelPart.Cube's six polygons: vertices, texture rectangle, normal
            [[[5, 4, 0, 1], u1, v, u2, v1, [0, -1, 0]], [[2, 3, 7, 6], u2, v1, u3, v, [0, 1, 0]], [[0, 4, 7, 3], u, v1, u1, v2, [-1, 0, 0]],
             [[1, 0, 3, 2], u1, v1, u2, v2, [0, 0, -1]], [[5, 1, 2, 6], u2, v1, u4, v2, [1, 0, 0]], [[4, 5, 6, 7], u4, v1, u5, v2, [0, 0, 1]]].forEach(function (F) {
                var tw = F[3] - F[1], th = F[4] - F[2];
                if (Math.abs(tw) < 0.5 || Math.abs(th) < 0.5) return;   // the paper-thin sides of a cover or a page
                var n = F[5], nz = Mp[8] * n[0] + Mp[9] * n[1] + Mp[10] * n[2];
                if (nz <= 0) return;   // turned away
                var nx = Mp[0] * n[0] + Mp[1] * n[1] + Mp[2] * n[2], ny = Mp[4] * n[0] + Mp[5] * n[1] + Mp[6] * n[2], nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
                // the inventory's two lights, from above and in front
                var l = Math.max(0, (-0.25 * nx - 0.6 * ny + 0.76 * nz) / nl) + Math.max(0, (0.25 * nx - 0.2 * ny + 0.95 * nz) / nl) * 0.35;
                var k = Math.max(6, Math.min(16, Math.round(16 * (0.4 + 0.6 * Math.min(1, l)))));
                var q = F[0], a = V[q[1]], b = V[q[0]], d = V[q[2]];   // vertex 1 holds (u1, v1), 0 holds (u2, v1), 2 holds (u1, v2)
                quads.push({ z: (V[q[0]][2] + V[q[1]][2] + V[q[2]][2] + V[q[3]][2]) / 4, o: a, ux: b[0] - a[0], uy: b[1] - a[1], vx: d[0] - a[0], vy: d[1] - a[1],
                             su: Math.min(F[1], F[3]), sv: Math.min(F[2], F[4]), tw: tw, th: th, k: k });
            });
        });
        quads.sort(function (p, q) { return p.z - q.z; });
        quads.forEach(function (Q) {
            var aw = Math.abs(Q.tw), ah = Math.abs(Q.th);
            c.setTransform(Q.ux / Q.tw, Q.uy / Q.tw, Q.vx / Q.th, Q.vy / Q.th, Q.o[0], Q.o[1]);
            // the rectangle is read from its (u1, v1) corner, whichever way round the face has it
            c.drawImage(ebShaded(Q.k), Q.su, Q.sv, aw, ah, Q.tw < 0 ? -aw : 0, Q.th < 0 ? -ah : 0, aw, ah);
        });
        c.setTransform(1, 0, 0, 1, 0, 0);
    }
    function enchBookTarget() {}   // tickBook notices the change on its own next tick
    function enchBookFrame(dt) {
        var cv = RT.el.querySelector('.mc-panelwrap .mc-ebook');
        if (!cv) return;
        var B = RT.ebook || (RT.ebook = { open: 0, oOpen: 0, flip: 0, oFlip: 0, flipT: 0, flipA: 0, last: '', acc: 0 });
        B.acc += Math.min(0.25, dt || 0);
        while (B.acc >= HUD_TICK) { B.acc -= HUD_TICK; ebTick(B); }
        ebDraw(cv, B, B.acc / HUD_TICK);
    }
    function takeCraft(shiftAll) {
        var guard = 0;
        do {
            var r = matchRecipe(RT.craft, RT.craftW);
            if (!r) return;
            if (shiftAll) {
                if (invFree(r.out) < r.n) return;   // must fit fully, or we'd deposit output without consuming ingredients
                var rmd = itemMaxDur(r.out);   // the result slot shift-clicks in backwards: the hotbar's right-hand end first
                moveStackTo({ id: r.out, c: r.n, dur: rmd != null ? rmd : undefined }, invOrder(0, 36), true);
            } else {
                if (RT.cur && (RT.cur.id !== r.out || RT.cur.c + r.n > stkMax(r.out))) return;
                if (RT.cur) RT.cur.c += r.n;
                else {
                    RT.cur = { id: r.out, c: r.n };
                    // itemMaxDur covers tools, ARMOUR (dur lives under .armor) and plain dur items.
                    // The old .tool||.dur test missed armour, so a crafted helmet came off the
                    // output slot with no dur at all: never wore out, no durability bar, and the
                    // anvil refused it (repair needs a.dur != null).
                    var cmd = itemMaxDur(r.out);
                    if (cmd != null) RT.cur.dur = cmd;
                }
            }
            for (var i = 0; i < 9; i++) if (RT.craft[i]) { RT.craft[i].c--; if (!RT.craft[i].c) RT.craft[i] = null; }
            stat('cr', r.out, r.n);
            craftHooks(r.out);
            rbLearn(['c:' + r.out]);   // making it teaches it
            snd('click');
        } while (shiftAll && guard++ < 64);
    }
    /* ── shift-click: each menu's own quickMoveStack ────────────
       Where a shift-clicked stack goes is the menu's rule, and the player's
       slots are always walked in the order a menu lists them, the backpack
       (9-35) then the hotbar (0-8), by moveItemStackTo: one pass topping up
       matching stacks, then the first empty slot that takes it, both run
       backwards when the menu says so. That is why a crafting result or a
       chest's stack lands at the right-hand end of the hotbar first. */
    var INV_ORDER = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 0, 1, 2, 3, 4, 5, 6, 7, 8];
    function invOrder(a, b) { return INV_ORDER.slice(a, b); }
    function slotRef(x) {
        var g = typeof x === 'number' ? 'inv' : x[0], i = typeof x === 'number' ? x : x[1], grp = slotGroup(g);
        return { get: function () { return grp.get(i); }, set: function (v) { grp.set(i, v); },
                 max: function (st) { return slotMaxFor(g, st.id); }, accepts: function (st) { return slotAccepts(g, i, st); } };
    }
    function moveStackTo(st, slots, reverse) {   // returns what is left over
        var list = reverse ? slots.slice().reverse() : slots, k, ref, it, max = stkMax(st.id);
        var left = { id: st.id, c: st.c, dur: st.dur, ench: st.ench, name: st.name };
        if (max > 1) for (k = 0; k < list.length && left.c > 0; k++) {
            ref = slotRef(list[k]); it = ref.get();
            if (it && sameStack(it, left)) { var room = Math.min(max, ref.max(left)) - it.c; if (room > 0) { var a = Math.min(room, left.c); it.c += a; left.c -= a; } }
        }
        if (left.c > 0) for (k = 0; k < list.length; k++) {
            ref = slotRef(list[k]);
            if (!ref.get() && ref.accepts(left)) {
                var put = Math.min(left.c, ref.max(left));
                ref.set({ id: left.id, c: put, dur: left.dur, ench: left.ench, name: left.name });
                left.c -= put;
                break;
            }
        }
        return left.c;
    }
    function quickMove(g, idx) {
        var grp = slotGroup(g), st = grp.get(idx);
        if (!st) return;
        var kind = RT.panel.kind, left = st.c, def = I[st.id], q;
        // shift-clicking your own stack while the catalogue is up throws it away.
        // There is nowhere for it to go, and the real screen deletes it too.
        if (kind === 'creative' && (CTABS[RT.cTab] || CTABS[0]).id !== 'inv') {
            grp.set(idx, null); snd('click'); paintPanel();
            return;
        }
        if (g === 'inv') {
            var other = idx >= 9 ? invOrder(27, 36) : invOrder(0, 27);   // the backpack to the hotbar and back
            if (kind === 'inv' || kind === 'creative') {
                // InventoryMenu: a piece of armour goes on if its slot is free
                var adef = def && def.armor;
                if (adef && !S.armor[adef.slot]) {
                    slotGroup('armor').set(adef.slot, st);   // via the setter, so "Suit Up" fires
                    grp.set(idx, null); paintVitals(); paintPanel();
                    return;
                }
                left = moveStackTo(st, other, false);
            } else if (kind === 'table') {   // CraftingMenu: into the grid first
                var grid = []; for (q = 0; q < 9; q++) grid.push(['craft', q]);
                left = moveStackTo(st, grid, false);
                if (left === st.c) left = moveStackTo(st, other, false);
            } else if (kind === 'chest') {
                var box = []; for (q = 0; q < 27; q++) box.push(['chest', q]);
                left = moveStackTo(st, box, false);
            } else if (kind === 'furnace') {   // what smelts to the top, what burns to the fuel, and no further
                if (SMELTS[st.id]) left = moveStackTo(st, [['fin', 0]], false);
                else if (def && def.fuel) left = moveStackTo(st, [['ffuel', 0]], false);
                else left = moveStackTo(st, other, false);
            } else if (kind === 'ench') {   // lapis to its slot; anything else, one of it onto the table if it is free
                if (st.id === 'lapis') left = moveStackTo(st, [['elapis', 0]], true);
                else if (!RT.enchItem) { slotGroup('ein').set(0, { id: st.id, c: 1, dur: st.dur, ench: st.ench, name: st.name }); left = st.c - 1; }
            } else if (kind === 'anvil') {
                left = moveStackTo(st, [['anvA', 0], ['anvB', 0]], false);
                if (left === st.c) left = moveStackTo(st, other, false);
            }
        } else {
            if (g === 'fout' && st.id === 'iron') unlock('iron');
            // a container's own slots and the furnace's output go in backwards; the grid, armour and off hand forwards
            left = moveStackTo(st, invOrder(0, 36), g === 'chest' || g === 'fout' || g === 'ein' || g === 'elapis');
        }
        if (left === st.c) return;   // nowhere for it to go: nothing moves
        if (left > 0) st.c = left; else grp.set(idx, null);
        if (g === 'armor') paintVitals();   // shift-clicking a piece OFF changes the bar too
        paintPanel();
    }
    function giveInto(arr, n, st) {
        var c = st.c, max = stkMax(st.id), i;
        for (i = 0; i < n && c > 0; i++) if (arr[i] && arr[i].id === st.id && arr[i].c < max && st.dur == null && !st.ench && !arr[i].ench) { var a = Math.min(max - arr[i].c, c); arr[i].c += a; c -= a; }
        for (i = 0; i < n && c > 0; i++) if (!arr[i]) { arr[i] = { id: st.id, c: Math.min(max, c), dur: st.dur, ench: st.ench, name: st.name }; c -= arr[i].c; }
        return c;
    }
    function mergeSlot(t, field, st) {
        var cur = t[field], max = stkMax(st.id);
        // carry the enchantments and the name across: shift-clicking an Efficiency
        // pickaxe into a furnace as fuel and pulling it back used to strip it
        if (!cur) { t[field] = { id: st.id, c: st.c, dur: st.dur, ench: st.ench, name: st.name }; return 0; }
        if (cur.id === st.id && cur.c < max) { var a = Math.min(max - cur.c, st.c); cur.c += a; return st.c - a; }
        return st.c;
    }
    function invGiveRange(id, n, dur, from, to, enchObj, name) {
        var max = stkMax(id), i;
        if (max > 1 && dur == null && !enchObj) for (i = from; i < to && n > 0; i++) {
            var s = S.inv[i];
            if (s && s.id === id && s.c < max && !s.ench) { var add = Math.min(max - s.c, n); s.c += add; n -= add; }
        }
        for (i = from; i < to && n > 0; i++) if (!S.inv[i]) { S.inv[i] = { id: id, c: Math.min(max, n), dur: dur, ench: enchObj || undefined, name: name || undefined }; n -= S.inv[i].c; }
        return n;
    }
    function slotAccepts(g, idx, item) {
        if (!item) return true;
        if (g === 'armor') return !!(I[item.id] && I[item.id].armor && I[item.id].armor.slot === idx);
        if (g === 'elapis') return item.id === 'lapis';
        return true;
    }
    function slotClick(g, idx, right, shift) {
        rbGhostHit(g);
        if (g === 'cout') { takeCraft(shift); paintPanel(); paintHotbar(); return; }
        if (g === 'anvOut') { applyAnvil(shift); return; }
        if (g === 'creat') { creativeClick(idx, right, shift); return; }
        if (g === 'ctrash') {
            // shift-clicking the bin empties everything you own, the way the real
            // one does. Gated on creative — it is the most destructive click here.
            if (shift && instaBuild()) {
                for (var z = 0; z < 36; z++) S.inv[z] = null;
                for (z = 0; z < 4; z++) S.armor[z] = null;
                for (z = 0; z < 9; z++) RT.craft[z] = null;
                paintVitals(); paintArmorBar();
            }
            RT.cur = null;
            snd('click'); paintPanel(); paintHotbar();
            return;
        }
        // shift-click is the most-used gesture in the whole screen and was the only
        // one that made no sound at all
        if (shift) { quickMove(g, idx); snd('click'); paintHotbar(); return; }
        var grp = slotGroup(g), st = grp.get(idx);
        if (RT.cur && !slotAccepts(g, idx, RT.cur)) return;   // wrong item for this special slot
        if (g === 'fout') {   // output: take only
            if (!st) return;
            if (!RT.cur) { RT.cur = st; grp.set(idx, null); stat('cr', st.id, st.c); if (st.id === 'iron') unlock('iron'); }
            else if (RT.cur.id === st.id && RT.cur.c + st.c <= stkMax(st.id)) { RT.cur.c += st.c; grp.set(idx, null); if (st.id === 'iron') unlock('iron'); }
            snd('click');   // taking a crafted item clicks; taking a smelted one was silent
            paintPanel(); return;
        }
        if (!right) {
            if (RT.cur && st && RT.cur.id === st.id && st.dur == null && RT.cur.dur == null) {
                var max = stkMax(st.id), a = Math.min(max - st.c, RT.cur.c);
                st.c += a; RT.cur.c -= a;
                if (!RT.cur.c) RT.cur = null;
            } else { grp.set(idx, RT.cur); RT.cur = st; }
        } else {
            if (!RT.cur && st) {
                var half = Math.ceil(st.c / 2);
                RT.cur = { id: st.id, c: half, dur: st.dur, ench: st.ench, name: st.name };
                st.c -= half;
                if (!st.c) grp.set(idx, null);
            } else if (RT.cur && (!st || (st.id === RT.cur.id && st.c < stkMax(st.id) && st.dur == null && RT.cur.dur == null))) {
                if (st) st.c++;
                else grp.set(idx, { id: RT.cur.id, c: 1, dur: RT.cur.dur, ench: RT.cur.ench, name: RT.cur.name });
                RT.cur.c--;
                if (!RT.cur.c) RT.cur = null;
            }
        }
        snd('click');
        // dragging armour in or out changes the defence bar, and shift-clicking it
        // already repaints on the spot — without this the drag path waited for the
        // 0.2s HUD tick and the bar lagged behind the click that caused it
        if (g === 'armor') paintVitals();
        paintPanel(); paintHotbar();
    }
    /* The carried stack is drawn with its top-left at (mouse - 8, mouse - 8) in
       whole GUI pixels, so it sits centred on the pointer's hot spot and moves
       a GUI pixel at a time, as the game's does. */
    function panelCurTo(clientX, clientY) {
        if (!RT || !RT.el) return;
        if (clientX != null) RT.curXY = [clientX, clientY];
        if (RT.av && clientX != null) { RT.av.mx = clientX; RT.av.my = clientY; }   // the figure watches the pointer
        var xy = RT.curXY;
        if (!xy || !RT.gs) return;
        var wrap = RT.el.querySelector('.mc-panelwrap');
        if (!wrap) return;
        var r = RT.el.getBoundingClientRect(), s = RT.gs;
        var cur = wrap.querySelector('.mc-cur');
        if (cur) { cur.style.left = ((Math.floor((xy[0] - r.left) / s) - 8) * s) + 'px'; cur.style.top = ((Math.floor((xy[1] - r.top) / s) - 8) * s) + 'px'; }
    }
    /* ── tooltips ─────────────────────────────────────────────
       What an item says about itself, the 1.21 way: the name in its rarity's
       colour (italic when renamed), its enchantments in grey, and for a tool,
       weapon or piece of armour a blank line, the slot it works from, and what
       it adds: attack damage and speed as the totals in dark green with a
       leading space, armour as +N in blue. In the creative catalogue the tabs
       an item appears on follow its name, in blue. */
    function fmt2(v) { return String(Math.round(v * 100) / 100); }
    function itemTipLines(st, g) {
        var def = I[st.id] || {}, L = [{ t: st.tname || itemName(st), c: RARITY_COL[itemRarity(st)], it: !!st.name }];
        if (st.lock) return L;   // the Saved Hotbars placeholder is only its instructions
        /* the creative screen names every category tab an item is on, right under its
           name: everywhere except a category tab's own catalogue */
        var tid = RT.panel && RT.panel.kind === 'creative' ? (CTABS[RT.cTab] || {}).id : null;
        if (tid && !(tid !== 'search' && tid !== 'inv' && tid !== 'hotbar' && g === 'creat')) {
            var tabs = creativeTables();
            CTABS.forEach(function (T) { if (tabs[T.id] && tabs[T.id].indexOf(st.id) >= 0) L.push({ t: T.t, c: '#5555ff' }); });
        }
        if (st.ench) for (var k in st.ench) L.push({ t: (ENCH_NAME[k] || k) + ((ENCH_MAX[k] || 1) > 1 || st.ench[k] > 1 ? ' ' + (ROMAN[st.ench[k]] || st.ench[k]) : ''), c: '#aaaaaa' });
        var tl = def.tool, ar = def.armor;
        if (tl) {
            L.push({ t: '' }, { t: 'When in Main Hand:', c: '#aaaaaa' },
                { t: ' ' + fmt2(tl.dmg + (ench(st, 'sharp') > 0 ? 0.5 * ench(st, 'sharp') + 0.5 : 0)) + ' Attack Damage', c: '#00aa00' },
                { t: ' ' + fmt2(attackSpeed(st.id)) + ' Attack Speed', c: '#00aa00' });
        } else if (ar) {
            L.push({ t: '' }, { t: ['When on Head:', 'When on Chest:', 'When on Legs:', 'When on Feet:'][ar.slot], c: '#aaaaaa' },
                { t: '+' + fmt2(ar.def || 0) + ' Armor', c: '#5555ff' });
            if (ar.tough) L.push({ t: '+' + fmt2(ar.tough) + ' Armor Toughness', c: '#5555ff' });
        }
        return L;
    }
    /* The enchanting table's clue: the enchantment's name in grey and " . . . ?"
       in white; in survival a blank line and then either the level it needs, in
       red, or the lapis and the levels it will take. */
    function enchTipLines(o) {
        var op = RT.enchOpts && RT.enchOpts[o];
        if (!op || !op.ench) return null;
        var main = Object.keys(op.ench)[0], lv = op.ench[main];
        var L = [{ segs: [{ t: (ENCH_NAME[main] || main) + ((ENCH_MAX[main] || 1) > 1 ? ' ' + (ROMAN[lv] || lv) : ''), c: '#aaaaaa' }, { t: ' . . . ?', c: '#ffffff' }] }];
        if (instaBuild()) return L;
        L.push({ t: '' });
        if (S.xpl < op.level) L.push({ t: 'Level Requirement: ' + op.level, c: '#ff5555' });
        else {
            var lap = RT.enchLapis ? RT.enchLapis.c : 0;
            L.push({ t: op.lapis === 1 ? '1 Lapis Lazuli' : op.lapis + ' Lapis Lazuli', c: lap < op.lapis ? '#ff5555' : '#aaaaaa' });
            L.push({ t: op.lapis === 1 ? '1 Enchantment Level' : op.lapis + ' Enchantment Levels', c: '#aaaaaa' });
        }
        return L;
    }
    /* Drawn the way the game draws one: the text starts 12 right of and 12
       above the pointer (flipping left of it at the screen's edge), each line
       with its shadow, a 2-pixel gap after the first; round it a #100010
       background at alpha 240 reaching 4 pixels out with its corners cut, and
       inside that a 1-pixel ring 3 out running from #5000FF at the top to
       #290080 at the bottom, both at alpha 80. */
    function tipRender(lines, clientX, clientY, tipEl) {
        var wrap = RT.el.querySelector('.mc-panelwrap'), tip = tipEl || (wrap && wrap.querySelector('.mc-ptip'));
        if (!tip) return;
        if (!lines || !lines.length) { tip.style.display = 'none'; tip._sig = ''; return; }
        var r = RT.el.getBoundingClientRect(), s = RT.gs, mx = Math.floor((clientX - r.left) / s), my = Math.floor((clientY - r.top) / s);
        var w = 0, sig = '';
        lines.forEach(function (l) {
            var segs = l.segs || [{ t: l.t, c: l.c, it: l.it }], lw = 0;
            segs.forEach(function (sg) { lw += sg.t ? mfWidth(sg.t) + 1 : 0; sig += sg.t + '|' + sg.c + '|'; });
            w = Math.max(w, lw);
        });
        var h = lines.length === 1 ? 8 : 10 * lines.length;
        var tx = mx + 12, ty = my - 12;
        if (tx + w > RT.gw) tx = Math.max(mx - 12 - w, 4);
        if (ty + h + 3 > RT.gh) ty = RT.gh - h - 3;
        if (tip._sig !== sig) {
            tip._sig = sig;
            var html = '<i class="mc-tipf"></i>';
            lines.forEach(function (l, k) {
                var y = 4 + (k ? 2 + 10 * k : 0), x = 4;
                (l.segs || [{ t: l.t, c: l.c, it: l.it }]).forEach(function (sg) {
                    if (sg.t) html += '<span class="mc-tipl" style="' + pAt(x, y) + '">' + mtHTML(sg.t, sg.c || '#ffffff', sg.it ? 'it' : '') + '</span>';
                    x += sg.t ? mfWidth(sg.t) + 1 : 0;
                });
            });
            tip.innerHTML = html;
            tip.style.width = 'calc(var(--px) * ' + (w + 8) + ')';
            tip.style.height = 'calc(var(--px) * ' + (h + 8) + ')';
        }
        tip.style.display = 'block';
        tip.style.left = ((tx - 4) * s) + 'px';
        tip.style.top = ((ty - 4) * s) + 'px';
    }
    /* ── what the pointer is over ─────────────────────────────
       AbstractContainerScreen keeps one hovered slot, found by the 18x18 frame
       test, and draws 1.21.2's highlight in two halves: white at alpha 96
       behind the item and 32 over it and its count. The tooltip is what that
       slot holds (nothing while a stack is carried), or a creative tab's name,
       an enchanting option's clue, the bin's "Destroy Item". */
    function panelHover(target, clientX, clientY) {
        var wrap = RT.el.querySelector('.mc-panelwrap');
        if (!wrap || !RT.panel) return;
        var under = slotAt(target, wrap), el = target && target.closest ? target : null;
        var tabEl = el && el.closest('.mc-ctab'), eo = el && el.closest('.mc-enchopt'), rbEl = el && el.closest('.mc-rbr, .mc-rbfilter');
        var hovEl = under ? under.el : null;
        if (RT.hovEl !== hovEl) {
            if (RT.hovEl) RT.hovEl.classList.remove('hov');
            if (hovEl) hovEl.classList.add('hov');
            RT.hovEl = hovEl;
        }
        RT.hover = under ? { g: under.g, i: under.i } : null;   // the slot under the pointer, for the number keys, F and Q
        var lines = null;
        if (tabEl) { var td = CTABS[tabEl.getAttribute('data-ct') | 0]; if (td) lines = [{ t: td.t }]; }
        else if (eo) lines = enchTipLines(eo.getAttribute('data-o') | 0);
        else if (rbEl) lines = rbTip(rbEl);
        // GhostSlots.renderTooltip: over a ghost, with the book open, the ghost's item
        else if (under && RT.rbGhostAt && RT.rbGhostAt[under.g + ':' + under.i] && rbShown()) lines = itemTipLines({ id: RT.rbGhostAt[under.g + ':' + under.i], c: 1 }, under.g);
        else if (under && under.g === 'ctrash') lines = [{ t: 'Destroy Item' }];
        else if (under && !RT.cur) { var st = slotStackAt(under.g, under.i); if (st) lines = itemTipLines(st, under.g); }
        tipRender(lines, clientX, clientY);
    }
    function slotStackAt(g, i) {   // what a slot shows, the outputs included
        if (g === 'cout') { var rr = matchRecipe(RT.craft, RT.craftW); return rr ? { id: rr.out, c: rr.n } : null; }
        if (g === 'anvOut') { var ar = anvilResult(); return ar && !ar.tooExp ? ar.out : null; }
        if (g === 'ctrash') return null;
        var gp = slotGroup(g);
        return gp ? gp.get(i) : null;
    }
    /* the game redraws every frame, so a slot that changes under a still pointer
       changes its tooltip at once; this is that, after any repaint */
    function panelHoverRefresh() {
        var xy = RT.curXY;
        if (!xy || !RT.panel) return;
        panelHover(document.elementFromPoint(xy[0], xy[1]), xy[0], xy[1]);
    }
    /* per frame while a screen is up: the text boxes' blinking cursors, and the enchanting table's book */
    function panelFrame(dt) {
        var wrap = RT.el.querySelector('.mc-panelwrap');
        if (!wrap || !RT.panel) return;
        var a = wrap.querySelector('.mc-anvin'), sb = wrap.querySelector('.mc-csearchin');
        if (a) paintFieldMirror(a, wrap.querySelector('.mc-anvmir'), '#ffffff', 103);
        if (sb) paintFieldMirror(sb, wrap.querySelector('.mc-csmir'), '#ffffff', 80);
        if (RT.panel.kind === 'ench') enchBookFrame(dt || 0);
        rbFrameTick(dt || 0);
    }
    /* ── drag-splitting — the real game's "quick craft" ──────────
       With a stack on the cursor, pressing a mouse button over a slot is NOT
       the placement; it is the start of a sweep. Drag across slots and letting
       go divides the stack among them: the left button splits it evenly, the
       right drops one into each, the middle (creative only) fills each with a
       full stack. Sweep a single slot and it is the ordinary click it always
       was. Four planks dragged across the 2×2 grid is how a crafting table is
       actually made.

       This follows AbstractContainerScreen.mouseClicked / mouseDragged /
       mouseReleased and the QUICK_CRAFT stage of AbstractContainerMenu.doClick
       rule for rule, including the ones a player feels: you cannot sweep more
       slots than you have items, a slot already holding the same item joins
       the sweep and fills to its limit, the count each slot would get and what
       would be left on the cursor are shown while the button is still down,
       and a press with an EMPTY cursor still acts on the press, so picking up
       and letting go on the same slot never puts the stack straight back.

       Two neighbours of the same code came with it, because they live in the
       same three mouse handlers in the real game: double-clicking with a stack
       on the cursor gathers every matching stack on screen into it, and a
       click on the dark outside the panel throws the cursor stack into the
       world — the whole stack on the left button, one on the right. */
    var QC_TARGETS = { inv: 1, chest: 1, craft: 1, armor: 1, off: 1, fin: 1, ffuel: 1, ein: 1, elapis: 1, anvA: 1, anvB: 1 };
    var QC_BTN_MASK = [1, 4, 2];   // e.buttons bit for e.button 0 / 1 / 2
    function sameStack(a, b) {
        return !!a && !!b && a.id === b.id && a.dur == null && b.dur == null && !a.ench && !b.ench && (a.name || '') === (b.name || '');
    }
    function slotMaxFor(g, id) { return g === 'ein' ? 1 : stkMax(id); }   // the enchanting slot takes one item, like the real one
    // vanilla's canItemQuickReplace + Slot.mayPlace + canDragTo, in one question
    function qcAccepts(g, idx, item) {
        if (!QC_TARGETS[g] || !item || !slotAccepts(g, idx, item)) return false;
        var grp = slotGroup(g), st = grp ? grp.get(idx) : null;
        return !st || sameStack(st, item);
    }
    function slotAt(el, wrap) {   // the slot under an event target, or null
        while (el && el !== wrap && el.getAttribute && !el.getAttribute('data-g')) el = el.parentNode;
        if (!el || el === wrap || !el.getAttribute) return null;
        return { el: el, g: el.getAttribute('data-g'), i: el.getAttribute('data-i') | 0 };
    }
    function qcPlaceCount(q, carried) {   // getQuickCraftPlaceCount
        return q.type === 0 ? Math.floor(carried.c / q.slots.length) : q.type === 1 ? 1 : stkMax(carried.id);
    }
    /* what the sweep would do if the button came up now: the count each slot
       would hold (null = this slot cannot take it), whether that count had to be
       clamped to the slot's limit, and what the cursor would keep. The remainder
       for a creative middle-sweep is a full stack, as the real screen shows it. */
    function qcPlan(q) {
        var carried = RT.cur, n = q.slots.length, left = carried.c, counts = [], over = [];
        for (var k = 0; k < n; k++) {
            var s = q.slots[k], st = slotGroup(s.g).get(s.i);
            if (!qcAccepts(s.g, s.i, carried) || (q.type !== 2 && carried.c < n)) { counts.push(null); over.push(false); continue; }
            var have = st ? st.c : 0, want = qcPlaceCount(q, carried) + have;
            var cap = Math.min(stkMax(carried.id), slotMaxFor(s.g, carried.id));
            var cnt = Math.min(want, cap);
            left -= cnt - have;
            counts.push(cnt); over.push(want > cap);
        }
        return { counts: counts, over: over, left: q.type === 2 ? stkMax(carried.id) : left };
    }
    function qcStart(type, btn, g, i, dbl) {
        RT.qc = { type: type, btn: btn, slots: [], dbl: !!dbl };
        if (g) qcAdd(g, i);
    }
    function qcAdd(g, i) {
        var q = RT.qc;
        if (!q || !RT.cur) return;
        for (var k = 0; k < q.slots.length; k++) if (q.slots[k].g === g && q.slots[k].i === i) return;
        if (!qcAccepts(g, i, RT.cur)) return;
        if (q.type !== 2 && RT.cur.c <= q.slots.length) return;   // never more slots than items
        q.slots.push({ g: g, i: i });
        rbGhostHit(g);   // a sweep across the grid is a click on it
        qcPaint();
    }
    function qcCancel() {
        if (!RT.qc) return;
        RT.qc = null;
        if (RT.panel) paintPanel();
    }
    /* the live preview, AbstractContainerScreen's quick-craft rendering: each
       swept slot shows the stack it would end up with over a 0x80FFFFFF wash,
       its count in yellow where the slot's limit clipped it; the cursor shows
       what it would keep, and nothing at all when that is nothing */
    function qcPaint() {
        var q = RT.qc, wrap = RT.el && RT.el.querySelector('.mc-panelwrap');
        if (!q || !RT.cur || !wrap) return;
        var cells = wrap.querySelectorAll('.mc-slot.qc');
        for (var c = 0; c < cells.length; c++) cells[c].classList.remove('qc');
        var cur = wrap.querySelector('.mc-cur');
        if (q.slots.length < 2) { if (cur) paintSlot(cur, RT.cur); return; }
        var plan = qcPlan(q);
        for (var k = 0; k < q.slots.length; k++) {
            var s = q.slots[k], cnt = plan.counts[k];
            if (cnt == null) continue;
            var el = wrap.querySelector('.mc-slot[data-g="' + s.g + '"][data-i="' + s.i + '"]');
            if (!el) continue;
            paintSlot(el, { id: RT.cur.id, c: cnt, dur: RT.cur.dur, ench: RT.cur.ench });
            if (plan.over[k]) {   // clipped by the slot's limit: the count goes yellow, even a 1
                var ct = el.querySelector('.mc-ct'), html = mtHTML(String(cnt), '#ffff55', 'mc-ct');
                if (ct) ct.outerHTML = html; else el.insertAdjacentHTML('beforeend', html);
            }
            el.classList.add('qc');
        }
        if (cur) paintSlot(cur, plan.left > 0 ? { id: RT.cur.id, c: plan.left, dur: RT.cur.dur, ench: RT.cur.ench } : null);
    }
    /* the button came up: two or more slots swept is a split, one is the click
       it would have been, none is the click on wherever the pointer is now */
    function qcEnd(e) {
        var q = RT.qc;
        if (!q) return;
        if (e.button !== q.btn) { qcCancel(); return; }   // the other button letting go abandons the sweep
        RT.qc = null;
        var wrap = RT.el.querySelector('.mc-panelwrap');
        // a release reported without an element under it (the pointer left the
        // page, or a synthetic event) is placed by its coordinates instead
        var tgt = e.target && e.target.nodeType === 1 ? e.target : (e.clientX != null ? document.elementFromPoint(e.clientX, e.clientY) : null);
        var over = slotAt(tgt, wrap), right = q.btn === 2, shift = !!e.shiftKey;
        /* a double-click gathers — except over the catalogue (one more click there) and
           over an output slot, which the real menu exempts from PICKUP_ALL so that fast
           clicks on the result craft every time */
        if (q.dbl && q.btn === 0 && RT.cur && over && qcGatherable(over.g)) { pickupAll(over); return; }
        if (q.slots.length >= 2) { qcApply(q); return; }
        // a middle sweep of exactly one slot re-dispatches as the secondary click: one item placed
        if (q.btn === 1) { if (q.slots.length === 1) slotClick(q.slots[0].g, q.slots[0].i, true, false); else paintPanel(); return; }
        if (q.slots.length === 1) { slotClick(q.slots[0].g, q.slots[0].i, right, shift); return; }
        if (over) { slotClick(over.g, over.i, right, shift); return; }
        if (RT.cur && wrap && tgt && wrap.contains(tgt) && !(tgt.closest && tgt.closest('.mc-panel'))) throwCarried(right);
        else paintPanel();
    }
    function qcGatherable(g) { return g !== 'creat' && g !== 'cout' && g !== 'fout' && g !== 'anvOut' && g !== 'ctrash'; }
    function qcApply(q) {
        var carried = RT.cur;
        if (!carried) return;
        var plan = qcPlan(q), total = carried.c, armorTouched = false;
        for (var k = 0; k < q.slots.length; k++) {
            var cnt = plan.counts[k];
            if (cnt == null) continue;
            var s = q.slots[k], grp = slotGroup(s.g), st = grp.get(s.i), have = st ? st.c : 0;
            total -= cnt - have;
            grp.set(s.i, { id: carried.id, c: cnt, dur: carried.dur, ench: carried.ench, name: carried.name });
            if (s.g === 'armor') armorTouched = true;
        }
        // the real game does this arithmetic too: a creative middle-sweep runs the
        // cursor count below zero, which is an empty cursor
        RT.cur = total > 0 ? { id: carried.id, c: total, dur: carried.dur, ench: carried.ench, name: carried.name } : null;
        if (armorTouched) paintVitals();
        snd('click');
        paintPanel(); paintHotbar();
    }
    /* PICKUP_ALL: double-click with a stack on the cursor and every matching
       stack the screen can see is pulled into it — partial stacks first, full
       ones second, never from an output slot, and only until the cursor is full */
    function pickupAll(over) {
        var cur = RT.cur;
        if (!cur) return;
        var overSt = slotGroup(over.g) && slotGroup(over.g).get(over.i);
        if (overSt || over.g === 'cout' || over.g === 'fout' || over.g === 'anvOut') { paintPanel(); return; }
        var max = stkMax(cur.id), groups = [], k = RT.panel.kind, i;
        // the slots this screen actually shows, in the real menu's order: its own, then the backpack, then the hotbar
        var catalogueTab = k === 'creative' && (CTABS[RT.cTab] || CTABS[0]).id !== 'inv';
        if (k === 'chest') for (i = 0; i < 27; i++) groups.push(['chest', i]);
        if (k === 'furnace') groups.push(['fin', 0], ['ffuel', 0]);
        if (k === 'ench') groups.push(['ein', 0], ['elapis', 0]);
        if (k === 'anvil') groups.push(['anvA', 0], ['anvB', 0]);
        if (k === 'inv' || k === 'table') for (i = 0; i < RT.craftW * RT.craftW; i++) groups.push(['craft', i]);
        if (k === 'inv' || (k === 'creative' && !catalogueTab)) { for (i = 0; i < 4; i++) groups.push(['armor', i]); }
        if (!catalogueTab) for (i = 9; i < 36; i++) groups.push(['inv', i]);   // a catalogue tab shows only the hotbar
        for (i = 0; i < 9; i++) groups.push(['inv', i]);
        if (k === 'inv' || (k === 'creative' && !catalogueTab)) groups.push(['off', 0]);
        for (var pass = 0; pass < 2 && cur.c < max; pass++) {
            for (var g = 0; g < groups.length && cur.c < max; g++) {
                var grp = slotGroup(groups[g][0]), st = grp.get(groups[g][1]);
                if (!st || !sameStack(st, cur)) continue;
                if (pass === 0 && st.c === stkMax(st.id)) continue;   // full stacks wait for the second pass
                var take = Math.min(st.c, max - cur.c);
                cur.c += take; st.c -= take;
                if (!st.c) grp.set(groups[g][1], null);
            }
        }
        if (RT.lastClk) RT.lastClk.t = 0;   // the gather spends the double-click, as the real one does
        snd('click');
        paintPanel(); paintHotbar();
    }
    /* SWAP: a number key over a slot trades what is there with that hotbar
       slot, both ways round, honouring what the slot will take, and F (the
       menu's button 40) does the same with the off hand; over a catalogue
       entry it is a full stack straight into that slot, over an output slot
       it takes the result if the slot is free. (AbstractContainerMenu.doClick
       SWAP, and the creative screen's own SWAP branch.) */
    function hoverSwap(n) {
        var h = RT.hover;
        if (!h || h.g === 'ctrash') return;   // the bin only ever clears the cursor
        rbGhostHit(h.g);
        var hbGet = function () { return n === 40 ? S.off || null : S.inv[n]; };
        var hbSet = function (v) { if (n === 40) S.off = v || null; else S.inv[n] = v || null; };
        var hb = hbGet();
        if (h.g === 'creat') {
            var cst = slotGroup('creat').get(h.i);
            if (!cst || cst.lock) return;
            cst.c = stkMax(cst.id);
            hbSet(cst);
        } else if (h.g === 'cout' || h.g === 'fout' || h.g === 'anvOut') {
            if (hb) return;   // an output slot cannot take the hotbar's stack
            if (h.g === 'cout') { takeCraft(false); hbSet(RT.cur); RT.cur = null; }   // the cursor is empty here, so the result lands on it
            else if (h.g === 'fout') { var t = S.tents[RT.panel.key]; if (!t || !t.out) return; hbSet(t.out); t.out = null; if (hbGet().id === 'iron') unlock('iron'); }
            else return;
        } else {
            if ((h.g === 'inv' && h.i === n) || (h.g === 'off' && n === 40)) return;
            var grp = slotGroup(h.g);
            if (!grp) return;
            var st = grp.get(h.i);
            if (!st && !hb) return;
            if (hb && !slotAccepts(h.g, h.i, hb)) return;   // an armour slot only takes its own piece
            if (hb && !st && slotMaxFor(h.g, hb.id) < hb.c) {   // an empty one-item slot takes one off the stack
                grp.set(h.i, { id: hb.id, c: 1, dur: hb.dur, ench: hb.ench, name: hb.name });
                hb.c -= 1;
            } else {
                if (hb && slotMaxFor(h.g, hb.id) < hb.c) return;
                grp.set(h.i, hb || null);
                hbSet(st || null);
            }
            if (h.g === 'armor') paintVitals();
        }
        snd('click');
        paintPanel(); paintHotbar();
    }
    /* THROW from a hovered slot: Q drops one, Ctrl-Q the stack — never out of the
       catalogue's own entries or an output slot */
    function hoverThrow(all) {
        var h = RT.hover;
        if (!h || h.g === 'fout' || h.g === 'anvOut' || h.g === 'ctrash') return;
        rbGhostHit(h.g);
        if (h.g === 'creat') {   // the catalogue hands one out to throw, a stack with Ctrl
            var cst = slotGroup('creat').get(h.i);
            if (!cst || cst.lock) return;
            tossItem(cst, all ? stkMax(cst.id) : 1);
            paintPanel(); return;
        }
        if (h.g === 'cout') {    // the result slot crafts once and throws what it made — Ctrl too, as the real THROW takes the slot's count
            takeCraft(false);     // the cursor is empty here (the key is gated on it), so the result lands on it
            var made = RT.cur; RT.cur = null;
            if (!made) return;
            tossItem(made, made.c);
            paintPanel(); paintHotbar(); return;
        }
        var grp = slotGroup(h.g), st = grp && grp.get(h.i);
        if (!st) return;
        var n = all ? st.c : 1;
        tossItem(st, n);
        st.c -= n;
        if (!st.c) grp.set(h.i, null);
        if (h.g === 'armor') paintVitals();
        paintPanel(); paintHotbar();
    }
    /* the Q key and a click on the dark outside a panel both throw an item the way
       you are looking, on the real game's arc */
    function tossItem(st, n) {
        stat('c', 'drop'); stat('d', st.id, n);   // Player.drop: one drop, and that many of the item
        var d = look();
        RT.drops.push({ x: S.px + d[0], y: S.py + EYE - 0.3, z: S.pz + d[2], vx: d[0] * 6, vy: d[1] * 6 + 2, vz: d[2] * 6,
            it: st.id, c: n, dur: st.dur, ench: st.ench || null, iname: st.name || null, age: -0.8, hw: 0.12, h: 0.24 });
    }
    function throwCarried(one) {
        var c = RT.cur;
        if (!c) return;
        var n = one ? 1 : c.c;
        tossItem(c, n);
        c.c -= n;
        if (!c.c) RT.cur = null;
        paintPanel();
    }
    function wirePanel(wrap) {
        function ctlAt(t) {   // a slot, a creative tab or an enchant option under the pointer
            var el = t;
            while (el && el !== wrap && el.getAttribute && !el.getAttribute('data-g') &&
                   el.getAttribute('data-o') == null && el.getAttribute('data-ct') == null) el = el.parentNode;
            return el && el !== wrap && el.getAttribute ? el : null;
        }
        function barAt(t) { return t && t.closest ? t.closest('.mc-cbar') : null; }
        /* Middle-click any slot in creative and you get a full stack of whatever
           is in it, leaving the slot alone. Gated on instaBuild(): this listener
           is attached once and serves every panel kind, so ungated it would be an
           item duplicator inside a survival chest. */
        function cloneSlot(g, i) {
            if (!instaBuild() || RT.cur) return;   // the real clone leaves a carried stack alone
            if (g === 'ctrash' || g === 'anvOut') return;
            var grp = slotGroup(g);
            var st = grp ? grp.get(i) : null;
            if (!st || st.lock) return;
            RT.cur = creativeStack(st.id);
            snd('click'); paintPanel();
        }
        // remember where the pointer is on EVERY mouse event, not just movement:
        // a click without a preceding mousemove must still put the ghost under it
        wrap.addEventListener('mousedown', function (e) {
            panelCurTo(e.clientX, e.clientY);
            if (e.button > 2 || RT.qc) return;
            /* the recipe book takes its clicks first; a click anywhere but its
               search box or a recipe takes the keyboard back from the box */
            var rbq = wrap.querySelector('.mc-rbqin'), rbHit = e.target && e.target.closest ? e.target.closest('.mc-rbook, .mc-rb') : null;
            if (rbq && document.activeElement === rbq && !(rbHit && e.target.closest('.mc-rbr, .mc-rbarr'))) { rbq.blur(); RT.el.focus(); }
            if (rbHit) {
                var rbEl = e.target.closest('.mc-rbook, .mc-rbtab, .mc-rbr, .mc-rbfilter, .mc-rbarr');
                if (rbEl && (e.button === 0 || (e.button === 2 && rbEl.classList.contains('mc-rbr')))) rbAct(rbEl, e.button, e.shiftKey);
                e.preventDefault(); e.stopPropagation();
                return;
            }
            if (e.button === 0) {
                var bar = barAt(e.target);
                // the press only grabs the scroller; it is dragging that moves it, as the real one does
                if (bar) { if (!bar.classList.contains('off')) RT.cDrag = 1; e.preventDefault(); e.stopPropagation(); return; }
            }
            var el = ctlAt(e.target);
            if (!el) {
                /* the dark outside the panel: with a stack carried this is the start of a
                   sweep like any other press — it only becomes a throw if the button comes
                   up out there with nothing swept (qcEnd), as the real screen has it */
                if (RT.cur && e.button !== 1) qcStart(e.button === 2 ? 1 : 0, e.button, null, 0, false);
                e.preventDefault();
                return;
            }
            var ct = el.getAttribute('data-ct');
            if (ct != null) { if (e.button === 0) creativeTab(ct | 0); e.preventDefault(); e.stopPropagation(); return; }
            var eo = el.getAttribute('data-o');
            if (eo != null) { applyEnchOption(eo | 0); e.preventDefault(); e.stopPropagation(); return; }   // any button, like the real rectangle test
            var g = el.getAttribute('data-g'), i = el.getAttribute('data-i') | 0, now = performance.now();
            var dbl = !!(RT.lastClk && RT.lastClk.g === g && RT.lastClk.i === i && RT.lastClk.btn === e.button && now - RT.lastClk.t < 250);
            RT.lastClk = { g: g, i: i, btn: e.button, t: now, dbl: dbl };
            if (e.button === 1) {
                if (RT.cur) { if (instaBuild()) qcStart(2, 1, g, i, dbl); }
                else cloneSlot(g, i);
            } else if (RT.cur) qcStart(e.button === 2 ? 1 : 0, e.button, g, i, dbl);   // the placement waits for the release
            else slotClick(g, i, e.button === 2, e.shiftKey);                            // an empty cursor acts on the press
            e.preventDefault(); e.stopPropagation();
        });
        wrap.addEventListener('auxclick', function (e) { if (e.button === 1) e.preventDefault(); });
        // the right button is handled on the press, like the left; the browser's
        // own menu must still not open (text boxes keep theirs)
        wrap.addEventListener('contextmenu', function (e) {
            if (e.target && e.target.closest && e.target.closest('input, textarea')) return;
            e.preventDefault(); e.stopPropagation();
        });
        wrap.addEventListener('mousemove', function (e) {
            // a drag whose mouseup was swallowed (alt-tab, screen lock, the shell
            // minimising us) must not leave the scrollbar stuck to the pointer
            if (RT.cDrag && !(e.buttons & 1)) RT.cDrag = 0;
            if (RT.cDrag) { var bar = wrap.querySelector('.mc-cbar'); if (bar) creativeBarTo(bar, e.clientY); }
            if (RT.qc) {
                if (!(e.buttons & QC_BTN_MASK[RT.qc.btn]) || !RT.cur) qcCancel();
                else { var sw = slotAt(e.target, wrap); if (sw) qcAdd(sw.g, sw.i); }
            }
            panelCurTo(e.clientX, e.clientY);
            panelHover(e.target, e.clientX, e.clientY);
        });
        wrap.addEventListener('mouseleave', function () {
            tipRender(null);
            if (RT.hovEl) { RT.hovEl.classList.remove('hov'); RT.hovEl = null; }
            RT.hover = null;
        });
    }
    function wirePanelFields(wrap) {   // per-render nodes: re-wired on every open (fresh innerHTML)
        var srch = wrap.querySelector('.mc-csearchin');
        if (srch) {
            srch.addEventListener('input', function () {
                RT.cSearch = srch.value;
                RT.cScroll = 0; RT.cScrollF = null;
                creativeRefresh();
                paintPanel();
            });
            // the box owns the keyboard while it has focus, or typing "e" would
            // slam the inventory shut mid-search. Esc still gets you out.
            srch.addEventListener('keydown', function (e) {
                e.stopPropagation();   // every key, Esc included: the desktop's own Escape drops full screen
                if (e.key === 'Escape') { e.preventDefault(); srch.blur(); closePanel(); return; }
                // a digit over an entry is a hotbar key first, as the real search tab has it; otherwise it is typing
                if (/^[1-9]$/.test(e.key) && RT.hover && !RT.cur) { e.preventDefault(); hoverSwap((e.key | 0) - 1); }
            });
            srch.addEventListener('keyup', function (e) { e.stopPropagation(); });
            srch.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        }
        var nameIn = wrap.querySelector('.mc-anvin');
        if (nameIn) {
            nameIn.disabled = !RT.anvilA;
            nameIn.addEventListener('input', function () { RT.anvilName = nameIn.value; paintPanel(); });
            // typing must not drive the game — but Esc still has to close the panel, or the
            // name box swallows the only key that gets you out
            nameIn.addEventListener('keydown', function (e) {
                e.stopPropagation();
                if (e.key === 'Escape') { e.preventDefault(); nameIn.blur(); closePanel(); return; }
            });
            nameIn.addEventListener('keyup', function (e) { e.stopPropagation(); });
            nameIn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        }
        /* EditBox's cursor blinks from the moment the box takes focus; anything
           that moves the caret or the selection redraws the mirror at once */
        [srch, nameIn].forEach(function (f) {
            if (!f) return;
            f._ft = performance.now();
            f.addEventListener('focus', function () { f._ft = performance.now(); panelFrame(0); });
            ['blur', 'select', 'input', 'keyup', 'mouseup'].forEach(function (ev) { f.addEventListener(ev, function () { if (RT && RT.panel) panelFrame(0); }); });
            f.addEventListener('keydown', function () { setTimeout(function () { if (RT && RT.panel) panelFrame(0); }, 0); });
        });
    }

    /* ── audio ───────────────────────────────────────────────
       Every sound in this file is one of Minecraft's own. The samples live
       in mc-sounds/ under the paths the game's sounds.json files them by
       (dig/stone1, mob/zombie/say2, music/game/sweden), re-encoded as AAC,
       the one compressed format every browser decodes. What this section
       adds is everything the game does AROUND a sample:

         · A SoundType per block. What a block sounds like is a property of
           its material, and one material answers consistently across all of
           its uses, each with the game's own volume and pitch maths: break
           and place at (v+1)/2 and pitch × 0.8, footsteps at v × 0.15, a
           landing at v × 0.5 and pitch × 0.75, and a quiet half-pitch tick
           every four ticks while a block is being mined. That last one is
           most of what mining actually SOUNDS like.
         · A random variant on every play, and the rolls the game's own call
           sites make — (rand − rand) × 0.2 + 1 for a voice, half an octave
           up for a baby, 0.8 to 1.0 for a cave.
         · Linear attenuation out to 16 blocks × the sound's volume (a volume
           above 1 buys range, never loudness), and stereo placement against
           the listener's yaw, so mobs, ambience and explosions come from
           somewhere instead of from inside your head.
         · A lowpassed master the moment your head goes under water.
         · Cave ambience seeded into unlit air pockets near the player,
           which is where the real game finds it too.

       Loading. The short effects are fetched and decoded as the window
       opens, the long ones (the caves, the underwater bed, thunder) on first
       use, and music streams through an <audio> element instead, because a
       decoded five-minute track is a hundred megabytes of floats. Every
       effect was encoded with a few frames of silence in front, and cal.m4a
       tells this browser exactly how much of it to cut: AAC streams do not
       agree on where sample zero is, and a footstep that starts late or has
       lost its attack is the tell of a fake. */

    var SND_BASE = (function () {   // beside this script, whichever page loaded it
        var s = document.currentScript;
        try { return new URL('mc-sounds/', s && s.src ? s.src : location.href).href; } catch (e) { return 'mc-sounds/'; }
    })();
    var AC = null, MASTER = null, MUFFLE = null;
    var BUS = {}, VQ = [];
    var PAN_OK = false;
    /* MC's sound categories. Vanilla ships every one at 1.0 and so does this:
       with the game's own samples at the game's own volumes, the mix already
       is the game's. `uw` is the underwater bed, ambient but routed round the
       muffle, because it is the sound of being under water rather than
       something heard through it. */
    var CATS = { block: 1, hostile: 1, neutral: 1, player: 1, ambient: 1, uw: 1, weather: 1, ui: 1, music: 1 };
    var SB = {};          // path → trimmed AudioBuffer, the Promise of one, or false once it has failed
    var SLRU = [];        // the long buffers, least recently played first
    var SMAN = null;      // mc-sounds/manifest.json: the pad, the pulse time, every effect's true length
    var SSKIP = 0;        // how much of the front this browser's AAC decoder already drops by itself
    var SREADY = null;
    var S_LONG = 3, S_KEEP = 8;   // past 3 s an effect is decoded on demand, and eight of those are kept
    var MUS = null;       // the one streaming track
    var SLOG = null;      // QC: what actually started, and how loud — switched on by __mc._sndlog(true)

    function audioInit() {
        if (AC) { if (AC.state === 'suspended' && AC.resume) AC.resume(); return; }
        try { AC = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { AC = null; return; }
        PAN_OK = !!AC.createStereoPanner;
        MASTER = AC.createGain(); MASTER.gain.value = 0.42; MASTER.connect(AC.destination);
        // everything positional passes through the muffle; music does not, because
        // going under water in the real game does not muffle the soundtrack
        MUFFLE = AC.createBiquadFilter();
        MUFFLE.type = 'lowpass'; MUFFLE.frequency.value = 21000; MUFFLE.Q.value = 0.0001;
        MUFFLE.connect(MASTER);
        for (var k in CATS) if (Object.prototype.hasOwnProperty.call(CATS, k)) {
            var g = AC.createGain(); g.gain.value = 0;
            g.connect(k === 'music' || k === 'uw' ? MASTER : MUFFLE);
            BUS[k] = g;
        }
        VQ = [];
        applyVolumes();
        sndBoot(AC);
    }
    function audioStop() {
        if (!AC) return;
        musDrop();
        try { AC.close(); } catch (e) { }
        AC = null; MASTER = null; MUFFLE = null;
        BUS = {}; VQ = [];
        // the decoded effects are tens of megabytes of floats: they go with the
        // window, and come back out of the HTTP cache when it opens again
        SB = {}; SLRU = []; SREADY = null;
        AMB.bed = null; AMB.sub = false; AMB.water = false;
    }
    // saves predate the sliders and hold booleans; 0/1 reads the same either way
    function sVol() { return typeof S.snd === 'number' ? S.snd : (S.snd ? 1 : 0); }
    function mVol() { return typeof S.mus === 'number' ? S.mus : (S.mus ? 1 : 0); }
    function applyVolumes() {
        if (!AC) return;
        var sv = sVol(), mv = mVol();
        for (var k in CATS) if (Object.prototype.hasOwnProperty.call(CATS, k)) {
            var want = CATS[k] * (k === 'music' ? mv : sv);
            BUS[k].gain.setTargetAtTime(want, AC.currentTime, 0.02);
        }
        // a silenced soundtrack stops streaming rather than play to nobody;
        // the scheduler starts a fresh piece once it is turned back up
        if (!mv && musPlaying()) { musStop(); if (RT && !RT.menu && !(RT.musT > 0)) RT.musT = 20; }
    }

    /* ── loading ───────────────────────────────────────────── */
    /* The manifest and the calibration pulse come down together, and every
       effect asked for meanwhile is already on its way beside them: the click
       that woke the audio up should still be heard, a round trip later. */
    function sndBoot(ac) {
        SREADY = SMAN ? Promise.resolve() : Promise.all([
            fetch(SND_BASE + 'manifest.json').then(function (r) {
                if (!r.ok) throw new Error('manifest ' + r.status);
                return r.json();
            }),
            sndDecode(ac, 'cal').catch(function () { return null; })
        ]).then(function (r) {
            SMAN = r[0];
            SSKIP = r[1] ? calSkip(r[1]) : 0;
        }).catch(function () { SMAN = null; });   // untrimmed effects still play, a few frames late
        SREADY.then(function () { if (AC === ac && SMAN) sndPreload(ac); });
    }
    function sndDecode(ac, path) {
        return fetch(SND_BASE + path + '.m4a').then(function (r) {
            if (!r.ok) throw new Error(path + ' ' + r.status);
            return r.arrayBuffer();
        }).then(function (ab) {
            return new Promise(function (res, rej) {
                // the callback form, because older Safari has no promise one; the
                // promise a newer browser hands back anyway is caught so it cannot shout
                var p = ac.decodeAudioData(ab, res, rej);
                if (p && p.catch) p.catch(function () { });
            });
        });
    }
    /* cal.m4a is the same pad and then one short pulse at a known time.
       Wherever this browser's decoder puts that pulse is how far off its idea
       of sample zero is, and every effect is trimmed by exactly that much. */
    function calSkip(b) {
        var d = b.getChannelData(0), pi = 0;
        for (var i = 1; i < d.length; i++) if (Math.abs(d[i]) > Math.abs(d[pi])) pi = i;
        if (Math.abs(d[pi]) < 0.3) return 0;   // no pulse to find: trust the timeline
        return Math.max(-SMAN.pad, Math.min(SMAN.pad, SMAN.cal - pi / b.sampleRate));
    }
    function sndTrim(ac, path, b) {
        var len = SMAN && SMAN.len[path];
        if (len == null) return b;
        var sr = b.sampleRate, off = Math.max(0, Math.round((SMAN.pad - SSKIP) * sr));
        var n = Math.min(b.length - off, Math.round(len * sr));
        if (n <= 0) return b;
        var out = ac.createBuffer(b.numberOfChannels, n, sr);
        for (var c = 0; c < b.numberOfChannels; c++) out.getChannelData(c).set(b.getChannelData(c).subarray(off, off + n));
        return out;
    }
    function sndLoad(path) {
        var have = SB[path];
        if (have === false || !AC || !SREADY) return Promise.resolve(null);
        if (have) return have.then ? have : Promise.resolve(have);
        var ac = AC;
        // fetch and decode straight away; only the trim has to wait for the manifest and the pulse
        var p = Promise.all([sndDecode(ac, path), SREADY]).then(function (r) {
            var b = sndTrim(ac, path, r[0]);
            if (AC === ac) { SB[path] = b; if (b.duration > S_LONG) sndKeep(path); }
            return b;
        }, function () {
            if (AC === ac) SB[path] = false;   // missing stays missing: nothing refetches it every frame
            return null;
        });
        SB[path] = p;
        return p;
    }
    // the long buffers are kept eight at a time, the least recently played let go first
    function sndKeep(path) {
        var i = SLRU.indexOf(path);
        if (i >= 0) SLRU.splice(i, 1);
        SLRU.push(path);
        while (SLRU.length > S_KEEP) { var old = SLRU.shift(); if (SB[old] && !SB[old].then) delete SB[old]; }
    }
    // every short effect, the ones the first seconds of play need first, four in flight at a time
    function sndPreload(ac) {
        var q = [], busy = 0, k;
        for (k in SMAN.len) if (Object.prototype.hasOwnProperty.call(SMAN.len, k) && SMAN.len[k] <= S_LONG) q.push(k);
        function pri(p) { return /^(step|dig)\//.test(p) || p === 'random/click' ? 0 : /^(random|damage|entity\/player)\//.test(p) ? 1 : 2; }
        q.sort(function (a, b) { return pri(a) - pri(b); });
        (function next() {
            while (busy < 4 && q.length && AC === ac) {
                busy++;
                sndLoad(q.shift()).then(function () { busy--; next(); });
            }
        })();
    }

    /* ── placement ───────────────────────────────────────────
       Every sound gets one submix node, so distance and stereo angle are
       worked out once for it. Returns null when the sound would be inaudible,
       and the caller then never builds anything at all — which is the only
       reason 40 mobs and a thunderstorm can be on at once. */
    function aEmit(o) {
        if (!AC) return null;
        var vol = o.vol == null ? 1 : o.vol, gain = Math.min(1, vol), d = 0, dx = 0, dz = 0;
        if (o.x != null) {
            dx = o.x - S.px; dz = o.z - S.pz;
            var dy = o.y - (S.py + EYE);
            d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            // MC's linear model: silence at 16 blocks × the sound's own volume,
            // which is why a distant creeper is quiet but never muddy
            var maxD = 16 * Math.max(1, vol);
            if (d >= maxD) return null;
            gain *= 1 - d / maxD;
            if (gain < 0.0016) return null;
        }
        var g = AC.createGain(), node = g;
        if (o.x != null && PAN_OK) {
            var hl = Math.sqrt(dx * dx + dz * dz) || 1;
            var p = AC.createStereoPanner();
            // project onto the listener's right vector; movement uses the same
            // basis, so strafing right really does sweep a sound to the left
            var pv = (dx / hl) * Math.cos(S.yaw) + (dz / hl) * Math.sin(S.yaw);
            // something directly on top of you has no direction to hear
            p.pan.value = Math.max(-1, Math.min(1, pv)) * 0.88 * Math.min(1, d / 2.5);
            node.connect(p); node = p;
        }
        g.gain.value = gain;
        node.connect(BUS[o.bus || 'block']);
        return g;
    }
    /* A crude polyphony cap. A creeper going off in a gravel cave during a
       thunderstorm can otherwise start a hundred voices in one frame and the
       tab audibly hitches. */
    function aBudget(dur) {
        var t = AC.currentTime;
        while (VQ.length && VQ[0] <= t) VQ.shift();
        if (VQ.length > 44) return false;
        var end = t + (dur || 0.4), i = VQ.length;
        while (i > 0 && VQ[i - 1] > end) i--;
        VQ.splice(i, 0, end);
        return true;
    }
    // the game's own voice roll: triangular around 1.0, never a flat rand()
    function jit(w) { return 1 + (Math.random() - Math.random()) * (w == null ? 0.2 : w); }
    function sndVoice() { return jit(); }
    function sndRange(lo, w) { return function () { return lo + Math.random() * w; }; }
    function sndSeq(pre, a, b) { var o = []; for (var i = a; i <= b; i++) o.push(pre + i); return o; }
    function sndPick(a) { return a[(Math.random() * a.length) | 0]; }
    /* The per-sample volumes sounds.json layers over a call site's own:
       the quieter swim strokes, the attack set, the underwater swooshes. */
    var SVOL = {};
    (function () {
        function set(v, list) { for (var i = 0; i < list.length; i++) SVOL[list[i]] = v; }
        set(0.4, sndSeq('liquid/swim', 9, 12)); set(0.6, sndSeq('liquid/swim', 14, 17));
        set(0.6, sndSeq('entity/player/attack/strong', 1, 4)); set(0.7, sndSeq('entity/player/attack/strong', 5, 6));
        set(0.7, sndSeq('entity/player/attack/crit', 1, 3));
        set(0.5, sndSeq('ambient/underwater/enter', 1, 3)); set(0.3, sndSeq('ambient/underwater/exit', 1, 3));
        set(0.45, sndSeq('item/plant/crop', 1, 6)); set(0.9, sndSeq('block/bamboo/sapling_place', 1, 6));
        set(0.45, ['ambient/underwater/additions/bass_whale1']); set(0.5, ['ambient/underwater/additions/bass_whale2']);
        set(0.7, ['ambient/underwater/additions/crackles1']);
        set(0.5, ['ambient/underwater/additions/driplets1', 'ambient/underwater/additions/driplets2']);
    })();

    /* One sample, placed. The buffer is normally already here. When it is
       still on its way the play waits for it, but only as long as `late`
       allows: a footstep that lands a second after the foot is worse than no
       footstep at all, while a cave can take its time. */
    function sPlay(path, o) {
        if (!AC || !path) return;
        o.vol = (o.vol == null ? 1 : o.vol) * (SVOL[path] || 1);
        var b = SB[path];
        if (b && !b.then) { sStart(b, path, o); return; }
        var ac = AC, asked = ac.currentTime, late = o.late == null ? 0.2 : o.late;
        sndLoad(path).then(function (b2) { if (b2 && AC === ac && ac.currentTime - asked <= late) sStart(b2, path, o); });
    }
    function sStart(b, path, o) {
        var pitch = o.pitch || 1;
        var d = aEmit(o);
        if (!d || !aBudget(b.duration / pitch)) return;
        if (b.duration > S_LONG) sndKeep(path);
        var s = AC.createBufferSource();
        s.buffer = b; s.playbackRate.value = pitch;   // the game's pitch is a playback rate, exactly this
        s.connect(d);
        s.start();
        if (SLOG) SLOG.push({ p: path, g: Math.round(d.gain.value * 1000) / 1000, r: Math.round(pitch * 1000) / 1000, bus: o.bus || 'block', at: o.x != null });
    }

    /* ── SoundType, one entry per material ───────────────────
       The game's table of which samples a material breaks, is placed and is
       walked on with. The mining tick and the landing use the step set, as
       the real hit and fall events do. `v` and `p` are the SoundType's own
       volume and pitch — ANVIL really is quiet at 0.3 in vanilla's table —
       and `pp` is a planted crop's two pitches. Only the SoundTypes this
       world's blocks actually use are here. */
    var MAT = {
        stone: { v: 1, p: 1, brk: sndSeq('dig/stone', 1, 4), place: sndSeq('dig/stone', 1, 4), step: sndSeq('step/stone', 1, 6) },
        wood: { v: 1, p: 1, brk: sndSeq('dig/wood', 1, 4), place: sndSeq('dig/wood', 1, 4), step: sndSeq('step/wood', 1, 6) },
        gravel: { v: 1, p: 1, brk: sndSeq('dig/gravel', 1, 4), place: sndSeq('dig/gravel', 1, 4), step: sndSeq('step/gravel', 1, 4) },
        grass: { v: 1, p: 1, brk: sndSeq('dig/grass', 1, 4), place: sndSeq('dig/grass', 1, 4), step: sndSeq('step/grass', 1, 6) },
        sand: { v: 1, p: 1, brk: sndSeq('dig/sand', 1, 4), place: sndSeq('dig/sand', 1, 4), step: sndSeq('step/sand', 1, 5) },
        snow: { v: 1, p: 1, brk: sndSeq('dig/snow', 1, 4), place: sndSeq('dig/snow', 1, 4), step: sndSeq('step/snow', 1, 4) },
        cloth: { v: 1, p: 1, brk: sndSeq('dig/cloth', 1, 4), place: sndSeq('dig/cloth', 1, 4), step: sndSeq('step/cloth', 1, 4) },
        // glass shatters, and is stone in every other respect
        glass: { v: 1, p: 1, brk: sndSeq('random/glass', 1, 3), place: sndSeq('dig/stone', 1, 4), step: sndSeq('step/stone', 1, 6) },
        ladder: { v: 1, p: 1, brk: sndSeq('dig/wood', 1, 4), place: sndSeq('dig/wood', 1, 4), step: sndSeq('step/ladder', 1, 5) },
        anvil: { v: 0.3, p: 1, brk: sndSeq('dig/stone', 1, 4), place: ['random/anvil_land'], step: sndSeq('step/stone', 1, 6) },
        // a growing crop snaps like a bamboo sapling and goes in with the planting
        // rustle; a melon or pumpkin stem is the "hard" crop, wood underfoot
        crop: { v: 1, p: 1, brk: sndSeq('block/bamboo/sapling_place', 1, 6), place: sndSeq('item/plant/crop', 1, 6), pp: [1, 1.2], step: sndSeq('step/grass', 1, 6) },
        hardcrop: { v: 1, p: 1, brk: sndSeq('dig/wood', 1, 4), place: sndSeq('item/plant/crop', 1, 6), pp: [1, 1.2], step: sndSeq('step/wood', 1, 6) }
    };

    /* Which SoundType each block gets. These follow the real game's own table
       wherever this world has the same block: dirt and clay are GRAVEL not
       GRASS, cactus and cake are WOOL, TNT is GRASS, leaves are GRASS, a bed
       is WOOD, the redstone lamp is GLASS, and wheat, carrots and potatoes
       are CROP while the melon and pumpkin stems are HARD_CROP. */
    var MATOF = {};
    (function () {
        function set(m, list) { for (var i = 0; i < list.length; i++) MATOF[list[i]] = m; }
        set('stone', [STONE, COBBLE, ORE_COAL, ORE_IRON, ORE_GOLD, ORE_DIA, ORE_RED, ORE_LAPIS, ORE_EMERALD,
            BEDROCK, OBSIDIAN, FURN, FURN_LIT, STONEBRICK, SANDSTONE, BRICKS, ETABLE]);
        set('wood', [LOG, PLANKS, TABLE, CHEST, BOOKSHELF, BED, TORCH, PUMPKIN, MELON]);
        set('gravel', [DIRT, GRAVEL, FARMLAND, CLAY]);
        set('grass', [GRASS, LEAVES, TALLGRASS, DANDELION, POPPY, MUSHROOM, MUSHROOM_R, SUGARCANE, TNT]);
        set('crop', [WHEAT0, WHEAT1, WHEAT2, WHEAT3, CARROT0, CARROT1, CARROT2, CARROT3,
            POTATO0, POTATO1, POTATO2, POTATO3]);
        set('hardcrop', [PSTEM, MSTEM]);
        set('sand', [SAND]);
        set('snow', [SNOWGRASS]);
        set('cloth', [WOOL, CACTUS, CAKE]);
        set('glass', [GLASS, RLAMP]);
        set('ladder', [LADDER]);
        set('anvil', [ANVIL]);
    })();
    function matFor(b) { return MAT[MATOF[b] || 'stone']; }

    /* The real game's call sites, with its own volume and pitch maths.
       BlockItem.place and Block.playerWillDestroy both use (v+1)/2 at pitch
       ×0.8; Entity.playStepSound uses v×0.15 at pitch ×1; a landing is the
       fall sound at v×0.5 and pitch ×0.75; and the mining tick is (v+1)/8 at
       pitch ×0.5 — that half pitch is why a block being mined sounds nothing
       like the same block breaking, even though it is the same material. */
    function matPlay(b, use, x, y, z, bus) {
        var m = matFor(b), list = m.step, vol, pitch;
        if (use === 'step') { vol = m.v * 0.15; pitch = m.p; bus = bus || 'player'; }
        else if (use === 'land') { vol = m.v * 0.5; pitch = m.p * 0.75; bus = bus || 'player'; }
        else if (use === 'hit') { vol = (m.v + 1) / 8; pitch = m.p * 0.5; }
        else {
            list = m[use]; vol = (m.v + 1) / 2; pitch = m.p * 0.8;
            if (use === 'place' && m.pp) pitch *= sndPick(m.pp);
        }
        sPlay(sndPick(list), { x: x, y: y, z: z, vol: vol, pitch: pitch, bus: bus || 'block', late: 0.15 });
    }

    /* ── mob voices ──────────────────────────────────────────
       Each mob's sets as the game files them, and the game's own rolls:
       every voice line is (rand − rand) × 0.2 + 1 in pitch, +0.5 for a
       baby; a cow and a squid speak at 0.4; a slime at 0.4 × its size, the
       big set at 0.8 pitch and a size-1 slime the small set at 1.4, and its
       landing squish a little higher than its jump. A creeper has no idle
       voice at all: the hiss is the fuse. */
    function mobSay(k, n) { return sndSeq('mob/' + k + '/say', 1, n); }
    var MOBSND = {
        pig: { idle: mobSay('pig', 3), hurt: mobSay('pig', 3), death: ['mob/pig/death'], step: sndSeq('mob/pig/step', 1, 5) },
        cow: { v: 0.4, idle: mobSay('cow', 4), hurt: sndSeq('mob/cow/hurt', 1, 3), death: sndSeq('mob/cow/hurt', 1, 3), step: sndSeq('mob/cow/step', 1, 4) },
        sheep: { idle: mobSay('sheep', 3), hurt: mobSay('sheep', 3), death: mobSay('sheep', 3), step: sndSeq('mob/sheep/step', 1, 5) },
        chicken: { idle: mobSay('chicken', 3), hurt: sndSeq('mob/chicken/hurt', 1, 2), death: sndSeq('mob/chicken/hurt', 1, 2), step: sndSeq('mob/chicken/step', 1, 2), egg: ['mob/chicken/plop'] },
        zombie: { idle: mobSay('zombie', 3), hurt: sndSeq('mob/zombie/hurt', 1, 2), death: ['mob/zombie/death'], step: sndSeq('mob/zombie/step', 1, 5) },
        skeleton: { idle: mobSay('skeleton', 3), hurt: sndSeq('mob/skeleton/hurt', 1, 4), death: ['mob/skeleton/death'], step: sndSeq('mob/skeleton/step', 1, 4) },
        creeper: { hurt: mobSay('creeper', 4), death: ['mob/creeper/death'] },
        spider: { idle: mobSay('spider', 4), hurt: mobSay('spider', 4), death: ['mob/spider/death'], step: sndSeq('mob/spider/step', 1, 4) },
        // an angry enderman screams where a calm one mutters, and meeting its eye has a sound of its own
        enderman: { idle: sndSeq('mob/endermen/idle', 1, 5), scream: sndSeq('mob/endermen/scream', 1, 4), hurt: sndSeq('mob/endermen/hit', 1, 4), death: ['mob/endermen/death'], stare: ['mob/endermen/stare'] },
        slime: { big: sndSeq('mob/slime/big', 1, 4), small: sndSeq('mob/slime/small', 1, 5), attack: sndSeq('mob/slime/attack', 1, 2) },
        squid: { v: 0.4, idle: sndSeq('mob/squid/ambient', 1, 5), hurt: sndSeq('mob/squid/hurt', 1, 4), death: sndSeq('mob/squid/death', 1, 3), squirt: sndSeq('mob/squid/squirt', 1, 3) }
    };
    var HOSTILE_K = { zombie: 1, skeleton: 1, creeper: 1, spider: 1, enderman: 1, slime: 1 };
    function mobSnd(kind, mode, f, x, y, z) {
        var t = MOBSND[kind];
        if (!t) return;
        var r = (Math.random() - Math.random()) * 0.2, list = t[mode];
        var vol = t.v || 1, pitch = r + (f && f.baby > 0 ? 1.5 : 1), late = 1;
        if (kind === 'slime') {
            var sz = (f && f.sz) || 1, tiny = sz <= 1;
            if (mode === 'attack') pitch = r + 1;
            else { list = tiny ? t.small : t.big; vol = 0.4 * sz; pitch = mode === 'squish' ? (r + 1) / 0.8 : (r + 1) * (tiny ? 1.4 : 0.8); }
        } else if (mode === 'step') { vol = 0.15; pitch = 1; late = 0.15; }
        else if (mode === 'stare') { vol = 2.5; pitch = 1; late = 2; }
        else if (mode === 'egg') pitch = r + 1;
        if (!list) return;
        sPlay(sndPick(list), { x: x, y: y, z: z, vol: vol, pitch: pitch, bus: HOSTILE_K[kind] ? 'hostile' : 'neutral', late: late });
        // a hurt squid inks, and the ink has its own squirt
        if (kind === 'squid' && mode === 'hurt') sPlay(sndPick(t.squirt), { x: x, y: y, z: z, vol: vol, pitch: r + 1, bus: 'neutral', late: 0.5 });
    }
    // a mob's footfall: its own step set if it has one, otherwise the block it is on, as Entity.playStepSound does
    function foeStep(f) {
        if (!AC || !S || !sVol()) return;
        var t = MOBSND[f.k];
        if (t && t.step) { mobSnd(f.k, 'step', f, f.x, f.y, f.z); return; }
        var gb = getB(Math.floor(f.x), Math.floor(f.y - 0.2), Math.floor(f.z));
        if (gb > 0 && gb !== WATER && gb !== LAVA) matPlay(gb, 'step', f.x, f.y, f.z, HOSTILE_K[f.k] ? 'hostile' : 'neutral');
    }

    /* ── one-shot sound events ───────────────────────────────
       snd(name, arg, x, y, z). Leaving the position off means "at the
       listener" — UI, your own body, and anything the real game plays from
       the player (`here` pins those even when a caller passes a spot). Each
       entry is a sample set with the volume and pitch the game's own call
       site passes; `arg` reaches the ones that depend on it. */
    function lvlVol(l) { return Math.max(0.35, Math.min(1, (l || 0) / 30)); }
    var SFX = {
        /* the player */
        hurt: { f: sndSeq('damage/hit', 1, 3), p: sndVoice, bus: 'player' },
        die: { f: sndSeq('damage/hit', 1, 3), p: sndVoice, bus: 'player' },
        hurtdrown: { f: sndSeq('entity/player/hurt/drown', 1, 4), p: sndVoice, bus: 'player' },
        hurtfire: { f: sndSeq('entity/player/hurt/fire_hurt', 1, 3), p: sndVoice, bus: 'player' },
        // arg is the damage the fall did: more than two hearts is the big thud
        fall: { f: function (a) { return a > 4 ? ['damage/fallbig'] : ['damage/fallsmall']; }, bus: 'player' },
        eat: { f: sndSeq('random/eat', 1, 3), v: sndRange(0.5, 0.5), p: sndVoice, bus: 'player' },
        drink: { f: ['random/drink'], v: 0.5, p: sndRange(0.9, 0.1), bus: 'player' },
        burp: { f: ['random/burp'], v: 0.5, p: sndRange(0.9, 0.1), bus: 'player' },
        // arg is how fast you hit the water, blocks a second; the game weighs it the same way
        splash: {
            f: function (a) { return a * 0.01 >= 0.25 ? ['liquid/heavy_splash'] : ['liquid/splash', 'liquid/splash2']; },
            v: function (a) { return Math.max(0.06, Math.min(1, a * 0.01)); }, p: function () { return jit(0.4); }, bus: 'player'
        },
        swim: { f: sndSeq('liquid/swim', 5, 18), v: 0.1, p: function () { return jit(0.4); }, bus: 'player' },
        // arg is how many air bubbles have gone: each pop is a little louder and higher
        bubble: { f: ['ui/hud/hud_bubble'], v: function (a) { return 0.5 + 0.1 * Math.max(0, a - 2); }, p: function (a) { return 1 + 0.1 * Math.max(0, a - 4); }, bus: 'player' },
        uwenter: { f: sndSeq('ambient/underwater/enter', 1, 3), bus: 'uw' },
        uwexit: { f: sndSeq('ambient/underwater/exit', 1, 3), bus: 'uw' },
        uwadd: { f: sndSeq('ambient/underwater/additions/bubbles', 1, 6).concat(['ambient/underwater/additions/water1', 'ambient/underwater/additions/water2']), bus: 'uw', late: 1 },
        uwrare: {
            f: ['ambient/underwater/additions/animal1', 'ambient/underwater/additions/bass_whale1', 'ambient/underwater/additions/bass_whale2',
                'ambient/underwater/additions/crackles1', 'ambient/underwater/additions/crackles2', 'ambient/underwater/additions/driplets1',
                'ambient/underwater/additions/driplets2', 'ambient/underwater/additions/earth_crack'], bus: 'uw', late: 2
        },

        /* combat */
        hit: { f: sndSeq('entity/player/attack/strong', 1, 6), bus: 'player', here: 1 },
        crit: { f: sndSeq('entity/player/attack/crit', 1, 3), bus: 'player', here: 1 },
        // arg is how far the bow was drawn, 0..1: a full draw looses higher
        bow: { f: ['random/bow'], p: function (a) { return 1 / (Math.random() * 0.4 + 1.2) + (a || 0) * 0.5; }, bus: 'player' },
        skelshoot: { f: ['random/bow'], p: function () { return 1 / (Math.random() * 0.4 + 0.8); }, bus: 'hostile' },
        thud: { f: sndSeq('random/bowhit', 1, 4), p: function () { return 1.2 / (Math.random() * 0.2 + 0.9); }, bus: 'neutral' },
        arrowhit: { f: ['random/successful_hit'], v: 0.18, p: 0.45, bus: 'player' },

        /* items & UI */
        pop: { f: ['random/pop'], v: 0.2, p: function () { return ((Math.random() - Math.random()) * 0.7 + 1) * 2; }, bus: 'player' },
        orb: { f: ['random/orb'], v: 0.1, p: function () { return 0.5 * ((Math.random() - Math.random()) * 0.7 + 1.8); }, bus: 'player' },
        click: { f: ['random/click'], v: 0.25, bus: 'ui', late: 0.3 },   // the first one wakes the audio, and still wants hearing
        'break': { f: ['random/break'], v: 0.8, p: sndRange(0.8, 0.4), bus: 'player' },
        // arg is the new level. The game only rings this on every fifth level,
        // louder the higher you are; this one rings on every level, quietly,
        // and keeps the game's full ring for the fifths
        level: { f: ['random/levelup'], v: function (a) { return 0.3 * lvlVol(a); }, bus: 'player' },
        levelbig: { f: ['random/levelup'], v: function (a) { return 0.75 * lvlVol(a); }, bus: 'player' },
        ding: { f: ['ui/toast/in'], bus: 'ui' },            // an achievement toast sliding in...
        toastout: { f: ['ui/toast/out'], bus: 'ui' },       // ...and back out
        enchant: { f: sndSeq('block/enchantment_table/enchant', 1, 3), p: sndRange(0.9, 0.1), bus: 'block' },
        anvil: { f: ['random/anvil_use'], p: sndRange(0.9, 0.1), bus: 'block' },
        chestopen: { f: ['block/chest/open'], v: 0.5, p: sndRange(0.9, 0.1), bus: 'block' },
        chestclose: { f: sndSeq('block/chest/close', 1, 3), v: 0.5, p: sndRange(0.9, 0.1), bus: 'block' },
        // arg is the armor's tier: leather creaks, iron clanks, gold chimes, diamond rings
        equip: { f: function (a) { return sndSeq('item/armor/equip_' + (a || 'leather'), 1, 6); }, bus: 'player' },
        bucketfill: { f: sndSeq('item/bucket/fill', 1, 3), bus: 'player' },
        bucketfilllava: { f: sndSeq('item/bucket/fill_lava', 1, 3), bus: 'player' },
        bucketempty: { f: sndSeq('item/bucket/empty', 1, 3), bus: 'player' },
        bucketemptylava: { f: sndSeq('item/bucket/empty_lava', 1, 3), bus: 'player' },
        milk: { f: sndSeq('entity/cow/milk', 1, 3), bus: 'player' },
        till: { f: sndSeq('item/hoe/till', 1, 4), bus: 'block' },

        /* the world */
        fuse: { f: ['random/fuse'], p: 0.5, bus: 'hostile' },   // a creeper's fuse is the TNT hiss an octave down
        tntfuse: { f: ['random/fuse'], bus: 'block' },
        boom: { f: sndSeq('random/explode', 1, 4), v: 4, p: function () { return (1 + (Math.random() - Math.random()) * 0.2) * 0.7; }, bus: 'block' },
        thunder: { f: sndSeq('ambient/weather/thunder', 1, 3), p: sndRange(0.8, 0.2), bus: 'weather', late: 1.5 },
        impact: { f: sndSeq('random/explode', 1, 4), v: 2, p: sndRange(0.5, 0.2), bus: 'weather' },   // where the bolt came down
        teleport: { f: ['mob/endermen/portal', 'mob/endermen/portal2'], bus: 'hostile' },
        lavapop: { f: ['liquid/lavapop'], v: sndRange(0.2, 0.2), p: sndRange(0.9, 0.15), bus: 'block' },
        lava: { f: ['liquid/lava'], v: sndRange(0.2, 0.2), p: sndRange(0.9, 0.15), bus: 'block', late: 1 },
        fizz: { f: ['random/fizz'], v: 0.5, p: function () { return 2.6 + (Math.random() - Math.random()) * 0.8; }, bus: 'block' },
        crackle: { f: sndSeq('block/furnace/fire_crackle', 1, 5), bus: 'block' },
        cave: { f: sndSeq('ambient/cave/cave', 1, 23), v: 0.7, p: sndRange(0.8, 0.2), bus: 'ambient', late: 3 },
        // arg is 1 for rain landing in the open, 0 for rain landing on the roof over you
        rain: { f: sndSeq('ambient/weather/rain', 1, 8), v: function (a) { return a ? 0.2 : 0.1; }, p: function (a) { return a ? 1 : 0.5; }, bus: 'weather', late: 0.5 }
    };
    function snd(name, arg, x, y, z) {
        if (!S || !sVol() || !AC) return;
        // block sounds are driven by the material table, not by this one
        if (name === 'dig') { matPlay(arg, 'brk', x, y, z); return; }
        if (name === 'place') { matPlay(arg, 'place', x, y, z); return; }
        if (name === 'step') { matPlay(arg, 'step', x, y, z); return; }
        if (name === 'mine') { matPlay(arg, 'hit', x, y, z); return; }
        if (name === 'land') { matPlay(arg, 'land', x, y, z); return; }
        if (name.indexOf('mob:') === 0) {   // 'mob:<kind>:<mode>', and arg is the mob itself
            var pr = name.split(':'); mobSnd(pr[1], pr[2], arg, x, y, z); return;
        }
        var e = SFX[name];
        if (!e) return;
        var path = sndPick(typeof e.f === 'function' ? e.f(arg) : e.f);
        var vol = e.v == null ? 1 : typeof e.v === 'function' ? e.v(arg) : e.v;
        var pitch = e.p == null ? 1 : typeof e.p === 'function' ? e.p(arg) : e.p;
        sPlay(path, { x: e.here ? null : x, y: y, z: z, vol: vol, pitch: pitch, bus: e.bus, late: e.late });
    }

    /* ── the ambience driver ─────────────────────────────────
       Runs every frame. Everything here reads the world and decides whether
       something should sound; nothing allocates unless the player has
       actually walked into a situation that needs it. */
    var AMB = { scan: 0, lava: 0, lavaP: null, fireP: null, caveCd: 22, water: false, sub: false, swimD: 0, lx: 0, lz: 0, rainT: 0, bed: null };
    function ambienceTick(dt) {
        if (!AC) return;
        var sv = sVol();
        var hx = Math.floor(S.px), hy = Math.floor(S.py + EYE), hz = Math.floor(S.pz);
        var sub = getB(hx, hy, hz) === WATER;

        /* Head under water: the real game lowpasses everything the moment you
           go under, and un-does it the moment you surface. The eyes crossing
           the surface is a sound of its own each way. */
        var mf = sub ? 620 : 21000;
        MUFFLE.frequency.setTargetAtTime(mf, AC.currentTime, 0.08);
        MASTER.gain.setTargetAtTime(sub ? 0.3 : 0.42, AC.currentTime, 0.1);
        if (sub !== AMB.sub) { AMB.sub = sub; if (sv) snd(sub ? 'uwenter' : 'uwexit'); }

        // the body going into water: a splash scaled by how hard it hit
        var bodyW = getB(hx, Math.floor(S.py + 0.4), hz) === WATER;
        if (bodyW !== AMB.water) {
            AMB.water = bodyW;
            if (sv && bodyW) snd('splash', Math.abs(RT.vy || 0), S.px, S.py + 0.4, S.pz);
            AMB.swimD = 0;
        }
        // swimming strokes, on distance travelled, the way footsteps are
        if (bodyW && sv) {
            AMB.swimD += Math.sqrt((S.px - AMB.lx) * (S.px - AMB.lx) + (S.pz - AMB.lz) * (S.pz - AMB.lz));
            if (AMB.swimD > 1.4) { AMB.swimD = 0; snd('swim', 0, S.px, S.py + 0.6, S.pz); }
        }
        AMB.lx = S.px; AMB.lz = S.pz;

        uwBed(sv && sub, dt);
        if (!sv) return;

        /* Under water the bed is joined, now and then, by a stream of bubbles,
           and more rarely by something bigger somewhere out in the dark —
           the game's own "additions" and "rare additions" rolls. */
        if (sub) {
            if (Math.random() < dt * 0.22) snd('uwadd');
            else if (Math.random() < dt * 0.022) snd('uwrare');
        }

        /* Rain is not a loop in the real game. Every few ticks it picks a spot
           where rain is landing near you and plays one short clip from there,
           half as loud and an octave down when that spot is above your head,
           which is the whole of how a roof sounds in the rain. */
        if (S.weather >= 1) {
            AMB.rainT -= dt;
            if (AMB.rainT <= 0) { AMB.rainT = 0.1 + Math.random() * 0.2; rainDrop(); }
        }

        /* Nearest lava and nearest lit furnace, resampled twice a second. A
           390-cell box is cheap enough to just walk, and it means the roar
           genuinely comes from the lava rather than from the player. */
        AMB.scan -= dt;
        if (AMB.scan <= 0) {
            AMB.scan = 0.5;
            var bx = Math.floor(S.px), by = Math.floor(S.py), bz = Math.floor(S.pz);
            var lbest = 1e9, fbest = 1e9, lp = null, fp = null, ln = 0;
            for (var ox = -6; ox <= 6; ox++) for (var oy = -3; oy <= 3; oy++) for (var oz = -6; oz <= 6; oz++) {
                var b2 = getB(bx + ox, by + oy, bz + oz);
                if (b2 !== LAVA && b2 !== FURN_LIT) continue;
                var dd = ox * ox + oy * oy * 2 + oz * oz;
                if (b2 === LAVA) { ln++; if (dd < lbest) { lbest = dd; lp = [bx + ox + 0.5, by + oy + 0.5, bz + oz + 0.5]; } }
                else if (dd < fbest) { fbest = dd; fp = [bx + ox + 0.5, by + oy + 0.5, bz + oz + 0.5]; }
            }
            AMB.lavaP = lp; AMB.fireP = fp; AMB.lava = lp ? Math.min(1, ln / 12) : 0;
        }
        // lava pops often and roars now and then; a lit furnace crackles
        if (AMB.lavaP) {
            if (Math.random() < dt * (0.35 + AMB.lava)) snd('lavapop', 0, AMB.lavaP[0], AMB.lavaP[1], AMB.lavaP[2]);
            if (Math.random() < dt * (0.02 + AMB.lava * 0.1)) snd('lava', 0, AMB.lavaP[0], AMB.lavaP[1], AMB.lavaP[2]);
        }
        if (AMB.fireP && Math.random() < dt * 0.3) snd('crackle', 0, AMB.fireP[0], AMB.fireP[1], AMB.fireP[2]);

        /* Cave sounds. The real game looks for a spot near the player that is
           air, unlit by sky AND unlit by torches, and a few blocks off — then
           plays from there. A long randomised cooldown is what keeps it
           unnerving instead of annoying.

           The search has to be generous. Vanilla rolls for a spot on every
           client tick, which is twenty chances a second; a port that probes a
           dozen times when the cooldown lapses and then gives up until the
           next one is a completely different thing. Measured underground in
           this world only about one probe in a hundred lands somewhere that
           qualifies, so a dozen probes per lapse fired roughly once an hour.
           Probe 80 times, and if nothing qualifies retry in a couple of
           seconds rather than eating the whole cooldown — the cooldown is
           meant to space out sounds that PLAYED, not searches that failed. */
        AMB.caveCd -= dt;
        if (AMB.caveCd <= 0) {
            AMB.caveCd = 2.5;                            // nothing found: come back shortly
            if (S.py < 58) for (var a = 0; a < 80; a++) {
                var cx = Math.floor(S.px) + ((Math.random() * 33) | 0) - 16;
                var cy = Math.floor(S.py) + ((Math.random() * 25) | 0) - 12;
                var cz = Math.floor(S.pz) + ((Math.random() * 33) | 0) - 16;
                if (cy < 1 || cy > CH - 2) continue;
                var cd2 = (cx - S.px) * (cx - S.px) + (cy - S.py) * (cy - S.py) + (cz - S.pz) * (cz - S.pz);
                if (cd2 < 25 || cd2 > 400) continue;
                if (getB(cx, cy, cz) !== AIR) continue;
                if (getSky(cx, cy, cz) > 0 || getBlk(cx, cy, cz) > 3) continue;
                snd('cave', 0, cx + 0.5, cy + 0.5, cz + 0.5);
                AMB.caveCd = 34 + Math.random() * 76;    // one PLAYED: now leave it alone for a while
                break;
            }
        }
    }
    // one clip of rain, from wherever it is landing somewhere within ten blocks
    function rainDrop() {
        var rx = Math.floor(S.px) + ((Math.random() * 21) | 0) - 10, rz = Math.floor(S.pz) + ((Math.random() * 21) | 0) - 10;
        if (!chunkAt(rx, rz)) return;
        var ry = CH - 1;
        while (ry > 1 && getB(rx, ry, rz) === AIR) ry--;
        snd('rain', ry + 1 > S.py + EYE + 1 ? 0 : 1, rx + 0.5, ry + 1, rz + 0.5);
    }
    /* The underwater bed is the one true loop: it fades in over a second or
       two once your head is under, fades out as you surface, and lets go of
       its voice a few seconds after that. */
    function uwBed(on, dt) {
        var L = AMB.bed, path = 'ambient/underwater/underwater_ambience';
        if (on && !L) {
            var b = SB[path];
            if (!b || b.then) { sndLoad(path); return; }
            var g = AC.createGain(); g.gain.value = 0.0001; g.connect(BUS.uw);
            var s = AC.createBufferSource(); s.buffer = b; s.loop = true; s.connect(g); s.start();
            L = AMB.bed = { s: s, g: g, off: 0 };
            sndKeep(path);
        }
        if (!L) return;
        L.g.gain.setTargetAtTime(on ? 0.65 : 0.0001, AC.currentTime, on ? 0.6 : 0.3);
        L.off = on ? 0 : L.off + dt;
        if (L.off > 3) { try { L.s.stop(); } catch (e) { } AMB.bed = null; }
    }

    /* ── music ───────────────────────────────────────────────
       C418's soundtrack, chosen the way the game chooses it: the menu set on
       the title screen; the overworld set in survival; the creative set, and
       the overworld's with it, in creative; and the three underwater pieces
       when your head is under water as a piece begins. The real game leaves
       ten to twenty minutes between pieces, far too long for a browser tab,
       so this leaves two and a half to six. As in the game, a menu piece
       still playing when you walk into a world is left to finish, and walking
       back out to the title screen cuts whatever the world was playing. */
    var MUSIC = {
        menu: ['music/menu/mutation', 'music/menu/moog_city_2', 'music/menu/beginning_2', 'music/menu/floating_trees'],
        game: ['music/game/minecraft', 'music/game/clark', 'music/game/sweden', 'music/game/subwoofer_lullaby',
            'music/game/living_mice', 'music/game/haggstrom', 'music/game/danny', 'music/game/key',
            'music/game/oxygene', 'music/game/dry_hands', 'music/game/wet_hands', 'music/game/mice_on_venus'],
        creative: ['music/game/creative/biome_fest', 'music/game/creative/blind_spots', 'music/game/creative/haunt_muskie',
            'music/game/creative/aria_math', 'music/game/creative/dreiton', 'music/game/creative/taswell'],
        water: ['music/game/water/axolotl', 'music/game/water/dragon_fish', 'music/game/water/shuniji']
    };
    function musEl() {
        if (MUS || !AC) return MUS;
        var el = new Audio(), g = AC.createGain();
        el.preload = 'auto';
        AC.createMediaElementSource(el).connect(g); g.connect(BUS.music);
        var m = MUS = { el: el, g: g, cur: null, kind: null, last: null };
        el.addEventListener('ended', function () {
            if (MUS !== m) return;
            m.cur = null;
            // the world's scheduler takes over again; the title screen runs its own
            if (RT && m.kind !== 'menu') RT.musT = 150 + Math.random() * 210;
        });
        return m;
    }
    function musStart(kind, list) {
        var m = musEl();
        if (!m) return;
        var pool = list.filter(function (p) { return p !== m.last; });
        var p = sndPick(pool.length ? pool : list);
        m.kind = kind; m.cur = p; m.last = p;
        m.el.src = SND_BASE + p + '.m4a';
        var pr = m.el.play();
        if (pr && pr.catch) pr.catch(function () { if (MUS === m && m.cur === p) m.cur = null; });   // refused: try again next time round
    }
    function musPlaying() { return !!(MUS && MUS.cur && !MUS.el.paused); }
    function musStop() { if (MUS && MUS.cur) { MUS.el.pause(); MUS.cur = null; } }
    function musDrop() {   // the window closing
        if (!MUS) return;
        MUS.el.pause(); MUS.el.removeAttribute('src');
        try { MUS.el.load(); } catch (e) { }
        MUS = null;
    }
    function playMusic() {
        if (!AC || !mVol()) { RT.musT = 20; return; }   // muted now ≠ muted forever: keep the scheduler alive
        if (musPlaying()) { RT.musT = 20; return; }     // the title screen's piece is still finishing
        if (getB(Math.floor(S.px), Math.floor(S.py + EYE), Math.floor(S.pz)) === WATER) musStart('water', MUSIC.water);
        else if (isCreative()) musStart('creative', MUSIC.creative.concat(MUSIC.game));
        else musStart('game', MUSIC.game);
        RT.musT = 0;   // nothing more until this piece ends
    }
    function menuMusic(dt) {
        if (!AC) return;
        if (MUS && MUS.cur && MUS.kind !== 'menu') { musStop(); RT.menuMusT = 0.5; }   // the title screen replaces the world's piece
        if (musPlaying() || !mVol()) return;
        RT.menuMusT = (RT.menuMusT == null ? 0.5 : RT.menuMusT) - dt;
        if (RT.menuMusT > 0) return;
        RT.menuMusT = 1 + Math.random() * 29;   // the game's own gap between menu pieces, for when this one ends
        musStart('menu', MUSIC.menu);
    }

    /* ── chunk streaming ────────────────────────────────────── */
    function ensureChunks() {
        var pcx = Math.floor(S.px / CW), pcz = Math.floor(S.pz / CW), k;
        var want = [];
        for (var dx = -VIEW; dx <= VIEW; dx++) for (var dz = -VIEW; dz <= VIEW; dz++) {
            k = ckey(pcx + dx, pcz + dz);
            if (!RT.chunks[k] && RT.genQ.indexOf(k) < 0) want.push({ k: k, d: dx * dx + dz * dz });
        }
        want.sort(function (a, b) { return a.d - b.d; });
        for (var i = 0; i < want.length; i++) RT.genQ.push(want[i].k);
        // drop the far ones
        for (k in RT.chunks) {
            var c = RT.chunks[k];
            if (Math.abs(c.cx - pcx) > VIEW + 1 || Math.abs(c.cz - pcz) > VIEW + 1) {
                if (c.mesh) { var gl = RT.G.gl; gl.deleteBuffer(c.mesh.op.b); gl.deleteBuffer(c.mesh.cut.b); gl.deleteBuffer(c.mesh.wat.b); }
                delete RT.chunks[k];
                chunkCacheDrop();
            }
        }
        RT.ckeys = Object.keys(RT.chunks);
    }
    function genStep() {   // one queued column per frame keeps walking smooth
        var k = RT.genQ.shift();
        if (!k) return;
        if (RT.chunks[k]) return;
        var p = k.split(',');
        var c = genChunk(p[0] | 0, p[1] | 0);
        lightNewChunk(c);
        dirtyChunk(k);
        dirtyChunk(ckey(c.cx - 1, c.cz)); dirtyChunk(ckey(c.cx + 1, c.cz));
        dirtyChunk(ckey(c.cx, c.cz - 1)); dirtyChunk(ckey(c.cx, c.cz + 1));
        RT.ckeys = Object.keys(RT.chunks);
    }
    function meshStep(n) {
        while (n-- > 0 && RT.meshQ.length) {
            var k = RT.meshQ.shift(), c = RT.chunks[k];
            if (c && c.dirty) meshChunk(c);
        }
    }

    /* ── save / restore ─────────────────────────────────────── */
    function sSave() {
        if (!S || !RT) return;
        S.hrs = RT.baseHrs + RT.playT / 3600;
        var i;
        /* Entities only exist in RT once restoreEnts has run, which happens on the
           single frame the world finishes loading. Saving before that overwrote
           S.ents/S.items/S.orbs with three empty arrays — so quitting, refreshing
           or navigating away while "Building terrain…" was still up permanently
           erased your death pile and every saved mob. Bank the playtime, leave the
           entity lists exactly as they were loaded. */
        if (RT.ready) {
            S.ents = [];
            for (i = 0; i < RT.foes.length && S.ents.length < 40; i++) {
                var f = RT.foes[i];
                S.ents.push({ k: f.k, x: Math.round(f.x * 10) / 10, y: Math.round(f.y * 10) / 10, z: Math.round(f.z * 10) / 10, hp: f.hp, sz: f.sz, baby: f.baby > 0 ? 1 : 0 });
            }
            S.items = [];
            for (i = RT.drops.length - 1; i >= 0 && S.items.length < 150; i--) {   // newest first: death gear beats old blast rubble
                var d = RT.drops[i];
                S.items.push({ it: d.it, c: d.c, dur: d.dur, ench: d.ench, iname: d.iname, x: Math.round(d.x * 10) / 10, y: Math.round(d.y * 10) / 10, z: Math.round(d.z * 10) / 10 });
            }
            S.orbs = [];
            for (i = 0; i < RT.orbs.length && S.orbs.length < 60; i++) { var o = RT.orbs[i]; S.orbs.push({ x: Math.round(o.x * 10) / 10, y: Math.round(o.y * 10) / 10, z: Math.round(o.z * 10) / 10, v: o.v }); }
        }
        /* The panorama world behind the title screen is not anybody's save.
           It briefly occupies S, and writing it out would quietly replace the
           world the player last played with a scenic hillside. */
        if (RT.menu) return;
        var json, failed = false;
        try { json = JSON.stringify(S); } catch (e) { return; }
        try { localStorage.setItem('comp_mc', json); } catch (e) { failed = true; }
        // comp_mc stays the active world; the per-world blob is what the list reads
        if (S.wid) {
            try { localStorage.setItem(WS_PRE + S.wid, json); } catch (e) { failed = true; }
            wsTouch(S.wid, { played: Date.now(), hrs: S.hrs || 0, gm: S.gm, diff: S.diff });
        }
        /* The browser's storage has a ceiling and a big creative build reaches
           it. The write used to fail in silence and the world quietly went back
           to its last good save on the next load — so say so, once a minute
           while it keeps failing, and again on the title screen. */
        RT.saveFail = failed;
        if (failed && (!RT.saveWarnT || RT.now - RT.saveWarnT > 60)) {
            RT.saveWarnT = RT.now || 0.001;
            toast('<b>World not saved</b>Browser storage is full. Recent changes will be lost.');
        }
    }
    function restoreEnts() {
        var i;
        if (S.ents) for (i = 0; i < S.ents.length; i++) {
            var e = S.ents[i];
            if (MOBS[e.k]) { var nf = mkFoe(e.k, e.x, e.y, e.z, e.hp); if (e.sz) { nf.sz = e.sz; applySlimeSize(nf); nf.hp = e.hp; } if (e.baby) nf.baby = 15; RT.foes.push(nf); }
        }
        if (S.items) for (i = 0; i < S.items.length; i++) {
            var it = S.items[i];
            if (I[it.it]) RT.drops.push({ x: it.x, y: it.y, z: it.z, vx: 0, vy: 0, vz: 0, it: it.it, c: it.c, dur: it.dur, ench: it.ench || null, iname: it.iname || null, age: 1, hw: 0.12, h: 0.24 });
        }
        if (S.orbs) for (i = 0; i < S.orbs.length; i++) { var so = S.orbs[i]; RT.orbs.push({ x: so.x, y: so.y, z: so.z, vx: 0, vy: 0, vz: 0, v: so.v, age: 1 }); }
    }
    function findSpawn() {
        for (var r = 0; r < 48; r++) for (var t = 0; t < 8; t++) {
            var x = 8 + Math.round(Math.cos(t * 0.785) * r * 2), z = 8 + Math.round(Math.sin(t * 0.785) * r * 2);
            var h = heightAt(x, z);
            if (h > SEA && !caveAt(x, h, z) && biomeAt(x, z) !== 3 && !treeAt(x, z)) return [x + 0.5, h + 1.2, z + 0.5];
        }
        return [8.5, heightAt(8, 8) + 1.2, 8.5];
    }

    /* ── pointer lock plumbing ──────────────────────────────── */
    function lockFailed() {   // requestPointerLock rejects async (Esc cooldown, no activation): land back on the menu, never in limbo
        if (RT && RT.ready && !RT.panel && !RT.dead && !RT.devFree && document.pointerLockElement !== RT.cv) showPause();
    }
    function lockCursor() {
        if (!(RT && RT.cv && RT.cv.requestPointerLock)) return;
        try {
            var p = RT.cv.requestPointerLock();
            if (p && p.catch) p.catch(lockFailed);
        } catch (e) { lockFailed(); }
    }
    function unlockCursor() { if (document.pointerLockElement) { RT.expectUnlock = true; try { document.exitPointerLock(); } catch (e) {} } }
    function onLockChange() {
        if (!RT) return;
        if (document.pointerLockElement === RT.cv) {
            RT.expectUnlock = false;
            /* A lock request already in flight when a screen opens still resolves,
               and used to be accepted — leaving the inventory up with the pointer
               captured and the camera spinning behind it. Hand it straight back. */
            if (RT.panel || RT.dead || RT.chat || (RT.sleep && !RT.woke)) { unlockCursor(); return; }
            if (RT.paused) hidePause();
            RT.el.focus();
        }
        else {
            if (RT.expectUnlock) { RT.expectUnlock = false; return; }
            if (RT.ready && !RT.panel && !RT.dead && !RT.devFree) showPause();
        }
    }

    /* ── the loop ───────────────────────────────────────────── */
    function frame(ts) {
        if (!RT) return;
        cancelAnimationFrame(RT.raf);
        RT.raf = requestAnimationFrame(frame);
        RT.wall = performance.now();
        var dt = RT.lastT ? (ts - RT.lastT) / 1000 : 0.016;
        if (!(dt > 0)) dt = 0.016;   // clock skew (rAF vs heartbeat, virtual time) must never run physics backwards
        dt = Math.min(0.05, dt);
        RT.lastT = ts;
        RT.now = (RT.now || 0) + dt;          // seconds since open; the chat fade reads this
        RT.fpsN++; RT.fpsT += dt;
        if (RT.fpsT >= 1) { RT.fps = RT.fpsN; RT.fpsN = 0; RT.fpsT = 0; }
        /* Two things can be in front of the world: the menu, and the world's
           own boot. The menu runs on top of a boot (that is the loading
           screen), so it gets a step of the ladder and then the frame. */
        if (RT.menu) {
            if (!RT.built) bootStep();
            var mm0 = RT.menu;
            mnFrame(mm0, dt);
            if (!mm0.inworld) menuMusic(dt);   // the world's music carries on under its own options
            return;
        }
        if (!RT.built) { bootStep(); return; }
        if (!RT.ready) return;
        // a hidden window (minimize, Show desktop) or hidden tab with a GUI open must not keep the world killing you off-screen
        if (!RT.paused && RT.ready && !RT.dead && !RT.devFree && (RT.el.offsetParent === null || (document.hidden && RT.panel))) {
            if (RT.panel) closePanel(true);
            unlockCursor();
            showPause();
        }
        var simming = !RT.paused;
        if (simming) {
            RT.playT += dt;
            RT.worldMs += dt * 1000;
            if (rule('doDaylightCycle')) S.t = (S.t + dt * 1000) % CYCLE;
            RT.iframe = Math.max(0, RT.iframe - dt);
            RT.digCd = Math.max(0, RT.digCd - dt);
            RT.atkCd = Math.max(0, RT.atkCd - dt);
            RT.swing = Math.max(0, RT.swing - dt);
            // swapping what you're holding dips the hand and lifts the new item in.
            // Watching the held id (not S.sel) catches every route into a swap:
            // the number keys, the wheel, pick block, and the inventory screen.
            var heldNow = (held() || {}).id || null;
            if (heldNow !== RT.equipId) {
                RT.equipId = heldNow; RT.equip = 1;
                RT.atkCd = RT.atkCdMax = attackCooldown(heldNow);   // a new item in hand starts its swing from empty
            }
            RT.equip = Math.max(0, RT.equip - dt / EQUIP_T);
            RT.lightning = Math.max(0, (RT.lightning || 0) - dt);
            RT.target = raycast();
            stepPlayer(dt);
            statMove(dt);
            camFrame(dt);
            if ((RT.rbScanT = (RT.rbScanT || 0) + dt) >= 0.25) { RT.rbScanT = 0; rbScan(); }   // inventory_changed, for the recipe advancements
            fovTick(dt);
            digTick(dt);
            useTick(dt);
            foodTick(dt);
            effectTick(dt);
            sleepTick(dt);
            var i;
            for (i = RT.foes.length - 1; i >= 0; i--) if (foeTick(RT.foes[i], dt)) RT.foes.splice(i, 1);
            for (i = RT.dying.length - 1; i >= 0; i--) if (dyingUpdate(RT.dying[i], dt)) RT.dying.splice(i, 1);
            for (i = RT.drops.length - 1; i >= 0; i--) if (dropUpdate(RT.drops[i], dt)) RT.drops.splice(i, 1);
            for (i = RT.arrows.length - 1; i >= 0; i--) if (arrowUpdate(RT.arrows[i], dt)) RT.arrows.splice(i, 1);
            for (i = RT.tnts.length - 1; i >= 0; i--) if (tntUpdate(RT.tnts[i], dt)) RT.tnts.splice(i, 1);
            for (i = RT.orbs.length - 1; i >= 0; i--) if (orbUpdate(RT.orbs[i], dt)) RT.orbs.splice(i, 1);
            for (i = RT.parts.length - 1; i >= 0; i--) if (partUpdate(RT.parts[i], dt)) RT.parts.splice(i, 1);
            weatherTick(dt);
            RT.secT += dt;
            if (RT.secT >= 1) {
                RT.secT = 0;
                spawnTick();
                ensureChunks();
                if (!RT.saveT) RT.saveT = 0;
                if (++RT.saveT >= 20) { RT.saveT = 0; sSave(); }
                // orphaned canopies melt over a few seconds, like they should
                for (var dq = 0; dq < 8 && RT.decayQ.length; ) {
                    var lf = RT.decayQ.splice(0, 3);
                    if (getB(lf[0], lf[1], lf[2]) === LEAVES && !logNear(lf[0], lf[1], lf[2])) {
                        setB(lf[0], lf[1], lf[2], AIR);
                        if (Math.random() < 0.05) dropItem(lf[0] + 0.5, lf[1] + 0.4, lf[2] + 0.5, 'apple', 1);
                        if (Math.random() < 0.02) dropItem(lf[0] + 0.5, lf[1] + 0.4, lf[2] + 0.5, 'stick', 1);
                        dq++;
                    }
                }
            }
            randomTicks(dt);
            furnaceTick(dt);
            genStep();
            meshStep(2);
            // the HUD's animations run on the game's own 20 Hz tick, and pause with it
            RT.hudTickT = (RT.hudTickT || 0) + dt;
            while (RT.hudTickT >= HUD_TICK) { RT.hudTickT -= HUD_TICK; hudTick(false); }
            RT.hudT += dt;
            if (RT.hudT > 0.2) {
                RT.hudT = 0;
                paintXp(); paintDebug(); paintChat(); paintEffects();
                /* An open panel is only ever repainted by its own click handlers, so
                   anything the SIM changed behind it stayed invisible: a furnace's
                   output, items you walked over, a helmet that shattered mid-fight,
                   the enchant options going affordable as xp came in. Painted on a
                   dirty flag rather than every tick — the catalogue is 45 cells and
                   nothing mutates it from the sim. */
                if (RT.panelDirty && RT.panel) { RT.panelDirty = 0; paintPanel(); }
            }
            if (RT.musT > 0) { RT.musT -= dt; if (RT.musT <= 0) playMusic(); }
        }
        ambienceTick(dt);
        entGeo();
        var vig = RT.el.querySelector('.mc-vig');
        var headB = getB(Math.floor(S.px), Math.floor(S.py + EYE), Math.floor(S.pz));
        /* Java has no red flash when you are hurt and no shake for an explosion:
           the camera's tilt is the hurt, and lava is its fog. Under water the game
           lays its faint underwater texture over the view; a lightning strike
           lights the sky, a little of which reaches the whole scene. */
        vig.style.background = RT.lightning > 0 ? 'rgba(255,255,255,' + Math.min(0.12, RT.lightning * 0.7) + ')'
            : headB === WATER ? 'rgba(18,40,120,0.12)' : 'transparent';
        var vgn = RT.el.querySelector('.mc-vign');   // Gui.renderVignette: stronger the darker it is where you stand
        if (vgn && CAM) { var vo = (CAM.vigO + (CAM.vig - CAM.vigO) * camPt()).toFixed(3); if (vgn._o !== vo) { vgn._o = vo; vgn.style.opacity = vo; } }
        drawFrame();
        hudFrame(dt);
        if (RT.av) avatarDraw();   // the figure in the inventory box, turning with the pointer and swaying
    }
    /* ── the world's loading screen ──
       LevelLoadingScreen as 1.21.9 draws it: over the blurred panorama and the
       menu background, "Loading terrain..." in white, a 200x2 bar twelve pixels
       under it filling in green on black, and in singleplayer the chunk map:
       every chunk the world is waiting on as a 2x2 cell in its generation
       status's colour, centred on the screen, the text 26 pixels above it. */
    var LOAD_COL = { none: '#000000', queued: '#545454', terrain: '#21c600', light: '#ffe0a0', full: '#ffffff' };
    function loadShow(on) {
        var ld = RT.el.querySelector('.mc-load');
        if (!ld) return;
        ld.style.display = on ? '' : 'none';
        RT.el.classList.toggle('mc-loading', !!on);
        RT.el.classList.toggle('mc-mblur', !!on);
        if (on) { RT.loadF = 0; RT.el.style.setProperty('--mblur', (5.5 / (window.devicePixelRatio || 1)).toFixed(2) + 'px'); loadPaint(0); }
    }
    function loadPaint(f) {
        var ld = RT.el.querySelector('.mc-load');
        if (!ld || ld.style.display === 'none' || !RT.gs) return;
        RT.loadF = (RT.loadF || 0) + (f - (RT.loadF || 0)) * 0.2;
        var W = RT.gw, H = RT.gh, r = VIEW, n = 2 * r + 1, cy = H >> 1, ty = cy - 2 * r - 27;
        var t = ld.querySelector('.mc-ltext'), bar = ld.querySelector('.mc-lbar'), map = ld.querySelector('.mc-lmap');
        mtSet(t.firstChild, 'Loading terrain...', '#ffffff');
        hudPlace(t, (W >> 1) - ((mfWidth('Loading terrain...') + 1) >> 1), ty);
        hudPlace(bar, (W >> 1) - 100, ty + 12);
        bar.firstChild.style.width = 'calc(var(--px) * ' + Math.round(200 * Math.max(0, Math.min(1, RT.loadF))) + ')';
        if (map.width !== n) { map.width = map.height = n; map.style.width = map.style.height = 'calc(var(--px) * ' + 2 * n + ')'; }
        hudPlace(map, (W >> 1) - n, cy - n);
        var c = map.getContext('2d'), pcx = Math.floor(S.px / CW), pcz = Math.floor(S.pz / CW);
        for (var dz = -r; dz <= r; dz++) for (var dx = -r; dx <= r; dx++) {
            var k = ckey(pcx + dx, pcz + dz), ch = RT.chunks[k];
            c.fillStyle = LOAD_COL[ch ? (ch.mesh ? 'full' : RT.lit ? 'light' : 'terrain') : RT.genQ.indexOf(k) >= 0 ? 'queued' : 'none'];
            c.fillRect(dx + r, dz + r, 1, 1);
        }
    }
    function bootBar(f) { loadPaint(f); }
    /* The boot ladder — generate, light, mesh — pulled out of frame() so that
       both things that wait on it can drive their own progress bar: the menu's,
       while the panorama world stands up behind the title screen, and the
       game's own "Building terrain…" once a world has been chosen. */
    function bootStep() {
        var total = (VIEW * 2 + 1) * (VIEW * 2 + 1), k, p;
        if (RT.genQ.length) {
            for (var g = 0; g < 3 && RT.genQ.length; g++) {
                k = RT.genQ.shift(); p = k.split(',');
                if (!RT.chunks[k]) genChunk(p[0] | 0, p[1] | 0);
            }
            return bootProg((total - RT.genQ.length) / total * 0.6, 'Building terrain…');
        }
        if (!RT.lit) {
            lightInitAll();
            RT.lit = true;
            RT.ckeys = Object.keys(RT.chunks);
            for (var mk in RT.chunks) RT.meshQ.push(mk);
            return bootProg(0.65, 'Lighting the world…');
        }
        if (RT.meshQ.length) {
            meshStep(4);
            return bootProg(0.65 + 0.35 * (1 - RT.meshQ.length / total), 'Building terrain…');
        }
        bootProg(1, 'Loading…');
        RT.built = true;
        bootDone();
    }
    function bootProg(f, stage) {
        bootBar(f);
        if (RT.menu) { RT.menu.prog = f; RT.menu.stage = stage; RT.menu.dirty = true; }
    }
    function bootDone() {
        if (RT.menu) {   // the panorama is standing; let the title screen come up out of black
            if (RT.menu.scr === 'loading') {
                RT.menu.fading = RT.menu.wantFade;
                RT.menu.fadeT = 0;
                RT.menu.scr = 'title'; RT.menu.prev = []; RT.menu.sig = ''; RT.menu.dirty = true;
            }
            return;
        }
        RT.ready = true;
        // if the spawn column grew something since it was chosen, surface politely
        var guard = 0;
        while (boxHits(S.px, S.py, S.pz) && S.py < CH - 2 && guard++ < CH) S.py += 1;
        RT.fallY = S.py; RT.vy = 0;
        loadShow(false);
        restoreEnts();
        if (S.bonusPending) bonusChest();
        paintHotbar(); paintVitals(); paintHudMode();
        if (RT.onReady) { try { RT.onReady(); } catch (e) {} RT.onReady = null; }
        if (!RT.devFree) showPause();
    }

    /* ── moving between the menu and a world ─────────────────
       Both directions tear the world down properly first. The chunk meshes
       are GL buffers, so dropping the references is not enough — the panorama
       would sit in video memory for the whole session. */
    function mnTeardownWorld() {
        var gl = RT.G && RT.G.gl;
        for (var k in RT.chunks) {
            var c = RT.chunks[k];
            if (c.mesh && gl) { gl.deleteBuffer(c.mesh.op.b); gl.deleteBuffer(c.mesh.cut.b); gl.deleteBuffer(c.mesh.wat.b); }
        }
        RT.chunks = {}; RT.ckeys = []; RT.genQ = []; RT.meshQ = []; RT.decayQ = [];
        RT.foes = []; RT.dying = []; RT.drops = []; RT.arrows = []; RT.tnts = []; RT.parts = []; RT.entV = []; RT.orbs = [];
        RT.target = null; RT.digAt = null; RT.lit = false; RT.built = false; RT.ready = false;
        /* The panorama renders at 85°; leaving that set would hand the world
           the title screen's field of view. fovM is the sprint stretch and
           belongs to the world that was just thrown away. */
        RT.fov = 0; RT.fovM = 1; RT.fly = false; CAM = null;
        chunkCacheDrop();
    }
    function mnFreshWorld(w) {
        var s = sNew();
        s.seed = w.seed;
        s.gm = w.gm || 0;
        s.diff = w.hardcore ? 3 : (w.diff == null ? 2 : w.diff);
        s.hardcore = !!w.hardcore;
        s.cheats = !!w.cheats;
        s.wtype = w.type || 'Default';
        s.structures = w.structures !== false;
        s.wspawn = null;                  // must stay null so findSpawn runs for this seed
        s.fly = false;
        return s;
    }
    function mnPlay(m, id) {
        var w = wsGet(id);
        if (!w) return;
        audioInit();
        mnCloseUI();
        mnTeardownWorld();
        var blob = wsBlob(id);
        S = blob || mnFreshWorld(w);
        S.wid = id;
        var o = optLoad();
        S.snd = o.snd; S.mus = o.mus;     // the options the menu just edited win over whatever the world remembered
        if (!S.inv || !S.inv.length) S.inv = new Array(36).fill(null);
        if (!S.armor) S.armor = [null, null, null, null];
        if (S.xpl == null) { S.xpl = 0; S.xp = 0; }
        if (S.weather == null) { S.weather = 0; S.wt = 120; }
        normalizeCmdState();
        /* The same revival init() does, because this is now the other way into
           a world. A save written while the death screen was up has hp 0, and
           arriving with RT.dead set and no death screen is a world where
           nothing responds: showPause returns early on RT.dead, and movement,
           mining, placing and the inventory are all gated on !RT.dead. There
           is no way out of it and it re-saves itself on close. */
        if (S.hp <= 0) {
            S.hp = 20; S.food = 20; S.sat = 5; S.air = 10;
            var dsp = S.spawn || S.wspawn;
            if (dsp) { S.px = dsp[0]; S.py = dsp[1]; S.pz = dsp[2]; }
        }
        if (!S.wspawn) {
            S.wspawn = findSpawn();
            S.px = S.wspawn[0]; S.py = S.wspawn[1]; S.pz = S.wspawn[2];
        }
        if (!blob && w.bonus) S.bonusPending = true;
        /* Bank the world we are leaving before resetting the clock, or the
           desktop only ever gets the playtime of the last world of a session. */
        RT.bankT = (RT.bankT || 0) + RT.playT;
        RT.baseHrs = S.hrs || 0; RT.playT = 0; RT.dead = false; RT.fallY = S.py;
        // a LAN session belongs to the world that opened it
        RT.lan = null; RT.lanUI = null;
        var lanBtn = RT.el.querySelector('.mc-lanbtn'); if (lanBtn) lanBtn.disabled = false;
        // flight belongs to the world that granted it, not to the session
        RT.fly = !!S.fly && (S.gm === 1 || S.gm === 3);
        RT.vy = 0; RT.sprint = false; RT.swing = 0; RT.sleep = 0;
        loadShow(true);
        ensureChunks();
        wsTouch(id, { played: Date.now(), ver: (RT && RT.ver) || '26.2' });
    }
    /* Vanilla's "Save and Quit to Title": the world is written out, the world
       is thrown away, and the panorama is generated fresh behind the menu. */
    function mnToTitle() {
        stat('c', 'leave_game');
        sSave();
        if (S && S.wid) wsTouch(S.wid, { played: Date.now(), hrs: S.hrs || 0 });
        unlockCursor();
        if (RT.paused) hidePause();
        iwHide(); leaveBed();
        RT.lan = null; RT.lanUI = null;   // cheats from Open to LAN end with the session, as the real ones do
        if (RT.panel) closePanel(true);
        loadShow(false);
        // the debug overlay belongs to the world; it would sit frozen over the menu
        RT.f3 = false;
        RT.el.querySelector('.mc-debug').style.display = 'none';
        mnTeardownWorld();
        S = mnPanoSave();
        var m = mnOpen('loading', false);   // vanilla only fades in on first launch
        m.stage = 'Saving world…';
        if (RT.saveFail) m.msg = 'The world could not be saved: browser storage is full.';
        ensureChunks();
    }
    function mnQuit() {
        var h = window.MCHOST;
        if (h && h.quit) h.quit();          // the desktop closes the window, which is what quitting is here
        else if (RT) mnToTitle();
    }
    /* The bonus chest is one of the few Create New World switches that has to
       become a thing in the world rather than a flag, so it is placed once the
       chunks exist and the ground under spawn is known. */
    function bonusChest() {
        S.bonusPending = false;
        var cx0 = Math.floor(S.px), cz0 = Math.floor(S.pz), x, y, z, d;
        for (d = 1; d <= 3; d++) {
            x = cx0 + d; z = cz0;
            y = Math.floor(S.py);
            while (y > 4 && getB(x, y - 1, z) === AIR) y--;
            if (getB(x, y, z) === AIR && solidAt(x, y - 1, z)) break;
            x = null;
        }
        if (x == null) { x = cx0; y = Math.floor(S.py); z = cz0 + 1; }
        setB(x, y, z, CHEST, true);
        var t = tentAt(x, y, z, 'chest');
        var give = [['log', 6], ['planks', 12], ['stick', 8], ['wood_axe', 1], ['wood_pick', 1], ['apple', 4], ['torch', 8]];
        for (var i = 0; i < give.length; i++) if (I[give[i][0]]) t.inv[i] = { id: give[i][0], c: give[i][1] };
    }

    /* ═══════════════ the main menu ═══════════════
       Everything from the moment the launcher hands over to the moment a
       world starts generating: the loading screen, the title screen over a
       live panorama, and the screens behind its buttons.

       The GUI is drawn on a 2D canvas rather than built from DOM, because
       the thing being copied is a pixel grid. Vanilla lays every widget out
       in "GUI pixels" and then blits at an integer scale; a stack of divs
       can approximate that but it cannot promise it, and half-pixel button
       borders are exactly what makes a recreation look off. A transparent
       layer of real <button>s rides on top for hit-testing, focus, hover and
       screen readers, positioned from the same layout the painter uses.

       Nothing here is copied out of the game's assets. The font glyphs, the
       logo and the widget bevels are all authored in this file; the splash
       list is a short, well-known selection with a pile of local additions. */

    /* ── the font ────────────────────────────────────────────
       A bitmap face in the proportions of the game's: an 8-row cell, caps on
       rows 0-6, x-height on rows 2-6, one descender row, and a glyph's
       advance is its drawn width plus one. Trailing blank rows are dropped
       from the source below and padded back at parse time, so a capital is
       seven rows and only the letters that actually dip below the baseline
       carry eight. */
    var MF_ROWS = 9, MF_LINE = 9;   // cell height, and baseline-to-baseline
    /* A row string is 'rows joined by /', optionally prefixed 'N:' to say which
       row the first one lands on. Caps and digits run rows 0-6, so the baseline
       sits under row 6; x-height letters start at row 2, and the five that
       descend carry on to rows 7-8. Stating the offset beats counting leading
       dots — miscounting them is how every descender came out clipped and
       "Singleplayer" rendered as "Sinaleplauer". */
    var MF_SRC = {
        ' ': '...',
        '!': '#/#/#/#/#/./#',
        '"': '#.#/#.#',
        '#': '1:.#.#./#####/.#.#./#####/.#.#.',
        '$': '..#../.####/#.#../.###./..#.#/####./..#..',
        '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
        '&': '.##../#..#./.##../##.#./#..##/#..#./.##.#',
        "'": '#/#',
        '(': '..#/.#./#../#../#../.#./..#',
        ')': '#../.#./..#/..#/..#/.#./#..',
        '*': '1:#.#/.#./#.#',
        '+': '2:..#../#####/..#..',
        ',': '6:#/#',
        '-': '3:#####',
        '.': '6:#',
        '/': '....#/....#/...#./..#../.#.../#..../#....',
        '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
        '1': '..#../.##../..#../..#../..#../..#../.###.',
        '2': '.###./#...#/....#/...#./..#../.#.../#####',
        '3': '#####/...#./..##./....#/....#/#...#/.###.',
        '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
        '5': '#####/#..../####./....#/....#/#...#/.###.',
        '6': '..##./.#.../#..../####./#...#/#...#/.###.',
        '7': '#####/....#/...#./..#../.#.../.#.../.#...',
        '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
        '9': '.###./#...#/#...#/.####/....#/...#./.##..',
        ':': '2:#/./././#',
        ';': '2:#/./././#/#',
        '<': '...#/..#./.#../#.../.#../..#./...#',
        '=': '2:#####/...../#####',
        '>': '#.../.#../..#./...#/..#./.#../#...',
        '?': '.###./#...#/....#/...#./..#../...../..#..',
        '@': '.####./#....#/#.##.#/#.##.#/#.###./#...../.####.',
        'A': '.###./#...#/#...#/#####/#...#/#...#/#...#',
        'B': '####./#...#/#...#/####./#...#/#...#/####.',
        'C': '.###./#...#/#..../#..../#..../#...#/.###.',
        'D': '####./#...#/#...#/#...#/#...#/#...#/####.',
        'E': '#####/#..../#..../####./#..../#..../#####',
        'F': '#####/#..../#..../####./#..../#..../#....',
        'G': '.###./#...#/#..../#.###/#...#/#...#/.####',
        'H': '#...#/#...#/#...#/#####/#...#/#...#/#...#',
        'I': '###/.#./.#./.#./.#./.#./###',
        'J': '..###/...#./...#./...#./...#./#..#./.##..',
        'K': '#...#/#..#./#.#../##.../#.#../#..#./#...#',
        'L': '#..../#..../#..../#..../#..../#..../#####',
        'M': '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
        'N': '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
        'O': '.###./#...#/#...#/#...#/#...#/#...#/.###.',
        'P': '####./#...#/#...#/####./#..../#..../#....',
        'Q': '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
        'R': '####./#...#/#...#/####./#.#../#..#./#...#',
        'S': '.####/#..../#..../.###./....#/....#/####.',
        'T': '#####/..#../..#../..#../..#../..#../..#..',
        'U': '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
        'V': '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
        'W': '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
        'X': '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
        'Y': '#...#/#...#/.#.#./..#../..#../..#../..#..',
        'Z': '#####/....#/...#./..#../.#.../#..../#####',
        '[': '###/#../#../#../#../#../###',
        '\\': '#..../#..../.#.../..#../...#./....#/....#',
        ']': '###/..#/..#/..#/..#/..#/###',
        '^': '..#../.#.#./#...#',
        '_': '7:#####',
        '`': '#./.#',
        'a': '2:.###./....#/.####/#...#/.####',
        'b': '#..../#..../####./#...#/#...#/#...#/####.',
        'c': '2:.###./#..../#..../#..../.###.',
        'd': '....#/....#/.####/#...#/#...#/#...#/.####',
        'e': '2:.###./#...#/#####/#..../.###.',
        'f': '..##/.#../.#../####/.#../.#../.#..',
        'g': '2:.####/#...#/#...#/#...#/.####/....#/####.',
        'h': '#..../#..../####./#...#/#...#/#...#/#...#',
        'i': '#/./#/#/#/#/#',
        'j': '...#./...../...#./...#./...#./...#./...#./#..#./.##..',
        'k': '#.../#.../#..#/#.#./##../#.#./#..#',
        'l': '##/.#/.#/.#/.#/.#/.#',
        'm': '2:##.#./#.#.#/#.#.#/#.#.#/#.#.#',
        'n': '2:####./#...#/#...#/#...#/#...#',
        'o': '2:.###./#...#/#...#/#...#/.###.',
        'p': '2:####./#...#/#...#/#...#/####./#..../#....',
        'q': '2:.####/#...#/#...#/#...#/.####/....#/....#',
        'r': '2:#.###/##.../#..../#..../#....',
        's': '2:.####/#..../.###./....#/####.',
        't': '.#./.#./###/.#./.#./.#./..#',
        'u': '2:#...#/#...#/#...#/#...#/.####',
        'v': '2:#...#/#...#/#...#/.#.#./..#..',
        'w': '2:#...#/#...#/#.#.#/#.#.#/.#.#.',
        'x': '2:#...#/.#.#./..#../.#.#./#...#',
        'y': '2:#...#/#...#/#...#/.####/....#/####.',
        'z': '2:#####/...#./..#../.#.../#####',
        '{': '.##/.#./.#./##./.#./.#./.##',
        '|': '#/#/#/#/#/#/#',
        '}': '##./.#./.#./.##/.#./.#./##.',
        '~': '2:.##..#/#..##.',
        '…': '6:#.#.#',
        '·': '4:#',
        '←': '2:..#../.#.../#####/.#.../..#..',
        '→': '2:..#../...#./#####/...#./..#..'
    };
    /* Accents are drawn over the base letter rather than stored as their own
       glyphs: rows 0-1 are empty on every x-height letter, which is exactly
       where a diacritic goes, and the cedilla hangs in the descender row. One
       table then covers every language name on the Language screen that the
       Latin alphabet can spell. */
    var MF_MARK = {
        acute: { rows: ['...#.', '..#..'], y: 0 },
        grave: { rows: ['.#...', '..#..'], y: 0 },
        circ:  { rows: ['..#..', '.#.#.'], y: 0 },
        tilde: { rows: ['.##.#', '#..#.'], y: 0 },
        uml:   { rows: ['.#.#.'], y: 1 },
        ring:  { rows: ['..#..', '.#.#.', '..#..'], y: -1 },
        cedil: { rows: ['..#..', '..##.'], y: 7 },
        stroke: { rows: null, y: 0 }
    };
    var MF_ACC = {
        'á': ['a', 'acute'], 'à': ['a', 'grave'], 'â': ['a', 'circ'], 'ã': ['a', 'tilde'], 'ä': ['a', 'uml'], 'å': ['a', 'ring'],
        'é': ['e', 'acute'], 'è': ['e', 'grave'], 'ê': ['e', 'circ'], 'ë': ['e', 'uml'],
        'í': ['i', 'acute'], 'ì': ['i', 'grave'], 'î': ['i', 'circ'], 'ï': ['i', 'uml'],
        'ó': ['o', 'acute'], 'ò': ['o', 'grave'], 'ô': ['o', 'circ'], 'õ': ['o', 'tilde'], 'ö': ['o', 'uml'],
        'ú': ['u', 'acute'], 'ù': ['u', 'grave'], 'û': ['u', 'circ'], 'ü': ['u', 'uml'],
        'ñ': ['n', 'tilde'], 'ç': ['c', 'cedil'], 'ý': ['y', 'acute'],
        /* Only the cedilla can be composed onto a capital: caps already occupy
           rows 0-6, so every mark that sits above the letter would be drawn on
           top of it. The rest are deliberately absent and fall back to the
           unknown-glyph box, which is honest about what this face can spell. */
        'Ç': ['C', 'cedil']
    };

    var MF = null;   // { g: {ch: {w,h,px}}, atlas: {color: canvas}, map: {ch:[x,y,w]} }
    function mfBuild() {
        if (MF) return MF;
        var g = {}, ch, i, rows;
        function parse(src) {
            var off = 0, m = /^(\d+):/.exec(src);
            if (m) { off = +m[1]; src = src.slice(m[0].length); }
            var r = src.split('/'), w = 0, out = [], j;
            for (j = 0; j < r.length; j++) { if (r[j].length > w) w = r[j].length; }
            for (j = 0; j < MF_ROWS; j++) out.push(r[j - off] === undefined ? '' : r[j - off]);
            return { w: w, rows: out };
        }
        for (ch in MF_SRC) g[ch] = parse(MF_SRC[ch]);
        g[' '].w = 3;   // the space carries no pixels, so its width has to be stated
        for (ch in MF_ACC) {
            var base = g[MF_ACC[ch][0]], mark = MF_MARK[MF_ACC[ch][1]];
            if (!base || !mark || !mark.rows) continue;
            rows = base.rows.slice();
            for (i = 0; i < mark.rows.length; i++) {
                var y = mark.y + i;
                if (y < 0 || y >= MF_ROWS) continue;
                // centre the mark over the letter, then OR it into that row.
                // The mark is not always 5 wide and the base is not always 5
                // wide either, so measure both rather than assuming.
                var src = mark.rows[i];
                var off = Math.max(0, Math.round((base.w - src.replace(/\.+$/, '').length) / 2));
                var cur = rows[y] || '', line = '';
                for (var x = 0; x < Math.max(cur.length, off + src.length); x++) {
                    var a = cur.charAt(x) === '#', b = src.charAt(x - off) === '#';
                    line += (a || b) ? '#' : '.';
                }
                // a diacritic never widens the letter it sits on: letting the
                // mark's trailing blanks extend the row made ç a pixel wider
                // than c, and "Français" came out with a gap after the ç
                rows[y] = line.slice(0, base.w);
            }
            g[ch] = { w: base.w, rows: rows };
        }
        MF = { g: g, atlas: {}, map: null, w: 0, h: 0 };
        return MF;
    }
    function mfAdvance(ch) {
        var f = mfBuild(), gl = f.g[ch];
        return gl ? gl.w + 1 : 6;   // an unknown codepoint still takes room, like the game's box glyph
    }
    function mfWidth(text) {
        var w = 0;
        text = String(text == null ? '' : text);
        for (var i = 0; i < text.length; i++) w += mfAdvance(text.charAt(i));
        return w ? w - 1 : 0;   // no trailing gap after the last glyph
    }
    /* One atlas per colour, built on first use. Colouring by compositing a
       white atlas would work too, but a per-colour bake keeps every draw a
       plain drawImage with no state to leave behind. */
    function mfAtlas(color) {
        var f = mfBuild();
        if (f.atlas[color]) return f.atlas[color];
        if (!f.map) {
            var map = {}, x = 0, ch;
            for (ch in f.g) { map[ch] = x; x += f.g[ch].w + 1; }
            f.map = map; f.w = Math.max(1, x); f.h = MF_ROWS;
        }
        var cv = document.createElement('canvas');
        cv.width = f.w; cv.height = f.h;
        var cx = cv.getContext('2d');
        cx.fillStyle = color;
        for (var c in f.g) {
            var gl = f.g[c], ox = f.map[c];
            for (var y = 0; y < MF_ROWS; y++) {
                var row = gl.rows[y] || '';
                for (var i = 0; i < row.length; i++) if (row.charAt(i) === '#') cx.fillRect(ox + i, y, 1, 1);
            }
        }
        f.atlas[color] = cv;
        return cv;
    }
    function mfShadow(color) {
        /* The game's shadow is the colour at a quarter brightness, which is
           what makes white text sit on a grey ghost rather than a black one. */
        var n = parseInt(color.charAt(0) === '#' ? color.slice(1) : color, 16);
        if (!isFinite(n)) return '#3f3f3f';
        var r = (n >> 16 & 255) >> 2, g = (n >> 8 & 255) >> 2, b = (n & 255) >> 2;
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    /* Draws at one GUI pixel per canvas unit: the caller has already scaled
       the context, so everything below counts in the same units vanilla does. */
    function mfText(cx, text, x, y, color, shadow) {
        text = String(text == null ? '' : text);
        var f = mfBuild(), i, ch;
        if (shadow !== false) {
            var sa = mfAtlas(mfShadow(color || '#ffffff'));
            var px = x + 1;
            for (i = 0; i < text.length; i++) {
                ch = text.charAt(i);
                if (f.g[ch] && ch !== ' ') cx.drawImage(sa, f.map[ch], 0, f.g[ch].w, MF_ROWS, px, y + 1, f.g[ch].w, MF_ROWS);
                px += mfAdvance(ch);
            }
        }
        var a = mfAtlas(color || '#ffffff');
        for (i = 0; i < text.length; i++) {
            ch = text.charAt(i);
            if (f.g[ch] && ch !== ' ') cx.drawImage(a, f.map[ch], 0, f.g[ch].w, MF_ROWS, x, y, f.g[ch].w, MF_ROWS);
            x += mfAdvance(ch);
        }
    }
    function mfCenter(cx, text, cxp, y, color, shadow) { mfText(cx, text, Math.round(cxp - mfWidth(text) / 2), y, color, shadow); }
    function mfRight(cx, text, rx, y, color, shadow) { mfText(cx, text, Math.round(rx - mfWidth(text)), y, color, shadow); }
    /* Break a string to a pixel width on spaces, hard-splitting a word that
       cannot fit on its own. Used by the disconnect screens and the tooltips. */
    function mfWrap(text, max) {
        var words = String(text).split(' '), lines = [], cur = '';
        for (var i = 0; i < words.length; i++) {
            var next = cur ? cur + ' ' + words[i] : words[i];
            if (mfWidth(next) <= max) { cur = next; continue; }
            if (cur) { lines.push(cur); cur = ''; }
            var w = words[i];
            while (mfWidth(w) > max) {
                var cut = w.length;
                while (cut > 1 && mfWidth(w.slice(0, cut)) > max) cut--;
                lines.push(w.slice(0, cut)); w = w.slice(cut);
            }
            cur = w;
        }
        if (cur) lines.push(cur);
        return lines.length ? lines : [''];
    }

    /* — the same face as a web font —
       The menus draw through mfText, but the in-game GUI is DOM: the HUD, the
       containers, chat, tooltips and the text boxes. So the glyph table above
       is compiled into a real TrueType font at boot and handed to the browser
       as a FontFace. Every lit pixel becomes part of a rectangle contour, runs
       merged across rows, at 128 units to the pixel and 1024 to the em: at a
       font-size of 8 × the GUI scale, one font pixel is exactly one GUI pixel
       and every edge falls on a device pixel. Ascent 7 plus descent 2 is the
       9-pixel line, so a CSS line box of 9 GUI pixels has no half-leading and
       the baseline never lands between two pixels. */
    var MF_FAMILY = 'MCUI', MF_FACE = null;
    function mfRects(gl) {
        var open = {}, out = [], r, k;
        for (r = 0; r <= MF_ROWS; r++) {
            var row = r < MF_ROWS ? (gl.rows[r] || '') : '', runs = {}, x = 0;
            while (x < row.length) {
                if (row.charAt(x) !== '#') { x++; continue; }
                var x0 = x;
                while (x < row.length && row.charAt(x) === '#') x++;
                runs[x0 + ',' + x] = [x0, x];
            }
            for (k in open) if (!runs[k]) { out.push(open[k]); delete open[k]; }   // the run ended above this row
            for (k in runs) if (open[k]) open[k].r1 = r; else open[k] = { x0: runs[k][0], x1: runs[k][1], r0: r, r1: r };
        }
        return out;
    }
    function mfFontBytes(tbl, fam) {
        tbl = tbl || mfBuild().g; fam = fam || MF_FAMILY;
        var P = 128, UPM = 1024, ASC = 7 * P, DSC = 2 * P, i;
        var chars = Object.keys(tbl).filter(function (c) { return c.length === 1; })
            .sort(function (a, b) { return a.charCodeAt(0) - b.charCodeAt(0); });
        var glyphs = [{ adv: 6 * P, rects: [] }];   // .notdef: the unknown glyph's room, no ink
        var codes = [];
        chars.forEach(function (ch) {
            glyphs.push({ adv: (tbl[ch].w + 1) * P, rects: mfRects(tbl[ch]) });
            codes.push([ch.charCodeAt(0), glyphs.length - 1]);
        });
        function Buf() { this.b = []; }
        Buf.prototype = {
            u8: function (v) { this.b.push(v & 255); return this; },
            u16: function (v) { this.b.push((v >> 8) & 255, v & 255); return this; },
            u32: function (v) { this.b.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); return this; },
            pad: function () { while (this.b.length % 4) this.b.push(0); return this; }
        };
        // glyf + loca, and the metrics they imply
        var glyf = new Buf(), loca = [], fx0 = 0, fy0 = 0, fx1 = 0, fy1 = 0, maxPts = 0, maxCtr = 0;
        var advMax = 0, minLsb = 1e9, minRsb = 1e9, xMaxExt = 0, advSum = 0, advN = 0;
        for (i = 0; i < glyphs.length; i++) {
            var g = glyphs[i];
            loca.push(glyf.b.length);
            advMax = Math.max(advMax, g.adv);
            if (g.adv) { advSum += g.adv; advN++; }
            g.lsb = 0;
            if (!g.rects.length) continue;
            var pts = [], x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
            g.rects.forEach(function (rc) {
                var a = rc.x0 * P, b = rc.x1 * P, top = (7 - rc.r0) * P, bot = (6 - rc.r1) * P;
                pts.push([a, bot], [a, top], [b, top], [b, bot]);   // clockwise with y up: an outer contour
                x0 = Math.min(x0, a); x1 = Math.max(x1, b); y0 = Math.min(y0, bot); y1 = Math.max(y1, top);
            });
            g.lsb = x0;
            fx0 = Math.min(fx0, x0); fy0 = Math.min(fy0, y0); fx1 = Math.max(fx1, x1); fy1 = Math.max(fy1, y1);
            maxPts = Math.max(maxPts, pts.length); maxCtr = Math.max(maxCtr, g.rects.length);
            minLsb = Math.min(minLsb, x0); minRsb = Math.min(minRsb, g.adv - x1); xMaxExt = Math.max(xMaxExt, x1);
            glyf.u16(g.rects.length).u16(x0).u16(y0).u16(x1).u16(y1);
            for (var c = 0; c < g.rects.length; c++) glyf.u16(c * 4 + 3);
            glyf.u16(0);                                     // no hinting instructions
            for (var p = 0; p < pts.length; p++) glyf.u8(1); // every point on-curve, both coordinates as int16 deltas
            var px = 0, py = 0;
            for (p = 0; p < pts.length; p++) { glyf.u16(pts[p][0] - px); px = pts[p][0]; }
            for (p = 0; p < pts.length; p++) { glyf.u16(pts[p][1] - py); py = pts[p][1]; }
            glyf.pad();
        }
        loca.push(glyf.b.length);
        var T = {};
        var head = new Buf();
        head.u32(0x00010000).u32(0x00010000).u32(0).u32(0x5F0F3CF5).u16(0x000B).u16(UPM)
            .u32(0).u32(0).u32(0).u32(0).u16(fx0).u16(fy0).u16(fx1).u16(fy1)
            .u16(0).u16(8).u16(2).u16(1).u16(0);
        T.head = head;
        var hhea = new Buf();
        hhea.u32(0x00010000).u16(ASC).u16(-DSC).u16(0).u16(advMax).u16(minLsb).u16(minRsb).u16(xMaxExt)
            .u16(1).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(glyphs.length);
        T.hhea = hhea;
        var hmtx = new Buf();
        glyphs.forEach(function (gg) { hmtx.u16(gg.adv).u16(gg.lsb); });
        T.hmtx = hmtx;
        var maxp = new Buf();
        maxp.u32(0x00010000).u16(glyphs.length).u16(maxPts).u16(maxCtr).u16(0).u16(0).u16(2)
            .u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);
        T.maxp = maxp;
        var lc = new Buf();
        loca.forEach(function (o) { lc.u32(o); });
        T.loca = lc;
        T.glyf = glyf;
        var lo = codes[0][0], hi = codes[codes.length - 1][0];
        var os2 = new Buf();
        os2.u16(4).u16(Math.round(advSum / advN)).u16(400).u16(5).u16(0)
            .u16(4 * P).u16(4 * P).u16(0).u16(P).u16(4 * P).u16(4 * P).u16(0).u16(4 * P)
            .u16(P).u16(3 * P).u16(0);
        for (i = 0; i < 10; i++) os2.u8(0);                  // panose: no classification
        os2.u32(0x00000003).u32(0x00000020).u32(0).u32(0);   // Basic Latin, Latin-1, Arrows
        os2.u8(78).u8(79).u8(78).u8(69);                     // vendor 'NONE'
        os2.u16(0x00C0).u16(lo).u16(Math.min(hi, 0xFFFF)).u16(ASC).u16(-DSC).u16(0).u16(ASC).u16(DSC)
            .u32(1).u32(0).u16(5 * P).u16(7 * P).u16(0).u16(32).u16(1);
        T['OS/2'] = os2;
        // cmap: one (3,1) format 4 table, a segment per run of consecutive code points
        var segs = [];
        codes.forEach(function (cg) {
            var s = segs[segs.length - 1];
            if (s && cg[0] === s.end + 1 && cg[1] === s.gid + (cg[0] - s.start)) s.end = cg[0];
            else segs.push({ start: cg[0], end: cg[0], gid: cg[1] });
        });
        segs.push({ start: 0xFFFF, end: 0xFFFF, gid: 0, last: true });
        var sc = segs.length, lg = Math.floor(Math.log(sc) / Math.LN2), sr = 2 * Math.pow(2, lg);
        var sub = new Buf();
        sub.u16(4).u16(16 + sc * 8).u16(0).u16(sc * 2).u16(sr).u16(lg).u16(sc * 2 - sr);
        segs.forEach(function (s) { sub.u16(s.end); });
        sub.u16(0);
        segs.forEach(function (s) { sub.u16(s.start); });
        segs.forEach(function (s) { sub.u16(s.last ? 1 : (s.gid - s.start) & 0xFFFF); });
        segs.forEach(function () { sub.u16(0); });
        var cmap = new Buf();
        cmap.u16(0).u16(1).u16(3).u16(1).u32(12);
        cmap.b = cmap.b.concat(sub.b);
        T.cmap = cmap;
        var names = [[1, fam], [2, 'Regular'], [3, fam + ' Regular 1.0'], [4, fam + ' Regular'], [5, 'Version 1.0'], [6, fam + '-Regular']];
        var name = new Buf(), store = new Buf();
        name.u16(0).u16(names.length).u16(6 + 12 * names.length);
        names.forEach(function (nm) {
            name.u16(3).u16(1).u16(0x0409).u16(nm[0]).u16(nm[1].length * 2).u16(store.b.length);
            for (var j = 0; j < nm[1].length; j++) store.u16(nm[1].charCodeAt(j));
        });
        name.b = name.b.concat(store.b);
        T.name = name;
        var post = new Buf();
        post.u32(0x00030000).u32(0).u16(-P).u16(P).u32(0).u32(0).u32(0).u32(0).u32(0);
        T.post = post;
        // the sfnt wrapper: a table directory sorted by tag, every table 4-aligned
        var tags = Object.keys(T).sort(), nt = tags.length, el = Math.floor(Math.log(nt) / Math.LN2);
        var out = new Buf();
        out.u32(0x00010000).u16(nt).u16(16 * Math.pow(2, el)).u16(el).u16(nt * 16 - 16 * Math.pow(2, el));
        function sum(b) { var s = 0; for (var q = 0; q < b.length; q += 4) s = (s + ((b[q] << 24) | ((b[q + 1] || 0) << 16) | ((b[q + 2] || 0) << 8) | (b[q + 3] || 0))) >>> 0; return s; }
        var off = 12 + nt * 16, body = [], headAt = 0;
        tags.forEach(function (t) {
            var b = T[t].b;
            out.u8(t.charCodeAt(0)).u8(t.charCodeAt(1)).u8(t.charCodeAt(2)).u8(t.charCodeAt(3));
            out.u32(sum(b)).u32(off).u32(b.length);
            if (t === 'head') headAt = off;
            body = body.concat(b);
            while (body.length % 4) body.push(0);
            off = 12 + nt * 16 + body.length;
        });
        var all = out.b.concat(body), adj = (0xB1B0AFBA - sum(all)) >>> 0;
        all[headAt + 8] = adj >>> 24; all[headAt + 9] = (adj >>> 16) & 255; all[headAt + 10] = (adj >>> 8) & 255; all[headAt + 11] = adj & 255;
        return new Uint8Array(all);
    }
    /* Registered once per page. The returned promise settles when the face is
       usable; text drawn before then falls back for a frame and snaps over. */
    function mfWebFont() {
        if (MF_FACE) return MF_FACE;
        try {
            var face = new FontFace(MF_FAMILY, mfFontBytes().buffer);
            document.fonts.add(face);
            // the enchanting table's runes: the game's "alt" font, the Standard Galactic Alphabet on a to z
            var sga = new FontFace(SGA_FAMILY, mfFontBytes(sgaGlyphs(), SGA_FAMILY).buffer);
            document.fonts.add(sga);
            sga.load().catch(function () {});
            MF_FACE = face.load().then(function () { return face; }, function () { return null; });
        } catch (e) { MF_FACE = Promise.resolve(null); }
        return MF_FACE;
    }
    /* DOM text that looks like mfText. An .mt element keeps its real text (for
       screen readers, selection and anything that reads textContent) but paints
       it transparent; its ::after paints the same string in --c and its
       ::before the shadow in --sc, one GUI pixel down and right. Two separate
       layers, each through #mccrisp on its own: thresholding them together
       left the anti-aliased seam where the text overlaps its own shadow as a
       grey that is neither colour. .ns drops the shadow, for the container
       labels vanilla draws without one. */
    function mtSet(el, text, color) {
        if (!el) return;
        text = String(text == null ? '' : text);
        if (el.getAttribute('data-t') !== text) { el.textContent = text; el.setAttribute('data-t', text); }
        if (color && el._mtc !== color) { el._mtc = color; el.style.setProperty('--c', color); el.style.setProperty('--sc', mfShadow(color)); }
    }
    function mtHTML(text, color, cls, attrs) {
        text = String(text == null ? '' : text);
        return '<span class="mt' + (cls ? ' ' + cls : '') + '" data-t="' + escHtml(text) + '"' +
            (color ? ' style="--c:' + color + ';--sc:' + mfShadow(color) + '"' : '') + (attrs || '') + '>' + escHtml(text) + '</span>';
    }

    /* ── GUI scale and the drawing surface ───────────────────
       Vanilla lays the whole interface out on a small virtual screen and
       blits it at an integer multiple, picking the largest multiple that
       still leaves at least 320x240 virtual pixels. Copy that exactly: it is
       the reason a Minecraft button is the same apparent size on a laptop
       and a 4K monitor, and the reason nothing is ever half a pixel. */
    var GUI_MINW = 320, GUI_MINH = 240, GUI_MAXS = 4;
    function guiScale(w, h, want) {
        var s = 1;
        while (s < GUI_MAXS && (!want || s < want) && w / (s + 1) >= GUI_MINW && h / (s + 1) >= GUI_MINH) s++;
        return s;
    }
    /* The in-game GUI is DOM, laid out in the same GUI pixels as the menus: --gs
       on the root is the scale and the stylesheet sizes everything as a multiple
       of it. RT.gw × RT.gh is the scaled screen vanilla does its HUD arithmetic
       on (W/2 - 91, H - 22 ...); hudLayout() turns that into whole device
       pixels, so nothing ever lands between two of them. */
    function guiResize() {
        if (!RT || !RT.el) return;
        var w = RT.el.clientWidth || 960, h = RT.el.clientHeight || 560;
        var s = guiScale(w, h, optLoad().guiScale), gw = Math.floor(w / s), gh = Math.floor(h / s);
        if (s === RT.gs && gw === RT.gw && gh === RT.gh) return;
        RT.gs = s; RT.gw = gw; RT.gh = gh;
        RT.el.style.setProperty('--gs', String(s));
        hudLayout();
        if (RT.panel) panelLayout();
    }

    /* ── the menu ────────────────────────────────────────────
       One object on RT while any pre-world screen is up. Its presence is the
       signal to the rest of the file: frame() hands over to it, the input
       handlers stand down, and close() knows not to save. */
    var MN_BW = 200, MN_BH = 20;        // vanilla's standard widget, in GUI pixels
    var MN_PANO_SEED = 1642;            // the panorama world. Chosen by looking at a lot of them.

    /* Colours. Vanilla's GUI is a small fixed palette and getting these wrong
       is most of what makes a recreation look like a recreation. */
    var MC_WHITE = '#ffffff', MC_GREY = '#a0a0a0', MC_DGREY = '#707070',
        MC_YELLOW = '#ffff00', MC_GREEN = '#00aa00', MC_RED = '#ff5555',
        MC_LABEL = '#e0e0e0', MC_HL = '#ffffa0';

    function mnActive() { return RT && RT.menu; }

    /* — the panorama —
       Vanilla's title background is six photographs of a world on the inside
       of a cube. This one is the world itself: the same generator, the same
       mesher and the same drawFrame() the game plays through, with the camera
       flown slowly on rails. It costs one small world boot, which is what the
       loading screen in front of it is for. */
    function mnPanoSave() {
        var s = sNew();
        s.seed = MN_PANO_SEED;
        s.wtype = 'Default';   // never inherit the world type of whatever was last played
        s.t = DAY_MS * 0.30;   // mid-morning. Noon is flat and dusk is a different screen's job.
        s.weather = 0;
        s.hp = 20; s.food = 20;
        // snd() reads S, and S is this while the menu is up: without these the
        // button clicks ignore a Sound: OFF set on the last world played
        s.snd = optLoad().snd; s.mus = optLoad().mus;
        /* Scoring the view calls heightAt, which reads the world type and seed
           off S — so S has to already BE this world. Doing it the other way
           round sited the panorama camera using the previous world's terrain,
           and after a Superflat world the title screen was a flat plain. */
        var prev = S;
        S = s;
        try { s.wspawn = mnPanoSpot(); } finally { S = prev; }
        s.px = s.wspawn[0]; s.py = s.wspawn[1]; s.pz = s.wspawn[2];
        s.yaw = 0; s.pitch = MN_PITCH;
        return s;
    }
    /* Terrain is a pure function of (x, z), so the camera can be sited before
       a single chunk exists. Score columns for the things that make a view:
       standing above the water, relief in the middle distance, a shoreline
       somewhere in it, and trees to break the skyline. */
    function mnPanoSpot() {
        var best = null, bestScore = -1e9;
        for (var i = 0; i < 220; i++) {
            var x = ((i * 137) % 60 - 30) * 11, z = (((i * 61) % 60) - 30) * 11;
            var h = heightAt(x, z);
            if (h <= SEA + 2 || caveAt(x, h, z)) continue;
            var relief = 0, water = 0, wood = 0, d;
            for (d = 0; d < 12; d++) {
                var a = d * 0.5236, rx = x + Math.round(Math.cos(a) * 26), rz = z + Math.round(Math.sin(a) * 26);
                var rh = heightAt(rx, rz);
                relief += Math.abs(rh - h);
                if (rh <= SEA) water++;
                if (treeAt(rx, rz)) wood++;
            }
            var score = relief * 0.9 + Math.min(water, 5) * 7 + Math.min(wood, 4) * 5 + Math.min(14, h - SEA) * 1.6;
            if (score > bestScore) { bestScore = score; best = [x + 0.5, h + 5.5, z + 0.5]; }
        }
        return best || [8.5, heightAt(8, 8) + 6, 8.5];
    }
    /* The camera's motion, which is vanilla's exactly. The panorama cube spins
       on Y at 0.1° a tick — 2° a second, three minutes for a full turn — and
       its pitch is a flat 10° down. There was a sine bob on the pitch until
       1.20 (25°±5°, and 20°±25° before 1.13); the field is still updated in
       the modern source and no longer read. Rendered at the cube's own 85°
       field of view rather than the game's 70°, which is why the horizon on a
       title screen sits so much lower than it does in play. */
    var MN_FOV = 1.4835298;                       // 85°, CubeMap.render
    var MN_SPIN = 2 * Math.PI / 180;              // 2°/s
    var MN_PITCH = 10 * Math.PI / 180;            // 10° down, fixed
    function mnPanoCam(m, dt) {
        if (!optLoad().panoStill) m.spin += dt;
        S.yaw = m.spin * MN_SPIN;
        S.pitch = MN_PITCH;
    }

    /* — widgets —
       Every screen returns a flat list of these from its layout(). The painter
       and the DOM hit layer both read the same list, so a button can never be
       drawn in one place and clicked in another. */
    function mnBtn(id, x, y, w, h, label, on, opt) {
        var b = { k: 'btn', id: id, x: x, y: y, w: w, h: h, label: label, on: on, enabled: true };
        if (opt) for (var o in opt) b[o] = opt[o];
        return b;
    }
    function mnRow(m, i) { return m.rowTop + i * 24; }   // vanilla's 24px button pitch
    /* Every list clamps at BOTH ends. Clamping only at zero let one wheel
       gesture push the entries off the bottom of the window with no way back,
       because nothing else ever reduced the offset. */
    function mnScroll(v, total, span) { return Math.max(0, Math.min(v, Math.max(0, total - span))); }

    /* — painting —
       All of these draw in GUI pixels; mnPaint has already scaled the context. */
    function mnRect(cx, x, y, w, h, col) { cx.fillStyle = col; cx.fillRect(x, y, w, h); }
    /* The classic widget bevel: a light top and left, a dark bottom and right,
       over a flat face. Vanilla's is a texture, but the texture is this. */
    function mnBevel(cx, x, y, w, h, face, lite, dark) {
        mnRect(cx, x, y, w, h, face);
        mnRect(cx, x, y, w, 1, lite); mnRect(cx, x, y, 1, h, lite);
        mnRect(cx, x, y + h - 1, w, 1, dark); mnRect(cx, x + w - 1, y, 1, h, dark);
    }
    /* A sprite nine-sliced onto the menu canvas: corners as they are, edges and
       middle tiled from their top-left, as the game's GuiSprites scaling does */
    function mnNine(cx, sp, x, y, w, h, b) {
        var cv = sp.cv, sw = sp.w, sh = sp.h, cw = sw - 2 * b, ch = sh - 2 * b;
        function tile(sx, sy, sW, sH, dx, dy, dW, dH) {
            if (dW <= 0 || dH <= 0) return;
            for (var yy = 0; yy < dH; yy += sH) for (var xx = 0; xx < dW; xx += sW) {
                var ww = Math.min(sW, dW - xx), hh = Math.min(sH, dH - yy);
                cx.drawImage(cv, sx, sy, ww, hh, dx + xx, dy + yy, ww, hh);
            }
        }
        var bx = Math.min(b, w >> 1), by = Math.min(b, h >> 1);
        tile(0, 0, bx, by, x, y, bx, by); tile(sw - bx, 0, bx, by, x + w - bx, y, bx, by);
        tile(0, sh - by, bx, by, x, y + h - by, bx, by); tile(sw - bx, sh - by, bx, by, x + w - bx, y + h - by, bx, by);
        tile(b, 0, cw, by, x + bx, y, w - 2 * bx, by); tile(b, sh - by, cw, by, x + bx, y + h - by, w - 2 * bx, by);
        tile(0, b, bx, ch, x, y + by, bx, h - 2 * by); tile(sw - bx, b, bx, ch, x + w - bx, y + by, bx, h - 2 * by);
        tile(b, b, cw, ch, x + bx, y + by, w - 2 * bx, h - 2 * by);
    }
    /* AbstractWidget.renderScrollingString: centred between the margins when it
       fits; wider, it eases from one end to the other and back inside a clip,
       lingering at each, a full cycle every max(overflow / 2, 3) seconds */
    function mnLabel(cx, text, x0, y0, x1, y1, col) {
        var tw = mfWidth(text) + 1, ty = ((y0 + y1 - 9) >> 1) + 1, room = x1 - x0;
        if (tw <= room) { mfText(cx, text, ((x0 + x1) >> 1) - (tw >> 1), ty, col); return; }
        var over = tw - room, period = Math.max(over * 0.5, 3), sec = performance.now() / 1000;
        var a = Math.sin(Math.PI / 2 * Math.cos(2 * Math.PI * sec / period)) / 2 + 0.5;
        cx.save(); cx.beginPath(); cx.rect(x0, y0, room, y1 - y0); cx.clip();
        mfText(cx, text, x0 - Math.floor(a * over), ty, col);
        cx.restore();
        if (RT && RT.menu) RT.menu.anim = true;   // it moves on its own, so the screen keeps repainting
    }
    /* The widget in its three states, the current game's sprites: widget/button,
       button_highlighted (hovered or focused: the white frame) and
       button_disabled; the label white, or 0xA0A0A0 on a dead button. */
    function mnButton(cx, b, state) {
        mnNine(cx, guiSprites()[state === 2 ? 'btn_d' : state === 1 ? 'btn_h' : 'btn'], b.x, b.y, b.w, b.h, 3);
        var lbl = b.label == null ? '' : b.label;
        if (lbl !== '') mnLabel(cx, lbl, b.x + 2, b.y, b.x + b.w - 2, b.y + b.h, state === 2 ? MC_GREY : MC_WHITE);
    }
    function mnMenuBg(cx, W, H, list) {   // the menu background, or the darker list one
        cx.fillStyle = cx.createPattern(guiSprites()[list ? 'mlbg' : 'mbg'].cv, 'repeat');
        cx.fillRect(0, 0, W, H);
    }
    /* A scrolling list's frame: dirt inside, and the two shadow gradients the
       game bleeds over the top and bottom edges so entries fade out rather
       than getting guillotined. */
    function mnListFrame(cx, x, y, w, h) {   // menu_list_background over the list's rectangle
        cx.save();
        cx.beginPath(); cx.rect(x, y, w, h); cx.clip();
        if (RT.menu && RT.menu.inworld) { cx.fillStyle = 'rgba(0, 0, 0, 0.3)'; cx.fillRect(x, y, w, h); }
        else mnMenuBg(cx, x + w, y + h, true);
        cx.restore();
    }
    function mnListEdges(cx, x, y, w, h) { mnSep(cx, x, y - 2, w, true); mnSep(cx, x, y + h, w, false); }   // the header and footer separators

    /* — the wordmark —
       The real logo is a texture; this one is built at boot from a bold
       nine-row alphabet blown up ×4, then given the three things that make it
       read as carved rock rather than big letters: a hard outline, a downward
       extrusion, and a speckled stone face at one-pixel granularity. Vanilla
       blits its logo 256×44 at y=30, so this is built to land in the same box. */
    var MN_LOGO_A = {
        M: ['##...##', '##...##', '###.###', '###.###', '#######', '##.#.##', '##...##', '##...##', '##...##'],
        I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
        N: ['##...#', '##...#', '###..#', '###..#', '#.##.#', '#.##.#', '#..###', '#..###', '#...##'],
        E: ['#####', '#####', '##...', '####.', '####.', '##...', '##...', '#####', '#####'],
        C: ['.####', '#####', '##...', '##...', '##...', '##...', '##...', '#####', '.####'],
        R: ['####.', '#####', '##..#', '##..#', '#####', '####.', '##.#.', '##..#', '##..#'],
        A: ['..##..', '.####.', '.####.', '##..##', '##..##', '######', '######', '##..##', '##..##'],
        F: ['#####', '#####', '##...', '####.', '####.', '##...', '##...', '##...', '##...'],
        T: ['#####', '#####', '.###.', '.###.', '.###.', '.###.', '.###.', '.###.', '.###.']
    };
    var MN_LOGO_W = 256, MN_LOGO_H = 44, MN_LOGO = null;
    function mnLogo() {
        if (MN_LOGO) return MN_LOGO;
        var word = 'MINECRAFT', S4 = 4, gap = 4, i, x, y;
        var cells = [], total = 0;
        for (i = 0; i < word.length; i++) {
            var rows = MN_LOGO_A[word.charAt(i)];
            cells.push(rows);
            total += rows[0].length * S4 + (i ? gap : 0);
        }
        var ext = 4, out = 1;                       // extrusion depth, outline thickness
        var cv = document.createElement('canvas');
        cv.width = MN_LOGO_W; cv.height = MN_LOGO_H;
        var cx = cv.getContext('2d');
        var ox = Math.round((MN_LOGO_W - total) / 2), oy = 2;
        // one mask of the whole word, so the outline never runs between letters
        var mw = MN_LOGO_W, mh = MN_LOGO_H, mask = new Uint8Array(mw * mh);
        var px = ox;
        for (i = 0; i < cells.length; i++) {
            var g = cells[i];
            for (y = 0; y < g.length; y++) for (x = 0; x < g[y].length; x++) {
                if (g[y].charAt(x) !== '#') continue;
                for (var sy = 0; sy < S4; sy++) for (var sx = 0; sx < S4; sx++) {
                    var mx = px + x * S4 + sx, my = oy + y * S4 + sy;
                    if (mx >= 0 && mx < mw && my >= 0 && my < mh) mask[my * mw + mx] = 1;
                }
            }
            px += g[0].length * S4 + gap;
        }
        function at(x2, y2) { return x2 >= 0 && x2 < mw && y2 >= 0 && y2 < mh && mask[y2 * mw + x2]; }
        var img = cx.createImageData(mw, mh), d = img.data, rnd = mulb(0x5EED1);
        function put(x2, y2, r, g2, b) {
            if (x2 < 0 || x2 >= mw || y2 < 0 || y2 >= mh) return;
            var o = (y2 * mw + x2) * 4;
            d[o] = r; d[o + 1] = g2; d[o + 2] = b; d[o + 3] = 255;
        }
        // 1. the extrusion, darkening as it goes down
        for (var e = ext; e >= 1; e--) {
            var f = 0.30 + 0.10 * (ext - e) / ext;
            for (y = 0; y < mh; y++) for (x = 0; x < mw; x++)
                if (at(x, y - e) && !at(x, y)) put(x, y, (150 * f) | 0, (150 * f) | 0, (150 * f) | 0);
        }
        // 2. the outline, one pixel all the way round including under the extrusion
        for (y = 0; y < mh; y++) for (x = 0; x < mw; x++) {
            if (at(x, y)) continue;
            var near = at(x - out, y) || at(x + out, y) || at(x, y - out) || at(x, y + out);
            if (near) put(x, y, 24, 24, 24);
        }
        // 3. the face: grey stone with speckle, one pixel at a time
        for (y = 0; y < mh; y++) for (x = 0; x < mw; x++) {
            if (!at(x, y)) continue;
            var v = 148 + ((rnd() * 34) | 0) - 14;
            if (!at(x, y - 1)) v += 42;                       // top edge catches the light
            else if (!at(x, y + 1)) v -= 46;                  // bottom edge falls away
            if (!at(x - 1, y)) v += 14;
            v = Math.max(28, Math.min(236, v | 0));
            put(x, y, v, v, v);
        }
        cx.putImageData(img, 0, 0);
        MN_LOGO = cv;
        return cv;
    }
    /* The edition strip sits under the wordmark, overlapping it by 7px, in a
       128×14 box — vanilla's edition.png geometry. */
    function mnEdition(cx, cxp, y) {
        var t = 'JAVA EDITION';
        mfCenter(cx, t, cxp, y + 3, '#d8d8d8');
    }

    /* — the splash —
       Short, and mostly ours. Reproducing the game's splashes.txt wholesale
       would be copying somebody's writing; a handful of the famous ones plus a
       pile about the machine this is running on is both more honest and
       funnier on a site that has a simulated Windows on it. */
    var MN_SPLASH = [
        'Also try NINTH NIGHT!', 'Now with 100% more terrain!', 'As seen on a website!',
        'Voxels all the way down!', 'Runs on a computer inside a computer!',
        'Seed 4-1-1-4!', 'Do not lose that seed again!', 'world (1) is the good one!',
        'SMP with malachi!', 'Ask malachi about the roof!', 'creative flat test!',
        'Written in a text editor!', 'No blocks were harmed!',
        'Chunk borders agree about their trees!', 'The lighting is a BFS!',
        'Ambient occlusion, baked!', 'Greedy about quads!', 'Sixteen by ninety-six!',
        'It has a real command parser!', 'Try /gamemode creative!', 'Try /seed!',
        'Double-tap space!', 'F3 shows the truth!', 'Q drops it!',
        'Sneak on the edge!', 'Mind the cactus!', 'The creepers are patient!',
        'Endermen do not like eye contact!', 'Squid are load-bearing!',
        'Zombies burn at dawn!', 'Sleep through it!', 'Beds are checkpoints!',
        'Bring a bucket!', 'Bring two buckets!', 'Torch the cave first!',
        'Diamonds are down there somewhere!', 'Never dig straight down!',
        'Straight down is a choice!', 'Lava is a learning experience!',
        'Gravel lies!', 'Sand also lies!', 'Water beats lava!',
        'Obsidian, eventually!', 'Enchant the pickaxe!', 'Anvils remember!',
        'That is a lot of cobblestone!', 'Build something square!', 'Build something not square!',
        'Wool is flammable, probably!', 'Cake is not a lie!', 'Bread solves most of it!',
        'Golden apples for the brave!', 'Eat before you mine!',
        'The sun also rises!', 'Rain stops eventually!', 'Thunder means business!',
        'Clouds at y=88!', 'The stars are seeded!', 'The moon is a quad!',
        'Fog hides the edge of the world!', 'There is an edge of the world!',
        'Ninety-six blocks is plenty!', 'Every block is a choice!',
        'Made of arrays!', 'Powered by requestAnimationFrame!', 'WebGL, one context!',
        'No frameworks were installed!', 'It is all one file!', 'It is a big file!',
        'Ship it on a Tuesday!', 'Merge to main!', 'Squash and merge!',
        'The commit message is honest!', 'git blame says you!',
        'Isaac made this!', 'A fan of the original!', 'Not affiliated with anyone!',
        'Mojang did it first!', 'Notch started it!', 'Better than the real thing? No!',
        'Close enough!', 'Good enough to ship!', 'Ninety percent there!',
        'The last ten percent!', 'Now in your browser!', 'No install required!',
        'Alt-tab friendly!', 'Runs in a window!', 'Runs in a window in a window!',
        'The desktop is also fake!', 'The file system is also fake!',
        'The launcher is also fake!', 'This splash is real though!',
        'Press Singleplayer!', 'You have to click something!'
    ];
    /* The game hides one line from splashes.txt forever by filtering on its
       Java string hash, as a joke about a splash that says it will never
       appear. Same joke, same mechanism, our own line. */
    function mnHash(s) {   // java.lang.String.hashCode
        var h = 0;
        for (var i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
        return h;
    }
    var MN_NEVER = 'This splash cannot be shown, which is the joke.';
    function mnPickSplash() {
        var d = new Date(), mo = d.getMonth() + 1, day = d.getDate();
        // the game's three date splashes, on the game's three dates
        if (mo === 12 && day === 24) return 'Merry X-mas!';
        if (mo === 1 && day === 1) return 'Happy new year!';
        if (mo === 10 && day === 31) return 'OOoooOOOoooo! Spooky!';
        var pool = [], never = mnHash(MN_NEVER);
        for (var i = 0; i < MN_SPLASH.length; i++) if (mnHash(MN_SPLASH[i]) !== never) pool.push(MN_SPLASH[i]);
        return pool[(Math.random() * pool.length) | 0];
    }
    /* Vanilla, verbatim: anchor at (width/2 + 123, 69), rotate -20°, scale by
       (1.8 - |sin(ms/1000 · 2π)| · 0.1) · 100/(width + 32) — with no clamp,
       which is exactly why a two-word splash comes out enormous — then draw
       centred at (0, -8) so the anchor sits on the text's baseline box. */
    function mnSplash(cx, m, w) {
        if (!m.splash) return;
        var t = mfWidth(m.splash);
        var pulse = 1.8 - Math.abs(Math.sin((Date.now() % 1000) / 1000 * Math.PI * 2) * 0.1);
        var f = pulse * 100 / (t + 32);
        cx.save();
        cx.translate(w / 2 + 123, 69);
        cx.rotate(-Math.PI / 9);
        cx.scale(f, f);
        mfText(cx, m.splash, -Math.floor(t / 2), -8, MC_YELLOW);
        cx.restore();
    }

    /* ── global options ──────────────────────────────────────
       Settings that belong to the installation rather than to a world, which
       is what the Options screen edits when it is reached from the title
       screen and there is no world to edit. Applied onto S when a world
       opens. Mirrored into the launcher's options.txt by comp.js. */
    /* Every key an option screen writes has to be listed here: optLoad rebuilds
       OPT from this table, so a setting saved under a key it does not know is
       written to storage and then thrown away on the next load. */
    var OPT_DEF = {
        guiScale: 0, fov: 70, rd: 8, lang: 'en_us', splash: true, diff: 2,
        snd: true, mus: true,                       // Music & Sounds
        fancy: true, vsync: true, bob: true, clouds: true,   // Video Settings
        autoJump: false, sens: 100, invert: false,  // Controls and Mouse Settings
        panoStill: false, tilt: 1,           // Accessibility
        chat: 0, sug: true,                         // Chat Settings
        mpwarn: true                                // the third-party-play warning is shown until it is dismissed
    };
    var OPT = null;
    function optLoad() {
        if (OPT) return OPT;
        OPT = {};
        var raw = null;
        try { raw = JSON.parse(localStorage.getItem('comp_mc_opts') || 'null'); } catch (e) {}
        for (var k in OPT_DEF) OPT[k] = raw && raw[k] !== undefined ? raw[k] : OPT_DEF[k];
        return OPT;
    }
    function optSave() { try { localStorage.setItem('comp_mc_opts', JSON.stringify(optLoad())); } catch (e) {} }

    /* ── the menu runtime ────────────────────────────────────
       One screen is current at a time. A screen is a layout() returning
       widgets in GUI pixels and a paint() for everything that is not a
       widget; the runtime owns hit-testing, focus, the DOM shadow layer and
       the frame. Screens never touch the canvas transform or the DOM. */
    var MN_SCR = {};   // filled in below, one entry per screen

    function mnOpen(scr, fade, inworld) {
        var m = {
            scr: scr || 'title', prev: [], t: 0, spin: 0, fadeT: 0, fading: false, wantFade: fade !== false,
            splash: optLoad().splash ? mnPickSplash() : null,
            hover: -1, focus: -1, widgets: [], sig: '', dirty: true,
            scale: 2, W: 320, H: 240, d: {}, msg: null
        };
        m.cv = RT.el.querySelector('.mc-mcv');
        m.cx = m.cv.getContext('2d');
        m.ui = RT.el.querySelector('.mc-mui');
        m.inworld = !!inworld;   // the Game Menu's Options...: the paused world, blurred, behind it
        RT.menu = m;
        RT.el.classList.add(m.inworld ? 'mc-menuworld' : 'mc-menuon');
        if (m.inworld) RT.el.classList.add('mc-blur');
        m.cv.style.display = ''; m.ui.style.display = '';
        mnWire(m);
        mnSize(m);
        return m;
    }
    function mnCloseUI() {
        if (!RT) return;
        var m = RT.menu;
        RT.menu = null;
        RT.el.classList.remove('mc-menuon');
        RT.el.classList.remove('mc-menuworld');
        RT.el.classList.remove('mc-mblur');
        if (m) {
            m.cv.style.display = 'none';
            m.ui.style.display = 'none';
            m.ui.innerHTML = '';
        }
        /* Keys land on the game root, not on a button that no longer exists.
           Without this, Escape did nothing after starting a world from the
           menu, because focus was still on the removed shadow layer. */
        RT.el.focus();
    }
    /* Arriving at a screen resets its own scratch state. Vanilla builds a new
       Screen object every time, so a second visit to Select World has an empty
       search box and nothing selected; without this both persist and the
       server list never re-pings. */
    function mnEnter(m) {
        var scr = MN_SCR[m.scr];
        if (scr && scr.enter) scr.enter(m);
    }
    function mnGo(m, scr, keep) {
        if (!keep) m.prev.push(m.scr);
        m.scr = scr;
        m.hover = -1; m.focus = -1; m.msg = null;
        m.sig = '';                       // force a full rebuild: the widgets are different things now
        m.dirty = true;
        mnEnter(m);
    }
    /* Going back does NOT re-enter: vanilla keeps the parent Screen object
       alive underneath, so cancelling a delete confirm lands on the same
       Select World with the same world still highlighted. Only a descent
       through mnGo builds a fresh screen. */
    function mnBack(m) {
        var to = m.prev.pop();
        if (!to && m.inworld) { mnCloseUI(); if (RT.paused) iwShow('pause'); return; }   // out of Options, back to the Game Menu
        to = to || 'title';
        m.scr = to; m.hover = -1; m.focus = -1; m.msg = null; m.sig = ''; m.dirty = true;
    }
    function mnSize(m) {
        var el = RT.el, cw = Math.max(160, el.clientWidth || 960), ch = Math.max(120, el.clientHeight || 560);
        if (m.cv.width !== cw || m.cv.height !== ch) { m.cv.width = cw; m.cv.height = ch; }
        m.scale = guiScale(cw, ch, optLoad().guiScale);
        m.W = Math.floor(cw / m.scale);
        m.H = Math.floor(ch / m.scale);
        m.dirty = true;
        guiResize();
    }

    /* — the DOM shadow layer —
       Real <button>s and <input>s, invisible, sitting exactly over what the
       canvas drew. They carry the things a canvas cannot: tab order, Enter to
       press, a caret, an accessible name. Reconciled rather than rebuilt so
       that focus and a half-typed seed survive a resize. */
    function mnSync(m) {
        var w = m.widgets, sig = '', i;
        for (i = 0; i < w.length; i++) sig += w[i].k + w[i].id + '|';
        if (sig !== m.sig) {
            /* Typing in the search box changes which rows exist, which changes
               the signature, which rebuilds this layer — and the box the player
               is typing into is one of the nodes destroyed. Remember who had
               focus by widget id (not index: the indices are what moved) and
               where the caret was, then put it back. */
            var act = document.activeElement, keepId = null, selA = 0, selB = 0;
            if (act && act.parentNode === m.ui) {
                keepId = act.getAttribute('data-id');
                if (act.tagName === 'INPUT') { selA = act.selectionStart; selB = act.selectionEnd; }
            }
            m.sig = sig;
            m.ui.innerHTML = '';
            for (i = 0; i < w.length; i++) {
                var b = w[i], el;
                if (b.k === 'input') {
                    el = document.createElement('input');
                    el.type = 'text'; el.spellcheck = false; el.autocomplete = 'off';
                    el.maxLength = b.max || 64;
                    el.value = b.value || '';
                    el.addEventListener('input', (function (bb) {
                        return function (ev) { bb.set(m, ev.target.value); m.dirty = true; };
                    })(b));
                } else {
                    el = document.createElement('button');
                    el.type = 'button';
                }
                el.className = 'mc-mw';
                el.setAttribute('data-i', String(i));
                el.setAttribute('data-id', b.id);
                el.setAttribute('aria-label', b.aria || b.label || b.id);
                if (b.k !== 'input') el.textContent = b.aria || b.label || '';
                m.ui.appendChild(el);
            }
            if (keepId) {
                var back = m.ui.querySelector('[data-id="' + keepId + '"]');
                if (back && !back.disabled) {
                    back.focus();
                    if (back.tagName === 'INPUT' && back.setSelectionRange) {
                        try { back.setSelectionRange(selA, selB); } catch (e) {}
                    }
                }
            }
        }
        var kids = m.ui.children;
        for (i = 0; i < w.length && i < kids.length; i++) {
            var b2 = w[i], k = kids[i], s = m.scale;
            k.style.left = (b2.x * s) + 'px';
            k.style.top = (b2.y * s) + 'px';
            k.style.width = (b2.w * s) + 'px';
            k.style.height = (b2.h * s) + 'px';
            k.disabled = !b2.enabled;
            k.tabIndex = m.inert ? -1 : 0;
            /* A cycle button IS its value — "Game Mode: Survival" becomes
               "Game Mode: Hardcore" without the widget list changing shape. If
               the name is only written on a rebuild, a screen reader keeps
               reading the setting the player just changed away from. */
            var nm = b2.aria || b2.label || b2.id;
            if (k.getAttribute('aria-label') !== nm) {
                k.setAttribute('aria-label', nm);
                if (b2.k !== 'input') k.textContent = nm;
            }
            if (b2.k === 'input' && document.activeElement !== k && k.value !== b2.value) k.value = b2.value || '';
        }
    }
    function mnWire(m) {
        var ui = m.ui;
        if (ui._mnWired) return;
        ui._mnWired = true;
        function idx(ev) {
            var t = ev.target;
            while (t && t !== ui && !t.hasAttribute('data-i')) t = t.parentNode;
            return t && t !== ui ? +t.getAttribute('data-i') : -1;
        }
        /* Vanilla plays the click on press, not release, and never for a
           greyed-out widget. Keyboard activation arrives as a click with
           detail 0 and has had no mousedown to make the noise. */
        ui.addEventListener('mousedown', function (ev) {
            var mm = RT && RT.menu; if (!mm || ev.button !== 0) return;
            var b = mm.widgets[idx(ev)];
            if (b && b.enabled && b.k !== 'input') { audioInit(); snd('click'); }
        });
        ui.addEventListener('click', function (ev) {
            var mm = RT && RT.menu; if (!mm) return;
            var i = idx(ev), b = mm.widgets[i];
            if (!b || !b.enabled) return;
            if (!ev.detail) { audioInit(); snd('click'); }
            if (b.on) b.on(mm, b);
            mm.dirty = true;
        });
        ui.addEventListener('mousemove', function (ev) {
            var mm = RT && RT.menu; if (!mm) return;
            var r = ui.getBoundingClientRect();
            var gx = (ev.clientX - r.left) / mm.scale, gy = (ev.clientY - r.top) / mm.scale;
            var h = -1;
            for (var i = 0; i < mm.widgets.length; i++) {
                var b = mm.widgets[i];
                if (b.enabled !== false && gx >= b.x && gx < b.x + b.w && gy >= b.y && gy < b.y + b.h) { h = i; break; }
            }
            if (h !== mm.hover) { mm.hover = h; mm.dirty = true; }
            mm.mx = gx; mm.my = gy;
        });
        ui.addEventListener('mouseleave', function () {
            var mm = RT && RT.menu; if (mm && mm.hover !== -1) { mm.hover = -1; mm.dirty = true; }
        });
        ui.addEventListener('focusin', function (ev) {
            var mm = RT && RT.menu; if (!mm) return;
            if (ev.target && ev.target.tagName === 'INPUT') ev.target._ft = performance.now();   // the cursor's blink starts at focus
            mm.focus = idx(ev); mm.dirty = true;
        });
        ui.addEventListener('focusout', function () {
            var mm = RT && RT.menu; if (!mm) return;
            mm.focus = -1; mm.dirty = true;
        });
        ui.addEventListener('wheel', function (ev) {
            var mm = RT && RT.menu; if (!mm) return;
            var scr = MN_SCR[mm.scr];
            if (scr && scr.wheel) { scr.wheel(mm, ev.deltaY); mm.dirty = true; ev.preventDefault(); }
        }, { passive: false });
        /* Keys must not reach the world's handler on root: it sets RT.keys and
           reads q/F3/space without ever asking whether a world exists. */
        ui.addEventListener('keydown', function (ev) {
            var mm = RT && RT.menu; if (!mm) return;
            var scr = MN_SCR[mm.scr];
            var onBtn = ev.target && ev.target.tagName === 'BUTTON';
            /* A focused button owns Enter and Space — they activate it. The
               screen-level Enter shortcut (which plays the selected world) is
               for when focus is on the list or the search box; letting it run
               here, and then preventDefault()ing, meant Enter on Cancel
               launched the selection instead of cancelling. */
            if (onBtn && (ev.key === 'Enter' || ev.key === ' ')) { ev.stopPropagation(); return; }
            /* Arrow keys nudge a focused slider, which is the only way to work
               one without a mouse — its click handler reads the pointer. */
            if (onBtn === false || onBtn) {
                var wi = +ev.target.getAttribute('data-i'), wb = mm.widgets[wi];
                if (wb && wb.k === 'draw' && wb.slide && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
                    wb.slide(mm, ev.key === 'ArrowRight' ? 0.05 : -0.05);
                    ev.preventDefault(); ev.stopPropagation(); mm.dirty = true;
                    return;
                }
            }
            if (scr && scr.key && scr.key(mm, ev)) { ev.preventDefault(); ev.stopPropagation(); mm.dirty = true; return; }
            if (ev.key === 'Escape') {
                if (mm.scr !== 'title') { mnBack(mm); ev.preventDefault(); }
                ev.stopPropagation();
                return;
            }
            ev.stopPropagation();
        });
        ui.addEventListener('keyup', function (ev) { ev.stopPropagation(); });
    }

    /* — the frame —
       Draw the world behind (the panorama is a real render), then the GUI on
       top at integer scale. */
    /* Vanilla's fade is two stages over two seconds: the panorama comes up out
       of black across the first second, then the logo, the widgets and the
       text across the second — and while their alpha is zero they are not
       drawn OR hit-tested. It only runs on first launch; coming back from a
       world builds a title screen that is already there. */
    function mnPanoAlpha(m) { return m.fading ? Math.max(0, Math.min(1, m.fadeT)) : 1; }
    function mnGuiAlpha(m) { return m.fading ? Math.max(0, Math.min(1, m.fadeT - 1)) : 1; }
    function mnFrame(m, dt) {
        m.t += dt;
        if (m.fading) {
            m.fadeT += dt;
            if (m.fadeT > 2) m.fading = false;
            m.dirty = true;
        }
        var scr = MN_SCR[m.scr] || MN_SCR.title;
        /* Anything that moves on its own moves on dt, not on a frame count.
           Counting paints made the connect sequence take as long as the frame
           rate said it should, which on a slow machine is a hang.

           Re-resolve afterwards: a tick is exactly the thing that changes
           screen on its own (the connect sequence ending in a refusal), and
           painting the screen we looked up before it ran left the new screen
           current with the old screen's widgets drawn over it. */
        if (scr.tick) {
            scr.tick(m, dt);
            scr = MN_SCR[m.scr] || MN_SCR.title;
        }
        /* the panorama turns behind every screen now; only the title screen shows it
           sharp, every other one blurs it under the menu background */
        if (!m.inworld && scr.bg !== 'flat') { RT.fov = MN_FOV; mnPanoCam(m, dt); drawFrame(); }
        var blur = !m.inworld && scr.bg === 'dirt';
        if (RT.el.classList.contains('mc-mblur') !== blur) {
            RT.el.classList.toggle('mc-mblur', blur);
            RT.el.style.setProperty('--mblur', (5.5 / (window.devicePixelRatio || 1)).toFixed(2) + 'px');
        }
        /* While the widgets are still invisible they are not interactive at
           all. pointer-events alone is not enough: a button with no pointer
           events is still in the tab order, so Tab-then-Enter could start a
           world off a screen that had not been drawn yet. */
        var a = scr.bg === 'pano' ? mnGuiAlpha(m) : 1;
        m.inert = a < 0.02;
        m.ui.style.pointerEvents = m.inert ? 'none' : '';
        // repaint when something changed, or when the screen animates on its own
        if (m.dirty || scr.live || m.anim) mnPaint(m, scr);
    }
    function mnPaint(m, scr) {
        var cx = m.cx, s = m.scale;
        cx.setTransform(1, 0, 0, 1, 0, 0);
        cx.clearRect(0, 0, m.cv.width, m.cv.height);
        cx.imageSmoothingEnabled = false;
        cx.setTransform(s, 0, 0, s, 0, 0);
        m.anim = false;
        var W = m.W, H = m.H;
        if (m.inworld) { cx.fillStyle = cx.createPattern(guiSprites().iwbg.cv, 'repeat'); cx.fillRect(0, 0, W, H); }   // over the blurred world
        else if (scr.bg === 'dirt') mnMenuBg(cx, W, H);
        else if (scr.bg === 'scrim') { cx.fillStyle = 'rgba(0, 0, 0, 0.62)'; cx.fillRect(0, 0, W, H); }
        var ga = 1;
        if (scr.bg === 'pano') {
            var pa = mnPanoAlpha(m);
            if (pa < 1) { cx.fillStyle = 'rgba(0, 0, 0, ' + (1 - pa).toFixed(3) + ')'; cx.fillRect(0, 0, W, H); }
            ga = mnGuiAlpha(m);
        }
        m.widgets = scr.layout(m, W, H) || [];
        /* Below the panorama's own fade, nothing is drawn at all for the first
           second — logo included, since the game's LogoRenderer fades with the
           widgets on the title screen. */
        if (ga < 0.02) { m.dirty = false; mnSync(m); cx.setTransform(1, 0, 0, 1, 0, 0); return; }
        cx.globalAlpha = ga;
        if (scr.paint) scr.paint(cx, m, W, H);
        for (var i = 0; i < m.widgets.length; i++) {
            var b = m.widgets[i];
            if (b.k === 'btn' || b.k === 'icon') {
                var st = b.enabled === false ? 2 : (i === m.hover || i === m.focus) ? 1 : 0;
                b.st = st;
                mnButton(cx, b, st);   // focus is the highlighted sprite's white frame, as in the game
                if (b.k === 'icon') {   // SpriteIconButton: the 15x15 picture at (3, 3)
                    if (b.icon) cx.drawImage(guiSprites()[b.icon].cv, b.x + 3, b.y + 3);
                    else if (b.draw) b.draw(cx, b, st);
                }
            } else if (b.k === 'input') mnInput(cx, m, b, i);
            else if (b.k === 'draw' && b.draw) {
                /* A row scrolled half out of its list must be cut off at the
                   list's edge. These are drawn after the screen's own paint, so
                   without a clip a partly-scrolled entry lands on top of the
                   title, the search box and the edge shadows. */
                if (b.clip) {
                    cx.save();
                    cx.beginPath(); cx.rect(b.clip[0], b.clip[1], b.clip[2], b.clip[3]); cx.clip();
                    b.draw(cx, b, i === m.hover, i === m.focus);
                    cx.restore();
                } else b.draw(cx, b, i === m.hover, i === m.focus);
            }
        }
        if (m.msg) {   // a transient line under the buttons: "Deleting…", an error
            mfCenter(cx, m.msg, W / 2, H - 42, MC_RED);
        }
        cx.globalAlpha = 1;
        m.dirty = false;
        mnSync(m);
    }
    /* EditBox, the current game's: the text_field sprite inside the widget's
       bounds (#A0A0A0 round black, white while focused), the text at (4, 6) in
       0xE0E0E0, scrolled to keep the cursor in view; the cursor blinks 300 ms
       from focus, an underscore where the text ends and a bar in the text's own
       colour inside it; a selection is the game's OR_REVERSE highlight; an empty
       box shows its hint in dark grey, a search box's in grey italics. */
    function mnInput(cx, m, b, i) {
        var el = m.ui.children[i], focus = el && document.activeElement === el;
        mnNine(cx, guiSprites()[focus ? 'field_h' : 'field'], b.x, b.y, b.w, b.h, 1);
        var v = b.value || '', tx = b.x + 4, ty = b.y + ((b.h - 8) >> 1), col = b.enabled === false ? '#707070' : '#e0e0e0';
        var room = b.w - 8, s0 = el && el.selectionStart != null ? el.selectionStart : v.length, s1 = el && el.selectionEnd != null ? el.selectionEnd : s0;
        var caret = el && el.selectionDirection === 'backward' ? s0 : s1, skip = 0;
        while (skip < caret && mfWidth(v.slice(skip, caret)) > room - 6) skip++;
        var show = v.slice(skip), end = show.length;
        while (end > 0 && mfWidth(show.slice(0, end)) > room) end--;
        show = show.slice(0, end);
        cx.save(); cx.beginPath(); cx.rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2); cx.clip();
        if (!v && b.hint && !focus) {
            if (b.search) { cx.save(); cx.transform(1, 0, -0.25, 1, 1 + 0.25 * ty, 0); mfText(cx, b.hint, tx, ty, '#aaaaaa'); cx.restore(); }
            else mfText(cx, b.hint, tx, ty, '#555555');
        } else mfText(cx, show, tx, ty, col);
        function xAt(k) { return k > skip ? mfWidth(v.slice(skip, k)) + 1 : 0; }
        if (focus && (((performance.now() - (el._ft || 0)) / 300) | 0) % 2 === 0) {
            var cxp = xAt(caret);
            if (caret < v.length) mnRect(cx, tx + cxp, ty - 1, 1, 11, col);
            else mfText(cx, '_', tx + (caret > skip ? cxp + 1 : 0), ty, col);
        }
        if (focus && s1 > s0) {
            var xa = xAt(Math.max(skip, s0)), xb = xAt(Math.max(skip, s1)) - 1;
            if (xb > xa) {
                cx.globalCompositeOperation = 'difference'; mnRect(cx, tx + xa, ty - 1, xb - xa, 11, '#ffff00');
                cx.globalCompositeOperation = 'lighten'; mnRect(cx, tx + xa, ty - 1, xb - xa, 11, '#0000ff');
                cx.globalCompositeOperation = 'source-over';
            }
        }
        cx.restore();
        if (focus && m) m.anim = true;   // the cursor blinks on its own
        if (b.title) mfText(cx, b.title, b.x, b.y - 12, MC_GREY);
    }

    /* ── the world store ─────────────────────────────────────
       The game shipped with exactly one save under one key. A Select World
       screen needs many, so: an index at comp_mc_worlds, one blob per world
       at comp_mc_w_<id>, and comp_mc kept as the ACTIVE world so that every
       existing sLoad/sSave/MC.hours() in this file still reads and writes
       precisely where it always did. A world in the index with no blob has
       simply never been opened; entering it generates it from its seed.

       The four worlds it starts with are the ones the desktop's file system
       has claimed were in .minecraft/saves since long before the game could
       open them. They are real now. */
    var WS_IDX = 'comp_mc_worlds', WS_PRE = 'comp_mc_w_';
    var WS_SEED_LORE = [
        { id: 'w1', name: 'world', seed: 4114, gm: 0, diff: 2, cheats: false, played: '2019-06-14T20:41:00', ver: '1.14.3' },
        { id: 'w2', name: 'world (1)', seed: 88301, gm: 0, diff: 1, cheats: false, played: '2019-07-02T23:58:00', ver: '1.14.4' },
        { id: 'w3', name: 'SMP with malachi', seed: 20160411, gm: 0, diff: 2, cheats: true, played: '2020-03-19T01:12:00', ver: '1.15.2' },
        { id: 'w4', name: 'creative flat test', seed: 7, gm: 1, diff: 0, cheats: true, played: '2021-11-08T18:22:00', ver: '1.17.1', type: 'Superflat' }
    ];
    /* An empty index is an answer, not a missing one. Treating [] as "never
       seeded" meant deleting your last world resurrected all four lore worlds
       and re-ran the legacy comp_mc adoption on top of them. */
    function wsRead() {
        try { var v = JSON.parse(localStorage.getItem(WS_IDX) || 'null'); if (Array.isArray(v)) return v; } catch (e) {}
        return null;
    }
    function wsWrite(list) {
        try { localStorage.setItem(WS_IDX, JSON.stringify(list)); return true; } catch (e) { return false; }
    }
    function wsIndex() {
        var list = wsRead();
        if (list) return list;
        list = WS_SEED_LORE.map(function (w) {
            return { id: w.id, name: w.name, folder: w.name, seed: w.seed, gm: w.gm, diff: w.diff,
                cheats: w.cheats, type: w.type || 'Default',
                created: Date.parse(w.played) - 864e5 * 30, played: Date.parse(w.played),
                hrs: 0, ver: w.ver };
        });
        /* Anyone who played before there was a world list has a save under the
           old key. It is 'world' — the first folder the machine ever had — and
           adopting it is the only way that save survives this change. */
        var old = null;
        try { old = JSON.parse(localStorage.getItem('comp_mc') || 'null'); } catch (e) {}
        if (old && old.seed != null) {
            list[0].seed = old.seed;
            list[0].gm = old.gm || 0;
            list[0].diff = old.diff == null ? 2 : old.diff;
            list[0].hrs = old.hrs || 0;
            list[0].cheats = true;   // it predates the switch and had every command; do not take them away
            list[0].played = Date.now();
            list[0].ver = RT && RT.ver ? RT.ver : '26.2';
            old.wid = list[0].id;
            try { localStorage.setItem(WS_PRE + list[0].id, JSON.stringify(old)); } catch (e) {}
        }
        wsWrite(list);
        return list;
    }
    function wsGet(id) { var l = wsIndex(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
    function wsBlob(id) {
        try { var s = JSON.parse(localStorage.getItem(WS_PRE + id) || 'null'); return s && s.seed != null ? s : null; } catch (e) {}
        return null;
    }
    function wsTouch(id, patch) {
        var l = wsIndex();
        for (var i = 0; i < l.length; i++) if (l[i].id === id) { for (var k in patch) l[i][k] = patch[k]; }
        wsWrite(l);
        wsSyncFS();
    }
    function wsNewId() {
        var l = wsIndex(), n = 1, used = {};
        for (var i = 0; i < l.length; i++) used[l[i].id] = 1;
        while (used['w' + n]) n++;
        return 'w' + n;
    }
    /* Folder names are unique the way the game's are: "New World", then
       "New World (1)", and so on. */
    function wsFolder(name) {
        var l = wsIndex(), base = String(name).replace(/[\\/:*?"<>|.]/g, '_').trim() || 'New World';
        var taken = {}, i;
        for (i = 0; i < l.length; i++) taken[l[i].folder] = 1;
        if (!taken[base]) return base;
        for (i = 1; i < 999; i++) if (!taken[base + ' (' + i + ')']) return base + ' (' + i + ')';
        return base + ' (999)';
    }
    function wsCreate(o) {
        var l = wsIndex();
        var w = { id: wsNewId(), name: o.name, folder: wsFolder(o.name), seed: o.seed, gm: o.gm, diff: o.diff,
            cheats: !!o.cheats, hardcore: !!o.hardcore, structures: o.structures !== false, bonus: !!o.bonus,
            type: o.type || 'Default', created: Date.now(), played: Date.now(), hrs: 0,
            ver: RT && RT.ver ? RT.ver : '26.2' };
        l.unshift(w);
        if (!wsWrite(l)) return null;   // storage full or blocked: say so rather than opening a world that was never saved
        wsSyncFS();
        return w;
    }
    function wsDelete(id) {
        var l = wsIndex(), out = [];
        for (var i = 0; i < l.length; i++) if (l[i].id !== id) out.push(l[i]);
        wsWrite(out);
        try { localStorage.removeItem(WS_PRE + id); } catch (e) {}
        wsSyncFS();
    }
    /* Explorer has been showing these folders since before they meant
       anything. Now that the game owns them, keep the two in step. */
    function wsSyncFS() {
        var h = window.MCHOST;
        if (h && h.saves) { try { h.saves(wsIndex()); } catch (e) {} }
    }
    /* The default locale's short date and time, which is what the game's
       bare `new SimpleDateFormat()` resolves to: 8/13/26, 3:04 PM. */
    function wsDate(ts) {
        var d = new Date(ts || Date.now());
        var h = d.getHours(), ap = h >= 12 ? 'PM' : 'AM';
        h = h % 12; if (!h) h = 12;
        return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(2) +
            ', ' + h + ':' + ('0' + d.getMinutes()).slice(-2) + ' ' + ap;
    }
    /* Named apart from the command console's GM_NAME/DIFF_NAME further down the
       file: those are in this same function scope, so a matching name here is
       silently overwritten by theirs at load and the world list loses the word
       "Mode" off every line. */
    var MN_GM = ['Survival Mode', 'Creative Mode', 'Adventure Mode', 'Spectator Mode'];
    var MN_DIFF = ['Peaceful', 'Easy', 'Normal', 'Hard'];
    function wsInfoLine(w) {
        var s = w.hardcore ? 'Hardcore Mode!' : (MN_GM[w.gm] || MN_GM[0]);
        if (w.cheats) s += ', Cheats';
        return s + ', Version: ' + (w.ver || '26.2');
    }

    /* ── screen: loading ─────────────────────────────────────
       What sits in front of the panorama world being generated. Vanilla's
       equivalent is the publisher's splash, which is theirs; this is the
       wordmark we drew ourselves over the same geometry of progress bar. */
    MN_SCR.loading = {
        bg: 'flat', live: true,
        layout: function () { return []; },
        paint: function (cx, m, W, H) {
            cx.fillStyle = '#0f0f13';
            cx.fillRect(0, 0, W, H);
            /* At 1:1. Halving pixel art with smoothing off just throws away
               every other column and the wordmark comes out gap-toothed. */
            var lg = mnLogo(), half = W < MN_LOGO_W + 24;
            var lw = half ? MN_LOGO_W >> 1 : MN_LOGO_W, lh = half ? MN_LOGO_H >> 1 : MN_LOGO_H;
            cx.save();
            cx.globalAlpha = 0.28 + 0.72 * Math.min(1, m.t / 0.5);
            cx.drawImage(lg, Math.round(W / 2 - lw / 2), Math.round(H / 2 - 46), lw, lh);
            cx.restore();
            var bw = 200, bx = Math.round((W - bw) / 2), by = Math.round(H / 2 + 12);
            mnRect(cx, bx - 1, by - 1, bw + 2, 7, '#ffffff');
            mnRect(cx, bx, by, bw, 5, '#0f0f13');
            mnRect(cx, bx, by, Math.round(bw * Math.max(0, Math.min(1, m.prog || 0))), 5, '#4be04b');
            mfCenter(cx, m.stage || 'Loading…', W / 2, by + 16, '#8a8a94');
        }
    };

    /* ── screen: title ───────────────────────────────────────
       Vanilla's geometry exactly: three 200x20 buttons from height/4 + 48 at
       a 24px pitch, then a row 84px below the first holding two 98px buttons
       between two 20x20 icon buttons. */
    MN_SCR.title = {
        bg: 'pano', live: true,   // the splash pulses twice a second whether or not anything was clicked
        layout: function (m, W, H) {
            var j = ((H / 4) | 0) + 48, x = (W / 2 | 0) - 100, r = j + 84, w = [];
            w.push(mnBtn('sp', x, j, MN_BW, MN_BH, 'Singleplayer', function (mm) { mnGo(mm, 'world'); }));
            w.push(mnBtn('mp', x, j + 24, MN_BW, MN_BH, 'Multiplayer', function (mm) {
                mnGo(mm, optLoad().mpwarn === false ? 'mp' : 'mpwarn');
            }));
            w.push(mnBtn('realms', x, j + 48, MN_BW, MN_BH, 'Minecraft Realms', function (mm) { mnGo(mm, 'realms'); }));
            w.push(mnBtn('lang', (W / 2 | 0) - 124, r, 20, 20, '', function (mm) { mnGo(mm, 'lang'); },
                { k: 'icon', aria: 'Language', icon: 'ic_lang' }));
            w.push(mnBtn('opt', x, r, 98, 20, 'Options...', function (mm) { mnGo(mm, 'options'); }));
            w.push(mnBtn('quit', (W / 2 | 0) + 2, r, 98, 20, 'Quit Game', function () { mnQuit(); }));
            w.push(mnBtn('acc', (W / 2 | 0) + 104, r, 20, 20, '', function (mm) { mnGo(mm, 'access'); },
                { k: 'icon', aria: 'Accessibility Settings', icon: 'ic_acc' }));
            /* The copyright line is a real button in the game — it opens the
               credits, and underlines itself on hover. So is this one. */
            var note = MN_COPY, nw = mfWidth(note);
            w.push({ k: 'draw', id: 'copy', x: W - nw - 2, y: H - 10, w: nw, h: 10, enabled: true,
                aria: note, on: function (mm) { mnGo(mm, 'credits'); },
                draw: function (cx2, b, hover, focus) {
                    mfText(cx2, note, b.x, b.y, MC_WHITE);
                    if (hover || focus) mnRect(cx2, b.x, b.y + 9, nw, 1, MC_WHITE);
                } });
            return w;
        },
        paint: function (cx, m, W, H) {
            cx.drawImage(mnLogo(), Math.round(W / 2 - 128), 30);
            mnEdition(cx, W / 2, 67);
            mnSplash(cx, m, W);
            mfText(cx, 'Minecraft ' + ((RT && RT.ver) || '26.2'), 2, H - 10, MC_WHITE);
        }
    };
    var MN_COPY = 'A fan recreation. Not Mojang, not affiliated.';
    /* ── screen: Select World ────────────────────────────────
       Vanilla: title at y=8, search at y=22, the list from 48 to height-64 at
       36px an entry, two rows of buttons pinned to the bottom. Play / Edit /
       Re-Create follow the selection; Delete has its own flag, which is why
       an unopenable world can still be thrown away. */
    var MN_ROWH = 36;
    MN_SCR.world = {
        bg: 'dirt',
        enter: function (m) { m.d.sel = null; m.d.scroll = 0; m.d.q = ''; },
        wheel: function (m, dy) { m.d.scroll = mnScroll((m.d.scroll || 0) + (dy > 0 ? 18 : -18), MN_SCR.world.rows(m).length * MN_ROWH + 8, m.H - 112); },
        rows: function (m) {
            var q = (m.d.q || '').toLowerCase(), l = wsIndex(), out = [];
            for (var i = 0; i < l.length; i++) if (!q || l[i].name.toLowerCase().indexOf(q) >= 0) out.push(l[i]);
            // most recently played first, which is how the real list is ordered
            out.sort(function (a, b) { return (b.played || 0) - (a.played || 0); });
            return out;
        },
        layout: function (m, W, H) {
            var w = [], cxp = W / 2 | 0;
            w.push({ k: 'input', id: 'q', x: cxp - 100, y: 22, w: 200, h: 20, value: m.d.q || '',
                hint: 'Search…', search: true, enabled: true, aria: 'search for worlds',
                set: function (mm, v) { mm.d.q = v; mm.d.scroll = 0; } });
            var top = 48, bot = H - 64, rows = MN_SCR.world.rows(m);
            var maxScroll = Math.max(0, rows.length * MN_ROWH - (bot - top) + 8);
            if (m.d.scroll > maxScroll) m.d.scroll = maxScroll;
            var rl = cxp - 133;
            for (var i = 0; i < rows.length; i++) {
                var ry = top + 4 - (m.d.scroll || 0) + i * MN_ROWH;
                if (ry + MN_ROWH < top || ry > bot) continue;
                w.push({ k: 'draw', id: 'r' + rows[i].id, x: rl, y: ry, w: 270, h: MN_ROWH - 4, enabled: true,
                    clip: [0, top, W, bot - top],
                    aria: rows[i].name + '. ' + wsInfoLine(rows[i]), world: rows[i],
                    on: (function (ww, at) {
                        return function (mm) {
                            if (mm.d.sel === ww.id && Date.now() - (mm.d.clickT || 0) < 250) return mnPlay(mm, ww.id);
                            if (mm.mx != null && mm.mx - at < 32) return mnPlay(mm, ww.id);   // the icon joins straight away
                            mm.d.sel = ww.id; mm.d.clickT = Date.now();
                        };
                    })(rows[i], rl),
                    draw: mnWorldRow });
            }
            var sel = m.d.sel, can = !!sel;
            w.push(mnBtn('play', cxp - 154, H - 52, 150, 20, 'Play Selected World', function (mm) { mnPlay(mm, mm.d.sel); }, { enabled: can }));
            w.push(mnBtn('new', cxp + 4, H - 52, 150, 20, 'Create New World', function (mm) { mnGo(mm, 'create'); }));
            w.push(mnBtn('edit', cxp - 154, H - 28, 72, 20, 'Edit', function (mm) { mnGo(mm, 'edit'); }, { enabled: can }));
            w.push(mnBtn('del', cxp - 76, H - 28, 72, 20, 'Delete', function (mm) {
                var ww = wsGet(mm.d.sel); if (!ww) return;
                mnConfirm(mm, 'Are you sure you want to delete this world?',
                    "'" + ww.name + "' will be lost forever! (A long time!)", 'Delete', function (m2) {
                        wsDelete(ww.id); m2.d.sel = null; mnBack(m2);
                    });
            }, { enabled: can }));
            w.push(mnBtn('recreate', cxp + 4, H - 28, 72, 20, 'Re-Create', function (mm) {
                var ww = wsGet(mm.d.sel); if (!ww) return;
                mnGo(mm, 'create');
                // re-create means the same world again: carry every setting, not just the name and seed
                var c = mm.d.cw = mnCreateDefaults();
                c.name = ww.name; c.seed = String(ww.seed); c.gm = ww.gm; c.diff = ww.diff;
                c.cheats = !!ww.cheats; c.hardcore = !!ww.hardcore; c.bonus = !!ww.bonus;
                c.type = Math.max(0, MN_WTYPE.indexOf(ww.type || 'Default'));
            }, { enabled: can }));
            w.push(mnBtn('cancel', cxp + 82, H - 28, 72, 20, 'Cancel', function (mm) { mnBack(mm); }));
            return w;
        },
        paint: function (cx, m, W, H) {
            var top = 48, bot = H - 64;
            mnListFrame(cx, 0, top, W, bot - top);
            mfCenter(cx, 'Select World', W / 2, 8, MC_WHITE);
            var rows = MN_SCR.world.rows(m);
            if (!rows.length) mfCenter(cx, m.d.q ? 'No worlds match that.' : 'No worlds yet.', W / 2, top + 24, MC_GREY);
            mnListEdges(cx, 0, top, W, bot - top);
            // the scrollbar, when there is more list than window
            var span = bot - top, total = rows.length * MN_ROWH + 8;
            if (total > span) {
                var sx = (W / 2 | 0) + 144, th = Math.max(32, span * span / total);
                var tp = top + ((m.d.scroll || 0) / (total - span)) * (span - th);
                mnRect(cx, sx, top, 6, span, '#000000');
                mnRect(cx, sx, tp, 6, th, '#808080');
                mnRect(cx, sx, tp, 5, th - 1, '#c0c0c0');
            }
        },
        key: function (m, e) {
            if (e.key === 'Enter' && m.d.sel) { mnPlay(m, m.d.sel); return true; }
            return false;
        }
    };
    /* One world in the list: the 32px icon, the name, then the folder and
       date, then the mode/version line — all three text lines unshadowed and
       the lower two in 0x808080, exactly as the game draws them. */
    function mnWorldRow(cx, b, hover) {
        var m = RT.menu, w = b.world, sel = m.d.sel === w.id;
        if (sel) {
            var lf = m.widgets[m.focus] && m.widgets[m.focus].world;
            mnRect(cx, b.x - 2, b.y - 2, b.w + 4, b.h + 4, lf ? '#ffffff' : '#808080');
            mnRect(cx, b.x - 1, b.y - 1, b.w + 2, b.h + 2, '#000000');
        }
        mnWorldIcon(cx, w, b.x, b.y);
        if (hover) { cx.fillStyle = 'rgba(144, 144, 144, 0.63)'; cx.fillRect(b.x, b.y, 32, 32); mnJoinArrow(cx, b.x, b.y); }
        var tx = b.x + 35;
        mfText(cx, w.name, tx, b.y + 1, MC_WHITE, false);
        mfText(cx, w.folder + ' (' + wsDate(w.played) + ')', tx, b.y + 12, '#808080', false);
        mfText(cx, wsInfoLine(w), tx, b.y + 21, '#808080', false);
    }
    /* A world's icon is a screenshot in the real game. Ours is generated from
       the seed: the terrain profile the world actually has, which means two
       worlds never look alike and the picture is not a lie. */
    var MN_ICON = {};
    function mnWorldIcon(cx, w, x, y) {
        var key = w.id + ':' + w.seed + ':' + (w.icon || 0);
        if (!MN_ICON[key]) {
            var cv = document.createElement('canvas');
            cv.width = 32; cv.height = 32;
            var c = cv.getContext('2d'), rnd = mulb((w.seed | 0) + (w.icon || 0) * 7919);
            var sky = c.createLinearGradient(0, 0, 0, 20);
            sky.addColorStop(0, '#4a7ec8'); sky.addColorStop(1, '#a8c8e8');
            c.fillStyle = sky; c.fillRect(0, 0, 32, 32);
            for (var i = 0; i < 32; i++) {
                var h = 14 + Math.round(Math.sin(i * 0.4 + (w.seed % 17)) * 3 + (rnd() * 4 - 2));
                c.fillStyle = '#6a9c3a'; c.fillRect(i, h, 1, 2);
                c.fillStyle = '#79553a'; c.fillRect(i, h + 2, 1, 32 - h - 2);
                if (rnd() < 0.10) { c.fillStyle = '#2f6a28'; c.fillRect(i, h - 3, 1, 3); }
            }
            MN_ICON[key] = cv;
        }
        cx.drawImage(MN_ICON[key], x, y);
        mnRect(cx, x, y, 32, 1, '#000000'); mnRect(cx, x, y + 31, 32, 1, '#000000');
        mnRect(cx, x, y, 1, 32, '#000000'); mnRect(cx, x + 31, y, 1, 32, '#000000');
    }
    function mnJoinArrow(cx, x, y) {
        cx.fillStyle = '#ffffff';
        for (var i = 0; i < 7; i++) cx.fillRect(x + 11 + i, y + 15 - i, 2, 1 + i * 2);
    }

    /* — shared widget shapes —
       A cycle button reads "Name: Value" and a slider "Name: Value" over a
       filled track, which is how every option in the game is expressed. */
    function mnCycle(id, x, y, w, h, name, vals, i, set, opt) {
        return mnBtn(id, x, y, w, h, name + ': ' + vals[i], function (mm) {
            set(mm, (i + 1) % vals.length);
        }, opt);
    }
    function mnSlider(id, x, y, w, h, label, frac, set) {
        return { k: 'draw', id: id, x: x, y: y, w: w, h: h, enabled: true, aria: label, label: label,
            /* Arrow keys, for a slider reached by Tab. Without this the click
               handler runs with no pointer position and stores NaN, which
               erases the handle and persists as null. */
            slide: function (mm, d) { set(mm, Math.max(0, Math.min(1, frac + d))); },
            on: function (mm, b) {
                if (mm.mx == null || !isFinite(mm.mx)) return;   // keyboard activation: the arrows do this instead
                var f = Math.max(0, Math.min(1, (mm.mx - b.x - 4) / (b.w - 8)));
                if (!isFinite(f)) return;
                set(mm, f);
            },
            draw: function (cx, b, hover, focus) {
                /* AbstractSliderButton: the widget/slider track across the widget
                   (its frame white while focused) and the 8-wide handle at
                   x + value x (w - 8), a little button, white-framed under the
                   pointer; the label over both */
                mnNine(cx, guiSprites()[focus ? 'slider_h' : 'slider'], b.x, b.y, b.w, b.h, 1);
                var kx = b.x + Math.floor(Math.max(0, Math.min(1, frac)) * (b.w - 8));
                mnNine(cx, guiSprites()[hover || focus ? 'btn_h' : 'btn'], kx, b.y, 8, b.h, 3);
                mnLabel(cx, b.label, b.x + 2, b.y, b.x + b.w - 2, b.y + b.h, MC_WHITE);
            } };
    }
    function mnOnOff(v) { return v ? 'ON' : 'OFF'; }
    /* OptionsSubScreen, the way the options tree has been laid out since
       1.20.5: the title in a 33-pixel header, the options as a list of rows 25
       apart from y 37 on the list background between the header and footer
       separators, two 150-wide buttons a row at W/2 - 155 and W/2 + 5, and
       Done in the footer. The list scrolls when the rows outgrow it. */
    function mnGrid(title, rows, done) {
        return {
            bg: 'dirt', list: true,
            wheel: function (m, dy) { m.d.gscroll = Math.max(0, Math.min(m.d.gmax || 0, (m.d.gscroll || 0) + (dy > 0 ? 25 : -25))); },
            layout: function (m, W, H) {
                var w = [], cxp = W / 2 | 0, list = rows(m, W, H), i, n = 0, sc = m.d.gscroll || 0;
                var top = 33, bot = H - 33, nrow = Math.ceil(list.length / 2);
                m.d.gmax = Math.max(0, nrow * 25 + 4 - (bot - top));
                if (sc > m.d.gmax) sc = m.d.gscroll = m.d.gmax;
                for (i = 0; i < list.length; i++) {
                    var r = list[i];
                    if (!r) continue;
                    r.x = cxp + (i % 2 ? 5 : -155);
                    r.y = top + 4 + ((i / 2) | 0) * 25 - sc;
                    if (!r.w) { r.w = 150; r.h = 20; }
                    if (r.y + r.h < top || r.y > bot) continue;
                    r.clip = [0, top, W, bot - top];
                    w.push(r); n++;
                }
                w.push(mnBtn('done', cxp - 100, H - 27, 200, 20, done || 'Done', function (mm) { mnBack(mm); }));
                return w;
            },
            paint: function (cx, m, W, H) {
                mnListBg(cx, m, 0, 33, W, H - 66);
                mfCenter(cx, title, W / 2, 12, MC_WHITE);
            }
        };
    }
    /* the list background between the header and footer separators */
    function mnListBg(cx, m, x, y, w, h) {
        cx.save(); cx.beginPath(); cx.rect(x, y, w, h); cx.clip();
        if (m && m.inworld) { cx.fillStyle = 'rgba(0, 0, 0, 0.3)'; cx.fillRect(x, y, w, h); }
        else mnMenuBg(cx, x + w, y + h, true);
        cx.restore();
        mnSep(cx, x, y - 2, w, true); mnSep(cx, x, y + h, w, false);
    }
    function mnSep(cx, x, y, w, head) {   // header_separator: light over dark; footer_separator: dark over light
        mnRect(cx, x, y, w, 1, head ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.55)');
        mnRect(cx, x, y + 1, w, 1, head ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.25)');
    }
    /* A screen that is a title, some wrapped prose and one button back. Used
       by everything the game shows as an informational panel. */
    function mnText(title, lines, btn) {
        return {
            bg: 'dirt',
            layout: function (m, W, H) {
                return [mnBtn('back', (W / 2 | 0) - 100, H - 38, 200, 20, btn || 'Done', function (mm) { mnBack(mm); })];
            },
            paint: function (cx, m, W, H) {
                mfCenter(cx, title, W / 2, 15, MC_WHITE);
                var body = typeof lines === 'function' ? lines(m) : lines, y = 50;
                for (var i = 0; i < body.length; i++) {
                    var wrapped = mfWrap(body[i], Math.min(360, W - 50));
                    for (var j = 0; j < wrapped.length; j++) { mfCenter(cx, wrapped[j], W / 2, y, i ? MC_GREY : MC_WHITE); y += 10; }
                    y += 4;
                }
            }
        };
    }

    /* ── screen: Create New World ────────────────────────────
       The modern tabbed screen: Game, World, More across the top, the two
       actions pinned to the bottom. Every control here changes the world that
       comes out the other end, which is the only reason to draw it. */
    var MN_WTYPE = ['Default', 'Superflat', 'Large Biomes', 'AMPLIFIED'];
    function mnCreateDefaults() {
        return { name: 'New World', seed: '', gm: 0, hardcore: false, diff: 2, cheats: null,   // null: never touched, so it follows the mode
            type: 0, structures: true, bonus: false, tab: 0 };
    }
    /* What the world will actually get, as opposed to what the player has
       chosen. Vanilla keeps the two apart: Hardcore SHOWS Hard and OFF and greys
       the switches, but the Easy and ON you picked are still there when you
       cycle on to Creative — and an Allow Cheats switch you never touched
       follows the mode, ON for Creative, the way its create screen has always
       flipped it for you (a switch you did set stays as you set it). The old
       code wrote the Hardcore values into the choices, so the standard route to
       a creative world (Survival → Hardcore → Creative) arrived on Hard with no
       commands, and nothing on the screen said why. */
    var MN_GM_INFO = ['Search for resources, craft, gain levels, health and hunger',
        'Same as Survival Mode, locked at hardest difficulty, and one life only',
        'Unlimited resources, free flying and destroy blocks instantly'];
    function mnCreateEff(c) {
        return { diff: c.hardcore ? 3 : c.diff, cheats: c.hardcore ? false : (c.cheats == null ? c.gm === 1 : !!c.cheats), bonus: c.hardcore ? false : !!c.bonus };
    }
    MN_SCR.create = {
        bg: 'dirt',
        enter: function (m) { if (!m.d.cw) m.d.cw = mnCreateDefaults(); },
        layout: function (m, W, H) {
            var c = m.d.cw || (m.d.cw = mnCreateDefaults());
            var w = [], cxp = W / 2 | 0, i;
            var tabs = ['Game', 'World', 'More'], tw = mnTabW(W), tx0 = (W - 3 * tw) >> 1;
            for (i = 0; i < 3; i++) {
                w.push({ k: 'draw', id: 'tab' + i, x: tx0 + i * tw, y: 0, w: tw, h: 24,
                    enabled: true, aria: tabs[i], label: tabs[i], ti: i,
                    on: (function (n) { return function (mm) { mm.d.cw.tab = n; mm.sig = ''; }; })(i),
                    draw: mnTab });
            }
            var y = 42, eff = mnCreateEff(c);
            if (c.tab === 0) {
                w.push({ k: 'input', id: 'nm', x: cxp - 104, y: y + 12, w: 208, h: 20, value: c.name, max: 64,
                    enabled: true, aria: 'World Name', title: 'World Name',
                    set: function (mm, v) { mm.d.cw.name = v; } });
                y += 44;
                // the mode's one-line description sits under the button, so the
                // buttons below it drop by the height of a line
                w.push(mnCycle('gm', cxp - 105, y, 210, 20, 'Game Mode',
                    ['Survival', 'Hardcore', 'Creative'], c.hardcore ? 1 : c.gm === 1 ? 2 : 0,
                    function (mm, n) {
                        mm.d.cw.hardcore = n === 1;
                        mm.d.cw.gm = n === 2 ? 1 : 0;   // the difficulty, cheats and bonus-chest CHOICES are left alone
                    }));
                y += 40;
                w.push(mnCycle('df', cxp - 105, y, 210, 20, 'Difficulty', MN_DIFF, eff.diff,
                    function (mm, n) { mm.d.cw.diff = n; }, { enabled: !c.hardcore }));
                y += 28;
                // untouched, the switch follows the mode (ON for Creative); once you set it, it stays set
                w.push(mnCycle('ch', cxp - 105, y, 210, 20, 'Allow Commands', ['OFF', 'ON'], eff.cheats ? 1 : 0,
                    function (mm, n) { mm.d.cw.cheats = !!n; }, { enabled: !c.hardcore }));
            } else if (c.tab === 1) {
                w.push(mnCycle('wt', cxp - 155, y, 150, 20, 'World Type', MN_WTYPE, c.type,
                    function (mm, n) { mm.d.cw.type = n; }));
                w.push(mnBtn('cust', cxp + 5, y, 150, 20, 'Customize', function () {}, { enabled: false }));
                y += 40;
                w.push({ k: 'input', id: 'sd', x: cxp - 154, y: y, w: 308, h: 20, value: c.seed, max: 32,
                    enabled: true, aria: 'Seed for the world generator', title: 'Seed for the world generator',
                    hint: 'Leave blank for a random seed',
                    set: function (mm, v) { mm.d.cw.seed = v; } });
                y += 30;
                /* Vanilla's other switch here is Generate Structures, which is
                   not offered because this generator has no structures to
                   generate — trees and ore blobs are terrain. A switch that
                   changes nothing is worse than a switch that is not there. */
                w.push(mnCycle('bc', cxp - 155, y, 310, 20, 'Bonus Chest', ['OFF', 'ON'], eff.bonus ? 1 : 0,
                    function (mm, n) { mm.d.cw.bonus = !!n; }, { enabled: !c.hardcore }));
            } else {
                w.push(mnBtn('gr', cxp - 105, y, 210, 20, 'Game Rules', function (mm) { mnGo(mm, 'rules'); }));
                w.push(mnBtn('ex', cxp - 105, y + 28, 210, 20, 'Experiments', function () {}, { enabled: false }));
                w.push(mnBtn('dp', cxp - 105, y + 56, 210, 20, 'Data Packs', function (mm) { mnGo(mm, 'packs'); }));
            }
            w.push(mnBtn('go', cxp - 155, H - 28, 150, 20, 'Create New World', function (mm) { mnCreate(mm); }));
            w.push(mnBtn('cancel', cxp + 5, H - 28, 150, 20, 'Cancel', function (mm) { mnBack(mm); }));
            return w;
        },
        /* The tabbed screen carries no drawn title — the tab bar is the header,
           the way it has been since the flat "More World Options..." screen was
           replaced. The name still reaches a screen reader through the widgets. */
        paint: function (cx, m, W, H) {
            var tw = mnTabW(W), tx0 = (W - 3 * tw) >> 1;
            mnSep(cx, 0, 22, tx0, true); mnSep(cx, tx0 + 3 * tw, 22, W - tx0 - 3 * tw, true);   // out from either end of the tab row
            mnSep(cx, 0, H - 38, W, false);   // over the footer
            var c = m.d.cw;
            // the grey line under Game Mode that says what the mode is, as the real screen has it
            if (c && c.tab === 0) mfText(cx, MN_GM_INFO[c.hardcore ? 1 : c.gm === 1 ? 2 : 0], (W / 2 | 0) - 105, 42 + 44 + 24, MC_GREY);
        }
    };
    /* MenuTabBar: tabs as wide as roundUpToEven((min(400, W) - 28) / 3), the row
       centred along the top, 24 tall; the selected one open onto the page with
       its label 2 higher and underlined, the others darker; the header's
       separator runs out from either end of the row at y 22 */
    function mnTabW(W) { var t = Math.ceil((Math.min(400, W) - 28) / 3); return t + (t & 1); }
    function mnTab(cx, b, hover, focus) {
        var on = RT.menu.d.cw && RT.menu.d.cw.tab === b.ti, hi = hover || focus;
        mnNine(cx, guiSprites()[on ? (hi ? 'tab_sh' : 'tab_s') : (hi ? 'tab_h' : 'tab')], b.x, b.y, b.w, b.h, 2);
        var tw = mfWidth(b.label) + 1, lx = b.x + (b.w >> 1) - (tw >> 1), ly = b.y + (on ? 8 : 10);
        cx.save(); cx.beginPath(); cx.rect(b.x + 1, b.y, b.w - 2, b.h); cx.clip();
        mfText(cx, b.label, lx, ly, MC_WHITE);
        cx.restore();
        if (on) { var uw = Math.min(tw - 1, b.w - 4); mnRect(cx, b.x + (b.w >> 1) - (uw >> 1), b.y + 22, uw, 1, MC_WHITE); }
    }
    function mnCreate(m) {
        var c = m.d.cw, seed;
        if (/^-?\d+$/.test(c.seed.trim())) seed = parseInt(c.seed.trim(), 10) | 0;
        else if (c.seed.trim()) seed = mnHash(c.seed.trim());          // the game hashes a non-numeric seed too
        else seed = (Math.random() * 2147483647) | 0;
        var eff = mnCreateEff(c);
        var w = wsCreate({ name: (c.name || 'New World').trim() || 'New World', seed: seed, gm: c.gm,
            hardcore: c.hardcore, diff: eff.diff, cheats: eff.cheats,
            structures: c.structures, bonus: eff.bonus, type: MN_WTYPE[c.type] });
        if (!w) { m.msg = 'Could not save the world list. Is storage full?'; return; }
        m.d.cw = null;
        mnPlay(m, w.id);
    }

    /* ── screen: Edit World ─────────────────────────────────── */
    MN_SCR.edit = {
        bg: 'dirt',
        enter: function (m) { var w = wsGet(m.d.sel); m.d.ed = w ? w.name : ''; },
        layout: function (m, W, H) {
            var cxp = W / 2 | 0, wd = wsGet(m.d.sel);
            if (m.d.ed == null) m.d.ed = wd ? wd.name : '';
            return [
                { k: 'input', id: 'nm', x: cxp - 100, y: 66, w: 200, h: 20, value: m.d.ed, enabled: true,
                    aria: 'World Name', title: 'World Name', set: function (mm, v) { mm.d.ed = v; } },
                mnBtn('save', cxp - 100, 110, 200, 20, 'Save', function (mm) {
                    wsTouch(mm.d.sel, { name: (mm.d.ed || '').trim() || 'World' });
                    mnBack(mm);
                }),
                /* The icon is generated, so "reset" has to change the thing it
                   is generated from — clearing a cache keyed on id and seed
                   only ever redrew the identical picture. */
                mnBtn('icon', cxp - 100, 134, 200, 20, 'Reset Icon', function (mm) {
                    var ww = wsGet(mm.d.sel);
                    if (ww) wsTouch(ww.id, { icon: ((ww.icon || 0) + 1) % 1000 });
                    mm.msg = 'Icon reset.';
                }),
                mnBtn('folder', cxp - 100, 158, 200, 20, 'Open World Folder', function (mm) {
                    var ww = wsGet(mm.d.sel), h = window.MCHOST;
                    if (h && h.openFolder && ww) h.openFolder('.minecraft/saves/' + ww.folder);
                    else mm.msg = 'Explorer is not available.';
                }),
                mnBtn('cancel', cxp - 100, H - 38, 200, 20, 'Cancel', function (mm) { mnBack(mm); })
            ];
        },
        paint: function (cx, m, W) { mfCenter(cx, 'Edit World', W / 2, 15, MC_WHITE); }
    };

    /* ── screen: the confirm dialog ─────────────────────────── */
    function mnConfirm(m, title, body, okLabel, ok) {
        m.d.cf = { title: title, body: body, ok: okLabel, fn: ok };
        mnGo(m, 'confirm');
    }
    MN_SCR.confirm = {
        bg: 'dirt',
        layout: function (m, W, H) {
            var cxp = W / 2 | 0, c = m.d.cf || {};
            return [
                mnBtn('ok', cxp - 155, H / 2 + 20, 150, 20, c.ok || 'Yes', function (mm) {
                    var f = mm.d.cf && mm.d.cf.fn; mm.d.cf = null; if (f) f(mm); else mnBack(mm);
                }),
                mnBtn('no', cxp + 5, H / 2 + 20, 150, 20, 'Cancel', function (mm) { mm.d.cf = null; mnBack(mm); })
            ];
        },
        paint: function (cx, m, W, H) {
            var c = m.d.cf || {};
            mfCenter(cx, c.title || '', W / 2, H / 2 - 30, MC_WHITE);
            var lines = mfWrap(c.body || '', Math.min(340, W - 50));
            for (var i = 0; i < lines.length; i++) mfCenter(cx, lines[i], W / 2, H / 2 - 12 + i * 10, MC_GREY);
        }
    };

    /* ── screen: the multiplayer warning ─────────────────────
       Vanilla shows this once before the server list. Its text is Mojang's
       legal notice about third-party servers; this one says the true thing
       about this machine instead. */
    MN_SCR.mpwarn = {
        bg: 'dirt',
        layout: function (m, W, H) {
            var cxp = W / 2 | 0;
            return [
                mnCycle('chk', cxp - 155, H - 62, 310, 20, 'Do not show this screen again',
                    ['OFF', 'ON'], m.d.mpw ? 1 : 0, function (mm, n) { mm.d.mpw = !!n; }),
                mnBtn('go', cxp - 155, H - 34, 150, 20, 'Proceed', function (mm) {
                    if (mm.d.mpw) { optLoad().mpwarn = false; optSave(); }
                    mnGo(mm, 'mp', true);
                }),
                mnBtn('back', cxp + 5, H - 34, 150, 20, 'Back', function (mm) { mnBack(mm); })
            ];
        },
        paint: function (cx, m, W, H) {
            mfCenter(cx, 'Caution: Third-Party Online Play', W / 2, 30, MC_WHITE);
            var body = 'Online play is offered by servers that are not owned, operated or supervised by anyone ' +
                'here. This computer is a drawing of a computer, so none of these servers exist and none of ' +
                'them will let you in. The refusals are, at least, the real ones.';
            var lines = mfWrap(body, Math.min(340, W - 50));
            for (var i = 0; i < lines.length; i++) mfCenter(cx, lines[i], W / 2, 56 + i * 10, MC_GREY);
        }
    };

    /* ── screen: Play Multiplayer ────────────────────────────
       The server list, its ping bars and the join that never lands. Each
       server answers the ping the way it would and then refuses the
       connection the way it would; the disconnect reasons are the game's. */
    var MN_SERVERS = [
        { n: "malachi's server", ip: '192.168.1.14', motd: 'we rebuilt the roof\nagain', ping: 4, max: 8, on: 0, fail: 'refuse' },
        { n: 'ureboy.smp', ip: 'smp.isaacure.com', motd: 'Whitelist only. Ask Isaac.', ping: 38, max: 20, on: 3, fail: 'white' },
        { n: 'old server from school', ip: 'mc.notarealhost.invalid', motd: '', ping: -1, max: 0, on: 0, fail: 'dns' },
        { n: 'localhost', ip: '127.0.0.1', motd: "It's you. You're the server.", ping: 0, max: 1, on: 1, fail: 'refuse' }
    ];
    MN_SCR.mp = {
        bg: 'dirt',
        enter: function (m) { m.d.msel = -1; m.d.mscroll = 0; m.d.pingT = 0; },
        wheel: function (m, dy) { m.d.mscroll = mnScroll((m.d.mscroll || 0) + (dy > 0 ? 18 : -18), (MN_SERVERS.length + 1) * MN_ROWH + 8, m.H - 96); },
        live: true,
        layout: function (m, W, H) {
            var w = [], cxp = W / 2 | 0, top = 32, bot = H - 64, rl = cxp - 150, i;
            for (i = 0; i < MN_SERVERS.length; i++) {
                var ry = top + 4 - (m.d.mscroll || 0) + i * MN_ROWH;
                if (ry + MN_ROWH < top || ry > bot) continue;
                w.push({ k: 'draw', id: 's' + i, x: rl, y: ry, w: 305, h: MN_ROWH - 4, enabled: true,
                    clip: [0, top, W, bot - top],
                    aria: MN_SERVERS[i].n, si: i, draw: mnServerRow,
                    on: (function (n) {
                        return function (mm) {
                            if (mm.d.msel === n && Date.now() - (mm.d.mclick || 0) < 250) return mnJoin(mm, n);
                            mm.d.msel = n; mm.d.mclick = Date.now();
                        };
                    })(i) });
            }
            var lanY = top + 4 - (m.d.mscroll || 0) + MN_SERVERS.length * MN_ROWH;
            m.d.lanY = lanY;
            var sel = m.d.msel >= 0;
            w.push(mnBtn('join', cxp - 154, H - 60, 100, 20, 'Join Server', function (mm) { mnJoin(mm, mm.d.msel); }, { enabled: sel }));
            w.push(mnBtn('direct', cxp - 50, H - 60, 100, 20, 'Direct Connection', function (mm) { mnGo(mm, 'direct'); }));
            w.push(mnBtn('add', cxp + 54, H - 60, 100, 20, 'Add Server', function (mm) { mnGo(mm, 'addserver'); }));
            w.push(mnBtn('sedit', cxp - 154, H - 36, 74, 20, 'Edit', function () {}, { enabled: sel }));
            w.push(mnBtn('sdel', cxp - 76, H - 36, 74, 20, 'Delete', function (mm) {
                var s = MN_SERVERS[mm.d.msel]; if (!s) return;
                mnConfirm(mm, 'Are you sure you want to remove this server?',
                    "'" + s.n + "' will be lost forever! (A long time!)", 'Delete', function (m2) {
                        MN_SERVERS.splice(m2.d.msel, 1); m2.d.msel = -1; mnBack(m2);
                    });
            }, { enabled: sel }));
            w.push(mnBtn('refresh', cxp + 2, H - 36, 74, 20, 'Refresh', function (mm) { mm.d.pingT = 0; }));
            w.push(mnBtn('mcancel', cxp + 80, H - 36, 74, 20, 'Cancel', function (mm) { mnBack(mm); }));
            return w;
        },
        tick: function (m, dt) { m.d.pingT = (m.d.pingT || 0) + dt; m.dirty = true; },
        paint: function (cx, m, W, H) {
            var top = 32, bot = H - 64;
            mnListFrame(cx, 0, top, W, bot - top);
            mfCenter(cx, 'Play Multiplayer', W / 2, 20, MC_WHITE);
            var ly = m.d.lanY;
            if (ly != null && ly > top && ly < bot) {
                var dots = '.'.repeat(1 + ((m.d.pingT * 2) | 0) % 3);
                mfCenter(cx, 'Scanning for games on your local network' + dots, W / 2, ly + 8, MC_GREY);
            }
            mnListEdges(cx, 0, top, W, bot - top);
        },
        key: function (m, e) {
            if (e.key === 'Enter' && m.d.msel >= 0) { mnJoin(m, m.d.msel); return true; }
            if (e.key === 'F5') { m.d.pingT = 0; return true; }
            return false;
        }
    };
    function mnPingTier(ms) { return ms < 0 ? 5 : ms < 150 ? 0 : ms < 300 ? 1 : ms < 600 ? 2 : ms < 1000 ? 3 : 4; }
    function mnServerRow(cx, b, hover) {
        var m = RT.menu, s = MN_SERVERS[b.si], sel = m.d.msel === b.si;
        if (sel) {
            mnRect(cx, b.x - 2, b.y - 2, b.w + 4, b.h + 4, '#ffffff');
            mnRect(cx, b.x - 1, b.y - 1, b.w + 2, b.h + 2, '#000000');
        }
        mnRect(cx, b.x, b.y, 32, 32, '#2a2a30');
        mfCenter(cx, '?', b.x + 16, b.y + 12, '#6a6a76', false);
        if (hover) { cx.fillStyle = 'rgba(144, 144, 144, 0.63)'; cx.fillRect(b.x, b.y, 32, 32); mnJoinArrow(cx, b.x, b.y); }
        var tx = b.x + 35;
        mfText(cx, s.n, tx, b.y + 1, MC_WHITE, false);
        var pinging = (m.d.pingT || 0) < 1.2;
        if (pinging) mfText(cx, 'Pinging…', tx, b.y + 12, '#808080', false);
        else if (s.ping < 0) mfText(cx, "Can't resolve hostname", tx, b.y + 12, MC_RED, false);
        else {
            var mo = String(s.motd).split('\n');
            for (var i = 0; i < mo.length && i < 2; i++) mfText(cx, mo[i], tx, b.y + 12 + i * 9, '#808080', false);
        }
        // player count, right-aligned in front of the bars
        if (!pinging && s.ping >= 0) mfRight(cx, s.on + '/' + s.max, b.x + 305 - 17, b.y + 1, '#808080', false);
        /* Five bars in a 10x8 cell, as the icons sheet has them: heights 2..6,
           two pixels apart, sitting on the same baseline. While the ping is
           still out the lit count bounces, which is vanilla's pinging state. */
        var tier = pinging ? (((m.d.pingT * 10) | 0) + b.si * 2) & 7 : mnPingTier(s.ping);
        if (pinging && tier > 4) tier = 8 - tier;
        var bx = b.x + 305 - 15, by = b.y;
        var lit = pinging ? tier + 1 : (s.ping < 0 ? 0 : 5 - mnPingTier(s.ping));
        for (var k = 0; k < 5; k++) {
            var hgt = k + 2;
            mnRect(cx, bx + k * 2, by + 8 - hgt, 1, hgt, k < lit ? '#c0c0c0' : '#3a3a3a');
        }
        if (!pinging && s.ping < 0) {   // no connection: the red cross the game shows instead
            for (var d = 0; d < 5; d++) { mnRect(cx, bx + d, by + 1 + d, 1, 1, MC_RED); mnRect(cx, bx + 4 - d, by + 1 + d, 1, 1, MC_RED); }
        }
    }
    /* Joining: the game's status sequence, then the refusal this server would
       actually give. The strings are the game's own disconnect reasons. */
    var MN_CONNECT = ['Connecting to the server...', 'Logging in...', 'Encrypting...', 'Negotiating...', 'Joining world...'];
    var MN_FAIL = {
        dns: ['Failed to connect to the server', "Can't resolve hostname"],
        refuse: ['Failed to connect to the server', 'Connection refused: no further information'],
        white: ['Failed to connect to the server', 'You are not white-listed on this server!']
    };
    function mnJoin(m, i) { mnJoinServer(m, MN_SERVERS[i]); }
    function mnJoinServer(m, s) {
        if (!s) return;
        m.d.conn = { t: 0, step: 0, s: s, stop: s.ping < 0 ? 1 : 5 };
        m.d.dcBack = m.scr;         // the disconnect screen goes back where the join started
        mnGo(m, 'connect');
    }
    MN_SCR.connect = {
        bg: 'dirt', live: true,
        layout: function (m, W, H) {
            return [mnBtn('abort', (W / 2 | 0) - 100, ((H / 4) | 0) + 132, 200, 20, 'Cancel', function (mm) {
                mm.d.conn = null; mnBack(mm);
            })];
        },
        tick: function (m, dt) {
            var c = m.d.conn;
            if (!c) return;
            c.t += dt;
            m.dirty = true;
            if (c.t > c.stop * 0.55 + 0.5) {
                var f = MN_FAIL[c.s.fail] || MN_FAIL.refuse;
                m.d.dc = { title: f[0], body: f[1] };
                m.d.conn = null;
                mnGo(m, 'disconnect', true);
            }
        },
        paint: function (cx, m, W, H) {
            var c = m.d.conn;
            if (!c) return;
            var step = Math.min(c.stop - 1, (c.t / 0.55) | 0);
            mfCenter(cx, MN_CONNECT[step], W / 2, H / 2 - 50, MC_WHITE);
        },
        key: function () { return true; }   // vanilla ignores Esc here
    };
    MN_SCR.disconnect = {
        bg: 'dirt',
        layout: function (m, W, H) {
            /* Pop back to whatever started the join — the server list, or the
               Direct Connection screen. The connect screen already put that on
               the stack, so this pops rather than pushing another copy. */
            var lbl = m.d.dcBack === 'direct' ? 'Back' : 'Back to Server List';
            return [mnBtn('back', (W / 2 | 0) - 100, H / 2 + 30, 200, 20, lbl, function (mm) {
                mm.d.dc = null; mnBack(mm);
            })];
        },
        paint: function (cx, m, W, H) {
            var d = m.d.dc || {};
            mfCenter(cx, d.title || 'Disconnected', W / 2, H / 2 - 30, MC_WHITE);
            var lines = mfWrap(d.body || '', Math.min(W - 50, 360));
            for (var i = 0; i < lines.length; i++) mfCenter(cx, lines[i], W / 2, H / 2 - 10 + i * 10, MC_GREY);
        }
    };
    MN_SCR.direct = {
        bg: 'dirt',
        layout: function (m, W, H) {
            var cxp = W / 2 | 0;
            if (m.d.ip == null) m.d.ip = '';
            var valid = /^[\w.\-]+(:\d{1,5})?$/.test(m.d.ip.trim());
            return [
                { k: 'input', id: 'ip', x: cxp - 100, y: 116, w: 200, h: 20, value: m.d.ip, max: 128, enabled: true,
                    aria: 'Server Address', title: 'Server Address', set: function (mm, v) { mm.d.ip = v; } },
                /* Connect to it without adding it to the saved list — vanilla's
                   Direct Connection does not save the address, and appending
                   one dead entry per attempt was filling the list up. */
                mnBtn('join', cxp - 100, ((H / 4) | 0) + 108, 200, 20, 'Join Server', function (mm) {
                    mnJoinServer(mm, { n: mm.d.ip.trim(), ip: mm.d.ip.trim(), motd: '', ping: -1, max: 0, on: 0, fail: 'dns' });
                }, { enabled: valid }),
                mnBtn('cancel', cxp - 100, ((H / 4) | 0) + 132, 200, 20, 'Cancel', function (mm) { mnBack(mm); })
            ];
        },
        paint: function (cx, m, W) { mfCenter(cx, 'Direct Connection', W / 2, 20, MC_WHITE); }
    };
    MN_SCR.addserver = {
        bg: 'dirt',
        layout: function (m, W, H) {
            var cxp = W / 2 | 0;
            if (m.d.sn == null) { m.d.sn = 'Minecraft Server'; m.d.sip = ''; }
            return [
                { k: 'input', id: 'sn', x: cxp - 100, y: 66, w: 200, h: 20, value: m.d.sn, enabled: true,
                    aria: 'Server Name', title: 'Server Name', set: function (mm, v) { mm.d.sn = v; } },
                { k: 'input', id: 'sip', x: cxp - 100, y: 106, w: 200, h: 20, value: m.d.sip, enabled: true,
                    aria: 'Server Address', title: 'Server Address', set: function (mm, v) { mm.d.sip = v; } },
                mnBtn('done', cxp - 100, ((H / 4) | 0) + 114, 200, 20, 'Done', function (mm) {
                    MN_SERVERS.push({ n: mm.d.sn.trim() || 'Minecraft Server', ip: mm.d.sip.trim(),
                        motd: '', ping: -1, max: 0, on: 0, fail: 'dns' });
                    mm.d.sn = null;
                    mnBack(mm);
                }, { enabled: !!(m.d.sip || '').trim() }),
                mnBtn('cancel', cxp - 100, ((H / 4) | 0) + 138, 200, 20, 'Cancel', function (mm) { mm.d.sn = null; mnBack(mm); })
            ];
        },
        paint: function (cx, m, W) { mfCenter(cx, 'Edit Server Info', W / 2, 17, MC_WHITE); }
    };

    /* ── screen: Options and its tree ────────────────────────
       The grid is vanilla's, in vanilla's order. Every entry that this game
       can honour is wired to the thing it names; the ones it cannot are
       screens that say so rather than switches that lie. */
    /* OptionsScreen: a 61-pixel header holding the title and the FOV slider and
       Online... side by side, 8 apart; the ten screens in a two-column grid of
       150-wide buttons, 158 to a column and 24 to a row, centred in what is left;
       Done in the footer. */
    MN_SCR.options = {
        bg: 'dirt',
        rows: function () {
            var o = optLoad();
            return [
                mnSlider('fov', 0, 0, 150, 20, 'FOV: ' + (o.fov === 70 ? 'Normal' : o.fov >= 110 ? 'Quake Pro' : o.fov),
                    (o.fov - 30) / 80, function (mm, f) { o.fov = Math.round(30 + f * 80); optSave(); }),
                mnBtn('online', 0, 0, 150, 20, 'Online...', function (mm) { mnGo(mm, 'online'); }),
                mnBtn('skin', 0, 0, 150, 20, 'Skin Customization...', function (mm) { mnGo(mm, 'skin'); }),
                mnBtn('snd', 0, 0, 150, 20, 'Music & Sounds...', function (mm) { mnGo(mm, 'sound'); }),
                mnBtn('vid', 0, 0, 150, 20, 'Video Settings...', function (mm) { mnGo(mm, 'video'); }),
                mnBtn('ctrl', 0, 0, 150, 20, 'Controls...', function (mm) { mnGo(mm, 'controls'); }),
                mnBtn('lang', 0, 0, 150, 20, 'Language...', function (mm) { mnGo(mm, 'lang'); }),
                mnBtn('chat', 0, 0, 150, 20, 'Chat Settings...', function (mm) { mnGo(mm, 'chat'); }),
                mnBtn('rp', 0, 0, 150, 20, 'Resource Packs...', function (mm) { mnGo(mm, 'packs'); }),
                mnBtn('acc', 0, 0, 150, 20, 'Accessibility Settings...', function (mm) { mnGo(mm, 'access'); }),
                mnBtn('tel', 0, 0, 150, 20, 'Telemetry Data...', function (mm) { mnGo(mm, 'telemetry'); }),
                mnBtn('cred', 0, 0, 150, 20, 'Credits & Attribution...', function (mm) { mnGo(mm, 'credits'); })
            ];
        },
        layout: function (m, W, H) {
            var cxp = W / 2 | 0, l = MN_SCR.options.rows(), w = [], i;
            l[0].x = cxp - 154; l[0].y = 29; l[1].x = cxp + 4; l[1].y = 29;
            w.push(l[0], l[1]);
            var gy = 61 + (((H - 94) - 120) >> 1);
            for (i = 2; i < l.length; i++) { var k = i - 2; l[i].x = cxp + (k % 2 ? 4 : -154); l[i].y = gy + ((k / 2) | 0) * 24; w.push(l[i]); }
            w.push(mnBtn('done', cxp - 100, H - 27, 200, 20, 'Done', function (mm) { mnBack(mm); }));
            return w;
        },
        paint: function (cx, m, W) { mfCenter(cx, 'Options', W / 2, 12, MC_WHITE); }
    };
    MN_SCR.video = mnGrid('Video Settings', function (m) {
        var o = optLoad();
        return [
            mnCycle('gfx', 0, 0, 150, 20, 'Graphics', ['Fast', 'Fancy'], o.fancy ? 1 : 0,
                function (mm, n) { o.fancy = !!n; optSave(); }),
            mnSlider('rd', 0, 0, 150, 20, 'Render Distance: ' + o.rd + ' chunks', (o.rd - 2) / 14,
                function (mm, f) { o.rd = Math.round(2 + f * 14); optSave(); }),
            mnCycle('vs', 0, 0, 150, 20, 'VSync', ['OFF', 'ON'], o.vsync ? 1 : 0,
                function (mm, n) { o.vsync = !!n; optSave(); }),
            mnCycle('bob', 0, 0, 150, 20, 'View Bobbing', ['OFF', 'ON'], o.bob === false ? 0 : 1,
                function (mm, n) { o.bob = !!n; optSave(); }),
            mnCycle('gs', 0, 0, 150, 20, 'GUI Scale', ['Auto', '1', '2', '3', '4'], o.guiScale,
                function (mm, n) { o.guiScale = n; optSave(); mnSize(mm); }),
            mnCycle('cl', 0, 0, 150, 20, 'Clouds', ['OFF', 'ON'], o.clouds === false ? 0 : 1,
                function (mm, n) { o.clouds = !!n; optSave(); })
        ];
    });
    MN_SCR.controls = mnGrid('Controls', function (m) {
        var o = optLoad();
        return [
            mnBtn('mouse', 0, 0, 150, 20, 'Mouse Settings...', function (mm) { mnGo(mm, 'mouse'); }),
            mnBtn('keys', 0, 0, 150, 20, 'Key Binds...', function (mm) { mnGo(mm, 'keys'); }),
            mnCycle('aj', 0, 0, 150, 20, 'Auto-Jump', ['OFF', 'ON'], o.autoJump ? 1 : 0,
                function (mm, n) { o.autoJump = !!n; optSave(); })
        ];
    });
    MN_SCR.mouse = mnGrid('Mouse Settings', function (m) {
        var o = optLoad();
        return [
            mnSlider('sens', 0, 0, 150, 20, 'Sensitivity: ' + (o.sens === 0 ? '*yawn*' : o.sens >= 200 ? 'HYPERSPEED!!!' : o.sens + '%'),
                o.sens / 200, function (mm, f) { o.sens = Math.round(f * 200); optSave(); }),
            mnCycle('inv', 0, 0, 150, 20, 'Invert Mouse', ['OFF', 'ON'], o.invert ? 1 : 0,
                function (mm, n) { o.invert = !!n; optSave(); })
        ];
    });
    MN_SCR.sound = mnGrid('Music & Sounds', function (m) {
        var o = optLoad();
        return [
            mnCycle('master', 0, 0, 150, 20, 'Sound', ['OFF', 'ON'], o.snd ? 1 : 0,
                function (mm, n) { o.snd = !!n; if (S) S.snd = o.snd; optSave(); }),
            mnCycle('music', 0, 0, 150, 20, 'Music', ['OFF', 'ON'], o.mus ? 1 : 0,
                function (mm, n) { o.mus = !!n; if (S) S.mus = o.mus; optSave(); })
        ];
    });
    MN_SCR.access = mnGrid('Accessibility Settings', function (m) {
        var o = optLoad();
        return [
            mnCycle('splash', 0, 0, 150, 20, 'Hide Splash Texts', ['OFF', 'ON'], o.splash ? 0 : 1,
                function (mm, n) { o.splash = !n; optSave(); mm.splash = o.splash ? (mm.splash || mnPickSplash()) : null; }),
            mnCycle('pano', 0, 0, 150, 20, 'Panorama Motion', ['OFF', 'ON'], o.panoStill ? 0 : 1,
                function (mm, n) { o.panoStill = !n; optSave(); }),
            mnSlider('tilt', 0, 0, 150, 20, 'Damage Tilt: ' + Math.round((o.tilt == null ? 1 : o.tilt) * 100) + '%', o.tilt == null ? 1 : o.tilt,
                function (mm, f) { o.tilt = Math.round(f * 100) / 100; optSave(); }),
            mnCycle('big', 0, 0, 150, 20, 'Larger GUI', ['OFF', 'ON'], o.guiScale >= 3 ? 1 : 0,
                function (mm, n) { o.guiScale = n ? 3 : 0; optSave(); mnSize(mm); })
        ];
    });
    /* Language. Vanilla lists every locale it ships; this one lists the ones
       whose strings actually exist here, because a language button that
       changes nothing is worse than a short list. */
    var MN_LANGS = [
        { id: 'en_us', n: 'English (US)' }, { id: 'en_gb', n: 'English (UK)' },
        { id: 'es_es', n: 'Español (España)' }, { id: 'fr_fr', n: 'Français (France)' },
        { id: 'de_de', n: 'Deutsch (Deutschland)' }, { id: 'pt_br', n: 'Português (Brasil)' }
    ];
    MN_SCR.lang = {
        bg: 'dirt',
        wheel: function (m, dy) { m.d.lscroll = mnScroll((m.d.lscroll || 0) + (dy > 0 ? 16 : -16), MN_LANGS.length * 18 + 8, m.H - 72); },
        layout: function (m, W, H) {
            var w = [], cxp = W / 2 | 0, top = 32, bot = H - 40, o = optLoad();
            for (var i = 0; i < MN_LANGS.length; i++) {
                var y = top + 4 - (m.d.lscroll || 0) + i * 18;
                if (y < top || y + 16 > bot) continue;
                w.push({ k: 'draw', id: 'l' + i, x: cxp - 100, y: y, w: 200, h: 16, enabled: true,
                    clip: [0, top, W, bot - top],
                    aria: MN_LANGS[i].n, li: i,
                    on: (function (id) { return function () { optLoad().lang = id; optSave(); }; })(MN_LANGS[i].id),
                    draw: function (cx, b, hover) {
                        var cur = optLoad().lang === MN_LANGS[b.li].id;
                        if (cur || hover) { mnRect(cx, b.x, b.y, b.w, b.h, cur ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)'); }
                        mfCenter(cx, MN_LANGS[b.li].n, b.x + b.w / 2, b.y + 4, cur ? MC_YELLOW : MC_WHITE);
                    } });
            }
            w.push(mnBtn('done', cxp - 100, H - 32, 200, 20, 'Done', function (mm) { mnBack(mm); }));
            return w;
        },
        paint: function (cx, m, W, H) {
            mnListFrame(cx, 0, 32, W, H - 72);
            mfCenter(cx, 'Language', W / 2, 15, MC_WHITE);
            mnListEdges(cx, 0, 32, W, H - 72);
            mfCenter(cx, 'The menu is written in English. The rest is a promise.', W / 2, H - 44, MC_GREY);
        }
    };
    MN_SCR.realms = mnText('Minecraft Realms', [
        'Realms is a safe, simple way to enjoy an online world with friends.',
        'There is no Realm here, and there is nobody to bill.',
        'This machine is a picture of a machine and its network cable goes nowhere.'
    ], 'Back');
    MN_SCR.online = mnText('Online Options', [
        'Nothing is online.',
        'No account is signed in, no session is open, and no chat is reported anywhere.'
    ]);
    MN_SCR.telemetry = mnText('Telemetry Data', [
        'Nothing is collected.',
        'There is no server to send it to and no one is curious enough to build one.'
    ]);
    MN_SCR.chat = mnGrid('Chat Settings', function (m) {
        var o = optLoad();
        return [
            mnCycle('cv', 0, 0, 150, 20, 'Chat', ['Shown', 'Commands only', 'Hidden'], o.chat || 0,
                function (mm, n) { o.chat = n; optSave(); }),
            mnCycle('cc', 0, 0, 150, 20, 'Command Suggestions', ['OFF', 'ON'], o.sug === false ? 0 : 1,
                function (mm, n) { o.sug = !!n; optSave(); })
        ];
    });
    MN_SCR.packs = mnText('Select Resource Packs', [
        'Available: none.',
        'The textures in this game are drawn at boot by code in this file, so there is ' +
        'nothing on disk for a pack to replace.'
    ]);
    MN_SCR.skin = mnText('Skin Customization', function () {
        var sk = window.MCHOST && window.MCHOST.skin && window.MCHOST.skin();
        return ['Active skin: ' + (sk && sk.n ? sk.n : 'Steve'),
            'Skins are chosen in the launcher. This world renders you from the outside only when you drop something.'];
    });
    MN_SCR.credits = mnText('Credits & Attribution', [
        'Minecraft is made by Mojang Studios. This is not that.',
        'This is a recreation of its title screen, written from scratch for a personal site: ' +
        'the font, the wordmark, the widgets and the world behind them are all drawn by code in this file.',
        'No Mojang assets are used, and nothing here is sold.'
    ], 'Back');
    MN_SCR.keys = mnText('Key Binds', [
        'Movement  WASD · Jump  Space · Sneak  Shift · Sprint  double-tap W',
        'Attack  Left · Use  Right · Pick Block  Middle · Drop  Q',
        'Inventory  E · Chat  T · Command  / · Debug  F3 · Fly  double-tap Space',
        'These are fixed. Rebinding is not built yet.'
    ]);
    MN_SCR.rules = mnText('Game Rules', [
        'Rules are set per world once it is running.',
        'Open the world and use /gamerule — the parser is real and it lists what it accepts.'
    ]);

    /* ── skeleton + wiring ──────────────────────────────────── */
    function render() {
        return '<div class="mc" tabindex="0">' +
            /* The DOM half of the GUI sets its text in the MCUI web font, and the
               browser anti-aliases every glyph edge — on Windows it smears each one
               across two pixels at 242 and 93. Rounding the alpha back to 0 or 1
               recovers the bitmap exactly, so every .mt layer runs through this. */
            '<svg class="mc-defs" width="0" height="0" aria-hidden="true" focusable="false"><filter id="mccrisp" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">' +
            '<feComponentTransfer><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer></filter></svg>' +
            '<canvas class="mc-cv"></canvas>' +
            '<div class="mc-vig"></div><div class="mc-vign"></div>' +
            /* The crosshair lives OUTSIDE .mc-hud. Inside it, .mc-hud's z-index made
               a stacking context and mix-blend-mode:difference had nothing but
               transparent pixels to blend against — so the crosshair was a flat #ddd
               cross, invisible over snow, sand and bright sky. */
            '<i class="mc-cross"></i><i class="mc-atk"><b></b></i><canvas class="mc-cross3d" width="48" height="48"></canvas>' +
            '<div class="mc-hud">' +
            '<div class="mc-armor"></div><div class="mc-hearts"></div><div class="mc-food"></div><div class="mc-air"></div>' +
            '<i class="mc-hbbar"></i>' +
            '<div class="mc-hotbar">' + slotsHTML('inv', 0, 9, 'mc-hb') + '</div>' +
            '<i class="mc-hbsel"></i>' +
            '<i class="mc-hboff" style="display:none"></i><div class="mc-slot mc-offslot" style="display:none"></div>' +
            '<div class="mc-xpbar"><i class="mc-xpfill"></i></div><i class="mc-xplvl"></i>' +
            '<span class="mc-tip mt"></span><span class="mc-actbar mt"></span>' +
            '</div>' +
            '<div class="mc-effects" style="display:none"></div>' +
            '<div class="mc-chat"><div class="mc-chatlog"></div>' +
              '<div class="mc-sug" style="display:none"><div class="mc-sugu"><span class="mt"></span></div><div class="mc-sugl"></div></div>' +
              '<i class="mc-chatbar"></i>' +
              '<input class="mc-chatin" maxlength="256" spellcheck="false" autocomplete="off">' +
              '<div class="mc-chatmir"></div>' +
              '<div class="mc-chattab"></div></div>' +
            '<div class="mc-toasts"></div>' +
            '<div class="mc-panelwrap" style="display:none"></div>' +
            '<div class="mc-debug" style="display:none"></div>' +
            '<div class="mc-sleepov" style="display:none"></div>' +
            '<div class="mc-pause" style="display:none"><i class="mc-iwbg"></i>' +
              '<div class="mc-iwl mc-pmain"></div><div class="mc-iwl mc-lan" style="display:none"></div><div class="mc-iwl mc-plink" style="display:none"></div>' +
              '<div class="mc-iwl mc-advs" style="display:none"></div><div class="mc-iwl mc-stats" style="display:none"></div>' +
              '<div class="mc-ptip mc-iwtip"></div></div>' +
            '<div class="mc-death" style="display:none"><div class="mc-iwl mc-dmain"></div><div class="mc-iwl mc-dquit" style="display:none"></div><div class="mc-ptip mc-iwtip"></div></div>' +
            '<div class="mc-bed" style="display:none"></div>' +
            '<div class="mc-load" style="display:none"><span class="mc-ltext"><span class="mt"></span></span><i class="mc-lbar"><b></b></i><canvas class="mc-lmap"></canvas></div>' +
            /* the menu draws itself on its own canvas, with a transparent layer
               of real controls over it for focus, typing and screen readers */
            '<canvas class="mc-mcv" style="display:none"></canvas>' +
            '<div class="mc-mui" style="display:none"></div>' +
            '</div>';
    }

    /* ═══════════════ chat & commands ═══════════════
       A real chat line with real commands. The parser follows Minecraft's
       grammar rather than approximating it: @-selectors with filters,
       ~ relative and ^ local coordinates, per-argument validation, and the
       game's own two-line syntax error with the caret under the offending
       token. Every command moves state this world actually simulates —
       nothing here is a printed message pretending to be an effect. */

    var CHAT_MAX = 100;          // scrollback lines kept
    var CHAT_FADE = 10;          // seconds a line stays visible with chat closed

    /* ── message log ─────────────────────────────────────── */
    function chatSay(text, cls) {
        if (!RT) return;
        RT.chatLog = RT.chatLog || [];
        String(text).split('\n').forEach(function (line) {
            RT.chatLog.push({ t: line, c: cls || '', at: RT.now || 0 });
        });
        while (RT.chatLog.length > CHAT_MAX) RT.chatLog.shift();
        paintChat();
    }
    function chatErr(text) { chatSay(text, 'err'); }

    /* Minecraft's syntax error: the message, then the command as the server
       saw it (no slash), in grey up to the point it stopped understanding —
       the last ten characters, with ... if there were more — then the rest
       in red underline, and <--[HERE] after it. */
    function chatSyntax(msg, full, pos) {
        chatErr(msg);
        if (!RT) return;
        full = String(full);
        pos = Math.max(0, Math.min(full.length, pos | 0));
        RT.chatLog = RT.chatLog || [];
        RT.chatLog.push({ t: (pos > 10 ? '...' : '') + full.slice(Math.max(0, pos - 10), pos), u: full.slice(pos), c: 'mc-ctx', at: RT.now || 0 });   // 'ctx' alone is the desktop's menu class
        while (RT.chatLog.length > CHAT_MAX) RT.chatLog.shift();
        paintChat();
    }

    /* ── argument reader ─────────────────────────────────── */
    function Reader(str) { this.s = str; this.i = 0; }
    Reader.prototype.skip = function () { while (this.i < this.s.length && this.s[this.i] === ' ') this.i++; };
    Reader.prototype.done = function () { this.skip(); return this.i >= this.s.length; };
    Reader.prototype.word = function () {          // next space-delimited token
        this.skip();
        var st = this.i;
        while (this.i < this.s.length && this.s[this.i] !== ' ') this.i++;
        return this.s.slice(st, this.i);
    };
    Reader.prototype.rest = function () { this.skip(); var r = this.s.slice(this.i); this.i = this.s.length; return r; };
    /* a selector token has to survive [] containing spaces, so it can't just
       split on whitespace */
    Reader.prototype.selectorTok = function () {
        this.skip();
        var st = this.i, depth = 0;
        while (this.i < this.s.length) {
            var ch = this.s[this.i];
            if (ch === '[') depth++;
            else if (ch === ']') depth--;
            else if (ch === ' ' && depth <= 0) break;
            this.i++;
        }
        return this.s.slice(st, this.i);
    };

    /* ── numbers & coordinates ───────────────────────────── */
    function parseNum(tok) {
        if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(tok)) return null;
        var v = parseFloat(tok);
        return isFinite(v) ? v : null;
    }
    function parseInt2(tok) {
        if (!/^[-+]?\d+$/.test(tok)) return null;
        var v = parseInt(tok, 10);
        return isFinite(v) ? v : null;
    }
    /* One coordinate component. `~` is relative to base, `^` is local (relative
       to where you're facing) and must not be mixed with the other two. */
    function coordPart(tok, base) {
        if (tok === '') return null;
        if (tok[0] === '~') {
            if (tok.length === 1) return { v: base, local: false };
            var d = parseNum(tok.slice(1));
            return d === null ? null : { v: base + d, local: false };
        }
        if (tok[0] === '^') {
            var l = tok.length === 1 ? 0 : parseNum(tok.slice(1));
            return l === null ? null : { v: l, local: true };
        }
        var a = parseNum(tok);
        return a === null ? null : { v: a, local: false };
    }
    /* Read three components into a world position. Returns null on a bad token
       (with `bad` set to the offending index) so the caller can point at it. */
    function readPos(rd, ox, oy, oz) {
        var toks = [rd.word(), rd.word(), rd.word()];
        var parts = [], i;
        var base = [ox, oy, oz];
        for (i = 0; i < 3; i++) {
            var p = coordPart(toks[i], base[i]);
            if (!p) return null;
            parts.push(p);
        }
        var locals = parts.filter(function (p) { return p.local; }).length;
        if (locals && locals !== 3) return { mixed: true };
        if (locals === 3) {
            // ^left ^up ^forward, resolved against the player's facing
            var yaw = S.yaw, pitch = S.pitch;
            var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
            var fx = sy * cp, fy = -sp, fz = -cy * cp;         // forward
            var rx = cy, ry = 0, rz = sy;                       // right
            var ux = sy * sp, uy = cp, uz = -cy * sp;           // up
            var L = parts[0].v, U = parts[1].v, F = parts[2].v;
            return { x: ox - rx * L + ux * U + fx * F,
                     y: oy - ry * L + uy * U + fy * F,
                     z: oz - rz * L + uz * U + fz * F };
        }
        return { x: parts[0].v, y: parts[1].v, z: parts[2].v };
    }

    /* ── entity selectors ────────────────────────────────── */
    function selFilters(body) {
        // body is the text between [ and ]; split on commas not inside braces
        var out = [], depth = 0, cur = '';
        for (var i = 0; i < body.length; i++) {
            var ch = body[i];
            if (ch === '{' || ch === '[') depth++;
            if (ch === '}' || ch === ']') depth--;
            if (ch === ',' && depth <= 0) { out.push(cur); cur = ''; continue; }
            cur += ch;
        }
        if (cur.trim()) out.push(cur);
        var f = {};
        for (i = 0; i < out.length; i++) {
            var eq = out[i].indexOf('=');
            if (eq < 0) return null;
            f[out[i].slice(0, eq).trim()] = out[i].slice(eq + 1).trim();
        }
        return f;
    }
    function rangeTest(spec, v) {   // MC range syntax: n, a.., ..b, a..b
        if (/^\.\./.test(spec)) { var hi = parseNum(spec.slice(2)); return hi !== null && v <= hi; }
        var dd = spec.indexOf('..');
        if (dd < 0) { var e = parseNum(spec); return e !== null && Math.abs(v - e) < 1e-6; }
        var lo = parseNum(spec.slice(0, dd));
        var h2 = spec.slice(dd + 2) === '' ? null : parseNum(spec.slice(dd + 2));
        if (lo === null) return false;
        return v >= lo && (h2 === null || v <= h2);
    }
    /* Resolve a selector to a list of targets. The player is a target like any
       other, so /kill @e really does include you — as it does in the game. */
    // give/clear/effect/enchant/xp only ever act on the player, so a selector that
    // resolves to nothing (or to mobs only) must fail rather than quietly hit Steve
    function playerTargeted(tg) {
        for (var i = 0; i < tg.length; i++) if (tg[i].player) return true;
        return false;
    }
    function resolveTargets(tok) {
        var PLAYER = { player: true, name: 'Steve' };
        if (!tok) return null;
        if (tok[0] !== '@') return /^steve$/i.test(tok) ? [PLAYER] : [];
        var kind = tok[1], rest = tok.slice(2), filt = {};
        if ('pares'.indexOf(kind) < 0) return null;
        if (rest) {
            if (rest[0] !== '[' || rest[rest.length - 1] !== ']') return null;
            filt = selFilters(rest.slice(1, -1));
            if (!filt) return null;
        }
        var pool = [];
        if (kind === 's') pool = [PLAYER];
        else if (kind === 'p' || kind === 'a') pool = [PLAYER];
        else if (kind === 'r') pool = [PLAYER];
        else if (kind === 'e') { pool = [PLAYER].concat(RT.foes); }
        var out = pool.filter(function (t) {
            var tx = t.player ? S.px : t.x, ty = t.player ? S.py : t.y, tz = t.player ? S.pz : t.z;
            var type = t.player ? 'player' : t.k;
            if (filt.type !== undefined) {
                var want = filt.type, neg = want[0] === '!';
                if (neg) want = want.slice(1);
                want = want.replace(/^minecraft:/, '');
                var match = want === type;
                if (neg ? match : !match) return false;
            }
            if (filt.distance !== undefined) {
                var dx = tx - S.px, dy = ty - S.py, dz = tz - S.pz;
                if (!rangeTest(filt.distance, Math.sqrt(dx * dx + dy * dy + dz * dz))) return false;
            }
            if (filt.name !== undefined && filt.name.replace(/^!/, '') === 'Steve') {
                if ((filt.name[0] === '!') === !!t.player) return false;
            }
            return true;
        });
        if (filt.sort === 'nearest' || kind === 'p') {
            out.sort(function (a, b) { return selDist(a) - selDist(b); });
        } else if (filt.sort === 'furthest') {
            out.sort(function (a, b) { return selDist(b) - selDist(a); });
        } else if (filt.sort === 'random' || kind === 'r') {
            out.sort(function () { return Math.random() - 0.5; });
        }
        var lim = filt.limit !== undefined ? parseInt2(filt.limit) : (kind === 'p' || kind === 's' || kind === 'r' ? 1 : null);
        if (lim !== null && lim >= 0) out = out.slice(0, lim);
        return out;
    }
    function selDist(t) {
        var tx = t.player ? S.px : t.x, ty = t.player ? S.py : t.y, tz = t.player ? S.pz : t.z;
        var dx = tx - S.px, dy = ty - S.py, dz = tz - S.pz;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    function targetName(t) { return t.player ? 'Steve' : (MOBS[t.k] ? t.k.charAt(0).toUpperCase() + t.k.slice(1) : t.k); }

    /* ── name tables ─────────────────────────────────────── */
    var BLOCK_BY_NAME = null;
    function blockNames() {
        if (BLOCK_BY_NAME) return BLOCK_BY_NAME;
        BLOCK_BY_NAME = {
            air: AIR, grass_block: GRASS, grass: GRASS, dirt: DIRT, stone: STONE, cobblestone: COBBLE,
            oak_log: LOG, log: LOG, oak_leaves: LEAVES, leaves: LEAVES, oak_planks: PLANKS, planks: PLANKS,
            sand: SAND, gravel: GRAVEL, coal_ore: ORE_COAL, iron_ore: ORE_IRON, gold_ore: ORE_GOLD,
            diamond_ore: ORE_DIA, redstone_ore: ORE_RED, lapis_ore: ORE_LAPIS, emerald_ore: ORE_EMERALD,
            bedrock: BEDROCK, water: WATER, lava: LAVA, crafting_table: TABLE, furnace: FURN,
            torch: TORCH, glass: GLASS, wool: WOOL, white_wool: WOOL, bed: BED, tall_grass: TALLGRASS,
            dandelion: DANDELION, poppy: POPPY, farmland: FARMLAND, wheat: WHEAT3, chest: CHEST, tnt: TNT,
            cactus: CACTUS, sugar_cane: SUGARCANE, pumpkin: PUMPKIN, melon: MELON,
            obsidian: OBSIDIAN, stone_bricks: STONEBRICK, sandstone: SANDSTONE, bricks: BRICKS,
            bookshelf: BOOKSHELF, ladder: LADDER, redstone_lamp: RLAMP, cake: CAKE,
            enchanting_table: ETABLE, anvil: ANVIL, mushroom: MUSHROOM, clay: CLAY, snow_grass: SNOWGRASS
        };
        return BLOCK_BY_NAME;
    }
    function itemNames() { return Object.keys(I); }
    function mobNames() { return Object.keys(MOBS); }
    function stripNs(s) { return String(s).replace(/^minecraft:/, ''); }

    /* ── the command table ───────────────────────────────── */
    var GAMEMODES = { survival: 0, creative: 1, adventure: 2, spectator: 3, s: 0, c: 1, a: 2, sp: 3, '0': 0, '1': 1, '2': 2, '3': 3 };
    var GM_NAME = ['Survival', 'Creative', 'Adventure', 'Spectator'];
    var DIFFS = { peaceful: 0, easy: 1, normal: 2, hard: 3, p: 0, e: 1, n: 2, h: 3, '0': 0, '1': 1, '2': 2, '3': 3 };
    var DIFF_NAME = ['Peaceful', 'Easy', 'Normal', 'Hard'];

    var CMDS = {};
    function cmd(name, usage, help, fn, complete) {
        CMDS[name] = { name: name, usage: usage, help: help, run: fn, complete: complete };
    }

    cmd('help', '/help [command]', 'Shows a list of commands', function (rd) {
        var q = rd.word();
        if (q) {
            var c = CMDS[stripNs(q).toLowerCase()];
            if (!cmdAllowed(c)) return chatErr('Unknown command: ' + q);
            chatSay(c.usage);
            chatSay(c.help);
            return;
        }
        var names = cmdNames();   // only what this world will actually run
        chatSay('--- Showing ' + names.length + ' commands ---', 'dim');
        for (var i = 0; i < names.length; i++) chatSay(CMDS[names[i]].usage, 'dim');
    }, function (a) { return a === 0 ? cmdNames() : []; });
    CMDS.help.free = true;

    cmd('gamemode', '/gamemode <survival|creative|adventure|spectator>', 'Sets a player\'s game mode', function (rd, raw) {
        var m = rd.word();
        if (!m) return usageErr('gamemode', raw, rd.i);
        var g = GAMEMODES[stripNs(m).toLowerCase()];
        if (g === undefined) return chatSyntax('Unknown game mode: ' + m, raw, rd.i);   // GameModeArgument leaves the cursor after the word
        setGamemode(g);
        chatSay('Set own game mode to ' + GM_NAME[g] + ' Mode');
    }, function (a) { return a === 0 ? ['survival', 'creative', 'adventure', 'spectator'] : []; });

    cmd('difficulty', '/difficulty [peaceful|easy|normal|hard]', 'Sets the difficulty level', function (rd, raw) {
        var d = rd.word();
        if (!d) return chatSay('The difficulty is ' + DIFF_NAME[S.diff]);
        var v = DIFFS[stripNs(d).toLowerCase()];
        if (v === undefined) return chatSyntax('Unknown difficulty: ' + d, raw, rd.i - d.length);
        S.diff = v;
        // peaceful clears the hostiles, and spawnTick keeps them cleared
        if (v === 0) for (var i = RT.foes.length - 1; i >= 0; i--) if (RT.foes[i].hostile) RT.foes.splice(i, 1);
        chatSay('Set the difficulty to ' + DIFF_NAME[v]);
    }, function (a) { return a === 0 ? ['peaceful', 'easy', 'normal', 'hard'] : []; });

    cmd('time', '/time <set|add|query> <value>', 'Changes or queries the world time', function (rd, raw) {
        var sub = rd.word().toLowerCase();
        var TIMES = { day: 0.05, noon: 0.25, sunset: 0.48, night: 0.55, midnight: 0.75, sunrise: 0.95 };
        if (sub === 'query') {
            var q = rd.word().toLowerCase() || 'daytime';
            var ticks = Math.floor(S.t / CYCLE * 24000);
            if (q === 'day') return chatSay('The time is ' + Math.floor(S.hrs * 3600000 / CYCLE));
            return chatSay('The time is ' + ticks);
        }
        if (sub !== 'set' && sub !== 'add') return usageErr('time', raw, rd.i);
        var v = rd.word();
        if (!v) return usageErr('time', raw, rd.i);
        var frac = TIMES[v.toLowerCase()];
        var ticks2;
        if (frac !== undefined) ticks2 = Math.round(frac * 24000);
        else {
            var n = parseInt2(v.replace(/t$/, ''));
            if (n === null) return chatSyntax('Expected integer', raw, rd.i - v.length);
            ticks2 = n;
        }
        if (sub === 'set') S.t = ((ticks2 % 24000) + 24000) % 24000 / 24000 * CYCLE;
        else S.t = (S.t + ticks2 / 24000 * CYCLE) % CYCLE;
        var now = Math.floor(S.t / CYCLE * 24000);
        chatSay(sub === 'set' ? 'Set the time to ' + now : 'Added ' + ticks2 + ' to the time');
    }, function (a) { return a === 0 ? ['set', 'add', 'query'] : a === 1 ? ['day', 'noon', 'sunset', 'night', 'midnight', 'sunrise'] : []; });

    cmd('weather', '/weather <clear|rain|thunder> [duration]', 'Sets the weather', function (rd, raw) {
        var w = rd.word().toLowerCase();
        var map = { clear: 0, rain: 1, thunder: 2 };
        if (!(w in map)) return usageErr('weather', raw, rd.i);
        var dur = rd.word();
        var secs = dur ? parseInt2(dur) : 300;
        if (dur && secs === null) return chatSyntax('Expected integer', raw, rd.i - dur.length);
        S.weather = map[w]; S.wt = Math.max(1, secs);
        chatSay(w === 'clear' ? 'Set the weather to clear' : w === 'rain' ? 'Set the weather to rain' : 'Set the weather to thunder');
    }, function (a) { return a === 0 ? ['clear', 'rain', 'thunder'] : []; });

    cmd('tp', '/tp <x> <y> <z> | /tp <target>', 'Teleports entities', cmdTeleport, tpComplete);
    cmd('teleport', '/teleport <x> <y> <z> | /teleport <target>', 'Teleports entities', cmdTeleport, tpComplete);
    function tpComplete() { return ['@p', '@e', '@s', '~ ~ ~']; }
    function cmdTeleport(rd, raw) {
        var save = rd.i, first = rd.selectorTok();
        if (first && first[0] === '@') {
            var tg = resolveTargets(first);
            if (tg === null) return chatSyntax('Invalid entity selector', raw, save);
            if (!tg.length) return chatErr('No entity was found');
            var t = tg[0];
            var dx = t.player ? S.px : t.x, dy = t.player ? S.py : t.y, dz = t.player ? S.pz : t.z;
            tpPlayer(dx, dy, dz);
            return chatSay('Teleported Steve to ' + fmtC(dx) + ', ' + fmtC(dy) + ', ' + fmtC(dz));
        }
        rd.i = save;
        var p = readPos(rd, S.px, S.py, S.pz);
        if (!p) return chatSyntax('Incomplete (expected 3 coordinates)', raw, rd.i);
        if (p.mixed) return chatErr('Cannot mix world & local coordinates (everything must either use ^ or not)');
        tpPlayer(p.x, p.y, p.z);
        chatSay('Teleported Steve to ' + fmtC(p.x) + ', ' + fmtC(p.y) + ', ' + fmtC(p.z));
    }

    cmd('give', '/give <target> <item> [count]', 'Gives an item to a player', function (rd, raw) {
        var selAt = rd.i, sel = rd.selectorTok();
        if (!sel) return usageErr('give', raw, rd.i);
        var tg = resolveTargets(sel);
        if (tg === null) return chatSyntax('Invalid entity selector', raw, selAt);
        if (!playerTargeted(tg)) return chatErr('No player was found');
        var itAt = rd.i, item = stripNs(rd.word());
        if (!item) return usageErr('give', raw, rd.i);
        if (!I[item]) return chatSyntax('Unknown item \'minecraft:' + item + '\'', raw, itAt + 1);
        var cAt = rd.i, ct = rd.word();
        var n = ct ? parseInt2(ct) : 1;
        if (ct && n === null) return chatSyntax('Expected integer', raw, cAt + 1);
        if (n < 1) return chatErr('Integer must not be less than 1, found ' + n);
        if (!tg.some(function (t) { return t.player; })) return chatErr('No player was found');
        var left = invGive(item, n);
        paintHotbar();
        chatSay('Gave ' + n + ' [' + (I[item].t || item) + '] to Steve' + (left ? ' (' + left + ' would not fit)' : ''));
    }, function (a) { return a === 0 ? ['@s', '@p'] : a === 1 ? itemNames() : []; });

    cmd('recipe', '/recipe <give|take> <targets> <*|recipe>', 'Gives or takes player recipes', function (rd, raw) {
        var sub = rd.word().toLowerCase();
        if (sub !== 'give' && sub !== 'take') return usageErr('recipe', raw, rd.i);
        var selAt = rd.i, sel = rd.selectorTok();
        if (!sel) return usageErr('recipe', raw, rd.i);
        var tg = resolveTargets(sel);
        if (tg === null) return chatSyntax('Invalid entity selector', raw, selAt);
        if (!playerTargeted(tg)) return chatErr('No player was found');
        var rAt = rd.i, w = stripNs(rd.word());
        if (!w) return usageErr('recipe', raw, rd.i);
        var list = w === '*' ? rbAll() : rbAll().filter(function (r) { return rbId(r) === w; });
        if (!list.length) return chatSyntax('Unknown recipe: minecraft:' + w, raw, rAt + 1);
        var keys = list.map(function (r) { return r.key; });
        if (sub === 'give') {
            var n = rbLearn(keys);
            return n ? chatSay('Unlocked ' + n + ' recipes for Steve') : chatErr('No new recipes were learned');
        }
        var had = keys.filter(function (k) { return S.rbk.indexOf(k) >= 0; });
        if (!had.length) return chatErr('No recipes could be forgotten');
        S.rbk = S.rbk.filter(function (k) { return keys.indexOf(k) < 0; });
        had.forEach(function (k) { if (S.rbNew) delete S.rbNew[k]; });
        RT.rbKnown = null;
        if (RT.panel && rbShown()) rbPaint();
        chatSay('Took ' + had.length + ' recipes from Steve');
    }, function (a) { return a === 0 ? ['give', 'take'] : a === 1 ? ['@s', '@p'] : a === 2 ? ['*'].concat(rbAll().map(rbId)) : []; });

    cmd('clear', '/clear [target] [item]', 'Clears items from inventory', function (rd, raw) {
        var selAt = rd.i, sel = rd.selectorTok();
        // the target is optional, so "/clear diamond" names an item, not a player
        if (sel && sel.charAt(0) !== '@' && I[stripNs(sel)]) { rd.i = selAt; sel = ''; }
        if (sel) {
            var ctg = resolveTargets(sel);
            if (ctg === null) return chatSyntax('Invalid entity selector', raw, selAt);
            if (!playerTargeted(ctg)) return chatErr('No player was found');
        }
        var itAt = rd.i, item = stripNs(rd.word());
        if (item && !I[item]) return chatSyntax('Unknown item \'minecraft:' + item + '\'', raw, itAt + 1);
        var n = 0, i;
        for (i = 0; i < 36; i++) {
            var s = S.inv[i];
            if (!s) continue;
            if (item && s.id !== item) continue;
            n += s.c; S.inv[i] = null;
        }
        if (!item) for (i = 0; i < 4; i++) if (S.armor[i]) { n++; S.armor[i] = null; }
        if (S.off && (!item || S.off.id === item)) { n += S.off.c; S.off = null; }
        paintHotbar(); paintArmorBar();
        chatSay(n ? 'Removed ' + n + ' items from player Steve' : 'No items were found on player Steve');
    }, function (a) { return a === 0 ? ['@s'] : a === 1 ? itemNames() : []; });

    cmd('kill', '/kill [target]', 'Kills entities', function (rd, raw) {
        var at = rd.i, sel = rd.selectorTok() || '@s';
        var tg = resolveTargets(sel);
        if (tg === null) return chatSyntax('Invalid entity selector', raw, at);
        if (!tg.length) return chatErr('No entity was found');
        var killed = 0, names = [];
        for (var i = 0; i < tg.length; i++) {
            var t = tg[i];
            if (t.player) { S.hp = 0; RT.dead = false; hurtBypass(1000); killed++; names.push('Steve'); }
            else { t.hp = 0; killFoe(t); killed++; names.push(targetName(t)); }
        }
        chatSay(killed === 1 ? 'Killed ' + names[0] : 'Killed ' + killed + ' entities');
    }, function (a) { return a === 0 ? ['@s', '@e', '@e[type=zombie]'] : []; });

    cmd('summon', '/summon <entity> [x y z]', 'Summons an entity', function (rd, raw) {
        var at = rd.i, kind = stripNs(rd.word()).toLowerCase();
        if (!kind) return usageErr('summon', raw, rd.i);
        if (!MOBS[kind]) return chatSyntax('Unknown entity type \'minecraft:' + kind + '\'', raw, at + 1);
        var p = { x: S.px, y: S.py, z: S.pz };
        if (!rd.done()) {
            var q = readPos(rd, S.px, S.py, S.pz);
            if (!q) return chatSyntax('Incomplete (expected 3 coordinates)', raw, rd.i);
            if (q.mixed) return chatErr('Cannot mix world & local coordinates (everything must either use ^ or not)');
            p = q;
        }
        if (RT.foes.length >= 200) return chatErr('Too many entities in the world');
        var nf = mkFoe(kind, p.x, p.y, p.z);
        RT.foes.push(nf);
        chatSay('Summoned new ' + (kind.charAt(0).toUpperCase() + kind.slice(1)));
    }, function (a) { return a === 0 ? mobNames() : a === 1 ? ['~ ~ ~'] : []; });

    cmd('setblock', '/setblock <x> <y> <z> <block>', 'Changes a block', function (rd, raw) {
        var p = readPos(rd, Math.floor(S.px), Math.floor(S.py), Math.floor(S.pz));
        if (!p) return chatSyntax('Incomplete (expected 3 coordinates)', raw, rd.i);
        if (p.mixed) return chatErr('Cannot mix world & local coordinates (everything must either use ^ or not)');
        var bAt = rd.i, bn = stripNs(rd.word()).toLowerCase();
        if (!bn) return usageErr('setblock', raw, rd.i);
        var id = blockNames()[bn];
        if (id === undefined) return chatSyntax('Unknown block type \'minecraft:' + bn + '\'', raw, bAt + 1);
        var x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z);
        if (y < 0 || y >= CH) return chatErr('Position is not loaded');
        // chunks outside the view radius do not exist yet; setB would no-op and
        // the command would claim a success that never happened
        if (!chunkAt(x, z)) return chatErr('Position is not loaded');
        setB(x, y, z, id);
        chatSay('Changed the block at ' + x + ', ' + y + ', ' + z);
    }, function (a) { return a < 3 ? ['~'] : a === 3 ? Object.keys(blockNames()) : []; });

    cmd('fill', '/fill <from> <to> <block> [replace|destroy|keep|hollow|outline]', 'Fills a region with a block', function (rd, raw) {
        var bx = Math.floor(S.px), by = Math.floor(S.py), bz = Math.floor(S.pz);
        var a = readPos(rd, bx, by, bz);
        if (!a || a.mixed) return chatSyntax('Incomplete (expected 3 coordinates)', raw, rd.i);
        var b = readPos(rd, bx, by, bz);
        if (!b || b.mixed) return chatSyntax('Incomplete (expected 3 coordinates)', raw, rd.i);
        var bAt = rd.i, bn = stripNs(rd.word()).toLowerCase();
        if (!bn) return usageErr('fill', raw, rd.i);
        var id = blockNames()[bn];
        if (id === undefined) return chatSyntax('Unknown block type \'minecraft:' + bn + '\'', raw, bAt + 1);
        var mode = (rd.word() || 'replace').toLowerCase();
        if (['replace', 'destroy', 'keep', 'hollow', 'outline'].indexOf(mode) < 0) return chatErr('Unknown fill mode: ' + mode);
        var x0 = Math.min(Math.floor(a.x), Math.floor(b.x)), x1 = Math.max(Math.floor(a.x), Math.floor(b.x));
        var y0 = Math.max(0, Math.min(Math.floor(a.y), Math.floor(b.y))), y1 = Math.min(CH - 1, Math.max(Math.floor(a.y), Math.floor(b.y)));
        var z0 = Math.min(Math.floor(a.z), Math.floor(b.z)), z1 = Math.max(Math.floor(a.z), Math.floor(b.z));
        var vol = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
        if (vol > 32768) return chatErr('Too many blocks in the specified area (maximum 32768, specified ' + vol + ')');
        if (!chunkAt(x0, z0) || !chunkAt(x1, z1)) return chatErr('Position is not loaded');
        var n = 0;
        for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) for (var z = z0; z <= z1; z++) {
            var edge = x === x0 || x === x1 || y === y0 || y === y1 || z === z0 || z === z1;
            if ((mode === 'hollow' || mode === 'outline') && !edge) { if (mode === 'hollow') { if (getB(x, y, z) !== AIR) { setB(x, y, z, AIR, true); n++; } } continue; }
            if (mode === 'keep' && getB(x, y, z) !== AIR) continue;
            setB(x, y, z, id, true);
            n++;
        }
        remeshAround(x0, y0, z0, x1, y1, z1);
        chatSay(n ? 'Successfully filled ' + n + ' block(s)' : 'No blocks were filled');
    }, function (a) { return a < 6 ? ['~'] : a === 6 ? Object.keys(blockNames()) : a === 7 ? ['replace', 'destroy', 'keep', 'hollow', 'outline'] : []; });

    cmd('effect', '/effect <give|clear> [target] [effect] [seconds] [amplifier]', 'Adds or removes status effects', function (rd, raw) {
        var sub = rd.word().toLowerCase();
        if (sub !== 'give' && sub !== 'clear') return usageErr('effect', raw, rd.i);
        var selAt = rd.i, sel = rd.selectorTok();
        // vanilla's clear branch takes an optional target, so a bare "/effect clear"
        // wipes your own effects and "/effect clear speed" names an effect, not a target
        if (sub === 'clear' && (!sel || (sel.charAt(0) !== '@' && EFFECTS[stripNs(sel).toLowerCase()]))) {
            rd.i = selAt;            // hand the token back; it's the effect name
            sel = '@s';
        }
        if (!sel) return usageErr('effect', raw, rd.i);
        var etg = resolveTargets(sel);
        if (etg === null) return chatSyntax('Invalid entity selector', raw, selAt);
        if (!playerTargeted(etg)) return chatErr('No player was found');
        if (sub === 'clear') {
            var eAt = rd.i, one = stripNs(rd.word()).toLowerCase();
            if (one) {
                if (!EFFECTS[one]) return chatSyntax('Unknown effect \'minecraft:' + one + '\'', raw, eAt + 1);
                if (!S.eff[one]) return chatErr('Steve has no ' + EFFECTS[one].t);
                delete S.eff[one]; paintEffects();
                return chatSay('Took ' + EFFECTS[one].t + ' from Steve');
            }
            var had = Object.keys(S.eff).length;
            S.eff = {}; paintEffects();
            return chatSay(had ? 'Took every effect from Steve' : 'Steve has no effects to remove');
        }
        var evAt = rd.i, ev = stripNs(rd.word()).toLowerCase();
        if (!ev) return usageErr('effect', raw, rd.i);
        if (!EFFECTS[ev]) return chatSyntax('Unknown effect \'minecraft:' + ev + '\'', raw, evAt + 1);
        var sAt = rd.i, st = rd.word();
        var secs = st ? parseInt2(st) : 30;
        if (st && secs === null) return chatSyntax('Expected integer', raw, sAt + 1);
        var aAt = rd.i, at2 = rd.word();
        var amp = at2 ? parseInt2(at2) : 0;
        if (at2 && amp === null) return chatSyntax('Expected integer', raw, aAt + 1);
        if (amp < 0 || amp > 255) return chatErr('Amplifier must be between 0 and 255');
        applyEffect(ev, secs, amp);
        chatSay('Applied effect ' + EFFECTS[ev].t + (amp ? ' ' + roman(amp + 1) : '') + ' to Steve for ' + secs + ' seconds');
    }, function (a) { return a === 0 ? ['give', 'clear'] : a === 1 ? ['@s'] : a === 2 ? Object.keys(EFFECTS) : []; });

    cmd('xp', '/xp <add|set|query> <targets> <amount> [levels|points]', 'Adds or removes experience', function (rd, raw) {
        var sub = rd.word().toLowerCase();
        if (['add', 'set', 'query'].indexOf(sub) < 0) return usageErr('xp', raw, rd.i);
        // vanilla puts the targets before the amount; tolerate it being left off
        var selAt = rd.i, sel = rd.selectorTok();
        if (!sel || sel.charAt(0) !== '@') { rd.i = selAt; sel = '@s'; }
        var xtg = resolveTargets(sel);
        if (xtg === null) return chatSyntax('Invalid entity selector', raw, selAt);
        if (!playerTargeted(xtg)) return chatErr('No player was found');
        if (sub === 'query') {
            var qu = (rd.word() || 'levels').toLowerCase();
            return chatSay(qu === 'points' || qu === 'p'
                ? 'Steve has ' + S.xp + ' experience points'
                : 'Steve has ' + S.xpl + ' levels');
        }
        var vAt = rd.i, v = rd.word();
        var n = parseInt2(v);
        if (n === null) return chatSyntax('Expected integer', raw, vAt + 1);
        var unit = (rd.word() || 'points').toLowerCase();
        if (unit === 'levels' || unit === 'l') {
            S.xpl = sub === 'set' ? Math.max(0, n) : Math.max(0, S.xpl + n);
            S.xp = 0;
        } else {
            if (sub === 'set') { S.xpl = 0; S.xp = 0; }
            if (n > 0) spawnXpDirect(n);
            else { S.xp = Math.max(0, S.xp + n); }
        }
        paintXp();
        chatSay(sub === 'set' ? 'Set ' + n + ' experience ' + unit + ' on Steve' : 'Gave ' + n + ' experience ' + unit + ' to Steve');
    }, function (a) { return a === 0 ? ['add', 'set', 'query'] : a === 1 ? ['@s', '@p'] : a === 3 ? ['levels', 'points'] : []; });

    cmd('gamerule', '/gamerule <rule> [value]', 'Sets or queries a game rule', function (rd, raw) {
        var rAt = rd.i, r = rd.word();
        if (!r) {
            chatSay('--- Game rules ---', 'dim');
            for (var k in GR_DEF) chatSay(k + ' = ' + rule(k), 'dim');
            return;
        }
        var key = null;
        for (var g in GR_DEF) if (g.toLowerCase() === r.toLowerCase()) key = g;
        if (!key) return chatSyntax('Unknown game rule: ' + r, raw, rAt + 1);
        var v = rd.word();
        if (!v) return chatSay('Gamerule ' + key + ' is currently set to: ' + rule(key));
        if (v !== 'true' && v !== 'false') return chatSyntax('Invalid boolean, expected \'true\' or \'false\'', raw, rd.i - v.length);
        S.rules[key] = v === 'true';
        chatSay('Gamerule ' + key + ' is now set to: ' + v);
    }, function (a) { return a === 0 ? Object.keys(GR_DEF) : a === 1 ? ['true', 'false'] : []; });

    cmd('seed', '/seed', 'Displays the world seed', function () {
        chatSay('Seed: [' + S.seed + ']');
    });
    CMDS.seed.free = true;   // no permission needed on the integrated server

    cmd('spawnpoint', '/spawnpoint [x y z]', 'Sets your spawn point', function (rd, raw) {
        var p = { x: S.px, y: S.py, z: S.pz };
        if (!rd.done()) {
            var q = readPos(rd, S.px, S.py, S.pz);
            if (!q || q.mixed) return chatSyntax('Incomplete (expected 3 coordinates)', raw, rd.i);
            p = q;
        }
        S.spawn = [p.x, p.y, p.z];
        chatSay('Set spawn point to ' + fmtC(p.x) + ', ' + fmtC(p.y) + ', ' + fmtC(p.z) + ' for Steve');
    }, function (a) { return a === 0 ? ['~ ~ ~'] : []; });

    cmd('setworldspawn', '/setworldspawn [x y z]', 'Sets the world spawn', function (rd, raw) {
        var p = { x: S.px, y: S.py, z: S.pz };
        if (!rd.done()) {
            var q = readPos(rd, S.px, S.py, S.pz);
            if (!q || q.mixed) return chatSyntax('Incomplete (expected 3 coordinates)', raw, rd.i);
            p = q;
        }
        S.wspawn = [p.x, p.y, p.z];
        chatSay('Set the world spawn point to ' + fmtC(p.x) + ', ' + fmtC(p.y) + ', ' + fmtC(p.z));
    }, function (a) { return a === 0 ? ['~ ~ ~'] : []; });

    cmd('enchant', '/enchant <target> <enchantment> [level]', 'Enchants the held item', function (rd, raw) {
        var selAt = rd.i, sel = rd.selectorTok();
        if (!sel) return usageErr('enchant', raw, rd.i);
        var ntg = resolveTargets(sel);
        if (ntg === null) return chatSyntax('Invalid entity selector', raw, selAt);
        if (!playerTargeted(ntg)) return chatErr('No player was found');
        var eAt = rd.i, en = stripNs(rd.word()).toLowerCase();
        if (!en) return usageErr('enchant', raw, rd.i);
        if (!ENCH_BY_CMD[en]) return chatSyntax('Unknown enchantment \'minecraft:' + en + '\'', raw, eAt + 1);
        var lAt = rd.i, lv = rd.word();
        var l = lv ? parseInt2(lv) : 1;
        if (lv && l === null) return chatSyntax('Expected integer', raw, lAt + 1);
        var h = held();
        if (!h) return chatErr('Steve is not holding an item');
        if (l < 1 || l > 5) return chatErr('Level ' + l + ' is not supported (1-5)');
        h.ench = h.ench || {};
        h.ench[ENCH_BY_CMD[en]] = l;
        paintHotbar();
        chatSay('Applied enchantment to Steve\'s item');
    }, function (a) { return a === 0 ? ['@s'] : a === 1 ? Object.keys(ENCH_BY_CMD) : []; });

    cmd('say', '/say <message>', 'Broadcasts a message', function (rd) {
        var m = rd.rest();
        if (!m) return chatErr('Expected message');
        chatSay('[Steve] ' + m);
    });
    cmd('me', '/me <action>', 'Displays a narrative message', function (rd) {
        var m = rd.rest();
        if (!m) return chatErr('Expected message');
        chatSay('* Steve ' + m);
    });
    CMDS.me.free = true;
    cmd('list', '/list', 'Lists players on the server', function () {
        chatSay('There are 1 of a max of 1 players online: Steve');
    });
    CMDS.list.free = true;   // /list and /me are level-0 commands: cheats or not, everyone has them
    cmd('locate', '/locate <biome>', 'Reports the nearest biome of a kind', function (rd, raw) {
        var BIOMES = ['plains', 'forest', 'desert', 'snowy'];
        var b = stripNs(rd.word()).toLowerCase();
        if (!b) return usageErr('locate', raw, rd.i);
        var want = BIOMES.indexOf(b);
        if (want < 0) return chatSyntax('Unknown biome \'minecraft:' + b + '\'', raw, rd.i - b.length);
        // real search: walk outward on a spiral asking the same noise the terrain uses
        var px = Math.floor(S.px), pz = Math.floor(S.pz);
        for (var r = 0; r <= 512; r += 16) {
            for (var a = 0; a < 32; a++) {
                var ang = a / 32 * 6.283;
                var x = px + Math.round(Math.cos(ang) * r), z = pz + Math.round(Math.sin(ang) * r);
                if (biomeAt(x, z) === want) {
                    return chatSay('The nearest ' + b + ' is at [' + x + ', ~, ' + z + '] (' + Math.round(Math.sqrt((x - px) * (x - px) + (z - pz) * (z - pz))) + ' blocks away)');
                }
            }
        }
        chatErr('Could not find a ' + b + ' within 512 blocks');
    }, function (a) { return a === 0 ? ['plains', 'forest', 'desert', 'snowy'] : []; });

    cmd('tellraw', '/tellraw <target> <message>', 'Displays a raw message', function (rd) {
        rd.selectorTok();
        var m = rd.rest();
        try { var j = JSON.parse(m); chatSay(typeof j === 'string' ? j : (j.text || m)); }
        catch (e) { chatSay(m); }
    });

    /* command name → the id this engine stores on a stack */
    var ENCH_BY_CMD = {
        sharpness: 'sharp', efficiency: 'eff', fortune: 'fortune', silk_touch: 'silk',
        unbreaking: 'unbreaking', knockback: 'knock', looting: 'looting',
        fire_aspect: 'fire', feather_falling: 'feather'
    };

    /* ── helpers the commands lean on ────────────────────── */
    function fmtC(v) { return (Math.round(v * 100) / 100).toString(); }
    function roman(n) { return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n); }
    // a command cut short gets the same two lines an unknown one does — the usage
    // line went with 1.12; the box above the input shows it while you type
    function usageErr(name, raw, pos) { chatSyntax('Unknown or incomplete command, see below for error', raw, pos); }
    function tpPlayer(x, y, z) {
        S.px = x; S.py = y; S.pz = z;
        RT.vy = 0; RT.fallY = y;
        ensureChunks();
    }
    function hurtBypass(n) { S.hp = 0; RT.dead = false; RT.lastSrc = { m: 'kill' }; die(); }
    function killFoe(f) {
        var i = RT.foes.indexOf(f);
        if (i >= 0) RT.foes.splice(i, 1);
    }
    function spawnXpDirect(n) { addXp(n); }
    function setGamemode(g) {
        var was = S.gm;
        S.gm = g;
        // spectators are always airborne, creative keeps whatever it had, and
        // everyone else falls out of the sky
        setFly(g === 3 ? true : g === 1 ? RT.fly : false);
        if (g === 3) { RT.dead = false; hideDeath(); }
        // the catalogue belongs to creative and the survival screen to everyone
        // else, so a mode change while one is open closes it rather than leaving
        // a survival player shopping from an infinite list
        if (RT.panel && (RT.panel.kind === 'creative') !== (g === 1)) closePanel(true);
        if (was !== g) { RT.digT = 0; RT.digAt = null; }   // a half-mined block re-times under new rules
        paintHudMode(); paintHotbar(); paintVitals(); paintXp();
    }
    function applyEffect(id, secs, amp) {
        var d = EFFECTS[id];
        if (d.instant) {   // instant health/damage resolve immediately and are never stored
            if (id === 'instant_health') { S.hp = Math.min(20, S.hp + 4 * (amp + 1)); paintVitals(); }
            else hurt(3 * (amp + 1), null, true, true, null, { m: 'magic' });
            return;
        }
        S.eff[id] = { amp: amp, t: secs >= 1000000 ? 1e9 : secs };
        RT.effDirty = true;
        paintEffects();
    }
    function remeshAround(x0, y0, z0, x1, y1, z1) {
        var seen = {};
        for (var x = x0 - 1; x <= x1 + 1; x += 8) for (var z = z0 - 1; z <= z1 + 1; z += 8) {
            var cx = Math.floor(x / CW), cz = Math.floor(z / CW), k = cx + ',' + cz;
            if (seen[k]) continue; seen[k] = 1;
            var c = RT.chunks[k];
            if (c) { relight(x, z); meshChunk(c); }
        }
    }

    /* ── the chat overlay ────────────────────────────────────
       ChatComponent, measured. Lines are nine GUI pixels; the newest sits with
       its bottom at H - 40 and its text four pixels in; each carries a black
       backdrop 332 wide at half the text's alpha (the default text background
       opacity). Closed, the last ten lines show, each fully opaque for nine
       seconds and fading over the tenth on a squared curve; open, the last
       twenty show at full strength and the wheel scrolls back through the rest.
       Messages wrap at 320. */
    var CHAT_W = 320;
    function chatSegs(m) {   // a message as coloured runs: the syntax-error context line is three
        if (m.u == null) return [{ t: m.t, c: m.c === 'err' ? '#ff5555' : m.c === 'dim' || m.c === 'mc-ctx' ? '#aaaaaa' : '#ffffff' }];   // eslint-disable-line
        return [{ t: m.t, c: '#aaaaaa' }, { t: m.u, c: '#ff5555', ul: 1 }, { t: '<--[HERE]', c: '#ff5555', it: 1 }];
    }
    function chatWrapped() {   // every message, split to the chat's width, oldest first
        var log = RT.chatLog || [], out = [];
        for (var i = 0; i < log.length; i++) {
            var m = log[i], segs = chatSegs(m);
            if (segs.length === 1) {
                var parts = mfWrap(segs[0].t, CHAT_W);
                for (var p = 0; p < parts.length; p++) out.push({ m: m, segs: [{ t: parts[p], c: segs[0].c }], key: i + ':' + p });
            } else out.push({ m: m, segs: segs, key: i + ':0' });
        }
        return out;
    }
    function chatFade(age) {   // ChatComponent.getTimeFactor, in seconds
        var d = (1 - age / CHAT_FADE) * 10;
        d = Math.max(0, Math.min(1, d));
        return d * d;
    }
    function paintChat() {
        if (!RT || !RT.el || !RT.gs) return;
        var wrap = RT.el.querySelector('.mc-chat');
        if (!wrap) return;
        var open = !!RT.chat, now = RT.now || 0, lines = chatWrapped(), max = open ? 20 : 10;
        if (!open) RT.chatScroll = 0;
        var scroll = Math.max(0, Math.min(RT.chatScroll || 0, Math.max(0, lines.length - max)));
        RT.chatScroll = scroll;
        var vis = [];
        for (var j = 0; j < max; j++) {
            var L = lines[lines.length - 1 - scroll - j];
            if (!L) break;
            if (!open && now - L.m.at >= CHAT_FADE) break;
            vis.push(L);
        }
        var log = wrap.querySelector('.mc-chatlog'), sig = open + '|' + RT.gh + '|' + vis.map(function (l) { return l.key; }).join(',');
        if (log._sig !== sig) {
            log._sig = sig;
            log.innerHTML = vis.map(function (L, j) { return [L, j]; }).reverse().map(function (Lj) {
                var L = Lj[0], j = Lj[1];
                var html = '', x = 4;
                L.segs.forEach(function (s) {
                    html += '<span class="mc-cseg' + (s.ul ? ' mc-cu' : s.it ? ' mc-chere' : '') + '" style="left:calc(var(--px) * ' + x + ')">' + mtHTML(s.t, s.c, (s.ul ? 'ul' : '') + (s.it ? ' it' : '')) + '</span>';
                    x += mfWidth(s.t) + 1;
                });
                // a system message (anything a player did not type) carries the grey tag bar down its left edge
                var tag = String(L.m.t).charAt(0) === '<' ? '' : '<i class="mc-ctag"></i>';
                return '<div class="mc-cline' + (L.m.c ? ' ' + L.m.c : '') + '" data-k="' + L.key + '" style="top:calc(var(--px) * ' + (RT.gh - 40 - (j + 1) * 9) + ')">' + tag + html + '</div>';
            }).join('');
        }
        wrap.classList.toggle('open', open);
        chatAlpha();
    }
    function chatAlpha() {   // per frame: only lines in their last second actually change
        var log = RT.el.querySelector('.mc-chatlog'), open = !!RT.chat, now = RT.now || 0;
        if (!log || !log.children.length) return;
        var byKey = {}, lines = chatWrapped();
        for (var i = 0; i < lines.length; i++) byKey[lines[i].key] = lines[i];
        for (var k = 0; k < log.children.length; k++) {
            var el = log.children[k], L = byKey[el.getAttribute('data-k')];
            var d = open || !L ? 1 : chatFade(now - L.m.at), a = Math.floor(255 * d);
            var op = a > 3 ? (a / 255).toFixed(3) : '0';
            if (el._op !== op) { el._op = op; el.style.setProperty('--ca', op); }
        }
    }
    /* The open chat line: a black bar at half alpha across the bottom, the text
       at (4, H - 10) in 0xE0E0E0 with commands coloured the way
       CommandSuggestions formats them — the command name and literals grey,
       arguments cycling aqua, yellow, green, light purple, gold, anything that
       does not parse red — and the EditBox cursor blinking every 300 ms: an
       underscore at the end of the text, a bar inside it. */
    var CMD_ARGC = ['#55ffff', '#ffff55', '#55ff55', '#ff55ff', '#ffaa00'];
    function chatInputSegs(v) {
        if (v.charAt(0) !== '/') return [{ t: v, c: '#e0e0e0' }];
        var out = [{ t: '/', c: '#aaaaaa' }], toks = v.slice(1).split(/( )/), cmd = null, ai = 0, lits = {};
        for (var i = 0; i < toks.length; i++) {
            var t = toks[i];
            if (t === ' ' || t === '') { if (t) out.push({ t: t, c: '#aaaaaa' }); continue; }
            if (!cmd) {
                cmd = CMDS[stripNs(t).toLowerCase()];
                var known = cmd && cmdAllowed(cmd);
                if (known && cmd.usage) String(cmd.usage).replace(/[<\[][^>\]]*[>\]]/g, ' ').split(/\s+/).forEach(function (w) { if (w && w.charAt(0) !== '/') lits[w] = 1; });
                out.push({ t: t, c: known ? '#aaaaaa' : '#ff5555' });
                if (!known) { out.push({ t: toks.slice(i + 1).join(''), c: '#ff5555' }); break; }
                continue;
            }
            if (lits[t]) out.push({ t: t, c: '#aaaaaa' });
            else { out.push({ t: t, c: CMD_ARGC[ai % CMD_ARGC.length] }); ai++; }
        }
        return out;
    }
    function paintChatInput() {
        var mir = RT.el.querySelector('.mc-chatmir'), inp = RT.el.querySelector('.mc-chatin');
        if (!mir || !inp || !RT.chat) return;
        var v = inp.value, segs = chatInputSegs(v), room = RT.gw - 8;
        // like the EditBox, keep the cursor in view: past the box's width, show the tail
        var caret = inp.selectionStart == null ? v.length : inp.selectionStart, skip = 0;
        while (skip < caret && mfWidth(v.slice(skip, caret)) > room - 6) skip++;
        var html = '', x = 0, at = 0;
        segs.forEach(function (s) {
            var t = s.t, a0 = at, a1 = at + t.length;
            at = a1;
            if (a1 <= skip) return;
            if (a0 < skip) t = t.slice(skip - a0);
            html += '<span class="mc-cseg" style="left:calc(var(--px) * ' + x + ')">' + mtHTML(t, s.c) + '</span>';
            x += mfWidth(t) + 1;
        });
        /* drawString hands back the x after the shadow, so the underscore sits two
           columns past the last glyph and the bar on the next glyph's first column */
        var cx = caret > skip ? mfWidth(v.slice(skip, caret)) + 1 : 0, blinkOn = (((performance.now() - (RT.chat.focusT || 0)) / 300) | 0) % 2 === 0;
        if (blinkOn) html += caret < v.length ? '<i class="mc-cbar" style="left:calc(var(--px) * ' + cx + ')"></i>'
                                            : '<span class="mc-cseg" style="left:calc(var(--px) * ' + (caret > skip ? cx + 1 : 0) + ')">' + mtHTML('_', '#e0e0e0') + '</span>';
        if (mir._html !== html) { mir._html = html; mir.innerHTML = html; }
    }
    function chatLayout() {
        var el = RT.el, W = RT.gw, H = RT.gh;
        var bar = el.querySelector('.mc-chatbar'), inp = el.querySelector('.mc-chatin'), mir = el.querySelector('.mc-chatmir');
        if (bar) { hudPlace(bar, 2, H - 14); bar.style.width = 'calc(var(--px) * ' + (W - 4) + ')'; }
        if (inp) { hudPlace(inp, 4, H - 12); inp.style.width = 'calc(var(--px) * ' + (W - 8) + ')'; }
        if (mir) hudPlace(mir, 4, H - 12);
    }
    function escHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function openChat(prefill) {
        if (!RT || RT.dead || RT.panel || RT.paused) return;
        // remember whether we were the one holding the pointer, so closing only
        // takes it back if opening gave it up
        RT.chat = { hist: RT.chatHist || [], hi: -1, draft: '', relock: !!document.pointerLockElement,
                    hits: [], si: -1, sstart: 0, usage: '', applied: false };
        RT.chatHist = RT.chat.hist;
        RT.chat.focusT = performance.now();
        RT.keys = {};                      // a held W must not keep walking while you type
        if (RT.mouse) RT.mouse.l = RT.mouse.r = false;   // nor a held button keep mining
        RT.digT = 0;
        unlockCursor();
        var wrap = RT.el.querySelector('.mc-chat');
        wrap.classList.add('open');
        var inp = wrap.querySelector('.mc-chatin');
        inp.value = prefill || '';
        inp.style.display = '';
        paintChat();
        // synchronously: the opening keydown is preventDefault'd, so no stray 't'
        // lands in the box, and a throttled timer can't leave the box unfocused
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
        refreshSug(false);          // typing "/" should already be offering commands
        chatLayout(); paintChatInput();
    }
    function closeChat(relock) {
        if (!RT || !RT.chat) return;
        var wasLocked = RT.chat.relock;
        RT.chat = null;
        var wrap = RT.el.querySelector('.mc-chat');
        if (wrap) {
            wrap.classList.remove('open');
            var inp = wrap.querySelector('.mc-chatin');
            inp.blur(); inp.value = '';
            var tabBox = wrap.querySelector('.mc-chattab');
            if (tabBox) { tabBox.textContent = ''; tabBox.style.display = 'none'; }
            var sug = wrap.querySelector('.mc-sug');
            if (sug) sug.style.display = 'none';
        }
        paintChat();
        if (relock && wasLocked && !RT.panel && !RT.paused && !RT.dead) {
            RT.el.focus();
            setTimeout(function () { lockCursor(); }, 30);
        }
    }
    /* ── run a line ──────────────────────────────────────── */
    function runChatLine(line) {
        line = String(line || '').trim();
        if (!line) return;
        RT.chatHist = RT.chatHist || [];
        if (RT.chatHist[RT.chatHist.length - 1] !== line) RT.chatHist.push(line);
        if (RT.chatHist.length > 60) RT.chatHist.shift();
        if (line[0] !== '/') { chatSay('<Steve> ' + line); return; }
        runCommand(line.slice(1), line);
    }
    /* Allow Cheats, off the Create New World screen. A world created with the
       switch off does not have the cheat commands — which is what vanilla looks
       like from the chat box, since the server never sends the client those
       nodes: no suggestions, no Tab, and "Unknown or incomplete command" if
       you type one anyway. Only an explicit false counts: worlds that predate
       the switch have no opinion and keep everything they had. Open to LAN
       with Allow Cheats: ON turns them on for the rest of the session, exactly
       as the real pause menu does. /help and /seed need no permission in a
       singleplayer world (SeedCommand is registered without one on the
       integrated server), so they stay. */
    function cheatsOn() { return !(S && S.cheats === false) || !!(RT && RT.lan && RT.lan.cheats); }
    function cmdAllowed(c) { return !!c && (c.free || cheatsOn()); }
    function cmdNames() { return Object.keys(CMDS).filter(function (n) { return cmdAllowed(CMDS[n]); }).sort(); }
    function runCommand(body, raw) {
        var rd = new Reader(body);
        var name = stripNs(rd.word()).toLowerCase();
        if (!name) return;
        var c = CMDS[name];
        if (!cmdAllowed(c)) { chatSyntax('Unknown or incomplete command, see below for error', body, 0); return; }
        try { c.run(rd, raw.slice(1)); }
        catch (e) { chatErr('An unexpected error occurred running that command'); }
    }
    /* ── live command suggestions ────────────────────────
       The real game does not sit and wait for Tab. It offers completions the
       moment you start typing, in a box anchored under the token you are on,
       with the command's usage line above it. Tab takes the highlighted entry
       and cycles through the rest; Shift-Tab walks back; a click takes one
       outright. The arrows are left alone — they belong to chat history. */
    var _measure = null;
    function textWidth(s, el) {
        if (!_measure) _measure = document.createElement('canvas').getContext('2d');
        var cs = getComputedStyle(el);
        _measure.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        return _measure.measureText(s).width;
    }
    /* What can follow what has been typed so far? Returns the candidate list,
       where the token being completed starts, and the usage line to show. */
    function suggestAt(text) {
        if (text.charAt(0) !== '/') return null;
        var body = text.slice(1), q, hits;
        if (body.indexOf(' ') < 0) {                    // still naming the command
            q = body.toLowerCase();
            hits = cmdNames().filter(function (n) { return n.indexOf(q) === 0; });
            return { hits: hits, start: 1, usage: hits.length === 1 ? CMDS[hits[0]].usage : null };
        }
        var parts = body.split(' ');
        var c = CMDS[stripNs(parts[0]).toLowerCase()];
        if (!cmdAllowed(c)) return null;   // a world without cheats is not offered arguments for them
        var cur = parts[parts.length - 1];
        q = cur.toLowerCase();
        var opts = (c.complete && c.complete(parts.length - 2)) || [];
        hits = opts.filter(function (o) { return o.toLowerCase().indexOf(q) === 0; }).sort();
        return { hits: hits, start: text.length - cur.length, usage: c.usage };
    }
    function refreshSug(keepSel) {
        if (!RT.chat) return;
        var inp = RT.el.querySelector('.mc-chatin');
        var s = suggestAt(inp.value);
        RT.chat.hits = (s && s.hits) || [];
        RT.chat.sstart = s ? s.start : 0;
        RT.chat.usage = (s && s.usage) || '';
        // a fresh keystroke highlights the first entry; cycling keeps its place
        if (!keepSel || RT.chat.si >= RT.chat.hits.length) RT.chat.si = RT.chat.hits.length ? 0 : -1;
        paintSug();
    }
    /* CommandSuggestions: the list sits right above the input, its bottom three
       pixels over it, starting under the token being completed. Rows are 12
       pixels on 0xD0000000; the text starts a pixel in, yellow for the
       selected entry and 0xAAAAAA for the rest; at most ten show, with a dotted
       edge when there are more. With nothing to offer it shows the command's
       usage instead, one line on the same black. */
    var SUG_ROWS = 10;
    function paintSug() {
        var box = RT.el.querySelector('.mc-sug');
        if (!box) return;
        var c = RT.chat, usage = box.querySelector('.mc-sugu'), list = box.querySelector('.mc-sugl');
        if (!c || (!c.hits.length && !c.usage)) { box.style.display = 'none'; list.innerHTML = ''; mtSet(usage.firstChild, ''); return; }
        box.style.display = '';
        var inp = RT.el.querySelector('.mc-chatin'), pre = inp.value.slice(0, c.sstart);
        var x = 4 + (pre ? mfWidth(pre) + 1 : 0), H = RT.gh;
        mtSet(usage.firstChild, c.usage || '', '#aaaaaa');
        usage.style.display = c.hits.length ? 'none' : '';
        if (!c.hits.length) {
            var uw = mfWidth(c.usage || '') + 1;
            hudPlace(usage, x - 1, H - 27);
            usage.style.width = 'calc(var(--px) * ' + (uw + 2) + ')';
            list.innerHTML = '';
            return;
        }
        var off = 0;
        if (c.si >= SUG_ROWS) off = c.si - SUG_ROWS + 1;
        if (off > c.hits.length - SUG_ROWS) off = Math.max(0, c.hits.length - SUG_ROWS);
        var rows = c.hits.slice(off, off + SUG_ROWS), wmax = 0;
        rows.forEach(function (h) { wmax = Math.max(wmax, mfWidth(h) + 1); });
        var y = H - 15 - rows.length * 12;
        list.innerHTML = rows.map(function (h, i) {
            var idx = off + i;
            return '<div class="mc-sugi' + (idx === c.si ? ' on' : '') + '" data-si="' + idx + '" style="top:calc(var(--px) * ' + (i * 12) + ')">' +
                mtHTML(h, idx === c.si ? '#ffff00' : '#aaaaaa') + '</div>';
        }).join('') + (off > 0 ? '<i class="mc-sugdots" style="top:0"></i>' : '') +
            (off + SUG_ROWS < c.hits.length ? '<i class="mc-sugdots" style="top:calc(var(--px) * ' + (rows.length * 12 - 1) + ')"></i>' : '');
        hudPlace(list, x - 1, y);
        list.style.width = 'calc(var(--px) * ' + (wmax + 1) + ')';
        list.style.height = 'calc(var(--px) * ' + (rows.length * 12) + ')';
    }
    /* Write candidate `i` over the token being completed.
       `freeze` keeps the candidate list exactly as it stands. That matters while
       cycling: once "/ga" has become "/gamemode", re-deriving the list from the
       new text collapses it to that one entry, and the next Tab has nothing left
       to walk to. The list stays anchored to what was typed until a real
       keystroke replaces it. */
    function applySug(i, freeze) {
        var c = RT.chat;
        if (!c || !c.hits.length) return false;
        i = Math.max(0, Math.min(c.hits.length - 1, i));
        var inp = RT.el.querySelector('.mc-chatin');
        // one hit means the argument is settled, so leave a space ready for the next
        var tail = c.hits.length === 1 ? ' ' : '';
        inp.value = inp.value.slice(0, c.sstart) + c.hits[i] + tail;
        inp.setSelectionRange(inp.value.length, inp.value.length);
        c.si = i;
        if (freeze) { paintSug(); return true; }
        // Unambiguous: move on and offer whatever comes next. That is a NEW list,
        // so the cycle is over — leaving the latch set made the following Tab step
        // past the entry it was visibly highlighting ("/gamem" Tab Tab handed you
        // `creative` while the box showed `adventure`).
        var was = c.hits[i];
        refreshSug(false);
        var at = c.hits.indexOf(was);
        if (at >= 0) c.si = at;
        c.applied = false;
        paintSug();
        return true;
    }
    function cycleSug(dir) {
        var c = RT.chat;
        if (!c || !c.hits.length) return false;
        // the first Tab takes what is already highlighted; the next ones walk on
        var n = c.hits.length;
        var i = c.applied ? ((c.si + dir) % n + n) % n : Math.max(0, c.si);
        c.applied = true;
        return applySug(i, n > 1);
    }
    /* ── tab completion ──────────────────────────────────── */
    function tabComplete(text) {
        // completing the command name itself
        if (text[0] !== '/') return null;
        var body = text.slice(1);
        if (body.indexOf(' ') < 0) {
            var hits = cmdNames().filter(function (n) { return n.indexOf(body.toLowerCase()) === 0; });
            if (!hits.length) return null;
            return { text: '/' + commonPrefix(hits, body.length) + (hits.length === 1 ? ' ' : ''), hits: hits };
        }
        // completing an argument: which one are we on?
        var parts = body.split(' ');
        var cname = stripNs(parts[0]).toLowerCase();
        var c = CMDS[cname];
        if (!cmdAllowed(c) || !c.complete) return null;
        var argIdx = parts.length - 2;
        var cur = parts[parts.length - 1];
        var opts = c.complete(argIdx) || [];
        var m = opts.filter(function (o) { return o.toLowerCase().indexOf(cur.toLowerCase()) === 0; }).sort();
        if (!m.length) return null;
        parts[parts.length - 1] = commonPrefix(m, cur.length);
        return { text: '/' + parts.join(' ') + (m.length === 1 ? ' ' : ''), hits: m };
    }
    function commonPrefix(list, from) {
        if (list.length === 1) return list[0];
        var p = list[0];
        for (var i = 1; i < list.length; i++) {
            var j = 0;
            while (j < p.length && j < list[i].length && p[j].toLowerCase() === list[i][j].toLowerCase()) j++;
            p = p.slice(0, j);
        }
        return p.length >= from ? p : list[0].slice(0, from);
    }
    /* ── active-effect HUD ─────────────────────────────────
       Gui.renderEffects: a 24×24 frame per effect in the top-right corner,
       beneficial ones along the top (y = 1) and harmful ones on a row below
       (y = 27), each 25 pixels left of the last. The 18×18 icon sits three in
       and, in the last ten seconds, pulses on the game's formula. Names and
       times are not on the HUD at all; they are the inventory screen's. */
    var EFF_BAD = { slowness: 1, mining_fatigue: 1, instant_damage: 1, weakness: 1, poison: 1, wither: 1, hunger: 1, nausea: 1, blindness: 1, levitation: 1, darkness: 1 };
    function paintEffects() {
        if (!RT || !RT.el || !RT.gs) return;
        var box = RT.el.querySelector('.mc-effects');
        if (!box) return;
        var ids = Object.keys(S.eff || {}).filter(function (id) { return EFFECTS[id] && !EFFECTS[id].instant; });
        box.style.display = ids.length && !RT.panel ? '' : 'none';
        var kids = hudIcons(box, ids.length), good = 0, bad = 0;
        ids.sort().reverse();
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i], e = S.eff[id], neg = !!EFF_BAD[id], n = neg ? ++bad : ++good;
            var el = kids[i];
            if (!el.firstChild) el.innerHTML = '<b></b>';
            el.className = 'mc-eff' + (e.amb ? ' amb' : '');
            el.firstChild.style.backgroundImage = 'var(--spr-eff_' + id + ')';
            hudPlace(el, RT.gw - 25 * n, neg ? 27 : 1);
            var f = 1, tk = e.t * 20;
            if (!e.amb && tk <= 200 && e.t < 1e8) {
                var j1 = 10 - tk / 20;
                f = Math.max(0, Math.min(0.5, tk / 10 / 5 * 0.5)) + Math.cos(tk * Math.PI / 5) * Math.max(0, Math.min(0.25, j1 / 10 * 0.25));
            }
            el.firstChild.style.opacity = f.toFixed(3);
        }
    }
    function fmtTimeLeft(s) {
        s = Math.max(0, Math.ceil(s));
        var m = Math.floor(s / 60);
        return m + ':' + ('0' + (s % 60)).slice(-2);
    }

    function init(el, opts) {
        var root = el.querySelector('.mc');
        /* The launcher has been passing { version, installation, skin } since
           it was written; nothing ever read it. The title screen puts the
           version it was launched with in the bottom-left corner, which is
           where the game puts it. */
        var launched = (opts && opts.version) || null;
        optLoad();
        S = sLoad() || sNew();
        if (!S.inv.length) {
            S.inv = new Array(36).fill(null);
        }
        // migrate saves from before the expansion
        if (!S.armor) S.armor = [null, null, null, null];
        if (S.xpl == null) { S.xpl = 0; S.xp = 0; }
        if (S.weather == null) { S.weather = 0; S.wt = 120; }
        // saves from before the command console predate all of this
        var devModes = devPre();   // ?mcdev= swaps in a fresh scenario world before anything reads S
        // AFTER devPre: a scenario world replaces S wholesale, so migrating first
        // left the fresh save holding sNew()'s nulls and /gamerule threw on assign
        normalizeCmdState();
        buildAtlas();
        texInit();
        mfWebFont();
        guiSprites();
        if (!document.getElementById('mc-atlas-css')) {   // HUD icons sample the atlas via CSS
            var st = document.createElement('style');
            st.id = 'mc-atlas-css';
            st.textContent = '.mc-ico{background-image:url(' + ATLAS.toDataURL() + ')}';
            document.head.appendChild(st);
        }
        var cv = root.querySelector('.mc-cv');
        var G = glInit(cv);
        if (!G) { root.innerHTML = '<p style="padding:24px">WebGL fell out of the world. (This machine refused a 3D context.)</p>'; return; }
        RT = {
            el: root, cv: cv, G: G,
            chunks: {}, ckeys: [], genQ: [], meshQ: [], decayQ: [],
            foes: [], dying: [], drops: [], arrows: [], tnts: [], parts: [], entV: [], orbs: [],
            keys: {}, mouse: { l: false, r: false },
            chat: null, chatLog: [], chatHist: [], now: 0, fly: !!S.fly && (S.gm === 1 || S.gm === 3),
            vy: 0, ground: false, fallY: S.py, sprint: false, fovM: 1,
            exh: 0, regenT: 0, starveT: 0, iframe: 0, digT: 0, digCd: 0, digNeed: 1, digAt: null, atkCd: 0,
            eatT: 0, bowT: 0, swing: 0, swingT: SWING_T, equip: 0, equipId: null, bob: 0, flash: 0, shake: 0, sleep: 0, placeCd: 0,
            target: null, panel: null, cur: null, craft: [null, null, null, null, null, null, null, null, null], craftW: 2,
            cTab: 0, cScroll: 0, cSearch: '', cList: [], cDrag: 0, panelDirty: 0,
            qc: null, lastClk: null, av: null, skin: (opts && opts.skin) || null,   // drag-split state, the inventory figure, the launcher's skin
            lan: null, lanUI: null,                                                  // Open to LAN: the published session, and the screen while it is up
            hover: null,                                                             // the panel slot under the pointer
            paused: false, dead: S.hp <= 0, ready: false, lit: false, expectUnlock: false,
            worldMs: 0, playT: 0, baseHrs: S.hrs || 0, lastT: 0, secT: 0, hudT: 0, saveT: 0,
            fps: 0, fpsN: 0, fpsT: 0, f3: false, musT: 25, tipTk: 0, tipKey: null, devFree: !!devModes, raf: 0, timers: [],
            gs: 0, gw: 0, gh: 0, hudTk: 0, hudTickT: 0, pops: [0, 0, 0, 0, 0, 0, 0, 0, 0],
            built: false, ver: launched || '26.2', inst: (opts && opts.installation) || null
        };
        buildSkyGeo(G);
        if (S.hp <= 0) {   // died mid-save: respawn silently at the last bed/world spawn (and clear the dead flag, or input stays frozen all session)
            S.hp = 20; S.food = 20; S.sat = 5; S.air = 10;
            RT.dead = false;
            var dsp = S.spawn || S.wspawn;
            if (dsp) { S.px = dsp[0]; S.py = dsp[1]; S.pz = dsp[2]; RT.fallY = dsp[1]; }
        }
        if (devModes) devPost(devModes);
        /* Normally the launcher hands over to the title screen and the world
           waits behind it. A ?mcdev= run is a scenario: it has already chosen
           the world it wants and every headless capture in .claude/comp-tools
           expects to arrive in it, so those skip the menu entirely. */
        if (!devModes) {
            wsIndex();                       // adopts a pre-world-list save before anything else reads one
            wsSyncFS();
            S = mnPanoSave();
        } else loadShow(true);
        // fresh world: starting position + a bootstrapping run of chunks
        if (!S.wspawn) {
            S.wspawn = findSpawn();
            S.px = S.wspawn[0]; S.py = S.wspawn[1]; S.pz = S.wspawn[2];
        }
        ensureChunks();
        sizeCanvas();
        guiResize();
        RT.ro = new ResizeObserver(function () { sizeCanvas(); guiResize(); if (RT && RT.menu) mnSize(RT.menu); });
        RT.ro.observe(root);
        if (!devModes) mnOpen('loading');
        wireInput(root, cv);
        RT.raf = requestAnimationFrame(frame);
        // rAF starves in hidden/background tabs; a slow heartbeat keeps furnaces (and boots) alive
        RT.timers.push(setInterval(function () {
            if (RT && performance.now() - (RT.wall || 0) > 350) frame(performance.now());
        }, 250));
    }
    function sizeCanvas() {
        if (!RT) return;
        var w = RT.el.clientWidth || 960, h = RT.el.clientHeight || 560;
        RT.cv.width = Math.max(160, Math.round(w / 3));
        RT.cv.height = Math.max(100, Math.round(h / 3));
    }
    function wireInput(root, cv) {
        /* the chat input owns its own keys: Enter runs, Esc closes, Tab
           completes, Up/Down walk the history. Everything stops here so a
           command never leaks a keystroke into the world. */
        var chatIn = root.querySelector('.mc-chatin');
        if (chatIn) {
            chatIn.addEventListener('keydown', function (e) {
                e.stopPropagation();
                var c = RT && RT.chat;
                if (e.key === 'Enter') {
                    var line = chatIn.value;
                    closeChat(true);
                    runChatLine(line);
                    e.preventDefault();
                    return;
                }
                if (e.key === 'Escape') { closeChat(true); e.preventDefault(); return; }
                if (e.key === 'Tab') {
                    // Tab takes the highlighted suggestion, then walks the rest of
                    // the list; Shift-Tab walks back. Same as the real game.
                    e.preventDefault();
                    cycleSug(e.shiftKey ? -1 : 1);
                    return;
                }
                if (!c) return;
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    // the arrows stay with chat history — the suggestion list is
                    // Tab's and the mouse's, exactly as the real game divides them
                    e.preventDefault();
                    var h = RT.chatHist || [];
                    if (!h.length) return;
                    if (c.hi < 0) c.draft = chatIn.value;
                    c.hi += e.key === 'ArrowUp' ? 1 : -1;
                    if (c.hi >= h.length) c.hi = h.length - 1;
                    if (c.hi < 0) { c.hi = -1; chatIn.value = c.draft || ''; }
                    else chatIn.value = h[h.length - 1 - c.hi];
                    chatIn.setSelectionRange(chatIn.value.length, chatIn.value.length);
                    c.applied = false;
                    refreshSug(false);
                }
            });
            chatIn.addEventListener('keyup', function (e) { e.stopPropagation(); });
            chatIn.addEventListener('input', function () {
                var tabBox = root.querySelector('.mc-chattab');
                if (tabBox) { tabBox.textContent = ''; tabBox.style.display = 'none'; }
                // a real keystroke ends any Tab-cycle in progress and re-offers
                if (RT.chat) { RT.chat.applied = false; refreshSug(false); }
            });
            var sugBox = root.querySelector('.mc-sug');
            if (sugBox) {
                // mousedown here would pull focus out of the input, and the blur
                // handler would shut the chat before the click ever landed
                sugBox.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
                sugBox.addEventListener('click', function (e) {
                    var el = e.target;
                    while (el && el !== sugBox && (!el.getAttribute || el.getAttribute('data-si') == null)) el = el.parentNode;
                    if (!el || el === sugBox) return;
                    applySug(el.getAttribute('data-si') | 0);
                    if (RT.chat) RT.chat.applied = true;   // a following Tab moves on rather than re-picking
                    chatIn.focus();
                    e.stopPropagation();
                });
            }
            chatIn.addEventListener('blur', function (e) {
                if (!(RT && RT.chat)) return;
                // alt-tabbing away must not throw away a half-typed command
                if (!document.hasFocus()) return;
                // focus that stayed inside the game (a stray focus(), the canvas)
                // belongs back in the box; focus that left it means the player
                // moved on to another window, so drop the chat without relocking
                var to = e.relatedTarget;
                if (to && RT.el && RT.el.contains(to)) { chatIn.focus(); return; }
                closeChat(false);
            });
        }
        root.addEventListener('keydown', function (e) {
            /* While a menu is up there is no world to drive. Several branches
               below (movement, q, F3, the double-tap flags) never check for
               one, so the whole handler stands down rather than each of them. */
            if (RT.menu) { e.stopPropagation(); return; }
            var k = e.key.toLowerCase();
            if (e.key === 'Escape') {
                if (RT.chat) { closeChat(true); e.stopPropagation(); e.preventDefault(); }
                else if (RT.panel) { rbEscape(); e.stopPropagation(); }
                else if (RT.sleep && !RT.woke && !RT.paused && !RT.dead) { leaveBed(); e.stopPropagation(); e.preventDefault(); }
                // a screen behind the Game Menu backs out to it, not to the world; the death screens ignore Escape
                else if (RT.iw && RT.iw.scr !== 'pause') { var iwd = IW_SCR[RT.iw.scr]; if (iwd.esc) iwd.esc(); e.stopPropagation(); e.preventDefault(); }
                else if (RT.paused && RT.ready) {
                    // don't hide the menu on hope: Chrome refuses relocks for ~1.3s after an Esc exit.
                    // onLockChange dismisses the menu when the lock actually lands; a rejection keeps it up.
                    audioInit();
                    lockCursor();
                    e.stopPropagation();
                }
                return;   // otherwise it belongs to the desktop
            }
            // OS auto-repeat must not double-tap sprint or toggle panels ("you can never just walk")
            if (e.repeat) {
                if (k === ' ') e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (RT.chat) {
                // the chat input owns the keyboard. if focus drifted (alt-tab and
                // back, a stray focus()) take it back rather than swallowing keys
                // into a box the player can't see themselves typing in
                var ci = RT.el.querySelector('.mc-chatin');
                if (ci && document.activeElement !== ci) ci.focus();
                e.stopPropagation();
                return;
            }
            // with the recipe book open the chat key goes to its search box (RecipeBookComponent.keyPressed)
            if (k === 't' && RT.panel && rbShown()) {
                var rbq = RT.el.querySelector('.mc-rbqin');
                if (rbq && document.activeElement !== rbq) { rbq.focus(); rbq._ft = performance.now(); e.preventDefault(); e.stopPropagation(); return; }
            }
            // over the catalogue the chat key does what the real screen's does: it goes to Search
            if ((k === 't' || k === '/') && RT.panel && RT.panel.kind === 'creative' && (CTABS[RT.cTab] || CTABS[0]).id !== 'search') {
                creativeTab(7); e.preventDefault(); e.stopPropagation(); return;
            }
            if ((k === 't' || k === '/') && RT.ready && !RT.dead && !RT.panel && !RT.paused) {
                openChat(k === '/' ? '/' : '');
                e.preventDefault(); e.stopPropagation();
                return;
            }
            RT.keys[k] = true;
            // sprint is double-tap W only — holding real Ctrl arms Ctrl+W (closes the tab!).
            // The window is the game's own 7 ticks; at 280ms an honest double tap
            // fell through it and you just walked, with nothing to say why
            if (k === 'w' && RT.lastW && performance.now() - RT.lastW < FLY_TAP) { RT.sprint = true; RT.lastW = 0; }
            else if (k === 'w') RT.lastW = performance.now();
            // every other action key is gated; this one wasn't, so idly double-tapping
            // Space with a screen up toggled flight behind it
            if (k === ' ' && mayFly() && !RT.panel && !RT.paused && !RT.dead) {
                // the real game clears the double-tap window the moment it fires, so a
                // third quick tap opens a fresh one instead of toggling straight back —
                // without that, mashing Space makes flight flicker on and off
                if (RT.lastSp && performance.now() - RT.lastSp < FLY_TAP) { setFly(!RT.fly); RT.lastSp = 0; }
                else RT.lastSp = performance.now();
            }
            if (k === ' ') e.preventDefault();
            if (k === 'e' && RT.ready && !RT.dead && !RT.paused) {
                /* preventDefault, because openPanel focuses the Search box synchronously
                   and the browser then typed this very keystroke into it: reopening on
                   the Search tab left an "e" in the box and a catalogue filtered on it */
                e.preventDefault();
                if (RT.panel) closePanel(); else openPanel(isCreative() ? 'creative' : 'inv');
            }
            if (k === 'q' && RT.panel && RT.hover && !RT.cur && !RT.paused && !RT.dead) { hoverThrow(!!e.ctrlKey); e.preventDefault(); }
            // F: over a slot it trades that slot with the off hand; in the world it swaps your hands
            if (k === 'f' && RT.panel && RT.hover && !RT.cur && !RT.paused && !RT.dead) { hoverSwap(40); e.preventDefault(); }
            else if (k === 'f' && RT.ready && !RT.panel && !RT.paused && !RT.dead && !isSpectator()) {
                var mh = S.inv[S.sel] || null;
                S.inv[S.sel] = S.off || null; S.off = mh;
                paintHotbar();
            }   // Q over a slot throws from it; Ctrl-Q the whole stack — never while carrying
            if (k === 'q' && !RT.panel && !RT.paused && !RT.dead) {
                var h = held();
                if (h) {
                    swingArm(true);   // dropping swings the arm
                    tossItem(h, 1);   // the enchantments and the name go with it, as they should
                    h.c--; if (!h.c) S.inv[S.sel] = null;
                    paintHotbar();
                }
            }
            if (e.key === 'F3') { RT.f3 = !RT.f3; paintDebug(); e.preventDefault(); }
            if (k === 'l' && RT.ready && !RT.dead && !RT.panel && !RT.paused && !RT.chat) {
                RT.paused = true; unlockCursor(); sSave();
                iwShow('adv', { fromKey: true });
                e.preventDefault();
            }
            var n = parseInt(e.key, 10);
            // ungated, these silently changed what you were holding from behind a
            // chest, the pause menu, the death screen and the loading screen
            if (n >= 1 && n <= 9 && RT.ready && !RT.panel && !RT.paused && !RT.dead) {
                // creative's C or X held with a number saves the hotbar there or loads it back
                if (isCreative() && (RT.keys.x || RT.keys.c)) hotbarLoadOrSave(n - 1, !!RT.keys.x);
                else { S.sel = n - 1; paintHotbar(); }
            }
            if (n >= 1 && n <= 9 && RT.panel && RT.hover && !RT.cur && !RT.paused && !RT.dead) { hoverSwap(n - 1); e.preventDefault(); }   // a number over a slot swaps it into that hotbar slot, cursor empty
            e.stopPropagation();
        });
        root.addEventListener('keyup', function (e) {
            RT.keys[e.key.toLowerCase()] = false;
            e.stopPropagation();
        });
        // the window closing blurs the root AFTER close() has dropped RT
        root.addEventListener('blur', function () { if (!RT) return; RT.keys = {}; RT.mouse.l = RT.mouse.r = false; });
        cv.addEventListener('mousedown', function (e) {
            audioInit();
            // with chat open the world is inert: no swinging, no relock, and the
            // click must not pull focus out of the box you're typing in
            if (RT.chat) { e.preventDefault(); return; }
            root.focus();
            if (!RT.ready || RT.dead) return;
            if (!document.pointerLockElement && !RT.devFree) {
                if (!RT.panel && !RT.paused && !(RT.sleep && !RT.woke)) lockCursor();
                return;
            }
            if (e.button === 0) { RT.mouse.l = true; attack(); creativeInstaBreak(); }
            if (e.button === 1) pickBlock();
            if (e.button === 2) { RT.mouse.r = true; RT.placeCd = 0.3; tryUse(); }
            e.preventDefault();
        });
        // middle-click otherwise pastes on Linux and auto-scrolls on Windows
        cv.addEventListener('auxclick', function (e) { if (e.button === 1) e.preventDefault(); });
        cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        /* Miss a slot by a few pixels while splitting a stack — the title, a label,
           the gap between grids, the backdrop — and Chrome's own Back/Reload menu
           opened over the game. The pause and death screens had no handler at all.
           Text boxes keep their native paste menu. */
        root.addEventListener('contextmenu', function (e) {
            if (e.target && e.target.closest && e.target.closest('input, textarea')) return;
            e.preventDefault();
        });
        window.addEventListener('mouseup', RT.mup = function (e) {
            if (!RT) return;
            RT.cDrag = 0;
            if (RT.qc) qcEnd(e);   // a drag-split lands on the release, wherever the pointer is by then
            // a release that leaves the cursor empty ends the double-click window, as the real one does
            if (RT.panel && !RT.cur && RT.lastClk) RT.lastClk.t = 0;
            if (e.button === 0) { RT.mouse.l = false; RT.digT = 0; }
            if (e.button === 2) { RT.mouse.r = false; finishUse(); }
        });
        document.addEventListener('mousemove', RT.mmv = function (e) {
            if (!RT || document.pointerLockElement !== cv) return;
            S.yaw += (e.movementX || 0) * 0.0026;
            S.pitch += (e.movementY || 0) * 0.0026;
            var lim = Math.PI / 2 - 0.01;
            if (S.pitch > lim) S.pitch = lim;
            if (S.pitch < -lim) S.pitch = -lim;
        });
        document.addEventListener('pointerlockchange', RT.plc = onLockChange);
        document.addEventListener('pointerlockerror', RT.ple = lockFailed);
        // menu buttons must not steal focus from the game root on mousedown (click still fires)
        var btns = root.querySelectorAll('.mc-btn');
        for (var bi = 0; bi < btns.length; bi++) btns[bi].addEventListener('mousedown', function (e) { e.preventDefault(); });
        root.addEventListener('wheel', function (e) {
            // over the creative catalogue the wheel scrolls the list, not the hotbar
            if (RT.panel && RT.panel.kind === 'creative') { creativeScroll(e.deltaY > 0 ? 1 : -1); e.preventDefault(); return; }
            // open chat: the wheel walks back through what scrolled off, a line a notch
            if (RT.chat) { RT.chatScroll = Math.max(0, (RT.chatScroll || 0) + (e.deltaY < 0 ? 1 : -1)); paintChat(); e.preventDefault(); return; }
            if (RT.panel || RT.paused) return;
            S.sel = ((S.sel + (e.deltaY > 0 ? 1 : -1)) % 9 + 9) % 9;
            paintHotbar();
            e.preventDefault();
        }, { passive: false });
        // the in-world screens' widgets, and the bed's one button
        iwWire(root.querySelector('.mc-pause'));
        iwWire(root.querySelector('.mc-death'));
        var bedEl = root.querySelector('.mc-bed');
        bedEl.addEventListener('mousedown', function (e) { if (e.target.closest && e.target.closest('.mc-wb')) { audioInit(); snd('click'); } e.preventDefault(); e.stopPropagation(); });
        bedEl.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.mc-wb')) { if (!e.detail) snd('click'); leaveBed(); e.stopPropagation(); } });
        setTimeout(function () { root.focus(); }, 30);
    }

    /* ── dev hooks (headless screenshots, scenario seeds) ───── */
    function devPre() {
        var q = location.search;
        var m = q.match(/mcdev=([a-z,]+)/);
        if (!m) return null;
        var modes = m[1].split(',');
        if (modes.indexOf('load') >= 0) return modes;   // keep the persisted save; just enable the driver + devFree
        var sm = q.match(/mcseed=(\d+)/);
        S = sNew();
        S.seed = sm ? sm[1] | 0 : 1337;
        S.inv = new Array(36).fill(null);
        function has(x) { return modes.indexOf(x) >= 0; }
        if (has('night')) S.t = DAY_MS + NIGHT_MS * 0.35;
        if (has('dusk')) S.t = DAY_MS * 0.97;
        if (has('creative')) { S.gm = 1; S.fly = true; }
        if (has('kit')) {
            invGive('diamond_pick', 1); invGive('diamond_sword', 1); invGive('diamond_axe', 1);
            invGive('iron_shovel', 1); invGive('wood_hoe', 1); invGive('bow', 1); invGive('arrow', 32);
            invGive('torch', 64); invGive('table', 1); invGive('furnace', 1); invGive('chest', 1);
            invGive('cobble', 64); invGive('planks', 64); invGive('log', 16); invGive('ore_iron', 8);
            invGive('coal', 16); invGive('bread', 8); invGive('tnt', 4); invGive('bed', 1);
            invGive('wool', 8); invGive('seeds', 8); invGive('bonemeal', 12);
            // expansion kit — wear the diamond armour, stock the rest
            S.armor = [{ id: 'diamond_helm', c: 1, dur: itemMaxDur('diamond_helm') }, { id: 'diamond_chest', c: 1, dur: itemMaxDur('diamond_chest') },
                { id: 'diamond_legs', c: 1, dur: itemMaxDur('diamond_legs') }, { id: 'diamond_boots', c: 1, dur: itemMaxDur('diamond_boots') }];
            invGive('etable', 1); invGive('anvil', 1); invGive('bookshelf', 15); invGive('lapis', 32);
            invGive('diamond', 16); invGive('gold', 24); invGive('obsidian', 10);
            invGive('bucket', 3); invGive('carrot', 8); invGive('potato', 8);
            invGive('seeds_pumpkin', 4); invGive('sugarcane', 8); invGive('golden_apple', 3);
            invGive('cake', 1); invGive('ladder', 16); invGive('flint_steel', 1); invGive('ench_book', 1);
            S.xpl = 30;
        }
        return modes;
    }
    function devPost(modes) {
        function has(x) { return modes.indexOf(x) >= 0; }
        var lk = location.search.match(/mclook=(-?[\d.]+)x(-?[\d.]+)/);
        if (lk) { S.yaw = +lk[1]; S.pitch = +lk[2]; }
        var onReady = [];
        if (has('inv')) onReady.push(function () { openPanel('inv'); });
        // ?mccur=<item> parks a stack on the mouse cursor, so the carried-item
        // ghost can be seen in a headless screenshot
        if (/mccur=/.test(location.search)) onReady.push(function () {
            var m = location.search.match(/mccur=([a-z_]+)/);
            if (!m || !I[m[1]]) return;
            RT.cur = { id: m[1], c: stkMax(m[1]) };
            RT.curXY = [window.innerWidth * 0.52, window.innerHeight * 0.42];
            paintPanel();
        });
        if (has('creative')) onReady.push(function () {
            var ct = location.search.match(/mctab=(\d+)/);
            if (ct) RT.cTab = ct[1] | 0;
            openPanel('creative');
        });
        if (has('table')) onReady.push(function () {
            var x = Math.floor(S.px) + 1, y = Math.floor(S.py), z = Math.floor(S.pz) - 2;
            setB(x, y, z, TABLE);
            openPanel('table');
            RT.craft[0] = { id: 'planks', c: 8 }; RT.craft[1] = { id: 'planks', c: 8 };
            RT.craft[3] = { id: 'planks', c: 8 }; RT.craft[4] = { id: 'planks', c: 8 };
            paintPanel();
        });
        if (has('furn')) onReady.push(function () {
            var x = Math.floor(S.px) + 1, y = Math.floor(S.py), z = Math.floor(S.pz) - 2;
            setB(x, y, z, FURN);
            var t = tentAt(x, y, z, 'furnace');
            t.fin = { id: 'ore_iron', c: 3 }; t.fuel = { id: 'coal', c: 5 }; t.out = { id: 'iron', c: 2 };
            t.burn = 40; t.burnMax = 80; t.prog = 6;
            openPanel('furnace', { x: x, y: y, z: z });
        });
        if (has('pause')) onReady.push(function () { showPause(); });
        if (has('ench')) onReady.push(function () {
            var x = Math.floor(S.px) + 1, y = Math.floor(S.py), z = Math.floor(S.pz) - 2;
            setB(x, y, z, ETABLE); for (var s = -2; s <= 2; s++) { setB(x + s, y, z - 2, BOOKSHELF); setB(x + s, y, z + 2, BOOKSHELF); }
            openPanel('ench', { x: x, y: y, z: z });
            RT.enchItem = { id: 'diamond_pick', c: 1, dur: itemMaxDur('diamond_pick') }; RT.enchLapis = { id: 'lapis', c: 3 }; genEnchOptions(); paintPanel();
        });
        if (has('anvil')) onReady.push(function () {
            var x = Math.floor(S.px) + 1, y = Math.floor(S.py), z = Math.floor(S.pz) - 2;
            setB(x, y, z, ANVIL); openPanel('anvil', { x: x, y: y, z: z });
            RT.anvilA = { id: 'diamond_sword', c: 1, dur: 800, ench: { sharp: 2 } }; RT.anvilName = 'Doom'; paintPanel();
        });
        if (onReady.length) RT.onReady = function () { for (var i = 0; i < onReady.length; i++) onReady[i](); };
        window.__mc = {
            step: function (ms) { frame((RT.lastT || performance.now()) + (ms || 16.7)); },
            /* Audio QC. Nothing in the sound engine is observable from a
               screenshot and half of it never fires without a mob or a
               thunderstorm, so the harness gets a way to ring every bell
               directly and a way to read back the graph it built. */
            _snd: function (n, a, x, y, z) { audioInit(); snd(n, a, x, y, z); },
            _amb: function (dt) { audioInit(); ambienceTick(dt || 0.05); },
            _mus: function (skip) { audioInit(); if (skip) musStop(); playMusic(); },   // skip: cut the current piece first
            _ac: function () { return AC; },
            _mats: function () { var o = {}; for (var k in MATOF) o[k] = MATOF[k]; return o; },
            // every sample that starts from here on (true), read it back (no argument), or stop logging (false)
            _sndlog: function (on) { if (on) SLOG = []; var l = SLOG; if (on === false) SLOG = null; return l; },
            // every path any table here can ask for, so a check can hold them against what shipped
            _sndPaths: function () {
                var o = {}, k, j;
                // the args each argument-dependent event is actually called with
                var PROBE = { fall: [2, 6], splash: [8, 40], equip: ARM_TIERS };
                function add(v) { if (typeof v === 'string') o[v] = 1; else if (v && v.length) for (var i = 0; i < v.length; i++) add(v[i]); }
                for (k in MAT) add([MAT[k].brk, MAT[k].place, MAT[k].step]);
                for (k in MOBSND) for (j in MOBSND[k]) if (j !== 'v') add(MOBSND[k][j]);
                for (k in SFX) {
                    var f = SFX[k].f;
                    if (typeof f !== 'function') add(f);
                    else (PROBE[k] || [0]).forEach(function (a) { add(f(a)); });
                }
                add('ambient/underwater/underwater_ambience');
                for (k in MUSIC) add(MUSIC[k]);
                return Object.keys(o).sort();
            },
            // what the sample loader holds, and what the soundtrack is doing
            _sounds: function () {
                var n = 0, wait = 0, bad = [];
                for (var k in SB) if (Object.prototype.hasOwnProperty.call(SB, k)) { if (SB[k] === false) bad.push(k); else if (SB[k].then) wait++; else n++; }
                return { base: SND_BASE, manifest: !!SMAN, skip: SSKIP, loaded: n, pending: wait, failed: bad, voices: VQ.length,
                    music: MUS ? { cur: MUS.cur, kind: MUS.kind, paused: MUS.el.paused, t: MUS.el.currentTime } : null };
            },
            dbg: function () { return { target: RT.target, digT: RT.digT, digNeed: RT.digNeed, mouseL: RT.mouse.l, paused: RT.paused, panel: !!RT.panel, dead: RT.dead, yaw: S.yaw, pitch: S.pitch, sprint: RT.sprint, fly: RT.fly, fovM: RT.fovM, parts: RT.parts.length }; },
            state: function () {
                return { ready: RT.ready, px: S.px, py: S.py, pz: S.pz, chunks: RT.ckeys.length,
                    foes: RT.foes.length, drops: RT.drops.length, orbs: RT.orbs.length, hp: S.hp, food: S.food,
                    sel: S.sel, inv: S.inv.filter(Boolean).length, ach: S.achN, seed: S.seed,
                    xpl: S.xpl, xp: S.xp, weather: S.weather, armorN: S.armor.filter(Boolean).length, armorPts: armorPoints() };
            },
            equipAll: function () { for (var i = 0; i < 36; i++) { var s = S.inv[i]; if (s && I[s.id] && I[s.id].armor && !S.armor[I[s.id].armor.slot]) { S.armor[I[s.id].armor.slot] = s; S.inv[i] = null; } } paintVitals(); paintHotbar(); },
            heldEnch: function () { var h = held(); return h ? (h.ench || null) : null; },
            _ench: function (id) { RT.panel = { kind: 'ench', key: null }; RT.enchItem = { id: id, c: 1, dur: itemMaxDur(id) }; RT.enchLapis = { id: 'lapis', c: 3 }; RT.enchSeed = (Math.random() * 1e9) | 0; genEnchOptions(); return (RT.enchOpts || []).map(function (o) { return o.label + ' (L' + o.level + ', ' + o.lapis + ' lapis)'; }); },
            _enchApply: function (i) { applyEnchOption(i); var it = RT.enchItem; RT.panel = null; return it ? { id: it.id, ench: it.ench } : null; },
            _anvil: function (a, b, name) { RT.panel = { kind: 'anvil', key: null }; RT.anvilA = a; RT.anvilB = b; RT.anvilName = name || ''; var r = anvilResult(); RT.panel = null; return r ? { outDur: r.out.dur, outEnch: r.out.ench, outName: r.out.name, cost: r.cost } : null; },
            look: function (yaw, pitch) { S.yaw = yaw; S.pitch = pitch; },
            tp: function (x, y, z) { S.px = x; S.py = y; S.pz = z; RT.fallY = y; ensureChunks(); },
            give: function (id, n, e) { invGive(id, n || 1, undefined, e); paintHotbar(); },
            sel: function (i) { S.sel = i; paintHotbar(); },
            time: function (t) { S.t = t; },
            weather: function (w) { S.weather = w; S.wt = 300; },
            addXp: function (a) { spawnXp(S.px, S.py, S.pz, a); },
            setLevel: function (l) { S.xpl = l; S.xp = 0; paintXp(); },
            armorPts: function () { return armorPoints(); },
            spawnMob: function (k, dx, dz, sz) { var nf = mkFoe(k, S.px + (dx || 3), S.py + 2, S.pz + (dz || 0)); if (k === 'slime' && sz) { nf.sz = sz; applySlimeSize(nf); } RT.foes.push(nf); return nf; },
            foeCount: function (k) { var n = 0; for (var i = 0; i < RT.foes.length; i++) if (!k || RT.foes[i].k === k) n++; return n; },
            tiles: function () { return tileN; },   // atlas is 16×16: anything over 256 wraps and corrupts
            /* The only honest answer to "is that mob animating?" is its actual
               geometry, so this hands back the built vertices per part: their
               centroids move iff the animation moves them. Same trick as hand(). */
            mobGeo: function (k) {
                var f = null, i;
                for (i = 0; i < RT.foes.length; i++) if (RT.foes[i].k === k) { f = RT.foes[i]; break; }
                if (!f) return null;
                var v = [];
                pushMob(v, f);
                var md = MOBS[f.k], out = [];
                for (i = 0; i < md.parts.length; i++) {
                    var b = i * 24 * 9, sx = 0, sy = 0, sz = 0;
                    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], bad = 0;
                    for (var j = 0; j < 24; j++) {
                        sx += v[b + j * 9]; sy += v[b + j * 9 + 1]; sz += v[b + j * 9 + 2];
                        for (var a = 0; a < 3; a++) { var q = v[b + j * 9 + a]; if (q < lo[a]) lo[a] = q; if (q > hi[a]) hi[a] = q; }
                        if (!isFinite(v[b + j * 9 + 3]) || !isFinite(v[b + j * 9 + 4])) bad++;   // NaN uv = a tile that isn't there
                    }
                    out.push({ role: (md.parts[i][7] || '') + (md.parts[i][8] != null ? md.parts[i][8] : ''),
                        c: [Math.round((sx / 24 - f.x) * 1e4) / 1e4, Math.round((sy / 24 - f.y) * 1e4) / 1e4, Math.round((sz / 24 - f.z) * 1e4) / 1e4],
                        size: [Math.round((hi[0] - lo[0]) * 1e3) / 1e3, Math.round((hi[1] - lo[1]) * 1e3) / 1e3, Math.round((hi[2] - lo[2]) * 1e3) / 1e3],
                        badUV: bad });
                }
                return { n: v.length / 9, parts: out };
            },
            tile: function (n) { return TILE[n]; },
            foeAnim: function (k) {
                for (var i = 0; i < RT.foes.length; i++) {
                    var f = RT.foes[i];
                    if (f.k !== k) continue;
                    return { spd: Math.round(f.spd * 100) / 100, swAmt: Math.round(f.swAmt * 1e3) / 1e3, anim: Math.round(f.anim * 1e3) / 1e3,
                        hYaw: Math.round(f.hYaw * 1e3) / 1e3, hPitch: Math.round(f.hPitch * 1e3) / 1e3, ground: !!f.ground,
                        chase: !!f.chase, aim: Math.round(f.aim * 100) / 100, atk: Math.round(f.atk * 100) / 100,
                        graze: Math.round(f.graze * 100) / 100, flap: Math.round(f.flap * 100) / 100,
                        squish: Math.round(f.squish * 1e3) / 1e3, tentA: Math.round(f.tentA * 1e3) / 1e3, fuse: Math.round(f.fuse * 100) / 100 };
                }
                return null;
            },
            dying: function () { return RT.dying.map(function (f) { return { k: f.k, t: Math.round(f.dieT * 1e3) / 1e3 }; }); },
            key: function (k, down) { RT.keys[k] = !!down; },
            mouse: function (btn, down) { if (btn === 0) { RT.mouse.l = !!down; if (down) { attack(); creativeInstaBreak(); } } else if (btn === 1) { if (down) pickBlock(); } else { RT.mouse.r = !!down; if (down) tryUse(); else finishUse(); } },
            openInv: function () { openPanel('inv'); },
            chat: function (line) { runChatLine(line); return (RT.chatLog || []).slice(-6).map(function (m) { return (m.c === 'err' ? '! ' : '') + m.t; }); },
            chatOpen: function (pre) { openChat(pre); return !!RT.chat; },
            chatClose: function () { closeChat(false); },
            chatState: function () { return { open: !!RT.chat, lines: (RT.chatLog || []).length, last: (RT.chatLog || []).slice(-1)[0] || null }; },
            complete: function (t) { return tabComplete(t); },
            sug: function () {
                var c = RT.chat, box = RT.el.querySelector('.mc-sug');
                if (!c) return null;
                return { n: c.hits.length, hits: c.hits.slice(0, 24), si: c.si, usage: c.usage, start: c.sstart,
                    shown: box ? getComputedStyle(box).display !== 'none' : false,
                    rows: box ? box.querySelectorAll('.mc-sugi').length : 0,
                    onRow: box && box.querySelector('.mc-sugi.on') ? box.querySelector('.mc-sugi.on').textContent : null,
                    usageRow: box ? box.querySelector('.mc-sugu').textContent : null,
                    left: box ? box.style.left : null };
            },
            gm: function () { return S.gm; }, diff: function () { return S.diff; },
            /* creative: everything a test needs to see without touching the DOM */
            creat: function () {
                return { gm: S.gm, fly: !!RT.fly, savedFly: !!S.fly, panel: RT.panel ? RT.panel.kind : null,
                    tab: RT.cTab, tabId: (CTABS[RT.cTab] || CTABS[0]).id, scroll: RT.cScroll, rows: creativeRows(),
                    listN: (RT.cList || []).length, search: RT.cSearch || '',
                    cur: RT.cur ? RT.cur.id + ':' + RT.cur.c : null, food: S.food, air: Math.round(S.air * 10) / 10,
                    nohud: RT.el.classList.contains('mc-nohud') };
            },
            creatAt: function (i) { var st = slotGroup('creat').get(i); return st ? st.id + ':' + st.c : null; },
            cTab: function (i) { creativeTab(i); },
            cSearch: function (q) { RT.cSearch = q; RT.cScroll = 0; creativeRefresh(); paintPanel(); },
            cScroll: function (d) { creativeScroll(d); },
            slotClick: function (g, i, right, shift) { slotClick(g, i, !!right, !!shift); },
            pick: function () { pickBlock(); },
            setFly: function (on) { setFly(on); },
            breakTime: function (b) { return breakTime(b); },
            heldStack: function () { var h = held(); return h ? { id: h.id, c: h.c, dur: h.dur } : null; },
            swing: function () { return { t: Math.round(RT.swing * 1e4) / 1e4, dur: RT.swingT, equip: Math.round((RT.equip || 0) * 1e3) / 1e3 }; },
            // centroid of the actual hand geometry: the only honest way to ask
            // "did the arm move?" without trusting the timer that drives it
            hand: function () {
                var v = handGeo();
                if (!v.length) return null;
                var n = v.length / 9, sx = 0, sy = 0, sz = 0;
                for (var i = 0; i < v.length; i += 9) { sx += v[i]; sy += v[i + 1]; sz += v[i + 2]; }
                return [Math.round(sx / n * 1e4) / 1e4, Math.round(sy / n * 1e4) / 1e4, Math.round(sz / n * 1e4) / 1e4];
            },
            eff: function () { return JSON.parse(JSON.stringify(S.eff || {})); },
            rules: function () { return JSON.parse(JSON.stringify(S.rules || {})); },
            flying: function () { return !!RT.fly; },
            openPanel: function (k, t) { openPanel(k, t); },
            place: function (id) { var t = RT.target; if (t) { S.inv[S.sel] = { id: id, c: 1 }; tryUse(); } },
            setB: setB, getB: getB, explode: explode, unlock: unlock, unlockAll: function () { for (var i = 0; i < ACH.length; i++) unlock(ACH[i].id); },
            chunkDbg: function (cx, cz) { var c = RT.chunks[cx + ',' + cz]; return c ? { op: c.dbgOp || null, cut: c.dbgCut || null } : null; },
            remesh: function (cx, cz) { var c = RT.chunks[cx + ',' + cz]; if (c) meshChunk(c); },
            lightAt: function (x, y, z) { return [getSky(x, y, z), getBlk(x, y, z)]; },
            relightBox: function (x, z) { relight(x, z); },
            setSlot: function (i, id, c) { S.inv[i] = id ? { id: id, c: c || 1 } : null; paintHotbar(); },
            craftGrid: function (arr) { RT.craftW = 3; for (var i = 0; i < 9; i++) RT.craft[i] = arr[i] ? { id: arr[i][0], c: arr[i][1] } : null; },
            shiftCraft: function () { takeCraft(true); },
            invSnap: function () { var o = {}; for (var i = 0; i < 36; i++) { var s = S.inv[i]; if (s) o[s.id] = (o[s.id] || 0) + s.c; } return o; },
            invFree: invFree, craftSnap: function () { return RT.craft.map(function (s) { return s ? s.id + ':' + s.c : null; }); },
            rb: function () {
                var st = rbState();
                return { known: S.rbk.slice(), open: !!(st && st.open), shown: rbShown(), filter: !!(st && st.filter), tab: RT.rbv ? RT.rbv.tab : null,
                    page: RT.rbv ? RT.rbv.page : null, list: (RT.rbList || []).map(function (c) { return rbId(c.r) + (c.ok ? '' : '!'); }),
                    ghost: RT.rbGhost ? rbId(RT.rbGhost) : null, lx: RT.panel ? RT.panel.lx : null, fresh: Object.keys(S.rbNew || {}) };
            },
            rbLearnAll: function () { return rbLearn(rbAll().map(function (r) { return r.key; })); },
            orbs: function () { return RT.orbs.map(function (o) { return [Math.round(o.x * 10) / 10, Math.round(o.y * 10) / 10, Math.round(o.z * 10) / 10, o.v]; }).concat([[S.px, S.py, S.pz]]); },
            spawnXp: function (dx, dz, v) { var gy = Math.floor(S.py) + 1; while (gy > 0 && !getB(Math.floor(S.px + dx), gy - 1, Math.floor(S.pz + dz))) gy--; spawnXp(S.px + dx, gy + 0.1, S.pz + dz, v || 3); }
        };
        if (has('mobs')) setTimeout(function () {
            var list = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'slime', 'pig', 'cow', 'sheep', 'chicken'];
            list.forEach(function (kk, i) {
                var a = i / list.length * 6.28, nf = mkFoe(kk, S.px + Math.cos(a) * 6, S.py + 3, S.pz + Math.sin(a) * 6);
                if (kk === 'slime') { nf.sz = 3; applySlimeSize(nf); }
                RT.foes.push(nf);
            });
        }, 2500);
        if (has('rain')) { S.weather = 1; S.wt = 300; }
        if (has('storm')) { S.weather = 2; S.wt = 300; }
        if (has('cave')) setTimeout(function () {
            for (var y = 30; y > 6; y--) {
                var wx = Math.floor(S.px), wz = Math.floor(S.pz);
                if (getB(wx, y, wz) === AIR && getB(wx, y + 1, wz) === AIR && solidAt(wx, y - 1, wz)) {
                    S.px = wx + 0.5; S.py = y; S.pz = wz + 0.5; RT.fallY = y;
                    setB(wx + 1, y, wz, TORCH);
                    break;
                }
            }
        }, 2500);
    }

    /* ── lifecycle + export ─────────────────────────────────── */
    function close() {
        if (!RT) return 0;
        // every world played this session, not just the one open when it closed
        var hrs = ((RT.bankT || 0) + RT.playT) / 3600;
        if (RT.panel) closePanel(true);   // fold cursor + crafting-grid items back before the save (else they vanish)
        sSave();
        cancelAnimationFrame(RT.raf);
        for (var i = 0; i < RT.timers.length; i++) clearInterval(RT.timers[i]);
        if (RT.ro) RT.ro.disconnect();
        document.removeEventListener('mousemove', RT.mmv);
        document.removeEventListener('pointerlockchange', RT.plc);
        document.removeEventListener('pointerlockerror', RT.ple);
        window.removeEventListener('mouseup', RT.mup);
        unlockCursor();
        if (RT.G && RT.G.gl) {   // hand the GPU context back rather than waiting on GC across many open/close cycles
            var lose = RT.G.gl.getExtension('WEBGL_lose_context');
            if (lose) try { lose.loseContext(); } catch (e) {}
        }
        audioStop();
        AV_CACHE = {}; AV_CACHE_KEYS = [];   // the built figures go with the game
        RT = null;
        return hrs;
    }
    function achOut() {
        var list = [], n = 0;
        for (var i = 0; i < ACH.length; i++) {
            var got = S ? !!S.ach[ACH[i].id] : false;
            if (got) n++;
            list.push({ id: ACH[i].id, t: ACH[i].t, d: ACH[i].d, got: got });
        }
        return { n: n, total: ACH.length, list: list };
    }
    window.MC = {
        render: render,
        init: init,
        close: close,
        suspend: function () {   // the desktop minimized us: fold panels, drop the lock, pause
            if (!RT) return;
            if (RT.panel) closePanel(true);
            unlockCursor();
            if (RT.ready && !RT.dead) showPause();
        },
        ach: achOut,
        steamAch: achOut,
        // the font specimen in .claude/comp-tools/mc-menu.html measures these
        // read-only introspection for .claude/comp-tools: the harnesses DRIVE the
        // real controls and only ever use this to see what happened afterwards
        __proof: { text: mfText, adv: mfAdvance, width: mfWidth, logo: mnLogo, webfont: mfWebFont, ttf: mfFontBytes, family: MF_FAMILY,
            probe: function (x, y, z) { return getB(x, y, z); },
            save: function () { return S ? { seed: S.seed, wtype: S.wtype, py: S.py, gm: S.gm, diff: S.diff, wid: S.wid, cheats: S.cheats } : null; },
            menu: function () {
                var m = RT && RT.menu;
                if (!m) return null;
                return { scr: m.scr, sel: m.d.sel, msel: m.d.msel, mx: m.mx, scale: m.scale, sig: m.sig, msg: m.msg || null,
                    hover: m.hover, focus: m.focus, prev: m.prev.slice(),
                    w: m.widgets.map(function (b) { return b.id + ':' + (b.enabled ? '' : 'off') + (b.st || 0); }) };
            } },
        hours: function () { var s = S || sLoad(); return s ? (s.hrs || 0) : 0; }
    };
})();
