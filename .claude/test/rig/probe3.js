/* The About pictures' little moves (PICS in the page's script). Usage: node probe3.js <baseUrl> <outDir> */
var pw = require('/opt/node22/lib/node_modules/playwright');
var fs = require('fs'), path = require('path');
var BASE = process.argv[2], OUT = path.resolve(process.argv[3] || 'probe3');
fs.mkdirSync(OUT, { recursive: true });
var FONTS = path.join(__dirname, 'fonts');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
var results = [];
function rec(name, ok, detail) { results.push({ name: name, ok: !!ok, detail: detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); }
var ORDER = ['cam', 'd20', 'pad', 'sis', 'gti'];

async function ctxWith(browser, opts, cold) {
    var c = await browser.newContext(opts || {});
    await c.addInitScript(function () { document.addEventListener('DOMContentLoaded', function () { document.documentElement.style.scrollBehavior = 'auto'; }); });
    if (!cold) await c.addInitScript(function () { try { sessionStorage.setItem('iu.booted', '1'); } catch (e) {} });
    // every play: one animate() per moving part, so a play is the calls on one picture within a few ms
    await c.addInitScript(function () {
        window.__plays = []; window.__errs = [];
        window.addEventListener('error', function (e) { window.__errs.push(String(e.message)); });
        var o = Element.prototype.animate;
        Element.prototype.animate = function () {
            var s = this.closest && this.closest('svg[data-pic]'), a = o.apply(this, arguments);
            if (s) {
                var k = s.getAttribute('data-pic'), t = performance.now(), last = window.__plays[window.__plays.length - 1];
                if (!last || last.k !== k || t - last.t > 20) window.__plays.push({ k: k, t: t, a: [a] }); else last.a.push(a);
            }
            return a;
        };
        new MutationObserver(function (recs) { var d = document.documentElement; if (!d) return; for (var i = 0; i < recs.length; i++) if (recs[i].target === d) { if (d.classList.contains('booting')) window.__wb = true; else if (window.__wb && !window.__ho) window.__ho = performance.now(); } }).observe(document, { attributes: true, attributeFilter: ['class'], subtree: true });
    });
    await c.route('https://fonts.googleapis.com/**', function (r) { r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(FONTS, 'gf.css')) }); });
    await c.route('https://fonts.gstatic.com/**', function (r) { var u = r.request().url(), f = path.join(FONTS, u.replace('https://fonts.gstatic.com/', '').replace(/\//g, '_')); if (fs.existsSync(f)) r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } }); else r.fulfill({ status: 404, body: '' }); });
    await c.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, function (r) { if (/fonts\.(googleapis|gstatic)\.com/.test(r.request().url())) return r.fallback(); r.abort(); });
    return c;
}
function plays(p) { return p.evaluate(function () { return window.__plays.map(function (x) { return { k: x.k, t: Math.round(x.t) }; }); }); }
function errs(p) { return p.evaluate(function () { return window.__errs; }); }
function tilesTop(p) { return p.evaluate(function () { return document.querySelector('.tiles').getBoundingClientRect().top + scrollY; }); }
function icoCenter(p, k) { return p.evaluate(function (i) { var r = document.querySelectorAll('.tile .ico')[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, ORDER.indexOf(k)); }

(async function () {
    var browser = await pw.chromium.launch(), c, p, pl, t0;
    try {
        var URL = BASE;
        /* T31 a warm visit: scroll the tiles into view and each picture plays once, in reading
           order, a turn (360ms) apart, the first a beat (250ms) after all of it is in view */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 900 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(500);
        var tt = await tilesTop(p);
        t0 = await p.evaluate(function (y) { scrollTo(0, y - 250); return performance.now(); }, tt);
        await sleep(3000);
        pl = await plays(p);
        var order = pl.map(function (x) { return x.k; }).join(','), gaps = pl.slice(1).map(function (x, i) { return x.t - pl[i].t; });
        rec('T31 warm scroll: each picture once, in order, a turn apart, the first a beat in', order === ORDER.join(',') && pl[0].t - t0 >= 230 && pl[0].t - t0 <= 450 && gaps.every(function (g) { return g >= 340 && g <= 460; }), { order: order, first: pl.length && Math.round(pl[0].t - t0), gaps: gaps });
        // T33 coming straight back doesn't replay (rereading); after 20s, right off the screen and back, it does
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(600);
        await p.evaluate(function (y) { scrollTo(0, y - 250); }, tt); await sleep(2500);
        var n1 = (await plays(p)).length;
        rec('T33 back within 20s: no replay', n1 === 5, { plays: n1 });
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(18500);
        await p.evaluate(function (y) { scrollTo(0, y - 250); }, tt); await sleep(2800);
        var n2 = (await plays(p)).length;
        rec('T33b right off the screen, then a jump straight back after 20s: each plays again', n2 === 10, { plays: n2 });
        // T34 hover: a pointer resting on a picture replays it after 120ms; again at once, or on the text, doesn't
        await sleep(1200);
        var h0 = (await plays(p)).length;
        var cc = await icoCenter(p, 'd20');
        await p.mouse.move(cc.x, cc.y); await sleep(500);
        var h1 = await plays(p), last = h1[h1.length - 1];
        await p.mouse.move(cc.x + 200, cc.y); await p.mouse.move(cc.x, cc.y); await sleep(300);
        var h2 = (await plays(p)).length;
        var txt = await p.evaluate(function () { var r = document.querySelectorAll('.tile')[3].querySelector('div').getBoundingClientRect(); return { x: r.left + 20, y: r.top + 10 }; });
        await sleep(900); await p.mouse.move(txt.x, txt.y); await sleep(500);
        var h3 = (await plays(p)).length;
        rec('T34 hover: the d20 replays; again straight after, or over the tile text, nothing', h1.length === h0 + 1 && last.k === 'd20' && h2 === h0 + 1 && h3 === h0 + 1, { before: h0, after1: h1.length, k: last && last.k, after2: h2, text: h3 });
        // T34b a pointer that the page scrolls under (not moved by hand) doesn't play it
        await p.mouse.move(5, 5); await sleep(900);
        cc = await icoCenter(p, 'pad');
        await p.mouse.move(cc.x, cc.y + 120); await sleep(900);   // resting below the pad
        var s0 = (await plays(p)).length;
        await p.mouse.wheel(0, 120); await sleep(700);             // the page moves the pad under it
        var s1 = (await plays(p)).length;
        rec('T34b scrolling a picture under a still pointer plays nothing', s1 === s0, { before: s0, after: s1 });
        rec('T31b no page errors', (await errs(p)).length === 0, await errs(p));
        await c.close();

        // T32 a fling past the tiles plays nothing
        c = await ctxWith(browser, { viewport: { width: 1280, height: 900 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(500);
        tt = await tilesTop(p);
        await p.evaluate(function (y) { scrollTo(0, y - 250); }, tt); await sleep(120);
        await p.evaluate(function () { scrollTo(0, document.documentElement.scrollHeight); }); await sleep(1500);
        pl = await plays(p);
        rec('T32 a fling past the tiles plays nothing', pl.length === 0, pl);
        await c.close();

        // T35 a phone: each plays as you scroll to it; a tap replays once (not twice for the tap's mouse events)
        c = await ctxWith(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(500);
        tt = await tilesTop(p);
        for (var y = tt - 600; y <= tt + 700; y += 120) { await p.evaluate(function (v) { scrollTo(0, v); }, y); await sleep(700); }
        await sleep(800);
        pl = await plays(p);
        var got = pl.map(function (x) { return x.k; });
        await p.evaluate(function (v) { scrollTo(0, v); }, tt + 100); await sleep(1500);
        var before = (await plays(p)).length;
        var cg = await p.evaluate(function () { var s = document.querySelectorAll('.tile .ico')[2]; s.scrollIntoView({ block: 'center' }); var r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
        await sleep(1200); before = (await plays(p)).length;
        await p.touchscreen.tap(cg.x, cg.y); await sleep(700);
        var after = (await plays(p)), lastTap = after[after.length - 1];
        rec('T35 phone: all five play as they come into view; a tap replays the pad once', got.slice().sort().join(',') === ORDER.slice().sort().join(',') && got.length === 5 && after.length === before + 1 && lastTap.k === 'pad', { got: got, before: before, after: after.length });
        await c.close();

        // T36 reduced motion: nothing plays, whatever happens; switched on mid-play, the play stops and the picture is itself
        c = await ctxWith(browser, { viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(500);
        tt = await tilesTop(p);
        await p.evaluate(function (y) { scrollTo(0, y - 250); }, tt); await sleep(2500);
        cc = await icoCenter(p, 'cam'); await p.mouse.move(cc.x, cc.y); await sleep(500); await p.mouse.click(cc.x, cc.y); await sleep(500);
        pl = await plays(p);
        rec('T36 reduced motion: no picture moves (view, hover, click)', pl.length === 0, pl);
        await c.close();
        c = await ctxWith(browser, { viewport: { width: 1280, height: 900 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(500);
        tt = await tilesTop(p);
        await p.evaluate(function (y) { scrollTo(0, y - 250); }, tt);
        for (var w = 0; w < 40; w++) { if ((await plays(p)).some(function (x) { return x.k === 'gti'; })) break; await sleep(50); }
        await sleep(200);                                       // the car mid-lap
        await p.emulateMedia({ reducedMotion: 'reduce' }); await sleep(150);
        var live = await p.evaluate(function () {
            var run = window.__plays.filter(function (x) { return x.k === 'gti'; })[0].a.filter(function (a) { return a.playState === 'running'; }).length;
            var s = document.querySelector('svg[data-pic="gti"]'), car = s.querySelector('[data-f="car"]');
            return { running: run, transform: getComputedStyle(car).transform };
        });
        await sleep(2000);
        var more = (await plays(p)).filter(function (x) { return x.k === 'gti'; }).length;
        rec('T36b reduced motion switched on mid-play: the car stops where it belongs, nothing else plays', live.running === 0 && (live.transform === 'none' || live.transform === 'matrix(1, 0, 0, 1, 0, 0)') && more === 1, { live: live, gtiPlays: more });
        await c.close();

        // T37 a first visit on a tall screen: all five play after the commands, in order, done inside 5s of the hand-off
        c = await ctxWith(browser, { viewport: { width: 1600, height: 900 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(300);
        // the hero centres itself in the window, so a taller window pushes the tiles down too: settle on a height that holds them
        var TALL = 900;
        for (var it = 0; it < 12; it++) {
            await p.setViewportSize({ width: 1600, height: TALL }); await sleep(150);
            var bot = await p.evaluate(function () { return Math.ceil(document.querySelector('.tiles').getBoundingClientRect().bottom + scrollY); });
            if (bot + 20 <= TALL) break;
            TALL = bot + 40;
        }
        await c.close();
        c = await ctxWith(browser, { viewport: { width: 1600, height: TALL } }, true);
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(600); await p.keyboard.press('Space');
        await sleep(6000);
        var cold = await p.evaluate(function () { var ho = window.__ho; return window.__plays.map(function (x) { var end = 0; x.a.forEach(function (a) { var ct = a.effect.getComputedTiming(); end = Math.max(end, x.t + ct.endTime); }); return { k: x.k, at: Math.round(x.t - ho), end: Math.round(end - ho) }; }); });
        var lastEnd = Math.max.apply(null, cold.map(function (x) { return x.end; }));
        rec('T37 first visit, 1600x' + TALL + ' (the tiles on the first screen): five plays in order after the hold (1.9s), the last done by 5s', cold.map(function (x) { return x.k; }).join(',') === ORDER.join(',') && cold[0].at >= 1900 && lastEnd < 5000, { plays: cold, lastEnd: lastEnd });
        rec('T37b no page errors', (await errs(p)).length === 0, await errs(p));
        await c.close();

        // T38 no JS: the pictures are simply the pictures (no frame showing)
        c = await ctxWith(browser, { viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(300);
        var shown = await p.evaluate(function () { return Array.prototype.filter.call(document.querySelectorAll('.tile .pf'), function (g) { return getComputedStyle(g).opacity !== '0'; }).length; });
        rec('T38 no JS: every extra frame hidden', shown === 0, { shownFrames: shown });
        await c.close();
    } finally {
        await browser.close();
        fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
        console.log('\n' + results.filter(function (r) { return r.ok; }).length + '/' + results.length + ' passed');
    }
})();
