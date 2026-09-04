/* Headless driver for comp/minecraft.js. Boots the game in mc-menu.html (the
   game at native size, outside the desktop shell) or in the desktop itself,
   and drives it with REAL events — the title-screen buttons by accessible
   name, the world by keydown/keyup on .mc and mousedown on the canvas, slots
   by mousedown/mousemove/mouseup on the slot — the way TESTING.md demands.
   Dotfolder: committed, never published.

     node .claude/comp-tools/serve.js . 8571 &
     node .claude/comp-tools/mc-play/drag.js        (any suite in mc-play/)

   Needs Playwright (npm i -g playwright, or set PLAYWRIGHT_PATH) and its
   Chromium. MC_BASE overrides the server (default http://localhost:8571).
   Headless Chromium has no pointer lock, so a shim grants it; to "press
   Escape in the world" a suite calls document.exitPointerLock(), which is
   what the browser does, and the game pauses off the lock change. */
const pw = (function () {
    var tries = [process.env.PLAYWRIGHT_PATH, 'playwright'];
    try { tries.push(require('child_process').execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() + '/playwright'); } catch (e) {}
    for (var i = 0; i < tries.length; i++) { if (!tries[i]) continue; try { return require(tries[i]); } catch (e) {} }
    throw new Error('playwright not found: npm i -g playwright, or set PLAYWRIGHT_PATH');
})();
const BASE = process.env.MC_BASE || 'http://localhost:8571';

const LOCK_SHIM = `(() => {
  // Headless Chromium has no pointer lock. Stand in for it the way a browser
  // that granted it would: set pointerLockElement and fire pointerlockchange.
  let locked = null;
  Object.defineProperty(Document.prototype, 'pointerLockElement', { get() { return locked; }, configurable: true });
  Element.prototype.requestPointerLock = function () {
    const el = this;
    return new Promise((res) => { setTimeout(() => { locked = el; document.dispatchEvent(new Event('pointerlockchange')); res(); }, 0); });
  };
  Document.prototype.exitPointerLock = function () {
    if (!locked) return; locked = null;
    setTimeout(() => document.dispatchEvent(new Event('pointerlockchange')), 0);
  };
  window.__lockShim = true;
})();`;

async function open(opts) {
  opts = opts || {};
  const browser = await pw.chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const ctx = await browser.newContext({ viewport: { width: opts.w || 1080, height: opts.h || 620 } });
  const page = await ctx.newPage();
  const errors = [], logs = [];
  page.on('pageerror', e => { errors.push(String(e.message || e)); });
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push(t + ': ' + m.text()); });
  if (opts.lockShim !== false) await page.addInitScript(LOCK_SHIM);
  if (opts.init) await page.addInitScript(opts.init);
  const url = BASE + (opts.page || '/.claude/comp-tools/mc-menu.html') + (opts.query || ('?w=' + (opts.w || 1080) + '&h=' + (opts.h || 620)));
  await page.goto(url);
  // the in-page helper set: everything is a real event on the real control
  await page.evaluate(() => {
    const host = document.getElementById('host') || document.body;
    const H = window.__h = {};
    H.root = () => host.querySelector('.mc');
    H.ui = () => host.querySelector('.mc-mui');
    H.byName = (n) => { const ui = H.ui(); if (!ui) return null; const all = ui.querySelectorAll('[aria-label]'); for (const el of all) if (el.getAttribute('aria-label') === n) return el; return null; };
    H.names = () => { const ui = H.ui(); return ui ? Array.from(ui.querySelectorAll('[aria-label]')).map(e => e.getAttribute('aria-label') + (e.disabled ? ' (off)' : '')) : []; };
    H.click = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const o = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true, button: 0, detail: 1 };
      el.dispatchEvent(new MouseEvent('mousemove', o)); el.dispatchEvent(new MouseEvent('mousedown', o));
      el.dispatchEvent(new MouseEvent('mouseup', o)); el.dispatchEvent(new MouseEvent('click', o));
      return true;
    };
    H.clickName = (n) => H.click(H.byName(n));
    H.type = (el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    H.keyAt = (t, k, code) => {
      t.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: code || '', bubbles: true, cancelable: true }));
      t.dispatchEvent(new KeyboardEvent('keyup', { key: k, code: code || '', bubbles: true, cancelable: true }));
    };
    H.key = (k, opts) => { const r = H.root(); const o = Object.assign({ key: k, bubbles: true, cancelable: true }, opts || {}); r.dispatchEvent(new KeyboardEvent('keydown', o)); r.dispatchEvent(new KeyboardEvent('keyup', o)); };
    H.keyDown = (k) => H.root().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    H.keyUp = (k) => H.root().dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true, cancelable: true }));
    H.canvasMouse = (type, button) => { const cv = host.querySelector('.mc-cv'); cv.dispatchEvent(new MouseEvent(type, { button: button || 0, buttons: button === 2 ? 2 : 1, bubbles: true, cancelable: true })); };
    H.mouseUpWin = (button) => { window.dispatchEvent(new MouseEvent('mouseup', { button: button || 0, bubbles: true })); };
    H.slotEl = (g, i) => host.querySelector('.mc-panelwrap .mc-slot[data-g="' + g + '"][data-i="' + i + '"]');
    H.slotMouse = (g, i, type, button, extra) => {
      const el = H.slotEl(g, i); if (!el) return false;
      const r = el.getBoundingClientRect();
      const o = Object.assign({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true, button: button || 0, buttons: button === 2 ? 2 : button === 1 ? 4 : 1 }, extra || {});
      el.dispatchEvent(new MouseEvent(type, o));
      return true;
    };
    H.slotClick = (g, i, right, shift) => {
      const el = H.slotEl(g, i); if (!el) return false;
      const r = el.getBoundingClientRect();
      const o = { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true, shiftKey: !!shift };
      el.dispatchEvent(new MouseEvent('mousemove', o));
      // a browser delivers mouseup to the element under the pointer (it bubbles to window from there)
      if (right) { el.dispatchEvent(new MouseEvent('mousedown', Object.assign({ button: 2, buttons: 2 }, o))); el.dispatchEvent(new MouseEvent('contextmenu', Object.assign({ button: 2 }, o))); el.dispatchEvent(new MouseEvent('mouseup', Object.assign({ button: 2 }, o))); }
      else { el.dispatchEvent(new MouseEvent('mousedown', Object.assign({ button: 0, buttons: 1 }, o))); el.dispatchEvent(new MouseEvent('mouseup', Object.assign({ button: 0 }, o))); el.dispatchEvent(new MouseEvent('click', Object.assign({ button: 0 }, o))); }
      return true;
    };
    H.slotView = (g, i) => { const el = H.slotEl(g, i); if (!el) return null; const ct = el.querySelector('.mc-ct'); const bg = el.style.backgroundImage || ''; return { has: el.classList.contains('has') || bg !== '' && bg !== 'none', bg: bg.slice(0, 40), count: ct ? ct.textContent : '' }; };
    H.panel = () => { const w = host.querySelector('.mc-panelwrap'); if (!w || w.style.display === 'none') return null; const p = w.querySelector('.mc-panel'); return { cls: p ? p.className : null, head: (w.querySelector('.mc-phead') || {}).textContent || null, slots: w.querySelectorAll('.mc-slot').length, cur: (w.querySelector('.mc-cur') || {}).style ? w.querySelector('.mc-cur').style.display : null }; };
    H.screens = () => { const q = (s) => { const e = host.querySelector(s); return e ? (e.style.display !== 'none') : null; }; return { load: q('.mc-load'), pause: q('.mc-pause'), death: q('.mc-death'), menu: !!H.ui(), nohud: H.root().classList.contains('mc-nohud'), spect: H.root().classList.contains('mc-spect') }; };
    H.save = () => window.MC.__proof.save();
    H.hotbar = () => Array.from(host.querySelectorAll('.mc-hotbar .mc-slot')).map(s => ({ sel: s.classList.contains('sel'), has: s.classList.contains('has'), ct: (s.querySelector('.mc-ct') || {}).textContent || '' }));
    H.chatOpen = () => { const ci = host.querySelector('.mc-chatin'); return ci && getComputedStyle(ci).display !== 'none' && document.activeElement === ci; };
    H.chatRun = (line) => { H.key('t'); const ci = host.querySelector('.mc-chatin'); if (!ci) return false; ci.focus(); ci.value = line; ci.dispatchEvent(new Event('input', { bubbles: true })); ci.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); return true; };
    H.chatLog = () => Array.from(host.querySelectorAll('.mc-chatlog .mc-chatline, .mc-chat .mc-chatline, .mc-chatlines > *')).map(e => e.textContent);
  });
  const g = {
    browser, page, errors, logs,
    ev: (fn, arg) => page.evaluate(fn, arg),
    h: (expr) => page.evaluate('window.__h.' + expr),
    wait: (expr, ms) => page.waitForFunction('(function(){ try { return ' + expr + ' } catch (e) { return false } })()', null, { timeout: ms || 60000, polling: 50 }),
    sleep: (ms) => page.waitForTimeout(ms),
    close: () => browser.close(),
    shot: (path) => page.screenshot({ path })
  };
  return g;
}
module.exports = { open, BASE };
