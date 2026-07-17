/* ============================================================
   URE ROOM 1P — isaac's apartment in first person
   The same floor plan, walked through. A hand-rolled grid
   raycaster (the Wolfenstein kind) for the walls, plus real 3d
   furniture: every piece is boxes, drawn as perspective quads
   into a per-pixel depth buffer seeded from the walls, so
   furniture occludes furniture (and walls) honestly. Distance
   fog, a real-clock sky in the windows. Zero dependencies.
   The glowing thing on the desk still goes somewhere.
   ============================================================ */
(function () {
'use strict';

/* ─────────────────────────── core ─────────────────────────── */
var W = 320, H = 180;                              // native buffer, 16:9 and chunky
var buf = document.createElement('canvas');
buf.width = W; buf.height = H;
var ctx = buf.getContext('2d');

var disp = null, dctx = null, holder = null, promptEl = null;
var rafId = 0, lastTs = 0, T = 0, FR = 0;
var REDUCE_MQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
var reduce = !!(REDUCE_MQ && REDUCE_MQ.matches);
if (REDUCE_MQ) {
    var onReduceChange = function (e) { reduce = e.matches; needsDraw = true; };
    if (REDUCE_MQ.addEventListener) REDUCE_MQ.addEventListener('change', onReduceChange);
    else if (REDUCE_MQ.addListener) REDUCE_MQ.addListener(onReduceChange);
}
var needsDraw = true;

function byId(id) { return document.getElementById(id); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function thash(x, y) { var n = (x * 374761393 + y * 668265263) >>> 0; n = (n ^ (n >> 13)) * 1274126177 >>> 0; return ((n ^ (n >> 16)) >>> 0) / 4294967295; }
function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
    var g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
    var b = clamp(Math.round((n & 255) * f), 0, 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function box1(g, x, y, w, h, c) { R(g, x, y, w, 1, c); R(g, x, y + h - 1, w, 1, c); R(g, x, y, 1, h, c); R(g, x + w - 1, y, 1, h, c); }

/* ───────────────────────── palette ────────────────────────── */
var P = {
    k: '#15151a',
    red: '#d81e05', red2: '#8f1305',
    wall: '#ded8c6', wallDk: '#c9c3b0',
    fl: '#8a6240', ceil: '#cfc9b8',
    tile: '#dfe4e5', tile2: '#b7bfc2',
    wd1: '#a8794e', wd2: '#7c5636', wd3: '#573b26',
    cream: '#e6e1d1', cream2: '#c8c2af',
    cow: '#f4f2e6', cowDk: '#26262b',
    duv: '#dcd6c4', blank: '#5e93cf',
    slate: '#454c57', kcab: '#4a4f58', ktop: '#d9d5c7',
    steel: '#9aa3ad', steel2: '#6f7883', porc: '#eff0ec', water: '#cfe0e4',
    grn: '#5d8544', grn2: '#42663a', pot: '#b06a4a',
    teal: '#1f9e98', purp: '#7b53c9', gold: '#e8c04a', yell: '#f4dd7c',
    glass: '#39434d', shell: '#d9d8cf', dmg: '#9bbc0f'
};

/* ─────────────────────── time of day ──────────────────────── */
function phaseNow() {
    var h = new Date().getHours();
    if (h >= 6 && h < 10) return 'morning';
    if (h >= 10 && h < 17) return 'day';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
}
var curPhase = phaseNow();
function skyColors() {
    if (curPhase === 'night') return ['#1d2030', '#12141f'];
    if (curPhase === 'morning') return ['#f2c98a', '#e8b06a'];
    if (curPhase === 'evening') return ['#e8894a', '#c05a3a'];
    return ['#8fb4d8', '#a8c8e4'];
}

/* ============================================================
   MAP — 40x52 cells, one cell = 8 plan px (~20cm).
   ids: 0 open · 1 drywall · 2 window · 3 bath tile · 4 front
   door · 5 the tv wall
   ============================================================ */
var MW = 40, MH = 52;
var MAP = [];
function setWall(c0, r0, c1, r1, id) {
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) MAP[r][c] = id;
}
function buildMap() {
    for (var r = 0; r < MH; r++) { MAP[r] = []; for (var c = 0; c < MW; c++) MAP[r][c] = 0; }
    setWall(0, 0, 39, 0, 1);                     // north
    setWall(0, 51, 39, 51, 1);                   // south
    setWall(0, 0, 0, 51, 1);                     // west
    setWall(39, 0, 39, 51, 1);                   // east
    setWall(4, 0, 10, 0, 2);                     // bedroom window
    setWall(31, 0, 37, 0, 2);                    // living window
    /* (the tv is a wall-mounted sprite, not a texture: cells repeat too small) */
    setWall(39, 5, 39, 11, 2);                   // living east window
    setWall(39, 38, 39, 43, 2);                  // kitchen window
    setWall(0, 37, 0, 42, 2);                    // bath window
    setWall(16, 51, 20, 51, 4);                  // front door
    setWall(15, 1, 15, 50, 1);                   // V1 spine
    setWall(15, 17, 15, 19, 0);                  // bedroom door
    setWall(15, 25, 15, 27, 0);                  // closet opening
    setWall(15, 34, 15, 36, 0);                  // bathroom door
    setWall(1, 20, 14, 20, 1);                   // H1 bed/closet
    setWall(1, 29, 14, 29, 3);                   // H2 closet/bath
    setWall(21, 24, 21, 50, 1);                  // V2 hall/kitchen
    /* bath walls in tile (exterior sides only: V1's hall face stays drywall) */
    setWall(0, 30, 0, 51, 3);
    setWall(0, 37, 0, 42, 2);                    // keep the window
    setWall(1, 51, 14, 51, 3);
}

/* ─────────────────────── textures ─────────────────────────── */
var TW = 32, TH = 64;
var TEX = {};
function texDrywall() {
    var c = mk(TW, TH), g = c.getContext('2d');
    R(g, 0, 0, TW, TH, P.wall);
    for (var i = 0; i < 90; i++) {
        var hx = thash(i * 7, i * 13);
        if (hx > 0.6) R(g, Math.floor(thash(i, 3) * TW), Math.floor(hx * (TH - 12)), 2, 1, hx > 0.82 ? '#e8e2d0' : P.wallDk);
    }
    R(g, 0, 0, TW, 2, P.wallDk);
    R(g, 0, TH - 8, TW, 6, P.wd3);               // baseboard
    R(g, 0, TH - 8, TW, 1, shade(P.wd3, 1.4));
    R(g, 0, TH - 2, TW, 2, P.k);
    return c;
}
function texWindow() {
    /* seamless window band: glass full-width with a mullion at the seam, so
       per-cell repetition reads as one long window wall, not prison bars */
    var c = mk(TW, TH), g = c.getContext('2d');
    g.drawImage(TEX[1], 0, 0);
    var sky = skyColors();
    R(g, 0, 10, TW, 30, sky[0]);
    R(g, 0, 26, TW, 14, sky[1]);
    if (curPhase === 'night') {
        for (var i = 0; i < 8; i++) {
            var hx = thash(i * 11, i * 5);
            if (hx > 0.35) R(g, Math.floor(thash(i, 7) * (TW - 2)), 12 + Math.floor(hx * 22), 1, 1, P.yell);
        }
    } else if (curPhase === 'day') {
        R(g, 7, 15, 8, 2, '#e8f0f8'); R(g, 9, 14, 4, 4, '#e8f0f8');
    }
    R(g, 0, 8, TW, 2, P.wd3);                    // head frame
    R(g, 0, 40, TW, 2, P.wd3);
    R(g, 0, 10, 1, 30, P.wd3);                   // slim mullion at the seam
    R(g, 0, 24, TW, 1, 'rgba(21,21,26,0.55)');   // transom line
    R(g, 0, 42, TW, 3, P.wallDk);                // sill
    return c;
}
function texTile() {
    /* horizontal bands only: vertical grout at cell width reads as pinstripes */
    var c = mk(TW, TH), g = c.getContext('2d');
    R(g, 0, 0, TW, TH, P.tile);
    g.fillStyle = P.tile2;
    for (var y = 9; y < TH - 8; y += 10) g.fillRect(0, y, TW, 1);
    for (var i = 0; i < 26; i++) { var hx = thash(i * 3, i * 17); if (hx > 0.7) R(g, Math.floor(thash(i, 9) * (TW - 3)), Math.floor(hx * (TH - 12)), 3, 1, '#eef2f2'); }
    R(g, 0, 28, TW, 2, P.teal);                  // accent stripe
    R(g, 0, TH - 8, TW, 6, P.tile2);
    R(g, 0, TH - 2, TW, 2, P.k);
    return c;
}
function texDoor() {
    var c = mk(TW, TH), g = c.getContext('2d');
    R(g, 0, 0, TW, TH, P.wd1);
    for (var x = 0; x < TW; x += 8) { R(g, x, 0, 1, TH, P.wd2); R(g, x + 7, 0, 1, TH, shade(P.wd1, 1.15)); }
    R(g, 0, 0, TW, 2, P.wd3); R(g, 0, TH - 2, TW, 2, P.wd3);
    box1(g, 3, 6, TW - 6, TH - 14, P.wd3);
    R(g, 24, 32, 4, 6, P.gold);                  // handle
    R(g, 25, 33, 2, 2, shade(P.gold, 1.3));
    return c;
}
function buildTextures() {
    TEX[1] = texDrywall();
    TEX[2] = texWindow();
    TEX[3] = texTile();
    TEX[4] = texDoor();
}

/* ============================================================
   FURNITURE — real 3d boxes. each face is a perspective quad,
   near-clipped, painter-sorted, and strip-rasterized against
   the wall zbuffer so occlusion stays honest.
   x/z in plan px (divided by 8 into cells), heights in cells.
   ============================================================ */
var FURN = [];
function fbox(x0, z0, x1, z1, y0, y1, c, glow) {
    FURN.push({ x0: x0 / 8, z0: z0 / 8, x1: x1 / 8, z1: z1 / 8, y0: y0, y1: y1, c: c, glow: glow || false });
}
var RUGS = [];
function rug(x0, z0, x1, z1, c) {
    RUGS.push({ x0: x0 / 8, z0: z0 / 8, x1: x1 / 8, z1: z1 / 8, c: c });
}
/* collision: circles for chairs and small things, rects for slabs */
var CIRC = [], RECTS = [];
function circ(px, pz, r) { CIRC.push({ x: px / 8, z: pz / 8, r: r }); }
function rectC(x0, z0, x1, z1) { RECTS.push({ x0: x0 / 8, z0: z0 / 8, x1: x1 / 8, z1: z1 / 8 }); }

/* the sun is pinned to the world; faces relight as you turn */
var SUN = (function () {
    var v = { x: 0.45, y: 0.78, z: -0.42 };
    var l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return { x: v.x / l, y: v.y / l, z: v.z / l };
})();
function faceLight(nx, ny, nz) {
    var d = nx * SUN.x + ny * SUN.y + nz * SUN.z;
    return 0.58 + 0.42 * Math.max(0, d);
}
var LIGHT = (function () {
    var top = faceLight(0, 1, 0);
    return {
        top: 1, bot: 0.5,
        xp: faceLight(1, 0, 0) / top, xn: faceLight(-1, 0, 0) / top,
        zp: faceLight(0, 0, 1) / top, zn: faceLight(0, 0, -1) / top
    };
})();
/* blend a hex toward the fog color */
function mix(hex, t) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.round(((n >> 16) & 255) * (1 - t) + 12 * t);
    var g = Math.round(((n >> 8) & 255) * (1 - t) + 14 * t);
    var b = Math.round((n & 255) * (1 - t) + 22 * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

var GLOWP = { x: 26.3, z: 4.94, y: 4.9 };          // the URE BOY, for glow + prompt

function buildFurniture() {
    FURN.length = 0; RUGS.length = 0; CIRC.length = 0; RECTS.length = 0;

    /* rugs are floor quads */
    rug(186, 66, 282, 162, P.red2);
    rug(194, 74, 274, 154, '#7c1004');
    rug(40, 112, 88, 152, P.teal);
    rug(134, 252, 162, 344, P.red2);

    /* ── living room ── */
    /* couch: base, back, arms, cushions, pillows */
    fbox(192, 128, 260, 158, 0, 2.2, P.cream);
    fbox(192, 150, 260, 158, 0, 4.2, P.cream2);
    fbox(192, 128, 199, 158, 0, 3.1, P.cream2);
    fbox(253, 128, 260, 158, 0, 3.1, P.cream2);
    fbox(200, 130, 225, 149, 2.2, 2.9, '#f2eee0');
    fbox(228, 130, 253, 149, 2.2, 2.9, '#f2eee0');
    fbox(203, 147, 213, 151, 2.9, 4.0, P.blank);
    fbox(240, 147, 250, 151, 2.9, 4.0, P.gold);
    rectC(190, 126, 262, 160);
    /* cow chair: seat, back, arms, ears, patches */
    fbox(272, 118, 302, 150, 0, 2.4, P.cow);
    fbox(272, 142, 302, 150, 0, 4.4, P.cow);
    fbox(272, 118, 277, 146, 0, 3.0, P.cow);
    fbox(297, 118, 302, 146, 0, 3.0, P.cow);
    fbox(274, 145, 279, 150, 4.4, 5.0, P.cow);
    fbox(295, 145, 300, 150, 4.4, 5.0, P.cowDk);
    fbox(278, 117.4, 288, 118.2, 0.6, 1.8, P.cowDk);
    fbox(271.4, 124, 272.2, 134, 0.8, 2.2, P.cowDk);
    fbox(282, 141.4, 292, 142.2, 2.6, 3.8, P.cowDk);
    circ(287, 134, 2.2);
    /* coffee table + the d20s */
    fbox(204, 88, 248, 114, 2.0, 2.4, P.wd1);
    fbox(206, 90, 209, 93, 0, 2.0, P.wd2);
    fbox(243, 90, 246, 93, 0, 2.0, P.wd2);
    fbox(206, 109, 209, 112, 0, 2.0, P.wd2);
    fbox(243, 109, 246, 112, 0, 2.0, P.wd2);
    fbox(212, 95, 216, 99, 2.4, 2.9, P.red);
    fbox(222, 100, 226, 104, 2.4, 2.9, P.purp);
    circ(226, 101, 2.6);
    /* desk with pedestal, and on it: mug, THE URE BOY, camera */
    fbox(182, 30, 246, 52, 3.4, 3.8, P.wd1);
    fbox(184, 32, 187, 50, 0, 3.4, P.wd2);
    fbox(227, 31, 244, 51, 0, 3.4, P.wd2);
    fbox(226.4, 30.4, 226.9, 51, 2.0, 2.2, P.wd3);
    fbox(189, 37, 194, 42, 3.8, 4.5, P.porc);
    fbox(207, 37, 214, 42, 3.8, 5.3, P.shell, true);
    fbox(207.8, 41.95, 213.2, 42.6, 4.3, 5.05, P.dmg, true);      // screen faces the room
    fbox(209, 42.6, 212, 42.72, 4.5, 4.85, '#0f380f', true);      // the eye on screen
    fbox(208, 36.6, 213, 37.05, 5.3, 5.55, P.red, true);          // cartridge up top
    fbox(229, 36, 237, 42, 3.8, 4.4, '#2a2a30');
    fbox(230, 35.4, 233, 36, 3.95, 4.25, P.glass);
    rectC(180, 28, 248, 54);
    /* tv on the north wall + glass panel */
    fbox(187, 8.2, 242, 10.4, 4.6, 8.0, '#26262b');
    fbox(190, 10.4, 239, 10.9, 4.85, 7.75, P.glass, true);
    /* plant */
    fbox(134, 38, 144, 48, 0, 1.5, P.pot);
    fbox(132, 36, 146, 50, 1.5, 3.6, P.grn);
    fbox(135, 39, 143, 47, 3.6, 4.6, P.grn2);
    circ(139, 42, 1.2);
    /* floor lamp */
    fbox(299, 40, 301.5, 42.5, 0, 6.5, '#2a2a30');
    fbox(295, 36.5, 305.5, 46, 6.5, 8.2, P.yell, true);
    circ(301, 44, 1.2);

    /* ── flex zone ── */
    /* bookshelf against the hall wall, spines facing east */
    fbox(176, 204, 193, 248, 0, 6, P.wd2);
    var spines = [P.red2, P.teal, P.gold, P.purp, P.grn, P.blank];
    for (var s = 0; s < 3; s++) {
        for (var i = 0; i < 5; i++) {
            fbox(193, 208 + i * 7.4, 194.2, 214 + i * 7.4, 0.7 + s * 2, 2.3 + s * 2, spines[(s * 2 + i) % 6]);
        }
    }
    rectC(174, 202, 196, 250);
    /* record console + platter */
    fbox(284, 204, 310, 246, 0, 3.0, P.wd1);
    fbox(288, 210, 306, 228, 3.0, 3.25, '#17171a');
    fbox(296, 218, 298, 220, 3.25, 3.4, P.red);
    rectC(282, 202, 310, 248);

    /* ── bedroom ── */
    fbox(28, 30, 88, 33.5, 0, 3.4, P.wd2);                     // headboard
    fbox(28, 33.5, 88, 104, 0, 1.0, P.wd2);                    // frame
    fbox(29, 33.5, 87, 103, 1.0, 2.2, P.duv);                  // mattress
    fbox(32, 35, 55, 48, 2.2, 2.9, P.porc);                    // pillows
    fbox(58, 35, 81, 48, 2.2, 2.9, P.porc);
    fbox(29, 72, 87, 103, 2.2, 2.5, P.blank);                  // blanket
    rectC(26, 28, 90, 106);
    fbox(94, 32, 114, 50, 0, 2.0, P.wd1);                      // nightstand
    fbox(102, 39, 106, 43, 2.0, 2.7, '#2a2a30');               // little lamp
    fbox(99, 36, 109, 46, 2.7, 3.5, P.yell, true);
    circ(104, 41, 1.5);
    fbox(12, 112, 32, 156, 0, 3.4, P.wd1);                     // dresser
    fbox(31.6, 118, 32.4, 124, 1.5, 2.1, P.gold);              // knobs
    fbox(31.6, 133, 32.4, 139, 1.5, 2.1, P.gold);
    fbox(31.6, 148, 32.4, 154, 1.5, 2.1, P.gold);
    rectC(10, 110, 34, 158);

    /* ── closet + laundry ── */
    fbox(84, 170, 118, 230, 0, 6.0, P.porc);                   // washer/dryer stack
    fbox(118, 176, 118.8, 196, 1.2, 3.6, P.slate);             // drums face the hall
    fbox(118, 205, 118.8, 225, 1.2, 3.6, P.slate);
    rectC(82, 168, 120, 232);
    fbox(16, 196, 38, 210, 0, 1.8, P.teal);                    // bins + suitcase
    fbox(18, 212, 40, 226, 0, 1.6, P.slate);
    fbox(46, 214, 72, 228, 0, 1.6, P.red2);
    circ(30, 210, 2.4);

    /* ── bathroom ── */
    fbox(14, 348, 110, 400, 0, 2.4, P.porc);                   // tub
    fbox(20, 354, 104, 394, 1.7, 1.9, P.water);
    fbox(103, 370, 107, 374, 2.4, 3.3, P.steel);               // faucet
    rectC(12, 346, 112, 402);
    fbox(14, 296, 32, 301, 1.0, 3.4, P.porc);                  // toilet tank
    fbox(15, 301, 31, 322, 0, 1.8, P.porc);                    // bowl
    circ(23, 309, 1.6);
    fbox(14, 256, 52, 278, 0, 3.0, P.kcab);                    // vanity
    fbox(12.5, 254.5, 53.5, 279.5, 3.0, 3.3, P.ktop);
    fbox(22, 261, 42, 273, 3.3, 3.45, P.steel);                // basin
    fbox(8.2, 259, 9, 276, 4.3, 7.0, '#a8c4d4');               // mirror on the wall
    rectC(12, 254, 54, 280);

    /* ── kitchen ── */
    fbox(284, 288, 310, 406, 0, 4.2, P.kcab);                  // east counter
    fbox(282, 286, 310, 406, 4.2, 4.6, P.ktop);
    fbox(289, 310, 306, 340, 4.6, 4.7, P.steel2);              // sink
    fbox(305, 322, 307, 326, 4.7, 5.6, P.steel);
    rectC(280, 284, 310, 406);
    fbox(176, 384, 208, 406, 0, 4.2, P.kcab);                  // south counter, left of stove
    fbox(174, 384, 208, 406, 4.2, 4.6, P.ktop);
    fbox(244, 384, 310, 406, 0, 4.2, P.kcab);                  // right of stove
    fbox(244, 384, 310, 406, 4.2, 4.6, P.ktop);
    rectC(174, 382, 310, 406);
    fbox(208, 384, 244, 406, 0, 4.4, P.porc);                  // stove
    fbox(208, 384, 244, 406, 4.4, 4.6, '#31363e');
    fbox(212, 386, 222, 396, 4.6, 4.72, P.k);                  // burners
    fbox(228, 386, 238, 396, 4.6, 4.72, P.k);
    fbox(212, 383.4, 240, 384, 1.4, 3.0, '#3d3020');           // oven window
    fbox(252, 387, 276, 402, 4.6, 6.0, '#2a2a30');             // microwave
    fbox(254, 386.4, 270, 387, 4.9, 5.7, P.glass);
    fbox(282, 248, 310, 284, 0, 9.0, P.steel);                 // fridge
    fbox(281.4, 254, 282, 262, 3.4, 5.6, P.steel2);            // handles
    fbox(281.4, 268, 282, 276, 4.2, 5.2, P.steel2);
    rectC(280, 246, 310, 286);
    fbox(200, 296, 244, 356, 0, 4.2, P.kcab);                  // island
    fbox(198, 294, 246, 358, 4.2, 4.6, P.ktop);
    fbox(208, 306, 215, 313, 4.6, 5.5, P.water);               // cookie jar
    fbox(209.5, 307.5, 213.5, 311.5, 5.5, 5.8, P.wd2);
    rectC(196, 292, 248, 360);
    fbox(184, 306, 196, 318, 3.0, 3.5, P.slate);               // stools
    fbox(188.5, 310.5, 191.5, 314.5, 0, 3.0, P.wd2);
    fbox(184, 334, 196, 346, 3.0, 3.5, P.slate);
    fbox(188.5, 338.5, 191.5, 342.5, 0, 3.0, P.wd2);
    circ(190, 312, 1.2); circ(190, 340, 1.2);

    /* ── entry ── */
    fbox(150, 352, 166, 378, 0, 2.6, P.wd1);                   // entry table
    fbox(153, 356, 163, 372, 2.6, 3.1, P.slate);               // key bowl
    circ(158, 365, 1.6);
    fbox(134, 368, 145, 378, 0, 0.8, P.porc);                  // shoes
    fbox(148, 370, 157, 379, 0, 0.7, P.slate);
}

/* ============================================================
   PLAYER + CAMERA
   ============================================================ */
var PLANE = 1.02;                                  // ~91° horizontal fov: room-scale needs wide
var PL = {
    x: 18.5, z: 47.0,
    dirX: 0, dirZ: -1,                             // facing north, up the hall
    planeX: PLANE, planeZ: 0,
    pitch: 0, bobT: 0
};
function rotate(a) {
    var c = Math.cos(a), s = Math.sin(a);
    var dx = PL.dirX * c - PL.dirZ * s;
    PL.dirZ = PL.dirX * s + PL.dirZ * c; PL.dirX = dx;
    var px = PL.planeX * c - PL.planeZ * s;
    PL.planeZ = PL.planeX * s + PL.planeZ * c; PL.planeX = px;
}
/* the retro cheat: camera a touch low + wide fov, so furniture stays in view */
var EYE = 5.5, WALLH = 13, FOCAL = (W / 2) / PLANE;
var PR = 1.25;                                     // player collision radius; doors are 3 cells wide

function solidCell(c, r) {
    if (c < 0 || r < 0 || c >= MW || r >= MH) return true;
    return MAP[r][c] > 0;
}
function tryMove(nx, nz) {
    /* axis-separated slide against wall cells */
    if (!hitsWall(nx, PL.z)) PL.x = nx;
    if (!hitsWall(PL.x, nz)) PL.z = nz;
    /* furniture pushes back — but never into a wall (a raw teleport wedges
       the player in wall overlap and kills whole movement axes) */
    var i, dx, dz, d2, d, px, pz;
    for (i = 0; i < CIRC.length; i++) {
        var s = CIRC[i];
        dx = PL.x - s.x; dz = PL.z - s.z;
        d2 = dx * dx + dz * dz;
        var min = s.r + 0.9;
        if (d2 > 0.0001 && d2 < min * min) {
            d = Math.sqrt(d2);
            px = s.x + dx / d * min; pz = s.z + dz / d * min;
            if (!hitsWall(px, PL.z)) PL.x = px;
            if (!hitsWall(PL.x, pz)) PL.z = pz;
        }
    }
    for (i = 0; i < RECTS.length; i++) {
        var rc = RECTS[i];
        var cx = clamp(PL.x, rc.x0, rc.x1), cz = clamp(PL.z, rc.z0, rc.z1);
        dx = PL.x - cx; dz = PL.z - cz;
        d2 = dx * dx + dz * dz;
        if (d2 >= 0.81) continue;                  // 0.9^2 clearance
        if (d2 > 0.0001) {
            d = Math.sqrt(d2);
            px = cx + dx / d * 0.9; pz = cz + dz / d * 0.9;
            if (!hitsWall(px, PL.z)) PL.x = px;
            if (!hitsWall(PL.x, pz)) PL.z = pz;
        } else {
            /* fully inside (teleport edge case): exit by the shallowest side */
            var exits = [
                { x: rc.x0 - 0.9, z: PL.z, pen: PL.x - rc.x0 + 0.9 },
                { x: rc.x1 + 0.9, z: PL.z, pen: rc.x1 - PL.x + 0.9 },
                { x: PL.x, z: rc.z0 - 0.9, pen: PL.z - rc.z0 + 0.9 },
                { x: PL.x, z: rc.z1 + 0.9, pen: rc.z1 - PL.z + 0.9 }
            ];
            exits.sort(function (a, b) { return a.pen - b.pen; });
            for (var e = 0; e < 4; e++) {
                if (!hitsWall(exits[e].x, exits[e].z)) { PL.x = exits[e].x; PL.z = exits[e].z; break; }
            }
        }
    }
}
function hitsWall(x, z) {
    /* every cell the 2.5-wide body AABB touches — point sampling misses a
       column when the span straddles four cells, and the teleport exits
       (inside-rect eject, dev spawn) can land in that blind gap */
    var c0 = Math.floor(x - PR), c1 = Math.floor(x + PR);
    var r0 = Math.floor(z - PR), r1 = Math.floor(z + PR);
    for (var r = r0; r <= r1; r++) {
        for (var c = c0; c <= c1; c++) {
            if (solidCell(c, r)) return true;
        }
    }
    return false;
}

/* ============================================================
   3D GEOMETRY — perspective quads for the furniture boxes
   ============================================================ */
var NEARD = 0.18;
/* world point -> camera space {lat, y, dep} */
function camPt(wx, wy, wz) {
    var dx = wx - PL.x, dz = wz - PL.z;
    return {
        lat: (dx * PL.planeX + dz * PL.planeZ) / PLANE,
        y: wy,
        dep: dx * PL.dirX + dz * PL.dirZ
    };
}
/* clip a camera-space polygon against the near plane */
function clipNear(poly) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
        var a = poly[i], b = poly[(i + 1) % poly.length];
        var ain = a.dep >= NEARD, bin = b.dep >= NEARD;
        if (ain) out.push(a);
        if (ain !== bin) {
            var t = (NEARD - a.dep) / (b.dep - a.dep);
            out.push({ lat: a.lat + (b.lat - a.lat) * t, y: a.y + (b.y - a.y) * t, dep: NEARD });
        }
    }
    return out.length >= 3 ? out : null;
}
/* world quad -> screen polygon [{x, y, iz}], or null when off-view */
function quadPoly(corners, horizon) {
    var cam = [], behind = 0;
    for (var i = 0; i < 4; i++) {
        var p = camPt(corners[i][0], corners[i][1], corners[i][2]);
        if (p.dep < NEARD) behind++;
        cam.push(p);
    }
    if (behind === 4) return null;
    if (behind > 0) { cam = clipNear(cam); if (!cam) return null; }
    var pts = [], minX = 1e9, maxX = -1e9;
    for (var j = 0; j < cam.length; j++) {
        var c = cam[j];
        var sx = W / 2 + c.lat / c.dep * FOCAL;
        var sy = horizon + (EYE - c.y) / c.dep * FOCAL;
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        pts.push({ x: sx, y: sy, iz: 1 / c.dep });
    }
    if (maxX < 0 || minX >= W) return null;
    return pts;
}
/* rasterize a convex screen polygon per pixel against the shared depth
   buffer (seeded from the walls), so furniture occludes furniture — not
   just walls. iz (inverse depth) is affine in screen space for a plane,
   so it interpolates linearly down each column. */
function drawPoly(pts, col) {
    var n = pts.length, minX = 1e9, maxX = -1e9, i;
    for (i = 0; i < n; i++) { if (pts[i].x < minX) minX = pts[i].x; if (pts[i].x > maxX) maxX = pts[i].x; }
    var x0 = Math.max(0, Math.ceil(minX - 0.5)), x1 = Math.min(W - 1, Math.floor(maxX - 0.5));
    if (x1 < x0) return;
    ctx.fillStyle = col;
    for (var x = x0; x <= x1; x++) {
        var xc = x + 0.5, yT = 1e9, yB = -1e9, izT = 0, izB = 0, found = 0;
        for (i = 0; i < n; i++) {
            var p = pts[i], q = pts[(i + 1) % n];
            if ((p.x <= xc && q.x >= xc) || (q.x <= xc && p.x >= xc)) {
                var span = q.x - p.x;
                var t = span === 0 ? 0 : (xc - p.x) / span;
                var y = p.y + (q.y - p.y) * t;
                var iz = p.iz + (q.iz - p.iz) * t;
                if (y < yT) { yT = y; izT = iz; }
                if (y > yB) { yB = y; izB = iz; }
                found++;
            }
        }
        if (found < 2 || yB <= yT) continue;
        var ry0 = Math.max(0, Math.ceil(yT - 0.5)), ry1 = Math.min(H - 1, Math.floor(yB - 0.5));
        var inv = 1 / (yB - yT), run = -1;
        for (var y2 = ry0; y2 <= ry1; y2++) {
            var izp = izT + (izB - izT) * ((y2 + 0.5 - yT) * inv);
            var idx = y2 * W + x;
            if (izp > DEPTH[idx]) {
                DEPTH[idx] = izp;
                if (run < 0) run = y2;
            } else if (run >= 0) {
                ctx.fillRect(x, run, 1, y2 - run);
                run = -1;
            }
        }
        if (run >= 0) ctx.fillRect(x, run, 1, ry1 + 1 - run);
    }
}
function fogAt(o) {
    var cx = (o.x0 + o.x1) / 2 - PL.x, cz = (o.z0 + o.z1) / 2 - PL.z;
    return clamp(Math.sqrt(cx * cx + cz * cz) / 46, 0, 1) * 0.62;
}
/* push this box's camera-facing faces into the draw list */
function collectFaces(o, faces, horizon) {
    var cx = (o.x0 + o.x1) / 2 - PL.x, cz = (o.z0 + o.z1) / 2 - PL.z;
    var d2 = cx * cx + cz * cz;
    if (d2 > 3136) return;                         // 56 cells: past the longest sightline
    var hw = (o.x1 - o.x0) / 2, hd = (o.z1 - o.z0) / 2;
    var rad = Math.sqrt(hw * hw + hd * hd);
    if (cx * PL.dirX + cz * PL.dirZ < -(rad + 2)) return;   // fully behind, even the long counters
    var fog = clamp(Math.sqrt(d2) / 46, 0, 1) * 0.62;
    var lit = o.glow;
    /* painter key: FARTHEST footprint corner. sorting by centroid lets a
       support slab (desk, table, island) draw after the thing sitting on it
       and erase it — the farthest corner puts the support first, always */
    var fx = Math.max(Math.abs(PL.x - o.x0), Math.abs(PL.x - o.x1));
    var fz = Math.max(Math.abs(PL.z - o.z0), Math.abs(PL.z - o.z1));
    var d = Math.sqrt(fx * fx + fz * fz);
    function put(corners, light) {
        var p = quadPoly(corners, horizon);
        if (p) faces.push({ p: p, c: mix(shade(o.c, lit ? 1 : light), lit ? fog * 0.4 : fog), d: d });
    }
    if (PL.x > o.x1) put([[o.x1, o.y0, o.z0], [o.x1, o.y0, o.z1], [o.x1, o.y1, o.z1], [o.x1, o.y1, o.z0]], LIGHT.xp);
    else if (PL.x < o.x0) put([[o.x0, o.y0, o.z0], [o.x0, o.y0, o.z1], [o.x0, o.y1, o.z1], [o.x0, o.y1, o.z0]], LIGHT.xn);
    if (PL.z > o.z1) put([[o.x0, o.y0, o.z1], [o.x1, o.y0, o.z1], [o.x1, o.y1, o.z1], [o.x0, o.y1, o.z1]], LIGHT.zp);
    else if (PL.z < o.z0) put([[o.x0, o.y0, o.z0], [o.x1, o.y0, o.z0], [o.x1, o.y1, o.z0], [o.x0, o.y1, o.z0]], LIGHT.zn);
    if (EYE > o.y1) put([[o.x0, o.y1, o.z0], [o.x1, o.y1, o.z0], [o.x1, o.y1, o.z1], [o.x0, o.y1, o.z1]], LIGHT.top);
    else if (EYE < o.y0) put([[o.x0, o.y0, o.z0], [o.x1, o.y0, o.z0], [o.x1, o.y0, o.z1], [o.x0, o.y0, o.z1]], LIGHT.bot);
}

/* ============================================================
   RENDER
   ============================================================ */
var ZBUF = new Float32Array(W);                    // per-column wall depth
var IZROW = new Float32Array(W);                   // one row of wall inverse-depth
var DEPTH = new Float32Array(W * H);               // per-pixel inverse depth (bigger = nearer)
function render() {
    var horizon = H / 2 + PL.pitch + (reduce ? 0 : Math.sin(PL.bobT) * 1.6);

    /* ceiling + floor: banded fog toward the horizon */
    var i, bands = 10;
    for (i = 0; i < bands; i++) {
        var f = i / bands;
        R(ctx, 0, horizon * f, W, horizon / bands + 1, shade(P.ceil, 1 - (1 - f) * 0.0 - f * 0.45));
    }
    for (i = 0; i < bands; i++) {
        var f2 = i / bands;
        var y0 = horizon + (H - horizon) * f2;
        R(ctx, 0, y0, W, (H - horizon) / bands + 1, shade(P.fl, 0.5 + f2 * 0.55));
    }

    /* walls via DDA */
    for (var x = 0; x < W; x++) {
        var camX = 2 * x / W - 1;
        var rdx = PL.dirX + PL.planeX * camX;
        var rdz = PL.dirZ + PL.planeZ * camX;
        var mapX = Math.floor(PL.x), mapZ = Math.floor(PL.z);
        var ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
        var ddz = rdz === 0 ? 1e30 : Math.abs(1 / rdz);
        var stepX, stepZ, sdx, sdz;
        if (rdx < 0) { stepX = -1; sdx = (PL.x - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - PL.x) * ddx; }
        if (rdz < 0) { stepZ = -1; sdz = (PL.z - mapZ) * ddz; } else { stepZ = 1; sdz = (mapZ + 1 - PL.z) * ddz; }
        var side = 0, tex = 1, guard = 0;
        while (guard++ < 128) {
            if (sdx < sdz) { sdx += ddx; mapX += stepX; side = 0; } else { sdz += ddz; mapZ += stepZ; side = 1; }
            if (mapX < 0 || mapZ < 0 || mapX >= MW || mapZ >= MH) { tex = 1; break; }
            if (MAP[mapZ][mapX] > 0) { tex = MAP[mapZ][mapX]; break; }
        }
        var dist = side === 0 ? sdx - ddx : sdz - ddz;
        if (dist < 0.05) dist = 0.05;
        ZBUF[x] = dist;
        IZROW[x] = 1 / dist;

        var wallX = side === 0 ? PL.z + dist * rdz : PL.x + dist * rdx;
        wallX -= Math.floor(wallX);
        var texX = Math.floor(wallX * TW);
        if ((side === 0 && rdx > 0) || (side === 1 && rdz < 0)) texX = TW - texX - 1;

        var ppw = FOCAL / dist;                     // pixels per cell at this depth
        var top = horizon - (WALLH - EYE) * ppw;
        var bot = horizon + EYE * ppw;
        ctx.drawImage(TEX[tex], texX, 0, 1, TH, x, top, 1, bot - top);

        /* side + distance shading in one strip */
        var dark = clamp(dist / 46, 0, 1) * 0.62 + (side === 1 ? 0.14 : 0);
        if (dark > 0.02) {
            ctx.globalAlpha = clamp(dark, 0, 0.8);
            ctx.fillStyle = '#0c0e16';
            ctx.fillRect(x, top, 1, bot - top);
            ctx.globalAlpha = 1;
        }
    }

    /* seed the per-pixel depth buffer: every column starts at its wall depth,
       so furniture nearer than the wall draws over it and farther hides behind
       it. native row copies keep this cache-friendly (one memcpy per row). */
    for (i = 0; i < H; i++) DEPTH.set(IZROW, i * W);

    /* rugs: flat quads on the floor, depth-tested like everything else */
    for (i = 0; i < RUGS.length; i++) {
        var rg = RUGS[i];
        var rp = quadPoly([
            [rg.x0, 0.03, rg.z0], [rg.x1, 0.03, rg.z0],
            [rg.x1, 0.03, rg.z1], [rg.x0, 0.03, rg.z1]
        ], horizon);
        if (rp) drawPoly(rp, mix(rg.c, fogAt(rg)));
    }

    /* furniture: visible faces of every box. the depth buffer settles who
       occludes whom, so the sort is only a near-to-far hint that trims
       overdraw (nearest writes depth first, farther pixels fail fast) */
    var faces = [];
    for (i = 0; i < FURN.length; i++) collectFaces(FURN[i], faces, horizon);
    faces.sort(function (a, b) { return a.d - b.d; });
    for (i = 0; i < faces.length; i++) drawPoly(faces[i].p, faces[i].c);

    /* the URE BOY glow, pulsing over its corner of the desk */
    var gdx = GLOWP.x - PL.x, gdz = GLOWP.z - PL.z;
    var gdep = gdx * PL.dirX + gdz * PL.dirZ;
    if (gdep > 0.3) {
        var glat = (gdx * PL.planeX + gdz * PL.planeZ) / PLANE;
        var gsx = W / 2 + glat / gdep * FOCAL;
        var gsy = horizon + (EYE - GLOWP.y) / gdep * FOCAL;
        var gcol = clamp(Math.round(gsx), 0, W - 1);
        var grow = clamp(Math.round(gsy), 0, H - 1);
        /* the nearest surface at the glow's pixel — walls AND furniture, so a
           chair between you and the desk hides the halo too */
        var gnear = 1 / DEPTH[grow * W + gcol];
        if (gnear >= gdep - 0.6) {
            var pulse = reduce ? 0.5 : (Math.sin(T * 2.4) + 1) / 2;
            var gr = (14 + pulse * 6) * FOCAL / (gdep * 42);
            gr = clamp(gr, 6, 70);
            var grad = ctx.createRadialGradient(gsx, gsy, 1, gsx, gsy, gr);
            grad.addColorStop(0, 'rgba(255,84,54,' + (0.3 + pulse * 0.25) + ')');
            grad.addColorStop(1, 'rgba(255,84,54,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(gsx - gr, gsy - gr, gr * 2, gr * 2);
        }
    }

    /* phase tint */
    if (curPhase === 'morning') { R(ctx, 0, 0, W, H, 'rgba(255,205,150,0.07)'); }
    else if (curPhase === 'evening') { R(ctx, 0, 0, W, H, 'rgba(255,150,80,0.1)'); }
    else if (curPhase === 'night') { R(ctx, 0, 0, W, H, 'rgba(30,40,90,0.22)'); }

    drawMinimap();
    drawTrans();
}

/* ============================================================
   MINIMAP — the flat plan the /room/ way: real floors, rugs and
   furniture in their own colors, prerendered once (nothing in
   the plan moves except you). One pixel per cell, top-right.
   ============================================================ */
var M3 = {                                         // the /room/ + /room3d/ plan palette
    fl: '#a1734b', flSeam: '#8a6240',
    tile: '#ccd3d4', tile2: '#b7bfc2',
    wallTop: '#ece8da', wall: '#d9d3c0',
    glass: '#8fc0e8'
};
var MMX = W - MW - 8, MMY = 3;                     // minimap card origin (card is MW+4 wide)
var MINI = mk(MW + 4, MH + 4), minig = MINI.getContext('2d');
var hideMini = false;
function buildMinimap() {
    var g = minig, i, o, r, c;
    R(g, 0, 0, MW + 4, MH + 4, '#101014');
    /* floors: wood inside the wall ring, tile in the bathroom */
    R(g, 3, 3, MW - 2, MH - 2, M3.fl);
    R(g, 3, 32, 14, 21, M3.tile);
    for (i = 0; i < RUGS.length; i++) {
        o = RUGS[i];
        g.fillStyle = o.c;
        g.fillRect(2 + Math.round(o.x0), 2 + Math.round(o.z0),
                   Math.max(1, Math.round(o.x1) - Math.round(o.x0)),
                   Math.max(1, Math.round(o.z1) - Math.round(o.z0)));
    }
    /* furniture footprints, list order: cushions land on couches like a top view */
    for (i = 0; i < FURN.length; i++) {
        o = FURN[i];
        g.fillStyle = o.c;
        g.fillRect(2 + Math.round(o.x0), 2 + Math.round(o.z0),
                   Math.max(1, Math.round(o.x1) - Math.round(o.x0)),
                   Math.max(1, Math.round(o.z1) - Math.round(o.z0)));
    }
    /* walls over everything */
    for (r = 0; r < MH; r++) for (c = 0; c < MW; c++) {
        var id = MAP[r][c];
        if (!id) continue;
        g.fillStyle = id === 2 ? M3.glass : id === 4 ? P.wd1 : M3.wallTop;
        g.fillRect(2 + c, 2 + r, 1, 1);
    }
    box1(g, 0, 0, MW + 4, MH + 4, P.k);
}
function drawMinimap() {
    if (hideMini) return;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(MINI, MMX, MMY);
    ctx.globalAlpha = 1;
    ctx.fillStyle = P.red;
    ctx.fillRect(MMX + 2 + Math.round(PL.x) - 1, MMY + 2 + Math.round(PL.z) - 1, 2, 2);
    ctx.fillRect(MMX + 2 + Math.round(PL.x + PL.dirX * 2.5), MMY + 2 + Math.round(PL.z + PL.dirZ * 2.5), 1, 1);
}

/* ============================================================
   MAP VIEW — press M (or tap the minimap): the whole apartment
   as the /room3d/ spinning dollhouse, rebuilt from the same
   MAP grid + FURN boxes the raycaster walks. Ortho projection,
   painter-sorted quads, hull walls in a post-pass, and a red
   pawn where you stand. Drag spins · wheel/pinch zooms.
   ============================================================ */
var HSQ = 3.6;                                     // cell heights -> dollhouse px (the /room3d/ squash)
var MCX = 160, MCZ = 208;                          // plan center, in plan px like /room3d/
var MAPV = { on: false, yaw: -0.62, pitch: 0.94, zoom: 1.05, vyaw: 0, idleT: 4 };
var MBOXES = [], MFLATS = [], PAWN = null;
var MAPSNAP = mk(W, H), msctx = MAPSNAP.getContext('2d');
var mdrag = { on: false, id: -1, x0: 0, y0: 0, lx: 0, ly: 0, moved: 0, t0: 0, type: 'mouse' };
var MPTRS = {};
var mpinch = { on: false, d0: 0, z0: 1 };

/* every face color is fixed for the life of the scene (the sun is pinned to
   the world, the palette never changes), so bake all five now: the frame
   loop should never rebuild a color string it already built */
function mkbox(x, z, w, d, y0, h, c, t, glow, hull) {
    return {
        x: x, z: z, w: w, d: d, y0: y0, h: h, hull: hull || '',
        cTop: shade(t || c, glow ? 1 : LIGHT.top),
        cXp: shade(c, glow ? 0.96 : LIGHT.xp), cXn: shade(c, glow ? 0.96 : LIGHT.xn),
        cZp: shade(c, glow ? 0.96 : LIGHT.zp), cZn: shade(c, glow ? 0.96 : LIGHT.zn)
    };
}
function mbox(x, z, w, d, y0, h, c, t, glow, hull) {
    MBOXES.push(mkbox(x, z, w, d, y0, h, c, t, glow, hull));
}
function mflat(x, z, w, d, c, a) { MFLATS.push({ x: x, z: z, w: w, d: d, c: c, a: a || 1 }); }

function buildMapScene() {
    MBOXES.length = 0; MFLATS.length = 0;
    PAWN = mkbox(0, 0, 6, 6, 0, 12, P.red, '#ff5436', true, '');   // you, moved into place each frame
    var i, o, r, c, zz, cx, cz;

    /* floors, inset from the wall ring like /room3d/ */
    mflat(8, 8, 304, 400, M3.fl);
    for (zz = 24; zz < 408; zz += 16) mflat(8, zz, 304, 1.2, M3.flSeam, 0.5);
    mflat(8, 240, 112, 168, M3.tile);
    for (cz = 240; cz < 408; cz += 12) for (cx = 8; cx < 120; cx += 12) {
        if ((((cx - 8) / 12) + ((cz - 240) / 12)) % 2 < 1) mflat(cx, cz, Math.min(12, 120 - cx), Math.min(12, 408 - cz), M3.tile2);
    }
    for (i = 0; i < RUGS.length; i++) {
        o = RUGS[i];
        mflat(o.x0 * 8, o.z0 * 8, (o.x1 - o.x0) * 8, (o.z1 - o.z0) * 8, o.c);
    }
    /* soft shadows under the floor-standing furniture. dedupe by containment:
       a couch arm's shadow lives inside the base's, drawing both would
       double-darken the overlap */
    var aos = [];
    for (i = 0; i < FURN.length; i++) {
        o = FURN[i];
        if (o.y0 > 0.01) continue;
        var ax = o.x0 * 8 - 3, az = o.z0 * 8 - 3;
        var aw = (o.x1 - o.x0) * 8 + 6, ad = (o.z1 - o.z0) * 8 + 6;
        if (aw * ad < 140) continue;
        var inside = false;
        for (var j = 0; j < aos.length; j++) {
            var pj = aos[j];
            if (ax >= pj.x && az >= pj.z && ax + aw <= pj.x + pj.w && az + ad <= pj.z + pj.d) { inside = true; break; }
        }
        if (inside) continue;
        aos.push({ x: ax, z: az, w: aw, d: ad });
        mflat(ax, az, aw, ad, '#0a0c12', 0.2);
    }

    /* walls: greedy rectangle merge over the grid. windows count as wall
       here (the pane is its own glowing box, like /room3d/); the front
       door keeps its own boxes and wood color. */
    var seen = [];
    for (r = 0; r < MH; r++) { seen[r] = []; for (c = 0; c < MW; c++) seen[r][c] = false; }
    function cls(id) { return id === 4 ? 2 : id > 0 ? 1 : 0; }
    for (r = 0; r < MH; r++) for (c = 0; c < MW; c++) {
        if (seen[r][c] || !cls(MAP[r][c])) continue;
        var k = cls(MAP[r][c]);
        var c1 = c;
        while (c1 + 1 < MW && !seen[r][c1 + 1] && cls(MAP[r][c1 + 1]) === k) c1++;
        var r1 = r, grow = true;
        while (grow && r1 + 1 < MH) {
            for (var cc = c; cc <= c1; cc++) {
                if (seen[r1 + 1][cc] || cls(MAP[r1 + 1][cc]) !== k) { grow = false; break; }
            }
            if (grow) r1++;
        }
        for (var rr = r; rr <= r1; rr++) for (var c2 = c; c2 <= c1; c2++) seen[rr][c2] = true;
        /* perimeter runs are hull: their outward faces draw in a post-pass */
        var hull = (r === 0 && r1 === 0) ? 'n' : (r === MH - 1 && r1 === MH - 1) ? 's' :
                   (c === 0 && c1 === 0) ? 'w' : (c === MW - 1 && c1 === MW - 1) ? 'e' : '';
        var wx = c * 8, wz = r * 8, ww = (c1 - c + 1) * 8, wd = (r1 - r + 1) * 8;
        if (k === 2) mbox(wx, wz, ww, wd, 0, 28, P.wd1, P.wd2, false, hull);
        else mbox(wx, wz, ww, wd, 0, hull ? 30 : 26, M3.wall, M3.wallTop, false, hull);
    }
    /* window panes set into (and slightly proud of) the walls */
    for (r = 0; r < MH; r++) for (c = 0; c < MW; c++) {
        if (MAP[r][c] !== 2 || (c > 0 && MAP[r][c - 1] === 2)) continue;
        var ec = c;
        while (ec + 1 < MW && MAP[r][ec + 1] === 2) ec++;
        if (ec > c) mbox(c * 8 + 2, r * 8 - 0.75, (ec - c + 1) * 8 - 4, 9.5, 12, 14, M3.glass, M3.glass, true);
    }
    for (c = 0; c < MW; c++) for (r = 0; r < MH; r++) {
        if (MAP[r][c] !== 2 || (r > 0 && MAP[r - 1][c] === 2)) continue;
        var er = r;
        while (er + 1 < MH && MAP[er + 1][c] === 2) er++;
        if (er > r) mbox(c * 8 - 0.75, r * 8 + 2, 9.5, (er - r + 1) * 8 - 4, 12, 14, M3.glass, M3.glass, true);
    }

    /* the furniture, straight from the raycaster's boxes: plan px footprints,
       heights squashed to dollhouse scale */
    for (i = 0; i < FURN.length; i++) {
        o = FURN[i];
        mbox(o.x0 * 8, o.z0 * 8, (o.x1 - o.x0) * 8, (o.z1 - o.z0) * 8,
             o.y0 * HSQ, (o.y1 - o.y0) * HSQ, o.c, o.c, o.glow);
    }
}

/* ortho camera, /room3d/'s math verbatim */
var MS = { sy: 0, cy: 1, sp: 0, cp: 1, s: 1, oy: 0 };
function mapCamPrep() {
    MS.sy = Math.sin(MAPV.yaw); MS.cy = Math.cos(MAPV.yaw);
    MS.sp = Math.sin(MAPV.pitch); MS.cp = Math.cos(MAPV.pitch);
    var rad = Math.sqrt(MCX * MCX + MCZ * MCZ);
    var sH = (W / 2 - 8) / rad;
    var sV = (H / 2 - 6) / (rad * MS.sp + 44 * MS.cp);
    MS.s = Math.min(sH, sV) * MAPV.zoom;
    MS.oy = H / 2 + 16 * MS.cp * MS.s;
}
function mproj(x, y, z) {
    var wx = x - MCX, wz = z - MCZ;
    var u = wx * MS.sy + wz * MS.cy;
    return {
        x: W / 2 + (wx * MS.cy - wz * MS.sy) * MS.s,
        y: MS.oy + (u * MS.sp - y * MS.cp) * MS.s,
        d: u * MS.cp + y * MS.sp
    };
}
function mquad(p1, p2, p3, p4, col, alpha) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    if (alpha !== undefined && alpha < 1) { ctx.globalAlpha = alpha; }
    ctx.fillStyle = col;
    ctx.fill();
    if (alpha !== undefined && alpha < 1) { ctx.globalAlpha = 1; }
    else {
        ctx.strokeStyle = 'rgba(21,21,26,0.34)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}
function mpush(list, v, col) {
    var p1 = mproj(v[0], v[1], v[2]), p2 = mproj(v[3], v[4], v[5]),
        p3 = mproj(v[6], v[7], v[8]), p4 = mproj(v[9], v[10], v[11]);
    list.push({ p: [p1, p2, p3, p4], c: col, d: (p1.d + p2.d + p3.d + p4.d) / 4 });
}
function byDepth(a, b) { return a.d - b.d; }
function collectMapBox(o, faces, post) {
    var x0 = o.x, x1 = o.x + o.w, z0 = o.z, z1 = o.z + o.d;
    var yb = o.y0, yt = o.y0 + o.h;
    mpush(faces, [x0, yt, z0, x1, yt, z0, x1, yt, z1, x0, yt, z1], o.cTop);
    if (MS.sy > 0) mpush(o.hull === 'e' ? post : faces, [x1, yb, z0, x1, yb, z1, x1, yt, z1, x1, yt, z0], o.cXp);
    else if (MS.sy < 0) mpush(o.hull === 'w' ? post : faces, [x0, yb, z0, x0, yb, z1, x0, yt, z1, x0, yt, z0], o.cXn);
    if (MS.cy > 0) mpush(o.hull === 's' ? post : faces, [x0, yb, z1, x1, yb, z1, x1, yt, z1, x0, yt, z1], o.cZp);
    else if (MS.cy < 0) mpush(o.hull === 'n' ? post : faces, [x0, yb, z0, x1, yb, z0, x1, yt, z0, x0, yt, z0], o.cZn);
}
function renderMap() {
    ctx.drawImage(MAPSNAP, 0, 0);              // the paused world, dimmed at snapshot time
    mapCamPrep();

    var i, f;
    for (i = 0; i < MFLATS.length; i++) {
        f = MFLATS[i];
        mquad(mproj(f.x, 0, f.z), mproj(f.x + f.w, 0, f.z),
              mproj(f.x + f.w, 0, f.z + f.d), mproj(f.x, 0, f.z + f.d), f.c, f.a);
    }

    /* you: a pulsing ring on the floor, a red pawn, a facing wedge */
    var ppx = PL.x * 8, ppz = PL.z * 8;
    var pu = reduce ? 0.5 : (Math.sin(T * 2.4) + 1) / 2;
    ctx.strokeStyle = 'rgba(255,84,54,' + (0.25 + 0.3 * pu).toFixed(3) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (i = 0; i <= 14; i++) {
        var an = i / 14 * Math.PI * 2;
        var q = mproj(ppx + Math.cos(an) * (9 + pu * 3), 0.4, ppz + Math.sin(an) * (9 + pu * 3));
        if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
    }
    ctx.stroke();

    var faces = [], post = [];
    for (i = 0; i < MBOXES.length; i++) collectMapBox(MBOXES[i], faces, post);
    PAWN.x = ppx - 3; PAWN.z = ppz - 3;
    collectMapBox(PAWN, faces, post);
    var tip = mproj(ppx + PL.dirX * 11, 0.5, ppz + PL.dirZ * 11);
    var b1 = mproj(ppx - PL.dirZ * 4.5 + PL.dirX * 2, 0.5, ppz + PL.dirX * 4.5 + PL.dirZ * 2);
    var b2 = mproj(ppx + PL.dirZ * 4.5 + PL.dirX * 2, 0.5, ppz - PL.dirX * 4.5 + PL.dirZ * 2);
    faces.push({ p: [tip, b1, b2, b2], c: '#ff5436', d: (tip.d + b1.d + b2.d) / 3 });
    faces.sort(byDepth);
    post.sort(byDepth);
    for (i = 0; i < faces.length; i++) mquad(faces[i].p[0], faces[i].p[1], faces[i].p[2], faces[i].p[3], faces[i].c);
    for (i = 0; i < post.length; i++) mquad(post[i].p[0], post[i].p[1], post[i].p[2], post[i].p[3], post[i].c);

    /* the URE BOY's glow + blinking LED, over everything like /room3d/ */
    var up = mproj(GLOWP.x * 8, GLOWP.y * HSQ, GLOWP.z * 8);
    var gr = 10 + pu * 6;
    var grad = ctx.createRadialGradient(up.x, up.y, 1, up.x, up.y, gr);
    grad.addColorStop(0, 'rgba(255,84,54,' + (0.34 + pu * 0.25) + ')');
    grad.addColorStop(1, 'rgba(255,84,54,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(up.x - gr, up.y - gr, gr * 2, gr * 2);
    if (reduce || FR % 2) { ctx.fillStyle = P.red; ctx.fillRect(Math.round(up.x) - 4, Math.round(up.y), 2, 2); }

    /* the ✕ that walks you back (its hit region is bigger than the card: a
       thumb on a phone is nowhere near this precise) */
    R(ctx, W - 21, 3, 18, 18, '#101014');
    box1(ctx, W - 21, 3, 18, 18, '#45453f');
    ctx.fillStyle = '#ff5436';
    for (i = 0; i < 8; i++) {
        ctx.fillRect(W - 16 + i, 8 + i, 1, 1);
        ctx.fillRect(W - 9 - i, 8 + i, 1, 1);
    }
}

var mapBtn = null, tipP = null, TIP_HOME = '', mapOpenT = 0;
var TIP_MAP = '<span class="fine-only"><b>drag</b> spins · <b>scroll</b> zooms · <b>m</b> closes · </span><span class="coarse-only"><b>drag</b> spins · <b>pinch</b> zooms · <b>✕</b> or <b>map</b> closes · </span>the <b>red one</b> is you';
function swapTip(mapMode) {
    if (tipP) tipP.innerHTML = mapMode ? TIP_MAP : TIP_HOME;
}
function openMap() {
    /* navDone, not just TRANS.on: the reduced-motion exit skips the dither and
       goes straight to location.href, and the page stays live until it commits */
    if (MAPV.on || TRANS.on || navDone) return;
    MAPV.on = true;
    MAPV.vyaw = 0;
    MAPV.idleT = 4;                                // spins gently from the first frame
    mapOpenT = Date.now();                         // wall clock, not T: see the grace period in onUp
    /* KEYS survives on purpose: frame() never moves you while the map is up, and
       the OS only auto-repeats the last key — wiping would eat a held W forever */
    look.id = -1; stick.id = -1; stick.dx = 0; stick.dy = 0;
    /* snapshot the scene once, dim baked in: the world is paused behind the
       overlay, so the backdrop is one blit per frame and nothing more */
    hideMini = true; render(); hideMini = false;
    msctx.clearRect(0, 0, W, H);
    msctx.drawImage(buf, 0, 0);
    msctx.globalAlpha = 0.8;
    msctx.fillStyle = '#0b0b10';
    msctx.fillRect(0, 0, W, H);
    msctx.globalAlpha = 1;
    if (promptEl) { promptOn = false; promptEl.hidden = true; }
    if (mapBtn) mapBtn.setAttribute('aria-pressed', 'true');
    swapTip(true);
    needsDraw = true;
}
function closeMap() {
    if (!MAPV.on) return;
    MAPV.on = false;
    MPTRS = {}; mpinch.on = false; mdrag.on = false;
    if (mapBtn) mapBtn.setAttribute('aria-pressed', 'false');
    swapTip(false);
    needsDraw = true;
}
function toggleMap() { if (MAPV.on) closeMap(); else openMap(); }
function mptrCount() { var n = 0, k; for (k in MPTRS) if (MPTRS.hasOwnProperty(k)) n++; return n; }
function mpinchDist() {
    var ids = [], k;
    for (k in MPTRS) if (MPTRS.hasOwnProperty(k)) ids.push(k);
    if (ids.length < 2) return 0;
    var a = MPTRS[ids[0]], b = MPTRS[ids[1]];
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
}

/* ───────────────────── dither exit ────────────────────────── */
var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
var TRANS = { on: false, t: 0, dur: 0.55 };
var navDone = false, navTimer = null;
function goConsole() { if (navDone) return; navDone = true; window.location.href = '/ureboy/'; }
function enterConsole() {
    if (navDone || TRANS.on) return;
    if (reduce) { goConsole(); return; }
    TRANS.on = true; TRANS.t = 0;
    clearTimeout(navTimer);
    navTimer = setTimeout(goConsole, 1100);
}
function drawTrans() {
    if (!TRANS.on) return;
    var f = clamp(TRANS.t / TRANS.dur, 0, 1);
    var lvl = f * 16;
    ctx.fillStyle = P.k;
    for (var y = 0; y < H; y += 4) for (var x = 0; x < W; x += 4) {
        if (BAYER[((y / 4) % 4) * 4 + (x / 4) % 4] < lvl) ctx.fillRect(x, y, 4, 4);
    }
    if (f >= 1) goConsole();
}

/* ─────────────────────── present ──────────────────────────── */
function present() {
    if (!dctx) return;
    dctx.imageSmoothingEnabled = false;
    dctx.clearRect(0, 0, disp.width, disp.height);
    var s = Math.min(disp.width / W, disp.height / H);
    var dw = Math.round(W * s), dh = Math.round(H * s);
    dctx.drawImage(buf, 0, 0, W, H, (disp.width - dw) >> 1, (disp.height - dh) >> 1, dw, dh);
}
function resize() {
    if (!disp || !holder) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var hw = Math.max(32, holder.clientWidth), hh = Math.max(32, holder.clientHeight);
    var s = Math.min(hw / W, hh / H);
    var cssW = Math.max(32, Math.floor(W * s)), cssH = Math.floor(cssW * H / W);
    var pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
    if (disp.width === pw && disp.height === ph) return;
    disp.style.width = cssW + 'px';
    disp.style.height = cssH + 'px';
    disp.width = pw; disp.height = ph;
    LOOKW = cssW;
    needsDraw = true;
    present();
}

/* ─────────────────────── input ────────────────────────────── */
var KEYS = {};
var look = { id: -1, lx: 0, ly: 0 };
var stick = { id: -1, x0: 0, y0: 0, dx: 0, dy: 0 };
function onKey(e, down) {
    /* modifiers only block keyDOWN: a swallowed keyup leaves keys stuck */
    if (down && (e.ctrlKey || e.metaKey || e.altKey)) return;
    var k = (e.key || '').toLowerCase();
    var used = true;
    if (k === 'w' || k === 'arrowup') KEYS.f = down;
    else if (k === 's' || k === 'arrowdown') KEYS.b = down;
    else if (k === 'a') KEYS.sl = down;
    else if (k === 'd') KEYS.sr = down;
    else if (k === 'arrowleft') KEYS.tl = down;
    else if (k === 'arrowright') KEYS.tr = down;
    else if (k === 'm' && down && !e.repeat) toggleMap();
    else if (k === 'escape' && down && MAPV.on) closeMap();
    else if ((k === 'e' || k === 'enter') && down && promptOn) {
        /* Enter keeps native behavior on focused links/buttons */
        var t = e.target;
        if (k === 'enter' && t && t !== promptEl && (t.tagName === 'A' || t.tagName === 'BUTTON')) return;
        enterConsole();
    }
    else used = false;
    if (used && down) e.preventDefault();
    needsDraw = true;
}
var LOOKW = 320;                                   // displayed canvas width, cached in resize()
function deadZone(v, dead, throwPx) {
    var a = Math.abs(v);
    if (a < dead) return 0;
    return (v < 0 ? -1 : 1) * clamp((a - dead) / throwPx, 0, 1);
}
/* pointer position -> native buffer px (the canvas is a uniform scale of it) */
function bufCoords(e) {
    var r = disp.getBoundingClientRect();
    if (!r.width || !r.height) return { x: -99, y: -99 };
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
}
function onDown(e) {
    if (e.button !== 0) return;
    /* let the boot prompt and links be themselves */
    var t = e.target;
    if (t && t !== disp && t !== holder && (t.tagName === 'A' || t.tagName === 'BUTTON' || (t.closest && t.closest('button, a')))) return;
    e.preventDefault();
    try { holder.setPointerCapture(e.pointerId); } catch (er) {}
    if (MAPV.on) {
        /* map mode: one pointer spins, two pinch — /room3d/ manners */
        MPTRS[e.pointerId] = { x: e.clientX, y: e.clientY };
        MAPV.idleT = 0;
        if (mptrCount() >= 2) {
            mdrag.on = false; MAPV.vyaw = 0;
            mpinch.on = true; mpinch.d0 = mpinchDist() || 1; mpinch.z0 = MAPV.zoom;
            return;
        }
        mdrag.on = true; mdrag.id = e.pointerId; mdrag.type = e.pointerType || 'mouse';
        mdrag.x0 = mdrag.lx = e.clientX; mdrag.y0 = mdrag.ly = e.clientY;
        mdrag.moved = 0; mdrag.t0 = T;
        MAPV.vyaw = 0;
        return;
    }
    var r = holder.getBoundingClientRect();
    var half = r.left + r.width / 2;
    if (e.pointerType !== 'mouse' && e.clientX < half && stick.id === -1) {
        stick.id = e.pointerId;
        stick.x0 = e.clientX; stick.y0 = e.clientY;
        stick.dx = 0; stick.dy = 0;
    } else if (look.id === -1) {
        look.id = e.pointerId;
        look.lx = e.clientX; look.ly = e.clientY;
        look.type = e.pointerType || 'mouse';
        look.x0 = e.clientX; look.y0 = e.clientY;
        look.t0 = T; look.moved = 0;
    }
}
function onMove(e) {
    if (MAPV.on) {
        MAPV.idleT = 0;                            // any pointer activity defers the idle spin,
        if (MPTRS[e.pointerId]) { MPTRS[e.pointerId].x = e.clientX; MPTRS[e.pointerId].y = e.clientY; }
        if (mpinch.on) {                           // including a pinch, which is not a drag
            var pd = mpinchDist();
            if (pd > 0) { MAPV.zoom = clamp(mpinch.z0 * pd / mpinch.d0, 0.7, 1.8); needsDraw = true; }
            return;
        }
        if (mdrag.on && e.pointerId === mdrag.id) {
            var mdx = e.clientX - mdrag.lx, mdy = e.clientY - mdrag.ly;
            mdrag.lx = e.clientX; mdrag.ly = e.clientY;
            mdrag.moved = Math.max(mdrag.moved, Math.max(Math.abs(e.clientX - mdrag.x0), Math.abs(e.clientY - mdrag.y0)));
            MAPV.yaw += mdx * 0.008;
            MAPV.pitch = clamp(MAPV.pitch + mdy * 0.005, 0.55, 1.25);
            MAPV.vyaw = mdx * 0.008 * 60;
            needsDraw = true;
        }
        return;
    }
    if (e.pointerId === stick.id) {
        /* dead zone: a planted thumb is zero, not a slow creep */
        stick.dx = deadZone(e.clientX - stick.x0, 9, 42);
        stick.dy = deadZone(e.clientY - stick.y0, 9, 42);
    } else if (e.pointerId === look.id) {
        var dx = e.clientX - look.lx, dy = e.clientY - look.ly;
        look.lx = e.clientX; look.ly = e.clientY;
        look.moved = Math.max(look.moved, Math.max(Math.abs(e.clientX - look.x0), Math.abs(e.clientY - look.y0)));
        rotate(dx / LOOKW * 2.6);                  // full-canvas swipe ≈ 150° on any device
        PL.pitch = clamp(PL.pitch - dy * 0.3, -80, 80);
        needsDraw = true;
    }
}
function onUp(e) {
    var isCancel = e.type === 'pointercancel';
    if (MAPV.on) {
        delete MPTRS[e.pointerId];
        if (mpinch.on) {
            if (mptrCount() >= 2) {
                /* a third finger lifted: mpinchDist now measures a different pair,
                   so re-baseline or the zoom snaps to whatever they were holding */
                mpinch.d0 = mpinchDist() || 1; mpinch.z0 = MAPV.zoom;
                return;
            }
            mpinch.on = false;
            /* one finger stays down: let it spin again. Number(), not parseInt||:
               a surviving pointerId 0 (firefox's mouse) is falsy and would fall
               back to the string key, which never === the number again */
            var k, rest = null;
            for (k in MPTRS) if (MPTRS.hasOwnProperty(k)) rest = k;
            if (rest !== null) {
                mdrag.on = true; mdrag.id = Number(rest);
                mdrag.x0 = mdrag.lx = MPTRS[rest].x; mdrag.y0 = mdrag.ly = MPTRS[rest].y;
                mdrag.moved = 99;                  // a pinch leftover is never a tap
            }
            return;
        }
        if (mdrag.on && e.pointerId === mdrag.id) {
            mdrag.on = false;
            if (isCancel) MAPV.vyaw = 0;           // the system stole the gesture; don't fling
            var mslop = mdrag.type === 'mouse' ? 6 : 11;
            if (!isCancel && mdrag.moved < mslop && T - mdrag.t0 < 0.5 && Date.now() - mapOpenT > 350) {
                /* the ✕ sits where the minimap was: without the grace period a
                   double-tap on the minimap would open the map and shut it again.
                   Wall clock on purpose — T stops with rAF, and a guard that has
                   to EXPIRE must never be able to freeze the ✕ shut */
                var mc = bufCoords(e);
                if (mc.x >= W - 32 && mc.y <= 30) closeMap();
            }
        }
        return;
    }
    if (e.pointerId === stick.id) { stick.id = -1; stick.dx = 0; stick.dy = 0; }
    if (e.pointerId === look.id) {
        look.id = -1;
        /* a clean tap on the minimap opens the big one */
        var slop = look.type === 'mouse' ? 6 : 11;
        if (!isCancel && look.moved < slop && T - look.t0 < 0.5) {
            var c = bufCoords(e);
            if (c.x >= MMX - 2 && c.x <= MMX + MW + 6 && c.y >= MMY - 2 && c.y <= MMY + MH + 6) openMap();
        }
    }
}

/* ──────────────── the boot prompt (proximity) ──────────────── */
var promptOn = false;
function checkPrompt() {
    var dx = GLOWP.x - PL.x, dz = GLOWP.z - PL.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    var facing = (dx * PL.dirX + dz * PL.dirZ) / (d || 1);
    var on = d < 7 && facing > 0.55 && !TRANS.on;
    if (on !== promptOn) {
        promptOn = on;
        if (promptEl) promptEl.hidden = !on;
    }
}

/* ─────────────────────── frame loop ───────────────────────── */
var lastFR = -1;
function frame(ts) {
    rafId = requestAnimationFrame(frame);
    var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    T += dt;
    FR = Math.floor(T / 0.45);

    var ph = phaseNow();
    if (ph !== curPhase) { curPhase = ph; buildTextures(); needsDraw = true; }

    /* map view: the world pauses, the dollhouse spins */
    if (MAPV.on) {
        if (!reduce && !mdrag.on && Math.abs(MAPV.vyaw) > 0.001) {
            MAPV.yaw += MAPV.vyaw * dt;
            MAPV.vyaw *= Math.pow(0.06, dt);       // the /room3d/ flywheel
            needsDraw = true;
        }
        MAPV.idleT += dt;
        if (!reduce && !mdrag.on && MAPV.idleT > 4) { MAPV.yaw += dt * 0.12; needsDraw = true; }
        if (!reduce) needsDraw = true;             // the ring + glow pulse
        /* no FR tick here: nothing in the map animates on the blink cadence, so
           under reduced motion this view is genuinely still until you touch it */
        if (!needsDraw) return;
        needsDraw = false;
        renderMap();
        present();
        return;
    }

    /* movement */
    var mvF = (KEYS.f ? 1 : 0) - (KEYS.b ? 1 : 0) - stick.dy;
    var mvS = (KEYS.sr ? 1 : 0) - (KEYS.sl ? 1 : 0) + stick.dx;
    var turn = (KEYS.tr ? 1 : 0) - (KEYS.tl ? 1 : 0);
    mvF = clamp(mvF, -1, 1); mvS = clamp(mvS, -1, 1);
    if (turn) { rotate(turn * 2.3 * dt); needsDraw = true; }
    if (mvF || mvS) {
        var sp = 9.5 * dt;
        tryMove(PL.x + (PL.dirX * mvF - PL.dirZ * mvS) * sp,
                PL.z + (PL.dirZ * mvF + PL.dirX * mvS) * sp);
        if (!reduce) PL.bobT += dt * 9;
        needsDraw = true;
    }

    checkPrompt();
    if (TRANS.on) { TRANS.t += dt; needsDraw = true; }
    if (!reduce) needsDraw = true;                 // the glow pulses + led blinks
    if (!needsDraw && FR === lastFR) return;
    lastFR = FR;
    needsDraw = false;

    render();
    present();
}

/* ─────────────────────────── boot ─────────────────────────── */
function boot() {
    holder = byId('roomHolder');
    disp = byId('roomView');
    promptEl = byId('bootPrompt');
    if (!holder || !disp) return;
    dctx = disp.getContext('2d');

    buildMap();
    buildTextures();
    buildFurniture();
    buildMapScene();
    buildMinimap();

    /* dev handle: /1p/?dev + ?x=&z=&a= spawn overrides */
    try {
        var q = window.location.search.replace('?', '').split('&');
        var a0 = null;
        for (var qi = 0; qi < q.length; qi++) {
            var kv = q[qi].split('=');
            var qv = parseFloat(kv[1]);
            if (!isFinite(qv)) continue;
            if (kv[0] === 'x') PL.x = clamp(qv, PR + 1, MW - PR - 1);
            if (kv[0] === 'z') PL.z = clamp(qv, PR + 1, MH - PR - 1);
            if (kv[0] === 'a') a0 = qv;
            if (kv[0] === 'myaw') MAPV.yaw = qv;
            if (kv[0] === 'mpitch') MAPV.pitch = clamp(qv, 0.55, 1.25);
            if (kv[0] === 'mzoom') MAPV.zoom = clamp(qv, 0.7, 1.8);
        }
        /* a spawn inside a wall would hard-lock movement: fall back home */
        if (hitsWall(PL.x, PL.z) || solidCell(Math.floor(PL.x), Math.floor(PL.z))) { PL.x = 18.5; PL.z = 47.0; }
        if (a0 !== null) { PL.dirX = Math.cos(a0); PL.dirZ = Math.sin(a0); PL.planeX = -PL.dirZ * PLANE; PL.planeZ = PL.dirX * PLANE; }
        if (window.location.search.indexOf('dev') >= 0) {
            window.__room1p = {
                set: function (x, z, ang, pit) {
                    if (isFinite(x)) PL.x = x;
                    if (isFinite(z)) PL.z = z;
                    if (isFinite(ang)) { PL.dirX = Math.cos(ang); PL.dirZ = Math.sin(ang); PL.planeX = -PL.dirZ * PLANE; PL.planeZ = PL.dirX * PLANE; }
                    if (isFinite(pit)) PL.pitch = clamp(pit, -80, 80);
                },
                shot: function () { if (MAPV.on) renderMap(); else render(); return buf.toDataURL('image/png'); },
                keys: function () { return KEYS; },              // held-key state, for regression checks
                renderMs: function (n) { var t = performance.now(); for (var i = 0; i < (n || 100); i++) render(); return (performance.now() - t) / (n || 100); },
                mapMs: function (n) { var t = performance.now(); for (var i = 0; i < (n || 100); i++) renderMap(); return (performance.now() - t) / (n || 100); },
                map: {
                    open: openMap, close: closeMap,
                    set: function (y, p, z) {
                        if (isFinite(y)) MAPV.yaw = y;
                        if (isFinite(p)) MAPV.pitch = clamp(p, 0.55, 1.25);
                        if (isFinite(z)) MAPV.zoom = clamp(z, 0.7, 1.8);
                    }
                }
            };
        }
    } catch (e) {}

    /* input lives on the holder: on portrait phones the canvas is a short
       strip and thumbs land in the dark margins around it */
    if (window.PointerEvent) {
        holder.addEventListener('pointerdown', onDown);
        holder.addEventListener('pointermove', onMove);
        holder.addEventListener('pointerup', onUp);
        holder.addEventListener('pointercancel', onUp);
    } else {
        holder.addEventListener('mousedown', function (e) { e.pointerId = 1; e.pointerType = 'mouse'; onDown(e); });
        holder.addEventListener('mousemove', function (e) { e.pointerId = 1; onMove(e); });
        /* on window, not holder: without pointer capture a button released off
           the canvas never comes back, and the map would spin on hover forever */
        window.addEventListener('mouseup', function (e) { e.pointerId = 1; onUp(e); });
    }
    window.addEventListener('keydown', function (e) { onKey(e, true); });
    window.addEventListener('keyup', function (e) { onKey(e, false); });
    window.addEventListener('blur', function () {
        KEYS = {}; stick.dx = 0; stick.dy = 0;
        MPTRS = {}; mpinch.on = false; mdrag.on = false; MAPV.vyaw = 0;
    });
    if (promptEl) promptEl.addEventListener('click', function () { enterConsole(); });
    mapBtn = byId('mapTool');
    if (mapBtn) mapBtn.addEventListener('click', function () { toggleMap(); });
    tipP = document.querySelector('.cabinet-tip');
    if (tipP) TIP_HOME = tipP.innerHTML;
    holder.addEventListener('wheel', function (e) {
        if (!MAPV.on) return;
        e.preventDefault();
        MAPV.zoom = clamp(MAPV.zoom * (1 - e.deltaY * 0.0012), 0.7, 1.8);
        MAPV.idleT = 0;
        needsDraw = true;
    }, { passive: false });

    window.addEventListener('pageshow', function (e) {
        if (e.persisted) {
            navDone = false; TRANS.on = false; TRANS.t = 0;
            clearTimeout(navTimer);
            /* a pointer that was down when the page froze never sends its up:
               left in MPTRS it makes the next single finger read as a pinch */
            MPTRS = {}; mpinch.on = false; mdrag.on = false; MAPV.vyaw = 0;
            KEYS = {}; stick.id = -1; stick.dx = 0; stick.dy = 0; look.id = -1;
            needsDraw = true;
        }
    });

    if (window.ResizeObserver) { new ResizeObserver(resize).observe(holder); }
    window.addEventListener('resize', resize);
    resize();

    /* /1p/?map lands straight in the dollhouse */
    if (/[?&]map(=|&|$)/.test(window.location.search)) openMap();

    if (MAPV.on) renderMap(); else render();
    present();

    rafId = requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
