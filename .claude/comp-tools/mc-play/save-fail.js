/* Storage full: the save must say so, and /me and /list work without cheats. */
const D = require('../mc-drive');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };
(async () => {
  const g = await D.open({ page: '/comp/', query: '?dev=mc', w: 1400, h: 900,
    init: "(function(){ var real = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (window.__quota && /^comp_mc/.test(k)) { var e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } return real.call(this, k, v); }; })();" });
  const H = (e) => g.h(e);
  const pressEsc = () => g.ev(() => { if (document.pointerLockElement) { document.exitPointerLock(); return 'unlock'; } document.querySelector('.mc').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return 'key'; });
  const chatLast = (n) => g.ev((n) => Array.from(document.querySelectorAll('.mc-chatlog .mc-cline')).slice(-n).map(e => e.textContent), n);
  try {
    await g.ev(() => { const H = window.__h; H.root = () => document.querySelector('.mc'); H.ui = () => document.querySelector('.mc-mui'); });
    await g.wait('window.__h.byName("Singleplayer")', 120000);
    await H('clickName("Singleplayer")'); await g.wait('window.__h.byName("Create New World")');
    await H('clickName("Create New World")'); await g.wait('window.__h.byName("World Name")');
    await H('clickName("Create New World")');
    await g.wait('(function(){var s=window.__h.screens(); return s.load===false && s.pause===true;})()', 120000);
    await g.ev(() => { const b = document.querySelector('.mc-resume'); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.click(); });
    await g.sleep(200);
    // level-0 commands without cheats
    await H('chatRun("/me waves")'); await g.sleep(120);
    ok((await chatLast(1))[0] === '* Steve waves', '/me works without cheats', await chatLast(1));
    await H('chatRun("/list")'); await g.sleep(120);
    ok(/players online/.test((await chatLast(1))[0]), '/list works without cheats', await chatLast(1));
    await H('chatRun("/help")'); await g.sleep(120);
    ok(/Showing 4 commands/.test((await chatLast(5)).join('|')), '/help counts the four level-0 commands', await chatLast(5));
    // storage fills: pausing saves, and the save fails
    await g.ev(() => { window.__quota = true; });
    await pressEsc(); await g.sleep(300);
    const toast = await g.ev(() => Array.from(document.querySelectorAll('.mc-toast')).map(t => t.textContent));
    ok(toast.some(t => /World not saved/.test(t)), 'a failed save raises a toast', toast);
    await g.ev(() => { const b = document.querySelector('.mc-totitle'); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.click(); });
    await g.wait('window.__h.byName("Singleplayer")', 120000);
    const menu = await g.ev(() => window.MC.__proof.menu());
    ok(menu && /could not be saved/.test(menu.msg || ''), 'the title screen says the world could not be saved', menu && menu.msg);
  } catch (e) { console.log('FAILED', e.stack); fails++; }
  console.log('pageerrors', g.errors);
  ok(g.errors.length === 0, 'no page errors');
  await g.close();
  console.log(fails ? 'FAILURES: ' + fails : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
