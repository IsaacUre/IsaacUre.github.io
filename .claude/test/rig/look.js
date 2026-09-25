/* Targeted screenshots for the regression fixes. Usage: node look.js <url> <outDir> */
var pw = require('/opt/node22/lib/node_modules/playwright');
var fs = require('fs'), path = require('path');
var URL = process.argv[2], OUT = path.resolve(process.argv[3] || 'look');
fs.mkdirSync(OUT, { recursive: true });
var FONTS = path.join(__dirname, 'fonts');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function ctx(browser, opts, warm) {
    var c = await browser.newContext(opts);
    await c.route('https://fonts.googleapis.com/**', function (r) { r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(FONTS, 'gf.css')) }); });
    await c.route('https://fonts.gstatic.com/**', function (r) { var u = r.request().url(), f = path.join(FONTS, u.replace('https://fonts.gstatic.com/', '').replace(/\//g, '_')); if (fs.existsSync(f)) r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } }); else r.fulfill({ status: 404, body: '' }); });
    await c.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, function (r) { if (/fonts\.(googleapis|gstatic)\.com/.test(r.request().url())) return r.fallback(); r.abort(); });
    if (warm) await c.addInitScript(function () { try { sessionStorage.setItem('iu.booted', '1'); } catch (e) {} });
    return c;
}
(async function () {
    var b = await pw.chromium.launch(), c, p;
    try {
        // landscape phone: the first screen, then pinned
        c = await ctx(b, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, true);
        p = await c.newPage(); await p.goto(URL, { waitUntil: 'load' }); await sleep(4200);
        await p.screenshot({ path: path.join(OUT, 'land-844x390-top.png') });
        await p.evaluate(function () { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, document.getElementById('log').getBoundingClientRect().top + scrollY - 60); }); await sleep(700);
        await p.screenshot({ path: path.join(OUT, 'land-844x390-pinned.png') });
        await c.close();
        // larger default text (24px): the bar at rest and pinned
        c = await ctx(b, { viewport: { width: 1280, height: 800 } }, true);
        p = await c.newPage(); var cdp = await c.newCDPSession(p); await cdp.send('Page.setFontSizes', { fontSizes: { standard: 24, fixed: 24 } });
        await p.goto(URL, { waitUntil: 'load' }); await sleep(4200);
        await p.screenshot({ path: path.join(OUT, 'fs24-top.png') });
        await p.evaluate(function () { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, 1500); }); await sleep(700);
        await p.screenshot({ path: path.join(OUT, 'fs24-pinned.png'), clip: { x: 0, y: 0, width: 1280, height: 300 } });
        await c.close();
        // a 414 phone: the photo against the column
        c = await ctx(b, { viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }, true);
        p = await c.newPage(); await p.goto(URL, { waitUntil: 'load' }); await sleep(600);
        await p.evaluate(function () { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, document.getElementById('about').getBoundingClientRect().top + scrollY - 70); }); await sleep(2600);
        await p.screenshot({ path: path.join(OUT, 'p414-about.png') });
        await c.close();
        // cold: 900ms after a key skip, then a Tab
        c = await ctx(b, { viewport: { width: 1280, height: 800 } }, false);
        p = await c.newPage(); await p.goto(URL, { waitUntil: 'load' }); await sleep(600);
        await p.keyboard.press('Space'); await sleep(900);
        await p.screenshot({ path: path.join(OUT, 'cold-900ms.png') });
        await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await sleep(150);
        await p.screenshot({ path: path.join(OUT, 'cold-900ms-tabbed.png') });
        await c.close();
    } finally { await b.close(); }
})();
