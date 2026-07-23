/* ============================================================
   URE ROOM 1P — isaac's apartment in first person
   The same floor plan, walked through. A hand-rolled grid
   raycaster (the Wolfenstein kind) for the walls, plus real 3d
   furniture: every piece is boxes, drawn as perspective quads
   into a per-pixel depth buffer seeded from the walls, so
   furniture occludes furniture (and walls) honestly. Distance
   fog, a real-clock sky in the windows. Zero dependencies.
   Two glowing screens on the desk now: the URE BOY boots the
   console, the PC sits you down at /comp/.
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

/* ───────────────────────── palette ─────────────────────────
   sampled off Isaac's apartment photos, then walked back toward true color:
   every shot is lit by tungsten at night, so the raw pixels run amber. the
   values kept as measured are the light sources themselves. */
var P = {
    k: '#15151a',
    red: '#d81e05', red2: '#8f1305',
    wall: '#d6ccb6', wallDk: '#bdb39c',           // warm greige, not white
    trim: '#8f8778', trimLt: '#a49c8c',           // door casing + baseboards
    fl: '#96552a', flLt: '#b8703c',               // cherry hardwood
    ceil: '#cfc9b8',
    carp: '#b3a082', carp2: '#9c8a6c',            // bedroom carpet
    tile: '#dfe4e5', tile2: '#b7bfc2',
    wd1: '#a8794e', wd2: '#7c5636', wd3: '#573b26',
    esp: '#4a2c1e', esp2: '#341e14', espLit: '#6a4030',   // the desk: dark espresso
    espMag: '#7a4a68',                            // desk wood where the monitors hit it
    cream: '#ded5c0', cream2: '#c2b8a1',          // the sectional
    char: '#3a342e',                              // its charcoal throw pillows
    cow: '#f2efe4', cowDk: '#1e1c1c',
    duv: '#2f2c31', duv2: '#242227',              // the charcoal duvet
    hbd: '#ddd6cb',                               // cream headboard
    oak: '#b5834a', oak2: '#cbae7e',              // the mid-century nightstand
    slateB: '#59617a',                            // the slate-blue bed pillow
    trav: '#ded5c0', champ: '#b8b4ac',            // side-table stone; track-head metal
    leop: '#b08d63',
    blank: '#5e93cf',
    slate: '#454c57', kcab: '#4a4f58', ktop: '#d9d5c7',
    steel: '#9aa3ad', steel2: '#6f7883', porc: '#eff0ec', water: '#cfe0e4',
    chrome: '#c2c7ce', alu: '#9ba0a6',
    grn: '#5d8544', grn2: '#42663a', pot: '#b06a4a',
    teal: '#1f9e98', purp: '#7b53c9', gold: '#e8c04a', yell: '#f4dd7c',
    amber: '#fae692',                             // measured: the bedside lamp
    lime: '#a4d922',                              // the deskmat's edge
    mat: '#1d1821',                               // measured: the deskmat
    led: '#2f7bff', led2: '#8ab6ff', ledDk: '#0a1a4a',   // the tower's ring fans
    wp: '#4636d8', wp2: '#7a5cff', wpMag: '#e85ab8', wpOrg: '#ec6a38',  // that wallpaper
    fire: '#1a3a64', fire2: '#4d7bb0',            // the TV's home screen
    brick: '#9c5a48', brickDk: '#7c4234', brickW: '#d8dcdc',  // the building across the way
    blind: '#e4e2d8', blindDk: '#b4b2a6',
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
    /* rebuilt against the real floor plan (layout screenshot, 2026-07-19):
       bedroom NW + living NE split by the desk/TV divider; a center core of
       tiled dressing corridor, reach-in closet, and the PENTAGON walk-in
       whose SE corner is a 45° slant (stair-stepped here — the DDA only
       knows grid cells); windowless bathroom SW; a built-in desk nook and
       an entry closet off the hall; open kitchen SE with a peninsula and a
       structural notch in the east wall. Windows on the north wall only. */
    for (var r = 0; r < MH; r++) { MAP[r] = []; for (var c = 0; c < MW; c++) MAP[r][c] = 0; }
    setWall(0, 0, 39, 0, 1);                     // north
    setWall(0, 51, 39, 51, 1);                   // south
    setWall(0, 0, 0, 51, 1);                     // west
    setWall(39, 0, 39, 51, 1);                   // east
    setWall(5, 0, 15, 0, 2);                     // bedroom window band
    setWall(21, 0, 31, 0, 2);                    // living window band
    setWall(15, 51, 19, 51, 4);                  // front door

    setWall(18, 1, 18, 19, 1);                   // bedroom/living divider (the desk+TV wall)
    setWall(1, 19, 8, 19, 1);                    // bedroom south wall, west of the door
    setWall(12, 19, 17, 19, 1);                  // ...and east of it (door gap x 9-11)

    /* the walk-in closet: interior x14-17, west door gap z23-25, and the
       slant stepping (18,25)→(14,29) so the room narrows toward the hall.
       the corridor west of it runs 4 cells wide (x9-12) so the body AABB
       can make the dogleg south past the bathroom corner. */
    setWall(13, 20, 13, 22, 1);
    setWall(13, 26, 13, 30, 1);
    setWall(18, 20, 18, 24, 1);
    setWall(18, 25, 18, 25, 1);                  // the slanted wall, stair-stepped
    setWall(17, 26, 17, 26, 1);
    setWall(16, 27, 16, 27, 1);
    setWall(15, 28, 15, 28, 1);
    setWall(14, 29, 14, 29, 1);

    /* bathroom SW: interior x1-8 z31-50; door = the 3-cell gap x6-8 in
       row 30. tiled faces on its exterior walls, like the old map did. */
    setWall(1, 30, 5, 30, 3);                    // bath north wall
    setWall(9, 31, 9, 50, 1);                    // bath east wall (nook's back)
    setWall(0, 30, 0, 51, 3);                    // west outer, tiled
    setWall(1, 51, 8, 51, 3);                    // south outer behind the tub, tiled

    /* the built-in desk nook + entry closet, both opening east onto the hall */
    setWall(10, 35, 13, 35, 1);
    setWall(10, 43, 13, 43, 1);
    setWall(10, 44, 13, 44, 1);
    setWall(10, 50, 13, 50, 1);

    /* the kitchen's structural notch in the east wall */
    setWall(31, 32, 38, 34, 1);
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
    /* the baseboards and casings here are painted greige, not stained wood */
    R(g, 0, TH - 9, TW, 7, P.trim);              // baseboard
    R(g, 0, TH - 9, TW, 1, P.trimLt);
    R(g, 0, TH - 2, TW, 2, P.k);
    return c;
}
function texWindow() {
    /* seamless window band. what is out there is not sky — it is the red brick
       building across the way, close enough to fill the glass, with the blinds
       half down over it. */
    var c = mk(TW, TH), g = c.getContext('2d');
    g.drawImage(TEX[1], 0, 0);
    var sky = skyColors();
    var i, bx;
    R(g, 0, 10, TW, 30, sky[0]);                 // a sliver of sky up top

    /* the building: brick field, mortar courses, white sashes four lights each */
    R(g, 0, 17, TW, 23, P.brick);
    for (i = 18; i < 40; i += 3) R(g, 0, i, TW, 1, P.brickDk);
    for (bx = 1; bx < TW; bx += 11) {
        for (var by = 19; by < 38; by += 11) {
            R(g, bx, by, 8, 9, P.brickW);        // sash
            R(g, bx + 1, by + 1, 6, 3, curPhase === 'night' ? '#3b4048' : '#a8bcc8');
            R(g, bx + 1, by + 5, 6, 3, curPhase === 'night' ? '#3b4048' : '#9fb4c2');
            if (curPhase === 'night' && thash(bx, by) > 0.62) {
                R(g, bx + 1, by + 1, 6, 3, P.yell);   // somebody is up
            }
        }
    }
    /* blinds: slats down over the top of the glass, the way they always are */
    for (i = 10; i < 27; i += 2) {
        R(g, 0, i, TW, 1, P.blind);
        R(g, 0, i + 1, TW, 1, P.blindDk);
    }
    R(g, 0, 26, TW, 1, shade(P.blindDk, 0.7));   // the bottom rail's shadow

    R(g, 0, 8, TW, 2, P.trim);                   // head frame
    R(g, 0, 40, TW, 2, P.trim);
    R(g, 0, 10, 1, 30, P.trimLt);                // slim mullion at the seam
    R(g, 0, 42, TW, 3, P.trimLt);                // the deep white sill
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

/* the two glowing screens on the desk: walk up, face one, press E.
   x/z/y locate the glow + prompt; the rest styles the halo. the desk is on
   the WEST wall, so the screens face east (+x) and you meet them from the
   room side — see the PL.x guard in the glow loop and checkPrompt. */
var HOTS = [
    { x: 21.0, z: 4.5, y: 4.6, href: '/ureboy/', html: 'boot the <b>URE BOY</b>',
      rgb: '255,84,54', base: 11, amp: 5, spd: 2.4, a0: 0.28, a1: 0.22 },
    { x: 20.5, z: 9.0, y: 5.3, href: '/comp/', html: 'sit down at the <b>PC</b>',
      rgb: '150,120,255', base: 14, amp: 4, spd: 1.5, a0: 0.26, a1: 0.2 }
];

function buildFurniture() {
    FURN.length = 0; RUGS.length = 0; CIRC.length = 0; RECTS.length = 0;

    /* floors that aren't the hardwood bands: the bedroom's carpet, and the
       tile that runs through the dressing corridor, the bathroom, and the
       two hall alcoves. (the walk-in closet stays wood, like the plan.) */
    rug(8, 8, 144, 152, P.carp);                               // bedroom carpet
    rug(12, 12, 140, 148, P.carp2);
    rug(72, 152, 104, 248, P.tile);                            // dressing corridor
    rug(6, 240, 72, 407, P.tile);                              // bathroom
    rug(10, 246, 68, 403, P.tile2);
    rug(74, 248, 118, 407, P.tile);                            // passage + nook + entry closet

    /* ============ LIVING ROOM ============
       the desk runs down the bedroom/living divider (its east face, x=152px);
       the window band is on the north wall with the glowing tower in the
       corner beneath it; the sectional sits against the east wall with the
       cowhide chaise + floor lamp in the northeast corner. Isaac's desk rig
       is authored in a north-wall frame and rotated 90° into place by dbox
       (new_x = z + 150, new_z = 268 - x) so the screens face east. */
    function dbox(x0, z0, x1, z1, y0, y1, c, glow) {
        fbox(z0 + 150, 268 - x1, z1 + 150, 268 - x0, y0, y1, c, glow);
    }
    function drectC(x0, z0, x1, z1) { rectC(z0 + 150, 268 - x1, z1 + 150, 268 - x0); }

    /* ── the desk: a long dark-espresso writing desk, twin pedestals ── */
    dbox(158, 2, 252, 26, 3.6, 3.85, P.esp);                      // top slab
    dbox(158, 24, 252, 26, 3.4, 3.6, P.espLit);                   // lit lip under the front edge
    dbox(160, 4, 182, 26, 0, 2.3, P.esp2);                        // left pedestal, cubby above
    dbox(160, 4, 182, 10, 2.3, 3.6, P.esp2);                      // the cubby's back
    dbox(160, 4, 163, 26, 2.3, 3.6, P.esp2);                      // ...and cheeks
    dbox(179, 4, 182, 26, 2.3, 3.6, P.esp2);
    dbox(163, 4, 179, 10.5, 2.3, 2.4, P.esp2);                    // shelf lip
    dbox(228, 4, 250, 26, 0, 3.6, P.esp2);                        // right pedestal
    dbox(160, 24, 250, 26, 0, 0.6, P.esp2);                       // toe stretcher
    dbox(181.4, 8, 182, 20, 1.6, 2.0, P.champ);                   // bar pulls
    dbox(228, 8, 228.6, 20, 1.6, 2.0, P.champ);
    dbox(165, 10, 177, 20, 2.4, 3.1, P.porc);                     // white router in the open cubby
    dbox(166, 20, 176, 20.4, 2.5, 3.0, '#ddd9cf');                // its mesh face, room side
    drectC(156, 0, 252, 28);

    /* ── the TV, wall-mounted above the desk, on Fire TV's home screen.
          in the dbox frame the divider's face is authored z=2 (z+150=152),
          so everything here hangs off z=2, not the old z=8 convention. ── */
    dbox(140, 2.0, 206, 2.2, 6.4, 10.4, shade(P.wall, 0.8));      // its shadow patch on the wall
    dbox(150, 2.8, 214, 3.4, 7.25, 11.0, '#141414');             // bezel, off the wall
    dbox(152, 3.4, 212, 3.5, 7.4, 10.85, P.fire, true);          // navy screen field
    dbox(152, 3.5, 212, 3.52, 8.7, 9.7, P.fire2, true);          // a bright poster row
    dbox(158, 3.5, 170, 3.52, 8.8, 9.5, '#b8322e', true);        // poster tiles
    dbox(174, 3.5, 186, 3.52, 8.8, 9.5, '#2f8fb0', true);
    dbox(190, 3.5, 202, 3.52, 8.8, 9.5, '#d9cba8', true);
    dbox(179, 2.05, 180, 2.25, 3.85, 7.25, '#0c0c0c');           // the cable drop, on the wall

    /* ── LEFT monitor: LG ultrawide on a white curved arc stand ── */
    dbox(174, 12, 202, 16, 3.85, 4.0, P.champ);                   // arc stand foot
    dbox(184, 12.5, 192, 14.5, 4.0, 4.15, P.alu);                 // neck
    dbox(170, 10, 204, 13, 4.05, 6.5, '#16181a');                 // bezel
    dbox(172, 13, 202, 13.6, 4.2, 6.35, P.wp, true);              // the screen, proud face
    dbox(176, 13.6, 198, 14.0, 4.35, 6.0, P.wp2, true);           // its glowing crescent
    dbox(180, 14.0, 195, 14.3, 4.45, 5.7, P.wpMag, true);         // magenta core

    /* ── RIGHT monitor: ASUS on a black stand, higher and set a touch back ── */
    dbox(206, 11, 226, 16, 3.85, 4.0, P.mat);                     // base plate
    dbox(213, 15.6, 219, 16, 3.88, 4.05, '#7ac142', true);        // the green nvidia sticker
    dbox(214, 12, 218, 14.5, 4.0, 4.6, '#232629');                // neck pillar
    dbox(213.5, 14, 218.5, 14.5, 4.55, 4.72, P.red);             // red ring at the joint
    dbox(204, 9, 230, 12, 4.5, 6.9, '#16181a');                  // bezel
    dbox(206, 12, 228, 12.6, 4.62, 6.75, P.wp, true);            // the screen
    dbox(210, 12.6, 226, 13.0, 4.75, 6.5, P.wp2, true);          // crescent
    dbox(213, 13.0, 224, 13.3, 4.85, 6.2, P.wpMag, true);        // magenta core
    dbox(206.4, 12, 208.5, 12.6, 4.7, 6.6, '#2a3550', true);     // the desktop icon column

    /* ── deskmat with its lime edge, keyboard, mouse ── */
    dbox(168, 14, 216, 25, 3.85, 3.9, P.lime);                    // the lime edge stitch
    dbox(169.5, 15, 214.5, 24, 3.87, 3.92, P.mat);                // the mat itself
    dbox(174, 16, 205, 22, 3.9, 4.06, '#19161f');                 // keyboard body
    dbox(175, 16.5, 204, 17.2, 4.02, 4.1, P.alu);                 // its exposed switch plate
    dbox(175, 17.2, 204, 21.5, 4.06, 4.08, '#f4f3ee', true);      // the white backlight bleed
    dbox(176, 17.6, 202, 21.1, 4.08, 4.12, '#25222a');            // keycaps ON it, bleed rims out
    dbox(209, 17, 214, 21, 3.9, 4.1, '#1a1a1e');                  // mouse

    /* ── the condenser mic on a tripod, on the bare wood right of the ASUS ── */
    dbox(234, 13, 238, 17, 3.85, 3.95, '#16181a');                // tripod foot
    dbox(235, 14, 237, 16, 3.95, 5.2, '#232529');                 // body
    dbox(234.6, 13.6, 237.4, 15.6, 5.2, 5.55, '#3c4046');         // grille head

    /* ── THE URE BOY, sitting on the desk to the right ── */
    dbox(228, 14, 236, 20, 3.85, 5.05, P.shell, true);            // shell
    dbox(228.6, 19.4, 235.4, 20, 4.3, 4.85, P.dmg, true);         // DMG screen, facing the room
    dbox(230, 20, 233, 20.12, 4.45, 4.75, '#0f380f', true);       // the eye on it
    dbox(229, 14, 235, 14.5, 5.05, 5.28, P.red, true);            // cartridge up top

    /* ── the office chair: black mesh, red knob, tucked under the desk ── */
    dbox(186, 30, 214, 40, 0, 0.4, P.k);                          // 5-star base
    dbox(197, 32, 203, 36, 0.4, 2.2, '#1b1d21');                  // gas column
    dbox(188, 28, 212, 38, 2.2, 2.7, '#1e1f21');                  // seat pan
    dbox(190, 34, 210, 38, 2.7, 5.05, '#2a2c31');                 // mesh back
    dbox(190, 33.6, 210, 34, 2.9, 4.85, '#3c3f45');               // back frame edge
    dbox(199, 37.6, 201, 38.4, 3.0, 3.3, P.red);                  // the red adjustment knob
    drectC(186, 28, 214, 40);

    /* ── the glowing PC tower: on the floor against the north wall just past
          the desk's end, directly under the window like the photos. glass +
          fans on its SOUTH face, toward the room. ── */
    fbox(178, 10, 196, 29, 0, 0.25, '#cfd8e0');                   // acrylic riser
    fbox(179, 11, 195, 28, 0.25, 3.0, '#0e0f12');                 // black chassis
    fbox(180, 27.6, 194, 28.0, 0.4, 2.9, P.ledDk, true);          // the tinted glass panel
    fbox(181, 28.0, 193, 28.2, 0.7, 1.05, P.led, true);           // fan ring 1, proud
    fbox(181, 28.0, 193, 28.2, 1.25, 1.6, P.led, true);           // fan ring 2
    fbox(181, 28.0, 193, 28.2, 1.8, 2.15, P.led, true);           // fan ring 3
    fbox(182, 28.2, 192, 28.35, 0.78, 0.97, P.led2, true);        // brighter ring cores
    fbox(182, 28.2, 192, 28.35, 1.33, 1.52, P.led2, true);
    fbox(182, 28.2, 192, 28.35, 1.88, 2.07, P.led2, true);
    fbox(188, 11.5, 189, 12.5, 2.9, 3.05, P.led2, true);          // power dot on top
    rectC(176, 8, 198, 31);

    /* ── the cream sectional against the east wall, chaise at the south
          (kitchen) end, exactly as the photos have it ── */
    fbox(276, 52, 312, 156, 0, 2.1, P.cream);                    // seat block
    fbox(304, 52, 312, 156, 0, 4.2, P.cream2);                   // backrest against the wall
    fbox(276, 48, 312, 56, 0, 3.2, P.cream2);                    // north arm
    fbox(276, 152, 312, 160, 0, 3.2, P.cream2);                  // south arm
    fbox(236, 128, 276, 160, 0, 2.0, P.cream);                   // the chaise, projecting west
    fbox(236, 128, 244, 160, 0, 2.6, P.cream2);                  // chaise end cushion
    fbox(280, 60, 302, 100, 2.1, 3.0, '#e6ddc9');               // loose seat cushions
    fbox(280, 104, 302, 148, 2.1, 3.0, '#e6ddc9');
    fbox(300, 66, 304, 84, 3.0, 4.3, P.char);                    // charcoal pillow
    fbox(300, 116, 304, 134, 3.0, 4.3, P.char);                  // charcoal pillow
    fbox(299, 92, 303, 110, 2.9, 4.1, P.cream2);                 // cream + stripe lumbar
    fbox(298.6, 94, 299, 108, 3.1, 3.9, '#1a1613');              // stripes proud of its west face
    fbox(244, 132, 262, 150, 2.0, 3.4, P.cream2);                // a cream cushion on the chaise
    rectC(234, 44, 314, 162);

    /* ── the cowhide LC4-style chaise longue in the northeast corner,
          bolstered head end by the wall, foot toward the room ── */
    fbox(258, 20, 306, 32, 1.1, 1.5, P.cow);                     // cowhide pad
    fbox(262, 21, 274, 31, 1.5, 1.52, P.cowDk);                  // black blotches
    fbox(280, 22, 292, 30, 1.5, 1.52, P.cowDk);
    fbox(296, 21, 304, 29, 1.5, 1.52, P.cowDk);
    fbox(294, 20, 306, 32, 1.5, 2.6, P.cow);                     // the raised head end
    fbox(296, 21, 304, 31, 2.6, 2.62, P.cowDk);
    fbox(300, 18, 306, 34, 2.4, 3.0, P.cowDk);                   // black leather bolster
    fbox(260, 22, 304, 23, 0.4, 1.1, P.chrome);                  // chrome side rails
    fbox(260, 29, 304, 30, 0.4, 1.1, P.chrome);
    fbox(268, 22, 269, 30, 0, 0.5, P.k);                         // black H-base
    fbox(296, 22, 297, 30, 0, 0.5, P.k);
    rectC(254, 16, 310, 36);

    /* ── the floor lamp in the corner behind the chaise ── */
    fbox(304, 14, 307, 17, 0, 0.4, '#23211e');                   // foot hub
    fbox(304.5, 14.5, 306.5, 16.5, 0.4, 6.6, '#2a2a26');         // pole
    fbox(300, 10, 311, 21, 6.6, 8.1, P.amber, true);             // the lit drum shade
    fbox(301, 11, 310, 20, 7.9, 8.2, shade(P.amber, 0.8));       // top rim
    circ(305.5, 15.5, 1.3);

    /* ── the round side table + scooter at the couch's kitchen end ── */
    fbox(292, 168, 306, 182, 0, 2.6, '#3a2818');                 // walnut pedestal
    fbox(288, 164, 310, 186, 2.6, 2.85, P.trav);                 // travertine top
    fbox(295, 171, 301, 177, 2.85, 3.7, '#cfe0e4');              // glass bulb vase
    fbox(297, 173, 299, 174, 3.7, 4.9, '#5d6a4a');               // magnolia stem
    fbox(295, 171, 301, 177, 4.6, 5.1, P.porc, true);            // the white blooms
    circ(298, 174, 1.7);
    fbox(262, 176, 268, 198, 0, 0.5, '#1c1c1e');                 // scooter deck
    fbox(262, 176, 266, 180, 0.5, 5.6, '#17171a');               // stem
    fbox(256, 174, 274, 178, 5.6, 5.9, '#3a3a3e');               // handlebar
    fbox(263, 194, 267, 198, 0, 1.0, '#101012');                 // rear wheel
    circ(264, 186, 1.6);

    /* ── track lighting: two rails running down the living room ── */
    var th;
    for (th = 0; th < 3; th++) {
        fbox(180, 48 + th * 40, 188, 56 + th * 40, 12.2, 12.55, '#1e1e20');
        fbox(181, 49 + th * 40, 187, 55 + th * 40, 12.0, 12.2, P.amber, true);
        fbox(228, 48 + th * 40, 236, 56 + th * 40, 12.2, 12.55, '#1e1e20');
        fbox(229, 49 + th * 40, 235, 55 + th * 40, 12.0, 12.2, P.amber, true);
    }
    fbox(183, 44, 185, 140, 12.55, 12.7, '#1c1c1c');
    fbox(231, 44, 233, 140, 12.55, 12.7, '#1c1c1c');

    /* ============ BEDROOM ============
       headboard on the west wall, window band north, door in the south wall;
       nightstand + arc lamp on the bed's south (door) side, away from the
       window, matching the photo. */
    fbox(8.5, 44, 15, 108, 0, 6.15, P.hbd);                      // cream headboard
    fbox(8.5, 44, 15, 47, 5.7, 6.35, shade(P.hbd, 1.05));        // its rolled top
    fbox(15, 46, 92, 106, 0, 1.0, P.esp2);                       // platform frame
    fbox(14, 44, 94, 108, 1.0, 2.55, P.duv);                     // the charcoal duvet
    fbox(14, 44, 16, 108, 2.55, 2.7, P.duv2);                    // top fold shadow at the head
    fbox(16, 47, 18, 51, 0, 1.0, P.k);                           // black wedge legs
    fbox(88, 47, 90, 51, 0, 1.0, P.k);
    fbox(16, 101, 18, 105, 0, 1.0, P.k);
    fbox(88, 101, 90, 105, 0, 1.0, P.k);
    /* the pillow row against the headboard */
    fbox(16, 50, 22, 96, 2.55, 3.6, P.porc);                     // white sleepers behind
    fbox(17, 48, 32, 64, 2.55, 4.0, P.char);                     // charcoal lumbar
    fbox(17, 68, 31, 82, 2.55, 3.75, P.cream2);                  // cream + camel squiggle
    fbox(31, 70, 31.4, 80, 2.8, 3.5, P.oak);                     // squiggle proud of its face
    fbox(17, 86, 31, 102, 2.55, 3.85, P.slateB);                 // slate-blue lumbar
    rectC(6, 42, 96, 110);
    /* the mid-century oak nightstand + black arc lamp, south of the bed */
    fbox(10, 114, 34, 132, 0, 2.75, P.oak);                      // body
    fbox(34, 116, 34.5, 130, 0.25, 1.3, P.oak2);                 // drawer fronts, proud of the
    fbox(34, 116, 34.5, 130, 1.5, 2.55, P.oak2);                 // east face toward the room
    fbox(34.5, 121, 35, 125, 0.6, 0.95, '#2a2622');              // recessed pulls
    fbox(34.5, 121, 35, 125, 1.85, 2.2, '#2a2622');
    fbox(11, 114, 13, 116, 0, 0.4, P.k);                         // splayed leg tips
    fbox(31, 114, 33, 116, 0, 0.4, P.k);
    fbox(14, 118, 22, 126, 2.75, 2.9, '#1e1b1a');                // lamp disc base
    fbox(17, 121, 19, 123, 2.9, 4.5, '#1e1b1a');                 // lamp rod
    fbox(17, 116, 19, 121, 4.3, 4.5, '#1e1b1a');                 // arm cantilever
    fbox(15.5, 114.5, 20.5, 119.5, 3.9, 4.9, P.amber, true);     // ribbed glass shade, lit
    circ(18, 122, 1.5);
    /* the ceiling fan, centered over the bed */
    var fbx = 60, fbz = 76;
    fbox(fbx - 22, fbz - 3, fbx + 22, fbz + 3, 11.3, 11.45, P.esp);
    fbox(fbx - 3, fbz - 22, fbx + 3, fbz + 22, 11.3, 11.45, P.esp2);
    fbox(fbx - 18, fbz + 8, fbx + 2, fbz + 20, 11.3, 11.42, P.esp);
    fbox(fbx - 6, fbz - 6, fbx + 6, fbz + 6, 11.2, 11.7, '#a88a52');
    fbox(fbx - 4, fbz - 4, fbx + 4, fbz + 4, 10.9, 11.2, P.amber, true);   // bowl light BELOW the motor
    /* the dresser on the south wall, east of the door */
    fbox(100, 138, 140, 150, 0, 3.4, P.oak);
    fbox(104, 137.4, 112, 138, 1.5, 2.1, '#2a2622');             // pulls face the room
    fbox(118, 137.4, 126, 138, 1.5, 2.1, '#2a2622');
    fbox(130, 137.4, 138, 138, 1.5, 2.1, '#2a2622');
    rectC(98, 136, 142, 152);

    /* ============ THE CORE ============ */
    /* walk-in closet: rail + hanging clothes along the north wall, shoes
       on the wood floor */
    fbox(114, 162, 140, 163, 5.2, 5.4, P.steel);                 // the rail
    fbox(115, 161, 120, 168, 2.8, 5.2, P.slateB);                // hanging clothes
    fbox(121, 161, 126, 168, 3.0, 5.2, P.char);
    fbox(127, 161, 132, 168, 2.7, 5.2, P.cream2);
    fbox(133, 161, 138, 168, 3.1, 5.2, '#5d6a4a');
    fbox(115, 176, 125, 184, 0, 1.2, P.porc);                    // shoes on the floor
    fbox(128, 176, 136, 183, 0, 1.1, P.slate);

    /* reach-in closet west of the corridor: the washer/dryer stack up top,
       linen shelves below */
    fbox(20, 162, 46, 188, 0, 6.0, P.porc);                      // W/D stack
    fbox(46, 166, 46.8, 178, 1.2, 2.8, P.slate);                 // dryer drum faces the corridor
    fbox(46, 166, 46.8, 178, 3.4, 5.0, P.slate);                 // washer drum above
    fbox(20, 196, 46, 232, 0, 5.6, '#cbb89a');                   // shelf tower
    fbox(46, 200, 46.6, 228, 1.6, 1.8, P.trim);                  // shelf lips
    fbox(46, 200, 46.6, 228, 3.2, 3.4, P.trim);
    fbox(46, 200, 46.6, 228, 4.8, 5.0, P.trim);
    rectC(18, 160, 48, 234);

    /* ============ BATHROOM ============
       vanity north on the west wall, toilet mid, tub along the south. */
    fbox(8, 254, 24, 314, 0, 3.0, '#e8e4dc');                    // vanity cabinet
    fbox(6.5, 252, 26, 316, 3.0, 3.3, '#6a4a34');                // brown granite top
    fbox(10, 268, 22, 298, 3.3, 3.45, P.porc);                   // basin
    fbox(22, 278, 25, 284, 3.45, 4.1, P.steel);                  // faucet
    fbox(8.2, 262, 9, 306, 4.3, 7.0, '#a8c4d4');                 // mirror on the wall
    rectC(6, 250, 27, 318);
    fbox(8, 324, 14, 346, 1.0, 3.4, P.porc);                     // toilet tank
    fbox(14, 328, 28, 344, 0, 1.8, P.porc);                      // bowl
    circ(20, 336, 1.7);
    fbox(10, 352, 70, 402, 0, 1.6, P.porc);                      // the tub: base...
    fbox(10, 352, 70, 356, 1.6, 2.4, P.porc);                    // ...and four rims, so the
    fbox(10, 398, 70, 402, 1.6, 2.4, P.porc);                    // water is visible from above
    fbox(10, 356, 14, 398, 1.6, 2.4, P.porc);
    fbox(66, 356, 70, 398, 1.6, 2.4, P.porc);
    fbox(14, 356, 66, 398, 1.6, 1.75, P.water);
    fbox(12, 372, 16, 378, 2.4, 3.3, P.steel);                   // faucet, west end
    rectC(8, 350, 72, 404);

    /* ============ HALL: desk nook + entry closet ============ */
    fbox(76, 292, 104, 340, 3.3, 3.6, P.porc);                   // the built-in white counter
    fbox(78, 296, 82, 336, 0, 3.3, '#ddd9cf');                   // its support panels
    fbox(98, 296, 102, 336, 0, 3.3, '#ddd9cf');
    fbox(80, 310, 88, 318, 3.6, 3.75, P.alu);                    // a laptop on it
    fbox(80.5, 311, 81.5, 317, 3.75, 4.6, '#16181a');            // its raised lid
    fbox(88, 306, 100, 322, 2.2, 2.7, '#1e1f21');                // a simple task chair
    fbox(98, 308, 101, 320, 2.7, 4.4, '#2a2c31');
    rectC(74, 290, 106, 342);
    fbox(76, 362, 102, 398, 1.6, 1.8, '#cbb89a');                // entry closet shelves
    fbox(76, 362, 102, 398, 3.2, 3.4, '#cbb89a');
    fbox(76, 362, 102, 398, 4.8, 5.0, '#cbb89a');
    fbox(80, 366, 88, 374, 1.8, 3.0, P.teal);                    // bins + bottles on them
    fbox(92, 380, 98, 388, 3.4, 4.4, P.gold);
    fbox(82, 384, 90, 392, 0, 1.4, P.slate);                     // floor basket
    rectC(74, 360, 104, 400);
    fbox(122, 396, 134, 404, 0, 0.8, P.porc);                    // shoes by the door
    fbox(138, 398, 148, 405, 0, 0.7, P.slate);

    /* ============ KITCHEN ============
       open to the hall + living room. peninsula with the double sink and
       three stools, tall fridge block joining it to the east notch, stove
       in the south counter run, short return counter on the east wall. */
    fbox(170, 290, 246, 320, 0, 4.2, P.esp2);                    // peninsula cabinets
    fbox(166, 286, 250, 324, 4.2, 4.6, '#c9b88f');               // granite top
    fbox(184, 296, 216, 314, 4.6, 4.72, P.steel2);               // double sink
    fbox(198, 302, 200, 308, 4.72, 5.0, P.steel2);               // its divider
    fbox(216, 300, 219, 306, 4.72, 5.5, P.steel);                // faucet
    rectC(164, 284, 252, 326);
    var st;
    for (st = 0; st < 3; st++) {
        fbox(176 + st * 24, 272, 188 + st * 24, 282, 3.0, 3.5, P.wd1);    // stool seats
        fbox(180 + st * 24, 275, 184 + st * 24, 279, 0, 3.0, '#2a2622');  // legs
        circ(182 + st * 24, 277, 1.4);
    }
    fbox(250, 270, 311, 322, 0, 7.5, P.esp2);                    // the tall fridge + pantry block,
    fbox(248.5, 276, 250, 316, 0.4, 6.8, P.steel);               // flush to the east wall like the
    fbox(248, 282, 248.5, 290, 3.4, 5.4, P.steel2);              // plan; doors face the aisle
    fbox(248, 296, 248.5, 304, 3.4, 5.4, P.steel2);
    rectC(246, 268, 314, 324);
    fbox(162, 386, 310, 407, 0, 4.2, P.esp2);                    // south counter run
    fbox(160, 384, 312, 407, 4.2, 4.6, '#c9b88f');
    fbox(224, 384, 256, 407, 0, 4.4, P.porc);                    // the range
    fbox(226, 386, 254, 405, 4.4, 4.62, '#31363e');              // cooktop
    fbox(229, 389, 237, 397, 4.62, 4.72, P.k);                   // burners
    fbox(243, 389, 251, 397, 4.62, 4.72, P.k);
    fbox(228, 383.4, 252, 384, 1.4, 3.0, '#3d3020');             // oven window
    fbox(286, 350, 312, 386, 0, 4.2, P.esp2);                    // east return counter
    fbox(284, 348, 312, 386, 4.2, 4.6, '#c9b88f');
    fbox(290, 356, 306, 374, 4.6, 5.8, '#2a2a30');               // microwave
    fbox(289.4, 360, 290, 372, 4.9, 5.6, P.glass);
    rectC(158, 382, 314, 408);
    rectC(282, 346, 314, 388);
    /* pendant over the peninsula */
    fbox(199, 299, 201, 301, 9.2, 12.7, '#4e4d48');              // stem
    fbox(193, 293, 207, 307, 7.6, 9.2, P.amber, true);           // the lit cone shade
    fbox(194, 294, 206, 306, 9.0, 9.25, shade(P.amber, 0.8));
}

/* ============================================================
   PLAYER + CAMERA
   ============================================================ */
var PLANE = 1.02;                                  // ~91° horizontal fov: room-scale needs wide
var PL = {
    x: 17.0, z: 47.5,
    dirX: 0, dirZ: -1,                             // facing north, up the hall past the slant
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
/* a standing-eye camera + wide fov, so you look down over the pushed-in chair
   onto the desk, the way Isaac's photos are shot */
var EYE = 5.9, WALLH = 13, FOCAL = (W / 2) / PLANE;
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

    /* the screen glows, each pulsing over its spot on the desk. a screen
       only lights the half-space it faces (east), so nothing haloes the
       back of the monitor from the sliver behind the desk (west of it) */
    for (i = 0; i < HOTS.length; i++) {
        var hs = HOTS[i];
        if (PL.x <= hs.x) continue;
        var gdx = hs.x - PL.x, gdz = hs.z - PL.z;
        var gdep = gdx * PL.dirX + gdz * PL.dirZ;
        if (gdep <= 0.3) continue;
        var glat = (gdx * PL.planeX + gdz * PL.planeZ) / PLANE;
        var gsx = W / 2 + glat / gdep * FOCAL;
        var gsy = horizon + (EYE - hs.y) / gdep * FOCAL;
        var gcol = clamp(Math.round(gsx), 0, W - 1);
        var grow = clamp(Math.round(gsy), 0, H - 1);
        /* the nearest surface at the glow's pixel — walls AND furniture, so a
           chair between you and the desk hides the halo too */
        var gnear = 1 / DEPTH[grow * W + gcol];
        if (gnear < gdep - 0.6) continue;
        var pulse = reduce ? 0.5 : (Math.sin(T * hs.spd + i * 1.7) + 1) / 2;
        var gr = (hs.base + pulse * hs.amp) * FOCAL / (gdep * 42);
        gr = clamp(gr, 6, 70);
        var grad = ctx.createRadialGradient(gsx, gsy, 1, gsx, gsy, gr);
        grad.addColorStop(0, 'rgba(' + hs.rgb + ',' + (hs.a0 + pulse * hs.a1) + ')');
        grad.addColorStop(1, 'rgba(' + hs.rgb + ',0)');
        ctx.fillStyle = grad;
        ctx.fillRect(gsx - gr, gsy - gr, gr * 2, gr * 2);
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
    /* floors: wood inside the wall ring, tile in the bathroom + corridor */
    R(g, 3, 3, MW - 2, MH - 2, M3.fl);
    R(g, 3, 33, 9, 19, M3.tile);                   // bathroom
    R(g, 11, 22, 3, 11, M3.tile);                  // dressing corridor
    R(g, 13, 33, 3, 18, M3.tile);                  // nook + entry closet strip
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
    mflat(8, 248, 74, 158, M3.tile);               // bathroom
    mflat(72, 160, 24, 88, M3.tile);               // dressing corridor
    mflat(82, 248, 32, 158, M3.tile);              // nook + entry closet strip
    for (i = 0; i < RUGS.length; i++) {
        o = RUGS[i];
        mflat(o.x0 * 8, o.z0 * 8, (o.x1 - o.x0) * 8, (o.z1 - o.z0) * 8, o.c);
    }
    /* the bath checkerboard AFTER the rugs, or the tile rugs flatten it */
    for (cz = 248; cz < 406; cz += 12) for (cx = 8; cx < 70; cx += 12) {
        if ((((cx - 8) / 12) + ((cz - 248) / 12)) % 2 < 1) mflat(cx, cz, Math.min(12, 70 - cx), Math.min(12, 406 - cz), M3.tile2);
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

    /* both glowing screens on the desk, over everything like /room3d/. no
       depth test up here: from a dollhouse camera the halos are the whole
       point of the shot, and the walls they'd hide behind are cut away */
    for (i = 0; i < HOTS.length; i++) {
        var hs = HOTS[i];
        var up = mproj(hs.x * 8, hs.y * HSQ, hs.z * 8);
        var hp = reduce ? 0.5 : (Math.sin(T * hs.spd + i * 1.7) + 1) / 2;
        var gr = hs.base * 0.72 + hp * hs.amp;
        var grad = ctx.createRadialGradient(up.x, up.y, 1, up.x, up.y, gr);
        grad.addColorStop(0, 'rgba(' + hs.rgb + ',' + (hs.a0 + hp * hs.a1) + ')');
        grad.addColorStop(1, 'rgba(' + hs.rgb + ',0)');
        ctx.fillStyle = grad;
        ctx.fillRect(up.x - gr, up.y - gr, gr * 2, gr * 2);
        if (reduce || FR % 2) {                    // the LED, blinking on the room3d cadence
            ctx.fillStyle = 'rgb(' + hs.rgb + ')';
            ctx.fillRect(Math.round(up.x) - 4, Math.round(up.y), 2, 2);
        }
    }

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
    /* the walk view's prompt has no meaning up here, and promptOn is what gates
       E: drop the target too so a stale one can't be booted from the map */
    promptOn = false; promptTgt = null;
    if (promptEl) promptEl.hidden = true;
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
var navDone = false, navTimer = null, navDest = '/ureboy/';
function goConsole() { if (navDone) return; navDone = true; window.location.href = navDest; }
function enterConsole(href) {
    if (navDone || TRANS.on) return;
    if (href) navDest = href;
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
        enterConsole(promptTgt && promptTgt.href);
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
var promptOn = false, promptTgt = null;
function checkPrompt() {
    /* both screens share the desk, so pick whichever is nearer the center
       of view. stickiness lives in ANGLE space: a cosine bonus balloons to
       ~16 degrees near dead-center (cos is flat there), wide enough to hold
       the wrong target against a player staring straight at the other one */
    var best = null, bestScore = -1e9;
    if (!TRANS.on) {
        for (var i = 0; i < HOTS.length; i++) {
            var hs = HOTS[i];
            if (PL.x <= hs.x) continue;            // screens face east: no
            var dx = hs.x - PL.x, dz = hs.z - PL.z; // prompting through their backs
            var d = Math.sqrt(dx * dx + dz * dz);
            var facing = (dx * PL.dirX + dz * PL.dirZ) / (d || 1);
            if (d >= 7 || facing <= 0.55) continue;
            var score = -Math.acos(clamp(facing, -1, 1)) + (hs === promptTgt ? 0.03 : 0);
            if (score > bestScore) { bestScore = score; best = hs; }
        }
    }
    if (best !== promptTgt) {
        promptTgt = best;
        promptOn = !!best;
        if (promptEl) {
            if (best) promptEl.innerHTML = '<span class="boot-key" aria-hidden="true">E</span> ' + best.html;
            promptEl.hidden = !best;
        }
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
        if (hitsWall(PL.x, PL.z) || solidCell(Math.floor(PL.x), Math.floor(PL.z))) { PL.x = 17.0; PL.z = 47.5; }
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
                prompt: function () { checkPrompt(); return promptTgt ? promptTgt.href : null; },
                walk: function (x, z) { return !hitsWall(x, z); },
                cell: function (c, r) { return solidCell(c, r) ? MAP[r][c] : 0; },
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
    if (promptEl) promptEl.addEventListener('click', function () { enterConsole(promptTgt && promptTgt.href); });
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
