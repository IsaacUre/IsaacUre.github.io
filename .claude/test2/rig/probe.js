/* Behavioural probe for /test2. Usage: node probe.js <baseUrl> <outDir>
   Real key, mouse and touch events, never the page's own functions. Fonts come from
   ../../test/rig/fonts; the browser gets no other network. */
var pw = require('/opt/node22/lib/node_modules/playwright');
var fs = require('fs'), path = require('path');
var BASE = process.argv[2], OUT = path.resolve(process.argv[3] || 'probe');
fs.mkdirSync(OUT, { recursive: true });
var FONTS = path.join(__dirname, '..', '..', 'test', 'rig', 'fonts');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
var results = [];
function rec(name, ok, detail) { results.push({ name: name, ok: !!ok, detail: detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')); }
function rgba(s) {                          // a computed colour as [r, g, b, a]
    var m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null;
    var v = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); if (v.length === 3) v.push(1);
    return v;
}
function colour(s, want) {                  // the same colour, give or take one in each channel and .01 in alpha
    var v = rgba(s); if (!v) return false; if (want.length === 3) want = want.concat([1]);
    return Math.abs(v[0] - want[0]) <= 1 && Math.abs(v[1] - want[1]) <= 1 && Math.abs(v[2] - want[2]) <= 1 && Math.abs(v[3] - want[3]) <= .01;
}
function clear(s) { var v = rgba(s); return s === 'transparent' || (!!v && v[3] === 0); }
function samePlace(a, b) { return !!a && !!b && ['l', 't', 'w', 'h'].every(function (k) { return Math.abs(a[k] - b[k]) <= .5; }); }

async function ctxWith(browser, opts, warm) {
    var c = await browser.newContext(opts || {});
    await c.addInitScript(function () {
        window.__plays = {};
        var orig = Element.prototype.animate;
        Element.prototype.animate = function () {
            var ico = this.closest && this.closest('.ico[data-pic]');
            if (ico) { var k = ico.getAttribute('data-pic'); window.__plays[k] = (window.__plays[k] || 0) + 1; }
            return orig.apply(this, arguments);
        };
    });
    await c.addInitScript(function () { document.addEventListener('DOMContentLoaded', function () { document.documentElement.style.scrollBehavior = 'auto'; }); });
    if (warm) await c.addInitScript(function () { try { sessionStorage.setItem('iu2.booted', '1'); } catch (e) {} });
    await c.route('https://fonts.googleapis.com/**', function (r) { r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(FONTS, 'gf.css')) }); });
    await c.route('https://fonts.gstatic.com/**', function (r) {
        var f = path.join(FONTS, r.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_'));
        if (fs.existsSync(f)) r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } });
        else r.fulfill({ status: 404, body: '' });
    });
    await c.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, function (r) { if (/fonts\.(googleapis|gstatic)\.com/.test(r.request().url())) return r.fallback(); r.abort(); });
    return c;
}
function state(page) {
    return page.evaluate(function () {
        var term = document.getElementById('term'), tb = document.getElementById('tb'), wins = document.querySelectorAll('.win');
        var up = 0, pend = 0, hidden = 0;
        wins.forEach(function (w) { if (w.hidden) hidden++; else if (w.classList.contains('pend')) pend++; else if (w.classList.contains('up')) up++; });
        return {
            cls: document.documentElement.className,
            term: term ? getComputedStyle(term).display : 'gone',
            tb: tb ? +getComputedStyle(tb).opacity : null,
            y: Math.round(scrollY), up: up, pend: pend, hidden: hidden, n: wins.length,
            current: (document.querySelector('.tb [aria-current]') || {}).textContent || null,
            top: (document.querySelector('.win.top') || {}).id || null
        };
    });
}
async function walk(page) {
    var h = await page.evaluate(function () { return document.documentElement.scrollHeight; });
    var vh = await page.evaluate(function () { return innerHeight; });
    for (var y = 0; y <= h; y += Math.round(vh * 0.6)) { await page.evaluate(function (y) { scrollTo(0, y); }, y); await sleep(260); }
    await sleep(600);
}
function rect(page, sel) { return page.evaluate(function (sel) { var r = document.querySelector(sel).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel); }
function place(page, sel) { return page.evaluate(function (sel) { var r = document.querySelector(sel).getBoundingClientRect(); return { l: r.left + scrollX, t: r.top + scrollY, w: r.width, h: r.height }; }, sel); }   // on the page, not the screen
function places(page) { return page.evaluate(function () { var o = {}; document.querySelectorAll('.win').forEach(function (w) { if (w.hidden) return; var r = w.getBoundingClientRect(); o[w.id] = { l: r.left + scrollX, t: r.top + scrollY, w: r.width, h: r.height }; }); return o; }); }
async function grab(page, sel) {            // where a hand takes hold: the middle; on a title bar, the middle of the part left of the caption buttons
    var r = await page.evaluate(function (sel) {
        var el = document.querySelector(sel), q = el.getBoundingClientRect(), wc = el.querySelector('.wc'), right = q.right;
        if (wc && wc.offsetWidth) right = wc.getBoundingClientRect().left;
        return { l: q.left, t: q.top, w: q.width, h: q.height, right: right };
    }, sel);
    return { x: (r.l + r.right) / 2, y: r.t + r.h / 2, l: r.l, t: r.t, w: r.w, h: r.h };
}
async function barsFit(page) {              // every title bar: Close at the window's right edge, each caption button 46 wide and the bar's height, the bar 2.5rem, the title left of Minimize on one line; and the log's table no wider than its window
    return page.evaluate(function () {
        var bad = [], rem = parseFloat(getComputedStyle(document.documentElement).fontSize), lw = document.querySelector('#log .wd');
        document.querySelectorAll('.win').forEach(function (w) {
            if (w.hidden || w.classList.contains('mini')) return;
            var cs = getComputedStyle(w), r = w.getBoundingClientRect(), inner = r.right - parseFloat(cs.borderRightWidth);
            var wb = w.querySelector('.wb').getBoundingClientRect(), wc = w.querySelector('.wc').getBoundingClientRect();
            var mn = w.querySelector('.wbtn.mn'), x = w.querySelector('.wbtn.x'), wt = w.querySelector('.wt'), tr = wt.getBoundingClientRect(), lh = parseFloat(getComputedStyle(wt).lineHeight);
            if (!mn || !x) { bad.push(w.id + ' a caption button is missing'); return; }
            var mr = mn.getBoundingClientRect(), xr = x.getBoundingClientRect();
            if (wc.left < r.left - .5 || wc.right > r.right + .5) bad.push(w.id + ' buttons out ' + Math.round(wc.right - r.right));
            if (Math.abs(xr.right - inner) > .5) bad.push(w.id + ' close ' + (inner - xr.right).toFixed(1) + 'px from the edge');
            w.querySelectorAll('.wbtn').forEach(function (b) { var q = b.getBoundingClientRect(); if (Math.abs(q.width - 46) > .5 || Math.abs(q.height - wb.height) > .5) bad.push(w.id + ' ' + b.getAttribute('aria-label') + ' ' + q.width.toFixed(1) + 'x' + q.height.toFixed(1)); });
            if (Math.abs(wb.height - 2.5 * rem) > .5) bad.push(w.id + ' bar ' + wb.height.toFixed(1) + 'px');
            if (tr.right > mr.left + .5) bad.push(w.id + ' title under the buttons');
            if (tr.height > lh + .5) bad.push(w.id + ' title on two lines');
            if (r.left < -0.5 || r.right > innerWidth + .5) bad.push(w.id + ' off the page ' + Math.round(r.left) + '..' + Math.round(r.right));
        });
        if (lw && !document.getElementById('log').hidden && lw.scrollWidth > lw.clientWidth) bad.push('log table ' + lw.scrollWidth + ' in ' + lw.clientWidth);
        return bad;
    });
}
function pills(page) {                      // each taskbar button: current or not, and its pill (none, or its width and colour)
    return page.evaluate(function () {
        return [].map.call(document.querySelectorAll('.tb-a'), function (a) {
            var s = getComputedStyle(a, '::after');
            return { sec: a.getAttribute('data-sec'), cur: a.getAttribute('aria-current'), shown: s.display !== 'none' && s.content !== 'none', w: parseFloat(s.width), bg: s.backgroundColor };
        });
    });
}
function pillsAre(list, cur, idle) {        // red and 16px for the current part, grey and 6px for the rest, none for a part whose windows are all closed
    return list.length === 4 && list.every(function (x) {
        if (x.sec === idle) return !x.shown;
        if (x.sec === cur) return x.cur === 'true' && x.shown && Math.abs(x.w - 16) <= .5 && colour(x.bg, [216, 30, 5]);
        return !x.cur && x.shown && Math.abs(x.w - 6) <= .5 && colour(x.bg, [111, 109, 98]);
    });
}
function moving(page) {                     // whatever is animating or transitioning, by what and on what
    return page.evaluate(function () { return document.getAnimations().map(function (a) { var t = a.effect && a.effect.target; return (t ? (t.id || (t.getAttribute && t.getAttribute('class')) || t.tagName) : '?') + ':' + (a.animationName || a.transitionProperty || a.id || 'script'); }); });
}
function capLook(page, sel) {               // a caption button after a tap: its fill, its colour, and the glyph that shows
    return page.evaluate(function (sel) {
        var b = document.querySelector(sel), w = b.closest('.win'), gs = [].filter.call(b.querySelectorAll('svg'), function (g) { return getComputedStyle(g).display !== 'none'; });
        return { maxi: w.classList.contains('maxi'), bg: getComputedStyle(b).backgroundColor, colour: getComputedStyle(b).color, glyphs: gs.length, glyph: gs[0] ? +getComputedStyle(gs[0]).opacity : 0, vis: gs[0] ? getComputedStyle(gs[0]).visibility : 'none', hover: matchMedia('(hover: hover)').matches };
    }, sel);
}

(async function () {
    var browser = await pw.chromium.launch();
    try {
        var URL = BASE, c, p, s, errs, i;

        /* ---- T1: a first visit boots; a key skips it; the windows cascade ---- */
        c = await ctxWith(browser, { viewport: { width: 1440, height: 900 } });
        p = await c.newPage(); errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
        await p.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(500);
        s = await state(p);
        rec('T1a first visit is booting, terminal up, taskbar hidden', /booting/.test(s.cls) && s.term === 'block' && s.up === 0, s);
        var winsHidden = await p.evaluate(function () { return +getComputedStyle(document.getElementById('terminal')).opacity; });
        rec('T1b the windows wait unseen while the boot plays', winsHidden === 0, winsHidden);
        await p.keyboard.press('Space'); var t0 = Date.now(); await sleep(60); s = await state(p);
        rec('T1c Space skips: terminal gone, no scroll, nothing booting', !/booting/.test(s.cls) && s.term === 'gone' && s.y === 0 && !/\bcas\b/.test(s.cls), s);
        var order = [], last = -1;
        for (i = 0; i < 30; i++) {
            var ups = await p.evaluate(function () { return [].map.call(document.querySelectorAll('.win.up'), function (w) { return w.id; }); });
            if (ups.length > last) { order.push([Date.now() - t0, ups.slice()]); last = ups.length; }
            if (ups.length >= 6) break;
            await sleep(50);
        }
        s = await state(p);
        rec('T1d the windows in view pop one after another, six of them inside 1.2s', last >= 6 && order[order.length - 1][0] < 1200 && order.length >= 5, { steps: order.map(function (o) { return o[0] + ':' + o[1].length; }) });
        rec('T1e the first to pop is the login shell, the second fastfetch', order.length > 1 && order[0][1][0] === 'terminal' && order[1][1][1] === 'about', order.slice(0, 2));
        rec('T1f the rest wait below the fold (pend), none hidden', s.up >= 6 && s.pend === s.n - s.up && s.hidden === 0, s);
        rec('T1g the taskbar is up', s.tb === 1, s.tb);
        await sleep(1400);
        var tw = await p.evaluate(function () {
            var cmd = document.querySelector('#terminal .cmd'), ans = document.querySelector('#terminal .answer'), wait = document.querySelector('#terminal .wait'), first = document.querySelector('#terminal .wd').firstElementChild;
            return { cmd: Math.round(cmd.getBoundingClientRect().width), ans: +getComputedStyle(ans).opacity, wait: +getComputedStyle(wait).opacity, banner: Math.round(document.querySelector('.banner').getBoundingClientRect().width), first: first ? first.textContent.trim() : null, profiles: /Loading personal/.test(document.body.textContent) };
        });
        rec('T1h the login shell typed whoami, printed the answer, and the prompt is back; the banner is up at full size; its first line is PowerShell 7.6.7, with no profile loading line', tw.cmd === 48 && tw.ans === 1 && tw.wait === 1 && tw.banner >= 410 && tw.first === 'PowerShell 7.6.7' && !tw.profiles, tw);
        var dev = await p.evaluate(function () { var sh = document.querySelector('.shot'); return sh.className; });
        rec('T1i the photo developed', /done/.test(dev), dev);
        await sleep(1200);
        var pics = await p.evaluate(function () { return window.__plays; });
        rec('T1j the pictures in view have played (photography at least), the one below the fold has not', pics.cam >= 1 && !pics.gti, pics);
        var camPlays = pics.cam, cr0 = await rect(p, '#cam .ico');
        await p.mouse.move(cr0.l + 20, cr0.t + 20); await sleep(500);
        pics = await p.evaluate(function () { return window.__plays; });
        rec('T1l resting the pointer on a picture plays it again', pics.cam > camPlays, { before: camPlays, after: pics.cam });
        await p.mouse.move(5, 5); await sleep(100);
        await p.screenshot({ path: path.join(OUT, 't1-after-cascade.png') });
        // T2: scrolling pops the rest; after a walk nothing is pending
        await walk(p); s = await state(p);
        rec('T2a after a walk every window is up, none pending', s.pend === 0 && s.up === s.n, s);
        rec('T2b at the bottom the taskbar marks contact', s.current && /contact/.test(s.current), s.current);
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(300); s = await state(p);
        rec('T2c at the top it marks home', s.current && /home/.test(s.current), s.current);
        await p.evaluate(function () { document.getElementById('log').scrollIntoView(); scrollBy(0, -200); }); await sleep(300); s = await state(p);
        rec('T2d with the log in the upper part it marks log', s.current && /log/.test(s.current), s.current);
        // T3: a reload in the same session is warm, and still cascades
        await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(100); s = await state(p);
        rec('T3a same-session reload is warm, no terminal', /warm/.test(s.cls) && (s.term === 'none' || s.term === 'gone'), s);
        await sleep(1500); s = await state(p);
        rec('T3b and the windows in view have cascaded, nothing left in .cas', s.up >= 4 && s.pend === s.n - s.up && !/\bcas\b/.test(s.cls), s);
        await p.goto(URL + '?boot', { waitUntil: 'domcontentloaded' }); await sleep(300); s = await state(p);
        rec('T3c ?boot forces the boot in a warm session', /booting/.test(s.cls) && s.term === 'block', s);
        rec('T1k no page errors so far', errs.length === 0, errs);
        await c.close();

        /* ---- T4: a deep link lands on the window, warm ---- */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } });
        p = await c.newPage();
        await p.goto(URL + '#contact', { waitUntil: 'load' }); await sleep(1500); s = await state(p);
        var cr = await rect(p, '#contact'), tbr = await rect(p, '#tb');
        rec('T4a deep link: warm, scrolled, contact up, in view above the taskbar, and current', /warm/.test(s.cls) && s.y > 500 && cr.t >= 0 && cr.b <= tbr.t + 1 && /contact/.test(s.current || ''), { s: s, cr: cr, tbTop: tbr.t });
        var upContact = await p.evaluate(function () { return document.getElementById('contact').className; });
        rec('T4b the contact window popped (up), not pending', /\bup\b/.test(upContact) && !/pend/.test(upContact), upContact);
        await c.close();

        /* ---- T5: reduced motion: no boot, no pops, nothing moving ---- */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
        p = await c.newPage(); errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
        await p.goto(URL, { waitUntil: 'load' }); await sleep(600); s = await state(p);
        rec('T5a reduced motion: warm, no terminal, every window up at once', /warm/.test(s.cls) && s.term !== 'block' && s.up === s.n && s.pend === 0, s);
        var anims = await p.evaluate(function () { return document.getAnimations().map(function (a) { return (a.effect && a.effect.target ? (a.effect.target.className && a.effect.target.className.baseVal !== undefined ? a.effect.target.className.baseVal : a.effect.target.className) : '?') + ':' + (a.animationName || a.id || ''); }); });
        rec('T5b nothing animates under reduced motion', anims.length === 0, anims.slice(0, 8));
        var gb = await p.evaluate(function () { return getComputedStyle(document.querySelector('.shot-gb')).display; });
        rec('T5c the Game Boy layer is off', gb === 'none', gb);
        var vis = await p.evaluate(function () { return [].every.call(document.querySelectorAll('.win'), function (w) { return +getComputedStyle(w).opacity === 1; }); });
        rec('T5d every window is fully visible', vis, vis);
        rec('T5e no page errors', errs.length === 0, errs);
        await c.close();

        /* ---- T6: no script: the page is simply there ---- */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(800);
        var nojs = await p.evaluate(function () {
            var wins = document.querySelectorAll('.win'), shown = 0, ps = document.querySelector('#terminal .ln.pwsh');
            wins.forEach(function (w) { if (+getComputedStyle(w).opacity === 1 && getComputedStyle(w).display !== 'none') shown++; });
            return { cls: document.documentElement.className, shown: shown, n: wins.length, btn: getComputedStyle(document.querySelector('.wc')).display, eye: getComputedStyle(document.getElementById('tbEye')).display, gb: getComputedStyle(document.querySelector('.shot-gb')).display, term: getComputedStyle(document.getElementById('term')).display, cmdW: Math.round(document.querySelector('#terminal .cmd').getBoundingClientRect().width), tb: getComputedStyle(document.getElementById('tb')).opacity,
                tops: document.querySelectorAll('.win.top').length, pwsh: ps ? ps.textContent.trim() : null, pwshShown: !!ps && getComputedStyle(ps).display !== 'none' && getComputedStyle(ps).visibility === 'visible' };
        });
        rec('T6 no JS: every window shown, none in front, no window buttons, no eye button, no Game Boy layer, no terminal, whoami typed, PowerShell 7.6.7 printed, taskbar shown', nojs.cls === 'no-js' && nojs.shown === nojs.n && nojs.btn === 'none' && nojs.eye === 'none' && nojs.gb === 'none' && nojs.term === 'none' && nojs.cmdW === 48 && nojs.tb === '1' && nojs.tops === 0 && nojs.pwsh === 'PowerShell 7.6.7' && nojs.pwshShown, nojs);
        await c.close();

        /* ---- T7: the windows as windows: raise, drag, minimize, maximize, close, the menu ---- */
        c = await ctxWith(browser, { viewport: { width: 1440, height: 900 } }, true);
        p = await c.newPage(); errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
        await p.goto(URL, { waitUntil: 'load' }); await sleep(1800);
        // raise: a click on the photo's body
        var sr = await rect(p, '#shot .wd');
        await p.mouse.click(sr.l + 20, sr.t + 20); await sleep(100);
        var z = await p.evaluate(function () { var w = document.getElementById('shot'); return { top: w.classList.contains('top'), z: +w.style.zIndex, tops: document.querySelectorAll('.win.top').length, maxZ: Math.max.apply(null, [].map.call(document.querySelectorAll('.win'), function (x) { return +x.style.zIndex || 0; })) }; });
        rec('T7a a click brings a window to the front: .top on it alone, highest z-index', z.top && z.tops === 1 && z.z === z.maxZ, z);
        // the front window: the red frame, the darker row, white glyphs; at the back: the faint frame, the lighter row, grey glyphs
        await sleep(200);                          // the glyphs' colour change is over
        var bar = await p.evaluate(function () {
            function look(id) { var w = document.getElementById(id); return { row: getComputedStyle(w.querySelector('.wb')).backgroundColor, frame: getComputedStyle(w).borderTopColor, glyphs: [].map.call(w.querySelectorAll('.wbtn'), function (b) { return getComputedStyle(b).color; }) }; }
            return { front: look('shot'), back: look('readme') };
        });
        rec('T7b the front window has the red frame, the darker row and white glyphs; a window at the back has the faint frame, the lighter row and grey glyphs',
            colour(bar.front.row, [46, 46, 46]) && colour(bar.front.frame, [216, 30, 5]) && bar.front.glyphs.length === 3 && bar.front.glyphs.every(function (g) { return colour(g, [255, 255, 255]); }) &&
            colour(bar.back.row, [51, 51, 51]) && colour(bar.back.frame, [255, 255, 255, .1]) && bar.back.glyphs.length === 3 && bar.back.glyphs.every(function (g) { return colour(g, [255, 255, 255, .365]); }), bar);
        // drag by the title bar
        var br = await grab(p, '#terminal .wb'), before = await rect(p, '#terminal');
        await p.mouse.move(br.x, br.y); await p.mouse.down(); await p.mouse.move(br.x + 50, br.y + 30, { steps: 6 }); await p.mouse.move(br.x + 100, br.y + 60, { steps: 6 });
        var mid = await p.evaluate(function () { return document.getElementById('terminal').className; });
        await p.mouse.up(); await sleep(80);
        var after = await rect(p, '#terminal'), cls = await p.evaluate(function () { return document.getElementById('terminal').className; });
        rec('T7c a mouse drags a window by its title bar, exactly as far as it moved', Math.round(after.l - before.l) === 100 && Math.round(after.t - before.t) === 60 && /drag/.test(mid) && !/drag/.test(cls), { dx: after.l - before.l, dy: after.t - before.t, mid: mid, cls: cls });
        var inl = await p.evaluate(function () { var w = document.getElementById('terminal'); return { nx: w.style.getPropertyValue('--nx'), ny: w.style.getPropertyValue('--ny'), top: w.classList.contains('top') }; });
        rec('T7d the drag is whole pixels in the nudge properties, and the window came to the front', /^-?\d+px$/.test(inl.nx) && /^-?\d+px$/.test(inl.ny) && inl.top, inl);
        var sel = await p.evaluate(function () { return String(getSelection()); });
        rec('T7e dragging selected no text', sel === '', sel);
        // a drag cannot leave the desk
        br = await grab(p, '#else .wb');
        await p.mouse.move(br.x, br.y); await p.mouse.down(); await p.mouse.move(br.x + 900, br.y, { steps: 8 }); await p.mouse.up(); await sleep(80);
        var er = await rect(p, '#else'), dr = await rect(p, '#desk');
        rec('T7f a drag stops at the desk\'s edge', Math.round(er.r) <= Math.round(dr.r) + 1 && er.r > dr.r - 2, { winRight: er.r, deskRight: dr.r });
        // the buttons don't drag
        var xb = await rect(p, '#else .wbtn.x'); before = await rect(p, '#else');
        await p.mouse.move(xb.l + 12, xb.t + 12); await p.mouse.down(); await p.mouse.move(xb.l + 80, xb.t + 60, { steps: 4 }); await p.mouse.up(); await sleep(80);
        after = await rect(p, '#else'); var elseHidden = await p.evaluate(function () { return document.getElementById('else').hidden; });
        rec('T7g a drag that starts on a button moves nothing (and a moved pointer does not click it)', Math.round(after.l) === Math.round(before.l) && Math.round(after.t) === Math.round(before.t) && !elseHidden, { dl: after.l - before.l, hidden: elseHidden });
        // minimize: the login shell goes to the taskbar, its cell stays empty, nothing else moves
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(200);
        var home0 = await place(p, '#terminal'), all0 = await places(p);
        var ans0 = await p.evaluate(function () { var r = document.querySelector('#terminal .answer').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
        await p.click('#terminal .wbtn.mn'); await sleep(450);
        var all1 = await places(p);
        var mi = await p.evaluate(function (pt) {
            var w = document.getElementById('terminal'), b = w.querySelector('.wbtn.mn'), hit = document.elementFromPoint(pt.x, pt.y);
            var seen = [w].concat([].slice.call(w.querySelectorAll('*'))).filter(function (e) { return getComputedStyle(e).visibility === 'visible'; }).length;
            return { mini: w.classList.contains('mini'), pressed: b.hasAttribute('aria-pressed'), seen: seen, hitInside: !!(hit && w.contains(hit)), hit: hit && (hit.id || hit.getAttribute('class') || hit.tagName) };
        }, ans0);
        var moved = Object.keys(all0).filter(function (id) { return id !== 'terminal' && !samePlace(all0[id], all1[id]); });
        rec('T7h Minimize sends the login shell to the taskbar: nothing of it shows, nothing where its answer was is part of it, and no other window moves', mi.mini && !mi.pressed && mi.seen === 0 && !mi.hitInside && moved.length === 0, { mi: mi, moved: moved });
        await p.click('#tbEye'); await sleep(120);
        var row = await p.evaluate(function () { var b = document.querySelector('#menu button[data-w="terminal"]'), st = b && b.querySelector('.st'), vh = b && b.querySelector('.vh'); return b ? { st: st ? st.textContent.trim() : null, vh: vh ? vh.textContent : null } : null; });
        await p.click('#menu button[data-w="terminal"]'); await sleep(700);
        var home1 = await place(p, '#terminal'), back = await p.evaluate(function () { var w = document.getElementById('terminal'); return { mini: w.classList.contains('mini'), vis: getComputedStyle(w.querySelector('.wd')).visibility }; });
        rec('T7i the window list reads it as minimized, and picking it there brings it back in its place', !!row && row.st === 'Minimized' && row.vh === ', minimized' && !back.mini && back.vis === 'visible' && samePlace(home0, home1), { row: row, back: back, before: home0, after: home1 });
        // maximize
        await p.click('#about .wbtn.mx'); await sleep(120);
        var mx = await p.evaluate(function () {
            var w = document.getElementById('about'), r = w.getBoundingClientRect(), tb = document.getElementById('tb').getBoundingClientRect(), b = w.querySelector('.wbtn.mx'), gr = b.querySelector('.g-res'), gm = b.querySelector('.g-max');
            return { maxi: w.classList.contains('maxi'), pos: getComputedStyle(w).position, l: r.left, t: r.top, rr: r.right, b: Math.round(r.bottom), tbTop: Math.round(tb.top), lock: /\block\b/.test(document.documentElement.className), inertOthers: [].every.call(document.querySelectorAll('.win'), function (x) { return x === w ? !x.inert : x.inert; }), pressed: b.getAttribute('aria-pressed'), focus: document.activeElement.className,
                bar: w.querySelector('.wb').getBoundingClientRect().height, rem: parseFloat(getComputedStyle(document.documentElement).fontSize), res: gr ? getComputedStyle(gr).display : 'missing', max: gm ? getComputedStyle(gm).display : 'missing', name: b.getAttribute('aria-label') };
        });
        rec('T7j maximize fills the screen above the taskbar, locks the page and makes the rest inert; the bar is 2rem, the restore glyph shows and the name stays', mx.maxi && mx.pos === 'fixed' && mx.l === 0 && mx.t === 0 && mx.rr === 1440 && mx.b === mx.tbTop && mx.lock && mx.inertOthers && mx.pressed === 'true' && Math.abs(mx.bar - 2 * mx.rem) <= .5 && mx.res !== 'none' && mx.res !== 'missing' && mx.max === 'none' && mx.name === 'Maximize fastfetch', mx);
        var sideways = await p.evaluate(function () { return document.documentElement.scrollWidth > innerWidth; });
        rec('T7j2 and nothing goes sideways while it fills the screen', !sideways, sideways);
        // a window that pops while another fills the screen stays behind it
        await p.evaluate(function () { var w = document.getElementById('jcs'); w.querySelector('.wbtn.mn').focus(); });   // focus pops a pending window (inert should stop it; belt and braces)
        await p.evaluate(function () { scrollTo(0, document.documentElement.scrollHeight); }); await sleep(900);
        var zz = await p.evaluate(function () { var m = document.getElementById('about'), top = document.querySelector('.win.top'); return { maxZ: +m.style.zIndex, others: Math.max.apply(null, [].map.call(document.querySelectorAll('.win:not(.maxi)'), function (x) { return +x.style.zIndex || 0; })), top: top && top.id, stillMaxi: m.classList.contains('maxi') }; });
        rec('T7j3 windows that pop meanwhile stay beneath the one filling the screen, which stays in front', zz.stillMaxi && zz.maxZ > zz.others && zz.top === 'about', zz);
        await p.keyboard.press('Escape'); await sleep(100);
        mx = await p.evaluate(function () { var w = document.getElementById('about'); return { maxi: w.classList.contains('maxi'), lock: /\block\b/.test(document.documentElement.className), inert: [].some.call(document.querySelectorAll('.win'), function (x) { return x.inert; }), focus: document.activeElement === w.querySelector('.wbtn.mx') }; });
        rec('T7k Escape restores it, unlocks, un-inerts, and focus is back on the button', !mx.maxi && !mx.lock && !mx.inert && mx.focus, mx);
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(200);
        br = await grab(p, '#cam .wb');
        await p.mouse.dblclick(br.x, br.y); await sleep(120);
        var dbl = await p.evaluate(function () { return document.getElementById('cam').classList.contains('maxi'); });
        rec('T7l a double click on a title bar maximizes', dbl, dbl);
        br = await grab(p, '#cam .wb');          // the bar is at the top of the screen now
        await p.mouse.dblclick(br.x, br.y); await sleep(120);
        dbl = await p.evaluate(function () { return document.getElementById('cam').classList.contains('maxi'); });
        rec('T7m and again, on the bar where it is now, restores', !dbl, dbl);
        // close, then the menu brings it back
        await p.click('#d20 .wbtn.x'); await sleep(400);
        var cl = await p.evaluate(function () { var w = document.getElementById('d20'); return { hidden: w.hidden, display: getComputedStyle(w).display, top: w.classList.contains('top') }; });
        rec('T7n close takes a window away', cl.hidden && cl.display === 'none' && !cl.top, cl);
        await p.click('#tbEye'); await sleep(120);
        var mn = await p.evaluate(function () {
            var m = document.getElementById('menu'), b = document.getElementById('tbEye'), bs = m.querySelectorAll('button'), d = m.querySelector('button[data-w="d20"]'), st = d && d.querySelector('.st'), vh = d && d.querySelector('.vh');
            return { open: !m.hidden, expanded: b.getAttribute('aria-expanded'), n: bs.length, wins: m.querySelectorAll('button[data-w]').length, d20: d ? { st: st ? st.textContent.trim() : null, vh: vh ? vh.textContent : null } : null, first: document.activeElement === m.querySelector('button'), hasTop: !!m.querySelector('[data-act="top"]') || [].some.call(bs, function (x) { return /^\W*top$/i.test(x.textContent.trim()); }), hasReset: !!m.querySelector('button[data-act="reset"]') };
        });
        rec('T7o the eye opens the window list: 17 windows and Reset the desk, no top, focus on the first, d&d shown closed', mn.open && mn.expanded === 'true' && mn.n === 18 && mn.wins === 17 && !!mn.d20 && mn.d20.st === 'Closed' && mn.d20.vh === ', closed' && mn.first && !mn.hasTop && mn.hasReset, mn);
        await p.keyboard.press('Escape'); await sleep(80);
        mn = await p.evaluate(function () { return { open: !document.getElementById('menu').hidden, focus: document.activeElement.id }; });
        rec('T7p Escape closes it and focus returns to the eye', !mn.open && mn.focus === 'tbEye', mn);
        await p.click('#tbEye'); await sleep(100);
        await p.click('#menu button[data-w="d20"]'); await sleep(500);
        cl = await p.evaluate(function () { var w = document.getElementById('d20'), r = w.getBoundingClientRect(); return { hidden: w.hidden, up: w.classList.contains('up'), top: w.classList.contains('top'), inView: r.top >= 0 && r.bottom <= innerHeight, menu: !document.getElementById('menu').hidden, focus: document.activeElement.className }; });
        rec('T7q picking it in the list brings it back, popped, in view, in front, focus on its first button', !cl.hidden && cl.up && cl.top && cl.inView && !cl.menu && /wbtn/.test(cl.focus), cl);
        // a click outside closes the menu
        await p.click('#tbEye'); await sleep(100); await p.mouse.click(700, 450); await sleep(100);
        mn = await p.evaluate(function () { return !document.getElementById('menu').hidden; });
        rec('T7r a click elsewhere closes the list', !mn, mn);
        // reset the desk: the dragged readme goes home, a closed window comes back
        await p.click('#gti .wbtn.x'); await sleep(400);
        await p.click('#tbEye'); await sleep(100); await p.click('#menu button[data-act="reset"]'); await sleep(1600);
        var rs = await p.evaluate(function () { var w = document.getElementById('readme'); return { nx: w.style.getPropertyValue('--nx'), gti: document.getElementById('gti').hidden, pend: document.querySelectorAll('.win.pend').length, menu: !document.getElementById('menu').hidden }; });
        rec('T7s reset the desk: the drag is undone, the closed window is back, nothing pending', rs.nx === '' && !rs.gti && rs.pend === 0 && !rs.menu, rs);
        // the taskbar's buttons jump, and reopen a closed window
        await p.click('#contact .wbtn.x'); await sleep(400);
        await p.click('.tb-a[data-sec="contact"]'); await sleep(600);
        cr = await rect(p, '#contact'); tbr = await rect(p, '#tb');
        var cc = await p.evaluate(function () { var w = document.getElementById('contact'); return { hidden: w.hidden, up: w.classList.contains('up') }; });
        rec('T7t the contact button in the taskbar reopens the closed contact window and scrolls to it', !cc.hidden && cc.up && cr.t >= 0 && cr.b <= tbr.t + 1, { cc: cc, cr: cr, tbTop: tbr.t });
        await p.click('.tb-a[data-sec="log"]'); await sleep(600);
        var lr = await rect(p, '#log');
        rec('T7u the log button scrolls to the log', lr.t >= 0 && lr.t < 300, lr);
        rec('T7v no page errors in the window tests', errs.length === 0, errs);
        await p.screenshot({ path: path.join(OUT, 't7-end.png') });
        // the clock: the time over the date; the date goes under 30em, the clock under 22.5em
        var clk = await p.evaluate(function () { var k = document.getElementById('clk'), t = k.querySelector('.t'), d = k.querySelector('.d'); return { t: t ? t.textContent : null, d: d ? d.textContent : null, tShown: !!t && getComputedStyle(t).display !== 'none', dShown: !!d && getComputedStyle(d).display !== 'none' }; });
        await p.setViewportSize({ width: 400, height: 900 }); await sleep(250);
        var clk2 = await p.evaluate(function () { var k = document.getElementById('clk'), t = k.querySelector('.t'), d = k.querySelector('.d'); return { clk: getComputedStyle(k).display, t: t ? getComputedStyle(t).display : 'missing', d: d ? getComputedStyle(d).display : 'missing' }; });
        await p.setViewportSize({ width: 340, height: 900 }); await sleep(250);
        var clk3 = await p.evaluate(function () { return getComputedStyle(document.getElementById('clk')).display; });
        rec('T7w the clock shows the time and the date (like 9:07 PM and 10/15/2026), the time alone under 30em, no clock under 22.5em', /^\d{1,2}:\d\d [AP]M$/.test(clk.t || '') && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clk.d || '') && clk.tShown && clk.dShown && clk2.clk !== 'none' && clk2.t !== 'none' && clk2.t !== 'missing' && clk2.d === 'none' && clk3 === 'none', { wide: clk, at400: clk2, at340: clk3 });
        await c.close();

        /* ---- T8: title bars fit at every width, nothing off the page ---- */
        var widths = [320, 360, 390, 414, 600, 760, 820, 1024, 1200, 1280, 1440, 1920];
        for (i = 0; i < widths.length; i++) {
            c = await ctxWith(browser, { viewport: { width: widths[i], height: 900 } }, true);
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'load' }); await sleep(900); await walk(p); await sleep(300);
            var bad = await barsFit(p);
            var hov = await p.evaluate(function () { return document.documentElement.scrollWidth > innerWidth; });
            rec('T8 ' + widths[i] + ' wide: caption buttons at the window\'s right edge, 46 wide and the bar\'s height, the bar 2.5rem, titles clear of them on one line, the log\'s table fits, nothing off the page, no sideways scroll', bad.length === 0 && !hov, { bad: bad, hov: hov });
            if (widths[i] === 390) {
                var ph = await p.evaluate(function () { return { sizes: ['mn', 'mx', 'x'].map(function (k) { var b = document.querySelector('#rr .wbtn.' + k).getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; }), when: getComputedStyle(document.querySelector('#rr .wd .when')).display }; });
                rec('T8d on a phone: Minimize, Maximize and Close are there, 46 by 40 each, and the date is in the body', ph.sizes.every(function (q) { return q[0] === 46 && q[1] === 40; }) && ph.when !== 'none', ph);
            }
            await c.close();
        }

        /* ---- T9: a phone: a finger on a title bar scrolls the page ---- */
        c = await ctxWith(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true);
        p = await c.newPage(); errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
        await p.goto(URL, { waitUntil: 'load' }); await sleep(1500);
        var ta = await p.evaluate(function () { return getComputedStyle(document.querySelector('#terminal .wb')).touchAction; });
        rec('T9a the title bar lets a finger scroll (touch-action not none)', ta !== 'none', ta);
        before = await rect(p, '#terminal');
        var cdp = await c.newCDPSession(p);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: before.l + 60, y: before.t + 12 }] });
        for (var k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: before.l + 60, y: before.t + 12 - k * 30 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(400);
        var yy = await p.evaluate(function () { return scrollY; }); var tnx = await p.evaluate(function () { return document.getElementById('terminal').style.getPropertyValue('--nx'); });
        rec('T9b a swipe on a title bar scrolls the page and drags nothing', yy > 50 && tnx === '', { y: yy, nx: tnx });
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(200);
        await p.tap('#about .wbtn.mn'); await sleep(450);
        var mi9 = await p.evaluate(function () { var w = document.getElementById('about'); return { mini: w.classList.contains('mini'), display: getComputedStyle(w).display }; });
        await p.tap('.tb-a[data-sec="about"]'); await sleep(700);
        var mb9 = await p.evaluate(function () { var w = document.getElementById('about'); return { mini: w.classList.contains('mini'), display: getComputedStyle(w).display, vis: getComputedStyle(w.querySelector('.wd')).visibility }; });
        rec('T9c a tap on Minimize takes the window out of the column, and a tap on its taskbar button puts it back', mi9.mini && mi9.display === 'none' && !mb9.mini && mb9.display !== 'none' && mb9.vis === 'visible', { minimized: mi9, back: mb9 });
        // a tap on a window raises it
        await p.tap('#readme .wd'); await sleep(100);
        var tp = await p.evaluate(function () { return document.getElementById('readme').classList.contains('top'); });
        rec('T9d a tap on a window brings it to the front', tp, tp);
        rec('T9e no page errors on the phone', errs.length === 0, errs);
        await c.close();

        /* ---- T10: keyboard ---- */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } }, true);
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(1500);
        var tabs = [];
        for (i = 0; i < 6; i++) { await p.keyboard.press('Tab'); await sleep(60); tabs.push(await p.evaluate(function () { var a = document.activeElement; return (a.className || '').split(' ')[0] + ':' + (a.getAttribute('aria-label') || a.textContent.trim().slice(0, 20)); })); }
        rec('T10a Tab: skip link, then the first window\'s caption buttons (Minimize, Maximize, Close), then the next window\'s', /skip/.test(tabs[0]) && /:Minimize whoami$/.test(tabs[1]) && /:Maximize whoami$/.test(tabs[2]) && /:Close whoami$/.test(tabs[3]) && /:Minimize fastfetch$/.test(tabs[4]) && /:Maximize fastfetch$/.test(tabs[5]), tabs);
        var fv = await p.evaluate(function () { return getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineColor; });
        rec('T10b focus is visible (red outline)', /solid/.test(fv) && /216, 30, 5|255, 84, 54/.test(fv), fv);
        // Enter on Minimize works, Space too, and the keyboard moves on to the next window's Minimize (focus is on Maximize fastfetch)
        await p.keyboard.press('Shift+Tab'); await sleep(60);
        var on0 = await p.evaluate(function () { return document.activeElement.getAttribute('aria-label'); });
        var about0 = await place(p, '#about'), readme0 = await place(p, '#readme');
        await p.keyboard.press('Enter'); await sleep(450);
        var k1 = await p.evaluate(function () { return { mini: document.getElementById('about').classList.contains('mini'), focus: document.activeElement.getAttribute('aria-label') }; });
        rec('T10c Enter on Minimize sends fastfetch to the taskbar, and focus moves to Minimize readme.md', on0 === 'Minimize fastfetch' && k1.mini && k1.focus === 'Minimize readme.md', { from: on0, after: k1 });
        await p.keyboard.press('Space'); await sleep(450);
        var k2 = await p.evaluate(function () { return { mini: document.getElementById('readme').classList.contains('mini'), focus: document.activeElement.getAttribute('aria-label') }; });
        await p.click('.tb-a[data-sec="about"]'); await sleep(700);
        var k3 = await p.evaluate(function () { return ['about', 'readme'].map(function (id) { var w = document.getElementById(id); return { id: id, mini: w.classList.contains('mini'), vis: getComputedStyle(w.querySelector('.wd')).visibility }; }); });
        var about1 = await place(p, '#about'), readme1 = await place(p, '#readme');
        rec('T10d Space on Minimize sends readme.md too and focus moves to Minimize headshot.jpg; the about button in the taskbar brings both back in place', k2.mini && k2.focus === 'Minimize headshot.jpg' && k3.every(function (x) { return !x.mini && x.vis === 'visible'; }) && samePlace(about0, about1) && samePlace(readme0, readme1), { space: k2, back: k3, about: [about0, about1], readme: [readme0, readme1] });
        // focus landing in a pending window pops it
        await p.evaluate(function () { document.querySelector('#contact .wbtn.mn').focus(); }); await sleep(300);
        var pc = await p.evaluate(function () { var w = document.getElementById('contact'), r = w.getBoundingClientRect(); return { up: w.classList.contains('up'), pend: w.classList.contains('pend'), inView: r.top >= 0 && r.bottom <= innerHeight + 1 }; });
        rec('T10e focus landing in a window below the fold pops it and shows it', pc.up && !pc.pend && pc.inView, pc);
        // the skip link lands on the taskbar, and Tab from there is the eye
        await p.evaluate(function () { scrollTo(0, 0); }); await p.keyboard.press('Tab'); await sleep(50);
        await p.evaluate(function () { document.querySelector('.skip').focus(); }); await p.keyboard.press('Enter'); await sleep(200);
        var sk = await p.evaluate(function () { return document.activeElement.id; });
        await p.keyboard.press('Tab'); await sleep(50);
        var sk2 = await p.evaluate(function () { return document.activeElement.id; });
        rec('T10f the skip link lands on the taskbar, and the next Tab is the eye', sk === 'tb' && sk2 === 'tbEye', { landed: sk, next: sk2 });
        await c.close();

        /* ---- T11: the loops: the LCD eye blinks on its own, the foot's eye once when reached ---- */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } }, true);
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(1200);
        var loops = await p.evaluate(function () { return document.querySelector('#about .eye').getAnimations({ subtree: true }).filter(function (a) { return /idle/.test(a.animationName); }).length; });
        rec('T11a fastfetch\'s eye runs its blink loop', loops === 3, loops);
        await p.evaluate(function () { scrollTo(0, document.documentElement.scrollHeight); }); await sleep(400);
        var fb = await p.evaluate(function () { return document.querySelector('.foot-eye').getAnimations({ subtree: true }).length; });
        rec('T11b the foot\'s eye blinks when reached', fb >= 1, fb);
        // the cursor: a bar that blinks in the front window, and none in the rest
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(200);
        var cr2 = await grab(p, '#readme .wb'); await p.mouse.click(cr2.x, cr2.y); await sleep(150);
        var cur = await p.evaluate(function () {
            var a = document.querySelector('#readme .wait .tc'), r = a.getBoundingClientRect();
            var rest = [].filter.call(document.querySelectorAll('.wd .tc'), function (t) { return t !== a && getComputedStyle(t).visibility !== 'hidden'; }).map(function (t) { return t.closest('.win').id + (t.closest('.term-row') ? ' (typed)' : ''); });
            return { vis: getComputedStyle(a).visibility, w: +r.width.toFixed(2), blinks: a.getAnimations().filter(function (x) { return x.playState === 'running'; }).length, others: rest };
        });
        rec('T11c the front window\'s cursor is a 2px bar that blinks; no other window shows a cursor', cur.vis === 'visible' && Math.abs(cur.w - 2) <= .5 && cur.blinks === 1 && cur.others.length === 0, cur);
        await c.close();

        /* ---- T12: print and forced colours do not break ---- */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } }, true);
        p = await c.newPage(); errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
        await p.goto(URL, { waitUntil: 'load' }); await sleep(800);
        await p.click('#about .wbtn.mn'); await sleep(450);           // a minimized window and a closed one print like the rest
        await p.click('#shot .wbtn.x'); await sleep(450);
        await p.emulateMedia({ media: 'print' }); await sleep(300);
        var pr = await p.evaluate(function () {
            function shown(sel) { return [].filter.call(document.querySelectorAll(sel), function (e) { return getComputedStyle(e).display !== 'none'; }).length; }
            var mini = document.getElementById('about'), shut = document.getElementById('shot');
            return { tb: getComputedStyle(document.getElementById('tb')).display, menu: getComputedStyle(document.getElementById('menu')).display, wc: shown('#desk .wc'), ti: shown('#desk .ti'), nt: shown('#desk .nt'), pos: getComputedStyle(document.getElementById('readme')).position, pend: [].some.call(document.querySelectorAll('.win'), function (w) { return +getComputedStyle(w).opacity < 1; }), bg: getComputedStyle(document.body).backgroundColor, desk: getComputedStyle(document.getElementById('desk')).display,
                mini: { cls: mini.classList.contains('mini'), display: getComputedStyle(mini).display, vis: [mini, mini.querySelector('.wd'), mini.querySelector('.wt'), mini.querySelector('.readout')].every(function (e) { return !!e && getComputedStyle(e).visibility === 'visible'; }) },
                shut: { hidden: shut.hidden, display: getComputedStyle(shut).display } };
        });
        rec('T12a print: no taskbar, list, caption buttons, tab icons or split buttons; windows static blocks, all visible, white; a minimized window and a closed one print too', pr.tb === 'none' && pr.menu === 'none' && pr.wc === 0 && pr.ti === 0 && pr.nt === 0 && pr.pos === 'static' && !pr.pend && pr.bg === 'rgb(255, 255, 255)' && pr.desk === 'block' && pr.mini.cls && pr.mini.display === 'block' && pr.mini.vis && pr.shut.hidden && pr.shut.display === 'block', pr);
        await p.emulateMedia({ media: 'screen', forcedColors: 'active' }); await sleep(300);
        await p.hover('#readme .wbtn.mn'); await sleep(300);
        var fc = await p.evaluate(function () {
            function sys(k) { var d = document.createElement('div'); d.style.cssText = 'position:absolute;width:1px;height:1px;forced-color-adjust:none;background-color:' + k; document.body.appendChild(d); var v = getComputedStyle(d).backgroundColor; d.remove(); return v; }
            var cur = document.querySelector('.tb-a[aria-current]'), tab = document.querySelector('#readme .tab');
            return { border: getComputedStyle(document.getElementById('readme')).borderTopStyle, tab: tab ? getComputedStyle(tab).borderTopStyle : 'missing', hover: getComputedStyle(document.querySelector('#readme .wbtn.mn')).backgroundColor, highlight: sys('Highlight'), canvas: sys('Canvas'), current: cur && cur.getAttribute('data-sec'), pill: cur ? getComputedStyle(cur, '::after').backgroundColor : null, tb: getComputedStyle(document.getElementById('tb')).backgroundColor };
        });
        var pillA = rgba(fc.pill), tbA = rgba(fc.tb);
        rec('T12b forced colours: windows and tabs keep a solid edge, a hovered caption button is Highlight, the current pill is not Canvas, the taskbar is opaque', fc.border === 'solid' && fc.tab === 'solid' && fc.hover === fc.highlight && !!pillA && pillA[3] > 0 && fc.pill !== fc.canvas && !!tbA && tbA[3] === 1, fc);
        await p.mouse.move(5, 5);
        rec('T12c no page errors', errs.length === 0, errs);
        await c.close();

        /* ---- T13: a larger default font ---- */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } }, true);
        p = await c.newPage();
        cdp = await c.newCDPSession(p); await cdp.send('Page.setFontSizes', { fontSizes: { standard: 24, fixed: 24 } });
        await p.goto(URL, { waitUntil: 'load' }); await sleep(1000); await walk(p);
        bad = await barsFit(p); hov = await p.evaluate(function () { return document.documentElement.scrollWidth > innerWidth; });
        rec('T13 with a 24px default font the bars still fit and nothing goes sideways', bad.length === 0 && !hov, { bad: bad, hov: hov });
        await c.close();

        /* ---- T14: whole pixels: every window's left edge and width are whole at 1440 and 1366 ---- */
        for (var vw of [1440, 1366]) {
            c = await ctxWith(browser, { viewport: { width: vw, height: 900 } }, true);
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'load' }); await sleep(2200);      // the pops are over
            var px = await p.evaluate(function () { return [].map.call(document.querySelectorAll('.win'), function (w) { var r = w.getBoundingClientRect(); return [w.id, +(r.left % 1).toFixed(2), +(r.width % 1).toFixed(2)]; }).filter(function (x) { return x[1] !== 0 || x[2] !== 0; }); });
            rec('T14 at ' + vw + ' every window sits on whole pixels', px.length === 0, px);
            await c.close();
        }

        /* ---- T15: the review's findings stay fixed ---- */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } }, true);
        p = await c.newPage(); errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
        await p.goto(URL, { waitUntil: 'load' }); await sleep(1800);
        // a: however many raises, nothing covers the taskbar, the list or the skip link
        for (i = 0; i < 12; i++) { var id = ['cam', 'terminal', 'shot', 'about', 'readme', 'else'][i % 6]; var rr0 = await grab(p, '#' + id + ' .wb'); await p.mouse.click(rr0.x, rr0.y); }
        br = await grab(p, '#readme .wb');
        await p.mouse.move(br.x, br.y); await p.mouse.down(); await p.mouse.move(br.x, br.y + 700, { steps: 10 }); await p.mouse.up(); await sleep(100);
        var over = await p.evaluate(function () {
            var tb = document.getElementById('tb').getBoundingClientRect(), r = document.getElementById('readme').getBoundingClientRect();
            var hit = document.elementFromPoint(Math.round(r.left + 30), Math.round(tb.top + 20));
            return { winOverTb: r.bottom > tb.top, hitInTb: !!(hit && hit.closest('#tb')), hit: hit && (hit.id || hit.className) };
        });
        rec('T15a a window dragged under the taskbar stays beneath it', over.winOverTb && over.hitInTb, over);
        await p.click('#tbEye'); await sleep(120);
        var mhit = await p.evaluate(function () { var m = document.getElementById('menu').getBoundingClientRect(); var hit = document.elementFromPoint(Math.round(m.left + 40), Math.round(m.top + 60)); return !!(hit && hit.closest('#menu')); });
        rec('T15b the list opens over the windows', mhit, mhit);
        await p.keyboard.press('Escape'); await sleep(60);
        var zcount = await p.evaluate(function () { return +document.getElementById('readme').style.zIndex; });
        var rr1 = await grab(p, '#readme .wb'); for (i = 0; i < 5; i++) await p.mouse.click(rr1.x, rr1.y);
        var zcount2 = await p.evaluate(function () { return +document.getElementById('readme').style.zIndex; });
        rec('T15c clicking the front window again does not raise it further', zcount === zcount2 && zcount < 40, { before: zcount, after: zcount2 });
        // f/g: a minimized window cannot stay filling the screen; a link while one fills the screen fronts the target
        var ab0 = await place(p, '#about');
        await p.click('#about .wbtn.mx'); await sleep(120); await p.click('#about .wbtn.mn'); await sleep(450);
        var sm = await p.evaluate(function () { var w = document.getElementById('about'); return { maxi: w.classList.contains('maxi'), mini: w.classList.contains('mini'), lock: /\block\b/.test(document.documentElement.className), inert: [].some.call(document.querySelectorAll('.win'), function (x) { return x.inert; }) }; });
        await p.click('#tbEye'); await sleep(100); await p.click('#menu button[data-act="reset"]'); await sleep(1700);
        var rz = await p.evaluate(function () { var w = document.getElementById('about'); return { maxi: w.classList.contains('maxi'), mini: w.classList.contains('mini'), vis: getComputedStyle(w.querySelector('.wd')).visibility }; });
        var ab1 = await place(p, '#about');
        rec('T15f minimizing a window that fills the screen brings it back down first (no lock, nothing inert), and Reset the desk brings it back in its place', !sm.maxi && sm.mini && !sm.lock && !sm.inert && !rz.mini && !rz.maxi && rz.vis === 'visible' && samePlace(ab0, ab1), { minimized: sm, reset: rz, before: ab0, after: ab1 });
        await p.click('#terminal .wbtn.mx'); await sleep(120); await p.click('.tb-a[data-sec="about"]'); await sleep(400);
        var lk = await p.evaluate(function () { return { top: (document.querySelector('.win.top') || {}).id, maxi: document.querySelectorAll('.win.maxi').length }; });
        rec('T15g a taskbar button while a window fills the screen brings the target to the front', lk.top === 'about' && lk.maxi === 0, lk);
        // h: fastfetch filling the screen does not scroll
        await p.click('#about .wbtn.mx'); await sleep(150);
        var es = await p.evaluate(function () { var wd = document.querySelector('#about .wd'); return { sh: wd.scrollHeight, ch: wd.clientHeight }; });
        rec('T15h fastfetch filling the screen fills it without a scrollbar', es.sh <= es.ch + 1, es);
        await p.keyboard.press('Escape'); await sleep(100);
        // j: closing from the keyboard moves focus on
        await p.evaluate(function () { document.querySelector('#else .wbtn.x').focus(); }); await p.keyboard.press('Enter'); await sleep(400);
        var fo = await p.evaluate(function () { var a = document.activeElement; return { tag: a.tagName, label: a.getAttribute('aria-label'), elseHidden: document.getElementById('else').hidden }; });
        rec('T15j Enter on Close what else tho takes focus to Minimize photography, the next window\'s first button', fo.elseHidden && fo.tag === 'BUTTON' && /^Minimize photography$/.test(fo.label || ''), fo);
        // r: a window opened again while it is closing stays
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(100);
        await p.click('#cam .wbtn.x'); await sleep(40);
        await p.click('#tbEye'); await sleep(60); await p.click('#menu button[data-w="cam"]'); await sleep(500);
        var ro = await p.evaluate(function () { var w = document.getElementById('cam'); return { hidden: w.hidden, down: w.classList.contains('down'), up: w.classList.contains('up'), disp: getComputedStyle(w).display }; });
        rec('T15r a window opened again mid-close is open', !ro.hidden && !ro.down && ro.up && ro.disp !== 'none', ro);
        // s: a resize while a dragged window fills the screen keeps its place
        await p.click('#tbEye'); await sleep(60); await p.click('#menu button[data-act="reset"]'); await sleep(1500);
        br = await grab(p, '#readme .wb'); await p.mouse.move(br.x, br.y); await p.mouse.down(); await p.mouse.move(br.x + 44, br.y + 88, { steps: 5 }); await p.mouse.up(); await sleep(60);
        var nxBefore = await p.evaluate(function () { return document.getElementById('readme').style.getPropertyValue('--nx'); });
        await p.click('#readme .wbtn.mx'); await sleep(100); await p.setViewportSize({ width: 1380, height: 900 }); await sleep(300); await p.keyboard.press('Escape'); await sleep(100);
        var nxAfter = await p.evaluate(function () { return document.getElementById('readme').style.getPropertyValue('--nx'); });
        rec('T15s a resize while a dragged window fills the screen leaves its drag alone', nxBefore === nxAfter && nxBefore !== '', { before: nxBefore, after: nxAfter });
        // t: printing brings a screen-filling window back
        await p.click('#contact .wbtn.mx'); await sleep(100);
        await p.evaluate(function () { window.dispatchEvent(new Event('beforeprint')); }); await sleep(100);
        var pm = await p.evaluate(function () { return { maxi: document.querySelectorAll('.win.maxi').length, lock: /\block\b/.test(document.documentElement.className) }; });
        rec('T15t printing restores a window that filled the screen', pm.maxi === 0 && !pm.lock, pm);
        // p: the markup says what the controls are
        var ar = await p.evaluate(function () { var pr = document.querySelectorAll('[aria-pressed]'); return { haspopup: document.getElementById('tbEye').hasAttribute('aria-haspopup'), pressed: pr.length, allMaximize: [].every.call(pr, function (b) { return b.matches('.wbtn.mx'); }), minimizePressed: document.querySelectorAll('.wbtn.mn[aria-pressed]').length, firstHeading: document.querySelector('h1, h2, h3').tagName }; });
        rec('T15p the eye is a disclosure, Maximize alone is a toggle (17 of them), the first heading is the h1', !ar.haspopup && ar.pressed === 17 && ar.allMaximize && ar.minimizePressed === 0 && ar.firstHeading === 'H1', ar);
        rec('T15v no page errors in the review checks', errs.length === 0, errs);
        await c.close();

        // k: nothing reveals itself after ten seconds; l: a window under the taskbar waits
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } }, true);
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(1500);
        var tr = await grab(p, '#terminal .wb'); await p.mouse.click(tr.x, tr.y); await sleep(50);
        var s0 = await state(p);
        await sleep(10500); var s1 = await state(p);
        rec('T15k ten seconds of nothing changes nothing: the rest still wait, the front window is the same', s1.pend === s0.pend && s1.pend > 0 && s1.top === 'terminal', { before: s0, after: s1 });
        var under = await p.evaluate(function () {
            var w = document.getElementById('contact'), tb = document.getElementById('tb').getBoundingClientRect();
            var y = w.getBoundingClientRect().top + scrollY - tb.top - 10;        // its top 10px into the taskbar's strip
            document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, y); return y;
        }); await sleep(600);
        var u1 = await p.evaluate(function () { var w = document.getElementById('contact'), r = w.getBoundingClientRect(), tb = document.getElementById('tb').getBoundingClientRect(); return { pend: w.classList.contains('pend'), top: Math.round(r.top), tbTop: Math.round(tb.top) }; });
        await p.evaluate(function () { scrollBy(0, 90); }); await sleep(600);
        var u2 = await p.evaluate(function () { var w = document.getElementById('contact'); return w.classList.contains('pend'); });
        rec('T15l a window still under the taskbar waits; once clear of it, it pops', u1.pend && u1.top > u1.tbTop && !u2, { under: u1, after: u2 });
        await c.close();

        // d/e: a finger
        c = await ctxWith(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true);
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(1500);
        // the finger goes down on a window that is up, in view, and not the front one
        var fg = await p.evaluate(function () { var t = document.querySelector('.win.top'), ws = document.querySelectorAll('.win.up'), i, r; for (i = 0; i < ws.length; i++) { r = ws[i].getBoundingClientRect(); if (ws[i] !== t && r.top >= 0 && r.top + 160 < innerHeight) return { top: t && t.id, id: ws[i].id, l: r.left, t: r.top }; } return { top: t && t.id }; });
        cdp = await c.newCDPSession(p);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fg.l + 60, y: fg.t + 60 }] });
        for (k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: fg.l + 60, y: fg.t + 60 - k * 30 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
        var topAfter = await p.evaluate(function () { return (document.querySelector('.win.top') || {}).id; });
        rec('T15d a finger scrolling over a window does not bring it to the front', !!fg.id && topAfter === fg.top && fg.top !== fg.id, { over: fg.id, before: fg.top, after: topAfter });
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(200);
        await p.tap('#terminal .wb'); await p.tap('#terminal .wb'); await sleep(200);
        var dm = await p.evaluate(function () { var b = document.querySelector('#terminal .wbtn.mx'); return { maxi: document.getElementById('terminal').classList.contains('maxi'), top: (document.querySelector('.win.top') || {}).id, back: b.offsetWidth > 0 }; });
        await p.tap('#terminal .wbtn.mx'); await sleep(200);
        var dm2 = await p.evaluate(function () { return document.getElementById('terminal').classList.contains('maxi'); });
        rec('T15e a double tap on a phone\'s title bar fills the screen, Maximize is there, and a tap on it restores', dm.maxi && dm.top === 'terminal' && dm.back && !dm2, { after: dm, restored: !dm2 });
        await c.close();
        // n: 320 keeps "Mathematical" whole; m: no JS shows no cursor
        c = await ctxWith(browser, { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true);
        p = await c.newPage(); await p.goto(URL, { waitUntil: 'load' }); await sleep(1200);
        var mw = await p.evaluate(function () {
            var dd = document.querySelectorAll('#about dd')[2], range = document.createRange(); range.selectNodeContents(dd);
            var rects = [].map.call(range.getClientRects(), function (r) { return Math.round(r.width); });
            return { ddW: Math.round(dd.getBoundingClientRect().width), first: rects[0], text: dd.textContent };
        });
        rec('T15n at 320 fastfetch keeps "Mathematical" on one line', mw.ddW >= 96 && mw.first >= 96, mw);
        await c.close();
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 }, javaScriptEnabled: false }, false);
        p = await c.newPage(); await p.goto(URL, { waitUntil: 'load' }); await sleep(500);
        var nc = await p.evaluate(function () { return { typed: getComputedStyle(document.querySelector('#terminal .term-row .tc')).display, prompts: [].map.call(document.querySelectorAll('.wd .wait .tc'), function (t) { return getComputedStyle(t).visibility; }), tops: document.querySelectorAll('.win.top').length }; });
        rec('T15m without the script no window is in front: the typed line has no cursor and no prompt shows one', nc.typed === 'none' && nc.prompts.length > 0 && nc.prompts.every(function (v) { return v === 'hidden'; }) && nc.tops === 0, nc);
        await c.close();
        // c: on a boot visit the hand-off blink plays (the loop waits for the pop)
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } }, false);
        p = await c.newPage(); await p.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(2500);
        var pre = await p.evaluate(function () { return document.querySelector('#about .eye').getAnimations({ subtree: true }).map(function (a) { return a.animationName; }); });
        await p.keyboard.press('Space'); await sleep(250);
        var post = await p.evaluate(function () { return document.querySelector('#about .eye').getAnimations({ subtree: true }).map(function (a) { return a.animationName + '@' + Math.round(a.currentTime); }); });
        await sleep(1100);                   // the hand-off blink is at 1.4s after the pop
        var frames = 0;
        for (i = 0; i < 20; i++) { var f = await p.evaluate(function () { return [].some.call(document.querySelectorAll('#about .bf'), function (g) { return +getComputedStyle(g).opacity === 1; }); }); if (f) frames++; await sleep(25); }
        rec('T15c on a boot visit the eye holds its loop under the boot and blinks once at the hand-off', pre.length === 0 && post.some(function (n) { return /^bootHalf@/.test(n); }) && frames >= 2, { pre: pre, post: post, blinkSamples: frames });
        await c.close();

        /* ---- T16: the workflow's findings stay fixed ---- */
        // a: under reduced motion a minimize and a restore animate nothing; a link to the window and a hash change each bring it back in place
        c = await ctxWith(browser, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, true);
        p = await c.newPage(); errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
        await p.goto(URL, { waitUntil: 'load' }); await sleep(800);
        var cam0 = await place(p, '#cam');
        await p.click('#cam .wbtn.mn'); await sleep(150);
        var a1 = { mini: await p.evaluate(function () { return document.getElementById('cam').classList.contains('mini'); }), moving: await moving(p) };
        await p.click('#else .lsx a[href="#cam"]'); await sleep(300);
        var a2 = { mini: await p.evaluate(function () { return document.getElementById('cam').classList.contains('mini'); }), moving: await moving(p), at: await place(p, '#cam') };
        var d200 = await place(p, '#d20');
        await p.click('#d20 .wbtn.mn'); await sleep(150);
        var a3 = { mini: await p.evaluate(function () { return document.getElementById('d20').classList.contains('mini'); }), moving: await moving(p) };
        await p.evaluate(function () { location.hash = '#d20'; }); await sleep(300);
        var a4 = { mini: await p.evaluate(function () { return document.getElementById('d20').classList.contains('mini'); }), moving: await moving(p), at: await place(p, '#d20') };
        rec('T16a under reduced motion a minimize and a restore animate nothing, and a link to the window and a hash change each bring it back in place', a1.mini && !a1.moving.length && !a2.mini && !a2.moving.length && samePlace(cam0, a2.at) && a3.mini && !a3.moving.length && !a4.mini && !a4.moving.length && samePlace(d200, a4.at), { link: [cam0, a1, a2], hash: [d200, a3, a4] });
        await c.close();
        c = await ctxWith(browser, { viewport: { width: 1440, height: 900 } }, true);
        p = await c.newPage(); p.on('pageerror', function (e) { errs.push(String(e)); });
        await p.goto(URL, { waitUntil: 'load' }); await sleep(1800);
        // e: the car's readout keys are the screen's dim
        var rk = await p.evaluate(function () { return { key: getComputedStyle(document.querySelector('#rr .box dt')).color, val: getComputedStyle(document.querySelector('#rr .box dd')).color, nfKey: getComputedStyle(document.querySelector('#about .ro dt')).color }; });
        rec('T16e RR01\'s keys are dim and its values cream; fastfetch\'s keys are red', rk.key === 'rgb(143, 143, 134)' && rk.val === 'rgb(230, 228, 210)' && rk.nfKey === 'rgb(255, 84, 54)', rk);
        // o: the listing names files; the file's heading carries the proper name
        var ls = await p.evaluate(function () { return { file: document.querySelector('#log .ls a .arg').textContent, heading: document.querySelector('#rr .md .hd').textContent, org: document.querySelector('#thresher .md .hd').textContent, title: document.getElementById('rr-h').textContent.trim() }; });
        rec('T16o the listing names files and each file\'s heading is the proper name', ls.file === 'rice-racing.md' && ls.heading === 'Rice Racing' && ls.org === 'The Rice Thresher & Rice RAW' && ls.title === 'log\\rice-racing.md', ls);
        // b: a drag survives a close and a reopen on the desk
        await p.evaluate(function () { document.getElementById('deepblue').scrollIntoView(); }); await sleep(900);
        br = await grab(p, '#deepblue .wb');
        await p.mouse.move(br.x, br.y); await p.mouse.down(); await p.mouse.move(br.x + 1200, br.y, { steps: 8 }); await p.mouse.up(); await sleep(80);
        var d0 = await p.evaluate(function () { var r = document.getElementById('deepblue').getBoundingClientRect(); return { r: Math.round(r.right), docW: document.documentElement.scrollWidth }; });
        await p.click('#thresher .wbtn.x'); await sleep(450);
        var d1 = await p.evaluate(function () { var r = document.getElementById('deepblue').getBoundingClientRect(), dk = document.getElementById('desk').getBoundingClientRect(); return { r: Math.round(r.right), deskR: Math.round(dk.right), docW: document.documentElement.scrollWidth, inner: innerWidth }; });
        await p.click('#tbEye'); await sleep(80); await p.click('#menu button[data-w="deepblue"]'); await sleep(500);
        var d2 = await p.evaluate(function () { return { x: scrollX, docW: document.documentElement.scrollWidth }; });
        rec('T16b a window dragged to the edge stays on the desk when another closes, and picking it scrolls nothing sideways', d1.r <= d1.deskR + 1 && d1.docW <= d1.inner && d2.x === 0 && d2.docW <= d1.inner, { afterDrag: d0, afterClose: d1, afterPick: d2 });
        await p.click('#tbEye'); await sleep(80); await p.click('#menu button[data-w="thresher"]'); await sleep(500);
        var d3 = await p.evaluate(function () { var r = document.getElementById('deepblue').getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), inner: innerWidth, docW: document.documentElement.scrollWidth, x: scrollX }; });
        rec('T16b2 and when the closed window comes back, the dragged one is still on the page', d3.l >= 0 && d3.r <= d3.inner && d3.docW <= d3.inner && d3.x === 0, d3);
        // j: after a reset, a click on a window at the back fronts it
        await p.click('#tbEye'); await sleep(80); await p.click('#menu button[data-act="reset"]'); await sleep(1800);
        var lit0 = await p.evaluate(function () { var t = document.querySelectorAll('.win.top'); return { tops: t.length, top: t[0] && t[0].id }; });
        await p.evaluate(function () { document.getElementById('readme').scrollIntoView({ block: 'center' }); }); await sleep(300);
        var ab = await grab(p, '#readme .wb'); await p.mouse.click(ab.x, ab.y); await sleep(60);
        var lit1 = await p.evaluate(function () { var w = document.getElementById('readme'); return { top: w.classList.contains('top'), z: +w.style.zIndex, maxZ: Math.max.apply(null, [].map.call(document.querySelectorAll('.win'), function (x) { return +x.style.zIndex || 0; })) }; });
        rec('T16j after a reset the login shell alone is in front, and the first click on another window fronts it', lit0.tops === 1 && lit0.top === 'terminal' && lit1.top && lit1.z === lit1.maxZ && lit1.z > 0, { before: lit0, after: lit1 });
        // i: Escape closes the list before it restores a window filling the screen
        await p.click('#about .wbtn.mx'); await sleep(100); await p.click('#tbEye'); await sleep(80);
        await p.keyboard.press('Escape'); await sleep(80);
        var em = await p.evaluate(function () { return { menu: !document.getElementById('menu').hidden, maxi: document.getElementById('about').classList.contains('maxi') }; });
        await p.keyboard.press('Escape'); await sleep(80);
        var em2 = await p.evaluate(function () { return document.getElementById('about').classList.contains('maxi'); });
        rec('T16i Escape closes the list first, then the window filling the screen', !em.menu && em.maxi && !em2, { first: em, second: em2 });
        // f: a window filling the screen keeps its way back when the page narrows below 760
        await p.click('#readme .wbtn.mx'); await sleep(100); await p.setViewportSize({ width: 600, height: 800 }); await sleep(300);
        var nb = await p.evaluate(function () { var b = document.querySelector('#readme .wbtn.mx'); return { shown: b.offsetWidth > 0, maxi: document.getElementById('readme').classList.contains('maxi'), lock: /\block\b/.test(document.documentElement.className) }; });
        await p.click('#readme .wbtn.mx'); await sleep(100);
        var nb2 = await p.evaluate(function () { return { maxi: document.getElementById('readme').classList.contains('maxi'), lock: /\block\b/.test(document.documentElement.className) }; });
        rec('T16f narrowed below 760 while filling the screen, the window still fills it, keeps its Maximize button, and that button restores it', nb.shown && nb.maxi && nb.lock && !nb2.maxi && !nb2.lock, { before: nb, after: nb2 });
        await p.setViewportSize({ width: 1440, height: 900 }); await sleep(300);
        // c: the list closes when focus lands elsewhere on the page
        await p.click('#tbEye'); await sleep(80);
        await p.evaluate(function () { document.querySelector('.skip').focus(); }); await sleep(80);
        var mc = await p.evaluate(function () { return { menu: !document.getElementById('menu').hidden, focus: document.activeElement.className }; });
        rec('T16c focus landing elsewhere on the page closes the list', !mc.menu && /skip/.test(mc.focus), mc);
        // k: back to the hash of a closed window brings it back
        await p.click('#contact .wbtn.x'); await sleep(450);
        await p.evaluate(function () { location.hash = '#contact'; }); await sleep(500);
        var hk = await p.evaluate(function () { var w = document.getElementById('contact'), r = w.getBoundingClientRect(); return { hidden: w.hidden, up: w.classList.contains('up'), inView: r.top >= 0 && r.bottom <= innerHeight }; });
        rec('T16k a hash change to a closed window brings it back into view', !hk.hidden && hk.up && hk.inView, hk);
        // g: forced colours: a red "now" is the theme's text like the rest
        await p.emulateMedia({ forcedColors: 'active' }); await sleep(100);
        var fcn = await p.evaluate(function () { var w = document.getElementById('rr'); return { now: getComputedStyle(w.querySelector('.when.now')).color, what: getComputedStyle(w.querySelector('.what')).color }; });
        rec('T16g in forced colours "now" is the theme\'s text, like the rest', fcn.now === fcn.what, fcn);
        await p.emulateMedia({ forcedColors: 'none' });
        // h: printed windows are white
        await p.emulateMedia({ media: 'print' }); await sleep(100);
        var pw0 = await p.evaluate(function () { var tab = document.querySelector('#readme .tab'); return { win: getComputedStyle(document.getElementById('readme')).backgroundColor, wd: getComputedStyle(document.querySelector('#readme .wd')).backgroundColor, bar: getComputedStyle(document.querySelector('#readme .wb')).backgroundColor, tab: tab ? getComputedStyle(tab).backgroundColor : 'missing', prompts: getComputedStyle(document.querySelector('#readme .ln')).display, link: getComputedStyle(document.querySelector('#rr .go')).display }; });
        rec('T16h a printed window is white with no dark body, bar or tab; the prompts are off, the commands that are links stay', pw0.win === 'rgb(255, 255, 255)' && clear(pw0.wd) && clear(pw0.bar) && clear(pw0.tab) && pw0.prompts === 'none' && pw0.link !== 'none', pw0);
        await p.emulateMedia({ media: 'screen' });
        rec('T16z no page errors in the workflow checks', errs.length === 0, errs);
        await c.close();

        // d: a finger on a touchscreen laptop scrolls over a title bar
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 }, hasTouch: true }, true);
        p = await c.newPage(); await p.goto(URL, { waitUntil: 'load' }); await sleep(1500);
        var fineNow = await p.evaluate(function () { return matchMedia('(pointer: fine) and (min-width: 760px)').matches; });
        before = await rect(p, '#terminal .wb');
        cdp = await c.newCDPSession(p);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: before.l + 60, y: before.t + 12 }] });
        for (k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: before.l + 60, y: before.t + 12 - k * 30 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(400);
        var tl = await p.evaluate(function () { return { y: scrollY, nx: document.getElementById('terminal').style.getPropertyValue('--nx'), ta: getComputedStyle(document.querySelector('#terminal .wb')).touchAction }; });
        rec('T16d on a touchscreen laptop a finger on a title bar scrolls the page and drags nothing', tl.y > 50 && tl.nx === '' && tl.ta !== 'none', { fine: fineNow, result: tl });
        await c.close();

        // l, p: a phone: a double tap on Close closes one window; a tap leaves no hover behind
        c = await ctxWith(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true);
        p = await c.newPage(); await p.goto(URL, { waitUntil: 'load' }); await sleep(1500);
        await p.evaluate(function () { document.getElementById('cam').scrollIntoView(); scrollBy(0, -40); }); await sleep(800);
        var xb2 = await rect(p, '#cam .wbtn.x'), xx = xb2.l + xb2.w / 2, xy = xb2.t + xb2.h / 2;   // Close is at the right of the bar
        await p.touchscreen.tap(xx, xy); await sleep(120); await p.touchscreen.tap(xx, xy); await sleep(600);
        var dt = await p.evaluate(function () { return { cam: document.getElementById('cam').hidden, d20: document.getElementById('d20').hidden, pad: document.getElementById('pad').hidden, hidden: document.querySelectorAll('.win[hidden]').length }; });
        rec('T16l a double tap on Close closes one window, not the one that moved up under it', dt.cam && dt.hidden === 1, dt);
        await p.tap('#about .wbtn.mx'); await sleep(350);
        var hv = await capLook(p, '#about .wbtn.mx'), hvA = rgba(hv.colour);
        rec('T16p a tap on a caption button leaves no hover fill behind, and its glyph shows', !hv.hover && hv.maxi && clear(hv.bg) && hv.glyphs === 1 && hv.glyph === 1 && hv.vis === 'visible' && !!hvA && hvA[3] > 0, hv);
        await p.tap('#about .wbtn.mx'); await sleep(350);
        hv = await capLook(p, '#about .wbtn.mx'); hvA = rgba(hv.colour);
        rec('T16p2 and so does the tap that restores the window', !hv.maxi && clear(hv.bg) && hv.glyphs === 1 && hv.glyph === 1 && hv.vis === 'visible' && !!hvA && hvA[3] > 0, hv);
        await c.close();

        /* ---- T17: the Windows build's own: no tab roles, the split button, the skip link's names, the taskbar on a phone, the pills, the list on a small screen, no em dashes ---- */
        c = await ctxWith(browser, { viewport: { width: 1440, height: 900 } }, true);
        p = await c.newPage(); errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
        await p.goto(URL, { waitUntil: 'load' }); await sleep(1800);
        // a: a window is a window with one tab, not a tab list
        var roles = await p.evaluate(function () { return [].map.call(document.querySelectorAll('[role~="tab"], [role~="tablist"], [role~="tabpanel"]'), function (e) { return e.tagName + '#' + e.id + ' ' + e.getAttribute('role'); }); });
        rec('T17a no element has a tab, tablist or tabpanel role', roles.length === 0, roles);
        // c: the skip link's words, where it lands, and what comes next
        await p.keyboard.press('Tab'); await sleep(60);
        var sl0 = await p.evaluate(function () { var a = document.activeElement; return { cls: a.className, text: a.textContent.trim() }; });
        await p.keyboard.press('Enter'); await sleep(200);
        var sl1 = await p.evaluate(function () { var a = document.activeElement; return { tag: a.tagName, id: a.id, name: a.getAttribute('aria-label') }; });
        await p.keyboard.press('Tab'); await sleep(60);
        var sl2 = await p.evaluate(function () { var a = document.activeElement; return { id: a.id, name: a.getAttribute('aria-label') }; });
        rec('T17c the skip link reads skip to the taskbar and lands on the nav named Taskbar; the next Tab is the button named Window list', /skip/.test(sl0.cls) && sl0.text === 'skip to the taskbar' && sl1.tag === 'NAV' && sl1.id === 'tb' && sl1.name === 'Taskbar' && sl2.id === 'tbEye' && sl2.name === 'Window list', { skip: sl0, landed: sl1, next: sl2 });
        // b: the split button is decoration, and a window under 420px has none
        var nt = await p.evaluate(function () {
            var bad = [], wide = 0, narrow = 0;
            document.querySelectorAll('.win').forEach(function (w) {
                var n = w.querySelector('.nt'); if (!n) { bad.push(w.id + ' has none'); return; }
                if (n.getAttribute('aria-hidden') !== 'true') bad.push(w.id + ' not aria-hidden');
                if (n.matches('[tabindex], a, button') || n.querySelector('[tabindex], a, button, input')) bad.push(w.id + ' focusable');
                var cs = getComputedStyle(w), cw = w.getBoundingClientRect().width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth), d = getComputedStyle(n).display;
                if (Math.abs(cw - 420) < 1) return;                // too close to call
                if (cw < 420) { narrow++; if (d !== 'none') bad.push(w.id + ' ' + Math.round(cw) + 'px shows it'); }
                else { wide++; if (d === 'none') bad.push(w.id + ' ' + Math.round(cw) + 'px hides it'); }
            });
            return { bad: bad, wide: wide, narrow: narrow };
        });
        await p.setViewportSize({ width: 390, height: 844 }); await sleep(300);
        var nt2 = await p.evaluate(function () { return [].filter.call(document.querySelectorAll('.nt'), function (n) { return getComputedStyle(n).display !== 'none'; }).length; });
        await p.setViewportSize({ width: 1440, height: 900 }); await sleep(300);
        rec('T17b the split button is decoration (aria-hidden, never focusable), there in windows 420px wide and up and gone in narrower ones', nt.bad.length === 0 && nt.wide > 0 && nt.narrow > 0 && nt2 === 0, { at1440: nt, shownAt390: nt2 });
        // g: no em dash anywhere on the page, the window list included
        await walk(p);
        await p.click('#tbEye'); await sleep(150);
        var dash = await p.evaluate(function () { var t = document.body.innerText, j = t.indexOf('\u2014'); return j < 0 ? null : t.slice(Math.max(0, j - 40), j + 40); });
        await p.keyboard.press('Escape'); await sleep(80);
        rec('T17g no text on the page has an em dash (the window list open)', dash === null, dash);
        // e: the pills follow the scroll; a part whose windows are all closed has none
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(400);
        var pl0 = await pills(p);
        await p.evaluate(function () { document.getElementById('log').scrollIntoView(); scrollBy(0, -200); }); await sleep(400);
        var pl1 = await pills(p);
        await p.click('#contact .wbtn.x'); await sleep(500);
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(400);
        var pl2 = await pills(p);
        rec('T17e the current part\'s button has the red 16px pill and it follows the scroll, the others a grey 6px one, and a part whose windows are all closed has none', pillsAre(pl0, 'home') && pillsAre(pl1, 'log') && pillsAre(pl2, 'home', 'contact'), { top: pl0, log: pl1, contactClosed: pl2 });
        await c.close();
        // d, f: a phone's taskbar with 16px and 24px default fonts: every label shows, inside the taskbar and the screen; and the list fits a 320 screen
        for (var fz of [16, 24]) for (var nw of [320, 390]) {
            c = await ctxWith(browser, { viewport: { width: nw, height: 700 } }, true);
            p = await c.newPage(); p.on('pageerror', function (e) { errs.push(String(e)); });
            if (fz !== 16) { cdp = await c.newCDPSession(p); await cdp.send('Page.setFontSizes', { fontSizes: { standard: fz, fixed: fz } }); }
            await p.goto(URL, { waitUntil: 'load' }); await sleep(1000);
            var tbx = await p.evaluate(function () {
                var tb = document.getElementById('tb'), t = tb.getBoundingClientRect(), bad = [], labels = [];
                [].forEach.call(document.querySelectorAll('.tb-a'), function (a) {
                    var r = a.getBoundingClientRect(), label = a.textContent.trim(), q = null, n, rg = document.createRange(), tw = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
                    labels.push(label);
                    while ((n = tw.nextNode())) if (n.data.trim()) { rg.selectNodeContents(n); q = rg.getBoundingClientRect(); break; }
                    if (!q || q.width < 1 || q.left < r.left - .5 || q.right > r.right + .5 || getComputedStyle(n.parentNode).visibility !== 'visible') bad.push(label + ': its text does not show');
                    if (r.left < t.left - .5 || r.right > t.right + .5 || r.top < t.top - .5 || r.bottom > t.bottom + .5) bad.push(label + ': outside the taskbar');
                    if (r.left < -.5 || r.right > innerWidth + .5) bad.push(label + ': off the screen');
                });
                return { labels: labels, bad: bad, side: document.documentElement.scrollWidth > innerWidth, tbScrolls: tb.scrollWidth > tb.clientWidth };
            });
            rec('T17d ' + nw + ' wide, ' + fz + 'px default font: home, about, log and contact all show, inside the taskbar and the screen, and nothing scrolls sideways', tbx.labels.join(' ') === 'home about log contact' && tbx.bad.length === 0 && !tbx.side, tbx);
            if (nw === 320 && fz === 16) {
                await p.click('#tbEye'); await sleep(150);
                var ml = await p.evaluate(function () { var m = document.getElementById('menu'), r = m.getBoundingClientRect(), tb = document.getElementById('tb').getBoundingClientRect(); return { open: !m.hidden, l: r.left, r: r.right, t: r.top, b: r.bottom, vw: innerWidth, tbTop: tb.top }; });
                rec('T17f at 320 the window list opens inside the screen, above the taskbar', ml.open && ml.l >= -.5 && ml.r <= ml.vw + .5 && ml.t >= -.5 && ml.b <= ml.tbTop + .5, ml);
            }
            await c.close();
        }
        rec('T17z no page errors in the Windows checks', errs.length === 0, errs);
    } finally {
        await browser.close();
        var fails = results.filter(function (r) { return !r.ok; });
        fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
        console.log('\n' + (results.length - fails.length) + '/' + results.length + ' passed' + (fails.length ? ', FAILED: ' + fails.map(function (f) { return f.name; }).join(' | ') : ''));
    }
})();
