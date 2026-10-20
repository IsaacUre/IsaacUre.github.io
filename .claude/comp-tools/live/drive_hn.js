/* Drives news.ycombinator.com in the pixel Chrome of /comp/ and /tcomp/ with
   real clicks and keys, against the made-up stories in data/hn.json.
   usage: node drive_hn.js <shots dir> [comp|tcomp] */
const { chromium } = require('playwright');
const fs = require('fs');
const { hnmock, D } = require('./hnmock.js');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[3];
const results = [];
const check = (n, c) => { results.push([n, !!c]); if (!c) console.log('  FAIL', n); };
const INVENTED = /museum|the real|fetched|● live|Fetching|pixels|orange site|confidently wrong|Trimmed at/i;
const txt = (h, sel) => h.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' ').trim()).catch(() => '');
const has = (h, sel) => h.$(sel).then(e => !!e).catch(() => false);
async function openAt(browser, base, url, mode) {
  mode = mode || {};
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const log = [], errors = [], net = { busy: 0, last: Date.now() };
  page.on('console', m => { if (m.type() === 'error' && !/favicon|fonts\.g|ERR_INTERNET|ERR_FAILED|ERR_TUNNEL|ERR_PROXY|ERR_NAME|ERR_BLOCKED|net::|status of 404|status of 500|Blocked script execution in 'about:srcdoc'/i.test(m.text())) errors.push(m.text()); });   // the last: Playwright's own click helper being refused by the scriptless frame
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  const track = h => async route => { net.busy++; net.last = Date.now(); try { await h(route); } finally { net.busy--; net.last = Date.now(); } };
  await page.route(u => /(^|\.)(ycombinator\.com|firebaseio\.com|algolia\.com)$/.test(u.host), track(hnmock(mode, log)));
  await page.route(u => !/^localhost(:|$)/.test(u.host) && !/(^|\.)(ycombinator\.com|firebaseio\.com|algolia\.com)$/.test(u.host), r => r.abort('blockedbyclient'));
  await page.clock.setFixedTime(new Date(D.now * 1000));
  await page.goto(base + '?dev=cr:' + encodeURIComponent(url) + '&_=' + Date.now());
  await page.waitForSelector('.tb-btn.app');
  await page.evaluate(() => { const w = document.querySelector('.win[data-app="chrome"]'); if (w) w.classList.add('maxi'); });
  await page.waitForTimeout(300);
  return { ctx, page, log, errors, net };
}
async function settle(X, ms) {
  const t0 = Date.now(); await X.page.waitForTimeout(250);
  while (Date.now() - t0 < (ms || 10000)) { if (!X.net.busy && Date.now() - X.net.last > 500) break; await X.page.waitForTimeout(100); }
  await X.page.waitForTimeout(150);
}
async function hn(X, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 8000)) {
    const el = await X.page.$('iframe.cr-wk');
    if (el) { const fr = await el.contentFrame(); if (fr && await fr.$('#hnmain')) { await X.page.waitForTimeout(120); return fr; } }
    await X.page.waitForTimeout(80);
  }
  return null;
}
const nav = async (page, u) => { await page.click('#crUrl'); await page.waitForTimeout(60); await page.fill('#crUrl', u); await page.keyboard.press('Enter'); await page.waitForTimeout(400); };
const url = page => page.$eval('#crUrl', e => e.value);
const title = page => txt(page, '.cr-tab.on .cr-tabt');
async function clean(X, fr, label) {
  const t1 = await X.page.$eval('#crView', e => (e.innerText || e.textContent).replace(/\s+/g, ' ')).catch(() => '');
  const t2 = fr ? await fr.$eval('body', e => (e.innerText || e.textContent).replace(/\s+/g, ' ')).catch(() => '') : '';
  const m = (t1 + ' ' + t2).match(INVENTED);
  check(label + ' shows nothing Hacker News does not' + (m ? ' (found "' + m[0] + '")' : ''), !m);
}
async function run(browser, base, tag) {
  console.log('==', tag);
  let A = await openAt(browser, base, 'news.ycombinator.com', {});
  let fr = await hn(A); await settle(A);
  check(tag + ' A the front page is drawn in its frame', !!fr);
  if (!fr) { await A.ctx.close(); return; }
  check(tag + ' A tab title and favicon', (await title(A.page)) === 'Hacker News' && (await A.page.$eval('.cr-tab.on img.cr-fav', i => i.getAttribute('src'))) === 'https://news.ycombinator.com/favicon.ico');
  check(tag + ' A the site\'s own stylesheet and logo', await fr.$eval('link[rel=stylesheet]', l => l.href === 'https://news.ycombinator.com/news.css') && await fr.$eval('.pagetop .hnname a', a => a.textContent === 'Hacker News') && await fr.$eval('html', h => h.getAttribute('op') === 'news'));
  check(tag + ' A the top bar: new, past, comments, ask, show, jobs, submit, login', await fr.$$eval('.pagetop a', l => l.map(a => a.textContent).join('|') === 'Hacker News|new|past|comments|ask|show|jobs|submit|login'));
  check(tag + ' A thirty stories in the API\'s order, ranked', await fr.$$eval('tr.athing.submission', l => l.length === 30 && l[0].id === '1001' && l[29].id === '1030' && l[0].querySelector('.rank').textContent === '1.' && l[29].querySelector('.rank').textContent === '30.'));
  check(tag + ' A a story row as the site writes it', await fr.$eval('tr[id="1001"]', tr => { const t = tr.querySelector('.titleline > a'), s = tr.querySelector('.sitebit.comhead .sitestr'); return t.textContent === 'Harness story 1: a made-up headline' && t.getAttribute('href') === 'https://example.com/fixtures/1' && s.textContent === 'example.com' && !!tr.querySelector('.votelinks .votearrow'); }));
  check(tag + ' A the subtext: points, by, age, hide, comments', (await txt(fr, 'tr[id="1001"] + tr .subtext')) === '13 points by fixture_user_1 1 hour ago | hide | 7 comments' && await fr.$eval('tr[id="1001"] + tr .subtext .age', a => a.getAttribute('title') === '2026-10-19T10:58:00 1792407480'));
  check(tag + ' A a GitHub link shows the account', (await txt(fr, 'tr[id="1002"] .sitestr')) === 'github.com/octocat');
  check(tag + ' A an Ask HN row has no site, a job row no arrow and no points', !(await has(fr, 'tr[id="1006"] .sitebit')) && (await fr.$eval('tr[id="1006"] .titleline > a', a => a.getAttribute('href'))) === 'item?id=1006' && !(await has(fr, 'tr[id="1010"] .votearrow')) && (await txt(fr, 'tr[id="1010"] + tr .subtext')) === '1 hour ago | hide');
  check(tag + ' A zero comments says discuss', (await txt(fr, 'tr[id="1020"] + tr .subtext .subline > a:last-child')) === 'discuss');
  check(tag + ' A More, and the footer links', (await fr.$eval('a.morelink', a => a.getAttribute('href'))) === 'news?p=2' && await fr.$$eval('.yclinks a', l => l.map(a => a.textContent).join('|') === 'Guidelines|FAQ|Lists|API|Security|Legal|Apply to YC|Contact'));
  await A.page.screenshot({ path: OUT + '/' + tag + '-hn-front.png' });
  await clean(A, fr, tag + ' A');
  await fr.click('a.morelink'); fr = await hn(A); await settle(A);
  check(tag + ' A page two: five more, ranked from 31', (await url(A.page)) === 'news.ycombinator.com/news?p=2' && !!fr && await fr.$$eval('tr.athing.submission', l => l.length === 5 && l[0].querySelector('.rank').textContent === '31.') && !(await has(fr, 'a.morelink')));
  await fr.click('tr[id="1031"] + tr .subtext a:last-child'); fr = await hn(A); await settle(A);
  check(tag + ' A a comments link opens the thread, or the real site for one the API lacks', /news\.ycombinator\.com\/item\?id=1031/.test(await url(A.page)));
  await A.ctx.close();
  // B. a thread
  let B = await openAt(browser, base, 'news.ycombinator.com/item?id=1001', {});
  fr = await hn(B); await settle(B);
  check(tag + ' B thread title and the fat item', (await title(B.page)) === 'Harness story 1: a made-up headline | Hacker News' && !!fr && await fr.$eval('table.fatitem tr.athing', tr => tr.id === '1001' && !tr.querySelector('.rank')) && (await txt(fr, 'table.fatitem .subtext')) === '13 points by fixture_user_1 1 hour ago | hide | 4 comments');
  check(tag + ' B four comments, nested by indent, the dead one left out', !!fr && await fr.$$eval('tr.comtr', l => l.length === 4 && l.map(x => x.querySelector('td.ind').getAttribute('indent')).join(',') === '0,1,2,0' && l[1].querySelector('td.ind img').getAttribute('width') === '40'));
  check(tag + ' B a comment as the site writes it', !!fr && (await txt(fr, 'tr[id="2001"] .comhead')) === 'fixture_user_2 50 minutes ago | next [–]' && await fr.$eval('tr[id="2001"] .commtext', c => c.classList.contains('c00') && c.querySelectorAll('p').length === 2 && c.querySelector('a').getAttribute('href') === 'https://example.com/x') && (await txt(fr, 'tr[id="2001"] .reply')) === 'reply');
  check(tag + ' B the reply form', !!fr && await fr.$eval('table.fatitem form textarea', t => t.getAttribute('rows') === '8' && t.getAttribute('cols') === '80') && (await fr.$eval('table.fatitem form input[type=submit]', i => i.value)) === 'add comment');
  await fr.click('tr[id="2001"] a.togg'); await B.page.waitForTimeout(150);
  check(tag + ' B collapsing hides the replies beneath', await fr.$eval('tr[id="2001"] a.togg', a => a.textContent === '[3 more]') && await fr.$eval('tr[id="2002"]', r => r.classList.contains('noshow')) && await fr.$eval('tr[id="2004"]', r => !r.classList.contains('noshow')));
  await fr.click('tr[id="2001"] a.togg'); await B.page.waitForTimeout(150);
  check(tag + ' B and opens them again', await fr.$eval('tr[id="2001"] a.togg', a => a.textContent === '[–]') && await fr.$eval('tr[id="2002"]', r => !r.classList.contains('noshow')));
  await B.page.screenshot({ path: OUT + '/' + tag + '-hn-item.png' });
  await clean(B, fr, tag + ' B');
  await fr.click('tr[id="2001"] .hnuser'); fr = await hn(B); await settle(B);
  check(tag + ' B a name goes to the real site when the API has no such user', /news\.ycombinator\.com\/user\?id=fixture_user_2/.test(await url(B.page)) && !!(await B.page.$('#crView .cr-neterror, #crView iframe')));
  await nav(B.page, 'news.ycombinator.com/user?id=fixture_user_1'); fr = await hn(B); await settle(B);
  check(tag + ' B a profile: user, created, karma, about, the three lists', (await title(B.page)) === 'Profile: fixture_user_1 | Hacker News' && !!fr && (await txt(fr, 'tr.athing .hnuser')) === 'fixture_user_1' && await fr.$eval('#hnmain tr.athing', tr => { const rows = Array.from(tr.parentElement.rows); return rows.map(r => r.cells[0].textContent.trim()).join('|') === 'user:|created:|karma:|about:|||' && /January 1, 2010/.test(rows[1].innerText) && /4321/.test(rows[2].innerText) && Array.from(tr.parentElement.querySelectorAll('a')).map(a => a.textContent).slice(-3).join('|') === 'submissions|comments|favorites'; }));
  await B.page.screenshot({ path: OUT + '/' + tag + '-hn-user.png' });
  await nav(B.page, 'news.ycombinator.com/ask'); fr = await hn(B); await settle(B);
  check(tag + ' B ask: the Ask HN stories, ask selected in the bar', (await title(B.page)) === 'Ask | Hacker News' && !!fr && await fr.$$eval('tr.athing.submission', l => l.length === 5) && (await txt(fr, '.pagetop .topsel')) === 'ask');
  await nav(B.page, 'news.ycombinator.com/jobs'); fr = await hn(B); await settle(B);
  check(tag + ' B jobs: one, with no points', (await title(B.page)) === 'Jobs | Hacker News' && !!fr && await fr.$$eval('tr.athing.submission', l => l.length === 1) && !(await has(fr, '.score')));
  await nav(B.page, 'news.ycombinator.com/front'); await B.page.waitForTimeout(700);
  check(tag + ' B a page this copy does not draw goes to the real site in a window', await B.page.$eval('.cr-frame iframe', f => /news\.ycombinator\.com\/front/.test(f.getAttribute('src'))).catch(() => false));
  await B.ctx.close();
  let C = await openAt(browser, base, 'news.ycombinator.com', { offline: true });
  await settle(C);
  check(tag + ' C offline: an error page', !!(await C.page.$('#crView .cr-neterror')) && !(await C.page.$('iframe.cr-wk')));
  const errs = [].concat(A.errors, B.errors, C.errors);
  check(tag + ' no page errors' + (errs.length ? ' (' + errs.slice(0, 3).join(' · ') + ')' : ''), !errs.length);
  await C.ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  for (const tag of ONLY ? [ONLY] : ['comp', 'tcomp']) await run(browser, 'http://localhost:8571/' + tag + '/', tag);
  await browser.close();
  const n = results.filter(r => r[1]).length;
  console.log(n + '/' + results.length + ' passed');
  process.exit(n === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
