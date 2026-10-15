/* Screenshots for /test2. Usage: node shoot.js <url> <outDir> [bootWaitMs=7500]
   Google Fonts come from ../../test/rig/fonts; the browser gets no other network. */
var pw = require('/opt/node22/lib/node_modules/playwright');
var fs = require('fs'), path = require('path');
var URL = process.argv[2], OUT = path.resolve(process.argv[3] || 'shots'), BOOT = +(process.argv[4] || 7500);
fs.mkdirSync(OUT, { recursive: true });
var FONTS = path.join(__dirname, '..', '..', 'test', 'rig', 'fonts');
var report = { url: URL, runs: {} };
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function ctx(browser, opts, warm) {
    var c = await browser.newContext(opts);
    await c.route('https://fonts.googleapis.com/**', function (r) { r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(FONTS, 'gf.css')) }); });
    await c.route('https://fonts.gstatic.com/**', function (r) { var u = r.request().url(), f = path.join(FONTS, u.replace('https://fonts.gstatic.com/', '').replace(/\//g, '_')); if (fs.existsSync(f)) r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } }); else r.fulfill({ status: 404, body: '' }); });
    await c.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, function (r) { if (/fonts\.(googleapis|gstatic)\.com/.test(r.request().url())) return r.fallback(); r.abort(); });
    if (warm) await c.addInitScript(function () { try { sessionStorage.setItem('iu2.booted', '1'); } catch (e) {} });
    return c;
}
function hook(page, key) {
    report.runs[key] = { console: [], errors: [], failedRequests: [] };
    page.on('console', function (m) { if (m.type() === 'error' || m.type() === 'warning') report.runs[key].console.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', function (e) { report.runs[key].errors.push(String(e)); });
    page.on('requestfailed', function (r) { report.runs[key].failedRequests.push(r.url() + ' ' + (r.failure() && r.failure().errorText)); });
}
async function walk(page) {              // scroll the page so the windows below pop, then back up
    var h = await page.evaluate(function () { return document.documentElement.scrollHeight; });
    var vh = await page.evaluate(function () { return innerHeight; });
    for (var y = 0; y <= h; y += Math.round(vh * 0.6)) { await page.evaluate(function (y) { scrollTo(0, y); }, y); await sleep(450); }
    await sleep(800);
    await page.evaluate(function () { scrollTo(0, 0); }); await sleep(400);
}
async function overflow(page) { return page.evaluate(function () { return document.documentElement.scrollWidth > innerWidth; }); }
(async function () {
    var browser = await pw.chromium.launch(), c, p;
    try {
        // 1. desktop, first visit: the boot, then the cascade, then the whole page
        c = await ctx(browser, { viewport: { width: 1440, height: 900 } }, false);
        p = await c.newPage(); hook(p, 'desktop');
        await p.goto(URL, { waitUntil: 'domcontentloaded' });
        await sleep(2200); await p.screenshot({ path: path.join(OUT, 'd-boot-2.2s.png') });
        await sleep(Math.max(0, BOOT - 2200)); await p.screenshot({ path: path.join(OUT, 'd-first.png') });
        await walk(p);
        await p.screenshot({ path: path.join(OUT, 'd-full.png'), fullPage: true });
        report.runs.desktop.docHeight = await p.evaluate(function () { return document.documentElement.scrollHeight; });
        report.runs.desktop.hOverflow = await overflow(p);
        await c.close();
        // 2. warm desktop: the cascade frames
        c = await ctx(browser, { viewport: { width: 1440, height: 900 } }, true);
        p = await c.newPage(); hook(p, 'warm');
        await p.goto(URL, { waitUntil: 'domcontentloaded' });
        await sleep(150); await p.screenshot({ path: path.join(OUT, 'w-0.15s.png') });
        await sleep(250); await p.screenshot({ path: path.join(OUT, 'w-0.4s.png') });
        await sleep(400); await p.screenshot({ path: path.join(OUT, 'w-0.8s.png') });
        await sleep(2500); await p.screenshot({ path: path.join(OUT, 'w-3.3s.png') });
        await c.close();
        // 3. laptop 1280x720, warm
        c = await ctx(browser, { viewport: { width: 1280, height: 720 } }, true);
        p = await c.newPage(); hook(p, 'laptop');
        await p.goto(URL, { waitUntil: 'load' }); await sleep(3500); await p.screenshot({ path: path.join(OUT, 'l-first.png') });
        await walk(p); await p.screenshot({ path: path.join(OUT, 'l-full.png'), fullPage: true });
        report.runs.laptop.hOverflow = await overflow(p);
        await c.close();
        // 4. tablet 900 wide, warm
        c = await ctx(browser, { viewport: { width: 900, height: 1100 } }, true);
        p = await c.newPage(); hook(p, 'tablet');
        await p.goto(URL, { waitUntil: 'load' }); await sleep(3500); await walk(p);
        await p.screenshot({ path: path.join(OUT, 't-full.png'), fullPage: true });
        report.runs.tablet.hOverflow = await overflow(p);
        await c.close();
        // 5. phone
        c = await ctx(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true);
        p = await c.newPage(); hook(p, 'mobile');
        await p.goto(URL, { waitUntil: 'load' }); await sleep(3500); await p.screenshot({ path: path.join(OUT, 'm-first.png') });
        await walk(p); await p.screenshot({ path: path.join(OUT, 'm-full.png'), fullPage: true });
        report.runs.mobile.hOverflow = await overflow(p);
        await c.close();
        // 6. 320 phone
        c = await ctx(browser, { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true);
        p = await c.newPage(); hook(p, 'small');
        await p.goto(URL, { waitUntil: 'load' }); await sleep(3000); await walk(p);
        await p.screenshot({ path: path.join(OUT, 's320-full.png'), fullPage: true });
        report.runs.small.hOverflow = await overflow(p);
        await c.close();
        // 7. reduced motion
        c = await ctx(browser, { viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }, false);
        p = await c.newPage(); hook(p, 'reduced');
        await p.goto(URL, { waitUntil: 'load' }); await sleep(800);
        await p.screenshot({ path: path.join(OUT, 'rm-full.png'), fullPage: true });
        await c.close();
        // 8. no JS
        c = await ctx(browser, { viewport: { width: 1280, height: 800 }, javaScriptEnabled: false }, false);
        p = await c.newPage(); hook(p, 'nojs');
        await p.goto(URL, { waitUntil: 'load' }); await sleep(2000);
        await p.screenshot({ path: path.join(OUT, 'nojs-full.png'), fullPage: true });
        await c.close();
    } finally {
        await browser.close();
        fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
    }
})();
