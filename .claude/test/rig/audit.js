/* Accessibility audit: axe-core (WCAG 2.x A/AA) on a page after its boot, at two widths.
   Usage: node audit.js <url> [outJson]
   Fonts are served from rig/fonts like shoot.js; the browser has no other network. */
var pw = require('/opt/node22/lib/node_modules/playwright');
var fs = require('fs'), path = require('path');
var URL = process.argv[2], OUT = process.argv[3];
var AXE = fs.readFileSync(path.join(__dirname, 'node_modules/axe-core/axe.min.js'), 'utf8');
var FONTS = path.join(__dirname, 'fonts');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function routeFonts(c) {
    await c.route('https://fonts.googleapis.com/**', function (r) { r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(FONTS, 'gf.css')) }); });
    await c.route('https://fonts.gstatic.com/**', function (r) {
        var f = path.join(FONTS, r.request().url().replace('https://fonts.gstatic.com/', '').replace(/\//g, '_'));
        if (fs.existsSync(f)) r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f), headers: { 'Access-Control-Allow-Origin': '*' } });
        else r.fulfill({ status: 404, body: '' });
    });
    await c.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, function (r) { if (/fonts\.(googleapis|gstatic)\.com/.test(r.request().url())) return r.fallback(); r.abort(); });
}
(async function () {
    var browser = await pw.chromium.launch(), results = {};
    try {
        for (var vp of [{ width: 1280, height: 800 }, { width: 375, height: 740 }]) {
            var ctx = await browser.newContext({ viewport: vp }); await routeFonts(ctx);
            var page = await ctx.newPage();
            await page.goto(URL, { waitUntil: 'load' }); await sleep(500);
            await page.keyboard.press('x'); await sleep(3500);          // skip any boot, let the hero land
            var h = await page.evaluate(function () { return document.documentElement.scrollHeight; });
            for (var y = 0; y <= h; y += 400) { await page.evaluate(function (y) { scrollTo(0, y); }, y); await sleep(120); }
            await sleep(800);
            await page.addScriptTag({ content: AXE });
            var r = await page.evaluate(async function () {
                var res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
                return res.violations.map(function (v) {
                    return { id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 6).map(function (n) { return n.target.join(' ') + ' :: ' + (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 220); }) };
                });
            });
            results[vp.width + 'x' + vp.height] = r;
            await ctx.close();
        }
    } finally {
        await browser.close();
        var s = JSON.stringify(results, null, 2);
        if (OUT) fs.writeFileSync(OUT, s);
        console.log(s);
    }
})();
