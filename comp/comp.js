/* ============================================================
   THE COMPUTER — pixel Windows 11 desktop hub
   A small windowing shell + a suite of working apps, all vanilla
   JS. The wallpaper is a hand-rendered pixel "Bloom" (low-res
   canvas + Bayer dither, scaled up crisp). State persists under
   the comp_ localStorage prefix. Windows 11's soft Fluent look
   done in hard pixels; Isaac's red is the system accent.
   ============================================================ */
(function () {
'use strict';

var byId = function (id) { return document.getElementById(id); };
var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var BAR = 48;

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function ic(id, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '"><use href="#' + id + '"/></svg>'; }

/* ─────────────────────── persistence ───────────────────────── */
var PREFIX = 'comp_';
function store(k, v) { try { localStorage.setItem(PREFIX + k, v); } catch (e) {} }
function recall(k, d) { try { var v = localStorage.getItem(PREFIX + k); return v === null ? d : v; } catch (e) { return d; } }
/* Parse stored JSON, but only accept it if it is the SHAPE the caller expects.
   JSON.parse succeeding says nothing about type: a stored '{"a":1}' where a list
   belongs sails through and then dies in the first .some()/.indexOf() that
   touches it — which took out the whole browser render, not just bookmarks.
   Anything of the wrong shape is treated as absent. */
function jsonAs(raw, d) {
    var v;
    try { v = JSON.parse(raw); } catch (e) { return d; }
    if (v == null) return d;
    var wantArr = {}.toString.call(d) === '[object Array]';
    if (wantArr !== ({}.toString.call(v) === '[object Array]')) return d;
    if (!wantArr && d !== null && typeof d === 'object' && typeof v !== 'object') return d;
    return v;
}

/* ────────────────────────── accent ─────────────────────────── */
var ACCENTS = [
    { name: 'URE Red', hex: '#d81e05' }, { name: 'Bloom Blue', hex: '#3a9bff' },
    { name: 'Teal', hex: '#1f9e98' }, { name: 'Violet', hex: '#7b53c9' },
    { name: 'Gold', hex: '#e0a52a' }, { name: 'Grove', hex: '#5d8544' },
    { name: 'Rose', hex: '#e0559b' }, { name: 'Ember', hex: '#f0702a' }
];
function hexRgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
function applyAccent(hex) {
    var d = document.documentElement.style;
    d.setProperty('--accent', hex); d.setProperty('--accent-lo', hexRgba(hex, 0.22));
}

/* ───────────────────────── wallpaper ─────────────────────────
   A pixel homage to the Windows 11 "Bloom": a light-blue gradient
   with a layered ribbon rose of folded blue petals, lit from the
   upper-left, then ordered-dithered against a fixed blue palette. */
var wall = byId('wall'), wctx = wall.getContext('2d');
var BAYER = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5];
var PAL = [
    [176,198,225],[192,212,233],[206,223,241],[220,232,246],[233,242,251],   // background
    [7,22,66],[12,36,96],[22,60,150],[34,92,198],[54,124,232],               // bloom deep→mid
    [92,158,246],[140,188,250],[188,216,252],[224,238,254]                   // highlights
];
var BG_TOP = [231,240,251], BG_BOT = [170,193,223];
var C_DEEP = [10,30,82], C_MID = [42,112,224], C_HI = [190,218,253], C_THROAT = [7,22,66];
function lerp(a, b, t) { return a + (b - a) * t; }
function mix(a, b, t) { return [lerp(a[0],b[0],t)|0, lerp(a[1],b[1],t)|0, lerp(a[2],b[2],t)|0]; }
function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

// a rounded, folded ribbon petal — the fold catches light on one edge, shadow in the crease
function petal(g, cx, cy, ang, len, wid, L, curl) {
    var dir = [Math.cos(ang), Math.sin(ang)], nrm = [-dir[1], dir[0]];
    var lit = nrm[0] * L[0] + nrm[1] * L[1];                       // -1 shadow .. 1 lit
    // keep even shadowed petals a vibrant blue (ambient), only the crease goes deep
    var light = lit > 0 ? mix(C_MID, C_HI, Math.min(1, lit * 1.2)) : mix(C_MID, C_DEEP, Math.min(0.62, -lit));
    var dark = mix(C_DEEP, C_MID, 0.24);
    g.save();
    g.translate(cx, cy); g.rotate(ang);
    g.transform(1, curl, 0, 1, 0, 0);                             // shear along the spine → a swirl/curl
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.16, -wid, len * 0.72, -wid, len * 0.94, -wid * 0.34);
    g.quadraticCurveTo(len * 1.04, 0, len * 0.94, wid * 0.34);    // rounded, full tip
    g.bezierCurveTo(len * 0.72, wid, len * 0.16, wid, 0, 0);
    g.closePath();
    var grad = g.createLinearGradient(0, -wid, 0, wid);
    if (lit >= 0) { grad.addColorStop(0, rgb(light)); grad.addColorStop(.55, rgb(mix(light, dark, .55))); grad.addColorStop(1, rgb(dark)); }
    else          { grad.addColorStop(0, rgb(dark)); grad.addColorStop(.45, rgb(mix(light, dark, .55))); grad.addColorStop(1, rgb(light)); }
    g.fillStyle = grad; g.fill();
    // bright ridge along the lit fold
    var ridge = lit >= 0 ? -wid * 0.66 : wid * 0.66;
    g.globalAlpha = clamp(Math.abs(lit) * 0.85, 0, 0.7);
    g.strokeStyle = rgb(mix(light, C_HI, 0.65)); g.lineWidth = Math.max(1, wid * 0.13);
    g.beginPath(); g.moveTo(len * 0.14, ridge * 0.5); g.quadraticCurveTo(len * 0.66, ridge, len * 0.9, ridge * 0.35); g.stroke();
    g.globalAlpha = 1;
    // shadow crease down the spine
    g.strokeStyle = 'rgba(6,20,60,.32)'; g.lineWidth = Math.max(1, wid * 0.06);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.55, 0, len * 0.9, 0); g.stroke();
    g.restore();
}
function drawBloom(g, cx, cy, base) {
    var L = [-0.50, -0.87];                                        // light from upper-left
    var haze = g.createRadialGradient(cx, cy, base * 0.08, cx, cy, base * 0.72);
    haze.addColorStop(0, 'rgba(118,172,250,.20)'); haze.addColorStop(1, 'rgba(118,172,250,0)');
    g.fillStyle = haze; g.beginPath(); g.arc(cx, cy, base * 0.72, 0, 7); g.fill();
    var throat = g.createRadialGradient(cx, cy, 0, cx, cy, base * 0.16);
    throat.addColorStop(0, rgb(C_THROAT)); throat.addColorStop(1, 'rgba(7,22,66,0)');
    g.fillStyle = throat; g.beginPath(); g.arc(cx, cy, base * 0.16, 0, 7); g.fill();

    // a spiral of folded petals (golden angle) — large outer petals first (back), tight core last (front)
    var N = 44, GOLD = 2.399963;
    for (var i = N - 1; i >= 0; i--) {
        var f = i / (N - 1);                                       // 0 = core, 1 = outer
        var len = base * (0.12 + 0.46 * f);
        var wid = len * (0.66 - 0.16 * f);
        petal(g, cx, cy, i * GOLD, len, wid, L, 0.34 + 0.22 * f);
    }
    var bud = g.createRadialGradient(cx, cy - base * 0.02, 0, cx, cy, base * 0.10);
    bud.addColorStop(0, 'rgba(206,228,254,.9)'); bud.addColorStop(1, 'rgba(120,170,247,0)');
    g.fillStyle = bud; g.beginPath(); g.arc(cx, cy, base * 0.10, 0, 7); g.fill();
}
function renderWall() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var scale = clamp(Math.round(Math.min(vw, vh) / 230), 3, 5);
    var iw = clamp(Math.round(vw / scale), 200, 720);
    var ih = clamp(Math.round(vh / scale), 140, 460);
    wall.width = iw; wall.height = ih;
    var bg = wctx.createLinearGradient(iw, 0, 0, ih);
    bg.addColorStop(0, rgb(BG_TOP)); bg.addColorStop(1, rgb(BG_BOT));
    wctx.fillStyle = bg; wctx.fillRect(0, 0, iw, ih);
    drawBloom(wctx, iw * 0.60, ih * 0.54, Math.min(iw, ih));
    var img = wctx.getImageData(0, 0, iw, ih), d = img.data;
    for (var y = 0; y < ih; y++) {
        for (var x = 0; x < iw; x++) {
            var o = (y * iw + x) * 4;
            var t = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 17;
            var r = d[o] + t, gg = d[o + 1] + t, b = d[o + 2] + t;
            var best = 0, bd = 1e9;
            for (var p = 0; p < PAL.length; p++) {
                var pc = PAL[p], dr = pc[0] - r, dg = pc[1] - gg, db = pc[2] - b;
                var dist = dr * dr + dg * dg + db * db;
                if (dist < bd) { bd = dist; best = p; }
            }
            var c = PAL[best]; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
    }
    wctx.putImageData(img, 0, 0);
}
var rTimer = 0;
window.addEventListener('resize', function () { clearTimeout(rTimer); rTimer = setTimeout(function () { renderWall(); closeFctx(); renderDesktop(); clampWindows(); }, 120); });

/* ─────────────────────────── clock ─────────────────────────── */
var DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var MON = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var clkTime = byId('clkTime'), clkDate = byId('clkDate');
function fmtTime(n) { var h = n.getHours(), m = n.getMinutes(), ap = h >= 12 ? 'PM' : 'AM', h12 = h % 12 || 12; return h12 + ':' + (m < 10 ? '0' + m : m) + ' ' + ap; }
function tick() {
    var n = new Date();
    clkTime.textContent = fmtTime(n); clkTime.setAttribute('datetime', n.toISOString());
    clkDate.textContent = (n.getMonth() + 1) + '/' + n.getDate() + '/' + n.getFullYear();
}

/* ═══════════════════════ window manager ═════════════════════ */
var winLayer = byId('windows'), taskbar = byId('taskbar'), tbOpen = byId('tbOpen');
var openWins = {}, zTop = 20, activeApp = null;
var PINNED = ['explorer', 'chrome', 'terminal', 'settings'];

function teardownApps() {   // give every open app its onClose (saves, playtime) before the page goes away
    Object.keys(openWins).forEach(function (id) {
        var a = APPS[id];
        if (a && a.onClose) { try { a.onClose(openWins[id].el); } catch (e) {} }
    });
}
window.addEventListener('pagehide', teardownApps);
function openApp(id, arg) {
    var a = APPS[id]; if (!a) return;
    if (a.launch) { teardownApps(); window.location.href = a.launch; return; }
    setStart(false); closeFlyouts(); closeCtx(); closeBctx(); closeTaskView();
    if (openWins[id]) { restoreWin(id); focusWin(id); if (a.focusArg) a.focusArg(openWins[id].el, arg); return; }
    createWindow(id, a, arg);
}
function createWindow(id, a, arg) {
    var w = a.w || 560, h = a.h || 420;
    // boot-time dev hooks can fire before the viewport has laid out; an unlaid
    // (zero) viewport would write an invalid negative width the CSS parser drops.
    // Only substitute defaults in that degenerate case — real narrow phones keep
    // getting windows clamped to their true width.
    var vw = window.innerWidth > 40 ? window.innerWidth : 1280;
    var vh = window.innerHeight > 40 ? window.innerHeight : 800;
    var bs = barSpace();
    w = Math.min(w, vw - 16); h = Math.min(h, vh - bs - 16);
    var n = Object.keys(openWins).length;
    var left = clamp(Math.round((vw - w) / 2) + (n % 5) * 26 - 52, 8, Math.max(8, vw - w - 8));
    var top = clamp(Math.round((vh - bs - h) / 2) + (n % 5) * 22 - 40, 8, Math.max(8, vh - bs - h - 8));
    var el = document.createElement('section');
    el.className = 'win px-lg lift' + (a.titlebar ? ' win-tabbar' : ''); el.setAttribute('data-app', id); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', a.title);
    el.style.cssText = 'left:' + left + 'px;top:' + top + 'px;width:' + w + 'px;height:' + h + 'px';
    // apps may hand back their own title-bar lead (Chrome puts its tab strip here, so tabs share the caps row)
    var barLead = a.titlebar ? a.titlebar(id, arg)
        : '<div class="win-id">' + ic(a.icon, 'win-favicon') + '<span class="win-title">' + esc(a.title) + '</span></div>';
    el.innerHTML =
        '<header class="win-bar">' +
          barLead +
          '<div class="win-caps">' +
            // left of the familiar trio, so muscle memory for min/max/close is untouched
            '<button class="cap cap-fs" data-cap="fs" type="button" aria-label="Full screen" title="Full screen · F11"><svg viewBox="0 0 16 16" shape-rendering="crispEdges"><use href="#ic-fs"/></svg></button>' +
            '<button class="cap" data-cap="min" type="button" aria-label="Minimize"><svg viewBox="0 0 10 10" shape-rendering="crispEdges"><rect x="1" y="5" width="8" height="1" fill="currentColor"/></svg></button>' +
            '<button class="cap" data-cap="max" type="button" aria-label="Maximize"><svg viewBox="0 0 10 10" shape-rendering="crispEdges"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/></svg></button>' +
            '<button class="cap close" data-cap="close" type="button" aria-label="Close"><svg viewBox="0 0 10 10"><path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" stroke-width="1.2"/></svg></button>' +
          '</div>' +
        '</header>' +
        '<div class="win-content">' + a.render(id, arg) + '</div>';
    winLayer.appendChild(el);
    openWins[id] = { el: el, min: false };
    wireWindow(id, el);
    if (a.init) a.init(el, id, arg);
    focusWin(id); syncTaskbar();
}
function wireWindow(id, el) {
    var bar = el.querySelector('.win-bar');
    el.addEventListener('pointerdown', function () { if (activeApp !== id) focusWin(id); }, true);
    el.querySelector('.win-caps').addEventListener('click', function (e) {
        var b = e.target.closest('.cap'); if (!b) return; e.stopPropagation();
        var cap = b.getAttribute('data-cap');
        if (cap === 'close') closeWin(id);
        else if (cap === 'min') minWin(id);
        else if (cap === 'fs') toggleWinFs(id);
        // maximizing a window that already owns the screen means nothing, and
        // .maxi's !important would fight .fs for the same four properties
        else if (!winIsFs(id)) el.classList.toggle('maxi');
    });
    bar.addEventListener('dblclick', function (e) {
        if (winIsFs(id)) { exitWinFs(id); return; }        // the way out of full screen everyone tries first
        if (!e.target.closest('.cap, .cr-tab, .cr-plusbtn')) el.classList.toggle('maxi');
    });
    // the classic Alt+Space system menu, where "Full screen" is discoverable
    bar.addEventListener('contextmenu', function (e) {
        if (e.target.closest('.cr-tab, .cr-plusbtn')) return;     // Chrome's tabs have their own
        e.preventDefault(); e.stopPropagation();
        winSysMenu(id, e);
    });
    /* The title bar must not take the keyboard. A mousedown on it — the bar,
       a caption button, a tab — moved focus to <body> or to the button, and
       from then on a game's E and Escape went nowhere until the player clicked
       back inside it. Cancelling the default keeps focus where it was; clicks
       and the pointer-capture drag below are unaffected. Text fields keep it. */
    bar.addEventListener('mousedown', function (e) {
        if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        e.preventDefault();
    });
    bar.addEventListener('pointerdown', function (e) {
        // Chrome's tabs and new-tab button live in its title bar; they must click, not drag the window
        if (e.button !== 0) return;                       // right-click is a menu now, never a drag
        // dragging the hover-revealed strip of a full-screen window would write
        // inline left/top that snap into effect the moment you leave full screen
        if (e.target.closest('.cap, .cr-tab, .cr-plusbtn') || el.classList.contains('maxi') || el.classList.contains('fs')) return;
        closeBctx();                                      // a menu would ride along with the window
        var r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
        bar.setPointerCapture(e.pointerId);
        function mv(ev) {
            el.style.left = clamp(ev.clientX - ox, 8 - r.width + 90, window.innerWidth - 90) + 'px';
            el.style.top = clamp(ev.clientY - oy, 0, window.innerHeight - barSpace() - 36) + 'px';
        }
        function up() { bar.releasePointerCapture(e.pointerId); bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); }
        bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up);
    });
}
function focusWin(id) {
    var w = openWins[id]; if (!w) return;
    // Alt-tabbing out of a full-screen game gives you your desktop back. The
    // window layer is raised as a whole while one window owns the screen, so
    // leaving another window floating over the taskbar is not an option.
    // A MINIMIZED one is not on screen and is nobody's problem, though, and
    // tearing it out of full screen broke the contract minWin documents:
    // minimize a game, touch anything else, and it came back as an ordinary
    // window. syncFsBody already keeps body.fs-app off while it is down.
    if (fsWin && fsWin !== id && openWins[fsWin] && !openWins[fsWin].min) exitWinFs(fsWin);
    w.el.style.zIndex = ++zTop; activeApp = id;
    if (APPS[id].onFocus) APPS[id].onFocus(w.el);
    syncFsBody(); syncTaskbar();
}
// after the active window goes away, focus falls to the topmost remaining one
function refocusTop() {
    var ids = Object.keys(openWins).filter(function (id) { return !openWins[id].min; });
    if (!ids.length) { activeApp = null; return; }
    ids.sort(function (a, b) { return (+openWins[b].el.style.zIndex || 0) - (+openWins[a].el.style.zIndex || 0); });
    activeApp = ids[0];
    // and the keyboard goes with it: closing a window over a game left the
    // taskbar saying the game was active while its keys landed on <body>
    if (APPS[activeApp] && APPS[activeApp].onFocus) APPS[activeApp].onFocus(openWins[activeApp].el);
}
// A minimized full-screen window keeps w.fs — minimize a game and you want
// the taskbar back, click it again and you want the game back the way it was
// — but syncFsBody drops the raised window layer while it is away.
function minWin(id) { var w = openWins[id]; if (!w) return; closeBctx(); if (APPS[id].onMinimize) APPS[id].onMinimize(w.el); w.min = true; w.el.classList.add('mini'); if (activeApp === id) refocusTop(); syncFsBody(); syncTaskbar(); }
function restoreWin(id) { var w = openWins[id]; if (!w) return; w.min = false; w.el.classList.remove('mini'); if (APPS[id].onRestore) APPS[id].onRestore(w.el); syncFsBody(); }
function closeWin(id) {
    var w = openWins[id]; if (!w) return;
    if (APPS[id].onClose) APPS[id].onClose(w.el);
    w.el.remove(); delete openWins[id];
    // the raised window layer outliving the window that asked for it is how
    // you end up on a desktop with no taskbar and no way to get it back
    if (fsWin === id) { fsWin = null; }
    syncFsBody();
    if (activeApp === id) refocusTop();
    if (find.appId === id) { find.appId = null; find.marks = []; find.idx = -1; }
    syncTaskbar();
}

function syncTaskbar() {
    PINNED.forEach(function (id) {
        var b = taskbar.querySelector('.tb-center > .tb-btn.app[data-app="' + id + '"]');
        if (!b) return;
        b.classList.toggle('running', !!openWins[id]);
        b.classList.toggle('active', activeApp === id && openWins[id] && !openWins[id].min);
    });
    var want = Object.keys(openWins).filter(function (id) { return PINNED.indexOf(id) < 0; });
    Array.prototype.slice.call(tbOpen.children).forEach(function (b) { if (want.indexOf(b.getAttribute('data-app')) < 0) b.remove(); });
    want.forEach(function (id) {
        var b = tbOpen.querySelector('[data-app="' + id + '"]');
        if (!b) {
            b = document.createElement('button');
            b.className = 'tb-btn app'; b.setAttribute('data-app', id); b.type = 'button'; b.setAttribute('aria-label', APPS[id].title);
            b.innerHTML = ic(APPS[id].icon);
            tbOpen.appendChild(b);
        }
        b.classList.add('running'); b.classList.toggle('active', activeApp === id && !openWins[id].min);
    });
}
taskbar.addEventListener('click', function (e) {
    var b = e.target.closest('.tb-btn.app[data-app]'); if (!b) return;
    var id = b.getAttribute('data-app');
    if (!openWins[id]) { openApp(id); return; }
    if (openWins[id].min) { restoreWin(id); focusWin(id); return; }
    if (activeApp === id) { minWin(id); return; }
    focusWin(id);
});

function minimizeAll() { Object.keys(openWins).forEach(function (id) { minWin(id); }); }
byId('showDesk').addEventListener('click', minimizeAll);

/* ── Task view: a live overlay of every open window ── */
function closeTaskView() {
    var ov = byId('taskView'); if (!ov) return;
    ov.classList.remove('on');
    ov.id = '';    // it lingers 180ms for the fade; a corpse must not read as open
    setTimeout(function () { if (ov.parentNode) ov.remove(); }, reduce ? 0 : 180);
}
function openTaskView() {
    closeTaskView(); setStart(false); closeFlyouts(); closeCtx(); closeBctx();
    var ov = document.createElement('div'); ov.className = 'tv-overlay'; ov.id = 'taskView';
    var grid = document.createElement('div'); grid.className = 'tv-grid';
    var ids = Object.keys(openWins);
    var BW = clamp(window.innerWidth - 90, 190, 300), BH = Math.round(BW * 0.63);   // phone-friendly cards
    if (!ids.length) grid.innerHTML = '<p class="tv-empty">No open windows yet. Open something from Start or the taskbar.</p>';
    ids.forEach(function (id) {
        var w = openWins[id], a = APPS[id];
        // a docked window's inline width/height are its UNDOCKED size, so the
        // card has to be measured from the screen instead. A full-screen one
        // measures zero on both if this branch misses it, and Math.min(BW/0,
        // BH/0) is Infinity, which is a transform: scale(Infinity).
        var fs = w.el.classList.contains('fs'), maxi = w.el.classList.contains('maxi');
        var ww = fs || maxi ? window.innerWidth : (w.el.offsetWidth || parseInt(w.el.style.width, 10) || a.w);
        var wh = fs ? window.innerHeight
               : maxi ? window.innerHeight - barSpace()
               : (w.el.offsetHeight || parseInt(w.el.style.height, 10) || a.h);
        ww = ww || a.w || 560; wh = wh || a.h || 420;
        var scale = Math.min(BW / ww, BH / wh);
        var clone = w.el.cloneNode(true);
        clone.className = 'win';   // drop clip-path/drop-shadow; the card frames it
        clone.style.cssText = 'position:absolute;margin:0;width:' + ww + 'px;height:' + wh + 'px;transform:scale(' + scale + ');transform-origin:top left;' +
            'left:' + ((BW - ww * scale) / 2) + 'px;top:' + ((BH - wh * scale) / 2) + 'px;';
        // cloneNode skips canvas bitmaps and live textarea values — carry them over
        var sc = w.el.querySelectorAll('canvas'), dc = clone.querySelectorAll('canvas');
        for (var ci = 0; ci < sc.length; ci++) {
            if (dc[ci] && sc[ci].width) { try { dc[ci].getContext('2d').drawImage(sc[ci], 0, 0); } catch (err) {} }
        }
        var st = w.el.querySelectorAll('textarea'), dt = clone.querySelectorAll('textarea');
        for (var ti = 0; ti < st.length; ti++) if (dt[ti]) dt[ti].value = st[ti].value;
        var item = document.createElement('div'); item.className = 'tv-item'; item.setAttribute('data-id', id);
        item.tabIndex = 0; item.setAttribute('role', 'button');            // keyboard-reachable card
        item.setAttribute('aria-label', 'Switch to ' + a.title);
        item.style.width = BW + 'px';
        var shot = document.createElement('div'); shot.className = 'tv-shot'; shot.style.width = BW + 'px'; shot.style.height = BH + 'px';
        shot.appendChild(clone);
        item.appendChild(shot);
        item.insertAdjacentHTML('beforeend', '<div class="tv-label">' + ic(a.icon) + '<span>' + esc(a.title) + '</span><button class="tv-close" type="button" aria-label="Close ' + esc(a.title) + '">✕</button></div>');
        grid.appendChild(item);
    });
    ov.appendChild(grid);
    ov.insertAdjacentHTML('beforeend',
        '<div class="tv-desktops"><div class="tv-desk active"><div class="tv-desk-thumb"></div><span>Desktop 1</span></div>' +
        '<button class="tv-newdesk" type="button"><span class="tv-plus">+</span><span>New desktop</span></button></div>');
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('on'); });

    grid.addEventListener('click', function (e) {
        var item = e.target.closest('.tv-item'); if (!item) return;
        var id = item.getAttribute('data-id');
        if (e.target.closest('.tv-close')) {
            closeWin(id); item.remove();
            if (!grid.querySelector('.tv-item')) grid.innerHTML = '<p class="tv-empty">No open windows.</p>';
            return;
        }
        restoreWin(id); focusWin(id); closeTaskView();
    });
    grid.addEventListener('keydown', function (e) {                        // Enter/Space activate, Delete closes
        var item = e.target.closest('.tv-item'); if (!item) return;
        var id = item.getAttribute('data-id');
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); restoreWin(id); focusWin(id); closeTaskView(); }
        else if (e.key === 'Delete') {
            e.preventDefault(); closeWin(id); item.remove();
            if (!grid.querySelector('.tv-item')) grid.innerHTML = '<p class="tv-empty">No open windows.</p>';
        }
    });
    var first = grid.querySelector('.tv-item'); if (first) setTimeout(function () { first.focus(); }, 30);   // focus isn't motion
    ov.addEventListener('click', function (e) { if (e.target === ov) closeTaskView(); });
}
byId('taskviewBtn').addEventListener('click', function (e) { e.stopPropagation(); if (byId('taskView')) closeTaskView(); else openTaskView(); });

/* ═══════════════════════ full screen ══════════════════════════
   Three things that add up to one feature, and they compose:

     APP FULL SCREEN   one window takes the whole simulated screen. Its own
                       title bar and the taskbar both get out of the way.
                       F11, Alt+Enter, the ⛶ caption button, or the title-bar
                       menu. Reach for the top edge to bring the bar back.
     PAGE FULL SCREEN  the real browser Fullscreen API, so the simulated
                       desktop is the only thing on the monitor. Shift+F11,
                       the tray button, Settings, or the desktop menu.
     AUTO-HIDE         Windows 11's "automatically hide the taskbar", which
                       is a different thing and lives in Settings.

   All three at once is the point: a full-screen NINTH NIGHT inside a
   full-screen page is a game filling a monitor with nothing of either
   operating system left on the glass.                                   */

/* how much room the taskbar is actually taking. Auto-hidden, it takes none,
   and every layout sum that used to subtract BAR has to agree with the CSS. */
function barSpace() { return document.body.classList.contains('tb-auto') ? 0 : BAR; }

/* ─── the real Fullscreen API, behind its vendor prefixes ─── */
var PFS = {
    can: function () {
        var e = document.documentElement;
        if (!(e.requestFullscreen || e.webkitRequestFullscreen || e.msRequestFullscreen)) return false;
        // false (not undefined) means a sandboxed iframe or a policy said no
        return document.fullscreenEnabled !== false && document.webkitFullscreenEnabled !== false;
    },
    on: function () { return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement); },
    enter: function (cb) {
        // documentElement, not .screen: toasts, dialogs, the shortcut card and
        // the blue screen are all children of <body>, and anything outside the
        // full-screen element simply does not render
        var e = document.documentElement;
        var f = e.requestFullscreen || e.webkitRequestFullscreen || e.msRequestFullscreen;
        if (!f) { if (cb) cb(false); return; }
        var r;
        try { r = f.call(e, { navigationUI: 'hide' }); } catch (err) { if (cb) cb(false); return; }
        if (r && r.then) r.then(function () { if (cb) cb(true); }, function () { if (cb) cb(false); });
        // The prefixed WebKit and IE methods return nothing whether they
        // worked or not, so "no promise" is not "yes" — assuming success there
        // made a Safari refusal a completely silent no-op. Ask the document
        // once the queued task that sets fullscreenElement has had its turn.
        else if (cb) setTimeout(function () { cb(PFS.on()); }, 80);
    },
    exit: function () {
        var f = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (!f) return;
        try { var r = f.call(document); if (r && r.catch) r.catch(function () {}); } catch (err) {}
    }
};
function pageFsSync() {
    var on = PFS.on();
    document.body.classList.toggle('page-fs', on);
    var b = byId('fsBtn');
    if (b) {
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
        b.title = (on ? 'Leave full screen' : 'Full screen') + ' · Shift+F11';
        var u = b.querySelector('use'); if (u) u.setAttribute('href', on ? '#ic-fsx' : '#ic-fs');
    }
    // Settings may be open behind it, showing a switch that just became a lie.
    // role="switch" is read off aria-checked, not off a class, so a screen
    // reader was being told the opposite of the truth.
    var t = document.querySelector('.tgl[data-tgl="pagefs"]');
    if (t) { t.classList.toggle('on', on); t.setAttribute('aria-checked', on ? 'true' : 'false'); }
    // ...and the quick-settings tile. This is the ONE place that may paint it:
    // the tile handler used to read PFS.on() on the line after asking, and the
    // Fullscreen API sets fullscreenElement in a queued task, so that read is
    // always the previous answer and the tile showed the exact inverse.
    var q = quickPanel && quickPanel.querySelector('.qs-tile[data-qs="pagefs"]');
    if (q) { q.classList.toggle('on', on); q.setAttribute('aria-pressed', on ? 'true' : 'false'); }
}
/* One explanation per attempt: a refusal can arrive as a rejected promise, as
   a fullscreenerror event, or as both. */
var fsDeniedAt = 0;
function fsDenied() {
    if (Date.now() - fsDeniedAt < 1200) return;
    fsDeniedAt = Date.now();
    toast('The browser turned full screen down.', 'ic-pc');
}
function togglePageFs() {
    if (!PFS.can()) { toast('This browser will not give the page the whole screen.', 'ic-pc'); return; }
    if (PFS.on()) { PFS.exit(); return; }
    PFS.enter(function (okd) {
        // the API only answers to a real gesture; a denial is worth explaining
        if (!okd) fsDenied();
    });
}
['fullscreenchange', 'webkitfullscreenchange', 'MSFullscreenChange'].forEach(function (ev) {
    document.addEventListener(ev, pageFsSync);
});
// the browser saying no out loud, which the promise path does not always do
['fullscreenerror', 'webkitfullscreenerror', 'MSFullscreenError'].forEach(function (ev) {
    document.addEventListener(ev, fsDenied);
});

/* ─── how long a revealed strip stays revealed ───
   A finger has no hover: it enters a strip on touchdown and leaves it on
   release, so the 420ms a mouse needs would shut the bar before a thumb could
   travel to a button. `(hover: none)` was the wrong question — it describes
   only the PRIMARY pointer, so a Windows touch laptop, a Surface or an iPad
   with a trackpad all answer "hover" and their owners still have fingers. Ask
   the EVENT what it was made with instead, every time, so a machine with both
   gets the right answer for whichever one you actually used. */
var TB_MOUSE = 420, TB_TOUCH = 2600;
function graceFor(e) { return (e && e.pointerType && e.pointerType !== 'mouse') ? TB_TOUCH : TB_MOUSE; }
function isMouse(e) { return !e || !e.pointerType || e.pointerType === 'mouse'; }

/* ─── one window, the whole screen ─── */
var fsWin = null, fsPeekT = 0;
function winIsFs(id) { var w = openWins[id]; return !!(w && w.fs); }
/* body.fs-app is what lifts the window layer over the taskbar. A minimized
   full-screen window must not keep it lifted — minimize a game and you
   expect your taskbar back, and clicking it in the taskbar expects the game
   to come back full screen, so w.fs survives the minimize and this does not. */
function syncFsBody() {
    var live = fsWin && openWins[fsWin] && openWins[fsWin].fs && !openWins[fsWin].min;
    document.body.classList.toggle('fs-app', !!live);
}
function fsPeek(id, on, grace) {
    var w = openWins[id]; if (!w || !w.fs) return;
    clearTimeout(fsPeekT);
    if (on) { w.el.classList.add('peek'); return; }
    fsPeekT = setTimeout(function () {
        var x = openWins[id]; if (x && x.fs) x.el.classList.remove('peek');
    }, grace || TB_MOUSE);
}
function enterWinFs(id) {
    var w = openWins[id]; if (!w || w.fs) return;
    if (fsWin && fsWin !== id) exitWinFs(fsWin);            // one screen, one owner
    if (w.min) restoreWin(id);
    setStart(false); closeFlyouts(); closeCtx(); closeFctx(); closeBctx(); closeTaskView();
    w.fs = true;
    w.fsFrom = w.el.classList.contains('maxi') ? 'maxi' : '';   // put it back where it was
    w.el.classList.remove('maxi');
    w.el.classList.add('fs');
    if (!w.el.querySelector('.win-fsedge')) {
        var edge = document.createElement('div');
        edge.className = 'win-fsedge';
        w.el.appendChild(edge);
        var bar = w.el.querySelector('.win-bar');
        edge.addEventListener('pointerenter', function (e) { fsPeek(id, true, graceFor(e)); });
        edge.addEventListener('pointerleave', function (e) { fsPeek(id, false, graceFor(e)); });
        bar.addEventListener('pointerenter', function (e) { fsPeek(id, true, graceFor(e)); });
        bar.addEventListener('pointerleave', function (e) { fsPeek(id, false, graceFor(e)); });
        // a title bar translated off the top is still in the tab order, so
        // tabbing to a caption button has to bring it back into view
        w.el.addEventListener('focusin', function (e) { if (e.target.closest && e.target.closest('.win-bar')) fsPeek(id, true); });
        w.el.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('.win-bar')) fsPeek(id, false); });
    }
    fsWin = id;
    syncFsBody();
    syncFsCap(id);
    focusWin(id);
    winResized(id);
    syncTaskbar();
    // Show the title bar on the way in and let it slide away by itself, so the
    // way out is something you SAW rather than something you had to be told.
    // On a touchscreen there is no F11 and this strip is the only exit there
    // is, so it gets the long grace whatever you entered with.
    fsPeek(id, true); fsPeek(id, false, TB_TOUCH);
    toast('Full screen. Press F11, or reach for the top edge.', 'ic-fs');
}
function exitWinFs(id) {
    var w = openWins[id]; if (!w || !w.fs) return;
    w.fs = false;
    w.el.classList.remove('fs', 'peek');
    if (w.fsFrom === 'maxi') w.el.classList.add('maxi');
    w.fsFrom = '';
    if (fsWin === id) fsWin = null;
    syncFsBody();
    syncFsCap(id);
    winResized(id);
    syncTaskbar();
}
function toggleWinFs(id) { if (winIsFs(id)) exitWinFs(id); else enterWinFs(id); }
function syncFsCap(id) {
    var w = openWins[id]; if (!w) return;
    var b = w.el.querySelector('.cap-fs'); if (!b) return;
    var on = !!w.fs;
    var u = b.querySelector('use'); if (u) u.setAttribute('href', on ? '#ic-fsx' : '#ic-fs');
    b.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
    b.title = (on ? 'Leave full screen' : 'Full screen') + ' · F11';
}
/* An app whose box just changed. Most of the games re-measure every frame or
   keep a ResizeObserver and need nothing, but this is the seam: an app that
   lays itself out once should declare onResize rather than poll. */
function winResized(id) {
    var w = openWins[id], a = APPS[id];
    if (!w || !a) return;
    // The caption button took the keyboard on the way in; a game wants it back.
    // Only when the focus is still ours to move, though: focusWin() exits the
    // old window's full screen BEFORE it reassigns activeApp, so this ran for
    // the window being LEFT and pulled the keyboard off the taskbar button the
    // user had just activated — WASD kept driving the game they tabbed out of.
    var here = document.activeElement;
    if (activeApp === id && a.onFocus && (!here || here === document.body || w.el.contains(here))) {
        try { a.onFocus(w.el); } catch (e) {}
    }
    if (a.onResize) { try { a.onResize(w.el, id); } catch (e) {} }
}
/* Nothing has ever re-clamped windows when the viewport changed, and full
   screen makes that reachable: place a window near the right edge of a
   full-screen page, leave full screen, and it is off the side of a smaller
   desktop with its title bar out of reach. */
function clampWindows() {
    var vw = window.innerWidth, vh = window.innerHeight - barSpace();
    Object.keys(openWins).forEach(function (id) {
        var el = openWins[id].el;
        if (el.classList.contains('maxi') || el.classList.contains('fs')) return;
        var ww = parseInt(el.style.width, 10) || el.offsetWidth || 0;
        var l = parseInt(el.style.left, 10) || 0, t = parseInt(el.style.top, 10) || 0;
        el.style.left = clamp(l, Math.min(8, 8 - ww + 90), Math.max(8, vw - 90)) + 'px';
        el.style.top = clamp(t, 0, Math.max(0, vh - 36)) + 'px';
    });
}
/* the classic Alt+Space system menu, on Alt+Space or a right-click of the
   title bar. `e` only needs clientX/clientY, so the keyboard can fake one. */
function winSysMenu(id, e) {
    var w = openWins[id]; if (!w) return;
    if (!e) { var wr = w.el.getBoundingClientRect(); e = { clientX: wr.left + 8, clientY: wr.top + 34 }; }
    var maxi = w.el.classList.contains('maxi');
    openBctx(w.el, e, [
        { t: 'Restore', k: 'restore', dis: !maxi && !w.fs },
        { t: 'Minimize', k: 'min', hint: 'Alt+M' },
        { t: 'Maximize', k: 'max', dis: maxi || !!w.fs, hint: 'Alt+↑' },
        'sep',
        { t: w.fs ? 'Leave full screen' : 'Full screen', k: 'fs', hint: 'F11' },
        'sep',
        { t: 'Close', k: 'close', hint: 'Alt+W' }
    ], function (act) {
        if (act === 'restore') { if (w.fs) exitWinFs(id); else w.el.classList.remove('maxi'); }
        else if (act === 'min') minWin(id);
        else if (act === 'max') { if (w.fs) exitWinFs(id); w.el.classList.add('maxi'); }
        else if (act === 'fs') toggleWinFs(id);
        else if (act === 'close') closeWin(id);
    });
}

/* ─── a taskbar that gets out of the way ─── */
var tbPeekT = 0;
function setTbAuto(on, save) {
    document.body.classList.toggle('tb-auto', !!on);
    if (!on) { clearTimeout(tbPeekT); document.body.classList.remove('tb-peek'); }
    if (save !== false) store('tbauto', on ? 'on' : 'off');
    renderDesktop();          // the icon grid just gained or lost a row
    // 48px of usable height just came or went. Without this, auto-hide a
    // taskbar, drag a window down to where the clamp now legitimately allows,
    // turn auto-hide back off, and the whole title bar is inside the taskbar:
    // not draggable, not closable, nothing to grab. Only a window resize
    // rescued it, which is the same viewport change by a different control.
    clampWindows();
}
/* Press the Windows key in a full-screen game and you get your taskbar back
   along WITH Start, not Start floating on its own over the game. The same
   goes for tabbing to it: body.fs-app paints the window layer over the
   taskbar, so without this a keyboard user walks a whole row of controls
   that are focused, real, and not on screen anywhere. */
function fsYield() {
    var up = startMenu.classList.contains('open') || !quickPanel.hidden || !calPanel.hidden
        || taskbar.contains(document.activeElement);
    document.body.classList.toggle('fs-yield', up);
}
function tbPeek(on, e) {
    if (!document.body.classList.contains('tb-auto')) return;
    clearTimeout(tbPeekT);
    if (on) { document.body.classList.add('tb-peek'); return; }
    var mouse = isMouse(e);
    tbPeekT = setTimeout(function () {
        // anything hanging off the taskbar keeps it up, same as the real one
        if (startMenu.classList.contains('open')) return;
        if (!quickPanel.hidden || !calPanel.hidden) return;
        if (taskbar.contains(document.activeElement)) return;   // the keyboard is still on it
        if (mouse && taskbar.matches(':hover')) return;         // :hover is a lie for a finger
        document.body.classList.remove('tb-peek');
    }, graceFor(e));
}
byId('tbEdge').addEventListener('pointerenter', function (e) { tbPeek(true, e); });
byId('tbEdge').addEventListener('pointerleave', function (e) { tbPeek(false, e); });
taskbar.addEventListener('pointerenter', function (e) { tbPeek(true, e); });
taskbar.addEventListener('pointerleave', function (e) { tbPeek(false, e); });
taskbar.addEventListener('focusin', function () { tbPeek(true); fsYield(); });   // keyboard reaches it too
// focusout fires BEFORE the next element takes focus, so activeElement is
// still stale on this tick — ask again once it has settled
taskbar.addEventListener('focusout', function () { tbPeek(false); setTimeout(fsYield, 0); });

/* ═══════════════════════════ apps ═══════════════════════════ */
var ME = {
    bio: "I'm Isaac, a rising sophomore at Rice studying Mathematical Economic Analysis. I'm slowly trading the finance track for academia, with a PhD and eventually an economics professorship as the goal. Outside class I'm a systems-and-optimization guy: gaming, Dungeon Mastering, photography, and building my GTI.",
    now: "Interning at Deep Blue this summer doing finance, research, and a weekly newsletter. Back at Rice in the fall running financing for the school's first-ever Formula SAE team and shooting for the Thresher.",
    tags: ['gaming', 'Dungeon Mastering', 'photography', 'car builds', 'absurdist philosophy', 'tennis', 'pickleball', 'karaoke', 'coding'],
    specs: [
        ['Car', 'silver MK8 GTI "Argent"'], ['From', 'Houston / The Woodlands'],
        ['Studying', 'Math Economic Analysis, Rice ’29'], ['GPA', '4.00'],
        ['Dream job', 'economics professor'], ['Runs on', 'chamomile, not caffeine']
    ],
    links: [
        ['Email', 'mailto:isaacoure@gmail.com', 'isaacoure@gmail.com'],
        ['Instagram', 'https://www.instagram.com/isaacure_/', '@isaacure_'],
        ['LinkedIn', 'https://www.linkedin.com/in/isaacure/', 'in/isaacure'],
        ['GitHub', 'https://github.com/IsaacUre', 'IsaacUre'],
        ['Site', 'https://isaacure.com', 'isaacure.com']
    ]
};

/* —— About —— */
function renderAbout() {
    var tags = ME.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    var specs = ME.specs.map(function (s) { return '<dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd>'; }).join('');
    var links = ME.links.map(function (l) {
        var ext = l[1].indexOf('mailto') === 0 ? '' : ' target="_blank" rel="noopener"';
        return '<a class="about-link" href="' + l[1] + '"' + ext + '><b>' + esc(l[0]) + '</b><span>' + esc(l[2]) + '</span></a>';
    }).join('');
    return '<div class="about">' +
        '<div class="about-hero">' + ic('ic-ure', 'about-av') +
          '<div><h2>Isaac Ure</h2><p class="about-sub">Rising sophomore · Rice University · Houston</p></div></div>' +
        '<div class="about-body">' +
          '<p>' + esc(ME.bio) + '</p>' +
          '<h3>Right now</h3><p>' + esc(ME.now) + '</p>' +
          '<h3>Into</h3><div class="tags">' + tags + '</div>' +
          '<h3>Specs</h3><dl class="specs">' + specs + '</dl>' +
          '<h3>Links</h3><div class="about-links">' + links + '</div>' +
        '</div></div>';
}

/* —— File Explorer + a real (DEEP) file system ——
   The base FS below is the machine's factory image. On top of it sits
   a persistent overlay (comp_fs): downloads land in `add`, deleted
   base files are keyed into `gone`, and everything you throw out
   waits in `bin` until it's restored or purged. Explorer, the
   Recycle Bin, and the browser download shelf all speak to it.

   The factory image is authored as nested TREE literals and compiled
   into flat FS entries keyed by path ('C:/Windows/System32'). The
   original flat keys (Home, Desktop, Downloads, Documents, Pictures,
   Projects, This PC) survive untouched so existing comp_fs overlays
   keep pointing at real folders.

   TREE grammar (see fsCompile):
     value {}        → subfolder ($ key = meta: e empty-msg, d base date, j jitter days)
     value 0         → file, everything inferred from the extension
     value 'text'    → file whose CONTENT is that text (opens in Notepad)
     value '>Key'    → junction to another FS key
     value '@app'    → file that launches an app (exe shortcuts); '@!x' = special
     value [size, date, flags] → explicit meta; flags: 'crit' (BSOD-protected),
       'ph:N' (Photos index) */
var FS = {
    'Home': { items: [
        { n: 'Desktop', t: 'folder', go: 'Desktop' }, { n: 'Downloads', t: 'folder', go: 'Downloads' },
        { n: 'Documents', t: 'folder', go: 'Documents' }, { n: 'Pictures', t: 'folder', go: 'Pictures' },
        { n: 'Music', t: 'folder', go: 'Music' }, { n: 'Videos', t: 'folder', go: 'Videos' },
        { n: 'Projects', t: 'folder', go: 'Projects' }, { n: 'URE BOY', t: 'ureboy', app: 'ureboy' }
    ] },
    'This PC': { items: [
        { n: 'Local Disk (C:)', t: 'drive', go: 'C:', cap: [251, 476], sect: 'Devices and drives', sys: 1 },
        { n: 'Data (D:)', t: 'drive', go: 'D:', cap: [519, 931], sect: 'Devices and drives', sys: 1 },
        { n: 'URE DRIVE (E:)', t: 'usb', go: 'E:', cap: [11.7, 14.9], sect: 'Devices and drives', sys: 1 },
        { n: 'DVD RW Drive (F:)', t: 'disc', sect: 'Devices and drives', sys: 1 },
        { n: 'Desktop', t: 'folder', go: 'Desktop', sect: 'Folders' }, { n: 'Documents', t: 'folder', go: 'Documents', sect: 'Folders' },
        { n: 'Downloads', t: 'folder', go: 'Downloads', sect: 'Folders' }, { n: 'Music', t: 'folder', go: 'Music', sect: 'Folders' },
        { n: 'Pictures', t: 'folder', go: 'Pictures', sect: 'Folders' }, { n: 'Videos', t: 'folder', go: 'Videos', sect: 'Folders' },
        { n: 'Projects', t: 'folder', go: 'Projects', sect: 'Folders' }
    ] },
    // the Desktop is a real folder — its items ARE the desktop icons
    'Desktop': { items: [
        { n: 'This PC', t: 'pc', app: 'explorer', arg: 'This PC', sys: 1 },
        { n: 'About Isaac', t: 'ure', app: 'about' },
        { n: 'Google Chrome', t: 'chrome', app: 'chrome' },
        { n: 'NINTH NIGHT', t: 'ninth', app: 'ninth' },
        { n: 'URE BOY', t: 'ureboy', app: 'ureboy' },
        { n: 'the room', t: 'room', app: 'room' },
        { n: 'Recycle Bin', t: 'bin', app: 'bin', sys: 1 }
    ], empty: 'A perfectly clean desktop. Suspicious.' },
    'Downloads': { items: [], empty: 'Nothing downloaded yet.' },
    'Documents': { items: [
        { n: 'Rice', t: 'folder', go: 'Documents/Rice' }, { n: 'FSAE', t: 'folder', go: 'Documents/FSAE' },
        { n: 'Deep Blue', t: 'folder', go: 'Documents/Deep Blue' }, { n: 'DnD', t: 'folder', go: 'Documents/DnD' },
        { n: 'My Games', t: 'folder', go: 'Documents/My Games' }, { n: 'essays', t: 'folder', go: 'Documents/essays' },
        { n: 'car', t: 'folder', go: 'Documents/car' },
        { n: 'about-me.txt', t: 'notepad', app: 'about' }, { n: 'resume.pdf', t: 'notepad', app: 'about' },
        { n: 'readme.txt', t: 'notepad', app: 'notepad' }
    ] },
    'Pictures': { items: [
        { n: 'Camera Roll', t: 'folder', go: 'Pictures/Camera Roll' }, { n: 'Screenshots', t: 'folder', go: 'Pictures/Screenshots' },
        { n: 'argent', t: 'folder', go: 'Pictures/argent' }, { n: 'thresher', t: 'folder', go: 'Pictures/thresher' },
        { n: 'wallpapers', t: 'folder', go: 'Pictures/wallpapers' },
        { n: 'the room.png', t: 'room', app: 'photos', arg: 0 }, { n: 'argent.png', t: 'gti', app: 'photos', arg: 1 },
        { n: 'bloom.png', t: 'photos', app: 'photos', arg: 4 }
    ] },
    'Projects': { items: [
        { n: 'website', t: 'folder', go: 'Projects/website' },
        { n: 'URE BOY', t: 'ureboy', app: 'ureboy' }, { n: 'the room', t: 'room', app: 'room' },
        { n: 'GTI RUN', t: 'gti', app: 'gti' }, { n: 'isaacure.com', t: 'globe', app: 'chrome' }
    ] },
    'Music': { items: [] },
    'Videos': { items: [] }
};
var FS_ICON = {
    folder: 'ic-folder', pc: 'ic-pc', notepad: 'ic-notepad', room: 'ic-room', gti: 'ic-gti', ureboy: 'ic-ureboy',
    photos: 'ic-photos', globe: 'ic-globe', chrome: 'ic-chrome', ure: 'ic-ure', bin: 'ic-bin',
    file: 'ic-file', txt: 'ic-txt', ini: 'ic-ini', log: 'ic-log', doc: 'ic-doc', xls: 'ic-xls', ppt: 'ic-ppt',
    pdf: 'ic-pdf', img: 'ic-img', audio: 'ic-audio', video: 'ic-video', exe: 'ic-exe', dll: 'ic-dll', sys: 'ic-sys',
    zip: 'ic-zip', code: 'ic-code', js: 'ic-js', html: 'ic-html', css: 'ic-css', font: 'ic-font', sav: 'ic-sav',
    drive: 'ic-drive', usb: 'ic-usb', disc: 'ic-disc', terminal: 'ic-terminal', calc: 'ic-calc',
    explorer: 'ic-explorer', settings: 'ic-settings',
    ninth: 'ic-ninth'
};
var KIND = {
    folder: 'File folder', pc: 'Local disk', notepad: 'Text document', room: 'PNG image', gti: 'PNG image',
    photos: 'PNG image', ureboy: 'Shortcut', globe: 'Internet shortcut', chrome: 'Application', ure: 'Shortcut',
    bin: 'Recycle Bin', file: 'File', txt: 'Text document', ini: 'Configuration settings',
    log: 'Text document', doc: 'Microsoft Word document', xls: 'Microsoft Excel worksheet', ppt: 'Microsoft PowerPoint presentation',
    pdf: 'PDF document', img: 'Image', audio: 'Audio', video: 'Video', exe: 'Application', dll: 'Application extension',
    sys: 'System file', zip: 'Compressed (zipped) folder', code: 'Source file', js: 'JavaScript file', html: 'HTML document',
    css: 'CSS document', font: 'TrueType font file', sav: 'Save file', drive: 'Local disk', usb: 'USB drive', disc: 'CD Drive',
    terminal: 'Application', calc: 'Application',
    explorer: 'Application', settings: 'Application',
    ninth: 'Shortcut'
};
// extension → item type. Anything unlisted is a plain 'file'.
var EXT_T = {
    txt: 'txt', md: 'txt', nfo: 'txt', ini: 'ini', inf: 'ini', cfg: 'ini', vdf: 'ini', acf: 'ini', reg: 'ini',
    log: 'log', doc: 'doc', docx: 'doc', xls: 'xls', xlsx: 'xls', csv: 'xls', ppt: 'ppt', pptx: 'ppt', pdf: 'pdf',
    png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', bmp: 'img', ico: 'img', cur: 'img', ani: 'img',
    mp3: 'audio', wav: 'audio', m4a: 'audio', mp4: 'video', mov: 'video', mkv: 'video',
    zip: 'zip', rar: 'zip', '7z': 'zip', ttf: 'font', otf: 'font', fon: 'font',
    exe: 'exe', dll: 'dll', sys: 'sys', dat: 'sys', mca: 'sys', tmp: 'file', bat: 'code', cmd: 'code', ps1: 'code',
    js: 'js', json: 'code', xml: 'code', html: 'html', htm: 'html', css: 'css',
    sav: 'sav', wld: 'sav', plr: 'sav', uqs: 'sav', rbxl: 'sav', bak: 'sav'
};
// extension → the string Windows would put in the Type column (falls back to KIND[t])
var EXT_KIND = {
    md: 'Markdown document', dll: 'Application extension', sys: 'System file', dat: 'DAT file', mca: 'Region file',
    png: 'PNG image', jpg: 'JPG image', jpeg: 'JPG image', gif: 'GIF image', ico: 'Icon', cur: 'Cursor', ani: 'Animated cursor',
    mp3: 'MP3 audio', wav: 'Wave sound', m4a: 'M4A audio', mp4: 'MP4 video', mov: 'QuickTime video',
    docx: 'Microsoft Word document', xlsx: 'Microsoft Excel worksheet', csv: 'Comma-separated values', pptx: 'Microsoft PowerPoint presentation',
    reg: 'Registration entries', bat: 'Windows batch file', ps1: 'PowerShell script',
    json: 'JSON file', xml: 'XML document', wld: 'Terraria world', plr: 'Terraria player', uqs: 'URE QUEST save',
    rbxl: 'Roblox place', bak: 'Backup file', tmp: 'Temporary file', inf: 'Setup information'
};
// extension → plausible size range in KB (deterministic pick per path)
var EXT_KB = {
    txt: [1, 40], md: [1, 30], nfo: [1, 4], ini: [1, 9], inf: [2, 60], cfg: [1, 9], vdf: [1, 14], acf: [1, 6], reg: [1, 8],
    log: [30, 2200], doc: [13, 90], docx: [13, 260], xls: [9, 90], xlsx: [9, 210], csv: [2, 80], ppt: [900, 9000], pptx: [900, 28000],
    pdf: [80, 4600], png: [350, 4200], jpg: [900, 7200], jpeg: [900, 7200], gif: [90, 2400], ico: [4, 90], cur: [3, 12], ani: [6, 40],
    mp3: [2600, 9400], wav: [120, 2400], m4a: [2400, 8800], mp4: [42000, 1600000], mov: [60000, 900000],
    zip: [240, 120000], rar: [400, 90000], ttf: [38, 720], otf: [60, 900],
    exe: [180, 140000], dll: [48, 8400], sys: [24, 2900], dat: [16, 90000], mca: [900, 4200], tmp: [1, 900],
    js: [1, 60], json: [1, 25], xml: [2, 40], html: [2, 38], htm: [2, 38], css: [1, 44], bat: [1, 3], cmd: [1, 3], ps1: [1, 9],
    sav: [4, 220], wld: [3200, 24000], plr: [3, 9], uqs: [6, 30], rbxl: [220, 3800], bak: [8, 2000]
};
function extOf(n) { var d = n.lastIndexOf('.'); return d > 0 ? n.slice(d + 1).toLowerCase() : ''; }
function fsHash(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h >>> 0; }
function fmtKb(kb) {
    if (kb < 1024) return Math.max(1, Math.round(kb)) + ' KB';
    if (kb < 1048576) { var mb = kb / 1024; return (mb < 10 ? mb.toFixed(1) : Math.round(mb)) + ' MB'; }
    return (kb / 1048576).toFixed(2) + ' GB';
}

/* full text for files worth reading — keyed by FS path. Everything
   else gets believable filler from the per-type generators below. */
var TXT = {};
var READS = {};   // pdf bodies for the Reader, keyed by file name

/* ── the factory image: three drives of it ─────────────────────── */
var TREE_C = {
    $: { d: '6/5/2021', j: 4 },
    'Windows': {
        'System32': {
            $: { e: 'You should not be able to see this message.' },
            'Boot': { 'winload.exe': [null, null, 'crit'], 'bootres.dll': 0 },
            'config': {
                $: { e: 'The registry lives here. It prefers not to be perceived.' },
                'SAM': [null, null, 'crit'], 'SECURITY': 0, 'SOFTWARE': ['84 MB'], 'SYSTEM': ['41 MB', null, 'crit'], 'DEFAULT': 0
            },
            'drivers': {
                'etc': { 'hosts': '# Copyright (c) 1993-2009 Microsoft Corp.\n#\n# This is a sample HOSTS file used by Microsoft TCP/IP for Windows.\n\n127.0.0.1       localhost\n127.0.0.1       isaacure.com   # wait. no. how would that even\n::1             localhost', 'networks': 0, 'protocol': 0, 'services': 0 },
                'acpi.sys': 0, 'disk.sys': [null, null, 'crit'], 'http.sys': 0, 'ndis.sys': 0, 'tcpip.sys': [null, null, 'crit'],
                'usbhub.sys': 0, 'wdf01000.sys': 0, 'nvlddmkm.sys': ['58 MB'], 'gti_turbo.sys': 0, 'argent.sys': 0
            },
            'spool': { 'PRINTERS': { $: { e: 'No printer has ever worked. Not once. Not anywhere.' } } },
            'ntdll.dll': [null, null, 'crit'], 'kernel32.dll': [null, null, 'crit'], 'kernelbase.dll': 0,
            'user32.dll': [null, null, 'crit'], 'gdi32.dll': 0, 'shell32.dll': ['21 MB'], 'comctl32.dll': 0, 'comdlg32.dll': 0,
            'advapi32.dll': 0, 'ole32.dll': 0, 'oleaut32.dll': 0, 'shlwapi.dll': 0, 'ws2_32.dll': 0, 'wininet.dll': 0,
            'urlmon.dll': 0, 'msvcrt.dll': 0, 'ucrtbase.dll': 0, 'd3d11.dll': 0, 'dxgi.dll': 0, 'opengl32.dll': 0,
            'dwmapi.dll': 0, 'uxtheme.dll': 0, 'imm32.dll': 0, 'setupapi.dll': 0, 'winmm.dll': 0, 'bcrypt.dll': 0,
            'crypt32.dll': 0, 'schannel.dll': 0, 'netapi32.dll': 0, 'hal.dll': [null, null, 'crit'], 'ci.dll': 0,
            'vibes.dll': ['4 KB', null, 'crit'], 'ure32.dll': 0, 'chamomile.sys': 0, 'boulder.sys': 0,
            'csrss.exe': [null, null, 'crit'], 'winlogon.exe': [null, null, 'crit'], 'lsass.exe': 0, 'svchost.exe': 0,
            'dwm.exe': 0, 'ctfmon.exe': 0, 'RuntimeBroker.exe': 0,
            'cmd.exe': '@terminal', 'calc.exe': '@calc', 'notepad.exe': '@notepad', 'mspaint.exe': 0, 'taskmgr.exe': '@!taskview'
        },
        'SysWOW64': { $: { e: 'The same thing as System32, but narrower. Do not ask which one is 64.' }, 'ntdll.dll': 0, 'kernel32.dll': 0, 'user32.dll': 0, 'msvcrt.dll': 0 },
        'Fonts': {
            'Press Start 2P.ttf': 0, 'VT323.ttf': 0, 'Silkscreen.ttf': 0, 'Segoe UI Pixel.ttf': 0,
            'consola.ttf': 0, 'arial.ttf': 0, 'times.ttf': 0, 'Comic Sans MS.ttf': 0, 'Papyrus.ttf': 0, 'Wingdings.ttf': 0
        },
        'Media': {
            'Windows Startup.wav': 0, 'Windows Shutdown.wav': 0, 'Windows Error.wav': 0, 'Windows Unlock.wav': 0,
            'tada.wav': 0, 'chimes.wav': 0, 'chord.wav': 0, 'ding.wav': 0, 'notify.wav': 0
        },
        'Web': { 'Wallpaper': { 'bloom.png': [null, null, 'ph:4'], 'bloom_alt.png': [null, null, 'ph:4'], 'img0.jpg': 0, 'img19.jpg': 0 } },
        'Cursors': { 'aero_arrow.cur': 0, 'aero_busy.ani': 0, 'aero_link.cur': 0, 'possessed.ani': ['9 KB', null, null, ''] },
        'Logs': { 'CBS': { 'CBS.log': 0 }, 'DISM': { 'dism.log': 0 } },
        'INF': { 'oem1.inf': 0, 'oem42.inf': 0, 'setupapi.dev.log': 0 },
        'Temp': { $: { e: 'Windows cleans this folder. Windows has never cleaned this folder.' }, 'MpSigStub.log': 0, '~DF8A31.tmp': 0 },
        'explorer.exe': '@explorer', 'regedit.exe': 0, 'winhlp32.exe': 0,
        'win.ini': '; for 16-bit app support\n[fonts]\n[extensions]\n[mci extensions]\n[files]\n[vibes]\nlevel=maximum\nsource=bloom',
        'system.ini': '; for 16-bit app support\n[386Enh]\nwoafont=dosapp.fon\n[drivers]\nwave=mmdrv.dll\ntimer=timer.drv\n; nobody has read this file since 1998. hi.',
        'WindowsUpdate.log': 0
    },
    'Program Files': {
        'Google': {
            'Chrome': { 'Application': {
                'chrome.exe': '@chrome',
                '138.0.7204.97': { 'chrome.dll': ['218 MB'], 'icudtl.dat': 0, 'resources.pak': ['24 MB'], 'Locales': { 'en-US.pak': 0 } },
                'SetupMetrics': { 'setup.log': 0 }
            } }
        },
        'URE Softworks': {
            'GTI RUN': { 'gtirun.exe': '@gti', 'tracks.dat': 0, 'readme.txt': 'GTI RUN.\nhold A to not die. the sleeping policeman is not sleeping.' },
            'PIT LANE': { 'pitlane.exe': '@ureboy', 'strategy.dat': 0 },
            'URE QUEST': { 'quest.exe': '@ureboy', 'party.dat': 0, 'balance.txt': 'nerf the cow? (no. never. the cow stays.)' },
            'NINTH NIGHT': { 'ninthnight.exe': '@ninth', 'Content': { 'ballad.txt': 'In the ninth year of the thin sun\nthere was nothing left to eat.\nWe burned the doors, we burned the pews,\nwe burned the market street.\n\n[...]\n\nSo light your lamps on the ninth night\nand set one on the sill\nfor the man who walked out past the fence,\nand he went alone.\n\n(five syllables. every other closing line runs six to eight. something was taken out and you can hear the hole.)', 'families.cfg': '; words that rhyme share a nature\neat  = hunger, burn, drain\night = reveal, strip armour, true damage\nerd  = command, silence, counter\nark  = shadow, damage over time, conceal\nill  = stun, freeze, execute\n\n; nothing rhymes with sword. this is deliberate.' }, 'readme.txt': 'NINTH NIGHT — proof of concept.\n\nTwo verbs. Call leaves a rhyme. Answer detonates every rhyme that matches its sound.\n\nPress ` for the dev menu.' }
        },
        'Windows Defender': { 'MsMpEng.exe': 0, 'mpengine.dll': ['118 MB'], 'MpCmdRun.exe': 0 },
        '7-Zip': { '7z.exe': 0, '7z.dll': 0, 'History.txt': '9.20 2010-11-18\n- everything since has been vibes.\n\n(this changelog abridged for pixel reasons)' },
        'Common Files': {}, 'desktop.ini': '[.ShellClassInfo]\nIconResource=%SystemRoot%\\system32\\imageres.dll,-108'
    },
    'Program Files (x86)': {
        $: { e: 'The same programs, but narrower.' },
        'Internet Explorer': { 'iexplore.exe': '@!ie' },
        'Microsoft Office (trial)': { 'trial expired.txt': 'The Office trial expired in 2022.\nGoogle Docs won. Everyone knew Google Docs would win.' },
        'Common Files': {}
    },
    'ProgramData': {
        'Microsoft': { 'Windows': { 'Start Menu': {} }, 'Windows Defender': { 'Scans': {} } },
        'Package Cache': { '{4f8a1c2e-77ure-4bo0-y114-argent5ilver}': { 'state.rsm': 0 } }
    },
    'Users': {
        'isaac': '>C:/Users/isaac',
        'Public': { 'Public Desktop': {}, 'Public Documents': { 'desktop.ini': 0 } },
        'desktop.ini': 0
    },
    'Temp': { $: { e: 'The other Temp. There are always at least two.' }, 'chrome_installer.log': 0, '~DF3A02.tmp': 0, 'wct8F42.tmp': 0 },
    'pagefile.sys': ['12.0 GB'], 'swapfile.sys': ['2.4 GB'], 'hiberfil.sys': ['9.5 GB'],
    'autoexec.bat': '@echo off\nrem 2003 called. it can keep it.',
    'ureos.log': 0
};

var TREE_USER = {
    $: { d: '9/2/2025', j: 260 },
    // the profile's own folders — junctions to the keys that hold them, so
    // C:\Users\isaac actually contains the folders that claim it as parent
    // (Up, the 'isaac' breadcrumb, and `cd ..`/`dir` all land here)
    'Desktop': '>Desktop', 'Documents': '>Documents', 'Downloads': '>Downloads',
    'Music': '>Music', 'Pictures': '>Pictures', 'Videos': '>Videos', 'Projects': '>Projects',
    'AppData': {
        'Local': {
            'Temp': { $: { e: 'Deleting these does nothing. They respawn. Everyone knows this.' }, '~DFC112.tmp': 0, '~DF99B0.tmp': 0, 'msohtmlclip1.tmp': 0, 'FXSAPIDebugLogFile.txt': 0, 'chrome_installer.log': 0 },
            'Google': { 'Chrome': { 'User Data': { 'Default': { 'History': 0, 'Cookies': 0, 'Login Data': 0, 'Bookmarks': 0, 'Cache': { 'f_000001': 0, 'f_000002': 0 } } } } },
            'URE Softworks': { 'URE QUEST': { 'save_v4.uqs': 0, 'screenshots': { 'heat soak fight.png': 0, 'the silver garage.png': 0 } } },
            'Packages': {}
        },
        'LocalLow': { $: { e: 'Nobody knows what LocalLow is for. It knows what it did.' } },
        'Roaming': {
            'Microsoft': { 'Windows': { 'Recent': {} } }
        }
    },
    'Saved Games': { 'ure': { 'quest_backup.uqs': 0 } },
    'NTUSER.DAT': ['18 MB']
};

var TREE_DOCS = {
    $: { d: '9/8/2025', j: 240 },
    'Rice': {
        'Fall 2025': {
            $: { d: '8/25/2025', j: 100 },
            'ECON 200': { 'syllabus.pdf': 0, 'pset 1.pdf': 0, 'pset 2.pdf': 0, 'pset 3 (redemption arc).pdf': 0, 'notes.txt': 'week 6: everything is opportunity cost.\nweek 7: including reading week.\nweek 12: the marginal utility of one more practice exam is, ironically, diminishing.' },
            'MATH 355': { 'syllabus.pdf': 0, 'linear algebra notes.txt': 'a matrix is a spreadsheet with self-esteem.\neigenvectors: directions the matrix refuses to change. respect it.\nproof strategy: assume it works, panic, cite a theorem.', 'pset 4.pdf': 0, 'pset 5.pdf': 0 },
            'FWIS 100': { 'essay draft.docx': 0, 'essay FINAL.docx': 0, 'essay FINAL final.docx': 0, 'essay FINAL final ACTUALLY SUBMITTED.docx': 0 },
            'schedule.png': 0
        },
        'Spring 2026': {
            $: { d: '1/12/2026', j: 110 },
            'ECON 375': { 'syllabus.pdf': 0, 'metrics notes.txt': 'correlation is not causation but it IS a great opener.\ninstrumental variables: an alibi for your regression.' },
            'MATH 302': { 'real analysis scars.txt': 'epsilon: arbitrarily small.\ndelta: depends on epsilon.\nme: depends on chamomile.' },
            'STAT 310': { 'pset 2.pdf': 0, 'pset 3.pdf': 0 },
            'PHIL 104': { 'camus response paper.docx': 0, 'sisyphus notes.txt': 'the boulder is not the punishment.\nthe boulder is the routine. the routine is survivable. the routine can even be good.\none must imagine the problem set finished.' }
        },
        'degree plan.xlsx': 0, 'transcript (unofficial).pdf': 0, 'MTEC major requirements.pdf': 0
    },
    'FSAE': {
        $: { d: '10/2/2025', j: 200 },
        'budget v7 FINAL.xlsx': 0, 'budget v8 (v7 was not final).xlsx': 0, 'sponsor deck.pptx': 0, 'sponsor contacts.xlsx': 0,
        'rules 2026.pdf': 0, 'chassis quotes.pdf': 0,
        'kickoff notes.txt': 'first meeting of the first FSAE team Rice has ever had.\nwe have: ambition, a whiteboard, and me doing the money.\nwe need: everything else.\nnote to self: sponsors say yes to "invest in engineers," not "please buy us a car."'
    },
    'Deep Blue': {
        $: { d: '6/2/2026', j: 40 },
        'water industry update — draft.docx': 0, 'water industry update — sent.pdf': 0, 'produced water 101.pdf': 0,
        'expense report.xlsx': 0,
        'jv notes.txt': 'the JV: Diamondback + Five Point, produced water midstream.\nmy job: make the weekly update readable by humans.\nrule 1: nobody has ever complained that a newsletter was too short.'
    },
    'DnD': {
        $: { d: '11/5/2025', j: 220 },
        'campaign': {
            'session 0 notes.txt': 'pitch: low-fantasy road campaign. the party shares one (1) enchanted hatchback.\nhouse rule: nat 20 on a persuasion check against me and I legally have to say yes.',
            'session 1 — the silver garage.txt': 'party met the mechanic-oracle. she speaks only in torque specs.\nsophie talked us OUT of a fight for the first time in table history.\nloot: a coupler of dubious provenance.',
            'session 2 — hedges road.txt': 'random encounter table came up "sleeping policeman" and no one was ready.\nmalachi cast something he had not prepared. ruled it worked because it was funny.',
            'session 3 — the depths.txt': 'the boulder puzzle took 90 minutes.\nthe party named the boulder. the party now refuses to leave the boulder.\ni have written a stat block for the boulder. this is my life now.',
            'the intercooler arc.txt': 'big bad: HEAT SOAK, tyrant of summer.\nthe prophecy is a parts list. the quest is an install.\nfinale: they have to finish the install MID-FIGHT. do not let them know the box has been in the trunk since session 1.',
            'npc voices.txt': 'mechanic-oracle: gravel, slow.\nferryman: just my normal voice but sadder.\nthe cow: i will not do a cow voice. (i did the cow voice.)',
            'loot table.xlsx': 0
        },
        'maps': { 'hedges road.png': 0, 'the commons.png': 0, 'the depths.png': 0 },
        'character sheets': { 'SOPHIE — silver ring bard.pdf': 0, 'MALACHI — chaos sorcerer.pdf': 0, 'SAMMY — beast barbarian.pdf': 0, 'THE BOULDER.pdf': 0, 'the cow.pdf': 0 },
        'DM screen cheatsheet.pdf': 0, 'dice math.xlsx': 0
    },
    'My Games': {
        'Terraria': {
            'Players': { 'isaac.plr': 0, 'isaac.plr.bak': 0 },
            'Worlds': { 'the big one.wld': 0, 'hardcore attempt 3 (RIP).wld': 0, 'the big one.wld.bak': 0 }
        }
    },
    'essays': {
        $: { d: '2/9/2026', j: 90 },
        'why i wanted to be a cow (age 7, recovered).txt': 'RECOVERED FROM THE OLD LAPTOP. PRESERVED VERBATIM.\n\nwhen i grow up i want to be a cow because cows get to stand in the grass all day and nobody asks them anything.\n\n(editor’s note, age 19: the kid had a point.)',
        'absurdism and idle games.txt': 'thesis: the idle game is the most honest genre.\nthe numbers go up. it means nothing. you keep going anyway.\ncamus would have played cookie clicker. camus would have ASCENDED.',
        'college essay final.docx': 0
    },
    'car': {
        $: { d: '3/14/2026', j: 80 },
        'argent service log.txt': 'ARGENT — silver MK8 GTI. full name Argentina Artemis Ure. she earned it.\n\n- unitronic stage 1+: done. she pulls now.\n- IE intake: done. she breathes now.\n- flex fuel: done. she sips fancy now.\n- intercooler: purchased. boxed. the box is fine. the box is FINE.',
        'intercooler installation plan.txt': 'step 1: open the box.\nstep 2: (this step intentionally left blank)\n\nstatus: pending since purchase. the box and i have an understanding.',
        'IE intake receipt.pdf': 0, 'intercooler receipt.pdf': 0, 'dyno day.pdf': 0
    },
    'ideas.txt': 'website but it is a game boy\ngame boy but it is a room\nroom but it is first person\nfirst person but there is a computer\ncomputer but it has a website on it (careful)',
    'karaoke setlist.txt': 'opener: something safe.\nmid-set: the duet. non-negotiable.\ncloser: the one that wrecks the voice. worth it every time.\nrule: never follow sophie. you will not survive following sophie.',
    'reading list.txt': 'camus — the myth of sisyphus (again)\ncamus — the stranger (again again)\nsomething about water infrastructure that i will absolutely finish\nthe FSAE rulebook (573 pages, riveting, five stars)'
};

var TREE_PICS = {
    $: { d: '10/12/2025', j: 260 },
    'Camera Roll': {
        'IMG_2041.jpg': 0, 'IMG_2042.jpg': 0, 'IMG_2044.jpg': 0, 'IMG_2049.jpg': 0, 'IMG_2050.jpg': 0, 'IMG_2051.jpg': 0,
        'IMG_2057.jpg': 0, 'IMG_2063.jpg': 0, 'IMG_2071.jpg': 0, 'IMG_2072.jpg': 0, 'IMG_2088.jpg': 0,
        'the matching rings.jpg': 0, 'martel at golden hour.jpg': 0, 'the tree branch (memorial).jpg': 0
    },
    'Screenshots': {
        'terraria eye of cthulhu.png': 0, 'cookie clicker 1 trillion.png': 0, 'urequest full party.png': 0,
        'gti run PB 114.png': 0, 'pit lane photo finish.png': 0, 'Screenshot 2026-03-02 014412.png': 0, 'Screenshot 2026-03-02 014415.png': 0
    },
    'argent': {
        'day one.jpg': [null, null, 'ph:1'], 'first wash.jpg': [null, null, 'ph:1'], 'stage 1 day.jpg': [null, null, 'ph:1'],
        'intake install.jpg': 0, 'the box the intercooler lives in.jpg': 0, 'golden hour.jpg': [null, null, 'ph:1'], 'car wash receipt (why).jpg': 0
    },
    'thresher': { 'fsae reveal shoot.jpg': 0, 'martel sunset.jpg': 0, 'game day 1.jpg': 0, 'game day 2 (better).jpg': 0 },
    'wallpapers': { 'bloom.png': [null, null, 'ph:4'], 'bloom but red.png': 0, 'dmg green.png': 0, 'the room at night.png': [null, null, 'ph:0'] }
};

var TREE_MUSIC = {
    $: { d: '7/20/2025', j: 300 },
    'car songs': {
        'boost line.mp3': 0, 'night drive 114.mp3': 0, 'silver.mp3': 0, 'flex fuel anthem.mp3': 0,
        'sleeping policeman (remix).mp3': 0, 'the on-ramp song.mp3': 0, 'heat soak.mp3': 0, 'stage one and a half.mp3': 0
    },
    'study': { 'lofi for psets.mp3': 0, 'rain on martel.mp3': 0, 'library at 1am.mp3': 0, 'chamomile steep timer.mp3': 0, 'proofs and consequences.mp3': 0 },
    'karaoke night': { 'the one sophie always picks.mp3': 0, 'the one i always pick.mp3': 0, 'the duet (do not distribute).mp3': 0, 'crowd work practice.mp3': 0 },
    'ure boy theme.mp3': 0,
    'desktop.ini': 0
};

var TREE_VIDS = {
    $: { d: '12/2/2025', j: 200 },
    'Captures': {
        'terraria boss kill.mp4': 0, 'gti run 114 PB.mp4': 0, 'cookie ascension.mp4': 0,
        'urequest heat soak fight.mp4': 0, 'pit lane last lap.mp4': 0
    },
    'argent cold start.mp4': 0,
    'karaoke (deleted scene).mp4': 0
};

var TREE_PROJ = {
    $: { d: '5/30/2026', j: 40 },
    'website': {
        'index.html': 0, 'comp.js': 'you are reading the file that is, at this exact moment, rendering the window you are reading it in.\nplease do not delete it while you are inside it.',
        'comp.css': 0, 'quest.js': 0, 'app.js': 0,
        'todo.txt': 'make the computer feel deeper. folders all the way down.\n(if you are reading this inside the computer: it worked.)'
    }
};

var TREE_D = {
    $: { d: '3/2/2019', j: 900, e: 'Empty. The drive hums anyway.' },
    'archive': {
        'old laptop (2016-2019)': {
            'Documents': {
                '6th grade': { 'my summer vacation.docx': 0, 'book report - hatchet.docx': 0, 'typing practice results.txt': 'WPM: 34\nWPM after practice: 33\ninstructive.' },
                '8th grade': { 'science fair - does music help plants grow.pptx': 0, 'science fair data (real).xlsx': 0, 'science fair data (better).xlsx': 0 },
                'high school': {
                    'AP notes': { 'apush period 5.txt': 0, 'calc bc series tests.txt': 0 },
                    'college apps': { 'essay brainstorm.txt': 'ideas:\n- the car thing? too obvious\n- the DM thing? too niche\n- the cow essay?? too honest\n- something about systems. everything is systems.', 'safety schools.xlsx': 0, 'rice supplement FINAL.docx': 0 }
                }
            },
            'games': {
                'minecraft worlds backup': { 'world2016.zip': 0, 'the good seed.txt': 'seed: 4-1-1-4\nvillage at spawn. do not lose this again.' },
                'roblox': {
                    'idle tycoon place v12.rbxl': 0, 'idle tycoon place v13 REAL.rbxl': 0, 'obby draft.rbxl': 0,
                    'how to script.txt': 'day 1: what is a variable\nday 9: made the button give 2 money instead of 1\nday 30: the tycoon has an economy. i do not fully control it anymore.\nday 31: i understand economics now (i did not, but it planted the flag)'
                }
            },
            'Pictures': { 'phone dump 2017': { 'IMG_0212.jpg': 0, 'IMG_0219.jpg': 0, 'IMG_0244.jpg': 0, 'IMG_0250.jpg': 0, 'IMG_0261.jpg': 0, 'IMG_0299.jpg': 0 } }
        }
    },
    'backups': {
        'ureboy saves': { 'ub_eggs.bak': 0, 'ub_gti_hs.bak': 0 },
        'quest save backup.uqs': 0
    },
    'DO NOT DELETE.zip': {
        'DO NOT OPEN': {
            'final warning.txt': 'you were warned.\n\n— past isaac',
            'ok fine': { 'the secret.txt': 'there was never anything in here.\nthe folder was the friend we made along the way.\n\n(also the good minecraft seed is 4-1-1-4, in case the other note is gone.)' }
        }
    },
    'movies (legal)': { $: { e: 'Nothing to see here. Legally.' } }
};

var TREE_E = {
    $: { d: '4/18/2026', j: 60, e: 'A USB drive with nothing on it? Impossible.' },
    'for school': { 'MTEC major requirements.pdf': 0, 'print this.pdf': 0, 'print this 2.pdf': 0, 'PRINT THIS ONE.pdf': 0 },
    'portable': { '7zip portable.exe': 0, 'vlc portable.exe': 0 },
    'New folder': { 'New folder (2)': { $: { e: 'We have all been here.' } } },
    'resume v1.docx': 0, 'resume v7.docx': 0, 'resume v8 FINAL (use this one).docx': 0,
    'autorun.inf': '[autorun]\n; nothing autoruns anymore. this file is a fossil. respect it.'
};

/* compile a TREE literal into flat FS entries under rootKey.
   Junction values ('>Key') become links; nothing is duplicated. */
var PATHIDX = {};   // lowercase display path (and key) → FS key
function fsIndex(key) {
    var f = FS[key]; if (!f) return;
    PATHIDX[key.toLowerCase()] = key;
    PATHIDX[key.toLowerCase().replace(/\//g, '\\')] = key;   // fsResolve normalizes to backslashes
    if (f.label) PATHIDX[f.label.toLowerCase()] = key;
}
function fsCompile(rootKey, label, node, crumb, meta) {
    meta = { d: (node.$ && node.$.d) || (meta && meta.d) || '6/5/2021', j: (node.$ && node.$.j) || (meta && meta.j) || 30 };
    var items = [];
    FS[rootKey] = { items: items, label: label, crumb: crumb, parent: crumb.length > 1 ? crumb[crumb.length - 2][1] : null, empty: node.$ && node.$.e };
    fsIndex(rootKey);
    Object.keys(node).forEach(function (name) {
        if (name.charAt(0) === '$') return;                              // $ is meta, not a file
        var v = node[name], path = rootKey + '/' + name, it;
        if (v && typeof v === 'object' && !Array.isArray(v)) {           // subfolder (or zip posing as one)
            var zip = /\.zip$/i.test(name);
            it = { n: name, t: zip ? 'zip' : 'folder', go: path };
            if (zip) it.size = fmtKb(EXT_KB.zip[0] + fsHash(path) % (EXT_KB.zip[1] - EXT_KB.zip[0]));
            items.push(it);
            fsCompile(path, label + '\\' + name, v, crumb.concat([[name, path]]), meta);
            return;
        }
        if (typeof v === 'string' && v.charAt(0) === '>') {              // junction to an existing key
            items.push({ n: name, t: 'folder', go: v.slice(1) });
            return;
        }
        var ext = extOf(name), t = EXT_T[ext] || 'file';
        it = { n: name, t: t };
        if (typeof v === 'string' && v.charAt(0) === '@') {              // app launcher
            it.t = ext === 'exe' ? 'exe' : t;
            it.app = v.slice(1);
        } else if (typeof v === 'string') {                              // authored content
            TXT[path] = v; it.cid = path;
        } else if (Array.isArray(v)) {
            if (v[0]) it.size = v[0];
            if (v[1]) it.date = v[1];
            var flags = v[2] ? String(v[2]).split(' ') : [];
            flags.forEach(function (fl) {
                if (fl === 'crit') it.crit = 1;
                else if (fl.indexOf('ph:') === 0) it.ph = +fl.slice(3);
            });
        }
        var h = fsHash(path);
        if (!it.size) { var r = EXT_KB[ext]; it.size = r ? fmtKb(r[0] + h % Math.max(1, r[1] - r[0])) : ((h % 87 + 9) + ' KB'); }
        if (!it.date) {
            var base = meta.d.split('/'), dt = new Date(+base[2], +base[0] - 1, +base[1] + h % Math.max(1, meta.j));
            var hr = 7 + (h >>> 4) % 16, mn = (h >>> 8) % 60;   // unsigned: a signed >> here makes 3:0-48 AM
            it.date = (dt.getMonth() + 1) + '/' + dt.getDate() + '/' + dt.getFullYear() + ' ' + (hr % 12 === 0 ? 12 : hr % 12) + ':' + (mn < 10 ? '0' : '') + mn + (hr < 12 ? ' AM' : ' PM');
        }
        it.cid = it.cid || path;   // filler content is keyed by path too
        items.push(it);
    });
}

// three drives + the user profile hanging off C:
fsCompile('C:', 'C:', TREE_C, [['This PC', 'This PC'], ['Local Disk (C:)', 'C:']]);
fsCompile('D:', 'D:', TREE_D, [['This PC', 'This PC'], ['Data (D:)', 'D:']]);
fsCompile('E:', 'E:', TREE_E, [['This PC', 'This PC'], ['URE DRIVE (E:)', 'E:']]);
fsCompile('C:/Users/isaac', 'C:\\Users\\isaac', TREE_USER, [['This PC', 'This PC'], ['Local Disk (C:)', 'C:'], ['Users', 'C:/Users'], ['isaac', 'C:/Users/isaac']]);
// profile folders keep their legacy keys; junctions from C:\Users\isaac point at them
[['Documents', TREE_DOCS], ['Pictures', TREE_PICS], ['Music', TREE_MUSIC], ['Videos', TREE_VIDS], ['Projects', TREE_PROJ]].forEach(function (pair) {
    var key = pair[0], tree = pair[1];
    var crumb = [['This PC', 'This PC'], ['Local Disk (C:)', 'C:'], ['Users', 'C:/Users'], ['isaac', 'C:/Users/isaac'], [key, key]];
    var keep = FS[key].items;
    fsCompile(key, 'C:\\Users\\isaac\\' + key, tree, crumb);
    // compiled subfolder links replace the hand-authored ones; hand-authored FILES stay
    var compiled = FS[key].items;
    keep.forEach(function (it) { if (!compiled.some(function (c) { return c.n === it.n; })) compiled.push(it); });
});
['Home', 'This PC', 'Desktop', 'Downloads'].forEach(function (k) {
    FS[k].label = FS[k].label || (k === 'Desktop' || k === 'Downloads' ? 'C:\\Users\\isaac\\' + k : k);
    FS[k].crumb = FS[k].crumb || (k === 'Desktop' || k === 'Downloads'
        ? [['This PC', 'This PC'], ['Local Disk (C:)', 'C:'], ['Users', 'C:/Users'], ['isaac', 'C:/Users/isaac'], [k, k]]
        : [[k, k]]);
    FS[k].parent = FS[k].parent || (k === 'Desktop' || k === 'Downloads' ? 'C:/Users/isaac' : null);
    fsIndex(k);
});
// the junctions users will actually type
PATHIDX['~'] = 'Home'; PATHIDX['c:\\'] = 'C:'; PATHIDX['d:\\'] = 'D:'; PATHIDX['e:\\'] = 'E:';
PATHIDX['c:\\users\\isaac\\appdata'] = 'C:/Users/isaac/AppData';
function fsResolve(q) {
    q = String(q || '').trim().replace(/"/g, '').replace(/\//g, '\\');
    if (!q) return null;
    var low = q.toLowerCase().replace(/\\+$/, '') || q.toLowerCase();
    return PATHIDX[low] || PATHIDX[low + '\\'] || null;
}

var fsSt = null;
function fsLoad() {
    if (fsSt) return fsSt;
    try { fsSt = JSON.parse(recall('fs', 'null')) || {}; } catch (e) { fsSt = {}; }
    fsSt.add = fsSt.add || {}; fsSt.gone = fsSt.gone || []; fsSt.bin = fsSt.bin || [];
    return fsSt;
}
function fsSave() { try { store('fs', JSON.stringify(fsSt)); } catch (e) {} }
/* Persisted state can outlive the build that wrote it: a shortcut for an app
   this desktop no longer ships, a file in the bin that opened with one, or a
   dynamic file now shadowed by a factory file of the same name. Drop those
   before anything draws, so nothing on screen points at an app that is gone. */
function fsSanitize() {
    var st = fsLoad(), dirty = false;
    function orphan(it) { return !!(it && it.app && !APPS[it.app]); }
    Object.keys(st.add).forEach(function (p) {
        var base = FS[p] ? FS[p].items : [];
        var keep = st.add[p].filter(function (it) {
            if (orphan(it)) return false;
            return !base.some(function (b) { return b.n === it.n && st.gone.indexOf(p + '/' + b.n) < 0; });
        });
        if (keep.length !== st.add[p].length) { st.add[p] = keep; dirty = true; }
    });
    var bin = st.bin.filter(function (e) { return !orphan(e.it); });
    if (bin.length !== st.bin.length) { st.bin = bin; dirty = true; }
    if (dirty) fsSave();
}
function itemsFor(path) {
    var st = fsLoad(), base = (FS[path] || FS.Home).items;
    return base.filter(function (it) { return (!it.when || it.when()) && st.gone.indexOf(path + '/' + it.n) < 0; }).concat(st.add[path] || []);
}
function fsHas(path, name) { return itemsFor(path).some(function (it) { return it.n === name; }); }
/* Tiles carry both their index and their name. Items can appear in
   itemsFor() between a draw and the next click (a drop, a restore from
   the bin), shifting every index under the rendered tiles — so the NAME
   is the source of truth and the index is only a fast path. Every
   handler that turns a tile back into an item goes through here. */
function tileItem(path, tile) {
    if (!tile) return null;
    var items = itemsFor(path), n = tile.getAttribute('data-n');
    var it = items[+tile.getAttribute('data-i')];
    if (it && (n === null || it.n === n)) return it;
    for (var i = 0; i < items.length; i++) if (items[i].n === n) return items[i];
    return null;
}
function uniqueName(path, name) {
    if (!fsHas(path, name)) return name;
    var dot = name.lastIndexOf('.'), stem = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
    for (var i = 2; ; i++) { var cand = stem + ' (' + i + ')' + ext; if (!fsHas(path, cand)) return cand; }
}
function fsAddFile(path, it) { var st = fsLoad(); (st.add[path] = st.add[path] || []).push(it); fsSave(); refreshFileViews(); return it; }
function fsDelete(path, it) {
    var st = fsLoad(), dyn = (st.add[path] || []).indexOf(it);
    if (dyn >= 0) { st.add[path].splice(dyn, 1); st.bin.push({ it: it, from: path, base: false }); }
    else { st.gone.push(path + '/' + it.n); st.bin.push({ it: it, from: path, base: true }); }
    if (path === 'Desktop') { delete deskLoad()[it.n]; deskSave(); }
    fsSave(); refreshFileViews();
}
function immovable(it) { return !!(it.sys || it.go || it.t === 'folder' || it.t === 'pc' || it.t === 'drive' || it.t === 'usb' || it.t === 'disc'); }
function fsMove(fromPath, it, toPath, cell) {
    if (fromPath === toPath || !FS[toPath]) return null;
    if (itemsFor(fromPath).indexOf(it) < 0) return null;   // stale reference (view changed mid-drag)
    var st = fsLoad();
    var moved = { n: uniqueName(toPath, it.n), t: it.t, app: it.app, arg: it.arg, go: it.go, size: it.size, date: it.date, crit: it.crit, cid: it.cid, ph: it.ph };
    var dyn = (st.add[fromPath] || []).indexOf(it);
    if (dyn >= 0) st.add[fromPath].splice(dyn, 1);
    else st.gone.push(fromPath + '/' + it.n);
    (st.add[toPath] = st.add[toPath] || []).push(moved);
    if (fromPath === 'Desktop') { delete deskLoad()[it.n]; deskSave(); }
    fsSave(); refreshFileViews();
    if (toPath === 'Desktop' && cell) deskDrop(moved.n, cell);
    return moved;
}
function fsRestore(i) {
    var st = fsLoad(), e = st.bin.splice(i, 1)[0]; if (!e) return;
    if (e.base && !fsHas(e.from, e.it.n)) { var k = st.gone.indexOf(e.from + '/' + e.it.n); if (k >= 0) st.gone.splice(k, 1); }
    else {  // dynamic file — or a base file whose name got taken while it sat in the bin.
            // restore a fresh copy (never mutate a base FS object: its tombstone is name-keyed)
        var copy = { n: uniqueName(e.from, e.it.n), t: e.it.t, app: e.it.app, arg: e.it.arg, go: e.it.go, size: e.it.size, date: e.it.date, crit: e.it.crit, cid: e.it.cid, ph: e.it.ph };
        (st.add[e.from] = st.add[e.from] || []).push(copy);
    }
    fsSave();
    refreshFileViews();
}
function fsPurge(i) { var st = fsLoad(); st.bin.splice(i, 1); fsSave(); refreshFileViews(); }
function fsEmptyBin() { fsLoad().bin = []; fsSave(); refreshFileViews(); }
function fsRename(path, it, name) {
    name = String(name || '').trim(); if (!name || name === it.n) return;
    name = uniqueName(path, name);
    var st = fsLoad(), dyn = (st.add[path] || []).indexOf(it), old = it.n;
    if (dyn >= 0) it.n = name;
    else {  // renaming a factory file: retire the original, add a copy under the new name
        st.gone.push(path + '/' + it.n);
        (st.add[path] = st.add[path] || []).push({ n: name, t: it.t, app: it.app, arg: it.arg, go: it.go, size: it.size, date: it.date, crit: it.crit, cid: it.cid, ph: it.ph });
    }
    if (path === 'Desktop') {   // the icon keeps its spot through a rename
        var dp = deskLoad();
        if (dp[old]) { dp[name] = dp[old]; delete dp[old]; deskSave(); }
    }
    fsSave(); refreshFileViews();
}
function refreshFileViews() {
    closeFctx();   // the menu's captured tile may be about to detach
    if (openWins.explorer && exState.explorer && exState.explorer.draw) {
        // never yank an in-progress rename OR a half-typed address bar out from
        // under the user; both redraw themselves when they commit
        if (!openWins.explorer.el.querySelector('.fitem-ren, .exp-addr')) exState.explorer.draw();
    }
    if (openWins.bin) drawBinList(openWins.bin.el);
    renderDesktop();
}
function kindOf(it) {
    if (it.t === 'zip') return KIND.zip;                        // zips navigate like folders but are files
    if (it.go || it.t === 'folder') return KIND[it.t] === undefined || it.t === 'folder' ? 'File folder' : KIND[it.t];
    if (it.sys && !KIND[it.t]) return 'System';
    var ek = EXT_KIND[extOf(it.n)];
    if (ek) return ek;
    if (/\.exe$/i.test(it.n)) return 'Application';
    return KIND[it.t] || 'File';
}
function sizeOf(it) {
    if (it.size) return it.size;
    if (it.t === 'folder' || it.t === 'pc' || it.t === 'drive' || it.t === 'usb' || it.t === 'disc' || it.go || it.sys) return '';
    var h = 0; for (var i = 0; i < it.n.length; i++) h = (h * 31 + it.n.charCodeAt(i)) % 997;
    return (h % 87 + 9) + ' KB';
}
function dateOf(it) { return it.date || 'came with the machine'; }
// deep item count for folder Properties (junction-safe)
function fsCount(key, seen) {
    seen = seen || {};
    if (!FS[key] || seen[key]) return { files: 0, dirs: 0 };
    seen[key] = 1;
    var files = 0, dirs = 0;
    itemsFor(key).forEach(function (it) {
        if (it.go && FS[it.go]) { dirs++; var s = fsCount(it.go, seen); files += s.files; dirs += s.dirs; }
        else files++;
    });
    return { files: files, dirs: dirs };
}

/* —— what's IN the files: authored text, or believable filler —— */
function lcgFor(seed) { var s = seed >>> 0; return function () { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; }; }
function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }
function genIni(name, rnd) {
    var keys = ['enabled', 'verbose', 'retries', 'cache', 'legacy_mode', 'dpi_aware', 'telemetry', 'vibes', 'last_run', 'threads'];
    var out = ['[general]'];
    for (var i = 0; i < 4 + Math.floor(rnd() * 4); i++) out.push(pick(rnd, keys) + '=' + (rnd() < 0.5 ? (rnd() < 0.5 ? 'true' : 'false') : Math.floor(rnd() * 512)));
    out.push('', '[advanced]', '; do not edit below this line', '; (someone edited below this line in 2022 and we are still finding out why)');
    return out.join('\n');
}
function genLog(name, rnd) {
    var lv = ['INFO', 'INFO', 'INFO', 'WARN', 'INFO', 'ERROR', 'INFO'], msg = [
        'service started', 'heartbeat ok', 'cache warm', 'update check: nothing new', 'handle released',
        'retrying (attempt 2)', 'retry worked. no notes.', 'config reloaded', 'scheduled task ran early out of enthusiasm',
        'GPU woke up', 'disk is fine, stop asking', 'session persisted', 'everything nominal'
    ];
    var out = [], mm = Math.floor(rnd() * 50);
    for (var i = 0; i < 9 + Math.floor(rnd() * 8); i++) {
        mm += Math.floor(rnd() * 90);
        out.push('[' + (7 + Math.floor(mm / 60)) % 24 + ':' + ((mm % 60) < 10 ? '0' : '') + mm % 60 + ':' + (10 + Math.floor(rnd() * 49)) + '] ' + pick(rnd, lv) + '  ' + pick(rnd, msg));
    }
    return out.join('\n');
}
function genCode(name, ext, rnd) {
    if (ext === 'css') return '/* ' + name + ' */\n.thing {\n    display: flex;\n    /* TODO: center it. actually center it. */\n    align-items: center;\n    justify-content: center;\n}\n.thing.is-centered { /* it was not */ }';
    if (ext === 'html' || ext === 'htm') return '<!doctype html>\n<!-- ' + name + ' -->\n<title>untitled (keeper)</title>\n<p>if you can read this, the css did not load, and honestly it reads fine.</p>';
    if (ext === 'bat' || ext === 'cmd') return '@echo off\nrem ' + name + '\necho doing the thing...\nrem (there is no thing. there was never a thing.)\npause';
    if (ext === 'json') return '{\n    "name": "' + name.replace(/\.[^.]+$/, '') + '",\n    "version": "0.0.' + Math.floor(rnd() * 90) + '",\n    "honest": true\n}';
    return '// ' + name + '\nfunction main() {\n    // it works. do not touch it.\n    // update ' + (2020 + Math.floor(rnd() * 6)) + ': touched it. it no longer works.\n    // update same day: fixed. DO NOT TOUCH.\n    return true;\n}';
}
function genTxt(name, rnd) {
    var lines = [
        'notes on ' + name.replace(/\.[^.]+$/, '') + ':', '',
        pick(rnd, ['- started strong.', '- premise solid.', '- draft one exists, which is legally a draft.']),
        pick(rnd, ['- middle needs work.', '- middle is missing.', '- middle is two bullet points and a promise.']),
        pick(rnd, ['- ending TBD.', '- ends mid-sen', '- stuck the landing, somehow.'])
    ];
    return lines.join('\n');
}
function binSoup(name, ext) {
    var rnd = lcgFor(fsHash(name)), chars = '▓▒░ÐÏÞþÿ×¤¶§■▪ NUL SOH ƒ†‡ˆ‰';
    var head = '';
    if (ext === 'exe' || ext === 'dll') head = 'MZ░▓▒....¸.....Í!¸.LÍ!This program cannot be run in DOS mode.\r\r\n$';
    else if (ext === 'docx' || ext === 'xlsx' || ext === 'pptx' || ext === 'zip') head = 'PK░▒▓....[Content_Types].xml ¤';
    else if (ext === 'pdf') head = '%PDF-1.7\n%µ¶▓▒\n1 0 obj\n';
    else if (ext === 'png' || ext === 'jpg') head = '‰PNG\r\n░\n....IHDR';
    else if (ext === 'wld' || ext === 'plr') head = 'relogic░▒▓';
    var out = head;
    for (var i = 0; i < 700; i++) {
        out += chars.charAt(Math.floor(rnd() * chars.length));
        if (rnd() < 0.06) out += '\n';
    }
    return out + '\n\n[Notepad has done its best. Notepad would like a different job.]';
}
function contentFor(it) {
    if (it.cid && TXT[it.cid]) return TXT[it.cid];
    var ext = extOf(it.n), rnd = lcgFor(fsHash(it.cid || it.n));
    // trust the extension over it.t: legacy items carry t:'notepad' but a .txt name
    var t = EXT_T[ext] || it.t;
    if (t === 'ini') return genIni(it.n, rnd);
    if (t === 'log') return genLog(it.n, rnd);
    if (t === 'js' || t === 'html' || t === 'css' || t === 'code') return genCode(it.n, ext, rnd);
    if (t === 'txt') return genTxt(it.n, rnd);
    return binSoup(it.cid || it.n, ext);
}

var exState = {};
function renderExplorer(id, arg) {
    return '<div class="exp">' +
        '<div class="exp-nav">' +
          navItem('Home', 'ic-explorer') + navItem('Desktop', 'ic-folder') + navItem('Downloads', 'ic-download') +
          navItem('Documents', 'ic-folder') + navItem('Pictures', 'ic-photos') + navItem('Music', 'ic-audio') +
          navItem('Videos', 'ic-video') + navItem('Projects', 'ic-folder') +
          '<div class="nav-group">This PC</div>' +
          navItem('This PC', 'ic-pc') +
          navItem('Local Disk (C:)', 'ic-drive', 'C:') + navItem('Data (D:)', 'ic-drive', 'D:') + navItem('URE DRIVE (E:)', 'ic-usb', 'E:') +
        '</div>' +
        '<div class="exp-main">' +
          '<div class="exp-bar"><button class="exp-back" data-nav="back" aria-label="Back">‹</button>' +
            '<button class="exp-up" data-nav="up" aria-label="Up one level">↑</button>' +
            '<div class="exp-crumb" id="expCrumb"></div>' +
            '<input class="exp-search" id="expSearch" placeholder="Search" spellcheck="false" autocomplete="off" aria-label="Search this folder">' +
          '</div>' +
          '<div class="exp-grid" id="expGrid"></div>' +
          '<div class="exp-stat" id="expStat"></div>' +
        '</div></div>';
}
function navItem(name, icon, key) { return '<button class="nav-item" data-folder="' + esc(key || name) + '">' + ic(icon) + ' ' + esc(name) + '</button>'; }
function fileTile(it, i) {
    return '<button class="fitem" data-i="' + i + '" data-n="' + esc(it.n) + '">' + ic(FS_ICON[it.t] || 'ic-folder') + '<span class="fitem-n">' + esc(it.n) + '</span></button>';
}
function driveTile(it, i) {
    var free = it.cap ? it.cap[0] : 0, total = it.cap ? it.cap[1] : 1;
    var used = Math.round((total - free) / total * 100);
    return '<button class="fitem fdrive" data-i="' + i + '" data-n="' + esc(it.n) + '">' + ic(FS_ICON[it.t] || 'ic-drive') +
        '<span class="fd-body"><span class="fitem-n">' + esc(it.n) + '</span>' +
        (it.cap ? '<span class="fd-bar"><i style="width:' + used + '%"' + (used > 88 ? ' class="hot"' : '') + '></i></span>' +
        '<span class="fd-free">' + free + ' GB free of ' + total + ' GB</span>' : '<span class="fd-free">No disc inserted</span>') +
        '</span></button>';
}
function initExplorer(el, id, arg) {
    var state = { path: (arg && FS[arg]) ? arg : 'Home', hist: [], filter: '' };
    exState[id] = state;
    var grid = el.querySelector('#expGrid'), crumb = el.querySelector('#expCrumb'), stat = el.querySelector('#expStat'), search = el.querySelector('#expSearch');
    function crumbDraw() {
        var f = FS[state.path] || {}, segs = f.crumb || [[state.path, state.path]];
        crumb.innerHTML = segs.map(function (s, i) {
            return '<button class="crumb-seg' + (i === segs.length - 1 ? ' cur' : '') + '" data-k="' + esc(s[1]) + '" type="button">' + esc(s[0]) + '</button>';
        }).join('<span class="crumb-sep">›</span>');
    }
    function statCount() {   // "N of M items" whenever a filter is hiding something
        var items = itemsFor(state.path), q = state.filter.toLowerCase();
        var shown = !q ? items.length : items.filter(function (it) { return it.n.toLowerCase().indexOf(q) >= 0; }).length;
        var tail = items.length === 1 ? ' item' : ' items';
        return q ? shown + ' of ' + items.length + tail : items.length + tail;
    }
    function draw() {
        var items = itemsFor(state.path), q = state.filter.toLowerCase();
        var view = [];
        items.forEach(function (it, i) { if (!q || it.n.toLowerCase().indexOf(q) >= 0) view.push({ it: it, i: i }); });
        crumbDraw();
        el.querySelectorAll('.nav-item').forEach(function (n) { n.classList.toggle('sel', n.getAttribute('data-folder') === state.path); });
        search.setAttribute('placeholder', 'Search ' + ((FS[state.path] || {}).crumb || [[state.path]]).slice(-1)[0][0]);
        var html = '', lastSect = null;
        view.forEach(function (v) {
            if (v.it.sect && v.it.sect !== lastSect) { html += '<div class="exp-sect">' + esc(v.it.sect) + '</div>'; lastSect = v.it.sect; }
            html += (v.it.t === 'drive' || v.it.t === 'usb' || v.it.t === 'disc') ? driveTile(v.it, v.i) : fileTile(v.it, v.i);
        });
        grid.innerHTML = view.length ? html
            : '<div class="exp-empty">' + esc(q ? 'Nothing here matches "' + state.filter + '".' : (FS[state.path] || {}).empty || 'This folder is empty.') + '</div>';
        stat.textContent = statCount();
    }
    state.draw = draw;
    function go(p) {
        if (p === state.path || !FS[p]) return;
        state.hist.push(state.path); state.path = p;
        state.filter = ''; search.value = '';
        draw();
    }
    state.go = function (p) { if (FS[p] && p !== state.path) { state.hist.push(state.path); state.path = p; state.filter = ''; search.value = ''; } draw(); };
    function openItem(it) { openItemFrom(it, go); }
    el._nav = {                                                   // Alt+Left / Alt+Up
        back: function () { if (state.hist.length) { state.path = state.hist.pop(); state.filter = ''; search.value = ''; draw(); } },
        up: function () { var p = (FS[state.path] || {}).parent; if (p) go(p); else if (state.path !== 'This PC' && state.path !== 'Home') go('This PC'); }
    };
    function addrMode() {
        var f = FS[state.path] || {}, done = false;
        crumb.innerHTML = '<input class="exp-addr" type="text" spellcheck="false" autocomplete="off" aria-label="Address">';
        var inp = crumb.firstChild; inp.value = f.label || state.path;
        function commit(navigate) {
            if (done) return; done = true;
            var v = inp.value;
            if (!navigate) { crumbDraw(); return; }
            var k = fsResolve(v);
            if (k) { crumbDraw(); go(k); }
            else {
                crumbDraw();
                dlgError('Windows can’t find “' + v + '”', 'Check the spelling and try again. Or type C:\\ and wander. Wandering works.');
            }
        }
        inp.addEventListener('keydown', function (e) {
            e.stopPropagation();
            if (e.key === 'Enter') commit(true);
            else if (e.key === 'Escape') commit(false);
        });
        inp.addEventListener('blur', function () { commit(false); });
        inp.addEventListener('click', function (e) { e.stopPropagation(); });
        inp.focus(); inp.select();
    }
    el.querySelector('.exp-nav').addEventListener('click', function (e) { var b = e.target.closest('.nav-item'); if (b) go(b.getAttribute('data-folder')); });
    el.querySelector('.exp-bar').addEventListener('click', function (e) {
        var seg = e.target.closest('.crumb-seg');
        if (seg) { if (!seg.classList.contains('cur')) go(seg.getAttribute('data-k')); return; }
        if (e.target === crumb) { addrMode(); return; }           // the blank strip is the address bar
        var b = e.target.closest('[data-nav]'); if (!b) return;
        if (b.getAttribute('data-nav') === 'back') el._nav.back();
        else el._nav.up();
    });
    search.addEventListener('input', function () { state.filter = search.value.trim(); draw(); });
    search.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') { search.value = ''; state.filter = ''; draw(); } });
    grid.addEventListener('dblclick', function (e) {
        var b = e.target.closest('.fitem'); if (!b) return;
        openItem(tileItem(state.path, b));
    });
    grid.addEventListener('click', function (e) {
        var b = e.target.closest('.fitem');
        grid.querySelectorAll('.fitem.sel').forEach(function (x) { x.classList.remove('sel'); });
        if (!b) { stat.textContent = statCount(); return; }
        b.classList.add('sel');
        var it = tileItem(state.path, b);
        stat.textContent = it ? statCount() + '  ·  ' + it.n + (sizeOf(it) ? '  ·  ' + sizeOf(it) : '') + '  ·  ' + kindOf(it) : statCount();
    });
    grid.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var b = e.target.closest('.fitem'); if (!b) { closeFctx(); return; }
        grid.querySelectorAll('.fitem.sel').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel');
        var it = tileItem(state.path, b); if (!it) return;
        openFctx(e, { path: state.path, it: it, tile: b, open: function () { openItem(it); }, redraw: draw });
    });
    draw();
}

/* —— opening things: one dispatcher for Explorer, the desktop and the shell ——
   goFn navigates within an existing Explorer; without one, folders open
   a fresh Explorer window at that path. */
function openItemFrom(it, goFn) {
    if (!it) return;
    if (it.app) {
        if (it.app.charAt(0) === '!') { openBang(it.app.slice(1)); return; }
        openApp(it.app, it.arg); return;
    }
    if (it.go) { if (goFn) goFn(it.go); else openApp('explorer', it.go); return; }
    openFileByType(it);
}
function openBang(name) {
    if (name === 'taskview') openTaskView();
    else if (name === 'ie') dlgError('Internet Explorer', 'This machine has suffered enough.');
}
function openFileByType(it) {
    var t = it.t;
    if (t === 'txt' || t === 'ini' || t === 'log' || t === 'js' || t === 'html' || t === 'css' || t === 'code')
        openApp('notepad', { file: { n: it.n, body: contentFor(it) } });
    else if (t === 'pdf') openApp('reader', { n: it.n });
    else if (t === 'img') openApp('photos', it.ph != null ? it.ph : fsHash(it.cid || it.n) % PHOTOS.length);
    else if (t === 'audio' || t === 'video') openApp('player', { n: it.n, cid: it.cid, video: t === 'video' });
    else if (t === 'font') dlgFont(it);
    else if (t === 'exe') dlgError('This app can’t run on your PC', 'To find a version for your PC, check with the software publisher. They will also be confused.');
    else if (t === 'disc') dlgError('Insert a disc', 'The tray is decorative. It has always been decorative.');
    else dlgOpenWith(it);                                        // doc/xls/ppt/dll/sys/sav/dat and friends
}
function dlgOpenWith(it) {
    var rows =
        '<button class="dlg-owrow" data-ow="notepad" type="button">' + ic('ic-notepad') + '<span><b>Notepad</b><i>It will try. It will really try.</i></span></button>' +
        '<button class="dlg-owrow" data-ow="photos" type="button">' + ic('ic-photos') + '<span><b>Photos</b><i>Optimistic.</i></span></button>' +
        '<button class="dlg-owrow" data-ow="store" type="button">' + ic('ic-win') + '<span><b>Look for an app in the Microsoft Store</b><i>Do not do this.</i></span></button>';
    var close = dlgOpen('How do you want to open “' + it.n + '”?', '<div class="dlg-ow">' + rows + '</div>', [['Cancel', '']]);
    var veil = document.body.lastElementChild;                    // dlgOpen appended it a moment ago
    if (veil && veil.classList.contains('dlg-veil')) veil.addEventListener('click', function (e) {
        var b = e.target.closest('[data-ow]'); if (!b) return;
        var how = b.getAttribute('data-ow'); close();
        if (how === 'notepad') openApp('notepad', { file: { n: it.n, body: contentFor(it) } });
        else if (how === 'photos') dlgError('Photos', 'Photos gave it a look. It’s not a picture. It was never a picture.');
        else dlgError('Microsoft Store', 'The Store has reviewed your request and would prefer not to be involved.');
    });
}
function dlgFont(it) {
    var stem = it.n.replace(/\.[^.]+$/, '');
    // single quotes: this goes inside a double-quoted style attribute
    var fam = /press start/i.test(stem) ? "'Press Start 2P', monospace"
        : /vt323/i.test(stem) ? "'VT323', monospace"
        : /silkscreen/i.test(stem) ? "'Silkscreen', monospace" : null;
    var note = fam ? 'This one actually renders. It’s one of the three fonts this entire website is built from.'
        : /comic sans/i.test(stem) ? 'Not installed on this machine. Some doors we keep closed.'
        : /papyrus/i.test(stem) ? 'Not installed. The avatar of fonts.'
        : /wingdings/i.test(stem) ? 'Installed, allegedly. Every preview renders as a duck, an envelope and a bomb.'
        : 'The pixels for this font are stored somewhere very safe.';
    var sample = 'The quick silver GTI jumps the sleeping policeman. 0123456789';
    var body = '<div class="dlg-font">' +
        '<p class="df-name">' + esc(stem) + '</p>' +
        (fam ? '<p class="df-s1" style="font-family:' + fam + '">' + esc(sample) + '</p>' +
               '<p class="df-s2" style="font-family:' + fam + '">' + esc(sample) + '</p>' +
               '<p class="df-s3" style="font-family:' + fam + '">AaBbCcDd</p>'
             : '<p class="df-none">Aa?</p>') +
        '<p class="df-note">' + esc(note) + '</p></div>';
    dlgOpen(it.n, body, [['OK', 'primary']]);
}

/* —— file right-click menu (shared by Explorer windows) —— */
var fctx = null, fctxT = null;
function closeFctx() { if (fctx) fctx.hidden = true; fctxT = null; }
function openFctx(e, t) {
    setStart(false); closeFlyouts(); closeCtx(); closeBctx();
    if (!fctx) {
        fctx = document.createElement('div');
        fctx.className = 'ctx px-sm lift'; fctx.id = 'fctx'; fctx.setAttribute('role', 'menu');
        fctx.innerHTML =
            '<button class="ctx-item" data-fact="open" role="menuitem" type="button"><span class="ctx-glyph">↗</span> Open</button>' +
            '<button class="ctx-item" data-fact="rename" role="menuitem" type="button"><span class="ctx-glyph">✎</span> Rename</button>' +
            '<button class="ctx-item" data-fact="delete" role="menuitem" type="button">' + ic('ic-bin') + ' Delete</button>' +
            '<div class="ctx-sep"></div>' +
            '<button class="ctx-item" data-fact="props" role="menuitem" type="button"><span class="ctx-glyph">ℹ</span> Properties</button>';
        byId('screen').appendChild(fctx);
        fctx.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var b = ev.target.closest('[data-fact]'); if (!b || !fctxT) return;
            var act = b.getAttribute('data-fact'), t2 = fctxT; closeFctx();
            if (act === 'open') t2.open();
            else if (act === 'rename') startRename(t2);
            else if (act === 'delete') deleteItem(t2);
            else if (act === 'props') dlgProps(t2.path, t2.it);
        });
    }
    fctxT = t; fctx.hidden = false;
    fctx.style.left = clamp(e.clientX, 6, window.innerWidth - 220) + 'px';
    fctx.style.top = clamp(e.clientY, 6, window.innerHeight - 190) + 'px';
}
function deleteItem(t) {
    var it = t.it;
    if (it.crit) {                                   // Windows needs this one. Windows will PROVE it.
        dlgConfirm('You need permission from UreOS to delete this file',
            it.n + ' is currently in use by Windows. By all of Windows. Right now.',
            'Delete anyway', function () {
                dlgConfirm('No, really', 'This is a load-bearing file. The operating system is standing on it as we speak.',
                    'I understand what I’m doing', function () { bsod(it.n); });
            });
        return;
    }
    if (it.sys) {
        dlgError('Can’t delete “' + it.n + '”', 'That one is part of the machine. The machine would notice.');
        return;
    }
    if (it.t === 'folder' || it.t === 'pc' || it.go) {
        dlgError('Can’t delete “' + it.n + '”', 'UreOS is quite attached to this folder. All of the folders, actually. Try a file.');
        return;
    }
    if (itemsFor(t.path).indexOf(it) < 0) return;   // stale reference (view changed since capture)
    fsDelete(t.path, it);
}
function startRename(t) {
    if (t.it.sys) { dlgError('Can’t rename “' + t.it.n + '”', 'The machine gets confused when its parts change names.'); return; }
    if (t.it.crit) { dlgError('File in use', 'This file is open in System. It is always open in System. Renaming it would be a whole thing.'); return; }
    var lab = t.tile.querySelector('.fitem-n'); if (!lab) return;
    var old = t.it.n, done = false;
    lab.innerHTML = '<input class="fitem-ren" type="text" aria-label="New name">';
    var inp = lab.firstChild; inp.value = old;
    function commit(save) {
        if (done) return; done = true;
        var v = inp.value;
        lab.textContent = old;   // drop the input first — redraws are suppressed while it exists
        if (save) fsRename(t.path, t.it, v);
        t.redraw();
    }
    inp.addEventListener('keydown', function (e) {
        e.stopPropagation();
        if (e.key === 'Enter') commit(true);
        else if (e.key === 'Escape') commit(false);
    });
    inp.addEventListener('blur', function () { commit(true); });
    inp.addEventListener('click', function (e) { e.stopPropagation(); });
    inp.addEventListener('dblclick', function (e) { e.stopPropagation(); });
    inp.focus();
    var dot = old.lastIndexOf('.');
    inp.setSelectionRange(0, dot > 0 ? dot : old.length);
}

/* —— modal dialogs: error / confirm / info / properties ——
   Small OS-style dialogs on a dimming veil. Esc or the X cancels;
   buttons run their callback after closing. Stacked veils are fine. */
var dlgs = [];
function dlgOpen(title, bodyHtml, buttons) {
    var opener = document.activeElement;   // give focus back when we're done
    var veil = document.createElement('div'); veil.className = 'dlg-veil';
    // A modal has to cover everything, and ++zTop did not: it starts at 20, so
    // the veil sat under the taskbar, and it would sit under a full-screen
    // window's raised layer too — an invisible modal nothing can dismiss.
    veil.style.zIndex = 1200 + dlgs.length;
    veil.innerHTML = '<div class="dlg px-lg lift" role="alertdialog" aria-modal="true" aria-label="' + esc(title) + '">' +
        '<header class="dlg-bar"><span>' + esc(title) + '</span>' +
          '<button class="cap close dlg-x" type="button" aria-label="Close"><svg viewBox="0 0 10 10"><path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" stroke-width="1.2"/></svg></button></header>' +
        '<div class="dlg-body">' + bodyHtml + '</div>' +
        '<footer class="dlg-foot">' + buttons.map(function (b, i) {
            return '<button class="dlg-btn' + (b[1] ? ' ' + b[1] : '') + '" data-di="' + i + '" type="button">' + esc(b[0]) + '</button>';
        }).join('') + '</footer></div>';
    document.body.appendChild(veil);
    function close() {
        var k = dlgs.indexOf(close); if (k >= 0) dlgs.splice(k, 1);
        veil.remove();
        if (opener && opener.focus && document.contains(opener)) opener.focus();
    }
    veil.addEventListener('click', function (e) {
        e.stopPropagation();
        if (e.target.closest('.dlg-x')) { close(); return; }
        var b = e.target.closest('[data-di]'); if (!b) return;
        var def = buttons[+b.getAttribute('data-di')];
        close(); if (def && def[2]) def[2]();
    });
    veil.addEventListener('keydown', function (e) {   // keep Tab inside the dialog
        if (e.key !== 'Tab') return;
        e.preventDefault();
        var f = Array.prototype.filter.call(veil.querySelectorAll('button, input'), function (x) { return !x.disabled; });
        if (!f.length) return;
        var i = f.indexOf(document.activeElement);
        f[e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i < 0 || i === f.length - 1 ? 0 : i + 1)].focus();
    });
    dlgs.push(close);
    var first = veil.querySelector('.dlg-btn.primary') || veil.querySelector('.dlg-btn');
    if (first) setTimeout(function () { first.focus(); }, 20);
    return close;
}
function closeTopDlg() { if (!dlgs.length) return false; dlgs[dlgs.length - 1](); return true; }
function dlgMsg(kind, mark, title, msg, buttons) {
    return dlgOpen(title, '<div class="dlg-msg"><span class="dlg-badge ' + kind + '">' + mark + '</span><p>' + esc(msg) + '</p></div>', buttons);
}
function dlgError(title, msg) { dlgMsg('err', '✕', title, msg, [['OK', 'primary']]); }
function dlgInfo(title, msg) { dlgMsg('info', 'i', title, msg, [['OK', 'primary']]); }
function dlgConfirm(title, msg, yes, cb) { dlgMsg('warn', '!', title, msg, [[yes, 'primary', cb], ['Cancel', '']]); }
function dlgProps(path, it) {
    // location is a real path, not the display label — Home's label is "Home" but it lives at C:\Users\isaac
    var loc = path === 'Home' ? 'C:\\Users\\isaac'
        : path === 'This PC' ? 'This PC'
        : (FS[path] || {}).label || ('C:\\Users\\isaac\\' + path);
    var rows = [['Name', it.n], ['Type', kindOf(it)], ['Location', loc]];
    var h = fsHash(it.cid || it.n);
    if ((it.t === 'drive' || it.t === 'usb') && it.cap) rows.push(['Free space', it.cap[0] + ' GB of ' + it.cap[1] + ' GB']);
    else if (it.go && FS[it.go]) { var c = fsCount(it.go); rows.push(['Contains', c.files + ' files, ' + c.dirs + ' folders']); }
    else rows.push(['Size', sizeOf(it) || '—']);
    if (it.t === 'audio' || it.t === 'video') rows.push(['Length', plFmt(mediaLen(it))]);   // same source as the player's clock
    if (it.t === 'img') rows.push(['Dimensions', '160 × 144 (everything here is, if you zoom out enough)']);
    if (it.t === 'font') rows.push(['Font family', it.n.replace(/\.[^.]+$/, '')]);
    if (it.crit) rows.push(['Status', 'Protected. Aggressively.']);
    rows.push(['Created', dateOf(it)], ['Owner', 'isaac (obviously)']);
    dlgOpen(it.n + ' Properties',
        '<div class="dlg-props"><span class="dlg-pic">' + ic(FS_ICON[it.t] || 'ic-folder') + '</span>' +
        '<dl class="specs">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl></div>' +
        '<label class="dlg-check"><input type="checkbox" disabled> Read-only</label><label class="dlg-check"><input type="checkbox" disabled> Hidden</label>',
        [['OK', 'primary']]);
}

/* ═══════════════ desktop: a folder you can see ═══════════════
   Desktop icons render straight from the 'Desktop' FS folder onto a
   snap grid (column-major, like Windows). Positions persist in
   comp_desk keyed by name; anything without a spot auto-flows into
   the first free cell. Rearranging is just drag & drop below. */
var DESK_CW = 92, DESK_CH = 100, DESK_PAD = 8;
var deskPos = null;
function deskLoad() {
    if (!deskPos) {
        // null-prototype: positions are keyed by user-controlled names ("__proto__" is a fine filename)
        deskPos = Object.create(null);
        try {
            var raw = JSON.parse(recall('desk', 'null')) || {};
            Object.keys(raw).forEach(function (k) { deskPos[k] = raw[k]; });
        } catch (e) {}
    }
    return deskPos;
}
function deskSave() { try { store('desk', JSON.stringify(deskPos)); } catch (e) {} }
function deskDims() {
    return {
        cols: Math.max(1, Math.floor((window.innerWidth - DESK_PAD * 2) / DESK_CW)),
        rows: Math.max(1, Math.floor((window.innerHeight - barSpace() - DESK_PAD * 2) / DESK_CH))
    };
}
function deskLayout() {
    var items = itemsFor('Desktop'), pos = deskLoad(), dims = deskDims(), used = {}, list = [];
    items.forEach(function (it) {   // stored spots first (valid + unclaimed only)
        var p = pos[it.n];
        if (!(p && p[0] >= 0 && p[0] < dims.cols && p[1] >= 0 && p[1] < dims.rows && !used[p[0] + ',' + p[1]])) p = null;
        if (p) used[p[0] + ',' + p[1]] = 1;
        list.push({ it: it, cell: p });
    });
    list.forEach(function (o) {     // everyone else flows column-major
        if (o.cell) return;
        for (var c = 0; c < dims.cols; c++) for (var r = 0; r < dims.rows; r++) {
            if (!used[c + ',' + r]) { used[c + ',' + r] = 1; o.cell = [c, r]; return; }
        }
        o.cell = [0, 0];
    });
    return { list: list, used: used, dims: dims };
}
function renderDesktop() {
    var desk = byId('desktop'); if (!desk) return;
    if (desk.querySelector('.fitem-ren')) return;   // don't yank a desktop rename mid-edit
    // remember selection + focus across the rebuild (rebuilds happen on every FS change)
    var selN = null, focN = null;
    var oldSel = desk.querySelector('.dicon.sel'), oldFoc = document.activeElement;
    if (oldSel) selN = (oldSel.querySelector('.fitem-n') || {}).textContent || null;
    if (oldFoc && oldFoc.classList && oldFoc.classList.contains('dicon') && desk.contains(oldFoc))
        focN = (oldFoc.querySelector('.fitem-n') || {}).textContent || null;
    desk.innerHTML = deskLayout().list.map(function (o, i) {
        return '<button class="dicon" data-i="' + i + '" data-n="' + esc(o.it.n) + '" type="button" style="left:' + (DESK_PAD + o.cell[0] * DESK_CW) + 'px;top:' + (DESK_PAD + o.cell[1] * DESK_CH) + 'px">' +
            '<span class="dicon-img">' + ic(FS_ICON[o.it.t] || 'ic-folder') + '</span>' +
            '<span class="dicon-label fitem-n">' + esc(o.it.n) + '</span></button>';
    }).join('');
    if (selN || focN) desk.querySelectorAll('.dicon').forEach(function (b) {
        var n = (b.querySelector('.fitem-n') || {}).textContent;
        if (n === selN) b.classList.add('sel');
        if (n === focN) b.focus();
    });
}
function deskCellAt(x, y) {
    var dims = deskDims();
    return [clamp(Math.floor((x - DESK_PAD) / DESK_CW), 0, dims.cols - 1), clamp(Math.floor((y - DESK_PAD) / DESK_CH), 0, dims.rows - 1)];
}
function deskDrop(name, cell) {   // claim a cell; if it's taken, walk column-major to the next free one
    var lay = deskLayout();
    lay.list.forEach(function (o) { if (o.it.n === name && o.cell) delete lay.used[o.cell[0] + ',' + o.cell[1]]; });
    if (lay.used[cell[0] + ',' + cell[1]]) {
        var found = null, c, r;
        for (c = cell[0]; c < lay.dims.cols && !found; c++) {
            for (r = (c === cell[0] ? cell[1] : 0); r < lay.dims.rows; r++) if (!lay.used[c + ',' + r]) { found = [c, r]; break; }
        }
        for (c = 0; c < lay.dims.cols && !found; c++) {
            for (r = 0; r < lay.dims.rows; r++) if (!lay.used[c + ',' + r]) { found = [c, r]; break; }
        }
        cell = found || cell;
    }
    deskLoad()[name] = cell; deskSave(); renderDesktop();
}

/* ═════════════ drag & drop: files really move ═════════════
   Pointer-driven (no HTML5 DnD): press an icon or Explorer file,
   move past a threshold and a ghost lifts off. Drop targets are the
   desktop grid, Explorer folders (tiles, sidebar, or the open grid),
   and the Recycle Bin (icon or window) — which deletes. System
   icons only reposition; folders stay put. Click/dblclick survive
   because nothing happens until the pointer actually travels. */
var dnd = { cand: null, on: false, ghost: null, hint: null, over: null, ox: 0, oy: 0 };
function exPath() { return (openWins.explorer && exState.explorer) ? exState.explorer.path : null; }
function dndClearHint() { if (dnd.hint) { dnd.hint.classList.remove('drop-hint', 'drop-del'); dnd.hint = null; } }
document.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || dnd.on || dnd.cand) return;   // one pointer owns a drag at a time
    if (e.target.closest('.fitem-ren')) return;   // typing a name, not dragging
    var tile = e.target.closest('#desktop .dicon, .exp-grid .fitem'); if (!tile) return;
    var from = tile.classList.contains('dicon') ? 'Desktop' : exPath();
    if (!from) return;
    if (from !== 'Desktop' && e.pointerType === 'touch') return;   // keep touch scrolling inside Explorer
    var it = tileItem(from, tile); if (!it) return;
    dnd.cand = { id: e.pointerId, x: e.clientX, y: e.clientY, tile: tile, it: it, from: from };
});
window.addEventListener('pointermove', function (e) {
    if (!dnd.cand || e.pointerId !== dnd.cand.id) return;   // only the owning pointer drives the drag
    if (dnd.on && e.pointerType === 'mouse' && e.buttons === 0) { dndAbort(); dnd.cand = null; return; }   // lost pointerup (alt-tab): self-heal
    if (!dnd.on) {
        if (Math.abs(e.clientX - dnd.cand.x) + Math.abs(e.clientY - dnd.cand.y) < 7) return;
        dndBegin(e);
    }
    if (dnd.on) dndTrack(e);
});
window.addEventListener('pointerup', function (e) {
    if (!dnd.cand || e.pointerId !== dnd.cand.id) return;
    if (dnd.on) dndDrop(e);
    dnd.cand = null;
});
window.addEventListener('pointercancel', function (e) {
    if (!dnd.cand || e.pointerId !== dnd.cand.id) return;
    dndAbort(); dnd.cand = null;
});
window.addEventListener('blur', function () { dndAbort(); dnd.cand = null; });   // never carry a drag across focus loss
function dndBegin(e) {
    var c = dnd.cand;
    if (!c.tile.isConnected) { dnd.cand = null; return; }   // a re-render detached the tile mid-press
    var r = c.tile.getBoundingClientRect();
    dnd.on = true; dnd.ox = c.x - r.left; dnd.oy = c.y - r.top;
    var g = c.tile.cloneNode(true);
    g.classList.add('dnd-ghost'); g.removeAttribute('data-i');
    g.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;';
    document.body.appendChild(g);
    dnd.ghost = g;
    c.tile.classList.add('drag-src');
    document.body.classList.add('dnd');
    dndTrack(e);
}
function dndTrack(e) {
    dnd.ghost.style.left = (e.clientX - dnd.ox) + 'px';
    dnd.ghost.style.top = (e.clientY - dnd.oy) + 'px';
    dndClearHint();
    dnd.over = dndTarget(e.clientX, e.clientY);
    if (dnd.over && dnd.over.el) {
        dnd.over.el.classList.add('drop-hint');
        if (dnd.over.kind === 'bin') dnd.over.el.classList.add('drop-del');
        dnd.hint = dnd.over.el;
    }
}
function dndTarget(x, y) {
    var el = document.elementFromPoint(x, y); if (!el) return null;
    var fit = el.closest('.exp-grid .fitem');   // a folder tile inside Explorer
    if (fit) {
        var fi = tileItem(exPath(), fit);
        if (fi && fi.go && FS[fi.go]) return { kind: 'folder', path: fi.go, el: fit };
    }
    var nav = el.closest('.exp-nav .nav-item');
    if (nav) { var p = nav.getAttribute('data-folder'); if (FS[p]) return { kind: 'folder', path: p, el: nav }; }
    var dic = el.closest('#desktop .dicon');
    if (dic) {
        var di = tileItem('Desktop', dic);
        if (di && di.app === 'bin' && (!dnd.cand || di !== dnd.cand.it)) return { kind: 'bin', el: dic };   // the bin can't eat itself
        return { kind: 'desk' };   // dropping on a non-bin icon = that spot on the desktop
    }
    if (el.closest('#binBody')) return { kind: 'bin', el: el.closest('#binBody') };
    if (el.closest('.exp-grid')) { var p2 = exPath(); return p2 ? { kind: 'folder', path: p2, el: null } : null; }
    if (el.closest('#desktop')) return { kind: 'desk' };
    return null;
}
function dndDrop(e) {
    var c = dnd.cand;
    dndAbort();
    if (!c) return;
    var t = dndTarget(e.clientX, e.clientY);   // re-resolve at release: the view may have scrolled/navigated mid-drag
    if (!t) return;
    var it = c.it, from = c.from;
    if (t.kind === 'desk') {
        var cell = deskCellAt(e.clientX, e.clientY);
        if (from === 'Desktop') { if (itemsFor('Desktop').indexOf(it) >= 0) deskDrop(it.n, cell); }
        else if (immovable(it)) dlgError('Can’t move “' + it.n + '”', 'UreOS keeps its furniture where it can see it.');
        else fsMove(from, it, 'Desktop', cell);
    } else if (t.kind === 'folder') {
        if (t.path === from) return;
        if (immovable(it)) dlgError('Can’t move “' + it.n + '”', it.sys ? 'That one is bolted to the desktop.' : 'Folders live where UreOS put them.');
        else fsMove(from, it, t.path);
    } else if (t.kind === 'bin') {
        deleteItem({ path: from, it: it });
    }
}
function dndAbort() {
    dndClearHint();
    if (dnd.ghost) { dnd.ghost.remove(); dnd.ghost = null; }
    if (dnd.cand && dnd.cand.tile) dnd.cand.tile.classList.remove('drag-src');
    document.body.classList.remove('dnd');
    dnd.on = false; dnd.over = null;
}

/* —— Notepad —— */
function renderNotepad() {
    return '<div class="np">' +
        '<div class="np-menu"><span>File</span><span>Edit</span><span>Format</span><span>View</span><span>Help</span></div>' +
        '<div class="np-wrap"><div class="np-back" aria-hidden="true"></div>' +
        '<textarea class="np-text" spellcheck="false" placeholder="Start typing. It saves itself."></textarea></div>' +
        '<div class="np-status"><span class="np-loc">Ln 1, Col 1</span><span class="np-save">UTF-8 · UreOS</span></div></div>';
}
function initNotepad(el, id, arg) {
    var ta = el.querySelector('.np-text'), loc = el.querySelector('.np-loc');
    var back = el.querySelector('.np-back'), save = el.querySelector('.np-save');
    var title = el.querySelector('.win-title');
    el._npFile = null;   // when set, Notepad is viewing a file from the FS, not the scratchpad
    function upd(e) {
        if (!el._npFile) store('notepad', ta.value);   // the scratchpad saves itself; files keep their dignity
        var pre = ta.value.slice(0, ta.selectionStart).split('\n');
        loc.textContent = 'Ln ' + pre.length + ', Col ' + (pre[pre.length - 1].length + 1);
        // only real text changes rebuild highlights, and they keep the current match (no scroll yank)
        if (e && e.type === 'input' && find.appId === 'notepad' && findOpenNow()) runFind(true);
    }
    el._npOpen = function (a) {
        if (a && a.file) {
            el._npFile = a.file;
            ta.value = a.file.body || '';
            if (title) title.textContent = a.file.n + ' — Notepad';
            save.textContent = 'UTF-8 · read from disk';
        } else {                                       // plain launch: back to the scratchpad
            el._npFile = null;
            ta.value = recall('notepad', '');
            if (title) title.textContent = 'Untitled — Notepad';
            save.textContent = 'UTF-8 · UreOS';
        }
        ta.scrollTop = 0;
        upd();
        if (find.appId === 'notepad' && findOpenNow()) runFind(true);
    };
    el._npOpen(arg);
    ta.addEventListener('input', upd); ta.addEventListener('keyup', upd); ta.addEventListener('click', upd);
    ta.addEventListener('scroll', function () { back.scrollTop = ta.scrollTop; });
    if (window.ResizeObserver) {                                    // maximize/restore re-pins the mirror
        new ResizeObserver(function () {
            if (find.appId === 'notepad' && findOpenNow()) runFind(true);
        }).observe(ta);
    }
    el._flash = function () {                                       // Alt+S: it already saved itself
        save.textContent = el._npFile ? '✓ Not saved (edit all you want, the disk isn’t listening)' : '✓ Saved (it always is)';
        clearTimeout(el._flashT);
        el._flashT = setTimeout(function () { save.textContent = el._npFile ? 'UTF-8 · read from disk' : 'UTF-8 · UreOS'; }, 1400);
    };
    setTimeout(function () { ta.focus(); }, 30);   // focus isn't motion — place it under reduced-motion too
}

/* —— Terminal —— */
var TERM_BANNER = "UreOS 11 [Pixel Edition]  ·  type 'help' to get around.";
function renderTerminal() {
    return '<div class="term" id="term">' +
        '<div class="term-out"></div>' +
        '<div class="term-line"><span class="term-prompt">isaac@ure</span>:<span class="term-path">~</span>$ ' +
        '<input class="term-in" autocomplete="off" spellcheck="false" aria-label="Terminal input"></div></div>';
}
function initTerminal(el) {
    var term = el.querySelector('.term'), out = el.querySelector('.term-out'), inp = el.querySelector('.term-in');
    var pathEl = el.querySelector('.term-path'), cwd = 'Home';
    function print(html, cls) { var d = document.createElement('div'); d.className = 'term-row' + (cls ? ' ' + cls : ''); d.innerHTML = html; out.appendChild(d); term.scrollTop = term.scrollHeight; }
    function pathLabel() { return cwd === 'Home' ? '~' : (FS[cwd] || {}).label || cwd; }
    function setCwd(k) { cwd = k; if (pathEl) pathEl.textContent = pathLabel(); }
    function findHere(name) {
        var low = String(name || '').replace(/^"|"$/g, '').toLowerCase();   // `cd "My Games"` works too
        var hit = null;
        itemsFor(cwd).forEach(function (it) { if (!hit && it.n.toLowerCase() === low) hit = it; });
        return hit;
    }
    // a child of the current folder wins over a same-named global key, so
    // `cd Documents` inside D:\archive\...\ enters the LOCAL Documents
    function localThenGlobal(a) { var hit = findHere(a); return (hit && hit.go) ? hit.go : fsResolve(a); }
    print(esc(TERM_BANNER), 't-dim');
    var CMDS = {
        help: function () {
            print('commands: <b>help about whoami date echo neofetch gti socials keys clear exit</b>');
            print('files:    <b>ls · dir · cd <i>path</i> · type <i>file</i> · tree · pwd · open <i>thing</i></b>');
            print('paths work like you hope: <b>cd C:\\Windows\\System32</b> · <b>cd ..</b> · <b>cd ~</b>', 't-dim');
        },
        keys: function () {
            print('<b>Alt is this OS\'s Ctrl.</b> Alt+/ shows the full map. Highlights:');
            print('Alt+F find in app · Alt+E explorer · Alt+T/W chrome tabs · Alt+` cycle windows · Alt+L clears me');
        },
        about: function () { print(esc(ME.bio)); },
        whoami: function () { print('isaac'); },
        pwd: function () { print(esc(pathLabel())); },
        ls: function () { CMDS.dir(); },
        dir: function (a) {
            var key = a ? localThenGlobal(a) : cwd;
            if (!key || !FS[key]) { print('The system cannot find the path specified.', 't-err'); return; }
            var items = itemsFor(key), rows = [' Directory of ' + ((FS[key] || {}).label || key), ''];
            items.forEach(function (it) {
                var isDir = !!(it.go || it.t === 'folder');
                rows.push((isDir ? '   <DIR>       ' : ('   ' + (sizeOf(it) || '—') + Array(Math.max(1, 12 - String(sizeOf(it) || '—').length)).join(' '))) + ' ' + it.n);
            });
            rows.push('', '   ' + items.length + ' item(s). they are all load-bearing.');
            print('<pre class="t-neo">' + esc(rows.join('\n')) + '</pre>');
        },
        cd: function (a) {
            if (!a || a === '~') { setCwd('Home'); return; }
            if (a === '..') {
                var p = (FS[cwd] || {}).parent;
                if (p) setCwd(p); else print('you are already as up as it gets.', 't-err');
                return;
            }
            var key = localThenGlobal(a);
            if (key && FS[key]) setCwd(key);
            else print('The system cannot find the path specified: ' + esc(a), 't-err');
        },
        type: function (a) {
            if (!a) { print('type what? try: type readme.txt', 't-err'); return; }
            var it = findHere(a);
            if (!it) { print('The system cannot find the file specified.', 't-err'); return; }
            if (it.go || it.t === 'folder') { print('Access is denied.', 't-err'); return; }
            var body = contentFor(it);
            if (body.length > 1600) body = body.slice(0, 1600) + '\n… (truncated. the file continues. the file always continues.)';
            print('<pre class="t-neo">' + esc(body) + '</pre>');
        },
        cat: function (a) { CMDS.type(a); },
        tree: function (a) {
            var key = a ? localThenGlobal(a) : cwd;
            if (!key || !FS[key]) { print('Invalid path.', 't-err'); return; }
            var lines = [(FS[key] || {}).label || key], budget = { n: 220 };
            (function walk(k, prefix, seen) {
                if (seen[k] || budget.n <= 0) return;
                seen[k] = 1;
                var items = itemsFor(k);
                items.forEach(function (it, i) {
                    if (budget.n-- <= 0) return;
                    var last = i === items.length - 1;
                    lines.push(prefix + (last ? '└── ' : '├── ') + it.n);
                    if (it.go && FS[it.go]) walk(it.go, prefix + (last ? '    ' : '│   '), seen);
                });
            })(key, '', {});
            if (budget.n <= 0) lines.push('', '… the tree keeps going. pixel budget does not.');
            print('<pre class="t-neo">' + esc(lines.join('\n')) + '</pre>');
        },
        del: function (a) { print(a ? 'use the Recycle Bin like a civilized person.' : 'del what? (no. either way, no.)', 't-err'); },
        date: function () { var n = new Date(); print(DOW[n.getDay()] + ' ' + MON[n.getMonth()] + ' ' + n.getDate() + ' ' + fmtTime(n)); },
        socials: function () { ME.links.forEach(function (l) { print('<b>' + esc(l[0]) + ':</b> ' + esc(l[2])); }); },
        gti: function () { print('silver MK8 VW GTI, callsign "Argent". runs the FSAE money and the back roads.'); },
        clear: function () { out.innerHTML = ''; },
        exit: function () { closeWin('terminal'); },
        neofetch: function () {
            var art = ['  ___  ', ' | U | ', ' |_R_| ', ' / URE\\'];
            var info = ['isaac@ure', '---------', 'OS: UreOS 11 Pixel Edition', 'Host: isaacure.com', 'Shell: ure-sh 1.0', 'DE: Bloom', 'Theme: Pixel Fluent', 'Accent: ' + (ACCENTS.filter(function (a) { return a.hex === recall('accent', ACCENTS[0].hex); })[0] || ACCENTS[0]).name, 'Uptime: since you got here'];
            var rows = Math.max(art.length, info.length), h = '';
            for (var i = 0; i < rows; i++) h += '<span class="t-art">' + esc(art[i] || '       ') + '</span>  ' + esc(info[i] || '') + '\n';
            print('<pre class="t-neo">' + h + '</pre>');
        },
        open: function (a) {
            if (!a) { print("open what? try: open notepad, or open a file that is sitting right here", 't-err'); return; }
            var it = findHere(a);
            if (it) { print('opening ' + esc(it.n) + '...'); openItemFrom(it); return; }
            if (Object.prototype.hasOwnProperty.call(APPS, a)) { print('opening ' + esc(a) + '...'); openApp(a); return; }
            print("nothing here by that name. 'dir' shows what is.", 't-err');
        }
    };
    function run(line) {
        print('<span class="term-prompt">isaac@ure</span>:<span class="term-path">' + esc(pathLabel()) + '</span>$ ' + esc(line), 't-cmd');
        var parts = line.trim().split(/\s+/), cmd = (parts.shift() || '').toLowerCase();
        if (!cmd) return;
        if (cmd === 'echo') { print(esc(parts.join(' '))); return; }
        if (cmd === 'sudo') { print("nice try. this is a personal machine.", 't-err'); return; }
        if (cmd === 'rm' || cmd === 'format') { print("absolutely not.", 't-err'); return; }
        // hasOwnProperty: bare-name lookup would otherwise hit Object.prototype ('constructor', '__proto__') and throw
        if (Object.prototype.hasOwnProperty.call(CMDS, cmd)) CMDS[cmd](parts.join(' '));
        else print("ure-sh: command not found: " + esc(cmd) + "  (try 'help')", 't-err');
    }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { run(inp.value); inp.value = ''; } });
    term.addEventListener('click', function () { inp.focus(); });
    el._clear = function () { out.innerHTML = ''; };              // Alt+L, shell-style
    setTimeout(function () { inp.focus(); }, 30);   // focus isn't motion
}

/* —— Settings ——
   One switch row, built the same way every time. role="switch" without
   aria-checked reads as indeterminate, which is what the hand-written rows
   used to do. */
function setToggle(label, hint, key, on) {
    return '<label class="set-toggle"><span>' + esc(label) + (hint ? ' <i>' + esc(hint) + '</i>' : '') + '</span>' +
        '<button class="tgl' + (on ? ' on' : '') + '" data-tgl="' + key + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + esc(label) + '"></button></label>';
}
function renderSettings() {
    return '<div class="settings">' +
        '<nav class="set-nav">' +
          '<button class="set-navi sel" data-pane="personalization">' + ic('ic-ure') + ' Personalization</button>' +
          '<button class="set-navi" data-pane="taskbar">' + ic('ic-taskview') + ' Taskbar</button>' +
          '<button class="set-navi" data-pane="system">' + ic('ic-pc') + ' System</button>' +
          '<button class="set-navi" data-pane="accounts">' + ic('ic-user') + ' Accounts</button>' +
          '<button class="set-navi" data-pane="about">' + ic('ic-settings') + ' About</button>' +
        '</nav><div class="set-body"></div></div>';
}
function initSettings(el, id, arg) {
    var nav = el.querySelector('.set-nav'), body = el.querySelector('.set-body');
    function pane(name) {
        nav.querySelectorAll('.set-navi').forEach(function (n) { n.classList.toggle('sel', n.getAttribute('data-pane') === name); });
        if (name === 'personalization') {
            var cur = recall('accent', ACCENTS[0].hex);
            var sw = ACCENTS.map(function (a) { return '<button class="swatch' + (a.hex === cur ? ' sel' : '') + '" data-hex="' + a.hex + '" style="background:' + a.hex + '" title="' + a.name + '" aria-label="' + a.name + '"></button>'; }).join('');
            body.innerHTML = '<h2 class="set-h2">Personalization</h2>' +
                '<div class="set-card"><div class="set-row"><span>Accent color</span></div><div class="swatches">' + sw + '</div><p class="set-hint">The whole system follows this. Isaac ships with URE Red.</p></div>' +
                '<div class="set-card">' + setToggle('Scanlines', 'a faint CRT overlay on the screen', 'crt', recall('crt', 'on') === 'on') + '</div>' +
                '<div class="set-card"><div class="set-row"><span>Wallpaper</span><button class="set-btn" data-act="rebloom">Regenerate Bloom</button></div><p class="set-hint">A fresh pixel Bloom, rendered on the spot.</p></div>';
        } else if (name === 'taskbar') {
            body.innerHTML = '<h2 class="set-h2">Personalization &gt; Taskbar</h2>' +
                '<div class="set-card"><div class="set-row"><span>Taskbar behaviors</span></div>' +
                  setToggle('Automatically hide the taskbar', 'it slides away; put the pointer on the bottom edge to get it back',
                            'tbauto', document.body.classList.contains('tb-auto')) +
                '</div>' +
                '<div class="set-card">' +
                  setToggle('Full screen', 'the whole page fills your monitor, browser and all',
                            'pagefs', PFS.on()) +
                  '<p class="set-hint">' + (PFS.can()
                      ? 'Shift+F11 anywhere does the same thing. For one window instead of the whole page, press F11 — or use the ⛶ button in its title bar.'
                      : 'This browser will not give a page the whole screen, so this switch is inert here.') + '</p></div>' +
                '<div class="set-card"><div class="set-row"><span>Shortcuts</span></div>' +
                  '<dl class="specs"><dt>F11</dt><dd>the focused window takes the screen</dd>' +
                  '<dt>Alt+Enter</dt><dd>the same, the way games have always done it</dd>' +
                  '<dt>Shift+F11</dt><dd>the whole page</dd>' +
                  '<dt>Esc</dt><dd>leaves, unless the app wanted the key</dd></dl></div>';
        } else if (name === 'system') {
            var specs = [['Device name', 'URE-PC'], ['Processor', 'Bloom Core @ 60fps'], ['Installed RAM', '640 KB (ought to be enough)'], ['GPU', 'Canvas 2D, pixelated'], ['System type', 'pixel-bit operating system'], ['Pen and touch', 'thumbs supported']];
            body.innerHTML = '<h2 class="set-h2">System &gt; About</h2><div class="set-card"><dl class="specs">' + specs.map(function (s) { return '<dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd>'; }).join('') + '</dl></div>' +
                '<div class="set-card"><div class="set-row"><span>Windows specifications</span></div><dl class="specs"><dt>Edition</dt><dd>UreOS 11 Pixel Edition</dd><dt>Version</dt><dd>26H (the room)</dd><dt>Installed</dt><dd>the day you visited</dd></dl></div>';
        } else if (name === 'accounts') {
            // where "Change account settings" in the Start flyout lands
            body.innerHTML = '<h2 class="set-h2">Accounts</h2>' +
                '<div class="set-card"><div class="set-me">' + ic('ic-user', 'set-av') + '<div><b>Isaac Ure</b><span>Local account · Administrator</span></div></div>' +
                  '<p class="set-hint">The only account on this machine. Sign out and you sign back in as him.</p></div>' +
                '<div class="set-card"><div class="set-row"><span>Sign-in options</span></div><dl class="specs"><dt>Password</dt><dd>none (it’s a website)</dd><dt>PIN</dt><dd>not set</dd><dt>Windows Hello</dt><dd>recognizes exactly one face</dd></dl></div>' +
                '<div class="set-card"><div class="set-row"><span>Lock this PC</span><button class="set-btn" data-act="lock">Lock</button></div><p class="set-hint">The lock screen, then the sign-in tile. Signing in is one click; there is no password to type.</p></div>' +
                '<div class="set-card"><div class="set-row"><span>Sign out</span><button class="set-btn" data-act="signout">Sign out</button></div><p class="set-hint">You come back to everything where you left it.</p></div>';
        } else {
            body.innerHTML = '<h2 class="set-h2">About</h2><div class="set-card"><p class="set-hint">The computer is a corner of <b>isaacure.com</b> — a pixel Windows 11 built as the hub for Isaac’s stuff. Made with vanilla JS, a canvas Bloom, and no frameworks.</p></div>' +
                '<div class="set-card"><div class="set-row"><span>More of Isaac</span><button class="set-btn" data-act="about">Open About Isaac</button></div></div>';
        }
    }
    nav.addEventListener('click', function (e) { var b = e.target.closest('.set-navi'); if (b) pane(b.getAttribute('data-pane')); });
    body.addEventListener('click', function (e) {
        var sw = e.target.closest('.swatch');
        if (sw) { var hex = sw.getAttribute('data-hex'); applyAccent(hex); store('accent', hex); body.querySelectorAll('.swatch').forEach(function (x) { x.classList.remove('sel'); }); sw.classList.add('sel'); return; }
        var tgl = e.target.closest('.tgl');
        if (tgl) {
            // this used to ignore data-tgl entirely and always write the CRT
            // pref, so the second switch on the page would have toggled scanlines
            var key = tgl.getAttribute('data-tgl'), on = tgl.classList.toggle('on');
            if (key === 'pagefs') {
                togglePageFs();                       // the API answers, pageFsSync writes the truth back
                tgl.classList.toggle('on', PFS.on()); // do not claim it worked before it has
            } else if (key === 'tbauto') {
                setTbAuto(on);
            } else {
                document.body.classList.toggle('no-crt', !on); store('crt', on ? 'on' : 'off');
            }
            tgl.setAttribute('aria-checked', tgl.classList.contains('on') ? 'true' : 'false');
            return;
        }
        var act = e.target.closest('[data-act]');
        if (act) {
            var a = act.getAttribute('data-act');
            if (a === 'rebloom') renderWall(); else if (a === 'about') openApp('about');
            else if (a === 'lock') lockScreen(false); else if (a === 'signout') lockScreen(true);
        }
    });
    el._setPane = pane;                     // so a second "Display settings" click can still switch panes
    pane(arg && (arg === 'system' || arg === 'taskbar' || arg === 'personalization' || arg === 'accounts') ? arg : 'personalization');
}

/* —— Calculator —— */
function renderCalc() {
    var keys = ['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='];
    var span = { '0': ' wide', '=': '', 'C': '' };
    var html = keys.map(function (k) {
        var op = '÷×−+='.indexOf(k) >= 0, fn = 'C±%'.indexOf(k) >= 0;
        return '<button class="calc-key' + (op ? ' op' : '') + (fn ? ' fn' : '') + (k === '=' ? ' eq' : '') + (k === '0' ? ' wide' : '') + '" data-k="' + k + '">' + k + '</button>';
    }).join('');
    return '<div class="calc"><div class="calc-disp" id="calcDisp">0</div><div class="calc-keys">' + html + '</div></div>';
}
function initCalc(el) {
    var disp = el.querySelector('#calcDisp'), acc = null, op = null, fresh = true;
    function show(v) { disp.textContent = (v + '').length > 12 ? (+v).toPrecision(8) : v; }
    function apply(a, b, o) { return o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : a / b; }
    el.querySelector('.calc-keys').addEventListener('click', function (e) {
        var b = e.target.closest('.calc-key'); if (!b) return;
        var k = b.getAttribute('data-k'), cur = disp.textContent;
        if (k >= '0' && k <= '9') { disp.textContent = (fresh || cur === '0') ? k : cur + k; fresh = false; }
        else if (k === '.') { if (fresh) { disp.textContent = '0.'; fresh = false; } else if (cur.indexOf('.') < 0) disp.textContent = cur + '.'; }
        else if (k === 'C') { acc = null; op = null; fresh = true; show('0'); }
        else if (k === '±') show(-parseFloat(cur));
        else if (k === '%') show(parseFloat(cur) / 100);
        else if ('÷×−+'.indexOf(k) >= 0) { if (op && !fresh) { acc = apply(acc, parseFloat(cur), op); show(acc); } else acc = parseFloat(cur); op = k; fresh = true; }
        else if (k === '=') { if (op) { show(apply(acc, parseFloat(cur), op)); op = null; fresh = true; } }
    });
}

function toast(msg, icon) {
    var t = document.createElement('div'); t.className = 'toast px-lg lift';
    t.innerHTML = ic(icon || 'ic-chrome') + '<span>' + esc(msg) + '</span>';
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('on'); });
    setTimeout(function () { t.classList.remove('on'); setTimeout(function () { if (t.parentNode) t.remove(); }, 320); }, 3400);
}

// a Windows-style timestamp for the files this desktop creates (saves, downloads)
function dlStamp() { var n = new Date(); return (n.getMonth() + 1) + '/' + n.getDate() + '/' + n.getFullYear() + ' ' + fmtTime(n); }


/* ═════════════ right-click menus (Chrome) ═════════════
   One open menu at a time, absolutely positioned inside the window it
   serves — Chrome-light by default, dark for Incognito.
   Items are {k, t, hint, dis} objects or the string 'sep'. Picking an
   item dispatches its k through the fn handed to openBctx.
   OSCLIP is the machine's clipboard: every sim copy lands there (and
   is mirrored to the real clipboard where the host browser allows,
   so sim-copied text pastes outside) — Paste reads OSCLIP only, so
   the host never prompts for clipboard-read permission. */
var bctxEl = null, OSCLIP = '';
function setClip(text) {
    OSCLIP = String(text || '');
    try { navigator.clipboard.writeText(OSCLIP).catch(function () {}); } catch (err) {}
}
function closeBctx() { if (bctxEl) { bctxEl.remove(); bctxEl = null; } }
function openBctx(host, e, items, fn, skin) {   // skin: true = dark (Incognito), or a class name
    closeBctx(); closeCtx(); closeFctx(); setStart(false); closeFlyouts();
    var m = document.createElement('div');
    m.className = 'bctx' + (skin === true ? ' dark' : skin ? ' ' + skin : ''); m.setAttribute('role', 'menu'); m.tabIndex = -1;
    m.innerHTML = items.map(function (it) {
        if (it === 'sep') return '<div class="bctx-sep"></div>';
        return '<button class="bctx-i" type="button" role="menuitem" data-bx="' + it.k + '"' + (it.dis ? ' disabled' : '') + '>' +
            '<span>' + esc(it.t) + '</span>' + (it.hint ? '<span class="bctx-hint">' + esc(it.hint) + '</span>' : '') + '</button>';
    }).join('');
    host.appendChild(m);
    var hr = host.getBoundingClientRect();
    m.style.left = clamp(e.clientX - hr.left, 4, Math.max(4, hr.width - m.offsetWidth - 4)) + 'px';
    m.style.top = clamp(e.clientY - hr.top, 4, Math.max(4, hr.height - m.offsetHeight - 4)) + 'px';
    m.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var b = ev.target.closest('[data-bx]'); if (!b) return;
        var act = b.getAttribute('data-bx'); closeBctx(); fn(act);
    });
    m.addEventListener('contextmenu', function (ev) { ev.preventDefault(); ev.stopPropagation(); });
    m.addEventListener('keydown', function (ev) {   // arrows walk the menu, like the real one
        var all = m.querySelectorAll('.bctx-i:not([disabled])'); if (!all.length) return;
        var i = Array.prototype.indexOf.call(all, document.activeElement);
        if (ev.key === 'ArrowDown') { ev.preventDefault(); (all[i + 1] || all[0]).focus(); }
        else if (ev.key === 'ArrowUp') { ev.preventDefault(); (all[i - 1] || all[all.length - 1]).focus(); }
        else if (ev.key === 'Home') { ev.preventDefault(); all[0].focus(); }
        else if (ev.key === 'End') { ev.preventDefault(); all[all.length - 1].focus(); }
    });
    m.focus();
    bctxEl = m;
}
/* text-field menu, shared by both browsers. Selection and value are
   snapshotted at open time — focusing the menu (or the address bar's own
   focus handler selecting it all) must not change what Cut/Copy grab. */
function bctxInput(host, e, inp, opts, dark) {
    var s0 = inp.selectionStart || 0, s1 = inp.selectionEnd || 0, v0 = inp.value, hasSel = s1 > s0;
    var items = [
        { k: 'cut', t: 'Cut', dis: !hasSel },
        { k: 'copy', t: 'Copy', dis: !hasSel },
        { k: 'paste', t: 'Paste', dis: !OSCLIP }
    ];
    if (opts && opts.go) items.push({ k: 'pgo', t: 'Paste and go', dis: !OSCLIP });
    items.push('sep', { k: 'all', t: 'Select all', dis: !v0 });
    openBctx(host, e, items, function (a) {
        inp.focus();
        if (a === 'all') { inp.select(); return; }
        if (a === 'cut' || a === 'copy') {
            setClip(v0.slice(s0, s1));
            if (a === 'cut') { inp.value = v0.slice(0, s0) + v0.slice(s1); inp.setSelectionRange(s0, s0); inp.dispatchEvent(new Event('input', { bubbles: true })); }
            else inp.setSelectionRange(s0, s1);
            return;
        }
        if (a === 'paste' || a === 'pgo') {
            inp.value = v0.slice(0, s0) + OSCLIP + v0.slice(s1);
            var p = s0 + OSCLIP.length; inp.setSelectionRange(p, p);
            inp.dispatchEvent(new Event('input', { bubbles: true }));
            if (a === 'pgo') opts.go(inp.value);
        }
    }, dark);
}

/* ═══════════════ Chrome (the browser that actually works) ═══════════════
   A real little browser: multiple tabs with per-tab history, a working
   omnibox with suggestions, bookmarks (star + bar), the ⋯ menu, incognito
   that genuinely doesn't record history, chrome:// pages (settings/
   history/bookmarks/downloads/dino), and a small fake web for it all to
   browse. Classic LIGHT Chrome, in hard pixels; the one that feels like
   home. State: comp_chrome_*.
   ───────────────────────────────────────────────────────────────────── */
var CR = null;                                   // live window state (single-instance, like ST)
function crj(k, d) { return jsonAs(recall('chrome_' + k, 'null'), d); }
function crjSet(k, v) { store('chrome_' + k, JSON.stringify(v)); }
function crBM() { var bm = crj('bm', [['isaacure.com', 'isaacure.com'], ['GitHub', 'github.com/IsaacUre'], ['Golf GTI — Wikipedia', 'en.wikipedia.org/wiki/Volkswagen_Golf_GTI'], ['The Thresher', 'thresher.rice.edu'], ['Rice Racing', 'riceracing.org'], ['dino', 'chrome://dino']]); for (var i = 0; i < bm.length; i++) if (bm[i] && bm[i][1] === 'fsae.rice.edu') bm[i] = ['Rice Racing', 'riceracing.org']; return bm; }
function crHist() { return crj('hist', []); }
function crSet() { return crj('set', { bmbar: 1, engine: 'google' }); }
function crEngine() { return crSet().engine === 'ure' ? 'URE Search' : 'Google'; }

/* ── tiny favicon chips ── */
function crFav(f, cls) {
    if (!f) f = { ch: '?', c: '#9aa0a6' };
    if (f.ic) return ic(f.ic, 'cr-fav ' + (cls || ''));
    return '<span class="cr-fav chip ' + (cls || '') + '" style="background:' + f.c + '">' + esc(f.ch) + '</span>';
}
function crLink(url, label, cls) { return '<button class="cr-l ' + (cls || '') + '" data-href="' + esc(url) + '">' + label + '</button>'; }

/* ═════════════════════ the fake web ═════════════════════ */
var WEB = {};
function webPage(host, def) { def.host = host; WEB[host] = def; return def; }

/* — Google New Tab — */
webPage('chrome://newtab', {
    title: 'New Tab', fav: { ic: 'ic-chrome' }, nohist: true,
    render: function () {
        if (CR && CR.incog) {
            return '<div class="cr-ntp incog"><span class="cr-spy">🕶</span><h2>You’ve gone Incognito</h2>' +
                '<p>Chrome won’t save your history here. From whom, Isaac? This machine only visits your own website.</p>' +
                '<div class="cr-incard"><b>What Incognito does:</b> nothing gets written to chrome://history.<br><b>What it can’t do:</b> hide the GTI RUN high score. That’s public.</div></div>';
        }
        var eng = crEngine();
        var tiles = crBM().slice(0, 7).map(function (b) {
            var s = WEB[crResolveKey(b[1])] || {};
            return '<button class="cr-sc cr-l" data-href="' + esc(b[1]) + '">' + crFav(s.fav, 'big') + '<span>' + esc(b[0]) + '</span></button>';
        }).join('') + '<button class="cr-sc cr-scadd"><span class="cr-plus">+</span><span>Add shortcut</span></button>';
        return '<div class="cr-ntp">' +
            '<h1 class="cr-goo" aria-label="' + eng + '">' + (eng === 'Google'
                ? '<b style="color:#4285f4">G</b><b style="color:#ea4335">o</b><b style="color:#fbbc05">o</b><b style="color:#4285f4">g</b><b style="color:#34a853">l</b><b style="color:#ea4335">e</b>'
                : '<b style="color:#d81e05">U</b><b style="color:#2a3038">R</b><b style="color:#d81e05">E</b> <b style="color:#2a3038">Search</b>') + '</h1>' +
            '<label class="cr-ntpbox">' + ic('ic-search') + '<input class="cr-ntpq" placeholder="Search ' + eng + ' or type a URL" spellcheck="false" autocomplete="off"><span class="cr-mic" title="Voice search (it can only hear pixels)">🎤</span></label>' +
            '<div class="cr-scs">' + tiles + '</div>' +
            '<button class="cr-customize">✎ Customize Chrome</button></div>';
    },
    init: function (view) {
        var q = view.querySelector('.cr-ntpq');
        if (q) q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && q.value.trim()) crNav(crParse(q.value)); });
        var cu = view.querySelector('.cr-customize'); if (cu) cu.addEventListener('click', function () { toast('This Chrome is already customized. It’s pixels.'); });
        var ad = view.querySelector('.cr-scadd'); if (ad) ad.addEventListener('click', function () { toast('Star a page to bookmark it — the shortcuts follow.'); });
    }
});

/* — Search results — a REAL aggregated SERP. render() lays out the shell with
   a placeholder per source; init() fires Wikipedia + GitHub + Hacker News in
   parallel and drops each into its slot as it lands. Every result links into a
   page the live layer actually loads. The local curated corpus rides along as
   its own instant section. — */
webPage('google.com/search', {
    title: function (q) { return q + ' - ' + crEngine() + ' Search'; }, fav: { ch: 'G', c: '#4285f4' }, dynamic: true,
    render: function (q) {
        q = q || '';
        var has = !!q.trim();
        var ql = q.toLowerCase();
        var snippet = '';
        if (/dino|dinosaur|t-?rex/.test(ql)) snippet = '<div class="cr-snip"><b>chrome://dino</b><p>You appear to be looking for the dinosaur. He is employed here.</p>' + crLink('chrome://dino', 'Play the dino game', 'cr-snipl') + '</div>';
        var local = '';
        if (has) {
            var corpus = Object.keys(WEB).map(function (k) { return WEB[k]; }).filter(function (s) { return s.searchable; });
            var hits = corpus.filter(function (s) { return (s.stitle + ' ' + s.sdesc + ' ' + (s.skey || '')).toLowerCase().indexOf(ql) >= 0; });
            if (!hits.length) hits = corpus.filter(function (s) { return ql.split(/\s+/).some(function (w) { return w.length > 2 && (s.stitle + ' ' + (s.skey || '')).toLowerCase().indexOf(w) >= 0; }); });
            var localRows = hits.slice(0, 4).map(function (s) {
                return '<div class="cr-res">' + crLink(s.host, '<span class="cr-resurl">' + crFav(s.fav) + ' https://' + esc(s.host) + '</span><span class="cr-restitle">' + esc(s.stitle) + '</span>', '') +
                    '<span class="cr-resdesc">' + esc(s.sdesc) + '</span></div>';
            }).join('');
            local = localRows ? '<div class="cr-serpsec"><h4 class="cr-serph">From isaacure.com</h4>' + localRows + '</div>' : '';
        }
        var load = function (id, label) { return '<div class="cr-serpsec" id="' + id + '"><h4 class="cr-serph">' + label + '</h4><div class="cr-serploading"><span class="cr-lvspin"></span> searching…</div></div>'; };
        // the live sections only exist when there's a query to fire them — an empty
        // SERP must not paint spinners that init() will never fill
        // intent-conditional slots stay EMPTY (not spinners) — a spinner that may
        // never be filled is exactly the bug the empty-query fix was about.
        // a pure calculator/unit query answers offline, so it paints no live
        // sections at all: three spinners under a finished answer is a lie, and
        // github's anonymous search budget is 10/min.
        var offline = has && !!serpOffline(q);   // only skip the live sections when an answer actually exists
        var sections = has && !offline ? (snippet + local +
            '<div class="cr-serpslot" id="crSerpKp"></div>' +
            '<div class="cr-serpsec cr-serpfeatslot" id="crSerpFeat"></div>' +
            load('crSerpWiki', 'Wikipedia') +
            '<div class="cr-serpslot" id="crSerpImg"></div>' +
            load('crSerpGH', 'Code · GitHub') +
            '<div class="cr-serpslot" id="crSerpSO"></div>' +
            load('crSerpHN', 'Discussion · Hacker News')) : (has ? snippet + local : '');
        var rel = ['game boy', 'volkswagen golf gti', 'rice university', 'factorio', 'hades speedrun'].map(function (r) { return crLink('google.com/search?q=' + encodeURIComponent(r), '🔍 ' + esc(r), 'cr-rel'); }).join('');
        return '<div class="cr-serp">' +
            '<div class="cr-serphead">' + (crEngine() === 'Google' ? '<span class="cr-serplogo"><b style="color:#4285f4">G</b><b style="color:#ea4335">o</b><b style="color:#fbbc05">o</b><b style="color:#4285f4">g</b><b style="color:#34a853">l</b><b style="color:#ea4335">e</b></span>' : '<span class="cr-serplogo"><b style="color:#d81e05">URE</b></span>') +
              '<label class="cr-serpbox">' + ic('ic-search') + '<input class="cr-serpq" value="' + esc(q) + '" spellcheck="false" autocomplete="off"></label>' + liveChip() + '</div>' +
            '<div class="cr-serptabs"><span class="on">All</span><span>Images</span><span>Videos</span><span>News</span><span>Maps</span></div>' +
            '<p class="cr-serpstat" id="crSerpStat">' + (has ? 'Searching the real web for “' + esc(q) + '”…' : 'Type a query to search the real web.') + '</p>' +
            '<div id="crSerpAns"></div><div id="crSerpDym"></div>' +
            sections +
            '<div class="cr-relwrap"><b>Related searches</b><div class="cr-rels">' + rel + '</div></div></div>';
    },
    init: function (view) {
        var q = view.querySelector('.cr-serpq');
        var query = q ? q.value : crQOf(crTab().url);
        if (q) q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && q.value.trim()) crNav('google.com/search?q=' + encodeURIComponent(q.value.trim())); });
        view.querySelectorAll('.cr-serptabs span').forEach(function (t) {
            t.addEventListener('click', function () { if (!t.classList.contains('on')) toast(t.textContent + ' results: also pixels, but sideways.'); });
        });
        if (!query || !query.trim()) return;                          // empty SERP: render() already left no spinners
        /* re-mark for Alt+F after each section lands: the sections arrive long
           after the page does, and a find bar opened in between would otherwise
           never see them (liveFill does this for whole-page loads already) */
        function refind() { if (find.appId === 'chrome' && findOpenNow()) runFind(); }
        function fill(id, html) { if (!view.isConnected) return; var el = view.querySelector('#' + id); if (el) { el.innerHTML = html; refind(); } }
        function addAns(html) { if (!html || !view.isConnected) return; var el = view.querySelector('#crSerpAns'); if (el) { el.innerHTML += html; refind(); } }

        /* read the query's shape first; only the packs that fit get to fetch */
        var intent = serpIntent(query);
        var off = serpOffline(query);
        if (off) {                                                    // answered offline: render() painted no live sections
            addAns(serpAnswer(off.label, off.big, off.sub));
            var sOff = view.querySelector('#crSerpStat');
            if (sOff) sOff.textContent = 'Answered without touching the network.';
            return;
        }
        if (intent.kind === 'time') serpTime(intent.place, addAns);
        else if (intent.kind === 'weather') serpWeatherCard(intent.place, addAns);
        else if (intent.kind === 'define') serpDict(intent.word, addAns);
        else if (intent.kind === 'map') serpMap(intent.place, addAns);

        /* the knowledge panel rides along for anything entity-shaped. map/weather
           must hand it the PLACE — "where is rice university" is not an article
           title, so passing the raw query bought a guaranteed 404 per search. */
        var kpTerm = (intent.kind === 'map' || intent.kind === 'weather') ? intent.place : query;
        if (/^(general|code|map|weather)$/.test(intent.kind) && String(kpTerm).trim().split(/\s+/).length <= 5)
            serpKnowledge(kpTerm, function (h) { fill('crSerpKp', h); });
        if (intent.kind === 'code') serpSO(query, function (h) { fill('crSerpSO', h); });
        if (/^(general|code)$/.test(intent.kind)) serpImages(query, function (h) { fill('crSerpImg', h); });

        serpWiki(query, true, function (featHtml, restHtml, total, suggest) {
            if (!view.isConnected) return;
            fill('crSerpFeat', featHtml);
            fill('crSerpWiki', restHtml);
            /* wikipedia suggests variants even for correctly-spelled queries
               ("Douglas Adams" → "douglas adam's"); only ask when the suggestion
               differs by more than case, spacing, and punctuation */
            function dymKey(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
            if (suggest && dymKey(suggest) !== dymKey(query))
                fill('crSerpDym', '<p class="cr-dym">Did you mean ' + crLink('google.com/search?q=' + encodeURIComponent(suggest), esc(suggest), 'cr-dymlink') + '?</p>');
            var st = view.querySelector('#crSerpStat');
            if (st) st.textContent = total ? 'About ' + nnum(total).toLocaleString() + ' Wikipedia results — plus live GitHub and Hacker News' : 'Real results for “' + query + '”';
        });
        serpGH(query, function (h) { fill('crSerpGH', h); });
        serpHN(query, function (h) { fill('crSerpHN', h); });
    }
});

/* — isaacure.com — the holding page, as it really is. The root page's own boot
   and screen (index.html at the repo root), brought over line for line with the
   page's viewport swapped for the tab: black, a terminal boots in the top-left
   and prints its checks, the banner, then the LCD's pixel eye as a flipbook, and
   hands off to the LCD, which powers on, types the line, and waits. Any key, a
   click, or 12 seconds skips the boot. Every class here is cr-iu-, so the page's
   .term and .screen never meet the desktop's own. */
var IU_EYE_SVG = '<svg viewBox="0 0 48 48" shape-rendering="crispEdges"><g class="cr-iu-ink" fill="currentColor"><rect x="22" y="12" width="14" height="2"/><rect x="16" y="14" width="24" height="2"/><rect x="14" y="16" width="28" height="2"/><rect x="8" y="18" width="24" height="2"/><rect x="38" y="18" width="6" height="2"/><rect x="42" y="20" width="4" height="2"/><rect x="44" y="22" width="2" height="2"/><rect x="4" y="24" width="4" height="2"/><rect x="46" y="24" width="2" height="2"/><rect x="2" y="26" width="2" height="2"/><rect x="0" y="28" width="2" height="2"/><rect x="38" y="28" width="10" height="2"/><rect x="6" y="30" width="12" height="2"/><rect x="32" y="30" width="8" height="2"/><rect x="14" y="32" width="22" height="2"/><rect x="20" y="34" width="10" height="2"/></g><g class="cr-iu-pupil" fill="currentColor"><rect x="8" y="20" width="8" height="2"/><rect x="18" y="20" width="14" height="2"/><rect x="6" y="22" width="8" height="2"/><rect x="18" y="22" width="8" height="2"/><rect x="30" y="22" width="6" height="2"/><rect x="18" y="24" width="14" height="2"/><rect x="20" y="26" width="12" height="2"/><rect x="20" y="28" width="10" height="2"/><g class="cr-iu-glint"><rect x="16" y="20" width="2" height="2"/><rect x="14" y="22" width="4" height="2"/></g></g><g class="cr-iu-bf cr-iu-half"><g class="cr-iu-skin"><rect x="2" y="10" width="44" height="2"/><rect x="2" y="12" width="44" height="2"/><rect x="2" y="14" width="44" height="2"/><rect x="2" y="16" width="44" height="2"/><rect x="2" y="18" width="44" height="2"/><rect x="2" y="20" width="10" height="2"/><rect x="38" y="20" width="8" height="2"/><rect x="2" y="22" width="6" height="2"/><rect x="44" y="22" width="2" height="2"/><rect x="2" y="24" width="6" height="2"/></g><g class="cr-iu-edge"><rect x="12" y="20" width="26" height="2"/><rect x="8" y="22" width="36" height="2"/><rect x="8" y="24" width="4" height="2"/><rect x="38" y="24" width="8" height="2"/><rect x="2" y="26" width="6" height="2"/></g></g><g class="cr-iu-bf cr-iu-slit"><g class="cr-iu-skin"><rect x="2" y="10" width="44" height="2"/><rect x="2" y="12" width="44" height="2"/><rect x="2" y="14" width="44" height="2"/><rect x="2" y="16" width="44" height="2"/><rect x="2" y="18" width="44" height="2"/><rect x="2" y="20" width="44" height="2"/><rect x="2" y="22" width="44" height="2"/><rect x="2" y="24" width="6" height="2"/><rect x="18" y="24" width="14" height="2"/><rect x="2" y="30" width="16" height="2"/><rect x="32" y="30" width="14" height="2"/><rect x="2" y="32" width="44" height="2"/><rect x="2" y="34" width="44" height="2"/></g><g class="cr-iu-edge"><rect x="8" y="24" width="10" height="2"/><rect x="32" y="24" width="14" height="2"/><rect x="2" y="26" width="6" height="2"/><rect x="18" y="26" width="14" height="2"/><rect x="2" y="28" width="16" height="2"/><rect x="32" y="28" width="14" height="2"/><rect x="18" y="30" width="14" height="2"/></g></g><g class="cr-iu-bf cr-iu-shut"><g class="cr-iu-skin"><rect x="2" y="10" width="44" height="2"/><rect x="2" y="12" width="44" height="2"/><rect x="2" y="14" width="44" height="2"/><rect x="2" y="16" width="44" height="2"/><rect x="2" y="18" width="44" height="2"/><rect x="2" y="20" width="44" height="2"/><rect x="2" y="22" width="44" height="2"/><rect x="2" y="24" width="44" height="2"/><rect x="18" y="26" width="14" height="2"/><rect x="2" y="30" width="16" height="2"/><rect x="32" y="30" width="14" height="2"/><rect x="2" y="32" width="44" height="2"/><rect x="2" y="34" width="44" height="2"/></g><g class="cr-iu-edge"><rect x="2" y="26" width="16" height="2"/><rect x="32" y="26" width="14" height="2"/><rect x="2" y="28" width="44" height="2"/><rect x="18" y="30" width="14" height="2"/></g></g></svg>';
/* the eye in characters, cell for cell: two columns to a cell and .8 of a row to a
   cell, so the cells come out square in VT323. the same frames the LCD blinks with */
var IU_EYE = {
    open: [
        '                      ##############',
        '                ########################',
        '              ############################',
        '        ########################      ######',
        '        ########  ##############          ####',
        '      ########    ########    ######        ##',
        '    ####          ##############              ##',
        '  ##                ############',
        '##                  ##########        ##########',
        '      ############              ########',
        '              ######################',
        '                    ##########'
    ].join('\n'),
    left: [
        '                      ##############',
        '                ########################',
        '              ############################',
        '        ########################      ######',
        '    ########  ##############              ####',
        '  ########    ########    ######            ##',
        '    ####      ##############                  ##',
        '  ##            ############',
        '##              ##########            ##########',
        '      ############              ########',
        '              ######################',
        '                    ##########'
    ].join('\n'),
    right: [
        '                      ##############',
        '                ########################',
        '              ############################',
        '        ########################      ######',
        '            ########  ##############      ####',
        '          ########    ########    ######    ##',
        '    ####              ##############          ##',
        '  ##                    ############',
        '##                      ##########    ##########',
        '      ############              ########',
        '              ######################',
        '                    ##########'
    ].join('\n'),
    half: [
        '',
        '',
        '',
        '',
        '            ##########################',
        '        ####################################',
        '        ####      ##############      ##########',
        '  ######            ############',
        '##                  ##########        ##########',
        '      ############              ########',
        '              ######################',
        '                    ##########'
    ].join('\n'),
    slit: [
        '',
        '',
        '',
        '',
        '',
        '',
        '        ##########              ################',
        '  ######          ##############',
        '##################  ##########  ################',
        '                  ##############',
        '',
        ''
    ].join('\n'),
    shut: [
        '',
        '',
        '',
        '',
        '',
        '',
        '                                              ##',
        '  ################              ##############',
        '################################################',
        '                  ##############',
        '',
        ''
    ].join('\n')
};
var IU_BANNER = [
' ___ ____    _        _    ____   _   _ ____  _____',
'|_ _/ ___|  / \\      / \\  / ___| | | | |  _ \\| ____|',
' | |\\___ \\ / _ \\    / _ \\| |     | | | | |_) |  _|',
' | | ___) / ___ \\  / ___ \\ |___  | |_| |  _ <| |___',
'|___|____/_/   \\_\\/_/   \\_\\____|  \\___/|_| \\_\\_____|'
].join('\n');

webPage('isaacure.com', {
    title: 'Isaac Ure · coming soon', fav: { ic: 'ic-ure' }, searchable: true,
    stitle: 'Isaac Ure · coming soon', sdesc: 'Isaac Ure. Coming soon; the eye’s already on.', skey: 'isaac ure coming soon eye holding page personal site',
    render: function () {
        return '<div class="cr-iu">' +
            '<div class="cr-iu-term" hidden aria-hidden="true"><div class="cr-iu-log"></div></div>' +
            '<button class="cr-iu-skip" type="button" hidden aria-label="skip the boot">skip ▸</button>' +
            '<div class="cr-iu-frame"><div class="cr-iu-screen">' +
              '<div class="cr-iu-glow"></div><div class="cr-iu-scan" aria-hidden="true"></div><div class="cr-iu-flash" aria-hidden="true"></div>' +
              '<div class="cr-iu-hold">' +
                '<div class="cr-iu-eye" aria-hidden="true">' + IU_EYE_SVG + '</div>' +
                '<h1 class="cr-iu-word"><span>Coming <b>soon</b></span></h1>' +
                '<div class="cr-iu-row" aria-hidden="true"><span class="cr-iu-ps">&gt;</span><span class="cr-iu-block"></span></div>' +
              '</div></div></div></div>';
    },
    init: function (view) { iuBoot(view); }
});

/* the boot. the page's own script: print lines, land results, stamp the eye frame
   after frame, hand off. nothing types: a machine prints. anything that goes wrong
   lights the screen; so does any key, a click, or 12 seconds. */
function iuBoot(view) {
    var root = view.querySelector('.cr-iu'), frame = root.querySelector('.cr-iu-frame'), term = root.querySelector('.cr-iu-term'),
        log = root.querySelector('.cr-iu-log'), skipBtn = root.querySelector('.cr-iu-skip');
    var lit = false, gen = 0;
    function alive() { return root.isConnected; }   // the tab moved on (reload, nav, a switch): the old boot stops where it is

    /* the tab is this page's viewport: its size, in px, stands in for 100vw and 100vh
       in the page's CSS (the art's fit, the screen's), and under 380 wide the page's
       phone rules apply. kept current through a resize, maximise, full screen */
    function size() {
        var w = view.clientWidth, h = view.clientHeight;
        if (!w || !h) return;
        root.style.setProperty('--iu-w', w + 'px'); root.style.setProperty('--iu-h', h + 'px');
        root.classList.toggle('cr-iu-narrow', w <= 380);
    }
    size();
    if (window.ResizeObserver) {
        var ro = new ResizeObserver(function () { if (!alive()) { ro.disconnect(); return; } size(); });
        ro.observe(view);
    }

    function light() {                 // hand off: drop the terminal, wake the screen
        if (lit) return;
        lit = true; gen++;
        document.removeEventListener('keydown', key);
        if (CR && CR.iuKey === key) CR.iuKey = null;
        if (document.activeElement === skipBtn) {   // keep the keyboard on the page
            try { view.focus({ preventScroll: true }); } catch (e) { view.focus(); }
        }
        if (term.parentNode) term.parentNode.removeChild(term);
        if (skipBtn.parentNode) skipBtn.parentNode.removeChild(skipBtn);
        frame.classList.add('lit');
    }
    /* any key skips, as on the page, but only while Chrome is the window with the
       keyboard and nothing is being typed (the omnibox, the find bar); a browser
       chord (zoom, find, reload) is not a skip, nor are lock and function keys */
    function key(e) {
        if (!alive()) { document.removeEventListener('keydown', key); return; }
        if (lit || e.ctrlKey || e.metaKey || e.altKey) return;
        if (topAppId() !== 'chrome' || dlgs.length) return;
        function field(el) { return !!(el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); }
        if (field(e.target) || field(document.activeElement)) return;   // e.target too: Escape leaves the omnibox before this runs
        if (/^(Tab|Shift|Control|Alt|Meta|AltGraph|CapsLock|NumLock|ScrollLock|Dead|Unidentified|Process|ContextMenu|PrintScreen|F\d{1,2})$/.test(e.key)) return;
        light();
    }
    if (reduce || !window.Promise) { light(); return; }
    if (CR) { if (CR.iuKey) document.removeEventListener('keydown', CR.iuKey); CR.iuKey = key; }
    document.addEventListener('keydown', key);
    root.addEventListener('click', function () { light(); });   // a click anywhere; the skip button's bubbles here too

    /* ---- the terminal ---- */
    var cursor = document.createElement('span'); cursor.className = 'cr-iu-tc';
    function jump() { term.scrollTop = 1e9; }
    function isIdle(d) { return !!(d && d.lastChild === cursor && d.firstChild.data === ''); }
    function make(text, cls) {
        var d = document.createElement('div');
        d.className = 'cr-iu-tl' + (cls ? ' ' + cls : '');
        d.appendChild(document.createTextNode(text));
        return d;
    }
    function block(text, cls) {          // a line the cursor does not sit on
        var d = make(text, cls); log.appendChild(d); jump(); return d;
    }
    function line(text, cls) {           // the cursor's line: writes on a waiting empty one, else a new one
        var d = log.lastChild;
        if (!isIdle(d)) { d = make('', ''); log.appendChild(d); }
        d.className = 'cr-iu-tl' + (cls ? ' ' + cls : '');
        d.firstChild.data = text;
        d.appendChild(cursor);
        jump();
        return d;
    }
    /* a frame of output: goes in above the waiting cursor line, so the cursor stays
       at the bottom and the frames stack up over it, oldest at the top */
    function stamp(text) {
        var d = make(text, 'cr-iu-art cr-iu-px'), last = log.lastChild;
        if (isIdle(last)) log.insertBefore(d, last); else { log.appendChild(d); line(''); }
        return d;
    }
    /* ease the scroll to the new bottom, so a stamped frame slides up into view and
       the last one slides out: the flipbook the console's boot does */
    function slide(ms) {
        var g = gen, el = term, start = el.scrollTop, end = el.scrollHeight - el.clientHeight;
        if (ms <= 0 || end <= start) { jump(); return Promise.resolve(); }
        return new Promise(function (res) {
            var t0 = Date.now();
            (function step() {
                if (g !== gen || !alive()) return;
                var t = Math.min(1, (Date.now() - t0) / ms);
                el.scrollTop = start + (end - start) * (1 - Math.pow(1 - t, 2));   // ease-out
                if (t < 1) requestAnimationFrame(step); else res();
            })();
        });
    }
    function pause(ms) {
        var g = gen;
        return new Promise(function (res) { setTimeout(function () { if (g === gen && alive()) res(); }, ms); });
    }
    /* dotted leader to a fixed width, the way the console's checks line up */
    function lead(left, right) {
        var w = 34, dots = w - left.length - right.length - 2;
        return left + ' ' + new Array(Math.max(3, dots) + 1).join('.') + ' ' + right;
    }
    /* a check: the leader prints now, the result lands when the check is done */
    function check(left, right, ms, cls) {
        var full = lead(left, right), d = line(full.slice(0, full.length - right.length));
        return pause(ms).then(function () { d.firstChild.data = full; if (cls) d.className += ' ' + cls; });
    }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }

    /* ---- the sequence ---- */
    function run() {
        var g = gen, now = new Date();
        var today = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
        function eyeFrame(name, slideMs, hold) {
            return function () { if (g !== gen) return; stamp(IU_EYE[name]); return slide(slideMs).then(function () { return pause(hold); }); };
        }
        /* about 3.2s end to end: the checks land in order, quick ones quicker, the
           ones that look for something a beat longer; the eye's one blink keeps the
           LCD's timing */
        var seq = pause(250)
            .then(function () { return check('> power', 'ok', 60); })
            .then(function () { return pause(20); })
            .then(function () { return check('> memcheck 8K', 'ok', 110); })
            .then(function () { return pause(20); })
            .then(function () { return check('> clock', today, 30); })
            .then(function () { return pause(20); })
            .then(function () { return check('> mounting /site', 'not found', 170, 'cr-iu-warn'); })
            .then(function () { return pause(30); })
            .then(function () { line(lead('> looking for isaacure.com', '')); return pause(220); })
            .then(function () { line('  nothing here yet', 'cr-iu-dim'); return pause(100); })
            .then(function () { return check('> eye subsystem', 'waking', 100); })
            .then(function () { return pause(70); })
            .then(function () {
                block('');
                block(IU_BANNER, 'cr-iu-art');
                line('                A GOOD EYE OS  v1.0', 'cr-iu-art cr-iu-dim');
                return pause(220);
            })
            .then(function () { block(''); line(''); return pause(30); })
            // the eye powers on, has a look around, and blinks once, the LCD's blink
            // (half 45 · slit 40 · shut 90 · slit 55 · half 70): each frame is stamped
            // under the last and the log slides up to it
            .then(eyeFrame('open', 120, 260))
            .then(eyeFrame('left', 40, 70)).then(eyeFrame('right', 40, 70)).then(eyeFrame('open', 40, 80));
        [['half', 45], ['slit', 40], ['shut', 90], ['slit', 55], ['half', 70]].forEach(function (f) { seq = seq.then(eyeFrame(f[0], 20, f[1])); });
        seq = seq.then(eyeFrame('open', 40, 200));
        seq.then(function () { return pause(120); })
           .then(function () { return check('> handing off to /dev/eye0', 'ok', 80); })
           .then(function () { return pause(200); })
           .then(function () { if (g === gen) light(); })
           .catch(light);
    }

    /* the terminal shows its lone cursor at once, then waits (briefly) for its face, so
       the art does not reflow mid-boot, and waits to be looked at: in a hidden tab timers
       crawl and frames cannot slide. the 12s budget is armed when the boot really starts;
       the 20s one from now covers a document that never says it is visible. */
    var started = false;
    term.hidden = false; skipBtn.hidden = false; line('');
    function fit() {                 // the column the face really advances, for the art's size
        var probe = make('0000000000', 'cr-iu-art');
        probe.style.cssText = 'position:absolute;visibility:hidden;min-height:0';
        log.appendChild(probe);
        var r = probe.getBoundingClientRect();   // at line-height 1 the box is one em tall, so the ratio holds under the tab's zoom
        log.removeChild(probe);
        if (r.width > 0 && r.height > 0) term.style.setProperty('--col', (r.width / 10 / r.height).toFixed(4));
    }
    function start() {
        if (started || lit) return;
        started = true;
        setTimeout(light, 12000);
        fit();
        try { run(); } catch (e) { light(); }
    }
    function whenVisible(fn) {
        if (!document.hidden) return fn();
        document.addEventListener('visibilitychange', function f() {
            if (!document.hidden) { document.removeEventListener('visibilitychange', f); fn(); }
        });
    }
    function go() { whenVisible(start); }
    setTimeout(function () { if (!started) light(); }, 20000);
    if (document.fonts && document.fonts.load) {
        document.fonts.load('1em VT323').then(function () { if (started && !lit) fit(); go(); }, go);
        setTimeout(go, 1500);
    } else go();
}

webPage('isaacure.com/ureboy', {
    title: 'URE BOY', fav: { ic: 'ic-ureboy' },
    render: function () { return '<div class="cr-site cr-center"><h2>This page is a whole console.</h2><p>The browser inside the computer can’t also hold the Game Boy. Physics.</p><button class="cr-btn" data-open="/ureboy/">Boot the real URE BOY ↗</button></div>'; },
    init: function (view) { var b = view.querySelector('[data-open]'); if (b) b.addEventListener('click', function () { window.location.href = b.getAttribute('data-open'); }); }
});
webPage('isaacure.com/1p', {
    title: 'the room', fav: { ic: 'ic-room' },
    render: function () { return '<div class="cr-site cr-center"><h2>The room is out there.</h2><p>Leaving the desktop to walk to the desk you are sitting at raises questions.</p><button class="cr-btn" data-open="/1p/">Enter the room ↗</button></div>'; },
    init: function (view) { var b = view.querySelector('[data-open]'); if (b) b.addEventListener('click', function () { window.location.href = b.getAttribute('data-open'); }); }
});
webPage('isaacure.com/comp', {
    title: 'the computer (recursion)', fav: { ic: 'ic-pc' },
    render: function () {
        var frames = '';
        for (var i = 0; i < 7; i++) frames = '<div class="cr-mirror" style="--d:' + i + '">' + frames + '</div>';
        return '<div class="cr-site cr-center cr-comp"><h2>You are already here.</h2>' + frames +
            '<p>This browser runs on the desktop this page would load. Going deeper voids the warranty.</p><button class="cr-btn" id="crDeeper">Go deeper anyway</button></div>';
    },
    init: function (view) {
        var d = 0, b = view.querySelector('#crDeeper');
        if (b) b.addEventListener('click', function () {
            d++;
            if (d < 3) { toast('Recursion level ' + d + '. The Bloom is watching.'); view.querySelector('.cr-mirror').style.transform = 'scale(' + (1 - d * 0.1) + ')'; }
            else { toast('Stack overflow averted. Please enjoy the desktop you already have.'); b.disabled = true; b.textContent = 'No.'; }
        });
    }
});

/* — GitHub — */
webPage('github.com/IsaacUre', {
    title: 'IsaacUre — GitHub', fav: { ch: 'G', c: '#24292f' }, searchable: true,
    stitle: 'IsaacUre (Isaac Ure) · GitHub', sdesc: 'Rice ’29. One repo that keeps growing rooms. Commit messages in “Area: what and why” or else.', skey: 'github repo code commits',
    render: function () {
        var cells = '';
        for (var w = 0; w < 52; w++) for (var d = 0; d < 7; d++) {
            var v = (w * 7 + d) % 13 === 0 ? 4 : ((w + d * 3) % 11 === 0 ? 3 : ((w * d) % 7 === 0 ? 2 : ((w + d) % 5 === 0 ? 1 : 0)));
            if (w > 44) v = Math.min(4, v + 2);                       // the /comp/ sprint is visible from space
            cells += '<i class="g' + v + '"></i>';
        }
        return '<div class="cr-site cr-gh"><div class="cr-ghhead"><span class="cr-ghav">' + ic('ic-ure') + '</span>' +
            '<div><h2>IsaacUre</h2><p>Rice ’29 · Mathematical Economic Analysis · builds operating systems by accident</p></div>' +
            '<a class="cr-ghreal" href="https://github.com/IsaacUre" target="_blank" rel="noopener">View on real GitHub ↗</a></div>' +
            '<div class="cr-ghrepos"><b>Pinned</b>' +
              '<div class="cr-ghrepo"><span class="cr-ghname">IsaacUre.github.io</span><span class="cr-ghdesc">isaacure.com — URE BOY, three rooms, a pixel Windows 11, and now a browser inside the browser.</span><span class="cr-ghmeta"><i class="cr-dot" style="background:#f1e05a"></i> JavaScript · ★ 59 · Updated today</span></div>' +
              '<div class="cr-ghrepo dim"><span class="cr-ghname">fsae-financing</span><span class="cr-ghpriv">Private</span><span class="cr-ghdesc">Spreadsheets. So many spreadsheets.</span><span class="cr-ghmeta"><i class="cr-dot" style="background:#277d3a"></i> Excel-adjacent · Updated Friday</span></div>' +
              '<div class="cr-ghrepo dim"><span class="cr-ghname">dm-notes</span><span class="cr-ghpriv">Private</span><span class="cr-ghdesc">If my players find this repo the campaign is over.</span><span class="cr-ghmeta"><i class="cr-dot" style="background:#7b53c9"></i> Markdown · Updated 2 days ago</span></div>' +
            '</div>' +
            '<div class="cr-ghgraph"><b>1,204 contributions in the last year</b><div class="cr-ghcells">' + cells + '</div><span class="cr-ghless">Less <i class="g0"></i><i class="g1"></i><i class="g2"></i><i class="g3"></i><i class="g4"></i> More</span></div></div>';
    }
});

/* — Wikipedia: the GTI article — */
webPage('en.wikipedia.org/wiki/Volkswagen_Golf_GTI', {
    title: 'Volkswagen Golf GTI - Wikipedia', fav: { ch: 'W', c: '#202122' }, searchable: true,
    stitle: 'Volkswagen Golf GTI - Wikipedia', sdesc: 'The Volkswagen Golf GTI is a hot hatch. One particular silver MK8, designated “Argent”, has achieved local notability.', skey: 'gti golf volkswagen argent car hot hatch',
    render: function () {
        return '<div class="cr-site cr-wiki"><div class="cr-wikihead"><span class="cr-wikiglobe">W</span><span><h2>Volkswagen Golf GTI</h2><i>From Wikipedia, the free encyclopedia</i></span></div>' +
            '<div class="cr-wikibody"><div class="cr-wikitext">' +
              '<p>The <b>Volkswagen Golf GTI</b> is a <a>hot hatchback</a> produced since 1976. It is widely credited with defining the segment: practical enough for errands, quick enough to make errands optional.</p>' +
              '<div class="cr-wikitoc"><b>Contents</b><span>1 History</span><span>2 MK8 (2020–present)</span><span>3 Notable examples</span><span>4 See also</span></div>' +
              '<h3>MK8 (2020–present)</h3><p>The eighth generation pairs a 2.0L turbocharged inline-four with opinions about touch controls. Enthusiasts report the chassis forgives what the infotainment does not.</p>' +
              '<h3>Notable examples</h3><p>A silver MK8 operating in the greater Houston area under the designation <b>“Argent”</b><sup>[1]</sup> is maintained by an undergraduate economist. It has appeared in one (1) arcade game, one (1) management sim, and one (1) CRPG as a party member.<sup>[citation needed]</sup></p>' +
              '<h3>See also</h3><p>' + crLink('isaacure.com', 'isaacure.com', 'cr-wikil') + ' · ' + crLink('google.com/search?q=gti%20run', 'GTI RUN (video game)', 'cr-wikil') + '</p>' +
            '</div>' +
            '<div class="cr-wikibox"><b>Volkswagen Golf GTI</b>' + ic('ic-gti', 'cr-wikicar') +
              '<dl><dt>Production</dt><dd>1976–present</dd><dt>Class</dt><dd>Hot hatch</dd><dt>Engine</dt><dd>2.0L turbo I4</dd><dt>Best example</dt><dd>Argent (silver, MK8)</dd><dt>Top speed</dt><dd>redacted per mom</dd></dl></div>' +
            '</div></div>';
    }
});

/* — The Thresher — */
webPage('thresher.rice.edu', {
    title: 'The Rice Thresher', fav: { ch: 'T', c: '#00205b' }, searchable: true,
    stitle: 'The Rice Thresher — student newspaper', sdesc: 'Rice University’s student newspaper since 1916. Photo desk currently overstaffed by one very keen sophomore.', skey: 'rice thresher newspaper news photo',
    render: function () {
        return '<div class="cr-site cr-thr"><div class="cr-thrmast"><h2>THE RICE THRESHER</h2><i>Est. 1916 · Houston, Texas · student-run since before your major existed</i></div>' +
            '<div class="cr-thrgrid">' +
              '<div class="cr-thrlead"><span class="cr-thrkick">CAMPUS</span><h3>Formula SAE team clears first funding milestone</h3><p>The university’s first-ever FSAE entry secured its initial budget this week. “We can afford exactly one wing,” said the team’s financing lead, who asked to be described as “fiscally undefeated.”</p><i>Photo: Isaac Ure / Thresher</i></div>' +
              '<div class="cr-thrcol"><span class="cr-thrkick">A&amp;E</span><h3>Local website now contains entire computer</h3><p>Critics call it “recursive” and “a cry for help rendered at 60fps.”</p></div>' +
              '<div class="cr-thrcol"><span class="cr-thrkick">SPORTS</span><h3>Pickleball club defeats tennis club in annexation dispute</h3><p>The line judge was chamomile tea.</p></div>' +
            '</div></div>';
    }
});

/* — Rice Racing (riceracing.org) — a pixel-faithful replica of the team’s real site;
   the OVERVIEW/TEAM/JOIN/SPONSORS tabs switch panels the way the real one does, and
   every outbound link (the wordmark button, socials, the form) opens the real site. */
webPage('riceracing.org', {
    title: 'Rice Racing', fav: { ch: 'R', c: '#0d1520' }, searchable: true,
    stitle: 'Rice Racing — Rice University Formula SAE', sdesc: 'Rice University’s first Formula SAE team, competing in the IC class at Michigan 2027. Design, build, race.', skey: 'rice racing riceracing fsae formula sae team car michigan 2027 motorsport ic engine',
    render: function () {
        return "<div class=\"cr-rr\"><div class=\"cr-rr-top\"><div class=\"cr-rr-brand\"><span class=\"cr-rr-mark\">RR</span> Rice Racing</div><nav class=\"cr-rr-nav\" aria-label=\"Main navigation\"><button type=\"button\" data-tab=\"overview\">Overview</button><button type=\"button\" data-tab=\"team\">Team</button><button type=\"button\" data-tab=\"join\">Join</button><button type=\"button\" data-tab=\"sponsors\">Sponsors</button><a class=\"cr-rr-live\" href=\"https://riceracing.org\" target=\"_blank\" rel=\"noopener\">riceracing.org ↗</a></nav></div><header class=\"cr-rr-hero\"><div class=\"cr-rr-kicker\">Rice University · Formula SAE</div><h1 class=\"cr-rr-title\">Rice Racing</h1><p class=\"cr-rr-sub\">Rice University’s first Formula SAE team, competing in the IC class at Michigan 2027</p><div class=\"cr-rr-cta\"><a class=\"cr-rr-btn primary\" href=\"https://riceracing.org\" target=\"_blank\" rel=\"noopener\">Visit the live site ↗</a><a class=\"cr-rr-btn\" href=\"mailto:riceracing@rice.edu\">Partner with us</a></div><div class=\"cr-rr-stats\"><div class=\"cr-rr-stat\"><b>120</b><span>Universities compete</span></div><div class=\"cr-rr-stat\"><b>IC</b><span>Internal combustion class</span></div><div class=\"cr-rr-stat\"><b>22 km</b><span>Endurance run</span></div><div class=\"cr-rr-stat\"><b>2027</b><span>Michigan competition</span></div></div></header><section class=\"cr-rr-wrap\"><h2 class=\"cr-rr-eyebrow\">Who Are We</h2><div class=\"cr-rr-whorow\"><div class=\"cr-rr-card\"><h3>What is Formula SAE?</h3><p>A collegiate engineering competition where student teams from 120 universities design, build, and race a small open-wheel car from scratch. Teams are judged on engineering design, cost analysis, business presentations, a 22-kilometer endurance run, and much more.</p><a class=\"cr-rr-arrow\" href=\"https://www.fsaeonline.com/\" target=\"_blank\" rel=\"noopener\">Learn more →</a></div><div class=\"cr-rr-card\"><h3>Our Mission</h3><p>Give Rice students access to one of the most difficult but rewarding collegiate engineering competitions. Our members design, build, and validate every system on the car using industry-standard tools and approaches. We connect our members with industry professionals and open doors for careers in engineering. If interested, reach out to riceracing@rice.edu.</p><a class=\"cr-rr-arrow\" href=\"mailto:riceracing@rice.edu\">Partner with us →</a></div></div></section><section class=\"cr-rr-band\"><div class=\"cr-rr-bandhead\">Build With Us</div><div class=\"cr-rr-tabs\"><button type=\"button\" class=\"cr-rr-tab on\" data-tab=\"updates\">Updates</button><button type=\"button\" class=\"cr-rr-tab\" data-tab=\"team\">Team</button><button type=\"button\" class=\"cr-rr-tab\" data-tab=\"join\">Join</button><button type=\"button\" class=\"cr-rr-tab\" data-tab=\"sponsors\">Sponsors</button></div><div class=\"cr-rr-panel on\" data-panel=\"updates\"><div class=\"cr-rr-wrap\"><h3 class=\"cr-rr-tlhead\">Latest Updates</h3><div class=\"cr-rr-timeline\"><div class=\"cr-rr-ev\"><div class=\"cr-rr-evdate\">APR 23, 2026</div><h4>HENNESSEY PERFORMANCE FACILITY VISIT</h4><p>Rice Racing visited Hennessey Performance's headquarters in Sealy, TX for a full-day experience. The day included a factory tour, an inside look at John Hennessey's personal car collection, and time with the Special Vehicles team around the Venom F5, getting a firsthand look at their tuning and calibration process. The visit wrapped with Texas BBQ and a Q&amp;A with John Hennessey himself. Huge thanks to the Hennessey team for opening their doors and giving us a glimpse into what world-class performance engineering looks like in practice.</p></div><div class=\"cr-rr-ev\"><div class=\"cr-rr-evdate\">APR 22, 2026</div><h4>MERCEDES R&amp;D x RICE RACING</h4><p>Mercedes-Benz R&amp;D North America hosted a virtual recruiting info session in partnership with Rice Racing, featuring guest speaker Jonae Felton, Senior Patent Engineer &amp; Patent Counsel. The session gave our members a direct look at internship and full-time career opportunities across Mercedes-Benz R&amp;D NA, along with candid insight into what a career in automotive R&amp;D and intellectual property looks like. Thank you to Mercedes-Benz R&amp;D North America and Jonae for a genuinely engaging and informative session.</p></div><div class=\"cr-rr-ev\"><div class=\"cr-rr-evdate\">APR 16, 2026</div><h4>OEDK ENGINEERING DESIGN SHOWCASE</h4><p>Rice Racing presented the RR01 initial design at the Huff OEDK Engineering Design Showcase, held at the Ion. The showcase brought together over 80 industry judges and featured more than 80 student projects from across Rice's engineering disciplines. Our team shared the vision and technical direction behind RR01, Rice's first ever Formula SAE car, covering key design decisions across chassis, suspension, aero, powertrain, controls, and electrical systems.</p></div><div class=\"cr-rr-ev\"><div class=\"cr-rr-evdate\">APR 15, 2026</div><h4>FINAL GENERAL BODY MEETING</h4><p>Rice Racing wrapped up the semester in style at our Final General Body Meeting. Members unveiled the team's new merchandise lineup, and everyone celebrated with pizza and drinks as we closed out the year together. The meeting featured a next-year outlook on the team's direction heading into competition season, followed by a tech talk from Rice alumni Silke Hope, VP of Technology at Valvoline. Silke brought a wealth of deep industry insight, covering everything from engineering and leadership to what a career in the motorsports world really looks like. A fitting send-off for an exciting first year.</p></div><div class=\"cr-rr-ev\"><div class=\"cr-rr-evdate\">APR 14, 2026</div><h4>BEN &amp; JERRY'S FREE CONE DAY</h4><p>Rice Racing was proud to serve as the nonprofit partner for the Ben &amp; Jerry's Kirby location at this year's Free Cone Day. We sent volunteers to help run the event, and all donations collected on the day went directly to the team. A huge thank you to Ben &amp; Jerry's Kirby for choosing us as their partner, to everyone who came out and donated, and to our volunteers who gave their time.</p></div><div class=\"cr-rr-ev\"><div class=\"cr-rr-evdate\">MAR 5, 2026</div><h4>24-HOUR CHALLENGE</h4><p>Thank you to our 517 donors who gave during the 24-Hour Challenge. Your support is fueling the next phase of vehicle development and will help us continue fostering an incredible environment for our team to learn and innovate in the upcoming season.</p></div><div class=\"cr-rr-ev\"><div class=\"cr-rr-evdate\">FEB 28, 2026</div><h4>UT ARLINGTON RACING VISIT</h4><p>Thank you to UTA Racing for hosting our leadership team. Seeing one of FSAE's most accomplished programs firsthand, from their vehicle legacy to their design and testing culture, was invaluable. Huge thanks to Dr. Woods and the UTA crew for their hospitality. The countdown to our first vehicle starts now.</p></div><div class=\"cr-rr-ev\"><div class=\"cr-rr-evdate\">FEB 19, 2026</div><h4>DESIGN SESSIONS UNDERWAY</h4><p>Our subteam leads have been running hands-on design sessions to introduce members to the engineering that goes into a Formula SAE car. Powertrain Co-Lead James Clubley led members through a live engine teardown, while Controls Co-Lead Marc Alcolea demonstrated the team's full-scale wooden cockpit mockup, a 1:1 replica of the driver cell used for ergonomics and packaging validation.</p></div><div class=\"cr-rr-ev\"><div class=\"cr-rr-evdate\">FEB 5, 2026</div><h4>FIRST GENERAL BODY MEETING</h4><p>Thank you to everyone who came out to Rice Racing's first General Body Meeting! We were thrilled by the incredible turnout and energy. To stay connected, follow us on Instagram (@RiceFSAE) and join our Slack.</p></div><div class=\"cr-rr-ev\"><div class=\"cr-rr-evdate\">JAN 30, 2026</div><h4>ONBOARDING SUBTEAM LEADS</h4><p>After a competitive selection process, we are proud to announce our new sub-team leads for Rice Racing's debut season. Learn more on the Team page.</p></div><div class=\"cr-rr-ev\"><div class=\"cr-rr-evdate\">DEC 18, 2025</div><h4>ANNOUNCING SUBTEAM LEAD APPLICATIONS<span class=\"cr-rr-badge\">APPLICATIONS CLOSED</span></h4><p>We are excited to officially open applications for Subteam Lead positions for Rice Racing. Subteam leads play a central role in the technical direction, organization, and execution of the team. Our application is due January 18, 2026.</p></div><div class=\"cr-rr-ev goal\"><div class=\"cr-rr-evdate\">DEC 13, 2025</div><h4>ANNOUNCING RICE RACING</h4><div class=\"cr-rr-goalcard\">Build <b>Rice’s first Formula SAE car</b> by Spring 2027.</div></div></div></div></div><div class=\"cr-rr-panel\" data-panel=\"team\" hidden><div class=\"cr-rr-wrap\"><h2 class=\"cr-rr-eyebrow\">The Team</h2><p style=\"color:#C4CEE8;max-width:620px;margin:0 0 8px\">Rice Racing is organized into six technical subteams, each led by students who ran a competitive selection process for the team’s debut season.</p><div class=\"cr-rr-grid3\"><div class=\"cr-rr-sub-t\"><b>Chassis</b><span>Spaceframe design, FEA, and fabrication of the car’s structure.</span></div><div class=\"cr-rr-sub-t\"><b>Suspension</b><span>Kinematics, uprights, and getting the tires to do their job.</span></div><div class=\"cr-rr-sub-t\"><b>Aerodynamics</b><span>Wings, floor, and CFD to trade drag for grip.</span></div><div class=\"cr-rr-sub-t\"><b>Powertrain</b><span>The motorcycle engine, intake, exhaust, and cooling.</span></div><div class=\"cr-rr-sub-t\"><b>Controls</b><span>Driver cell, ergonomics, and vehicle packaging.</span></div><div class=\"cr-rr-sub-t\"><b>Electrical</b><span>Wiring, sensors, and the data that guides every decision.</span></div></div><h2 class=\"cr-rr-eyebrow\" style=\"margin-top:26px\">Leadership</h2><ul class=\"cr-rr-leads\"><li>Will Feng <span>Co-President</span></li><li>James Clubley <span>Powertrain Co-Lead</span></li><li>Marc Alcolea <span>Controls Co-Lead</span></li><li>I. Ure ’29 <span>Finance</span></li></ul><p class=\"cr-rr-note\">Full roster and bios live on the real site — <a class=\"cr-rr-arrow\" href=\"https://riceracing.org\" target=\"_blank\" rel=\"noopener\">riceracing.org ↗</a>.</p></div></div><div class=\"cr-rr-panel\" data-panel=\"join\" hidden><div class=\"cr-rr-wrap\"><h2 class=\"cr-rr-eyebrow\">Build With Us</h2><p style=\"color:#C4CEE8;max-width:620px;margin:0 0 4px\">No experience required — just the willingness to learn and build. We are looking for:</p><div class=\"cr-rr-tags\"><span class=\"cr-rr-tag\">Mech</span><span class=\"cr-rr-tag\">Elec</span><span class=\"cr-rr-tag\">CS</span><span class=\"cr-rr-tag\">Business</span></div><div class=\"cr-rr-joinrow\"><a class=\"cr-rr-btn primary\" href=\"https://docs.google.com/forms/d/e/1FAIpQLSd8Ag9-npDp2YS_EdIa-Gm1km-550qu-A1wf1rFUyRAan4fPw/viewform\" target=\"_blank\" rel=\"noopener\">Join our mailing list ↗</a><a class=\"cr-rr-btn\" href=\"https://instagram.com/ricefsae\" target=\"_blank\" rel=\"noopener\">Instagram @RiceFSAE ↗</a><a class=\"cr-rr-btn\" href=\"mailto:riceracing@rice.edu\">riceracing@rice.edu</a></div><div class=\"cr-rr-goalcard\" style=\"margin-top:8px\"><b>Goal:</b> Build Rice’s first Formula SAE car by Spring 2027.</div></div></div><div class=\"cr-rr-panel\" data-panel=\"sponsors\" hidden><div class=\"cr-rr-wrap\"><h2 class=\"cr-rr-eyebrow\">Partner With Us</h2><p style=\"color:#C4CEE8;max-width:640px;margin:0 0 6px\">Rice Racing is building the university’s first Formula SAE car from scratch. Sponsors make that possible — and get a direct line to a driven, hands-on group of Rice engineers.</p><ul class=\"cr-rr-bul\"><li>Your name and logo on the RR01 livery, our paddock setup, and team apparel.</li><li>First look at our members for internships and full-time roles.</li><li>Invitations to design reviews, our garage, and competition at Michigan 2027.</li><li>Support that goes straight into materials, tooling, and the engine.</li></ul><div class=\"cr-rr-joinrow\"><a class=\"cr-rr-btn primary\" href=\"mailto:riceracing@rice.edu\">Partner with us →</a><a class=\"cr-rr-btn\" href=\"https://riceracing.org\" target=\"_blank\" rel=\"noopener\">Sponsorship on the live site ↗</a></div><p class=\"cr-rr-note\">Reach out any time at riceracing@rice.edu.</p></div></div></section><footer class=\"cr-rr-foot\"><span>Rice Racing · Houston, TX</span><a href=\"mailto:riceracing@rice.edu\">riceracing@rice.edu</a><a class=\"cr-rr-arrow\" href=\"https://instagram.com/ricefsae\" target=\"_blank\" rel=\"noopener\">Instagram @RiceFSAE</a><a class=\"cr-rr-arrow\" href=\"https://riceracing.org\" target=\"_blank\" rel=\"noopener\">riceracing.org ↗</a></footer></div>";
    },
    init: function (view) {
        var panels = view.querySelectorAll('.cr-rr-panel'), tabs = view.querySelectorAll('.cr-rr-tab');
        function show(name) {
            for (var i = 0; i < panels.length; i++) { var on = panels[i].getAttribute('data-panel') === name; panels[i].hidden = !on; panels[i].classList.toggle('on', on); }
            for (var j = 0; j < tabs.length; j++) tabs[j].classList.toggle('on', tabs[j].getAttribute('data-tab') === name);
        }
        view.addEventListener('click', function (e) {
            var b = e.target.closest('[data-tab]'); if (!b) return;   // real <a> links (live site, socials) fall through to the browser
            var name = b.getAttribute('data-tab');
            if (name === 'overview') { view.scrollTop = 0; return; }   // OVERVIEW is the top of the page
            show(name);
            if (b.closest('.cr-rr-nav')) { var band = view.querySelector('.cr-rr-band'); if (band) band.scrollIntoView({ block: 'start' }); }   // top-nav taps jump to the band
        });
    }
});

/* — Gmail gag — */
webPage('mail.google.com', {
    title: 'Gmail', fav: { ch: 'M', c: '#ea4335' }, searchable: true,
    stitle: 'Gmail — email by Google', sdesc: 'One (1) unread message. It is from fsae_treasury. It is an invoice.', skey: 'gmail email mail google',
    render: function () {
        return '<div class="cr-site cr-gmail"><div class="cr-gmhead"><b style="color:#ea4335">M</b> Gmail <span class="cr-gmcount">1 unread</span></div>' +
            '<div class="cr-gmrow unread"><b>fsae_treasury</b><span>INVOICE #0042 — one (1) wing, as discussed</span><i>4:12 PM</i></div>' +
            '<div class="cr-gmrow"><b>Rice Housing</b><span>Your fall assignment (do not reply) (we mean it)</span><i>Jul 7</i></div>' +
            '<div class="cr-gmrow"><b>Deep Blue</b><span>RE: newsletter draft — “love the GTI metaphor, cut the other twelve”</span><i>Jul 3</i></div>' +
            '<div class="cr-gmfoot">This is a museum inbox. The real one is safe, private, and also mostly invoices.</div></div>';
    }
});

/* — chrome://dino — */
webPage('chrome://dino', {
    title: 'chrome://dino', fav: { ic: 'ic-chrome' },
    render: function () {
        return '<div class="cr-dino"><div class="cr-dinohud"><span>HI ' + String(+recall('chrome_dino_hi', 0)).padStart(5, '0') + '</span><span id="crDinoScore">00000</span></div>' +
            '<canvas id="crDinoCv" width="600" height="160"></canvas>' +
            '<p class="cr-dinotip" id="crDinoTip">Press SPACE, ↑, or click to jump. The desert is procedurally hostile.</p></div>';
    },
    init: function (view) { crDinoBoot(view); }
});

/* — error page — */
webPage('__err', {
    title: 'Site can’t be reached', fav: { ch: '!', c: '#9aa0a6' },
    render: function (host) {
        return '<div class="cr-err"><span class="cr-errdino">🦖</span><h2>This site can’t be reached</h2>' +
            '<p><b>' + esc(host || 'that') + '</b> doesn’t exist on this machine’s tiny, curated internet.</p>' +
            '<p class="cr-errcode">ERR_NAME_NOT_RESOLVED_ (it’s a museum)</p>' +
            '<div class="cr-errbtns"><button class="cr-btn" id="crErrBack">Go back</button>' + crLink('chrome://dino', 'Play the dino instead', 'cr-btn ghost') + '</div></div>';
    },
    init: function (view) { var b = view.querySelector('#crErrBack'); if (b) b.addEventListener('click', crBack); }
});

/* — chrome://settings — */
webPage('chrome://settings', {
    title: 'Settings', fav: { ic: 'ic-settings' }, nohist: false,
    render: function () {
        var s = crSet();
        return '<div class="cr-setts"><nav class="cr-setnav">' +
            '<span class="on">' + ic('ic-user') + ' You and Google</span><span>' + ic('ic-search') + ' Search engine</span><span><i class="gl">✎</i> Appearance</span><span><i class="gl">⏻</i> On startup</span><span><i class="gl">ⓘ</i> About Chrome</span></nav>' +
            '<div class="cr-setbody">' +
              '<div class="cr-setcard"><div class="cr-setme">' + ic('ic-ure', 'cr-setav') + '<div><b>Isaac Ure</b><span>isaacoure@gmail.com · Sync is on (trust me)</span></div><button class="cr-chip" data-cract="sync">Turn off</button></div></div>' +
              '<div class="cr-setcard"><h3>Appearance</h3>' +
                '<label class="cr-setrow"><span>Show bookmarks bar</span><button class="tgl' + (s.bmbar ? ' on' : '') + '" data-cract="bmbar" role="switch"></button></label>' +
                '<label class="cr-setrow"><span>Theme</span><span class="cr-setval">Pixel (system) — the only theme</span></label></div>' +
              '<div class="cr-setcard"><h3>Search engine</h3>' +
                '<label class="cr-setrow"><span>Search engine used in the address bar</span><select class="cr-sel" data-cract="engine"><option value="google"' + (s.engine !== 'ure' ? ' selected' : '') + '>Google</option><option value="ure"' + (s.engine === 'ure' ? ' selected' : '') + '>URE Search</option></select></label></div>' +
              '<div class="cr-setcard"><h3>Default browser</h3><label class="cr-setrow"><span>Google Chrome is your default browser</span><span class="cr-setval good">✓ Finally</span></label>' +
                '</div>' +
              '<div class="cr-setcard"><h3>About Chrome</h3><label class="cr-setrow"><span>Version 126.0.pixel.1 (Official Build) (64-bit) (UreOS)</span><span class="cr-setval good" id="crUpd">✓ Chrome is up to date</span></label>' +
                '<label class="cr-setrow"><span>Check for updates</span><button class="cr-chip" data-cract="update">Check</button></label></div>' +
            '</div></div>';
    },
    init: function (view) {
        view.addEventListener('click', function (e) {
            var b = e.target.closest('[data-cract]'); if (!b) return;
            var a = b.getAttribute('data-cract'), s = crSet();
            if (a === 'bmbar') { s.bmbar = s.bmbar ? 0 : 1; crjSet('set', s); b.classList.toggle('on', !!s.bmbar); crChrome(); }
            else if (a === 'sync') toast('Sync stays on. The cloud is a gist and it loves you.');
            else if (a === 'update') { var u = view.querySelector('#crUpd'); if (u) u.textContent = '↻ Checking…'; setTimeout(function () { if (u) u.textContent = '✓ Chrome is up to date'; toast('Nearly updated itself mid-sentence. Classic.'); }, reduce ? 100 : 900); }
        });
        var sel = view.querySelector('[data-cract="engine"]');
        if (sel) sel.addEventListener('change', function () { var s = crSet(); s.engine = sel.value; crjSet('set', s); toast('Address-bar search: ' + crEngine() + '.'); });
        view.querySelectorAll('.cr-setnav span:not(.on)').forEach(function (n) { n.addEventListener('click', function () { toast('It all lives on one page here. Museum floor plan.'); }); });
    }
});

/* — chrome://history — */
webPage('chrome://history', {
    title: 'History', fav: { ic: 'ic-chrome' },
    render: function () {
        var h = crHist();
        var rows = h.length ? h.map(function (it, i) {
            var d = new Date(it.ts);
            return '<div class="cr-hrow">' + crLink(it.u, crFav((WEB[crResolveKey(it.u)] || {}).fav) + '<b>' + esc(it.t) + '</b><span>' + esc(it.u) + '</span>', 'cr-hlink') +
                '<i>' + fmtTime(d) + '</i><button class="cr-hx" data-hx="' + i + '" aria-label="Remove">×</button></div>';
        }).join('') : '<p class="cr-empty">Your browsing history appears here. It is currently as clean as your conscience.</p>';
        return '<div class="cr-hist"><div class="cr-histhead"><h2>History</h2><input class="cr-hq" placeholder="Search history" spellcheck="false">' +
            '<button class="cr-chip" id="crClear">Clear browsing data</button></div><div class="cr-hgroup">Today</div><div id="crHRows">' + rows + '</div></div>';
    },
    init: function (view) {
        view.addEventListener('click', function (e) {
            var x = e.target.closest('.cr-hx');
            if (x) { var h = crHist(); h.splice(+x.getAttribute('data-hx'), 1); crjSet('hist', h); crPage(); return; }
            if (e.target.closest('#crClear')) {
                crjSet('hist', []); crPage();
                toast('Browsing data cleared. You were never here. (You were on your own website.)');
            }
        });
        var q = view.querySelector('.cr-hq');
        if (q) q.addEventListener('input', function () {
            var f = q.value.toLowerCase();
            view.querySelectorAll('.cr-hrow').forEach(function (r) { r.style.display = r.textContent.toLowerCase().indexOf(f) >= 0 ? '' : 'none'; });
        });
    }
});

/* — chrome://bookmarks — */
webPage('chrome://bookmarks', {
    title: 'Bookmarks', fav: { ic: 'ic-chrome' },
    render: function () {
        var rows = crBM().map(function (b, i) {
            return '<div class="cr-hrow">' + crLink(b[1], crFav((WEB[crResolveKey(b[1])] || {}).fav) + '<b>' + esc(b[0]) + '</b><span>' + esc(b[1]) + '</span>', 'cr-hlink') +
                '<button class="cr-hx" data-bx="' + i + '" aria-label="Remove">×</button></div>';
        }).join('');
        return '<div class="cr-hist"><div class="cr-histhead"><h2>Bookmarks</h2><span class="cr-setval">star a page to add it</span></div><div id="crBRows">' + (rows || '<p class="cr-empty">No bookmarks. The star button is right there.</p>') + '</div></div>';
    },
    init: function (view) {
        view.addEventListener('click', function (e) {
            var x = e.target.closest('.cr-hx'); if (!x) return;
            var bm = crBM(); bm.splice(+x.getAttribute('data-bx'), 1); crjSet('bm', bm); crPage(); crChrome();
        });
    }
});

/* — chrome://downloads — */
webPage('chrome://downloads', {
    title: 'Downloads', fav: { ic: 'ic-chrome' },
    render: function () {
        var items = (fsLoad().add['Downloads'] || []);
        var rows = items.length ? items.map(function (it) {
            return '<div class="cr-hrow"><span class="cr-hlink static">' + ic(FS_ICON[it.t] || 'ic-notepad', 'cr-fav') + '<b>' + esc(it.n) + '</b><span>' + esc(it.size || '') + (it.date ? ' · ' + esc(it.date) : '') + '</span></span>' +
                '<button class="cr-chip" data-show="1">Show in folder</button></div>';
        }).join('') : '<p class="cr-empty">Nothing downloaded.</p>';
        return '<div class="cr-hist"><div class="cr-histhead"><h2>Downloads</h2></div>' + rows + '</div>';
    },
    init: function (view) {
        view.addEventListener('click', function (e) { if (e.target.closest('[data-show]')) openApp('explorer', 'Downloads'); });
    }
});

/* — view-source: (right-click → View page source) — a real page whose
   content is the target site's actual render() output, escaped, split
   onto numbered lines, with tags/attributes/strings tinted like the
   real thing. The target comes off the active tab's URL directly. */
webPage('__viewsource', {
    title: 'view-source', fav: { ch: '</>', c: '#5f6368' },
    render: function () {
        var target = String(crTab().url).replace(/^(view-source:)+/i, '');
        var s = crSite(target);
        if (s === WEB['__viewsource']) s = WEB.__err;   // never render ourselves — that way lies recursion
        var html = s === WEB.__err ? s.render(String(target).split('/')[0]) : s.render(crQOf(target));
        var lines = html.replace(/></g, '>\n<').split('\n');
        return '<div class="cr-src"><ol>' + lines.map(function (ln) {
            var h = esc(ln)
                .replace(/(&quot;[^&]*?&quot;)/g, '<i class="ss">$1</i>')
                .replace(/([a-z-]+)=(?=<i class="ss">)/gi, '<i class="sa">$1</i>=')
                .replace(/(&lt;\/?)([a-z][a-z0-9-]*)/gi, '$1<i class="st">$2</i>');
            return '<li>' + h + '</li>';
        }).join('') + '</ol></div>';
    }
});

/* ════════════════════ the LIVE web ════════════════════
   The museum grows windows. A handful of real sites are CORS-open
   to any static page, so this Chrome genuinely browses them:
   Wikipedia (any article), Hacker News (front page + threads),
   GitHub (any profile or repo), Open-Meteo (real weather). Each
   is fetched client-side and re-rendered in the house style —
   no proxy, no server, no dependencies, same as everything else.
   Everything NOT understood falls through to a sandboxed iframe
   (__frame) that loads the honest-to-goodness site when it lets us.
   ════════════════════════════════════════════════════════ */
/* null prototype on every map keyed by user input or a fetched URL: a bare
   {} inherits constructor/toString/valueOf, so looking up those words returns a
   truthy non-entry and the caller then treats a Function as data. */
var LIVE_CACHE = Object.create(null);                     // url → { t, v } · session-only, 5 min TTL
var LIVE_TITLES = Object.create(null);                    // url → real page title, learned after load
function liveCacheGet(u) { var e = LIVE_CACHE[u]; return e && Date.now() - e.t < 300000 ? e.v : null; }
function liveCachePut(u, v) {
    var ks = Object.keys(LIVE_CACHE);
    if (ks.length > 48) delete LIVE_CACHE[ks[0]];         // insertion order: oldest goes first
    LIVE_CACHE[u] = { t: Date.now(), v: v };
}
/* a wire field the renderer treats as a number gets coerced to one, so the
   "nothing from the wire touches innerHTML unguarded" invariant holds even for
   the counts and temperatures — a string (schema change, MITM) becomes 0, not
   markup. esc() guards the text fields; nnum() guards the numeric ones. */
function nnum(n) { n = +n; return isFinite(n) ? n : 0; }
/* fetch JSON with a timeout, an offline check, and the cache in front.
   incognito neither reads nor writes the cache — a private fetch must not leave
   its response body behind for a normal tab, nor reuse one it left there. */
function liveGet(url, cb) {
    var priv = !!(CR && CR.incog);
    if (!priv) { var hit = liveCacheGet(url); if (hit) { cb(null, hit); return; } }
    if (navigator.onLine === false) { cb('offline'); return; }
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tmr = setTimeout(function () { if (ctl) ctl.abort(); }, 9000);
    fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
        clearTimeout(tmr);
        if (!r.ok) { cb('http' + r.status, null, r); return null; }
        return r.json().then(function (j) { if (!priv) liveCachePut(url, j); cb(null, j); });
    }).catch(function () { clearTimeout(tmr); cb('net'); });
}
/* the tab's URL with any view-source: prefix stripped — live pages parse their
   own path from it, the same way __viewsource reads the tab directly */
function liveUrl() { return String(crTab().url).replace(/^(view-source:)+/i, '').replace(/^https?:\/\//i, '').replace(/^www\./i, ''); }
function livePath(host) {
    var u = liveUrl();
    return u.toLowerCase().indexOf(host) === 0 ? u.slice(host.length).replace(/^\//, '') : '';
}
/* ── sanitizer: real HTML → the small tag set this browser trusts ──
   Parsed in an inert document (scripts never run), then rebuilt node by
   node against a whitelist. Nothing from the wire touches innerHTML.
   Links come back as the sim's own cr-l buttons via linkFn. */
var LIVE_TAGS = { P: 'p', B: 'b', STRONG: 'b', I: 'i', EM: 'i', UL: 'ul', OL: 'ol', LI: 'li', H2: 'h3', H3: 'h4', H4: 'h4', BLOCKQUOTE: 'blockquote', CODE: 'code', PRE: 'pre', BR: 'br', SUP: 'sup', SUB: 'sub' };
var LIVE_DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, SVG: 1, MATH: 1, TABLE: 1, FIGURE: 1, IMG: 1, VIDEO: 1, AUDIO: 1, LINK: 1, META: 1, FORM: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1, CANVAS: 1, TEMPLATE: 1, NOSCRIPT: 1 };
function liveSanitize(html, linkFn) {
    var doc;
    try { doc = new DOMParser().parseFromString(String(html || ''), 'text/html'); } catch (e) { return ''; }
    var out = document.createElement('div');
    (function walk(src, dst, depth) {
        if (depth > 40) return;
        for (var n = src.firstChild; n; n = n.nextSibling) {
            if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.nodeValue)); continue; }
            if (n.nodeType !== 1) continue;
            var tag = n.nodeName.toUpperCase();
            if (LIVE_DROP[tag]) {
                /* A dropped node usually has nothing worth keeping — but Wikipedia
                   ships every formula as <math> plus an <img> fallback, with the
                   TeX sitting in alttext/alt. Dropping the subtree silently deleted
                   it, so "defined as <formula> for <formula>" became "defined as
                   for" on every maths article. Keep the text, drop the markup. */
                var alt = n.getAttribute && (n.getAttribute('alttext') || n.getAttribute('alt'));
                if (alt) {
                    alt = String(alt).replace(/^\{\\displaystyle\s*/, '').replace(/\}$/, '').trim();
                    // the <math> and its <img> fallback carry the SAME TeX, so
                    // emitting both would print every formula twice
                    var prev = dst.lastChild;
                    var dupe = prev && prev.nodeType === 1 && prev.nodeName === 'CODE' && prev.textContent === alt;
                    if (alt && alt.length < 400 && !dupe) {
                        var code = document.createElement('code');
                        code.appendChild(document.createTextNode(alt));
                        dst.appendChild(code);
                    }
                }
                continue;
            }
            if (tag === 'A') {
                var to = linkFn ? linkFn(n.getAttribute('href') || '') : null;
                if (!to) { walk(n, dst, depth + 1); continue; }        // unroutable link: keep its text
                var a = document.createElement('a');
                a.className = 'cr-l cr-lva';
                a.setAttribute('data-href', to);
                /* a bare <a> with no href is not a link to the keyboard or a
                   screen reader — it is unfocusable and unannounced. Give it a
                   real href for semantics; the delegated handler still routes
                   the click inside the sim, and preventDefault stops the browser
                   from actually leaving the page. */
                a.setAttribute('href', 'https://' + String(to).replace(/^https?:\/\//i, ''));
                walk(n, a, depth + 1);
                dst.appendChild(a);
                continue;
            }
            var mapped = LIVE_TAGS[tag];
            if (mapped) {
                var el = document.createElement(mapped);
                walk(n, el, depth + 1);
                dst.appendChild(el);
            } else {
                walk(n, dst, depth + 1);                               // unknown container: unwrap, keep the words
            }
        }
    })(doc.body, out, 0);
    return out.innerHTML;
}
/* shared live-page states, in the museum's voice */
function liveSkeleton(label) {
    return '<div class="cr-lv"><div class="cr-lvload"><span class="cr-lvspin"></span><p>Fetching the real ' + esc(label) + '…</p>' +
        '<i>an actual network request is happening inside the fake computer</i></div></div>';
}
function liveFail(err, what, r) {
    if (err === 'offline' || err === 'net') {
        return '<div class="cr-err"><span class="cr-errdino">🦖</span><h2>The real internet didn’t answer</h2>' +
            '<p>' + esc(what) + ' needs the outside world, and the outside world is ' + (err === 'offline' ? 'offline' : 'not picking up') + '.</p>' +
            '<p class="cr-errcode">ERR_INTERNET_ACTUALLY_DISCONNECTED</p>' +
            '<div class="cr-errbtns"><button class="cr-btn" id="crErrBack">Go back</button>' + crLink('chrome://dino', 'Play the dino — he was built for this', 'cr-btn ghost') + '</div></div>';
    }
    if (err === 'http403' && r && r.headers && r.headers.get('x-ratelimit-remaining') === '0') {
        var reset = +r.headers.get('x-ratelimit-reset') * 1000;
        return '<div class="cr-err"><span class="cr-errdino">⏳</span><h2>Rate limited</h2>' +
            '<p>GitHub gives anonymous museums 60 requests an hour. They ran out.</p>' +
            '<p class="cr-errcode">Resets ' + (reset ? 'around ' + fmtTime(new Date(reset)) : 'within the hour') + '</p>' +
            '<div class="cr-errbtns"><button class="cr-btn" id="crErrBack">Go back</button></div></div>';
    }
    /* a 404 is not "strange" — it is the single most ordinary answer on the web,
       and saying so is the difference between "you typo'd" and "this is broken" */
    if (err === 'http404' || err === 'empty') {
        return '<div class="cr-err"><span class="cr-errdino">🔎</span><h2>Nothing here by that name</h2>' +
            '<p>' + esc(what) + ' has no page at that address. Check the spelling, or search for it instead.</p>' +
            '<div class="cr-errbtns"><button class="cr-btn" id="crErrBack">Go back</button>' +
            crLink('google.com/search?q=' + encodeURIComponent(String(liveUrl()).split('/').pop().replace(/_/g, ' ')), 'Search for it', 'cr-btn ghost') + '</div></div>';
    }
    return '<div class="cr-err"><span class="cr-errdino">🦖</span><h2>That didn’t load</h2>' +
        '<p>' + esc(what) + ' answered strangely (' + esc(String(err)) + '). The real web does that sometimes.</p>' +
        '<div class="cr-errbtns"><button class="cr-btn" id="crErrBack">Go back</button></div></div>';
}
function liveWireBack(view) { var b = view.querySelector('#crErrBack'); if (b) b.addEventListener('click', crBack); }
/* the geocoder came back empty (or unreachable) for a directly-typed city */
function wxNoCity(name, err) {
    if (err === 'offline' || err === 'net' || /^http/.test(String(err))) return liveFail(err, 'Open-Meteo');
    return '<div class="cr-err"><span class="cr-errdino">🗺️</span><h2>No such place</h2>' +
        '<p>The real atlas has no “<b>' + esc(name) + '</b>”. Check the spelling, or try a bigger nearby city.</p>' +
        '<div class="cr-errbtns"><button class="cr-btn" id="crErrBack">Go back</button>' + crLink('open-meteo.com', 'Weather home', 'cr-btn ghost') + '</div></div>';
}
/* fill a live view when the fetch lands — but only if the user is still there.
   crPage swaps the view node on every navigation, so a stale response writes
   into a detached div and vanishes. isConnected is the whole race guard. */
function liveFill(view, url, html, title) {
    if (!view.isConnected) return;
    view.innerHTML = html;
    liveWireBack(view);
    if (title && CR) {
        if (!CR.incog) {                                   // a private page's real title stays out of the shared map
            if (Object.keys(LIVE_TITLES).length > 80) LIVE_TITLES = Object.create(null);   // check BEFORE the set, or the 81st write is wiped with the rest
            LIVE_TITLES[url] = title;
            var h = crHist();                              // retitle the history entry the nav just wrote
            for (var i = 0; i < h.length; i++) if (h[i].u === url) { h[i].t = title; break; }
            crjSet('hist', h);
        }
        crTabs();
    }
    if (find.appId === 'chrome' && findOpenNow()) runFind();
}
/* the little proof-of-life chip live pages wear */
function liveChip() { return '<span class="cr-lvchip" title="Fetched from the real site just now">● live</span>'; }

/* ── real search: snippet plumbing ──
   a search snippet arrives as HTML (Wikipedia wraps matches in <span
   class="searchmatch">). Take its PLAIN text, then re-bold the query terms
   ourselves — escaping each segment independently, so nothing from the wire
   is ever concatenated into markup and no entity gets corrupted mid-bold. */
function snipText(html) {
    try { return new DOMParser().parseFromString(String(html || ''), 'text/html').body.textContent || ''; }
    catch (e) { return String(html || '').replace(/<[^>]*>/g, ''); }
}
function snipHighlight(html, q) {
    var txt = snipText(html);
    var words = String(q || '').trim().split(/\s+/).filter(function (w) { return w.length > 1; })
        .map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    if (!words.length) return esc(txt);
    var re = new RegExp('(' + words.join('|') + ')', 'gi'), out = '', last = 0, m;
    while ((m = re.exec(txt))) {
        out += esc(txt.slice(last, m.index)) + '<b>' + esc(m[0]) + '</b>';
        last = m.index + m[0].length;
        if (re.lastIndex === m.index) re.lastIndex++;      // zero-width guard
        if (out.length > 4000) break;                      // a pathological snippet can't balloon the DOM
    }
    return out + esc(txt.slice(last));
}
/* one SERP section: a header, then rows, an empty note, or an error note.
   fills a pre-placed #slot so the three sources can land in any order and the
   layout never jumps. every fill is guarded by the caller's view.isConnected. */
function serpSection(label, err, rowsHtml, emptyMsg) {
    var h = '<h4 class="cr-serph">' + esc(label) + '</h4>';
    if (err === 'rate') return h + '<p class="cr-serpnote">' + esc(label) + ' allows only a few anonymous searches a minute — it just hit the limit. Try again shortly.</p>';
    if (err === 'badq') return h + '<p class="cr-serpnote">' + esc(label) + ' couldn’t parse that query.</p>';
    if (err) return h + '<p class="cr-serpnote">Couldn’t reach ' + esc(label) + ' (' + esc(String(err)) + ').</p>';
    if (!rowsHtml) return h + '<p class="cr-serpnote">' + esc(emptyMsg || 'No results.') + '</p>';
    return h + rowsHtml;
}
/* the three real sources. each takes the query + a done() it calls once, and is
   entirely self-contained so one source failing never blocks another. serpWiki
   returns (featuredCardHtml, restSectionHtml, totalHits) so the caller drops the
   card and the rows into their own slots — no fragile string re-splitting. */
function serpWiki(q, feat, done) {
    liveGet('https://en.wikipedia.org/w/api.php?format=json&origin=*&action=query&list=search&srlimit=6&srinfo=totalhits|suggestion&srprop=snippet&srsearch=' + encodeURIComponent(q), function (err, j, r) {
        if (err || !j || !j.query || !j.query.search) { done('', serpSection('Wikipedia', err || 'empty'), null); return; }
        var info = j.query.searchinfo || {}, hits = j.query.search, total = info.totalhits, sug = info.suggestion || '';
        if (!hits.length) { done('', serpSection('Wikipedia', null, null), 0, sug); return; }
        var top = hits[0];
        var turl = 'en.wikipedia.org/wiki/' + top.title.replace(/ /g, '_');
        var featHtml = feat ? '<div class="cr-serpfeat">' + crLink(turl, '<span class="cr-featt">' + esc(top.title) + '</span>', 'cr-featlink') +
            '<span class="cr-featsrc">Wikipedia</span><p class="cr-featsnip">' + snipHighlight(top.snippet, q) + '…</p>' +
            crLink(turl, 'Read the full article →', 'cr-featmore') + '</div>' : '';
        var list = feat ? hits.slice(1, 5) : hits.slice(0, 5);
        var rows = list.map(function (h) {
            var u = 'en.wikipedia.org/wiki/' + h.title.replace(/ /g, '_');
            return serpRow(u, 'en.wikipedia.org › wiki › ' + esc(h.title), { ch: 'W', c: '#202122' }, h.title, snipHighlight(h.snippet, q) + '…');
        }).join('');
        // a single-hit query has no "rest" — show only the featured card, no contradictory empty note
        done(featHtml, rows ? serpSection(feat ? 'More from Wikipedia' : 'Wikipedia', null, rows) : '', total, sug);
    });
}
function serpGH(q, done) {
    liveGet('https://api.github.com/search/repositories?per_page=4&sort=stars&q=' + encodeURIComponent(q), function (err, j, r) {
        if (err) { done(serpSection('Code · GitHub', err === 'http403' || err === 'http429' ? 'rate' : err === 'http422' ? 'badq' : err)); return; }
        if (!j || !j.items || !j.items.length) { done(serpSection('Code · GitHub', null, null, 'No repositories match.')); return; }
        var rows = j.items.slice(0, 4).map(function (rp) {
            var meta = '★ ' + nnum(rp.stargazers_count).toLocaleString() + (rp.language ? ' · ' + esc(rp.language) : '');
            return serpRow('github.com/' + rp.full_name, 'github.com › ' + esc(rp.full_name), { ch: 'G', c: '#24292f' }, rp.full_name,
                (rp.description ? esc(rp.description) + ' ' : '') + '<span class="cr-serpmeta">' + meta + '</span>');
        }).join('');
        done(serpSection('Code · GitHub', null, rows));
    });
}
function serpHN(q, done) {
    liveGet('https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=5&query=' + encodeURIComponent(q), function (err, j, r) {
        if (err || !j || !j.hits) { done(serpSection('Discussion · Hacker News', err || 'empty')); return; }
        var hits = j.hits.filter(function (h) { return h.title; });
        if (!hits.length) { done(serpSection('Discussion · Hacker News', null, null, 'No discussions found.')); return; }
        var rows = hits.slice(0, 4).map(function (h) {
            var item = 'news.ycombinator.com/item?id=' + h.objectID;
            return serpRow(item, 'news.ycombinator.com › item', { ch: 'Y', c: '#ff6600' }, h.title,
                '<span class="cr-serpmeta">' + nnum(h.points) + ' points · ' + nnum(h.num_comments) + ' comments · ' + esc(h.author || '?') + '</span>');
        }).join('');
        done(serpSection('Discussion · Hacker News', null, rows));
    });
}
/* one result row, Google-shaped: url line, blue title, snippet */
/* ── query intent ──
   Google doesn't fire every pack on every search and neither do we: read the
   shape of the query first, then only fetch what fits. Keeps a search to two
   or three requests instead of nine, and keeps us polite to free APIs. */
function serpIntent(q) {
    var s = String(q || '').trim(), l = s.toLowerCase();
    /* a hyphen between digits is ambiguous — subtraction, or a phone number, or
       a year range. Those two shapes are common enough as real queries that the
       calculator must not swallow them (1-800-273-8255 is not -9327). */
    var phoneish = /^\+?\d{1,4}([-\s.]\d{2,5}){2,}$/.test(s) || /^\d{4}\s*-\s*\d{4}$/.test(s);
    /* A bare d/d is a date far more often than a division when it is a VALID
       month/day — "9/11" and "10/4" are queries, not sums. Validity is what
       keeps real arithmetic working: 1/0 (day 0) and 100/7 (no such month)
       are not dates, so they still calculate. Anything with a second operator
       or spaces is arithmetic regardless. */
    var dm = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    var dateish = !!dm && +dm[1] >= 1 && +dm[1] <= 12 && +dm[2] >= 1 && +dm[2] <= 31;
    if (!phoneish && !dateish && /^[-+.\d\s()*/^%]+$/.test(s) && /[+\-*/^%]/.test(s) && /\d/.test(s)) return { kind: 'math' };
    var u = l.match(/^([-+]?[\d.,]+)\s*([a-z°"']+)\s+(?:in|to|as)\s+([a-z°"']+)\??$/);
    if (u && /^[-+]?(\d{1,3}(,\d{3})+|\d*)(\.\d+)?$/.test(u[1]) && /\d/.test(u[1])) {
        // 1,5 (European decimal) and 1.5.2 are malformed here, not silently reinterpreted
        return { kind: 'unit', n: parseFloat(u[1].replace(/,/g, '')), from: u[2], to: u[3] };
    }
    var t = l.match(/^(?:what(?:'s| is)? the )?time (?:in|at) (.+?)\??$/);
    if (t) return { kind: 'time', place: t[1] };
    var d = l.match(/^(?:define|definition of|meaning of|what does)\s+(.+?)(?:\s+mean)?\??$/);
    if (d && /^[a-z][a-z' -]{1,30}$/.test(d[1])) return { kind: 'define', word: d[1].trim() };
    /* "<place> weather" only counts when the prefix could actually BE a place:
       short, and free of the function words that mark a question. The old
       pattern turned "is the weather" and "what causes extreme weather" into a
       geocode and showed a real forecast for somewhere never asked about. */
    var w = l.match(/^weather(?:\s+(?:in|at|for))?\s+(.+?)\??$/);
    if (!w) {
        var tail = l.match(/^([a-z][a-z .'-]{1,28})\s+weather\??$/);
        if (tail && !/\b(is|are|was|the|a|an|of|for|what|why|how|when|does|do|causes?|extreme|severe|bad|good|todays?|tomorrows?)\b/.test(tail[1]))
            w = tail;
    }
    if (w) return { kind: 'weather', place: w[1] };
    var m = l.match(/^(?:where is|map of|directions to)\s+(.+?)\??$/);
    if (m) return { kind: 'map', place: m[1] };
    if (/\b(error|exception|typeerror|undefined|npm|pip|git|regex|async|await|segfault|stacktrace|compile|syntax)\b/.test(l)
        || /\b(python|javascript|typescript|rust|golang|java|c\+\+|sql|bash|css|html)\b/.test(l)) return { kind: 'code' };
    return { kind: 'general' };
}
/* ── instant answers that never touch the network ── */
/* a real shunting-yard evaluator: eval() on user text is how you get owned.
   precedences are doubled so unary minus can sit BETWEEN * and ^ — that is what
   makes -2^2 = -4 (Google/Python) while 2^-3 still = 0.125. 'u' is prefix, so
   pushing it must never pop: a prefix operator has no left operand to bind. */
var MATH_OPS = { '+': [2, 'l'], '-': [2, 'l'], '*': [4, 'l'], '/': [4, 'l'], '%': [4, 'l'], 'u': [5, 'r'], '^': [6, 'r'] };
function mathEval(src) {
    var toks = String(src).match(/(\d+\.?\d*|\.\d+|[-+*/^%()])/g);
    if (!toks || toks.length > 200) return null;
    var out = [], ops = [], prev = null;
    for (var i = 0; i < toks.length; i++) {
        var t = toks[i];
        if (/^[\d.]/.test(t)) {
            if ((t.match(/\./g) || []).length > 1) return null;          // 1.2.3 is not a number
            var v = parseFloat(t); if (!isFinite(v)) return null;
            out.push(v);
        }
        else if (t === '(') ops.push(t);
        else if (t === ')') {
            while (ops.length && ops[ops.length - 1] !== '(') if (!mathPop(out, ops.pop())) return null;
            if (!ops.length) return null;                                 // unbalanced
            ops.pop();
            if (out.length < 1) return null;                              // "()" has no value
        } else if (MATH_OPS[t]) {
            var unary = (t === '-' || t === '+') && (prev === null || prev === '(' || (MATH_OPS[prev] && prev !== ')'));
            if (unary) { if (t === '-') ops.push('u'); prev = t; continue; }   // '+x' is a no-op; prefix never pops
            var o = MATH_OPS[t];
            while (ops.length && MATH_OPS[ops[ops.length - 1]] &&
                   (MATH_OPS[ops[ops.length - 1]][0] > o[0] || (MATH_OPS[ops[ops.length - 1]][0] === o[0] && o[1] === 'l')))
                if (!mathPop(out, ops.pop())) return null;
            ops.push(t);
        } else return null;
        prev = t;
    }
    while (ops.length) { var op = ops.pop(); if (op === '(' || !mathPop(out, op)) return null; }
    if (out.length !== 1 || !isFinite(out[0])) return null;
    return out[0];
}
function mathPop(out, op) {
    if (op === 'u') {                                                     // prefix negate: one operand
        if (!out.length) return false;
        var n = -out.pop();
        if (!isFinite(n)) return false;
        out.push(n); return true;
    }
    if (out.length < 2) return false;
    var b = out.pop(), a = out.pop(), r;
    if (op === '+') r = a + b; else if (op === '-') r = a - b; else if (op === '*') r = a * b;
    else if (op === '/') r = b === 0 ? NaN : a / b; else if (op === '%') r = b === 0 ? NaN : a % b;
    else if (op === '^') r = Math.pow(a, b); else return false;
    if (!isFinite(r)) return false;
    out.push(r); return true;
}
/* unit conversion: everything reduces to a base unit per dimension */
var UNITS = {
    len: { m: 1, meter: 1, meters: 1, km: 1000, kilometer: 1000, kilometers: 1000, cm: 0.01, centimeter: 0.01, centimeters: 0.01, mm: 0.001,
           mi: 1609.344, mile: 1609.344, miles: 1609.344, ft: 0.3048, foot: 0.3048, feet: 0.3048, "'": 0.3048,
           in: 0.0254, inch: 0.0254, inches: 0.0254, '"': 0.0254, yd: 0.9144, yard: 0.9144, yards: 0.9144, nmi: 1852 },
    mass: { g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000, kilograms: 1000, mg: 0.001, t: 1e6, tonne: 1e6, tonnes: 1e6,
            lb: 453.59237, lbs: 453.59237, pound: 453.59237, pounds: 453.59237, oz: 28.349523125, ounce: 28.349523125, ounces: 28.349523125, st: 6350.29318 },
    vol: { l: 1, liter: 1, liters: 1, litre: 1, litres: 1, ml: 0.001, gal: 3.785411784, gallon: 3.785411784, gallons: 3.785411784,
           qt: 0.946352946, quart: 0.946352946, quarts: 0.946352946, pt: 0.473176473, pint: 0.473176473, pints: 0.473176473,
           cup: 0.2365882365, cups: 0.2365882365, floz: 0.0295735295625 },
    data: { b: 1, byte: 1, bytes: 1, kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776 },
    /* exact ratios, not hand-truncated decimals: 0.277777778 made "1 mps in kph"
       answer 3.599999997 once the formatter started showing 10 digits */
    speed: { mps: 1, kph: 1 / 3.6, kmh: 1 / 3.6, mph: 1609.344 / 3600, knot: 1852 / 3600, knots: 1852 / 3600 },
    time: { s: 1, sec: 1, secs: 1, second: 1, seconds: 1, min: 60, mins: 60, minute: 60, minutes: 60,
            h: 3600, hr: 3600, hrs: 3600, hour: 3600, hours: 3600, day: 86400, days: 86400,
            week: 604800, weeks: 604800, year: 31557600, years: 31557600 }
};
var TEMPS = { c: 1, celsius: 1, '°c': 1, f: 1, fahrenheit: 1, '°f': 1, k: 1, kelvin: 1 };
function unitHas(tbl, k) { return Object.prototype.hasOwnProperty.call(tbl, k); }   // 'constructor' is not a unit
function unitConvert(n, from, to) {
    if (!isFinite(n)) return null;
    if (unitHas(TEMPS, from) && unitHas(TEMPS, to)) {
        var c = /^(f|fahrenheit|°f)$/.test(from) ? (n - 32) * 5 / 9 : /^(k|kelvin)$/.test(from) ? n - 273.15 : n;
        var v = /^(f|fahrenheit|°f)$/.test(to) ? c * 9 / 5 + 32 : /^(k|kelvin)$/.test(to) ? c + 273.15 : c;
        return { v: v, unit: to };
    }
    for (var dim in UNITS) {
        if (!unitHas(UNITS, dim)) continue;
        if (unitHas(UNITS[dim], from) && unitHas(UNITS[dim], to))
            return { v: n * UNITS[dim][from] / UNITS[dim][to], unit: to };
    }
    return null;
}
/* significant figures, not decimal places: a fixed 1e6 quantisation shows
   62.137119 for one query and a mangled 0.000977 for its reciprocal */
function fmtNum(v) {
    if (!isFinite(v)) return '—';
    var a = Math.abs(v);
    if (a !== 0 && (a < 1e-9 || a >= 1e15)) return v.toExponential(6).replace(/e([+-])/, ' × 10^$1');
    // an exact integer prints exactly: rounding to 10 significant figures turned
    // 123456789012 into 123,456,789,000, which is simply a wrong answer
    if (v === Math.round(v)) return v.toLocaleString();
    var s = String(+v.toPrecision(10));
    return s.indexOf('.') < 0 && s.indexOf('e') < 0 ? (+s).toLocaleString() : s;
}
/* Can this query be answered with no network at all? ONE function, so render()
   and init() can never disagree — render() skips the live sections only when an
   answer really exists, and init() falls through to a normal web search when the
   evaluator refuses (1/0, 2^5000, "5 kg in m"). Deciding that twice is how a
   failed calculation ended up rendering a completely blank page. */
function serpOffline(q) {
    var intent = serpIntent(q);
    if (intent.kind === 'math') {
        var v = mathEval(q);
        return v === null ? null : { label: 'Calculator', big: fmtNum(v), sub: String(q).replace(/\s+/g, ' ') + ' =' };
    }
    if (intent.kind === 'unit') {
        var u = unitConvert(intent.n, intent.from, intent.to);
        return u ? { label: 'Unit conversion', big: fmtNum(u.v) + ' ' + u.unit, sub: fmtNum(intent.n) + ' ' + intent.from + ' =' } : null;
    }
    return null;
}
/* the big answer box at the top of the page */
function serpAnswer(title, big, sub) {
    return '<div class="cr-ansbox"><span class="cr-anslabel">' + esc(title) + '</span>' +
        '<div class="cr-ansbig">' + esc(big) + '</div>' + (sub ? '<p class="cr-anssub">' + esc(sub) + '</p>' : '') + '</div>';
}

/* ── knowledge panel: REST summary for the prose + a TARGETED SPARQL query for
   the facts. wbgetentities hands back 272KB for one person; this is 2.7KB. ── */
var WD_PROPS = 'wdt:P569 wdt:P570 wdt:P106 wdt:P27 wdt:P571 wdt:P159 wdt:P1082 wdt:P170 wdt:P50 wdt:P176 wdt:P112 wdt:P36';
function wdFmt(v) {
    var m = String(v).match(/^(-?\d{4})-(\d{2})-(\d{2})T/);
    if (!m) return String(v);
    var d = new Date(v);
    return isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : m[1];
}
function serpKnowledge(q, done) {
    liveGet('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(q.replace(/ /g, '_')), function (err, j) {
        if (err || !j || !j.title || j.type === 'disambiguation' || !j.extract) { done(''); return; }
        var thumb = j.thumbnail && /^https:\/\/upload\.wikimedia\.org\//.test(j.thumbnail.source || '') ? j.thumbnail.source : '';
        var turl = 'en.wikipedia.org/wiki/' + String(j.title).replace(/ /g, '_');
        function paint(factsHtml) {
            done('<div class="cr-kp">' +
                (thumb ? '<img class="cr-kpimg" alt="" referrerpolicy="no-referrer" src="' + esc(thumb) + '">' : '') +
                '<div class="cr-kpbody"><h3 class="cr-kptitle">' + esc(j.title) + '</h3>' +
                (j.description ? '<span class="cr-kpdesc">' + esc(j.description) + '</span>' : '') +
                '<p class="cr-kpext">' + esc(j.extract) + '</p>' + (factsHtml || '') +
                crLink(turl, 'Wikipedia →', 'cr-kpmore') + '</div></div>');
        }
        if (!j.wikibase_item) { paint(''); return; }
        var sparql = 'SELECT ?propLabel ?valLabel WHERE { VALUES ?p { ' + WD_PROPS + ' } wd:' + j.wikibase_item +
            ' ?p ?val . ?prop wikibase:directClaim ?p . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } LIMIT 14';
        liveGet('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(sparql), function (e2, j2) {
            var rows = '';
            if (!e2 && j2 && j2.results && j2.results.bindings) {
                var seen = Object.create(null), out = [];
                j2.results.bindings.forEach(function (b) {
                    if (!b.propLabel || !b.valLabel || out.length >= 6) return;
                    var k = b.propLabel.value;
                    if (seen[k]) return; seen[k] = 1;
                    out.push('<div class="cr-kpfact"><b>' + esc(k) + '</b><span>' + esc(wdFmt(b.valLabel.value)) + '</span></div>');
                });
                rows = out.length ? '<div class="cr-kpfacts">' + out.join('') + '</div>' : '';
            }
            paint(rows);
        });
    });
}
/* ── dictionary card ── */
function serpDict(word, done) {
    liveGet('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), function (err, j) {
        if (err || !j || !j.length || !j[0].meanings) { done(''); return; }
        var e = j[0];
        var phon = e.phonetic || (e.phonetics || []).map(function (p) { return p.text; }).filter(Boolean)[0] || '';
        var blocks = e.meanings.slice(0, 3).map(function (m) {
            var defs = (m.definitions || []).slice(0, 2).map(function (d) {
                return '<li>' + esc(d.definition) + (d.example ? '<i class="cr-dexa">“' + esc(d.example) + '”</i>' : '') + '</li>';
            }).join('');
            return '<div class="cr-dblock"><i class="cr-dpos">' + esc(m.partOfSpeech || '') + '</i><ol>' + defs + '</ol></div>';
        }).join('');
        done('<div class="cr-dict"><div class="cr-dhead"><h3>' + esc(e.word) + '</h3>' + (phon ? '<span class="cr-dphon">' + esc(phon) + '</span>' : '') + '</div>' + blocks +
            '<p class="cr-lvfoot">Definitions from the free Dictionary API.</p></div>');
    });
}
/* ── images pack: real Wikimedia Commons thumbnails ── */
function serpImages(q, done) {
    // iiprop=url only: extmetadata carries multi-paragraph descriptions/licence
    // blobs per file that this pack never reads
    liveGet('https://commons.wikimedia.org/w/api.php?format=json&origin=*&action=query&generator=search&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=220&gsrsearch=' + encodeURIComponent(q), function (err, j) {
        if (err || !j || !j.query || !j.query.pages) { done(''); return; }
        var pages = j.query.pages, out = [];
        // generator results come back keyed by pageid (i.e. upload age); `index`
        // is what carries the search ranking, so sort by it or the strip is noise
        Object.keys(pages).map(function (k) { return pages[k]; })
            .sort(function (a, b) { return (a.index || 0) - (b.index || 0); })
            .forEach(function (p) {
                var ii = p.imageinfo && p.imageinfo[0];
                if (!ii || !ii.thumburl || !/^https:\/\/upload\.wikimedia\.org\//.test(ii.thumburl) || out.length >= 6) return;
                out.push('<figure class="cr-imgcell"><img alt="" loading="lazy" referrerpolicy="no-referrer" src="' + esc(ii.thumburl) + '">' +
                    '<figcaption>' + esc(String(p.title || '').replace(/^File:/, '').replace(/\.[a-z]+$/i, '')) + '</figcaption></figure>');
            });
        done(out.length ? '<h4 class="cr-serph">Images</h4><div class="cr-imgrow">' + out.join('') + '</div><p class="cr-serpnote">From Wikimedia Commons.</p>' : '');
    });
}
/* ── Stack Overflow answers, for code-shaped queries ── */
function serpSO(q, done) {
    liveGet('https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&pagesize=4&site=stackoverflow&q=' + encodeURIComponent(q), function (err, j) {
        if (err || !j || !j.items || !j.items.length) { done(''); return; }
        var rows = j.items.slice(0, 4).map(function (it) {
            var u = String(it.link || '').replace(/^https?:\/\//i, '');
            return serpRow(u, 'stackoverflow.com › questions', { ch: 'S', c: '#f48024' }, snipText(it.title),
                '<span class="cr-serpmeta">' + nnum(it.score) + ' votes · ' + nnum(it.answer_count) + ' answers' + (it.is_answered ? ' · ✓ accepted' : '') + '</span>');
        }).join('');
        done(serpSection('Answers · Stack Overflow', null, rows));
    });
}
/* ── map card: real geocode + real OSM tiles stitched into a little map ── */
/* fractional tile coords: the whole part picks the tile, the fraction places
   the pin inside it. flooring both away is how a marker ends up 2km off. */
function osmTileF(lat, lon, z) {
    var n = Math.pow(2, z), la = lat * Math.PI / 180;
    return { x: (lon + 180) / 360 * n, y: (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * n };
}
function serpMap(place, done) {
    liveGet('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(place), function (err, j) {
        if (err || !j || !j.length) { done(''); return; }
        var p = j[0], lat = parseFloat(p.lat), lon = parseFloat(p.lon), z = 13;
        if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 85) { done(''); return; }
        var f = osmTileF(lat, lon, z), tx = Math.floor(f.x), ty = Math.floor(f.y), tiles = '';
        /* one row of three: the second row was clipped by the card's max-height
           at every real window width, so it was three OSM requests for pixels
           nobody could see — their tile policy deserves better than that */
        for (var dx = 0; dx < 3; dx++)
            tiles += '<img alt="" loading="lazy" referrerpolicy="no-referrer" src="https://tile.openstreetmap.org/' + z + '/' + (tx - 1 + dx) + '/' + ty + '.png">';
        var left = ((1 + (f.x - tx)) / 3 * 100).toFixed(2), top = ((f.y - ty) * 100).toFixed(2);
        done('<div class="cr-mapcard"><div class="cr-maptiles">' + tiles +
            '<span class="cr-mappin" style="left:' + left + '%;top:' + top + '%">📍</span></div>' +
            '<div class="cr-mapmeta"><b>' + esc(String(p.display_name || place).split(',').slice(0, 2).join(',')) + '</b>' +
            '<span>' + esc(String(p.display_name || '')) + '</span>' +
            '<i>' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ' · map © OpenStreetMap contributors</i></div></div>');
    });
}
/* ── time + weather cards, both off the geocoder we already use ── */
function serpTime(place, done) {
    liveGet('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(place), function (err, j) {
        if (err || !j || !j.results || !j.results.length) { done(''); return; }
        var g = j.results[0], tz = g.timezone;
        // an ABSENT timeZone silently means "the viewer's own zone" — which would
        // print the local clock under a Tokyo heading. only a real string will do.
        if (typeof tz !== 'string' || !tz) { done(''); return; }
        var now;
        try { now = new Date().toLocaleString('en-US', { timeZone: tz, weekday: 'long', hour: 'numeric', minute: '2-digit' }); }
        catch (e) { done(''); return; }
        done(serpAnswer('Time in ' + g.name, now, tz + (g.country ? ' · ' + g.country : '')));
    });
}
function serpWeatherCard(place, done) {
    liveGet('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(place), function (err, j) {
        if (err || !j || !j.results || !j.results.length) { done(''); return; }
        var g = j.results[0];
        liveGet('https://api.open-meteo.com/v1/forecast?temperature_unit=fahrenheit&wind_speed_unit=mph&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&latitude=' + g.latitude + '&longitude=' + g.longitude, function (e2, j2) {
            if (e2 || !j2 || !j2.current) { done(''); return; }
            var c = j2.current, w = wmo(c.weather_code);
            done('<div class="cr-ansbox cr-wxans"><span class="cr-anslabel">Weather · ' + esc(g.name + (g.admin1 ? ', ' + g.admin1 : '')) + '</span>' +
                '<div class="cr-ansbig">' + w[0] + ' ' + Math.round(c.temperature_2m) + '°F</div>' +
                '<p class="cr-anssub">' + esc(w[1]) + ' · humidity ' + nnum(c.relative_humidity_2m) + '% · wind ' + Math.round(c.wind_speed_10m) + ' mph</p>' +
                crLink('open-meteo.com/forecast?q=' + encodeURIComponent(g.name + '@' + g.latitude + ',' + g.longitude), 'Full forecast →', 'cr-kpmore') + '</div>');
        });
    });
}
function serpRow(url, urlLine, fav, title, snipHtml) {
    return '<div class="cr-res">' + crLink(url, '<span class="cr-resurl">' + crFav(fav) + ' ' + urlLine + '</span><span class="cr-restitle">' + esc(title) + '</span>', '') +
        '<span class="cr-resdesc">' + snipHtml + '</span></div>';
}

/* — Wikipedia, the whole thing — */
function wikiTitleOf(path) {
    var t = path.replace(/^wiki\//i, '').split('#')[0].split('?')[0];
    try { t = decodeURIComponent(t); } catch (e) {}
    return t.replace(/_/g, ' ');
}
webPage('en.wikipedia.org', {
    live: true,
    title: 'Wikipedia', fav: { ch: 'W', c: '#202122' }, searchable: true,
    stitle: 'Wikipedia, the free encyclopedia', sdesc: 'The real one. Type any article URL and this fake browser will genuinely fetch it. The pixels are ours; the words are theirs.', skey: 'wikipedia encyclopedia article live real',
    render: function () {
        var path = livePath('en.wikipedia.org');
        if (!path || /^wiki\/Main_Page$/i.test(path)) {
            return '<div class="cr-lv cr-lw"><div class="cr-lwhead"><span class="cr-lwball">W</span><h2>Wikipedia</h2><p>The free encyclopedia — actually reachable from inside the museum ' + liveChip() + '</p></div>' +
                '<label class="cr-lvsearch">' + ic('ic-search') + '<input class="cr-wq" placeholder="Search 6,800,000 real articles" spellcheck="false"></label>' +
                '<div class="cr-wsug" id="crWSug"></div>' +
                '<div class="cr-lvtry"><b>Try:</b>' +
                    crLink('en.wikipedia.org/wiki/Volkswagen_Golf', 'Volkswagen Golf', 'cr-chip') +
                    crLink('en.wikipedia.org/wiki/Game_Boy', 'Game Boy', 'cr-chip') +
                    crLink('en.wikipedia.org/wiki/Rice_University', 'Rice University', 'cr-chip') +
                    crLink('en.wikipedia.org/wiki/Cookie_Clicker', 'Cookie Clicker', 'cr-chip') +
                '</div></div>';
        }
        return liveSkeleton('Wikipedia article');
    },
    init: function (view) {
        var path = livePath('en.wikipedia.org');
        if (!path || /^wiki\/Main_Page$/i.test(path)) { wikiWireSearch(view); return; }
        var title = wikiTitleOf(path), url = liveUrl();
        var api = 'https://en.wikipedia.org/w/api.php?format=json&origin=*&redirects=1&action=parse&prop=text&disableeditsection=1&page=' + encodeURIComponent(title);
        var meta = 'https://en.wikipedia.org/w/api.php?format=json&origin=*&redirects=1&action=query&prop=pageimages|description&pithumbsize=280&titles=' + encodeURIComponent(title);
        liveGet(api, function (err, j, r) {
            if (err || !j || !j.parse) { liveFill(view, url, liveFail(err || 'empty', 'Wikipedia', r)); return; }
            var realTitle = j.parse.title;
            var body = liveSanitize(j.parse.text['*'], function (href) {
                if (!href) return null;
                if (/^#/.test(href)) return null;                              // in-page anchors: keep the words
                var m = href.match(/^\/wiki\/([^:]*)$/);                       // namespaced pages (File:, Help:) stay text
                if (m) return 'en.wikipedia.org/wiki/' + m[1];
                if (/^https?:\/\//i.test(href)) return href.replace(/^https?:\/\//i, '');
                return null;
            });
            var html = '<div class="cr-lv cr-lw"><div class="cr-lwbar">' + crLink('en.wikipedia.org', '<span class="cr-lwball sm">W</span> Wikipedia', 'cr-lwhome') + liveChip() + '</div>' +
                '<h2 class="cr-lwtitle">' + esc(realTitle) + '</h2><div class="cr-lwmeta" id="crWMeta"></div><div class="cr-lwbody">' + body + '</div>' +
                '<p class="cr-lvfoot">Text from the real <b>en.wikipedia.org</b>, CC BY-SA, restyled into pixels. Blue words are real articles — keep clicking.</p></div>';
            liveFill(view, url, html, realTitle + ' — Wikipedia');
            liveGet(meta, function (e2, j2) {                                  // the lead image + one-liner, if the article has them
                if (e2 || !j2 || !view.isConnected) return;
                var pages = j2.query && j2.query.pages, first = pages && pages[Object.keys(pages)[0]];
                if (!first) return;
                var slot = view.querySelector('#crWMeta'); if (!slot) return;
                var mhtml = '';
                if (first.description) mhtml += '<i class="cr-lwdesc">' + esc(first.description) + '</i>';
                if (first.thumbnail && /^https:\/\/upload\.wikimedia\.org\//.test(first.thumbnail.source))
                    mhtml += '<img class="cr-lwthumb" alt="" referrerpolicy="no-referrer" src="' + esc(first.thumbnail.source) + '">';
                slot.innerHTML = mhtml;
            });
        });
    }
});
function wikiWireSearch(view) {
    var q = view.querySelector('.cr-wq'), box = view.querySelector('#crWSug'), tmr = 0;
    if (!q) return;
    q.addEventListener('input', function () {
        clearTimeout(tmr);
        var v = q.value.trim();
        if (!v) { box.innerHTML = ''; return; }
        tmr = setTimeout(function () {
            liveGet('https://en.wikipedia.org/w/api.php?format=json&origin=*&action=opensearch&limit=8&search=' + encodeURIComponent(v), function (err, j) {
                if (err || !j || !view.isConnected || q.value.trim() !== v) return;
                box.innerHTML = (j[1] || []).map(function (t) {
                    return crLink('en.wikipedia.org/wiki/' + t.replace(/ /g, '_'), '📄 ' + esc(t), 'cr-wsugrow');
                }).join('') || '<p class="cr-empty">The real Wikipedia has nothing. Impressive, honestly.</p>';
            });
        }, 280);
    });
    q.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && q.value.trim()) crNav('en.wikipedia.org/wiki/' + q.value.trim().replace(/ /g, '_'));
    });
}

/* — Hacker News, the real front page — */
function hnAgo(ts) {
    var m = Math.max(1, Math.round((Date.now() / 1000 - ts) / 60));
    return m < 60 ? m + 'm ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) + 'd ago';
}
function hnHostOf(u) { try { return String(u || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]; } catch (e) { return ''; } }
webPage('news.ycombinator.com', {
    live: true,
    title: 'Hacker News', fav: { ch: 'Y', c: '#ff6600' }, searchable: true,
    stitle: 'Hacker News', sdesc: 'The actual front page, fetched live. Orange as ever. The comments are real people being confidently wrong in real time.', skey: 'hacker news hn tech front page live real',
    render: function () {
        return liveSkeleton(/item/.test(livePath('news.ycombinator.com')) ? 'Hacker News thread' : 'Hacker News front page');
    },
    init: function (view) {
        var path = livePath('news.ycombinator.com'), url = liveUrl();
        var idm = path.match(/^item\?id=(\d+)$/);
        function head(extra) {
            return '<div class="cr-hnbar">' + crLink('news.ycombinator.com', '<b class="cr-hny">Y</b> Hacker News', 'cr-hnhome') + (extra || '') + liveChip() + '</div>';
        }
        if (idm) {
            liveGet('https://hn.algolia.com/api/v1/items/' + idm[1], function (err, j, r) {
                if (err || !j) { liveFill(view, url, liveFail(err || 'empty', 'Hacker News', r)); return; }
                var n = 0;
                function cmts(kids, depth) {
                    if (!kids || depth > 8 || n > 150) return '';
                    return kids.map(function (k) {
                        if (!k || k.type !== 'comment' || !k.author || n > 150) return '';
                        n++;
                        return '<div class="cr-hnc" style="--d:' + Math.min(depth, 7) + '"><div class="cr-hnch"><b>' + esc(k.author) + '</b><i>' + hnAgo(k.created_at_i) + '</i></div>' +
                            '<div class="cr-hncb">' + liveSanitize(k.text, function (href) { return /^https?:\/\//i.test(href) ? href.replace(/^https?:\/\//i, '') : null; }) + '</div>' +
                            cmts(k.children, depth + 1) + '</div>';
                    }).join('');
                }
                var dom = hnHostOf(j.url);
                var html = '<div class="cr-lv cr-hn">' + head() +
                    '<div class="cr-hnstory"><h2>' + (j.url ? crLink(j.url.replace(/^https?:\/\//i, ''), esc(j.title), 'cr-hntitle') : esc(j.title || '(untitled)')) + (dom ? ' <i class="cr-hndom">(' + esc(dom) + ')</i>' : '') + '</h2>' +
                    '<p class="cr-hnsub">' + nnum(j.points) + ' points · ' + esc(j.author || '?') + ' · ' + hnAgo(j.created_at_i) + '</p>' +
                    (j.text ? '<div class="cr-hncb op">' + liveSanitize(j.text, function (href) { return /^https?:\/\//i.test(href) ? href.replace(/^https?:\/\//i, '') : null; }) + '</div>' : '') + '</div>' +
                    cmts(j.children, 0) +
                    (n > 150 ? '<p class="cr-lvfoot">Trimmed at 150 comments — the rest live on the real orange site.</p>' : '') + '</div>';
                liveFill(view, url, html, (j.title || 'thread') + ' — Hacker News');
            });
            return;
        }
        liveGet('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30', function (err, j, r) {
            if (err || !j || !j.hits) { liveFill(view, url, liveFail(err || 'empty', 'Hacker News', r)); return; }
            var rows = j.hits.map(function (h, i) {
                var dom = hnHostOf(h.url);
                var tl = h.url ? crLink(h.url.replace(/^https?:\/\//i, ''), esc(h.title), 'cr-hntitle') : crLink('news.ycombinator.com/item?id=' + h.objectID, esc(h.title), 'cr-hntitle');
                return '<div class="cr-hnrow"><span class="cr-hnrank">' + (i + 1) + '.</span><div class="cr-hnmain"><span>' + tl + (dom ? ' <i class="cr-hndom">(' + esc(dom) + ')</i>' : '') + '</span>' +
                    '<span class="cr-hnsub">' + nnum(h.points) + ' points · ' + esc(h.author) + ' · ' + hnAgo(h.created_at_i) + ' · ' + crLink('news.ycombinator.com/item?id=' + h.objectID, nnum(h.num_comments) + ' comments', 'cr-hncl') + '</span></div></div>';
            }).join('');
            liveFill(view, url, '<div class="cr-lv cr-hn">' + head() + rows +
                '<p class="cr-lvfoot">The real front page, via the Algolia HN API. Story links go where they really go — most will open in a framed window.</p></div>',
                'Hacker News');
        });
    }
});

/* — GitHub, any profile or repo — */
var GH_LANG = { JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', C: '#555555', 'C++': '#f34b7d', 'C#': '#178600', Java: '#b07219', Go: '#00ADD8', Rust: '#dea584', HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Ruby: '#701516', Swift: '#F05138', Kotlin: '#A97BFF', Lua: '#000080' };
function ghMd(md) {
    /* a deliberately small markdown: escape EVERYTHING first, then decorate.
       enough for a README to read like a README, nothing more. */
    var out = [], inCode = false, code = [];
    String(md || '').split(/\r?\n/).forEach(function (ln) {
        if (/^```/.test(ln)) {
            if (inCode) { out.push('<pre>' + code.join('\n') + '</pre>'); code = []; }
            inCode = !inCode; return;
        }
        if (inCode) { code.push(esc(ln)); return; }
        var h = ln.match(/^(#{1,4})\s+(.*)/);
        if (h) { out.push('<h' + Math.min(4, h[1].length + 2) + '>' + ghInline(h[2]) + '</h' + Math.min(4, h[1].length + 2) + '>'); return; }
        if (/^\s*[-*]\s+/.test(ln)) { out.push('<li>' + ghInline(ln.replace(/^\s*[-*]\s+/, '')) + '</li>'); return; }
        if (/^\s*$/.test(ln)) { out.push(''); return; }
        out.push('<p>' + ghInline(ln) + '</p>');
    });
    if (inCode && code.length) out.push('<pre>' + code.join('\n') + '</pre>');
    return out.join('');
}
function ghInline(s) {
    return esc(s)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/\*([^*]+)\*/g, '<i>$1</i>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, function (m, t, u) { return '<a class="cr-l cr-lva" data-href="' + esc(u.replace(/^https?:\/\//i, '')) + '">' + t + '</a>'; })
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}
function ghRepoCard(rp) {
    return '<div class="cr-lgrepo">' + crLink('github.com/' + rp.full_name, esc(rp.name), 'cr-lgrname') +
        (rp.description ? '<p>' + esc(rp.description) + '</p>' : '') +
        '<span class="cr-lgmeta">' + (rp.language ? '<i class="cr-lgdot" style="background:' + (GH_LANG[rp.language] || '#8b949e') + '"></i>' + esc(rp.language) + ' · ' : '') + '★ ' + nnum(rp.stargazers_count) + (rp.fork ? ' · fork' : '') + '</span></div>';
}
webPage('github.com', {
    live: true,
    title: 'GitHub', fav: { ch: 'G', c: '#24292f' }, searchable: true,
    stitle: 'GitHub — the real one', sdesc: 'Type any github.com/user or /user/repo and the API answers for real. Sixty anonymous requests an hour; the museum spends them wisely.', skey: 'github git code repos live real',
    render: function () {
        var path = livePath('github.com');
        if (!path) {
            return '<div class="cr-lv cr-lg"><div class="cr-lghead"><span class="cr-lgmark">🐙</span><h2>GitHub</h2><p>The real API, in pixels ' + liveChip() + '</p></div>' +
                '<label class="cr-lvsearch">' + ic('ic-search') + '<input class="cr-lgq" placeholder="user  or  user/repo" spellcheck="false"></label>' +
                '<div class="cr-lvtry"><b>Try:</b>' +
                    crLink('github.com/IsaacUre', 'IsaacUre', 'cr-chip') +
                    crLink('github.com/torvalds', 'torvalds', 'cr-chip') +
                    crLink('github.com/torvalds/linux', 'torvalds/linux', 'cr-chip') +
                    crLink('github.com/anthropics/claude-code', 'anthropics/claude-code', 'cr-chip') +
                '</div></div>';
        }
        return liveSkeleton('GitHub');
    },
    init: function (view) {
        var path = livePath('github.com'), url = liveUrl();
        if (!path) {
            var q = view.querySelector('.cr-lgq');
            if (q) q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && q.value.trim()) crNav('github.com/' + q.value.trim().replace(/^\/+/, '')); });
            return;
        }
        var parts = path.split('?')[0].split('/').filter(Boolean);
        if (parts.length >= 2) {
            var full = parts[0] + '/' + parts[1];
            liveGet('https://api.github.com/repos/' + full, function (err, j, r) {
                if (err || !j) { liveFill(view, url, liveFail(err || 'empty', 'GitHub', r)); return; }
                var html = '<div class="cr-lv cr-lg"><div class="cr-lgbar">' + crLink('github.com', '🐙 GitHub', 'cr-lghome') + liveChip() + '</div>' +
                    '<h2 class="cr-lgtitle">' + crLink('github.com/' + j.owner.login, esc(j.owner.login), 'cr-lgowner') + ' / <b>' + esc(j.name) + '</b></h2>' +
                    (j.description ? '<p class="cr-lgdesc">' + esc(j.description) + '</p>' : '') +
                    '<div class="cr-lgstats"><span>★ ' + nnum(j.stargazers_count).toLocaleString() + '</span><span>⑂ ' + nnum(j.forks_count).toLocaleString() + '</span>' +
                    (j.language ? '<span><i class="cr-lgdot" style="background:' + (GH_LANG[j.language] || '#8b949e') + '"></i>' + esc(j.language) + '</span>' : '') +
                    '<span>◷ updated ' + esc(String(j.pushed_at || '').slice(0, 10)) + '</span></div>' +
                    '<div class="cr-lgreadme" id="crGhReadme"><p class="cr-empty">Fetching the README…</p></div>' +
                    '<p class="cr-lvfoot">Live from <b>api.github.com</b>. Stars are real; give them somewhere else.</p></div>';
                liveFill(view, url, html, full + ' — GitHub');
                liveGet('https://api.github.com/repos/' + full + '/readme', function (e2, j2) {
                    var slot = view.querySelector('#crGhReadme'); if (!slot || !view.isConnected) return;
                    if (e2 || !j2 || !j2.content) { slot.innerHTML = '<p class="cr-empty">No README the API will admit to.</p>'; return; }
                    var md = '';
                    try { md = decodeURIComponent(escape(atob(j2.content.replace(/\n/g, '')))); } catch (e3) { md = ''; }
                    slot.innerHTML = md ? '<h3 class="cr-lgrh">README.md</h3>' + ghMd(md.slice(0, 22000)) : '<p class="cr-empty">The README refused to decode. Mysterious.</p>';
                });
            });
            return;
        }
        var user = parts[0];
        liveGet('https://api.github.com/users/' + user, function (err, j, r) {
            if (err || !j) { liveFill(view, url, liveFail(err || 'empty', 'GitHub', r)); return; }
            var html = '<div class="cr-lv cr-lg"><div class="cr-lgbar">' + crLink('github.com', '🐙 GitHub', 'cr-lghome') + liveChip() + '</div>' +
                '<div class="cr-lgprofile">' +
                (/^https:\/\/avatars\.githubusercontent\.com\//.test(j.avatar_url || '') ? '<img class="cr-lgav" alt="" referrerpolicy="no-referrer" src="' + esc(j.avatar_url) + '">' : '') +
                '<div><h2 class="cr-lgtitle">' + esc(j.name || j.login) + '</h2><span class="cr-lglogin">' + esc(j.login) + '</span>' +
                (j.bio ? '<p class="cr-lgdesc">' + esc(j.bio) + '</p>' : '') +
                '<div class="cr-lgstats"><span>' + nnum(j.followers).toLocaleString() + ' followers</span><span>' + nnum(j.public_repos).toLocaleString() + ' repos</span>' + (j.location ? '<span>📍 ' + esc(j.location) + '</span>' : '') + '</div></div></div>' +
                '<div class="cr-lgrepos" id="crGhRepos"></div>' +
                '<p class="cr-lvfoot">Live from <b>api.github.com</b>.</p></div>';
            liveFill(view, url, html, (j.name || j.login) + ' — GitHub');
            liveGet('https://api.github.com/users/' + user + '/repos?sort=updated&per_page=8', function (e2, j2) {
                var slot = view.querySelector('#crGhRepos'); if (!slot || !view.isConnected || e2 || !j2 || !j2.map) return;
                slot.innerHTML = j2.map(ghRepoCard).join('');
            });
        });
    }
});

/* — real weather, via Open-Meteo (no key, CORS open, bless them) — */
var WMO = { 0: ['☀️', 'Clear'], 1: ['🌤', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'], 45: ['🌫', 'Fog'], 48: ['🌫', 'Rime fog'], 51: ['🌦', 'Drizzle'], 53: ['🌦', 'Drizzle'], 55: ['🌧', 'Heavy drizzle'], 61: ['🌧', 'Rain'], 63: ['🌧', 'Rain'], 65: ['🌧', 'Heavy rain'], 71: ['🌨', 'Snow'], 73: ['🌨', 'Snow'], 75: ['❄️', 'Heavy snow'], 80: ['🌦', 'Showers'], 81: ['🌧', 'Showers'], 82: ['⛈', 'Violent showers'], 95: ['⛈', 'Thunderstorm'], 96: ['⛈', 'Thunder + hail'], 99: ['⛈', 'Thunder + hail'] };
function wmo(c) { return WMO[c] || ['🌡', 'Weather']; }
webPage('open-meteo.com', {
    live: true,
    title: 'Open-Meteo', fav: { ch: '☀', c: '#f59f00' }, searchable: true,
    stitle: 'Open-Meteo — real weather', sdesc: 'Actual current weather and a real 7-day forecast for any city on Earth, fetched live into the pixel desktop.', skey: 'weather forecast temperature live real',
    render: function () { return liveSkeleton('weather'); },
    init: function (view) {
        var url = liveUrl();
        var qm = url.match(/[?&]q=([^&]*)/);
        var q = '';
        try { q = qm ? decodeURIComponent(qm[1].replace(/\+/g, ' ')) : ''; }   // a hand-typed %zz must not throw init away and strand the skeleton
        catch (e) { q = qm[1].replace(/\+/g, ' '); }
        var at = q.match(/^(.*)@(-?[\d.]+),(-?[\d.]+)$/);
        function show(name, lat, lon) {
            liveGet('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=fahrenheit&wind_speed_unit=mph', function (err, j, r) {
                if (err || !j || !j.current) { liveFill(view, url, liveFail(err || 'empty', 'Open-Meteo', r)); return; }
                var c = j.current, w = wmo(c.weather_code);
                var days = (j.daily && j.daily.time || []).map(function (d, i) {
                    var dw = wmo(j.daily.weather_code[i]);
                    return '<div class="cr-wxday"><b>' + esc(new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' })) + '</b><span class="cr-wxem">' + dw[0] + '</span>' +
                        '<span>' + Math.round(j.daily.temperature_2m_max[i]) + '°</span><i>' + Math.round(j.daily.temperature_2m_min[i]) + '°</i></div>';
                }).join('');
                liveFill(view, url, '<div class="cr-lv cr-wx"><div class="cr-wxbar">' + crLink('open-meteo.com', '☀ Open-Meteo', 'cr-wxhome') +
                    '<label class="cr-lvsearch sm">' + ic('ic-search') + '<input class="cr-wxq" placeholder="Another city" spellcheck="false"></label>' + liveChip() + '</div>' +
                    '<div class="cr-wxnow"><span class="cr-wxbig">' + w[0] + '</span><div><h2>' + Math.round(c.temperature_2m) + '°F</h2><p>' + w[1] + ' · feels ' + Math.round(c.apparent_temperature) + '° · wind ' + Math.round(c.wind_speed_10m) + ' mph · humidity ' + nnum(c.relative_humidity_2m) + '%</p><i>' + esc(name) + ', right now, for real</i></div></div>' +
                    '<div class="cr-wxdays">' + days + '</div>' +
                    '<p class="cr-lvfoot">Live from <b>api.open-meteo.com</b>. If it says rain, blame the sky, not the pixels.</p></div>',
                    name + ' weather — Open-Meteo');
                var nq = view.querySelector('.cr-wxq');
                if (nq) nq.addEventListener('keydown', function (e) { if (e.key === 'Enter' && nq.value.trim()) wxFind(nq.value.trim()); });
            });
        }
        function wxFind(name) {
            liveGet('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(name), function (err, j) {
                if (!view.isConnected) return;                 // the user moved on; don't crNav-hijack the now-active tab
                if (err || !j || !j.results || !j.results.length) {
                    /* on the skeleton (direct nav to a bad city) show a real page,
                       not a spinner that never resolves; on a loaded page just toast */
                    if (view.querySelector('.cr-lvload')) liveFill(view, url, wxNoCity(name, err));
                    else toast('The real atlas has no “' + name + '”.');
                    return;
                }
                var g = j.results[0];
                // replace, don't push: this IS the same page, just resolved
                crNav('open-meteo.com/forecast?q=' + encodeURIComponent(g.name + (g.admin1 ? ', ' + g.admin1 : '') + '@' + g.latitude + ',' + g.longitude), { replace: true });
            });
        }
        if (at) show(at[1], +at[2], +at[3]);
        else if (q) wxFind(q);
        else show('Houston, Texas', 29.76, -95.36);
    }
});

/* — everything else: the honest iframe — */
webPage('__frame', {
    title: 'Live site', fav: { ch: '🌐', c: '#5f6368' },
    render: function () {
        var u = liveUrl();
        var host = u.split('/')[0];
        return '<div class="cr-frame"><div class="cr-framebar"><span>🌐 Loading the real <b>' + esc(host) + '</b> in a window' + liveChip() + '</span>' +
            '<span class="cr-framenote">big sites refuse to be framed — if it stays blank, that’s ' + esc(host) + ' saying no</span>' +
            '<button class="cr-chip" id="crFrameOut">Open in a real tab ↗</button></div>' +
            '<div class="cr-framewrap"><div class="cr-frameload" id="crFrameLoad"><span class="cr-lvspin"></span></div>' +
            '<iframe class="cr-frameifr" id="crFrameIfr" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerpolicy="no-referrer" src="https://' + esc(u) + '"></iframe></div></div>';
    },
    init: function (view) {
        var u = liveUrl();
        var f = view.querySelector('#crFrameIfr'), ld = view.querySelector('#crFrameLoad'), out = view.querySelector('#crFrameOut');
        if (f) f.addEventListener('load', function () { if (ld) ld.hidden = true; });
        setTimeout(function () { if (ld && view.isConnected) ld.hidden = true; }, 6000);   // blocked frames still "load"; don't spin forever
        if (out) out.addEventListener('click', function () { window.open('https://' + u, '_blank', 'noopener'); });
    }
});

/* ═════════════ URL parsing / navigation engine ═════════════ */
var WEB_LC = null;                                        // lowercase key → real key, built lazily after all webPage() calls
function crResolveKey(input) {
    var u = String(input || '').trim();
    if (/^view-source:/i.test(u)) return '__viewsource';
    u = u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
    if (/^chrome:\/\//i.test(input)) u = input.trim().toLowerCase().replace(/\/+$/, '');
    if (!WEB_LC) { WEB_LC = {}; Object.keys(WEB).forEach(function (k) { WEB_LC[k.toLowerCase()] = k; }); }
    /* hasOwnProperty, not a bare lookup: this map is keyed by whatever the user
       typed, and searching "constructor" otherwise returns Object.prototype's
       copy — a truthy non-key that then blew up as WEB[key].live */
    function known(k) { return Object.prototype.hasOwnProperty.call(WEB_LC, k) ? WEB_LC[k] : null; }
    var lc = u.toLowerCase();
    if (known(lc)) return known(lc);
    if (lc.indexOf('google.com/search') === 0) return 'google.com/search';
    var host = lc.split(/[/?#]/)[0].split(':')[0];       // host only: drop /path, ?query, #frag, and :port
    return known(host);
}
function crParse(input) {
    var u = String(input || '').trim();
    if (!u) return null;
    if (/^view-source:/i.test(u)) return u;   // the prefix IS the URL — resolving it would eat the target
    var key = crResolveKey(u);
    var bare = u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
    if (key) {
        if (key === 'google.com/search') return bare;
        /* live hosts keep their whole path: collapsing en.wikipedia.org/wiki/Cat
           down to the host key would eat the article */
        if (WEB[key].live && bare.toLowerCase() !== key.toLowerCase()) return bare;
        return key;
    }
    /* URL-shaped → the frame (or the dino for chrome://). Test the PROTOCOL-STRIPPED
       form: a pasted https://arstechnica.com must reach the frame, not search. */
    if (/^[a-z0-9.-]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(bare) || /^chrome:\/\//i.test(u)) return bare;
    return 'google.com/search?q=' + encodeURIComponent(u);            // words → search
}
function crSite(url) {
    var key = crResolveKey(url);
    if (key) return WEB[key];
    /* a real-looking domain the museum doesn't know: try the actual site in a
       sandboxed frame. chrome:// nonsense and word salad still get the dino. */
    var bare = String(url || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?(\/|\?|#|$)/i.test(bare)) return WEB.__frame;
    return WEB.__err;
}
function crQOf(url) {
    var m = String(url).match(/[?&]q=([^&]*)/); if (!m) return '';
    var raw = m[1].replace(/\+/g, ' ');
    try { return decodeURIComponent(raw); } catch (e) { return raw; }   // a stray % must not brick the tab strip
}
function crTitleOf(url) {
    if (/^view-source:/i.test(String(url))) return String(url);   // the URL is the tab title, like the real thing
    if (LIVE_TITLES[String(url)]) return LIVE_TITLES[String(url)];   // a live page told us its real name
    var s = crSite(url);
    if (s === WEB.__err || s === WEB.__frame) return String(url).replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    return typeof s.title === 'function' ? s.title(crQOf(url)) : s.title;
}
function crTab() { return CR.tabs[CR.active]; }
function crNav(url, opts) {
    if (!CR || !url) return;
    opts = opts || {};
    var t = crTab();
    /* replace: swap the current entry instead of pushing. A page that resolves
       itself into a canonical URL (the weather geocode) must not leave the
       pre-resolution URL behind, or Back lands on it, it resolves again, and
       the user is trapped bouncing forward forever. */
    if (opts.replace) { t.hist[t.hi] = url; }
    else if (!opts.nopush) { t.hist = t.hist.slice(0, t.hi + 1); t.hist.push(url); t.hi = t.hist.length - 1; }
    t.url = url;
    var s = crSite(url);
    if (!CR.incog && s !== WEB.__err && !s.nohist && s.host !== 'chrome://history')          // incognito keeps its word
        { var h = crHist(); h.unshift({ u: url, t: crTitleOf(url), ts: Date.now() }); if (h.length > 200) h.length = 200; crjSet('hist', h); }
    crChrome(); crTabs(); crPage();
}
function crBack() { var t = crTab(); if (t.hi > 0) { t.hi--; t.url = t.hist[t.hi]; crChrome(); crTabs(); crPage(); } }
function crFwd() { var t = crTab(); if (t.hi < t.hist.length - 1) { t.hi++; t.url = t.hist[t.hi]; crChrome(); crTabs(); crPage(); } }
function crNewTab(url) {
    CR.tabs.push({ url: url || 'chrome://newtab', hist: [url || 'chrome://newtab'], hi: 0, scroll: 0 });
    CR.active = CR.tabs.length - 1;
    crChrome(); crTabs(); crPage();
}
function crCloseTab(i) {
    if (!CR.tabs[i]) return;
    var wasActive = i === CR.active;
    CR.closed.push(CR.tabs[i].url);                                   // Alt+Shift+T can bring it back
    CR.tabs.splice(i, 1);
    if (!CR.tabs.length) {
        /* closing the LAST incognito tab must not take the window — and with it
           the regular tabs parked in CR.held, which the swap toast explicitly
           promises are "waiting where you left them". Drop back instead. */
        if (CR.incog && CR.held && CR.held.tabs && CR.held.tabs.length) { crIncogSwap(); return; }
        closeWin('chrome'); return;
    }
    if (CR.active >= CR.tabs.length) CR.active = CR.tabs.length - 1;
    else if (i < CR.active) CR.active--;
    crChrome(); crTabs();
    if (wasActive) crPage();                                          // closing a background tab must not reset the page you're on
}

/* ═════════════ shell rendering ═════════════ */
// Chrome's tab strip IS the window title bar — createWindow drops this in beside the min/max/close caps.
// The trailing spacer is the draggable "empty strip" region, exactly like the real browser.
function crTitlebar() {
    return '<div class="cr-tabstrip">' +
        '<div class="cr-tabs" id="crTabs"></div>' +
        '<button class="cr-plusbtn" id="crPlus" aria-label="New tab">+</button>' +
        '<div class="cr-tabspace"></div>' +
    '</div>';
}
function renderChrome() {
    return '<div class="cr" id="crRoot">' +
        '<div class="cr-tool">' +
          '<button class="cr-nav" id="crBack" aria-label="Back">‹</button>' +
          '<button class="cr-nav" id="crFwd" aria-label="Forward">›</button>' +
          '<button class="cr-nav" id="crReload" aria-label="Reload">↻</button>' +
          '<label class="cr-omni" id="crOmni"><span class="cr-lock" id="crLock">🔒</span>' +
            '<input class="cr-url" id="crUrl" spellcheck="false" autocomplete="off" aria-label="Address and search bar">' +
            '<button class="cr-star" id="crStar" aria-label="Bookmark this page">☆</button></label>' +
          '<button class="cr-nav" id="crExt" aria-label="Extensions" title="Extensions">🧩</button>' +
          '<button class="cr-avatar" id="crAv" aria-label="Profile">' + ic('ic-user') + '</button>' +
          '<button class="cr-nav" id="crMore" aria-label="Customize and control">⋮</button>' +
        '</div>' +
        '<div class="cr-bmbar" id="crBmbar"></div>' +
        '<div class="cr-view" id="crView" tabindex="-1"></div>' +
        '<div class="cr-suggest" id="crSuggest" hidden></div>' +
        '<div class="cr-menu" id="crMenu" hidden></div>' +
        '<div class="cr-bubble" id="crBubble" hidden></div>' +
    '</div>';
}
function crTabs() {
    var strip = CR.el.querySelector('#crTabs');
    strip.innerHTML = CR.tabs.map(function (t, i) {
        var s = crSite(t.url);
        return '<div class="cr-tab' + (i === CR.active ? ' on' : '') + '" data-ti="' + i + '">' + crFav(s === WEB.__err ? WEB.__err.fav : s.fav) +
            '<span class="cr-tabt">' + esc(crTitleOf(t.url)) + '</span><button class="cr-tabx" data-tx="' + i + '" aria-label="Close tab">×</button></div>';
    }).join('');
}
function crChrome() {
    var t = crTab(), s = crSite(t.url);
    var url = CR.el.querySelector('#crUrl'), lock = CR.el.querySelector('#crLock'), star = CR.el.querySelector('#crStar');
    if (document.activeElement !== url) url.value = t.url === 'chrome://newtab' ? '' : t.url;
    lock.textContent = /^chrome:/.test(t.url) ? '⚙' : s === WEB.__err ? '⚠' : '🔒';
    var isBM = crBM().some(function (b) { return b[1] === t.url; });
    star.textContent = isBM ? '★' : '☆'; star.classList.toggle('on', isBM);
    CR.el.querySelector('#crBack').disabled = t.hi <= 0;
    CR.el.querySelector('#crFwd').disabled = t.hi >= t.hist.length - 1;
    var bar = CR.el.querySelector('#crBmbar'), set = crSet();
    bar.hidden = !set.bmbar;
    if (set.bmbar) bar.innerHTML = crBM().map(function (b) {
        return crLink(b[1], crFav((WEB[crResolveKey(b[1])] || {}).fav) + '<span>' + esc(b[0]) + '</span>', 'cr-bmchip');
    }).join('');
    CR.el.classList.toggle('cr-incog', !!CR.incog);   // on the window: reaches the title-bar strip and the toolbar alike
}
function crPage() {
    crDinoStop();                                          // leaving a dino tab always parks the game
    var t = crTab(), s = crSite(t.url), view = CR.el.querySelector('#crView');
    var fresh = view.cloneNode(false);                     // page inits bind listeners to the view: start each page with a clean node
    view.replaceWith(fresh); view = fresh;
    view.style.zoom = CR.zoom;
    view.innerHTML = s === WEB.__err ? s.render(String(t.url).split('/')[0]) : s.render(crQOf(t.url));
    if (s.init) s.init(view);
    view.scrollTop = t.scroll || 0;
    if (find.appId === 'chrome' && findOpenNow()) runFind();   // re-mark the fresh DOM for the Alt+F bar
}

/* ═════════════ omnibox suggestions ═════════════ */
/* the local rows (typed interpretation, bookmarks, history, curated corpus)
   render instantly; a debounced Wikipedia opensearch then folds REAL query
   completions in right under the typed row, exactly like a real omnibox. */
var SUG_CACHE = Object.create(null);                       // query → completions, session-only
function crSugIsUrl(q) { return /^[a-z0-9.-]+\.[a-z]{2,}/.test(q.replace(/^https?:\/\//, '').replace(/^www\./, '')) || /^chrome:\/\//.test(q); }
function crSuggestLocal(q) {
    var rows = [], seen = Object.create(null);   // keyed by typed text: no inherited members
    function add(icon, label, url, note) {
        if (rows.length >= 9 || seen[url]) return; seen[url] = 1;
        rows.push({ icon: icon, label: label, url: url, note: note });
    }
    // row 0 is always the typed-text interpretation, so Enter and the highlight agree.
    var qbare = q.replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (crSugIsUrl(q)) add('🌐', q, qbare, '');
    else add('🔍', 'Search ' + crEngine() + ' for “' + q + '”', 'google.com/search?q=' + encodeURIComponent(q), '');
    crBM().forEach(function (b) { if ((b[0] + ' ' + b[1]).toLowerCase().indexOf(q) >= 0) add('★', b[0], b[1], b[1]); });
    crHist().forEach(function (h) { if ((h.t + ' ' + h.u).toLowerCase().indexOf(q) >= 0) add('🕓', h.t, h.u, h.u); });
    Object.keys(WEB).forEach(function (k) {
        var s = WEB[k]; if (!s.searchable) return;
        if ((k + ' ' + s.stitle).toLowerCase().indexOf(q) >= 0) add('🌐', s.stitle, k, k);
    });
    return { rows: rows, seen: seen };
}
function crSuggestPaint(built) {
    if (!CR) return;
    var box = CR.el.querySelector('#crSuggest');
    CR.sugSel = 0;
    box.innerHTML = built.rows.slice(0, 9).map(function (r, i) {
        return '<div class="cr-sg' + (i === 0 ? ' sel' : '') + '" data-su="' + esc(r.url) + '"><span class="cr-sgic">' + r.icon + '</span><span class="cr-sgt">' + esc(r.label) + '</span>' + (r.note ? '<span class="cr-sgn">— ' + esc(r.note) + '</span>' : '') + '</div>';
    }).join('');
    box.hidden = !built.rows.length;
}
function crSuggest(q) {
    var raw = String(q || '').trim();
    q = raw.toLowerCase();
    if (!q) { CR.el.querySelector('#crSuggest').hidden = true; CR.sugQ = ''; clearTimeout(CR.sugTmr); return; }
    CR.sugQ = q;
    var built = crSuggestLocal(q);
    crSuggestPaint(built);
    clearTimeout(CR.sugTmr);
    if (crSugIsUrl(q) || q.length < 2) return;             // URL-ish or too short: no live completions
    CR.sugTmr = setTimeout(function () { crSuggestLive(q, built); }, 150);
}
function crSuggestLive(q, built) {
    function merge(comps) {
        // only fold in if the user is still typing THIS query and hasn't started
        // arrowing through the list (sel 0) — never yank a highlighted row away
        if (!CR || CR.sugQ !== q || (CR.sugSel || 0) !== 0) return;
        var box = CR.el.querySelector('#crSuggest');
        if (box.hidden) return;
        var extra = [];
        comps.forEach(function (c) {
            var key = 'google.com/search?q=' + encodeURIComponent(c);
            if (c.toLowerCase() === q || built.seen[key]) return;
            built.seen[key] = 1;
            extra.push({ icon: '🔍', label: c, url: key, note: '' });
        });
        if (!extra.length) return;
        var head = built.rows.slice(0, 1), tail = built.rows.slice(1);   // completions sit under row 0
        crSuggestPaint({ rows: head.concat(extra.slice(0, 5)).concat(tail) });
    }
    if (SUG_CACHE[q] && !(CR && CR.incog)) { merge(SUG_CACHE[q]); return; }   // incognito never reads the shared cache either
    liveGet('https://en.wikipedia.org/w/api.php?format=json&origin=*&action=opensearch&limit=6&search=' + encodeURIComponent(q), function (err, j) {
        if (err || !j || !j[1]) return;
        var comps = j[1];
        if (!(CR && CR.incog)) SUG_CACHE[q] = comps;        // incognito keystrokes leave no crumbs
        if (Object.keys(SUG_CACHE).length > 60) SUG_CACHE = Object.create(null);
        merge(comps);
    });
}
function crSuggestMove(d) {
    var box = CR.el.querySelector('#crSuggest'); if (box.hidden) return null;
    var all = box.querySelectorAll('.cr-sg'); if (!all.length) return null;
    CR.sugSel = ((CR.sugSel || 0) + d + all.length) % all.length;
    all.forEach(function (r, i) { r.classList.toggle('sel', i === CR.sugSel); });
    return all[CR.sugSel].getAttribute('data-su');
}
function crSuggestPick() {
    var box = CR.el.querySelector('#crSuggest'); if (box.hidden) return null;
    var sel = box.querySelector('.cr-sg.sel');
    return sel ? sel.getAttribute('data-su') : null;
}

/* ═════════════ dino ═════════════ */
function crDinoStop() { if (CR && CR.dinoRaf) { cancelAnimationFrame(CR.dinoRaf); CR.dinoRaf = 0; } }
function crDinoBoot(view) {
    var cv = view.querySelector('#crDinoCv'); if (!cv) return;
    var x = cv.getContext('2d'), W = cv.width, H = cv.height, G = H - 24;
    var d = { y: G, vy: 0, duck: false, run: false, dead: false, t: 0, speed: 4.4, score: 0, obs: [], clouds: [{ x: 480, y: 30 }, { x: 200, y: 52 }], next: 60 };
    CR.dino = d;
    function jump() {
        if (d.dead) { boot(); return; }
        if (!d.run) d.run = true;
        if (d.y >= G) d.vy = -10.4;
    }
    function boot() { d.obs = []; d.score = 0; d.speed = 4.4; d.dead = false; d.run = true; d.y = G; d.vy = 0; d.next = 60; var tip = view.querySelector('#crDinoTip'); if (tip) tip.textContent = 'Run, pixel lizard, run.'; }
    CR.dinoJump = jump;
    cv.addEventListener('pointerdown', jump);
    function drawDino() {
        x.fillStyle = '#535353';
        var yy = Math.round(d.y);
        x.fillRect(34, yy - 30, 14, 14);                              // head
        x.fillRect(46, yy - 26, 4, 3);                                // snout
        x.fillRect(40, yy - 25, 2, 2);                                // eye (blank when dead)
        if (d.dead) { x.fillStyle = '#fff'; x.fillRect(40, yy - 25, 2, 2); x.fillStyle = '#535353'; }
        x.fillRect(30, yy - 18, 14, 12);                              // body
        x.fillRect(24, yy - 16, 6, 6);                                // tail
        var step = d.run && !d.dead ? (Math.floor(d.t / 6) % 2) : 0;
        x.fillRect(32, yy - 6, 3, 6 - step * 2);                      // legs
        x.fillRect(39, yy - 6, 3, 4 + step * 2);
    }
    function tick() {                                                 // one frame of logic + paint (rAF-free, so tests can step it)
        x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
        x.fillStyle = '#535353';
        for (var gx = 0; gx < W; gx += 11) x.fillRect(gx + (Math.floor(d.t) * 2) % 11 * -1, G + 8, 6, 1);   // scrolling ground
        x.fillRect(0, G + 6, W, 1);
        d.clouds.forEach(function (c) {
            x.fillStyle = '#dadce0'; x.fillRect(c.x, c.y, 28, 6); x.fillRect(c.x + 6, c.y - 4, 14, 4);
            if (d.run && !d.dead) c.x -= 0.4; if (c.x < -30) c.x = W + 20;
        });
        if (d.run && !d.dead) {
            d.t++; d.score += 0.15; d.speed += 0.0007;
            d.vy += 0.58; d.y = Math.min(G, d.y + d.vy);
            if (--d.next <= 0) {
                var big = Math.random() > 0.6;
                d.obs.push({ x: W + 10, w: big ? 16 : 10, h: big ? 30 : 20 });
                d.next = 46 + Math.random() * 60 - Math.min(30, d.speed * 2);
            }
            d.obs.forEach(function (o) { o.x -= d.speed; });
            d.obs = d.obs.filter(function (o) { return o.x > -20; });
            for (var i = 0; i < d.obs.length; i++) {
                var o = d.obs[i];
                if (o.x < 48 && o.x + o.w > 26 && d.y > G - o.h + 2) {
                    d.dead = true; d.run = false;
                    var hi = Math.max(+recall('chrome_dino_hi', 0), Math.floor(d.score));
                    store('chrome_dino_hi', String(hi));
                    var hud = view.querySelector('.cr-dinohud span'); if (hud) hud.textContent = 'HI ' + String(hi).padStart(5, '0');
                    var tip = view.querySelector('#crDinoTip'); if (tip) tip.textContent = 'G A M E  O V E R — space to try again. The cactus sends its regards.';
                }
            }
        }
        x.fillStyle = '#2d8a43';
        d.obs.forEach(function (o) { x.fillRect(o.x, G + 6 - o.h, o.w, o.h); x.fillRect(o.x - 4, G + 6 - o.h + 6, 4, 6); x.fillRect(o.x + o.w, G + 6 - o.h + 9, 4, 6); });
        drawDino();
        var sc = view.querySelector('#crDinoScore'); if (sc) sc.textContent = String(Math.floor(d.score)).padStart(5, '0');
        if (d.dead) { x.fillStyle = '#535353'; x.font = '14px monospace'; x.textAlign = 'center'; x.fillText('G A M E   O V E R', W / 2, 56); }
    }
    function loop() { if (!CR.el.classList.contains('mini')) tick(); CR.dinoRaf = requestAnimationFrame(loop); }   // minimized = paused, run survives
    if (location.search.indexOf('dev') >= 0) window.__crDino = { jump: jump, tick: tick, state: d };   // headless-test hook, room-pages convention
    crDinoStop();
    CR.dinoRaf = requestAnimationFrame(loop);
}

/* ═════════════ init / teardown ═════════════ */
function initChrome(el) {
    CR = { el: el, root: el.querySelector('#crRoot'), tabs: [{ url: 'chrome://newtab', hist: ['chrome://newtab'], hi: 0, scroll: 0 }], active: 0, zoom: 1, incog: false, sugSel: 0, dinoRaf: 0, closed: [] };
    var url = el.querySelector('#crUrl'), suggest = el.querySelector('#crSuggest'), menu = el.querySelector('#crMenu');

    /* controller for the Alt keybind layer (Alt+T/W/Shift+T/digits/L/R/arrows) */
    el._br = {
        newTab: function () { crNewTab(); el._br.focusOmni(); },
        closeTab: function (i) { crCloseTab(i); },
        closeCur: function () { crCloseTab(CR.active); },
        reopen: function () { if (CR.closed.length) crNewTab(CR.closed.pop()); },
        goTab: function (n) {
            var i = n === 9 ? CR.tabs.length - 1 : Math.min(n - 1, CR.tabs.length - 1);
            if (i === CR.active) return;                              // same tab = no-op, like the real thing
            crTab().scroll = el.querySelector('#crView').scrollTop;
            CR.active = i; crChrome(); crTabs(); crPage();
        },
        back: crBack,
        fwd: crFwd,
        reload: function () { var r = el.querySelector('#crReload'); if (r) { r.classList.add('spin'); setTimeout(function () { r.classList.remove('spin'); }, reduce ? 50 : 420); } crPage(); },
        focusOmni: function () { url.focus(); url.select(); }
    };

    /* one delegated click handler for the whole browser — bound to the window, since the
       tab strip now lives up in the title bar (outside #crRoot) yet still fires tab clicks */
    el.addEventListener('click', function (e) {
        if (!e.target.closest('#crMenu') && !e.target.closest('#crMore')) menu.hidden = true;
        if (!e.target.closest('#crOmni')) { suggest.hidden = true; }
        var l = e.target.closest('.cr-l');
        // preventDefault: reader-mode links carry a real href (so they are
        // focusable and announced as links), and without this the click would
        // navigate the sim AND take the whole page to the external site
        if (l) { e.preventDefault(); var t = crTab(); t.scroll = 0; crNav(l.getAttribute('data-href')); return; }
        var tx = e.target.closest('.cr-tabx');
        if (tx) { e.stopPropagation(); crCloseTab(+tx.getAttribute('data-tx')); return; }
        var tab = e.target.closest('.cr-tab');
        if (tab) { crTab().scroll = el.querySelector('#crView').scrollTop; CR.active = +tab.getAttribute('data-ti'); crChrome(); crTabs(); crPage(); return; }
        var mi = e.target.closest('[data-crm]');
        if (mi) { crMenuAct(mi.getAttribute('data-crm')); return; }
        var su = e.target.closest('.cr-sg');
        if (su) { suggest.hidden = true; crNav(crParse(su.getAttribute('data-su'))); return; }
    });
    el.addEventListener('contextmenu', crCtxMenu);
    el.addEventListener('scroll', closeBctx, true);       // real menus don't scroll along with the page
    el.querySelector('#crPlus').addEventListener('click', function () { crNewTab(); });
    el.querySelector('#crTabs').addEventListener('auxclick', function (e) {   // middle-click closes, like Chrome
        if (e.button !== 1) return;
        var t = e.target.closest('.cr-tab');
        if (t) { e.preventDefault(); crCloseTab(+t.getAttribute('data-ti')); }
    });
    el.querySelector('#crBack').addEventListener('click', crBack);
    el.querySelector('#crFwd').addEventListener('click', crFwd);
    el.querySelector('#crReload').addEventListener('click', function () {
        var r = el.querySelector('#crReload'); r.classList.add('spin');
        setTimeout(function () { r.classList.remove('spin'); }, reduce ? 50 : 420);
        crPage();
    });
    el.querySelector('#crStar').addEventListener('click', function () {
        var t = crTab(); if (t.url === 'chrome://newtab') { toast('The New Tab page is already everyone’s favorite.'); return; }
        var bm = crBM(), i = -1;
        bm.forEach(function (b, bi) { if (b[1] === t.url) i = bi; });
        if (i >= 0) { bm.splice(i, 1); crBubble('Bookmark removed'); }
        else { bm.push([crTitleOf(t.url), t.url]); crBubble('Bookmark added ★'); }
        crjSet('bm', bm); crChrome();
    });
    el.querySelector('#crMore').addEventListener('click', function (e) { e.stopPropagation(); crMenuOpen(); });
    el.querySelector('#crExt').addEventListener('click', function () { toast('URE Blocker: 0 ads blocked. This internet is pure.'); });
    el.querySelector('#crAv').addEventListener('click', function () { toast('Synced as isaacoure@gmail.com — profile “Isaac (the only one)”.'); });

    /* omnibox */
    url.addEventListener('focus', function () { setTimeout(function () { url.select(); }, 0); });
    url.addEventListener('input', function () { crSuggest(url.value); });
    url.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); var u = crSuggestMove(1); if (u) url.value = u; }
        else if (e.key === 'ArrowUp') { e.preventDefault(); var u2 = crSuggestMove(-1); if (u2) url.value = u2; }
        // preventDefault so the desktop knows Escape was spent here: cancelling
        // the omnibox is not also a request to leave full screen
        else if (e.key === 'Escape') { suggest.hidden = true; url.blur(); crChrome(); e.preventDefault(); }
        else if (e.key === 'Enter') {
            var pick = crSuggestPick();
            suggest.hidden = true; url.blur();
            crNav(crParse(pick && url.value === pick ? pick : url.value));
        }
    });

    /* dino keys — scoped: only when a dino tab is front-most in THIS window */
    CR.keyFn = function (e) {
        if (!CR || CR.el.classList.contains('mini')) return;
        if (activeApp !== 'chrome') return;                            // Chrome must be the focused window
        if (crTab().url !== 'chrome://dino') return;
        var a = document.activeElement;
        if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;  // omnibox, find bar, any field
        if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); if (CR.dinoJump) CR.dinoJump(); }
    };
    document.addEventListener('keydown', CR.keyFn);

    crChrome(); crTabs(); crPage();
}
function closeChrome() {
    if (CR) { crDinoStop(); clearTimeout(CR.sugTmr); if (CR.keyFn) document.removeEventListener('keydown', CR.keyFn); if (CR.iuKey) document.removeEventListener('keydown', CR.iuKey); }   // a pending autocomplete debounce must not fetch after teardown
    CR = null;
}
function crBubble(msg) {
    var b = CR.el.querySelector('#crBubble');
    b.textContent = msg; b.hidden = false;
    clearTimeout(CR.bubbleT);
    CR.bubbleT = setTimeout(function () { if (CR) b.hidden = true; }, 1600);
}
// swap whole sessions, like a separate window: regular tabs park and return untouched
function crIncogSwap() {
    var held = CR.held || null;
    /* park the session you are LEAVING — unless it is the private one. Keeping
       incognito tabs around to be resurrected on the next swap is precisely the
       thing incognito is supposed not to do. */
    CR.held = CR.incog ? null : { tabs: CR.tabs, active: CR.active, closed: CR.closed };
    CR.incog = !CR.incog;
    if (held && held.tabs && held.tabs.length) {
        CR.tabs = held.tabs; CR.active = Math.min(Math.max(held.active, 0), held.tabs.length - 1); CR.closed = held.closed;
        crChrome(); crTabs(); crPage();
    }
    else { CR.tabs = []; CR.closed = []; CR.active = 0; crNewTab(); }
    toast(CR.incog ? 'Incognito: history is off. Your regular tabs are waiting where you left them.' : 'Back to regular browsing. The record resumes.');
}
function crMenuOpen() {
    var menu = CR.el.querySelector('#crMenu');
    if (!menu.hidden) { menu.hidden = true; return; }
    menu.innerHTML =
        '<button class="cr-mi" data-crm="newtab">New tab</button>' +
        '<button class="cr-mi" data-crm="incog">' + (CR.incog ? 'Leave Incognito' : 'New Incognito window') + '</button>' +
        '<div class="cr-msep"></div>' +
        '<button class="cr-mi" data-crm="history">History</button>' +
        '<button class="cr-mi" data-crm="downloads">Downloads</button>' +
        '<button class="cr-mi" data-crm="bookmarks">Bookmarks</button>' +
        '<div class="cr-mzoom">Zoom <span class="cr-mzctl"><button data-crm="zout">−</button><b id="crZoomPct">' + Math.round(CR.zoom * 100) + '%</b><button data-crm="zin">+</button></span></div>' +
        '<div class="cr-msep"></div>' +
        '<button class="cr-mi" data-crm="print">Print…</button>' +
        '<button class="cr-mi" data-crm="cast">Cast…</button>' +
        '<div class="cr-msep"></div>' +
        '<button class="cr-mi" data-crm="settings">Settings</button>' +
        '<button class="cr-mi" data-crm="about">About Chrome</button>' +
        '<div class="cr-msep"></div>' +
        '<button class="cr-mi" data-crm="exit">Exit</button>';
    menu.hidden = false;
}
function crMenuAct(a) {
    var menu = CR.el.querySelector('#crMenu');
    if (a === 'zin' || a === 'zout') {
        CR.zoom = clamp(Math.round((CR.zoom + (a === 'zin' ? 0.1 : -0.1)) * 10) / 10, 0.5, 2);
        CR.el.querySelector('#crView').style.zoom = CR.zoom;
        var pct = menu.querySelector('#crZoomPct'); if (pct) pct.textContent = Math.round(CR.zoom * 100) + '%';
        return;                                                        // zoom keeps the menu open, like the real one
    }
    menu.hidden = true;
    if (a === 'newtab') crNewTab();
    else if (a === 'incog') crIncogSwap();
    else if (a === 'history') crNav('chrome://history');
    else if (a === 'downloads') crNav('chrome://downloads');
    else if (a === 'bookmarks') crNav('chrome://bookmarks');
    else if (a === 'print') toast('Saved as bloom.pdf to a printer that isn’t real.');
    else if (a === 'cast') toast('No devices found. The room’s TV is decorative.');
    else if (a === 'settings') crNav('chrome://settings');
    else if (a === 'about') crNav('chrome://settings');
    else if (a === 'exit') closeWin('chrome');
}

/* ═════════════ Chrome right-click — context-aware, like the real one ═════════════
   What you clicked decides the menu: a tab, the empty strip, a link,
   selected text, a text field, or the page itself. Every non-gag item
   genuinely works — background tab opens, session-swapped incognito,
   files saved into the real Downloads folder, view-source tabs. */
function crFullURL(href) { return /^[a-z][a-z0-9+.-]*:/i.test(href) ? href : 'https://' + href; }
function crBgTab(url, at) {   // insert without switching — "Open link in new tab"
    CR.tabs.splice(at, 0, { url: url, hist: [url], hi: 0, scroll: 0 });
    if (at <= CR.active) CR.active++;
    crTabs();
}
function crActivateTab(i) {
    var cur = CR.tabs[CR.active];                          // may be gone: close-others/right splice first
    if (cur) cur.scroll = CR.el.querySelector('#crView').scrollTop;
    CR.active = i; crChrome(); crTabs(); crPage();
}
function crSaveFile(title, html) {
    var name = String(title).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 48) + '.html';
    var f = fsAddFile('Downloads', { n: uniqueName('Downloads', name), t: 'globe', size: (Math.max(html.length, 512) / 1024).toFixed(1) + ' KB', date: dlStamp() });
    crBubble('Saved “' + f.n + '” to Downloads');
}
function crCtxMenu(e) {
    e.preventDefault();
    CR.el.querySelector('#crMenu').hidden = true;
    CR.el.querySelector('#crSuggest').hidden = true;
    if (e.target.closest('.win-caps')) { closeBctx(); return; }
    var host = CR.root, dark = !!CR.incog, t = crTab();

    var inp = e.target.closest('input, textarea');
    if (inp && !inp.readOnly && !inp.disabled) {
        var isOmni = inp.id === 'crUrl';
        bctxInput(host, e, inp, isOmni ? { go: function (v) {
            CR.el.querySelector('#crSuggest').hidden = true; inp.blur(); crNav(crParse(v));
        } } : null, dark);
        return;
    }

    var tabEl = e.target.closest('.cr-tab');
    if (tabEl) {
        var i = +tabEl.getAttribute('data-ti'), n = CR.tabs.length;
        openBctx(host, e, [
            { k: 'tnr', t: 'New tab to the right' },
            'sep',
            { k: 'trl', t: 'Reload' },
            { k: 'tdp', t: 'Duplicate' },
            'sep',
            { k: 'tcl', t: 'Close tab', hint: i === CR.active ? 'Alt+W' : '' },
            { k: 'tco', t: 'Close other tabs', dis: n < 2 },
            { k: 'tcr', t: 'Close tabs to the right', dis: i >= n - 1 }
        ], function (a) {
            var T = CR.tabs[i]; if (!T) return;
            crTab().scroll = CR.el.querySelector('#crView').scrollTop;   // save now: the splices below can strand CR.active
            if (a === 'tnr') { CR.tabs.splice(i + 1, 0, { url: 'chrome://newtab', hist: ['chrome://newtab'], hi: 0, scroll: 0 }); crActivateTab(i + 1); }
            else if (a === 'trl') { if (i === CR.active) crPage(); }
            else if (a === 'tdp') { CR.tabs.splice(i + 1, 0, { url: T.url, hist: T.hist.slice(), hi: T.hi, scroll: T.scroll }); crActivateTab(i + 1); }
            else if (a === 'tcl') crCloseTab(i);
            else if (a === 'tco') {
                CR.tabs.forEach(function (x, xi) { if (xi !== i) CR.closed.push(x.url); });
                CR.tabs = [T]; crActivateTab(0);
            }
            else if (a === 'tcr') {
                CR.tabs.splice(i + 1).forEach(function (x) { CR.closed.push(x.url); });
                crActivateTab(Math.min(CR.active, i));
            }
        }, dark);
        return;
    }
    if (e.target.closest('.cr-tabstrip')) {
        openBctx(host, e, [
            { k: 'snt', t: 'New tab', hint: 'Alt+T' },
            { k: 'srt', t: 'Reopen closed tab', hint: 'Alt+Shift+T', dis: !CR.closed.length }
        ], function (a) {
            if (a === 'snt') crNewTab();
            else if (CR.closed.length) crNewTab(CR.closed.pop());
        }, dark);
        return;
    }

    var l = e.target.closest('.cr-l[data-href], .cr-sg[data-su]');
    if (l) {
        var href = l.getAttribute('data-href') || crParse(l.getAttribute('data-su'));
        openBctx(host, e, [
            { k: 'lnt', t: 'Open link in new tab' },
            { k: 'lni', t: 'Open link in Incognito window' },
            'sep',
            { k: 'lcp', t: 'Copy link address' },
            { k: 'lsv', t: 'Save link as…' }
        ], function (a) {
            if (a === 'lnt') crBgTab(href, CR.active + 1);
            else if (a === 'lni') { if (CR.incog) crNewTab(href); else { crIncogSwap(); crNav(href); } }
            else if (a === 'lcp') { setClip(crFullURL(href)); crBubble('Link address copied'); }
            else if (a === 'lsv') {
                var s = crSite(href);
                crSaveFile(crTitleOf(href), s === WEB.__err ? s.render(String(href).split('/')[0]) : s.render(crQOf(href)));
            }
        }, dark);
        return;
    }

    var sel = window.getSelection(), st = sel ? String(sel).trim() : '';
    if (st && sel.anchorNode && CR.el.contains(sel.anchorNode) && e.target.closest('#crView')) {
        var short = st.length > 22 ? st.slice(0, 22) + '…' : st;
        openBctx(host, e, [
            { k: 'scp', t: 'Copy' },
            'sep',
            { k: 'ssr', t: 'Search Google for “' + short + '”' },
            'sep',
            { k: 'spr', t: 'Print…' }
        ], function (a) {
            if (a === 'scp') { setClip(st); crBubble('Copied'); }
            else if (a === 'ssr') crNewTab('google.com/search?q=' + encodeURIComponent(st));
            else toast('Saved as bloom.pdf to a printer that isn’t real.');
        }, dark);
        return;
    }

    openBctx(host, e, [
        { k: 'back', t: 'Back', hint: 'Alt+←', dis: t.hi <= 0 },
        { k: 'fwd', t: 'Forward', hint: 'Alt+→', dis: t.hi >= t.hist.length - 1 },
        { k: 'rld', t: 'Reload', hint: 'Alt+R' },
        'sep',
        { k: 'sav', t: 'Save as…' },
        { k: 'prt', t: 'Print…' },
        'sep',
        { k: 'src', t: 'View page source', dis: /^view-source:/i.test(t.url) },
        { k: 'ins', t: 'Inspect' }
    ], function (a) {
        if (a === 'back') crBack();
        else if (a === 'fwd') crFwd();
        else if (a === 'rld') crPage();
        else if (a === 'sav') crSaveFile(crTitleOf(t.url), CR.el.querySelector('#crView').innerHTML);
        else if (a === 'prt') toast('Saved as bloom.pdf to a printer that isn’t real.');
        else if (a === 'src') crNewTab('view-source:' + t.url);
        else toast('Inspected. It’s pixels all the way down.');
    }, dark);
}

/* —— Photos —— */
var PHOTOS = [['ic-room', 'the room'], ['ic-gti', 'Argent'], ['ic-ureboy', 'URE BOY'], ['ic-ure', 'URE'], ['ic-photos', 'bloom'], ['ic-pc', 'the setup']];
function photoTile(p) { return ic(p[0], 'ph-big') + '<span class="ph-cap">' + esc(p[1]) + '</span>'; }
function renderPhotos(id, arg) {
    var start = clamp(arg | 0, 0, PHOTOS.length - 1);
    var thumbs = PHOTOS.map(function (p, i) { return '<button class="ph-thumb' + (i === start ? ' sel' : '') + '" data-i="' + i + '">' + ic(p[0]) + '</button>'; }).join('');
    return '<div class="photos"><div class="ph-view" id="phView">' + photoTile(PHOTOS[start]) + '</div>' +
        '<div class="ph-strip">' + thumbs + '</div></div>';
}
function selectPhoto(el, i) {
    i = clamp(i | 0, 0, PHOTOS.length - 1);
    el.querySelectorAll('.ph-thumb').forEach(function (x) { x.classList.toggle('sel', +x.getAttribute('data-i') === i); });
    el.querySelector('#phView').innerHTML = photoTile(PHOTOS[i]);
}
function initPhotos(el) {
    el.querySelector('.ph-strip').addEventListener('click', function (e) {
        var b = e.target.closest('.ph-thumb'); if (b) selectPhoto(el, +b.getAttribute('data-i'));
    });
}

/* —— Reader: every PDF on the machine opens somewhere ——
   A few documents have real text (READS); the rest get believable
   filler picked by what the file name claims to be. */
READS['water industry update — sent.pdf'] =
    'WATER INDUSTRY UPDATE\nweek of June 22\n\nProduced water volumes keep climbing and the disposal math keeps getting more interesting. The JV is positioned exactly where the barrels have to go.\n\nRecycling percentages are up again. This is the trend to watch, and the reason the word "midstream" keeps appearing next to the word "water" in serious documents.\n\nAs always: this update is short on purpose. Nobody has ever complained that a newsletter was too short.';
READS['THE BOULDER.pdf'] =
    'CHARACTER SHEET — THE BOULDER\n\nClass: Boulder. Level: yes.\nSTR 20  DEX 1  CON 20  INT —  WIS 14  CHA 17\n\nSkills: Rolling (expertise). Being Pushed (passive).\nPersonality: content.\nBonds: the hill. the party. the routine.\nFlaw: none found. we looked.\n\nDM note: the party will not leave it behind. stat it or lose the table.';
READS['the cow.pdf'] =
    'CHARACTER SHEET — THE COW\n\nRace: cow. Class: cow.\nSpecial ability: STANDS IN GRASS. Nobody asks the cow anything. The cow has achieved what the party seeks.\n\nDM note: added as a joke in session 2. Now load-bearing to party morale. The cow stays.';
READS['dyno day.pdf'] =
    'DYNO SHEET — ARGENT (MK8 GTI, Stage 1+, IE intake, flex fuel)\n\nPull 1: strong.\nPull 2: stronger (the fuel got fancier).\nPull 3: operator grinned, data unusable.\n\nNote from tech: "car is healthy. driver keeps saying \'she.\' this is normal."\n\nNext appointment: after the intercooler leaves the box. (rescheduled x4)';
READS['transcript (unofficial).pdf'] =
    'RICE UNIVERSITY — UNOFFICIAL TRANSCRIPT\n\nStudent: Ure, Isaac Owen\nProgram: Mathematical Economic Analysis\n\n[grades redacted by the student, who is being modest in a way that tells you everything]\n\nDean’s note: none. Deans only write when something is wrong.';
READS['DM screen cheatsheet.pdf'] =
    'BEHIND THE SCREEN — QUICK TABLES\n\n1. If the plan is funny, it works on a 10+.\n2. If sophie rolls persuasion, start writing the new plot.\n3. The boulder is CR 0 and morale +5. Do not touch.\n4. When in doubt: a stranger arrives with a car problem.\n5. HEAT SOAK monologues until interrupted. He wants to be interrupted.';
function rdBody(name) {
    if (READS[name]) return READS[name];
    var stem = name.replace(/\.[^.]+$/, ''), rnd = lcgFor(fsHash(name)), out = [stem.toUpperCase(), ''];
    function para(bits, n) { for (var i = 0; i < n; i++) out.push(pick(rnd, bits)); }
    if (/receipt/i.test(name)) {
        out.push('ITEM                          AMOUNT');
        para(['performance part ........ a number', 'shipping (freight, heavy) ... more', 'the confidence it brings .... included', 'core charge ................. refundable, allegedly', 'tax ......................... inevitable'], 4);
        out.push('', 'TOTAL: worth it', 'warranty void if: asked about');
    } else if (/pset|problem/i.test(name)) {
        para(['Problem 1. Show that the statement is true. (It is. Showing it is your problem.)',
            'Problem 2. Consider an agent maximizing utility. The agent is you. The utility is sleep.',
            'Problem 3. Prove or disprove. Then prove, because it was true the whole time.',
            'Problem 4 (bonus). Left as an exercise for the grader.'], 4);
    } else if (/syllabus/i.test(name)) {
        para(['Week 1–3: hope.', 'Week 4–6: the midterm bends spacetime toward itself.', 'Week 7: reading week (nobody reads. everybody recovers.)',
            'Week 8–12: the material accelerates. so do you, eventually.', 'Finals: cumulative, like all consequences.', '', 'Office hours: yes. Go. They are free and they work.'], 6);
    } else if (/rules/i.test(name)) {
        para(['ARTICLE 4.1.2: the part must exist before it is mounted.', 'ARTICLE 7.3: budgets shall be justified line by line, feeling by feeling.',
            'ARTICLE 9.9: any team member may say "is it supposed to do that." all work stops.', 'ARTICLE 12: safety wire everything. safety wire the safety wire.'], 4);
    } else {
        para(['This document is exactly as long as it needs to be, which is a lie all documents tell.',
            'The figures referenced herein appear on pages that could not be reached for comment.',
            'Further detail is available upon request. Please do not request it.',
            'The author reserves the right to have meant something slightly different.',
            'This page intentionally left about 80% blank, for gravitas.'], 4);
    }
    return out.join('\n');
}
function renderReader(id, arg) {
    return '<div class="rd"><div class="rd-page" id="rdPage"></div>' +
        '<div class="rd-bar"><span id="rdName"></span><span id="rdPg"></span></div></div>';
}
function rdShow(el, a) {
    a = a || { n: 'document.pdf' };
    var h = fsHash(a.n), body = rdBody(a.n);
    el.querySelector('#rdPage').innerHTML = body.split('\n').map(function (ln, i) {
        return ln.trim() === '' ? '<div class="rd-gap"></div>' : '<p class="rd-ln' + (i === 0 ? ' rd-h' : '') + '">' + esc(ln) + '</p>';
    }).join('');
    el.querySelector('#rdName').textContent = a.n;
    el.querySelector('#rdPg').textContent = 'Page 1 of ' + (1 + h % 13) + '  ·  100%';
    el.querySelector('.rd-page').scrollTop = 0;
    var title = el.querySelector('.win-title'); if (title) title.textContent = a.n + ' — Reader';
}
function initReader(el, id, arg) { rdShow(el, arg); }

/* —— URE Media: the machine's one media player ——
   Every mp3/wav/mp4 in the FS is a real "track": a little seeded
   chiptune (WebAudio, minor pentatonic, can't miss) with a pixel
   visualizer. Videos additionally get period-correct static, because
   the codec for pixels this small was never licensed. */
function renderPlayer(id, arg) {
    return '<div class="pl">' +
        '<div class="pl-screen"><canvas class="pl-cv" width="264" height="118"></canvas><div class="pl-title" id="plTitle"></div></div>' +
        '<div class="pl-ctl">' +
          '<button class="pl-btn" id="plPlay" type="button" aria-label="Play or pause">▶</button>' +
          '<div class="pl-track" id="plTrack"><i id="plFill"></i></div>' +
          '<span class="pl-time" id="plTime">0:00</span>' +
        '</div></div>';
}
function plFmt(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + s % 60; }
// one duration per file, so Properties and the player never disagree
function mediaLen(it) { return 110 + fsHash(it.cid || it.n) % 170; }
function plStop(el) {
    var st = el._pl; if (!st) return;
    st.playing = false;
    if (st.stepT) { clearInterval(st.stepT); st.stepT = 0; }
    if (st.drawT) { clearInterval(st.drawT); st.drawT = 0; }
    if (st.ac) { try { st.ac.close(); } catch (e) {} st.ac = null; }
}
function plLoad(el, a) {
    a = a || { n: 'ure boy theme.mp3' };
    plStop(el);
    var seed = fsHash(a.cid || a.n), rnd = lcgFor(seed);
    var st = el._pl = {
        n: a.n, video: !!a.video, seed: seed, playing: false, t: 0,
        len: mediaLen(a), bpm: 96 + seed % 52, step: 0,
        seq: [], eq: [4, 9, 6, 12, 8, 5, 10, 7]
    };
    for (var i = 0; i < 16; i++) st.seq.push(Math.floor(rnd() * 10));
    el.querySelector('#plTitle').textContent = a.n;
    plPaint(el);
    var title = el.querySelector('.win-title'); if (title) title.textContent = a.n + ' — URE Media';
    plDrawLoop(el);
    plToggle(el, true);                                    // opening a track means play it
}
function plPaint(el) {                                      // the bar and clock, wherever st.t currently is
    var st = el._pl; if (!st) return;
    var fill = el.querySelector('#plFill'), tm = el.querySelector('#plTime');
    if (fill) fill.style.width = (st.t / st.len * 100) + '%';
    if (tm) tm.textContent = plFmt(st.t) + ' / ' + plFmt(st.len);
}
function plToggle(el, on) {
    var st = el._pl; if (!st) return;
    st.playing = on == null ? !st.playing : on;
    el.querySelector('#plPlay').textContent = st.playing ? '❚❚' : '▶';
    if (st.stepT) { clearInterval(st.stepT); st.stepT = 0; }
    if (!st.playing) return;
    if (!st.ac) { try { st.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { st.ac = null; } }
    if (st.ac && st.ac.state === 'suspended') { try { st.ac.resume(); } catch (e) {} }
    var spb = 60 / st.bpm / 2;                             // eighth notes
    st.stepT = setInterval(function () {
        if (!st.playing) return;
        st.t += spb; if (st.t >= st.len) st.t = 0;         // loop; nobody is watching the clock
        var s = st.seq[st.step % 16];
        // only a RUNNING context gets tones: while suspended (autoplay policy — the
        // ?dev hooks open with no user gesture) currentTime is frozen, so every
        // queued oscillator would stack on one timestamp and fire as one clap on resume
        if (st.ac && st.ac.state === 'running') {
            var scale = [0, 3, 5, 7, 10], base = 220 * Math.pow(2, Math.floor(s / 5));
            var f = base * Math.pow(2, scale[s % 5] / 12);
            plTone(st, f, spb * 0.86, 'square', 0.035);
            if (st.step % 4 === 0) plTone(st, base / 2, spb * 1.7, 'triangle', 0.05);
        }
        st.step++;
        plPaint(el);
    }, spb * 1000);
}
function plTone(st, freq, dur, type, vol) {
    try {
        var o = st.ac.createOscillator(), g = st.ac.createGain(), now = st.ac.currentTime;
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0004, now + dur);
        o.connect(g); g.connect(st.ac.destination);
        o.start(now); o.stop(now + dur + 0.02);
    } catch (e) {}
}
function plDrawLoop(el) {
    var st = el._pl, cv = el.querySelector('.pl-cv'), cx = cv.getContext('2d');
    var rnd = lcgFor(st.seed ^ 0x9e3779b9);
    st.drawT = setInterval(function () {
        cx.fillStyle = '#101018'; cx.fillRect(0, 0, cv.width, cv.height);
        if (st.video) {                                     // "video": honest pixel static + timecode
            for (var y = 0; y < cv.height; y += 6) for (var x = 0; x < cv.width; x += 6) {
                var v = st.playing ? rnd() : 0.04;
                cx.fillStyle = 'rgba(190,205,225,' + (v * 0.28).toFixed(3) + ')';
                cx.fillRect(x, y, 5, 5);
            }
            cx.fillStyle = '#9fe0c8'; cx.font = '10px monospace';
            cx.fillText('NO PIXEL CODEC — AUDIO ONLY', 12, 20);
            cx.fillText('TC ' + plFmt(st.t) + ':' + Math.floor(rnd() * 24), 12, cv.height - 12);
        } else {                                            // EQ bars that pretend to listen
            for (var i = 0; i < st.eq.length; i++) {
                st.eq[i] = Math.max(3, Math.min(15, st.eq[i] + (st.playing ? Math.floor(rnd() * 7) - 3 : -1)));
                var bh = st.eq[i] * 6;
                cx.fillStyle = i % 3 === 0 ? '#d81e05' : '#9fe0c8';
                cx.fillRect(14 + i * 32, cv.height - 12 - bh, 20, bh);
                cx.fillStyle = 'rgba(255,255,255,.25)';
                cx.fillRect(14 + i * 32, cv.height - 12 - bh, 20, 2);
            }
        }
    }, 110);
}
function initPlayer(el, id, arg) {
    plLoad(el, arg);
    el.querySelector('#plPlay').addEventListener('click', function () { plToggle(el); });
    el.querySelector('#plTrack').addEventListener('click', function (e) {
        var st = el._pl, r = e.currentTarget.getBoundingClientRect();
        if (!st) return;
        st.t = Math.max(0, Math.min(0.999, (e.clientX - r.left) / r.width)) * st.len;
        plPaint(el);                                       // seeking while paused still moves the bar
    });
}

/* —— the blue screen. you did this. ——
   Deleting a crit file "succeeds": the machine goes down, collects
   its feelings, restarts, and quietly restores the file. Windows
   protects Windows. */
function bsodStop(f) {
    if (/hal\.dll/i.test(f)) return 'HAL_INITIALIZATION_FAILED';
    if (/vibes/i.test(f)) return 'VIBES_NOT_FOUND';
    if (/SAM|SYSTEM/.test(f)) return 'REGISTRY_ERROR';
    if (/winlogon|csrss|kernel32|ntdll|user32/i.test(f)) return 'CRITICAL_PROCESS_DIED';
    if (/tcpip|disk/i.test(f)) return 'DRIVER_IRQL_NOT_LESS_OR_EQUAL';
    return 'SYSTEM_FILE_MISSED_IMMEDIATELY';
}
function bsod(fileName) {
    try { sessionStorage.setItem('comp_bsod', fileName); } catch (e) {}
    while (dlgs.length) closeTopDlg();
    teardownApps();          // the machine is down: nothing keeps bleeping over the blue screen
    var d = document.createElement('div'); d.className = 'bsod';
    var rnd = lcgFor(fsHash(fileName)), qr = '';
    for (var y = 0; y < 11; y++) for (var x = 0; x < 11; x++) {
        var on = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7) || rnd() < 0.46;
        qr += '<i' + (on ? ' class="on"' : '') + '></i>';
    }
    d.innerHTML = '<div class="bsod-in">' +
        '<p class="bsod-face">:(</p>' +
        '<p class="bsod-msg">Your PC ran into a problem because someone deleted <b>' + esc(fileName) + '</b> and needs to restart. We’re just collecting some error info, and then we’re going to sit quietly and think about what happened.</p>' +
        '<p class="bsod-pct"><span id="bsodPct">0</span>% complete</p>' +
        '<div class="bsod-foot"><span class="bsod-qr">' + qr + '</span>' +
        '<span class="bsod-stop">For more information about this issue, ask whoever deleted ' + esc(fileName) + '.<br><br>Stop code: ' + bsodStop(fileName) + '<br>What failed: ' + esc(fileName) + '</span></div></div>';
    document.body.appendChild(d);
    var p = 0, iv = setInterval(function () {
        p = Math.min(100, p + 1 + Math.floor(Math.random() * 9));
        var s = byId('bsodPct'); if (s) s.textContent = p;
        if (p >= 100) {
            clearInterval(iv);
            setTimeout(function () { if (!window.__noReboot) location.reload(); }, 1100);
        }
    }, 240);
}

/* —— Recycle Bin: the other half of the file system —— */
function renderBin() {
    return '<div class="exp"><div class="exp-main" style="width:100%">' +
        '<div class="exp-bar"><div class="exp-crumb">Recycle Bin</div>' +
          '<button class="exp-tool" data-bact="empty" type="button">Empty Recycle Bin</button></div>' +
        '<div class="bin-body" id="binBody"></div></div></div>';
}
function drawBinList(el) {
    var body = el.querySelector('#binBody'); if (!body) return;
    var bin = fsLoad().bin;
    if (!bin.length) {
        body.innerHTML = '<div class="bin-empty">' + ic('ic-bin', 'bin-big') + '<p>Recycle Bin is empty</p><span>Nothing thrown out. Tidy machine.</span></div>';
    } else {
        body.innerHTML = '<div class="bin-list">' + bin.map(function (e, i) {
            return '<div class="bin-row"><span class="bin-ic">' + ic(FS_ICON[e.it.t] || 'ic-folder') + '</span>' +
                '<span class="bin-meta"><b>' + esc(e.it.n) + '</b><i>from ' + esc(e.from) + (sizeOf(e.it) ? ' · ' + sizeOf(e.it) : '') + '</i></span>' +
                '<button class="bin-act" data-bact="restore" data-i="' + i + '" type="button">Restore</button>' +
                '<button class="bin-act bin-del" data-bact="purge" data-i="' + i + '" type="button">Delete</button></div>';
        }).join('') + '</div>';
    }
    var btn = el.querySelector('[data-bact="empty"]'); if (btn) btn.disabled = !bin.length;
}
function initBin(el) {
    el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-bact]'); if (!b) return;
        var act = b.getAttribute('data-bact'), i = +b.getAttribute('data-i');
        if (act === 'restore') fsRestore(i);
        else if (act === 'purge') {
            var entry = fsLoad().bin[i]; if (!entry) return;
            dlgConfirm('Permanently delete “' + entry.it.n + '”?', 'This skips every bin there is. Gone gone.', 'Delete', function () {
                var k = fsLoad().bin.indexOf(entry);   // re-resolve: the bin may have changed under the dialog
                if (k >= 0) fsPurge(k);
            });
        } else if (act === 'empty') {
            var n = fsLoad().bin.length; if (!n) return;
            dlgConfirm('Empty the Recycle Bin?', n + (n === 1 ? ' item' : ' items') + ' will be permanently deleted. UreOS will remember the tidiness fondly.', 'Empty it', fsEmptyBin);
        }
    });
    drawBinList(el);
}


/* ═══════════════════ the app registry ═════════════ */
var APPS = {
    explorer: { title: 'File Explorer', icon: 'ic-explorer', w: 720, h: 460, render: renderExplorer, init: initExplorer, focusArg: function (el, arg) { if (arg && exState.explorer && exState.explorer.go) exState.explorer.go(arg); } },
    about:    { title: 'About Isaac', icon: 'ic-ure', w: 540, h: 480, render: renderAbout },
    notepad:  { title: 'Untitled — Notepad', icon: 'ic-notepad', w: 520, h: 420, render: renderNotepad, init: initNotepad, focusArg: function (el, arg) { if (el._npOpen) el._npOpen(arg); } },
    reader:   { title: 'Reader', icon: 'ic-pdf', w: 560, h: 520, render: renderReader, init: initReader, focusArg: function (el, arg) { if (arg) rdShow(el, arg); } },
    player:   { title: 'URE Media', icon: 'ic-audio', w: 320, h: 240, render: renderPlayer, init: initPlayer,
                focusArg: function (el, arg) { if (arg) plLoad(el, arg); },
                onClose: function (el) { plStop(el); }, onMinimize: function (el) { var st = el._pl; if (st && st.playing) plToggle(el, false); } },
    terminal: { title: 'URE Shell', icon: 'ic-terminal', w: 620, h: 400, render: renderTerminal, init: initTerminal },
    settings: { title: 'Settings', icon: 'ic-settings', w: 660, h: 480, render: renderSettings, init: initSettings,
                // "Display settings" from the desktop menu used to do nothing at
                // all when Settings was already open on another pane
                focusArg: function (el, arg) { if (arg && el._setPane) el._setPane(arg); } },
    photos:   { title: 'Photos', icon: 'ic-photos', w: 560, h: 440, render: renderPhotos, init: initPhotos, focusArg: function (el, arg) { if (arg != null) selectPhoto(el, arg | 0); } },
    calc:     { title: 'Calculator', icon: 'ic-calc', w: 300, h: 440, render: renderCalc, init: initCalc },
    chrome:   { title: 'Google Chrome', icon: 'ic-chrome', w: 980, h: 640, titlebar: crTitlebar, render: renderChrome, init: initChrome, onClose: closeChrome },
    bin:      { title: 'Recycle Bin', icon: 'ic-bin', w: 600, h: 400, render: renderBin, init: initBin },
    ninth: { title: 'NINTH NIGHT', icon: 'ic-ninth', w: 1160, h: 720,
        render: function () { return window.NINTH ? window.NINTH.render() : '<p style="padding:24px">Nobody said anything (ninth.js missing).</p>'; },
        init: function (el) { if (window.NINTH) window.NINTH.init(el); },
        onFocus: function (el) { var r = el.querySelector('.nn'); if (r) r.focus(); },
        // rAF keeps running behind a minimized window, so the ambience would
        // carry on playing out of a window nobody can see
        onMinimize: function () { if (window.NINTH && window.NINTH.suspend) window.NINTH.suspend(); },
        onRestore: function (el) { if (window.NINTH && window.NINTH.resume) window.NINTH.resume(); var r = el.querySelector('.nn'); if (r) r.focus(); },
        onClose: function () { if (window.NINTH) window.NINTH.close(); } },
    ureboy:   { launch: '/ureboy/' },
    room:     { launch: '/1p/' },
    gti:      { launch: '/ureboy/' }
};

/* ═══════════════════ Start menu + launch wiring ═════════════ */
var startMenu = byId('startMenu'), startBtn = byId('startBtn'), startSearch = byId('startSearch');
var userBtn = byId('userBtn'), userFly = byId('userFly');
function setStart(open) {
    setUserFly(false);            // the flyout never outlives the Start it hangs off, and never opens with it
    startMenu.hidden = false;
    void startMenu.offsetWidth;   // commit the unhidden state so the fade still animates —
    // fully synchronous: .open is never stale (the keybind layer gates on it, and a
    // queued rAF could land AFTER a close and corrupt the state)
    startMenu.classList.toggle('open', open);
    startBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    tbPeek(open); fsYield();   // Start hangs off a taskbar that has to be there to hang off
    if (open) { closeFlyouts(); closeCtx(); closeBctx(); closeTaskView(); setTimeout(function () { startSearch.focus(); }, 40); }
    else { startSearch.value = ''; filterStart(''); }
}
startBtn.addEventListener('click', function (e) { e.stopPropagation(); setStart(!startMenu.classList.contains('open')); });
startMenu.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!e.target.closest('.user-wrap')) setUserFly(false);   // light-dismiss: a click anywhere else in Start
});
byId('powerBtn').addEventListener('click', shutdown);

/* The name at the bottom of Start opens the account flyout, the way the real
   one does — three lines just above the button — rather than the About
   window. Change account settings is Settings > Accounts; Lock and Sign out
   are the lock screen below. */
function userFlyOpen() { return userFly.classList.contains('open'); }
function setUserFly(open) {
    if (open === userFlyOpen()) return;
    userFly.hidden = false; void userFly.offsetWidth;   // same dance as setStart: commit, then fade
    userFly.classList.toggle('open', open);
    userBtn.classList.toggle('on', open);
    userBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) userFly.querySelector('[data-uact]').focus();
}
userBtn.addEventListener('click', function () { setUserFly(!userFlyOpen()); });
userFly.addEventListener('click', function (e) {
    var b = e.target.closest('[data-uact]'); if (!b) return;
    var a = b.getAttribute('data-uact');
    setUserFly(false);
    if (a === 'settings') openApp('settings', 'accounts');
    else if (a === 'lock') lockScreen(false);
    else if (a === 'signout') lockScreen(true);
});
// it is a menu: the arrows walk it, and it goes when the focus does
userFly.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    var items = userFly.querySelectorAll('[data-uact]'), n = items.length, i = -1;
    for (var k = 0; k < n; k++) if (items[k] === document.activeElement) i = k;
    items[e.key === 'ArrowDown' ? (i + 1) % n : (i <= 0 ? n - 1 : i - 1)].focus();
    e.preventDefault();
});
userBtn.parentNode.addEventListener('focusout', function (e) {
    if (e.relatedTarget && !userBtn.parentNode.contains(e.relatedTarget)) setUserFly(false);
});

function filterStart(q) {
    q = q.trim().toLowerCase();
    var any = false;
    byId('pins').querySelectorAll('.pin').forEach(function (p) {
        var hit = p.textContent.toLowerCase().indexOf(q) >= 0;
        p.style.display = hit ? '' : 'none'; if (hit) any = true;
    });
    byId('recSec').style.display = q ? 'none' : '';
    byId('startEmpty').hidden = any || !q;
}
startSearch.addEventListener('input', function () { filterStart(startSearch.value); });
startSearch.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { var first = byId('pins').querySelector('.pin:not([style*="none"])'); if (first) first.click(); }
});

// launch from start pins/recs/user, desktop icons
function wireLaunchers(root) {
    root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-app]'); if (!b) return;
        openApp(b.getAttribute('data-app'));
    });
}
wireLaunchers(startMenu);

var desktop = byId('desktop');
desktop.addEventListener('click', function (e) {
    var d = e.target.closest('.dicon');
    desktop.querySelectorAll('.dicon.sel').forEach(function (x) { x.classList.remove('sel'); });
    if (d) d.classList.add('sel');
});
desktop.addEventListener('dblclick', function (e) {
    var d = e.target.closest('.dicon'); if (!d) return;
    var it = tileItem('Desktop', d); if (!it) return;
    openItemFrom(it);                             // files dropped on the desktop open like anywhere else
});

byId('searchBtn').addEventListener('click', function (e) { e.stopPropagation(); setStart(true); });

/* ═══════════════════════ flyouts ════════════════════════════ */
var quickPanel = byId('quickPanel'), calPanel = byId('calPanel');
/* fsYield() here and not only in toggleFlyout: every dismissal chain in the
   file runs `setStart(false); closeFlyouts();` in that order, and setStart
   syncs while the flyout is STILL up — so `up` came out true and nothing ran
   again once closeFlyouts hid it. body.fs-yield latched on and left the
   full-screen window painted at z-10, under the taskbar, eating its bottom
   48px. The writer of the state owns the sync. */
function closeFlyouts() { quickPanel.hidden = true; calPanel.hidden = true; fsYield(); }

function toggleFlyout(panel, build) {
    var opening = panel.hidden;
    closeFlyouts(); setStart(false); closeCtx(); closeBctx();
    if (opening) { build(); panel.hidden = false; }
    tbPeek(opening); fsYield();   // and so does everything else anchored to the bar
}
byId('quickBtn').addEventListener('click', function (e) { e.stopPropagation(); toggleFlyout(quickPanel, buildQuick); });
byId('clock').addEventListener('click', function (e) { e.stopPropagation(); toggleFlyout(calPanel, buildCal); });
quickPanel.addEventListener('click', function (e) { e.stopPropagation(); });
calPanel.addEventListener('click', function (e) { e.stopPropagation(); });

/* The taskbar volume is the system volume as far as the player is
   concerned, so it drives whatever app owns sound. NINTH persists it
   in its own save, which is why it survives without a store here. */
function sysVolume() {
    if (window.NINTH && window.NINTH.volume) { try { return Math.round(window.NINTH.volume() * 100); } catch (e) {} }
    return 65;
}
function setSysVolume(pct) {
    if (window.NINTH && window.NINTH.volume) { try { window.NINTH.volume(clamp(pct, 0, 100) / 100); } catch (e) {} }
}
function buildQuick() {
    var tiles = [['ic-wifi', 'Wi-Fi', 1], ['ic-bt', 'Bluetooth', 0], ['ic-plane', 'Airplane', 0], ['ic-batt', 'Battery saver', 0], ['ic-moon', 'Night light', 0], ['ic-access', 'Accessibility', 0]];
    // the one tile here that does something. Rebuilt on every open, so it reads
    // the live state rather than remembering a stale one like its neighbours.
    if (PFS.can()) tiles.push(['ic-fs', 'Full screen', PFS.on() ? 1 : 0, 'pagefs']);
    quickPanel.innerHTML = '<div class="qs-grid">' + tiles.map(function (t) {
        return '<button class="qs-tile' + (t[2] ? ' on' : '') + '"' + (t[3] ? ' data-qs="' + t[3] + '" aria-pressed="' + (t[2] ? 'true' : 'false') + '"' : '') + '>' + ic(t[0]) + '<span>' + t[1] + '</span></button>';
    }).join('') + '</div>' +
        '<div class="qs-slider">' + ic('ic-moon') + '<input type="range" min="20" max="100" value="80" aria-label="Brightness"></div>' +
        '<div class="qs-slider">' + ic('ic-vol') + '<input type="range" min="0" max="100" value="' + sysVolume() + '" aria-label="Volume"></div>' +
        '<div class="qs-foot"><span>' + ic('ic-batt') + ' 87%</span><button class="qs-gear" data-app="settings" aria-label="All settings">' + ic('ic-settings') + '</button></div>';
    quickPanel.querySelectorAll('.qs-tile').forEach(function (t) {
        t.addEventListener('click', function () {
            if (t.getAttribute('data-qs') === 'pagefs') {
                // must be inside the gesture, not after a tick. Painting the
                // tile is pageFsSync's job and only pageFsSync's: reading
                // PFS.on() here returns the state from BEFORE the request,
                // because the API sets fullscreenElement in a queued task —
                // so this tile used to show the exact inverse of the truth.
                togglePageFs();
                return;
            }
            t.classList.toggle('on');
        });
    });
    quickPanel.querySelector('.qs-gear').addEventListener('click', function () { openApp('settings'); });
    // the volume slider was decoration. It is the game's master volume now,
    // which is where a player will actually look for it.
    var vs = quickPanel.querySelectorAll('.qs-slider input')[1];
    if (vs) vs.addEventListener('input', function () { setSysVolume(+vs.value); });
}

var calView = null;
function buildCal() {
    var now = new Date();
    if (!calView) calView = { y: now.getFullYear(), m: now.getMonth() };
    function draw() {
        var y = calView.y, m = calView.m;
        var first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
        var cells = '';
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(function (d) { cells += '<span class="cal-dow">' + d + '</span>'; });
        for (var i = 0; i < first; i++) cells += '<span class="cal-cell dim"></span>';
        for (var d = 1; d <= days; d++) {
            var today = (y === now.getFullYear() && m === now.getMonth() && d === now.getDate());
            cells += '<span class="cal-cell' + (today ? ' today' : '') + '">' + d + '</span>';
        }
        calPanel.innerHTML = '<div class="cal-top"><div class="cal-big">' + DOW[now.getDay()] + '</div><div class="cal-date">' + MON[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear() + '</div></div>' +
            '<div class="cal-head"><span>' + MON[m] + ' ' + y + '</span><span class="cal-arrows"><button data-mo="-1" aria-label="Previous month">‹</button><button data-mo="1" aria-label="Next month">›</button></span></div>' +
            '<div class="cal-grid">' + cells + '</div>';
        calPanel.querySelector('.cal-arrows').addEventListener('click', function (e) {
            var b = e.target.closest('[data-mo]'); if (!b) return;
            calView.m += +b.getAttribute('data-mo'); if (calView.m < 0) { calView.m = 11; calView.y--; } if (calView.m > 11) { calView.m = 0; calView.y++; }
            draw();
        });
    }
    draw();
}

/* ═══════════════════════ context menu ══════════════════════ */
var ctx = byId('ctx');
function closeCtx() { ctx.hidden = true; }
desktop.addEventListener('contextmenu', function (e) {
    e.preventDefault(); setStart(false); closeFlyouts(); closeFctx(); closeBctx();
    var d = e.target.closest('.dicon');
    if (d) {   // icons get the file menu; empty desktop gets the desktop menu
        closeCtx();
        desktop.querySelectorAll('.dicon.sel').forEach(function (x) { x.classList.remove('sel'); });
        d.classList.add('sel');
        var it = tileItem('Desktop', d); if (!it) return;
        openFctx(e, { path: 'Desktop', it: it, tile: d, open: function () { openItemFrom(it); }, redraw: renderDesktop });
        return;
    }
    ctx.hidden = false;
    ctx.style.left = clamp(e.clientX, 6, window.innerWidth - ctx.offsetWidth - 6) + 'px';
    ctx.style.top = clamp(e.clientY, 6, window.innerHeight - ctx.offsetHeight - 6) + 'px';
});
ctx.addEventListener('click', function (e) {
    var it = e.target.closest('.ctx-item'); if (!it) return;
    var a = it.getAttribute('data-act');
    if (a === 'refresh') renderWall();
    else if (a === 'terminal') openApp('terminal');
    else if (a === 'fullscreen') togglePageFs();
    else if (a === 'display') openApp('settings', 'system');
    else if (a === 'personalize') openApp('settings');
    if (!it.classList.contains('sub')) closeCtx();
});

/* ═══════════════════════ shutdown gag ══════════════════════ */
function shutdown() {
    setStart(false);
    var ov = document.createElement('div'); ov.className = 'shutdown';
    ov.innerHTML = '<div class="sd-spin"></div><p>Shutting down…</p>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('on'); });
    setTimeout(function () {
        ov.querySelector('p').textContent = 'Just kidding. Welcome back.';
        setTimeout(function () { ov.classList.remove('on'); setTimeout(function () { ov.remove(); }, 400); }, 900);
    }, reduce ? 200 : 1400);
}

/* ═══════════ lock screen: Lock and Sign out, from the account flyout ═══════════
   Lock is the real thing: the wallpaper with the clock on it, and a click or
   a key trades that for the sign-in tile. Sign out gets there by way of
   "Signing out…". There is one account on this machine and it has no
   password, so Sign in is a button — and it puts you back exactly where you
   were, windows and all, which is the shutdown gag's policy too.
   The overlay paints its own copy of the wallpaper (opaque, so nothing
   behind it matters) and, while it is up, a window-capture listener swallows
   every key before the desktop or a game can hear it. */
var lockEl = null;
function lockScreen(signout) {
    if (lockEl) return;
    setStart(false); closeFlyouts(); closeCtx(); closeFctx(); closeBctx(); closeTaskView();
    var ov = document.createElement('div');
    ov.className = 'lock' + (signout ? ' msg' : '');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', signout ? 'Signing out' : 'Locked');
    ov.tabIndex = -1;
    ov.innerHTML =
        '<canvas class="lock-wall" aria-hidden="true"></canvas>' +
        '<div class="lock-clock" aria-hidden="true"><div class="lock-time"></div><div class="lock-date"></div></div>' +
        '<div class="lock-tile">' +
          '<div class="lock-av">' + ic('ic-user') + '</div>' +
          '<div class="lock-name">Isaac Ure</div>' +
          '<button class="lock-btn" type="button">Sign in</button>' +
        '</div>' +
        '<div class="lock-tray" aria-hidden="true">' + ic('ic-net') + ic('ic-access') + ic('ic-power') + '</div>' +
        '<div class="lock-msg" aria-live="polite"><div class="sd-spin"></div><p>' + (signout ? 'Signing out…' : '') + '</p></div>';
    var cv = ov.querySelector('.lock-wall'), tEl = ov.querySelector('.lock-time'), dEl = ov.querySelector('.lock-date');
    var btn = ov.querySelector('.lock-btn'), msg = ov.querySelector('.lock-msg p');
    var phase = signout ? 'out' : 'locked', tick, rsT;
    function paint() { cv.width = wall.width; cv.height = wall.height; cv.getContext('2d').drawImage(wall, 0, 0); }
    function clock() { var n = new Date(); tEl.textContent = fmtTime(n); dEl.textContent = DOW[n.getDay()] + ', ' + MON[n.getMonth()] + ' ' + n.getDate(); }
    function toSignin() { if (phase !== 'locked') return; phase = 'signin'; ov.setAttribute('aria-label', 'Sign in'); ov.classList.add('signin'); btn.focus(); }
    function signIn() {
        if (phase !== 'signin') return; phase = 'welcome';
        msg.textContent = 'Welcome'; ov.classList.add('welcome', 'msg'); ov.focus();
        setTimeout(unlock, reduce ? 250 : 1100);
    }
    function unlock() {
        clearInterval(tick); clearTimeout(rsT); window.removeEventListener('resize', onResize);
        lockEl = null; ov.classList.remove('on');
        setTimeout(function () { ov.remove(); }, 350);
    }
    function onResize() { clearTimeout(rsT); rsT = setTimeout(paint, 200); }   // the desktop re-renders its wall at 120ms; copy the new one
    ov.addEventListener('click', function (e) { if (e.target.closest('.lock-btn')) signIn(); else toSignin(); });
    ov.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    lockEl = { el: ov, key: function (e) {
        if (e.key === 'Tab') { e.preventDefault(); (phase === 'signin' ? btn : ov).focus(); return; }   // focus stays on the lock screen
        if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
        if (phase === 'locked') { toSignin(); if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); }
        else if (phase === 'signin' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); signIn(); }
    } };
    paint(); clock(); tick = setInterval(clock, 10000);
    window.addEventListener('resize', onResize);
    document.body.appendChild(ov);
    void ov.offsetWidth; ov.classList.add('on');   // commit the unpainted state so the fade runs; no rAF, so it also runs headless
    ov.focus();
    if (signout) setTimeout(function () { ov.classList.remove('msg'); ov.setAttribute('aria-label', 'Locked'); phase = 'locked'; }, reduce ? 300 : 1500);
}
// Registered at load, before any app registers its own window-capture listener
// (Racer has one), so it is first in line for every key while the screen is locked.
window.addEventListener('keydown', function (e) {
    if (!lockEl) return;
    e.stopImmediatePropagation();
    lockEl.key(e);
}, true);

/* ═════════════ in-app find (Alt+F) — Chrome-style bar ═══════════
   One find state at a time; the bar lives inside the focused window
   (top-right, like Chrome). Matches get <mark class="fnd">, current
   gets .cur; Enter/Shift+Enter and F3/Shift+F3 cycle with wraparound.
   Notepad is special-cased: you can't wrap marks inside a textarea,
   so a mirrored backdrop div carries the highlights behind it. */
var find = { appId: null, q: '', marks: [], idx: -1 };

function findBar(id) { var w = openWins[id]; return w ? w.el.querySelector('.findbar') : null; }
function findOpenNow() {
    var w = find.appId && openWins[find.appId];
    var b = w && !w.min && findBar(find.appId);              // a minimized window's bar isn't "open"
    return !!(b && !b.hidden);
}

function openFind(id) {
    var w = openWins[id]; if (!w) return;
    if (find.appId && find.appId !== id) closeFind();
    find.appId = id;
    var bar = findBar(id);
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'findbar px-sm';
        bar.innerHTML = '<input class="find-in" type="text" spellcheck="false" autocomplete="off" aria-label="Find in ' + esc(APPS[id].title) + '">' +
            '<span class="find-count"></span><span class="find-div"></span>' +
            '<button class="find-btn" data-f="-1" type="button" aria-label="Previous match">▲</button>' +
            '<button class="find-btn" data-f="1" type="button" aria-label="Next match">▼</button>' +
            '<button class="find-btn" data-f="x" type="button" aria-label="Close find bar">✕</button>';
        w.el.appendChild(bar);
        var inp = bar.querySelector('.find-in');
        inp.addEventListener('input', function () { find.q = inp.value; runFind(); });
        inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); navFind(e.shiftKey ? -1 : 1); }
        });
        bar.addEventListener('click', function (e) {
            var b = e.target.closest('.find-btn'); if (!b) return;
            var f = b.getAttribute('data-f');
            if (f === 'x') closeFind(); else navFind(+f);
        });
    }
    bar.hidden = false;
    var box = bar.querySelector('.find-in');
    box.value = find.q;                      // Chrome remembers the last query
    box.focus(); box.select();
    if (find.q) runFind();
}

function closeFind() {
    if (!find.appId) return;
    var w = openWins[find.appId];
    if (w) {
        var bar = findBar(find.appId); if (bar) bar.hidden = true;
        var root = w.el.querySelector('.win-content'); if (root) unmarkAll(root);
        var back = w.el.querySelector('.np-back'); if (back) back.textContent = '';
    }
    find.appId = null; find.marks = []; find.idx = -1;
}

function unmarkAll(root) {
    var ms = root.querySelectorAll('mark.fnd');
    for (var i = 0; i < ms.length; i++) ms[i].parentNode.replaceChild(document.createTextNode(ms[i].textContent), ms[i]);
    if (ms.length) root.normalize();
}

// wrap every match in the window's content; skips chrome, form fields, and hidden text (like the real find)
function markMatches(root, q) {
    var hits = [], nodes = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
        if (n.nodeValue.toLowerCase().indexOf(q) < 0) return NodeFilter.FILTER_REJECT;
        var el = n.parentElement;
        if (!el || !el.offsetParent || el.closest('script,style,input,textarea,.findbar')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
    } });
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
        var text = node.nodeValue, lower = text.toLowerCase(), i = 0, pos;
        var frag = document.createDocumentFragment();
        while ((pos = lower.indexOf(q, i)) >= 0) {
            frag.appendChild(document.createTextNode(text.slice(i, pos)));
            var m = document.createElement('mark'); m.className = 'fnd';
            m.textContent = text.slice(pos, pos + q.length);
            frag.appendChild(m); hits.push(m);
            i = pos + q.length;
        }
        frag.appendChild(document.createTextNode(text.slice(i)));
        node.parentNode.replaceChild(frag, node);
    });
    return hits;
}

function paintCount() {
    var bar = findBar(find.appId); if (!bar) return;
    var c = bar.querySelector('.find-count');
    c.textContent = find.q ? (find.idx + 1) + '/' + find.marks.length : '';
    c.classList.toggle('nohit', !!find.q && !find.marks.length);
}

function runFind(keep) {
    var w = openWins[find.appId]; if (!w) return;
    var q = find.q.toLowerCase();
    if (find.appId === 'notepad') { npFind(w.el, q, keep ? find.idx : -1); paintCount(); return; }
    var root = w.el.querySelector('.win-content');
    unmarkAll(root);
    find.marks = q ? markMatches(root, q) : [];
    find.idx = find.marks.length ? 0 : -1;
    if (find.idx === 0) setCur(0);
    paintCount();
}

function setCur(i) {
    if (find.marks[find.idx]) find.marks[find.idx].classList.remove('cur');
    find.idx = i;
    var m = find.marks[i]; m.classList.add('cur');
    if (find.appId === 'notepad') {
        var w = openWins.notepad, ta = w.el.querySelector('.np-text'), back = w.el.querySelector('.np-back');
        ta.scrollTop = Math.max(0, m.offsetTop - ta.clientHeight / 2);
        back.scrollTop = ta.scrollTop;
    } else m.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function navFind(dir) {
    var stale = find.marks.some(function (m) { return !m.isConnected; });
    if (stale) { runFind(); return; }                        // app re-rendered under us
    var total = find.marks.length; if (!total) return;
    setCur((find.idx + dir + total) % total);
    paintCount();
}

// Notepad: highlight in a mirrored backdrop behind the transparent textarea.
// prevIdx >= 0 = a typing refresh: keep that match current, don't touch scroll.
function npFind(winEl, q, prevIdx) {
    var ta = winEl.querySelector('.np-text'), back = winEl.querySelector('.np-back');
    back.textContent = '';
    back.style.width = ta.clientWidth + 'px';                // exclude the scrollbar
    find.marks = []; find.idx = -1;
    if (!q) return;
    var v = ta.value, lower = v.toLowerCase(), i = 0, pos;
    var frag = document.createDocumentFragment();
    while ((pos = lower.indexOf(q, i)) >= 0) {
        frag.appendChild(document.createTextNode(v.slice(i, pos)));
        var m = document.createElement('mark'); m.className = 'fnd';
        m.textContent = v.slice(pos, pos + q.length);
        frag.appendChild(m); find.marks.push(m);
        i = pos + q.length;
    }
    frag.appendChild(document.createTextNode(v.slice(i)));
    back.appendChild(frag);
    back.scrollTop = ta.scrollTop;
    if (find.marks.length) {
        if (prevIdx >= 0) {
            find.idx = Math.min(prevIdx, find.marks.length - 1);
            find.marks[find.idx].classList.add('cur');       // hold position, no scroll
        } else { find.idx = 0; setCur(0); }
    }
}

/* ═════════ Alt keybinds — Alt is this OS's Ctrl/Win key ═════════
   The real browser owns Ctrl+T/W/N, so the pixel OS claims Alt.
   App-scoped binds win over system binds (Chrome's Alt+W closes a
   tab; anywhere else it closes the window). Alt+/ shows the map. */
function topAppId() { return (activeApp && openWins[activeApp] && !openWins[activeApp].min) ? activeApp : null; }

function cycleWindows() {
    var ids = Object.keys(openWins).filter(function (id) { return !openWins[id].min; });
    if (!ids.length) return;
    ids.sort(function (a, b) { return (+openWins[a].el.style.zIndex || 0) - (+openWins[b].el.style.zIndex || 0); });
    focusWin(ids[0]);                                        // bottom-most rises: round-robin
}
function taskbarSlot(n) {
    var btns = taskbar.querySelectorAll('.tb-btn.app');
    if (btns[n - 1]) btns[n - 1].click();
}

var OS_KEYS = {
    'f': function () { var id = topAppId(); if (id) openFind(id); },
    'e': function () { openApp('explorer'); },               // Win+E
    'i': function () { openApp('settings'); },               // Win+I
    'a': function () { toggleFlyout(quickPanel, buildQuick); },   // Win+A
    'n': function () { toggleFlyout(calPanel, buildCal); },       // Win+N
    's': function () { setStart(!startMenu.classList.contains('open')); },
    'd': minimizeAll,                                        // Win+D
    'v': function () { if (byId('taskView')) closeTaskView(); else openTaskView(); },
    'm': function () { var id = topAppId(); if (id) minWin(id); },
    'w': function () { var id = topAppId(); if (id) closeWin(id); },
    'arrowup': function () {
        var id = topAppId(); if (!id) return;
        if (winIsFs(id)) exitWinFs(id);          // .maxi's !important would fight .fs otherwise
        openWins[id].el.classList.add('maxi');
    },
    'arrowdown': function () {
        var id = topAppId(); if (!id) return;
        var el = openWins[id].el;
        // full screen is the top of the ladder: down comes off it first
        if (winIsFs(id)) exitWinFs(id);
        else if (el.classList.contains('maxi')) el.classList.remove('maxi'); else minWin(id);
    },
    ' ': function () { var id = topAppId(); if (id) winSysMenu(id); },   // Alt+Space, since 1985
    '`': cycleWindows, 'tab': cycleWindows,
    '/': function () { toggleCheat(); }
};

// per-app binds — each app exposes a controller on its window element
var APP_KEYS = {
    chrome: {
        't': function () { chromeCtl('newTab'); },
        'w': function () { chromeCtl('closeCur'); },
        'shift+t': function () { chromeCtl('reopen'); },
        'l': function () { chromeCtl('focusOmni'); },
        'd': function () { chromeCtl('focusOmni'); },        // Alt+D is the address bar in real Chrome
        'r': function () { chromeCtl('reload'); },
        'arrowleft': function () { chromeCtl('back'); },
        'arrowright': function () { chromeCtl('fwd'); }
    },
    explorer: {
        'arrowleft': function () { expCtl('back'); },
        'arrowup': function () { expCtl('up'); }               // Alt+Up = up one level, like the real one
    },
    terminal: { 'l': function () { var w = openWins.terminal; if (w && w.el._clear) w.el._clear(); } },
    notepad:  { 's': function () { var w = openWins.notepad; if (w && w.el._flash) w.el._flash(); } }
};
function chromeCtl(fn, arg) { var w = openWins.chrome; if (w && w.el._br && w.el._br[fn]) w.el._br[fn](arg); }
function expCtl(fn) { var w = openWins.explorer; if (w && w.el._nav && w.el._nav[fn]) w.el._nav[fn](); }

document.addEventListener('keydown', function (e) {
    // find-bar service keys — only for the ACTIVE window, and only when no
    // higher-priority surface (dialog, cheat sheet, start menu) is up
    if (findOpenNow() && find.appId === activeApp && !dlgs.length && !byId('cheatsheet') && !startMenu.classList.contains('open')) {
        if (e.key === 'F3') { e.preventDefault(); navFind(e.shiftKey ? -1 : 1); return; }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); return; }
    }
    if (byId('cheatsheet') && e.key === 'Escape') { e.stopPropagation(); closeCheat(); return; }

    // F11 belongs to this machine, not to the browser wrapped around it. It has
    // to be handled up here, above the "no modifier, so it is the app's" exit
    // below, or it never fires while a Notepad or Terminal field has focus.
    //   F11        the focused window takes the screen (nothing open: the page does)
    //   Shift+F11  the page itself, through the real Fullscreen API
    //   Alt+Enter  the shortcut every game has used for thirty years
    // Shift is the page/window switch; Ctrl, Alt and Meta are somebody else's
    // combination and were being swallowed along with the plain key
    if ((e.key === 'F11' && !e.ctrlKey && !e.altKey && !e.metaKey) ||
        (e.key === 'Enter' && e.altKey && !e.ctrlKey && !e.metaKey)) {
        var f11App = e.key === 'F11' && e.shiftKey ? null : topAppId();
        if (e.key === 'Enter' && !f11App) return;            // Alt+Enter on bare desktop stays free
        // hand it back rather than eating it: preventDefault with no action
        // made F11 a dead key in BOTH machines while the shortcut card that
        // advertises F11 was the thing on screen
        if (dlgs.length || byId('cheatsheet')) return;
        e.preventDefault(); e.stopPropagation();
        if (f11App) toggleWinFs(f11App); else togglePageFs();
        return;
    }

    var typing = e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName);
    if (!e.altKey && !e.ctrlKey && !e.metaKey && !typing) {
        if (dlgs.length) return;                             // a modal dialog owns plain keys
        // plain-key niceties for the focused app
        if (activeApp === 'photos' && openWins.photos && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            var cur = openWins.photos.el.querySelector('.ph-thumb.sel');
            var i = cur ? +cur.getAttribute('data-i') : 0;
            selectPhoto(openWins.photos.el, (i + (e.key === 'ArrowRight' ? 1 : -1) + PHOTOS.length) % PHOTOS.length);
            e.preventDefault(); return;
        }
        if (activeApp === 'explorer' && openWins.explorer && e.key === 'Enter') {
            var sel = openWins.explorer.el.querySelector('.fitem.sel');
            if (sel) { sel.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); e.preventDefault(); }
            return;
        }
        return;
    }
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (dlgs.length) return;                             // a modal dialog owns the Alt shortcuts too, not just plain keys

    // dispatch on e.code for letters/digits: on macOS, Option composes
    // characters (Alt+F arrives as "ƒ"), and layouts move symbols around
    var code = e.code || '';
    var k = /^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() :
            /^Digit[0-9]$/.test(code) ? code.slice(5) :
            code === 'Backquote' ? '`' :
            // macOS composes Option+Space as U+00A0 NO-BREAK SPACE, so the one
            // new OS_KEYS binding — Alt+Space for the system menu — was dead
            // there: exactly the failure this ladder exists to prevent
            code === 'Space' ? ' ' :
            code === 'Slash' ? '/' : e.key.toLowerCase();
    var c = (e.shiftKey ? 'shift+' : '') + k;
    var id = topAppId();
    var fn = id && APP_KEYS[id] && APP_KEYS[id][c];
    if (!fn && id === 'chrome' && /^[1-9]$/.test(c)) fn = function () { chromeCtl('goTab', +c); };
    if (!fn) fn = OS_KEYS[c];
    if (!fn && /^[1-9]$/.test(c)) fn = function () { taskbarSlot(+c); };
    if (fn) { e.preventDefault(); e.stopPropagation(); fn(e); }
}, true);

/* ── the shortcut map (Alt+/) ── */
var CHEATS = [
    ['System', [['Alt+F', 'Find in app'], ['Alt+S', 'Start'], ['Alt+E', 'File Explorer'], ['Alt+I', 'Settings'], ['Alt+A', 'Quick settings'], ['Alt+N', 'Calendar'], ['Alt+V', 'Task view'], ['Alt+D', 'Show desktop'], ['Alt+1…9', 'Taskbar apps'], ['Alt+/', 'This card']]],
    ['Windows', [['Alt+W', 'Close window'], ['Alt+M', 'Minimize'], ['Alt+↑', 'Maximize'], ['Alt+↓', 'Restore / minimize'], ['Alt+`', 'Cycle windows'], ['Alt+Space', 'System menu']]],
    ['Full screen', [['F11', 'This window takes the screen'], ['Alt+Enter', 'The same thing, the game way'], ['Shift+F11', 'The whole page, real full screen'], ['Esc', 'Leave (if the app is not using it)'], ['Top edge', 'Peek at the title bar']]],
    ['Chrome', [['Alt+T', 'New tab'], ['Alt+W', 'Close tab'], ['Alt+Shift+T', 'Reopen closed tab'], ['Alt+1…9', 'Go to tab'], ['Alt+L', 'Address bar'], ['Alt+R', 'Reload'], ['Alt+←/→', 'Back / forward']]],
    ['In apps', [['Alt+←/↑', 'Explorer: back / home'], ['Enter', 'Explorer: open selected'], ['Alt+L', 'Terminal: clear'], ['←/→', 'Photos: browse'], ['F3', 'Find: next match'], ['Esc', 'Close find / this card']]]
];
function closeCheat() { var c = byId('cheatsheet'); if (c) c.remove(); }
function openCheat() {
    closeCheat(); setStart(false); closeFlyouts(); closeCtx(); closeBctx(); closeTaskView();
    var ov = document.createElement('div'); ov.className = 'cheat-overlay'; ov.id = 'cheatsheet';
    ov.innerHTML = '<div class="cheat px-lg lift"><div class="cheat-head">' + ic('ic-win') + '<b>Keyboard shortcuts</b>' +
        '<span class="cheat-sub">Alt is this machine’s Ctrl — the real one belongs to your browser</span></div>' +
        '<div class="cheat-grid">' + CHEATS.map(function (g) {
            return '<div class="cheat-col"><h3>' + g[0] + '</h3>' + g[1].map(function (k) {
                return '<div class="cheat-row"><kbd>' + esc(k[0]) + '</kbd><span>' + esc(k[1]) + '</span></div>';
            }).join('') + '</div>';
        }).join('') + '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeCheat(); });
}
function toggleCheat() { if (byId('cheatsheet')) closeCheat(); else openCheat(); }

/* ═══════════════════ global dismiss + init ═════════════════ */
document.addEventListener('click', function () { setStart(false); closeFlyouts(); closeCtx(); closeFctx(); closeBctx(); });
// middle-click closes tabs behind an open menu — don't leave it stale. Middle only: on macOS and
// Linux the contextmenu event fires on mousedown, and a right-click's own auxclick (on mouseup)
// was arriving a beat later and shooting the menu it had just opened
document.addEventListener('auxclick', function (e) { if (e.button === 1) closeBctx(); });
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (closeTopDlg()) return;   // dialogs eat the first Escape
    if (userFlyOpen()) { setUserFly(false); userBtn.focus(); return; }   // the flyout goes; Start stays
    // byId('taskView') is the right test — closeTaskView drops the id before
    // it schedules the fade, so a corpse no longer answers to it. Testing the
    // `.on` class instead would NOT work: it is added in a requestAnimationFrame,
    // so for one frame (and forever, headless, where rAF does not run) an open
    // task view would read as closed and Escape would leave full screen.
    var had = startMenu.classList.contains('open') || !quickPanel.hidden || !calPanel.hidden ||
              !ctx.hidden || !!bctxEl || (fctx && !fctx.hidden) ||
              !!byId('taskView');
    setStart(false); closeFlyouts(); closeCtx(); closeFctx(); closeBctx(); closeTaskView();
    // Last in the chain, and only if Escape had nothing else to close.
    // This used to lean on propagation — "a game that used Escape for its own
    // pause menu called stopPropagation and never got here". That was simply
    // not true: four apps in this tree consume Escape and not one of them
    // stops propagation, so closing a Chrome suggest list
    // also threw you out of full screen, two things from one keystroke.
    // defaultPrevented is a claim the app actually makes, so trust that.
    if (e.defaultPrevented) return;
    if (!had && fsWin && openWins[fsWin] && !openWins[fsWin].min) exitWinFs(fsWin);
});

applyAccent(recall('accent', ACCENTS[0].hex));
if (recall('crt', 'on') !== 'on') document.body.classList.add('no-crt');
// before renderDesktop below: with the bar hidden the icon grid gains a row,
// and barSpace() has to already be telling the truth when the grid is measured
if (recall('tbauto', 'off') === 'on') document.body.classList.add('tb-auto');
/* full screen: only show the affordances on a browser that will honour them.
   Hidden in the markup, revealed here — a dead button is worse than none. */
(function () {
    var b = byId('fsBtn');
    if (PFS.can()) {
        b.hidden = false;
        b.addEventListener('click', function (e) { e.stopPropagation(); togglePageFs(); });
        var ci = ctx.querySelector('[data-fs-item]'); if (ci) ci.hidden = false;
    }
    pageFsSync();   // a reload inside an already-full-screen page has to agree
})();
renderWall();
fsSanitize();   // files persisted by an older build that name an app this one does not ship
renderDesktop();
tick(); setInterval(tick, 15000);
// coming back from the blue screen: the file is fine. the file was always going to be fine.
try {
    var __bsodF = sessionStorage.getItem('comp_bsod');
    if (__bsodF) {
        sessionStorage.removeItem('comp_bsod');
        setTimeout(function () { toast('System restored to a moment before you deleted ' + __bsodF + '. You’re welcome.', 'ic-pc'); }, 1400);
    }
} catch (e) {}

// headless-screenshot hooks (like the room pages' ?dev): populate a state for a one-shot capture
if (location.search.indexOf('dev=tv') >= 0) { ['terminal', 'about', 'calc', 'explorer'].forEach(function (a) { openApp(a); }); setTimeout(openTaskView, 60); }
if (location.search.indexOf('dev=pics') >= 0) openApp('photos', 1);
if (location.search.indexOf('dev=maxi') >= 0) { openApp('explorer'); openWins.explorer.el.classList.add('maxi'); }
if (location.search.indexOf('dev=chrome') >= 0) openApp('chrome');
var devCr = location.search.match(/dev=cr:([^&]+)/);   // ?dev=cr:<url> — open Chrome navigated somewhere (cr:dino → chrome://dino)
if (devCr) { openApp('chrome'); var crU; try { crU = decodeURIComponent(devCr[1]); } catch (e) { crU = devCr[1]; } if (CR) crNav(crParse(/^[a-z]+$/.test(crU) ? 'chrome://' + crU : crU)); }
if (location.search.indexOf('dev=ninth') >= 0) openApp('ninth');      // NINTH NIGHT (+ &ndev=demo, window.__ninth handle)
if (location.search.indexOf('dev=drag') >= 0) {   // drive the real dnd engine with synthetic pointer events
    setTimeout(function () {
        function fakeDrag(fromTile, tx, ty, then) {
            var r = fromTile.getBoundingClientRect(), sx = r.left + 24, sy = r.top + 24;
            function pe(type, x, y, tgt) { (tgt || window).dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, pointerId: 1, pointerType: 'mouse' })); }
            pe('pointerdown', sx, sy, fromTile);
            for (var i = 1; i <= 12; i++) pe('pointermove', sx + (tx - sx) * i / 12, sy + (ty - sy) * i / 12);
            pe('pointerup', tx, ty);
            if (then) setTimeout(then, 60);
        }
        var icons = desktop.querySelectorAll('.dicon');
        fakeDrag(icons[3], 500, 640, function () {                 // URE BOY → an empty desktop cell
            var binTile = null;
            desktop.querySelectorAll('.dicon').forEach(function (d) { if (d.textContent.indexOf('Recycle Bin') >= 0) binTile = d; });
            var roomTile = null;
            desktop.querySelectorAll('.dicon').forEach(function (d) { if (d.textContent.indexOf('the room') >= 0) roomTile = d; });
            var br = binTile.getBoundingClientRect();
            fakeDrag(roomTile, br.left + 30, br.top + 30, function () { openApp('bin'); });   // the room → Recycle Bin
        });
    }, 150);
}
if (location.search.indexOf('dev=find') >= 0) {
    openApp('about'); openFind('about');
    find.q = 'rice'; findBar('about').querySelector('.find-in').value = 'rice'; runFind();
}
if (location.search.indexOf('dev=findnp') >= 0) {
    openApp('notepad');
    var devTa = openWins.notepad.el.querySelector('.np-text');
    devTa.value = 'the quick silver GTI ran the back roads.\nthe room is upstairs; the console is on the desk.\nchamomile, not caffeine — that is the rule.';
    openFind('notepad');
    find.q = 'the'; findBar('notepad').querySelector('.find-in').value = 'the'; runFind();
}
if (location.search.indexOf('dev=keys') >= 0) openCheat();
var devFs = location.search.match(/dev=fs:([^&]+)/);        // ?dev=fs:<path> — Explorer parked somewhere deep
if (devFs) { var fsK; try { fsK = decodeURIComponent(devFs[1]); } catch (e) { fsK = devFs[1]; } openApp('explorer', fsResolve(fsK) || fsK); }
var devOpen = location.search.match(/dev=open:([^&]+)/);    // ?dev=open:<folder>!<file> — open one file by name
if (devOpen) {
    var devOp; try { devOp = decodeURIComponent(devOpen[1]); } catch (e) { devOp = devOpen[1]; }
    var devPair = devOp.split('!'), devKey = fsResolve(devPair[0]) || devPair[0];
    itemsFor(devKey).forEach(function (it) { if (it.n.toLowerCase() === String(devPair[1] || '').toLowerCase()) openItemFrom(it); });
}
if (location.search.indexOf('dev=bsod') >= 0) { window.__noReboot = true; bsod('kernel32.dll'); }
if (location.search.indexOf('dev=player') >= 0) openApp('player', { n: 'ure boy theme.mp3' });
if (location.search.indexOf('dev=tabs') >= 0) {
    openApp('chrome');
    var devBr = openWins.chrome.el._br;
    devBr.newTab(); crNav(crParse('isaacure.com/1p'));   // tab 2: the room's page
    devBr.newTab(); devBr.goTab(2);
}

})();
