/* The Minecraft Launcher, driven like a person: Start → pin → PLAY, and the
   rest of its pages by real clicks. What it checks is the launcher behaving
   like the real one on a real desktop: no OS toast for anything it does, a
   vanilla-shaped latest.log, Explorer's own empty-folder text under .minecraft,
   plain copy on Settings / About / sign-in / other games, and the crash path
   (window.__mclForceCrash) writing a real-format crash report behind the
   launcher's own crash dialog. Desktop shell, served build.

     node .claude/comp-tools/serve.js . 8571 &
     node .claude/comp-tools/mc-play/launcher.js */
const D = require('../mc-drive');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };
// every string the launcher used to say that a real launcher never would
const TELLS = /pixels|Pixel Edition|UreOS|URE Launcher|Have fun|Reticulating|Suspicious|promise|the void|before times|built in another|holds the door|wallpaper|IT admin|two buttons|Fresh grass|Welcome back|Already working|Launching Minecraft/i;

const TOAST_WATCH = `(() => {
  window.__toasts = [];
  addEventListener('DOMContentLoaded', () => new MutationObserver(ms => {
    for (const m of ms) for (const n of m.addedNodes)
      if (n.nodeType === 1 && n.classList.contains('toast')) window.__toasts.push(n.textContent);
  }).observe(document.body, { childList: true }));
})();`;

async function run(forceCrash) {
  const g = await D.open({ page: '/comp/', query: '', w: 1400, h: 900, init: TOAST_WATCH + (forceCrash ? 'window.__mclForceCrash = true;' : '') });
  const page = g.page;
  const click = async (sel) => { await page.waitForSelector(sel, { state: 'visible', timeout: 15000 }); await page.click(sel); };
  const text = (sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent : null; }, sel);
  const toasts = () => page.evaluate(() => window.__toasts.slice());
  try {
    await page.waitForSelector('#startBtn');
    await click('#startBtn');
    await click('.pin[data-app="mclauncher"]');
    await page.waitForSelector('.mcl .mcl-play[data-mca="play"]');

    if (!forceCrash) {
      // ── the launch itself
      await click('.mcl .mcl-play[data-mca="play"]');
      await page.waitForSelector('.mcl-play.dl');
      await page.click('.mcl-playslot .mcl-play.dl').catch(() => {});         // a second press mid-download
      await page.waitForFunction(() => !!document.querySelector('.mc'), null, { timeout: 30000 });
      await page.waitForTimeout(400);
      ok((await toasts()).length === 0, 'no OS toast during the launch (nor for the second press)', await toasts());
      ok(!!(await page.$('.win[data-app="minecraft"]')), 'the game window opened');
      ok((await text('.win[data-app="minecraft"] .win-title')) === 'Minecraft 26.2', 'the game window is titled with its version', await text('.win[data-app="minecraft"] .win-title'));
      ok(!(await page.$('.win[data-app="mclauncher"]')), 'by default the launcher hides while the game runs');
      ok(!(await page.$('.tb-btn.app[data-app="mclauncher"].running')), 'and has no live taskbar button');
      const log = await page.evaluate(() => JSON.parse(localStorage.getItem('comp_mc_log')).text);
      ok(/^\[\d\d:\d\d:\d\d\] \[Datafixer Bootstrap\/INFO\]: \d+ Datafixer optimizations took \d+ milliseconds\n\[\d\d:\d\d:\d\d\] \[Render thread\/INFO\]: Environment: Environment\[/.test(log), 'latest.log opens like a vanilla client log', log.split('\n').slice(0, 2));
      ok(/Setting user: isaacure/.test(log) && /Narrator library for x64 successfully loaded$/.test(log), 'latest.log has the real first and last lines');
      ok(!TELLS.test(log), 'latest.log has none of the old tells');
      ok(!(await page.evaluate(() => JSON.parse(localStorage.getItem('comp_mc_crash') || '[]').length)), 'no crash report on a good launch');

      // ── Explorer: the .minecraft tree wears Explorer's own empty text
      await page.evaluate(() => { document.querySelector('.win[data-app="minecraft"] .cap.close').click(); });
      await page.waitForSelector('.win[data-app="mclauncher"] .mcl', { timeout: 5000 }).catch(() => {});
      ok(!!(await page.$('.win[data-app="mclauncher"] .mcl')), 'the launcher comes back when the game exits');
      await click('.mcl [data-mct="installations"]');
      await click('.mcl [data-mca="openmc"]');
      await page.waitForSelector('.win[data-app="explorer"]');
      const openFolder = async (name) => {
        await page.evaluate((n) => {
          const row = Array.from(document.querySelectorAll('.win[data-app="explorer"] .fitem'))
            .find(e => e.textContent.trim().startsWith(n));
          if (!row) throw new Error('no row ' + n);
          row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
        }, name);
        await page.waitForTimeout(250);
      };
      let emptyTxt = null;
      try { await openFolder('resourcepacks'); emptyTxt = await text('.win[data-app="explorer"] .exp-empty'); } catch (e) { emptyTxt = 'ERR ' + e.message; }
      ok(emptyTxt === 'This folder is empty.', 'an empty .minecraft folder shows Explorer\'s own text', emptyTxt);
      await page.evaluate(() => { document.querySelector('.win[data-app="explorer"] .cap.close').click(); });

      // ── Settings + About
      await click('.mcl [data-mcg="lsettings"]');
      const general = await text('.mcl-setbody');
      ok(/Keep the Launcher open while games are running/.test(general) && /Open output log when Minecraft: Java Edition starts/.test(general), 'settings use the launcher\'s labels');
      ok(!TELLS.test(general) && !/like it is 2012|Like clouds|All of it/.test(general), 'settings hints carry no quips', general.slice(0, 200));
      await click('.mcl [data-mcs="about"]');
      const about = await text('.mcl-setbody');
      ok(/Minecraft Launcher/.test(about) && !/URE Launcher|Pixel|another window|Legally/.test(about), 'About names the launcher plainly', about);
      ok(!(await page.$('[data-mca="licenses"]')), 'the joke licenses file is gone');

      // ── another game: INSTALL ends in the launcher's own dialog, not a toast
      await click('.mcl [data-mcg="dungeons"]');
      const blurb = await text('.mcl-otherblurb');
      ok(!TELLS.test(blurb), 'the other-game blurb is plain', blurb);
      await click('.mcl [data-mca="otherbtn"]');
      await page.waitForSelector('.dlg');
      const dlg = await text('.dlg');
      ok(/Minecraft Dungeons/.test(dlg) && /isn’t available on this device/.test(dlg), 'INSTALL answers with a dialog', dlg);
      await page.keyboard.press('Escape');
      ok((await toasts()).length === 0, 'still no toast');

      // ── sign out / in, and the patch notes
      await click('.mcl [data-mcg="java"]');
      await click('.mcl [data-mca="acct"]');
      const menu = await text('.mcl-menu');
      ok(menu === 'Log out', 'the account menu is just Log out', menu);
      await click('.mcl-menu [data-mk="logout"]');
      const signin = await text('.mcl-signin');
      ok(/Sign in with your Microsoft account/.test(signin) && !TELLS.test(signin), 'sign-in page is plain', signin);
      await click('.mcl [data-mca="signin"]');
      await page.waitForSelector('.mcl .mcl-tabs');   // back on Java Edition, on whichever tab was open
      ok((await toasts()).length === 0, 'signing back in raises no toast');
      await click('.mcl [data-mct="notes"]');
      const notes = await page.evaluate(() => Array.from(document.querySelectorAll('.mcl-notecard')).length);
      await click('.mcl [data-mca="note"][data-id="0"]');
      const note = await text('.mcl-notelist');
      ok(notes > 5 && !/another window|seam|were real/.test(note), 'patch notes lost the fourth wall', note);

      // ── reset: the page resets, nothing is announced
      await click('.mcl [data-mcg="lsettings"]');
      await click('.mcl [data-mcs="general"]');   // Settings reopens on the sub-tab it was left on
      await click('.mcl [data-mca="mcreset"]');
      await page.waitForSelector('.dlg');
      const confirm = await text('.dlg .dlg-msg');
      ok(!/factory|rebuilt/.test(confirm), 'reset confirm is plain', confirm);
      await page.click('.dlg .dlg-btn.primary');
      await page.waitForTimeout(300);
      ok((await toasts()).length === 0, 'reset raises no toast');

      // ── "Keep the Launcher open" on: the launcher stays behind the game
      await click('.mcl [data-mca="settoggle"][data-id="keepOpen"]');
      await click('.mcl [data-mcg="java"]');
      await click('.mcl [data-mct="play"]');
      await click('.mcl .mcl-play[data-mca="play"]');
      await page.waitForFunction(() => !!document.querySelector('.mc'), null, { timeout: 30000 });
      await page.waitForTimeout(300);
      ok(!!(await page.$('.win[data-app="mclauncher"] .mcl')), 'with keep-open on the launcher stays open while the game runs');
      ok(!!(await page.$('.tb-btn.app[data-app="mclauncher"].running')), 'and keeps its taskbar button');
      await page.evaluate(() => { document.querySelector('.win[data-app="minecraft"] .cap.close').click(); });
      await page.waitForTimeout(300);
      ok((await page.$$('.win[data-app="mclauncher"]')).length === 1, 'closing the game leaves exactly one launcher window');
      ok((await toasts()).length === 0, 'no toast for any of that');
    } else {
      // ── the failure path: the launcher's crash dialog + a real-format crash report
      await click('.mcl .mcl-play[data-mca="play"]');
      await page.waitForSelector('.dlg', { timeout: 30000 });
      const dlg = await text('.dlg');
      ok(/The game crashed!/.test(dlg) && /An unexpected issue occurred and the game has crashed/.test(dlg) && /Exit code: -1/.test(dlg), 'the crash dialog reads like the launcher\'s', dlg);
      ok(!/ClassNotFound|honest|existed/.test(dlg), 'crash dialog has none of the old tells');
      const crash = await page.evaluate(() => JSON.parse(localStorage.getItem('comp_mc_crash'))[0]);
      ok(/^crash-\d{4}-\d\d-\d\d_\d\d\.\d\d\.\d\d-client\.txt$/.test(crash.n), 'crash file is named like the game names them', crash.n);
      ok(/^---- Minecraft Crash Report ----\n\/\/ I just don't know what went wrong :\(\n\nTime: \d{4}-\d\d-\d\d \d\d:\d\d:\d\d\nDescription: Initializing game/.test(crash.text), 'crash report header is the real one');
      ok(/-- System Details --\nDetails:\n\tMinecraft Version: 26\.2\n/.test(crash.text) && /JVM Flags: 9 total; -XX:HeapDumpPath=/.test(crash.text), 'System Details block is real-shaped');
      ok(!TELLS.test(crash.text), 'crash report has none of the old tells');
      const log = await page.evaluate(() => JSON.parse(localStorage.getItem('comp_mc_log')).text);
      ok(/\[Render thread\/ERROR\]: GLFW error 65542: WGL: The driver does not appear to support OpenGL\n#@!@# Game crashed! Crash report saved to: #@!@# C:\\Users\\isaac\\AppData\\Roaming\\.minecraft\\crash-reports\\crash-/.test(log), 'the failed launch\'s log ends with the GLFW error and the game\'s crash line', log.split('\n').slice(-2));
      ok(/GLFW error before init: \[0x10006\]WGL: The driver does not appear to support OpenGL/.test(crash.text), 'the report carries the GLFW boot exception');
      await page.click('.dlg .dlg-btn.primary');
      await page.waitForSelector('.win[data-app="notepad"]');
      const np = await page.evaluate(() => (document.querySelector('.win[data-app="notepad"] textarea') || {}).value || document.querySelector('.win[data-app="notepad"]').textContent);
      ok(/---- Minecraft Crash Report ----/.test(np), 'View crash report opens the report in Notepad');
      ok(/has crashed\./.test(await text('.mcl-crashbar')), 'the crash strip is plain', await text('.mcl-crashbar'));
      ok((await toasts()).length === 0, 'no toast on the crash path either');
    }
  } catch (e) { ok(false, 'suite threw: ' + e.message); }
  console.log('pageerrors', g.errors);
  await g.close();
}
(async () => {
  await run(false);
  await run(true);
  console.log(fails ? 'FAILURES: ' + fails : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
