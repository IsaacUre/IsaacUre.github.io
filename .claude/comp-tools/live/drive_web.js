/* Drives the rest of the live web in the pixel Chrome of /comp/ and /tcomp/:
   the results page, Chrome's error pages, the frame for any other site.
   usage: node drive_web.js <shots dir> [comp|tcomp] */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[3];
const results = [];
const check = (n, c) => { results.push([n, !!c]); if (!c) console.log('  FAIL', n); };
const INVENTED = /museum|the real|fetched|● live|Fetching|pixels|Related searches|real web|Searching|Answered without|Code · GitHub|Discussion · Hacker|More from Wikipedia|Read the full article|Full forecast|From isaacure\.com|sideways|honest|in a window|refuse to be framed|Open in a real tab|Play the dino|Go back|tiny, curated|ERR_NAME_NOT_RESOLVED_ |actually/i;
const txt = (h, sel) => h.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' ').trim()).catch(() => '');
const has = (h, sel) => h.$(sel).then(e => !!e).catch(() => false);
const cors = { 'access-control-allow-origin': '*' };
function mock(mode, log) {
  return async route => {
    const u = new URL(route.request().url()), p = u.pathname, host = u.host, q = u.searchParams;
    log.push(u.href);
    const json = (body, status) => route.fulfill({ status: status || 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    if (mode.offline) return route.abort('internetdisconnected');
    if (mode.netfail && host === 'en.wikipedia.org') return route.abort('timedout');
    if (host === 'en.wikipedia.org' && p === '/w/api.php') {
      if (mode.wiki500) return json({ error: 'x' }, 500);
      if (q.get('list') === 'search') return json({ batchcomplete: true, query: { searchinfo: { totalhits: 2, suggestion: null }, search: [
        { ns: 0, title: 'Harness topic', pageid: 1, snippet: 'A <span class="searchmatch">harness</span> topic, made up for the checks', size: 100, wordcount: 10, timestamp: '2026-10-01T00:00:00Z' },
        { ns: 0, title: 'Harness topic two', pageid: 2, snippet: 'Another <span class="searchmatch">harness</span> page', size: 100, wordcount: 10, timestamp: '2026-10-01T00:00:00Z' }] } });
      return json({ batchcomplete: true, query: {} });
    }
    if (host === 'en.wikipedia.org' && /^\/api\/rest_v1\/page\/summary\//.test(p)) return json({ type: 'standard', title: 'Harness topic', description: 'a fixture', extract: 'A harness topic is a made-up subject for the checks.', wikibase_item: null });
    if (host === 'api.github.com' && p === '/search/repositories') return json({ total_count: 1, items: [{ full_name: 'octocat/harness', html_url: 'https://github.com/octocat/harness', description: 'A made-up repository', stargazers_count: 42, language: 'JavaScript' }] });
    if (host === 'hn.algolia.com') return json({ hits: [{ objectID: '1001', title: 'Harness story: a made-up headline', url: 'https://example.com/fixtures/1', points: 13, author: 'fixture_user', num_comments: 7, created_at_i: Math.floor(Date.now() / 1000) - 3600 }] });
    if (host === 'api.stackexchange.com') return json({ items: [] });
    if (host === 'commons.wikimedia.org') return json({ query: {} });
    if (host === 'api.dictionaryapi.dev') return json([], 404);
    if (host === 'geocoding-api.open-meteo.com') return json({ results: [{ name: 'Houston', admin1: 'Texas', latitude: 29.76, longitude: -95.36, country: 'United States' }] });
    if (host === 'api.open-meteo.com') return json({ current: { temperature_2m: 71, weather_code: 2, relative_humidity_2m: 60, wind_speed_10m: 8 } });
    if (host === 'example.com' || host === 'www.example.com' || host === 'open-meteo.com') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stand-in</title><p id="standin">the site, in a window</p>' });
    return route.abort('blockedbyclient');
  };
}
async function openAt(browser, base, url, mode) {
  mode = mode || {};
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const log = [], errors = [], net = { busy: 0, last: Date.now() };
  page.on('console', m => { if (m.type() === 'error' && !/favicon|fonts\.g|ERR_INTERNET|ERR_FAILED|ERR_TUNNEL|ERR_PROXY|ERR_NAME|ERR_BLOCKED|net::|status of 404|status of 500|Blocked script execution/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  const track = h => async route => { net.busy++; net.last = Date.now(); try { await h(route); } finally { net.busy--; net.last = Date.now(); } };
  await page.route(u => !/^localhost(:|$)/.test(u.host), track(mock(mode, log)));
  await page.goto(base + '?dev=cr:' + encodeURIComponent(url) + '&_=' + Date.now());
  await page.waitForSelector('.tb-btn.app');
  if (mode.offline) { await ctx.setOffline(true); await page.evaluate(() => { const w = document.querySelector('.win[data-app="chrome"]'); if (w) w.classList.add('maxi'); }); await page.click('#crUrl'); await page.fill('#crUrl', url); await page.keyboard.press('Enter'); }   // the machine goes offline, then the page is asked for again
  await page.evaluate(() => { const w = document.querySelector('.win[data-app="chrome"]'); if (w) w.classList.add('maxi'); });
  await page.waitForTimeout(300);
  return { ctx, page, log, errors, net };
}
async function settle(X, ms) {
  const t0 = Date.now(); await X.page.waitForTimeout(250);
  while (Date.now() - t0 < (ms || 10000)) { if (!X.net.busy && Date.now() - X.net.last > 500) break; await X.page.waitForTimeout(100); }
  await X.page.waitForTimeout(150);
}
const nav = async (page, u) => { await page.click('#crUrl'); await page.waitForTimeout(60); await page.fill('#crUrl', u); await page.keyboard.press('Enter'); await page.waitForTimeout(400); };
const url = page => page.$eval('#crUrl', e => e.value);
const title = page => txt(page, '.cr-tab.on .cr-tabt');
async function clean(X, label) {
  const t = await X.page.$eval('#crView', e => (e.innerText || e.textContent).replace(/\s+/g, ' ')).catch(() => '');
  const m = t.match(INVENTED);
  check(label + ' shows nothing the real page would not' + (m ? ' (found "' + m[0] + '")' : ''), !m);
}
async function run(browser, base, tag) {
  console.log('==', tag);
  // A. the results page
  let A = await openAt(browser, base, 'google.com/search?q=harness', {});
  await settle(A);
  check(tag + ' A results: title, the query in the box, no chip, no status line, no related searches', (await title(A.page)) === 'harness - Google Search' && (await A.page.$eval('.cr-serpq', e => e.value)) === 'harness' && !(await has(A.page, '.cr-lvchip')) && !(await has(A.page, '.cr-serpstat')) && !(await has(A.page, '.cr-relwrap')));
  check(tag + ' A the sources\' results, without source labels, forums under Google\'s own name', await A.page.$$eval('.cr-res', l => l.length >= 3) && await A.page.$$eval('.cr-serph', l => l.map(x => x.textContent.trim()).join('|') === 'Discussions and forums') && (await txt(A.page, '#crSerpWiki .cr-restitle')) === 'Harness topic two' && (await txt(A.page, '.cr-serpfeat .cr-featt')) === 'Harness topic' && (await txt(A.page, '.cr-serpfeat .cr-featsrc')) === 'Wikipedia');
  check(tag + ' A the knowledge panel ends in a plain Wikipedia link', (await txt(A.page, '.cr-kp .cr-kpmore')) === 'Wikipedia');
  await A.page.screenshot({ path: OUT + '/' + tag + '-serp.png' });
  await clean(A, tag + ' A');
  await nav(A.page, 'google.com/search?q=weather+houston'); await settle(A);
  check(tag + ' A the weather card: Open-Meteo\'s words for the code, its name as the source', /Partly cloudy/.test(await txt(A.page, '.cr-wxans .cr-anssub')) && (await txt(A.page, '.cr-wxans .cr-kpmore')) === 'Open-Meteo' && !/Full forecast/.test(await txt(A.page, '#crView')));
  await A.page.click('.cr-wxans .cr-kpmore'); await A.page.waitForTimeout(700);
  check(tag + ' A Open-Meteo opens as the site itself, in a frame, with nothing above it', (await url(A.page)) === 'open-meteo.com' && await A.page.$eval('#crView', v => v.children.length === 1 && v.firstElementChild.className === 'cr-frame' && v.querySelectorAll('iframe').length === 1 && /^https:\/\/open-meteo\.com/.test(v.querySelector('iframe').getAttribute('src'))) && !(await has(A.page, '.cr-framebar')));
  await clean(A, tag + ' A frame');
  await A.ctx.close();
  // B. Chrome's error pages
  let B = await openAt(browser, base, 'chrome://nothing', {});
  await settle(B);
  check(tag + ' B an address Chrome has no page for: its own page for it', (await txt(B.page, '.cr-neterror h1')) === 'This site can’t be reached' && (await txt(B.page, '.cr-neterror #main-message > p')) === 'The webpage at chrome://nothing/ might be temporarily down or it may have moved permanently to a new web address.' && (await txt(B.page, '.cr-neterror .error-code')) === 'ERR_INVALID_URL' && (await txt(B.page, '.cr-neterror #reload-button')) === 'Reload' && !(await has(B.page, '.cr-neterror #details-button')));
  check(tag + ' B the icon is Chrome\'s network picture', await B.page.$eval('.cr-neterror .icon', i => /data:image\/png;base64,/.test(getComputedStyle(i).backgroundImage) && i.getBoundingClientRect().width === 72));
  await B.page.screenshot({ path: OUT + '/' + tag + '-err-invalid.png' });
  await clean(B, tag + ' B');
  await B.ctx.close();
  let T = await openAt(browser, base, 'en.wikipedia.org/wiki/Anything', { netfail: true });
  await settle(T, 12000);
  check(tag + ' T a site that does not answer: Chrome\'s timed-out page', (await txt(T.page, '.cr-neterror h1')) === 'This site can’t be reached' && (await txt(T.page, '.cr-neterror #main-message > p')) === 'en.wikipedia.org took too long to respond.' && await T.page.$$eval('.cr-neterror #suggestions-list li', l => l.map(x => x.textContent.trim()).join('|') === 'Checking the connection|Checking the proxy and the firewall|Running Windows Network Diagnostics') && (await txt(T.page, '.cr-neterror .error-code')) === 'ERR_CONNECTION_TIMED_OUT' && (await txt(T.page, '.cr-neterror #details-button')) === 'Details' && (await title(T.page)) === 'en.wikipedia.org/wiki/Anything');
  await T.page.click('.cr-neterror #details-button'); await T.page.waitForTimeout(100);
  check(tag + ' T Details opens the suggestions and hides the message', await T.page.$eval('.cr-neterror #main-frame-error', f => f.classList.contains('showing-details')) && await T.page.$$eval('.cr-neterror #details .suggestion-header', l => l.map(x => x.textContent).join('|') === 'Check your Internet connection|If you use a proxy server...') && (await txt(T.page, '.cr-neterror #details-button')) === 'Hide details' && await T.page.$eval('.cr-neterror #main-content', m => m.getBoundingClientRect().height === 0));
  await T.page.screenshot({ path: OUT + '/' + tag + '-err-details.png' });
  await T.page.click('.cr-neterror #details-button'); await T.page.waitForTimeout(100);
  await T.page.screenshot({ path: OUT + '/' + tag + '-err-timeout.png' });
  await clean(T, tag + ' T');
  await nav(T.page, 'en.wikipedia.org/wiki/Other'); await settle(T, 12000);
  await T.ctx.close();
  let H5 = await openAt(browser, base, 'en.wikipedia.org/wiki/Anything', { wiki500: true });
  await settle(H5);
  check(tag + ' H a server that errors with no page of its own: HTTP ERROR 500', (await txt(H5.page, '.cr-neterror h1')) === 'This page isn’t working' && (await txt(H5.page, '.cr-neterror #main-message > p')) === 'en.wikipedia.org is currently unable to handle this request.' && (await txt(H5.page, '.cr-neterror .error-code')) === 'HTTP ERROR 500' && !(await has(H5.page, '.cr-neterror #suggestions-list')));
  await H5.page.screenshot({ path: OUT + '/' + tag + '-err-http.png' });
  await H5.ctx.close();
  let C = await openAt(browser, base, 'en.wikipedia.org/wiki/Anything', { offline: true });
  await settle(C);
  check(tag + ' C offline: No internet, the dinosaur, no Reload', (await txt(C.page, '.cr-neterror h1')) === 'No internet' && await C.page.$$eval('.cr-neterror #suggestions-list li', l => l.map(x => x.textContent.trim()).join('|') === 'Checking the network cables, modem, and router|Reconnecting to Wi-Fi|Running Windows Network Diagnostics') && (await txt(C.page, '.cr-neterror .error-code')) === 'ERR_INTERNET_DISCONNECTED' && await C.page.$eval('.cr-neterror #control-buttons', b => b.hidden) && await C.page.$eval('.cr-neterror .icon', i => i.classList.contains('icon-offline')));
  await C.page.screenshot({ path: OUT + '/' + tag + '-err-offline.png' });
  await C.page.keyboard.press('Space'); await C.page.waitForTimeout(300);
  check(tag + ' C Space starts the runner on the error page, the address unchanged', !!(await C.page.$('#crView #crDinoCv')) && (await url(C.page)) === 'en.wikipedia.org/wiki/Anything');
  await clean(C, tag + ' C');
  await C.ctx.close();
  let D = await openAt(browser, base, 'google.com/search?q=harness', { wiki500: true });
  await settle(D);
  check(tag + ' D a source that errors adds nothing to the results page', !(await has(D.page, '#crSerpWiki .cr-res')) && !(await has(D.page, '.cr-serpnote')) && !/500|Couldn’t reach|limit/.test(await txt(D.page, '#crView')));
  await nav(D.page, 'example.com/some/page'); await D.page.waitForTimeout(600);
  check(tag + ' D an unknown site: the frame alone, titled by its host', await D.page.$eval('#crView', v => v.children.length === 1 && v.querySelectorAll('iframe.cr-frameifr').length === 1 && v.querySelector('iframe').getAttribute('src') === 'https://example.com/some/page') && (await title(D.page)) === 'example.com');
  await clean(D, tag + ' D');
  const errs = [].concat(A.errors, B.errors, T.errors, H5.errors, C.errors, D.errors);
  check(tag + ' no page errors' + (errs.length ? ' (' + errs.slice(0, 3).join(' · ') + ')' : ''), !errs.length);
  await D.ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  for (const tag of ONLY ? [ONLY] : ['comp', 'tcomp']) await run(browser, 'http://localhost:8571/' + tag + '/', tag);
  await browser.close();
  const n = results.filter(r => r[1]).length;
  console.log(n + '/' + results.length + ' passed');
  process.exit(n === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
