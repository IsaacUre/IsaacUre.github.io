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
    [176,198,225],[192,212,233],[206,223,241],[220,232,246],[232,242,251],
    [9,30,84],[16,48,120],[26,72,166],[38,100,206],[58,132,238],
    [104,160,246],[150,192,250],[196,222,253]
];
var BG_TOP = [230,240,250], BG_BOT = [164,187,218];
var C_DEEP = [12,36,96], C_MID = [40,102,208], C_HI = [170,204,251], C_THROAT = [8,26,74];
function lerp(a, b, t) { return a + (b - a) * t; }
function mix(a, b, t) { return [lerp(a[0],b[0],t)|0, lerp(a[1],b[1],t)|0, lerp(a[2],b[2],t)|0]; }
function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

function petal(g, cx, cy, ang, len, wid, L) {
    var dir = [Math.cos(ang), Math.sin(ang)];
    var nrm = [-dir[1], dir[0]];
    var lit = nrm[0] * L[0] + nrm[1] * L[1];
    var light = lit > 0 ? mix(C_MID, C_HI, Math.min(1, lit)) : mix(C_MID, C_DEEP, Math.min(1, -lit));
    var dark = mix(C_DEEP, C_THROAT, 0.35);
    g.save();
    g.translate(cx, cy); g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.30, -wid, len * 0.80, -wid * 0.64, len * 0.98, -wid * 0.16);
    g.quadraticCurveTo(len * 1.05, 0, len * 0.98, wid * 0.16);
    g.bezierCurveTo(len * 0.80, wid * 0.64, len * 0.30, wid, 0, 0);
    g.closePath();
    var grad = g.createLinearGradient(0, -wid, 0, wid);
    if (lit >= 0) { grad.addColorStop(0, rgb(light)); grad.addColorStop(.62, rgb(mix(light, dark, .5))); grad.addColorStop(1, rgb(dark)); }
    else          { grad.addColorStop(0, rgb(dark)); grad.addColorStop(.38, rgb(mix(light, dark, .5))); grad.addColorStop(1, rgb(light)); }
    g.fillStyle = grad; g.fill();
    g.strokeStyle = 'rgba(8,26,70,.30)'; g.lineWidth = Math.max(1, wid * 0.05);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.6, 0, len, 0); g.stroke();
    g.restore();
}
function drawBloom(g, cx, cy, base) {
    var L = [-0.52, -0.86];
    var throat = g.createRadialGradient(cx, cy, 0, cx, cy, base * 0.20);
    throat.addColorStop(0, rgb(C_THROAT)); throat.addColorStop(1, 'rgba(8,26,74,0)');
    g.fillStyle = throat; g.beginPath(); g.arc(cx, cy, base * 0.20, 0, 7); g.fill();
    var rings = [
        [0.52, 7, 0.44, 0.0], [0.42, 7, 0.42, 0.5], [0.33, 6, 0.42, 1.0],
        [0.25, 6, 0.44, 1.5], [0.17, 5, 0.48, 2.0], [0.10, 5, 0.52, 2.5]
    ];
    for (var ri = 0; ri < rings.length; ri++) {
        var R = rings[ri], len = base * R[0], wid = len * R[2], n = R[1];
        for (var i = 0; i < n; i++) petal(g, cx, cy, R[3] + i * (Math.PI * 2 / n), len, wid, L);
    }
    var bud = g.createRadialGradient(cx, cy - base * 0.02, 0, cx, cy, base * 0.09);
    bud.addColorStop(0, 'rgba(196,222,253,.85)'); bud.addColorStop(1, 'rgba(120,170,247,0)');
    g.fillStyle = bud; g.beginPath(); g.arc(cx, cy, base * 0.09, 0, 7); g.fill();
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
var PINNED = ['explorer', 'edge', 'terminal', 'steam', 'settings'];

function openApp(id, arg) {
    var a = APPS[id]; if (!a) return;
    if (a.launch) { window.location.href = a.launch; return; }
    setStart(false); closeFlyouts(); closeCtx();
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
byId('taskviewBtn').addEventListener('click', function (e) { e.stopPropagation(); minimizeAll(); });

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
        { n: 'the room.png', t: 'room', app: 'photos' }, { n: 'argent.png', t: 'gti', app: 'photos' },
        { n: 'bloom.png', t: 'photos', app: 'photos' }
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
        if (it.app) openApp(it.app);
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
        ['Steam', 'ic-steam', 'steam'], ['the room', 'ic-room', 'room'], ['URE BOY', 'ic-ureboy', 'ureboy'],
        ['GTI RUN', 'ic-gti', 'gti'], ['About Isaac', 'ic-ure', 'about'], ['GitHub', 'ic-globe', 'ext:https://github.com/IsaacUre']
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
function renderPhotos() {
    var thumbs = PHOTOS.map(function (p, i) { return '<button class="ph-thumb' + (i === 0 ? ' sel' : '') + '" data-i="' + i + '">' + ic(p[0]) + '</button>'; }).join('');
    return '<div class="photos"><div class="ph-view" id="phView">' + ic(PHOTOS[0][0], 'ph-big') + '<span class="ph-cap">' + esc(PHOTOS[0][1]) + '</span></div>' +
        '<div class="ph-strip">' + thumbs + '</div></div>';
}
function initPhotos(el) {
    var view = el.querySelector('#phView');
    el.querySelector('.ph-strip').addEventListener('click', function (e) {
        var b = e.target.closest('.ph-thumb'); if (!b) return;
        el.querySelectorAll('.ph-thumb.sel').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel');
        var p = PHOTOS[+b.getAttribute('data-i')];
        view.innerHTML = ic(p[0], 'ph-big') + '<span class="ph-cap">' + esc(p[1]) + '</span>';
    });
}

/* —— Recycle Bin —— */
function renderBin() {
    return '<div class="exp"><div class="exp-main" style="width:100%"><div class="exp-bar"><div class="exp-crumb">Recycle Bin</div></div>' +
        '<div class="bin-empty">' + ic('ic-bin', 'bin-big') + '<p>Recycle Bin is empty</p><span>Nothing thrown out. Tidy machine.</span></div></div></div>';
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

  { id: 'bg3', t: "Baldur's Gate 3", dev: 'Larian Studios', pub: 'Larian Studios', yr: 2023,
    tags: ['RPG', 'Dungeons & Dragons', 'Story Rich', 'Turn-Based', 'Co-op'],
    s: "Gather your party and venture forth. A cinematic take on the world's greatest role-playing game.",
    d: "Mind flayers, moral rot, and a thousand ways to fail forward. The DM in Isaac never stood a chance against this one.",
    price: 5999, disc: 0, owned: true, inst: true, hrs: 214.6, hrs2w: 18.3,
    rev: ['Overwhelmingly Positive', 96, 728104], art: ['#3a1c12', '#c58b3a', 'BG3'], sc: 'dungeon',
    feat: true, ach: [41, 54],
    achx: [['The Plot Thickens', 'Complete Act One', 1], ['Fear Itself', 'Defeat the Absolute', 0], ['Rest & Relaxation', 'Take a long rest', 1], ['A Grand Old Time', 'Recruit a companion', 1], ['Escapologist', 'Escape the Nautiloid', 1]],
    revx: [["I role-played a bard for 60 hours and have no regrets.", 1, "214.6 hrs"], ["Failed a persuasion check and it made the game better.", 1, "88.0 hrs"]],
    news: [['Patch 8 — the last big one', "Twelve new subclasses, split-screen fixes, and a photo mode. Go say goodbye to your party.", 'Apr 15']] },

  { id: 'factorio', t: 'Factorio', dev: 'Wube Software', pub: 'Wube Software', yr: 2020,
    tags: ['Automation', 'Base Building', 'Strategy', 'Optimization', 'Singleplayer'],
    s: "The factory must grow. Build, automate, and defend a sprawling production line on an alien world.",
    d: "A game about spaghetti becoming a cathedral. Made for a systems-and-optimization brain that cannot leave a bottleneck alone.",
    price: 3500, disc: 0, owned: true, inst: true, hrs: 341.9, hrs2w: 22.0,
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
    price: 1999, disc: 75, owned: true, inst: true, hrs: 63.1, hrs2w: 2.2,
    rev: ['Very Positive', 89, 91004], art: ['#1a1f26', '#b2151d', 'AC'], sc: 'road', spec: true,
    ach: [22, 47] },

  { id: 'disco', t: 'Disco Elysium', dev: 'ZA/UM', pub: 'ZA/UM', yr: 2019,
    tags: ['RPG', 'Story Rich', 'Detective', 'Absurdist', 'Choices Matter'],
    s: "A groundbreaking role-playing game. You're a detective with a unique skill system and a whole city to carve your path across.",
    d: "Argue with the reactionary lodged inside your own skull. Absurdist philosophy with a badge and a hangover.",
    price: 3999, disc: 60, owned: true, inst: true, hrs: 38.4, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 96, 152770], art: ['#241a2e', '#b5462e', 'DE'], sc: 'city', spec: true,
    ach: [19, 40], achx: [['Detective', 'Solve the case', 0], ['Hardcore', 'Reach Level 20', 1], ['Rond-dubois', 'Find the phasmid', 0]] },

  { id: 'outerwilds', t: 'Outer Wilds', dev: 'Mobius Digital', pub: 'Annapurna', yr: 2019,
    tags: ['Exploration', 'Mystery', 'Space', 'Open World', 'Time Loop'],
    s: "A open-world mystery about a solar system trapped in an endless time loop.",
    d: "Twenty-two minutes to the end of everything, on repeat, until you understand. Do not read a word about it. Just go.",
    price: 2499, disc: 40, owned: true, inst: true, hrs: 27.5, hrs2w: 0,
    rev: ['Overwhelmingly Positive', 97, 61402], art: ['#10131f', '#d98a2b', 'OW'], sc: 'space', spec: true,
    ach: [9, 12] },

  { id: 'hades', t: 'Hades', dev: 'Supergiant Games', pub: 'Supergiant Games', yr: 2020,
    tags: ['Roguelike', 'Action', 'Story Rich', 'Great Soundtrack', 'Hack and Slash'],
    s: "Defy the god of the dead as you hack and slash out of the Underworld in this rogue-like dungeon crawler.",
    d: "Death is a mechanic and the writing is the reward. One more escape attempt, forever.",
    price: 2499, disc: 50, owned: true, inst: true, hrs: 54.8, hrs2w: 6.0,
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
    price: 0, disc: 0, free: true, owned: true, inst: true, hrs: 128.3, hrs2w: 5.5,
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
    ach: [0, 34] }
];
var SG = {};
STG.forEach(function (g) { SG[g.id] = g; });

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
    if (recall('steam_owned', null) == null) {
        sjSet('owned', STG.filter(function (g) { return g.owned; }).map(function (g) { return g.id; }));
        sjSet('inst', STG.filter(function (g) { return g.owned && g.inst; }).map(function (g) { return g.id; }));
        sjSet('wish', ['eldenring', 'cities']);
        sjSet('cart', []);
        sjSet('hrs', {});
    }
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
function stGrant(id) { var o = stOwned(); if (o.indexOf(id) < 0) { o.push(id); sjSet('owned', o); } }
function stMarkInst(id) { var s = stInst(); if (s.indexOf(id) < 0) { s.push(id); sjSet('inst', s); } }

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
function renderSteam() {
    return '<div class="steam" id="steamRoot">' +
        '<header class="st-head">' +
          '<div class="st-headL"><button class="st-arrow" data-st="back" aria-label="Back">‹</button><button class="st-arrow dis" aria-label="Forward">›</button>' +
            '<span class="st-wm">' + ic('ic-steam', 'st-wm-ic') + 'STEAM</span></div>' +
          '<nav class="st-tabs">' +
            '<button class="st-tab" data-st="nav" data-id="store">STORE</button>' +
            '<button class="st-tab" data-st="nav" data-id="library">LIBRARY</button>' +
            '<button class="st-tab" data-st="nav" data-id="community">COMMUNITY</button>' +
          '</nav>' +
          '<div class="st-headR">' +
            '<button class="st-wallet" data-st="nav" data-id="cart"><span>$13.37</span></button>' +
            '<button class="st-hicon" data-st="nav" data-id="downloads" aria-label="Downloads">' + gDl() + '<span class="st-badge" id="stDlBadge" hidden>0</span></button>' +
            '<button class="st-hicon" data-st="nav" data-id="cart" aria-label="Cart">' + gCart() + '<span class="st-badge" id="stCartBadge" hidden>0</span></button>' +
            '<button class="st-av" data-st="nav" data-id="community" aria-label="Profile">' + ic('ic-user') + '</button>' +
          '</div>' +
        '</header>' +
        '<div class="st-sub" id="stSub"></div>' +
        '<div class="st-body" id="stBody"></div>' +
        '<div class="st-dock" id="stDock" hidden></div>' +
        '<div class="st-toast" id="stToast" hidden></div>' +
      '</div>';
}
function initSteam(el, id, arg) {
    stSeed();
    ST = { el: el, root: el.querySelector('#steamRoot'), sub: el.querySelector('#stSub'), body: el.querySelector('#stBody'),
           dock: el.querySelector('#stDock'), toast: el.querySelector('#stToast'),
           section: 'store', view: 'home', gid: null, cat: null, q: '', gal: 0, carou: 0,
           hist: [], carouT: 0, dlT: 0, toastT: 0 };
    ST.root.addEventListener('click', stClick);
    ST.root.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { var s = e.target.closest('[data-search]'); if (s) { ST.q = e.target.value; stGo('store', 'browse', null, { cat: null }); } }
    });
    ST.root.addEventListener('input', function (e) {
        if (!e.target.closest('[data-libsearch]')) return;
        var q = e.target.value.toLowerCase();
        ST.body.querySelectorAll('.st-lgrow').forEach(function (r) {
            if (r.getAttribute('data-st') !== 'lib') return;
            var n = r.querySelector('.st-lgname');
            r.style.display = (n && n.textContent.toLowerCase().indexOf(q) >= 0) ? '' : 'none';
        });
    });
    stDock();
    if (arg && arg.section) { stGo(arg.section, arg.view || 'home', arg.id || null); }
    else stRender();
}
function closeSteam() { if (ST) { clearInterval(ST.carouT); clearInterval(ST.dlT); clearTimeout(ST.toastT); } ST = null; }
function steamFocus(el, arg) { if (arg && arg.section) stGo(arg.section, arg.view || 'home', arg.id || null); }

function stGo(section, view, gid, extra) {
    ST.hist.push({ section: ST.section, view: ST.view, gid: ST.gid, cat: ST.cat, q: ST.q });
    if (ST.hist.length > 40) ST.hist.shift();
    ST.section = section; ST.view = view || 'home'; ST.gid = gid || null; ST.gal = 0; ST.carou = 0;
    if (extra) { if ('cat' in extra) ST.cat = extra.cat; }
    stRender();
}
function stBack() {
    var h = ST.hist.pop(); if (!h) return;
    ST.section = h.section; ST.view = h.view; ST.gid = h.gid; ST.cat = h.cat; ST.q = h.q; ST.gal = 0; ST.carou = 0;
    stRender();
}
function stRender() {
    clearInterval(ST.carouT); ST.carouT = 0;
    ST.root.querySelectorAll('.st-tab').forEach(function (t) { t.classList.toggle('sel', t.getAttribute('data-id') === ST.section); });
    ST.sub.innerHTML = stSubHTML();
    ST.body.innerHTML = stBodyHTML();
    ST.body.scrollTop = 0;
    stPaintAll();
    stSyncBadges();
    if (ST.section === 'store' && ST.view === 'home') stStartCarousel();
}
function stSubHTML() {
    function tab(sec, view, label, cat) {
        var on = ST.section === sec && ST.view === view && (cat === undefined || ST.cat === cat);
        return '<button class="st-subtab' + (on ? ' sel' : '') + '" data-st="go" data-sec="' + sec + '" data-view="' + view + '"' + (cat ? ' data-cat="' + esc(cat) + '"' : '') + '>' + label + '</button>';
    }
    if (ST.section === 'store') {
        return '<div class="st-subL">' + tab('store', 'home', 'Your Store') + tab('store', 'browse', 'Categories', null) + tab('store', 'wishlist', 'Wishlist') + tab('store', 'points', 'Points Shop') + '</div>' +
            '<label class="st-find"><input type="text" data-search="1" placeholder="search the store" spellcheck="false" value="' + esc(ST.q) + '"></label>';
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
    if (ST.section === 'store') {
        if (ST.view === 'game') return stStorePage(SG[ST.gid]);
        if (ST.view === 'browse') return stBrowse();
        if (ST.view === 'wishlist') return stWishlistView();
        if (ST.view === 'points') return stPoints();
        return stStoreHome();
    }
    if (ST.section === 'library') {
        if (ST.view === 'game') return stLibGame(SG[ST.gid]);
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
    h += '<h3 class="st-row-h">Because you play <b>Factorio</b></h3><div class="st-scroller">' + STG.filter(function (g) { return g.tags.indexOf('Strategy') >= 0 || g.tags.indexOf('Simulation') >= 0 || g.tags.indexOf('Optimization') >= 0; }).slice(0, 6).map(stSpecCard).join('') + '</div>';
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
function stStorePage(g) {
    var owned = isOwned(g.id), inst = isInst(g.id);
    var main = '<div class="st-sp-gal"><canvas class="st-sp-main" id="stGalMain" data-g="' + g.id + '" data-seed="' + (ST.gal + 1) + '"></canvas>' +
        '<div class="st-sp-thumbs">' + [0, 1, 2, 3, 4].map(function (i) { return '<canvas class="st-sp-th' + (i === ST.gal ? ' sel' : '') + '" data-st="shot" data-i="' + i + '" data-g="' + g.id + '" data-seed="' + (i + 1) + '"></canvas>'; }).join('') + '</div></div>';
    var buyBtn;
    if (owned) buyBtn = inst ? '<button class="st-play" data-st="play" data-id="' + g.id + '">' + gPlay() + ' Play</button>' : '<button class="st-play" data-st="install" data-id="' + g.id + '">' + gDl() + ' Install</button>';
    else if (g.free) buyBtn = '<button class="st-play" data-st="install" data-id="' + g.id + '">' + gDl() + ' Install Game</button>';
    else if (inCart(g.id)) buyBtn = '<button class="st-buy incart" data-st="nav" data-id="cart">' + gCart() + ' In Cart — View</button>';
    else buyBtn = '<button class="st-buy" data-st="addcart" data-id="' + g.id + '">' + gCart() + ' Add to Cart</button>';
    var wishBtn = owned ? '' : '<button class="st-ghost" data-st="wish" data-id="' + g.id + '">' + (isWished(g.id) ? '✓ On Wishlist' : '+ Wishlist') + '</button>';
    var revs = (g.revx || SREV.slice(0, 2)).map(function (r) {
        return '<div class="st-review"><div class="st-review-h"><span class="st-review-v ' + (r[1] ? 'up' : 'down') + '">' + (r[1] ? gThumb() + ' Recommended' : 'Not Recommended') + '</span><span class="st-review-hrs">' + esc(r[2]) + '</span></div><p>“' + esc(r[0]) + '”</p></div>';
    }).join('');
    var sys = [['OS', 'UreOS 11 Pixel Edition or newer'], ['Processor', 'Bloom Core @ 60fps'], ['Memory', '640 KB RAM'], ['Graphics', 'Canvas 2D, pixelated'], ['Storage', 'a corner of localStorage'], ['Notes', 'Thumbs supported']];
    var like = STG.filter(function (o) { return o.id !== g.id && o.tags.some(function (t) { return g.tags.indexOf(t) >= 0; }); }).slice(0, 4);
    return '<div class="st-sp">' +
        '<div class="st-sp-crumb"><button data-st="nav" data-id="store">All Games</button> › <button data-st="cat" data-id="' + esc(g.tags[0]) + '">' + esc(g.tags[0]) + '</button> › <span>' + esc(g.t) + '</span></div>' +
        '<h1 class="st-sp-title">' + esc(g.t) + '</h1>' +
        '<div class="st-sp-cols">' +
          '<div class="st-sp-main-col">' + main +
            '<div class="st-sp-desc"><p>' + esc(g.d) + '</p></div>' +
            '<div class="st-sp-tags">' + stTags(g) + '</div>' +
          '</div>' +
          '<aside class="st-sp-side">' + stCap(g, 'side') +
            '<p class="st-sp-short">' + esc(g.s) + '</p>' +
            '<div class="st-sp-meta"><div class="st-rev big ' + stRevClass(g.rev[1]) + '"><b>' + g.rev[0] + '</b><span>' + g.rev[2].toLocaleString() + ' reviews · ' + g.rev[1] + '% positive</span><span class="st-rev-bar"><i style="width:' + g.rev[1] + '%"></i></span></div>' +
              '<dl class="st-facts"><dt>Release</dt><dd>' + g.yr + '</dd><dt>Developer</dt><dd>' + esc(g.dev) + '</dd><dt>Publisher</dt><dd>' + esc(g.pub) + '</dd></dl></div>' +
            '<div class="st-buybox"><div class="st-buybox-h">' + (owned ? 'In your library' : g.free ? 'Play ' + esc(g.t) : 'Buy ' + esc(g.t)) + (g.disc && !owned ? '<span class="st-disc-flag">-' + g.disc + '%</span>' : '') + '</div>' +
              '<div class="st-buybox-b">' + (owned ? '' : '<span class="st-buybox-px">' + (g.disc ? '<s>' + stPrice(g.price) + '</s> ' : '') + '<b>' + stPrice(stFinal(g)) + '</b></span>') + buyBtn + '</div>' + (wishBtn ? '<div class="st-buybox-f">' + wishBtn + '</div>' : '') +
            '</div>' +
          '</aside>' +
        '</div>' +
        '<h3 class="st-sp-h">Recent Reviews</h3><div class="st-reviews">' + revs + '</div>' +
        '<h3 class="st-sp-h">System Requirements</h3><div class="st-sys">' + sys.map(function (s) { return '<div class="st-sys-row"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('') + '</div>' +
        '<h3 class="st-sp-h">More like this</h3><div class="st-grid">' + like.map(stGridCard).join('') + '</div>' +
      '</div>';
}
function stBrowse() {
    var cat = ST.cat, q = ST.q;
    var list = STG.filter(function (g) {
        if (q) return (g.t + ' ' + g.tags.join(' ') + ' ' + g.dev).toLowerCase().indexOf(q.toLowerCase()) >= 0;
        if (cat) return g.tags.indexOf(cat) >= 0;
        return true;
    });
    var title = q ? 'Search: “' + esc(q) + '”' : cat ? esc(cat) : 'All Games';
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
    return '<div class="st-pad st-points"><h2 class="st-browse-h">Points Shop</h2><div class="st-points-bal">' + gStar() + ' <b>4,120</b> points</div>' +
        '<p class="st-empty">Spend points on animated avatars, profile backgrounds, and stickers. (This one is a museum exhibit — the points are real, the shop is a bit.)</p>' +
        '<div class="st-grid">' + STG.slice(0, 4).map(function (g) { return '<div class="st-gcard static"><canvas class="st-shot" data-g="' + g.id + '" data-seed="7"></canvas><span class="st-gcard-b"><span class="st-scard-t">' + esc(g.t) + ' — Avatar Pack</span><b class="st-points-px">' + gStar() + ' ' + (1000 + g.yr % 900) + '</b></span></div>'; }).join('') + '</div></div>';
}

/* ═══════════════ LIBRARY ═══════════════ */
function stLibSidebar() {
    var owned = STG.filter(function (g) { return isOwned(g.id); });
    owned.sort(function (a, b) { return stHrs(b.id) - stHrs(a.id); });
    var rows = owned.map(function (g) {
        var status = isInst(g.id) ? (g.hrs2w > 0 ? 'ready' : 'installed') : 'notinst';
        var label = isInst(g.id) ? '' : 'not installed';
        return '<button class="st-lgrow' + (ST.gid === g.id && ST.view === 'game' ? ' sel' : '') + '" data-st="lib" data-id="' + g.id + '">' +
            '<span class="st-lgdot ' + status + '"></span><span class="st-lgname">' + esc(g.t) + '</span>' + (label ? '<span class="st-lgsub">' + label + '</span>' : '') + '</button>';
    }).join('');
    return '<aside class="st-lib-side"><label class="st-lib-find"><input type="text" placeholder="Search library" spellcheck="false" data-libsearch="1"></label>' +
        '<div class="st-lib-col"><div class="st-lg-head">Home</div><button class="st-lgrow' + (ST.view === 'home' ? ' sel' : '') + '" data-st="go" data-sec="library" data-view="home"><span class="st-lgdot home"></span><span class="st-lgname">Home</span></button>' +
        '<div class="st-lg-head">All Games <i>' + owned.length + '</i></div>' + rows + '</div></aside>';
}
function stLibHome() {
    var owned = STG.filter(function (g) { return isOwned(g.id); });
    var recent = owned.slice().sort(function (a, b) { return (b.hrs2w || 0) - (a.hrs2w || 0); }).slice(0, 5);
    var acts = [
        ['throttle_body', 'earned an achievement in', 'GTI RUN', 'gtirun'],
        ['you', 'reached ' + stHrs('factorio').toFixed(0) + ' hours in', 'Factorio', 'factorio'],
        ['nat20nate', 'is now playing', "Baldur's Gate 3", 'bg3']
    ];
    var h = '<div class="st-lib">' + stLibSidebar() + '<div class="st-lib-main">';
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
    var inst = isInst(g.id), dl = stInQueue(g.id);
    var playBtn;
    if (dl) playBtn = '<button class="st-play wide dis">' + gDl() + ' Installing… ' + dl.pct + '%</button>';
    else if (inst) playBtn = '<button class="st-play wide" data-st="play" data-id="' + g.id + '">' + gPlay() + ' PLAY</button>';
    else playBtn = '<button class="st-play wide install" data-st="install" data-id="' + g.id + '">' + gDl() + ' INSTALL</button>';
    var ach = g.ach || [0, 0], pct = ach[1] ? Math.round(ach[0] / ach[1] * 100) : 0;
    var achGrid = '';
    if (ach[1]) {
        var list = (g.achx || []).slice();
        while (list.length < 8 && list.length < ach[1]) { var gk = list.length < ach[0]; list.push([gk ? 'Achievement ' + (list.length + 1) : 'Locked', gk ? 'Unlocked — nice.' : 'Hidden until you earn it', gk ? 1 : 0]); }
        achGrid = '<div class="st-ach"><div class="st-ach-h"><span>Achievements</span><span>' + ach[0] + ' of ' + ach[1] + '</span></div>' +
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
        '<div class="st-lg-bar"><span><b>' + (g.hrs2w || 0).toFixed(1) + '</b> hrs past two weeks</span><span><b>' + stHrs(g.id).toFixed(1) + '</b> hrs total</span><span>' + (inst ? 'Installed' : dl ? 'Downloading' : 'Ready to install') + '</span><span class="st-lg-dev">' + esc(g.dev) + '</span></div>' +
        '<div class="st-lg-body">' + achGrid + friendsHTML + newsHTML +
          '<div class="st-lg-card"><h4>Links</h4><div class="st-lg-links"><button class="st-ghost" data-st="game" data-id="' + g.id + '">Store Page</button><button class="st-ghost">Community Hub</button><button class="st-ghost">Guides</button><button class="st-ghost">☁ Cloud: synced</button></div></div>' +
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
    return '<div class="st-prof"><div class="st-prof-hero">' +
        '<div class="st-prof-av">' + ic('ic-ure') + '</div>' +
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
        '<div class="st-cart-sum">' + (full !== sub ? '<div class="st-cart-line"><span>Discounts</span><b class="st-save">-' + stPrice(full - sub) + '</b></div>' : '') +
          '<div class="st-cart-line total"><span>Estimated total</span><b>' + stPrice(sub) + '</b></div>' +
          '<button class="st-play wide" data-st="checkout">Continue to payment</button>' +
          '<p class="st-cart-note">This is a museum checkout. No card, no charge — it just drops the game into your library.</p>' +
        '</div></div>';
}
function stCheckout() {
    var ids = stCart().slice(); if (!ids.length) return;
    stOverlay('Processing your order…', true);
    setTimeout(function () {
        ids.forEach(stGrant);
        sjSet('cart', []);
        sjSet('wish', stWish().filter(function (i) { return ids.indexOf(i) < 0; }));
        stClearOverlay();
        stToast('Purchase complete — ' + ids.length + ' item' + (ids.length === 1 ? '' : 's') + ' added to your library.');
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
    if (ST.section === 'downloads') stRender();
}
function stStartDl() {
    if (ST.dlT) return;
    ST.dlT = setInterval(function () {
        var q = stQueue(); if (!q.length) { clearInterval(ST.dlT); ST.dlT = 0; return; }
        var d = q[0];
        d.sp = 3 + Math.random() * 9;
        d.pct += reduce ? 100 : (4 + Math.random() * 9);
        if (d.pct >= 100) {
            d.pct = 100; stMarkInst(d.id); var done = q.shift();
            stToast(SG[done.id].t + ' — installed. Ready to play.');
            if (!q.length) { clearInterval(ST.dlT); ST.dlT = 0; }
        }
        stDock(); stSyncBadges();
        if (ST.section === 'downloads') { ST.body.innerHTML = stDownloads(); stPaintAll(); }
        else if (ST.section === 'library' && ST.view === 'game') {
            var bar = ST.body.querySelector('.st-play.dis'); if (bar && stInQueue(ST.gid)) bar.innerHTML = gDl() + ' Installing… ' + Math.floor(stInQueue(ST.gid).pct) + '%';
            else if (!stInQueue(ST.gid)) { ST.body.innerHTML = stLibGame(SG[ST.gid]); stPaintAll(); }
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
        '<button class="st-ghost" data-st="cancel" data-id="' + head.id + '">Pause</button></div>' : '<div class="st-dl-none">' + gDl() + '<p>No active downloads.</p><span>Install a game from your library or the store to see it here.</span></div>';
    var up = q.slice(1);
    return '<div class="st-pad st-dl"><h2 class="st-browse-h">Downloads</h2>' + active +
        (up.length ? '<h4 class="st-dl-h">Up Next</h4>' + up.map(function (d) { return '<div class="st-dl-q"><canvas class="st-dl-art sm" data-g="' + d.id + '" data-seed="2"></canvas><b>' + esc(SG[d.id].t) + '</b><span>Queued</span></div>'; }).join('') : '') +
        '<h4 class="st-dl-h">Ready to Play <i>' + installed.length + '</i></h4><div class="st-dl-done">' + installed.map(function (g) { return '<button class="st-dl-q done" data-st="lib" data-id="' + g.id + '"><canvas class="st-dl-art sm" data-g="' + g.id + '" data-seed="2"></canvas><b>' + esc(g.t) + '</b><span>' + gCheck() + ' Installed</span></button>'; }).join('') + '</div></div>';
}
function stDock() {
    if (!ST) return;
    var q = stQueue(), head = q[0];
    if (!head) { ST.dock.hidden = true; ST.dock.innerHTML = ''; return; }
    ST.dock.hidden = false;
    ST.dock.innerHTML = '<button class="st-dock-in" data-st="nav" data-id="downloads">' + gDl() +
        '<span class="st-dock-t">' + esc(SG[head.id].t) + '</span>' +
        '<span class="st-dock-bar"><i style="width:' + head.pct + '%"></i></span>' +
        '<span class="st-dock-pct">' + Math.floor(head.pct) + '%' + (q.length > 1 ? ' · +' + (q.length - 1) : '') + '</span></button>';
}

/* ═══════════════ launch / overlays / toasts ═══════════════ */
function stPlay(id) {
    var g = SG[id];
    if (!isInst(id)) { stInstall(id); return; }
    if (g.launch) { window.location.href = g.launch; return; }
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
    var c = stCart().length, d = stQueue().length;
    var cb = ST.root.querySelector('#stCartBadge'), db = ST.root.querySelector('#stDlBadge');
    if (cb) { cb.textContent = c; cb.hidden = !c; }
    if (db) { db.textContent = d; db.hidden = !d; }
}

/* ═══════════════ one click handler to rule them all ═══════════════ */
function stClick(e) {
    var el = e.target.closest('[data-st]'); if (!el) return;
    var act = el.getAttribute('data-st'), id = el.getAttribute('data-id');
    if (act === 'back') return stBack();
    if (act === 'nav') return stGo(id, 'home', null);
    if (act === 'go') return stGo(el.getAttribute('data-sec'), el.getAttribute('data-view'), null, { cat: el.getAttribute('data-cat') || null });
    if (act === 'game') { ST.q = ''; return stGo('store', 'game', id); }
    if (act === 'lib') return stGo('library', 'game', id);
    if (act === 'cat') { ST.q = ''; return stGo('store', 'browse', null, { cat: id }); }
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
}

var APPS = {
    explorer: { title: 'File Explorer', icon: 'ic-explorer', w: 720, h: 460, render: renderExplorer, init: initExplorer },
    about:    { title: 'About Isaac', icon: 'ic-ure', w: 540, h: 480, render: renderAbout },
    notepad:  { title: 'Untitled — Notepad', icon: 'ic-notepad', w: 520, h: 420, render: renderNotepad, init: initNotepad },
    terminal: { title: 'URE Shell', icon: 'ic-terminal', w: 620, h: 400, render: renderTerminal, init: initTerminal },
    settings: { title: 'Settings', icon: 'ic-settings', w: 660, h: 480, render: renderSettings, init: initSettings },
    photos:   { title: 'Photos', icon: 'ic-photos', w: 560, h: 440, render: renderPhotos, init: initPhotos },
    calc:     { title: 'Calculator', icon: 'ic-calc', w: 300, h: 440, render: renderCalc, init: initCalc },
    edge:     { title: 'Edge', icon: 'ic-edge', w: 700, h: 480, render: renderEdge, init: initEdge },
    bin:      { title: 'Recycle Bin', icon: 'ic-bin', w: 600, h: 400, render: renderBin },
    steam:    { title: 'Steam', icon: 'ic-steam', w: 960, h: 620, render: renderSteam, init: initSteam, onClose: closeSteam, focusArg: steamFocus },
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
    if (open) { closeFlyouts(); closeCtx(); if (!reduce) setTimeout(function () { startSearch.focus(); }, 40); }
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
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setStart(false); closeFlyouts(); closeCtx(); } });

applyAccent(recall('accent', ACCENTS[0].hex));
if (recall('crt', 'on') !== 'on') document.body.classList.add('no-crt');
renderWall();
tick(); setInterval(tick, 15000);

})();
