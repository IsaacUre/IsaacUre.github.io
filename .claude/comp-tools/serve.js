/* A static server for the capture harnesses in this folder, so the
   preview tool has something to start. Dotfolder, so it is committed but
   never published. Usage: node .claude/comp-tools/serve.js <root> [port] */
var http = require('http'), fs = require('fs'), path = require('path');
var ROOT = path.resolve(process.argv[2] || process.cwd());
var PORT = +(process.env.PORT || process.argv[3] || 8571);
var TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
              '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json',
              '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
var SHOTS = path.join(__dirname, 'shots');
http.createServer(function (req, res) {
    /* POST a canvas data-URL here and it lands on disk as a PNG. The preview
       pane can refuse to composite (minimised, backgrounded), and then no
       screenshot tool can see the game at all — but the WebGL canvas is created
       with preserveDrawingBuffer, so the page can always hand its own pixels
       over. Dev-only, dotfolder, never published. */
    if (req.method === 'POST' && req.url.indexOf('/__shot/') === 0) {
        var name = path.basename(req.url.slice(8)).replace(/[^\w.-]/g, '') || 'shot.png';
        var body = '';
        req.on('data', function (c) { body += c; });
        req.on('end', function () {
            try {
                if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
                var b64 = body.replace(/^data:image\/\w+;base64,/, '');
                fs.writeFileSync(path.join(SHOTS, name), Buffer.from(b64, 'base64'));
                res.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); res.end('ok ' + name);
            } catch (e) { res.writeHead(500); res.end(String(e)); }
        });
        return;
    }
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
