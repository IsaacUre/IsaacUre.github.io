/* pwshim: just enough of Playwright's API, over the DevTools protocol, for the
   harnesses in .claude/comp-tools (mc-drive.js, the mc-play suites and the
   one-off capture scripts) to run against the Microsoft Edge that Windows
   already has, with no npm install. mc-drive.js falls back to it when
   Playwright itself is not installed; anything else can point at it with
   PLAYWRIGHT_PATH=<this folder>.

   Covered: chromium.launch, browser.newContext / close, context.newPage,
   page.on('pageerror' | 'console'), addInitScript, goto, evaluate,
   waitForFunction, waitForSelector, waitForTimeout, screenshot (with clip),
   click, $ and $$ (handles with click, textContent, getAttribute,
   isVisible, boundingBox), setViewportSize, keyboard.press / down / up /
   type, and mouse.move / down / up / click. Input goes in through
   Input.dispatchMouseEvent and Input.dispatchKeyEvent, so the page sees
   trusted events, as it would from Playwright. Needs Node 22 or newer (for
   the built-in WebSocket). EDGE_PATH overrides where Edge is. */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

const EDGE = process.env.EDGE_PATH || [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* one WebSocket to the browser; page sessions ride on it (flatten mode) */
class Conn {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.wait = new Map(); this.subs = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString());
      if (m.id != null) {
        const w = this.wait.get(m.id);
        if (!w) return;
        this.wait.delete(m.id);
        if (m.error) w.no(new Error(m.error.message + (m.error.data ? ': ' + m.error.data : '')));
        else w.ok(m.result);
        return;
      }
      const fn = this.subs.get(m.sessionId || '');
      if (fn) fn(m.method, m.params);
    });
  }
  send(method, params, sessionId) {
    const id = ++this.id;
    const msg = { id, method, params: params || {} };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((ok, no) => { this.wait.set(id, { ok, no }); this.ws.send(JSON.stringify(msg)); });
  }
}

const KEYS = {
  Escape: [27, 'Escape'], Enter: [13, 'Enter', '\r'], Tab: [9, 'Tab'], Backspace: [8, 'Backspace'], Delete: [46, 'Delete'],
  Shift: [16, 'ShiftLeft'], Control: [17, 'ControlLeft'], Alt: [18, 'AltLeft'], Meta: [91, 'MetaLeft'],
  ArrowUp: [38, 'ArrowUp'], ArrowDown: [40, 'ArrowDown'], ArrowLeft: [37, 'ArrowLeft'], ArrowRight: [39, 'ArrowRight'],
  Home: [36, 'Home'], End: [35, 'End'], PageUp: [33, 'PageUp'], PageDown: [34, 'PageDown'], ' ': [32, 'Space', ' '],
  F3: [114, 'F3'], F1: [112, 'F1'], F2: [113, 'F2'], F5: [116, 'F5'], F11: [122, 'F11']
};
const MODS = { Alt: 1, Control: 2, Meta: 4, Shift: 8 };
function keyInfo(key) {
  if (KEYS[key]) return { code: KEYS[key][1], vk: KEYS[key][0], text: KEYS[key][2] };
  if (key.length === 1) {
    const up = key.toUpperCase();
    if (/[A-Z]/.test(up)) return { code: 'Key' + up, vk: up.charCodeAt(0), text: key };
    if (/[0-9]/.test(key)) return { code: 'Digit' + key, vk: key.charCodeAt(0), text: key };
    const punct = { '/': [191, 'Slash'], '.': [190, 'Period'], ',': [188, 'Comma'], '-': [189, 'Minus'], '=': [187, 'Equal'], ';': [186, 'Semicolon'],
      "'": [222, 'Quote'], '[': [219, 'BracketLeft'], ']': [221, 'BracketRight'], '\\': [220, 'Backslash'], '`': [192, 'Backquote'] };
    const p = punct[key];
    return { code: p ? p[1] : '', vk: p ? p[0] : 0, text: key };
  }
  return { code: key, vk: 0 };
}

class Page {
  constructor(conn, sid, viewport) {
    this.c = conn; this.sid = sid; this.vp = viewport; this.h = { pageerror: [], console: [] };
    this.mx = 0; this.my = 0; this.btn = 'none'; this.mods = 0; this.loaded = null;
    conn.subs.set(sid, (method, p) => {
      if (method === 'Runtime.exceptionThrown') {
        const d = p.exceptionDetails, e = d.exception;
        const msg = (e && (e.description || e.value)) || d.text;
        this.h.pageerror.forEach((f) => f(new Error(String(msg).split('\n')[0].replace(/^\w*Error: /, '') || msg)));
      } else if (method === 'Runtime.consoleAPICalled') {
        const text = (p.args || []).map((a) => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ');
        const t = p.type === 'warning' ? 'warning' : p.type;
        this.h.console.forEach((f) => f({ type: () => t, text: () => text }));
      } else if (method === 'Page.loadEventFired' && this.loaded) {
        const l = this.loaded; this.loaded = null; l();
      }
    });
    this.keyboard = {
      down: (key) => this._key('keyDown', key),
      up: (key) => this._key('keyUp', key),
      press: async (key) => { await this._key('keyDown', key); await this._key('keyUp', key); },
      type: async (text) => { for (const ch of String(text)) { await this._key('keyDown', ch); await this._key('keyUp', ch); } }
    };
    this.mouse = {
      move: (x, y) => { this.mx = x; this.my = y; return this._mouse('mouseMoved'); },
      down: (o) => { this.btn = (o && o.button) || 'left'; return this._mouse('mousePressed', this.btn); },
      up: (o) => { const b = (o && o.button) || this.btn || 'left'; this.btn = 'none'; return this._mouse('mouseReleased', b); },
      click: async (x, y, o) => { this.mx = x; this.my = y; await this._mouse('mouseMoved'); await this.mouse.down(o); await this.mouse.up(o); }
    };
  }
  send(m, p) { return this.c.send(m, p, this.sid); }
  async _init() {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Emulation.setFocusEmulationEnabled', { enabled: true });   // the page keeps focus, as a foreground tab would
    await this.setViewportSize(this.vp);
  }
  on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); }
  addInitScript(src) {
    const source = typeof src === 'function' ? '(' + src.toString() + ')()' : String(src);
    return this.send('Page.addScriptToEvaluateOnNewDocument', { source });
  }
  async goto(url) {
    const done = new Promise((r) => { this.loaded = r; });
    const res = await this.send('Page.navigate', { url });
    if (res.errorText) { this.loaded = null; throw new Error('goto ' + url + ': ' + res.errorText); }
    await Promise.race([done, sleep(60000)]);
  }
  async evaluate(fn, arg) {
    const expression = typeof fn === 'function' ? '(' + fn.toString() + ')(' + (arg === undefined ? '' : JSON.stringify(arg)) + ')' : String(fn);
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) {
      const e = r.exceptionDetails.exception;
      throw new Error((e && (e.description || e.value)) || r.exceptionDetails.text);
    }
    return r.result ? r.result.value : undefined;
  }
  async waitForFunction(fn, arg, opts) {
    const timeout = (opts && opts.timeout) || 30000, poll = (opts && typeof opts.polling === 'number') ? opts.polling : 100;
    const end = Date.now() + timeout;
    for (;;) {
      let v = null;
      try { v = await this.evaluate(fn, arg); } catch (e) { v = null; }
      if (v) return v;
      if (Date.now() > end) throw new Error('waitForFunction timed out after ' + timeout + 'ms');
      await sleep(poll);
    }
  }
  waitForSelector(sel, opts) {
    const state = (opts && opts.state) || 'visible';
    return this.waitForFunction(([s, st]) => {
      const el = document.querySelector(s);
      if (!el) return st === 'detached' || st === 'hidden';
      if (st === 'attached') return true;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const vis = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      return st === 'hidden' ? !vis : vis;
    }, [sel, state], { timeout: (opts && opts.timeout) || 30000, polling: 50 });
  }
  waitForTimeout(ms) { return sleep(ms); }
  /* page.$ and page.$$: a handle for each match (null when there is none),
     enough for the checks and actions the suites make on them */
  async $(sel) { return (await this.evaluate((s) => !!document.querySelector(s), sel)) ? new Handle(this, sel, 0) : null; }
  async $$(sel) {
    const n = await this.evaluate((s) => document.querySelectorAll(s).length, sel);
    return Array.from({ length: n }, (_, i) => new Handle(this, sel, i));
  }
  async click(sel, opts) {
    await this.waitForSelector(sel, { state: 'visible', timeout: (opts && opts.timeout) || 30000 });
    const p = await this.evaluate((s) => {
      const el = document.querySelector(s); el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, sel);
    await this.mouse.click(p.x, p.y);
  }
  async screenshot(opts) {
    const p = { format: 'png', captureBeyondViewport: false };
    if (opts && opts.clip) p.clip = Object.assign({ scale: 1 }, opts.clip);
    const r = await this.send('Page.captureScreenshot', p);
    const buf = Buffer.from(r.data, 'base64');
    if (opts && opts.path) fs.writeFileSync(opts.path, buf);
    return buf;
  }
  async setViewportSize(vp) {
    this.vp = vp;
    await this.send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: false });
  }
  _mouse(type, button) {
    const btns = { left: 1, right: 2, middle: 4 };
    return this.send('Input.dispatchMouseEvent', {
      type, x: this.mx, y: this.my, modifiers: this.mods,
      button: button || this.btn || 'none', buttons: btns[this.btn] || 0, clickCount: type === 'mouseMoved' ? 0 : 1
    });
  }
  _key(type, key) {
    const k = keyInfo(key);
    if (MODS[key]) this.mods = type === 'keyDown' ? (this.mods | MODS[key]) : (this.mods & ~MODS[key]);
    const p = { type: type === 'keyDown' && k.text ? 'keyDown' : type === 'keyDown' ? 'rawKeyDown' : 'keyUp', key, code: k.code,
      windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk, modifiers: this.mods };
    if (type === 'keyDown' && k.text && !(this.mods & (MODS.Control | MODS.Alt | MODS.Meta))) { p.text = k.text; p.unmodifiedText = k.text; }
    return this.send('Input.dispatchKeyEvent', p);
  }
}

class Handle {
  constructor(page, sel, i) { this.page = page; this.sel = sel; this.i = i; }
  _ev(fn) { return this.page.evaluate(fn, [this.sel, this.i]); }
  textContent() { return this._ev(([s, i]) => { const e = document.querySelectorAll(s)[i]; return e ? e.textContent : null; }); }
  getAttribute(name) { return this.page.evaluate(([s, i, n]) => { const e = document.querySelectorAll(s)[i]; return e ? e.getAttribute(n) : null; }, [this.sel, this.i, name]); }
  isVisible() { return this._ev(([s, i]) => { const e = document.querySelectorAll(s)[i]; if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; }); }
  boundingBox() { return this._ev(([s, i]) => { const e = document.querySelectorAll(s)[i]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }); }
  async click() {
    const b = await this._ev(([s, i]) => { const e = document.querySelectorAll(s)[i]; e.scrollIntoView({ block: 'center', inline: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await this.page.mouse.click(b.x, b.y);
  }
}

class Context {
  constructor(br, id, viewport) { this.br = br; this.id = id; this.vp = viewport; }
  async newPage() {
    const t = await this.br.c.send('Target.createTarget', { url: 'about:blank', browserContextId: this.id });
    const a = await this.br.c.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
    const pg = new Page(this.br.c, a.sessionId, this.vp);
    await pg._init();
    return pg;
  }
}

class Browser {
  constructor(proc, conn, dir) { this.proc = proc; this.c = conn; this.dir = dir; }
  async newContext(opts) {
    const r = await this.c.send('Target.createBrowserContext', {});
    return new Context(this, r.browserContextId, (opts && opts.viewport) || { width: 1280, height: 720 });
  }
  async close() {
    try { await Promise.race([this.c.send('Browser.close'), sleep(3000)]); } catch (e) {}
    try { this.c.ws.close(); } catch (e) {}
    try { this.proc.kill(); } catch (e) {}
    for (let i = 0; i < 10; i++) {   // Edge lets go of its profile a moment after it exits
      try { fs.rmSync(this.dir, { recursive: true, force: true }); break; } catch (e) { await sleep(300); }
    }
  }
}

let seq = 0;
const chromium = {
  async launch(opts) {
    if (!EDGE) throw new Error('pwshim: Microsoft Edge not found (set EDGE_PATH)');
    const dir = path.join(os.tmpdir(), 'pwshim-' + process.pid + '-' + (seq++) + '-' + Date.now());
    fs.mkdirSync(dir, { recursive: true });
    const args = ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + dir, '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--disable-sync', '--hide-scrollbars', '--mute-audio', '--disable-features=msEdgeSidebarV2'].concat((opts && opts.args) || [], ['about:blank']);
    const proc = spawn(EDGE, args, { stdio: 'ignore' });
    const portFile = path.join(dir, 'DevToolsActivePort');
    let lines = null;
    for (let i = 0; i < 300 && !lines; i++) {
      await sleep(100);
      try { const t = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/); if (t.length >= 2 && t[1]) lines = t; } catch (e) {}
    }
    if (!lines) { try { proc.kill(); } catch (e) {} throw new Error('pwshim: Edge did not open its debugging port'); }
    const ws = new WebSocket('ws://127.0.0.1:' + lines[0] + lines[1]);
    await new Promise((ok, no) => { ws.addEventListener('open', ok); ws.addEventListener('error', () => no(new Error('pwshim: cannot reach Edge'))); });
    return new Browser(proc, new Conn(ws), dir);
  }
};

module.exports = { chromium };
