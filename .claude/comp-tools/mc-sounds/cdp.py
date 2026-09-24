"""A tiny DevTools-protocol driver for headless Edge, stdlib only: no Playwright, no downloads.
Edge's audio is muted (--mute-audio) but the page's AudioContext still runs, so levels can be metered."""
import socket, base64, os, json, struct, time, subprocess, tempfile, urllib.request

EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'

class WS:
    def __init__(self, url):
        hostport, path = url[len('ws://'):].split('/', 1)
        host, port = hostport.split(':')
        self.s = socket.create_connection((host, int(port)))
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f'GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                        f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        resp = b''
        while b'\r\n\r\n' not in resp:
            resp += self.s.recv(4096)
        head, self.buf = resp.split(b'\r\n\r\n', 1)
        assert b' 101 ' in head.split(b'\r\n')[0], head

    def send(self, text):
        data = text.encode()
        hdr = bytearray([0x81]); n = len(data)
        if n < 126: hdr.append(0x80 | n)
        elif n < 65536: hdr.append(0x80 | 126); hdr += struct.pack('>H', n)
        else: hdr.append(0x80 | 127); hdr += struct.pack('>Q', n)
        mask = os.urandom(4); hdr += mask
        body = bytearray(data)
        for i in range(n): body[i] ^= mask[i & 3]
        self.s.sendall(bytes(hdr) + bytes(body))

    def _read(self, n):
        while len(self.buf) < n:
            chunk = self.s.recv(1 << 20)
            if not chunk: raise EOFError('socket closed')
            self.buf += chunk
        out, self.buf = self.buf[:n], self.buf[n:]
        return out

    def recv(self):
        msg = b''
        while True:
            b0, b1 = self._read(2)
            op, fin, n = b0 & 0x0f, b0 & 0x80, b1 & 0x7f
            if n == 126: n = struct.unpack('>H', self._read(2))[0]
            elif n == 127: n = struct.unpack('>Q', self._read(8))[0]
            if b1 & 0x80: self._read(4)
            payload = self._read(n)
            if op == 8: raise EOFError('closed by browser')
            if op in (9, 10): continue
            msg += payload
            if fin: return msg.decode('utf-8', 'replace')

class CDP:
    def __init__(self, ws):
        self.ws, self.id, self.events = ws, 0, []

    def call(self, method, **params):
        self.id += 1; mid = self.id
        self.ws.send(json.dumps({'id': mid, 'method': method, 'params': params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get('id') == mid:
                if 'error' in m: raise RuntimeError(f'{method}: {m["error"]}')
                return m.get('result', {})
            self.events.append(m)

    def eval(self, expr, timeout=60000):
        r = self.call('Runtime.evaluate', expression=expr, awaitPromise=True, returnByValue=True, timeout=timeout)
        if 'exceptionDetails' in r:
            raise RuntimeError(json.dumps(r['exceptionDetails'])[:1500])
        return r['result'].get('value')

    def wait_for(self, expr, timeout=60, every=0.25):
        t0 = time.time()
        while time.time() - t0 < timeout:
            v = self.eval(expr)
            if v: return v
            time.sleep(every)
        raise TimeoutError(expr)

    def click(self, x, y):
        for t in ('mouseMoved', 'mousePressed', 'mouseReleased'):
            self.call('Input.dispatchMouseEvent', type=t, x=x, y=y, button='left', clickCount=1)

    def key(self, key, code, vk, down=True):
        self.call('Input.dispatchKeyEvent', type='keyDown' if down else 'keyUp', key=key, code=code, windowsVirtualKeyCode=vk)

    def shot(self, path):
        data = self.call('Page.captureScreenshot', format='png')['data']
        open(path, 'wb').write(base64.b64decode(data))

    def drain(self):
        """Pull events that arrived while nothing was being awaited."""
        self.ws.s.settimeout(0.05)
        try:
            while True: self.events.append(json.loads(self.ws.recv()))
        except (socket.timeout, TimeoutError, BlockingIOError):
            pass
        finally:
            self.ws.s.settimeout(None)

def launch(port=9333, w=820, h=620, profile=None):
    profile = profile or os.path.join(tempfile.gettempdir(), 'mc-sounds-edge-profile')   # never the user's own Edge profile
    proc = subprocess.Popen([EDGE, '--headless=new', f'--remote-debugging-port={port}', f'--user-data-dir={profile}',
                             '--no-first-run', '--no-default-browser-check', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
                             '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
                             f'--window-size={w},{h}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        try:
            targets = json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json'))
            page = next(t for t in targets if t['type'] == 'page')
            return proc, CDP(WS(page['webSocketDebuggerUrl']))
        except Exception:
            time.sleep(0.2)
    proc.kill()
    raise RuntimeError('edge did not come up')
