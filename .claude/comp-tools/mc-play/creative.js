/* The creative-mode fixes, driven the way a player drives them, against the
   served build. */
const D = require('../mc-drive');
const SHOTS = require('path').join(__dirname, '..', 'shots'); require('fs').mkdirSync(SHOTS, { recursive: true });   // gitignored
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };
(async () => {
  const g = await D.open({ page: '/comp/', query: '?dev=mc', w: 1400, h: 900 });
  const H = (e) => g.h(e);
  const chatLines = () => g.ev(() => Array.from(document.querySelectorAll('.mc-chatlog .mc-cline')).map(e => ({ t: e.textContent, cls: e.className.replace('mc-cline', '').trim(), u: (e.querySelector('.mc-cu') || {}).textContent || null })));
  const pauseShown = () => g.ev(() => document.querySelector('.mc-pause').style.display !== 'none');
  const resume = () => g.ev(() => { const b = document.querySelector('.mc-resume'); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.click(); });
  const pressEsc = () => g.ev(() => { if (document.pointerLockElement) { document.exitPointerLock(); return 'unlock'; } document.querySelector('.mc').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return 'key'; });
  const clickBtn = (sel) => g.ev((sel) => { const b = document.querySelector(sel); if (!b) return false; b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.click(); return !b.disabled; }, sel);
  try {
    await g.ev(() => { const H = window.__h; H.root = () => document.querySelector('.mc'); H.ui = () => document.querySelector('.mc-mui'); });
    await g.wait('window.__h.byName("Singleplayer")', 120000);

    // ── A. the create screen keeps your choices through Hardcore, and Creative turns cheats on
    await H('clickName("Singleplayer")'); await g.wait('window.__h.byName("Create New World")');
    await H('clickName("Create New World")'); await g.wait('window.__h.byName("World Name")');
    await g.ev(() => window.__h.type(window.__h.byName('World Name'), 'fix creative'));
    await H('clickName("Difficulty: Normal")'); await g.wait('window.__h.byName("Difficulty: Hard")');
    await H('clickName("Difficulty: Hard")'); await g.wait('window.__h.byName("Difficulty: Peaceful")');
    await H('clickName("Difficulty: Peaceful")'); await g.wait('window.__h.byName("Difficulty: Easy")');
    await H('clickName("Game Mode: Survival")'); await g.wait('window.__h.byName("Game Mode: Hardcore")');
    ok(!!(await g.ev(() => { const b = window.__h.byName('Difficulty: Hard'); return b && b.disabled; })), 'Hardcore shows Difficulty: Hard, greyed');
    ok(!!(await g.ev(() => { const b = window.__h.byName('Allow Cheats: OFF'); return b && b.disabled; })), 'Hardcore shows Allow Cheats: OFF, greyed');
    await H('clickName("Game Mode: Hardcore")'); await g.wait('window.__h.byName("Game Mode: Creative")');
    ok(!!(await H('byName("Difficulty: Easy")')), 'leaving Hardcore for Creative brings back the Easy you chose', await H('names()'));
    ok(!!(await g.ev(() => { const b = window.__h.byName('Allow Cheats: ON'); return b && !b.disabled; })), 'an untouched Allow Cheats follows the mode: ON for Creative, still yours to flip');
    await H('clickName("Game Mode: Creative")'); await g.wait('window.__h.byName("Game Mode: Survival")');
    ok(!!(await g.ev(() => { const b = window.__h.byName('Allow Cheats: OFF'); return b && !b.disabled; })), 'back on Survival the switch is OFF again and live');
    await H('clickName("Game Mode: Survival")'); await g.wait('window.__h.byName("Game Mode: Hardcore")');
    await H('clickName("Game Mode: Hardcore")'); await g.wait('window.__h.byName("Game Mode: Creative")');
    await H('clickName("Create New World")');
    await g.wait('(function(){var s=window.__h.screens(); return s.load===false && s.pause===true;})()', 120000);
    const sv = await H('save()');
    ok(sv.gm === 1 && sv.cheats === true && sv.diff === 1, 'the creative world arrives creative, with cheats, on Easy', sv);
    await resume(); await g.sleep(200);
    await H('chatRun("/gamemode survival")'); await g.sleep(150);
    ok((await H('save()')).gm === 0, '/gamemode works in a creative-made world');
    await pressEsc(); await g.sleep(150);
    ok(await pauseShown(), 'Escape pauses');
    await clickBtn('.mc-totitle'); await g.wait('window.__h.byName("Singleplayer")', 120000);

    // ── B. a default world: no cheats, honest chat, and Open to LAN as the way in
    await H('clickName("Singleplayer")'); await g.wait('window.__h.byName("Create New World")');
    const order = await H('names()');
    ok(/^fix creative\./.test(order[1]), 'the world just played is first in the list', order.slice(0, 3));
    await H('clickName("Create New World")'); await g.wait('window.__h.byName("World Name")');
    await g.ev(() => window.__h.type(window.__h.byName('World Name'), 'plain'));
    await H('clickName("Create New World")');
    await g.wait('(function(){var s=window.__h.screens(); return s.load===false && s.pause===true;})()', 120000);
    ok((await H('save()')).cheats === false, 'a default world has Allow Cheats: OFF', await H('save()'));
    await resume(); await g.sleep(200);
    // suggestions: typing /gam offers nothing in a world without cheats
    await H('key("t")'); await g.sleep(50);
    await g.ev(() => { const ci = document.querySelector('.mc-chatin'); ci.value = '/gam'; ci.dispatchEvent(new Event('input', { bubbles: true })); });
    await g.sleep(50);
    const sug = await g.ev(() => { const b = document.querySelector('.mc-sug'); return { shown: b && getComputedStyle(b).display !== 'none', rows: b ? b.querySelectorAll('.mc-sugi').length : 0 }; });
    ok(!sug.shown, 'no suggestions for /gam without cheats', sug);
    await g.ev(() => { const ci = document.querySelector('.mc-chatin'); ci.value = '/'; ci.dispatchEvent(new Event('input', { bubbles: true })); });
    await g.sleep(50);
    const sug2 = await g.ev(() => Array.from(document.querySelectorAll('.mc-sug .mc-sugi')).map(e => e.textContent));
    ok(sug2.join(',') === 'help,list,me,seed', 'only the level-0 commands are offered without cheats', sug2);
    await g.ev(() => { const ci = document.querySelector('.mc-chatin'); ci.value = '/gamemode creative'; ci.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
    await g.sleep(150);
    let lines = await chatLines();
    ok(lines.length >= 2 && /Unknown or incomplete command/.test(lines[lines.length - 2].t), 'the command is refused as unknown', lines.slice(-2));
    ok(lines[lines.length - 1].u === 'gamemode creative' && /<--\[HERE\]$/.test(lines[lines.length - 1].t) && lines[lines.length - 1].cls === 'mc-ctx', 'context line: the whole input underlined, no slash, then <--[HERE]', lines.slice(-1));
    ok((await H('save()')).gm === 0, 'and the mode did not change');
    await H('chatRun("/seed")'); await g.sleep(150);
    lines = await chatLines();
    ok(/^Seed: \[/.test(lines[lines.length - 1].t), '/seed works without cheats, as it does in singleplayer', lines.slice(-1));
    await H('chatRun("/help")'); await g.sleep(150);
    lines = await chatLines();
    ok(/Showing 4 commands/.test(lines.map(l => l.t).join('|')), '/help lists the four level-0 commands the world has', lines.slice(-5).map(l => l.t));
    // the pause menu: Open to LAN
    await pressEsc(); await g.sleep(150);
    ok(await pauseShown(), 'Escape pauses again');
    ok(await g.ev(() => !document.querySelector('.mc-lanbtn').disabled), 'Open to LAN is live before publishing');
    await clickBtn('.mc-lanbtn'); await g.sleep(80);
    const lanUI = await g.ev(() => ({ shown: document.querySelector('.mc-lan').style.display !== 'none', main: document.querySelector('.mc-pmain').style.display, gm: document.querySelector('.mc-langm').textContent, ch: document.querySelector('.mc-lanch').textContent, port: document.querySelector('.mc-lanport').value, hint: document.querySelector('.mc-lanport').placeholder }));
    ok(lanUI.shown && lanUI.main === 'none' && lanUI.gm === 'Game Mode: Survival' && lanUI.ch === 'Allow Cheats: OFF' && lanUI.port === '' && /^\d{4,5}$/.test(lanUI.hint), 'the LAN screen opens with the world\'s mode and cheats and a picked port as the hint', lanUI);
    // Escape backs out to the menu, not the world
    await g.ev(() => { document.querySelector('.mc').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
    await g.sleep(80);
    ok(await g.ev(() => document.querySelector('.mc-lan').style.display === 'none' && document.querySelector('.mc-pmain').style.display !== 'none' && document.querySelector('.mc-pause').style.display !== 'none'), 'Escape on the LAN screen returns to the Game Menu');
    await clickBtn('.mc-lanbtn'); await g.sleep(80);
    await clickBtn('.mc-langm'); await g.sleep(30);
    ok((await g.ev(() => document.querySelector('.mc-langm').textContent)) === 'Game Mode: Creative', 'Game Mode cycles to Creative');
    await clickBtn('.mc-lanch'); await g.sleep(30);
    ok((await g.ev(() => document.querySelector('.mc-lanch').textContent)) === 'Allow Cheats: ON', 'Allow Cheats toggles ON');
    await g.ev(() => { const p = document.querySelector('.mc-lanport'); p.value = '80'; p.dispatchEvent(new Event('input', { bubbles: true })); });
    await g.sleep(30);
    ok(await g.ev(() => document.querySelector('.mc-lanstart').disabled && /1024/.test(document.querySelector('.mc-lanmsg').textContent)), 'a bad port greys Start LAN World and says why');
    await g.ev(() => { const p = document.querySelector('.mc-lanport'); p.value = '25565'; p.dispatchEvent(new Event('input', { bubbles: true })); });
    await g.sleep(30);
    await clickBtn('.mc-lanstart'); await g.sleep(200);
    ok(!(await pauseShown()), 'Start LAN World returns to the game');
    lines = await chatLines();
    ok(lines[lines.length - 1].t === 'Local game hosted on port 25565', 'chat announces the port', lines.slice(-1));
    await H('chatRun("/gamemode creative")'); await g.sleep(150);
    const sv2 = await H('save()');
    ok(sv2.gm === 1 && sv2.cheats === false, '/gamemode creative now works, while the world itself still records cheats OFF', sv2);
    ok(await g.ev(() => document.querySelector('.mc').classList.contains('mc-nohud')), 'the HUD switched to creative');
    await pressEsc(); await g.sleep(150);
    ok(await g.ev(() => document.querySelector('.mc-lanbtn').disabled), 'Open to LAN greys once the world is out');
    // Save and Quit: the LAN cheats end with the session; the mode you were in stays saved
    await clickBtn('.mc-totitle'); await g.wait('window.__h.byName("Singleplayer")', 120000);
    await H('clickName("Singleplayer")'); await g.wait('window.__h.byName("Create New World")');
    const names2 = await H('names()');
    ok(/^plain\. Creative Mode, Version/.test(names2[1]), 'the list shows the world as Creative Mode, without Cheats', names2[1]);
    await g.ev((n) => window.__h.clickName(n), names2[1]); await g.sleep(100);
    await g.wait('!window.__h.byName("Play Selected World").disabled');
    await H('clickName("Play Selected World")');
    await g.wait('(function(){var s=window.__h.screens(); return s.load===false && s.pause===true;})()', 120000);
    ok(await g.ev(() => !document.querySelector('.mc-lanbtn').disabled), 'Open to LAN is live again in the new session');
    await resume(); await g.sleep(200);
    await H('chatRun("/gamemode survival")'); await g.sleep(150);
    lines = await chatLines();
    ok((await H('save()')).gm === 1 && /Unknown or incomplete command/.test(lines[lines.length - 2].t), 'after re-entering, commands are gone again and the world is still creative', { gm: (await H('save()')).gm, last: lines.slice(-2).map(l => l.t) });
    // ── C. closing the window throws nothing
    await pressEsc(); await g.sleep(100);
    await g.ev(() => { const b = document.querySelector('.win[data-app="minecraft"] .cap.close'); b.click(); });
    await g.sleep(300);
    ok(await g.ev(() => !document.querySelector('.win[data-app="minecraft"]')), 'the window closed');
  } catch (e) { console.log('FAILED', e.stack); fails++; await g.shot(SHOTS + '/fix-fail.png').catch(() => {}); }
  console.log('pageerrors', g.errors);
  ok(g.errors.length === 0, 'no page errors across the run');
  console.log('console', g.logs.filter(l => !/INVALID_OPERATION|ERR_CONNECTION/.test(l)).slice(0, 10));
  await g.close();
  console.log(fails ? 'FAILURES: ' + fails : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
