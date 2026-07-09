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
window.addEventListener('resize', function () { clearTimeout(rTimer); rTimer = setTimeout(renderWall, 120); });

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
var PINNED = ['explorer', 'edge', 'terminal', 'settings'];

function openApp(id, arg) {
    var a = APPS[id]; if (!a) return;
    if (a.launch) { window.location.href = a.launch; return; }
    setStart(false); closeFlyouts(); closeCtx(); closeTaskView();
    if (openWins[id]) { restoreWin(id); focusWin(id); if (a.focusArg) a.focusArg(openWins[id].el, arg); return; }
    createWindow(id, a, arg);
}
function createWindow(id, a, arg) {
    var w = a.w || 560, h = a.h || 420;
    w = Math.min(w, window.innerWidth - 16); h = Math.min(h, window.innerHeight - BAR - 16);
    var n = Object.keys(openWins).length;
    var left = clamp(Math.round((window.innerWidth - w) / 2) + (n % 5) * 26 - 52, 8, window.innerWidth - w - 8);
    var top = clamp(Math.round((window.innerHeight - BAR - h) / 2) + (n % 5) * 22 - 40, 8, window.innerHeight - BAR - h - 8);
    var el = document.createElement('section');
    el.className = 'win px-lg lift'; el.setAttribute('data-app', id); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', a.title);
    el.style.cssText = 'left:' + left + 'px;top:' + top + 'px;width:' + w + 'px;height:' + h + 'px';
    el.innerHTML =
        '<header class="win-bar">' +
          '<div class="win-id">' + ic(a.icon, 'win-favicon') + '<span class="win-title">' + esc(a.title) + '</span></div>' +
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
    bar.addEventListener('dblclick', function (e) { if (!e.target.closest('.cap')) el.classList.toggle('maxi'); });
    bar.addEventListener('pointerdown', function (e) {
        if (e.target.closest('.cap') || el.classList.contains('maxi')) return;
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
function focusWin(id) { var w = openWins[id]; if (!w) return; w.el.style.zIndex = ++zTop; activeApp = id; syncTaskbar(); }
function minWin(id) { var w = openWins[id]; if (!w) return; w.min = true; w.el.classList.add('mini'); if (activeApp === id) activeApp = null; syncTaskbar(); }
function restoreWin(id) { var w = openWins[id]; if (!w) return; w.min = false; w.el.classList.remove('mini'); }
function closeWin(id) { var w = openWins[id]; if (!w) return; if (APPS[id].onClose) APPS[id].onClose(w.el); w.el.remove(); delete openWins[id]; if (activeApp === id) activeApp = null; syncTaskbar(); }

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
    closeTaskView(); setStart(false); closeFlyouts(); closeCtx();
    var ov = document.createElement('div'); ov.className = 'tv-overlay'; ov.id = 'taskView';
    var grid = document.createElement('div'); grid.className = 'tv-grid';
    var ids = Object.keys(openWins);
    var BW = 300, BH = 188;
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
        var item = document.createElement('div'); item.className = 'tv-item'; item.setAttribute('data-id', id);
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

/* —— File Explorer —— */
var FS = {
    'Home': { items: [
        { n: 'Desktop', t: 'folder', go: 'This PC' }, { n: 'Downloads', t: 'folder', go: 'This PC' },
        { n: 'Documents', t: 'folder', go: 'Documents' }, { n: 'Pictures', t: 'folder', go: 'Pictures' },
        { n: 'Projects', t: 'folder', go: 'Projects' }, { n: 'URE BOY', t: 'ureboy', app: 'ureboy' }
    ] },
    'This PC': { items: [
        { n: 'Local Disk (C:)', t: 'pc' }, { n: 'Documents', t: 'folder', go: 'Documents' },
        { n: 'Pictures', t: 'folder', go: 'Pictures' }, { n: 'Projects', t: 'folder', go: 'Projects' }
    ] },
    'Documents': { items: [
        { n: 'about-me.txt', t: 'notepad', app: 'about' }, { n: 'resume.pdf', t: 'notepad', app: 'about' },
        { n: 'readme.txt', t: 'notepad', app: 'notepad' }
    ] },
    'Pictures': { items: [
        { n: 'the room.png', t: 'room', app: 'photos', arg: 0 }, { n: 'argent.png', t: 'gti', app: 'photos', arg: 1 },
        { n: 'bloom.png', t: 'photos', app: 'photos', arg: 4 }
    ] },
    'Projects': { items: [
        { n: 'URE BOY', t: 'ureboy', app: 'ureboy' }, { n: 'the room', t: 'room', app: 'room' },
        { n: 'GTI RUN', t: 'gti', app: 'gti' }, { n: 'isaacure.com', t: 'globe', app: 'edge' }
    ] }
};
var FS_ICON = { folder: 'ic-folder', pc: 'ic-pc', notepad: 'ic-notepad', room: 'ic-room', gti: 'ic-gti', ureboy: 'ic-ureboy', photos: 'ic-photos', globe: 'ic-globe' };
var exState = {};
function renderExplorer(id, arg) {
    return '<div class="exp">' +
        '<div class="exp-nav">' +
          navItem('Home', 'ic-explorer') + navItem('Pictures', 'ic-photos') +
          '<div class="nav-group">This PC</div>' +
          navItem('This PC', 'ic-pc') + navItem('Documents', 'ic-folder') + navItem('Projects', 'ic-folder') +
        '</div>' +
        '<div class="exp-main">' +
          '<div class="exp-bar"><button class="exp-back" data-nav="back" aria-label="Back">‹</button>' +
            '<button class="exp-up" data-nav="home" aria-label="Home">⌂</button>' +
            '<div class="exp-crumb" id="expCrumb"></div></div>' +
          '<div class="exp-grid" id="expGrid"></div>' +
        '</div></div>';
}
function navItem(name, icon) { return '<button class="nav-item" data-folder="' + name + '">' + ic(icon) + ' ' + esc(name) + '</button>'; }
function initExplorer(el, id, arg) {
    var state = { path: (arg && FS[arg]) ? arg : 'Home', hist: [] };
    exState[id] = state;
    var grid = el.querySelector('#expGrid'), crumb = el.querySelector('#expCrumb');
    function draw() {
        var f = FS[state.path] || FS.Home;
        crumb.textContent = state.path;
        el.querySelectorAll('.nav-item').forEach(function (n) { n.classList.toggle('sel', n.getAttribute('data-folder') === state.path); });
        grid.innerHTML = f.items.map(function (it, i) {
            return '<button class="fitem" data-i="' + i + '">' + ic(FS_ICON[it.t] || 'ic-folder') + '<span>' + esc(it.n) + '</span></button>';
        }).join('');
    }
    function go(p) { if (p === state.path) return; state.hist.push(state.path); state.path = p; draw(); }
    el.querySelector('.exp-nav').addEventListener('click', function (e) { var b = e.target.closest('.nav-item'); if (b) go(b.getAttribute('data-folder')); });
    el.querySelector('.exp-bar').addEventListener('click', function (e) {
        var b = e.target.closest('[data-nav]'); if (!b) return;
        if (b.getAttribute('data-nav') === 'back') { if (state.hist.length) { state.path = state.hist.pop(); draw(); } }
        else { state.hist = []; state.path = 'Home'; draw(); }
    });
    grid.addEventListener('dblclick', function (e) {
        var b = e.target.closest('.fitem'); if (!b) return;
        var it = (FS[state.path] || FS.Home).items[+b.getAttribute('data-i')];
        if (it.app) openApp(it.app, it.arg);
        else if (it.go) go(it.go);
    });
    grid.addEventListener('click', function (e) {
        var b = e.target.closest('.fitem'); if (!b) return;
        grid.querySelectorAll('.fitem.sel').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel');
    });
    draw();
}

/* —— Notepad —— */
function renderNotepad() {
    return '<div class="np">' +
        '<div class="np-menu"><span>File</span><span>Edit</span><span>Format</span><span>View</span><span>Help</span></div>' +
        '<textarea class="np-text" spellcheck="false" placeholder="Start typing. It saves itself."></textarea>' +
        '<div class="np-status"><span class="np-loc">Ln 1, Col 1</span><span>UTF-8 · UreOS</span></div></div>';
}
function initNotepad(el) {
    var ta = el.querySelector('.np-text'), loc = el.querySelector('.np-loc');
    ta.value = recall('notepad', '');
    function upd() {
        store('notepad', ta.value);
        var pre = ta.value.slice(0, ta.selectionStart).split('\n');
        loc.textContent = 'Ln ' + pre.length + ', Col ' + (pre[pre.length - 1].length + 1);
    }
    ta.addEventListener('input', upd); ta.addEventListener('keyup', upd); ta.addEventListener('click', upd);
    if (!reduce) setTimeout(function () { ta.focus(); }, 30);
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
    function print(html, cls) { var d = document.createElement('div'); d.className = 'term-row' + (cls ? ' ' + cls : ''); d.innerHTML = html; out.appendChild(d); term.scrollTop = term.scrollHeight; }
    print(esc(TERM_BANNER), 't-dim');
    var CMDS = {
        help: function () { print('commands: <b>help about whoami ls open date echo neofetch gti socials clear exit</b>'); },
        about: function () { print(esc(ME.bio)); },
        whoami: function () { print('isaac'); },
        ls: function () { print('about  projects  pictures  ureboy  the-room  gti-run  resume.pdf'); },
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
        open: function (a) { if (a && APPS[a]) { print("opening " + a + "..."); openApp(a); } else print("open what? try: open notepad", 't-err'); }
    };
    function run(line) {
        print('<span class="term-prompt">isaac@ure</span>:<span class="term-path">~</span>$ ' + esc(line), 't-cmd');
        var parts = line.trim().split(/\s+/), cmd = parts.shift();
        if (!cmd) return;
        if (cmd === 'echo') { print(esc(parts.join(' '))); return; }
        if (cmd === 'sudo') { print("nice try. this is a personal machine.", 't-err'); return; }
        if (CMDS[cmd]) CMDS[cmd](parts[0]);
        else print("ure-sh: command not found: " + esc(cmd) + "  (try 'help')", 't-err');
    }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { run(inp.value); inp.value = ''; } });
    term.addEventListener('click', function () { inp.focus(); });
    if (!reduce) setTimeout(function () { inp.focus(); }, 30);
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

/* —— Edge (browser) —— */
function renderEdge() {
    var bm = [
        ['the room', 'ic-room', 'room'], ['URE BOY', 'ic-ureboy', 'ureboy'], ['GTI RUN', 'ic-gti', 'gti'],
        ['About Isaac', 'ic-ure', 'about'], ['GitHub', 'ic-globe', 'ext:https://github.com/IsaacUre'],
        ['Instagram', 'ic-photos', 'ext:https://www.instagram.com/isaacure_/']
    ];
    var tiles = bm.map(function (b) { return '<button class="bm" data-target="' + b[2] + '">' + ic(b[1]) + '<span>' + esc(b[0]) + '</span></button>'; }).join('');
    return '<div class="edge">' +
        '<div class="edge-bar"><span class="edge-nav">‹ › ↻</span><div class="edge-addr">' + ic('ic-search') + '<span>ure://home</span></div></div>' +
        '<div class="edge-home"><div class="edge-logo">' + ic('ic-edge', 'edge-big') + '<h2>Good ' + dayPart() + ', Isaac</h2></div>' +
        '<p class="edge-sub">Quick links</p><div class="bm-grid">' + tiles + '</div></div></div>';
}
function dayPart() { var h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'; }
function initEdge(el) {
    el.querySelector('.bm-grid').addEventListener('click', function (e) {
        var b = e.target.closest('.bm'); if (!b) return;
        var t = b.getAttribute('data-target');
        if (t.indexOf('ext:') === 0) window.open(t.slice(4), '_blank', 'noopener');
        else openApp(t);
    });
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

/* —— Recycle Bin —— */
function renderBin() {
    return '<div class="exp"><div class="exp-main" style="width:100%"><div class="exp-bar"><div class="exp-crumb">Recycle Bin</div></div>' +
        '<div class="bin-empty">' + ic('ic-bin', 'bin-big') + '<p>Recycle Bin is empty</p><span>Nothing thrown out. Tidy machine.</span></div></div></div>';
}

var APPS = {
    explorer: { title: 'File Explorer', icon: 'ic-explorer', w: 720, h: 460, render: renderExplorer, init: initExplorer },
    about:    { title: 'About Isaac', icon: 'ic-ure', w: 540, h: 480, render: renderAbout },
    notepad:  { title: 'Untitled — Notepad', icon: 'ic-notepad', w: 520, h: 420, render: renderNotepad, init: initNotepad },
    terminal: { title: 'URE Shell', icon: 'ic-terminal', w: 620, h: 400, render: renderTerminal, init: initTerminal },
    settings: { title: 'Settings', icon: 'ic-settings', w: 660, h: 480, render: renderSettings, init: initSettings },
    photos:   { title: 'Photos', icon: 'ic-photos', w: 560, h: 440, render: renderPhotos, init: initPhotos, focusArg: function (el, arg) { if (arg != null) selectPhoto(el, arg | 0); } },
    calc:     { title: 'Calculator', icon: 'ic-calc', w: 300, h: 440, render: renderCalc, init: initCalc },
    edge:     { title: 'Edge', icon: 'ic-edge', w: 700, h: 480, render: renderEdge, init: initEdge },
    bin:      { title: 'Recycle Bin', icon: 'ic-bin', w: 600, h: 400, render: renderBin },
    ureboy:   { launch: '/ureboy/' },
    room:     { launch: '/1p/' },
    gti:      { launch: '/ureboy/' }
};

/* ═══════════════════ Start menu + launch wiring ═════════════ */
var startMenu = byId('startMenu'), startBtn = byId('startBtn'), startSearch = byId('startSearch');
function setStart(open) {
    startMenu.hidden = false;
    requestAnimationFrame(function () { startMenu.classList.toggle('open', open); });
    startBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { closeFlyouts(); closeCtx(); closeTaskView(); if (!reduce) setTimeout(function () { startSearch.focus(); }, 40); }
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
desktop.addEventListener('dblclick', function (e) { var d = e.target.closest('.dicon'); if (d) openApp(d.getAttribute('data-app')); });

byId('searchBtn').addEventListener('click', function (e) { e.stopPropagation(); setStart(true); });

/* ═══════════════════════ flyouts ════════════════════════════ */
var quickPanel = byId('quickPanel'), calPanel = byId('calPanel');
function closeFlyouts() { quickPanel.hidden = true; calPanel.hidden = true; }

function toggleFlyout(panel, build) {
    var opening = panel.hidden;
    closeFlyouts(); setStart(false); closeCtx();
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
    e.preventDefault(); setStart(false); closeFlyouts();
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

/* ═══════════════════ global dismiss + init ═════════════════ */
document.addEventListener('click', function () { setStart(false); closeFlyouts(); closeCtx(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setStart(false); closeFlyouts(); closeCtx(); closeTaskView(); } });

applyAccent(recall('accent', ACCENTS[0].hex));
if (recall('crt', 'on') !== 'on') document.body.classList.add('no-crt');
renderWall();
tick(); setInterval(tick, 15000);

// headless-screenshot hooks (like the room pages' ?dev): populate a state for a one-shot capture
if (location.search.indexOf('dev=tv') >= 0) { ['terminal', 'about', 'calc', 'explorer'].forEach(function (a) { openApp(a); }); setTimeout(openTaskView, 60); }
if (location.search.indexOf('dev=pics') >= 0) openApp('photos', 1);

})();
