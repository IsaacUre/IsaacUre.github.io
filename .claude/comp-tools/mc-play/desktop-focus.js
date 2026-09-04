/* The desktop shell's keyboard focus around the Minecraft window: title bar
   clicks and drags, caption buttons, another window closing, and Chrome's
   tab strip (which lives in a title bar and must still click).. */
const D = require('../mc-drive');
const SHOTS = require('path').join(__dirname, '..', 'shots'); require('fs').mkdirSync(SHOTS, { recursive: true });   // gitignored
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };
(async () => {
  const g = await D.open({ page: '/comp/', query: '?dev=mc&mcdev=kit&mcseed=1337', w: 1400, h: 900 });
  const H = (e) => g.h(e);
  const active = () => g.ev(() => { const a = document.activeElement; return a ? (a.tagName + '.' + a.className).slice(0, 40) : null; });
  const realClick = (sel, opts) => g.ev(([sel, opts]) => {
    const el = document.querySelector(sel); if (!el) return false;
    const r = el.getBoundingClientRect();
    const o = Object.assign({ bubbles: true, cancelable: true, button: 0, clientX: r.left + (opts && opts.dx != null ? opts.dx : r.width / 2), clientY: r.top + r.height / 2, pointerId: 1, isPrimary: true }, opts || {});
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    const md = new MouseEvent('mousedown', o);
    const notPrevented = el.dispatchEvent(md);
    if (notPrevented) { const f = el.closest('button, [tabindex]'); if (f && f.focus) f.focus(); else if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); }   // what the browser's default does on mousedown
    el.dispatchEvent(new PointerEvent('pointerup', o));
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.dispatchEvent(new MouseEvent('click', o));
    return true;
  }, [sel, opts || {}]);
  const keyE = () => g.ev(() => { const a = document.activeElement || document.body; a.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true })); a.dispatchEvent(new KeyboardEvent('keyup', { key: 'e', bubbles: true, cancelable: true })); });
  try {
    await g.ev(() => { const H = window.__h; H.root = () => document.querySelector('.mc'); H.ui = () => document.querySelector('.mc-mui'); });
    await g.wait('(function(){ return window.__mc && window.__mc.state().ready; })()', 120000);
    ok((await active()) === 'DIV.mc', 'the game root has focus after boot', await active());
    // ── the title bar
    await realClick('.win[data-app="minecraft"] .win-bar', { dx: 200 });
    ok((await active()) === 'DIV.mc', 'clicking the title bar leaves focus on the game', await active());
    await keyE(); await g.sleep(150);
    ok(!!(await H('panel()')), 'and E still opens the inventory');
    await keyE(); await g.sleep(100);
    // ── the maximize caption
    await realClick('.win[data-app="minecraft"] .cap[data-cap="max"]');
    await g.sleep(100);
    ok((await g.ev(() => document.querySelector('.win[data-app="minecraft"]').classList.contains('maxi'))), 'the window maximised');
    ok((await active()) === 'DIV.mc', 'the caption button did not take focus', await active());
    await keyE(); await g.sleep(150);
    ok(!!(await H('panel()')), 'E works after maximising');
    await keyE(); await g.sleep(100);
    await realClick('.win[data-app="minecraft"] .cap[data-cap="max"]'); await g.sleep(100);
    // ── another window opens over the game and is closed again
    await realClick('.tb-center > .tb-btn.app[data-app="terminal"]');   // the taskbar's pinned Terminal
    await g.sleep(400);
    ok((await g.ev(() => !!document.querySelector('.win[data-app="terminal"]'))), 'Terminal opened from the taskbar');
    await realClick('.win[data-app="terminal"] .cap[data-cap="close"]');
    await g.sleep(300);
    ok(!(await g.ev(() => !!document.querySelector('.win[data-app="terminal"]'))), 'Terminal closed');
    ok((await active()) === 'DIV.mc', 'closing it hands the keyboard back to the game', await active());
    await keyE(); await g.sleep(150);
    ok(!!(await H('panel()')), 'E opens the inventory straight away');
    await keyE(); await g.sleep(100);
    // ── Chrome's tab strip still clicks
    const chromeIcon = await g.ev(() => { const el = document.querySelector('.desk [data-app="chrome"], .icons [data-app="chrome"], [data-app="chrome"]:not(.win)'); if (!el) return false; el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true })); return true; });
    await g.sleep(700);
    const chromeOpen = await g.ev(() => !!document.querySelector('.win[data-app="chrome"]'));
    if (!chromeOpen) console.log('NOTE Chrome could not be opened from the DOM here (icon found: ' + chromeIcon + '); tab-strip check skipped');
    const tabs0 = chromeOpen ? await g.ev(() => document.querySelectorAll('.win[data-app="chrome"] .cr-tab').length) : -1;
    if (chromeOpen) {
      await realClick('.win[data-app="chrome"] .cr-plusbtn');
      await g.sleep(300);
      const tabs1 = await g.ev(() => document.querySelectorAll('.win[data-app="chrome"] .cr-tab').length);
      ok(tabs1 === tabs0 + 1, 'the new-tab button in Chrome\'s title bar still works', { tabs0, tabs1 });
      const before = await g.ev(() => Array.from(document.querySelectorAll('.win[data-app="chrome"] .cr-tab')).map(t => t.className));
      await realClick('.win[data-app="chrome"] .cr-tab');
      await g.sleep(300);
      const after = await g.ev(() => Array.from(document.querySelectorAll('.win[data-app="chrome"] .cr-tab')).map(t => t.className));
      ok(JSON.stringify(before) !== JSON.stringify(after), 'clicking the first tab switches to it', { before, after });
      await realClick('.win[data-app="chrome"] .cap[data-cap="close"]'); await g.sleep(300);
    }
    // ── dragging the game window by its bar keeps the keyboard
    await g.ev(() => { const bar = document.querySelector('.win[data-app="minecraft"] .win-bar'); const r = bar.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, button: 0, pointerId: 2, isPrimary: true, clientX: r.left + 200, clientY: r.top + 10 };
      bar.dispatchEvent(new PointerEvent('pointerdown', o)); const nd = bar.dispatchEvent(new MouseEvent('mousedown', o)); if (nd && document.activeElement) document.activeElement.blur();
      bar.dispatchEvent(new PointerEvent('pointermove', Object.assign({}, o, { clientX: r.left + 260, clientY: r.top + 50 })));
      bar.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, o, { clientX: r.left + 260, clientY: r.top + 50 }))); bar.dispatchEvent(new MouseEvent('mouseup', o)); });
    await g.sleep(100);
    ok((await active()) === 'DIV.mc', 'after dragging the window the game still has the keyboard', await active());
  } catch (e) { console.log('FAILED', e.stack); fails++; }
  // a synthetic PointerEvent has no active pointer, so the desktop's own
  // setPointerCapture in its (unchanged) drag handler throws under the harness only
  const real = g.errors.filter(e => !/setPointerCapture/.test(e));
  console.log('pageerrors', real);
  ok(real.length === 0, 'no page errors (beyond the harness pointer-capture artefact)');
  await g.close();
  console.log(fails ? 'FAILURES: ' + fails : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
