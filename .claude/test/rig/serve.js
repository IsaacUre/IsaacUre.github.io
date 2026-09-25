/* Static server for testing /test.
   Usage: node serve.js <port> [candidateDir]
   Serves the repo root at /, so /test/ is the repo's test/. Given candidateDir, it
   serves that at /test/ instead (/test/index.html from the candidate, /images/...
   still from the repo). */
var http = require('http'), fs = require('fs'), path = require('path');
var REPO = path.resolve(__dirname, '..', '..', '..');   // the repo root: .claude/test/rig is three down
var PORT = +(process.argv[2] || 8600);
var CAND = process.argv[3] ? path.resolve(process.argv[3]) : null;
var TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
              '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json',
              '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };
http.createServer(function (req, res) {
    var p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    if (p === '/test') { res.writeHead(301, { Location: '/test/' }); return res.end(); }
    if (p.slice(-1) === '/') p += 'index.html';
    var root = REPO;
    if (CAND && p.indexOf('/test/') === 0) { root = CAND; p = p.slice(5); }
    var f = path.resolve(path.join(root, p));
    if (f.indexOf(root) !== 0) { res.writeHead(403); return res.end('no'); }
    fs.readFile(f, function (e, b) {
        if (e) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404 ' + p); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream',
                             'Cache-Control': 'no-store' });
        res.end(b);
    });
}).listen(PORT, '127.0.0.1', function () { console.log('serving on http://127.0.0.1:' + PORT + '/ (new -> ' + (CAND || 'repo') + ')'); });
