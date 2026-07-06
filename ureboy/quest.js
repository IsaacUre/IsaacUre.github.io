/* ============================================================
   URE QUEST — The Check-Engine Prophecy
   A pocket CRPG for the URE BOY. Native 160x144, d20 rules,
   zero dependencies, one file. Mounted by app.js via
   window.UreQuest.mount(holder, api).

   The rules are D&D-shaped on purpose and the geography is
   suspiciously familiar: Ricewood, the West Hedges, the
   Permian Wastes. Any resemblance to a real GPA is coincidence.
   ============================================================ */
window.UreQuest = (function () {
'use strict';

/* ─────────────────────────── core ─────────────────────────── */
var api = null, root = null, view = null, vctx = null;
var mounted = false, rafId = 0, resizeObs = null, booted = false;

var W = 160, H = 144, TS = 16;                    // the sacred resolution
var buf = document.createElement('canvas');       // everything renders here at 1x
buf.width = W; buf.height = H;
var ctx = buf.getContext('2d');
var gbBuf = document.createElement('canvas');     // DMG-green post-process target
gbBuf.width = W; gbBuf.height = H;
var gbCtx = gbBuf.getContext('2d');

/* palette — GBC-plus: low count, modern dusk */
var P = {
    k:  '#15151a', w:  '#f8f4e3', dim:'#8d8d7e',
    red:'#d81e05', red2:'#8f1305', amber:'#f2a30f', gold:'#e8c04a', yell:'#f4dd7c',
    g1: '#7aa254', g2: '#5d8544', g3: '#42663a', g4: '#2f4d2e',
    pa1:'#d8c08a', pa2:'#b89b64', dirt:'#8a6c46',
    w1: '#3d6fb0', w2: '#5e93cf', w3: '#8fc0e8',
    s1: '#9a9aa2', s2: '#6f6f7a', s3: '#4a4a55', s4:'#33333d',
    br1:'#b06a4a', br2:'#8a4c34',
    wd1:'#a8794e', wd2:'#7c5636', wd3:'#573b26',
    sa1:'#e0c489', sa2:'#c4a366', sa3:'#a08050',
    sky:'#8fb4d8', night:'#1d2030', dusk:'#3a3550',
    skin:'#eec39a', skin2:'#c68d5c', hair:'#4a3626',
    purp:'#7b53c9', purp2:'#4d3383', teal:'#1f9e98', blue:'#4a6bd8',
    pink:'#d86aa0', smoke:'#8b8f96', hp:'#4fae4f', hpLow:'#d8a11e', foc:'#5e93cf'
};
/* the DMG-green LUT used when the site is in Game Boy theme */
var DMG = [[15,56,15],[48,98,48],[139,172,15],[199,220,111]];

/* ─────────────────────── tiny helpers ─────────────────────── */
function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function d(n) { return 1 + Math.floor(Math.random() * n); }
function ch(p) { return Math.random() < p; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function mod(v) { return Math.floor((v - 10) / 2); }
function fmtMod(m) { return (m >= 0 ? '+' : '') + m; }
/* deterministic per-tile hash for grass speckle etc. */
function thash(x, y) { var n = (x * 374761393 + y * 668265263) >>> 0; n = (n ^ (n >> 13)) * 1274126177 >>> 0; return ((n ^ (n >> 16)) >>> 0) / 4294967295; }

/* ───────────────────────── save file ──────────────────────── */
var SAVE_KEY = 'uq_save_v2';
var G = null;                                     // the whole game state
function save() {
    if (!G) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {}
}
function loadSave() {
    try { var s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

/* ───────────────────────── audio ──────────────────────────── */
var AC = null;
function audioOn() { return api && api.soundOn() && !document.hidden; }
function ac() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
    return AC;
}
function tone(freq, dur, type, vol, slideTo, when) {
    if (!audioOn()) return;
    var a = ac(); if (!a) return;
    var t0 = when || a.currentTime;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.035, t0);
    g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
}
function toneAt(delay, freq, dur, type, vol, slideTo) {
    var a = ac(); if (!a) return;
    tone(freq, dur, type, vol, slideTo, a.currentTime + delay);
}
var noiseBuf = null;
function noise(dur, vol, freq, when) {
    if (!audioOn()) return;
    var a = ac(); if (!a) return;
    if (!noiseBuf) {
        noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * 0.5), a.sampleRate);
        var dd = noiseBuf.getChannelData(0);
        for (var i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
    }
    var t0 = when || a.currentTime;
    var src = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    src.buffer = noiseBuf; src.loop = true;
    f.type = 'bandpass'; f.frequency.value = freq || 800; f.Q.value = 0.8;
    g.gain.setValueAtTime(vol || 0.03, t0);
    g.gain.exponentialRampToValueAtTime(0.0004, t0 + dur);
    src.connect(f); f.connect(g); g.connect(a.destination);
    src.start(t0); src.stop(t0 + dur + 0.02);
}
/* the console SFX kit */
var SFX = {
    move:  function () { tone(620, 0.03, 'square', 0.02); },
    ok:    function () { tone(760, 0.05, 'square', 0.03); toneAt(0.05, 1140, 0.07, 'square', 0.025); },
    no:    function () { tone(190, 0.09, 'sawtooth', 0.03, 120); },
    dice:  function () { noise(0.03, 0.03, 2400); tone(320 + ri(0, 200), 0.03, 'square', 0.02); },
    hit:   function () { noise(0.07, 0.05, 900); tone(170, 0.09, 'square', 0.04, 60); },
    crit:  function () { tone(220, 0.16, 'sawtooth', 0.05, 990); noise(0.14, 0.05, 1600); },
    hurt:  function () { tone(120, 0.14, 'sawtooth', 0.045, 55); },
    whiff: function () { noise(0.06, 0.02, 500); },
    heal:  function () { tone(520, 0.09, 'triangle', 0.04, 780); toneAt(0.08, 780, 0.12, 'triangle', 0.03, 1040); },
    coin:  function () { tone(990, 0.05, 'square', 0.03); toneAt(0.05, 1320, 0.09, 'square', 0.025); },
    door:  function () { noise(0.09, 0.03, 300); tone(140, 0.08, 'triangle', 0.03); },
    text:  function () { tone(880, 0.012, 'square', 0.008); },
    magic: function () { tone(340, 0.16, 'sine', 0.045, 1400); },
    zap:   function () { tone(1200, 0.1, 'sawtooth', 0.04, 180); },
    shutter: function () { noise(0.02, 0.06, 4000); tone(1600, 0.03, 'square', 0.03); },
    rev:   function () { tone(70, 0.3, 'sawtooth', 0.05, 160); noise(0.25, 0.02, 300); },
    roar:  function () { noise(0.4, 0.06, 250); tone(90, 0.35, 'sawtooth', 0.05, 40); },
    level: function () { [523, 659, 784, 1047].forEach(function (f, i) { toneAt(i * 0.09, f, 0.13, 'square', 0.035); }); },
    fanfare: function () { [392, 392, 392, 523, 659, 784].forEach(function (f, i) { toneAt(i * 0.1, f, i === 5 ? 0.4 : 0.09, 'square', 0.035); }); },
    egg:   function () { tone(880, 0.08, 'square', 0.03); toneAt(0.09, 1180, 0.1, 'square', 0.03); }
};

/* music — a very small sequencer: square lead, triangle bass, noise hats.
   notes are 8th-note tokens; '-' rests. Lead and bass loop independently. */
function nfreq(tok) {
    var m = /^([a-g])(#?)(\d)$/.exec(tok); if (!m) return 0;
    var semis = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1]] + (m[2] ? 1 : 0);
    var midi = semis + (parseInt(m[3], 10) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
}
var TRACKS = {
    title:  { bpm: 104, lv: 0.02, bv: 0.028,
        ld: 'e4 - g4 - b4 - e5 - d5 - b4 g4 a4 - f#4 - g4 - e4 - b3 - e4 g4 a4 f#4 d4 f#4 a4 - b4 -',
        bs: 'e2 - e3 - e2 - e3 - a1 - a2 - a1 - a2 - g1 - g2 - g1 - g2 - b1 - b2 - b1 - b2 -' },
    commons:{ bpm: 112, lv: 0.018, bv: 0.024, hat: 'x.x.x.xx',
        ld: 'g4 e4 c4 e4 g4 c5 - g4 a4 f4 c4 f4 a4 c5 - a4 g4 e4 c4 e4 d4 e4 f4 d4 e4 - c4 - - - g3 -',
        bs: 'c2 g2 e2 g2 f2 c3 a2 c3 g2 d3 b2 d3 c2 g2 e2 g2' },
    chaus:  { bpm: 92, lv: 0.016, bv: 0.022, hat: 'x..x..x.',
        ld: 'a4 - c5 a4 g4 - e4 - f4 - a4 c5 a4 - g4 - e4 - g4 e4 d4 - c4 - d4 e4 f4 e4 d4 - c4 -',
        bs: 'f2 - c3 - g2 - c3 - a2 - e3 - g2 - c3 -' },
    hedges: { bpm: 84, lv: 0.017, bv: 0.022,
        ld: 'd4 - f4 g4 a4 - c5 a4 g4 - f4 - e4 - d4 - c4 - e4 f4 g4 - b4 g4 a4 - g4 f4 d4 - - -',
        bs: 'd2 - a2 - d2 - a2 - c2 - g2 - c2 - g2 -' },
    wastes: { bpm: 76, lv: 0.016, bv: 0.024,
        ld: 'e4 f4 e4 - d4 - c4 - b3 - c4 d4 c4 - b3 - e4 - f4 - e4 d4 c4 - d4 - b3 - e4 - - -',
        bs: 'e2 - - - e2 - - - a1 - - - b1 - - -' },
    depths: { bpm: 66, lv: 0.015, bv: 0.026,
        ld: 'a3 - - - c4 - - - e4 - d#4 - e4 - c4 - a3 - - - e3 - - - f3 - e3 - d3 - - -',
        bs: 'a1 - - - a1 - - - f1 - - - e1 - - -' },
    battle: { bpm: 144, lv: 0.02, bv: 0.03, hat: 'x.xxx.xx',
        ld: 'e4 e4 g4 e4 a4 e4 b4 c5 b4 g4 e4 g4 d4 e4 f4 d4 e4 e4 g4 e4 a4 e4 c5 b4 g4 a4 b4 c5 d5 b4 g4 e4',
        bs: 'e2 e2 e3 e2 e2 e3 e2 e2 c2 c2 c3 c2 d2 d2 d3 d2' },
    boss:   { bpm: 152, lv: 0.022, bv: 0.032, hat: 'xxx.x.xx',
        ld: 'e4 f4 e4 d4 e4 - g4 - a4 g#4 a4 b4 c5 - b4 - e4 f4 e4 f4 g4 a4 g4 f4 e4 - d4 - b3 - - -',
        bs: 'e2 e2 f2 f2 e2 e2 d2 d2 a1 a1 a#1 a#1 b1 b1 b1 b1' },
    camp:   { bpm: 70, lv: 0.014, bv: 0.02,
        ld: 'c4 - e4 - g4 - e4 - a4 - g4 - e4 - d4 - c4 - e4 - g4 - c5 - b4 - g4 - e4 - - -',
        bs: 'c2 - - - a1 - - - f1 - - - g1 - - -' }
};
var MUS = { id: null, step: 0, nextAt: 0 };
function music(id) {
    if (MUS.id === id) return;
    MUS.id = id; MUS.step = 0; MUS.nextAt = 0;
}
function stopMusic() { MUS.id = null; }
function tickMusic() {
    if (!MUS.id || !audioOn()) return;
    var a = ac(); if (!a) return;
    var tr = TRACKS[MUS.id]; if (!tr) return;
    if (!tr._ld) { tr._ld = tr.ld.split(/\s+/); tr._bs = tr.bs.split(/\s+/); tr._ht = tr.hat ? tr.hat.split('') : null; }
    var stepDur = 60 / tr.bpm / 2;
    if (MUS.nextAt < a.currentTime) MUS.nextAt = a.currentTime + 0.05;
    while (MUS.nextAt < a.currentTime + 0.18) {
        var lt = tr._ld[MUS.step % tr._ld.length];
        var bt = tr._bs[MUS.step % tr._bs.length];
        var f;
        if (lt && lt !== '-' && (f = nfreq(lt))) tone(f, stepDur * 0.92, 'square', tr.lv, 0, MUS.nextAt);
        if (bt && bt !== '-' && (f = nfreq(bt))) tone(f, stepDur * 0.95, 'triangle', tr.bv, 0, MUS.nextAt);
        if (tr._ht && tr._ht[MUS.step % tr._ht.length] === 'x') noise(0.03, 0.008, 6000, MUS.nextAt);
        MUS.nextAt += stepDur; MUS.step++;
    }
}

/* ────────────────────────── FX state ──────────────────────── */
var FX = { shakeT: 0, shakeM: 0, stop: 0, flashT: 0, flashD: 1, flashC: '#fff' };
function shake(mag, t) { if (api && api.reduced) return; FX.shakeM = mag; FX.shakeT = t; }
function hitstop(t) { if (api && api.reduced) return; FX.stop = t; }
function flashFx(color, t) { FX.flashC = color; FX.flashT = t; FX.flashD = t; }

var parts = [];                                    // particle pool
function addP(p) { if (parts.length < 220) parts.push(p); }
function burstP(x, y, colors, n, spd) {
    for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, v = (spd || 40) * (0.4 + Math.random() * 0.8);
        addP({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 18, g: 90, life: 0.5 + Math.random() * 0.4, t: 0, c: pick(colors), s: ch(0.4) ? 2 : 1 });
    }
}
function ftext(x, y, s, c) {
    addP({ x: x, y: y, vx: ri(-6, 6), vy: -34, g: 40, life: 0.85, t: 0, c: c || P.w, s: 1, txt: s });
}
function updParts(dt) {
    for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.t += dt; if (p.t >= p.life) { parts.splice(i, 1); continue; }
        p.vy += (p.g || 0) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
    }
}
/* particles are SCREEN-space by default; world-space ones carry p.world
   and are drawn only by the world pass (so overlays never double-draw) */
function drawParts(ox, oy, worldMode) {
    ox = ox || 0; oy = oy || 0;
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i], a = 1 - p.t / p.life;
        if (worldMode ? !p.world : p.world) continue;
        ctx.globalAlpha = a < 0.5 ? a * 2 : 1;
        if (p.txt) txt(p.txt, Math.round(p.x - ox), Math.round(p.y - oy), p.c);
        else { ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x - ox), Math.round(p.y - oy), p.s, p.s); }
        ctx.globalAlpha = 1;
    }
}

/* scene transition: 4x4 bayer dither to black and back (very Game Boy) */
var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
var TRANS = { on: false, t: 0, dur: 0.32, phase: 0, cb: null };
function transTo(cb, dur) {
    if (TRANS.on) return;
    TRANS.on = true; TRANS.t = 0; TRANS.phase = 0; TRANS.cb = cb; TRANS.dur = dur || 0.32;
    if (api && api.reduced) TRANS.t = TRANS.dur;
}
function updTrans(dt) {
    if (!TRANS.on) return;
    TRANS.t += dt;
    if (TRANS.t >= TRANS.dur) {
        if (TRANS.phase === 0) { TRANS.phase = 1; TRANS.t = 0; if (TRANS.cb) TRANS.cb(); if (api && api.reduced) TRANS.t = TRANS.dur; }
        else TRANS.on = false;
    }
}
function drawTrans() {
    if (!TRANS.on) return;
    var f = clamp(TRANS.t / TRANS.dur, 0, 1);
    var lvl = TRANS.phase === 0 ? f * 16 : (1 - f) * 16;
    ctx.fillStyle = P.k;
    for (var y = 0; y < H; y += 4) for (var x = 0; x < W; x += 4) {
        if (BAYER[((y / 4) % 4) * 4 + (x / 4) % 4] < lvl) ctx.fillRect(x, y, 4, 4);
    }
}

/* ─────────────────────── scene stack ──────────────────────── */
var stack = [];
function top() { return stack[stack.length - 1]; }
function push(s) { stack.push(s); if (s.enter) s.enter(); }
function pop() { var s = stack.pop(); if (s && s.exit) s.exit(); }
function repl(s) { while (stack.length) pop(); push(s); }
function swapTop(s) { pop(); push(s); }

/* ─────────────────────── main loop ────────────────────────── */
var last = 0, animT = 0;
function frame(ts) {
    if (!mounted) return;
    rafId = requestAnimationFrame(frame);
    var dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    animT += dt;
    tickMusic();
    if (FX.stop > 0) FX.stop -= dt;
    else {
        var s = top();
        if (s && s.u) s.u(dt);
        updParts(dt);
    }
    if (FX.shakeT > 0) FX.shakeT -= dt;
    if (FX.flashT > 0) FX.flashT -= dt;
    updTrans(dt);
    /* draw: find deepest opaque scene, draw up from there */
    var from = 0;
    for (var i = stack.length - 1; i >= 0; i--) { if (stack[i].opaque) { from = i; break; } }
    ctx.fillStyle = P.k; ctx.fillRect(0, 0, W, H);
    for (var j = from; j < stack.length; j++) { if (stack[j].d) stack[j].d(); }
    if (FX.flashT > 0) {
        ctx.globalAlpha = clamp(FX.flashT / FX.flashD, 0, 1);
        ctx.fillStyle = FX.flashC; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
    }
    drawTrans();
    blit();
}

/* integer-zoom blit; optional DMG-green quantize when the site theme says so */
var ZOOM = 2;
function blit() {
    if (!view || !vctx) return;
    var src = buf;
    if (document.body.classList.contains('theme-gameboy')) {
        var id = ctx.getImageData(0, 0, W, H), dd = id.data;
        for (var i = 0; i < dd.length; i += 4) {
            var lum = dd[i] * 0.3 + dd[i + 1] * 0.6 + dd[i + 2] * 0.1;
            var c = DMG[lum < 56 ? 0 : lum < 118 ? 1 : lum < 190 ? 2 : 3];
            dd[i] = c[0]; dd[i + 1] = c[1]; dd[i + 2] = c[2];
        }
        gbCtx.putImageData(id, 0, 0);
        src = gbBuf;
    }
    var ox = 0, oy = 0;
    if (FX.shakeT > 0) { ox = ri(-FX.shakeM, FX.shakeM); oy = ri(-FX.shakeM, FX.shakeM); }
    vctx.imageSmoothingEnabled = false;
    vctx.fillStyle = '#0a0b10';
    vctx.fillRect(0, 0, view.width, view.height);
    vctx.drawImage(src, 0, 0, W, H, ox * ZOOM, oy * ZOOM, W * ZOOM, H * ZOOM);
}
function sizeView() {
    if (!root || !view) return;
    var dpr = window.devicePixelRatio || 1;
    var bw = root.clientWidth, bh = root.clientHeight;
    if (!bw || !bh) return;
    ZOOM = Math.max(1, Math.floor(Math.min(bw * dpr / W, bh * dpr / H)));
    view.width = W * ZOOM; view.height = H * ZOOM;
    view.style.width = (W * ZOOM / dpr) + 'px';
    view.style.height = (H * ZOOM / dpr) + 'px';
}

/* ────────────────────────── text ──────────────────────────── */
/* Press Start 2P at 8px — every glyph is an 8x8 cell, so it lands
   crisply on our 1x buffer. A hand-rolled 3x5 micro font covers
   HUD numbers where 8px is too fat. */
var FONT = '"Press Start 2P", monospace';
function txt(s, x, y, c) {
    ctx.font = '8px ' + FONT;
    ctx.textBaseline = 'top';
    ctx.fillStyle = c || P.w;
    ctx.fillText(s, x, y);
}
function txtC(s, cx, y, c) { txt(s, Math.round(cx - s.length * 4), y, c); }
function txtBig(s, x, y, c) {
    ctx.font = '16px ' + FONT;
    ctx.textBaseline = 'top';
    ctx.fillStyle = c || P.w;
    ctx.fillText(s, x, y);
}
function txtBigC(s, cx, y, c) { txtBig(s, Math.round(cx - s.length * 8), y, c); }
/* shadowed text for banners */
function txtSh(s, x, y, c, sc) { txt(s, x + 1, y + 1, sc || P.k); txt(s, x, y, c); }
function txtShC(s, cx, y, c, sc) { txtSh(s, Math.round(cx - s.length * 4), y, c, sc); }

function wrap(s, cols) {
    var out = [], line = '';
    s.split(' ').forEach(function (wd) {
        if ((line + (line ? ' ' : '') + wd).length <= cols) line += (line ? ' ' : '') + wd;
        else { if (line) out.push(line); while (wd.length > cols) { out.push(wd.slice(0, cols)); wd = wd.slice(cols); } line = wd; }
    });
    if (line) out.push(line);
    return out;
}

/* micro 3x5 font: digits + the handful of glyphs the HUD needs */
var F35 = {
    '0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111',
    '4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001010010010',
    '8':'111101111101111','9':'111101111001111','/':'001001010100100','+':'000010111010000',
    '-':'000000111000000',':':'000010000010000','%':'101001010100101','L':'100100100100111',
    'V':'101101101101010','H':'101101111101101','P':'111101111100100','G':'111100101101111',
    'F':'111100111100100','C':'111100100100111','A':'010101111101101','X':'101101010101101',
    'D':'110101101101110','E':'111100111100111','.':'000000000000010',' ':'000000000000000',
    'I':'111010010010111','S':'111100111001111','O':'111101101101111','R':'110101110101101',
    'N':'101111111101101','T':'111010010010010','M':'101111101101101','K':'101110100110101',
    'B':'110101110101110','U':'101101101101111','W':'101101101111101','Y':'101101010010010'
};
function t35(s, x, y, c) {
    ctx.fillStyle = c || P.w;
    for (var i = 0; i < s.length; i++) {
        var g = F35[s[i]]; if (!g) { x += 4; continue; }
        for (var p = 0; p < 15; p++) if (g[p] === '1') ctx.fillRect(x + (p % 3), y + Math.floor(p / 3), 1, 1);
        x += 4;
    }
}

/* ───────────────────────── UI chrome ──────────────────────── */
/* the classic double-border dialog box */
function box(x, y, w, h, opts) {
    opts = opts || {};
    ctx.fillStyle = opts.bg || '#232330';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = opts.edge || P.w;
    ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
    ctx.fillRect(x + 1, y + 1, 1, h - 2); ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
    ctx.fillStyle = opts.bg || '#232330';
    ctx.fillRect(x + 1, y + 1, 1, 1); ctx.fillRect(x + w - 2, y + 1, 1, 1);
    ctx.fillRect(x + 1, y + h - 2, 1, 1); ctx.fillRect(x + w - 2, y + h - 2, 1, 1);
    ctx.fillStyle = opts.edge2 || P.dim;
    ctx.fillRect(x + 2, y + 2, w - 4, 1);
}
function bar(x, y, w, h, frac, fg, bg) {
    ctx.fillStyle = bg || '#101018'; ctx.fillRect(x, y, w, h);
    var fw = Math.round((w - 2) * clamp(frac, 0, 1));
    ctx.fillStyle = fg; if (fw > 0) ctx.fillRect(x + 1, y + 1, fw, h - 2);
}
/* the little blinking "more text" arrow */
function moreArrow(x, y) {
    if (Math.floor(animT * 3) % 2) { ctx.fillStyle = P.w; ctx.fillRect(x, y, 5, 1); ctx.fillRect(x + 1, y + 1, 3, 1); ctx.fillRect(x + 2, y + 2, 1, 1); }
}
/* selection cursor ▶ */
function cursor(x, y, c) {
    ctx.fillStyle = c || P.gold;
    ctx.fillRect(x, y, 1, 5); ctx.fillRect(x + 1, y + 1, 1, 3); ctx.fillRect(x + 2, y + 2, 1, 1);
}

/* ───────────────────── sprite decoder ─────────────────────── */
/* sprites are strings; each char is a palette key, '.' transparent.
   decoded to an offscreen canvas once, cached by id+variant. */
var CH = {
    o: '#141418', W: '#f8f4e3', w: '#c9c4ae', S: '#eec39a', s: '#c68d5c', H: '#4a3626',
    B: '#2e2a33', G: '#9a9aa2', g: '#6f6f7a', F: '#4a4a55', R: '#d81e05', r: '#8f1305',
    Y: '#e8c04a', y: '#f4dd7c', A: '#f2a30f', P: '#7b53c9', p: '#4d3383', T: '#1f9e98',
    L: '#4a6bd8', l: '#8fc0e8', E: '#5d8544', e: '#2f4d2e', N: '#8a6c46', n: '#b89b64',
    D: '#57402c', M: '#d86aa0', K: '#101012', X: '#8b8f96', Z: '#39434d', Q: '#e0c489',
    U: '#3d6fb0', V: '#7aa254', C: '#888888', c: '#555555', I: '#b06a4a', i: '#8a4c34'
};
var SPRD = {};       // sprite definitions: id -> {w,h,rows:[...], pal:{overrides}}
var SPRC = {};       // decoded canvas cache: key -> canvas
function defSpr(id, rows, pal) {
    SPRD[id] = { w: rows[0].length, h: rows.length, rows: rows, pal: pal || null };
}
function sprCanvas(id, tint) {
    var key = id + (tint ? '~' + tint : '');
    if (SPRC[key]) return SPRC[key];
    var def = SPRD[id]; if (!def) return null;
    var c = document.createElement('canvas'); c.width = def.w; c.height = def.h;
    var g = c.getContext('2d');
    for (var y = 0; y < def.h; y++) {
        var row = def.rows[y];
        for (var x = 0; x < def.w; x++) {
            var chr = row[x];
            if (!chr || chr === '.') continue;
            var col = (def.pal && def.pal[chr]) || CH[chr] || '#ff00ff';
            if (tint && chr === 'C') col = tint;                    // C = tintable primary
            if (tint && chr === 'c') col = shade(tint, -30);        // c = tintable shade
            g.fillStyle = col;
            g.fillRect(x, y, 1, 1);
        }
    }
    SPRC[key] = c;
    return c;
}
function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = clamp((n >> 16) + amt, 0, 255), g2 = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
    return '#' + ((1 << 24) + (r << 16) + (g2 << 8) + b).toString(16).slice(1);
}
function drawSpr(id, x, y, o) {
    o = o || {};
    var c = sprCanvas(id, o.tint);
    if (!c) return;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.flip) {
        ctx.translate(Math.round(x) + c.width * (o.scale || 1), Math.round(y));
        ctx.scale(-(o.scale || 1), o.scale || 1);
        ctx.drawImage(c, 0, 0);
    } else if (o.scale && o.scale !== 1) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(c, Math.round(x), Math.round(y), c.width * o.scale, c.height * o.scale);
    } else {
        ctx.drawImage(c, Math.round(x), Math.round(y));
    }
    ctx.restore();
}
function sprW(id) { return SPRD[id] ? SPRD[id].w : 16; }
function sprH(id) { return SPRD[id] ? SPRD[id].h : 16; }

/* ─────────────────────── sprite art ───────────────────────── */
/* The hero — 16x16, four directions, two frames. 'C'/'c' tint to
   the chosen class color. */
defSpr('pd0', [
'................',
'.....oooooo.....',
'....oHHHHHHo....',
'...oHHHHHHHHo...',
'...oHSSSSSSHo...',
'...oSKSSSSKSo...',
'...oSSSSssSSo...',
'....oSSssSSo....',
'....ooCCCCoo....',
'...oCCCCCCCCo...',
'..oCcCCCCCCcCo..',
'..oSoCCCCCCoSo..',
'...ooCcCCcCoo...',
'....oCCCCCCo....',
'....oBBooBBo....',
'.....oo..oo.....']);
defSpr('pd1', [
'................',
'.....oooooo.....',
'....oHHHHHHo....',
'...oHHHHHHHHo...',
'...oHSSSSSSHo...',
'...oSKSSSSKSo...',
'...oSSSSssSSo...',
'....oSSssSSo....',
'....ooCCCCoo....',
'...oCCCCCCCCo...',
'..oCcCCCCCCcCo..',
'..oSoCCCCCCoSo..',
'...ooCcCCcCoo...',
'....oCCCCCCo....',
'....oBBoBBo.....',
'....oo..oo......']);
defSpr('pu0', [
'................',
'.....oooooo.....',
'....oHHHHHHo....',
'...oHHHHHHHHo...',
'...oHHHHHHHHo...',
'...oHHHHHHHHo...',
'...oHHHHHHHHo...',
'....oHHHHHHo....',
'....ooCCCCoo....',
'...oCCCCCCCCo...',
'..oCcCCCCCCcCo..',
'..oSoCCCCCCoSo..',
'...ooCcCCcCoo...',
'....oCCCCCCo....',
'....oBBooBBo....',
'.....oo..oo.....']);
defSpr('pu1', [
'................',
'.....oooooo.....',
'....oHHHHHHo....',
'...oHHHHHHHHo...',
'...oHHHHHHHHo...',
'...oHHHHHHHHo...',
'...oHHHHHHHHo...',
'....oHHHHHHo....',
'....ooCCCCoo....',
'...oCCCCCCCCo...',
'..oCcCCCCCCcCo..',
'..oSoCCCCCCoSo..',
'...ooCcCCcCoo...',
'....oCCCCCCo....',
'.....oBBoBBo....',
'......oo..oo....']);
defSpr('pl0', [
'................',
'.....oooooo.....',
'....oHHHHHHo....',
'...oHHHHHHHHo...',
'...oSSSSHHHHo...',
'...oKSSsHHHHo...',
'...oSSSsHHHHo...',
'....oSSsHHHo....',
'....ooCCCCoo....',
'...oCCCCCCCCo...',
'...oCCCCCCCCo...',
'...oSoCCCCCCo...',
'....oCcCCcCo....',
'....oCCCCCCo....',
'....oBBoBBo.....',
'.....oo.oo......']);
defSpr('pl1', [
'................',
'.....oooooo.....',
'....oHHHHHHo....',
'...oHHHHHHHHo...',
'...oSSSSHHHHo...',
'...oKSSsHHHHo...',
'...oSSSsHHHHo...',
'....oSSsHHHo....',
'....ooCCCCoo....',
'...oCCCCCCCCo...',
'...oCCCCCCCCo...',
'...oSoCCCCCCo...',
'....oCcCCcCo....',
'....oCCCCCCo....',
'...oBBo..BBo....',
'....oo...oo.....']);

/* ── NPCs ── */
defSpr('willy', [                       /* the statue. he is always watching. */
'................',
'.....oooooo.....',
'....oGGGGGGo....',
'...oGGGGGGGGo...',
'...oGGwGGwGGo...',
'...oGGGGGGGGo...',
'....oGGggGGo....',
'....ooGGGGoo....',
'...oGGGGGGGGo...',
'..oGgGGGGGGgGo..',
'..oGoGGGGGGoGo..',
'...ooGgGGgGoo...',
'....oGGGGGGo....',
'..oooooooooooo..',
'..oFFFFFFFFFFo..',
'..oooooooooooo..']);
defSpr('sammy', [                       /* a large academic owl */
'................',
'....oo....oo....',
'...oNNo..oNNo...',
'...oNNNooNNNo...',
'..oNNNNNNNNNNo..',
'..oNYYNNNNYYNo..',
'..oNYKNNNNKYNo..',
'..oNNNNooNNNNo..',
'..oNNNoAAoNNNo..',
'..oNDDNNNNDDNo..',
'..oNDDDNNDDDNo..',
'..oNNDDDDDDNNo..',
'...oNNDDDDNNo...',
'....oNNNNNNo....',
'.....oAoAoo.....',
'....oAAoAAo.....']);
defSpr('editor', [                      /* Thresher editor. deadline eyes. */
'................',
'.....oooooo.....',
'....oDDDDDDo....',
'...oDDDDDDDDo...',
'...oDSSSSSSDo...',
'...oSKSSSSKSo...',
'...oSSSSssSSo...',
'....oSSssSSo....',
'....ooBBBBoo....',
'...oBBBBBBBBo...',
'..oBoKKKKKKoBo..',
'..oSoKGGKKKoSo..',
'...ooKKKKKKoo...',
'....oBBBBBBo....',
'....oFFooFFo....',
'.....oo..oo.....']);
defSpr('priest', [                      /* the Torque Priest, keeper of the Steed */
'................',
'.....oooooo.....',
'....oRRRRRRo....',
'...oRRRRRRRRo...',
'...oRSSSSSSRo...',
'...oSKSSSSKSo...',
'...oSSSsSSSSo...',
'....oSSHHSSo....',
'....ooZZZZoo....',
'...oZZZZZZZZoG..',
'..oZzZZZZZZoGo..',
'..oSoZZZZZZoGo..',
'...ooZZZZZZoo...',
'....oZZZZZZo....',
'....oBBooBBo....',
'.....oo..oo.....'], { z: '#2c333c' });
defSpr('hedgewiz', [                    /* the Hedge Wizard. hedged, always. */
'................',
'.....oooooo.....',
'....oEEEEEEo....',
'...oEEEEEEEEo...',
'...oESSSSSSEo...',
'...oSKSSSSKSo...',
'...oSVVVVVVSo...',
'....oVVVVVVo....',
'...ooVEEEEVoo...',
'...oEEEEEEEEoN..',
'..oEeEEEEEEoNo..',
'..oSoEEEEEEoNo..',
'...ooEeEEeEoN...',
'....oEEEEEEoN...',
'....oBBooBBo....',
'.....oo..oo.....']);
defSpr('barista', [
'................',
'.....oooooo.....',
'....oHHHHHHo....',
'...oHHHHHHHHo...',
'...oHSSSSSSHo...',
'...oSKSSSSKSo...',
'...oSSSSssSSo...',
'....oSSssSSo....',
'....ooWWWWoo....',
'...oWWNNNNWWo...',
'..oWoNNNNNNoWo..',
'..oSoNNNNNNoSo..',
'...ooNNNNNNoo...',
'....oNNNNNNo....',
'....oBBooBBo....',
'.....oo..oo.....']);
defSpr('oracle', [                      /* the Dice Oracle. do not ask about the odds. */
'................',
'.....oooooo.....',
'....oPPPPPPo....',
'...oPPPPPPPPo...',
'..oPPKKKKKKPPo..',
'..oPKKYKKYKKPo..',
'..oPKKKKKKKKPo..',
'..oPPKKKKKKPPo..',
'...oPPPPPPPPo...',
'..oPpPPPPPPpPo..',
'..oPoPPPPPPoPo..',
'..oPoPWWWWoPo...',
'...ooPWKKWPoo...',
'....oPWWWWPo....',
'....oppoopppo...',
'.....oo..oo.....']);
defSpr('baron', [                       /* the Water Baron of the Deep Blue */
'................',
'....oooooooo....',
'...oLLLLLLLLo...',
'...oLLLLLLLLo...',
'....oSSSSSSo....',
'...oSKSSSSKSo...',
'...oSSHHHHSSo...',
'....oSHHHHSo....',
'....ooLLLLoo....',
'...oLLLLLLLLo...',
'..oLlLLLLLLlLo..',
'..oSoLLLLLLoSo..',
'...ooLlLLlLoo...',
'....oLLLLLLo....',
'....oBBooBBo....',
'.....oo..oo.....']);
defSpr('crew', [                        /* Rhys Racing pit gnome */
'................',
'.....oooooo.....',
'....oWWWWWWo....',
'...oWWWWWWWWo...',
'...oWSSSSSSWo...',
'...oSKSSSSKSo...',
'...oSSSSssSSo...',
'....oSSssSSo....',
'....ooAAAAoo....',
'...oAAAAAAAAo...',
'..oAaAAKKAAaAo..',
'..oSoAAKKAAoSo..',
'...ooAaAAaAoo...',
'....oAAAAAAo....',
'....oBBooBBo....',
'.....oo..oo.....'], { a: '#c47c08' });
defSpr('stu1', [
'................',
'.....oooooo.....',
'....oHHHHHHo....',
'...oHHHHHHHHo...',
'...oHSSSSSSHo...',
'...oSKSSSSKSo...',
'...oSSSSssSSo...',
'....oSSssSSo....',
'....ooTTTToo....',
'...oTTTTTTTTo...',
'..oToTTTTTToTo..',
'..oSoTTTTTToSo..',
'...ooTtTTtToo...',
'....oTTTTTTo....',
'....oBBooBBo....',
'.....oo..oo.....'], { t: '#157a75' });
defSpr('stu2', [
'................',
'.....oooooo.....',
'....oDDDDDDo....',
'...oDDDDDDDDo...',
'...oDSSSSSSDo...',
'...oSKSSSSKSo...',
'...oSSSSssSSo...',
'....oSSssSSo....',
'....ooMMMMoo....',
'...oMMMMMMMMo...',
'..oMmMMMMMMmMo..',
'..oSoMMMMMMoSo..',
'...ooMmMMmMoo...',
'....oMMMMMMo....',
'....oBBooBBo....',
'.....oo..oo.....'], { m: '#a84e80' });
defSpr('bard', [                        /* the Chaus bard, mid-set */
'................',
'.....ooooooR....',
'....oHHHHHRRR...',
'...oHHHHHHHRo...',
'...oHSSSSSSHo...',
'...oSKSSSSKSo...',
'...oSSSsSSSSo...',
'....oSSssSSo....',
'....ooPPPPoo....',
'...oPPPPPPPPoN..',
'..oPpPPPPPPoNNo.',
'..oSoPPPPPPoNNo.',
'...ooPpPPpPooN..',
'....oPPPPPPo.N..',
'....oBBooBBo....',
'.....oo..oo.....']);

/* ── beasts of the realm ── */
defSpr('squirrel', [
'................',
'..oo.......oo...',
'.oNNo.....oNNo..',
'.oNNNo...oNNNo..',
'..oNNNo.oNNNNo..',
'...oNNNNNNNNo...',
'...oNKNNKNNo....',
'...oNNNNNNNo....',
'..oNNsNNsNNNo...',
'..oNNNooNNNNo...',
'.oNNNNNNNNNNNo..',
'.oNNoNNNNoNNNo..',
'.oNNNNNNNNNNo...',
'..oNNoooNNo.....',
'...oo...oo......',
'................']);
defSpr('mosquito', [
'................',
'....oo..oo......',
'...oXXooXXo.....',
'..oXXXXXXXXo....',
'..oXWWXXWWXo....',
'...oXXXXXXo.....',
'....oKKKKo......',
'...oKKKKKKo.....',
'..oKKRRRKKKo....',
'..oKKKKKKKKoo...',
'...oKKKKKKo..o..',
'....oKoKKo....o.',
'....o..oo.......',
'...o....o.......',
'................',
'................']);
defSpr('humid', [
'................',
'....ooooo.......',
'..ooXXXXXoo.....',
'.oXXWWWXXXXo....',
'oXXWWWWWXXXXo...',
'oXWWKWWKWWXXXo..',
'oXXWWWWWWXXXXo..',
'oXXWWssWWXXXXo..',
'.oXXWWWWXXXXo...',
'..ooXXXXXXoo....',
'....oLo.oLo.....',
'....oLo.oLo.....',
'.....o...o......',
'....oLo.oLo.....',
'.....o...o......',
'................']);
defSpr('creep', [
'................',
'................',
'.....ooooo......',
'...ooTTTTToo....',
'..oTTTTTTTTTo...',
'..oTKTTTTKTTo...',
'.oTTTTTTTTTTTo..',
'.oTTTWWWWTTTTo..',
'.oTTWWWWWWTTTo..',
'oTTTWKWWKWTTTTo.',
'oTTTWWWWWWTTTTo.',
'oTTTTWWWWTTTTTo.',
'.oTTTTTTTTTTTo..',
'..ooTTTTTTToo...',
'....ooooooo.....',
'................']);
defSpr('wraith', [                      /* the Deadline Wraith. its face is a clock. */
'................',
'.....ooooo......',
'...ooFFFFFoo....',
'..oFFFFFFFFFo...',
'..oFFWWWWWFFo...',
'.oFFWWKWWWWFFo..',
'.oFFWWKWWWWFFo..',
'.oFFWWKKKWWFFo..',
'..oFFWWWWWFFo...',
'..oFFFFFFFFFo...',
'..oFFFFFFFFFo...',
'..oFFoFFFoFFo...',
'...oFo.oFo.oo...',
'...oo...oo......',
'....o...o.......',
'................']);
defSpr('gasel', [                       /* the Gas-Price Elemental. it only goes up. */
'................',
'......oA........',
'.....oAAo..oo...',
'....oAAAAooAo...',
'...oAAYAAAAAo...',
'..oAAYYYAAAAAo..',
'..oAYYYYYAAAo...',
'.oAAYYKYYYAAAo..',
'.oAAYKKKYYAAAo..',
'.oAAYYKYYYAAAo..',
'.oAAYYKKYYAAAo..',
'..oAYYYYYYAAo...',
'..oAAYYYYAAAo...',
'...oAAAAAAAo....',
'....ooAAAoo.....',
'................']);
defSpr('golem', [                       /* Pumpjack Golem: nodding donkey, angry */
'................',
'.oooo......oooo.',
'oNNNNo....oNNNNo',
'oNKKNNoooNNKKNNo',
'oNNNNNNNNNNNNNNo',
'.ooNNNDDDNNNoo..',
'...oDDDDDDDo....',
'...oDDRRDDDo....',
'..oDDRRRRDDDo...',
'..oDDDRRDDDDo...',
'..oDDDDDDDDDo...',
'..oDDoDDDoDDo...',
'...ooDDDDDoo....',
'...oDDo.oDDo....',
'...ooo...ooo....',
'................']);
defSpr('bump', [                        /* THE SLEEPING POLICEMAN (do not speed) */
'................',
'................',
'................',
'................',
'................',
'......oooo......',
'....ooKYKYoo....',
'..ooKYKYKYKYoo..',
'.oKYKYKYKYKYKYo.',
'oKYKYKWWKYKYKYKo',
'oYKYKYKKWKYKYKYo',
'oKYKYKYKYKYKYKYo',
'oooooooooooooooo',
'................',
'................',
'................']);
defSpr('bearm', [                       /* the Bear Market, dressed for the office */
'................',
'..oo........oo..',
'.oDDo......oDDo.',
'.oDDDoooooDDDDo.',
'..oDDDDDDDDDDo..',
'..oDKDDDDKDDo...',
'..oDDDsssDDDo...',
'...oDDsKsDDo....',
'....oDDDDDo.....',
'...oDDRRDDDo....',
'..oDDDRRDDDDo...',
'..oDDDRRDDDDo...',
'..oDDDDDDDDDo...',
'..oDDoDDDoDDo...',
'...oo..oo..oo...',
'................']);
defSpr('bullm', [                       /* the Bull Market. unstoppable, briefly. */
'................',
'.oWWo......oWWo.',
'..oWWo....oWWo..',
'...oNNoooNNNo...',
'..oNNNNNNNNNNo..',
'..oNKNNNNKNNo...',
'..oNNNssNNNNo...',
'...oNNsSsNNo....',
'....oNNNNNo.....',
'...oNNEENNNo....',
'..oNNNEENNNNo...',
'..oNNNEENNNNo...',
'..oNNNNNNNNNo...',
'..oNNoNNNoNNo...',
'...oo..oo..oo...',
'................']);
defSpr('lich', [                        /* the Midterm Lich. office hours: never. */
'................',
'...oooooooo.....',
'..oKKKKKKKKo....',
'..oKKKKKKKKoY...',
'...oWWWWWWo.Y...',
'..oWWKWWKWWo....',
'..oWWKWWKWWo....',
'..oWWWWWWWWo....',
'...oWKKKKWo.....',
'...ooFFFFoo.....',
'..oFFFFFFFFo....',
'.oFfFFFFFFfFo...',
'.oWoFFFFFFoWo...',
'..ooFfFFfFoo....',
'...oFFFFFFo.....',
'...oFFFFFFo.....'], { f: '#3a3a48' });
defSpr('squirking', [                   /* the Squirrel King. heavy is the crown. */
'....Y.Y.Y.......',
'....YYYYY.......',
'..oo.YYY...oo...',
'.oNNo.....oNNo..',
'.oNNNo...oNNNo..',
'..oNNNo.oNNNNo..',
'...oNNNNNNNNo...',
'...oNKNNKNNo....',
'...oNNNNNNNo....',
'..oNNsNNsNNNo...',
'..oNNNooNNNNo...',
'.oNNNNNNNNNNNo..',
'.oNNoNNNNoNNNo..',
'.oNNNNNNNNNNo...',
'..oNNoooNNo.....',
'...oo...oo......']);
defSpr('p0420', [                       /* P-0420, HERALD OF EMISSIONS. its face is the light. */
'................................',
'..........oooo....oooo..........',
'........ooXXXXo..oXXXXoo........',
'.......oXXXXXXXooXXXXXXXo.......',
'.....ooXXBBXXXXXXXXXBBXXoo......',
'....oXXBBBBBXXXXXXXBBBBBXXo.....',
'...oXXBBBBBBBXXXXXBBBBBBBXXo....',
'...oXBBBBBBBBBBBBBBBBBBBBBXo....',
'..oXXBBBBBBBBBBBBBBBBBBBBBXXo...',
'..oXBBBBBAAAAAAAAAAAABBBBBBXo...',
'..oXBBBAAAAAAAAAAAAAAAABBBBXo...',
'.oXXBBAAKAAAAAAAAAAKAAAABBXXXo..',
'.oXBBBAAAAAAAAAAAAAAAAAABBBXXo..',
'.oXBBBAAAAKKKKKKKKAAAAAABBBXXo..',
'.oXBBBBAAAAAAAAAAAAAAAABBBBXXo..',
'..oXBBBBAAAAAAAAAAAAAABBBBXXo...',
'..oXXBBBBAAAAAAAAAAAABBBBXXo....',
'...oXXBBBBBBBBBBBBBBBBBBXXo.....',
'....oXXBBBBBBBBBBBBBBBBXXo......',
'...oXXBBBBXXXXXXXXXXBBBBXXo.....',
'..oXXBBXXXXo..oo..oXXXXBBXXo....',
'..oXBXXXo..........oXXXBBXo.....',
'..oXXXo..............oXXXo......',
'...oo..................oo.......']);

/* ── props ── */
defSpr('arch', [                        /* the Sallyport. you know the rule. */
'..IIIIIIIIIIIIIIIIIIIIIIIIIIII..',
'.IiIIiIIiIIiIIiIIiIIiIIiIIiIIi..',
'IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII',
'IIiIIi..............iIIiIIiIIiII',
'IIIIi................iIIIIIIIIII',
'IIIi..................iIIIIIiIII',
'IIi....................iIIiIIIII',
'IIi....................iIIIIIIII',
'IIi....................iIIiIIiII',
'IIi....................iIIIIIIII',
'IIi....................iIIiIIiII',
'IIi....................iIIIIIIII',
'IIi....................iIIiIIiII',
'IIi....................iIIIIIIII',
'IIi....................iIIiIIiII',
'IIi....................iIIIIIIII']);
defSpr('car', [                         /* the CRIMSON STEED (MK8, obviously) */
'................................................',
'...............ooooooooooooooo.................',
'............ooRRRRRRRRRRRRRRRRoo...............',
'..........oRRZZZZZZZRRZZZZZZZRRRo..............',
'.........oRRZZZZZZZZRRZZZZZZZZRRRo.............',
'....ooooooRRRRRRRRRRRRRRRRRRRRRRRoooooo........',
'..oRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRo.......',
'.oRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRoY.....',
'.oRRrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrRRoo.....',
'.oRRRRRooooRRRRRRRRRRRRRRRRRRRooooRRRRRRo......',
'..oRRRoKKKKoRRRRRRRRRRRRRRRRRoKKKKoRRRRo.......',
'...oooKKGGKKooooooooooooooooKKGGKKooo..........',
'......oKGWGKo..............oKGWGKo.............',
'......oKKGKKo..............oKKGKKo.............',
'.......oKKKo................oKKKo..............',
'........ooo..................ooo...............']);
defSpr('pump0', [                       /* nodding donkey, frame A */
'.....oo.........',
'....oGGoooooo...',
'....oGGGGGGGGo..',
'.....oo..oGGo...',
'.....oo...oRRo..',
'....oGGo...oRRo.',
'....oGGo....oo..',
'...oGGGGo.......',
'...oGoGGo.......',
'..oGo..oGo......',
'..oGo..oGo......',
'.oGo....oGo.....',
'.oGo....oGo.....',
'oGGGGGGGGGGo....',
'oKKKKKKKKKKKo...',
'................']);
defSpr('pump1', [                       /* nodding donkey, frame B */
'................',
'....oooooooo....',
'....oGGGGGGGGo..',
'....oGGo.oGGo...',
'.....oo..oGGRRo.',
'....oGGo..oRRo..',
'....oGGo...oo...',
'...oGGGGo.......',
'...oGoGGo.......',
'..oGo..oGo......',
'..oGo..oGo......',
'.oGo....oGo.....',
'.oGo....oGo.....',
'oGGGGGGGGGGo....',
'oKKKKKKKKKKKo...',
'................']);
defSpr('fire0', [
'................',
'................',
'................',
'.......A........',
'......oAo..A....',
'.....oAAAo.A....',
'....oAYYAAoA....',
'....oAYYYAAAo...',
'...oAYWWYYAAo...',
'...oAYWWWYAAAo..',
'...oAAYWYYAAo...',
'....oAAYYAAo....',
'..oNNoAAAoNNo...',
'.oNNNNooNNNNNo..',
'..oNNNNNNNNo....',
'................']);
defSpr('fire1', [
'................',
'................',
'......A.........',
'......A..A......',
'.....oAo.A......',
'....oAAAoA......',
'....oAYYAAo.....',
'...oAYYWYAAo....',
'...oAYWWYYAAo...',
'...oAYWWWYAAo...',
'....oAYWYYAo....',
'....oAAYYAAo....',
'..oNNoAAAoNNo...',
'.oNNNNooNNNNNo..',
'..oNNNNNNNNo....',
'................']);
defSpr('chest0', [
'................',
'................',
'................',
'...oooooooooo...',
'..oNNNNNNNNNNo..',
'..oNnnnnnnnnNo..',
'..oNnnnnnnnnNo..',
'..oooooooooooo..',
'..oNNNNYYNNNNo..',
'..oNNNNYYNNNNo..',
'..oNnnnYYnnnNo..',
'..oNnnnnnnnnNo..',
'..oNNNNNNNNNNo..',
'...oooooooooo...',
'................',
'................']);
defSpr('chest1', [
'................',
'.....oooooo.....',
'...ooNNNNNNoo...',
'..oNNnnnnnnNNo..',
'..oNNNNNNNNNNo..',
'..oKKKKKKKKKKo..',
'..oKKKKKKKKKKo..',
'..oooooooooooo..',
'..oNNNNYYNNNNo..',
'..oNNNNYYNNNNo..',
'..oNnnnYYnnnNo..',
'..oNnnnnnnnnNo..',
'..oNNNNNNNNNNo..',
'...oooooooooo...',
'................',
'................']);
defSpr('sign', [
'................',
'................',
'..oooooooooooo..',
'.oWWWWWWWWWWWWo.',
'.oWKKWKKKWKKWWo.',
'.oWWWWWWWWWWWWo.',
'.oWKKKWKKWKWWWo.',
'.oWWWWWWWWWWWWo.',
'..oooooooooooo..',
'......oNNo......',
'......oNNo......',
'......oNNo......',
'......oNNo......',
'.....oNNNNo.....',
'................',
'................']);
defSpr('celrune', [                     /* the amber curse-mark itself */
'....oooo..o.....',
'.ooooAAoooAo....',
'oAAAAAAAAAAAo...',
'oAAoAAAAAAAAoo..',
'.ooAAAAAAAAAAAo.',
'oAAAAAAAAAAAAAo.',
'oAAoAAAAAAAoAo..',
'.oo.ooooooo.o...']);
defSpr('d20', [                         /* the die of fate */
'.....oooo.......',
'...ooWWWWoo.....',
'..oWWWWWWWWo....',
'.oWWWwWWwWWWo...',
'.oWWWWWWWWWWo...',
'oWWwWWWWWWwWWo..',
'oWWWWWWWWWWWWo..',
'oWwWWWWWWWWwWo..',
'oWWWWWWWWWWWWo..',
'.oWWwWWWwWWWo...',
'.oWWWWWWWWWWo...',
'..oWWwWWwWWo....',
'...ooWWWWoo.....',
'.....oooo.......',
'................',
'................']);
defSpr('lens', [                        /* fast glass */
'................',
'....oooooooo....',
'...oGGGGGGGGo...',
'..oGKKKKKKKKGo..',
'..oGKZZZZZZKGo..',
'..oGKZLLLLZKGo..',
'..oGKZLWLLZKGo..',
'..oGKZLLLLZKGo..',
'..oGKZZZZZZKGo..',
'..oGKKKKKKKKGo..',
'...oGGGGGGGGo...',
'....oooooooo....',
'................',
'................',
'................',
'................']);
defSpr('shelfbook', [
'oooooooooooooooo',
'oNNNNNNNNNNNNNNo',
'oNRoToLoYoPoGoNo',
'oNRoToLoYoPoGoNo',
'oNRoToLoYoPoGoNo',
'oNNNNNNNNNNNNNNo',
'oNLoRoEoWoToYoNo',
'oNLoRoEoWoToYoNo',
'oNLoRoEoWoToYoNo',
'oNNNNNNNNNNNNNNo',
'oNYoGoRoLoEoRoNo',
'oNYoGoRoLoEoRoNo',
'oNYoGoRoLoEoRoNo',
'oNNNNNNNNNNNNNNo',
'oooooooooooooooo',
'................']);

/* ─────────────────────────── tiles ────────────────────────── */
/* each tile is drawn procedurally at 16x16; per-tile hash keeps
   the noise deterministic so the prerender never shimmers */
var TILE = {
    grass: { s: 0, d: function (g, px, py, tx, ty) {
        g.fillStyle = P.g1; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.g2;
        for (var i = 0; i < 5; i++) { var h = thash(tx * 7 + i, ty * 13 + i); g.fillRect(px + Math.floor(h * 14), py + Math.floor(thash(tx + i, ty * 3 + i) * 14), 2, 1); }
    } },
    dgrass: { s: 0, d: function (g, px, py, tx, ty) {
        g.fillStyle = P.g2; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.g3;
        for (var i = 0; i < 5; i++) { var h = thash(tx * 5 + i, ty * 11 + i); g.fillRect(px + Math.floor(h * 14), py + Math.floor(thash(tx + i * 2, ty + i) * 14), 2, 1); }
    } },
    tree: { s: 1, d: function (g, px, py, tx, ty) {
        TILE.grass.d(g, px, py, tx, ty);
        g.fillStyle = P.g4; g.fillRect(px + 2, py + 1, 12, 10); g.fillRect(px + 1, py + 3, 14, 7);
        g.fillStyle = P.g3; g.fillRect(px + 3, py + 2, 6, 3); g.fillRect(px + 2, py + 6, 4, 2);
        g.fillStyle = P.g2; g.fillRect(px + 4, py + 3, 3, 1);
        g.fillStyle = P.wd3; g.fillRect(px + 6, py + 11, 4, 4);
        g.fillStyle = '#1c1e24'; g.fillRect(px + 4, py + 14, 8, 2);
    } },
    hedge: { s: 1, d: function (g, px, py, tx, ty) {
        g.fillStyle = P.g3; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.g4; g.fillRect(px, py + 12, 16, 4); g.fillRect(px, py, 2, 16);
        g.fillStyle = P.g2;
        for (var i = 0; i < 6; i++) g.fillRect(px + 1 + Math.floor(thash(tx * 3 + i, ty + i) * 13), py + 1 + Math.floor(thash(tx + i, ty * 7 + i) * 9), 2, 2);
    } },
    flower: { s: 0, a: 1, d: function (g, px, py, tx, ty, fr) {
        TILE.grass.d(g, px, py, tx, ty);
        var c = thash(tx, ty) > 0.5 ? P.gold : (thash(tx * 3, ty) > 0.5 ? '#d86aa0' : P.w);
        var o = fr % 2;
        g.fillStyle = c;
        g.fillRect(px + 3 + o, py + 4, 2, 2); g.fillRect(px + 10 - o, py + 9, 2, 2);
        g.fillStyle = P.g4; g.fillRect(px + 4 + o, py + 6, 1, 3); g.fillRect(px + 11 - o, py + 11, 1, 3);
    } },
    path: { s: 0, d: function (g, px, py, tx, ty) {
        g.fillStyle = P.pa1; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.pa2;
        for (var i = 0; i < 4; i++) g.fillRect(px + Math.floor(thash(tx + i, ty * 5 + i) * 13), py + Math.floor(thash(tx * 9 + i, ty + i) * 13), 2, 2);
    } },
    water: { s: 1, a: 1, d: function (g, px, py, tx, ty, fr) {
        g.fillStyle = P.w1; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.w2;
        var o = (fr % 2) * 2;
        g.fillRect(px + 2 + o, py + 4, 6, 1); g.fillRect(px + 9 - o, py + 10, 5, 1);
        if ((fr + tx + ty) % 4 === 0) { g.fillStyle = P.w3; g.fillRect(px + 6, py + 7, 2, 1); }
    } },
    stonering: { s: 1, d: function (g, px, py) {
        g.fillStyle = P.s1; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.s2; g.fillRect(px, py + 12, 16, 4);
        g.fillStyle = P.w; g.fillRect(px + 2, py + 2, 3, 1);
    } },
    wall: { s: 1, d: function (g, px, py, tx, ty) {
        g.fillStyle = P.br1; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.br2;
        g.fillRect(px, py + 7, 16, 1); g.fillRect(px, py + 15, 16, 1);
        g.fillRect(px + (ty % 2 ? 4 : 10), py, 1, 7); g.fillRect(px + (ty % 2 ? 12 : 6), py + 8, 1, 7);
    } },
    roof: { s: 1, d: function (g, px, py, tx, ty) {
        g.fillStyle = P.s3; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.s4; g.fillRect(px, py + 4, 16, 1); g.fillRect(px, py + 9, 16, 1); g.fillRect(px, py + 14, 16, 1);
        g.fillStyle = P.s2; g.fillRect(px, py, 16, 1);
    } },
    roofr: { s: 1, d: function (g, px, py) {
        g.fillStyle = P.red2; g.fillRect(px, py, 16, 16);
        g.fillStyle = '#6b0e04'; g.fillRect(px, py + 4, 16, 1); g.fillRect(px, py + 9, 16, 1); g.fillRect(px, py + 14, 16, 1);
        g.fillStyle = P.red; g.fillRect(px, py, 16, 1);
    } },
    door: { s: 0, d: function (g, px, py) {
        g.fillStyle = P.br1; g.fillRect(px, py, 16, 16);
        g.fillStyle = '#241a12'; g.fillRect(px + 3, py + 3, 10, 13);
        g.fillStyle = P.wd1; g.fillRect(px + 2, py + 2, 2, 14); g.fillRect(px + 12, py + 2, 2, 14); g.fillRect(px + 2, py + 2, 12, 2);
        g.fillStyle = P.gold; g.fillRect(px + 11, py + 9, 1, 2);
    } },
    window: { s: 1, d: function (g, px, py, tx, ty) {
        TILE.wall.d(g, px, py, tx, ty);
        g.fillStyle = '#39434d'; g.fillRect(px + 3, py + 3, 10, 9);
        g.fillStyle = '#5e93cf'; g.fillRect(px + 4, py + 4, 3, 3);
        g.fillStyle = P.k; g.fillRect(px + 7, py + 3, 1, 9); g.fillRect(px + 3, py + 7, 10, 1);
    } },
    floor: { s: 0, d: function (g, px, py, tx, ty) {
        g.fillStyle = P.wd1; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.wd2; g.fillRect(px, py + 7, 16, 1); g.fillRect(px, py + 15, 16, 1);
        g.fillRect(px + (tx % 2 ? 5 : 11), py, 1, 7); g.fillRect(px + (tx % 2 ? 11 : 3), py + 8, 1, 7);
    } },
    sfloor: { s: 0, d: function (g, px, py, tx, ty) {
        g.fillStyle = ((tx + ty) % 2) ? '#5a5a66' : '#62626e'; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.s3; g.fillRect(px, py, 16, 1); g.fillRect(px, py, 1, 16);
    } },
    counter: { s: 1, d: function (g, px, py) {
        g.fillStyle = P.wd2; g.fillRect(px, py + 4, 16, 12);
        g.fillStyle = P.wd1; g.fillRect(px, py, 16, 5);
        g.fillStyle = P.wd3; g.fillRect(px, py + 5, 16, 1); g.fillRect(px, py + 12, 16, 1);
    } },
    table: { s: 1, d: function (g, px, py, tx, ty) {
        TILE.floor.d(g, px, py, tx, ty);
        g.fillStyle = P.wd3; g.fillRect(px + 3, py + 4, 10, 8);
        g.fillStyle = P.wd1; g.fillRect(px + 2, py + 3, 12, 8);
        g.fillStyle = P.w; g.fillRect(px + 6, py + 5, 4, 3);
    } },
    stage: { s: 1, d: function (g, px, py) {
        g.fillStyle = P.wd1; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.gold; g.fillRect(px, py, 16, 2);
        g.fillStyle = P.wd3; g.fillRect(px, py + 8, 16, 1);
    } },
    sand: { s: 0, d: function (g, px, py, tx, ty) {
        g.fillStyle = P.sa1; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.sa2;
        for (var i = 0; i < 4; i++) g.fillRect(px + Math.floor(thash(tx + i * 3, ty + i) * 14), py + Math.floor(thash(tx * 2 + i, ty * 5) * 14), 2, 1);
    } },
    dune: { s: 0, d: function (g, px, py, tx, ty) {
        TILE.sand.d(g, px, py, tx, ty);
        g.fillStyle = P.sa3; g.fillRect(px + 1, py + 5, 9, 1); g.fillRect(px + 6, py + 11, 9, 1);
    } },
    rock: { s: 1, d: function (g, px, py, tx, ty) {
        TILE.sand.d(g, px, py, tx, ty);
        g.fillStyle = P.s2; g.fillRect(px + 3, py + 5, 10, 9);
        g.fillStyle = P.s1; g.fillRect(px + 4, py + 4, 8, 6);
        g.fillStyle = P.s3; g.fillRect(px + 4, py + 10, 9, 3);
        g.fillStyle = '#2a2a32'; g.fillRect(px + 4, py + 14, 9, 1);
    } },
    deadtree: { s: 1, d: function (g, px, py, tx, ty) {
        TILE.sand.d(g, px, py, tx, ty);
        g.fillStyle = P.wd3;
        g.fillRect(px + 7, py + 4, 2, 11); g.fillRect(px + 4, py + 5, 3, 1); g.fillRect(px + 9, py + 7, 4, 1);
        g.fillRect(px + 4, py + 2, 1, 3); g.fillRect(px + 12, py + 4, 1, 3);
    } },
    voidt: { s: 1, d: function (g, px, py) { g.fillStyle = '#0c0c12'; g.fillRect(px, py, 16, 16); } },
    swall: { s: 1, d: function (g, px, py, tx, ty) {
        g.fillStyle = P.s3; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.s4; g.fillRect(px, py + 7, 16, 1); g.fillRect(px, py + 15, 16, 1);
        g.fillRect(px + (ty % 2 ? 5 : 10), py, 1, 7); g.fillRect(px + (ty % 2 ? 11 : 4), py + 8, 1, 7);
        g.fillStyle = P.s2; g.fillRect(px, py, 16, 1);
    } },
    dfloor: { s: 0, d: function (g, px, py, tx, ty) {
        g.fillStyle = '#2c2c38'; g.fillRect(px, py, 16, 16);
        g.fillStyle = '#242430';
        g.fillRect(px, py, 16, 1); g.fillRect(px, py, 1, 16);
        if (thash(tx, ty) > 0.8) g.fillRect(px + 4 + Math.floor(thash(tx, ty * 2) * 8), py + 4 + Math.floor(thash(tx * 2, ty) * 8), 2, 2);
    } },
    torch: { s: 1, a: 1, d: function (g, px, py, tx, ty, fr) {
        TILE.swall.d(g, px, py, tx, ty);
        g.fillStyle = P.wd3; g.fillRect(px + 7, py + 8, 2, 5);
        var f = (fr + tx) % 2;
        g.fillStyle = P.amber; g.fillRect(px + 6, py + 3 + f, 4, 4);
        g.fillStyle = P.yell; g.fillRect(px + 7, py + 4 + f, 2, 2);
    } },
    barrel: { s: 1, d: function (g, px, py, tx, ty) {
        g.fillStyle = P.wd1; g.fillRect(px + 3, py + 3, 10, 12);
        g.fillStyle = P.wd3; g.fillRect(px + 3, py + 6, 10, 1); g.fillRect(px + 3, py + 11, 10, 1);
        g.fillStyle = P.wd2; g.fillRect(px + 3, py + 3, 2, 12);
    } },
    wbarrel: { s: 1, d: function (g, px, py, tx, ty) {
        TILE.sand.d(g, px, py, tx, ty);
        g.fillStyle = P.w1; g.fillRect(px + 3, py + 3, 10, 12);
        g.fillStyle = '#2c5488'; g.fillRect(px + 3, py + 6, 10, 1); g.fillRect(px + 3, py + 11, 10, 1);
        g.fillStyle = P.w2; g.fillRect(px + 4, py + 4, 2, 10);
    } },
    shelf: { s: 1, d: function (g, px, py) {
        var c = sprCanvas('shelfbook');
        g.drawImage(c, px, py);
    } },
    rug: { s: 0, d: function (g, px, py) {
        g.fillStyle = P.red2; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.gold; g.fillRect(px + 1, py + 1, 14, 1); g.fillRect(px + 1, py + 14, 14, 1);
    } },
    /* walkable — it's a doorway; the SEALED one is enforced by def.doorway in solidAt */
    bigdoor: { s: 0, d: function (g, px, py) {
        g.fillStyle = P.s4; g.fillRect(px, py, 16, 16);
        g.fillStyle = P.gold; g.fillRect(px + 2, py + 2, 12, 1); g.fillRect(px + 2, py + 2, 1, 12);
        g.fillStyle = P.s2; g.fillRect(px + 4, py + 4, 8, 10);
        g.fillStyle = P.amber; g.fillRect(px + 7, py + 7, 2, 2);
    } },
    fence: { s: 1, d: function (g, px, py, tx, ty) {
        TILE.grass.d(g, px, py, tx, ty);
        g.fillStyle = P.wd2; g.fillRect(px, py + 6, 16, 2); g.fillRect(px + 2, py + 4, 2, 8); g.fillRect(px + 11, py + 4, 2, 8);
    } }
};

/* ─────────────────────── map runtime ──────────────────────── */
var RT = null;          // current map runtime
function buildMap(id) {
    var def = MAPS[id];
    var w = def.w, h = def.h;
    var base = document.createElement('canvas');
    base.width = w * TS; base.height = h * TS;
    var g = base.getContext('2d');
    var anims = [], grid = [];
    for (var y = 0; y < h; y++) {
        var row = (def.rows[y] || '');
        grid[y] = [];
        for (var x = 0; x < w; x++) {
            var chr = row[x] || def.pad || '.';
            var tid = def.leg[chr] || def.leg['.'] || 'grass';
            grid[y][x] = tid;
            var t = TILE[tid];
            t.d(g, x * TS, y * TS, x, y, 0);
            if (t.a) anims.push({ x: x, y: y, id: tid });
        }
    }
    RT = {
        id: id, def: def, w: w, h: h, base: base, grid: grid, anims: anims,
        npcs: (def.npcs || []).filter(function (n) { return !n.gone || !n.gone(); }).map(function (n) {
            return { id: n.id, spr: n.spr, x: n.x, y: n.y, dir: n.dir || 'd', dlg: n.dlg, wander: n.wander, t: Math.random() * 2, bob: n.bob, tint: n.tint };
        }),
        roamers: (def.roamers || []).filter(function (r) { return !r.gone || !r.gone(); }).map(function (r, i) {
            return { i: i, enemy: r.enemy, x: r.x, y: r.y, zone: r.zone, t: Math.random() * 1.4, dead: false, chase: r.chase, group: r.group };
        }),
        props: (def.props || []).filter(function (p) { return !p.gone || !p.gone(); }),
        fr: 0, frT: 0
    };
}
function tileAt(x, y) {
    if (!RT || x < 0 || y < 0 || x >= RT.w || y >= RT.h) return 'voidt';
    return RT.grid[y][x];
}
function solidAt(x, y) {
    if (x < 0 || y < 0 || x >= RT.w || y >= RT.h) return true;
    var dw = RT.def.doorway;
    if (dw && x === dw.x && y === dw.y) return !(G && G.flags[dw.flag]);   // the sealed door
    if (TILE[RT.grid[y][x]].s) return true;
    for (var i = 0; i < RT.props.length; i++) {
        var p = RT.props[i];
        if (p.solid && x >= p.x && x < p.x + (p.sw || 1) && y >= p.y && y < p.y + (p.sh || 1)) return true;
    }
    for (var j = 0; j < RT.npcs.length; j++) {
        if (RT.npcs[j].x === x && RT.npcs[j].y === y) return true;
    }
    return false;
}
function npcAt(x, y) {
    for (var i = 0; i < RT.npcs.length; i++) if (RT.npcs[i].x === x && RT.npcs[i].y === y) return RT.npcs[i];
    return null;
}
function propAt(x, y) {
    for (var i = 0; i < RT.props.length; i++) {
        var p = RT.props[i];
        if (x >= p.x && x < p.x + (p.sw || 1) && y >= p.y && y < p.y + (p.sh || 1)) return p;
    }
    return null;
}
function exitAt(x, y) {
    var ex = RT.def.exits || [];
    for (var i = 0; i < ex.length; i++) {
        var e = ex[i];
        if (x >= e.x && x <= (e.x2 == null ? e.x : e.x2) && y >= e.y && y <= (e.y2 == null ? e.y : e.y2)) return e;
    }
    return null;
}

/* ─────────────────────────── maps ─────────────────────────── */
/* Ricewood and environs. Rows are chars into each map's legend;
   short rows pad with the map's default ground. */
var MAPS = {
    commons: {
        name: 'RICEWOOD COMMONS', w: 26, h: 20, music: 'commons', pad: '.', outdoors: true, rain: 0.35,
        leg: { 'T': 'tree', '.': 'grass', 'f': 'flower', '-': 'path', '~': 'water', 'S': 'stonering', 'W': 'wall', 'w': 'window', 'D': 'door', 'R': 'roofr', 'F': 'roof', 'b': 'fence', 'h': 'hedge' },
        rows: [
            'TTTTTTTTTTTTTTTTTTTTTTTTTT',
            'Tff.f.....W--W.....f.ff..T',
            'T.........W--W...........T',
            'T..........--............T',
            'T.RRRRRR...--...FFFFFFF..T',
            'T.RRRRRR...--...FFFFFFF..T',
            'T.WwWWwW...--...WwWWwWW..T',
            'T.WWDWWW...--...WWWDWWW..T',
            'T...-......--......-.....T',
            'T...----------------.....T',
            '--------------------------',
            'T.......-.SSSSSS...-.....T',
            'T.......-.S~~~~S...-.....T',
            'T.......-.S~~~~S...-.....T',
            'T.RRRRR.-.SSSSSS...b.....T',
            'T.RRRRR.-...........f....T',
            'T.WwDwW.-......f.........T',
            'T...-----...........f....T',
            'T........................T',
            'TTTTTTTTTTTTTTTTTTTTTTTTTT'
        ],
        exits: [
            { x: 4, y: 7, to: 'garage', tx: 6, ty: 8, dir: 'u' },
            { x: 19, y: 7, to: 'stacks', tx: 7, ty: 11, dir: 'u' },
            { x: 4, y: 16, to: 'chaus', tx: 6, ty: 9, dir: 'u' },
            { x: 0, y: 10, to: 'hedges', tx: 26, ty: 10, dir: 'l' },
            { x: 25, y: 10, to: 'wastes', tx: 1, ty: 10, dir: 'r' }
        ],
        triggers: [{ x: 11, y: 1, x2: 12, y2: 2, id: 'sallyport' }],
        props: [
            { spr: 'arch', x: 10, y: 2, scale: 2, solid: false, deco: true },
            { spr: 'sign', x: 13, y: 3, solid: true, sw: 1, sh: 1, use: 'sign_sally' },
            { spr: 'sign', x: 1, y: 9, solid: true, use: 'sign_west' },
            { spr: 'sign', x: 24, y: 9, solid: true, use: 'sign_east' }
        ],
        npcs: [
            { id: 'willy', spr: 'willy', x: 16, y: 12, dlg: 'willy' },
            { id: 'sammy', spr: 'sammy', x: 9, y: 11, dlg: 'sammy', bob: true },
            { id: 'editor', spr: 'editor', x: 7, y: 14, dlg: 'editor' },
            { id: 'crew', spr: 'crew', x: 7, y: 8, dlg: 'crew' },
            { id: 'stu1', spr: 'stu1', x: 17, y: 11, dlg: 'stu1', wander: true },
            { id: 'stu2', spr: 'stu2', x: 21, y: 13, dlg: 'stu2', wander: true }
        ]
    },
    garage: {
        name: 'THE CRIMSON GARAGE', w: 13, h: 10, music: 'chaus', pad: ',',
        leg: { 'W': 'wall', 'w': 'window', ',': 'sfloor', 'D': 'door', 'B': 'barrel', 'c': 'counter' },
        rows: [
            'WWWWWWWWWWWWW',
            'WwwWWwwWWwwWW',
            'Wcc,,,,,,,,BW',
            'Wcc,,,,,,,,BW',
            'W,,,,,,,,,,,W',
            'W,,,,,,,,,,,W',
            'W,,,,,,,,,,,W',
            'W,,,,,,,,,,,W',
            'W,,,,,,,,,,,W',
            'WWWWWWDWWWWWW'
        ],
        exits: [{ x: 6, y: 9, to: 'commons', tx: 4, ty: 8, dir: 'd' }],
        props: [
            { spr: 'car', x: 4, y: 3, yo: 14, solid: true, sw: 3, sh: 2, use: 'use_car', deco: false }
        ],
        npcs: [
            { id: 'priest', spr: 'priest', x: 9, y: 5, dlg: 'priest' }
        ]
    },
    chaus: {
        name: 'THE CHAUS', w: 13, h: 11, music: 'chaus', pad: ',',
        leg: { 'W': 'wall', 'w': 'window', ',': 'floor', 'D': 'door', 'c': 'counter', 't': 'table', '=': 'stage', 'r': 'rug' },
        rows: [
            'WWWWWWWWWWWWW',
            'WwwWWwwWWwwWW',
            'W,,,,,,,,,,,W',
            'Wcccccc,,,,,W',
            'W,,,,,,,,,==W',
            'W,t,,t,,,,==W',
            'W,,,,,,,,,==W',
            'W,t,,t,,,r,,W',
            'W,,,,,,,,r,,W',
            'W,,,,,,,,,,,W',
            'WWWWWWDWWWWWW'
        ],
        exits: [{ x: 6, y: 10, to: 'commons', tx: 4, ty: 17, dir: 'd' }],
        props: [],
        npcs: [
            { id: 'barista', spr: 'barista', x: 3, y: 2, dlg: 'barista' },
            { id: 'bard', spr: 'bard', x: 10, y: 5, dlg: 'bard', bob: true },
            { id: 'oracle', spr: 'oracle', x: 2, y: 8, dlg: 'oracle' },
            { id: 'stu3', spr: 'stu2', x: 6, y: 8, dlg: 'stu3' }
        ]
    },
    stacks: {
        name: 'FONDREN STACKS', w: 15, h: 13, music: 'depths', pad: ',',
        leg: { 'W': 'wall', 'w': 'window', ',': 'floor', 'D': 'door', 'B': 'shelf' },
        rows: [
            'WWWWWWWWWWWWWWW',
            'WwwWWwwWWwwWWwW',
            'W,,,,,,,,,,,,,W',
            'W,BBB,BBB,BBB,W',
            'W,,,,,,,,,,,,,W',
            'W,BBB,BBB,BBB,W',
            'W,,,,,,,,,,,,,W',
            'W,BBB,BBB,BBB,W',
            'W,,,,,,,,,,,,,W',
            'W,BBB,BBB,BB,,W',
            'W,,,,,,,,,,,,,W',
            'W,,,,,,,,,,,,,W',
            'WWWWWWWDWWWWWWW'
        ],
        exits: [{ x: 7, y: 12, to: 'commons', tx: 19, ty: 8, dir: 'd' }],
        props: [
            { spr: 'shelfbook', x: 12, y: 9, solid: true, use: 'secret_shelf' }
        ],
        npcs: [
            { id: 'lich', spr: 'lich', x: 7, y: 2, dlg: 'lich', bob: true }
        ]
    },
    hedges: {
        name: 'THE WEST HEDGES', w: 28, h: 20, music: 'hedges', pad: '.', outdoors: true, ambient: 'fireflies',
        leg: { 'T': 'tree', '.': 'grass', 'f': 'flower', '-': 'path', 'h': 'hedge', 'd': 'dgrass' },
        rows: [
            'TTTTTTTTTTTTTTTTTTTTTTTTTTTT',
            'T...hhhhhhhh.....hhhhhhhh..T',
            'T.f.h......h.....h......h..T',
            'T...h......h.....h......h..T',
            'T...h..ff..h..d..h......h..T',
            'T...hh..hhhh.....hhh..hhh..T',
            'T.....d....................T',
            'T..hh...T....hhh....T......T',
            'T...................f......T',
            'T..T....hhh.......hh....T..T',
            'T...........................',
            'T....hh........T....hh.....T',
            'T............d.............T',
            'T.T....hhhh....hh.....T....T',
            'T..........................T',
            'T---------------------.....T',
            'T.f..................f.....T',
            'T....hhhh....hhhh....hh....T',
            'T..f.......f...........f...T',
            'TTTTTTTTTTTTTTTTTTTTTTTTTTTT'
        ],
        exits: [{ x: 27, y: 10, to: 'commons', tx: 1, ty: 10, dir: 'r' }],
        props: [
            { spr: 'chest0', x: 21, y: 2, solid: true, use: 'chest_stash', id: 'chest_stash' },
            { spr: 'chest0', x: 2, y: 14, solid: true, use: 'chest_road', id: 'chest_road' }
        ],
        npcs: [
            { id: 'hedgewiz', spr: 'hedgewiz', x: 7, y: 2, dlg: 'hedgewiz' }
        ],
        roamers: [
            { enemy: 'squirrel', x: 10, y: 7, zone: [6, 6, 14, 10] },
            { enemy: 'squirrel', x: 18, y: 12, zone: [15, 10, 21, 14] },
            { enemy: 'squirrel', x: 6, y: 12, zone: [3, 10, 9, 14] },
            { enemy: 'bump', x: 14, y: 15, zone: [14, 15, 14, 15], boss: true, gone: function () { return G && G.flags.bumpDead; } },
            { enemy: 'squirking', x: 23, y: 17, zone: [23, 17, 23, 17], boss: true,
              gone: function () { return !G || G.quests.kolache !== 0 || G.flags.kingDead; } }
        ]
    },
    wastes: {
        name: 'THE PERMIAN WASTES', w: 30, h: 20, music: 'wastes', pad: '.', outdoors: true, ambient: 'dust',
        leg: { 'r': 'rock', '.': 'sand', 'd': 'dune', 'T': 'deadtree', 'W': 'swall', 'w': 'water', 'b': 'wbarrel', 'E': 'bigdoor' },
        rows: [
            'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
            'r......d.........T...........r',
            'r..T........d.......bb.......r',
            'r.........d........bwwb......r',
            'r..................bwwb......r',
            'r......d.............b.......r',
            'r............................r',
            'r...d.......d.......d........r',
            'r............................r',
            'r..T.............d.......T...r',
            '..............................',
            'r.....d......................r',
            'r............................r',
            'r.WWWWWWW........d...........r',
            'r.W......W...................r',
            'r.W......W.............rrr...r',
            'r.W......W.............rEr...r',
            'r.WWWW.WWW.....d.............r',
            'r........................T...r',
            'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr'
        ],
        exits: [
            { x: 0, y: 10, to: 'commons', tx: 24, ty: 10, dir: 'l' },
            { x: 24, y: 16, to: 'depths', tx: 12, ty: 2, dir: 'd' }
        ],
        props: [
            { spr: 'pump0', x: 5, y: 4, pump: true, solid: true, sw: 1, sh: 1 },
            { spr: 'pump0', x: 11, y: 7, pump: true, solid: true, sw: 1, sh: 1 },
            { spr: 'pump0', x: 17, y: 12, pump: true, solid: true, sw: 1, sh: 1 },
            { spr: 'sign', x: 4, y: 12, solid: true, use: 'sign_ruin' },
            { spr: 'chest0', x: 5, y: 15, solid: true, use: 'pedestal_o2', id: 'ped_o2' }
        ],
        npcs: [
            { id: 'baron', spr: 'baron', x: 22, y: 6, dlg: 'baron' }
        ],
        roamers: [
            { enemy: 'gasel', x: 12, y: 5, zone: [8, 3, 16, 8] },
            { enemy: 'wraith', x: 16, y: 11, zone: [12, 9, 20, 13] },
            { enemy: 'golem', x: 7, y: 11, zone: [4, 10, 10, 12] },
            { enemy: 'gasel', x: 22, y: 9, zone: [19, 8, 26, 12] }
        ]
    },
    depths: {
        name: 'THE BASIN DEPTHS', w: 24, h: 22, music: 'depths', pad: ',', dark: true, ambient: 'drips',
        leg: { '#': 'swall', ',': 'dfloor', 't': 'torch', 'E': 'bigdoor', 'L': 'bigdoor' },
        doorway: { x: 11, y: 14, flag: 'doorOpen' },
        rows: [
            '########################',
            '##########t,E,t#########',
            '##########,,,,,#########',
            '#####t,,,,,,,,,,,t######',
            '#,,,,,,,,,,,,,,,,,,,,,##',
            '#,####,,####,,####,,,,##',
            '#,#t,,,,,,,,,,,,#t,,,,##',
            '#,#,,,,,,,,,,,,,#,,,,,##',
            '#,#,,####t####,,#,,,,,##',
            '#,,,,#,,,,,,,#,,,,,,,,##',
            '#,,,,#,,,,,,,#,,,,####t#',
            '#t,,,#,,,,,,,#,,,,,,,,,#',
            '#,,,,,,,,,,,,,,,,,,,,,,#',
            '#,,####,,,,,,,,,,####,,#',
            '#,,#,,,,,t,L,t,,,,#,,,,#',
            '#,,#,,,,,##,##,,,,#,,,,#',
            '#,,,,,,,,#,,,#,,,,,,,,,#',
            '#t,,,,,,,#,,,#,,,,,,,,t#',
            '#,,,,,,,,#,,,#,,,,,,,,,#',
            '#,,,,,,,,#,,,#,,,,,,,,,#',
            '#,,,,,,,,#####,,,,,,,,,#',
            '########################'
        ],
        exits: [{ x: 12, y: 1, to: 'wastes', tx: 24, ty: 17, dir: 'd' }],
        triggers: [{ x: 10, y: 17, x2: 12, y2: 19, id: 'bossroom' }],
        props: [
            { spr: 'chest0', x: 2, y: 19, solid: true, use: 'chest_depths', id: 'chest_depths' },
            { spr: 'chest0', x: 20, y: 9, solid: true, use: 'pedestal_cat', id: 'ped_cat' },
            { spr: 'sign', x: 13, y: 14, solid: true, use: 'sign_bossdoor' }
        ],
        npcs: [],
        roamers: [
            { enemy: 'creep', x: 6, y: 7, zone: [3, 6, 12, 8], chase: true },
            { enemy: 'creep', x: 17, y: 12, zone: [14, 11, 20, 13], chase: true },
            { enemy: 'wraith', x: 5, y: 17, zone: [3, 16, 8, 19], chase: true },
            { enemy: 'wraith', x: 11, y: 9, zone: [7, 9, 12, 11], chase: true }
        ]
    }
};

/* ────────────────────── character data ────────────────────── */
var CLASSES = {
    pal:   { n: 'SPREADSHEET PALADIN', tint: '#e8c04a', die: 10, key: 'str', w: 'pal1',
             tag: 'lawful. formatted.', blurb: 'Smites with formatting. The books WILL balance.',
             spells: { 1: 'audit', 2: 'reconcile', 4: 'pivot' } },
    bard:  { n: 'FINANCE BARD', tint: '#7b53c9', die: 8, key: 'cha', w: 'bard1',
             tag: 'charisma is liquidity.', blurb: 'Markets and lute, in that order. Damage compounds.',
             spells: { 1: 'interest', 2: 'inspire', 4: 'margin' } },
    rogue: { n: 'TORNADO-RED ROGUE', tint: '#d81e05', die: 8, key: 'dex', w: 'rogue1',
             tag: 'stage 2. no regrets.', blurb: 'First off the line. Crits like a speed bump at 40.',
             spells: { 1: 'launch', 2: 'smoke', 4: 'apex' } },
    druid: { n: 'SHUTTER DRUID', tint: '#1f9e98', die: 8, key: 'wis', w: 'druid1',
             tag: 'golden hour cleric.', blurb: 'Talks to light. Heals in post. No flash. Ever.',
             spells: { 1: 'golden', 2: 'flash', 4: 'burst' } },
    sorc:  { n: 'CAFFEINATED SORCERER', tint: '#4a6bd8', die: 6, key: 'int', w: 'sorc1',
             tag: 'innate. unstable. brewed.', blurb: 'Old portafilter magic. Brilliant. Vibrating slightly.',
             spells: { 1: 'bolt', 2: 'triple', 4: 'overclock' } }
};
var CLS_ORDER = ['pal', 'bard', 'rogue', 'druid', 'sorc'];
var STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
var STAT_N = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
var XPT = [0, 30, 70, 130, 220];               // xp needed to REACH level i+1
var MAXLVL = 5;

var SPELLS = {
    audit:     { n: 'DIVINE AUDIT', cost: 1, type: 'atk', desc: 'wpn +2d6 radiant. reveals the enemy statblock.' },
    reconcile: { n: 'RECONCILE', cost: 1, type: 'heal', desc: 'heal 2d8+prof. the books balance.' },
    pivot:     { n: 'PIVOT TABLE', cost: 1, type: 'buff', desc: '+2 AC for 3 turns. reorganize reality.' },
    interest:  { n: 'COMPOUND INT.', cost: 1, type: 'debuff', desc: 'DoT: 1 dmg, doubles each turn. 4 turns.' },
    inspire:   { n: 'LIQUIDITY', cost: 1, type: 'buff', desc: '+4 to your next attack roll. stay liquid.' },
    margin:    { n: 'MARGIN CALL', cost: 2, type: 'atk', desc: '4d8 dmg. costs 15 gold. the market provides.' },
    launch:    { n: 'LAUNCH CONTROL', cost: 1, type: 'util', desc: 'act twice this turn. once per battle.' },
    smoke:     { n: 'SMOKE BOMB', cost: 1, type: 'debuff', desc: 'catback fog: enemy blinded 2 turns.' },
    apex:      { n: 'APEX CUT', cost: 1, type: 'atk', desc: 'wpn attack that crits on 18-20.' },
    golden:    { n: 'GOLDEN HOUR', cost: 1, type: 'heal', desc: 'heal 1d8, then 1d4/turn for 3 turns.' },
    flash:     { n: 'FLASH', cost: 1, type: 'debuff', desc: '1d6 radiant + blind 2 turns. sorry, bard.' },
    burst:     { n: 'BURST MODE', cost: 2, type: 'atk', desc: 'three shots, 1d4+mod each. spray & pray.' },
    bolt:      { n: 'ESPRESSO BOLT', cost: 1, type: 'atk', desc: '2d8+INT force. double shot, no room.' },
    triple:    { n: 'TRIPLE SHOT', cost: 1, type: 'atk', desc: '3x(1d4+1), always hits. magic. missile.' },
    overclock: { n: 'OVERCLOCK', cost: 2, type: 'util', desc: 'two actions now. crash (skip) next turn.' },
    hedge:     { n: 'HEDGE', cost: 1, type: 'buff', desc: 'halve the next damage you take. classic hedge.' }
};

var WEAPONS = {
    pal1:   { n: 'THE SPREADSHEET', die: 8, plus: 0, desc: 'a heavy ledger of living formulas.' },
    pal2:   { n: 'EXCELIBUR +2', die: 10, plus: 2, price: 60, desc: 'the +2 spreadsheet. pulled from a stone... wait, a docking station.' },
    bard1:  { n: 'VICIOUS LEDGER', die: 8, plus: 0, desc: 'double-entry. both entries hurt.' },
    bard2:  { n: 'AUDITED LEDGER +2', die: 8, plus: 2, price: 55, desc: 'GAAP-compliant violence.' },
    rogue1: { n: 'LUG WRENCH', die: 6, plus: 0, desc: 'four-way. like a tiny menacing compass.' },
    rogue2: { n: 'SHIFT-KNOB SHIV +1', die: 6, plus: 1, critLo: 19, price: 50, desc: 'golf-ball dimples. crits 19-20.' },
    druid1: { n: 'KIT LENS STAFF', die: 6, plus: 0, desc: 'f/5.6. does its best.' },
    druid2: { n: '50MM PRIME +1', die: 8, plus: 1, price: 55, desc: 'fast glass. nifty. fifty.' },
    sorc1:  { n: 'STIR STICK', die: 6, plus: 0, desc: 'wooden. faintly damp with power.' },
    sorc2:  { n: 'PORTAFILTER WAND +1', die: 8, plus: 1, price: 55, desc: '58mm of raw arcana, tamped level.' }
};
var ARMORS = {
    a0: { n: 'GYM SHORTS', ac: 0, desc: 'freedom of movement. nothing else.' },
    a1: { n: 'PATAGONIA VEST +1', ac: 1, price: 35, desc: 'the cuirass of the analyst. sleeves are a liability.' },
    a2: { n: 'INTERVIEW SUIT +2', ac: 2, price: 70, desc: 'suit of mail, business cut. firm handshake included.' }
};
var TRINKETS = {
    lens:   { n: 'PRIME LENS', critLo: 19, desc: 'see the moment early. crit 19-20.' },
    stripe: { n: 'RACING STRIPE', init: 2, flee: 2, desc: '+2 initiative. it does make it faster.' },
    cloak:  { n: 'DIVERSIFIED CLOAK', ac: 1, resist: 1, desc: '+1 AC, -1 to all damage taken. uncorrelated fabric.' }
};
var ITEMS = {
    coldbrew:   { n: 'COLD BREW', kind: 'heal', price: 8, desc: 'heal 2d4+2, +1 FOCUS. iced, obviously.' },
    taco:       { n: 'BREAKFAST TACO', kind: 'heal', price: 10, desc: 'heal 1d8+3. bacon egg & cheese.' },
    kolache:    { n: 'KOLACHE', kind: 'heal', price: 25, desc: 'full HP. the sausage kind. do not debate this.' },
    espresso:   { n: 'ESPRESSO', kind: 'focus', price: 12, desc: 'restore all FOCUS. hands may shake.' },
    bottomless: { n: 'BOTTOMLESS BREW', kind: 'heal', perm: true, desc: 'heal 2d4. the cup never empties. thanks, king.' },
    extracredit:{ n: 'EXTRA CREDIT', kind: 'revive', desc: 'when you drop, rise at 1 HP instead. once.' },
    flask:      { n: 'LIQUID ASSET', kind: 'quest', desc: 'water. extremely literal water.' },
    o2:         { n: 'O2 SENSOR OF TRUTH', kind: 'quest', desc: 'it measures what is actually burning.' },
    cat:        { n: 'CATALYTIC HEART', kind: 'quest', desc: 'warm to the touch. converts sin to steam.' },
    bless:      { n: 'NAT-20 BLESSING', kind: 'quest', desc: 'the dice remember you.' },
    lug:        { n: 'LUG NUTS x4', kind: 'quest', desc: 'recovered. slightly chewed.' },
    film:       { n: 'EXPOSED FILM', kind: 'quest', desc: 'three frames. no flash was used.' }
};

/* ───────────────────────── bestiary ───────────────────────── */
/* acts: atk {dice:[n,die,plus]}, plus optional effects. tele acts
   telegraph one turn, land the next. */
var ENEMIES = {
    squirrel: { n: 'LUG NUT SQUIRREL', spr: 'squirrel', cr: '1/8', hp: 7, ac: 12, init: 3, xp: 8, gold: [2, 5],
        quote: 'It has your parking permit. It has everyone\'s parking permit.',
        acts: [
            { n: 'ACORN TOSS', dice: [1, 4, 1] },
            { n: 'PICKPOCKET', steal: [1, 4], line: 'it lifts some gold!' },
            { n: 'SKITTER', selfAC: 2, line: 'it darts in circles!' }
        ] },
    mosquito: { n: 'MOSQUITO SWARM', spr: 'mosquito', cr: '1/8', hp: 5, ac: 13, init: 4, xp: 7, gold: [1, 3],
        quote: 'The true state bird of the Gulf Coast.',
        acts: [
            { n: 'BITE', dice: [1, 4, 0], dot: { n: 'ITCH', dmg: 1, turns: 2 } },
            { n: 'WHINE', line: 'it whines directly into your ear. no damage. immense psychic toll.' }
        ] },
    humid: { n: 'HUMIDITY ELEMENTAL', spr: 'humid', cr: '1/2', hp: 16, ac: 10, init: 0, xp: 14, gold: [3, 8],
        quote: 'Technically it is 98 degrees. It does not feel like 98 degrees.',
        acts: [
            { n: 'MUGGY EMBRACE', dice: [1, 6, 0], slow: 2 },
            { n: 'DRIZZLE', heal: [1, 4], line: 'it rehydrates.' }
        ] },
    creep: { n: 'SCOPE CREEP', spr: 'creep', cr: '1/4', hp: 10, ac: 11, init: 1, xp: 12, gold: [2, 6],
        quote: 'It started as one small slime. Just one more feature, it said.',
        split: true,
        acts: [
            { n: 'FEATURE REQUEST', dice: [1, 6, 0] },
            { n: 'REQUIREMENT', dice: [1, 4, 1] }
        ] },
    wraith: { n: 'DEADLINE WRAITH', spr: 'wraith', cr: '1', hp: 18, ac: 12, init: 2, xp: 18, gold: [4, 9],
        quote: 'It was due yesterday. It is always due yesterday.',
        ramp: 1,
        acts: [
            { n: 'DUE DATE', dice: [1, 8, 0] },
            { n: 'ALL-NIGHTER', dice: [2, 8, 0], tele: 'the deadline approaches...' }
        ] },
    gasel: { n: 'GAS-PRICE ELEMENTAL', spr: 'gasel', cr: '1', hp: 14, ac: 12, init: 2, xp: 16, gold: [5, 12],
        quote: 'It only goes up. You have learned to stop asking why.',
        acts: [
            { n: 'PRICE SPIKE', dice: [1, 6, 0], ramp: true },
            { n: 'SUPPLY SHOCK', dice: [1, 4, 2] }
        ] },
    golem: { n: 'PUMPJACK GOLEM', spr: 'golem', cr: '2', hp: 26, ac: 14, init: -2, xp: 26, gold: [8, 14],
        quote: 'It has nodded since before your grandfather. It will nod after.',
        acts: [
            { n: 'SLAM', dice: [1, 8, 2] },
            { n: 'BEAM STRIKE', dice: [2, 10, 0], tele: 'the walking beam rises...' }
        ] },
    bump: { n: 'THE SLEEPING POLICEMAN', spr: 'bump', cr: '2', hp: 30, ac: 15, init: -4, xp: 30, gold: [10, 15], boss: true,
        quote: 'A speed bump of unusual size. Your coilovers ache at the sight of it.',
        thorns: 8,
        acts: [
            { n: 'NAP', line: 'it naps, menacingly.' },
            { n: 'RUDE AWAKENING', dice: [2, 6, 0] },
            { n: 'SCRAPE', dice: [1, 10, 0], line: 'you hear the front lip. THE FRONT LIP.' }
        ] },
    bearm: { n: 'BEAR MARKET', spr: 'bearm', cr: '2', hp: 22, ac: 13, init: 1, xp: 22, gold: [6, 12],
        quote: 'Dressed for the office. Hungry for your portfolio.',
        acts: [
            { n: 'MAUL', dice: [2, 6, 0] },
            { n: 'PANIC SELL', fear: 2, line: 'a terrible roar! your grip loosens. (-2 attack, 2 turns)' }
        ] },
    bullm: { n: 'BULL MARKET', spr: 'bullm', cr: '2', hp: 22, ac: 12, init: 2, xp: 22, gold: [6, 12],
        quote: 'Past performance does not guarantee it will not gore you.',
        acts: [
            { n: 'GORE', dice: [1, 8, 2] },
            { n: 'CHARGE', dice: [2, 8, 0], tele: 'it paws the ground...' }
        ] },
    lich: { n: 'THE MIDTERM LICH', spr: 'lich', cr: '3', hp: 34, ac: 14, init: 2, xp: 45, gold: [20, 30], boss: true,
        quote: 'Office hours: by appointment. Appointments: never granted.',
        acts: [
            { n: 'PROBLEM SET', multi: [3, 4, 0] },
            { n: 'POP QUIZ', dice: [2, 6, 0], line: 'you were not prepared!' },
            { n: 'THE CURVE', heal: [2, 6], line: 'it grades on a curve. the curve favors it.' }
        ] },
    squirking: { n: 'THE SQUIRREL KING', spr: 'squirking', cr: '3', hp: 28, ac: 13, init: 3, xp: 40, gold: [15, 25], boss: true,
        quote: 'Heavy is the head that wears the crown. The crown is a bottle cap.',
        summon: 'squirrel',
        acts: [
            { n: 'CROWN BASH', dice: [1, 10, 0] },
            { n: 'ROYAL DECREE', steal: [2, 6], line: 'he taxes you!' },
            { n: 'SUMMON VASSAL', summon: true, line: 'a vassal answers the call!' }
        ] },
    p0420: { n: 'P-0420, HERALD OF EMISSIONS', spr: 'p0420', cr: '5', hp: 64, ac: 15, init: 1, xp: 100, gold: [50, 80], boss: true, final: true,
        quote: 'CATALYST EFFICIENCY BELOW THRESHOLD (BANK 1).',
        acts: [
            { n: 'BACKFIRE', dice: [2, 6, 0] },
            { n: 'EMISSIONS CLOUD', dice: [1, 6, 0], dot: { n: 'FUMES', dmg: 2, turns: 3 } },
            { n: 'LIMP MODE', slow: 2, line: 'your limbs feel heavy. 3,000 RPM, maximum.' },
            { n: 'REDLINE', dice: [3, 8, 0], tele: 'the needle sweeps toward the red...' }
        ] }
};

/* ───────────────────────── journal ────────────────────────── */
var QDEF = {
    main:    { n: 'THE CHECK-ENGINE PROPHECY', stages: [
        'Speak with the Torque Priest in the Garage.',
        'Gather the three relics: the O2 SENSOR (Wastes ruin), the CATALYTIC HEART (Basin Depths), the NAT-20 BLESSING (Dice Oracle).',
        'Return to the Torque Priest with all three relics.',
        'Face P-0420 beyond the sealed door in the Basin Depths.',
        'The light is off. For now. (Complete!)' ] },
    photo:   { n: 'FRONT ROW, NO FLASH', stages: [
        'Shoot 3 clean frames of the bard at the Chaus. NO flash.',
        'Bring the film back to the Editor.',
        'Published. Front page, above the fold. (Complete!)' ] },
    wheel:   { n: 'THE FOURTH WHEEL', stages: [
        'Find the lug nuts the squirrels stole. Check the West Hedges.',
        'Return the lug nuts to the pit crew in the Commons.',
        'Rhys Racing rides again. (Complete!)' ] },
    liquid:  { n: 'LIQUIDITY EVENT', stages: [
        'Obtain 3 LIQUID ASSETS from the caravan in the Permian Wastes.',
        'Deliver the assets to the Hedge Wizard.',
        'Portfolio rebalanced. Literally. (Complete!)' ] },
    lich:    { n: 'OFFICE HOURS OF THE LICH', stages: [
        'Survive the Midterm Lich\'s office hours in Fondren Stacks.',
        'Passed. Somehow. (Complete!)' ] },
    kolache: { n: 'THE KOLACHE THIEF', stages: [
        'Track the crowned squirrel to the south-east West Hedges.',
        'Breakfast justice is served. (Complete!)' ] }
};
var QORDER = ['main', 'photo', 'wheel', 'liquid', 'lich', 'kolache'];

/* ─────────────────── player state helpers ─────────────────── */
function newGame(cls, name, st) {
    var c = CLASSES[cls];
    G = {
        v: 2, name: name, cls: cls, st: st, lvl: 1, xp: 0,
        hpm: c.die + mod(st.con) + 2, hp: 0,
        focm: 2 + Math.max(0, mod(st[c.key])), foc: 0,
        gold: 15,
        inv: [{ id: 'coldbrew', n: 2 }, { id: 'taco', n: 1 }],
        eq: { w: c.w, a: 'a0', t: null },
        spells: [c.spells[1]],
        quests: {}, flags: {}, chests: {},
        map: 'garage', x: 6, y: 7, dir: 'u',
        steps: 0, kills: 0, camps: 0, deaths: 0, nat20s: 0, day: 1
    };
    G.hp = G.hpm; G.foc = G.focm;
}
function prof() { return G.lvl >= 4 ? 3 : 2; }
function weap() { return WEAPONS[G.eq.w]; }
function armr() { return ARMORS[G.eq.a]; }
function trin() { return G.eq.t ? TRINKETS[G.eq.t] : null; }
function playerAC() {
    var t = trin();
    return 10 + mod(G.st.dex) + armr().ac + (t && t.ac ? t.ac : 0);
}
function atkStat() { return CLASSES[G.cls].key; }
function atkMod() { return mod(G.st[atkStat()]) + prof() + (weap().plus || 0) + (G.flags.probation ? -1 : 0); }
function dmgMod() { return mod(G.st[atkStat()]) + (weap().plus || 0); }
function critLo() {
    var lo = weap().critLo || 20;
    var t = trin();
    if (t && t.critLo) lo = Math.min(lo, t.critLo);
    return lo;
}
function addItem(id, n) {
    n = n || 1;
    for (var i = 0; i < G.inv.length; i++) if (G.inv[i].id === id) { G.inv[i].n += n; return; }
    G.inv.push({ id: id, n: n });
}
function countItem(id) {
    for (var i = 0; i < G.inv.length; i++) if (G.inv[i].id === id) return G.inv[i].n;
    return 0;
}
function delItem(id, n) {
    n = n || 1;
    for (var i = 0; i < G.inv.length; i++) if (G.inv[i].id === id) {
        if (ITEMS[id].perm) return;
        G.inv[i].n -= n;
        if (G.inv[i].n <= 0) G.inv.splice(i, 1);
        return;
    }
}
function giveXP(n) { G.xp += n; }
function xpToNext() { return G.lvl >= MAXLVL ? 0 : XPT[G.lvl] - G.xp; }
function canLevel() { return G.lvl < MAXLVL && G.xp >= XPT[G.lvl]; }
function setQuest(q, stage) {
    var was = G.quests[q];
    if (was === stage) return;
    G.quests[q] = stage;
    var done = stage >= QDEF[q].stages.length - 1;
    questToast = { t: 2.4, txt: done ? 'QUEST COMPLETE' : (was == null ? 'NEW QUEST' : 'JOURNAL UPDATED'), sub: QDEF[q].n };
    SFX.ok();
    save();
}
var questToast = null;
function mq() { return G.quests.main == null ? -1 : G.quests.main; }
function relicCount() { return (countItem('o2') ? 1 : 0) + (countItem('cat') ? 1 : 0) + (countItem('bless') ? 1 : 0); }
function healPlayer(n) { G.hp = clamp(G.hp + n, 0, G.hpm); }

/* ──────────────────────── dialogue ────────────────────────── */
/* Node: { t: text|fn, o: [options], next: id, do: fn, end }
   Option: { l, next, if: fn, dc: {st, dc}, ok, no, do: fn }
   Options with dc roll a visible d20 + stat mod vs DC. */
var DLG = {};

DLG.priest = function () {
    var stage = mq();
    var start;
    if (stage <= 0) start = 'intro';
    else if (stage === 1) start = relicCount() >= 3 ? 'ready' : 'collecting';
    else if (stage === 2) start = 'ready';
    else if (stage === 3) start = 'goface';
    else start = 'after';
    return { name: 'TORQUE PRIEST', start: start, nodes: {
        intro: { t: 'You feel it too, then. The amber light. The Steed idles rough, pilgrim. The curse is called P-0420.', next: 'intro2' },
        intro2: { t: 'Catalyst efficiency below threshold. Words of power. Words of a $1,400 estimate.', next: 'intro3' },
        intro3: { t: 'Three relics can lift it. The O2 SENSOR OF TRUTH, in the ruin of the Permian Wastes.', next: 'intro4' },
        intro4: { t: 'The CATALYTIC HEART, deep in the Basin Depths. And a NAT-20 BLESSING. The Dice Oracle at the Chaus deals in those.', next: 'intro5' },
        intro5: { t: 'Bring me all three. And take gold to the barista first. You look... level one.',
            do: function () { setQuest('main', 1); },
            o: [
                { l: 'For the Steed.', next: 'bye' },
                { l: 'Clear the code?', next: 'clear' },
                { l: '[SHOP] The forge', do: function () { openShop('forge'); }, end: true }
            ] },
        clear: { t: 'CLEAR the CODE? You can silence a prophecy, pilgrim. It comes back. At inspection time. It ALWAYS comes back.', next: 'bye' },
        collecting: { t: function () { return 'Relics found: ' + relicCount() + ' of 3. The Steed waits. The light... blinks.'; },
            o: [
                { l: 'Remind me where', next: 'intro3' },
                { l: '[SHOP] The forge', do: function () { openShop('forge'); }, end: true },
                { l: 'On it.', next: 'bye2' }
            ] },
        ready: { t: 'All three... you actually found all three. Then it is time. Stand back from the Steed.', next: 'ritual1',
            do: function () { setQuest('main', 2); } },
        ritual1: { t: 'O2 SENSOR, thread by hand, then torque to spec. CATALYTIC HEART, seated in the downpipe. BLESSING... taped to the ECU. That\'s legal.', next: 'ritual2' },
        ritual2: { t: 'The amber light flickers... shudders... and MOVES. It flees down, pilgrim. Into the earth. Into the BASIN.', next: 'ritual3',
            do: function () { shake(3, 0.6); flashFx('#f2a30f', 0.5); SFX.roar(); } },
        ritual3: { t: 'The sealed door in the Depths stands open. What waits behind it wears your check-engine light as a face. End this.',
            do: function () { G.flags.doorOpen = 1; setQuest('main', 3); save(); }, next: 'bye3' },
        goface: { t: 'The door is open. The Herald waits. Take cold brew. Take courage. Mind the front lip on the way down.',
            o: [
                { l: '[SHOP] Last call', do: function () { openShop('forge'); }, end: true },
                { l: 'I ride.', next: 'bye3' }
            ] },
        after: { t: 'The Steed purrs like a contented dire beast. You did that, pilgrim. Ride it loud and change the oil early.',
            o: [
                { l: 'That flicker...?', next: 'flicker' },
                { l: '[SHOP] The forge', do: function () { openShop('forge'); }, end: true },
                { l: 'Farewell.', next: 'bye' }
            ] },
        flicker: { t: '...I saw nothing. YOU saw nothing. Should\'ve left it stock. (You won\'t.)', end: true },
        bye: { t: 'Torque in three stages, pilgrim. Hand-tight, snug, and *believe*.', end: true },
        bye2: { t: 'The Wastes lie east. The Hedges west. The Chaus pours south. Go.', end: true },
        bye3: { t: 'May your rolls be high and your RPM higher.', end: true }
    } };
};

DLG.willy = function () {
    var n = G.flags.willySpins || 0;
    return { name: 'WILLY THE STATUE', start: 's' + Math.min(n, 4), nodes: {
        s0: { t: 'A stately statue. Legend says it rotates when no one is looking. It is looking at you.', do: function () { G.flags.willySpins = 1; }, end: true },
        s1: { t: 'You look away and back. The statue has rotated four degrees. It says nothing. Statues rarely do.', do: function () { G.flags.willySpins = 2; }, end: true },
        s2: { t: 'Ninety degrees now. It faces the library, as if checking a citation.', do: function () { G.flags.willySpins = 3; }, end: true },
        s3: { t: 'The statue has rotated fully around. You feel briefly, cosmically dizzy.', do: function () { G.flags.willySpins = 4; }, end: true },
        s4: { t: 'A voice like grinding marble: "KID. YOU\'VE SPUN ME FOUR TIMES. TAKE FOUR GOLD AND GO OUTSIDE."',
            do: function () { if (!G.flags.willyPaid) { G.flags.willyPaid = 1; G.gold += 4; SFX.coin(); toastG('+4 GOLD'); } }, end: true }
    } };
};
DLG.sammy = function () {
    return { name: 'SAMMY, ACADEMIC OWL', start: 'a', nodes: {
        a: { t: 'HOO. HOO ARE YOU? Sorry. Owl humor. Ask, wanderer.', o: [
            { l: 'Any wisdom?', next: pick(['w1', 'w2', 'w3', 'w4']) },
            { l: 'Any rumors?', next: pick(['r1', 'r2', 'r3']) },
            { l: 'Admiring the owl', next: 'bye' }
        ] },
        w1: { t: 'Wisdom: never walk back through the Sallyport before you graduate. The curse is real. The registrar is realer.', end: true },
        w2: { t: 'Wisdom: GUARD before a telegraphed blow. The golem winds up. The bull paws the ground. Watch. Then brace.', end: true },
        w3: { t: 'Wisdom: coffee restores FOCUS. This is true in every world, in every genre, forever.', end: true },
        w4: { t: 'Wisdom: the squirrels are organized now. There is a king. It was inevitable.', end: true },
        r1: { t: 'Rumor: the Dice Oracle\'s first roll for any stranger always lands twenty. Beginner\'s luck is a spell she cast in 1987.', end: true },
        r2: { t: 'Rumor: a shelf in Fondren Stacks slides aside. Behind it, they say, the builders left an eye.', end: true },
        r3: { t: 'Rumor: something sleeps on the Hedges road. Do not hit it at speed. Your suspension has feelings.', end: true },
        bye: { t: 'HOO indeed. Fly safe.', end: true }
    } };
};
DLG.editor = function () {
    var q = G.quests.photo;
    var start = q == null ? 'offer' : q === 0 ? 'waiting' : q === 1 ? 'deliver' : 'done';
    return { name: 'THE EDITOR', start: start, nodes: {
        offer: { t: 'You there. You have the eyes of someone who owns fast glass. The Thresher needs a concert shot. Bard. Chaus. Tonight.', o: [
            { l: 'The catch?', next: 'catch' },
            { l: '[QUEST] I\'m in.', next: 'brief', do: function () { setQuest('photo', 0); } },
            { l: 'I shoot for me.', next: 'no' }
        ] },
        catch: { t: 'Three frames, tack sharp, and if you fire a flash mid-set I will print your name under a photo of the empty stage.', o: [
            { l: '[QUEST] Deal.', next: 'brief', do: function () { setQuest('photo', 0); } },
            { l: 'Pass.', next: 'no' }
        ] },
        brief: { t: 'Time the shutter to the beat. Wait for the pose. Three keepers or nothing. Front row is yours.', end: true },
        waiting: { t: 'The bard plays until close. Three keepers. NO FLASH. Go.', end: true },
        deliver: { t: function () { return 'Film. FILM. Let me see... ' + (G.flags.photoScore >= 8 ? 'These are FRONT PAGE. Above the fold!' : G.flags.photoScore >= 5 ? 'Sharp enough. Page three, but with a byline.' : 'Blurry, but honest. We\'ll call it "atmospheric".'); }, next: 'pay' },
        pay: { t: 'Payment as promised. And take this lens. Fast glass finds the moment before it happens.',
            do: function () {
                delItem('film');
                G.gold += 25; SFX.coin();
                if (!G.eq.t) { G.eq.t = 'lens'; } else { addItem('coldbrew', 2); }
                G.flags.gotLens = 1;
                setQuest('photo', 2);
                toastG('+25 GOLD · PRIME LENS');
            }, end: true },
        done: { t: 'The issue sold out. Well. We gave it away, but it sold out of being given away.', end: true },
        no: { t: 'Everyone shoots for themselves until they see their name in print.', end: true }
    } };
};
DLG.crew = function () {
    var q = G.quests.wheel;
    var start = q == null ? 'offer' : q === 2 ? 'done' : (countItem('lug') ? 'deliver' : 'waiting');
    return { name: 'RHYS RACING CREW', start: start, nodes: {
        offer: { t: 'Race day in three suns and the kart sits on THREE wheels. Squirrels took the lug nuts. All four. In formation.', o: [
            { l: 'In... formation?', next: 'form' },
            { l: '[QUEST] On it.', do: function () { setQuest('wheel', countItem('lug') ? 1 : 0); }, next: 'go' },
            { l: 'Try zip ties?', next: 'zip' }
        ] },
        form: { t: 'Wedge formation. Flanking element. One of them had a little map. We are dealing with professionals.', o: [
            { l: '[QUEST] I got it', do: function () { setQuest('wheel', countItem('lug') ? 1 : 0); }, next: 'go' },
            { l: 'Good luck.', next: 'bye' }
        ] },
        zip: { t: 'THIS IS A RACING ORGANIZATION. ...yes. They chewed through them.', next: 'offer' },
        go: { t: 'They nest in the West Hedges. Follow the sound of tiny, organized laughter.', end: true },
        waiting: { t: 'Any nuts? Lug nuts. Please clarify that if you repeat it.', end: true },
        deliver: { t: 'THE NUTS! You beautiful legend. Rhys Racing rides! Take this: pit fund surplus, and a racing stripe. It DOES make you faster.',
            do: function () {
                delItem('lug');
                G.gold += 30; SFX.coin();
                if (!G.eq.t) G.eq.t = 'stripe'; else addItem('espresso', 1);
                setQuest('wheel', 2);
                toastG('+30 GOLD · RACING STRIPE');
            }, end: true },
        done: { t: 'Qualified P2! Would\'ve been P1 but a squirrel was watching from the fence and the driver LOCKED UP.', end: true }
    } };
};
DLG.stu1 = function () {
    return { name: 'STUDENT', start: 'a', nodes: {
        a: { t: pick([
            'I\'m double majoring in econ and vibes.',
            'The fountain? Don\'t swim in it. That\'s a spring semester activity.',
            'I saw the Editor make a freshman cry. Constructively.',
            'They say the Steed in the garage does 0-60 in a prophecy.',
            'Midterms took my roommate. Literally. The Lich has him.'
        ]), end: true }
    } };
};
DLG.stu2 = DLG.stu1;
DLG.stu3 = function () {
    return { name: 'REGULAR', start: 'a', nodes: {
        a: { t: pick([
            'The bard only knows four songs but WOW.',
            'The oracle beat me eleven rolls straight. Statistically actionable.',
            'Cold brew here hits different. It hits like 2d4+2.',
            'I ordered a latte three days ago. Still "on the way". The barista fought a kolache thief mid-pour.'
        ]), end: true }
    } };
};
DLG.barista = function () {
    var kq = G.quests.kolache;
    return { name: 'CHAUS BARISTA', start: 'hi', nodes: {
        hi: { t: function () { return kq == null ? 'Welcome to the Chaus. The espresso machine is haunted, but benevolently. What\'ll it be?' : 'The usual chaos. What\'ll it be?'; }, o: [
            { l: '[SHOP] Coffee.', do: function () { openShop('chaus'); }, end: true },
            { l: 'Heard anything?', next: 'rumor' },
            { l: 'The kolaches...?', next: 'kol', if: function () { return kq == null; } },
            { l: 'The thief?', next: 'kwait', if: function () { return kq === 0; } },
            { l: 'Nothing, thanks', next: 'bye' }
        ] },
        rumor: { t: pick([
            'The oracle in the corner? She tips in advice. It\'s always right. It\'s never comforting.',
            'The Hedge Wizard came in once. Ordered water. WATER. In a coffee house.',
            'The bard\'s tip jar has more gold than the bursar\'s vault. Don\'t tell the bursar.'
        ]), end: true },
        kol: { t: 'You had to ask. A squirrel wearing a CROWN walked in, took the last sausage kolache off the counter, and SALUTED me on the way out.', o: [
            { l: '[QUEST] Avenge.', do: function () { setQuest('kolache', 0); }, next: 'kgo' },
            { l: 'The audacity.', next: 'kaud' }
        ] },
        kaud: { t: 'The AUDACITY is right. If you ever feel like pursuing justice, the little monarch fled west, to the hedges.', o: [
            { l: '[QUEST] For food', do: function () { setQuest('kolache', 0); }, next: 'kgo' },
            { l: 'Godspeed, king.', next: 'bye' }
        ] },
        kgo: { t: 'South-east corner of the West Hedges. Follow the crumbs. He does not share.', end: true },
        kwait: { t: 'Still at large. The breakfast pastry case has never felt so empty.', end: true },
        bye: { t: 'Stay caffeinated out there.', end: true }
    } };
};
DLG.bard = function () {
    var q = G.quests.photo;
    return { name: 'THE BARD', start: q === 0 ? 'show' : 'chat', nodes: {
        chat: { t: pick([
            '*a riff about compound interest, in E minor*',
            'Requests? I know four songs and one of them is legally a chant.',
            'The crowd wants "Wonderwall of Text". The crowd always wants "Wonderwall of Text".'
        ]), end: true },
        show: { t: 'You\'re the shooter? Front row is yours. Catch me at the TOP of the pose — you\'ll feel the beat. Ready?', o: [
            { l: '[SHOOT THE SET]', do: function () { startPhoto(); }, end: true },
            { l: 'Coffee first.', next: 'later' }
        ] },
        later: { t: 'The set runs all night. The lighting, tragically, is "moody".', end: true }
    } };
};
DLG.oracle = function () {
    return { name: 'DICE ORACLE', start: 'hi', nodes: {
        hi: { t: function () { return G.flags.oracleMet ? 'The dice have been asking about you.' : 'Sit. The felt is warm. The dice are... loaded with meaning. Five gold a throw, high roll takes ten.'; },
            do: function () { G.flags.oracleMet = 1; },
            o: [
                { l: '[5G] Roll bones.', do: function () { startOracle(); }, end: true, if: function () { return G.gold >= 5; } },
                { l: 'The blessing...?', next: 'bless', if: function () { return mq() >= 1 && !countItem('bless'); } },
                { l: 'The odds?', next: 'odds' },
                { l: 'Not today.', next: 'bye' }
            ] },
        bless: { t: 'The NAT-20 BLESSING. Yes. It cannot be bought, pilgrim. It must be ROLLED. Throw with me until the twenty comes natural.', o: [
            { l: '[5G] Roll bones.', do: function () { startOracle(); }, end: true, if: function () { return G.gold >= 5; } },
            { l: 'No gold for fate', next: 'poor', if: function () { return G.gold < 5; } },
            { l: 'Later.', next: 'bye' }
        ] },
        odds: { t: 'One in twenty, every throw, forever. That is the beautiful, terrible truth of the twenty. ...the first throw is free-er than most.', end: true },
        poor: { t: 'Fate extends no credit. The bursar taught it that.', end: true },
        bye: { t: 'The dice will wait. The dice are patient. The dice have nowhere to be.', end: true }
    } };
};
DLG.hedgewiz = function () {
    var q = G.quests.liquid;
    var start = q == null ? 'offer' : q === 0 ? (countItem('flask') >= 3 ? 'deliver' : 'waiting') : q === 1 ? 'deliver' : 'done';
    return { name: 'HEDGE WIZARD', start: start, nodes: {
        offer: { t: 'A visitor! Careful of the topiary, it bites. I am a wizard of HEDGES. Botanical AND financial. My portfolio, alas, is underwater.', o: [
            { l: 'How underwater?', next: 'how' },
            { l: 'Metaphorically?', next: 'meta' }
        ] },
        how: { t: 'Sixty percent. I require LIQUID ASSETS. Three of them. The Deep Blue caravan in the Permian Wastes hoards liquidity.', o: [
            { l: '[QUEST] I\'ll go.', do: function () { setQuest('liquid', 0); }, next: 'go' },
            { l: 'Diversify maybe?', next: 'div' }
        ] },
        meta: { t: 'WIZARDS DO NOT DO METAPHOR. My positions are literally in a pond. Three LIQUID ASSETS from the Deep Blue caravan will rebalance everything.', o: [
            { l: '[QUEST] Fine.', do: function () { setQuest('liquid', 0); }, next: 'go' },
            { l: 'This economy...', next: 'bye' }
        ] },
        div: { t: 'DIVERSIFY? I have hedges in eleven sectors, friend. The hedges are the only thing UP this quarter.', next: 'how' },
        go: { t: 'East past the Commons. The Water Baron drives a hard bargain but respects a harder one.', end: true },
        waiting: { t: function () { return 'Assets in hand: ' + countItem('flask') + ' of 3. The pond grows smug.'; }, end: true },
        deliver: { t: 'THE LIQUIDITY! Poured, balanced, rebalanced. My positions bloom! Take this cloak — uncorrelated with every known fabric. And one word of power: HEDGE.',
            do: function () {
                delItem('flask', 3);
                if (!G.eq.t) G.eq.t = 'cloak'; else addItem('kolache', 1);
                if (G.spells.indexOf('hedge') < 0) G.spells.push('hedge');
                setQuest('liquid', 2);
                toastG('DIVERSIFIED CLOAK · HEDGE SPELL');
            }, end: true },
        done: { t: 'The pond and I are on speaking terms again. It apologized. Ponds rarely do.', end: true }
    } };
};
DLG.baron = function () {
    var need = G.quests.liquid === 0 && countItem('flask') < 3;
    return { name: 'WATER BARON', start: need ? 'pitch' : 'idle', nodes: {
        idle: { t: 'Deep Blue moves water where water is owed. Permian rates. Don\'t ask about Permian rates.', end: true },
        pitch: { t: 'Ahh, a buyer. LIQUID ASSETS, three units, thirty gold flat. Finest midstream water in the basin. Filtered through GEOLOGY itself.', o: [
            { l: 'Pay 30 gold.', if: function () { return G.gold >= 30; }, do: function () { G.gold -= 30; addItem('flask', 3); SFX.coin(); toastG('3 LIQUID ASSETS'); }, next: 'sold' },
            { l: '[CHA 13] A pond.', dc: { st: 'cha', dc: 13 }, ok: 'persOk', no: 'persNo' },
            { l: '[STR 14] Nice rig', dc: { st: 'str', dc: 14 }, ok: 'intOk', no: 'intNo' },
            { l: 'Walk away.', next: 'bye' }
        ] },
        sold: { t: 'Pleasure. If anyone asks: the water was ALWAYS this price.', end: true },
        persOk: { t: 'A wizard\'s POND? ...I have a pond guy. Had. Take the three, on the house. Tell the wizard: Deep Blue remembers its friends.',
            do: function () { addItem('flask', 3); toastG('3 LIQUID ASSETS'); SFX.ok(); }, end: true },
        persNo: { t: 'A pond. Sure. And I\'m the Duke of Drainage. Thirty gold or the tap stays shut.', end: true },
        intOk: { t: 'now HOLD ON. No need for... look. Three units. Gratis. Deep Blue values *community relations*.',
            do: function () { addItem('flask', 3); toastG('3 LIQUID ASSETS'); SFX.ok(); }, end: true },
        intNo: { t: 'Cute. The adjusters will see you out.', do: function () { startBattle(['gasel', 'gasel'], { intro: 'THE ADJUSTERS COALESCE!', onWin: function () { addItem('flask', 3); toastG('3 LIQUID ASSETS (SETTLED)'); } }); }, end: true },
        bye: { t: 'Water finds a way. Usually a toll road.', end: true }
    } };
};
DLG.lich = function () {
    var q = G.quests.lich;
    if (q === 1) return { name: 'MIDTERM LICH', start: 'done', nodes: {
        done: { t: 'My finest student. The exam stands eternal, but YOU are excused. Go. Learn something useless and lovely.', end: true } } };
    return { name: 'MIDTERM LICH', start: 'hi', nodes: {
        hi: { t: 'SILENCE IN THE STACKS. ...ah. A pupil. I am the Midterm Lich. I have held office hours since 1912. Nobody comes.', o: [
            { l: 'Test me.', next: 'exam0', do: function () { if (G.quests.lich == null) setQuest('lich', 0); } },
            { l: '[FIGHT] End this', do: function () { if (G.quests.lich == null) setQuest('lich', 0); startLichFight(); }, end: true },
            { l: 'Wrong floor.', next: 'bye' }
        ] },
        exam0: { t: 'THREE QUESTIONS. Answer two truly and I grant what every student craves: EXTRA CREDIT. Fail, and we duel academically. Question one:', next: 'q1' },
        q1: { t: 'You attend my office hours. What is the opportunity cost?', o: [
            { l: 'What else I\'d do', do: function () { G.flags.examScore = (G.flags.examScore || 0) + 1; SFX.ok(); }, next: 'q2' },
            { l: 'Zero. It\'s free', do: function () { SFX.no(); }, next: 'q2w' },
            { l: 'My sanity.', do: function () { SFX.no(); }, next: 'q2w' }
        ] },
        q2w: { t: 'WRONG. Nothing is free. Not even office hours. ESPECIALLY not office hours. Question two:', next: 'q2b' },
        q2: { t: 'CORRECT. There is hope for this cohort. Question two:', next: 'q2b' },
        q2b: { t: 'The rune P0420 appears upon a crimson steed. What does it foretell?', o: [
            { l: 'Cat. efficiency', do: function () { G.flags.examScore = (G.flags.examScore || 0) + 1; SFX.ok(); }, next: 'q3' },
            { l: 'Demons.', do: function () { SFX.no(); }, next: 'q3w' },
            { l: 'Both, honestly.', do: function () { SFX.no(); }, next: 'q3half' }
        ] },
        q3w: { t: 'WRONG, though the mechanic will invoice you as if you were right. Final question:', next: 'q3b' },
        q3half: { t: 'HALF CREDIT for spirit. NONE for scholarship. Final question:', next: 'q3b' },
        q3: { t: 'CORRECT. You have suffered. It shows. Final question:', next: 'q3b' },
        q3b: { t: 'Supply shifts left. Demand shifts right. What happens to price?', o: [
            { l: 'It rises.', do: function () { G.flags.examScore = (G.flags.examScore || 0) + 1; SFX.ok(); }, next: 'grade' },
            { l: 'It falls.', do: function () { SFX.no(); }, next: 'grade' },
            { l: 'Elasticity...?', do: function () { SFX.no(); }, next: 'gradeEl' }
        ] },
        gradeEl: { t: '*the lich pinches the bridge of its nose bone* QUANTITY depends. PRICE. RISES. Elasticity haunts you people like I should.', next: 'grade' },
        grade: { t: function () { return 'Your score: ' + (G.flags.examScore || 0) + ' of 3. ' + ((G.flags.examScore || 0) >= 2 ? 'A PASSING GRADE. The first since the Carter administration.' : 'INSUFFICIENT. We duel. Academically. With claws.'); },
            do: function () {
                var s = G.flags.examScore || 0;
                G.flags.examScore = 0;
                if (s >= 2) { addItem('extracredit', 1); giveXP(30); setQuest('lich', 1); toastG('EXTRA CREDIT · +30 XP'); }
                else { startLichFight(); }
            }, end: true },
        bye: { t: 'shhhhHHHHH.', end: true }
    } };
};

/* prop / sign / object interactions */
var USES = {
    sign_sally: { name: 'WORN PLAQUE', t: 'THE SALLYPORT. Enter through it once, as a new student. Do NOT walk back through until you graduate. The curse is administered automatically.' },
    sign_west: { name: 'SIGNPOST', t: 'WEST: THE WEST HEDGES. Topiary, squirrels, one (1) wizard. Road maintained never.' },
    sign_east: { name: 'SIGNPOST', t: 'EAST: THE PERMIAN WASTES. Water rights enforced. Pumpjacks do not stop for pedestrians.' },
    sign_ruin: { name: 'SCORCHED SIGN', t: 'RUIN OF THE FIRST SENSOR. Air quality: measurable. That was the whole miracle.' },
    sign_bossdoor: { name: 'SEALED DOOR', t: function () { return G.flags.doorOpen ? 'The seal is broken. Heat breathes from below, and something idles... rough.' : 'A great door sealed by amber light. Three relic-slots gape empty. It hums at 780 RPM, badly.'; } },
    use_car: { name: 'THE CRIMSON STEED', t: function () {
        if (mq() >= 4) return 'The Steed idles like silk. The amber light is off. (It flickered. Once. You both agreed not to mention it.)';
        return 'The CRIMSON STEED. MK8 of its line, stage two of its power. Above the cluster, an amber rune burns: P-0420. It seems... embarrassed.';
    }, o: [
        { l: 'Rev it. Once.', do: function () { SFX.rev(); shake(2, 0.3); toastG('the neighbors take notes'); }, end: true },
        { l: 'Pat it gently.', do: function () { toastG('the Steed appreciates you'); SFX.ok(); }, end: true },
        { l: 'Leave it be.', end: true }
    ] },
    secret_shelf: { name: 'ODD SHELF', t: function () {
        return G.flags.secretShelf ? 'The alcove behind the shelf. The painted eye watches, patient as ever. URE BOY, it says, in letters older than the library.'
            : 'This shelf is... lighter than the others. It slides. Behind it: a tiny alcove, a painted EYE, and the words URE BOY. Someone left 10 gold and, inexplicably, great confidence.';
    }, do: function () { if (!G.flags.secretShelf) { G.flags.secretShelf = 1; G.gold += 10; SFX.coin(); toastG('+10 GOLD'); } } },
    chest_stash: { name: 'SQUIRREL STASH', chest: 1, t: 'A chest buried in acorn shells. Inside: FOUR LUG NUTS, arranged in a tiny wedge formation, and 12 gold.',
        loot: function () { addItem('lug', 1); G.gold += 12; if (G.quests.wheel === 0) setQuest('wheel', 1); toastG('LUG NUTS x4 · +12 GOLD'); } },
    chest_road: { name: 'ROADSIDE CHEST', chest: 1, t: 'Left beside the road, dusted with pollen. Inside: 8 gold and a RACING STRIPE decal, still on its backing paper.',
        loot: function () { G.gold += 8; if (!G.eq.t) G.eq.t = 'stripe'; else addItem('coldbrew', 1); toastG('+8 GOLD · RACING STRIPE'); } },
    chest_depths: { name: 'FORGOTTEN COOLER', chest: 1, t: 'An ancient cooler, still faintly cold. The ice packs died heroes. Inside: a pristine KOLACHE and 30 gold.',
        loot: function () { addItem('kolache', 1); G.gold += 30; toastG('KOLACHE · +30 GOLD'); } },
    pedestal_o2: { name: 'RUIN PEDESTAL', t: function () {
        return countItem('o2') || G.flags.gotO2 ? 'The empty pedestal. The air smells accurately measured.'
            : 'A pedestal of scorched stone. Upon it: the O2 SENSOR OF TRUTH, humming softly. The fumes around it begin to swirl...';
    }, guard: function () {
        if (countItem('o2') || G.flags.gotO2) return;
        startBattle(['gasel'], { intro: 'THE FUMES COALESCE TO DEFEND THE RELIC!', onWin: function () {
            G.flags.gotO2 = 1; addItem('o2', 1); toastG('O2 SENSOR OF TRUTH');
            if (relicCount() >= 3) setQuest('main', 2);
        } });
    } },
    pedestal_cat: { name: 'DEEP PEDESTAL', t: function () {
        return countItem('cat') || G.flags.gotCat ? 'The pedestal sits cold and empty.'
            : 'On a pedestal slick with condensation: the CATALYTIC HEART, glowing faintly honeycomb. The floor begins to shake...';
    }, guard: function () {
        if (countItem('cat') || G.flags.gotCat) return;
        startBattle(['golem'], { intro: 'THE VAULT\'S KEEPER WAKES!', onWin: function () {
            G.flags.gotCat = 1; addItem('cat', 1); toastG('CATALYTIC HEART');
            if (relicCount() >= 3) setQuest('main', 2);
        } });
    } }
};

/* ─────────────────── in-game toast + banner ───────────────── */
var gToast = null;
function toastG(s) { gToast = { txt: s, t: 2.2 }; }
function drawToasts(dt) {
    if (gToast) {
        gToast.t -= dt;
        if (gToast.t <= 0) gToast = null;
        else {
            var tl = wrap(gToast.txt, 18);           // fit within the 160px screen
            var lw = 0; for (var ti = 0; ti < tl.length; ti++) lw = Math.max(lw, tl[ti].length);
            var w2 = Math.min(W - 4, lw * 8 + 10);
            var h2 = tl.length * 9 + 5;
            box(Math.round((W - w2) / 2), 2, w2, h2, { bg: '#101018', edge: P.gold });
            for (var tj = 0; tj < tl.length; tj++) txtC(tl[tj], W / 2, 5 + tj * 9, P.gold);
        }
    }
    if (questToast) {
        questToast.t -= dt;
        if (questToast.t <= 0) questToast = null;
        else {
            box(8, 40, W - 16, 26, { bg: '#101018', edge: P.purp });
            txtC(questToast.txt, W / 2, 44, P.gold);
            var nm = questToast.sub.length > 17 ? questToast.sub.slice(0, 17) : questToast.sub;
            txtC(nm, W / 2, 54, P.w);
        }
    }
}

/* ─────────────────────── title scene ──────────────────────── */
var STARS = [];
(function () { for (var i = 0; i < 40; i++) STARS.push({ x: ri(0, 159), y: ri(0, 70), p: Math.random() * 6 }); })();
function ScTitle() {
    var sel = 0, hasSave = !!loadSave(), t = 0, confirmNew = false;
    var opts = hasSave ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME'];
    return { opaque: true,
        enter: function () { music('title'); },
        u: function (dt) { t += dt; },
        d: function () {
            /* dusk sky over the basin */
            ctx.fillStyle = '#131628'; ctx.fillRect(0, 0, W, 60);
            ctx.fillStyle = '#1d2030'; ctx.fillRect(0, 60, W, 30);
            ctx.fillStyle = '#3a3550'; ctx.fillRect(0, 84, W, 16);
            STARS.forEach(function (s) {
                if (Math.sin(t * 2 + s.p) > -0.2) { ctx.fillStyle = ((s.x + s.y) % 3) ? '#8d8d7e' : '#f8f4e3'; ctx.fillRect(s.x, s.y, 1, 1); }
            });
            /* skyline: arch, trees, a pumpjack nodding on the horizon */
            drawSpr('arch', 6, 68, { alpha: 0.9 });
            drawSpr(Math.floor(t * 1.4) % 2 ? 'pump1' : 'pump0', 132, 76);
            ctx.fillStyle = '#0e0f16'; ctx.fillRect(0, 92, W, 8);
            /* the Steed, tiny, cursed */
            ctx.fillStyle = '#5a0d02'; ctx.fillRect(64, 84, 30, 7); ctx.fillRect(70, 80, 16, 5);
            ctx.fillStyle = '#0c0c12'; ctx.fillRect(67, 89, 5, 4); ctx.fillRect(85, 89, 5, 4);
            if (Math.floor(t * 2) % 2) drawSpr('celrune', 71, 66);
            /* logo */
            var ly = Math.min(14, -22 + t * 60);
            txtBigC('URE QUEST', W / 2 + 1, ly + 1, '#0c0c12');
            txtBigC('URE QUEST', W / 2, ly, P.gold);
            if (t > 0.9) { txtC('THE CHECK-ENGINE', W / 2, ly + 20, P.amber); txtC('PROPHECY', W / 2, ly + 29, P.amber); }
            /* menu */
            box(40, 102, 80, 12 + opts.length * 11, { bg: '#101018' });
            for (var i = 0; i < opts.length; i++) {
                if (i === sel) cursor(46, 109 + i * 11 + 1);
                txt(opts[i], 54, 108 + i * 11, i === sel ? P.w : P.dim);
            }
            if (confirmNew) {
                box(20, 56, 120, 34, { bg: '#101018', edge: P.red });
                txtC('ERASE OLD SAVE?', W / 2, 62, P.red);
                txtC('A: YES   B: NO', W / 2, 74, P.w);
            }
            txtC('v1.0 · URE BOY', W / 2, 136, '#3a3a44');
        },
        i: function (a) {
            if (confirmNew) {
                if (a === 'a') { wipeSave(); confirmNew = false; transTo(function () { swapTop(ScCreate()); }); SFX.ok(); }
                else if (a === 'b') { confirmNew = false; SFX.no(); }
                return;
            }
            if (a === 'up') { sel = (sel + opts.length - 1) % opts.length; SFX.move(); }
            else if (a === 'down') { sel = (sel + 1) % opts.length; SFX.move(); }
            else if (a === 'a') {
                if (opts[sel] === 'CONTINUE') {
                    var s = loadSave();
                    if (s) { G = s; delete G.flags.bossLock; SFX.ok(); transTo(function () { swapTop(ScWorld()); enterMap(G.map, G.x, G.y, G.dir, true); }); }
                } else {
                    if (hasSave) { confirmNew = true; SFX.dice(); }
                    else { SFX.ok(); transTo(function () { swapTop(ScCreate()); }); }
                }
            }
        } };
}

/* ─────────────────── character creation ───────────────────── */
function roll4d6dl() {
    var r = [d(6), d(6), d(6), d(6)].sort(function (a, b) { return b - a; });
    return r[0] + r[1] + r[2];
}
var REROLL_QUIPS = [
    'the DM nods.', 'the DM raises an eyebrow.', 'the DM sighs, gently.',
    'the DM is writing something down.', 'the DM has stopped writing. worse.',
    'fine. roll until you are happy. no one ever is.'
];
function ScCreate() {
    var phase = 'cls', ci = 0, t = 0;
    var stats = null, rollAnim = 0, rerolls = 0;
    var nm = 'ISAAC', gridSel = 0;
    var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    function doRollStats() {
        stats = {}; STATS.forEach(function (s) { stats[s] = roll4d6dl(); });
        rollAnim = 0.9; SFX.dice();
    }
    return { opaque: true,
        enter: function () { music('title'); },
        u: function (dt) { t += dt; if (rollAnim > 0) { rollAnim -= dt; if (Math.random() < 0.4) SFX.dice(); } },
        d: function () {
            ctx.fillStyle = '#181826'; ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#101018'; ctx.fillRect(0, 0, W, 14);
            if (phase === 'cls') {
                var cls = CLASSES[CLS_ORDER[ci]];
                txtC('CHOOSE YOUR CLASS', W / 2, 3, P.gold);
                /* portrait left, name + tag right */
                var bob = Math.floor(animT * 2) % 2;
                drawSpr(bob ? 'pd1' : 'pd0', 14, 20, { tint: cls.tint, scale: 3 });
                txtC('<' + (ci + 1) + '/5>', 38, 70, P.dim);
                txt(cls.n.split(' ')[0].slice(0, 11), 68, 22, cls.tint);
                txt(cls.n.split(' ').slice(1).join(' ').slice(0, 11), 68, 31, cls.tint);
                var tg = wrap(cls.tag, 11);
                for (var i0 = 0; i0 < tg.length && i0 < 3; i0++) txt(tg[i0], 68, 44 + i0 * 9, P.dim);
                /* full-width blurb */
                var bl = wrap(cls.blurb, 19);
                for (var i = 0; i < bl.length && i < 3; i++) txt(bl[i], 4, 78 + i * 9, P.w);
                box(4, 105, W - 8, 29, { bg: '#101018' });
                txt('HD d' + cls.die + ' · KEY ' + STAT_N[cls.key], 8, 109, P.dim);
                txt('WPN ' + WEAPONS[cls.w].n.slice(0, 15), 8, 118, P.w);
                txtC('A: PICK  </> BROWSE', W / 2, 136, P.dim);
            } else if (phase === 'stats') {
                var cls2 = CLASSES[CLS_ORDER[ci]];
                txtC('ROLL YOUR FATE', W / 2, 3, P.gold);
                txtC('4d6, drop lowest', W / 2, 17, P.dim);
                for (var j = 0; j < 6; j++) {
                    var st = STATS[j], v = stats[st];
                    var show = rollAnim > 0 ? ri(3, 18) : v;
                    var key = st === cls2.key;
                    txt(STAT_N[st], 26, 30 + j * 11, key ? cls2.tint : P.w);
                    txt(String(show).length < 2 ? ' ' + show : '' + show, 62, 30 + j * 11, rollAnim > 0 ? P.dim : P.w);
                    if (rollAnim <= 0) txt('(' + fmtMod(mod(v)) + ')', 86, 30 + j * 11, mod(v) >= 2 ? P.hp : mod(v) < 0 ? P.red : P.dim);
                    if (key && rollAnim <= 0) txt('*', 116, 30 + j * 11, cls2.tint);
                }
                if (rollAnim <= 0) {
                    box(4, 100, W - 8, 24, { bg: '#101018' });
                    txtC('A: KEEP    B: REROLL', W / 2, 105, P.dim);
                    txtC(rerolls === 0 ? 'the dice await.' : REROLL_QUIPS[Math.min(rerolls - 1, REROLL_QUIPS.length - 1)], W / 2, 114, rerolls > 3 ? P.amber : P.dim);
                }
            } else {
                txtC('NAME THY HERO', W / 2, 3, P.gold);
                box(30, 18, 100, 18, { bg: '#101018' });
                var shown = nm + (Math.floor(animT * 2) % 2 ? '_' : ' ');
                txt(shown, Math.round(W / 2 - (nm.length + 1) * 4), 23, P.w);
                for (var k = 0; k < 36; k++) {
                    var gx = 17 + (k % 9) * 14, gy = 44 + Math.floor(k / 9) * 13;
                    if (k === gridSel) { ctx.fillStyle = '#2c2c40'; ctx.fillRect(gx - 3, gy - 2, 13, 12); }
                    txt(LETTERS[k], gx, gy, k === gridSel ? P.gold : P.w);
                }
                var endSel = gridSel === 36;
                if (endSel) { ctx.fillStyle = '#2c2c40'; ctx.fillRect(56, 98, 48, 12); }
                txtC('END', W / 2, 100, endSel ? P.gold : P.hp);
                txtC('A: PICK  B: DELETE', W / 2, 118, P.dim);
                txtC('a name came with it', W / 2, 128, '#4a4a58');
            }
        },
        i: function (a) {
            if (phase === 'cls') {
                if (a === 'left') { ci = (ci + 4) % 5; SFX.move(); }
                else if (a === 'right') { ci = (ci + 1) % 5; SFX.move(); }
                else if (a === 'a') { phase = 'stats'; doRollStats(); SFX.ok(); }
                else if (a === 'b') { transTo(function () { swapTop(ScTitle()); }); }
            } else if (phase === 'stats') {
                if (rollAnim > 0) return;
                if (a === 'a') { phase = 'name'; SFX.ok(); }
                else if (a === 'b') { rerolls++; doRollStats(); }
            } else {
                if (a === 'left') { gridSel = gridSel === 36 ? 35 : (gridSel + 35) % 36; SFX.move(); }
                else if (a === 'right') { gridSel = gridSel === 36 ? 0 : (gridSel === 35 ? 36 : gridSel + 1); SFX.move(); }
                else if (a === 'up') { gridSel = gridSel === 36 ? 31 : (gridSel < 9 ? 36 : gridSel - 9); SFX.move(); }
                else if (a === 'down') { gridSel = gridSel === 36 ? 4 : (gridSel > 26 ? 36 : gridSel + 9); SFX.move(); }
                else if (a === 'b') { if (nm.length) { nm = nm.slice(0, -1); SFX.no(); } }
                else if (a === 'a') {
                    if (gridSel === 36) {
                        if (!nm.length) nm = 'PILGRIM';
                        SFX.fanfare();
                        if (api) api.markEgg('character', 'rolled a character');
                        newGame(CLS_ORDER[ci], nm, stats);
                        transTo(function () { swapTop(ScIntro()); }, 0.5);
                    } else if (nm.length < 8) { nm += LETTERS[gridSel]; SFX.move(); }
                    else SFX.no();
                }
            }
        } };
}

/* ───────────────────── intro cutscene ─────────────────────── */
function ScIntro() {
    var page = 0, t = 0;
    var pages = [
        ['RICEWOOD.', 'Year two of the', 'Long Semester.'],
        ['Your beloved', 'CRIMSON STEED has', 'borne an amber', 'curse-mark since', 'the autumn.'],
        ['The wise call it', 'P-0420.', '', 'The mechanics', 'call it money.'],
        ['Tonight, ' + (G ? G.name : 'PILGRIM') + ',', 'you do something', 'about it.']
    ];
    return { opaque: true,
        enter: function () { stopMusic(); },
        u: function (dt) { t += dt; },
        d: function () {
            ctx.fillStyle = '#08080c'; ctx.fillRect(0, 0, W, H);
            /* the Steed in silhouette, light blinking */
            ctx.fillStyle = '#1a1a22'; ctx.fillRect(40, 92, 80, 18); ctx.fillRect(56, 82, 44, 12);
            ctx.fillStyle = '#08080c'; ctx.fillRect(48, 106, 12, 8); ctx.fillRect(96, 106, 12, 8);
            ctx.fillStyle = '#26262f'; ctx.fillRect(48, 104, 12, 6); ctx.fillRect(96, 104, 12, 6);
            if (Math.floor(t * 1.6) % 2) drawSpr('celrune', 72, 66);
            var ls = pages[Math.min(page, pages.length - 1)];
            for (var i = 0; i < ls.length; i++) txtC(ls[i], W / 2, 18 + i * 11, P.w);
            if (t > 0.6) moreArrow(W / 2 - 2, 126);
        },
        i: function (a) {
            if (a !== 'a' && a !== 'start') return;
            if (page >= pages.length) return;   // already leaving
            SFX.text();
            page++;
            t = 0;
            if (page >= pages.length) {
                setQuest('main', 0);
                transTo(function () { swapTop(ScWorld()); enterMap(G.map, G.x, G.y, G.dir, true); }, 0.5);
            }
        } };
}

/* ─────────────────────── the overworld ────────────────────── */
var PL = { px: 0, py: 0, tx: 0, ty: 0, mvT: 0, mvFrom: null, dir: 'd', buf: null, step: 0 };
var weather = { rain: false, drops: [], amb: [] };

function enterMap(id, x, y, dir, silent) {
    buildMap(id);
    G.map = id; G.x = x; G.y = y; G.dir = dir || 'd';
    PL.tx = x; PL.ty = y; PL.px = x * TS; PL.py = y * TS; PL.mvT = 0; PL.buf = null; PL.dir = G.dir;
    var def = MAPS[id];
    music(def.music);
    weather.rain = !!(def.rain && Math.random() < def.rain);
    weather.drops = []; weather.amb = [];
    if (!silent) { SFX.door(); save(); }
    mapBanner = { t: 2.2, txt: def.name };
}
var mapBanner = null;

function ScWorld() {
    var t = 0;
    function tryMove(dir) {
        if (PL.mvT > 0) { PL.buf = dir; return; }
        PL.dir = dir; G.dir = dir;
        var dx = dir === 'l' ? -1 : dir === 'r' ? 1 : 0;
        var dy = dir === 'u' ? -1 : dir === 'd' ? 1 : 0;
        var nx = PL.tx + dx, ny = PL.ty + dy;
        if (solidAt(nx, ny)) { return; }
        PL.mvFrom = { x: PL.tx, y: PL.ty };
        PL.tx = nx; PL.ty = ny; PL.mvT = 0.13;
        G.steps++; PL.step ^= 1;
    }
    function arrived() {
        G.x = PL.tx; G.y = PL.ty;
        /* grass rustle */
        var tid = tileAt(PL.tx, PL.ty);
        if ((tid === 'grass' || tid === 'dgrass' || tid === 'flower') && !(api && api.reduced)) {
            addP({ x: PL.px + 8, y: PL.py + 14, vx: ri(-8, 8), vy: -14, g: 60, life: 0.35, t: 0, c: P.g3, s: 1, world: true });
        }
        /* exits */
        var e = exitAt(PL.tx, PL.ty);
        if (e) {
            transTo(function () { enterMap(e.to, e.tx, e.ty, e.dir); });
            return;
        }
        /* triggers */
        var trs = RT.def.triggers || [];
        for (var i = 0; i < trs.length; i++) {
            var tr = trs[i];
            if (PL.tx >= tr.x && PL.tx <= (tr.x2 == null ? tr.x : tr.x2) && PL.ty >= tr.y && PL.ty <= (tr.y2 == null ? tr.y : tr.y2)) fireTrigger(tr.id);
        }
        /* roamer contact */
        for (var j = 0; j < RT.roamers.length; j++) {
            var r = RT.roamers[j];
            if (!r.dead && r.x === PL.tx && r.y === PL.ty) { encounter(r); return; }
        }
    }
    function fireTrigger(id) {
        if (id === 'sallyport') {
            if (G.flags.probation) return;
            if (!G.flags.sallyWarned) {
                G.flags.sallyWarned = 1;
                openDialogTree({ name: 'THE SALLYPORT', start: 'a', nodes: {
                    a: { t: 'A cold academic wind. You matriculated through this arch. To pass again before you graduate is to invite the CURSE.', o: [
                        { l: 'Step through anyway.', next: 'curse' },
                        { l: 'Nope. Nope nope.', do: function () { backstep(); }, end: true }
                    ] },
                    curse: { t: 'The arch remembers you. ACADEMIC PROBATION: -1 to all rolls until you rest.', do: function () { applyProbation(); }, end: true }
                } });
            } else {
                applyProbation();
            }
        } else if (id === 'bossroom') {
            if (mq() === 3 && !G.flags.bossDead && !G.flags.bossLock) {
                G.flags.bossLock = 1;
                startBattle(['p0420'], {
                    boss: true, noFlee: true, musicId: 'boss',
                    intro: 'THE HERALD OF EMISSIONS IDLES BEFORE YOU.',
                    onWin: function () { G.flags.bossDead = 1; setQuest('main', 4); startCredits(); },
                    onEnd: function () { G.flags.bossLock = 0; }
                });
            }
        }
    }
    function applyProbation() {
        if (G.flags.probation) return;
        G.flags.probation = 1;
        flashFx('#7b53c9', 0.4); shake(2, 0.3); SFX.zap();
        toastG('ACADEMIC PROBATION: -1 ALL ROLLS');
    }
    function backstep() {
        var dy = PL.ty < 3 ? 1 : 1;
        PL.ty += dy; G.y = PL.ty; PL.py = PL.ty * TS;
    }
    function encounter(r) {
        var foes = [r.enemy];
        if (r.group) foes = foes.concat(r.group);
        if (r.enemy === 'bullm' && ch(0.35)) foes.push('bearm');
        var opts = {
            musicId: ENEMIES[r.enemy].boss ? 'boss' : 'battle',
            onWin: function () {
                r.dead = true;
                if (r.enemy === 'bump') { G.flags.bumpDead = 1; toastG('the road is calm'); }
                if (r.enemy === 'squirking') {
                    G.flags.kingDead = 1;
                    setQuest('kolache', 1);
                    addItem('bottomless', 1);
                    toastG('BOTTOMLESS BREW RECOVERED');
                }
            }
        };
        if (ENEMIES[r.enemy].boss) opts.noFlee = r.enemy !== 'bump';
        startBattle(foes, opts);
    }
    function interact() {
        var fx = PL.tx + (PL.dir === 'l' ? -1 : PL.dir === 'r' ? 1 : 0);
        var fy = PL.ty + (PL.dir === 'u' ? -1 : PL.dir === 'd' ? 1 : 0);
        var n = npcAt(fx, fy);
        if (n && n.dlg && DLG[n.dlg]) { openDialogTree(DLG[n.dlg]()); return; }
        var p = propAt(fx, fy);
        if (p && p.use) { openUse(p); return; }
        /* face the fountain, hear the water */
        var tid = tileAt(fx, fy);
        if (tid === 'water') { toastG('the water is technically potable'); SFX.text(); }
    }
    return { opaque: true,
        enter: function () {},
        u: function (dt) {
            t += dt;
            RT.frT += dt;
            if (RT.frT > 0.45) { RT.frT = 0; RT.fr++; }
            /* movement tween */
            if (PL.mvT > 0) {
                PL.mvT -= dt;
                var f = 1 - Math.max(0, PL.mvT) / 0.13;
                PL.px = (PL.mvFrom.x + (PL.tx - PL.mvFrom.x) * f) * TS;
                PL.py = (PL.mvFrom.y + (PL.ty - PL.mvFrom.y) * f) * TS;
                if (PL.mvT <= 0) {
                    PL.px = PL.tx * TS; PL.py = PL.ty * TS;
                    arrived();
                    if (PL.buf) { var b = PL.buf; PL.buf = null; tryMove(b); }
                }
            }
            /* npc wander */
            RT.npcs.forEach(function (n) {
                if (!n.wander) return;
                n.t -= dt;
                if (n.t <= 0) {
                    n.t = 1.6 + Math.random() * 2.4;
                    if (ch(0.7)) {
                        var dirs = [[0, 1, 'd'], [0, -1, 'u'], [-1, 0, 'l'], [1, 0, 'r']];
                        var dd = pick(dirs);
                        var nx = n.x + dd[0], ny = n.y + dd[1];
                        if (!solidAt(nx, ny) && !(nx === PL.tx && ny === PL.ty) && !exitAt(nx, ny)) { n.x = nx; n.y = ny; n.dir = dd[2]; }
                    }
                }
            });
            /* roamers */
            RT.roamers.forEach(function (r) {
                if (r.dead) return;
                var z = r.zone;
                if (z[0] === z[2] && z[1] === z[3]) return;      // stationary guardian
                r.t -= dt;
                if (r.t <= 0) {
                    r.t = 0.7 + Math.random() * 0.9;
                    var dxp = PL.tx - r.x, dyp = PL.ty - r.y;
                    var distp = Math.abs(dxp) + Math.abs(dyp);
                    var nx = r.x, ny = r.y;
                    if (r.chase && distp <= 4) {
                        if (Math.abs(dxp) > Math.abs(dyp)) nx += dxp > 0 ? 1 : -1;
                        else ny += dyp > 0 ? 1 : -1;
                    } else {
                        var dd = pick([[0, 1], [0, -1], [-1, 0], [1, 0], [0, 0]]);
                        nx += dd[0]; ny += dd[1];
                    }
                    if (nx < z[0] || nx > z[2] || ny < z[1] || ny > z[3]) return;
                    if (nx === PL.tx && ny === PL.ty) { r.x = nx; r.y = ny; encounter(r); return; }
                    if (!solidAt(nx, ny)) { r.x = nx; r.y = ny; }
                }
            });
            /* weather + ambience */
            updWeather(dt);
        },
        d: function () {
            var mw = RT.w * TS, mh = RT.h * TS;
            var cx = clamp(Math.round(PL.px + 8 - W / 2), 0, Math.max(0, mw - W));
            var cy = clamp(Math.round(PL.py + 8 - H / 2), 0, Math.max(0, mh - H));
            if (mw < W) cx = Math.round((mw - W) / 2);
            if (mh < H) cy = Math.round((mh - H) / 2);
            ctx.drawImage(RT.base, -cx, -cy);
            /* animated tiles */
            RT.anims.forEach(function (a2) {
                var sx = a2.x * TS - cx, sy = a2.y * TS - cy;
                if (sx < -16 || sy < -16 || sx > W || sy > H) return;
                TILE[a2.id].d(ctx, sx, sy, a2.x, a2.y, RT.fr);
            });
            /* y-sorted actors & props */
            var draws = [];
            RT.props.forEach(function (p) {
                var spr = p.spr;
                if (p.chestId || (p.use && USES[p.use] && USES[p.use].chest)) { if (G.chests[p.id]) spr = 'chest1'; }
                if (p.pump) spr = (RT.fr % 2) ? 'pump1' : 'pump0';
                var sc = p.scale || 1;
                draws.push({ y: p.y * TS + sprH(spr) * sc - 4 + (p.deco ? -900 : 0), f: (function (pp, ss, sc2) { return function () {
                    drawSpr(ss, pp.x * TS - cx, pp.y * TS - cy - (sprH(ss) * sc2 - TS) + (pp.yo || 0), { scale: sc2 });
                }; })(p, spr, sc) });
            });
            RT.npcs.forEach(function (n) {
                var bob = n.bob && Math.floor(animT * 2) % 2 ? -1 : 0;
                draws.push({ y: n.y * TS, f: (function (nn, bb) { return function () {
                    shadowAt(nn.x * TS - cx, nn.y * TS - cy);
                    drawSpr(nn.spr, nn.x * TS - cx, nn.y * TS - cy - 2 + bb, { tint: nn.tint });
                }; })(n, bob) });
            });
            RT.roamers.forEach(function (r) {
                if (r.dead) return;
                var hop = Math.floor(animT * 3 + r.i) % 2 ? -1 : 0;
                draws.push({ y: r.y * TS, f: (function (rr, hh) { return function () {
                    shadowAt(rr.x * TS - cx, rr.y * TS - cy);
                    drawSpr(ENEMIES[rr.enemy].spr, rr.x * TS - cx, rr.y * TS - cy - 2 + hh);
                }; })(r, hop) });
            });
            /* the hero */
            draws.push({ y: PL.py + 0.5, f: function () {
                var cls = CLASSES[G.cls];
                var fr = PL.mvT > 0 ? (PL.step ? 1 : 0) : 0;
                var id = PL.dir === 'u' ? 'pu' + fr : PL.dir === 'd' ? 'pd' + fr : 'pl' + fr;
                shadowAt(Math.round(PL.px) - cx, Math.round(PL.py) - cy);
                drawSpr(id, Math.round(PL.px) - cx, Math.round(PL.py) - cy - 2, { tint: cls.tint, flip: PL.dir === 'r' });
            } });
            draws.sort(function (a2, b) { return a2.y - b.y; });
            draws.forEach(function (dd) { dd.f(); });
            /* world-space particles */
            drawParts(cx, cy, true);
            /* CEL rune hovers over the Steed while cursed */
            if (RT.id === 'garage' && mq() < 4) {
                var bobY = Math.sin(animT * 3) * 2;
                if (Math.floor(animT * 2.5) % 3 !== 2) drawSpr('celrune', 4 * TS + 16 - cx, 2 * TS - 6 - cy + bobY);
            }
            drawWeather(cx, cy);
            if (RT.def.dark) drawDarkness(cx, cy);
            drawWorldHUD();
            drawToasts(1 / 60);
            if (mapBanner) {
                mapBanner.t -= 1 / 60;
                if (mapBanner.t <= 0) mapBanner = null;
                else {
                    var bw = mapBanner.txt.length * 8 + 12;
                    box(Math.round((W - bw) / 2), H - 20, bw, 15, { bg: '#101018', edge: P.dim });
                    txtC(mapBanner.txt, W / 2, H - 16, P.w);
                }
            }
        },
        i: function (a) {
            if (TRANS.on) return;
            if (a === 'up') tryMove('u');
            else if (a === 'down') tryMove('d');
            else if (a === 'left') tryMove('l');
            else if (a === 'right') tryMove('r');
            else if (a === 'a') { if (PL.mvT <= 0) interact(); }
            else if (a === 'b') push(ScMenu());
        } };
}
function shadowAt(sx, sy) {
    ctx.fillStyle = 'rgba(10,12,18,0.28)';
    ctx.fillRect(sx + 3, sy + 13, 10, 3);
}
function drawWorldHUD() {
    var frac = G.hp / G.hpm;
    ctx.fillStyle = 'rgba(12,12,18,0.7)'; ctx.fillRect(2, 2, 44, 15);
    bar(4, 4, 40, 4, frac, frac > 0.35 ? P.hp : P.red);
    t35('HP ' + G.hp + '/' + G.hpm, 4, 10, P.w);
    if (G.flags.probation) { t35('-1', 48, 4, P.purp); }
}

/* weather + ambience */
function updWeather(dt) {
    var def = RT.def;
    if (weather.rain) {
        for (var i = 0; i < 3; i++) weather.drops.push({ x: ri(-10, W + 10), y: ri(-12, -2), v: 170 + ri(0, 40), l: ri(4, 7) });
        if (ch(0.0012)) { flashFx('#e8ecff', 0.16); if (ch(0.6)) SFX.roar(); }
    }
    if (def.ambient === 'fireflies' && weather.amb.length < 14 && ch(0.05)) {
        weather.amb.push({ k: 'fly', x: ri(0, RT.w * TS), y: ri(0, RT.h * TS), p: Math.random() * 7, t: 0 });
    }
    if (def.ambient === 'dust' && weather.amb.length < 10 && ch(0.06)) {
        weather.amb.push({ k: 'dust', x: -8, y: ri(10, RT.h * TS - 10), v: ri(14, 30), t: 0 });
    }
    if (def.ambient === 'drips' && ch(0.01)) {
        weather.amb.push({ k: 'drip', x: ri(8, RT.w * TS - 8), y: ri(8, RT.h * TS - 8), t: 0 });
        if (ch(0.4)) SFX.text();
    }
    for (var j = weather.drops.length - 1; j >= 0; j--) {
        var dr = weather.drops[j];
        dr.y += dr.v * (1 / 60); dr.x -= 30 * (1 / 60);
        if (dr.y > H + 4) weather.drops.splice(j, 1);
    }
    for (var k2 = weather.amb.length - 1; k2 >= 0; k2--) {
        var am = weather.amb[k2];
        am.t += dt;
        if (am.k === 'fly') { am.x += Math.sin(am.t * 1.3 + am.p) * 0.4; am.y += Math.cos(am.t * 0.9 + am.p) * 0.3; if (am.t > 20) weather.amb.splice(k2, 1); }
        else if (am.k === 'dust') { am.x += am.v * dt; if (am.x > RT.w * TS + 8) weather.amb.splice(k2, 1); }
        else if (am.k === 'drip' && am.t > 0.5) weather.amb.splice(k2, 1);
    }
}
function drawWeather(cx, cy) {
    if (weather.rain) {
        ctx.strokeStyle = 'rgba(150,180,220,0.55)';
        ctx.beginPath();
        weather.drops.forEach(function (dr) { ctx.moveTo(dr.x, dr.y); ctx.lineTo(dr.x - 1.4, dr.y + dr.l); });
        ctx.stroke();
        ctx.fillStyle = 'rgba(20,26,44,0.14)'; ctx.fillRect(0, 0, W, H);
    }
    weather.amb.forEach(function (am) {
        var sx = am.x - cx, sy = am.y - cy;
        if (sx < -4 || sy < -4 || sx > W + 4 || sy > H + 4) return;
        if (am.k === 'fly') {
            var glow = (Math.sin(am.t * 2.2 + am.p) + 1) / 2;
            if (glow > 0.4) {
                ctx.globalAlpha = glow;
                ctx.fillStyle = '#e9f27c'; ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
                ctx.globalAlpha = glow * 0.3;
                ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 3, 3);
                ctx.globalAlpha = 1;
            }
        } else if (am.k === 'dust') {
            ctx.fillStyle = 'rgba(224,196,137,0.5)'; ctx.fillRect(Math.round(sx), Math.round(sy), 2, 1);
        } else if (am.k === 'drip') {
            ctx.fillStyle = 'rgba(140,180,220,0.6)';
            if (am.t < 0.3) ctx.fillRect(Math.round(sx), Math.round(sy + am.t * 30), 1, 2);
            else ctx.fillRect(Math.round(sx) - 1, Math.round(sy + 9), 3, 1);
        }
    });
}
var darkCv = document.createElement('canvas'); darkCv.width = W; darkCv.height = H;
var darkCx = darkCv.getContext('2d');
function drawDarkness(cx, cy) {
    darkCx.clearRect(0, 0, W, H);
    darkCx.fillStyle = 'rgba(6,7,14,0.86)';
    darkCx.fillRect(0, 0, W, H);
    darkCx.globalCompositeOperation = 'destination-out';
    function hole(x, y, r) {
        var gr = darkCx.createRadialGradient(x, y, 2, x, y, r);
        gr.addColorStop(0, 'rgba(0,0,0,0.95)');
        gr.addColorStop(0.6, 'rgba(0,0,0,0.55)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        darkCx.fillStyle = gr;
        darkCx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    hole(PL.px + 8 - cx, PL.py + 8 - cy, 36);
    RT.anims.forEach(function (a2) {
        if (a2.id !== 'torch') return;
        var sx = a2.x * TS + 8 - cx, sy = a2.y * TS + 6 - cy;
        if (sx < -30 || sy < -30 || sx > W + 30 || sy > H + 30) return;
        hole(sx, sy, 18 + ((RT.fr + a2.x) % 2) * 2);
    });
    darkCx.globalCompositeOperation = 'source-over';
    ctx.drawImage(darkCv, 0, 0);
}

/* ───────────────────────── camp ───────────────────────────── */
function ScCamp() {
    var t = 0, healed = false;
    var quips = [
        'You dream in spreadsheets. They balance.',
        'The Steed sleeps. It dreams of boost.',
        'You dream of golden hour. All sharp.',
        'You dream in scatter plots. No trend.',
        'Graduation. The Sallyport. Soon.'
    ];
    var quip = pick(quips);
    return { opaque: true,
        enter: function () { music('camp'); SFX.door(); },
        u: function (dt) {
            t += dt;
            if (t > 1.4 && !healed) {
                healed = true;
                G.hp = G.hpm; G.foc = G.focm;
                delete G.flags.probation;
                G.camps++; G.day++;
                SFX.heal(); save();
            }
            if (!(api && api.reduced) && ch(0.2)) addP({ x: 76 + ri(-3, 3), y: 84, vx: ri(-4, 4), vy: -22 - ri(0, 14), g: -6, life: 0.8, t: 0, c: pick([P.amber, P.yell, P.red]), s: 1 });
        },
        d: function () {
            ctx.fillStyle = '#0a0c16'; ctx.fillRect(0, 0, W, H);
            STARS.forEach(function (s) {
                if (Math.sin(t + s.p) > -0.3) { ctx.fillStyle = '#8d8d7e'; ctx.fillRect(s.x, s.y + 4, 1, 1); }
            });
            ctx.fillStyle = '#141824'; ctx.fillRect(0, 96, W, 48);
            drawSpr(Math.floor(t * 4) % 2 ? 'fire1' : 'fire0', 68, 78);
            var cls = CLASSES[G.cls];
            drawSpr('pl0', 92, 80, { tint: cls.tint });
            drawParts(0, 0);
            txtC('LONG REST', W / 2, 16, P.gold);
            if (healed) {
                txtC('HP & FOCUS RESTORED', W / 2, 30, P.hp);
                var ql = wrap(quip, 18);
                for (var i = 0; i < ql.length && i < 2; i++) txtC(ql[i], W / 2, 108 + i * 10, P.dim);
                if (t > 2.2) { txtC('A: WAKE', W / 2, 134, P.w); }
            }
        },
        i: function (a) {
            if (a === 'a' && t > 2.2) {
                transTo(function () { pop(); enterMap(G.map, G.x, G.y, G.dir, true); });
            }
        } };
}

/* ─────────────────── dialogue engine ──────────────────────── */
function openDialogTree(tree, onClose) { push(ScDialog(tree, onClose)); }
function openUse(prop) {
    var u = USES[prop.use]; if (!u) return;
    var opened = u.chest && G.chests[prop.id];
    var text = opened ? 'Empty. The absence of loot has a texture.' : (typeof u.t === 'function' ? u.t() : u.t);
    var node = { t: text, end: !u.o, o: u.o };
    if (!opened && u.loot) node.do = function () { u.loot(); G.chests[prop.id] = 1; SFX.coin(); };
    else if (u.do) node.do = u.do;
    var onClose = (!opened && u.guard) ? u.guard : null;
    openDialogTree({ name: u.name, start: 'a', nodes: { a: node } }, onClose);
}

function ScDialog(tree, onClose) {
    var nodeId = tree.start, node = tree.nodes[nodeId];
    var lines = [], page = 0, chars = 0, mode = 'type';   // type|opts|roll
    var optSel = 0, opts = [];
    var roll = null;
    var ranDo = false;
    function nodeText() { var t2 = typeof node.t === 'function' ? node.t() : node.t; return t2 || ''; }
    function loadNode(id) {
        nodeId = id; node = tree.nodes[id];
        if (!node) { close(); return; }
        lines = wrap(nodeText(), 17);
        page = 0; chars = 0; mode = 'type'; optSel = 0; ranDo = false;
        opts = (node.o || []).filter(function (o) { return !o.if || o.if(); });
    }
    function close() {
        pop();
        if (onClose) onClose();
    }
    function runDo() { if (node.do && !ranDo) { ranDo = true; node.do(); } }
    function pageLines() { return lines.slice(page * 3, page * 3 + 3); }
    function lastPage() { return (page + 1) * 3 >= lines.length; }
    function advance() {
        var pl = pageLines().join(' ').length;
        if (mode === 'type' && chars < pl) { chars = pl; return; }
        if (!lastPage()) { page++; chars = 0; return; }
        /* end of text */
        runDo();
        if (opts.length) { mode = 'opts'; return; }
        if (node.next) { loadNode(node.next); return; }
        close();
    }
    function chooseOpt() {
        var o = opts[optSel];
        if (!o) return;
        SFX.ok();
        if (o.end) {         // close FIRST so an o.do that opens a scene isn't popped
            close();
            if (o.do) o.do();
            return;
        }
        if (o.do) o.do();
        if (o.dc) {
            var m = mod(G.st[o.dc.st]) + (G.flags.probation ? -1 : 0);
            roll = { t: 0, dur: 0.8, n: d(20), m: m, dc: o.dc.dc, st: o.dc.st, ok: o.ok, no: o.no, done: false };
            mode = 'roll';
            SFX.dice();
            return;
        }
        if (o.next) { loadNode(o.next); return; }
        close();
    }
    loadNode(nodeId);
    return { opaque: false,
        u: function (dt) {
            if (mode === 'type') {
                var pl = pageLines().join(' ').length;
                if (chars < pl) {
                    chars += dt * 44;
                    if (Math.floor(chars) % 3 === 0) SFX.text();
                    if (chars >= pl) chars = pl;
                }
            } else if (mode === 'roll' && roll) {
                roll.t += dt;
                if (roll.t < roll.dur && Math.random() < 0.3) SFX.dice();
                if (roll.t >= roll.dur + 1.1 && !roll.done) {
                    roll.done = true;
                    var total = roll.n + roll.m;
                    var pass = roll.n === 20 || (roll.n !== 1 && total >= roll.dc);
                    if (roll.n === 20 && api) { api.markEgg('nat20', 'critical hit'); G.nat20s++; }
                    if (pass) SFX.ok(); else SFX.no();
                    var nxt = pass ? roll.ok : roll.no;
                    roll = null;
                    loadNode(nxt);
                }
            }
        },
        d: function () {
            var bh = 46;
            box(2, H - bh - 2, W - 4, bh, { bg: '#14141f' });
            txt(tree.name, 8, H - bh + 2, P.gold);
            ctx.fillStyle = P.dim; ctx.fillRect(8, H - bh + 11, W - 20, 1);
            if (mode === 'roll' && roll) {
                var showN = roll.t < roll.dur ? ri(1, 20) : roll.n;
                drawSpr('d20', 12, H - bh + 15);
                txtBig('' + showN, 34, H - bh + 15, roll.t >= roll.dur ? (roll.n === 20 ? P.gold : roll.n === 1 ? P.red : P.w) : P.dim);
                if (roll.t >= roll.dur) {
                    var total = roll.n + roll.m;
                    txt(fmtMod(roll.m) + ' ' + STAT_N[roll.st] + ' = ' + total, 62, H - bh + 16, P.w);
                    var pass = roll.n === 20 || (roll.n !== 1 && total >= roll.dc);
                    txt('DC ' + roll.dc + ' · ' + (pass ? 'SUCCESS' : 'FAILURE'), 62, H - bh + 26, pass ? P.hp : P.red);
                }
            } else {
                var pls = pageLines();
                var used = 0, budget = Math.floor(chars);
                for (var i = 0; i < pls.length; i++) {
                    var ln = pls[i];
                    var take = clamp(budget - used, 0, ln.length);
                    txt(ln.slice(0, take), 8, H - bh + 15 + i * 10, P.w);
                    used += ln.length + 1;
                }
                if (mode === 'type' && chars >= pageLines().join(' ').length && (!lastPage() || opts.length === 0)) moreArrow(W - 14, H - 10);
            }
            if (mode === 'opts') {
                var oh = opts.length * 10 + 10;
                var ow = 4;
                opts.forEach(function (o) { ow = Math.max(ow, o.l.length * 8 + 20); });
                ow = Math.min(ow, W - 8);
                box(W - ow - 4, H - bh - oh - 4, ow, oh, { bg: '#101018', edge: P.gold });
                for (var j = 0; j < opts.length; j++) {
                    var oy = H - bh - oh + 1 + j * 10;
                    if (j === optSel) cursor(W - ow + 2, oy + 1);
                    var lbl = opts[j].l;
                    if (lbl.length * 8 > ow - 18) lbl = lbl.slice(0, Math.floor((ow - 18) / 8));
                    txt(lbl, W - ow + 10, oy, j === optSel ? P.w : P.dim);
                }
            }
        },
        i: function (a) {
            if (mode === 'roll') return;
            if (mode === 'opts') {
                if (a === 'up') { optSel = (optSel + opts.length - 1) % opts.length; SFX.move(); }
                else if (a === 'down') { optSel = (optSel + 1) % opts.length; SFX.move(); }
                else if (a === 'a') chooseOpt();
                return;
            }
            if (a === 'a') advance();
            else if (a === 'b') { if (chars < pageLines().join(' ').length) chars = 999; else advance(); }
        } };
}

/* ─────────────────────── pause menu ───────────────────────── */
function ScMenu() {
    var items = ['ITEMS', 'JOURNAL', 'HERO', 'CAMP', 'SAVE', 'EJECT'];
    var sel = 0, sub = null, subSel = 0, subMsg = '';
    function usable() { return G.inv.filter(function (it) { return ITEMS[it.id].kind === 'heal' || ITEMS[it.id].kind === 'focus'; }); }
    function questsStarted() { return QORDER.filter(function (q) { return G.quests[q] != null; }); }
    return { opaque: false,
        enter: function () { SFX.ok(); },
        u: function () {},
        d: function () {
            if (!sub) {
                var mh = items.length * 11 + 12, bw = 74;
                box(W - bw - 2, 4, bw, mh, { bg: '#14141f' });
                for (var i = 0; i < items.length; i++) {
                    var dis = items[i] === 'CAMP' && !MAPS[G.map].outdoors;
                    if (i === sel) cursor(W - bw + 4, 11 + i * 11 + 1);
                    txt(items[i], W - bw + 12, 10 + i * 11, dis ? '#4a4a55' : i === sel ? P.w : P.dim);
                }
                box(W - bw - 2, mh + 6, bw, 22, { bg: '#101018' });
                t35('G ' + G.gold, W - bw + 6, mh + 11, P.gold);
                t35('LV ' + G.lvl + ' XP ' + G.xp, W - bw + 6, mh + 19, P.w);
            } else if (sub === 'items') {
                var us = usable();
                box(4, 4, W - 8, 100, { bg: '#14141f' });
                txtC('PROVISIONS', W / 2, 8, P.gold);
                if (!us.length) txtC('pockets: empty', W / 2, 40, P.dim);
                for (var j = 0; j < us.length && j < 6; j++) {
                    if (j === subSel) cursor(10, 22 + j * 11 + 1);
                    txt(ITEMS[us[j].id].n.slice(0, 13), 18, 21 + j * 11, j === subSel ? P.w : P.dim);
                    txt('x' + us[j].n, 128, 21 + j * 11, P.dim);
                }
                box(4, 106, W - 8, 34, { bg: '#101018' });
                var cur = us[subSel];
                if (cur) {
                    var dl = wrap(ITEMS[cur.id].desc, 18);
                    for (var k2 = 0; k2 < dl.length && k2 < 2; k2++) txt(dl[k2], 10, 111 + k2 * 9, P.dim);
                }
                if (subMsg) txt(subMsg, 10, 129, P.hp);
            } else if (sub === 'journal') {
                var qs = questsStarted();
                box(4, 4, W - 8, 136, { bg: '#14141f' });
                txtC('QUEST JOURNAL', W / 2, 8, P.gold);
                if (!qs.length) txtC('no quests yet.', W / 2, 40, P.dim);
                var y2 = 22;
                for (var q2 = 0; q2 < qs.length; q2++) {
                    var qd = QDEF[qs[q2]], stg = G.quests[qs[q2]];
                    var done = stg >= qd.stages.length - 1;
                    txt((done ? '*' : '>') + qd.n.slice(0, 17), 10, y2, done ? '#5a7a5a' : P.gold);
                    y2 += 10;
                    if (q2 === subSel % qs.length && !done) {
                        var sl = wrap(qd.stages[stg], 17);
                        for (var s3 = 0; s3 < sl.length && s3 < 3; s3++) { txt(' ' + sl[s3], 10, y2, P.dim); y2 += 9; }
                    }
                    if (y2 > 122) break;
                }
            } else if (sub === 'hero') {
                box(4, 4, W - 8, 136, { bg: '#14141f' });
                var cls = CLASSES[G.cls];
                drawSpr('pd0', 8, 8, { tint: cls.tint });
                txt(G.name.slice(0, 8), 28, 8, P.w);
                txt('G ' + G.gold, 112, 8, P.gold);
                txt(cls.n.slice(0, 15), 28, 17, cls.tint);
                txt('LV ' + G.lvl, 8, 30, P.w);
                txt('XP ' + (G.lvl < MAXLVL ? G.xp + '/' + XPT[G.lvl] : G.xp + ' MAX'), 54, 30, P.dim);
                txt('HP ' + G.hp + '/' + G.hpm, 8, 41, P.w);
                txt('FOC ' + G.foc + '/' + G.focm, 78, 41, P.foc);
                txt('AC ' + playerAC(), 8, 52, P.w);
                txt('PROF +' + prof(), 78, 52, P.dim);
                for (var s4 = 0; s4 < 6; s4++) {
                    var stn = STATS[s4];
                    txt(STAT_N[stn] + ' ' + G.st[stn] + ' ' + fmtMod(mod(G.st[stn])), 8 + (s4 % 2) * 74, 64 + Math.floor(s4 / 2) * 9, stn === cls.key ? cls.tint : P.w);
                }
                txt('WPN ' + weap().n.slice(0, 13), 8, 94, P.w);
                txt('ARM ' + armr().n.slice(0, 13), 8, 103, P.w);
                txt('TRK ' + (trin() ? trin().n.slice(0, 13) : '-'), 8, 112, P.w);
                var spl = G.spells.map(function (s5) { return SPELLS[s5].n.split(' ')[0]; }).join(' ');
                txt('SPL ' + spl.slice(0, 13), 8, 121, P.foc);
                t35('DAY ' + G.day + '  STEPS ' + G.steps + '  KO ' + G.kills + '  N20 ' + G.nat20s, 8, 132, '#7a7a82');
            }
        },
        i: function (a) {
            if (sub) {
                if (a === 'b') { sub = null; subSel = 0; subMsg = ''; SFX.no(); return; }
                if (sub === 'items') {
                    var us = usable();
                    if (a === 'up') { subSel = Math.max(0, subSel - 1); SFX.move(); }
                    else if (a === 'down') { subSel = Math.min(Math.max(0, us.length - 1), subSel + 1); SFX.move(); }
                    else if (a === 'a' && us[subSel]) {
                        var it = us[subSel], def = ITEMS[it.id];
                        if (def.kind === 'heal' && G.hp >= G.hpm) { subMsg = 'HP already full.'; SFX.no(); return; }
                        if (def.kind === 'focus' && G.foc >= G.focm) { subMsg = 'FOCUS already full.'; SFX.no(); return; }
                        var healed = 0;
                        if (it.id === 'coldbrew') { healed = d(4) + d(4) + 2; G.foc = clamp(G.foc + 1, 0, G.focm); }
                        else if (it.id === 'taco') healed = d(8) + 3;
                        else if (it.id === 'kolache') healed = G.hpm;
                        else if (it.id === 'bottomless') healed = d(4) + d(4);
                        else if (it.id === 'espresso') { G.foc = G.focm; }
                        if (healed) healPlayer(healed);
                        delItem(it.id, 1);
                        SFX.heal();
                        subMsg = healed ? '+' + Math.min(healed, G.hpm) + ' HP' : 'FOCUS restored';
                        if (subSel >= usable().length) subSel = Math.max(0, usable().length - 1);
                    }
                } else if (sub === 'journal') {
                    var qs = questsStarted();
                    if (a === 'up' || a === 'down') { subSel = (subSel + (a === 'down' ? 1 : qs.length - 1)) % Math.max(1, qs.length); SFX.move(); }
                }
                return;
            }
            if (a === 'up') { sel = (sel + items.length - 1) % items.length; SFX.move(); }
            else if (a === 'down') { sel = (sel + 1) % items.length; SFX.move(); }
            else if (a === 'b') pop();
            else if (a === 'a') {
                var pickd = items[sel];
                if (pickd === 'ITEMS') { sub = 'items'; subSel = 0; SFX.ok(); }
                else if (pickd === 'JOURNAL') { sub = 'journal'; subSel = 0; SFX.ok(); }
                else if (pickd === 'HERO') { sub = 'hero'; SFX.ok(); }
                else if (pickd === 'CAMP') {
                    if (!MAPS[G.map].outdoors) { toastG('camp outdoors only'); SFX.no(); return; }
                    pop(); transTo(function () { push(ScCamp()); });
                }
                else if (pickd === 'SAVE') { save(); toastG('GAME SAVED'); SFX.ok(); }
                else if (pickd === 'EJECT') { save(); if (api) api.eject(); }
            }
        } };
}

/* ─────────────────────────── shop ─────────────────────────── */
function openShop(kind) { push(ScShop(kind)); }
function ScShop(kind) {
    var sel = 0, msg = '';
    function stock() {
        if (kind === 'chaus') {
            return [
                { id: 'coldbrew', item: 1, price: ITEMS.coldbrew.price },
                { id: 'taco', item: 1, price: ITEMS.taco.price },
                { id: 'kolache', item: 1, price: ITEMS.kolache.price, dis: G.quests.kolache != null && G.quests.kolache < 1 },
                { id: 'espresso', item: 1, price: ITEMS.espresso.price }
            ].filter(function (s) { return !s.dis; });
        }
        var out = [];
        var w2 = G.cls + '2';
        if (G.eq.w !== w2) out.push({ id: w2, weap: 1, price: WEAPONS[w2].price });
        if (G.eq.a === 'a0') out.push({ id: 'a1', arm: 1, price: ARMORS.a1.price });
        if (G.eq.a !== 'a2') out.push({ id: 'a2', arm: 1, price: ARMORS.a2.price });
        out.push({ id: 'coldbrew', item: 1, price: ITEMS.coldbrew.price });
        return out;
    }
    function nameOf(s) { return s.weap ? WEAPONS[s.id].n : s.arm ? ARMORS[s.id].n : ITEMS[s.id].n; }
    function descOf(s) { return s.weap ? WEAPONS[s.id].desc : s.arm ? ARMORS[s.id].desc : ITEMS[s.id].desc; }
    return { opaque: false,
        enter: function () { SFX.coin(); },
        d: function () {
            var st = stock();
            box(4, 4, W - 8, 100, { bg: '#14141f' });
            txtC(kind === 'chaus' ? 'CHAUS MENU' : 'THE FORGE', W / 2, 8, P.gold);
            txt('G ' + G.gold, 120, 8, P.gold);
            if (!st.length) txtC('sold out. impressive.', W / 2, 46, P.dim);
            for (var i = 0; i < st.length; i++) {
                if (i === sel) cursor(10, 24 + i * 12 + 1);
                var afford = G.gold >= st[i].price;
                txt(nameOf(st[i]).slice(0, 13), 18, 23 + i * 12, i === sel ? (afford ? P.w : P.red) : P.dim);
                txt(st[i].price + 'g', 126, 23 + i * 12, afford ? P.gold : P.red);
            }
            box(4, 106, W - 8, 34, { bg: '#101018' });
            var cur = st[sel];
            if (cur) {
                var dl = wrap(descOf(cur), 18);
                for (var k2 = 0; k2 < dl.length && k2 < 2; k2++) txt(dl[k2], 10, 111 + k2 * 9, P.dim);
            }
            txt(msg || 'A: BUY   B: LEAVE', 10, 129, msg ? P.hp : '#4a4a58');
        },
        i: function (a) {
            var st = stock();
            if (a === 'b') { pop(); return; }
            if (a === 'up') { sel = Math.max(0, sel - 1); SFX.move(); msg = ''; }
            else if (a === 'down') { sel = Math.min(st.length - 1, sel + 1); SFX.move(); msg = ''; }
            else if (a === 'a' && st[sel]) {
                var s = st[sel];
                if (G.gold < s.price) { msg = 'not enough gold.'; SFX.no(); return; }
                G.gold -= s.price;
                if (s.weap) { G.eq.w = s.id; msg = 'equipped!'; }
                else if (s.arm) { G.eq.a = s.id; msg = 'equipped!'; }
                else { addItem(s.id, 1); msg = 'purchased.'; }
                SFX.coin(); save();
                if (sel >= stock().length) sel = Math.max(0, stock().length - 1);
            }
        } };
}

/* ──────────────────── the dice oracle ─────────────────────── */
function startOracle() { push(ScOracle()); }
function ScOracle() {
    var phase = 'idle', t = 0, mine = 0, hers = 0, msg = 'A: ROLL (5g)   B: LEAVE';
    function resolve() {
        if (mine === 20) {
            G.nat20s++;
            if (api) api.markEgg('nat20', 'critical hit');
            if (mq() >= 1 && !countItem('bless') && !G.flags.gotBless) {
                G.flags.gotBless = 1;
                addItem('bless', 1);
                if (relicCount() >= 3) setQuest('main', 2);
                burstP(80, 60, [P.gold, P.w, P.purp], 26, 60);
                return 'NAT 20! The oracle bows. THE BLESSING IS YOURS.';
            }
            burstP(80, 60, [P.gold, P.w], 20, 50);
            return 'NAT 20! +15 gold. The oracle smiles.';
        }
        if (mine === 1) return 'Natural one. The DM smiles. Somewhere.';
        if (mine > hers) return 'You win the throw! +10 gold.';
        if (mine < hers) return 'The oracle takes the pot. Naturally.';
        return 'A tie. The dice keep the gold. House rule.';
    }
    return { opaque: false,
        u: function (dt) {
            t += dt;
            if (phase === 'rolling') {
                if (Math.random() < 0.3) SFX.dice();
                if (t > 0.9) {
                    phase = 'done';
                    if (!G.flags.oracleRolled) { G.flags.oracleRolled = 1; mine = 20; }
                    else mine = d(20);
                    hers = d(20);
                    if (mine === 20) { G.gold += 15; SFX.crit(); }
                    else if (mine > hers) { G.gold += 10; SFX.coin(); }
                    else SFX.no();
                    msg = resolve();
                    save();
                }
            }
        },
        d: function () {
            box(10, 26, W - 20, 92, { bg: '#181322', edge: P.purp });
            txtC('THE FELT OF FATE', W / 2, 31, P.purp);
            t35('G ' + G.gold, 16, 31, P.gold);
            txt('YOU', 34, 46, P.w);
            txt('ORACLE', 92, 46, P.w);
            var showM = phase === 'rolling' ? ri(1, 20) : mine || '-';
            var showH = phase === 'rolling' ? ri(1, 20) : hers || '-';
            drawSpr('d20', 26, 56);
            drawSpr('d20', 96, 56);
            txtBig('' + showM, 44, 60, phase === 'done' && mine === 20 ? P.gold : P.w);
            txtBig('' + showH, 116, 60, P.w);
            var ml = wrap(msg, 18);
            for (var i = 0; i < ml.length && i < 3; i++) txtC(ml[i], W / 2, 84 + i * 9, phase === 'done' && mine === 20 ? P.gold : P.dim);
            drawParts(0, 0);
        },
        i: function (a) {
            if (phase === 'rolling') return;
            if (a === 'b') { pop(); return; }
            if (a === 'a') {
                if (G.gold < 5) { msg = 'Fate extends no credit.'; SFX.no(); return; }
                G.gold -= 5; t = 0; phase = 'rolling'; mine = 0; hers = 0; msg = 'the bones tumble...';
            }
        } };
}

function startLichFight() {
    startBattle(['lich'], {
        noFlee: true, musicId: 'boss',
        intro: 'THE LICH RISES. CLASS IS IN SESSION.',
        onWin: function () {
            if (G.quests.lich !== 1) {
                setQuest('lich', 1);
                addItem('extracredit', 1);
                toastG('EXTRA CREDIT EARNED');
            }
        }
    });
}

/* ─────────────────────── battle! ──────────────────────────── */
var DROPS = { creep: ['coldbrew', 0.3], wraith: ['espresso', 0.25], humid: ['coldbrew', 0.25], golem: ['taco', 0.3], bearm: ['taco', 0.3], bullm: ['taco', 0.3] };

function startBattle(ids, opts) {
    opts = opts || {};
    push(ScBattle(ids, opts));
}

function ScBattle(ids, opts) {
    var bt = {
        foes: [], phase: 'q', q: [], menuSel: 0, sub: null, subSel: 0, target: 0,
        round: 0, guard: false, pconds: [], launchUsed: false, crashNext: false,
        extraAct: 0, smogBroken: false, look: null, biome: 'grass', t: 0,
        msg: '', dice: null, win: null, fled: false
    };
    function addFoe(id, hpOver) {
        var def = ENEMIES[id];
        bt.foes.push({ id: id, def: def, hp: hpOver || def.hp, hpShow: hpOver || def.hp, maxhp: def.hp, conds: [], tele: null, acD: 0, dead: false, blink: 0, split2: false, rounds: 0, seen: false });
    }
    ids.forEach(function (i2) { addFoe(i2); });
    if (G.map === 'wastes') bt.biome = 'sand';
    else if (G.map === 'depths') bt.biome = 'cave';
    else if (G.map === 'stacks') bt.biome = 'library';

    /* ── the little script runner ── */
    function step(dur, drawFn, startFn) { bt.q.push({ t: dur, draw: drawFn, start: startFn, started: false }); }
    function msgStep(m, dur) { step(dur || 1.0, null, function () { bt.msg = m; }); }
    function thenFn(fn) { step(0.01, null, fn); }
    function alive() { return bt.foes.filter(function (f) { return !f.dead; }); }

    /* ── dice banner ── */
    function diceStep(pre, m2, vs, cb, opt2) {
        opt2 = opt2 || {};
        step(0.7, null, function () {
            bt.dice = { rollT: 0.7, n: 0, m: m2, vs: vs, pre: pre, res: '', color: P.w, adv: opt2.adv, dis: opt2.dis };
            SFX.dice();
        });
        step(1.15, null, function () {
            var n = d(20);
            if (opt2.adv) n = Math.max(n, d(20));
            if (opt2.dis) n = Math.min(n, d(20));
            var total = n + m2;
            bt.dice.n = n; bt.dice.rollT = 0;
            var crit = opt2.critLo ? n >= opt2.critLo : n === 20;
            var hit = n !== 1 && (n === 20 || total >= vs);
            if (n === 20) {
                G.nat20s = (G.nat20s || 0) + 1;
                if (api && opt2.mine) api.markEgg('nat20', 'critical hit');
            }
            if (opt2.auto) { hit = true; crit = false; }
            bt.dice.res = n === 1 ? 'NAT 1!' : crit && opt2.mine ? 'CRIT!' : hit ? 'HIT!' : 'MISS';
            bt.dice.color = n === 1 ? P.red : crit && opt2.mine ? P.gold : hit ? P.hp : P.dim;
            if (crit && opt2.mine && n === 20) { hitstop(0.12); shake(3, 0.25); SFX.crit(); }
            else if (hit) SFX.hit(); else SFX.whiff();
            bt._lastRoll = { n: n, hit: hit, crit: crit };
        });
        thenFn(function () { var r = bt._lastRoll; bt.dice = null; cb(r); });
    }

    /* ── damage plumbing ── */
    function foePos(i2) {
        var al = bt.foes.length;
        var xs = al === 1 ? [96] : al === 2 ? [70, 122] : [54, 96, 134];
        return xs[Math.min(i2, xs.length - 1)];
    }
    function hurtFoe(f, dmg, tag) {
        if (f.def.final && !bt.smogBroken && dmg > 1) {
            dmg = 1;
            msgStep('the SMOG VEIL absorbs it! (try the O2 SENSOR...)', 1.3);
        }
        f.hp = Math.max(0, f.hp - dmg);
        f.blink = 0.4;
        var fx2 = foePos(bt.foes.indexOf(f));
        ftext(fx2, 46, '-' + dmg, tag === 'crit' ? P.gold : P.w);
        if (tag === 'crit') burstP(fx2, 56, [P.gold, P.w, P.red], 16, 55);
        shake(tag === 'crit' ? 3 : 1, 0.18);
        if (f.hp <= 0) {
            f.dead = true;
            G.kills++;
            burstP(fx2, 60, ['#8b8f96', P.w, '#4a4a55'], 18, 40);
            msgStep(f.def.n + ' is defeated!', 0.9);
        } else {
            if (f.def.split && !f.split2 && f.hp <= f.maxhp / 2) {
                f.split2 = true;
                thenFn(function () { addFoe(f.id, Math.ceil(f.hp / 2)); var nf = bt.foes[bt.foes.length - 1]; nf.split2 = true; });
                msgStep('the scope GROWS. another slime buds off!', 1.2);
            }
            if (f.def.thorns && dmg >= f.def.thorns) {
                thenFn(function () { var td = d(6); dmgPlayer(td, true); bt.msg = 'too fast! the bump bites back for ' + td + '!'; SFX.hurt(); });
                step(1.0, null, null);
            }
        }
    }
    function dmgPlayer(dmg, pierce) {
        if (bt.guard && !pierce) dmg = Math.ceil(dmg / 2);
        var hi = pcond('hedge');
        if (hi) { dmg = Math.ceil(dmg / 2); rmPcond('hedge'); }
        var t2 = trin();
        if (t2 && t2.resist) dmg = Math.max(1, dmg - t2.resist);
        G.hp = Math.max(0, G.hp - dmg);
        ftext(30, 70, '-' + dmg, P.red);
        flashFx('#d81e05', 0.12);
        shake(2, 0.2);
        SFX.hurt();
        if (G.hp <= 0) {
            if (countItem('extracredit')) {
                delItem('extracredit');
                G.hp = 1;
                msgStep('EXTRA CREDIT! You rise at 1 HP. The Lich would be proud.', 1.6);
                SFX.level();
            } else {
                thenFn(function () { doLose(); });
            }
        }
    }
    function pcond(id) { for (var i2 = 0; i2 < bt.pconds.length; i2++) if (bt.pconds[i2].id === id) return bt.pconds[i2]; return null; }
    function addPcond(id, turns, val) { var c = pcond(id); if (c) { c.turns = Math.max(c.turns, turns); c.val = val; } else bt.pconds.push({ id: id, turns: turns, val: val }); }
    function rmPcond(id) { for (var i2 = bt.pconds.length - 1; i2 >= 0; i2--) if (bt.pconds[i2].id === id) bt.pconds.splice(i2, 1); }
    function fcond(f, id) { for (var i2 = 0; i2 < f.conds.length; i2++) if (f.conds[i2].id === id) return f.conds[i2]; return null; }

    /* ── player actions ── */
    function pAtkMod() { var m2 = atkMod(); var fe = pcond('fear'); if (fe) m2 -= 2; var ins = pcond('inspire'); if (ins) m2 += 4; return m2; }
    function endInspire() { rmPcond('inspire'); }
    function playerAttack(spec) {
        spec = spec || {};
        var f = alive()[Math.min(bt.target, alive().length - 1)];
        if (!f) return;
        bt.phase = 'q';
        var cl = spec.critLo || critLo();
        diceStep((spec.label || weap().n), pAtkMod(), f.def.ac + f.acD, function (r) {
            endInspire();
            if (!r.hit) { msgStep(r.n === 1 ? 'natural 1. the DM smiles.' : 'a miss!', 0.9); endPlayerAction(); return; }
            var w2 = weap();
            var dmg = 0, rolls = spec.dmgDice ? spec.dmgDice() : (function () { var v = d(w2.die); return r.crit ? v + d(w2.die) : v; })();
            dmg = rolls + dmgMod() + (spec.bonus || 0);
            if (spec.extraDice) dmg += spec.extraDice(r.crit);
            dmg = Math.max(1, dmg);
            hurtFoe(f, dmg, r.crit ? 'crit' : '');
            endPlayerAction();
        }, { mine: true, critLo: cl });
    }
    function castSpell(id) {
        var sp = SPELLS[id];
        if (G.foc < sp.cost) { bt.msg = 'not enough FOCUS. (coffee helps.)'; SFX.no(); return; }
        G.foc -= sp.cost;
        bt.sub = null; bt.phase = 'q';
        var f = alive()[Math.min(bt.target, alive().length - 1)];
        var kmod = mod(G.st[CLASSES[G.cls].key]);
        switch (id) {
            case 'audit':
                if (f) f.seen = true;
                msgStep('DIVINE AUDIT! The ledger opens. All is REVEALED.', 1.0);
                playerAttack({ label: 'DIVINE AUDIT', extraDice: function (crit) { return crit ? d(6) + d(6) + d(6) + d(6) : d(6) + d(6); } });
                return;
            case 'reconcile':
                var h = d(8) + d(8) + prof();
                healPlayer(h); SFX.heal();
                ftext(30, 66, '+' + h, P.hp);
                msgStep('the accounts RECONCILE. +' + h + ' HP.', 1.1);
                break;
            case 'pivot':
                addPcond('pivot', 3, 2);
                msgStep('PIVOT TABLE! Reality reorganizes. +2 AC, 3 turns.', 1.1);
                break;
            case 'interest':
                if (f) { f.conds.push({ id: 'interest', val: 1, turns: 4 }); msgStep('COMPOUND INTEREST accrues on ' + f.def.n + '.', 1.2); }
                break;
            case 'inspire':
                addPcond('inspire', 9, 4);
                msgStep('LIQUIDITY! You feel extremely solvent. +4 next attack.', 1.1);
                break;
            case 'margin':
                var full = G.gold >= 15;
                if (full) G.gold -= 15;
                var md = full ? d(8) + d(8) + d(8) + d(8) : d(8) + d(8);
                msgStep(full ? 'MARGIN CALL! The market answers: ' + md + '!' : 'INSUFFICIENT FUNDS. A weak call: ' + md + '.', 1.2);
                thenFn(function () { var f2 = alive()[0]; if (f2) hurtFoe(f2, md, ''); SFX.zap(); });
                break;
            case 'launch':
                if (bt.launchUsed) { bt.msg = 'launch control needs a cooldown.'; G.foc += sp.cost; SFX.no(); bt.phase = 'menu'; return; }
                bt.launchUsed = true; bt.extraAct = 1;
                msgStep('LAUNCH CONTROL. Revs held... GO. Two actions!', 1.1);
                SFX.rev();
                break;
            case 'smoke':
                if (f) { f.conds.push({ id: 'blind', turns: 2 }); msgStep('catback SMOKE! ' + f.def.n + ' is blinded.', 1.1); }
                break;
            case 'apex':
                msgStep('you line up the APEX...', 0.7);
                playerAttack({ label: 'APEX CUT', critLo: 18 });
                return;
            case 'golden':
                var gh = d(8);
                healPlayer(gh); addPcond('golden', 3, 0); SFX.heal();
                msgStep('GOLDEN HOUR. +' + gh + ' HP now, more each turn.', 1.1);
                break;
            case 'flash':
                if (f) {
                    var fd = d(6);
                    f.conds.push({ id: 'blind', turns: 2 });
                    flashFx('#f8f4e3', 0.2);
                    thenFn(function () { hurtFoe(f, fd, ''); });
                    msgStep('FLASH! ' + fd + ' radiant. it is very blinded. sorry.', 1.1);
                    SFX.shutter();
                }
                break;
            case 'burst':
                msgStep('BURST MODE. three frames per second.', 0.8);
                var shots = 3;
                for (var s2 = 0; s2 < shots; s2++) {
                    (function () {
                        thenFn(function () {
                            var f2 = alive()[0]; if (!f2) return;
                            var hit = d(20) + pAtkMod() >= f2.def.ac + f2.acD;
                            if (hit) { var bd = d(4) + Math.max(1, kmod); hurtFoe(f2, bd, ''); SFX.shutter(); }
                            else { SFX.whiff(); bt.msg = 'frame ' + '...blurred!'; }
                        });
                        step(0.45, null, null);
                    })();
                }
                break;
            case 'bolt':
                if (f) {
                    diceStep('ESPRESSO BOLT', mod(G.st.int) + prof(), f.def.ac + f.acD, function (r) {
                        if (!r.hit) { msgStep('the bolt splashes wide. decaf.', 0.9); endPlayerAction(); return; }
                        var bd2 = d(8) + d(8) + mod(G.st.int) + (r.crit ? d(8) : 0);
                        hurtFoe(f, Math.max(1, bd2), r.crit ? 'crit' : '');
                        SFX.zap();
                        endPlayerAction();
                    }, { mine: true });
                    return;
                }
                break;
            case 'triple':
                msgStep('TRIPLE SHOT. three darts, zero misses.', 0.8);
                for (var t3 = 0; t3 < 3; t3++) {
                    thenFn(function () { var f2 = alive()[0]; if (f2) { hurtFoe(f2, d(4) + 1, ''); SFX.magic(); } });
                    step(0.4, null, null);
                }
                break;
            case 'overclock':
                bt.extraAct = 1; bt.crashNext = true;
                msgStep('OVERCLOCK! Time dilates. (the crash is scheduled.)', 1.1);
                SFX.zap();
                break;
            case 'hedge':
                addPcond('hedge', 9, 0);
                msgStep('HEDGED. the next blow is halved. so wise.', 1.0);
                break;
        }
        endPlayerAction();
    }
    function useItem(id) {
        bt.sub = null; bt.phase = 'q';
        if (id === 'o2') {
            bt.smogBroken = true;
            flashFx('#8fc0e8', 0.4); shake(3, 0.4); SFX.roar();
            msgStep('you raise the O2 SENSOR OF TRUTH!', 1.1);
            msgStep('the SMOG VEIL reads its own numbers... and DISSIPATES. the Herald SCREAMS.', 1.7);
            endPlayerAction();
            return;
        }
        var healed = 0;
        if (id === 'coldbrew') { healed = d(4) + d(4) + 2; G.foc = clamp(G.foc + 1, 0, G.focm); }
        else if (id === 'taco') healed = d(8) + 3;
        else if (id === 'kolache') healed = G.hpm;
        else if (id === 'bottomless') { if (bt.bottomUsed) { bt.msg = 'the cup must rest between battles.'; bt.phase = 'menu'; SFX.no(); return; } bt.bottomUsed = true; healed = d(4) + d(4); }
        else if (id === 'espresso') { G.foc = G.focm; }
        if (healed) { healPlayer(healed); ftext(30, 66, '+' + Math.min(healed, G.hpm), P.hp); }
        delItem(id, 1);
        SFX.heal();
        msgStep(healed ? '+' + healed + ' HP. onward.' : 'FOCUS restored. the hands steady.', 1.0);
        endPlayerAction();
    }
    function tryFlee() {
        bt.phase = 'q';
        if (opts.noFlee) { msgStep('there is no fleeing this.', 1.1); thenFn(function () { enemyTurns(); }); return; }
        var t2 = trin();
        var fm = mod(G.st.dex) + (t2 && t2.flee ? t2.flee : 0) - (pcond('slow') ? 2 : 0) + (G.flags.probation ? -1 : 0);
        var dc = 10 + Math.max.apply(null, alive().map(function (f) { return f.def.init; }));
        diceStep('FLEE', fm, dc, function (r) {
            if (r.hit) {
                msgStep('you disengage. tactically. at speed.', 1.0);
                thenFn(function () { doEnd(true); });
            } else {
                msgStep('cut off! no escape this round.', 1.0);
                thenFn(function () { enemyTurns(); });
            }
        }, {});
    }
    function endPlayerAction() {
        thenFn(function () {
            if (checkWin()) return;
            if (bt.extraAct > 0) { bt.extraAct--; bt.phase = 'menu'; bt.menuSel = 0; bt.msg = 'again! (extra action)'; return; }
            enemyTurns();
        });
    }

    /* ── enemy turns ── */
    function pickAct(f) {
        var acts = f.def.acts;
        if (f.def.final) {
            if (!bt.smogBroken) return pick([acts[0], acts[1]]);
            if (f.hp <= f.maxhp / 3) return ch(0.5) ? acts[3] : pick([acts[0], acts[1]]);
            if (!f.limped) { f.limped = true; return acts[2]; }
            return pick([acts[0], acts[1]]);
        }
        var a2 = pick(acts);
        if (a2.heal && f.hp >= f.maxhp) a2 = acts[0];
        if (a2.summon && alive().length >= 3) a2 = acts[0];
        return a2;
    }
    function enemyAct(f, act) {
        var nm = f.def.n;
        if (act.tele && f.tele !== act) {
            f.tele = act;
            msgStep(nm + ': ' + act.tele, 1.3);
            return;
        }
        f.tele = null;
        if (act.line && !act.dice && !act.steal && !act.heal && !act.multi && !act.summon && !act.selfAC && !act.fear && !act.slow) {
            msgStep(nm + ' uses ' + act.n + '. ' + act.line, 1.4);
            return;
        }
        if (act.heal) {
            var hv = 0; for (var i2 = 0; i2 < act.heal[0]; i2++) hv += d(act.heal[1]);
            f.hp = Math.min(f.maxhp, f.hp + hv);
            msgStep(nm + ' uses ' + act.n + '. ' + (act.line || ('it recovers ' + hv + '.')), 1.3);
            SFX.heal();
            return;
        }
        if (act.summon) {
            addFoe(f.def.summon);
            msgStep(nm + ': ' + (act.line || 'reinforcements!'), 1.3);
            SFX.roar();
            return;
        }
        if (act.selfAC) {
            f.acD = act.selfAC;
            msgStep(nm + ' uses ' + act.n + '. ' + (act.line || 'it tenses.'), 1.2);
            return;
        }
        if (act.fear) {
            addPcond('fear', 2, act.fear);
            msgStep(nm + ': ' + (act.line || 'terror!'), 1.4);
            SFX.roar();
            return;
        }
        if (act.slow && !act.dice) {
            addPcond('slow', act.slow, 0);
            msgStep(nm + ' uses ' + act.n + '. ' + (act.line || 'you slow.'), 1.3);
            return;
        }
        if (act.steal) {
            var sv = 0; for (var j2 = 0; j2 < act.steal[0]; j2++) sv += d(act.steal[1]);
            sv = Math.min(sv, G.gold);
            G.gold -= sv;
            msgStep(nm + ' uses ' + act.n + '! ' + (act.line || '') + ' (-' + sv + 'g)', 1.3);
            SFX.coin();
            return;
        }
        /* an attack roll against you */
        var blind = fcond(f, 'blind');
        var m2 = (f.def.atk != null ? f.def.atk : 4);
        var ac2 = playerAC() + (pcond('pivot') ? 2 : 0);
        diceStep(nm + ': ' + act.n, m2, ac2, function (r) {
            if (!r.hit) { msgStep(r.n === 1 ? nm + ' fumbles! embarrassing.' : 'you evade!', 0.9); return; }
            var dmg = 0;
            var dice = act.multi ? [act.multi[0], act.multi[1], act.multi[2]] : act.dice;
            var nD = dice[0];
            for (var k2 = 0; k2 < nD; k2++) dmg += d(dice[1]);
            dmg += dice[2] || 0;
            if (f.def.ramp) dmg += Math.max(0, f.rounds - 1);
            if (act.ramp) dmg += Math.max(0, bt.round - 1);
            if (r.crit) dmg += d(dice[1]);
            dmgPlayer(dmg);
            if (act.dot) addPcond('dot', act.dot.turns, act.dot.dmg);
            if (act.slow) addPcond('slow', act.slow, 0);
        }, { dis: !!blind });
    }
    function enemyTurns() {
        bt.guard = false;
        var al = alive();
        al.forEach(function (f) {
            thenFn(function () {
                if (f.dead || G.hp <= 0) return;
                f.rounds++;
                var ic = fcond(f, 'interest');
                if (ic) {
                    var iv = ic.val;
                    hurtFoe(f, iv, '');
                    ic.val = Math.min(8, ic.val * 2);
                    ic.turns--;
                    bt.msg = 'COMPOUND INTEREST: ' + iv + ' dmg.';
                    if (ic.turns <= 0) f.conds = f.conds.filter(function (c) { return c.id !== 'interest'; });
                }
                f.conds.forEach(function (c) { if (c.id === 'blind') c.turns--; });
                f.conds = f.conds.filter(function (c) { return c.id !== 'blind' || c.turns > 0; });
            });
            step(0.35, null, null);
            thenFn(function () {
                if (f.dead || G.hp <= 0) { return; }
                enemyAct(f, f.tele || pickAct(f));
            });
        });
        thenFn(function () {
            if (checkWin()) return;
            if (G.hp <= 0) return;
            playerTurnStart();
        });
    }
    function playerTurnStart() {
        bt.round++;
        /* your dots + regen */
        var dot = pcond('dot');
        if (dot) { dmgPlayer(dot.val, true); bt.msg = 'the ITCH: -' + dot.val; dot.turns--; if (dot.turns <= 0) rmPcond('dot'); }
        var gh = pcond('golden');
        if (gh) { var hv = d(4); healPlayer(hv); ftext(30, 66, '+' + hv, P.hp); gh.turns--; if (gh.turns <= 0) rmPcond('golden'); }
        var fe = pcond('fear'); if (fe) { fe.turns--; if (fe.turns <= 0) rmPcond('fear'); }
        var sl = pcond('slow'); if (sl) { sl.turns--; if (sl.turns <= 0) rmPcond('slow'); }
        if (G.hp <= 0) return;
        if (bt.crashNext) {
            bt.crashNext = false;
            msgStep('you CRASH. hard. the room spins politely.', 1.4);
            thenFn(function () { enemyTurns(); });
            return;
        }
        bt.phase = 'menu'; bt.menuSel = 0; bt.msg = 'RD ' + bt.round + ' — your move.';
    }

    /* ── win / lose ── */
    function checkWin() {
        if (alive().length === 0) {
            var xp = 0, gold = 0;
            bt.foes.forEach(function (f) { xp += f.def.xp; gold += ri(f.def.gold[0], f.def.gold[1]); });
            bt.win = { xp: xp, gold: gold, drop: null, shown: 0 };
            bt.foes.forEach(function (f) {
                var dr = DROPS[f.id];
                if (dr && ch(dr[1]) && !bt.win.drop) bt.win.drop = dr[0];
            });
            G.gold += gold; giveXP(xp);
            if (bt.win.drop) addItem(bt.win.drop, 1);
            bt.phase = 'win';
            SFX.fanfare();
            return true;
        }
        return false;
    }
    function doLose() {
        G.deaths++;
        repl(ScGameOver());   // pops us first — our exit hook clears transient flags
        save();
    }
    function doEnd(fled) {
        pop();                // fires our exit hook (opts.onEnd)
        music(MAPS[G.map].music);
        if (!fled && opts.onWin) opts.onWin();
        save();
    }
    function tryLevelUps() {
        if (!canLevel()) { doEnd(false); return; }
        var cls = CLASSES[G.cls];
        G.lvl++;
        var roll = Math.max(1, d(cls.die) + mod(G.st.con));
        G.hpm += roll; G.hp = G.hpm;
        G.focm = 1 + G.lvl + Math.max(0, mod(G.st[cls.key]));
        G.foc = G.focm;
        var msgs = ['HP +' + roll + ' (d' + cls.die + fmtMod(mod(G.st.con)) + ')'];
        if (cls.spells[G.lvl]) { G.spells.push(cls.spells[G.lvl]); msgs.push('NEW: ' + SPELLS[cls.spells[G.lvl]].n); }
        if (G.lvl === 3) { G.st[cls.key] += 1; msgs.push(STAT_N[cls.key] + ' rises to ' + G.st[cls.key]); }
        if (G.lvl === 4) msgs.push('PROFICIENCY +3');
        bt.lvl = { msgs: msgs, t: 0 };
        bt.phase = 'levelup';
        SFX.level();
        burstP(80, 60, [P.gold, P.w, CLASSES[G.cls].tint], 24, 60);
        save();
    }

    /* ── menus ── */
    var MENU = ['FIGHT', 'CAST', 'ITEM', 'GUARD', 'LOOK', 'RUN'];
    function battleItems() {
        var out = G.inv.filter(function (it) { return ITEMS[it.id].kind === 'heal' || ITEMS[it.id].kind === 'focus'; });
        if (bt.foes.some(function (f) { return f.def.final; }) && !bt.smogBroken && countItem('o2')) out.unshift({ id: 'o2', n: 1 });
        return out;
    }
    function menuAct() {
        var m2 = MENU[bt.menuSel];
        if (m2 === 'FIGHT') {
            if (alive().length > 1) { bt.phase = 'target'; bt.target = 0; SFX.ok(); return; }
            bt.target = 0; SFX.ok(); playerAttack();
        }
        else if (m2 === 'CAST') { if (!G.spells.length) { bt.msg = 'no spells known.'; SFX.no(); return; } bt.sub = 'cast'; bt.subSel = 0; SFX.ok(); }
        else if (m2 === 'ITEM') { if (!battleItems().length) { bt.msg = 'pockets: empty.'; SFX.no(); return; } bt.sub = 'item'; bt.subSel = 0; SFX.ok(); }
        else if (m2 === 'GUARD') {
            bt.guard = true;
            G.foc = clamp(G.foc + 1, 0, G.focm);
            bt.phase = 'q';
            msgStep('you brace behind the ' + armr().n + '. (+1 FOCUS)', 1.0);
            thenFn(function () { enemyTurns(); });
            SFX.ok();
        }
        else if (m2 === 'LOOK') { var f = alive()[0]; if (f) { f.seen = true; bt.look = f; SFX.ok(); } }
        else if (m2 === 'RUN') tryFlee();
    }

    /* ── drawing ── */
    function drawBG() {
        if (bt.biome === 'sand') {
            ctx.fillStyle = '#c8dce8'; ctx.fillRect(0, 0, W, 52);
            ctx.fillStyle = '#e0c489'; ctx.fillRect(0, 52, W, 48);
            ctx.fillStyle = '#c4a366'; ctx.fillRect(0, 78, W, 22);
            drawSpr('pump0', 8, 30, { alpha: 0.5 });
        } else if (bt.biome === 'cave') {
            ctx.fillStyle = '#12121c'; ctx.fillRect(0, 0, W, 100);
            ctx.fillStyle = '#1e1e2c';
            for (var i2 = 0; i2 < 8; i2++) ctx.fillRect(i2 * 22 + 4, 0, 6, 12 + (i2 % 3) * 8);
            ctx.fillStyle = '#252534'; ctx.fillRect(0, 72, W, 28);
        } else if (bt.biome === 'library') {
            ctx.fillStyle = '#241d16'; ctx.fillRect(0, 0, W, 100);
            for (var j2 = 0; j2 < 5; j2++) drawSpr('shelfbook', 8 + j2 * 30, 18, { alpha: 0.7 });
            ctx.fillStyle = '#3a2f22'; ctx.fillRect(0, 76, W, 24);
        } else {
            ctx.fillStyle = '#a8c8dc'; ctx.fillRect(0, 0, W, 52);
            ctx.fillStyle = '#7aa254'; ctx.fillRect(0, 52, W, 48);
            ctx.fillStyle = '#5d8544'; ctx.fillRect(0, 80, W, 20);
            ctx.fillStyle = '#2f4d2e';
            ctx.fillRect(6, 34, 14, 18); ctx.fillRect(140, 30, 14, 22);
        }
    }
    function drawFoes() {
        bt.foes.forEach(function (f, i2) {
            if (f.dead) return;
            if (f.blink > 0 && Math.floor(bt.t * 30) % 2) return;
            var sc = SPRD[f.def.spr].w <= 16 ? 3 : 2;
            var w2 = SPRD[f.def.spr].w * sc, h2 = SPRD[f.def.spr].h * sc;
            var x2 = foePos(i2) - w2 / 2;
            var bob = Math.sin(bt.t * 2 + i2 * 1.7) * 1.5;
            var y2 = 84 - h2 + bob;
            ctx.fillStyle = 'rgba(10,12,18,0.3)';
            ctx.fillRect(Math.round(foePos(i2) - w2 / 3), 82, Math.round(w2 * 0.66), 4);
            drawSpr(f.def.spr, x2, y2, { scale: sc });
            /* hp sliver above */
            f.hpShow += (f.hp - f.hpShow) * 0.15;
            bar(Math.round(foePos(i2) - 16), Math.round(y2 - 8), 32, 4, f.hpShow / f.maxhp, f.hp / f.maxhp > 0.35 ? P.hp : P.red);
            if (f.tele) { txtC('!', foePos(i2), Math.round(y2 - 18), Math.floor(bt.t * 4) % 2 ? P.red : P.amber); }
            if (fcond(f, 'blind')) t35('X', Math.round(foePos(i2) + 18), Math.round(y2 - 6), P.dim);
            if (fcond(f, 'interest')) t35('%', Math.round(foePos(i2) - 22), Math.round(y2 - 6), P.gold);
            if (bt.phase === 'target' && alive()[bt.target] === f && Math.floor(bt.t * 4) % 2) cursor(Math.round(foePos(i2) - 2), Math.round(y2 - 14));
        });
    }
    function drawPlayer() {
        var cls = CLASSES[G.cls];
        drawSpr('pu0', 16, 62, { tint: cls.tint, scale: 2 });
        if (bt.guard) { ctx.fillStyle = P.foc; ctx.fillRect(44, 70, 3, 12); }
        var ci = 0;
        bt.pconds.forEach(function (c) {
            var lbl = c.id === 'dot' ? 'DOT' : c.id === 'golden' ? 'G+' : c.id === 'fear' ? 'FR' : c.id === 'slow' ? 'SL' : c.id === 'pivot' ? 'AC' : c.id === 'inspire' ? '+4' : c.id === 'hedge' ? 'HG' : '';
            if (lbl) { t35(lbl, 14, 52 - ci * 7, c.id === 'golden' || c.id === 'inspire' ? P.hp : P.amber); ci++; }
        });
    }
    function drawPanel() {
        box(0, 100, W, 44, { bg: '#14141f' });
        /* left: vitals */
        txt(G.name.slice(0, 7), 6, 105, P.w);
        t35('LV' + G.lvl, 64, 106, P.dim);
        bar(6, 115, 60, 5, G.hp / G.hpm, G.hp / G.hpm > 0.35 ? P.hp : P.red);
        t35('' + G.hp + '/' + G.hpm, 6, 123, P.w);
        for (var i2 = 0; i2 < G.focm && i2 < 10; i2++) {
            ctx.fillStyle = i2 < G.foc ? P.foc : '#2a2a3a';
            ctx.fillRect(6 + i2 * 6, 131, 4, 4);
        }
        t35('G' + G.gold, 44, 131, P.gold);
        /* right: menu or submenu */
        if (bt.phase === 'menu' && !bt.sub) {
            for (var m2 = 0; m2 < 6; m2++) {
                var mx = 76 + (m2 % 3) * 28, my = 108 + Math.floor(m2 / 3) * 16;
                if (m2 === bt.menuSel) { cursor(mx - 6, my + 1); }
                txt(MENU[m2].slice(0, 3), mx, my, m2 === bt.menuSel ? P.w : P.dim);
            }
            txt(MENU[bt.menuSel], 76, 134, P.gold);
        } else if (bt.sub === 'cast') {
            var list = G.spells;
            for (var s2 = 0; s2 < list.length && s2 < 4; s2++) {
                var off = Math.max(0, bt.subSel - 3);
                var idx = s2 + off;
                if (idx >= list.length) break;
                var sp = SPELLS[list[idx]];
                if (idx === bt.subSel) cursor(72, 108 + s2 * 9 + 1);
                txt(sp.n.slice(0, 8), 79, 107 + s2 * 9, idx === bt.subSel ? (G.foc >= sp.cost ? P.w : P.red) : P.dim);
                t35('F' + sp.cost, 148, 108 + s2 * 9, P.foc);
            }
        } else if (bt.sub === 'item') {
            var its = battleItems();
            for (var it2 = 0; it2 < its.length && it2 < 4; it2++) {
                if (it2 === bt.subSel) cursor(72, 108 + it2 * 9 + 1);
                txt(ITEMS[its[it2].id].n.slice(0, 8), 79, 107 + it2 * 9, it2 === bt.subSel ? P.w : P.dim);
                t35('X' + its[it2].n, 148, 108 + it2 * 9, P.dim);
            }
        }
    }
    function drawDice() {
        if (!bt.dice) return;
        /* box x14..146 — inner content x20..140 */
        box(14, 14, 132, 46, { bg: '#101018', edge: P.gold });
        txt(bt.dice.pre.slice(0, 15), 20, 18, P.dim);
        drawSpr('d20', 20, 28);
        var n = bt.dice.rollT > 0 ? ri(1, 20) : bt.dice.n;
        txtBig('' + n, 40, 30, bt.dice.rollT > 0 ? P.dim : (bt.dice.n === 20 ? P.gold : bt.dice.n === 1 ? P.red : P.w));
        if (bt.dice.rollT <= 0 && bt.dice.n) {
            txt(fmtMod(bt.dice.m) + '=' + (bt.dice.n + bt.dice.m), 78, 28, P.w);        // "+5=25" max 7ch → x134
            txt('vs ' + bt.dice.vs, 78, 38, P.dim);                                     // "vs 15" → x118
            txt(bt.dice.res, 78, 48, bt.dice.color);                                    // "NAT 1!" max 6ch → x126
        }
        if (bt.dice.dis) t35('DIS', 128, 18, P.red);
        if (bt.dice.adv) t35('ADV', 128, 18, P.hp);
    }
    function drawLook(f) {
        box(10, 12, W - 20, 86, { bg: '#101018', edge: P.gold });
        txtC(f.def.n.slice(0, 17), W / 2, 17, P.gold);
        txt('CR ' + f.def.cr + '  AC ' + f.def.ac, 18, 30, P.w);
        txt('HP ' + f.hp + '/' + f.maxhp, 100, 30, P.w);
        var ql = wrap(f.def.quote, 16);
        for (var i2 = 0; i2 < ql.length && i2 < 3; i2++) txt(ql[i2], 18, 42 + i2 * 9, P.dim);
        var an = f.def.acts.map(function (a2) { return a2.n.split(' ')[0]; }).join(' · ');
        txt(an.slice(0, 17), 18, 74, P.amber);
        txtC('A/B: CLOSE', W / 2, 88, '#4a4a58');
    }

    /* boot the encounter */
    stopMusic();
    music(opts.musicId || 'battle');
    flashFx('#f8f4e3', 0.15);
    var first = ENEMIES[ids[0]];
    msgStep(opts.intro || (first.boss ? first.n + ' blocks your path!' : 'a wild ' + first.n + ' draws near!'), 1.5);
    thenFn(function () {
        var t2 = trin();
        var pi = d(20) + mod(G.st.dex) + (t2 && t2.init ? t2.init : 0);
        var ei = d(20) + first.init;
        bt.msg = 'INIT ' + pi + ' vs ' + ei + (pi >= ei ? ' — GO!' : ' — THEY GO!');
        bt.pWon = pi >= ei;
    });
    step(1.4, null, null);
    thenFn(function () { if (bt.pWon) playerTurnStart(); else enemyTurns(); });

    return { opaque: true,
        exit: function () { if (opts.onEnd) { var f = opts.onEnd; opts.onEnd = null; f(); } },
        u: function (dt) {
            bt.t += dt;
            if (bt.dice && bt.dice.rollT > 0) { bt.dice.rollT -= dt; if (Math.random() < 0.25) SFX.dice(); }
            bt.foes.forEach(function (f) { if (f.blink > 0) f.blink -= dt; });
            if (bt.phase === 'levelup' && bt.lvl) bt.lvl.t += dt;
            if (bt.q.length) {
                var cur = bt.q[0];
                if (!cur.started) { cur.started = true; if (cur.start) cur.start(); }
                cur.t -= dt;
                if (cur.t <= 0) bt.q.shift();
            }
        },
        d: function () {
            drawBG();
            drawFoes();
            drawPlayer();
            /* message strip — grows to fit up to 3 wrapped lines, riding above the panel */
            var ml = bt.msg ? wrap(bt.msg, 19) : [];
            var mln = Math.min(3, ml.length);
            if (mln) {
                var sh = 2 + mln * 8;
                ctx.fillStyle = 'rgba(12,12,20,0.85)'; ctx.fillRect(0, 100 - sh, W, sh);
                for (var mli = 0; mli < mln; mli++) txt(ml[mli], 4, 100 - sh + 2 + mli * 8, P.w);
            }
            drawPanel();
            drawDice();
            drawParts(0, 0);
            t35('RD' + Math.max(1, bt.round), 146, 2, P.dim);
            if (bt.look) drawLook(bt.look);
            if (bt.phase === 'win' && bt.win) {
                box(20, 24, 120, 56, { bg: '#101018', edge: P.gold });
                txtC('VICTORY!', W / 2, 30, P.gold);
                txtC('+' + bt.win.xp + ' XP', W / 2, 44, P.w);
                txtC('+' + bt.win.gold + ' GOLD', W / 2, 54, P.gold);
                if (bt.win.drop) txtC('found ' + ITEMS[bt.win.drop].n.slice(0, 10), W / 2, 64, P.hp);
                txtC('A: CONTINUE', W / 2, 72, '#4a4a58');
            }
            if (bt.phase === 'levelup' && bt.lvl) {
                box(14, 20, 132, 64, { bg: '#101018', edge: CLASSES[G.cls].tint });
                txtC('LEVEL UP!', W / 2, 26, P.gold);
                txtC(CLASSES[G.cls].n.split(' ')[1] + ' LV ' + G.lvl, W / 2, 38, CLASSES[G.cls].tint);
                for (var i2 = 0; i2 < bt.lvl.msgs.length; i2++) txtC(bt.lvl.msgs[i2].slice(0, 17), W / 2, 50 + i2 * 9, P.w);
                if (bt.lvl.t > 1) txtC('A: ONWARD', W / 2, 76, '#4a4a58');
            }
        },
        i: function (a) {
            if (bt.look) { if (a === 'a' || a === 'b') { bt.look = null; SFX.no(); } return; }
            if (bt.phase === 'win') { if (a === 'a') { SFX.ok(); tryLevelUps(); } return; }
            if (bt.phase === 'levelup') { if (a === 'a' && bt.lvl.t > 1) { SFX.ok(); tryLevelUps(); } return; }
            if (bt.q.length) return;
            if (bt.phase === 'target') {
                var al = alive();
                if (a === 'left') { bt.target = (bt.target + al.length - 1) % al.length; SFX.move(); }
                else if (a === 'right') { bt.target = (bt.target + 1) % al.length; SFX.move(); }
                else if (a === 'a') { SFX.ok(); playerAttack(); }
                else if (a === 'b') { bt.phase = 'menu'; SFX.no(); }
                return;
            }
            if (bt.phase !== 'menu') return;
            if (bt.sub === 'cast') {
                var list = G.spells;
                if (a === 'up') { bt.subSel = (bt.subSel + list.length - 1) % list.length; SFX.move(); }
                else if (a === 'down') { bt.subSel = (bt.subSel + 1) % list.length; SFX.move(); }
                else if (a === 'b') { bt.sub = null; SFX.no(); }
                else if (a === 'a') castSpell(list[bt.subSel]);
                return;
            }
            if (bt.sub === 'item') {
                var its = battleItems();
                if (a === 'up') { bt.subSel = (bt.subSel + its.length - 1) % its.length; SFX.move(); }
                else if (a === 'down') { bt.subSel = (bt.subSel + 1) % its.length; SFX.move(); }
                else if (a === 'b') { bt.sub = null; SFX.no(); }
                else if (a === 'a' && its[bt.subSel]) useItem(its[bt.subSel].id);
                return;
            }
            if (a === 'left') { bt.menuSel = (bt.menuSel % 3 === 0) ? bt.menuSel + 2 : bt.menuSel - 1; SFX.move(); }
            else if (a === 'right') { bt.menuSel = (bt.menuSel % 3 === 2) ? bt.menuSel - 2 : bt.menuSel + 1; SFX.move(); }
            else if (a === 'up' || a === 'down') { bt.menuSel = (bt.menuSel + 3) % 6; SFX.move(); }
            else if (a === 'a') menuAct();
        } };
}

/* ─────────────────── the concert shoot ────────────────────── */
function startPhoto() { push(ScPhoto()); }
function ScPhoto() {
    var shot = 0, score = 0, t = 0;
    var needle = 0, speed = 1.6, dir2 = 1, zone = 0.16;
    var phase = 'aim';      // aim | freeze | grade | done
    var freezeT = 0, lastGrade = '', grades = [];
    var crowd = [];
    for (var i = 0; i < 8; i++) crowd.push({ x: 12 + i * 18, p: Math.random() * 5 });
    return { opaque: true,
        enter: function () { music('chaus'); },
        u: function (dt) {
            t += dt;
            if (phase === 'aim') {
                needle += dir2 * speed * dt;
                if (needle > 1) { needle = 1; dir2 = -1; }
                if (needle < -1) { needle = -1; dir2 = 1; }
            } else if (phase === 'freeze') {
                freezeT -= dt;
                if (freezeT <= 0) {
                    if (shot >= 3) phase = 'done';
                    else { phase = 'aim'; speed += 0.55; zone = Math.max(0.09, zone - 0.035); }
                }
            }
        },
        d: function () {
            /* the venue */
            ctx.fillStyle = '#171320'; ctx.fillRect(0, 0, W, H);
            /* stage lights sweep */
            var la = Math.sin(t * 1.3) * 0.5 + 0.5;
            ctx.globalAlpha = 0.16;
            ctx.fillStyle = '#7b53c9'; ctx.fillRect(Math.round(20 + la * 60), 0, 30, 90);
            ctx.fillStyle = '#1f9e98'; ctx.fillRect(Math.round(100 - la * 50), 0, 26, 90);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#3a2c1c'; ctx.fillRect(30, 66, 100, 10);   // stage
            ctx.fillStyle = '#241c12'; ctx.fillRect(30, 76, 100, 4);
            /* the bard, posing on the beat */
            var pose = Math.floor(t * 2.4) % 2;
            drawSpr('bard', 72, 50 - (pose ? 2 : 0));
            if (pose) { txtSh('♪', 92, 42, P.gold); }
            /* crowd bobbing */
            crowd.forEach(function (c, i2) {
                var b = Math.sin(t * 3 + c.p) > 0 ? -2 : 0;
                ctx.fillStyle = i2 % 2 ? '#232030' : '#2b2838';
                ctx.fillRect(c.x, 96 + b, 12, 20 - b);
            });
            /* viewfinder chrome */
            ctx.strokeStyle = 'rgba(248,244,227,0.5)';
            ctx.strokeRect(4.5, 4.5, W - 9, 86);
            ctx.fillStyle = P.w;
            ctx.fillRect(4, 4, 6, 1); ctx.fillRect(4, 4, 1, 6);
            ctx.fillRect(W - 10, 4, 6, 1); ctx.fillRect(W - 5, 4, 1, 6);
            ctx.fillRect(4, 89, 6, 1); ctx.fillRect(4, 84, 1, 6);
            ctx.fillRect(W - 10, 89, 6, 1); ctx.fillRect(W - 5, 84, 1, 6);
            t35('ISO3200 F1.8', 8, 8, P.w);
            t35(shot + '/3', 140, 8, P.gold);
            /* exposure meter */
            box(16, 108, 128, 26, { bg: '#101018' });
            txtC('TIME THE SHUTTER', W / 2, 98, P.dim);
            var mx = 24, mw = 112;
            ctx.fillStyle = '#2a2a3a'; ctx.fillRect(mx, 118, mw, 6);
            var zw = Math.round(zone * mw);
            ctx.fillStyle = '#2f5d3a'; ctx.fillRect(Math.round(mx + mw / 2 - zw), 118, zw * 2, 6);
            ctx.fillStyle = P.hp; ctx.fillRect(Math.round(mx + mw / 2 - 1), 116, 2, 10);
            var nx = mx + mw / 2 + needle * (mw / 2 - 2);
            ctx.fillStyle = phase === 'freeze' ? P.gold : P.w;
            ctx.fillRect(Math.round(nx), 114, 2, 14);
            drawParts(0, 0);
            if (phase === 'freeze') {
                ctx.fillStyle = 'rgba(248,244,227,' + Math.max(0, freezeT) + ')';
                ctx.fillRect(0, 0, W, H);
                txtShC(lastGrade, W / 2, 46, lastGrade === 'PERFECT!' ? P.gold : lastGrade === 'GOOD' ? P.hp : P.dim);
            }
            if (phase === 'done') {
                box(20, 30, 120, 60, { bg: '#101018', edge: P.gold });
                txtC('SET COMPLETE', W / 2, 36, P.gold);
                txtC(grades.join(' '), W / 2, 50, P.w);
                txtC('SCORE ' + score + '/9', W / 2, 62, score >= 8 ? P.gold : score >= 5 ? P.hp : P.dim);
                txtC('A: WRAP IT', W / 2, 76, '#4a4a58');
            }
        },
        i: function (a) {
            if (phase === 'aim' && a === 'a') {
                shot++;
                var off = Math.abs(needle);
                var g = off <= zone ? 3 : off <= zone * 2.2 ? 2 : 1;
                score += g;
                lastGrade = g === 3 ? 'PERFECT!' : g === 2 ? 'GOOD' : 'BLURRY';
                grades.push(g === 3 ? '*' : g === 2 ? '+' : '~');
                phase = 'freeze'; freezeT = 0.55;
                SFX.shutter();
                if (g === 3) burstP(80, 50, [P.gold, P.w], 14, 40);
            } else if (phase === 'done' && a === 'a') {
                G.flags.photoScore = score;
                addItem('film', 1);
                setQuest('photo', 1);
                SFX.ok();
                transTo(function () { pop(); music(MAPS[G.map].music); });
            }
        } };
}

/* ─────────────────────── credits ──────────────────────────── */
function startCredits() { push(ScCredits()); }
function ScCredits() {
    var t = 0, phase = 0;
    var lines = [
        ['THE LIGHT GOES OUT.', ''],
        ['The Steed idles like', 'a sleeping animal.', 'Clean. Quiet. Legal', 'in most counties.'],
        ['The basin is calm.', 'The dice are warm.', 'The kolaches are', 'safe. For now.'],
        ['URE QUEST', 'The Check-Engine', 'Prophecy'],
        ['STARRING', G.name.slice(0, 12), 'the ' + CLASSES[G.cls].n.split(' ')[1]],
        ['FEATURING', 'The Torque Priest', 'The Dice Oracle', 'The Hedge Wizard', 'A Statue (himself)'],
        ['ANTAGONIST', 'P-0420, who was', 'just doing its job'],
        ['SPECIAL THANKS', 'coffee', 'fast glass', 'the OBD-II scanner'],
        ['NO SQUIRRELS', 'WERE HARMED.', 'Several were', 'inconvenienced.'],
        ['THE RECORD', 'days ' + G.day + ' · foes ' + G.kills, 'nat20s ' + G.nat20s + ' · RIP ' + G.deaths, 'steps ' + G.steps],
        ['...', '', 'somewhere,', 'faintly...', '', 'the light flickers.', '', '(you won\'t leave', 'it stock. we know.)'],
        ['THE END', '', 'thanks for playing', '· URE BOY ·']
    ];
    return { opaque: true,
        enter: function () { music('title'); },
        u: function (dt) {
            t += dt;
            if (t > 3.4 && phase < lines.length - 1) { phase++; t = 0; }
        },
        d: function () {
            ctx.fillStyle = '#08080c'; ctx.fillRect(0, 0, W, H);
            STARS.forEach(function (s) {
                if (Math.sin(animT + s.p) > -0.4) { ctx.fillStyle = '#4a4a58'; ctx.fillRect(s.x, s.y + 8, 1, 1); }
            });
            var ls = lines[phase];
            var y0 = Math.round(72 - ls.length * 5.5);
            var alpha = t < 0.5 ? t * 2 : (t > 2.9 && phase < lines.length - 1) ? Math.max(0, (3.4 - t) * 2) : 1;
            ctx.globalAlpha = alpha;
            for (var i = 0; i < ls.length; i++) {
                var c = (i === 0 && phase >= 3) ? P.gold : P.w;
                if (phase === lines.length - 1 && i === 0) txtBigC(ls[i], W / 2, 50, P.gold);
                else txtC(ls[i], W / 2, y0 + i * 11, c);
            }
            ctx.globalAlpha = 1;
            if (phase === lines.length - 1 && t > 1.2) txtC('A: RIDE OFF', W / 2, 120, '#4a4a58');
        },
        i: function (a) {
            if (a !== 'a') return;
            if (phase < lines.length - 1) { phase++; t = 0.6; SFX.text(); }
            else {
                save();
                transTo(function () { pop(); });
            }
        } };
}

/* ─────────────────────── game over ────────────────────────── */
function ScGameOver() {
    var t = 0;
    return { opaque: true,
        enter: function () { stopMusic(); SFX.roar(); },
        u: function (dt) { t += dt; },
        d: function () {
            ctx.fillStyle = '#0a0708'; ctx.fillRect(0, 0, W, H);
            if (t > 0.5) txtBigC('T P K', W / 2, 40, P.red);
            if (t > 1.2) txtC('(a party of one)', W / 2, 64, P.dim);
            if (t > 1.9) txtC('the DM smiles.', W / 2, 80, P.w);
            if (t > 2.6) {
                txtC('A: RISE FROM THE', W / 2, 104, P.hp);
                txtC('LAST SAVE', W / 2, 114, P.hp);
                txtC('B: TITLE', W / 2, 128, P.dim);
            }
        },
        i: function (a) {
            if (t < 2.6) return;
            if (a === 'a') {
                var s = loadSave();
                if (s) {
                    G = s;
                    delete G.flags.bossLock;
                    G.hp = Math.max(1, Math.floor(G.hpm / 2));
                    transTo(function () { repl(ScWorld()); enterMap(G.map, G.x, G.y, G.dir, true); });
                } else transTo(function () { repl(ScTitle()); });
                SFX.ok();
            } else if (a === 'b') {
                transTo(function () { repl(ScTitle()); });
            }
        } };
}

/* ──────────────────── mount / unmount / input ─────────────── */
function onVis() {
    if (document.hidden) { /* the sequencer self-heals via nextAt clamp */ }
}
function bootFont(cb) {
    try {
        if (document.fonts && document.fonts.load) {
            Promise.all([
                document.fonts.load('8px "Press Start 2P"'),
                document.fonts.load('16px "Press Start 2P"')
            ]).then(function () { cb(); }, function () { cb(); });
            setTimeout(cb, 900);   // fonts API can hang on some agents; belt and suspenders
        } else cb();
    } catch (e) { cb(); }
}
var fontReady = false;

/* touch: tap = A, swipe/hold-drag = walk */
function bindTouch(cv) {
    var st = null, moveTimer = 0;
    function dirFrom(dx, dy) {
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
        return dy > 0 ? 'down' : 'up';
    }
    cv.addEventListener('pointerdown', function (e) {
        st = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    });
    cv.addEventListener('pointermove', function (e) {
        if (!st) return;
        var dx = e.clientX - st.x, dy = e.clientY - st.y;
        if (Math.abs(dx) + Math.abs(dy) > 22) {
            st.moved = true;
            var now = performance.now();
            if (now - moveTimer > 150) {
                moveTimer = now;
                input(dirFrom(dx, dy));
            }
        }
    });
    cv.addEventListener('pointerup', function (e) {
        if (!st) return;
        var dx = e.clientX - st.x, dy = e.clientY - st.y;
        var quick = performance.now() - st.t < 400;
        if (!st.moved && quick) input('a');
        else if (st.moved && Math.abs(dx) + Math.abs(dy) > 22) input(dirFrom(dx, dy));
        st = null;
    });
    cv.addEventListener('pointercancel', function () { st = null; });
}

function mount(el, hostApi) {
    if (mounted) unmount();
    api = hostApi;
    root = el;
    mounted = true;
    root.innerHTML = '';
    view = document.createElement('canvas');
    view.setAttribute('aria-label', 'URE QUEST — a tiny role-playing game');
    root.appendChild(view);
    vctx = view.getContext('2d');
    sizeView();
    if (window.ResizeObserver) {
        resizeObs = new ResizeObserver(sizeView);
        resizeObs.observe(root);
    }
    document.addEventListener('visibilitychange', onVis);
    bindTouch(view);
    stack.length = 0;
    push(ScTitle());
    last = performance.now();
    if (!fontReady) {
        bootFont(function () { fontReady = true; });
    }
    rafId = requestAnimationFrame(frame);
}
function unmount() {
    if (!mounted) return;
    mounted = false;
    cancelAnimationFrame(rafId);
    if (resizeObs) { try { resizeObs.disconnect(); } catch (e) {} resizeObs = null; }
    document.removeEventListener('visibilitychange', onVis);
    stopMusic();
    if (G && G.cls && G.hp > 0) save();
    while (stack.length) stack.pop();
    if (root) root.innerHTML = '';
    root = null; view = null; vctx = null;
    TRANS.on = false; parts.length = 0; gToast = null; questToast = null; mapBanner = null;
    FX.shakeT = FX.stop = FX.flashT = 0;
}
function input(a) {
    if (!mounted) return false;
    if (a === 'start' || a === 'select') return false;    // console keeps these
    ac();                                                  // user gesture: wake audio
    var s = top();
    if (s && s.i && !TRANS.on) s.i(a);
    return true;
}

return { mount: mount, unmount: unmount, input: input };
})();
