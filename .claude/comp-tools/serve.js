/* A static server for the capture harnesses in this folder, so the
   preview tool has something to start. Dotfolder, so it is committed but
   never published. Usage: node .claude/comp-tools/serve.js <root> [port] */
var http = require('http'), fs = require('fs'), path = require('path');
var ROOT = path.resolve(process.argv[2] || process.cwd());
var PORT = +(process.env.PORT || process.argv[3] || 8571);
var TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
              '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
              '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
http.createServer(function (req, res) {
    var p = decodeURIComponent(req.url.split('?')[0]);
    if (p.slice(-1) === '/') p += 'index.html';
    var f = path.resolve(path.join(ROOT, p));
    if (f.indexOf(ROOT) !== 0) { res.writeHead(403); return res.end('no'); }
    fs.readFile(f, function (e, b) {
        if (e) { res.writeHead(404); return res.end('404 ' + p); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream',
                             'Cache-Control': 'no-store' });
        res.end(b);
    });
}).listen(PORT, function () { console.log('serving ' + ROOT + ' on http://localhost:' + PORT + '/'); });
