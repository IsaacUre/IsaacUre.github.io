/* Screenshot + sanity harness for /test.
   Usage: node shoot.js <url> <outDir> [bootWaitMs=7000]
   Writes PNGs and report.json into outDir. Google Fonts (Press Start 2P, VT323)
   come from rig/fonts; the browser gets no other network. */
var pw = require('/opt/node22/lib/node_modules/playwright');
var fs = require('fs'), path = require('path');
var URL = process.argv[2], OUT = path.resolve(process.argv[3] || 'shots'), BOOT = +(process.argv[4] || 7000);
fs.mkdirSync(OUT, { recursive: true });
var report = { url: URL, runs: {} };
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

async function autoScroll(page) {          // walk the page so scroll-triggered reveals fire, then go back up
    var h = await page.evaluate(function () { return document.documentElement.scrollHeight; });
    var vh = await page.evaluate(function () { return innerHeight; });
    for (var y = 0; y <= h; y += Math.round(vh * 0.6)) { await page.evaluate(function (y) { scrollTo(0, y); }, y); await sleep(250); }
    await sleep(600);
    await page.evaluate(function () { scrollTo(0, 0); }); await sleep(400);
}
function hook(page, key) {
    report.runs[key] = { console: [], errors: [], failedRequests: [] };
    page.on('console', function (m) { if (m.type() === 'error' || m.type() === 'warning') report.runs[key].console.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', function (e) { report.runs[key].errors.push(String(e)); });
    page.on('requestfailed', function (r) { report.runs[key].failedRequests.push(r.url() + ' ' + (r.failure() && r.failure().errorText)); });
}

(async function () {
    var browser = await pw.chromium.launch();
    // Google Fonts are served from local copies (rig/fonts): Chromium here does not trust
    // the session proxy's CA, and TLS checks stay on, so the browser gets no network at all
    var FONTS = path.join(__dirname, 'fonts');
    var realNewContext = browser.newContext.bind(browser);
    browser.newContext = async function (opts) {
        var c = await realNewContext(opts);
        await c.route('https://fonts.googleapis.com/**', function (route) {
            route.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(FONTS, 'gf.css')) });
        });
        await c.route('https://fonts.gstatic.com/**', function (route) {
            var f = path.join(FONTS, route.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_'));
            if (fs.existsSync(f)) route.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } });
            else route.fulfill({ status: 404, body: '' });
        });
        await c.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, function (route) {
            var u = route.request().url();
            if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.fallback();
            route.abort();
        });
        return c;
    };
    try {
        // 1. desktop, first visit: boot frames, then the hero and the whole page
        var ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        var page = await ctx.newPage(); hook(page, 'desktop');
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        await sleep(900); await page.screenshot({ path: path.join(OUT, 'd-boot-0.9s.png') });
        await sleep(1300); await page.screenshot({ path: path.join(OUT, 'd-boot-2.2s.png') });
        await sleep(Math.max(0, BOOT - 2200)); await page.screenshot({ path: path.join(OUT, 'd-hero.png') });
        await autoScroll(page);
        await page.screenshot({ path: path.join(OUT, 'd-full.png'), fullPage: true });
        report.runs.desktop.docHeight = await page.evaluate(function () { return document.documentElement.scrollHeight; });
        report.runs.desktop.hOverflow = await page.evaluate(function () { return document.documentElement.scrollWidth > innerWidth; });
        // reload in the same session: does the boot replay?
        await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(700);
        await page.screenshot({ path: path.join(OUT, 'd-reload-0.7s.png') });
        await ctx.close();

        // 2. phone
        ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        page = await ctx.newPage(); hook(page, 'mobile');
        await page.goto(URL, { waitUntil: 'domcontentloaded' });
        await sleep(1500); await page.screenshot({ path: path.join(OUT, 'm-boot-1.5s.png') });
        await sleep(Math.max(0, BOOT - 1500)); await page.screenshot({ path: path.join(OUT, 'm-hero.png') });
        await autoScroll(page);
        await page.screenshot({ path: path.join(OUT, 'm-full.png'), fullPage: true });
        report.runs.mobile.hOverflow = await page.evaluate(function () { return document.documentElement.scrollWidth > innerWidth; });
        await ctx.close();

        // 3. small phone, 320 wide
        ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
        page = await ctx.newPage(); hook(page, 'small');
        await page.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(BOOT); await autoScroll(page);
        await page.screenshot({ path: path.join(OUT, 's320-full.png'), fullPage: true });
        report.runs.small.hOverflow = await page.evaluate(function () { return document.documentElement.scrollWidth > innerWidth; });
        await ctx.close();

        // 4. reduced motion: everything should land at once
        ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
        page = await ctx.newPage(); hook(page, 'reduced');
        await page.goto(URL, { waitUntil: 'load' }); await sleep(800);
        await page.screenshot({ path: path.join(OUT, 'rm-hero.png') });
        await page.screenshot({ path: path.join(OUT, 'rm-full.png'), fullPage: true });
        await ctx.close();

        // 5. no JS
        ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
        page = await ctx.newPage(); hook(page, 'nojs');
        await page.goto(URL, { waitUntil: 'load' }); await sleep(2500);
        await page.screenshot({ path: path.join(OUT, 'nojs-full.png'), fullPage: true });
        await ctx.close();

        // 6. keyboard: skip the boot with a key, then tab through and record where focus goes
        ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        page = await ctx.newPage(); hook(page, 'keyboard');
        await page.goto(URL, { waitUntil: 'domcontentloaded' }); await sleep(600);
        await page.keyboard.press('Space'); await sleep(2500);
        report.runs.keyboard.tabs = [];
        for (var i = 0; i < 14; i++) {
            await page.keyboard.press('Tab'); await sleep(120);
            report.runs.keyboard.tabs.push(await page.evaluate(function () {
                var a = document.activeElement; if (!a) return null;
                var r = a.getBoundingClientRect();
                return a.tagName + (a.id ? '#' + a.id : '') + ' "' + (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 40) + '" ' + (a.getAttribute('href') || '') + ' visible=' + (r.width > 0 && r.height > 0);
            }));
            if (i === 3) await page.screenshot({ path: path.join(OUT, 'kb-focus.png') });
        }
        await ctx.close();
    } finally {
        await browser.close();
        fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
        console.log(JSON.stringify(report, null, 2));
    }
})();
