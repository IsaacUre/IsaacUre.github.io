/* ============================================================
   URE ROOM 1P — isaac's apartment in first person
   The same floor plan, walked through. A hand-rolled grid
   raycaster (the Wolfenstein kind): DDA walls with procedural
   textures, furniture as billboard sprites, distance fog, a
   real-clock sky in the windows. Zero dependencies, one file.
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
   SPRITES — billboard furniture, front views in house pixels
   ============================================================ */
var SPRITES = [];                                 // {x, z, cv, wC, hC, r, glow, yOff}
function spr(px, pz, cv, wC, hC, r, glow, yOff) {
    SPRITES.push({ x: px / 8, z: pz / 8, cv: cv, wC: wC, hC: hC, r: r || 0, glow: glow || false, yOff: yOff || 0 });
}
function outlineAll(g, w, h) { /* cheap 'ink' pass: darken the silhouette edge */ }

function sprCouch() {
    var c = mk(52, 26), g = c.getContext('2d');
    R(g, 2, 6, 48, 16, P.cream);
    R(g, 2, 2, 48, 8, P.cream2);                              // back
    R(g, 4, 3, 21, 6, P.cream); R(g, 27, 3, 21, 6, P.cream);
    R(g, 0, 8, 7, 16, P.cream2); R(g, 45, 8, 7, 16, P.cream2); // arms
    R(g, 1, 9, 5, 12, P.cream);
    R(g, 46, 9, 5, 12, P.cream);
    R(g, 8, 12, 17, 8, '#f2eee0'); R(g, 27, 12, 17, 8, '#f2eee0');  // cushions
    R(g, 10, 6, 9, 8, P.blank); box1(g, 10, 6, 9, 8, '#3d6fb0');    // pillows
    R(g, 33, 6, 9, 8, P.gold); box1(g, 33, 6, 9, 8, '#b8912f');
    R(g, 4, 24, 4, 2, P.wd3); R(g, 44, 24, 4, 2, P.wd3);      // feet
    box1(g, 0, 2, 52, 22, P.k);
    return c;
}
function sprCowChair() {
    var c = mk(26, 28), g = c.getContext('2d');
    R(g, 2, 2, 22, 22, P.cow);
    R(g, 0, 8, 5, 14, P.cow); R(g, 21, 8, 5, 14, P.cow);      // arms
    R(g, 3, 0, 4, 4, P.cow); box1(g, 3, 0, 4, 4, P.k);        // ears
    R(g, 19, 0, 4, 4, P.cowDk); box1(g, 19, 0, 4, 4, P.k);
    R(g, 4, 4, 7, 6, P.cowDk); R(g, 16, 10, 7, 7, P.cowDk);   // patches
    R(g, 6, 16, 6, 6, P.cowDk);
    R(g, 5, 12, 16, 8, '#e8e5d5');                            // seat
    R(g, 4, 24, 4, 3, P.k); R(g, 18, 24, 4, 3, P.k);          // feet
    box1(g, 0, 2, 26, 23, P.k);
    return c;
}
function sprTable() {
    var c = mk(34, 13), g = c.getContext('2d');
    R(g, 0, 4, 34, 4, P.wd1); R(g, 0, 4, 34, 1, shade(P.wd1, 1.2));
    R(g, 2, 8, 3, 5, P.wd2); R(g, 29, 8, 3, 5, P.wd2);        // legs
    R(g, 8, 1, 4, 3, P.red); R(g, 18, 0, 4, 4, P.purp);       // the d20s
    box1(g, 0, 4, 34, 4, P.k);
    return c;
}
function sprDesk(frame) {
    var c = mk(48, 32), g = c.getContext('2d');
    R(g, 0, 12, 48, 4, P.wd1); R(g, 0, 12, 48, 1, shade(P.wd1, 1.2));  // top
    R(g, 2, 16, 4, 16, P.wd2); R(g, 42, 16, 4, 16, P.wd2);    // legs
    R(g, 30, 18, 12, 12, P.wd2); R(g, 32, 20, 8, 2, P.wd3); R(g, 32, 25, 8, 2, P.wd3); // drawers
    /* mug */
    R(g, 6, 7, 5, 5, P.porc); R(g, 11, 8, 2, 3, P.porc); R(g, 7, 8, 3, 2, '#c8a24a');
    /* THE URE BOY, standing up against its little stand */
    R(g, 20, 0, 10, 12, P.shell); box1(g, 20, 0, 10, 12, P.k);
    R(g, 22, 2, 6, 5, '#3a3a35');
    R(g, 23, 3, 4, 3, P.dmg);
    R(g, 24, 4, 2, 1, '#0f380f');
    R(g, 21, 8, 2, 2, '#26262b'); R(g, 26, 9, 2, 2, P.red);
    R(g, 22, -0, 6, 1, P.red);                                 // cart lip
    if (frame) R(g, 19, 5, 1, 2, P.red);                       // led blink
    /* camera */
    R(g, 36, 6, 9, 6, '#2a2a30'); box1(g, 36, 6, 9, 6, P.k);
    R(g, 39, 8, 3, 3, P.glass);
    box1(g, 0, 12, 48, 4, P.k);
    return c;
}
function sprBed() {
    var c = mk(46, 20), g = c.getContext('2d');
    R(g, 0, 0, 6, 18, P.wd2); box1(g, 0, 0, 6, 18, P.k);      // headboard
    R(g, 6, 6, 40, 10, P.duv);
    R(g, 6, 6, 40, 2, '#e8e2d2');
    R(g, 8, 4, 10, 6, P.porc); box1(g, 8, 4, 10, 6, P.cream2); // pillow
    R(g, 30, 6, 16, 10, P.blank);                              // blanket
    R(g, 30, 6, 16, 2, '#3d6fb0');
    R(g, 6, 16, 40, 3, P.wd2);                                 // frame
    R(g, 8, 19, 3, 1, P.k); R(g, 42, 19, 3, 1, P.k);
    box1(g, 6, 6, 40, 13, P.k);
    return c;
}
function sprDresser() {
    var c = mk(16, 24), g = c.getContext('2d');
    R(g, 0, 0, 16, 22, P.wd1); box1(g, 0, 0, 16, 22, P.k);
    for (var i = 0; i < 3; i++) {
        R(g, 2, 2 + i * 7, 12, 5, P.wd2);
        R(g, 6, 4 + i * 7, 4, 1, P.gold);
    }
    R(g, 1, 22, 3, 2, P.k); R(g, 12, 22, 3, 2, P.k);
    return c;
}
function sprNightstand() {
    var c = mk(14, 20), g = c.getContext('2d');
    R(g, 4, 0, 6, 4, P.yell); R(g, 6, 4, 2, 3, '#2a2a30');    // little lamp
    box1(g, 4, 0, 6, 4, P.k);
    R(g, 0, 7, 14, 11, P.wd1); box1(g, 0, 7, 14, 11, P.k);
    R(g, 2, 9, 10, 4, P.wd2); R(g, 5, 10, 4, 1, P.gold);
    R(g, 1, 18, 2, 2, P.k); R(g, 11, 18, 2, 2, P.k);
    return c;
}
function sprWasher() {
    var c = mk(22, 34), g = c.getContext('2d');
    R(g, 0, 0, 22, 34, P.porc); box1(g, 0, 0, 22, 34, P.k);
    R(g, 0, 16, 22, 1, P.cream2);
    R(g, 5, 3, 12, 11, P.steel2); R(g, 7, 5, 8, 7, '#2a3a4a');
    box1(g, 5, 3, 12, 11, P.k);
    R(g, 5, 20, 12, 11, P.steel2); R(g, 7, 22, 8, 7, '#31363e');
    box1(g, 5, 20, 12, 11, P.k);
    R(g, 2, 1, 3, 1, P.teal); R(g, 17, 18, 3, 1, P.red);
    return c;
}
function sprTub() {
    var c = mk(60, 19), g = c.getContext('2d');
    R(g, 55, 0, 3, 5, P.steel);                                // faucet
    R(g, 0, 3, 60, 14, P.porc);
    R(g, 3, 5, 54, 3, P.water);
    R(g, 0, 3, 60, 1, '#ffffff');
    R(g, 2, 17, 5, 2, P.k); R(g, 53, 17, 5, 2, P.k);
    box1(g, 0, 3, 60, 14, P.k);
    return c;
}
function sprToilet() {
    var c = mk(14, 20), g = c.getContext('2d');
    R(g, 2, 0, 10, 8, P.porc); box1(g, 2, 0, 10, 8, P.k);     // tank
    R(g, 4, 2, 3, 2, P.steel);
    R(g, 1, 8, 12, 8, P.porc); box1(g, 1, 8, 12, 8, P.k);     // bowl
    R(g, 3, 10, 8, 4, '#dfe4e6');
    R(g, 4, 16, 6, 4, P.porc); box1(g, 4, 16, 6, 4, P.k);     // base
    return c;
}
function sprVanity() {
    var c = mk(26, 32), g = c.getContext('2d');
    R(g, 4, 0, 18, 12, '#a8c4d4'); box1(g, 4, 0, 18, 12, P.k); // mirror
    R(g, 6, 2, 5, 4, 'rgba(255,255,255,0.5)');
    R(g, 0, 16, 26, 4, P.ktop); R(g, 0, 16, 26, 1, '#e8e4d6');
    R(g, 9, 13, 8, 3, P.porc);                                 // basin hint
    R(g, 2, 20, 22, 12, P.kcab); box1(g, 2, 20, 22, 12, P.k);
    R(g, 12, 24, 2, 4, P.steel);
    box1(g, 0, 16, 26, 4, P.k);
    return c;
}
function sprIsland() {
    var c = mk(34, 31), g = c.getContext('2d');
    R(g, 0, 9, 34, 4, P.ktop); R(g, 0, 9, 34, 1, '#e8e4d6');
    R(g, 2, 13, 30, 18, P.kcab); box1(g, 2, 13, 30, 18, P.k);
    R(g, 6, 17, 10, 10, shade(P.kcab, 0.85));
    R(g, 19, 17, 10, 10, shade(P.kcab, 0.85));
    /* cookie jar on top */
    R(g, 8, 2, 8, 7, P.water); box1(g, 8, 2, 8, 7, P.k);
    R(g, 10, 0, 4, 2, P.wd2);
    R(g, 10, 5, 2, 2, '#c8873a'); R(g, 13, 4, 2, 2, '#c8873a');
    box1(g, 0, 9, 34, 4, P.k);
    return c;
}
function sprFridge() {
    var c = mk(20, 42), g = c.getContext('2d');
    R(g, 0, 0, 20, 42, P.steel); box1(g, 0, 0, 20, 42, P.k);
    R(g, 0, 0, 3, 42, shade(P.steel, 1.15));
    R(g, 0, 16, 20, 1, P.steel2);
    R(g, 15, 4, 2, 8, P.steel2); R(g, 15, 20, 2, 10, P.steel2);
    return c;
}
function sprStove() {
    var c = mk(26, 26), g = c.getContext('2d');
    R(g, 0, 0, 26, 4, '#31363e');                              // cooktop edge
    R(g, 3, 1, 6, 2, P.k); R(g, 15, 1, 6, 2, P.k);
    R(g, 0, 4, 26, 22, P.porc); box1(g, 0, 4, 26, 22, P.k);
    R(g, 3, 6, 3, 2, P.k); R(g, 8, 6, 3, 2, P.k); R(g, 13, 6, 3, 2, P.k); // knobs
    R(g, 3, 10, 20, 12, P.k);
    R(g, 5, 12, 16, 8, '#3d3020');                             // oven window
    R(g, 7, 14, 5, 3, 'rgba(255,255,255,0.18)');
    box1(g, 0, 0, 26, 4, P.k);
    return c;
}
function sprStool() {
    var c = mk(10, 20), g = c.getContext('2d');
    R(g, 0, 0, 10, 4, P.slate); R(g, 0, 0, 10, 1, shade(P.slate, 1.3));
    R(g, 1, 4, 2, 16, P.wd2); R(g, 7, 4, 2, 16, P.wd2);
    R(g, 1, 12, 8, 2, P.wd2);
    box1(g, 0, 0, 10, 4, P.k);
    return c;
}
function sprPlant() {
    var c = mk(16, 28), g = c.getContext('2d');
    R(g, 5, 2, 6, 8, P.grn);
    R(g, 1, 5, 6, 6, P.grn); R(g, 9, 4, 6, 7, P.grn2);
    R(g, 3, 0, 4, 5, P.grn2); R(g, 7, 8, 4, 5, P.grn);
    R(g, 4, 16, 8, 10, P.pot); box1(g, 4, 16, 8, 10, P.k);
    R(g, 5, 16, 6, 2, shade(P.pot, 0.75));
    return c;
}
function sprLamp(glowOn) {
    var c = mk(12, 40), g = c.getContext('2d');
    R(g, 1, 0, 10, 8, glowOn ? P.yell : P.cream2);
    R(g, 2, 1, 8, 2, glowOn ? '#fff8d0' : P.cream);
    box1(g, 1, 0, 10, 8, P.k);
    R(g, 5, 8, 2, 28, '#2a2a30');
    R(g, 2, 36, 8, 3, '#2a2a30');
    return c;
}
function sprBookshelf() {
    var c = mk(16, 30), g = c.getContext('2d');
    R(g, 0, 0, 16, 30, P.wd2); box1(g, 0, 0, 16, 30, P.k);
    var spines = [P.red2, P.teal, P.gold, P.purp, P.grn, P.blank];
    for (var s = 0; s < 3; s++) {
        R(g, 2, 2 + s * 9, 12, 7, '#3d2c1c');
        for (var i = 0; i < 5; i++) R(g, 3 + i * 2.4, 3 + s * 9, 2, 5, spines[(s * 2 + i) % 6]);
    }
    return c;
}
function sprTv() {
    var c = mk(40, 22), g = c.getContext('2d');
    R(g, 0, 0, 40, 22, P.k);
    R(g, 2, 2, 36, 18, P.glass);
    R(g, 4, 4, 12, 6, '#5a6a78');                              // glint
    R(g, 18, 19, 3, 2, P.red);                                 // standby led
    return c;
}
function sprRecord() {
    var c = mk(20, 23), g = c.getContext('2d');
    R(g, 4, 0, 10, 1, '#17171a');                              // vinyl edge
    R(g, 1, 1, 18, 3, P.wd1); R(g, 1, 1, 18, 1, shade(P.wd1, 1.2));
    R(g, 0, 4, 20, 16, P.wd1); box1(g, 0, 4, 20, 16, P.k);
    for (var i = 0; i < 3; i++) R(g, 3, 7 + i * 4, 14, 2, P.wd3);
    R(g, 2, 20, 3, 3, P.k); R(g, 15, 20, 3, 3, P.k);
    box1(g, 1, 1, 18, 3, P.k);
    return c;
}

var DESK_A = null, DESK_B = null, LAMP_ON = null;
function buildSprites() {
    SPRITES.length = 0;
    DESK_A = sprDesk(0); DESK_B = sprDesk(1); LAMP_ON = sprLamp(true);
    /*   plan x, plan z, canvas,        wC,   hC,  collide r, glow, yOff
       heights run ~1.2x true scale: slightly oversized furniture is the
       retro-fp cheat that keeps things readable at room distances */
    spr(214, 46, DESK_A, 8.5, 6.2, 3.2, true);                 // desk + URE BOY (the target)
    spr(214, 12, sprTv(), 7, 4, 0, false, 5.2);                // the tv, mounted on the wall
    spr(226, 143, sprCouch(), 8.5, 5.2, 3.6);
    spr(287, 134, sprCowChair(), 4.2, 5.4, 2);
    spr(226, 101, sprTable(), 5.5, 2.4, 2.4);
    spr(139, 42, sprPlant(), 2.6, 5.2, 1);
    spr(301, 44, sprLamp(false), 2.1, 7.4, 1);
    spr(185, 226, sprBookshelf(), 2.8, 6, 1.4);
    spr(297, 225, sprRecord(), 3.4, 4.2, 1.6);
    spr(58, 67, sprBed(), 7.4, 4, 3.4);
    spr(22, 134, sprDresser(), 2.8, 4.8, 1.4);
    spr(104, 41, sprNightstand(), 2.4, 3.8, 1.2);
    spr(101, 200, sprWasher(), 4.4, 7.6, 2.2);
    spr(62, 374, sprTub(), 12, 3.8, 5);
    spr(23, 309, sprToilet(), 2.4, 3.9, 1.2);
    spr(33, 267, sprVanity(), 4.8, 6.6, 2.2);
    spr(222, 326, sprIsland(), 5.8, 5.2, 3);
    spr(296, 266, sprFridge(), 3.8, 8.6, 2);
    spr(226, 395, sprStove(), 4.8, 5.4, 2.2);
    spr(190, 312, sprStool(), 1.6, 3.5, 0.9);
    spr(190, 340, sprStool(), 1.6, 3.5, 0.9);
}
var DESK = null;                                   // set in boot: SPRITES[0]

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
    /* furniture pushes back */
    for (var i = 0; i < SPRITES.length; i++) {
        var s = SPRITES[i];
        if (!s.r) continue;
        var dx = PL.x - s.x, dz = PL.z - s.z;
        var d2 = dx * dx + dz * dz, min = s.r + 0.9;
        if (d2 > 0.0001 && d2 < min * min) {
            var d = Math.sqrt(d2);
            PL.x = s.x + dx / d * min;
            PL.z = s.z + dz / d * min;
        }
    }
}
function hitsWall(x, z) {
    return solidCell(Math.floor(x - PR), Math.floor(z - PR)) ||
           solidCell(Math.floor(x + PR), Math.floor(z - PR)) ||
           solidCell(Math.floor(x - PR), Math.floor(z + PR)) ||
           solidCell(Math.floor(x + PR), Math.floor(z + PR));
}

/* ============================================================
   RENDER
   ============================================================ */
var ZBUF = new Float32Array(W);
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

    /* sprites, far to near */
    var order = [];
    for (i = 0; i < SPRITES.length; i++) {
        var s = SPRITES[i];
        var dx = s.x - PL.x, dz = s.z - PL.z;
        var invDet = 1 / (PL.planeX * PL.dirZ - PL.dirX * PL.planeZ);
        var tx = invDet * (PL.dirZ * dx - PL.dirX * dz);
        var ty = invDet * (-PL.planeZ * dx + PL.planeX * dz);
        if (ty > 0.2) order.push({ s: s, tx: tx, ty: ty });
    }
    order.sort(function (a, b) { return b.ty - a.ty; });
    for (i = 0; i < order.length; i++) {
        var o = order[i], s2 = o.s;
        var sx = (W / 2) * (1 + o.tx / o.ty);
        var ppw2 = FOCAL / o.ty;
        var sh = s2.hC * ppw2;
        var sw = s2.wC * ppw2;
        var bot2 = horizon + (EYE - s2.yOff) * ppw2;
        var top2 = bot2 - sh;
        var x0 = Math.floor(sx - sw / 2), x1 = Math.ceil(sx + sw / 2);
        if (x1 < 0 || x0 >= W) continue;
        var cv = s2.cv;
        if (s2 === DESK) cv = (reduce || FR % 2) ? DESK_B : DESK_A;
        /* the URE BOY glow, behind the desk sprite */
        if (s2.glow && ZBUF[clamp(Math.round(sx), 0, W - 1)] > o.ty) {
            var pulse = reduce ? 0.5 : (Math.sin(T * 2.4) + 1) / 2;
            var gr = sw * (0.28 + pulse * 0.1);
            var cxg = sx, cyg = top2 + sh * 0.28;
            var grad = ctx.createRadialGradient(cxg, cyg, 1, cxg, cyg, gr);
            grad.addColorStop(0, 'rgba(255,84,54,' + (0.3 + pulse * 0.25) + ')');
            grad.addColorStop(1, 'rgba(255,84,54,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(cxg - gr, cyg - gr, gr * 2, gr * 2);
        }
        /* occlusion: fast path when fully visible, else per-strip */
        var visible = true;
        for (var cx2 = Math.max(0, x0); cx2 < Math.min(W, x1); cx2 += 2) {
            if (ZBUF[cx2] < o.ty) { visible = false; break; }
        }
        if (visible) {
            ctx.drawImage(cv, x0, top2, sw, sh);
        } else {
            var tcw = cv.width;
            for (var st = Math.max(0, x0); st < Math.min(W, x1); st++) {
                if (ZBUF[st] < o.ty) continue;
                var tc = Math.floor((st - x0) / sw * tcw);
                ctx.drawImage(cv, tc, 0, 1, cv.height, st, top2, 1, sh);
            }
        }
    }

    /* phase tint */
    if (curPhase === 'morning') { R(ctx, 0, 0, W, H, 'rgba(255,205,150,0.07)'); }
    else if (curPhase === 'evening') { R(ctx, 0, 0, W, H, 'rgba(255,150,80,0.1)'); }
    else if (curPhase === 'night') { R(ctx, 0, 0, W, H, 'rgba(30,40,90,0.22)'); }

    drawMinimap();
    drawTrans();
}

/* minimap: the flat plan, tiny, top-right */
function drawMinimap() {
    var mx = W - MW - 6, my = 5;
    ctx.globalAlpha = 0.72;
    R(ctx, mx - 2, my - 2, MW + 4, MH + 4, '#101014');
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#8a8a82';
    for (var r = 0; r < MH; r++) for (var c = 0; c < MW; c++) {
        if (MAP[r][c] > 0) ctx.fillRect(mx + c, my + r, 1, 1);
    }
    ctx.fillStyle = P.red;
    ctx.fillRect(mx + Math.round(PL.x) - 1, my + Math.round(PL.z) - 1, 2, 2);
    ctx.fillRect(mx + Math.round(PL.x + PL.dirX * 2.5), my + Math.round(PL.z + PL.dirZ * 2.5), 1, 1);
    box1(ctx, mx - 2, my - 2, MW + 4, MH + 4, P.k);
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
    needsDraw = true;
    present();
}

/* ─────────────────────── input ────────────────────────────── */
var KEYS = {};
var look = { id: -1, lx: 0, ly: 0 };
var stick = { id: -1, x0: 0, y0: 0, dx: 0, dy: 0 };
function onKey(e, down) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toLowerCase();
    var used = true;
    if (k === 'w' || k === 'arrowup') KEYS.f = down;
    else if (k === 's' || k === 'arrowdown') KEYS.b = down;
    else if (k === 'a') KEYS.sl = down;
    else if (k === 'd') KEYS.sr = down;
    else if (k === 'arrowleft') KEYS.tl = down;
    else if (k === 'arrowright') KEYS.tr = down;
    else if ((k === 'e' || k === 'enter') && down && promptOn) { enterConsole(); }
    else used = false;
    if (used) e.preventDefault();
    needsDraw = true;
}
function onDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    try { disp.setPointerCapture(e.pointerId); } catch (er) {}
    var r = disp.getBoundingClientRect();
    var half = r.left + r.width / 2;
    if (e.pointerType !== 'mouse' && e.clientX < half && stick.id === -1) {
        stick.id = e.pointerId;
        stick.x0 = e.clientX; stick.y0 = e.clientY;
        stick.dx = 0; stick.dy = 0;
    } else if (look.id === -1) {
        look.id = e.pointerId;
        look.lx = e.clientX; look.ly = e.clientY;
    }
}
function onMove(e) {
    if (e.pointerId === stick.id) {
        stick.dx = clamp((e.clientX - stick.x0) / 46, -1, 1);
        stick.dy = clamp((e.clientY - stick.y0) / 46, -1, 1);
    } else if (e.pointerId === look.id) {
        var dx = e.clientX - look.lx, dy = e.clientY - look.ly;
        look.lx = e.clientX; look.ly = e.clientY;
        rotate(dx * 0.0042);
        PL.pitch = clamp(PL.pitch - dy * 0.3, -80, 80);
        needsDraw = true;
    }
}
function onUp(e) {
    if (e.pointerId === stick.id) { stick.id = -1; stick.dx = 0; stick.dy = 0; }
    if (e.pointerId === look.id) look.id = -1;
}

/* ──────────────── the boot prompt (proximity) ──────────────── */
var promptOn = false;
function checkPrompt() {
    if (!DESK) return;
    var dx = DESK.x - PL.x, dz = DESK.z - PL.z;
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
    buildSprites();
    DESK = SPRITES[0];

    /* dev handle: /1p/?dev + ?x=&z=&a= spawn overrides */
    try {
        var q = window.location.search.replace('?', '').split('&');
        var a0 = null;
        for (var qi = 0; qi < q.length; qi++) {
            var kv = q[qi].split('=');
            var qv = parseFloat(kv[1]);
            if (!isFinite(qv)) continue;
            if (kv[0] === 'x') PL.x = clamp(qv, 1.5, MW - 1.5);
            if (kv[0] === 'z') PL.z = clamp(qv, 1.5, MH - 1.5);
            if (kv[0] === 'a') a0 = qv;
        }
        if (a0 !== null) { PL.dirX = Math.cos(a0); PL.dirZ = Math.sin(a0); PL.planeX = -PL.dirZ * PLANE; PL.planeZ = PL.dirX * PLANE; }
        if (window.location.search.indexOf('dev') >= 0) {
            window.__room1p = {
                set: function (x, z, ang, pit) {
                    if (isFinite(x)) PL.x = x;
                    if (isFinite(z)) PL.z = z;
                    if (isFinite(ang)) { PL.dirX = Math.cos(ang); PL.dirZ = Math.sin(ang); PL.planeX = -PL.dirZ * PLANE; PL.planeZ = PL.dirX * PLANE; }
                    if (isFinite(pit)) PL.pitch = clamp(pit, -80, 80);
                },
                shot: function () { render(); return buf.toDataURL('image/png'); }
            };
        }
    } catch (e) {}

    if (window.PointerEvent) {
        disp.addEventListener('pointerdown', onDown);
        disp.addEventListener('pointermove', onMove);
        disp.addEventListener('pointerup', onUp);
        disp.addEventListener('pointercancel', onUp);
    } else {
        disp.addEventListener('mousedown', function (e) { e.pointerId = 1; e.pointerType = 'mouse'; onDown(e); });
        disp.addEventListener('mousemove', function (e) { e.pointerId = 1; onMove(e); });
        disp.addEventListener('mouseup', function (e) { e.pointerId = 1; onUp(e); });
    }
    window.addEventListener('keydown', function (e) { onKey(e, true); });
    window.addEventListener('keyup', function (e) { onKey(e, false); });
    window.addEventListener('blur', function () { KEYS = {}; stick.dx = 0; stick.dy = 0; });
    if (promptEl) promptEl.addEventListener('click', function () { enterConsole(); });

    window.addEventListener('pageshow', function (e) {
        if (e.persisted) {
            navDone = false; TRANS.on = false; TRANS.t = 0;
            clearTimeout(navTimer);
            needsDraw = true;
        }
    });

    if (window.ResizeObserver) { new ResizeObserver(resize).observe(holder); }
    window.addEventListener('resize', resize);
    resize();

    render();
    present();

    rafId = requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
