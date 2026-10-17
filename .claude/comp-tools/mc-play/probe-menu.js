/* Probe 1: the player's path. Title → Singleplayer → Create New World →
   Game Mode: Creative → Create → in-world. Then what a creative player does. */
const D = require('../mc-drive');
const SHOTS = require('path').join(__dirname, '..', 'shots'); require('fs').mkdirSync(SHOTS, { recursive: true });   // gitignored
(async () => {
  const g = await D.open({});
  const out = (k, v) => console.log(k.padEnd(34), JSON.stringify(v));
  try {
    await g.wait('window.__h.byName("Singleplayer")', 90000);
    out('title screen', await g.h('names()'));
    await g.h('clickName("Singleplayer")');
    await g.wait('window.__h.byName("Create New World")');
    await g.h('clickName("Create New World")');
    await g.wait('window.__h.byName("World Name")');
    await g.ev(() => window.__h.type(window.__h.byName('World Name'), 'probe creative'));
    await g.h('clickName("Game Mode: Survival")');
    await g.wait('window.__h.byName("Game Mode: Hardcore")');
    await g.h('clickName("Game Mode: Hardcore")');
    await g.wait('window.__h.byName("Game Mode: Creative")');
    await g.h('clickName("Allow Cheats: OFF")');
    await g.wait('window.__h.byName("Allow Cheats: ON")');
    out('create screen', await g.h('names()'));
    await g.h('clickName("Create New World")');
    await g.wait('(function(){var s=window.__h.screens(); return s.load===false && s.pause===true;})()', 120000);
    out('in world', await g.h('screens()'));
    out('save', await g.h('save()'));
    // Back to Game: the pause menu's own button
    await g.ev(() => { const b = document.querySelector('.mc-resume'); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.click(); });
    await g.sleep(300);
    out('after resume', await g.h('screens()'));
    out('lockEl', await g.ev(() => document.pointerLockElement ? document.pointerLockElement.className : null));
    // E: the creative inventory
    await g.h('key("e")');
    await g.sleep(200);
    out('panel after E', await g.h('panel()'));
    out('creat slot 0', await g.h('slotView("creat", 0)'));
    // take a stack from the catalogue, drop it in the hotbar
    await g.h('slotClick("creat", 0)');
    await g.sleep(100);
    out('cur after take', await g.h('panel()'));
    await g.h('slotClick("inv", 0)');
    await g.sleep(100);
    out('hotbar after place', await g.h('hotbar()'));
    await g.h('key("e")');
    await g.sleep(200);
    out('panel after close', await g.h('panel()'));
    out('screens', await g.h('screens()'));
    // flight: double-tap space, then hold it, and read py
    const py0 = (await g.h('save()')).py;
    await g.h('key(" ")'); await g.sleep(120); await g.h('key(" ")');
    await g.h('keyDown(" ")'); await g.sleep(700); await g.h('keyUp(" ")');
    const py1 = (await g.h('save()')).py;
    out('py before/after fly', [py0, py1]);
    // break the block under the crosshair with a real click
    await g.ev(() => window.__h.root().focus());
    await g.h('canvasMouse("mousedown", 0)'); await g.sleep(50); await g.h('mouseUpWin(0)');
    await g.sleep(200);
    out('hotbar', await g.h('hotbar()'));
    // chat: /gamemode survival then creative again
    out('chat open', await g.h('chatRun("/gamemode survival")'));
    await g.sleep(300);
    out('save after /gamemode survival', await g.h('save()'));
    out('screens', await g.h('screens()'));
    await g.h('chatRun("/gamemode creative")');
    await g.sleep(300);
    out('save after /gamemode creative', await g.h('save()'));
    out('screens', await g.h('screens()'));
    await g.shot(SHOTS + '/creative-menu.png');
  } catch (e) { console.log('FAILED', e.message); await g.shot(SHOTS + '/fail.png').catch(() => {}); }
  console.log('pageerrors', g.errors);
  console.log('console', g.logs.slice(0, 20));
  await g.close();
})();
