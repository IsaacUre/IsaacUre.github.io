/* The smaller creative-screen fixes: Java catalogue clicks, middle-clone guard,
   the E and Escape keystroke fixes, hover shortcuts (1-9, Q, T), creative
   eating, and the syntax-error caret. Desktop shell. */
const D = require('../mc-drive');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };
(async () => {
  const g = await D.open({ page: '/comp/', query: '?dev=mc&mcdev=creative,kit&mcseed=1337', w: 1400, h: 900 });
  const H = (e) => g.h(e);
  const curView = () => g.ev(() => { const c = document.querySelector('.mc-panelwrap .mc-cur'); return c && c.style.display !== 'none' ? (c.querySelector('.mc-ct') || { textContent: '1' }).textContent : null; });
  const tab = (i) => g.ev((i) => { const b = document.querySelector('.mc-ctab[data-ct="' + i + '"]'); const r = b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: r.left + 5, clientY: r.top + 5 })); window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })); }, i);
  const hover = (gr, i) => H(`slotMouse("${gr}", ${i}, "mousemove", 0, {buttons:0})`);
  const rootKey = (k, extra) => g.ev(([k, extra]) => { const r = document.querySelector('.mc'); const o = Object.assign({ key: k, bubbles: true, cancelable: true }, extra || {}); const ev = new KeyboardEvent('keydown', o); const notPrevented = r.dispatchEvent(ev); r.dispatchEvent(new KeyboardEvent('keyup', o)); return notPrevented; }, [k, extra]);
  try {
    await g.ev(() => { const H = window.__h; H.root = () => document.querySelector('.mc'); H.ui = () => document.querySelector('.mc-mui'); });
    await g.wait('(function(){ return window.__mc && window.__mc.state().ready; })()', 120000);
    await g.ev(() => { for (let i = 0; i < 36; i++) window.__mc.setSlot(i, null); });
    // ── Java catalogue clicks
    // the creative scenario opens the catalogue by itself on boot; open it only if it is not up
    if (!(await H('panel()'))) { await H('key("e")'); await g.sleep(200); }
    ok((await H('panel()')).cls === 'mc-panel mc-cpanel', 'creative screen open');
    ok((await H('slotView("creat", 0)')).count === '', 'catalogue entries carry no count badge');
    await H('slotClick("creat", 0)');
    ok((await curView()) === '1', 'a click takes one item', await curView());
    await H('slotClick("creat", 0)');
    ok((await curView()) === '2', 'clicking the same entry again adds one', await curView());
    await H('slotClick("creat", 0, true)');
    ok((await curView()) === '1', 'right-click on it removes one', await curView());
    await H('slotClick("creat", 0, false, true)');
    ok((await curView()) === '64', 'shift-click fills the cursor to a stack', await curView());
    await H('slotClick("creat", 1, true)');
    ok((await curView()) === '63', 'right-click on a different entry takes one off the cursor', await curView());
    await H('slotClick("creat", 1)');
    ok((await curView()) === null, 'left-click on a different entry clears the cursor', await curView());
    await H('slotClick("creat", 2, false, true)');
    ok((await curView()) === '64', 'shift-click on an empty cursor: a full stack');
    await H('slotMouse("creat", 3, "mousedown", 1)'); await H('mouseUpWin(1)');
    ok((await curView()) === '64', 'middle-click leaves a carried stack alone', await curView());
    await H('slotClick("inv", 0)');
    await H('slotMouse("creat", 3, "mousedown", 1)'); await H('mouseUpWin(1)');
    ok((await curView()) === '64', 'middle-click on an empty cursor clones a full stack', await curView());
    await H('slotClick("inv", 1)');
    // ── hover shortcuts: 1-9 over the catalogue, over the hotbar; Q; T
    await hover('creat', 4); await rootKey('5');
    const hb = await H('hotbar()');
    ok(hb[4].has && hb[4].ct === '64', '5 over a catalogue entry drops a full stack into hotbar slot 5', hb[4]);
    await hover('inv', 4); await rootKey('7');
    const hb2 = await H('hotbar()');
    ok(!hb2[4].has && hb2[6].has && hb2[6].ct === '64', '7 over hotbar slot 5 swaps it into slot 7', [hb2[4], hb2[6]]);
    const drops0 = (await g.ev(() => window.__mc.state())).drops;
    await hover('inv', 6); await rootKey('q');
    ok((await g.ev(() => window.__mc.state())).drops === drops0 + 1 && (await H('hotbar()'))[6].ct === '63', 'Q over a slot throws one', (await H('hotbar()'))[6]);
    await rootKey('q', { ctrlKey: true });
    ok((await g.ev(() => window.__mc.state())).drops === drops0 + 2 && !(await H('hotbar()'))[6].has, 'Ctrl-Q throws the rest');
    await rootKey('t');
    ok((await H('panel()')).head === 'Search Items' && (await g.ev(() => document.activeElement.className)) === 'mc-csearchin', 'T over a catalogue tab jumps to Search with the box focused');
    ok((await g.ev(() => document.querySelector('.mc-csearchin').value)) === '', 'and the box is empty');
    // ── E on the search tab: close, reopen, the box must be empty and focused
    await g.ev(() => { const s = document.querySelector('.mc-csearchin'); s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
    await g.sleep(100);
    ok(!(await H('panel()')), 'Escape in the box closes the screen');
    const notPrevented = await rootKey('e');
    await g.sleep(150);
    ok(!notPrevented, 'the E keydown that opens the screen is preventDefault-ed (so it cannot type into the box)');
    ok((await H('panel()')).head === 'Search Items' && (await g.ev(() => document.querySelector('.mc-csearchin').value)) === '', 'reopening lands on Search with an empty box', await g.ev(() => document.querySelector('.mc-csearchin').value));
    // ── tab hover tooltip, right-click on a tab does nothing
    await g.ev(() => { const b = document.querySelector('.mc-ctab[data-ct="2"]'); const r = b.getBoundingClientRect(); document.querySelector('.mc-panelwrap').dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + 5, clientY: r.top + 5 })); b.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + 5, clientY: r.top + 5 })); });
    ok((await g.ev(() => { const t = document.querySelector('.mc-ptip'); return t.style.display !== 'none' ? t.textContent : null; })) === 'Tools', 'hovering a tab names it');
    await g.ev(() => { const b = document.querySelector('.mc-ctab[data-ct="2"]'); const r = b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 2, clientX: r.left + 5, clientY: r.top + 5 })); b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })); window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 2 })); });
    await g.sleep(60);
    ok((await H('panel()')).head === 'Search Items', 'a right-click on a tab does not switch tabs');
    // ── the review's six: inert while carrying, the bin, Q from the catalogue, digits in the search box
    await H('slotClick("creat", 0)');                       // one item on the cursor (Search tab)
    await hover('inv', 6);
    const hbBefore = await H('hotbar()');
    const dropsB = (await g.ev(() => window.__mc.state())).drops;
    await rootKey('3'); await rootKey('q');
    ok(JSON.stringify(await H('hotbar()')) === JSON.stringify(hbBefore) && (await g.ev(() => window.__mc.state())).drops === dropsB, 'number keys and Q are inert while a stack is carried');
    await H('slotClick("inv", 8)');                         // put it down in hotbar 9
    await hover('creat', 0);
    await rootKey('q');
    ok((await g.ev(() => window.__mc.state())).drops === dropsB + 1, 'Q over a catalogue entry throws one');
    await rootKey('q', { ctrlKey: true });
    ok((await g.ev(() => window.__mc.state())).drops === dropsB + 2, 'Ctrl-Q over a catalogue entry throws a stack');
    await g.ev(() => document.querySelector('.mc-csearchin').focus());
    await hover('creat', 1);
    await g.ev(() => { const b = document.querySelector('.mc-csearchin'); b.dispatchEvent(new KeyboardEvent('keydown', { key: '4', bubbles: true, cancelable: true })); });
    const hb4 = await H('hotbar()');
    ok(hb4[3].has && hb4[3].ct === '64' && (await g.ev(() => document.querySelector('.mc-csearchin').value)) === '', 'a digit over an entry with the box focused goes to the hotbar, not the box', [hb4[3], await g.ev(() => document.querySelector('.mc-csearchin').value)]);
    await tab(8); await g.sleep(80);
    const hb0 = (await H('hotbar()'))[0];
    await hover('ctrash', 0); await rootKey('1');
    ok(JSON.stringify((await H('hotbar()'))[0]) === JSON.stringify(hb0), 'a number over the bin leaves the hotbar alone', (await H('hotbar()'))[0]);
    await H('key("e")'); await g.sleep(100);
    if (await H('panel()')) { await H('key("e")'); await g.sleep(100); }
    // ── eating in creative at full hunger
    await g.ev(() => { window.__mc.setSlot(0, 'bread', 3); window.__mc.sel(0); });
    await g.ev(() => { window.__mc.give('apple', 1); });
    const food0 = (await g.ev(() => window.__mc.state())).food;
    await H('canvasMouse("mousedown", 2)');
    await g.sleep(2200);
    await H('mouseUpWin(2)');
    const held = await g.ev(() => window.__mc.heldStack());
    ok(food0 === 20 && held && held.id === 'bread' && held.c === 3, 'creative eats bread at full hunger and the stack does not shrink', { food0, held });
    // ── the caret of a bad argument
    await g.ev(() => window.__mc.chat('/gamemode 4'));
    const last = await g.ev(() => { const l = document.querySelectorAll('.mc-chatlog .mc-cline'); const e = l[l.length - 1]; return { t: e.textContent, u: (e.querySelector('.mc-cu') || {}).textContent || null }; });
    ok(!last.u && last.t === 'gamemode 4<--[HERE]', 'the caret sits after the bad game mode, nothing underlined', last);
    // ── Q over the crafting result crafts one and throws it (survival screen)
    await g.ev(() => window.__mc.chat('/gamemode survival')); await g.sleep(50);
    await g.ev(() => { for (let i = 0; i < 36; i++) window.__mc.setSlot(i, null); });
    await H('key("e")'); await g.sleep(200);
    await g.ev(() => { window.__mc.craftGrid([['planks', 4], ['planks', 4], null, ['planks', 4], ['planks', 4], null, null, null, null]); });
    await g.ev(() => window.__mc.slotClick('inv', 35));   // any click repaints the result slot
    const dropsC = (await g.ev(() => window.__mc.state())).drops;
    await hover('cout', 0); await rootKey('q');
    ok((await g.ev(() => window.__mc.state())).drops === dropsC + 1 && (await g.ev(() => window.__mc.craftSnap()))[0] === 'planks:3', 'Q over the result crafts one table and throws it, spending the grid once', await g.ev(() => window.__mc.craftSnap()));
    await H('key("e")'); await g.sleep(100);
  } catch (e) { console.log('FAILED', e.stack); fails++; await g.shot(__dirname + '/shot-extras-fail.png').catch(() => {}); }
  console.log('pageerrors', g.errors);
  ok(g.errors.length === 0, 'no page errors');
  await g.close();
  console.log(fails ? 'FAILURES: ' + fails : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
