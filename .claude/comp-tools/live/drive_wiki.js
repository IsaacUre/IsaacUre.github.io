/* Drives en.wikipedia.org in the pixel Chrome of /comp/ and /tcomp/ with real
   clicks and keys, against the made-up article in data/wiki.json (see README.md).
   usage: node drive_wiki.js <shots dir> [comp|tcomp] */
const { chromium } = require('playwright');
const fs = require('fs');
const { wikimock } = require('./wikimock.js');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[3];
const results = [];
const check = (n, c) => { results.push([n, !!c]); if (!c) console.log('  FAIL', n); };
const INVENTED = /museum|the real|fetched|● live|Fetching|pixels|restyled|keep clicking|impressive, honestly/i;
const txt = (h, sel) => h.$eval(sel, e => (e.innerText || e.textContent).replace(/\s+/g, ' ').trim()).catch(() => '');
const has = (h, sel) => h.$(sel).then(e => !!e).catch(() => false);

async function openAt(browser, base, url, mode, opts) {
  opts = opts || {}; mode = mode || {};
  const ctx = await browser.newContext({ viewport: opts.size || { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const log = [], errors = [], net = { busy: 0, last: Date.now() };
  page.on('console', m => { if (m.type() === 'error' && !/favicon|fonts\.g|ERR_INTERNET|ERR_FAILED|ERR_TUNNEL|ERR_PROXY|ERR_NAME|ERR_BLOCKED|net::|X-Frame-Options|frame-ancestors|status of 404|status of 500|Blocked script execution in 'about:srcdoc'/i.test(m.text())) errors.push(m.text()); });   // the last: Playwright's own click helper being refused by the scriptless frame, not the page's doing (a plain frame logs nothing until frame.click)
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  const track = h => async route => { net.busy++; net.last = Date.now(); try { await h(route); } finally { net.busy--; net.last = Date.now(); } };
  await page.route(u => /(^|\.)(wikipedia|wikimedia|wikidata)\.org$/.test(u.host), track(wikimock(mode, log)));
  await page.route(u => !/^localhost(:|$)/.test(u.host) && !/(^|\.)(wikipedia|wikimedia|wikidata)\.org$/.test(u.host), r => r.abort('blockedbyclient'));   // nothing else on the web
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
/* the page drawn in its frame, once its heading is there */
async function wk(X, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 8000)) {
    const el = await X.page.$('iframe.cr-wk');
    if (el) { const fr = await el.contentFrame(); if (fr && await fr.$('#firstHeading')) { await X.page.waitForTimeout(120); return fr; } }
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
  check(label + ' shows nothing Wikipedia does not' + (m ? ' (found "' + m[0] + '")' : ''), !m);
}
async function run(browser, base, tag) {
  console.log('==', tag);
  // A. an article
  let A = await openAt(browser, base, 'en.wikipedia.org/wiki/Harness_test_article', {});
  let fr = await wk(A); await settle(A);
  check(tag + ' A the page is drawn in its frame', !!fr);
  if (!fr) { await A.ctx.close(); return; }
  check(tag + ' A tab title, Wikipedia\'s pagetitle', (await title(A.page)) === 'Harness test article - Wikipedia');
  check(tag + ' A favicon is Wikipedia\'s own file', (await A.page.$eval('.cr-tab.on img.cr-fav', i => i.getAttribute('src'))) === 'https://en.wikipedia.org/static/favicon/wikipedia.ico');
  const hcls = await fr.$eval('html', h => h.className);
  check(tag + ' A html classes: Wikipedia\'s own, client-js, animations-ready', /\bclient-js\b/.test(hcls) && !/client-nojs/.test(hcls) && /vector-feature-toc-pinned-clientpref-1/.test(hcls) && /vector-animations-ready/.test(hcls) && /vector-sticky-header-enabled/.test(hcls) && /skin-theme-clientpref-day/.test(hcls));
  const bcls = await fr.$eval('body', b => b.className);
  check(tag + ' A body classes as OutputPage lists them', /^mediawiki ltr sitedir-ltr mw-hide-empty-elt action-view skin-vector-2022 ns-0 ns-subject mw-editable page-Harness_test_article rootpage-Harness_test_article skin--responsive skin-vector skin-vector-search-vue$/.test(bcls));
  check(tag + ' A stylesheet is load.php, the page\'s own module set', await fr.$$eval('link[rel=stylesheet]', l => l.length === 3 && l.every(x => /^https:\/\/en\.wikipedia\.org\/w\/load\.php\?/.test(x.href)) && /skins\.vector\.icons%2Cstyles/.test(l[0].href) && /site\.styles/.test(l[1].href)));
  check(tag + ' A heading and tagline', (await txt(fr, '#firstHeading')) === 'Harness test article' && (await txt(fr, '#siteSub')) === 'From Wikipedia, the free encyclopedia');
  check(tag + ' A the logo set is the 25th-anniversary one', (await fr.$eval('.mw-logo-wordmark', i => i.getAttribute('src'))) === '/static/images/mobile/copyright/wikipedia-wordmark-en-25.svg' && (await fr.$eval('.mw-logo-icon', i => i.getAttribute('src'))) === '/static/images/icons/enwiki-25.svg');
  check(tag + ' A tabs: Article (selected), Talk, Read, Edit, View history', (await txt(fr, '#ca-nstab-main.selected')) === 'Article' && (await txt(fr, '#ca-talk')) === 'Talk' && (await txt(fr, '#ca-view.selected')) === 'Read' && (await txt(fr, '#ca-edit')) === 'Edit' && (await txt(fr, '#ca-history')) === 'View history');
  check(tag + ' A talk tab turns red once the info lands', await fr.$eval('#ca-talk', li => li.classList.contains('new') && /redlink=1/.test(li.querySelector('a').getAttribute('href')) && /page does not exist/.test(li.querySelector('a').title)));
  check(tag + ' A table of contents: Beginning plus seven sections, nested', await fr.$$eval('#vector-toc .vector-toc-list-item', l => l.length === 8) && await fr.$eval('#toc-History', li => li.classList.contains('vector-toc-level-1') && li.classList.contains('vector-toc-list-item-expanded') && !!li.querySelector('.vector-toc-toggle') && li.querySelectorAll('#toc-History-sublist .vector-toc-level-2').length === 2) && (await txt(fr, '#toc-Early_days .vector-toc-numb')) === '1.1');
  check(tag + ' A the article body and its categories', (await txt(fr, '#mw-content-text .mw-parser-output > p')) .indexOf('A harness test article is a page') === 0 && await fr.$$eval('#catlinks #mw-normal-catlinks li a', l => l.map(a => a.textContent).join('|') === 'Fixtures|Test pages'));
  check(tag + ' A edit links kept', await fr.$$eval('.mw-editsection a', l => l.length === 7 && l[0].getAttribute('href') === '/w/index.php?title=Harness_test_article&action=edit&section=1'));
  check(tag + ' A language button says 3 languages', (await txt(fr, '#p-lang-btn .vector-dropdown-label-text')) === '3 languages' && await fr.$eval('#p-lang-btn-label', l => /cdx-button--action-progressive/.test(l.className) && /mw-portlet-lang-heading-3/.test(l.className)));
  await fr.click('#p-lang-btn-checkbox'); await A.page.waitForTimeout(150);
  check(tag + ' A the languages open as Wikipedia lists them', await fr.$eval('#p-lang-btn-checkbox', c => c.checked) && await fr.$$eval('#p-lang-btn li.interlanguage-link', l => l.length === 3 && l[0].className === 'interlanguage-link interwiki-de mw-list-item' && l[0].querySelector('a').title === 'Testartikel – German' && l[0].querySelector('a').getAttribute('hreflang') === 'de' && l[2].textContent === '日本語'));
  await fr.click('#firstHeading'); await A.page.waitForTimeout(100);
  check(tag + ' A a click elsewhere closes the dropdown', !(await fr.$eval('#p-lang-btn-checkbox', c => c.checked)));
  const lm = await txt(fr, '#footer-info-lastmod');
  check(tag + ' A footer: last edited, licence, the nine places, the two icons', lm === 'This page was last edited on 3 October 2026, at 14:22 (UTC).' && /Creative Commons Attribution-ShareAlike 4\.0 License; additional terms may apply\. By using this site/.test(await txt(fr, '#footer-info-copyright')) && await fr.$$eval('#footer-places li', l => l.map(x => x.textContent.trim()).join('|') === 'Privacy policy|About Wikipedia|Disclaimers|Contact Wikipedia|Code of Conduct|Developers|Statistics|Cookie statement|Mobile view') && await fr.$$eval('#footer-icons img', l => l.length === 2 && l[0].alt === 'Wikimedia Foundation' && l[1].alt === 'Powered by MediaWiki'));
  await fr.click('#vector-main-menu-dropdown-checkbox'); await A.page.waitForTimeout(150);
  check(tag + ' A main menu: Navigation and Contribute as the English Wikipedia sets them', await fr.$eval('#vector-main-menu-dropdown-checkbox', c => c.checked) && await fr.$$eval('#p-navigation li', l => l.map(x => x.textContent.trim()).join('|') === 'Main page|Contents|Current events|Random article|About Wikipedia|Contact us') && (await txt(fr, '#p-interaction .vector-menu-heading')) === 'Contribute' && await fr.$$eval('#p-interaction li', l => l.map(x => x.textContent.trim()).join('|') === 'Help|Learn to edit|Community portal|Recent changes|Upload file|Special pages'));
  await A.page.screenshot({ path: OUT + '/' + tag + '-wiki-mainmenu.png' });
  await fr.click('#vector-page-tools-dropdown-checkbox'); await A.page.waitForTimeout(150);
  check(tag + ' A tools: Actions (the views, with icons) first, General, Print/export, In other projects', !(await fr.$eval('#vector-main-menu-dropdown-checkbox', c => c.checked)) && await fr.$eval('#vector-page-tools-dropdown-checkbox', c => c.checked) && await fr.$$eval('#vector-page-tools > .vector-menu', l => l.map(x => x.id).join('|') === 'p-cactions|p-tb|p-coll-print_export|p-wikibase-otherprojects') && await fr.$$eval('#p-cactions li', l => l.map(x => x.id).join('|') === 'ca-view-more|ca-edit-more|ca-history-more' && !!l[0].querySelector('.mw-ui-icon-wikimedia-eye') && !!l[2].querySelector('.mw-ui-icon-wikimedia-history')) && await fr.$$eval('#p-tb li', l => l.map(x => x.id).join('|') === 't-whatlinkshere|t-recentchangeslinked|t-upload|t-permalink|t-info|t-cite|t-urlshortener|t-urlshortener-qrcode') && (await fr.$eval('#t-upload a', a => a.getAttribute('href'))) === '//en.wikipedia.org/wiki/Wikipedia:File_Upload_Wizard' && (await txt(fr, '#p-coll-print_export .vector-menu-heading')) === 'Print/export' && await fr.$$eval('#p-coll-print_export li', l => l.map(x => x.textContent.trim()).join('|') === 'Download as PDF|Printable version') && (await txt(fr, '#p-wikibase-otherprojects .vector-menu-heading')) === 'In other projects' && await fr.$eval('#p-wikibase-otherprojects li', li => li.id === 't-wikibase' && li.classList.contains('wb-otherproject-wikibase-dataitem') && li.querySelector('a').getAttribute('href') === 'https://www.wikidata.org/wiki/Special:EntityPage/Q1'));
  check(tag + ' A the user links: Donate, Create account, Log in, and a dropdown the skin hides at this width', await fr.$$eval('#p-vector-user-menu-overflow li', l => l.map(x => x.id).join('|') === 'pt-sitesupport-2|pt-createaccount-2|pt-login-2' && l.every(x => x.classList.contains('vector-menu-item--collapsible'))) && await fr.$eval('#vector-user-links-dropdown', e => e.classList.contains('vector-user-links-dropdown--collapsible') && getComputedStyle(e).display === 'none' && e.title === 'More options' && !!e.querySelector('.mw-ui-icon-wikimedia-userAvatar')) && await fr.$$eval('#p-personal li', l => l.map(x => x.id).join('|') === 'pt-sitesupport|pt-createaccount|pt-login'));
  { await A.page.evaluate(() => { window.__opened = []; const o = window.open; window.open = function (u) { window.__opened.push(u); return o.apply(window, arguments); }; });   // the window itself cannot load here (nothing on the web is reachable), so the call is what is checked
    const pop = A.ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null); await fr.click('#ca-history a'); const pp = await pop;
    check(tag + ' A View history, which Wikipedia will not show in a frame, opens a window of its own', !!pp && (await A.page.evaluate(() => window.__opened.join())) === 'https://en.wikipedia.org/w/index.php?title=Harness_test_article&action=history' && (await url(A.page)) === 'en.wikipedia.org/wiki/Harness_test_article');
    if (pp) await pp.close(); }
  await A.page.screenshot({ path: OUT + '/' + tag + '-wiki-tools.png' });
  await fr.click('#firstHeading'); await A.page.waitForTimeout(100);
  check(tag + ' A appearance menu pinned: Text, Width, Color (beta)', await fr.$$eval('#vector-appearance-pinned-container #vector-appearance .vector-menu-heading', l => l.map(x => x.textContent.replace(/\s+/g, ' ').trim()).join('|') === 'Text|Width|Color (beta)') && await fr.$eval('#skin-client-pref-vector-feature-custom-font-size-value-1', r => r.checked));
  await fr.click('label[for="skin-client-pref-vector-feature-custom-font-size-value-2"]'); await A.page.waitForTimeout(100);
  check(tag + ' A Large text flips the html class', await fr.$eval('html', h => /vector-feature-custom-font-size-clientpref-2/.test(h.className) && !/clientpref-1(\s|$)/.test(h.className.match(/custom-font-size-clientpref-\d/)[0])));
  await fr.click('#vector-toc .vector-pinnable-header-unpin-button'); await A.page.waitForTimeout(150);
  check(tag + ' A hide moves the contents into the titlebar dropdown', await fr.$eval('#vector-page-titlebar-toc-unpinned-container #vector-toc', e => !!e) && await fr.$eval('html', h => /vector-feature-toc-pinned-clientpref-0/.test(h.className)) && await fr.$eval('#vector-toc .vector-pinnable-header', h => h.classList.contains('vector-pinnable-header-unpinned')) && (await fr.evaluate(() => document.activeElement && document.activeElement.id)) === 'vector-page-titlebar-toc-checkbox');
  await A.page.screenshot({ path: OUT + '/' + tag + '-wiki-toc-unpinned.png' });
  await fr.click('#vector-page-titlebar-toc-checkbox'); await A.page.waitForTimeout(150);
  check(tag + ' A the titlebar dropdown opens on the contents', await fr.$eval('#vector-page-titlebar-toc #vector-toc .vector-toc-contents', e => !!e && e.getBoundingClientRect().height > 0));
  await fr.click('#vector-toc .vector-pinnable-header-pin-button'); await A.page.waitForTimeout(150);
  check(tag + ' A move to sidebar brings it back', await fr.$eval('#vector-toc-pinned-container #vector-toc', e => !!e) && await fr.$eval('html', h => /vector-feature-toc-pinned-clientpref-1/.test(h.className)));
  await fr.click('#toc-Design .vector-toc-link'); await A.page.waitForTimeout(250);
  check(tag + ' A a contents link scrolls the frame and marks the section', (await fr.evaluate(() => window.scrollY)) > 100 && await fr.$eval('#toc-Design', li => li.classList.contains('vector-toc-list-item-active')));
  check(tag + ' A the sticky header shows past the title', await fr.$eval('body', b => b.classList.contains('vector-sticky-header-visible')) && (await txt(fr, '.vector-sticky-header-context-bar-primary')) === 'Harness test article');
  await fr.click('.vector-sticky-header-search-toggle'); await A.page.waitForTimeout(150);
  check(tag + ' A the sticky header\'s search icon opens its box', await fr.$eval('#vector-sticky-header', h => h.classList.contains('vector-header-search-toggled') && getComputedStyle(h.querySelector('.vector-search-box')).display !== 'none' && h.querySelector('.vector-search-box input') === document.activeElement));
  await A.page.screenshot({ path: OUT + '/' + tag + '-wiki-scrolled.png' });
  await fr.click('a[href="/wiki/Second_test_article"]', { button: 'right' }); await A.page.waitForTimeout(150);
  check(tag + ' A right-click on a link: the link menu', await A.page.$$eval('.bctx .bctx-i', l => l.map(x => x.textContent.trim()).join('|') === 'Open link in new tab|Open link in Incognito window|Copy link address|Save link as…'));
  await A.page.keyboard.press('Escape'); await A.page.waitForTimeout(100);
  await A.page.keyboard.press('Alt+F'); await A.page.waitForTimeout(150); await A.page.keyboard.type('fixture'); await A.page.waitForTimeout(300);
  check(tag + ' A find in page reaches into the frame', await fr.$$eval('mark.fnd', m => m.length >= 3) && /\/\d+$/.test(await txt(A.page, '.findbar .find-count')));
  await A.page.keyboard.press('Escape'); await A.page.waitForTimeout(100);
  await clean(A, fr, tag + ' A');
  await fr.click('#mw-content-text ul li a[href="/wiki/Second_test_article"]');   // the See also link, down the page: the scroll position stays
  fr = await wk(A); await settle(A);
  check(tag + ' A a link in the article navigates the Chrome', (await url(A.page)) === 'en.wikipedia.org/wiki/Second_test_article' && !!fr && (await txt(fr, '#firstHeading')) === 'Second test article');
  check(tag + ' A the text size choice is kept across pages', !!fr && await fr.$eval('html', h => /vector-feature-custom-font-size-clientpref-2/.test(h.className)));
  if (fr) { await fr.click('label[for="skin-client-pref-vector-feature-custom-font-size-value-1"]'); await A.page.waitForTimeout(100); }
  check(tag + ' A no sections: no contents, toc-not-available', !!fr && !(await has(fr, '#mw-panel-toc')) && await fr.$eval('html', h => /vector-toc-not-available/.test(h.className)));
  check(tag + ' A a protected page: View source, the talk tab blue', !!fr && (await txt(fr, '#ca-viewsource')) === 'View source' && !(await has(fr, '#ca-edit')) && await fr.$eval('#ca-talk', li => !li.classList.contains('new')) && await fr.$eval('body', b => !b.classList.contains('mw-editable')));
  check(tag + ' A an article in no other language: Add languages, the progressive button', !!fr && (await txt(fr, '#p-lang-btn .vector-dropdown-label-text')) === 'Add languages' && await fr.$eval('#p-lang-btn-label', l => /cdx-button--action-progressive/.test(l.className) && /mw-portlet-lang-heading-0/.test(l.className)) && await fr.$eval('#p-lang-btn-checkbox', c => c.classList.contains('mw-interlanguage-selector')) && !!(await fr.$('#p-lang-btn .uls-after-portlet-link')));
  await A.page.click('#crBack'); fr = await wk(A); await settle(A);
  check(tag + ' A back returns to the article, scrolled where it was', (await url(A.page)) === 'en.wikipedia.org/wiki/Harness_test_article' && !!fr && (await fr.evaluate(() => window.scrollY)) > 100);
  await nav(A.page, 'en.wikipedia.org/wiki/Harness_test_article'); fr = await wk(A); await settle(A);
  check(tag + ' A the same address typed again is a new entry: it starts at the top', !!fr && (await fr.evaluate(() => window.scrollY)) === 0);
  await A.page.screenshot({ path: OUT + '/' + tag + '-wiki-article.png' });
  await A.ctx.close();
  // B. a redirect, a missing page, a bad title
  let B = await openAt(browser, base, 'en.wikipedia.org/wiki/Harness_fixture', {});
  fr = await wk(B); await settle(B);
  check(tag + ' B a redirect: the target, with the redirected-from line', !!fr && (await txt(fr, '#firstHeading')) === 'Harness test article' && (await txt(fr, '#contentSub .mw-redirectedfrom')) === '(Redirected from Harness fixture)' && (await fr.$eval('#contentSub .mw-redirectedfrom a', a => a.getAttribute('href'))) === '/w/index.php?title=Harness_fixture&redirect=no');
  await fr.click('#contentSub .mw-redirectedfrom a'); fr = await wk(B); await settle(B);
  check(tag + ' B redirect=no shows the redirect page itself', (await url(B.page)) === 'en.wikipedia.org/w/index.php?title=Harness_fixture&redirect=no' && !!fr && (await txt(fr, '#firstHeading')) === 'Harness fixture' && (await txt(fr, '#contentSub #redirectsub')) === 'Redirect page' && !!(await fr.$('.redirectMsg .redirectText a[href="/wiki/Harness_test_article"]')));
  await nav(B.page, 'en.wikipedia.org/wiki/Missing_test_article'); fr = await wk(B); await settle(B);
  check(tag + ' B a missing page: the wiki\'s own text for it, Create, no licence line', !!fr && /The harness has no page with this exact name/.test(await txt(fr, '.noarticletext')) && (await txt(fr, '#ca-edit')) === 'Create' && (await fr.$eval('#ca-edit a', a => a.title)) === 'Create this page [alt-shift-e]' && !(await has(fr, '#ca-view')) && !(await has(fr, '#footer-info-copyright')) && await fr.$eval('#ca-nstab-main', li => !li.classList.contains('new') && li.classList.contains('selected') && /action=edit&redlink=1/.test(li.querySelector('a').getAttribute('href')) && li.querySelector('a').title === 'View the content page (page does not exist) [alt-shift-c]') && (await title(B.page)) === 'Missing test article - Wikipedia');
  await B.page.screenshot({ path: OUT + '/' + tag + '-wiki-missing.png' });
  await clean(B, fr, tag + ' B');
  await B.ctx.close();
  // C. search: the box's suggestions, Go, the full-text page
  let C = await openAt(browser, base, 'en.wikipedia.org/wiki/Second_test_article', {});
  fr = await wk(C); await settle(C);
  await fr.click('#searchInput'); await C.page.keyboard.type('Har'); await C.page.waitForTimeout(600);
  check(tag + ' C suggestions: two pages and the search-for row, Codex\'s markup', !!fr && await fr.$$eval('#simpleSearch .cdx-typeahead-search__menu .cdx-menu-item', l => l.length === 3 && l[0].querySelector('.cdx-search-result-title__match').textContent === 'Har' && l[0].querySelector('.cdx-menu-item__text__description').textContent === 'fixture for the copy\'s checks' && !!l[0].querySelector('.cdx-thumbnail__image') && !!l[1].querySelector('.cdx-thumbnail__placeholder') && /Redirected from Harness two/.test(l[1].textContent) && l[2].querySelector('.cdx-typeahead-search__search-footer__query').textContent === 'Har') && await fr.$eval('.vector-header .cdx-typeahead-search', e => e.classList.contains('cdx-typeahead-search--expanded')));
  await C.page.screenshot({ path: OUT + '/' + tag + '-wiki-suggest.png' });
  await C.page.keyboard.press('ArrowDown'); await C.page.keyboard.press('Enter'); fr = await wk(C); await settle(C);
  check(tag + ' C a suggestion goes to the page', (await url(C.page)) === 'en.wikipedia.org/wiki/Harness_test_article' && !!fr && (await txt(fr, '#firstHeading')) === 'Harness test article');
  await fr.click('#searchInput'); await C.page.keyboard.type('harness'); await C.page.waitForTimeout(400); await C.page.keyboard.press('Enter'); fr = await wk(C); await settle(C);
  check(tag + ' C Enter with no exact match: the results page', (await url(C.page)) === 'en.wikipedia.org/w/index.php?title=Special:Search&search=harness' && !!fr && (await txt(fr, '#firstHeading')) === 'Search results' && (await title(C.page)) === 'Search results for "harness" - Wikipedia');
  check(tag + ' C a special page: no tab, no article tools, its own base', !!fr && !(await has(fr, '#ca-nstab-special')) && await fr.$eval('#p-associated-pages', e => e.classList.contains('emptyPortlet')) && await fr.$eval('base', b => b.getAttribute('href') === 'https://en.wikipedia.org/wiki/Special:Search') && await fr.$$eval('#p-tb li', l => l.map(x => x.id).join('|') === 't-upload|t-print|t-urlshortener') && !(await has(fr, '#p-cactions li')) && !(await has(fr, '#ca-talk-sticky-header')));
  check(tag + ' C results as Special:Search lists them', !!fr && await fr.$$eval('.mw-search-results li.mw-search-result', l => l.length === 2 && l[0].querySelector('.mw-search-result-heading a').getAttribute('data-serp-pos') === '0' && /harness/.test(l[0].querySelector('.searchresult .searchmatch').textContent) && l[0].querySelector('.mw-search-result-data').textContent === '2 KB (120 words) – 14:22, 3 October 2026' && !!l[0].querySelector('.searchResultImage-thumbnail img') && !!l[1].querySelector('.searchResultImage-thumbnail-placeholder')) && (await txt(fr, '.results-info')) === 'Results 1 – 2 of 2' && (await txt(fr, '.searchdidyoumean')) === 'Did you mean: harness' && await fr.$eval('body', b => /ns--1 ns-special mw-special-Search/.test(b.className)));
  await C.page.screenshot({ path: OUT + '/' + tag + '-wiki-search.png' });
  await clean(C, fr, tag + ' C');
  await fr.click('#searchText input'); await C.page.keyboard.press('Control+A'); await C.page.keyboard.type('second'); await C.page.keyboard.press('Enter'); fr = await wk(C); await settle(C);
  check(tag + ' C the results page\'s own form searches again', (await url(C.page)) === 'en.wikipedia.org/w/index.php?search=second&title=Special:Search&profile=default&fulltext=1' && !!fr && (await fr.$eval('#searchText input', i => i.value)) === 'second');
  await nav(C.page, 'en.wikipedia.org/w/index.php?search=second&title=Special:Search&profile=default&fulltext=1&limit=50'); fr = await wk(C); await settle(C);
  check(tag + ' C the pager\'s limit reaches the query', C.log.some(u => /list=search.*srlimit=50/.test(u)));
  await fr.click('.search-types a[title="Search for files"]'); fr = await wk(C); await settle(C);
  check(tag + ' C the Multimedia tab searches files and is marked current', /profile=images/.test(await url(C.page)) && C.log.some(u => /list=search.*srnamespace=6/.test(u)) && !!fr && (await txt(fr, '.search-types li.current')) === 'Multimedia');
  await nav(C.page, 'en.wikipedia.org/wiki/Special:Random'); fr = await wk(C); await settle(C);
  check(tag + ' C Special:Random lands on an article', (await url(C.page)) === 'en.wikipedia.org/wiki/Second_test_article' && !!fr);
  await nav(C.page, 'en.wikipedia.org'); fr = await wk(C); await settle(C);
  check(tag + ' C the main page: its own title and tab, the languages at the foot of the content', (await title(C.page)) === 'Wikipedia, the free encyclopedia' && !!fr && (await txt(fr, '#ca-nstab-main')) === 'Main Page' && await fr.$eval('body', b => b.classList.contains('page-Main_Page')) && !(await has(fr, '#vector-main-menu #p-lang')) && !(await has(fr, '.vector-page-titlebar #p-lang-btn')) && await fr.$eval('#bodyContent > #p-lang-btn', e => e.compareDocumentPosition(e.ownerDocument.getElementById('catlinks')) & Node.DOCUMENT_POSITION_PRECEDING) && await fr.$$eval('#bodyContent #p-lang-btn li.interlanguage-link', l => l.length === 3) && !!(await fr.$('#p-lang-btn-sticky-header')));
  await nav(C.page, 'en.wikipedia.org/w/index.php?title=Harness_test_article&action=history'); await C.page.waitForTimeout(600);
  check(tag + ' C a history page typed in goes to the site itself, in a frame', await C.page.$eval('.cr-frame iframe', f => /action=history/.test(f.getAttribute('src'))).catch(() => false));
  await nav(C.page, 'en.wikipedia.org/wiki/Category:Fixtures'); await C.page.waitForTimeout(600);
  check(tag + ' C a category page is the real one, in a frame', await C.page.$eval('.cr-frame iframe', f => /\/wiki\/Category:Fixtures/.test(f.getAttribute('src'))).catch(() => false) && !(await has(C.page, 'iframe.cr-wk')));
  await C.ctx.close();
  // G. the Golf GTI article carries the house's footnote: a section, two infobox rows, two links
  let G = await openAt(browser, base, 'en.wikipedia.org/wiki/Volkswagen_Golf_GTI', {});
  fr = await wk(G); await settle(G);
  check(tag + ' G the real article, with Notable examples before See also', !!fr && (await title(G.page)) === 'Volkswagen Golf GTI - Wikipedia' && await fr.$eval('#Notable_examples', h => { const w = h.closest('.mw-heading'); let n = w.nextElementSibling; return w.classList.contains('mw-heading2') && n.tagName === 'P' && /Argent/.test(n.textContent) && /citation needed/.test(n.textContent) && w.compareDocumentPosition(document.getElementById('See_also')) & Node.DOCUMENT_POSITION_FOLLOWING; }));
  check(tag + ' G the contents gain the section and renumber after it', !!fr && (await txt(fr, '#toc-Notable_examples .vector-toc-numb')) === '4' && (await txt(fr, '#toc-See_also .vector-toc-numb')) === '5' && (await txt(fr, '#toc-References .vector-toc-numb')) === '6' && await fr.$$eval('#vector-toc .vector-toc-list-item', l => l.length === 9));
  check(tag + ' G the infobox rows and the See also links', !!fr && await fr.$$eval('table.infobox th.infobox-label', l => l.map(x => x.textContent).slice(-2).join('|') === 'Best example|Top speed') && await fr.$$eval('#See_also ~ *, .mw-heading:has(#See_also) + ul a', l => l.some(a => a.getAttribute && a.getAttribute('href') === 'https://isaacure.com/')));
  await G.page.screenshot({ path: OUT + '/' + tag + '-wiki-gti.png' });
  await nav(G.page, 'en.wikipedia.org/wiki/Second_test_article'); fr = await wk(G); await settle(G);
  await G.page.click('#crBack'); fr = await wk(G); await settle(G);
  check(tag + ' G coming back adds the section once, not again', !!fr && await fr.$$eval('#vector-toc .vector-toc-list-item', l => l.length === 9 && l.filter(x => x.id === 'toc-Notable_examples').length === 1) && (await txt(fr, '#toc-See_also .vector-toc-numb')) === '5');
  await G.ctx.close();
  // D. offline, and the REST search down
  let D = await openAt(browser, base, 'en.wikipedia.org/wiki/Harness_test_article', { offline: true });
  await settle(D);
  check(tag + ' D offline: an error page, not a blank frame', !!(await D.page.$('#crView .cr-neterror')) && !(await D.page.$('iframe.cr-wk')));
  await D.ctx.close();
  let E = await openAt(browser, base, 'en.wikipedia.org/wiki/Second_test_article', { restDown: true });
  fr = await wk(E); await settle(E);
  if (fr) { await fr.click('#searchInput'); await E.page.keyboard.type('Har'); await E.page.waitForTimeout(700); }
  check(tag + ' E suggestions still come when the REST search does not answer', !!fr && await fr.$$eval('.cdx-typeahead-search__menu .cdx-menu-item', l => l.length === 3));
  const errs = [].concat(A.errors, B.errors, C.errors, G.errors, D.errors, E.errors);
  check(tag + ' no page errors' + (errs.length ? ' (' + errs.slice(0, 3).join(' · ') + ')' : ''), !errs.length);
  await E.ctx.close();
}
(async () => {
  const browser = await chromium.launch();
  for (const tag of ONLY ? [ONLY] : ['comp', 'tcomp']) await run(browser, 'http://localhost:8571/' + tag + '/', tag);
  await browser.close();
  const n = results.filter(r => r[1]).length;
  console.log(n + '/' + results.length + ' passed');
  process.exit(n === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
