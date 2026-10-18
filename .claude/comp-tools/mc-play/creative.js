/* The creative-mode fixes, driven the way a player drives them, against the
   served build. */
const D = require('../mc-drive');
const SHOTS = require('path').join(__dirname, '..', 'shots'); require('fs').mkdirSync(SHOTS, { recursive: true });   // gitignored
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };
(async () => {
  const g = await D.open({ page: '/tcomp/', query: '?dev=mc', w: 1400, h: 900 });
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
    // the pause menu: World Options..., where the LAN scope and the world's cheats live in 26.3
    await pressEsc(); await g.sleep(150);
    ok(await pauseShown(), 'Escape pauses again');
    ok(await g.ev(() => { const o = document.querySelector('.mc-optbtn'), w = document.querySelector('.mc-woptbtn'); return !!(o && w) && !w.disabled && Math.round(w.getBoundingClientRect().left - o.getBoundingClientRect().left) === Math.round(106 * +getComputedStyle(document.querySelector('.mc')).getPropertyValue('--gs')); }), 'Options... and World Options... share a row, 106 apart');
    await clickBtn('.mc-woptbtn'); await g.wait('!!window.__h.byName("Apply Changes")', 5000); await g.sleep(60);
    const wo = (await H('names()')).map(n => n.replace(/ \(off\)$/, ''));
    const woMenu = await g.ev(() => window.MC.__proof.menu());
    ok(woMenu && woMenu.scr === 'wopts' && (await g.ev(() => document.querySelector('.mc-pause').style.display === 'none')), 'World Options... opens the canvas screen over the paused world', woMenu && woMenu.scr);
    ok(['Default Game Mode: Survival', 'Personal Game Mode: Survival', 'Allow Cheats: OFF', 'Difficulty: Normal', 'Lock World Difficulty', 'Edit Game Rules...', 'Restrictions...', 'LAN: OFF', 'Port Number', 'Command Access: OFF', 'Force Game Mode: OFF', 'Apply Changes', 'Cancel'].every(n => wo.includes(n)), 'it lists the general and multiplayer settings with the world\'s values', wo);
    ok(await g.ev(() => window.__h.byName('Apply Changes').disabled && window.__h.byName('Port Number').disabled && window.__h.byName('Command Access: OFF').disabled), 'Apply Changes waits for a change; the port and guest settings wait for LAN', wo);
    // Escape backs out to the menu, not the world
    await g.ev(() => { document.querySelector('.mc').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
    await g.sleep(120);
    ok(await g.ev(() => !window.MC.__proof.menu() && document.querySelector('.mc-pmain').style.display !== 'none' && document.querySelector('.mc-pause').style.display !== 'none'), 'Escape on World Options returns to the Game Menu');
    await clickBtn('.mc-woptbtn');
    const seen = async (cond) => { try { await g.wait(cond, 3000); return true; } catch (e) { return false; } };   // the canvas screen repaints a frame or two after a click
    const clickW = async (n) => { await seen('!!window.__h.byName(' + JSON.stringify(n) + ')'); return H('clickName(' + JSON.stringify(n) + ')'); };   // and builds its proxies a frame after it opens
    await clickW('Default Game Mode: Survival');
    ok(await seen('!!window.__h.byName("Default Game Mode: Creative")'), 'Default Game Mode cycles in GameType\'s order: Creative after Survival', { names: (await H('names()')).slice(0, 4), menu: await g.ev(() => { const m = window.MC.__proof.menu(); return m && { scr: m.scr, w: m.w.slice(0, 3), hover: m.hover, focus: m.focus }; }), ui: await g.ev(() => { const u = document.querySelector('.mc-mui'); const c = u.children[0]; const r = c && c.getBoundingClientRect(); return { disp: u.style.display, n: u.children.length, first: c && { aria: c.getAttribute('aria-label'), i: c.getAttribute('data-i'), rect: r && [r.left, r.top, r.width, r.height], dis: c.disabled } }; }) });
    await clickW('Default Game Mode: Creative');
    ok(await seen('!!window.__h.byName("Default Game Mode: Adventure")'), 'then Adventure');
    await clickW('Default Game Mode: Adventure');
    await clickW('Default Game Mode: Spectator');
    ok(await seen('!!window.__h.byName("Default Game Mode: Survival")'), 'and round to Survival');
    await clickW('Allow Cheats: OFF');
    ok(await seen('!!window.__h.byName("Allow Cheats: ON") && !window.__h.byName("Apply Changes").disabled'), 'Allow Cheats toggles ON and Apply Changes comes alive');
    await clickW('LAN: OFF');
    ok(await seen('!!window.__h.byName("LAN: ON") && !window.__h.byName("Port Number").disabled'), 'LAN: ON opens the port box');
    await g.ev(() => { const p = window.__h.byName('Port Number'); p.value = '80'; p.dispatchEvent(new Event('input', { bubbles: true })); });
    ok(await seen('window.__h.byName("Apply Changes").disabled'), 'a bad port greys Apply Changes');
    await g.ev(() => { const p = window.__h.byName('Port Number'); p.value = '25565'; p.dispatchEvent(new Event('input', { bubbles: true })); });
    ok(await seen('!window.__h.byName("Apply Changes").disabled'), 'a good one brings it back');
    await clickW('Apply Changes');
    ok(await seen('!window.MC.__proof.menu() && document.querySelector(".mc-pmain").style.display !== "none"'), 'Apply Changes returns to the Game Menu, as setScreen(lastScreen) does');
    lines = await chatLines();
    ok(lines[lines.length - 1].t === 'This world is now open to LAN. The port number is 25565', 'chat announces the LAN scope and its port', lines.slice(-1));
    await resume(); await g.sleep(150);
    await H('chatRun("/gamemode creative")'); await g.sleep(150);
    const sv2 = await H('save()');
    ok(sv2.gm === 1 && sv2.cheats === true, '/gamemode creative now works, and the world records Allow Cheats ON', sv2);
    ok(await g.ev(() => document.querySelector('.mc').classList.contains('mc-nohud')), 'the HUD switched to creative');
    await pressEsc(); await g.sleep(150);
    await clickBtn('.mc-woptbtn'); await g.wait('!!window.__h.byName("Apply Changes")', 5000); await g.sleep(60);
    const wo2 = (await H('names()')).map(n => n.replace(/ \(off\)$/, ''));
    ok(wo2.includes('LAN: ON') && wo2.includes('Personal Game Mode: Creative') && (await g.ev(() => window.__h.byName('Port Number').value)) === '25565', 'World Options shows the LAN scope, its port and the new mode', wo2);
    await clickW('Cancel'); await g.sleep(150);
    // Save and Quit: the LAN scope ends with the session; the cheats and the mode are the world's now
    await clickBtn('.mc-totitle'); await g.wait('window.__h.byName("Singleplayer")', 120000);
    await H('clickName("Singleplayer")'); await g.wait('window.__h.byName("Create New World")');
    const names2 = await H('names()');
    ok(/^plain\. Creative Mode, Cheats, Version/.test(names2[1]), 'the list shows the world as Creative Mode with Cheats', names2[1]);
    await g.ev((n) => window.__h.clickName(n), names2[1]); await g.sleep(100);
    await g.wait('!window.__h.byName("Play Selected World").disabled');
    await H('clickName("Play Selected World")');
    await g.wait('(function(){var s=window.__h.screens(); return s.load===false && s.pause===true;})()', 120000);
    await clickBtn('.mc-woptbtn'); await g.wait('!!window.__h.byName("Apply Changes")', 5000); await g.sleep(60);
    const wo3 = (await H('names()')).map(n => n.replace(/ \(off\)$/, ''));
    ok(wo3.includes('LAN: OFF') && wo3.includes('Allow Cheats: ON'), 'a new session starts with LAN off and the world\'s cheats kept', wo3);
    await clickW('Cancel'); await g.sleep(150);
    await resume(); await g.sleep(200);
    await H('chatRun("/gamemode survival")'); await g.sleep(150);
    ok((await H('save()')).gm === 0, 'after re-entering, commands still work: Allow Cheats is the world\'s setting', await H('save()'));
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
