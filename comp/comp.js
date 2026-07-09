/* ============================================================
   THE COMPUTER — pixel Windows 11 desktop (foundation, UI only)
   The wallpaper is a hand-rendered pixel "Bloom": a low-res
   canvas with ordered (Bayer) dithering, scaled up crisp — the
   same trick the room uses. Everything else is a real, keyboard-
   reachable DOM desktop so it can grow apps later.
   Storage, when it comes, lives under the comp_ prefix.
   ============================================================ */
(function () {
'use strict';

var byId = function (id) { return document.getElementById(id); };
var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ───────────────────────── wallpaper ───────────────────────── */
var wall = byId('wall'), wctx = wall.getContext('2d');

// 4×4 ordered-dither matrix (Bayer)
var BAYER = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5];
// deep navy → blue → cyan → near-white: the Bloom ramp
var RAMP = [
    [8,14,34],[12,22,58],[18,40,92],[26,64,132],
    [44,104,180],[92,160,222],[158,204,240],[214,234,250]
];

function renderWall() {
    var vw = window.innerWidth, vh = window.innerHeight;
    // ~4 device px per art px; clamp the buffer to a sane size
    var scale = clamp(Math.round(Math.min(vw, vh) / 210), 3, 5);
    var iw = clamp(Math.round(vw / scale), 160, 640);
    var ih = clamp(Math.round(vh / scale), 120, 420);
    wall.width = iw; wall.height = ih;

    var img = wctx.createImageData(iw, ih), d = img.data;
    var cx = iw * 0.5, cy = ih * 0.44, R = Math.min(iw, ih) * 0.62;
    var last = RAMP.length - 1;

    for (var y = 0; y < ih; y++) {
        for (var x = 0; x < iw; x++) {
            var nx = (x - cx) / R, ny = (y - cy) / R;
            var r = Math.sqrt(nx * nx + ny * ny);
            var ang = Math.atan2(ny, nx);

            var petal  = 0.5 + 0.5 * Math.sin(ang * 5 + r * 2.4 - 0.6);   // 5 broad blades
            var ribbon = 0.5 + 0.5 * Math.sin(ang * 11 - r * 6.5);        // fine swirl inside
            var core   = Math.exp(-r * r * 1.7);                          // bright centre

            var bg  = 0.06 + 0.20 * (y / ih);                            // vertical wash
            var glow = core * 0.95
                     + Math.max(0, 1 - r) * 0.55 * (0.5 + 0.5 * petal)
                     + core * ribbon * 0.18;
            var v = clamp(bg + glow, 0, 1);

            var b = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5;     // ordered dither
            var idx = clamp(Math.round(v * last + b * 1.15), 0, last);
            var c = RAMP[idx];

            var o = (y * iw + x) * 4;
            d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
    }
    wctx.putImageData(img, 0, 0);
}

var rTimer = 0;
window.addEventListener('resize', function () {
    clearTimeout(rTimer); rTimer = setTimeout(renderWall, 120);
});
renderWall();

/* ─────────────────────────── clock ─────────────────────────── */
var clkTime = byId('clkTime'), clkDate = byId('clkDate');
function tick() {
    var n = new Date();
    var h = n.getHours(), m = n.getMinutes();
    var ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    clkTime.textContent = h12 + ':' + (m < 10 ? '0' + m : m) + ' ' + ap;
    clkTime.setAttribute('datetime', n.toISOString());
    clkDate.textContent = (n.getMonth() + 1) + '/' + n.getDate() + '/' + n.getFullYear();
}
tick(); setInterval(tick, 15000);

/* ──────────────────────── Start menu ───────────────────────── */
var startMenu = byId('startMenu'), startBtn = byId('startBtn');
function setStart(open) {
    startMenu.hidden = false;                       // keep in flow for the transition
    requestAnimationFrame(function () { startMenu.classList.toggle('open', open); });
    startBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) closeCtx();
}
startBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    setStart(!startMenu.classList.contains('open'));
});
startMenu.addEventListener('click', function (e) { e.stopPropagation(); });

/* ─────────────────────────── window ────────────────────────── */
var win = byId('winExplorer'), winBar = byId('winBar'), tbExplorer = byId('tbExplorer');
var zTop = 20;

function focusWin() { win.style.zIndex = ++zTop; }
function openWin() {
    win.hidden = false;
    if (!win.style.left) {                          // first open: centre-ish
        var w = win.offsetWidth, h = win.offsetHeight;
        win.style.left = Math.round((window.innerWidth - w) / 2) + 'px';
        win.style.top  = Math.round((window.innerHeight - h - 48) / 2 - 10) + 'px';
    }
    focusWin();
    tbExplorer.classList.add('running', 'active');
    setStart(false);
}
function closeWin() {
    win.hidden = true;
    tbExplorer.classList.remove('running', 'active');
}
function minWin() {
    win.hidden = true;
    tbExplorer.classList.add('running');
    tbExplorer.classList.remove('active');
}

tbExplorer.addEventListener('click', function () {
    if (win.hidden) openWin();
    else if (tbExplorer.classList.contains('active')) minWin();
    else { focusWin(); tbExplorer.classList.add('active'); }
});

// caption buttons
win.querySelector('.win-caps').addEventListener('click', function (e) {
    var b = e.target.closest('.cap'); if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'close') closeWin();
    else if (act === 'min') minWin();
    else if (act === 'max') win.classList.toggle('maxi');
});

// drag by the title bar
winBar.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.cap') || win.classList.contains('maxi')) return;
    focusWin();
    var r = win.getBoundingClientRect();
    var ox = e.clientX - r.left, oy = e.clientY - r.top;
    winBar.setPointerCapture(e.pointerId);
    function move(ev) {
        var x = clamp(ev.clientX - ox, 8 - r.width + 80, window.innerWidth - 80);
        var y = clamp(ev.clientY - oy, 0, window.innerHeight - 48 - 40);
        win.style.left = x + 'px'; win.style.top = y + 'px';
    }
    function up() {
        winBar.releasePointerCapture(e.pointerId);
        winBar.removeEventListener('pointermove', move);
        winBar.removeEventListener('pointerup', up);
    }
    winBar.addEventListener('pointermove', move);
    winBar.addEventListener('pointerup', up);
});

/* ─────────────────────── desktop icons ─────────────────────── */
var desktop = byId('desktop');
function clearSel() {
    var s = desktop.querySelectorAll('.dicon.sel');
    for (var i = 0; i < s.length; i++) s[i].classList.remove('sel');
}
desktop.addEventListener('click', function (e) {
    var d = e.target.closest('.dicon');
    clearSel();
    if (d) d.classList.add('sel');
});
desktop.addEventListener('dblclick', function (e) {
    var d = e.target.closest('.dicon'); if (!d) return;
    if (d.getAttribute('data-app') === 'explorer') openWin();
});
// pins / desktop icons that open the explorer window
document.querySelectorAll('[data-app="explorer"]').forEach(function (el) {
    el.addEventListener('click', function () { if (el.closest('.start') || el.closest('.pins')) openWin(); });
});

/* ─────────────────────── context menu ──────────────────────── */
var ctx = byId('ctx');
function closeCtx() { ctx.hidden = true; }
desktop.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    setStart(false);
    ctx.hidden = false;
    var w = ctx.offsetWidth, h = ctx.offsetHeight;
    ctx.style.left = clamp(e.clientX, 6, window.innerWidth - w - 6) + 'px';
    ctx.style.top  = clamp(e.clientY, 6, window.innerHeight - h - 6) + 'px';
});
ctx.addEventListener('click', function (e) {
    var it = e.target.closest('.ctx-item'); if (!it) return;
    if (it.getAttribute('data-act') === 'refresh') renderWall();
    if (!it.classList.contains('sub')) closeCtx();
});

/* ───────────────── global dismiss (click / Esc) ────────────── */
document.addEventListener('click', function () { setStart(false); closeCtx(); });
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { setStart(false); closeCtx(); }
});

})();
