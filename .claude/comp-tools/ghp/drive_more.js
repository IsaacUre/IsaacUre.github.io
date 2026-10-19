/* Drives the rest of github.com in the pixel Chrome (the home page, search, a
   repository with its folders, files and commits, someone else's profile, an
   organization, the 404) with real clicks and keys. api.github.com and the
   calendar mirror are answered by mocks: IsaacUre/IsaacUre.github.io's are the
   real answers, trimmed (data/repo.json, made by gen_repo_mock.py); torvalds'
   and anthropics' are made up in their shape.
   usage: node drive_more.js <shots dir> [comp|tcomp]   (README.md has the rest) */
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[3];
const RM = JSON.parse(fs.readFileSync(__dirname + '/data/repo.json'));
const NOW0 = Date.parse('2026-10-19T23:00:00Z');
const results = [];
const check = (n, c) => { results.push([n, !!c]); if (!c) console.log('  FAIL', n); };
const INVENTED = /Live from|saved copy|copy saved|did not (answer|load)|Try again|hourly limit|Open on GitHub|Asking GitHub|● live|the real|Loading 20\d\d|museum|Fetching the README|admit to/i;

/* —— made-up people and organizations, in the API's shape —— */
const TORVALDS = { login: 'torvalds', id: 1024025, type: 'User', name: 'Linus Torvalds', company: 'Linux Foundation', blog: '', location: 'Portland, OR', bio: null, twitter_username: null,
  public_repos: 3, followers: 329000, following: 0, avatar_url: 'https://avatars.githubusercontent.com/u/1024025?v=4', created_at: '2011-09-03T15:26:22Z' };
const TREPOS = [
  { name: 'linux', full_name: 'torvalds/linux', private: false, visibility: 'public', fork: false, description: 'Linux kernel source tree', language: 'C', stargazers_count: 253000, forks_count: 68400, pushed_at: '2026-10-19T20:00:00Z', created_at: '2011-09-04T22:48:12Z', license: { name: 'Other', spdx_id: 'NOASSERTION' } },
  { name: 'uemacs', full_name: 'torvalds/uemacs', private: false, visibility: 'public', fork: false, description: 'Random version of microemacs with my private modificatons', language: 'C', stargazers_count: 2200, forks_count: 326, pushed_at: '2026-08-01T00:00:00Z', created_at: '2013-01-01T00:00:00Z', license: null },
  { name: 'GuitarPedal', full_name: 'torvalds/GuitarPedal', private: false, visibility: 'public', fork: false, description: 'Linus learns analog circuits', language: 'C', stargazers_count: 2500, forks_count: 128, pushed_at: '2026-09-01T00:00:00Z', created_at: '2026-10-05T00:00:00Z', license: null }
];
const ANTH = { login: 'anthropics', id: 76263028, type: 'Organization', name: 'Anthropic', description: null, blog: 'https://anthropic.com', location: 'United States of America', email: null, is_verified: true,
  public_repos: 12, followers: 92300, avatar_url: 'https://avatars.githubusercontent.com/u/76263028?v=4' };
const AREPOS = Array.from({ length: 12 }, (x, i) => ({ name: 'repo-' + i, full_name: 'anthropics/repo-' + i, private: false, visibility: 'public', fork: false, description: i % 3 ? 'Repository number ' + i : null,
  language: ['Python', 'TypeScript', 'Rust', 'Python', 'Go'][i % 5], stargazers_count: 1000 * (12 - i) + 7, forks_count: 10 * i, pushed_at: '2026-10-' + String(19 - i).padStart(2, '0') + 'T12:00:00Z', created_at: '2024-01-01T00:00:00Z',
  topics: i < 3 ? ['claude', 'anthropic'] : ['mcp'], license: { name: 'MIT License', spdx_id: 'MIT' } }));
AREPOS.push({ name: 'secret-decoy', full_name: 'anthropics/secret-decoy', private: true, visibility: 'private', fork: false, description: 'MUST NOT RENDER', language: 'C', stargazers_count: 999999, forks_count: 0, pushed_at: '2026-10-19T23:00:00Z' });
const SEARCH_ITEMS = [
  { name: 'linux', full_name: 'torvalds/linux', owner: { login: 'torvalds', id: 1024025 }, private: false, visibility: 'public', description: 'Linux kernel source tree', language: 'C', stargazers_count: 253000, forks_count: 68400, pushed_at: '2026-10-18T02:00:00Z', topics: [] },
  { name: 'KernelSU', full_name: 'tiann/KernelSU', owner: { login: 'tiann', id: 4233744 }, private: false, visibility: 'public', description: 'A Kernel based root solution for Android', language: 'Kotlin', stargazers_count: 19400, forks_count: 3000, pushed_at: '2026-10-19T18:00:00Z', topics: ['android', 'kernel', 'root', 'su', 'kernelsu'] }
];
// a README that tries everything a README should not get away with, and the things it should
const EVIL_README = '<div id="file" class="md"><article class="markdown-body entry-content container-lg" itemprop="text">' +
  '<p><a href="#build">Build</a> <a href="/torvalds/linux/blob/master/COPYING">COPYING</a> <a href="javascript:window.__pwned=1">x</a> <a href="https://kernel.org">kernel.org</a></p>' +
  '<p><img src="/torvalds/linux/raw/master/logo.png" alt="logo"><img src="x" onerror="window.__pwned=2"><img src="data:image/png;base64,AAAA"></p>' +
  '<script>window.__pwned=3</script><iframe src="https://evil.example"></iframe><p style="position:fixed" onclick="window.__pwned=4">styled</p>' +
  '<div style="height:3000px">tall</div>' + '<p>filler</p>'.repeat(120) + '<div class="markdown-heading"><h2 class="heading-element">Build</h2><a id="user-content-build" class="anchor" href="#build"></a></div><p>the end</p></article></div>';
const PNG1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const EXTRA = { 'images/x.png': { type: 'file', name: 'x.png', path: 'images/x.png', size: 70, encoding: 'base64', content: PNG1 },
  'big.js': { type: 'file', name: 'big.js', path: 'big.js', size: 2400000, encoding: 'none', content: '' } };
function tcal() {                          // a made-up last year for torvalds: 3,743 in all
  const out = []; let d = new Date('2025-10-19T00:00:00Z'), total = 0;
  for (let i = 0; i < 366; i++) { const c = i % 7 === 3 ? 13 : i % 5 === 0 ? 7 : 1; total += c; out.push({ date: d.toISOString().slice(0, 10), count: c, level: c > 10 ? 4 : c > 5 ? 2 : 1 }); d.setUTCDate(d.getUTCDate() + 1); }
  return { total: { lastYear: total }, contributions: out };
}
const TCAL = tcal();

function mock(mode, log) {
  return async route => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname, q = u.searchParams, html = /html/.test(req.headers()['accept'] || '');
    log.push({ url: u.href, path: p, html });
    const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag, Link, X-RateLimit-Remaining, X-RateLimit-Reset', 'x-ratelimit-remaining': '42', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1800) };
    const json = (body, status, extra) => route.fulfill({ status: status || 200, contentType: 'application/json', headers: Object.assign({}, cors, extra || {}), body: JSON.stringify(body) });
    const last = (n, base) => ({ link: '<https://api.github.com' + (base || p) + '?per_page=1&page=2>; rel="next", <https://api.github.com' + (base || p) + '?per_page=1&page=' + n + '>; rel="last"' });
    if (mode.offline) return route.abort('internetdisconnected');
    if (mode.limited) return json({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-remaining': '0' });
    if (mode.searchLimited && /^\/search\//.test(p)) return json({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-resource': 'search' });
    if (mode.lowCore) cors['x-ratelimit-remaining'] = '20';
    const R = '/repos/IsaacUre/IsaacUre.github.io';
    if (p === R) return json(RM.repo);
    if (p === R + '/contents') return json(RM.contents['']);
    if (p.indexOf(R + '/contents/') === 0) {
      const path = decodeURIComponent(p.slice((R + '/contents/').length));
      if (RM.contents[path]) return json(RM.contents[path]);
      if (html && RM.html[path]) return route.fulfill({ status: 200, contentType: 'text/html', headers: cors, body: RM.html[path] });
      if (RM.files[path]) return json(RM.files[path]);
      if (EXTRA[path]) return json(EXTRA[path]);
      return json({ message: 'Not Found' }, 404);
    }
    if (p === R + '/commits') {
      const path = q.get('path'), per = +(q.get('per_page') || 30);
      if (path) return json(RM.bypath[path] ? [RM.bypath[path]] : []);
      if (per === 1) return json([RM.head], 200, last(RM.ncommits, R + '/commits'));
      return json(RM.commits35.slice(0, per));
    }
    if (p === R + '/branches') return json([{ name: 'main' }], 200, last(RM.nbranches));
    if (p === R + '/tags') return json([{ name: 'mc-sounds-archive' }]);
    if (p === R + '/languages') return json(RM.languages);
    if (p === R + '/contributors') return json(RM.contributors);
    if (p === R + '/releases') return json(RM.releases);
    if (p === R + '/releases/latest') return json(RM.releases[0]);
    if (p === R + '/pulls') return json(RM.pullsOpen);
    if (p === R + '/readme' || p === '/repos/torvalds/torvalds/readme') return json({ message: 'Not Found' }, 404);
    if (p === '/repos/anthropics/anthropics/readme') return json({ message: 'Not Found' }, 404);
    if (p === '/users/torvalds') return json(TORVALDS);
    if (p === '/repos/torvalds/linux') return json(Object.assign({ owner: { login: 'torvalds', id: 1024025, avatar_url: TORVALDS.avatar_url }, default_branch: 'master', open_issues_count: 0, subscribers_count: 8000, has_issues: false, has_projects: true, has_wiki: false }, TREPOS[0]));
    if (p === '/repos/torvalds/linux/contents') return json([{ name: 'README.md', path: 'README.md', type: 'file', size: 727 }]);
    if (p === '/repos/torvalds/linux/contents/README.md' && html) return route.fulfill({ status: 200, contentType: 'text/html', headers: cors, body: EVIL_README });
    if (/^\/repos\/torvalds\/linux\//.test(p)) return json([]);
    if (p === '/users/torvalds/repos') return json(TREPOS);
    if (p === '/users/torvalds/orgs') return json([]);
    if (p === '/users/torvalds/starred') return json([{ name: 'x', owner: { login: 'y' }, private: false }], 200, last(2));
    if (p === '/users/anthropics') return json({ login: 'anthropics', id: 76263028, type: 'Organization' });
    if (p === '/orgs/anthropics') return json(ANTH);
    if (p === '/orgs/anthropics/repos') return json(AREPOS);
    if (p === '/orgs/anthropics/public_members') return json([]);
    if (p === '/search/commits') {
      const s = q.get('q') || '';
      if (/repo:/.test(s)) return json({ total_count: 140, items: [] });
      return json({ total_count: 3, items: [{ repository: { full_name: 'torvalds/linux', private: false } }, { repository: { full_name: 'torvalds/linux', private: false } }, { repository: { full_name: 'torvalds/uemacs', private: false } }] });
    }
    if (p === '/search/issues') {
      const s = q.get('q') || '';
      if (/is:pr/.test(s)) return json({ total_count: 1, items: [{ repository_url: 'https://api.github.com/repos/subsurface/subsurface', state: 'closed', pull_request: { merged_at: '2026-10-03T00:00:00Z' } }] });
      return json({ total_count: 1, items: [{ repository_url: 'https://api.github.com/repos/git/git', state: 'open' }] });
    }
    if (p === '/search/repositories') return json({ total_count: 648025, incomplete_results: false, items: SEARCH_ITEMS });
    return json({ message: 'Not Found' }, 404);
  };
}
async function openAt(browser, base, url, mode, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: opts.size || { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const log = [], errors = [], net = { busy: 0, last: Date.now() };
  page.on('console', m => { if (m.type() === 'error' && !/favicon|fonts\.g|ERR_INTERNET|ERR_FAILED|ERR_TUNNEL|ERR_PROXY|ERR_NAME|avatars\.githubusercontent|wikipedia|algolia|duckduckgo|status of 404/i.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('response', r => { if (r.status() === 404 && !mode.expect404 && !/\/readme$/.test(new URL(r.url()).pathname)) errors.push('404 ' + r.url()); });
  const track = h => async route => { net.busy++; net.last = Date.now(); try { await h(route); } finally { net.busy--; net.last = Date.now(); } };
  await page.route(/api\.github\.com/, track(mock(mode, log)));
  await page.route(/github-contributions-api\.jogruber\.de/, track(route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(TCAL) })));
  await page.route(/githubassets|avatars\.githubusercontent|camo\.githubusercontent/, r => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2" fill="#ddd"/></svg>' }));
  await page.clock.setFixedTime(new Date(opts.clock || NOW0));
  await page.goto(base + '?dev=cr:' + encodeURIComponent(url) + '&_=' + Date.now());
  await page.waitForSelector('.tb-btn.app');
  await page.waitForSelector('.cr-ghp', { timeout: 8000 }).catch(() => {});
  if (!opts.small) { await page.evaluate(() => { const w = document.querySelector('.win[data-app="chrome"]'); if (w) w.classList.add('maxi'); }); await page.waitForTimeout(300); }   // desktop width: the header's search shows
  return { ctx, page, log, errors, net };
}
const txt = (page, sel) => page.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' ').trim()).catch(() => '');
async function settle(X, ms) {
  const t0 = Date.now(); await X.page.waitForTimeout(250);
  while (Date.now() - t0 < (ms || 10000)) { if (!X.net.busy && Date.now() - X.net.last > 600) break; await X.page.waitForTimeout(100); }
  await X.page.waitForTimeout(150);
}
async function clean(X, label, skip) {   // skip: parts whose words are someone's data (commit messages), not the page's
  const t = await X.page.$eval('#crView', (e, skip) => { const c = e.cloneNode(true); if (skip) c.querySelectorAll(skip).forEach(x => x.remove()); return (c.innerText || c.textContent).replace(/\s+/g, ' ').trim(); }, skip || null).catch(() => ''), m = t.match(INVENTED);
  check(label + ' shows nothing github.com does not' + (m ? ' (found "' + m[0] + '")' : ''), !m);
}
const nav = async (page, u) => { await page.click('#crUrl'); await page.waitForTimeout(60); await page.fill('#crUrl', u); await page.keyboard.press('Enter'); await page.waitForTimeout(500); };
const url = page => page.$eval('#crUrl', e => e.value);
const title = page => txt(page, '.cr-tab.on .cr-tabt');
const hrefs = (page, sel) => page.$$eval(sel, e => e.map(a => a.getAttribute('href') || a.getAttribute('data-href')));

async function run(browser, base, tag) {
  console.log('==', tag);
  // H. the home page
  let H = await openAt(browser, base, 'github.com', {});
  await settle(H);
  check(tag + ' H home title', (await title(H.page)) === 'GitHub · Change is constant. GitHub keeps you ahead.');
  check(tag + ' H home is dark, with the hero', !!(await H.page.$('.cr-ghp.ghx-dark')) && (await txt(H.page, '.ghx-hh1')) === 'The future of building happens together');
  check(tag + ' H Sign in has no return address, Sign up is the home page\'s', (await H.page.$eval('.ghp-signin', a => a.getAttribute('href'))) === 'https://github.com/login'
    && (await H.page.$eval('.ghp-signup', a => a.getAttribute('href'))) === 'https://github.com/signup?ref_cta=Sign+up&ref_loc=header+logged+out&ref_page=%2F&source=header-home');
  check(tag + ' H no form that could submit', !(await H.page.$('#crView form')));
  check(tag + ' H favicon is GitHub\'s mark', (await H.page.$eval('.cr-tab.on svg.cr-fav use', u => u.getAttribute('href'))) === '#ic-github');
  await clean(H, tag + ' H');
  await H.page.screenshot({ path: OUT + '/' + tag + '-home.png' });
  // S. the header's search
  await H.page.click('.ghp-q'); await H.page.keyboard.type('kernel'); await H.page.keyboard.press('Enter'); await H.page.waitForTimeout(400); await settle(H);
  check(tag + ' S Enter searches GitHub (' + (await url(H.page)) + ')', (await url(H.page)) === 'github.com/search?q=kernel&type=repositories' && (await title(H.page)) === 'Repository search results · GitHub');
  const sr = await txt(H.page, '#ghxSearch');
  check(tag + ' S results line and rows (' + sr + ')', /^648k results \(\d+ ms\) Sort by: Best match torvalds\/linux Linux kernel source tree C 253k Updated 2 days ago Star tiann\/KernelSU A Kernel based root solution for Android android kernel root su kernelsu Kotlin 19\.4k Updated 5 hours ago Star/.test(sr) && (await H.page.$$('.ghx-sitem')).length === 2);
  check(tag + ' S the query is marked in names and descriptions', (await H.page.$$eval('.ghx-sitem em', e => e.map(x => x.textContent.toLowerCase()))).filter(x => x === 'kernel').length === 3);
  check(tag + ' S Repositories is the type, with its count', (await txt(H.page, '.ghx-stype.on')) === 'Repositories 648k' && (await txt(H.page, '.ghx-sside')).indexOf('Code Repositories 648k Issues Pull requests Discussions Users More') >= 0);
  check(tag + ' S pager: 1 to 5, a gap, 100, Next', (await txt(H.page, '.ghx-pgs')) === 'Previous 1 2 3 4 5 … 100 Next');
  check(tag + ' S Star asks you to sign in', (await H.page.$eval('.ghx-sstar', a => a.getAttribute('href'))) === 'https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Ftorvalds%2Flinux');
  await clean(H, tag + ' S');
  await H.page.screenshot({ path: OUT + '/' + tag + '-search.png' });
  await H.page.click('.ghx-pgs .cr-l:has-text("2")'); await settle(H);
  check(tag + ' S page 2', (await url(H.page)) === 'github.com/search?q=kernel&type=repositories&p=2' && H.log.some(l => /search\/repositories\?q=kernel&per_page=10&page=2$/.test(l.url)) && (await txt(H.page, '.ghx-pgon')) === '2');
  check(tag + ' H/S no console errors ' + JSON.stringify(H.errors), H.errors.length === 0);
  await H.ctx.close();

  // R. a repository
  let R = await openAt(browser, base, 'github.com/IsaacUre/IsaacUre.github.io', {});
  await settle(R); await R.page.waitForTimeout(300);
  const p = R.page;
  check(tag + ' R title', (await title(p)) === 'GitHub - IsaacUre/IsaacUre.github.io: Website · GitHub');
  check(tag + ' R crumbs', (await txt(p, '.ghx-crumbs')) === 'IsaacUre / IsaacUre.github.io');
  check(tag + ' R tabs: no Wiki, Pull requests 1 (' + (await txt(p, '.ghx-rtabs')) + ')', (await txt(p, '.ghx-rtabs')) === 'Code Issues Pull requests 1 Actions Projects Security and quality Insights');
  check(tag + ' R title row', (await txt(p, '.ghx-title')) === 'IsaacUre.github.io Public' && (await txt(p, '.ghx-acts')) === 'Notifications Fork 0 Star 0');
  check(tag + ' R its buttons ask you to sign in', (await hrefs(p, '.ghx-acts a')).every(h => h === 'https://github.com/login?return_to=%2FIsaacUre%2FIsaacUre.github.io'));
  check(tag + ' R Sign in comes back here', (await p.$eval('.ghp-signin', a => a.getAttribute('href'))) === 'https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2FIsaacUre%2FIsaacUre.github.io');
  check(tag + ' R branch row (' + (await txt(p, '#ghxBranchRow')) + ')', /^main 56 Branches 1 Tag t Code$/.test(await txt(p, '#ghxBranchRow')));
  const bar = await txt(p, '#ghxBar');
  check(tag + ' R latest commit bar (' + bar.slice(0, 120) + ')', bar.indexOf('IsaacUre and claude comp + tcomp: the GitHub profile looks like github.com, with no "live" marker (#179) 9f1fa7d ·') === 0 && / 247 Commits$/.test(bar));
  const names = await p.$$eval('#ghxRows .ghx-cname', e => e.map(x => x.textContent.trim()));
  check(tag + ' R folders first, then files, each by name (' + names.join(',') + ')', names.join(',') === '.archive,.claude,1p,behind-the-lens,comp,images,room,room3d,tcomp,test,test2,ureboy,.gitignore,CLAUDE.md,CNAME,favicon.svg,index.html');
  const cmsg = await p.$$eval('#ghxRows .ghx-row', e => e.map(r => [r.querySelector('.ghx-cmsg').textContent.trim(), r.querySelector('.ghx-cdate').textContent.trim()]));
  check(tag + ' R every row has its last commit and date', cmsg.length === 17 && cmsg.every(x => x[0] && x[1]) && cmsg[13][0] === RM.bypath['CLAUDE.md'].commit.message.split('\n')[0]);
  const about = await txt(p, '.ghx-side');
  check(tag + ' R About (' + about.slice(0, 140) + ')', /^About Website Activity Stars 0 stars Watchers 0 watching Forks 0 forks Report repository/.test(about));
  check(tag + ' R Releases: 1, the latest', /Releases 1 Minecraft sound archive \(for later\) Latest/.test(about));
  check(tag + ' R Packages, Contributors 2, Languages', /Packages No packages published/.test(about) && /Contributors 2/.test(about) && /Languages JavaScript 77\.3% HTML 11\.8% CSS 9\.4% Python 1\.4%$/.test(about));
  check(tag + ' R Report repository link', (await p.$eval('.ghx-report', a => a.getAttribute('href'))) === 'https://github.com/contact/report-content?content_url=https%3A%2F%2Fgithub.com%2FIsaacUre%2FIsaacUre.github.io&report=IsaacUre+%28user%29');
  check(tag + ' R no README box (the repo has none at its root)', !(await p.$('.ghx-readme')));
  await clean(R, tag + ' R');
  await p.screenshot({ path: OUT + '/' + tag + '-repo.png' });
  // a folder
  await p.click('#ghxRows .ghx-flink:text-is("comp")'); await settle(R);
  check(tag + ' R folder address and title', (await url(p)) === 'github.com/IsaacUre/IsaacUre.github.io/tree/main/comp' && (await title(p)) === 'IsaacUre.github.io/comp at main · IsaacUre/IsaacUre.github.io · GitHub');
  check(tag + ' R folder rows: .., then its files', (await p.$$eval('#ghxRows .ghx-cname', e => e.map(x => x.textContent.trim()))).join(',') === '..,comp.css,comp.js,index.html');
  check(tag + ' R folder crumbs', /IsaacUre\.github\.io \/ comp \//.test(await txt(p, '.ghx-bcs')));
  await clean(R, tag + ' R folder');
  // a file
  await p.click('#ghxRows .ghx-flink:text-is("index.html")'); await settle(R);
  const fm = await txt(p, '.ghx-fmeta'), lines = Buffer.from(RM.files['comp/index.html'].content, 'base64').toString('utf8').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  check(tag + ' R file: address, title, lines and size (' + fm + ')', (await url(p)) === 'github.com/IsaacUre/IsaacUre.github.io/blob/main/comp/index.html' && (await title(p)) === 'IsaacUre.github.io/comp/index.html at main · IsaacUre/IsaacUre.github.io · GitHub'
    && fm.indexOf(lines.length + ' lines (') === 0 && / · \d+(\.\d)? KB$/.test(fm));
  check(tag + ' R file: one row a line, coloured', (await p.$$('.ghx-code tr')).length === lines.length && (await p.$$('.ghx-code .pl-ent')).length > 10);
  check(tag + ' R file: Code, Blame, Raw; no Preview for HTML', (await txt(p, '.ghx-segs')) === 'Code Blame' && (await p.$eval('.ghx-fhead a.ghp-btn', a => a.getAttribute('href'))) === 'https://github.com/IsaacUre/IsaacUre.github.io/raw/refs/heads/main/comp/index.html');
  await clean(R, tag + ' R file');
  await p.screenshot({ path: OUT + '/' + tag + '-blob.png' });
  // a picture, and a file past the API's 1 MB
  await nav(p, 'github.com/IsaacUre/IsaacUre.github.io/blob/main/images/x.png'); await settle(R);
  check(tag + ' R a picture is shown', (await p.$eval('.ghx-imgbody img', i => i.getAttribute('src')).catch(() => '')) === 'https://raw.githubusercontent.com/IsaacUre/IsaacUre.github.io/main/images/x.png' && (await txt(p, '.ghx-fmeta')) === '70 Bytes');
  await nav(p, 'github.com/IsaacUre/IsaacUre.github.io/blob/main/big.js'); await settle(R);
  check(tag + ' R a big file: GitHub\'s words and View raw', (await txt(p, '.ghx-binary')) === 'View raw (Sorry about that, but we can’t show files that are this big right now.)' && (await txt(p, '.ghx-fmeta')) === '2.29 MB');
  // Markdown: GitHub's own rendering, then the code
  await nav(p, 'github.com/IsaacUre/IsaacUre.github.io/blob/main/CLAUDE.md'); await settle(R);
  check(tag + ' R Markdown preview is GitHub\'s rendering', (await txt(p, '.ghx-mdbody h1')) === 'Claude working notes for IsaacUre.github.io' && (await p.$$('.ghx-mdbody h2')).length >= 3 && (await txt(p, '.ghx-seg.on')) === 'Preview');
  check(tag + ' R Markdown: no script or handler survives', await p.evaluate(() => !document.querySelector('.ghx-mdbody script, .ghx-mdbody [onclick], .ghx-mdbody [onerror], .ghx-mdbody [style]')));
  await p.click('.ghx-seg[data-ghx-mode="code"]'); await p.waitForTimeout(200);
  check(tag + ' R Markdown: Code shows the text', (await p.$$('.ghx-code tr')).length > 20 && (await txt(p, '.ghx-seg.on')) === 'Code');
  await p.screenshot({ path: OUT + '/' + tag + '-md.png' });
  // the commit list
  await nav(p, 'github.com/IsaacUre/IsaacUre.github.io'); await settle(R);
  await p.click('.ghx-hist'); await settle(R);
  check(tag + ' R commits: address, title, heading', (await url(p)) === 'github.com/IsaacUre/IsaacUre.github.io/commits/main/' && (await title(p)) === 'Commits · IsaacUre/IsaacUre.github.io · GitHub' && (await txt(p, '.ghx-ch')) === 'Commits');
  const days = await p.$$eval('.ghx-cday', e => e.map(x => x.textContent.trim()));
  check(tag + ' R commits grouped by day (' + days.slice(0, 2).join(' | ') + ')', days.length >= 2 && days.every(d => /^Commits on [A-Z][a-z]{2} \d{1,2}, 2026$/.test(d)) && (await p.$$('.ghx-crow')).length === 35);
  check(tag + ' R a commit row (' + (await txt(p, '.ghx-crow')).slice(0, 110) + ')', /^comp \+ tcomp: the GitHub profile looks like github\.com, with no "live" marker \(#179\)… IsaacUre and claude authored /.test(await txt(p, '.ghx-crow')));
  await p.click('.ghx-crow .ghx-ellip'); await p.waitForTimeout(200);
  check(tag + ' R … opens the description', /Same patch in comp\/ and tcomp\/|Co-authored-by|---------/.test(await txt(p, '.ghx-crow .ghx-cbodytext')));
  check(tag + ' R a commit opens on github.com itself', (await p.$eval('.ghx-crow .ghx-ctl', a => a.getAttribute('href'))) === 'https://github.com/IsaacUre/IsaacUre.github.io/commit/' + RM.commits35[0].sha);
  check(tag + ' R Next page', (await txt(p, '.ghx-pager')) === 'Previous Next' && !!(await p.$('.ghx-pager .cr-l[data-href$="?page=2"]')));
  await clean(R, tag + ' R commits', '.ghx-ctitle, .ghx-cbodytext, #ghxBar');
  await p.screenshot({ path: OUT + '/' + tag + '-commits.png' });
  check(tag + ' R no console errors ' + JSON.stringify(R.errors), R.errors.length === 0);
  await R.ctx.close();

  // U. someone else's profile
  let U = await openAt(browser, base, 'github.com/torvalds', {});
  await settle(U); await U.page.waitForTimeout(300);
  check(tag + ' U title', (await title(U.page)) === 'torvalds (Linus Torvalds) · GitHub');
  const side = await txt(U.page, '#ghpSide');
  check(tag + ' U sidebar (' + side + ')', side.indexOf('Linus Torvalds torvalds Follow 329k followers · 0 following Linux Foundation Portland, OR') === 0 && /Block or report user$/.test(side) && !/Achievements/.test(side));
  check(tag + ' U tabs: counters from the API', (await txt(U.page, '#ghpTabs')) === 'Overview Repositories 3 Projects Packages Stars 2');
  check(tag + ' U Popular: theirs, by stars', (await U.page.$$eval('.ghp-card .ghp-repo', e => e.map(x => x.textContent))).join(',') === 'linux,GuitarPedal,uemacs');
  check(tag + ' U calendar from the mirror, with GitHub\'s comma', (await txt(U.page, '.ghp-calh')) === TCAL.total.lastYear.toLocaleString('en-US') + ' contributions in the last year' && TCAL.total.lastYear >= 1000);
  const ua = await txt(U.page, '#ghpAct');
  check(tag + ' U activity from the search API (' + ua.slice(0, 200) + ')', /^Contribution activity October 2026 Created 3 commits in 2 repositories torvalds\/linux 2 commits torvalds\/uemacs 1 commit Created 1 repository torvalds\/GuitarPedal Opened 1 pull request in 1 repository subsurface\/subsurface 1 merged Opened 1 issue in 1 repository git\/git 1 open Show more activity$/.test(ua));
  check(tag + ' U Sign in and Follow come back here', (await U.page.$eval('.ghp-signin', a => a.getAttribute('href'))) === 'https://github.com/login?return_to=https%3A%2F%2Fgithub.com%2Ftorvalds');
  check(tag + ' U nothing of IsaacUre\'s', !/IsaacUre/.test(await txt(U.page, '#crView')) && !(await U.page.content()).includes('98616888'));
  check(tag + ' U nothing saved', !/torvalds/.test(await U.page.evaluate(() => localStorage.getItem('comp_ghp') || '')));
  await clean(U, tag + ' U');
  await U.page.screenshot({ path: OUT + '/' + tag + '-user.png' });
  await U.page.click('.ghp-more'); await settle(U);
  check(tag + ' U Show more: September from the search API', /September 2026 Created 3 commits in 2 repositories/.test(await txt(U.page, '#ghpAct')) && U.log.some(l => /search\/commits/.test(l.url) && /2026-09-01\.\.2026-09-30/.test(decodeURIComponent(l.url))));
  await U.page.click('.ghp-tab:has-text("Repositories")'); await settle(U);
  check(tag + ' U Repositories tab', (await url(U.page)) === 'github.com/torvalds?tab=repositories' && (await U.page.$$('.ghp-ritem')).length === 3 && (await title(U.page)) === 'torvalds (Linus Torvalds) / Repositories · GitHub');
  check(tag + ' U ...and no lines asked for', !U.log.some(l => /participation/.test(l.url)));
  await U.page.click('.ghp-card .ghp-cname, .ghp-ritem .ghp-cname').catch(() => {}); await settle(U);
  check(tag + ' U a repository opens here', /^github\.com\/torvalds\//.test(await url(U.page)) && !!(await U.page.$('.ghx-titlerow')));
  await nav(U.page, 'github.com/torvalds/linux'); await settle(U);
  const md = await U.page.evaluate(() => { const b = document.querySelector('.ghx-readme'); return b && { pw: window.__pwned, bad: b.querySelectorAll('script, iframe, [onerror], [onclick], [style], img[src^="data:"], a[href^="javascript:"]').length,
    rel: (b.querySelector('a.cr-l[data-href="github.com/torvalds/linux/blob/master/COPYING"]') || {}).textContent, ext: (b.querySelector('a[href="https://kernel.org"]') || {}).target,
    img: (b.querySelector('img[alt="logo"]') || {}).src, text: b.innerText.replace(/\s+/g, ' ') }; });
  check(tag + ' U a hostile README: nothing runs or styles, links work (' + JSON.stringify(md && { pw: md.pw, bad: md.bad, rel: md.rel, ext: md.ext, img: md.img }) + ')', md && md.pw === undefined && md.bad === 0 && md.rel === 'COPYING' && md.ext === '_blank' && md.img === 'https://github.com/torvalds/linux/raw/master/logo.png');
  const top0 = await U.page.$eval('#crView', v => v.scrollTop), hash0 = await U.page.evaluate(() => location.hash);
  await U.page.click('.ghx-readme a[href="#build"] >> nth=0'); await U.page.waitForTimeout(300);
  check(tag + ' U a #link scrolls to its heading, the address stays', (await U.page.$eval('#crView', v => v.scrollTop)) > top0 + 1000 && (await U.page.evaluate(() => location.hash)) === hash0 && (await url(U.page)) === 'github.com/torvalds/linux');
  check(tag + ' U no console errors ' + JSON.stringify(U.errors), U.errors.length === 0);
  await U.ctx.close();
  // the IsaacUre profile still knows only itself after visiting someone else
  let U2 = await openAt(browser, base, 'github.com/torvalds', {});
  await settle(U2);
  await nav(U2.page, 'google.com/search?q=isaacure');
  check(tag + ' U2 IsaacUre\'s search entry is still IsaacUre\'s', /IsaacUre has \d+ repositor/.test(await txt(U2.page, '#crView')) && !/torvalds has/.test(await txt(U2.page, '#crView')));
  await U2.ctx.close();

  // O. an organization
  let O = await openAt(browser, base, 'github.com/anthropics', {});
  await settle(O); await O.page.waitForTimeout(300);
  check(tag + ' O title', (await title(O.page)) === 'Anthropic · GitHub');
  const oh = await txt(O.page, '.ghx-ohead');
  check(tag + ' O header (' + oh + ')', oh.indexOf('Anthropic 92.3k followers United States of America https://anthropic.com Verified') === 0 && /Overview Repositories Projects Packages People$/.test(oh));
  check(tag + ' O Popular: six, by stars', (await O.page.$$('.ghp-card')).length === 6 && (await txt(O.page, '.ghp-card .ghp-repo')) === 'repo-0');
  const orows = await txt(O.page, '.ghx-orepos');
  check(tag + ' O Repositories (' + orows.slice(0, 120) + ')', /^Repositories Type Language Sort Showing 10 of 12 repositories repo-0 Public/.test(orows) && (await O.page.$$('.ghx-orepos .ghp-ritem')).length === 10 && /View all repositories$/.test(orows));
  const os = await txt(O.page, '.ghx-side');
  check(tag + ' O sidebar (' + os + ')', os === 'People This organization has no public members. You must be a member to see who’s a part of this organization. Top languages Python TypeScript Rust Go Most used topics mcp claude anthropic');
  check(tag + ' O a private repository never renders', !(await O.page.content()).includes('MUST NOT RENDER'));
  await O.page.click('.ghx-orepos .ghp-menu:has-text("Type") > summary'); await O.page.waitForTimeout(150);
  check(tag + ' O Type menu: its choices open the Repositories page', (await txt(O.page, '.ghx-orepos .ghp-menu[open] .ghp-menuh')) === 'Select type' && (await hrefs(O.page, '.ghx-orepos .ghp-menu[open] a.ghp-mopt')).join(' ') === ['all', 'source', 'fork', 'archived', 'mirror', 'template'].map(t => 'https://github.com/orgs/anthropics/repositories?type=' + t).join(' '));
  await O.page.keyboard.press('Escape'); await O.page.waitForTimeout(100);
  check(tag + ' O Escape closes it', !(await O.page.$('.ghp-menu[open]')));
  await clean(O, tag + ' O');
  await O.page.screenshot({ path: OUT + '/' + tag + '-org.png' });
  check(tag + ' O no console errors ' + JSON.stringify(O.errors), O.errors.length === 0);
  await O.ctx.close();

  // N. the 404s
  let N = await openAt(browser, base, 'github.com/zz-nobody', { expect404: true });
  await settle(N);
  check(tag + ' N an unknown name: GitHub\'s 404', (await title(N.page)) === 'Page not found · GitHub' && /^404 “This is not the web page you are looking for” Find code, projects, and people on GitHub: Search Contact Support — GitHub Status — @githubstatus$/.test(await txt(N.page, '#ghxBody')));
  await N.page.fill('.ghx-404in', 'kernel'); await N.page.keyboard.press('Enter'); await N.page.waitForTimeout(400);
  check(tag + ' N its search searches', (await url(N.page)) === 'github.com/search?q=kernel&type=repositories');
  await nav(N.page, 'github.com/IsaacUre/no-such-repo'); await settle(N);
  check(tag + ' N an unknown repository: the 404', (await title(N.page)) === 'Page not found · GitHub' && /^404/.test(await txt(N.page, '#ghxBody')));
  await nav(N.page, 'github.com/IsaacUre/IsaacUre.github.io/tree/main/no-such-folder'); await settle(N);
  check(tag + ' N an unknown folder: the 404', /^404/.test(await txt(N.page, '#ghxBody')));
  await clean(N, tag + ' N');
  await N.page.screenshot({ path: OUT + '/' + tag + '-404.png' });
  await N.ctx.close();

  // B. the hour's requests: a folder asks for fewer rows when few are left; search's own limit leaves the rest alone
  let B = await openAt(browser, base, 'github.com/IsaacUre/IsaacUre.github.io', { lowCore: true });
  await settle(B);
  const rowAsks = B.log.filter(l => /\/commits\?/.test(l.url) && /[?&]path=/.test(l.url)).length, filled = await B.page.$$eval('#ghxRows .ghx-cmsg', e => e.filter(x => x.textContent.trim()).length);
  check(tag + ' B 20 left: 5 rows asked, 5 filled (' + rowAsks + ', ' + filled + ')', rowAsks === 5 && filled === 5 && (await B.page.$$('#ghxRows .ghx-row')).length === 17);
  await B.ctx.close();
  let B2 = await openAt(browser, base, 'github.com/torvalds', { searchLimited: true });
  await settle(B2);
  await nav(B2.page, 'github.com/IsaacUre/IsaacUre.github.io'); await settle(B2);
  check(tag + ' B2 search limited: the profile and a repository still load', (await B2.page.$$('#ghxRows .ghx-row')).length === 17 && !!(await B2.page.$('.ghx-titlerow')));
  await clean(B2, tag + ' B2');
  await B2.ctx.close();

  // L. rate limited / offline: nothing is claimed
  for (const m of ['limited', 'offline']) {
    let L = await openAt(browser, base, 'github.com/IsaacUre/IsaacUre.github.io', { [m]: true, expect404: true });
    await settle(L);
    check(tag + ' L ' + m + ': no repository is claimed, no 404 either', !(await L.page.$('.ghx-titlerow')) && !/404/.test(await txt(L.page, '#ghxBody')) && !!(await L.page.$('.ghp-top')));
    await clean(L, tag + ' L ' + m);
    await L.ctx.close();
  }
}
(async () => {
  const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
  for (const [b, t] of [['http://localhost:8571/comp/', 'comp'], ['http://localhost:8571/tcomp/', 'tcomp']]) { if (ONLY && ONLY !== t) continue; await run(browser, b, t); }
  await browser.close();
  const fails = results.filter(r => !r[1]);
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' passed' + (fails.length ? '\nFAILED:\n  ' + fails.map(f => f[0]).join('\n  ') : ''));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('DRIVER ERROR', e); process.exit(2); });
