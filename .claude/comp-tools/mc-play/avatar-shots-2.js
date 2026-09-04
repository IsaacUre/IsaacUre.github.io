/* Avatar, part two: outside the desktop (no MCHOST → the built-in Steve),
   armour off, a sword in hand, and the drag-split preview mid-sweep. */
const D = require('../mc-drive');
const SHOTS = require('path').join(__dirname, '..', 'shots'); require('fs').mkdirSync(SHOTS, { recursive: true });   // gitignored
(async () => {
  const g = await D.open({ page: '/.claude/comp-tools/mc-menu.html', query: '?w=1080&h=620&mcdev=kit&mcseed=1337', w: 1080, h: 620 });
  const out = (k, v) => console.log(k.padEnd(30), JSON.stringify(v));
  try {
    await g.wait('(function(){ return window.__mc && window.__mc.state().ready; })()', 120000);
    await g.ev(() => { for (let i = 0; i < 36; i++) window.__mc.setSlot(i, null); });
    await g.h('key("e")'); await g.sleep(200);
    for (let i = 0; i < 4; i++) await g.h(`slotClick("armor", ${i}, false, true)`);
    out('armour worn after shift-clicks', await g.ev(() => document.querySelectorAll('.mc-panelwrap .mc-slot[data-g="armor"].has').length));
    const box = await g.ev(() => { const b = document.querySelector('.mc-avbox'); const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const panelRect = await g.ev(() => { const r = document.querySelector('.mc-panel').getBoundingClientRect(); return { x: r.left - 4, y: r.top - 4, width: r.width + 8, height: r.height + 8 }; });
    async function shotAt(name, mx, my, clip) {
      await g.ev(([mx, my]) => { const w = document.querySelector('.mc-panelwrap'); w.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: mx, clientY: my })); }, [mx, my]);
      await g.sleep(120);
      await g.page.screenshot({ path: SHOTS + '/av2-' + name + '.png', clip: clip || { x: box.x - 2, y: box.y - 2, width: box.w + 4, height: box.h + 4 } });
    }
    await shotAt('steve-bare', box.x + box.w / 2, box.y + box.h * 0.25);
    await shotAt('steve-bare-right', box.x + box.w + 200, box.y + box.h * 0.25);
    await g.ev(() => { window.__mc.setSlot(0, 'diamond_sword', 1); }); await g.sleep(50);
    await g.h('key("e")'); await g.sleep(60); await g.h('key("e")'); await g.sleep(150);
    await shotAt('steve-sword', box.x + box.w / 2, box.y + box.h * 0.25);
    await shotAt('steve-sword-left', box.x - 200, box.y + box.h * 0.25);
    await g.ev(() => { window.__mc.setSlot(0, 'torch', 5); }); await g.sleep(50);
    await g.h('key("e")'); await g.sleep(60); await g.h('key("e")'); await g.sleep(150);
    await shotAt('steve-torch', box.x + box.w / 2, box.y + box.h * 0.25);
    // leather + iron mix, to see two materials
    await g.ev(() => { window.__mc.setSlot(1, 'leather_helm', 1); window.__mc.setSlot(2, 'iron_chest', 1); window.__mc.setSlot(3, 'gold_legs', 1); window.__mc.setSlot(4, 'iron_boots', 1); });
    await g.h('key("e")'); await g.sleep(60); await g.h('key("e")'); await g.sleep(150);
    for (let i = 1; i <= 4; i++) await g.h(`slotClick("inv", ${i}, false, true)`);
    await shotAt('steve-mixed-armour', box.x + box.w / 2, box.y + box.h * 0.25);
    // mid-sweep preview
    await g.ev(() => { window.__mc.setSlot(0, 'planks', 8); }); await g.sleep(50);
    await g.h('key("e")'); await g.sleep(60); await g.h('key("e")'); await g.sleep(150);
    await g.h('slotClick("inv", 0)');
    await g.h('slotMouse("craft", 0, "mousedown", 0)');
    for (const i of [0, 1, 2]) await g.h(`slotMouse("craft", ${i}, "mousemove", 0, {buttons:1})`);
    await g.sleep(80);
    await g.page.screenshot({ path: SHOTS + '/av2-sweep.png', clip: panelRect });
    await g.ev(() => window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })));
    await g.sleep(80);
    await g.page.screenshot({ path: SHOTS + '/av2-after-sweep.png', clip: panelRect });
    out('craft after', await g.ev(() => window.__mc.craftSnap()));
  } catch (e) { console.log('FAILED', e.stack); }
  console.log('pageerrors', g.errors);
  console.log('console', g.logs.filter(l => !/INVALID_OPERATION|ERR_CONNECTION/.test(l)).slice(0, 10));
  await g.close();
})();
