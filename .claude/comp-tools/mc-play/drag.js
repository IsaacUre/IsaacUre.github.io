/* Drag-split checks against the served build. Real mousedown /
   mousemove / mouseup on the real slots, then the inventory is read back
   through the DOM (counts in .mc-ct) and window.MC.__proof, never by calling
   internals. ?mcdev=kit lands straight in a survival world with a kit. */
const D = require('../mc-drive');
const SHOTS = require('path').join(__dirname, '..', 'shots'); require('fs').mkdirSync(SHOTS, { recursive: true });   // gitignored
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? 'PASS ' : 'FAIL ') + msg + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')); if (!c) fails++; };
(async () => {
  const g = await D.open({ page: '/comp/', query: '?dev=mc&mcdev=kit&mcseed=1337', w: 1400, h: 900 });
  const H = (expr) => g.h(expr);
  try {
    await g.ev(() => { const H = window.__h; H.root = () => document.querySelector('.mc'); H.ui = () => document.querySelector('.mc-mui'); });
    await g.wait('(function(){ return window.__mc && window.__mc.state().ready; })()', 120000);
    // an empty inventory apart from what each check puts in
    const setInv = (arr) => g.ev((arr) => { for (let i = 0; i < 36; i++) window.__mc.setSlot(i, null); arr.forEach(([i, id, c]) => window.__mc.setSlot(i, id, c)); }, arr);
    const invSnap = () => g.ev(() => { const o = {}; document.querySelectorAll('.mc-panelwrap .mc-slot[data-g="inv"]').forEach(el => { const i = el.getAttribute('data-i'); if (el.classList.contains('has')) o[i] = (el.querySelector('.mc-ct') || { textContent: '1' }).textContent; }); return o; });
    const craftSnap = () => g.ev(() => window.__mc.craftSnap());
    const curView = () => g.ev(() => { const c = document.querySelector('.mc-panelwrap .mc-cur'); return c && c.style.display !== 'none' ? (c.querySelector('.mc-ct') || { textContent: '1' }).textContent : null; });
    const down = (gr, i, b) => H(`slotMouse("${gr}", ${i}, "mousedown", ${b})`);
    const move = (gr, i, b) => H(`slotMouse("${gr}", ${i}, "mousemove", ${b}, {buttons:${b === 2 ? 2 : b === 1 ? 4 : 1}})`);
    const upAt = (gr, i, b) => g.ev(([gr, i, b]) => { const el = window.__h.slotEl(gr, i); const r = el.getBoundingClientRect(); window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: b, clientX: r.left + 5, clientY: r.top + 5 })); }, [gr, i, b]);
    const upOn = (gr, i, b) => g.ev(([gr, i, b]) => { const el = window.__h.slotEl(gr, i); const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: b, clientX: r.left + 5, clientY: r.top + 5 })); }, [gr, i, b]);

    // ── 1. left-drag: 8 planks over the 2x2 grid → 2 each, cursor empty, output = table
    await setInv([[0, 'planks', 8]]);
    await H('key("e")'); await g.sleep(150);
    ok(!!(await H('panel()')), 'inventory opens');
    await H('slotClick("inv", 0)');                       // pick up the 8 planks (press with an empty cursor acts at once)
    ok((await curView()) === '8', 'picked up 8 planks on the press', await curView());
    await down('craft', 0, 0); await move('craft', 0, 0); await move('craft', 1, 0); await move('craft', 2, 0);
    // mid-sweep preview: three slots swept → 2 each, cursor shows 2 left
    const prev = await g.ev(() => Array.from(document.querySelectorAll('.mc-panelwrap .mc-slot.qc')).map(e => e.getAttribute('data-i') + ':' + (e.querySelector('.mc-ct') || {}).textContent));
    ok(prev.join(',') === '0:2,1:2,2:2', 'preview shows 2 in each of the three swept slots', prev);
    ok((await curView()) === '2', 'preview cursor shows 2 left', await curView());
    ok((await craftSnap()).filter(Boolean).length === 0, 'nothing is placed until the button comes up');
    await move('craft', 3, 0); await upOn('craft', 3, 0);
    ok(JSON.stringify(await craftSnap()).startsWith('["planks:2","planks:2","planks:2","planks:2"'), 'release splits 8 planks as 2/2/2/2', await craftSnap());
    ok((await curView()) === null, 'cursor is empty after an exact split', await curView());
    ok((await H('slotView("cout", 0)')).has, 'the 2x2 grid of planks shows a crafting table');
    // take the table out with a plain click, then close: the grid empties
    await H('slotClick("cout", 0)');
    ok((await curView()) === '1' || (await curView()) === '', 'the table is on the cursor', await curView());
    await H('key("e")'); await g.sleep(100);
    ok((await g.ev(() => window.__mc.invSnap())).table === 1, 'closing hands the table back to the inventory', await g.ev(() => window.__mc.invSnap()));

    // ── 2. remainder: 7 planks over 3 slots → 2 each, 1 stays on the cursor
    await setInv([[0, 'planks', 7]]);
    await H('key("e")'); await g.sleep(120);
    await H('slotClick("inv", 0)');
    await down('craft', 0, 0); await move('craft', 0, 0); await move('craft', 1, 0); await move('craft', 2, 0); await upOn('craft', 2, 0);
    ok(JSON.stringify((await craftSnap()).slice(0, 3)) === '["planks:2","planks:2","planks:2"]', '7 over 3 slots is 2/2/2', await craftSnap());
    ok((await curView()) === '1' || (await curView()) === '', 'and 1 plank stays on the cursor', await curView());
    // ── 3. you cannot sweep more slots than items: 1 plank left, sweeping 2 slots keeps 1 slot only
    await down('inv', 9, 0); await move('inv', 9, 0); await move('inv', 10, 0); await upOn('inv', 10, 0);
    const s3 = await invSnap();
    ok(s3['9'] === '1' && !s3['10'], 'one item sweeps at most one slot, and lands as a plain click', s3);
    await H('key("e")'); await g.sleep(100);

    // ── 4. right-drag: one per slot, and the pressed slot counts
    await setInv([[0, 'cobble', 10]]);
    await H('key("e")'); await g.sleep(120);
    await H('slotClick("inv", 0)');
    await down('craft', 0, 2); await move('craft', 0, 2); await move('craft', 1, 2); await move('craft', 3, 2); await upOn('craft', 3, 2);
    ok(JSON.stringify(await craftSnap()).startsWith('["cobble:1","cobble:1",null,"cobble:1"'), 'right-sweep drops one in each swept slot', await craftSnap());
    ok((await curView()) === '7', 'and 7 stay on the cursor', await curView());
    // ── 5. a single right-click still places exactly one, and a single left-click still places the stack
    await H('slotClick("craft", 2, true)');
    ok((await craftSnap())[2] === 'cobble:1', 'plain right-click places one', await craftSnap());
    await H('slotClick("inv", 20)');
    const s5 = await invSnap();
    ok(s5['20'] === '6' && (await curView()) === null, 'plain left-click places the remaining 6', s5);
    // ── 6. a slot already holding the same item joins the sweep and fills to its limit
    await g.sleep(300);               // not within 250 ms of the last click on this slot, or it is a double-click gather
    await H('slotClick("inv", 20)');  // pick the 6 back up
    await down('craft', 0, 0); await move('craft', 0, 0); await move('craft', 1, 0); await upOn('craft', 1, 0);
    ok((await craftSnap())[0] === 'cobble:4' && (await craftSnap())[1] === 'cobble:4', 'same-item slots fill on top of what they hold (1+3, 1+3)', await craftSnap());
    await H('key("e")'); await g.sleep(100);

    // ── 7. double-click gathers matching stacks into the cursor, partial stacks first
    await setInv([[0, 'cobble', 5], [3, 'cobble', 64], [12, 'cobble', 20], [14, 'dirt', 9], [30, 'cobble', 10]]);
    await H('key("e")'); await g.sleep(120);
    await down('inv', 0, 0); await upOn('inv', 0, 0);          // click 1: pick up 5
    await g.sleep(30);
    await down('inv', 0, 0); await upOn('inv', 0, 0);          // click 2 within 250ms: gather
    ok((await curView()) === '35' || (await curView()) === '64', 'double-click gathers cobble into the cursor (partials first)', await curView());
    const s7 = await invSnap();
    ok(!s7['12'] && !s7['30'] && s7['14'] === '9', 'the partial cobble stacks were taken and the dirt was not', s7);
    ok((await curView()) === '64' && s7['3'] === '35', 'the cursor topped up to 64 from the full stack (second pass), leaving 35', s7);
    await H('key("e")'); await g.sleep(100);

    // ── 8. the sweep stays out of slots that refuse the item: armour only takes its own piece
    await setInv([[0, 'iron_helm', 1], [1, 'planks', 4]]);
    await H('key("e")'); await g.sleep(120);
    await H('slotClick("inv", 1)');
    await down('armor', 0, 0); await move('armor', 0, 0); await move('armor', 1, 0); await move('craft', 0, 0); await move('craft', 1, 0); await upOn('craft', 1, 0);
    ok((await g.ev(() => Array.from(document.querySelectorAll('.mc-panelwrap .mc-slot[data-g="armor"]')).filter(e => /planks/.test(e.title || '') || (e.querySelector('.mc-ct') || {}).textContent).length)) === 0, 'planks never land in the armour column');
    ok((await craftSnap())[0] === 'planks:2' && (await craftSnap())[1] === 'planks:2', 'the two craft slots split the planks 2/2', await craftSnap());
    await H('key("e")'); await g.sleep(100);

    // ── 9. clicking the dark outside the panel throws the stack into the world
    await setInv([[0, 'dirt', 3]]);
    await H('key("e")'); await g.sleep(120);
    await H('slotClick("inv", 0)');
    const drops0 = (await g.ev(() => window.__mc.state())).drops;
    await g.ev(() => { const w = document.querySelector('.mc-panelwrap'); const r = w.getBoundingClientRect(); const o = { bubbles: true, button: 2, buttons: 2, clientX: r.left + 8, clientY: r.top + 8 }; w.dispatchEvent(new MouseEvent('mousedown', o)); w.dispatchEvent(new MouseEvent('mouseup', Object.assign({}, o, { buttons: 0 }))); });
    ok((await g.ev(() => window.__mc.state())).drops === drops0 + 1 && (await curView()) === '2', 'right-click on the backdrop throws one', await curView());
    await g.ev(() => { const w = document.querySelector('.mc-panelwrap'); const r = w.getBoundingClientRect(); const o = { bubbles: true, button: 0, buttons: 1, clientX: r.left + 8, clientY: r.top + 8 }; w.dispatchEvent(new MouseEvent('mousedown', o)); w.dispatchEvent(new MouseEvent('mouseup', Object.assign({}, o, { buttons: 0 }))); });
    ok((await g.ev(() => window.__mc.state())).drops === drops0 + 2 && (await curView()) === null, 'left-click on the backdrop throws the rest', await curView());
    await H('key("e")'); await g.sleep(100);

    // ── 9b. the review's four: fast clicks on the result craft every time; the wash clears;
    //        a press on the dark starts a sweep; place-then-repick does not gather
    await setInv([[0, 'log', 8], [12, 'cobble', 20], [14, 'cobble', 64]]);
    await H('key("e")'); await g.sleep(120);
    await H('slotClick("inv", 0)'); await H('slotClick("craft", 0)');   // 8 logs in the grid → 4 planks showing
    for (let i = 0; i < 4; i++) { await down('cout', 0, 0); await upOn('cout', 0, 0); await g.sleep(40); }
    ok((await curView()) === '16' && (await craftSnap())[0] === 'log:4', 'four fast clicks on the result craft four times', [await curView(), (await craftSnap())[0]]);
    await H('slotClick("inv", 30)');   // put the planks away
    await g.sleep(300);
    await H('slotClick("inv", 30)');   // and pick them up again (16 planks)
    await down('inv', 9, 0); await move('inv', 9, 0); await move('inv', 10, 0); await upOn('inv', 10, 0);
    ok((await g.ev(() => document.querySelectorAll('.mc-panelwrap .mc-slot.qc').length)) === 0, 'the sweep wash is gone once the split has landed');
    const s9b = await invSnap();
    ok(s9b['9'] === '8' && s9b['10'] === '8', 'and the split landed 8/8', s9b);
    await g.sleep(300);
    await H('slotClick("inv", 9)');    // carry 8 planks
    await g.ev(() => { const w = document.querySelector('.mc-panelwrap'); const r = w.getBoundingClientRect(); w.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, buttons: 1, clientX: r.left + 8, clientY: r.top + 8 })); w.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: r.left + 8, clientY: r.top + 8 })); });
    await move('inv', 11, 0); await move('inv', 13, 0); await upOn('inv', 13, 0);
    const s9c = await invSnap();
    ok(s9c['11'] === '4' && s9c['13'] === '4' && (await curView()) === null, 'a sweep that starts on the dark still splits 4/4', s9c);
    await g.sleep(300);
    await H('slotClick("inv", 11)');    // carry 4 planks, then place them and pick them straight back up
    await down('inv', 15, 0); await upOn('inv', 15, 0);
    await g.sleep(40);
    await down('inv', 15, 0); await upOn('inv', 15, 0);
    ok((await curView()) === '4' && (await invSnap())['13'] === '4', 'place-then-repick within 250 ms just picks the stack up again, nothing is gathered', [await curView(), (await invSnap())['13']]);
    await H('key("e")'); await g.sleep(100);

    // ── 10. creative middle-sweep fills every slot with a full stack
    await g.ev(() => window.__mc.chat('/gamemode creative')); await g.sleep(50);
    await setInv([[0, 'stone', 5]]);
    await H('key("e")'); await g.sleep(150);
    await g.ev(() => { const b = document.querySelector('.mc-ctab[data-ct="8"]'); const r = b.getBoundingClientRect(); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: r.left + 5, clientY: r.top + 5 })); window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 })); });
    await g.sleep(80);
    await H('slotClick("inv", 0)');
    await down('inv', 3, 1); await move('inv', 3, 1); await move('inv', 4, 1); await move('inv', 5, 1); await upOn('inv', 5, 1);
    const s10 = await invSnap();
    ok(s10['3'] === '64' && s10['4'] === '64' && s10['5'] === '64', 'creative middle-sweep puts a full stack in each slot', s10);
    await H('key("e")'); await g.sleep(100);
    await g.shot(SHOTS + '/drag.png');
  } catch (e) { console.log('FAILED', e.stack); fails++; await g.shot(SHOTS + '/drag-fail.png').catch(() => {}); }
  console.log('pageerrors', g.errors);
  console.log('console', g.logs.filter(l => !/INVALID_OPERATION/.test(l)).slice(0, 10));
  await g.close();
  console.log(fails ? 'FAILURES: ' + fails : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
