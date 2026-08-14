/* Capture sink for the headless harnesses: a page POSTs a canvas dataURL here and
   it lands on disk as a PNG, so screenshots work even when the browser pane is not
   compositing frames. Dotfolder, so it is committed but never published.
   Usage: node .claude/comp-tools/capture.js <outDir> [port] */
var http = require('http'), fs = require('fs'), path = require('path');
var OUT = path.resolve(process.argv[2] || '.');
var PORT = +(process.env.CAPTURE_PORT || process.argv[3] || 8572);
try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) {}
http.createServer(function (req, res) {
    var head = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
    if (req.method === 'OPTIONS') { res.writeHead(204, head); return res.end(); }
    if (req.method !== 'POST') { res.writeHead(405, head); return res.end('post only'); }
    var name = decodeURIComponent(req.url.replace(/^\/+/, '')).replace(/[^a-z0-9._-]/gi, '_') || 'shot';
    var body = '';
    req.setEncoding('utf8');
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
        var b64 = body.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFile(path.join(OUT, name + '.png'), Buffer.from(b64, 'base64'), function (e) {
            res.writeHead(e ? 500 : 200, head);
            res.end(e ? String(e) : 'ok ' + name);
            console.log((e ? 'FAIL ' : 'wrote ') + name + ' (' + b64.length + ' b64)');
        });
    });
}).listen(PORT, function () { console.log('capture -> ' + OUT + ' on http://localhost:' + PORT + '/'); });
