/* Answers Hacker News' two APIs for the harness from data/hn.json (made-up
   stories in the APIs' shapes; the titles say so), and news.css with a stub:
   the real stylesheet is the site's own and is not kept here. */
const fs = require('fs');
const D = JSON.parse(fs.readFileSync(__dirname + '/data/hn.json', 'utf8'));
const GIF1 = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const CSS_STUB = 'body{font-family:Verdana,Geneva,sans-serif;font-size:10pt;color:#828282}.title a{color:#000}.subtext,.comhead,.yclinks{font-size:7pt}.pagetop a{color:#000}.noshow{display:none}.nosee{visibility:hidden;pointer-events:none}.votearrow{width:10px;height:10px;border:0;margin:3px 2px 6px;background:#9a9a9a}td.title{padding-right:4px}';
function findNode(t, id) { if (t.id === id) return t; for (const c of t.children || []) { const f = findNode(c, id); if (f) return f; } return null; }
function hnmock(mode, log) {
  mode = mode || {};
  return async route => {
    const u = new URL(route.request().url()), p = u.pathname, host = u.host;
    if (log) log.push(u.href);
    const json = (body, status) => route.fulfill({ status: status || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (mode.offline) return route.abort('internetdisconnected');
    if (host === 'news.ycombinator.com') {
      if (p === '/news.css') return route.fulfill({ status: 200, contentType: 'text/css', body: CSS_STUB });
      if (/\.(svg)$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><rect width="18" height="18" fill="#f60"/></svg>' });
      if (/\.(gif|ico)$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/gif', body: GIF1 });
      return route.fulfill({ status: 200, contentType: 'text/html', headers: { 'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'self'" }, body: '<!doctype html><title>real site stand-in</title><p>the real site, in a window</p>' });   // the site refuses to be framed
    }
    if (host === 'hacker-news.firebaseio.com') {
      let m;
      if ((m = /^\/v0\/(topstories|newstories|askstories|showstories|jobstories)\.json$/.exec(p))) return json(D.lists[m[1]]);
      if ((m = /^\/v0\/item\/(\d+)\.json$/.exec(p))) { if (mode.fbDown) return route.abort('timedout'); return json(D.items[m[1]] || null); }
      if ((m = /^\/v0\/user\/([^/]+)\.json$/.exec(p))) return json(D.users[decodeURIComponent(m[1])] || null);
      return json(null);
    }
    if (host === 'hn.algolia.com') {
      let m;
      if ((m = /^\/api\/v1\/items\/(\d+)$/.exec(p))) { const n = findNode(D.thread, +m[1]); return n ? json(n) : json({ error: 'Not Found' }, 404); }   // the thread, or a comment's subtree
      return json({ hits: [] });
    }
    return route.abort('blockedbyclient');
  };
}
module.exports = { hnmock, D };
