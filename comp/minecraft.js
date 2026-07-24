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
    var REACH = 5;
    var PW = 0.6, PH = 1.8, EYE = 1.62;   // player box + eye height

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
            deaths: 0
        };
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

    /* ── terrain shape: pure functions of (x,z) ─────────────── */
    // biome: 0 plains, 1 forest, 2 desert, 3 mountains
    function biomeAt(x, z) {
        var b = noise2(x / 220 + 91, z / 220 - 37);
        var m = noise2(x / 300 - 53, z / 300 + 17);
        if (m > 0.68) return 3;
        if (b < 0.3) return 2;
        if (b < 0.62) return 0;
        return 1;
    }
    function heightAt(x, z) {
        var base = 44 + (fbm2(x / 60, z / 60, 4) - 0.5) * 14;
        var m = noise2(x / 300 - 53, z / 300 + 17);
        if (m > 0.6) base += (m - 0.6) * (m - 0.6) * 480 * fbm2(x / 40 + 7, z / 40 - 3, 3);   // mountains rear up
        var lake = noise2(x / 90 + 41, z / 90 + 83);
        if (lake < 0.22) base -= (0.22 - lake) * 42;                                          // depressions become lakes
        return Math.max(6, Math.min(CH - 8, Math.round(base)));
    }
    function treeAt(x, z) {   // deterministic per column, so chunk borders agree about their neighbors' trees
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

        /* flat item sprites */
        tile('i_stick', function () { for (var i = 0; i < 10; i++) { tpx(3 + i, 12 - i, '#a8834f'); tpx(4 + i, 12 - i, '#8a6a3e'); } });
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
        TEX[FURN] = [t.furn_top, t.furn_top, t.furn_front];
        TEX[FURN_LIT] = [t.furn_top, t.furn_top, t.furn_lit];
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
        TEX[CHEST] = [t.chest_top, t.chest_top, t.chest_front];
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
            for (y = h + 1; y <= SEA; y++) bl[lx | (lz << 4) | (y << 8)] = WATER;   // lakes fill the low ground
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
        blobs(14, ORE_COAL, 5, 70, 7);
        blobs(8, ORE_IRON, 5, 48, 5);
        blobs(3, ORE_GOLD, 5, 24, 4);
        blobs(5, ORE_RED, 5, 16, 6);
        if (org() < 0.6) blobs(1, ORE_LAPIS, 5, 30, 5);
        if (org() < 0.7) blobs(1, ORE_DIA, 5, 14, 4);
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
                var tid = TEX[b][d === 2 ? 0 : d === 3 ? 1 : 2];
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
        var proj = mPersp(1.22, RT.cv.width / RT.cv.height, 0.08, 260);
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
            gl.uniformMatrix4fv(G.u.mvp, false, mPersp(1.22, RT.cv.width / RT.cv.height, 0.05, 10));
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
    function useOne() { var h = held(); if (h) { h.c--; if (!h.c) S.inv[S.sel] = null; } }
    function swapHeld(id) {   // consume 1 of the held item, hand back one of `id`
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
        if (!st || st.dur == null) return;
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
        var y0 = Math.floor(S.py), y1 = Math.floor(S.py + PH - 0.001);
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
    function axisMove(dx, dy, dz) {
        var hit = { x: false, y: false, z: false };
        if (dx) {
            S.px += dx;
            if (boxHits(S.px, S.py, S.pz)) { var sx = dx > 0 ? 1 : -1, g = 0; while (boxHits(S.px, S.py, S.pz) && g++ < 80) S.px -= sx * 0.01; hit.x = true; }
        }
        if (dz) {
            S.pz += dz;
            if (boxHits(S.px, S.py, S.pz)) { var sz = dz > 0 ? 1 : -1, g2 = 0; while (boxHits(S.px, S.py, S.pz) && g2++ < 80) S.pz -= sz * 0.01; hit.z = true; }
        }
        if (dy) {
            // sub-step the vertical move: a terminal-velocity frame must not tunnel through a thin floor
            var rem = dy, sy = dy > 0 ? 1 : -1;
            while (rem !== 0 && !hit.y) {
                var stp = Math.abs(rem) > 0.5 ? sy * 0.5 : rem;
                S.py += stp; rem -= stp;
                if (boxHits(S.px, S.py, S.pz)) { var g3 = 0; while (boxHits(S.px, S.py, S.pz) && g3++ < 200) S.py -= sy * 0.01; hit.y = true; }
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
        var k = RT.panel ? EMPTY_KEYS : RT.keys, water = inFluid(WATER), lava = inFluid(LAVA), fluid = water || lava;
        var fwd = (k.w ? 1 : 0) - (k.s ? 1 : 0), str = (k.d ? 1 : 0) - (k.a ? 1 : 0);
        var sneak = k.shift && !fluid;
        RT.sprint = RT.sprint && fwd > 0 && S.food > 6 && !sneak;
        var sp = fluid ? SWIM : sneak ? SNEAK : RT.sprint ? SPRINT : WALK;
        if (lava) sp *= 0.45;
        var len = Math.sqrt(fwd * fwd + str * str) || 1;
        var mx = (fwd / len) * Math.sin(S.yaw) + (str / len) * Math.cos(S.yaw);
        var mz = (fwd / len) * -Math.cos(S.yaw) + (str / len) * Math.sin(S.yaw);
        var dx = mx * sp * dt, dz = mz * sp * dt;
        if (fluid) {
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
                RT.vy = JUMP;
                RT.ground = false;
                addExh(RT.sprint ? 0.2 : 0.05);
            }
        }
        if (sneak && RT.ground) {   // sneaking never walks off an edge
            if (dx && !groundBelow(S.px + dx, S.py, S.pz)) dx = 0;
            if (dz && !groundBelow(S.px, S.py, S.pz + dz)) dz = 0;
        }
        var wasGround = RT.ground;
        var hit = axisMove(dx, 0, dz);
        if (hit.x || hit.z) RT.sprint = false;
        var hy = axisMove(0, RT.vy * dt, 0);
        if (hy.y) {
            if (RT.vy < 0) {
                RT.ground = true;
                var fall = RT.fallY - S.py;
                // re-sample fluid at the landing box: a fast fall can plunge through a shallow
                // pond in one frame, so the frame-start `water` misses it
                if (fall > 3.5 && !water && !inFluid(WATER)) {
                    var ff = S.armor[3] ? ench(S.armor[3], 'feather') : 0;   // feather falling boots soften the landing
                    var fdmg = Math.floor((fall - 3) * (1 - ff * 0.12));
                    if (fdmg > 0) { hurt(fdmg, null, false, true); snd('fall'); }
                }
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
        // drowning
        var headWater = getB(Math.floor(S.px), Math.floor(S.py + EYE), Math.floor(S.pz)) === WATER;
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
    }

    /* ── hunger, health ─────────────────────────────────────── */
    function addExh(n) { RT.exh += n; }
    function foodTick(dt) {
        if (RT.dead) return;
        while (RT.exh >= 4) {
            RT.exh -= 4;
            if (S.sat > 0) S.sat = Math.max(0, S.sat - 1);
            else S.food = Math.max(0, S.food - 1);
        }
        if (S.food >= 18 && S.hp < 20) {
            RT.regenT += dt;
            if (RT.regenT >= 4) { RT.regenT = 0; S.hp = Math.min(20, S.hp + 1); addExh(6); }
        } else RT.regenT = 0;
        if (S.food <= 0) {
            RT.starveT += dt;
            if (RT.starveT >= 4) { RT.starveT = 0; if (S.hp > 1) { hurt(1, null, true); } }
        } else RT.starveT = 0;
    }
    function weatherTick(dt) {
        S.wt -= dt;
        if (S.wt <= 0) {
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
        n = Math.min(99, Math.round(n));
        if (RT.iframe > 0 && !quiet) return;
        RT.iframe = 0.5;
        if (!bypassArmor) {
            var a = armorPoints(), tough = armorTough();
            if (a > 0) {
                var red = Math.min(20, Math.max(a / 5, a - n / (2 + tough / 4))) / 25;   // MC armor formula
                n = Math.round(n * (1 - red));
                for (var i = 0; i < 4; i++) if (S.armor[i]) { wearItem(S.armor[i], 1); if (S.armor[i].dur != null && S.armor[i].dur <= 0) { S.armor[i] = null; snd('break'); } }
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
        closePanel(true);   // fold cursor + crafting-grid items into the inventory FIRST so they scatter too
        for (var i = 0; i < 36; i++) {   // your stuff scatters where you fell
            var s = S.inv[i];
            if (s) dropItem(S.px, S.py + 1, S.pz, s.id, s.c, s.dur, true, s.ench, s.name);
            S.inv[i] = null;
        }
        S.deaths++;
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
    function raycast() {
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
            if (b > 0 && b !== WATER && b !== LAVA) return { x: x, y: y, z: z, b: b, px: px, py: py, pz: pz, dist: t };
        }
        return null;
    }

    /* ── mining ─────────────────────────────────────────────── */
    function breakTime(b) {
        var def = B[b];
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
        return [[n, def.tier ? fbonus : 1]];   // fortune only multiplies ore-tier drops (coal/diamond/emerald)
    }
    function breakBlock(x, y, z) {
        var b = getB(x, y, z);
        if (b <= 0 || B[b].hard < 0) return;
        var harvest = canHarvest(b);
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
            unlock('wood');
            // chopping wood schedules the orphaned canopy for a quick decay (random ticks alone take minutes)
            for (var dx = -4; dx <= 4; dx++) for (var dy = -4; dy <= 4; dy++) for (var dz = -4; dz <= 4; dz++) {
                if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 5) continue;
                if (getB(x + dx, y + dy, z + dz) === LEAVES) RT.decayQ.push(x + dx, y + dy, z + dz);
            }
        }
        if (b === ORE_DIA && harvest) unlock('diamonds');
    }
    function digTick(dt) {
        if (!RT.mouse.l || RT.dead || RT.panel || RT.paused) { RT.digT = 0; return; }
        var hitEnt = entRay();
        if (hitEnt) { RT.digT = 0; return; }   // swinging at a mob, not a block
        var t = RT.target;
        if (!t) { RT.digT = 0; return; }
        if (!RT.digAt || RT.digAt[0] !== t.x || RT.digAt[1] !== t.y || RT.digAt[2] !== t.z) {
            RT.digAt = [t.x, t.y, t.z]; RT.digT = 0;
            RT.digNeed = breakTime(t.b);
        }
        if (RT.digCd > 0) return;
        RT.digT += dt;
        RT.swing = 0.25;
        if (RT.digT >= RT.digNeed) {
            breakBlock(t.x, t.y, t.z);
            RT.digT = 0; RT.digAt = null; RT.digCd = 0.25;
        }
    }

    /* ── placing / using ────────────────────────────────────── */
    var BREED = { cow: 'wheat', sheep: 'wheat', pig: 'carrot', chicken: 'seeds' };
    function tryUse() {
        if (RT.dead || RT.panel || RT.paused) return;
        var t = RT.target, h = held(), def = h && I[h.id];
        RT.swing = 0.25;
        // a mob under the crosshair takes priority (feed / breed / milk)
        var ef = entRay();
        if (ef && h) {
            if (ef.k === 'cow' && !ef.baby && h.id === 'bucket') { if (h.c > 1 && invFree('milk_bucket') < 1) return; swapHeld('milk_bucket'); snd('pop'); return; }
            var food = BREED[ef.k];
            if (food && h.id === food) {
                if (ef.baby > 0) { ef.baby = Math.max(0, ef.baby - 6); heartParticles(ef); useOne(); snd('eat'); return; }
                if (ef.mateCd <= 0 && ef.love <= 0) { ef.love = 30; heartParticles(ef); useOne(); snd('eat'); unlock('breed2'); return; }
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
            if (t.b === TNT) { igniteTnt(t.x, t.y, t.z); return; }
        }
        if (!h) return;
        // right-click armor → wear it
        if (def && def.armor && !S.armor[def.armor.slot]) {
            S.armor[def.armor.slot] = { id: h.id, c: 1, dur: h.dur, ench: h.ench, name: h.name };
            S.inv[S.sel] = null; paintHotbar(); paintVitals(); snd('click'); unlock('armor'); return;
        }
        // buckets: scoop, pour, and obsidian-forming
        if (h.id === 'bucket' && t) {
            if (t.b === WATER) { setB(t.x, t.y, t.z, AIR, true); relight(t.x, t.z); dirtyAround(t.x, t.y, t.z); swapHeld('water_bucket'); snd('pop'); return; }
            if (t.b === LAVA) { setB(t.x, t.y, t.z, AIR, true); relight(t.x, t.z); dirtyAround(t.x, t.y, t.z); swapHeld('lava_bucket'); snd('pop'); return; }
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
        h.c--; if (!h.c) S.inv[S.sel] = null;
        paintHotbar();
        if (id === TABLE) unlock('table');
        if (id === FURN) unlock('furnace');
    }
    function boxOverlapsCell(px, py, pz, hw, hgt, bx, by, bz) {
        return px + hw > bx && px - hw < bx + 1 && py + hgt > by && py < by + 1 && pz + hw > bz && pz - hw < bz + 1;
    }
    function useTick(dt) {   // held-down right mouse: eating, bow
        var h = held(), def = h && I[h.id];
        if (!RT.mouse.r || RT.dead || RT.panel || RT.paused || !def) { finishUse(); return; }
        if (def.food) {
            if (S.food >= 20 && h.id !== 'flesh') { RT.eatT = 0; return; }
            RT.eatT += dt;
            if (RT.eatT > 0.25 && Math.floor(RT.eatT / 0.3) !== Math.floor((RT.eatT - dt) / 0.3)) snd('eat');
            if (RT.eatT >= 1.6) {
                S.food = Math.min(20, S.food + def.food.f);
                S.sat = Math.min(S.food, S.sat + def.food.sat);
                if (def.heal) S.hp = Math.min(20, S.hp + def.heal);   // golden apple heals
                var wasId = h.id, wasBowl = def.bowl;
                h.c--; if (!h.c) S.inv[S.sel] = null;
                if (wasBowl) invGive('bowl', 1);                       // stew leaves the bowl
                RT.eatT = 0; snd('burp');
                paintHotbar(); paintVitals();
                if (wasId === 'bread') unlock('bread');
                if (wasId === 'golden_apple') unlock('gapple');
            }
        } else if (h.id === 'bow') {
            if (invCount('arrow') < 1 && RT.bowT === 0) return;
            RT.bowT = Math.min(1, RT.bowT + dt);
        } else if (def.place != null || (def.tool && def.tool.k === 'hoe') || h.id === 'bonemeal') {
            // hold-to-build: repeat placement like the real game (mousedown already fired the first one)
            RT.placeCd -= dt;
            if (RT.placeCd <= 0) { tryUse(); RT.placeCd = 0.22; }
        }
    }
    function finishUse() {
        var hb0 = held(), infinite = hb0 && hb0.id === 'bow' && ench(hb0, 'infinity') > 0;
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
        else if (f.hostile && dist < 18 && !RT.dead) {
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
        if (f.hostile && cdmg && f.ifr <= 0 && !RT.dead &&
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
        // provoked by a direct look at close range, or when struck
        if (!f.aggro && dist < 24) {
            var la = look(), t = rayBox(S.px, S.py + EYE, S.pz, la, f.x - f.hw, f.y + f.h * 0.55, f.z - f.hw, f.x + f.hw, f.y + f.h, f.z + f.hw);
            if (t != null && (!RT.target || RT.target.dist > t)) { f.aggro = 12; snd('endermad'); }
        }
        if (f.hurtF > 0.24 && Math.random() < 0.35) { teleportEnder(f); f.aggro = 12; }   // flickers away when hit
        var want = null, sp = MOBS.enderman.sp;
        if (f.aggro > 0 && !RT.dead) {
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
        RT.swing = 0.25;
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
        var c = RT.chunks[keys[(Math.random() * keys.length) | 0]];
        if (!c) return;
        var lx = (Math.random() * CW) | 0, lz = (Math.random() * CW) | 0;
        var wx = c.cx * CW + lx, wz = c.cz * CW + lz;
        var y = hostile ? 3 + ((Math.random() * (CH - 10)) | 0) : heightAt(wx, wz) + 1;
        if (y < 1 || y >= CH - 2) return;
        // needs: solid floor, two air cells, nobody inside a wall (the Terraria lesson)
        if (!solidAt(wx, y - 1, wz)) return;
        if (getB(wx, y, wz) !== AIR || getB(wx, y + 1, wz) !== AIR) return;
        if (getB(wx, y - 1, wz) === -1) return;
        var dx = wx + 0.5 - S.px, dz = wz + 0.5 - S.pz, dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 20 || dist > 52) return;
        var kind;
        if (hostile) {
            var sky = getSky(wx, y, wz), blk = getBlk(wx, y, wz);
            if (blk >= 8) return;                                   // torchlight keeps them out
            if (sky > 0 && (st.day || sky * st.dayF > 5)) return;   // surface spawns only in darkness
            var r = Math.random();
            if (y < 40 && r < 0.14) kind = 'slime';                 // slimes deep down
            else if (r < 0.36) kind = 'zombie';
            else if (r < 0.55) kind = 'skeleton';
            else if (r < 0.72) kind = 'spider';
            else if (r < 0.9) kind = 'creeper';
            else kind = 'enderman';
        } else {
            if (getB(wx, y - 1, wz) !== GRASS) return;
            if (getSky(wx, y, wz) < 9) return;
            var r2 = Math.random();
            kind = r2 < 0.3 ? 'pig' : r2 < 0.55 ? 'cow' : r2 < 0.8 ? 'sheep' : 'chicken';
        }
        var nf = mkFoe(kind, wx + 0.5, y, wz + 0.5);
        if (kind === 'slime') { nf.sz = 1 + ((Math.random() * 3) | 0); applySlimeSize(nf); }
        RT.foes.push(nf);
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
        if (RT.drops.length > 200) return;
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
            if (a.mine && !a.noPick) dropItem(a.x, a.y, a.z, 'arrow', 1);
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
        var uv0 = tileUV(TEX[b][2]);
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
    function pushBillboard(v, x, y, z, size, u0, v0, u1, v1, sk, bl, wh) {
        var r = RT.camR, u = RT.camU;
        var cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (var k = 0; k < 4; k++) {
            var a = cs[k][0] * size, b = cs[k][1] * size;
            v.push(x + r[0] * a + u[0] * b, y + r[1] * a + u[1] * b, z + r[2] * a + u[2] * b,
                cs[k][0] > 0 ? u1 : u0, cs[k][1] > 0 ? v0 : v1,
                sk, bl, 1, wh);
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
                    (function (pl) { return function (dd) { return TEX[pl][dd === 2 ? 0 : dd === 3 ? 1 : 2]; }; })(def.place),
                    DL[0], DL[1], 0);
            } else {
                var tid2 = def && def.tile != null ? def.tile : (def && def.place != null ? TEX[def.place][0] : TILE.i_stick);
                var u2 = tileUV(tid2);
                pushBillboard(v, dr.x, dr.y + bob + 0.15, dr.z, 0.17, u2[0] + INSET, u2[1] + INSET, u2[0] + TS16 - INSET, u2[1] + TS16 - INSET, DL[0], DL[1], 0);
            }
        }
        for (i = 0; i < RT.arrows.length; i++) {
            var ar = RT.arrows[i];
            var AL = cellLight(ar.x, ar.y, ar.z);
            var ayaw = Math.atan2(-ar.vx, ar.vz);
            pushBox(v, ar.x, ar.y, ar.z, 0.03, 0.03, 0.28, Math.cos(ayaw), Math.sin(ayaw), 0, 0,
                function () { return TILE.i_stick; }, AL[0], AL[1], 0);
        }
        for (i = 0; i < RT.orbs.length; i++) {
            var o = RT.orbs[i], ou = tileUV(TILE.xporb);
            var obob = Math.sin(RT.worldMs / 220 + i) * 0.03;
            pushBillboard(v, o.x, o.y + 0.12 + obob, o.z, o.v >= 7 ? 0.16 : 0.11, ou[0] + INSET, ou[1] + INSET, ou[0] + TS16 - INSET, ou[1] + TS16 - INSET, 1, 0.4, 0);
        }
        for (i = 0; i < RT.parts.length; i++) {
            var pp = RT.parts[i];
            var PL = cellLight(pp.x, pp.y, pp.z);
            pushBillboard(v, pp.x, pp.y, pp.z, pp.s, pp.u, pp.v, pp.u + TS16 / 10, pp.v + TS16 / 10, Math.max(0.25, PL[0]), PL[1], 0);
        }
        if (RT.sleep) {   // fade handled by overlay; nothing extra here
        }
    }

    /* ── first-person hand (view space) ─────────────────────── */
    function handGeo() {
        if (RT.dead || RT.sleep) return [];
        var v = [], h = held(), def = h && I[h.id];
        var L = cellLight(S.px, S.py + EYE, S.pz);
        var sk2 = Math.max(0.18, L[0]), bl2 = L[1];
        var swingP = RT.swing > 0 ? Math.sin((0.25 - RT.swing) / 0.25 * Math.PI) : 0;
        var bobX = Math.sin(RT.bob) * 0.012, bobY = Math.abs(Math.cos(RT.bob)) * 0.014;
        var ox = 0.42 + bobX - swingP * 0.14, oy = -0.42 - bobY - swingP * 0.22, oz = -0.72 - swingP * 0.18;
        var pull = RT.bowT > 0 ? RT.bowT * 0.12 : 0;
        var eatN = RT.eatT > 0 ? Math.sin(RT.eatT * 22) * 0.03 : 0;
        oy += eatN; oz += pull;
        if (def && def.place != null && !B[def.place].cross && !B[def.place].half) {
            pushBox(v, ox, oy + eatN, oz, 0.16, 0.16, 0.16, Math.cos(0.62), Math.sin(0.62), swingP * 0.6, 0,
                (function (pl) { return function (dd) { return TEX[pl][dd === 2 ? 0 : dd === 3 ? 1 : 2]; }; })(def.place),
                sk2, bl2, 0);
        } else if (h) {
            var tid = def && def.tile != null ? def.tile : TILE.i_stick;
            var u0 = tileUV(tid);
            // an angled card: item sprites read great edge-on at this res
            var yc2 = Math.cos(0.8 + swingP * 0.7), ys2 = Math.sin(0.8 + swingP * 0.7);
            var cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
            for (var k = 0; k < 4; k++) {
                var a = cs[k][0] * 0.22, b = cs[k][1] * 0.22;
                v.push(ox + yc2 * a, oy + b + 0.08, oz + ys2 * a,
                    cs[k][0] > 0 ? u0[0] + TS16 - INSET : u0[0] + INSET,
                    cs[k][1] > 0 ? u0[1] + INSET : u0[1] + TS16 - INSET,
                    sk2, bl2, 1, 0);
            }
        } else {
            pushBox(v, ox + 0.05, oy, oz, 0.09, 0.09, 0.3, Math.cos(0.5), Math.sin(0.5), swingP * 0.8, -0.2,
                function () { return TILE.i_leather; }, sk2, bl2, 0);
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
            var top = tsrc(tx[0]), side = tsrc(tx[2]);
            function face(tf, sx, shade) {
                c.setTransform(tf[0], tf[1], tf[2], tf[3], tf[4], tf[5]);
                c.drawImage(ATLAS, sx.x, sx.y, 16, 16, 0, 0, 16, 16);
                if (shade) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(8,8,16,' + shade + ')'; c.fillRect(0, 0, 16, 16); c.globalCompositeOperation = 'source-over'; }
                c.setTransform(1, 0, 0, 1, 0, 0);
            }
            face([0.72, 0.36, -0.72, 0.36, 16, 2.5], top, 0);
            face([0.72, 0.36, 0, 0.82, 4.5, 8.5], side, 0.28);
            face([0.72, -0.36, 0, 0.82, 16, 14.2], side, 0.45);
        } else {
            var tid = def && def.tile != null ? def.tile : (def && def.place != null ? TEX[def.place][0] : TILE.i_stick);
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
        for (var i = 0; i < all.length; i++) if (all[i]) dropItem(x + 0.5, y + 0.5, z + 0.5, all[i].id, all[i].c, all[i].dur);
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
            if (t.burn > 0) t.burn -= dt;
            if (t.burn <= 0 && cookable && t.fuel && I[t.fuel.id] && I[t.fuel.id].fuel) {
                t.burnMax = t.burn = I[t.fuel.id].fuel;
                t.fuel.c--; if (!t.fuel.c) t.fuel = null;
            }
            if (t.burn > 0 && cookable) {
                t.prog += dt;
                if (t.prog >= SMELT_S) {
                    t.prog = 0;
                    var outId = SMELTS[t.fin.id];
                    if (t.out) t.out.c++; else t.out = { id: outId, c: 1 };
                    t.fin.c--; if (!t.fin.c) t.fin = null;
                }
            } else if (t.prog > 0) t.prog = Math.max(0, t.prog - dt * 2);
            var want = t.burn > 0 ? FURN_LIT : FURN;
            if (getB(x, y, z) !== want && (getB(x, y, z) === FURN || getB(x, y, z) === FURN_LIT)) setB(x, y, z, want);
            if (RT.panel && RT.panel.key === k) paintFurnaceBits(t);
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
    function rollEnchants(st, level) {
        var cat = enchCategory(st); if (!cat) return null;
        var pool = ENCH_POOL[cat].slice(), res = {}, count = 0;
        while (pool.length && count < 3) {
            var e = pool.splice((Math.random() * pool.length) | 0, 1)[0];
            var maxL = ENCH_MAX[e];
            var lvl = Math.max(1, Math.min(maxL, Math.round(level / 30 * maxL * (0.5 + Math.random() * 0.5))));
            res[e] = lvl; count++;
            if (e === 'silk') pool = pool.filter(function (x) { return x !== 'fortune'; });
            if (e === 'fortune') pool = pool.filter(function (x) { return x !== 'silk'; });
            if (Math.random() > 0.35 + level / 45) break;   // higher levels → more enchants
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
            var er = rollEnchants(it, lv[i]);
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
        var out = { id: a.id, c: a.c, dur: a.dur, ench: a.ench ? JSON.parse(JSON.stringify(a.ench)) : null };
        var cost = 0, did = false;
        if (RT.anvilName && RT.anvilName !== (a.name || '')) { out.name = RT.anvilName; cost += 1; did = true; }
        if (b) {
            var da = I[a.id], db = I[b.id];
            // repair with matching material or a second identical tool
            if (da && (da.tool || da.armor || da.dur != null) && a.dur != null) {
                if (b.id === a.id && b.dur != null) {   // combine two of the same: repair + merge enchants
                    var maxd = da.tool ? da.tool.dur : da.armor ? da.armor.dur : da.dur;
                    out.dur = Math.min(maxd, a.dur + b.dur + Math.floor(maxd * 0.12));
                    out.ench = mergeEnch(a.ench, b.ench); cost += 2; did = true;
                } else if (b.id === 'ench_book' && b.ench) {   // apply an enchanted book
                    out.ench = mergeEnch(a.ench, b.ench); cost += 2; did = true;
                }
            }
        }
        if (!did) return null;
        cost += enchLevelCost(out.ench) - enchLevelCost(a.ench);
        return { out: out, cost: Math.max(1, cost) };
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
        RT.anvilA = null; RT.anvilB = null; RT.anvilName = '';
        var left = invGive(out.id, out.c, out.dur, out.ench, out.name);   // hand back the whole stack, enchant + name intact
        if (left > 0) dropItem(S.px, S.py + 1, S.pz, out.id, left, out.dur, false, out.ench, out.name);
        snd('anvil'); unlock('anvil2');
        paintPanel(); paintHotbar();
    }

    /* ── panels ─────────────────────────────────────────────── */
    function slotGroup(g) {
        var t;
        if (g === 'inv') return { get: function (i) { return S.inv[i]; }, set: function (i, v) { S.inv[i] = v; } };
        if (g === 'armor') return { get: function (i) { return S.armor[i]; }, set: function (i, v) { S.armor[i] = v; } };
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
        var wrap = RT.el.querySelector('.mc-panelwrap');
        wrap.innerHTML = '<div class="mc-panel">' + panelHTML(kind) + '</div><div class="mc-cur"></div>';
        wrap.style.display = '';
        unlockCursor();
        wirePanel(wrap);
        paintPanel();
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
            if (RT.cur) { cur.style.display = ''; cur.style.backgroundImage = 'url(' + iconURL(RT.cur.id) + ')'; cur.innerHTML = RT.cur.c > 1 ? '<span class="mc-ct">' + RT.cur.c + '</span>' : ''; }
            else cur.style.display = 'none';
        }
        if (RT.panel.kind === 'furnace') paintFurnaceBits(S.tents[RT.panel.key]);
        if (RT.panel.kind === 'ench') {
            var opts = wrap.querySelectorAll('.mc-enchopt');
            for (var o = 0; o < opts.length; o++) {
                var op = RT.enchOpts && RT.enchOpts[o];
                if (!op || !op.ench) { opts[o].style.display = 'none'; continue; }
                opts[o].style.display = '';
                var afford = S.xpl >= op.level && RT.enchLapis && RT.enchLapis.c >= op.lapis;
                opts[o].className = 'mc-enchopt' + (afford ? '' : ' dim');
                opts[o].innerHTML = '<span class="eo-lap">' + op.lapis + '</span><span class="eo-txt">' + esc(op.label) + '</span><span class="eo-lvl">' + op.level + '</span>';
            }
        }
        if (RT.panel.kind === 'anvil') {
            var cs = wrap.querySelector('.mc-anvcost');
            if (cs) cs.textContent = anv ? ('Cost: ' + anv.cost + (S.xpl >= anv.cost ? '' : ' (need level ' + anv.cost + ')')) : '';
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
                    if (I[r.out] && (I[r.out].tool || I[r.out].dur)) RT.cur.dur = I[r.out].tool ? I[r.out].tool.dur : I[r.out].dur;
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
        var left;
        if (g === 'inv') {
            // shift-click armour → equip into its slot
            var adef = I[st.id] && I[st.id].armor;
            if (adef && !S.armor[adef.slot]) { S.armor[adef.slot] = st; grp.set(idx, null); paintVitals(); paintPanel(); return; }
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
        if (!cur) { t[field] = { id: st.id, c: st.c, dur: st.dur }; return 0; }
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
        if (shift) { quickMove(g, idx); paintHotbar(); return; }
        var grp = slotGroup(g), st = grp.get(idx);
        if (RT.cur && !slotAccepts(g, idx, RT.cur)) return;   // wrong item for this special slot
        if (g === 'fout') {   // output: take only
            if (!st) return;
            if (!RT.cur) { RT.cur = st; grp.set(idx, null); if (st.id === 'iron') unlock('iron'); }
            else if (RT.cur.id === st.id && RT.cur.c + st.c <= stkMax(st.id)) { RT.cur.c += st.c; grp.set(idx, null); if (st.id === 'iron') unlock('iron'); }
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
        paintPanel(); paintHotbar();
    }
    function wirePanel(wrap) {
        function handler(e) {
            var el = e.target;
            while (el && el !== wrap && el.getAttribute && !el.getAttribute('data-g') && el.getAttribute('data-o') == null) el = el.parentNode;
            if (!el || el === wrap) return;
            var eo = el.getAttribute && el.getAttribute('data-o');
            if (eo != null) { applyEnchOption(eo | 0); e.preventDefault(); e.stopPropagation(); return; }
            slotClick(el.getAttribute('data-g'), el.getAttribute('data-i') | 0, e.type === 'contextmenu', e.shiftKey);
            e.preventDefault(); e.stopPropagation();
        }
        wrap.addEventListener('mousedown', function (e) { if (e.button === 0) handler(e); });
        wrap.addEventListener('contextmenu', handler);
        wrap.addEventListener('mousemove', function (e) {
            var cur = wrap.querySelector('.mc-cur');
            if (!cur) return;
            var r = wrap.getBoundingClientRect();
            cur.style.left = (e.clientX - r.left + 6) + 'px';
            cur.style.top = (e.clientY - r.top + 6) + 'px';
        });
        var nameIn = wrap.querySelector('.mc-anvin');
        if (nameIn) {
            nameIn.addEventListener('input', function () { RT.anvilName = nameIn.value; paintPanel(); });
            nameIn.addEventListener('keydown', function (e) { e.stopPropagation(); });   // typing must not drive the game
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
        S.ents = [];
        var i;
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
        try { localStorage.setItem('comp_mc', JSON.stringify(S)); } catch (e) {}
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
        if (document.pointerLockElement === RT.cv) { RT.expectUnlock = false; if (RT.paused) hidePause(); RT.el.focus(); }
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
        RT.fpsN++; RT.fpsT += dt;
        if (RT.fpsT >= 1) { RT.fps = RT.fpsN; RT.fpsN = 0; RT.fpsT = 0; }
        if (!RT.ready) {   // world boot: gen → light → mesh → go
            var total = (VIEW * 2 + 1) * (VIEW * 2 + 1);
            if (RT.genQ.length) {
                for (var g = 0; g < 3 && RT.genQ.length; g++) {
                    var k = RT.genQ.shift(), p = k.split(',');
                    if (!RT.chunks[k]) genChunk(p[0] | 0, p[1] | 0);
                }
                bootBar((total - RT.genQ.length) / total * 0.6);
            } else if (!RT.lit) {
                lightInitAll();
                RT.lit = true;
                RT.ckeys = Object.keys(RT.chunks);
                for (var mk in RT.chunks) RT.meshQ.push(mk);
                bootBar(0.65);
            } else if (RT.meshQ.length) {
                meshStep(4);
                var total2 = (VIEW * 2 + 1) * (VIEW * 2 + 1);
                bootBar(0.65 + 0.35 * (1 - RT.meshQ.length / total2));
            } else {
                RT.ready = true;
                // if the spawn column grew something since it was chosen, surface politely
                var guard = 0;
                while (boxHits(S.px, S.py, S.pz) && S.py < CH - 2 && guard++ < CH) S.py += 1;
                RT.fallY = S.py; RT.vy = 0;
                RT.el.querySelector('.mc-load').style.display = 'none';
                restoreEnts();
                paintHotbar(); paintVitals();
                if (RT.onReady) { try { RT.onReady(); } catch (e) {} RT.onReady = null; }
                if (!RT.devFree) showPause();
            }
            return;
        }
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
            S.t = (S.t + dt * 1000) % CYCLE;
            RT.iframe = Math.max(0, RT.iframe - dt);
            RT.digCd = Math.max(0, RT.digCd - dt);
            RT.atkCd = Math.max(0, RT.atkCd - dt);
            RT.swing = Math.max(0, RT.swing - dt);
            RT.flash = Math.max(0, RT.flash - dt);
            RT.shake = Math.max(0, RT.shake - dt);
            RT.lightning = Math.max(0, (RT.lightning || 0) - dt);
            RT.target = raycast();
            stepPlayer(dt);
            digTick(dt);
            useTick(dt);
            foodTick(dt);
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
            if (RT.hudT > 0.2) { RT.hudT = 0; paintVitals(); paintXp(); paintDebug(); tipFade(dt); }
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

    /* ── skeleton + wiring ──────────────────────────────────── */
    function render() {
        return '<div class="mc" tabindex="0">' +
            '<canvas class="mc-cv"></canvas>' +
            '<div class="mc-vig"></div>' +
            '<div class="mc-hud">' +
            '<div class="mc-cross"><i></i><i class="v"></i></div>' +
            '<div class="mc-armor"></div>' +
            '<div class="mc-vitals"><div class="mc-hearts"></div><div class="mc-food"></div></div>' +
            '<div class="mc-air"></div>' +
            '<div class="mc-tip"></div>' +
            '<div class="mc-xpbar"><i class="mc-xpfill"></i><span class="mc-xplvl"></span></div>' +
            '<div class="mc-hotbar">' + slotsHTML('inv', 0, 9, 'mc-hb') + '</div>' +
            '</div>' +
            '<div class="mc-toasts"></div>' +
            '<div class="mc-panelwrap" style="display:none"></div>' +
            '<div class="mc-debug" style="display:none"></div>' +
            '<div class="mc-sleepov" style="display:none">Sleeping…</div>' +
            '<div class="mc-pause" style="display:none"><div class="mc-menu">' +
            '<h3>Game Menu</h3>' +
            '<button class="mc-btn mc-resume">Back to Game</button>' +
            '<button class="mc-btn mc-achbtn">Achievements</button>' +
            '<div class="mc-optrow"><button class="mc-btn half mc-snd">Sound: ON</button><button class="mc-btn half mc-mus">Music: ON</button></div>' +
            '<p class="mc-hint">WASD move · Space jump · double-tap W sprints · Shift sneak<br>LMB mine · RMB place/use · E inventory · Q drop · F3 debug</p>' +
            '<div class="mc-achs" style="display:none"><div class="mc-achn"></div><div class="mc-achrows"></div></div>' +
            '</div></div>' +
            '<div class="mc-death" style="display:none"><div class="mc-menu"><h3>You died!</h3><div class="mc-dscore"></div>' +
            '<button class="mc-btn mc-respawn">Respawn</button></div></div>' +
            '<div class="mc-load"><div class="mc-menu"><h3>Building terrain…</h3><div class="mc-bar"><i></i></div></div></div>' +
            '</div>';
    }
    function init(el) {
        var root = el.querySelector('.mc');
        S = sLoad() || sNew();
        if (!S.inv.length) {
            S.inv = new Array(36).fill(null);
        }
        // migrate saves from before the expansion
        if (!S.armor) S.armor = [null, null, null, null];
        if (S.xpl == null) { S.xpl = 0; S.xp = 0; }
        if (S.weather == null) { S.weather = 0; S.wt = 120; }
        var devModes = devPre();   // ?mcdev= swaps in a fresh scenario world before anything reads S
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
            vy: 0, ground: false, fallY: S.py, sprint: false,
            exh: 0, regenT: 0, starveT: 0, iframe: 0, digT: 0, digCd: 0, digNeed: 1, digAt: null, atkCd: 0,
            eatT: 0, bowT: 0, swing: 0, bob: 0, flash: 0, shake: 0, sleep: 0, placeCd: 0,
            target: null, panel: null, cur: null, craft: [null, null, null, null, null, null, null, null, null], craftW: 2,
            paused: false, dead: S.hp <= 0, ready: false, lit: false, expectUnlock: false,
            worldMs: 0, playT: 0, baseHrs: S.hrs || 0, lastT: 0, secT: 0, hudT: 0, saveT: 0,
            fps: 0, fpsN: 0, fpsT: 0, f3: false, musT: 25, tipT: 0, tipId: null, devFree: !!devModes, raf: 0, timers: []
        };
        buildSkyGeo(G);
        if (S.hp <= 0) {   // died mid-save: respawn silently at the last bed/world spawn (and clear the dead flag, or input stays frozen all session)
            S.hp = 20; S.food = 20; S.sat = 5; S.air = 10;
            RT.dead = false;
            var dsp = S.spawn || S.wspawn;
            if (dsp) { S.px = dsp[0]; S.py = dsp[1]; S.pz = dsp[2]; RT.fallY = dsp[1]; }
        }
        if (devModes) devPost(devModes);
        // fresh world: starting position + a bootstrapping run of chunks
        if (!S.wspawn) {
            S.wspawn = findSpawn();
            S.px = S.wspawn[0]; S.py = S.wspawn[1]; S.pz = S.wspawn[2];
        }
        ensureChunks();
        sizeCanvas();
        RT.ro = new ResizeObserver(sizeCanvas);
        RT.ro.observe(root);
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
        root.addEventListener('keydown', function (e) {
            var k = e.key.toLowerCase();
            if (e.key === 'Escape') {
                if (RT.panel) { closePanel(); e.stopPropagation(); }
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
            RT.keys[k] = true;
            // sprint is double-tap W only — holding real Ctrl arms Ctrl+W (closes the tab!)
            if (k === 'w' && RT.lastW && performance.now() - RT.lastW < 280) RT.sprint = true;
            if (k === 'w') RT.lastW = performance.now();
            if (k === ' ') e.preventDefault();
            if (k === 'e' && RT.ready && !RT.dead && !RT.paused) { if (RT.panel) closePanel(); else openPanel('inv'); }
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
            if (n >= 1 && n <= 9) { S.sel = n - 1; paintHotbar(); }
            e.stopPropagation();
        });
        root.addEventListener('keyup', function (e) {
            RT.keys[e.key.toLowerCase()] = false;
            e.stopPropagation();
        });
        root.addEventListener('blur', function () { RT.keys = {}; RT.mouse.l = RT.mouse.r = false; });
        cv.addEventListener('mousedown', function (e) {
            audioInit();
            root.focus();
            if (!RT.ready || RT.dead) return;
            if (!document.pointerLockElement && !RT.devFree) {
                if (!RT.panel && !RT.paused) lockCursor();
                return;
            }
            if (e.button === 0) { RT.mouse.l = true; attack(); }
            if (e.button === 2) { RT.mouse.r = true; RT.placeCd = 0.3; tryUse(); }
            e.preventDefault();
        });
        cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        window.addEventListener('mouseup', RT.mup = function (e) {
            if (!RT) return;
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
            if (RT.panel || RT.paused) return;
            S.sel = ((S.sel + (e.deltaY > 0 ? 1 : -1)) % 9 + 9) % 9;
            paintHotbar();
            e.preventDefault();
        }, { passive: false });
        // menu buttons
        root.querySelector('.mc-resume').addEventListener('click', function () { audioInit(); hidePause(); lockCursor(); });
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
            dbg: function () { return { target: RT.target, digT: RT.digT, digNeed: RT.digNeed, mouseL: RT.mouse.l, paused: RT.paused, panel: !!RT.panel, dead: RT.dead, yaw: S.yaw, pitch: S.pitch }; },
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
            mouse: function (btn, down) { if (btn === 0) { RT.mouse.l = !!down; if (down) attack(); } else { RT.mouse.r = !!down; if (down) tryUse(); else finishUse(); } },
            openInv: function () { openPanel('inv'); },
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
        hours: function () { var s = S || sLoad(); return s ? (s.hrs || 0) : 0; }
    };
})();
