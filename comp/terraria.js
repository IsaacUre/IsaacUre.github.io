/* ============================================================
   TERRARIA — a real one, in a window on the UreOS desktop.
   A 360×180-tile generated world: value-noise surface, worm-
   carved caves, four ore tiers, trees, pots, crystal hearts,
   an ash-and-lava underworld. Flood-fill lighting with torches,
   a day/night cycle, slimes/zombies/demon eyes, proximity
   crafting (workbench → furnace → anvil), the real starter
   copper kit, and the Eye of Cthulhu if you dare craft the
   Suspicious Looking Eye. Saves under comp_terraria (world
   RLE-packed). Exposes window.TERRA { render, init, close,
   steamAch } for the comp.js APPS entry; achievements feed the
   Steam client live, playtime lands on the library page.
   ============================================================ */
(function () {
'use strict';

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

/* ─────────────── world constants ─────────────── */
var W = 360, H = 180, TS = 8;              // tiles wide/high, tile size (px at 1×; canvas is CSS-scaled 2×)
var HELL = H - 26;                          // underworld starts here
var DAY = 300, NIGHT = 150, CYCLE = DAY + NIGHT;   // seconds

/* tile ids */
var T_AIR = 0, T_DIRT = 1, T_GRASS = 2, T_STONE = 3, T_PLANK = 4, T_TRUNK = 5, T_LEAF = 6,
    T_COPPER = 7, T_IRON = 8, T_SILVER = 9, T_GOLD = 10, T_TORCH = 11, T_BENCH = 12,
    T_FURNACE = 13, T_ANVIL = 14, T_ASH = 15, T_LAVA = 16, T_HEART = 17, T_POT = 18;
var SOLID = {}; [T_DIRT, T_GRASS, T_STONE, T_PLANK, T_COPPER, T_IRON, T_SILVER, T_GOLD, T_ASH].forEach(function (t) { SOLID[t] = 1; });
var TCOL = {};   // tile colours [main, shade]
TCOL[T_DIRT] = ['#6b4a2a', '#583c22']; TCOL[T_GRASS] = ['#4a9c3a', '#3a7c2e']; TCOL[T_STONE] = ['#7a7a82', '#63636b'];
TCOL[T_PLANK] = ['#9c7040', '#7f5a33']; TCOL[T_TRUNK] = ['#7a5228', '#634321']; TCOL[T_LEAF] = ['#3a8a30', '#2f7027'];
TCOL[T_COPPER] = ['#c07038', '#7a7a82']; TCOL[T_IRON] = ['#b0a49a', '#7a7a82']; TCOL[T_SILVER] = ['#d8dce6', '#7a7a82'];
TCOL[T_GOLD] = ['#e0b83a', '#7a7a82']; TCOL[T_ASH] = ['#4a4550', '#3a3642']; TCOL[T_HEART] = ['#e04a6a', '#7a7a82'];
TCOL[T_POT] = ['#a8763a', '#8a5f2e'];
/* hardness (pick swings to break) + which tool */
var HARD = {}; HARD[T_DIRT] = 1; HARD[T_GRASS] = 1; HARD[T_STONE] = 3; HARD[T_PLANK] = 2; HARD[T_TRUNK] = 3;
HARD[T_LEAF] = 0.5; HARD[T_COPPER] = 4; HARD[T_IRON] = 5; HARD[T_SILVER] = 6; HARD[T_GOLD] = 7;
HARD[T_ASH] = 1.5; HARD[T_HEART] = 4; HARD[T_POT] = 0.5; HARD[T_TORCH] = 0.5; HARD[T_BENCH] = 2; HARD[T_FURNACE] = 3; HARD[T_ANVIL] = 3;

/* ─────────────── items ───────────────
   kind: tool (pick/axe/sword) | block | mat | use
   place: tile id a block places; pow/dmg for tools */
var ITEMS = {
    cpick:   { n: 'Copper Pickaxe',  kind: 'pick',  pow: 1,   tip: 'The trusty starter. Swings forever.' },
    ipick:   { n: 'Iron Pickaxe',    kind: 'pick',  pow: 1.6, tip: 'Chews stone properly.' },
    spick:   { n: 'Silver Pickaxe',  kind: 'pick',  pow: 2.1, tip: 'Shiny AND practical.' },
    gpick:   { n: 'Gold Pickaxe',    kind: 'pick',  pow: 2.8, tip: 'Mining in style.' },
    caxe:    { n: 'Copper Axe',      kind: 'axe',   pow: 1.4, tip: 'For trees. Not for zombies. (It works on zombies.)' },
    csword:  { n: 'Copper Shortsword', kind: 'sword', dmg: 8,  tip: 'Pointy end goes in the slime.' },
    isword:  { n: 'Iron Broadsword', kind: 'sword', dmg: 13, tip: 'A proper arc. A proper sword.' },
    ssword:  { n: 'Silver Broadsword', kind: 'sword', dmg: 17, tip: 'Werewolves not included.' },
    gsword:  { n: 'Gold Broadsword', kind: 'sword', dmg: 22, tip: 'Heavy, soft, gorgeous. Slimes hate it.' },
    dirt:    { n: 'Dirt Block',      kind: 'block', place: T_DIRT,   max: 999 },
    stone:   { n: 'Stone Block',     kind: 'block', place: T_STONE,  max: 999 },
    wood:    { n: 'Wood',            kind: 'block', place: T_PLANK,  max: 999 },
    ash:     { n: 'Ash Block',       kind: 'block', place: T_ASH,    max: 999 },
    torch:   { n: 'Torch',           kind: 'block', place: T_TORCH,  max: 999, tip: 'Providing light since 2011.' },
    bench:   { n: 'Work Bench',      kind: 'block', place: T_BENCH,  max: 99, tip: 'Crafting station. Place it down.' },
    furnace: { n: 'Furnace',         kind: 'block', place: T_FURNACE, max: 99, tip: 'Smelts ore into bars.' },
    anvil:   { n: 'Iron Anvil',      kind: 'block', place: T_ANVIL,  max: 99, tip: 'For real tools and real swords.' },
    cop:     { n: 'Copper Ore',      kind: 'mat', max: 999 }, iron: { n: 'Iron Ore', kind: 'mat', max: 999 },
    silv:    { n: 'Silver Ore',      kind: 'mat', max: 999 }, gold: { n: 'Gold Ore', kind: 'mat', max: 999 },
    cbar:    { n: 'Copper Bar',      kind: 'mat', max: 999 }, ibar: { n: 'Iron Bar', kind: 'mat', max: 999 },
    sbar:    { n: 'Silver Bar',      kind: 'mat', max: 999 }, gbar: { n: 'Gold Bar', kind: 'mat', max: 999 },
    gel:     { n: 'Gel',             kind: 'mat', max: 999, tip: 'Flammable. Wobbly. Blue.' },
    lens:    { n: 'Lens',            kind: 'mat', max: 999, tip: 'It is looking at you.' },
    suseye:  { n: 'Suspicious Looking Eye', kind: 'use', max: 20, tip: 'Summons the Eye of Cthulhu. At night. If you must.' }
};
var ORE_ITEM = {}; ORE_ITEM[T_COPPER] = 'cop'; ORE_ITEM[T_IRON] = 'iron'; ORE_ITEM[T_SILVER] = 'silv'; ORE_ITEM[T_GOLD] = 'gold';
var TILE_ITEM = {}; TILE_ITEM[T_DIRT] = 'dirt'; TILE_ITEM[T_GRASS] = 'dirt'; TILE_ITEM[T_STONE] = 'stone';
TILE_ITEM[T_PLANK] = 'wood'; TILE_ITEM[T_ASH] = 'ash'; TILE_ITEM[T_TORCH] = 'torch'; TILE_ITEM[T_BENCH] = 'bench';
TILE_ITEM[T_FURNACE] = 'furnace'; TILE_ITEM[T_ANVIL] = 'anvil';

/* recipes: [result, count, station(null/bench/furnace/anvil), [ [item, n], ... ]] */
var RECIPES = [
    ['bench', 1, null, [['wood', 10]]],
    ['torch', 3, null, [['wood', 1], ['gel', 1]]],
    ['furnace', 1, 'bench', [['stone', 20], ['wood', 4], ['torch', 3]]],
    ['cbar', 1, 'furnace', [['cop', 3]]],
    ['ibar', 1, 'furnace', [['iron', 3]]],
    ['sbar', 1, 'furnace', [['silv', 4]]],
    ['gbar', 1, 'furnace', [['gold', 4]]],
    ['anvil', 1, 'bench', [['ibar', 5]]],
    ['ipick', 1, 'anvil', [['ibar', 12], ['wood', 4]]],
    ['spick', 1, 'anvil', [['sbar', 12], ['wood', 4]]],
    ['gpick', 1, 'anvil', [['gbar', 12], ['wood', 4]]],
    ['isword', 1, 'anvil', [['ibar', 8]]],
    ['ssword', 1, 'anvil', [['sbar', 8]]],
    ['gsword', 1, 'anvil', [['gbar', 8]]],
    ['suseye', 1, 'bench', [['lens', 6]]]
];

/* ─────────────── achievements (real names) ─────────────── */
var ACH = [
    ['timber',  'Timber!!',            'Chop down your first tree.'],
    ['benched', 'Benched',             'Craft a work bench.'],
    ['shiny',   'Ooo! Shiny!',         'Mine your first nugget of ore.'],
    ['pot',     'Smashing, Poppet!',   'Smash a pot.'],
    ['night',   'You Can Do It!',      'Survive your first night.'],
    ['heart',   'Heart Breaker',       'Discover and smash a crystal heart underground.'],
    ['metal',   'Heavy Metal',         'Obtain an anvil.'],
    ['bottom',  'Rock Bottom',         'Reach the underworld.'],
    ['boss',    'Like a Boss',         'Obtain a boss-summoning item.'],
    ['eye',     'Eye on You',          'Defeat the Eye of Cthulhu.'],
    ['pinky',   'Pretty in Pink',      'Slay Pinky, the rarest of slimes.'],
    ['dozer',   'Bulldozer',           'Destroy 2,500 tiles.'],
    ['walker',  'Marathon Medalist',   'Travel 26.2 miles on foot.'],
    ['loaded',  'Moneybags',           'Hold a gold coin’s worth of loot (10,000 copper).'],
    ['slayer',  'Still Hungry?',       'Slay 100 enemies.'],
    ['ore4',    'Full Set',            'Mine copper, iron, silver, and gold.']
];

/* ─────────────── state ─────────────── */
var S = null, RT = null;
function fresh() {
    return { v: 1, seed: (Math.random() * 1e9) | 0, tiles: null, time: DAY * 0.3, day: 1,
        px: 0, py: 0, hp: 100, maxhp: 100, inv: null, sel: 0, coins: 0,
        ach: {}, kills: 0, mined: 0, walked: 0, ores: {}, diedAt: 0, t: Date.now() };
}
function startInv() {
    var inv = []; for (var i = 0; i < 30; i++) inv.push(null);
    inv[0] = { id: 'cpick', c: 1 }; inv[1] = { id: 'caxe', c: 1 }; inv[2] = { id: 'csword', c: 1 };
    return inv;
}
function sLoad() {
    if (S) return S;
    try { S = JSON.parse(localStorage.getItem('comp_terraria') || 'null'); } catch (e) { S = null; }
    if (!S || S.v !== 1) S = fresh();
    return S;
}
function sSave() {
    if (!S) return;
    S.t = Date.now();
    try { localStorage.setItem('comp_terraria', JSON.stringify(S)); } catch (e) {}
}
/* world <-> RLE string (id:run in base36, comma-joined) */
function packWorld(w) {
    var out = [], run = 1, cur = w[0];
    for (var i = 1; i < w.length; i++) {
        if (w[i] === cur) { run++; continue; }
        out.push(cur.toString(36) + ':' + run.toString(36)); cur = w[i]; run = 1;
    }
    out.push(cur.toString(36) + ':' + run.toString(36));
    return out.join(',');
}
function unpackWorld(s) {
    var w = new Uint8Array(W * H), i = 0;
    s.split(',').forEach(function (tk) {
        var p = tk.split(':'), id = parseInt(p[0], 36), run = parseInt(p[1], 36);
        for (var k = 0; k < run; k++) w[i++] = id;
    });
    return i === W * H ? w : null;
}

/* ─────────────── world generation ─────────────── */
function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function genWorld(seed) {
    var R = rng(seed), w = new Uint8Array(W * H);
    // 1. surface heights: smoothed random walk
    var surf = [], y = 44;
    for (var x = 0; x < W; x++) { y += (R() - 0.5) * 2.4; y = clamp(y, 28, 62); surf.push(y); }
    for (var sm = 0; sm < 3; sm++) for (x = 1; x < W - 1; x++) surf[x] = (surf[x - 1] + surf[x] + surf[x + 1]) / 3;
    // 2. strata
    for (x = 0; x < W; x++) {
        var sy = Math.round(surf[x]), rocky = sy + 7 + Math.round(R() * 5);
        for (y = 0; y < H; y++) {
            var i = y * W + x;
            if (y < sy) w[i] = T_AIR;
            else if (y === sy) w[i] = T_GRASS;
            else if (y < rocky) w[i] = T_DIRT;
            else if (y < HELL) w[i] = T_STONE;
            else w[i] = T_ASH;
        }
    }
    // 3. caves: drunken worms
    for (var c = 0; c < 110; c++) {
        var cx = R() * W, cy = surf[Math.floor(cx)] + 6 + R() * (H - 20 - surf[Math.floor(cx)]), steps = 40 + R() * 120, ang = R() * 6.28;
        for (var st = 0; st < steps; st++) {
            ang += (R() - 0.5) * 1.1; cx += Math.cos(ang) * 1.6; cy += Math.sin(ang) * 1.2;
            if (cx < 2 || cx > W - 3 || cy < surf[Math.floor(clamp(cx, 0, W - 1))] + 3 || cy > H - 3) break;
            var rad = 1 + R() * 2;
            for (var oy = -rad; oy <= rad; oy++) for (var ox = -rad; ox <= rad; ox++)
                if (ox * ox + oy * oy <= rad * rad) {
                    var tx = Math.floor(cx + ox), ty = Math.floor(cy + oy);
                    if (tx > 0 && tx < W && ty > 0 && ty < H) w[ty * W + tx] = ty >= HELL ? T_AIR : T_AIR;
                }
        }
    }
    // 4. ore blobs: [tile, count, minY, maxY, size]
    [[T_COPPER, 70, 50, 110, 7], [T_IRON, 52, 62, 130, 6], [T_SILVER, 34, 84, 150, 6], [T_GOLD, 24, 104, HELL - 2, 5]]
        .forEach(function (o) {
            for (var b = 0; b < o[1]; b++) {
                var bx = 4 + R() * (W - 8), by = o[2] + R() * (o[3] - o[2]);
                for (var g = 0; g < o[4] + R() * o[4]; g++) {
                    var gx = Math.floor(bx + (R() - 0.5) * 4), gy = Math.floor(by + (R() - 0.5) * 3);
                    if (gx > 0 && gx < W && gy > 0 && gy < H && w[gy * W + gx] === T_STONE) w[gy * W + gx] = o[0];
                }
            }
        });
    // 5. underworld lava pools + pockets
    for (c = 0; c < 60; c++) {
        var lx = Math.floor(R() * W), ly = HELL + 4 + Math.floor(R() * (H - HELL - 8)), lr = 2 + R() * 4;
        for (oy = -lr; oy <= lr; oy++) for (ox = -lr * 1.8; ox <= lr * 1.8; ox++) {
            tx = Math.floor(lx + ox); ty = Math.floor(ly + oy);
            if (tx > 0 && tx < W && ty > HELL && ty < H - 1 && (ox * ox / 3.2 + oy * oy) <= lr * lr)
                w[ty * W + tx] = oy > 0 ? T_LAVA : T_AIR;
        }
    }
    // 6. trees on grass
    for (x = 4; x < W - 4; x += 5 + Math.floor(R() * 9)) {
        var gy2 = Math.round(surf[x]);
        if (w[gy2 * W + x] !== T_GRASS) continue;
        var th = 5 + Math.floor(R() * 5);
        for (var t = 1; t <= th; t++) if (gy2 - t > 1) w[(gy2 - t) * W + x] = T_TRUNK;
        for (oy = -2; oy <= 1; oy++) for (ox = -2; ox <= 2; ox++) {
            ty = gy2 - th + oy; tx = x + ox;
            if (tx > 0 && tx < W && ty > 0 && Math.abs(ox) + Math.abs(oy) < 4 && w[ty * W + tx] === T_AIR) w[ty * W + tx] = T_LEAF;
        }
    }
    // 7. pots in caves + crystal hearts deep
    var placed = 0, guard = 0;
    while (placed < 44 && guard++ < 4000) {
        x = 2 + Math.floor(R() * (W - 4)); y = 50 + Math.floor(R() * (HELL - 52));
        if (w[y * W + x] === T_AIR && SOLID[w[(y + 1) * W + x]]) { w[y * W + x] = T_POT; placed++; }
    }
    placed = 0; guard = 0;
    while (placed < 15 && guard++ < 6000) {
        x = 2 + Math.floor(R() * (W - 4)); y = 95 + Math.floor(R() * (HELL - 100));
        if (w[y * W + x] === T_AIR && SOLID[w[(y + 1) * W + x]]) { w[y * W + x] = T_HEART; placed++; }
    }
    return { w: w, surf: surf };
}

/* ─────────────── inventory helpers ─────────────── */
function invCount(id) { var n = 0; S.inv.forEach(function (s) { if (s && s.id === id) n += s.c; }); return n; }
function invTake(id, n) {
    for (var i = 0; i < S.inv.length && n > 0; i++) {
        var s = S.inv[i];
        if (s && s.id === id) { var take = Math.min(s.c, n); s.c -= take; n -= take; if (!s.c) S.inv[i] = null; }
    }
}
function invGive(id, n) {
    var max = ITEMS[id].max || 1, i;
    for (i = 0; i < S.inv.length && n > 0; i++) {
        var s = S.inv[i];
        if (s && s.id === id && s.c < max) { var add = Math.min(max - s.c, n); s.c += add; n -= add; }
    }
    for (i = 0; i < S.inv.length && n > 0; i++) {
        if (!S.inv[i]) { var put = Math.min(max, n); S.inv[i] = { id: id, c: put }; n -= put; }
    }
    return n;   // overflow (dropped on the floor of the void, like the real inventory gods intended)
}
function nearStation(place) {
    var pxt = Math.floor(S.px / TS), pyt = Math.floor(S.py / TS);
    for (var y = pyt - 4; y <= pyt + 4; y++) for (var x = pxt - 5; x <= pxt + 5; x++) {
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        var t = RT.w[y * W + x];
        if (place === 'bench' && t === T_BENCH) return true;
        if (place === 'furnace' && t === T_FURNACE) return true;
        if (place === 'anvil' && t === T_ANVIL) return true;
    }
    return false;
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
          '<div class="tr-hotbar"></div>' +
          '<div class="tr-hearts"></div>' +
          '<div class="tr-coins"></div>' +
          '<div class="tr-depth"></div>' +
        '</div>' +
        '<div class="tr-panel" hidden><div class="tr-inv"></div><div class="tr-craft"><h4>Crafting</h4><div class="tr-recipes"></div></div></div>' +
        '<div class="tr-bosshp" hidden><b>Eye of Cthulhu</b><div class="tr-bossbar"><i></i></div></div>' +
        '<div class="tr-toast" hidden></div>' +
        '<div class="tr-death" hidden><b>You were slain…</b><span></span></div>' +
        '<div class="tr-hint">A/D move · Space jump · click mine/attack · right-click place · E inventory · 1-0 hotbar</div>' +
        '<div class="tr-tip" hidden></div>' +
        '</div>';
}

/* ─────────────── init ─────────────── */
function init(el) {
    sLoad();
    var root = el.querySelector('.tr');
    RT = { el: el, root: root, cv: root.querySelector('.tr-cv'), x: null,
        w: null, surf: null, keys: {}, mouse: { x: 0, y: 0, l: false, r: false },
        cam: { x: 0, y: 0 }, vx: 0, vy: 0, ground: false, face: 1, anim: 0,
        swing: 0, mineT: { x: -1, y: -1, p: 0 }, iframe: 0, regenT: 0,
        foes: [], drops: [], dmgs: [], boss: null, panel: false,
        raf: 0, timers: [], acc: 0, last: 0, started: Date.now(), light: null, dead: 0 };

    // world: restore or generate
    var w = S.tiles ? unpackWorld(S.tiles) : null;
    if (!w) {
        var gen = genWorld(S.seed);
        w = gen.w; RT.surf = gen.surf;
        var sx = Math.floor(W / 2);
        S.px = sx * TS; S.py = (Math.round(gen.surf[sx]) - 3) * TS;
        S.spawnx = S.px; S.spawny = S.py;
        S.inv = startInv();
    }
    RT.w = w;
    if (!S.inv) S.inv = startInv();

    // dev hooks for screenshots: ?tdev=night|cave|boss|kit
    var tdev = (location.search.match(/[?&]tdev=([a-z]+)/) || [])[1];
    if (tdev === 'night') S.time = DAY + 20;
    if (tdev === 'kit') { invGive('ibar', 30); invGive('wood', 99); invGive('torch', 50); invGive('gel', 20); invGive('lens', 6); invGive('bench', 1); invGive('furnace', 1); invGive('anvil', 1); RT.openPanel = true; }
    if (tdev === 'cave') {
        var cx = Math.floor(W / 2), cy = 100;
        for (var oy = -3; oy <= 2; oy++) for (var ox = -5; ox <= 5; ox++) RT.w[(cy + oy) * W + cx + ox] = oy >= 2 ? T_STONE : T_AIR;
        RT.w[(cy + 1) * W + cx - 3] = T_TORCH; RT.w[(cy + 1) * W + cx + 3] = T_TORCH;
        S.px = cx * TS; S.py = cy * TS; invGive('torch', 30);
    }
    if (tdev === 'boss') { S.time = DAY + 30; spawnBoss(); }

    wireInput(root);
    paintHotbar(); paintHearts(); paintCoins();
    if (RT.openPanel) togglePanel(true);
    RT.last = performance.now();
    RT.raf = requestAnimationFrame(loop);
    RT.timers.push(setInterval(function () { S.tiles = packWorld(RT.w); sSave(); }, 30000));
    toast(S.day > 1 || S.tiles ? 'Welcome back to ' + worldName() + '.' : 'Welcome to ' + worldName() + '. The copper kit is in your hotbar.');
}
function worldName() { return 'World of Ure (' + (S.seed % 1000) + ')'; }

/* ─────────────── input ─────────────── */
function wireInput(root) {
    root.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && RT.panel) { togglePanel(false); e.stopPropagation(); return; }
        RT.keys[e.key.toLowerCase()] = true;
        if (e.key === ' ') e.preventDefault();
        if (e.key.toLowerCase() === 'e') togglePanel(!RT.panel);
        var n = parseInt(e.key, 10);
        if (!isNaN(n)) { S.sel = (n + 9) % 10; paintHotbar(); }
        e.stopPropagation();
    });
    root.addEventListener('keyup', function (e) { RT.keys[e.key.toLowerCase()] = false; e.stopPropagation(); });
    RT.cv.addEventListener('pointermove', function (e) {
        var r = RT.cv.getBoundingClientRect();
        RT.mouse.x = (e.clientX - r.left) / (r.width / RT.cv.width);
        RT.mouse.y = (e.clientY - r.top) / (r.height / RT.cv.height);
    });
    RT.cv.addEventListener('pointerdown', function (e) {
        root.focus();
        if (e.button === 0) RT.mouse.l = true;
        if (e.button === 2) { RT.mouse.r = true; placeAt(); }
    });
    window.addEventListener('pointerup', RT.mup = function (e) { if (e.button === 0) RT.mouse.l = false; if (e.button === 2) RT.mouse.r = false; });
    RT.cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    RT.cv.addEventListener('wheel', function (e) { e.preventDefault(); S.sel = (S.sel + (e.deltaY > 0 ? 1 : 9)) % 10; paintHotbar(); }, { passive: false });
    root.addEventListener('click', function (e) {   // panel interactions
        var slot = e.target.closest('.tr-slot[data-i]');
        if (slot) {   // move to/from hotbar: swap with selected hotbar slot
            var i = +slot.getAttribute('data-i');
            if (i >= 10) { var tmp = S.inv[S.sel]; S.inv[S.sel] = S.inv[i]; S.inv[i] = tmp; paintPanel(); paintHotbar(); }
            else { S.sel = i; paintHotbar(); paintPanel(); }
        }
        var rec = e.target.closest('.tr-rec[data-r]');
        if (rec) craft(+rec.getAttribute('data-r'));
    });
    wireTip(root);
    setTimeout(function () { root.focus(); }, 40);
}
function togglePanel(on) {
    RT.panel = on;
    RT.root.querySelector('.tr-panel').hidden = !on;
    if (on) paintPanel();
}

/* ─────────────── main loop ─────────────── */
function loop(now) {
    if (!RT) return;
    RT.raf = requestAnimationFrame(loop);
    if (!RT.el.offsetParent) { RT.last = now; return; }   // minimized: world holds its breath
    var dt = Math.min(100, now - RT.last); RT.last = now;
    RT.acc += dt;
    var steps = 0;
    while (RT.acc >= 16.66 && steps < 4) { step(); RT.acc -= 16.66; steps++; }
    draw();
}

/* ─────────────── simulation step (60 Hz) ─────────────── */
function step() {
    S.time += 1 / 60;
    if (S.time >= CYCLE) { S.time -= CYCLE; S.day++; unlock('night'); }
    if (RT.dead > 0) { RT.dead--; if (!RT.dead) respawn(); return; }

    // player physics
    var k = RT.keys, acc = RT.ground ? 0.14 : 0.07;
    if (k.a || k.arrowleft) { RT.vx -= acc; RT.face = -1; }
    if (k.d || k.arrowright) { RT.vx += acc; RT.face = 1; }
    if ((k[' '] || k.w || k.arrowup) && RT.ground) { RT.vy = -3.85; RT.ground = false; }
    RT.vx = clamp(RT.vx, -2.1, 2.1);
    RT.vx *= RT.ground ? 0.82 : 0.94;
    RT.vy = Math.min(RT.vy + 0.17, 6);
    moveBody();
    S.walked += Math.abs(RT.vx) / TS;   // in tiles
    if (S.walked * 0.000621 * 2 >= 26.2) unlock('walker');   // 2ft per tile, real-game scale-ish

    // lava + fall? (lava only; falls are for cowards)
    var pt = tileAt(S.px + 5, S.py + 18);
    if (pt === T_LAVA && RT.iframe <= 0) hurt(25, 0);

    // regen
    if (RT.iframe > 0) RT.iframe--;
    if (++RT.regenT > 90 && S.hp < S.maxhp) { S.hp++; RT.regenT = 0; paintHearts(); }

    // mining / swinging
    if (RT.mouse.l && !RT.panel) useHeld();
    else RT.mineT.p = Math.max(0, RT.mineT.p - 0.08);
    if (RT.swing > 0) RT.swing--;

    // drops: physics + magnet
    for (var i = RT.drops.length - 1; i >= 0; i--) {
        var d = RT.drops[i];
        d.vy = Math.min(d.vy + 0.15, 4);
        if (!SOLID[tileAt(d.x, d.y + 4)]) d.y += d.vy; else d.vy = 0;
        var dx = (S.px + 5) - d.x, dy = (S.py + 10) - d.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 34) { d.x += dx / dist * 2.4; d.y += dy / dist * 2.4; }
        if (dist < 8) {
            if (d.id === 'coin') S.coins += d.c;
            else invGive(d.id, d.c);
            RT.drops.splice(i, 1);
            paintHotbar(); paintCoins();
            if (S.coins >= 10000) unlock('loaded');
        }
    }

    // enemies
    spawnTick();
    for (i = RT.foes.length - 1; i >= 0; i--) if (foeStep(RT.foes[i])) RT.foes.splice(i, 1);
    if (RT.boss) bossStep();

    // damage numbers decay
    for (i = RT.dmgs.length - 1; i >= 0; i--) { var g = RT.dmgs[i]; g.y -= 0.5; if (!--g.t) RT.dmgs.splice(i, 1); }

    RT.anim++;
}
function tileAt(px, py) {
    var x = Math.floor(px / TS), y = Math.floor(py / TS);
    if (x < 0 || x >= W || y < 0 || y >= H) return T_STONE;
    return RT.w[y * W + x];
}
function moveBody() {
    // horizontal
    S.px += RT.vx;
    if (hitSolid()) { S.px -= RT.vx; RT.vx = 0; }
    // vertical
    S.py += RT.vy;
    if (hitSolid()) {
        S.py -= RT.vy;
        if (RT.vy > 0) RT.ground = true;
        RT.vy = 0;
    } else if (Math.abs(RT.vy) > 0.3) RT.ground = false;
    S.px = clamp(S.px, TS, (W - 2) * TS); S.py = clamp(S.py, TS, (H - 3) * TS);
}
function hitSolid() {
    for (var ox = 1; ox <= 9; ox += 4) for (var oy = 0; oy <= 20; oy += 5)
        if (SOLID[tileAt(S.px + ox, S.py + oy)]) return true;
    return false;
}

/* ─────────────── using the held item ─────────────── */
function held() { return S.inv[S.sel]; }
function mouseWorld() { return { x: RT.mouse.x + RT.cam.x, y: RT.mouse.y + RT.cam.y }; }
function useHeld() {
    var h = held(), m = mouseWorld();
    var def = h ? ITEMS[h.id] : null;
    if (def && def.kind === 'sword') { swing(def.dmg); return; }
    if (def && def.kind === 'use' && h.id === 'suseye') { summonEye(); return; }
    // mining (pick/axe — or fists for pots and torches)
    var tx = Math.floor(m.x / TS), ty = Math.floor(m.y / TS);
    if (tx < 1 || tx >= W - 1 || ty < 1 || ty >= H - 1) return;
    var dxp = tx * TS - S.px, dyp = ty * TS - S.py;
    if (dxp * dxp + dyp * dyp > (5.5 * TS) * (5.5 * TS)) return;   // reach
    var t = RT.w[ty * W + tx];
    if (t === T_AIR || t === T_LAVA) { swing(def && def.dmg || 4); return; }
    var isTree = (t === T_TRUNK || t === T_LEAF), isSoft = (t === T_POT || t === T_TORCH || t === T_BENCH || t === T_FURNACE || t === T_ANVIL || t === T_HEART);
    var pow = 0.5;   // fists
    if (def && def.kind === 'pick' && !isTree) pow = def.pow;
    if (def && def.kind === 'axe' && isTree) pow = def.pow;
    if (isSoft) pow = Math.max(pow, 1.2);
    RT.face = dxp >= 0 ? 1 : -1; RT.swing = Math.max(RT.swing, 6);
    if (RT.mineT.x !== tx || RT.mineT.y !== ty) { RT.mineT = { x: tx, y: ty, p: 0 }; }
    RT.mineT.p += pow / 14;
    if (RT.mineT.p >= HARD[t]) breakTile(tx, ty, t);
}
function breakTile(tx, ty, t) {
    RT.w[ty * W + tx] = T_AIR;
    RT.mineT.p = 0; S.mined++;
    if (S.mined >= 2500) unlock('dozer');
    if (t === T_GRASS) drop(tx, ty, 'dirt', 1);
    else if (t === T_TRUNK) { chopTree(tx, ty); }
    else if (t === T_LEAF) {}
    else if (ORE_ITEM[t]) { drop(tx, ty, ORE_ITEM[t], 1); S.ores[t] = 1; unlock('shiny'); if (S.ores[T_COPPER] && S.ores[T_IRON] && S.ores[T_SILVER] && S.ores[T_GOLD]) unlock('ore4'); }
    else if (t === T_POT) { unlock('pot'); potLoot(tx, ty); }
    else if (t === T_HEART) { S.maxhp = Math.min(400, S.maxhp + 20); S.hp = S.maxhp; unlock('heart'); toast('Your maximum health increased by 20!'); paintHearts(); }
    else if (TILE_ITEM[t]) drop(tx, ty, TILE_ITEM[t], 1);
    if (ty >= HELL) unlock('bottom');
}
function chopTree(tx, ty) {
    // fell everything above: trunk drops wood, leaves evaporate
    var woodN = 1;
    for (var y = ty - 1; y > 1; y--) {
        var t = RT.w[y * W + tx];
        if (t === T_TRUNK) { RT.w[y * W + tx] = T_AIR; woodN++; }
        else break;
    }
    for (var oy = -14; oy <= 2; oy++) for (var ox = -3; ox <= 3; ox++) {
        var yy = ty + oy, xx = tx + ox;
        if (yy > 0 && yy < H && xx > 0 && xx < W && RT.w[yy * W + xx] === T_LEAF) RT.w[yy * W + xx] = T_AIR;
    }
    drop(tx, ty, 'wood', woodN);
    unlock('timber');
}
function potLoot(tx, ty) {
    var r = Math.random();
    if (r < 0.4) drop(tx, ty, 'coin', 30 + (Math.random() * 60 | 0));
    else if (r < 0.7) drop(tx, ty, 'torch', 3 + (Math.random() * 4 | 0));
    else drop(tx, ty, 'gel', 2 + (Math.random() * 3 | 0));
}
function placeAt() {
    if (RT.panel) return;
    var h = held(); if (!h) return;
    var def = ITEMS[h.id]; if (!def || def.kind !== 'block') return;
    var m = mouseWorld(), tx = Math.floor(m.x / TS), ty = Math.floor(m.y / TS);
    if (tx < 1 || tx >= W - 1 || ty < 1 || ty >= H - 1) return;
    var dxp = tx * TS - S.px, dyp = ty * TS - S.py;
    if (dxp * dxp + dyp * dyp > (5.5 * TS) * (5.5 * TS)) return;
    if (RT.w[ty * W + tx] !== T_AIR) return;
    // must touch something; can't entomb yourself
    var n = SOLID[RT.w[(ty - 1) * W + tx]] || SOLID[RT.w[(ty + 1) * W + tx]] || SOLID[RT.w[ty * W + tx - 1]] || SOLID[RT.w[ty * W + tx + 1]]
        || RT.w[(ty + 1) * W + tx] === T_TORCH || [T_BENCH, T_FURNACE, T_ANVIL].indexOf(RT.w[(ty + 1) * W + tx]) >= 0;
    if (!n && def.place !== T_TORCH) return;
    if (SOLID[def.place]) {
        var px0 = tx * TS, py0 = ty * TS;
        if (px0 < S.px + 10 && px0 + TS > S.px && py0 < S.py + 20 && py0 + TS > S.py) return;
    }
    RT.w[ty * W + tx] = def.place;
    invTake(h.id, 1);
    if (def.place === T_ANVIL) unlock('metal');
    paintHotbar();
}
function swing(dmg) {
    if (RT.swing > 2) return;
    RT.swing = 10;
    var reach = 22, cx = S.px + 5 + RT.face * 14, cy = S.py + 8;
    RT.foes.forEach(function (f) {
        var dx = f.x - cx, dy = f.y - cy;
        if (dx * dx + dy * dy < reach * reach) hitFoe(f, dmg, RT.face);
    });
    if (RT.boss) {
        var bdx = RT.boss.x - cx, bdy = RT.boss.y - cy;
        if (bdx * bdx + bdy * bdy < (reach + 14) * (reach + 14)) { RT.boss.hp -= dmg; dmgNum(RT.boss.x, RT.boss.y, dmg); if (RT.boss.hp <= 0) killBoss(); }
    }
}
function craft(ri) {
    var r = RECIPES[ri];
    if (!r || !canCraft(r)) return;
    r[3].forEach(function (ing) { invTake(ing[0], ing[1]); });
    var over = invGive(r[0], r[1]);
    if (r[0] === 'bench') unlock('benched');
    if (r[0] === 'anvil') unlock('metal');
    if (r[0] === 'suseye') unlock('boss');
    if (over) drop(Math.floor(S.px / TS), Math.floor(S.py / TS), r[0], over);
    paintPanel(); paintHotbar();
    toast('Crafted ' + ITEMS[r[0]].n + (r[1] > 1 ? ' ×' + r[1] : '') + '.');
}

/* ─────────────── enemies ─────────────── */
function isNight() { return S.time >= DAY; }
function spawnTick() {
    if (RT.foes.length >= 6 || RT.anim % 90 !== 0 || RT.dead) return;
    var deep = S.py / TS > 70;
    var side = Math.random() < 0.5 ? -1 : 1;
    var sx = S.px + side * (300 + Math.random() * 240);
    var tx = Math.floor(sx / TS);
    if (tx < 2 || tx >= W - 2) return;
    var kind;
    if (deep) kind = 'slime';
    else if (isNight()) kind = Math.random() < 0.6 ? 'zombie' : 'eye';
    else if (Math.random() < 0.6) kind = 'slime';
    else return;
    var ty;
    if (kind === 'eye') ty = Math.max(4, Math.floor(S.py / TS) - 8 - Math.random() * 6);
    else {   // find ground near the player's depth
        ty = Math.floor(S.py / TS) - 6;
        var guard = 0;
        while (guard++ < 40 && ty < H - 3 && !SOLID[RT.w[(ty + 1) * W + tx]]) ty++;
        if (guard >= 40) return;
    }
    var pinky = kind === 'slime' && Math.random() < 0.012;
    RT.foes.push({
        kind: kind, x: tx * TS, y: ty * TS, vx: 0, vy: 0,
        hp: kind === 'zombie' ? 45 : kind === 'eye' ? 60 : pinky ? 150 : 16,
        dmg: kind === 'zombie' ? 14 : kind === 'eye' ? 18 : 7,
        pinky: pinky, t: 0, hurtT: 0
    });
}
function foeStep(f) {
    f.t++; if (f.hurtT > 0) f.hurtT--;
    var dx = S.px - f.x, toward = dx > 0 ? 1 : -1;
    if (f.kind === 'slime') {
        f.vy = Math.min(f.vy + 0.17, 5);
        if (SOLID[tileAt(f.x + 4, f.y + 9)]) {
            f.vy = 0; f.vx *= 0.6;
            if (f.t % 100 === 0) { f.vy = -2.6 - Math.random(); f.vx = toward * (0.8 + Math.random() * 0.6); }
        }
        f.x += f.vx; f.y += f.vy;
        if (SOLID[tileAt(f.x + 4, f.y + 4)]) { f.x -= f.vx; f.vx = -f.vx * 0.5; }
    } else if (f.kind === 'zombie') {
        f.vy = Math.min(f.vy + 0.17, 5);
        var onG = SOLID[tileAt(f.x + 4, f.y + 17)];
        if (onG) { f.vy = 0; f.vx = toward * 0.55; }
        var aheadSolid = SOLID[tileAt(f.x + 4 + toward * 6, f.y + 12)];
        if (onG && aheadSolid) f.vy = -3.3;
        f.x += f.vx; f.y += f.vy;
        if (SOLID[tileAt(f.x + 4, f.y + 8)]) { f.x -= f.vx; }
        if (!isNight() && f.t % 60 === 0) f.hp -= 5;   // zombies crumble at dawn
    } else {   // demon eye: lazy sine homing
        var dy = S.py - f.y;
        var d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        f.vx += (dx / d) * 0.05; f.vy += (dy / d) * 0.05 + Math.sin(f.t / 14) * 0.03;
        f.vx = clamp(f.vx, -1.6, 1.6); f.vy = clamp(f.vy, -1.4, 1.4);
        f.x += f.vx; f.y += f.vy;
        if (!isNight() && f.t % 60 === 0) f.hp -= 5;
    }
    // contact damage
    var pdx = (S.px + 5) - (f.x + 4), pdy = (S.py + 10) - (f.y + 6);
    if (Math.abs(pdx) < 10 && Math.abs(pdy) < 14 && RT.iframe <= 0 && !RT.dead) hurt(f.dmg, pdx > 0 ? 1 : -1);
    // gone?
    if (f.hp <= 0) { foeDrops(f); return true; }
    if (Math.abs(f.x - S.px) > 800) return true;
    return false;
}
function hitFoe(f, dmg, dir) {
    if (f.hurtT > 0) return;
    f.hp -= dmg; f.hurtT = 8;
    f.vx = dir * 2.2; f.vy = -1.4;
    dmgNum(f.x, f.y, dmg);
    if (f.hp <= 0) { S.kills++; if (S.kills >= 100) unlock('slayer'); if (f.pinky) unlock('pinky'); }
}
function foeDrops(f) {
    if (f.kind === 'slime') drop(Math.floor(f.x / TS), Math.floor(f.y / TS), 'gel', 1 + (Math.random() * 2 | 0));
    if (f.kind === 'eye' && Math.random() < 0.5) drop(Math.floor(f.x / TS), Math.floor(f.y / TS), 'lens', 1);
    drop(Math.floor(f.x / TS), Math.floor(f.y / TS), 'coin', f.pinky ? 1000 : 8 + (Math.random() * 20 | 0));
}
function drop(tx, ty, id, n) { RT.drops.push({ x: tx * TS + 4, y: ty * TS + 2, vy: -1, id: id, c: n }); }
function dmgNum(x, y, n) { RT.dmgs.push({ x: x, y: y - 6, n: n, t: 40 }); }
function hurt(dmg, dir) {
    S.hp -= dmg; RT.iframe = 42; RT.vx = dir * 2.4; RT.vy = -2;
    dmgNum(S.px, S.py, dmg);
    paintHearts();
    if (S.hp <= 0) die();
}
function die() {
    RT.dead = 300;   // 5s
    var lost = Math.floor(S.coins / 2); S.coins -= lost;
    RT.root.querySelector('.tr-death').hidden = false;
    RT.root.querySelector('.tr-death span').textContent = lost ? 'and dropped ' + coinFmt(lost) + ' on the way down.' : 'The dirt sends its regards.';
    if (RT.boss) { RT.boss = null; RT.root.querySelector('.tr-bosshp').hidden = true; }
    paintCoins();
}
function respawn() {
    S.hp = S.maxhp; S.px = S.spawnx; S.py = S.spawny; RT.vx = RT.vy = 0;
    RT.foes = [];
    RT.root.querySelector('.tr-death').hidden = true;
    paintHearts();
}

/* ─────────────── the Eye of Cthulhu ─────────────── */
function summonEye() {
    if (RT.boss) return;
    if (!isNight()) { toast('The eye twitches. It only answers to the night.'); return; }
    invTake('suseye', 1); paintHotbar();
    spawnBoss();
}
function spawnBoss() {
    RT.boss = { x: S.px - 260, y: S.py - 160, vx: 0, vy: 0, hp: 1400, max: 1400, t: 0, dash: 0 };
    RT.root.querySelector('.tr-bosshp').hidden = false;
    toast('You feel an evil presence watching you…');
}
function bossStep() {
    var b = RT.boss; b.t++;
    var phase2 = b.hp < b.max * 0.5;
    var interval = phase2 ? 110 : 170;
    if (b.dash > 0) {   // committed charge
        b.dash--;
        b.x += b.vx; b.y += b.vy;
    } else {
        // hover above-left/right of the player
        var hx = S.px + (b.t % (interval * 2) < interval ? -120 : 120), hy = S.py - 130;
        b.vx += clamp((hx - b.x) * 0.002, -0.2, 0.2); b.vy += clamp((hy - b.y) * 0.002, -0.2, 0.2);
        b.vx = clamp(b.vx * 0.98, -2.4, 2.4); b.vy = clamp(b.vy * 0.98, -2.2, 2.2);
        b.x += b.vx; b.y += b.vy;
        if (b.t % interval === 0) {   // wind up a dash at the player
            var dx = (S.px + 5) - b.x, dy = (S.py + 10) - b.y, d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            var sp = phase2 ? 5.2 : 4;
            b.vx = dx / d * sp; b.vy = dy / d * sp; b.dash = 34;
        }
    }
    // contact
    var pdx = (S.px + 5) - b.x, pdy = (S.py + 10) - b.y;
    if (Math.abs(pdx) < 18 && Math.abs(pdy) < 18 && RT.iframe <= 0 && !RT.dead) hurt(phase2 ? 23 : 15, pdx > 0 ? 1 : -1);
    // dawn: it flees
    if (!isNight()) { RT.boss = null; RT.root.querySelector('.tr-bosshp').hidden = true; toast('The Eye flees the sunrise. It will remember this.'); }
    var bar = RT.root.querySelector('.tr-bossbar i');
    if (bar) bar.style.width = Math.max(0, b.hp / b.max * 100) + '%';
}
function killBoss() {
    var b = RT.boss; RT.boss = null;
    RT.root.querySelector('.tr-bosshp').hidden = true;
    drop(Math.floor(b.x / TS), Math.floor(b.y / TS), 'coin', 30000);
    for (var i = 0; i < 5; i++) drop(Math.floor(b.x / TS) + i - 2, Math.floor(b.y / TS), 'gel', 2);
    unlock('eye');
    toast('The Eye of Cthulhu has been defeated!');
}

/* ─────────────── achievements / toasts ─────────────── */
function unlock(id) {
    if (S.ach[id]) return;
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
    function lerpC(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
    var day = [122, 178, 235], dusk = [206, 116, 66], night = [12, 14, 34];
    var c;
    if (t < DAY - 30) c = day;
    else if (t < DAY) c = lerpC(day, dusk, (t - (DAY - 30)) / 30);
    else if (t < DAY + 25) c = lerpC(dusk, night, (t - DAY) / 25);
    else if (t < CYCLE - 25) c = night;
    else c = lerpC(night, day, (t - (CYCLE - 25)) / 25);
    return c;
}
function dayLight() {
    var t = S.time;
    if (t < DAY - 30) return 1;
    if (t < DAY) return 1 - 0.8 * (t - (DAY - 30)) / 30;
    if (t < CYCLE - 25) return 0.2;
    return 0.2 + 0.8 * (t - (CYCLE - 25)) / 25;
}
function draw() {
    var cv = RT.cv, host = RT.root;
    var vw = Math.max(200, Math.floor(host.clientWidth / 2)), vh = Math.max(150, Math.floor(host.clientHeight / 2));
    if (cv.width !== vw || cv.height !== vh) { cv.width = vw; cv.height = vh; }
    var x = RT.x = cv.getContext('2d');
    // camera
    RT.cam.x = clamp(S.px - vw / 2, 0, W * TS - vw);
    RT.cam.y = clamp(S.py - vh / 2, 0, H * TS - vh);
    var cx = RT.cam.x, cy = RT.cam.y;
    // sky
    var sk = skyColor();
    x.fillStyle = 'rgb(' + (sk[0] | 0) + ',' + (sk[1] | 0) + ',' + (sk[2] | 0) + ')';
    x.fillRect(0, 0, vw, vh);
    var dl = dayLight();
    if (dl < 0.5) {   // stars
        x.fillStyle = 'rgba(255,255,255,' + (0.9 - dl) + ')';
        for (var st = 0; st < 40; st++) {
            var sx2 = ((st * 89 + 31) % vw), sy2 = ((st * 53 + (st % 7) * 19) % Math.floor(vh * 0.6));
            x.fillRect(sx2, sy2, 1, 1);
        }
    }
    // sun / moon
    var phase = (S.time % CYCLE) / (isNight() ? 1 : 1);
    var arcT = isNight() ? (S.time - DAY) / NIGHT : S.time / DAY;
    var ox = vw * arcT, oy2 = vh * 0.25 - Math.sin(arcT * Math.PI) * vh * 0.15;
    x.fillStyle = isNight() ? '#d8d8e8' : '#ffe07a';
    x.fillRect(ox - 5, oy2 - 5, 10, 10);
    x.fillStyle = isNight() ? '#b8b8cc' : '#ffc23a';
    x.fillRect(ox - 3, oy2 - 3, 6, 6);

    // visible tile range
    var x0 = Math.floor(cx / TS), y0 = Math.floor(cy / TS);
    var x1 = Math.min(W - 1, x0 + Math.ceil(vw / TS) + 1), y1 = Math.min(H - 1, y0 + Math.ceil(vh / TS) + 1);
    // light map
    var lw = x1 - x0 + 1, lh = y1 - y0 + 1;
    var L = computeLight(x0, y0, lw, lh, dl);
    // tiles
    for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
        var t = RT.w[ty * W + tx];
        var sx = tx * TS - cx, sy = ty * TS - cy;
        // enclosed air wears a cave wall (dirt-dark near the surface, stone-dark below, ash-dark in hell)
        if (RT.wallMap && RT.wallMap[(ty - y0) * lw + (tx - x0)]) {
            x.fillStyle = ty >= HELL ? '#241418' : ty > 66 ? '#26222c' : '#382a20';
            x.fillRect(sx, sy, TS, TS);
        }
        if (t === T_AIR) continue;
        if (t === T_TORCH) { drawTorch(x, sx, sy); continue; }
        if (t === T_LAVA) { x.fillStyle = ((tx + ty + (RT.anim >> 4)) % 3) ? '#e06018' : '#ff8a2a'; x.fillRect(sx, sy + 2, TS, TS - 2); continue; }
        if (t === T_BENCH) { drawBench(x, sx, sy); continue; }
        if (t === T_FURNACE) { drawFurnace(x, sx, sy); continue; }
        if (t === T_ANVIL) { drawAnvil(x, sx, sy); continue; }
        if (t === T_POT) { drawPot(x, sx, sy); continue; }
        if (t === T_HEART) { drawHeart(x, sx, sy); continue; }
        var col = TCOL[t] || ['#f0f', '#a0a'];
        x.fillStyle = col[0]; x.fillRect(sx, sy, TS, TS);
        x.fillStyle = col[1];
        x.fillRect(sx + ((tx * 7 + ty * 13) % 5), sy + ((tx * 11 + ty * 5) % 5), 2, 2);
        if (ORE_ITEM[t]) { x.fillStyle = col[0]; x.fillRect(sx + 1, sy + 1, 3, 2); x.fillRect(sx + 4, sy + 5, 3, 2); }
        if (t === T_GRASS) { x.fillStyle = '#5db44a'; x.fillRect(sx, sy, TS, 2); }
    }
    // crack overlay on the tile being mined
    if (RT.mineT.p > 0.1) {
        var mt = RT.w[RT.mineT.y * W + RT.mineT.x];
        if (mt && HARD[mt]) {
            var frac = RT.mineT.p / HARD[mt];
            x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = 1;
            var mx0 = RT.mineT.x * TS - cx, my0 = RT.mineT.y * TS - cy;
            x.beginPath(); x.moveTo(mx0 + 2, my0 + 2); x.lineTo(mx0 + 2 + frac * 5, my0 + 2 + frac * 4);
            if (frac > 0.5) { x.moveTo(mx0 + 6, my0 + 1); x.lineTo(mx0 + 6 - frac * 4, my0 + 1 + frac * 6); }
            x.stroke();
        }
    }
    // drops
    RT.drops.forEach(function (d) { drawItemMini(x, d.id, d.x - cx - 3, d.y - cy - 3); });
    // foes
    RT.foes.forEach(function (f) { drawFoe(x, f, cx, cy); });
    if (RT.boss) drawBoss(x, RT.boss, cx, cy);
    // player
    if (!RT.dead) drawPlayer(x, S.px - cx, S.py - cy);
    // lighting overlay (dithered darkness)
    for (ty = 0; ty < lh; ty++) for (tx = 0; tx < lw; tx++) {
        var lv = L[ty * lw + tx];
        if (lv >= 0.97) continue;
        var dark = 1 - lv;
        x.fillStyle = 'rgba(4,5,12,' + dark.toFixed(2) + ')';
        x.fillRect((x0 + tx) * TS - cx, (y0 + ty) * TS - cy, TS, TS);
    }
    // damage numbers
    x.font = '7px monospace'; x.textAlign = 'center';
    RT.dmgs.forEach(function (g) {
        x.fillStyle = 'rgba(0,0,0,.6)'; x.fillText(g.n, g.x - cx + 1, g.y - cy + 1);
        x.fillStyle = '#ff9a3a'; x.fillText(g.n, g.x - cx, g.y - cy);
    });
    // cursor tile outline
    if (!RT.panel) {
        var m = mouseWorld(), htx = Math.floor(m.x / TS), hty = Math.floor(m.y / TS);
        x.strokeStyle = 'rgba(255,255,255,.35)'; x.strokeRect(htx * TS - cx + 0.5, hty * TS - cy + 0.5, TS - 1, TS - 1);
    }
    // depth meter text
    var depthT = S.py / TS < 46 ? 'Surface' : S.py / TS < 70 ? 'Underground' : S.py / TS < HELL ? 'Caverns' : 'Underworld';
    RT.root.querySelector('.tr-depth').textContent = depthT + ' · ' + (isNight() ? 'Night' : 'Day') + ' ' + S.day;
}
function computeLight(x0, y0, lw, lh, dl) {
    var L = new Float32Array(lw * lh);
    var wall = new Uint8Array(lw * lh);   // enclosed air: draw a cave wall, not the sky
    // seeds: sky columns (scanned from the REAL sky at world row 0) + torches + lava + hearts
    for (var tx = 0; tx < lw; tx++) {
        var open = true, wx = x0 + tx;
        for (var wy = 0; wy < y0; wy++) if (SOLID[RT.w[wy * W + wx]]) { open = false; break; }
        for (var ty = 0; ty < lh; ty++) {
            var wt = RT.w[(y0 + ty) * W + wx];
            if (open && SOLID[wt]) open = false;
            var i = ty * lw + tx;
            if (open) L[i] = dl;
            else if (wt === T_AIR || wt === T_TORCH || wt === T_POT || wt === T_HEART || wt === T_BENCH || wt === T_FURNACE || wt === T_ANVIL) wall[i] = 1;
            if (wt === T_TORCH) L[i] = 1;
            if (wt === T_LAVA) L[i] = 0.85;
            if (wt === T_HEART) L[i] = 0.55;
            if (wt === T_FURNACE) L[i] = 0.7;
        }
    }
    RT.wallMap = wall;
    // player glow (a modest personal lantern, for playability)
    var pxl = Math.floor(S.px / TS) - x0, pyl = Math.floor(S.py / TS) - y0;
    if (pxl >= 0 && pxl < lw && pyl >= 0 && pyl < lh) L[pyl * lw + pxl] = Math.max(L[pyl * lw + pxl], 0.45);
    // diffuse
    for (var pass = 0; pass < 7; pass++) {
        for (var y = 0; y < lh; y++) for (var xx = 0; xx < lw; xx++) {
            i = y * lw + xx;
            var solid = SOLID[RT.w[(y0 + y) * W + (x0 + xx)]];
            var f = solid ? 0.62 : 0.8;
            var best = L[i];
            if (xx > 0) best = Math.max(best, L[i - 1] * f);
            if (xx < lw - 1) best = Math.max(best, L[i + 1] * f);
            if (y > 0) best = Math.max(best, L[i - lw] * f);
            if (y < lh - 1) best = Math.max(best, L[i + lw] * f);
            L[i] = best;
        }
    }
    return L;
}
/* sprites */
function drawPlayer(x, px2, py2) {
    var blink = RT.iframe > 0 && (RT.anim >> 2) % 2;
    if (blink) return;
    var wf = RT.ground && Math.abs(RT.vx) > 0.3 ? (RT.anim >> 3) % 2 : 0;
    x.fillStyle = '#4a3020'; x.fillRect(px2 + 2, py2, 6, 4);                 // hair
    x.fillStyle = '#e8c9a8'; x.fillRect(px2 + 2, py2 + 3, 6, 4);             // face
    x.fillStyle = '#d81e05'; x.fillRect(px2 + 1, py2 + 7, 8, 6);             // URE red shirt
    x.fillStyle = '#31518c'; x.fillRect(px2 + 2, py2 + 13, 3, 7 - wf);       // legs
    x.fillRect(px2 + 6, py2 + 13 + wf, 3, 7 - wf);
    if (RT.swing > 0) {   // sword arc
        var pr = 12 + (10 - RT.swing);
        x.strokeStyle = 'rgba(230,230,245,.8)'; x.lineWidth = 2;
        x.beginPath();
        x.arc(px2 + 5, py2 + 8, pr, RT.face > 0 ? -1.1 : Math.PI - 0.4, RT.face > 0 ? 0.4 : Math.PI + 1.1);
        x.stroke();
    }
}
function drawFoe(x, f, cx, cy) {
    var fx = f.x - cx, fy = f.y - cy;
    var flash = f.hurtT > 4;
    if (f.kind === 'slime') {
        var sq = SOLID[tileAt(f.x + 4, f.y + 9)] ? 1 : 0;
        x.fillStyle = flash ? '#fff' : f.pinky ? 'rgba(240,130,190,.9)' : 'rgba(80,140,240,.85)';
        x.fillRect(fx, fy + 2 + sq, 9, 7 - sq);
        x.fillRect(fx + 1, fy + 1 + sq, 7, 1);
        x.fillStyle = '#111'; x.fillRect(fx + 2, fy + 4, 1, 2); x.fillRect(fx + 6, fy + 4, 1, 2);
    } else if (f.kind === 'zombie') {
        x.fillStyle = flash ? '#fff' : '#5d8544'; x.fillRect(fx + 2, fy, 5, 4);
        x.fillStyle = flash ? '#fff' : '#4a6a38'; x.fillRect(fx + 1, fy + 4, 7, 8);
        x.fillStyle = flash ? '#fff' : '#3a5230'; x.fillRect(fx + 2, fy + 12, 2, 5); x.fillRect(fx + 5, fy + 12, 2, 5);
        x.fillStyle = '#c22'; x.fillRect(fx + 3, fy + 1, 1, 1); x.fillRect(fx + 5, fy + 1, 1, 1);
    } else {
        x.fillStyle = flash ? '#fff' : '#d8d8e0'; x.fillRect(fx, fy, 8, 8);
        x.fillStyle = '#8a2222'; x.fillRect(fx + (f.vx > 0 ? 4 : 1), fy + 2, 3, 4);
        x.fillStyle = '#111'; x.fillRect(fx + (f.vx > 0 ? 5 : 2), fy + 3, 1, 2);
        x.fillStyle = flash ? '#fff' : '#b04a4a'; x.fillRect(fx - (f.vx > 0 ? 3 : -8), fy + 2, 3, 3);
    }
}
function drawBoss(x, b, cx, cy) {
    var bx = b.x - cx, by = b.y - cy;
    x.fillStyle = '#d8d0c8'; x.beginPath(); x.arc(bx, by, 14, 0, 7); x.fill();
    x.fillStyle = '#b8a8a0'; x.beginPath(); x.arc(bx, by + 3, 12, 0, Math.PI); x.fill();
    var dx = (S.px - b.x), dy = (S.py - b.y), d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    x.fillStyle = '#3a6ad8'; x.beginPath(); x.arc(bx + dx / d * 5, by + dy / d * 5, 6, 0, 7); x.fill();
    x.fillStyle = '#111'; x.beginPath(); x.arc(bx + dx / d * 7, by + dy / d * 7, 3, 0, 7); x.fill();
    x.strokeStyle = '#8a2222'; x.lineWidth = 2;
    for (var tn = 0; tn < 4; tn++) {
        x.beginPath(); x.moveTo(bx - 6 + tn * 4, by + 12);
        x.lineTo(bx - 8 + tn * 5 + Math.sin((RT.anim + tn * 9) / 7) * 3, by + 20 + (tn % 2) * 3);
        x.stroke();
    }
}
function drawTorch(x, sx, sy) {
    x.fillStyle = '#7a5228'; x.fillRect(sx + 3, sy + 3, 2, 5);
    x.fillStyle = (RT.anim >> 3) % 2 ? '#ffb03a' : '#ff8a2a'; x.fillRect(sx + 2, sy + 1, 4, 3);
    x.fillStyle = '#fff2c0'; x.fillRect(sx + 3, sy + 1, 2, 1);
}
function drawBench(x, sx, sy) { x.fillStyle = '#9c7040'; x.fillRect(sx, sy + 2, TS, 2); x.fillRect(sx + 1, sy + 4, 2, 4); x.fillRect(sx + 5, sy + 4, 2, 4); }
function drawFurnace(x, sx, sy) { x.fillStyle = '#63636b'; x.fillRect(sx, sy, TS, TS); x.fillStyle = (RT.anim >> 3) % 2 ? '#ff8a2a' : '#e06018'; x.fillRect(sx + 2, sy + 4, 4, 3); }
function drawAnvil(x, sx, sy) { x.fillStyle = '#4a4a54'; x.fillRect(sx + 1, sy + 3, 6, 2); x.fillRect(sx + 2, sy + 5, 4, 1); x.fillRect(sx + 1, sy + 6, 6, 2); }
function drawPot(x, sx, sy) { x.fillStyle = '#a8763a'; x.fillRect(sx + 2, sy + 2, 4, 1); x.fillRect(sx + 1, sy + 3, 6, 4); x.fillStyle = '#8a5f2e'; x.fillRect(sx + 2, sy + 7, 4, 1); }
function drawHeart(x, sx, sy) { x.fillStyle = '#e04a6a'; x.fillRect(sx + 1, sy + 2, 2, 2); x.fillRect(sx + 5, sy + 2, 2, 2); x.fillRect(sx + 1, sy + 3, 6, 2); x.fillRect(sx + 2, sy + 5, 4, 1); x.fillRect(sx + 3, sy + 6, 2, 1); x.fillStyle = '#ff9ab0'; x.fillRect(sx + 2, sy + 3, 1, 1); }
function drawItemMini(x, id, sx, sy) {
    var c = { wood: '#9c7040', dirt: '#6b4a2a', stone: '#7a7a82', ash: '#4a4550', torch: '#ffb03a', gel: '#508cf0',
        cop: '#c07038', iron: '#b0a49a', silv: '#d8dce6', gold: '#e0b83a', cbar: '#c07038', ibar: '#b0a49a', sbar: '#d8dce6', gbar: '#e0b83a',
        lens: '#d8d8e0', coin: '#e8c23a', bench: '#9c7040', furnace: '#63636b', anvil: '#4a4a54', suseye: '#8a2222' }[id] || '#ccc';
    x.fillStyle = c; x.fillRect(sx, sy, 5, 5);
    x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(sx, sy, 2, 1);
}

/* ─────────────── HUD painters (DOM) ─────────────── */
function paintHotbar() {
    var hb = RT.root.querySelector('.tr-hotbar');
    var html = '';
    for (var i = 0; i < 10; i++) {
        var s = S.inv[i];
        html += '<div class="tr-slot' + (i === S.sel ? ' sel' : '') + '" data-i="' + i + '" data-tip="' + (s ? esc(ITEMS[s.id].n + (ITEMS[s.id].tip ? ' — ' + ITEMS[s.id].tip : '')) : '') + '">' +
            (s ? itemIcon(s.id) + (s.c > 1 ? '<i>' + s.c + '</i>' : '') : '') +
            '<u>' + ((i + 1) % 10) + '</u></div>';
    }
    hb.innerHTML = html;
    if (RT.panel) paintPanel();
}
function paintPanel() {
    var inv = RT.root.querySelector('.tr-inv'), html = '<h4>Inventory</h4><div class="tr-grid">';
    for (var i = 0; i < 30; i++) {
        var s = S.inv[i];
        html += '<div class="tr-slot' + (i === S.sel ? ' sel' : '') + '" data-i="' + i + '" data-tip="' + (s ? esc(ITEMS[s.id].n) : '') + '">' +
            (s ? itemIcon(s.id) + (s.c > 1 ? '<i>' + s.c + '</i>' : '') : '') + '</div>';
    }
    inv.innerHTML = html + '</div><p class="tr-invhint">Click a row-2 slot to swap it with the selected hotbar slot.</p>';
    var rl = RT.root.querySelector('.tr-recipes'), rh = '';
    RECIPES.forEach(function (r, i) {
        var ok = canCraft(r);
        var ings = r[3].map(function (g) { return ITEMS[g[0]].n + ' ×' + g[1]; }).join(', ');
        rh += '<button class="tr-rec' + (ok ? '' : ' cant') + '" data-r="' + i + '" data-tip="' + esc(ings + (r[2] ? ' — needs ' + r[2] : '')) + '">' +
            itemIcon(r[0]) + '<span>' + esc(ITEMS[r[0]].n) + (r[1] > 1 ? ' ×' + r[1] : '') + '</span></button>';
    });
    rl.innerHTML = rh;
}
function itemIcon(id) {
    var def = ITEMS[id];
    var col = { pick: '#b0a49a', axe: '#b0894a', sword: '#d8d8e0' }[def.kind];
    var tier = { c: '#c07038', i: '#b0a49a', s: '#d8dce6', g: '#e0b83a' }[id.charAt(0)];
    if (def.kind === 'pick') return '<em class="tri tri-pick" style="background:' + (tier || col) + '"></em>';
    if (def.kind === 'axe') return '<em class="tri tri-axe" style="background:' + (tier || col) + '"></em>';
    if (def.kind === 'sword') return '<em class="tri tri-sword" style="background:' + (tier || col) + '"></em>';
    var c = { wood: '#9c7040', dirt: '#6b4a2a', stone: '#7a7a82', ash: '#4a4550', torch: '#ffb03a', gel: '#508cf0',
        cop: '#c07038', iron: '#b0a49a', silv: '#d8dce6', gold: '#e0b83a', cbar: '#a3672a', ibar: '#8f867d', sbar: '#b8bcc9', gbar: '#c9a22e',
        lens: '#d8d8e0', bench: '#9c7040', furnace: '#63636b', anvil: '#4a4a54', suseye: '#8a2222' }[id] || '#ccc';
    return '<em class="tri" style="background:' + c + '"></em>';
}
function paintHearts() {
    var el = RT.root.querySelector('.tr-hearts'), n = Math.ceil(S.maxhp / 20), html = '';
    for (var i = 0; i < n; i++) {
        var fill = clamp(S.hp - i * 20, 0, 20) / 20;
        html += '<span class="tr-heart' + (fill <= 0 ? ' empty' : fill < 1 ? ' half' : '') + '"></span>';
    }
    el.innerHTML = html + '<b>' + Math.max(0, S.hp) + '/' + S.maxhp + '</b>';
}
function coinFmt(c) {
    var g = Math.floor(c / 10000), s = Math.floor(c % 10000 / 100), cp = c % 100, out = [];
    if (g) out.push(g + ' gold'); if (s) out.push(s + ' silver'); if (cp || !out.length) out.push(cp + ' copper');
    return out.join(' ');
}
function paintCoins() { RT.root.querySelector('.tr-coins').textContent = coinFmt(S.coins); }
function wireTip(root) {
    root.addEventListener('mousemove', function (e) {
        var t = e.target.closest('[data-tip]'), tip = root.querySelector('.tr-tip');
        if (!t || !t.getAttribute('data-tip')) { tip.hidden = true; return; }
        tip.textContent = t.getAttribute('data-tip'); tip.hidden = false;
        var rr = root.getBoundingClientRect();
        tip.style.left = clamp(e.clientX - rr.left + 12, 4, rr.width - 220) + 'px';
        tip.style.top = clamp(e.clientY - rr.top + 14, 4, rr.height - 40) + 'px';
    });
}

/* ─────────────── lifecycle / Steam ─────────────── */
function close() {
    var hrs = RT ? (Date.now() - RT.started) / 3600000 : 0;
    if (RT) {
        cancelAnimationFrame(RT.raf);
        RT.timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
        window.removeEventListener('pointerup', RT.mup);
        S.tiles = packWorld(RT.w);
        RT = null;
    }
    sSave();
    return Math.round(hrs * 10) / 10;
}
function steamAch() {
    sLoad();
    var n = 0; ACH.forEach(function (a) { if (S.ach[a[0]]) n++; });
    return { n: n, total: ACH.length, list: ACH.map(function (a) { return [a[1], a[2], S.ach[a[0]] ? 1 : 0]; }) };
}

window.TERRA = { render: render, init: init, close: close, steamAch: steamAch };
})();
