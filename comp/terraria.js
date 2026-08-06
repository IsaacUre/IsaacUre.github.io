/* ============================================================
   TERRARIA — a deep, faithful little one, in a window on UreOS.
   A 420×232 generated world with real biomes (forest, desert,
   snow, jungle, corruption chasm, ocean shores, floating sky
   islands, and an ash-and-hellstone underworld), a background
   WALL layer, flowing WATER and LAVA on a liquid layer, twelve
   ores + six gems, chests you loot, pots, life & mana crystals,
   fallen stars at night. Colored flood-fill torchlight, a
   day/night cycle, particles, parallax sky.

   Play it: grappling hook, double-jump/boots/horseshoe
   accessories, five armor sets that grant defense, melee +
   bow-and-arrow + a mana-fed magic bolt, potions (heal/mana/
   buffs with a buff bar), and a stack-on-the-cursor inventory
   with armor / accessory / ammo / trash slots — exactly like
   the real game. Slimes, zombies, demon eyes, bats, skeletons,
   hornets; the Guide, Merchant and Nurse wander your base; and
   three bosses (King Slime, the Eye of Cthulhu, the Eater of
   Worlds) if you dare craft what summons them. Rebindable keys,
   a fog-of-war fullscreen map (M), a settings panel.

   Saves under comp_terraria (world RLE-packed, v2; a v1 save's
   achievements/coins/stats migrate forward). Exposes
   window.TERRA { render, init, close, steamAch } for comp.js;
   achievements feed the Steam client live, playtime lands on
   the library page. window.__terra is a headless test handle
   (rAF is frozen off-screen, so step()/draw() are callable).
   ============================================================ */
(function () {
'use strict';

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
var lerp = function (a, b, k) { return a + (b - a) * k; };

/* ─────────────── world constants ─────────────── */
var W = 420, H = 232, TS = 8;              // tiles wide/high, tile size in WORLD px
var RS = 2;                                 // device px per world px: every tile gets a 16×16 art budget
var HELL = H - 28;                          // underworld start row
var SKY = 26;                               // floating-island band ceiling
var DAY = 300, NIGHT = 165, CYCLE = DAY + NIGHT;   // seconds
var GRAV = 0.17, TERMV = 6.4;

/* ─────────────── tile ids ─────────────── */
var T_AIR = 0, T_DIRT = 1, T_GRASS = 2, T_STONE = 3, T_PLANK = 4, T_TRUNK = 5, T_LEAF = 6,
    T_SAND = 7, T_SNOW = 8, T_ICE = 9, T_MUD = 10, T_JGRASS = 11, T_CLAY = 12, T_SILT = 13,
    T_ASH = 14, T_HELLSTONE = 15, T_OBSIDIAN = 16, T_COBWEB = 17, T_CLOUD = 18, T_EBON = 19, T_CGRASS = 20,
    T_COPPER = 21, T_IRON = 22, T_SILVER = 23, T_GOLD = 24, T_DEMONITE = 25, T_METEOR = 26,
    T_AMETHYST = 27, T_TOPAZ = 28, T_SAPPHIRE = 29, T_EMERALD = 30, T_RUBY = 31, T_DIAMOND = 32,
    T_TORCH = 33, T_BENCH = 34, T_FURNACE = 35, T_ANVIL = 36, T_TABLE = 37, T_CHAIR = 38, T_DOOR = 39,
    T_POT = 40, T_HEARTC = 41, T_MANAC = 42, T_CHEST = 43, T_PLATFORM = 44, T_SAPLING = 45,
    T_HELLFORGE = 46, T_BOTTLE = 47, T_WOODWALLB = 48, T_DOOROPEN = 49;

var GEMS = [T_AMETHYST, T_TOPAZ, T_SAPPHIRE, T_EMERALD, T_RUBY, T_DIAMOND];
var ORES = [T_COPPER, T_IRON, T_SILVER, T_GOLD, T_DEMONITE, T_METEOR, T_HELLSTONE];

/* solid (blocks movement) */
var SOLID = {};
[T_DIRT, T_GRASS, T_STONE, T_PLANK, T_SAND, T_SNOW, T_ICE, T_MUD, T_JGRASS, T_CLAY, T_SILT,
 T_ASH, T_HELLSTONE, T_OBSIDIAN, T_CLOUD, T_EBON, T_CGRASS, T_COPPER, T_IRON, T_SILVER, T_GOLD,
 T_DEMONITE, T_METEOR, T_AMETHYST, T_TOPAZ, T_SAPPHIRE, T_EMERALD, T_RUBY, T_DIAMOND,
 T_BENCH, T_FURNACE, T_ANVIL, T_TABLE, T_HELLFORGE, T_HEARTC, T_MANAC].forEach(function (t) { SOLID[t] = 1; });
// platforms are one-way (solid only from above) — handled in physics, not SOLID
var STATION = {}; STATION[T_BENCH] = 'bench'; STATION[T_FURNACE] = 'furnace'; STATION[T_ANVIL] = 'anvil';
STATION[T_TABLE] = 'table'; STATION[T_HELLFORGE] = 'hellforge'; STATION[T_BOTTLE] = 'bottle';

/* tile colours [main, shade, edge-hi] */
var TCOL = {};
TCOL[T_DIRT] = ['#6b4a2a', '#573b21', '#7c5732']; TCOL[T_GRASS] = ['#4a9c3a', '#3a7c2e', '#63c04a'];
TCOL[T_STONE] = ['#7f7f88', '#666670', '#94949e']; TCOL[T_PLANK] = ['#9c7040', '#7f5a33', '#b0824c'];
TCOL[T_TRUNK] = ['#7a5228', '#5f3f1f', '#8c6030']; TCOL[T_LEAF] = ['#3a8a30', '#2f7027', '#4aa03a'];
TCOL[T_SAND] = ['#dcc888', '#c3ac6b', '#ecdaa0']; TCOL[T_SNOW] = ['#eaf1f7', '#cdd8e4', '#ffffff'];
TCOL[T_ICE] = ['#9cc8e6', '#7ba9cc', '#c2e2f4']; TCOL[T_MUD] = ['#5a4632', '#463625', '#6b543c'];
TCOL[T_JGRASS] = ['#6bbf2a', '#4f971d', '#88d63c']; TCOL[T_CLAY] = ['#9c5a44', '#7f4735', '#b06a52'];
TCOL[T_SILT] = ['#6d6a72', '#57545c', '#807d86']; TCOL[T_ASH] = ['#4a4550', '#3a3642', '#565060'];
TCOL[T_HELLSTONE] = ['#8a2a1a', '#5f1c12', '#c04020']; TCOL[T_OBSIDIAN] = ['#2a2438', '#1c1828', '#3a3450'];
TCOL[T_COBWEB] = ['#c8ccd4', '#9aa0aa', '#e6e9ef']; TCOL[T_CLOUD] = ['#eef2fa', '#d2dcec', '#ffffff'];
TCOL[T_EBON] = ['#4a3a5c', '#372a45', '#5c4a72']; TCOL[T_CGRASS] = ['#8a52c8', '#6c3fa0', '#a066e0'];
TCOL[T_COPPER] = ['#c07038', '#7f7f88', '#e08a4a']; TCOL[T_IRON] = ['#b0a49a', '#7f7f88', '#cabeb2'];
TCOL[T_SILVER] = ['#d8dce6', '#7f7f88', '#f0f2fa']; TCOL[T_GOLD] = ['#e0b83a', '#7f7f88', '#ffd85a'];
TCOL[T_DEMONITE] = ['#4a5a86', '#33405f', '#6274a8']; TCOL[T_METEOR] = ['#8a4a3a', '#6a3529', '#b0604a'];
TCOL[T_AMETHYST] = ['#a24ad2', '#7f7f88', '#c876ec']; TCOL[T_TOPAZ] = ['#d29a2a', '#7f7f88', '#f0bc4a'];
TCOL[T_SAPPHIRE] = ['#3a7ad2', '#7f7f88', '#5c9cec']; TCOL[T_EMERALD] = ['#2aa24a', '#7f7f88', '#4ac86a'];
TCOL[T_RUBY] = ['#d23a4a', '#7f7f88', '#ec5c6a']; TCOL[T_DIAMOND] = ['#8ae6ea', '#7f7f88', '#c2f4f6'];
TCOL[T_PLATFORM] = ['#9c7040', '#7f5a33', '#b0824c']; TCOL[T_EBON] = ['#4a3a5c', '#372a45', '#5c4a72'];

var GEMCOL = {}; GEMCOL[T_AMETHYST] = '#c060f0'; GEMCOL[T_TOPAZ] = '#f0b840'; GEMCOL[T_SAPPHIRE] = '#4a90f0';
GEMCOL[T_EMERALD] = '#40c060'; GEMCOL[T_RUBY] = '#f04a5a'; GEMCOL[T_DIAMOND] = '#a0f0f4';

/* hardness (mining progress to break) */
var HARD = {};
HARD[T_DIRT] = 1; HARD[T_GRASS] = 1; HARD[T_SAND] = 1; HARD[T_SNOW] = 1; HARD[T_MUD] = 1.1; HARD[T_JGRASS] = 1.1;
HARD[T_CLAY] = 1.3; HARD[T_SILT] = 1; HARD[T_STONE] = 3; HARD[T_ICE] = 2; HARD[T_CLOUD] = 0.6;
HARD[T_PLANK] = 2; HARD[T_TRUNK] = 3; HARD[T_LEAF] = 0.5; HARD[T_ASH] = 1.8; HARD[T_COBWEB] = 0.3;
HARD[T_EBON] = 4.5; HARD[T_CGRASS] = 4.5; HARD[T_OBSIDIAN] = 6; HARD[T_HELLSTONE] = 7;
HARD[T_COPPER] = 4; HARD[T_IRON] = 5; HARD[T_SILVER] = 6; HARD[T_GOLD] = 7; HARD[T_DEMONITE] = 8; HARD[T_METEOR] = 6.5;
GEMS.forEach(function (g) { HARD[g] = 4; });
HARD[T_TORCH] = 0.4; HARD[T_BENCH] = 2; HARD[T_FURNACE] = 3; HARD[T_ANVIL] = 3; HARD[T_TABLE] = 2; HARD[T_CHAIR] = 1;
HARD[T_DOOR] = 2; HARD[T_POT] = 0.4; HARD[T_HEARTC] = 4; HARD[T_MANAC] = 4; HARD[T_CHEST] = 2.5;
HARD[T_DOOROPEN] = 2; HARD[T_PLATFORM] = 1; HARD[T_SAPLING] = 0.3; HARD[T_HELLFORGE] = 4; HARD[T_BOTTLE] = 0.4; HARD[T_WOODWALLB] = 0.6;

/* ─────────────── walls (background) ─────────────── */
var WL_NONE = 0, WL_DIRT = 1, WL_STONE = 2, WL_WOOD = 3, WL_ASH = 4, WL_SAND = 5, WL_SNOW = 6, WL_JUNGLE = 7, WL_EBON = 8;
var WLCOL = {}; WLCOL[WL_DIRT] = '#3a2818'; WLCOL[WL_STONE] = '#2b2b32'; WLCOL[WL_WOOD] = '#4a3620';
WLCOL[WL_ASH] = '#231519'; WLCOL[WL_SAND] = '#6b5f3a'; WLCOL[WL_SNOW] = '#5a6672'; WLCOL[WL_JUNGLE] = '#243318'; WLCOL[WL_EBON] = '#241a30';

/* ─────────────── liquids ─────────────── */
var LQ_WATER = 1, LQ_LAVA = 2, LMAX = 100;

/* ─────────────── rarity palette (Terraria) ─────────────── */
var RAR = { '-1': '#8a8a8a', 0: '#ffffff', 1: '#7c9cff', 2: '#8aff6a', 3: '#ffb45a', 4: '#ff7a7a', 5: '#ff7ad2', 6: '#c89aff', 7: '#a8ff30', 8: '#ffe030' };

/* ─────────────── items ───────────────
   kind: pick|axe|hammer|sword|bow|gun|magic|block|platform|mat|ore|bar|gem|coin
         ammo|potion|summon|armor|accessory|hook|tool
   common: n name, tip, rar rarity, max stack
   tools: pow (mine speed) ; weapons: dmg, use(frames), knock, mana(magic), ranged
   block: place tile ; armor: slot head/chest/legs, def, set ; accessory: eff{} */
var ITEMS = {
    // ── tools ──
    cpick:   { n: 'Copper Pickaxe', kind: 'pick', pow: 1.0, rar: 0, tip: 'The trusty starter. Swings forever.' },
    ipick:   { n: 'Iron Pickaxe', kind: 'pick', pow: 1.5, rar: 1, tip: 'Chews stone properly.' },
    spick:   { n: 'Silver Pickaxe', kind: 'pick', pow: 2.0, rar: 1, tip: 'Shiny AND practical.' },
    gpick:   { n: 'Gold Pickaxe', kind: 'pick', pow: 2.5, rar: 1, tip: 'Mining in style.' },
    dpick:   { n: 'Nightmare Pickaxe', kind: 'pick', pow: 3.4, rar: 2, tip: 'Mines hellstone. Bad dreams included.' },
    caxe:    { n: 'Copper Axe', kind: 'axe', pow: 1.4, rar: 0, tip: 'For trees. Works on zombies too.' },
    iaxe:    { n: 'Iron Axe', kind: 'axe', pow: 2.0, rar: 1, tip: 'Timber, efficiently.' },
    chammer: { n: 'Copper Hammer', kind: 'hammer', pow: 1.2, rar: 0, tip: 'Removes walls and platforms.' },
    // ── swords ──
    csword:  { n: 'Copper Shortsword', kind: 'sword', dmg: 8, use: 12, knock: 2, rar: 0, tip: 'Pointy end goes in the slime.' },
    isword:  { n: 'Iron Broadsword', kind: 'sword', dmg: 13, use: 20, knock: 4, rar: 1, tip: 'A proper arc. A proper sword.' },
    ssword:  { n: 'Silver Broadsword', kind: 'sword', dmg: 17, use: 20, knock: 5, rar: 1, tip: 'Werewolves not included.' },
    gsword:  { n: 'Gold Broadsword', kind: 'sword', dmg: 21, use: 19, knock: 5, rar: 1, tip: 'Heavy, soft, gorgeous.' },
    lsword:  { n: "Light's Bane", kind: 'sword', dmg: 26, use: 18, knock: 6, rar: 2, tip: 'Forged from the corruption itself.' },
    // ── ranged ──
    woodbow: { n: 'Wooden Bow', kind: 'bow', dmg: 6, use: 28, knock: 3, rar: 1, tip: 'Needs arrows. Aim with the cursor.' },
    ironbow: { n: 'Iron Bow', kind: 'bow', dmg: 9, use: 25, knock: 3, rar: 1, tip: 'A stiffer draw, a harder hit.' },
    // ── magic ──
    amstaff: { n: 'Amethyst Staff', kind: 'magic', dmg: 12, use: 22, mana: 5, knock: 3, rar: 1, tip: 'A gem bolt. Costs mana.' },
    dbstaff: { n: 'Diamond Staff', kind: 'magic', dmg: 19, use: 20, mana: 7, knock: 4, rar: 2, tip: 'The finest gem bolt of all.' },
    // ── ammo ──
    warrow:  { n: 'Wooden Arrow', kind: 'ammo', ammo: 'arrow', dmg: 5, max: 999, rar: 0, tip: 'Ammo for bows.' },
    farrow:  { n: 'Flaming Arrow', kind: 'ammo', ammo: 'arrow', dmg: 8, fire: 1, max: 999, rar: 1, tip: 'It lights torches. And enemies.' },
    // ── blocks ──
    dirt:    { n: 'Dirt Block', kind: 'block', place: T_DIRT, max: 999, rar: 0 },
    stone:   { n: 'Stone Block', kind: 'block', place: T_STONE, max: 999, rar: 0 },
    wood:    { n: 'Wood', kind: 'block', place: T_PLANK, max: 999, rar: 0 },
    sand:    { n: 'Sand Block', kind: 'block', place: T_SAND, max: 999, rar: 0 },
    snowb:   { n: 'Snow Block', kind: 'block', place: T_SNOW, max: 999, rar: 0 },
    stoneb:  { n: 'Stone Block', kind: 'block', place: T_STONE, max: 999, rar: 0 },
    ash:     { n: 'Ash Block', kind: 'block', place: T_ASH, max: 999, rar: 0 },
    glass:   { n: 'Glass', kind: 'block', place: T_ICE, max: 999, rar: 0, tip: 'Made from sand. Passes for ice here.' },
    platform:{ n: 'Wood Platform', kind: 'platform', place: T_PLATFORM, max: 999, rar: 0, tip: 'Stand on it, jump through it.' },
    torch:   { n: 'Torch', kind: 'block', place: T_TORCH, max: 999, rar: 0, tip: 'Providing light since 2011.' },
    woodwall:{ n: 'Wood Wall', kind: 'wall', place: WL_WOOD, max: 999, rar: 0, tip: 'Background wall. Blocks spawns, keeps a house a house.' },
    door:    { n: 'Wooden Door', kind: 'block', place: T_DOOR, max: 99, rar: 0, tip: 'A house needs one.' },
    // ── stations ──
    bench:   { n: 'Work Bench', kind: 'block', place: T_BENCH, max: 99, rar: 0, tip: 'Crafting station. Place it down.' },
    furnace: { n: 'Furnace', kind: 'block', place: T_FURNACE, max: 99, rar: 0, tip: 'Smelts ore into bars.' },
    anvil:   { n: 'Iron Anvil', kind: 'block', place: T_ANVIL, max: 99, rar: 1, tip: 'For real tools and real swords.' },
    table:   { n: 'Table', kind: 'block', place: T_TABLE, max: 99, rar: 0, tip: 'Furniture. A house wants one.' },
    chair:   { n: 'Chair', kind: 'block', place: T_CHAIR, max: 99, rar: 0, tip: 'Sittable, notionally.' },
    bottle:  { n: 'Placed Bottle', kind: 'block', place: T_BOTTLE, max: 99, rar: 0, tip: 'On a table, it becomes an alchemy station.' },
    hforge:  { n: 'Hellforge', kind: 'block', place: T_HELLFORGE, max: 99, rar: 1, tip: 'Smelts hellstone. Found in the underworld.' },
    // ── ores / bars / mats ──
    cop:  { n: 'Copper Ore', kind: 'ore', max: 999, rar: 0 }, iron: { n: 'Iron Ore', kind: 'ore', max: 999, rar: 0 },
    silv: { n: 'Silver Ore', kind: 'ore', max: 999, rar: 0 }, gold: { n: 'Gold Ore', kind: 'ore', max: 999, rar: 0 },
    demon:{ n: 'Demonite Ore', kind: 'ore', max: 999, rar: 1 }, meteor: { n: 'Meteorite Ore', kind: 'ore', max: 999, rar: 1 },
    hell: { n: 'Hellstone', kind: 'ore', max: 999, rar: 1, tip: 'It is warm. Very warm.' },
    cbar: { n: 'Copper Bar', kind: 'bar', max: 999, rar: 0 }, ibar: { n: 'Iron Bar', kind: 'bar', max: 999, rar: 0 },
    sbar: { n: 'Silver Bar', kind: 'bar', max: 999, rar: 0 }, gbar: { n: 'Gold Bar', kind: 'bar', max: 999, rar: 0 },
    dbar: { n: 'Demonite Bar', kind: 'bar', max: 999, rar: 1 }, mbar: { n: 'Meteorite Bar', kind: 'bar', max: 999, rar: 1 },
    hbar: { n: 'Hellstone Bar', kind: 'bar', max: 999, rar: 1 },
    gel:  { n: 'Gel', kind: 'mat', max: 999, rar: 0, tip: 'Flammable. Wobbly. Blue.' },
    lens: { n: 'Lens', kind: 'mat', max: 999, rar: 1, tip: 'It is looking at you.' },
    cobweb:{ n: 'Cobweb', kind: 'mat', max: 999, rar: 0, tip: 'Sticky. Spin it into silk.' },
    silk: { n: 'Silk', kind: 'mat', max: 999, rar: 0, tip: 'Spun from cobweb.' },
    manac:{ n: 'Mana Crystal', kind: 'manacrystal', max: 20, rar: 1, tip: 'Use it to permanently raise max mana by 20 (up to 200).' },
    star: { n: 'Fallen Star', kind: 'mat', max: 999, rar: 1, tip: 'Falls at night. Craftable into a mana crystal.' },
    shadow:{ n: 'Shadow Scale', kind: 'mat', max: 999, rar: 2, tip: 'Peeled from the Eater of Worlds.' },
    ldust:{ n: 'Lens Dust', kind: 'mat', max: 999, rar: 0 },
    ambar:{ n: 'Amethyst', kind: 'gem', max: 999, rar: 1 }, tobar: { n: 'Topaz', kind: 'gem', max: 999, rar: 1 },
    sabar:{ n: 'Sapphire', kind: 'gem', max: 999, rar: 1 }, embar: { n: 'Emerald', kind: 'gem', max: 999, rar: 1 },
    rubar:{ n: 'Ruby', kind: 'gem', max: 999, rar: 1 }, dibar: { n: 'Diamond', kind: 'gem', max: 999, rar: 1 },
    // ── potions ──
    lheal:  { n: 'Lesser Healing Potion', kind: 'potion', heal: 50, max: 30, rar: 1, tip: 'Restores 50 life.' },
    heal:   { n: 'Healing Potion', kind: 'potion', heal: 100, max: 30, rar: 1, tip: 'Restores 100 life.' },
    lmana:  { n: 'Lesser Mana Potion', kind: 'potion', mana: 50, max: 30, rar: 1, tip: 'Restores 50 mana.' },
    pion:   { n: 'Ironskin Potion', kind: 'potion', buff: 'iron', dur: 3600, max: 30, rar: 1, tip: '+8 defense for a while.' },
    pswift: { n: 'Swiftness Potion', kind: 'potion', buff: 'swift', dur: 3600, max: 30, rar: 1, tip: '+25% movement speed.' },
    pshine: { n: 'Shine Potion', kind: 'potion', buff: 'shine', dur: 6000, max: 30, rar: 1, tip: 'You emit light. Handy underground.' },
    // ── armor (def per piece; full set gives a small bonus, tracked at wear) ──
    whead: { n: 'Wood Helmet', kind: 'armor', slot: 'head', def: 1, set: 'wood', max: 1, rar: 0 },
    wchest:{ n: 'Wood Breastplate', kind: 'armor', slot: 'chest', def: 1, set: 'wood', max: 1, rar: 0 },
    wlegs: { n: 'Wood Greaves', kind: 'armor', slot: 'legs', def: 1, set: 'wood', max: 1, rar: 0 },
    chead: { n: 'Copper Helmet', kind: 'armor', slot: 'head', def: 2, set: 'copper', max: 1, rar: 1 },
    cchest:{ n: 'Copper Chainmail', kind: 'armor', slot: 'chest', def: 2, set: 'copper', max: 1, rar: 1 },
    clegs: { n: 'Copper Greaves', kind: 'armor', slot: 'legs', def: 1, set: 'copper', max: 1, rar: 1 },
    ihead: { n: 'Iron Helmet', kind: 'armor', slot: 'head', def: 3, set: 'iron', max: 1, rar: 1 },
    ichest:{ n: 'Iron Chainmail', kind: 'armor', slot: 'chest', def: 3, set: 'iron', max: 1, rar: 1 },
    ilegs: { n: 'Iron Greaves', kind: 'armor', slot: 'legs', def: 2, set: 'iron', max: 1, rar: 1 },
    shead: { n: 'Silver Helmet', kind: 'armor', slot: 'head', def: 3, set: 'silver', max: 1, rar: 1 },
    schest:{ n: 'Silver Chainmail', kind: 'armor', slot: 'chest', def: 4, set: 'silver', max: 1, rar: 1 },
    slegs: { n: 'Silver Greaves', kind: 'armor', slot: 'legs', def: 3, set: 'silver', max: 1, rar: 1 },
    ghead: { n: 'Gold Helmet', kind: 'armor', slot: 'head', def: 4, set: 'gold', max: 1, rar: 1 },
    gchest:{ n: 'Gold Chainmail', kind: 'armor', slot: 'chest', def: 5, set: 'gold', max: 1, rar: 1 },
    glegs: { n: 'Gold Greaves', kind: 'armor', slot: 'legs', def: 4, set: 'gold', max: 1, rar: 1 },
    // ── accessories ──
    hook:  { n: 'Grappling Hook', kind: 'accessory', eff: { hook: 1 }, max: 1, rar: 1, tip: 'Press the Grapple key to swing. Iconic.' },
    cloud: { n: 'Cloud in a Bottle', kind: 'accessory', eff: { djump: 1 }, max: 1, rar: 2, tip: 'Grants a double jump.' },
    boots: { n: 'Hermes Boots', kind: 'accessory', eff: { speed: 1 }, max: 1, rar: 2, tip: 'Run at a sprint.' },
    shoe:  { n: 'Lucky Horseshoe', kind: 'accessory', eff: { nofall: 1 }, max: 1, rar: 2, tip: 'Negates all fall damage.' },
    shackle:{ n: 'Shackle', kind: 'accessory', eff: { def: 1 }, max: 1, rar: 1, tip: '+1 defense. A zombie sometimes drops it.' },
    // ── boss summons / use ──
    suseye:  { n: 'Suspicious Looking Eye', kind: 'summon', boss: 'eye', max: 20, rar: 3, tip: 'Summons the Eye of Cthulhu. At night.' },
    slimec:  { n: 'Slime Crown', kind: 'summon', boss: 'king', max: 20, rar: 3, tip: 'Summons King Slime. Any time.' },
    wormfood:{ n: 'Worm Food', kind: 'summon', boss: 'eater', max: 20, rar: 3, tip: 'Summons the Eater of Worlds. In the corruption.' },
    // ── coin (never in inventory; drop-only) ──
    coin:  { n: 'Coins', kind: 'coin', max: 1 }
};
var ORE_ITEM = {}; ORE_ITEM[T_COPPER] = 'cop'; ORE_ITEM[T_IRON] = 'iron'; ORE_ITEM[T_SILVER] = 'silv';
ORE_ITEM[T_GOLD] = 'gold'; ORE_ITEM[T_DEMONITE] = 'demon'; ORE_ITEM[T_METEOR] = 'meteor'; ORE_ITEM[T_HELLSTONE] = 'hell';
var GEM_ITEM = {}; GEM_ITEM[T_AMETHYST] = 'ambar'; GEM_ITEM[T_TOPAZ] = 'tobar'; GEM_ITEM[T_SAPPHIRE] = 'sabar';
GEM_ITEM[T_EMERALD] = 'embar'; GEM_ITEM[T_RUBY] = 'rubar'; GEM_ITEM[T_DIAMOND] = 'dibar';
var TILE_ITEM = {}; TILE_ITEM[T_DIRT] = 'dirt'; TILE_ITEM[T_GRASS] = 'dirt'; TILE_ITEM[T_STONE] = 'stone';
TILE_ITEM[T_PLANK] = 'wood'; TILE_ITEM[T_SAND] = 'sand'; TILE_ITEM[T_SNOW] = 'snowb'; TILE_ITEM[T_ICE] = 'glass';
TILE_ITEM[T_MUD] = 'dirt'; TILE_ITEM[T_JGRASS] = 'dirt'; TILE_ITEM[T_CLAY] = 'stone'; TILE_ITEM[T_ASH] = 'ash';
TILE_ITEM[T_OBSIDIAN] = 'stone'; TILE_ITEM[T_CLOUD] = 'snowb'; TILE_ITEM[T_TORCH] = 'torch'; TILE_ITEM[T_BENCH] = 'bench';
TILE_ITEM[T_FURNACE] = 'furnace'; TILE_ITEM[T_ANVIL] = 'anvil'; TILE_ITEM[T_TABLE] = 'table'; TILE_ITEM[T_CHAIR] = 'chair';
TILE_ITEM[T_DOOR] = 'door'; TILE_ITEM[T_DOOROPEN] = 'door'; TILE_ITEM[T_PLATFORM] = 'platform'; TILE_ITEM[T_HELLFORGE] = 'hforge'; TILE_ITEM[T_BOTTLE] = 'bottle';
TILE_ITEM[T_SILT] = 'stone'; TILE_ITEM[T_EBON] = 'stone'; TILE_ITEM[T_CGRASS] = 'dirt';

/* ─────────────── recipes ───────────────
   [result, count, station(null/bench/furnace/anvil/table/bottle/hellforge), [[item,n],...]] */
var RECIPES = [
    ['wood', 5, null, [['dirt', 0]]],   // placeholder removed below; keep by-hand basics real:
    ['bench', 1, null, [['wood', 10]]],
    ['torch', 3, null, [['wood', 1], ['gel', 1]]],
    ['platform', 2, null, [['wood', 1]]],
    ['chair', 1, 'bench', [['wood', 4]]],
    ['table', 1, 'bench', [['wood', 8]]],
    ['door', 1, 'bench', [['wood', 6]]],
    ['woodwall', 4, 'bench', [['wood', 1]]],
    ['bottle', 1, 'bench', [['glass', 1]]],
    ['whead', 1, 'bench', [['wood', 20]]],
    ['wchest', 1, 'bench', [['wood', 30]]],
    ['wlegs', 1, 'bench', [['wood', 25]]],
    ['woodbow', 1, 'bench', [['wood', 10]]],
    ['warrow', 5, null, [['wood', 1], ['stone', 1]]],
    ['furnace', 1, 'bench', [['stone', 20], ['wood', 4], ['torch', 3]]],
    ['glass', 2, 'furnace', [['sand', 2]]],
    ['cbar', 1, 'furnace', [['cop', 3]]],
    ['ibar', 1, 'furnace', [['iron', 3]]],
    ['sbar', 1, 'furnace', [['silv', 4]]],
    ['gbar', 1, 'furnace', [['gold', 4]]],
    ['mbar', 1, 'furnace', [['meteor', 3]]],
    ['anvil', 1, 'bench', [['ibar', 5]]],
    ['chammer', 1, 'anvil', [['cbar', 8], ['wood', 3]]],
    ['ipick', 1, 'anvil', [['ibar', 12], ['wood', 4]]],
    ['spick', 1, 'anvil', [['sbar', 12], ['wood', 4]]],
    ['gpick', 1, 'anvil', [['gbar', 12], ['wood', 4]]],
    ['iaxe', 1, 'anvil', [['ibar', 9], ['wood', 3]]],
    ['isword', 1, 'anvil', [['ibar', 8]]],
    ['ssword', 1, 'anvil', [['sbar', 8]]],
    ['gsword', 1, 'anvil', [['gbar', 8]]],
    ['ironbow', 1, 'anvil', [['ibar', 8]]],
    ['chead', 1, 'anvil', [['cbar', 15]]],
    ['cchest', 1, 'anvil', [['cbar', 25]]],
    ['clegs', 1, 'anvil', [['cbar', 20]]],
    ['ihead', 1, 'anvil', [['ibar', 15]]],
    ['ichest', 1, 'anvil', [['ibar', 25]]],
    ['ilegs', 1, 'anvil', [['ibar', 20]]],
    ['shead', 1, 'anvil', [['sbar', 15]]],
    ['schest', 1, 'anvil', [['sbar', 25]]],
    ['slegs', 1, 'anvil', [['sbar', 20]]],
    ['ghead', 1, 'anvil', [['gbar', 15]]],
    ['gchest', 1, 'anvil', [['gbar', 25]]],
    ['glegs', 1, 'anvil', [['gbar', 20]]],
    ['amstaff', 1, 'anvil', [['ambar', 8], ['wood', 12]]],
    ['dbstaff', 1, 'anvil', [['dibar', 8], ['wood', 12]]],
    ['silk', 1, 'bench', [['cobweb', 7]]],
    ['manac', 1, null, [['star', 3]]],
    ['lheal', 1, 'bottle', [['gel', 2], ['lens', 1]]],
    ['lmana', 1, 'bottle', [['gel', 1], ['star', 1]]],
    ['pshine', 1, 'bottle', [['gel', 1], ['torch', 1]]],
    ['pion', 1, 'bottle', [['iron', 1], ['gel', 2]]],
    ['pswift', 1, 'bottle', [['gel', 3]]],
    ['farrow', 5, 'bottle', [['warrow', 5], ['torch', 1]]],
    ['dbar', 1, 'hellforge', [['demon', 4]]],
    ['hbar', 1, 'hellforge', [['hell', 3]]],
    ['dpick', 1, 'anvil', [['dbar', 12], ['shadow', 3]]],
    ['lsword', 1, 'anvil', [['dbar', 10], ['shadow', 5]]],
    ['suseye', 1, 'bench', [['lens', 6]]],
    ['slimec', 1, 'anvil', [['gel', 99]]],
    ['wormfood', 1, null, [['demon', 15], ['lens', 6]]]
];
// prune impossible/placeholder recipes (missing item ids, or the dummy first entry)
RECIPES = RECIPES.filter(function (r, i) {
    if (i === 0) return false;                                  // the placeholder 'wood from dirt'
    return r[3].every(function (g) { return ITEMS[g[0]]; });
});
var CRAFTMAT = {}; // item ids that can appear as ingredients, for the guide

/* ─────────────── achievements ─────────────── */
var ACH = [
    ['timber',  'Timber!!',            'Chop down your first tree.'],
    ['benched', 'Benched',             'Craft a work bench.'],
    ['shiny',   'Ooo! Shiny!',         'Mine your first nugget of ore.'],
    ['pot',     'Smashing, Poppet!',   'Smash a pot.'],
    ['night',   'You Can Do It!',      'Survive your first night.'],
    ['heart',   'Heart Breaker',       'Discover and smash a crystal heart underground.'],
    ['mana',    'Star Power',          'Craft a mana crystal from fallen stars.'],
    ['metal',   'Heavy Metal',         'Obtain an anvil.'],
    ['armed',   'Watch Your Step!',    'Wear a full set of armor.'],
    ['bottom',  'Rock Bottom',         'Reach the underworld.'],
    ['deep',    "Where's My Honey?",   'Reach the caverns.'],
    ['chest',   "Sticky Situation",    'Loot an underground chest.'],
    ['gem',     'Gemcutter',           'Extract a gem from stone.'],
    ['hooked',  'Hooked',              'Equip a grappling hook.'],
    ['float',   'The Cake Was a Lie',  'Reach a floating island.'],
    ['archer',  'Sharp',              'Fire an arrow from a bow.'],
    ['wizard',  'The Frequent Flyer',  'Cast a spell with a magic weapon.'],
    ['boss',    'Like a Boss',         'Obtain a boss-summoning item.'],
    ['eye',     'Eye on You',          'Defeat the Eye of Cthulhu.'],
    ['king',    'Gelatin World Tour',  'Defeat King Slime.'],
    ['eater',   'It Can Talk?!',       'Defeat the Eater of Worlds.'],
    ['pinky',   'Pretty in Pink',      'Slay Pinky, the rarest of slimes.'],
    ['dozer',   'Bulldozer',           'Destroy 2,500 tiles.'],
    ['walker',  'Marathon Medalist',   'Travel 26.2 miles on foot.'],
    ['loaded',  'Moneybags',           'Hold a gold coin’s worth of loot (10,000 copper).'],
    ['slayer',  'Still Hungry?',       'Slay 100 enemies.'],
    ['ore4',    'Full Set',            'Mine copper, iron, silver, and gold.'],
    ['builder', 'It’s Getting Hot',    'Build a valid house (walls, door, light).'],
    ['merchant','Completely Awesome',  'Have the Merchant move in.'],
    ['swim',    'Watery Depths',       'Go for a swim.']
];

/* ─────────────── keybinds (rebindable) ─────────────── */
var DEFBINDS = {
    left: 'a', right: 'd', up: 'w', down: 's', jump: ' ', inv: 'e', map: 'm', grapple: 'q',
    heal: 'h', mana: 'j', buff: 'b', autoselect: 'r', settings: 'p'
};
var BINDS = {};
(function () { for (var k in DEFBINDS) BINDS[k] = DEFBINDS[k]; })();   // seeded now: render() (called before init) reads BINDS
function loadBinds() {
    BINDS = {}; for (var k in DEFBINDS) BINDS[k] = DEFBINDS[k];
    try { var b = JSON.parse(localStorage.getItem('comp_terraria_keys') || 'null'); if (b) for (var kk in DEFBINDS) if (b[kk]) BINDS[kk] = b[kk]; } catch (e) {}
}
function saveBinds() { try { localStorage.setItem('comp_terraria_keys', JSON.stringify(BINDS)); } catch (e) {} }
function keyName(k) { return k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k.charAt(0).toUpperCase() + k.slice(1); }

/* ─────────────── state ─────────────── */
var S = null, RT = null;
function fresh() {
    return { v: 2, seed: (Math.random() * 1e9) | 0, tiles: null, walls: null, liq: null,
        time: DAY * 0.28, day: 1, px: 0, py: 0, spawnx: 0, spawny: 0,
        hp: 100, maxhp: 100, mana: 20, maxmana: 20,
        inv: null, arm: [null, null, null], acc: [null, null, null, null, null], ammo: [null, null, null, null], sel: 0,
        coins: 0, ach: {}, kills: 0, mined: 0, walked: 0, ores: {}, gemsFound: {},
        buffs: {}, explored: null, npcs: null, chests: null, merchantIn: false, nurseIn: false, guideIn: true,
        t: Date.now() };
}
function startInv() {
    var inv = []; for (var i = 0; i < 40; i++) inv.push(null);
    inv[0] = { id: 'cpick', c: 1 }; inv[1] = { id: 'caxe', c: 1 }; inv[2] = { id: 'csword', c: 1 };
    return inv;
}
function sLoad() {
    if (S) return S;
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem('comp_terraria') || 'null'); } catch (e) { raw = null; }
    if (raw && raw.v === 2) { S = raw; return S; }
    S = fresh();
    if (raw && raw.v === 1) {   // migrate v1: carry achievement/coin/stat progress forward, regen world
        if (raw.ach) S.ach = raw.ach;
        ['kills', 'mined', 'walked', 'coins', 'day'].forEach(function (k) { if (typeof raw[k] === 'number') S[k] = raw[k]; });
        if (raw.ores) S.ores = raw.ores;
    }
    return S;
}
function sSave() {
    if (!S) return;
    if (RT && RT.w) { S.tiles = packBytes(RT.w); S.walls = packBytes(RT.wall); S.liq = packLiq(RT.lq, RT.lk); if (RT.explored) S.explored = packBytes(RT.explored); }
    S.t = Date.now();
    try { localStorage.setItem('comp_terraria', JSON.stringify(S)); } catch (e) {}
}
/* RLE pack/unpack (id:run in base36) */
function packBytes(w) {
    var out = [], run = 1, cur = w[0];
    for (var i = 1; i < w.length; i++) { if (w[i] === cur) { run++; continue; } out.push(cur.toString(36) + ':' + run.toString(36)); cur = w[i]; run = 1; }
    out.push(cur.toString(36) + ':' + run.toString(36));
    return out.join(',');
}
function unpackBytes(s, n) {
    var w = new Uint8Array(n), i = 0, ok = true;
    s.split(',').forEach(function (tk) { var p = tk.split(':'), id = parseInt(p[0], 36), run = parseInt(p[1], 36); for (var k = 0; k < run && i < n; k++) w[i++] = id; });
    return i === n ? w : null;
}
function packLiq(lq, lk) {   // pack mass; kind folded into a parallel run only where mass>0 (kind rarely varies)
    return packBytes(lq) + '|' + packBytes(lk);
}
function unpackLiq(s) {
    var p = s.split('|'); if (p.length !== 2) return null;
    var lq = unpackBytes(p[0], W * H), lk = unpackBytes(p[1], W * H);
    return lq && lk ? { lq: lq, lk: lk } : null;
}

/* ─────────────── deterministic RNG ─────────────── */
function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/* ─────────────── world generation ─────────────── */
function genWorld(seed) {
    var R = rng(seed);
    var w = new Uint8Array(W * H), wall = new Uint8Array(W * H), lq = new Uint8Array(W * H), lk = new Uint8Array(W * H);
    var chests = [];
    function set(x, y, t) { if (x >= 0 && x < W && y >= 0 && y < H) w[y * W + x] = t; }
    function get(x, y) { return (x >= 0 && x < W && y >= 0 && y < H) ? w[y * W + x] : T_STONE; }
    function setWall(x, y, v) { if (x >= 0 && x < W && y >= 0 && y < H) wall[y * W + x] = v; }

    // biome bands across the surface: ocean | snow | forest | (spawn forest) | jungle | desert | corruption | ocean
    var oceanW = 22;
    function biomeAt(x) {
        if (x < oceanW || x > W - oceanW) return 'ocean';
        if (x < 78) return 'snow';
        if (x > W - 96 && x < W - 54) return 'desert';
        if (x > W - 150 && x <= W - 96) return 'jungle';
        if (x >= W - 54) return 'corrupt';
        return 'forest';
    }
    // 1. surface heightmap
    var surf = [], y = 46;
    for (var x = 0; x < W; x++) { y += (R() - 0.5) * 2.3; y = clamp(y, 34, 66); surf.push(y); }
    for (var sm = 0; sm < 4; sm++) for (x = 1; x < W - 1; x++) surf[x] = (surf[x - 1] + surf[x] + surf[x + 1]) / 3;
    // ocean bowls dip down
    for (x = 0; x < W; x++) { if (x < oceanW) surf[x] = lerp(surf[oceanW], 70, (oceanW - x) / oceanW); if (x > W - oceanW) surf[x] = lerp(surf[W - oceanW - 1], 70, (x - (W - oceanW)) / oceanW); }

    // 2. strata + surface tile per biome
    for (x = 0; x < W; x++) {
        var b = biomeAt(x), sy = Math.round(surf[x]), rocky = sy + 8 + Math.round(R() * 5);
        for (y = 0; y < H; y++) {
            var i = y * W + x;
            if (y < sy) { w[i] = T_AIR; continue; }
            if (y >= HELL) { w[i] = T_ASH; wall[i] = WL_ASH; continue; }
            var deep = y >= rocky;
            if (y === sy) {
                w[i] = b === 'snow' ? T_SNOW : b === 'desert' ? T_SAND : b === 'jungle' ? T_JGRASS : b === 'corrupt' ? T_CGRASS : b === 'ocean' ? T_SAND : T_GRASS;
            } else if (!deep) {
                w[i] = b === 'snow' ? T_SNOW : b === 'desert' ? T_SAND : b === 'jungle' ? T_MUD : b === 'ocean' ? T_SAND : b === 'corrupt' ? T_DIRT : T_DIRT;
                wall[i] = b === 'snow' ? WL_SNOW : b === 'desert' ? WL_SAND : b === 'jungle' ? WL_JUNGLE : WL_DIRT;
            } else {
                w[i] = b === 'jungle' ? (R() < 0.5 ? T_MUD : T_STONE) : b === 'snow' ? (R() < 0.4 ? T_ICE : T_STONE) : T_STONE;
                wall[i] = b === 'jungle' ? WL_JUNGLE : WL_STONE;
            }
            if (b === 'desert' && deep && R() < 0.06) w[i] = T_SAND;
            if (!deep && R() < 0.05 && b === 'forest') w[i] = T_CLAY;
            if (b === 'snow' && !deep && R() < 0.08) w[i] = T_ICE;
        }
    }

    // 3. caves (drunken worms) — carve tile + leave a wall behind
    for (var c = 0; c < 150; c++) {
        var cx = R() * W, cy = surf[Math.floor(clamp(cx, 0, W - 1))] + 7 + R() * (H - 24 - surf[Math.floor(clamp(cx, 0, W - 1))]);
        var steps = 45 + R() * 150, ang = R() * 6.28;
        for (var stp = 0; stp < steps; stp++) {
            ang += (R() - 0.5) * 1.1; cx += Math.cos(ang) * 1.7; cy += Math.sin(ang) * 1.2;
            if (cx < 3 || cx > W - 4 || cy < surf[Math.floor(clamp(cx, 0, W - 1))] + 3 || cy > H - 3) break;
            var rad = 1.2 + R() * 2.3;
            for (var oy = -rad; oy <= rad; oy++) for (var ox = -rad; ox <= rad; ox++)
                if (ox * ox + oy * oy <= rad * rad) {
                    var tx = Math.floor(cx + ox), ty = Math.floor(cy + oy);
                    if (tx > 1 && tx < W - 1 && ty > 1 && ty < H - 1) { var wv = wall[ty * W + tx]; set(tx, ty, T_AIR); if (!wv) wall[ty * W + tx] = ty >= HELL ? WL_ASH : ty > 96 ? WL_STONE : WL_DIRT; }
                }
        }
    }

    // 4. ores + gems — [tile, count, minY, maxY, size]
    [[T_COPPER, 90, 52, 120, 7], [T_IRON, 68, 66, 150, 6], [T_SILVER, 44, 92, 176, 6], [T_GOLD, 32, 112, HELL - 2, 5], [T_METEOR, 8, 60, 150, 5]]
        .forEach(function (o) {
            for (var bb = 0; bb < o[1]; bb++) {
                var bx = 4 + R() * (W - 8), by = o[2] + R() * (o[3] - o[2]);
                for (var g = 0; g < o[4] + R() * o[4]; g++) {
                    var gx = Math.floor(bx + (R() - 0.5) * 4), gy = Math.floor(by + (R() - 0.5) * 3);
                    if (get(gx, gy) === T_STONE) set(gx, gy, o[0]);
                }
            }
        });
    // gems: single sparkles, deeper = rarer top tiers. Counts are ATTEMPTS and only land on stone,
    // so they must be generous — the gem staves cost 8, and the old numbers left most worlds with
    // too few diamonds (often zero) to ever craft one.
    for (var gi = 0; gi < GEMS.length; gi++) {
        var cnt = [190, 170, 140, 120, 100, 90][gi];
        for (var gg = 0; gg < cnt; gg++) {
            var gx2 = 3 + Math.floor(R() * (W - 6)), gy2 = 76 + Math.floor(R() * (HELL - 80));
            if (get(gx2, gy2) === T_STONE) set(gx2, gy2, GEMS[gi]);
        }
    }

    // 5. corruption chasms (right band): ebonstone + vertical pits
    for (x = W - 52; x < W - oceanW; x++) for (y = Math.round(surf[x]); y < HELL; y++) {
        if (get(x, y) === T_STONE || get(x, y) === T_DIRT) { if (R() < 0.5) set(x, y, T_EBON); }
    }
    for (var ch = 0; ch < 3; ch++) {
        var chx = W - 48 + Math.floor(R() * 24), depth = Math.round(surf[chx]);
        for (y = depth; y < depth + 40 + R() * 30 && y < HELL; y++) { for (var pw = -2; pw <= 2; pw++) { set(chx + pw, y, T_AIR); wall[y * W + chx + pw] = WL_EBON; } }
    }

    // 6. underworld: hellstone veins, lava seas, obsidian shores
    for (c = 0; c < 90; c++) {
        var lx = Math.floor(R() * W), ly = HELL + 4 + Math.floor(R() * (H - HELL - 8)), lr = 2 + R() * 4;
        for (oy = -lr; oy <= lr; oy++) for (ox = -lr * 2; ox <= lr * 2; ox++) {
            tx = Math.floor(lx + ox); ty = Math.floor(ly + oy);
            if (tx > 1 && tx < W - 1 && ty > HELL && ty < H - 1 && (ox * ox / 3.6 + oy * oy) <= lr * lr) {
                if (oy > 0) { w[ty * W + tx] = T_AIR; lq[ty * W + tx] = LMAX; lk[ty * W + tx] = LQ_LAVA; }
                else set(tx, ty, T_AIR);
            }
        }
    }
    for (c = 0; c < 60; c++) { var hx = 2 + Math.floor(R() * (W - 4)), hy = HELL + 2 + Math.floor(R() * (H - HELL - 4)); if (get(hx, hy) === T_ASH) set(hx, hy, T_HELLSTONE); }
    // hellforges: the ONLY source of the 'hellforge' station, and demonite/hellstone bars (and so
    // the Nightmare Pickaxe and Light's Bane) are gated behind it — the underworld must supply them
    var forges = 0, fguard = 0;
    while (forges < 7 && fguard++ < 3000) {
        var fx = 6 + Math.floor(R() * (W - 12)), fy = HELL + 2 + Math.floor(R() * (H - HELL - 6));
        if (get(fx, fy) === T_AIR && SOLID[get(fx, fy + 1)] && lq[fy * W + fx] === 0) { set(fx, fy, T_HELLFORGE); forges++; }
    }

    // 7. ocean water on both shores
    [oceanW, W - oceanW].forEach(function (edgeX, side) {
        for (var xx = (side ? edgeX : 0); xx < (side ? W : edgeX); xx++) {
            var top = Math.round(surf[xx]);
            for (var yy = top; yy < 74; yy++) { if (get(xx, yy) === T_AIR) { lq[yy * W + xx] = LMAX; lk[yy * W + xx] = LQ_WATER; } }
        }
    });
    // scattered underground water pools
    for (c = 0; c < 40; c++) {
        var wx = 30 + Math.floor(R() * (W - 60)), wy = 74 + Math.floor(R() * 90), wr = 2 + R() * 3;
        for (oy = 0; oy <= wr; oy++) for (ox = -wr * 2; ox <= wr * 2; ox++) {
            tx = Math.floor(wx + ox); ty = Math.floor(wy + oy);
            if (tx > 1 && tx < W - 1 && ty < HELL && get(tx, ty) === T_AIR && (ox * ox / 3.6 + oy * oy) <= wr * wr) { lq[ty * W + tx] = LMAX; lk[ty * W + tx] = LQ_WATER; }
        }
    }

    // 8. trees (surface grass/jungle/snow) + saplings
    for (x = 4; x < W - 4; x += 4 + Math.floor(R() * 8)) {
        var g2 = Math.round(surf[x]), st = get(x, g2), bio = biomeAt(x);
        if (st !== T_GRASS && st !== T_JGRASS && st !== T_SNOW) continue;
        var th = 5 + Math.floor(R() * 6);
        for (var t2 = 1; t2 <= th; t2++) if (g2 - t2 > 1) set(x, g2 - t2, T_TRUNK);
        var leafC = bio === 'jungle' ? T_JGRASS : bio === 'snow' ? T_LEAF : T_LEAF;
        for (oy = -3; oy <= 1; oy++) for (ox = -2; ox <= 2; ox++) {
            ty = g2 - th + oy; tx = x + ox;
            if (tx > 0 && tx < W && ty > 0 && Math.abs(ox) + Math.abs(oy) < 4 && get(tx, ty) === T_AIR) set(tx, ty, T_LEAF);
        }
    }

    // 9. floating sky islands (2-3), cloud platform + house + chest
    var nIslands = 2 + Math.floor(R() * 2);
    for (var isl = 0; isl < nIslands; isl++) {
        var ix = 60 + Math.floor(R() * (W - 120)), iy = SKY + 6 + Math.floor(R() * 10), iw = 10 + Math.floor(R() * 8);
        for (ox = -iw; ox <= iw; ox++) {
            var col = Math.round(Math.sqrt(Math.max(0, iw * iw - ox * ox)) * 0.5);
            for (oy = 0; oy <= col + 1; oy++) { set(ix + ox, iy + oy, oy === 0 ? T_GRASS : T_DIRT); wall[(iy + oy) * W + ix + ox] = WL_DIRT; }
            set(ix + ox, iy - 1, T_AIR);
        }
        // little house + chest with a sky treasure
        for (ox = -3; ox <= 3; ox++) { setWall(ix + ox, iy - 4, WL_WOOD); setWall(ix + ox, iy - 3, WL_WOOD); setWall(ix + ox, iy - 2, WL_WOOD); }
        chests.push({ x: ix, y: iy - 2, biome: 'sky', loot: null });
        set(ix, iy - 2, T_CHEST);
        set(ix - 4, iy - 1, T_TORCH); set(ix + 4, iy - 1, T_TORCH);
    }

    // 10. pots, life crystals, cobweb clusters, underground cabins with chests
    var placed = 0, guard = 0;
    while (placed < 70 && guard++ < 8000) {
        x = 2 + Math.floor(R() * (W - 4)); y = 52 + Math.floor(R() * (HELL - 54));
        if (get(x, y) === T_AIR && SOLID[get(x, y + 1)]) { set(x, y, T_POT); placed++; }
    }
    placed = 0; guard = 0;
    while (placed < 18 && guard++ < 8000) {
        x = 2 + Math.floor(R() * (W - 4)); y = 96 + Math.floor(R() * (HELL - 100));
        if (get(x, y) === T_AIR && SOLID[get(x, y + 1)]) { set(x, y, T_HEARTC); placed++; }
    }
    // cobweb pockets deep
    for (c = 0; c < 30; c++) {
        var wbx = 4 + Math.floor(R() * (W - 8)), wby = 110 + Math.floor(R() * (HELL - 114));
        for (oy = 0; oy < 4; oy++) for (ox = 0; ox < 4; ox++) if (get(wbx + ox, wby + oy) === T_AIR && R() < 0.6) set(wbx + ox, wby + oy, T_COBWEB);
    }
    // underground cabins: small walled rooms with a chest
    placed = 0; guard = 0;
    while (placed < 8 && guard++ < 4000) {
        x = 10 + Math.floor(R() * (W - 20)); y = 84 + Math.floor(R() * (HELL - 92));
        var floor = get(x, y + 3);
        if (!SOLID[floor]) continue;
        // never carve over an existing chest — hollowing a cabin on top of one used to delete the
        // tile while its record survived, silently costing the world a promised treasure
        var overlaps = false;
        for (oy = -1; oy <= 3 && !overlaps; oy++) for (ox = -1; ox <= 6; ox++) if (get(x + ox, y + oy) === T_CHEST) { overlaps = true; break; }
        if (overlaps) continue;
        // hollow a room
        for (oy = -1; oy <= 3; oy++) for (ox = -1; ox <= 6; ox++) { if (oy === 3 || oy === -1 || ox === -1 || ox === 6) { if (get(x + ox, y + oy) === T_AIR) set(x + ox, y + oy, T_PLANK); } else set(x + ox, y + oy, T_AIR); wall[(y + oy) * W + x + ox] = WL_WOOD; }
        set(x, y + 2, T_CHEST); chests.push({ x: x, y: y + 2, biome: 'cabin', loot: null });
        set(x + 5, y + 1, T_TORCH); placed++;
    }

    // safety net: a chest record must always name a real chest tile (sky-island and cabin
    // placement both write into shared terrain, so never trust that blindly)
    chests = chests.filter(function (c) { return w[c.y * W + c.x] === T_CHEST; });

    return { w: w, wall: wall, lq: lq, lk: lk, surf: surf, chests: chests };
}

/* a spawn you can actually stand in: solid footing with a clear body-height column above it, dry
   and tree-free. Sky islands and trees generate over the world centre, so the naive
   "3 tiles above surf[middle]" could bury the player in dirt — and respawn returns there forever. */
function findSpawn(w, lq, surf, originX) {
    var mid = (originX == null) ? Math.floor(W / 2) : clamp(originX, 6, W - 7);
    for (var d = 0; d < 90; d++) {
        for (var s = 0; s < 2; s++) {
            var x = mid + (s ? -d : d);
            if (x < 6 || x > W - 7) continue;
            var from = Math.max(3, Math.round(surf && surf[x] != null ? surf[x] : 3) - 10);
            for (var y = from; y < HELL - 2; y++) {
                if (!SOLID[w[y * W + x]]) continue;                      // find the first floor
                var head = y - 3, clear = true;
                for (var k = 1; k <= 3; k++) {
                    var t = w[(y - k) * W + x];
                    if (SOLID[t] || t === T_TRUNK || t === T_LEAF || t === T_CHEST) clear = false;
                    if (lq[(y - k) * W + x] > 20) clear = false;          // don't spawn in water
                }
                if (clear && head > 2) return { x: x, y: head };
                break;                                                    // this column is taken; try the next
            }
        }
    }
    return { x: mid, y: Math.max(3, Math.round(surf && surf[mid] != null ? surf[mid] : 40) - 3) };
}

/* chest loot tables, rolled lazily on first open (so a fresh look is deterministic per chest index) */
function rollChestLoot(chest, idx) {
    var R = rng((S.seed ^ (idx * 2654435761)) >>> 0);
    var loot = [];
    function add(id, c) { if (ITEMS[id]) loot.push({ id: id, c: c }); }
    if (chest.biome === 'sky') {
        var sky = [['cloud', 1], ['boots', 1], ['shoe', 1], ['star', 3 + (R() * 4 | 0)]][Math.floor(R() * 4)];
        add(sky[0], sky[1]); add('gbar', 2 + (R() * 3 | 0)); add('lheal', 3);
    } else {
        var acc = [['hook', 1], ['boots', 1], ['cloud', 1], ['shoe', 1]][Math.floor(R() * 4)];
        if (R() < 0.6) add(acc[0], acc[1]);
        add('torch', 8 + (R() * 12 | 0)); add('lheal', 2 + (R() * 3 | 0));
        if (R() < 0.5) add('ibar', 3 + (R() * 4 | 0));
        if (R() < 0.4) add(['spick', 'isword', 'ironbow'][Math.floor(R() * 3)], 1);
    }
    add('coin', 200 + (R() * 800 | 0));
    return loot;
}

/* ─────────────── inventory helpers ─────────────── */
function invCount(id) { var n = 0; S.inv.forEach(function (s) { if (s && s.id === id) n += s.c; }); return n; }
function invTake(id, n) {
    for (var i = 0; i < S.inv.length && n > 0; i++) { var s = S.inv[i]; if (s && s.id === id) { var take = Math.min(s.c, n); s.c -= take; n -= take; if (!s.c) S.inv[i] = null; } }
}
function invGive(id, n) {
    var max = ITEMS[id] ? (ITEMS[id].max || 1) : 1, i;
    for (i = 0; i < S.inv.length && n > 0; i++) { var s = S.inv[i]; if (s && s.id === id && s.c < max) { var add = Math.min(max - s.c, n); s.c += add; n -= add; } }
    for (i = 0; i < S.inv.length && n > 0; i++) { if (!S.inv[i]) { var put = Math.min(max, n); S.inv[i] = { id: id, c: put }; n -= put; } }
    return n;
}
function firstFree() { for (var i = 0; i < S.inv.length; i++) if (!S.inv[i]) return i; return -1; }
function accHas(eff) { return S.acc.some(function (a) { return a && ITEMS[a.id].eff && ITEMS[a.id].eff[eff]; }); }
function armorDef() {
    var d = 0, sets = {};
    S.arm.forEach(function (a) { if (a) { d += ITEMS[a.id].def || 0; var st = ITEMS[a.id].set; sets[st] = (sets[st] || 0) + 1; } });
    S.acc.forEach(function (a) { if (a && ITEMS[a.id].eff && ITEMS[a.id].eff.def) d += ITEMS[a.id].eff.def; });
    for (var k in sets) if (sets[k] === 3) d += 2;   // full-set bonus
    if (S.buffs.iron) d += 8;
    return d;
}
function fullArmor() { return S.arm[0] && S.arm[1] && S.arm[2]; }
function nearStation(place) {
    var pxt = Math.floor((S.px + 5) / TS), pyt = Math.floor((S.py + 10) / TS);
    for (var y = pyt - 5; y <= pyt + 5; y++) for (var x = pxt - 6; x <= pxt + 6; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        var t = RT.w[y * W + x];
        if (STATION[t] === place) return true;
        if (place === 'bottle' && t === T_BOTTLE && RT.w[(y + 1) * W + x] === T_TABLE) return true;
    }
    return false;
}
function stationsNear() {
    var set = { null: true }, pxt = Math.floor((S.px + 5) / TS), pyt = Math.floor((S.py + 10) / TS);
    for (var y = pyt - 5; y <= pyt + 5; y++) for (var x = pxt - 6; x <= pxt + 6; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        var t = RT.w[y * W + x];
        if (STATION[t]) set[STATION[t]] = true;
        if (t === T_BOTTLE && RT.w[(y + 1) * W + x] === T_TABLE) set.bottle = true;
    }
    return set;
}
function canCraft(r) {
    if (r[2] && !nearStation(r[2])) return false;
    return r[3].every(function (ing) { return invCount(ing[0]) >= ing[1]; });
}

/* ─────────────── render() — the window shell ─────────────── */
function render() {
    return '<div class="tr" tabindex="0">' +
        '<canvas class="tr-cv"></canvas>' +
        '<div class="tr-hud">' +
          '<div class="tr-topleft">' +
            '<div class="tr-hotbar"></div>' +
            '<div class="tr-vitals"><div class="tr-hearts"></div><div class="tr-stars"></div></div>' +
          '</div>' +
          '<div class="tr-topright">' +
            '<div class="tr-coins"></div>' +
            '<div class="tr-buffs"></div>' +
            '<canvas class="tr-mini" width="132" height="132"></canvas>' +
          '</div>' +
          '<div class="tr-depth"></div>' +
          '<div class="tr-breath" hidden></div>' +
        '</div>' +
        '<div class="tr-panel" hidden></div>' +
        '<div class="tr-map" hidden><canvas class="tr-mapcv"></canvas><div class="tr-maphint">Fullscreen map — ' + keyName(BINDS.map) + ' or Esc to close · scroll to zoom</div></div>' +
        '<div class="tr-shop" hidden></div>' +
        '<div class="tr-settings" hidden></div>' +
        '<div class="tr-bosshp" hidden><b></b><div class="tr-bossbar"><i></i></div></div>' +
        '<div class="tr-toast" hidden></div>' +
        '<div class="tr-death" hidden><b>You were slain…</b><span></span><em>Respawning…</em></div>' +
        '<div class="tr-hint"></div>' +
        '<div class="tr-tip" hidden></div>' +
        '<div class="tr-cursor" hidden></div>' +
        '</div>';
}

/* ─────────────── init ─────────────── */
function init(el) {
    loadBinds();
    sLoad();
    var root = el.querySelector('.tr');
    RT = { el: el, root: root, cv: root.querySelector('.tr-cv'), x: null,
        w: null, wall: null, lq: null, lk: null, surf: null, chests: null,
        keys: {}, mouse: { x: 0, y: 0, l: false, r: false, lEdge: false, rEdge: false },
        cam: { x: 0, y: 0 }, camS: { x: 0, y: 0 }, vx: 0, vy: 0, ground: false, face: 1,
        swing: 0, useT: 0, mineT: { x: -1, y: -1, p: 0 }, iframe: 0, regenT: 0, manaT: 0,
        djumpOK: false, runT: 0, fallY: null, breath: 200, grapple: null,
        foes: [], drops: [], dmgs: [], shots: [], parts: [], npcs: [], boss: null,
        panel: false, mapOpen: false, shopOpen: null, setOpen: false, cursor: null, rebinding: null,
        raf: 0, timers: [], acc: 0, last: 0, started: Date.now(), light: null, litecol: null, dead: 0,
        starT: 0, guideTip: 0, invTab: 'craft' };

    var w = S.tiles ? unpackBytes(S.tiles, W * H) : null;
    var wa = S.walls ? unpackBytes(S.walls, W * H) : null;
    var lqp = S.liq ? unpackLiq(S.liq) : null;
    if (!w) {
        var gen = genWorld(S.seed);
        w = gen.w; wa = gen.wall; lqp = { lq: gen.lq, lk: gen.lk }; RT.surf = gen.surf; RT.chests = gen.chests;
        S.chests = gen.chests.map(function (c) { return { x: c.x, y: c.y, biome: c.biome, loot: null }; });
        var sp = findSpawn(w, gen.lq, gen.surf);
        S.px = sp.x * TS; S.py = sp.y * TS;
        S.spawnx = S.px; S.spawny = S.py;
        S.inv = startInv();
    }
    RT.w = w; RT.wall = wa || new Uint8Array(W * H);
    RT.lq = lqp ? lqp.lq : new Uint8Array(W * H); RT.lk = lqp ? lqp.lk : new Uint8Array(W * H);
    RT.chests = S.chests || [];
    if (!S.inv) S.inv = startInv();
    if (!S.arm) S.arm = [null, null, null];
    if (!S.acc) S.acc = [null, null, null, null, null];
    if (!S.ammo) S.ammo = [null, null, null, null];
    if (!S.buffs) S.buffs = {};
    if (!S.explored) S.explored = '';
    RT.explored = S.explored ? unpackBytes(S.explored, W * H) : new Uint8Array(W * H);
    if (!S.maxmana) { S.maxmana = 20; S.mana = 20; }
    if (S.hp <= 0) { S.hp = S.maxhp; if (S.spawnx != null) { S.px = S.spawnx; S.py = S.spawny; } }

    // NPCs (guide always around; merchant/nurse if moved in previously)
    RT.npcs = [];
    spawnNPC('guide');
    if (S.merchantIn) spawnNPC('merchant');
    if (S.nurseIn) spawnNPC('nurse');

    // dev hooks
    var tdev = (location.search.match(/[?&]tdev=([a-z]+)/) || [])[1];
    if (tdev === 'night') S.time = DAY + 30;
    if (tdev === 'kit') {
        ['ibar', 'sbar', 'gbar', 'wood', 'stone', 'torch', 'gel', 'lens', 'star', 'warrow'].forEach(function (id) { invGive(id, 60); });
        ['bench', 'furnace', 'anvil', 'table', 'bottle', 'woodbow', 'amstaff', 'lheal', 'lmana', 'hook', 'cloud', 'boots'].forEach(function (id) { invGive(id, id === 'lheal' || id === 'lmana' ? 20 : 1); });
        RT.openPanel = true;
    }
    if (tdev === 'cave') {
        var cx = Math.floor(W / 2), cy = 110;
        for (var oy = -3; oy <= 2; oy++) for (var ox = -6; ox <= 6; ox++) { RT.w[(cy + oy) * W + cx + ox] = oy >= 2 ? T_STONE : T_AIR; RT.wall[(cy + oy) * W + cx + ox] = WL_STONE; }
        RT.w[(cy + 1) * W + cx - 4] = T_TORCH; RT.w[(cy + 1) * W + cx + 4] = T_TORCH; RT.w[(cy) * W + cx + 5] = T_CHEST;
        S.px = cx * TS; S.py = cy * TS; invGive('torch', 30);
    }
    if (tdev === 'boss') { S.time = DAY + 30; spawnBoss('eye'); }
    if (tdev === 'king') spawnBoss('king');
    if (tdev === 'map') RT.openMap = true;

    wireInput(root);
    paintAll();
    if (RT.openPanel) togglePanel(true);
    RT.last = performance.now();
    RT.raf = requestAnimationFrame(loop);
    RT.timers.push(setInterval(sSave, 30000));
    toast(S.day > 1 || S.tiles ? 'Welcome back to ' + worldName() + '.' : 'Welcome to ' + worldName() + '! The Guide is here to help.');
    if (RT.openMap) toggleMap(true);
}
function worldName() { return 'World of Ure (' + (S.seed % 10000) + ')'; }

/* ─────────────── input ─────────────── */
function actionFor(key) { for (var a in BINDS) if (BINDS[a] === key) return a; return null; }
function wireInput(root) {
    root.addEventListener('keydown', function (e) {
        if (!RT) return;
        var key = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
        if (RT.rebinding) { finishRebind(key === 'escape' ? null : e.key === ' ' ? ' ' : key); e.preventDefault(); e.stopPropagation(); return; }
        // Escape closes overlays; only a fully-unconsumed Escape reaches the desktop
        if (e.key === 'Escape') {
            if (RT.shopOpen) { closeShop(); e.stopPropagation(); return; }
            if (RT.setOpen) { toggleSettings(false); e.stopPropagation(); return; }
            if (RT.mapOpen) { toggleMap(false); e.stopPropagation(); return; }
            if (RT.panel) { togglePanel(false); e.stopPropagation(); return; }
            return;   // desktop may have it
        }
        RT.keys[key] = true;
        var act = actionFor(key);
        if (act === 'jump' || key === ' ') e.preventDefault();
        if (act === 'inv') { togglePanel(!RT.panel); }
        else if (act === 'map') { toggleMap(!RT.mapOpen); }
        else if (act === 'settings') { toggleSettings(!RT.setOpen); }
        else if (act === 'heal') quickPotion('heal');
        else if (act === 'mana') quickPotion('mana');
        else if (act === 'buff') quickPotion('buff');
        else if (act === 'autoselect') autoSelect();
        else if (act === 'grapple') fireGrapple();
        var n = parseInt(e.key, 10);
        if (!isNaN(n) && e.key.length === 1) { S.sel = (n + 9) % 10; paintHotbar(); }
        e.stopPropagation();
    });
    root.addEventListener('keyup', function (e) { if (!RT) return; RT.keys[(e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase())] = false; if (actionFor(e.key.toLowerCase()) === 'grapple') releaseGrapple(); e.stopPropagation(); });
    root.addEventListener('blur', function () { RT.keys = {}; RT.mouse.l = RT.mouse.r = false; });
    RT.cv.addEventListener('pointermove', function (e) {
        if (!RT) return;
        var r = RT.cv.getBoundingClientRect();
        RT.mouse.x = (e.clientX - r.left) / (r.width / RT.cv.width);
        RT.mouse.y = (e.clientY - r.top) / (r.height / RT.cv.height);
    });
    RT.cv.addEventListener('pointerdown', function (e) {
        if (!RT) return;
        root.focus();
        if (e.button === 0) { RT.mouse.l = true; RT.mouse.lEdge = true; }
        if (e.button === 2) { RT.mouse.r = true; RT.mouse.rEdge = true; }
    });
    window.addEventListener('pointerup', RT.mup = function (e) { if (e.button === 0) RT.mouse.l = false; if (e.button === 2) RT.mouse.r = false; });
    RT.cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    RT.cv.addEventListener('wheel', function (e) { e.preventDefault(); S.sel = (S.sel + (e.deltaY > 0 ? 1 : 9)) % 10; paintHotbar(); }, { passive: false });
    root.addEventListener('click', function (e) { if (RT) onPanelClick(e); });
    root.addEventListener('contextmenu', function (e) { var slot = e.target.closest('.tr-slot[data-slot]'); if (slot) { e.preventDefault(); onSlotRight(slot.getAttribute('data-slot')); } });
    root.querySelector('.tr-map').addEventListener('wheel', function (e) { e.preventDefault(); RT.mapZoom = clamp((RT.mapZoom || 2) + (e.deltaY < 0 ? 0.5 : -0.5), 1, 6); paintMap(); }, { passive: false });
    root.querySelector('.tr-mini').addEventListener('click', function () { toggleMap(true); });
    wireTip(root);
    setTimeout(function () { root.focus(); }, 40);
}
function togglePanel(on) {
    if (RT.dead && on) return;   // can't OPEN while dead, but death must be able to force-close (see die())
    RT.panel = on;
    if (!on && RT.cursor) { var f = firstFree(); if (f >= 0) S.inv[f] = RT.cursor; else drop(Math.floor((S.px + 5) / TS), Math.floor((S.py + 10) / TS), RT.cursor.id, RT.cursor.c); RT.cursor = null; paintCursor(); }
    if (on) { RT.mapOpen = false; RT.root.querySelector('.tr-map').hidden = true; }
    RT.root.querySelector('.tr-panel').hidden = !on;
    if (on) paintPanel();
    paintHint();
}
function toggleMap(on) {
    RT.mapOpen = on;
    if (on) { RT.panel = false; RT.root.querySelector('.tr-panel').hidden = true; RT.mapZoom = RT.mapZoom || 2.5; }
    RT.root.querySelector('.tr-map').hidden = !on;
    if (on) paintMap();
    paintHint();
}
function toggleSettings(on) {
    RT.setOpen = on;
    RT.root.querySelector('.tr-settings').hidden = !on;
    if (on) paintSettings(); else if (RT.rebinding) RT.rebinding = null;
    paintHint();
}

/* ─────────────── main loop ─────────────── */
function loop(now) {
    if (!RT) return;
    RT.raf = requestAnimationFrame(loop);
    if (!RT.el.offsetParent) { RT.last = now; return; }   // minimized: hold breath
    var dt = Math.min(100, now - RT.last); RT.last = now;
    RT.acc += dt;
    var steps = 0;
    while (RT.acc >= 16.66 && steps < 4) { step(); RT.acc -= 16.66; steps++; }
    if (steps === 4) RT.acc = 0;
    draw();
}

/* ─────────────── simulation step (60 Hz) ─────────────── */
function step() {
    S.time += 1 / 60;
    if (S.time >= CYCLE) { S.time -= CYCLE; S.day++; unlock('night'); }
    tickBuffs();
    tickLiquids();
    if (RT.dead > 0) { RT.dead--; stepParticles(); if (!RT.dead) respawn(); return; }
    if (RT.panel || RT.mapOpen || RT.shopOpen || RT.setOpen) { RT.mouse.lEdge = RT.mouse.rEdge = false; }   // UI open: world input paused

    playerPhysics();

    // environment: lava, breath, fall handled in physics
    if (RT.iframe > 0) RT.iframe--;
    if (++RT.regenT > (S.buffs.iron ? 60 : 80) && S.hp < S.maxhp && !inLava()) { S.hp = Math.min(S.maxhp, S.hp + 1); RT.regenT = 0; paintHearts(); }
    if (++RT.manaT > 40 && S.mana < S.maxmana) { S.mana = Math.min(S.maxmana, S.mana + 1); RT.manaT = 0; paintStars(); }

    // using held item
    if (RT.useT > 0) RT.useT--;
    if (RT.mouse.l && !uiOpen()) useHeld(false);
    else RT.mineT.p = Math.max(0, RT.mineT.p - 0.08);
    if (RT.mouse.r && !uiOpen() && RT.mouse.rEdge) { RT.mouse.rEdge = false; rightUse(); }
    if (RT.swing > 0) RT.swing--;

    stepDrops();
    stepShots();
    spawnTick();
    for (var i = RT.foes.length - 1; i >= 0; i--) if (foeStep(RT.foes[i])) RT.foes.splice(i, 1);
    if (RT.boss) bossStep();
    stepNPCs();
    stepStars();
    stepParticles();
    for (i = RT.dmgs.length - 1; i >= 0; i--) { var g = RT.dmgs[i]; g.y -= 0.5; g.t--; if (g.t <= 0) RT.dmgs.splice(i, 1); }
    markExplored();
    RT.mouse.lEdge = false; RT.mouse.rEdge = false;   // edges live for exactly one step
    RT.anim = (RT.anim || 0) + 1;
}
function uiOpen() { return RT.panel || RT.mapOpen || RT.shopOpen || RT.setOpen; }
function tileAt(px, py) { var x = Math.floor(px / TS), y = Math.floor(py / TS); if (x < 0 || x >= W || y < 0 || y >= H) return T_STONE; return RT.w[y * W + x]; }
function liqAt(px, py) { var x = Math.floor(px / TS), y = Math.floor(py / TS); if (x < 0 || x >= W || y < 0 || y >= H) return 0; return RT.lq[y * W + x]; }
function liqKindAt(px, py) { var x = Math.floor(px / TS), y = Math.floor(py / TS); if (x < 0 || x >= W || y < 0 || y >= H) return 0; return RT.lk[y * W + x]; }
function inWater() { return liqAt(S.px + 5, S.py + 12) > 30 && liqKindAt(S.px + 5, S.py + 12) === LQ_WATER; }
// lava burns on CONTACT — sample the feet as well as the torso, or wading through a shallow
// pool (the common case: lava spreads thin) would be completely harmless
function inLava() {
    return (liqAt(S.px + 5, S.py + 12) > 20 && liqKindAt(S.px + 5, S.py + 12) === LQ_LAVA) ||
           (liqAt(S.px + 5, S.py + 19) > 10 && liqKindAt(S.px + 5, S.py + 19) === LQ_LAVA);
}
function headUnderWater() { return liqAt(S.px + 5, S.py + 2) > 40 && liqKindAt(S.px + 5, S.py + 2) === LQ_WATER; }

/* ─────────────── player physics ─────────────── */
function playerPhysics() {
    var k = RT.keys, water = inWater();
    var speedBoost = (accHas('speed') && RT.runT > 40 ? 1 : 0) + (S.buffs.swift ? 0.25 : 0);
    var maxvx = (2.0 + speedBoost * 1.4) * (water ? 0.6 : 1);
    var acc = RT.ground ? 0.16 : 0.08;
    var moving = false;
    if (k[BINDS.left] || k.arrowleft) { RT.vx -= acc; RT.face = -1; moving = true; }
    if (k[BINDS.right] || k.arrowright) { RT.vx += acc; RT.face = 1; moving = true; }
    RT.runT = (moving && RT.ground) ? RT.runT + 1 : 0;

    var jumpKey = k[BINDS.jump] || k[BINDS.up] || k.arrowup;
    if (jumpKey && !RT.grapple) {
        if (RT.ground) { RT.vy = -3.9; RT.ground = false; RT.jumpHeld = true; }
        else if (water) { RT.vy = Math.max(RT.vy - 0.4, -2.4); }
        else if (!RT.jumpHeld && RT.djumpOK && accHas('djump')) { RT.vy = -3.7; RT.djumpOK = false; puff(S.px + 5, S.py + 18); RT.jumpHeld = true; }
    } else RT.jumpHeld = false;

    RT.vx = clamp(RT.vx, -maxvx, maxvx);
    RT.vx *= RT.ground ? 0.80 : 0.94;
    var g = water ? 0.06 : GRAV;
    RT.vy = Math.min(RT.vy + g, water ? 2.2 : TERMV);
    if (water && !jumpKey && RT.vy < 0) RT.vy *= 0.9;

    // grapple pull
    if (RT.grapple && RT.grapple.latched) {
        var gx = RT.grapple.tx * TS + 4 - (S.px + 5), gy = RT.grapple.ty * TS + 4 - (S.py + 10);
        var gd = Math.max(1, Math.sqrt(gx * gx + gy * gy));
        if (gd > 12) { RT.vx += gx / gd * 0.5; RT.vy += gy / gd * 0.5; RT.vx = clamp(RT.vx, -4, 4); RT.vy = clamp(RT.vy, -4, 4); }
        else { RT.vx *= 0.8; RT.vy *= 0.8; }
    } else if (RT.grapple && !RT.grapple.latched) {
        RT.grapple.x += RT.grapple.vx; RT.grapple.y += RT.grapple.vy; RT.grapple.len += 6;
        if (SOLID[tileAt(RT.grapple.x, RT.grapple.y)]) { RT.grapple.latched = true; RT.grapple.tx = Math.floor(RT.grapple.x / TS); RT.grapple.ty = Math.floor(RT.grapple.y / TS); RT.djumpOK = true; }
        else if (RT.grapple.len > 200) RT.grapple = null;
    }

    var prevY = S.py;
    moveBody();
    var landedVy = RT.landedVy || 0;
    // step counter for the walker achievement
    S.walked += Math.abs(RT.vx) / TS;
    if (S.walked * 0.000621 * 2 >= 26.2) unlock('walker');
    if (RT.ground) RT.djumpOK = true;

    // fall damage
    if (RT.ground && RT.fallY != null) {
        var fell = (S.py - RT.fallY) / TS;
        if (fell > 25 && !accHas('nofall') && !water) { hurt(Math.floor((fell - 25) * 5), 0, true); }   // iframes must not void a fall
        RT.fallY = null;
    }
    if (RT.vy < 0) RT.fallY = null;                                   // rising: forget the old anchor
    if (!RT.ground && RT.vy > 0 && RT.fallY == null) RT.fallY = S.py;
    if (RT.vy <= 0 || RT.ground) { if (RT.ground) RT.fallY = null; }

    // lava burns; water: breath
    if (inLava() && RT.iframe <= 0) hurt(20, 0);
    if (headUnderWater()) {
        RT.breath = Math.max(0, RT.breath - 1); unlock('swim');
        if (RT.breath <= 0 && RT.regenT % 20 === 0 && RT.iframe <= 0) hurt(6, 0);
    } else RT.breath = Math.min(200, RT.breath + 4);
    var br = RT.root.querySelector('.tr-breath');
    if (headUnderWater() && RT.breath < 200) { br.hidden = false; br.style.setProperty('--b', (RT.breath / 200 * 100) + '%'); } else br.hidden = true;
}
function moveBody() {
    var prevPy = S.py;
    S.px += RT.vx;
    if (hitSolid()) { var sx2 = RT.vx > 0 ? 1 : -1, gx = 0; while (hitSolid() && gx++ < 20) S.px -= sx2 * 0.25; RT.vx = 0; }
    RT.ground = false; RT.landedVy = 0;
    S.py += RT.vy;
    if (hitSolid()) {
        var sy2 = RT.vy > 0 ? 1 : -1, gy = 0; while (hitSolid() && gy++ < 32) S.py -= sy2 * 0.25;
        if (sy2 > 0) { RT.ground = true; RT.landedVy = RT.vy; }
        RT.vy = 0;
    } else {
        var platTop = platformCross(prevPy);   // one-way platform: land ON the surface (snap up), even at terminal velocity
        if (platTop != null) { S.py = platTop - 20; RT.ground = true; RT.landedVy = RT.vy; RT.vy = 0; }
    }
    // the snap above can leave a sub-pixel gap, so a resting player would flicker in and out of
    // "grounded" every other frame — and a tapped jump landing on an off frame was silently dropped.
    // Standing still IS standing: while not rising, ground truly means "solid within a pixel of the feet".
    if (!RT.ground && RT.vy >= 0 && footing()) { RT.ground = true; RT.vy = 0; }
    S.px = clamp(S.px, TS, (W - 2) * TS); S.py = clamp(S.py, TS, (H - 3) * TS);
}
// solid (or a door) within ~1px under the feet — the tolerance that makes standing stable
function footing() {
    for (var ox = 1; ox <= 9; ox += 4) { var t = tileAt(S.px + ox, S.py + 20 + 1); if (SOLID[t] || t === T_DOOR) return true; }
    return false;
}
// returns the pixel-Y of the platform surface the feet crossed this frame while descending, else null
function platformCross(prevPy) {
    if (RT.vy <= 0 || RT.keys[BINDS.down] || RT.keys.arrowdown) return null;
    var prevFoot = prevPy + 20, foot = S.py + 20;
    for (var ox = 1; ox <= 9; ox += 8) {
        var tx = Math.floor((S.px + ox) / TS);
        for (var ty = Math.floor(prevFoot / TS); ty <= Math.floor(foot / TS); ty++) {
            if (ty < 0 || ty >= H) continue;
            if (RT.w[ty * W + tx] === T_PLATFORM) { var top = ty * TS; if (prevFoot <= top + 1 && foot >= top) return top; }
        }
    }
    return null;
}
function tileRectHitsPlayer(tx, ty) {
    var px0 = tx * TS, py0 = ty * TS;
    return px0 < S.px + 10 && px0 + TS > S.px && py0 < S.py + 20 && py0 + TS > S.py;
}
function hitSolid() {
    for (var ox = 1; ox <= 9; ox += 4) for (var oy = 0; oy <= 20; oy += 5) { var t = tileAt(S.px + ox, S.py + oy); if (SOLID[t] || t === T_DOOR) return true; }
    return false;
}

/* ─────────────── liquid flow (windowed, cheap cellular) ─────────────── */
function tickLiquids() {
    RT.liqPhase = ((RT.liqPhase || 0) + 1) % 3;
    if (RT.liqPhase !== 0) return;   // 20 Hz
    var vw = RT.cv.width, vh = RT.cv.height;
    var x0 = Math.max(1, Math.floor(RT.cam.x / TS) - 8), y0 = Math.max(1, Math.floor(RT.cam.y / TS) - 8);
    var x1 = Math.min(W - 2, x0 + Math.ceil(vw / TS) + 16), y1 = Math.min(H - 2, y0 + Math.ceil(vh / TS) + 16);
    var lq = RT.lq, lk = RT.lk, w = RT.w;
    for (var y = y1; y >= y0; y--) for (var x = x0; x <= x1; x++) {
        var i = y * W + x, m = lq[i]; if (m === 0) continue;
        var kind = lk[i];
        // down
        var di = (y + 1) * W + x;
        if (!SOLID[w[di]] && w[di] !== T_DOOR) {
            if (lq[di] === 0) lk[di] = kind;
            if (lk[di] === kind) { var room = LMAX - lq[di]; var mv = Math.min(m, room); lq[di] += mv; lq[i] -= mv; m = lq[i]; if (m === 0) continue; }
        }
        // spread sideways to equalize
        var li = y * W + (x - 1), ri = y * W + (x + 1);
        var lo = (!SOLID[w[li]] && w[li] !== T_DOOR && (lq[li] === 0 || lk[li] === kind));
        var ro = (!SOLID[w[ri]] && w[ri] !== T_DOOR && (lq[ri] === 0 || lk[ri] === kind));
        if (lo && lq[li] < m - 1) { if (lq[li] === 0) lk[li] = kind; var t1 = Math.floor((m - lq[li]) / (kind === LQ_LAVA ? 4 : 2)); if (t1 > 0) { lq[li] += t1; lq[i] -= t1; m = lq[i]; } }
        if (ro && lq[ri] < m - 1) { if (lq[ri] === 0) lk[ri] = kind; var t2 = Math.floor((m - lq[ri]) / (kind === LQ_LAVA ? 4 : 2)); if (t2 > 0) { lq[ri] += t2; lq[i] -= t2; } }
        if (lq[i] <= 1 && !SOLID[w[(y + 1) * W + x]]) { /* trace amounts evaporate to avoid endless churn */ }
        // water+lava meet → obsidian
        var ui = (y - 1) * W + x;
        if (kind === LQ_LAVA && ((lk[li] === LQ_WATER && lq[li] > 0) || (lk[ri] === LQ_WATER && lq[ri] > 0) ||
                                 (lk[di] === LQ_WATER && lq[di] > 0) || (lk[ui] === LQ_WATER && lq[ui] > 0))) {
            w[i] = T_OBSIDIAN; lq[i] = 0; patchAround(x, y); puff(x * TS + 4, y * TS + 4);
        }
    }
}

/* ─────────────── using the held item ─────────────── */
function held() { return S.inv[S.sel]; }
function mouseWorld() { return { x: RT.mouse.x / RS + RT.cam.x, y: RT.mouse.y / RS + RT.cam.y }; }
function inReach(tx, ty) { var dx = tx * TS + 4 - (S.px + 5), dy = ty * TS + 4 - (S.py + 10); return dx * dx + dy * dy <= (6 * TS) * (6 * TS); }
function useHeld(edgeOnly) {
    var h = held(), def = h ? ITEMS[h.id] : null, m = mouseWorld();
    RT.face = m.x >= S.px + 5 ? 1 : -1;
    if (def && (def.kind === 'sword')) { if (RT.useT <= 0) { swing(def.dmg, def.knock || 3); RT.useT = def.use; } return; }
    if (def && def.kind === 'bow') { if (RT.useT <= 0) fireArrow(def); return; }
    if (def && def.kind === 'magic') { if (RT.useT <= 0) castBolt(def); return; }
    if (def && def.kind === 'summon') { if (RT.mouse.lEdge) { RT.mouse.lEdge = false; useSummon(h.id, def.boss); } return; }
    if (def && def.kind === 'potion') { if (RT.mouse.lEdge) { RT.mouse.lEdge = false; drinkPotion(S.sel); } return; }
    if (def && def.kind === 'manacrystal') { if (RT.mouse.lEdge) { RT.mouse.lEdge = false; if (S.maxmana >= 200) { toast('Mana is already maxed.'); } else { S.maxmana += 20; S.mana = S.maxmana; invTake(h.id, 1); heartParts(S.px + 5, S.py + 8, '#5a9cf0'); toast('Your maximum mana increased by 20!'); paintStars(); paintHotbar(); } } return; }
    // mining/chopping/hammering with pick/axe/hammer or fists
    var tx = Math.floor(m.x / TS), ty = Math.floor(m.y / TS);
    if (tx < 1 || tx >= W - 1 || ty < 1 || ty >= H - 1) return;
    if (!inReach(tx, ty)) return;
    // chest: open on click
    if (RT.w[ty * W + tx] === T_CHEST) { if (RT.mouse.lEdge) { RT.mouse.lEdge = false; openChest(tx, ty); } return; }
    if (def && def.kind === 'hammer') { if (RT.wall[ty * W + tx]) { hammerWall(tx, ty); return; } if (RT.w[ty * W + tx] === T_PLATFORM) { /* fall through to break */ } }
    var t = RT.w[ty * W + tx];
    // swinging at air: only TOOLS connect (and on a cooldown). Ammo and blocks carry a dmg
    // field for their own systems — letting them melee gave arrows unlimited cooldown-free DPS.
    if (t === T_AIR) {
        if (def && (def.kind === 'pick' || def.kind === 'axe' || def.kind === 'hammer') && RT.useT <= 0) {
            swing(Math.max(3, Math.round((def.pow || 1) * 4)), 2); RT.useT = 20;
        }
        return;
    }
    var isTree = (t === T_TRUNK || t === T_LEAF);
    var isSoft = (t === T_POT || t === T_TORCH || t === T_HEARTC || t === T_MANAC || t === T_SAPLING || t === T_BOTTLE || STATION[t] || t === T_DOOR || t === T_PLATFORM);
    var pow = 0.5;
    if (def && def.kind === 'pick' && !isTree) pow = def.pow;
    if (def && def.kind === 'axe' && isTree) pow = def.pow;
    if (def && def.kind === 'hammer') pow = def.pow;
    if (isSoft) pow = Math.max(pow, 1.4);
    // pick can't break hellstone/demonite without enough power
    if ((t === T_HELLSTONE || t === T_DEMONITE || t === T_OBSIDIAN || t === T_EBON) && (!def || def.kind !== 'pick' || def.pow < 3)) { if (RT.anim % 30 === 0) toast('This needs a stronger pickaxe.'); return; }
    RT.swing = Math.max(RT.swing, 6);
    if (RT.mineT.x !== tx || RT.mineT.y !== ty) RT.mineT = { x: tx, y: ty, p: 0 };
    RT.mineT.p += pow / 14;
    if (RT.mineT.p >= (HARD[t] || 1)) breakTile(tx, ty, t);
}
function breakTile(tx, ty, t) {
    RT.w[ty * W + tx] = T_AIR; patchAround(tx, ty);
    RT.mineT.p = 0; S.mined++;
    minePuff(tx, ty, t);
    if (S.mined >= 2500) unlock('dozer');
    if (t === T_GRASS || t === T_CGRASS || t === T_JGRASS) drop(tx, ty, 'dirt', 1);
    else if (t === T_TRUNK) chopTree(tx, ty);
    else if (t === T_LEAF) { if (Math.random() < 0.25) drop(tx, ty, 'wood', 1); }
    else if (t === T_COBWEB) { if (Math.random() < 0.6) drop(tx, ty, 'cobweb', 1); }
    else if (ORE_ITEM[t]) { drop(tx, ty, ORE_ITEM[t], 1); S.ores[t] = 1; unlock('shiny'); if (S.ores[T_COPPER] && S.ores[T_IRON] && S.ores[T_SILVER] && S.ores[T_GOLD]) unlock('ore4'); }
    else if (GEM_ITEM[t]) { drop(tx, ty, GEM_ITEM[t], 1); S.gemsFound[t] = 1; unlock('gem'); }
    else if (t === T_POT) { unlock('pot'); potLoot(tx, ty); }
    else if (t === T_HEARTC) { S.maxhp = Math.min(400, S.maxhp + 20); S.hp = S.maxhp; unlock('heart'); toast('Your maximum life increased by 20!'); paintHearts(); }
    else if (t === T_MANAC) { S.maxmana = Math.min(200, S.maxmana + 20); S.mana = S.maxmana; toast('Your maximum mana increased by 20!'); paintStars(); }
    else if (t === T_CHEST) { openChest(tx, ty); }
    else if (TILE_ITEM[t]) drop(tx, ty, TILE_ITEM[t], 1);
    // grass regrows on adjacent dirt over time handled elsewhere (skipped for simplicity)
    if (ty >= HELL) unlock('bottom'); else if (ty >= 96) unlock('deep');
    if (ty <= SKY + 20 && (t === T_CLOUD || t === T_GRASS) && S.py / TS < SKY + 22) unlock('float');
}
function hammerWall(tx, ty) {
    RT.mineT.p += 0.12;
    if (RT.mineT.x !== tx || RT.mineT.y !== ty || RT.mineHammer !== 'w') { RT.mineT = { x: tx, y: ty, p: 0.12 }; RT.mineHammer = 'w'; }
    if (RT.mineT.p >= 0.5) { var v = RT.wall[ty * W + tx]; RT.wall[ty * W + tx] = WL_NONE; patchAround(tx, ty); RT.mineT.p = 0; RT.mineHammer = null; if (v === WL_WOOD) drop(tx, ty, 'woodwall', 1); minePuff(tx, ty, T_DIRT); }
}
function chopTree(tx, ty) {
    var woodN = 1;
    for (var y = ty - 1; y > 1; y--) { var t = RT.w[y * W + tx]; if (t === T_TRUNK) { RT.w[y * W + tx] = T_AIR; woodN++; } else break; }
    for (var oy = -16; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) { var yy = ty + oy, xx = tx + ox; if (yy > 0 && yy < H && xx > 0 && xx < W && RT.w[yy * W + xx] === T_LEAF) { RT.w[yy * W + xx] = T_AIR; if (Math.random() < 0.15) drop(xx, yy, 'wood', 1); } }
    patchRect(tx - 3, ty - 20, tx + 3, ty + 1);
    drop(tx, ty, 'wood', woodN);
    unlock('timber');
}
function potLoot(tx, ty) {
    var r = Math.random(), deep = ty > 96;
    if (r < 0.32) drop(tx, ty, 'coin', 30 + (Math.random() * 90 | 0));
    else if (r < 0.55) drop(tx, ty, 'torch', 3 + (Math.random() * 4 | 0));
    else if (r < 0.72) drop(tx, ty, 'gel', 2 + (Math.random() * 3 | 0));
    else if (r < 0.86) drop(tx, ty, deep ? 'lheal' : 'lheal', 1 + (Math.random() * 2 | 0));
    else drop(tx, ty, deep ? (Math.random() < 0.4 ? 'heal' : 'lmana') : 'warrow', deep ? 1 : 5 + (Math.random() * 6 | 0));
}
function openChest(tx, ty) {
    var chest = null; for (var i = 0; i < RT.chests.length; i++) { var c = RT.chests[i]; if (c.x === tx && c.y === ty) { chest = c; chest._i = i; break; } }
    if (!chest) { RT.w[ty * W + tx] = T_AIR; patchAround(tx, ty); drop(tx, ty, 'wood', 8); return; }   // stray chest tile
    if (!chest.loot) chest.loot = rollChestLoot(chest, chest.x * 7919 + chest.y);   // stable per location
    var gotAll = true;
    chest.loot = chest.loot.filter(function (it) {
        if (it.id === 'coin') { S.coins += it.c; return false; }
        var over = invGive(it.id, it.c);
        if (over > 0) { it.c = over; gotAll = false; return true; }
        return false;
    });
    unlock('chest');
    if (gotAll) { RT.w[ty * W + tx] = T_AIR; patchAround(tx, ty); drop(tx, ty, 'wood', 8); RT.chests.splice(chest._i, 1); toast('Chest emptied.'); }
    else toast('Inventory full — some loot remains in the chest.');
    paintHotbar(); paintCoins();
    if (S.coins >= 10000) unlock('loaded');
}
function rightUse() {
    // right-click: talk to an NPC, else place block/platform/wall
    if (uiOpen() || RT.dead) return;
    var mw = mouseWorld();
    var dtx = Math.floor(mw.x / TS), dty = Math.floor(mw.y / TS);
    if (dtx > 0 && dtx < W && dty > 0 && dty < H && inReach(dtx, dty)) {
        var dt = RT.w[dty * W + dtx];
        // a placed door used to be a permanent wall — right-click swings it open and shut
        if (dt === T_DOOR) { RT.w[dty * W + dtx] = T_DOOROPEN; patchAround(dtx, dty); return; }
        if (dt === T_DOOROPEN) {
            if (!tileRectHitsPlayer(dtx, dty)) { RT.w[dty * W + dtx] = T_DOOR; patchAround(dtx, dty); }   // never shut it on yourself
            return;
        }
    }
    var npc = npcAt(mw.x, mw.y);   // the Merchant and Nurse are only reachable this way
    if (npc && Math.abs((npc.x + 4) - (S.px + 5)) < 90 && Math.abs((npc.y + 8) - (S.py + 10)) < 70) {
        if (npc.kind === 'merchant') { openShop('merchant'); return; }
        if (npc.kind === 'nurse') { openShop('nurse'); return; }
        guideTalk(); return;
    }
    var h = held(); if (!h) return;
    var def = ITEMS[h.id]; var tx = Math.floor(mw.x / TS), ty = Math.floor(mw.y / TS);
    if (tx < 1 || tx >= W - 1 || ty < 1 || ty >= H - 1 || !inReach(tx, ty)) return;
    if (def.kind === 'wall') { if (!RT.wall[ty * W + tx] && (RT.w[ty * W + tx] === T_AIR)) { RT.wall[ty * W + tx] = def.place; patchAround(tx, ty); invTake(h.id, 1); paintHotbar(); checkHouse(); } return; }
    if (def.kind !== 'block' && def.kind !== 'platform') return;
    if (RT.w[ty * W + tx] !== T_AIR || RT.lq[ty * W + tx] > 60) return;
    var n = SOLID[RT.w[(ty - 1) * W + tx]] || SOLID[RT.w[(ty + 1) * W + tx]] || SOLID[RT.w[ty * W + tx - 1]] || SOLID[RT.w[ty * W + tx + 1]]
        || RT.w[(ty + 1) * W + tx] === T_PLATFORM || RT.w[ty * W + tx - 1] === T_PLATFORM || RT.w[ty * W + tx + 1] === T_PLATFORM
        || [T_TORCH, T_BENCH, T_FURNACE, T_ANVIL, T_TABLE, T_DOOR].indexOf(RT.w[(ty + 1) * W + tx]) >= 0 || RT.wall[ty * W + tx];
    if (!n && def.place !== T_TORCH) return;
    // don't entomb yourself: collidable placements (solids AND doors) can't overlap the body
    if (SOLID[def.place] || def.place === T_DOOR) { var px0 = tx * TS, py0 = ty * TS; if (px0 < S.px + 10 && px0 + TS > S.px && py0 < S.py + 20 && py0 + TS > S.py) return; }
    RT.w[ty * W + tx] = def.place; patchAround(tx, ty);
    if (SOLID[def.place]) RT.lq[ty * W + tx] = 0;   // a solid tile displaces any liquid in the cell (no source desync)
    invTake(h.id, 1);
    if (def.place === T_ANVIL) unlock('metal');
    paintHotbar();
    checkHouse();   // placing walls/doors/furniture may complete a valid house
}
function swing(dmg, knock) {
    RT.swing = 12; RT.useT = RT.useT;
    var reach = 24, cx = S.px + 5 + RT.face * 15, cy = S.py + 8;
    RT.foes.forEach(function (f) { var dx = f.x - cx, dy = f.y - cy; if (dx * dx + dy * dy < reach * reach) hitFoe(f, dmg, RT.face, knock); });
    if (RT.boss && bossHit(cx, cy, reach + 16)) hitBoss(dmg, RT.face);
    // hit a torch/enemy? light nothing; melee also cuts cobweb quickly (handled by mining path)
}
function fireArrow(def) {
    var arrow = ammoOf('arrow'); if (!arrow) { if (RT.anim % 40 === 0) toast('Out of arrows.'); return; }
    var adef = ITEMS[arrow.id];
    takeAmmo(arrow);
    RT.useT = def.use; RT.swing = 8;
    var m = mouseWorld(), sx = S.px + 5, sy = S.py + 8, dx = m.x - sx, dy = m.y - sy, d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    var sp = 6;
    RT.shots.push({ x: sx, y: sy, vx: dx / d * sp, vy: dy / d * sp, dmg: def.dmg + adef.dmg, kind: 'arrow', fire: adef.fire, grav: 0.06, t: 120, knock: def.knock || 3 });
    unlock('archer');
}
function castBolt(def) {
    if (S.mana < def.mana) { if (RT.anim % 40 === 0) toast('Not enough mana.'); return; }
    S.mana -= def.mana; paintStars();
    RT.useT = def.use; RT.swing = 8;
    var m = mouseWorld(), sx = S.px + 5, sy = S.py + 8, dx = m.x - sx, dy = m.y - sy, d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    var sp = 5;
    RT.shots.push({ x: sx, y: sy, vx: dx / d * sp, vy: dy / d * sp, dmg: def.dmg, kind: 'bolt', grav: 0, t: 90, col: '#c060f0', knock: def.knock || 3 });
    unlock('wizard');
}
function ammoOf(type) { for (var i = 0; i < S.ammo.length; i++) { var a = S.ammo[i]; if (a && ITEMS[a.id].ammo === type) return { slot: i, id: a.id }; } for (i = 0; i < S.inv.length; i++) { var s = S.inv[i]; if (s && ITEMS[s.id].kind === 'ammo' && ITEMS[s.id].ammo === type) return { slot: -1 - i, id: s.id }; } return null; }
function takeAmmo(a) { if (a.slot >= 0) { S.ammo[a.slot].c--; if (!S.ammo[a.slot].c) S.ammo[a.slot] = null; } else { var i = -1 - a.slot; S.inv[i].c--; if (!S.inv[i].c) S.inv[i] = null; } }
function stepShots() {
    for (var i = RT.shots.length - 1; i >= 0; i--) {
        var s = RT.shots[i]; s.vy += s.grav; s.x += s.vx; s.y += s.vy; s.t--;
        if (s.fire && RT.anim % 2 === 0) RT.parts.push({ x: s.x, y: s.y, vx: 0, vy: -0.2, t: 10, c: '#ff8a2a', r: 1 });
        var hit = false;
        if (SOLID[tileAt(s.x, s.y)]) { hit = true; if (s.fire) { var tx = Math.floor(s.x / TS), ty = Math.floor(s.y / TS); if (tileAt(s.x, s.y - TS) === T_AIR) { RT.w[(ty - 1) * W + tx] = RT.w[(ty - 1) * W + tx] === T_AIR ? T_TORCH : RT.w[(ty - 1) * W + tx]; patchAround(tx, ty - 1); } } }
        if (s.foe) {   // enemy projectile (hornet stinger): only the player is a target
            if (!hit && RT.iframe <= 0 && !RT.dead && Math.abs((S.px + 5) - s.x) < 8 && Math.abs((S.py + 8) - s.y) < 11) { hurt(s.dmg, s.vx > 0 ? 1 : -1); hit = true; }
        } else {
            for (var j = 0; j < RT.foes.length && !hit; j++) { var f = RT.foes[j]; if (Math.abs(f.x + 4 - s.x) < 8 && Math.abs(f.y + 5 - s.y) < 9) { hitFoe(f, s.dmg, s.vx > 0 ? 1 : -1, s.knock); hit = true; } }
            if (!hit && RT.boss && bossHit(s.x, s.y, RT.boss.r + 4)) { hitBoss(s.dmg, s.vx > 0 ? 1 : -1); hit = true; }
        }
        if (hit || s.t <= 0) RT.shots.splice(i, 1);
    }
}
function drinkPotion(slot) {
    var s = S.inv[slot]; if (!s) return; var def = ITEMS[s.id]; if (def.kind !== 'potion') return;
    if (def.heal) { if (S.hp >= S.maxhp) { toast('Already at full life.'); return; } S.hp = Math.min(S.maxhp, S.hp + def.heal); paintHearts(); }
    if (def.mana) { if (S.mana >= S.maxmana) { toast('Already at full mana.'); return; } S.mana = Math.min(S.maxmana, S.mana + def.mana); paintStars(); }
    if (def.buff) { S.buffs[def.buff] = def.dur; paintBuffs(); }
    heartParts(S.px + 5, S.py + 8, def.mana ? '#5a9cf0' : def.buff ? '#f0d040' : '#f05a6a');
    invTake(s.id, 1); paintHotbar(); if (RT.panel) paintPanel();
}
function quickPotion(type) {
    if (RT.dead) return;
    var want = type === 'heal' ? function (d) { return d.heal; } : type === 'mana' ? function (d) { return d.mana; } : function (d) { return d.buff; };
    if (type === 'heal' && S.hp >= S.maxhp) return;
    if (type === 'mana' && S.mana >= S.maxmana) return;
    for (var i = 0; i < S.inv.length; i++) { var s = S.inv[i]; if (s && ITEMS[s.id].kind === 'potion' && want(ITEMS[s.id])) { drinkPotion(i); return; } }
    toast('No ' + type + ' potion.');
}
function useSummon(id, boss) {
    if (RT.boss) { toast('A boss already stalks you.'); return; }
    if (boss === 'eye' && !isNight()) { toast('The eye only answers to the night.'); return; }
    if (boss === 'king') { }
    if (boss === 'eater') { var pxt = Math.floor(S.px / TS); var corrupt = false; for (var ox = -6; ox <= 6; ox++) { var tt = RT.w[Math.floor((S.py) / TS) * W + pxt + ox]; if (tt === T_EBON || tt === T_CGRASS) corrupt = true; } if (!corrupt) { toast('The Eater stirs only in the corruption.'); return; } }
    invTake(id, 1); paintHotbar(); spawnBoss(boss);
}
function craft(ri) {
    var r = RECIPES[ri];
    if (RT.dead || !r || !canCraft(r)) return;
    r[3].forEach(function (ing) { invTake(ing[0], ing[1]); });
    var over = invGive(r[0], r[1]);
    if (r[0] === 'bench') unlock('benched');
    if (r[0] === 'anvil') unlock('metal');
    if (r[0] === 'manac') unlock('mana');
    if (ITEMS[r[0]].kind === 'summon') unlock('boss');
    if (over) drop(Math.floor((S.px + 5) / TS), Math.floor((S.py + 10) / TS), r[0], over);
    paintPanel(); paintHotbar();
    toast('Crafted ' + ITEMS[r[0]].n + (r[1] > 1 ? ' ×' + r[1] : '') + '.');
}

/* ─────────────── drops ─────────────── */
function drop(tx, ty, id, n) { RT.drops.push({ x: tx * TS + 4, y: ty * TS + 2, vy: -1, vx: (Math.random() - 0.5) * 1.5, id: id, c: n, t: 0 }); }
function stepDrops() {
    for (var i = RT.drops.length - 1; i >= 0; i--) {
        var d = RT.drops[i]; d.t++;
        d.vy = Math.min(d.vy + 0.15, 4);
        if (!SOLID[tileAt(d.x, d.y + 4)]) d.y += d.vy; else { d.vy = 0; d.vx *= 0.7; }
        if (SOLID[tileAt(d.x + d.vx, d.y)]) d.vx = 0; else d.x += d.vx;
        var dx = (S.px + 5) - d.x, dy = (S.py + 10) - d.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 40 && d.t > 12) { d.x += dx / dist * 2.6; d.y += dy / dist * 2.6; }
        if (dist < 9 && d.t > 12) {
            if (d.id === 'coin') { S.coins += d.c; RT.drops.splice(i, 1); }
            else { var over = invGive(d.id, d.c); if (over) d.c = over; else RT.drops.splice(i, 1); }
            paintHotbar(); paintCoins();
            if (S.coins >= 10000) unlock('loaded');
        }
    }
}

/* ─────────────── enemies ─────────────── */
function isNight() { return S.time >= DAY; }
function biomeAtX(x) {
    if (x < 22 || x > W - 22) return 'ocean';
    if (x < 78) return 'snow';
    if (x > W - 96 && x < W - 54) return 'desert';
    if (x > W - 150 && x <= W - 96) return 'jungle';
    if (x >= W - 54) return 'corrupt';
    return 'forest';
}
function spawnTick() {
    if (RT.foes.length >= 8 || RT.anim % 75 !== 0 || RT.dead || uiOpen()) return;
    // near an NPC's lit home? fewer spawns
    var depth = S.py / TS, pxt = Math.floor(S.px / TS), bio = biomeAtX(pxt);
    var side = Math.random() < 0.5 ? -1 : 1, halfView = RT.cv ? RT.cv.width / 2 : 300;
    var sx = S.px + side * (Math.max(300, halfView + 40) + Math.random() * 220), tx = Math.floor(sx / TS);
    if (tx < 2 || tx >= W - 2) return;
    var kind;
    if (depth > HELL) return;   // underworld left simple (lava does the work)
    if (depth > 96) kind = Math.random() < 0.4 ? 'bat' : Math.random() < 0.7 ? 'skeleton' : 'slime';
    else if (depth > 70) kind = Math.random() < 0.5 ? 'slime' : 'bat';
    else if (bio === 'jungle' && Math.random() < 0.5) kind = 'hornet';
    else if (isNight()) kind = Math.random() < 0.55 ? 'zombie' : 'eye';
    else if (Math.random() < 0.55) kind = 'slime';
    else return;
    var ty;
    if (kind === 'eye' || kind === 'bat' || kind === 'hornet') ty = Math.max(SKY, Math.floor(S.py / TS) - 6 - Math.random() * 6);
    else {
        ty = Math.floor(S.py / TS) - 6; var guard = 0;
        while (guard++ < 40 && ty < H - 3 && !SOLID[RT.w[(ty + 1) * W + tx]]) ty++;
        if (guard >= 40) return;
        if (SOLID[RT.w[ty * W + tx]] || SOLID[RT.w[(ty - 1) * W + tx]]) return;
        if (RT.lq[(ty + 1) * W + tx] > 30 && RT.lk[(ty + 1) * W + tx] === LQ_LAVA) return;
    }
    var pinky = kind === 'slime' && Math.random() < 0.012;
    var green = kind === 'slime' && depth < 70 && Math.random() < 0.3;
    RT.foes.push({
        kind: kind, x: tx * TS, y: ty * TS - 10, vx: 0, vy: 0,   // above the floor: they fall onto it
        hp: kind === 'zombie' ? 45 : kind === 'eye' ? 60 : kind === 'skeleton' ? 55 : kind === 'bat' ? 22 : kind === 'hornet' ? 40 : pinky ? 150 : green ? 25 : 16,
        dmg: kind === 'zombie' ? 14 : kind === 'eye' ? 18 : kind === 'skeleton' ? 20 : kind === 'bat' ? 12 : kind === 'hornet' ? 16 : 7,
        pinky: pinky, green: green, t: (Math.random() * 60) | 0, hurtT: 0
    });
}
function foeStep(f) {
    f.t++; if (f.hurtT > 0) f.hurtT--;
    var dx = S.px - f.x, dy = S.py - f.y, toward = dx > 0 ? 1 : -1;
    if (f.kind === 'slime') {
        f.vy = Math.min(f.vy + 0.17, 5);
        if (SOLID[tileAt(f.x + 4, f.y + 9)]) { f.vy = 0; f.vx *= 0.6; if (f.t % 90 === 0) { f.vy = -2.7 - Math.random(); f.vx = toward * (0.8 + Math.random() * 0.6); } }
        f.x += f.vx; if (SOLID[tileAt(f.x + 4, f.y + 4)] || SOLID[tileAt(f.x + 4, f.y + 8)]) { f.x -= f.vx; f.vx = -f.vx * 0.5; }
        f.y += f.vy; if (SOLID[tileAt(f.x + 4, f.y)] || SOLID[tileAt(f.x + 4, f.y + 8)]) { f.y -= f.vy; f.vy = 0; }
    } else if (f.kind === 'zombie' || f.kind === 'skeleton') {
        f.vy = Math.min(f.vy + 0.17, 5);
        var onG = SOLID[tileAt(f.x + 4, f.y + 18)];   // see stepNPCs: resting hovers a hair above the tile
        if (onG) { f.vy = 0; f.vx = toward * (f.kind === 'skeleton' ? 0.7 : 0.55); }
        if (onG && SOLID[tileAt(f.x + 4 + toward * 6, f.y + 12)]) f.vy = -3.3;
        f.x += f.vx; if (SOLID[tileAt(f.x + 4, f.y + 2)] || SOLID[tileAt(f.x + 4, f.y + 15)]) f.x -= f.vx;
        f.y += f.vy; if (SOLID[tileAt(f.x + 4, f.y)] || SOLID[tileAt(f.x + 4, f.y + 17)]) { f.y -= f.vy; f.vy = 0; }
        if (f.kind === 'zombie' && !isNight() && f.t % 60 === 0) f.hp -= 5;
    } else {   // flyers: eye / bat / hornet
        var d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        var wob = f.kind === 'bat' ? Math.sin(f.t / 8) * 0.08 : Math.sin(f.t / 14) * 0.03;
        f.vx += (dx / d) * (f.kind === 'hornet' ? 0.04 : 0.05); f.vy += (dy / d) * 0.05 + wob;
        var cap = f.kind === 'bat' ? 1.9 : 1.6;
        f.vx = clamp(f.vx, -cap, cap); f.vy = clamp(f.vy, -cap, cap);
        f.x += f.vx; f.y += f.vy;
        if (f.kind === 'hornet' && f.t % 80 === 0 && Math.abs(dx) < 260) {   // stinger shot
            var hd = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            RT.shots.push({ x: f.x + 4, y: f.y + 4, vx: dx / hd * 3, vy: dy / hd * 3, dmg: 12, kind: 'stinger', grav: 0.02, t: 90, foe: true, col: '#d0e030', knock: 2 });
        }
        if ((f.kind === 'eye') && !isNight() && f.t % 60 === 0) f.hp -= 5;
    }
    if (f.hp <= 0) { foeDrops(f); if (f.pinky) unlock('pinky'); return true; }
    var pdx = (S.px + 5) - (f.x + 4), pdy = (S.py + 10) - (f.y + 6);
    if (Math.abs(pdx) < 11 && Math.abs(pdy) < 15 && RT.iframe <= 0 && !RT.dead) hurt(f.dmg, pdx > 0 ? 1 : -1);
    if (Math.abs(f.x - S.px) > 820 || Math.abs(f.y - S.py) > 460) return true;
    return false;
}
function hitFoe(f, dmg, dir, knock) {
    if (f.hurtT > 0) return;
    var real = Math.max(1, dmg + ((Math.random() * 3 | 0) - 1));
    var crit = Math.random() < 0.08; if (crit) real *= 2;
    f.hp -= real; f.hurtT = 8;
    f.vx = dir * (knock || 3) * 0.8; f.vy = -1.4;
    dmgNum(f.x, f.y, real, crit);
    bloodParts(f.x + 4, f.y + 4, f.kind === 'slime' ? (f.pinky ? '#f082be' : '#5a8cf0') : '#8a2222');
    if (f.hp <= 0) { S.kills++; if (S.kills >= 100) unlock('slayer'); if (f.kind === 'zombie' && Math.random() < 0.02) drop(Math.floor(f.x / TS), Math.floor(f.y / TS), 'shackle', 1); }
}
function foeDrops(f) {
    var tx = Math.floor(f.x / TS), ty = Math.floor(f.y / TS);
    if (f.kind === 'slime') drop(tx, ty, 'gel', 1 + (Math.random() * 2 | 0));
    if (f.kind === 'eye' && Math.random() < 0.5) drop(tx, ty, 'lens', 1);
    if (f.kind === 'bat' && Math.random() < 0.3) drop(tx, ty, 'lens', 1);
    if (f.kind === 'skeleton' && Math.random() < 0.25) drop(tx, ty, 'iron', 1 + (Math.random() * 2 | 0));
    if (f.kind === 'hornet' && Math.random() < 0.3) drop(tx, ty, 'gel', 2);
    drop(tx, ty, 'coin', f.pinky ? 1000 : (f.kind === 'skeleton' ? 20 : 8) + (Math.random() * 20 | 0));
}
function dmgNum(x, y, n, crit) { RT.dmgs.push({ x: x, y: y - 6, n: n, t: 42, crit: crit }); }
function hurt(dmg, dir, fall) {
    var def = armorDef();
    var real = Math.max(1, Math.round(dmg - def * 0.6));
    S.hp -= real; RT.iframe = fall ? 20 : 42;
    if (!fall) { RT.vx = dir * 2.4; RT.vy = -2; }
    dmgNum(S.px, S.py, real, false);
    bloodParts(S.px + 5, S.py + 8, '#c04040');
    paintHearts();
    if (S.hp <= 0) die();
}
function die() {
    RT.dead = 300; RT.grapple = null; togglePanel(false);
    var lost = Math.floor(S.coins / 2); S.coins -= lost;
    if (lost > 0) drop(Math.floor((S.px + 5) / TS), Math.floor((S.py + 10) / TS), 'coin', lost);   // actually dropped, as the message claims
    RT.root.querySelector('.tr-death').hidden = false;
    RT.root.querySelector('.tr-death span').textContent = lost ? 'and dropped ' + coinFmt(lost) + ' on the way down.' : 'The dirt sends its regards.';
    if (RT.boss) { RT.boss = null; RT.root.querySelector('.tr-bosshp').hidden = true; }
    paintCoins();
}
function respawn() {
    S.hp = S.maxhp; S.mana = S.maxmana; S.px = S.spawnx; S.py = S.spawny; RT.vx = RT.vy = 0; RT.foes = []; RT.shots = []; RT.breath = 200; RT.camReady = false;
    RT.root.querySelector('.tr-death').hidden = true; paintHearts(); paintStars();
}

/* ─────────────── bosses ─────────────── */
function spawnBoss(kind) {
    if (RT.boss) return;
    if (kind === 'eye') RT.boss = { kind: 'eye', x: S.px - 220, y: S.py - 150, vx: 0, vy: 0, hp: 1400, max: 1400, t: 0, dash: 0, r: 16 };
    else if (kind === 'king') RT.boss = { kind: 'king', x: S.px - 120, y: S.py - 120, vx: 0, vy: 0, hp: 1600, max: 1600, t: 0, r: 22, ground: false };
    else if (kind === 'eater') { RT.boss = { kind: 'eater', hp: 2000, max: 2000, t: 0, r: 8, seg: [] }; var hx = S.px - 100, hy = S.py + 40; for (var i = 0; i < 14; i++) RT.boss.seg.push({ x: hx - i * 10, y: hy }); }
    RT.root.querySelector('.tr-bosshp').hidden = false;
    RT.root.querySelector('.tr-bosshp b').textContent = kind === 'eye' ? 'Eye of Cthulhu' : kind === 'king' ? 'King Slime' : 'Eater of Worlds';
    toast('You feel an evil presence watching you…');
}
/* is (x,y) within `pad` of the boss's body? the Eater is a worm with no single centre —
   every segment is a target, so hit tests must walk the body instead of reading b.x/b.y */
function bossHit(x, y, pad) {
    var b = RT.boss; if (!b) return false;
    if (b.seg) {
        for (var i = 0; i < b.seg.length; i++) {
            var dx = b.seg[i].x - x, dy = b.seg[i].y - y;
            if (dx * dx + dy * dy < pad * pad) return true;
        }
        return false;
    }
    var bx = b.x - x, by = b.y - y;
    return bx * bx + by * by < pad * pad;
}
function hitBoss(dmg, dir) {
    var b = RT.boss; var real = Math.max(1, dmg + ((Math.random() * 3 | 0) - 1)); var crit = Math.random() < 0.08; if (crit) real *= 2;
    b.hp -= real; dmgNum(b.kind === 'eater' ? b.seg[0].x : b.x, b.kind === 'eater' ? b.seg[0].y : b.y, real, crit);
    if (b.hp <= 0) killBoss();
    var bar = RT.root.querySelector('.tr-bossbar i'); if (bar) bar.style.width = Math.max(0, b.hp / b.max * 100) + '%';
}
function bossStep() {
    var b = RT.boss; b.t++;
    if (b.kind === 'eye') {
        var phase2 = b.hp < b.max * 0.5, interval = phase2 ? 100 : 165;
        if (b.dash > 0) { b.dash--; b.x += b.vx; b.y += b.vy; }
        else {
            var hx = S.px + (b.t % (interval * 2) < interval ? -110 : 110), hy = S.py - 120;
            b.vx += clamp((hx - b.x) * 0.002, -0.2, 0.2); b.vy += clamp((hy - b.y) * 0.002, -0.2, 0.2);
            b.vx = clamp(b.vx * 0.98, -2.4, 2.4); b.vy = clamp(b.vy * 0.98, -2.2, 2.2); b.x += b.vx; b.y += b.vy;
            if (b.t % interval === 0) { var dx = (S.px + 5) - b.x, dy = (S.py + 10) - b.y, d = Math.max(1, Math.sqrt(dx * dx + dy * dy)), sp = phase2 ? 5.2 : 4; b.vx = dx / d * sp; b.vy = dy / d * sp; b.dash = 34; }
        }
        bossContact(b.x, b.y, 18, phase2 ? 23 : 15);
        if (!isNight()) return bossFlees();
    } else if (b.kind === 'king') {
        b.vy = Math.min(b.vy + 0.2, 6);
        if (SOLID[tileAt(b.x, b.y + b.r)]) { b.vy = 0; if (b.t % 70 === 0) { b.vy = -5.5; b.vx = ((S.px - b.x) > 0 ? 1 : -1) * (1.6 + Math.random()); } b.vx *= 0.7; }
        b.x += b.vx; if (SOLID[tileAt(b.x + (b.vx > 0 ? b.r : -b.r), b.y)]) { b.x -= b.vx; b.vx = -b.vx; }
        // out-of-bounds reads as solid, so an unguarded push-up loop spins forever (a frozen tab)
        // if the king is ever above the world — keep it bounded and inside the world.
        b.x = clamp(b.x, TS * 2, (W - 3) * TS); b.y = clamp(b.y, TS * 2, (H - 3) * TS);
        b.y += b.vy;
        if (SOLID[tileAt(b.x, b.y + b.r)]) { var kg = 0; while (SOLID[tileAt(b.x, b.y + b.r)] && kg++ < 80) b.y -= 0.5; b.vy = 0; }
        bossContact(b.x, b.y, b.r, 24);
    } else if (b.kind === 'eater') {
        var head = b.seg[0], dx2 = (S.px + 5) - head.x, dy2 = (S.py + 10) - head.y, d2 = Math.max(1, Math.sqrt(dx2 * dx2 + dy2 * dy2));
        head.x += dx2 / d2 * 2.2; head.y += dy2 / d2 * 2.2;
        for (var i = 1; i < b.seg.length; i++) { var s = b.seg[i], p = b.seg[i - 1], sdx = p.x - s.x, sdy = p.y - s.y, sd = Math.max(1, Math.sqrt(sdx * sdx + sdy * sdy)); if (sd > 10) { s.x += sdx / sd * (sd - 10); s.y += sdy / sd * (sd - 10); } }
        b.seg.forEach(function (s) { bossContact(s.x, s.y, 7, 17); });
    }
    var bar = RT.root.querySelector('.tr-bossbar i'); if (bar) bar.style.width = Math.max(0, b.hp / b.max * 100) + '%';
}
function bossContact(bx, by, r, dmg) { var pdx = (S.px + 5) - bx, pdy = (S.py + 10) - by; if (Math.abs(pdx) < r && Math.abs(pdy) < r && RT.iframe <= 0 && !RT.dead) hurt(dmg, pdx > 0 ? 1 : -1); }
function bossFlees() { RT.boss = null; RT.root.querySelector('.tr-bosshp').hidden = true; toast('The Eye flees the sunrise. It will remember this.'); }
function killBoss() {
    var b = RT.boss, kind = b.kind, bx = (kind === 'eater' ? b.seg[0].x : b.x), by = (kind === 'eater' ? b.seg[0].y : b.y);
    RT.boss = null; RT.root.querySelector('.tr-bosshp').hidden = true;
    var tx = Math.floor(bx / TS), ty = Math.floor(by / TS);
    drop(tx, ty, 'coin', kind === 'king' ? 20000 : 30000);
    if (kind === 'eye') { drop(tx, ty, 'demon', 12 + (Math.random() * 8 | 0)); for (var i = 0; i < 4; i++) drop(tx + i - 2, ty, 'lens', 1); unlock('eye'); toast('The Eye of Cthulhu has been defeated!'); }
    if (kind === 'king') { drop(tx, ty, 'gel', 40); drop(tx, ty, 'hook', 1); unlock('king'); toast('King Slime has been defeated!'); }
    if (kind === 'eater') { drop(tx, ty, 'shadow', 10 + (Math.random() * 6 | 0)); drop(tx, ty, 'demon', 20); unlock('eater'); toast('The Eater of Worlds has been defeated!'); }
    for (var b2 = 0; b2 < 10; b2++) bloodParts(bx + (Math.random() - 0.5) * 20, by + (Math.random() - 0.5) * 20, '#8a2222');
}

/* ─────────────── grappling hook ─────────────── */
function fireGrapple() {
    if (!accHas('hook') || RT.dead || uiOpen()) { if (!accHas('hook') && RT.anim) toast('Equip a Grappling Hook first.'); return; }
    var m = mouseWorld(), sx = S.px + 5, sy = S.py + 10, dx = m.x - sx, dy = m.y - sy, d = Math.max(1, Math.sqrt(dx * dx + dy * dy)), sp = 8;
    RT.grapple = { x: sx, y: sy, vx: dx / d * sp, vy: dy / d * sp, latched: false, len: 0 };
}
function releaseGrapple() { RT.grapple = null; }

/* ─────────────── NPCs ─────────────── */
function spawnNPC(kind) {
    if (RT.npcs.some(function (n) { return n.kind === kind; })) return;
    // stand them on real footing: dropped blind beside the spawn they could land inside a hillside,
    // where both walk probes read solid and the NPC never moves again
    var want = Math.floor((S.spawnx + (kind === 'guide' ? -40 : kind === 'merchant' ? 40 : 80)) / TS);
    var sp = findSpawn(RT.w, RT.lq, RT.surf || [], want);
    RT.npcs.push({ kind: kind, x: sp.x * TS, y: sp.y * TS, vx: 0, vy: 0, face: 1, t: 0, wander: 0 });
}
function stepNPCs() {
    // merchant moves in at ≥ 50 silver (5000 copper); nurse at first heart crystal
    if (!S.merchantIn && S.coins >= 5000) { S.merchantIn = true; spawnNPC('merchant'); unlock('merchant'); toast('The Merchant has moved in. He has torches. He always has torches.'); }
    if (!S.nurseIn && S.maxhp >= 120) { S.nurseIn = true; spawnNPC('nurse'); toast('The Nurse has moved in. She frowns at your life total.'); }
    RT.npcs.forEach(function (n) {
        n.t++;
        n.vy = Math.min(n.vy + 0.17, 5);
        if (n.wander <= 0 && n.t % 120 === 0) { n.wander = 60 + (Math.random() * 90 | 0); n.face = Math.random() < 0.5 ? -1 : 1; }
        var onG = SOLID[tileAt(n.x + 4, n.y + 18)];   // tolerance: resting leaves the feet a hair above the tile
        // walking into a wall used to burn the whole wander timer standing still — turn around instead
        if (n.wander > 0 && onG) { n.wander--; n.vx = n.face * 0.4; if (SOLID[tileAt(n.x + 4 + n.face * 6, n.y + 12)]) { n.vx = 0; n.face = -n.face; } }
        else n.vx *= 0.7;
        if (onG) n.vy = 0;
        n.x += n.vx; if (SOLID[tileAt(n.x + 4, n.y + 15)]) n.x -= n.vx;
        // snap to the surface instead of reverting the whole move: a fast fall could otherwise
        // leave several pixels of gap, so the ground probe never read solid and the NPC froze
        n.y += n.vy;
        if (SOLID[tileAt(n.x + 4, n.y + 17)]) { var ng = 0; while (SOLID[tileAt(n.x + 4, n.y + 17)] && ng++ < 24) n.y -= 0.5; n.vy = 0; }
        // stay near home
        if (Math.abs(n.x - S.spawnx) > 200) { n.face = n.x > S.spawnx ? -1 : 1; n.wander = 40; }
    });
}
function npcAt(px, py) { for (var i = 0; i < RT.npcs.length; i++) { var n = RT.npcs[i]; if (Math.abs(px - (n.x + 4)) < 12 && Math.abs(py - (n.y + 8)) < 16) return n; } return null; }
/* the Guide does what the Guide does: tells you the obvious, warmly */
var GUIDE_LINES = [
    'Try chopping a tree — wood is the start of everything.',
    'Ten wood makes a Work Bench. Place it, then stand near it to craft.',
    'Torches keep the dark honest. Wood plus gel.',
    'A furnace smelts ore into bars; an anvil turns bars into gear.',
    'Crystal hearts hide underground. Each one is twenty more life.',
    'Fallen stars land at night. Three of them become a mana crystal.',
    'Build a room with walls, a door, a light and some furniture, and someone will move in.',
    'The Merchant arrives once you are carrying a bit of coin.',
    'Six lenses make something suspicious. Use it at night, if you are brave.',
    'That grappling hook changes everything. Try it on a cliff.'
];
function guideTalk() {
    RT.guideTip = ((RT.guideTip || 0) + 1) % GUIDE_LINES.length;
    toast('Guide: “' + GUIDE_LINES[RT.guideTip] + '”');
}

/* housing validity (Terraria's real rules, bounded flood-fill): an enclosed room with background
   walls throughout, a door entrance, a light source, and furniture. Cheap — only runs on placement. */
function checkHouse() {
    if (S.ach.builder) return;
    var pxt = Math.floor((S.px + 5) / TS), pyt = Math.floor((S.py + 10) / TS);
    for (var sy = pyt - 7; sy <= pyt + 4; sy++) for (var sx = pxt - 9; sx <= pxt + 9; sx++) {
        if (sx < 1 || sx >= W - 1 || sy < 1 || sy >= H - 1) continue;
        if (RT.w[sy * W + sx] === T_AIR && RT.wall[sy * W + sx] && validRoom(sx, sy)) { unlock('builder'); return; }
    }
}
function validRoom(sx, sy) {
    var seen = {}, stack = [[sx, sy]], cells = 0, hasTorch = false, hasFurn = false, hasDoor = false, wallsOK = true, enclosed = true, MAX = 260;
    while (stack.length) {
        var c = stack.pop(), x = c[0], y = c[1], k = y * W + x;
        if (seen[k]) continue; seen[k] = 1;
        if (x < 1 || x >= W - 1 || y < 1 || y >= H - 1) { enclosed = false; break; }
        var t = RT.w[k];
        if (t === T_DOOR || t === T_DOOROPEN) { hasDoor = true; continue; }                         // door is a valid boundary/entrance
        if (SOLID[t]) { if (t === T_TABLE || t === T_BENCH) hasFurn = true; continue; }   // wall/furniture boundary
        cells++; if (cells > MAX) { enclosed = false; break; }                   // too large / open to the world
        if (t === T_TORCH) hasTorch = true;
        if (t === T_CHAIR) hasFurn = true;
        if (!RT.wall[k]) wallsOK = false;                                        // interior air with no background wall
        stack.push([x + 1, y]); stack.push([x - 1, y]); stack.push([x, y + 1]); stack.push([x, y - 1]);
    }
    return enclosed && cells >= 12 && cells <= MAX && hasTorch && hasFurn && hasDoor && wallsOK;
}

/* ─────────────── shops ─────────────── */
var SHOPS = {
    merchant: [['torch', 1], ['warrow', 1], ['lheal', 30], ['pion', 150], ['pswift', 150], ['woodwall', 1], ['platform', 1]],
    nurse: []   // nurse heals instead of sells
};
function openShop(kind) {
    RT.shopOpen = kind; RT.panel = false; RT.root.querySelector('.tr-panel').hidden = true;
    var el = RT.root.querySelector('.tr-shop'); el.hidden = false;
    if (kind === 'nurse') {
        var missing = S.maxhp - S.hp, cost = missing * 3;
        el.innerHTML = '<div class="tr-shop-card"><div class="tr-shop-h"><b>Nurse</b><button class="tr-x" data-shopx>×</button></div>' +
            '<p class="tr-npc-line">“Hold still. This will only cost you.”</p>' +
            '<div class="tr-heal-row"><span>Restore ' + missing + ' life</span><b>' + coinFmt(cost) + '</b>' +
            '<button class="tr-buy" data-heal ' + (missing <= 0 || S.coins < cost ? 'disabled' : '') + '>' + (missing <= 0 ? 'Full life' : S.coins < cost ? 'Too poor' : 'Heal') + '</button></div></div>';
    } else {
        var rows = SHOPS[kind].map(function (it, i) {
            var d = ITEMS[it[0]], price = it[1];
            return '<button class="tr-shop-i" data-buy="' + i + '" data-tip="' + esc(d.n + (d.tip ? ' — ' + d.tip : '')) + '">' + itemIcon(it[0]) + '<span class="tr-shop-n" style="color:' + (RAR[d.rar] || '#fff') + '">' + esc(d.n) + '</span><span class="tr-shop-p">' + coinFmt(price) + '</span></button>';
        }).join('');
        el.innerHTML = '<div class="tr-shop-card"><div class="tr-shop-h"><b>Merchant</b><button class="tr-x" data-shopx>×</button></div>' +
            '<p class="tr-npc-line">“You look like someone who needs torches.”</p><div class="tr-shop-grid">' + rows + '</div>' +
            '<p class="tr-shop-purse">Your purse: ' + coinFmt(S.coins) + '</p></div>';
    }
    paintHint();
}
function closeShop() { RT.shopOpen = null; RT.root.querySelector('.tr-shop').hidden = true; paintHint(); }
function shopBuy(kind, i) {
    var it = SHOPS[kind][i]; if (!it) return; var price = it[1];
    if (S.coins < price) { toast('Not enough coins.'); return; }
    if (invGive(it[0], 1) > 0) { toast('Your inventory is full.'); return; }   // single item = all-or-nothing; placed nothing, so no charge
    S.coins -= price; paintCoins(); paintHotbar(); openShop(kind);
}

/* ─────────────── buffs ─────────────── */
function tickBuffs() {
    var any = false; for (var k in S.buffs) { S.buffs[k]--; if (S.buffs[k] <= 0) delete S.buffs[k]; any = true; }
    if (RT && RT.anim % 15 === 0) paintBuffs();
}

/* ─────────────── fallen stars ─────────────── */
function stepStars() {
    // stars fall from the SKY: only near the surface, and only down a column that is open to it
    if (isNight() && !uiOpen() && S.py / TS < 70 && Math.random() < 0.006 && (RT.starT || 0) <= 0) {
        var sx = RT.cam.x + Math.random() * RT.cv.width;
        var scol = Math.floor(sx / TS), skyOpen = scol > 0 && scol < W;
        for (var sy2 = 0; skyOpen && sy2 < Math.floor(RT.cam.y / TS); sy2++) if (SOLID[RT.w[sy2 * W + scol]]) skyOpen = false;
        if (!skyOpen) { RT.starT = 30; return; }
        RT.parts.push({ star: 1, x: sx, y: RT.cam.y - 10, vx: (Math.random() - 0.5) * 0.6, vy: 2 + Math.random() * 1.5, t: 400, c: '#fff2a0', r: 2 });
        RT.starT = 120;
    }
    if (RT.starT > 0) RT.starT--;
}

/* ─────────────── particles ─────────────── */
function stepParticles() {
    for (var i = RT.parts.length - 1; i >= 0; i--) {
        var p = RT.parts[i]; p.t--;
        if (p.star) {
            p.x += p.vx; p.y += p.vy; p.vy += 0.02;
            if (SOLID[tileAt(p.x, p.y)] || p.y > (H - 2) * TS) { var tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS); for (var yy = ty; yy < H; yy++) if (RT.w[yy * W + tx] === T_AIR && SOLID[RT.w[(yy + 1) * W + tx]]) { drop(tx, yy, 'star', 1); break; } RT.parts.splice(i, 1); continue; }
        } else { p.vy += (p.g || 0.12); p.x += p.vx; p.y += p.vy; }
        if (p.t <= 0) RT.parts.splice(i, 1);
    }
}
function minePuff(tx, ty, t) { var c = (TCOL[t] || ['#a97'])[0]; for (var i = 0; i < 5; i++) RT.parts.push({ x: tx * TS + 4, y: ty * TS + 4, vx: (Math.random() - 0.5) * 1.6, vy: -Math.random() * 1.5, t: 16, c: c, r: 1, g: 0.16 }); }
function bloodParts(x, y, c) { for (var i = 0; i < 4; i++) RT.parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.6, t: 14, c: c, r: 1, g: 0.18 }); }
function heartParts(x, y, c) { for (var i = 0; i < 6; i++) RT.parts.push({ x: x + (Math.random() - 0.5) * 8, y: y, vx: (Math.random() - 0.5) * 0.8, vy: -0.6 - Math.random(), t: 24, c: c, r: 1, g: -0.02 }); }
function puff(x, y) { for (var i = 0; i < 8; i++) RT.parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 2.4, vy: (Math.random() - 0.5) * 2, t: 14, c: '#e8f0ff', r: 1, g: 0.05 }); }

/* ─────────────── explored (fog of war) ─────────────── */
function markExplored() {
    if (RT.anim % 6) return;
    var px = Math.floor((S.px + 5) / TS), py = Math.floor((S.py + 10) / TS), rad = 12;
    for (var y = py - rad; y <= py + rad; y++) for (var x = px - rad; x <= px + rad; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        if ((x - px) * (x - px) + (y - py) * (y - py) <= rad * rad) RT.explored[y * W + x] = 1;
    }
}

/* ─────────────── achievements / toasts ─────────────── */
function unlock(id) {
    if (S.ach[id]) return;
    if (id === 'armed' && !fullArmor()) return;
    if (id === 'hooked' && !accHas('hook')) return;
    S.ach[id] = 1; sSave();
    var a = null; ACH.forEach(function (x) { if (x[0] === id) a = x; });
    if (a && RT) {
        var t = RT.root.querySelector('.tr-toast');
        t.innerHTML = '<b>Achievement unlocked</b><span>' + esc(a[1]) + '</span>';
        t.hidden = false; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
        RT.timers.push(setTimeout(function () { t.classList.remove('on'); t.hidden = true; }, 3200));
    }
}
function toast(msg) {
    if (!RT) return;
    var t = RT.root.querySelector('.tr-toast');
    t.innerHTML = '<span>' + esc(msg) + '</span>';
    t.hidden = false; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    RT.timers.push(setTimeout(function () { t.classList.remove('on'); t.hidden = true; }, 2800));
}

/* ─────────────── drawing ─────────────── */
function skyColor() {
    var t = S.time;
    function lc(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
    var day = [122, 178, 235], dusk = [214, 120, 70], night = [12, 14, 34], dawn = [110, 120, 180];
    if (t < DAY - 34) return day;
    if (t < DAY) return lc(day, dusk, (t - (DAY - 34)) / 34);
    if (t < DAY + 26) return lc(dusk, night, (t - DAY) / 26);
    if (t < CYCLE - 30) return night;
    if (t < CYCLE - 12) return lc(night, dawn, (t - (CYCLE - 30)) / 18);
    return lc(dawn, day, (t - (CYCLE - 12)) / 12);
}
function dayLight() {
    var t = S.time;
    if (t < DAY - 34) return 1;
    if (t < DAY) return 1 - 0.82 * (t - (DAY - 34)) / 34;
    if (t < CYCLE - 26) return 0.18;
    return 0.18 + 0.82 * (t - (CYCLE - 26)) / 26;
}
function draw() {
    var cv = RT.cv, host = RT.root;
    // The canvas now runs at NATIVE css resolution and every world unit is scaled up by RS, so a
    // tile gets a 16x16 art budget instead of 8x8 while staying the same size on screen.
    var cw = Math.max(360, host.clientWidth | 0), ch = Math.max(240, host.clientHeight | 0);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    var vw = cw / RS, vh = ch / RS;                    // visible world px
    var x = RT.x = cv.getContext('2d');
    x.setTransform(RS, 0, 0, RS, 0, 0);
    x.imageSmoothingEnabled = false;
    // smooth camera — but SNAP on the first frame / after a teleport, so it opens centered on the player
    var tgx = clamp(S.px - vw / 2, 0, W * TS - vw), tgy = clamp(S.py - vh / 2, 0, H * TS - vh);
    if (!RT.camReady) { RT.cam.x = tgx; RT.cam.y = tgy; RT.camReady = true; }
    else { RT.cam.x += (tgx - RT.cam.x) * 0.18; RT.cam.y += (tgy - RT.cam.y) * 0.18; }
    if (Math.abs(tgx - RT.cam.x) < 0.5) RT.cam.x = tgx; if (Math.abs(tgy - RT.cam.y) < 0.5) RT.cam.y = tgy;
    // land the camera on a whole device pixel: half-pixel offsets blur every baked sprite
    var cx = Math.round(RT.cam.x * RS) / RS, cy = Math.round(RT.cam.y * RS) / RS;

    drawSky(x, vw, vh, cx, cy);

    var x0 = Math.floor(cx / TS), y0 = Math.floor(cy / TS);
    var x1 = Math.min(W - 1, x0 + Math.ceil(vw / TS) + 1), y1 = Math.min(H - 1, y0 + Math.ceil(vh / TS) + 1);
    var lw = x1 - x0 + 1, lh = y1 - y0 + 1;
    var lg = computeLight(x0, y0, lw, lh, dayLight());
    var L = lg.L, LC = lg.col;

    // Terrain is the expensive layer (thousands of blits), so it is rendered into an offscreen
    // canvas that survives across frames and is re-cut only when the view scrolls off its margin
    // or the world is edited. Animated tiles and liquids are drawn live on top.
    blitTerrain(x, x0, y0, x1, y1, cx, cy, vw, vh);
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
        var idx = ty * W + tx, t = RT.w[idx], sx = tx * TS - cx, sy = ty * TS - cy;
        var lm = RT.lq[idx];
        if (lm > 0 && t === T_AIR) drawLiquid(x, sx, sy, lm, RT.lk[idx], RT.lq[(ty - 1) * W + tx], tx, ty);
        if (DYNTILE[t]) drawTile(x, t, sx, sy, tx, ty);
    }
    // mining cracks — a real spreading fracture, not a scratch
    if (RT.mineT.p > 0.1) {
        var mt = RT.w[RT.mineT.y * W + RT.mineT.x], mh = RT.mineHammer ? 0.5 : (HARD[mt] || 1);
        if ((mt || RT.mineHammer) && mh) {
            var frac = clamp(RT.mineT.p / mh, 0, 1);
            var mx0 = RT.mineT.x * TS - cx, my0 = RT.mineT.y * TS - cy;
            x.drawImage(crackArt(Math.min(3, Math.floor(frac * 4))), mx0, my0, TS, TS);
        }
    }
    if (RT.grapple) drawGrapple(x, cx, cy);
    RT.drops.forEach(function (d) { drawItemMini(x, d.id, d.x - cx, d.y - cy, d.c); });
    RT.shots.forEach(function (s) { drawShot(x, s, cx, cy); });
    RT.foes.forEach(function (f) { drawFoe(x, f, cx, cy); });
    RT.npcs.forEach(function (n) { drawNPC(x, n, cx, cy); });
    if (RT.boss) drawBoss(x, RT.boss, cx, cy);
    if (!RT.dead) drawPlayer(x, S.px - cx, S.py - cy);
    RT.parts.forEach(function (p) {
        var pr = (p.r || 1) * 0.5;
        x.globalAlpha = p.star ? 1 : clamp(p.t / 14, 0, 1);
        if (p.star) { x.fillStyle = 'rgba(255,248,190,.55)'; x.fillRect(p.x - cx - 0.5, p.y - cy - 4, 1, 8); }
        x.fillStyle = p.c; x.fillRect(p.x - cx - pr, p.y - cy - pr, pr * 2, pr * 2);
        x.globalAlpha = 1;
    });

    drawLighting(x, L, LC, x0, y0, lw, lh, cx, cy);
    // damage numbers
    x.font = 'bold 7px "Segoe UI", monospace'; x.textAlign = 'center';
    RT.dmgs.forEach(function (g) {
        x.globalAlpha = clamp(g.t / 20, 0, 1);
        x.fillStyle = 'rgba(0,0,0,.75)'; x.fillText(g.n, g.x - cx + 0.5, g.y - cy + 0.5);
        x.fillStyle = g.crit ? '#ffd83a' : '#ff9a3a'; x.fillText(g.n, g.x - cx, g.y - cy);
        x.globalAlpha = 1;
    });
    x.textAlign = 'left';
    // cursor tile
    if (!uiOpen()) {
        var m = mouseWorld(), htx = Math.floor(m.x / TS), hty = Math.floor(m.y / TS);
        var okr = inReach(htx, hty);
        x.strokeStyle = okr ? 'rgba(255,255,255,.55)' : 'rgba(255,90,90,.4)';
        x.lineWidth = 0.5;
        x.strokeRect(htx * TS - cx + 0.25, hty * TS - cy + 0.25, TS - 0.5, TS - 0.5);
        x.lineWidth = 1;
    }
    var d2 = S.py / TS;
    var depthT = d2 < 30 ? 'Space' : d2 < 66 ? 'Surface' : d2 < 96 ? 'Underground' : d2 < HELL ? 'Caverns' : 'Underworld';
    RT.root.querySelector('.tr-depth').textContent = depthT + ' · ' + (isNight() ? '🌙 Night' : '☀ Day') + ' ' + S.day + ' · ' + biomeLabel(biomeAtX(Math.floor(S.px / TS)));
    paintMini();
    if (RT.mapOpen && RT.anim % 8 === 0) paintMap();
}
/* Lighting used to be one flat rgba fill per tile, which both blocked the art into squares and
   let a torch's colour flood the whole cave orange. Now the light field is rasterised into a tiny
   canvas (one pixel per tile) and scaled up with smoothing: darkness stays neutral, and the colour
   comes back as a gentle additive bloom only where the light actually is. */
function drawLighting(x, L, LC, x0, y0, lw, lh, cx, cy) {
    var dx0 = x0 * TS - cx, dy0 = y0 * TS - cy, dw = lw * TS, dh = lh * TS;
    var lcv = RT.lightCv, glo = RT.glowCv;
    if (!lcv) { lcv = RT.lightCv = document.createElement('canvas'); glo = RT.glowCv = document.createElement('canvas'); }
    if (lcv.width !== lw || lcv.height !== lh) { lcv.width = glo.width = lw; lcv.height = glo.height = lh; }
    var lg2 = lcv.getContext('2d'), gg = glo.getContext('2d');
    // reuse the pixel buffers: allocating two of these every frame was enough garbage to make
    // the collector stall a frame every couple of seconds
    if (!RT.lightImg || RT.lightImg.width !== lw || RT.lightImg.height !== lh) {
        RT.lightImg = lg2.createImageData && lg2.createImageData(lw, lh);
        RT.glowImg = gg.createImageData && gg.createImageData(lw, lh);
    }
    var img = RT.lightImg, gim = RT.glowImg;
    if (!img || !img.data || !gim || !gim.data) {          // no ImageData (headless shim): flat fallback
        for (var ty2 = 0; ty2 < lh; ty2++) for (var tx2 = 0; tx2 < lw; tx2++) {
            var li2 = ty2 * lw + tx2, lv2 = L[li2];
            if (lv2 >= 0.98) continue;
            x.fillStyle = 'rgba(6,7,16,' + (1 - lv2).toFixed(2) + ')';
            x.fillRect((x0 + tx2) * TS - cx, (y0 + ty2) * TS - cy, TS, TS);
        }
        return;
    }
    var d = img.data, gd = gim.data;
    for (var i = 0, n = lw * lh; i < n; i++) {
        var lv = L[i], col = LC[i], o = i * 4;
        d[o] = 6; d[o + 1] = 7; d[o + 2] = 16; d[o + 3] = Math.round(clamp(1 - lv, 0, 1) * 255);
        if (col && lv > 0.12) {
            gd[o] = col[0]; gd[o + 1] = col[1]; gd[o + 2] = col[2];
            gd[o + 3] = Math.round(clamp((lv - 0.12) * 0.34, 0, 1) * 255);
        } else gd[o + 3] = 0;
    }
    lg2.putImageData(img, 0, 0); gg.putImageData(gim, 0, 0);
    x.imageSmoothingEnabled = true;
    x.drawImage(lcv, dx0, dy0, dw, dh);
    var prev = x.globalCompositeOperation;
    x.globalCompositeOperation = 'lighter';
    x.drawImage(glo, dx0, dy0, dw, dh);
    x.globalCompositeOperation = prev;
    x.imageSmoothingEnabled = false;
}
function biomeLabel(b) { return { forest: 'Forest', snow: 'Snow', desert: 'Desert', jungle: 'Jungle', corrupt: 'Corruption', ocean: 'Ocean' }[b] || 'Forest'; }

/* tiles that animate every frame and therefore cannot live in the terrain cache */
var DYNTILE = {};
[T_TORCH, T_FURNACE, T_HELLFORGE, T_HEARTC, T_MANAC].forEach(function (t) { DYNTILE[t] = 1; });
var TERR_MARGIN = 6;                     // tiles of slack around the viewport before a re-cut
function dirtyTerrain() { if (RT) RT.terrDirty = (RT.terrDirty || 0) + 1; }
/* one cell of the cached terrain layer */
function paintTerrainCell(g, tx, ty) {
    var sx = (tx - RT.terrX) * TS, sy = (ty - RT.terrY) * TS;
    g.clearRect(sx, sy, TS, TS);
    if (tx < 0 || tx >= W || ty < 0 || ty >= H) return;
    var idx = ty * W + tx, t = RT.w[idx], wl = RT.wall[idx];
    if (wl && (t === T_AIR || DYNTILE[t] || t === T_POT || t === T_CHEST || t === T_DOOR || t === T_DOOROPEN || t === T_PLATFORM || t === T_BOTTLE || STATION[t])) {
        g.drawImage(wallArt(wl), sx, sy, TS, TS);
        if (!RT.wall[(ty - 1) * W + tx]) { g.fillStyle = 'rgba(0,0,0,.30)'; g.fillRect(sx, sy, TS, 1); }
    }
    if (t === T_AIR || DYNTILE[t]) return;
    drawTile(g, t, sx, sy, tx, ty);
}
function terrCtx() {
    var g = RT.terr.getContext('2d');
    if (g.imageSmoothingEnabled !== undefined) g.imageSmoothingEnabled = false;
    g.setTransform(RS, 0, 0, RS, 0, 0);
    return g;
}
/* repaint a small rect of the cache in place — mining a block must never re-cut the whole layer */
function patchRect(ax, ay, bx, by) {
    if (!RT || !RT.terr) return;
    var g = terrCtx();
    var x0 = Math.max(ax, RT.terrX), x1 = Math.min(bx, RT.terrX + RT.terrTW - 1);
    var y0 = Math.max(ay, RT.terrY), y1 = Math.min(by, RT.terrY + RT.terrTH - 1);
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) paintTerrainCell(g, tx, ty);
    g.setTransform(1, 0, 0, 1, 0, 0);
}
function patchAround(tx, ty) { patchRect(tx - 1, ty - 1, tx + 1, ty + 1); }
function blitTerrain(x, x0, y0, x1, y1, cx, cy, vw, vh) {
    var needW = Math.min(W, Math.ceil(vw / TS) + 2 + TERR_MARGIN * 2);
    var needH = Math.min(H, Math.ceil(vh / TS) + 2 + TERR_MARGIN * 2);
    var ox = clamp(x0 - TERR_MARGIN, 0, Math.max(0, W - needW)), oy = clamp(y0 - TERR_MARGIN, 0, Math.max(0, H - needH));
    var forced = !RT.terr || RT.terrTW !== needW || RT.terrTH !== needH || RT.terrBuilt !== (RT.terrDirty || 0);
    var outside = !forced && (x0 < RT.terrX || y0 < RT.terrY || x1 > RT.terrX + needW - 1 || y1 > RT.terrY + needH - 1);
    if (forced) buildTerrain(ox, oy, needW, needH);
    else if (outside) scrollTerrain(ox, oy);
    if (RT.terr) x.drawImage(RT.terr, RT.terrX * TS - cx, RT.terrY * TS - cy, RT.terrTW * TS, RT.terrTH * TS);
}
/* the view walked off the cached area: shift the pixels we already have and only paint the
   newly exposed strips, so scrolling costs a couple of columns instead of four thousand tiles */
function scrollTerrain(ox, oy) {
    var dx = ox - RT.terrX, dy = oy - RT.terrY;
    if (!dx && !dy) return;
    if (Math.abs(dx) >= RT.terrTW || Math.abs(dy) >= RT.terrTH) { buildTerrain(ox, oy, RT.terrTW, RT.terrTH); return; }
    var g = RT.terr.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'copy';                 // self-blit: the spec snapshots the source
    g.drawImage(RT.terr, -dx * TS * RS, -dy * TS * RS);
    g.globalCompositeOperation = 'source-over';
    var oldX = RT.terrX, oldY = RT.terrY;
    RT.terrX = ox; RT.terrY = oy;
    if (dx > 0) patchRect(ox + RT.terrTW - dx, oy, ox + RT.terrTW - 1, oy + RT.terrTH - 1);
    else if (dx < 0) patchRect(ox, oy, ox - dx - 1, oy + RT.terrTH - 1);
    if (dy > 0) patchRect(ox, oy + RT.terrTH - dy, ox + RT.terrTW - 1, oy + RT.terrTH - 1);
    else if (dy < 0) patchRect(ox, oy, ox + RT.terrTW - 1, oy - dy - 1);
    RT.terrAt = RT.anim || 0;
}
function buildTerrain(ox, oy, tw, th) {
    if (!RT.terr) RT.terr = document.createElement('canvas');
    var cvw = tw * TS * RS, cvh = th * TS * RS;
    if (RT.terr.width !== cvw || RT.terr.height !== cvh) { RT.terr.width = cvw; RT.terr.height = cvh; }
    RT.terrX = ox; RT.terrY = oy; RT.terrTW = tw; RT.terrTH = th;
    var g = terrCtx();
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cvw, cvh); g.setTransform(RS, 0, 0, RS, 0, 0);
    for (var ty = oy; ty < oy + th; ty++) for (var tx = ox; tx < ox + tw; tx++) paintTerrainCell(g, tx, ty);
    g.setTransform(1, 0, 0, 1, 0, 0);
    RT.terrBuilt = RT.terrDirty || 0; RT.terrAt = RT.anim || 0;
}

/* ═══════════════ baked pixel art ═══════════════
   Tiles/objects are drawn ONCE into offscreen 16x16 canvases and blitted, so the art can be as
   detailed as we like without paying for it every frame. Everything is authored on a 16x16 grid
   (1 art pixel = 0.5 world units = 1 device pixel at RS=2). */
var TPX = 16;
var _tileArt = {}, _wallArt = {}, _crackArt = {}, _objArt = {};
function mkc(w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var g = c.getContext('2d'); if (g.imageSmoothingEnabled !== undefined) g.imageSmoothingEnabled = false;
    return { c: c, g: g };
}
// deterministic hash → the same tile always gets the same speckles
function hsh(a, b) { var n = (a * 374761393 + b * 668265263) | 0; n = (n ^ (n >> 13)) * 1274126177; return ((n ^ (n >> 16)) >>> 0) / 4294967296; }
function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = clamp(Math.round(r * k), 0, 255); g = clamp(Math.round(g * k), 0, 255); b = clamp(Math.round(b * k), 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
}
function grain(g, base, seed, n, alpha) {
    for (var i = 0; i < n; i++) {
        var h1 = hsh(seed, i), h2 = hsh(seed + 91, i);
        var px = Math.floor(h1 * TPX), py = Math.floor(h2 * TPX), s = h1 > 0.72 ? 2 : 1;
        g.globalAlpha = alpha * (0.55 + h2 * 0.45);
        g.fillStyle = shade(base, i % 2 ? 0.82 : 1.18);
        g.fillRect(px, py, s, 1);
    }
    g.globalAlpha = 1;
}
function tileArt(t) { if (!_tileArt[t]) _tileArt[t] = bakeTile(t); return _tileArt[t]; }
function wallArt(w) { if (!_wallArt[w]) _wallArt[w] = bakeWall(w); return _wallArt[w]; }
function crackArt(n) { if (!_crackArt[n]) _crackArt[n] = bakeCrack(n); return _crackArt[n]; }
function objArt(k) { if (!_objArt[k]) _objArt[k] = bakeObj(k); return _objArt[k]; }

function bakeTile(t) {
    var m = mkc(TPX, TPX), g = m.g;
    var col = TCOL[t] || ['#f0f', '#a0a', '#f8f'], base = col[0], dk = col[1], lt = col[2] || col[0];
    g.fillStyle = base; g.fillRect(0, 0, TPX, TPX);
    grain(g, base, t * 7 + 3, 46, 0.5);

    // ── soft interior shading: light from above-left, like the real tileset ──
    g.globalAlpha = 0.16; g.fillStyle = '#fff'; g.fillRect(0, 0, TPX, 2);
    g.globalAlpha = 0.13; g.fillStyle = '#000'; g.fillRect(0, TPX - 2, TPX, 2); g.fillRect(TPX - 2, 0, 2, TPX);
    g.globalAlpha = 1;

    if (t === T_STONE || t === T_EBON || t === T_SILT || t === T_ASH || t === T_OBSIDIAN) {
        // chunky rock facets + a crack or two
        g.globalAlpha = 0.5; g.fillStyle = shade(base, 1.25);
        g.fillRect(2, 2, 5, 4); g.fillRect(9, 7, 5, 4); g.fillRect(3, 10, 4, 3);
        g.globalAlpha = 0.55; g.fillStyle = shade(base, 0.72);
        g.fillRect(7, 3, 1, 5); g.fillRect(8, 8, 1, 4); g.fillRect(2, 9, 5, 1); g.fillRect(10, 12, 4, 1);
        g.globalAlpha = 1;
    }
    if (t === T_DIRT || t === T_MUD || t === T_CLAY) {
        g.globalAlpha = 0.45; g.fillStyle = shade(base, 1.2);
        g.fillRect(3, 3, 3, 2); g.fillRect(10, 5, 3, 2); g.fillRect(6, 10, 3, 2);
        g.globalAlpha = 0.4; g.fillStyle = shade(base, 0.75);
        g.fillRect(2, 7, 2, 2); g.fillRect(12, 10, 2, 2); g.fillRect(7, 2, 2, 1);
        g.globalAlpha = 1;
    }
    if (t === T_SAND) { g.globalAlpha = 0.5; for (var s = 0; s < 26; s++) { var hx = hsh(t + 5, s), hy = hsh(t + 61, s); g.fillStyle = hx > 0.5 ? shade(base, 1.15) : shade(base, 0.86); g.fillRect(Math.floor(hx * TPX), Math.floor(hy * TPX), 1, 1); } g.globalAlpha = 1; }
    if (t === T_SNOW) {
        g.globalAlpha = 0.5; g.fillStyle = '#c9d8ea';
        g.fillRect(3, 6, 3, 2); g.fillRect(9, 10, 3, 2); g.fillRect(6, 12, 2, 1);
        g.globalAlpha = 0.9; g.fillStyle = '#fff'; g.fillRect(2, 3, 2, 1); g.fillRect(11, 5, 2, 1);
        g.globalAlpha = 1;
    }
    if (t === T_ICE) {
        g.globalAlpha = 0.55; g.fillStyle = '#dff2ff';
        g.beginPath(); g.moveTo(2, 13); g.lineTo(9, 2); g.lineTo(12, 2); g.lineTo(5, 13); g.closePath(); g.fill();
        g.globalAlpha = 0.35; g.fillRect(10, 8, 4, 1); g.fillRect(3, 4, 3, 1);
        g.globalAlpha = 1;
    }
    if (t === T_PLANK || t === T_PLATFORM) {
        // real plank grain + end nails
        g.globalAlpha = 0.55; g.fillStyle = shade(base, 0.7);
        g.fillRect(0, 5, TPX, 1); g.fillRect(0, 11, TPX, 1);
        g.globalAlpha = 0.35; g.fillStyle = shade(base, 1.25);
        g.fillRect(0, 6, TPX, 1); g.fillRect(0, 12, TPX, 1); g.fillRect(0, 0, TPX, 1);
        g.globalAlpha = 0.5; g.fillStyle = shade(base, 0.55);
        g.fillRect(2, 2, 1, 1); g.fillRect(13, 2, 1, 1); g.fillRect(2, 8, 1, 1); g.fillRect(13, 8, 1, 1);
        g.globalAlpha = 1;
    }
    if (t === T_COBWEB) {
        g.clearRect(0, 0, TPX, TPX);
        g.strokeStyle = 'rgba(226,232,242,.85)'; g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, 0); g.lineTo(TPX, TPX); g.moveTo(TPX, 0); g.lineTo(0, TPX);
        g.moveTo(8, 0); g.lineTo(8, TPX); g.moveTo(0, 8); g.lineTo(TPX, 8);
        g.stroke();
        g.strokeStyle = 'rgba(226,232,242,.55)';
        g.beginPath(); g.moveTo(8, 3); g.lineTo(13, 8); g.lineTo(8, 13); g.lineTo(3, 8); g.closePath(); g.stroke();
        g.beginPath(); g.moveTo(8, 6); g.lineTo(10, 8); g.lineTo(8, 10); g.lineTo(6, 8); g.closePath(); g.stroke();
    }
    if (t === T_CLOUD) {
        g.clearRect(0, 0, TPX, TPX);
        g.fillStyle = '#fbfdff'; g.beginPath();
        g.arc(5, 9, 5, 0, 7); g.arc(11, 8, 5, 0, 7); g.arc(8, 12, 5, 0, 7); g.fill();
        g.globalAlpha = 0.5; g.fillStyle = '#c6d4e8'; g.fillRect(2, 12, 12, 2); g.globalAlpha = 1;
    }
    if (t === T_HELLSTONE) {
        g.globalAlpha = 0.9; g.fillStyle = '#ff7a2a';
        g.fillRect(3, 4, 1, 5); g.fillRect(4, 8, 3, 1); g.fillRect(10, 3, 1, 4); g.fillRect(8, 11, 4, 1);
        g.globalAlpha = 0.55; g.fillStyle = '#ffd28a';
        g.fillRect(3, 5, 1, 2); g.fillRect(10, 4, 1, 2);
        g.globalAlpha = 1;
    }
    if (t === T_GRASS || t === T_JGRASS || t === T_CGRASS) {
        // a real grass cap over dirt, not a flat green square
        var dirtc = t === T_JGRASS ? TCOL[T_MUD][0] : t === T_CGRASS ? '#4a3a5c' : TCOL[T_DIRT][0];
        g.fillStyle = dirtc; g.fillRect(0, 0, TPX, TPX);
        grain(g, dirtc, t * 11 + 2, 40, 0.45);
        g.fillStyle = base; g.fillRect(0, 0, TPX, 6);
        g.fillStyle = lt; g.fillRect(0, 0, TPX, 2);
        g.globalAlpha = 0.7; g.fillStyle = dk;
        for (var b2 = 0; b2 < TPX; b2 += 3) g.fillRect(b2, 6, 2, 1 + (hsh(t, b2) > 0.5 ? 1 : 0));
        g.globalAlpha = 1;
    }
    if (ORE_ITEM[t]) {
        // ore veins: nuggets with a rim light and a drop shadow so the metal reads at a glance
        var oc = col[0], nug = [[3, 4], [9, 3], [6, 9], [11, 10]];
        for (var n2 = 0; n2 < nug.length; n2++) {
            var nx = nug[n2][0], ny = nug[n2][1], sz = n2 % 2 ? 3 : 4;
            g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(nx + 1, ny + 1, sz, sz);
            g.fillStyle = oc; g.fillRect(nx, ny, sz, sz);
            g.fillStyle = shade(oc, 1.45); g.fillRect(nx, ny, sz - 1, 1); g.fillRect(nx, ny, 1, sz - 1);
            g.fillStyle = shade(oc, 0.65); g.fillRect(nx + sz - 1, ny + 1, 1, sz - 1);
            g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(nx + 1, ny + 1, 1, 1);
        }
    }
    if (GEMCOL[t]) {
        // a faceted crystal, not a colored square
        var gc = GEMCOL[t];
        g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.moveTo(8, 3); g.lineTo(13, 8); g.lineTo(8, 14); g.lineTo(3, 8); g.closePath(); g.fill();
        g.fillStyle = gc; g.beginPath(); g.moveTo(8, 2); g.lineTo(12, 7); g.lineTo(8, 13); g.lineTo(4, 7); g.closePath(); g.fill();
        g.fillStyle = shade(gc, 1.5); g.beginPath(); g.moveTo(8, 2); g.lineTo(12, 7); g.lineTo(8, 7); g.closePath(); g.fill();
        g.fillStyle = shade(gc, 0.6); g.beginPath(); g.moveTo(8, 7); g.lineTo(12, 7); g.lineTo(8, 13); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(7, 4, 1, 2); g.fillRect(6, 6, 1, 1);
    }
    return m.c;
}
function bakeWall(wl) {
    var m = mkc(TPX, TPX), g = m.g, base = WLCOL[wl] || '#241a14';
    g.fillStyle = base; g.fillRect(0, 0, TPX, TPX);
    // recessed brick coursing reads instantly as "background wall"
    g.globalAlpha = 0.5; g.fillStyle = shade(base, 0.62);
    g.fillRect(0, 7, TPX, 1); g.fillRect(0, 15, TPX, 1); g.fillRect(7, 0, 1, 8); g.fillRect(3, 8, 1, 8);
    g.globalAlpha = 0.35; g.fillStyle = shade(base, 1.5);
    g.fillRect(0, 8, TPX, 1); g.fillRect(0, 0, TPX, 1); g.fillRect(8, 0, 1, 7); g.fillRect(4, 8, 1, 7);
    g.globalAlpha = 1;
    grain(g, base, wl * 13 + 5, 26, 0.4);
    return m.c;
}
function bakeCrack(n) {
    var m = mkc(TPX, TPX), g = m.g;
    g.strokeStyle = 'rgba(0,0,0,.75)'; g.lineWidth = 1;
    var segs = [[[8, 1], [7, 6], [9, 9]], [[3, 3], [6, 7]], [[13, 5], [9, 8]], [[8, 9], [6, 14]], [[9, 9], [13, 13]], [[2, 11], [6, 10]]];
    for (var i = 0; i <= n * 2 + 1 && i < segs.length; i++) {
        g.beginPath(); g.moveTo(segs[i][0][0], segs[i][0][1]);
        for (var p = 1; p < segs[i].length; p++) g.lineTo(segs[i][p][0], segs[i][p][1]);
        g.stroke();
    }
    return m.c;
}
/* objects: furniture and props, authored at 16x16 */
function bakeObj(k) {
    var m = mkc(TPX, TPX), g = m.g;
    function rect(a, b, w2, h2, c) { g.fillStyle = c; g.fillRect(a, b, w2, h2); }
    if (k === 'bench') {
        rect(0, 5, 16, 3, '#a97a46'); rect(0, 5, 16, 1, '#c99a5e'); rect(0, 7, 16, 1, '#7f5a33');
        rect(2, 8, 2, 8, '#8a6238'); rect(12, 8, 2, 8, '#8a6238');
        rect(2, 8, 1, 8, '#a97a46'); rect(12, 8, 1, 8, '#a97a46');
        rect(4, 9, 8, 1, '#7f5a33');
        rect(5, 1, 2, 4, '#9aa0aa'); rect(9, 2, 4, 2, '#8a6238');   // a saw and a plank on top
        rect(5, 1, 1, 4, '#c6ccd6');
    } else if (k === 'furnace' || k === 'hellforge') {
        var body = k === 'hellforge' ? '#5e3a38' : '#6b6b74', trim = k === 'hellforge' ? '#7d4a44' : '#83838d';
        rect(0, 2, 16, 14, body); rect(0, 2, 16, 1, trim); rect(0, 15, 16, 1, shade(body, 0.7));
        rect(1, 4, 14, 1, shade(body, 0.75)); rect(1, 10, 14, 1, shade(body, 0.75));
        rect(3, 6, 10, 7, '#2a1a14');                                 // the mouth
        rect(4, 11, 8, 2, '#3a2018');
        rect(2, 0, 3, 2, trim); rect(11, 0, 3, 2, trim);              // chimney stubs
    } else if (k === 'anvil') {
        rect(2, 4, 12, 3, '#55555f'); rect(2, 4, 12, 1, '#6e6e7a');
        rect(6, 7, 4, 4, '#4a4a54'); rect(3, 11, 10, 4, '#55555f');
        rect(3, 11, 10, 1, '#6e6e7a'); rect(3, 14, 10, 1, '#3a3a42');
        rect(0, 5, 2, 1, '#55555f'); rect(14, 5, 2, 1, '#55555f');    // horn + heel
        rect(4, 5, 6, 1, 'rgba(255,255,255,.18)');
    } else if (k === 'table') {
        rect(0, 4, 16, 3, '#a97a46'); rect(0, 4, 16, 1, '#c99a5e'); rect(0, 6, 16, 1, '#7f5a33');
        rect(1, 7, 2, 9, '#8a6238'); rect(13, 7, 2, 9, '#8a6238');
        rect(1, 7, 1, 9, '#a97a46'); rect(13, 7, 1, 9, '#a97a46');
    } else if (k === 'chair') {
        rect(4, 1, 3, 9, '#8a6238'); rect(4, 1, 1, 9, '#a97a46');
        rect(4, 9, 8, 2, '#a97a46'); rect(4, 9, 8, 1, '#c99a5e');
        rect(5, 11, 2, 5, '#8a6238'); rect(10, 11, 2, 5, '#8a6238');
    } else if (k === 'door') {
        rect(1, 0, 14, 16, '#8a6238'); rect(1, 0, 14, 1, '#a97a46'); rect(1, 15, 14, 1, '#5f4426');
        rect(3, 2, 10, 5, '#7a5530'); rect(3, 9, 10, 5, '#7a5530');
        rect(3, 2, 10, 1, '#5f4426'); rect(3, 9, 10, 1, '#5f4426');
        rect(11, 7, 2, 2, '#e0c060'); rect(11, 7, 1, 1, '#fff0b0');   // handle
    } else if (k === 'dooropen') {
        rect(0, 0, 5, 16, '#8a6238'); rect(0, 0, 5, 1, '#a97a46'); rect(4, 0, 1, 16, '#5f4426');
        rect(1, 3, 3, 4, '#7a5530'); rect(1, 9, 3, 4, '#7a5530');
    } else if (k === 'chest') {
        rect(1, 4, 14, 11, '#8a5a2a'); rect(1, 4, 14, 4, '#a87038');
        rect(1, 4, 14, 1, '#c08a4a'); rect(1, 8, 14, 1, '#6b4420');
        rect(1, 14, 14, 1, '#5c3a1c');
        rect(2, 5, 1, 9, '#c08a4a'); rect(13, 5, 1, 9, '#6b4420');
        rect(6, 7, 4, 4, '#e0b83a'); rect(6, 7, 4, 1, '#fff0b0');     // lock plate
        rect(7, 9, 2, 2, '#6b4420');
    } else if (k === 'pot') {
        rect(4, 2, 8, 2, '#b07f42'); rect(3, 4, 10, 9, '#a8763a');
        rect(4, 13, 8, 2, '#8a5f2e');
        rect(4, 4, 2, 8, 'rgba(255,255,255,.22)');                    // rim light
        rect(10, 5, 2, 7, 'rgba(0,0,0,.22)');
        rect(3, 7, 10, 1, '#8a5f2e'); rect(5, 6, 2, 1, '#c08f52');
    } else if (k === 'heartc') {
        rect(3, 4, 4, 4, '#e04a6a'); rect(9, 4, 4, 4, '#e04a6a');
        rect(2, 6, 12, 4, '#e04a6a'); rect(4, 10, 8, 3, '#e04a6a'); rect(6, 13, 4, 2, '#e04a6a');
        rect(4, 5, 2, 2, '#ff9ab0'); rect(9, 5, 1, 1, '#ff9ab0');
        rect(5, 11, 5, 1, '#a82a48'); rect(11, 7, 2, 2, '#a82a48');
    } else if (k === 'manac') {
        rect(7, 1, 2, 14, '#4a6ad8'); rect(1, 7, 14, 2, '#4a6ad8');
        rect(5, 5, 6, 6, '#4a6ad8'); rect(6, 4, 4, 8, '#5f80ea'); rect(4, 6, 8, 4, '#5f80ea');
        rect(7, 3, 2, 2, '#a0c0ff'); rect(6, 6, 2, 2, '#c8d8ff');
    } else if (k === 'bottle') {
        rect(6, 2, 4, 3, '#9fc6d8'); rect(5, 5, 6, 8, '#b0d8e8');
        rect(4, 9, 8, 5, '#b0d8e8'); rect(4, 13, 8, 2, '#8fb4c6');
        rect(5, 10, 2, 4, 'rgba(255,255,255,.45)');
        rect(6, 1, 4, 1, '#7f5a33');
    } else if (k === 'sapling') {
        rect(7, 8, 2, 8, '#7a5228'); rect(4, 4, 8, 4, '#4aa03a'); rect(6, 2, 4, 3, '#5db44a');
    }
    return m.c;
}

function drawSky(x, vw, vh, cx, cy) {
    var sk = skyColor(), dl = dayLight();
    var skKey = (sk[0] | 0) + ':' + (sk[1] | 0) + ':' + (sk[2] | 0) + ':' + (vh | 0);
    if (RT.skyKey !== skKey) {
        var grd = x.createLinearGradient(0, 0, 0, vh);
        grd.addColorStop(0, 'rgb(' + (sk[0] * 0.74 | 0) + ',' + (sk[1] * 0.78 | 0) + ',' + (sk[2] | 0) + ')');
        grd.addColorStop(0.65, 'rgb(' + (sk[0] | 0) + ',' + (sk[1] | 0) + ',' + (sk[2] | 0) + ')');
        grd.addColorStop(1, 'rgb(' + Math.min(255, sk[0] * 1.12) + ',' + Math.min(255, sk[1] * 1.08) + ',' + Math.min(255, sk[2] * 1.02) + ')');
        RT.skyGrad = grd; RT.skyKey = skKey;
    }
    x.fillStyle = RT.skyGrad; x.fillRect(0, 0, vw, vh);
    if (cy > 40 * TS) { var u = clamp((cy - 40 * TS) / (60 * TS), 0, 1); x.fillStyle = 'rgba(8,7,14,' + (u * 0.85).toFixed(2) + ')'; x.fillRect(0, 0, vw, vh); }
    if (dl < 0.55) {
        for (var st = 0; st < 70; st++) {
            var sx2 = (st * 97 + 17) % vw, sy2 = (st * 61 + (st % 5) * 23) % Math.floor(vh * 0.62);
            var tw = 0.55 + 0.45 * Math.sin((RT.anim || 0) / 22 + st);
            x.globalAlpha = (0.85 - dl) * tw; x.fillStyle = st % 7 ? '#fff' : '#cfe0ff';
            x.fillRect(sx2, sy2, 0.5, 0.5);
        }
        x.globalAlpha = 1;
    }
    var arcT = isNight() ? (S.time - DAY) / NIGHT : S.time / DAY;
    var ox = vw * arcT, oy2 = vh * 0.28 - Math.sin(arcT * Math.PI) * vh * 0.2;
    if (isNight()) {
        x.fillStyle = 'rgba(232,232,244,.20)'; x.beginPath(); x.arc(ox, oy2, 10, 0, 7); x.fill();
        x.fillStyle = '#e8e8f4'; x.beginPath(); x.arc(ox, oy2, 6, 0, 7); x.fill();
        x.fillStyle = 'rgba(190,190,210,.65)'; x.beginPath(); x.arc(ox - 2, oy2 + 1.5, 1.4, 0, 7); x.arc(ox + 2, oy2 - 1, 1, 0, 7); x.fill();
    } else {
        x.fillStyle = 'rgba(255,224,122,.22)'; x.beginPath(); x.arc(ox, oy2, 12, 0, 7); x.fill();
        x.fillStyle = '#ffe07a'; x.beginPath(); x.arc(ox, oy2, 7, 0, 7); x.fill();
        x.fillStyle = '#fff6cc'; x.beginPath(); x.arc(ox, oy2, 4, 0, 7); x.fill();
    }
    // layered parallax clouds
    for (var lay = 0; lay < 2; lay++) {
        x.globalAlpha = (lay ? 0.34 : 0.6) * dl + 0.08; x.fillStyle = '#fff';
        for (var c = 0; c < 6; c++) {
            var sp = lay ? 0.12 : 0.28;
            var cxp = (((c * 150 + lay * 70 + (RT.anim || 0) * (lay ? 0.02 : 0.05) - cx * sp) % (vw + 160)) + vw + 160) % (vw + 160) - 80;
            var cyp = (lay ? 14 : 30) + (c % 3) * 20, w2 = lay ? 22 : 32, h2 = lay ? 5 : 7;
            x.fillRect(cxp, cyp, w2, h2); x.fillRect(cxp + 5, cyp - 3.5, w2 * 0.55, h2 * 0.8);
            x.fillRect(cxp + w2 * 0.5, cyp - 2, w2 * 0.4, h2 * 0.7);
        }
    }
    x.globalAlpha = 1;
    // distant treeline / hills
    var hillY = vh - (46 * TS - cy) * 0.4;
    x.fillStyle = 'rgba(38,64,48,' + (0.4 * dl + 0.12) + ')';
    for (var h = -40; h < vw + 40; h += 34) {
        var hy = hillY + Math.sin((h + cx * 0.3) / 55) * 12;
        x.beginPath(); x.moveTo(h - 18, vh); x.lineTo(h, hy); x.lineTo(h + 18, vh); x.fill();
    }
}
function sk2rgb(sk) { return 'rgb(' + (sk[0] | 0) + ',' + (sk[1] | 0) + ',' + (sk[2] | 0) + ')'; }
function drawLiquid(x, sx, sy, m, kind, above, tx, ty) {
    var full = above > 4, lvl = full ? TS : Math.max(0.5, m / LMAX * TS);
    var top = sy + (TS - lvl);
    if (kind === LQ_LAVA) {
        var pulse = 0.5 + 0.5 * Math.sin(((RT.anim || 0) + tx * 9 + ty * 5) / 16);
        x.fillStyle = 'rgba(214,64,16,.95)'; x.fillRect(sx, top, TS, lvl);
        x.globalAlpha = 0.35 + pulse * 0.35; x.fillStyle = '#ff8a2a'; x.fillRect(sx, top, TS, lvl); x.globalAlpha = 1;
        if (!full) { x.fillStyle = '#ffc46a'; x.fillRect(sx, top, TS, 0.5); }
        x.globalAlpha = 0.5; x.fillStyle = '#ffe9a0';
        x.fillRect(sx + 1.5 + Math.sin(((RT.anim || 0) + tx * 13) / 20), top + lvl * 0.45, 1, 0.5);
        x.globalAlpha = 1;
    } else {
        // a wavy surface line makes water read as water instead of a blue box
        var wob = full ? 0 : Math.sin(((RT.anim || 0) / 14) + tx * 0.9) * 0.4;
        x.fillStyle = 'rgba(44,102,196,.62)'; x.fillRect(sx, top + wob, TS, lvl - wob);
        x.fillStyle = 'rgba(96,160,235,.35)'; x.fillRect(sx, top + wob, TS, Math.min(lvl, 2));
        if (!full) { x.fillStyle = 'rgba(178,222,255,.8)'; x.fillRect(sx, top + wob, TS, 0.5); }
        x.globalAlpha = 0.3; x.fillStyle = '#cfe8ff';
        x.fillRect(sx + 2, top + wob + 1.5, 1.5, 0.5); x.fillRect(sx + 5.5, top + wob + 3, 1, 0.5);
        x.globalAlpha = 1;
    }
}
function drawTile(x, t, sx, sy, tx, ty) {
    if (t === T_TORCH) return drawTorch(x, sx, sy);
    if (t === T_FURNACE || t === T_HELLFORGE) return drawFurnace(x, sx, sy, t === T_HELLFORGE);
    if (t === T_BENCH) return drawBench(x, sx, sy);
    if (t === T_ANVIL) return drawAnvil(x, sx, sy);
    if (t === T_TABLE) return x.drawImage(objArt('table'), sx, sy, TS, TS);
    if (t === T_CHAIR) return x.drawImage(objArt('chair'), sx, sy, TS, TS);
    if (t === T_DOOR) return x.drawImage(objArt('door'), sx, sy, TS, TS);
    if (t === T_DOOROPEN) return x.drawImage(objArt('dooropen'), sx, sy, TS, TS);
    if (t === T_BOTTLE) return x.drawImage(objArt('bottle'), sx, sy, TS, TS);
    if (t === T_SAPLING) return x.drawImage(objArt('sapling'), sx, sy, TS, TS);
    if (t === T_POT) return drawPot(x, sx, sy);
    if (t === T_HEARTC) return drawHeart(x, sx, sy);
    if (t === T_MANAC) return drawManaC(x, sx, sy);
    if (t === T_CHEST) return drawChest(x, sx, sy);
    if (t === T_TRUNK) return drawTrunk(x, sx, sy, tx, ty);
    if (t === T_LEAF) return drawLeaf(x, sx, sy, tx, ty);
    if (t === T_PLATFORM) {
        x.drawImage(tileArt(T_PLATFORM), sx, sy - 5, TS, TS);
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(sx, sy + 2.5, TS, 0.5);
        return;
    }
    x.drawImage(tileArt(t), sx, sy, TS, TS);

    // ── edge lighting from the neighbours: this is what makes a tile field readable ──
    var up = RT.w[(ty - 1) * W + tx], dn = RT.w[(ty + 1) * W + tx];
    var lf = tx > 0 ? RT.w[ty * W + tx - 1] : t, rt = tx < W - 1 ? RT.w[ty * W + tx + 1] : t;
    var openU = !SOLID[up], openD = !SOLID[dn], openL = !SOLID[lf], openR = !SOLID[rt];
    if (openU) { x.fillStyle = 'rgba(255,255,255,.30)'; x.fillRect(sx, sy, TS, 0.5); }
    if (openD) { x.fillStyle = 'rgba(0,0,0,.40)'; x.fillRect(sx, sy + TS - 0.5, TS, 0.5); }
    if (openL) { x.fillStyle = 'rgba(255,255,255,.13)'; x.fillRect(sx, sy, 0.5, TS); }
    if (openR) { x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(sx + TS - 0.5, sy, 0.5, TS); }
    // grass spills over the lip of an exposed block
    if ((t === T_GRASS || t === T_JGRASS || t === T_CGRASS) && openU) {
        var gcol = (TCOL[t] || [])[2] || '#63c04a';
        x.fillStyle = gcol;
        var h1 = hsh(tx, ty), h2 = hsh(tx + 7, ty + 3);
        x.fillRect(sx + 1, sy - 1.5 - h1, 0.5, 1.5 + h1);
        x.fillRect(sx + 3.5, sy - 1 - h2 * 0.8, 0.5, 1 + h2);
        x.fillRect(sx + 6, sy - 1, 0.5, 1);
    }
    if (t === T_HELLSTONE) {   // hellstone glows into the air beside it
        x.globalAlpha = 0.18; x.fillStyle = '#ff7a2a';
        if (openU) x.fillRect(sx, sy - 1.5, TS, 1.5);
        if (openD) x.fillRect(sx, sy + TS, TS, 1.5);
        x.globalAlpha = 1;
    }
}
function drawTrunk(x, sx, sy, tx, ty) {
    var barkA = '#7a5228', barkB = '#5f3f1f', barkC = '#8c6030';
    x.fillStyle = barkA; x.fillRect(sx + 1, sy, TS - 2, TS);
    x.fillStyle = barkC; x.fillRect(sx + 1, sy, 1.5, TS);
    x.fillStyle = barkB; x.fillRect(sx + TS - 2.5, sy, 1.5, TS);
    for (var i = 0; i < 3; i++) { var hh = hsh(tx, ty + i); x.fillStyle = hh > 0.5 ? barkB : barkC; x.fillRect(sx + 2 + hh * 3, sy + i * 3 + 0.5, 1, 1.5); }
    // a branch stub every few tiles
    if ((tx * 3 + ty) % 5 === 0) { x.fillStyle = barkA; x.fillRect(sx + ((tx + ty) % 2 ? TS - 1.5 : 0), sy + 2, 1.5, 1.5); }
}
function drawLeaf(x, sx, sy, tx, ty) {
    var a = '#3a8a30', b = '#2f7027', c = '#4aa03a';
    x.fillStyle = a; x.fillRect(sx, sy, TS, TS);
    for (var i = 0; i < 7; i++) {
        var h1 = hsh(tx * 3 + i, ty), h2 = hsh(tx, ty * 3 + i);
        x.fillStyle = h1 > 0.55 ? c : b;
        x.fillRect(sx + h1 * (TS - 2), sy + h2 * (TS - 2), 1.5, 1.5);
    }
    x.fillStyle = 'rgba(255,255,255,.10)'; x.fillRect(sx, sy, TS, 0.5);
}

var COL_TORCH = [255, 150, 40], COL_LAVA = [255, 120, 30], COL_HELL = [255, 90, 40], COL_FORGE = [255, 150, 60], COL_MANA = [120, 150, 255];
function computeLight(x0, y0, lw, lh, dl) {
    // reuse the light buffers across frames — a fresh Float32Array plus a 4k-element array every
    // frame was the single biggest source of garbage, and it showed up as periodic frame stalls
    var n = lw * lh;
    if (!RT.lbufL || RT.lbufN !== n) { RT.lbufL = new Float32Array(n); RT.lbufC = new Array(n); RT.lbufN = n; }
    var L = RT.lbufL, col = RT.lbufC, wall = RT.wall, w = RT.w;
    L.fill(0);
    for (var ci = 0; ci < n; ci++) col[ci] = null;
    for (var tx = 0; tx < lw; tx++) {
        var open = true, wx = x0 + tx;
        for (var wy = 0; wy < y0; wy++) if (SOLID[w[wy * W + wx]]) { open = false; break; }
        for (var ty = 0; ty < lh; ty++) {
            var gy = y0 + ty, gi = gy * W + wx, wt = w[gi], i = ty * lw + tx;
            if (open && SOLID[wt]) open = false;
            var skyOpen = open && wall[gi] === WL_NONE;
            if (skyOpen) L[i] = dl;
            if (wt === T_TORCH) { L[i] = 1; col[i] = COL_TORCH; }
            else if (RT.lk[gi] === LQ_LAVA && RT.lq[gi] > 0) { L[i] = Math.max(L[i], 0.8); col[i] = COL_LAVA; }
            else if (wt === T_HELLSTONE) { L[i] = Math.max(L[i], 0.4); col[i] = COL_HELL; }
            else if (wt === T_FURNACE || wt === T_HELLFORGE) { L[i] = Math.max(L[i], 0.72); col[i] = COL_FORGE; }
            else if (wt === T_HEARTC) L[i] = Math.max(L[i], 0.5);
            else if (wt === T_MANAC) { L[i] = Math.max(L[i], 0.5); col[i] = COL_MANA; }
            else if (GEMCOL[wt]) L[i] = Math.max(L[i], 0.35);
        }
    }
    var pxl = Math.floor((S.px + 5) / TS) - x0, pyl = Math.floor((S.py + 10) / TS) - y0, pg = S.buffs.shine ? 0.85 : 0.42;
    if (pxl >= 0 && pxl < lw && pyl >= 0 && pyl < lh) L[pyl * lw + pxl] = Math.max(L[pyl * lw + pxl], pg);
    // a whisper of ambient: pitch black hides the tile art entirely, and you cannot mine what you
    // cannot see. Deep caves stay moody, they just stop being a black rectangle.
    for (var a = 0, an = lw * lh; a < an; a++) if (L[a] < 0.085) L[a] = 0.085;
    for (var pass = 0; pass < 7; pass++) {
        for (var y = 0; y < lh; y++) for (var xx = 0; xx < lw; xx++) {
            var ii = y * lw + xx, f = SOLID[w[(y0 + y) * W + (x0 + xx)]] ? 0.6 : 0.82, best = L[ii], bc = col[ii], nv;
            if (xx > 0)      { nv = L[ii - 1] * f;  if (nv > best) { best = nv; if (col[ii - 1]) bc = col[ii - 1]; } }
            if (xx < lw - 1) { nv = L[ii + 1] * f;  if (nv > best) { best = nv; if (col[ii + 1]) bc = col[ii + 1]; } }
            if (y > 0)       { nv = L[ii - lw] * f; if (nv > best) { best = nv; if (col[ii - lw]) bc = col[ii - lw]; } }
            if (y < lh - 1)  { nv = L[ii + lw] * f; if (nv > best) { best = nv; if (col[ii + lw]) bc = col[ii + lw]; } }
            L[ii] = best; if (bc && !col[ii]) col[ii] = bc;
        }
    }
    return { L: L, col: col };
}

/* ─────────────── sprites (all drawn on the 0.5-unit art grid) ─────────────── */
var SKIN = '#e9c6a0', SKIN_D = '#c99b74';
function drawPlayer(x, px2, py2) {
    if (RT.iframe > 0 && (RT.anim >> 2) % 2) return;
    var walking = RT.ground && Math.abs(RT.vx) > 0.3;
    var ph = walking ? (RT.anim >> 3) % 4 : 0;              // 4-frame walk cycle
    var lift = [0, 1, 0, -1][ph] * 0.5, f = RT.face;
    var head = S.arm[0] ? tintOf(S.arm[0].id) : null;
    var chest = S.arm[1] ? tintOf(S.arm[1].id) : null;
    var legs = S.arm[2] ? tintOf(S.arm[2].id) : null;
    var shirt = chest || '#d81e05', pants = legs || '#31518c';
    var bob = walking ? (ph === 1 || ph === 3 ? 0.5 : 0) : 0;
    var X = px2, Y = py2 + bob;

    // back arm first so it reads behind the torso
    x.fillStyle = shade(shirt, 0.75); x.fillRect(X + (f > 0 ? 1 : 6.5), Y + 7.5, 2.5, 4.5);
    // legs
    x.fillStyle = pants;
    x.fillRect(X + 2, Y + 13, 3, 6.5 - lift); x.fillRect(X + 5.5, Y + 13, 3, 6.5 + lift);
    x.fillStyle = shade(pants, 0.72); x.fillRect(X + 2, Y + 18.5 - lift, 3, 1); x.fillRect(X + 5.5, Y + 18.5 + lift, 3, 1);
    x.fillStyle = '#4a3428';                                 // shoes
    x.fillRect(X + 1.5, Y + 19 - lift, 3.5, 1); x.fillRect(X + 5.5, Y + 19 + lift, 3.5, 1);
    // torso
    x.fillStyle = shirt; x.fillRect(X + 1.5, Y + 7, 7, 6.5);
    x.fillStyle = shade(shirt, 1.22); x.fillRect(X + 1.5, Y + 7, 7, 1);
    x.fillStyle = shade(shirt, 0.72); x.fillRect(X + 1.5, Y + 12.5, 7, 1);
    if (chest) { x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(X + 2, Y + 8, 1, 4); }   // armor sheen
    // head
    x.fillStyle = SKIN; x.fillRect(X + 2, Y + 2.5, 6, 5);
    x.fillStyle = SKIN_D; x.fillRect(X + 2, Y + 6.5, 6, 1);
    x.fillStyle = head || '#4a3020';                          // hair / helm
    x.fillRect(X + 1.5, Y + 1, 7, 2.5); x.fillRect(X + (f > 0 ? 1.5 : 7), Y + 3, 1.5, 2);
    if (head) { x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(X + 2, Y + 1, 5, 0.5); }
    x.fillStyle = '#2b2b33';                                  // eye
    x.fillRect(X + (f > 0 ? 5.5 : 2.5), Y + 4, 1.5, 1.5);
    x.fillStyle = '#fff'; x.fillRect(X + (f > 0 ? 6 : 3), Y + 4, 0.5, 0.5);
    // front arm + held item
    var h = held(), def = h ? ITEMS[h.id] : null;
    var armX = X + (f > 0 ? 7 : 1), swing = RT.swing > 0;
    x.fillStyle = shirt; x.fillRect(armX, Y + 7.5, 2.5, swing ? 3 : 4.5);
    x.fillStyle = SKIN; x.fillRect(armX, Y + (swing ? 10 : 11.5), 2.5, 1.5);
    if (def) drawHeldItem(x, def, h.id, X, Y, f, swing);
}
function drawHeldItem(x, def, id, X, Y, f, swinging) {
    var k = def.kind;
    if (k === 'sword' && swinging) {
        var t0 = (12 - RT.swing) / 12, a0 = f > 0 ? -1.2 + t0 * 2.0 : Math.PI + 1.2 - t0 * 2.0;
        var cxp = X + 5, cyp = Y + 9, len = 11;
        x.save(); x.translate(cxp, cyp); x.rotate(a0);
        x.fillStyle = '#6b4a2a'; x.fillRect(0, -0.75, 3, 1.5);            // grip
        x.fillStyle = '#c8a24a'; x.fillRect(2.5, -2, 1, 4);               // guard
        var blade = miniColor(id);
        x.fillStyle = blade; x.fillRect(3.5, -1, len, 2);
        x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(3.5, -1, len, 0.5);
        x.fillStyle = shade(blade, 0.65); x.fillRect(3.5, 0.5, len, 0.5);
        x.restore();
        x.strokeStyle = 'rgba(235,240,255,.32)'; x.lineWidth = 1.5;
        x.beginPath(); x.arc(cxp, cyp, 12, f > 0 ? a0 - 0.9 : a0 + 0.15, f > 0 ? a0 + 0.15 : a0 + 0.9); x.stroke();
        x.lineWidth = 1;
    } else if (k === 'pick' || k === 'axe' || k === 'hammer') {
        var hx = X + (f > 0 ? 7.5 : -2), hy = Y + 8.5, mc = miniColor(id);
        x.save(); x.translate(hx + (f > 0 ? 0 : 4), hy); x.rotate(f > 0 ? (swinging ? 0.55 : 1.15) : -(swinging ? 0.55 : 1.15));
        x.fillStyle = '#7a5228'; x.fillRect(-0.5, -0.5, 1.5, 7);          // handle
        x.fillStyle = mc;
        if (k === 'pick') { x.fillRect(-3, -1.5, 7, 1.5); x.fillRect(-3.5, -1, 1, 1.5); x.fillRect(3, -1, 1, 1.5); }
        else if (k === 'axe') { x.fillRect(0.5, -2, 3.5, 4); x.fillRect(0.5, -2.5, 2, 5); }
        else { x.fillRect(-2.5, -2, 6, 3); }
        x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(-2.5, -1.5, 5, 0.5);
        x.restore();
    } else if (k === 'bow') {
        var bx = X + (f > 0 ? 8 : 0), by = Y + 9;
        x.strokeStyle = '#8a6030'; x.lineWidth = 1;
        x.beginPath(); x.arc(bx, by, 4.5, f > 0 ? -1.3 : 1.85, f > 0 ? 1.3 : 4.45); x.stroke();
        x.strokeStyle = 'rgba(240,240,240,.8)'; x.lineWidth = 0.5;
        x.beginPath(); x.moveTo(bx + (f > 0 ? 1.2 : -1.2), by - 4.3); x.lineTo(bx + (f > 0 ? 1.2 : -1.2), by + 4.3); x.stroke();
        x.lineWidth = 1;
    } else if (k === 'magic') {
        var sx2 = X + (f > 0 ? 8 : -1), sy2 = Y + 6;
        x.fillStyle = '#7a5228'; x.fillRect(sx2, sy2, 1.5, 8);
        var gcol = miniColor(id);
        x.globalAlpha = 0.4; x.fillStyle = gcol; x.beginPath(); x.arc(sx2 + 0.75, sy2, 3, 0, 7); x.fill(); x.globalAlpha = 1;
        x.fillStyle = gcol; x.beginPath(); x.arc(sx2 + 0.75, sy2, 1.6, 0, 7); x.fill();
        x.fillStyle = '#fff'; x.fillRect(sx2, sy2 - 1, 0.5, 0.5);
    } else if (k === 'block' || k === 'platform' || k === 'wall') {
        x.drawImage(tileArt(def.place && TCOL[def.place] ? def.place : T_DIRT), X + (f > 0 ? 8 : -2.5), Y + 9, 4, 4);
    }
}
function tintOf(id) { var s = ITEMS[id].set; return { wood: '#8a6030', copper: '#c07038', iron: '#b0a49a', silver: '#d8dce6', gold: '#e0b83a' }[s] || null; }
function drawGrapple(x, cx, cy) {
    var g = RT.grapple, sx = S.px + 5 - cx, sy = S.py + 10 - cy;
    var ex = (g.latched ? g.tx * TS + 4 : g.x) - cx, ey = (g.latched ? g.ty * TS + 4 : g.y) - cy;
    x.strokeStyle = '#8a8a96'; x.lineWidth = 1; x.beginPath(); x.moveTo(sx, sy); x.lineTo(ex, ey); x.stroke();
    x.strokeStyle = 'rgba(220,224,235,.8)'; x.lineWidth = 0.5; x.beginPath(); x.moveTo(sx, sy); x.lineTo(ex, ey); x.stroke();
    var a = Math.atan2(sy - ey, sx - ex);
    x.save(); x.translate(ex, ey); x.rotate(a);
    x.fillStyle = '#c8ccd6'; x.fillRect(-1.5, -1.5, 3, 3);
    x.fillStyle = '#9aa0aa'; x.fillRect(-2.5, -2.5, 2, 1); x.fillRect(-2.5, 1.5, 2, 1);
    x.restore(); x.lineWidth = 1;
}
function drawShot(x, s, cx, cy) {
    var sx = s.x - cx, sy = s.y - cy;
    if (s.kind === 'arrow') {
        x.save(); x.translate(sx, sy); x.rotate(Math.atan2(s.vy, s.vx));
        x.fillStyle = '#6b4a2a'; x.fillRect(-5, -0.5, 8, 1);                 // shaft
        x.fillStyle = s.fire ? '#ff9a3a' : '#c8ccd6';                        // head
        x.beginPath(); x.moveTo(3, -1.5); x.lineTo(6, 0); x.lineTo(3, 1.5); x.closePath(); x.fill();
        x.fillStyle = s.fire ? '#ffd88a' : '#e8ecf4'; x.fillRect(-5, -1.5, 2, 1); x.fillRect(-5, 0.5, 2, 1);
        if (s.fire) { x.globalAlpha = 0.5; x.fillStyle = '#ff7a2a'; x.beginPath(); x.arc(0, 0, 3, 0, 7); x.fill(); x.globalAlpha = 1; }
        x.restore();
    } else if (s.kind === 'stinger') {
        x.save(); x.translate(sx, sy); x.rotate(Math.atan2(s.vy, s.vx));
        x.fillStyle = '#d8e030'; x.beginPath(); x.moveTo(-3, -1); x.lineTo(3, 0); x.lineTo(-3, 1); x.closePath(); x.fill();
        x.fillStyle = '#fff8a0'; x.fillRect(1, -0.5, 2, 1);
        x.restore();
    } else {
        var col = s.col || '#fff';
        x.globalAlpha = 0.35; x.fillStyle = col; x.beginPath(); x.arc(sx, sy, 4.5, 0, 7); x.fill();
        x.globalAlpha = 1; x.fillStyle = col; x.beginPath(); x.arc(sx, sy, 2.2, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(sx - 0.6, sy - 0.6, 0.9, 0, 7); x.fill();
    }
}
function drawFoe(x, f, cx, cy) {
    var fx = f.x - cx, fy = f.y - cy, flash = f.hurtT > 4;
    var beat = (RT.anim >> 3) % 4;
    if (f.kind === 'slime') {
        var grounded = SOLID[tileAt(f.x + 4, f.y + 9)], sq = grounded ? 1 : 0;
        var body = f.pinky ? '234,120,182' : f.green ? '96,196,96' : '74,132,236';
        var top = fy + 1.5 + sq, hgt = 8 - sq;
        x.fillStyle = flash ? 'rgba(255,255,255,.9)' : 'rgba(' + body + ',.72)';
        x.beginPath();
        x.moveTo(fx - 0.5, top + hgt); x.quadraticCurveTo(fx - 1, top + 1, fx + 4.5, top);
        x.quadraticCurveTo(fx + 10, top + 1, fx + 9.5, top + hgt); x.closePath(); x.fill();
        x.fillStyle = 'rgba(255,255,255,.28)'; x.fillRect(fx + 1, top + 1, 2.5, 1.5);   // highlight
        x.fillStyle = flash ? '#fff' : 'rgba(' + body + ',.95)'; x.fillRect(fx - 0.5, top + hgt - 1, 10, 1);
        x.fillStyle = '#12121a';                                                        // eyes
        x.fillRect(fx + 2, top + 3, 1.5, 2); x.fillRect(fx + 6, top + 3, 1.5, 2);
        x.fillStyle = '#fff'; x.fillRect(fx + 2, top + 3, 0.5, 0.5); x.fillRect(fx + 6, top + 3, 0.5, 0.5);
        x.fillStyle = '#12121a'; x.fillRect(fx + 3.5, top + 6, 2.5, 0.5);               // mouth
    } else if (f.kind === 'zombie') {
        var sw = (beat === 1 || beat === 3) ? 0.5 : 0;
        x.fillStyle = flash ? '#fff' : '#3f5a30';
        x.fillRect(fx + 1.5, fy + 12, 2.5, 5 - sw); x.fillRect(fx + 5, fy + 12, 2.5, 5 + sw);   // legs
        x.fillStyle = flash ? '#fff' : '#4d6f3a'; x.fillRect(fx + 1, fy + 4, 7, 8);             // torso
        x.fillStyle = shade('#4d6f3a', 1.2); x.fillRect(fx + 1, fy + 4, 7, 1);
        x.fillStyle = flash ? '#fff' : '#6b8a52';
        x.fillRect(fx - 1.5, fy + 5, 2.5, 5); x.fillRect(fx + 8, fy + 5, 2.5, 5);               // outstretched arms
        x.fillStyle = flash ? '#fff' : '#79a05e'; x.fillRect(fx + 1.5, fy - 0.5, 6, 5);         // head
        x.fillStyle = shade('#79a05e', 0.8); x.fillRect(fx + 1.5, fy + 3.5, 6, 1);
        x.fillStyle = '#1c1c22'; x.fillRect(fx + 2.5, fy + 1, 1.5, 1.5); x.fillRect(fx + 5, fy + 1, 1.5, 1.5);
        x.fillStyle = '#c22'; x.fillRect(fx + 2.5, fy + 1, 0.5, 0.5); x.fillRect(fx + 5, fy + 1, 0.5, 0.5);
        x.fillStyle = '#2a2a30'; x.fillRect(fx + 3, fy + 3, 3, 0.5);
    } else if (f.kind === 'skeleton') {
        var sw2 = (beat === 1 || beat === 3) ? 0.5 : 0;
        x.fillStyle = flash ? '#fff' : '#d6d2c4';
        x.fillRect(fx + 2, fy + 11, 2, 6 - sw2); x.fillRect(fx + 5, fy + 11, 2, 6 + sw2);
        x.fillStyle = flash ? '#fff' : '#e8e4d6'; x.fillRect(fx + 2, fy + 4.5, 5, 6.5);
        x.fillStyle = '#b8b4a6';                                                                // ribs
        x.fillRect(fx + 2, fy + 6, 5, 0.5); x.fillRect(fx + 2, fy + 7.5, 5, 0.5); x.fillRect(fx + 2, fy + 9, 5, 0.5);
        x.fillStyle = flash ? '#fff' : '#e8e4d6'; x.fillRect(fx + 0, fy + 5, 2, 5); x.fillRect(fx + 7, fy + 5, 2, 5);
        x.fillStyle = flash ? '#fff' : '#f0ece0'; x.fillRect(fx + 1.5, fy, 6, 4.5);             // skull
        x.fillStyle = '#15151a'; x.fillRect(fx + 2.5, fy + 1.5, 1.5, 1.5); x.fillRect(fx + 5, fy + 1.5, 1.5, 1.5);
        x.fillStyle = '#c9c5b6'; x.fillRect(fx + 3, fy + 3.5, 3, 0.5);
    } else if (f.kind === 'bat') {
        var wing = (RT.anim >> 2) % 2, wy = wing ? -1.5 : 0.5;
        x.fillStyle = flash ? '#fff' : '#4a2a4a';
        x.beginPath(); x.moveTo(fx + 3.5, fy + 3); x.lineTo(fx - 3, fy + wy); x.lineTo(fx - 1, fy + 4.5); x.closePath(); x.fill();
        x.beginPath(); x.moveTo(fx + 5.5, fy + 3); x.lineTo(fx + 12, fy + wy); x.lineTo(fx + 10, fy + 4.5); x.closePath(); x.fill();
        x.fillStyle = flash ? '#fff' : '#6a4a6a'; x.fillRect(fx + 3, fy + 1.5, 3, 4.5);
        x.fillStyle = '#4a2a4a'; x.fillRect(fx + 2.5, fy + 0.5, 1.5, 1.5); x.fillRect(fx + 5, fy + 0.5, 1.5, 1.5);
        x.fillStyle = '#ff5a5a'; x.fillRect(fx + 3.5, fy + 2.5, 1, 1); x.fillRect(fx + 4.5, fy + 2.5, 1, 1);
    } else if (f.kind === 'hornet') {
        var wg = (RT.anim >> 1) % 2;
        x.globalAlpha = 0.55; x.fillStyle = '#e8f0ff';
        x.fillRect(fx + 1, fy - 1 - wg, 4, 2); x.fillRect(fx + 5, fy - 1 - wg, 4, 2);
        x.globalAlpha = 1;
        x.fillStyle = flash ? '#fff' : '#e0c030'; x.fillRect(fx + 1.5, fy + 1.5, 7, 4.5);
        x.fillStyle = '#25251c'; x.fillRect(fx + 3.5, fy + 1.5, 1.5, 4.5); x.fillRect(fx + 6, fy + 1.5, 1.5, 4.5);
        x.fillStyle = flash ? '#fff' : '#f0d860'; x.fillRect(fx + 0.5, fy + 2, 2, 3);           // head
        x.fillStyle = '#15151a'; x.fillRect(fx + 0.5, fy + 2.5, 1, 1);
        x.fillStyle = '#2a2a30'; x.fillRect(fx + 8.5, fy + 3, 2, 1);                            // stinger
    } else {   // demon eye
        x.fillStyle = flash ? '#fff' : '#e4e4ec';
        x.beginPath(); x.ellipse ? x.ellipse(fx + 4, fy + 4, 5, 4.2, 0, 0, 7) : x.arc(fx + 4, fy + 4, 4.6, 0, 7); x.fill();
        x.fillStyle = 'rgba(160,150,170,.55)'; x.fillRect(fx + 1, fy + 6.5, 6, 1);
        var dir = f.vx > 0 ? 1 : -1;
        x.fillStyle = flash ? '#fff' : '#9a2a2a'; x.beginPath(); x.arc(fx + 4 + dir * 1.6, fy + 4, 2.6, 0, 7); x.fill();
        x.fillStyle = '#12121a'; x.beginPath(); x.arc(fx + 4 + dir * 2.2, fy + 4, 1.3, 0, 7); x.fill();
        x.fillStyle = '#fff'; x.fillRect(fx + 4 + dir * 1.4, fy + 2.6, 0.8, 0.8);
        x.strokeStyle = 'rgba(150,40,40,.5)'; x.lineWidth = 0.5;                                 // veins
        x.beginPath(); x.moveTo(fx + 0.5, fy + 2.5); x.lineTo(fx + 2.5, fy + 3.5); x.moveTo(fx + 7.5, fy + 5); x.lineTo(fx + 5.5, fy + 4.5); x.stroke();
        x.lineWidth = 1;
    }
}
function drawNPC(x, n, cx, cy) {
    var nx = n.x - cx, ny = n.y - cy, walking = Math.abs(n.vx) > 0.05;
    var ph = walking ? (RT.anim >> 3) % 4 : 0, lift = [0, 1, 0, -1][ph] * 0.5;
    var look = { guide: ['#8a6a3a', '#3a7a4a', '#5a4632'], merchant: ['#b8b8c2', '#7a5a3a', '#4a3f34'], nurse: ['#e04a6a', '#f4f4f8', '#d8d8e0'] }[n.kind];
    var hair = look[0], shirt = look[1], pants = look[2];
    x.fillStyle = pants;
    x.fillRect(nx + 2, ny + 13.5, 3, 6 - lift); x.fillRect(nx + 5.5, ny + 13.5, 3, 6 + lift);
    x.fillStyle = '#3d2f26'; x.fillRect(nx + 1.5, ny + 19 - lift, 3.5, 1); x.fillRect(nx + 5.5, ny + 19 + lift, 3.5, 1);
    x.fillStyle = shirt; x.fillRect(nx + 1.5, ny + 7, 7, 6.5);
    x.fillStyle = shade(shirt, 1.2); x.fillRect(nx + 1.5, ny + 7, 7, 1);
    x.fillStyle = shade(shirt, 0.75); x.fillRect(nx + 1.5, ny + 12.5, 7, 1);
    x.fillStyle = shirt; x.fillRect(nx + (n.face > 0 ? 7.5 : 0.5), ny + 7.5, 2, 4.5);
    x.fillStyle = SKIN; x.fillRect(nx + 2, ny + 2.5, 6, 5);
    x.fillStyle = SKIN_D; x.fillRect(nx + 2, ny + 6.5, 6, 1);
    x.fillStyle = hair; x.fillRect(nx + 1.5, ny + 1, 7, 2.5);
    if (n.kind === 'nurse') { x.fillStyle = '#fff'; x.fillRect(nx + 2.5, ny + 0.5, 5, 1.5); x.fillStyle = '#e04a6a'; x.fillRect(nx + 4.5, ny + 0.5, 1, 1.5); x.fillRect(nx + 4, ny + 1, 2, 0.5); }
    if (n.kind === 'merchant') { x.fillStyle = hair; x.fillRect(nx + 2.5, ny + 6.5, 5, 1.5); }   // beard
    x.fillStyle = '#2b2b33'; x.fillRect(nx + (n.face > 0 ? 5.5 : 2.5), ny + 4, 1.5, 1.5);
    if (Math.abs(S.px - n.x) < 46 && Math.abs(S.py - n.y) < 44) {
        x.font = 'bold 5px "Segoe UI", monospace'; x.textAlign = 'center';
        x.fillStyle = 'rgba(0,0,0,.7)'; x.fillText(npcName(n.kind), nx + 5.3, ny - 2.7);
        x.fillStyle = '#fff'; x.fillText(npcName(n.kind), nx + 5, ny - 3);
        x.textAlign = 'left';
    }
}
function npcName(k) { return { guide: 'Guide', merchant: 'Merchant', nurse: 'Nurse' }[k]; }
function drawBoss(x, b, cx, cy) {
    if (b.kind === 'eye') {
        var bx = b.x - cx, by = b.y - cy, p2 = b.hp < b.max * 0.5;
        var dx = (S.px - b.x), dy = (S.py - b.y), d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.arc(bx, by + 2, 16, 0, 7); x.fill();
        x.fillStyle = '#ded6ce'; x.beginPath(); x.arc(bx, by, 15, 0, 7); x.fill();      // sclera
        x.fillStyle = '#c3b3a8'; x.beginPath(); x.arc(bx, by + 4, 12, 0.2, Math.PI - 0.2); x.fill();
        x.strokeStyle = 'rgba(150,50,50,.45)'; x.lineWidth = 0.6;                       // veins
        for (var v = 0; v < 6; v++) {
            var va = v * 1.05 + 0.4;
            x.beginPath(); x.moveTo(bx + Math.cos(va) * 6, by + Math.sin(va) * 6);
            x.lineTo(bx + Math.cos(va) * 13, by + Math.sin(va) * 13); x.stroke();
        }
        x.lineWidth = 1;
        x.fillStyle = p2 ? '#8a2222' : '#2f5fce'; x.beginPath(); x.arc(bx + dx / d * 5, by + dy / d * 5, 6.5, 0, 7); x.fill();
        x.fillStyle = p2 ? '#c04040' : '#4a7ae8'; x.beginPath(); x.arc(bx + dx / d * 5, by + dy / d * 5, 4.5, 0, 7); x.fill();
        x.fillStyle = '#0e0e14'; x.beginPath(); x.arc(bx + dx / d * 7, by + dy / d * 7, 3, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(bx + dx / d * 4 - 2, by + dy / d * 4 - 2.5, 1.6, 0, 7); x.fill();
        x.strokeStyle = '#7a1f1f'; x.lineWidth = 2.2;                                    // tendrils
        for (var tn = 0; tn < 5; tn++) {
            var t0 = bx - 8 + tn * 4, sw = Math.sin(((RT.anim || 0) + tn * 11) / 8) * 3;
            x.beginPath(); x.moveTo(t0, by + 12); x.quadraticCurveTo(t0 + sw, by + 17, t0 + sw * 1.6, by + 22 + (tn % 2) * 3); x.stroke();
        }
        x.lineWidth = 1;
    } else if (b.kind === 'king') {
        var kx = b.x - cx, ky = b.y - cy, r = b.r;
        x.fillStyle = 'rgba(64,130,226,.42)';
        x.beginPath();
        x.moveTo(kx - r, ky + r); x.quadraticCurveTo(kx - r - 2, ky - r * 0.5, kx, ky - r);
        x.quadraticCurveTo(kx + r + 2, ky - r * 0.5, kx + r, ky + r); x.closePath(); x.fill();
        x.fillStyle = 'rgba(120,190,255,.30)'; x.beginPath(); x.arc(kx - r * 0.35, ky - r * 0.3, r * 0.42, 0, 7); x.fill();
        x.fillStyle = 'rgba(64,130,226,.65)'; x.fillRect(kx - r, ky + r - 2, r * 2, 2);
        x.fillStyle = '#a87038'; x.fillRect(kx - 3, ky + 1, 6, 5);                        // the trapped ninja
        x.fillStyle = '#2a2a34'; x.fillRect(kx - 3, ky + 1, 6, 2);
        x.fillStyle = '#12121a'; x.fillRect(kx - 5, ky - 4, 2.5, 3); x.fillRect(kx + 2.5, ky - 4, 2.5, 3);
        x.fillStyle = '#fff'; x.fillRect(kx - 5, ky - 4, 1, 1); x.fillRect(kx + 2.5, ky - 4, 1, 1);
        x.fillStyle = '#e0b83a';                                                          // crown
        x.fillRect(kx - 7, ky - r - 3, 14, 3);
        x.fillRect(kx - 6, ky - r - 6, 2.5, 3); x.fillRect(kx - 1.2, ky - r - 7, 2.5, 4); x.fillRect(kx + 3.5, ky - r - 6, 2.5, 3);
        x.fillStyle = '#fff0b0'; x.fillRect(kx - 7, ky - r - 3, 14, 1);
        x.fillStyle = '#c02a4a'; x.fillRect(kx - 0.5, ky - r - 2, 1.5, 1.5);
    } else if (b.kind === 'eater') {
        for (var i = b.seg.length - 1; i >= 0; i--) {
            var s = b.seg[i], ex = s.x - cx, ey = s.y - cy, headSeg = i === 0, rr = headSeg ? 6.5 : 5 - i * 0.06;
            x.fillStyle = headSeg ? '#8a5a9a' : '#4e3260';
            x.beginPath(); x.arc(ex, ey, rr, 0, 7); x.fill();
            x.fillStyle = headSeg ? '#a878b8' : '#654078';                                  // plating highlight
            x.beginPath(); x.arc(ex - rr * 0.25, ey - rr * 0.3, rr * 0.55, 0, 7); x.fill();
            x.fillStyle = 'rgba(20,10,26,.5)'; x.fillRect(ex - rr, ey + rr * 0.45, rr * 2, 1);
            if (headSeg) {
                x.fillStyle = '#e6d6f4'; x.fillRect(ex - 3.5, ey - 1.5, 2.5, 2.5); x.fillRect(ex + 1, ey - 1.5, 2.5, 2.5);
                x.fillStyle = '#12121a'; x.fillRect(ex - 3, ey - 1, 1.5, 1.5); x.fillRect(ex + 1.5, ey - 1, 1.5, 1.5);
                x.fillStyle = '#d8c0e8';                                                    // mandibles
                x.fillRect(ex - 5, ey + 2.5, 2, 3); x.fillRect(ex + 3, ey + 2.5, 2, 3);
            }
        }
    }
}
function drawTorch(x, sx, sy) {
    x.fillStyle = '#6b4a24'; x.fillRect(sx + 3.5, sy + 3, 1.5, 5);
    x.fillStyle = '#8a6030'; x.fillRect(sx + 3.5, sy + 3, 0.5, 5);
    var fl = (RT.anim || 0), w1 = Math.sin(fl / 5) * 0.4, w2 = Math.sin(fl / 3.5 + 1) * 0.3;
    x.globalAlpha = 0.30; x.fillStyle = '#ff9a3a';                                   // halo
    x.beginPath(); x.arc(sx + 4.2, sy + 2, 5.5, 0, 7); x.fill(); x.globalAlpha = 1;
    x.fillStyle = '#ff7a1e';
    x.beginPath(); x.moveTo(sx + 4.2 + w1, sy - 1.5); x.quadraticCurveTo(sx + 6.6, sy + 1.5, sx + 4.2, sy + 3.5);
    x.quadraticCurveTo(sx + 1.8, sy + 1.5, sx + 4.2 + w1, sy - 1.5); x.fill();
    x.fillStyle = '#ffc14a';
    x.beginPath(); x.moveTo(sx + 4.2 + w2, sy - 0.2); x.quadraticCurveTo(sx + 5.7, sy + 1.6, sx + 4.2, sy + 3);
    x.quadraticCurveTo(sx + 2.7, sy + 1.6, sx + 4.2 + w2, sy - 0.2); x.fill();
    x.fillStyle = '#fff4c0'; x.fillRect(sx + 3.8, sy + 1.2, 1, 1.6);
    if ((RT.anim || 0) % 6 === 0) RT.parts.push({ x: sx + RT.cam.x + 4.2, y: sy + RT.cam.y + 0.5, vx: (Math.random() - 0.5) * 0.3, vy: -0.4, t: 14, c: '#ffb85a', r: 1, g: -0.02 });
}
function drawBench(x, sx, sy) { x.drawImage(objArt('bench'), sx, sy, TS, TS); }
function drawAnvil(x, sx, sy) { x.drawImage(objArt('anvil'), sx, sy, TS, TS); }
function drawPot(x, sx, sy) { x.drawImage(objArt('pot'), sx, sy, TS, TS); }
function drawChest(x, sx, sy) { x.drawImage(objArt('chest'), sx, sy, TS, TS); }
function drawFurnace(x, sx, sy, hell) {
    x.drawImage(objArt(hell ? 'hellforge' : 'furnace'), sx, sy, TS, TS);
    var fl = (RT.anim || 0), fw = 0.4 + 0.25 * Math.sin(fl / 6);
    x.globalAlpha = 0.85; x.fillStyle = hell ? '#ff5a2a' : '#ff8a2a';
    x.beginPath(); x.moveTo(sx + 2, sy + 6.5); x.quadraticCurveTo(sx + 4, sy + 2.5 - fw, sx + 6, sy + 6.5); x.closePath(); x.fill();
    x.globalAlpha = 1; x.fillStyle = '#ffd88a';
    x.fillRect(sx + 3.2, sy + 4.8, 1.6, 1.6);
    x.globalAlpha = 0.22; x.fillStyle = '#ff9a3a'; x.beginPath(); x.arc(sx + 4, sy + 5, 5, 0, 7); x.fill(); x.globalAlpha = 1;
}
function drawHeart(x, sx, sy) {
    x.globalAlpha = 0.22 + 0.1 * Math.sin((RT.anim || 0) / 12); x.fillStyle = '#ff5a7a';
    x.beginPath(); x.arc(sx + 4, sy + 4, 5.5, 0, 7); x.fill(); x.globalAlpha = 1;
    x.drawImage(objArt('heartc'), sx, sy, TS, TS);
}
function drawManaC(x, sx, sy) {
    x.globalAlpha = 0.22 + 0.1 * Math.sin((RT.anim || 0) / 12); x.fillStyle = '#6e9aff';
    x.beginPath(); x.arc(sx + 4, sy + 4, 5.5, 0, 7); x.fill(); x.globalAlpha = 1;
    x.drawImage(objArt('manac'), sx, sy, TS, TS);
}
/* dropped items: a real little icon per item class, bobbing on the ground */
function drawItemMini(x, id, sx, sy, c) {
    var bob = Math.sin(((RT.anim || 0) + (sx * 3)) / 18) * 0.7;
    var cxp = sx, cyp = sy + bob, d = ITEMS[id], col = miniColor(id);
    x.globalAlpha = 0.25; x.fillStyle = '#000';
    x.beginPath(); x.ellipse ? x.ellipse(cxp, sy + 3.5, 3, 1, 0, 0, 7) : x.arc(cxp, sy + 3.5, 2, 0, 7); x.fill();
    x.globalAlpha = 1;
    if (id === 'coin') {
        var tier = c >= 10000 ? '#f0c840' : c >= 100 ? '#d6dae2' : '#c07038';
        x.fillStyle = tier; x.beginPath(); x.arc(cxp, cyp, 2.4, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.arc(cxp - 0.7, cyp - 0.8, 0.9, 0, 7); x.fill();
        return;
    }
    if (!d) { x.fillStyle = col; x.fillRect(cxp - 2, cyp - 2, 4, 4); return; }
    var k = d.kind;
    if (k === 'pick' || k === 'axe' || k === 'hammer' || k === 'sword' || k === 'bow' || k === 'magic') {
        x.save(); x.translate(cxp, cyp); x.rotate(-0.6);
        x.fillStyle = '#7a5228'; x.fillRect(-0.6, -1, 1.2, 5);
        x.fillStyle = col;
        if (k === 'sword') { x.fillRect(-0.9, -4.5, 1.8, 5); x.fillStyle = '#c8a24a'; x.fillRect(-2, -0.4, 4, 1); }
        else if (k === 'pick') { x.fillRect(-3, -3, 6, 1.4); x.fillRect(-3.2, -3, 1, 1.6); x.fillRect(2.2, -3, 1, 1.6); }
        else if (k === 'axe') { x.fillRect(0.4, -4, 2.6, 3.4); }
        else if (k === 'bow') { x.strokeStyle = col; x.lineWidth = 1; x.beginPath(); x.arc(0, 0, 3, -1.2, 1.2); x.stroke(); }
        else { x.fillStyle = col; x.beginPath(); x.arc(0, -3.5, 1.6, 0, 7); x.fill(); }
        x.restore(); return;
    }
    if (k === 'potion') {
        x.fillStyle = '#cfe4ef'; x.fillRect(cxp - 0.8, cyp - 3, 1.6, 1.4);
        x.fillStyle = col; x.beginPath(); x.arc(cxp, cyp + 0.4, 2.2, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(cxp - 1.4, cyp - 0.6, 0.8, 1.4);
        return;
    }
    if (k === 'bar') {
        x.fillStyle = shade(col, 0.7); x.fillRect(cxp - 2.6, cyp - 0.2, 5.2, 2);
        x.fillStyle = col; x.fillRect(cxp - 2.2, cyp - 1.6, 4.4, 1.6);
        x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(cxp - 2, cyp - 1.5, 3.4, 0.6);
        return;
    }
    if (k === 'ore') {
        x.fillStyle = '#6f6f78'; x.beginPath(); x.arc(cxp, cyp, 2.6, 0, 7); x.fill();
        x.fillStyle = col; x.fillRect(cxp - 1.6, cyp - 1.4, 1.6, 1.4); x.fillRect(cxp + 0.2, cyp + 0.1, 1.4, 1.2);
        x.fillStyle = 'rgba(255,255,255,.8)'; x.fillRect(cxp - 1.5, cyp - 1.3, 0.6, 0.6);
        return;
    }
    if (k === 'gem') {
        x.fillStyle = col; x.beginPath(); x.moveTo(cxp, cyp - 2.6); x.lineTo(cxp + 2.2, cyp); x.lineTo(cxp, cyp + 2.6); x.lineTo(cxp - 2.2, cyp); x.closePath(); x.fill();
        x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.moveTo(cxp, cyp - 2.4); x.lineTo(cxp + 1.9, cyp); x.lineTo(cxp, cyp); x.closePath(); x.fill();
        return;
    }
    if (k === 'block' || k === 'platform' || k === 'wall') {
        var pl = d.place;
        if (pl && (TCOL[pl] || pl === T_TORCH)) { x.drawImage(tileArt(TCOL[pl] ? pl : T_PLANK), cxp - 2.5, cyp - 2.5, 5, 5); }
        else { x.fillStyle = col; x.fillRect(cxp - 2.5, cyp - 2.5, 5, 5); }
        x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(cxp - 2.5, cyp - 2.5, 5, 0.6);
        return;
    }
    if (k === 'summon') {
        x.fillStyle = '#ded6ce'; x.beginPath(); x.arc(cxp, cyp, 2.6, 0, 7); x.fill();
        x.fillStyle = col; x.beginPath(); x.arc(cxp, cyp, 1.4, 0, 7); x.fill();
        x.fillStyle = '#12121a'; x.beginPath(); x.arc(cxp, cyp, 0.7, 0, 7); x.fill();
        return;
    }
    // generic material: a soft nugget
    x.fillStyle = col; x.beginPath(); x.arc(cxp, cyp, 2.3, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(cxp - 1.6, cyp - 1.6, 1, 1);
}

function miniColor(id) {
    var d = ITEMS[id];
    if (id === 'coin') return '#e8c23a';
    if (!d) return '#ccc';
    if (d.kind === 'pick' || d.kind === 'axe' || d.kind === 'hammer' || d.kind === 'sword' || d.kind === 'bow') return { c: '#c07038', i: '#b0a49a', s: '#d8dce6', g: '#e0b83a', d: '#4a5a86', l: '#4a5a86' }[id.charAt(0)] || '#b0a49a';
    return { wood: '#9c7040', dirt: '#6b4a2a', stone: '#7a7a82', sand: '#dcc888', ash: '#4a4550', torch: '#ffb03a', gel: '#508cf0', cop: '#c07038', iron: '#b0a49a', silv: '#d8dce6', gold: '#e0b83a', demon: '#4a5a86', meteor: '#8a4a3a', hell: '#8a2a1a', cbar: '#c07038', ibar: '#b0a49a', sbar: '#d8dce6', gbar: '#e0b83a', lens: '#d8d8e0', star: '#fff2a0', silk: '#e8e8f0', cobweb: '#c8ccd4', shadow: '#4a3a5c' }[id] || GEMCOL[({ ambar: T_AMETHYST, tobar: T_TOPAZ, sabar: T_SAPPHIRE, embar: T_EMERALD, rubar: T_RUBY, dibar: T_DIAMOND }[id])] || '#ccc';
}

/* ─────────────── HUD (DOM) ─────────────── */
function paintAll() { paintHotbar(); paintHearts(); paintStars(); paintCoins(); paintBuffs(); paintHint(); }
function paintHint() {
    var el = RT.root.querySelector('.tr-hint'); if (!el) return;
    if (RT.setOpen || RT.mapOpen || RT.shopOpen) { el.textContent = 'Esc closes this panel'; return; }
    if (RT.panel) { el.textContent = 'Click an item to pick it up · again to place/swap · right-click takes one · ' + keyName(BINDS.inv) + ' or Esc closes'; return; }
    el.innerHTML = 'A/D move · ' + keyName(BINDS.jump) + ' jump · L-click use · R-click place · <b>' + keyName(BINDS.inv) + '</b> inv · <b>' + keyName(BINDS.map) + '</b> map · <b>' + keyName(BINDS.grapple) + '</b> grapple · <b>' + keyName(BINDS.heal) + '</b> heal · <b>' + keyName(BINDS.settings) + '</b> settings';
}
function paintHotbar() {
    var hb = RT.root.querySelector('.tr-hotbar'), html = '';
    for (var i = 0; i < 10; i++) {
        var s = S.inv[i], d = s ? ITEMS[s.id] : null;
        html += '<div class="tr-slot' + (i === S.sel ? ' sel' : '') + '" data-slot="inv:' + i + '" data-tip="' + (s ? esc(tipText(s.id)) : '') + '">' +
            (s ? itemIcon(s.id) + (s.c > 1 ? '<i>' + s.c + '</i>' : '') : '') + '<u>' + ((i + 1) % 10) + '</u></div>';
    }
    hb.innerHTML = html;
    // selected item name flash
    var sel = S.inv[S.sel];
    var nm = RT.root.querySelector('.tr-selname');
    if (!nm) { nm = document.createElement('div'); nm.className = 'tr-selname'; RT.root.querySelector('.tr-topleft').appendChild(nm); }
    if (sel) { nm.textContent = ITEMS[sel.id].n; nm.style.color = RAR[ITEMS[sel.id].rar] || '#fff'; nm.classList.add('on'); clearTimeout(RT._selT); RT._selT = setTimeout(function () { if (nm) nm.classList.remove('on'); }, 1400); }
    if (RT.panel) paintPanel();
}
function tipText(id) { var d = ITEMS[id]; var extra = d.dmg ? ' · ' + d.dmg + ' dmg' : d.pow ? ' · pick power ' + d.pow : d.def ? ' · ' + d.def + ' def' : ''; return d.n + extra + (d.tip ? ' — ' + d.tip : ''); }
function paintHearts() {
    var el = RT.root.querySelector('.tr-hearts'), n = Math.ceil(S.maxhp / 20), html = '';
    for (var i = 0; i < n; i++) { var fill = clamp(S.hp - i * 20, 0, 20) / 20; html += '<span class="tr-heart' + (fill <= 0 ? ' empty' : fill < 1 ? ' half' : '') + '"></span>'; }
    el.innerHTML = html + '<b>' + Math.max(0, S.hp) + '</b>';
}
function paintStars() {
    var el = RT.root.querySelector('.tr-stars'), n = Math.ceil(S.maxmana / 20), html = '';
    if (S.maxmana <= 0) { el.innerHTML = ''; return; }
    for (var i = 0; i < n; i++) { var fill = clamp(S.mana - i * 20, 0, 20) / 20; html += '<span class="tr-star' + (fill <= 0 ? ' empty' : fill < 1 ? ' half' : '') + '"></span>'; }
    el.innerHTML = html + '<b>' + Math.max(0, S.mana) + '</b>';
}
function paintCoins() {
    var c = S.coins, g = Math.floor(c / 10000), s = Math.floor(c % 10000 / 100), cp = c % 100;
    var el = RT.root.querySelector('.tr-coins');
    el.innerHTML = (g ? '<span class="tr-coin g">' + g + '</span>' : '') + (g || s ? '<span class="tr-coin s">' + s + '</span>' : '') + '<span class="tr-coin c">' + cp + '</span>';
}
function paintBuffs() {
    var el = RT.root.querySelector('.tr-buffs'); if (!el) return; var html = '';
    var names = { iron: ['Ironskin', '#c0c8d8'], swift: ['Swiftness', '#8af0a0'], shine: ['Shine', '#f0e090'] };
    for (var k in S.buffs) { var b = names[k] || [k, '#fff'], sec = Math.ceil(S.buffs[k] / 60); html += '<span class="tr-buff" style="--bc:' + b[1] + '" data-tip="' + esc(b[0] + ' — ' + sec + 's left') + '"><i></i><u>' + sec + '</u></span>'; }
    el.innerHTML = html;
}
function paintMini() {
    var cv = RT.root.querySelector('.tr-mini'); if (!cv) return;
    if (cv.width !== 264) { cv.width = cv.height = 264; }        // 2x the 132px css box
    var g = cv.getContext('2d'), sz = cv.width;
    if (g.imageSmoothingEnabled !== undefined) g.imageSmoothingEnabled = false;
    var span = 40, px = Math.floor((S.px + 5) / TS), py = Math.floor((S.py + 10) / TS);
    g.fillStyle = '#05070e'; g.fillRect(0, 0, sz, sz);
    var cell = sz / (span * 2);
    for (var y = -span; y < span; y++) for (var x = -span; x < span; x++) {
        var wx = px + x, wy = py + y; if (wx < 0 || wx >= W || wy < 0 || wy >= H) continue;
        if (!RT.explored[wy * W + wx]) continue;
        var t = RT.w[wy * W + wx], col;
        if (RT.lq[wy * W + wx] > 20) col = RT.lk[wy * W + wx] === LQ_LAVA ? '#c0401a' : '#2a5aa0';
        else if (t === T_AIR) col = RT.wall[wy * W + wx] ? '#1a1720' : null;
        else col = (TCOL[t] || ['#888'])[0];
        if (!col) continue;
        g.fillStyle = col; g.fillRect((x + span) * cell, (y + span) * cell, Math.ceil(cell), Math.ceil(cell));
    }
    // player + npcs + boss
    g.fillStyle = '#ffe040'; g.fillRect(sz / 2 - 2, sz / 2 - 2, 5, 5);
    g.fillStyle = '#fff'; g.fillRect(sz / 2 - 1, sz / 2 - 1, 3, 3);
    RT.npcs.forEach(function (n) { var mx = (Math.floor(n.x / TS) - px + span) * cell, my = (Math.floor(n.y / TS) - py + span) * cell; if (mx >= 0 && mx < sz && my >= 0 && my < sz) { g.fillStyle = '#40ff80'; g.fillRect(mx, my, 4, 4); } });
    if (RT.boss) { var b = RT.boss, bx = (b.kind === 'eater' ? b.seg[0].x : b.x); var mbx = (Math.floor(bx / TS) - px + span) * cell, mby = (Math.floor((b.kind === 'eater' ? b.seg[0].y : b.y) / TS) - py + span) * cell; g.fillStyle = '#ff4040'; g.fillRect(mbx - 2, mby - 2, 7, 7); }
}

/* full inventory / crafting / equip panel */
function refocus() { if (RT && RT.root && RT.root.focus) RT.root.focus(); }
function paintPanel() {
    var el = RT.root.querySelector('.tr-panel');
    var st = stationsNear();
    // left: crafting (station-aware); right: inventory + equip
    var craftable = [];
    RECIPES.forEach(function (r, i) { craftable.push({ r: r, i: i, ok: canCraft(r), near: !r[2] || st[r[2]] }); });
    craftable = craftable.filter(function (c) { return c.near || c.ok; });
    craftable.sort(function (a, b) { return (b.ok - a.ok) || (a.i - b.i); });
    var craftHTML = craftable.map(function (c) {
        var r = c.r, ings = r[3].map(function (g) { return ITEMS[g[0]].n + ' ×' + g[1] + (invCount(g[0]) >= g[1] ? '' : ' (' + invCount(g[0]) + ')'); }).join(', ');
        return '<button class="tr-rec' + (c.ok ? '' : ' cant') + '" data-r="' + c.i + '" data-tip="' + esc(ings + (r[2] ? ' — at ' + r[2] : '')) + '">' + itemIcon(r[0]) + '<span style="color:' + (RAR[ITEMS[r[0]].rar] || '#fff') + '">' + esc(ITEMS[r[0]].n) + (r[1] > 1 ? ' ×' + r[1] : '') + '</span></button>';
    }).join('');
    var stationTxt = Object.keys(st).filter(function (k) { return k !== 'null'; }).map(function (k) { return k; }).join(', ') || 'hand only';

    function slot(kind, i, cls, ph) {
        var arr = kind === 'inv' ? S.inv : kind === 'arm' ? S.arm : kind === 'acc' ? S.acc : S.ammo;
        var s = arr[i], d = s ? ITEMS[s.id] : null;
        return '<div class="tr-slot ' + (cls || '') + (kind === 'inv' && i === S.sel ? ' sel' : '') + '" data-slot="' + kind + ':' + i + '" data-tip="' + (s ? esc(tipText(s.id)) : (ph || '')) + '">' +
            (s ? itemIcon(s.id) + (s.c > 1 ? '<i>' + s.c + '</i>' : '') : (ph ? '<em class="tr-ph">' + ph + '</em>' : '')) + '</div>';
    }
    var invGrid = '';
    for (var i = 0; i < 40; i++) invGrid += slot('inv', i);
    var equip = '<div class="tr-equipcol"><h5>Armor</h5>' + slot('arm', 0, 'eq', 'Head') + slot('arm', 1, 'eq', 'Body') + slot('arm', 2, 'eq', 'Legs') +
        '<h5>Accessories</h5><div class="tr-accrow">' + slot('acc', 0, 'eq', '◇') + slot('acc', 1, 'eq', '◇') + slot('acc', 2, 'eq', '◇') + slot('acc', 3, 'eq', '◇') + slot('acc', 4, 'eq', '◇') + '</div>' +
        '<h5>Ammo</h5><div class="tr-accrow">' + slot('ammo', 0, 'eq', '➶') + slot('ammo', 1, 'eq', '➶') + slot('ammo', 2, 'eq', '➶') + slot('ammo', 3, 'eq', '➶') + '</div>' +
        '<div class="tr-defrow">🛡 Defense <b>' + armorDef() + '</b></div>' +
        '<div class="tr-trash" data-slot="trash:0" data-tip="Trash — drops the held stack">🗑</div></div>';
    el.innerHTML =
        '<div class="tr-craftcol"><div class="tr-panel-h">Crafting <span>near: ' + esc(stationTxt) + '</span></div><div class="tr-recipes">' + (craftHTML || '<p class="tr-empty">Nothing craftable here. Try a work bench.</p>') + '</div></div>' +
        '<div class="tr-invcol"><div class="tr-panel-h">Inventory</div><div class="tr-grid">' + invGrid + '</div></div>' +
        equip;
    paintCursor();
}
function paintCursor() {
    var el = RT.root.querySelector('.tr-cursor');
    if (!RT.cursor) { el.hidden = true; return; }
    el.hidden = false; el.innerHTML = itemIcon(RT.cursor.id) + (RT.cursor.c > 1 ? '<i>' + RT.cursor.c + '</i>' : '');
    if (!RT._curMove) { RT._curMove = function (e) { var r = RT.root.getBoundingClientRect(); el.style.left = (e.clientX - r.left + 8) + 'px'; el.style.top = (e.clientY - r.top + 8) + 'px'; }; RT.root.addEventListener('mousemove', RT._curMove); }
}
function onPanelClick(e) {
    if (RT.rebinding) return;
    var shopx = e.target.closest('[data-shopx]'); if (shopx) { closeShop(); refocus(); return; }
    var buy = e.target.closest('[data-buy]'); if (buy) { shopBuy(RT.shopOpen, +buy.getAttribute('data-buy')); refocus(); return; }
    if (e.target.closest('[data-heal]')) { var missing = S.maxhp - S.hp, cost = missing * 3; if (S.coins >= cost && missing > 0) { S.coins -= cost; S.hp = S.maxhp; paintHearts(); paintCoins(); openShop('nurse'); } return; }
    var setBtn = e.target.closest('[data-set]'); if (setBtn) { settingsAction(setBtn.getAttribute('data-set')); if (!RT.rebinding) refocus(); return; }
    var guideBtn = e.target.closest('[data-guide]'); if (guideBtn) { RT.shopOpen = null; RT.root.querySelector('.tr-shop').hidden = true; return; }
    var rec = e.target.closest('.tr-rec[data-r]'); if (rec) { craft(+rec.getAttribute('data-r')); refocus(); return; }
    var slot = e.target.closest('.tr-slot[data-slot], .tr-trash[data-slot]'); if (slot) { onSlotClick(slot.getAttribute('data-slot')); refocus(); }
}
function slotArr(kind) { return kind === 'inv' ? S.inv : kind === 'arm' ? S.arm : kind === 'acc' ? S.acc : kind === 'ammo' ? S.ammo : null; }
var ARM_SLOT = ['head', 'chest', 'legs'];
function slotAccepts(kind, item, idx) {
    if (!item) return true; var d = ITEMS[item.id];
    if (kind === 'inv') return true;
    // head/chest/legs each take their own piece — without this you could wear three helmets
    if (kind === 'arm') return d.kind === 'armor' && (idx == null || d.slot === ARM_SLOT[idx]);
    if (kind === 'acc') return d.kind === 'accessory';
    if (kind === 'ammo') return d.kind === 'ammo';
    return false;
}
function onSlotClick(ref) {
    var p = ref.split(':'), kind = p[0], i = +p[1];
    if (kind === 'trash') { RT.cursor = null; paintPanel(); return; }
    if (!RT.panel && kind === 'inv') { S.sel = i; paintHotbar(); return; }   // hotbar (panel closed) just selects
    var arr = slotArr(kind); var cur = RT.cursor, here = arr[i];
    if (!cur) {   // pick up
        if (here) { RT.cursor = here; arr[i] = null; }
    } else {
        if (!slotAccepts(kind, cur, i)) { if (kind !== 'inv') { toast('That doesn’t go there.'); return; } }
        if (here && here.id === cur.id && ITEMS[cur.id].max > 1) { var max = ITEMS[cur.id].max, room = max - here.c, mv = Math.min(room, cur.c); here.c += mv; cur.c -= mv; if (!cur.c) RT.cursor = null; }
        else if (slotAccepts(kind, cur, i)) { arr[i] = cur; RT.cursor = here; if (!slotAccepts(RT.cursor ? kind : kind, RT.cursor) && RT.cursor) { /* swapped-out item type may not fit; it's fine, goes to cursor */ } }
    }
    // equipping updates stats
    if (kind === 'acc') { if (accHas('hook')) unlock('hooked'); }
    if (kind === 'arm' && fullArmor()) unlock('armed');
    paintPanel(); paintHotbar(); paintHearts(); paintStars();
}
function onSlotRight(ref) {
    var p = ref.split(':'), kind = p[0], i = +p[1]; if (kind === 'trash') return;
    if (!RT.panel) return;   // right-click only manages the cursor with the panel open (never during play on the hotbar)
    var arr = slotArr(kind), here = arr[i]; if (!here) return;
    if (!RT.cursor) { RT.cursor = { id: here.id, c: 1 }; here.c--; if (!here.c) arr[i] = null; }
    else if (RT.cursor.id === here.id && RT.cursor.c < ITEMS[here.id].max) { RT.cursor.c++; here.c--; if (!here.c) arr[i] = null; }
    paintPanel();
}
function autoSelect() {
    // cycle selection to next non-empty hotbar slot (a nod to Terraria's autoselect)
    for (var k = 1; k <= 10; k++) { var i = (S.sel + k) % 10; if (S.inv[i]) { S.sel = i; paintHotbar(); return; } }
}

/* ─────────────── item icons (DOM, crisp) ─────────────── */
function itemIcon(id) {
    var d = ITEMS[id]; if (!d) return '<em class="tri" style="background:#ccc"></em>';
    var tier = { c: '#c07038', i: '#b0a49a', s: '#d8dce6', g: '#e0b83a', d: '#4a5a86', l: '#4a5a86' }[id.charAt(0)];
    if (d.kind === 'pick') return '<em class="tri tri-pick" style="background:' + (tier || '#b0a49a') + '"></em>';
    if (d.kind === 'axe') return '<em class="tri tri-axe" style="background:' + (tier || '#b0894a') + '"></em>';
    if (d.kind === 'hammer') return '<em class="tri tri-hammer" style="background:' + (tier || '#b0894a') + '"></em>';
    if (d.kind === 'sword') return '<em class="tri tri-sword" style="background:' + (tier || '#d8d8e0') + '"></em>';
    if (d.kind === 'bow') return '<em class="tri tri-bow" style="background:' + (tier || '#b0894a') + '"></em>';
    if (d.kind === 'magic') return '<em class="tri tri-staff" style="background:' + (GEMCOL[({ am: T_AMETHYST, db: T_DIAMOND }[id.slice(0, 2)])] || '#c060f0') + '"></em>';
    if (d.kind === 'ammo') return '<em class="tri tri-arrow" style="background:' + (d.fire ? '#ff8a2a' : '#a87030') + '"></em>';
    if (d.kind === 'potion') return '<em class="tri tri-potion" style="background:' + (d.heal ? '#f05a6a' : d.mana ? '#5a8cf0' : '#f0d040') + '"></em>';
    if (d.kind === 'armor') return '<em class="tri tri-armor" style="background:' + (tintOf(id) || '#b0a49a') + '"></em>';
    if (d.kind === 'accessory') return '<em class="tri tri-acc" style="background:' + (id === 'hook' ? '#c8c8d0' : id === 'boots' ? '#c07038' : id === 'cloud' ? '#eef2fa' : id === 'shoe' ? '#e0b83a' : '#a0a0c0') + '"></em>';
    if (d.kind === 'summon') return '<em class="tri tri-eye" style="background:' + (id === 'suseye' ? '#d8d0c8' : id === 'slimec' ? '#5a8cf0' : '#8a5a9a') + '"></em>';
    if (d.kind === 'gem') return '<em class="tri tri-gem" style="background:' + miniColor(id) + '"></em>';
    if (d.kind === 'bar') return '<em class="tri tri-bar" style="background:' + miniColor(id) + '"></em>';
    if (d.kind === 'ore') return '<em class="tri tri-ore" style="background:' + miniColor(id) + '"></em>';
    if (d.kind === 'wall' || d.kind === 'platform' || d.kind === 'block') return '<em class="tri" style="background:' + miniColor(id) + '"></em>';
    return '<em class="tri" style="background:' + miniColor(id) + '"></em>';
}

/* ─────────────── fullscreen map ─────────────── */
function paintMap() {
    var host = RT.root.querySelector('.tr-map'), cv = RT.root.querySelector('.tr-mapcv');
    var vw = host.clientWidth, vh = host.clientHeight; if (cv.width !== vw || cv.height !== vh) { cv.width = vw; cv.height = vh; }
    var g = cv.getContext('2d'); g.fillStyle = '#05070e'; g.fillRect(0, 0, vw, vh);
    var zoom = RT.mapZoom || 2.5, cell = zoom * 0.5;
    var px = Math.floor((S.px + 5) / TS), py = Math.floor((S.py + 10) / TS);
    var halfW = Math.floor(vw / cell / 2), halfH = Math.floor(vh / cell / 2);
    for (var y = -halfH; y < halfH; y++) for (var x = -halfW; x < halfW; x++) {
        var wx = px + x, wy = py + y; if (wx < 0 || wx >= W || wy < 0 || wy >= H) continue;
        if (!RT.explored[wy * W + wx]) continue;
        var t = RT.w[wy * W + wx], col;
        if (RT.lq[wy * W + wx] > 20) col = RT.lk[wy * W + wx] === LQ_LAVA ? '#c0401a' : '#2a5aa0';
        else if (t === T_AIR) col = RT.wall[wy * W + wx] ? '#171420' : '#0a0c16';
        else col = (TCOL[t] || ['#888'])[0];
        g.fillStyle = col; g.fillRect((x + halfW) * cell, (y + halfH) * cell, Math.ceil(cell), Math.ceil(cell));
    }
    g.fillStyle = '#ffe040'; g.fillRect(halfW * cell - 1, halfH * cell - 1, 3, 3);
    RT.npcs.forEach(function (n) { g.fillStyle = '#40ff80'; g.fillRect((Math.floor(n.x / TS) - px + halfW) * cell, (Math.floor(n.y / TS) - py + halfH) * cell, 3, 3); });
    // legend
    g.font = '11px monospace'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(worldName() + ' · ' + biomeLabel(biomeAtX(px)) + ' · depth ' + Math.round((py - 46) * 2) + ' ft', 10, 18);
}

/* ─────────────── settings / keybinds ─────────────── */
function paintSettings() {
    var el = RT.root.querySelector('.tr-settings');
    var rows = Object.keys(DEFBINDS).map(function (a) {
        var label = { left: 'Move left', right: 'Move right', up: 'Up / jump', down: 'Down', jump: 'Jump', inv: 'Inventory', map: 'World map', grapple: 'Grapple', heal: 'Quick heal', mana: 'Quick mana', buff: 'Quick buff', autoselect: 'Auto-select', settings: 'Settings' }[a];
        return '<div class="tr-set-row"><span>' + label + '</span><button class="tr-set-key' + (RT.rebinding === a ? ' listening' : '') + '" data-set="bind:' + a + '">' + (RT.rebinding === a ? 'press a key…' : keyName(BINDS[a])) + '</button></div>';
    }).join('');
    el.innerHTML = '<div class="tr-set-card"><div class="tr-shop-h"><b>Controls & Settings</b><button class="tr-x" data-set="close">×</button></div>' +
        '<div class="tr-set-grid">' + rows + '</div>' +
        '<div class="tr-set-foot"><button class="tr-set-btn" data-set="reset">Reset to defaults</button>' +
        '<button class="tr-set-btn danger" data-set="newworld">Generate a new world…</button></div>' +
        '<p class="tr-set-note">Progress saves automatically. A new world keeps your achievements.</p></div>';
}
function settingsAction(a) {
    if (a === 'close') { toggleSettings(false); return; }
    if (a === 'reset') { BINDS = {}; for (var k in DEFBINDS) BINDS[k] = DEFBINDS[k]; saveBinds(); paintSettings(); paintHint(); return; }
    if (a === 'newworld') {
        if (RT._confirmNew) { newWorld(); RT._confirmNew = false; }
        else { RT._confirmNew = true; var b = RT.root.querySelector('[data-set="newworld"]'); if (b) b.textContent = 'Click again to confirm — this erases the world'; RT.timers.push(setTimeout(function () { if (!RT) return; RT._confirmNew = false; if (b && RT.setOpen) b.textContent = 'Generate a new world…'; }, 4000)); }
        return;
    }
    if (a.indexOf('bind:') === 0) { RT.rebinding = a.slice(5); paintSettings(); }
}
function finishRebind(key) {
    var a = RT.rebinding; RT.rebinding = null;
    if (key && a) {
        var prev = BINDS[a];
        for (var k in BINDS) if (BINDS[k] === key && k !== a) BINDS[k] = prev;   // swap, never leave an action unbound
        BINDS[a] = key; saveBinds();
    }
    paintSettings(); paintHint();
}
function newWorld() {
    var keepAch = S.ach, keepCoins = 0;
    S = fresh(); S.ach = keepAch;
    localStorage.removeItem('comp_terraria');
    var gen = genWorld(S.seed);
    RT.w = gen.w; RT.wall = gen.wall; RT.lq = gen.lq; RT.lk = gen.lk; RT.surf = gen.surf; RT.chests = gen.chests.map(function (c) { return { x: c.x, y: c.y, biome: c.biome, loot: null }; });
    S.chests = RT.chests; RT.explored = new Uint8Array(W * H); S.explored = '';
    var sx = Math.floor(W / 2); S.px = sx * TS; S.py = (Math.round(gen.surf[sx]) - 3) * TS; S.spawnx = S.px; S.spawny = S.py; S.inv = startInv();
    RT.foes = []; RT.drops = []; RT.shots = []; RT.parts = []; RT.boss = null; RT.grapple = null; RT.npcs = []; spawnNPC('guide');
    RT.root.querySelector('.tr-bosshp').hidden = true;
    toggleSettings(false); sSave(); paintAll();
    toast('A new World of Ure spins into being.');
}

/* ─────────────── tooltip ─────────────── */
function wireTip(root) {
    root.addEventListener('mousemove', function (e) {
        var t = e.target.closest('[data-tip]'), tip = root.querySelector('.tr-tip');
        if (!t || !t.getAttribute('data-tip')) { tip.hidden = true; return; }
        tip.textContent = t.getAttribute('data-tip'); tip.hidden = false;
        var rr = root.getBoundingClientRect();
        tip.style.left = clamp(e.clientX - rr.left + 12, 4, rr.width - 230) + 'px';
        tip.style.top = clamp(e.clientY - rr.top + 16, 4, rr.height - 44) + 'px';
    });
}
function coinFmt(c) {
    var g = Math.floor(c / 10000), s = Math.floor(c % 10000 / 100), cp = c % 100, out = [];
    if (g) out.push(g + 'g'); if (s) out.push(s + 's'); if (cp || !out.length) out.push(cp + 'c');
    return out.join(' ');
}

/* ─────────────── lifecycle / Steam ─────────────── */
function close() {
    var hrs = RT ? (Date.now() - RT.started) / 3600000 : 0;
    if (RT) {
        cancelAnimationFrame(RT.raf);
        RT.timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
        window.removeEventListener('pointerup', RT.mup);
        if (RT._curMove) RT.root.removeEventListener('mousemove', RT._curMove);
        if (RT.cursor) { invGive(RT.cursor.id, RT.cursor.c); RT.cursor = null; }   // never pocket-vanish a lifted stack
        S.tiles = packBytes(RT.w); S.walls = packBytes(RT.wall); S.liq = packLiq(RT.lq, RT.lk); S.explored = packBytes(RT.explored);
        RT = null;
    }
    sSave();
    return hrs;
}
function steamAch() {
    sLoad();
    var n = 0; ACH.forEach(function (a) { if (S.ach[a[0]]) n++; });
    return { n: n, total: ACH.length, list: ACH.map(function (a) { return [a[1], a[2], S.ach[a[0]] ? 1 : 0]; }) };
}

/* headless test handle: rAF is frozen off-screen, so expose stepping + state.
   Also powers the QC harness (drive gameplay deterministically, no rAF). */
window.__terra = {
    step: function (n) { for (var i = 0; i < (n || 1); i++) if (RT) step(); },
    draw: function () { if (RT) draw(); },
    S: function () { return S; }, RT: function () { return RT; },
    give: function (id, c) { if (S) invGive(id, c || 1); paintHotbar(); },
    tp: function (tx, ty) { if (S) { S.px = tx * TS; S.py = ty * TS; RT.vx = RT.vy = 0; RT.camReady = false; } },
    sel: function (i) { if (S) { S.sel = i; paintHotbar(); } },
    craft: function (i) { craft(i); },
    boss: function (k) { spawnBoss(k); },
    aimTile: function (tx, ty) { if (RT) { RT.mouse.x = (tx * TS + 4 - RT.cam.x) * RS; RT.mouse.y = (ty * TS + 4 - RT.cam.y) * RS; } },
    aimWorld: function (wx, wy) { if (RT) { RT.mouse.x = (wx - RT.cam.x) * RS; RT.mouse.y = (wy - RT.cam.y) * RS; } },
    hold: function (l, r) { if (RT) { RT.mouse.l = !!l; RT.mouse.r = !!r; if (l) RT.mouse.lEdge = true; if (r) RT.mouse.rEdge = true; } },
    panel: function (on) { togglePanel(on); }, checkHouse: function () { checkHouse(); },
    slot: function (ref) { onSlotClick(ref); }, slotRight: function (ref) { onSlotRight(ref); },
    potLoot: function (tx, ty) { potLoot(tx, ty); },
    TID: { AIR: T_AIR, STONE: T_STONE, PLATFORM: T_PLATFORM, PLANK: T_PLANK, DOOR: T_DOOR, TORCH: T_TORCH, TABLE: T_TABLE, CHAIR: T_CHAIR },
    biomeAtX: biomeAtX, unlock: unlock, ACH: ACH, ITEMS: ITEMS, RECIPES: RECIPES
};
window.TERRA = { render: render, init: init, close: close, steamAch: steamAch };
})();

