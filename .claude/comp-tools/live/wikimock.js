/* Answers en.wikipedia.org for the harness, from data/wiki.json (a labelled,
   made-up article in the parser's shape) and data/vector.css (Vector 2022's
   stylesheet compiled from the skin's and core's LESS, see README.md). Nothing
   else on the web is reachable: every other host is refused. */
const fs = require('fs');
const D = JSON.parse(fs.readFileSync(__dirname + '/data/wiki.json', 'utf8'));
const CSS = fs.readFileSync(__dirname + '/data/vector.css', 'utf8');
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const SVG1 = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
const KNOWN = { 'Harness test article': 'parse', 'Harness fixture': 'redirect', 'Second test article': 'second', 'Main Page': 'parse', 'Missing test article': 'missing', 'Volkswagen Golf GTI': 'gti' };
// the Golf GTI article, for the house's footnote: the harness article under that name
D.gti = JSON.parse(JSON.stringify(D.parse).split('Harness test article').join('Volkswagen Golf GTI').split('Harness_test_article').join('Volkswagen_Golf_GTI'));
function wikimock(mode, log) {
  mode = mode || {};
  return async route => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname, q = u.searchParams, host = u.host;
    if (log) log.push(u.href);
    const cors = { 'access-control-allow-origin': '*' };
    const json = (body, status) => route.fulfill({ status: status || 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    if (mode.offline) return route.abort('internetdisconnected');
    if (host === 'upload.wikimedia.org' || /\/static\/|\/w\/resources\//.test(p)) {
      return /\.svg$/.test(p) ? route.fulfill({ status: 200, contentType: 'image/svg+xml', body: SVG1 }) : route.fulfill({ status: 200, contentType: 'image/png', body: PNG1 });
    }
    if (host !== 'en.wikipedia.org') return route.abort('blockedbyclient');
    if (p === '/w/load.php') return route.fulfill({ status: 200, contentType: 'text/css', body: /modules=site\.styles|typeahead|special\.search/.test(u.search) ? '' : CSS });
    if (p === '/w/rest.php/v1/search/title') { if (mode.restDown) return json({ httpCode: 500 }, 500); return json(D.suggest); }
    if (p !== '/w/api.php') return route.fulfill({ status: 200, contentType: 'text/html', headers: { 'x-frame-options': 'DENY' }, body: '<!doctype html><title>stand-in</title><p>a page the mock does not have</p>' });   // a document: refused in a frame, as the site refuses all but views
    const action = q.get('action');
    if (mode.slow) await new Promise(r => setTimeout(r, mode.slow));
    if (action === 'parse') {
      if (q.has('text')) {   // a message rendered for a title (the missing page's noarticletextanon): the mock's own words, labelled as such
        return json({ parse: { title: q.get('title') || 'API', pageid: 0, text: '<div class="noarticletext mw-content-ltr" dir="ltr" lang="en"><p>The harness has no page with this exact name. (The mock\'s stand-in for the wiki\'s own noarticletextanon.)</p></div>' } });
      }
      const page = (q.get('page') || '').replace(/_/g, ' ');
      const k = KNOWN[page];
      if (!k) return json(D.missing);
      if (page === 'Main Page') return json({ parse: Object.assign({}, D.parse.parse, { title: 'Main Page', displaytitle: 'Main Page' }) });   // the harness article under the wiki's own front-page title
      if (k === 'redirect' && !q.has('redirects')) {   // redirect=no: the redirect page itself
        return json({ parse: { title: page, pageid: 9, revid: 9, text: '<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr"><div class="redirectMsg"><p>Redirect to:</p><ul class="redirectText"><li><a href="/wiki/Harness_test_article" title="Harness test article">Harness test article</a></li></ul></div></div>', langlinks: [], categorieshtml: '', displaytitle: page, indicators: {}, sections: [], headhtml: D.parse.parse.headhtml } });
      }
      return json(D[k]);
    }
    if (action === 'query') {
      if (q.get('list') === 'random') return json(D.random);
      if (q.get('list') === 'search') {
        const s = (q.get('srsearch') || '').toLowerCase();
        if (q.get('srwhat') === 'nearmatch') {
          const hit = Object.keys(KNOWN).filter(t => KNOWN[t] !== 'missing' && t.toLowerCase() === s)[0];
          return json(hit ? { batchcomplete: true, query: { searchinfo: { totalhits: 1 }, search: [{ ns: 0, title: hit, pageid: 1 }] } } : D.nearmatch_none);
        }
        return json(/harness|second|test/.test(s) ? D.search : { batchcomplete: true, query: { searchinfo: { totalhits: 0, suggestion: null }, search: [] } });
      }
      if (q.get('prop') === 'pageimages') return json(D.pageimages);
      if (q.get('generator') === 'prefixsearch') return json({ batchcomplete: true, query: { pages: D.suggest.pages.map((pg, i) => ({ pageid: pg.id, ns: 0, title: pg.title, index: i + 1, description: pg.description })) } });
      if (/info/.test(q.get('prop') || '')) return json(/Second test article/.test(q.get('titles') || '') ? D.protected : D.info);
      return json({ batchcomplete: true, query: {} });
    }
    return json({ error: { code: 'unknown_action', info: 'Unrecognized value for parameter "action".' } }, 200);
  };
}
module.exports = { wikimock, D };
