/* Screens to look at: the LAN World screen, the Create New World Game tab with
   its mode description, the inventory at the narrow (≤900px) layout, and the
   creative survival tab without its crafting grid. desktop shell. */
const D = require('../mc-drive');
const SHOTS = require('path').join(__dirname, '..', 'shots'); require('fs').mkdirSync(SHOTS, { recursive: true });   // gitignored
(async () => {
  const g = await D.open({ page: '/comp/', query: '?dev=mc', w: 1400, h: 900 });
  const H = (e) => g.h(e);
  const shotEl = async (name, sel, pad) => { const r = await g.ev(([sel, pad]) => { const e = document.querySelector(sel); const b = e.getBoundingClientRect(); return { x: Math.max(0, b.left - pad), y: Math.max(0, b.top - pad), width: b.width + pad * 2, height: b.height + pad * 2 }; }, [sel, pad || 0]); await g.page.screenshot({ path: SHOTS + '/vis-' + name + '.png', clip: r }); };
  try {
    await g.ev(() => { const H = window.__h; H.root = () => document.querySelector('.mc'); H.ui = () => document.querySelector('.mc-mui'); });
    await g.wait('window.__h.byName("Singleplayer")', 120000);
    await H('clickName("Singleplayer")'); await g.wait('window.__h.byName("Create New World")');
    await H('clickName("Create New World")'); await g.wait('window.__h.byName("World Name")');
    await g.sleep(300);
    await shotEl('create-survival', '.mc-mcv', 0);
    await H('clickName("Game Mode: Survival")'); await g.wait('window.__h.byName("Game Mode: Hardcore")'); await g.sleep(200);
    await shotEl('create-hardcore', '.mc-mcv', 0);
    await H('clickName("Game Mode: Hardcore")'); await g.wait('window.__h.byName("Game Mode: Creative")'); await g.sleep(200);
    await shotEl('create-creative', '.mc-mcv', 0);
    await H('clickName("Game Mode: Creative")'); await g.wait('window.__h.byName("Game Mode: Survival")');
    await H('clickName("Create New World")');
    await g.wait('(function(){var s=window.__h.screens(); return s.load===false && s.pause===true;})()', 120000);
    await g.sleep(200);
    await shotEl('pause-menu', '.mc-pause .mc-pmain', 12);
    await g.ev(() => { const b = document.querySelector('.mc-lanbtn'); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.click(); });
    await g.sleep(150);
    await shotEl('lan-screen', '.mc-pause .mc-lan', 12);
    await g.ev(() => { const p = document.querySelector('.mc-lanport'); p.value = '80'; p.dispatchEvent(new Event('input', { bubbles: true })); });
    await g.sleep(100);
    await shotEl('lan-bad-port', '.mc-pause .mc-lan', 12);
    await g.ev(() => { const b = document.querySelector('.mc-lancancel'); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.click(); });
    // the narrow layout
    await g.page.setViewportSize({ width: 860, height: 700 });
    await g.sleep(400);
    await g.ev(() => { const b = document.querySelector('.mc-resume'); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.click(); });
    await g.sleep(200);
    await H('key("e")'); await g.sleep(250);
    await shotEl('inventory-narrow', '.mc-panel', 6);
    await H('key("e")'); await g.sleep(100);
    await g.page.setViewportSize({ width: 1400, height: 900 });
    await g.sleep(400);
    await H('key("e")'); await g.sleep(250);
    await shotEl('inventory-wide', '.mc-panel', 6);
    await H('key("e")'); await g.sleep(100);
    console.log('shots written');
  } catch (e) { console.log('FAILED', e.stack); }
  console.log('pageerrors', g.errors);
  await g.close();
})();
