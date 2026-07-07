/* ============================================================
   URE ROOM — isaac's apartment, pixel edition
   A poke-around diorama at /room/. Higher-res sibling of the
   URE BOY cartridges: native 320x416, zero dependencies, one
   file, every pixel drawn in code. The floor plan is real
   (ish). The cow chair moos. The console on the desk is the
   actual way into the site.
   ============================================================ */
(function () {
'use strict';

/* ─────────────────────────── core ─────────────────────────── */
var W = 320, H = 416;                              // native buffer, 2x the cartridges
var buf = document.createElement('canvas');        // everything renders here at 1x
buf.width = W; buf.height = H;
var ctx = buf.getContext('2d');

var baseCv = document.createElement('canvas');     // static room prerender
baseCv.width = W; baseCv.height = H;
var bg = baseCv.getContext('2d');

var darkCv = document.createElement('canvas');     // night overlay w/ light holes
darkCv.width = W; darkCv.height = H;
var dctxDark = darkCv.getContext('2d');

var disp = null, dctx = null, holder = null;       // display canvas (letterboxed blit)
var presentS = 1, presentOX = 0, presentOY = 0;
var rafId = 0, lastTs = 0, T = 0, FR = 0;          // clock: seconds + 0.45s two-frame counter
var REDUCE_MQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
var reduce = !!(REDUCE_MQ && REDUCE_MQ.matches);
if (REDUCE_MQ) {
    var onReduceChange = function (e) { reduce = e.matches; needsDraw = true; };
    if (REDUCE_MQ.addEventListener) REDUCE_MQ.addEventListener('change', onReduceChange);
    else if (REDUCE_MQ.addListener) REDUCE_MQ.addListener(onReduceChange);
}
var needsDraw = true;                              // reduced-motion loop throttle flag

/* ─────────────────────── tiny helpers ─────────────────────── */
function byId(id) { return document.getElementById(id); }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
/* deterministic per-coord hash — texture that never shimmers on redraw */
function thash(x, y) { var n = (x * 374761393 + y * 668265263) >>> 0; n = (n ^ (n >> 13)) * 1274126177 >>> 0; return ((n ^ (n >> 16)) >>> 0) / 4294967295; }
function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = clamp((n >> 16) + amt, 0, 255), g2 = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
    return '#' + ((1 << 24) + (r << 16) + (g2 << 8) + b).toString(16).slice(1);
}
function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function box1(g, x, y, w, h, c) { R(g, x, y, w, 1, c); R(g, x, y + h - 1, w, 1, c); R(g, x, y, 1, h, c); R(g, x + w - 1, y, 1, h, c); }

/* ───────────────────────── palette ────────────────────────── */
var P = {
    k: '#15151a', w: '#f8f4e3', dim: '#8d8d7e',
    red: '#d81e05', red2: '#8f1305',
    amber: '#f2a30f', gold: '#e8c04a', yell: '#f4dd7c',
    /* wood floor */
    fl1: '#a1734b', fl2: '#875e3c', fl3: '#6e4d32', flHi: '#b8875c',
    /* walls */
    wt: '#ece8da', wtLn: '#c6c0ac', wf1: '#d9d3c0', wf2: '#c7c0aa', base3: '#573b26',
    /* furniture wood */
    wd1: '#a8794e', wd2: '#7c5636', wd3: '#573b26',
    /* fabric */
    cream: '#e6e1d1', cream2: '#c8c2af', cream3: '#a49e8c',
    slate: '#454c57', slate2: '#31363e',
    cow: '#f4f2e6', cowDk: '#26262b',
    duv: '#dcd6c4', duv2: '#bdb6a1', blank: '#5e93cf', blank2: '#3d6fb0',
    /* bath + kitchen */
    tile1: '#ccd3d4', tile2: '#b7bfc2', tile3: '#96a1a6',
    kcab: '#4a4f58', kcab2: '#33373e', ktop: '#d9d5c7', ktop2: '#b9b5a5',
    steel: '#9aa3ad', steel2: '#6f7883', porc: '#eff0ec', porc2: '#c9ccc6',
    /* nature + accents */
    grn1: '#7aa254', grn2: '#5d8544', grn3: '#42663a', pot: '#b06a4a', pot2: '#8a4c34',
    blue: '#5e93cf', teal: '#1f9e98', purp: '#7b53c9', pink: '#d86aa0',
    glass: '#39434d', glass2: '#5a6a78',
    sky: '#8fb4d8', skyM: '#f2c98a', skyE: '#e8894a', night: '#1d2030'
};

/* ───────────────────────── audio ──────────────────────────── */
var AU = { ctx: null, master: null, noiseBuf: null, soundOn: false };
AU.get = function () {
    if (!AU.soundOn) return null;
    try {
        if (!AU.ctx) {
            AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
            AU.master = AU.ctx.createGain(); AU.master.gain.value = 0.16;
            AU.master.connect(AU.ctx.destination);
        }
        if (AU.ctx.state === 'suspended') AU.ctx.resume().catch(function () {});
        return AU.ctx;
    } catch (e) { return null; }
};
function tone(freq, dur, type, gain, when, slideTo) {
    var c = AU.get(); if (!c) return;
    try {
        var t0 = when || c.currentTime;
        var o = c.createOscillator(), g = c.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, t0);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
        g.gain.setValueAtTime(gain || 0.12, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        o.connect(g); g.connect(AU.master);
        o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) {}
}
function toneAt(delay, freq, dur, type, gain, slideTo) {
    var c = AU.get(); if (!c) return;
    tone(freq, dur, type, gain, c.currentTime + delay, slideTo);
}
function noiseHit(dur, gain, freq, when) {
    var c = AU.get(); if (!c) return;
    try {
        if (!AU.noiseBuf) {
            AU.noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.4), c.sampleRate);
            var dd = AU.noiseBuf.getChannelData(0);
            for (var i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
        }
        var t0 = when || c.currentTime;
        var s = c.createBufferSource(); s.buffer = AU.noiseBuf; s.loop = true;
        var f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 800; f.Q.value = 1;
        var g = c.createGain();
        g.gain.setValueAtTime(gain || 0.2, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        s.connect(f); f.connect(g); g.connect(AU.master);
        s.start(t0); s.stop(t0 + dur + 0.02);
    } catch (e) {}
}
/* the room SFX kit */
var SFX = {
    blip:   function () { tone(880, 0.05, 'square', 0.1); },
    ok:     function () { tone(760, 0.05, 'square', 0.09); toneAt(0.05, 1140, 0.07, 'square', 0.08); },
    click:  function () { tone(1200, 0.02, 'square', 0.08); },
    boot:   function () { tone(523, 0.07, 'square', 0.1); toneAt(0.08, 784, 0.07, 'square', 0.1); toneAt(0.16, 1046, 0.14, 'square', 0.11); },
    moo:    function () { tone(196, 0.34, 'sawtooth', 0.15, 0, 138); toneAt(0.12, 147, 0.5, 'sawtooth', 0.13, 98); },
    fwmp:   function () { noiseHit(0.09, 0.13, 240); tone(130, 0.09, 'sine', 0.13, 0, 70); },
    dice:   function () { for (var i = 0; i < 4; i++) noiseHit(0.03, 0.09, 1400 + i * 300, (AU.ctx ? AU.ctx.currentTime : 0) + i * 0.05); },
    shutter:function () { noiseHit(0.03, 0.2, 2600); tone(1250, 0.03, 'square', 0.05); },
    knock:  function () { tone(85, 0.07, 'square', 0.2); noiseHit(0.05, 0.11, 320); toneAt(0.15, 85, 0.07, 'square', 0.2); },
    chirp:  function () { tone(1500, 0.05, 'square', 0.08); toneAt(0.09, 1500, 0.05, 'square', 0.08); },
    flush:  function () { noiseHit(0.65, 0.16, 900); tone(220, 0.55, 'sine', 0.09, 0, 55); },
    drip:   function () { tone(900, 0.05, 'sine', 0.09, 0, 300); },
    sizzle: function () { noiseHit(0.5, 0.09, 3000); noiseHit(0.4, 0.06, 1600, (AU.ctx ? AU.ctx.currentTime : 0) + 0.15); },
    ding:   function () { tone(1568, 0.3, 'triangle', 0.11); },
    whistle:function () { tone(880, 0.9, 'sine', 0.06, 0, 1720); noiseHit(0.8, 0.04, 4200); },
    zzz:    function () { tone(520, 0.08, 'triangle', 0.05); toneAt(0.12, 440, 0.08, 'triangle', 0.045); toneAt(0.24, 370, 0.1, 'triangle', 0.04); },
    tumble: function () { for (var i = 0; i < 3; i++) noiseHit(0.1, 0.07, 420 + i * 60, (AU.ctx ? AU.ctx.currentTime : 0) + i * 0.13); },
    creak:  function () { tone(180, 0.14, 'sawtooth', 0.05, 0, 250); },
    crunch: function () { noiseHit(0.05, 0.15, 1800); noiseHit(0.05, 0.11, 900, (AU.ctx ? AU.ctx.currentTime : 0) + 0.06); },
    splash: function () { noiseHit(0.25, 0.12, 700); tone(300, 0.12, 'sine', 0.07, 0, 140); },
    eye:    function () { tone(1046, 0.06, 'triangle', 0.07); toneAt(0.07, 1568, 0.1, 'triangle', 0.06); },
    fanfare:function () { tone(880, 0.08, 'square', 0.09); toneAt(0.09, 1180, 0.1, 'square', 0.09); }
};
/* record player — lookahead-scheduled lo-fi loop (sad girl chiptune) */
var MUS = { iv: null, at: 0, step: 0 };
var MUS_LEAD = [76, 0, 74, 76, 0, 71, 0, 69, 0, 71, 72, 0, 71, 0, 67, 0];
var MUS_BASS = [45, 0, 0, 0, 52, 0, 0, 0, 48, 0, 0, 0, 43, 0, 47, 0];
function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function musicTick() {
    var c = AU.get(); if (!c) return;
    var stepDur = 0.22;
    if (MUS.at < c.currentTime) MUS.at = c.currentTime + 0.05;
    while (MUS.at < c.currentTime + 0.26) {
        var b = MUS_BASS[MUS.step % MUS_BASS.length];
        var l = MUS_LEAD[MUS.step % MUS_LEAD.length];
        if (b) tone(midi(b), stepDur * 0.9, 'triangle', 0.09, MUS.at);
        if (l) tone(midi(l), stepDur * 0.7, 'square', 0.035, MUS.at);
        MUS.at += stepDur;
        MUS.step++;
    }
}
function musicStart() { if (!MUS.iv) MUS.iv = setInterval(musicTick, 100); }
function musicStop() { if (MUS.iv) { clearInterval(MUS.iv); MUS.iv = null; } }

/* ─────────────────────────── state ────────────────────────── */
var ST = {
    tv: false, lamp: false, nlamp: false,
    fridge: false, closet: false, record: false,
    tod: null,                                     // time-of-day override (null = real clock)
    cookies: parseInt(lsGet('room_cookies') || '0', 10) || 0,
    moos: 0, knocks: 0, mirrorPokes: 0, mirrorEye: false,
    diceUntil: 0, diceVal: 0,
    hover: null, focus: null
};
var ANIM = {};                                     // transient anims: id -> end time
function animOn(id, dur) { ANIM[id] = T + dur; }
function animT(id) { return ANIM[id] && T < ANIM[id] ? ANIM[id] - T : 0; }

var POKED = (function () {
    try { var a = JSON.parse(lsGet('room_poked_v1') || '[]'); return {}.toString.call(a) === '[object Array]' ? a : []; } catch (e) { return []; }
})();
function pokedHas(id) { return POKED.indexOf(id) >= 0; }

/* ─────────────────────── time of day ──────────────────────── */
function phaseNow() {
    if (ST.tod) return ST.tod;
    var h = new Date().getHours();
    if (h >= 6 && h < 10) return 'morning';
    if (h >= 10 && h < 17) return 'day';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
}
var curPhase = phaseNow();

/* ───────────────────── 3x5 micro font ─────────────────────── */
var F35 = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111',
    '3': '111001111001111', '4': '101101111001001', '5': '111100111001111',
    '6': '111100111101111', '7': '111001010010010', '8': '111101111101111',
    '9': '111101111001111', ':': '000010000010000'
};
function t35(g, s, x, y, c) {
    g.fillStyle = c || P.w;
    for (var i = 0; i < s.length; i++) {
        var gl = F35[s[i]]; if (!gl) { x += 4; continue; }
        for (var p = 0; p < 15; p++) if (gl[p] === '1') g.fillRect(x + (p % 3), y + Math.floor(p / 3), 1, 1);
        x += 4;
    }
}

/* ============================================================
   GEOMETRY — mirrored from the real floor plan.
   bedroom top-left · living top-right (couch, cow chair, desk
   under the TV) · closet + laundry mid-left · bathroom bottom-
   left · kitchen bottom-right · entry bottom-center. no dining
   table (he doesn't have one).
   ============================================================ */
var ROOMS = {
    bed:    { x: 10, y: 30, w: 114, h: 138 },      // interior floor areas
    closet: { x: 10, y: 184, w: 114, h: 54 },
    bath:   { x: 10, y: 254, w: 114, h: 152 },
    living: { x: 128, y: 30, w: 182, h: 166 },
    hall:   { x: 128, y: 196, w: 40, h: 210 },
    flex:   { x: 172, y: 196, w: 138, h: 60 },
    kitchen:{ x: 172, y: 256, w: 138, h: 150 }
};
/* windows in the north wall face (x, w) + one east window (y, h) */
var WIN_BED = { x: 34, w: 56 };
var WIN_LIV = { x: 252, w: 48 };
var WIN_EAST = { y: 44, h: 48 };
var WIN_BATH = { y: 300, h: 40 };

/* ──────────────────── floors and walls ────────────────────── */
function plankFloor(g, x, y, w, h) {
    R(g, x, y, w, h, P.fl1);
    for (var ry = y; ry < y + h; ry += 8) {
        var rh = Math.min(8, y + h - ry);
        R(g, x, ry + rh - 1, w, 1, P.fl2);
        var row = Math.floor(ry / 8);
        var off = (row % 2) * 16;
        for (var jx = x + off; jx < x + w; jx += 32) R(g, jx, ry, 1, rh, P.fl2);
        for (var i = 0; i < Math.floor(w / 14); i++) {
            var hx = thash(row * 7 + i, ry * 13 + i), hy = thash(row + i * 3, ry + i);
            g.fillStyle = hx > 0.72 ? P.flHi : P.fl3;
            if (hx > 0.55) g.fillRect(x + Math.floor(hy * (w - 3)), ry + 2 + Math.floor(hx * 4), 2, 1);
        }
    }
}
function tileFloor(g, x, y, w, h) {
    R(g, x, y, w, h, P.tile1);
    for (var ty = y; ty < y + h; ty += 10) {
        for (var tx = x; tx < x + w; tx += 10) {
            var cw = Math.min(10, x + w - tx), ch = Math.min(10, y + h - ty);
            if (((tx / 10 | 0) + (ty / 10 | 0)) % 2) R(g, tx, ty, cw, ch, P.tile2);
        }
    }
    g.fillStyle = P.tile3;
    for (var gy = y + 9; gy < y + h; gy += 10) g.fillRect(x, gy, w, 1);
    for (var gx = x + 9; gx < x + w; gx += 10) g.fillRect(gx, y, 1, h);
}
/* north wall face: panel + baseboard, with window + sky cutouts */
function wallFace(g, x, y, w, wins) {
    R(g, x, y, w, 20, P.wf1);
    R(g, x, y, w, 2, P.wt);
    R(g, x, y + 14, w, 2, P.wf2);
    R(g, x, y + 16, w, 3, P.base3);
    R(g, x, y + 19, w, 1, P.k);
    for (var i = 0; i < wins.length; i++) {
        var wn = wins[i];
        drawWindow(g, wn.x, y + 2, wn.w, 13);
    }
}
function skyFill(g, x, y, w, h) {
    var ph = curPhase;
    if (ph === 'night') {
        R(g, x, y, w, h, P.night);
        for (var i = 0; i < Math.floor(w / 6); i++) {
            var hx = thash(x + i * 11, y + i * 7);
            if (hx > 0.45) R(g, x + Math.floor(thash(i, x) * (w - 1)), y + Math.floor(hx * (h - 2)), 1, 1, P.yell);
        }
    } else if (ph === 'morning') {
        R(g, x, y, w, h, P.skyM);
        R(g, x, y, w, Math.floor(h / 3), '#e8b06a');
    } else if (ph === 'evening') {
        R(g, x, y, w, h, P.skyE);
        R(g, x, y + h - Math.floor(h / 3), w, Math.floor(h / 3), '#c05a3a');
        R(g, x, y, w, Math.floor(h / 4), '#f2b06a');
    } else {
        R(g, x, y, w, h, P.sky);
        R(g, x + Math.floor(w * 0.2), y + 2, 7, 2, '#e8f0f8');
        R(g, x + Math.floor(w * 0.2) + 2, y + 1, 4, 4, '#e8f0f8');
        R(g, x + Math.floor(w * 0.6), y + 5, 9, 2, '#dce8f4');
    }
}
function drawWindow(g, x, y, w, h) {
    R(g, x - 1, y - 1, w + 2, h + 2, P.k);
    skyFill(g, x, y, w, h);
    R(g, x + Math.floor(w / 2), y, 1, h, P.k);          // mullion
    R(g, x, y + Math.floor(h / 2), w, 1, P.k);
    box1(g, x, y, w, h, P.wd3);
}
/* east/west wall windows (thin vertical walls): glass strip */
function sideWindow(g, x, y, h) {
    R(g, x, y - 1, 6, h + 2, P.k);
    skyFill(g, x + 1, y, 4, h);
    R(g, x + 1, y + Math.floor(h / 2), 4, 1, P.k);
}
function drawShell(g) {
    /* backdrop outside the apartment */
    R(g, 0, 0, W, H, '#101014');
    /* floors */
    plankFloor(g, ROOMS.bed.x, ROOMS.bed.y, ROOMS.bed.w, ROOMS.bed.h);
    plankFloor(g, ROOMS.closet.x, ROOMS.closet.y, ROOMS.closet.w, ROOMS.closet.h);
    tileFloor(g, ROOMS.bath.x, ROOMS.bath.y, ROOMS.bath.w, ROOMS.bath.h);
    plankFloor(g, ROOMS.living.x, ROOMS.living.y, ROOMS.living.w, ROOMS.living.h);
    plankFloor(g, ROOMS.hall.x, ROOMS.hall.y, ROOMS.hall.w, ROOMS.hall.h);
    plankFloor(g, ROOMS.flex.x, ROOMS.flex.y, ROOMS.flex.w, ROOMS.flex.h);
    plankFloor(g, ROOMS.kitchen.x, ROOMS.kitchen.y, ROOMS.kitchen.w, ROOMS.kitchen.h);

    /* exterior ring (top slab look) */
    R(g, 4, 4, W - 8, 6, P.wt);                        // north
    R(g, 4, H - 10, W - 8, 6, P.wt);                   // south
    R(g, 4, 4, 6, H - 8, P.wt);                        // west
    R(g, W - 10, 4, 6, H - 8, P.wt);                   // east
    /* north wall faces w/ windows */
    wallFace(g, 10, 10, 114, [WIN_BED]);
    wallFace(g, 128, 10, 182, [WIN_LIV]);
    /* interior walls */
    R(g, 124, 10, 4, H - 20, P.wt);                    // V1 spine
    R(g, 10, 164, 114, 4, P.wt);                       // H1 bed/closet
    R(g, 10, 238, 114, 4, P.wt);                       // H2 closet/bath
    R(g, 168, 196, 4, H - 206, P.wt);                  // V2 hall/kitchen
    /* wall faces below interior horizontal walls */
    R(g, 10, 168, 114, 16, P.wf1); R(g, 10, 180, 114, 3, P.base3); R(g, 10, 183, 114, 1, P.k);
    R(g, 10, 242, 114, 12, P.wf1); R(g, 10, 250, 114, 3, P.base3); R(g, 10, 253, 114, 1, P.k);

    /* door gaps (cut back to floor) */
    plankFloor(g, 124, 132, 4, 32);                    // bedroom door (V1)
    plankFloor(g, 124, 196, 4, 32);                    // closet opening (V1)
    plankFloor(g, 124, 268, 4, 32);                    // bathroom door (V1)
    plankFloor(g, 132, H - 10, 32, 6);                 // front door gap (south wall)
    /* door leafs, swung open */
    R(g, 120, 132, 4, 30, P.wd1); box1(g, 120, 132, 4, 30, P.wd3);
    R(g, 128, 270, 4, 30, P.wd1); box1(g, 128, 270, 4, 30, P.wd3);
    /* side windows */
    sideWindow(g, W - 10, WIN_EAST.y, WIN_EAST.h);
    sideWindow(g, 4, WIN_BATH.y, WIN_BATH.h);
    sideWindow(g, W - 10, 310, 36);                    // kitchen window over the sink
    /* towel on the bathroom wall face */
    R(g, 58, 243, 12, 9, P.teal);
    R(g, 58, 243, 12, 1, shade(P.teal, -30));
    R(g, 58, 247, 12, 1, shade(P.teal, -30));
    box1(g, 58, 243, 12, 9, P.k);
    /* wall outline ink */
    box1(g, 4, 4, W - 8, H - 8, P.k);
    R(g, 124, 10, 1, H - 20, P.wtLn); R(g, 127, 10, 1, H - 20, P.wtLn);
    R(g, 168, 196, 1, H - 206, P.wtLn); R(g, 171, 196, 1, H - 206, P.wtLn);
    /* re-cut door gaps over the outline */
    plankFloor(g, 124, 134, 4, 28); plankFloor(g, 124, 198, 4, 28); plankFloor(g, 124, 270, 4, 28);
    /* wall shadows on floors (south + east of walls) */
    g.fillStyle = 'rgba(21,21,26,0.14)';
    g.fillRect(10, 30, 114, 2); g.fillRect(128, 30, 182, 2);
    g.fillRect(10, 184, 114, 2); g.fillRect(10, 254, 114, 2);
    g.fillRect(128, 10, 2, H - 20); g.fillRect(172, 196, 2, 210);
}

/* ============================================================
   FURNITURE — each painter draws into the base canvas.
   ============================================================ */
function shadowRect(g, x, y, w, h) { g.fillStyle = 'rgba(21,21,26,0.24)'; g.fillRect(x, y, w, h); }

/* ── living room ── */
function drawRug(g) {
    var x = 186, y = 66, w = 96, h = 96;
    R(g, x, y, w, h, P.red2);
    box1(g, x + 2, y + 2, w - 4, h - 4, P.gold);
    box1(g, x + 6, y + 6, w - 12, h - 12, shade(P.red2, -20));
    for (var i = 0; i < 40; i++) {
        var hx = thash(i * 3, i * 7);
        if (hx > 0.5) R(g, x + 4 + Math.floor(thash(i, 2) * (w - 8)), y + 4 + Math.floor(hx * (h - 8)), 2, 1, shade(P.red2, 14));
    }
}
function drawDeskTV(g) {
    /* TV mounted on the north wall face */
    var tx = 188, tw = 52;
    R(g, tx - 2, 12, tw + 4, 16, P.k);
    R(g, tx, 14, tw, 12, ST.tv ? '#cfe4f2' : P.glass);
    if (!ST.tv) { R(g, tx + 3, 15, 14, 3, P.glass2); }
    R(g, tx + Math.floor(tw / 2) - 2, 27, 4, 2, P.k);   // mount
    /* desk beneath */
    var x = 182, y = 30, w = 64, h = 22;
    shadowRect(g, x + 2, y + h, w, 3);
    R(g, x, y, w, h, P.wd1);
    R(g, x, y, w, 2, shade(P.wd1, 22));
    R(g, x, y + h - 3, w, 3, P.wd2);
    box1(g, x, y, w, h, P.wd3);
    for (var i = 0; i < 10; i++) { var hh = thash(i * 5, 99); if (hh > 0.5) R(g, x + 3 + Math.floor(hh * (w - 8)), y + 4 + (i % 3) * 5, 3, 1, P.wd2); }
    /* mug of chamomile (left) */
    R(g, x + 6, y + 7, 7, 7, P.porc); box1(g, x + 6, y + 7, 7, 7, P.k);
    R(g, x + 13, y + 9, 2, 3, P.porc);
    R(g, x + 8, y + 9, 3, 3, '#c8a24a');
    /* the URE BOY (center) — the way in */
    drawUreboy(g, x + 24, y + 2);
    /* camera (right) */
    R(g, x + 45, y + 8, 14, 9, '#2a2a30'); box1(g, x + 45, y + 8, 14, 9, P.k);
    R(g, x + 46, y + 9, 12, 2, '#3d3d44');
    R(g, x + 49, y + 10, 6, 6, P.glass2); R(g, x + 50, y + 11, 4, 4, P.glass);
    R(g, x + 51, y + 12, 1, 1, P.w);
    R(g, x + 46, y + 6, 5, 2, '#2a2a30'); R(g, x + 56, y + 9, 2, 1, P.red);
}
function drawUreboy(g, x, y) {
    /* the handheld itself, DMG-gray so it reads instantly. the way in. */
    R(g, x + 3, y - 3, 10, 4, P.red); box1(g, x + 3, y - 3, 10, 4, P.red2);   // cartridge peeking
    R(g, x + 5, y - 2, 6, 1, '#ff6a4a');
    R(g, x, y, 16, 18, '#d9d8cf'); box1(g, x, y, 16, 18, P.k);                // shell
    R(g, x + 1, y + 1, 14, 1, '#efeee6');
    R(g, x + 2, y + 3, 12, 8, '#3a3a35'); box1(g, x + 2, y + 3, 12, 8, P.k);  // bezel
    R(g, x + 4, y + 5, 8, 5, '#9bbc0f');                                      // dmg screen
    R(g, x + 6, y + 6, 4, 1, '#0f380f');                                      // eye on screen
    R(g, x + 7, y + 7, 2, 2, '#0f380f');
    R(g, x + 2, y + 13, 4, 4, '#26262b');                                     // d-pad
    R(g, x + 3, y + 12, 2, 6, '#26262b'); R(g, x + 1, y + 14, 6, 2, '#26262b');
    R(g, x + 10, y + 13, 2, 2, P.red); R(g, x + 12, y + 15, 2, 2, P.red);     // A/B
}
function drawCouch(g) {
    /* couch facing the TV (north), the certified nap zone */
    var x = 192, y = 128, w = 68, h = 30;
    shadowRect(g, x + 2, y + h, w, 3);
    /* arms (rounded outer corners) */
    R(g, x, y + 1, 7, h - 1, P.cream2);
    R(g, x + w - 7, y + 1, 7, h - 1, P.cream2);
    R(g, x + 1, y + 2, 5, h - 4, P.cream);
    R(g, x + w - 6, y + 2, 5, h - 4, P.cream);
    /* seat cushions */
    R(g, x + 7, y + 8, w - 14, h - 10, P.cream);
    var cw = Math.floor((w - 14) / 2);
    R(g, x + 7 + cw, y + 8, 1, h - 12, P.cream3);
    R(g, x + 8, y + h - 5, w - 16, 1, P.cream3);
    R(g, x + 8, y + 9, cw - 2, 2, '#f2eee0'); R(g, x + 9 + cw, y + 9, cw - 2, 2, '#f2eee0');
    /* back cushions along the top */
    R(g, x + 7, y, w - 14, 9, P.cream2);
    R(g, x + 8, y + 1, cw - 2, 6, P.cream); R(g, x + 9 + cw, y + 1, cw - 2, 6, P.cream);
    R(g, x + 8, y + 6, w - 16, 1, P.cream3);
    /* throw pillows */
    R(g, x + 9, y + 3, 10, 9, P.blank); box1(g, x + 9, y + 3, 10, 9, P.blank2);
    R(g, x + w - 19, y + 3, 10, 9, P.gold); box1(g, x + w - 19, y + 3, 10, 9, '#b8912f');
    box1(g, x, y, w, h, P.k);
    /* feet */
    R(g, x + 2, y + h, 3, 2, P.wd3); R(g, x + w - 5, y + h, 3, 2, P.wd3);
}
function drawCowChair(g) {
    /* the cow-looking chair. it came like this. */
    var x = 272, y = 118, w = 30, h = 32;
    shadowRect(g, x + 2, y + h, w - 2, 3);
    /* body: back band, arms, seat — rounded corners via pixel cuts */
    R(g, x + 2, y, w - 4, 8, P.cow);                           // back
    R(g, x + 1, y + 1, w - 2, 7, P.cow);
    R(g, x, y + 4, 6, h - 8, P.cow);                           // arms
    R(g, x + w - 6, y + 4, 6, h - 8, P.cow);
    R(g, x + 4, y + 8, w - 8, h - 12, P.cow);                  // seat
    R(g, x + 4, y + h - 6, w - 8, 4, P.cow);
    /* little ear nubs, because it looks like a cow */
    R(g, x + 3, y - 2, 4, 3, P.cow); R(g, x + w - 7, y - 2, 4, 3, P.cowDk);
    box1(g, x + 3, y - 2, 4, 3, P.k); box1(g, x + w - 7, y - 2, 4, 3, P.k);
    /* irregular patches bleeding off the edges */
    R(g, x + 1, y + 2, 8, 4, P.cowDk); R(g, x + 3, y + 6, 5, 3, P.cowDk);
    R(g, x + w - 9, y + 10, 9, 6, P.cowDk); R(g, x + w - 6, y + 16, 6, 4, P.cowDk);
    R(g, x + 4, y + 20, 6, 7, P.cowDk); R(g, x + 8, y + 24, 4, 4, P.cowDk);
    R(g, x + 15, y + 12, 5, 4, P.cowDk);
    R(g, x + 13, y + h - 4, 6, 3, P.cowDk);
    /* seat dip + outline */
    R(g, x + 7, y + 11, w - 14, h - 18, 'rgba(21,21,26,0.1)');
    box1(g, x + 1, y + 1, w - 2, h - 1, P.k);
}
function drawCoffeeTable(g) {
    var x = 204, y = 88, w = 44, h = 26;
    shadowRect(g, x + 2, y + h, w, 3);
    R(g, x, y, w, h, P.wd2);
    R(g, x + 1, y + 1, w - 2, h - 2, P.wd1);
    R(g, x + 1, y + 1, w - 2, 2, shade(P.wd1, 20));
    box1(g, x, y, w, h, P.wd3);
    /* (the two d20s live in the dynamic pass so a roll can move them) */
    /* remote */
    R(g, x + 30, y + 7, 6, 12, '#26262b'); box1(g, x + 30, y + 7, 6, 12, P.k);
    R(g, x + 31, y + 9, 2, 2, P.red); R(g, x + 34, y + 12, 1, 1, P.dim); R(g, x + 32, y + 15, 1, 1, P.dim);
}
function drawDie(g, x, y, c, jig) {
    var oy = jig ? (FR % 2) : 0;
    R(g, x + 1, y - 1 + oy, 4, 1, c);
    R(g, x, y + oy, 6, 4, c);
    R(g, x + 1, y + 4 + oy, 4, 1, shade(c, -30));
    R(g, x + 2, y + 1 + oy, 2, 2, P.w);
}
function drawFloorLamp(g) {
    var x = 296, y = 36;
    shadowRect(g, x - 1, y + 12, 12, 2);
    R(g, x + 4, y + 6, 2, 8, '#2a2a30');
    R(g, x, y, 10, 7, ST.lamp ? P.yell : P.cream2);
    R(g, x + 1, y + 1, 8, 2, ST.lamp ? '#fff8d0' : P.cream);
    box1(g, x, y, 10, 7, P.k);
    R(g, x + 2, y + 14, 6, 2, '#2a2a30');
}
function drawPlant(g) {
    var x = 132, y = 34;
    shadowRect(g, x, y + 14, 14, 2);
    R(g, x + 2, y + 8, 10, 8, P.pot); R(g, x + 3, y + 8, 8, 2, P.pot2); box1(g, x + 2, y + 8, 10, 8, P.k);
    R(g, x + 5, y + 2, 4, 6, P.grn2);
    R(g, x + 1, y + 4, 5, 4, P.grn1); R(g, x + 8, y + 3, 5, 5, P.grn1);
    R(g, x + 3, y, 3, 4, P.grn1); R(g, x + 9, y + 1, 3, 3, P.grn3);
    R(g, x + 6, y + 5, 2, 2, P.grn3);
}
function drawDeskChair(g) {
    /* task chair pushed up to the desk, backrest facing the room */
    var x = 208, y = 54, w = 20, h = 18;
    shadowRect(g, x + 2, y + h - 1, w - 2, 2);
    /* star base hints */
    R(g, x + 1, y + 8, 3, 2, P.slate2); R(g, x + w - 4, y + 8, 3, 2, P.slate2);
    R(g, x + 4, y + h - 3, 3, 2, P.slate2); R(g, x + w - 7, y + h - 3, 3, 2, P.slate2);
    /* round seat */
    R(g, x + 4, y + 2, w - 8, h - 6, P.slate);
    R(g, x + 3, y + 4, w - 6, h - 10, P.slate);
    R(g, x + 5, y + 3, w - 10, 3, shade(P.slate, 18));
    box1(g, x + 3, y + 2, w - 6, h - 6, P.k);
    /* backrest band (south edge, facing the room) */
    R(g, x + 4, y + h - 5, w - 8, 5, P.slate2);
    box1(g, x + 4, y + h - 5, w - 8, 5, P.k);
    R(g, x + 5, y + h - 4, w - 10, 1, shade(P.slate2, 20));
}
function drawBookshelf(g) {
    /* low open-top bookcase in the flex zone — spines visible from above */
    var x = 176, y = 204, w = 18, h = 44;
    shadowRect(g, x + 2, y + h, w, 3);
    R(g, x, y, w, h, P.wd2); box1(g, x, y, w, h, P.wd3);
    var spines = [P.red2, P.teal, P.gold, P.purp, P.grn2, P.blue, P.pink, P.amber, P.cream2, P.slate];
    for (var i = 0; i < 10; i++) {
        R(g, x + 2, y + 2 + i * 4, w - 4, 3, spines[i]);
        R(g, x + 2, y + 4 + i * 4, w - 4, 1, 'rgba(21,21,26,0.35)');
    }
}
function drawRecord(g) {
    /* record console against the east wall, player seen from above */
    var x = 284, y = 204, w = 26, h = 42;
    shadowRect(g, x - 2, y + h, w, 3);
    R(g, x, y, w, h, P.wd1); box1(g, x, y, w, h, P.wd3);
    R(g, x, y, 2, h, shade(P.wd1, 20));
    /* platter + vinyl */
    R(g, x + 5, y + 5, 16, 16, '#26262b');
    R(g, x + 7, y + 7, 12, 12, '#17171a');
    box1(g, x + 5, y + 5, 16, 16, P.k);
    R(g, x + 12, y + 12, 2, 2, P.red);
    /* tone arm */
    R(g, x + 20, y + 6, 2, 2, P.steel);
    R(g, x + 18, y + 8, 2, 6, P.steel2);
    /* speaker grill below */
    for (var i = 0; i < 3; i++) R(g, x + 5, y + 26 + i * 5, 16, 2, P.wd3);
}
function drawClock(g) {
    /* digital wall clock on the living wall face — poke to bend time */
    var x = 152, y = 14;
    R(g, x, y, 26, 12, '#1c1d17'); box1(g, x, y, 26, 12, P.k);
    R(g, x + 1, y + 1, 24, 1, '#2e2e36');
    /* digits drawn per-frame in the dynamic pass */
}
function drawPoster(g) {
    /* a good eye, framed */
    var x = 134, y = 12;
    R(g, x, y, 16, 14, P.wd3); box1(g, x, y, 16, 14, P.k);
    R(g, x + 2, y + 2, 12, 10, P.w);
    R(g, x + 4, y + 5, 8, 1, P.k);
    R(g, x + 5, y + 6, 6, 2, P.k);
    R(g, x + 7, y + 6, 2, 2, P.red);
    R(g, x + 5, y + 9, 6, 1, P.k);
}

/* ── bedroom ── */
function drawBed(g) {
    var x = 28, y = 30, w = 60, h = 74;
    shadowRect(g, x + 2, y + h, w, 3);
    R(g, x, y, w, 8, P.wd2); box1(g, x, y, w, 8, P.wd3);      // headboard
    R(g, x + 2, y + 8, w - 4, h - 8, P.duv);
    R(g, x + 4, y + 10, (w - 10) / 2, 10, P.w);               // pillows
    R(g, x + 6 + (w - 10) / 2, y + 10, (w - 10) / 2, 10, P.w);
    box1(g, x + 4, y + 10, (w - 10) / 2, 10, P.duv2); box1(g, x + 6 + (w - 10) / 2, y + 10, (w - 10) / 2, 10, P.duv2);
    R(g, x + 2, y + 26, w - 4, 2, P.duv2);                    // fold line
    R(g, x + 2, y + h - 22, w - 4, 16, P.blank);              // throw blanket
    R(g, x + 2, y + h - 22, w - 4, 2, P.blank2); R(g, x + 2, y + h - 8, w - 4, 2, P.blank2);
    for (var i = 0; i < 12; i++) { var hh = thash(i * 9, 5); if (hh > 0.55) R(g, x + 4 + Math.floor(hh * (w - 10)), y + 30 + Math.floor(thash(i, 8) * (h - 56)), 3, 1, P.duv2); }
    box1(g, x, y + 8, w, h - 8, P.k);
}
function drawNightstand(g) {
    var x = 94, y = 32, w = 20, h = 18;
    shadowRect(g, x + 1, y + h, w, 2);
    R(g, x, y, w, h, P.wd1); box1(g, x, y, w, h, P.wd3);
    R(g, x, y, w, 2, shade(P.wd1, 20));
    /* little lamp */
    R(g, x + 5, y + 4, 8, 6, ST.nlamp ? P.yell : P.cream2);
    R(g, x + 6, y + 5, 6, 2, ST.nlamp ? '#fff8d0' : P.cream);
    box1(g, x + 5, y + 4, 8, 6, P.k);
    R(g, x + 8, y + 10, 2, 3, '#2a2a30');
}
function drawDresser(g) {
    var x = 12, y = 112, w = 20, h = 44;
    shadowRect(g, x + 2, y + h, w, 3);
    R(g, x, y, w, h, P.wd1); box1(g, x, y, w, h, P.wd3);
    R(g, x, y, 2, h, shade(P.wd1, 20));
    for (var i = 0; i < 3; i++) {
        R(g, x + 3, y + 4 + i * 13, w - 6, 10, P.wd2);
        R(g, x + 8, y + 8 + i * 13, 4, 2, P.gold);
    }
}
function drawBasket(g) {
    var x = 100, y = 140, w = 16, h = 18;
    shadowRect(g, x + 1, y + h, w, 2);
    R(g, x, y, w, h, '#b89b64'); box1(g, x, y, w, h, '#8a6c46');
    for (var i = 1; i < 4; i++) R(g, x + 1, y + i * 4, w - 2, 1, '#8a6c46');
    R(g, x + 3, y + 2, 6, 4, P.blank);                        // escaping sock
    R(g, x + 9, y + 3, 4, 3, P.w);
}
function drawBedRug(g) {
    var x = 40, y = 112, w = 48, h = 40;
    R(g, x, y, w, h, P.teal);
    box1(g, x + 2, y + 2, w - 4, h - 4, shade(P.teal, -30));
    for (var i = 0; i < 16; i++) { var hh = thash(i * 5, 77); if (hh > 0.5) R(g, x + 3 + Math.floor(hh * (w - 7)), y + 3 + Math.floor(thash(i, 4) * (h - 6)), 2, 1, shade(P.teal, 22)); }
}

/* ── closet + laundry ── */
function drawCloset(g) {
    /* hanging rail on the H1 wall face; sliding doors */
    var x = 14, y = 170, w = 62;
    R(g, x, y, w, 2, P.steel2);                               // rail
    var shirts = [P.red, P.blue, P.cream, P.grn2, P.purp, P.slate];
    for (var i = 0; i < 6; i++) {
        var sx = x + 2 + i * 10;
        R(g, sx + 3, y + 1, 1, 2, P.steel2);
        R(g, sx, y + 3, 7, 11, shirts[i]);
        R(g, sx + 1, y + 3, 5, 2, shade(shirts[i], -28));
    }
    if (!ST.closet) {
        /* both panels shut */
        R(g, x - 2, y - 1, 33, 17, P.wd1);
        R(g, x + 31, y - 1, 33, 17, shade(P.wd1, -12));
        for (var j = 0; j < 3; j++) { R(g, x + 3 + j * 9, y + 1, 1, 13, P.wd2); R(g, x + 36 + j * 9, y + 1, 1, 13, P.wd2); }
        box1(g, x - 2, y - 1, 33, 17, P.wd3); box1(g, x + 31, y - 1, 33, 17, P.wd3);
        R(g, x + 26, y + 6, 2, 4, P.gold); R(g, x + 34, y + 6, 2, 4, P.gold);
    } else {
        /* both panels parked left, fits on display */
        R(g, x - 2, y - 1, 33, 17, P.wd1);
        for (var k = 0; k < 3; k++) R(g, x + 3 + k * 9, y + 1, 1, 13, P.wd2);
        box1(g, x - 2, y - 1, 33, 17, P.wd3);
        R(g, x + 26, y + 6, 2, 4, P.gold);
    }
}
function drawClosetFloor(g) {
    /* storage keeps the walk-in from feeling bare */
    var x = 16, y = 196;
    /* stacked bins */
    R(g, x, y, 22, 14, P.teal); box1(g, x, y, 22, 14, shade(P.teal, -40));
    R(g, x + 2, y + 2, 18, 2, shade(P.teal, 20));
    R(g, x + 2, y + 16, 22, 14, P.slate); box1(g, x + 2, y + 16, 22, 14, P.k);
    R(g, x + 4, y + 18, 18, 2, shade(P.slate, 18));
    /* suitcase */
    R(g, x + 30, y + 18, 26, 14, P.red2); box1(g, x + 30, y + 18, 26, 14, P.k);
    R(g, x + 32, y + 20, 22, 2, shade(P.red2, 18));
    R(g, x + 40, y + 16, 6, 3, P.k);
    R(g, x + 34, y + 24, 18, 1, P.k); R(g, x + 34, y + 28, 18, 1, P.k);
    /* detergent by the washer */
    R(g, x + 60, y + 20, 7, 11, P.gold); box1(g, x + 60, y + 20, 7, 11, '#a87a1f');
    R(g, x + 62, y + 18, 3, 3, P.red);
}
function drawWasher(g) {
    var x = 84, y = 170, w = 34, h = 60;
    shadowRect(g, x + 2, y + h, w, 3);
    R(g, x, y, w, h, P.porc); box1(g, x, y, w, h, P.k);
    R(g, x, y + Math.floor(h / 2) - 1, w, 2, P.porc2);
    /* two round doors (stacked washer + dryer) */
    drawDrum(g, x + 9, y + 8, 0);
    drawDrum(g, x + 9, y + 38, 1);
    R(g, x + 3, y + 3, 6, 2, P.teal); R(g, x + 25, y + 3, 4, 2, P.red);
}
function drawDrum(g, x, y, which) {
    R(g, x, y, 16, 16, P.steel2);
    R(g, x + 2, y + 2, 12, 12, '#31363e');
    R(g, x + 4, y + 4, 8, 8, which ? '#3d4650' : '#2a3a4a');
    box1(g, x, y, 16, 16, P.k);
    R(g, x + 5, y + 5, 3, 2, 'rgba(255,255,255,0.25)');
}

/* ── bathroom ── */
function drawVanity(g) {
    var x = 14, y = 256, w = 38, h = 22;
    /* mirror on the wall face above */
    R(g, x + 4, 243, 26, 9, '#a8c4d4'); box1(g, x + 4, 243, 26, 9, P.k);
    R(g, x + 6, 244, 6, 5, 'rgba(255,255,255,0.45)');
    shadowRect(g, x + 1, y + h, w, 2);
    R(g, x, y, w, h, P.ktop); box1(g, x, y, w, h, P.k);
    R(g, x, y + h - 4, w, 4, P.ktop2);
    /* basin */
    R(g, x + 10, y + 5, 18, 12, P.porc); box1(g, x + 10, y + 5, 18, 12, P.porc2);
    R(g, x + 16, y + 9, 6, 4, P.tile3);
    R(g, x + 17, y + 3, 4, 3, P.steel);
    /* toothbrush cup */
    R(g, x + 32, y + 5, 4, 6, P.teal); R(g, x + 33, y + 3, 1, 3, P.red); R(g, x + 35, y + 3, 1, 3, P.blue);
}
function drawToilet(g) {
    var x = 14, y = 296, w = 18, h = 26;
    shadowRect(g, x + 1, y + h, w, 2);
    R(g, x, y, w, 8, P.porc); box1(g, x, y, w, 8, P.k);       // tank
    R(g, x + 3, y + 2, 5, 3, P.steel);                        // flusher
    /* rounded bowl */
    R(g, x + 3, y + 8, w - 6, 16, P.porc);
    R(g, x + 2, y + 10, w - 4, 12, P.porc);
    box1(g, x + 3, y + 8, w - 6, 16, P.k);
    R(g, x + 2, y + 10, 1, 12, P.k); R(g, x + w - 3, y + 10, 1, 12, P.k);
    R(g, x + 5, y + 11, w - 10, 10, P.porc2);                 // seat ring
    R(g, x + 6, y + 12, w - 12, 8, '#dfe4e6');                // water
    R(g, x + 7, y + 13, 2, 2, '#f2f6f8');
}
function drawTub(g) {
    var x = 14, y = 348, w = 96, h = 52;
    shadowRect(g, x + 2, y + h, w, 3);
    R(g, x, y, w, h, P.porc); box1(g, x, y, w, h, P.k);
    R(g, x + 6, y + 6, w - 12, h - 12, P.porc2);
    R(g, x + 8, y + 8, w - 16, h - 16, '#cfe0e4');            // water hint
    R(g, x + 10, y + 10, 20, 3, 'rgba(255,255,255,0.5)');
    R(g, x + w - 16, y + Math.floor(h / 2) - 2, 6, 4, P.steel); // faucet
    R(g, x + w - 12, y + Math.floor(h / 2) + 3, 2, 2, P.tile3);  // drain-ish
}
function drawBathMat(g) {
    var x = 56, y = 300, w = 30, h = 20;
    R(g, x, y, w, h, P.blue);
    box1(g, x + 1, y + 1, w - 2, h - 2, P.blank2);
    for (var i = 0; i < 8; i++) { var hh = thash(i * 3, 55); if (hh > 0.45) R(g, x + 2 + Math.floor(hh * (w - 5)), y + 2 + Math.floor(thash(i, 9) * (h - 4)), 2, 1, shade(P.blue, 24)); }
}

/* ── kitchen ── */
function drawCounters(g) {
    /* east run */
    var x = 284, y = 288, w = 26, h = 118;
    R(g, x, y, w, h, P.ktop); box1(g, x, y, w, h, P.k);
    R(g, x, y, 3, h, P.ktop2);
    for (var i = 1; i < 5; i++) R(g, x + 3, y + i * 24, w - 3, 1, P.ktop2);
    /* sink */
    R(g, x + 5, y + 22, 17, 26, P.steel); box1(g, x + 5, y + 22, 17, 26, P.k);
    R(g, x + 7, y + 24, 13, 10, P.steel2); R(g, x + 7, y + 36, 13, 10, P.steel2);
    R(g, x + 1, y + 32, 4, 4, P.steel);
    /* south run */
    var sx = 176, sy = 384, sw = 108, sh = 22;
    R(g, sx, sy, sw, sh, P.ktop); box1(g, sx, sy, sw, sh, P.k);
    R(g, sx, sy + sh - 3, sw, 3, P.ktop2);
    for (var j = 1; j < 5; j++) R(g, sx + j * 22, sy + 2, 1, sh - 5, P.ktop2);
    /* stove */
    R(g, sx + 32, sy + 2, 36, 18, '#31363e'); box1(g, sx + 32, sy + 2, 36, 18, P.k);
    drawBurner(g, sx + 37, sy + 5); drawBurner(g, sx + 55, sy + 5);
    drawBurner(g, sx + 37, sy + 13); drawBurner(g, sx + 55, sy + 13);
    /* pan on a burner */
    R(g, sx + 52, sy + 4, 12, 8, '#26262b'); R(g, sx + 54, sy + 6, 8, 4, P.slate2); R(g, sx + 64, sy + 7, 4, 2, '#26262b');
    /* kettle (left of stove) */
    R(g, sx + 8, sy + 5, 12, 11, P.steel); box1(g, sx + 8, sy + 5, 12, 11, P.k);
    R(g, sx + 11, sy + 3, 6, 3, P.steel2); R(g, sx + 20, sy + 8, 3, 4, P.steel2);
    R(g, sx + 10, sy + 7, 4, 3, 'rgba(255,255,255,0.35)');
    /* tea box */
    R(g, sx + 2, sy + 8, 5, 8, '#c8a24a'); box1(g, sx + 2, sy + 8, 5, 8, P.wd3);
    /* microwave (right end) */
    R(g, sx + 76, sy + 3, 24, 15, '#2a2a30'); box1(g, sx + 76, sy + 3, 24, 15, P.k);
    R(g, sx + 79, sy + 6, 13, 9, P.glass);
    R(g, sx + 94, sy + 6, 4, 2, P.red); R(g, sx + 94, sy + 10, 4, 1, P.dim); R(g, sx + 94, sy + 12, 4, 1, P.dim);
}
function drawBurner(g, x, y) {
    R(g, x, y, 10, 6, '#1c1d17');
    box1(g, x, y, 10, 6, '#454c57');
}
function drawFridge(g) {
    var x = 282, y = 250, w = 28, h = 34;
    shadowRect(g, x - 2, y + h, w + 2, 3);
    R(g, x, y, w, h, P.steel); box1(g, x, y, w, h, P.k);
    R(g, x, y, 3, h, shade(P.steel, 24));
    R(g, x + 10, y, 1, h, P.steel2);                          // door split
    R(g, x + 7, y + 6, 2, 8, P.steel2); R(g, x + 13, y + 6, 2, 8, P.steel2);  // handles
    if (ST.fridge) {
        /* door swung open, shelves + the emergency coke */
        R(g, x - 16, y + 2, 16, h - 4, '#e8f0f2'); box1(g, x - 16, y + 2, 16, h - 4, P.k);
        R(g, x - 15, y + 10, 14, 1, P.tile3); R(g, x - 15, y + 19, 14, 1, P.tile3);
        for (var i = 0; i < 3; i++) R(g, x - 13 + i * 4, y + 5, 3, 5, P.blue);       // water bottles
        R(g, x - 13, y + 13, 3, 5, P.red);                                            // the coke
        R(g, x - 8, y + 14, 6, 4, P.gold);                                            // leftovers
        R(g, x - 12, y + 22, 8, 6, P.porc);                                           // mystery tupper
    }
}
function drawIsland(g) {
    var x = 200, y = 296, w = 44, h = 60;
    shadowRect(g, x + 2, y + h, w, 4);
    /* dark base, butcher-block top — pops off the wood floor */
    R(g, x, y, w, h, P.kcab); box1(g, x, y, w, h, P.k);
    R(g, x + 2, y + 2, w - 4, h - 4, P.ktop);
    box1(g, x + 2, y + 2, w - 4, h - 4, P.ktop2);
    R(g, x + 3, y + 3, w - 6, 2, '#e8e4d6');
    /* cookie jar — glass, lid, visible stock */
    R(g, x + 7, y + 12, 14, 11, '#cfe0e4');
    R(g, x + 8, y + 11, 12, 13, '#cfe0e4');
    box1(g, x + 7, y + 12, 14, 11, P.k);
    R(g, x + 8, y + 11, 12, 1, P.k); R(g, x + 8, y + 23, 12, 1, P.k);
    R(g, x + 9, y + 8, 10, 4, P.wd2); box1(g, x + 9, y + 8, 10, 4, P.wd3);   // lid
    R(g, x + 13, y + 7, 2, 2, P.wd3);                                         // knob
    R(g, x + 9, y + 16, 4, 4, '#c8873a'); R(g, x + 14, y + 18, 4, 4, '#c8873a');
    R(g, x + 15, y + 14, 3, 3, '#b06a2a');
    R(g, x + 10, y + 17, 1, 1, '#5a3a1a'); R(g, x + 15, y + 19, 1, 1, '#5a3a1a');
    R(g, x + 8, y + 13, 3, 4, 'rgba(255,255,255,0.4)');                       // glass glint
    /* fruit bowl (rounded) */
    R(g, x + 27, y + 35, 10, 8, P.porc2);
    R(g, x + 26, y + 37, 12, 4, P.porc2);
    R(g, x + 27, y + 35, 10, 1, P.k); R(g, x + 27, y + 42, 10, 1, P.k);
    R(g, x + 26, y + 36, 1, 5, P.k); R(g, x + 37, y + 36, 1, 5, P.k);
    R(g, x + 28, y + 34, 3, 3, P.grn1); R(g, x + 32, y + 33, 3, 3, P.red); R(g, x + 30, y + 36, 3, 3, P.gold);
    /* stools (west side) */
    drawStool(g, 186, 306); drawStool(g, 186, 334);
}
function drawStool(g, x, y) {
    shadowRect(g, x + 1, y + 10, 11, 3);
    /* round seat: wood ring, dark cushion */
    R(g, x + 2, y, 8, 12, P.wd2);
    R(g, x, y + 2, 12, 8, P.wd2);
    R(g, x + 1, y + 1, 10, 10, P.wd2);
    R(g, x + 3, y + 3, 6, 6, P.slate);
    R(g, x + 4, y + 4, 3, 2, shade(P.slate, 18));
    R(g, x + 2, y + 1, 8, 1, P.k); R(g, x + 2, y + 10, 8, 1, P.k);
    R(g, x + 1, y + 2, 1, 8, P.k); R(g, x + 10, y + 2, 1, 8, P.k);
}

/* ── entry / hall ── */
function drawRunner(g) {
    var x = 134, y = 252, w = 28, h = 92;
    R(g, x, y, w, h, P.red2);
    box1(g, x + 1, y + 1, w - 2, h - 2, P.gold);
    for (var i = 0; i < 8; i++) R(g, x + 3, y + 8 + i * 11, w - 6, 1, shade(P.red2, -18));
}
function drawEntryTable(g) {
    var x = 150, y = 352, w = 16, h = 26;
    shadowRect(g, x + 1, y + h, w, 2);
    R(g, x, y, w, h, P.wd1); box1(g, x, y, w, h, P.wd3);
    /* key bowl + the GTI fob */
    R(g, x + 3, y + 4, 10, 8, P.slate2); box1(g, x + 3, y + 4, 10, 8, P.k);
    R(g, x + 6, y + 7, 3, 2, P.steel); R(g, x + 9, y + 6, 2, 3, P.red);
    /* a letter */
    R(g, x + 4, y + 16, 9, 6, P.w); box1(g, x + 4, y + 16, 9, 6, P.dim);
}
function drawMat(g) {
    var x = 132, y = 388, w = 32, h = 14;
    R(g, x, y, w, h, '#8a6c46');
    box1(g, x + 1, y + 1, w - 2, h - 2, '#573b26');
    R(g, x + 6, y + 5, 2, 4, P.gold); R(g, x + 10, y + 5, 2, 4, P.gold); R(g, x + 14, y + 5, 2, 4, P.gold);
    R(g, x + 18, y + 5, 2, 4, P.gold); R(g, x + 22, y + 5, 2, 4, P.gold);
}
function drawShoes(g) {
    var x = 134, y = 368;
    R(g, x, y, 5, 10, P.w); R(g, x + 6, y, 5, 10, P.w);
    R(g, x, y, 5, 3, P.red); R(g, x + 6, y, 5, 3, P.red);
    box1(g, x, y, 5, 10, P.k); box1(g, x + 6, y, 5, 10, P.k);
    R(g, x + 14, y + 2, 4, 9, P.slate); R(g, x + 19, y + 2, 4, 9, P.slate);
    box1(g, x + 14, y + 2, 4, 9, P.k); box1(g, x + 19, y + 2, 4, 9, P.k);
}
function drawFrontDoor(g) {
    /* open leaf into the hall */
    R(g, 132, 376, 5, 30, P.wd1); box1(g, 132, 376, 5, 30, P.wd3);
    R(g, 134, 388, 2, 3, P.gold);
}

/* ============================================================
   OBJECT REGISTRY — draw order is z-order; hit scan is reversed
   ============================================================ */
function fmtClock() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
var OBJ = [
    { id: 'rug',     r: [186, 66, 96, 96],   base: drawRug,        label: function () { return 'the rug · really ties the room together'; },
      poke: function () { SFX.blip(); } },
    { id: 'bedrug',  r: [40, 112, 48, 40],   base: drawBedRug,     label: function () { return 'the other rug · cold floor insurance'; },
      poke: function () { SFX.blip(); } },
    { id: 'runner',  r: [134, 252, 28, 92], base: drawRunner,     label: function () { return 'the runner · hallway with taste'; },
      poke: function () { SFX.blip(); } },

    { id: 'bed',     r: [28, 30, 60, 74],    base: drawBed,        label: function () { return 'the bed · load-bearing furniture'; },
      poke: function () { SFX.zzz(); spawnZzz(58, 40); animOn('bedDim', 1.6); } },
    { id: 'nstand',  r: [94, 32, 20, 18],    base: drawNightstand, label: function () { return ST.nlamp ? 'the little lamp (on) · book light' : 'the little lamp (off)'; },
      poke: function () { ST.nlamp = !ST.nlamp; SFX.click(); rebuildBase(); } },
    { id: 'dresser', r: [12, 112, 20, 44],   base: drawDresser,    label: function () { return 'the dresser · socks have a system'; },
      poke: function () { SFX.creak(); } },
    { id: 'basket',  r: [100, 140, 16, 18],  base: drawBasket,     label: function () { return 'laundry · a monday problem'; },
      poke: function () { SFX.fwmp(); animOn('sock', 0.9); } },

    { id: 'closet',  r: [12, 168, 64, 18],   base: drawCloset,     label: function () { return ST.closet ? 'the closet (open) · the fits live here' : 'the closet · slide it open'; },
      poke: function () { ST.closet = !ST.closet; SFX.creak(); rebuildBase(); } },
    { id: 'bins',    r: [16, 196, 68, 35],   base: drawClosetFloor, label: function () { return 'storage · labeled, ignored'; },
      poke: function () { SFX.blip(); } },
    { id: 'washer',  r: [84, 170, 34, 60],   base: drawWasher,     label: function () { return 'the wash · it thunders at 2 am'; },
      poke: function () { SFX.tumble(); animOn('tumble', 3.2); } },

    { id: 'mirror',  r: [18, 243, 26, 10],   base: null,           label: function () { return ST.mirrorEye ? 'the mirror · it definitely blinked' : 'the mirror · looking good'; },
      poke: function () {
          ST.mirrorPokes++;
          if (!ST.mirrorEye && ST.mirrorPokes >= 3) { ST.mirrorEye = true; animOn('eye', 1.1); SFX.eye(); toast('👁 <b>it sees you</b> · and it approves'); }
          else { SFX.blip(); }
      } },
    { id: 'vanity',  r: [14, 256, 38, 22],   base: drawVanity,     label: function () { return 'the sink · two-minute dentist rule'; },
      poke: function () { SFX.drip(); animOn('vdrip', 1.2); } },
    { id: 'toilet',  r: [14, 296, 18, 26],   base: drawToilet,     label: function () { return 'the toilet · yes it flushes'; },
      poke: function () { SFX.flush(); animOn('flush', 1.4); } },
    { id: 'bathmat', r: [56, 300, 30, 20],   base: drawBathMat,    label: function () { return 'the bath mat · surprisingly load-bearing too'; },
      poke: function () { SFX.blip(); } },
    { id: 'tub',     r: [14, 348, 96, 52],   base: drawTub,        label: function () { return 'the tub · big think tank'; },
      poke: function () { SFX.splash(); animOn('bubbles', 3.5); } },

    { id: 'counters', r: [176, 384, 108, 22], r2: [284, 288, 26, 118], base: drawCounters, label: function () { return 'the counters · crumbs classified'; },
      poke: function () { SFX.blip(); } },
    { id: 'sink',    r: [289, 310, 17, 26],  base: null,           label: function () { return 'the sink · dishes pending'; },
      poke: function () { SFX.drip(); animOn('kdrip', 1.2); } },
    { id: 'stove',   r: [208, 386, 36, 18],  base: null,           label: function () { return 'the stove · rarely on fire'; },
      poke: function () { SFX.sizzle(); animOn('sizzle', 2.8); } },
    { id: 'kettle',  r: [182, 387, 16, 14],  base: null,           label: function () { return 'the kettle · herbal only, chamomile preferred'; },
      poke: function () { SFX.whistle(); animOn('kettle', 2.4); } },
    { id: 'micro',   r: [252, 387, 24, 15],  base: null,           label: function () { return 'the microwave · 30 seconds of drama'; },
      poke: function () { SFX.blip(); animOn('micro', 2.6); setTimeout(function () { SFX.ding(); }, 2600); } },
    { id: 'fridge',  r: [282, 250, 28, 34],  base: drawFridge,     label: function () { return ST.fridge ? 'the fridge (open) · water, mostly · one emergency coke' : 'the fridge · poke to open'; },
      poke: function () { ST.fridge = !ST.fridge; SFX.fwmp(); rebuildBase(); } },
    { id: 'island',  r: [186, 296, 58, 60],  base: drawIsland,     label: function () { return 'the island · breakfast hq'; },
      poke: function () { SFX.blip(); } },
    { id: 'cookies', r: [208, 304, 12, 18],  base: null,           label: function () { return 'the cookie jar · lifetime count: ' + ST.cookies; },
      poke: function () {
          ST.cookies++; lsSet('room_cookies', '' + ST.cookies); SFX.crunch();
          if (ST.cookies === 10) toast('🍪 <b>ten cookies</b> · double digits, respect');
          else if (ST.cookies === 100) toast('🍪 <b>one hundred cookies</b> · the jar fears you');
          else if (ST.cookies === 1000) toast('🍪 <b>a thousand cookies</b> · seek help (or keep going)');
      } },

    { id: 'bookshelf', r: [176, 204, 18, 44], base: drawBookshelf, label: function () { return 'the books · heavy on the philosophy'; },
      poke: function () { SFX.ok(); animOn('bookwig', 0.8); } },
    { id: 'record',  r: [284, 204, 26, 42],  base: drawRecord,     label: function () { return ST.record ? 'now spinning · sad girl pop, obviously' : 'the record player · one genre on rotation'; },
      poke: function () {
          ST.record = !ST.record;
          if (ST.record) { musicStart(); SFX.click(); } else { musicStop(); SFX.click(); }
      } },
    { id: 'plant',   r: [132, 34, 14, 16],   base: drawPlant,      label: function () { return 'the plant · thriving, allegedly'; },
      poke: function () { SFX.blip(); animOn('leafwig', 0.8); } },
    { id: 'lamp',    r: [296, 36, 10, 16],   base: drawFloorLamp,  label: function () { return ST.lamp ? 'the lamp (on) · mood lighting' : 'the lamp (off) · poke for mood'; },
      poke: function () { ST.lamp = !ST.lamp; SFX.click(); rebuildBase(); } },

    { id: 'couch',   r: [192, 128, 68, 30],  base: drawCouch,      label: function () { return 'the couch · certified nap zone'; },
      poke: function () { SFX.fwmp(); animOn('squish', 0.5); } },
    { id: 'cowchair', r: [272, 118, 30, 32], base: drawCowChair,   label: function () { return 'the cow chair · it came like this'; },
      poke: function () {
          ST.moos++; SFX.moo(); animOn('moo', 0.7);
          if (ST.moos === 3) toast('🐄 <b>moo</b> · it appreciates the attention');
      } },
    { id: 'table',   r: [204, 88, 44, 26],   base: drawCoffeeTable, label: function () {
          if (T < ST.diceUntil) return 'rolling...';
          return ST.diceVal ? 'd20s · rolled a <b>' + ST.diceVal + '</b>' : 'd20s · roll for initiative';
      },
      poke: function () {
          if (T < ST.diceUntil) return;
          SFX.dice(); ST.diceUntil = T + 0.9; ST.diceVal = 0;
          setTimeout(function () {
              ST.diceVal = 1 + Math.floor(Math.random() * 20);
              if (ST.diceVal === 20) { toast('🎲 <b>nat 20</b> · called it'); SFX.fanfare(); spawnConfetti(226, 96, 18); }
              else if (ST.diceVal === 1) { toast('🎲 <b>nat 1</b> · the dice giveth'); }
              refreshTip();
              syncA11yBtn(objById('table'));
              announce('rolled a ' + ST.diceVal);
              needsDraw = true;
          }, 900);
      } },
    { id: 'deskchair', r: [206, 52, 24, 22], base: drawDeskChair,  label: function () { return 'the chair · ergonomic-ish'; },
      poke: function () { SFX.blip(); animOn('spin', 1.0); } },
    { id: 'tv',      r: [186, 12, 56, 17],   base: null,           label: function () { return ST.tv ? 'the tv (on) · nothing good on' : 'the tv (off) · poke to power on'; },
      poke: function () { ST.tv = !ST.tv; SFX.ok(); rebuildBase(); } },
    { id: 'desk',    r: [182, 30, 64, 22],   base: drawDeskTV,     label: function () { return 'the desk · homework happens eventually'; },
      poke: function () { SFX.blip(); } },
    { id: 'mug',     r: [186, 35, 12, 11],   base: null,           label: function () { return 'chamomile · somehow always hot'; },
      poke: function () { SFX.blip(); animOn('sip', 1.0); } },
    { id: 'camera',  r: [225, 34, 18, 15],   base: null,           label: function () { return 'the camera · careful with the dials'; },
      poke: function () { SFX.shutter(); animOn('flash', 0.28); } },
    { id: 'ureboy',  r: [204, 28, 20, 24],   base: null,           label: function () { return '<b>URE BOY</b>™ · this is the way in'; },
      poke: function () { enterConsole(); } },
    { id: 'poster',  r: [134, 12, 16, 14],   base: drawPoster,     label: function () { return 'the poster · a good eye'; },
      poke: function () { SFX.eye(); animOn('wink', 0.5); } },
    { id: 'clock',   r: [152, 14, 26, 12],   base: drawClock,      label: function () {
          return 'the clock · ' + fmtClock() + (ST.tod ? ' · time is bent (' + ST.tod + ')' : ' · poke to bend time');
      },
      poke: function () {
          var seq = [null, 'morning', 'day', 'evening', 'night'];
          ST.tod = seq[(seq.indexOf(ST.tod) + 1) % seq.length];
          SFX.click();
          toast(ST.tod ? '🕐 <b>' + ST.tod + '</b> · time bent' : '🕐 back to <b>real time</b>');
          curPhase = phaseNow(); rebuildBase(); refreshTip();
      } },

    { id: 'keys',    r: [150, 352, 16, 26],  base: drawEntryTable, label: function () { return 'the keys · GTI, silver, beloved'; },
      poke: function () { SFX.chirp(); animOn('chirp', 0.6); } },
    { id: 'shoes',   r: [134, 368, 24, 12],  base: drawShoes,      label: function () { return 'the shoes · a rotation of three'; },
      poke: function () { SFX.blip(); } },
    { id: 'mat',     r: [132, 388, 32, 14],  base: drawMat,        label: function () { return 'the mat · it means it'; },
      poke: function () { SFX.fwmp(); } },
    { id: 'door',    r: [132, 376, 8, 30],   r2: [132, 404, 32, 10], base: drawFrontDoor, label: function () { return 'the front door · knock knock'; },
      poke: function () {
          ST.knocks++; SFX.knock();
          if (ST.knocks === 3) toast('🚪 nobody home · <b>you</b> are the somebody');
      } }
];
function objById(id) { for (var i = 0; i < OBJ.length; i++) if (OBJ[i].id === id) return OBJ[i]; return null; }

/* ───────────────────── base prerender ─────────────────────── */
function rebuildBase() {
    drawShell(bg);
    for (var i = 0; i < OBJ.length; i++) if (OBJ[i].base) OBJ[i].base(bg);
}

/* ─────────────────────── particles ────────────────────────── */
var PARTS = [];
function addP(p) { if (PARTS.length < 220) PARTS.push(p); }
function spawnSteam(x, y) { addP({ k: 'steam', x: x + (thash(T * 60 | 0, x) - 0.5) * 3, y: y, vy: -7 - thash(x, T * 31 | 0) * 5, t: 0, life: 1.1 }); }
function spawnZzz(x, y) { if (reduce) return; for (var i = 0; i < 3; i++) addP({ k: 'zzz', x: x + i * 4, y: y - i * 2, vy: -6, t: -i * 0.28, life: 1.5 }); }
function spawnNote(x, y) { addP({ k: 'note', x: x, y: y, vy: -9, vx: (thash(T * 47 | 0, y) - 0.5) * 8, t: 0, life: 1.6 }); }
function spawnConfetti(x, y, n) {
    if (reduce) return;
    var cols = [P.red, P.gold, P.teal, P.blue, P.purp, P.pink, P.grn1];
    for (var i = 0; i < n; i++) addP({ k: 'conf', x: x + (Math.random() - 0.5) * 30, y: y, vy: 14 + Math.random() * 26, vx: (Math.random() - 0.5) * 22, t: 0, life: 1.6 + Math.random(), c: cols[i % cols.length] });
}
function spawnBubble(x, y) { addP({ k: 'bub', x: x, y: y, vy: -4 - thash(x, T * 13 | 0) * 4, t: 0, life: 1.2 }); }
function updParts(dt) {
    for (var i = PARTS.length - 1; i >= 0; i--) {
        var p = PARTS[i];
        p.t += dt;
        if (p.t < 0) continue;
        p.y += (p.vy || 0) * dt;
        p.x += (p.vx || 0) * dt;
        if (p.k === 'conf') p.vy += 30 * dt;
        if (p.t > p.life) PARTS.splice(i, 1);
    }
}
function drawParts(g) {
    for (var i = 0; i < PARTS.length; i++) {
        var p = PARTS[i];
        if (p.t < 0) continue;
        var f = 1 - p.t / p.life;
        var x = Math.round(p.x), y = Math.round(p.y);
        if (p.k === 'steam') {
            g.globalAlpha = 0.5 * f;
            g.fillStyle = P.w; g.fillRect(x, y, 2, 2);
            if (f < 0.6) g.fillRect(x - 1, y - 1, 1, 1);
        } else if (p.k === 'zzz') {
            g.globalAlpha = Math.min(1, f * 1.4);
            g.fillStyle = P.blue;
            g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x, y + 2, 3, 1);
        } else if (p.k === 'note') {
            g.globalAlpha = Math.min(1, f * 1.3);
            g.fillStyle = P.pink;
            g.fillRect(x, y, 1, 4); g.fillRect(x - 2, y + 3, 2, 2); g.fillRect(x + 1, y, 3, 1);
        } else if (p.k === 'conf') {
            g.globalAlpha = Math.min(1, f * 1.6);
            g.fillStyle = p.c; g.fillRect(x, y, 2, 2);
        } else if (p.k === 'bub') {
            g.globalAlpha = 0.6 * f;
            g.fillStyle = '#e8f4f6'; g.fillRect(x, y, 2, 2);
        }
    }
    g.globalAlpha = 1;
}

/* ─────────────────── dynamic frame drawing ────────────────── */
var STEAM_ACC = 0, NOTE_ACC = 0, MOTE_ACC = 0;
function drawDynamics(g, dt) {
    var ph = curPhase;

    /* mug steam — always on (it is somehow always hot) */
    if (!reduce) {
        STEAM_ACC += dt;
        if (STEAM_ACC > 0.34) {
            STEAM_ACC = 0;
            spawnSteam(191, 36);
            if (animT('kettle')) { spawnSteam(190, 386); spawnSteam(194, 385); }
            if (animT('sizzle')) spawnSteam(234, 386);
            if (animT('bubbles')) { spawnBubble(30 + thash(T * 17 | 0, 3) * 60, 360 + thash(T * 29 | 0, 7) * 30); }
        }
        if (ST.record) {
            NOTE_ACC += dt;
            if (NOTE_ACC > 0.55) { NOTE_ACC = 0; spawnNote(295, 208); }
        }
    }

    /* TV glow + screen flicker */
    if (ST.tv) {
        var fl = reduce ? 0.5 : (0.4 + 0.25 * thash(FR, 3));
        g.globalAlpha = 0.10 + fl * 0.10;
        g.fillStyle = '#cfe4f2';
        g.fillRect(184, 28, 60, 56);
        g.globalAlpha = 1;
        /* screen noise */
        if (!reduce) {
            for (var i = 0; i < 14; i++) {
                var hx = thash(FR * 7 + i, i * 13);
                g.fillStyle = hx > 0.5 ? '#e8f2f8' : '#9ab8cc';
                g.fillRect(189 + Math.floor(thash(i, FR) * 49), 15 + Math.floor(hx * 9), 2, 1);
            }
        }
    }

    /* URE BOY power LED + glow — the beacon */
    var bx = 206, by = 32;
    g.fillStyle = reduce ? P.red : ((FR % 2) ? P.red : '#ff6a4a');
    g.fillRect(bx + 1, by + 5, 1, 2);
    if (!reduce) {
        var pulse = (Math.sin(T * 2.2) + 1) / 2;
        g.globalAlpha = 0.08 + pulse * 0.13;
        g.fillStyle = '#ff5436';
        g.fillRect(bx - 4, by - 7, 24, 30);
        g.globalAlpha = 1;
        if (thash(FR, 99) > 0.82) { g.fillStyle = P.w; g.fillRect(bx + 3 + Math.floor(thash(FR, 5) * 11), by + 1 + Math.floor(thash(FR, 11) * 8), 1, 1); }
    }
    /* first-visit hint rings */
    if (animT('hint')) {
        var hf = 1 - (animT('hint') / 4);
        var rr = Math.floor((hf * 3 % 1) * 16) + 8;
        g.globalAlpha = 0.5 * (1 - (hf * 3 % 1));
        box1(g, bx + 8 - rr, by + 9 - rr, rr * 2, rr * 2, P.red);
        g.globalAlpha = 1;
    }

    /* the d20s: parked on the table, or mid-roll jiggle */
    if (T < ST.diceUntil && !reduce) {
        drawDie(g, 208 + Math.floor(thash(FR * 3, 1) * 8), 94 + Math.floor(thash(FR, 7) * 6), P.red, 1);
        drawDie(g, 220 + Math.floor(thash(FR * 5, 3) * 8), 98 + Math.floor(thash(FR, 13) * 6), P.purp, 1);
    } else {
        drawDie(g, 212, 96, P.red, 0);
        drawDie(g, 222, 101, P.purp, 0);
    }
    if (ST.diceVal && T >= ST.diceUntil && T < ST.diceUntil + 1.6) {
        /* result floats above the table */
        var s = '' + ST.diceVal;
        R(g, 220 - s.length * 2 - 2, 76, s.length * 4 + 4, 8, 'rgba(21,21,26,0.8)');
        t35(g, s, 220 - s.length * 2, 77, ST.diceVal === 20 ? P.gold : P.w);
    }

    /* washer tumble (top drum) — one static suds frame under reduced motion */
    if (animT('tumble')) {
        var wf = reduce ? 0 : FR;
        var wx = 95, wy = 180;
        g.fillStyle = ['#3d4650', '#2a3a4a', '#4a5a6a'][wf % 3];
        g.fillRect(wx + 1, wy + 1, 10, 10);
        g.fillStyle = P.blank;
        g.fillRect(wx + 2 + (wf % 3) * 2, wy + 2 + ((wf + 1) % 3) * 2, 4, 3);
        g.fillStyle = P.w;
        g.fillRect(wx + 6 - (wf % 3), wy + 5 + (wf % 2), 3, 2);
    }

    /* poster wink */
    if (animT('wink')) {
        R(g, 138, 17, 8, 6, P.w);
        g.fillStyle = P.k; g.fillRect(139, 19, 6, 1);
    }

    /* camera flash — skipped under reduced motion (the shutter poke still lands) */
    if (animT('flash') && !reduce) {
        g.globalAlpha = animT('flash') / 0.28 * 0.75;
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
    }

    /* mirror eye */
    if (animT('eye')) {
        R(g, 22, 244, 18, 7, '#0e1418');
        g.fillStyle = P.w;
        g.fillRect(25, 246, 12, 3);
        g.fillStyle = P.k; g.fillRect(30, 246, 3, 3);
        g.fillStyle = P.w; g.fillRect(30, 246, 1, 1);
    }

    /* toilet flush swirl */
    if (animT('flush')) {
        var tf = 1 - animT('flush') / 1.4;
        g.fillStyle = '#a8c8d8';
        g.fillRect(20 + Math.floor(thash(FR, 1) * 3), 296 + 12, 3, 2);
        g.fillRect(22, 296 + 13 + Math.floor(tf * 3), 2, 1);
    }

    /* sink drips */
    if (animT('kdrip')) { g.fillStyle = '#cfe4f0'; g.fillRect(294, 318 + Math.floor((1.2 - animT('kdrip')) * 14), 1, 2); }
    if (animT('vdrip')) { g.fillStyle = '#cfe4f0'; g.fillRect(32, 262 + Math.floor((1.2 - animT('vdrip')) * 8), 1, 2); }

    /* microwave hum glow */
    if (animT('micro')) {
        g.globalAlpha = reduce ? 0.45 : 0.35 + 0.2 * (FR % 2);
        g.fillStyle = P.yell;
        g.fillRect(255, 390, 13, 9);
        g.globalAlpha = 1;
    }

    /* stove pan sizzle spark */
    if (animT('sizzle') && !reduce) {
        g.fillStyle = P.amber;
        g.fillRect(230 + Math.floor(thash(FR * 3, 9) * 8), 386 + Math.floor(thash(FR, 21) * 3), 1, 1);
    }

    /* record spin */
    if (ST.record) {
        var rx = 289, ry = 209;
        g.fillStyle = '#26262b'; g.fillRect(rx + 2, ry + 2, 12, 12);
        g.fillStyle = '#17171a'; g.fillRect(rx + 3, ry + 3, 10, 10);
        g.fillStyle = P.red; g.fillRect(rx + 7, ry + 7, 2, 2);
        var a = (reduce ? 0 : T * 3) % (Math.PI * 2);
        g.fillStyle = '#3a3a40';
        g.fillRect(rx + 7 + Math.round(Math.cos(a) * 4), ry + 7 + Math.round(Math.sin(a) * 4), 1, 1);
        g.fillRect(rx + 7 - Math.round(Math.cos(a) * 4), ry + 7 - Math.round(Math.sin(a) * 4), 1, 1);
    }

    /* clock digits */
    t35(g, fmtClock(), 156, 18, P.amber);

    /* sunbeams + motes */
    if ((ph === 'morning' || ph === 'day') && !reduce) {
        g.globalAlpha = ph === 'morning' ? 0.07 : 0.05;
        g.fillStyle = '#fff8e0';
        g.fillRect(WIN_BED.x, 30, WIN_BED.w, 60);
        g.fillRect(WIN_BED.x + 6, 90, WIN_BED.w - 12, 26);
        g.fillRect(WIN_LIV.x, 30, WIN_LIV.w, 66);
        g.fillRect(WIN_LIV.x + 6, 96, WIN_LIV.w - 12, 28);
        g.globalAlpha = 1;
        MOTE_ACC += dt;
        if (MOTE_ACC > 0.5) {
            MOTE_ACC = 0;
            addP({ k: 'steam', x: WIN_LIV.x + 4 + thash(T * 7 | 0, 2) * (WIN_LIV.w - 8), y: 40 + thash(T * 11 | 0, 6) * 60, vy: 3, t: 0, life: 1.4 });
            addP({ k: 'steam', x: WIN_BED.x + 4 + thash(T * 13 | 0, 4) * (WIN_BED.w - 8), y: 40 + thash(T * 5 | 0, 8) * 50, vy: 3, t: 0, life: 1.4 });
        }
    }

    /* bed poke dim (skipped under reduced motion; the zzz already are) */
    if (animT('bedDim') && !reduce) {
        g.globalAlpha = 0.25 * (animT('bedDim') / 1.6);
        g.fillStyle = '#0a0c18';
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
    }
}

/* ─────────────── light + time-of-day overlay ──────────────── */
/* the hole cutter is a var-assigned expression: a function declaration in a
   block is a SyntaxError in true ES5 strict mode */
var holePunch = function (x, y, r, a) {
    var gr = dctxDark.createRadialGradient(x, y, 2, x, y, r);
    gr.addColorStop(0, 'rgba(0,0,0,' + (a || 0.9) + ')');
    gr.addColorStop(0.6, 'rgba(0,0,0,' + ((a || 0.9) * 0.55) + ')');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    dctxDark.fillStyle = gr;
    dctxDark.fillRect(x - r, y - r, r * 2, r * 2);
};
var darkKey = '';                                  // memo: overlay recomposes only when inputs change
function drawLight(g) {
    var ph = curPhase;
    var darkA = ph === 'night' ? 0.52 : ph === 'evening' ? 0.22 : ph === 'morning' ? 0.05 : 0;
    if (darkA > 0.01) {
        var flick = (!reduce && ST.tv) ? (FR % 2) : 0;
        var key = ph + '|' + (ST.lamp ? 1 : 0) + (ST.nlamp ? 1 : 0) + (ST.tv ? 1 : 0) +
                  (ST.fridge ? 1 : 0) + (animT('micro') ? 1 : 0) + '|' + flick;
        if (key !== darkKey) {
            darkKey = key;
            dctxDark.clearRect(0, 0, W, H);
            dctxDark.fillStyle = 'rgba(9,11,26,' + darkA + ')';
            dctxDark.fillRect(0, 0, W, H);
            dctxDark.globalCompositeOperation = 'destination-out';
            if (ST.lamp) holePunch(301, 42, 44);
            if (ST.nlamp) holePunch(103, 39, 32);
            if (ST.tv) holePunch(214, 46, 40, 0.7 + 0.2 * flick);
            if (ST.fridge) holePunch(272, 267, 24, 0.7);
            if (animT('micro')) holePunch(261, 394, 14, 0.8);
            holePunch(216, 40, 12, 0.55);                     // the URE BOY LED never sleeps
            holePunch(WIN_BED.x + WIN_BED.w / 2, 22, 30, 0.35);   // window glow
            holePunch(WIN_LIV.x + WIN_LIV.w / 2, 22, 30, 0.35);
            dctxDark.globalCompositeOperation = 'source-over';
        }
        g.drawImage(darkCv, 0, 0);
    }
    /* color washes */
    if (ph === 'morning') { g.fillStyle = 'rgba(255,205,150,0.08)'; g.fillRect(0, 0, W, H); }
    else if (ph === 'evening') { g.fillStyle = 'rgba(255,150,80,0.12)'; g.fillRect(0, 0, W, H); }
    else if (ph === 'night') { g.fillStyle = 'rgba(60,80,160,0.10)'; g.fillRect(0, 0, W, H); }
}

/* ───────────────── hover / focus outline ──────────────────── */
function drawHighlight(g) {
    var id = ST.hover || ST.focus;
    if (!id) return;
    var o = objById(id); if (!o) return;
    var pulse = reduce ? 0.85 : (FR % 2 === 0 ? 0.9 : 0.55);
    var rs = [o.r]; if (o.r2) rs.push(o.r2);
    for (var i = 0; i < rs.length; i++) {
        var r = rs[i];
        g.globalAlpha = 0.35;
        box1(g, r[0] - 3, r[1] - 3, r[2] + 6, r[3] + 6, P.k);
        g.globalAlpha = pulse;
        box1(g, r[0] - 2, r[1] - 2, r[2] + 4, r[3] + 4, P.w);
        g.globalAlpha = 1;
    }
}

/* ───────────────────── dither transition ──────────────────── */
var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
var TRANS = { on: false, t: 0, dur: 0.55, cb: null };
function transTo(cb) {
    if (reduce) { cb(); return; }
    TRANS.on = true; TRANS.t = 0; TRANS.cb = cb;
}
function drawTrans(g, dt) {
    if (!TRANS.on) return;
    TRANS.t += dt;
    var f = clamp(TRANS.t / TRANS.dur, 0, 1);
    var lvl = f * 16;
    g.fillStyle = P.k;
    for (var y = 0; y < H; y += 4) for (var x = 0; x < W; x += 4) {
        if (BAYER[((y / 4) % 4) * 4 + (x / 4) % 4] < lvl) g.fillRect(x, y, 4, 4);
    }
    if (f >= 1 && TRANS.cb) { var cb = TRANS.cb; TRANS.cb = null; cb(); }
}
var navDone = false, navTimer = null;
function goConsole() { if (navDone) return; navDone = true; window.location.href = '/ureboy/'; }
function enterConsole() {
    markPoked('ureboy');
    SFX.boot();
    transTo(goConsole);
    /* rAF can stall (hidden tab) — never strand the user mid-dither */
    navTimer = setTimeout(goConsole, 1100);
}

/* ──────────────────────── present ─────────────────────────── */
function present() {
    if (!disp) return;
    var cw = disp.width, ch = disp.height;
    var s = Math.min(cw / W, ch / H);
    var dw = Math.round(W * s), dh = Math.round(H * s);
    presentS = s;
    presentOX = (cw - dw) >> 1;
    presentOY = (ch - dh) >> 1;
    dctx.imageSmoothingEnabled = false;
    dctx.clearRect(0, 0, cw, ch);
    dctx.drawImage(buf, 0, 0, W, H, presentOX, presentOY, dw, dh);
}
function resize() {
    if (!disp || !holder) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var hw = Math.max(32, holder.clientWidth), hh = Math.max(32, holder.clientHeight);
    /* fit the diorama box inside the holder, keep aspect */
    var s = Math.min(hw / W, hh / H);
    var cssW = Math.max(32, Math.floor(W * s)), cssH = Math.floor(cssW * H / W);
    var pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
    if (disp.width === pw && disp.height === ph) return;      // size unchanged: skip the buffer wipe
    disp.style.width = cssW + 'px';
    disp.style.height = cssH + 'px';
    disp.width = pw;
    disp.height = ph;
    needsDraw = true;
    present();                                                // never leave a cleared canvas waiting for rAF
}

/* ─────────────────────── frame loop ───────────────────────── */
var lastFR = -1;
function frame(ts) {
    rafId = requestAnimationFrame(frame);
    var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    T += dt;
    FR = Math.floor(T / 0.45);

    /* phase can flip while the page sits open */
    var ph = phaseNow();
    if (ph !== curPhase) { curPhase = ph; rebuildBase(); needsDraw = true; }

    /* reduced motion: the scene is near-static, so only redraw on the two-frame
       clock tick or when an interaction marks the canvas dirty */
    if (reduce && !TRANS.on && !needsDraw && FR === lastFR) return;
    lastFR = FR;
    needsDraw = false;

    updParts(dt);

    ctx.drawImage(baseCv, 0, 0);
    drawDynamics(ctx, dt);
    drawLight(ctx);
    drawParts(ctx);                                   // particles glow over the night tint
    drawHighlight(ctx);
    drawTrans(ctx, dt);
    present();
}

/* ─────────────────────── HTML bits ────────────────────────── */
/* one persistent toast element: updates announce reliably and never stack */
var toastTimer = null, toastClearTimer = null;
function toast(html, ms) {
    var t = byId('toast'); if (!t) return;
    clearTimeout(toastTimer); clearTimeout(toastClearTimer);
    t.classList.remove('show');
    t.innerHTML = html;
    requestAnimationFrame(function () { t.classList.add('show'); });
    toastTimer = setTimeout(function () {
        t.classList.remove('show');
        toastClearTimer = setTimeout(function () { t.innerHTML = ''; }, 300);
    }, ms || 2600);
}
function announce(text) { var el = byId('srLive'); if (el) el.textContent = text; }
var tipEl = null, lastTipId = null, tipW = 0, tipH = 0;
function refreshTip() {
    if (!tipEl || tipEl.hidden) return;
    var id = ST.hover || ST.focus;
    var o = id && objById(id);
    if (o) {
        tipEl.innerHTML = o.label();
        tipW = tipEl.offsetWidth; tipH = tipEl.offsetHeight;
        lastTipId = id;
    }
}
function showTip(o, cx, cy, above) {
    if (!tipEl) return;
    tipEl.hidden = false;
    if (o.id !== lastTipId) {
        /* only rewrite + re-measure when the label actually changes — pointermove
           otherwise thrashes layout with a write-read cycle per event */
        lastTipId = o.id;
        tipEl.innerHTML = o.label();
        tipW = tipEl.offsetWidth; tipH = tipEl.offsetHeight;
    }
    var hr = holder.getBoundingClientRect();
    var x = cx - hr.left + 14;
    var y = above ? (cy - hr.top - tipH - 16) : (cy - hr.top + 18);
    x = clamp(x, 4, hr.width - tipW - 4);
    y = clamp(y, 4, hr.height - tipH - 4);
    tipEl.style.left = x + 'px';
    tipEl.style.top = y + 'px';
}
function hideTip() { if (tipEl) { tipEl.hidden = true; lastTipId = null; } }

/* poked tally */
function pokeableCount() { return OBJ.length; }
function updateTally() {
    var el = byId('pokeTally'); if (!el) return;
    el.textContent = '◉ ' + POKED.length + '/' + pokeableCount();
    el.setAttribute('aria-label', 'things poked: ' + POKED.length + ' of ' + pokeableCount());
    if (POKED.length >= pokeableCount()) el.classList.add('done');
}
function markPoked(id) {
    if (pokedHas(id)) return;
    POKED.push(id);
    lsSet('room_poked_v1', JSON.stringify(POKED));
    updateTally();
    if (POKED.length === pokeableCount()) {
        toast('🏠 <b>fully poked</b> · you found everything. the console misses you.', 3400);
        SFX.fanfare();
        spawnConfetti(W / 2, 60, 40);
    }
}

/* ─────────────────────── pointer input ────────────────────── */
function bufCoords(e) {
    /* compute the blit transform locally — presentS is only fresh while the
       rAF loop runs, and hits must land even before the first frame */
    var r = disp.getBoundingClientRect();
    if (!r.width || !r.height) return { x: -1, y: -1 };
    var px = (e.clientX - r.left) * (disp.width / r.width);
    var py = (e.clientY - r.top) * (disp.height / r.height);
    var s = Math.min(disp.width / W, disp.height / H) || 1;
    var ox = (disp.width - Math.round(W * s)) >> 1;
    var oy = (disp.height - Math.round(H * s)) >> 1;
    return { x: (px - ox) / s, y: (py - oy) / s };
}
function hitAt(bx, by) {
    for (var i = OBJ.length - 1; i >= 0; i--) {
        var o = OBJ[i];
        var rs = [o.r]; if (o.r2) rs.push(o.r2);
        for (var j = 0; j < rs.length; j++) {
            var r = rs[j];
            if (bx >= r[0] - 1 && bx < r[0] + r[2] + 1 && by >= r[1] - 1 && by < r[1] + r[3] + 1) return o;
        }
    }
    return null;
}
function onMove(e) {
    /* branch on the event's own pointerType — matchMedia('pointer: fine')
       describes the PRIMARY pointer and lies for touches on hybrid laptops */
    if (e.pointerType !== 'mouse') return;
    var c = bufCoords(e);
    var o = hitAt(c.x, c.y);
    var id = o ? o.id : null;
    if (id !== ST.hover) {
        ST.hover = id;
        needsDraw = true;
        disp.classList.toggle('pointing', !!id);
        if (o) showTip(o, e.clientX, e.clientY); else hideTip();
    } else if (o) {
        showTip(o, e.clientX, e.clientY);
    }
}
var tipTimer = null;
function onDown(e) {
    if (e.button !== 0 || e.isPrimary === false) return;   // no right/middle-click pokes, one finger only
    e.preventDefault();
    var c = bufCoords(e);
    var o = hitAt(c.x, c.y);
    if (!o) { hideTip(); return; }
    markPoked(o.id);
    o.poke();
    syncA11yBtn(o);
    refreshTip();
    needsDraw = true;
    if (e.pointerType !== 'mouse') {
        /* touch: surface the label briefly ABOVE the tap so the finger doesn't cover it */
        showTip(o, e.clientX, e.clientY, true);
        clearTimeout(tipTimer);
        tipTimer = setTimeout(hideTip, 1500);
    }
}

/* ─────────────────── keyboard / SR access ─────────────────── */
var A11YBTNS = {};
var TOGGLES = {
    tv: function () { return ST.tv; }, lamp: function () { return ST.lamp; },
    nstand: function () { return ST.nlamp; }, closet: function () { return ST.closet; },
    fridge: function () { return ST.fridge; }, record: function () { return ST.record; }
};
function stripTags(s) { return s.replace(/<[^>]*>/g, ''); }
function syncA11yBtn(o) {
    if (!o) return;
    var b = A11YBTNS[o.id]; if (!b) return;
    b.textContent = stripTags(o.label());
    if (TOGGLES[o.id]) b.setAttribute('aria-pressed', TOGGLES[o.id]() ? 'true' : 'false');
}
function buildA11y() {
    var nav = byId('a11yNav'); if (!nav) return;
    for (var i = 0; i < OBJ.length; i++) {
        (function (o) {
            var b = document.createElement('button');
            b.type = 'button';
            A11YBTNS[o.id] = b;
            b.addEventListener('focus', function () { ST.focus = o.id; needsDraw = true; });
            b.addEventListener('blur', function () { if (ST.focus === o.id) ST.focus = null; needsDraw = true; });
            b.addEventListener('click', function () {
                markPoked(o.id);
                o.poke();
                syncA11yBtn(o);
                announce(stripTags(o.label()));
                needsDraw = true;
            });
            nav.appendChild(b);
            syncA11yBtn(o);
        })(OBJ[i]);
    }
}

/* ─────────────────────────── boot ─────────────────────────── */
function boot() {
    holder = byId('roomHolder');
    disp = byId('roomView');
    tipEl = byId('tip');
    if (!holder || !disp) return;
    dctx = disp.getContext('2d');

    /* prefs */
    try {
        var prefs = JSON.parse(lsGet('room_prefs') || '{}');
        AU.soundOn = !!prefs.sound;
    } catch (e) {}
    var sb = byId('soundBtn');
    if (sb) {
        sb.setAttribute('aria-pressed', AU.soundOn ? 'true' : 'false');
        sb.textContent = (AU.soundOn ? '🔊' : '🔇') + ' SOUND';
        sb.addEventListener('click', function () {
            AU.soundOn = !AU.soundOn;
            sb.setAttribute('aria-pressed', AU.soundOn ? 'true' : 'false');
            sb.textContent = (AU.soundOn ? '🔊' : '🔇') + ' SOUND';
            if (AU.soundOn) tone(720, 0.08, 'square', 0.1); else musicStop();
            if (!AU.soundOn) ST.record = false;
            lsSet('room_prefs', JSON.stringify({ sound: AU.soundOn }));
        });
    }

    updateTally();
    buildA11y();
    rebuildBase();

    if (window.PointerEvent) {
        disp.addEventListener('pointermove', onMove, { passive: true });
        disp.addEventListener('pointerdown', onDown);
        disp.addEventListener('pointerleave', function (e) {
            /* touch pointers "leave" the instant the finger lifts — the tap tip's
               own timer handles hiding in that case */
            if (e.pointerType && e.pointerType !== 'mouse') return;
            ST.hover = null; disp.classList.remove('pointing'); hideTip(); needsDraw = true;
        });
        /* iOS grants user activation on pointerup, not pointerdown: nudge the
           AudioContext awake here so the tap's SFX actually sound */
        disp.addEventListener('pointerup', function () { if (AU.soundOn) AU.get(); });
    } else {
        /* pre-PointerEvent engines (iOS 12, old WebViews): same handlers, older events */
        disp.addEventListener('mousemove', function (e) { e.pointerType = 'mouse'; onMove(e); });
        disp.addEventListener('mousedown', function (e) { if (e.button !== 0) return; e.isPrimary = true; e.pointerType = 'mouse'; onDown(e); });
        disp.addEventListener('mouseleave', function () { ST.hover = null; disp.classList.remove('pointing'); hideTip(); needsDraw = true; });
        disp.addEventListener('touchstart', function (e) {
            if (!e.touches || e.touches.length !== 1) return;
            var t = e.touches[0];
            onDown({ button: 0, isPrimary: true, pointerType: 'touch', clientX: t.clientX, clientY: t.clientY, preventDefault: function () { e.preventDefault(); } });
        });
        disp.addEventListener('touchend', function () { if (AU.soundOn) AU.get(); });
    }

    /* bfcache restore (back-swipe from /ureboy/) resumes the JS heap as-is:
       un-black the dither and re-arm navigation or the room comes back dead */
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) {
            navDone = false; TRANS.on = false; TRANS.t = 0; TRANS.cb = null;
            clearTimeout(navTimer);
            needsDraw = true;
        }
    });

    if (window.ResizeObserver) { new ResizeObserver(resize).observe(holder); }
    window.addEventListener('resize', resize);
    resize();

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) { musicStop(); }
        else if (ST.record) musicStart();
    });

    /* first-visit nudge toward the glowing thing */
    if (!lsGet('room_hinted') && !reduce) {
        setTimeout(function () { animOn('hint', 4); lsSet('room_hinted', '1'); }, 1400);
    }

    rafId = requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
