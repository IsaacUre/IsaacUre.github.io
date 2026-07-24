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
window.addEventListener('resize', function () { clearTimeout(rTimer); rTimer = setTimeout(function () { renderWall(); closeFctx(); renderDesktop(); }, 120); });

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
var PINNED = ['explorer', 'edge', 'terminal', 'steam', 'settings'];

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
    w = Math.min(w, vw - 16); h = Math.min(h, vh - BAR - 16);
    var n = Object.keys(openWins).length;
    var left = clamp(Math.round((vw - w) / 2) + (n % 5) * 26 - 52, 8, Math.max(8, vw - w - 8));
    var top = clamp(Math.round((vh - BAR - h) / 2) + (n % 5) * 22 - 40, 8, Math.max(8, vh - BAR - h - 8));
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
        else el.classList.toggle('maxi');
    });
    bar.addEventListener('dblclick', function (e) { if (!e.target.closest('.cap, .cr-tab, .cr-plusbtn')) el.classList.toggle('maxi'); });
    bar.addEventListener('pointerdown', function (e) {
        // Chrome's tabs and new-tab button live in its title bar; they must click, not drag the window
        // (Edge's .br-tab strip is set-dressing, so it stays draggable like the rest of the bar)
        if (e.button !== 0) return;                       // right-click is a menu now, never a drag
        if (e.target.closest('.cap, .cr-tab, .cr-plusbtn') || el.classList.contains('maxi')) return;
        closeBctx();                                      // a menu would ride along with the window
        var r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
        bar.setPointerCapture(e.pointerId);
        function mv(ev) {
            el.style.left = clamp(ev.clientX - ox, 8 - r.width + 90, window.innerWidth - 90) + 'px';
            el.style.top = clamp(ev.clientY - oy, 0, window.innerHeight - BAR - 36) + 'px';
        }
        function up() { bar.releasePointerCapture(e.pointerId); bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); }
        bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up);
    });
}
function focusWin(id) { var w = openWins[id]; if (!w) return; w.el.style.zIndex = ++zTop; activeApp = id; if (APPS[id].onFocus) APPS[id].onFocus(w.el); syncTaskbar(); }
// after the active window goes away, focus falls to the topmost remaining one
function refocusTop() {
    var ids = Object.keys(openWins).filter(function (id) { return !openWins[id].min; });
    if (!ids.length) { activeApp = null; return; }
    ids.sort(function (a, b) { return (+openWins[b].el.style.zIndex || 0) - (+openWins[a].el.style.zIndex || 0); });
    activeApp = ids[0];
}
function minWin(id) { var w = openWins[id]; if (!w) return; closeBctx(); if (APPS[id].onMinimize) APPS[id].onMinimize(w.el); w.min = true; w.el.classList.add('mini'); if (activeApp === id) refocusTop(); syncTaskbar(); }
function restoreWin(id) { var w = openWins[id]; if (!w) return; w.min = false; w.el.classList.remove('mini'); if (APPS[id].onRestore) APPS[id].onRestore(w.el); }
function closeWin(id) { var w = openWins[id]; if (!w) return; if (APPS[id].onClose) APPS[id].onClose(w.el); w.el.remove(); delete openWins[id]; if (activeApp === id) refocusTop(); if (find.appId === id) { find.appId = null; find.marks = []; find.idx = -1; } syncTaskbar(); }

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
        var maxi = w.el.classList.contains('maxi');
        var ww = maxi ? window.innerWidth : (w.el.offsetWidth || parseInt(w.el.style.width, 10) || a.w);
        var wh = maxi ? window.innerHeight - BAR : (w.el.offsetHeight || parseInt(w.el.style.height, 10) || a.h);
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
       'ph:N' (Photos index), 'when:chrome' / 'when:inst:<id>' (conditional) */
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
        { n: 'Steam', t: 'steam', app: 'steam' },
        { n: 'Minecraft Launcher', t: 'mclauncher', app: 'mclauncher' },
        { n: 'URE BOY', t: 'ureboy', app: 'ureboy' },
        { n: 'the room', t: 'room', app: 'room' },
        { n: 'Recycle Bin', t: 'bin', app: 'bin', sys: 1 }
    ], empty: 'A perfectly clean desktop. Suspicious.' },
    'Downloads': { items: [], empty: 'Nothing downloaded yet. Edge has one (1) idea.' },
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
    photos: 'ic-photos', globe: 'ic-globe', chrome: 'ic-chrome', ure: 'ic-ure', steam: 'ic-steam', bin: 'ic-bin',
    file: 'ic-file', txt: 'ic-txt', ini: 'ic-ini', log: 'ic-log', doc: 'ic-doc', xls: 'ic-xls', ppt: 'ic-ppt',
    pdf: 'ic-pdf', img: 'ic-img', audio: 'ic-audio', video: 'ic-video', exe: 'ic-exe', dll: 'ic-dll', sys: 'ic-sys',
    zip: 'ic-zip', code: 'ic-code', js: 'ic-js', html: 'ic-html', css: 'ic-css', font: 'ic-font', sav: 'ic-sav',
    drive: 'ic-drive', usb: 'ic-usb', disc: 'ic-disc', edge: 'ic-edge', terminal: 'ic-terminal', calc: 'ic-calc',
    cookie: 'ic-cookie', terraria: 'ic-terraria', explorer: 'ic-explorer', settings: 'ic-settings',
    mclauncher: 'ic-mc', mcjar: 'ic-mc'
};
var KIND = {
    folder: 'File folder', pc: 'Local disk', notepad: 'Text document', room: 'PNG image', gti: 'PNG image',
    photos: 'PNG image', ureboy: 'Shortcut', globe: 'Internet shortcut', chrome: 'Application', ure: 'Shortcut',
    steam: 'Shortcut', bin: 'Recycle Bin', file: 'File', txt: 'Text document', ini: 'Configuration settings',
    log: 'Text document', doc: 'Microsoft Word document', xls: 'Microsoft Excel worksheet', ppt: 'Microsoft PowerPoint presentation',
    pdf: 'PDF document', img: 'Image', audio: 'Audio', video: 'Video', exe: 'Application', dll: 'Application extension',
    sys: 'System file', zip: 'Compressed (zipped) folder', code: 'Source file', js: 'JavaScript file', html: 'HTML document',
    css: 'CSS document', font: 'TrueType font file', sav: 'Save file', drive: 'Local disk', usb: 'USB drive', disc: 'CD Drive',
    edge: 'Application', terminal: 'Application', calc: 'Application', cookie: 'Application', terraria: 'Application',
    explorer: 'Application', settings: 'Application',
    mclauncher: 'Application', mcjar: 'Executable Jar File'
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
    vdf: 'Valve data file', acf: 'Steam app manifest', reg: 'Registration entries', bat: 'Windows batch file', ps1: 'PowerShell script',
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
            $when: 'chrome',
            'Chrome': { 'Application': {
                'chrome.exe': '@chrome',
                '138.0.7204.97': { 'chrome.dll': ['218 MB'], 'icudtl.dat': 0, 'resources.pak': ['24 MB'], 'Locales': { 'en-US.pak': 0 } },
                'SetupMetrics': { 'setup.log': 0 }
            } }
        },
        'Microsoft': { 'Edge': { 'Application': { 'msedge.exe': '@edge', 'msedge.dll': ['196 MB'], '138.0.3351.65': { 'Locales': { 'en-US.pak': 0 } } } } },
        'Steam': {
            'steam.exe': '@steam', 'steamclient64.dll': 0, 'GameOverlayRenderer64.dll': 0,
            'steamapps': {
                'appmanifest_105600.acf': '"AppState"\n{\n\t"appid"\t\t"105600"\n\t"name"\t\t"Terraria"\n\t"StateFlags"\t\t"4"\n\t"installdir"\t\t"Terraria"\n\t"LastOwner"\t\t"isaac"\n}',
                'libraryfolders.vdf': '"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"C:\\\\Program Files\\\\Steam"\n\t\t"label"\t\t"the one drive that matters"\n\t}\n}',
                'common': {
                    'Terraria': { $when: 'inst:terraria', 'Terraria.exe': '@terraria', 'ReLogic.Native.dll': 0, 'Content': { 'Images': { $: { e: 'Every tree you have ever chopped, as .xnb files.' } }, 'Sounds': {} }, 'changelog.txt': 0 },
                    'Cookie Clicker': { $when: 'inst:cookie', 'Cookie Clicker.exe': '@cookie', 'resources': { 'app.asar': ['142 MB'] }, 'LICENSE.txt': 0 },
                    'URE QUEST': { $when: 'inst:urequest', 'urequest.exe': '@ureboy', 'quest.pak': 0, 'readme.txt': 'URE QUEST v4 — the party rebuild.\nIf the game asks you to install an intercooler mid-boss, that is not a bug. That is the plot.' },
                    'VEILFALL': { $when: 'inst:veilfall', 'veilfall.exe': '@arpg', 'Content': { 'spells.pak': 0, 'arena.pak': 0 }, 'story.txt': '[this file intentionally left blank]\n\n(the writer says it is coming. the writer says it will be short but sweet. the dummy waits.)' }
                },
                'workshop': {}
            },
            'config': { 'config.vdf': 0, 'loginusers.vdf': 0 },
            'logs': { 'content_log.txt': 0, 'connection_log.txt': 0 }
        },
        'URE Softworks': {
            'GTI RUN': { 'gtirun.exe': '@gti', 'tracks.dat': 0, 'readme.txt': 'GTI RUN.\nhold A to not die. the sleeping policeman is not sleeping.' },
            'PIT LANE': { 'pitlane.exe': '@ureboy', 'strategy.dat': 0 },
            'URE QUEST': { 'quest.exe': '@ureboy', 'party.dat': 0, 'balance.txt': 'nerf the cow? (no. never. the cow stays.)' }
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
        'Steam': {},
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
            'Google': { $when: 'chrome', 'Chrome': { 'User Data': { 'Default': { 'History': 0, 'Cookies': 0, 'Login Data': 0, 'Bookmarks': 0, 'Cache': { 'f_000001': 0, 'f_000002': 0 } } } } },
            'Steam': { 'htmlcache': { 'Cache': {} } },
            'URE Softworks': { 'URE QUEST': { 'save_v4.uqs': 0, 'screenshots': { 'heat soak fight.png': 0, 'the silver garage.png': 0 } } },
            'Packages': {}
        },
        'LocalLow': { $: { e: 'Nobody knows what LocalLow is for. It knows what it did.' } },
        'Roaming': {
            '.minecraft': '>.minecraft',   // the real, LIVE folder — the Minecraft Launcher owns it (mcSyncFS)
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
function fsWhen(flag) {
    if (flag === 'chrome') return function () { try { return !!JSON.parse(recall('chrome', 'null')); } catch (e) { return false; } };
    var m = /^inst:(\w+)$/.exec(flag);
    if (m) return function () { return typeof isInst === 'function' && isInst(m[1]); };
    return null;
}
function fsCompile(rootKey, label, node, crumb, meta) {
    meta = { d: (node.$ && node.$.d) || (meta && meta.d) || '6/5/2021', j: (node.$ && node.$.j) || (meta && meta.j) || 30 };
    var items = [];
    FS[rootKey] = { items: items, label: label, crumb: crumb, parent: crumb.length > 1 ? crumb[crumb.length - 2][1] : null, empty: node.$ && node.$.e };
    fsIndex(rootKey);
    Object.keys(node).forEach(function (name) {
        if (name.charAt(0) === '$') return;                              // $ and $when are meta, not files
        var v = node[name], path = rootKey + '/' + name, it;
        if (v && typeof v === 'object' && !Array.isArray(v)) {           // subfolder (or zip posing as one)
            var zip = /\.zip$/i.test(name);
            it = { n: name, t: zip ? 'zip' : 'folder', go: path };
            if (zip) it.size = fmtKb(EXT_KB.zip[0] + fsHash(path) % (EXT_KB.zip[1] - EXT_KB.zip[0]));
            if (v.$when) it.when = fsWhen(v.$when);
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
                else if (fl.indexOf('when:') === 0) it.when = fsWhen(fl.slice(5));
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
function itemsFor(path) {
    var st = fsLoad(), base = (FS[path] || FS.Home).items;
    return base.filter(function (it) { return (!it.when || it.when()) && st.gone.indexOf(path + '/' + it.n) < 0; }).concat(st.add[path] || []);
}
function fsHas(path, name) { return itemsFor(path).some(function (it) { return it.n === name; }); }
/* Tiles carry both their index and their name. when()-gated items (a Steam
   game finishing its install, Chrome arriving) can appear in itemsFor()
   between a draw and the next click, shifting every index under the
   rendered tiles — so the NAME is the source of truth and the index is
   only a fast path. Every handler that turns a tile back into an item
   goes through here. */
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
    // install BEFORE the redraw: it flips when:chrome, and installChrome refreshes too
    if (chromeOnDisk() && PINNED.indexOf('chrome') < 0) installChrome({ shortcut: false });   // a restored shortcut re-registers Chrome
    refreshFileViews();
}
function chromeOnDisk() {   // the install is real wherever the shortcut lives, not just on the Desktop
    var found = false;
    Object.keys(FS).forEach(function (p) {
        itemsFor(p).forEach(function (it) { if (it.app === 'chrome' && it.t === 'chrome') found = true; });
    });
    return found;
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
    veil.style.zIndex = ++zTop;
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
        rows: Math.max(1, Math.floor((window.innerHeight - BAR - DESK_PAD * 2) / DESK_CH))
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

/* —— Settings —— */
function renderSettings() {
    return '<div class="settings">' +
        '<nav class="set-nav">' +
          '<button class="set-navi sel" data-pane="personalization">' + ic('ic-ure') + ' Personalization</button>' +
          '<button class="set-navi" data-pane="system">' + ic('ic-pc') + ' System</button>' +
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
                '<div class="set-card"><label class="set-toggle"><span>Scanlines <i>a faint CRT overlay on the screen</i></span><button class="tgl' + (recall('crt', 'on') === 'on' ? ' on' : '') + '" data-tgl="crt" role="switch"></button></label></div>' +
                '<div class="set-card"><div class="set-row"><span>Wallpaper</span><button class="set-btn" data-act="rebloom">Regenerate Bloom</button></div><p class="set-hint">A fresh pixel Bloom, rendered on the spot.</p></div>';
        } else if (name === 'system') {
            var specs = [['Device name', 'URE-PC'], ['Processor', 'Bloom Core @ 60fps'], ['Installed RAM', '640 KB (ought to be enough)'], ['GPU', 'Canvas 2D, pixelated'], ['System type', 'pixel-bit operating system'], ['Pen and touch', 'thumbs supported']];
            body.innerHTML = '<h2 class="set-h2">System &gt; About</h2><div class="set-card"><dl class="specs">' + specs.map(function (s) { return '<dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd>'; }).join('') + '</dl></div>' +
                '<div class="set-card"><div class="set-row"><span>Windows specifications</span></div><dl class="specs"><dt>Edition</dt><dd>UreOS 11 Pixel Edition</dd><dt>Version</dt><dd>26H (the room)</dd><dt>Installed</dt><dd>the day you visited</dd></dl></div>';
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
        if (tgl) { var on = tgl.classList.toggle('on'); document.body.classList.toggle('no-crt', !on); store('crt', on ? 'on' : 'off'); return; }
        var act = e.target.closest('[data-act]');
        if (act) { var a = act.getAttribute('data-act'); if (a === 'rebloom') renderWall(); else if (a === 'about') openApp('about'); }
    });
    pane(arg === 'system' ? 'system' : 'personalization');
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

/* ═══════════════ possessed cursor (the "hand of god") ═══════════
   A fake pixel cursor that the machine can drive. In 'free' mode it
   mirrors the real (hidden) mouse 1:1; in 'grab' mode it springs
   toward a target with a pull that ramps up over time — so you can
   shove it off course (fight) or steer it in (help), but the target
   always wins in the end. Used to drag you to the address bar and
   click through the whole Chrome-install charade. ──────────────── */
var pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
document.addEventListener('mousemove', function (e) { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });

var cur = { el: null, x: 0, y: 0, vx: 0, vy: 0, mode: 'off', raf: 0, getRect: null, onArrive: null, dwell: 0, f: 0, cap: 260 };
function makeCursor() {
    var c = document.createElement('div'); c.className = 'fakecursor';
    c.innerHTML = '<svg viewBox="0 0 12 18" width="24" height="36" shape-rendering="crispEdges" aria-hidden="true">' +
        '<path d="M1 1 L1 12 L4 9 L6.2 14.4 L8 13.7 L5.8 8.4 L10 8.4 Z" fill="#f7f8fb" stroke="#0c0c10" stroke-width="1" stroke-linejoin="miter"/></svg>';
    document.body.appendChild(c); return c;
}
function positionCursor() { if (cur.el) cur.el.style.transform = 'translate(' + Math.round(cur.x) + 'px,' + Math.round(cur.y) + 'px)'; }
function freeFollow() { if (cur.mode === 'free') { cur.x = pointer.x; cur.y = pointer.y; positionCursor(); } }
function gagBegin() {
    if (cur.mode !== 'off') return;
    if (!cur.el) cur.el = makeCursor();
    document.body.classList.add('gagging');
    cur.x = pointer.x; cur.y = pointer.y; cur.vx = cur.vy = 0; cur.mode = 'free';
    positionCursor();
    window.addEventListener('mousemove', freeFollow, true);   // free mode tracks the mouse — no perpetual rAF
}
function gagEnd() {
    if (cur.mode === 'off') return;
    cur.mode = 'off'; cancelAnimationFrame(cur.raf); cur.raf = 0;
    window.removeEventListener('mousemove', freeFollow, true);
    cur.getRect = cur.onArrive = null;
    document.body.classList.remove('gagging');
    if (cur.el) { cur.el.remove(); cur.el = null; }
}
function possess(targetEl, onArrive) {
    if (cur.mode === 'off') return;
    cur.getRect = function () { return (targetEl && document.body.contains(targetEl)) ? targetEl.getBoundingClientRect() : null; };
    cur.onArrive = onArrive || null; cur.dwell = 0; cur.f = 0;   // frame-driven, clock-independent (cur.cap = 260)
    cur.mode = 'grab'; if (cur.el) cur.el.classList.add('grab');
    if (window.__fastCursor) { setTimeout(function () { if (cur.mode === 'grab') cursorArrive(); }, 60); return; }   // dev: skip animation, keep the chain
    cancelAnimationFrame(cur.raf); cur.raf = requestAnimationFrame(loopGrab);   // rAF only runs while possessing
}
function cursorArrive() {
    var cb = cur.onArrive;
    cancelAnimationFrame(cur.raf); cur.raf = 0;
    cur.mode = 'free'; cur.onArrive = null; cur.getRect = null;
    if (cur.el) cur.el.classList.remove('grab');
    clickPing(cur.x, cur.y);
    if (cb) cb();
}
function loopGrab() {
    if (cur.mode !== 'grab') return;
    var r = cur.getRect && cur.getRect();
    if (!r) { cursorArrive(); return; }
    cur.f++;
    var mx = pointer.x, my = pointer.y;
    var tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    var pull = reduce ? 1 : clamp(0.10 + cur.f * 0.013, 0.10, 1);   // fightable early (~1.3s), lands on target late
    var desx = mx + (tx - mx) * pull, desy = my + (ty - my) * pull;
    cur.vx = cur.vx * 0.7 + (desx - cur.x) * 0.3;
    cur.vy = cur.vy * 0.7 + (desy - cur.y) * 0.3;
    cur.x += cur.vx; cur.y += cur.vy;
    positionCursor();
    var d = Math.sqrt((tx - cur.x) * (tx - cur.x) + (ty - cur.y) * (ty - cur.y));
    cur.dwell = d < 9 ? cur.dwell + 1 : Math.max(0, cur.dwell - 2);
    if (cur.dwell > 4 || cur.f > cur.cap) { cursorArrive(); return; }
    cur.raf = requestAnimationFrame(loopGrab);
}
function clickPing(x, y) {
    var p = document.createElement('div'); p.className = 'click-ping';
    p.style.left = x + 'px'; p.style.top = y + 'px';
    document.body.appendChild(p);
    setTimeout(function () { if (p.parentNode) p.remove(); }, 520);
}
function toast(msg, icon) {
    var t = document.createElement('div'); t.className = 'toast px-lg lift';
    t.innerHTML = ic(icon || 'ic-chrome') + '<span>' + esc(msg) + '</span>';
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('on'); });
    setTimeout(function () { t.classList.remove('on'); setTimeout(function () { if (t.parentNode) t.remove(); }, 320); }, 3400);
}

/* ═════════════════ Browser: Edge (the gag) + Chrome ═════════════
   Edge's one purpose on a fresh machine is to help you install
   Chrome. Open it and the cursor gets quietly possessed — it drifts
   to the address bar, types "chrome install" out of your hands, and
   walks search → download until ChromeSetup.exe lands in the real
   Downloads folder. Then the machine lets go: the setup wizard is
   yours to click through. Replays on every Edge open (testing). ── */
function dlStamp() { var n = new Date(); return (n.getMonth() + 1) + '/' + n.getDate() + '/' + n.getFullYear() + ' ' + fmtTime(n); }
function chromeSetupItem() { return { n: uniqueName('Downloads', 'ChromeSetup.exe'), t: 'chrome', app: 'setup', size: '11.2 MB', date: dlStamp() }; }

// browser window-chrome below the title bar (the tab strip lives up there — see edgeTitlebar)
function browserShell(brand, placeholder, bodyHtml) {
    return '<div class="br ' + brand + '" data-brand="' + brand + '">' +
        '<div class="br-tool">' +
          '<span class="br-actions"><button class="br-act" tabindex="-1" aria-label="Back">‹</button><button class="br-act" tabindex="-1" aria-label="Forward">›</button><button class="br-act" tabindex="-1" aria-label="Reload">↻</button></span>' +
          '<label class="br-omni">' + ic('ic-search', 'br-omni-ic') +
            '<input class="br-url" spellcheck="false" autocomplete="off" aria-label="Address and search bar" value="" placeholder="' + esc(placeholder) + '">' +
            '<span class="br-fade">☆</span></label>' +
          '<button class="br-act br-more" tabindex="-1" aria-label="Settings and more">⋯</button>' +
        '</div>' +
        '<div class="br-stage"><div class="br-view">' + bodyHtml + '</div>' +
          '<div class="br-suggest" hidden></div>' +
          '<div class="dl-shelf" hidden></div>' +
        '</div></div>';
}

/* ═════════════ right-click menus (both browsers) ═════════════
   One open menu at a time, absolutely positioned inside the window it
   serves — Chrome-light by default, dark for Edge and Incognito.
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
function openBctx(host, e, items, fn, skin) {   // skin: true = dark (Edge/Incognito), or a class name ('steam')
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
   snapshotted at open time — focusing the menu (or Edge's possessed
   focus handler wiping the bar) must not change what Cut/Copy grab. */
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

/* —— Edge —— */
function edgeWelcome() {
    return '<div class="ewc">' +
        '<div class="ewc-hero">' + ic('ic-edge', 'ewc-logo') +
          '<h2>Welcome to Microsoft Edge</h2>' +
          '<p>The last browser you’ll ever need.<sup>*</sup> Fast, secure, and already set as your default.</p>' +
        '</div>' +
        '<div class="ewc-cards">' +
          '<div class="ewc-card"><b>Import favorites</b><span>Bring your stuff over from that other browser.</span></div>' +
          '<div class="ewc-card"><b>Set as default</b><span class="ewc-done">✓ Already done for you.</span></div>' +
          '<div class="ewc-card"><b>Get started</b><span>Just start browsing. Try the address bar ↑</span></div>' +
        '</div>' +
        '<p class="ewc-fine"><sup>*</sup>Results not guaranteed.</p></div>';
}
// Edge's tab strip IS the window title bar, same as Chrome's (see crTitlebar) — one decorative
// tab beside the caps, with a draggable spacer filling the rest of the row
function edgeTitlebar() {
    return '<div class="br-tabs">' +
        '<div class="br-tab active">' + ic('ic-edge', 'br-fav') + '<span>Welcome to Microsoft Edge</span><i class="br-tabx" aria-hidden="true">×</i></div>' +
        '<button class="br-newtab" tabindex="-1" aria-label="New tab">+</button>' +
        '<div class="br-tabspace"></div>' +
    '</div>';
}
function renderEdge() {
    return browserShell('edge', 'Search or enter web address', edgeWelcome());
}
/* Edge's right-click menu: the full corporate spread, in character.
   The one real action is closing the only tab (which closes the
   window, like a real browser) — everything else answers honestly
   about what this browser is for. */
function edgeCtxMenu(el, e) {
    e.preventDefault();
    if (e.target.closest('.win-caps')) { closeBctx(); return; }
    var br = el.querySelector('.br'), urlbar = el.querySelector('.br-url');
    var inp = e.target.closest('input');
    if (inp && !inp.readOnly && !inp.disabled) { bctxInput(br, e, inp, null, true); return; }
    if (e.target.closest('.br-tabs')) {
        openBctx(br, e, [
            { k: 'nt', t: 'New tab to the right' },
            { k: 'dp', t: 'Duplicate tab' },
            'sep',
            { k: 'cl', t: 'Close tab' }
        ], function (a) {
            if (a === 'cl') closeWin('edge');   // the only tab IS the window
            else if (a === 'nt') toast('Edge considered a second tab. One is already more than it needs.');
            else toast('Tab not duplicated. Nobody needs to be welcomed twice.');
        }, true);
        return;
    }
    openBctx(br, e, [
        { k: 'back', t: 'Back', dis: true },
        { k: 'fwd', t: 'Forward', dis: true },
        { k: 'rfr', t: 'Refresh' },
        'sep',
        { k: 'sav', t: 'Save as…' },
        { k: 'prt', t: 'Print…' },
        { k: 'cst', t: 'Cast media to device' },
        'sep',
        { k: 'col', t: 'Add page to Collections' },
        { k: 'shr', t: 'Share' },
        { k: 'cap', t: 'Web capture' },
        'sep',
        { k: 'src', t: 'View page source' },
        { k: 'ins', t: 'Inspect' }
    ], function (a) {
        if (a === 'rfr') toast('Refreshed. Everything is exactly as Edge left it.');
        else if (a === 'sav') {
            var base = (urlbar.value || 'Welcome to Microsoft Edge').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 48);
            var f = fsAddFile('Downloads', { n: uniqueName('Downloads', base + '.html'), t: 'globe', size: '9 KB', date: dlStamp() });
            toast('Saved “' + f.n + '” to Downloads. A keepsake.');
        }
        else if (a === 'prt') toast('Sent to the printer. The printer was also hoping for Chrome.');
        else if (a === 'cst') toast('Searched for devices. Even the smart fridge said it was busy.');
        else if (a === 'col') toast('Added to Collections. The collection is this page, forty times.');
        else if (a === 'shr') toast('Share sheet opened and closed on its own. It’s for the best.');
        else if (a === 'cap') toast('Captured. It’s a screenshot of the inevitable.');
        else if (a === 'src') toast('view-source is a Chrome feature. You know what to do.');
        else if (a === 'ins') toast('Inspection complete: this browser exists to download another browser.');
    }, true);
}
function initEdge(el) {
    var view = el.querySelector('.br-view'), url = el.querySelector('.br-url');
    var omni = el.querySelector('.br-omni'), suggest = el.querySelector('.br-suggest'), shelf = el.querySelector('.dl-shelf');

    if (!el._ectx) {   // the window element survives restore re-renders; bind its listeners once
        el._ectx = 1;
        el.addEventListener('contextmenu', function (e) { edgeCtxMenu(el, e); });
        el.addEventListener('scroll', closeBctx, true);   // real menus don't scroll along with the page
    }
    var TYPE = 'chrome install';
    var alive = true, hijack = false, ti = 0;
    var timers = [], intervals = [], idleTimer = 0;
    var step = { addr: 0, godl: 0, dl: 0, run: 0 };

    function after(ms, fn) { var t = setTimeout(function () { if (alive) fn(); }, reduce ? Math.min(ms, 140) : ms); timers.push(t); return t; }
    function every(ms, fn) { var iv = setInterval(fn, ms); intervals.push(iv); return iv; }

    var gag = { cancel: function () {
        if (!alive) return; alive = false; hijack = false;
        gag.dead = true;                                     // observable from outside the closure
        timers.forEach(clearTimeout); intervals.forEach(clearInterval); clearTimeout(idleTimer);
        document.removeEventListener('keydown', onKey, true);
        closeSuggest(); omni.classList.remove('focus'); url.blur();   // don't strand the dropdown/focus ring
        if (step.dl && shelf.querySelector('.dls-bar')) {    // download was mid-flight: land the file
            var f = fsAddFile('Downloads', chromeSetupItem());
            shelf.innerHTML = shelfDoneHTML(f.n);
        }
        gagEnd();
        // note: the setup wizard is a free-standing app now — it owes the gag nothing
    } };
    APPS.edge._gag = gag;

    // headless screenshot hook: ?dev=edge&at=<phase> jumps straight to a phase (static, no timeline)
    var devAt = (location.search.match(/[?&]at=([a-z]+)/) || [])[1];
    if (devAt) { devJump(devAt); return; }

    gagBegin();
    after(reduce ? 60 : 850, function () { possess(url, addrClicked); });

    /* helping: if the user clicks/focuses the bar or the page links themselves */
    url.addEventListener('focus', addrClicked);
    omni.addEventListener('mousedown', function () { after(0, addrClicked); });
    view.addEventListener('click', function (e) {
        if (e.target.closest('.res-hit')) gotoDownload();
        else if (e.target.closest('.dlp-btn')) startDownload();
    });
    shelf.addEventListener('click', function (e) {
        // unguarded: the button must work even after the gag is cancelled (runInstaller is the possess path)
        if (e.target.closest('.dls-open')) { gag.done = true; gag.cancel(); openApp('setup'); }
        else if (e.target.closest('.dls-show')) { gag.done = true; gag.cancel(); openApp('explorer', 'Downloads'); }
    });

    function addrClicked() {
        if (!alive || step.addr) return; step.addr = 1;
        omni.classList.add('focus'); url.value = ''; url.focus();
        openSuggest(''); hijack = true;
        document.addEventListener('keydown', onKey, true);
        armIdle();
    }
    function armIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(startAuto, reduce ? 200 : 1200); }
    function startAuto() {
        if (!alive || !hijack) return;
        var iv = every(reduce ? 45 : (100 + Math.floor(Math.random() * 80)), function () {
            if (!alive || !hijack) { clearInterval(iv); return; }
            if (typeStep()) clearInterval(iv);
        });
    }
    function onKey(e) {
        if (!hijack) return;
        // keys aimed at another app's text field (terminal, notepad, a game) are not ours to steal
        if (e.target !== url && (/^(INPUT|TEXTAREA)$/.test(e.target.tagName || '') || e.target.isContentEditable)) return;
        if (e.key === 'Escape') { gag.done = true; gag.cancel(); return; }   // a deliberate bail-out sticks
        e.preventDefault(); e.stopPropagation();
        intervals.forEach(clearInterval);                    // user grabbed the wheel
        if (!typeStep()) armIdle();
    }
    function typeStep() {
        if (ti < TYPE.length) { url.value += TYPE.charAt(ti++); openSuggest(url.value); return false; }
        hijack = false; document.removeEventListener('keydown', onKey, true);
        clearTimeout(idleTimer); intervals.forEach(clearInterval);
        submit(); return true;
    }
    function submit() {
        omni.classList.remove('focus'); closeSuggest(); url.blur();
        url.value = 'bing.com/search?q=chrome+install';
        view.innerHTML = resultsHTML();
        after(reduce ? 140 : 1150, function () {
            possess(view.querySelector('.res-hit') || view, gotoDownload);
        });
    }
    function gotoDownload() {
        if (!alive || step.godl) return; step.godl = 1;
        closeSuggest(); url.value = 'https://www.google.com/chrome/';
        view.innerHTML = downloadHTML();
        after(reduce ? 140 : 780, function () {
            possess(view.querySelector('.dlp-btn') || view, startDownload);
        });
    }
    function startDownload() {
        if (!alive || step.dl) return; step.dl = 1;
        var btn = view.querySelector('.dlp-btn'); if (btn) btn.classList.add('press');
        shelf.hidden = false; shelf.innerHTML = shelfHTML();
        var bar = shelf.querySelector('.dls-bar span'), pct = shelf.querySelector('.dls-pct'), n = 0;
        var iv = every(reduce ? 60 : 120, function () {
            if (!alive) { clearInterval(iv); return; }
            n = Math.min(100, n + (reduce ? 45 : 5 + Math.random() * 9));
            bar.style.width = n + '%'; pct.textContent = Math.round(n) + '%';
            if (n >= 100) {
                clearInterval(iv);
                var f = fsAddFile('Downloads', chromeSetupItem());   // a real file in the real Downloads folder
                shelf.innerHTML = shelfDoneHTML(f.n);
                after(reduce ? 120 : 520, function () { possess(shelf.querySelector('.dls-open') || shelf, runInstaller); });
            }
        });
    }
    function runInstaller() {
        if (!alive || step.run) return; step.run = 1;
        gag.done = true;                                 // a natural finish shouldn't replay on restore
        gag.cancel();                                    // the machine got you the file; the install is yours
        openApp('setup');
        toast('The machine got you this far. The install is yours.');
    }

    /* address-bar autocomplete drop-down */
    function openSuggest(q) {
        suggest.hidden = false;
        var rows = [
            [q || 'chrome install', 'ic-search'],
            ['chrome download — free', 'ic-search'],
            ['google chrome for windows 11', 'ic-search'],
            ['is chrome better than edge (it is)', 'ic-search'],
            ['google.com/chrome', 'ic-globe']
        ];
        suggest.innerHTML = rows.map(function (r, i) {
            return '<div class="sg' + (i === 0 ? ' sel' : '') + '">' + ic(r[1], 'sg-ic') + '<span>' + esc(r[0]) + '</span></div>';
        }).join('');
    }
    function closeSuggest() { suggest.hidden = true; suggest.innerHTML = ''; }

    function resultsHTML() {
        return '<div class="serp">' +
            '<div class="serp-top"><span class="serp-logo">bing</span>' +
              '<label class="serp-box"><input value="chrome install" readonly aria-label="Search">' + ic('ic-search') + '</label></div>' +
            '<p class="serp-stat">About 4,120,000,000 results · we get it, everybody does this</p>' +
            '<a class="res-hit"><span class="res-url">https://www.google.com › chrome</span>' +
              '<span class="res-title">Download and install Google Chrome</span>' +
              '<span class="res-desc">Get the fast, free web browser everyone on this machine was going to install anyway. Now on UreOS 11.</span></a>' +
            '<div class="res"><span class="res-url">https://en.wikipedia.org › wiki › Google_Chrome</span>' +
              '<span class="res-title2">Google Chrome - Wikipedia</span>' +
              '<span class="res-desc">Cross-platform web browser developed by Google, first released in 2008…</span></div>' +
            '<div class="res res-sad"><span class="res-url">https://microsoft.com › edge › please</span>' +
              '<span class="res-title2">Microsoft Edge — wait, are you sure? You can stay.</span>' +
              '<span class="res-desc">We’ve changed. We have coupons now. Please don’t do this.</span></div></div>';
    }
    function downloadHTML() {
        return '<div class="dlp">' + ic('ic-chrome', 'dlp-chrome') +
            '<h2 class="dlp-h">The browser built to be yours</h2>' +
            '<p class="dlp-sub">Fast. Secure. Yours. And, crucially, not Edge.</p>' +
            '<button class="dlp-btn" type="button">Download Chrome</button>' +
            '<p class="dlp-fine">For Windows 11 · UreOS Pixel Edition · 64-bit</p></div>';
    }
    function shelfHTML() {
        return '<div class="dls">' + ic('ic-chrome', 'dls-ic') +
            '<div class="dls-meta"><b>ChromeSetup.exe</b><div class="dls-bar"><span style="width:0%"></span></div></div>' +
            '<span class="dls-pct">0%</span></div>';
    }
    function shelfDoneHTML(name) {
        return '<div class="dls">' + ic('ic-chrome', 'dls-ic') +
            '<div class="dls-meta"><b>' + esc(name || 'ChromeSetup.exe') + '</b><span class="dls-sub">Download complete · saved to Downloads</span></div>' +
            '<button class="dls-show" type="button">Show in folder</button>' +
            '<button class="dls-open" type="button">Open file</button></div>';
    }
    function devJump(p) {
        if (p === 'type') { gagBegin(); omni.classList.add('focus'); url.value = TYPE; openSuggest(TYPE); }
        else if (p === 'results') { url.value = 'bing.com/search?q=chrome+install'; view.innerHTML = resultsHTML(); }
        else if (p === 'download') { url.value = 'https://www.google.com/chrome/'; view.innerHTML = downloadHTML(); }
        else if (p === 'shelf') { url.value = 'https://www.google.com/chrome/'; view.innerHTML = downloadHTML(); var f = fsAddFile('Downloads', chromeSetupItem()); shelf.hidden = false; shelf.innerHTML = shelfDoneHTML(f.n); }
        else if (p === 'setup') { setTimeout(function () { openApp('setup'); }, 0); }   // defer so it lands on top of Edge
        else if (p === 'done') { installChrome({ shortcut: true }); setTimeout(function () { openApp('chrome'); closeWin('edge'); toast('Google Chrome installed — welcome home.'); }, 0); }
    }
}

/* ═══════════════ Chrome (the browser that actually works) ═══════════════
   A real little browser: multiple tabs with per-tab history, a working
   omnibox with suggestions, bookmarks (star + bar), the ⋯ menu, incognito
   that genuinely doesn't record history, chrome:// pages (settings/
   history/bookmarks/downloads/dino), and a small fake web for it all to
   browse. Classic LIGHT Chrome, in hard pixels — Edge keeps the dark
   shell; this is the one that feels like home. State: comp_chrome_*.
   ───────────────────────────────────────────────────────────────────── */
var CR = null;                                   // live window state (single-instance, like ST)
function crj(k, d) { try { var v = JSON.parse(recall('chrome_' + k, 'null')); return v == null ? d : v; } catch (e) { return d; } }
function crjSet(k, v) { store('chrome_' + k, JSON.stringify(v)); }
function crBM() { return crj('bm', [['isaacure.com', 'isaacure.com'], ['GitHub', 'github.com/IsaacUre'], ['Golf GTI — Wikipedia', 'en.wikipedia.org/wiki/Volkswagen_Golf_GTI'], ['The Thresher', 'thresher.rice.edu'], ['Rice FSAE', 'fsae.rice.edu'], ['Steam', 'store.steampowered.com'], ['dino', 'chrome://dino'], ['Minecraft', 'minecraft.net']]); }
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
        var ql = q.toLowerCase();
        var corpus = Object.keys(WEB).map(function (k) { return WEB[k]; }).filter(function (s) { return s.searchable; });
        var hits = corpus.filter(function (s) { return (s.stitle + ' ' + s.sdesc + ' ' + (s.skey || '')).toLowerCase().indexOf(ql) >= 0; });
        if (!hits.length) hits = corpus.filter(function (s) { return ql.split(/\s+/).some(function (w) { return w.length > 2 && (s.stitle + ' ' + (s.skey || '')).toLowerCase().indexOf(w) >= 0; }); });
        var snippet = '';
        if (/dino|dinosaur|t-?rex/.test(ql)) snippet = '<div class="cr-snip"><b>chrome://dino</b><p>You appear to be looking for the dinosaur. He is employed here.</p>' + crLink('chrome://dino', 'Play the dino game', 'cr-snipl') + '</div>';
        var localRows = hits.slice(0, 4).map(function (s) {
            return '<div class="cr-res">' + crLink(s.host, '<span class="cr-resurl">' + crFav(s.fav) + ' https://' + esc(s.host) + '</span><span class="cr-restitle">' + esc(s.stitle) + '</span>', '') +
                '<span class="cr-resdesc">' + esc(s.sdesc) + '</span></div>';
        }).join('');
        var local = localRows ? '<div class="cr-serpsec"><h4 class="cr-serph">From isaacure.com</h4>' + localRows + '</div>' : '';
        var load = function (id, label) { return '<div class="cr-serpsec" id="' + id + '"><h4 class="cr-serph">' + label + '</h4><div class="cr-serploading"><span class="cr-lvspin"></span> searching…</div></div>'; };
        var rel = ['game boy', 'volkswagen golf gti', 'rice university', 'factorio', 'hades speedrun'].map(function (r) { return crLink('google.com/search?q=' + encodeURIComponent(r), '🔍 ' + esc(r), 'cr-rel'); }).join('');
        return '<div class="cr-serp">' +
            '<div class="cr-serphead">' + (crEngine() === 'Google' ? '<span class="cr-serplogo"><b style="color:#4285f4">G</b><b style="color:#ea4335">o</b><b style="color:#fbbc05">o</b><b style="color:#4285f4">g</b><b style="color:#34a853">l</b><b style="color:#ea4335">e</b></span>' : '<span class="cr-serplogo"><b style="color:#d81e05">URE</b></span>') +
              '<label class="cr-serpbox">' + ic('ic-search') + '<input class="cr-serpq" value="' + esc(q) + '" spellcheck="false" autocomplete="off"></label>' + liveChip() + '</div>' +
            '<div class="cr-serptabs"><span class="on">All</span><span>Images</span><span>Videos</span><span>News</span><span>Maps</span></div>' +
            '<p class="cr-serpstat" id="crSerpStat">Searching the real web for “' + esc(q) + '”…</p>' +
            snippet + local +
            '<div class="cr-serpsec cr-serpfeatslot" id="crSerpFeat"></div>' +
            load('crSerpWiki', 'Wikipedia') + load('crSerpGH', 'Code · GitHub') + load('crSerpHN', 'Discussion · Hacker News') +
            '<div class="cr-relwrap"><b>Related searches</b><div class="cr-rels">' + rel + '</div></div></div>';
    },
    init: function (view) {
        var q = view.querySelector('.cr-serpq');
        var query = q ? q.value : crQOf(crTab().url);
        if (q) q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && q.value.trim()) crNav('google.com/search?q=' + encodeURIComponent(q.value.trim())); });
        view.querySelectorAll('.cr-serptabs span').forEach(function (t) {
            t.addEventListener('click', function () { if (!t.classList.contains('on')) toast(t.textContent + ' results: also pixels, but sideways.'); });
        });
        if (!query || !query.trim()) { var st0 = view.querySelector('#crSerpStat'); if (st0) st0.textContent = 'Type something to search the real web.'; return; }
        function fill(id, html) { if (!view.isConnected) return; var el = view.querySelector('#' + id); if (el) el.innerHTML = html; }
        serpWiki(query, true, function (secHtml, total) {
            if (!view.isConnected) return;
            var feat = view.querySelector('#crSerpFeat'), wiki = view.querySelector('#crSerpWiki');
            var cut = secHtml.indexOf('<h4');                         // the featured card precedes the first <h4
            if (feat && cut > 0) { feat.innerHTML = secHtml.slice(0, cut); wiki.innerHTML = secHtml.slice(cut); }
            else if (wiki) wiki.innerHTML = secHtml;
            var st = view.querySelector('#crSerpStat');
            if (st) st.textContent = total ? 'About ' + nnum(total).toLocaleString() + ' Wikipedia results — plus live GitHub and Hacker News' : 'Real results for “' + query + '”';
        });
        serpGH(query, function (h) { fill('crSerpGH', h); });
        serpHN(query, function (h) { fill('crSerpHN', h); });
    }
});

/* — isaacure.com — */
webPage('isaacure.com', {
    title: 'Isaac Ure', fav: { ic: 'ic-ure' }, searchable: true,
    stitle: 'Isaac Ure — isaacure.com', sdesc: 'Rising sophomore at Rice. A Game Boy, three rooms, and a pixel Windows 11 desktop. You are somewhere inside it right now.', skey: 'isaac ure boy room computer personal site',
    render: function () {
        return '<div class="cr-site cr-iu"><div class="cr-iuhero">' + ic('ic-ure', 'cr-iulogo') + '<h2>isaacure.com</h2><p>a website that keeps turning into operating systems</p></div>' +
            '<div class="cr-iugrid">' +
              crLink('isaacure.com/ureboy', crFav({ ic: 'ic-ureboy' }, 'big') + '<b>URE BOY</b><span>the console</span>', 'cr-iucard') +
              crLink('isaacure.com/1p', crFav({ ic: 'ic-room' }, 'big') + '<b>the room</b><span>first person</span>', 'cr-iucard') +
              crLink('isaacure.com/comp', crFav({ ic: 'ic-pc' }, 'big') + '<b>the computer</b><span>you are here</span>', 'cr-iucard') +
            '</div><p class="cr-iufoot">© Isaac Ure · Houston · built by hand, no frameworks, some vibes</p></div>';
    }
});
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

/* — Rice FSAE — */
webPage('fsae.rice.edu', {
    title: 'Rice Formula SAE', fav: { ch: 'F', c: '#d81e05' }, searchable: true,
    stitle: 'Rice FSAE — Formula SAE at Rice University', sdesc: 'Rice’s first Formula SAE team. Design, build, race. Financing led by a sophomore with a spreadsheet and no fear.', skey: 'fsae formula racing rice team car budget',
    render: function () {
        return '<div class="cr-site cr-fsae"><div class="cr-fsaehero">' + ic('ic-gti', 'cr-fsaecar') + '<h2>RICE FORMULA SAE</h2><p>Design. Build. Race. Justify the invoices.</p></div>' +
            '<div class="cr-fsaerow"><div class="cr-fsaecard"><b>The car</b><span>In design. Currently exists as consensus and CAD.</span></div>' +
            '<div class="cr-fsaecard"><b>The budget</b><span>Balanced, audited, feared. Financing: I. Ure ’29.</span></div>' +
            '<div class="cr-fsaecard"><b>Join</b><span>Engineers welcome. Economists tolerated (one is load-bearing).</span></div></div></div>';
    }
});

/* — Steam (the website → the app) — */
webPage('store.steampowered.com', {
    title: 'Welcome to Steam', fav: { ic: 'ic-steam' }, searchable: true,
    stitle: 'Steam — the game store', sdesc: 'Why browse the website? This machine has the client installed. It has your library, your points, and your friends.', skey: 'steam games store valve',
    render: function () {
        return '<div class="cr-site cr-center">' + ic('ic-steam', 'cr-bigic') + '<h2>You have Steam installed.</h2><p>The website is just the app with more cookies. Opening the real thing:</p><button class="cr-btn" id="crSteam">Open the Steam app</button></div>';
    },
    init: function (view) { var b = view.querySelector('#crSteam'); if (b) b.addEventListener('click', function () { openApp('steam'); }); }
});

/* — minecraft.net (the website → the launcher) — */
webPage('minecraft.net', {
    title: 'Minecraft | Official Site', fav: { ic: 'ic-mc' }, searchable: true,
    stitle: 'Minecraft — official site', sdesc: 'Explore your own unique world, survive the night, and create anything you can imagine. The launcher is already on this machine.', skey: 'minecraft mc java mojang launcher grass creeper blocks',
    render: function () {
        return '<div class="cr-site cr-mcnet"><nav class="cr-mcnav"><b>MINECRAFT</b><span>Games</span><span>Community</span><span>Merch</span><span>Support</span></nav>' +
            '<div class="cr-mchero">' + mcHero() + '<div class="cr-mchero-tx"><span class="mcl-logotype sm">MINECRAFT</span>' +
            '<p>Dig. Build. Survive the night. This machine already has the launcher — the button below knows that.</p>' +
            '<button class="cr-btn cr-mcget" id="crMcGet">GET MINECRAFT</button></div></div>' +
            '<div class="cr-mcfoot">© Mojang, in spirit. This is a loving pixel parody living on isaacure.com.</div></div>';
    },
    init: function (view) {
        var b = view.querySelector('#crMcGet');
        if (b) b.addEventListener('click', function () { openApp('mclauncher'); toast('Minecraft Launcher is already installed.'); });
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
                '<label class="cr-setrow"><span>Microsoft Edge</span><button class="cr-chip" data-cract="edge">Console it</button></label></div>' +
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
            else if (a === 'edge') toast('Edge has been consoled. It says it understands.');
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
        }).join('') : '<p class="cr-empty">Nothing downloaded. The Edge gag usually leaves a ChromeSetup.exe here — that’s how you got me.</p>';
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
var LIVE_CACHE = {};                                      // url → { t, v } · session-only, 5 min TTL
var LIVE_TITLES = {};                                     // url → real page title, learned after load
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
            if (LIVE_DROP[tag]) continue;
            if (tag === 'A') {
                var to = linkFn ? linkFn(n.getAttribute('href') || '') : null;
                if (!to) { walk(n, dst, depth + 1); continue; }        // unroutable link: keep its text
                var a = document.createElement('a');
                a.className = 'cr-l cr-lva';
                a.setAttribute('data-href', to);
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
            if (Object.keys(LIVE_TITLES).length > 80) LIVE_TITLES = {};   // check BEFORE the set, or the 81st write is wiped with the rest
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
function serpSection(slot, label, err, rowsHtml, emptyMsg) {
    if (err === 'rate') return '<h4 class="cr-serph">' + esc(label) + '</h4><p class="cr-serpnote">' + esc(label) + ' allows 10 anonymous searches a minute — it just hit the limit. Try again shortly.</p>';
    if (err) return '<h4 class="cr-serph">' + esc(label) + '</h4><p class="cr-serpnote">Couldn’t reach ' + esc(label) + ' (' + esc(String(err)) + ').</p>';
    if (!rowsHtml) return '<h4 class="cr-serph">' + esc(label) + '</h4><p class="cr-serpnote">' + esc(emptyMsg || ('No ' + label + ' results.')) + '</p>';
    return '<h4 class="cr-serph">' + esc(label) + '</h4>' + rowsHtml;
}
/* the three real sources. each takes the query + a done(html) it calls once,
   and is entirely self-contained so one source failing never blocks another. */
function serpWiki(q, feat, done) {
    liveGet('https://en.wikipedia.org/w/api.php?format=json&origin=*&action=query&list=search&srlimit=6&srinfo=totalhits&srprop=snippet&srsearch=' + encodeURIComponent(q), function (err, j, r) {
        if (err || !j || !j.query || !j.query.search) { done(serpSection(0, 'Wikipedia', err || 'empty'), null); return; }
        var hits = j.query.search, total = j.query.searchinfo && j.query.searchinfo.totalhits;
        if (!hits.length) { done(serpSection(0, 'Wikipedia', null, null), total); return; }
        var top = hits[0], rest = hits.slice(1, 5);
        var featHtml = '';
        if (feat) {
            var turl = 'en.wikipedia.org/wiki/' + top.title.replace(/ /g, '_');
            featHtml = '<div class="cr-serpfeat">' + crLink(turl, '<span class="cr-featt">' + esc(top.title) + '</span>', 'cr-featlink') +
                '<span class="cr-featsrc">Wikipedia</span><p class="cr-featsnip">' + snipHighlight(top.snippet, q) + '…</p>' +
                crLink(turl, 'Read the full article →', 'cr-featmore') + '</div>';
        }
        var list = feat ? rest : hits.slice(0, 5);
        var rows = list.map(function (h) {
            var u = 'en.wikipedia.org/wiki/' + h.title.replace(/ /g, '_');
            return serpRow(u, 'en.wikipedia.org › wiki › ' + esc(h.title), { ch: 'W', c: '#202122' }, h.title, snipHighlight(h.snippet, q) + '…');
        }).join('');
        done(featHtml + serpSection(0, 'More from Wikipedia', null, rows), total);
    });
}
function serpGH(q, done) {
    liveGet('https://api.github.com/search/repositories?per_page=4&sort=stars&q=' + encodeURIComponent(q), function (err, j, r) {
        if (err) { done(serpSection(0, 'GitHub', err === 'http403' ? 'rate' : err)); return; }
        if (!j || !j.items || !j.items.length) { done(serpSection(0, 'GitHub', null, null, 'No repositories match.')); return; }
        var rows = j.items.slice(0, 4).map(function (rp) {
            var meta = '★ ' + nnum(rp.stargazers_count).toLocaleString() + (rp.language ? ' · ' + esc(rp.language) : '');
            return serpRow('github.com/' + rp.full_name, 'github.com › ' + esc(rp.full_name), { ch: 'G', c: '#24292f' }, rp.full_name,
                (rp.description ? esc(rp.description) + ' ' : '') + '<span class="cr-serpmeta">' + meta + '</span>');
        }).join('');
        done(serpSection(0, 'Code · GitHub', null, rows));
    });
}
function serpHN(q, done) {
    liveGet('https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=5&query=' + encodeURIComponent(q), function (err, j, r) {
        if (err || !j || !j.hits) { done(serpSection(0, 'Hacker News', err || 'empty')); return; }
        var hits = j.hits.filter(function (h) { return h.title; });
        if (!hits.length) { done(serpSection(0, 'Hacker News', null, null, 'No discussions found.')); return; }
        var rows = hits.slice(0, 4).map(function (h) {
            var item = 'news.ycombinator.com/item?id=' + h.objectID;
            return serpRow(item, 'news.ycombinator.com › item', { ch: 'Y', c: '#ff6600' }, h.title,
                '<span class="cr-serpmeta">' + nnum(h.points) + ' points · ' + nnum(h.num_comments) + ' comments · ' + esc(h.author || '?') + '</span>');
        }).join('');
        done(serpSection(0, 'Discussion · Hacker News', null, rows));
    });
}
/* one result row, Google-shaped: url line, blue title, snippet */
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
                crNav('open-meteo.com/forecast?q=' + encodeURIComponent(g.name + (g.admin1 ? ', ' + g.admin1 : '') + '@' + g.latitude + ',' + g.longitude));
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
    var lc = u.toLowerCase();
    if (WEB_LC[lc]) return WEB_LC[lc];
    if (lc.indexOf('google.com/search') === 0) return 'google.com/search';
    var host = lc.split(/[/?#]/)[0].split(':')[0];       // host only: drop /path, ?query, #frag, and :port
    if (WEB_LC[host]) return WEB_LC[host];
    return null;
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
    if (!opts.nopush) { t.hist = t.hist.slice(0, t.hi + 1); t.hist.push(url); t.hi = t.hist.length - 1; }
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
    if (!CR.tabs.length) { closeWin('chrome'); return; }
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
var SUG_CACHE = {};                                        // query → completions, session-only
function crSugIsUrl(q) { return /^[a-z0-9.-]+\.[a-z]{2,}/.test(q.replace(/^https?:\/\//, '').replace(/^www\./, '')) || /^chrome:\/\//.test(q); }
function crSuggestLocal(q) {
    var rows = [], seen = {};
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
    if (SUG_CACHE[q]) { merge(SUG_CACHE[q]); return; }
    liveGet('https://en.wikipedia.org/w/api.php?format=json&origin=*&action=opensearch&limit=6&search=' + encodeURIComponent(q), function (err, j) {
        if (err || !j || !j[1]) return;
        var comps = j[1];
        if (!(CR && CR.incog)) SUG_CACHE[q] = comps;        // incognito keystrokes leave no crumbs
        if (Object.keys(SUG_CACHE).length > 60) SUG_CACHE = {};
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
        if (l) { var t = crTab(); t.scroll = 0; crNav(l.getAttribute('data-href')); return; }
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
        else if (e.key === 'Escape') { suggest.hidden = true; url.blur(); crChrome(); }
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
    if (CR) { crDinoStop(); if (CR.keyFn) document.removeEventListener('keydown', CR.keyFn); }
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
    CR.held = { tabs: CR.tabs, active: CR.active, closed: CR.closed };
    CR.incog = !CR.incog;
    if (held) { CR.tabs = held.tabs; CR.active = Math.min(held.active, held.tabs.length - 1); CR.closed = held.closed; crChrome(); crTabs(); crPage(); }
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

/* —— Google Chrome Setup: a real wizard you click through yourself ——
   ChromeSetup.exe lives in the real Downloads folder (the gag put it
   there, or you re-run it from Explorer). Welcome → license → options
   → install → finish, with Back / Next / Cancel doing what they say.
   The options genuinely apply: desktop shortcut, taskbar pin, launch. */
var EULA = [
    'GOOGLE CHROME TERMS OF SERVICE',
    'UreOS 11 Pixel Edition · one (1) user: isaac',
    '',
    '1. By installing Google Chrome you agree to stop pretending you were ever going to keep using Edge.',
    '2. Chrome may use some of your memory. Chrome may use all of your memory. Chrome does not recognize the distinction.',
    '3. You will open tabs. The tabs will multiply. There is no support for this and there never will be.',
    '4. The address bar is also a search bar. There has only ever been one bar.',
    '5. Any telemetry collected is anonymized, aggregated, and honestly not that interesting: you visit isaacure.com and you play GTI RUN.',
    '6. In the event of a dispute, both parties agree to settle it in URE QUEST. Best of one. No healing potions.',
    '7. Microsoft Edge will remain installed, quietly, for emergencies. It knows what it did.',
    '8. Clause 8 was removed for morale reasons.',
    '9. Updates will install themselves whenever they feel like it, usually mid-sentence.',
    '10. This agreement is governed by the laws of UreOS, which are mostly vibes.',
    '',
    'Scroll complete. You are legally unstoppable.'
].join('\n');
var WIZ_LINES = ['Unpacking a faster browser…', 'Uninstalling Bing…', 'Importing 0 favorites…', 'Setting Chrome as default…', 'Reserving RAM (all of it)…', 'Tidying the Start menu…'];
var WIZ_FILES = ['chrome.exe', 'bloom.pak', 'tabs64.dll', 'omnibox.dat', 'ram_reservation.bin', 'not_edge.manifest', 'gti_easter_egg.rom', 'sync_isaac.json'];

function renderSetup() { return '<div class="wiz" data-step=""></div>'; }
function initSetup(el, id, arg) {
    var w = el.querySelector('.wiz');
    var s = { step: 'welcome', ok: false, dest: 'C:\\Program Files\\Google\\Chrome', shortcut: true, pin: true, launch: true, tidy: false, prog: 0, iv: 0, fi: 0 };
    el._wiz = s;

    function frame(bodyHtml, backOn, nextLabel, nextOn, cancelOn) {
        return '<div class="wiz-body">' + bodyHtml + '</div>' +
            '<footer class="wiz-foot">' +
              '<button class="wiz-btn" data-w="back" type="button"' + (backOn ? '' : ' disabled') + '>‹ Back</button>' +
              '<button class="wiz-btn primary" data-w="next" type="button"' + (nextOn ? '' : ' disabled') + '>' + nextLabel + '</button>' +
              '<button class="wiz-btn" data-w="cancel" type="button"' + (cancelOn === false ? ' disabled' : '') + '>Cancel</button>' +
            '</footer>';
    }
    function stepHTML(name) {
        if (name === 'welcome') return frame(
            '<div class="wiz-split"><div class="wiz-side">' + ic('ic-chrome') + '<span>chrome</span></div>' +
            '<div class="wiz-main"><h2>Welcome to the Google Chrome Setup Wizard</h2>' +
            '<p>This will install Google Chrome on your computer. You were always going to do this; the wizard just makes it official.</p>' +
            '<p>It is recommended that you close Microsoft Edge before continuing. It took the download surprisingly well, but it shouldn’t have to watch this part.</p>' +
            '<p class="wiz-dim">Click Next to continue, or Cancel to keep living like this.</p></div></div>',
            false, 'Next ›', true);
        if (name === 'license') return frame(
            '<div class="wiz-page"><h3>License Agreement</h3>' +
            '<p class="wiz-dim">Please read the following important information. Nobody ever has, but please.</p>' +
            '<pre class="wiz-eula">' + esc(EULA) + '</pre>' +
            '<label class="wiz-radio"><input type="radio" name="eula" data-eula="1"' + (s.ok ? ' checked' : '') + '> I accept the agreement</label>' +
            '<label class="wiz-radio"><input type="radio" name="eula" data-eula="0"> I do not accept the agreement</label>' +
            '<p class="wiz-hint" hidden>That’s fine. Edge is thrilled. (Next stays off until you accept.)</p></div>',
            true, 'Next ›', s.ok);
        if (name === 'options') return frame(
            '<div class="wiz-page"><h3>Install Options</h3>' +
            '<div class="wiz-row"><span>Install to:</span><span class="wiz-path">' + esc(s.dest) + '</span><button class="wiz-browse" type="button">Browse…</button></div>' +
            '<label class="wiz-check"><input type="checkbox" data-opt="shortcut"' + (s.shortcut ? ' checked' : '') + '> Create a desktop shortcut</label>' +
            '<label class="wiz-check"><input type="checkbox" data-opt="pin"' + (s.pin ? ' checked' : '') + '> Pin Google Chrome to the taskbar</label>' +
            '<label class="wiz-check"><input type="checkbox" checked disabled> Set Chrome as the default browser <i>(this one isn’t optional, sorry)</i></label>' +
            '<p class="wiz-dim" style="margin-top:12px">Space required: 640 KB · Space available: yes</p></div>',
            true, 'Install', true);
        if (name === 'progress') return frame(
            '<div class="wiz-page"><h3>Installing Google Chrome</h3>' +
            '<p class="wiz-status">Preparing to install…</p>' +
            '<div class="wiz-bar"><span></span></div>' +
            '<div class="wiz-sub"><span class="wiz-file">chrome.exe</span><span class="wiz-pct">0%</span></div>' +
            '<p class="wiz-dim" style="margin-top:14px">Please wait while the wizard does the only thing Edge was ever used for.</p></div>',
            false, 'Next ›', false);
        return frame(   // finish
            '<div class="wiz-split"><div class="wiz-side done">' + ic('ic-chrome') + '<span>✓ installed</span></div>' +
            '<div class="wiz-main"><h2>Completing the Google Chrome Setup Wizard</h2>' +
            '<p>Google Chrome has been installed on your computer. The desktop feels faster already. That’s placebo, but enjoy it.</p>' +
            '<label class="wiz-check"><input type="checkbox" data-opt="launch"' + (s.launch ? ' checked' : '') + '> Launch Google Chrome</label>' +
            '<label class="wiz-check"><input type="checkbox" data-opt="tidy"' + (s.tidy ? ' checked' : '') + '> Delete ChromeSetup.exe from Downloads</label>' +
            '<p class="wiz-dim">Click Finish to exit Setup.</p></div></div>',
            false, 'Finish', true, false);
    }
    function goStep(name) {
        s.step = name; w.setAttribute('data-step', name);
        w.innerHTML = stepHTML(name);
        wire();
        if (name === 'progress') startInstall();
    }
    function wire() {
        var back = w.querySelector('[data-w="back"]'), next = w.querySelector('[data-w="next"]'), cancel = w.querySelector('[data-w="cancel"]');
        cancel.addEventListener('click', function () {
            if (cancel.disabled) return;
            if (s.step === 'progress') dlgConfirm('Cancel Chrome installation?', 'Are you sure? Somewhere, Edge just perked up.', 'Cancel install', function () { stopSetup(el); closeWin('setup'); });
            else closeWin('setup');
        });
        back.addEventListener('click', function () {
            if (back.disabled) return;
            if (s.step === 'license') goStep('welcome');
            else if (s.step === 'options') goStep('license');
        });
        next.addEventListener('click', function () {
            if (next.disabled) return;
            if (s.step === 'welcome') goStep('license');
            else if (s.step === 'license') goStep('options');
            else if (s.step === 'options') goStep('progress');
            else if (s.step === 'finish') finishInstall();
        });
        w.querySelectorAll('[data-eula]').forEach(function (r) {
            r.addEventListener('change', function () {
                var acc = w.querySelector('[data-eula="1"]'), dec = w.querySelector('[data-eula="0"]');
                s.ok = !!(acc && acc.checked);
                next.disabled = !s.ok;
                var hint = w.querySelector('.wiz-hint'); if (hint) hint.hidden = !(dec && dec.checked);
            });
        });
        w.querySelectorAll('[data-opt]').forEach(function (c) {
            c.addEventListener('change', function () { s[c.getAttribute('data-opt')] = c.checked; });
        });
        var br = w.querySelector('.wiz-browse');
        if (br) br.addEventListener('click', function () { dlgInfo('Browse for folder', 'It goes in Program Files. It has always gone in Program Files.'); });
    }
    function startInstall() {
        var bar = w.querySelector('.wiz-bar span'), status = w.querySelector('.wiz-status');
        var pct = w.querySelector('.wiz-pct'), file = w.querySelector('.wiz-file'), li = -1;
        if (location.search.indexOf('freeze') >= 0) { bar.style.width = '58%'; pct.textContent = '58%'; status.textContent = WIZ_LINES[3]; file.textContent = 'omnibox.dat'; return; }   // dev: hold for a screenshot
        s.iv = setInterval(function () {
            if (dlgs.length) return;   // the cancel-confirm is up — a polite installer waits
            s.prog = Math.min(100, s.prog + (reduce ? 34 : 2.2 + Math.random() * 3.6));
            bar.style.width = s.prog + '%'; pct.textContent = Math.round(s.prog) + '%';
            file.textContent = WIZ_FILES[(s.fi++) % WIZ_FILES.length];
            var want = Math.min(WIZ_LINES.length - 1, Math.floor(s.prog / (100 / WIZ_LINES.length)));
            if (want !== li) { li = want; status.textContent = WIZ_LINES[want]; }
            if (s.prog >= 100) {
                clearInterval(s.iv); s.iv = 0;
                installChrome({ shortcut: s.shortcut, pin: s.pin });   // installed at 100%, not at Finish — X can't undo reality
                setTimeout(function () { if (openWins.setup) goStep('finish'); }, reduce ? 80 : 420);
            }
        }, reduce ? 50 : 130);
    }
    function finishInstall() {
        closeWin('setup');
        if (s.tidy) fsTidyChromeSetup();
        if (openWins.edge) closeWin('edge');   // Edge's work here is done
        if (s.launch) { openApp('chrome'); toast('Google Chrome installed — welcome home.'); }
        else toast('Chrome installed. It waits patiently in the taskbar.');
    }

    // dev: ?wstep=license|options|progress|finish jumps straight to a step
    var wstep = (location.search.match(/[?&]wstep=([a-z]+)/) || [])[1];
    if (wstep && { welcome: 1, license: 1, options: 1, progress: 1, finish: 1 }[wstep]) {
        s.ok = true;
        if (wstep === 'finish') installChrome({ shortcut: s.shortcut, pin: s.pin });   // finish implies the install already ran
        goStep(wstep);
    }
    else goStep('welcome');
}
function stopSetup(el) { if (el && el._wiz && el._wiz.iv) { clearInterval(el._wiz.iv); el._wiz.iv = 0; } }
function fsTidyChromeSetup() {
    var st = fsLoad(), arr = st.add['Downloads'] || [];
    st.add['Downloads'] = arr.filter(function (it) { return !/^ChromeSetup.*\.exe$/i.test(it.n); });
    fsSave(); refreshFileViews();
}

/* register Chrome once installed: taskbar pin + Start pin + optional desktop shortcut */
function installChrome(opts) {
    opts = opts || {};
    store('chrome', JSON.stringify({ shortcut: !!opts.shortcut, pin: opts.pin !== false }));   // installs survive reload
    if (opts.pin !== false && PINNED.indexOf('chrome') < 0) {
        PINNED.push('chrome');
        var center = taskbar.querySelector('.tb-center'), edgeBtn = center && center.querySelector('.tb-btn.app[data-app="edge"]');
        if (center && !center.querySelector(':scope > .tb-btn.app[data-app="chrome"]')) {   // ignore the temp #tbOpen button
            var b = document.createElement('button');
            b.className = 'tb-btn app'; b.type = 'button'; b.setAttribute('data-app', 'chrome'); b.setAttribute('aria-label', 'Google Chrome');
            b.innerHTML = ic('ic-chrome');
            if (edgeBtn) edgeBtn.insertAdjacentElement('afterend', b); else center.insertBefore(b, tbOpen);
        }
    }
    var pins = byId('pins');
    if (pins && !pins.querySelector('.pin[data-app="chrome"]')) {
        var p = document.createElement('button');
        p.className = 'pin'; p.type = 'button'; p.setAttribute('data-app', 'chrome');
        p.innerHTML = ic('ic-chrome') + '<span>Chrome</span>';
        pins.insertBefore(p, pins.firstChild);
    }
    // the desktop shortcut is a real file in the Desktop folder now
    if (opts.shortcut && !fsHas('Desktop', 'Google Chrome')) fsAddFile('Desktop', { n: 'Google Chrome', t: 'chrome', app: 'chrome', date: dlStamp() });
    syncTaskbar();
    refreshFileViews();   // when:chrome just flipped — C:\Program Files\Google exists now
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

/* ═══════════════════════════ Steam ═══════════════════════════
   A pixel Steam client — Store, Library, Community, Downloads.
   Everything is procedural: capsule art is CSS, "screenshots" are
   painted on a low-res canvas and scaled up crisp, and the whole
   loop (cart → checkout → install → download → play) actually runs.
   Isaac's URE BOY games sit in his library beside the games his
   profile says he'd own. State persists under comp_steam_*.
   ─────────────────────────────────────────────────────────────── */

/* inline pixel glyphs (kept here so index.html only gains one symbol) */
function gPlay() { return '<svg class="ic" viewBox="0 0 16 16" shape-rendering="crispEdges"><g fill="currentColor"><rect x="4" y="2" width="2" height="12"/><rect x="6" y="3" width="2" height="10"/><rect x="8" y="4" width="2" height="8"/><rect x="10" y="5" width="2" height="6"/><rect x="12" y="7" width="1" height="2"/></g></svg>'; }
function gCart() { return '<svg class="ic" viewBox="0 0 16 16" shape-rendering="crispEdges"><g fill="currentColor"><rect x="0" y="2" width="3" height="1"/><rect x="3" y="3" width="1" height="1"/><rect x="4" y="4" width="10" height="1"/><rect x="4" y="5" width="1" height="4"/><rect x="13" y="5" width="1" height="4"/><rect x="4" y="9" width="10" height="1"/><rect x="5" y="12" width="2" height="2"/><rect x="11" y="12" width="2" height="2"/></g></svg>'; }
function gDl() { return '<svg class="ic" viewBox="0 0 16 16" shape-rendering="crispEdges"><g fill="currentColor"><rect x="7" y="2" width="2" height="6"/><rect x="4" y="6" width="1" height="1"/><rect x="11" y="6" width="1" height="1"/><rect x="5" y="7" width="1" height="1"/><rect x="10" y="7" width="1" height="1"/><rect x="6" y="8" width="4" height="1"/><rect x="2" y="12" width="12" height="2"/></g></svg>'; }
function gStar() { return '<svg class="ic" viewBox="0 0 16 16" shape-rendering="crispEdges"><g fill="currentColor"><rect x="7" y="1" width="2" height="4"/><rect x="6" y="5" width="4" height="1"/><rect x="2" y="6" width="12" height="2"/><rect x="4" y="8" width="8" height="1"/><rect x="4" y="9" width="3" height="1"/><rect x="9" y="9" width="3" height="1"/><rect x="3" y="10" width="2" height="3"/><rect x="11" y="10" width="2" height="3"/></g></svg>'; }
function gThumb() { return '<svg class="st-mini" viewBox="0 0 16 16" shape-rendering="crispEdges"><g fill="currentColor"><rect x="2" y="7" width="3" height="7"/><rect x="6" y="6" width="7" height="8"/><rect x="6" y="2" width="2" height="4"/><rect x="8" y="1" width="2" height="2"/><rect x="10" y="2" width="1" height="4"/></g></svg>'; }
function gCheck() { return '<svg class="st-mini" viewBox="0 0 16 16" shape-rendering="crispEdges"><g fill="currentColor"><rect x="2" y="7" width="2" height="2"/><rect x="4" y="9" width="2" height="2"/><rect x="6" y="11" width="2" height="2"/><rect x="8" y="8" width="2" height="2"/><rect x="10" y="5" width="2" height="2"/><rect x="12" y="3" width="2" height="2"/></g></svg>'; }
function gBell() { return '<svg class="ic" viewBox="0 0 16 16" shape-rendering="crispEdges"><g fill="currentColor"><rect x="7" y="1" width="2" height="1"/><rect x="5" y="2" width="6" height="1"/><rect x="4" y="3" width="8" height="6"/><rect x="3" y="9" width="10" height="2"/><rect x="2" y="11" width="12" height="1"/><rect x="6" y="13" width="4" height="1"/></g></svg>'; }
function gDeck() { return '<svg class="st-mini" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect x="1" y="4" width="14" height="8" fill="none" stroke="currentColor" stroke-width="1"/><rect x="4" y="6" width="3" height="3" fill="currentColor"/><rect x="10" y="6" width="2" height="2" fill="currentColor"/></svg>'; }
function gUsers() { return '<svg class="st-mini" viewBox="0 0 16 16" shape-rendering="crispEdges"><g fill="currentColor"><rect x="3" y="3" width="4" height="4"/><rect x="2" y="8" width="6" height="4"/><rect x="10" y="4" width="3" height="3"/><rect x="9" y="8" width="5" height="3"/></g></svg>'; }

/* ── the catalogue ── */
var SC = { silver: '#b9c0c6', red: '#d81e05', gb: '#9bbc0f' };
var STG = [
  { id: 'gtirun', t: 'GTI RUN', dev: 'URE Softworks', pub: 'URE Softworks', yr: 2026,
    tags: ['Racing', 'Arcade', 'Great Soundtrack', 'Pixel Graphics', 'Singleplayer'],
    s: "Redline the back roads in Argent, a silver MK8 GTI. Dodge traffic, chain near-misses, chase the perfect run.",
    d: "A hand-built arcade racer for the URE BOY. One car, one road, infinite nerve. Every near-miss banks boost; every wreck resets the clock. Built by Isaac on a 160×144 backbuffer.",
    price: 0, disc: 0, free: true, owned: true, inst: true, hrs: 12.4, hrs2w: 3.1,
    rev: ['Overwhelmingly Positive', 98, 1204], art: [SC.silver, SC.red, 'GTI'], sc: 'road',
    feat: true, launch: '/ureboy/',
    ach: [8, 8], achx: [['Argent', 'Unlock the silver GTI', 1], ['Clean Run', 'Finish with no contact', 1], ['Redline', 'Hold the rev limiter 10s', 1], ['Ghost', 'Beat your own best', 1]],
    revx: [["Isaac made this in his dorm and it slaps.", 1, "12.4 hrs"], ["My actual GTI is jealous.", 1, "6.0 hrs"]],
    news: [['v1.4 — Night Roads', "Added a dusk palette and a rival ghost car. Braking now costs less boost.", 'Jul 6']] },

  { id: 'pitlane', t: 'PIT LANE', dev: 'URE Softworks', pub: 'URE Softworks', yr: 2026,
    tags: ['Management', 'Strategy', 'Racing', 'Indie'],
    s: "Call the strategy from the wall. Tyres, fuel, undercuts — win the race you never drive.",
    d: "A pit-wall management sim on the URE BOY. Read the tyre deg, time the box, gamble the undercut. Saves live in ub_pitlane_save.",
    price: 0, disc: 0, free: true, owned: true, inst: true, hrs: 5.8, hrs2w: 0.4,
    rev: ['Very Positive', 92, 388], art: ['#2a2f36', SC.red, 'PIT'], sc: 'road', launch: '/ureboy/',
    ach: [5, 9], achx: [['Box Box Box', 'Nail a 2.4s stop', 1], ['Undercut', 'Win with an undercut', 1], ['One-Stop', 'Win on a single stop', 0]] },

  { id: 'urequest', t: 'URE QUEST', dev: 'URE Softworks', pub: 'URE Softworks', yr: 2026,
    tags: ['RPG', 'Turn-Based', 'Pixel Graphics', 'Story Rich'],
    s: "A pocket CRPG. Roll initiative, mind your MP, and find out who Argent really is.",
    d: "A tiny turn-based CRPG for the URE BOY with a DM's heart. Reworked in the big PR #44 that finally made the GTI's name canon.",
    price: 0, disc: 0, free: true, owned: true, inst: true, hrs: 9.2, hrs2w: 1.7,
    rev: ['Very Positive', 90, 512], art: ['#2d1e3a', SC.gb, 'URE'], sc: 'dungeon', launch: '/ureboy/',
    ach: [11, 16], achx: [['First Blood', 'Win a battle', 1], ['Lorekeeper', 'Read every codex', 1], ['Pacifist', 'Clear a floor unhurt', 0], ['Nat 20', 'Land a crit', 1]] },

  // runs IN the desktop — window.ARPG, comp/arpg.js
  { id: 'veilfall', t: 'VEILFALL', dev: 'URE Softworks', pub: 'URE Softworks', yr: 2026,
    tags: ['Action RPG', 'Early Access', 'Isometric', 'Dark Fantasy', 'Loot'],
    s: "An isometric ARPG in Early Access. One arena, nine spells, one very patient dummy. The story isn't written yet. The violence is.",
    d: "The proving grounds open before the campaign does: liquid life and mana globes, a passive web, flasks that refill on violence, crits, ignites, freezes, shocks, a curse, a meteor with a travel time, and a training dummy with configurable resistances and infinite forgiveness. Bring opinions about cast speed. Early Access roadmap: 'a short but sweet intriguing story' — the writer has been informed.",
    price: 0, disc: 0, free: true, owned: true, inst: true, hrs: 0, hrs2w: 0, ea: true,   // real build => ships installed (#78)
    rev: ['Very Positive', 91, 328], art: ['#160a20', '#8a4ae0', 'VF'], sc: 'dungeon', trend: true,
    app: 'arpg', live: 'ARPG',
    ach: [0, 14],
    news: [['v0.1 — the proving grounds', "VEILFALL enters Early Access with a test arena, nine spells and a dummy that respawns with fresh optimism. The story arrives when it arrives. The meteor arrives in 1.1 seconds.", 'Jul 17']] },

  // runs IN the desktop (like Terraria below) — window.COOKIE, comp/cookie.js.
  // installed = playable on this Steam: only games with a real build (app: in a
  // window, launch: on the URE BOY) ship installed; the shelf games are library-only
  { id: 'cookie', t: 'Cookie Clicker', dev: 'Orteil', pub: 'DashNet', yr: 2013,
    tags: ['Clicker', 'Idle', 'Free to Play', 'Casual', 'Singleplayer'],
    s: "An idle game about baking cookies. Click the cookie. Employ grandmas. Question nothing.",
    d: "The one that started it all, ported to UreOS as a real desktop app. The numbers are the real numbers: 1.15× price curves, ×7 Frenzies, kittens that scale with milk, and an ascension formula you will do actual math about. Your grandmas keep the ovens on while the window is open.",
    price: 0, disc: 0, free: true, owned: true, inst: true, hrs: 0, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 97, 214883], art: ['#3a2210', '#d9973a', 'CC'], sc: 'cookie', trend: true, spec: true,
    app: 'cookie', live: 'COOKIE',
    ach: [0, 40], achx: [],
    news: [['v1.0 — the UreOS port', "Cookie Clicker now runs in a real window on the pixel desktop. Achievements sync to this very Steam client. The grandmas came with the port; we did not ask them to.", 'Jul 9']] },

  // the second game that actually runs IN the desktop — window.RACER, comp/racer.js
  { id: 'sunrun', t: 'SUNSET RUNNER', dev: 'URE Softworks', pub: 'URE Softworks', yr: 2026,
    tags: ['Racing', 'Arcade', 'Pixel Graphics', 'Great Soundtrack', 'Singleplayer'],
    s: "A pseudo-3D sunset racer that runs right here on the desktop. Three circuits, five rivals, one nitro bar between you and the podium.",
    d: "What GTI RUN's patch notes kept promising, built for real: a pseudo-3D racer in a live window on UreOS. Projected roads with curves and hills, three palettes (sunset coast, neon night, dawn ridge), five sprite-scaled rivals with live positions and lap times, drift, off-road, nitro, and a synth engine that climbs the gears. Grid up, wait for GO, and go hunt the checkered.",
    price: 0, disc: 0, free: true, owned: true, inst: true, hrs: 0, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 97, 842], art: ['#241a45', '#e85c6f', 'RUN'], sc: 'road', trend: true, feat: true,
    app: 'sunrun', live: 'RACER',
    ach: [0, 6], achx: [['First Light', 'Finish a race', 0], ['Podium', 'Finish in the top three', 0], ['Checkered', 'Win a race', 0], ['Grand Tour', 'Win on all three circuits', 0], ['Redline', 'Drain the nitro bar to empty', 0], ['Night Shift', 'Win on NEON NIGHT', 0]],
    revx: [["It runs IN the Steam that runs IN the website. I had to sit down.", 1, "3.2 hrs"], ["Caught NOVA on the last corner of the last lap. Yelled out loud.", 1, "1.8 hrs"]],
    news: [['v1.0 — on the grid', "Sunset Runner ships as a real desktop app: three circuits, five rivals, live positions and a nitro bar. Open your library and hit Play.", 'Jul 23']] },

  { id: 'bg3', t: "Baldur's Gate 3", dev: 'Larian Studios', pub: 'Larian Studios', yr: 2023,
    tags: ['RPG', 'Dungeons & Dragons', 'Story Rich', 'Turn-Based', 'Co-op'],
    s: "Gather your party and venture forth. A cinematic take on the world's greatest role-playing game.",
    d: "Mind flayers, moral rot, and a thousand ways to fail forward. The DM in Isaac never stood a chance against this one.",
    price: 5999, disc: 0, owned: true, inst: false, hrs: 214.6, hrs2w: 18.3,
    rev: ['Overwhelmingly Positive', 96, 728104], art: ['#3a1c12', '#c58b3a', 'BG3'], sc: 'dungeon',
    feat: true, ach: [41, 54],
    achx: [['The Plot Thickens', 'Complete Act One', 1], ['Fear Itself', 'Defeat the Absolute', 0], ['Rest & Relaxation', 'Take a long rest', 1], ['A Grand Old Time', 'Recruit a companion', 1], ['Escapologist', 'Escape the Nautiloid', 1]],
    revx: [["I role-played a bard for 60 hours and have no regrets.", 1, "214.6 hrs"], ["Failed a persuasion check and it made the game better.", 1, "88.0 hrs"]],
    news: [['Patch 8 — the last big one', "Twelve new subclasses, split-screen fixes, and a photo mode. Go say goodbye to your party.", 'Apr 15']] },

  { id: 'factorio', t: 'Factorio', dev: 'Wube Software', pub: 'Wube Software', yr: 2020,
    tags: ['Automation', 'Base Building', 'Strategy', 'Optimization', 'Singleplayer'],
    s: "The factory must grow. Build, automate, and defend a sprawling production line on an alien world.",
    d: "A game about spaghetti becoming a cathedral. Made for a systems-and-optimization brain that cannot leave a bottleneck alone.",
    price: 3500, disc: 0, owned: true, inst: false, hrs: 341.9, hrs2w: 22.0,
    rev: ['Overwhelmingly Positive', 97, 201338], art: ['#3a2a12', '#d99b2a', 'FAC'], sc: 'factory',
    feat: true, ach: [72, 100],
    achx: [['Automated', 'Craft with an assembler', 1], ['It stinks and they do not like it', 'Get attacked by pollution', 1], ['Lazy Bastard', 'Hand-craft ≤111 items', 0], ['There is no spoon', 'Win under 8 hours', 0], ['Mass Production 3', 'Produce 20k circuits', 1]],
    revx: [["Told my roommate I'd play for 20 minutes. Sunrise disagreed.", 1, "341.9 hrs"], ["I have restructured my main bus four times. Send help.", 1, "120.4 hrs"]] },

  { id: 'beamng', t: 'BeamNG.drive', dev: 'BeamNG', pub: 'BeamNG', yr: 2015,
    tags: ['Simulation', 'Driving', 'Physics', 'Sandbox', 'Realistic'],
    s: "The most realistic soft-body crash and driving sandbox on PC. Every panel deforms.",
    d: "Suspension geometry you can feel and crumple zones you can hear. A car-builder's physics playground.",
    price: 2499, disc: 20, owned: true, inst: false, hrs: 47.2, hrs2w: 4.5,
    rev: ['Overwhelmingly Positive', 96, 168220], art: ['#20303f', '#5a7d9c', 'BNG'], sc: 'road', spec: true,
    ach: [0, 0] },

  { id: 'assetto', t: 'Assetto Corsa', dev: 'Kunos Simulazioni', pub: '505 Games', yr: 2014,
    tags: ['Racing', 'Simulation', 'Automobile Sim', 'Moddable'],
    s: "Laser-scanned tracks, physics that punish and reward. The sim racer's sim racer.",
    d: "Trail-brake into Eau Rouge and find out who you really are. Endlessly moddable, endlessly humbling.",
    price: 1999, disc: 75, owned: true, inst: false, hrs: 63.1, hrs2w: 2.2,
    rev: ['Very Positive', 89, 91004], art: ['#1a1f26', '#b2151d', 'AC'], sc: 'road', spec: true,
    ach: [22, 47] },

  { id: 'disco', t: 'Disco Elysium', dev: 'ZA/UM', pub: 'ZA/UM', yr: 2019,
    tags: ['RPG', 'Story Rich', 'Detective', 'Absurdist', 'Choices Matter'],
    s: "A groundbreaking role-playing game. You're a detective with a unique skill system and a whole city to carve your path across.",
    d: "Argue with the reactionary lodged inside your own skull. Absurdist philosophy with a badge and a hangover.",
    price: 3999, disc: 60, owned: true, inst: false, hrs: 38.4, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 96, 152770], art: ['#241a2e', '#b5462e', 'DE'], sc: 'city', spec: true,
    ach: [19, 40], achx: [['Detective', 'Solve the case', 0], ['Hardcore', 'Reach Level 20', 1], ['Rond-dubois', 'Find the phasmid', 0]] },

  { id: 'outerwilds', t: 'Outer Wilds', dev: 'Mobius Digital', pub: 'Annapurna', yr: 2019,
    tags: ['Exploration', 'Mystery', 'Space', 'Open World', 'Time Loop'],
    s: "A open-world mystery about a solar system trapped in an endless time loop.",
    d: "Twenty-two minutes to the end of everything, on repeat, until you understand. Do not read a word about it. Just go.",
    price: 2499, disc: 40, owned: true, inst: false, hrs: 27.5, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 97, 61402], art: ['#10131f', '#d98a2b', 'OW'], sc: 'space', spec: true,
    ach: [9, 12] },

  { id: 'hades', t: 'Hades', dev: 'Supergiant Games', pub: 'Supergiant Games', yr: 2020,
    tags: ['Roguelike', 'Action', 'Story Rich', 'Great Soundtrack', 'Hack and Slash'],
    s: "Defy the god of the dead as you hack and slash out of the Underworld in this rogue-like dungeon crawler.",
    d: "Death is a mechanic and the writing is the reward. One more escape attempt, forever.",
    price: 2499, disc: 50, owned: true, inst: false, hrs: 54.8, hrs2w: 6.0,
    rev: ['Overwhelmingly Positive', 98, 315880], art: ['#2a0f1a', '#b5122e', 'HAD'], sc: 'dungeon', spec: true,
    ach: [31, 49] },

  { id: 'stardew', t: 'Stardew Valley', dev: 'ConcernedApe', pub: 'ConcernedApe', yr: 2016,
    tags: ['Farming Sim', 'Relaxing', 'Pixel Graphics', 'Life Sim', 'Cozy'],
    s: "You've inherited your grandfather's old farm plot. Turn overgrown fields into a thriving home.",
    d: "One human made this entire game. The most relaxing 200 hours you'll never notice passing.",
    price: 1499, disc: 0, owned: true, inst: false, hrs: 71.0, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 98, 720441], art: ['#2e4a1e', '#7bb04a', 'SDV'], sc: 'nature',
    ach: [28, 40] },

  { id: 'cs2', t: 'Counter-Strike 2', dev: 'Valve', pub: 'Valve', yr: 2023,
    tags: ['FPS', 'Shooter', 'Competitive', 'Free to Play', 'Multiplayer'],
    s: "For over two decades, Counter-Strike has offered an elite competitive experience. Now in the Source 2 engine.",
    d: "Rush B, get humbled, queue again. The eternal LAN party.",
    price: 0, disc: 0, free: true, owned: true, inst: false, hrs: 128.3, hrs2w: 5.5,
    rev: ['Mixed', 62, 1904772], art: ['#20262e', '#d99b2a', 'CS2'], sc: 'city',
    ach: [1, 1], achx: [['A Counter-Strike', 'Win a match', 1]] },

  { id: 'eldenring', t: 'Elden Ring', dev: 'FromSoftware', pub: 'Bandai Namco', yr: 2022,
    tags: ['Souls-like', 'Open World', 'Difficult', 'RPG', 'Dark Fantasy'],
    s: "A new fantasy action-RPG. Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring.",
    d: "A open world that does not respect your time and is better for it. Bring a friend and a lot of patience.",
    price: 5999, disc: 30, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 95, 682330], art: ['#1c1810', '#b99534', 'ER'], sc: 'nature', spec: true, trend: true,
    ach: [0, 42] },

  { id: 'cities', t: 'Cities: Skylines II', dev: 'Colossal Order', pub: 'Paradox', yr: 2023,
    tags: ['City Builder', 'Simulation', 'Management', 'Strategy'],
    s: "Raise a city from the ground up and transform it into a thriving metropolis. Bring your dream city to life.",
    d: "Zoning, traffic, and the slow horror of a badly-placed roundabout. An optimizer's sandbox.",
    price: 4999, disc: 40, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Mixed', 58, 44210], art: ['#23303a', '#3f7d9c', 'CTY'], sc: 'city', trend: true,
    ach: [0, 36] },

  { id: 'forza', t: 'Forza Horizon 5', dev: 'Playground Games', pub: 'Xbox Game Studios', yr: 2021,
    tags: ['Racing', 'Open World', 'Driving', 'Multiplayer', 'Beautiful'],
    s: "Your Ultimate Horizon Adventure awaits! Explore the vibrant open world landscapes of Mexico.",
    d: "A postcard you can drift through. Hundreds of cars, zero commute.",
    price: 5999, disc: 65, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Very Positive', 85, 148900], art: ['#123a2a', '#37c07a', 'FH5'], sc: 'road', spec: true, trend: true,
    ach: [0, 90] },

  { id: 'rocketleague', t: 'Rocket League', dev: 'Psyonix', pub: 'Psyonix', yr: 2020,
    tags: ['Soccer', 'Multiplayer', 'Competitive', 'Free to Play', 'Cars'],
    s: "Soccer meets driving in the successor to the highly-rated Supersonic Acrobatic Rocket-Powered Battle-Cars.",
    d: "Car soccer. Somehow the most stressful sport ever invented. Free, so no excuses.",
    price: 0, disc: 0, free: true, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Very Positive', 87, 462110], art: ['#10233a', '#2b8fd6', 'RL'], sc: 'abstract', trend: true,
    ach: [0, 88] },

  { id: 'balatro', t: 'Balatro', dev: 'LocalThunk', pub: 'Playstack', yr: 2024,
    tags: ['Roguelike', 'Card Game', 'Deckbuilding', 'Poker', 'Addictive'],
    s: "A poker-inspired roguelike deckbuilder. Combine cards, unlock jokers, and chase the score that breaks the game.",
    d: "It is not poker. It is a spreadsheet with a heartbeat, and it will eat your week.",
    price: 1499, disc: 20, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 98, 96044], art: ['#2a1030', '#c22a4a', 'BAL'], sc: 'abstract', spec: true, trend: true,
    ach: [0, 34] },

  { id: 'satisfactory', t: 'Satisfactory', dev: 'Coffee Stain Studios', pub: 'Coffee Stain', yr: 2024,
    tags: ['Automation', 'Base Building', 'Open World', 'First-Person', 'Optimization'],
    s: "Conquer an alien planet by building massive factories — in first person, at conveyor level.",
    d: "Factorio's philosophy at eye height. Isaac walks his own main bus here and calls it cardio.",
    price: 3999, disc: 0, owned: true, inst: false, hrs: 89.3, hrs2w: 8.4,
    rev: ['Overwhelmingly Positive', 97, 190441], art: ['#2a1a10', '#e8842a', 'SAT'], sc: 'factory', feat: true,
    ach: [28, 48], news: [['1.1 — vertical logistics', "Lifts got smarter, splitters got vertical, the sky got more crowded.", 'Jun 28']] },

  { id: 'portal2', t: 'Portal 2', dev: 'Valve', pub: 'Valve', yr: 2011,
    tags: ['Puzzle', 'Co-op', 'Comedy', 'First-Person', 'Sci-fi'],
    s: "Think with portals. The best comedy duo in games is a rogue AI and a potato battery.",
    d: "Still the gold standard for a punchline landing at the exact moment a physics puzzle clicks.",
    price: 999, disc: 80, owned: true, inst: false, hrs: 18.2, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 98, 435019], art: ['#101820', '#3fa8d8', 'P2'], sc: 'abstract',
    ach: [34, 51] },

  { id: 'kerbal', t: 'Kerbal Space Program', dev: 'Squad', pub: 'Private Division', yr: 2015,
    tags: ['Space', 'Simulation', 'Physics', 'Sandbox', 'Difficult'],
    s: "Build a rocket out of parts and hope. Fly little green optimists to places they should not go.",
    d: "The only game where 'more struts' is both a meme and a valid engineering document.",
    price: 3999, disc: 75, owned: true, inst: false, hrs: 44.1, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 95, 105882], art: ['#0d1420', '#7bc043', 'KSP'], sc: 'space', spec: true,
    ach: [19, 55] },

  { id: 'civ6', t: "Sid Meier's Civilization VI", dev: 'Firaxis Games', pub: '2K', yr: 2016,
    tags: ['Strategy', 'Turn-Based', '4X', 'Multiplayer', 'Addictive'],
    s: "Build an empire to stand the test of time. One. More. Turn.",
    d: "The clock says 2 AM. Gandhi says otherwise. An optimizer's slow-motion chess match against history.",
    price: 5999, disc: 90, owned: true, inst: false, hrs: 76.8, hrs2w: 0,
    rev: ['Very Positive', 87, 254120], art: ['#1e2a1a', '#d8b13a', 'CIV'], sc: 'nature', spec: true,
    ach: [31, 80] },

  { id: 'slaythespire', t: 'Slay the Spire', dev: 'Mega Crit', pub: 'Mega Crit', yr: 2019,
    tags: ['Roguelike', 'Card Game', 'Deckbuilding', 'Strategy', 'Turn-Based'],
    s: "Fuse card games and roguelikes. Craft a unique deck, climb the Spire, die, learn, climb again.",
    d: "Every run is a math problem wearing a fantasy costume. Isaac's kind of costume party.",
    price: 2499, disc: 66, owned: true, inst: false, hrs: 61.4, hrs2w: 2.1,
    rev: ['Overwhelmingly Positive', 97, 191230], art: ['#241418', '#c23a2a', 'STS'], sc: 'cards', spec: true,
    ach: [24, 46] },

  { id: 'tabletop', t: 'Tabletop Simulator', dev: 'Berserk Games', pub: 'Berserk Games', yr: 2015,
    tags: ['Tabletop', 'Board Game', 'Multiplayer', 'Sandbox', 'RPG'],
    s: "Physics-driven tabletop sandbox. Flip the table. It's allowed here.",
    d: "The DM's remote toolkit. Isaac's dice tower is modded, his battle maps are labeled, his players still ignore the plot hooks.",
    price: 1999, disc: 50, owned: true, inst: false, hrs: 33.7, hrs2w: 1.2,
    rev: ['Very Positive', 89, 91340], art: ['#0d2318', '#d8b13a', 'TTS'], sc: 'cards',
    ach: [8, 15] },

  { id: 'stanley', t: 'The Stanley Parable: Ultra Deluxe', dev: 'Crows Crows Crows', pub: 'Crows Crows Crows', yr: 2022,
    tags: ['Absurdist', 'Comedy', 'Walking Simulator', 'Choices Matter', 'Meta'],
    s: "Stanley pressed a button. Or did he? A narrator disagrees. Repeatedly.",
    d: "Absurdist philosophy with a door budget. The closest a game has come to reading Camus in an office chair.",
    price: 2499, disc: 40, owned: true, inst: false, hrs: 6.6, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 96, 44210], art: ['#2a2418', '#d8d0b0', 'TSP'], sc: 'abstract',
    ach: [7, 12], achx: [['Click 430,000 times', 'You did not do this', 0], ['Go outside', "Don't play for 5 years", 0], ['Commitment', 'Play all day Tuesday', 1]] },

  { id: 'papers', t: 'Papers, Please', dev: '3909 LLC', pub: '3909 LLC', yr: 2013,
    tags: ['Absurdist', 'Simulation', 'Story Rich', 'Dystopian', 'Indie'],
    s: "Glory to Arstotzka. A border checkpoint, a stamp, and your slowly compressing soul.",
    d: "Bureaucracy as tragedy, tragedy as gameplay. Cause no trouble.",
    price: 999, disc: 66, owned: true, inst: false, hrs: 11.2, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 97, 88450], art: ['#1c1a14', '#a03a2a', 'PP'], sc: 'city',
    ach: [9, 13] },

  { id: 'hollowknight', t: 'Hollow Knight', dev: 'Team Cherry', pub: 'Team Cherry', yr: 2017,
    tags: ['Metroidvania', 'Difficult', 'Atmospheric', 'Great Soundtrack', 'Indie'],
    s: "Forge your own path through a vast, ruined kingdom of insects and heroes.",
    d: "A kingdom of bugs with better worldbuilding than most trilogies. The map seller is doing his best.",
    price: 1499, disc: 50, owned: true, inst: false, hrs: 39.5, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 97, 302110], art: ['#101622', '#7fd4e0', 'HK'], sc: 'cave',
    ach: [28, 63] },

  { id: 'celeste', t: 'Celeste', dev: 'Extremely OK Games', pub: 'Maddy Makes Games', yr: 2018,
    tags: ['Platformer', 'Difficult', 'Pixel Graphics', 'Story Rich', 'Great Soundtrack'],
    s: "Help Madeline survive her inner demons on her journey to the top of Celeste Mountain.",
    d: "A pixel-perfect platformer about anxiety that is somehow gentle about being brutally hard.",
    price: 1999, disc: 75, owned: true, inst: false, hrs: 21.3, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 98, 122480], art: ['#1a2232', '#e07ba0', 'CEL'], sc: 'snow', spec: true,
    ach: [18, 32] },

  { id: 'terraria', t: 'Terraria', dev: 'Re-Logic', pub: 'Re-Logic', yr: 2011,
    tags: ['Sandbox', 'Survival', 'Pixel Graphics', 'Crafting', 'Multiplayer'],
    s: "Dig, fight, explore, build! Nothing is impossible in this action-packed adventure.",
    d: "2D Minecraft's cooler older sibling, ported to run IN a window on this desktop: a real generated world with caves, four ore tiers, flood-fill torchlight, a day/night cycle, slimes, zombies, demon eyes, proximity crafting, and the Eye of Cthulhu if you craft something you shouldn't. Isaac's 94 hours came with the shelf copy; yours count from here.",
    price: 999, disc: 50, owned: true, inst: true, hrs: 94.6, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 98, 1121300], art: ['#12241a', '#5db04a', 'TER'], sc: 'cave',
    app: 'terraria', live: 'TERRA',
    ach: [0, 16],
    news: [['v1.0 — the UreOS port', "Terraria now generates a real 360x180 world inside a desktop window. The guide did not survive the port. He is fine. He is somewhere.", 'Jul 10']] },

  { id: 'ets2', t: 'Euro Truck Simulator 2', dev: 'SCS Software', pub: 'SCS Software', yr: 2012,
    tags: ['Driving', 'Simulation', 'Relaxing', 'Open World', 'Automobile Sim'],
    s: "Travel across Europe as king of the road, a trucker who delivers important cargo.",
    d: "Chamomile in game form. Set cruise control on the A8, put on a podcast, feel your heart rate drop.",
    price: 1999, disc: 75, owned: true, inst: false, hrs: 28.4, hrs2w: 1.8,
    rev: ['Overwhelmingly Positive', 97, 288420], art: ['#16202a', '#3a7db0', 'ETS'], sc: 'road', spec: true,
    ach: [21, 71] },

  { id: 'drg', t: 'Deep Rock Galactic', dev: 'Ghost Ship Games', pub: 'Coffee Stain', yr: 2020,
    tags: ['Co-op', 'FPS', 'Mining', 'Class-Based', 'Multiplayer'],
    s: "Danger. Darkness. Dwarves. A 1-4 player co-op FPS with 100% destructible caves.",
    d: "ROCK AND STONE. The only shooter where the real boss is cave geometry and nobody minds.",
    price: 2999, disc: 67, owned: true, inst: false, hrs: 47.9, hrs2w: 3.3,
    rev: ['Overwhelmingly Positive', 97, 265110], art: ['#1c1208', '#e8a42a', 'DRG'], sc: 'cave', spec: true,
    ach: [37, 69] },

  { id: 'vampire', t: 'Vampire Survivors', dev: 'poncle', pub: 'poncle', yr: 2022,
    tags: ['Roguelike', 'Bullet Hell', 'Pixel Graphics', 'Addictive', 'Casual'],
    s: "Mow down thousands of night creatures and survive until dawn. Cheap as chips, sharp as garlic.",
    d: "Five dollars. Five hundred enemies on screen. Five hours gone. The math never favored you.",
    price: 499, disc: 20, owned: true, inst: false, hrs: 30.1, hrs2w: 2.6,
    rev: ['Overwhelmingly Positive', 98, 231240], art: ['#170f1c', '#c2a03a', 'VS'], sc: 'dungeon',
    ach: [88, 202] },

  { id: 'witcher3', t: 'The Witcher 3: Wild Hunt', dev: 'CD PROJEKT RED', pub: 'CD PROJEKT RED', yr: 2015,
    tags: ['RPG', 'Open World', 'Story Rich', 'Dark Fantasy', 'Mature'],
    s: "You are Geralt of Rivia, monster slayer for hire, on the trail of the child of prophecy.",
    d: "The sidequests out-write other games' main plots. Gwent is a load-bearing minigame.",
    price: 3999, disc: 80, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 96, 762210], art: ['#1a1c14', '#b0b8bc', 'W3'], sc: 'nature', spec: true,
    ach: [0, 78] },

  { id: 'cyberpunk', t: 'Cyberpunk 2077', dev: 'CD PROJEKT RED', pub: 'CD PROJEKT RED', yr: 2020,
    tags: ['Open World', 'RPG', 'Sci-fi', 'Story Rich', 'Mature'],
    s: "An open-world action-adventure set in Night City, a megalopolis obsessed with power and glamour.",
    d: "The great redemption arc of modern games. Come for Night City at dusk; stay because Johnny won't leave.",
    price: 5999, disc: 50, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Very Positive', 86, 724110], art: ['#12141c', '#e8d83a', 'CP'], sc: 'city', spec: true, trend: true,
    ach: [0, 57] },

  { id: 'rdr2', t: 'Red Dead Redemption 2', dev: 'Rockstar Games', pub: 'Rockstar Games', yr: 2019,
    tags: ['Open World', 'Story Rich', 'Western', 'Adventure', 'Mature'],
    s: "The epic tale of outlaw Arthur Morgan and the Van der Linde gang, across a gorgeous dying frontier.",
    d: "A six-minute horse ride where nothing happens, and you would not skip a second of it.",
    price: 5999, disc: 67, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Very Positive', 91, 622840], art: ['#241410', '#c2482a', 'RDR'], sc: 'nature', spec: true,
    ach: [0, 51] },

  { id: 'sekiro', t: 'Sekiro: Shadows Die Twice', dev: 'FromSoftware', pub: 'Activision', yr: 2019,
    tags: ['Souls-like', 'Difficult', 'Ninja', 'Action', 'Singleplayer'],
    s: "Carve your own clever path to vengeance in the award-winning adventure from FromSoftware.",
    d: "Hesitation is defeat. A parry rhythm game wearing an action game's clothes.",
    price: 5999, disc: 50, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 95, 291180], art: ['#1a141c', '#c2452a', 'SEK'], sc: 'dungeon', spec: true,
    ach: [0, 34] },

  { id: 'f1manager', t: 'F1 Manager 2024', dev: 'Frontier Developments', pub: 'Frontier', yr: 2024,
    tags: ['Management', 'Racing', 'Strategy', 'Simulation', 'Sports'],
    s: "Rewrite the 2024 season from the pit wall. Every call is yours.",
    d: "Basically PIT LANE with a licensing budget. Isaac built his version first — this is opposition research.",
    price: 3499, disc: 60, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Very Positive', 81, 12840], art: ['#141820', '#e01a2a', 'F1M'], sc: 'road', spec: true,
    ach: [0, 40] },

  { id: 'dysonsphere', t: 'Dyson Sphere Program', dev: 'Youthcat Studio', pub: 'Gamera Games', yr: 2021,
    tags: ['Automation', 'Space', 'Base Building', 'Strategy', 'Optimization'],
    s: "Build the most efficient intergalactic factory ever devised. Then feed it a star.",
    d: "Factorio, but the factory eventually eats a sun. The logical endpoint of Isaac's whole personality.",
    price: 2999, disc: 30, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 96, 102110], art: ['#0d1220', '#3ac0e0', 'DSP'], sc: 'space', spec: true, trend: true,
    ach: [0, 48] },

  { id: 'inscryption', t: 'Inscryption', dev: 'Daniel Mullins Games', pub: 'Devolver Digital', yr: 2021,
    tags: ['Card Game', 'Horror', 'Roguelike', 'Meta', 'Story Rich'],
    s: "An inky black card-based odyssey that blends deckbuilding, escape rooms, and psychological horror.",
    d: "A card game that keeps taking its own mask off. Say nothing about act two to anyone.",
    price: 1999, disc: 60, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 97, 141230], art: ['#0f1410', '#c2a03a', 'INS'], sc: 'cards', spec: true, trend: true,
    ach: [0, 44] },

  { id: 'dwarffortress', t: 'Dwarf Fortress', dev: 'Bay 12 Games', pub: 'Kitfox Games', yr: 2022,
    tags: ['Colony Sim', 'Simulation', 'Procedural Generation', 'Difficult', 'Story Generator'],
    s: "The deepest, most intricate simulation of a world ever created. Losing is fun!",
    d: "Twenty years of simulation depth. Your fortress will fall to a sock-related tantrum spiral and you will thank it.",
    price: 2999, disc: 0, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 95, 33420], art: ['#141210', '#8a9498', 'DF'], sc: 'cave',
    ach: [0, 0] },

  { id: 'lethal', t: 'Lethal Company', dev: 'Zeekerss', pub: 'Zeekerss', yr: 2023,
    tags: ['Co-op', 'Horror', 'Comedy', 'Multiplayer', 'Proximity Chat'],
    s: "A co-op horror about scavenging derelict moons to meet the Company's profit quota.",
    d: "The scariest thing here is the quota. The funniest is your friend's last words over proximity chat.",
    price: 999, disc: 0, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 97, 421080], art: ['#0d1014', '#c24a1a', 'LC'], sc: 'factory', trend: true,
    ach: [0, 0] },

  { id: 'obradinn', t: 'Return of the Obra Dinn', dev: 'Lucas Pope', pub: '3909 LLC', yr: 2018,
    tags: ['Detective', 'Mystery', 'Story Rich', 'Puzzle', 'Stylized'],
    s: "An insurance adventure with minimal color. Sixty fates to deduce aboard a ghost ship.",
    d: "One-bit dithering, one perfect pocket watch, sixty corpses. The best detective game ever shipped.",
    price: 1999, disc: 40, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 98, 61120], art: ['#e8e4d8', '#242220', 'OD'], sc: 'abstract', trend: true,
    ach: [0, 10] },

  { id: 'rimworld', t: 'RimWorld', dev: 'Ludeon Studios', pub: 'Ludeon Studios', yr: 2018,
    tags: ['Colony Sim', 'Base Building', 'Strategy', 'Simulation', 'Story Generator'],
    s: "A sci-fi colony sim driven by an intelligent AI storyteller.",
    d: "A spreadsheet that generates better stories than most novels. The storyteller is always watching.",
    price: 3499, disc: 10, owned: false, inst: false, hrs: 0, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 98, 168440], art: ['#20180f', '#b07a3a', 'RW'], sc: 'nature',
    ach: [0, 0] }
];
var SG = {};
STG.forEach(function (g) { SG[g.id] = g; });

/* ── supplementary store data, merged onto SG ──
   deck: Steam Deck compatibility ['v'|'p'|'u', note]; dlc: [name, cents, disc%] */
var STEXT = {
    gtirun:   { deck: ['v', 'Verified — it IS a handheld'] },
    pitlane:  { deck: ['v', 'Verified — it IS a handheld'] },
    urequest: { deck: ['v', 'Verified — it IS a handheld'], dlc: [['The Argent Saga', 0, 0]] },
    factorio: { dlc: [['Space Age', 3500, 0], ['Elevated Rails', 800, 0]] },
    civ6:     { dlc: [['Gathering Storm', 3999, 90], ['Rise and Fall', 2999, 90]] },
    ets2:     { dlc: [['Scandinavia', 1799, 75], ['Going East!', 899, 75]] },
    witcher3: { dlc: [['Blood and Wine', 1999, 80], ['Hearts of Stone', 999, 80]] },
    assetto:  { dlc: [['Dream Pack 1', 699, 75], ['Japanese Car Pack', 699, 75]] },
    cs2:          { deck: ['u', 'Unsupported — anti-cheat'] },
    rocketleague: { deck: ['u', 'Unsupported — anti-cheat'] },
    beamng:       { deck: ['p', 'Playable — keyboard advised'] },
    cities:       { deck: ['p', 'Playable — small text'] },
    f1manager:    { deck: ['p', 'Playable — small text'] },
    dwarffortress:{ deck: ['p', 'Playable — bring reading glasses'] }
};
Object.keys(STEXT).forEach(function (k) { if (SG[k]) { var x = STEXT[k]; for (var f in x) SG[k][f] = x[f]; } });

/* curators — matched by tag overlap */
var SCUR = [
    ['The Optimization Zone', ['Automation', 'Strategy', 'Management', 'Base Building', 'Optimization', 'Colony Sim', '4X'], "We measured. It is optimal."],
    ['Absurdist Games Weekly', ['Absurdist', 'Detective', 'Choices Matter', 'Meta', 'Dystopian'], "Meaningless, and therefore essential."],
    ['Rice FSAE Sim Rig', ['Racing', 'Driving', 'Automobile Sim', 'Cars', 'Sports'], "Approved for rig night."],
    ['Pocket Pixel Reviews', ['Pixel Graphics', 'Arcade', 'Roguelike', 'Platformer', 'Card Game'], "Fits in 160×144 of your heart."],
    ['The Long Rest Book Club', ['RPG', 'Story Rich', 'Dungeons & Dragons', 'Dark Fantasy', 'Turn-Based'], "Our DM cried. Ten out of ten."]
];
function stCurator(g) {
    for (var i = 0; i < SCUR.length; i++) { var c = SCUR[i]; if (g.tags.some(function (t) { return c[1].indexOf(t) >= 0; })) return c; }
    return null;
}

/* friends' canned chat lines */
var SCHAT = {
    throttle_body: ["dude the new GTI RUN update is so good", "wanna run laps later?", "argent looking CLEAN in the last pic 🔧"],
    nat20nate: ["you DMing saturday?", "my bard just seduced the lich. again.", "roll initiative"],
    spaghetti_bus: ["the bus. it grew.", "3200 SPM and climbing", "sleep is a bottleneck, isaac"],
    pit_boss: ["box box box", "that undercut call was filthy", "tyres were DONE"],
    chamomile: ["tea?", "you've been on the computer for four hours", "hydrate"],
    the_thresher: ["deadline is friday, photos due thursday", "got the shot. front page."],
    fsae_treasury: ["invoice approved", "we can afford exactly one (1) wing"],
    _: ["hey", "gg", "one more?"]
};

/* points shop catalogue */
var SPTS = [
    { id: 'fr_gold', n: 'Pixel Gold Frame', c: 1200, k: 'frame', v: '#e0c34a' },
    { id: 'fr_red', n: 'URE Red Frame', c: 1500, k: 'frame', v: '#d81e05' },
    { id: 'fr_blue', n: 'Bloom Blue Frame', c: 1000, k: 'frame', v: '#3a9bff' },
    { id: 'fr_dmg', n: 'DMG Green Frame', c: 800, k: 'frame', v: '#9bbc0f' },
    { id: 'bg_gtirun', n: 'GTI RUN Profile Background', c: 2000, k: 'bg', v: 'gtirun' },
    { id: 'bg_bg3', n: "Baldur's Gate 3 Background", c: 2000, k: 'bg', v: 'bg3' },
    { id: 'bg_factorio', n: 'Factorio Profile Background', c: 2000, k: 'bg', v: 'factorio' },
    { id: 'bg_hades', n: 'Hades Profile Background', c: 2000, k: 'bg', v: 'hades' },
    { id: 'av_anim', n: 'Animated URE Avatar', c: 3000, k: 'gag' }
];

/* shared review flavour for store pages without custom blurbs */
var SREV = [
  ["Ran it on a potato. Ran beautifully.", 1, "12.4 hrs on record"],
  ["Came for the mechanics, stayed for the existential dread.", 1, "203.1 hrs on record"],
  ["My wallet says no. My library says yes.", 1, "0.3 hrs on record"],
  ["10/10 would optimize again.", 1, "512.7 hrs on record"],
  ["Not enough cars. (There are four hundred cars.)", 1, "88.2 hrs on record"],
  ["Told myself one more turn. It is now dawn.", 1, "141.9 hrs on record"]
];
/* fake friends for the community tab */
var SFR = [
  ['throttle_body', 'In-Game', 'GTI RUN', 'gtirun'],
  ['nat20nate', 'In-Game', "Baldur's Gate 3", 'bg3'],
  ['pit_boss', 'Online', '', ''],
  ['spaghetti_bus', 'In-Game', 'Factorio', 'factorio'],
  ['chamomile', 'Away', 'idle 22m', ''],
  ['the_thresher', 'Online', '', ''],
  ['fsae_treasury', 'Snooze', 'idle 1h', ''],
  ['critfail_kelsey', 'Offline', 'Last online 3 hrs ago', ''],
  ['argent_owner', 'Offline', 'Last online 1 day ago', '']
];

/* ── prices ── */
function stFinal(g) { return Math.round(g.price * (1 - (g.disc || 0) / 100)); }
function stPrice(c) { return c === 0 ? 'Free' : '$' + (c / 100).toFixed(2); }
function stRevClass(pct) { return pct >= 80 ? 'pos' : pct >= 40 ? 'mix' : 'neg'; }

/* ── persistence: owned / installed / wishlist / cart / stats ── */
function sjGet(k, d) { try { var v = JSON.parse(recall('steam_' + k, 'null')); return v == null ? d : v; } catch (e) { return d; } }
function sjSet(k, v) { store('steam_' + k, JSON.stringify(v)); }
function stSeed() {
    var fsDirty = false;                  // any 'inst' write here changes steamapps/common: redraw Explorer once at the end
    if (recall('steam_owned', null) == null) {
        sjSet('owned', STG.filter(function (g) { return g.owned; }).map(function (g) { return g.id; }));
        sjSet('inst', STG.filter(function (g) { return g.owned && g.inst; }).map(function (g) { return g.id; }));
        sjSet('wish', ['eldenring', 'cities', 'obradinn', 'dysonsphere', 'rimworld']);
        sjSet('cart', []);
        sjSet('hrs', sjGet('hrs', {}));   // don't wipe hours a desktop game banked before Steam first opened
        store('steam_wishv2', '1');
        store('steam_instv2', '1');       // fresh seeds are already installed=playable
        fsDirty = true;
    } else {
        // catalogue grew: fold any new default-owned games into an existing save
        var o = stOwned(), n = stInst(), ch = false;
        STG.forEach(function (g) {
            if (g.owned && o.indexOf(g.id) < 0) { o.push(g.id); ch = true; }
            if (g.owned && g.inst && n.indexOf(g.id) < 0) { n.push(g.id); ch = true; }
        });
        if (ch) { sjSet('owned', o); sjSet('inst', n); fsDirty = true; }
        if (recall('steam_wishv2', null) == null) {                       // one-shot: v2's new wishlist seeds, unless already bought
            var w = stWish();
            ['obradinn', 'dysonsphere', 'rimworld'].forEach(function (id) { if (w.indexOf(id) < 0 && o.indexOf(id) < 0) w.push(id); });
            sjSet('wish', w); store('steam_wishv2', '1');
        }
        if (recall('steam_instv2', null) == null) {
            // one-shot: installed now means PLAYABLE. games with a real build
            // (app: runs in a window, launch: runs on the URE BOY) land on the
            // disk; the shelf games keep their hours and achievements in the
            // library but lose their pretend installs. installs the user makes
            // afterward stick — this runs once.
            var play = STG.filter(function (g) { return g.app || g.launch; }).map(function (g) { return g.id; });
            var o2 = stOwned(), n2 = stInst().filter(function (id) { return play.indexOf(id) >= 0; });
            play.forEach(function (id) {
                if (o2.indexOf(id) < 0) o2.push(id);
                if (n2.indexOf(id) < 0) n2.push(id);
            });
            sjSet('owned', o2); sjSet('inst', n2);
            // owned games don't sit on wishlists (stCheckout's rule): the grant
            // above can land on a wished game, and owned store pages hide the
            // wishlist toggle, so a stale row would be stuck there forever
            sjSet('wish', stWish().filter(function (id) { return o2.indexOf(id) < 0; }));
            store('steam_instv2', '1');
            fsDirty = true;
        }
    }
    if (recall('steam_points', null) == null) store('steam_points', '4120');
    if (fsDirty) refreshFileViews();      // an Explorer opened before Steam sees the folders appear
}
function stPts() { return +recall('steam_points', '4120') || 0; }
function stPtsOwned() { return sjGet('pshop', []); }
function stPtsBuy(item) {
    var owned = stPtsOwned();
    if (owned.indexOf(item.id) < 0) {
        if (stPts() < item.c) return false;
        store('steam_points', String(stPts() - item.c));
        owned.push(item.id); sjSet('pshop', owned);
    }
    if (item.k === 'frame') store('steam_frame', item.v);
    if (item.k === 'bg') store('steam_bg', item.v);
    return true;
}
function stOwned() { return sjGet('owned', []); }
function stInst() { return sjGet('inst', []); }
function stWish() { return sjGet('wish', []); }
function stCart() { return sjGet('cart', []); }
function isOwned(id) { return stOwned().indexOf(id) >= 0; }
function isInst(id) { return stInst().indexOf(id) >= 0; }
function isWished(id) { return stWish().indexOf(id) >= 0; }
function inCart(id) { return stCart().indexOf(id) >= 0; }
function stHrs(id) { var h = sjGet('hrs', {}); var g = SG[id]; return (g.hrs || 0) + (h[id] || 0); }
function stHrs2w(id) {   // static shelf figure + real timestamped sessions from the last 14 days
    var w = sjGet('hrs2w', {})[id] || [], cut = Date.now() - 14 * 864e5;
    var live = 0; w.forEach(function (e) { if (e.t > cut) live += e.h; });
    return ((SG[id] && SG[id].hrs2w) || 0) + live;
}
function bankPlaytime(id, hrs) {   // real desktop-app sessions land on the library page (raw; round at display)
    if (!(hrs > 0)) return;
    var h = sjGet('hrs', {}); h[id] = (h[id] || 0) + hrs; sjSet('hrs', h);
    var w = sjGet('hrs2w', {}); (w[id] = w[id] || []).push({ t: Date.now(), h: hrs });
    if (w[id].length > 40) w[id] = w[id].slice(-40);
    sjSet('hrs2w', w);
    if (ST && ST.section === 'library' && ST.gid === id) {   // refresh an open Steam view so it never shows stale numbers
        if (ST.view === 'game') { ST.body.innerHTML = stLibGame(SG[id]); stPaintAll(); }
        else if (ST.view === 'ach') { ST.body.innerHTML = stAchPage(SG[id]); stPaintAll(); }
    }
}
function stGrant(id) { var o = stOwned(); if (o.indexOf(id) < 0) { o.push(id); sjSet('owned', o); } }
function stMarkInst(id) {
    var s = stInst();
    // a finished install flips when:inst:<id> — the game's folder appears under
    // C:\Program Files\Steam\steamapps\common, so any open Explorer must redraw
    if (s.indexOf(id) < 0) { s.push(id); sjSet('inst', s); refreshFileViews(); }
}

/* ═══════ procedural "screenshots" — painted crisp on a small canvas ═══════ */
function stRng(s) { s = s >>> 0; return function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function stPaint(cv) {
    var g = SG[cv.getAttribute('data-g')], seed = +cv.getAttribute('data-seed') || 1;
    var w = cv.width = 160, h = cv.height = 90, x = cv.getContext('2d'), rnd = stRng(seed * 2654435761);
    var a = g.art[0], b = g.art[1], sc = g.sc;
    function box(px, py, pw, ph, c) { x.fillStyle = c; x.fillRect(px | 0, py | 0, pw | 0, ph | 0); }
    function vgrad(top, bot, y0, y1) { var gr = x.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, top); gr.addColorStop(1, bot); x.fillStyle = gr; x.fillRect(0, y0, w, y1 - y0); }
    if (sc === 'road') {
        vgrad(b, a, 0, h * 0.62); box(0, h * 0.62, w, h * 0.38, '#12161c');
        x.fillStyle = b; x.globalAlpha = .8; x.beginPath(); x.arc(w * 0.5, h * 0.5, h * 0.14, 0, 7); x.fill(); x.globalAlpha = 1;
        x.fillStyle = '#2b2f36'; x.beginPath(); x.moveTo(w * 0.5 - 3, h * 0.6); x.lineTo(w * 0.5 + 3, h * 0.6); x.lineTo(w * 0.92, h); x.lineTo(w * 0.08, h); x.closePath(); x.fill();
        for (var i = 0; i < 6; i++) { var t = i / 6, yy = h * 0.62 + t * h * 0.38, ww = 1 + t * 4; box(w * 0.5 - ww / 2, yy, ww, 2 + t * 3, '#e3c14a'); }
        for (var s2 = 0; s2 < 40; s2++) box(rnd() * w, rnd() * h * 0.5, 1, 1, 'rgba(255,255,255,.5)');
    } else if (sc === 'dungeon') {
        box(0, 0, w, h, a);
        for (var gx = 0; gx <= 10; gx++) { x.strokeStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.moveTo(w / 2 + (gx - 5) * 6, h * 0.55); x.lineTo(w / 2 + (gx - 5) * 26, h); x.stroke(); }
        for (var gy = 0; gy < 5; gy++) { var yy2 = h * 0.55 + gy * gy * 1.6; x.strokeStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.moveTo(0, yy2); x.lineTo(w, yy2); x.stroke(); }
        box(w * 0.14, h * 0.18, 10, h * 0.42, '#0d0f16'); box(w * 0.80, h * 0.18, 10, h * 0.42, '#0d0f16');
        var gl = x.createRadialGradient(w * 0.5, h * 0.34, 2, w * 0.5, h * 0.34, h * 0.5); gl.addColorStop(0, b); gl.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gl; x.globalAlpha = .8; x.fillRect(0, 0, w, h); x.globalAlpha = 1;
        box(w * 0.48, h * 0.24, 4, 8, b);
    } else if (sc === 'space') {
        box(0, 0, w, h, '#05070d');
        for (var st = 0; st < 90; st++) { var sx = rnd() * w, sy = rnd() * h; box(sx, sy, rnd() > .85 ? 2 : 1, 1, rnd() > .5 ? '#cfe0ff' : '#8fa6cf'); }
        x.fillStyle = b; x.beginPath(); x.arc(w * 0.66, h * 0.42, h * 0.26, 0, 7); x.fill();
        x.fillStyle = a; x.globalAlpha = .55; x.beginPath(); x.arc(w * 0.72, h * 0.36, h * 0.24, 0, 7); x.fill(); x.globalAlpha = 1;
        x.strokeStyle = b; x.lineWidth = 2; x.beginPath(); x.ellipse(w * 0.66, h * 0.42, h * 0.42, h * 0.12, -0.4, 0, 7); x.stroke();
    } else if (sc === 'factory') {
        vgrad('#1a2330', a, 0, h);
        for (var bl = 0; bl < 4; bl++) { var by = h * (0.28 + bl * 0.18); box(0, by, w, 6, '#2c3a4c'); for (var cr = 0; cr < 7; cr++) box(((cr * 26 + bl * 9 + (seed % 20)) % (w + 20)) - 10, by - 5, 8, 6, b); }
        box(w * 0.1, 0, 5, h, '#3a4a5c'); box(w * 0.7, 0, 5, h, '#3a4a5c'); box(w * 0.1, h * 0.2, w * 0.6, 4, '#48607a');
        for (var sp = 0; sp < 12; sp++) box(rnd() * w, rnd() * h * 0.3, 2, 2, 'rgba(240,200,120,.7)');
    } else if (sc === 'nature') {
        vgrad('#bfe0f0', '#e8f2d8', 0, h * 0.55);
        x.fillStyle = '#f7e07a'; x.beginPath(); x.arc(w * 0.78, h * 0.24, h * 0.12, 0, 7); x.fill();
        function hill(yy, col) { x.fillStyle = col; x.beginPath(); x.moveTo(0, h); for (var hx = 0; hx <= w; hx += 8) x.lineTo(hx, yy + Math.sin(hx * 0.05 + seed) * 6); x.lineTo(w, h); x.closePath(); x.fill(); }
        hill(h * 0.5, mixHex(b, '#7bb04a', .3)); hill(h * 0.66, b); hill(h * 0.82, a);
    } else if (sc === 'city') {
        vgrad('#12203a', a, 0, h);
        for (var st2 = 0; st2 < 60; st2++) box(rnd() * w, rnd() * h * 0.4, 1, 1, 'rgba(255,255,255,.4)');
        for (var bd = 0; bd < 12; bd++) { var bw = 8 + rnd() * 14, bh = 20 + rnd() * (h * 0.6), bx = bd * (w / 12); box(bx, h - bh, bw, bh, bd % 2 ? '#1b2a3e' : '#22384f'); for (var wnd = 0; wnd < 8; wnd++) if (rnd() > .5) box(bx + 2 + (wnd % 3) * 4, h - bh + 3 + ((wnd / 3) | 0) * 6, 2, 2, b); }
    } else if (sc === 'cards') {
        vgrad(mixHex(a, '#000000', .2), a, 0, h);                       // felt table
        var gl2 = x.createRadialGradient(w * 0.5, h * 0.4, 4, w * 0.5, h * 0.4, h * 0.9);
        gl2.addColorStop(0, 'rgba(255,240,200,.18)'); gl2.addColorStop(1, 'rgba(0,0,0,.25)');
        x.fillStyle = gl2; x.fillRect(0, 0, w, h);
        for (var cd = 0; cd < 5; cd++) {
            x.save(); x.translate(w * (0.22 + cd * 0.14), h * (0.52 + (cd % 2) * 0.06)); x.rotate((rnd() - 0.5) * 0.5);
            x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(-9, -12, 20, 26);
            x.fillStyle = '#e8e4d4'; x.fillRect(-10, -14, 20, 26);
            x.fillStyle = cd % 2 ? b : '#a0322a'; x.fillRect(-6, -10, 12, 8);
            x.fillRect(-3, 2, 6, 6); x.restore();
        }
        box(w * 0.06, h * 0.06, 14, 20, mixHex(b, '#000000', .4));      // face-down deck
        box(w * 0.08, h * 0.04, 14, 20, mixHex(b, '#000000', .2));
    } else if (sc === 'cave') {
        vgrad('#05070c', a, 0, h);
        for (var stx = 0; stx < 12; stx++) {                            // stalactites
            var sxx = stx * (w / 12) + rnd() * 6, sl = 8 + rnd() * h * 0.3;
            x.fillStyle = mixHex(a, '#000000', .45);
            x.beginPath(); x.moveTo(sxx - 5, 0); x.lineTo(sxx + 5, 0); x.lineTo(sxx, sl); x.closePath(); x.fill();
        }
        for (var rk = 0; rk < 8; rk++) {                                // floor rocks
            var rxx = rnd() * w, rh = 6 + rnd() * 14;
            x.fillStyle = mixHex(a, '#000000', .3);
            x.beginPath(); x.moveTo(rxx - 10, h); x.lineTo(rxx, h - rh); x.lineTo(rxx + 10, h); x.closePath(); x.fill();
        }
        var gl3 = x.createRadialGradient(w * 0.5, h * 0.66, 2, w * 0.5, h * 0.66, h * 0.55);
        gl3.addColorStop(0, b); gl3.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gl3; x.globalAlpha = .7; x.fillRect(0, 0, w, h); x.globalAlpha = 1;
        box(w * 0.49, h * 0.6, 3, 6, '#fff');                           // the little explorer
        for (var gm = 0; gm < 14; gm++) box(rnd() * w, rnd() * h, 1, 1, b);
    } else if (sc === 'snow') {
        vgrad('#26304a', mixHex(a, '#ffffff', .25), 0, h);
        function peak(px2, py2, pw2, col) { x.fillStyle = col; x.beginPath(); x.moveTo(px2 - pw2, h); x.lineTo(px2, py2); x.lineTo(px2 + pw2, h); x.closePath(); x.fill(); }
        peak(w * 0.7, h * 0.10, w * 0.55, mixHex(a, '#ffffff', .1));
        peak(w * 0.3, h * 0.22, w * 0.45, a);
        peak(w * 0.55, h * 0.30, w * 0.35, mixHex(a, '#000000', .25));
        x.fillStyle = '#eef2fa';                                        // snow caps
        x.beginPath(); x.moveTo(w * 0.7 - 12, h * 0.10 + 18); x.lineTo(w * 0.7, h * 0.10); x.lineTo(w * 0.7 + 12, h * 0.10 + 18); x.closePath(); x.fill();
        x.beginPath(); x.moveTo(w * 0.3 - 10, h * 0.22 + 15); x.lineTo(w * 0.3, h * 0.22); x.lineTo(w * 0.3 + 10, h * 0.22 + 15); x.closePath(); x.fill();
        for (var fl = 0; fl < 40; fl++) box(rnd() * w, rnd() * h, 1, 1, 'rgba(255,255,255,.8)');
        box(w * 0.52, h * 0.52, 3, 4, b);                               // the climber
    } else if (sc === 'cookie') {
        vgrad(mixHex(a, '#000000', .25), a, 0, h);                      // warm bakery gloom
        for (var cr2 = 0; cr2 < 26; cr2++) box(rnd() * w, rnd() * h, rnd() > .8 ? 2 : 1, rnd() > .8 ? 2 : 1, 'rgba(217,151,58,.35)');   // crumb rain
        var ccx = w * 0.5, ccy = h * 0.52, ccr = h * 0.34;
        x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(ccx + 3, ccy + 4, ccr, 0, 7); x.fill();
        x.fillStyle = '#c9853a'; x.beginPath(); x.arc(ccx, ccy, ccr, 0, 7); x.fill();
        x.fillStyle = '#a3672a'; x.beginPath(); x.arc(ccx, ccy, ccr, 0.6, 2.8); x.lineTo(ccx, ccy); x.fill();   // shaded edge
        x.fillStyle = b; x.globalAlpha = .25; x.beginPath(); x.arc(ccx - ccr * 0.25, ccy - ccr * 0.25, ccr * 0.7, 0, 7); x.fill(); x.globalAlpha = 1;
        for (var chp = 0; chp < 9; chp++) {                             // chips
            var ca = rnd() * 6.28, cdd = rnd() * (ccr - 5);
            box(ccx + Math.cos(ca) * cdd - 2, ccy + Math.sin(ca) * cdd - 2, 4, 4, '#4a2a12');
        }
        var glc = x.createRadialGradient(ccx, ccy, 2, ccx, ccy, h * 0.7);
        glc.addColorStop(0, 'rgba(240,200,120,.25)'); glc.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = glc; x.fillRect(0, 0, w, h);
    } else {
        for (var band = 0; band < 5; band++) { x.fillStyle = band % 2 ? b : a; x.save(); x.translate(w / 2, h / 2); x.rotate(0.5); x.fillRect(-w, -h + band * (h * 0.5), w * 3, h * 0.42); x.restore(); }
        x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(w * (0.3 + (seed % 4) * 0.12), h * 0.5, h * 0.16, 0, 7); x.fill();
    }
    x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, h - 4, w, 4);
}
function mixHex(h1, h2, t) {
    var a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
    var r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t)), g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
}
function stPaintAll() { if (!ST) return; ST.root.querySelectorAll('canvas[data-g]').forEach(stPaint); }

/* ── capsule art (CSS gradient + pixel initials) ── */
function stCap(g, cls) {
    return '<span class="st-cap ' + (cls || '') + '" style="--c1:' + g.art[0] + ';--c2:' + g.art[1] + '">' +
        '<b class="st-cap-ini">' + g.art[2] + '</b><i class="st-cap-t">' + esc(g.t) + '</i></span>';
}
function stTags(g, n) { return g.tags.slice(0, n || g.tags.length).map(function (t) { return '<button class="st-tag" data-st="cat" data-id="' + esc(t) + '">' + esc(t) + '</button>'; }).join(''); }
function stDisc(g) {
    if (!g.disc) return '';
    return '<span class="st-disc"><span class="st-disc-pct">-' + g.disc + '%</span><span class="st-disc-px"><s>' + stPrice(g.price) + '</s><b>' + stPrice(stFinal(g)) + '</b></span></span>';
}

/* ═══════════════════════ Steam: shell + router ═══════════════════════ */
var ST = null;
var SMENUS = {
    Steam: [['About Steam', 'm-about'], ['Settings', 'm-settings'], ['Go Offline…', 'm-offline'], ['Exit', 'm-exit']],
    View:  [['Store', 'm-vstore'], ['Library', 'm-vlib'], ['Downloads', 'm-vdl'], ['News', 'm-vnews'], ['Friends List', 'm-vfriends']],
    Friends: [['View Friends List', 'm-vfriends'], ['Add a Friend…', 'm-addfriend'], ['Set Status: Online ✓', 'm-status']],
    Games: [['Activate a Product on Steam…', 'm-activate'], ['Add a Non-Steam Game…', 'm-nonsteam']],
    Help:  [['Steam Support', 'm-support'], ['System Information', 'm-sysinfo']]
};
var SACCT = [['View my profile', 'm-profile'], ['Account details', 'm-acctdetails'], ['Store preferences', 'm-storeprefs'], ['Sign out', 'm-signout']];
function renderSteam() {
    return '<div class="steam" id="steamRoot">' +
        '<div class="st-menu">' + Object.keys(SMENUS).map(function (m) {
            return '<button class="st-menu-b" data-st="menu" data-id="' + m + '">' + m + '</button>';
        }).join('') + '</div>' +
        '<header class="st-head">' +
          '<div class="st-headL"><button class="st-arrow" data-st="back" aria-label="Back">‹</button><button class="st-arrow dis" aria-label="Forward">›</button>' +
            '<span class="st-wm">' + ic('ic-steam', 'st-wm-ic') + '</span></div>' +
          '<nav class="st-tabs">' +
            '<button class="st-tab" data-st="nav" data-id="store">STORE</button>' +
            '<button class="st-tab" data-st="nav" data-id="library">LIBRARY</button>' +
            '<button class="st-tab" data-st="go" data-sec="community" data-view="activity">COMMUNITY</button>' +
            '<button class="st-tab" data-st="nav" data-id="community">ISAACURE</button>' +
          '</nav>' +
          '<div class="st-headR">' +
            '<button class="st-hicon" data-st="bell" aria-label="Notifications">' + gBell() + '<span class="st-badge green" id="stBellBadge" hidden>0</span></button>' +
            '<button class="st-wallet" data-st="nav" data-id="points"><span>$13.37</span></button>' +
            '<button class="st-hicon" data-st="nav" data-id="downloads" aria-label="Downloads">' + gDl() + '<span class="st-badge" id="stDlBadge" hidden>0</span></button>' +
            '<button class="st-hicon" data-st="nav" data-id="cart" aria-label="Cart">' + gCart() + '<span class="st-badge" id="stCartBadge" hidden>0</span></button>' +
            '<button class="st-av" data-st="acct" aria-label="Account menu">' + ic('ic-user') + '<span class="st-av-caret">▾</span></button>' +
          '</div>' +
        '</header>' +
        '<div class="st-sub" id="stSub"></div>' +
        '<div class="st-body" id="stBody"></div>' +
        '<footer class="st-status">' +
          '<button class="st-status-b" data-st="addgame">+ ADD A GAME</button>' +
          '<button class="st-status-dl" id="stStatusDl" data-st="nav" data-id="downloads">No downloads in queue</button>' +
          '<button class="st-status-b" data-st="friends">' + gUsers() + ' FRIENDS &amp; CHAT <b id="stFrCount"></b></button>' +
        '</footer>' +
        '<div class="st-drop" id="stDrop" hidden></div>' +
        '<div class="st-notifp" id="stNotifP" hidden></div>' +
        '<aside class="st-fpanel" id="stFPanel" hidden></aside>' +
        '<div class="st-chatw" id="stChatW" hidden></div>' +
        '<div class="st-searchdrop" id="stSearchDrop" hidden></div>' +
        '<div class="st-modal" id="stModal" hidden></div>' +
        '<div class="st-toast" id="stToast" hidden></div>' +
      '</div>';
}
function initSteam(el, id, arg) {
    stSeed();
    ST = { el: el, root: el.querySelector('#steamRoot'), sub: el.querySelector('#stSub'), body: el.querySelector('#stBody'),
           toast: el.querySelector('#stToast'), drop: el.querySelector('#stDrop'), notifp: el.querySelector('#stNotifP'),
           fpanel: el.querySelector('#stFPanel'), chatw: el.querySelector('#stChatW'), modal: el.querySelector('#stModal'),
           sdrop: el.querySelector('#stSearchDrop'),
           section: 'store', view: 'home', gid: null, cat: null, q: '', gal: 0, carou: 0,
           hist: [], carouT: 0, dlT: 0, toastT: 0, chatT: {},
           notifRead: false, chatWith: null, chats: {}, chatIdx: {}, spHist: [], libCollapse: {} };
    ST.root.addEventListener('click', stClick);
    el.addEventListener('contextmenu', stCtxMenu);        // on the window el: the title bar suppresses, the client answers
    el.addEventListener('scroll', closeBctx, true);       // real menus don't scroll along with the page
    ST.root.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') { if (e.key === 'Escape') stCloseLayers(); return; }
        if (e.target.closest('[data-search]')) { stCloseLayers(); stGo('store', 'browse', null, { cat: null, q: e.target.value }); }
        else if (e.target.closest('.st-chat-in')) stChatSend();
        else if (e.target.closest('.st-act-in')) stActivateGo();
    });
    ST.root.addEventListener('input', function (e) {
        if (e.target.closest('[data-libsearch]')) {
            var q = e.target.value.toLowerCase();
            ST.body.querySelectorAll('.st-lgrow').forEach(function (r) {
                if (r.getAttribute('data-st') !== 'lib') return;
                var n = r.querySelector('.st-lgname');
                r.style.display = (n && n.textContent.toLowerCase().indexOf(q) >= 0) ? '' : 'none';
            });
        } else if (e.target.closest('[data-search]')) stSearchDrop(e.target);
    });
    stStatus(); stSyncBadges();
    if (arg && arg.section) { stGo(arg.section, arg.view || 'home', arg.id || null); }
    else stRender();
}
function closeSteam() { if (ST) { clearInterval(ST.carouT); clearInterval(ST.dlT); clearTimeout(ST.toastT); for (var k in ST.chatT) clearTimeout(ST.chatT[k]); } ST = null; }
/* close every floating layer (menus, panels, chat stays) */
function stCloseLayers(keep) {
    ['drop', 'notifp', 'sdrop', 'modal'].forEach(function (k) { if (k !== keep && ST[k]) ST[k].hidden = true; });
    if (keep !== 'fpanel' && keep !== 'chatw') { /* friends panel + chat persist across navigation */ }
}
function steamFocus(el, arg) { if (arg && arg.section) stGo(arg.section, arg.view || 'home', arg.id || null); }

function stGo(section, view, gid, extra) {
    ST.hist.push({ section: ST.section, view: ST.view, gid: ST.gid, cat: ST.cat, q: ST.q });
    if (ST.hist.length > 40) ST.hist.shift();
    ST.section = section; ST.view = view || 'home'; ST.gid = gid || null; ST.gal = 0; ST.carou = 0;
    if (extra) { if ('cat' in extra) ST.cat = extra.cat; if ('q' in extra) ST.q = extra.q; }   // applied AFTER the history snapshot
    stRender();
}
function stBack() {
    var h = ST.hist.pop(); if (!h) return;
    ST.section = h.section; ST.view = h.view; ST.gid = h.gid; ST.cat = h.cat; ST.q = h.q; ST.gal = 0; ST.carou = 0;
    stRender();
}
function stRender() {
    clearInterval(ST.carouT); ST.carouT = 0;
    stCloseLayers();
    ST.root.querySelectorAll('.st-tab').forEach(function (t, i) {
        var on = t.getAttribute('data-id') === ST.section;
        if (t.textContent === 'ISAACURE') on = ST.section === 'community' && ST.view === 'home';
        else if (t.getAttribute('data-id') === 'community') on = ST.section === 'community' && ST.view !== 'home';
        t.classList.toggle('sel', on);
    });
    ST.sub.innerHTML = stSubHTML();
    ST.body.innerHTML = stBodyHTML();
    ST.body.scrollTop = 0;
    stPaintAll();
    stSyncBadges();
    if (ST.section === 'store' && ST.view === 'home') stStartCarousel();
    if (ST.section === 'downloads') stSpark();
}
function stSubHTML() {
    function tab(sec, view, label, cat) {
        var on = ST.section === sec && ST.view === view && (cat === undefined || ST.cat === cat);
        return '<button class="st-subtab' + (on ? ' sel' : '') + '" data-st="go" data-sec="' + sec + '" data-view="' + view + '"' + (cat ? ' data-cat="' + esc(cat) + '"' : '') + '>' + label + '</button>';
    }
    if (ST.section === 'store') {
        return '<div class="st-subL">' + tab('store', 'home', 'Your Store') + tab('store', 'browse', 'New & Noteworthy', '_new') + tab('store', 'browse', 'Categories', null) + tab('store', 'points', 'Points Shop') + tab('store', 'news', 'News') + tab('store', 'labs', 'Labs') + tab('store', 'wishlist', 'Wishlist') + '</div>' +
            '<label class="st-find"><input type="text" data-search="1" placeholder="search" spellcheck="false" value="' + esc(ST.q) + '" autocomplete="off"></label>';
    }
    if (ST.section === 'library') {
        return '<div class="st-subL">' + tab('library', 'home', 'Home') + tab('library', 'collections', 'Collections') + '<button class="st-subtab" data-st="nav" data-id="downloads">Downloads</button></div>';
    }
    if (ST.section === 'community') {
        return '<div class="st-subL">' + tab('community', 'home', 'My Profile') + tab('community', 'friends', 'Friends') + tab('community', 'activity', 'Activity') + '</div>';
    }
    if (ST.section === 'downloads') return '<div class="st-subL"><button class="st-subtab sel">Downloads</button><button class="st-subtab" data-st="go" data-sec="library" data-view="home">Library</button></div>';
    if (ST.section === 'cart') return '<div class="st-subL"><button class="st-subtab sel">Your Cart</button><button class="st-subtab" data-st="nav" data-id="store">Continue shopping</button></div>';
    return '';
}
function stBodyHTML() {
    var gg = SG[ST.gid];                                  // guard: a bad gid (dev hook, stale state) falls back to the section home
    if (ST.section === 'store') {
        if (ST.view === 'game') return gg ? stStorePage(gg) : stStoreHome();
        if (ST.view === 'browse') return stBrowse();
        if (ST.view === 'wishlist') return stWishlistView();
        if (ST.view === 'points') return stPoints();
        if (ST.view === 'news') return stNews();
        if (ST.view === 'labs') return stLabs();
        return stStoreHome();
    }
    if (ST.section === 'library') {
        if (ST.view === 'game') return gg ? stLibGame(gg) : stLibHome();
        if (ST.view === 'ach') return gg ? stAchPage(gg) : stLibHome();
        if (ST.view === 'collections') return stCollections();
        return stLibHome();
    }
    if (ST.section === 'community') {
        if (ST.view === 'friends') return stFriends();
        if (ST.view === 'activity') return stActivity();
        return stProfile();
    }
    if (ST.section === 'downloads') return stDownloads();
    if (ST.section === 'cart') return stCartView();
    return '';
}

/* ═══════════════ STORE ═══════════════ */
function stStoreHome() {
    var feat = STG.filter(function (g) { return g.feat; });
    var spec = STG.filter(function (g) { return g.spec; });
    var trend = STG.filter(function (g) { return g.trend || g.feat; }).slice(0, 8);
    var cats = ['Racing', 'RPG', 'Strategy', 'Simulation', 'Roguelike', 'Free to Play', 'Story Rich', 'Indie'];
    var h = '<div class="st-store">';
    // featured carousel
    h += '<div class="st-carou" id="stCarou">' + stSlide(feat[0]) +
        '<button class="st-carou-a prev" data-st="carou" data-dir="-1" aria-label="Previous">‹</button>' +
        '<button class="st-carou-a next" data-st="carou" data-dir="1" aria-label="Next">›</button>' +
        '<div class="st-dots" id="stDots">' + feat.map(function (g, i) { return '<button class="st-dot' + (i === 0 ? ' on' : '') + '" data-st="carou" data-i="' + i + '"></button>'; }).join('') + '</div></div>';
    // category chips
    h += '<div class="st-cats">' + cats.map(function (c) { return '<button class="st-chip" data-st="cat" data-id="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>';
    // special offers
    h += '<h3 class="st-row-h">Special Offers <span>Weekend Deal — the sale ends when Isaac says</span></h3>';
    h += '<div class="st-scroller">' + spec.map(stSpecCard).join('') + '</div>';
    // new & trending
    h += '<h3 class="st-row-h">New &amp; Trending</h3><div class="st-grid">' + trend.map(stGridCard).join('') + '</div>';
    // recommended
    h += '<h3 class="st-row-h">Because you play <b>Factorio</b></h3><div class="st-scroller">' + STG.filter(function (g) { return g.id !== 'factorio' && (g.tags.indexOf('Automation') >= 0 || g.tags.indexOf('Optimization') >= 0 || g.tags.indexOf('Base Building') >= 0 || g.tags.indexOf('Colony Sim') >= 0); }).slice(0, 8).map(stSpecCard).join('') + '</div>';
    // under $10
    h += '<h3 class="st-row-h">Under $10 <span>big games, small numbers</span></h3><div class="st-scroller">' + STG.filter(function (g) { var f = stFinal(g); return f > 0 && f < 1000; }).slice(0, 10).map(stSpecCard).join('') + '</div>';
    // free to play
    h += '<h3 class="st-row-h">Free to Play</h3><div class="st-scroller">' + STG.filter(function (g) { return g.free; }).map(stSpecCard).join('') + '</div>';
    // from URE Softworks
    h += '<h3 class="st-row-h">From <b>URE Softworks</b> <span>made upstairs</span></h3><div class="st-scroller">' + STG.filter(function (g) { return g.dev === 'URE Softworks'; }).map(stSpecCard).join('') + '</div>';
    return h + '</div>';
}
function stSlide(g) {
    var buy = isOwned(g.id) ? '<span class="st-inlib">' + gCheck() + ' In Library</span>' : '<span class="st-slide-price">' + (g.disc ? stDisc(g) : '<b>' + stPrice(stFinal(g)) + '</b>') + '</span>';
    return '<div class="st-slide" data-st="game" data-id="' + g.id + '">' +
        '<div class="st-slide-art">' + stCap(g, 'big') + '</div>' +
        '<div class="st-slide-info">' +
          '<h2>' + esc(g.t) + '</h2>' +
          '<div class="st-slide-shots">' + [1, 2, 3].map(function (n) { return '<canvas class="st-shot sm" data-g="' + g.id + '" data-seed="' + (n + 3) + '"></canvas>'; }).join('') + '</div>' +
          '<p>' + esc(g.s) + '</p>' +
          '<div class="st-slide-tags">' + g.tags.slice(0, 4).map(function (t) { return '<span class="st-tag flat">' + esc(t) + '</span>'; }).join('') + '</div>' +
          buy +
        '</div></div>';
}
function stStartCarousel() {
    var feat = STG.filter(function (g) { return g.feat; });
    if (feat.length < 2 || reduce) return;
    ST.carouT = setInterval(function () { ST.carou = (ST.carou + 1) % feat.length; stShowSlide(); }, 6500);
}
function stShowSlide() {
    var feat = STG.filter(function (g) { return g.feat; }), car = ST.body.querySelector('#stCarou'); if (!car) return;
    ST.carou = (ST.carou + feat.length) % feat.length;
    car.querySelector('.st-slide').outerHTML = stSlide(feat[ST.carou]);
    var dots = ST.body.querySelectorAll('#stDots .st-dot');
    dots.forEach(function (d, i) { d.classList.toggle('on', i === ST.carou); });
    car.querySelectorAll('canvas[data-g]').forEach(stPaint);
}
function stSpecCard(g) {
    return '<button class="st-scard" data-st="game" data-id="' + g.id + '">' +
        '<canvas class="st-shot" data-g="' + g.id + '" data-seed="1"></canvas>' +
        '<span class="st-scard-t">' + esc(g.t) + '</span>' +
        '<span class="st-scard-tags">' + g.tags.slice(0, 3).join(', ') + '</span>' +
        '<span class="st-scard-buy">' + (g.disc ? stDisc(g) : '<b class="st-scard-px">' + stPrice(stFinal(g)) + '</b>') + '</span>' +
      '</button>';
}
function stGridCard(g) {
    var px = isOwned(g.id) ? '<span class="st-owned">In Library</span>' : g.disc ? stDisc(g) : '<b class="st-scard-px">' + stPrice(stFinal(g)) + '</b>';
    return '<button class="st-gcard" data-st="game" data-id="' + g.id + '">' +
        '<canvas class="st-shot" data-g="' + g.id + '" data-seed="2"></canvas>' +
        '<span class="st-gcard-b"><span class="st-scard-t">' + esc(g.t) + '</span>' +
        '<span class="st-rev ' + stRevClass(g.rev[1]) + '">' + g.rev[0] + '</span>' + px + '</span></button>';
}
/* deterministic pseudo-random per game+index, for histograms/global % */
function stHash(id, i) { var n = 0; for (var c = 0; c < id.length; c++) n = (n * 31 + id.charCodeAt(c)) | 0; n = Math.abs(n + i * 2654435761); return (n % 1000) / 1000; }
function stHistogram(g) {
    var bars = '';
    for (var i = 0; i < 12; i++) {
        var hgt = 22 + stHash(g.id, i) * 78;
        var pos = clamp(g.rev[1] + (stHash(g.id, i + 40) - 0.5) * 18, 5, 98);
        bars += '<span class="st-hist-b" style="height:' + hgt.toFixed(0) + '%"><i style="height:' + pos.toFixed(0) + '%"></i></span>';
    }
    return '<div class="st-hist" title="Reviews over time (museum data)">' + bars + '</div>';
}
function stDeckBadge(g) {
    var d = g.deck || ['v', 'Verified'];
    var label = d[0] === 'v' ? 'Verified' : d[0] === 'p' ? 'Playable' : 'Unsupported';
    return '<div class="st-deck ' + d[0] + '">' + gDeck() + '<span><b>Steam Deck ' + label + '</b><i>' + esc(d[1]) + '</i></span></div>';
}
function stStorePage(g) {
    var owned = isOwned(g.id), inst = isInst(g.id);
    var main = '<div class="st-sp-gal"><canvas class="st-sp-main" id="stGalMain" data-g="' + g.id + '" data-seed="' + (ST.gal + 1) + '"></canvas>' +
        '<div class="st-sp-thumbs">' + [0, 1, 2, 3, 4].map(function (i) { return '<canvas class="st-sp-th' + (i === ST.gal ? ' sel' : '') + '" data-st="shot" data-i="' + i + '" data-g="' + g.id + '" data-seed="' + (i + 1) + '"></canvas>'; }).join('') + '</div></div>';
    var dl = stInQueue(g.id);
    var buyBtn;
    if (dl) buyBtn = '<button class="st-play dis">' + gDl() + ' Installing… ' + Math.floor(dl.pct) + '%</button>';
    else if (owned) buyBtn = inst ? '<button class="st-play" data-st="play" data-id="' + g.id + '">' + gPlay() + ' Play</button>' : '<button class="st-play" data-st="install" data-id="' + g.id + '">' + gDl() + ' Install</button>';
    else if (g.free) buyBtn = '<button class="st-play" data-st="install" data-id="' + g.id + '">' + gDl() + ' Install Game</button>';
    else if (inCart(g.id)) buyBtn = '<button class="st-buy incart" data-st="nav" data-id="cart">' + gCart() + ' In Cart — View</button>';
    else buyBtn = '<button class="st-buy" data-st="addcart" data-id="' + g.id + '">' + gCart() + ' Add to Cart</button>';
    var wishBtn = owned ? '' : '<button class="st-ghost" data-st="wish" data-id="' + g.id + '">' + (isWished(g.id) ? '✓ On Wishlist' : '+ Wishlist') + '</button>';
    var revs = (g.revx || SREV.slice(0, 2)).map(function (r, i) {
        var helpful = 3 + Math.floor(stHash(g.id, i + 7) * 400), funny = Math.floor(stHash(g.id, i + 13) * 60);
        return '<div class="st-review"><div class="st-review-h"><span class="st-review-v ' + (r[1] ? 'up' : 'down') + '">' + (r[1] ? gThumb() + ' Recommended' : 'Not Recommended') + '</span><span class="st-review-hrs">' + esc(r[2]) + '</span></div><p>“' + esc(r[0]) + '”</p>' +
            '<div class="st-review-f"><span>' + helpful + ' people found this helpful' + (funny ? ' · ' + funny + ' found it funny' : '') + '</span><span class="st-award">' + gStar() + (1 + Math.floor(stHash(g.id, i + 21) * 5)) + '</span></div></div>';
    }).join('');
    var sys = [['OS', 'UreOS 11 Pixel Edition or newer'], ['Processor', 'Bloom Core @ 60fps'], ['Memory', '640 KB RAM'], ['Graphics', 'Canvas 2D, pixelated'], ['Storage', 'a corner of localStorage'], ['Notes', 'Thumbs supported']];
    var like = STG.filter(function (o) { return o.id !== g.id && o.tags.some(function (t) { return g.tags.indexOf(t) >= 0; }); }).slice(0, 4);
    var fromDev = STG.filter(function (o) { return o.id !== g.id && o.dev === g.dev; });
    var cur = stCurator(g);
    var dlc = '';
    if (g.dlc && g.dlc.length) {
        dlc = '<h3 class="st-sp-h">Content for this game</h3><div class="st-dlc">' + g.dlc.map(function (d) {
            var final = Math.round(d[1] * (1 - (d[2] || 0) / 100));
            return '<div class="st-dlc-row"><b>' + esc(g.t) + ' — ' + esc(d[0]) + '</b>' +
                '<span class="st-dlc-px">' + (d[2] ? '<span class="st-disc-pct">-' + d[2] + '%</span><s>' + stPrice(d[1]) + '</s>' : '') + '<b>' + stPrice(final) + '</b></span>' +
                '<button class="st-ghost sm" data-st="dlcbuy" data-id="' + g.id + '">Add</button></div>';
        }).join('') + '</div>';
    }
    var tagsN = 5, hasMore = g.tags.length > tagsN;
    return '<div class="st-sp">' +
        '<div class="st-sp-crumb"><button data-st="nav" data-id="store">All Games</button> › <button data-st="cat" data-id="' + esc(g.tags[0]) + '">' + esc(g.tags[0]) + '</button> › <span>' + esc(g.t) + '</span></div>' +
        '<h1 class="st-sp-title">' + esc(g.t) + '</h1>' +
        '<div class="st-sp-cols">' +
          '<div class="st-sp-main-col">' + main +
            '<div class="st-sp-desc"><h4 class="st-sp-about">ABOUT THIS GAME</h4><p>' + esc(g.d) + '</p><p class="st-sp-short2">' + esc(g.s) + '</p></div>' +
            '<div class="st-sp-tagh">Popular user-defined tags for this product:</div>' +
            '<div class="st-sp-tags" id="stTagWrap">' + stTags(g, tagsN) + (hasMore ? '<button class="st-tag more" data-st="tagsall">+</button>' : '') + '</div>' +
            (cur ? '<div class="st-curator">' + gUsers() + '<span><b>' + esc(cur[0]) + '</b> — a curator you follow — says: <i>“' + esc(cur[2]) + '”</i></span></div>' : '') +
          '</div>' +
          '<aside class="st-sp-side">' + stCap(g, 'side') +
            '<p class="st-sp-short">' + esc(g.s) + '</p>' +
            '<div class="st-sp-meta"><div class="st-rev big ' + stRevClass(g.rev[1]) + '"><b>' + g.rev[0] + '</b><span>' + g.rev[2].toLocaleString() + ' reviews · ' + g.rev[1] + '% positive</span><span class="st-rev-bar"><i style="width:' + g.rev[1] + '%"></i></span></div>' +
              '<dl class="st-facts"><dt>Release</dt><dd>' + g.yr + '</dd><dt>Developer</dt><dd><button class="st-link sm" data-st="devsearch" data-id="' + esc(g.dev) + '">' + esc(g.dev) + '</button></dd><dt>Publisher</dt><dd>' + esc(g.pub) + '</dd></dl></div>' +
            stDeckBadge(g) +
            '<div class="st-buybox"><div class="st-buybox-h">' + (owned ? 'In your library' : g.free ? 'Play ' + esc(g.t) : 'Buy ' + esc(g.t)) + (g.disc && !owned ? '<span class="st-disc-flag">-' + g.disc + '%</span>' : '') + '</div>' +
              '<div class="st-buybox-b">' + (owned ? '' : '<span class="st-buybox-px">' + (g.disc ? '<s>' + stPrice(g.price) + '</s> ' : '') + '<b>' + stPrice(stFinal(g)) + '</b></span>') + buyBtn + '</div>' + (wishBtn ? '<div class="st-buybox-f">' + wishBtn + '</div>' : '') +
            '</div>' +
          '</aside>' +
        '</div>' +
        dlc +
        '<div class="st-sp-revhead"><h3 class="st-sp-h">Recent Reviews</h3>' + stHistogram(g) + '</div><div class="st-reviews">' + revs + '</div>' +
        '<h3 class="st-sp-h">System Requirements</h3><div class="st-sys">' + sys.map(function (s) { return '<div class="st-sys-row"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('') + '</div>' +
        (fromDev.length ? '<h3 class="st-sp-h">More from ' + esc(g.dev) + '</h3><div class="st-scroller">' + fromDev.map(stSpecCard).join('') + '</div>' : '') +
        '<h3 class="st-sp-h">More like this</h3><div class="st-grid">' + like.map(stGridCard).join('') + '</div>' +
      '</div>';
}
function stBrowse() {
    var cat = ST.cat, q = ST.q;
    var list = STG.filter(function (g) {
        if (q) return (g.t + ' ' + g.tags.join(' ') + ' ' + g.dev).toLowerCase().indexOf(q.toLowerCase()) >= 0;
        if (cat && cat !== '_new') return g.tags.indexOf(cat) >= 0;
        return true;
    });
    if (!q && cat === '_new') list = list.slice().sort(function (a, b) { return b.yr - a.yr; });
    var title = q ? 'Search: “' + esc(q) + '”' : cat === '_new' ? 'New & Noteworthy' : cat ? esc(cat) : 'All Games';
    var allcats = {};
    STG.forEach(function (g) { g.tags.forEach(function (t) { allcats[t] = (allcats[t] || 0) + 1; }); });
    var chips = Object.keys(allcats).sort().map(function (t) { return '<button class="st-chip' + (t === cat ? ' on' : '') + '" data-st="cat" data-id="' + esc(t) + '">' + esc(t) + ' <i>' + allcats[t] + '</i></button>'; }).join('');
    return '<div class="st-browse"><div class="st-browse-side"><h4>Narrow by tag</h4><div class="st-chipcol">' + chips + '</div></div>' +
        '<div class="st-browse-main"><h2 class="st-browse-h">' + title + ' <span>' + list.length + ' result' + (list.length === 1 ? '' : 's') + '</span></h2>' +
        '<div class="st-list">' + (list.length ? list.map(stListRow).join('') : '<p class="st-empty">Nothing here. Isaac has a small but tasteful catalogue.</p>') + '</div></div></div>';
}
function stListRow(g) {
    var px = isOwned(g.id) ? '<span class="st-owned">In Library</span>' : g.disc ? stDisc(g) : '<b class="st-scard-px">' + stPrice(stFinal(g)) + '</b>';
    return '<button class="st-lrow" data-st="game" data-id="' + g.id + '">' +
        '<canvas class="st-lrow-art" data-g="' + g.id + '" data-seed="2"></canvas>' +
        '<span class="st-lrow-b"><b>' + esc(g.t) + '</b><span class="st-lrow-tags">' + g.tags.slice(0, 4).join(', ') + '</span>' +
        '<span class="st-rev ' + stRevClass(g.rev[1]) + '">' + g.rev[0] + ' · ' + g.rev[2].toLocaleString() + '</span></span>' +
        '<span class="st-lrow-px">' + px + '</span></button>';
}
function stWishlistView() {
    var ids = stWish(), list = ids.map(function (i) { return SG[i]; }).filter(Boolean);
    if (!list.length) return '<div class="st-pad"><h2 class="st-browse-h">Your Wishlist</h2><p class="st-empty">Your wishlist is empty. Add games from any store page.</p></div>';
    return '<div class="st-pad"><h2 class="st-browse-h">Your Wishlist <span>' + list.length + ' item' + (list.length === 1 ? '' : 's') + '</span></h2><div class="st-list">' + list.map(stListRow).join('') + '</div></div>';
}
function stPoints() {
    var owned = stPtsOwned(), fr = recall('steam_frame', ''), bg = recall('steam_bg', '');
    var items = SPTS.map(function (it) {
        var own = owned.indexOf(it.id) >= 0;
        var eq = (it.k === 'frame' && it.v === fr) || (it.k === 'bg' && it.v === bg) || (it.k === 'gag' && own);
        var art = it.k === 'bg' ? '<canvas class="st-shot" data-g="' + it.v + '" data-seed="7"></canvas>'
                : it.k === 'frame' ? '<span class="st-pts-frame" style="--fc:' + it.v + '">' + ic('ic-user') + '</span>'
                : '<span class="st-pts-frame anim">' + ic('ic-ure') + '</span>';
        var btn = eq ? '<b class="st-owned">' + (it.k === 'gag' ? 'Owned. It blinks.' : 'Equipped') + '</b>'
                : own ? '<button class="st-ghost sm" data-st="ptsbuy" data-id="' + it.id + '">Equip</button>'
                : '<button class="st-ghost sm" data-st="ptsbuy" data-id="' + it.id + '">' + gStar() + ' ' + it.c.toLocaleString() + '</button>';
        return '<div class="st-gcard static st-pts-i" data-pts="' + it.id + '">' + art + '<span class="st-gcard-b"><span class="st-scard-t">' + esc(it.n) + '</span><span class="st-pts-row">' + btn + '</span></span></div>';
    }).join('');
    return '<div class="st-pad st-points"><h2 class="st-browse-h">Points Shop</h2>' +
        '<div class="st-points-bal">' + gStar() + ' <b>' + stPts().toLocaleString() + '</b> points <span class="st-pts-hint">earned by existing. spent on looking good.</span></div>' +
        '<h4 class="st-dl-h">Avatar Frames &amp; Profile Backgrounds <i>equipping actually restyles your profile</i></h4>' +
        '<div class="st-grid">' + items + '</div></div>';
}

/* ═══════════════ LIBRARY ═══════════════ */
function stLibRow(g) {
    var status = isInst(g.id) ? (g.hrs2w > 0 ? 'ready' : 'installed') : 'notinst';
    var sel = ST.gid === g.id && (ST.view === 'game' || ST.view === 'ach');
    return '<button class="st-lgrow' + (sel ? ' sel' : '') + '" data-st="lib" data-id="' + g.id + '">' +
        '<span class="st-lgchip" style="background:linear-gradient(135deg,' + g.art[0] + ',' + g.art[1] + ')"></span>' +
        '<span class="st-lgname' + (status === 'notinst' ? ' dim' : '') + '">' + esc(g.t) + '</span>' +
        (g.hrs2w > 0 && isInst(g.id) ? '<span class="st-lgdot ready"></span>' : '') + '</button>';
}
function stLibSidebar() {
    var owned = STG.filter(function (g) { return isOwned(g.id); });
    owned.sort(function (a, b) { return stHrs(b.id) - stHrs(a.id); });
    var favs = owned.filter(function (g) { return (g.hrs2w || 0) >= 2; });
    var rest = owned.filter(function (g) { return (g.hrs2w || 0) < 2; });
    function section(key, label, games) {
        var closed = !!ST.libCollapse[key];
        return '<button class="st-lg-head tgl" data-st="libsec" data-id="' + key + '"><i class="st-lg-arr">' + (closed ? '▸' : '▾') + '</i>' + label + ' <i>' + games.length + '</i></button>' +
            (closed ? '' : games.map(stLibRow).join(''));
    }
    return '<aside class="st-lib-side"><label class="st-lib-find"><input type="text" placeholder="Search library" spellcheck="false" data-libsearch="1"></label>' +
        '<div class="st-lib-col">' +
        '<button class="st-lgrow' + (ST.view === 'home' ? ' sel' : '') + '" data-st="go" data-sec="library" data-view="home"><span class="st-lgdot home"></span><span class="st-lgname">Home</span></button>' +
        section('fav', 'Favorites', favs) +
        section('all', 'All Games', rest) +
        '</div></aside>';
}
function stLibHome() {
    var owned = STG.filter(function (g) { return isOwned(g.id); });
    /* recent = actually recent: a real session banked by bankPlaytime (cookie,
       terraria) outranks every static shelf figure, newest first; the shelf
       hours only order the games you haven't touched on THIS machine */
    var w2 = sjGet('hrs2w', {});
    function lastPlayed(id) { var s = w2[id] || [], m = 0; for (var i = 0; i < s.length; i++) if (s[i].t > m) m = s[i].t; return m; }
    var recent = owned.slice().sort(function (a, b) {
        return (lastPlayed(b.id) - lastPlayed(a.id)) || ((b.hrs2w || 0) - (a.hrs2w || 0));
    }).slice(0, 5);
    var acts = [
        ['throttle_body', 'earned an achievement in', 'GTI RUN', 'gtirun'],
        ['you', 'reached ' + stHrs('factorio').toFixed(0) + ' hours in', 'Factorio', 'factorio'],
        ['nat20nate', 'is now playing', "Baldur's Gate 3", 'bg3']
    ];
    var fresh = STG.filter(function (g) { return isOwned(g.id) && g.news; });
    var h = '<div class="st-lib">' + stLibSidebar() + '<div class="st-lib-main">';
    if (fresh.length) {
        h += '<h2 class="st-lib-h">What\'s New</h2><div class="st-wn">' + fresh.map(function (g) {
            return '<button class="st-wn-card" data-st="lib" data-id="' + g.id + '"><canvas class="st-shot" data-g="' + g.id + '" data-seed="6"></canvas>' +
                '<span class="st-wn-b"><i>' + esc(g.t) + (g.news[0][2] ? ' · ' + esc(g.news[0][2]) : '') + '</i><b>' + esc(g.news[0][0]) + '</b><span class="st-wn-p">' + esc(g.news[0][1]) + '</span></span></button>';
        }).join('') + '</div>';
    }
    h += '<h2 class="st-lib-h">Recent games</h2><div class="st-recent">' + recent.map(function (g) {
        return '<button class="st-rtile" data-st="lib" data-id="' + g.id + '"><div class="st-rtile-art">' + stCap(g, 'tile') + '</div>' +
            '<span class="st-rtile-play">' + gPlay() + '</span>' +
            '<span class="st-rtile-b"><b>' + esc(g.t) + '</b><i>' + (isInst(g.id) ? stHrs(g.id).toFixed(1) + ' hrs' : 'not installed') + '</i></span></button>';
    }).join('') + '</div>';
    h += '<h2 class="st-lib-h">Friend activity</h2><div class="st-feed">' + acts.map(function (a) {
        var g = SG[a[3]];
        return '<div class="st-feeditem"><canvas class="st-feed-art" data-g="' + a[3] + '" data-seed="3"></canvas>' +
            '<div class="st-feed-b"><p><b>' + esc(a[0]) + '</b> ' + esc(a[1]) + ' <button class="st-link" data-st="lib" data-id="' + a[3] + '">' + esc(a[2]) + '</button></p>' +
            '<span class="st-rev ' + stRevClass(g.rev[1]) + '">' + g.rev[0] + '</span></div></div>';
    }).join('') + '</div></div></div>';
    return h;
}
function stLibGame(g) {
    stLive(g);
    var inst = isInst(g.id), dl = stInQueue(g.id);
    var playBtn;
    if (dl) playBtn = '<button class="st-play wide dis">' + gDl() + ' Installing… ' + dl.pct + '%</button>';
    else if (inst) playBtn = '<button class="st-play wide" data-st="play" data-id="' + g.id + '">' + gPlay() + ' PLAY</button>';
    else playBtn = '<button class="st-play wide install" data-st="install" data-id="' + g.id + '">' + gDl() + ' INSTALL</button>';
    var ach = g.ach || [0, 0], pct = ach[1] ? Math.round(ach[0] / ach[1] * 100) : 0;
    var achGrid = '';
    if (ach[1]) {
        var list = (g.achx || []).slice();
        var unl = list.filter(function (a) { return a[2]; }).length;
        while (list.length < 8 && list.length < ach[1]) { var gk = unl < ach[0]; if (gk) unl++; list.push([gk ? 'Achievement ' + (list.length + 1) : 'Locked', gk ? 'Unlocked — nice.' : 'Hidden until you earn it', gk ? 1 : 0]); }
        achGrid = '<div class="st-ach"><div class="st-ach-h"><span>Achievements</span><span>' + ach[0] + ' of ' + ach[1] + ' · <button class="st-link sm" data-st="ach" data-id="' + g.id + '">View all</button></span></div>' +
            '<div class="st-ach-bar"><i style="width:' + pct + '%"></i></div>' +
            '<div class="st-ach-grid">' + list.slice(0, 8).map(function (a) {
                return '<div class="st-ach-i' + (a[2] ? '' : ' lock') + '" title="' + esc(a[1]) + '"><span class="st-ach-badge">' + (a[2] ? gStar() : '<span class="st-lockglyph"></span>') + '</span><span class="st-ach-n">' + esc(a[0]) + '</span></div>';
            }).join('') + '</div></div>';
    }
    var friends = SFR.filter(function (f) { return f[3] === g.id; });
    var friendsHTML = friends.length ? '<div class="st-lg-card"><h4>Friends who play</h4><div class="st-fplay">' + friends.map(function (f) { return '<span class="st-fchip">' + ic('ic-user') + esc(f[0]) + '</span>'; }).join('') + '</div></div>' : '';
    var news = g.news || [[g.t + ' — you own this', "It's in your library and ready when you are.", '']];
    var newsHTML = '<div class="st-lg-card"><h4>Updates &amp; News</h4>' + news.map(function (n) { return '<div class="st-news"><b>' + esc(n[0]) + '</b>' + (n[2] ? '<i>' + esc(n[2]) + '</i>' : '') + '<p>' + esc(n[1]) + '</p></div>'; }).join('') + '</div>';
    return '<div class="st-lib">' + stLibSidebar() + '<div class="st-lib-main st-lg">' +
        '<div class="st-lg-hero" style="--c1:' + g.art[0] + ';--c2:' + g.art[1] + '">' +
          '<div class="st-lg-hero-shade"></div>' +
          '<div class="st-lg-hero-in"><span class="st-lg-logo">' + esc(g.t) + '</span>' +
            '<div class="st-lg-actions">' + playBtn +
              '<div class="st-lg-stats"><span>' + (inst ? '' : g.hrs2w > 0 ? '' : '') + '</span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="st-lg-bar"><span><b>' + stHrs2w(g.id).toFixed(1) + '</b> hrs past two weeks</span><span><b>' + stHrs(g.id).toFixed(1) + '</b> hrs total</span><span>' + (inst ? 'Installed' : dl ? 'Downloading' : 'Ready to install') + '</span><span class="st-lg-dev">' + esc(g.dev) + '</span></div>' +
        '<div class="st-lg-body">' + achGrid + friendsHTML + newsHTML +
          '<div class="st-lg-card"><h4>Links</h4><div class="st-lg-links"><button class="st-ghost" data-st="game" data-id="' + g.id + '">Store Page</button>' + (g.ach && g.ach[1] ? '<button class="st-ghost" data-st="ach" data-id="' + g.id + '">Achievements (' + g.ach[0] + '/' + g.ach[1] + ')</button>' : '') + '<button class="st-ghost" data-st="hub" data-id="' + g.id + '">Community Hub</button><button class="st-ghost">☁ Cloud: synced</button></div></div>' +
        '</div></div></div>';
}
function stCollections() {
    var owned = STG.filter(function (g) { return isOwned(g.id); });
    var cols = [['Favorites', owned.filter(function (g) { return g.hrs2w > 2; })], ['Racing', owned.filter(function (g) { return g.tags.indexOf('Racing') >= 0; })], ['Made by Isaac', owned.filter(function (g) { return g.dev === 'URE Softworks'; })], ['Installed', owned.filter(function (g) { return isInst(g.id); })]];
    return '<div class="st-lib">' + stLibSidebar() + '<div class="st-lib-main"><h2 class="st-lib-h">Collections</h2>' +
        cols.map(function (c) { return '<div class="st-col"><div class="st-col-h">' + esc(c[0]) + ' <i>' + c[1].length + '</i></div><div class="st-recent">' + c[1].map(function (g) { return '<button class="st-rtile sm" data-st="lib" data-id="' + g.id + '"><div class="st-rtile-art">' + stCap(g, 'tile') + '</div><span class="st-rtile-b"><b>' + esc(g.t) + '</b></span></button>'; }).join('') + '</div></div>'; }).join('') +
        '</div></div>';
}

/* ═══════════════ COMMUNITY ═══════════════ */
function stProfile() {
    var owned = STG.filter(function (g) { return isOwned(g.id); });
    var total = owned.reduce(function (s, g) { return s + stHrs(g.id); }, 0);
    var fav = SG['bg3'];
    var badges = [['Years of Service', '2'], ['Community Ambassador', ''], ['Pixel Pioneer', ''], ['Steam Awards ’26', ''], ['URE BOY Owner', '']];
    var bgId = recall('steam_bg', ''), frame = recall('steam_frame', '');
    var heroStyle = bgId && SG[bgId] ? ' style="background:linear-gradient(120deg,' + SG[bgId].art[0] + 'ee,' + SG[bgId].art[1] + '55),linear-gradient(120deg,#1a2a3c,#16202d)"' : '';
    var avStyle = frame ? ' style="--frame:' + frame + '" class="st-prof-av framed"' : ' class="st-prof-av"';
    return '<div class="st-prof"><div class="st-prof-hero"' + heroStyle + '>' +
        '<div' + avStyle + '>' + ic('ic-ure') + '</div>' +
        '<div class="st-prof-id"><h2>Isaac Ure</h2><span class="st-prof-loc">Houston, Texas · Rice ’29</span><p class="st-prof-tag">Building a GTI, DMing on weekends, optimizing everything else.</p></div>' +
        '<div class="st-level"><span class="st-level-ring">42</span><span class="st-level-xp"><b>Level 42</b><i class="st-xpbar"><span style="width:68%"></span></i><em>680 XP to 43</em></span></div>' +
      '</div>' +
      '<div class="st-prof-grid">' +
        '<div class="st-prof-card st-showcase"><h4>Favorite Game</h4><button class="st-show-game" data-st="lib" data-id="bg3">' + stCap(fav, 'show') + '<span><b>' + esc(fav.t) + '</b><i>' + stHrs('bg3').toFixed(1) + ' hrs · ' + fav.ach[0] + '/' + fav.ach[1] + ' achievements</i></span></button></div>' +
        '<div class="st-prof-card"><h4>Stats</h4><dl class="st-facts"><dt>Games owned</dt><dd>' + owned.length + '</dd><dt>Hours on record</dt><dd>' + total.toFixed(0) + '</dd><dt>Friends</dt><dd>' + SFR.length + '</dd><dt>Steam level</dt><dd>42</dd></dl></div>' +
        '<div class="st-prof-card st-badges"><h4>Badges</h4><div class="st-badge-row">' + badges.map(function (b) { return '<span class="st-badgechip">' + gStar() + '<span>' + esc(b[0]) + (b[1] ? ' <i>' + b[1] + '</i>' : '') + '</span></span>'; }).join('') + '</div></div>' +
      '</div>' +
      '<h3 class="st-sp-h">Recent Activity</h3>' + stActivityFeed() +
    '</div>';
}
function stActivity() { return '<div class="st-pad"><h2 class="st-browse-h">Activity</h2>' + stActivityFeed() + '</div>'; }
function stActivityFeed() {
    var owned = STG.filter(function (g) { return isOwned(g.id); }).sort(function (a, b) { return (b.hrs2w || 0) - (a.hrs2w || 0); }).slice(0, 4);
    return '<div class="st-feed">' + owned.map(function (g) {
        return '<div class="st-feeditem"><canvas class="st-feed-art" data-g="' + g.id + '" data-seed="4"></canvas>' +
            '<div class="st-feed-b"><p><b>Isaac</b> played <button class="st-link" data-st="lib" data-id="' + g.id + '">' + esc(g.t) + '</button></p>' +
            '<span class="st-feed-sub">' + (g.hrs2w || 0).toFixed(1) + ' hrs in the last two weeks · ' + (g.ach ? g.ach[0] + '/' + g.ach[1] + ' achievements' : '') + '</span></div></div>';
    }).join('') + '</div>';
}
function stFriends() {
    var order = { 'In-Game': 0, 'Online': 1, 'Away': 2, 'Snooze': 3, 'Offline': 4 };
    var list = SFR.slice().sort(function (a, b) { return order[a[1]] - order[b[1]]; });
    var online = list.filter(function (f) { return f[1] !== 'Offline'; }).length;
    return '<div class="st-pad st-friends"><h2 class="st-browse-h">Friends <span>' + online + ' of ' + list.length + ' online</span></h2>' +
        '<div class="st-frlist">' + list.map(function (f) {
            var cls = f[1] === 'In-Game' ? 'ingame' : f[1] === 'Offline' ? 'off' : f[1] === 'Away' || f[1] === 'Snooze' ? 'away' : 'on';
            var sub = f[1] === 'In-Game' ? 'In-Game ' + f[2] : f[2] || f[1];
            return '<button class="st-fr ' + cls + '"' + (f[3] ? ' data-st="game" data-id="' + f[3] + '"' : '') + '><span class="st-fr-av">' + ic('ic-user') + '</span>' +
                '<span class="st-fr-b"><b>' + esc(f[0]) + '</b><i>' + esc(sub) + '</i></span><span class="st-fr-dot"></span></button>';
        }).join('') + '</div></div>';
}

/* ═══════════════ ACHIEVEMENTS PAGE ═══════════════ */
function stLive(g) {   // games that run on this desktop report their real achievements
    var api = g.live && window[g.live];
    if (api && api.steamAch) {
        var la = api.steamAch();
        g.ach = [la.n, la.total]; g.achx = la.list;
    }
}
function stAchPage(g) {
    stLive(g);
    var ach = g.ach || [0, 0], pct = ach[1] ? Math.round(ach[0] / ach[1] * 100) : 0;
    var list = (g.achx || []).slice();
    var unl = list.filter(function (a) { return a[2]; }).length;      // count real unlocks so padding matches the header
    while (list.length < Math.min(ach[1], 14)) { var gk = unl < ach[0]; if (gk) unl++; list.push([gk ? 'Achievement ' + (list.length + 1) : 'Hidden Achievement', gk ? 'Unlocked — nice.' : 'Details hidden until you earn it', gk ? 1 : 0]); }
    var rows = list.map(function (a, i) {
        var glob = clamp(88 - i * (60 / Math.max(1, list.length)) + stHash(g.id, i) * 14, 0.4, 92).toFixed(1);
        return '<div class="st-achr' + (a[2] ? '' : ' lock') + '"><span class="st-ach-badge">' + (a[2] ? gStar() : '<span class="st-lockglyph"></span>') + '</span>' +
            '<span class="st-achr-b"><b>' + esc(a[0]) + '</b><i>' + esc(a[1]) + '</i></span>' +
            '<span class="st-achr-g"><span class="st-achr-gbar"><i style="width:' + glob + '%"></i></span><i>' + glob + '% of players</i></span></div>';
    }).join('');
    return '<div class="st-lib">' + stLibSidebar() + '<div class="st-lib-main st-achpage">' +
        '<div class="st-achp-head"><button class="st-ghost sm" data-st="lib" data-id="' + g.id + '">‹ ' + esc(g.t) + '</button><h2 class="st-lib-h">Achievements</h2>' +
        '<span class="st-achp-sum">You\'ve unlocked <b>' + ach[0] + ' / ' + ach[1] + '</b> (' + pct + '%)</span></div>' +
        '<div class="st-ach-bar big"><i style="width:' + pct + '%"></i></div>' +
        '<div class="st-achlist">' + (ach[1] ? rows : '<p class="st-empty">This game has no achievements. It respects your time. Suspicious.</p>') + '</div>' +
        (ach[1] > list.length ? '<p class="st-empty">…plus ' + (ach[1] - list.length) + ' more the museum hasn\'t catalogued.</p>' : '') +
        '</div></div>';
}

/* ═══════════════ NEWS + LABS ═══════════════ */
var SNEWS_SITE = [
    ['isaacure.com', 'the computer is the hub now', "The pixel Windows 11 desktop keeps growing — Steam client, possessed Edge, Task View. The Game Boy stays.", 'Jul 9'],
    ['URE BOY', 'Summer update', "Three carts and counting. Cloud saves via gist. The DMG palette abides.", 'Jul 2']
];
function stNews() {
    var items = [];
    STG.forEach(function (g) { (g.news || []).forEach(function (n) { items.push({ g: g, n: n }); }); });
    var site = SNEWS_SITE.map(function (s) {
        return '<div class="st-newsrow site"><span class="st-newsart">' + ic('ic-ure') + '</span>' +
            '<div class="st-news-b"><i>' + esc(s[0]) + (s[3] ? ' · ' + esc(s[3]) : '') + '</i><b>' + esc(s[1]) + '</b><p>' + esc(s[2]) + '</p></div></div>';
    }).join('');
    var rows = items.map(function (it) {
        return '<div class="st-newsrow"><canvas class="st-newsart" data-g="' + it.g.id + '" data-seed="6"></canvas>' +
            '<div class="st-news-b"><i><button class="st-link sm" data-st="game" data-id="' + it.g.id + '">' + esc(it.g.t) + '</button>' + (it.n[2] ? ' · ' + esc(it.n[2]) : '') + '</i><b>' + esc(it.n[0]) + '</b><p>' + esc(it.n[1]) + '</p></div></div>';
    }).join('');
    return '<div class="st-pad"><h2 class="st-browse-h">News <span>your games, your site, your propaganda</span></h2><div class="st-newslist">' + rows + site + '</div></div>';
}
var SLABS_WHY = [
    "because your playtime graph looks like a cry for help",
    "because the algorithm knows about the GTI",
    "because you finished your homework (citation needed)",
    "because entropy comes for us all, but not your backlog",
    "because it pairs well with chamomile"
];
function stLabs() {
    return '<div class="st-pad st-labs"><h2 class="st-browse-h">Steam Labs <span>experiments in progress</span></h2>' +
        '<div class="st-lg-card"><h4>Experiment 042 — The URE Interactive Recommender</h4>' +
        '<p class="st-empty">A machine-learning model trained exclusively on Isaac. Ask it what to play.</p>' +
        '<button class="st-play" data-st="labsrec">RECOMMEND ME SOMETHING</button>' +
        '<div class="st-labs-out" id="stLabsOut"></div></div>' +
        '<div class="st-lg-card"><h4>Experiment 007 — Deep Dive</h4><p class="st-empty">Closed. It dove too deep.</p></div></div>';
}
function stLabsRec() {
    var owned = STG.filter(function (g) { return isOwned(g.id); });
    var g = owned[Math.floor(Math.random() * owned.length)];
    var why = SLABS_WHY[Math.floor(Math.random() * SLABS_WHY.length)];
    var out = ST.body.querySelector('#stLabsOut'); if (!out) return;
    out.innerHTML = '<button class="st-scard labs" data-st="lib" data-id="' + g.id + '"><canvas class="st-shot" data-g="' + g.id + '" data-seed="9"></canvas>' +
        '<span class="st-scard-t">' + esc(g.t) + '</span><span class="st-scard-tags">' + esc(why) + '</span></button>';
    out.querySelectorAll('canvas[data-g]').forEach(stPaint);
}

/* ═══════════════ FRIENDS PANEL + CHAT ═══════════════ */
function stFrOnline() { return SFR.filter(function (f) { return f[1] !== 'Offline'; }).length; }
function stFriendsPanel() {
    var order = { 'In-Game': 0, 'Online': 1, 'Away': 2, 'Snooze': 3, 'Offline': 4 };
    var list = SFR.slice().sort(function (a, b) { return order[a[1]] - order[b[1]]; });
    function row(f) {
        var cls = f[1] === 'In-Game' ? 'ingame' : f[1] === 'Offline' ? 'off' : f[1] === 'Away' || f[1] === 'Snooze' ? 'away' : 'on';
        var sub = f[1] === 'In-Game' ? 'Playing ' + f[2] : f[2] || f[1];
        return '<button class="st-fp-row ' + cls + '" data-st="chat" data-id="' + esc(f[0]) + '"><span class="st-fr-av">' + ic('ic-user') + '</span>' +
            '<span class="st-fr-b"><b>' + esc(f[0]) + '</b><i>' + esc(sub) + '</i></span></button>';
    }
    var on = list.filter(function (f) { return f[1] !== 'Offline'; });
    var off = list.filter(function (f) { return f[1] === 'Offline'; });
    ST.fpanel.innerHTML = '<div class="st-fp-head"><b>Friends &amp; Chat</b><button class="st-fp-x" data-st="friends">×</button></div>' +
        '<div class="st-fp-me">' + ic('ic-user') + '<span><b>Isaac Ure</b><i class="on">Online</i></span></div>' +
        '<div class="st-fp-list"><div class="st-fp-sec">ONLINE — ' + on.length + '</div>' + on.map(row).join('') +
        '<div class="st-fp-sec">OFFLINE — ' + off.length + '</div>' + off.map(row).join('') + '</div>';
}
function stChatOpen(name) {
    ST.chatWith = name;
    if (!ST.chats[name]) {
        ST.chats[name] = [];
        var f = SFR.filter(function (x) { return x[0] === name; })[0];
        if (!f || f[1] !== 'Offline') {                               // offline friends don't greet either
            var lines = SCHAT[name] || SCHAT._;
            ST.chats[name].push({ who: name, txt: lines[0] });
            ST.chatIdx[name] = 1;
        }
    }
    stChatDraw(true);
}
function stChatDraw(takeFocus) {
    var name = ST.chatWith; if (!name) { ST.chatw.hidden = true; return; }
    var f = SFR.filter(function (x) { return x[0] === name; })[0] || [name, 'Online', '', ''];
    var cls = f[1] === 'In-Game' ? 'ingame' : f[1] === 'Offline' ? 'off' : 'on';
    var msgs = (ST.chats[name] || []).map(function (m) {
        return '<div class="st-chat-m' + (m.who === 'me' ? ' me' : '') + '"><b>' + (m.who === 'me' ? 'Isaac' : esc(m.who)) + ':</b> ' + esc(m.txt) + '</div>';
    }).join('');
    // a reply can land mid-typing: keep the draft, only re-take focus if we had it
    var old = ST.chatw.querySelector('.st-chat-in');
    var draft = old ? old.value : '';
    var hadFocus = takeFocus || (old && document.activeElement === old);
    ST.chatw.hidden = false;
    ST.chatw.innerHTML = '<div class="st-chat-head ' + cls + '"><b>' + esc(name) + '</b><i>' + esc(f[1] === 'In-Game' ? 'Playing ' + f[2] : f[1]) + '</i><button class="st-fp-x" data-st="chatclose">×</button></div>' +
        '<div class="st-chat-log" id="stChatLog">' + msgs + '</div>' +
        '<div class="st-chat-inrow"><input class="st-chat-in" placeholder="Send a message…" autocomplete="off" spellcheck="false"><button class="st-ghost sm" data-st="chatsend">Send</button></div>';
    var log = ST.chatw.querySelector('#stChatLog'); log.scrollTop = log.scrollHeight;
    var inp = ST.chatw.querySelector('.st-chat-in');
    inp.value = takeFocus ? '' : draft;
    if (hadFocus) setTimeout(function () { if (ST && ST.chatw.contains(inp)) inp.focus(); }, 30);   // focus isn't motion
}
function stChatSend() {
    var name = ST.chatWith; if (!name) return;
    var inp = ST.chatw.querySelector('.st-chat-in'); if (!inp || !inp.value.trim()) return;
    ST.chats[name].push({ who: 'me', txt: inp.value.trim() });
    inp.value = '';
    stChatDraw(true);
    var f = SFR.filter(function (x) { return x[0] === name; })[0];
    if (f && f[1] === 'Offline') return;                              // offline friends don't reply
    clearTimeout(ST.chatT[name]);                                     // per-friend timers: replies survive switching chats
    ST.chatT[name] = setTimeout(function () {
        if (!ST) return;
        var lines = SCHAT[name] || SCHAT._;
        var i = (ST.chatIdx[name] || 0) % lines.length;
        ST.chats[name].push({ who: name, txt: lines[i] });
        ST.chatIdx[name] = i + 1;
        if (ST.chatWith === name) stChatDraw();                       // append regardless; redraw only if that chat is open
    }, reduce ? 150 : 900 + Math.random() * 800);
}

/* ═══════════════ NOTIFICATIONS / MENUS / MODALS ═══════════════ */
function stNotifItems() {
    var it = [];
    var w = stWish().map(function (id) { return SG[id]; }).filter(function (g) { return g && g.disc; });
    if (w[0]) it.push(['disc', w[0].t + ' is -' + w[0].disc + '% — it\'s on your wishlist', w[0].id]);
    it.push(['inv', 'throttle_body invited you to play GTI RUN', 'gtirun']);
    it.push(['ach', 'Achievement unlocked: Box Box Box (PIT LANE)', 'pitlane']);
    it.push(['sys', 'Your Steam Replay 2025 is ready. It is mostly Factorio.', null]);
    return it;
}
function stNotifToggle() {
    if (!ST.notifp.hidden) { ST.notifp.hidden = true; return; }
    stCloseLayers('notifp');
    ST.notifp.innerHTML = '<div class="st-fp-sec pad">NOTIFICATIONS</div>' + stNotifItems().map(function (n) {
        return '<button class="st-notif-i"' + (n[2] ? ' data-st="game" data-id="' + n[2] + '"' : '') + '>' +
            (n[0] === 'disc' ? gCart() : n[0] === 'inv' ? gUsers() : n[0] === 'ach' ? gStar() : gBell()) +
            '<span>' + esc(n[1]) + '</span></button>';
    }).join('');
    ST.notifp.hidden = false;
    ST.notifRead = true; stSyncBadges();
}
function stDropOpen(items, anchor) {
    stCloseLayers('drop');
    ST.dropBy = anchor;                                   // so a second click on the same anchor can toggle it closed
    var r = anchor.getBoundingClientRect(), rootR = ST.root.getBoundingClientRect();
    ST.drop.innerHTML = items.map(function (m) { return '<button class="st-drop-i" data-st="dropact" data-id="' + m[1] + '">' + esc(m[0]) + '</button>'; }).join('');
    ST.drop.style.left = Math.min(r.left - rootR.left, rootR.width - 240) + 'px';
    ST.drop.hidden = false;                               // unhide first so offsetHeight is real
    var top = r.bottom - rootR.top + 2;
    if (top + ST.drop.offsetHeight > rootR.height) top = Math.max(0, r.top - rootR.top - ST.drop.offsetHeight - 2);   // flip up (status-bar menus)
    ST.drop.style.top = top + 'px';
}
function stModalOpen(kind, gid) {
    stCloseLayers('modal');
    var inner = '';
    if (kind === 'props') {
        var pg = SG[gid], pinst = isInst(gid);
        var psz = (12 + Math.floor(stHash(gid, 5) * 600)) + ' KB';
        inner = '<h3>' + esc(pg.t) + ' — Properties</h3>' +
            '<dl class="st-facts">' +
              '<dt>Status</dt><dd>' + (pinst ? 'Installed' : stInQueue(gid) ? 'Downloading' : 'Not installed') + '</dd>' +
              '<dt>Install size</dt><dd>' + psz + ' of localStorage</dd>' +
              '<dt>App ID</dt><dd>' + stAppId(gid) + '</dd>' +
              '<dt>Developer</dt><dd>' + esc(pg.dev) + '</dd>' +
              '<dt>Build</dt><dd>' + pg.yr + ' (latest — updates are instant when nothing changes)</dd>' +
              '<dt>Playtime</dt><dd>' + stHrs(gid).toFixed(1) + ' hrs on record</dd></dl>' +
            '<label class="st-modal-row"><span>Launch options</span><b>--pixels=all --thumbs=up</b></label>' +
            '<div class="st-modal-btns"><button class="st-ghost" data-st="verify" data-id="' + gid + '">Verify integrity of game files</button><button class="st-ghost" data-st="modalclose">Close</button></div>' +
            '<p class="st-modal-out" id="stVerifyOut"></p>';
    } else if (kind === 'activate') {
        inner = '<h3>Activate a Product on Steam</h3><p>Enter your product code. Codes look like <b>URE0Y-XXXXX-XXXXX</b>.</p>' +
            '<input class="st-act-in" placeholder="URE0Y-....." autocomplete="off" spellcheck="false">' +
            '<div class="st-modal-btns"><button class="st-play" data-st="activatego">Activate</button><button class="st-ghost" data-st="modalclose">Cancel</button></div>' +
            '<p class="st-modal-out" id="stActOut"></p>';
    } else if (kind === 'about') {
        inner = '<h3>' + ic('ic-steam') + ' About Steam</h3><dl class="st-facts"><dt>Client</dt><dd>Pixel Edition</dd><dt>Built</dt><dd>isaacure.com/comp</dd><dt>Renderer</dt><dd>Canvas 2D, dithered</dd><dt>Framework</dt><dd>none. vanilla. artisanal.</dd></dl>' +
            '<div class="st-modal-btns"><button class="st-ghost" data-st="modalclose">Close</button></div>';
    } else if (kind === 'sysinfo') {
        inner = '<h3>System Information</h3><pre class="st-sysinfo">OS:       UreOS 11 Pixel Edition\nCPU:      Bloom Core @ 60fps\nRAM:      640 KB (ought to be enough)\nGPU:      Canvas 2D, pixelated\nDisplay:  ' + window.innerWidth + '×' + window.innerHeight + ' (this one)\nSteam:    the one you are looking at</pre>' +
            '<div class="st-modal-btns"><button class="st-ghost" data-st="modalclose">Close</button></div>';
    } else if (kind === 'settings') {
        inner = '<h3>Steam Settings</h3>' +
            '<label class="st-modal-row"><span>Enable Big Picture on wake</span><b>No.</b></label>' +
            '<label class="st-modal-row"><span>Download region</span><b>Houston (the good rack)</b></label>' +
            '<label class="st-modal-row"><span>Client beta participation</span><b>URE Client Beta ✓</b></label>' +
            '<label class="st-modal-row"><span>Steam Cloud</span><b>synced, allegedly</b></label>' +
            '<div class="st-modal-btns"><button class="st-ghost" data-st="modalclose">Close</button></div>';
    }
    ST.modal.innerHTML = '<div class="st-modal-card">' + inner + '</div>';
    ST.modal.hidden = false;
    if (kind === 'activate') { var ai = ST.modal.querySelector('.st-act-in'); if (ai) setTimeout(function () { ai.focus(); }, 30); }   // focus isn't motion
}
function stActivateGo() {
    var inp = ST.modal.querySelector('.st-act-in'), out = ST.modal.querySelector('#stActOut'); if (!inp || !out) return;
    var v = inp.value.trim().toUpperCase();
    if (!v) { out.textContent = 'Enter a code first.'; return; }
    if (v.indexOf('URE') >= 0) { out.textContent = 'Code accepted. You already own everything URE makes — it\'s that kind of store.'; stToast('Product activated: the warm feeling of ownership.'); }
    else out.textContent = 'Invalid product code. This museum only honors URE-codes.';
}
var SDROPACT = {
    'm-about': function () { stModalOpen('about'); },
    'm-settings': function () { stModalOpen('settings'); },
    'm-offline': function () { stToast('You are now pretending to be offline.'); },
    'm-exit': function () { closeWin('steam'); },
    'm-vstore': function () { stGo('store', 'home', null); },
    'm-vlib': function () { stGo('library', 'home', null); },
    'm-vdl': function () { stGo('downloads', 'home', null); },
    'm-vnews': function () { stGo('store', 'news', null); },
    'm-vfriends': function () { stFriendsToggle(true); },
    'm-addfriend': function () { stToast('Your friend code: URE-BOY-1. Choose wisely.'); },
    'm-status': function () { stToast('Status: Online. The green dot of honor.'); },
    'm-activate': function () { stModalOpen('activate'); },
    'm-nonsteam': function () { stToast('Every game here is a non-Steam game if you think about it.'); },
    'm-support': function () { stToast('Support ticket #0001 filed with Isaac. Response time: whenever.'); },
    'm-sysinfo': function () { stModalOpen('sysinfo'); },
    'm-profile': function () { stGo('community', 'home', null); },
    'm-acctdetails': function () { stToast("Account: it's Isaac. The details are Isaac."); },
    'm-storeprefs': function () { stToast('Preference saved: more racing games. Obviously.'); },
    'm-signout': function () { stToast('Nice try — this is Isaac\'s machine.'); }
};
function stFriendsToggle(force) {
    var open = ST.fpanel.hidden || force === true;
    if (open) { stFriendsPanel(); ST.fpanel.hidden = false; }
    else ST.fpanel.hidden = true;
}

/* ═══════════════ SEARCH AUTOCOMPLETE ═══════════════ */
function stSearchDrop(input) {
    var q = input.value.trim().toLowerCase();
    if (!q) { ST.sdrop.hidden = true; return; }
    var hits = STG.filter(function (g) { return (g.t + ' ' + g.dev).toLowerCase().indexOf(q) >= 0; }).slice(0, 6);
    if (!hits.length) { ST.sdrop.hidden = true; return; }
    ST.sdrop.innerHTML = hits.map(function (g) {
        return '<button class="st-sd-row" data-st="game" data-id="' + g.id + '">' +
            '<span class="st-lgchip" style="background:linear-gradient(135deg,' + g.art[0] + ',' + g.art[1] + ')"></span>' +
            '<span class="st-sd-t">' + esc(g.t) + '</span>' +
            '<span class="st-sd-px">' + (isOwned(g.id) ? 'In Library' : g.free ? 'Free' : stPrice(stFinal(g))) + '</span></button>';
    }).join('');
    ST.sdrop.hidden = false;
}

/* ═══════════════ CART / CHECKOUT ═══════════════ */
function stCartView() {
    var ids = stCart(), list = ids.map(function (i) { return SG[i]; }).filter(Boolean);
    if (!list.length) return '<div class="st-pad st-cart"><h2 class="st-browse-h">Your Cart</h2><div class="st-cart-empty">' + gCart() + '<p>Your cart is empty.</p><button class="st-play" data-st="nav" data-id="store">Browse the store</button></div></div>';
    var sub = list.reduce(function (s, g) { return s + stFinal(g); }, 0);
    var full = list.reduce(function (s, g) { return s + g.price; }, 0);
    return '<div class="st-pad st-cart"><h2 class="st-browse-h">Your Cart <span>' + list.length + ' item' + (list.length === 1 ? '' : 's') + '</span></h2>' +
        '<div class="st-cart-list">' + list.map(function (g) {
            return '<div class="st-cart-row"><canvas class="st-cart-art" data-g="' + g.id + '" data-seed="2"></canvas>' +
                '<div class="st-cart-info"><b>' + esc(g.t) + '</b><span class="st-rev ' + stRevClass(g.rev[1]) + '">' + g.rev[0] + '</span></div>' +
                '<div class="st-cart-px">' + (g.disc ? stDisc(g) : '<b>' + stPrice(stFinal(g)) + '</b>') + '<button class="st-cart-rm" data-st="removecart" data-id="' + g.id + '">Remove</button></div></div>';
        }).join('') + '</div>' +
        '<div class="st-cart-sum">' +
          '<div class="st-gift"><button class="st-gift-b sel" data-st="gift" data-id="me">For my account</button><button class="st-gift-b" data-st="gift" data-id="gift">This is a gift</button></div>' +
          (full !== sub ? '<div class="st-cart-line"><span>Discounts</span><b class="st-save">-' + stPrice(full - sub) + '</b></div>' : '') +
          '<div class="st-cart-line"><span>Estimated tax</span><b>$0.00</b></div>' +
          '<div class="st-cart-line total"><span>Estimated total</span><b>' + stPrice(sub) + '</b></div>' +
          '<button class="st-play wide" data-st="checkout">Continue to payment</button>' +
          '<p class="st-cart-note">Museum checkout: no card, no charge, no tax (it\'s the one perk). Games land straight in your library.</p>' +
        '</div></div>';
}
function stCheckout() {
    var ids = stCart().slice(); if (!ids.length) return;
    stOverlay('Processing your order…', true);
    setTimeout(function () {
        ids.forEach(stGrant);
        var spent = ids.reduce(function (s, i) { return s + stFinal(SG[i]); }, 0);
        var pts = spent;                                        // spent is in cents → 100 pts per dollar, like the real thing
        if (pts) store('steam_points', String(stPts() + pts));
        sjSet('cart', []);
        sjSet('wish', stWish().filter(function (i) { return ids.indexOf(i) < 0; }));
        stClearOverlay();
        stToast('Purchase complete — ' + ids.length + ' item' + (ids.length === 1 ? '' : 's') + ' added' + (pts ? ' (+' + pts.toLocaleString() + ' points)' : '') + '.');
        stGo('library', 'home', null);
    }, reduce ? 200 : 1500);
}

/* ═══════════════ DOWNLOADS ═══════════════ */
function stQueue() { return ST._q || (ST._q = []); }
function stInQueue(id) { return stQueue().filter(function (d) { return d.id === id; })[0]; }
function stInstall(id) {
    if (isInst(id) || stInQueue(id)) return;
    if (!isOwned(id)) stGrant(id);
    stQueue().push({ id: id, pct: 0, sp: 0 });
    stToast(SG[id].t + ' — added to downloads.');
    stStartDl();
    stDock(); stSyncBadges();
    /* whatever page the click came from shows the state flip right away:
       downloads gets the queue row, a game page gets its Installing… button */
    if (ST.section === 'downloads' || ST.view === 'game') stRender();
}
function stStartDl() {
    if (ST.dlT) return;
    ST.dlT = setInterval(function () {
        var q = stQueue(); if (!q.length) { clearInterval(ST.dlT); ST.dlT = 0; return; }
        var d = q[0];
        d.sp = 3 + Math.random() * 9;
        ST.spHist.push(d.sp); if (ST.spHist.length > 40) ST.spHist.shift();
        d.pct += reduce ? 100 : (4 + Math.random() * 9);
        if (d.pct >= 100) {
            d.pct = 100; stMarkInst(d.id); var done = q.shift();
            stToast(SG[done.id].t + ' — installed. Ready to play.');
            if (!q.length) { clearInterval(ST.dlT); ST.dlT = 0; }
        }
        stDock(); stSyncBadges();
        if (ST.section === 'downloads') { ST.body.innerHTML = stDownloads(); stPaintAll(); stSpark(); }
        else if (ST.section === 'library' && ST.view === 'game') {
            // only touch the DOM when it disagrees with the queue — no 420ms re-render of unrelated pages
            var dl2 = stInQueue(ST.gid), bar = ST.body.querySelector('.st-play.dis');
            if (bar && dl2) bar.innerHTML = gDl() + ' Installing… ' + Math.floor(dl2.pct) + '%';
            else if (!!bar !== !!dl2) { ST.body.innerHTML = stLibGame(SG[ST.gid]); stPaintAll(); }
        }
        else if (ST.section === 'store' && ST.view === 'game') {
            // the store page has the same Install button; give it the same live treatment
            var dl3 = stInQueue(ST.gid), bar2 = ST.body.querySelector('.st-play.dis');
            if (bar2 && dl3) bar2.innerHTML = gDl() + ' Installing… ' + Math.floor(dl3.pct) + '%';
            else if (!!bar2 !== !!dl3) { ST.body.innerHTML = stStorePage(SG[ST.gid]); stPaintAll(); }
        }
    }, reduce ? 120 : 420);
}
function stDownloads() {
    var q = stQueue();
    var installed = STG.filter(function (g) { return isInst(g.id); });
    var head = q[0];
    var active = head ? '<div class="st-dl-active"><canvas class="st-dl-art" data-g="' + head.id + '" data-seed="2"></canvas>' +
        '<div class="st-dl-info"><div class="st-dl-top"><b>' + esc(SG[head.id].t) + '</b><span>' + (head.sp || 0).toFixed(1) + ' MB/s</span></div>' +
        '<div class="st-dl-bar"><i style="width:' + head.pct + '%"></i></div>' +
        '<div class="st-dl-sub"><span>Downloading · ' + Math.floor(head.pct) + '%</span><span>' + Math.max(1, Math.round((100 - head.pct) / 6)) + 's left</span></div></div>' +
        '<canvas class="st-spark" id="stSpark" width="220" height="44"></canvas>' +
        '<button class="st-ghost" data-st="cancel" data-id="' + head.id + '">Pause</button></div>' : '<div class="st-dl-none">' + gDl() + '<p>No active downloads.</p><span>Install a game from your library or the store to see it here.</span></div>';
    var up = q.slice(1);
    return '<div class="st-pad st-dl"><h2 class="st-browse-h">Downloads</h2>' + active +
        (up.length ? '<h4 class="st-dl-h">Up Next</h4>' + up.map(function (d) { return '<div class="st-dl-q"><canvas class="st-dl-art sm" data-g="' + d.id + '" data-seed="2"></canvas><b>' + esc(SG[d.id].t) + '</b><span>Queued</span></div>'; }).join('') : '') +
        '<h4 class="st-dl-h">Ready to Play <i>' + installed.length + '</i></h4><div class="st-dl-done">' + installed.map(function (g) { return '<button class="st-dl-q done" data-st="lib" data-id="' + g.id + '"><canvas class="st-dl-art sm" data-g="' + g.id + '" data-seed="2"></canvas><b>' + esc(g.t) + '</b><span>' + gCheck() + ' Installed</span></button>'; }).join('') + '</div></div>';
}
/* the bottom status bar: download state center, friends count right */
function stStatus() {
    if (!ST) return;
    var q = stQueue(), head = q[0];
    var dl = ST.root.querySelector('#stStatusDl');
    if (dl) {
        dl.innerHTML = head
            ? gDl() + ' <b>' + esc(SG[head.id].t) + '</b> — ' + Math.floor(head.pct) + '% (' + (head.sp || 0).toFixed(1) + ' MB/s)' + (q.length > 1 ? ' · +' + (q.length - 1) + ' queued' : '')
            : 'No downloads in queue · Manage';
        dl.classList.toggle('busy', !!head);
    }
    var fc = ST.root.querySelector('#stFrCount');
    if (fc) fc.textContent = '(' + stFrOnline() + ')';
}
var stDock = stStatus;   // old name, kept for the download tick
/* sparkline of recent download speeds on the Downloads page */
function stSpark() {
    var cv = ST.body.querySelector('#stSpark'); if (!cv) return;
    var x = cv.getContext('2d'), w = cv.width, h = cv.height, d = ST.spHist;
    x.clearRect(0, 0, w, h);
    x.fillStyle = 'rgba(102,192,244,.08)'; x.fillRect(0, 0, w, h);
    if (d.length < 2) return;
    var max = Math.max.apply(null, d) || 1;
    x.beginPath();
    x.moveTo(0, h);
    for (var i = 0; i < d.length; i++) x.lineTo(i / (d.length - 1) * w, h - (d[i] / max) * (h - 6) - 2);
    x.lineTo(w, h); x.closePath();
    x.fillStyle = 'rgba(102,192,244,.25)'; x.fill();
    x.beginPath();
    for (var j = 0; j < d.length; j++) { var px = j / (d.length - 1) * w, py = h - (d[j] / max) * (h - 6) - 2; if (j) x.lineTo(px, py); else x.moveTo(px, py); }
    x.strokeStyle = '#66c0f4'; x.lineWidth = 1.5; x.stroke();
}

/* ═══════════════ launch / overlays / toasts ═══════════════ */
function stPlay(id) {
    var g = SG[id];
    if (!isInst(id)) { stInstall(id); return; }
    if (g.app) { openApp(g.app); stToast('Launching ' + g.t + '…'); return; }   // runs right here on the desktop
    if (g.launch) { teardownApps(); window.location.href = g.launch; return; }
    stOverlay('Preparing to launch ' + esc(g.t) + '…', true);
    setTimeout(function () {
        stClearOverlay();
        var h = sjGet('hrs', {}); h[id] = (h[id] || 0) + 0.1; sjSet('hrs', h);
        stToast('Played ' + g.t + '. (The real thing lives on Isaac\'s actual shelf.)');
        if (ST.section === 'library' && ST.view === 'game') { ST.body.innerHTML = stLibGame(g); stPaintAll(); }
    }, reduce ? 300 : 1600);
}
function stOverlay(msg, spin) {
    stClearOverlay();
    var ov = document.createElement('div'); ov.className = 'st-ov'; ov.id = 'stOv';
    ov.innerHTML = (spin ? '<div class="st-ov-spin"></div>' : '') + '<p>' + msg + '</p>';
    ST.root.appendChild(ov); requestAnimationFrame(function () { ov.classList.add('on'); });
}
function stClearOverlay() { var ov = ST.root.querySelector('#stOv'); if (ov) ov.remove(); }
function stToast(msg) {
    var t = ST.toast; t.textContent = msg; t.hidden = false;
    requestAnimationFrame(function () { t.classList.add('on'); });
    clearTimeout(ST.toastT); ST.toastT = setTimeout(function () { t.classList.remove('on'); setTimeout(function () { t.hidden = true; }, 300); }, 2600);
}
function stSyncBadges() {
    var c = stCart().length, d = stQueue().length, n = ST.notifRead ? 0 : stNotifItems().length;
    var cb = ST.root.querySelector('#stCartBadge'), db = ST.root.querySelector('#stDlBadge'), nb = ST.root.querySelector('#stBellBadge');
    if (cb) { cb.textContent = c; cb.hidden = !c; }
    if (db) { db.textContent = d; db.hidden = !d; }
    if (nb) { nb.textContent = n; nb.hidden = !n; }
    stStatus();
}

/* ═══════════════ one click handler to rule them all ═══════════════ */
function stClick(e) {
    var el = e.target.closest('[data-st]');
    var act = el ? el.getAttribute('data-st') : null;
    // any click that isn't opening or inside a floating layer closes the layers
    if (['menu', 'bell', 'acct', 'addgame'].indexOf(act) < 0 && !e.target.closest('.st-drop, .st-notifp, .st-searchdrop, .st-find, .st-modal-card'))
        stCloseLayers();
    if (e.target.classList && e.target.classList.contains('st-modal')) { ST.modal.hidden = true; return; }
    if (!el) return;
    var id = el.getAttribute('data-id');
    if (act === 'back') return stBack();
    if (act === 'nav') return id === 'points' ? stGo('store', 'points', null) : stGo(id, 'home', null);
    if (act === 'go') { return stGo(el.getAttribute('data-sec'), el.getAttribute('data-view'), null, { cat: el.getAttribute('data-cat') || null, q: '' }); }
    if (act === 'game') { return stGo('store', 'game', id, { q: '' }); }
    if (act === 'lib') return stGo('library', 'game', id);
    if (act === 'ach') return stGo('library', 'ach', id);
    if (act === 'cat') { return stGo('store', 'browse', null, { cat: id, q: '' }); }
    if (act === 'devsearch') { return stGo('store', 'browse', null, { cat: null, q: id }); }
    if (act === 'play') return stPlay(id);
    if (act === 'install') return stInstall(id);
    if (act === 'addcart') { var c = stCart(); if (c.indexOf(id) < 0) { c.push(id); sjSet('cart', c); } stSyncBadges(); stToast(SG[id].t + ' — added to cart.'); return stRender(); }
    if (act === 'removecart') { sjSet('cart', stCart().filter(function (x) { return x !== id; })); stSyncBadges(); return stRender(); }
    if (act === 'checkout') return stCheckout();
    if (act === 'wish') { var w = stWish(); var i = w.indexOf(id); if (i < 0) { w.push(id); stToast(SG[id].t + ' — added to wishlist.'); } else w.splice(i, 1); sjSet('wish', w); return stRender(); }
    if (act === 'cancel') { ST._q = stQueue().filter(function (d) { return d.id !== id; }); stDock(); stSyncBadges(); if (ST.section === 'downloads') stRender(); return; }
    if (act === 'carou') {
        clearInterval(ST.carouT); ST.carouT = 0;
        if (el.hasAttribute('data-i')) ST.carou = +el.getAttribute('data-i');
        else ST.carou += +el.getAttribute('data-dir');
        stShowSlide(); return stStartCarousel();
    }
    if (act === 'shot') {
        ST.gal = +el.getAttribute('data-i');
        var main = ST.body.querySelector('#stGalMain'); if (main) { main.setAttribute('data-seed', ST.gal + 1); stPaint(main); }
        ST.body.querySelectorAll('.st-sp-th').forEach(function (t, i) { t.classList.toggle('sel', i === ST.gal); });
        return;
    }
    // ── the client chrome ──
    if (act === 'menu') { if (!ST.drop.hidden && ST.dropBy === el) { ST.drop.hidden = true; return; } return stDropOpen(SMENUS[id] || [], el); }
    if (act === 'acct') { if (!ST.drop.hidden && ST.dropBy === el) { ST.drop.hidden = true; return; } return stDropOpen(SACCT, el); }
    if (act === 'dropact') { ST.drop.hidden = true; var fn = SDROPACT[id]; return fn && fn(); }
    if (act === 'bell') return stNotifToggle();
    if (act === 'friends') return stFriendsToggle();
    if (act === 'chat') { stFriendsToggle(true); return stChatOpen(id); }
    if (act === 'chatclose') { ST.chatWith = null; ST.chatw.hidden = true; return; }
    if (act === 'chatsend') return stChatSend();
    if (act === 'addgame') { if (!ST.drop.hidden && ST.dropBy === el) { ST.drop.hidden = true; return; } return stDropOpen([['Activate a Product on Steam…', 'm-activate'], ['Add a Non-Steam Game…', 'm-nonsteam'], ['Browse the Store', 'm-vstore']], el); }
    if (act === 'modalclose') { ST.modal.hidden = true; return; }
    if (act === 'activatego') return stActivateGo();
    if (act === 'labsrec') return stLabsRec();
    if (act === 'libsec') { ST.libCollapse[id] = !ST.libCollapse[id]; return stRender(); }
    if (act === 'tagsall') { var g2 = SG[ST.gid], wrap = ST.body.querySelector('#stTagWrap'); if (g2 && wrap) wrap.innerHTML = stTags(g2); return; }
    if (act === 'gift') {
        el.parentNode.querySelectorAll('.st-gift-b').forEach(function (b) { b.classList.toggle('sel', b === el); });
        if (id === 'gift') stToast('A gift? Generous. It will still end up in Isaac\'s library.');
        return;
    }
    if (act === 'ptsbuy') {
        var item = SPTS.filter(function (x) { return x.id === id; })[0]; if (!item) return;
        if (item.k === 'gag') {
            var po = stPtsOwned();
            if (po.indexOf(id) < 0) {
                if (stPts() < item.c) { stToast('Not enough points. Go earn XP. (You can\'t. That\'s the joke.)'); return; }
                store('steam_points', String(stPts() - item.c)); po.push(id); sjSet('pshop', po);
            }
            stToast('It blinks. Trust me.'); return stRender();
        }
        if (stPtsBuy(item)) { stToast(item.n + ' — equipped. Check your profile.'); return stRender(); }
        stToast('Not enough points. Go earn XP. (You can\'t. That\'s the joke.)'); return;
    }
    if (act === 'dlcbuy') return stToast('DLC is décor in this museum — admire it from here.');
    if (act === 'hub') return stToast('The Community Hub is just the friends list with extra steps.');
    if (act === 'verify') {
        var vout = ST.modal.querySelector('#stVerifyOut'); if (!vout) return;
        vout.textContent = 'Verifying…';
        setTimeout(function () { if (ST && !ST.modal.hidden) vout.textContent = 'All files validated. 0 failed. It was mostly vibes, and the vibes check out.'; }, reduce ? 150 : 900);
        return;
    }
}

/* ═══════════════ right-click — every surface answers, like the real client ═══════════════ */
function stAppId(id) { return 100000 + Math.floor(stHash(id, 3) * 899999); }   // deterministic fake AppID
function stSlug(t) { return String(t).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, ''); }
function stUninstall(id) {
    var g = SG[id];
    if (!isInst(id)) return;
    if (g.app && openWins[g.app]) { stToast(g.t + ' is running. Close it before uninstalling.'); return; }
    sjSet('inst', stInst().filter(function (x) { return x !== id; }));
    stToast(g.t + ' — uninstalled. The shelf space was imaginary, but still.');
    stSyncBadges(); stRender();
}
/* the shared game menu: library surfaces get the manage half, store surfaces get the shopping half */
function stCtxGame(e, id, inLib) {
    var g = SG[id]; if (!g) return;
    stLive(g);                                             // desktop-app games report real achievement counts
    var owned = isOwned(id), inst = isInst(id), dl = stInQueue(id);
    var items = [];
    if (owned) items.push(dl ? { k: 'noop', t: 'Installing… ' + Math.floor(dl.pct) + '%', dis: true }
        : inst ? { k: 'play', t: 'Play ' + g.t } : { k: 'inst', t: 'Install' });
    else if (g.free) items.push({ k: 'inst', t: 'Install Game' });
    else items.push(inCart(id) ? { k: 'cart', t: 'In cart — view cart' } : { k: 'add', t: 'Add to cart (' + stPrice(stFinal(g)) + ')' });
    if (!owned) items.push({ k: 'wish', t: isWished(id) ? 'Remove from wishlist' : 'Add to wishlist' });
    items.push('sep');
    if (inLib) {
        items.push({ k: 'store', t: 'View store page' });
        if (g.ach && g.ach[1]) items.push({ k: 'ach', t: 'View achievements (' + g.ach[0] + '/' + g.ach[1] + ')' });
        items.push({ k: 'fav', t: 'Add to favorites' });
        items.push('sep');
        items.push({ k: 'files', t: 'Browse local files', dis: !inst });
        items.push({ k: 'uninst', t: 'Uninstall', dis: !inst });
        items.push({ k: 'props', t: 'Properties…' });
    } else {
        items.push({ k: 'store', t: 'View store page' });
        if (owned) items.push({ k: 'inlib', t: 'View in library' });
        items.push('sep');
        items.push({ k: 'cpurl', t: 'Copy store page URL' });
    }
    openBctx(ST.root, e, items, function (a) {
        if (a === 'play') stPlay(id);
        else if (a === 'inst') stInstall(id);
        else if (a === 'add') { var c = stCart(); if (c.indexOf(id) < 0) { c.push(id); sjSet('cart', c); } stSyncBadges(); stToast(g.t + ' — added to cart.'); stRender(); }
        else if (a === 'cart') stGo('cart', 'home', null);
        else if (a === 'wish') {
            var w = stWish(), i = w.indexOf(id);
            if (i < 0) { w.push(id); stToast(g.t + ' — added to wishlist.'); } else { w.splice(i, 1); stToast(g.t + ' — removed from wishlist.'); }
            sjSet('wish', w); stRender();
        }
        else if (a === 'store') stGo('store', 'game', id, { q: '' });
        else if (a === 'inlib') stGo('library', 'game', id);
        else if (a === 'ach') stGo('library', 'ach', id);
        else if (a === 'fav') stToast('Favorites are earned in hours here, not assigned. Play more ' + g.t + '.');
        else if (a === 'files') stToast('Local files: one corner of localStorage. You are technically inside them right now.');
        else if (a === 'uninst') stUninstall(id);
        else if (a === 'props') stModalOpen('props', id);
        else if (a === 'cpurl') { setClip('https://store.steampowered.com/app/' + stAppId(id) + '/' + stSlug(g.t) + '/'); stToast('Store page URL copied.'); }
    }, 'steam');
}
function stCtxMenu(e) {
    e.preventDefault();
    if (e.target.closest('.win-caps') || !e.target.closest('#steamRoot')) { closeBctx(); return; }   // title bar: suppress, no menu
    var host = ST.root;

    var inp = e.target.closest('input, textarea');
    if (inp && !inp.readOnly && !inp.disabled) { bctxInput(host, e, inp, null, 'steam'); return; }
    if (e.target.closest('.st-modal-card')) { closeBctx(); return; }   // a modal owns its space — don't shoot menus over it
    if (e.target.closest('.st-modal')) { ST.modal.hidden = true; closeBctx(); return; }   // backdrop: dismiss like a left-click, no stray menu
    stCloseLayers();

    // — a friend: the <b> holds the name on BOTH row kinds (community rows' data-id is the GAME id) —
    var fr = e.target.closest('.st-fp-row, .st-fr');
    if (fr) {
        var name = (fr.querySelector('b') ? fr.querySelector('b').textContent : '') || fr.getAttribute('data-id');
        var f = SFR.filter(function (x) { return x[0] === name; })[0] || [name, 'Online', '', ''];
        openBctx(host, e, [
            { k: 'msg', t: 'Send message' },
            { k: 'inv', t: 'Invite to play', dis: f[1] === 'Offline' },
            { k: 'prof', t: 'View profile' },
            'sep',
            { k: 'nick', t: 'Add a nickname' },
            { k: 'block', t: 'Block all communication' }
        ], function (a) {
            if (a === 'msg') { stFriendsToggle(true); stChatOpen(name); }
            else if (a === 'inv') stToast(f[1] === 'In-Game' ? name + ' is already in ' + f[2] + '. Consider joining THEM.' : 'Invite sent. ' + name + ' typed “one more?” before it arrived.');
            else if (a === 'prof') stToast('Only Isaac has a profile in this museum. ' + name + ' prefers the mystery.');
            else if (a === 'nick') stToast('Nickname saved: “' + name + '”. Revolutionary.');
            else stToast(name + ' cannot be blocked. They are load-bearing.');
        }, 'steam');
        return;
    }

    // — a chat message —
    var msg = e.target.closest('.st-chat-m');
    if (msg) {
        var mine = msg.classList.contains('me');
        var txt = msg.textContent.replace(/^[^:]*:\s*/, '');
        openBctx(host, e, [
            { k: 'cp', t: 'Copy message' },
            { k: 'del', t: 'Delete message', dis: !mine }
        ], function (a) {
            if (a === 'cp') { setClip(txt); stToast('Copied.'); }
            else stToast('Said is said.');
        }, 'steam');
        return;
    }

    // — a Points Shop item —
    var pts = e.target.closest('[data-pts]');
    if (pts) {
        var it = SPTS.filter(function (x) { return x.id === pts.getAttribute('data-pts'); })[0];
        if (it) {
            var own = stPtsOwned().indexOf(it.id) >= 0;
            var eq = (it.k === 'frame' && it.v === recall('steam_frame', '')) || (it.k === 'bg' && it.v === recall('steam_bg', '')) || (it.k === 'gag' && own);
            var pitems = [];
            if (it.k === 'gag') pitems.push(own ? { k: 'insp', t: 'Inspect closely' } : { k: 'buy', t: 'Purchase (' + it.c.toLocaleString() + ' points)', dis: stPts() < it.c });
            else if (eq) pitems.push({k: 'uneq', t: 'Unequip' });
            else if (own) pitems.push({ k: 'eq', t: 'Equip' });
            else pitems.push({ k: 'buy', t: 'Purchase (' + it.c.toLocaleString() + ' points)', dis: stPts() < it.c });
            openBctx(host, e, pitems, function (a) {
                if (a === 'buy' && it.k === 'gag') {
                    var po = stPtsOwned();
                    if (po.indexOf(it.id) < 0 && stPts() >= it.c) { store('steam_points', String(stPts() - it.c)); po.push(it.id); sjSet('pshop', po); }
                    stToast('It blinks. Trust me.'); stRender();
                }
                else if (a === 'buy' || a === 'eq') { if (stPtsBuy(it)) { stToast(it.n + ' — equipped. Check your profile.'); stRender(); } }
                else if (a === 'uneq') { store('steam_' + (it.k === 'frame' ? 'frame' : 'bg'), ''); stToast(it.n + ' — unequipped. The profile mourns.'); stRender(); }
                else if (a === 'insp') stToast('It blinked. You saw it.');
            }, 'steam');
            return;
        }
    }

    // — downloads: the active card and queue rows (game id rides the art canvas) —
    var dlq = e.target.closest('.st-dl-active, .st-dl-q');
    if (dlq) {
        var dcv = dlq.querySelector('canvas[data-g]'), did = dcv && dcv.getAttribute('data-g');
        if (did && dlq.classList.contains('done')) { stCtxGame(e, did, true); return; }   // installed row = library game
        if (did) {
            var qhead = stQueue()[0] && stQueue()[0].id === did;
            openBctx(host, e, [
                { k: 'top', t: 'Move to top of queue', dis: qhead },
                'sep',
                { k: 'cxl', t: 'Cancel download' }
            ], function (a) {
                var q = stQueue(), qi = q.map(function (d) { return d.id; }).indexOf(did);
                if (qi < 0) return;                                   // finished while the menu was open
                if (a === 'top') q.unshift(q.splice(qi, 1)[0]);
                else { q.splice(qi, 1); stToast(SG[did].t + ' — download cancelled.'); }
                stDock(); stSyncBadges(); if (ST.section === 'downloads') stRender();
            }, 'steam');
            return;
        }
    }

    // — a cart row: the one commerce surface where right-click removal is most natural —
    var crow = e.target.closest('.st-cart-row');
    if (crow) {
        var ccv = crow.querySelector('canvas[data-g]'), cid = ccv && ccv.getAttribute('data-g');
        if (cid && SG[cid]) {
            openBctx(host, e, [
                { k: 'rm', t: 'Remove from cart' },
                'sep',
                { k: 'store', t: 'View store page' },
                { k: 'cpurl', t: 'Copy store page URL' }
            ], function (a) {
                if (a === 'rm') { sjSet('cart', stCart().filter(function (x) { return x !== cid; })); stSyncBadges(); stRender(); }
                else if (a === 'store') stGo('store', 'game', cid, { q: '' });
                else { setClip('https://store.steampowered.com/app/' + stAppId(cid) + '/' + stSlug(SG[cid].t) + '/'); stToast('Store page URL copied.'); }
            }, 'steam');
            return;
        }
    }

    // — games: library surfaces first (sidebar, tiles, feed links, the game page's own hero), then store cards —
    if (e.target.closest('.st-lg-hero, .st-lg-bar') && ST.section === 'library' && ST.gid) { stCtxGame(e, ST.gid, true); return; }
    var lib = e.target.closest('[data-st="lib"]');
    if (lib) { stCtxGame(e, lib.getAttribute('data-id'), true); return; }
    var card = e.target.closest('[data-st="game"]');
    if (card) { stCtxGame(e, card.getAttribute('data-id'), false); return; }

    // — the page itself —
    openBctx(host, e, [
        { k: 'back', t: 'Back', dis: !ST.hist.length },
        { k: 'fwd', t: 'Forward', dis: true },
        { k: 'rld', t: 'Reload page' },
        'sep',
        { k: 'cpu', t: 'Copy page URL' }
    ], function (a) {
        if (a === 'back') stBack();
        else if (a === 'rld') stRender();
        else if (a === 'cpu') { setClip('steam://open/' + ST.section + '/' + ST.view + (ST.gid ? '/' + ST.gid : '')); stToast('Page URL copied. It only resolves on this desktop.'); }
    }, 'steam');
}

/* ═════════════ Minecraft Launcher — the real thing, in pixels ═════════════
   A full replica of the unified Minecraft Launcher: rail of games on the left,
   Play / Installations / Skins / Patch Notes tabs for Java Edition, a working
   skin editor, and a launch pipeline that actually downloads versions into a
   real .minecraft tree in the sim file system (saves/, versions/, logs/,
   crash-reports/, launcher_profiles.json regenerated from live state).

   THE SEAM (for the chat building the game itself): when PLAY finishes, the
   launcher checks APPS.minecraft. If the game app is registered, it calls
   openApp('minecraft', { version, installation, skin }) — skin is
   { name, model: 'classic'|'slim', pal: [colors], rows: [16-char strings] }
   (front view, 16×32, '.' = transparent, chars index into pal). Until then a
   launch dies honestly: java.lang.ClassNotFoundException, with a crash report
   written to .minecraft/crash-reports. The game may also claim
   FS['.minecraft/saves'] — mcSyncFS only assigns that key if it is undefined.

   State lives in comp_mc_* keys: inst (installations), skins, skin (active id),
   sel (selected installation id), set (toggles), dl (downloaded version ids),
   log (last launch log), crash (last 3 crash reports). */

var MC = null;   // live view state while the window is open
function mcj(k, d) { try { var v = JSON.parse(recall('mc_' + k, 'null')); return v == null ? d : v; } catch (e) { return d; } }
function mcjSet(k, v) { store('mc_' + k, JSON.stringify(v)); }

/* —— tiny pixel-art engine: rows of chars → crisp SVG (rows share a palette) —— */
var MC_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
function pxSvg(rows, pal, cls, slice) {
    var w = rows[0].length, h = rows.length, out = [], y, x, x0, c;
    for (y = 0; y < h; y++) {
        var row = rows[y];
        for (x = 0; x < w;) {
            c = row.charAt(x);
            if (c === '.' || c === ' ' || !pal[c]) { x++; continue; }
            x0 = x;
            while (x < w && row.charAt(x) === c) x++;
            out.push('<rect x="' + x0 + '" y="' + y + '" width="' + (x - x0) + '" height="1" fill="' + pal[c] + '"/>');
        }
    }
    return '<svg class="mcl-px' + (cls ? ' ' + cls : '') + '" viewBox="0 0 ' + w + ' ' + h + '"' +
        (slice ? ' preserveAspectRatio="xMidYMid slice"' : '') + ' shape-rendering="crispEdges" aria-hidden="true">' + out.join('') + '</svg>';
}
function mcPalMap(arr) { var m = {}, i; for (i = 0; i < arr.length; i++) m[MC_CHARS.charAt(i)] = arr[i]; return m; }

/* —— every version the dropdown knows (t: release | snapshot | beta | alpha | fools) —— */
var MC_VERS = [
    // Mojang went year.drop in Dec 2025, so snapshots are 26.3-snapshot-N now, not 26w29a
    { id: '26.3-snapshot-4', t: 'snapshot', d: '7/16/2026' },
    { id: '26.3-snapshot-3', t: 'snapshot', d: '7/7/2026' },
    { id: '26.3-snapshot-2', t: 'snapshot', d: '6/30/2026' },
    { id: '26.3-snapshot-1', t: 'snapshot', d: '6/23/2026' },
    { id: '26.2', t: 'release', d: '6/16/2026', n: 'Chaos Cubed' },
    { id: '26.1.2', t: 'release', d: '4/9/2026' },
    { id: '26.1.1', t: 'release', d: '4/1/2026' },
    { id: '26.1', t: 'release', d: '3/24/2026', n: 'Tiny Takeover' },
    { id: '1.21.11', t: 'release', d: '12/9/2025' },
    { id: '1.21.10', t: 'release', d: '10/7/2025' },
    { id: '25w46a', t: 'snapshot', d: '11/11/2025' },
    { id: '1.21.9', t: 'release', d: '9/30/2025', n: 'The Copper Age' },
    { id: '1.21.8', t: 'release', d: '7/17/2025' },
    { id: '1.21.7', t: 'release', d: '6/30/2025' },
    { id: '1.21.6', t: 'release', d: '6/17/2025', n: 'Chase the Skies' },
    { id: '1.21.5', t: 'release', d: '3/25/2025', n: 'Spring to Life' },
    { id: '1.21.4', t: 'release', d: '12/3/2024', n: 'The Garden Awakens' },
    { id: '1.21.3', t: 'release', d: '10/23/2024' },
    { id: '1.21.2', t: 'release', d: '10/22/2024', n: 'Bundles of Bravery' },
    { id: '1.21.1', t: 'release', d: '8/8/2024' },
    { id: '1.21', t: 'release', d: '6/13/2024', n: 'Tricky Trials' },
    { id: '1.20.6', t: 'release', d: '4/29/2024' },
    { id: '1.20.4', t: 'release', d: '12/7/2023' },
    { id: '1.20.1', t: 'release', d: '6/12/2023' },
    { id: '1.20', t: 'release', d: '6/7/2023', n: 'Trails & Tales' },
    { id: '1.19.4', t: 'release', d: '3/14/2023' },
    { id: '1.19.2', t: 'release', d: '8/5/2022' },
    { id: '1.19', t: 'release', d: '6/7/2022', n: 'The Wild Update' },
    { id: '1.18.2', t: 'release', d: '2/28/2022' },
    { id: '1.18', t: 'release', d: '11/30/2021', n: 'Caves & Cliffs II' },
    { id: '1.17.1', t: 'release', d: '7/6/2021' },
    { id: '1.17', t: 'release', d: '6/8/2021', n: 'Caves & Cliffs I' },
    { id: '1.16.5', t: 'release', d: '1/15/2021' },
    { id: '1.16', t: 'release', d: '6/23/2020', n: 'Nether Update' },
    { id: '1.15.2', t: 'release', d: '1/21/2020' },
    { id: '1.14.4', t: 'release', d: '7/19/2019' },
    { id: '1.13.2', t: 'release', d: '10/22/2018' },
    { id: '1.12.2', t: 'release', d: '9/18/2017' },
    { id: '1.11.2', t: 'release', d: '12/21/2016' },
    { id: '1.10.2', t: 'release', d: '6/23/2016' },
    { id: '1.9.4', t: 'release', d: '5/10/2016' },
    { id: '1.8.9', t: 'release', d: '12/9/2015' },
    { id: '1.8', t: 'release', d: '9/2/2014', n: 'Bountiful Update' },
    { id: '1.7.10', t: 'release', d: '6/26/2014' },
    { id: '1.6.4', t: 'release', d: '9/19/2013' },
    { id: '1.5.2', t: 'release', d: '5/2/2013' },
    { id: '1.4.7', t: 'release', d: '1/9/2013' },
    { id: '1.3.2', t: 'release', d: '8/16/2012' },
    { id: '1.2.5', t: 'release', d: '4/4/2012' },
    { id: '1.1', t: 'release', d: '1/12/2012' },
    { id: '1.0', t: 'release', d: '11/18/2011', n: 'Adventure Update (Part 2)' },
    { id: '26w14a', t: 'fools', d: '4/1/2026', n: 'Herdcraft Update' },
    { id: '25w14craftmine', t: 'fools', d: '4/1/2025', n: 'The Craftmine Update' },
    { id: '24w14potato', t: 'fools', d: '4/1/2024', n: 'Poisonous Potato Update' },
    { id: '23w13a_or_b', t: 'fools', d: '4/1/2023', n: 'The Vote Update' },
    { id: '22w13oneblockatatime', t: 'fools', d: '4/1/2022' },
    { id: '20w14infinite', t: 'fools', d: '4/1/2020', n: 'Ultimate Content' },
    { id: '3D Shareware v1.34', t: 'fools', d: '4/1/2019' },
    { id: '1.RV-Pre1', t: 'fools', d: '3/31/2016', n: 'Trendy Update' },
    { id: '15w14a', t: 'fools', d: '4/1/2015', n: 'Love and Hugs' },
    { id: 'b1.8.1', t: 'beta', d: '9/15/2011', n: 'Adventure Update (Part 1)' },
    { id: 'b1.7.3', t: 'beta', d: '7/8/2011' },
    { id: 'b1.6.6', t: 'beta', d: '5/31/2011' },
    { id: 'b1.5_01', t: 'beta', d: '4/20/2011' },
    { id: 'b1.4_01', t: 'beta', d: '4/5/2011' },
    { id: 'b1.3_01', t: 'beta', d: '2/23/2011' },
    { id: 'b1.2_02', t: 'beta', d: '1/21/2011' },
    { id: 'b1.1_02', t: 'beta', d: '12/22/2010' },
    { id: 'b1.0.2', t: 'beta', d: '12/21/2010' },
    { id: 'a1.2.6', t: 'alpha', d: '12/3/2010' },
    { id: 'a1.2.2b', t: 'alpha', d: '11/10/2010' },
    { id: 'a1.1.2_01', t: 'alpha', d: '9/23/2010' },
    { id: 'a1.0.17_04', t: 'alpha', d: '8/23/2010' },
    { id: 'a1.0.11', t: 'alpha', d: '7/23/2010' },
    { id: 'a1.0.5_01', t: 'alpha', d: '7/14/2010' },
    { id: 'a1.0.4', t: 'alpha', d: '7/9/2010' },
    { id: 'inf-20100618', t: 'alpha', d: '6/18/2010' },
    { id: 'c0.30_01c', t: 'alpha', d: '11/10/2009' },
    { id: 'c0.0.13a', t: 'alpha', d: '5/22/2009' },
    { id: 'c0.0.11a', t: 'alpha', d: '5/17/2009' },
    { id: 'rd-132328', t: 'alpha', d: '5/13/2009' },
    { id: 'rd-132211', t: 'alpha', d: '5/13/2009' }
];
function mcVer(id) { var i; for (i = 0; i < MC_VERS.length; i++) if (MC_VERS[i].id === id) return MC_VERS[i]; return null; }
function mcLatest(t) { var i; for (i = 0; i < MC_VERS.length; i++) if (MC_VERS[i].t === t) return MC_VERS[i].id; return '26.2'; }
function mcResolveVer(v) {
    if (v === 'latest-release') return mcLatest('release');
    if (v === 'latest-snapshot') return mcLatest('snapshot');
    return v;
}
function mcJarSize(id) {
    var v = mcVer(id) || { t: 'release' };
    if (v.t === 'alpha') return /^rd|^c0/.test(id) ? '292 KB' : '1.1 MB';
    if (v.t === 'beta') return '2.3 MB';
    if (v.t === 'snapshot' || v.t === 'fools') return '26.8 MB';   // these branch off the modern client
    return /^(1\.(1[6-9]|2\d)|2\d\.)/.test(id) ? '26.8 MB' : '9.4 MB';   // 26.x is the year.drop scheme
}
// the manifest's own vocabulary, and the class that era actually booted
function mcVerJson(v) {
    var t = (mcVer(v) || {}).t || 'release';
    var type = t === 'beta' ? 'old_beta' : t === 'alpha' ? 'old_alpha' : t === 'fools' ? 'snapshot' : t;
    var main = /^rd-/.test(v) ? 'com.mojang.rubydung.RubyDung'
        : (t === 'alpha' || t === 'beta') ? 'net.minecraft.client.Minecraft'
        : 'net.minecraft.client.main.Main';
    // Java 21 from 1.20.5 on; 17 across the 1.17–1.20 era (incl. its 22w/23w snapshots); 8 before
    var java = /^(1\.2[1-9]|1\.20\.[5-9]|2\d\.|2[4-9]w)/.test(v) ? 21 : /^(1\.(1[7-9]|20)|2[23]w)/.test(v) ? 17 : 8;
    return '{\n  "id": "' + v + '",\n  "type": "' + type + '",\n  "mainClass": "' + main +
        '",\n  "assets": "pixels",\n  "javaVersion": { "majorVersion": ' + java + ' }\n}';
}

/* —— installation icons: 8×8 block faces, launcher-picker style —— */
var MC_ICON_PAL = {
    g: '#7cbd4b', G: '#5da03a', h: '#8fd05a',
    d: '#8a5f3c', D: '#6e4a2c', e: '#9b7048',
    s: '#7a7a82', S: '#5f5f66', t: '#8f8f96',
    o: '#a07040', O: '#7e5830', p: '#b8894e',
    k: '#3a3a40', K: '#26262b',
    r: '#c93a2e', R: '#8f261e', w: '#e8e4dc',
    b: '#5a3d24', B: '#3e2a18', i: '#e0e5e8',
    c: '#3ab3da', y: '#f0c93a', Y: '#c9a02e',
    m: '#8a3fb0', v: '#4a3fb0', f: '#d87a3a',
    l: '#f0e6c8', L: '#d8c9a0', x: '#2f2f35',
    u: '#c77f56', U: '#a5623c'
};
var MC_ICONS = {
    grass: ['hghghggh', 'gGghgGgg', 'GdGgGdGe', 'dDdedDde', 'eddDeddD', 'dDeddDed', 'ddDeddDe', 'DedDeddD'],
    dirt: ['eddDeddD', 'dDeddDed', 'ddDeedDe', 'DeddDedd', 'edDeddDe', 'dDeddedD', 'deDdeddD', 'DdeDdedd'],
    stone: ['tsstssts', 'sStsstss', 'ssStssSt', 'tssStsss', 'sstssSts', 'Stssstss', 'ssStssSt', 'tsstsSts'],
    cobble: ['sSttSsts', 'StsStsSt', 'tsStssts', 'sStsStsS', 'tssStstS', 'StsstsSt', 'sStSsSts', 'tstsStsS'],
    planks: ['oooopooo', 'OOOOOOOO', 'opoooooo', 'oooopooo', 'OOOOOOOO', 'ooooooop', 'opoooooo', 'OOOOOOOO'],
    crafting: ['loollool', 'oLLLLLLo', 'oLoLLoLo', 'oLLLLLLo', 'oLoLLoLo', 'oLLLLLLo', 'oLLooLLo', 'looLLool'],
    furnace: ['ssssssss', 'sSSSSSSs', 'sSttttSs', 'ssssssss', 'sskrrkss', 'sskryrks', 'sskrrkss', 'ssssssss'],
    chest: ['oooooooo', 'oOOOOOOo', 'oOooooOo', 'ooooyooo', 'oOooyoOo', 'oOooooOo', 'oOOOOOOo', 'oooooooo'],
    tnt: ['rwrrwrrw', 'rrwrrwrr', 'wwwwwwww', 'wxwxxwxw', 'wxwxxwxw', 'wwwwwwww', 'rwrrwrrw', 'rrwrrwrr'],
    bookshelf: ['oooooooo', 'orgcvyro', 'orgcvyro', 'oooooooo', 'ovyrgcvo', 'ovyrgcvo', 'oooooooo', 'oooopooo'],
    bricks: ['rRrrRrrR', 'wwwwwwww', 'rrRrrRrr', 'wwwwwwww', 'RrrRrrRr', 'wwwwwwww', 'rRrrRrrR', 'wwwwwwww'],
    obsidian: ['kKkkKkkK', 'KkmKkKkk', 'kKkkKkmK', 'KkKmkKkK', 'kkKkKkkK', 'KmkKkKkK', 'kKkKkmKk', 'KkKkKkKK'],
    diamond: ['tsstssts', 'sScisstS', 'sciicsss', 'ssciSsts', 'tssssSts', 'stsciSss', 'ssciicst', 'tssciSts'],
    gold: ['yYyyyYyy', 'YyyYyyYy', 'yyYyyyyY', 'yYyyYyyy', 'yyyYyyYy', 'Yyyyyyyy', 'yyYyyYyy', 'YyyyYyyY'],
    bedrock: ['kKssKkKs', 'KskKsKsk', 'sKkKkskK', 'kKsksKkK', 'KksKkKsk', 'skKkKskK', 'KkskKkKs', 'kKsKskKk'],
    pumpkin: ['ffffffff', 'fOffffOf', 'fkffffkf', 'ffffffff', 'ffkffkff', 'fkkfkkkf', 'ffffffff', 'OfOffOfO']
};
var MC_ICON_ORDER = ['grass', 'dirt', 'stone', 'cobble', 'planks', 'crafting', 'furnace', 'chest', 'tnt', 'bookshelf', 'bricks', 'obsidian', 'diamond', 'gold', 'bedrock', 'pumpkin'];
function mcBlockIcon(key, cls) { return pxSvg(MC_ICONS[key] || MC_ICONS.grass, MC_ICON_PAL, cls || 'mcl-block'); }

/* —— patch-note cards: art motifs (each ≤ 12×11) + heavily condensed notes —— */
var MC_ART = {
    copper: { p: { c: '#c9713a', C: '#a5522a', o: '#7fb069', k: '#26262b', e: '#3ab3da' },
        r: ['....cc......', '...cccc.....', '...ceec.....', '...cccc.....', '.cccCCccc...', '.c.cCCc.c...', '...cCCc.....', '...cccc.....', '..cc..cc....', '..cc..cc....', '..oo..oo....'] },
    ghast: { p: { w: '#f0f0ea', W: '#d8d8cc', k: '#26262b', p: '#e8a0b0', b: '#78a7ff' },
        r: ['..wwwwwwww..', '.wwwwwwwwww.', '.wwkwwwwkww.', '.wwkwwwwkww.', '.wwwwkkwwww.', '.wwwwkkwwww.', '.wwwwwwwwww.', '..wwwwwwww..', '..w.w.ww.w..', '..w.w..w.w..', '............'] },
    spring: { p: { g: '#5da03a', G: '#3a8a30', y: '#f0e68a', f: '#d81e05', w: '#e8e4dc' },
        r: ['............', '.....g......', '..g.ggg..y..', '.ggggggg....', 'gggGgggGg.y.', 'gGgggGggg...', '.gggggggg...', '..y..gg.....', '......g..f..', '.f....g..f..', 'GGGGGGGGGGGG'] },
    pale: { p: { t: '#8a8f8a', T: '#6e736e', w: '#d8dcd2', k: '#26262b', o: '#c9713a' },
        r: ['..wwwwww....', '.wwwwwwww...', 'wwwwwwwwww..', 'wwwokwwwww..', '.wwwwwwww...', '....tt......', '....tt......', '....tt......', '....tt......', '...ttto.....', 'TTTTTTTTTTTT'] },
    bundle: { p: { b: '#a5623c', B: '#7e4a2c', s: '#d8c9a0', r: '#c93a2e', c: '#3ab3da' },
        r: ['....ss......', '...s..s.....', '...rcbs.....', '..bbbbbb....', '.bBbbbbBb...', '.bbbbBbbb...', '.bBbbbbbb...', '.bbbBbbBb...', '..bbbbbb....', '...bbbb.....', '............'] },
    trial: { p: { c: '#c9713a', C: '#a5522a', t: '#7a7a82', T: '#5f5f66', k: '#26262b', o: '#f0a02a' },
        r: ['tTttTttTtTtt', 'tcccccccccct', 'tcCccccccCct', 'tcckkkkkkcct', 'tcck.oo.kcct', 'tcck.oo.kcct', 'tcckkkkkkcct', 'tcCccccccCct', 'tcccccccccct', 'tTtTtttTttTt', '............'] },
    cherry: { p: { p: '#f3a5c0', P: '#e07fa8', t: '#5a3d24', g: '#5da03a' },
        r: ['..pppppp....', '.pppPpppp...', 'ppPpppppPp..', 'pppppPpppp..', '.ppPppppp...', '....tt..p...', '....tt......', '....tt......', '....tt......', 'g.g.gtg.g.g.', 'gggggggggggg'] },
    warden: { p: { b: '#0f3038', B: '#1a4a52', c: '#3ab3da', k: '#06181c', w: '#7adfd0' },
        r: ['..bbbbbbbb..', '.bBbbbbbbBb.', '.bwwbbbbwwb.', '.bwwbbbbwwb.', '.bbbbBBbbbb.', '.bbkkkkkkbb.', '..bkkkkkkb..', '..bbbbbbbb..', '...cbbbbc...', '...c.bb.c...', '............'] },
    mount: { p: { s: '#7a7a82', S: '#5f5f66', w: '#e8ecf0', g: '#5da03a', G: '#3a8a30', b: '#78a7ff' },
        r: ['bbbbbwwbbbbb', 'bbbbwwwwbbbb', 'bbbwwswwwbbb', 'bbwwsssswbbb', 'bbssSssssbbb', 'bssssSssssbb', 'ssSssssSssss', 'sssgsssssgss', 'ggggggggggGg', 'gggggggggggg', '............'] },
    axolotl: { p: { p: '#f3a5c0', P: '#e07fa8', k: '#26262b', f: '#d87ab0', w: '#f9fffe' },
        r: ['.f..........', 'pf.pppppp.f.', '.ppppppppf..', '.pkppppkp...', '.pppPPppp...', '.ppp..ppp...', '.pppppppppp.', '..pppppp..p.', '...p..p.....', '............', '............'] },
    nether: { p: { n: '#6e2c2c', N: '#521f1f', l: '#f0a02a', L: '#d87a1d', k: '#26262b', v: '#8932b8' },
        r: ['nNnnNnnvvnnn', 'nnNnnnnvvnNn', 'NnnNnnnvvnnn', 'nnnnNnnvvnnN', 'nNnnnnnvvnnn', 'lLllnNnnnnNn', 'lllLlnnnNnnn', 'LllllLnnnnnN', 'lLlllllnNnnn', 'llllLlllnnnn', '............'] },
    village: { p: { o: '#a07040', O: '#7e5830', y: '#f0c93a', k: '#26262b', r: '#8f4a2e', g: '#5da03a' },
        r: ['.....rr.....', '....rrrr....', '...rrrrrr...', '..rrrrrrrr..', '.rrrrrrrrrr.', '...oo..oo...', '...o.yy.o...', '...o.yy.o...', '...o....o...', '...oooooo...', 'gggggggggggg'] },
    sulfur: { p: { y: '#e8d44a', Y: '#b8a52e', s: '#7a7a82', S: '#5f5f66', k: '#26262b', o: '#f0a02a' },
        r: ['sSssSssSsSss', 'ssSssSsssSsS', 'sysysssyyyss', 'syyyssoyyyos', 'sYyYssyyyyys', 'ssyssskyykss', 'ssossyyyyyss', 'sooosyYyyYys', 'soooosyyyyss', 'SsooossYyYss', 'sSsssSssSsSs'] },
    tiny: { p: { p: '#f3a5c0', P: '#e07fa8', k: '#26262b', y: '#f0c93a', g: '#5da03a', G: '#3a8a30', w: '#f9fffe' },
        r: ['......y.....', '.....yyy....', '......y.....', '..pppp.pppp.', '.pkppp.pkppp', '.pppppppppp.', '.pPppp.pPppp', '.pppppppppp.', '..pp.p..pp.p', 'gggggggggggg', 'GGGGGGGGGGGG'] },
    snap: { p: { g: '#7cbd4b', G: '#5da03a', d: '#8a5f3c', D: '#6e4a2c', q: '#e8e4dc', k: '#26262b' },
        r: ['........q...', '.......qqq..', '......qqq...', 'ggGg.qqq.gGg', 'GggGqqqgggGG', 'dDddqqdddDdd', 'ddDdd.ddDddd', 'DddDdddDdddD', 'ddddDdddDddd', 'dDddddDddddd', '............'] }
};
var MC_NOTES = [
    { v: '26.3-snapshot-4', name: 'Snapshot 26.3-snapshot-4', d: 'July 16, 2026', art: 'snap', b: [
        'Experimental features hide behind a toggle, as is tradition.',
        'Four bugs fixed. At least two of them were real.',
        'The launcher is done; the game is being built in another window. You are looking at the seam.'] },
    { v: '26.2', name: 'Chaos Cubed', d: 'June 16, 2026', art: 'sulfur', b: [
        'Sulfur caves: a new biome built out of sulfur and cinnabar, and it smells accordingly.',
        'The sulfur cube, a mob that picks a physics archetype and commits to it.',
        'Potent sulfur blocks erupt into geysers. Do not stand there. You will stand there.',
        'An experimental Vulkan renderer, and a friends list to watch you fail in real time.'] },
    { v: '26.1', name: 'Tiny Takeover', d: 'March 24, 2026', art: 'tiny', b: [
        'The golden dandelion pauses a baby mob’s aging. Time stops. Only for the piglets.',
        'Nearly every baby mob got new models, textures and sounds. The nautiluses and ghastlings were left out and know it.',
        'Name tags are craftable now: paper plus any nugget. Thirteen years of fishing for them, over.',
        'Villager trades moved into datapacks, so the emerald economy is finally yours to ruin.'] },
    { v: '1.21.9', name: 'The Copper Age', d: 'September 30, 2025', art: 'copper', b: [
        'Copper golems wake up, wander off, and start organizing your chests.',
        'A full copper tool and armor set, plus copper chests, bars, chains and lanterns.',
        'Shelves, for displaying the gear you never actually use.',
        'Everything oxidizes. Even the golems. Wax them, or learn acceptance.'] },
    { v: '1.21.6', name: 'Chase the Skies', d: 'June 17, 2025', art: 'ghast', b: [
        'The happy ghast: strap on a harness and fly it with three friends aboard. No taming, just trust.',
        'A locator bar points at your friends, so you can pretend you were never lost.',
        'Dried ghasts rehydrate into ghastlings. That is simply how science works now.',
        'New music disc: Tears.'] },
    { v: '1.21.5', name: 'Spring to Life', d: 'March 25, 2025', art: 'spring', b: [
        'Warm and cold variants for pigs, cows and chickens.',
        'Firefly bushes, wildflowers, leaf litter, and leaves that actually fall.',
        'Cacti flower now. Eggs come in brown and blue. The chickens know why.'] },
    { v: '1.21.4', name: 'The Garden Awakens', d: 'December 3, 2024', art: 'pale', b: [
        'The pale garden: a grey, silent forest that is definitely fine to sleep in.',
        'The creaking: a mob you cannot hurt, only outrun. Break its heart block instead.',
        'Pale oak wood and resin, for all your haunted-cabin construction needs.'] },
    { v: '1.21.2', name: 'Bundles of Bravery', d: 'October 22, 2024', art: 'bundle', b: [
        'Bundles are finally, actually in the game. Thirteen years of inventory pain, addressed by a small bag.',
        'Hardcore mode arrives on Realms.'] },
    { v: '1.21', name: 'Tricky Trials', d: 'June 13, 2024', art: 'trial', b: [
        'Trial chambers: copper-and-tuff dungeons whose spawners scale to your party size.',
        'The mace. Fall from higher, hit harder. Gravity is a weapon now.',
        'The breeze and the bogged join the mob roster.',
        'The crafter: redstone that crafts. Factories, basically.',
        'Ominous trials, for people who read the fine print on bad omens.'] },
    { v: '1.20', name: 'Trails & Tales', d: 'June 7, 2023', art: 'cherry', b: [
        'Archaeology: brush suspicious sand, find pottery sherds, reassemble history.',
        'The sniffer digs up seeds from before your world existed.',
        'Cherry groves. Pink. Extremely pink.',
        'Camels seat two, bamboo builds rafts, hanging signs say more.',
        'Armor trims and smithing templates, for professional drip management.'] },
    { v: '1.19', name: 'The Wild Update', d: 'June 7, 2022', art: 'warden', b: [
        'The deep dark and its ancient cities. Quietly. QUIETLY.',
        'The warden: the reason you finally learned to crouch-walk.',
        'Mangrove swamps, mud, frogs, and the allay, who just wants to help.'] },
    { v: '1.18', name: 'Caves & Cliffs: Part II', d: 'November 30, 2021', art: 'mount', b: [
        'World height blown open: build from Y -64 up to 319.',
        'Terrain generation rebuilt from scratch. Mountains that earn the name.',
        'Caves you can get genuinely, satisfyingly lost in.'] },
    { v: '1.17', name: 'Caves & Cliffs: Part I', d: 'June 8, 2021', art: 'axolotl', b: [
        'Axolotls. The bucket is mandatory.',
        'Copper, amethyst, spyglasses and lightning rods.',
        'Goats: they will ram you off a cliff. It is not personal.'] },
    { v: '1.16', name: 'Nether Update', d: 'June 23, 2020', art: 'nether', b: [
        'The nether becomes a place to live, not just a place to sprint through.',
        'Four new biomes, piglins to barter with, striders to ride across lava.',
        'Netherite: beyond diamond, forged in fire, does not burn.',
        'Respawn anchors, because dying there was getting too easy.'] },
    { v: '1.14', name: 'Village & Pillage', d: 'April 23, 2019', art: 'village', b: [
        'Villagers get jobs, schedules, and strong opinions about your trades.',
        'Pillagers get crossbows and a grudge. Raids follow.',
        'Foxes, pandas and cats arrive. Ocelots finally relax.'] }
];

/* —— skins: front view, 16×32; head cols 4-11 rows 0-7, arms 4 wide (3 if slim),
      torso cols 4-11 rows 8-19, legs rows 20-31. Stored palette-indexed. —— */
function mcSkinDef(name, model, pal, rows, builtin) {
    var used = {}, arr = [], out = [], i, j, c;
    for (i = 0; i < rows.length; i++) {
        var row = '', src = rows[i];
        for (j = 0; j < 16; j++) {
            c = src.charAt(j);
            if (c === '.' || !pal[c]) { row += '.'; continue; }
            if (!(c in used)) { used[c] = MC_CHARS.charAt(arr.length); arr.push(pal[c]); }
            row += used[c];
        }
        out.push(row);
    }
    return { id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), n: name, model: model, pal: arr, rows: out, builtin: !!builtin };
}
function mcDefaultSkins() {
    var steve = { h: '#2b1c10', s: '#bd8b72', S: '#a5735c', e: '#ffffff', i: '#4a3fb0', m: '#8a5a45',
        t: '#00a8a8', T: '#008a8a', p: '#4234a0', P: '#362a86', o: '#5f5f5f', O: '#4a4a4a' };
    var alex = { h: '#c17a3f', H: '#a5622e', s: '#e3b18a', S: '#c99a74', e: '#ffffff', i: '#6a8f3f', m: '#b07a5a',
        t: '#87a556', T: '#6e8a42', b: '#6e5030', p: '#5d473a', P: '#4a382e', o: '#8a8f96', O: '#6e737a' };
    var ure = { h: '#5a3d24', s: '#d9a877', S: '#c2915f', e: '#ffffff', i: '#8a8f96', m: '#a5744e',
        r: '#d81e05', R: '#a01604', k: '#2a3038', K: '#1e242a', w: '#e8e8e8', W: '#c7c7c7' };
    var moo = { w: '#e8e4dc', W: '#d0ccc2', k: '#1d1d21', p: '#d88a9a', P: '#b76a7c', g: '#b5b5ad', h: '#8a8a82' };
    return [
        mcSkinDef('Steve', 'classic', steve, [
            '....hhhhhhhh....', '....hhhhhhhh....', '....hssssssh....', '....ssssssss....',
            '....seissies....', '....sssSSsss....', '....ssmmmmss....', '....ssssssss....',
            'ssssttttttttssss', 'ssssttttttttssss', 'sssstttttttTssss', 'ssssttttttttssss',
            'ssssttttttttssss', 'sSsstttttttTssSs', 'ssssttttttttssss', 'ssssttttttttssss',
            'ssssttTtttttssss', 'sSsstttttttTssss', 'ssssttttttttsSss', 'ssssttttttttssss',
            '....pppppppp....', '....pppPPppp....', '....pppppppp....', '....pPpppppp....',
            '....pppppPpp....', '....pppppppp....', '....pPpppppp....', '....pppppppp....',
            '....pppppppp....', '....oooooooo....', '....oooOOooo....', '....oooooooo....'], true),
        mcSkinDef('Alex', 'slim', alex, [
            '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '....hssssssh....',
            '....seissies....', '....sssSSsss....', '....ssmmssss....', '....hssssssh....',
            '.hssttttttttssh.', '.sssttttttttsss.', '.sssttttttttsss.', '.ssstttttttTsss.',
            '.sssttttttttsss.', '.sSsttTtttttssS.', '.sssttttttttsss.', '.sssbbbbbbbbsss.',
            '.sssttttttttsss.', '.sssttttttttsss.', '.sSstttttttTsss.', '.sssttttttttsss.',
            '....pppppppp....', '....pppPPppp....', '....pppppppp....', '....pPpppppp....',
            '....pppppPpp....', '....pppppppp....', '....pppppppp....', '....pPpppppp....',
            '....oooooooo....', '....oooOOooo....', '....oooooooo....', '....oooooooo....'], true),
        mcSkinDef('URE BOY', 'classic', ure, [
            '....hhhhhhhh....', '....hhhhhhhh....', '....hhsssshh....', '....ssssssss....',
            '....seissies....', '....sssSSsss....', '....ssmmmmss....', '....ssssssss....',
            'rrrrrrrrrrrrrrrr', 'rrrrrRrrrrRrrrrr', 'rrrrrrRRRRrrrrrr', 'rrrrRrrrrrrRrrrr',
            'rrrrrrrrrrrrrrrr', 'rRrrrrrrrrrrrrRr', 'rrrrRRRRRRRRrrrr', 'rrrrRrrrrrrRrrrr',
            'ssssRrrrrrrRssss', 'sSssRRRRRRRRssss', 'ssssrrrrrrrrsSss', 'ssssrrrrrrrrssss',
            '....kkkkkkkk....', '....kkkKKkkk....', '....kkkkkkkk....', '....kKkkkkkk....',
            '....kkkkkKkk....', '....kkkkkkkk....', '....kKkkkkkk....', '....kkkkkkkk....',
            '....kkkkkkkk....', '....wwwwwwww....', '....wwwWWwww....', '....wwwwwwww....'], true),
        mcSkinDef('Moo', 'classic', moo, [
            '....g......g....', '....gg....gg....', '....wwwwkkww....', '....wwwwkkww....',
            '....wkwwwwkw....', '....wwwwwwww....', '....pppppppp....', '....pkppppkp....',
            'wwwwwwwwkkkkwwww', 'wwkkwwwwkkkkwwww', 'wwkkwwwwwkkwwwww', 'wwwwwkkwwwwwwwkk',
            'wwwwwkkwwwwwwwkk', 'wWwwwwwwwkkwwwww', 'wwwwkkwwwkkwwWww', 'wwwwkkwwwwwwwwww',
            'wWwwwwwwwwwwkkww', 'wwwwwwkkwwwwkkww', 'wwwwwwkkwwwwwwWw', 'wwwwwwwwwwwwwwww',
            '....wwwwwwww....', '....wwkkwwww....', '....wwkkwwww....', '....wwwwwkkw....',
            '....wWwwwkkw....', '....wwwwwwww....', '....kkwwwwWw....', '....kkwwwwww....',
            '....wwwwwwww....', '....wwwwwwww....', '....hhhhhhhh....', '....hhhhhhhh....'], true)
    ];
}
// read-only until the launcher is actually opened: merely loading the desktop
// must not write launcher keys for someone who never touched Minecraft
function mcSkins(seed) {
    var s = mcj('skins', null);
    if (!s) { s = mcDefaultSkins(); if (seed) mcjSet('skins', s); }
    return s;
}
function mcSkin() {
    var id = mcj('skin', 'ure-boy'), all = mcSkins(), i;
    for (i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return all[0];
}
function mcSkinSvg(sk, cls) {
    var pal = mcPalMap(sk.pal), rows = sk.rows;
    if (sk.model === 'slim') rows = rows.map(function (r, y) {
        return (y >= 8 && y < 20) ? '.' + r.slice(1, 15) + '.' : r;
    });
    return pxSvg(rows, pal, cls || 'mcl-skin');
}
function mcFaceSvg(sk, cls) {
    var pal = mcPalMap(sk.pal);
    var head = sk.rows.slice(0, 8).map(function (r) { return r.slice(4, 12); });
    return pxSvg(head, pal, cls || 'mcl-face');
}
function mcRegion(x, y) {
    if (y < 8) return (x >= 4 && x < 12) ? 'head' : null;
    if (y < 20) { if (x < 4) return 'armL'; if (x >= 12) return 'armR'; return 'body'; }
    return (x >= 4 && x < 12) ? (x < 8 ? 'legL' : 'legR') : null;
}

/* —— the Play-tab hero panorama, generated + hand-stamped —— */
function mcHero() {
    var W = 112, H = 44, y, x;
    var pal = {
        a: '#6f9fe8', A: '#82b0f0', b: '#95bef5', c: '#f4f7fb', s: '#f7ecb0',
        g: '#7cbd4b', G: '#5da03a', d: '#8a5f3c', D: '#6e4a2c', t: '#7a7a82', T: '#5f5f66',
        w: '#3b6ed8', W: '#4a82f0', o: '#6b4a2a', l: '#4a9c3a', L: '#5fb54a', p: '#2f6428',
        r: '#c93a2e', y: '#f0c93a', k: '#4db347', K: '#2f7a2c', E: '#1d1d21',
        m: '#e8e4dc', M: '#1d1d21', u: '#d88a9a'
    };
    var grid = [];
    for (y = 0; y < H; y++) { grid.push([]); for (x = 0; x < W; x++) grid[y].push(y < 10 ? 'a' : y < 20 ? 'A' : 'b'); }
    // sun + clouds
    var stamp = function (sx, sy, rows) {
        for (var i = 0; i < rows.length; i++) for (var j = 0; j < rows[i].length; j++) {
            var ch = rows[i].charAt(j);
            if (ch !== '.' && sy + i >= 0 && sy + i < H && sx + j >= 0 && sx + j < W) grid[sy + i][sx + j] = ch;
        }
    };
    stamp(94, 3, ['ssssss', 'ssssss', 'ssssss', 'ssssss', 'ssssss']);
    stamp(8, 6, ['..cccccccc..', 'cccccccccccc', 'cccccccccccc']);
    stamp(46, 4, ['....cccccc', 'cccccccccc', 'ccccccc...']);
    stamp(74, 9, ['ccccccc', 'ccccccccc']);
    // terrain: hand-tuned surface heights across 14 control columns, stepped like real chunks
    var pts = [30, 30, 29, 28, 28, 27, 28, 29, 30, 31, 31, 30, 29, 29];
    for (x = 0; x < W; x++) {
        var seg = Math.min(12, Math.floor(x / 8)), h0 = pts[seg], h1 = pts[seg + 1];
        var top = Math.round(h0 + (h1 - h0) * ((x % 8) / 8));
        for (y = top; y < H; y++) grid[y][x] = y === top ? 'g' : (y === top + 1 ? 'G' : (y < top + 6 ? (((x * 7 + y * 13) % 5) ? 'd' : 'D') : (((x * 5 + y * 11) % 7) ? 't' : 'T')));
    }
    // pond carved into the flat stretch
    for (x = 84; x < 98; x++) for (y = 31; y < 34; y++) grid[y][x] = (y === 31 && (x % 3 === 0)) ? 'W' : 'w';
    for (x = 83; x < 99; x++) grid[34][x] = 'd';
    // oak tree
    stamp(14, 21, ['..lllll.', '.lllllll', 'lllLllll', 'llllllll', '.llllll.', '...oo...', '...oo...', '...oo...', '...oo...']);
    // spruce
    stamp(56, 20, ['....pp....', '...pppp...', '..pppppp..', '...pppp...', '..pppppp..', '.pppppppp.', '....oo....', '....oo....']);
    // creeper, politely waiting
    stamp(68, 20, ['kKkkkkKk', 'kEEkkEEk', 'kEEkkEEk', 'kkkEEkkk', 'kkEEEEkk', 'kkEEEEkk', 'kkEkkEkk', 'kKkkkkKk', 'kkkkkkkk', 'kKkkkkKk']);
    // a cow (of course there is a cow)
    stamp(34, 23, ['mmmmmm', 'mMMmmm', 'mmmMMm', 'ummmmm', '.m..m.']);
    // flowers
    [[6, 'r'], [25, 'y'], [48, 'r'], [52, 'y'], [102, 'y'], [107, 'r']].forEach(function (f) {
        var fx = f[0], top = 0;
        for (y = 0; y < H; y++) if (grid[y][fx] === 'g') { top = y; break; }
        if (top > 1) { grid[top - 1][fx] = f[1]; }
    });
    return pxSvg(grid.map(function (row) { return row.join(''); }), pal, 'mcl-hero-art', true);
}

/* —— rail mini-icons (12×12) —— */
var MC_RAIL_ART = {
    java: { p: MC_ICON_PAL, r: ['hghghggghggh', 'gGghgGgghGgg', 'GdGgGdGegGdG', 'dDdedDdedDde', 'eddDeddDeddD', 'dDeddDeddDed', 'ddDeddDeddDe', 'DedDeddDedDd', 'eddDeddDeddD', 'dDeddDeddDed', 'ddDeddDeddDe', 'DedDeddDeddD'] },
    bedrock: { p: MC_ICON_PAL, r: ['kKssKkKskKsk', 'KskKsKskKsKk', 'sKkKkskKkKks', 'kKsksKkKsKsk', 'KksKkKskKkKs', 'skKkKskKsKkK', 'KkskKkKskKsk', 'kKsKskKkKsKs', 'KskKkKskKksk', 'sKkKskKsKkKs', 'kKskKkKskKsk', 'KsKkskKkKsKk'] },
    dungeons: { p: { o: '#f0a02a', O: '#d87a1d', k: '#3e2a18', f: '#f4d03a' }, r: ['.....f......', '....ff......', '....ffo.....', '....oo......', '....oo......', '....kk......', '....kk......', '....kk......', '....kk......', '....kk......', '...kkkk.....', '............'] },
    legends: { p: { b: '#3ab3da', B: '#2a86a5', y: '#f0c93a', k: '#26262b', o: '#a07040' }, r: ['.obbbbbb....', '.obBbbBb....', '.obbyybb....', '.obyyyyb....', '.obbyybb....', '.obBbbBb....', '.obbbbbb....', '.obbbbB.....', '.obbbB......', '.o..........', '.o..........', '.o..........'] },
    education: { p: { r: '#c93a2e', R: '#a02620', g: '#5da03a', o: '#6b4a2a' }, r: ['......g.....', '.....gg.....', '....o.......', '..rrrrrr....', '.rrrrrrrr...', '.rrRrrrrr...', '.rrrrrrRr...', '.rrrrrrrr...', '..rrrrrr....', '...rrrr.....', '............', '............'] }
};
var MC_GAMES = [
    { id: 'java', top: 'MINECRAFT:', sub: 'Java Edition' },
    { id: 'bedrock', top: 'MINECRAFT', sub: 'for Windows' },
    { id: 'dungeons', top: 'MINECRAFT', sub: 'Dungeons' },
    { id: 'legends', top: 'MINECRAFT', sub: 'Legends' },
    { id: 'education', top: 'MINECRAFT', sub: 'Education' }
];

/* —— installations + settings state —— */
function mcSeedInst() {
    return [
        { id: 'latest-release', n: 'Latest release', icon: 'grass', v: 'latest-release', builtin: 1 },
        { id: 'latest-snapshot', n: 'Latest snapshot', icon: 'crafting', v: 'latest-snapshot', builtin: 1 }
    ];
}
function mcInst(seed) { var s = mcj('inst', null); if (!s) { s = mcSeedInst(); if (seed) mcjSet('inst', s); } return s; }
function mcSet() { return mcj('set', { keepOpen: true, openLog: false, snapshots: false, animArt: true }); }
function mcVisibleInst() {
    var snaps = mcSet().snapshots;
    return mcInst().filter(function (i) { return snaps || i.id !== 'latest-snapshot'; });
}
function mcSelInst() {
    var id = mcj('sel', 'latest-release'), list = mcVisibleInst(), i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
}

/* —— .minecraft in the real (sim) file system —— */
// a launcher-owned text file, wired into the machine's own content store (TXT) so it
// opens through the real Explorer→Notepad path like any other file. Content is live:
// mcSyncFS rewrites TXT[cid] each time, so the file always shows current launcher state.
function mcDoc(name, text, size) {
    var cid = 'mc:' + name;
    TXT[cid] = text;
    var ext = extOf(name), t = EXT_T[ext] || 'file';
    return { n: name, t: t, cid: cid, size: size || fmtKb(Math.max(1, text.length / 1024)), date: mcj('installed', '7/9/2026 1:04 PM') };
}
function mcProfilesText() {
    var out = { profiles: {}, settings: { crashAssistance: false, enableSnapshots: mcSet().snapshots, keepLauncherOpen: mcSet().keepOpen, showGameLog: mcSet().openLog }, version: 3 };
    mcInst().forEach(function (i) {
        out.profiles[i.id] = { name: i.n, type: i.builtin ? i.id : 'custom', icon: i.icon, lastVersionId: i.v, created: i.created || '2026-07-09T13:04:00Z', lastUsed: i.lastUsed || '' };
    });
    return JSON.stringify(out, null, 2);
}
function mcOptionsText() {
    return ['version:4189', 'lang:en_us', 'fov:0.0', 'gamma:0.5', 'guiScale:0', 'renderDistance:12',
        'soundCategory_master:1.0', 'soundCategory_music:0.6', 'fullscreen:false', 'enableVsync:true',
        'difficulty:2', 'skin:' + mcSkin().id, 'pixelsAlreadyPerfect:true'].join('\n');
}
var MC_MCDIR = 'C:\\Users\\isaac\\AppData\\Roaming\\.minecraft';
// worlds + screenshots inherited from the machine's past (the lore #73 authored here).
// Seeded once into the live saves/screenshots; the game may add to or replace them.
function mcSeedSaves() {
    var worlds = [
        { n: 'world', region: ['r.0.0.mca', 'r.-1.0.mca'], icon: 1 },
        { n: 'world (1)', region: ['r.0.0.mca'], icon: 0 },
        { n: 'SMP with malachi', region: ['r.0.0.mca', 'r.0.-1.mca'], icon: 1 },
        { n: 'creative flat test', region: [], icon: 0 }
    ];
    FS['.minecraft/saves'] = { items: worlds.map(function (w) { return { n: w.n, t: 'folder', go: '.minecraft/saves/' + w.n }; }),
        empty: 'No worlds yet.' };
    worlds.forEach(function (w) {
        var it = [{ n: 'level.dat', t: 'sys', size: '92 KB' }];
        if (w.region.length) it.push({ n: 'region', t: 'folder', go: '.minecraft/saves/' + w.n + '/region' });
        if (w.icon) it.push({ n: 'icon.png', t: 'img', size: '3 KB' });
        FS['.minecraft/saves/' + w.n] = { items: it, empty: '' };
        if (w.region.length) FS['.minecraft/saves/' + w.n + '/region'] = {
            items: w.region.map(function (r) { return { n: r, t: 'sys', size: fmtKb(900 + fsHash(w.n + r) % 3300) }; }), empty: '' };
    });
}
function mcSeedShots() {
    FS['.minecraft/screenshots'] = { items: ['2019-06-14_20.41.05.png', '2019-07-02_23.58.11.png', '2020-03-19_01.12.44.png']
        .map(function (n) { return { n: n, t: 'img', size: fmtKb(600 + fsHash(n) % 3200) }; }), empty: 'F2 in game takes a screenshot. These are from the before times.' };
}
function mcSyncFS() {
    var dl = mcj('dl', []), crashes = mcj('crash', []), log = mcj('log', null);
    var items = [
        { n: 'saves', t: 'folder', go: '.minecraft/saves' },
        { n: 'resourcepacks', t: 'folder', go: '.minecraft/resourcepacks' },
        { n: 'screenshots', t: 'folder', go: '.minecraft/screenshots' },
        { n: 'versions', t: 'folder', go: '.minecraft/versions' },
        { n: 'logs', t: 'folder', go: '.minecraft/logs' }
    ];
    if (crashes.length) items.push({ n: 'crash-reports', t: 'folder', go: '.minecraft/crash-reports' });
    items.push(mcDoc('launcher_profiles.json', mcProfilesText(), '2 KB'));
    items.push(mcDoc('options.txt', mcOptionsText(), '1 KB'));
    // this IS the canonical .minecraft — junctioned from C:\Users\isaac\AppData\Roaming
    FS['.minecraft'] = { items: items, empty: '', label: MC_MCDIR,
        crumb: [['This PC', 'This PC'], ['Local Disk (C:)', 'C:'], ['Users', 'C:/Users'], ['isaac', 'C:/Users/isaac'],
            ['AppData', 'C:/Users/isaac/AppData'], ['Roaming', 'C:/Users/isaac/AppData/Roaming'], ['.minecraft', '.minecraft']],
        parent: 'C:/Users/isaac/AppData/Roaming' };
    if (!FS['.minecraft/saves']) mcSeedSaves();      // worlds carried over from the machine's history (honoring #73's lore)
    if (!FS['.minecraft/resourcepacks']) FS['.minecraft/resourcepacks'] = { items: [], empty: 'Drop resource packs here. These pixels are already pretty packed, though.' };
    if (!FS['.minecraft/screenshots']) mcSeedShots();
    FS['.minecraft/versions'] = {
        items: dl.map(function (v) { return { n: v, t: 'folder', go: '.minecraft/versions/' + v }; }),
        empty: 'Versions download themselves the first time you press PLAY.'
    };
    // drop folder keys for versions no longer downloaded, so a parked Explorer
    // doesn't keep showing a version the launcher just wiped
    Object.keys(FS).forEach(function (k) {
        if (k.indexOf('.minecraft/versions/') === 0 && dl.indexOf(k.slice(20)) < 0) delete FS[k];
    });
    dl.forEach(function (v) {
        FS['.minecraft/versions/' + v] = { items: [
            { n: v + '.jar', t: 'mcjar', size: mcJarSize(v), date: mcj('dld_' + v, dlStamp()) },
            mcDoc(v + '.json', mcVerJson(v), '38 KB')
        ], empty: '' };
    });
    FS['.minecraft/logs'] = {
        items: log ? [mcDoc('latest.log', log.text, '4 KB')] : [],
        empty: 'Logs show up after a launch. So far: silence.'
    };
    FS['.minecraft/crash-reports'] = {
        items: crashes.map(function (c) { return mcDoc(c.n, c.text, '6 KB'); }),
        empty: 'No crashes. Suspicious.'
    };
    // give every .minecraft subfolder the same Explorer metadata fsCompile authors for real
    // folders — a clickable breadcrumb CHAIN, a display label, a parent, and an address-bar index
    var mcRootCrumb = FS['.minecraft'].crumb;
    Object.keys(FS).forEach(function (k) {
        if (k.indexOf('.minecraft/') !== 0) return;
        var segs = k.slice(11).split('/'), crumb = mcRootCrumb.slice(), acc = '.minecraft';
        segs.forEach(function (s) { acc += '/' + s; crumb.push([s, acc]); });
        FS[k].crumb = crumb;
        FS[k].label = MC_MCDIR + '\\' + segs.join('\\');
        FS[k].parent = k.slice(0, k.lastIndexOf('/'));
        fsIndex(k);
    });
    fsIndex('.minecraft');   // register the canonical path so it resolves in the address bar / dev hooks
    // if an Explorer is parked on a folder the launcher just deleted (e.g. a version wiped by Reset),
    // climb it to the nearest surviving ancestor — otherwise itemsFor falls back to Home's contents
    // under a dead breadcrumb and a Delete there writes a bogus tombstone (QC finding, fs73)
    if (exState.explorer && exState.explorer.go && !FS[exState.explorer.path]) {
        var p = exState.explorer.path;
        while (p && p.indexOf('/') >= 0 && !FS[p]) p = p.slice(0, p.lastIndexOf('/'));
        exState.explorer.go(FS[p] ? p : 'This PC');
    }
    refreshFileViews();
}
function mcUntomb(path, name) {
    var st = fsLoad(), k = path + '/' + name, i = st.gone.indexOf(k);
    if (i >= 0) { st.gone.splice(i, 1); fsSave(); }
}
// Deleting a launcher-owned file tombstones it by name, and mcSyncFS regenerates
// the same names — so anything the launcher REWRITES must lift its tombstone or
// the file is gone for good while the launcher swears it wrote it. Only on real
// writes, never at boot: a reload must not undo a delete still sitting in the bin.
function mcUntombAll(path) {
    var f = FS[path]; if (!f) return;
    f.items.forEach(function (it) { if (!it.go) mcUntomb(path, it.n); });
}
function mcIsMcPath(k) { return k === '.minecraft' || k.indexOf('.minecraft/') === 0; }
function mcClearTombs() {
    // "rebuilt" means the folder's own contents: lift launcher tombstones, drop files
    // dragged in, and forget bin entries from it. The Home LISTING row (which the user
    // may have renamed) is left alone — that's their layout choice, not launcher data.
    var st = fsLoad();
    st.gone = st.gone.filter(function (k) { return !mcIsMcPath(k); });
    st.bin = st.bin.filter(function (e) { return !mcIsMcPath(String(e.from)); });
    Object.keys(st.add).forEach(function (p) { if (mcIsMcPath(p)) delete st.add[p]; });
    fsSave();
}
// "verify" earns its name: if you deleted the jar, the launcher notices and re-fetches it
function mcJarOnDisk(v) { return !!FS['.minecraft/versions/' + v] && fsHas('.minecraft/versions/' + v, v + '.jar'); }
function mcStopRun() {
    if (!MC || !MC.run) return;
    if (MC.run.timer) clearInterval(MC.run.timer);
    MC.run = null;   // also disarms the pending launch timeout, which checks MC.run === r
}

/* —— the launch pipeline: download → launch → hand off to the game (or crash honestly) —— */
function mcLogText(v, ok) {
    var n = new Date();
    // offsets roll through minutes AND hours — a launch at 10:59:58 logged 10:00:02 before
    function t(off) {
        var d = new Date(n.getTime() + off * 1000), p = function (x) { return ('0' + x).slice(-2); };
        return '[' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '] ';
    }
    var lines = [
        t(0) + '[main/INFO]: Setting user: isaacure',
        t(0) + '[main/INFO]: Loading Minecraft ' + v + ' with URE Launcher 2.29.1',
        t(1) + '[main/INFO]: Environment: UreOS 11 (Pixel Edition), Java 21.0.3',
        t(1) + '[Render thread/INFO]: Backend library: LWJGL version 3.3.3',
        t(2) + '[Render thread/INFO]: Reticulating pixel splines',
        t(2) + '[Render thread/INFO]: Found 512 assets, all of them square'
    ];
    if (ok) {
        lines.push(t(3) + '[Render thread/INFO]: Sound engine started');
        lines.push(t(3) + '[Render thread/INFO]: Created: 1024x512 textures-atlas');
        lines.push(t(4) + '[Render thread/INFO]: Setting screen: title. Have fun.');
    } else {
        lines.push(t(3) + '[Render thread/ERROR]: Unable to locate net.minecraft.client.main.Main');
        lines.push(t(3) + '[Render thread/ERROR]: java.lang.ClassNotFoundException: net.minecraft.client.main.Main');
        lines.push(t(4) + '[Render thread/FATAL]: The game quit before it existed. Crash report saved.');
    }
    return lines.join('\n');
}
function mcCrashText(v, when) {
    return ['---- Minecraft Crash Report ----',
        '// I just don\'t know what went wrong :(', '',
        'Time: ' + when,
        'Description: Initializing game', '',
        'java.lang.ClassNotFoundException: net.minecraft.client.main.Main',
        '\tat java.base/jdk.internal.loader.BuiltinClassLoader.loadClass(BuiltinClassLoader.java:641)',
        '\tat ureos.launcher.GameLoader.boot(GameLoader.java:52)',
        '\tat ureos.launcher.Main.run(Main.java:29)', '',
        '// The launcher is finished. The game is being built in another window.',
        '// Until it ships, this crash is the most honest thing on the machine.', '',
        '-- System Details --',
        '\tMinecraft Version: ' + v,
        '\tOperating System: UreOS 11 (Pixel Edition)',
        '\tJava Version: 21.0.3',
        '\tMemory: 2048 MB allocated, most of it pixels',
        '\tLauncher: URE Launcher 2.29.1',
        '\tGPU: Integrated Bloom Renderer (wallpaper-class)'].join('\n');
}
function mcPlay() {
    if (!MC || MC.run || MC.signedOut) return;   // Alt+P must respect the sign-in gate the UI enforces
    var inst = mcSelInst(); if (!inst) return;
    var v = mcResolveVer(inst.v);
    var dl = mcj('dl', []), need = dl.indexOf(v) < 0 || !mcJarOnDisk(v);   // a deleted jar is a missing jar
    var size = mcJarSize(v);
    MC.crashed = null;
    MC.run = { phase: need ? 'fetch' : 'verify', pct: 0, v: v, inst: inst,
        mb: (parseFloat(size) || 26.8), unit: /KB/.test(size) ? 'KB' : 'MB' };
    inst.lastUsed = dlStamp();
    mcjSet('inst', mcInst().map(function (i) { return i.id === inst.id ? inst : i; }));
    var step = reduce ? 22 : (need ? 4.5 : 16);
    MC.run.timer = setInterval(function () {
        var r = MC.run; if (!r) return;
        r.pct += step * (0.6 + Math.random() * 0.8);
        if (r.pct >= 100) {
            r.pct = 100;
            if (r.phase === 'fetch' || r.phase === 'verify') {
                if (r.phase === 'fetch') {
                    var list = mcj('dl', []);
                    if (list.indexOf(r.v) < 0) { list.push(r.v); mcjSet('dl', list); }
                    store('mc_dld_' + r.v, JSON.stringify(dlStamp()));
                    mcSyncFS();
                    mcUntombAll('.minecraft/versions/' + r.v);   // a re-download really does put the jar back
                    mcUntomb('.minecraft', 'versions');
                    refreshFileViews();
                }
                r.phase = 'launch'; r.pct = 0;
                setTimeout(function () { if (MC && MC.run === r) mcLaunchDone(r); }, reduce ? 120 : 1300);
                clearInterval(r.timer); r.timer = null;
                mcPaintPlay();
                return;
            }
        }
        mcPaintPlay();
    }, reduce ? 40 : 90);
    mcPaintPlay();
}
function mcLaunchDone(r) {
    // the game must be BOTH registered (APPS.minecraft, from #74) AND actually loaded (window.MC) to run;
    // if minecraft.js failed to load the launcher shows its honest crash instead. __mclForceCrash demos it.
    var ok = !window.__mclForceCrash && !!(APPS.minecraft && window.MC);
    mcjSet('log', { text: mcLogText(r.v, ok), v: r.v });
    mcSyncFS();
    mcUntomb('.minecraft/logs', 'latest.log'); mcUntomb('.minecraft', 'logs');
    mcUntomb('.minecraft', 'launcher_profiles.json');   // lastUsed just changed, so the file was rewritten
    refreshFileViews();
    MC.run = null;
    if (mcSet().openLog) openApp('notepad', { file: { n: 'latest.log', body: mcj('log', { text: '' }).text } });
    if (ok) {
        // THE SEAM — the game chat's app takes it from here
        openApp('minecraft', { version: r.v, installation: r.inst.n, skin: mcSkin() });
        toast('Launching Minecraft ' + r.v + '…');
        if (!mcSet().keepOpen && openWins.mclauncher) minWin('mclauncher');
        mcPaintPlay();
        return;
    }
    var when = dlStamp(), n = new Date();
    var stem = 'crash-' + n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2) + '-' + ('0' + n.getDate()).slice(-2) +
        '_' + ('0' + n.getHours()).slice(-2) + '.' + ('0' + n.getMinutes()).slice(-2) + '.' + ('0' + n.getSeconds()).slice(-2) + '-client';
    var crashes = mcj('crash', []), fname = stem + '.txt';
    for (var ci = 2; crashes.some(function (c) { return c.n === fname; }); ci++) fname = stem + ' (' + ci + ').txt';   // two crashes can share a second
    crashes.unshift({ n: fname, text: mcCrashText(r.v, when) });
    if (crashes.length > 3) crashes.length = 3;
    mcjSet('crash', crashes);
    mcSyncFS();
    mcUntomb('.minecraft', 'crash-reports');
    refreshFileViews();
    MC.crashed = fname;
    // the crash strip lives outside the play slot, so this needs the full page back
    if (MC.tab === 'play' && MC.game === 'java' && !MC.signedOut) mcPage(); else mcPaintPlay();
    dlgOpen('Minecraft: Java Edition', '<p class="dlg-msg"><b>The game crashed!</b></p>' +
        '<p class="dlg-msg">Exit code: 1</p>' +
        '<p class="dlg-msg" style="opacity:.75">java.lang.ClassNotFoundException: net.minecraft.client.main.Main<br>' +
        'A crash report was saved to ' + MC_MCDIR + '\\crash-reports\\' + esc(fname) + '</p>', [
        ['Open crash report', 'primary', function () { openApp('notepad', { file: { n: fname, body: mcCrashText(r.v, when) } }); }],
        ['Close', '', null]
    ]);
}

/* —— rendering: shell, then one page at a time into .mcl-main —— */
function renderMC(id, arg) {
    return '<div class="mcl"><aside class="mcl-rail">' +
        '<button class="mcl-acct" type="button" data-mca="acct" aria-haspopup="menu">' + mcFaceSvg(mcSkin()) +
            '<span class="mcl-acct-name">isaacure</span><b class="mcl-caret">▾</b></button>' +
        '<nav class="mcl-games" aria-label="Games">' + MC_GAMES.map(function (g) {
            return '<button class="mcl-game" type="button" data-mcg="' + g.id + '">' +
                pxSvg(MC_RAIL_ART[g.id].r, MC_RAIL_ART[g.id].p, 'mcl-rail-ic') +
                '<span><b>' + g.top + '</b><i>' + g.sub + '</i></span></button>';
        }).join('') + '</nav>' +
        '<button class="mcl-game mcl-rail-set" type="button" data-mcg="lsettings">' + ic('ic-settings') + '<span><b>Settings</b></span></button>' +
        '</aside><div class="mcl-main"></div></div>';
}
/* Dialogs outlive the window that opened them: the user can close the launcher
   while a confirm is up, and the callback still fires. Every launcher dialog
   callback goes through this, so a dead MC means the answer is simply dropped —
   and a REOPENED launcher is a different instance, so its stale confirm is dropped
   too (else a "Delete?" from the closed session would hit the fresh one). */
function mcLive(fn) { var owner = MC; return function () { if (MC && MC === owner) fn(); }; }

function mcGo(tab) {
    if (!MC) return;
    if (MC.skinEdit && MC.skinEdit.dirty && tab !== 'skins') {
        var t2 = tab;
        dlgConfirm('Discard skin?', 'The skin editor has unsaved pixels.', 'Discard', mcLive(function () { MC.skinEdit = null; mcGo(t2); }));
        return;
    }
    if (tab !== 'skins') MC.skinEdit = null;
    MC.tab = tab; mcPage();
}
function mcGame(g) {
    if (!MC) return;
    MC.game = g; MC.pop = null;
    if (g === 'java' && !MC.tab) MC.tab = 'play';
    mcPage();
}
function mcPage() {
    if (!MC) return;
    mcCloseMenu();                               // a menu must never outlive the page it was opened from
    var main = MC.el.querySelector('.mcl-main'); if (!main) return;
    var fresh = main.cloneNode(false);           // listeners never stack — lesson learned in Chrome (#62)
    main.replaceWith(fresh); main = fresh;
    MC.el.querySelectorAll('.mcl-game').forEach(function (b) {
        b.classList.toggle('sel', b.getAttribute('data-mcg') === (MC.game === 'lsettings' ? 'lsettings' : MC.game));
    });
    if (MC.signedOut) main.innerHTML = mcSignIn();
    else if (MC.game === 'java') main.innerHTML = mcJavaPage();
    else if (MC.game === 'lsettings') main.innerHTML = mcSettingsPage();
    else main.innerHTML = mcOtherGame(MC.game);
    if (MC.skinEdit) mcWireEditor(main);
    var body = main.querySelector('.mcl-body');
    if (body && MC.scroll && MC.scroll[MC.game + ':' + MC.tab]) body.scrollTop = MC.scroll[MC.game + ':' + MC.tab];
    if (find.appId === 'mclauncher' && findOpenNow()) runFind();
}
function mcTabsBar() {
    var tabs = [['play', 'Play'], ['installations', 'Installations'], ['skins', 'Skins'], ['notes', 'Patch Notes']];
    return '<div class="mcl-tabs" role="tablist">' + tabs.map(function (t) {
        return '<button class="mcl-tab' + (MC.tab === t[0] ? ' sel' : '') + '" type="button" role="tab" data-mct="' + t[0] + '" aria-selected="' + (MC.tab === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div>';
}
function mcJavaPage() {
    var head = '<header class="mcl-head"><span class="mcl-head-title">Minecraft: Java Edition</span>' + mcTabsBar() + '</header>';
    if (MC.tab === 'installations') return head + mcInstPage();
    if (MC.tab === 'skins') return head + mcSkinsPage();
    if (MC.tab === 'notes') return head + mcNotesPage();
    return head + mcPlayPage();
}

/* —— Play tab —— */
function mcPlayPage() {
    var inst = mcSelInst(), v = mcResolveVer(inst.v), vi = mcVer(v);
    var crash = MC.crashed ? '<div class="mcl-crashbar"><span>Minecraft: Java Edition just crashed. It left a note.</span>' +
        '<button class="mcl-linkbtn" type="button" data-mca="crashlog">View crash report</button>' +
        '<button class="mcl-crashx" type="button" data-mca="crashx" aria-label="Dismiss">✕</button></div>' : '';
    return '<div class="mcl-body mcl-playwrap">' +
        '<div class="mcl-hero' + (mcSet().animArt && !reduce ? ' anim' : '') + '">' + mcHero() +
            '<div class="mcl-logo"><span class="mcl-logotype">MINECRAFT</span><span class="mcl-edition">JAVA EDITION</span></div>' +
        '</div>' + crash +
        '<div class="mcl-playbar">' +
            '<button class="mcl-instsel" type="button" data-mca="instpick" aria-haspopup="listbox">' +
                mcBlockIcon(inst.icon) + '<span class="mcl-instsel-tx"><b>' + esc(inst.n) + '</b>' +
                '<i>' + esc(v + (vi && vi.n ? ' · ' + vi.n : '')) + '</i></span><b class="mcl-caret">▾</b></button>' +
            '<div class="mcl-playslot">' + mcPlayBtnHtml() + '</div>' +
            '<div class="mcl-playwho">' + mcFaceSvg(mcSkin()) + '<span>isaacure</span></div>' +
        '</div></div>';
}
function mcPlayBtnHtml() {
    var r = MC.run;
    if (!r) return '<button class="mcl-play" type="button" data-mca="play">PLAY</button>';
    var label = r.phase === 'launch' ? 'LAUNCHING…' :
        (r.phase === 'verify' ? 'VERIFYING… ' + Math.floor(r.pct) + '%' :
        'DOWNLOADING ' + Math.floor(r.pct) + '%');
    var u = r.unit || 'MB';
    var sub = r.phase === 'fetch' ? '<i>' + (r.mb * r.pct / 100).toFixed(1) + ' ' + u + ' / ' + r.mb.toFixed(1) + ' ' + u + '</i>' : '';
    return '<div class="mcl-play dl"><span class="mcl-playfill" style="width:' + (r.phase === 'launch' ? 100 : r.pct) + '%"></span><span class="mcl-playtx">' + label + sub + '</span></div>';
}
function mcPaintPlay() {
    if (!MC || MC.signedOut) return;   // no play slot behind the sign-in page: the fallback would re-render every tick
    var slot = MC.el.querySelector('.mcl-playslot');
    if (slot) slot.innerHTML = mcPlayBtnHtml();
    else if (MC.tab === 'play' && MC.game === 'java') mcPage();
}

/* —— Installations tab —— */
function mcInstPage() {
    if (MC.edit) return mcInstForm();
    var q = (MC.instQ || '').toLowerCase();
    var list = mcVisibleInst().filter(function (i) { return !q || i.n.toLowerCase().indexOf(q) >= 0; });
    return '<div class="mcl-body"><div class="mcl-toolbar">' +
        '<input class="mcl-search" type="text" data-mcin="instq" placeholder="Search installations" value="' + esc(MC.instQ || '') + '" spellcheck="false">' +
        '<button class="mcl-btn" type="button" data-mca="openmc" title="Open .minecraft">' + ic('ic-folder') + '</button>' +
        '<button class="mcl-btn green" type="button" data-mca="newinst">New installation</button></div>' +
        // the list host is ALWAYS present so live filtering can hide/show rows in place
        // (a full re-render would steal focus from the search box the user is typing in)
        '<div class="mcl-instlist">' + list.map(function (i) {
            var v = mcResolveVer(i.v), dl = mcj('dl', []).indexOf(v) >= 0;
            return '<div class="mcl-inst" data-inst="' + esc(i.id) + '">' + mcBlockIcon(i.icon) +
                '<span class="mcl-inst-tx"><b>' + esc(i.n) + '</b><i>' + esc(v) + (dl ? '' : ' · not downloaded') + (i.lastUsed ? ' · played ' + esc(i.lastUsed) : '') + '</i></span>' +
                '<span class="mcl-inst-acts">' +
                '<button class="mcl-btn sm" type="button" data-mca="instdir" data-id="' + esc(i.id) + '" title="Open folder">' + ic('ic-folder') + '</button>' +
                '<button class="mcl-btn sm green" type="button" data-mca="instplay" data-id="' + esc(i.id) + '">Play</button>' +
                '<button class="mcl-btn sm" type="button" data-mca="instmenu" data-id="' + esc(i.id) + '" aria-haspopup="menu">⋮</button>' +
                '</span></div>';
        }).join('') + '</div>' +
        '<p class="mcl-emptymsg"' + (list.length ? ' hidden' : '') + '>Nothing matches. The versions are all still there, promise.</p>' +
        '</div>';
}
function mcInstForm() {
    var e = MC.edit, isNew = !e.id;
    var vers = MC_VERS.filter(function (v) {
        if (v.t === 'snapshot' && !mcSet().snapshots && e.v !== v.id) return false;
        return true;
    });
    var groups = [['release', 'Releases'], ['snapshot', 'Snapshots'], ['beta', 'Old Beta'], ['alpha', 'Old Alpha'], ['fools', 'April Fools']];
    return '<div class="mcl-body mcl-form"><h2>' + (isNew ? 'Create new installation' : 'Edit installation') + '</h2>' +
        '<label class="mcl-field"><span>Name</span><input class="mcl-input" type="text" data-mcin="instname" maxlength="40" placeholder="unnamed installation" value="' + esc(e.n || '') + '" spellcheck="false"></label>' +
        '<div class="mcl-field"><span>Icon</span><div class="mcl-iconrow">' +
            '<button class="mcl-iconcur" type="button" data-mca="iconpick">' + mcBlockIcon(e.icon) + '<b class="mcl-caret">▾</b></button>' +
            (MC.pop === 'icons' ? '<div class="mcl-icongrid">' + MC_ICON_ORDER.map(function (k) {
                return '<button class="mcl-iconopt' + (k === e.icon ? ' sel' : '') + '" type="button" data-mca="iconset" data-id="' + k + '">' + mcBlockIcon(k) + '</button>';
            }).join('') + '</div>' : '') + '</div></div>' +
        '<div class="mcl-field"><span>Version</span><div class="mcl-iconrow">' +
            '<button class="mcl-versel" type="button" data-mca="verpick">' + esc(mcVerLabel(e.v)) + '<b class="mcl-caret">▾</b></button>' +
            (MC.pop === 'vers' ? '<div class="mcl-verlist" role="listbox">' +
                '<button class="mcl-veropt' + (e.v === 'latest-release' ? ' sel' : '') + '" type="button" data-mca="verset" data-id="latest-release">Latest release (' + esc(mcLatest('release')) + ')</button>' +
                (mcSet().snapshots ? '<button class="mcl-veropt' + (e.v === 'latest-snapshot' ? ' sel' : '') + '" type="button" data-mca="verset" data-id="latest-snapshot">Latest snapshot (' + esc(mcLatest('snapshot')) + ')</button>' : '') +
                groups.map(function (g) {
                    var vs = vers.filter(function (v) { return v.t === g[0]; });
                    if (!vs.length) return '';
                    return '<div class="mcl-vergroup">' + g[1] + '</div>' + vs.map(function (v) {
                        return '<button class="mcl-veropt' + (e.v === v.id ? ' sel' : '') + '" type="button" data-mca="verset" data-id="' + esc(v.id) + '">' + esc(v.id) + '<i>' + esc(v.d) + '</i></button>';
                    }).join('');
                }).join('') + '</div>' : '') + '</div></div>' +
        '<details class="mcl-more"><summary>More options</summary>' +
            '<label class="mcl-field"><span>Game directory</span><input class="mcl-input" type="text" data-mcin="instdir" value="' + esc(e.dir || MC_MCDIR) + '" spellcheck="false"></label>' +
            '<label class="mcl-field"><span>JVM arguments</span><input class="mcl-input" type="text" data-mcin="instjvm" value="' + esc(e.jvm || '-Xmx2G -XX:+UseG1GC') + '" spellcheck="false"></label>' +
        '</details>' +
        '<div class="mcl-formbtns"><button class="mcl-btn" type="button" data-mca="instcancel">Cancel</button>' +
        '<button class="mcl-btn green" type="button" data-mca="instsave">' + (isNew ? 'Create' : 'Save') + '</button></div></div>';
}
function mcVerLabel(v) {
    if (v === 'latest-release') return 'Latest release (' + mcLatest('release') + ')';
    if (v === 'latest-snapshot') return 'Latest snapshot (' + mcLatest('snapshot') + ')';
    return v;
}

/* —— Skins tab + editor —— */
var MC_PALETTE = ['#f9fffe', '#c7c7c7', '#9d9d97', '#6e6e6e', '#474f52', '#1d1d21',
    '#b02e26', '#d81e05', '#f9801d', '#ffd83d', '#80c71f', '#5e7c16', '#3a8a30',
    '#169c9c', '#3ab3da', '#3c44aa', '#4a3fb0', '#8932b8', '#c74ebd', '#f38baa',
    '#835432', '#5a3d24', '#2b1c10', '#bd8b72', '#e3b18a', '#d9a877', '#a5735c', '#00a8a8'];
function mcSkinsPage() {
    if (MC.skinEdit) return mcEditorPage();
    var active = mcSkin().id;
    return '<div class="mcl-body"><div class="mcl-toolbar"><span class="mcl-tbtitle">Skin library</span>' +
        '<button class="mcl-btn green" type="button" data-mca="newskin">New skin</button></div>' +
        '<div class="mcl-skingrid">' + mcSkins().map(function (s) {
            return '<div class="mcl-skincard' + (s.id === active ? ' active' : '') + '" data-skin="' + esc(s.id) + '">' +
                '<div class="mcl-skinstage">' + mcSkinSvg(s) + (s.id === active ? '<span class="mcl-skinuse-on">ACTIVE</span>' : '') + '</div>' +
                '<div class="mcl-skinmeta"><b>' + esc(s.n) + '</b><i>' + (s.model === 'slim' ? 'Slim' : 'Classic') + '</i></div>' +
                '<div class="mcl-skinacts">' +
                (s.id === active ? '' : '<button class="mcl-btn sm green" type="button" data-mca="skinuse" data-id="' + esc(s.id) + '">Use</button>') +
                '<button class="mcl-btn sm" type="button" data-mca="skinmenu" data-id="' + esc(s.id) + '" aria-haspopup="menu">⋮</button>' +
                '</div></div>';
        }).join('') + '</div></div>';
}
function mcNewSkinData(from) {
    var base = from || mcSkins()[0];
    return { id: null, n: from ? 'Copy of ' + from.n : 'New skin', model: base.model,
        pal: base.pal.slice(), rows: base.rows.slice(), dirty: false,
        tool: 'pencil', color: '#d81e05', mirror: true, undo: [] };
}
function mcEditorPage() {
    var e = MC.skinEdit;
    return '<div class="mcl-body mcl-editor">' +
        '<div class="mcl-edtop">' +
            '<input class="mcl-input mcl-edname" type="text" data-mcin="skinname" maxlength="32" value="' + esc(e.n) + '" spellcheck="false">' +
            '<div class="mcl-edmodel"><button class="mcl-btn sm' + (e.model === 'classic' ? ' green' : '') + '" type="button" data-mca="model" data-id="classic">Classic</button>' +
            '<button class="mcl-btn sm' + (e.model === 'slim' ? ' green' : '') + '" type="button" data-mca="model" data-id="slim">Slim</button></div>' +
            '<span class="mcl-edsp"></span>' +
            '<button class="mcl-btn" type="button" data-mca="edcancel">Cancel</button>' +
            '<button class="mcl-btn green" type="button" data-mca="edsave">Save skin</button></div>' +
        '<div class="mcl-edwrap">' +
            '<div class="mcl-edcanvas"><canvas class="mcl-edc" width="224" height="448"></canvas></div>' +
            '<div class="mcl-edside">' +
                '<div class="mcl-edtools">' + [['pencil', '✏'], ['eraser', '⬜'], ['fill', '🪣'], ['pick', '💉']].map(function (t) {
                    return '<button class="mcl-tool' + (e.tool === t[0] ? ' sel' : '') + '" type="button" data-mca="tool" data-id="' + t[0] + '" title="' + t[0] + '">' + t[1] + '</button>';
                }).join('') +
                '<button class="mcl-tool' + (e.mirror ? ' sel' : '') + '" type="button" data-mca="mirror" title="Mirror painting">⇄</button>' +
                '<button class="mcl-tool" type="button" data-mca="edundo" title="Undo">↶</button></div>' +
                '<div class="mcl-edpal">' + MC_PALETTE.map(function (c) {
                    return '<button class="mcl-swatch' + (e.color === c ? ' sel' : '') + '" type="button" data-mca="swatch" data-id="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>';
                }).join('') + '</div>' +
                '<div class="mcl-edprev">' + mcSkinSvg({ pal: e.pal, rows: e.rows, model: e.model }) + '</div>' +
            '</div></div></div>';
}
function mcEdColorAt(e, x, y) {
    var ch = e.rows[y].charAt(x);
    return ch === '.' ? null : e.pal[MC_CHARS.indexOf(ch)] || null;
}
function mcEdSetPx(e, x, y, color) {
    if (!mcRegion(x, y)) return false;
    if (e.model === 'slim' && y >= 8 && y < 20 && (x === 0 || x === 15)) return false;
    var ch = '.';
    if (color) {
        var i = e.pal.indexOf(color);
        if (i < 0) {
            if (e.pal.length >= MC_CHARS.length) { toast('This skin has hit ' + MC_CHARS.length + ' colors. Even wool stops at 16.'); return false; }
            e.pal.push(color); i = e.pal.length - 1;
        }
        ch = MC_CHARS.charAt(i);
    }
    if (e.rows[y].charAt(x) === ch) return false;
    e.rows[y] = e.rows[y].slice(0, x) + ch + e.rows[y].slice(x + 1);
    return true;
}
function mcEdFill(e, x, y, color) {
    var target = mcEdColorAt(e, x, y), region = mcRegion(x, y);
    if (!region || target === color) return false;
    var q = [[x, y]], seen = {}, n = 0, changed = false;
    while (q.length && n++ < 600) {
        var c = q.pop(), cx = c[0], cy = c[1], k = cx + ',' + cy;
        if (seen[k] || cx < 0 || cx > 15 || cy < 0 || cy > 31) continue;
        seen[k] = 1;
        if (mcRegion(cx, cy) !== region || mcEdColorAt(e, cx, cy) !== target) continue;
        if (mcEdSetPx(e, cx, cy, color)) changed = true;
        q.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    return changed;
}
function mcEdPaint(cv) {
    var e = MC.skinEdit, ctx = cv.getContext('2d'), s = 14, x, y;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (y = 0; y < 32; y++) for (x = 0; x < 16; x++) {
        var reg = mcRegion(x, y);
        var dead = !reg || (e.model === 'slim' && y >= 8 && y < 20 && (x === 0 || x === 15));
        if (dead) { ctx.fillStyle = '#1b1b1f'; ctx.fillRect(x * s, y * s, s, s); continue; }
        var col = mcEdColorAt(e, x, y);
        ctx.fillStyle = ((x + y) % 2) ? '#33333a' : '#3c3c44';
        ctx.fillRect(x * s, y * s, s, s);
        if (col) { ctx.fillStyle = col; ctx.fillRect(x * s, y * s, s, s); }
    }
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1;
    for (x = 0; x <= 16; x++) { ctx.beginPath(); ctx.moveTo(x * s + .5, 0); ctx.lineTo(x * s + .5, 448); ctx.stroke(); }
    for (y = 0; y <= 32; y++) { ctx.beginPath(); ctx.moveTo(0, y * s + .5); ctx.lineTo(224, y * s + .5); ctx.stroke(); }
    // region seams: head / torso / legs
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    [[0, 8 * s, 224, 0], [0, 20 * s, 224, 0], [4 * s, 0, 0, 448], [12 * s, 0, 0, 448]].forEach(function (l) {
        ctx.beginPath(); ctx.moveTo(l[0] + .5, l[1] + .5); ctx.lineTo(l[0] + l[2] + .5, l[1] + l[3] + .5); ctx.stroke();
    });
}
function mcWireEditor(main) {
    var cv = main.querySelector('.mcl-edc'); if (!cv) return;
    var e = MC.skinEdit;
    mcEdPaint(cv);
    function cellOf(ev) {
        var r = cv.getBoundingClientRect();
        var x = Math.floor((ev.clientX - r.left) / (r.width / 16));
        var y = Math.floor((ev.clientY - r.top) / (r.height / 32));
        return (x >= 0 && x < 16 && y >= 0 && y < 32) ? [x, y] : null;
    }
    var stroke = null;   // { snap, pushed } for the drag in flight
    function apply(ev) {
        var c = cellOf(ev); if (!c) return;
        var x = c[0], y = c[1], changed = false;
        if (e.tool === 'pick') { var got = mcEdColorAt(e, x, y); if (got) { e.color = got; MC.pop = null; mcPage(); } return; }
        if (e.tool === 'fill') {
            changed = mcEdFill(e, x, y, e.color);
            if (e.mirror && mcEdFill(e, 15 - x, y, e.color)) changed = true;
        } else {
            var col = e.tool === 'eraser' ? null : e.color;
            changed = mcEdSetPx(e, x, y, col);
            if (e.mirror && mcEdSetPx(e, 15 - x, y, col)) changed = true;
        }
        if (!changed) return;
        // the undo entry lands only once per stroke, and only if the stroke did anything
        if (stroke && !stroke.pushed) { e.undo.push(stroke.snap); if (e.undo.length > 40) e.undo.shift(); stroke.pushed = true; }
        e.dirty = true;
        mcEdPaint(cv);
        var prev = main.querySelector('.mcl-edprev');
        if (prev) prev.innerHTML = mcSkinSvg({ pal: e.pal, rows: e.rows, model: e.model });
    }
    cv.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0) return;
        stroke = { snap: { rows: e.rows.slice(), pal: e.pal.slice() }, pushed: false };
        cv.setPointerCapture(ev.pointerId);
        apply(ev);
        function mv(ev2) {
            if (!ev2.buttons) return up();   // the button went up somewhere we couldn't hear it
            if (e.tool === 'pencil' || e.tool === 'eraser') apply(ev2);
        }
        function up() {
            stroke = null;
            cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
        }
        cv.addEventListener('pointermove', mv); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    });
}

/* —— Patch Notes tab —— */
function mcNotesPage() {
    if (MC.note != null) {
        var n = MC_NOTES[MC.note];
        return '<div class="mcl-body mcl-noteview">' +
            '<button class="mcl-btn" type="button" data-mca="notesback">← All patch notes</button>' +
            '<div class="mcl-notehero">' + pxSvg(MC_ART[n.art].r, MC_ART[n.art].p, 'mcl-noteart-big') + '</div>' +
            '<h2>' + esc(n.name) + '</h2><p class="mcl-notedate">' + esc(n.v) + ' · ' + esc(n.d) + '</p>' +
            '<ul class="mcl-notelist">' + n.b.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>';
    }
    return '<div class="mcl-body"><div class="mcl-notegrid">' + MC_NOTES.map(function (n, i) {
        return '<button class="mcl-notecard" type="button" data-mca="note" data-id="' + i + '">' +
            '<span class="mcl-noteart">' + pxSvg(MC_ART[n.art].r, MC_ART[n.art].p) + '</span>' +
            '<span class="mcl-notemeta"><b>' + esc(n.name) + '</b><i>' + esc(n.v) + ' · ' + esc(n.d) + '</i></span></button>';
    }).join('') + '</div></div>';
}

/* —— Settings + other games + sign-in —— */
function mcToggle(key, label, hint) {
    var on = !!mcSet()[key];
    return '<div class="mcl-setrow"><span class="mcl-set-tx"><b>' + label + '</b>' + (hint ? '<i>' + hint + '</i>' : '') + '</span>' +
        '<button class="mcl-switch' + (on ? ' on' : '') + '" type="button" role="switch" aria-checked="' + on + '" data-mca="settoggle" data-id="' + key + '"><span></span></button></div>';
}
function mcSettingsPage() {
    var sub = MC.setTab || 'general';
    var head = '<header class="mcl-head"><span class="mcl-head-title">Settings</span><div class="mcl-tabs">' +
        '<button class="mcl-tab' + (sub === 'general' ? ' sel' : '') + '" type="button" data-mcs="general">General</button>' +
        '<button class="mcl-tab' + (sub === 'about' ? ' sel' : '') + '" type="button" data-mcs="about">About</button></div></header>';
    if (sub === 'about') {
        return head + '<div class="mcl-body mcl-setbody"><div class="mcl-aboutcard">' + mcBlockIcon('grass', 'mcl-block lg') +
            '<div><b>URE Launcher 2.29.1</b><i>Runs on UreOS 11 (Pixel Edition)</i><i>Blocks by Mojang, in spirit. Pixels by this machine.</i></div></div>' +
            '<div class="mcl-setrow"><span class="mcl-set-tx"><b>Third-party licenses</b><i>Legally fascinating</i></span>' +
            '<button class="mcl-btn sm" type="button" data-mca="licenses">View</button></div>' +
            '<div class="mcl-setrow"><span class="mcl-set-tx"><b>The game itself</b><i>Being built in another window. The launcher holds the door.</i></span></div></div>';
    }
    return head + '<div class="mcl-body mcl-setbody">' +
        mcToggle('keepOpen', 'Keep the launcher open while the game is running', 'Off hides it into the taskbar on launch') +
        mcToggle('openLog', 'Open the output log when the game starts', 'latest.log, in Notepad, like it is 2012') +
        mcToggle('snapshots', 'Show snapshot versions', 'Enables snapshots in installations and version lists') +
        mcToggle('animArt', 'Animate the Play screen art', 'The panorama drifts. Slowly. Like clouds.') +
        '<div class="mcl-setrow"><span class="mcl-set-tx"><b>Storage directory</b><i>' + MC_MCDIR + '</i></span>' +
        '<button class="mcl-btn sm" type="button" data-mca="openmc">Open folder</button></div>' +
        '<div class="mcl-setrow"><span class="mcl-set-tx"><b>Reset launcher data</b><i>Installations, skins, downloads, crashes. All of it.</i></span>' +
        '<button class="mcl-btn sm danger" type="button" data-mca="mcreset">Reset</button></div></div>';
}
var MC_OTHER = {
    bedrock: { blurb: 'The one written in C++. This machine runs UreOS 11 (Pixel Edition), which Windows insists is not Windows.', btn: 'UNAVAILABLE', dis: 1 },
    dungeons: { blurb: 'Four-player dungeon crawling. Needs 2.4 GB of pixels; the wallpaper is currently using them.', btn: 'INSTALL' },
    legends: { blurb: 'Lead the overworld against the piglin invasion. The overworld here is 44 pixels tall.', btn: 'INSTALL' },
    education: { blurb: 'Minecraft for classrooms. Your school IT admin has not approved this request. His name is also Isaac.', btn: 'REQUEST ACCESS' }
};
function mcOtherGame(g) {
    var game = null, i;
    for (i = 0; i < MC_GAMES.length; i++) if (MC_GAMES[i].id === g) game = MC_GAMES[i];
    var o = MC_OTHER[g] || { blurb: '', btn: 'OK' };
    return '<header class="mcl-head solo"><span class="mcl-head-title">' + (game ? esc(game.top + ' ' + game.sub) : '') + '</span></header>' +
        '<div class="mcl-body mcl-otherwrap"><div class="mcl-otherart">' + pxSvg(MC_RAIL_ART[g].r, MC_RAIL_ART[g].p, 'mcl-otherart-px') + '</div>' +
        '<h2>' + (game ? game.top + ' ' + game.sub : '') + '</h2>' +
        '<p class="mcl-otherblurb">' + esc(o.blurb) + '</p>' +
        '<button class="mcl-play sm' + (o.dis ? ' dis' : '') + '" type="button" ' + (o.dis ? 'disabled' : 'data-mca="otherbtn" data-id="' + g + '"') + '>' + o.btn + '</button></div>';
}
function mcSignIn() {
    return '<div class="mcl-body mcl-signin"><div class="mcl-signbox">' +
        '<span class="mcl-logotype sm">MINECRAFT</span>' +
        '<p>Sign in with your Microsoft account to play.</p>' +
        '<button class="mcl-play sm" type="button" data-mca="signin">SIGN IN</button>' +
        '<i>Forgot which of the two buttons on this machine you are? It happens.</i></div></div>';
}

/* —— init: one delegated handler; no listener ever stacks —— */
function initMC(el, id, arg) {
    MC = { el: el, game: 'java', tab: 'play', run: null, crashed: null, edit: null, skinEdit: null,
        note: null, pop: null, instQ: '', scroll: {}, setTab: 'general', signedOut: false, menuEl: null, menuFor: null };
    mcSkins(1); mcInst(1);   // seed on first open — this is that moment
    el._mc = {
        go: function (t) { mcGame('java'); mcGo(t); },
        // Alt+P is "press the big green button", so it has to land you where the button is
        play: function () {
            if (MC.run) { toast('Already working on ' + MC.run.v + '…'); return; }
            mcGame('java'); mcGo('play');
            if (MC.tab === 'play' && !MC.skinEdit) mcPlay();   // a dirty-editor confirm gets the last word
        },
        newInstall: function () { mcGame('java'); MC.tab = 'installations'; MC.edit = { n: '', icon: 'grass', v: 'latest-release' }; mcPage(); },
        settings: function () { mcGame('lsettings'); }
    };
    el.addEventListener('click', function (ev) { mcClick(ev); });
    el.addEventListener('input', function (ev) { mcInput(ev); });
    var body = el.querySelector('.mcl-main');
    el.addEventListener('scroll', function (ev) {
        var b = ev.target;
        if (b && b.classList && b.classList.contains('mcl-body') && MC) MC.scroll[MC.game + ':' + MC.tab] = b.scrollTop;
    }, true);
    if (arg && arg.tab) { MC.tab = arg.tab; }
    if (arg && arg.game) { MC.game = arg.game; }
    mcPage();
}
var mcMenuDoc = null;   // the outside-click dismissal, alive only while a menu is
function mcCloseMenu() {
    if (mcMenuDoc) { document.removeEventListener('click', mcMenuDoc, true); mcMenuDoc = null; }
    if (MC && MC.menuEl) { MC.menuEl.remove(); MC.menuEl = null; MC.menuFor = null; }
}
function mcMenu(anchor, items, fn) {
    if (MC.menuEl && MC.menuFor === anchor) { mcCloseMenu(); return; }   // its own button toggles it shut
    mcCloseMenu();
    var m = document.createElement('div');
    m.className = 'mcl-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = items.map(function (it) {
        return '<button class="mcl-menu-i' + (it.danger ? ' danger' : '') + '" type="button" role="menuitem" data-mk="' + it.k + '">' + esc(it.t) + '</button>';
    }).join('');
    MC.el.appendChild(m);
    // the window clips its overflow, so a menu that would hang past the bottom
    // opens UPWARD instead — the play bar's picker lives on the last row
    var wr = MC.el.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    var mh = m.offsetHeight, mw = m.offsetWidth;
    var top = ar.bottom - wr.top + 4;
    if (top + mh > wr.height - 4) top = ar.top - wr.top - mh - 4;
    m.style.top = clamp(top, 4, Math.max(4, wr.height - mh - 4)) + 'px';
    m.style.left = clamp(ar.left - wr.left, 4, Math.max(4, wr.width - mw - 4)) + 'px';
    m.addEventListener('click', function (ev) {
        var b = ev.target.closest('.mcl-menu-i'); if (!b) return;
        ev.stopPropagation(); mcCloseMenu(); fn(b.getAttribute('data-mk'));
    });
    MC.menuEl = m; MC.menuFor = anchor;
    // dismiss on any outside click, like every other menu on this machine
    mcMenuDoc = function (ev) {
        if (ev.target.closest('.mcl-menu')) return;
        if (MC && MC.menuFor && ev.target.closest('[data-mca]') === MC.menuFor) return;   // let the anchor toggle
        mcCloseMenu();
    };
    setTimeout(function () { if (mcMenuDoc) document.addEventListener('click', mcMenuDoc, true); }, 0);
}
function mcInstById(id) { var l = mcInst(), i; for (i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
function mcSkinById(id) { var l = mcSkins(), i; for (i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
function mcInput(ev) {
    var t = ev.target, k = t.getAttribute && t.getAttribute('data-mcin');
    if (!k || !MC) return;
    if (k === 'instq') { MC.instQ = t.value; mcPatchInstList(); }
    else if (k === 'instname') MC.edit.n = t.value;
    else if (k === 'instdir') MC.edit.dir = t.value;
    else if (k === 'instjvm') MC.edit.jvm = t.value;
    else if (k === 'skinname') { MC.skinEdit.n = t.value; MC.skinEdit.dirty = true; }
}
function mcPatchInstList() {
    // live-filter in place — never a full re-render, so the search box keeps focus/caret
    var body = MC.el.querySelector('.mcl-body'); if (!body) return;
    var host = body.querySelector('.mcl-instlist'); if (!host) return;
    var q = (MC.instQ || '').toLowerCase();
    var list = mcVisibleInst().filter(function (i) { return !q || i.n.toLowerCase().indexOf(q) >= 0; });
    host.querySelectorAll('.mcl-inst').forEach(function (row) {
        var id = row.getAttribute('data-inst'), keep = list.some(function (i) { return i.id === id; });
        row.style.display = keep ? '' : 'none';
    });
    var empty = body.querySelector('.mcl-emptymsg'); if (empty) empty.hidden = list.length > 0;
}
function mcClick(ev) {
    if (!MC) return;
    var b = ev.target.closest('[data-mca],[data-mcg],[data-mct],[data-mcs]');
    // clicking the button that opened a menu is a toggle, so leave that one to mcMenu
    if (!ev.target.closest('.mcl-menu') && !(MC.menuFor && b === MC.menuFor)) mcCloseMenu();
    if (!b || !MC.el.contains(b)) {
        if (MC.pop && !ev.target.closest('.mcl-icongrid,.mcl-verlist')) { MC.pop = null; mcPage(); }
        return;
    }
    var g = b.getAttribute('data-mcg'), t = b.getAttribute('data-mct'), s = b.getAttribute('data-mcs'), a = b.getAttribute('data-mca');
    if (g) { if (MC.signedOut) return; mcGame(g); return; }
    if (t) { mcGo(t); return; }
    if (s) { MC.setTab = s; mcPage(); return; }
    if (!a) return;
    var id = b.getAttribute('data-id');
    switch (a) {
        case 'acct':
            if (MC.signedOut) return;
            mcMenu(b, [{ k: 'manage', t: 'Manage account' }, { k: 'logout', t: 'Log out' }], function (k) {
                if (k === 'manage') dlgInfo('Microsoft account', 'isaacure is already the most managed account on this machine.');
                else { mcStopRun(); MC.signedOut = true; mcPage(); }   // signing out cancels the launch it was for
            });
            break;
        case 'signin': MC.signedOut = false; toast('Welcome back, isaacure.'); mcPage(); break;
        case 'play': case 'instplay':
            // a second Play must not re-point the selection at a download already in flight
            if (MC.run) { toast('Already working on ' + MC.run.v + '…'); break; }
            if (a === 'instplay' && id) { mcjSet('sel', id); }
            if (MC.tab !== 'play') { MC.tab = 'play'; mcPage(); }
            mcPlay(); break;
        case 'instpick':
            mcMenu(b, mcVisibleInst().map(function (i) {
                return { k: i.id, t: i.n + ' · ' + mcResolveVer(i.v) };
            }).concat([{ k: '__manage', t: 'Manage installations…' }]), function (k) {
                if (k === '__manage') { mcGo('installations'); return; }
                mcjSet('sel', k); mcPage();
            });
            break;
        case 'crashlog': var c = mcj('crash', [])[0]; if (c) openApp('notepad', { file: { n: c.n, body: c.text } }); break;
        case 'crashx': MC.crashed = null; mcPage(); break;
        case 'openmc': openApp('explorer', '.minecraft'); break;
        case 'newinst': MC.edit = { n: '', icon: 'grass', v: 'latest-release' }; MC.pop = null; mcPage(); break;
        case 'instdir':
            var ii = mcInstById(id), vv = ii ? mcResolveVer(ii.v) : null;
            openApp('explorer', vv && mcj('dl', []).indexOf(vv) >= 0 ? '.minecraft/versions/' + vv : '.minecraft');
            break;
        case 'instmenu':
            (function () {
                var inst = mcInstById(id); if (!inst) return;
                var items = [{ k: 'edit', t: 'Edit' }, { k: 'dup', t: 'Duplicate' }];
                if (!inst.builtin) items.push({ k: 'del', t: 'Delete', danger: 1 });
                mcMenu(b, items, function (k) {
                    if (k === 'edit') { MC.edit = { id: inst.id, n: inst.n, icon: inst.icon, v: inst.v, dir: inst.dir, jvm: inst.jvm, builtin: inst.builtin }; MC.pop = null; mcPage(); }
                    else if (k === 'dup') {
                        var copy = { id: 'inst-' + Date.now().toString(36), n: 'Copy of ' + inst.n, icon: inst.icon, v: mcResolveVer(inst.v), created: dlStamp() };
                        var l = mcInst(); l.push(copy); mcjSet('inst', l);
                        mcUntomb('.minecraft', 'launcher_profiles.json'); mcSyncFS(); mcPage();
                    } else if (k === 'del') {
                        dlgConfirm('Delete installation?', '“' + inst.n + '” will be removed. Downloaded versions stay in .minecraft.', 'Delete', mcLive(function () {
                            mcjSet('inst', mcInst().filter(function (i) { return i.id !== inst.id; }));
                            if (mcj('sel', '') === inst.id) mcjSet('sel', 'latest-release');
                            mcUntomb('.minecraft', 'launcher_profiles.json');
                            mcSyncFS(); mcPage();
                        }));
                    }
                });
            })(); break;
        case 'iconpick': MC.pop = MC.pop === 'icons' ? null : 'icons'; mcPage(); break;
        case 'iconset': MC.edit.icon = id; MC.pop = null; mcPage(); break;
        case 'verpick': MC.pop = MC.pop === 'vers' ? null : 'vers'; mcPage(); break;
        case 'verset': MC.edit.v = id; MC.pop = null; mcPage(); break;
        case 'instcancel': MC.edit = null; MC.pop = null; mcPage(); break;
        case 'instsave':
            (function () {
                var e = MC.edit, list = mcInst();
                e.n = (e.n || '').trim() || 'unnamed installation';
                if (e.id) {
                    list = list.map(function (i) { return i.id === e.id ? { id: i.id, n: e.n, icon: e.icon, v: e.v, dir: e.dir, jvm: e.jvm, builtin: i.builtin, created: i.created, lastUsed: i.lastUsed } : i; });
                } else {
                    list.push({ id: 'inst-' + Date.now().toString(36), n: e.n, icon: e.icon, v: e.v, dir: e.dir, jvm: e.jvm, created: dlStamp() });
                }
                mcjSet('inst', list);
                mcUntomb('.minecraft', 'launcher_profiles.json');
                MC.edit = null; MC.pop = null; mcSyncFS(); mcPage();
            })(); break;
        case 'newskin': MC.skinEdit = mcNewSkinData(null); mcPage(); break;
        case 'skinuse': mcjSet('skin', id); mcUntomb('.minecraft', 'options.txt'); mcSyncFS(); mcRefreshFaces(); mcPage(); break;   // options.txt names the active skin
        case 'skinmenu':
            (function () {
                var sk = mcSkinById(id); if (!sk) return;
                var items = [{ k: 'dup', t: 'Duplicate' }];
                if (!sk.builtin) { items.unshift({ k: 'edit', t: 'Edit' }); items.push({ k: 'del', t: 'Delete', danger: 1 }); }
                mcMenu(b, items, function (k) {
                    if (k === 'edit') { MC.skinEdit = { id: sk.id, n: sk.n, model: sk.model, pal: sk.pal.slice(), rows: sk.rows.slice(), tool: 'pencil', color: '#d81e05', mirror: true, undo: [], dirty: false }; mcPage(); }
                    else if (k === 'dup') { MC.skinEdit = mcNewSkinData(sk); mcPage(); }
                    else if (k === 'del') {
                        dlgConfirm('Delete skin?', '“' + sk.n + '” goes back to the void.', 'Delete', mcLive(function () {
                            var wasActive = mcj('skin', '') === sk.id;
                            mcjSet('skins', mcSkins().filter(function (x) { return x.id !== sk.id; }));
                            if (wasActive) { mcjSet('skin', mcSkins()[0].id); mcUntomb('.minecraft', 'options.txt'); }   // active id changed → options.txt rewritten
                            mcSyncFS(); mcRefreshFaces(); mcPage();
                        }));
                    }
                });
            })(); break;
        case 'model': MC.skinEdit.model = id; MC.skinEdit.dirty = true; mcPage(); break;
        case 'tool': MC.skinEdit.tool = id; mcPage(); break;
        case 'mirror': MC.skinEdit.mirror = !MC.skinEdit.mirror; mcPage(); break;
        case 'edundo':
            (function () {
                var e = MC.skinEdit;
                if (e.undo.length) { var u = e.undo.pop(); e.rows = u.rows; e.pal = u.pal; mcPage(); }
            })(); break;
        case 'swatch': MC.skinEdit.color = id; MC.skinEdit.tool = MC.skinEdit.tool === 'eraser' ? 'pencil' : MC.skinEdit.tool; mcPage(); break;
        case 'edcancel':
            if (MC.skinEdit.dirty) dlgConfirm('Discard skin?', 'The editor has unsaved pixels.', 'Discard', mcLive(function () { MC.skinEdit = null; mcPage(); }));
            else { MC.skinEdit = null; mcPage(); }
            break;
        case 'edsave':
            (function () {
                var e = MC.skinEdit, list = mcSkins();
                e.n = (e.n || '').trim() || 'Unnamed skin';
                if (e.id) {
                    list = list.map(function (s) { return s.id === e.id ? { id: s.id, n: e.n, model: e.model, pal: e.pal, rows: e.rows, builtin: s.builtin } : s; });
                } else {
                    var nid = 'skin-' + Date.now().toString(36);
                    list.push({ id: nid, n: e.n, model: e.model, pal: e.pal, rows: e.rows });
                    mcjSet('skin', nid);
                    mcUntomb('.minecraft', 'options.txt');   // a new skin becomes active, so options.txt is rewritten
                }
                mcjSet('skins', list);
                MC.skinEdit = null; mcSyncFS(); mcRefreshFaces(); mcPage();
            })(); break;
        case 'note': MC.note = +id; mcPage(); break;
        case 'notesback': MC.note = null; mcPage(); break;
        case 'settoggle':
            (function () {
                var s2 = mcSet(); s2[id] = !s2[id]; mcjSet('set', s2);
                if (id === 'snapshots') {
                    var sel = mcSelInst();
                    if (!sel || (!s2.snapshots && mcj('sel', '') === 'latest-snapshot')) mcjSet('sel', 'latest-release');
                }
                mcUntomb('.minecraft', 'launcher_profiles.json');
                mcSyncFS(); mcPage();
            })(); break;
        case 'mcreset':
            dlgConfirm('Reset launcher data?', 'Installations, skins, downloads and crash reports all go back to factory. The .minecraft folder is rebuilt.', 'Reset', mcLive(function () {
                mcStopRun();                                  // a run in flight would re-write everything we just wiped
                mcj('dl', []).forEach(function (v) { try { localStorage.removeItem(PREFIX + 'mc_dld_' + v); } catch (e2) {} });
                ['inst', 'skins', 'skin', 'sel', 'set', 'dl', 'log', 'crash'].forEach(function (k) { try { localStorage.removeItem(PREFIX + 'mc_' + k); } catch (e2) {} });
                mcClearTombs();                               // "the .minecraft folder is rebuilt" has to mean it
                MC.edit = null; MC.skinEdit = null; MC.crashed = null;
                mcSkins(1); mcInst(1); mcSyncFS(); mcRefreshFaces(); mcPage(); toast('The launcher forgot everything. Fresh grass.');
            }));
            break;
        case 'licenses': openApp('notepad', { file: { n: 'licenses.txt', body: 'URE LAUNCHER THIRD-PARTY NOTICES\n\n1. The pixels are free-range and locally sourced.\n2. The creeper on the Play screen has signed a waiver.\n3. Any resemblance to launchers living or dead is loving parody.\n4. LWJGL is real and deserves better than this file.' } }); break;
        case 'otherbtn':
            if (id === 'dungeons') toast('Dungeons needs 2.4 GB of pixels. The wallpaper is using them.');
            else if (id === 'legends') toast('Legends requires a marketing budget this machine does not have.');
            else toast('Request filed with the IT admin. He says no.');
            break;
    }
}
function mcRefreshFaces() {
    if (!MC) return;
    var acct = MC.el.querySelector('.mcl-acct');
    if (acct) acct.innerHTML = mcFaceSvg(mcSkin()) + '<span class="mcl-acct-name">isaacure</span><b class="mcl-caret">▾</b>';
}
function closeMC() {
    if (MC && MC.run && MC.run.timer) clearInterval(MC.run.timer);
    mcCloseMenu();
    MC = null;
}
function mclFocus(el, arg) {
    if (!arg || !MC) return;
    if (arg.game) mcGame(arg.game);
    if (arg.tab) { mcGame('java'); mcGo(arg.tab); }
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
    settings: { title: 'Settings', icon: 'ic-settings', w: 660, h: 480, render: renderSettings, init: initSettings },
    photos:   { title: 'Photos', icon: 'ic-photos', w: 560, h: 440, render: renderPhotos, init: initPhotos, focusArg: function (el, arg) { if (arg != null) selectPhoto(el, arg | 0); } },
    calc:     { title: 'Calculator', icon: 'ic-calc', w: 300, h: 440, render: renderCalc, init: initCalc },
    edge:     { title: 'Microsoft Edge', icon: 'ic-edge', w: 760, h: 520, titlebar: edgeTitlebar, render: renderEdge, init: initEdge, onClose: function () { if (APPS.edge._gag) APPS.edge._gag.cancel(); }, onMinimize: function () { if (APPS.edge._gag) APPS.edge._gag.cancel(); },
              onRestore: function (el) { var g = APPS.edge._gag; if (g && g.dead && !g.done) { el.querySelector('.win-content').innerHTML = renderEdge(); initEdge(el); } } },
    chrome:   { title: 'Google Chrome', icon: 'ic-chrome', w: 980, h: 640, titlebar: crTitlebar, render: renderChrome, init: initChrome, onClose: closeChrome },
    setup:    { title: 'Google Chrome Setup', icon: 'ic-chrome', w: 584, h: 468, render: renderSetup, init: initSetup, onClose: stopSetup },
    bin:      { title: 'Recycle Bin', icon: 'ic-bin', w: 600, h: 400, render: renderBin, init: initBin },
    steam:    { title: 'Steam', icon: 'ic-steam', w: 1100, h: 700, render: renderSteam, init: initSteam, onClose: closeSteam, focusArg: steamFocus },
    cookie:   { title: 'Cookie Clicker', icon: 'ic-cookie', w: 980, h: 620,
        render: function () { return window.COOKIE ? window.COOKIE.render() : '<p style="padding:24px">The oven never preheated (cookie.js missing).</p>'; },
        init: function (el) { if (window.COOKIE) window.COOKIE.init(el); },
        onClose: function () { if (window.COOKIE) bankPlaytime('cookie', window.COOKIE.close() || 0); } },
    arpg: { title: 'VEILFALL', icon: 'ic-arpg', w: 1120, h: 700,
        render: function () { return window.ARPG ? window.ARPG.render() : '<p style="padding:24px">The veil failed to fall (arpg.js missing).</p>'; },
        init: function (el) { if (window.ARPG) window.ARPG.init(el); },
        onFocus: function (el) { var r = el.querySelector('.ar'); if (r) r.focus(); },   // keys follow the window
        onClose: function () { if (window.ARPG) bankPlaytime('veilfall', window.ARPG.close() || 0); } },
    terraria: { title: 'Terraria', icon: 'ic-terraria', w: 1040, h: 640,
        render: function () { return window.TERRA ? window.TERRA.render() : '<p style="padding:24px">World generation failed to start (terraria.js missing).</p>'; },
        init: function (el) { if (window.TERRA) window.TERRA.init(el); },
        onFocus: function (el) { var r = el.querySelector('.tr'); if (r) r.focus(); },   // keys follow the window
        onClose: function () { if (window.TERRA) bankPlaytime('terraria', window.TERRA.close() || 0); } },
    minecraft: { title: 'Minecraft', icon: 'ic-minecraft', w: 1080, h: 660,
        render: function () { return window.MC ? window.MC.render() : '<p style="padding:24px">The world fell into the void (minecraft.js missing).</p>'; },
        init: function (el) { if (window.MC) window.MC.init(el); },
        onFocus: function (el) { var r = el.querySelector('.mc'); if (r) r.focus(); },
        onMinimize: function () { if (window.MC && window.MC.suspend) window.MC.suspend(); },   // hidden worlds pause; nobody dies off-screen
        onRestore: function (el) { var r = el.querySelector('.mc'); if (r) r.focus(); },
        onClose: function () { if (window.MC) bankPlaytime('minecraft', window.MC.close() || 0); } },
    mclauncher: { title: 'Minecraft Launcher', icon: 'ic-mc', w: 980, h: 620, render: renderMC, init: initMC, onClose: closeMC, focusArg: mclFocus },
    sunrun:   { title: 'Sunset Runner', icon: 'ic-racer', w: 1000, h: 640,
        render: function () { return window.RACER ? window.RACER.render() : '<p style="padding:24px">The engine never turned over (racer.js missing).</p>'; },
        init: function (el) { if (window.RACER) window.RACER.init(el); },
        onFocus: function (el) { var r = el.querySelector('.racer-root'); if (r) r.focus(); },
        onClose: function () { if (window.RACER) bankPlaytime('sunrun', window.RACER.close() || 0); },
        onMinimize: function () { if (window.RACER) window.RACER.pause(); },
        onRestore: function (el) { if (window.RACER) window.RACER.resume(); var r = el.querySelector('.racer-root'); if (r) r.focus(); } },
    ureboy:   { launch: '/ureboy/' },
    room:     { launch: '/1p/' },
    gti:      { launch: '/ureboy/' }
};

/* ═══════════════════ Start menu + launch wiring ═════════════ */
var startMenu = byId('startMenu'), startBtn = byId('startBtn'), startSearch = byId('startSearch');
function setStart(open) {
    startMenu.hidden = false;
    void startMenu.offsetWidth;   // commit the unhidden state so the fade still animates —
    // fully synchronous: .open is never stale (the keybind layer gates on it, and a
    // queued rAF could land AFTER a close and corrupt the state)
    startMenu.classList.toggle('open', open);
    startBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { closeFlyouts(); closeCtx(); closeBctx(); closeTaskView(); setTimeout(function () { startSearch.focus(); }, 40); }
    else { startSearch.value = ''; filterStart(''); }
}
startBtn.addEventListener('click', function (e) { e.stopPropagation(); setStart(!startMenu.classList.contains('open')); });
startMenu.addEventListener('click', function (e) { e.stopPropagation(); });
byId('powerBtn').addEventListener('click', shutdown);

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
function closeFlyouts() { quickPanel.hidden = true; calPanel.hidden = true; }

function toggleFlyout(panel, build) {
    var opening = panel.hidden;
    closeFlyouts(); setStart(false); closeCtx(); closeBctx();
    if (opening) { build(); panel.hidden = false; }
}
byId('quickBtn').addEventListener('click', function (e) { e.stopPropagation(); toggleFlyout(quickPanel, buildQuick); });
byId('clock').addEventListener('click', function (e) { e.stopPropagation(); toggleFlyout(calPanel, buildCal); });
quickPanel.addEventListener('click', function (e) { e.stopPropagation(); });
calPanel.addEventListener('click', function (e) { e.stopPropagation(); });

function buildQuick() {
    var tiles = [['ic-wifi', 'Wi-Fi', 1], ['ic-bt', 'Bluetooth', 0], ['ic-plane', 'Airplane', 0], ['ic-batt', 'Battery saver', 0], ['ic-moon', 'Night light', 0], ['ic-access', 'Accessibility', 0]];
    quickPanel.innerHTML = '<div class="qs-grid">' + tiles.map(function (t) {
        return '<button class="qs-tile' + (t[2] ? ' on' : '') + '">' + ic(t[0]) + '<span>' + t[1] + '</span></button>';
    }).join('') + '</div>' +
        '<div class="qs-slider">' + ic('ic-moon') + '<input type="range" min="20" max="100" value="80" aria-label="Brightness"></div>' +
        '<div class="qs-slider">' + ic('ic-vol') + '<input type="range" min="0" max="100" value="65" aria-label="Volume"></div>' +
        '<div class="qs-foot"><span>' + ic('ic-batt') + ' 87%</span><button class="qs-gear" data-app="settings" aria-label="All settings">' + ic('ic-settings') + '</button></div>';
    quickPanel.querySelectorAll('.qs-tile').forEach(function (t) { t.addEventListener('click', function () { t.classList.toggle('on'); }); });
    quickPanel.querySelector('.qs-gear').addEventListener('click', function () { openApp('settings'); });
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
    'arrowup': function () { var id = topAppId(); if (id) openWins[id].el.classList.add('maxi'); },
    'arrowdown': function () {
        var id = topAppId(); if (!id) return;
        var el = openWins[id].el;
        if (el.classList.contains('maxi')) el.classList.remove('maxi'); else minWin(id);
    },
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
    notepad:  { 's': function () { var w = openWins.notepad; if (w && w.el._flash) w.el._flash(); } },
    mclauncher: {
        '1': function () { mcCtl('go', 'play'); },
        '2': function () { mcCtl('go', 'installations'); },
        '3': function () { mcCtl('go', 'skins'); },
        '4': function () { mcCtl('go', 'notes'); },
        '5': function () { mcCtl('settings'); },
        'p': function () { mcCtl('play'); },
        'n': function () { mcCtl('newInstall'); }
    }
};
function chromeCtl(fn, arg) { var w = openWins.chrome; if (w && w.el._br && w.el._br[fn]) w.el._br[fn](arg); }
function expCtl(fn) { var w = openWins.explorer; if (w && w.el._nav && w.el._nav[fn]) w.el._nav[fn](); }
// signed out, the whole launcher is the sign-in page — its shortcuts are inert too, not just its clicks
function mcCtl(fn, arg) { var w = openWins.mclauncher; if (MC && MC.signedOut) return; if (w && w.el._mc && w.el._mc[fn]) w.el._mc[fn](arg); }

document.addEventListener('keydown', function (e) {
    if (document.body.classList.contains('gagging')) {          // the Edge gag owns the keyboard…
        if (e.key === 'Escape' && APPS.edge._gag) { APPS.edge._gag.done = true; APPS.edge._gag.cancel(); }   // …but Esc always bails out, and sticks
        return;
    }
    // find-bar service keys — only for the ACTIVE window, and only when no
    // higher-priority surface (dialog, cheat sheet, start menu) is up
    if (findOpenNow() && find.appId === activeApp && !dlgs.length && !byId('cheatsheet') && !startMenu.classList.contains('open')) {
        if (e.key === 'F3') { e.preventDefault(); navFind(e.shiftKey ? -1 : 1); return; }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(); return; }
    }
    if (byId('cheatsheet') && e.key === 'Escape') { e.stopPropagation(); closeCheat(); return; }

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
    ['Windows', [['Alt+W', 'Close window'], ['Alt+M', 'Minimize'], ['Alt+↑', 'Maximize'], ['Alt+↓', 'Restore / minimize'], ['Alt+`', 'Cycle windows']]],
    ['Chrome', [['Alt+T', 'New tab'], ['Alt+W', 'Close tab'], ['Alt+Shift+T', 'Reopen closed tab'], ['Alt+1…9', 'Go to tab'], ['Alt+L', 'Address bar'], ['Alt+R', 'Reload'], ['Alt+←/→', 'Back / forward']]],
    ['Minecraft Launcher', [['Alt+1…4', 'Play / Installations / Skins / Notes'], ['Alt+5', 'Launcher settings'], ['Alt+P', 'Press the big green button'], ['Alt+N', 'New installation']]],
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
document.addEventListener('auxclick', closeBctx);   // middle-click closes tabs behind an open menu — don't leave it stale
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (closeTopDlg()) return;   // dialogs eat the first Escape
    setStart(false); closeFlyouts(); closeCtx(); closeFctx(); closeBctx(); mcCloseMenu(); closeTaskView();
});

applyAccent(recall('accent', ACCENTS[0].hex));
if (recall('crt', 'on') !== 'on') document.body.classList.add('no-crt');
try { var chromeSt = JSON.parse(recall('chrome', 'null')); if (chromeSt) installChrome(chromeSt); } catch (e) {}   // reinstate an installed Chrome
renderWall();
renderDesktop();
// the Chrome shortcut persists as a real file — if it exists anywhere, the install is real too
if (chromeOnDisk()) installChrome({ shortcut: false });
mcSyncFS();   // .minecraft is real: registers its folder keys from persisted launcher state
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
var devSteam = location.search.match(/dev=steam(?::([a-z]+))?(?::([a-z]+))?(?::([a-z0-9]+))?/);   // ?dev=steam:section:view:gid
if (devSteam) openApp('steam', devSteam[1] ? { section: devSteam[1], view: devSteam[2] || 'home', id: devSteam[3] || null } : undefined);
if (location.search.indexOf('fast') >= 0) window.__fastCursor = true;   // dev: instant cursor jumps so the chain runs headless
if (location.search.indexOf('dev=edge') >= 0) openApp('edge');       // watch the possession play out
if (location.search.indexOf('dev=race') >= 0) openApp('sunrun');     // launch Sunset Runner straight to the grid
if (location.search.indexOf('dev=chrome') >= 0) { installChrome({ shortcut: true }); openApp('chrome'); }
var devCr = location.search.match(/dev=cr:([^&]+)/);   // ?dev=cr:<url> — open Chrome navigated somewhere (cr:dino → chrome://dino)
if (devCr) { installChrome({}); openApp('chrome'); var crU; try { crU = decodeURIComponent(devCr[1]); } catch (e) { crU = devCr[1]; } if (CR) crNav(crParse(/^[a-z]+$/.test(crU) ? 'chrome://' + crU : crU)); }
if (location.search.indexOf('dev=wiz') >= 0) { fsAddFile('Downloads', chromeSetupItem()); openApp('setup'); }   // + &wstep=license|options|progress|finish (&freeze)
if (location.search.indexOf('dev=dl') >= 0) { fsAddFile('Downloads', chromeSetupItem()); openApp('explorer', 'Downloads'); }
if (location.search.indexOf('dev=bin') >= 0) {
    var __f = fsAddFile('Downloads', chromeSetupItem()); fsDelete('Downloads', __f);
    openApp('bin');
}
if (location.search.indexOf('dev=cookie') >= 0) openApp('cookie');   // + &ckdev seeds a mature bakery
if (location.search.indexOf('dev=terra') >= 0) openApp('terraria');   // + &tdev=night|cave|boss|kit
if (location.search.indexOf('dev=arpg') >= 0) openApp('arpg');        // VEILFALL proving grounds (window.__arpg test handle)
if (location.search.indexOf('dev=mc') >= 0) openApp('minecraft');   // + &mcdev=kit,night,dusk,cave,mobs (&mcseed=N)
if (location.search.indexOf('dev=dnd') >= 0) {   // a file moved Downloads→Desktop + a repositioned icon, in Explorer's Desktop view
    var __d = fsAddFile('Downloads', chromeSetupItem());
    fsMove('Downloads', __d, 'Desktop', [2, 1]);
    deskDrop('URE BOY', [4, 0]);
    openApp('explorer', 'Desktop');
}
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
// ?dev=launcher (NOT dev=mc — that opens the #74 game, whose hook is a substring match)
var devMcl = location.search.match(/[?&]dev=launcher(?::([a-z]+))?(?:&|$)/);   // [:installs|skins|editor|notes|settings|crash]
if (devMcl) {
    openApp('mclauncher');
    var mclSec = devMcl[1];
    if (mclSec === 'installs') mcCtl('go', 'installations');
    else if (mclSec === 'skins') mcCtl('go', 'skins');
    else if (mclSec === 'notes') mcCtl('go', 'notes');
    else if (mclSec === 'settings') mcCtl('settings');
    else if (mclSec === 'editor') { mcCtl('go', 'skins'); if (MC) { MC.skinEdit = mcNewSkinData(null); mcPage(); } }
    else if (mclSec === 'crash') { window.__mclForceCrash = true; mcCtl('play'); }   // force the honest-crash screen (the game normally launches fine now)
}
if (location.search.indexOf('dev') >= 0) window.__mcl = {
    open: function () { openApp('mclauncher'); },
    go: function (t) { mcCtl('go', t); },
    play: function () { mcCtl('play'); },
    state: function () { return MC; }
};
if (location.search.indexOf('dev=tabs') >= 0) {
    installChrome({ shortcut: true }); openApp('chrome');
    var devBr = openWins.chrome.el._br;
    devBr.newTab(); crNav(crParse('isaacure.com/1p'));   // tab 2: the room's page
    devBr.newTab(); devBr.goTab(2);
}

})();
