/* ═══════════════════════════════════════════════════════════════════════════
   SUNSET RUNNER — a pseudo-3D pixel racer that runs IN the UreOS desktop.
   Exposes window.RACER = { render, init, close, pause, resume, steamAch }.

   Depth build: Quick Race / Championship / Time Trial (with a ghost of your
   best lap), four cars with real stat tradeoffs, three difficulties, five
   circuits across four day/night themes plus a rain track, live-drawn rivals
   that take racing lines and brake for corners, skid marks, weather, a richer
   HUD, and a procedural synthwave soundtrack. Pseudo-3D road in the
   Pole Position / OutRun lineage; fixed-60Hz physics with an interpolated
   camera so it stays smooth on 120/144Hz panels.
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
var NITRO_MULT = 1.34, N_RIVALS = 5;

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
function sign(x) { return x < 0 ? -1 : (x > 0 ? 1 : 0); }
function ovl(x1, w1, x2, w2, pct) { var h = (pct || 1) / 2; return !((x1 + w1 * h) < (x2 - w2 * h) || (x1 - w1 * h) > (x2 + w2 * h)); }
function pad(n, w) { var s = '' + M.max(0, n | 0); while (s.length < w) s = '0' + s; return s; }
function fmtTime(s) { s = M.max(0, s); var m = (s / 60) | 0, r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2); }
function lget(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

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
    '%': ['##..#', '##.#.', '..#..', '.#.#.', '#.##.', '#..##', '.....'],
    '(': ['..#..', '.#...', '#....', '#....', '#....', '.#...', '..#..'],
    ')': ['..#..', '...#.', '....#', '....#', '....#', '...#.', '..#..'],
    '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
    '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....']
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
// scenery: 'palm' warm coasts, 'pine' ridges, 'cactus' canyon, 'neon' night
var THEMES = {
  sunset: { name: 'SUNSET COAST', celest: 'sun', stars: true, scenery: 'palm', music: 'sunset',
    sky: [[0, '#241a45'], [.35, '#5c2668'], [.6, '#a83a76'], [.78, '#e85c6f'], [.9, '#ff9350'], [1, '#ffd06b']],
    sunHi: '#ffe98a', sunLo: '#ff5f8b', mtnFar: '#3a2358', mtnNear: '#2a1846', city: '#20143a', cityLit: '#ffbe6b',
    fogc: '#3a2159', accent: '#e85c6f',
    light: { road: '#4b4b5e', grass: '#1f7a5f', rumble: '#e6e8f0', lane: '#e6e8f0' },
    dark: { road: '#43434f', grass: '#1a6b52', rumble: '#d23c7d', lane: null } },
  night: { name: 'NEON NIGHT', celest: 'moon', stars: true, scenery: 'neon', music: 'night',
    sky: [[0, '#04050e'], [.5, '#0b1030'], [.82, '#241a45'], [1, '#3a2159']],
    sunHi: '#e7ecff', sunLo: '#96a8d6', mtnFar: '#0d1230', mtnNear: '#151b3c', city: '#090d20', cityLit: '#ffd06b',
    fogc: '#0b1030', accent: '#31e6d0',
    light: { road: '#2b2b3e', grass: '#123a30', rumble: '#31e6d0', lane: '#e6e8f0' },
    dark: { road: '#26263a', grass: '#0f3228', rumble: '#e0409a', lane: null } },
  dawn: { name: 'DAWN RIDGE', celest: 'sun', stars: false, scenery: 'pine', music: 'dawn',
    sky: [[0, '#31517f'], [.42, '#7aa0c8'], [.68, '#f4c88f'], [.86, '#ffd9a0'], [1, '#fff1d6']],
    sunHi: '#fffbe0', sunLo: '#ffcf78', mtnFar: '#6a7fa8', mtnNear: '#51648c', city: '#43547e', cityLit: null,
    fogc: '#c9b59a', accent: '#e8894f',
    light: { road: '#6b6f7e', grass: '#3fae5a', rumble: '#e6e8f0', lane: '#f0f0f0' },
    dark: { road: '#63677a', grass: '#37a052', rumble: '#d23c46', lane: null } },
  canyon: { name: 'CANYON DUSK', celest: 'sun', stars: true, scenery: 'cactus', music: 'canyon',
    sky: [[0, '#2a1836'], [.4, '#6e2748'], [.66, '#c24a3f'], [.85, '#f08a3c'], [1, '#ffd06b']],
    sunHi: '#ffe07a', sunLo: '#ff6f4a', mtnFar: '#5a2b32', mtnNear: '#7a3a30', city: '#3a1e28', cityLit: null,
    fogc: '#4a2330', accent: '#ff8a4a',
    light: { road: '#5a4a4a', grass: '#b9713a', rumble: '#f0e2c0', lane: '#f0e2c0' },
    dark: { road: '#524444', grass: '#a5642f', rumble: '#7a3a2a', lane: null } }
};

// ─────────────────────────────────────────────────────────── sprites
function newCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); g.imageSmoothingEnabled = false; return { c: c, g: g }; }

// the car, drawn live so every car gets lean + brake lights for free
function drawCar(g, cx, baseY, w, s, lean, brake, alpha) {
  var h = M.round(w * 0.60), x = M.round(cx - w / 2), y = M.round(baseY - h);
  if (alpha != null) g.globalAlpha = alpha;
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
  if (brake && w > 26) { g.fillStyle = 'rgba(255,90,90,0.30)'; g.fillRect(x + w * .04, y + h * .44, w * .28, h * .24); g.fillRect(x + w * .68, y + h * .44, w * .28, h * .24); }
  if (alpha != null) g.globalAlpha = 1;
}

function bakePalm() {
  var o = newCanvas(72, 128), g = o.g, i, t, bx, w, y;
  for (i = 0; i < 58; i++) { t = i / 58; bx = 36 + M.sin(t * 1.4) * 7 - 3; w = 3 + t * 3.2; y = 128 - 6 - i * 2.05; g.fillStyle = '#2a1c3a'; g.fillRect(M.round(bx), M.round(y), M.round(w), 3); g.fillStyle = '#3c2a52'; g.fillRect(M.round(bx), M.round(y), 1, 3); }
  var tx = 36 + M.sin(1.4) * 7 - 3, ty = 128 - 6 - 57 * 2.05;
  g.fillStyle = '#241633'; g.fillRect(tx - 3, ty - 2, 4, 4); g.fillRect(tx + 3, ty - 1, 4, 4);
  var greens = ['#1c7a52', '#155f40', '#22986a'], f, ang, len, s, px, py, wdt;
  for (f = 0; f < 7; f++) { ang = -M.PI + (f / 6) * M.PI; len = 26 + (f % 2) * 6; g.fillStyle = greens[f % 3]; for (s = 0; s < len; s++) { t = s / len; px = tx + M.cos(ang) * s * 0.95; py = ty + M.sin(ang) * s * 0.7 + t * t * 10; wdt = M.max(1, 4 * (1 - t)); g.fillRect(M.round(px - wdt / 2), M.round(py), M.round(wdt), 2); } }
  return { canvas: o.c, w: 72, h: 128 };
}
function bakePine() {
  var o = newCanvas(48, 120), g = o.g, i;
  g.fillStyle = '#3a2a1a'; g.fillRect(22, 96, 5, 22);
  var tiers = [[8, 96], [12, 74], [16, 54], [19, 36]];
  for (i = 0; i < tiers.length; i++) { var tt = tiers[i]; g.fillStyle = i % 2 ? '#1c5a3a' : '#227048'; g.beginPath(); g.moveTo(24, tt[1] - 14); g.lineTo(tt[0], tt[1]); g.lineTo(48 - tt[0], tt[1]); g.closePath(); g.fill(); }
  return { canvas: o.c, w: 48, h: 120 };
}
function bakeCactus() {
  var o = newCanvas(48, 96), g = o.g;
  g.fillStyle = '#2f7a3a'; g.fillRect(20, 24, 8, 68);
  g.fillRect(8, 44, 6, 22); g.fillRect(8, 44, 22, 6); g.fillRect(34, 36, 6, 26); g.fillRect(18, 36, 22, 6);
  g.fillStyle = '#3f9a4a'; g.fillRect(20, 24, 3, 68); g.fillRect(34, 36, 3, 26);
  g.fillStyle = '#e8b6d0'; g.fillRect(21, 20, 6, 5);
  return { canvas: o.c, w: 48, h: 96 };
}
function bakeButte() {
  var o = newCanvas(120, 92), g = o.g;
  g.fillStyle = '#7a3a30'; g.fillRect(10, 20, 100, 72);
  g.fillStyle = '#8f4838'; g.fillRect(10, 20, 100, 8);
  g.fillStyle = '#5a2b2a'; for (var i = 0; i < 5; i++) g.fillRect(18 + i * 20, 34 + (i % 2) * 10, 8, 40);
  g.fillStyle = '#5a2b2a'; g.fillRect(10, 84, 100, 8);
  return { canvas: o.c, w: 120, h: 92 };
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
function bakeNeon(str, c1, c2) {
  var w = txtW(str, 2, 1) + 16, o = newCanvas(w, 70), g = o.g;
  g.fillStyle = '#0a0a16'; g.fillRect(4, 40, 4, 30); g.fillRect(w - 8, 40, 4, 30);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, w, 40);
  g.shadowColor = c1; g.shadowBlur = 6; text(g, str, 8, 10, 2, c1);
  g.shadowBlur = 0; g.fillStyle = c2; g.fillRect(2, 2, w - 4, 2); g.fillRect(2, 36, w - 4, 2);
  return { canvas: o.c, w: o.c.width, h: o.c.height };
}
var SPR = {
  palm: bakePalm(), pine: bakePine(), cactus: bakeCactus(), butte: bakeButte(), bush: bakeBush(),
  signs: [bakeSign('SUNSET', '#e85c6f', '#241a45'), bakeSign('TURBO', '#f2c53d', '#2a2110'), bakeSign('URE', '#9a5cff', '#160f2e'), bakeSign('CURVE >', '#ff9350', '#241a45')],
  neon: [bakeNeon('NITRO', '#31e6d0', '#e0409a'), bakeNeon('URE', '#e0409a', '#31e6d0'), bakeNeon('NEON', '#ffd06b', '#e0409a'), bakeNeon('DRIVE', '#7ba0ff', '#31e6d0')]
};

// ─────────────────────────────────────────────────────────── cars
var SCHEMES = [
  { body: '#e8402c', roof: '#c22a1e', glass: '#1c1430', dark: '#7c160f', hi: '#ff7a5c' },
  { body: '#2ec5c0', roof: '#1f938f', glass: '#10241f', dark: '#125b58', hi: '#7bf0ec' },
  { body: '#f2c53d', roof: '#c89a22', glass: '#2a2110', dark: '#7c6110', hi: '#ffe98a' },
  { body: '#4f7bff', roof: '#3355c8', glass: '#141b34', dark: '#1e2f80', hi: '#93b0ff' },
  { body: '#e6e8f0', roof: '#b9bccb', glass: '#20222e', dark: '#6f7280', hi: '#ffffff' },
  { body: '#9a5cff', roof: '#6f36c8', glass: '#1a1330', dark: '#451c80', hi: '#c79bff' }
];
// player cars: stat multipliers. spd top-speed, acc acceleration, grip cornering, nos nitro
var CARS = [
  { name: 'ARGENT', scheme: SCHEMES[0], spd: 1.00, acc: 1.00, grip: 1.00, nos: 1.00, blurb: 'The all-rounder. A silver soul in a red shell.' },
  { name: 'TURBINE', scheme: SCHEMES[3], spd: 1.12, acc: 0.90, grip: 0.86, nos: 1.15, blurb: 'Top-end monster. Loose in the corners.' },
  { name: 'APEX', scheme: SCHEMES[1], spd: 0.94, acc: 1.14, grip: 1.22, nos: 0.90, blurb: 'Corner carver. Point and shoot.' },
  { name: 'COMET', scheme: SCHEMES[5], spd: 1.02, acc: 1.02, grip: 0.94, nos: 1.45, blurb: 'Nitro tank. Live on the boost.' }
];
var RIVAL_SCHEMES = [SCHEMES[5], SCHEMES[2], SCHEMES[3], SCHEMES[4], SCHEMES[1]];
var RIVAL_NAMES = ['PULSE', 'BLAZE', 'VIPER', 'GHOST', 'NOVA'];
var DIFFS = [
  { name: 'EASY', rival: 0.68, band: 1.35, assist: 1.12 },
  { name: 'NORMAL', rival: 0.76, band: 1.0, assist: 1.0 },
  { name: 'HARD', rival: 0.85, band: 0.75, assist: 0.92 }
];

// ─────────────────────────────────────────────────────────── track building
var segments = [], trackLength = 0;
function lastY() { return segments.length === 0 ? 0 : segments[segments.length - 1].p2.world.y; }
function addSeg(curve, y) {
  var n = segments.length, py = lastY();
  segments.push({ index: n, p1: { world: { y: py, z: n * SEGLEN }, camera: {}, screen: {} }, p2: { world: { y: y, z: (n + 1) * SEGLEN }, camera: {}, screen: {} }, curve: curve, sprites: [], cars: [], skids: [], color: ((n / RUMBLE_LEN) | 0) % 2 ? 'dark' : 'light' });
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
function buildCanyon() { straight(L.S); curve(L.M, C.H, H.M); curve(L.S, -C.H, 0); straight(L.S); curve(L.G, C.M, -H.M); rollHills(); curve(L.M, -C.H, H.G); curve(L.M, C.H, 0); bumps(); curve(L.G, -C.M, H.L); straight(L.M); }
function buildHarbor() { straight(L.S); curve(L.M, -C.M, 0); scurves(1.1); curve(L.M, C.H, H.L); straight(L.M); curve(L.G, -C.H, 0); scurves(1.0); curve(L.M, C.M, -H.L); curve(L.M, -C.E, H.M); straight(L.S); }

var TRACKS = [
  { name: 'SUNSET COAST', theme: 'sunset', laps: 2, build: buildCoast, rain: false },
  { name: 'NEON NIGHT', theme: 'night', laps: 3, build: buildNight, rain: false },
  { name: 'DAWN RIDGE', theme: 'dawn', laps: 2, build: buildRidge, rain: false },
  { name: 'CANYON DUSK', theme: 'canyon', laps: 2, build: buildCanyon, rain: false },
  { name: 'STORM HARBOR', theme: 'night', laps: 3, build: buildHarbor, rain: true }
];

function buildTrack(track) {
  segments = [];
  track.build();
  var n = segments.length, i, s;
  for (i = 1; i <= M.min(180, n); i++) { s = segments[n - i]; s.p2.world.y *= (i / 180); if (i > 1) segments[n - i + 1].p1.world.y = s.p2.world.y; }
  for (i = 0; i < RUMBLE_LEN * 2; i++) segments[i].color = 'start';
  for (i = 1; i <= RUMBLE_LEN * 2; i++) segments[segments.length - i].color = 'finish';
  trackLength = segments.length * SEGLEN;
  addScenery(track);
}
function addScenery(track) {
  var th = THEMES[track.theme], sc = th.scenery, n, seg, side, off, near;
  for (n = 10; n < segments.length; n++) {
    seg = segments[n];
    if (n % 24 === 0) seg.sprites.push({ source: sc === 'neon' ? pick(SPR.neon) : pick(SPR.signs), offset: rnd(-1.95, -1.35) });
    if (M.random() < 0.42) {
      side = M.random() < 0.5 ? -1 : 1; off = side * rnd(1.25, 3.4);
      if (sc === 'palm') near = M.random() < 0.72 ? SPR.palm : SPR.bush;
      else if (sc === 'pine') near = M.random() < 0.78 ? SPR.pine : SPR.bush;
      else if (sc === 'cactus') near = M.random() < 0.5 ? SPR.cactus : (M.random() < 0.5 ? SPR.butte : SPR.bush);
      else near = M.random() < 0.5 ? SPR.palm : pick(SPR.neon);
      seg.sprites.push({ source: near, offset: off });
    }
    if (n % 96 === 0) seg.sprites.push({ source: sc === 'neon' ? pick(SPR.neon) : pick(SPR.signs), offset: rnd(1.35, 1.95) });
  }
}
function findSeg(z) { return segments[((z / SEGLEN) | 0) % segments.length]; }

// ─────────────────────────────────────────────────────────── persistence / achievements
var ACH_DEFS = [
  ['first', 'First Light', 'Finish a race'],
  ['podium', 'Podium', 'Finish in the top three'],
  ['win', 'Checkered', 'Win a race'],
  ['grand', 'Grand Tour', 'Win on every circuit'],
  ['redline', 'Redline', 'Drain the nitro bar to empty'],
  ['champion', 'Champion', 'Win a championship'],
  ['garage', 'Full Garage', 'Win a race in all four cars'],
  ['storm', 'Stormchaser', 'Win in the rain']
];
var achState = lget('comp_racer_ach', {}), wonTracks = lget('comp_racer_won', {}), wonCars = lget('comp_racer_cars', {});
var bestLaps = lget('comp_racer_best', {}), ghosts = lget('comp_racer_ghost', {});
var justUnlocked = [];
function achDef(id) { for (var i = 0; i < ACH_DEFS.length; i++) if (ACH_DEFS[i][0] === id) return ACH_DEFS[i]; return null; }
function unlock(id) { if (achState[id]) return; achState[id] = 1; lset('comp_racer_ach', achState); var d = achDef(id); justUnlocked.push(d[1]); flash = { text: 'UNLOCKED: ' + d[1], t: 2.4, c: '#ffd06b' }; blip(988, .1); setTimeout(function () { blip(1318, .12); }, 90); }
function steamAch() {
  var list = ACH_DEFS.map(function (a) { return [a[1], a[2], achState[a[0]] ? 1 : 0]; });
  var n = 0; list.forEach(function (x) { if (x[2]) n++; });
  return { n: n, total: ACH_DEFS.length, list: list };
}

// ─────────────────────────────────────────────────────────── state
var TH = THEMES.sunset, RAIN = false, laps = 2;
var mode = 'quick', carIdx = 0, diffIdx = 1, trackIdx = 0, menuSel = 0;
var screen = 'title';   // title | mode | car | track | race | results | standings | champion
var position = 0, speed = 0, playerX = 0, raceDist = 0;
var bounce = 0, bgOffset = 0, steer = 0, nitro = 1, boosting = false, wasBoost = false;
var shakeT = 0, shakeMag = 0, particles = [], rainDrops = [];
var raceTime = 0, countdown = 0, playerLap = 1, playerPos = 1, prevPos = 1, posArrowT = 0;
var bestLap = 0, lapStart = 0, gapAhead = 0;
var rivals = [], results = null, flash = null, hue = 0, titleT = 0;
var CAR = CARS[0], DIFF = DIFFS[1];
var champOrder = [0, 1, 2, 3, 4], champRound = 0, champPts = {};
var PTS = [10, 8, 6, 4, 2, 1];
var ttRecord = [], ttGhost = null, ttPlaying = null;
var skyGrad = null, paused = false;

function setTheme(key) { TH = THEMES[key]; skyGrad = null; }
function ensureSky(ctx2) { if (skyGrad) return; skyGrad = ctx2.createLinearGradient(0, 0, 0, HEIGHT); TH.sky.forEach(function (s) { skyGrad.addColorStop(s[0], s[1]); }); }
function keyOf(id) { return CAR.name + '_' + id; }

function loadTrack(ti) { var t = TRACKS[ti]; setTheme(t.theme); laps = t.laps; RAIN = t.rain; buildTrack(t); position = 0; playerX = 0; }

function resetRace() {
  var t = TRACKS[trackIdx]; laps = t.laps; setTheme(t.theme); RAIN = t.rain;
  buildTrack(t);
  position = 0; speed = 0; playerX = 0; raceDist = 0; bounce = 0; bgOffset = 0; steer = 0;
  nitro = 1; boosting = false; wasBoost = false; shakeT = 0; particles = []; rainDrops = []; paused = false;
  raceTime = 0; countdown = 3.0; playerLap = 1; playerPos = 1; prevPos = 1; posArrowT = 0;
  bestLap = 0; lapStart = 0; gapAhead = 0; flash = null; results = null; justUnlocked = [];
  ttRecord = []; ttPlaying = null;
  ttGhost = (mode === 'tt') ? (ghosts[keyOf('t' + trackIdx)] || null) : null;
  rivals = [];
  if (mode !== 'tt') {
    for (var i = 0; i < N_RIVALS; i++) {
      rivals.push({
        name: RIVAL_NAMES[i], scheme: RIVAL_SCHEMES[i], raceDist: -(i + 1) * 260, z: 0,
        offset: (i % 2 ? 1 : -1) * (0.34 + (i % 3) * 0.06), speed: 0,
        skill: DIFF.rival + i * 0.02 - 0.04, targetOff: 0, steer: 0, braking: false,
        mistake: -3, mistErr: 0, finish: null, lap: 1
      });
    }
  }
}
function startRace() { resetRace(); screen = 'race'; audioEnsure(); musicSet(TH); }
function startChampionship() { champRound = 0; champPts = {}; ['YOU'].concat(RIVAL_NAMES).forEach(function (n) { champPts[n] = 0; }); trackIdx = champOrder[0]; mode = 'champ'; startRace(); }

// ─────────────────────────────────────────────────────────── input
var keys = {}, focused = false, mounted = false;
var KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ShiftLeft: 'boost', ShiftRight: 'boost', Space: 'hand', KeyP: 'pause', KeyM: 'mute', Enter: 'enter', Escape: 'back', Backspace: 'back' };
function activeNow() { return mounted && focused; }
function menuMove() { blip(440, .04); }
function onKeyDown(e) {
  if (!activeNow()) return;
  var k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault();
  if (k === 'mute') { if (!e.repeat) toggleMute(); return; }
  if (screen === 'race') {
    if (k === 'left' || k === 'right' || k === 'up' || k === 'down' || k === 'boost' || k === 'hand') { keys[k] = true; audioEnsure(); return; }
    if ((k === 'pause' || k === 'back') && !e.repeat) { paused = !paused; musicDuck(paused); }
    return;
  }
  if (e.repeat) return;
  if (screen === 'title') { if (k === 'enter') { screen = 'mode'; menuSel = 0; blip(660, .08); } return; }
  if (screen === 'mode') {
    if (k === 'up') { menuSel = (menuSel + 2) % 3; menuMove(); }
    else if (k === 'down') { menuSel = (menuSel + 1) % 3; menuMove(); }
    else if (k === 'left') { diffIdx = (diffIdx + 2) % 3; DIFF = DIFFS[diffIdx]; menuMove(); }
    else if (k === 'right') { diffIdx = (diffIdx + 1) % 3; DIFF = DIFFS[diffIdx]; menuMove(); }
    else if (k === 'enter') { mode = ['quick', 'champ', 'tt'][menuSel]; screen = 'car'; menuSel = carIdx; blip(660, .08); }
    else if (k === 'back') { screen = 'title'; blip(330, .08); }
    return;
  }
  if (screen === 'car') {
    if (k === 'left') { carIdx = (carIdx + 3) % 4; CAR = CARS[carIdx]; menuMove(); }
    else if (k === 'right') { carIdx = (carIdx + 1) % 4; CAR = CARS[carIdx]; menuMove(); }
    else if (k === 'enter') { CAR = CARS[carIdx]; if (mode === 'champ') startChampionship(); else { screen = 'track'; menuSel = trackIdx; loadTrack(trackIdx); } blip(660, .08); }
    else if (k === 'back') { screen = 'mode'; menuSel = clamp(['quick', 'champ', 'tt'].indexOf(mode), 0, 2); blip(330, .08); }
    return;
  }
  if (screen === 'track') {
    if (k === 'left') { trackIdx = (trackIdx + TRACKS.length - 1) % TRACKS.length; loadTrack(trackIdx); menuMove(); }
    else if (k === 'right') { trackIdx = (trackIdx + 1) % TRACKS.length; loadTrack(trackIdx); menuMove(); }
    else if (k === 'enter') startRace();
    else if (k === 'back') { screen = 'car'; menuSel = carIdx; blip(330, .08); }
    return;
  }
  if (screen === 'results') { if (k === 'enter') resultsAdvance(); return; }
  if (screen === 'standings') { if (k === 'enter') standingsAdvance(); return; }
  if (screen === 'champion') { if (k === 'enter') { screen = 'title'; mode = 'quick'; } return; }
}
function onKeyUp(e) { var k = KEYMAP[e.code]; if (k) keys[k] = false; }
function clearKeys() { for (var k in keys) keys[k] = false; }
function resultsAdvance() { if (mode === 'champ') screen = 'standings'; else { screen = 'car'; menuSel = carIdx; } }
function standingsAdvance() { champRound++; if (champRound >= champOrder.length) screen = 'champion'; else { trackIdx = champOrder[champRound]; startRace(); } }

// ─────────────────────────────────────────────────────────── audio + music
var actx = null, master = null, sfxG = null, musG = null, engine = null, engineOn = false, muted = false, skidN = null;
function audioEnsure() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(actx.destination);
    sfxG = actx.createGain(); sfxG.gain.value = 0.9; sfxG.connect(master);
    musG = actx.createGain(); musG.gain.value = 0.5; musG.connect(master);
  } catch (e) { actx = null; }
}
function startEngine() { if (!actx || engineOn) return; var o1 = actx.createOscillator(), o2 = actx.createOscillator(), o3 = actx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'triangle'; var g = actx.createGain(); g.gain.value = 0; var lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; o1.connect(g); o2.connect(g); o3.connect(g); g.connect(lp); lp.connect(sfxG); o1.start(); o2.start(); o3.start(); engine = { o1: o1, o2: o2, o3: o3, g: g, lp: lp }; engineOn = true; }
function stopEngine() { if (!engine) return; try { engine.g.gain.value = 0; engine.o1.stop(); engine.o2.stop(); engine.o3.stop(); } catch (e) {} engine = null; engineOn = false; }
function updEngine() { if (!engine) return; var sp = speed / MAXSPD, gear = M.min(5, (sp * 6) | 0), rpm = sp * 6 - gear, base = 42 + gear * 10, freq = base + rpm * 90 + (boosting ? 30 : 0), t = actx.currentTime; engine.o1.frequency.setTargetAtTime(freq, t, .03); engine.o2.frequency.setTargetAtTime(freq * .5, t, .03); engine.o3.frequency.setTargetAtTime(freq * 2.01, t, .05); engine.lp.frequency.setTargetAtTime(500 + sp * 2600 + (boosting ? 1200 : 0), t, .05); engine.g.gain.setTargetAtTime((screen === 'race' && !paused && countdown <= 0) ? (0.05 + sp * 0.14 + (boosting ? 0.06 : 0)) : 0, t, .08); }
function noise(dur, vol, type, freq) { if (!actx) return; var n = actx.createBufferSource(), buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate), d = buf.getChannelData(0), i; for (i = 0; i < d.length; i++) d[i] = M.random() * 2 - 1; n.buffer = buf; var f = actx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 1400; f.Q.value = .8; var g = actx.createGain(); g.gain.value = vol; g.gain.setTargetAtTime(0, actx.currentTime + dur * .3, dur * .4); n.connect(f); f.connect(g); g.connect(sfxG); n.start(); n.stop(actx.currentTime + dur + .05); }
function setSkid(on, it) { if (!actx) return; if (on && !skidN) { var n = actx.createBufferSource(), buf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate), d = buf.getChannelData(0), i; for (i = 0; i < d.length; i++) d[i] = M.random() * 2 - 1; n.buffer = buf; n.loop = true; var f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 1.4; var g = actx.createGain(); g.gain.value = 0; n.connect(f); f.connect(g); g.connect(sfxG); n.start(); skidN = { n: n, g: g }; } if (skidN) skidN.g.gain.setTargetAtTime(on ? (0.05 + it * 0.1) : 0, actx.currentTime, .05); }
function blip(freq, dur, type) { if (!actx) return; var o = actx.createOscillator(); o.type = type || 'square'; o.frequency.value = freq; var g = actx.createGain(); g.gain.value = .16; g.gain.setTargetAtTime(0, actx.currentTime + .02, dur * .4); o.connect(g); g.connect(sfxG); o.start(); o.stop(actx.currentTime + dur); }
function blowoff() { noise(0.18, 0.26, 'highpass', 3000); }
function toggleMute() { muted = !muted; if (master && actx) master.gain.setTargetAtTime(muted ? 0 : 0.9, actx.currentTime, .05); flash = { text: muted ? 'MUTED' : 'SOUND ON', t: 1.0, c: '#c8b3dd' }; }

// procedural synthwave sequencer
var MUS = { on: false, next: 0, step: 0, tempo: 116, key: 45, prog: [0, 5, 3, -2], bright: 1 };
var MUSIC_CFG = {
  sunset: { tempo: 112, key: 45, prog: [0, 5, 3, -2], bright: 1.0 },
  night: { tempo: 128, key: 43, prog: [0, 3, -2, 5], bright: 1.25 },
  dawn: { tempo: 104, key: 48, prog: [0, 4, 5, 3], bright: 0.85 },
  canyon: { tempo: 120, key: 41, prog: [0, 5, -2, 3], bright: 1.1 }
};
function midiFreq(n) { return 440 * M.pow(2, (n - 69) / 12); }
function musicSet(th) { var cfg = MUSIC_CFG[th.music] || MUSIC_CFG.sunset; MUS.tempo = cfg.tempo; MUS.key = cfg.key; MUS.prog = cfg.prog; MUS.bright = cfg.bright; if (actx && !MUS.on) { MUS.on = true; MUS.next = actx.currentTime + 0.1; MUS.step = 0; } }
function musicStop() { MUS.on = false; }
function musicDuck(on) { if (musG && actx) musG.gain.setTargetAtTime(on ? 0.16 : 0.5, actx.currentTime, .1); }
function synth(type, freq, t, dur, vol, glideTo) {
  var o = actx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (glideTo) o.frequency.linearRampToValueAtTime(glideTo, t + dur * 0.9);
  var g = actx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(musG); o.start(t); o.stop(t + dur + 0.02);
}
function mnoise(t, dur, vol, freq) { var n = actx.createBufferSource(), buf = actx.createBuffer(1, actx.sampleRate * (dur + 0.02), actx.sampleRate), d = buf.getChannelData(0), i; for (i = 0; i < d.length; i++) d[i] = M.random() * 2 - 1; n.buffer = buf; var f = actx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq; var g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); n.connect(f); f.connect(g); g.connect(musG); n.start(t); n.stop(t + dur + 0.02); }
function kick(t) { var o = actx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); var g = actx.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); o.connect(g); g.connect(musG); o.start(t); o.stop(t + 0.18); }
function musicSchedule() {
  if (!MUS.on || !actx) return;
  if (MUS.next < actx.currentTime) { MUS.next = actx.currentTime + 0.05; MUS.step = 0; }   // resync after a tab-background gap; never burst-schedule the past
  var spb = 60 / MUS.tempo, sixteenth = spb / 4;
  var loud = (screen === 'race' && countdown <= 0 && !paused);
  while (MUS.next < actx.currentTime + 0.14) {
    var i = MUS.step, t = MUS.next;
    var chord = MUS.prog[(i / 8) | 0], root = MUS.key + chord;
    var scale = [0, 3, 5, 7, 10];
    if (i % 2 === 0) synth('sawtooth', midiFreq(root - 12), t, sixteenth * 1.9, 0.16);
    var deg = scale[(i * 3) % scale.length];
    synth(MUS.bright > 1.1 ? 'square' : 'triangle', midiFreq(root + 12 + deg), t, sixteenth * (loud ? 1.6 : 1.1), loud ? 0.09 : 0.05);
    if (i % 8 === 0 && loud) synth('sawtooth', midiFreq(root), t, spb * 1.8, 0.05);
    if (loud) {
      if (i % 8 === 0 || i % 8 === 4) kick(t);
      if (i % 8 === 4) mnoise(t, 0.16, 0.28, 1200);
      if (i % 2 === 0) mnoise(t, 0.03, 0.10 * MUS.bright, 8000);
    }
    MUS.next += sixteenth; MUS.step = (MUS.step + 1) % 32;
  }
}

// ─────────────────────────────────────────────────────────── particles + skids
function smoke(sx, sy, n, tint, spread) { spread = spread || 1; for (var i = 0; i < n; i++) particles.push({ x: sx + rnd(-6, 6) * spread, y: sy + rnd(-3, 3), vx: rnd(-14, 14) * spread, vy: rnd(-26, -6), life: rnd(.4, .9), max: .9, size: 2 + (M.random() * 2 | 0), tint: tint, g: 26 }); }
function spark(sx, sy, n) { for (var i = 0; i < n; i++) particles.push({ x: sx, y: sy, vx: rnd(-90, 90), vy: rnd(-90, 20), life: rnd(.2, .5), max: .5, size: 1 + (M.random() * 2 | 0), tint: pick(['#ffd06b', '#ff9350', '#fff2b0']), g: 120 }); }
function updParticles(dt) { for (var i = particles.length - 1; i >= 0; i--) { var p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 26) * dt; p.life -= dt; if (p.life <= 0) particles.splice(i, 1); } }
function addSkid(seg, x) { if (seg.skids.length < 4) seg.skids.push({ x: x, life: 3.2 }); }
function addShake(t, m) { shakeT = M.max(shakeT, t); shakeMag = m; }
function ageSkidsNear(dt) {
  var base = findSeg(position).index, i, seg, j;
  for (i = -30; i < DRAW; i++) {
    seg = segments[(((base + i) % segments.length) + segments.length) % segments.length];
    for (j = seg.skids.length - 1; j >= 0; j--) { seg.skids[j].life -= dt; if (seg.skids[j].life <= 0) seg.skids.splice(j, 1); }
  }
}

// ─────────────────────────────────────────────────────────── rivals AI
function updateRivals(dt) {
  var goal = laps * trackLength, i, r;
  for (i = 0; i < segments.length; i++) segments[i].cars.length = 0;
  for (i = 0; i < rivals.length; i++) {
    r = rivals[i];
    if (r.finish != null) { r.z = ((r.raceDist % trackLength) + trackLength) % trackLength; r.percent = pctRem(r.z, SEGLEN); r.braking = false; findSeg(r.z).cars.push(r); continue; }
    var here = ((r.raceDist % trackLength) + trackLength) % trackLength;
    var ahead = findSeg(here + PLAYER_Z * 2.2);
    r.targetOff = clamp(ahead.curve * 0.12, -0.7, 0.7);
    r.mistake -= dt; if (r.mistake < -2 && M.random() < 0.004 * (1.2 - r.skill)) { r.mistake = rnd(0.6, 1.4); r.mistErr = rnd(-0.6, 0.6); }
    var tgtOff = r.targetOff + (r.mistake > 0 ? r.mistErr : 0);
    var prevOff = r.offset; r.offset += (tgtOff - r.offset) * M.min(1, dt * 2.4);
    r.steer = clamp((r.offset - prevOff) * 40 + ahead.curve * 0.5, -1, 1);
    var gap = r.raceDist - raceDist, sk = r.skill;
    if (gap > 3500) sk -= 0.20 * DIFF.band; else if (gap > 1200) sk -= 0.10 * DIFF.band;
    else if (gap < -3500) sk += 0.16 / DIFF.band; else if (gap < -1200) sk += 0.08 / DIFF.band;
    var target = MAXSPD * clamp(sk, 0.5, 0.99);
    var bend = M.abs(ahead.curve);
    if (bend > C.M) target *= (1 - M.min(0.28, (bend - C.M) * 0.08));
    if (r.mistake > 0) target *= 0.82;
    r.braking = target < r.speed - MAXSPD * 0.02;
    if (r.speed < target) r.speed = M.min(target, r.speed + ACCEL * 0.94 * dt);
    else r.speed = M.max(target, r.speed - ACCEL * 1.3 * dt);
    r.raceDist += r.speed * dt;
    r.z = ((r.raceDist % trackLength) + trackLength) % trackLength;
    r.lap = M.min(laps, (r.raceDist / trackLength | 0) + 1);
    if (r.raceDist >= goal && r.finish == null) r.finish = raceTime;
    r.percent = pctRem(r.z, SEGLEN);
    findSeg(r.z).cars.push(r);
  }
}
function computePosition() {
  var better = 0, i; for (i = 0; i < rivals.length; i++) if (rivals[i].raceDist > raceDist) better++;
  var np = better + 1;
  if (np !== playerPos) { prevPos = playerPos; posArrowT = 1.2; }
  playerPos = np;
  var bestGap = 1e9; for (i = 0; i < rivals.length; i++) { var g = rivals[i].raceDist - raceDist; if (g > 0 && g < bestGap) bestGap = g; }
  gapAhead = bestGap < 1e9 ? bestGap / MAXSPD : 0;
}
function finishRace() {
  var youFin = raceTime;
  // count the final (flying) lap that the M.min(laps,...) clamp hides from the lap-change detector
  var flt = raceTime - lapStart;
  if (flt > 0) { if (bestLap === 0 || flt < bestLap) bestLap = flt; if (mode === 'tt' && (ttPlaying == null || flt < ttPlaying.time)) ttPlaying = { time: flt, samples: ttRecord.slice() }; }
  var board = [{ name: 'YOU', scheme: CAR.scheme, dist: raceDist, finish: youFin, you: true, lap: laps }];
  rivals.forEach(function (r) { board.push({ name: r.name, scheme: r.scheme, dist: r.raceDist, finish: r.finish, you: false, lap: r.lap }); });
  board.sort(function (a, b) { if (a.finish != null && b.finish != null) return a.finish - b.finish; if (a.finish != null) return -1; if (b.finish != null) return 1; return b.dist - a.dist; });
  board.forEach(function (e) { if (e.finish != null) e.disp = fmtTime(e.finish); else { var gp = (raceDist - e.dist) / (MAXSPD * 0.85); e.disp = '+' + gp.toFixed(1) + 'S'; } });
  var mine = 1; for (var mi = 0; mi < board.length; mi++) if (board[mi].you) { mine = mi + 1; break; }
  results = board; results.mine = mine; screen = 'results';
  stopEngine(); setSkid(false, 0); musicDuck(true);
  if (bestLap > 0) { var rk = keyOf('t' + trackIdx), rec = bestLaps[rk]; if (rec == null || bestLap < rec) { bestLaps[rk] = bestLap; lset('comp_racer_best', bestLaps); results.record = true; } }
  if (mode === 'tt' && ttPlaying && ttPlaying.time > 0 && (ttGhost == null || ttPlaying.time < ttGhost.time)) { ghosts[keyOf('t' + trackIdx)] = ttPlaying; lset('comp_racer_ghost', ghosts); }
  unlock('first');
  if (mode !== 'tt') {
    if (mine <= 3) unlock('podium');
    if (mine === 1) {
      unlock('win'); wonTracks[trackIdx] = 1; lset('comp_racer_won', wonTracks);
      wonCars[carIdx] = 1; lset('comp_racer_cars', wonCars);
      if (RAIN) unlock('storm');
      if (wonTracks[0] && wonTracks[1] && wonTracks[2] && wonTracks[3] && wonTracks[4]) unlock('grand');
      if (wonCars[0] && wonCars[1] && wonCars[2] && wonCars[3]) unlock('garage');
    }
    if (mode === 'champ') board.forEach(function (e, idx) { if (idx < PTS.length) champPts[e.name] = (champPts[e.name] || 0) + PTS[idx]; });
  }
  blip(880, .12); setTimeout(function () { blip(1174, .16); }, 130); setTimeout(function () { blip(1568, .22); }, 300);
}

// ─────────────────────────────────────────────────────────── update
function updateMenus(dt) { titleT += dt; hue = (hue + dt * 8) % 360; bgOffset += dt * 12; if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; } updEngine(); }
function update(dt) {
  if (screen !== 'race') { updateMenus(dt); return; }
  if (paused) { updEngine(); return; }

  if (countdown > 0) {
    var prev = M.ceil(countdown); countdown -= dt; speed = M.max(0, speed - MAXSPD * dt);
    var now = M.ceil(countdown);
    if (now !== prev) { if (now > 0) blip(520, .14, 'square'); else { blip(1046, .28, 'square'); flash = { text: 'GO!', t: .9, c: TH.accent }; addShake(.12, 2); startEngine(); lapStart = raceTime; musicDuck(false); } }
    if (mode !== 'tt') updateRivals(dt);
    updEngine(); return;
  }

  raceTime += dt;
  var carTop = MAXSPD * CAR.spd, carAcc = ACCEL * CAR.acc * DIFF.assist, grip = CAR.grip * DIFF.assist;
  var seg = findSeg(position + PLAYER_Z), spct = speed / carTop, dx = dt * 2.4 * spct * grip;

  if (mode !== 'tt') updateRivals(dt);

  boosting = keys.boost && nitro > 0.02 && speed > OFF_LIMIT * 0.4;
  var cap = carTop * (boosting ? NITRO_MULT : 1);
  if (keys.up) speed = accelV(speed, carAcc * (boosting ? 1.5 : 1), dt);
  else if (keys.down) speed = accelV(speed, BRAKING, dt);
  else speed = accelV(speed, DECEL, dt);
  if (keys.hand) speed = accelV(speed, BRAKING * 0.7, dt);

  var steering = 0;
  if (keys.left) { playerX -= dx; steering = -1; }
  if (keys.right) { playerX += dx; steering = 1; }
  playerX -= dx * spct * seg.curve * CENTRIF / grip;
  var sliding = keys.hand && speed > OFF_LIMIT;
  if (sliding) playerX += steering * dx * 1.6;

  var off = (playerX < -1 || playerX > 1);
  if (off) { if (speed > OFF_LIMIT) speed = accelV(speed, OFF_DECEL, dt); bounce = rnd(-1.2, 1.2) * spct; }
  else { bounce = interp(bounce, M.sin(position * .001) * .3 * spct, .1); if (RAIN && speed > OFF_LIMIT && M.abs(steering) > 0) playerX += steering * dx * 0.9; }

  for (var ci = 0; ci < seg.cars.length; ci++) {
    var car = seg.cars[ci];
    if (car.finish != null) continue;
    if (speed > car.speed && ovl(playerX, 0.5, car.offset, 0.42, 0.8)) {
      speed = car.speed * 0.6; addShake(.3, 5); smoke(WIDTH / 2, HEIGHT - 30, 12, '#ffb27a'); spark(WIDTH / 2, HEIGHT - 34, 10); noise(.22, .45, 'lowpass', 380); blip(120, .14, 'sawtooth'); break;
    }
  }

  speed = clamp(speed, 0, cap); playerX = clamp(playerX, -2.4, 2.4);
  raceDist += dt * speed; position = raceDist % trackLength;

  var targetSteer = clamp(steering - seg.curve * spct * 0.6, -1, 1);
  steer = interp(steer, targetSteer, .18);

  if (boosting) nitro = clamp(nitro - dt * (0.42 / CAR.nos), 0, 1);
  else if (!off) nitro = clamp(nitro + dt * 0.14, 0, 1);
  if (boosting && nitro <= 0.001) unlock('redline');
  if (wasBoost && !boosting && speed > OFF_LIMIT) blowoff();
  wasBoost = boosting;

  var lap = M.min(laps, (raceDist / trackLength | 0) + 1);
  if (lap !== playerLap) {
    var lt = raceTime - lapStart; if (bestLap === 0 || lt < bestLap) bestLap = lt;
    if (mode === 'tt') { if (ttPlaying == null || lt < ttPlaying.time) ttPlaying = { time: lt, samples: ttRecord.slice() }; ttRecord = []; }
    lapStart = raceTime;
    if (lap <= laps) { flash = { text: 'LAP ' + lap + ' / ' + laps, t: 1.3, c: '#ffd06b' }; blip(740, .1); }
    playerLap = lap;
  }
  if (mode !== 'tt') computePosition();
  if (mode === 'tt') { var lts = raceTime - lapStart; if (ttRecord.length === 0 || lts - ttRecord[ttRecord.length - 1][0] > 0.08) ttRecord.push([lts, position, playerX]); }

  if (raceDist >= laps * trackLength) { finishRace(); return; }

  var hard = M.abs(steering) > 0 && spct > 0.6;
  if (off && spct > 0.25 && M.random() < 0.6) smoke(WIDTH / 2 + rnd(-24, 24), HEIGHT - 24, 2, TH.scenery === 'canyon' ? '#c98a5a' : '#caa06a', 1.4);
  if ((sliding || hard) && spct > 0.5) { if (M.random() < 0.5) smoke(WIDTH / 2 + steer * 20, HEIGHT - 22, 2, '#e9e9f2'); addSkid(seg, playerX); }
  if (boosting && M.random() < 0.8) smoke(WIDTH / 2 + rnd(-18, 18), HEIGHT - 18, 2, pick(['#ff9350', '#e85c6f', '#ffd06b']));
  updParticles(dt);
  ageSkidsNear(dt);
  setSkid((off && spct > 0.3) || (sliding && spct > 0.5), spct);
  if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
  if (posArrowT > 0) posArrowT -= dt;
  bgOffset += seg.curve * spct * 0.6;
  if (shakeT > 0) shakeT -= dt;
  hue = (hue + dt * 8) % 360;
  updEngine();
}

// ─────────────────────────────────────────────────────────── render (road)
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
function renderStrip(x1, y1, w1, x2, y2, w2, col, wet) {
  var r1 = rumbleW(w1), r2 = rumbleW(w2), l1 = laneW(w1), l2 = laneW(w2);
  ctx.fillStyle = col.grass; ctx.fillRect(0, y2, WIDTH, y1 - y2);
  poly(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, col.rumble);
  poly(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, col.rumble);
  poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, col.road);
  if (col.lane) { var lw1 = w1 * 2 / LANES, lw2 = w2 * 2 / LANES, lx1 = x1 - w1 + lw1, lx2 = x2 - w2 + lw2, lane; for (lane = 1; lane < LANES; lx1 += lw1, lx2 += lw2, lane++) poly(lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, col.lane); }
  if (wet) poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, 'rgba(120,150,200,0.09)');
}
function renderSprite(sprite, scale, dx, dy, ox, oy, clipY) {
  var dw = sprite.w * scale * (WIDTH / 2) * SPR_SCALE * ROAD_W, dh = sprite.h * scale * (WIDTH / 2) * SPR_SCALE * ROAD_W;
  dx = dx + dw * (ox || 0); dy = dy + dh * (oy || 0);
  var clipH = clipY ? M.max(0, dy + dh - clipY) : 0;
  if (clipH < dh && dw >= 1 && dh >= 1) ctx.drawImage(sprite.canvas || sprite, 0, 0, sprite.w, sprite.h * (1 - clipH / dh), M.round(dx), M.round(dy), M.round(dw), M.round(dh - clipH));
}
function renderRoad(camPos, playerX_) {
  var baseSeg = findSeg(camPos), basePct = pctRem(camPos, SEGLEN);
  var pSeg = findSeg(camPos + PLAYER_Z), pPct = pctRem(camPos + PLAYER_Z, SEGLEN);
  var pY = interp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);
  var horizonY = M.round(HEIGHT * 0.42 + pY * 0.00002 * HEIGHT);
  renderBG(clamp(horizonY, HEIGHT * 0.28, HEIGHT * 0.55));
  var maxy = HEIGHT, x = 0, dx = -(baseSeg.curve * basePct), n, seg, looped, col;
  for (n = 0; n < DRAW; n++) {
    seg = segments[(baseSeg.index + n) % segments.length]; looped = seg.index < baseSeg.index; seg.looped = looped;
    seg.fog = fog(n / DRAW, FOGD); seg.clip = maxy;
    project(seg.p1, playerX_ * ROAD_W - x, pY + CAM_H, camPos - (looped ? trackLength : 0));
    project(seg.p2, playerX_ * ROAD_W - x - dx, pY + CAM_H, camPos - (looped ? trackLength : 0));
    x += dx; dx += seg.curve;
    if (seg.p1.camera.z <= CAM_D || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
    col = segColors(seg);
    renderStrip(seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.w, seg.p2.screen.x, seg.p2.screen.y, seg.p2.screen.w, col, RAIN);
    if (seg.skids.length) { for (var kk = 0; kk < seg.skids.length; kk++) { var sk = seg.skids[kk]; var sxk = seg.p1.screen.x + seg.p1.screen.scale * sk.x * ROAD_W * WIDTH / 2; var ww = M.max(1, seg.p1.screen.w * 0.05); ctx.globalAlpha = clamp(sk.life / 3.2, 0, 1) * 0.5; ctx.fillStyle = '#15121a'; ctx.fillRect(M.round(sxk - seg.p1.screen.w * 0.12 - ww), seg.p2.screen.y, M.round(ww), seg.p1.screen.y - seg.p2.screen.y); ctx.fillRect(M.round(sxk + seg.p1.screen.w * 0.12), seg.p2.screen.y, M.round(ww), seg.p1.screen.y - seg.p2.screen.y); ctx.globalAlpha = 1; } }
    if (seg.fog < 1) { ctx.globalAlpha = 1 - seg.fog; ctx.fillStyle = TH.fogc; ctx.fillRect(0, seg.p2.screen.y, WIDTH, seg.p1.screen.y - seg.p2.screen.y); ctx.globalAlpha = 1; }
    maxy = seg.p2.screen.y;
  }
  for (n = DRAW - 1; n > 0; n--) {
    seg = segments[(baseSeg.index + n) % segments.length];
    var ci, s, sc, sx, sy;
    for (ci = 0; ci < seg.cars.length; ci++) {
      var c = seg.cars[ci]; sc = interp(seg.p1.screen.scale, seg.p2.screen.scale, c.percent);
      sx = interp(seg.p1.screen.x, seg.p2.screen.x, c.percent) + sc * c.offset * ROAD_W * WIDTH / 2;
      sy = interp(seg.p1.screen.y, seg.p2.screen.y, c.percent);
      var cw = sc * (WIDTH / 2) * SPR_SCALE * ROAD_W * 90;
      if (cw >= 3 && sy < seg.clip) drawCar(ctx, sx, sy, cw, c.scheme, c.steer || 0, c.braking, null);
    }
    for (ci = 0; ci < seg.sprites.length; ci++) { s = seg.sprites[ci]; sc = seg.p1.screen.scale; sx = seg.p1.screen.x + sc * s.offset * ROAD_W * WIDTH / 2; sy = seg.p1.screen.y; renderSprite(s.source, sc, sx, sy, (s.offset < 0 ? -1 : 0), -1, seg.clip); }
  }
}

// ─────────────────────────────────────────────────────────── render (frame)
function render(alpha) {
  var camPos = (screen === 'race' && !paused && countdown <= 0) ? position + speed * (alpha || 0) : position;
  if (trackLength) camPos %= trackLength;   // keep the interpolated camera inside the loop so the road never blanks at a lap crossing
  ctx.save();
  if (shakeT > 0) ctx.translate(rnd(-1, 1) * shakeMag, rnd(-1, 1) * shakeMag);

  if (screen === 'race' || screen === 'results') {
    renderRoad(camPos, playerX);
    if (mode === 'tt' && ttGhost && screen === 'race') renderGhost(camPos);
    var p, a; for (var n = 0; n < particles.length; n++) { p = particles[n]; a = clamp(p.life / p.max, 0, 1); ctx.globalAlpha = a * 0.85; ctx.fillStyle = p.tint || '#e9e9f2'; ctx.fillRect(M.round(p.x), M.round(p.y), p.size, p.size); } ctx.globalAlpha = 1;
    if (screen === 'race') renderPlayer();
    var spct = speed / (MAXSPD * CAR.spd);
    if (screen === 'race' && (spct > 0.75 || boosting)) {
      var lines = boosting ? 18 : 8, cx2 = WIDTH / 2, cy2 = HEIGHT * 0.62, ii, ang, r0, r1;
      ctx.strokeStyle = boosting ? 'rgba(255,190,120,0.5)' : 'rgba(255,255,255,0.26)'; ctx.lineWidth = 1;
      for (ii = 0; ii < lines; ii++) { ang = (ii / lines) * 6.2832 + hue * 0.02; r0 = 40 + ((ii * 13) % 30); r1 = r0 + 20 + spct * 40; ctx.beginPath(); ctx.moveTo(cx2 + M.cos(ang) * r0, cy2 + M.sin(ang) * r0); ctx.lineTo(cx2 + M.cos(ang) * r1, cy2 + M.sin(ang) * r1); ctx.stroke(); }
    }
    if (RAIN && screen === 'race') renderRain();
  } else {
    renderRoad(camPos, M.sin(titleT * 0.6) * 0.15);
  }
  ctx.restore();

  if (screen === 'title') renderTitle();
  else if (screen === 'mode') renderMode();
  else if (screen === 'car') renderCarSelect();
  else if (screen === 'track') renderTrackSelect();
  else if (screen === 'race') { renderHUD(); if (countdown > 0) renderCountdown(); if (paused) renderPaused(); }
  else if (screen === 'results') renderResults();
  else if (screen === 'standings') renderStandings();
  else if (screen === 'champion') renderChampion();
  renderFX();
}
function renderPlayer() {
  var spct = speed / (MAXSPD * CAR.spd), bob = M.sin(position * .02) * (0.6 + spct * 1.4) + bounce * 3, baseY = HEIGHT - 8 + bob, cx = WIDTH / 2 + steer * 10, w = 78 + spct * 4;
  if (boosting) { [-11, 11].forEach(function (dxo) { var fl = 6 + rnd(0, 10); ctx.globalAlpha = .85; ctx.fillStyle = '#fff2b0'; ctx.fillRect(cx + dxo - 2, baseY - 3, 4, fl * .5); ctx.globalAlpha = .7; ctx.fillStyle = pick(['#ff9350', '#ffd06b', '#e85c6f']); ctx.fillRect(cx + dxo - 3, baseY - 2, 6, fl); }); ctx.globalAlpha = 1; }
  drawCar(ctx, cx, baseY, w, CAR.scheme, steer, keys.down || keys.hand);
}
function renderGhost(camPos) {
  if (!ttGhost || !ttGhost.samples || !ttGhost.samples.length) return;
  var lt = raceTime - lapStart, s = ttGhost.samples, i, a = s[0], b = s[s.length - 1];
  for (i = 0; i < s.length - 1; i++) { if (s[i][0] <= lt && s[i + 1][0] >= lt) { a = s[i]; b = s[i + 1]; break; } }
  var f = (b[0] - a[0]) > 0 ? clamp((lt - a[0]) / (b[0] - a[0]), 0, 1) : 0;
  var gz = interp(a[1], b[1], f), gx = interp(a[2], b[2], f);
  var rel = ((gz - camPos) % trackLength + trackLength) % trackLength;
  if (rel > SEGLEN * (DRAW - 2) || rel < 40) return;
  var seg = findSeg(camPos + rel), pct = pctRem(camPos + rel, SEGLEN);
  var sc = interp(seg.p1.screen.scale || 0, seg.p2.screen.scale || 0, pct);
  if (!sc) return;
  var sx = interp(seg.p1.screen.x, seg.p2.screen.x, pct) + sc * gx * ROAD_W * WIDTH / 2, sy = interp(seg.p1.screen.y, seg.p2.screen.y, pct);
  var w = sc * (WIDTH / 2) * SPR_SCALE * ROAD_W * 90;
  if (w >= 3) drawCar(ctx, sx, sy, w, { body: '#8fa8d0', roof: '#6f86b0', glass: '#20222e', dark: '#4a5a7a', hi: '#c8d8f0' }, 0, false, 0.32);
}
function renderRain() {
  ctx.strokeStyle = 'rgba(150,180,230,0.35)'; ctx.lineWidth = 1;
  if (rainDrops.length < 90) for (var q = rainDrops.length; q < 90; q++) rainDrops.push([M.random() * WIDTH, M.random() * HEIGHT, rnd(6, 12)]);
  for (var i = 0; i < rainDrops.length; i++) { var d = rainDrops[i]; ctx.beginPath(); ctx.moveTo(d[0], d[1]); ctx.lineTo(d[0] - 2, d[1] + d[2]); ctx.stroke(); d[1] += 22 + speed / MAXSPD * 30; d[0] -= 3; if (d[1] > HEIGHT) { d[1] = -d[2]; d[0] = M.random() * WIDTH; } }
}

// ─────────────────────────────────────────────────────────── HUD + menus
function panel(x, y, w, h) { ctx.fillStyle = 'rgba(16,10,30,0.62)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = 'rgba(233,86,139,0.5)'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); }
function bannerBG(al) { ctx.fillStyle = 'rgba(10,7,19,' + (al == null ? 0.72 : al) + ')'; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
function revBar(x, y, w, pct, col) { ctx.fillStyle = '#241633'; ctx.fillRect(x, y, w, 4); var seg = w / 12, i; for (i = 0; i < 12; i++) if (i / 12 < pct) { ctx.fillStyle = i > 9 ? '#ff5a5a' : (i > 7 ? '#ffd06b' : col); ctx.fillRect(x + i * seg, y, seg - 1, 4); } }
function renderHUD() {
  panel(4, 4, 128, 36);
  if (mode === 'tt') {
    text(ctx, 'TIME TRIAL', 10, 9, 1, '#31e6d0');
    text(ctx, 'LAP', 10, 25, 1, '#9a7bb5'); text(ctx, playerLap + '/' + laps, 34, 24, 2, '#c8b3dd');
    var recT = bestLaps[keyOf('t' + trackIdx)];
    if (recT != null) text(ctx, 'REC ' + fmtTime(recT), 74, 26, 1, '#9a7bb5');
    else text(ctx, 'SET A TIME', 74, 26, 1, '#6f5a86');
  } else {
    text(ctx, 'POS', 10, 9, 1, TH.accent); text(ctx, playerPos + '/' + (N_RIVALS + 1), 34, 8, 2, '#fff');
    if (posArrowT > 0) { var up = playerPos < prevPos, ay = 9; ctx.fillStyle = up ? '#5ee6a0' : '#ff6a6a'; if (up) { ctx.fillRect(74, ay + 2, 5, 3); ctx.fillRect(75, ay, 3, 3); ctx.fillRect(76, ay - 1, 1, 2); } else { ctx.fillRect(74, ay, 5, 3); ctx.fillRect(75, ay + 3, 3, 2); ctx.fillRect(76, ay + 5, 1, 2); } }
    text(ctx, 'LAP', 10, 25, 1, '#9a7bb5'); text(ctx, playerLap + '/' + laps, 34, 24, 2, '#c8b3dd');
    if (gapAhead > 0 && gapAhead < 9) text(ctx, '+' + gapAhead.toFixed(1), 84, 25, 1, '#9a7bb5');
  }
  text(ctx, mode === 'champ' ? 'ROUND ' + (champRound + 1) + '/' + champOrder.length : 'TIME', WIDTH / 2, 6, 1, '#9a7bb5', { align: 'center' });
  text(ctx, fmtTime(raceTime), WIDTH / 2, 15, 2, '#ffe98a', { align: 'center', shadow: '#00000088' });
  panel(WIDTH - 150, 4, 146, 36);
  var carTop = MAXSPD * CAR.spd, kmh = M.round(speed / carTop * 312), gear = clamp((speed / carTop * 6 | 0) + 1, 1, 6), spct = speed / carTop;
  text(ctx, pad(kmh, 3), WIDTH - 10, 8, 3, boosting ? '#ffb27a' : '#fff', { align: 'right', shadow: '#00000088' });
  text(ctx, 'KMH', WIDTH - 10, 30, 1, '#9a7bb5', { align: 'right' });
  text(ctx, 'G' + gear, WIDTH - 146, 8, 1, TH.accent);
  revBar(WIDTH - 146, 18, 60, clamp(spct, 0, 1), TH.accent);
  panel(6, HEIGHT - 18, 120, 12);
  text(ctx, 'NITRO', 10, HEIGHT - 15, 1, '#2ec5c0');
  var nw = 66; ctx.fillStyle = '#10241f'; ctx.fillRect(52, HEIGHT - 15, nw, 6);
  ctx.fillStyle = boosting ? '#ffd06b' : '#2ec5c0'; ctx.fillRect(52, HEIGHT - 15, M.round(nw * nitro), 6);
  for (var i = 1; i < 6; i++) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(52 + M.round(nw * i / 6), HEIGHT - 15, 1, 6); }
  if (bestLap > 0) { panel(WIDTH - 128, HEIGHT - 18, 122, 12); text(ctx, 'BEST', WIDTH - 124, HEIGHT - 15, 1, '#9a7bb5'); text(ctx, fmtTime(bestLap), WIDTH - 8, HEIGHT - 15, 1, '#ffd06b', { align: 'right' }); }
  if (flash) { ctx.globalAlpha = clamp(flash.t / 1.3, 0, 1); text(ctx, flash.text, WIDTH / 2, HEIGHT * 0.30, 2, flash.c || '#ffd06b', { align: 'center', shadow: '#00000099' }); ctx.globalAlpha = 1; }
}
function renderCountdown() { var n = M.ceil(countdown), frac = countdown - (n - 1), pop = frac > 0.72 ? (frac - 0.72) / 0.28 : 0, s = M.round(10 + pop * 6); text(ctx, 'GET READY', WIDTH / 2, HEIGHT * 0.20, 2, '#e6e8f0', { align: 'center', shadow: '#000' }); text(ctx, '' + n, WIDTH / 2, HEIGHT * 0.30, s, '#ffd06b', { align: 'center', shadow: TH.accent }); }
function renderPaused() { bannerBG(); text(ctx, 'PAUSED', WIDTH / 2, HEIGHT * 0.40, 4, '#ffd06b', { align: 'center', shadow: '#000' }); text(ctx, 'P OR ESC TO RESUME   M TO MUTE', WIDTH / 2, HEIGHT * 0.58, 1, '#c8b3dd', { align: 'center' }); }
function logo(cy) { var wob = M.sin(titleT * 2) * 1.5; text(ctx, 'SUNSET', WIDTH / 2, cy, 5, '#ffd06b', { align: 'center', shadow: '#a83a76' }); text(ctx, 'RUNNER', WIDTH / 2 + wob, cy + HEIGHT * 0.14, 5, TH.accent, { align: 'center', shadow: '#5c2668' }); }
function renderTitle() {
  bannerBG(0.62); logo(HEIGHT * 0.16);
  if (((perfNow() / 400) | 0) % 2) text(ctx, 'PRESS ENTER', WIDTH / 2, HEIGHT * 0.58, 2, '#fff', { align: 'center' });
  text(ctx, 'A PSEUDO-3D PIXEL RACER', WIDTH / 2, HEIGHT * 0.72, 1, '#c8b3dd', { align: 'center' });
  text(ctx, 'ARROWS  ENTER  SHIFT NITRO  SPACE DRIFT  M MUTE', WIDTH / 2, HEIGHT * 0.84, 1, '#9a7bb5', { align: 'center' });
  var a = steamAch(); text(ctx, a.n + '/' + a.total + ' ACHIEVEMENTS', WIDTH / 2, HEIGHT * 0.92, 1, '#6f5a86', { align: 'center' });
}
function menuItem(label, y, sel) {
  var c = sel ? '#fff' : '#8a76a5';
  if (sel) { ctx.fillStyle = 'rgba(233,86,139,0.18)'; ctx.fillRect(WIDTH / 2 - 130, y - 4, 260, 22); ctx.fillStyle = TH.accent; ctx.fillRect(WIDTH / 2 - 130, y - 4, 3, 22); }
  text(ctx, (sel ? '> ' : '  ') + label, WIDTH / 2 - 116, y, 2, c);
}
function renderMode() {
  bannerBG(0.66); logo(HEIGHT * 0.07);
  var modes = [['QUICK RACE', 'One race, your pick of track'], ['CHAMPIONSHIP', 'All 5 circuits, points, a title'], ['TIME TRIAL', 'Solo vs your ghost']];
  if (menuSel < 0 || menuSel > 2) menuSel = 0;
  var y0 = HEIGHT * 0.42;
  for (var i = 0; i < 3; i++) menuItem(modes[i][0], y0 + i * 26, menuSel === i);
  text(ctx, modes[menuSel][1], WIDTH / 2, HEIGHT * 0.78, 1, '#c8b3dd', { align: 'center' });
  ctx.fillStyle = 'rgba(16,10,30,0.6)'; ctx.fillRect(WIDTH / 2 - 90, HEIGHT * 0.85, 180, 18);
  text(ctx, '< DIFFICULTY: ' + DIFF.name + ' >', WIDTH / 2, HEIGHT * 0.865, 1, '#ffd06b', { align: 'center' });
  text(ctx, 'ESC BACK', 8, HEIGHT - 12, 1, '#6f5a86');
}
function statBar(x, y, label, v) { text(ctx, label, x, y, 1, '#9a7bb5'); var bx = x + 26, bw = 70; ctx.fillStyle = '#241633'; ctx.fillRect(bx, y, bw, 5); var f = clamp((v - 0.82) / 0.5, 0.1, 1); ctx.fillStyle = TH.accent; ctx.fillRect(bx, y, M.round(bw * f), 5); }
function renderCarSelect() {
  bannerBG(0.72);
  text(ctx, 'SELECT CAR', WIDTH / 2, HEIGHT * 0.06, 3, '#ffd06b', { align: 'center', shadow: '#a83a76' });
  var car = CARS[carIdx], bob = M.sin(titleT * 3) * 2;
  drawCar(ctx, WIDTH / 2, HEIGHT * 0.5 + bob, 120, car.scheme, M.sin(titleT * 1.5) * 0.4, false);
  text(ctx, '< ' + car.name + ' >', WIDTH / 2, HEIGHT * 0.56, 2, '#fff', { align: 'center' });
  var sx = WIDTH / 2 - 60, sy = HEIGHT * 0.66;
  statBar(sx, sy, 'SPD', car.spd); statBar(sx, sy + 10, 'ACC', car.acc); statBar(sx, sy + 20, 'GRP', car.grip); statBar(sx, sy + 30, 'NOS', car.nos);
  text(ctx, car.blurb, WIDTH / 2, HEIGHT * 0.90, 1, '#c8b3dd', { align: 'center' });
  if (((perfNow() / 400) | 0) % 2) text(ctx, mode === 'champ' ? 'ENTER TO START SEASON' : 'ENTER', WIDTH - 8, HEIGHT - 12, 1, '#fff', { align: 'right' });
  text(ctx, 'ESC BACK', 8, HEIGHT - 12, 1, '#6f5a86');
}
function renderTrackSelect() {
  bannerBG(0.5);
  text(ctx, 'SELECT TRACK', WIDTH / 2, HEIGHT * 0.08, 3, '#ffd06b', { align: 'center', shadow: '#a83a76' });
  var t = TRACKS[trackIdx];
  ctx.fillStyle = 'rgba(16,10,30,0.66)'; ctx.fillRect(WIDTH / 2 - 140, HEIGHT * 0.44, 280, 48);
  ctx.fillStyle = TH.accent; ctx.fillRect(WIDTH / 2 - 140, HEIGHT * 0.44, 280, 2);
  text(ctx, '< ' + t.name + ' >', WIDTH / 2, HEIGHT * 0.47, 2, '#fff', { align: 'center' });
  text(ctx, t.laps + ' LAPS   ' + (N_RIVALS + 1) + ' CARS' + (t.rain ? '   RAIN' : ''), WIDTH / 2, HEIGHT * 0.61, 1, '#c8b3dd', { align: 'center' });
  var rec = bestLaps[keyOf('t' + trackIdx)];
  if (rec != null) text(ctx, 'YOUR RECORD  ' + fmtTime(rec), WIDTH / 2, HEIGHT * 0.68, 1, '#9a7bb5', { align: 'center' });
  for (var i = 0; i < TRACKS.length; i++) { ctx.fillStyle = i === trackIdx ? TH.accent : '#4a3a5a'; ctx.fillRect(WIDTH / 2 - (TRACKS.length * 8) / 2 + i * 8, HEIGHT * 0.74, 6, 6); }
  if (((perfNow() / 400) | 0) % 2) text(ctx, 'ENTER TO RACE', WIDTH / 2, HEIGHT * 0.84, 2, '#fff', { align: 'center' });
  text(ctx, 'ESC BACK', 8, HEIGHT - 12, 1, '#6f5a86');
}
function renderResults() {
  bannerBG();
  if (mode === 'tt') {
    text(ctx, 'TIME TRIAL', WIDTH / 2, HEIGHT * 0.14, 3, '#31e6d0', { align: 'center', shadow: '#000' });
    text(ctx, 'BEST LAP', WIDTH / 2, HEIGHT * 0.36, 2, '#9a7bb5', { align: 'center' });
    text(ctx, fmtTime(bestLap), WIDTH / 2, HEIGHT * 0.44, 3, '#ffd06b', { align: 'center', shadow: '#000' });
    if (results && results.record) text(ctx, 'NEW RECORD!', WIDTH / 2, HEIGHT * 0.60, 2, '#2ec5c0', { align: 'center' });
    else text(ctx, TRACKS[trackIdx].name + '  ' + CAR.name, WIDTH / 2, HEIGHT * 0.60, 1, '#c8b3dd', { align: 'center' });
  } else {
    var mine = results ? results.mine : 1;
    var head = mine === 1 ? 'YOU WON!' : (mine <= 3 ? 'PODIUM  P' + mine : 'P' + mine + '/' + (N_RIVALS + 1));
    text(ctx, head, WIDTH / 2, HEIGHT * 0.07, 3, mine === 1 ? '#ffd06b' : (mine <= 3 ? '#2ec5c0' : '#ff8a8a'), { align: 'center', shadow: '#000' });
    var y = HEIGHT * 0.26, i, r, rowc;
    if (results) for (i = 0; i < results.length; i++) {
      r = results[i]; rowc = r.you ? '#ffd06b' : '#c8b3dd';
      ctx.fillStyle = r.scheme.body; ctx.fillRect(WIDTH / 2 - 120, y - 1, 8, 8);
      text(ctx, (i + 1) + '', WIDTH / 2 - 106, y, 1, rowc); text(ctx, r.name, WIDTH / 2 - 88, y, 1, rowc);
      if (mode === 'champ') text(ctx, '+' + (PTS[i] || 0), WIDTH / 2 + 40, y, 1, '#5ee6a0');
      text(ctx, r.disp, WIDTH / 2 + 118, y, 1, rowc, { align: 'right' }); y += 12;
    }
    if (bestLap > 0) text(ctx, (results && results.record ? 'NEW RECORD  ' : 'BEST LAP  ') + fmtTime(bestLap), WIDTH / 2, HEIGHT * 0.80, 1, (results && results.record) ? '#2ec5c0' : '#9a7bb5', { align: 'center' });
  }
  if (justUnlocked.length) text(ctx, 'UNLOCKED  ' + justUnlocked.join('   '), WIDTH / 2, HEIGHT * 0.86, 1, '#ffd06b', { align: 'center' });
  if (((perfNow() / 400) | 0) % 2) text(ctx, mode === 'champ' ? 'ENTER FOR STANDINGS' : 'ENTER TO CONTINUE', WIDTH / 2, HEIGHT * 0.92, 1, '#fff', { align: 'center' });
}
function standingsList() { var names = Object.keys(champPts); names.sort(function (a, b) { return champPts[b] - champPts[a]; }); return names; }
function renderStandings() {
  bannerBG();
  text(ctx, 'STANDINGS', WIDTH / 2, HEIGHT * 0.08, 3, '#ffd06b', { align: 'center', shadow: '#a83a76' });
  text(ctx, 'AFTER ' + TRACKS[champOrder[champRound]].name, WIDTH / 2, HEIGHT * 0.20, 1, '#9a7bb5', { align: 'center' });
  var names = standingsList(), y = HEIGHT * 0.30, i;
  for (i = 0; i < names.length; i++) { var rowc = names[i] === 'YOU' ? '#ffd06b' : '#c8b3dd'; text(ctx, (i + 1) + '', WIDTH / 2 - 110, y, 1, rowc); text(ctx, names[i], WIDTH / 2 - 92, y, 1, rowc); text(ctx, champPts[names[i]] + ' PTS', WIDTH / 2 + 110, y, 1, rowc, { align: 'right' }); y += 13; }
  if (((perfNow() / 400) | 0) % 2) text(ctx, champRound + 1 >= champOrder.length ? 'ENTER FOR FINALE' : 'ENTER FOR NEXT RACE', WIDTH / 2, HEIGHT * 0.90, 1, '#fff', { align: 'center' });
}
function renderChampion() {
  bannerBG(0.8);
  var names = standingsList(), youPos = names.indexOf('YOU') + 1;
  if (youPos === 1) unlock('champion');
  text(ctx, youPos === 1 ? 'CHAMPION!' : 'SEASON OVER', WIDTH / 2, HEIGHT * 0.12, 4, youPos === 1 ? '#ffd06b' : '#c8b3dd', { align: 'center', shadow: '#a83a76' });
  text(ctx, 'YOU FINISHED P' + youPos + ' OF ' + names.length, WIDTH / 2, HEIGHT * 0.34, 2, youPos === 1 ? '#2ec5c0' : '#ff8a8a', { align: 'center' });
  var y = HEIGHT * 0.46, i;
  for (i = 0; i < M.min(3, names.length); i++) { var rowc = names[i] === 'YOU' ? '#ffd06b' : '#c8b3dd'; text(ctx, (i + 1) + '  ' + names[i], WIDTH / 2 - 60, y, 2, rowc); text(ctx, champPts[names[i]] + '', WIDTH / 2 + 70, y + 2, 1, rowc, { align: 'right' }); y += 20; }
  if (((perfNow() / 400) | 0) % 2) text(ctx, 'ENTER FOR TITLE', WIDTH / 2, HEIGHT * 0.90, 1, '#fff', { align: 'center' });
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
function fit() { if (!content || !canvas) return; var cw = content.clientWidth || WIDTH, ch = content.clientHeight || HEIGHT; var s = M.max(1, M.min(cw / WIDTH, ch / HEIGHT)); canvas.style.width = M.floor(WIDTH * s) + 'px'; canvas.style.height = M.floor(HEIGHT * s) + 'px'; }
function frame(now) {
  if (!running) return;
  rafId = window.requestAnimationFrame(frame);
  var dt = M.min(0.05, (now - lastT) / 1000); lastT = now; acc += dt;
  var guard = 0; while (acc >= STEP && guard < 6) { update(STEP); acc -= STEP; guard++; } if (guard >= 6) acc = 0;
  musicSchedule();
  render(acc);
}
function render_html() {
  return '<div class="racer-root" tabindex="0" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#07050f;outline:none;overflow:hidden">' +
    '<canvas class="racer-cv" width="' + WIDTH + '" height="' + HEIGHT + '" style="image-rendering:pixelated;image-rendering:crisp-edges;box-shadow:0 0 40px rgba(224,86,139,.2)"></canvas></div>';
}
function init(el) {
  root = el.querySelector('.racer-root') || el;
  content = el.querySelector('.win-content') || root;
  canvas = root.querySelector('.racer-cv'); ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  mounted = true; screen = 'title'; mode = 'quick'; carIdx = 0; CAR = CARS[0]; diffIdx = 1; DIFF = DIFFS[1]; trackIdx = 0; loadTrack(0);
  focused = false;
  root.addEventListener('focus', function () { focused = true; }, true);
  root.addEventListener('blur', function () { focused = false; clearKeys(); }, true);
  root.addEventListener('pointerdown', function () { root.focus(); audioEnsure(); if (!MUS.on) musicSet(TH); });
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  if (window.ResizeObserver) { ro = new ResizeObserver(fit); ro.observe(content); } else window.addEventListener('resize', fit);
  fit(); try { root.focus(); } catch (e) {}
  startedAt = perfNow(); running = true; lastT = perfNow(); acc = 0;
  render(0);
  rafId = window.requestAnimationFrame(frame);
}
function pause() { if (!running) return; running = false; window.cancelAnimationFrame(rafId); stopEngine(); setSkid(false, 0); musicStop(); bankedSecs += (perfNow() - startedAt) / 1000; }
function resume() { if (running || !mounted) return; running = true; startedAt = perfNow(); lastT = perfNow(); acc = 0; if (actx) musicSet(TH); if (screen === 'race' && countdown <= 0 && !paused) startEngine(); rafId = window.requestAnimationFrame(frame); }
function close() {
  if (running) bankedSecs += (perfNow() - startedAt) / 1000;
  running = false; window.cancelAnimationFrame(rafId); stopEngine(); setSkid(false, 0); musicStop();
  if (skidN) { try { skidN.n.stop(); } catch (e) {} skidN = null; }   // tear down the looping skid source, do not leak it for the page lifetime
  window.removeEventListener('keydown', onKeyDown, true); window.removeEventListener('keyup', onKeyUp, true);
  if (ro) { try { ro.disconnect(); } catch (e) {} ro = null; } else window.removeEventListener('resize', fit);
  mounted = false; focused = false; clearKeys();
  var hrs = bankedSecs / 3600; bankedSecs = 0; return hrs;
}

// headless / test hooks
var _dbg = {
  setMode: function (m) { mode = m; }, setCar: function (i) { carIdx = i | 0; CAR = CARS[carIdx]; }, setDiff: function (i) { diffIdx = i | 0; DIFF = DIFFS[diffIdx]; }, setTrack: function (i) { trackIdx = i | 0; loadTrack(trackIdx); },
  go: function (s) { screen = s; }, menu: function (i) { menuSel = i | 0; },
  startRace: function (skipCd) { startRace(); if (skipCd) countdown = 0; },
  startChamp: function () { startChampionship(); countdown = 0; },
  step: function (n) { for (var i = 0; i < (n || 1); i++) update(STEP); },
  autoStep: function (n, boost) { for (var i = 0; i < (n || 1); i++) { if (screen !== 'race') break; var seg = findSeg(position + PLAYER_Z); var cmd = -playerX * 3 + seg.curve * 1.3; keys.right = cmd > 0.1; keys.left = cmd < -0.1; keys.up = true; keys.boost = !!boost && nitro > 0.25; update(STEP); } },
  setKeys: function (o) { for (var k in o) keys[k] = o[k]; },
  forceFinish: function () { raceDist = laps * trackLength; finishRace(); },
  resultsAdv: function () { resultsAdvance(); }, advance: function () { standingsAdvance(); },
  draw: function () { render(0); },
  state: function () { return { screen: screen, mode: mode, pos: playerPos, lap: playerLap, speed: speed | 0, car: CAR.name, diff: DIFF.name, track: TRACKS[trackIdx].name, champRound: champRound, champPts: champPts, mine: results && results.mine }; },
  ach: function () { return steamAch(); }
};

return { render: render_html, init: init, close: close, pause: pause, resume: resume, steamAch: steamAch, _dbg: _dbg };
})();
