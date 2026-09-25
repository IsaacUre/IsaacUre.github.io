/* Behavioural probe for the /test page. Usage: node probe.js <baseUrl> <outDir> */
var pw = require('/opt/node22/lib/node_modules/playwright');
var fs = require('fs'), path = require('path');
var BASE = process.argv[2], OUT = path.resolve(process.argv[3] || 'probe');
fs.mkdirSync(OUT, { recursive: true });
var FONTS = path.join(__dirname, 'fonts');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
var results = [];
function rec(name, ok, detail) { results.push({ name: name, ok: !!ok, detail: detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); }

async function ctxWith(browser, opts, fontMode) {
    var c = await browser.newContext(opts || {});
    await c.addInitScript(function () { document.addEventListener('DOMContentLoaded', function () { document.documentElement.style.scrollBehavior = 'auto'; }); });
    await c.route('https://fonts.googleapis.com/**', function (r) {
        if (fontMode === 'block') return r.abort();
        r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(FONTS, 'gf.css')) });
    });
    await c.route('https://fonts.gstatic.com/**', async function (r) {
        if (fontMode === 'block') return r.abort();
        var u = r.request().url();
        if (fontMode === 'late' && /vt323/.test(u)) await sleep(1500);
        var f = path.join(FONTS, u.replace('https://fonts.gstatic.com/', '').replace(/\//g, '_'));
        if (fs.existsSync(f)) r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } });
        else r.fulfill({ status: 404, body: '' });
    });
    await c.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, function (r) { if (/fonts\.(googleapis|gstatic)\.com/.test(r.request().url())) return r.fallback(); r.abort(); });
    return c;
}
function state(page) {
    return page.evaluate(function () {
        var term = document.getElementById('term'), a = document.querySelector('.answer'), bar = document.getElementById('bar');
        return {
            cls: document.documentElement.className,
            term: term ? getComputedStyle(term).display : 'gone',
            answer: a ? +getComputedStyle(a).opacity : null,
            bar: bar ? +getComputedStyle(bar).opacity : null,
            y: Math.round(scrollY),
            pend: document.querySelectorAll('.sec.pend').length,
            current: (document.querySelector('.bar [aria-current]') || {}).textContent || null,
            stuck: bar ? bar.classList.contains('stuck') : null
        };
    });
}

(async function () {
    var browser = await pw.chromium.launch();
    try {
        var URL = BASE;
        // T1: first visit boots; a key skips it without scrolling; the words follow within ~2s
        var c = await ctxWith(browser, { viewport: { width: 1440, height: 900 } });
        var p = await c.newPage();
        var errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
        await p.goto(URL, { waitUntil: 'domcontentloaded' });
        await sleep(500);
        var s = await state(p);
        rec('T1a first visit is booting, terminal up', /booting/.test(s.cls) && s.term === 'block', s);
        await p.keyboard.press('Space'); var tSkip = Date.now();
        await sleep(150); s = await state(p);
        rec('T1b Space skips, no scroll, terminal gone', !/booting/.test(s.cls) && s.term === 'gone' && s.y === 0, s);
        var seenAt = null;
        for (var i = 0; i < 40; i++) { s = await state(p); if (s.answer === 1 && s.bar === 1) { seenAt = Date.now() - tSkip; break; } await sleep(100); }
        rec('T1c answer + commands visible within 2.2s of the hand-off', seenAt !== null && seenAt < 2200, { ms: seenAt });
        // T2: same-session reload is warm: words at once
        await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(120); s = await state(p);
        rec('T2 same-session reload is warm, words at once', /warm/.test(s.cls) && s.answer === 1 && s.bar === 1 && (s.term === 'none' || s.term === 'gone'), s);
        await p.screenshot({ path: path.join(OUT, 't2-warm-120ms.png') });
        // T3: ?boot forces it
        await p.goto(URL + '?boot', { waitUntil: 'domcontentloaded' }); await sleep(300); s = await state(p);
        rec('T3 ?boot forces the boot in a warm session', /booting/.test(s.cls) && s.term === 'block', s);
        rec('T1d no page errors', errs.length === 0, errs);
        await c.close();

        // T4: deep link to #contact on a fresh visit: no boot, lands on contact, nothing held back above
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        p = await c.newPage();
        await p.goto(URL + '#contact', { waitUntil: 'load' }); await sleep(1500); s = await state(p);
        var contactTop = await p.evaluate(function () { return Math.round(document.getElementById('contact-h').getBoundingClientRect().top); });
        rec('T4 deep link: warm, scrolled, nothing pending, contact current', /warm/.test(s.cls) && s.y > 1000 && s.pend === 0 && /contact/.test(s.current || ''), { s: s, headTop: contactTop });
        var barBottom = await p.evaluate(function () { return Math.round(document.getElementById('bar').getBoundingClientRect().bottom); });
        rec('T4b the contact head lands below the pinned bar', contactTop >= barBottom, { headTop: contactTop, barBottom: barBottom });
        await p.screenshot({ path: path.join(OUT, 't4-deeplink.png') });
        await c.close();

        // T5: Tab during the boot lights the page and focuses something visible
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(400);
        await p.keyboard.press('Tab'); await sleep(200); s = await state(p);
        var fe = await p.evaluate(function () { var a = document.activeElement, r = a.getBoundingClientRect(); return a.tagName + ' ' + (a.textContent || '').trim().slice(0, 20) + ' ' + Math.round(r.top) + ',' + Math.round(r.left); });
        rec('T5 Tab during boot: lit, focus on a real control', !/booting/.test(s.cls) && /^A /.test(fe), { s: s, focus: fe });
        await c.close();

        // T6: sticky bar, current section, the develop, right edges at several widths
        for (var W of [1440, 700, 600, 430, 414, 412, 402, 390]) {
            c = await ctxWith(browser, { viewport: { width: W, height: 900 } });
            p = await c.newPage();
            await p.goto(URL + (W === 1440 ? '' : ''), { waitUntil: 'load' });
            await p.keyboard.press('x'); await sleep(2500);
            var edges = await p.evaluate(function () {
                function r(el) { return el ? Math.round(el.getBoundingClientRect().right * 10) / 10 : null; }
                var col = document.getElementById('main');
                var h2 = Array.prototype.map.call(document.querySelectorAll('h2.row'), function (h) { return r(h.querySelector('.res')); });
                var logRes = Array.prototype.map.call(document.querySelectorAll('.ent .row .res'), function (x) { return r(x); });
                var wide = getComputedStyle(document.querySelector('.ent .row .ld')).display !== 'none';
                return { col: r(col), colLeft: Math.round(col.getBoundingClientRect().left), heroLeft: Math.round(document.querySelector('.answer').getBoundingClientRect().left), h2: h2, log: logRes, logWide: wide, overflow: document.documentElement.scrollWidth > innerWidth };
            });
            var dots = await p.evaluate(function () {
                var bad = [];
                document.querySelectorAll('.ld').forEach(function (ld) {
                    if (getComputedStyle(ld).display === 'none' || !ld.getClientRects().length) return;
                    var cs = getComputedStyle(ld, '::before'), w = parseFloat(cs.width);
                    var probe = document.createElement('span'); probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit'; probe.textContent = '..........';
                    ld.appendChild(probe); var ch = probe.getBoundingClientRect().width / 10; probe.remove();
                    var n = w / ch; if (Math.abs(n - Math.round(n)) > 0.02) bad.push({ w: w, ch: ch, n: n });
                });
                return bad;
            });
            rec('T6g every leader is whole dots at ' + W, dots.length === 0, dots.slice(0, 4));
            var aligned = edges.h2.every(function (x) { return Math.abs(x - edges.col) < 0.6; }) && (!edges.logWide || edges.log.every(function (x) { return Math.abs(x - edges.col) < 0.6; }));
            rec('T6a right edges flush at ' + W, aligned && !edges.overflow, edges);
            if (W < 640) rec('T6b column keeps the hero left edge at ' + W, Math.abs(edges.colLeft - edges.heroLeft) < 1, edges);
            // scroll to about, check stuck + current + develop
            await p.evaluate(function () { document.getElementById('about').scrollIntoView(); });
            await sleep(2200); s = await state(p);
            var dev = await p.evaluate(function () { return document.querySelector('.shot').className; });
            rec('T6c at about: pinned, about current, photo developed (' + W + ')', s.stuck && /about/.test(s.current || '') && /done/.test(dev), { s: s, shot: dev });
            await p.screenshot({ path: path.join(OUT, 't6-about-' + W + '.png') });
            await p.evaluate(function () { document.getElementById('log').scrollIntoView(); }); await sleep(400); s = await state(p);
            rec('T6d at log: log current (' + W + ')', /log/.test(s.current || ''), s);
            await p.evaluate(function () { scrollTo(0, document.documentElement.scrollHeight); }); await sleep(400); s = await state(p);
            rec('T6e at the bottom: contact current (' + W + ')', /contact/.test(s.current || ''), s);
            await p.evaluate(function () { scrollTo(0, 0); }); await sleep(400); s = await state(p);
            rec('T6f back at top: not pinned, nothing current (' + W + ')', !s.stuck && !s.current, s);
            if (W === 390) await p.screenshot({ path: path.join(OUT, 't6-top-390.png') });
            await c.close();
        }

        // T7: late VT323 on a warm visit must not move the screen
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } }, 'late');
        await c.addInitScript(function () { try { sessionStorage.setItem('iu.booted', '1'); } catch (e) {} });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(150);
        var y1 = await p.evaluate(function () { return document.getElementById('frame').getBoundingClientRect().top; });
        await sleep(2600);
        var y2 = await p.evaluate(function () { return document.getElementById('frame').getBoundingClientRect().top; });
        rec('T7 late font does not move the screen', Math.abs(y1 - y2) < 0.5, { before: y1, after: y2 });
        await c.close();
        for (var MW of [390, 320]) {
            c = await ctxWith(browser, { viewport: { width: MW, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'late');
            await c.addInitScript(function () { try { sessionStorage.setItem('iu.booted', '1'); } catch (e) {} });
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(150);
            y1 = await p.evaluate(function () { return document.getElementById('frame').getBoundingClientRect().top; });
            await sleep(2600);
            y2 = await p.evaluate(function () { return document.getElementById('frame').getBoundingClientRect().top; });
            rec('T7 late font, phone ' + MW, Math.abs(y1 - y2) < 0.5, { before: y1, after: y2 });
            if (MW === 320) await p.screenshot({ path: path.join(OUT, 't7-hero-320.png') });
            await c.close();
        }

        // T8: fonts blocked entirely: no overflow at 320
        c = await ctxWith(browser, { viewport: { width: 320, height: 640 } }, 'block');
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await p.keyboard.press('x'); await sleep(2500);
        var ov = await p.evaluate(function () {
            var worst = null;
            document.querySelectorAll('body *').forEach(function (el) { var r = el.getBoundingClientRect(); if (r.width && r.right > innerWidth + .5 && getComputedStyle(el).position !== 'fixed') { if (!worst || r.right > worst.r) worst = { el: el.tagName + '.' + el.className, r: Math.round(r.right) }; } });
            return { sw: document.documentElement.scrollWidth, iw: innerWidth, worst: worst };
        });
        rec('T8 fonts blocked: no horizontal overflow at 320', ov.sw <= ov.iw, ov);
        await p.screenshot({ path: path.join(OUT, 't8-nofont-320.png'), fullPage: true });
        await c.close();

        // T9: keyboard focus never hides under the pinned bar
        c = await ctxWith(browser, { viewport: { width: 1280, height: 700 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await p.keyboard.press('x'); await sleep(2300);
        var hidden = [];
        for (var k = 0; k < 16; k++) {
            await p.keyboard.press('Tab'); await sleep(250);
            var f = await p.evaluate(function () {
                var a = document.activeElement, bar = document.getElementById('bar');
                if (!a || a === document.body) return null;
                var r = a.getBoundingClientRect(), b = bar.getBoundingClientRect();
                return { t: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 24), top: Math.round(r.top), bottom: Math.round(r.bottom), inBar: bar.contains(a), barBottom: Math.round(b.bottom), vh: innerHeight, stuck: b.top <= 0.5 };
            });
            if (f && !f.inBar && ((f.stuck && f.top < f.barBottom) || f.bottom > f.vh || f.bottom < 0)) hidden.push(f);
        }
        for (k = 0; k < 8; k++) {
            await p.keyboard.press('Shift+Tab'); await sleep(250);
            f = await p.evaluate(function () {
                var a = document.activeElement, bar = document.getElementById('bar');
                if (!a || a === document.body) return null;
                var r = a.getBoundingClientRect(), b = bar.getBoundingClientRect();
                return { t: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 24), top: Math.round(r.top), bottom: Math.round(r.bottom), inBar: bar.contains(a), barBottom: Math.round(b.bottom), vh: innerHeight, stuck: b.top <= 0.5 };
            });
            if (f && !f.inBar && ((f.stuck && f.top < f.barBottom) || f.bottom > f.vh || f.bottom < 0)) hidden.push(f);
        }
        rec('T9 no focused link hidden under the bar', hidden.length === 0, hidden);
        await c.close();

        // T10: print media: nothing held back, photo real, credits URL spelled out
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await p.keyboard.press('x'); await sleep(2300);
        await p.emulateMedia({ media: 'print' });
        var pr = await p.evaluate(function () {
            var real = document.querySelector('.shot-real'), gb = document.querySelector('.shot-gb'), a = document.querySelector('a[data-print-url]');
            var hiddenLines = Array.prototype.filter.call(document.querySelectorAll('.pl'), function (x) { return +getComputedStyle(x).opacity < 1; }).length;
            return { real: getComputedStyle(real).display, gb: getComputedStyle(gb).display, after: getComputedStyle(a, '::after').content, hiddenLines: hiddenLines, bar: getComputedStyle(document.getElementById('bar')).display };
        });
        rec('T10 print: all lines, real photo, URL spelled out, no bar', pr.real !== 'none' && pr.gb === 'none' && /ricethresher/.test(pr.after) && pr.hiddenLines === 0 && pr.bar === 'none', pr);
        await p.pdf({ path: path.join(OUT, 'print.pdf'), format: 'Letter', printBackground: true });
        await c.close();

        // T11: forced colours hero + about
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 }, forcedColors: 'active' });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await p.keyboard.press('x'); await sleep(2300);
        await p.screenshot({ path: path.join(OUT, 't11-forced.png') });
        await p.evaluate(function () { document.getElementById('log').scrollIntoView(); }); await sleep(600);
        await p.screenshot({ path: path.join(OUT, 't11-forced-log.png') });
        await c.close();

        // T12: the develop, mid-flight, for the eye
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        await c.addInitScript(function () { try { sessionStorage.setItem('iu.booted', '1'); } catch (e) {} });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(300);
        await p.evaluate(function () { scrollTo(0, document.querySelector('.shot').getBoundingClientRect().top + scrollY - 120); });
        await sleep(250); await p.screenshot({ path: path.join(OUT, 't12-gb.png') });
        await sleep(450); await p.screenshot({ path: path.join(OUT, 't12-mid.png') });
        await sleep(900); await p.screenshot({ path: path.join(OUT, 't12-done.png') });
        await c.close();
        // T13: after the power-on, only the holding page's loops keep going: the screen's eye
        // blinking twice every 8s and the cursors waiting. under reduced motion nothing loops
        var loops = function () { return document.getAnimations().filter(function (a) { var t = a.effect && a.effect.getComputedTiming(); return t && t.iterations === Infinity && a.playState === 'running'; }).map(function (a) { var g = a.effect.target, cl = g && (g.className.baseVal !== undefined ? g.className.baseVal : g.className); return (a.animationName || 'waapi') + '@' + cl + (g && g.closest && g.closest('.eye') ? '(eye)' : ''); }).sort(); };
        var OK_TOP = ['idleHalf@bf bf-half(eye)', 'idleShut@bf bf-shut(eye)', 'idleSlit@bf bf-slit(eye)', 'termBlink@term-block'];
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await p.keyboard.press('x'); await sleep(8000);
        var inf = await p.evaluate(loops);
        rec('T13 after 8s only the eye loop and the cursor run (first visit)', JSON.stringify(inf) === JSON.stringify(OK_TOP), inf);
        await p.evaluate(function () { scrollTo(0, document.documentElement.scrollHeight); }); await sleep(7000);
        inf = await p.evaluate(loops);
        rec('T13b at the foot, the waiting cursor joins them, nothing else', JSON.stringify(inf) === JSON.stringify(OK_TOP.concat(['termBlink@tc']).sort()), inf);
        await c.close();
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(2000);
        var infR = await p.evaluate(loops);
        await p.evaluate(function () { scrollTo(0, document.documentElement.scrollHeight); }); await sleep(1500);
        infR = infR.concat(await p.evaluate(loops));
        rec('T13c reduced motion: nothing loops, top or foot', infR.length === 0, infR);
        await c.close();

        // T14: cold deep link to #log at 390 with a late face and the page's own smooth scrolling
        for (var DW of [390, 1440]) {
            c = await browser.newContext(DW === 390 ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : { viewport: { width: 1440, height: 900 } });
            await c.route('https://fonts.googleapis.com/**', function (r) { r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(FONTS, 'gf.css')) }); });
            await c.route('https://fonts.gstatic.com/**', async function (r) { var u = r.request().url(); if (/vt323/.test(u)) await sleep(600); var f = path.join(FONTS, u.replace('https://fonts.gstatic.com/', '').replace(/\//g, '_')); r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } }); });
            p = await c.newPage();
            await p.goto(URL + '#log', { waitUntil: 'load' }); await sleep(2500);
            var land = await p.evaluate(function () { return { head: Math.round(document.getElementById('log-h').getBoundingClientRect().top), bar: Math.round(document.getElementById('bar').getBoundingClientRect().bottom) }; });
            rec('T14 cold #log deep link lands just under the bar (' + DW + ')', land.head >= land.bar && land.head <= land.bar + 40, land);
            await c.close();
        }

        // T15: the bar keeps to one row on short windows
        for (var SV of [[844, 390], [640, 400], [750, 342], [568, 320]]) {
            c = await ctxWith(browser, { viewport: { width: SV[0], height: SV[1] } });
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'load' }); await p.keyboard.press('x'); await sleep(2300);
            var bh = await p.evaluate(function () { return Math.round(document.getElementById('bar').getBoundingClientRect().height); });
            rec('T15 one-row bar at ' + SV.join('x'), bh <= 60, { barHeight: bh });
            await p.evaluate(function () { document.getElementById('log').scrollIntoView(); }); await sleep(300);
            await p.evaluate(function () { location.hash = '#contact'; }); await sleep(500);
            land = await p.evaluate(function () { return { head: Math.round(document.getElementById('contact-h').getBoundingClientRect().top), bar: Math.round(document.getElementById('bar').getBoundingClientRect().bottom) }; });
            rec('T15b a jump lands clear of the bar at ' + SV.join('x'), land.head >= land.bar, land);
            await c.close();
        }

        // T16: focus moving into the pinned bar doesn't move the page
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await p.keyboard.press('x'); await sleep(2300);
        await p.evaluate(function () { document.querySelector('a[href="https://riceracing.org"]').focus(); }); await sleep(300);
        var ys = [await p.evaluate(function () { return Math.round(scrollY); })];
        for (var q = 0; q < 4; q++) { await p.keyboard.press('Shift+Tab'); await sleep(300); ys.push(await p.evaluate(function () { return Math.round(scrollY); })); }
        var focusName = await p.evaluate(function () { return (document.activeElement.textContent || '').trim(); });
        rec('T16 Shift+Tab into the pinned bar keeps the page still', ys.slice(1).every(function (y) { return y === ys[1]; }) && /about/.test(focusName), { ys: ys, focus: focusName });
        await c.close();

        // T17: WCAG 1.4.12 text spacing clips nothing: the name, the readout keys
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await p.keyboard.press('x'); await sleep(2600);
        await p.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
        await sleep(300);
        var ts = await p.evaluate(function () {
            var nm = document.querySelector('.holding-word .nm'), scr = document.querySelector('.hero .screen').getBoundingClientRect(), r = nm.getBoundingClientRect();
            var clippedKeys = Array.prototype.filter.call(document.querySelectorAll('.ro dt'), function (dt) { return dt.scrollWidth > dt.clientWidth + 1; }).map(function (dt) { return dt.textContent; });
            return { nameInside: r.left >= scr.left - .5 && r.right <= scr.right + .5, nameClip: getComputedStyle(nm).clipPath, clippedKeys: clippedKeys };
        });
        rec('T17 text spacing: name whole and inside the screen, no clipped keys', ts.nameInside && ts.nameClip === 'none' && ts.clippedKeys.length === 0, ts);
        await c.close();

        // T18: whole pixels for the screen, the name and the column at even and odd widths
        for (var PW of [1439, 1440, 1441, 1280, 1366]) {
            c = await ctxWith(browser, { viewport: { width: PW, height: 900 } });
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'load' }); await p.keyboard.press('x'); await sleep(2300);
            var px = await p.evaluate(function () { function x(sel) { return document.querySelector(sel).getBoundingClientRect().left; } return { frame: x('#frame'), name: x('.holding-word .nm'), col: x('#main'), rr: x('.rr-h') }; });
            var whole = Object.keys(px).every(function (k) { return Math.abs(px[k] - Math.round(px[k])) < 0.01; });
            rec('T18 whole-pixel positions at ' + PW, whole, px);
            await c.close();
        }
    } finally {
        await browser.close();
        fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
        console.log('\n' + results.filter(function (r) { return r.ok; }).length + '/' + results.length + ' passed');
    }
})();
