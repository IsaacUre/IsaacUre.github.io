/* Avatar screenshots against the served build. Desktop shell so the
   launcher's MCHOST.skin() (URE BOY by default) is what the figure wears. */
const D = require('../mc-drive');
const SHOTS = require('path').join(__dirname, '..', 'shots'); require('fs').mkdirSync(SHOTS, { recursive: true });   // gitignored
(async () => {
  const g = await D.open({ page: '/comp/', query: '?dev=mc&mcdev=kit&mcseed=1337', w: 1400, h: 900 });
  const out = (k, v) => console.log(k.padEnd(30), JSON.stringify(v));
  try {
    await g.ev(() => { const H = window.__h; H.root = () => document.querySelector('.mc'); H.ui = () => document.querySelector('.mc-mui'); });
    await g.wait('(function(){ return window.__mc && window.__mc.state().ready; })()', 120000);
    await g.h('key("e")'); await g.sleep(200);
    out('panel', await g.h('panel()'));
    const box = await g.ev(() => { const b = document.querySelector('.mc-avbox'); const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    out('avbox', box);
    const panelRect = await g.ev(() => { const r = document.querySelector('.mc-panel').getBoundingClientRect(); return { x: r.left - 4, y: r.top - 40, width: r.width + 8, height: r.height + 48 }; });
    async function shotAt(name, mx, my) {
      await g.ev(([mx, my]) => { const w = document.querySelector('.mc-panelwrap'); w.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: mx, clientY: my })); }, [mx, my]);
      await g.sleep(120);
      await g.page.screenshot({ path: SHOTS + '/av-' + name + '.png', clip: panelRect });
    }
    // armour on (the kit wears diamond), diamond pickaxe in hand, pointer at the centre
    await shotAt('armored-centre', box.x + box.w / 2, box.y + box.h * 0.25);
    await shotAt('armored-left-up', box.x - 300, box.y - 120);
    await shotAt('armored-right-down', box.x + 500, box.y + 500);
    // take the armour off with shift-clicks and hold a block, then an apple
    for (let i = 0; i < 4; i++) await g.h(`slotClick("armor", ${i}, false, true)`);
    await g.ev(() => { window.__mc.setSlot(0, 'cobble', 3); });
    await g.h('key("e")'); await g.sleep(60); await g.h('key("e")'); await g.sleep(150);
    await shotAt('bare-block', box.x + box.w / 2, box.y + box.h * 0.25);
    await g.ev(() => { window.__mc.setSlot(0, 'apple', 3); });
    await g.h('key("e")'); await g.sleep(60); await g.h('key("e")'); await g.sleep(150);
    await shotAt('bare-apple', box.x + box.w / 2, box.y + box.h * 0.25);
    await g.ev(() => { window.__mc.setSlot(0, null); });
    await g.h('key("e")'); await g.sleep(60); await g.h('key("e")'); await g.sleep(150);
    await shotAt('bare-empty-far-left', box.x - 900, box.y + box.h * 0.25);
    // big crop of just the box for a close look
    await g.page.screenshot({ path: SHOTS + '/av-box.png', clip: { x: box.x - 2, y: box.y - 2, width: box.w + 4, height: box.h + 4 } });
    // creative survival tab
    await g.ev(() => window.__mc.chat('/gamemode creative')); await g.sleep(50);   // closes the survival screen
    await g.h('key("e")'); await g.sleep(200);
    await g.ev(() => { const b = document.querySelector('.mc-ctab[data-ct="8"]'); const r = b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: r.left + 5, clientY: r.top + 5 })); window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })); });
    await g.sleep(200);
    const pr2 = await g.ev(() => { const r = document.querySelector('.mc-panel').getBoundingClientRect(); return { x: r.left - 4, y: r.top - 40, width: r.width + 8, height: r.height + 48 }; });
    await g.page.screenshot({ path: SHOTS + '/av-creative-tab.png', clip: pr2 });
    out('creative inv tab has avatar', await g.ev(() => !!document.querySelector('.mc-cpanel .mc-av')));
    out('skin used', await g.ev(() => window.MCHOST && window.MCHOST.skin().n));
  } catch (e) { console.log('FAILED', e.stack); }
  console.log('pageerrors', g.errors);
  console.log('console', g.logs.filter(l => !/INVALID_OPERATION|ERR_CONNECTION/.test(l)).slice(0, 10));
  await g.close();
})();
