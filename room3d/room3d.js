/* ============================================================
   URE ROOM 3D — isaac's apartment as a spinning pixel diorama
   Same floor plan as /room/, extruded. A hand-rolled ortho
   box renderer: painter-sorted quads, three-tone flat shading,
   low-res buffer scaled up nearest-neighbor so it stays pixel.
   Zero dependencies, one file. Drag to spin. The glowing thing
   on the desk still goes somewhere.
   ============================================================ */
(function () {
'use strict';

/* ─────────────────────────── core ─────────────────────────── */
var W = 300, H = 270;                              // native buffer: low enough to stay chunky
var buf = document.createElement('canvas');
buf.width = W; buf.height = H;
var ctx = buf.getContext('2d');

var disp = null, dctx = null, holder = null, tipEl = null;
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
function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
    var g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
    var b = clamp(Math.round((n & 255) * f), 0, 255);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/* ───────────────────────── palette ────────────────────────── */
var P = {
    k: '#15151a',
    red: '#d81e05', red2: '#8f1305',
    fl: '#a1734b', flSeam: '#8a6240',
    tile: '#ccd3d4', tile2: '#b7bfc2',
    wallTop: '#ece8da', wall: '#d9d3c0',
    wd1: '#a8794e', wd2: '#7c5636', wd3: '#573b26',
    cream: '#e6e1d1', cream2: '#c8c2af',
    cow: '#f4f2e6', cowDk: '#26262b',
    duv: '#dcd6c4', blank: '#5e93cf',
    slate: '#454c57', kcab: '#4a4f58', ktop: '#d9d5c7',
    steel: '#9aa3ad', porc: '#eff0ec', water: '#cfe0e4',
    grn: '#5d8544', grn2: '#42663a', pot: '#b06a4a',
    teal: '#1f9e98', purp: '#7b53c9', gold: '#e8c04a', yell: '#f4dd7c',
    glass: '#8fc0e8', tv: '#26262b', shell: '#d9d8cf', dmg: '#9bbc0f'
};

/* ─────────────────────── camera ───────────────────────────── */
/* plan coords: x 0..320, z 0..416 (the 2d room's y). world = centered. */
var CX = 160, CZ = 208;
var cam = { yaw: -0.62, pitch: 0.94, zoom: 1.05 }; // ~54° pitch; 1.05 is the max that never clips mid-spin
var SIN_Y = 0, COS_Y = 1, SIN_P = 0, COS_P = 1, SCALE = 1, CYOFF = 0;
function camPrep() {
    SIN_Y = Math.sin(cam.yaw); COS_Y = Math.cos(cam.yaw);
    SIN_P = Math.sin(cam.pitch); COS_P = Math.cos(cam.pitch);
    /* fit the worst-case spin: footprint radius + wall height, with margin */
    var r = Math.sqrt(CX * CX + CZ * CZ);
    var sH = (W / 2 - 8) / r;
    var sV = (H / 2 - 8) / (r * SIN_P + 44 * COS_P);
    SCALE = Math.min(sH, sV) * cam.zoom;
    CYOFF = H / 2 + 16 * COS_P * SCALE;            // nudge down so walls don't crowd the top
}
function proj(x, y, z) {
    var wx = x - CX, wz = z - CZ;
    var sx = wx * COS_Y - wz * SIN_Y;
    var u = wx * SIN_Y + wz * COS_Y;
    return {
        x: W / 2 + sx * SCALE,
        y: CYOFF + (u * SIN_P - y * COS_P) * SCALE,
        d: u * COS_P + y * SIN_P                   // painter depth: bigger = nearer
    };
}
/* sun pinned to the world, so faces relight as the room spins */
var SUN = (function () {
    var v = { x: 0.45, y: 0.78, z: -0.42 };
    var l = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return { x: v.x / l, y: v.y / l, z: v.z / l };
})();
function faceLight(nx, ny, nz) {
    var d = nx * SUN.x + ny * SUN.y + nz * SUN.z;
    return 0.58 + 0.42 * Math.max(0, d);
}
/* normalized so top faces get the palette color at full strength */
var LIGHT = (function () {
    var top = faceLight(0, 1, 0);
    return {
        top: 1,
        xp: faceLight(1, 0, 0) / top, xn: faceLight(-1, 0, 0) / top,
        zp: faceLight(0, 0, 1) / top, zn: faceLight(0, 0, -1) / top
    };
})();

/* ─────────────────────── scene data ───────────────────────── */
/* box: x,z plan-min corner · w,d footprint · y0 base height · h height
   c body color · t top color (defaults to body) · glow: skip sun dimming */
var BOXES = [];
function box(x, z, w, d, y0, h, c, t, glow) {
    var o = { x: x, z: z, w: w, d: d, y0: y0, h: h, c: c, t: t || c, glow: glow || false, hull: '' };
    BOXES.push(o);
    return o;
}
/* flat decor quads on the floor plane, drawn before boxes (rugs, seams, AO) */
var FLATS = [];
function flat(x, z, w, d, c, a) { FLATS.push({ x: x, z: z, w: w, d: d, c: c, a: a || 1 }); }
function ao(x, z, w, d) { FLATS.push({ x: x - 3, z: z - 3, w: w + 6, d: d + 6, c: '#0a0c12', a: 0.2 }); }

function buildScene() {
    BOXES.length = 0; FLATS.length = 0;

    /* floors (slightly inset from the wall ring) */
    flat(10, 10, 300, 396, P.fl);
    flat(10, 254, 114, 152, P.tile);                       // bathroom tile
    /* plank seams */
    for (var zz = 26; zz < 400; zz += 16) flat(10, zz, 300, 1.2, P.flSeam, 0.5);
    /* bath checker */
    for (var cz = 254; cz < 400; cz += 12) {
        for (var cx = 10; cx < 118; cx += 12) {
            if ((((cx - 10) / 12) + ((cz - 254) / 12)) % 2 < 1) flat(cx, cz, Math.min(12, 124 - cx), Math.min(12, 406 - cz), P.tile2);
        }
    }
    /* rugs */
    flat(186, 66, 96, 96, P.red2); flat(190, 70, 88, 88, shade(P.red2, 0.85));
    flat(188, 68, 92, 1.5, P.gold); flat(188, 160, 92, 1.5, P.gold);
    flat(40, 112, 48, 40, P.teal);
    flat(134, 252, 28, 92, P.red2);
    flat(132, 388, 32, 14, '#8a6c46');

    /* ── walls (dollhouse height, low enough to see inside) ──
       perimeter walls carry a hull tag: their outward faces draw in a
       post-pass, because centroid painter-sorting lets tall interior
       boxes bleed through them at back angles */
    var WH = 30, IH = 26, TH = 6;
    box(4, 4, 312, TH, 0, WH, P.wall, P.wallTop).hull = 'n';           // north
    box(4, 406, 128, TH, 0, WH, P.wall, P.wallTop).hull = 's';         // south (left of door)
    box(164, 406, 152, TH, 0, WH, P.wall, P.wallTop).hull = 's';       // south (right of door)
    box(4, 10, TH, 396, 0, WH, P.wall, P.wallTop).hull = 'w';          // west
    box(310, 10, TH, 396, 0, WH, P.wall, P.wallTop).hull = 'e';        // east
    /* interior spine V1 with door gaps */
    box(124, 10, 4, 122, 0, IH, P.wall, P.wallTop);
    box(124, 164, 4, 32, 0, IH, P.wall, P.wallTop);
    box(124, 228, 4, 40, 0, IH, P.wall, P.wallTop);
    box(124, 300, 4, 106, 0, IH, P.wall, P.wallTop);
    box(10, 164, 114, 4, 0, IH, P.wall, P.wallTop);                    // H1
    box(10, 238, 114, 4, 0, IH, P.wall, P.wallTop);                    // H2
    box(168, 196, 4, 210, 0, IH, P.wall, P.wallTop);                   // V2
    /* window panes set into the walls */
    box(34, 3.5, 56, 7, 12, 14, P.glass, P.glass, true);               // bedroom north
    box(252, 3.5, 48, 7, 12, 14, P.glass, P.glass, true);              // living north
    box(309.5, 44, 7, 48, 12, 14, P.glass, P.glass, true);             // living east
    box(309.5, 310, 7, 36, 12, 14, P.glass, P.glass, true);            // kitchen east
    /* open front door leaf */
    box(132, 376, 4, 30, 0, 28, P.wd1, P.wd2);

    /* ── bedroom ── */
    ao(28, 30, 60, 74);
    box(28, 30, 60, 74, 0, 7, P.wd2, P.wd2);                           // frame
    box(28, 30, 60, 6, 0, 15, P.wd2, P.wd3);                           // headboard
    box(30, 36, 56, 66, 6, 6, P.duv);                                  // mattress
    box(33, 39, 24, 12, 12, 3.5, P.porc);                              // pillows
    box(59, 39, 24, 12, 12, 3.5, P.porc);
    box(30, 78, 56, 22, 11.4, 1.6, P.blank);                           // throw blanket
    ao(94, 32, 20, 18);
    box(94, 32, 20, 18, 0, 11, P.wd1);                                 // nightstand
    box(101, 41, 5, 5, 11, 4, P.cream2);                               // little lamp
    box(100, 40, 7, 3.5, 15, 3.5, P.yell, P.yell, true);
    ao(12, 112, 20, 44);
    box(12, 112, 20, 44, 0, 15, P.wd1);                                // dresser
    box(31.4, 118, 1.2, 6, 6, 2, P.gold, P.gold, true);                // knobs
    box(31.4, 132, 1.2, 6, 6, 2, P.gold, P.gold, true);
    box(31.4, 146, 1.2, 6, 6, 2, P.gold, P.gold, true);
    ao(100, 140, 16, 18);
    box(100, 140, 16, 18, 0, 12, '#b89b64');                           // laundry basket
    box(103, 143, 10, 12, 12, 2, P.blank);                             // the escaping sock

    /* ── closet + laundry ── */
    ao(84, 170, 34, 60);
    box(84, 170, 34, 60, 0, 26, P.porc);                               // washer/dryer stack
    box(117.5, 178, 1.2, 14, 8, 14, P.slate);                          // drum doors face the hall
    box(117.5, 208, 1.2, 14, 8, 14, P.slate);
    box(16, 168, 60, 3, 0, 22, P.wd1, P.wd2);                          // closet sliders
    ao(16, 196, 22, 30);
    box(16, 196, 22, 14, 0, 9, P.teal);                                // bins
    box(18, 212, 22, 14, 0, 8, P.slate);
    box(46, 214, 26, 14, 0, 8, P.red2);                                // suitcase

    /* ── bathroom ── */
    ao(14, 256, 38, 22);
    box(14, 256, 38, 22, 0, 15, P.ktop, P.ktop);                       // vanity
    box(24, 261, 18, 12, 15, 1.4, P.steel);                            // basin
    ao(14, 296, 18, 26);
    box(14, 296, 18, 8, 0, 14, P.porc);                                // toilet tank
    box(16, 304, 14, 18, 0, 8, P.porc);                                // bowl
    ao(14, 348, 96, 52);
    box(14, 348, 96, 52, 0, 11, P.porc);                               // tub
    box(20, 354, 84, 40, 7, 3, P.water, P.water, true);                // the water
    box(104, 366, 4, 4, 11, 6, P.steel);                               // faucet

    /* ── living room ── */
    ao(192, 128, 68, 30);
    box(192, 128, 68, 30, 0, 9, P.cream);                              // couch base
    box(192, 150, 68, 8, 0, 19, P.cream2);                             // back
    box(192, 128, 7, 30, 0, 14, P.cream2);                             // arms
    box(253, 128, 7, 30, 0, 14, P.cream2);
    box(200, 130, 25, 19, 9, 3, P.cream, '#f2eee0');                   // cushions
    box(227, 130, 25, 19, 9, 3, P.cream, '#f2eee0');
    box(203, 146, 9, 4, 12, 8, P.blank);                               // pillows against the back
    box(240, 146, 9, 4, 12, 8, P.gold);
    ao(272, 118, 30, 32);
    box(272, 118, 30, 32, 0, 11, P.cow);                               // the cow chair
    box(272, 142, 30, 8, 0, 19, P.cow);                                // back
    box(274, 116.5, 5, 3, 15, 4, P.cow);                               // ears
    box(295, 116.5, 5, 3, 15, 4, P.cowDk);
    box(274, 120, 9, 7, 11, 1, P.cowDk);                               // patches (top)
    box(290, 130, 10, 8, 11, 1, P.cowDk);
    box(279, 143.5, 8, 5, 19, 1, P.cowDk);
    box(271.4, 122, 1.2, 10, 3, 6, P.cowDk);                           // patches (hide sides)
    box(301.4, 130, 1.2, 9, 4, 5, P.cowDk);
    box(280, 116.8, 8, 1.2, 4, 6, P.cowDk);
    ao(204, 88, 44, 26);
    box(204, 88, 44, 26, 0, 8.5, P.wd1, shade(P.wd1, 1.12));           // coffee table
    box(212, 94, 4, 4, 8.5, 4, P.red);                                 // the d20s (roughly)
    box(222, 100, 4, 4, 8.5, 4, P.purp);
    ao(182, 30, 64, 22);
    box(182, 30, 64, 22, 0, 13, P.wd1, shade(P.wd1, 1.12));            // desk
    box(186, 34, 8, 8, 13, 4, P.porc);                                 // mug
    box(228, 36, 13, 9, 13, 4, P.tv);                                  // camera
    ao(208, 54, 20, 18);
    box(210, 56, 16, 14, 0, 9, P.slate);                               // desk chair
    box(210, 66, 16, 4, 0, 16, shade(P.slate, 0.8));
    /* the URE BOY: shell, dmg screen, red cart, on the desk */
    box(206, 34, 11, 14, 13, 3.2, P.shell, P.shell);
    box(208, 36.5, 7, 6, 16.2, 0.8, P.dmg, P.dmg, true);
    box(208.5, 31.5, 6, 3, 13.6, 2.6, P.red, P.red, true);
    /* TV on the north wall (kept below the wall top) */
    box(186, 9.5, 56, 2.5, 13, 15, P.tv, P.tv);
    box(188, 11.2, 52, 1.4, 15, 11, '#39434d', '#39434d', true);       // the panel
    ao(296, 36, 12, 14);
    box(300, 40, 3, 3, 0, 22, '#2a2a30');                              // floor lamp pole
    box(294, 36, 12, 11, 22, 7, P.yell, P.yell, true);                 // shade
    ao(132, 34, 14, 16);
    box(134, 38, 10, 9, 0, 6, P.pot);                                  // plant
    box(133, 35, 12, 12, 6, 9, P.grn, P.grn2);
    box(136, 38, 6, 6, 15, 4, P.grn2);

    /* ── flex zone ── */
    ao(176, 204, 18, 44);
    box(176, 204, 18, 44, 0, 15, P.wd2, P.wd2);                        // bookcase
    var spines = [P.red2, P.teal, P.gold, P.purp, P.grn, P.blank];
    for (var i = 0; i < 6; i++) box(178, 207 + i * 6.6, 14, 5, 15, 2.4, spines[i]);
    ao(284, 204, 26, 42);
    box(284, 204, 26, 42, 0, 12, P.wd1, shade(P.wd1, 1.1));            // record console
    box(289, 208, 16, 16, 12, 1.2, '#17171a');                         // platter
    box(296, 215, 2, 2, 13.2, 0.8, P.red, P.red, true);

    /* ── kitchen ── */
    ao(284, 288, 26, 118);
    box(284, 288, 26, 118, 0, 17, P.kcab, P.ktop);                     // east counter
    box(289, 310, 17, 26, 17, 1.4, P.steel);                           // sink
    ao(176, 384, 108, 22);
    box(176, 384, 108, 22, 0, 17, P.kcab, P.ktop);                     // south counter
    box(208, 386, 36, 18, 17, 1.4, '#31363e');                         // stove top
    box(184, 388, 12, 11, 17, 7, P.steel);                             // kettle
    box(252, 387, 24, 15, 17, 9, P.tv);                                // microwave
    ao(282, 248, 28, 36);
    box(282, 248, 28, 36, 0, 30, P.steel, shade(P.steel, 1.1));        // fridge
    ao(200, 296, 44, 60);
    box(200, 296, 44, 60, 0, 15, P.kcab);                              // island base
    box(198, 294, 48, 64, 15, 3, P.ktop, shade(P.ktop, 1.06));         // butcher top
    box(208, 306, 11, 11, 18, 8, P.water);                             // cookie jar
    box(210, 308, 7, 7, 26, 2, P.wd2);                                 // lid
    ao(184, 306, 12, 12);
    box(184, 306, 12, 12, 0, 10, P.wd2, P.slate);                      // stools
    ao(184, 334, 12, 12);
    box(184, 334, 12, 12, 0, 10, P.wd2, P.slate);

    /* ── entry ── */
    ao(150, 352, 16, 26);
    box(150, 352, 16, 26, 0, 12, P.wd1);                               // entry table
    box(153, 356, 10, 8, 12, 2.5, P.slate);                            // key bowl
    box(134, 368, 11, 10, 0, 3, P.porc);                               // shoes
    box(148, 370, 9, 9, 0, 3, P.slate);
}

/* ─────────────────────── render ───────────────────────────── */
var UREBOY_POS = { x: 211.5, y: 16, z: 41 };       // world anchor for glow + hit test
var ureScreen = { x: -99, y: -99 };

function quad(p1, p2, p3, p4, col, alpha) {
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

function render() {
    camPrep();
    ctx.clearRect(0, 0, W, H);

    /* floor decor first (no sorting needed: coplanar, back-to-front by list order) */
    for (var i = 0; i < FLATS.length; i++) {
        var f = FLATS[i];
        quad(proj(f.x, 0, f.z), proj(f.x + f.w, 0, f.z),
             proj(f.x + f.w, 0, f.z + f.d), proj(f.x, 0, f.z + f.d), f.c, f.a);
    }

    /* collect visible box faces, painter-sort, draw. outward faces of the
       perimeter hull go to a post-pass: when visible, the camera is outside
       the apartment, so they are strictly the nearest surface */
    var faces = [], post = [];
    for (var b = 0; b < BOXES.length; b++) {
        var o = BOXES[b];
        var x0 = o.x, x1 = o.x + o.w, z0 = o.z, z1 = o.z + o.d;
        var yb = o.y0, yt = o.y0 + o.h;
        var lit = o.glow ? 1 : 0;
        /* top */
        pushFace(faces, [x0, yt, z0, x1, yt, z0, x1, yt, z1, x0, yt, z1],
            shade(o.t, lit ? 1 : LIGHT.top));
        /* sides: a face is visible when its outward normal points at the camera,
           i.e. dot(normal, (SIN_Y, COS_Y)) > 0 */
        if (SIN_Y > 0) pushFace(o.hull === 'e' ? post : faces, [x1, yb, z0, x1, yb, z1, x1, yt, z1, x1, yt, z0], shade(o.c, lit ? 0.96 : LIGHT.xp));
        else if (SIN_Y < 0) pushFace(o.hull === 'w' ? post : faces, [x0, yb, z0, x0, yb, z1, x0, yt, z1, x0, yt, z0], shade(o.c, lit ? 0.96 : LIGHT.xn));
        if (COS_Y > 0) pushFace(o.hull === 's' ? post : faces, [x0, yb, z1, x1, yb, z1, x1, yt, z1, x0, yt, z1], shade(o.c, lit ? 0.96 : LIGHT.zp));
        else if (COS_Y < 0) pushFace(o.hull === 'n' ? post : faces, [x0, yb, z0, x1, yb, z0, x1, yt, z0, x0, yt, z0], shade(o.c, lit ? 0.96 : LIGHT.zn));
    }
    faces.sort(function (a, b2) { return a.d - b2.d; });
    post.sort(function (a, b3) { return a.d - b3.d; });
    for (var q = 0; q < faces.length; q++) {
        var fc = faces[q];
        quad(fc.p[0], fc.p[1], fc.p[2], fc.p[3], fc.c);
    }
    for (var q2 = 0; q2 < post.length; q2++) {
        var fp = post[q2];
        quad(fp.p[0], fp.p[1], fp.p[2], fp.p[3], fp.c);
    }

    /* the URE BOY's red glow, pulsing over everything */
    var up = proj(UREBOY_POS.x, UREBOY_POS.y, UREBOY_POS.z);
    ureScreen.x = up.x; ureScreen.y = up.y;
    var pulse = reduce ? 0.5 : (Math.sin(T * 2.4) + 1) / 2;
    var gr = 10 + pulse * 6;
    var grad = ctx.createRadialGradient(up.x, up.y, 1, up.x, up.y, gr);
    grad.addColorStop(0, 'rgba(255,84,54,' + (0.34 + pulse * 0.25) + ')');
    grad.addColorStop(1, 'rgba(255,84,54,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(up.x - gr, up.y - gr, gr * 2, gr * 2);
    /* blinking LED pixel */
    if (reduce || FR % 2) { ctx.fillStyle = P.red; ctx.fillRect(Math.round(up.x) - 4, Math.round(up.y), 2, 2); }

    drawTrans();
}

function pushFace(faces, v, col) {
    var p1 = proj(v[0], v[1], v[2]), p2 = proj(v[3], v[4], v[5]),
        p3 = proj(v[6], v[7], v[8]), p4 = proj(v[9], v[10], v[11]);
    faces.push({ p: [p1, p2, p3, p4], c: col, d: (p1.d + p2.d + p3.d + p4.d) / 4 });
}

/* ───────────────────── dither exit ────────────────────────── */
var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
var TRANS = { on: false, t: 0, dur: 0.55 };
var navDone = false, navTimer = null;
function goConsole() { if (navDone) return; navDone = true; window.location.href = '/ureboy/'; }
function enterConsole() {
    if (navDone || TRANS.on) return;               // no double-boot, no stacked timers
    if (reduce) { goConsole(); return; }
    TRANS.on = true; TRANS.t = 0;
    clearTimeout(navTimer);
    navTimer = setTimeout(goConsole, 1100);        // rAF can stall in hidden tabs
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
function bufCoords(e) {
    var r = disp.getBoundingClientRect();
    if (!r.width || !r.height) return { x: -99, y: -99 };
    var px = (e.clientX - r.left) * (disp.width / r.width);
    var py = (e.clientY - r.top) * (disp.height / r.height);
    var s = Math.min(disp.width / W, disp.height / H) || 1;
    return {
        x: (px - ((disp.width - Math.round(W * s)) >> 1)) / s,
        y: (py - ((disp.height - Math.round(H * s)) >> 1)) / s
    };
}

/* ─────────────────────── input ────────────────────────────── */
var drag = { on: false, id: -1, x0: 0, y0: 0, lx: 0, ly: 0, moved: 0, t0: 0, type: 'mouse' };
var PTRS = {};                                     // active pointers: id -> {x, y}
var pinch = { on: false, d0: 0, z0: 1 };
var vyaw = 0, idleT = 4;                           // spins gently from first paint
function ptrCount() { var n = 0, k; for (k in PTRS) if (PTRS.hasOwnProperty(k)) n++; return n; }
function pinchDist() {
    var ids = [], k;
    for (k in PTRS) if (PTRS.hasOwnProperty(k)) ids.push(k);
    if (ids.length < 2) return 0;
    var a = PTRS[ids[0]], b = PTRS[ids[1]];
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
}
function overUreboy(bx, by, coarse) {
    var r = coarse ? 22 : 15;
    var dx = bx - ureScreen.x, dy = by - ureScreen.y;
    return dx * dx + dy * dy < r * r;
}
function onDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    PTRS[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { disp.setPointerCapture(e.pointerId); } catch (er) {}
    idleT = 0;
    if (ptrCount() >= 2) {
        /* second finger: stop the drag dead, start a pinch */
        drag.on = false; vyaw = 0;
        pinch.on = true; pinch.d0 = pinchDist() || 1; pinch.z0 = cam.zoom;
        disp.classList.remove('dragging');
        return;
    }
    drag.on = true; drag.id = e.pointerId; drag.type = e.pointerType || 'mouse';
    drag.x0 = drag.lx = e.clientX; drag.y0 = drag.ly = e.clientY;
    drag.moved = 0; drag.t0 = T;
    vyaw = 0;
    disp.classList.add('dragging');
}
function onMove(e) {
    idleT = 0;
    if (PTRS[e.pointerId]) { PTRS[e.pointerId].x = e.clientX; PTRS[e.pointerId].y = e.clientY; }
    if (pinch.on) {
        var pd = pinchDist();
        if (pd > 0) { cam.zoom = clamp(pinch.z0 * pd / pinch.d0, 0.7, 1.8); needsDraw = true; }
        return;
    }
    if (drag.on && e.pointerId === drag.id) {
        var dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
        drag.lx = e.clientX; drag.ly = e.clientY;
        /* net displacement from the press point, not accumulated jitter */
        drag.moved = Math.max(drag.moved, Math.max(Math.abs(e.clientX - drag.x0), Math.abs(e.clientY - drag.y0)));
        cam.yaw += dx * 0.008;
        cam.pitch = clamp(cam.pitch + dy * 0.005, 0.55, 1.25);
        vyaw = dx * 0.008 * 60;
        needsDraw = true;
        return;
    }
    /* hover: only the URE BOY is hot in the 3d version */
    if (e.pointerType === 'mouse') {
        var c = bufCoords(e);
        var hot = overUreboy(c.x, c.y, false);
        disp.classList.toggle('pointing', hot);
        if (hot) showTip(e.clientX, e.clientY); else hideTip();
    }
}
function onUp(e) {
    delete PTRS[e.pointerId];
    if (pinch.on) {
        if (ptrCount() < 2) {
            pinch.on = false;
            /* one finger stays down: let it rotate again */
            var k, rest = null;
            for (k in PTRS) if (PTRS.hasOwnProperty(k)) rest = k;
            if (rest !== null) {
                drag.on = true; drag.id = parseInt(rest, 10) || rest;
                drag.x0 = drag.lx = PTRS[rest].x; drag.y0 = drag.ly = PTRS[rest].y;
                drag.moved = 99;                   // a pinch leftover is never a tap
                disp.classList.add('dragging');
            }
        }
        return;
    }
    if (!drag.on || e.pointerId !== drag.id) return;
    drag.on = false;
    disp.classList.remove('dragging');
    var slop = drag.type === 'mouse' ? 6 : 11;
    if (drag.moved < slop && T - drag.t0 < 0.5) {
        var c = bufCoords(e);
        if (overUreboy(c.x, c.y, drag.type !== 'mouse')) {
            if (e.pointerType !== 'mouse') { showTip(e.clientX, e.clientY, true); clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 1200); }
            enterConsole();
        }
    }
}
function onWheel(e) {
    e.preventDefault();
    cam.zoom = clamp(cam.zoom * (1 - e.deltaY * 0.0012), 0.7, 1.8);
    idleT = 0; needsDraw = true;
}
var tipTimer = null;
function showTip(cx, cy, above) {
    if (!tipEl) return;
    tipEl.hidden = false;                          // content is static, set once at boot:
    var hr = holder.getBoundingClientRect();       // re-writing it would spam the live region
    var tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    var x = clamp(cx - hr.left + 14, 4, hr.width - tw - 4);
    var y = clamp(above ? (cy - hr.top - th - 16) : (cy - hr.top + 18), 4, hr.height - th - 4);
    tipEl.style.left = x + 'px';
    tipEl.style.top = y + 'px';
}
function hideTip() { if (tipEl) tipEl.hidden = true; }

/* ─────────────────────── frame loop ───────────────────────── */
var lastFR = -1;
function frame(ts) {
    rafId = requestAnimationFrame(frame);
    var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    T += dt;
    FR = Math.floor(T / 0.45);

    /* inertia + idle spin (both are self-propelled motion: reduce turns them off) */
    if (!reduce && !drag.on && Math.abs(vyaw) > 0.001) {
        cam.yaw += vyaw * dt;
        vyaw *= Math.pow(0.06, dt);                // heavy-ish flywheel
        needsDraw = true;
    }
    idleT += dt;
    if (!reduce && !drag.on && idleT > 4 && !TRANS.on) {
        cam.yaw += dt * 0.12;
        needsDraw = true;
    }
    if (TRANS.on) { TRANS.t += dt; needsDraw = true; }

    /* the glow pulses, so animate continuously unless reduced motion */
    if (!reduce) needsDraw = true;
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
    tipEl = byId('tip');
    if (!holder || !disp) return;
    dctx = disp.getContext('2d');
    if (tipEl) tipEl.innerHTML = '<b>URE BOY</b>™ · still the way in';

    buildScene();

    /* dev handle: /room3d/?yaw=-0.6&pitch=0.9&zoom=1.2 */
    try {
        var q = window.location.search.replace('?', '').split('&');
        for (var qi = 0; qi < q.length; qi++) {
            var kv = q[qi].split('=');
            var qv = parseFloat(kv[1]);
            if (!isFinite(qv)) continue;                       // Infinity would NaN the whole projection
            if (kv[0] === 'yaw') cam.yaw = qv;
            if (kv[0] === 'pitch') cam.pitch = clamp(qv, 0.55, 1.25);
            if (kv[0] === 'zoom') cam.zoom = clamp(qv, 0.7, 1.8);
        }
        /* dev-only handle for headless look checks: /room3d/?dev */
        if (window.location.search.indexOf('dev') >= 0) {
            window.__room3d = {
                shot: function () { render(); return buf.toDataURL('image/png'); },
                set: function (y, p, z) {
                    if (y !== undefined) cam.yaw = y;
                    if (p !== undefined) cam.pitch = clamp(p, 0.55, 1.25);
                    if (z !== undefined) cam.zoom = clamp(z, 0.7, 1.8);
                }
            };
        }
    } catch (e) {}

    if (window.PointerEvent) {
        disp.addEventListener('pointerdown', onDown);
        disp.addEventListener('pointermove', onMove);
        disp.addEventListener('pointerup', onUp);
        disp.addEventListener('pointercancel', function (e) {
            delete PTRS[e.pointerId];
            if (ptrCount() < 2) pinch.on = false;
            drag.on = false; vyaw = 0;
            disp.classList.remove('dragging');
        });
        disp.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { disp.classList.remove('pointing'); hideTip(); } });
    } else {
        disp.addEventListener('mousedown', function (e) { e.isPrimary = true; onDown(e); });
        disp.addEventListener('mousemove', function (e) { e.pointerType = 'mouse'; onMove(e); });
        disp.addEventListener('mouseup', function (e) { e.pointerId = drag.id; e.pointerType = 'mouse'; onUp(e); });
    }
    disp.addEventListener('wheel', onWheel, { passive: false });

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

    /* paint once immediately so there is never a blank canvas before the first rAF */
    render();
    present();

    rafId = requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
