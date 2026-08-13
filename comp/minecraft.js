/* ═══════════════════════════════════════════════════════════════
   minecraft.js — Minecraft, in a window, for real.
   A first-person WebGL voxel engine rendered at low internal
   resolution and upscaled nearest-neighbor, so the 3D world reads
   as pixel art like the rest of this desktop. Chunked infinite
   terrain from a seed, per-block sky+torch lighting with baked AO,
   the full survival loop (punch tree → craft → mine → smelt →
   build → don't get creeper'd), boxy mobs, hunger, farming, beds,
   TNT, and a synth C418 impression. No assets: every texture is
   painted onto the atlas at boot.
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
            hrs: 0,                        // lifetime raw hours
            snd: true, mus: true,
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
    var SWORD_DMG = [0, 4, 5, 6, 4, 7];
    (function () {   // 5 tools × 5 tiers, generated
        var kinds = { pick: 'Pickaxe', axe: 'Axe', shovel: 'Shovel', sword: 'Sword', hoe: 'Hoe' };
        for (var tier = 1; tier <= 5; tier++) for (var k in kinds) {
            var cap = TIER_N[tier].charAt(0).toUpperCase() + TIER_N[tier].slice(1);
            I[TIER_N[tier] + '_' + k] = {
                t: cap + (tier === 4 ? 'en' : '') + ' ' + kinds[k], stk: 1,
                tool: { k: k, tier: tier, mult: TIER_MULT[tier], dmg: k === 'sword' ? SWORD_DMG[tier] : 1 + tier, dur: TIER_DUR[tier] },
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
        for (var cs = 0; cs < 4; cs++) (function (stg) {
            tile('crack' + stg, function () {
                for (var i = 0; i < 8 + stg * 10; i++) {
                    var x = (trnd() * 16) | 0, y = (trnd() * 16) | 0;
                    tpx(x, y, 'rgba(20,16,12,0.85)');
                    if (trnd() < 0.6) tpx(x + 1, y, 'rgba(20,16,12,0.6)');
                    if (stg > 1 && trnd() < 0.5) tpx(x, y + 1, 'rgba(20,16,12,0.6)');
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
        hide('slime_skin', '#5bc44a', ['#4faa3e', '#6bd858', '#54b846']);
        tile('slime_face', function () { trect(0, 0, 16, 16, '#5bc44a'); sprinkle(['#4faa3e', '#6bd858'], 26); trect(4, 5, 2, 2, '#28401e'); trect(10, 5, 2, 2, '#28401e'); trect(6, 10, 4, 1, '#28401e'); });
        hide('squid_skin', '#5a3f8c', ['#4e357a', '#6a4fa0', '#472f6e']);
        tile('squid_face', function () { trect(0, 0, 16, 16, '#5a3f8c'); sprinkle(['#4e357a', '#6a4fa0'], 26); trect(4, 6, 2, 3, '#1a1024'); trect(10, 6, 2, 3, '#1a1024'); tpx(4, 6, '#c8b8e0'); tpx(10, 6, '#c8b8e0'); });
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
        tile('xporb', function () { trect(5, 5, 6, 6, '#a6e22e'); trect(6, 4, 4, 8, '#a6e22e'); trect(4, 6, 8, 4, '#a6e22e'); tpx(6, 6, '#e8ff8a'); tpx(9, 9, '#6a9a1e'); });
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
                // sugar cane grows on grass/sand/dirt beside water
                if (bl[a1] === AIR && (top === GRASS || top === SAND || top === DIRT) && hash2(wx * 5 - 17, wz * 5 + 23) < 0.05) {
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
        'vec3 rgb=c.rgb*b*vAo;rgb=mix(rgb,vec3(1.0),vWh);' +
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
        var eyeY = S.py + EYE, headIn = getB(Math.floor(S.px), Math.floor(eyeY), Math.floor(S.pz));
        var under = headIn === WATER, inLava = headIn === LAVA;
        var fogC = under ? [0.04, 0.12, 0.4] : inLava ? [0.6, 0.2, 0.05] : sky.sky;
        var fogR = under ? [4, 16] : inLava ? [0.3, 3] : [(VIEW - 1.2) * CW, (VIEW + 0.4) * CW];
        gl.viewport(0, 0, RT.cv.width, RT.cv.height);
        gl.clearColor(fogC[0], fogC[1], fogC[2], 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        /* RT.fov overrides the base entirely — the title screen's panorama is
           rendered at the cube renderer's 85°, not the game's 70°. RT.fovM is
           the sprint stretch, and is 1 whenever nobody is running. */
        var proj = mPersp((RT.fov || FOV) * (RT.fovM || 1), RT.cv.width / RT.cv.height, 0.08, 260);
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
            var stg = Math.min(3, (RT.digT / RT.digNeed * 4) | 0);
            var cr = cubeQuads(RT.digAt[0], RT.digAt[1], RT.digAt[2], TILE['crack' + stg]);
            gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1.5, -1.5);
            gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.bindBuffer(gl.ARRAY_BUFFER, G.dyn);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cr), gl.DYNAMIC_DRAW);
            bindMain(G, G.dyn);
            gl.drawElements(gl.TRIANGLES, cr.length / 36 * 6, gl.UNSIGNED_SHORT, 0);
            gl.disable(gl.BLEND); gl.disable(gl.POLYGON_OFFSET_FILL);
        }
        if (RT.target) {
            var t = RT.target, e = 0.004, x0 = t.x - e, y0 = t.y - e, z0 = t.z - e, x1 = t.x + 1 + e, y1 = t.y + 1 + e, z1 = t.z + 1 + e;
            var L = [x0, y0, z0, x1, y0, z0, x1, y0, z0, x1, y0, z1, x1, y0, z1, x0, y0, z1, x0, y0, z1, x0, y0, z0,
                x0, y1, z0, x1, y1, z0, x1, y1, z0, x1, y1, z1, x1, y1, z1, x0, y1, z1, x0, y1, z1, x0, y1, z0,
                x0, y0, z0, x0, y1, z0, x1, y0, z0, x1, y1, z0, x1, y0, z1, x1, y1, z1, x0, y0, z1, x0, y1, z1];
            gl.useProgram(G.flat);
            gl.uniformMatrix4fv(G.uf.mvp, false, pv);
            gl.uniform4f(G.uf.col, 0.05, 0.05, 0.05, 0.85);
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
            gl.uniformMatrix4fv(G.u.mvp, false, mPersp(FOV, RT.cv.width / RT.cv.height, 0.05, 10));
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
        var max = stkMax(id), i, s;
        if (max > 1 && !enchObj) for (i = 0; i < 36 && n > 0; i++) {
            s = S.inv[i];
            if (s && s.id === id && s.c < max && !s.ench) { var add = Math.min(max - s.c, n); s.c += add; n -= add; }
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
        }
    }
    function eatCake(x, y, z) {
        if (S.food >= 20) { toast('You are not hungry'); return; }
        var t = tentAt(x, y, z, 'cake');
        S.food = Math.min(20, S.food + 2); S.sat = Math.min(S.food, S.sat + 0.4);
        t.bites = (t.bites || 0) + 1; snd('eat'); paintVitals();
        if (t.bites >= 7) { setB(x, y, z, AIR); }
    }
    function wearHeld(n) {
        var h = held();
        if (!h || h.dur == null) return;
        wearItem(h, n);
        if (h.dur <= 0) { S.inv[S.sel] = null; snd('break'); }
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
                RT.ground = true;
                var fall = RT.fallY - S.py;
                // re-sample fluid at the landing box: a fast fall can plunge through a shallow
                // pond in one frame, so the frame-start `water` misses it
                if (fall > 3.5 && !water && !inFluid(WATER) && rule('fallDamage') && !RT.fly) {
                    var ff = S.armor[3] ? ench(S.armor[3], 'feather') : 0;   // feather falling boots soften the landing
                    var fdmg = Math.floor((fall - 3) * (1 - ff * 0.12));
                    if (fdmg > 0) { hurt(fdmg, null, false, true); snd('fall'); }
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
        if ((dx || dz) && RT.ground) RT.bob += dt * (RT.sprint ? 11 : 7);
        // drowning — creative and spectator hold their breath forever, so the
        // bubble row never appears for them
        var headWater = getB(Math.floor(S.px), Math.floor(S.py + EYE), Math.floor(S.pz)) === WATER && !invulnerable();
        if (headWater) {
            S.air -= dt;
            if (S.air <= 0) { S.air = 0; RT.drownT = (RT.drownT || 0) + dt; if (RT.drownT > 1) { RT.drownT = 0; hurt(2, null, false, true); } }
        } else { S.air = Math.min(10, S.air + dt * 4); RT.drownT = 0; }
        if (lava) { RT.lavaT = (RT.lavaT || 0) + dt; if (RT.lavaT > 0.5) { RT.lavaT = 0; hurt(4, null, false, true); } }
        else RT.lavaT = 0;
        // cactus: touching one hurts
        var fx2 = Math.floor(S.px), fz2 = Math.floor(S.pz), fy2 = Math.floor(S.py + 0.5);
        if (getB(fx2, fy2, fz2) === CACTUS || cactusTouch()) { RT.cactT = (RT.cactT || 0) + dt; if (RT.cactT > 0.5) { RT.cactT = 0; hurt(1, null, false, true); } }
        else RT.cactT = 0;
        // step sounds
        if ((dx || dz) && RT.ground) {
            RT.stepD = (RT.stepD || 0) + Math.sqrt(dx * dx + dz * dz);
            if (RT.stepD > 2.2) { RT.stepD = 0; var gb = getB(Math.floor(S.px), Math.floor(S.py - 0.5), Math.floor(S.pz)); snd('step', gb); }
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
        return m < 0.1 ? 0.1 : m > 1.5 ? 1.5 : m;
    }
    function fovTick(dt) {
        // MC closes half the remaining gap every tick; expressed per-second so
        // the ease lands the same at 30fps as at 144
        var t = fovTarget();
        RT.fovM += (t - RT.fovM) * (1 - Math.pow(0.5, Math.min(dt, 0.25) * 20));
        if (Math.abs(t - RT.fovM) < 0.0005) RT.fovM = t;
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
            if (RT.starveT >= 4) { RT.starveT = 0; if (S.hp > 1) { hurt(1, null, true); } }
        } else RT.starveT = 0;
    }
    function weatherTick(dt) {
        if (rule('doWeatherCycle')) S.wt -= dt;
        if (S.wt <= 0 && rule('doWeatherCycle')) {
            if (S.weather === 0) { S.weather = Math.random() < 0.28 ? (Math.random() < 0.3 ? 2 : 1) : 0; S.wt = S.weather ? 45 + Math.random() * 120 : 180 + Math.random() * 240; }
            else { S.weather = 0; S.wt = 180 + Math.random() * 240; }
            if (S.weather >= 1) toast(S.weather === 2 ? 'A thunderstorm rolls in' : 'It starts to rain');
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
        RT.lightning = 0.18; RT.shake = 0.3; snd('thunder');
        boomParticles(lx + 0.5, ly + 1, lz + 0.5, 2);
        for (var i = RT.foes.length - 1; i >= 0; i--) {
            var f = RT.foes[i];
            if (Math.abs(f.x - lx - 0.5) < 3 && Math.abs(f.z - lz - 0.5) < 3) { f.hp -= 8; f.hurtF = 0.3; f.fire = Math.max(f.fire || 0, 5); if (f.hp <= 0) { foeDie(f); RT.foes.splice(i, 1); } }
        }
        if (Math.abs(S.px - lx - 0.5) < 3 && Math.abs(S.pz - lz - 0.5) < 3) hurt(5, null, false, true);
    }
    function hurt(n, dir, quiet, bypassArmor) {
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
        S.hp -= n;
        RT.flash = 0.35;
        if (!quiet) snd('hurt');
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
        showDeath();
        snd('die');
    }
    function respawn() {
        var sp = S.spawn || S.wspawn;
        S.px = sp[0]; S.py = sp[1]; S.pz = sp[2];
        S.hp = 20; S.food = 20; S.sat = 5; S.air = 10;
        RT.vy = 0; RT.fallY = S.py; RT.dead = false; RT.exh = 0;
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
        snd('dig', b);
        blockParticles(x, y, z, b);
        setB(x, y, z, AIR);
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
            if (ef.k === 'cow' && !ef.baby && h.id === 'bucket') { if (h.c > 1 && invFree('milk_bucket') < 1) return; swapHeld('milk_bucket', 1); snd('pop'); return; }
            var food = BREED[ef.k];
            if (food && h.id === food) {
                if (ef.baby > 0) { ef.baby = Math.max(0, ef.baby - 6); heartParticles(ef); useOne(); snd('eat'); paintHotbar(); return; }
                if (ef.mateCd <= 0 && ef.love <= 0) { ef.love = 30; heartParticles(ef); useOne(); snd('eat'); paintHotbar(); return; }
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
            S.inv[S.sel] = null; paintHotbar(); paintVitals(); snd('click'); unlock('armor'); return;
        }
        // buckets: scoop, pour, and obsidian-forming.
        // The normal target skips fluids (you can't mine water), so scooping needs its own
        // fluid-aware cast — without it a bucket could never be filled, which also made
        // obsidian (water on lava) and therefore the enchanting table unobtainable.
        if (h.id === 'bucket') {
            var ft = raycast(true);
            if (ft && ft.b === WATER) { setB(ft.x, ft.y, ft.z, AIR, true); relight(ft.x, ft.z); dirtyAround(ft.x, ft.y, ft.z); swapHeld('water_bucket', 1); snd('pop'); return; }
            if (ft && ft.b === LAVA) { setB(ft.x, ft.y, ft.z, AIR, true); relight(ft.x, ft.z); dirtyAround(ft.x, ft.y, ft.z); swapHeld('lava_bucket', 1); snd('pop'); return; }
        }
        if ((h.id === 'water_bucket' || h.id === 'lava_bucket') && t) {
            var bx0 = t.px, by0 = t.py, bz0 = t.pz;
            if (getB(bx0, by0, bz0) === AIR) {
                var fluidId = h.id === 'water_bucket' ? WATER : LAVA;
                setB(bx0, by0, bz0, fluidId);
                if (fluidId === WATER) obsidianAround(bx0, by0, bz0);   // water meeting lava hardens it
                swapHeld('bucket'); snd('place', fluidId); return;
            }
        }
        if (h.id === 'milk_bucket') { swapHeld('bucket'); snd('burp'); return; }   // drink → empty bucket
        // flint & steel: light TNT
        if (h.id === 'flint_steel' && t && t.b === TNT) { igniteTnt(t.x, t.y, t.z); wearHeld(1); return; }
        // hoe tills
        if (def.tool && def.tool.k === 'hoe' && t && (t.b === GRASS || t.b === DIRT) && getB(t.x, t.y + 1, t.z) === AIR) {
            setB(t.x, t.y, t.z, FARMLAND);
            snd('dig', GRASS); wearHeld(1); unlock('farm');
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
            setB(t.px, t.py, t.pz, def.place); useOne(); paintHotbar(); snd('place', def.place); return;
        }
        // spawn eggs drop a mob onto the face you clicked
        if (def.egg && t) {
            if (!MOBS[def.egg] || RT.foes.length >= 64) return;
            RT.foes.push(mkFoe(def.egg, t.px + 0.5, t.py, t.pz + 0.5));
            snd('pop'); useOne(); paintHotbar();
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
        snd('place', id);
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
            if (S.food >= 20 && h.id !== 'flesh') { RT.eatT = 0; return; }
            RT.eatT += dt;
            if (RT.eatT > 0.25 && Math.floor(RT.eatT / 0.3) !== Math.floor((RT.eatT - dt) / 0.3)) snd('eat');
            if (RT.eatT >= 1.6) {
                S.food = Math.min(20, S.food + def.food.f);
                S.sat = Math.min(S.food, S.sat + def.food.sat);
                if (def.heal) S.hp = Math.min(20, S.hp + def.heal);   // golden apple heals
                var wasId = h.id, wasBowl = def.bowl;
                if (!instaBuild()) { h.c--; if (!h.c) S.inv[S.sel] = null; }
                if (wasBowl && !instaBuild()) invGive('bowl', 1);       // stew leaves the bowl
                RT.eatT = 0; snd('burp');
                paintHotbar(); paintVitals();
                if (wasId === 'bread') unlock('bread');
                if (wasId === 'golden_apple') unlock('gapple');
            }
        } else if (h.id === 'bow') {
            if (invCount('arrow') < 1 && RT.bowT === 0 && !instaBuild()) return;   // creative never runs out of arrows
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
            snd('bow');
            paintHotbar();
        }
        RT.eatT = 0; RT.bowT = 0;
    }
    function trySleep() {
        var st = skyState();
        if (st.day && st.sunE > 0.05) { toast('You can only sleep at night'); return; }
        for (var i = 0; i < RT.foes.length; i++) {
            var f = RT.foes[i];
            if (f.hostile && Math.abs(f.x - S.px) < 12 && Math.abs(f.z - S.pz) < 12 && Math.abs(f.y - S.py) < 6) {
                toast('You may not rest now; there are monsters nearby'); return;
            }
        }
        var t = RT.target;
        S.spawn = [t.x + 0.5, t.y + 1.01, t.z + 0.5];
        RT.sleep = 0.01;
        unlock('sleep');
    }

    /* ── mobs ───────────────────────────────────────────────── */
    var PX = 1.8 / 32;   // one skin-pixel in world units
    // parts: [sx,sy,sz, cx,cy,cz, flags]  flags: 1 face-tile front, 2 swing, 4 counter-swing, 8 alt tile
    var HUMANOID = [
        [8, 8, 8, 0, 28, 0, 1],
        [8, 12, 4, 0, 18, 0, 8],
        [4, 4, 12, -6, 26, 4, 0], [4, 4, 12, 6, 26, 4, 0],   // arms, outstretched
        [4, 12, 4, -2, 6, 0, 2], [4, 12, 4, 2, 6, 0, 4]
    ];
    var QUAD = function (bw, bh, bl, by, hs, hy, hz, lw, lh) {
        return [
            [bw, bh, bl, 0, by, 0, 8],
            [hs, hs, hs, 0, hy, hz, 1],
            [lw, lh, lw, -(bw / 2 - lw / 2), lh / 2, bl / 2 - lw / 2, 2], [lw, lh, lw, bw / 2 - lw / 2, lh / 2, bl / 2 - lw / 2, 4],
            [lw, lh, lw, -(bw / 2 - lw / 2), lh / 2, -(bl / 2 - lw / 2), 4], [lw, lh, lw, bw / 2 - lw / 2, lh / 2, -(bl / 2 - lw / 2), 2]
        ];
    };
    var MOBS = {
        pig: { hp: 10, hw: 0.45, h: 0.9, sp: 1.1, pass: 1, skin: 'pig_skin', face: 'pig_face', snd: 'pig',
               drops: [['pork_raw', 1, 2]], parts: QUAD(10, 8, 16, 9, 8, 12, 10, 4, 6) },
        cow: { hp: 10, hw: 0.55, h: 1.4, sp: 1.0, pass: 1, skin: 'cow_skin', face: 'cow_face', snd: 'cow',
               drops: [['beef_raw', 1, 2], ['leather', 0, 2]], parts: QUAD(12, 10, 18, 13, 8, 16, 11, 4, 10) },
        sheep: { hp: 8, hw: 0.5, h: 1.3, sp: 1.0, pass: 1, skin: 'sheep_skin', face: 'sheep_face', snd: 'sheep',
                 drops: [['mutton_raw', 1, 2], ['wool', 1, 2]], parts: QUAD(10, 10, 16, 12, 6, 14, 9, 4, 8) },
        chicken: { hp: 4, hw: 0.25, h: 0.8, sp: 0.9, pass: 1, slow: 1, skin: 'chicken_skin', face: 'chicken_face', snd: 'chicken',
                   drops: [['chicken_raw', 1, 1], ['feather', 0, 2]], parts: QUAD(6, 6, 8, 7, 4, 11, 4, 2, 5) },
        zombie: { hp: 20, hw: 0.35, h: 1.9, sp: 1.5, dmg: 3, burns: 1, skin: 'zom_skin', alt: 'zom_body', face: 'zom_face', snd: 'zombie',
                  drops: [['flesh', 0, 2]], parts: HUMANOID },
        skeleton: { hp: 20, hw: 0.35, h: 1.9, sp: 1.6, ranged: 1, burns: 1, skin: 'skel_skin', alt: 'skel_skin', face: 'skel_face', snd: 'skel',
                    drops: [['bone', 0, 2], ['arrow', 0, 2]], parts: HUMANOID },
        creeper: { hp: 20, hw: 0.35, h: 1.5, sp: 1.4, fuse: 1, skin: 'creep_skin', alt: 'creep_skin', face: 'creep_face', snd: null,
                   drops: [['gunpowder', 1, 2]], parts: [
                       [8, 8, 8, 0, 22, 0, 1], [8, 12, 4, 0, 12, 0, 8],
                       [4, 6, 4, -2, 3, 3, 2], [4, 6, 4, 2, 3, 3, 4], [4, 6, 4, -2, 3, -3, 4], [4, 6, 4, 2, 3, -3, 2]] },
        spider: { hp: 16, hw: 0.65, h: 0.9, sp: 1.9, dmg: 2, climbs: 1, skin: 'spider_skin', alt: 'spider_skin', face: 'spider_face', snd: 'spider',
                  drops: [['string', 0, 2]], parts: (function () {
                      var p = [[10, 8, 14, 0, 7, 0, 8], [8, 6, 6, 0, 6, 9, 1]];
                      for (var l = 0; l < 4; l++) { p.push([12, 2, 2, -9, 5, (l - 1.5) * 4, l % 2 ? 2 : 4]); p.push([12, 2, 2, 9, 5, (l - 1.5) * 4, l % 2 ? 4 : 2]); }
                      return p;
                  })() },
        enderman: { hp: 40, hw: 0.3, h: 2.9, sp: 1.7, dmg: 4, xp: 5, skin: 'ender_skin', alt: 'ender_skin', face: 'ender_face', snd: null,
                    drops: [['ender_pearl', 0, 1]], parts: [
                        [6, 8, 6, 0, 47, 0, 1], [8, 22, 4, 0, 34, 0, 8],
                        [2, 30, 2, -5, 28, 0, 2], [2, 30, 2, 5, 28, 0, 4],
                        [2, 26, 2, -2, 13, 0, 4], [2, 26, 2, 2, 13, 0, 2]] },
        slime: { hp: 4, hw: 0.5, h: 1.0, sp: 1.0, dmg: 2, split: 1, xp: 0, cube: 1, skin: 'slime_skin', alt: 'slime_skin', face: 'slime_face', snd: null,
                 drops: [['slimeball', 0, 2]], parts: [[8, 8, 8, 0, 0, 0, 1]] },
        squid: { hp: 10, hw: 0.45, h: 0.85, sp: 1.5, pass: 1, aquatic: 1, xp: 1, skin: 'squid_skin', alt: 'squid_skin', face: 'squid_face', snd: null,
                 drops: [['ink_sac', 1, 3]], parts: (function () {
                     var p = [[12, 12, 12, 0, 4, 0, 1]];
                     for (var l = 0; l < 4; l++) { var a = l / 4 * 6.283; p.push([2, 6, 2, Math.round(Math.cos(a) * 4), -3, Math.round(Math.sin(a) * 4), 8]); }
                     return p;
                 })() }
    };
    function mkFoe(kind, x, y, z, hp) {
        var d = MOBS[kind];
        var f = { k: kind, x: x, y: y, z: z, vx: 0, vy: 0, vz: 0, hp: hp != null ? hp : d.hp,
            hw: d.hw, h: d.h, yaw: Math.random() * 6.28, wt: 0, wd: null, anim: 0, ifr: 0,
            hostile: !d.pass, fuse: 0, burnT: 0, shootT: 0, flee: 0, hurtF: 0, voice: 2 + Math.random() * 6,
            fire: 0, love: 0, baby: 0, mateCd: 0, sz: 0, dmg: d.dmg, aggro: 0 };
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
    function foeUpdate(f, dt) {
        // an unloaded chunk has no floor to stand on: freeze in place until the world comes back
        if (!chunkAt(Math.floor(f.x), Math.floor(f.z))) return false;
        var d = MOBS[f.k];
        if (f.hp <= 0) { foeDie(f); return true; }
        f.ifr = Math.max(0, f.ifr - dt); f.hurtF = Math.max(0, f.hurtF - dt);
        var px = S.px - f.x, pz = S.pz - f.z, py = (S.py + 0.9) - (f.y + f.h * 0.6);
        var dist = Math.sqrt(px * px + pz * pz + py * py);
        // set-on-fire (fire aspect / lava): damage over time
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
                    unlock('breed');
                    break;
                }
            }
        }
        if (f.mateCd > 0) f.mateCd -= dt;
        // chickens lay — the only source of eggs, without which cake and pumpkin pie
        // are uncraftable (they were dead recipes before this)
        if (f.k === 'chicken' && !f.baby) {
            f.layT = (f.layT || 20 + Math.random() * 40) - dt;
            // 'pop' is the cue that means "you picked something up"; a chicken two
            // hundred blocks away kept firing it, and there is no distance attenuation
            if (f.layT <= 0) { f.layT = 20 + Math.random() * 40; dropItem(f.x, f.y + 0.3, f.z, 'egg', 1); if (dist < 16) snd('chicken'); }
        }
        // fully-custom movers take over here (they run their own physics + contact)
        if (f.k === 'enderman') return endermanUpdate(f, dt, px, pz, dist);
        if (f.k === 'squid') return squidUpdate(f, dt);
        // burn at dawn
        if (d.burns) {
            var st = skyState();
            if (st.day && st.sunE > 0.08 && getSky(Math.floor(f.x), Math.floor(f.y + f.h), Math.floor(f.z)) >= 14) {
                f.burnT += dt;
                if (f.burnT > 1) { f.burnT = 0; f.hp -= 2; f.hurtF = 0.25; fireParticles(f); }
            }
        }
        // intent
        var want = null, sp = d.sp;
        if (f.flee > 0) { f.flee -= dt; want = Math.atan2(-px, pz) + Math.PI; sp *= 1.4; }
        // hostiles look straight through a creative or spectator player: no chase,
        // no arrows, no creeper hiss. Exactly what the real game does.
        else if (f.hostile && dist < 18 && !RT.dead && !unseen()) {
            want = Math.atan2(-px, pz);   // face the player: movement dir is (-sin yaw, cos yaw)
            if (d.ranged) {
                if (dist < 7) want += Math.PI;                       // skeletons keep their distance
                else if (dist < 13) { want = null; }
                f.shootT += dt;
                if (f.shootT > 2 && dist < 15) {
                    f.shootT = 0;
                    var dl = Math.sqrt(px * px + py * py + pz * pz) || 1;
                    RT.arrows.push({ x: f.x, y: f.y + f.h * 0.8, z: f.z, vx: px / dl * 22, vy: py / dl * 22 + dist * 0.09, vz: pz / dl * 22, mine: false, dmg: 3, t: 0 });
                    snd('bow');
                }
            }
            if (d.fuse) {
                if (dist < 3) { if (!f.fuse) snd('fuse'); f.fuse += dt; want = null; sp = 0; }
                else if (f.fuse > 0 && dist > 7) f.fuse = Math.max(0, f.fuse - dt * 2);
                else if (f.fuse > 0) f.fuse += dt * 0.4;   // committed once lit unless you really run
                if (f.fuse >= 1.5) { killFoe(f); explode(f.x, f.y + f.h / 2, f.z, 3, 22); return false; }
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
        if (want != null && sp > 0) { mvx = -Math.sin(f.yaw) * sp * dt; mvz = Math.cos(f.yaw) * sp * dt; f.anim += dt * 6; }
        else { var neutral = Math.round(f.anim / Math.PI) * Math.PI; f.anim += (neutral - f.anim) * Math.min(1, dt * 10); }   // ease legs to a standing pose, don't freeze mid-stride
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
            f.ifr = 1;
            var kl = Math.sqrt(px * px + pz * pz) || 1;
            hurt(cdmg, [px / kl, pz / kl]);
        }
        // idle voice
        f.voice -= dt;
        if (f.voice <= 0) { f.voice = 6 + Math.random() * 14; if (d.snd && dist < 18) snd(d.snd); }
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
        poofParticles(f);
        if (f.pk) spawnXp(f.x, f.y + 0.5, f.z, d.xp != null ? d.xp : (f.hostile ? 5 : 1 + ((Math.random() * 3) | 0)));
        if (f.hostile) unlock('hunter');
        if (f.k === 'skeleton' && f.lastArrow) unlock('sniper');
        if (f.k === 'enderman') unlock('ender');
        snd('poof');
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
                    poofParticles(f); f.x = tx + 0.5; f.y = ty; f.z = tz + 0.5; f.vy = 0; poofParticles(f); snd('teleport'); return true;
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
            if (t != null && (!RT.target || RT.target.dist > t)) { f.aggro = 12; snd('endermad'); }
        }
        if (f.hurtF > 0.24 && Math.random() < 0.35) { teleportEnder(f); f.aggro = 12; }   // flickers away when hit
        var want = null, sp = MOBS.enderman.sp;
        if (f.aggro > 0 && !RT.dead && !unseen()) {
            f.aggro = Math.max(0, f.aggro - dt); want = Math.atan2(-px, pz); sp *= 1.5;
            if (dist > 20 && Math.random() < 0.02) teleportEnder(f);   // close the gap
        } else { f.wt -= dt; if (f.wt <= 0) { f.wt = 2 + Math.random() * 4; f.wd = Math.random() < 0.5 ? Math.random() * 6.28 : null; } want = f.wd; sp *= 0.5; }
        if (want != null) { var turn = want - f.yaw; while (turn > Math.PI) turn -= 6.283; while (turn < -Math.PI) turn += 6.283; f.yaw += Math.max(-4 * dt, Math.min(4 * dt, turn)); }
        var mvx = 0, mvz = 0;
        if (want != null && sp > 0) { mvx = -Math.sin(f.yaw) * sp * dt; mvz = Math.cos(f.yaw) * sp * dt; f.anim += dt * 6; }
        f.vy -= GRAV * dt; if (f.vy < -TERMV) f.vy = -TERMV;
        var hit = entMove(f, mvx, 0, mvz);
        if ((hit.x || hit.z) && f.ground) f.vy = JUMP;
        var hy = entMove(f, 0, f.vy * dt, 0);
        if (hy.y) { if (f.vy < 0) f.ground = true; f.vy = 0; } else if (Math.abs(f.vy) > 1) f.ground = false;
        if (f.hp <= 0) { foeDie(f); return true; }
        if (f.aggro > 0 && f.ifr <= 0 && !RT.dead && Math.abs(f.x - S.px) < f.hw + HW + 0.15 && Math.abs(f.z - S.pz) < f.hw + HW + 0.15 && S.py < f.y + f.h && S.py + PH > f.y) {
            f.ifr = 1; var kl = Math.sqrt(px * px + pz * pz) || 1; hurt(4, [px / kl, pz / kl]);
        }
        f.voice -= dt; if (f.voice <= 0) { f.voice = 8 + Math.random() * 16; if (dist < 20) snd('endervoice'); }
        if (Math.abs(px) > 72 || Math.abs(pz) > 72) return true;
        return false;
    }
    function squidUpdate(f, dt) {
        var inWater = getB(Math.floor(f.x), Math.floor(f.y + 0.4), Math.floor(f.z)) === WATER;
        if (!inWater) { f.landT = (f.landT || 0) + dt; if (f.landT > 8) return true; f.vy -= GRAV * dt; }   // beached squid flops then despawns
        else {
            f.landT = 0;
            f.swimT = (f.swimT || 0) - dt;
            if (f.swimT <= 0) { f.swimT = 0.8 + Math.random() * 1.6; f.yaw = Math.random() * 6.28; f.pitchV = (Math.random() - 0.5) * 2; }
            var sp = MOBS.squid.sp;
            f.vy = f.pitchV; f.anim += dt * 4;
            entMove(f, -Math.sin(f.yaw) * sp * dt, 0, Math.cos(f.yaw) * sp * dt);
        }
        var hy = entMove(f, 0, f.vy * dt, 0);
        if (hy.y && !inWater) f.vy = 0;
        if (f.hp <= 0) { foeDie(f); return true; }
        f.hurtF = Math.max(0, f.hurtF - dt);
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
        var charged = RT.atkCd <= 0.02;   // full attack-cooldown → full-strength hit
        RT.atkCd = tool && tool.k === 'sword' ? 0.5 : tool ? 0.55 : 0.35;
        if (!f) return;
        if (f.ifr > 0.6) return;
        var dmg = tool ? tool.dmg : 1;
        if (!charged) dmg *= 0.45;                          // hasty spam-click does less
        dmg += ench(h, 'sharp') > 0 ? 0.5 * ench(h, 'sharp') + 0.5 : 0;
        // critical: mid-fall, charged, not in fluid / on a ladder
        var crit = charged && RT.vy < -0.1 && !RT.ground && !inFluid(WATER) && !onLadder();
        if (crit) { dmg *= 1.5; critParticles(f); }
        f.hp -= dmg;
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
        snd('hit');
        if (f.hp <= 0) { foeDie(f, ench(h, 'looting')); killFoe(f); }
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
        var leveled = false;
        while (S.xp >= xpForLevel(S.xpl)) { S.xp -= xpForLevel(S.xpl); S.xpl++; leveled = true; }
        if (leveled) snd(S.xpl % 5 === 0 ? 'levelbig' : 'level');
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
            var left = invGive(d.it, d.c, d.dur, d.ench, d.iname);
            if (left === d.c) return false;         // no room at all: it stays
            snd('pop');
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
            snd('thud');
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
                    if (f.hp <= 0) { foeDie(f); RT.foes.splice(i, 1); }
                    snd('hit');
                    return true;
                }
            }
        } else if (!RT.dead &&
            a.x > S.px - HW && a.x < S.px + HW && a.y > S.py && a.y < S.py + PH && a.z > S.pz - HW && a.z < S.pz + HW) {
            var l = Math.sqrt(a.vx * a.vx + a.vz * a.vz) || 1;
            hurt(a.dmg, [a.vx / l, a.vz / l]);
            return true;
        }
        return false;
    }
    function igniteTnt(x, y, z) {
        setB(x, y, z, AIR);
        RT.tnts.push({ x: x + 0.5, y: y, z: z + 0.5, vy: 0, fuse: 4 });
        snd('fuse');
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
    function explode(ex, ey, ez, r, maxDmg) {
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
            hurt(Math.round(maxDmg * (1 - pd / (r * 2))), [(S.px - ex) / l, (S.pz - ez) / l]);
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
        RT.shake = 0.5;
        snd('boom');
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
    function poofParticles(f) {
        var uv0 = tileUV(TILE.wool);
        for (var i = 0; i < 12; i++)
            RT.parts.push({ x: f.x + (Math.random() - 0.5) * 0.7, y: f.y + Math.random() * f.h, z: f.z + (Math.random() - 0.5) * 0.7,
                vx: (Math.random() - 0.5) * 1.5, vy: 0.8 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 1.5,
                life: 0.5, u: uv0[0] + 4 * TS16 / 16, v: uv0[1] + 4 * TS16 / 16, s: 0.11 });
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
        for (i = 0; i < RT.foes.length; i++) {
            var f = RT.foes[i], md = MOBS[f.k];
            var L = cellLight(f.x, f.y + f.h * 0.5, f.z);
            var wh = f.hurtF > 0 ? 0.5 : 0;
            if (f.fuse > 0) wh = Math.max(wh, (RT.worldMs / 90) & 1 ? 0.7 : 0.15);
            if (f.fire > 0) wh = Math.max(wh, (RT.worldMs / 120) & 1 ? 0.5 : 0.1);
            var scale = (f.fuse > 0 ? 1 + f.fuse * 0.2 : 1) * (f.baby > 0 ? 0.55 : 1);
            var yc = Math.cos(f.yaw), ys = Math.sin(f.yaw);
            var skin = TILE[md.skin], alt = TILE[md.alt || md.skin], face = TILE[md.face];
            if (md.cube) {   // slime: one box sized to its actual hitbox
                pushBox(v, f.x, f.y + f.h / 2, f.z, f.hw * 0.9, f.h * 0.45, f.hw * 0.9, yc, ys, 0, 0,
                    (function (fc, sk) { return function (dd) { return dd === 4 ? fc : sk; }; })(face, skin), L[0], L[1], wh);
                continue;
            }
            for (var p = 0; p < md.parts.length; p++) {
                var pt = md.parts[p], flags = pt[6];
                var sw = flags & 2 ? Math.sin(f.anim) * 0.8 : flags & 4 ? -Math.sin(f.anim) * 0.8 : 0;
                pushBox(v, f.x, f.y + pt[4] * PX * scale - (flags & 6 ? 0 : 0), f.z,
                    pt[0] / 2 * PX * scale, pt[1] / 2 * PX * scale, pt[2] / 2 * PX * scale,
                    yc, ys, sw, pt[1] / 2 * PX,
                    (function (fl, cxo, czo) {
                        return function (dd) { return (fl & 1) && dd === 4 ? face : (fl & 8) ? alt : skin; };
                    })(flags),
                    L[0], L[1], wh);
                // recentre: parts store center offsets in px — apply x/z offsets through yaw
                var last = v.length - 24 * 9;
                var oxp = pt[3] * PX * scale, ozp = pt[5] * PX * scale;
                var rx = yc * oxp - ys * ozp, rz = ys * oxp + yc * ozp;
                for (var vi = last; vi < v.length; vi += 9) { v[vi] += rx; v[vi + 2] += rz; }
            }
        }
        for (i = 0; i < RT.tnts.length; i++) {
            var t = RT.tnts[i];
            var TL = cellLight(t.x, t.y + 0.5, t.z);
            pushBox(v, t.x, t.y + 0.5, t.z, 0.49, 0.49, 0.49, 1, 0, 0, 0,
                function (dd) { return dd === 2 || dd === 3 ? TILE.tnt_top : TILE.tnt_side; },
                TL[0], TL[1], (t.fuse * 5 & 1) ? 0.75 : 0.1);
        }
        for (i = 0; i < RT.drops.length; i++) {
            var dr = RT.drops[i], def = I[dr.it];
            var bob = 0.12 + Math.sin(RT.worldMs / 400 + i) * 0.04;
            var DL = cellLight(dr.x, dr.y + 0.2, dr.z);
            if (def && def.place != null && !B[def.place].cross && !B[def.place].half) {
                var spin = RT.worldMs / 800 + i;
                pushBox(v, dr.x, dr.y + bob + 0.13, dr.z, 0.13, 0.13, 0.13, Math.cos(spin), Math.sin(spin), 0, 0,
                    (function (pl) { return function (dd) { return texFace(TEX[pl], dd); }; })(def.place),
                    DL[0], DL[1], 0);
            } else {
                var tid2 = def && def.tile != null ? def.tile : (def && def.place != null ? texTop(TEX[def.place]) : TILE.i_stick);
                var u2 = tileUV(tid2);
                pushBillboard(v, dr.x, dr.y + bob + 0.15, dr.z, 0.17, u2[0] + INSET, u2[1] + INSET, u2[0] + TS16 - INSET, u2[1] + TS16 - INSET, DL[0], DL[1], 0);
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
        for (i = 0; i < RT.orbs.length; i++) {
            var o = RT.orbs[i], ou = tileUV(TILE.xporb);
            var obob = Math.sin(RT.worldMs / 220 + i) * 0.03;
            pushBillboard(v, o.x, o.y + 0.12 + obob, o.z, o.v >= 7 ? 0.16 : 0.11, ou[0] + INSET, ou[1] + INSET, ou[0] + TS16 - INSET, ou[1] + TS16 - INSET, 1, 0.4, 0);
        }
        for (i = 0; i < RT.parts.length; i++) {
            var pp = RT.parts[i];
            var PL = cellLight(pp.x, pp.y, pp.z);
            // dim: a flat tint on the mote, the way the real game darkens block
            // dust to 0.6 — without it, sand kicked off sand is invisible
            pushBillboard(v, pp.x, pp.y, pp.z, pp.s, pp.u, pp.v, pp.u + TS16 / 10, pp.v + TS16 / 10, Math.max(0.25, PL[0]), PL[1], 0, pp.dim || 1);
        }
        if (RT.sleep) {   // fade handled by overlay; nothing extra here
        }
    }

    /* ── first-person hand (view space) ─────────────────────── */
    function handGeo() {
        if (RT.menu) return [];         // nobody is holding anything on the title screen
        if (isSpectator()) return [];   // a CSS class cannot reach WebGL: the hand was still there
        if (RT.dead || RT.sleep) return [];
        var v = [], h = held(), def = h && I[h.id];
        var L = cellLight(S.px, S.py + EYE, S.pz);
        var sk2 = Math.max(0.18, L[0]), bl2 = L[1];
        /* The real game's swing is not a symmetric bob. It drives position from
           f = sin(√p · π) — which leaps out in the first third and eases back
           over the rest — and rotation from f2 = sin(p² · π), which lags behind
           it. Two envelopes out of phase is the whole reason a swing reads as a
           strike and not a nod. p runs 0→1 across the swing. */
        var p = RT.swing > 0 && RT.swingT > 0 ? Math.max(0, Math.min(1, 1 - RT.swing / RT.swingT)) : 0;
        var f = RT.swing > 0 ? Math.sin(Math.sqrt(p) * Math.PI) : 0;
        var f2 = RT.swing > 0 ? Math.sin(p * p * Math.PI) : 0;
        var bobX = Math.sin(RT.bob) * 0.012, bobY = Math.abs(Math.cos(RT.bob)) * 0.014;
        // the arm sweeps in across the view, drives forward, then drops through
        var ox = 0.42 + bobX - f * 0.19;
        var oy = -0.42 - bobY + f * 0.07 - f2 * 0.19;
        var oz = -0.72 - f * 0.23;
        // swapping items drops the hand out of frame and lifts the new one in
        oy -= (RT.equip || 0) * 0.65;
        var pull = RT.bowT > 0 ? RT.bowT * 0.12 : 0;
        var eatN = RT.eatT > 0 ? Math.sin(RT.eatT * 22) * 0.03 : 0;
        oy += eatN; oz += pull;
        if (def && def.place != null && !B[def.place].cross && !B[def.place].half) {
            // a held block turns as it is driven down, so you see its top face bite
            // in — but only so far, or it goes edge-on and vanishes mid-swing
            pushBox(v, ox, oy, oz, 0.16, 0.16, 0.16, Math.cos(0.62 - f * 0.35), Math.sin(0.62 - f * 0.35), f2 * 0.7, 0,
                (function (pl) { return function (dd) { return texFace(TEX[pl], dd); }; })(def.place),
                sk2, bl2, 0);
        } else if (h) {
            var tid = def && def.tile != null ? def.tile : TILE.i_stick;
            var u0 = tileUV(tid);
            // an angled card: item sprites read great edge-on at this res
            var yc2 = Math.cos(0.8 + f * 0.95), ys2 = Math.sin(0.8 + f * 0.95);
            // and it tips over its own leading edge on the follow-through
            var tipC = Math.cos(f2 * 0.6), tipS = Math.sin(f2 * 0.6);
            var cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
            for (var k = 0; k < 4; k++) {
                var a = cs[k][0] * 0.22, b = cs[k][1] * 0.22;
                var by = b * tipC, bz = b * tipS;
                v.push(ox + yc2 * a, oy + by + 0.08, oz + ys2 * a + bz,
                    cs[k][0] > 0 ? u0[0] + TS16 - INSET : u0[0] + INSET,
                    cs[k][1] > 0 ? u0[1] + INSET : u0[1] + TS16 - INSET,
                    sk2, bl2, 1, 0);
            }
        } else {
            // a bare fist rotates hardest of all — there is no item to read, so the
            // motion has to carry the whole punch. It still has to stay on screen,
            // so the arc is tempered and the arm pivots rather than translating away.
            pushBox(v, ox + 0.05, oy + f2 * 0.06, oz, 0.09, 0.09, 0.3, Math.cos(0.5 - f * 0.3), Math.sin(0.5 - f * 0.3), f2 * 0.95, -0.2,
                function () { return TILE.hand; }, sk2, bl2, 0);
        }
        return v;
    }

    /* ── item icons: fake-iso cubes off the atlas ───────────── */
    var ICON = {};
    function iconURL(id) {
        if (ICON[id]) return ICON[id];
        var def = I[id], cv = document.createElement('canvas');
        cv.width = cv.height = 32;
        var c = cv.getContext('2d');
        c.imageSmoothingEnabled = false;
        function tsrc(tid) { return { x: (tid % 16) * 16, y: ((tid / 16) | 0) * 16 }; }
        if (def && def.place != null && !B[def.place].cross && !B[def.place].half) {
            var tx = TEX[def.place];
            var top = tsrc(texTop(tx)), side = tsrc(texSide(tx));
            function face(tf, sx, shade) {
                c.setTransform(tf[0], tf[1], tf[2], tf[3], tf[4], tf[5]);
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
        } else {
            var tid = def && def.tile != null ? def.tile : (def && def.place != null ? texTop(TEX[def.place]) : TILE.i_stick);
            var s = tsrc(tid);
            c.drawImage(ATLAS, s.x, s.y, 16, 16, 2, 2, 28, 28);
        }
        ICON[id] = cv.toDataURL();
        return ICON[id];
    }
    function paintSlot(el, st) {
        if (!st) { el.style.backgroundImage = ''; el.innerHTML = ''; el.className = el.className.replace(/ has| glint/g, ''); return; }
        el.style.backgroundImage = 'url(' + iconURL(st.id) + ')';
        if (el.className.indexOf(' has') < 0) el.className += ' has';
        var glint = (st.ench && Object.keys(st.ench).length) || (I[st.id] && I[st.id].glint);
        el.className = el.className.replace(/ glint/g, '') + (glint ? ' glint' : '');
        var html = st.c > 1 ? '<span class="mc-ct">' + st.c + '</span>' : '';
        var max = itemMaxDur(st.id);
        if (st.dur != null && max != null && st.dur < max) {
            var pc = st.dur / max;
            html += '<span class="mc-dur"><i style="width:' + Math.round(pc * 100) + '%;background:' + (pc > 0.5 ? '#4be04b' : pc > 0.2 ? '#e0c04b' : '#e04b4b') + '"></i></span>';
        }
        el.innerHTML = html;
    }

    /* ── HUD ────────────────────────────────────────────────── */
    function hudTile(name) { var t = TILE[name]; return 'background-position:-' + (t % 16) * 18 + 'px -' + ((t / 16) | 0) * 18 + 'px'; }
    function paintHotbar() {
        var bar = RT.el.querySelector('.mc-hotbar');
        if (!bar) return;
        var cells = bar.children;
        for (var i = 0; i < 9; i++) {
            cells[i].className = 'mc-slot mc-hb' + (i === S.sel ? ' sel' : '') + (S.inv[i] ? ' has' : '');
            paintSlot(cells[i], S.inv[i]);
        }
        var h = held();
        var tip = RT.el.querySelector('.mc-tip');
        if (h && RT.tipId !== h.id) { tip.textContent = I[h.id] ? I[h.id].t : h.id; tip.className = 'mc-tip show'; RT.tipT = 2; }
        if (!h) { tip.className = 'mc-tip'; }
        RT.tipId = h ? h.id : null;
    }
    function paintVitals() {
        var el = RT.el, i, out = '';
        for (i = 0; i < 10; i++) {
            var v = S.hp - i * 2;
            out += '<i class="mc-ico" style="' + hudTile(v >= 2 ? 'h_heart' : v === 1 ? 'h_heart_half' : 'h_heart_bg') + '"></i>';
        }
        el.querySelector('.mc-hearts').innerHTML = out;
        out = '';
        for (i = 9; i >= 0; i--) {
            var f = S.food - i * 2;
            out += '<i class="mc-ico" style="' + hudTile(f >= 2 ? 'h_food' : f === 1 ? 'h_food_half' : 'h_food_bg') + '"></i>';
        }
        el.querySelector('.mc-food').innerHTML = out;
        var air = el.querySelector('.mc-air');
        if (S.air < 9.9) {
            out = '';
            for (i = 0; i < 10; i++) out += '<i class="mc-ico" style="' + hudTile('h_bubble') + ';opacity:' + (S.air > i ? 1 : 0.15) + '"></i>';
            air.innerHTML = out; air.style.display = '';
        } else air.style.display = 'none';
        paintArmorBar();
    }
    function armorPoints() { var p = 0; for (var i = 0; i < 4; i++) if (S.armor[i]) p += (I[S.armor[i].id].armor.def || 0) + (ench(S.armor[i], 'protection') * 0.5); return p; }
    function armorTough() { var p = 0; for (var i = 0; i < 4; i++) if (S.armor[i]) p += I[S.armor[i].id].armor.tough || 0; return p; }
    function paintArmorBar() {
        var bar = RT.el.querySelector('.mc-armor'); if (!bar) return;
        var pts = Math.round(armorPoints());
        if (pts <= 0) { bar.style.display = 'none'; return; }
        bar.style.display = ''; var out = '';
        for (var i = 0; i < 10; i++) { var v = pts - i * 2; out += '<i class="mc-ico" style="' + hudTile(v >= 2 ? 'h_armor' : v === 1 ? 'h_armor_half' : 'h_armor_bg') + '"></i>'; }
        bar.innerHTML = out;
    }
    function paintXp() {
        var el = RT.el, fill = el.querySelector('.mc-xpfill'), lvl = el.querySelector('.mc-xplvl');
        if (fill) fill.style.width = Math.round(xpBarFrac() * 100) + '%';
        if (lvl) lvl.textContent = S.xpl > 0 ? S.xpl : '';
    }
    /* Creative hides the four bars that only mean something in survival —
       hearts, hunger, armour, experience — and spectator drops the hotbar and
       crosshair on top of that. Done with a class rather than four display
       flags so nothing can paint one of them back on the next tick. */
    function paintHudMode() {
        if (!RT || !RT.el) return;
        RT.el.classList.toggle('mc-nohud', invulnerable());
        RT.el.classList.toggle('mc-spect', isSpectator());
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
        { id: 'sniper', t: 'Sniper Duel', d: 'Kill a skeleton with an arrow' },
        { id: 'sleep', t: 'Sweet Dreams', d: 'Sleep in a bed to change your respawn point' },
        { id: 'armor', t: 'Suit Up', d: 'Wear a piece of armor' },
        { id: 'enchant', t: 'Enchanter', d: 'Enchant an item at the table' },
        { id: 'anvil2', t: 'Repurpose', d: 'Rename or repair at an anvil' },
        { id: 'breed', t: 'Two by Two', d: 'Breed two animals into a baby' },
        { id: 'ender', t: 'Staring Contest', d: 'Defeat an Enderman' },
        { id: 'gapple', t: 'Golden Bite', d: 'Eat a golden apple' },
        { id: 'xp30', t: 'Seasoned', d: 'Reach experience level 30' }
    ];
    function unlock(id) {
        if (!S || S.ach[id]) return;
        var a = null;
        for (var i = 0; i < ACH.length; i++) if (ACH[i].id === id) a = ACH[i];
        if (!a) return;   // ignore ids not in the list (keeps achN honest)
        S.ach[id] = Date.now();
        S.achN++;
        toast('<b>Achievement Get!</b>' + a.t, true);
        snd('ding');
    }
    function toast(msg, ach) {
        var wrap = RT.el.querySelector('.mc-toasts');
        if (!wrap) return;
        var d = document.createElement('div');
        d.className = 'mc-toast' + (ach ? ' ach' : '');
        d.innerHTML = msg;
        wrap.appendChild(d);
        setTimeout(function () { d.className += ' out'; }, 3600);
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 4200);
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
        if (RT.sleep) { RT.sleep = 0; RT.el.querySelector('.mc-sleepov').style.display = 'none'; }
        closeChat(false);   // a half-typed command must not float over the menu
        sSave();
        var p = RT.el.querySelector('.mc-pause');
        p.querySelector('.mc-snd').textContent = 'Sound: ' + (S.snd ? 'ON' : 'OFF');
        p.querySelector('.mc-mus').textContent = 'Music: ' + (S.mus ? 'ON' : 'OFF');
        p.style.display = '';
        paintAchList();
    }
    function hidePause() {
        RT.paused = false;
        RT.el.querySelector('.mc-pause').style.display = 'none';
        RT.el.querySelector('.mc-achs').style.display = 'none';
        RT.lastT = 0;   // don't count paused time as a frame
        RT.el.focus();  // the clicked button just vanished with the menu — keys must land on the game root
    }
    function paintAchList() {
        var el = RT.el.querySelector('.mc-achs .mc-achrows'), out = '';
        for (var i = 0; i < ACH.length; i++) {
            var got = !!S.ach[ACH[i].id];
            out += '<div class="mc-achrow' + (got ? ' got' : '') + '"><b>' + ACH[i].t + '</b><span>' + ACH[i].d + '</span></div>';
        }
        el.innerHTML = out;
        RT.el.querySelector('.mc-achn').textContent = S.achN + ' / ' + ACH.length;
    }
    function showDeath() {
        var d = RT.el.querySelector('.mc-death');
        d.querySelector('.mc-dscore').textContent = 'Score: ' + (S.achN * 100 + ((S.hrs * 60) | 0));
        d.style.display = '';
    }
    function hideDeath() { RT.el.querySelector('.mc-death').style.display = 'none'; RT.el.focus(); }
    function sleepTick(dt) {
        if (!RT.sleep) return;
        RT.sleep += dt;
        var ov = RT.el.querySelector('.mc-sleepov');
        ov.style.display = '';
        ov.style.opacity = Math.min(1, RT.sleep / 1.2);
        if (RT.sleep > 1.6) {
            S.t = DAY_MS * 0.02;   // sunrise
            RT.sleep = 0;
            ov.style.display = 'none';
            toast('Rise and shine');
        }
    }

    /* ── F3 ─────────────────────────────────────────────────── */
    function paintDebug() {
        var d = RT.el.querySelector('.mc-debug');
        if (!RT.f3) { d.style.display = 'none'; return; }
        d.style.display = '';
        var bx = Math.floor(S.px), by = Math.floor(S.py), bz = Math.floor(S.pz);
        var dirs = ['south +Z', 'west -X', 'north -Z', 'east +X'];
        var dir = dirs[((Math.round(S.yaw / (Math.PI / 2)) % 4) + 4) % 4];
        d.innerHTML = 'Minecraft (comp/urecraft)<br>' +
            RT.fps + ' fps, ' + RT.ckeys.length + ' chunks, ' + (RT.foes.length + RT.drops.length) + ' entities<br>' +
            'XYZ: ' + S.px.toFixed(2) + ' / ' + S.py.toFixed(2) + ' / ' + S.pz.toFixed(2) + '<br>' +
            'Block: ' + bx + ' ' + by + ' ' + bz + '  Facing: ' + dir + '<br>' +
            'Light: ' + getSky(bx, by, bz) + ' sky, ' + getBlk(bx, by, bz) + ' block<br>' +
            'Biome: ' + ['Plains', 'Forest', 'Desert', 'Mountains'][biomeAt(bx, bz)] + '  Seed: ' + S.seed;
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
        function base() { return 1 + (rng() * 8 | 0) + Math.floor(shelves / 2) + (rng() * (shelves + 1) | 0); }
        var b = base();
        var lv = [Math.max(1, Math.floor(b / 3)), Math.floor(b * 2 / 3) + 1, Math.max(b, shelves * 2)];
        RT.enchOpts = [];
        for (var i = 0; i < 3; i++) {
            var er = rollEnchants(it, lv[i], rng);
            var main = er ? Object.keys(er)[0] : null;
            RT.enchOpts.push({ level: lv[i], lapis: i + 1, ench: er, label: main ? ENCH_NAME[main] + ' ' + (ROMAN[er[main]] || er[main]) + (Object.keys(er).length > 1 ? ' …' : '') : '—' });
        }
    }
    function applyEnchOption(i) {
        var o = RT.enchOpts && RT.enchOpts[i]; if (!o || !o.ench) return;
        var it = RT.enchItem, lap = RT.enchLapis;
        if (!enchantable(it)) return;
        if (S.xpl < o.level) { toast('Not a high enough level'); return; }
        if (!lap || lap.c < o.lapis) { toast('Not enough Lapis Lazuli'); return; }
        if (S.xpl < o.lapis) { toast('Not enough experience'); return; }   // the slot number is the real level charge
        takeXpLevels(o.lapis);                       // enchanting costs levels
        lap.c -= o.lapis; if (!lap.c) RT.enchLapis = null;
        if (it.id === 'book') it.id = 'ench_book';
        it.ench = o.ench;
        RT.enchSeed = (Math.random() * 1e9) | 0; RT.enchOpts = null;
        snd('enchant'); unlock('enchant');
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
        if (RT.anvilName && RT.anvilName !== (a.name || '')) { out.name = RT.anvilName; cost += 1; did = true; }
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
        return { out: out, cost: Math.max(1, cost), usedB: usedB };
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
    function applyAnvil() {
        var res = anvilResult(); if (!res) return;
        if (S.xpl < res.cost) { toast('Not enough experience'); return; }
        takeXpLevels(res.cost);
        var out = res.out; if (RT.anvilName) out.name = RT.anvilName;
        RT.anvilA = null;
        if (res.usedB) RT.anvilB = null;   // a rename-only apply must not eat slot B
        RT.anvilName = '';
        // clear the visible name box too, or it keeps showing the old text while RT.anvilName is
        // empty and the next rename silently produces nothing until the player retypes
        var nameIn = RT.el && RT.el.querySelector('.mc-anvin');
        if (nameIn) nameIn.value = '';
        var left = invGive(out.id, out.c, out.dur, out.ench, out.name);   // hand back the whole stack, enchant + name intact
        if (left > 0) dropItem(S.px, S.py + 1, S.pz, out.id, left, out.dur, false, out.ench, out.name);
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
    var CTABS = [
        { id: 'build',  t: 'Building Blocks',    ic: 'stonebrick' },
        { id: 'deco',   t: 'Decorations',        ic: 'poppy' },
        { id: 'tools',  t: 'Tools',              ic: 'iron_pick' },
        { id: 'combat', t: 'Combat',             ic: 'iron_sword' },
        { id: 'food',   t: 'Foodstuffs',         ic: 'apple' },
        { id: 'mat',    t: 'Materials',          ic: 'iron' },
        { id: 'misc',   t: 'Miscellaneous',      ic: 'lava_bucket' },
        { id: 'search', t: 'Search Items',       ic: 'table' },
        { id: 'inv',    t: 'Survival Inventory', ic: 'chest' }
    ];
    var CLIST = null;
    function creativeTables() {
        if (CLIST) return CLIST;
        var i, k;
        var tools = [], combat = [], misc = ['bucket', 'water_bucket', 'lava_bucket', 'flint_steel', 'ench_book', 'egg'];
        for (k = 0; k < 4; k++) for (i = 1; i <= 5; i++) tools.push(TIER_N[i] + '_' + ['pick', 'axe', 'shovel', 'hoe'][k]);
        tools.push('bucket', 'flint_steel');
        for (i = 1; i <= 5; i++) combat.push(TIER_N[i] + '_sword');
        for (i = 0; i < ARM_TIERS.length; i++) for (k = 0; k < 4; k++) combat.push(ARM_TIERS[i] + '_' + ['helm', 'chest', 'legs', 'boots'][k]);
        combat.push('bow', 'arrow');
        for (k in EGG_COL) misc.push('egg_' + k);
        CLIST = {
            build: ['stone', 'cobble', 'stonebrick', 'bricks', 'sandstone', 'grass_block', 'grass_snow', 'dirt', 'sand',
                    'gravel', 'clay', 'log', 'planks', 'leaves', 'glass', 'wool', 'obsidian', 'bedrock',
                    'ore_coal', 'ore_iron', 'ore_gold', 'ore_diamond', 'ore_redstone', 'ore_lapis', 'ore_emerald'],
            deco: ['torch', 'rlamp', 'ladder', 'table', 'furnace', 'chest', 'bookshelf', 'etable', 'anvil', 'bed',
                   'cake', 'tnt', 'dandelion', 'poppy', 'tallgrass', 'mushroom', 'mushroom_r', 'cactus',
                   'sugarcane', 'pumpkin', 'melon'],
            tools: tools,
            combat: combat,
            food: ['apple', 'bread', 'cookie', 'melon_slice', 'pumpkin_pie', 'mushroom_stew', 'carrot', 'golden_carrot',
                   'potato', 'baked_potato', 'golden_apple', 'pork_raw', 'pork', 'beef_raw', 'beef', 'mutton_raw',
                   'mutton', 'chicken_raw', 'chicken', 'flesh', 'milk_bucket'],
            mat: ['stick', 'coal', 'charcoal', 'iron', 'gold', 'diamond', 'emerald', 'redstone', 'lapis', 'flint',
                  'feather', 'leather', 'string', 'gunpowder', 'bone', 'bonemeal', 'paper', 'book', 'sugar',
                  'slimeball', 'ink_sac', 'ender_pearl', 'clay_ball', 'brick', 'wheat', 'seeds', 'seeds_pumpkin',
                  'seeds_melon', 'bowl'],
            misc: misc
        };
        // a rename anywhere in I{} must leave a shorter list, never a hole in the grid
        for (k in CLIST) CLIST[k] = CLIST[k].filter(function (id) { return !!I[id]; });
        return CLIST;
    }
    function creativeItems() {
        var tab = CTABS[RT.cTab] || CTABS[0];
        if (tab.id !== 'search') return creativeTables()[tab.id] || [];
        var q = String(RT.cSearch || '').trim().toLowerCase(), all = Object.keys(I);
        if (!q) return all;
        return all.filter(function (id) {   // matches the label a player reads and the id a command takes
            return id.indexOf(q) >= 0 || String(I[id].t || '').toLowerCase().indexOf(q) >= 0;
        });
    }
    function creativeStack(id) {
        if (!id || !I[id]) return null;
        var st = { id: id, c: stkMax(id) }, md = itemMaxDur(id);
        if (md != null) st.dur = md;
        return st;
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
        if (RT.cScroll !== was) paintPanel();
    }
    function creativeBarTo(bar, clientY) {
        var max = creativeMaxScroll();
        if (max <= 0) return;
        var r = bar.getBoundingClientRect();
        var v = Math.max(0, Math.min(max, Math.round((clientY - r.top) / Math.max(1, r.height) * max)));
        if (v !== RT.cScroll) { RT.cScroll = v; paintPanel(); }
    }
    function creativeTab(i) {
        i = Math.max(0, Math.min(CTABS.length - 1, i | 0));
        if (i === RT.cTab) return;
        RT.cTab = i;
        RT.cScroll = 0;
        if (CTABS[i].id === 'search') RT.cSearch = '';   // the real one opens the box empty
        creativeRefresh();
        creativeRender();
        snd('click');
    }
    function creativeRender() {   // a tab switch replaces the markup; the carried stack survives it
        var wrap = RT.el.querySelector('.mc-panelwrap');
        if (!wrap) return;
        wrap.innerHTML = '<div class="mc-panel mc-cpanel">' + panelHTML('creative') + '</div><div class="mc-cur"></div><div class="mc-ptip" style="display:none"></div>';
        wirePanelFields(wrap);
        paintPanel();   // re-places the carried ghost from RT.curXY
        /* The innerHTML swap above destroys whatever had focus. Switching AWAY from
           the search tab therefore dropped focus onto <body>, and since the key
           handlers live on .mc the whole game went keyboard-dead — E, Esc and WASD
           all stopped, with nothing on screen to explain it. */
        var sb = wrap.querySelector('.mc-csearchin');
        if (sb) { sb.focus(); sb.setSelectionRange(sb.value.length, sb.value.length); }
        else RT.el.focus();
    }
    function creativeClick(idx, right, shift) {
        var id = (RT.cList || [])[RT.cScroll * CCOLS + idx];
        // carrying something onto the catalogue throws it away — even over a gap
        // in the last row, which is what the real screen does too
        if (RT.cur) { RT.cur = null; snd('click'); paintPanel(); paintHotbar(); return; }
        if (!id) return;
        var st = creativeStack(id);
        if (right) st.c = 1;                        // right-click takes exactly one
        if (shift) {                                 // shift-click posts a full stack straight into the bar
            if (invGive(st.id, st.c, st.dur) === st.c) return;
            snd('pop');
        } else { RT.cur = st; snd('click'); }
        paintPanel(); paintHotbar();
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
        if (g === 'craft') return { get: function (i) { return RT.craft[i]; }, set: function (i, v) { RT.craft[i] = v; } };
        if (g === 'ein') return { get: function () { return RT.enchItem; }, set: function (i, v) { RT.enchItem = v; genEnchOptions(); } };
        if (g === 'elapis') return { get: function () { return RT.enchLapis; }, set: function (i, v) { RT.enchLapis = v; } };
        if (g === 'anvA') return { get: function () { return RT.anvilA; }, set: function (i, v) { RT.anvilA = v; } };
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
    function panelHTML(kind) {
        var head = '<div class="mc-phead">', inv =
            '<div class="mc-plabel">Inventory</div><div class="mc-pgrid g9">' + slotsHTML('inv', 9, 27) + '</div>' +
            '<div class="mc-pgrid g9 hb">' + slotsHTML('inv', 0, 9) + '</div>';
        var armorCol = '<div class="mc-armcol">' + slotsHTML('armor', 0, 4, 'armslot') + '</div>';
        if (kind === 'inv') return head + 'Crafting</div><div class="mc-craftrow"><div class="mc-pgrid g2">' + slotsHTML('craft', 0, 4) + '</div><span class="mc-arrow">➜</span><div class="mc-slot big" data-g="cout" data-i="0"></div>' + armorCol + '</div>' + inv;
        if (kind === 'table') return head + 'Crafting</div><div class="mc-craftrow"><div class="mc-pgrid g3">' + slotsHTML('craft', 0, 9) + '</div><span class="mc-arrow">➜</span><div class="mc-slot big" data-g="cout" data-i="0"></div></div>' + inv;
        if (kind === 'furnace') return head + 'Furnace</div><div class="mc-craftrow furn"><div class="mc-fcol"><div class="mc-slot" data-g="fin" data-i="0"></div><div class="mc-flame"><i></i></div><div class="mc-slot" data-g="ffuel" data-i="0"></div></div><div class="mc-farrow"><i></i></div><div class="mc-slot big" data-g="fout" data-i="0"></div></div>' + inv;
        if (kind === 'ench') return head + 'Enchant</div><div class="mc-enchrow"><div class="mc-fcol"><div class="mc-slot" data-g="ein" data-i="0"></div><div class="mc-slot small" data-g="elapis" data-i="0"></div></div><div class="mc-enchopts">' +
            '<button class="mc-enchopt" data-o="0"></button><button class="mc-enchopt" data-o="1"></button><button class="mc-enchopt" data-o="2"></button></div></div>' + inv;
        if (kind === 'anvil') return head + 'Repair &amp; Name</div><div class="mc-craftrow"><div class="mc-slot" data-g="anvA" data-i="0"></div><div class="mc-slot" data-g="anvB" data-i="0"></div><span class="mc-arrow">➜</span><div class="mc-slot big anvOut" data-g="anvOut" data-i="0"></div></div>' +
            '<div class="mc-anvname"><input class="mc-anvin" maxlength="24" placeholder="Item name"><span class="mc-anvcost"></span></div>' + inv;
        if (kind === 'creative') {
            var tab = CTABS[RT.cTab] || CTABS[0], ti, tabs = '';
            for (ti = 0; ti < CTABS.length; ti++)
                tabs += '<button class="mc-ctab' + (ti === RT.cTab ? ' on' : '') + '" data-ct="' + ti + '"' +
                        ' title="' + escHtml(CTABS[ti].t) + '" style="background-image:url(' + iconURL(CTABS[ti].ic) + ')"></button>';
            tabs = '<div class="mc-ctabs">' + tabs + '</div>';
            // the survival tab is the ordinary inventory plus a bin
            if (tab.id === 'inv') return tabs + head + 'Survival Inventory</div>' +
                '<div class="mc-craftrow"><div class="mc-pgrid g2">' + slotsHTML('craft', 0, 4) + '</div><span class="mc-arrow">➜</span>' +
                '<div class="mc-slot big" data-g="cout" data-i="0"></div>' + armorCol +
                '<div class="mc-slot big ctrash" data-g="ctrash" data-i="0" title="Destroy item"></div></div>' + inv;
            return tabs + head + escHtml(tab.t) + '</div>' +
                (tab.id === 'search' ? '<input class="mc-csearchin" maxlength="32" spellcheck="false" autocomplete="off" placeholder="Search" value="' + escHtml(RT.cSearch || '') + '">' : '') +
                '<div class="mc-crow"><div class="mc-pgrid g9">' + slotsHTML('creat', 0, CGRID) + '</div>' +
                '<div class="mc-cbar"><i></i></div></div>' +
                '<div class="mc-plabel">Inventory</div><div class="mc-pgrid g9 hb">' + slotsHTML('inv', 0, 9) + '</div>';
        }
        return head + 'Chest</div><div class="mc-pgrid g9">' + slotsHTML('chest', 0, 27) + '</div>' + inv;
    }
    function openPanel(kind, t) {
        closePanel(true);
        RT.panel = { kind: kind, key: t ? tentKey(t.x, t.y, t.z) : null };
        if (kind === 'furnace') tentAt(t.x, t.y, t.z, 'furnace');
        if (kind === 'chest') tentAt(t.x, t.y, t.z, 'chest');
        RT.craftW = kind === 'table' ? 3 : 2;
        RT.craft = [null, null, null, null, null, null, null, null, null];
        if (kind === 'ench') { RT.enchItem = null; RT.enchLapis = null; RT.enchOpts = null; RT.enchSeed = (Math.random() * 1e9) | 0; }
        if (kind === 'anvil') { RT.anvilA = null; RT.anvilB = null; RT.anvilName = ''; }
        // the catalogue has to exist before panelHTML asks it how many rows it has
        if (kind === 'creative') { if (RT.cTab == null) RT.cTab = 0; RT.cScroll = 0; creativeRefresh(); }
        var wrap = RT.el.querySelector('.mc-panelwrap');
        wrap.innerHTML = '<div class="mc-panel' + (kind === 'creative' ? ' mc-cpanel' : '') + '">' + panelHTML(kind) + '</div><div class="mc-cur"></div><div class="mc-ptip" style="display:none"></div>';
        wrap.style.display = '';
        unlockCursor();
        // .mc-panelwrap is a PERSISTENT node — only its innerHTML is replaced per open. Re-running
        // wirePanel on it stacked another set of delegated listeners every time, so after N opens a
        // single slot click ran slotClick N times (items silently duplicated, vanished, or the click
        // appeared to do nothing at all on an even count).
        if (!wrap._wired) { wirePanel(wrap); wrap._wired = 1; }
        wirePanelFields(wrap);   // the anvil name box is inside the fresh markup, so it re-wires
        paintPanel();
        // reopening on the Search tab used to hand you an unfocused box with your old
        // query still in it, so the first letter you typed went to the world instead:
        // "emerald" closed the inventory on the e and strafed on the a
        var sb0 = wrap.querySelector('.mc-csearchin');
        if (sb0) { sb0.focus(); sb0.setSelectionRange(sb0.value.length, sb0.value.length); }
        if (kind === 'inv' || kind === 'table') unlock('inventory');
        snd('click');
    }
    function closePanel(silent) {
        if (!RT.panel) return;
        var i, give = [RT.cur, RT.enchItem, RT.enchLapis, RT.anvilA, RT.anvilB];
        for (i = 0; i < 9; i++) { give.push(RT.craft[i]); RT.craft[i] = null; }
        RT.cur = null; RT.enchItem = null; RT.enchLapis = null; RT.anvilA = null; RT.anvilB = null; RT.enchOpts = null;
        for (i = 0; i < give.length; i++) {
            if (!give[i]) continue;
            var left = invGive(give[i].id, give[i].c, give[i].dur, give[i].ench, give[i].name);
            if (left) dropItem(S.px, S.py + 1, S.pz, give[i].id, left, give[i].dur, false, give[i].ench, give[i].name);
        }
        RT.panel = null;
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
        var anv = RT.panel.kind === 'anvil' ? anvilResult() : null;
        for (var i = 0; i < cells.length; i++) {
            var g = cells[i].getAttribute('data-g'), idx = cells[i].getAttribute('data-i') | 0;
            if (g === 'cout') { var r = matchRecipe(RT.craft, RT.craftW); paintSlot(cells[i], r ? { id: r.out, c: r.n } : null); }
            else if (g === 'anvOut') paintSlot(cells[i], anv ? anv.out : null);
            else paintSlot(cells[i], slotGroup(g).get(idx));
        }
        var cur = wrap.querySelector('.mc-cur');
        if (cur) {
            /* display:'block', NOT ''. Clearing the inline rule hands the element
               back to the stylesheet, which declares .mc-cur{display:none} — so
               for as long as this screen has existed, the stack you picked up
               vanished off the screen while RT.cur really was holding it. */
            if (RT.cur) {
                cur.style.display = 'block';
                cur.style.backgroundImage = 'url(' + iconURL(RT.cur.id) + ')';
                cur.innerHTML = RT.cur.c > 1 ? '<span class="mc-ct">' + RT.cur.c + '</span>' : '';
                // place it before it is ever shown: .mc-panelwrap centres its
                // children, so an unpositioned ghost would appear over the panel
                panelCurTo();
            } else cur.style.display = 'none';
        }
        if (RT.panel.kind === 'furnace') paintFurnaceBits(S.tents[RT.panel.key]);
        if (RT.panel.kind === 'ench') {
            var opts = wrap.querySelectorAll('.mc-enchopt');
            for (var o = 0; o < opts.length; o++) {
                var op = RT.enchOpts && RT.enchOpts[o];
                if (!op || !op.ench) { opts[o].style.display = 'none'; continue; }
                opts[o].style.display = '';
                /* enchantable() also demands a single item, so two books in the slot
                   left all three options lit and clicking them did nothing at all —
                   no sound, no message, no explanation */
                var single = RT.enchItem && RT.enchItem.c === 1;
                var afford = single && S.xpl >= op.level && RT.enchLapis && RT.enchLapis.c >= op.lapis;
                opts[o].className = 'mc-enchopt' + (afford ? '' : ' dim');
                opts[o].innerHTML = '<span class="eo-lap">' + op.lapis + '</span><span class="eo-txt">' + esc(op.label) + '</span><span class="eo-lvl">' + op.level + '</span>';
            }
        }
        if (RT.panel.kind === 'anvil') {
            var cs = wrap.querySelector('.mc-anvcost');
            if (cs) cs.textContent = anv ? ('Cost: ' + anv.cost + (S.xpl >= anv.cost ? '' : ' (need level ' + anv.cost + ')')) : '';
        }
        if (RT.panel.kind === 'creative') {
            var bar = wrap.querySelector('.mc-cbar'), th = bar && bar.querySelector('i');
            if (th) {
                var rows = creativeRows(), mx = creativeMaxScroll();
                var hp = Math.max(14, CROWS / rows * 100);
                th.style.height = hp + '%';
                th.style.top = (mx ? (RT.cScroll / mx) * (100 - hp) : 0) + '%';
                bar.classList.toggle('off', mx === 0);   // greyed out when there is nothing to scroll
            }
        }
    }
    function esc(s) { return String(s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); }
    function paintFurnaceBits(t) {
        var wrap = RT.el.querySelector('.mc-panelwrap');
        if (!wrap) return;
        var fl = wrap.querySelector('.mc-flame i'), ar = wrap.querySelector('.mc-farrow i');
        if (fl) fl.style.height = (t.burnMax > 0 ? Math.max(0, t.burn / t.burnMax) * 100 : 0) + '%';
        if (ar) ar.style.width = (t.prog / SMELT_S * 100) + '%';
    }
    function takeCraft(shiftAll) {
        var guard = 0;
        do {
            var r = matchRecipe(RT.craft, RT.craftW);
            if (!r) return;
            if (shiftAll) {
                if (invFree(r.out) < r.n) return;   // must fit fully, or we'd deposit output without consuming ingredients
                invGive(r.out, r.n);
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
            craftHooks(r.out);
            snd('click');
        } while (shiftAll && guard++ < 64);
    }
    function quickMove(g, idx) {
        var grp = slotGroup(g), st = grp.get(idx);
        if (!st) return;
        // shift-clicking your own stack while the catalogue is up throws it away.
        // There is nowhere for it to go, and the real screen deletes it too.
        if (RT.panel.kind === 'creative' && (CTABS[RT.cTab] || CTABS[0]).id !== 'inv') {
            grp.set(idx, null); snd('click'); paintPanel();
            return;
        }
        var left;
        if (g === 'inv') {
            /* shift-click armour → equip it, but ONLY from a screen that shows the
               armour column. Everywhere else this fired first and swallowed the
               piece: shift-click a chestplate at a chest expecting it to go IN the
               chest and it vanished from the grid onto your body, off screen. */
            var adef = I[st.id] && I[st.id].armor;
            var hasArmorCol = RT.panel.kind === 'inv' || RT.panel.kind === 'creative';
            if (adef && hasArmorCol && !S.armor[adef.slot]) {
                slotGroup('armor').set(adef.slot, st);   // via the setter, so "Suit Up" fires
                grp.set(idx, null); paintVitals(); paintPanel();
                return;
            }
            if (RT.panel.kind === 'chest') {
                var t = S.tents[RT.panel.key];
                left = giveInto(t.inv, 27, st);
            } else if (RT.panel.kind === 'furnace') {
                var tf = S.tents[RT.panel.key];
                if (I[st.id] && I[st.id].fuel && !SMELTS[st.id]) { left = mergeSlot(tf, 'fuel', st); }
                else if (SMELTS[st.id]) { left = mergeSlot(tf, 'fin', st); }
                else left = st.c;
            } else {
                // hotbar ↔ backpack
                var src = st;
                grp.set(idx, null);
                var range = idx < 9 ? [9, 36] : [0, 9];
                var l2 = invGiveRange(src.id, src.c, src.dur, range[0], range[1], src.ench, src.name);
                if (l2) { grp.set(idx, { id: src.id, c: l2, dur: src.dur, ench: src.ench, name: src.name }); }
                paintPanel();
                return;
            }
        } else {
            if (g === 'fout' && st) { if (st.id === 'iron') unlock('iron'); }
            left = invGive(st.id, st.c, st.dur, st.ench, st.name);
        }
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
        if (g === 'cout') { takeCraft(shift); paintPanel(); paintHotbar(); return; }
        if (g === 'anvOut') { applyAnvil(); return; }
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
            if (!RT.cur) { RT.cur = st; grp.set(idx, null); if (st.id === 'iron') unlock('iron'); }
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
    /* Park the carried-item ghost and the tooltip at the pointer. The last
       position is kept on RT so a repaint, a tab switch or a panel that opens
       under a stationary mouse all place them correctly rather than letting
       .mc-panelwrap's flex centring drop them over the middle of the screen. */
    function panelCurTo(clientX, clientY) {
        if (!RT || !RT.el) return;
        if (clientX != null) RT.curXY = [clientX, clientY];
        var xy = RT.curXY;
        if (!xy) return;
        var wrap = RT.el.querySelector('.mc-panelwrap');
        if (!wrap) return;
        var r = wrap.getBoundingClientRect(), x = xy[0] - r.left, y = xy[1] - r.top;
        var cur = wrap.querySelector('.mc-cur');
        if (cur) { cur.style.left = (x + 6) + 'px'; cur.style.top = (y + 6) + 'px'; }
        var tip = wrap.querySelector('.mc-ptip');
        if (tip && tip.style.display !== 'none') {
            // keep the label on screen when the pointer is near the right edge
            var tw = tip.offsetWidth || 90;
            tip.style.left = Math.max(0, Math.min(r.width - tw, x + 14)) + 'px';
            tip.style.top = (y - 8) + 'px';
        }
    }
    function wirePanel(wrap) {
        function handler(e) {
            var el = e.target;
            while (el && el !== wrap && el.getAttribute && !el.getAttribute('data-g') &&
                   el.getAttribute('data-o') == null && el.getAttribute('data-ct') == null) el = el.parentNode;
            if (!el || el === wrap) return;
            var ct = el.getAttribute && el.getAttribute('data-ct');
            if (ct != null) { creativeTab(ct | 0); e.preventDefault(); e.stopPropagation(); return; }
            var eo = el.getAttribute && el.getAttribute('data-o');
            if (eo != null) { applyEnchOption(eo | 0); e.preventDefault(); e.stopPropagation(); return; }
            slotClick(el.getAttribute('data-g'), el.getAttribute('data-i') | 0, e.type === 'contextmenu', e.shiftKey);
            e.preventDefault(); e.stopPropagation();
        }
        function barAt(t) { return t && t.closest ? t.closest('.mc-cbar') : null; }
        /* Middle-click any slot in creative and you get a full stack of whatever
           is in it, leaving the slot alone. Gated on instaBuild(): this listener
           is attached once and serves every panel kind, so ungated it would be an
           item duplicator inside a survival chest. */
        function cloneSlot(e) {
            if (!instaBuild()) return;
            var el = e.target;
            while (el && el !== wrap && el.getAttribute && !el.getAttribute('data-g')) el = el.parentNode;
            if (!el || el === wrap || !el.getAttribute) return;
            var g = el.getAttribute('data-g');
            if (g === 'ctrash' || g === 'anvOut') return;
            var grp = g === 'creat' ? slotGroup('creat') : slotGroup(g);
            var st = grp ? grp.get(el.getAttribute('data-i') | 0) : null;
            if (!st) return;
            RT.cur = creativeStack(st.id);
            snd('click'); paintPanel();
        }
        // remember where the pointer is on EVERY mouse event, not just movement:
        // a click without a preceding mousemove must still put the ghost under it
        wrap.addEventListener('mousedown', function (e) {
            panelCurTo(e.clientX, e.clientY);
            if (e.button === 1) { cloneSlot(e); e.preventDefault(); e.stopPropagation(); return; }
            if (e.button !== 0) return;
            var bar = barAt(e.target);
            if (bar) { RT.cDrag = 1; creativeBarTo(bar, e.clientY); e.preventDefault(); e.stopPropagation(); return; }
            handler(e);
        });
        wrap.addEventListener('auxclick', function (e) { if (e.button === 1) e.preventDefault(); });
        wrap.addEventListener('contextmenu', function (e) { panelCurTo(e.clientX, e.clientY); handler(e); });
        wrap.addEventListener('mousemove', function (e) {
            // a drag whose mouseup was swallowed (alt-tab, screen lock, the shell
            // minimising us) must not leave the scrollbar stuck to the pointer
            if (RT.cDrag && !(e.buttons & 1)) RT.cDrag = 0;
            if (RT.cDrag) { var bar = wrap.querySelector('.mc-cbar'); if (bar) creativeBarTo(bar, e.clientY); }
            panelCurTo(e.clientX, e.clientY);
            var cur = wrap.querySelector('.mc-cur');
            if (!cur) return;
            /* name whatever is under the pointer. The real game does this in every
               screen, and the catalogue needs it badly: at 32px, stone, cobblestone
               and stone bricks are three grey squares. */
            var tip = wrap.querySelector('.mc-ptip');
            if (!tip) return;
            var st = null, el = e.target;
            while (el && el !== wrap && el.getAttribute && !el.getAttribute('data-g')) el = el.parentNode;
            if (el && el !== wrap && el.getAttribute) {
                var g = el.getAttribute('data-g'), i = el.getAttribute('data-i') | 0, rr;
                if (g === 'cout') { rr = matchRecipe(RT.craft, RT.craftW); st = rr ? { id: rr.out, c: rr.n } : null; }
                else if (g === 'anvOut') { rr = anvilResult(); st = rr ? rr.out : null; }
                else { var gp = slotGroup(g); st = gp ? gp.get(i) : null; }
            }
            if (st && !RT.cur) {
                tip.textContent = st.name || (I[st.id] ? I[st.id].t : st.id);
                tip.style.display = 'block';
                panelCurTo(e.clientX, e.clientY);   // re-place now that it has width
            } else tip.style.display = 'none';
        });
        wrap.addEventListener('mouseleave', function () {
            var tip = wrap.querySelector('.mc-ptip');
            if (tip) tip.style.display = 'none';
        });
    }
    function wirePanelFields(wrap) {   // per-render nodes: re-wired on every open (fresh innerHTML)
        var srch = wrap.querySelector('.mc-csearchin');
        if (srch) {
            srch.addEventListener('input', function () {
                RT.cSearch = srch.value;
                RT.cScroll = 0;
                creativeRefresh();
                paintPanel();
            });
            // the box owns the keyboard while it has focus, or typing "e" would
            // slam the inventory shut mid-search. Esc still gets you out.
            srch.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') { srch.blur(); closePanel(); return; }
                e.stopPropagation();
            });
            srch.addEventListener('keyup', function (e) { e.stopPropagation(); });
            srch.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        }
        var nameIn = wrap.querySelector('.mc-anvin');
        if (nameIn) {
            nameIn.addEventListener('input', function () { RT.anvilName = nameIn.value; paintPanel(); });
            // typing must not drive the game — but Esc still has to close the panel, or the
            // name box swallows the only key that gets you out
            nameIn.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') { nameIn.blur(); closePanel(); return; }
                e.stopPropagation();
            });
            nameIn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        }
    }

    /* ── audio: everything synthesized ──────────────────────── */
    var AC = null, NOISE = null, MASTER = null;
    function audioInit() {
        if (AC) return;
        try {
            AC = new (window.AudioContext || window.webkitAudioContext)();
            MASTER = AC.createGain(); MASTER.gain.value = 0.34; MASTER.connect(AC.destination);
            NOISE = AC.createBuffer(1, AC.sampleRate * 1.2, AC.sampleRate);
            var d = NOISE.getChannelData(0);
            for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { AC = null; }
    }
    function tone(freq, endFreq, dur, type, vol, when, attack) {
        if (!AC) return;
        var t = AC.currentTime + (when || 0);
        var o = AC.createOscillator(), g = AC.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, t);
        if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.01));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(MASTER);
        o.start(t); o.stop(t + dur + 0.05);
    }
    function hiss(dur, vol, freq, when, q) {
        if (!AC) return;
        var t = AC.currentTime + (when || 0);
        var s = AC.createBufferSource(); s.buffer = NOISE;
        s.loop = true; s.playbackRate.value = 0.6 + Math.random() * 0.5;
        var f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q || 1;
        var g = AC.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(MASTER);
        s.start(t); s.stop(t + dur + 0.05);
    }
    var DIG_F = {};
    DIG_F[STONE] = 900; DIG_F[COBBLE] = 900; DIG_F[ORE_COAL] = 900; DIG_F[ORE_IRON] = 900; DIG_F[ORE_GOLD] = 900;
    DIG_F[ORE_DIA] = 900; DIG_F[FURN] = 900; DIG_F[FURN_LIT] = 900; DIG_F[BEDROCK] = 900;
    DIG_F[LOG] = 480; DIG_F[PLANKS] = 480; DIG_F[TABLE] = 480; DIG_F[CHEST] = 480; DIG_F[BED] = 480;
    DIG_F[SAND] = 2600; DIG_F[GRAVEL] = 2200; DIG_F[LEAVES] = 3200; DIG_F[WOOL] = 1600; DIG_F[TALLGRASS] = 3200;
    function snd(name, arg) {
        if (!S || !S.snd || !AC) return;
        switch (name) {
            case 'dig': hiss(0.14, 0.5, DIG_F[arg] || 1400, 0, 2); break;
            case 'place': hiss(0.09, 0.4, (DIG_F[arg] || 1400) * 0.8, 0, 3); tone(140, 90, 0.07, 'triangle', 0.25); break;
            case 'step': hiss(0.05, 0.16, (DIG_F[arg] || 1400) * 1.2); break;
            case 'hurt': tone(260, 130, 0.18, 'square', 0.3); break;
            case 'fall': hiss(0.2, 0.5, 700, 0, 2); tone(120, 60, 0.2, 'square', 0.28); break;
            case 'die': tone(300, 60, 0.7, 'sawtooth', 0.3); break;
            case 'pop': tone(430, 800, 0.09, 'sine', 0.3); break;
            case 'click': tone(820, 0, 0.04, 'square', 0.13); break;
            case 'eat': hiss(0.07, 0.35, 2400, 0, 4); tone(320 + Math.random() * 120, 200, 0.06, 'triangle', 0.14); break;
            case 'burp': tone(160, 70, 0.32, 'sawtooth', 0.26); break;
            case 'break': tone(600, 120, 0.25, 'square', 0.24); hiss(0.2, 0.3, 3000); break;
            case 'hit': hiss(0.08, 0.4, 900, 0, 3); tone(220, 140, 0.1, 'square', 0.2); break;
            case 'bow': hiss(0.14, 0.35, 2600, 0, 5); tone(500, 900, 0.12, 'sine', 0.16); break;
            case 'thud': hiss(0.08, 0.4, 500); break;
            case 'fuse': hiss(1.4, 0.34, 4200, 0, 8); break;
            case 'boom': hiss(1.1, 0.9, 300, 0, 0.5); tone(90, 30, 0.9, 'sine', 0.6); RT.el && tone(50, 25, 1.2, 'sine', 0.5, 0.05); break;
            case 'ding': tone(720, 0, 0.35, 'sine', 0.22); tone(1080, 0, 0.5, 'sine', 0.2, 0.12); break;
            case 'poof': hiss(0.25, 0.35, 1800); break;
            case 'pig': tone(300, 210, 0.13, 'square', 0.2); tone(260, 190, 0.1, 'square', 0.16, 0.14); break;
            case 'cow': tone(150, 95, 0.55, 'sawtooth', 0.2, 0, 0.12); break;
            case 'sheep': tone(240, 225, 0.4, 'square', 0.15, 0, 0.05); tone(252, 232, 0.4, 'square', 0.1, 0.02, 0.05); break;
            case 'chicken': tone(430, 380, 0.08, 'square', 0.12); tone(480, 420, 0.08, 'square', 0.12, 0.12); tone(400, 360, 0.09, 'square', 0.12, 0.26); break;
            case 'zombie': tone(110, 75, 0.5, 'sawtooth', 0.2, 0, 0.15); break;
            case 'skel': for (var i = 0; i < 4; i++) hiss(0.04, 0.2, 2200 + i * 300, i * 0.07, 6); break;
            case 'spider': hiss(0.3, 0.22, 1400, 0, 8); break;
            case 'orb': tone(660 + Math.random() * 200, 0, 0.08, 'sine', 0.12); break;
            case 'level': tone(520, 780, 0.18, 'sine', 0.2); tone(780, 0, 0.2, 'sine', 0.14, 0.08); break;
            case 'levelbig': tone(520, 780, 0.2, 'sine', 0.24); tone(660, 990, 0.25, 'sine', 0.2, 0.1); tone(990, 0, 0.3, 'sine', 0.16, 0.2); break;
            case 'enchant': for (var e = 0; e < 5; e++) tone(600 + Math.random() * 700, 0, 0.14, 'sine', 0.1, e * 0.06); hiss(0.4, 0.14, 3000, 0, 6); break;
            case 'anvil': tone(220, 130, 0.14, 'square', 0.3); hiss(0.12, 0.4, 700, 0, 3); tone(180, 90, 0.2, 'sawtooth', 0.18, 0.05); break;
            case 'teleport': hiss(0.2, 0.3, 2600, 0, 7); tone(900, 300, 0.18, 'sine', 0.14); break;
            case 'endermad': tone(90, 200, 0.4, 'sawtooth', 0.28, 0, 0.1); break;
            case 'endervoice': tone(70, 55, 0.7, 'sine', 0.16, 0, 0.2); break;
            case 'thunder': hiss(1.4, 1.0, 260, 0, 0.5); tone(70, 28, 1.3, 'sine', 0.6); tone(45, 22, 1.6, 'sine', 0.5, 0.08); break;
        }
    }
    /* a small C418 impression: slow pentatonic wandering, very quiet */
    var PENTA = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784, 880];
    function playMusic() {
        if (!AC || !S.mus) { RT.musT = 20; return; }   // muted now ≠ muted forever: keep the scheduler alive
        var n = 10 + ((Math.random() * 12) | 0), at = 1, idx = 3 + ((Math.random() * 4) | 0);
        for (var i = 0; i < n; i++) {
            idx += (Math.random() * 5 | 0) - 2;
            idx = Math.max(0, Math.min(PENTA.length - 1, idx));
            var f = PENTA[idx], dur = 2.2 + Math.random() * 2;
            tone(f, 0, dur, 'sine', 0.055, at, 0.35);
            tone(f * 2.003, 0, dur, 'triangle', 0.02, at, 0.5);
            if (Math.random() < 0.3) tone(f * 1.5, 0, dur * 1.2, 'sine', 0.03, at + 0.4, 0.5);
            at += 0.9 + Math.random() * 1.8;
        }
        RT.musT = at + 60 + Math.random() * 120;   // next piece a while after this one ends
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
        var json;
        try { json = JSON.stringify(S); } catch (e) { return; }
        try { localStorage.setItem('comp_mc', json); } catch (e) {}
        // comp_mc stays the active world; the per-world blob is what the list reads
        if (S.wid) {
            try { localStorage.setItem(WS_PRE + S.wid, json); } catch (e) {}
            wsTouch(S.wid, { played: Date.now(), hrs: S.hrs || 0, gm: S.gm, diff: S.diff });
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
            if (RT.panel || RT.dead || RT.chat) { unlockCursor(); return; }
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
            mnFrame(RT.menu, dt);
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
            if (heldNow !== RT.equipId) { RT.equipId = heldNow; RT.equip = 1; }
            RT.equip = Math.max(0, RT.equip - dt / EQUIP_T);
            RT.flash = Math.max(0, RT.flash - dt);
            RT.shake = Math.max(0, RT.shake - dt);
            RT.lightning = Math.max(0, (RT.lightning || 0) - dt);
            RT.target = raycast();
            stepPlayer(dt);
            fovTick(dt);
            digTick(dt);
            useTick(dt);
            foodTick(dt);
            effectTick(dt);
            sleepTick(dt);
            var i;
            for (i = RT.foes.length - 1; i >= 0; i--) if (foeUpdate(RT.foes[i], dt)) RT.foes.splice(i, 1);
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
            RT.hudT += dt;
            if (RT.hudT > 0.2) {
                RT.hudT = 0;
                paintVitals(); paintXp(); paintDebug(); tipFade(dt); paintChat(); paintEffects();
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
        entGeo();
        var vig = RT.el.querySelector('.mc-vig');
        var headB = getB(Math.floor(S.px), Math.floor(S.py + EYE), Math.floor(S.pz));
        vig.style.background = RT.lightning > 0 ? 'rgba(255,255,255,' + (RT.lightning * 2.2) + ')'
            : RT.flash > 0 ? 'rgba(200,20,20,' + (RT.flash * 0.9) + ')'
            : headB === WATER ? 'rgba(20,50,180,0.22)' : headB === LAVA ? 'rgba(220,80,10,0.5)' : 'transparent';
        if (RT.shake > 0) {
            var sh = RT.shake * 6;
            RT.cv.style.transform = 'translate(' + ((Math.random() - 0.5) * sh) + 'px,' + ((Math.random() - 0.5) * sh) + 'px)';
        } else RT.cv.style.transform = '';
        drawFrame();
    }
    function tipFade() {
        if (RT.tipT > 0) { RT.tipT -= 0.2; if (RT.tipT <= 0) RT.el.querySelector('.mc-tip').className = 'mc-tip'; }
    }
    function bootBar(f) {
        var b = RT.el.querySelector('.mc-bar i');
        if (b) b.style.width = Math.round(f * 100) + '%';
    }
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
        RT.el.querySelector('.mc-load').style.display = 'none';
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
        RT.foes = []; RT.drops = []; RT.arrows = []; RT.tnts = []; RT.parts = []; RT.entV = []; RT.orbs = [];
        RT.target = null; RT.digAt = null; RT.lit = false; RT.built = false; RT.ready = false;
        /* The panorama renders at 85°; leaving that set would hand the world
           the title screen's field of view. fovM is the sprint stretch and
           belongs to the world that was just thrown away. */
        RT.fov = 0; RT.fovM = 1;
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
        normalizeCmdState();
        if (!S.wspawn) {
            S.wspawn = findSpawn();
            S.px = S.wspawn[0]; S.py = S.wspawn[1]; S.pz = S.wspawn[2];
        }
        if (!blob && w.bonus) S.bonusPending = true;
        RT.baseHrs = S.hrs || 0; RT.playT = 0; RT.dead = S.hp <= 0; RT.fallY = S.py;
        var ld = RT.el.querySelector('.mc-load');
        ld.querySelector('h3').textContent = 'Building terrain…';
        ld.style.display = '';
        bootBar(0);
        ensureChunks();
        wsTouch(id, { played: Date.now(), ver: (RT && RT.ver) || '26.2' });
    }
    /* Vanilla's "Save and Quit to Title": the world is written out, the world
       is thrown away, and the panorama is generated fresh behind the menu. */
    function mnToTitle() {
        sSave();
        if (S && S.wid) wsTouch(S.wid, { played: Date.now(), hrs: S.hrs || 0 });
        unlockCursor();
        if (RT.paused) hidePause();
        if (RT.panel) closePanel(true);
        RT.el.querySelector('.mc-load').style.display = 'none';
        mnTeardownWorld();
        S = mnPanoSave();
        var m = mnOpen('loading', false);   // vanilla only fades in on first launch
        m.stage = 'Saving world…';
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
        'Á': ['A', 'acute'], 'À': ['A', 'grave'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'], 'Ä': ['A', 'uml'], 'Å': ['A', 'ring'],
        'É': ['E', 'acute'], 'È': ['E', 'grave'], 'Ê': ['E', 'circ'], 'Ë': ['E', 'uml'],
        'Í': ['I', 'acute'], 'Ó': ['O', 'acute'], 'Ö': ['O', 'uml'], 'Õ': ['O', 'tilde'],
        'Ú': ['U', 'acute'], 'Ü': ['U', 'uml'], 'Ñ': ['N', 'tilde'], 'Ç': ['C', 'cedil']
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
                // centre the mark over the letter, then OR it into that row
                var off = Math.max(0, (base.w - 5) >> 1), src = mark.rows[i], cur = rows[y] || '', line = '';
                for (var x = 0; x < Math.max(cur.length, off + src.length); x++) {
                    var a = cur.charAt(x) === '#', b = src.charAt(x - off) === '#';
                    line += (a || b) ? '#' : '.';
                }
                rows[y] = line;
            }
            var wmax = base.w;
            for (i = 0; i < rows.length; i++) if (rows[i].length > wmax) wmax = rows[i].length;
            g[ch] = { w: wmax, rows: rows };
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
    /* The widget in its three states. Vanilla nine-slices these out of
       widgets.png at v=46 disabled, v=66 idle, v=86 hovered, and the label is
       0xFFFFFF whenever the button is active and 0xA0A0A0 when it is not —
       hovering does NOT recolour the text, however strongly everyone
       remembers that it does. */
    function mnButton(cx, b, state) {
        var top = state === 2 ? '#4a4a4a' : state === 1 ? '#8f8fae' : '#7a7a7a';
        var bot = state === 2 ? '#2e2e2e' : state === 1 ? '#5f5f80' : '#565656';
        var lite = state === 2 ? '#5e5e5e' : state === 1 ? '#c2c2d8' : '#9e9e9e';
        // a hard black frame first: it is what separates a widget from the dirt
        mnRect(cx, b.x, b.y, b.w, b.h, '#000000');
        var g = cx.createLinearGradient(0, b.y + 1, 0, b.y + b.h - 1);
        g.addColorStop(0, top); g.addColorStop(1, bot);
        cx.fillStyle = g;
        cx.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        mnRect(cx, b.x + 1, b.y + 1, b.w - 2, 1, lite);
        mnRect(cx, b.x + 1, b.y + 1, 1, b.h - 2, lite);
        mnRect(cx, b.x + 1, b.y + b.h - 2, b.w - 2, 1, '#242424');
        mnRect(cx, b.x + b.w - 2, b.y + 1, 1, b.h - 2, '#242424');
        var ty = b.y + ((b.h - 7) >> 1);
        var lbl = b.label == null ? '' : b.label;
        if (lbl === '') return;
        var col = state === 2 ? '#a0a0a0' : MC_WHITE;
        /* A label wider than its widget is clipped to it — vanilla scrolls it,
           but either way it must not spill onto the dirt, which is what made
           "Direct Connection" read as a different kind of button. */
        if (mfWidth(lbl) > b.w - 4) {
            cx.save();
            cx.beginPath(); cx.rect(b.x + 2, b.y, b.w - 4, b.h); cx.clip();
            mfCenter(cx, lbl, b.x + b.w / 2, ty, col);
            cx.restore();
        } else mfCenter(cx, lbl, b.x + b.w / 2, ty, col);
    }
    /* The dirt background behind every screen that has no panorama: the game
       tiles its dirt texture at 32 GUI pixels and darkens it hard. We already
       have a dirt tile in the atlas, so use the real one. */
    var MN_DIRT = null;
    function mnDirtTile() {
        if (MN_DIRT) return MN_DIRT;
        var t = TILE.dirt, sx = (t % 16) * 16, sy = ((t / 16) | 0) * 16;
        var cv = document.createElement('canvas');
        cv.width = 32; cv.height = 32;
        var cx = cv.getContext('2d');
        cx.imageSmoothingEnabled = false;
        cx.drawImage(ATLAS, sx, sy, 16, 16, 0, 0, 32, 32);
        cx.fillStyle = 'rgba(0, 0, 0, 0.75)';   // vanilla multiplies the tile by 0x404040
        cx.fillRect(0, 0, 32, 32);
        MN_DIRT = cv;
        return cv;
    }
    function mnDirt(cx, x, y, w, h) {
        var p = cx.createPattern(mnDirtTile(), 'repeat');
        cx.fillStyle = p;
        cx.fillRect(x, y, w, h);
    }
    /* A scrolling list's frame: dirt inside, and the two shadow gradients the
       game bleeds over the top and bottom edges so entries fade out rather
       than getting guillotined. */
    function mnListFrame(cx, x, y, w, h) {
        cx.save();
        cx.beginPath(); cx.rect(x, y, w, h); cx.clip();
        mnDirt(cx, x, y, w, h);
        cx.restore();
    }
    function mnListEdges(cx, x, y, w, h) {
        var g = cx.createLinearGradient(0, y, 0, y + 4);
        g.addColorStop(0, 'rgba(0, 0, 0, 1)'); g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        cx.fillStyle = g; cx.fillRect(x, y, w, 4);
        g = cx.createLinearGradient(0, y + h - 4, 0, y + h);
        g.addColorStop(0, 'rgba(0, 0, 0, 0)'); g.addColorStop(1, 'rgba(0, 0, 0, 1)');
        cx.fillStyle = g; cx.fillRect(x, y + h - 4, w, 4);
    }

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
        'pixelsAlreadyPerfect=true!', 'Written in a text editor!', 'No blocks were harmed!',
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
    var OPT_DEF = { guiScale: 0, fov: 70, rd: 8, lang: 'en_us', splash: true, snd: true, mus: true, diff: 2, vsync: true, autoJump: false, sens: 100 };
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

    function mnOpen(scr, fade) {
        var m = {
            scr: scr || 'title', prev: [], t: 0, spin: 0, fadeT: 0, fading: false, wantFade: fade !== false,
            splash: optLoad().splash ? mnPickSplash() : null,
            hover: -1, focus: -1, widgets: [], sig: '', dirty: true,
            scale: 2, W: 320, H: 240, d: {}, msg: null
        };
        m.cv = RT.el.querySelector('.mc-mcv');
        m.cx = m.cv.getContext('2d');
        m.ui = RT.el.querySelector('.mc-mui');
        RT.menu = m;
        RT.el.classList.add('mc-menuon');
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
        if (m) {
            m.cv.style.display = 'none';
            m.ui.style.display = 'none';
            m.ui.innerHTML = '';
        }
    }
    function mnGo(m, scr, keep) {
        if (!keep) m.prev.push(m.scr);
        m.scr = scr;
        m.hover = -1; m.focus = -1; m.msg = null;
        m.sig = '';                       // force a full rebuild: the widgets are different things now
        m.dirty = true;
    }
    function mnBack(m) {
        var to = m.prev.pop() || 'title';
        m.scr = to; m.hover = -1; m.focus = -1; m.msg = null; m.sig = ''; m.dirty = true;
    }
    function mnSize(m) {
        var el = RT.el, cw = Math.max(160, el.clientWidth || 960), ch = Math.max(120, el.clientHeight || 560);
        if (m.cv.width !== cw || m.cv.height !== ch) { m.cv.width = cw; m.cv.height = ch; }
        m.scale = guiScale(cw, ch, optLoad().guiScale);
        m.W = Math.floor(cw / m.scale);
        m.H = Math.floor(ch / m.scale);
        m.dirty = true;
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
                el.setAttribute('aria-label', b.aria || b.label || b.id);
                if (b.k !== 'input') el.textContent = b.aria || b.label || '';
                m.ui.appendChild(el);
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
           rate said it should, which on a slow machine is a hang. */
        if (scr.tick) scr.tick(m, dt);
        if (scr.bg !== 'dirt' && scr.bg !== 'flat') { RT.fov = MN_FOV; mnPanoCam(m, dt); drawFrame(); }
        var a = scr.bg === 'pano' ? mnGuiAlpha(m) : 1;
        m.ui.style.pointerEvents = a < 0.02 ? 'none' : '';
        if (m.dirty || scr.live !== false) mnPaint(m, scr);
    }
    function mnPaint(m, scr) {
        var cx = m.cx, s = m.scale;
        cx.setTransform(1, 0, 0, 1, 0, 0);
        cx.clearRect(0, 0, m.cv.width, m.cv.height);
        cx.imageSmoothingEnabled = false;
        cx.setTransform(s, 0, 0, s, 0, 0);
        var W = m.W, H = m.H;
        if (scr.bg === 'dirt') mnDirt(cx, 0, 0, W, H);
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
                mnButton(cx, b, st);
                if (b.k === 'icon' && b.draw) b.draw(cx, b, st);
                if (i === m.focus) {   // vanilla outlines the keyboard-focused widget
                    cx.fillStyle = MC_WHITE;
                    cx.fillRect(b.x - 1, b.y - 1, b.w + 2, 1); cx.fillRect(b.x - 1, b.y + b.h, b.w + 2, 1);
                    cx.fillRect(b.x - 1, b.y, 1, b.h); cx.fillRect(b.x + b.w, b.y, 1, b.h);
                }
            } else if (b.k === 'input') mnInput(cx, m, b, i);
            else if (b.k === 'draw' && b.draw) b.draw(cx, b, i === m.hover, i === m.focus);
        }
        if (m.msg) {   // a transient line under the buttons: "Deleting…", an error
            mfCenter(cx, m.msg, W / 2, H - 42, MC_RED);
        }
        cx.globalAlpha = 1;
        m.dirty = false;
        mnSync(m);
    }
    /* A text field: sunken bevel, the value painted in the bitmap font, a
       caret that blinks on the game's half-second, and the DOM selection
       mirrored as a highlight so dragging a seed looks like it works. */
    function mnInput(cx, m, b, i) {
        var el = m.ui.children[i], focus = el && document.activeElement === el;
        mnRect(cx, b.x - 1, b.y - 1, b.w + 2, b.h + 2, focus ? '#ffffff' : '#a0a0a0');
        mnRect(cx, b.x, b.y, b.w, b.h, '#000000');
        var v = b.value || '', tx = b.x + 4, ty = b.y + ((b.h - 7) >> 1);
        if (!v && b.hint) { mfText(cx, b.hint, tx, ty, '#707070'); }
        else {
            if (focus && el.selectionStart !== el.selectionEnd) {
                var a = mfWidth(v.slice(0, el.selectionStart)), z = mfWidth(v.slice(0, el.selectionEnd));
                mnRect(cx, tx + a, ty - 1, Math.max(1, z - a), 10, '#3030c0');
            }
            mfText(cx, v, tx, ty, b.enabled === false ? '#707070' : '#e0e0e0');
        }
        if (focus && (Date.now() % 1000) < 500) {
            var cpos = el ? el.selectionStart : v.length;
            mnRect(cx, tx + mfWidth(v.slice(0, cpos)), ty - 1, 1, 10, '#d0d0d0');
        }
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
    function wsRead() {
        try { var v = JSON.parse(localStorage.getItem(WS_IDX) || 'null'); if (v && v.length) return v; } catch (e) {}
        return null;
    }
    function wsWrite(list) { try { localStorage.setItem(WS_IDX, JSON.stringify(list)); } catch (e) {} }
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
        wsWrite(l);
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
            var lg = mnLogo(), lw = MN_LOGO_W >> 1, lh = MN_LOGO_H >> 1;
            cx.save();
            cx.globalAlpha = 0.28 + 0.72 * Math.min(1, m.t / 0.5);
            cx.drawImage(lg, Math.round(W / 2 - lw / 2), Math.round(H / 2 - 40), lw, lh);
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
        bg: 'pano',
        layout: function (m, W, H) {
            var j = ((H / 4) | 0) + 48, x = (W / 2 | 0) - 100, r = j + 84, w = [];
            w.push(mnBtn('sp', x, j, MN_BW, MN_BH, 'Singleplayer', function (mm) { mnGo(mm, 'world'); }));
            w.push(mnBtn('mp', x, j + 24, MN_BW, MN_BH, 'Multiplayer', function (mm) {
                mnGo(mm, optLoad().mpwarn === false ? 'mp' : 'mpwarn');
            }));
            w.push(mnBtn('realms', x, j + 48, MN_BW, MN_BH, 'Minecraft Realms', function (mm) { mnGo(mm, 'realms'); }));
            w.push(mnBtn('lang', (W / 2 | 0) - 124, r, 20, 20, '', function (mm) { mnGo(mm, 'lang'); },
                { k: 'icon', aria: 'Language', draw: mnIconGlobe }));
            w.push(mnBtn('opt', x, r, 98, 20, 'Options...', function (mm) { mnGo(mm, 'options'); }));
            w.push(mnBtn('quit', (W / 2 | 0) + 2, r, 98, 20, 'Quit Game', function () { mnQuit(); }));
            w.push(mnBtn('acc', (W / 2 | 0) + 104, r, 20, 20, '', function (mm) { mnGo(mm, 'access'); },
                { k: 'icon', aria: 'Accessibility Settings', draw: mnIconAcc }));
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
    /* The two icon buttons carry small glyphs rather than labels. Drawn, not
       blitted, because the originals are a texture we do not have. */
    function mnIconGlobe(cx, b) {
        var x = b.x + 4, y = b.y + 4;
        cx.fillStyle = '#e0e0e0';
        cx.fillRect(x + 3, y, 6, 1); cx.fillRect(x + 3, y + 11, 6, 1);
        cx.fillRect(x, y + 3, 1, 6); cx.fillRect(x + 11, y + 3, 1, 6);
        cx.fillRect(x + 1, y + 1, 2, 2); cx.fillRect(x + 9, y + 1, 2, 2);
        cx.fillRect(x + 1, y + 9, 2, 2); cx.fillRect(x + 9, y + 9, 2, 2);
        cx.fillRect(x + 5, y + 1, 2, 10); cx.fillRect(x + 1, y + 5, 10, 2);
    }
    function mnIconAcc(cx, b) {
        var x = b.x + 5, y = b.y + 3;
        cx.fillStyle = '#e0e0e0';
        cx.fillRect(x + 4, y, 2, 2);                       // head
        cx.fillRect(x, y + 3, 10, 2);                      // arms
        cx.fillRect(x + 4, y + 3, 2, 5);                   // body
        cx.fillRect(x + 1, y + 8, 2, 5); cx.fillRect(x + 7, y + 8, 2, 5);   // legs
    }

    /* ── screen: Select World ────────────────────────────────
       Vanilla: title at y=8, search at y=22, the list from 48 to height-64 at
       36px an entry, two rows of buttons pinned to the bottom. Play / Edit /
       Re-Create follow the selection; Delete has its own flag, which is why
       an unopenable world can still be thrown away. */
    var MN_ROWH = 36;
    MN_SCR.world = {
        bg: 'dirt',
        enter: function (m) { m.d.sel = null; m.d.scroll = 0; m.d.q = ''; },
        wheel: function (m, dy) { m.d.scroll = Math.max(0, (m.d.scroll || 0) + (dy > 0 ? 18 : -18)); },
        rows: function (m) {
            var q = (m.d.q || '').toLowerCase(), l = wsIndex(), out = [];
            for (var i = 0; i < l.length; i++) if (!q || l[i].name.toLowerCase().indexOf(q) >= 0) out.push(l[i]);
            return out;
        },
        layout: function (m, W, H) {
            var w = [], cxp = W / 2 | 0;
            w.push({ k: 'input', id: 'q', x: cxp - 100, y: 22, w: 200, h: 20, value: m.d.q || '',
                hint: 'Search…', enabled: true, aria: 'search for worlds',
                set: function (mm, v) { mm.d.q = v; mm.d.scroll = 0; } });
            var top = 48, bot = H - 64, rows = MN_SCR.world.rows(m);
            var maxScroll = Math.max(0, rows.length * MN_ROWH - (bot - top) + 8);
            if (m.d.scroll > maxScroll) m.d.scroll = maxScroll;
            var rl = cxp - 133;
            for (var i = 0; i < rows.length; i++) {
                var ry = top + 4 - (m.d.scroll || 0) + i * MN_ROWH;
                if (ry + MN_ROWH < top || ry > bot) continue;
                w.push({ k: 'draw', id: 'r' + rows[i].id, x: rl, y: ry, w: 270, h: MN_ROWH - 4, enabled: true,
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
                mm.d.cw = mnCreateDefaults();
                mm.d.cw.name = ww.name; mm.d.cw.seed = String(ww.seed); mm.d.cw.gm = ww.gm; mm.d.cw.diff = ww.diff;
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
            mnRect(cx, b.x - 2, b.y - 2, b.w + 4, b.h + 4, '#ffffff');
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
        var key = w.id + ':' + w.seed;
        if (!MN_ICON[key]) {
            var cv = document.createElement('canvas');
            cv.width = 32; cv.height = 32;
            var c = cv.getContext('2d'), rnd = mulb(w.seed | 0);
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
            on: function (mm, b) {
                var f = Math.max(0, Math.min(1, (mm.mx - b.x - 4) / (b.w - 8)));
                set(mm, f);
            },
            draw: function (cx, b, hover, focus) {
                /* Vanilla draws the track from the widget sheet's DISABLED row
                   and the handle from the normal one, which is the only reason
                   the handle is visible at all — matched grey on grey is just a
                   pair of bevel lines. */
                mnButton(cx, { x: b.x, y: b.y, w: b.w, h: b.h, label: '' }, 2);
                var kx = b.x + 1 + Math.round((b.w - 2 - 8) * Math.max(0, Math.min(1, frac)));
                mnButton(cx, { x: kx, y: b.y, w: 8, h: b.h, label: '' }, hover || focus ? 1 : 0);
                mfCenter(cx, b.label, b.x + b.w / 2, b.y + ((b.h - 7) >> 1), MC_WHITE);
                if (focus) {
                    cx.fillStyle = MC_WHITE;
                    cx.fillRect(b.x - 1, b.y - 1, b.w + 2, 1); cx.fillRect(b.x - 1, b.y + b.h, b.w + 2, 1);
                    cx.fillRect(b.x - 1, b.y, 1, b.h); cx.fillRect(b.x + b.w, b.y, 1, b.h);
                }
            } };
    }
    function mnOnOff(v) { return v ? 'ON' : 'OFF'; }
    /* Screens that are a titled column of buttons over dirt — most of the
       options tree is exactly this, so build them from one description. */
    function mnGrid(title, rows, done) {
        return {
            bg: 'dirt',
            layout: function (m, W, H) {
                var w = [], cxp = W / 2 | 0, y0 = ((H / 6) | 0) - 12, list = rows(m, W, H), i;
                for (i = 0; i < list.length; i++) {
                    var r = list[i];
                    if (!r) continue;
                    r.x = cxp + (i % 2 ? 5 : -155);
                    r.y = y0 + ((i / 2) | 0) * 24;
                    if (!r.w) { r.w = 150; r.h = 20; }
                    w.push(r);
                }
                var last = y0 + Math.ceil(list.length / 2) * 24 + 6;
                w.push(mnBtn('done', cxp - 100, Math.min(H - 27, last), 200, 20, done || 'Done', function (mm) { mnBack(mm); }));
                return w;
            },
            paint: function (cx, m, W) { mfCenter(cx, title, W / 2, 15, MC_WHITE); }
        };
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
        return { name: 'New World', seed: '', gm: 0, hardcore: false, diff: 2, cheats: false,
            type: 0, structures: true, bonus: false, tab: 0 };
    }
    MN_SCR.create = {
        bg: 'dirt',
        enter: function (m) { if (!m.d.cw) m.d.cw = mnCreateDefaults(); },
        layout: function (m, W, H) {
            var c = m.d.cw || (m.d.cw = mnCreateDefaults());
            var w = [], cxp = W / 2 | 0, i;
            var tabs = ['Game', 'World', 'More'], tw = Math.min(120, (W - 8) / 3 | 0);
            for (i = 0; i < 3; i++) {
                w.push({ k: 'draw', id: 'tab' + i, x: Math.round(cxp - tw * 1.5 + i * tw), y: 4, w: tw, h: 20,
                    enabled: true, aria: tabs[i], label: tabs[i], ti: i,
                    on: (function (n) { return function (mm) { mm.d.cw.tab = n; mm.sig = ''; }; })(i),
                    draw: mnTab });
            }
            var y = 42;
            if (c.tab === 0) {
                w.push({ k: 'input', id: 'nm', x: cxp - 104, y: y + 12, w: 208, h: 20, value: c.name, max: 64,
                    enabled: true, aria: 'World Name', title: 'World Name',
                    set: function (mm, v) { mm.d.cw.name = v; } });
                y += 44;
                w.push(mnCycle('gm', cxp - 105, y, 210, 20, 'Game Mode',
                    ['Survival', 'Hardcore', 'Creative'], c.hardcore ? 1 : c.gm === 1 ? 2 : 0,
                    function (mm, n) {
                        mm.d.cw.hardcore = n === 1;
                        mm.d.cw.gm = n === 2 ? 1 : 0;
                        if (n === 1) { mm.d.cw.diff = 3; mm.d.cw.cheats = false; }
                    }));
                y += 28;
                w.push(mnCycle('df', cxp - 105, y, 210, 20, 'Difficulty', MN_DIFF, c.diff,
                    function (mm, n) { mm.d.cw.diff = n; }, { enabled: !c.hardcore }));
                y += 28;
                w.push(mnCycle('ch', cxp - 105, y, 210, 20, 'Allow Cheats', ['OFF', 'ON'], c.cheats ? 1 : 0,
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
                w.push(mnCycle('bc', cxp - 155, y, 310, 20, 'Bonus Chest', ['OFF', 'ON'], c.bonus ? 1 : 0,
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
            mnRect(cx, 0, 0, W, 28, 'rgba(0, 0, 0, 0.45)');
            mnRect(cx, 0, 28, W, 1, '#000000');
            mnRect(cx, 0, H - 36, W, 1, '#000000');
            var c = m.d.cw;
            if (c && c.tab === 0 && c.hardcore) mfCenter(cx, 'Hardcore: one life, and the difficulty is locked.', W / 2, H - 48, MC_RED);
        }
    };
    function mnTab(cx, b, hover, focus) {
        var on = RT.menu.d.cw && RT.menu.d.cw.tab === b.ti;
        mnButton(cx, { x: b.x, y: b.y, w: b.w, h: b.h, label: b.label }, on || hover || focus ? 1 : 0);
        if (on) mnRect(cx, b.x + 1, b.y + b.h - 2, b.w - 2, 1, MC_WHITE);   // the selected tab is underlined
    }
    function mnCreate(m) {
        var c = m.d.cw, seed;
        if (/^-?\d+$/.test(c.seed.trim())) seed = parseInt(c.seed.trim(), 10) | 0;
        else if (c.seed.trim()) seed = mnHash(c.seed.trim());          // the game hashes a non-numeric seed too
        else seed = (Math.random() * 2147483647) | 0;
        var w = wsCreate({ name: (c.name || 'New World').trim() || 'New World', seed: seed, gm: c.gm,
            hardcore: c.hardcore, diff: c.hardcore ? 3 : c.diff, cheats: c.cheats,
            structures: c.structures, bonus: c.bonus, type: MN_WTYPE[c.type] });
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
                mnBtn('icon', cxp - 100, 134, 200, 20, 'Reset Icon', function (mm) {
                    var ww = wsGet(mm.d.sel); if (ww) delete MN_ICON[ww.id + ':' + ww.seed];
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
        wheel: function (m, dy) { m.d.mscroll = Math.max(0, (m.d.mscroll || 0) + (dy > 0 ? 18 : -18)); },
        live: true,
        layout: function (m, W, H) {
            var w = [], cxp = W / 2 | 0, top = 32, bot = H - 64, rl = cxp - 150, i;
            for (i = 0; i < MN_SERVERS.length; i++) {
                var ry = top + 4 - (m.d.mscroll || 0) + i * MN_ROWH;
                if (ry + MN_ROWH < top || ry > bot) continue;
                w.push({ k: 'draw', id: 's' + i, x: rl, y: ry, w: 305, h: MN_ROWH - 4, enabled: true,
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
    function mnJoin(m, i) {
        var s = MN_SERVERS[i];
        if (!s) return;
        m.d.conn = { t: 0, step: 0, s: s, stop: s.ping < 0 ? 1 : 5 };
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
            /* Pop back to the server list rather than pushing another copy of
               it: the connect screen already put one on the stack, and pushing
               again left Escape bouncing the list off itself. */
            return [mnBtn('back', (W / 2 | 0) - 100, H / 2 + 30, 200, 20, 'Back to Server List', function (mm) {
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
                mnBtn('join', cxp - 100, ((H / 4) | 0) + 108, 200, 20, 'Join Server', function (mm) {
                    MN_SERVERS.push({ n: mm.d.ip.trim(), ip: mm.d.ip.trim(), motd: '', ping: -1, max: 0, on: 0, fail: 'dns' });
                    mnJoin(mm, MN_SERVERS.length - 1);
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
    MN_SCR.options = mnGrid('Options', function (m, W, H) {
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
    });
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
            mnCycle('shake', 0, 0, 150, 20, 'Screen Shake', ['OFF', 'ON'], o.noShake ? 0 : 1,
                function (mm, n) { o.noShake = !n; optSave(); }),
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
        wheel: function (m, dy) { m.d.lscroll = Math.max(0, (m.d.lscroll || 0) + (dy > 0 ? 16 : -16)); },
        layout: function (m, W, H) {
            var w = [], cxp = W / 2 | 0, top = 32, bot = H - 40, o = optLoad();
            for (var i = 0; i < MN_LANGS.length; i++) {
                var y = top + 4 - (m.d.lscroll || 0) + i * 18;
                if (y < top || y + 16 > bot) continue;
                w.push({ k: 'draw', id: 'l' + i, x: cxp - 100, y: y, w: 200, h: 16, enabled: true,
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
            '<canvas class="mc-cv"></canvas>' +
            '<div class="mc-vig"></div>' +
            /* The crosshair lives OUTSIDE .mc-hud. Inside it, .mc-hud's z-index made
               a stacking context and mix-blend-mode:difference had nothing but
               transparent pixels to blend against — so the crosshair was a flat #ddd
               cross, invisible over snow, sand and bright sky. */
            '<div class="mc-cross"><i></i><i class="v"></i></div>' +
            '<div class="mc-hud">' +
            '<div class="mc-armor"></div>' +
            '<div class="mc-vitals"><div class="mc-hearts"></div><div class="mc-food"></div></div>' +
            '<div class="mc-air"></div>' +
            '<div class="mc-tip"></div>' +
            '<div class="mc-xpbar"><i class="mc-xpfill"></i><span class="mc-xplvl"></span></div>' +
            '<div class="mc-hotbar">' + slotsHTML('inv', 0, 9, 'mc-hb') + '</div>' +
            '</div>' +
            '<div class="mc-effects" style="display:none"></div>' +
            '<div class="mc-chat"><div class="mc-chatlog"></div>' +
              '<div class="mc-sug" style="display:none"><div class="mc-sugu"></div><div class="mc-sugl"></div></div>' +
              '<input class="mc-chatin" maxlength="256" spellcheck="false" autocomplete="off">' +
              '<div class="mc-chattab"></div></div>' +
            '<div class="mc-toasts"></div>' +
            '<div class="mc-panelwrap" style="display:none"></div>' +
            '<div class="mc-debug" style="display:none"></div>' +
            '<div class="mc-sleepov" style="display:none">Sleeping…</div>' +
            '<div class="mc-pause" style="display:none"><div class="mc-menu">' +
            '<h3>Game Menu</h3>' +
            '<button class="mc-btn mc-resume">Back to Game</button>' +
            '<button class="mc-btn mc-achbtn">Achievements</button>' +
            '<button class="mc-btn mc-totitle">Save and Quit to Title</button>' +
            '<div class="mc-optrow"><button class="mc-btn half mc-snd">Sound: ON</button><button class="mc-btn half mc-mus">Music: ON</button></div>' +
            '<p class="mc-hint">WASD move · Space jump · double-tap W sprints · Shift sneak<br>LMB mine · RMB place/use · MMB pick block · E inventory · Q drop · F3 debug<br>T chat · /gamemode creative · double-tap Space to fly</p>' +
            '<div class="mc-achs" style="display:none"><div class="mc-achn"></div><div class="mc-achrows"></div></div>' +
            '</div></div>' +
            '<div class="mc-death" style="display:none"><div class="mc-menu"><h3>You died!</h3><div class="mc-dscore"></div>' +
            '<button class="mc-btn mc-respawn">Respawn</button></div></div>' +
            '<div class="mc-load" style="display:none"><div class="mc-menu"><h3>Building terrain…</h3><div class="mc-bar"><i></i></div></div></div>' +
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

    /* Minecraft's syntax error: the message, then the command up to the bad
       token with <--[HERE] pinned after it. */
    function chatSyntax(msg, full, pos) {
        chatErr(msg);
        var head = String(full).slice(0, pos);
        if (head.length > 32) head = '...' + head.slice(-29);
        chatErr(head + '<--[HERE]');
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
            if (!c) return chatErr('Unknown command: ' + q);
            chatSay(c.usage);
            chatSay(c.help);
            return;
        }
        var names = Object.keys(CMDS).sort();
        chatSay('--- Showing ' + names.length + ' commands ---', 'dim');
        for (var i = 0; i < names.length; i++) chatSay(CMDS[names[i]].usage, 'dim');
    }, function (a) { return a === 0 ? Object.keys(CMDS).sort() : []; });

    cmd('gamemode', '/gamemode <survival|creative|adventure|spectator>', 'Sets a player\'s game mode', function (rd, raw) {
        var m = rd.word();
        if (!m) return usageErr('gamemode', raw, rd.i);
        var g = GAMEMODES[stripNs(m).toLowerCase()];
        if (g === undefined) return chatSyntax('Unknown game mode: ' + m, raw, rd.i);
        setGamemode(g);
        chatSay('Set own game mode to ' + GM_NAME[g] + ' Mode');
    }, function (a) { return a === 0 ? ['survival', 'creative', 'adventure', 'spectator'] : []; });

    cmd('difficulty', '/difficulty [peaceful|easy|normal|hard]', 'Sets the difficulty level', function (rd, raw) {
        var d = rd.word();
        if (!d) return chatSay('The difficulty is ' + DIFF_NAME[S.diff]);
        var v = DIFFS[stripNs(d).toLowerCase()];
        if (v === undefined) return chatSyntax('Unknown difficulty: ' + d, raw, rd.i);
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
    cmd('list', '/list', 'Lists players on the server', function () {
        chatSay('There are 1 of a max of 1 players online: Steve');
    });
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
    function usageErr(name, raw, pos) { chatSyntax('Incomplete command', raw, pos); chatErr('Usage: ' + CMDS[name].usage); }
    function tpPlayer(x, y, z) {
        S.px = x; S.py = y; S.pz = z;
        RT.vy = 0; RT.fallY = y;
        ensureChunks();
    }
    function hurtBypass(n) { S.hp = 0; RT.dead = false; die(); }
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
            else hurt(3 * (amp + 1), null, true, true);
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

    /* ── the chat overlay ────────────────────────────────── */
    function paintChat() {
        if (!RT || !RT.el) return;
        var wrap = RT.el.querySelector('.mc-chat');
        if (!wrap) return;
        var log = RT.chatLog || [];
        var open = !!RT.chat;
        // closed chat shows only the recent lines, and fades them out
        var now = RT.now || 0;
        var vis = open ? log.slice(-18) : log.filter(function (m) { return now - m.at < CHAT_FADE; }).slice(-10);
        wrap.querySelector('.mc-chatlog').innerHTML = vis.map(function (m) {
            var age = now - m.at;
            var op = (!open && age > CHAT_FADE - 1.5) ? (CHAT_FADE - age) / 1.5 : 1;
            return '<div class="mc-cline' + (m.c ? ' ' + m.c : '') + '"' +
                   (op < 1 ? ' style="opacity:' + op.toFixed(2) + '"' : '') + '>' + escHtml(m.t) + '</div>';
        }).join('');
        wrap.classList.toggle('open', open);
        var lg = wrap.querySelector('.mc-chatlog');
        lg.scrollTop = lg.scrollHeight;
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
    function runCommand(body, raw) {
        var rd = new Reader(body);
        var nameAt = rd.i, name = stripNs(rd.word()).toLowerCase();
        if (!name) return;
        var c = CMDS[name];
        if (!c) {
            chatErr('Unknown or incomplete command, see below for error');
            chatErr(raw.slice(0, 1 + nameAt + name.length) + '<--[HERE]');
            return;
        }
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
            hits = Object.keys(CMDS).filter(function (n) { return n.indexOf(q) === 0; }).sort();
            return { hits: hits, start: 1, usage: hits.length === 1 ? CMDS[hits[0]].usage : null };
        }
        var parts = body.split(' ');
        var c = CMDS[stripNs(parts[0]).toLowerCase()];
        if (!c) return null;
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
    function paintSug() {
        var box = RT.el.querySelector('.mc-sug');
        if (!box) return;
        var c = RT.chat;
        if (!c || (!c.hits.length && !c.usage)) { box.style.display = 'none'; return; }
        var inp = RT.el.querySelector('.mc-chatin');
        box.style.display = '';
        box.querySelector('.mc-sugu').textContent = c.usage || '';
        // keep the highlighted entry inside the window when the list is long
        var MAXS = 12, off = 0;
        if (c.si >= MAXS) off = c.si - MAXS + 1;
        if (off > c.hits.length - MAXS) off = Math.max(0, c.hits.length - MAXS);
        box.querySelector('.mc-sugl').innerHTML = c.hits.slice(off, off + MAXS).map(function (h, i) {
            var idx = off + i;
            return '<div class="mc-sugi' + (idx === c.si ? ' on' : '') + '" data-si="' + idx + '">' + escHtml(h) + '</div>';
        }).join('');
        // line the box up with the token it is completing, but never off the left
        var pad = parseFloat(getComputedStyle(inp).paddingLeft) || 0;
        var x = pad + textWidth(inp.value.slice(0, c.sstart), inp);
        box.style.left = Math.max(0, Math.round(x) - 4) + 'px';
        // The list scrolls, and replacing its innerHTML above just reset scrollTop
        // to 0. Walk the highlight back into view or Tab runs off the bottom of a
        // box that still looks like it is showing the first entry.
        var onRow = box.querySelector('.mc-sugi.on');
        if (onRow) {
            var list = box.querySelector('.mc-sugl');
            var top = onRow.offsetTop, bot = top + onRow.offsetHeight;
            if (bot > list.clientHeight) list.scrollTop = bot - list.clientHeight;
            else if (top < list.scrollTop) list.scrollTop = top;
        }
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
            var hits = Object.keys(CMDS).filter(function (n) { return n.indexOf(body.toLowerCase()) === 0; }).sort();
            if (!hits.length) return null;
            return { text: '/' + commonPrefix(hits, body.length) + (hits.length === 1 ? ' ' : ''), hits: hits };
        }
        // completing an argument: which one are we on?
        var parts = body.split(' ');
        var cname = stripNs(parts[0]).toLowerCase();
        var c = CMDS[cname];
        if (!c || !c.complete) return null;
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
    /* ── active-effect HUD ───────────────────────────────── */
    function paintEffects() {
        if (!RT || !RT.el) return;
        var box = RT.el.querySelector('.mc-effects');
        if (!box) return;
        var ids = Object.keys(S.eff || {});
        box.innerHTML = ids.map(function (id) {
            var e = S.eff[id], d = EFFECTS[id];
            if (!d) return '';
            var t = e.t >= 1e8 ? '∞' : fmtTimeLeft(e.t);
            return '<div class="mc-eff"><i style="background:' + d.c + '"></i>' +
                   '<b>' + escHtml(d.t) + (e.amp ? ' ' + roman(e.amp + 1) : '') + '</b><span>' + t + '</span></div>';
        }).join('');
        box.style.display = ids.length ? '' : 'none';
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
            foes: [], drops: [], arrows: [], tnts: [], parts: [], entV: [], orbs: [],
            keys: {}, mouse: { l: false, r: false },
            chat: null, chatLog: [], chatHist: [], now: 0, fly: !!S.fly && (S.gm === 1 || S.gm === 3),
            vy: 0, ground: false, fallY: S.py, sprint: false, fovM: 1,
            exh: 0, regenT: 0, starveT: 0, iframe: 0, digT: 0, digCd: 0, digNeed: 1, digAt: null, atkCd: 0,
            eatT: 0, bowT: 0, swing: 0, swingT: SWING_T, equip: 0, equipId: null, bob: 0, flash: 0, shake: 0, sleep: 0, placeCd: 0,
            target: null, panel: null, cur: null, craft: [null, null, null, null, null, null, null, null, null], craftW: 2,
            cTab: 0, cScroll: 0, cSearch: '', cList: [], cDrag: 0, panelDirty: 0,
            paused: false, dead: S.hp <= 0, ready: false, lit: false, expectUnlock: false,
            worldMs: 0, playT: 0, baseHrs: S.hrs || 0, lastT: 0, secT: 0, hudT: 0, saveT: 0,
            fps: 0, fpsN: 0, fpsT: 0, f3: false, musT: 25, tipT: 0, tipId: null, devFree: !!devModes, raf: 0, timers: [],
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
        } else {
            RT.el.querySelector('.mc-load').style.display = '';
        }
        // fresh world: starting position + a bootstrapping run of chunks
        if (!S.wspawn) {
            S.wspawn = findSpawn();
            S.px = S.wspawn[0]; S.py = S.wspawn[1]; S.pz = S.wspawn[2];
        }
        ensureChunks();
        sizeCanvas();
        RT.ro = new ResizeObserver(function () { sizeCanvas(); if (RT && RT.menu) mnSize(RT.menu); });
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
                else if (RT.panel) { closePanel(); e.stopPropagation(); }
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
            if (k === 'e' && RT.ready && !RT.dead && !RT.paused) { if (RT.panel) closePanel(); else openPanel(isCreative() ? 'creative' : 'inv'); }
            if (k === 'q' && !RT.panel && !RT.paused && !RT.dead) {
                var h = held();
                if (h) {
                    var d = look();
                    var dr = { x: S.px + d[0], y: S.py + EYE - 0.3, z: S.pz + d[2], vx: d[0] * 6, vy: d[1] * 6 + 2, vz: d[2] * 6, it: h.id, c: 1, dur: h.dur, age: -0.8, hw: 0.12, h: 0.24 };
                    RT.drops.push(dr);
                    h.c--; if (!h.c) S.inv[S.sel] = null;
                    paintHotbar();
                }
            }
            if (e.key === 'F3') { RT.f3 = !RT.f3; paintDebug(); e.preventDefault(); }
            var n = parseInt(e.key, 10);
            // ungated, these silently changed what you were holding from behind a
            // chest, the pause menu, the death screen and the loading screen
            if (n >= 1 && n <= 9 && RT.ready && !RT.panel && !RT.paused && !RT.dead) { S.sel = n - 1; paintHotbar(); }
            e.stopPropagation();
        });
        root.addEventListener('keyup', function (e) {
            RT.keys[e.key.toLowerCase()] = false;
            e.stopPropagation();
        });
        root.addEventListener('blur', function () { RT.keys = {}; RT.mouse.l = RT.mouse.r = false; });
        cv.addEventListener('mousedown', function (e) {
            audioInit();
            // with chat open the world is inert: no swinging, no relock, and the
            // click must not pull focus out of the box you're typing in
            if (RT.chat) { e.preventDefault(); return; }
            root.focus();
            if (!RT.ready || RT.dead) return;
            if (!document.pointerLockElement && !RT.devFree) {
                if (!RT.panel && !RT.paused) lockCursor();
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
            if (RT.panel || RT.paused || RT.chat) return;
            S.sel = ((S.sel + (e.deltaY > 0 ? 1 : -1)) % 9 + 9) % 9;
            paintHotbar();
            e.preventDefault();
        }, { passive: false });
        // menu buttons
        root.querySelector('.mc-resume').addEventListener('click', function () { audioInit(); hidePause(); lockCursor(); });
        root.querySelector('.mc-totitle').addEventListener('click', function () { audioInit(); mnToTitle(); });
        root.querySelector('.mc-achbtn').addEventListener('click', function () {
            var a = root.querySelector('.mc-achs');
            a.style.display = a.style.display === 'none' ? '' : 'none';
        });
        root.querySelector('.mc-snd').addEventListener('click', function () { S.snd = !S.snd; this.textContent = 'Sound: ' + (S.snd ? 'ON' : 'OFF'); });
        root.querySelector('.mc-mus').addEventListener('click', function () { S.mus = !S.mus; this.textContent = 'Music: ' + (S.mus ? 'ON' : 'OFF'); });
        root.querySelector('.mc-respawn').addEventListener('click', function () { respawn(); lockCursor(); });
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
            setB: setB, getB: getB, explode: explode, unlockAll: function () { for (var i = 0; i < ACH.length; i++) unlock(ACH[i].id); },
            chunkDbg: function (cx, cz) { var c = RT.chunks[cx + ',' + cz]; return c ? { op: c.dbgOp || null, cut: c.dbgCut || null } : null; },
            remesh: function (cx, cz) { var c = RT.chunks[cx + ',' + cz]; if (c) meshChunk(c); },
            lightAt: function (x, y, z) { return [getSky(x, y, z), getBlk(x, y, z)]; },
            relightBox: function (x, z) { relight(x, z); },
            setSlot: function (i, id, c) { S.inv[i] = id ? { id: id, c: c || 1 } : null; paintHotbar(); },
            craftGrid: function (arr) { RT.craftW = 3; for (var i = 0; i < 9; i++) RT.craft[i] = arr[i] ? { id: arr[i][0], c: arr[i][1] } : null; },
            shiftCraft: function () { takeCraft(true); },
            invSnap: function () { var o = {}; for (var i = 0; i < 36; i++) { var s = S.inv[i]; if (s) o[s.id] = (o[s.id] || 0) + s.c; } return o; },
            invFree: invFree, craftSnap: function () { return RT.craft.map(function (s) { return s ? s.id + ':' + s.c : null; }); }
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
        var hrs = RT.playT / 3600;
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
        if (AC) { try { AC.close(); } catch (e) {} AC = null; }
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
        __proof: { text: mfText, adv: mfAdvance, width: mfWidth, logo: mnLogo,
            probe: function (x, y, z) { return getB(x, y, z); },
            save: function () { return S ? { seed: S.seed, wtype: S.wtype, py: S.py, gm: S.gm, diff: S.diff, wid: S.wid } : null; },
            menu: function () {
                var m = RT && RT.menu;
                if (!m) return null;
                return { scr: m.scr, sel: m.d.sel, msel: m.d.msel, mx: m.mx, scale: m.scale, sig: m.sig,
                    hover: m.hover, focus: m.focus,
                    w: m.widgets.map(function (b) { return b.id + ':' + (b.enabled ? '' : 'off') + (b.st || 0); }) };
            } },
        hours: function () { var s = S || sLoad(); return s ? (s.hrs || 0) : 0; }
    };
})();
