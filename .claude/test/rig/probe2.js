/* Regression-fix probe for /test. Usage: node probe2.js <baseUrl> <outDir> */
var pw = require('/opt/node22/lib/node_modules/playwright');
var fs = require('fs'), path = require('path');
var BASE = process.argv[2], OUT = path.resolve(process.argv[3] || 'probe2');
fs.mkdirSync(OUT, { recursive: true });
var FONTS = path.join(__dirname, 'fonts');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
var results = [];
function rec(name, ok, detail) { results.push({ name: name, ok: !!ok, detail: detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); }

async function ctxWith(browser, opts, fontMode) {
    var c = await browser.newContext(opts || {});
    await c.addInitScript(function () { document.addEventListener('DOMContentLoaded', function () { document.documentElement.style.scrollBehavior = 'auto'; }); });
    // the moment of the hand-off, and every Element.animate call on an eye
    // (documentElement doesn't exist yet when this runs: watch the document itself)
    await c.addInitScript(function () {
        window.__anim = [];
        var orig = Element.prototype.animate;
        Element.prototype.animate = function () {
            var eye = this.closest && this.closest('.eye') ? 'hero' : (this.closest && this.closest('.foot-eye') ? 'foot' : 'other');
            window.__anim.push({ t: performance.now(), eye: eye });
            return orig.apply(this, arguments);
        };
        new MutationObserver(function (recs) {
            var d = document.documentElement; if (!d) return;
            for (var i = 0; i < recs.length; i++) if (recs[i].target === d) {
                if (d.classList.contains('booting')) window.__wasBooting = true;
                else if (window.__wasBooting && !window.__handoff) window.__handoff = performance.now();
            }
        }).observe(document, { attributes: true, attributeFilter: ['class'], subtree: true });
        window.__probeOk = true;
    });
    await c.route('https://fonts.googleapis.com/**', function (r) {
        if (fontMode === 'block') return r.abort();
        r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(FONTS, 'gf.css')) });
    });
    await c.route('https://fonts.gstatic.com/**', async function (r) {
        if (fontMode === 'block') return r.abort();
        var u = r.request().url();
        var f = path.join(FONTS, u.replace('https://fonts.gstatic.com/', '').replace(/\//g, '_'));
        if (fs.existsSync(f)) r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } });
        else r.fulfill({ status: 404, body: '' });
    });
    await c.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, function (r) { if (/fonts\.(googleapis|gstatic)\.com/.test(r.request().url())) return r.fallback(); r.abort(); });
    return c;
}
async function warm(c) { await c.addInitScript(function () { try { sessionStorage.setItem('iu.booted', '1'); } catch (e) {} }); }
async function waitHandoff(p) { for (var i = 0; i < 240; i++) { var h = await p.evaluate(function () { return window.__handoff || 0; }); if (h) return h; await sleep(40); } throw new Error('hand-off never seen'); }
async function sinceHandoff(p) { return p.evaluate(function () { return performance.now() - window.__handoff; }); }
async function atAfter(p, ms) { var el = await sinceHandoff(p); if (!(el >= 0)) throw new Error('no hand-off time'); if (ms > el) await sleep(ms - el); }
function focusInfo(p) {
    return p.evaluate(function () {
        var a = document.activeElement, bar = document.getElementById('bar'), cs = getComputedStyle(bar);
        return { href: a && a.getAttribute ? a.getAttribute('href') : null, id: a && a.id, tag: a && a.tagName, y: Math.round(scrollY), barOpacity: cs.opacity, barVis: cs.visibility, barPE: cs.pointerEvents, hash: location.hash };
    });
}
function center(p, sel) { return p.evaluate(function (s) { var r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel); }
function animCount(p, which) { return p.evaluate(function (w) { return window.__anim.filter(function (a) { return a.eye === w; }).length; }, which); }

(async function () {
    var browser = await pw.chromium.launch();
    var c, p, s, i;
    try {
        var URL = BASE;
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(500); await p.keyboard.press('Space');
        var h0 = await waitHandoff(p);
        var inst = await p.evaluate(function () { return { ok: !!window.__probeOk, hooked: /__anim/.test(String(Element.prototype.animate)) }; });
        await p.evaluate(function () { document.body.animate([{ opacity: 1 }, { opacity: 1 }], 10); });
        var n0 = await p.evaluate(function () { return window.__anim.length; });
        rec('T0 probe instrumentation live (hand-off seen, animate hooked)', h0 > 0 && inst.ok && inst.hooked && n0 >= 1, { handoff: Math.round(h0), inst: inst, calls: n0 });
        await c.close();

        /* ── T19 (a) the cold bar: keyboard reaches it and shows it; the pointer can't hit it until it shows ── */
        for (var PATH of ['A', 'B', 'C']) {
            for (var D of [300, 700, 1500]) {
                c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
                p = await c.newPage();
                await p.goto(URL, { waitUntil: 'domcontentloaded' });
                if (PATH === 'A') {                        // let the boot end, then Tab, Tab
                    await waitHandoff(p); await atAfter(p, 80); await p.keyboard.press('Tab');
                } else if (PATH === 'B') {                 // Tab to the skip button, Enter
                    await sleep(1600); await p.keyboard.press('Tab');
                    var onBtn = await p.evaluate(function () { return document.activeElement.id; });
                    if (onBtn !== 'termSkip') rec('T19 path B reached the skip button', false, onBtn);
                    await p.keyboard.press('Enter'); await waitHandoff(p);
                } else {                                   // Tab at 0.5s: lands on the skip link, which ends the boot
                    await sleep(500); await p.keyboard.press('Tab'); await waitHandoff(p);
                }
                await atAfter(p, D); await p.keyboard.press('Tab'); await sleep(120);
                s = await focusInfo(p);
                var el = Math.round(await sinceHandoff(p));
                rec('T19a path ' + PATH + ', Tab at +' + D + ': "> about", shown, page still', s.href === '#about' && s.y === 0 && s.barOpacity === '1', { s: s, at: el });
                await c.close();
            }
        }
        // T19b: a second click or tap in the window falls through; after it, it navigates
        for (var M of ['mouse', 'touch']) {
            for (var W2 of [250, 900, 2100]) {
                c = await ctxWith(browser, M === 'mouse' ? { viewport: { width: 1280, height: 800 } } : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
                p = await c.newPage();
                await p.goto(URL, { waitUntil: 'load' }); await sleep(600);
                if (M === 'mouse') await p.mouse.click(640, 300); else await p.touchscreen.tap(195, 300);
                await waitHandoff(p);
                await atAfter(p, W2);
                var pe = await focusInfo(p);
                var at = await center(p, '.bar a[href="#log"]');
                if (M === 'mouse') await p.mouse.click(at.x, at.y); else await p.touchscreen.tap(at.x, at.y);
                await sleep(500);
                s = await focusInfo(p);
                var shouldNav = W2 > 1900;
                rec('T19b ' + M + ' on "> log" at +' + W2 + (shouldNav ? ' navigates' : ' falls through'), shouldNav ? (s.hash === '#log' && s.y > 500) : (s.hash === '' && s.y === 0 && pe.barPE === 'none'), { before: pe.barPE, after: s });
                await c.close();
            }
        }
        // T19c: the back-to-top eye pinned at the hand-off (?boot#log) doesn't take the second tap either
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        p = await c.newPage();
        await p.goto(URL + '?boot#log', { waitUntil: 'load' }); await sleep(700);
        await p.mouse.click(640, 400); await waitHandoff(p); await atAfter(p, 300);
        var y0 = await p.evaluate(function () { return Math.round(scrollY); });
        var home = await center(p, '.bar .home');
        await p.mouse.click(home.x, home.y); await sleep(600);
        var y1 = await p.evaluate(function () { return Math.round(scrollY); });
        rec('T19c pinned eye in the window: the tap falls through', y0 > 500 && y1 === y0, { y0: y0, y1: y1 });
        await atAfter(p, 2100); home = await center(p, '.bar .home');
        await p.mouse.click(home.x, home.y); await sleep(700);
        y1 = await p.evaluate(function () { return Math.round(scrollY); });
        rec('T19c after the window the eye takes you up', y1 === 0, { y1: y1 });
        await c.close();
        // T19d: reduced motion switched on inside the window: the bar shows and takes clicks
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(600);
        await p.keyboard.press('Space'); await waitHandoff(p); await atAfter(p, 300);
        await p.emulateMedia({ reducedMotion: 'reduce' }); await sleep(100);
        s = await focusInfo(p);
        at = await center(p, '.bar a[href="#log"]');
        await p.mouse.click(at.x, at.y); await sleep(500);
        var s2 = await focusInfo(p);
        rec('T19d reduced motion mid-window: bar shown and live', s.barOpacity === '1' && s.barPE === 'auto' && s2.hash === '#log', { s: s, after: s2 });
        await c.close();
        // T19e: reduced motion from the start, and no JS: the bar is simply there
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(150);
        s = await focusInfo(p);
        var bfo = await p.evaluate(function () { return Array.prototype.map.call(document.querySelectorAll('.bf'), function (g) { return getComputedStyle(g).opacity; }).join(''); });
        rec('T19e reduced motion: bar shown and live at once, lids hidden', s.barOpacity === '1' && s.barPE === 'auto' && /^0+$/.test(bfo), { s: s, bf: bfo });
        await c.close();
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(150);
        s = await focusInfo(p);
        await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await sleep(150);
        var nj = await p.evaluate(function () { return { f: document.activeElement.getAttribute('href'), spt: getComputedStyle(document.documentElement).scrollPaddingTop, y: Math.round(scrollY) }; });
        rec('T19e no JS: bar shown and live; focus on it drops the top padding', s.barOpacity === '1' && s.barPE === 'auto' && nj.f === '#about' && nj.spt === '0px', { s: s, nj: nj });
        await c.close();

        /* ── T20 (g)(j) shared edges on phones: screen, answer, commands, column, photo ── */
        var edgeFails = [];
        for (var PWD of [320, 341, 375, 390, 393, 395, 396, 402, 412, 414, 430, 500, 600, 639]) {
            c = await ctxWith(browser, { viewport: { width: PWD, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
            await warm(c);
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'load' }); await sleep(300);
            var ed = await p.evaluate(function () {
                function R(sel) { var r = document.querySelector(sel).getBoundingClientRect(); return { l: r.left, r: r.right }; }
                return { frame: R('#frame'), answer: R('.answer'), barIn: R('.bar-in'), main: R('#main'), shot: R('.shot'), name: document.querySelector('.holding-word .nm').getBoundingClientRect().left, sw: document.documentElement.scrollWidth, iw: innerWidth };
            });
            var ok = ['frame', 'answer', 'barIn', 'shot'].every(function (k) { return Math.abs(ed[k].r - ed.main.r) < 0.01 && Math.abs(ed[k].l - ed.main.l) < 0.01; }) && Math.abs(ed.name - Math.round(ed.name)) < 0.01 && ed.sw <= ed.iw;
            if (!ok) edgeFails.push({ w: PWD, ed: ed });
            await c.close();
        }
        rec('T20 phones 320-639: screen, answer, commands, photo and column share both edges; name on whole px', edgeFails.length === 0, edgeFails.slice(0, 3));
        // narrow desktop windows, with the scrollbar gutter: the name on whole pixels
        var deskFails = [];
        for (var DW of [320, 330, 360, 384, 400, 410, 411]) {
            c = await ctxWith(browser, { viewport: { width: DW, height: 800 } });
            await warm(c);
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'load' }); await sleep(300);
            var dd = await p.evaluate(function () { var f = document.querySelector('#frame').getBoundingClientRect(), m = document.querySelector('#main').getBoundingClientRect(); return { name: document.querySelector('.holding-word .nm').getBoundingClientRect().left, fr: f.right, mr: m.right, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }; });
            if (Math.abs(dd.name - Math.round(dd.name)) > 0.01 || Math.abs(dd.fr - dd.mr) > 0.01 || dd.sw > dd.cw) deskFails.push({ w: DW, dd: dd });
            await c.close();
        }
        rec('T20b narrow desktop windows: name on whole px, screen and column share the right edge', deskFails.length === 0, deskFails.slice(0, 3));

        /* ── T21 (b) the readout without contain: inline-size (an older engine) ── */
        for (var RW of [390, 1440]) {
            for (var mode of ['contain', 'no-contain']) {
                c = await ctxWith(browser, RW === 390 ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : { viewport: { width: 1440, height: 900 } });
                await warm(c);
                p = await c.newPage();
                await p.goto(URL, { waitUntil: 'load' }); await sleep(200);
                if (mode === 'no-contain') await p.addStyleTag({ content: '.ro dt .ld { contain: none !important; }' });
                await sleep(100);
                var ro = await p.evaluate(function () {
                    var dts = Array.prototype.map.call(document.querySelectorAll('.ro dt'), function (d) { return Math.round(d.getBoundingClientRect().width); });
                    var dds = Array.prototype.map.call(document.querySelectorAll('.ro dd'), function (d) { return Math.round(d.getBoundingClientRect().width); });
                    var pr = document.createElement('span'); pr.style.cssText = 'position:absolute;visibility:hidden;white-space:pre'; pr.textContent = '0000000000'; document.querySelector('.ro dt').appendChild(pr); var ch = pr.getBoundingClientRect().width / 10; pr.remove();
                    return { dtMax: Math.max.apply(null, dts), ch: Math.round(ch * 100) / 100, ddMin: Math.min.apply(null, dds), n: dts.length, sw: document.documentElement.scrollWidth, iw: innerWidth };
                });
                // keys hold to their 19-column design (+1 for rounding); without contain an old engine balloons them past 1000px
                rec('T21 readout ' + mode + ' at ' + RW + ': keys narrow, values wide, no overflow', ro.dtMax <= 20 * ro.ch && ro.ddMin >= 60 && ro.sw <= ro.iw, ro);
                await c.close();
            }
        }

        /* ── T22 (d) blinks follow a live switch to reduced motion ── */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        await warm(c);
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(2400);
        await p.keyboard.press('End'); await sleep(700);
        var foot1 = await animCount(p, 'foot');
        await p.keyboard.press('Home'); await sleep(800);
        var hero1 = await animCount(p, 'hero');
        await p.emulateMedia({ reducedMotion: 'reduce' }); await sleep(100);
        await p.keyboard.press('End'); await sleep(700);
        await p.keyboard.press('Home'); await sleep(800);
        var foot2 = await animCount(p, 'foot'), hero2 = await animCount(p, 'hero');
        rec('T22 blinks play, then stop at a live switch to reduced motion', foot1 === 3 && hero1 === 3 && foot2 === 3 && hero2 === 3, { foot1: foot1, hero1: hero1, foot2: foot2, hero2: hero2 });
        await c.close();

        /* ── T23 (e) no blink on top of a blink ── */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        await warm(c);
        p = await c.newPage();
        var tLoad = Date.now();
        await p.goto(URL, { waitUntil: 'domcontentloaded' });
        await sleep(Math.max(0, 300 - (Date.now() - tLoad))); await p.evaluate(function () { scrollTo(0, 1400); });
        await sleep(Math.max(0, 750 - (Date.now() - tLoad))); await p.evaluate(function () { scrollTo(0, 0); });
        await sleep(1500);
        var n1 = await animCount(p, 'hero');
        rec('T23 back within the first second: the CSS blink alone, no second one', n1 === 0, { heroAnimateCalls: n1 });
        await sleep(600);
        await p.evaluate(function () { scrollTo(0, 1400); }); await sleep(200);
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(120);
        var n2 = await animCount(p, 'hero');
        await p.evaluate(function () { scrollTo(0, 1400); }); await sleep(100);
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(700);
        var n3 = await animCount(p, 'hero');
        rec('T23b a later return blinks once; a second return mid-blink adds none', n2 === 3 && n3 === 3, { n2: n2, n3: n3 });
        await c.close();

        /* ── T24 (f) never spent out of sight, and no replay on a wobble ── */
        for (var BV of [[1280, 800], [844, 390], [390, 844]]) {
            c = await ctxWith(browser, BV[0] === 390 ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : { viewport: { width: BV[0], height: BV[1] } });
            await warm(c);
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'load' }); await sleep(2400);
            var eyeTop = await p.evaluate(function () { return document.querySelector('.eye').getBoundingClientRect().top + scrollY; });
            await p.evaluate(function () { scrollTo(0, 3000); }); await sleep(200);
            await p.evaluate(function (t) { scrollTo(0, t + 40); }, eyeTop); await sleep(700);   // the bottom of the eye in view, not its lids
            var part = await animCount(p, 'hero');
            await p.evaluate(function () { scrollTo(0, 0); }); await sleep(200);
            var full = await animCount(p, 'hero');
            var inView = await p.evaluate(function () { var q = document.querySelector('.eye').getBoundingClientRect(); return q.top + q.height / 4 >= 0 && q.top + q.height * .75 <= innerHeight; });
            for (i = 0; i < 5; i++) { await p.evaluate(function (t) { scrollTo(0, t + 40); }, eyeTop); await sleep(120); await p.evaluate(function () { scrollTo(0, 0); }); await sleep(600); }
            var wob = await animCount(p, 'hero');
            rec('T24 ' + BV.join('x') + ': held back while the lids are out of view, one blink when they arrive, none on a wobble', part === 0 && full === 3 && inView && wob === 3, { part: part, full: full, wobble: wob });
            await c.close();
        }

        /* ── T25 (h) short windows: the small screen again, and the answer on the first screen ── */
        for (var SV of [[844, 390], [750, 342], [640, 400], [568, 320], [932, 430]]) {
            c = await ctxWith(browser, { viewport: { width: SV[0], height: SV[1] } });
            await warm(c);
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'load' }); await sleep(300);
            var fs1 = await p.evaluate(function () {
                var a = document.querySelector('.answer'), rg = document.createRange(); rg.selectNodeContents(a);
                var tops = {}, vis = 0;
                Array.prototype.forEach.call(rg.getClientRects(), function (r) { var k = Math.round(r.top); if (!tops[k]) { tops[k] = 1; if (r.bottom <= innerHeight) vis++; } });
                var bi = document.querySelector('.bar-in'), kids = Array.prototype.map.call(bi.children, function (k) { return Math.round(k.getBoundingClientRect().top + k.getBoundingClientRect().height / 2); });
                return { lcd: Math.round(document.getElementById('frame').getBoundingClientRect().width), lines: Object.keys(tops).length, visible: vis, oneRow: Math.max.apply(null, kids) - Math.min.apply(null, kids) <= 2, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
            });
            rec('T25 ' + SV.join('x') + ': screen ' + fs1.lcd + 'px, ' + fs1.visible + '/' + fs1.lines + ' answer lines on the first screen, one-row bar', fs1.visible >= 2 && fs1.oneRow && fs1.sw <= fs1.cw, fs1);
            await c.close();
        }

        /* ── T26 (l) larger default text and WCAG spacing: the commands keep to one row ── */
        for (var FS of [[20, 1280, 800], [24, 1280, 800], [32, 1280, 800], [20, 844, 390], [24, 390, 844], ['ts', 1280, 800], ['ts', 844, 390]]) {
            c = await ctxWith(browser, { viewport: { width: FS[1], height: FS[2] } });
            await warm(c);
            p = await c.newPage();
            if (FS[0] !== 'ts') { var cdp = await c.newCDPSession(p); await cdp.send('Page.setFontSizes', { fontSizes: { standard: FS[0], fixed: FS[0] } }); }
            await p.goto(URL, { waitUntil: 'load' }); await sleep(300);
            if (FS[0] === 'ts') { await p.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' }); await sleep(200); }
            var br = await p.evaluate(function () {
                var bi = document.querySelector('.bar-in'), kids = Array.prototype.map.call(bi.children, function (k) { var r = k.getBoundingClientRect(); return Math.round(r.top + r.height / 2); });
                return { h: Math.round(document.getElementById('bar').getBoundingClientRect().height), oneRow: Math.max.apply(null, kids) - Math.min.apply(null, kids) <= 2, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, rem: parseFloat(getComputedStyle(document.documentElement).fontSize) };
            });
            var room = FS[1] >= 640;                   // a 390 phone at 24px has no room for one row: wrapping there is right
            rec('T26 ' + FS.join(' ') + ': ' + (room ? 'one-row bar' : 'wraps only for lack of room') + ', no sideways scroll', (room ? br.oneRow : true) && br.sw <= br.cw, br);
            await c.close();
        }

        /* ── T27 (m) the name copies once ── */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 }, permissions: ['clipboard-read', 'clipboard-write'] });
        await warm(c);
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(2400);
        await p.keyboard.press('Control+A'); await p.keyboard.press('Control+C'); await sleep(100);
        var all = await p.evaluate(function () { return navigator.clipboard.readText(); });
        var ure = await center(p, '.holding-word .nm b');
        await p.mouse.dblclick(ure.x, ure.y); await p.keyboard.press('Control+C'); await sleep(100);
        var dbl = await p.evaluate(function () { return navigator.clipboard.readText(); });
        var head = all.slice(0, 80);
        rec('T27 select-all copies the name once; a double-click on URE copies "Ure"', !/Isaac UreIsaac Ure/.test(all) && (head.match(/Isaac Ure/g) || []).length === 1 && dbl === 'Ure', { head: head, dbl: dbl });
        var ax = await p.evaluate(function () { var h = document.querySelector('h1'); return { first: h.firstElementChild.className, text: h.textContent }; });
        rec('T27b the hidden copy comes first', ax.first === 'vh', ax);
        await c.close();

        /* ── T28 (n) paging with focus on the pinned commands ── */
        for (var ZV of [[640, 400], [427, 267], [320, 200], [1280, 800]]) {
            c = await ctxWith(browser, { viewport: { width: ZV[0], height: ZV[1] }, deviceScaleFactor: 1280 / ZV[0] });
            await warm(c);
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'load' }); await sleep(400);
            // both steps from the same place, well clear of the page's end
            await p.evaluate(function () { scrollTo(0, 1200); }); await sleep(300);
            await p.evaluate(function () { document.getElementById('main').focus({ preventScroll: true }); }); await sleep(150);
            var a0 = await p.evaluate(function () { return scrollY; });
            var padsMain = await p.evaluate(function () { var cs = getComputedStyle(document.documentElement); return { top: cs.scrollPaddingTop, bottom: cs.scrollPaddingBottom }; });
            await p.keyboard.press('PageDown'); await sleep(900);
            var a1 = await p.evaluate(function () { return scrollY; });
            await p.evaluate(function () { scrollTo(0, 1200); }); await sleep(300);
            await p.evaluate(function () { document.querySelector('#bar a[href="#about"]').focus({ preventScroll: true }); }); await sleep(150);
            var inBar = await p.evaluate(function () { return document.getElementById('bar').contains(document.activeElement) && document.getElementById('bar').classList.contains('stuck'); });
            var pads = await p.evaluate(function () { var cs = getComputedStyle(document.documentElement); return { top: cs.scrollPaddingTop, bottom: cs.scrollPaddingBottom, barH: document.getElementById('bar').offsetHeight }; });
            var b0 = await p.evaluate(function () { return scrollY; });
            await p.keyboard.press('PageDown'); await sleep(900);
            var b1 = await p.evaluate(function () { return scrollY; });
            var maxY = await p.evaluate(function () { return document.documentElement.scrollHeight - innerHeight; });
            var stepMain = a1 - a0, stepBar = b1 - b0;
            rec('T28 ' + ZV.join('x') + ' (1280x800 at ' + Math.round(128000 / ZV[0]) + '%): a page from the pinned commands = a page from the content', inBar && a0 === b0 && stepMain > 0 && a1 < maxY && Math.abs(stepMain - stepBar) <= 1 && pads.top === '0px' && parseFloat(pads.bottom) === pads.barH + 4, { stepMain: stepMain, stepBar: stepBar, padsMain: padsMain, pads: pads, a0: a0, b0: b0 });
            await c.close();
        }
        // and a resting bar near the fold: the first Tab onto it doesn't throw the page up. the
        // heights are found, not fixed: for each width, the shortest window whose resting
        // "> about" is whole on screen in the bottom 56px (where a bottom scroll padding would
        // have counted it hidden and centred it)
        for (var RW2 of [1280, 844, 500, 390, 320]) {
            c = await ctxWith(browser, { viewport: { width: RW2, height: 800 } });
            await warm(c);
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'load' }); await sleep(400);
            var RH = null;
            for (var hh = 360; hh <= 900; hh += 2) {
                await p.setViewportSize({ width: RW2, height: hh }); await sleep(60);
                var lr = await p.evaluate(function () { var r = document.querySelector('#bar a[href="#about"]').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, vh: innerHeight }; });
                if (lr.top >= 0 && lr.bottom <= lr.vh && lr.bottom > lr.vh - 56) { RH = hh; break; }
            }
            await c.close();
            if (!RH) { rec('T28b resting bar near the fold at ' + RW2 + ' wide: found a window to try', false, 'none from 360 to 900 tall'); continue; }
            c = await ctxWith(browser, { viewport: { width: RW2, height: RH } });
            await warm(c);
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'load' }); await sleep(400);
            await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await sleep(400);
            var rt = await p.evaluate(function () { var a = document.activeElement, r = a.getBoundingClientRect(); return { f: a.getAttribute('href'), y: Math.round(scrollY), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; });
            rec('T28b resting bar at ' + RW2 + 'x' + RH + ': Tab onto "> about" moves the page only as far as it must', rt.f === '#about' && rt.y <= 60 && rt.top >= 0 && rt.bottom <= rt.vh, rt);
            await c.close();
        }

        /* ── T29 (o)(i) the power-on is over inside 5s; the name has its own layer ── */
        for (var HV of ['cold', 'warm']) {
            c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
            if (HV === 'warm') await warm(c);
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'domcontentloaded' });
            var tRef = 0;
            if (HV === 'cold') { await sleep(500); await p.keyboard.press('Space'); tRef = await waitHandoff(p); }
            var endT = await p.evaluate(function (t0) {
                var top = document.getElementById('top'), latest = 0, inf = false;
                document.getAnimations().forEach(function (a) {
                    var tg = a.effect && a.effect.target; if (!tg || !top.contains(tg)) return;
                    var ct = a.effect.getComputedTiming(); if (ct.iterations === Infinity) inf = true;
                    var start = a.startTime === null ? document.timeline.currentTime : a.startTime;
                    latest = Math.max(latest, start + ct.endTime - t0);
                });
                return { latest: Math.round(latest), inf: inf, iter: getComputedStyle(document.querySelector('.term-block')).animationIterationCount, wc: getComputedStyle(document.querySelector('.holding-word .nm')).willChange };
            }, tRef);
            rec('T29 ' + HV + ': the hero settles ' + endT.latest + 'ms after ' + (HV === 'cold' ? 'the hand-off' : 'navigation') + ' (under 5s), 3 blinks, name layered', endT.latest < 5000 && !endT.inf && endT.iter === '3' && endT.wc === 'transform', endT);
            await c.close();
        }
        // and nothing has moved in the hero after 5s, sampled for real
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(500); await p.keyboard.press('Space'); await waitHandoff(p);
        await atAfter(p, 5000);
        var shotA = await p.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 600 } });
        await sleep(1500);
        var shotB = await p.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 600 } });
        rec('T29b the first screen is still from 5s to 6.5s after the hand-off', Buffer.compare(shotA, shotB) === 0, { bytesA: shotA.length, bytesB: shotB.length });
        await c.close();

        /* ── T30 a first visit at the top: what the first screen shows of the page prints after the commands ── */
        function headOp(p) { return p.evaluate(function () { var h = document.querySelector('#about .row'), cs = getComputedStyle(h); return { op: cs.opacity, top: Math.round(h.getBoundingClientRect().top), vh: innerHeight, bar: getComputedStyle(document.getElementById('bar')).opacity, answer: getComputedStyle(document.querySelector('.answer')).opacity }; }); }
        for (var TV of [[1440, 900], [1280, 800], [390, 844]]) {
            c = await ctxWith(browser, TV[0] === 390 ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : { viewport: { width: TV[0], height: TV[1] } });
            p = await c.newPage();
            var perr = []; p.on('pageerror', function (e) { perr.push(String(e)); });
            await p.goto(URL, { waitUntil: 'load' }); await sleep(500); await p.keyboard.press('Space'); await waitHandoff(p);
            await atAfter(p, 900); var h9 = await headOp(p);
            if (TV[0] === 1440) await p.screenshot({ path: path.join(OUT, 't30-cold-900ms-1440.png') });
            await atAfter(p, 1850); var h18 = await headOp(p);
            await atAfter(p, 2300); var h23 = await headOp(p);
            rec('T30 cold ' + TV.join('x') + ': the About head (on the first screen) waits, then prints after the commands', h9.top < h9.vh && h9.op === '0' && h18.bar === '1' && h23.op === '1' && perr.length === 0, { at900: h9, at1850: h18, at2300: h23, errors: perr });
            await c.close();
        }
        // a tall screen: the photo is on the first screen; it prints, then develops, in that order
        c = await ctxWith(browser, { viewport: { width: 2560, height: 1440 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(500); await p.keyboard.press('Space'); await waitHandoff(p);
        var shotSt = function () { return p.evaluate(function () { var s = document.querySelector('.shot'), r = s.getBoundingClientRect(); return { op: getComputedStyle(s).opacity, cls: s.className, inView: r.bottom <= innerHeight }; }); };
        await atAfter(p, 1200); var s12 = await shotSt();
        await atAfter(p, 2150); var s21 = await shotSt();
        await atAfter(p, 3600); var s36 = await shotSt();
        rec('T30b 2560x1440 cold: the photo waits unseen and undeveloped, prints as the Game Boy shot, then develops', s12.inView && s12.op === '0' && !/dev|done/.test(s12.cls) && s21.op === '1' && !/done/.test(s21.cls) && /done/.test(s36.cls), { at1200: s12, at2150: s21, at3600: s36 });
        await p.screenshot({ path: path.join(OUT, 't30-cold-2560-settled.png') });
        await c.close();
        // warm: nothing waits
        c = await ctxWith(browser, { viewport: { width: 1440, height: 900 } });
        await warm(c);
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(150);
        var hw = await headOp(p);
        rec('T30c warm: the About head is there at once', hw.op === '1' && hw.top < hw.vh, hw);
        await c.close();
        // a scroll inside the window ends the wait
        c = await ctxWith(browser, { viewport: { width: 1440, height: 900 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(500); await p.keyboard.press('Space'); await waitHandoff(p);
        await atAfter(p, 300); await p.mouse.move(720, 450); await p.mouse.wheel(0, 240);
        await atAfter(p, 800); var hs8 = await headOp(p);
        rec('T30d a scroll in the window prints at once', hs8.op === '1', hs8);
        await c.close();
        // and the keyboard: "> about" taken inside the window lands on a printed section
        c = await ctxWith(browser, { viewport: { width: 1440, height: 900 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(500); await p.keyboard.press('Space'); await waitHandoff(p);
        await atAfter(p, 300); await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('Enter');
        await sleep(900); var hk = await headOp(p);
        var yk = await p.evaluate(function () { return { y: Math.round(scrollY), hash: location.hash }; });
        rec('T30e "> about" from the keyboard inside the window: jumped, printed', hk.op === '1' && yk.hash === '#about' && yk.y > 300, { head: hk, nav: yk });
        await c.close();
    } finally {
        await browser.close();
        fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
        console.log('\n' + results.filter(function (r) { return r.ok; }).length + '/' + results.length + ' passed');
    }
})();
