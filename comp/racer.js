/* ═══════════════════════════════════════════════════════════════════════════
   SUNSET RUNNER — a pseudo-3D pixel racer that runs IN the UreOS desktop.
   Exposes window.RACER = { render, init, close, pause, resume } so Steam's
   library can launch it in a real window, exactly like window.COOKIE.

   Pseudo-3D road in the Pole Position / OutRun lineage: projected road
   segments with curves + hills, sprite-scaled cars, three day/night themes,
   three circuits, five AI rivals with live race positions + laps, and a
   results board. Physics steps at a fixed 60Hz; the camera interpolates
   between ticks so it stays smooth on 120/144Hz panels.
   ═══════════════════════════════════════════════════════════════════════════ */
window.RACER = (function () {
"use strict";
var M = Math;

// ─────────────────────────────────────────────────────────── tuning
var WIDTH = 480, HEIGHT = 270;
var SEGLEN = 200, RUMBLE_LEN = 3, LANES = 3;
var ROAD_W = 2000, DRAW = 240, FOV = 100, CAM_H = 1000;
var CAM_D = 1 / M.tan((FOV / 2) * M.PI / 180);
var PLAYER_Z = CAM_H * CAM_D;
var FPS = 60, STEP = 1 / FPS;
var MAXSPD = SEGLEN / STEP;
var ACCEL = MAXSPD / 4.2, BRAKING = -MAXSPD, DECEL = -MAXSPD / 5;
var OFF_DECEL = -MAXSPD / 1.6, OFF_LIMIT = MAXSPD / 3.2;
var CENTRIF = 0.32, FOGD = 4.2, SPR_SCALE = 0.3 * (1 / 80);
var NITRO_MULT = 1.34;
var N_RIVALS = 5;

// ─────────────────────────────────────────────────────────── helpers
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function interp(a, b, p) { return a + (b - a) * p; }
function pctRem(n, t) { return (n % t) / t; }
function accelV(v, a, dt) { return v + a * dt; }
function rnd(a, b) { return a + M.random() * (b - a); }
function pick(a) { return a[(M.random() * a.length) | 0]; }
function easeIn(a, b, p) { return a + (b - a) * p * p; }
function easeIO(a, b, p) { return a + (b - a) * ((-M.cos(p * M.PI) / 2) + 0.5); }
function fog(d, den) { return 1 / M.pow(M.E, d * d * den); }
function ovl(x1, w1, x2, w2, pct) { var h = (pct || 1) / 2; return !((x1 + w1 * h) < (x2 - w2 * h) || (x1 - w1 * h) > (x2 + w2 * h)); }
function pad(n, w) { var s = '' + M.max(0, n | 0); while (s.length < w) s = '0' + s; return s; }
function fmtTime(s) { s = M.max(0, s); var m = (s / 60) | 0, r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2); }

// ─────────────────────────────────────────────────────────── bitmap font (5x7)
var FONT = (function () {
  var g = {
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'D': ['###..', '#..#.', '#...#', '#...#', '#...#', '#..#.', '###..'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    'J': ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
    'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    'N': ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
    'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
    ':': ['.....', '..#..', '.....', '.....', '.....', '..#..', '.....'],
    '.': ['.....', '.....', '.....', '.....', '.....', '..#..', '.....'],
    ',': ['.....', '.....', '.....', '.....', '..#..', '..#..', '.#...'],
    '/': ['....#', '...#.', '..#..', '..#..', '.#...', '#....', '#....'],
    '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
    "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
    '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
    '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
    '?': ['.###.', '#...#', '...#.', '..#..', '..#..', '.....', '..#..'],
    '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '#####', '.#.#.', '.....'],
    '(': ['..#..', '.#...', '#....', '#....', '#....', '.#...', '..#..'],
    ')': ['..#..', '...#.', '....#', '....#', '....#', '...#.', '..#..']
  };
  return g;
})();
function txtW(str, sc, sp) { sp = (sp == null ? 1 : sp); return ('' + str).length * (5 + sp) * sc - sp * sc; }
function text(g, str, x, y, sc, color, opts) {
  opts = opts || {}; sc = sc || 1; str = ('' + str).toUpperCase();
  var sp = (opts.spacing == null ? 1 : opts.spacing);
  if (opts.align === 'center') x -= txtW(str, sc, sp) / 2;
  else if (opts.align === 'right') x -= txtW(str, sc, sp);
  x = M.round(x); y = M.round(y);
  var cx = x, i, ry, rx, chr, glyph, row;
  for (i = 0; i < str.length; i++) {
    chr = str[i]; glyph = FONT[chr] || FONT['?'];
    for (ry = 0; ry < 7; ry++) {
      row = glyph[ry];
      for (rx = 0; rx < 5; rx++) {
        if (row[rx] === '#') {
          if (opts.shadow) { g.fillStyle = opts.shadow; g.fillRect(cx + rx * sc, y + ry * sc + sc, sc, sc); }
          g.fillStyle = color; g.fillRect(cx + rx * sc, y + ry * sc, sc, sc);
        }
      }
    }
    cx += (5 + sp) * sc;
  }
}

// ─────────────────────────────────────────────────────────── themes
var THEMES = [
  { key: 'sunset', name: 'SUNSET COAST', celest: 'sun', stars: true,
    sky: [[0, '#241a45'], [.35, '#5c2668'], [.6, '#a83a76'], [.78, '#e85c6f'], [.9, '#ff9350'], [1, '#ffd06b']],
    sunHi: '#ffe98a', sunLo: '#ff5f8b', mtnFar: '#3a2358', mtnNear: '#2a1846', city: '#20143a', cityLit: '#ffbe6b',
    fogc: '#3a2159', accent: '#e85c6f',
    light: { road: '#4b4b5e', grass: '#1f7a5f', rumble: '#e6e8f0', lane: '#e6e8f0' },
    dark: { road: '#43434f', grass: '#1a6b52', rumble: '#d23c7d', lane: null } },
  { key: 'night', name: 'NEON NIGHT', celest: 'moon', stars: true,
    sky: [[0, '#04050e'], [.5, '#0b1030'], [.82, '#241a45'], [1, '#3a2159']],
    sunHi: '#e7ecff', sunLo: '#96a8d6', mtnFar: '#0d1230', mtnNear: '#151b3c', city: '#090d20', cityLit: '#ffd06b',
    fogc: '#0b1030', accent: '#31e6d0',
    light: { road: '#2b2b3e', grass: '#123a30', rumble: '#31e6d0', lane: '#e6e8f0' },
    dark: { road: '#26263a', grass: '#0f3228', rumble: '#e0409a', lane: null } },
  { key: 'dawn', name: 'DAWN RIDGE', celest: 'sun', stars: false,
    sky: [[0, '#31517f'], [.42, '#7aa0c8'], [.68, '#f4c88f'], [.86, '#ffd9a0'], [1, '#fff1d6']],
    sunHi: '#fffbe0', sunLo: '#ffcf78', mtnFar: '#6a7fa8', mtnNear: '#51648c', city: '#43547e', cityLit: null,
    fogc: '#c9b59a', accent: '#e8894f',
    light: { road: '#6b6f7e', grass: '#3fae5a', rumble: '#e6e8f0', lane: '#f0f0f0' },
    dark: { road: '#63677a', grass: '#37a052', rumble: '#d23c46', lane: null } }
];
var START_COL = { road: '#e8e8ee', grass: null, rumble: '#e8e8ee', lane: null };
var FINISH_COL = { road: '#1a1a20', grass: null, rumble: '#e8e8ee', lane: null };

// ─────────────────────────────────────────────────────────── car sprites
function newCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); g.imageSmoothingEnabled = false; return { c: c, g: g }; }
function drawCar(g, cx, baseY, w, s, lean, brake) {
  var h = M.round(w * 0.60), x = M.round(cx - w / 2), y = M.round(baseY - h);
  function P(px, py, pw, ph, c) { g.fillStyle = c; g.fillRect(M.round(x + px), M.round(y + py), M.max(1, M.round(pw)), M.max(1, M.round(ph))); }
  var sh = M.round(lean * w * 0.05);
  g.fillStyle = 'rgba(0,0,0,0.30)';
  g.fillRect(M.round(cx - w * 0.52), M.round(baseY - h * 0.06), M.round(w * 1.04), M.round(h * 0.14));
  P(w * .04, h * .70, w * .17, h * .30, '#0b0b12'); P(w * .79, h * .70, w * .17, h * .30, '#0b0b12');
  P(w * .07, h * .74, w * .11, h * .10, '#2b2b3e'); P(w * .82, h * .74, w * .11, h * .10, '#2b2b3e');
  P(w * .02, h * .66, w * .96, h * .10, s.dark);
  P(w * .00, h * .42, w * 1.0, h * .28, s.body);
  P(w * .05, h * .30, w * .90, h * .16, s.body);
  P(w * .02, h * .44, w * .96, h * .03, s.hi);
  P(w * .02, h * .28, w * .96, h * .06, s.dark);
  P(w * .02, h * .22, w * .05, h * .12, s.dark); P(w * .93, h * .22, w * .05, h * .12, s.dark);
  P(w * .24 + sh, h * .04, w * .52, h * .28, s.roof);
  P(w * .28 + sh, h * .09, w * .44, h * .15, s.glass);
  P(w * .30 + sh, h * .10, w * .16, h * .05, 'rgba(255,255,255,0.15)');
  var tl = brake ? '#ff6a6a' : '#c8203a';
  P(w * .09, h * .50, w * .18, h * .11, tl); P(w * .73, h * .50, w * .18, h * .11, tl);
  P(w * .42, h * .52, w * .16, h * .06, '#25121c');
  if (brake) { g.fillStyle = 'rgba(255,90,90,0.30)'; g.fillRect(x + w * .04, y + h * .44, w * .28, h * .24); g.fillRect(x + w * .68, y + h * .44, w * .28, h * .24); }
}
function bakeCar(s) { var o = newCanvas(96, 64); drawCar(o.g, 48, 60, 86, s, 0, false); return o.c; }
var SCHEMES = [
  { body: '#e8402c', roof: '#c22a1e', glass: '#1c1430', dark: '#7c160f', hi: '#ff7a5c', name: 'ARGENT' },
  { body: '#2ec5c0', roof: '#1f938f', glass: '#10241f', dark: '#125b58', hi: '#7bf0ec', name: 'NOVA' },
  { body: '#f2c53d', roof: '#c89a22', glass: '#2a2110', dark: '#7c6110', hi: '#ffe98a', name: 'BLAZE' },
  { body: '#4f7bff', roof: '#3355c8', glass: '#141b34', dark: '#1e2f80', hi: '#93b0ff', name: 'VIPER' },
  { body: '#e6e8f0', roof: '#b9bccb', glass: '#20222e', dark: '#6f7280', hi: '#ffffff', name: 'GHOST' },
  { body: '#9a5cff', roof: '#6f36c8', glass: '#1a1330', dark: '#451c80', hi: '#c79bff', name: 'PULSE' }
];
var PLAYER_SCHEME = SCHEMES[0];
var RIVAL_SPRITES = SCHEMES.slice(1).map(function (s) { return { canvas: bakeCar(s), w: 96, h: 64, scheme: s }; });

// scenery sprites (theme-tinted variants baked lazily)
function bakePalm(front) {
  var o = newCanvas(72, 128), g = o.g, i, t, bx, w, y;
  var trunk = front ? '#2a1c3a' : '#241733', trunkHi = '#3c2a52';
  for (i = 0; i < 58; i++) { t = i / 58; bx = 36 + M.sin(t * 1.4) * 7 - 3; w = 3 + t * 3.2; y = 128 - 6 - i * 2.05; g.fillStyle = trunk; g.fillRect(M.round(bx), M.round(y), M.round(w), 3); g.fillStyle = trunkHi; g.fillRect(M.round(bx), M.round(y), 1, 3); }
  var tx = 36 + M.sin(1.4) * 7 - 3, ty = 128 - 6 - 57 * 2.05;
  g.fillStyle = '#241633'; g.fillRect(tx - 3, ty - 2, 4, 4); g.fillRect(tx + 3, ty - 1, 4, 4);
  var greens = ['#1c7a52', '#155f40', '#22986a'], f, ang, len, s, px, py, wdt;
  for (f = 0; f < 7; f++) { ang = -M.PI + (f / 6) * M.PI; len = 26 + (f % 2) * 6; g.fillStyle = greens[f % 3]; for (s = 0; s < len; s++) { t = s / len; px = tx + M.cos(ang) * s * 0.95; py = ty + M.sin(ang) * s * 0.7 + t * t * 10; wdt = M.max(1, 4 * (1 - t)); g.fillRect(M.round(px - wdt / 2), M.round(py), M.round(wdt), 2); } }
  return { canvas: o.c, w: 72, h: 128 };
}
function bakeBush() { var o = newCanvas(40, 28), g = o.g, cols = ['#155f40', '#1c7a52', '#0f4a31'], i, a, r, x, y; for (i = 0; i < 80; i++) { a = M.random() * M.PI * 2; r = M.random() * 13; x = 20 + M.cos(a) * r; y = 24 - M.abs(M.sin(a)) * 13 * M.random(); g.fillStyle = cols[i % 3]; g.fillRect(M.round(x), M.round(y), 3, 3); } return { canvas: o.c, w: 40, h: 28 }; }
function bakeSign(str, bg, fg) {
  var w = txtW(str, 2, 1) + 20, o = newCanvas(w, 80), g = o.g, i;
  g.fillStyle = '#241633'; g.fillRect(6, 46, 5, 34); g.fillRect(w - 11, 46, 5, 34);
  g.fillStyle = '#120b22'; g.fillRect(0, 0, w, 46);
  g.fillStyle = bg; g.fillRect(3, 3, w - 6, 40);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(3, 3, w - 6, 3);
  text(g, str, 10, 12, 2, fg);
  for (i = 6; i < w - 6; i += 10) { g.fillStyle = '#ffd06b'; g.fillRect(i, 1, 2, 2); }
  return { canvas: o.c, w: o.c.width, h: o.c.height };
}
var PALM = bakePalm(true), BUSH = bakeBush();
var SIGNS = [bakeSign('SUNSET', '#e85c6f', '#241a45'), bakeSign('NITRO', '#2ec5c0', '#10241f'), bakeSign('TURBO', '#f2c53d', '#2a2110'), bakeSign('URE', '#9a5cff', '#160f2e'), bakeSign('CURVE >', '#ff9350', '#241a45'), bakeSign('< SLOW', '#e6e8f0', '#241a45')];

// ─────────────────────────────────────────────────────────── track building
var segments = [], trackLength = 0;
function lastY() { return segments.length === 0 ? 0 : segments[segments.length - 1].p2.world.y; }
function addSeg(curve, y) {
  var n = segments.length, py = lastY();
  segments.push({ index: n, p1: { world: { y: py, z: n * SEGLEN }, camera: {}, screen: {} }, p2: { world: { y: y, z: (n + 1) * SEGLEN }, camera: {}, screen: {} }, curve: curve, sprites: [], cars: [], color: ((n / RUMBLE_LEN) | 0) % 2 ? 'dark' : 'light', checkpoint: false });
}
function addRoad(enter, hold, leave, curve, y) {
  var sy = lastY(), ey = sy + y * SEGLEN, total = enter + hold + leave, n;
  for (n = 0; n < enter; n++) addSeg(easeIn(0, curve, n / enter), easeIO(sy, ey, n / total));
  for (n = 0; n < hold; n++) addSeg(curve, easeIO(sy, ey, (enter + n) / total));
  for (n = 0; n < leave; n++) addSeg(easeIO(curve, 0, n / leave), easeIO(sy, ey, (enter + hold + n) / total));
}
var L = { S: 25, M: 50, G: 100 }, C = { E: 1.8, M: 3.6, H: 5.4 }, H = { L: 16, M: 36, G: 60 };
function straight(n) { addRoad(n, n, n, 0, 0); }
function curve(n, c, h) { addRoad(n, n, n, c, h || 0); }
function scurves(a) { a = a || 1; curve(L.M, -C.E * a, 0); curve(L.M, C.M * a, H.M); curve(L.M, -C.E * a, H.L); curve(L.M, C.E * a, -H.M); curve(L.M, -C.M * a, H.M); }
function bumps() { var i, s = [5, -4, -6, 2, -3, 4, -5, 3]; for (i = 0; i < s.length; i++) addRoad(10, 10, 10, 0, s[i]); }
function rollHills() { curve(L.S, 0, H.L); curve(L.S, 0, -H.L); curve(L.S, C.E, H.L); curve(L.S, 0, -H.L); curve(L.S, -C.E, H.M); }

function buildCoast() { straight(L.S); curve(L.G, C.M, H.L); straight(L.M); scurves(1); curve(L.G, -C.M, 0); straight(L.M); curve(L.G, C.M, H.M); scurves(1); curve(L.G, -C.E, -H.L); straight(L.M); }
function buildNight() { straight(L.S); scurves(1.3); curve(L.M, C.H, 0); curve(L.M, -C.H, H.L); scurves(1.4); curve(L.M, C.H, -H.L); straight(L.S); scurves(1.2); curve(L.M, -C.H, H.M); bumps(); curve(L.M, C.M, 0); }
function buildRidge() { straight(L.S); curve(L.M, C.E, H.G); rollHills(); curve(L.G, -C.M, H.M); curve(L.M, C.M, H.G); bumps(); curve(L.G, -C.E, -H.M); scurves(0.8); curve(L.M, C.M, H.M); straight(L.M); }

function buildTrack(track) {
  segments = [];
  track.build();
  var n = segments.length, i, s;
  // ease the closing height back to 0 so the loop seam is smooth
  for (i = 1; i <= M.min(180, n); i++) { s = segments[n - i]; s.p2.world.y *= (i / 180); if (i > 1) segments[n - i + 1].p1.world.y = s.p2.world.y; }
  for (i = 0; i < RUMBLE_LEN * 2; i++) segments[i].color = 'start';
  for (i = 1; i <= RUMBLE_LEN * 2; i++) segments[segments.length - i].color = 'finish';
  trackLength = segments.length * SEGLEN;
  addScenery();
}
function addScenery() {
  var n, seg, side, off;
  for (n = 10; n < segments.length; n++) {
    seg = segments[n];
    if (n % 24 === 0) seg.sprites.push({ source: pick(SIGNS), offset: rnd(-1.9, -1.3) });
    if (M.random() < 0.42) { side = M.random() < 0.5 ? -1 : 1; off = side * rnd(1.25, 3.4); seg.sprites.push({ source: M.random() < 0.72 ? PALM : BUSH, offset: off }); }
    if (n % 96 === 0) seg.sprites.push({ source: pick(SIGNS), offset: rnd(1.3, 1.9) });
  }
}
function findSeg(z) { return segments[((z / SEGLEN) | 0) % segments.length]; }

// ─────────────────────────────────────────────────────────── state
var TRACKS = [
  { name: 'SUNSET COAST', theme: 0, laps: 2, build: buildCoast },
  { name: 'NEON NIGHT', theme: 1, laps: 3, build: buildNight },
  { name: 'DAWN RIDGE', theme: 2, laps: 2, build: buildRidge }
];
var trackIdx = 0, TH = THEMES[0], laps = 2;
var state = 'title';               // title | race | results
var position = 0, speed = 0, playerX = 0, raceDist = 0;
var bounce = 0, bgOffset = 0, steer = 0, nitro = 1, boosting = false;
var shakeT = 0, shakeMag = 0, particles = [];
var raceTime = 0, countdown = 0, playerLap = 1, playerPos = 1;
var bestLap = 0, lapStart = 0, playerFinish = null;
var rivals = [], results = null, flash = null, hue = 0;
var skyGrad = null;

function setTheme(i) { TH = THEMES[i]; skyGrad = null; }
function ensureSky(ctx) { if (skyGrad) return; skyGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT); TH.sky.forEach(function (s) { skyGrad.addColorStop(s[0], s[1]); }); }

// ── persistence + achievements (synced to the Steam client via live: 'RACER') ──
function lget(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
var ACH_DEFS = [
  ['first', 'First Light', 'Finish a race'],
  ['podium', 'Podium', 'Finish in the top three'],
  ['win', 'Checkered', 'Win a race'],
  ['grand', 'Grand Tour', 'Win on all three circuits'],
  ['redline', 'Redline', 'Drain the nitro bar to empty'],
  ['night', 'Night Shift', 'Win on NEON NIGHT']
];
var achState = lget('comp_racer_ach', {}), wonTracks = lget('comp_racer_won', {}), bestLaps = lget('comp_racer_best', {});
var justUnlocked = [];
function achDef(id) { for (var i = 0; i < ACH_DEFS.length; i++) if (ACH_DEFS[i][0] === id) return ACH_DEFS[i]; return null; }
function unlock(id) { if (achState[id]) return; achState[id] = 1; lset('comp_racer_ach', achState); var d = achDef(id); justUnlocked.push(d[1]); flash = { text: 'UNLOCKED: ' + d[1], t: 2.4, c: '#ffd06b' }; blip(988, .1); setTimeout(function () { blip(1318, .12); }, 90); }
function steamAch() {
  var list = ACH_DEFS.map(function (a) { return [a[1], a[2], achState[a[0]] ? 1 : 0]; });
  var n = 0; list.forEach(function (x) { if (x[2]) n++; });
  return { n: n, total: ACH_DEFS.length, list: list };
}

function resetRace() {
  var track = TRACKS[trackIdx]; laps = track.laps; setTheme(track.theme);
  buildTrack(track);
  position = 0; speed = 0; playerX = 0; raceDist = 0; bounce = 0; bgOffset = 0; steer = 0;
  nitro = 1; boosting = false; shakeT = 0; particles = [];
  raceTime = 0; countdown = 3.0; playerLap = 1; playerPos = 1; bestLap = 0; lapStart = 0; playerFinish = null;
  flash = null; results = null; justUnlocked = [];
  // spawn rivals on the grid: staggered rows, alternating lanes
  rivals = [];
  for (var i = 0; i < N_RIVALS; i++) {
    var spr = RIVAL_SPRITES[i % RIVAL_SPRITES.length];
    rivals.push({
      name: spr.scheme.name, sprite: spr, scheme: spr.scheme,
      raceDist: -(i + 1) * 260,            // a short grid stagger behind the line
      z: 0, offset: (i % 2 ? 1 : -1) * (0.34 + (i % 3) * 0.06),
      speed: 0, skill: 0.74 + (i * 0.02), lane: (i % 2 ? 1 : -1) * (0.3 + (i % 3) * 0.08),
      finish: null, wob: rnd(0, 6.28)
    });
  }
}
function startRace() { resetRace(); state = 'race'; audioEnsure(); }

// ─────────────────────────────────────────────────────────── input (focus-gated)
var keys = {}, focused = false, mounted = false;
var KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'faster', KeyW: 'faster', ArrowDown: 'brake', KeyS: 'brake', ShiftLeft: 'boost', ShiftRight: 'boost', Space: 'hand', KeyP: 'pause', KeyM: 'mute', Enter: 'enter' };
function activeNow() { return mounted && focused; }
function onKeyDown(e) {
  if (!activeNow()) return;
  var k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault();
  if (k === 'pause') { if (!e.repeat && state === 'race') paused = !paused; return; }
  if (k === 'mute') { if (!e.repeat) toggleMute(); return; }
  if (k === 'enter') {
    if (!e.repeat) {
      if (state === 'title') startRace();
      else if (state === 'results') { state = 'title'; }
    }
    return;
  }
  if (state === 'title') {
    if (!e.repeat && (k === 'left' || k === 'right')) { trackIdx = (trackIdx + (k === 'left' ? -1 : 1) + TRACKS.length) % TRACKS.length; previewTrack(); }
    return;
  }
  keys[k] = true; audioEnsure();
}
function onKeyUp(e) { var k = KEYMAP[e.code]; if (k) keys[k] = false; }
function clearKeys() { for (var k in keys) keys[k] = false; }
function previewTrack() { var t = TRACKS[trackIdx]; setTheme(t.theme); laps = t.laps; buildTrack(t); position = 0; playerX = 0; }

// ─────────────────────────────────────────────────────────── audio
var actx = null, master = null, engine = null, engineOn = false, muted = false, skidN = null;
function audioEnsure() { if (actx) { if (actx.state === 'suspended') actx.resume(); return; } try { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(actx.destination); } catch (e) { actx = null; } }
function startEngine() { if (!actx || engineOn) return; var o1 = actx.createOscillator(), o2 = actx.createOscillator(), o3 = actx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'triangle'; var g = actx.createGain(); g.gain.value = 0; var lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; o1.connect(g); o2.connect(g); o3.connect(g); g.connect(lp); lp.connect(master); o1.start(); o2.start(); o3.start(); engine = { o1: o1, o2: o2, o3: o3, g: g, lp: lp }; engineOn = true; }
function stopEngine() { if (!engine) return; try { engine.g.gain.value = 0; engine.o1.stop(); engine.o2.stop(); engine.o3.stop(); } catch (e) {} engine = null; engineOn = false; }
function updEngine() { if (!engine) return; var sp = speed / MAXSPD, gear = M.min(5, (sp * 6) | 0), rpm = sp * 6 - gear, base = 42 + gear * 10, freq = base + rpm * 90 + (boosting ? 30 : 0), t = actx.currentTime; engine.o1.frequency.setTargetAtTime(freq, t, .03); engine.o2.frequency.setTargetAtTime(freq * .5, t, .03); engine.o3.frequency.setTargetAtTime(freq * 2.01, t, .05); engine.lp.frequency.setTargetAtTime(500 + sp * 2600 + (boosting ? 1200 : 0), t, .05); engine.g.gain.setTargetAtTime((state === 'race' && !paused) ? (0.05 + sp * 0.14 + (boosting ? 0.06 : 0)) : 0, t, .08); }
function noise(dur, vol, type, freq) { if (!actx) return; var n = actx.createBufferSource(), buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate), d = buf.getChannelData(0), i; for (i = 0; i < d.length; i++) d[i] = M.random() * 2 - 1; n.buffer = buf; var f = actx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1400; f.Q.value = .8; var g = actx.createGain(); g.gain.value = vol; g.gain.setTargetAtTime(0, actx.currentTime + dur * .3, dur * .4); n.connect(f); f.connect(g); g.connect(master); n.start(); n.stop(actx.currentTime + dur + .05); }
function setSkid(on, it) { if (!actx) return; if (on && !skidN) { var n = actx.createBufferSource(), buf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate), d = buf.getChannelData(0), i; for (i = 0; i < d.length; i++) d[i] = M.random() * 2 - 1; n.buffer = buf; n.loop = true; var f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.4; var g = actx.createGain(); g.gain.value = 0; n.connect(f); f.connect(g); g.connect(master); n.start(); skidN = { n: n, g: g }; } if (skidN) skidN.g.gain.setTargetAtTime(on ? (0.05 + it * 0.1) : 0, actx.currentTime, .05); }
function blip(freq, dur, type) { if (!actx) return; var o = actx.createOscillator(); o.type = type || 'square'; o.frequency.value = freq; var g = actx.createGain(); g.gain.value = .16; g.gain.setTargetAtTime(0, actx.currentTime + .02, dur * .4); o.connect(g); g.connect(master); o.start(); o.stop(actx.currentTime + dur); }
function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.85; }

// ─────────────────────────────────────────────────────────── particles
function smoke(sx, sy, n, tint) { for (var i = 0; i < n; i++) particles.push({ x: sx + rnd(-6, 6), y: sy + rnd(-3, 3), vx: rnd(-14, 14), vy: rnd(-26, -6), life: rnd(.4, .9), max: .9, size: 2 + (M.random() * 2 | 0), tint: tint }); }
function updParticles(dt) { for (var i = particles.length - 1; i >= 0; i--) { var p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 26 * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); } }
function addShake(t, m) { shakeT = M.max(shakeT, t); shakeMag = m; }

// ─────────────────────────────────────────────────────────── rivals
function totalDist(d) { return d; }
function updateRivals(dt) {
  var goal = laps * trackLength, i, r, ahead, target, ts;
  for (i = 0; i < rivals.length; i++) {
    r = rivals[i];
    if (r.finish != null) { r.z = r.raceDist % trackLength; if (r.z < 0) r.z += trackLength; continue; }
    // rubber-band around the player so the pack stays racy
    ahead = r.raceDist - raceDist;                     // >0 rival is ahead
    var sk = r.skill;
    if (ahead > 3500) sk -= 0.20; else if (ahead > 1200) sk -= 0.10;
    else if (ahead < -3500) sk += 0.16; else if (ahead < -1200) sk += 0.08;
    target = MAXSPD * clamp(sk, 0.5, 0.99);
    // ease speed toward target; a rival on a hard curve backs off a touch
    var seg = findSeg((r.raceDist % trackLength + trackLength) % trackLength);
    target *= (1 - M.min(0.18, M.abs(seg.curve) * 0.03));
    // ramp off the line at roughly the player's acceleration so the start is fair
    if (r.speed < target) r.speed = M.min(target, r.speed + ACCEL * 0.94 * dt);
    else r.speed = M.max(target, r.speed - ACCEL * 1.3 * dt);
    r.raceDist += r.speed * dt;
    r.z = r.raceDist % trackLength; if (r.z < 0) r.z += trackLength;
    // lane weave
    r.wob += dt; r.offset += ((r.lane + M.sin(r.wob) * 0.12) - r.offset) * M.min(1, dt * 2);
    if (r.raceDist >= goal && r.finish == null) r.finish = raceTime;
  }
  // sync rivals into their render segment buckets
  for (i = 0; i < segments.length; i++) segments[i].cars.length = 0;
  for (i = 0; i < rivals.length; i++) { var rr = rivals[i]; rr.percent = pctRem(rr.z, SEGLEN); findSeg(rr.z).cars.push(rr); }
}
function computePosition() {
  var better = 0, i, r;
  for (i = 0; i < rivals.length; i++) { r = rivals[i]; if (r.raceDist > raceDist) better++; }
  playerPos = better + 1;
}
function finishRace() {
  playerFinish = raceTime;
  var board = [{ name: 'YOU', scheme: PLAYER_SCHEME, dist: raceDist, finish: raceTime, you: true }];
  rivals.forEach(function (r) { board.push({ name: r.name, scheme: r.scheme, dist: r.raceDist, finish: r.finish, you: false }); });
  // finishers (by time) rank ahead of non-finishers (by distance)
  board.sort(function (a, b) {
    if (a.finish != null && b.finish != null) return a.finish - b.finish;
    if (a.finish != null) return -1; if (b.finish != null) return 1;
    return b.dist - a.dist;
  });
  // display: a finish time, else the gap behind whoever's just ahead
  board.forEach(function (e) {
    if (e.finish != null) e.disp = fmtTime(e.finish);
    else { var gap = (raceDist - e.dist) / (MAXSPD * 0.85); e.disp = '+' + gap.toFixed(1) + 'S'; }
  });
  results = board; state = 'results'; stopEngine(); setSkid(false, 0);
  // placement + achievements + records
  var mine = 1; for (var mi = 0; mi < board.length; mi++) if (board[mi].you) { mine = mi + 1; break; }
  unlock('first');
  if (mine <= 3) unlock('podium');
  if (mine === 1) { unlock('win'); wonTracks[trackIdx] = 1; lset('comp_racer_won', wonTracks); if (trackIdx === 1) unlock('night'); if (wonTracks[0] && wonTracks[1] && wonTracks[2]) unlock('grand'); }
  if (bestLap > 0) { var rec = bestLaps[trackIdx]; if (rec == null || bestLap < rec) { bestLaps[trackIdx] = bestLap; lset('comp_racer_best', bestLaps); results.record = true; } }
  blip(880, .12); setTimeout(function () { blip(1174, .16); }, 130); setTimeout(function () { blip(1568, .22); }, 300);
}

// ─────────────────────────────────────────────────────────── update
var paused = false;
function update(dt) {
  if (state !== 'race') { updEngine(); return; }
  if (paused) { updEngine(); return; }

  // start-line countdown
  if (countdown > 0) {
    var prev = M.ceil(countdown); countdown -= dt; speed = M.max(0, speed - MAXSPD * dt);
    var now = M.ceil(countdown);
    if (now !== prev) { if (now > 0) blip(520, .14, 'square'); else { blip(1046, .28, 'square'); flash = { text: 'GO!', t: .9, c: TH.accent }; addShake(.12, 2); startEngine(); lapStart = raceTime; } }
    updEngine(); return;
  }

  raceTime += dt;
  var seg = findSeg(position + PLAYER_Z), spct = speed / MAXSPD, dx = dt * 2.4 * spct;

  updateRivals(dt);

  boosting = keys.boost && nitro > 0.02 && speed > OFF_LIMIT * 0.4;
  var cap = MAXSPD * (boosting ? NITRO_MULT : 1);
  if (keys.faster) speed = accelV(speed, ACCEL * (boosting ? 1.5 : 1), dt);
  else if (keys.brake) speed = accelV(speed, BRAKING, dt);
  else speed = accelV(speed, DECEL, dt);
  if (keys.hand) speed = accelV(speed, BRAKING * 0.7, dt);

  var steering = 0;
  if (keys.left) { playerX -= dx; steering = -1; }
  if (keys.right) { playerX += dx; steering = 1; }
  playerX -= dx * spct * seg.curve * CENTRIF;
  var sliding = keys.hand && speed > OFF_LIMIT;
  if (sliding) playerX += steering * dx * 1.6;

  var off = (playerX < -1 || playerX > 1);
  if (off) { if (speed > OFF_LIMIT) speed = accelV(speed, OFF_DECEL, dt); bounce = rnd(-1.2, 1.2) * spct; }
  else bounce = interp(bounce, M.sin(position * .001) * .3 * spct, .1);

  // collisions with rivals
  for (var ci = 0; ci < seg.cars.length; ci++) {
    var car = seg.cars[ci], cw = car.sprite.w * SPR_SCALE;
    if (speed > car.speed && ovl(playerX, 0.5, car.offset, cw, 0.8)) {
      speed = car.speed * 0.6; addShake(.3, 5); smoke(WIDTH / 2, HEIGHT - 30, 14, '#ffb27a'); noise(.22, .45, 'lowpass', 380); blip(120, .14, 'sawtooth'); break;
    }
  }

  speed = clamp(speed, 0, cap); playerX = clamp(playerX, -2.4, 2.4);
  raceDist += dt * speed; position = raceDist % trackLength;

  var targetSteer = clamp(steering - seg.curve * spct * 0.6, -1, 1);
  steer = interp(steer, targetSteer, .18);

  if (boosting) nitro = clamp(nitro - dt * 0.42, 0, 1);
  else if (!off) nitro = clamp(nitro + dt * 0.14, 0, 1);
  if (boosting && nitro <= 0.001) unlock('redline');

  // laps + position + finish
  var lap = M.min(laps, (raceDist / trackLength | 0) + 1);
  if (lap !== playerLap) { var lt = raceTime - lapStart; if (bestLap === 0 || lt < bestLap) bestLap = lt; lapStart = raceTime; flash = { text: 'LAP ' + lap + ' / ' + laps, t: 1.3, c: '#ffd06b' }; blip(740, .1); playerLap = lap; }
  computePosition();
  if (raceDist >= laps * trackLength) { finishRace(); return; }

  // juice
  var hard = M.abs(steering) > 0 && spct > 0.6;
  if (off && spct > 0.25 && M.random() < 0.6) smoke(WIDTH / 2 + rnd(-24, 24), HEIGHT - 24, 2, '#caa06a');
  if ((sliding || hard) && spct > 0.5 && M.random() < 0.5) smoke(WIDTH / 2 + steer * 20, HEIGHT - 22, 2, '#e9e9f2');
  if (boosting && M.random() < 0.8) smoke(WIDTH / 2 + rnd(-18, 18), HEIGHT - 18, 2, pick(['#ff9350', '#e85c6f', '#ffd06b']));
  updParticles(dt);
  setSkid((off && spct > 0.3) || (sliding && spct > 0.5), spct);
  if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
  bgOffset += seg.curve * spct * 0.6;
  if (shakeT > 0) shakeT -= dt;
  hue = (hue + dt * 8) % 360;
  updEngine();
}

// ─────────────────────────────────────────────────────────── render
var ctx = null, canvas = null;
function poly(x1, y1, x2, y2, x3, y3, x4, y4, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill(); }
function rumbleW(w) { return w / M.max(6, 2 * LANES); }
function laneW(w) { return w / M.max(32, 8 * LANES); }
function project(p, cx, cy, cz) {
  p.camera.x = (p.world.x || 0) - cx; p.camera.y = (p.world.y || 0) - cy; p.camera.z = (p.world.z || 0) - cz;
  p.screen.scale = CAM_D / p.camera.z;
  p.screen.x = M.round(WIDTH / 2 + p.screen.scale * p.camera.x * WIDTH / 2);
  p.screen.y = M.round(HEIGHT / 2 - p.screen.scale * p.camera.y * HEIGHT / 2);
  p.screen.w = M.round(p.screen.scale * ROAD_W * WIDTH / 2);
}
function segColors(seg) {
  if (seg.color === 'start') return { road: '#e8e8ee', grass: TH.light.grass, rumble: '#e8e8ee', lane: null };
  if (seg.color === 'finish') return { road: '#161620', grass: TH.dark.grass, rumble: '#e8e8ee', lane: null };
  return seg.color === 'dark' ? TH.dark : TH.light;
}
function renderBG(horizonY) {
  ensureSky(ctx);
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  var i, x, y;
  if (TH.stars) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; for (i = 0; i < 46; i++) { x = (i * 97) % WIDTH; y = (i * 53) % ((HEIGHT * 0.36) | 0); if ((i * 7) % 4 === 0) ctx.fillRect(x, y, 1, 1); } }
  var cxs = WIDTH * 0.5 - (bgOffset * 0.5) % WIDTH, cys = horizonY - 46, r = 38;
  if (TH.celest === 'sun') {
    var sg = ctx.createLinearGradient(0, cys - r, 0, cys + r); sg.addColorStop(0, TH.sunHi); sg.addColorStop(1, TH.sunLo);
    ctx.save(); ctx.beginPath(); ctx.arc(cxs, cys, r, 0, 6.2832); ctx.clip();
    ctx.fillStyle = sg; ctx.fillRect(cxs - r, cys - r, r * 2, r * 2);
    ctx.fillStyle = skyGrad; for (i = 0; i < 9; i++) { var gy = cys + i * 5, gh = 1 + i * 0.4; if (gy > cys - 2) ctx.fillRect(cxs - r, gy, r * 2, gh); }
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(220,228,255,0.10)'; ctx.beginPath(); ctx.arc(cxs, cys, r + 6, 0, 6.2832); ctx.fill();
    ctx.fillStyle = TH.sunHi; ctx.beginPath(); ctx.arc(cxs, cys, r, 0, 6.2832); ctx.fill();
    ctx.fillStyle = TH.sunLo; [[cxs - 12, cys - 8, 6], [cxs + 10, cys + 4, 5], [cxs - 4, cys + 12, 4], [cxs + 14, cys - 12, 3]].forEach(function (c) { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, 6.2832); ctx.fill(); });
  }
  // city skyline + optional lit windows
  var base = horizonY;
  for (i = 0; i < 26; i++) {
    var bx = ((i * 40 - bgOffset * 1.2) % (WIDTH + 80)); x = ((bx % (WIDTH + 80)) + (WIDTH + 80)) % (WIDTH + 80) - 40;
    var bh = 14 + ((i * i * 13) % 34);
    ctx.fillStyle = TH.city; ctx.fillRect(x, base - bh, 18, bh); ctx.fillRect(x + 6, base - bh - 6, 6, 6);
    if (TH.cityLit) { ctx.fillStyle = TH.cityLit; for (var wy = base - bh + 3; wy < base - 3; wy += 6) for (var wx = x + 3; wx < x + 15; wx += 6) if (((wx * 7 + wy * 13 + i) % 5) < 2) ctx.fillRect(wx, wy, 2, 2); }
  }
  mountains(horizonY + 4, TH.mtnFar, 70, bgOffset * 1.6, 34);
  mountains(horizonY + 8, TH.mtnNear, 96, bgOffset * 2.4, 48);
}
function mountains(baseY, color, span, off, hgt) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, baseY + hgt);
  var o = ((off % span) + span) % span, x;
  for (x = -span; x <= WIDTH + span; x += span) { var px = x - o; ctx.lineTo(px, baseY); ctx.lineTo(px + span / 2, baseY - hgt * (0.5 + ((M.abs(x * 7) % 10) / 10) * 0.5)); ctx.lineTo(px + span, baseY); }
  ctx.lineTo(WIDTH, baseY + hgt); ctx.closePath(); ctx.fill();
}
function renderStrip(x1, y1, w1, x2, y2, w2, col) {
  var r1 = rumbleW(w1), r2 = rumbleW(w2), l1 = laneW(w1), l2 = laneW(w2);
  ctx.fillStyle = col.grass; ctx.fillRect(0, y2, WIDTH, y1 - y2);
  poly(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, col.rumble);
  poly(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, col.rumble);
  poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, col.road);
  if (col.lane) { var lw1 = w1 * 2 / LANES, lw2 = w2 * 2 / LANES, lx1 = x1 - w1 + lw1, lx2 = x2 - w2 + lw2, lane; for (lane = 1; lane < LANES; lx1 += lw1, lx2 += lw2, lane++) poly(lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, col.lane); }
}
function renderSprite(sprite, scale, dx, dy, ox, oy, clipY) {
  var dw = sprite.w * scale * (WIDTH / 2) * SPR_SCALE * ROAD_W, dh = sprite.h * scale * (WIDTH / 2) * SPR_SCALE * ROAD_W;
  dx = dx + dw * (ox || 0); dy = dy + dh * (oy || 0);
  var clipH = clipY ? M.max(0, dy + dh - clipY) : 0;
  if (clipH < dh && dw >= 1 && dh >= 1) ctx.drawImage(sprite.canvas || sprite, 0, 0, sprite.w, sprite.h * (1 - clipH / dh), M.round(dx), M.round(dy), M.round(dw), M.round(dh - clipH));
}
function render(alpha) {
  var camPos = (state === 'race' && !paused && countdown <= 0) ? position + speed * (alpha || 0) : position;
  ctx.save();
  if (shakeT > 0) ctx.translate(rnd(-1, 1) * shakeMag, rnd(-1, 1) * shakeMag);
  var baseSeg = findSeg(camPos), basePct = pctRem(camPos, SEGLEN);
  var pSeg = findSeg(camPos + PLAYER_Z), pPct = pctRem(camPos + PLAYER_Z, SEGLEN);
  var pY = interp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);
  var horizonY = M.round(HEIGHT * 0.42 + pY * 0.00002 * HEIGHT);
  renderBG(clamp(horizonY, HEIGHT * 0.28, HEIGHT * 0.55));

  var maxy = HEIGHT, x = 0, dx = -(baseSeg.curve * basePct), n, seg, looped, col;
  for (n = 0; n < DRAW; n++) {
    seg = segments[(baseSeg.index + n) % segments.length]; looped = seg.index < baseSeg.index; seg.looped = looped;
    seg.fog = fog(n / DRAW, FOGD); seg.clip = maxy;
    project(seg.p1, playerX * ROAD_W - x, pY + CAM_H, camPos - (looped ? trackLength : 0));
    project(seg.p2, playerX * ROAD_W - x - dx, pY + CAM_H, camPos - (looped ? trackLength : 0));
    x += dx; dx += seg.curve;
    if (seg.p1.camera.z <= CAM_D || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
    col = segColors(seg);
    renderStrip(seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.w, seg.p2.screen.x, seg.p2.screen.y, seg.p2.screen.w, col);
    if (seg.fog < 1) { ctx.globalAlpha = 1 - seg.fog; ctx.fillStyle = TH.fogc; ctx.fillRect(0, seg.p2.screen.y, WIDTH, seg.p1.screen.y - seg.p2.screen.y); ctx.globalAlpha = 1; }
    maxy = seg.p2.screen.y;
  }
  for (n = DRAW - 1; n > 0; n--) {
    seg = segments[(baseSeg.index + n) % segments.length];
    var ci, car, sc, sx, sy, s;
    for (ci = 0; ci < seg.cars.length; ci++) { car = seg.cars[ci]; sc = interp(seg.p1.screen.scale, seg.p2.screen.scale, car.percent); sx = interp(seg.p1.screen.x, seg.p2.screen.x, car.percent) + sc * car.offset * ROAD_W * WIDTH / 2; sy = interp(seg.p1.screen.y, seg.p2.screen.y, car.percent); renderSprite(car.sprite, sc, sx, sy, -0.5, -1, seg.clip); }
    for (ci = 0; ci < seg.sprites.length; ci++) { s = seg.sprites[ci]; sc = seg.p1.screen.scale; sx = seg.p1.screen.x + sc * s.offset * ROAD_W * WIDTH / 2; sy = seg.p1.screen.y; renderSprite(s.source, sc, sx, sy, (s.offset < 0 ? -1 : 0), -1, seg.clip); }
  }
  var p, a;
  for (n = 0; n < particles.length; n++) { p = particles[n]; a = clamp(p.life / p.max, 0, 1); ctx.globalAlpha = a * 0.8; ctx.fillStyle = p.tint || '#e9e9f2'; ctx.fillRect(M.round(p.x), M.round(p.y), p.size, p.size); }
  ctx.globalAlpha = 1;

  if (state === 'race') renderPlayer();

  var spct = speed / MAXSPD;
  if (state === 'race' && (spct > 0.75 || boosting)) {
    var lines = boosting ? 18 : 8, cx2 = WIDTH / 2, cy2 = HEIGHT * 0.62, ii, ang, r0, r1;
    ctx.strokeStyle = boosting ? 'rgba(255,190,120,0.5)' : 'rgba(255,255,255,0.26)'; ctx.lineWidth = 1;
    for (ii = 0; ii < lines; ii++) { ang = (ii / lines) * 6.2832 + hue * 0.02; r0 = 40 + ((ii * 13) % 30); r1 = r0 + 20 + spct * 40; ctx.beginPath(); ctx.moveTo(cx2 + M.cos(ang) * r0, cy2 + M.sin(ang) * r0); ctx.lineTo(cx2 + M.cos(ang) * r1, cy2 + M.sin(ang) * r1); ctx.stroke(); }
  }
  ctx.restore();

  if (state === 'title') renderTitle();
  else if (state === 'race') { renderHUD(); if (countdown > 0) renderCountdown(); if (paused) renderPaused(); }
  else if (state === 'results') renderResults();
  renderFX();
}
function renderPlayer() {
  var spct = speed / MAXSPD, bob = M.sin(position * .02) * (0.6 + spct * 1.4) + bounce * 3, baseY = HEIGHT - 8 + bob, cx = WIDTH / 2 + steer * 10, w = 78 + spct * 4;
  if (boosting) { [-11, 11].forEach(function (dxo) { var fl = 6 + rnd(0, 10); ctx.globalAlpha = .85; ctx.fillStyle = '#fff2b0'; ctx.fillRect(cx + dxo - 2, baseY - 3, 4, fl * .5); ctx.globalAlpha = .7; ctx.fillStyle = pick(['#ff9350', '#ffd06b', '#e85c6f']); ctx.fillRect(cx + dxo - 3, baseY - 2, 6, fl); }); ctx.globalAlpha = 1; }
  drawCar(ctx, cx, baseY, w, PLAYER_SCHEME, steer, keys.brake || keys.hand);
}
function panel(x, y, w, h) { ctx.fillStyle = 'rgba(16,10,30,0.62)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(233,86,139,0.5)'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); }
function renderHUD() {
  panel(4, 4, 116, 34);
  text(ctx, 'POS', 10, 9, 1, TH.accent); text(ctx, playerPos + ' / ' + (N_RIVALS + 1), 34, 9, 2, '#fff');
  text(ctx, 'LAP', 10, 24, 1, '#9a7bb5'); text(ctx, playerLap + ' / ' + laps, 34, 23, 2, '#c8b3dd');
  text(ctx, 'TIME', WIDTH / 2, 6, 1, '#9a7bb5', { align: 'center' });
  text(ctx, fmtTime(raceTime), WIDTH / 2, 15, 2, '#ffe98a', { align: 'center', shadow: '#00000088' });
  panel(WIDTH - 150, 4, 146, 34);
  var kmh = M.round(speed / MAXSPD * 312), gear = clamp((speed / MAXSPD * 6 | 0) + 1, 1, 6);
  text(ctx, pad(kmh, 3), WIDTH - 10, 8, 3, boosting ? '#ffb27a' : '#fff', { align: 'right', shadow: '#00000088' });
  text(ctx, 'KMH', WIDTH - 10, 28, 1, '#9a7bb5', { align: 'right' });
  text(ctx, 'GEAR ' + gear, WIDTH - 66, 28, 1, TH.accent);
  panel(6, HEIGHT - 18, 120, 12);
  text(ctx, 'NITRO', 10, HEIGHT - 15, 1, '#2ec5c0');
  var nw = 66; ctx.fillStyle = '#10241f'; ctx.fillRect(52, HEIGHT - 15, nw, 6);
  ctx.fillStyle = boosting ? '#ffd06b' : '#2ec5c0'; ctx.fillRect(52, HEIGHT - 15, M.round(nw * nitro), 6);
  for (var i = 1; i < 6; i++) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(52 + M.round(nw * i / 6), HEIGHT - 15, 1, 6); }
  if (bestLap > 0) { panel(WIDTH - 128, HEIGHT - 18, 122, 12); text(ctx, 'BEST', WIDTH - 124, HEIGHT - 15, 1, '#9a7bb5'); text(ctx, fmtTime(bestLap), WIDTH - 8, HEIGHT - 15, 1, '#ffd06b', { align: 'right' }); }
  if (flash) { ctx.globalAlpha = clamp(flash.t / 1.3, 0, 1); text(ctx, flash.text, WIDTH / 2, HEIGHT * 0.30, 2, flash.c || '#ffd06b', { align: 'center', shadow: '#00000099' }); ctx.globalAlpha = 1; }
}
function renderCountdown() { var n = M.ceil(countdown), frac = countdown - (n - 1), pop = frac > 0.72 ? (frac - 0.72) / 0.28 : 0, s = M.round(10 + pop * 6); text(ctx, 'GET READY', WIDTH / 2, HEIGHT * 0.20, 2, '#e6e8f0', { align: 'center', shadow: '#000' }); text(ctx, '' + n, WIDTH / 2, HEIGHT * 0.30, s, '#ffd06b', { align: 'center', shadow: TH.accent }); }
function bannerBG() { ctx.fillStyle = 'rgba(10,7,19,0.72)'; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
function renderPaused() { bannerBG(); text(ctx, 'PAUSED', WIDTH / 2, HEIGHT * 0.40, 4, '#ffd06b', { align: 'center', shadow: '#000' }); text(ctx, 'PRESS P TO RESUME', WIDTH / 2, HEIGHT * 0.58, 1, '#c8b3dd', { align: 'center' }); }
function renderTitle() {
  bannerBG();
  text(ctx, 'SUNSET', WIDTH / 2, HEIGHT * 0.14, 5, '#ffd06b', { align: 'center', shadow: '#a83a76' });
  text(ctx, 'RUNNER', WIDTH / 2, HEIGHT * 0.28, 5, TH.accent, { align: 'center', shadow: '#5c2668' });
  // track selector card
  var t = TRACKS[trackIdx];
  ctx.fillStyle = 'rgba(16,10,30,0.66)'; ctx.fillRect(WIDTH / 2 - 130, HEIGHT * 0.46, 260, 46);
  ctx.fillStyle = TH.accent; ctx.fillRect(WIDTH / 2 - 130, HEIGHT * 0.46, 260, 2);
  text(ctx, '< ' + t.name + ' >', WIDTH / 2, HEIGHT * 0.49, 2, '#fff', { align: 'center' });
  text(ctx, THEMES[t.theme].name + '   ' + t.laps + ' LAPS   ' + (N_RIVALS + 1) + ' RACERS', WIDTH / 2, HEIGHT * 0.61, 1, '#c8b3dd', { align: 'center' });
  if (bestLaps[trackIdx] != null) text(ctx, 'TRACK RECORD  ' + fmtTime(bestLaps[trackIdx]), WIDTH / 2, HEIGHT * 0.67, 1, '#9a7bb5', { align: 'center' });
  var blink = ((perfNow() / 400) | 0) % 2;
  if (blink) text(ctx, 'PRESS ENTER TO RACE', WIDTH / 2, HEIGHT * 0.75, 2, '#fff', { align: 'center' });
  text(ctx, 'LEFT / RIGHT PICK TRACK   ARROWS DRIVE   SHIFT NITRO', WIDTH / 2, HEIGHT * 0.86, 1, '#9a7bb5', { align: 'center' });
}
function renderResults() {
  bannerBG();
  var mine = 1; if (results) for (var k = 0; k < results.length; k++) if (results[k].you) mine = k + 1;
  var head = mine === 1 ? 'YOU WON!' : (mine <= 3 ? 'PODIUM! P' + mine : 'P' + mine + ' / ' + (N_RIVALS + 1));
  text(ctx, head, WIDTH / 2, HEIGHT * 0.08, 3, mine === 1 ? '#ffd06b' : (mine <= 3 ? '#2ec5c0' : '#ff8a8a'), { align: 'center', shadow: '#000' });
  var y = HEIGHT * 0.26, i, r, rowc;
  if (results) for (i = 0; i < results.length; i++) {
    r = results[i]; rowc = r.you ? '#ffd06b' : '#c8b3dd';
    ctx.fillStyle = r.scheme.body; ctx.fillRect(WIDTH / 2 - 120, y - 1, 8, 8);
    text(ctx, (i + 1) + '', WIDTH / 2 - 106, y, 1, rowc);
    text(ctx, r.name, WIDTH / 2 - 88, y, 1, rowc);
    text(ctx, r.disp || (r.finish != null ? fmtTime(r.finish) : '-'), WIDTH / 2 + 118, y, 1, rowc, { align: 'right' });
    y += 12;
  }
  if (bestLap > 0) text(ctx, (results && results.record ? 'NEW RECORD  ' : 'BEST LAP  ') + fmtTime(bestLap), WIDTH / 2, HEIGHT * 0.78, 1, (results && results.record) ? '#2ec5c0' : '#9a7bb5', { align: 'center' });
  if (justUnlocked.length) text(ctx, 'UNLOCKED  ' + justUnlocked.join('   '), WIDTH / 2, HEIGHT * 0.84, 1, '#ffd06b', { align: 'center' });
  var blink = ((perfNow() / 400) | 0) % 2;
  if (blink) text(ctx, 'PRESS ENTER FOR MENU', WIDTH / 2, HEIGHT * 0.91, 1, '#fff', { align: 'center' });
}
function renderFX() {
  ctx.globalAlpha = 0.10; ctx.fillStyle = '#000'; for (var y = 0; y < HEIGHT; y += 2) ctx.fillRect(0, y, WIDTH, 1); ctx.globalAlpha = 1;
  var vg = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.32, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

// ─────────────────────────────────────────────────────────── loop + mount
var _perf0 = 0;
function perfNow() { return (window.performance && performance.now) ? performance.now() : (_perf0 += 16.7); }
var running = false, rafId = 0, lastT = 0, acc = 0, root = null, content = null, ro = null, startedAt = 0, bankedSecs = 0;
function fit() {
  if (!content || !canvas) return;
  var cw = content.clientWidth || WIDTH, ch = content.clientHeight || HEIGHT;
  var s = M.max(1, M.min(cw / WIDTH, ch / HEIGHT));
  canvas.style.width = M.floor(WIDTH * s) + 'px'; canvas.style.height = M.floor(HEIGHT * s) + 'px';
}
function frame(now) {
  if (!running) return;
  rafId = window.requestAnimationFrame(frame);
  var dt = M.min(0.05, (now - lastT) / 1000); lastT = now; acc += dt;
  var guard = 0; while (acc >= STEP && guard < 6) { update(STEP); acc -= STEP; guard++; } if (guard >= 6) acc = 0;
  render(acc);
}
function render_html() {
  return '<div class="racer-root" tabindex="0" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#07050f;outline:none;overflow:hidden">' +
    '<canvas class="racer-cv" width="' + WIDTH + '" height="' + HEIGHT + '" style="image-rendering:pixelated;image-rendering:crisp-edges;box-shadow:0 0 40px rgba(224,86,139,.2)"></canvas></div>';
}
function init(el) {
  root = el.querySelector('.racer-root') || el;
  content = el.querySelector('.win-content') || root;
  canvas = root.querySelector('.racer-cv');
  ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  mounted = true; state = 'title'; trackIdx = 0; previewTrack();
  focused = false;
  // focus handling: only capture keys while the game has focus
  root.addEventListener('focus', function () { focused = true; }, true);
  root.addEventListener('blur', function () { focused = false; clearKeys(); }, true);
  root.addEventListener('pointerdown', function () { root.focus(); audioEnsure(); });
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  if (window.ResizeObserver) { ro = new ResizeObserver(fit); ro.observe(content); } else window.addEventListener('resize', fit);
  fit();
  try { root.focus(); } catch (e) {}
  startedAt = perfNow(); running = true; lastT = perfNow(); acc = 0;
  render(0);                       // paint one frame immediately (survives frozen rAF)
  rafId = window.requestAnimationFrame(frame);
}
function pause() { if (!running) return; running = false; window.cancelAnimationFrame(rafId); stopEngine(); setSkid(false, 0); bankedSecs += (perfNow() - startedAt) / 1000; }
function resume() { if (running || !mounted) return; running = true; startedAt = perfNow(); lastT = perfNow(); acc = 0; rafId = window.requestAnimationFrame(frame); }
function close() {
  if (running) bankedSecs += (perfNow() - startedAt) / 1000;
  running = false; window.cancelAnimationFrame(rafId);
  stopEngine(); setSkid(false, 0);
  window.removeEventListener('keydown', onKeyDown, true); window.removeEventListener('keyup', onKeyUp, true);
  if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; } else window.removeEventListener('resize', fit);
  mounted = false; focused = false; clearKeys();
  var hrs = bankedSecs / 3600; bankedSecs = 0; return hrs;
}

// headless / test hooks (used by the offline harness; harmless in production)
var _dbg = {
  startRace: function (ti, skipCd) { trackIdx = ti | 0; startRace(); if (skipCd) countdown = 0; },
  step: function (n) { for (var i = 0; i < (n || 1); i++) update(STEP); },
  autoStep: function (n, boost) {
    for (var i = 0; i < (n || 1); i++) {
      if (state !== 'race') break;
      var seg = findSeg(position + PLAYER_Z);
      // steer-right raises playerX; hold centre and steer INTO the curve
      var cmd = -playerX * 3 + seg.curve * 1.3;
      keys.right = cmd > 0.1; keys.left = cmd < -0.1;
      keys.faster = true; keys.boost = !!boost && nitro > 0.25;
      update(STEP);
    }
  },
  setKeys: function (o) { for (var k in o) keys[k] = o[k]; },
  draw: function () { render(0); },
  forceFinish: function () { raceDist = laps * trackLength; finishRace(); },
  state: function () { return { state: state, pos: playerPos, lap: playerLap, speed: speed | 0, raceDist: raceDist | 0, rivals: rivals.length, trackIdx: trackIdx, results: results }; },
  setTrack: function (i) { trackIdx = i | 0; previewTrack(); }
};

return { render: render_html, init: init, close: close, pause: pause, resume: resume, steamAch: steamAch, _dbg: _dbg };
})();
