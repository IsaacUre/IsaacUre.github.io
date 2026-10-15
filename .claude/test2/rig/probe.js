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
async function grab(page, sel) { var r = await rect(page, sel); return { x: r.l + r.w / 2, y: r.t + r.h / 2, l: r.l, t: r.t, w: r.w, h: r.h }; }
async function barsFit(page) {              // every title bar's buttons inside their window, every bar at most two lines
    return page.evaluate(function () {
        var bad = [];
        document.querySelectorAll('.win').forEach(function (w) {
            if (w.hidden) return;
            var r = w.getBoundingClientRect(), wc = w.querySelector('.wc').getBoundingClientRect(), wb = w.querySelector('.wb').getBoundingClientRect();
            var wt = w.querySelector('.wt'), tr = wt.getBoundingClientRect();
            if (wc.right > r.right + .5 || wc.left < r.left) bad.push(w.id + ' lights out ' + Math.round(wc.right - r.right));
            if (wb.height > 40) bad.push(w.id + ' bar ' + Math.round(wb.height) + 'px');
            if (tr.left < wc.right + 4) bad.push(w.id + ' title under the lights');
            if (tr.right > r.right + .5) bad.push(w.id + ' title out');
            if (r.left < -0.5 || r.right > innerWidth + .5) bad.push(w.id + ' off the page ' + Math.round(r.left) + '..' + Math.round(r.right));
        });
        return bad;
    });
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
        rec('T1e the first to pop is the login shell, the second neofetch', order.length > 1 && order[0][1][0] === 'terminal' && order[1][1][1] === 'about', order.slice(0, 2));
        rec('T1f the rest wait below the fold (pend), none hidden', s.up >= 6 && s.pend === s.n - s.up && s.hidden === 0, s);
        rec('T1g the taskbar is up', s.tb === 1, s.tb);
        await sleep(1400);
        var tw = await p.evaluate(function () {
            var cmd = document.querySelector('#terminal .cmd'), ans = document.querySelector('#terminal .answer'), wait = document.querySelector('#terminal .wait');
            return { cmd: Math.round(cmd.getBoundingClientRect().width), ans: +getComputedStyle(ans).opacity, wait: +getComputedStyle(wait).opacity, banner: Math.round(document.querySelector('.banner').getBoundingClientRect().width), lastlogin: document.getElementById('lastlogin').textContent };
        });
        rec('T1h the login shell typed whoami, printed the answer, and the prompt is back; the banner is up at full size; last login has a date', tw.cmd === 48 && tw.ans === 1 && tw.wait === 1 && tw.banner >= 410 && /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) [A-Z][a-z]{2} [ \d]\d \d\d:\d\d:\d\d$/.test(tw.lastlogin), tw);
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
        rec('T2c at the top it marks about', s.current && /about/.test(s.current), s.current);
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
            var wins = document.querySelectorAll('.win'), shown = 0;
            wins.forEach(function (w) { if (+getComputedStyle(w).opacity === 1 && getComputedStyle(w).display !== 'none') shown++; });
            return { cls: document.documentElement.className, shown: shown, n: wins.length, btn: getComputedStyle(document.querySelector('.wc')).display, eye: getComputedStyle(document.getElementById('tbEye')).display, gb: getComputedStyle(document.querySelector('.shot-gb')).display, term: getComputedStyle(document.getElementById('term')).display, cmdW: Math.round(document.querySelector('#terminal .cmd').getBoundingClientRect().width), tb: getComputedStyle(document.getElementById('tb')).opacity };
        });
        rec('T6 no JS: every window shown, no window buttons, no eye button, no Game Boy layer, no terminal, whoami typed, taskbar shown', nojs.cls === 'no-js' && nojs.shown === nojs.n && nojs.btn === 'none' && nojs.eye === 'none' && nojs.gb === 'none' && nojs.term === 'none' && nojs.cmdW === 48 && nojs.tb === '1', nojs);
        await c.close();

        /* ---- T7: the windows as windows: raise, drag, shade, fill, close, the menu ---- */
        c = await ctxWith(browser, { viewport: { width: 1440, height: 900 } }, true);
        p = await c.newPage(); errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
        await p.goto(URL, { waitUntil: 'load' }); await sleep(1800);
        // raise: a click on the photo's body
        var sr = await rect(p, '#shot .wd');
        await p.mouse.click(sr.l + 20, sr.t + 20); await sleep(100);
        var z = await p.evaluate(function () { var w = document.getElementById('shot'); return { top: w.classList.contains('top'), z: +w.style.zIndex, tops: document.querySelectorAll('.win.top').length, maxZ: Math.max.apply(null, [].map.call(document.querySelectorAll('.win'), function (x) { return +x.style.zIndex || 0; })) }; });
        rec('T7a a click brings a window to the front: .top on it alone, highest z-index', z.top && z.tops === 1 && z.z === z.maxZ, z);
        // the title bar inverts on the top window
        var bar = await p.evaluate(function () { var b = document.querySelector('#shot .wb'), o = document.querySelector('#readme .wb'); return { topBar: getComputedStyle(b).backgroundImage, otherBar: getComputedStyle(o).backgroundImage, light: getComputedStyle(document.querySelector('#shot .wbtn.x'), '::before').backgroundColor, otherLight: getComputedStyle(document.querySelector('#readme .wbtn.x'), '::before').backgroundColor }; });
        rec('T7b the front window\'s title bar is lit and its lights are coloured; a window at the back has grey ones', bar.topBar !== bar.otherBar && bar.light === 'rgb(255, 95, 87)' && bar.otherLight === 'rgb(75, 75, 78)', bar);
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
        // shade
        await p.click('#about .wbtn.mn'); await sleep(80);
        var sh = await p.evaluate(function () { var w = document.getElementById('about'); return { shade: w.classList.contains('shade'), body: getComputedStyle(w.querySelector('.wd')).display, pressed: w.querySelector('.wbtn.mn').getAttribute('aria-pressed'), h: Math.round(w.getBoundingClientRect().height) }; });
        rec('T7h minimize shades a window to its title bar', sh.shade && sh.body === 'none' && sh.pressed === 'true' && sh.h < 40, sh);
        await p.click('#about .wbtn.mn'); await sleep(80);
        sh = await p.evaluate(function () { var w = document.getElementById('about'); return { shade: w.classList.contains('shade'), body: getComputedStyle(w.querySelector('.wd')).display, pressed: w.querySelector('.wbtn.mn').getAttribute('aria-pressed') }; });
        rec('T7i and again restores it', !sh.shade && sh.body !== 'none' && sh.pressed === 'false', sh);
        // maximize
        await p.click('#about .wbtn.mx'); await sleep(120);
        var mx = await p.evaluate(function () {
            var w = document.getElementById('about'), r = w.getBoundingClientRect(), tb = document.getElementById('tb').getBoundingClientRect();
            return { maxi: w.classList.contains('maxi'), pos: getComputedStyle(w).position, l: r.left, t: r.top, rr: r.right, b: Math.round(r.bottom), tbTop: Math.round(tb.top), lock: /\block\b/.test(document.documentElement.className), inertOthers: [].every.call(document.querySelectorAll('.win'), function (x) { return x === w ? !x.inert : x.inert; }), pressed: w.querySelector('.wbtn.mx').getAttribute('aria-pressed'), focus: document.activeElement.className };
        });
        rec('T7j maximize fills the screen above the taskbar, locks the page, and makes the rest inert', mx.maxi && mx.pos === 'fixed' && mx.l === 0 && mx.t === 0 && mx.rr === 1440 && mx.b === mx.tbTop && mx.lock && mx.inertOthers && mx.pressed === 'true', mx);
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
            var m = document.getElementById('menu'), b = document.getElementById('tbEye');
            var items = [].map.call(m.querySelectorAll('button'), function (x) { return x.textContent.replace(/\s+/g, ' ').trim(); });
            return { open: !m.hidden, expanded: b.getAttribute('aria-expanded'), n: items.length, d20: items.filter(function (t) { return /d&d/.test(t); })[0], first: document.activeElement === m.querySelector('button'), hasTop: items.some(function (t) { return /^> ?top/.test(t); }), hasReset: items.some(function (t) { return /reset/.test(t); }) };
        });
        rec('T7o the eye opens the window list: 17 windows + top + reset, focus on the first, d&d shown closed', mn.open && mn.expanded === 'true' && mn.n === 19 && /^\[ \]\s*d&d, closed$/.test(mn.d20 || '') && mn.first && mn.hasTop && mn.hasReset, mn);
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
        // the taskbar's commands jump, and reopen a closed window
        await p.click('#contact .wbtn.x'); await sleep(400);
        await p.click('.tb-a[data-sec="contact"]'); await sleep(600);
        cr = await rect(p, '#contact'); tbr = await rect(p, '#tb');
        var cc = await p.evaluate(function () { var w = document.getElementById('contact'); return { hidden: w.hidden, up: w.classList.contains('up') }; });
        rec('T7t > contact in the taskbar reopens the closed contact window and scrolls to it', !cc.hidden && cc.up && cr.t >= 0 && cr.b <= tbr.t + 1, { cc: cc, cr: cr, tbTop: tbr.t });
        await p.click('.tb-a[data-sec="log"]'); await sleep(600);
        var lr = await rect(p, '#log');
        rec('T7u > log scrolls to the log', lr.t >= 0 && lr.t < 300, lr);
        rec('T7v no page errors in the window tests', errs.length === 0, errs);
        await p.screenshot({ path: path.join(OUT, 't7-end.png') });
        // the clock
        var clk = await p.evaluate(function () { return document.getElementById('clk').textContent; });
        rec('T7w the clock shows a time', /^\d{1,2}:\d\d( [ap]m)?$/.test(clk), clk);
        await c.close();

        /* ---- T8: title bars fit at every width, nothing off the page ---- */
        var widths = [320, 360, 390, 414, 600, 760, 820, 1024, 1200, 1280, 1440, 1920];
        for (i = 0; i < widths.length; i++) {
            c = await ctxWith(browser, { viewport: { width: widths[i], height: 900 } }, true);
            p = await c.newPage();
            await p.goto(URL, { waitUntil: 'load' }); await sleep(900); await walk(p); await sleep(300);
            var bad = await barsFit(p);
            var hov = await p.evaluate(function () { return document.documentElement.scrollWidth > innerWidth; });
            rec('T8 ' + widths[i] + ' wide: title bars fit, nothing off the page, no sideways scroll', bad.length === 0 && !hov, { bad: bad, hov: hov });
            if (widths[i] === 390) {
                var ph = await p.evaluate(function () { var b = document.querySelector('#rr .wbtn.mx').getBoundingClientRect(); return { mxW: Math.round(b.width), mxH: Math.round(b.height), when: getComputedStyle(document.querySelector('#rr .wd .when')).display, x: getComputedStyle(document.querySelector('#rr .wbtn.x')).display }; });
                rec('T8d on a phone: the three lights are there, 24px targets each, and the date is in the body', ph.mxW === 24 && ph.mxH === 24 && ph.x !== 'none' && ph.when !== 'none', ph);
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
        await p.tap('#about .wbtn.mn'); await sleep(100);
        sh = await p.evaluate(function () { return document.getElementById('about').classList.contains('shade'); });
        rec('T9c a tap on minimize shades', sh, sh);
        await p.tap('#about .wbtn.mn'); await sleep(100);
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
        rec('T10a Tab: skip link, then the first window\'s three lights (close, shade, zoom), then the next window', /skip/.test(tabs[0]) && /close whoami/.test(tabs[1]) && /minimize whoami/.test(tabs[2]) && /maximize whoami/.test(tabs[3]) && /close neofetch/.test(tabs[4]) && /minimize neofetch/.test(tabs[5]), tabs);
        var fv = await p.evaluate(function () { return getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineColor; });
        rec('T10b focus is visible (red outline)', /solid/.test(fv) && /216, 30, 5/.test(fv), fv);
        // Enter on a button works, Space too (focus is on neofetch's shade light)
        await p.keyboard.press('Enter'); await sleep(80);
        sh = await p.evaluate(function () { return document.getElementById('about').classList.contains('shade'); });
        rec('T10c Enter on the shade light shades neofetch', sh, sh);
        await p.keyboard.press('Space'); await sleep(80);
        sh = await p.evaluate(function () { return document.getElementById('about').classList.contains('shade'); });
        rec('T10d Space restores it', !sh, sh);
        // focus landing in a pending window pops it
        await p.evaluate(function () { document.querySelector('#contact .wbtn.mn').focus(); }); await sleep(300);
        var pc = await p.evaluate(function () { var w = document.getElementById('contact'), r = w.getBoundingClientRect(); return { up: w.classList.contains('up'), pend: w.classList.contains('pend'), inView: r.top >= 0 && r.bottom <= innerHeight + 1 }; });
        rec('T10e focus landing in a window below the fold pops it and shows it', pc.up && !pc.pend && pc.inView, pc);
        // the skip link lands on the desk
        await p.evaluate(function () { scrollTo(0, 0); }); await p.keyboard.press('Tab'); await sleep(50);
        await p.evaluate(function () { document.querySelector('.skip').focus(); }); await p.keyboard.press('Enter'); await sleep(200);
        var sk = await p.evaluate(function () { return document.activeElement.id; });
        rec('T10f the skip link lands on the desk', sk === 'desk', sk);
        await c.close();

        /* ---- T11: the loops: the LCD eye blinks on its own, the foot's eye once when reached ---- */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } }, true);
        p = await c.newPage();
        await p.goto(URL, { waitUntil: 'load' }); await sleep(1200);
        var loops = await p.evaluate(function () { return document.querySelector('#about .eye').getAnimations({ subtree: true }).filter(function (a) { return /idle/.test(a.animationName); }).length; });
        rec('T11a neofetch\'s eye runs its blink loop', loops === 3, loops);
        await p.evaluate(function () { scrollTo(0, document.documentElement.scrollHeight); }); await sleep(400);
        var fb = await p.evaluate(function () { return document.querySelector('.foot-eye').getAnimations({ subtree: true }).length; });
        rec('T11b the foot\'s eye blinks when reached', fb >= 1, fb);
        // the cursors blink
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(200);
        var cr2 = await grab(p, '#readme .wb'); await p.mouse.click(cr2.x, cr2.y); await sleep(80);
        var cur = await p.evaluate(function () { var a = document.querySelector('#readme .wait .tc'), b = document.querySelector('#terminal .wait .tc'); return { topBlinks: a.getAnimations().length, topSolid: getComputedStyle(a).backgroundColor, otherBlinks: b.getAnimations().length, otherHollow: getComputedStyle(b).backgroundColor }; });
        rec('T11c the front window\'s cursor is solid and blinks; another window\'s is hollow and still', cur.topBlinks === 1 && cur.topSolid === 'rgb(230, 228, 210)' && cur.otherBlinks === 0 && /rgba\(0, 0, 0, 0\)|transparent/.test(cur.otherHollow), cur);
        await c.close();

        /* ---- T12: print and forced colours do not break ---- */
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 } }, true);
        p = await c.newPage(); errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
        await p.goto(URL, { waitUntil: 'load' }); await sleep(800);
        await p.emulateMedia({ media: 'print' }); await sleep(300);
        var pr = await p.evaluate(function () { return { tb: getComputedStyle(document.getElementById('tb')).display, wc: getComputedStyle(document.querySelector('.wc')).display, pos: getComputedStyle(document.getElementById('readme')).position, pend: [].some.call(document.querySelectorAll('.win'), function (w) { return +getComputedStyle(w).opacity < 1; }), bg: getComputedStyle(document.body).backgroundColor, desk: getComputedStyle(document.getElementById('desk')).display }; });
        rec('T12a print: no taskbar, no buttons, windows static blocks, all visible, white', pr.tb === 'none' && pr.wc === 'none' && pr.pos === 'static' && !pr.pend && pr.bg === 'rgb(255, 255, 255)' && pr.desk === 'block', pr);
        await p.emulateMedia({ media: 'screen', forcedColors: 'active' }); await sleep(300);
        var fc = await p.evaluate(function () { return { border: getComputedStyle(document.getElementById('readme')).borderTopStyle, light: getComputedStyle(document.querySelector('#readme .wbtn.x'), '::before').borderTopStyle, glyph: +getComputedStyle(document.querySelector('#readme .wbtn.x svg')).opacity }; });
        rec('T12b forced colours: windows keep an edge, the lights become rings with their glyphs showing', fc.border === 'solid' && fc.light === 'solid' && fc.glyph === 1, fc);
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
        // f/g: a shaded window cannot stay filling the screen; a link while one fills the screen fronts the target
        await p.click('#about .wbtn.mx'); await sleep(120); await p.click('#about .wbtn.mn'); await sleep(120);
        var sm = await p.evaluate(function () { var w = document.getElementById('about'); return { maxi: w.classList.contains('maxi'), shade: w.classList.contains('shade'), lock: /\block\b/.test(document.documentElement.className), inert: [].some.call(document.querySelectorAll('.win'), function (x) { return x.inert; }) }; });
        rec('T15f shading a window that fills the screen brings it back first', !sm.maxi && sm.shade && !sm.lock && !sm.inert, sm);
        await p.click('#about .wbtn.mn'); await sleep(60);
        await p.click('#terminal .wbtn.mx'); await sleep(120); await p.click('.tb-a[data-sec="about"]'); await sleep(400);
        var lk = await p.evaluate(function () { return { top: (document.querySelector('.win.top') || {}).id, maxi: document.querySelectorAll('.win.maxi').length }; });
        rec('T15g a taskbar command while a window fills the screen brings the target to the front', lk.top === 'about' && lk.maxi === 0, lk);
        // h: neofetch filling the screen does not scroll
        await p.click('#about .wbtn.mx'); await sleep(150);
        var es = await p.evaluate(function () { var wd = document.querySelector('#about .wd'); return { sh: wd.scrollHeight, ch: wd.clientHeight }; });
        rec('T15h neofetch filling the screen fills it without a scrollbar', es.sh <= es.ch + 1, es);
        await p.keyboard.press('Escape'); await sleep(100);
        // j: closing from the keyboard moves focus on
        await p.evaluate(function () { document.querySelector('#else .wbtn.x').focus(); }); await p.keyboard.press('Enter'); await sleep(400);
        var fo = await p.evaluate(function () { var a = document.activeElement; return { tag: a.tagName, label: a.getAttribute('aria-label'), elseHidden: document.getElementById('else').hidden }; });
        rec('T15j Enter on close takes focus to the next window\'s first light', fo.elseHidden && fo.tag === 'BUTTON' && /close photography/.test(fo.label || ''), fo);
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
        var ar = await p.evaluate(function () { return { haspopup: document.getElementById('tbEye').hasAttribute('aria-haspopup'), pressed: document.querySelectorAll('.wbtn.mn[aria-pressed], .wbtn.mx[aria-pressed]').length, firstHeading: document.querySelector('h1, h2, h3').tagName }; });
        rec('T15p the eye is a disclosure, every toggle is pressed or not, the first heading is the h1', !ar.haspopup && ar.pressed === 34 && ar.firstHeading === 'H1', ar);
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
        var topBefore = await p.evaluate(function () { return (document.querySelector('.win.top') || {}).id; });
        before = await rect(p, '#terminal');
        cdp = await c.newCDPSession(p);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: before.l + 60, y: before.t + 60 }] });
        for (k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: before.l + 60, y: before.t + 60 - k * 30 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
        var topAfter = await p.evaluate(function () { return (document.querySelector('.win.top') || {}).id; });
        rec('T15d a finger scrolling over a window does not bring it to the front', topAfter === topBefore && topBefore !== 'terminal', { before: topBefore, after: topAfter });
        await p.evaluate(function () { scrollTo(0, 0); }); await sleep(200);
        await p.tap('#terminal .wb'); await p.tap('#terminal .wb'); await sleep(200);
        var dm = await p.evaluate(function () { var b = document.querySelector('#terminal .wbtn.mx'); return { maxi: document.getElementById('terminal').classList.contains('maxi'), top: (document.querySelector('.win.top') || {}).id, back: b.offsetWidth > 0 }; });
        await p.tap('#terminal .wbtn.mx'); await sleep(200);
        var dm2 = await p.evaluate(function () { return document.getElementById('terminal').classList.contains('maxi'); });
        rec('T15e a double tap on a phone\'s title bar fills the screen, the green light is there, and a tap on it restores', dm.maxi && dm.top === 'terminal' && dm.back && !dm2, { after: dm, restored: !dm2 });
        await c.close();
        // n: 320 keeps "Mathematical" whole; m: no JS shows one cursor
        c = await ctxWith(browser, { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true);
        p = await c.newPage(); await p.goto(URL, { waitUntil: 'load' }); await sleep(1200);
        var mw = await p.evaluate(function () {
            var dd = document.querySelectorAll('#about dd')[2], range = document.createRange(); range.selectNodeContents(dd);
            var rects = [].map.call(range.getClientRects(), function (r) { return Math.round(r.width); });
            return { ddW: Math.round(dd.getBoundingClientRect().width), first: rects[0], text: dd.textContent };
        });
        rec('T15n at 320 neofetch keeps "Mathematical" on one line', mw.ddW >= 96 && mw.first >= 96, mw);
        await c.close();
        c = await ctxWith(browser, { viewport: { width: 1280, height: 800 }, javaScriptEnabled: false }, false);
        p = await c.newPage(); await p.goto(URL, { waitUntil: 'load' }); await sleep(500);
        var nc = await p.evaluate(function () { return { typed: getComputedStyle(document.querySelector('#terminal .term-row .tc')).display, wait: getComputedStyle(document.querySelector('#terminal .wait .tc')).display }; });
        rec('T15m without the script the terminal shows one cursor, at the prompt', nc.typed === 'none' && nc.wait !== 'none', nc);
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
        c = await ctxWith(browser, { viewport: { width: 1440, height: 900 } }, true);
        p = await c.newPage(); errs = []; p.on('pageerror', function (e) { errs.push(String(e)); });
        await p.goto(URL, { waitUntil: 'load' }); await sleep(1800);
        // a: the terminal shades
        await p.click('#terminal .wbtn.mn'); await sleep(80);
        var ts = await p.evaluate(function () { var w = document.getElementById('terminal'); return { disp: getComputedStyle(w.querySelector('.wd')).display, h: Math.round(w.getBoundingClientRect().height) }; });
        rec('T16a minimize shades the terminal too', ts.disp === 'none' && ts.h < 40, ts);
        await p.click('#terminal .wbtn.mn'); await sleep(60);
        // e: the car's readout keys are the screen's dim
        var rk = await p.evaluate(function () { return { key: getComputedStyle(document.querySelector('#rr .box dt')).color, val: getComputedStyle(document.querySelector('#rr .box dd')).color, nfKey: getComputedStyle(document.querySelector('#about .ro dt')).color }; });
        rec('T16e RR01\'s keys are dim and its values cream; neofetch\'s keys are red', rk.key === 'rgb(143, 143, 134)' && rk.val === 'rgb(230, 228, 210)' && rk.nfKey === 'rgb(255, 84, 54)', rk);
        // o: the listing names files; the file's heading carries the proper name
        var ls = await p.evaluate(function () { return { file: document.querySelector('#log .ls a .arg').textContent, heading: document.querySelector('#rr .md .hd').textContent, org: document.querySelector('#thresher .md .hd').textContent, title: document.getElementById('rr-h').textContent.trim() }; });
        rec('T16o the listing names files and each file\'s heading is the proper name', ls.file === 'rice-racing.md' && ls.heading === 'Rice Racing' && ls.org === 'The Rice Thresher & Rice RAW' && ls.title === 'log/rice-racing.md', ls);
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
        // j: after a reset, a click on the window that was lit raises it
        await p.click('#tbEye'); await sleep(80); await p.click('#menu button[data-act="reset"]'); await sleep(1800);
        var lit0 = await p.evaluate(function () { return { tops: document.querySelectorAll('.win.top').length }; });
        await p.evaluate(function () { document.getElementById('readme').scrollIntoView({ block: 'center' }); }); await sleep(300);
        var ab = await grab(p, '#readme .wb'); await p.mouse.click(ab.x, ab.y); await sleep(60);
        var lit1 = await p.evaluate(function () { var w = document.getElementById('readme'); return { top: w.classList.contains('top'), z: +w.style.zIndex, maxZ: Math.max.apply(null, [].map.call(document.querySelectorAll('.win'), function (x) { return +x.style.zIndex || 0; })) }; });
        rec('T16j after a reset nothing is lit, and the first click lights and fronts its window', lit0.tops === 0 && lit1.top && lit1.z === lit1.maxZ && lit1.z > 0, { before: lit0, after: lit1 });
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
        rec('T16f narrowed below 760 while filling the screen, the window still fills it, keeps its green light, and the light restores it', nb.shown && nb.maxi && nb.lock && !nb2.maxi && !nb2.lock, { before: nb, after: nb2 });
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
        var pw0 = await p.evaluate(function () { return { win: getComputedStyle(document.getElementById('readme')).backgroundColor, wd: getComputedStyle(document.querySelector('#readme .wd')).backgroundColor, bar: getComputedStyle(document.querySelector('#readme .wb')).backgroundImage, prompts: getComputedStyle(document.querySelector('#readme .ln')).display, link: getComputedStyle(document.querySelector('#rr .go')).display }; });
        rec('T16h a printed window is white with no dark body or bar; the prompts are off, the commands that are links stay', pw0.win === 'rgb(255, 255, 255)' && /rgba\(0, 0, 0, 0\)|transparent/.test(pw0.wd) && pw0.bar === 'none' && pw0.prompts === 'none' && pw0.link !== 'none', pw0);
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

        // l, p: a phone: a double tap on close closes one window; a tap leaves no hover behind
        c = await ctxWith(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true);
        p = await c.newPage(); await p.goto(URL, { waitUntil: 'load' }); await sleep(1500);
        await p.evaluate(function () { document.getElementById('cam').scrollIntoView(); scrollBy(0, -40); }); await sleep(800);
        var xb2 = await rect(p, '#cam .wbtn.x');
        await p.touchscreen.tap(xb2.l + 14, xb2.t + 14); await sleep(120); await p.touchscreen.tap(xb2.l + 14, xb2.t + 14); await sleep(600);
        var dt = await p.evaluate(function () { return { cam: document.getElementById('cam').hidden, d20: document.getElementById('d20').hidden, pad: document.getElementById('pad').hidden, hidden: document.querySelectorAll('.win[hidden]').length }; });
        rec('T16l a double tap on close closes one window, not the one that moved up under it', dt.cam && dt.hidden === 1, dt);
        await p.tap('#about .wbtn.mn'); await sleep(150);
        var hv = await p.evaluate(function () { var b = document.querySelector('#about .wbtn.mn'); return { glyph: +getComputedStyle(b.querySelector('svg')).opacity, pressed: b.getAttribute('aria-pressed'), hover: matchMedia('(hover: hover)').matches }; });
        rec('T16p a tap shows no hover glyphs on the lights, other than the pressed state\'s own', !hv.hover && hv.pressed === 'true' && hv.glyph === 1, hv);
        await p.tap('#about .wbtn.mn'); await sleep(150);
        hv = await p.evaluate(function () { var b = document.querySelector('#about .wbtn.mn'); return { glyph: +getComputedStyle(b.querySelector('svg')).opacity, pressed: b.getAttribute('aria-pressed') }; });
        rec('T16p2 and once restored the glyph is gone again', hv.pressed === 'false' && hv.glyph === 0, hv);
        await c.close();
    } finally {
        await browser.close();
        var fails = results.filter(function (r) { return !r.ok; });
        fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
        console.log('\n' + (results.length - fails.length) + '/' + results.length + ' passed' + (fails.length ? ', FAILED: ' + fails.map(function (f) { return f.name; }).join(' | ') : ''));
    }
})();
