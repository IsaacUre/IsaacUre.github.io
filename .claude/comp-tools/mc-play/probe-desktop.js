/* Probe 2: the desktop shell (comp/index.html?dev=mc), the lore world
   "creative flat test", block placing, catalogue tabs and search. */
const D = require('../mc-drive');
const SHOTS = require('path').join(__dirname, '..', 'shots'); require('fs').mkdirSync(SHOTS, { recursive: true });   // gitignored
(async () => {
  const g = await D.open({ page: '/comp/', query: '?dev=mc', w: 1400, h: 900 });
  const out = (k, v) => console.log(k.padEnd(34), JSON.stringify(v));
  try {
    // the desktop wraps the game; point the helpers at the game root
    await g.ev(() => { const H = window.__h; const host = document.querySelector('.mc') ? document.querySelector('.mc').parentNode : document.body; H.root = () => document.querySelector('.mc'); H.ui = () => document.querySelector('.mc-mui'); });
    await g.wait('window.__h.byName("Singleplayer")', 120000);
    out('title', await g.h('names()'));
    await g.h('clickName("Singleplayer")');
    await g.wait('window.__h.byName("Create New World")');
    out('select world', await g.h('names()'));
    // pick the lore creative world by its accessible name
    const names = await g.h('names()');
    const lore = names.find(n => /creative flat test/.test(n));
    out('lore row', lore);
    await g.ev((n) => window.__h.clickName(n), lore);
    await g.sleep(200);
    await g.wait('!window.__h.byName("Play Selected World").disabled');
    await g.h('clickName("Play Selected World")');
    await g.wait('(function(){var s=window.__h.screens(); return s.load===false && s.pause===true;})()', 120000);
    out('in lore world', await g.h('screens()'));
    out('save', await g.h('save()'));
    await g.ev(() => { const b = document.querySelector('.mc-resume'); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.click(); });
    await g.sleep(300);
    out('after resume', await g.h('screens()'));
    out('active el', await g.ev(() => document.activeElement && (document.activeElement.className || document.activeElement.tagName)));
    // real keydown from the document root, as the browser would deliver it to the focused element
    await g.ev(() => { const t = document.activeElement || document.body; t.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true, cancelable: true })); t.dispatchEvent(new KeyboardEvent('keyup', { key: 'e', bubbles: true, cancelable: true })); });
    await g.sleep(200);
    out('panel after E (activeElement)', await g.h('panel()'));
    if (!(await g.h('panel()'))) { await g.h('key("e")'); await g.sleep(200); out('panel after E (root)', await g.h('panel()')); }
    // tabs: click each tab button and read the header
    const tabs = [];
    for (let i = 0; i < 9; i++) {
      await g.ev((i) => { const b = document.querySelector('.mc-ctab[data-ct="' + i + '"]'); if (b) { const r = b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: r.left + 5, clientY: r.top + 5 })); window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })); } }, i);
      await g.sleep(60);
      const p = await g.h('panel()');
      tabs.push(p && p.head);
    }
    out('tabs', tabs);
    // search
    await g.ev(() => { const b = document.querySelector('.mc-ctab[data-ct="7"]'); const r = b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: r.left + 5, clientY: r.top + 5 })); });
    await g.sleep(60);
    await g.ev(() => { const s = document.querySelector('.mc-csearchin'); s.focus(); s.value = 'diamond'; s.dispatchEvent(new Event('input', { bubbles: true })); });
    await g.sleep(60);
    out('search diamond slot0', await g.h('slotView("creat", 0)'));
    out('active after search', await g.ev(() => document.activeElement && document.activeElement.className));
    // take a block, close, place it with a real right click
    await g.ev(() => { const b = document.querySelector('.mc-ctab[data-ct="0"]'); const r = b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: r.left + 5, clientY: r.top + 5 })); });
    await g.sleep(60);
    await g.h('slotClick("creat", 1)'); await g.h('slotClick("inv", 0)');
    await g.h('key("e")'); await g.sleep(200);
    out('screens after close', await g.h('screens()'));
    out('lock', await g.ev(() => document.pointerLockElement ? document.pointerLockElement.className : null));
    // look down a bit and right click
    await g.ev(() => { document.dispatchEvent(new MouseEvent('mousemove', { movementY: 200, bubbles: true })); });
    await g.h('canvasMouse("mousedown", 2)'); await g.sleep(60); await g.h('mouseUpWin(2)');
    await g.sleep(200);
    out('hotbar after place', await g.h('hotbar()'));
    await g.h('canvasMouse("mousedown", 0)'); await g.sleep(60); await g.h('mouseUpWin(0)');
    await g.sleep(200);
    out('hotbar after break', await g.h('hotbar()'));
    // double-tap space to fly and hold
    const py0 = (await g.h('save()')).py;
    await g.h('key(" ")'); await g.sleep(120); await g.h('key(" ")');
    await g.h('keyDown(" ")'); await g.sleep(700); await g.h('keyUp(" ")');
    out('py fly', [py0, (await g.h('save()')).py]);
    await g.shot(SHOTS + '/desktop.png');
  } catch (e) { console.log('FAILED', e.message); await g.shot(SHOTS + '/fail2.png').catch(() => {}); }
  console.log('pageerrors', g.errors);
  console.log('console', g.logs.slice(0, 20));
  await g.close();
})();
