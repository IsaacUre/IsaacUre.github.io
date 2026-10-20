/* Drives github.com/IsaacUre in the pixel Chrome with real clicks and keys.
   api.github.com, the calendar mirror and GitHub's asset host are answered by
   mocks shaped like the real responses; commits and PRs are this repo's real
   history (data/, made by gen_mock.py). The page's clock is pinned to just
   after the saved copy, so the expectations hold on any later day.
   usage: node drive.js <shots dir> [comp|tcomp]   (README.md has the rest) */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[3];
const DATA = process.env.GHP_DATA || __dirname + '/data';
const SNAP = JSON.parse(fs.readFileSync(DATA + '/ghsnap.json'));
const MD = JSON.parse(fs.readFileSync(DATA + '/mockdata.json'));
const NOW0 = Date.parse(SNAP.asOf) + 3 * 3600000;   // the page's clock: three hours after the saved copy, unless a scenario sets its own
const results = [];
const check = (n, c) => { results.push([n, !!c]); if (!c) console.log('  FAIL', n); };
const FIRST = SNAP.month, FIRSTNAME = new Date(FIRST + '-15T12:00:00Z').toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });   // the month the feed opens on
const HEAD = SNAP.total + ' contributions in the last year';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
// words github.com never shows, which an earlier build of this page did
const INVENTED = /Live from|saved copy|copy saved|did not (answer|load)|Try again|hourly limit|Open on GitHub|Asking GitHub|● live|the real|Loading 20\d\d/i;

function jogLast() {
  const out = [], M = SNAP.max; let d = new Date(SNAP.start + 'T00:00:00Z');
  SNAP.counts.forEach(c => { out.push({ date: d.toISOString().slice(0, 10), count: c, level: c ? Math.ceil(4 * c / M) : 0 }); d.setUTCDate(d.getUTCDate() + 1); });
  return { total: { lastYear: SNAP.total }, contributions: out };
}
function jogYear(y) {                    // github.com on 2026-10-19: one contribution in 2022 (January 28th), none in 2023, 2024 or 2025
  const out = []; let d = new Date(y + '-01-01T00:00:00Z'), total = 0;
  while (d.getUTCFullYear() === +y) { const day = d.toISOString().slice(0, 10), c = day === '2022-01-28' ? 1 : 0; total += c; out.push({ date: day, count: c, level: c ? 4 : 0 }); d.setUTCDate(d.getUTCDate() + 1); }
  return { total: { [y]: total }, contributions: out };
}
const USER = { login: 'IsaacUre', id: 98616888, avatar_url: 'https://avatars.githubusercontent.com/u/98616888?v=4', type: 'User', name: null, company: null, blog: '', location: null, email: null, hireable: null, bio: null, twitter_username: null, public_repos: 2, public_gists: 0, followers: 0, following: 0, created_at: '2022-01-28T20:01:53Z', updated_at: '2026-06-17T19:59:31Z' };
const REPOS = [
  { name: 'IsaacUre.github.io', full_name: 'IsaacUre/IsaacUre.github.io', private: false, visibility: 'public', fork: false, description: 'Website', language: 'JavaScript', stargazers_count: 0, forks_count: 0, license: null, archived: false, is_template: false, mirror_url: null, pushed_at: SNAP.repoPushed, created_at: '2026-04-01T21:39:53Z', updated_at: SNAP.repoPushed },
  { name: 'Background-Auto-Sync-for-Anki-Addon', full_name: 'IsaacUre/Background-Auto-Sync-for-Anki-Addon', private: false, visibility: 'public', fork: true, description: 'This addon will automatically synchronize your collection with AnkiWeb', language: 'Python', stargazers_count: 0, forks_count: 0, license: { key: 'gpl-3.0', name: 'GNU General Public License v3.0', spdx_id: 'GPL-3.0' }, archived: false, is_template: false, mirror_url: null, pushed_at: '2026-09-01T19:34:14Z', created_at: '2026-09-01T19:30:00Z', updated_at: '2026-09-01T19:34:14Z' },
  { name: 'secret-decoy-repo', full_name: 'IsaacUre/secret-decoy-repo', private: true, visibility: 'private', fork: false, description: 'MUST NOT RENDER', language: 'C', stargazers_count: 9, forks_count: 0, license: null, archived: false, pushed_at: '2026-09-20T00:00:00Z', created_at: '2026-09-02T00:00:00Z' }
];
// the live participation answers: a week newer than the saved copy's line, so a test can tell them apart
const SPARK_SITE = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 44, 15, 11, 3, 0, 0, 0, 0, 0, 0, 1, 17, 4, 8, 34, 10, 15, 0, 24, 16, 2, 0, 18, 0, 6, 14, 0, 0, 4, 9];
const SPARK_FORK = Array.from({ length: 52 }, (x, i) => i === 44 ? 3 : 0);
const savedSpark = tag => JSON.parse('[' + /spark: \{ 'IsaacUre\.github\.io': \[([\d,]+)\] \}/.exec(fs.readFileSync(__dirname + '/../../../' + tag + '/comp.js', 'utf8'))[1] + ']');   // the saved copy's line, read from the file
const sparkPts = w => { const max = Math.max(...w, 1); return w.map((v, i) => i * 3 + ',' + (1 + Math.round(26 * v / max))).join(' '); };
const OCT_COMMITS = [1, 2, 3].map(i => ({ sha: 'oct' + i, author: { login: 'IsaacUre' }, commit: { author: { date: '2026-10-0' + (i + 1) + 'T15:00:00Z' } } }));
const OCT_PRS = [{ number: 999, user: { login: 'IsaacUre' }, created_at: '2026-10-02T15:10:00Z', state: 'closed', merged_at: '2026-10-02T15:20:00Z' }];
const STARS = [
  { name: 'linux', full_name: 'torvalds/linux', owner: { login: 'torvalds' }, private: false, visibility: 'public', fork: false, description: 'Linux kernel source tree', language: 'C', stargazers_count: 250015, forks_count: 65534, pushed_at: '2026-09-24T10:00:00Z' },
  { name: 'some-fork', full_name: 'octo/some-fork', owner: { login: 'octo' }, private: false, visibility: 'public', fork: true, description: 'A fork', language: 'Python', stargazers_count: 3, forks_count: 0, pushed_at: '2026-01-01T00:00:00Z' }
];
function ghMock(mode, log) {
  return async route => {
    const u = new URL(route.request().url()), p = u.pathname, q = u.searchParams;
    log.push({ t: Date.now(), url: u.href, path: p });
    const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag, Link, X-RateLimit-Remaining, X-RateLimit-Reset', 'x-ratelimit-remaining': '42', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1800) };
    const json = (body, status) => route.fulfill({ status: status || 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    if (mode.delay) await new Promise(r => setTimeout(r, mode.delay));
    if (mode.offline) return route.abort('internetdisconnected');
    if (mode.limited) return route.fulfill({ status: 403, contentType: 'application/json', headers: Object.assign({}, cors, { 'x-ratelimit-remaining': '0' }), body: JSON.stringify({ message: 'API rate limit exceeded for 1.2.3.4.' }) });
    if (p === '/users/IsaacUre') return json(Object.assign({}, USER, mode.user || {}));
    if (p === '/users/IsaacUre/repos') {
      let list = mode.october ? REPOS.map((r, i) => i ? r : Object.assign({}, r, { pushed_at: '2026-10-04T15:00:00Z' })) : REPOS;
      if (mode.template) list = list.map((r, i) => i ? r : Object.assign({}, r, { is_template: true }));
      if (mode.rust) list = list.filter(r => !r.fork).concat([{ name: 'ferris', full_name: 'IsaacUre/ferris', private: false, visibility: 'public', fork: false, description: null, language: 'Rust', stargazers_count: 0, forks_count: 0, license: null, archived: false, is_template: false, mirror_url: null, pushed_at: '2026-08-01T00:00:00Z', created_at: '2026-08-01T00:00:00Z' }]);
      return json(list);
    }
    if (p === '/users/IsaacUre/orgs') return mode.failOrgs ? json({ message: 'Server Error' }, 500) : json([]);
    if (p === '/users/IsaacUre/starred') return mode.failStars ? json({ message: 'Bad Gateway' }, 502) : json(mode.stars || []);
    if (p === '/search/repositories' && q.get('per_page') === '30') {   // the Stars tab's search, which for someone with no stars covers every repository
      if (q.get('q') === 'zzzzqq') return json({ total_count: 0, incomplete_results: false, items: [] });
      return json({ total_count: 648025, incomplete_results: false, items: q.get('page') === '2' ? [STARS[1]] : STARS });
    }
    if (p === '/search/repositories') return json({ total_count: 0, incomplete_results: false, items: [] });   // the SERP's own GitHub box, not this page
    if (p === '/repos/IsaacUre/IsaacUre.github.io/stats/participation') return mode.spark202 ? json({}, 202) : json({ all: SPARK_SITE, owner: SPARK_SITE });
    if (p === '/repos/IsaacUre/Background-Auto-Sync-for-Anki-Addon/stats/participation') return mode.spark202 ? json({}, 202) : json({ all: SPARK_FORK, owner: SPARK_FORK.map(() => 0) });
    if (p === '/repos/IsaacUre/Background-Auto-Sync-for-Anki-Addon') return json(Object.assign({}, REPOS[1], { parent: { full_name: 'athulkrishna2015/Background-Auto-Sync-for-Anki-Addon' } }));
    if (p === '/repos/IsaacUre/IsaacUre.github.io') return json(Object.assign({}, REPOS[0], { owner: { login: 'IsaacUre' } }));
    if (p === '/repos/IsaacUre/IsaacUre.github.io/readme') return json({ content: Buffer.from('# IsaacUre.github.io\nWebsite').toString('base64') });
    if (p === '/repos/IsaacUre/IsaacUre.github.io/commits' && mode.failCommits) return json({ message: 'Bad Gateway' }, 502);
    if (p === '/repos/IsaacUre/IsaacUre.github.io/commits') {
      const since = q.get('since'), until = q.get('until'), page = +(q.get('page') || 1), per = +(q.get('per_page') || 30), who = (q.get('author') || '').toLowerCase();
      const src = mode.october ? OCT_COMMITS.slice().reverse().concat(MD.commits) : MD.commits;
      const all = src.filter(c => (!who || (c.author && c.author.login.toLowerCase() === who)) && (!since || c.commit.author.date >= since) && (!until || c.commit.author.date <= until));
      return json(all.slice((page - 1) * per, page * per));
    }
    if (p === '/repos/IsaacUre/IsaacUre.github.io/pulls') {
      const page = +(q.get('page') || 1), per = +(q.get('per_page') || 30), src = mode.october ? OCT_PRS.concat(MD.pulls) : MD.pulls;
      return json(src.slice((page - 1) * per, page * per));
    }
    if (p.indexOf('/repos/IsaacUre/IsaacUre.github.io/') === 0) return json([]);   // the repository page's other parts (drive_more.js checks those)
    return json({ message: 'Not Found' }, 404);
  };
}
function jogMock(mode, log) {
  return async route => {
    const u = new URL(route.request().url()); log.push({ t: Date.now(), url: u.href });
    const h = { 'access-control-allow-origin': '*' };
    const y = u.searchParams.get('y');
    if (mode.yearDelay && mode.yearDelay[y]) await new Promise(r => setTimeout(r, mode.yearDelay[y]));
    if (mode.jogDelay) await new Promise(r => setTimeout(r, mode.jogDelay));
    if (mode.offline || mode.jogDown) return route.fulfill({ status: 500, contentType: 'application/json', headers: h, body: '{"error":"Internal server error"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', headers: h, body: JSON.stringify(y === 'last' ? jogLast() : jogYear(y)) });
  };
}
async function openAt(browser, base, url, mode, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: opts.size || (opts.big ? { width: 1600, height: 1000 } : { width: 1440, height: 900 }), ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const log = [], jlog = [], errors = [], net = { busy: 0, last: Date.now() };
  page.on('console', m => { if (m.type() === 'error' && !/favicon|fonts\.g|ERR_INTERNET|ERR_FAILED|ERR_TUNNEL|ERR_PROXY|ERR_NAME|avatars\.githubusercontent|wikipedia|algolia|duckduckgo/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('response', r => { if (r.status() === 404) errors.push('404 ' + r.url()); });
  const track = h => async route => { net.busy++; net.last = Date.now(); try { await h(route); } finally { net.busy--; net.last = Date.now(); } };
  await page.route(/api\.github\.com/, track(ghMock(mode, log)));
  await page.route(/github-contributions-api\.jogruber\.de/, track(jogMock(mode, jlog)));
  await page.route(/github\.githubassets\.com/, r => mode.noAssets ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/avatars\.githubusercontent\.com/, r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5"><rect width="5" height="5" fill="#F0F0F0"/><rect x="1" y="1" width="3" height="1" fill="#686AD6"/><rect x="0" y="3" width="5" height="1" fill="#686AD6"/></svg>' }));
  await page.clock.setFixedTime(new Date(opts.clock || NOW0));
  if (opts.seed) await page.addInitScript(s => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('comp_ghp', s); sessionStorage.setItem('seeded', '1'); } } catch (e) {} }, opts.seed);
  await page.goto(base + '?dev=cr:' + encodeURIComponent(url) + '&_=' + Date.now());
  await page.waitForSelector('.tb-btn.app');
  await page.waitForSelector('.cr-ghp', { timeout: 8000 }).catch(() => {});
  return { ctx, page, log, jlog, errors, net };
}
const txt = (page, sel) => page.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' ').trim()).catch(() => '');
async function settle(X, ms) {           // until nothing has been asked or answered for 600 ms
  const t0 = Date.now(); await X.page.waitForTimeout(250);
  while (Date.now() - t0 < (ms || 10000)) { if (!X.net.busy && Date.now() - X.net.last > 600) break; await X.page.waitForTimeout(100); }
  await X.page.waitForTimeout(100);
}
async function clean(X, label) {          // no status line, and none of the words github.com never shows
  const t = await txt(X.page, '#crView'), m = t.match(INVENTED);
  check(label + ' shows nothing github.com does not' + (m ? ' (found "' + m[0] + '")' : ''), !m && !(await X.page.$('#ghpStatus')));
}
const nav = async (page, u) => { await page.click('#crUrl'); await page.waitForTimeout(60); await page.fill('#crUrl', u); await page.keyboard.press('Enter'); await page.waitForTimeout(500); };
const gh = log => log.map(l => l.path);
function aged(seed, ms, parts, base) {    // a copy of a saved record whose parts GitHub sent ms before base (default now)
  const j = JSON.parse(seed), t = (base || NOW0) - ms;
  (parts || Object.keys(j.at)).forEach(k => { j.at[k] = t; });
  if (!parts) Object.keys(j.act).forEach(k => { j.act[k].t = t; });
  return JSON.stringify(j);
}

async function run(browser, base, tag) {
  console.log('==', tag);
  // A. live, happy path
  let A = await openAt(browser, base, 'github.com/IsaacUre', {});
  let { page } = A;
  await settle(A);
  await clean(A, tag + ' A');
  check(tag + ' A header: the Octocat mark, no wordmark, named by aria-label', (await A.page.$eval('.ghp-logo', e => e.innerText.trim())) === '' && !!(await A.page.$('.ghp-logo svg')) && (await A.page.$eval('.ghp-logo', e => e.getAttribute('aria-label'))) === 'Homepage');
  check(tag + ' A footer mark named by aria-label, no hidden text for Find', (await A.page.$eval('.ghp-footmark', e => e.getAttribute('aria-label'))) === 'GitHub Homepage' && !/Homepage/.test(await txt(A.page, '#crView')));
  check(tag + ' A footer: the mark, then the copyright and the links', !!(await A.page.$('.ghp-footmark svg')) && /© 2026 GitHub, Inc\. Terms Privacy Security Status Community Docs Contact Manage cookies Do not share my personal information/.test(await txt(A.page, '.ghp-foot')));
  check(tag + ' A achievements are GitHub\'s pictures', (await A.page.$$eval('.ghp-badgeimg', e => e.map(x => x.getAttribute('src')))).join(' ') === 'https://github.githubassets.com/assets/pair-extraordinaire-gold-5335a3b8ae7d.png https://github.githubassets.com/assets/pull-shark-silver-0643f87ac9fd.png https://github.githubassets.com/assets/yolo-default-be0bbff04951.png'
    && (await A.page.$$eval('.ghp-side .ghp-tier', e => e.map(x => x.textContent))).join(',') === 'x4,x3' && !(await A.page.$('.ghp-nopic')));
  check(tag + ' A report link is GitHub\'s', (await A.page.$eval('.ghp-block-report a', a => a.getAttribute('href'))) === 'https://github.com/contact/report-abuse?report=IsaacUre+%28user%29');
  check(tag + ' A tab title', (await txt(page, '.cr-tab.on .cr-tabt')) === 'IsaacUre · GitHub');
  check(tag + ' A login shown, no invented name', (await txt(page, '.ghp-names')) === 'IsaacUre');
  check(tag + ' A avatar is the real URL', (await page.$eval('.ghp-av', e => e.getAttribute('src'))) === USER.avatar_url);
  check(tag + ' A avatar opens the full-size picture', (await page.$eval('.ghp-avlink', e => e.getAttribute('href'))) === USER.avatar_url);
  const backTo = async (pg, want) => (await pg.$eval('.ghp-signin', a => a.getAttribute('href'))) === 'https://github.com/login?return_to=' + want && (await pg.$eval('.ghp-follow', a => a.getAttribute('href'))) === 'https://github.com/login?return_to=' + want;
  check(tag + ' A Sign in and Follow come back to the overview', await backTo(page, 'https%3A%2F%2Fgithub.com%2FIsaacUre'));
  check(tag + ' A favicon is GitHub\'s mark', (await page.$eval('.cr-tab.on svg.cr-fav use', u => u.getAttribute('href'))) === '#ic-github');
  check(tag + ' A no followers line at 0/0', !(await page.$('.ghp-follows')));
  check(tag + ' A Follow button', /^Follow$/.test(await txt(page, '.ghp-follow')));
  check(tag + ' A achievements x3', (await page.$$('.ghp-side .ghp-ach')).length === 3);
  check(tag + ' A sidebar ends "Block or report user"', (await txt(page, '.ghp-block-report')) === 'Block or report user' && !(await txt(page, '#ghpSide')).includes('Block or report IsaacUre'));
  check(tag + ' A block/report is 14px medium', await page.$eval('.ghp-block-report', e => { const s = getComputedStyle(e); return s.fontSize === '14px' && s.fontWeight === '500'; }));
  check(tag + ' A Repositories counter 2, no Stars counter at 0', /Repositories\s*2/.test(await txt(page, '#ghpTabs')) && !/Stars\s*\d/.test(await txt(page, '#ghpTabs')));
  const cards = await page.$$eval('.ghp-card', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
  check(tag + ' A two popular cards', cards.length === 2);
  check(tag + ' A card 1 = site repo, JavaScript, Website', /IsaacUre\.github\.io Public Website JavaScript/.test(cards[0] || ''));
  check(tag + ' A fork card shows parent', /Forked from athulkrishna2015\/Background-Auto-Sync-for-Anki-Addon/.test(cards[1] || ''));
  check(tag + ' A private decoy never renders', !(await page.content()).includes('secret-decoy') && !(await page.content()).includes('MUST NOT RENDER'));
  check(tag + ' A calendar heading ' + SNAP.total, (await txt(page, '.ghp-calh')) === HEAD);
  const cells = await page.$$eval('.ghp-day', els => els.length);
  check(tag + ' A calendar has one cell per day (' + cells + ')', cells === SNAP.counts.length);
  const cols = await page.$eval('.ghp-calgrid tbody tr', tr => tr.children.length - 1);
  check(tag + ' A 53 week columns (' + cols + ')', cols === 53);
  const monthLabels = await page.$$eval('.ghp-monl span[aria-hidden]', e => e.map(x => x.textContent));
  check(tag + ' A month labels Oct..Oct (' + monthLabels.join(',') + ')', monthLabels[0] === 'Oct' && monthLabels[monthLabels.length - 1] === 'Oct' && monthLabels.length === 13);
  const busiest = await page.$eval('.ghp-day[data-tip^="37 contributions"]', e => [e.getAttribute('data-level'), e.getAttribute('data-tip')]).catch(() => null);
  check(tag + ' A busiest day Aug 6 at level 4', busiest && busiest[0] === '4' && /August 6th/.test(busiest[1]));
  const legend = await page.$$eval('.ghp-lsq', e => e.map(x => x.style.backgroundColor));
  const cellPal = await page.$eval('.ghp-day[data-level="4"]', e => e.style.backgroundColor);
  check(tag + ' A legend uses the cells\' palette', legend.length === 5 && legend[4] === cellPal);
  await page.hover('.ghp-day[data-tip^="37 contributions"]'); await page.waitForTimeout(150);
  check(tag + ' A tooltip on hover', /37 contributions on August 6th\./.test(await txt(page, '#ghpTip')) && !(await page.$eval('#ghpTip', e => e.hidden)));
  // the tooltip stays inside the page at the right edge
  const lastCell = await page.$$eval('.ghp-calgrid tbody tr:nth-child(5) td.ghp-day', els => els.length);
  await page.hover('.ghp-calgrid tbody tr:nth-child(5) td.ghp-day >> nth=' + (lastCell - 1)); await page.waitForTimeout(150);
  const tipBox = await page.evaluate(() => { const t = document.querySelector('#ghpTip').getBoundingClientRect(), r = document.querySelector('.cr-ghp').getBoundingClientRect(), v = document.querySelector('#crView'); return { tr: t.right, rr: r.right, sw: v.scrollWidth, cw: v.clientWidth }; });
  check(tag + ' A right-edge tooltip stays inside (' + JSON.stringify(tipBox) + ')', tipBox.tr <= tipBox.rr + 0.5 && tipBox.sw <= tipBox.cw);
  const act = await txt(page, '#ghpAct');
  check(tag + ' A activity month header', new RegExp('Contribution activity ' + FIRSTNAME).test(act));
  check(tag + ' A activity commits line (' + act.slice(30, 110) + ')', new RegExp('Created ' + SNAP.monthCommits + ' commits in 1 repository').test(act));
  check(tag + ' A activity PR line', new RegExp('Opened ' + SNAP.monthPRs + ' pull requests in 1 repository').test(act) && /merged/.test(act));
  check(tag + ' A calendar mirror used, 0 GitHub commit scans for the year', A.jlog.length === 1 && !A.log.some(l => /commits\?/.test(l.url) && /since=2025/.test(l.url)));
  check(tag + ' A GitHub requests on a fresh load <= 7 (' + gh(A.log).join(' ') + ')', A.log.length <= 7);
  check(tag + ' A commit window widened past the month (until +31d)', A.log.some(l => /commits\?/.test(l.url) && /until=2026-11-19/.test(l.url)));
  await page.screenshot({ path: OUT + '/' + tag + '-overview.png' });
  await page.$eval('#crView', v => v.scrollTop = 520); await page.waitForTimeout(100);
  await page.screenshot({ path: OUT + '/' + tag + '-overview-cal.png' });
  // I. show more activity -> August
  await page.click('.ghp-more'); await page.waitForTimeout(700);
  const act2 = await txt(page, '#ghpAct');
  check(tag + ' I show more adds September 2026', /September 2026 Created 38 commits in 1 repository/.test(act2));
  await page.click('.ghp-more'); await page.waitForTimeout(700);
  check(tag + ' I and then August 2026', /August 2026 Created 42 commits in 1 repository/.test(await txt(page, '#ghpAct')));
  // E. tabs
  await page.click('.ghp-tab:has-text("Repositories")'); await page.waitForTimeout(500);
  check(tag + ' E repositories URL keeps ?tab', (await page.$eval('#crUrl', e => e.value)).includes('tab=repositories'));
  check(tag + ' E repositories tab title', (await txt(page, '.cr-tab.on .cr-tabt')) === 'IsaacUre / Repositories · GitHub');
  const items = await page.$$eval('.ghp-ritem', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
  check(tag + ' E two repos listed', items.length === 2);
  check(tag + ' E no Star buttons on the rows', !(await page.$('.ghp-ritem .ghp-btn')) && !items.some(s => /\bStar\b/.test(s)));
  check(tag + ' E fork row has license + updated (' + (items[1] || '').slice(-40) + ')', /GNU General Public License v3\.0/.test(items[1] || '') && /Updated (\d+ weeks? ago|last week|last month|on Sep 1)/.test(items[1] || ''));
  check(tag + ' E site row: Updated 2 days ago (Oct 18 07:56Z, clock Oct 19 23:06Z)', /Updated 2 days ago/.test(items[0] || ''));
  check(tag + ' E Sign in and Follow come back to ?tab=repositories', await backTo(page, 'https%3A%2F%2Fgithub.com%2FIsaacUre%3Ftab%3Drepositories'));
  await settle(A);
  const lines = await page.$$eval('.ghp-ritem', els => els.map(e => { const p = e.querySelector('.ghp-rside svg.ghp-spark polyline'); return p ? p.getAttribute('points') : null; }));
  check(tag + ' E each row has its past-year line, from the live answer', lines[0] === sparkPts(SPARK_SITE) && lines[1] === sparkPts(SPARK_FORK) && gh(A.log).filter(x => /stats\/participation$/.test(x)).length === 2);
  check(tag + ' E the lines\' ids are unique', await page.evaluate(() => { const ids = [...document.querySelectorAll('.ghp-spark [id]')].map(e => e.id); return ids.length === 4 && new Set(ids).size === 4; }));
  await page.fill('#ghpRepoBar .ghp-rq', 'anki'); await page.waitForTimeout(150);
  check(tag + ' E filter narrows to the fork', (await page.$$('.ghp-ritem')).length === 1 && /1 result for repositories matching anki/.test(await txt(page, '.ghp-results')));
  await page.fill('#ghpRepoBar .ghp-rq', 'zzzzqq'); await page.waitForTimeout(150);
  check(tag + ' E no match: GitHub\'s words, curly apostrophe', /IsaacUre doesn’t have any repositories that match\.$/.test(await txt(page, '#ghpRepoList')));
  await page.click('.ghp-clear'); await page.waitForTimeout(150);
  check(tag + ' E clear filter restores 2', (await page.$$('.ghp-ritem')).length === 2);
  await page.click('.ghp-menu:has-text("Type") > summary'); await page.click('.ghp-mopt[data-v="forks"]'); await page.waitForTimeout(150);
  check(tag + ' E Type: Forks', (await page.$$('.ghp-ritem')).length === 1 && /1 result for forked repositories/.test(await txt(page, '.ghp-results')));
  await page.click('.ghp-menu:has-text("Sort") > summary'); await page.waitForTimeout(100);
  check(tag + ' E Sort menu header is "Select order"', (await txt(page, '.ghp-menu[open] .ghp-menuh')) === 'Select order');
  await page.keyboard.press('Escape'); await page.click('.ghp-main', { position: { x: 5, y: 5 } }).catch(() => {});
  await page.screenshot({ path: OUT + '/' + tag + '-repos.png' });
  await page.click('.ghp-tab:has-text("Stars")'); await page.waitForTimeout(600);
  const stars = await txt(page, '#ghpStars');
  check(tag + ' E stars empty state + Lists (1)', /IsaacUre doesn’t have any starred repositories yet\./.test(stars) && /Lists \(1\)/.test(stars));
  check(tag + ' E stars tab title "Starred"', (await txt(page, '.cr-tab.on .cr-tabt')) === 'IsaacUre / Starred · GitHub');
  check(tag + ' E stars controls (Type: All, Sort by: Recently starred, search)', /Type: All/.test(stars) && /Sort by: Recently starred/.test(stars) && !!(await page.$('#ghpStarBar input[type="search"]')));
  check(tag + ' E list card has no "0 repositories"', (await txt(page, '.ghp-listcard')) === 'old');
  await page.click('.ghp-listhead .ghp-menu > summary'); await page.waitForTimeout(100);
  check(tag + ' E Lists sort menu', (await txt(page, '.ghp-listhead .ghp-menu[open] .ghp-menuh')) === 'Sort by' && /Name ascending \(A-Z\).*Last updated/.test(await txt(page, '.ghp-listhead .ghp-menubox')));
  await page.click('.ghp-main h2:has-text("Stars")'); await page.waitForTimeout(80);
  await page.screenshot({ path: OUT + '/' + tag + '-stars.png' });
  // the star list and the achievements open here, as their own pages
  await page.click('.ghp-listcard'); await page.waitForTimeout(400);
  check(tag + ' L star list page', (await page.$eval('#crUrl', e => e.value)) === 'github.com/stars/IsaacUre/lists/old' && (await txt(page, '.cr-tab.on .cr-tabt')) === "IsaacUre's list / old · GitHub"
    && (await txt(page, '.ghp-main')) === 'Stars old Nothing starred yet' && (await txt(page, '.ghp-tab.on')) === 'Stars');
  check(tag + ' L Sign in and Follow come back to the list', await backTo(page, 'https%3A%2F%2Fgithub.com%2Fstars%2FIsaacUre%2Flists%2Fold'));
  await page.click('.ghp-crumb'); await page.waitForTimeout(400);
  check(tag + ' L its Stars link goes back', (await page.$eval('#crUrl', e => e.value)) === 'github.com/IsaacUre?tab=stars');
  await page.click('.ghp-side .ghp-hlink'); await page.waitForTimeout(400);
  check(tag + ' L achievements tab', (await page.$eval('#crUrl', e => e.value)) === 'github.com/IsaacUre?tab=achievements' && (await txt(page, '.cr-tab.on .cr-tabt')) === 'IsaacUre / Achievements · GitHub'
    && (await txt(page, '.ghp-main')) === 'Earned achievements Pair Extraordinaire x4 Pull Shark x3 YOLO' && (await page.$$('.ghp-achcard .ghp-badgeimg')).length === 3);
  check(tag + ' L Sign in and Follow come back to the achievements', await backTo(page, 'https%3A%2F%2Fgithub.com%2FIsaacUre%3Ftab%3Dachievements'));
  await page.screenshot({ path: OUT + '/' + tag + '-achievements.png' });
  await page.click('.ghp-side .ghp-ach >> nth=1'); await page.waitForTimeout(400);
  check(tag + ' L a badge opens its achievement', (await page.$eval('#crUrl', e => e.value)) === 'github.com/IsaacUre?achievement=pull-shark&tab=achievements' && !!(await page.$('.ghp-achgrid')));
  await page.click('.ghp-tab:has-text("Projects")'); await page.waitForTimeout(300);
  check(tag + ' E projects: the count, then the empty state (' + (await txt(page, '.ghp-main')) + ')', (await txt(page, '.ghp-main')) === "Search results 0 open and 0 closed projects found. There aren't any projects yet" && (await txt(page, '.cr-tab.on .cr-tabt')) === 'IsaacUre / Projects · GitHub');
  await page.click('.ghp-tab:has-text("Packages")'); await page.waitForTimeout(300);
  const pk = await txt(page, '.ghp-main');
  const regLinks = await page.$$eval('.ghp-regs a', e => e.map(a => a.getAttribute('href')));
  check(tag + ' E packages: heading, Choose a registry, 5 cards', /Get started with GitHub Packages/.test(pk) && /Choose a registry/.test(pk) && (await page.$$('.ghp-regs li')).length === 5 && /Apache Maven.*NuGet.*RubyGems.*npm.*Containers/.test(pk));
  check(tag + ' E packages: each Learn more goes to its registry doc', regLinks.length === 5 && regLinks.every(h => /^https:\/\/docs\.github\.com\/packages\/working-with-a-github-packages-registry\/working-with-the-[a-z-]+-registry$/.test(h)));
  await page.screenshot({ path: OUT + '/' + tag + '-packages.png' });
  await page.click('.ghp-tab:has-text("Overview")'); await page.waitForTimeout(400);
  check(tag + ' E overview again', (await page.$eval('#crUrl', e => e.value)) === 'github.com/IsaacUre');
  // routing: typed ?tab lands here; followers/following; a double slash; a repo path goes to the live repo page
  await nav(page, 'github.com/isaacure?tab=stars');
  check(tag + ' E typed ?tab=stars lands on this page', !!(await page.$('.cr-ghp #ghpStars')));
  await nav(page, 'github.com/IsaacUre?tab=followers');
  check(tag + ' E ?tab=followers: empty state + title + no tab selected', /IsaacUre doesn’t have any followers yet\. Learn more about being social on GitHub\./.test(await txt(page, '#ghpSocial')) && (await txt(page, '.cr-tab.on .cr-tabt')) === 'IsaacUre / Followers · GitHub' && !(await page.$('.ghp-tab.on')));
  await nav(page, 'github.com/IsaacUre?tab=following');
  check(tag + ' E ?tab=following: empty state', /IsaacUre isn’t following anybody\. Learn more about being social on GitHub\./.test(await txt(page, '#ghpSocial')) && (await page.$eval('#ghpSocial a', a => a.textContent)) === 'Learn more');
  await nav(page, 'github.com//IsaacUre');
  check(tag + ' E github.com//IsaacUre lands on this page', !!(await page.$('.cr-ghp #ghpCal')));
  await nav(page, 'google.com/search?q=isaacure');
  check(tag + ' E search result description from the live count', /IsaacUre has 2 repositories available\. Follow their code on GitHub\./.test(await txt(page, '#crView')));
  await nav(page, 'github.com/IsaacUre/IsaacUre.github.io');
  check(tag + ' E repo path goes to the repository page', !!(await page.$('.cr-ghp.ghx')) && !(await page.$('#ghpCal')));
  await settle(A); await clean(A, tag + ' E the repo page');
  check(tag + ' E the repo page\'s title is GitHub\'s', (await txt(page, '.cr-tab.on .cr-tabt')) === 'GitHub - IsaacUre/IsaacUre.github.io: Website · GitHub');
  await nav(page, 'github.com'); await settle(A); await clean(A, tag + ' E github.com');
  check(tag + ' A-E no console errors ' + JSON.stringify(A.errors), A.errors.length === 0);
  // G. persistence: a reload within the TTL spends nothing
  const seed = await page.evaluate(() => localStorage.getItem('comp_ghp'));
  const sj = seed && JSON.parse(seed);
  check(tag + ' G live answer saved, every part stamped', !!sj && sj.v === 1 && ['user', 'repos', 'orgs', 'cal', 'stars'].every(k => sj.at[k] > 0) && sj.act['2026-10'].t > 0 && sj.act['2026-09'].t > 0 && sj.act['2026-08'].t > 0);
  check(tag + ' G saved record names no private repo', !seed.includes('secret-decoy'));
  await A.ctx.close();
  let G = await openAt(browser, base, 'github.com/IsaacUre', {}, { seed });
  await G.page.waitForTimeout(1500);
  check(tag + ' G reload within TTL: 0 GitHub requests (' + gh(G.log).join(' ') + ')', G.log.length === 0 && G.jlog.length === 0);
  check(tag + ' G reload still draws ' + SNAP.total, (await txt(G.page, '.ghp-calh')) === HEAD);
  await G.page.click('.ghp-more'); await G.page.waitForTimeout(400);
  check(tag + ' G a fresh September costs nothing either', /September 2026/.test(await txt(G.page, '#ghpAct')) && G.log.length === 0);
  await G.ctx.close();

  // S. an old save, offline: drawn as it is, with nothing said about it; online only the stale part is refetched
  let S = await openAt(browser, base, 'github.com/IsaacUre', { offline: true }, { seed, clock: new Date(NOW0 + 2 * 86400000).toISOString() });
  await settle(S);
  await clean(S, tag + ' S old save offline:');
  check(tag + ' S old save offline: its calendar and months still shown', (await txt(S.page, '.ghp-calh')) === HEAD && new RegExp('^Contribution activity ' + FIRSTNAME).test(await txt(S.page, '#ghpAct')) && !/no activity/.test(await txt(S.page, '#ghpAct')));
  await S.ctx.close();
  const half = aged(seed, 20 * 60000, ['orgs']);
  let S2 = await openAt(browser, base, 'github.com/IsaacUre', {}, { seed: half });
  await settle(S2);
  check(tag + ' S only the stale part is asked for (' + gh(S2.log).join(' ') + ')', S2.log.length === 1 && S2.log[0].path === '/users/IsaacUre/orgs');
  await S2.ctx.close();

  // P. one part fails: nothing said about it, saved with its own time, and only that part is retried
  let P = await openAt(browser, base, 'github.com/IsaacUre', { failOrgs: true, user: { public_repos: 3 } });
  await settle(P);
  await clean(P, tag + ' P partial:');
  const pseed = await P.page.evaluate(() => localStorage.getItem('comp_ghp'));
  const pj = JSON.parse(pseed);
  check(tag + ' P saved with the parts that did load, orgs unstamped', pj.at.user > 0 && pj.at.repos > 0 && pj.at.cal > 0 && !pj.at.orgs);
  await nav(P.page, 'google.com/search?q=isaacure');
  check(tag + ' P search description follows the live count (3)', /IsaacUre has 3 repositories available/.test(await txt(P.page, '#crView')));
  await P.ctx.close();
  let P2 = await openAt(browser, base, 'github.com/IsaacUre', {}, { seed: pseed });
  await settle(P2);
  check(tag + ' P next view asks only for orgs (' + gh(P2.log).join(' ') + ')', P2.log.length === 1 && P2.log[0].path === '/users/IsaacUre/orgs');
  await P2.ctx.close();

  // X. tampered and malformed saves: nothing runs, nothing breaks
  const now = NOW0, at = { user: now, repos: now, orgs: now, cal: now, stars: now };
  const evil = JSON.stringify({ v: 1, at, user: { login: 'IsaacUre', name: '<img src=x onerror="window.__pwned=1">', bio: '<script>window.__pwned=3</script>', avatar_url: 'javascript:alert(1)' },
    repos: [{ name: 'IsaacUre.github.io', description: '<img src=x onerror="window.__pwned=4">', pushed_at: '"><img src=x onerror=window.__pwned=5>' }, { name: '../../evil' }],
    orgs: [{ login: 'x"><img src=x>', avatar_url: 'https://evil.example/a.png' }], stars: 'nope', parents: { constructor: 'a/b', 'IsaacUre.github.io': '<b>' },
    cal: { src: 'github', start: '2025-09-21', counts: [1, 2, 3], levels: ['"><img src=x onerror="window.__pwned=2">', 9, -3] },
    act: { '2026-09': { commits: { 'IsaacUre/IsaacUre.github.io': '<b>9</b>', '<img>': 3 }, prs: 'x', created: ['<img src=x>'], t: now }, '__proto__': { t: now }, 'bad': {} },
    spark: { 'IsaacUre.github.io': { w: Array(52).fill('"><img src=x onerror="window.__pwned=6">'), t: now }, '<img src=x>': { w: Array(52).fill(1), t: now }, 'Background-Auto-Sync-for-Anki-Addon': { w: [1, 2], t: now } } });
  let X = await openAt(browser, base, 'github.com/IsaacUre', { offline: true }, { seed: evil });
  await X.page.waitForTimeout(1200);
  const xv = await X.page.evaluate(() => ({ pw: window.__pwned, imgs: document.querySelectorAll('#crView img[src="x"]').length, lv: [...document.querySelectorAll('.ghp-day')].map(e => e.getAttribute('data-level')), av: document.querySelector('.ghp-av').getAttribute('src'), nm: document.querySelector('.ghp-fullname') && document.querySelector('.ghp-fullname').textContent }));
  check(tag + ' X tampered save runs nothing (' + JSON.stringify({ pw: xv.pw, imgs: xv.imgs }) + ')', xv.pw === undefined && xv.imgs === 0);
  check(tag + ' X levels clamped to 0..4 (' + xv.lv.join(',') + ')', xv.lv.length === 3 && xv.lv.every(l => /^[0-4]$/.test(l)));
  check(tag + ' X avatar falls back to GitHub\'s, name shown as text', xv.av === USER.avatar_url && /^<img src=x/.test(xv.nm || ''));
  check(tag + ' X no page errors ' + JSON.stringify(X.errors), X.errors.filter(e => /PAGEERROR/.test(e)).length === 0);
  await X.ctx.close();
  let X3 = await openAt(browser, base, 'github.com/IsaacUre?tab=repositories', { offline: true }, { seed: evil });
  await X3.page.waitForTimeout(1200);
  const x3 = await X3.page.evaluate(() => ({ pw: window.__pwned, imgs: document.querySelectorAll('#crView img[src="x"]').length, pts: [...document.querySelectorAll('.ghp-spark polyline')].map(p => p.getAttribute('points')) }));
  check(tag + ' X3 a tampered line draws flat, runs nothing; a short one is dropped (' + JSON.stringify({ pw: x3.pw, imgs: x3.imgs, n: x3.pts.length }) + ')', x3.pw === undefined && x3.imgs === 0 && x3.pts.length === 1 && x3.pts[0] === sparkPts(Array(52).fill(0)));
  await X3.ctx.close();
  const junk = JSON.stringify({ v: 1, at: { cal: now, user: now + 365 * 86400000, repos: 'soon' }, cal: { start: 5, counts: 'nope' }, user: { login: 'someoneelse' }, repos: 'x', act: 7 });
  let X2 = await openAt(browser, base, 'github.com/IsaacUre', {}, { seed: junk });
  await settle(X2);
  check(tag + ' X malformed save: page draws', (await txt(X2.page, '.ghp-calh')) === HEAD);
  check(tag + ' X a stamp from the future is not believed: profile refetched', gh(X2.log).includes('/users/IsaacUre'));
  check(tag + ' X2 no page errors ' + JSON.stringify(X2.errors), X2.errors.filter(e => /PAGEERROR/.test(e)).length === 0);
  await X2.ctx.close();

  // Z. a repo that has since gone private: named in an old save, gone once the live list lands, and dropped from the save
  const zj = JSON.parse(seed); zj.at.repos = NOW0 - 2 * 3600000;
  zj.repos.push({ name: 'secret-decoy-repo', fork: false, description: 'MUST NOT RENDER', language: 'C', stargazers_count: 9, forks_count: 0, pushed_at: '2026-09-20T00:00:00Z', created_at: '2026-09-02T00:00:00Z' });
  zj.act[FIRST].commits['IsaacUre/secret-decoy-repo'] = 5; zj.act[FIRST].t = NOW0;
  let Z = await openAt(browser, base, 'github.com/IsaacUre', {}, { seed: JSON.stringify(zj) });
  await settle(Z); await Z.page.waitForTimeout(300);
  check(tag + ' Z now-private repo gone from the page', !(await Z.page.content()).includes('secret-decoy') && new RegExp('Created ' + SNAP.monthCommits + ' commits in 1 repository').test(await txt(Z.page, '#ghpAct')));
  check(tag + ' Z ...and from the save', !(await Z.page.evaluate(() => localStorage.getItem('comp_ghp'))).includes('secret-decoy'));
  await Z.ctx.close();

  // O. October: the live month heads the feed, and September is fetched when asked for
  let O = await openAt(browser, base, 'github.com/IsaacUre', { october: true }, { clock: '2026-10-05T17:00:00Z' });
  await settle(O);
  const oa = await txt(O.page, '#ghpAct');
  check(tag + ' O October heads the feed (' + oa.slice(0, 90) + ')', /^Contribution activity October 2026 Created 3 commits in 1 repository/.test(oa) && /Opened 1 pull request in 1 repository/.test(oa));
  await O.page.click('.ghp-more'); await O.page.waitForTimeout(800);
  const oa2 = await txt(O.page, '#ghpAct');
  check(tag + ' O Show more fetches September live', /September 2026 Created 38 commits in 1 repository/.test(oa2) && O.log.some(l => /commits\?/.test(l.url) && /since=2026-08-31/.test(l.url)));
  await O.ctx.close();
  let O2 = await openAt(browser, base, 'github.com/IsaacUre', { offline: true }, { clock: '2026-11-03T17:00:00Z' });
  await settle(O2);
  const o2 = await txt(O2.page, '#ghpAct');
  check(tag + ' O offline in November: the saved October, not "no activity"', /^Contribution activity October 2026 Created 4 commits/.test(o2) && !/no activity/.test(o2));
  await O2.page.click('.ghp-more'); await O2.page.waitForTimeout(600);
  const o3 = await txt(O2.page, '#ghpAct');
  check(tag + ' O offline Show more: the saved September, said as it is (' + o3.slice(-80) + ')', /September 2026 Created 38 commits/.test(o3) && !!(await O2.page.$('.ghp-more:not([disabled])')));
  await clean(O2, tag + ' O offline:');
  await O2.ctx.close();

  // B. calendar mirror down -> REST rebuild, and its months come with it
  let B = await openAt(browser, base, 'github.com/IsaacUre', { jogDown: true });
  await settle(B);
  await B.page.waitForTimeout(800);
  check(tag + ' B REST rebuild heading equals GitHub\'s ' + SNAP.total + ' (' + (await txt(B.page, '.ghp-calh')) + ')', (await txt(B.page, '.ghp-calh')) === HEAD);
  const bb = await B.page.$eval('.ghp-day[data-tip^="37 contributions"]', e => e.getAttribute('data-level')).catch(() => null);
  check(tag + ' B rebuilt busiest day level 4', bb === '4');
  check(tag + ' B activity still live', new RegExp('Created ' + SNAP.monthCommits + ' commits').test(await txt(B.page, '#ghpAct')));
  const bn = B.log.length;
  await B.page.click('.ghp-more'); await B.page.waitForTimeout(500);
  check(tag + ' B September comes from the rebuild, no new requests', /September 2026 Created 38 commits/.test(await txt(B.page, '#ghpAct')) && B.log.length === bn);
  const bErr = B.errors.filter(e => !/status of 500/.test(e));
  check(tag + ' B no console errors ' + JSON.stringify(bErr), bErr.length === 0);
  await B.ctx.close();

  // C. rate limited
  let C = await openAt(browser, base, 'github.com/IsaacUre', { limited: true });
  await settle(C);
  await clean(C, tag + ' C rate limited:');
  check(tag + ' C saved copy still drawn', (await txt(C.page, '.ghp-calh')) === HEAD && (await C.page.$$('.ghp-card')).length === 2);
  const beforeCount = C.log.length; await C.page.waitForTimeout(800);
  await C.page.click('.ghp-tab:has-text("Repositories")'); await C.page.waitForTimeout(500);
  check(tag + ' C stops asking GitHub, across views too (' + beforeCount + ' then ' + C.log.length + ')', C.log.length === beforeCount && beforeCount <= 4);
  const cl = await C.page.$$eval('.ghp-ritem .ghp-spark polyline', e => e.map(p => p.getAttribute('points')));
  check(tag + ' C the saved line, for the one repository the copy has it for', cl.length === 1 && cl[0] === sparkPts(savedSpark(tag)));
  await C.ctx.close();
  let C2 = await openAt(browser, base, 'github.com/IsaacUre', { limited: true });
  await settle(C2);
  for (let i = 0; i < 9; i++) { await C2.page.click('.ghp-more'); await C2.page.waitForTimeout(150); }
  const c2 = await C2.page.$$eval('.ghp-month', e => e.map(m => m.innerText.replace(/\s+/g, ' ').trim()));
  check(tag + ' C2 limited: Show more runs on through the calendar\'s empty months (' + c2.slice(-4).join(' | ') + ')', c2.length === 10 && /^April 2026 Created 24 commits in 1 repository/.test(c2[6])
    && c2[7] === 'March 2026 IsaacUre had no activity during this period.' && c2[9] === 'January 2026 IsaacUre had no activity during this period.' && !!(await C2.page.$('.ghp-more:not([disabled])')));
  await clean(C2, tag + ' C2');
  await C2.ctx.close();

  // D. offline
  let D = await openAt(browser, base, 'github.com/IsaacUre', { offline: true });
  await settle(D);
  await clean(D, tag + ' D offline:');
  check(tag + ' D offline: page complete', (await D.page.$$('.ghp-card')).length === 2 && (await D.page.$$('.ghp-day')).length === SNAP.counts.length);
  await D.ctx.close();

  // F. navigating away mid-fetch spends nothing more; Alt+F marks what a late answer draws
  let F = await openAt(browser, base, 'github.com/IsaacUre', { delay: 1200, user: { bio: 'a findable bio' } });
  await F.page.click('.ghp-h2'); await F.page.keyboard.press('Alt+f'); await F.page.waitForTimeout(150);
  await F.page.fill('.win[data-app="chrome"] .find-in', 'findable bio'); await F.page.waitForTimeout(150);
  const m0 = await F.page.$$eval('#crView mark.fnd', e => e.length);
  await settle(F); await F.page.waitForTimeout(100);
  const m1 = await F.page.$$eval('#crView mark.fnd', e => e.length);
  check(tag + ' F Alt+F re-runs after a live repaint (' + m0 + ' then ' + m1 + ')', m0 === 0 && m1 === 1);
  await F.page.keyboard.press('Escape');
  let F2 = await openAt(browser, base, 'github.com/IsaacUre', { delay: 1200 });
  await F2.page.waitForTimeout(300);
  await nav(F2.page, 'chrome://dino');
  const tNav = Date.now(); await F2.page.waitForTimeout(3500);
  const late = F2.log.filter(l => l.t > tNav + 50);
  check(tag + ' F no chained requests after leaving (' + late.map(l => l.path).join(' ') + ')', late.length === 0);
  await F.ctx.close(); await F2.ctx.close();

  // N. incognito: nothing saved, kept in that window's memory, gone when it closes
  let N = await openAt(browser, base, 'github.com/IsaacUre', {});
  await settle(N);
  await N.page.evaluate(() => localStorage.removeItem('comp_ghp'));
  await N.page.click('#crMore'); await N.page.waitForTimeout(150);
  const incogBtn = await N.page.$('[data-crm="incog"]');
  if (incogBtn) {
    await incogBtn.click(); await N.page.waitForTimeout(300);
    const n0 = N.log.length;
    await nav(N.page, 'github.com/IsaacUre');
    await settle(N); await N.page.waitForTimeout(300);
    const n1 = N.log.length;
    check(tag + ' N incognito: page works and asks GitHub (' + (n1 - n0) + ')', (await txt(N.page, '.ghp-calh')) === HEAD && n1 > n0);
    await N.page.click('.ghp-tab:has-text("Repositories")'); await N.page.waitForTimeout(500);
    await N.page.click('.ghp-tab:has-text("Overview")'); await N.page.waitForTimeout(500);
    const nl = gh(N.log.slice(n1));
    check(tag + ' N incognito: tab clicks cost nothing more than the Repositories tab\'s lines (' + nl.join(' ') + ')', nl.length === 2 && nl.every(x => /stats\/participation$/.test(x)));
    await N.page.click('.ghp-tab:has-text("Repositories")'); await N.page.waitForTimeout(400);
    check(tag + ' N incognito: tab title follows the tab', (await txt(N.page, '.cr-tab.on .cr-tabt')) === 'IsaacUre / Repositories · GitHub');
    check(tag + ' N incognito: nothing saved', (await N.page.evaluate(() => localStorage.getItem('comp_ghp'))) === null);
    await N.page.click('#crMore'); await N.page.waitForTimeout(150);
    await N.page.click('[data-crm="incog"]'); await N.page.waitForTimeout(300);
    await N.page.waitForTimeout(1500);                  // the regular tab comes back and saves its own answer; clear it again
    await N.page.evaluate(() => localStorage.removeItem('comp_ghp'));
    await N.page.click('#crMore'); await N.page.waitForTimeout(150);
    await N.page.click('[data-crm="incog"]'); await N.page.waitForTimeout(300);
    const n2 = N.log.length;
    await nav(N.page, 'github.com/IsaacUre'); await settle(N);
    check(tag + ' N a new incognito window starts empty: asks GitHub again (' + (N.log.length - n2) + ')', N.log.length > n2);
    check(tag + ' N ...and still saves nothing', (await N.page.evaluate(() => localStorage.getItem('comp_ghp'))) === null);
  } else check(tag + ' N incognito menu item found', false);
  await N.ctx.close();

  // T. somebody's stars: counter, search, type and sort
  let T = await openAt(browser, base, 'github.com/IsaacUre?tab=stars', { stars: STARS });
  await settle(T); await T.page.waitForTimeout(200);
  check(tag + ' T Stars counter 2', /Stars\s*2/.test(await txt(T.page, '#ghpTabs')));
  check(tag + ' T two starred rows, GitHub\'s order', (await T.page.$$eval('#ghpStarList .ghp-ritem', e => e.map(x => x.innerText.split('\n')[0]))).join('|').replace(/\s+/g, ' ') === 'torvalds / linux|octo / some-fork');
  await T.page.fill('#ghpStarBar .ghp-sq', 'kernel'); await T.page.waitForTimeout(150);
  check(tag + ' T search narrows and keeps focus', (await T.page.$$('#ghpStarList .ghp-ritem')).length === 1 && await T.page.evaluate(() => document.activeElement && document.activeElement.classList.contains('ghp-sq')));
  await T.page.fill('#ghpStarBar .ghp-sq', ''); await T.page.waitForTimeout(100);
  await T.page.click('#ghpStarBar .ghp-menu:has-text("Type") > summary'); await T.page.click('#ghpStarBar .ghp-mopt[data-v="forks"]'); await T.page.waitForTimeout(150);
  check(tag + ' T Type: Forks', (await T.page.$$('#ghpStarList .ghp-ritem')).length === 1 && /Type: Forks/.test(await txt(T.page, '#ghpStarBar')));
  await T.page.click('#ghpStarBar .ghp-menu:has-text("Type") > summary'); await T.page.click('#ghpStarBar .ghp-mopt[data-v="all"]');
  await T.page.click('#ghpStarBar .ghp-menu:has-text("Sort by") > summary'); await T.page.click('#ghpStarBar .ghp-mopt[data-v="updated"]'); await T.page.waitForTimeout(150);
  check(tag + ' T Sort by: Recently active', /Sort by: Recently active/.test(await txt(T.page, '#ghpStarBar')) && /^torvalds/.test(await txt(T.page, '#ghpStarList')));
  check(tag + ' T no console errors ' + JSON.stringify(T.errors), T.errors.length === 0);
  await T.ctx.close();

  // R. the second review's cases
  // R1: Show more after 16 minutes asks for the repo list again and loads the month; the line stays live
  const T0 = Date.parse('2026-09-25T15:00:00Z');
  let R1 = await openAt(browser, base, 'github.com/IsaacUre', {}, { clock: new Date(T0).toISOString() });
  await settle(R1);
  await R1.page.clock.setFixedTime(new Date(T0 + 16 * 60000));
  const r1n = R1.log.length;
  await R1.page.click('.ghp-more'); await R1.page.waitForTimeout(900);
  const r1 = await txt(R1.page, '#ghpAct');
  check(tag + ' R1 Show more after 16 min: repos asked again, August loads (' + gh(R1.log.slice(r1n)).join(' ') + ')', /August 2026 Created 42 commits/.test(r1) && gh(R1.log.slice(r1n)).includes('/users/IsaacUre/repos'));
  await clean(R1, tag + ' R1');
  await R1.ctx.close();
  // R2: a part that fails is the saved copy, drawn as it is
  let R2 = await openAt(browser, base, 'github.com/IsaacUre?tab=stars', { failStars: true });
  await settle(R2);
  check(tag + ' R2 Stars tab with /starred failing: the saved stars', /IsaacUre doesn’t have any starred repositories yet\./.test(await txt(R2.page, '#ghpStarList')));
  await clean(R2, tag + ' R2');
  await R2.ctx.close();
  let R2b = await openAt(browser, base, 'github.com/IsaacUre?tab=repositories', { jogDown: true, failCommits: true });
  await settle(R2b); await R2b.page.waitForTimeout(500);
  check(tag + ' R2 Repositories tab draws when the feed failed', (await R2b.page.$$('.ghp-ritem')).length === 2);
  await clean(R2b, tag + ' R2b');
  await R2b.ctx.close();
  // R3: a tab clicked mid-load waits for the same answers instead of asking again
  let R3 = await openAt(browser, base, 'github.com/IsaacUre', { delay: 700 });
  await R3.page.waitForTimeout(200);
  for (const t of ['Repositories', 'Overview', 'Repositories']) { await R3.page.click('.ghp-tab:has-text("' + t + '")'); await R3.page.waitForTimeout(250); }
  await settle(R3, 12000); await R3.page.waitForTimeout(800);
  const r3c = {}; gh(R3.log).forEach(x => { r3c[x] = (r3c[x] || 0) + 1; });
  check(tag + ' R3 no part asked twice during loading (' + JSON.stringify(r3c) + ')', ['/users/IsaacUre', '/users/IsaacUre/repos', '/users/IsaacUre/orgs', '/users/IsaacUre/starred'].every(k => r3c[k] === 1));
  await R3.ctx.close();
  // R4: a mirror that fails late does not make this month be asked twice
  let R4 = await openAt(browser, base, 'github.com/IsaacUre', { jogDown: true, jogDelay: 800 });
  await settle(R4, 12000); await R4.page.waitForTimeout(600);
  check(tag + ' R4 late mirror failure: no separate month scan (' + R4.log.filter(l => /commits\?/.test(l.url)).map(l => l.url.match(/since=([\d-]+)/)[1]).join(',') + ')', !R4.log.some(l => /commits\?/.test(l.url) && /since=2026-08-31/.test(l.url)) && (await txt(R4.page, '.ghp-calh')) === HEAD);
  await R4.ctx.close();
  // R5: saves whose values cannot be turned into text do not break the page, the search or the omnibox
  for (const bad of ['{"v":1,"at":{"user":{"toString":0}}}', JSON.stringify({ v: 1, at: { user: NOW0 }, user: { login: 'IsaacUre', name: { toString: 0 } } }), JSON.stringify({ v: 1, at: { cal: NOW0 }, cal: { start: { toString: 0 }, counts: [1] } })]) {
    let R5 = await openAt(browser, base, 'github.com/IsaacUre', { offline: true }, { seed: bad });
    await R5.page.waitForTimeout(900);
    const drawn = !!(await R5.page.$('.cr-ghp #ghpCal')), cleared = (await R5.page.evaluate(() => localStorage.getItem('comp_ghp'))) === 'null';
    await nav(R5.page, 'google.com/search?q=isaacure');
    const serp = /IsaacUre has 2 repositories available/.test(await txt(R5.page, '#crView'));
    check(tag + ' R5 unreadable save ' + bad.slice(0, 40) + ': page draws, save dropped, search works', drawn && cleared && serp && !R5.errors.some(e => /PAGEERROR/.test(e)));
    await R5.ctx.close();
  }
  // R6: a closed incognito window's answer does not reach the next one
  const r6mode = { user: { name: 'Window A Name', public_repos: 7 } };
  let R6 = await openAt(browser, base, 'google.com', r6mode);
  await R6.page.click('#crMore'); await R6.page.waitForTimeout(150); await R6.page.click('[data-crm="incog"]'); await R6.page.waitForTimeout(300);
  await nav(R6.page, 'github.com/IsaacUre'); await settle(R6);
  const r6a = await txt(R6.page, '.cr-tab.on .cr-tabt');
  await R6.page.click('#crMore'); await R6.page.waitForTimeout(150); await R6.page.click('[data-crm="incog"]'); await R6.page.waitForTimeout(300);
  r6mode.offline = true;
  await R6.page.click('#crMore'); await R6.page.waitForTimeout(150); await R6.page.click('[data-crm="incog"]'); await R6.page.waitForTimeout(300);
  await nav(R6.page, 'google.com/search?q=isaacure');
  const r6 = await txt(R6.page, '#crView');
  check(tag + ' R6 new incognito window: no trace of the last one (' + r6a + ')', r6a === 'IsaacUre (Window A Name) · GitHub' && !/Window A Name/.test(r6) && /IsaacUre has 2 repositories available/.test(r6));
  await R6.ctx.close();
  // R7: names in every title; template label; the Language menu follows the live list; Escape closes a menu
  let R7 = await openAt(browser, base, 'github.com/IsaacUre?tab=repositories', { user: { name: 'Isaac Ure' }, template: true, rust: true });
  await settle(R7); await R7.page.waitForTimeout(200);
  check(tag + ' R7 tab title keeps the name', (await txt(R7.page, '.cr-tab.on .cr-tabt')) === 'IsaacUre (Isaac Ure) / Repositories · GitHub');
  check(tag + ' R7 template repo labelled "Public template"', /IsaacUre\.github\.io Public template/.test(await txt(R7.page, '#ghpRepoList')));
  await R7.page.click('#ghpRepoBar .ghp-menu:has-text("Language") > summary'); await R7.page.waitForTimeout(100);
  const langs = await R7.page.$$eval('#ghpRepoBar .ghp-menu[open] .ghp-mopt', e => e.map(x => x.textContent));
  check(tag + ' R7 Language menu lists the live languages (' + langs.join(',') + ')', langs.join(',') === 'All,JavaScript,Rust');
  await R7.page.keyboard.press('Escape'); await R7.page.waitForTimeout(100);
  check(tag + ' R7 Escape closes the menu and focuses its button', !(await R7.page.$('.ghp-menu[open]')) && await R7.page.evaluate(() => document.activeElement && document.activeElement.tagName === 'SUMMARY'));
  await R7.ctx.close();
  // R8: Stars filter states, GitHub's words
  let R8 = await openAt(browser, base, 'github.com/IsaacUre?tab=stars', {});
  await settle(R8);
  await R8.page.click('#ghpStarBar .ghp-menu:has-text("Type") > summary'); await R8.page.click('#ghpStarBar .ghp-mopt[data-v="forks"]'); await R8.page.waitForTimeout(150);
  check(tag + ' R8 0 stars + Forks: GitHub\'s results and end lines (' + (await txt(R8.page, '#ghpStarList')) + ')', (await txt(R8.page, '#ghpStarList')) === "0 results for forked starred repositories Clear filter That's it. You've reached the end of IsaacUre's stars.");
  await R8.page.click('.ghp-sclear'); await R8.page.waitForTimeout(150);
  check(tag + ' R8 Clear filter goes back', (await txt(R8.page, '#ghpStarList')) === "IsaacUre doesn’t have any starred repositories yet." && /Type: All/.test(await txt(R8.page, '#ghpStarBar')));
  check(tag + ' R8 no Language menu with no stars', !/Language/.test(await txt(R8.page, '#ghpStarBar')));
  await R8.ctx.close();
  let R9 = await openAt(browser, base, 'github.com/IsaacUre?tab=stars', { stars: STARS });
  await settle(R9); await R9.page.waitForTimeout(200);
  await R9.page.fill('#ghpSq', 'zzz'); await R9.page.waitForTimeout(150);
  check(tag + ' R9 no match: "0 stars matching zzz" + end line', (await txt(R9.page, '#ghpStarList')) === "0 stars matching zzz Clear filter That's it. You've reached the end of IsaacUre's stars.");
  await R9.page.fill('#ghpSq', 'linux'); await R9.page.waitForTimeout(150);
  check(tag + ' R9 "1 star matching linux" above the row', /^1 star matching linux Clear filter torvalds \/ linux/.test(await txt(R9.page, '#ghpStarList')));
  await R9.page.fill('#ghpSq', ''); await R9.page.waitForTimeout(100);
  await R9.page.click('#ghpStarBar .ghp-menu:has-text("Language") > summary'); await R9.page.click('#ghpStarBar .ghp-mopt[data-v="C"]'); await R9.page.waitForTimeout(150);
  check(tag + ' R9 Language: C', /Language: C/.test(await txt(R9.page, '#ghpStarBar')) && /^1 star written in C Clear filter torvalds/.test(await txt(R9.page, '#ghpStarList')));
  await R9.ctx.close();
  // R10: with the find bar open, typing in a filter does not move the page
  let R10 = await openAt(browser, base, 'github.com/IsaacUre?tab=repositories', {});
  await settle(R10);
  await R10.page.click('.ghp-h2, #ghpRepoBar'); await R10.page.keyboard.press('Alt+f'); await R10.page.waitForTimeout(150);
  await R10.page.fill('.win[data-app="chrome"] .find-in', 'Manage cookies'); await R10.page.waitForTimeout(200);
  await R10.page.$eval('#crView', v => v.scrollTop = 0);
  await R10.page.click('#ghpRepoBar .ghp-rq'); await R10.page.keyboard.type('i'); await R10.page.waitForTimeout(200);
  const r10 = await R10.page.evaluate(() => ({ top: document.querySelector('#crView').scrollTop, focus: document.activeElement && document.activeElement.classList.contains('ghp-rq'), marks: document.querySelectorAll('#crView mark.fnd').length }));
  check(tag + ' R10 filter typing with find open keeps the page still (' + JSON.stringify(r10) + ')', r10.top === 0 && r10.focus && r10.marks >= 1);
  await R10.ctx.close();
  // R11: menus open inside a narrow view; the header fits at 1060
  let R11 = await openAt(browser, base, 'github.com/IsaacUre?tab=repositories', {}, { size: { width: 390, height: 844 } });
  await settle(R11);
  await R11.page.click('#ghpRepoBar .ghp-menu:has-text("Type") > summary'); await R11.page.waitForTimeout(150);
  const r11 = await R11.page.evaluate(() => { const b = document.querySelector('.ghp-menu[open] .ghp-menubox').getBoundingClientRect(), v = document.querySelector('#crView').getBoundingClientRect(); return { bl: Math.round(b.left), br: Math.round(b.right), vl: Math.round(v.left), vr: Math.round(v.right) }; });
  check(tag + ' R11 Type menu inside a phone-width view (' + JSON.stringify(r11) + ')', r11.bl >= r11.vl && r11.br <= r11.vr);
  check(tag + ' R11 no past-year line at phone width', await R11.page.$$eval('.ghp-rside', e => e.length > 0 && e.every(x => getComputedStyle(x).display === 'none')));
  await R11.ctx.close();
  let R12 = await openAt(browser, base, 'github.com/IsaacUre', {}, { size: { width: 1060, height: 900 } });
  await settle(R12);
  await R12.page.evaluate(() => { const w = document.querySelector('.win[data-app="chrome"]'); if (w) w.classList.add('maxi'); }); await R12.page.waitForTimeout(400);
  const r12 = await R12.page.$eval('#crView', v => [v.scrollWidth, v.clientWidth, getComputedStyle(v.querySelector('.ghp-search')).display]);
  check(tag + ' R12 desktop header fits at 1060 (' + r12.join(',') + ')', r12[2] === 'flex' && r12[0] <= r12[1]);
  await R12.ctx.close();

  // H. the year list at desktop width, and a late answer for a year no longer picked
  let H = await openAt(browser, base, 'github.com/IsaacUre', { yearDelay: { 2025: 1500 } }, { big: true });
  await settle(H);
  await H.page.evaluate(() => { const w = document.querySelector('.win[data-app="chrome"]'); if (w) w.classList.add('maxi'); });
  await H.page.waitForTimeout(400);
  check(tag + ' H year list visible when wide', await H.page.$eval('.ghp-years', e => getComputedStyle(e).display !== 'none'));
  const years = await H.page.$$eval('.ghp-year', e => e.map(x => x.textContent));
  check(tag + ' H years 2026..2022 (' + years.join(',') + ')', years.join(',') === '2026,2025,2024,2023,2022');
  check(tag + ' H desktop header shows the menus', await H.page.$eval('.ghp-mktg', e => getComputedStyle(e).display === 'flex'));
  await H.page.screenshot({ path: OUT + '/' + tag + '-wide.png' });
  await H.page.click('.ghp-year[data-year="2025"]'); await H.page.waitForTimeout(200);
  const hl = await txt(H.page, '#ghpCal');
  check(tag + ' H while 2025 loads: last year stays, nothing said', hl.indexOf(HEAD) === 0 && !/Loading/.test(hl) && (await txt(H.page, '.ghp-year.on')) === '2026');
  await H.page.click('.ghp-year[data-year="2024"]'); await H.page.waitForTimeout(400);
  check(tag + ' H 2024 view', (await txt(H.page, '.ghp-calh')) === '0 contributions in 2024' && (await txt(H.page, '.ghp-year.on')) === '2024');
  await H.page.waitForTimeout(1600);
  check(tag + ' H the late 2025 answer does not take over', (await txt(H.page, '.ghp-calh')) === '0 contributions in 2024' && (await txt(H.page, '.ghp-year.on')) === '2024');
  await H.page.click('.ghp-year[data-year="2025"]'); await H.page.waitForTimeout(300);
  check(tag + ' H 2025 view, from the kept answer', (await txt(H.page, '.ghp-calh')) === '0 contributions in 2025');
  await H.page.click('.ghp-year[data-year="2026"]'); await H.page.waitForTimeout(300);
  check(tag + ' H back to last year', (await txt(H.page, '.ghp-calh')) === HEAD);
  // the top-row tooltip opens below when there is no room above
  await H.page.$eval('#crView', v => { v.querySelector('.cr-ghp').style.paddingBottom = '2000px'; const c = v.querySelector('.ghp-calgrid'); v.scrollTop += c.getBoundingClientRect().top - v.getBoundingClientRect().top - 2; });
  await H.page.waitForTimeout(100);
  await H.page.hover('.ghp-calgrid tbody tr:nth-child(1) td.ghp-day >> nth=10'); await H.page.waitForTimeout(150);
  const tb = await H.page.evaluate(() => { const t = document.querySelector('#ghpTip'), v = document.querySelector('#crView').getBoundingClientRect(), g = document.querySelector('.ghp-calgrid').getBoundingClientRect(); return { below: t.classList.contains('ghp-tipb'), top: t.getBoundingClientRect().top, vtop: v.top, gtop: g.top }; });
  check(tag + ' H top-row tooltip opens below, inside the view (' + JSON.stringify(tb) + ')', tb.below && tb.top >= tb.vtop);
  check(tag + ' H no console errors ' + JSON.stringify(H.errors), H.errors.length === 0);
  await H.ctx.close();

  // M. back to the month the account was made: the calendar's one contribution there is in nothing public, so the feed ends before it
  let M = await openAt(browser, base, 'github.com/IsaacUre', {});
  await settle(M);
  for (let i = 0; i < 70 && await M.page.$('.ghp-more'); i++) { await M.page.click('.ghp-more'); await M.page.waitForTimeout(60); }
  const mm = await M.page.$$eval('.ghp-month', e => e.map(m => m.innerText.replace(/\s+/g, ' ').trim()));
  check(tag + ' M the feed ends at February 2022, no button (' + mm.length + ', ' + mm[mm.length - 1] + ')', mm.length === 57 && mm[mm.length - 1] === 'February 2022 IsaacUre had no activity during this period.' && !(await M.page.$('.ghp-more')) && !mm.some(x => /January 2022/.test(x)));
  check(tag + ' M no console errors ' + JSON.stringify(M.errors), M.errors.length === 0);
  await M.ctx.close();

  // H2. the calendar mirror down: a past year still switches, drawn as github.com drew it
  let H2 = await openAt(browser, base, 'github.com/IsaacUre', { jogDown: true }, { big: true });
  await settle(H2);
  await H2.page.evaluate(() => { const w = document.querySelector('.win[data-app="chrome"]'); if (w) w.classList.add('maxi'); }); await H2.page.waitForTimeout(400);
  await H2.page.click('.ghp-year[data-year="2025"]'); await settle(H2);
  check(tag + ' H2 mirror down: 2025 still switches', (await txt(H2.page, '.ghp-calh')) === '0 contributions in 2025' && (await txt(H2.page, '.ghp-year.on')) === '2025');
  await H2.page.click('.ghp-year[data-year="2022"]'); await settle(H2);
  check(tag + ' H2 mirror down: 2022 has its one contribution', (await txt(H2.page, '.ghp-calh')) === '1 contribution in 2022' && (await H2.page.$$('.ghp-day[data-tip="1 contribution on January 28th."]')).length === 1 && (await H2.page.$$('.ghp-day:not([data-level="0"])')).length === 1);
  await H2.page.click('.ghp-year[data-year="2026"]'); await H2.page.waitForTimeout(300);
  check(tag + ' H2 and back to the last year', (await txt(H2.page, '.ghp-calh')) === HEAD);
  await H2.ctx.close();
  let H3 = await openAt(browser, base, 'github.com/IsaacUre', {}, { big: true });
  await settle(H3);
  await H3.page.evaluate(() => { const w = document.querySelector('.win[data-app="chrome"]'); if (w) w.classList.add('maxi'); }); await H3.page.waitForTimeout(400);
  await H3.page.click('.ghp-year[data-year="2022"]'); await settle(H3);
  check(tag + ' H3 mirror up: 2022 from its answer', (await txt(H3.page, '.ghp-calh')) === '1 contribution in 2022' && H3.jlog.some(l => /y=2022/.test(l.url)));
  await H3.ctx.close();

  // Q. a search on the Stars tab of someone with no stars runs over every repository, as on github.com
  let Q = await openAt(browser, base, 'github.com/IsaacUre?tab=stars', {});
  await settle(Q);
  const q0 = Q.log.length;
  await Q.page.click('#ghpSq'); await Q.page.keyboard.type('kernel', { delay: 60 }); await settle(Q); await Q.page.waitForTimeout(300);
  const qs = Q.log.slice(q0).filter(l => l.path === '/search/repositories');
  check(tag + ' Q one search, after the last keystroke (' + qs.map(l => l.url.split('?')[1]).join(' ') + ')', qs.length === 1 && /[?&]q=kernel&per_page=30&page=1$/.test(qs[0].url));
  check(tag + ' Q GitHub\'s results line and rows (' + (await txt(Q.page, '#ghpStarList')).slice(0, 80) + ')', /^648025 stars matching kernel Clear filter torvalds \/ linux Linux kernel source tree/.test(await txt(Q.page, '#ghpStarList')) && (await Q.page.$$('#ghpStarList .ghp-ritem')).length === 2);
  check(tag + ' Q Previous off, Next on', (await txt(Q.page, '#ghpStarList .ghp-pager')) === 'Previous Next' && !(await Q.page.$('#ghpStarList .ghp-pager .ghp-sgpage[data-p="0"]')) && !!(await Q.page.$('#ghpStarList .ghp-pager .ghp-sgpage[data-p="2"]')));
  await Q.page.click('#ghpStarList .ghp-sgpage[data-p="2"]'); await settle(Q); await Q.page.waitForTimeout(200);
  check(tag + ' Q Next: page 2', Q.log.some(l => /q=kernel&per_page=30&page=2$/.test(l.url)) && (await Q.page.$$('#ghpStarList .ghp-ritem')).length === 1 && !!(await Q.page.$('#ghpStarList .ghp-sgpage[data-p="1"]')));
  await Q.page.click('#ghpStarBar .ghp-menu:has-text("Sort by") > summary'); await Q.page.click('#ghpStarBar .ghp-mopt[data-v="stars"]'); await settle(Q); await Q.page.waitForTimeout(200);
  check(tag + ' Q Sort by: Most stars asks again, sorted, from page 1', Q.log.some(l => /q=kernel&sort=stars&per_page=30&page=1$/.test(l.url)) && /^648025 stars matching kernel/.test(await txt(Q.page, '#ghpStarList')));
  await Q.page.click('.ghp-sclear'); await Q.page.waitForTimeout(200);
  check(tag + ' Q Clear filter: the empty state again', (await txt(Q.page, '#ghpStarList')) === 'IsaacUre doesn’t have any starred repositories yet.' && (await Q.page.$eval('#ghpSq', e => e.value)) === '');
  await Q.page.fill('#ghpSq', 'zzzzqq'); await settle(Q); await Q.page.waitForTimeout(300);
  check(tag + ' Q nothing anywhere: 0 stars and the end line', (await txt(Q.page, '#ghpStarList')) === "0 stars matching zzzzqq Clear filter That's it. You've reached the end of IsaacUre's stars.");
  check(tag + ' Q no console errors ' + JSON.stringify(Q.errors), Q.errors.length === 0);
  await clean(Q, tag + ' Q');
  await Q.ctx.close();
  let Q2 = await openAt(browser, base, 'github.com/IsaacUre?tab=stars', { limited: true });
  await settle(Q2);
  await Q2.page.fill('#ghpSq', 'kernel'); await settle(Q2); await Q2.page.waitForTimeout(700);
  check(tag + ' Q2 limited: the plain empty state', (await txt(Q2.page, '#ghpStarList')) === 'IsaacUre doesn’t have any starred repositories yet.');
  await Q2.ctx.close();

  // K. an achievement picture GitHub no longer serves: a medallion in its place
  let K = await openAt(browser, base, 'github.com/IsaacUre', { noAssets: true });
  await settle(K); await K.page.waitForTimeout(300);
  check(tag + ' K pictures that 404 fall back to medallions', (await K.page.$$('.ghp-side .ghp-ach.ghp-nopic')).length === 3 && await K.page.$eval('.ghp-side .ghp-ach .ghp-badge', e => getComputedStyle(e).display === 'grid'));
  await K.page.click('.ghp-side .ghp-hlink'); await K.page.waitForTimeout(30);
  check(tag + ' K ...and stay medallions on the next view, from its first frame', (await K.page.$$('.ghp-ach.ghp-nopic')).length === 6 && (await K.page.$$('.ghp-ach:not(.ghp-nopic)')).length === 0);
  await K.ctx.close();
}
(async () => {
  const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
  for (const [b, t] of [['http://localhost:8571/comp/', 'comp'], ['http://localhost:8571/tcomp/', 'tcomp']]) { if (ONLY && ONLY !== t) continue; await run(browser, b, t); }
  await browser.close();
  const fails = results.filter(r => !r[1]);
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' passed' + (fails.length ? '\nFAILED:\n  ' + fails.map(f => f[0]).join('\n  ') : ''));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('DRIVER ERROR', e); process.exit(2); });
