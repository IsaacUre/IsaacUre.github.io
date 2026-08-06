/* ============================================================
   NINTH NIGHT — proof of concept.
   Every year the town of Wick performs a play about the man who
   saved them from the long winter. You have just been cast as
   him. Learning your lines teaches you magic, because a spell is
   a line of verse and rhyme is how the world checks whether
   something is true.

   This build exists to answer ONE question: how does Call and
   Answer feel in the hand? Two verbs. Call is cheap and leaves a
   rhyme stack. Answer is heavy and detonates every stack on
   screen that matches its sound. Everything else hangs off that.

   The visual language is typography. Spells are words getting
   bigger. In combat the vocabulary is single words only — one
   syllable, huge, half a second. Full lines live where the game
   is slow or stopped.

   Press ` for the dev menu: jump scenes, spawn anything, tune
   every combat number live. It is built to grow.

   window.NINTH { render, init, close, steamAch }, save comp_ninth.
   ============================================================ */
(function () {
'use strict';

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
var lerp = function (a, b, t) { return a + (b - a) * t; };
var TAU = Math.PI * 2;
function rnd(a, b) { return a + Math.random() * (b - a); }
function irnd(a, b) { return Math.floor(rnd(a, b + 1)); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function fmtN(n) { n = Math.round(n); return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n); }

/* ─────────────── stage ─────────────── */
var VW = 1120, VH = 580;                    // world canvas
var TILE_W = 58, TILE_H = 29, GRID = 17;
var ORX = VW / 2, ORY = 84;
function isoX(x, y) { return ORX + (x - y) * (TILE_W / 2); }
function isoY(x, y) { return ORY + (x + y) * (TILE_H / 2); }

/* ─────────────── the ballad ───────────────
   Both versions live here. The town's version is what you know;
   the true version fills in as you find fragments. Three broken
   rhymes, and the same lie used twice because one was cheaper. */
var BALLAD = [
    { t: ['In the ninth year of the thin sun', 'there was nothing left to eat.', 'We burned the doors, we burned the pews,', 'we burned the market street.'],
      r: ['In the ninth year of the thin sun', 'there was nothing left to eat.', 'We burned the doors, we burned the pews,', 'we burned the market street.'] },
    { t: ['We sat down in the empty square', 'the way that cattle do,', 'and we said nothing to each other,', 'and we watched the winter through.'],
      r: ['We sat down in the empty square', 'the way that cattle do,', 'and we said nothing to each other,', 'and we watched the winter through.'] },
    { t: ['He stood up in the empty square,', 'he spoke and we all heard.', 'He asked us for a single coal,', 'and he went alone.'],
      r: ['She stood up in the empty square,', 'she spoke and we all heard.', 'She asked us for a single coal,', 'and we would not say a word.'], brk: 1, set: 'heard', lie: 'alone', truth: 'word' },
    { t: ['He walked out past the mill, the well,', 'he walked out past the mark,', 'and he held the last coal in the town', 'and he carried it out of sight.'],
      r: ['She walked out past the mill, the well,', 'she walked out past the mark,', 'and he held the last coal in the town', 'and he watched her from the dark.'], brk: 1, set: 'mark', lie: 'sight', truth: 'dark' },
    { t: ['In the hollow at the world\'s north end', 'he found the thing that ate the light.', 'It had a woman\'s hands on it,', 'and it would not stand the sight.'],
      r: ['In the hollow at the world\'s north end', 'there was nothing but the night.', 'There was no thing with a woman\'s hands.', 'There was a woman, and we would not stand the sight.'] },
    { t: ['The sun came up that morning', 'and we could not understand,', 'and the man came up the road to us', 'with the coal burnt out in his hand.'],
      r: ['The sun came up that morning', 'and we could not understand,', 'and the man came down off the fence', 'with the coal still whole in his hand.'] },
    { t: ['So light your lamps on the ninth night', 'and set one on the sill', 'for the man who walked out past the fence,', 'and he went alone.'],
      r: ['So light your lamps on the ninth night', 'and set one on the sill,', 'not for the man who came back down', 'but for the girl who never will.'], brk: 1, set: 'sill', lie: 'alone', truth: 'will' }
];

/* ─────────────── rhyme families ───────────────
   Words that rhyme share a nature. Five. Do not add a sixth.
   Your starting kit is the TOWN's version — every spell you begin
   the game with is a lie you can cast. Nobody says this out loud. */
var FAMS = {
    eat:  { n: '-eat', tag: 'EAT',  col: '#e8913a', glow: '#ffc271', el: 'hunger',  d: 'hunger, burn, drain',            words: ['eat', 'street', 'heat', 'wheat'], from: 'Stanza 1' },
    ight: { n: '-ight', tag: 'IGHT', col: '#ffe66e', glow: '#fff6c2', el: 'reveal',  d: 'reveal, strip armour, true damage', words: ['light', 'night', 'sight', 'right'], from: 'Stanza 5' },
    erd:  { n: '-erd', tag: 'ERD',  col: '#9fe0c8', glow: '#d6fff0', el: 'command', d: 'command, silence, counter',      words: ['word', 'heard', 'bird', 'third'], from: 'Fragment 1' },
    ark:  { n: '-ark', tag: 'ARK',  col: '#8a6ad0', glow: '#c9a1ff', el: 'shadow',  d: 'shadow, damage over time, conceal', words: ['dark', 'mark', 'spark', 'stark'], from: 'Fragment 2' },
    ill:  { n: '-ill', tag: 'ILL',  col: '#6fd4ff', glow: '#c8f0ff', el: 'still',   d: 'stun, freeze, execute',          words: ['will', 'sill', 'still', 'chill'], words2: 1, from: 'Fragment 3' }
};
var FAM_IDS = ['eat', 'ight', 'erd', 'ark', 'ill'];
/* every castable word, flattened. `sword` is deliberately absent
   from every family: nothing in the game rhymes with sword. */
var WORDS = {};
FAM_IDS.forEach(function (f) { FAMS[f].words.forEach(function (w) { WORDS[w] = f; }); });

/* ─────────────── tuning ───────────────
   Live-editable from the dev menu. These are a starting point,
   not gospel — the whole point of the PoC is moving them. */
var TUNE = {
    callCost: 4, answerCost: 15,
    breathMax: 40, breathRegen: 3, breathRamp: 8, rampAfter: 1.0, windedT: 1.5,
    stackLife: 4.0, stackMax: 8,
    callDmg: 9, answerBase: 14, answerPerStack: 11,
    slantMul: 0.5, breakSelfDmg: 3,
    echoPerStack: 5, echoDecay: 4, echoMax: 100,
    dilation: 0.3, dilationT: 1.5,
    moveSpd: 3.5, dashDist: 3.2, dashCd: 2.4,
    callRange: 7.5, answerRange: 99,
    ttk: 1               // global enemy hp multiplier, for feel testing
};

/* ─────────────── hearsay ───────────────
   Trash is misrememberings, loose bits of the play, crowd noise,
   applause with teeth. The counters are the lesson. */
var FOES = {
    mouth:  { n: 'Hearsay', hp: 26, dmg: 6, spd: 2.5, r: 0.42, atk: 1.0, tell: 0.3, xp: 8, coin: [0, 1],
              d: 'A chattering mouth. Says a bit of the play that was never in the play.' },
    thief:  { n: 'Thief',   hp: 40, dmg: 8, spd: 2.9, r: 0.44, atk: 1.4, tell: 0.35, xp: 16, coin: [1, 2], steal: 2.2,
              d: 'Answers your stacks for you, with the wrong sound, stealing your detonation. -ark hides stacks from it.' },
    droner: { n: 'Droner',  hp: 54, dmg: 7, spd: 1.9, r: 0.5, atk: 1.6, tell: 0.5, xp: 18, coin: [1, 2], drone: 1.0,
              d: 'Applies its own rhyme to itself every second. Overwrite it before you can answer it.' },
    deaf:   { n: 'The Deaf', hp: 70, dmg: 11, spd: 1.7, r: 0.55, atk: 1.5, tell: 0.55, xp: 24, coin: [1, 3], deaf: 1,
              d: 'Ignores sound entirely. Only -ill touches it: stun, freeze, execute.' },
    sword:  { n: 'The Sword', hp: 150, dmg: 16, spd: 2.1, r: 0.6, atk: 1.3, tell: 0.45, xp: 40, coin: [3, 6], norhyme: 1, elite: 1,
              d: 'Carries no rhyme at all. Cannot be stacked. Cannot be detonated. Kill it with raw call damage, slowly, like an idiot, while everything else on screen explodes beautifully.' },
    chorus: { n: 'THE CHORUS', hp: 900, dmg: 12, spd: 0, r: 1.6, atk: 2.2, tell: 0.8, xp: 300, coin: [20, 30], boss: 1, pulse: 5.5,
              d: 'A crowd of voices, no bodies, saying the refrain in unison. It strips rhyme off everything on a pulse. Burst between pulses.' }
};

/* places, people and scripts live in the world section below. */

/* achievements (the Steam client reads these live) */
var ACH = [
    ['firstcall', 'A Line Spoken', 'Cast your first Call'],
    ['couplet', 'Closed Couplet', 'Land your first Answer on a matching stack'],
    ['slant', 'Near Enough', 'Land a slant answer and feel it fall flat'],
    ['sour', 'It Went Sour', 'Let a full set of stacks decay unanswered'],
    ['winded', 'Out of Breath', 'Run yourself to zero breath'],
    ['six', 'Six on One', 'Detonate six or more stacks on a single enemy'],
    ['crowd', 'Crowd Work', 'Detonate stacks on eight enemies at once'],
    ['sword', 'The Joke', 'Kill a Sword with nothing but Call damage'],
    ['chorus', 'The Refrain Stops', 'Silence the Chorus'],
    ['frag1', 'Word', 'Recover the first fragment'],
    ['stanza', 'Recital', 'Cast a Stanza'],
    ['deaf', 'Still', 'Put down one of the Deaf with -ill'],
    ['nohit', 'Word Perfect', 'Clear a wave without being touched'],
    ['hear', 'You Heard It', 'Notice what does not rhyme']
];

/* ─────────────── charms ───────────────
   Isaac's ask, against the design doc's advice: a real economy.
   Charms are small objects out of the town, and each one bends
   how Call and Answer feel rather than adding a number to a
   sheet. You wear two. The build is: one call word, one answer
   word, two charms. That is enough to argue about. */
var CHARMS = {
    crown:  { n: 'The Tin Crown', cost: 0, own: 1, d: 'Bern pressed it into your hands and looked delighted. Stacks last 1.5s longer and you can hold one more.',
              m: { stackLife: 1.5, stackMax: 1 } },
    coal:   { n: 'A Stub of Coal', cost: 40, d: 'Burnt at one end. Somebody carried it a long way. Call hits 45% harder, Answer 20% softer.',
              m: { callDmg: 0.45, answerDmg: -0.2 } },
    prompt: { n: 'The Prompt Book', cost: 55, d: 'Thirty years of Bern\'s pencil in the margins. Breath ramps to its fast rate twice as quickly.',
              m: { rampAfter: -0.5 } },
    bell:   { n: 'The Vestry Bell', cost: 70, d: 'Rung on the ninth night, badly. Echo builds 60% faster and decays slower.',
              m: { echoGain: 0.6, echoDecay: -1.5 } },
    chalk:  { n: 'Rehearsal Chalk', cost: 45, d: 'For marking where to stand. A slant answer keeps 80% of its damage instead of half.',
              m: { slantMul: 0.3 } },
    lamp:   { n: 'The Sill Lamp', cost: 85, d: 'Set out every year for a man who was never out there. -eat and -ight land 30% harder.',
              m: { famDmg: { eat: 0.3, ight: 0.3 } } },
    hilt:   { n: 'A Sword Hilt', cost: 0, sell: 120, joke: 1, d: 'Prop, not weapon. Nothing rhymes with sword, so it does nothing at all, in any hand, forever. The chandler will give you good coin for it.',
              m: {} }
};
var CHARM_IDS = Object.keys(CHARMS);

/* ─────────────── save ─────────────── */
var S = null;
function sLoad() {
    if (S) return;
    try { S = JSON.parse(localStorage.getItem('comp_ninth') || 'null'); } catch (e) { S = null; }
    if (!S) S = {};
    S.place = S.place || 'stage';
    S.heard = S.heard || {};        // refrain / child / busker / shepherd — understanding, not loot
    S.fams = S.fams || { eat: 1, ight: 1 };          // the town's version is your starting kit
    S.frags = S.frags || {};
    S.stanzas = S.stanzas || {};
    S.verse = S.verse || 0;                          // R stays dark for the entire game
    S.owned = S.owned || { heat: 1, street: 1, light: 1, sight: 1 };
    S.call = WORDS[S.call] ? S.call : 'heat';
    S.answer = WORDS[S.answer] ? S.answer : 'street';
    S.coin = S.coin == null ? 0 : S.coin;
    S.charms = S.charms || { crown: 1 };             // the crown is given, not bought
    S.worn = (S.worn || ['crown']).filter(function (c) { return CHARMS[c] && S.charms[c]; }).slice(0, 2);
    S.ach = S.ach || {};
    S.kills = S.kills || 0; S.best = S.best || 0;
    S.seen = S.seen || {};                           // one-shot story beats already played
    S.opts = S.opts || {};
    // WASD by default: it frees the whole mouse for aiming, which is what
    // Call and Answer actually want. Stanzas shift to Q/E/F to stay off W.
    if (S.opts.wasd == null) S.opts.wasd = true;
    if (S.opts.shake == null) S.opts.shake = true;
    if (S.opts.sound == null) S.opts.sound = true;
    if (S.opts.bigtext == null) S.opts.bigtext = true;
    S.tune = S.tune || {};                           // dev-menu overrides, persisted so tuning survives a reload
    return S;
}
function sSave() { try { localStorage.setItem('comp_ninth', JSON.stringify(S)); } catch (e) {} }
/* a tuning value, dev override first */
function T(k) { return S && S.tune && S.tune[k] != null ? S.tune[k] : TUNE[k]; }

/* charm modifiers, summed over what you are wearing */
function charmSum() {
    var m = { stackLife: 0, stackMax: 0, callDmg: 0, answerDmg: 0, rampAfter: 0, echoGain: 0, echoDecay: 0, slantMul: 0, famDmg: {} };
    (S.worn || []).forEach(function (id) {
        var c = CHARMS[id]; if (!c || !c.m) return;
        Object.keys(c.m).forEach(function (k) {
            if (k === 'famDmg') { Object.keys(c.m.famDmg).forEach(function (f) { m.famDmg[f] = (m.famDmg[f] || 0) + c.m.famDmg[f]; }); }
            else m[k] = (m[k] || 0) + c.m[k];
        });
    });
    return m;
}
/* every derived combat number in one place, recomputed fresh */
function fragCount() { return (S && S.frags ? [1, 2, 3].filter(function (n) { return S.frags[n]; }).length : 0); }
function stats() {
    var c = charmSum();
    return {
        c: c,
        breathMax: T('breathMax') + fragCount() * 12,
        regen: T('breathRegen'), ramp: T('breathRamp'), rampAfter: Math.max(0.15, T('rampAfter') + c.rampAfter),
        callCost: T('callCost'), answerCost: T('answerCost'),
        callDmg: T('callDmg') * (1 + c.callDmg),
        answerBase: T('answerBase') * (1 + c.answerDmg),
        answerPerStack: T('answerPerStack') * (1 + c.answerDmg),
        stackLife: T('stackLife') + c.stackLife,
        stackMax: Math.round(T('stackMax') + c.stackMax),
        slantMul: clamp(T('slantMul') + c.slantMul, 0, 1),
        echoGain: 1 + c.echoGain, echoDecay: Math.max(0.5, T('echoDecay') + c.echoDecay),
        moveSpd: T('moveSpd')
    };
}
function famDmgMul(fam) { var c = charmSum(); return 1 + (c.famDmg[fam] || 0); }
function callFam() { return WORDS[S.call] || 'eat'; }
function answerFam() { return WORDS[S.answer] || 'eat'; }
function famOwned(f) { return !!S.fams[f]; }

/* ─────────────── economy ─────────────── */
function coin(n, x, y) {
    S.coin += n;
    if (n > 0 && x != null) typo(x, y, '+' + n, '#ffe66e', 0.7, 13, 'drift');
}
function buyCharm(id) {
    var c = CHARMS[id]; if (!c || S.charms[id]) return false;
    if (S.coin < c.cost) { say('Not enough coin.', 'dim'); return false; }
    S.coin -= c.cost; S.charms[id] = 1; sSave();
    say('You pocket <b>' + esc(c.n) + '</b>.', 'good');
    return true;
}
function sellCharm(id) {
    var c = CHARMS[id]; if (!c || !S.charms[id] || !c.sell) return false;
    delete S.charms[id];
    S.worn = S.worn.filter(function (w) { return w !== id; });
    coin(c.sell); sSave();
    say('The chandler pays <b>' + c.sell + '</b> coin for a piece of stage furniture and looks pleased with himself.', 'good');
    return true;
}
function wearCharm(id) {
    if (!S.charms[id]) return;
    var i = S.worn.indexOf(id);
    if (i >= 0) S.worn.splice(i, 1);
    else { if (S.worn.length >= 2) S.worn.shift(); S.worn.push(id); }
    sSave();
}
function learnWord(w) {
    if (!WORDS[w] || S.owned[w]) return false;
    S.owned[w] = 1; sSave();
    say('You have the word <b style="color:' + FAMS[WORDS[w]].col + '">' + esc(w.toUpperCase()) + '</b>.', 'good');
    return true;
}
function grantFragment(n) {
    var map = { 1: ['erd', 'word', 'frag1'], 2: ['ark', 'dark', 'frag2'], 3: ['ill', 'will', 'frag3'] };
    var f = map[n]; if (!f || S.frags[n]) return;
    S.frags[n] = 1; S.fams[f[0]] = 1; S.owned[f[1]] = 1; S.stanzas[n] = 1;
    if (n === 1) ach('frag1');
    sSave();
    bigLine('FRAGMENT ' + ['I', 'II', 'III'][n - 1], f[1].toUpperCase(), FAMS[f[0]].col);
    say('The line closes. <b style="color:' + FAMS[f[0]].col + '">' + f[1].toUpperCase() + '</b> is yours, and so is Stanza ' + ['I', 'II', 'III'][n - 1] + '.', 'good');
}

/* ─────────────── achievements ─────────────── */
function ach(id) {
    if (!S || S.ach[id]) return;
    S.ach[id] = 1; sSave();
    var a = null; ACH.forEach(function (x) { if (x[0] === id) a = x; });
    if (a && RT) RT.toasts.push({ t: 3.4, n: a[1], d: a[2] });
}
function steamAch() {
    sLoad();
    var n = 0; ACH.forEach(function (a) { if (S.ach[a[0]]) n++; });
    return { n: n, total: ACH.length, list: ACH.map(function (a) { return [a[1], a[2], S.ach[a[0]] ? 1 : 0]; }) };
}

/* ─────────────── DOM ───────────────
   Canvas underneath for the world and all the typography; DOM on
   top for the things that must be crisp and clickable. */
function render() {
    return '<div class="nn" tabindex="0">' +
        '<canvas class="nn-cv" width="' + VW + '" height="' + VH + '"></canvas>' +

        '<div class="nn-scene"><b class="nn-scene-n"></b><i class="nn-scene-s"></i></div>' +
        '<div class="nn-coin">◦ <b class="nn-coin-n">0</b></div>' +
        '<div class="nn-toasts"></div>' +

        // narration: the slow channel. full lines are only ever allowed here.
        '<div class="nn-say"></div>' +
        '<div class="nn-dlg" hidden><b class="nn-dlg-who"></b><p class="nn-dlg-tx"></p><i class="nn-dlg-more"></i></div>' +

        // bottom: breath, the two slotted words, the stanza bar
        '<div class="nn-hud">' +
          '<div class="nn-left">' +
            '<div class="nn-breath"><i></i><em></em><span class="nn-breath-t"></span></div>' +
            '<div class="nn-echo"><i></i><span>ECHO</span></div>' +
          '</div>' +
          '<div class="nn-slots">' +
            '<button class="nn-word nn-call" data-nn="slot:call" type="button"><i>CALL · LMB</i><b></b><em></em></button>' +
            '<button class="nn-word nn-answer" data-nn="slot:answer" type="button"><i>ANSWER · RMB</i><b></b><em></em></button>' +
          '</div>' +
          '<div class="nn-stanzas">' +
            '<button class="nn-st" data-nn="stanza:1" type="button"><b>Q</b><i>Stanza I</i></button>' +
            '<button class="nn-st" data-nn="stanza:2" type="button"><b>W</b><i>Stanza II</i></button>' +
            '<button class="nn-st" data-nn="stanza:3" type="button"><b>E</b><i>Stanza III</i></button>' +
            '<button class="nn-st nn-verse" data-nn="verse" type="button" disabled><b>R</b><i>Verse</i></button>' +
          '</div>' +
        '</div>' +

        // panels
        '<div class="nn-panel nn-p-book" hidden><header>THE PLAY<button class="nn-x" type="button">×</button></header><div class="nn-pb"></div></div>' +
        '<div class="nn-panel nn-p-kit" hidden><header>WORDS &amp; CHARMS<button class="nn-x" type="button">×</button></header><div class="nn-pb"></div></div>' +
        '<div class="nn-panel nn-p-shop" hidden><header>THE CHANDLER<span class="nn-shop-coin"></span><button class="nn-x" type="button">×</button></header><div class="nn-pb"></div></div>' +

        // dev menu — the whole point of the ask. populated from DEV below.
        '<div class="nn-dev" hidden><header>DEV MENU<i>`</i><button class="nn-x" type="button">×</button></header>' +
          '<div class="nn-dev-tabs"></div><div class="nn-dev-body"></div>' +
          '<div class="nn-dev-foot"></div></div>' +

        '<div class="nn-btns">' +
          '<button class="nn-b" data-nn="p:book" type="button" title="The play (B)">B</button>' +
          '<button class="nn-b" data-nn="p:kit" type="button" title="Words &amp; charms (C)">C</button>' +
          '<button class="nn-b" data-nn="p:shop" type="button" title="The chandler (V)">V</button>' +
          '<button class="nn-b" data-nn="dev" type="button" title="Dev menu (`)">`</button>' +
        '</div>' +
        '<div class="nn-tip" hidden></div>' +
        '<div class="nn-vig"></div>' +
    '</div>';
}

/* ─────────────── dev menu data ───────────────
   Adding a control later is ONE line in here. That is the point:
   this thing is meant to grow with the game.
     btn    — do a thing
     tgl    — boolean, get/set
     num    — live number with -/+ and a readout (combat feel)
     pick   — choose one of a list
     note   — a line of text */
var DEV = [
  { tab: 'WORLD', rows: function () {
      var rows = [{ k: 'note', t: 'Walk anywhere. Scripts replay from the top.' }];
      PLACE_IDS.forEach(function (id) {
          rows.push({ k: 'btn', t: PLACES[id].n, sub: PLACES[id].sub, on: function () { gotoPlace(id, true); } });
      });
      rows.push({ k: 'btn', t: 'Replay this place script', on: function () { var p = place(); if (p.script) delete S.seen[p.script + 'Intro']; gotoPlace(RT.place, true); } });
      rows.push({ k: 'btn', t: 'Open every exit (ignore gates)', on: function () { S.seen.rehearsed = 1; S.seen.chorusDown = 1; sSave(); } });
      return rows;
  } },
  { tab: 'PEOPLE', rows: function () {
      var rows = [{ k: 'note', t: 'Hear anybody from anywhere, without walking to them.' }];
      Object.keys(NPCS).forEach(function (id) {
          rows.push({ k: 'btn', t: NPCS[id].n, sub: 'hear them out', on: function () { toggleDev(); openDialog(NPCS[id].talk(), NPCS[id].n); } });
      });
      rows.push({ k: 'note', t: 'Understanding, not loot: Fragment I lands once you have heard the refrain AND somebody carrying the true line.' });
      rows.push({ k: 'tgl', t: 'heard the refrain (the Chorus)', get: function () { return !!S.heard.refrain; }, set: function (v) { S.heard.refrain = v ? 1 : 0; sSave(); } });
      ['child', 'busker', 'shepherd'].forEach(function (w) {
          rows.push({ k: 'tgl', t: 'heard the ' + w, get: function () { return !!S.heard[w]; }, set: function (v) { S.heard[w] = v ? 1 : 0; sSave(); } });
      });
      rows.push({ k: 'btn', t: 'Force the realisation now', on: function () { toggleDev(); S.heard.refrain = 1; S.heard.child = 1; checkRealisation(); } });
      return rows;
  } },
  { tab: 'SPAWN', rows: function () {
      var rows = [{ k: 'note', t: 'Spawns at the cursor. Hold to stack them up.' }];
      Object.keys(FOES).forEach(function (id) {
          rows.push({ k: 'btn', t: FOES[id].n, sub: FOES[id].d, on: function () { spawnFoe(id, RT.mouse.wx, RT.mouse.wy); } });
      });
      rows.push({ k: 'btn', t: 'Kill everything', on: function () { RT.foes.forEach(function (f) { if (!f.dead) foeDie(f, true); }); } });
      rows.push({ k: 'btn', t: 'Clear the arena (no rewards)', on: function () { RT.foes.length = 0; RT.fproj.length = 0; } });
      rows.push({ k: 'num', t: 'Enemy HP multiplier', get: function () { return T('ttk'); }, set: function (v) { S.tune.ttk = clamp(v, 0.1, 10); }, step: 0.25, fix: 2 });
      return rows;
  } },
  { tab: 'FEEL', rows: function () { return [
      { k: 'note', t: 'The numbers the whole design says will move. Live.' },
      { k: 'num', t: 'Call cost (breath)', get: function () { return T('callCost'); }, set: function (v) { S.tune.callCost = clamp(v, 0, 40); }, step: 1 },
      { k: 'num', t: 'Answer cost (breath)', get: function () { return T('answerCost'); }, set: function (v) { S.tune.answerCost = clamp(v, 0, 60); }, step: 1 },
      { k: 'num', t: 'Max breath', get: function () { return T('breathMax'); }, set: function (v) { S.tune.breathMax = clamp(v, 10, 200); }, step: 5 },
      { k: 'num', t: 'Breath regen (idle)', get: function () { return T('breathRegen'); }, set: function (v) { S.tune.breathRegen = clamp(v, 0, 40); }, step: 1 },
      { k: 'num', t: 'Breath ramp rate', get: function () { return T('breathRamp'); }, set: function (v) { S.tune.breathRamp = clamp(v, 0, 60); }, step: 1 },
      { k: 'num', t: 'Silence before ramp (s)', get: function () { return T('rampAfter'); }, set: function (v) { S.tune.rampAfter = clamp(v, 0, 4); }, step: 0.1, fix: 1 },
      { k: 'num', t: 'Winded lockout (s)', get: function () { return T('windedT'); }, set: function (v) { S.tune.windedT = clamp(v, 0, 5); }, step: 0.1, fix: 1 },
      { k: 'num', t: 'Stack life (s)', get: function () { return T('stackLife'); }, set: function (v) { S.tune.stackLife = clamp(v, 0.5, 20); }, step: 0.25, fix: 2 },
      { k: 'num', t: 'Max stacks per enemy', get: function () { return T('stackMax'); }, set: function (v) { S.tune.stackMax = clamp(v, 1, 30); }, step: 1 },
      { k: 'num', t: 'Call damage', get: function () { return T('callDmg'); }, set: function (v) { S.tune.callDmg = clamp(v, 0, 200); }, step: 1 },
      { k: 'num', t: 'Answer base', get: function () { return T('answerBase'); }, set: function (v) { S.tune.answerBase = clamp(v, 0, 300); }, step: 1 },
      { k: 'num', t: 'Answer per stack', get: function () { return T('answerPerStack'); }, set: function (v) { S.tune.answerPerStack = clamp(v, 0, 300); }, step: 1 },
      { k: 'num', t: 'Slant multiplier', get: function () { return T('slantMul'); }, set: function (v) { S.tune.slantMul = clamp(v, 0, 1); }, step: 0.05, fix: 2 },
      { k: 'num', t: 'Break self-damage / stack', get: function () { return T('breakSelfDmg'); }, set: function (v) { S.tune.breakSelfDmg = clamp(v, 0, 50); }, step: 1 },
      { k: 'num', t: 'Move speed', get: function () { return T('moveSpd'); }, set: function (v) { S.tune.moveSpd = clamp(v, 0.5, 12); }, step: 0.25, fix: 2 },
      { k: 'num', t: 'Stanza time dilation', get: function () { return T('dilation'); }, set: function (v) { S.tune.dilation = clamp(v, 0.05, 1); }, step: 0.05, fix: 2 },
      { k: 'btn', t: 'Reset every number to default', on: function () { S.tune = {}; sSave(); } }
  ]; } },
  { tab: 'KIT', rows: function () {
      var rows = [{ k: 'note', t: 'Unlocks. Fragments give a family, a word and a stanza.' }];
      [1, 2, 3].forEach(function (n) {
          rows.push({ k: 'btn', t: 'Grant Fragment ' + ['I', 'II', 'III'][n - 1] + (S.frags[n] ? ' ✓' : ''), on: function () { grantFragment(n); } });
      });
      rows.push({ k: 'btn', t: 'Grant every word', on: function () { Object.keys(WORDS).forEach(function (w) { S.owned[w] = 1; }); FAM_IDS.forEach(function (f) { S.fams[f] = 1; }); sSave(); } });
      rows.push({ k: 'tgl', t: 'Verse (R) unlocked', get: function () { return !!S.verse; }, set: function (v) { S.verse = v ? 1 : 0; sSave(); } });
      rows.push({ k: 'btn', t: 'Grant every charm', on: function () { CHARM_IDS.forEach(function (c) { S.charms[c] = 1; }); sSave(); } });
      rows.push({ k: 'num', t: 'Coin', get: function () { return S.coin; }, set: function (v) { S.coin = Math.max(0, Math.round(v)); }, step: 25 });
      rows.push({ k: 'btn', t: 'Wipe save (start over)', danger: 1, on: function () { try { localStorage.removeItem('comp_ninth'); } catch (e) {} S = null; sLoad(); gotoPlace('stage', true); } });
      return rows;
  } },
  { tab: 'CHEAT', rows: function () { return [
      { k: 'tgl', t: 'God mode', get: function () { return !!RT.god; }, set: function (v) { RT.god = v; } },
      { k: 'tgl', t: 'Infinite breath', get: function () { return !!RT.infBreath; }, set: function (v) { RT.infBreath = v; } },
      { k: 'tgl', t: 'Stacks never decay', get: function () { return !!RT.holdStacks; }, set: function (v) { RT.holdStacks = v; } },
      { k: 'tgl', t: 'One-shot everything', get: function () { return !!RT.oneShot; }, set: function (v) { RT.oneShot = v; } },
      { k: 'btn', t: 'Fill breath', on: function () { RT.breath = stats().breathMax; RT.winded = 0; } },
      { k: 'btn', t: 'Fill echo', on: function () { RT.echo = T('echoMax'); } },
      { k: 'btn', t: 'Heal', on: function () { RT.hp = RT.hpm; } },
      { k: 'num', t: 'Time scale', get: function () { return RT.timeScale; }, set: function (v) { RT.timeScale = clamp(v, 0.05, 3); }, step: 0.1, fix: 2 }
  ]; } },
  { tab: 'DEBUG', rows: function () { return [
      { k: 'tgl', t: 'Show stack counts + families', get: function () { return !!RT.dbgStacks; }, set: function (v) { RT.dbgStacks = v; } },
      { k: 'tgl', t: 'Show enemy AI state', get: function () { return !!RT.dbgAI; }, set: function (v) { RT.dbgAI = v; } },
      { k: 'tgl', t: 'Show hitboxes', get: function () { return !!RT.dbgHit; }, set: function (v) { RT.dbgHit = v; } },
      { k: 'tgl', t: 'Show fps + counts', get: function () { return !!RT.dbgPerf; }, set: function (v) { RT.dbgPerf = v; } },
      { k: 'tgl', t: 'Screen shake', get: function () { return !!S.opts.shake; }, set: function (v) { S.opts.shake = v; sSave(); } },
      { k: 'tgl', t: 'Sound', get: function () { return !!S.opts.sound; }, set: function (v) { S.opts.sound = v; sSave(); } },
      { k: 'tgl', t: 'WASD movement (stanzas move to Q/E/F)', get: function () { return !!S.opts.wasd; }, set: function (v) { S.opts.wasd = v; sSave(); refreshStanzaKeys(); } },
      { k: 'note', t: 'Combat may only ever show single words. If you want the player to read a line, it should not be a fight.' }
  ]; } }
];

/* ─────────────── the stage floor ───────────────
   Prerendered per scene. Wick is lamplight and cobbles, the mill
   is dirt and chaff, the loft is boards and dark, the prologue is
   a plank stage with footlights and an audience you cannot see. */
var FLOORS = {};
function buildFloor(kind, gw, gh) {
    gw = gw || GRID; gh = gh || GRID;
    var key = kind + gw + 'x' + gh;
    if (FLOORS[key]) return FLOORS[key];
    var cv = document.createElement('canvas'); cv.width = VW; cv.height = VH;
    var g = cv.getContext('2d');
    var seed = 9; function fr() { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; }
    var pal = kind === 'stage' ? ['#3a2a1c', '#2c1f14', '#4a3524']
            : kind === 'town'  ? ['#2a2630', '#211d28', '#37323f']
            : kind === 'loft'  ? ['#241c16', '#1a1410', '#332720']
            :                    ['#2e2620', '#241d19', '#3b312a'];
    g.fillStyle = '#07060a'; g.fillRect(0, 0, VW, VH);
    for (var y = 0; y < gh; y++) for (var x = 0; x < gw; x++) {
        var sx = isoX(x, y), sy = isoY(x, y);
        var edge = Math.min(x, y, gw - 1 - x, gh - 1 - y);
        g.beginPath();
        g.moveTo(sx, sy); g.lineTo(sx + TILE_W / 2, sy + TILE_H / 2);
        g.lineTo(sx, sy + TILE_H); g.lineTo(sx - TILE_W / 2, sy + TILE_H / 2); g.closePath();
        var base = pal[(x + y) % 2 ? 0 : 1];
        g.fillStyle = base; g.fill();
        g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.stroke();
        if (kind === 'stage' && y % 2 === 0) {   // plank seams run one way
            g.strokeStyle = 'rgba(0,0,0,.3)';
            g.beginPath(); g.moveTo(sx - TILE_W / 2, sy + TILE_H / 2); g.lineTo(sx + TILE_W / 2, sy + TILE_H / 2); g.stroke();
        }
        if (fr() < 0.22) { g.fillStyle = pal[2]; g.globalAlpha = 0.35; g.fillRect(sx - 8 + fr() * 16, sy + 8 + fr() * 10, 3 + fr() * 5, 2); g.globalAlpha = 1; }
        if (kind === 'mill' && fr() < 0.14) { g.fillStyle = 'rgba(190,170,110,.3)'; g.fillRect(sx - 6 + fr() * 12, sy + 10 + fr() * 8, 2, 2); }
        if (edge === 0) { g.fillStyle = 'rgba(4,3,8,.5)'; g.fill(); }
    }
    // a ring of light where the scene wants you to stand
    var cx0 = isoX(gw / 2, gh / 2), cy0 = isoY(gw / 2, gh / 2);
    g.save(); g.translate(cx0, cy0); g.scale(1, 0.5);
    var rg = g.createRadialGradient(0, 0, 20, 0, 0, 330);
    rg.addColorStop(0, kind === 'stage' ? 'rgba(255,190,90,.16)' : 'rgba(255,200,120,.07)');
    rg.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 330, 0, TAU); g.fill(); g.restore();
    var vg = g.createRadialGradient(VW / 2, VH / 2 - 30, 150, VW / 2, VH / 2, 560);
    vg.addColorStop(0, 'rgba(4,3,8,0)'); vg.addColorStop(1, 'rgba(4,3,8,.97)');
    g.fillStyle = vg; g.fillRect(0, 0, VW, VH);
    FLOORS[key] = cv; return cv;
}

/* ─────────────── particles ─────────────── */
function part(p) { p.max = p.life; if (RT.parts.length < 900) RT.parts.push(p); }
function burst(x, y, z, n, o) {
    for (var i = 0; i < n; i++) {
        var a = rnd(0, TAU), sp = rnd(o.sp0 || 0.4, o.sp1 || 2.2);
        part({ x: x, y: y, z: z + rnd(-3, 5), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(o.vz0 == null ? 15 : o.vz0, o.vz1 == null ? 80 : o.vz1),
               life: rnd(o.l0 || 0.3, o.l1 || 0.9), size: rnd(o.s0 || 1.4, o.s1 || 3.2), col: o.col, add: o.add == null ? 1 : o.add, grav: o.grav == null ? 130 : o.grav });
    }
}
function stepParts(dt) {
    for (var i = RT.parts.length - 1; i >= 0; i--) {
        var p = RT.parts[i]; p.life -= dt;
        if (p.life <= 0) { RT.parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.grav * dt;
        if (p.z < 0) { p.z = 0; p.vz *= -0.28; p.vx *= 0.6; p.vy *= 0.6; }
    }
}
function drawParts(cx) {
    for (var i = 0; i < RT.parts.length; i++) {
        var p = RT.parts[i], sx = isoX(p.x, p.y), sy = isoY(p.x, p.y) + TILE_H / 2 - p.z;
        cx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
        cx.fillStyle = 'rgba(' + p.col + ',' + clamp(p.life / p.max, 0, 1).toFixed(3) + ')';
        var s = p.size * (0.4 + 0.6 * (p.life / p.max));
        cx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
    cx.globalCompositeOperation = 'source-over';
}

/* ═══════════════ TYPOGRAPHY ═══════════════
   The whole visual language. Spells are words getting bigger.
     tier 1 typo()    a small word pops at the impact point
     tier 2 slam()    stacks snap into line, the answer slams across
     tier 3 bigLine() a line writes itself while time is thick
   In combat only single words are ever allowed on screen. */
function typo(x, y, txt, col, life, size, style) {
    RT.typo.push({ x: x, y: y, txt: txt, col: col, life: life, max: life, size: size || 15, style: style || 'pop', z: 40 });
    if (RT.typo.length > 60) RT.typo.shift();
}
function drawTypo(cx, dt) {
    for (var i = RT.typo.length - 1; i >= 0; i--) {
        var w = RT.typo[i]; w.life -= dt;
        if (w.life <= 0) { RT.typo.splice(i, 1); continue; }
        var k = 1 - w.life / w.max, a = clamp(w.life / w.max * 1.6, 0, 1);
        var sx = isoX(w.x, w.y), sy = isoY(w.x, w.y) + TILE_H / 2 - w.z;
        if (w.style === 'drift') sy -= k * 34;
        else if (w.style === 'pop') sy -= 10 + k * 16;
        var size = w.size * (w.style === 'pop' ? (0.7 + k * 0.5) : 1);
        cx.save(); cx.globalAlpha = a; cx.textAlign = 'center';
        cx.font = 'bold ' + size.toFixed(1) + 'px "Press Start 2P", monospace';
        cx.fillStyle = '#08060c'; cx.fillText(w.txt, sx + 2, sy + 2);
        cx.fillStyle = w.col; cx.fillText(w.txt, sx, sy);
        cx.restore();
    }
    cx.textAlign = 'left';
}

/* tier 2 — the answer. every stack snaps into alignment, then the
   word slams across underneath them. half a second, enormous. */
function slam(txt, col, sub) {
    RT.slams.push({ txt: txt, col: col, sub: sub || '', t: 0.55, max: 0.55 });
    RT.shake = shake(9); RT.chroma = 0.5;
}
function drawSlams(cx, dt) {
    for (var i = RT.slams.length - 1; i >= 0; i--) {
        var s = RT.slams[i]; s.t -= dt;
        if (s.t <= 0) { RT.slams.splice(i, 1); continue; }
        var k = 1 - s.t / s.max;
        var scale = k < 0.18 ? lerp(2.6, 1, k / 0.18) : 1 + (k - 0.18) * 0.16;
        var a = k < 0.18 ? 1 : clamp(1 - (k - 0.5) * 2.4, 0, 1);
        cx.save();
        cx.translate(VW / 2, VH * 0.44); cx.scale(scale, scale); cx.globalAlpha = a;
        cx.textAlign = 'center';
        cx.font = 'bold 62px "Press Start 2P", monospace';
        // chromatic split — cheap, reads as impact
        cx.globalCompositeOperation = 'lighter';
        cx.fillStyle = 'rgba(255,60,90,.55)'; cx.fillText(s.txt, -3 * (1 - k), 0);
        cx.fillStyle = 'rgba(60,180,255,.55)'; cx.fillText(s.txt, 3 * (1 - k), 0);
        cx.globalCompositeOperation = 'source-over';
        cx.fillStyle = '#0a0710'; cx.fillText(s.txt, 3, 4);
        cx.fillStyle = s.col; cx.fillText(s.txt, 0, 0);
        if (s.sub) { cx.font = '13px "Pixelify Sans"'; cx.fillStyle = 'rgba(230,220,240,.75)'; cx.fillText(s.sub, 0, 30); }
        cx.restore();
    }
    cx.textAlign = 'left';
}

/* tier 3 — a line writing itself across the screen. used by the
   stanzas while time is at thirty percent, and by story beats. */
function bigLine(txt, sub, col, dur) {
    RT.lines.push({ txt: txt, sub: sub || '', col: col || '#f0e9df', t: dur || 2.2, max: dur || 2.2 });
}
function drawLines(cx, dt) {
    for (var i = RT.lines.length - 1; i >= 0; i--) {
        var L = RT.lines[i]; L.t -= dt;
        if (L.t <= 0) { RT.lines.splice(i, 1); continue; }
        var k = 1 - L.t / L.max;
        var chars = Math.ceil(L.txt.length * clamp(k / 0.35, 0, 1));      // typewriter in
        var a = clamp(L.t / 0.5, 0, 1);
        var y = VH * 0.3 + i * 44;
        cx.save(); cx.globalAlpha = a; cx.textAlign = 'center';
        cx.font = '30px "VT323", monospace';
        cx.fillStyle = '#08060c'; cx.fillText(L.txt.slice(0, chars), VW / 2 + 2, y + 2);
        cx.fillStyle = L.col; cx.fillText(L.txt.slice(0, chars), VW / 2, y);
        if (L.sub && k > 0.3) {
            cx.font = 'bold 22px "Press Start 2P", monospace';
            cx.fillStyle = L.col; cx.globalAlpha = a * clamp((k - 0.3) * 3, 0, 1);
            cx.fillText(L.sub, VW / 2, y + 34);
        }
        cx.restore();
    }
    cx.textAlign = 'left';
}
function shake(a, cap) { if (!S.opts.shake) return RT.shake; return Math.min(cap == null ? 14 : cap, RT.shake + a); }

/* narration — the slow channel. full sentences live here and
   nowhere near a fight. */
function say(html, cls) {
    if (!RT) return;
    var el = RT.root.querySelector('.nn-say');
    var d = document.createElement('div');
    d.className = 'nn-line' + (cls ? ' nn-' + cls : '');
    d.innerHTML = html;
    el.appendChild(d);
    while (el.children.length > 5) el.removeChild(el.firstChild);
    setTimeout(function () { if (d.parentNode) { d.classList.add('out'); setTimeout(function () { if (d.parentNode) d.remove(); }, 700); } }, 5200);
}

/* ─────────────── runtime ─────────────── */
var RT = null;
function stanzaKeys() { return S.opts.wasd ? ['q', 'e', 'f'] : ['q', 'w', 'e']; }
function refreshStanzaKeys() {
    if (!RT) return;
    var k = stanzaKeys();
    RT.root.querySelectorAll('.nn-st').forEach(function (b, i) {
        if (i < 3) b.querySelector('b').textContent = k[i].toUpperCase();
    });
}
function init(el) {
    sLoad();
    var root = el.querySelector('.nn'), cv = root.querySelector('.nn-cv');
    RT = {
        el: el, root: root, cv: cv, cx: cv.getContext('2d'),
        started: Date.now(), t: 0, last: 0, raf: 0, timers: [],
        keys: {}, mouse: { x: VW / 2, y: VH / 2, wx: GRID / 2, wy: GRID / 2, down: false, rdown: false },
        px: GRID / 2, py: GRID / 2 + 2, vx: 0, vy: 0, face: 0, walking: false, moveTo: null,
        hp: 100, hpm: 100, hurt: 0, dead: false, deadT: 0, iframe: 0,
        breath: T('breathMax'), silence: 0, winded: 0,
        echo: 0, dash: 0,
        foes: [], fproj: [], parts: [], typo: [], slams: [], lines: [],
        calls: [], snaps: [], rings: [], beats: [],
        callCd: 0, answerCd: 0, conceal: 0, sourN: 0,
        place: S.place, wave: 0, waveT: 0, phase: 'idle', pending: [],
        dialog: null, prompt: null, pressure: 0, cleared: false, mapOpen: false,
        shake: 0, chroma: 0, flash: 0, dilate: 0, mono: 0, timeScale: 1,
        stanzaCd: [0, 0, 0], casting: null, recital: null, verseCast: 0,
        toasts: [], panel: null, devTab: 'SCENE', devOpen: false,
        god: 0, infBreath: 0, holdStacks: 0, oneShot: 0,
        dbgStacks: 0, dbgAI: 0, dbgHit: 0, dbgPerf: 0,
        fps: 0, _fc: 0, _ft: 0, ac: null, tookHit: false
    };
    wireInput(root, cv);
    wireHud(root);
    refreshStanzaKeys();
    gotoPlace(S.place, false);
    updateHud(0);
    RT.last = performance.now();
    RT.raf = requestAnimationFrame(frame);
    if (/[?&]dev=/.test(location.search)) {
        window.__ninth = {
            tick: function (n, dt) { for (var i = 0; i < (n || 1); i++) step(dt || 1 / 60); draw(); },
            call: function () { doCall(); }, answer: function () { doAnswer(); },
            stanza: function (n) { doStanza(n); },
            aim: function (x, y) { RT.mouse.wx = x; RT.mouse.wy = y; RT.mouse.x = isoX(x, y); RT.mouse.y = isoY(x, y); },
            aimFoe: function (i) { var f = RT.foes.filter(function (q) { return !q.dead; })[i || 0]; if (f) window.__ninth.aim(f.x, f.y); return !!f; },
            spawn: function (k, x, y) { return spawnFoe(k, x == null ? GRID / 2 : x, y == null ? GRID / 2 - 3 : y); },
            place: function (id) { gotoPlace(id, true); },
            talk: function (id) { var n = NPCS[id]; if (n) openDialog(n.talk(), n.n); },
            interact: function () { RT.prompt = nearestInteract(); doInteract(); },
            slot: function (c, a) { if (c) S.call = c; if (a) S.answer = a; sSave(); updateHud(0); },
            frag: function (n) { grantFragment(n); },
            state: function () {
                var f = RT.foes.filter(function (q) { return !q.dead; });
                return { place: RT.place, hp: RT.hp, breath: Math.round(RT.breath), winded: RT.winded > 0, echo: Math.round(RT.echo), dialog: !!RT.dialog, prompt: RT.prompt && RT.prompt.label,
                         foes: f.length, stacks: f.map(function (q) { return q.stacks.length; }), coin: S.coin,
                         call: S.call, answer: S.answer, dead: RT.dead, phase: RT.phase, wave: RT.wave, dilate: RT.dilate };
            },
            S: function () { return S; }, RT: function () { return RT; }, TUNE: TUNE
        };
    }
    if (/ndev=/.test(location.search)) devDemo();      // any capture mode, not just demo
    setTimeout(function () { root.focus(); }, 30);
}

/* ─────────────── input ─────────────── */
function wireInput(root, cv) {
    function toWorld(e) {
        var r = cv.getBoundingClientRect();
        var sc = Math.min(r.width / VW, r.height / VH) || 1;
        var ox = (r.width - VW * sc) / 2, oy = (r.height - VH * sc) / 2;
        var mx = (e.clientX - r.left - ox) / sc, my = (e.clientY - r.top - oy) / sc;
        var a = (mx - ORX) / (TILE_W / 2), b = (my - ORY) / (TILE_H / 2);
        return { x: mx, y: my, wx: (a + b) / 2, wy: (b - a) / 2 };
    }
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) {
        if (!RT) return; var p = toWorld(e);
        RT.mouse.x = p.x; RT.mouse.y = p.y; RT.mouse.wx = p.wx; RT.mouse.wy = p.wy;
    });
    cv.addEventListener('pointerdown', function (e) {
        if (!RT) return; root.focus();
        var p = toWorld(e);
        RT.mouse.x = p.x; RT.mouse.y = p.y; RT.mouse.wx = p.wx; RT.mouse.wy = p.wy;
        if (e.button === 2) { RT.mouse.rdown = true; doAnswer(); }
        else if (e.button === 0) {
            RT.mouse.down = true;
            if (!S.opts.wasd && !e.shiftKey && !foeNear(p.wx, p.wy, 1.2)) RT.moveTo = { x: clamp(p.wx, 0.7, GRID - 0.7), y: clamp(p.wy, 0.7, GRID - 0.7) };
            else doCall();
        }
    });
    window.addEventListener('pointerup', RT.mup = function (e) {
        if (!RT) return;
        if (e.button === 2) RT.mouse.rdown = false;
        if (e.button === 0) RT.mouse.down = false;
    });
    root.addEventListener('keydown', function (e) {
        if (!RT || e.altKey || e.ctrlKey || e.metaKey) return;
        var k = e.key.toLowerCase();
        if (k === '`' || k === '~') { toggleDev(); e.preventDefault(); return; }
        if (k === 'escape') { if (RT.devOpen) toggleDev(); else if (RT.panel) panel(null); e.stopPropagation(); e.preventDefault(); return; }
        RT.keys[k] = true;
        if (e.repeat) { e.preventDefault(); return; }
        var sk = stanzaKeys();
        if (k === sk[0]) doStanza(1);
        else if (k === sk[1]) doStanza(2);
        else if (k === sk[2]) doStanza(3);
        else if (k === 'r') doVerse();
        else if (k === ' ') doDash();
        else if (k === 'e' && !S.opts.wasd) doInteract();
        else if (k === 'f' && S.opts.wasd && !S.stanzas[3]) doInteract();
        else if (k === 'm') { RT.mapOpen = !RT.mapOpen; }
        else if (k === 'b') panel('book');
        else if (k === 'c') panel('kit');
        else if (k === 'v') panel('shop');
        else return;
        e.preventDefault(); e.stopPropagation();
    });
    root.addEventListener('keyup', function (e) { if (RT) RT.keys[e.key.toLowerCase()] = false; });
    root.addEventListener('focusout', function (e) {
        if (!RT || (e.relatedTarget && root.contains(e.relatedTarget))) return;
        RT.keys = {}; RT.mouse.down = false; RT.mouse.rdown = false;
    });
}
function foeNear(x, y, r) { return !!RT.foes.filter(function (f) { return !f.dead && Math.hypot(f.x - x, f.y - y) < r + f.r; })[0]; }

/* ─────────────── the actor ───────────────
   Breath is mana and you take a breath by not casting. The ramp
   is the whole lesson: holding the button is strictly worse than
   bursting and pausing, so the rhythm teaches itself. */
function stepPlayer(dt) {
    var st = stats();
    if (RT.winded > 0) { RT.winded -= dt; if (RT.winded <= 0) say('You get your breath back.', 'dim'); }
    RT.silence += dt;
    if (RT.infBreath) RT.breath = st.breathMax;
    else if (RT.winded <= 0) {
        var rate = RT.silence >= st.rampAfter ? st.ramp : st.regen;
        RT.breath = Math.min(st.breathMax, RT.breath + rate * dt);
    }
    RT.echo = Math.max(0, RT.echo - (RT.foes.length ? 0 : st.echoDecay) * dt);
    RT.iframe = Math.max(0, RT.iframe - dt);
    RT.hurt = Math.max(0, RT.hurt - dt);
    RT.dash = Math.max(0, RT.dash - dt);
    for (var i = 0; i < 3; i++) RT.stanzaCd[i] = Math.max(0, RT.stanzaCd[i] - dt);
    if (RT.casting) { RT.casting.t -= dt; if (RT.casting.t <= 0) RT.casting = null; }
    if (RT.dead) return;

    var spd = st.moveSpd, mx = 0, my = 0;
    if (S.opts.wasd) {
        if (RT.keys.w) { mx -= 1; my -= 1; }
        if (RT.keys.s) { mx += 1; my += 1; }
        if (RT.keys.a) { mx -= 1; my += 1; }
        if (RT.keys.d) { mx += 1; my -= 1; }
    }
    if (RT.dialog || RT.mapOpen) { RT.walking = false; mx = my = 0; RT.moveTo = null; }
    if (mx || my) {
        RT.moveTo = null;
        var l = Math.hypot(mx, my); mx /= l; my /= l;
        moveActor(RT.px + mx * spd * dt, RT.py + my * spd * dt); RT.walking = true;
    } else if (RT.moveTo) {
        var dx = RT.moveTo.x - RT.px, dy = RT.moveTo.y - RT.py, d = Math.hypot(dx, dy);
        if (d < 0.14) { RT.moveTo = null; RT.walking = false; }
        else { moveActor(RT.px + dx / d * spd * dt, RT.py + dy / d * spd * dt); RT.walking = true; }
    } else RT.walking = false;
    stepTravel();
    RT.prompt = nearestInteract();
    RT.face = Math.atan2(RT.mouse.wy - RT.py, RT.mouse.wx - RT.px);
    // holding the call button keeps calling — this is the spam verb
    if (RT.mouse.down && S.opts.wasd) doCall();
}
function doDash() {
    if (RT.dead || RT.dash > 0) return;
    var a = Math.atan2(RT.mouse.wy - RT.py, RT.mouse.wx - RT.px);
    var d = Math.min(Math.hypot(RT.mouse.wx - RT.px, RT.mouse.wy - RT.py), T('dashDist'));
    moveActor(RT.px + Math.cos(a) * d, RT.py + Math.sin(a) * d);
    RT.dash = T('dashCd'); RT.iframe = Math.max(RT.iframe, 0.3); RT.moveTo = null;
    burst(RT.px, RT.py, 8, 10, { col: '200,190,220', sp0: 0.3, sp1: 1.4, l0: 0.2, l1: 0.5, add: 0 });
    sfx('step');
}
function hurtPlayer(n, src) {
    if (RT.dead || RT.god || RT.iframe > 0) return;
    RT.hp -= n; RT.hurt = 0.4; RT.iframe = 0.35; RT.tookHit = true;
    RT.shake = shake(4);
    typo(RT.px, RT.py, '-' + Math.round(n), '#ff5a6a', 0.7, 13, 'drift');
    sfx('hurt');
    if (RT.hp <= 0) {
        RT.hp = 0; RT.dead = true; RT.deadT = 2.2;
        bigLine('you lose your place', '', '#ff5a6a', 2);
        say('You lose your place in the line. Bern would tell you to take it from the top.', 'bad');
        sfx('down');
    }
}
function revive() {
    RT.dead = false; RT.hp = RT.hpm; RT.breath = stats().breathMax; RT.iframe = 1.6;
    RT.px = pw() / 2; RT.py = ph() - 2;
    RT.foes.forEach(function (f) { f.stacks.length = 0; });
    say('Take it from the top.', 'dim');
}

/* the actor: a young Emberwright in a tin crown, carrying a lantern
   that is the most powerful object in the world and also a prop. */
function drawActor(cx) {
    var sx = isoX(RT.px, RT.py), sy = isoY(RT.px, RT.py) + TILE_H / 2;
    var bob = RT.walking ? Math.sin(RT.t * 12) * 1.8 : Math.sin(RT.t * 2.2) * 0.7;
    var west = Math.cos(RT.face) < 0 ? -1 : 1;
    var cast = RT.casting ? clamp(RT.casting.t / RT.casting.max, 0, 1) : 0;
    cx.save(); cx.translate(sx, sy - bob);
    if (RT.iframe > 0 && !RT.dead) cx.globalAlpha = 0.55 + Math.sin(RT.t * 26) * 0.35;
    cx.fillStyle = 'rgba(0,0,0,.45)'; cx.beginPath(); cx.ellipse(0, bob, 10, 4, 0, 0, TAU); cx.fill();
    cx.scale(west, 1);
    if (RT.dead) { cx.rotate(1.2); }
    // coat
    cx.fillStyle = '#2b2434'; cx.beginPath();
    cx.moveTo(-7, 0); cx.lineTo(-5, -19); cx.lineTo(5, -19); cx.lineTo(7, 0); cx.closePath(); cx.fill();
    cx.fillStyle = '#3a3048'; cx.fillRect(-5, -20, 10, 9);
    cx.fillStyle = '#8a6a3a'; cx.fillRect(-5, -13, 10, 2);          // belt
    // head + the tin crown
    cx.fillStyle = '#d8b48c'; cx.beginPath(); cx.arc(0, -25, 5.4, 0, TAU); cx.fill();
    cx.fillStyle = '#1c1620'; cx.fillRect(-4, -28, 8, 3);
    cx.fillStyle = '#c9a94a'; cx.fillRect(-6, -31, 12, 2);
    for (var i = 0; i < 3; i++) { cx.fillRect(-5 + i * 4, -33, 2, 2); }
    // lantern arm, rises as you cast
    var arm = lerp(0.35, -0.75, 1 - cast);
    cx.save(); cx.translate(5, -18); cx.rotate(RT.casting ? arm : 0.35);
    cx.fillStyle = '#2b2434'; cx.fillRect(0, -1.5, 8, 3);
    cx.save(); cx.translate(9, 2);
    cx.fillStyle = '#6a5a3a'; cx.fillRect(-3, -8, 6, 8);
    cx.globalCompositeOperation = 'lighter';
    var pul = 0.55 + Math.sin(RT.t * 5) * 0.16 + (RT.casting ? 0.5 : 0);
    cx.fillStyle = 'rgba(255,190,90,' + (0.5 * pul) + ')';
    cx.beginPath(); cx.arc(0, -4, 7 + (RT.casting ? 4 : 0), 0, TAU); cx.fill();
    cx.fillStyle = 'rgba(255,240,200,' + (0.9 * pul) + ')';
    cx.beginPath(); cx.arc(0, -4, 2.4, 0, TAU); cx.fill();
    cx.globalCompositeOperation = 'source-over';
    cx.restore(); cx.restore();
    cx.restore();
    // the lantern throws real light on the floor
    cx.save(); cx.globalCompositeOperation = 'lighter';
    var lg = cx.createRadialGradient(sx, sy - 10, 6, sx, sy - 10, 120);
    lg.addColorStop(0, 'rgba(255,190,90,.14)'); lg.addColorStop(1, 'rgba(255,180,70,0)');
    cx.fillStyle = lg; cx.beginPath(); cx.arc(sx, sy - 10, 120, 0, TAU); cx.fill(); cx.restore();
}

/* ═══════════════ CALL AND ANSWER ═══════════════
   Two verbs, and everything hangs off them.
   CALL   cheap, spammable, low damage, leaves a rhyme stack.
   ANSWER heavy, detonates every stack on screen that matches its
          sound, scaling with each enemy's own stack count.
   The same button covers both ARPG fantasies: sweep a pack with
   calls and answer for a screen-wide detonation, or dump six
   stacks on one elite and answer for one enormous hit. */

function spendBreath(cost) {
    var st = stats();
    if (RT.winded > 0) return false;
    if (RT.infBreath) return true;
    if (RT.breath <= 0) return false;
    RT.breath -= cost; RT.silence = 0;
    if (RT.breath <= 0) {                       // hit zero and you are winded
        RT.breath = 0; RT.winded = T('windedT');
        ach('winded');
        slam('WINDED', '#8a8090', 'doubled over, and everything can see you');
        sfx('winded');
        say('You run out of air mid-line. <i>Winded.</i>', 'bad');
    }
    return true;
}

/* ─────────────── CALL ───────────────
   The word itself is the projectile. It flies, it lands, it pops
   small, and it leaves a syllable stuck to whatever it touched. */
function doCall() {
    if (!RT || RT.dead || RT.devOpen || RT.dialog || RT.mapOpen) return;
    if (RT.winded > 0) { hudNudge('breath'); return; }
    if (RT.callCd > 0) return;
    var st = stats();
    if (!spendBreath(st.callCost)) { hudNudge('breath'); return; }
    RT.callCd = 0.19;
    RT.casting = { t: 0.13, max: 0.13 };
    var fam = callFam(), word = S.call;
    var a = Math.atan2(RT.mouse.wy - RT.py, RT.mouse.wx - RT.px);
    RT.calls.push({ x: RT.px + Math.cos(a) * 0.5, y: RT.py + Math.sin(a) * 0.5,
        vx: Math.cos(a) * 13, vy: Math.sin(a) * 13, life: T('callRange') / 13,
        word: word.toUpperCase(), fam: fam, hit: [] });
    ach('firstcall');
    speakPressure();          // saying it out loud is what brings them
    sfx('call');
}
function stepCalls(dt) {
    for (var i = RT.calls.length - 1; i >= 0; i--) {
        var c = RT.calls[i];
        c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt;
        if (Math.random() < 0.6) part({ x: c.x, y: c.y, z: 26 + rnd(-3, 3), vx: 0, vy: 0, vz: rnd(2, 10),
            life: rnd(0.15, 0.35), size: rnd(1, 2.4), col: hex2rgb(FAMS[c.fam].col), add: 1, grav: 0 });
        var f = firstFoeAt(c.x, c.y, 0.45, c.hit);
        if (f) {
            c.hit.push(f);
            landCall(f, c);
            RT.calls.splice(i, 1); continue;
        }
        if (c.life <= 0 || c.x < -1 || c.x > GRID + 1 || c.y < -1 || c.y > GRID + 1) RT.calls.splice(i, 1);
    }
}
function landCall(f, c) {
    var st = stats();
    var dmg = st.callDmg * famDmgMul(c.fam);
    hurtFoe(f, dmg, c.fam, { call: 1 });
    // tier 1: a small word pops at the impact point. deliberately underwhelming.
    typo(f.x, f.y, c.word, FAMS[c.fam].col, 0.5, 13, 'pop');
    burst(f.x, f.y, 26, 5, { col: hex2rgb(FAMS[c.fam].col), sp0: 0.3, sp1: 1.3, l0: 0.15, l1: 0.4 });
    if (!f.dead) addStack(f, c.fam);
    RT.shake = shake(0.7, 4);
    sfx('hit');
}
/* a rhyme stack: a glowing syllable stuck to an enemy, four
   seconds of shelf life, and a promise you have to keep */
function addStack(f, fam) {
    if (f.def.norhyme) {                      // nothing rhymes with sword
        typo(f.x, f.y, 'NO RHYME', '#8a8090', 0.55, 9, 'drift');
        return;
    }
    var st = stats();
    f.stacks.push({ fam: fam, t: st.stackLife, max: st.stackLife, born: RT.t });
    while (f.stacks.length > st.stackMax) f.stacks.shift();
}
function stepStacks(dt) {
    var st = stats();
    for (var i = 0; i < RT.foes.length; i++) {
        var f = RT.foes[i]; if (f.dead) continue;
        for (var j = f.stacks.length - 1; j >= 0; j--) {
            if (RT.holdStacks) continue;
            var s = f.stacks[j]; s.t -= dt;
            if (s.t <= 0) { f.stacks.splice(j, 1); breakStack(f, s); }
        }
    }
}
/* BREAK — an unfinished line goes sour. this is the mechanical
   statement of Hal's entire condition, and it is what stops you
   spamming call forever. */
function breakStack(f, s) {
    RT.echo = Math.max(0, RT.echo - 6);
    if (!RT.god) { RT.hp -= T('breakSelfDmg'); RT.hurt = Math.max(RT.hurt, 0.25); }
    typo(f.x, f.y, 'sour', '#6a5f72', 0.7, 9, 'drift');
    part({ x: f.x, y: f.y, z: 34, vx: 0, vy: 0, vz: -6, life: 0.5, size: 3, col: '106,95,114', add: 0, grav: 0 });
    RT.sourN = (RT.sourN || 0) + 1;
    if (RT.sourN >= 4) ach('sour');
    if (RT.hp <= 0 && !RT.dead) hurtPlayer(0);
}

/* ─────────────── ANSWER ───────────────
   Detonates every rhyme on screen that matches its sound. Damage
   per enemy scales with that enemy's own stack count. Answer a
   stack with the wrong sound and you get a slant: half damage,
   no element, no echo. Weak, not punishing. */
function doAnswer() {
    if (!RT || RT.dead || RT.devOpen || RT.dialog || RT.mapOpen) return;
    if (RT.winded > 0) { hudNudge('breath'); return; }
    if (RT.answerCd > 0) return;
    var st = stats();
    if (!spendBreath(st.answerCost)) { hudNudge('breath'); return; }
    RT.answerCd = 0.34;
    RT.casting = { t: 0.22, max: 0.22 };
    var fam = answerFam(), word = S.answer.toUpperCase();
    var live = RT.foes.filter(function (f) { return !f.dead && f.stacks.length; });
    var totalMatched = 0, hitFoes = 0, best = 0, anySlant = false;

    live.forEach(function (f) {
        var match = 0, other = 0;
        f.stacks.forEach(function (s) { if (s.fam === fam) match++; else other++; });
        if (!match && !other) return;
        var closed = match > 0;
        var n = closed ? match : other;
        var dmg = (st.answerBase + st.answerPerStack * n) * famDmgMul(fam);
        if (!closed) { dmg *= st.slantMul; anySlant = true; }
        // the deaf hear nothing: only -ill touches them
        if (f.def.deaf && fam !== 'ill') dmg *= 0.25;
        hurtFoe(f, dmg, fam, { answer: 1, closed: closed, n: n });
        if (closed) { totalMatched += match; if (match > best) best = match; famEffect(f, fam, match); }
        hitFoes++;
        // the stacks are spent either way
        f.stacks = f.stacks.filter(function (s) { return closed ? s.fam !== fam : false; });
        snapStacks(f, closed ? FAMS[fam].col : '#6a5f72', n);
    });

    if (totalMatched > 0) {
        RT.echo = Math.min(T('echoMax'), RT.echo + T('echoPerStack') * totalMatched * st.echoGain);
        ach('couplet');
        if (best >= 6) ach('six');
        if (hitFoes >= 8) ach('crowd');
        slam(word, FAMS[fam].col, totalMatched + ' closed');
        sfx('answer');
    } else if (anySlant) {
        ach('slant');
        slam(word, '#6a5f72', 'slant');
        RT.shake = shake(3);
        sfx('slant');
    } else {
        // answering nothing at all: the word goes out and finds no rhyme
        typo(RT.px, RT.py, word, '#4d4757', 0.5, 12, 'pop');
        sfx('empty');
    }
}
/* every stack on screen snaps into alignment before it goes */
function snapStacks(f, col, n) {
    RT.snaps.push({ x: f.x, y: f.y, col: col, n: n, t: 0.32, max: 0.32 });
    burst(f.x, f.y, 30, 4 + n * 2, { col: hex2rgb(col), sp0: 0.5, sp1: 2.4, l0: 0.2, l1: 0.6 });
}
function drawSnaps(cx, dt) {
    for (var i = RT.snaps.length - 1; i >= 0; i--) {
        var s = RT.snaps[i]; s.t -= dt;
        if (s.t <= 0) { RT.snaps.splice(i, 1); continue; }
        var k = 1 - s.t / s.max;
        var sx = isoX(s.x, s.y), sy = isoY(s.x, s.y) + TILE_H / 2 - 44;
        cx.save(); cx.globalAlpha = 1 - k; cx.strokeStyle = s.col; cx.lineWidth = 2;
        var w = 12 + s.n * 7;
        cx.beginPath(); cx.moveTo(sx - w * (1 - k), sy); cx.lineTo(sx + w * (1 - k), sy); cx.stroke();
        cx.restore();
    }
}

/* ─────────────── what each family DOES ───────────────
   Words that rhyme share a nature. The detonation is where the
   nature shows up. */
function famEffect(f, fam, n) {
    if (fam === 'eat') {                              // hunger, burn, drain
        f.burn = { dps: 5 * n, t: 3 };
        if (!RT.god) RT.hp = Math.min(RT.hpm, RT.hp + n * 1.5);
        typo(f.x, f.y, 'BURN', FAMS.eat.col, 0.5, 10, 'drift');
    } else if (fam === 'ight') {                      // reveal, strip armour, true damage
        f.revealed = 5; f.armor = 0;
        typo(f.x, f.y, 'SEEN', FAMS.ight.col, 0.5, 10, 'drift');
    } else if (fam === 'erd') {                       // command, silence, counter
        f.silence = 1.6 + n * 0.25; f.state = 'walk'; f.tell = 0;
        typo(f.x, f.y, 'HUSH', FAMS.erd.col, 0.5, 10, 'drift');
    } else if (fam === 'ark') {                       // shadow, damage over time, conceal
        f.burn = { dps: 3.5 * n, t: 5 };
        RT.conceal = 4;                               // thieves cannot read your stacks for a while
        typo(f.x, f.y, 'DARK', FAMS.ark.col, 0.5, 10, 'drift');
    } else if (fam === 'ill') {                       // stun, freeze, execute
        f.frozen = 1.4 + n * 0.2;
        if (f.hp / f.hpm < 0.18 && !f.def.boss) { hurtFoe(f, f.hp + 1, 'ill', { exec: 1 }); typo(f.x, f.y, 'STILL', FAMS.ill.col, 0.7, 13, 'drift'); }
        if (f.def.deaf && f.dead) ach('deaf');
    }
}

/* ─────────────── damage into an enemy ─────────────── */
function hurtFoe(f, dmg, fam, o) {
    o = o || {};
    if (f.dead) return 0;
    if (RT.oneShot) dmg = f.hp + 1;
    if (f.revealed > 0) dmg *= 1.25;
    if (f.armor && !o.exec) dmg = Math.max(1, dmg - f.armor);
    dmg = Math.max(1, Math.round(dmg));
    if (o.call) f.callDmg = 1; else f.otherDmg = 1;      // the Sword joke needs to know
    f.hp -= dmg; f.flash = 0.09; f.wob = Math.min(1, f.wob + 0.5);
    if (o.answer) typo(f.x + rnd(-.2, .2), f.y, String(dmg), o.closed ? FAMS[fam].col : '#8a8090', 0.8, o.closed ? 16 : 12, 'drift');
    else if (!o.dot) typo(f.x + rnd(-.25, .25), f.y, String(dmg), 'rgba(230,225,240,.9)', 0.55, 10, 'drift');
    if (f.hp <= 0) foeDie(f);
    return dmg;
}
function hex2rgb(h) {
    if (h.charAt(0) !== '#') return '200,200,200';
    return parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' + parseInt(h.slice(5, 7), 16);
}
function firstFoeAt(x, y, r, skip) {
    for (var i = 0; i < RT.foes.length; i++) {
        var f = RT.foes[i];
        if (f.dead || (skip && skip.indexOf(f) >= 0)) continue;
        if (Math.hypot(f.x - x, f.y - y) <= r + f.r) return f;
    }
    return null;
}

/* ═══════════════ STANZAS ═══════════════
   Your big cooldowns. Each one is a four line stanza of the
   ballad. Casting dilates time to about thirty percent while the
   lines write themselves across the screen, each landing as its
   own wave of damage. Brief slow-mo on a long cooldown is how you
   get typographic spectacle into a fast game without stopping it. */
var STANZAS = [
    { n: 'Stanza I', frag: 1, fam: 'erd', bal: 2, cd: 14, cost: 22,
      lines: ['She stood up in the empty square,', 'she spoke and we all heard.', 'She asked us for a single coal,', 'and we would not say a word.'] },
    { n: 'Stanza II', frag: 2, fam: 'ark', bal: 3, cd: 16, cost: 26,
      lines: ['She walked out past the mill, the well,', 'she walked out past the mark,', 'and he held the last coal in the town', 'and he watched her from the dark.'] },
    { n: 'Stanza III', frag: 3, fam: 'ill', bal: 6, cd: 20, cost: 30,
      lines: ['So light your lamps on the ninth night', 'and set one on the sill,', 'not for the man who came back down', 'but for the girl who never will.'] }
];
function doStanza(n) {
    if (!RT || RT.dead || RT.devOpen) return;
    var sz = STANZAS[n - 1]; if (!sz) return;
    if (!S.stanzas[n]) { hudNudge('stanza' + n); say('You do not have that stanza yet.', 'dim'); return; }
    if (RT.stanzaCd[n - 1] > 0) { hudNudge('stanza' + n); return; }
    if (RT.winded > 0) { hudNudge('breath'); return; }
    if (!spendBreath(sz.cost)) { hudNudge('breath'); return; }
    RT.stanzaCd[n - 1] = sz.cd;
    RT.dilate = T('dilationT');
    RT.recital = { sz: sz, t: 0, line: -1, n: n };
    ach('stanza');
    sfx('stanza');
}
function stepRecital(dt) {
    if (!RT.recital) return;
    var r = RT.recital, dur = T('dilationT');
    r.t += dt;
    var want = Math.min(3, Math.floor(r.t / (dur / 4)));
    while (r.line < want) {
        r.line++;
        var isLast = r.line === 3;
        bigLine(r.sz.lines[r.line], isLast ? r.sz.lines[r.line].split(' ').pop().replace(/[.,]/g, '').toUpperCase() : '', FAMS[r.sz.fam].col, 1.1);
        stanzaWave(r.sz, isLast);
    }
    if (r.t >= dur) RT.recital = null;
}
/* each line lands as its own wave, the last one twice as hard */
function stanzaWave(sz, big) {
    var st = stats();
    var dmg = (st.answerBase * (big ? 2.6 : 1.1) + st.answerPerStack * (big ? 3 : 1)) * famDmgMul(sz.fam);
    RT.rings.push({ x: RT.px, y: RT.py, r: 0.4, max: big ? 7.5 : 5.5, col: hex2rgb(FAMS[sz.fam].col), t: 0.5, life: 0.5 });
    RT.shake = shake(big ? 10 : 4);
    RT.foes.forEach(function (f) {
        if (f.dead) return;
        if (Math.hypot(f.x - RT.px, f.y - RT.py) > (big ? 7.5 : 5.5)) return;
        if (f.def.deaf && sz.fam !== 'ill') { typo(f.x, f.y, 'deaf', '#6a5f72', 0.4, 9, 'drift'); return; }
        hurtFoe(f, dmg, sz.fam, { answer: 1, closed: 1, n: 1 });
        if (!f.dead) famEffect(f, sz.fam, big ? 3 : 1);
    });
    sfx(big ? 'wave2' : 'wave');
}

/* ═══════════════ VERSE ═══════════════
   R sits on the bar, visible, locked, from the first minute to
   the last fight. Four hours of a promise the UI is making. You
   press it once, ever, and it is the corrected ballad. */
function doVerse() {
    if (!RT || RT.devOpen) return;
    if (!S.verse) {
        hudNudge('verse');
        var lines = ['Not yet.', 'You do not have all of it.', 'Something is still missing from the end.'];
        say('<i>' + pick(lines) + '</i>', 'dim');
        return;
    }
    if (RT.verseCast) return;
    RT.verseCast = 1;
    RT.dilate = 6; RT.mono = 6;
    var i = 0;
    BALLAD.forEach(function (st, k) {
        st.r.forEach(function (ln, j) {
            RT.timers.push(setTimeout(function () {
                if (!RT) return;
                bigLine(ln, '', k === 6 && j === 3 ? '#ffe66e' : '#f0e9df', 1.4);
                if (j === 3) {
                    RT.foes.forEach(function (f) { if (!f.dead) hurtFoe(f, 999, 'ight', { answer: 1, closed: 1, n: 4 }); });
                    RT.shake = shake(12);
                }
            }, (i++) * 260));
        });
    });
    RT.timers.push(setTimeout(function () { if (RT) { RT.verseCast = 0; say('The ballad closes. Every rhyme lands.', 'good'); } }, i * 260 + 1200));
    sfx('verse');
}

/* expanding ground rings, shared by stanzas and boss pulses */
function drawRings(cx, dt) {
    for (var i = RT.rings.length - 1; i >= 0; i--) {
        var g = RT.rings[i]; g.t -= dt;
        if (g.t <= 0) { RT.rings.splice(i, 1); continue; }
        var k = 1 - g.t / g.life, rr = g.max * (0.15 + 0.85 * k);
        var sx = isoX(g.x, g.y), sy = isoY(g.x, g.y) + TILE_H / 2;
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5); cx.globalCompositeOperation = 'lighter';
        cx.strokeStyle = 'rgba(' + g.col + ',' + (0.85 * (1 - k)).toFixed(3) + ')';
        cx.lineWidth = 5 * (1 - k) + 1;
        cx.beginPath(); cx.arc(0, 0, rr * TILE_W / 2, 0, TAU); cx.stroke(); cx.restore();
    }
}

/* ═══════════════ HEARSAY ═══════════════
   Trash is misrememberings: loose bits of the play, crowd noise,
   applause with teeth. The counters are the whole lesson. */
function spawnFoe(kind, x, y) {
    var def = FOES[kind]; if (!def || !RT) return null;
    var f = {
        kind: kind, def: def, x: clamp(x, 0.8, pw() - 0.8), y: clamp(y, 0.8, ph() - 0.8),
        hp: def.hp * T('ttk'), hpm: def.hp * T('ttk'), r: def.r,
        stacks: [], state: 'walk', tell: 0, atkT: rnd(0, 0.6), flash: 0, wob: 0, dead: 0,
        silence: 0, frozen: 0, burn: null, revealed: 0, armor: 0, spawn: 0.45,
        anim: rnd(0, TAU), steal: def.steal || 0, drone: def.drone || 0, pulse: def.pulse || 0, said: 0,
        so: irnd(0, 2) * 9          // stack-row stagger: piled enemies must stay readable
    };
    if (RT.foes.length < 70) RT.foes.push(f);
    burst(f.x, f.y, 10, 8, { col: '160,150,175', sp0: 0.4, sp1: 1.6, l0: 0.2, l1: 0.5, add: 0 });
    return f;
}
function stepFoes(dt) {
    var alive = 0;
    for (var i = RT.foes.length - 1; i >= 0; i--) {
        var f = RT.foes[i];
        if (!f) continue;
        f.flash = Math.max(0, f.flash - dt); f.wob = Math.max(0, f.wob - dt * 3);
        f.spawn = Math.max(0, f.spawn - dt); f.anim += dt;
        f.revealed = Math.max(0, f.revealed - dt);
        f.silence = Math.max(0, f.silence - dt);
        f.frozen = Math.max(0, f.frozen - dt);
        if (f.dead) { RT.foes.splice(i, 1); continue; }
        alive++;
        if (f.burn) {                                  // -eat and -ark leave something cooking
            f.burn.t -= dt; f.burn.tick = (f.burn.tick || 0) - dt;
            if (f.burn.tick <= 0) { f.burn.tick = 0.5; hurtFoe(f, f.burn.dps * 0.5, 'eat', { dot: 1 });
                part({ x: f.x, y: f.y, z: rnd(10, 40), vx: 0, vy: 0, vz: rnd(6, 16), life: 0.4, size: 2, col: '255,140,60', add: 1, grav: 0 }); }
            if (f.burn.t <= 0) f.burn = null;
        }
        if (f.frozen > 0 || f.silence > 0) continue;   // -ill holds it, -erd shuts it up
        var dx = RT.px - f.x, dy = RT.py - f.y, d = Math.hypot(dx, dy) || 0.001;
        f.face = Math.atan2(dy, dx);
        f.atkT = Math.max(0, f.atkT - dt);
        if (f.def.boss) { stepChorus(f, dt, d); continue; }
        // thieves answer your stacks for you, with the wrong sound
        if (f.steal) {
            f.stealT = (f.stealT || f.steal) - dt;
            if (f.stealT <= 0) {
                f.stealT = f.steal;
                var conceal = RT.conceal > 0;
                var pool = RT.foes.filter(function (q) { return !q.dead && q.stacks.length; });
                if (!conceal && pool.length) {
                    var v = pick(pool), n = v.stacks.length;
                    v.stacks.length = 0;
                    hurtFoe(v, stats().answerBase * 0.4, 'eat', { answer: 1, closed: 0, n: n });
                    typo(v.x, v.y, 'STOLEN', '#c86a6a', 0.7, 11, 'drift');
                    RT.echo = Math.max(0, RT.echo - 8);
                    say('A thief answers your line for you. Wrongly.', 'bad');
                    sfx('steal');
                } else if (conceal) typo(f.x, f.y, '???', FAMS.ark.col, 0.5, 9, 'drift');
            }
        }
        // droners write on themselves so you have to overwrite them
        if (f.drone) {
            f.droneT = (f.droneT || f.drone) - dt;
            if (f.droneT <= 0) {
                f.droneT = f.drone;
                var mine = callFam();
                var other = FAM_IDS.filter(function (x) { return x !== mine; });
                f.stacks.push({ fam: pick(other), t: stats().stackLife, max: stats().stackLife, drone: 1 });
                while (f.stacks.length > stats().stackMax) f.stacks.shift();
            }
        }
        var reach = f.def.r + 0.75;
        if (d > reach) {
            var sx2 = 0, sy2 = 0;                       // shove apart so packs read as a crowd
            for (var k = 0; k < RT.foes.length; k++) {
                var o = RT.foes[k]; if (o === f || o.dead) continue;
                var ox = f.x - o.x, oy = f.y - o.y, od = Math.hypot(ox, oy);
                if (od > 0.01 && od < f.r + o.r + 0.25) { sx2 += ox / od; sy2 += oy / od; }
            }
            var mx = dx / d + sx2 * 0.55, my = dy / d + sy2 * 0.55, ml = Math.hypot(mx, my) || 1;
            f.x = clamp(f.x + mx / ml * f.def.spd * dt, 0.7, pw() - 0.7);
            f.y = clamp(f.y + my / ml * f.def.spd * dt, 0.7, ph() - 0.7);
            f.state = 'walk';
        } else if (f.atkT <= 0 && f.state === 'walk') { f.state = 'tell'; f.tell = f.def.tell; }
        if (f.state === 'tell') {
            f.tell -= dt;
            if (f.tell <= 0) {
                f.state = 'walk'; f.atkT = f.def.atk;
                if (Math.hypot(RT.px - f.x, RT.py - f.y) <= reach + 0.35) hurtPlayer(f.def.dmg, f);
                typo(f.x, f.y, pick(['HA', 'HEARD', 'ALONE', 'SO THEY SAY']), '#c86a6a', 0.4, 9, 'pop');
                sfx('bite');
            }
        }
    }
    // boss voice waves
    for (var p = RT.fproj.length - 1; p >= 0; p--) {
        var pr = RT.fproj[p]; if (!pr) continue;
        pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
        if (Math.hypot(pr.x - RT.px, pr.y - RT.py) < 0.6) { hurtPlayer(pr.dmg); RT.fproj.splice(p, 1); continue; }
        if (pr.life <= 0) RT.fproj.splice(p, 1);
    }
    return alive;
}

/* ─────────────── THE CHORUS ───────────────
   A crowd of voices, no bodies, saying the refrain in unison. It
   strips rhyme off everything on a pulse, so you cannot build
   slowly. You have to burst between pulses, which is the rhythm
   the whole game runs on. */
function stepChorus(f, dt, d) {
    f.pulseT = (f.pulseT || f.pulse) - dt;
    f.warn = f.pulseT < 1.1;
    if (f.pulseT <= 0) {
        f.pulseT = f.pulse;
        RT.rings.push({ x: f.x, y: f.y, r: 0.4, max: 14, col: '210,200,225', t: 0.6, life: 0.6 });
        var stripped = 0;
        RT.foes.forEach(function (q) { if (!q.dead) { stripped += q.stacks.length; q.stacks.length = 0; } });
        slam('AND HE WENT ALONE', '#d2c8e1', 'the refrain strips everything');
        RT.shake = shake(8);
        if (stripped) { RT.echo = Math.max(0, RT.echo - stripped * 2); }
        if (Math.hypot(RT.px - f.x, RT.py - f.y) < 3) hurtPlayer(f.def.dmg);
        sfx('pulse');
    }
    f.spawnT = (f.spawnT || 4) - dt;
    if (f.spawnT <= 0 && RT.foes.length < 16) {
        f.spawnT = 5.5;
        for (var i = 0; i < 3; i++) {
            var a = rnd(0, TAU);
            spawnFoe('mouth', f.x + Math.cos(a) * 3, f.y + Math.sin(a) * 3);
        }
    }
    f.atkT -= 0;
    f.voiceT = (f.voiceT || 1.6) - dt;
    if (f.voiceT <= 0) {
        f.voiceT = f.def.atk;
        var an = Math.atan2(RT.py - f.y, RT.px - f.x);
        for (var j = -1; j <= 1; j++) {
            RT.fproj.push({ x: f.x, y: f.y, vx: Math.cos(an + j * 0.22) * 5.5, vy: Math.sin(an + j * 0.22) * 5.5, life: 2.6, dmg: f.def.dmg });
        }
        sfx('voice');
    }
}

/* ─────────────── death ─────────────── */
function foeDie(f, quiet) {
    if (f.dead) return;
    f.dead = 1; S.kills++;
    var rgb = f.def.boss ? '210,200,225' : '170,160,185';
    burst(f.x, f.y, 14, f.def.boss ? 50 : 16, { col: rgb, sp0: 0.6, sp1: f.def.boss ? 3.6 : 2.4, l0: 0.3, l1: 1, add: 0, grav: 140 });
    typo(f.x, f.y, pick(['—', 'oh', 'ah', 'hm']), '#8a8090', 0.6, 10, 'drift');
    var c = irnd(f.def.coin[0], f.def.coin[1]);
    if (c) coin(c, f.x, f.y);
    if (f.kind === 'sword' && f.callDmg && !f.otherDmg) ach('sword');
    if (f.def.boss) onChorusDown(f);
    if (!quiet) sfx('die');
    if (RT.trial) RT.trial.killed++;
    sSave();
}
function onChorusDown(f) {
    ach('chorus');
    RT.shake = shake(14); RT.flash = 0.5;
    bigLine('the refrain stops', '', '#d2c8e1', 3);
    S.seen.chorusDown = 1; S.heard.refrain = 1; sSave();
    beat(2.2, function () { say('The loft is quiet. The refrain is still going in your head, the way it does after.', 'big'); checkRealisation(); });
}

/* ─────────────── drawing them ───────────────
   Cheap shapes, strong silhouettes. The stacks floating above are
   the important part: they must read at a glance, at speed. */
function drawFoe(cx, f) {
    var sx = isoX(f.x, f.y), sy = isoY(f.x, f.y) + TILE_H / 2;
    var pop = f.spawn > 0 ? 0.5 + (0.45 - f.spawn) : 1;
    var wob = Math.sin(RT.t * 22) * f.wob * 3;
    var tell = f.state === 'tell' ? 0.5 + 0.5 * Math.sin(RT.t * 30) : 0;
    var h = f.def.boss ? 130 : 26 + f.r * 68;
    if (f.state === 'tell' && !f.def.boss) {          // the wind-up ring
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5);
        cx.strokeStyle = 'rgba(255,90,80,' + (0.35 + tell * 0.4) + ')'; cx.lineWidth = 2;
        cx.beginPath(); cx.arc(0, 0, (f.def.r + 0.75) * TILE_W / 2, 0, TAU); cx.stroke(); cx.restore();
    }
    cx.save(); cx.translate(sx, sy - Math.abs(wob) * 0.4); cx.scale(pop, pop);
    cx.fillStyle = 'rgba(0,0,0,.42)'; cx.beginPath(); cx.ellipse(0, 0, f.r * 21, f.r * 8, 0, 0, TAU); cx.fill();
    if (f.def.boss) drawChorus(cx, f, tell);
    else if (f.kind === 'sword') drawSword(cx, f, tell);
    else if (f.kind === 'deaf') drawDeaf(cx, f, tell);
    else if (f.kind === 'droner') drawDroner(cx, f, tell);
    else if (f.kind === 'thief') drawThief(cx, f, tell);
    else drawMouth(cx, f, tell);
    if (f.flash > 0) { cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = f.flash * 3.4; cx.fillStyle = '#fff';
        cx.fillRect(-f.r * 22, -h, f.r * 44, h); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; }
    if (f.frozen > 0) { cx.globalAlpha = 0.45; cx.fillStyle = '#cfeeff'; cx.fillRect(-f.r * 22, -h, f.r * 44, h); cx.globalAlpha = 1; }
    cx.restore();
    // health, only once it matters
    if (f.hp < f.hpm) {
        var w = f.def.boss ? 0 : f.r * 60;
        if (w) {
            cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(sx - w / 2, sy - h - 10, w, 3.5);
            cx.fillStyle = f.revealed > 0 ? FAMS.ight.col : '#c9484a';
            cx.fillRect(sx - w / 2, sy - h - 10, w * clamp(f.hp / f.hpm, 0, 1), 3.5);
        }
    }
    drawStacks(cx, f, sx, sy - h - 18 - (f.so || 0));
    if (RT.dbgAI) {
        cx.font = '9px monospace'; cx.fillStyle = '#9fe0c8'; cx.textAlign = 'center';
        cx.fillText(f.state + (f.frozen > 0 ? ' FRZ' : '') + (f.silence > 0 ? ' SIL' : ''), sx, sy + 12); cx.textAlign = 'left';
    }
    if (RT.dbgHit) {
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5); cx.strokeStyle = 'rgba(0,255,180,.5)';
        cx.beginPath(); cx.arc(0, 0, f.r * TILE_W / 2, 0, TAU); cx.stroke(); cx.restore();
    }
}
/* the rhyme stacks: small glowing syllables, in a row, above the
   thing they are stuck to. legible at speed is the only rule. */
function drawStacks(cx, f, sx, sy) {
    if (!f.stacks.length) return;
    // one dark plate behind the whole row so overlapping packs never
    // smear into each other. these must read at a glance, at speed.
    var n = f.stacks.length, w = 13, plateW = n * w + 8;
    cx.save(); cx.textAlign = 'center';
    cx.fillStyle = 'rgba(8,6,12,.72)';
    cx.fillRect(sx - plateW / 2, sy - 11, plateW, 16);
    cx.font = 'bold 8px "Press Start 2P", monospace';
    for (var i = 0; i < n; i++) {
        var s = f.stacks[i], fam = FAMS[s.fam];
        var x = sx + (i - (n - 1) / 2) * w;
        var fade = clamp(s.t / 1.2, 0.3, 1);                  // it visibly runs out of time
        cx.globalAlpha = fade;
        cx.globalCompositeOperation = 'lighter';
        cx.fillStyle = 'rgba(' + hex2rgb(fam.col) + ',.3)';
        cx.fillRect(x - w / 2 + 1, sy - 10, w - 2, 14);
        cx.globalCompositeOperation = 'source-over';
        cx.fillStyle = s.drone ? '#8a8090' : fam.glow;
        cx.fillText(fam.tag.slice(0, 3), x, sy);
    }
    cx.globalAlpha = 1;
    if (RT.dbgStacks) {
        cx.font = '9px monospace'; cx.fillStyle = '#ffe66e';
        cx.fillText(n + '×', sx, sy - 14);
    }
    cx.restore(); cx.textAlign = 'left';
}
function drawMouth(cx, f, tell) {
    var w = f.r * 46, h = f.r * 64;
    cx.fillStyle = '#7d7086'; cx.beginPath(); cx.ellipse(0, -h * 0.62, w, h * 0.56, 0, 0, TAU); cx.fill();
    cx.fillStyle = '#5b5165'; cx.beginPath(); cx.ellipse(0, -h * 0.62, w, h * 0.56, 0, 0.15, Math.PI - 0.15); cx.fill();
    var gape = 0.4 + tell * 0.55 + Math.sin(f.anim * 7) * 0.16;
    cx.fillStyle = '#120c17'; cx.beginPath(); cx.ellipse(0, -h * 0.6, w * 0.68, h * 0.4 * gape, 0, 0, TAU); cx.fill();
    cx.fillStyle = '#efe9f4';                                   // applause with teeth
    var ty = h * 0.4 * gape;
    for (var i = -2; i <= 2; i++) { cx.fillRect(i * 6 - 2, -h * 0.6 - ty, 4, 4.5); cx.fillRect(i * 6 - 2, -h * 0.6 + ty - 4.5, 4, 4.5); }
}
function drawThief(cx, f, tell) {
    var w = f.r * 40, h = f.r * 74;
    cx.fillStyle = '#463a5e'; cx.beginPath();
    cx.moveTo(-w, 0); cx.lineTo(-w * 0.55, -h); cx.lineTo(w * 0.55, -h); cx.lineTo(w, 0); cx.closePath(); cx.fill();
    cx.fillStyle = '#2a2338'; cx.beginPath(); cx.arc(0, -h, w * 0.6, 0, TAU); cx.fill();
    cx.fillStyle = tell > 0.3 ? '#ffd06a' : '#c86a6a'; cx.fillRect(-4, -h - 1, 8, 2);
    cx.fillStyle = '#3d3350'; cx.fillRect(w * 0.5, -h * 0.6, w * 0.7, 3);   // a hand out, always reaching
}
function drawDroner(cx, f, tell) {
    var w = f.r * 42, h = f.r * 66;
    cx.fillStyle = '#584a36'; cx.beginPath();
    cx.moveTo(-w * 0.4, 0); cx.lineTo(-w, -h); cx.lineTo(w, -h); cx.lineTo(w * 0.4, 0); cx.closePath(); cx.fill();
    cx.fillStyle = '#c9a94a'; cx.beginPath(); cx.ellipse(0, -h, w, 4, 0, 0, TAU); cx.fill();
    cx.globalCompositeOperation = 'lighter';
    cx.fillStyle = 'rgba(200,170,90,' + (0.2 + Math.abs(Math.sin(f.anim * 4)) * 0.3) + ')';
    cx.beginPath(); cx.ellipse(0, -h, w * 1.5, 8, 0, 0, TAU); cx.fill();
    cx.globalCompositeOperation = 'source-over';
}
function drawDeaf(cx, f, tell) {
    var w = f.r * 40, h = f.r * 70;
    cx.fillStyle = '#585862'; cx.fillRect(-w, -h, w * 2, h);
    cx.fillStyle = '#5c5c66'; cx.fillRect(-w, -h, w * 2, h * 0.24);
    cx.fillStyle = '#1a1a20'; cx.fillRect(-w * 0.6, -h * 0.62, w * 1.2, 4);   // no ears, a sealed face
    if (tell > 0.3) { cx.fillStyle = 'rgba(255,120,90,' + tell + ')'; cx.fillRect(-w, -h - 4, w * 2, 3); }
}
function drawSword(cx, f, tell) {
    var w = f.r * 38, h = f.r * 76;
    cx.fillStyle = '#6a5745'; cx.fillRect(-w * 0.7, -h, w * 1.4, h);
    cx.fillStyle = '#7a6a52'; cx.fillRect(-w * 0.7, -h, w * 1.4, 5);
    cx.save(); cx.translate(w * 0.8, -h * 0.7); cx.rotate(tell > 0.3 ? -0.9 : -0.2);
    cx.fillStyle = '#b9b2c4'; cx.fillRect(0, -2.5, 26, 5);                 // the prop itself
    cx.fillStyle = '#c9a94a'; cx.fillRect(-3, -6, 4, 12); cx.restore();
    cx.fillStyle = '#8a8090'; cx.font = 'bold 8px "Press Start 2P", monospace'; cx.textAlign = 'center';
    cx.fillText('NO RHYME', 0, -h - 8); cx.textAlign = 'left';
}
function drawChorus(cx, f, tell) {
    var w = 92, h = 118;
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    cx.fillStyle = 'rgba(150,140,180,' + (0.05 + (f.warn ? 0.12 : 0)) + ')';
    cx.beginPath(); cx.ellipse(0, -h * 0.5, w * 1.5, h * 0.7, 0, 0, TAU); cx.fill();
    cx.globalCompositeOperation = 'source-over';
    // a crowd of mouths, no bodies
    for (var i = 0; i < 22; i++) {
        var a = i / 22 * TAU + f.anim * 0.25, rr = 26 + (i % 4) * 17;
        var mx = Math.cos(a) * rr, my = -h * 0.55 + Math.sin(a) * rr * 0.55;
        var g = 0.4 + Math.abs(Math.sin(f.anim * 6 + i)) * (f.warn ? 0.7 : 0.35);
        cx.fillStyle = '#6a5f72'; cx.beginPath(); cx.ellipse(mx, my, 9, 6.5, 0, 0, TAU); cx.fill();
        cx.fillStyle = '#120d18'; cx.beginPath(); cx.ellipse(mx, my, 6, 4.4 * g, 0, 0, TAU); cx.fill();
    }
    if (f.warn) {
        cx.fillStyle = 'rgba(255,220,120,' + (0.5 + Math.sin(RT.t * 24) * 0.4) + ')';
        cx.font = 'bold 12px "Press Start 2P", monospace'; cx.textAlign = 'center';
        cx.fillText('IN UNISON', 0, -h - 16); cx.textAlign = 'left';
    }
    cx.restore();
}

/* ─────────────── loop ─────────────── */
function frame(now) {
    if (!RT) return;
    var real = Math.min(0.05, (now - RT.last) / 1000);
    RT.last = now;
    RT._fc++; RT._ft += real;
    if (RT._ft >= 0.5) { RT.fps = Math.round(RT._fc / RT._ft); RT._fc = 0; RT._ft = 0; }
    // time thickens while a stanza writes itself
    var scale = RT.timeScale * (RT.dilate > 0 ? T('dilation') : 1);
    step(real * scale, real);
    draw();
    RT.raf = requestAnimationFrame(frame);
}
function step(dt, real) {
    RT.t += dt;
    RT.dilate = Math.max(0, RT.dilate - (real || dt));      // dilation runs on real time
    RT.mono = Math.max(0, RT.mono - (real || dt));
    RT.callCd = Math.max(0, (RT.callCd || 0) - dt);
    RT.answerCd = Math.max(0, (RT.answerCd || 0) - dt);
    RT.conceal = Math.max(0, (RT.conceal || 0) - dt);
    if (RT.dead) {
        RT.deadT -= (real || dt);
        stepParts(dt);
        if (RT.deadT <= 0) revive();
    } else {
        stepPlayer(dt);
        stepCalls(dt);
        stepStacks(dt);
        stepFoes(dt);
        stepParts(dt);
        stepRecital(real || dt);
        stepScene(dt);
    }
    RT.shake = Math.max(0, RT.shake - dt * 24);
    RT.chroma = Math.max(0, RT.chroma - dt * 2.4);
    RT.flash = Math.max(0, RT.flash - dt * 2.2);
    for (var i = RT.toasts.length - 1; i >= 0; i--) { RT.toasts[i].t -= (real || dt); if (RT.toasts[i].t <= 0) RT.toasts.splice(i, 1); }
    RT.hudT = (RT.hudT || 0) - (real || dt);
    if (RT.hudT <= 0) { RT.hudT = 0.05; updateHud(0.05); }
}
function draw() {
    var cx = RT.cx, dt = 1 / 60;
    cx.save();
    if (S.opts.shake && RT.shake > 0.2) cx.translate(rnd(-RT.shake, RT.shake) * 0.5, rnd(-RT.shake, RT.shake) * 0.35);
    cx.clearRect(-30, -30, VW + 60, VH + 60);
    cx.drawImage(buildFloor(place().floor, pw(), ph()), 0, 0);
    // during a recital the world drains away until the letters are the only light
    if (RT.dilate > 0) {
        cx.fillStyle = 'rgba(6,4,10,' + (0.55 * clamp(RT.dilate / T('dilationT'), 0, 1)).toFixed(3) + ')';
        cx.fillRect(0, 0, VW, VH);
    }
    drawExits(cx);
    drawLooks(cx);
    drawRings(cx, dt);
    drawProps(cx, 'back');
    if (RT.moveTo && !S.opts.wasd) {
        var mx = isoX(RT.moveTo.x, RT.moveTo.y), my = isoY(RT.moveTo.x, RT.moveTo.y) + TILE_H / 2;
        cx.save(); cx.translate(mx, my); cx.scale(1, 0.5);
        cx.strokeStyle = 'rgba(200,190,220,.4)'; cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(0, 0, 7 + Math.sin(RT.t * 8) * 2, 0, TAU); cx.stroke(); cx.restore();
    }
    // painter-sorted world
    var ents = [];
    RT.foes.forEach(function (f) { if (!f.dead) ents.push({ k: f.x + f.y, fn: function () { drawFoe(cx, f); } }); });
    (place().npcs || []).forEach(function (id) { var n = NPCS[id]; if (n) ents.push({ k: n.x + n.y, fn: function () { drawNpc(cx, n); } }); });
    ents.push({ k: RT.px + RT.py, fn: function () { drawActor(cx); } });
    ents.sort(function (a, b) { return a.k - b.k; });
    ents.forEach(function (e) { e.fn(); });
    drawProps(cx, 'front');
    drawCalls(cx);
    drawFproj(cx);
    drawParts(cx);
    drawSnaps(cx, dt);
    drawTypo(cx, dt);
    if (RT.flash > 0) { cx.fillStyle = 'rgba(255,250,235,' + (RT.flash * 0.5) + ')'; cx.fillRect(0, 0, VW, VH); }
    if (RT.hurt > 0 || RT.dead) { cx.fillStyle = 'rgba(150,10,25,' + (RT.dead ? 0.34 : RT.hurt * 0.3) + ')'; cx.fillRect(0, 0, VW, VH); }
    drawPrompt(cx);
    cx.restore();
    drawSlams(cx, dt);
    drawLines(cx, dt);
    drawBossBar(cx);
    drawToasts(cx);
    drawMap(cx);
    if (RT.dbgPerf) {
        cx.font = '11px monospace'; cx.fillStyle = '#9fe0c8';
        cx.fillText(RT.fps + ' fps · foes ' + RT.foes.length + ' · parts ' + RT.parts.length + ' · typo ' + RT.typo.length + ' · calls ' + RT.calls.length, 12, VH - 12);
    }
    if (RT.dead) {
        cx.textAlign = 'center';
        cx.font = '34px "Press Start 2P", monospace'; cx.fillStyle = '#ff5a6a';
        cx.fillText('FROM THE TOP', VW / 2, VH / 2);
        cx.textAlign = 'left';
    }
}
/* the call is the word. it flies, and you can read it. */
function drawCalls(cx) {
    for (var i = 0; i < RT.calls.length; i++) {
        var c = RT.calls[i];
        var sx = isoX(c.x, c.y), sy = isoY(c.x, c.y) + TILE_H / 2 - 26;
        var col = FAMS[c.fam].col;
        cx.save(); cx.textAlign = 'center';
        cx.globalCompositeOperation = 'lighter';
        cx.fillStyle = 'rgba(' + hex2rgb(col) + ',.28)';
        cx.beginPath(); cx.arc(sx, sy - 4, 12, 0, TAU); cx.fill();
        cx.globalCompositeOperation = 'source-over';
        cx.font = 'bold 12px "Press Start 2P", monospace';
        cx.fillStyle = '#08060c'; cx.fillText(c.word, sx + 1.5, sy + 1.5);
        cx.fillStyle = col; cx.fillText(c.word, sx, sy);
        cx.restore(); cx.textAlign = 'left';
    }
}
function drawFproj(cx) {
    for (var i = 0; i < RT.fproj.length; i++) {
        var p = RT.fproj[i], sx = isoX(p.x, p.y), sy = isoY(p.x, p.y) + TILE_H / 2 - 24;
        cx.save(); cx.globalCompositeOperation = 'lighter';
        var g = cx.createRadialGradient(sx, sy, 1, sx, sy, 9);
        g.addColorStop(0, 'rgba(235,225,250,.9)'); g.addColorStop(1, 'rgba(150,140,190,0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(sx, sy, 9, 0, TAU); cx.fill(); cx.restore();
    }
}
function drawBossBar(cx) {
    var b = null; RT.foes.forEach(function (f) { if (f.def.boss && !f.dead) b = f; });
    if (!b) return;
    var w = 520, x = (VW - w) / 2, y = 26;
    cx.fillStyle = 'rgba(8,6,14,.8)'; cx.fillRect(x - 3, y - 3, w + 6, 20);
    cx.fillStyle = '#1a1520'; cx.fillRect(x, y, w, 14);
    cx.fillStyle = '#8f86a8'; cx.fillRect(x, y, w * clamp(b.hp / b.hpm, 0, 1), 14);
    cx.textAlign = 'center'; cx.font = '11px "Press Start 2P", monospace';
    cx.fillStyle = '#e8e2ee'; cx.fillText(b.def.n, VW / 2, y - 8);
    if (b.warn) { cx.fillStyle = '#ffd06a'; cx.font = '9px "Press Start 2P", monospace'; cx.fillText('PULSE INCOMING — SPEND YOUR STACKS', VW / 2, y + 30); }
    cx.textAlign = 'left';
}
function drawToasts(cx) {
    for (var i = 0; i < RT.toasts.length; i++) {
        var a = RT.toasts[i], y = 70 + i * 42;
        var k = clamp(Math.min(a.t, 3.4 - a.t) / 0.35, 0, 1);
        cx.save(); cx.globalAlpha = k;
        cx.fillStyle = 'rgba(10,8,16,.92)'; cx.fillRect(VW - 288, y, 268, 36);
        cx.fillStyle = '#c9a94a'; cx.fillRect(VW - 288, y, 3, 36);
        cx.font = '12px "Pixelify Sans"'; cx.fillStyle = '#ffe66e'; cx.fillText('★ ' + a.n, VW - 276, y + 15);
        cx.font = '10px "Pixelify Sans"'; cx.fillStyle = '#9a93a8'; cx.fillText(a.d.slice(0, 42), VW - 276, y + 28);
        cx.restore();
    }
}

/* ─────────────── sound ───────────────
   Small, dry, close. Voices and paper, not synths pretending to
   be an orchestra. */
function sfx(kind) {
    if (!S.opts.sound || !RT) return;
    try {
        if (!RT.ac) RT.ac = new (window.AudioContext || window.webkitAudioContext)();
        if (RT.ac.state === 'suspended') RT.ac.resume();
        if (RT.ac.state !== 'running') return;
        var ac = RT.ac, t0 = ac.currentTime;
        function tone(type, f0, f1, dur, vol, delay) {
            var o = ac.createOscillator(), g = ac.createGain();
            o.type = type; o.frequency.setValueAtTime(f0, t0 + (delay || 0));
            o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + (delay || 0) + dur);
            g.gain.setValueAtTime(vol, t0 + (delay || 0));
            g.gain.exponentialRampToValueAtTime(0.0005, t0 + (delay || 0) + dur);
            o.connect(g); g.connect(ac.destination); o.start(t0 + (delay || 0)); o.stop(t0 + (delay || 0) + dur + 0.03);
        }
        function noise(dur, vol, delay) {
            var len = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
            for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
            var src = ac.createBufferSource(), g = ac.createGain();
            src.buffer = buf; g.gain.value = vol; src.connect(g); g.connect(ac.destination); src.start(t0 + (delay || 0));
        }
        if (kind === 'call') { tone('square', 420, 300, 0.07, 0.035); }
        else if (kind === 'hit') { noise(0.05, 0.045); tone('triangle', 200, 120, 0.07, 0.04); }
        else if (kind === 'answer') { tone('sawtooth', 180, 70, 0.32, 0.075); noise(0.18, 0.06); tone('square', 90, 60, 0.4, 0.05, 0.02); }
        else if (kind === 'slant') { tone('square', 150, 130, 0.22, 0.05); noise(0.08, 0.03); }
        else if (kind === 'empty') { tone('sine', 260, 240, 0.12, 0.02); }
        else if (kind === 'winded') { noise(0.35, 0.07); tone('sine', 150, 60, 0.5, 0.05); }
        else if (kind === 'stanza') { [330, 392, 494].forEach(function (f, i) { tone('triangle', f, f, 0.5, 0.045, i * 0.05); }); }
        else if (kind === 'wave') { tone('sine', 300, 120, 0.25, 0.05); noise(0.12, 0.04); }
        else if (kind === 'wave2') { tone('sine', 200, 60, 0.5, 0.09); noise(0.3, 0.08); }
        else if (kind === 'verse') { [262, 330, 392, 523].forEach(function (f, i) { tone('triangle', f, f, 1.2, 0.05, i * 0.12); }); }
        else if (kind === 'pulse') { tone('sawtooth', 120, 55, 0.6, 0.09); noise(0.4, 0.07); }
        else if (kind === 'voice') { tone('square', 300, 200, 0.2, 0.04); }
        else if (kind === 'bite') { noise(0.07, 0.05); tone('square', 260, 140, 0.09, 0.04); }
        else if (kind === 'steal') { tone('sawtooth', 500, 180, 0.2, 0.05); }
        else if (kind === 'die') { noise(0.16, 0.05); tone('triangle', 180, 70, 0.24, 0.05); }
        else if (kind === 'hurt') { noise(0.1, 0.07); tone('sawtooth', 170, 80, 0.14, 0.05); }
        else if (kind === 'down') { noise(0.4, 0.09); tone('sine', 130, 45, 0.7, 0.08); }
        else if (kind === 'step') { noise(0.05, 0.025); }
        else if (kind === 'coin') { tone('square', 700, 1000, 0.08, 0.03); }
        else if (kind === 'ui') { tone('square', 520, 620, 0.05, 0.025); }
    } catch (e) {}
}

/* ─────────────── HUD ─────────────── */
function updateHud(dt) {
    if (!RT) return;
    var st = stats(), r = RT.root;
    var bf = clamp(RT.breath / st.breathMax, 0, 1);
    var br = r.querySelector('.nn-breath');
    br.querySelector('i').style.width = (bf * 100) + '%';
    br.classList.toggle('winded', RT.winded > 0);
    br.classList.toggle('ramp', RT.silence >= st.rampAfter && RT.winded <= 0 && bf < 1);
    br.querySelector('.nn-breath-t').textContent = RT.winded > 0 ? 'WINDED' : Math.ceil(RT.breath) + ' / ' + st.breathMax;
    r.querySelector('.nn-echo i').style.width = clamp(RT.echo / T('echoMax') * 100, 0, 100) + '%';
    // the two slotted words are the entire build
    var cw = r.querySelector('.nn-call'), aw = r.querySelector('.nn-answer');
    var cf = FAMS[callFam()], af = FAMS[answerFam()];
    if (cw._w !== S.call) { cw._w = S.call; cw.querySelector('b').textContent = S.call.toUpperCase(); cw.querySelector('b').style.color = cf.col; cw.querySelector('em').textContent = cf.n + ' · ' + cf.el; cw.style.borderColor = cf.col; }
    if (aw._w !== S.answer) { aw._w = S.answer; aw.querySelector('b').textContent = S.answer.toUpperCase(); aw.querySelector('b').style.color = af.col; aw.querySelector('em').textContent = af.n + ' · ' + af.el; aw.style.borderColor = af.col; }
    aw.classList.toggle('slant', callFam() !== answerFam());
    // stanzas
    for (var i = 0; i < 3; i++) {
        var b = r.querySelectorAll('.nn-st')[i];
        var have = !!S.stanzas[i + 1], cd = RT.stanzaCd[i];
        b.classList.toggle('locked', !have);
        b.classList.toggle('cool', cd > 0);
        b.style.setProperty('--cd', have && cd > 0 ? (100 - cd / STANZAS[i].cd * 100) + '%' : '100%');
    }
    var vs = r.querySelector('.nn-verse');
    vs.classList.toggle('lit', !!S.verse);
    vs.disabled = !S.verse;
    var cn = r.querySelector('.nn-coin-n'); if (cn.textContent !== String(S.coin)) cn.textContent = S.coin;
    var sn = r.querySelector('.nn-scene-n');
    if (sn._s !== RT.place) { sn._s = RT.place; sn.textContent = place().n; r.querySelector('.nn-scene-s').textContent = place().sub || ''; }
}
function hudNudge(what) {
    if (!RT) return;
    var el = what === 'breath' ? RT.root.querySelector('.nn-breath')
        : what === 'verse' ? RT.root.querySelector('.nn-verse')
        : RT.root.querySelector('.nn-st:nth-child(' + (parseInt(what.slice(6), 10) || 1) + ')');
    if (!el) return;
    el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny');
}

/* ─────────────── panels ─────────────── */
function panel(name) {
    var open = RT.panel === name ? null : name;
    RT.panel = open;
    ['book', 'kit', 'shop'].forEach(function (p) { RT.root.querySelector('.nn-p-' + p).hidden = open !== p; });
    if (open === 'book') fillBook();
    else if (open === 'kit') fillKit();
    else if (open === 'shop') fillShop();
    sfx('ui');
}
/* THE PLAY — the ballad as you currently know it. Full lines are
   allowed here because nothing is trying to kill you. */
function fillBook() {
    var b = RT.root.querySelector('.nn-p-book .nn-pb');
    var html = '<p class="nn-note">The play, as Wick performs it. Learning a line is learning a spell. Something in it does not rhyme.</p>';
    BALLAD.forEach(function (st, i) {
        var known = S.frags[1] && i === 2 || S.frags[2] && i === 3 || S.frags[3] && i === 6;
        var lines = known ? st.r : st.t;
        html += '<div class="nn-stanza' + (known ? ' fixed' : '') + '"><b>' + (i + 1) + '</b><div>' +
            lines.map(function (l, j) {
                var isBreak = st.brk && j === 3 && !known;
                return '<i class="' + (isBreak ? 'nn-broken' : '') + '">' + esc(l) + (isBreak ? ' <s>?</s>' : '') + '</i>';
            }).join('') + '</div></div>';
    });
    html += '<p class="nn-note dim">Every closing line runs six to eight syllables. "And he went alone" is five. Something was taken out and you can hear the hole.</p>';
    b.innerHTML = html;
}
/* WORDS AND CHARMS — the build layer. One call word, one answer
   word, two charms. That is the whole thing. */
function fillKit() {
    var b = RT.root.querySelector('.nn-p-kit .nn-pb');
    var html = '<p class="nn-note">Slot one word to <b>Call</b> and one to <b>Answer</b>. Matching families close the couplet. Mismatched is a slant: it still works, it just falls flat.</p>';
    FAM_IDS.forEach(function (fid) {
        var fam = FAMS[fid], have = famOwned(fid);
        html += '<div class="nn-fam' + (have ? '' : ' locked') + '"><header style="color:' + fam.col + '">' + fam.n +
            '<i>' + fam.d + '</i>' + (have ? '' : '<em>' + fam.from + '</em>') + '</header><div class="nn-wordrow">';
        fam.words.forEach(function (w) {
            var own = !!S.owned[w];
            html += '<span class="nn-wchip' + (own ? '' : ' dim') + (S.call === w ? ' iscall' : '') + (S.answer === w ? ' isans' : '') + '" data-w="' + w + '">' +
                esc(w.toUpperCase()) + (own ? '<i data-slot="call:' + w + '">call</i><i data-slot="answer:' + w + '">answer</i>' : '<i class="nn-lock">not learned</i>') + '</span>';
        });
        html += '</div></div>';
    });
    html += '<h4>CHARMS <i>· wear two</i></h4><div class="nn-charms">';
    CHARM_IDS.forEach(function (id) {
        if (!S.charms[id]) return;
        var c = CHARMS[id], worn = S.worn.indexOf(id) >= 0;
        html += '<button class="nn-charm' + (worn ? ' worn' : '') + '" data-charm="' + id + '"><b>' + esc(c.n) + '</b><i>' + esc(c.d) + '</i></button>';
    });
    html += '</div>';
    b.innerHTML = html;
    b.querySelectorAll('[data-slot]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.stopPropagation();
            var a = el.getAttribute('data-slot').split(':');
            if (a[0] === 'call') S.call = a[1]; else S.answer = a[1];
            sSave(); fillKit(); updateHud(0); sfx('ui'); RT.root.focus();
        });
    });
    b.querySelectorAll('[data-charm]').forEach(function (el) {
        el.addEventListener('click', function () { wearCharm(el.getAttribute('data-charm')); fillKit(); sfx('ui'); RT.root.focus(); });
    });
}
/* THE CHANDLER — the economy the design doc told me to cut */
function fillShop() {
    var b = RT.root.querySelector('.nn-p-shop .nn-pb');
    RT.root.querySelector('.nn-shop-coin').textContent = '◦ ' + S.coin;
    var html = '<p class="nn-note">He sells wax, wick and small objects out of other people\'s attics. He does not ask what you want them for.</p>';
    CHARM_IDS.forEach(function (id) {
        var c = CHARMS[id], owned = !!S.charms[id];
        if (owned && !c.sell) return;
        html += '<div class="nn-buy"><div><b>' + esc(c.n) + '</b><i>' + esc(c.d) + '</i></div>' +
            (owned ? '<button class="nn-mini" data-sell="' + id + '">sell ◦' + c.sell + '</button>'
                   : '<button class="nn-mini' + (S.coin < c.cost ? ' poor' : '') + '" data-buy="' + id + '">◦' + c.cost + '</button>') + '</div>';
    });
    var forSale = ['street', 'wheat', 'night', 'right'];
    html += '<h4>WORDS <i>· he found them written on things</i></h4>';
    forSale.forEach(function (w) {
        if (S.owned[w] || !famOwned(WORDS[w])) return;
        html += '<div class="nn-buy"><div><b style="color:' + FAMS[WORDS[w]].col + '">' + w.toUpperCase() + '</b><i>' + FAMS[WORDS[w]].n + ' · ' + FAMS[WORDS[w]].d + '</i></div>' +
            '<button class="nn-mini' + (S.coin < 30 ? ' poor' : '') + '" data-word="' + w + '">◦30</button></div>';
    });
    b.innerHTML = html;
    b.querySelectorAll('[data-buy]').forEach(function (el) { el.addEventListener('click', function () { if (buyCharm(el.getAttribute('data-buy'))) { sfx('coin'); fillShop(); } }); });
    b.querySelectorAll('[data-sell]').forEach(function (el) { el.addEventListener('click', function () { if (sellCharm(el.getAttribute('data-sell'))) { sfx('coin'); fillShop(); } }); });
    b.querySelectorAll('[data-word]').forEach(function (el) {
        el.addEventListener('click', function () {
            var w = el.getAttribute('data-word');
            if (S.coin < 30) { say('Not enough coin.', 'dim'); return; }
            S.coin -= 30; learnWord(w); sfx('coin'); fillShop();
        });
    });
}

/* ═══════════════ DEV MENU ═══════════════
   The ask: test any aspect, jump anywhere, and grow with the
   game. Every control is one line in the DEV table above. */
function toggleDev() {
    RT.devOpen = !RT.devOpen;
    RT.root.querySelector('.nn-dev').hidden = !RT.devOpen;
    if (RT.devOpen) fillDev();
    RT.root.focus();
}
function fillDev() {
    var d = RT.root.querySelector('.nn-dev');
    var tabs = d.querySelector('.nn-dev-tabs'), body = d.querySelector('.nn-dev-body');
    tabs.innerHTML = DEV.map(function (s) {
        return '<button class="nn-dtab' + (RT.devTab === s.tab ? ' on' : '') + '" data-dtab="' + s.tab + '">' + s.tab + '</button>';
    }).join('');
    var sec = DEV.filter(function (s) { return s.tab === RT.devTab; })[0] || DEV[0];
    var rows = sec.rows();
    body.innerHTML = rows.map(function (r, i) {
        if (r.k === 'note') return '<p class="nn-dnote">' + esc(r.t) + '</p>';
        if (r.k === 'btn') return '<button class="nn-drow nn-dbtn' + (r.danger ? ' danger' : '') + '" data-di="' + i + '"><b>' + esc(r.t) + '</b>' + (r.sub ? '<i>' + esc(r.sub) + '</i>' : '') + '</button>';
        if (r.k === 'tgl') return '<div class="nn-drow"><span>' + esc(r.t) + '</span><button class="nn-mini' + (r.get() ? ' on' : '') + '" data-di="' + i + '">' + (r.get() ? 'ON' : 'OFF') + '</button></div>';
        if (r.k === 'num') {
            var v = r.get();
            return '<div class="nn-drow"><span>' + esc(r.t) + '</span><span class="nn-dnum">' +
                '<button class="nn-mini" data-di="' + i + '" data-dd="-1">−</button><b>' + (r.fix ? (+v).toFixed(r.fix) : v) + '</b>' +
                '<button class="nn-mini" data-di="' + i + '" data-dd="1">+</button></span></div>';
        }
        return '';
    }).join('');
    tabs.querySelectorAll('[data-dtab]').forEach(function (b) {
        b.addEventListener('click', function () { RT.devTab = b.getAttribute('data-dtab'); fillDev(); RT.root.focus(); });
    });
    body.querySelectorAll('[data-di]').forEach(function (b) {
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            var r = rows[+b.getAttribute('data-di')];
            if (!r) return;
            if (r.k === 'btn') r.on();
            else if (r.k === 'tgl') r.set(!r.get());
            else if (r.k === 'num') r.set(+(r.get() + (r.step || 1) * (+b.getAttribute('data-dd'))).toFixed(4));
            sSave(); fillDev(); updateHud(0); sfx('ui'); RT.root.focus();
        });
    });
    d.querySelector('.nn-dev-foot').textContent = 'scene ' + RT.scene + ' · foes ' + RT.foes.filter(function (f) { return !f.dead; }).length +
        ' · breath ' + Math.round(RT.breath) + ' · echo ' + Math.round(RT.echo) + ' · coin ' + S.coin + ' · ` to close';
}

function wireHud(root) {
    root.querySelectorAll('[data-nn]').forEach(function (b) {
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            var a = b.getAttribute('data-nn');
            if (a === 'dev') toggleDev();
            else if (a.indexOf('p:') === 0) panel(a.slice(2));
            else if (a.indexOf('slot:') === 0) panel('kit');
            else if (a.indexOf('stanza:') === 0) doStanza(+a.slice(7));
            else if (a === 'verse') doVerse();
            root.focus();
        });
    });
    root.querySelectorAll('.nn-panel .nn-x, .nn-dev .nn-x').forEach(function (x) {
        x.addEventListener('click', function (e) {
            e.stopPropagation();
            if (x.closest('.nn-dev')) toggleDev(); else panel(null);
            root.focus();
        });
    });
}

/* ═══════════════ THE WORLD ═══════════════
   The play is the setting. The game is walking out of it.

   Places have edges, solid things in them, exits you walk to, and
   people who will talk to you. Fighting is NOT the content: it is
   what happens when you say the lines out loud somewhere the lie
   does not want to be said. Most of this world you can cross
   without casting once. */

/* solid props. b = [x, y, w, h] footprint in tiles. */
var PLACES = {
    stage: {
        n: 'The Ninth Night play', sub: 'twelve years ago, and the mask is too big',
        floor: 'stage', calm: 1, script: 'prologue', w: 13, h: 11,
        props: [
            { t: 'curtain', b: [0, 0, 13, 1.4] },
            { t: 'crate', b: [1, 8.4, 1.6, 1.2] }, { t: 'crate', b: [10, 8.6, 1.6, 1.2] },
            { t: 'foot', b: [0, 9.9, 13, 0.5] }
        ],
        exits: []
    },
    square: {
        n: 'Wick — the square', sub: 'they have given you the crown and the lantern',
        floor: 'town', calm: 1, script: 'wick', w: 17, h: 15,
        props: [
            { t: 'house', b: [0, 0, 4, 3.4] }, { t: 'house', b: [5.2, 0, 3.6, 2.8] }, { t: 'house', b: [13, 0, 4, 3.6] },
            { t: 'house', b: [0, 11.6, 4.2, 3.4] }, { t: 'house', b: [13.4, 11, 3.6, 4] },
            { t: 'stagewip', b: [6.4, 3.6, 4.6, 2.6] },
            { t: 'well', b: [8, 9.4, 1.6, 1.6] },
            { t: 'cart', b: [3.4, 8.2, 2.2, 1.2] }
        ],
        npcs: ['bern', 'child', 'widow'],
        looks: [
            { x: 12.4, y: 8.2, n: 'A lamp on a sill', d: 'Set out on the ninth night for the man who walked out past the fence. Every house on the square has one. Nobody has ever set out a second.' },
            { x: 7.2, y: 6.6, n: 'The playbill', d: 'THE NINTH NIGHT. A true account. The same four hundredth time.\n\nUnder the cast list somebody has pencilled your name, and then gone over it twice, harder.' }
        ],
        exits: [{ x: 8.5, y: 14.3, w: 3, to: 'lane', n: 'the lane, north' }]
    },
    lane: {
        n: 'The lane out of Wick', sub: 'in the play it is a day\'s walk',
        floor: 'mill', w: 13, h: 17,
        props: [
            { t: 'fence', b: [0.6, 4, 0.5, 9] }, { t: 'fence', b: [11.6, 3, 0.5, 10] },
            { t: 'tree', b: [2.2, 6.4, 1.4, 1.4] }, { t: 'tree', b: [9.4, 10.2, 1.4, 1.4] },
            { t: 'stone', b: [4.6, 12.6, 1, 1] }
        ],
        npcs: ['shepherd'],
        looks: [{ x: 5.2, y: 12.4, n: 'A milestone', d: 'WICK — 1/4 MILE.\n\nIn the play he walks out past the mill and the well and the mark, and it takes him all night. It is four hundred yards. You can see both ends of it from here.' }],
        exits: [
            { x: 6.2, y: 16.3, w: 3, to: 'square', n: 'back to Wick' },
            { x: 6.2, y: 0.7, w: 3, to: 'mill', n: 'the mill' },
            { x: 12.3, y: 8, h: 3, to: 'village', n: 'the next village, east' }
        ],
        speakDraws: 2      // say a line out loud here and something answers
    },
    mill: {
        n: 'The mill', sub: 'rehearse where nobody can hear you, because you are bad',
        floor: 'mill', w: 15, h: 13,
        props: [
            { t: 'mill', b: [5.4, 0.6, 5, 4.4] },
            { t: 'wheel', b: [10.8, 1.6, 1.2, 3.2] },
            { t: 'sack', b: [3, 6.4, 1.2, 1 ] }, { t: 'sack', b: [4.4, 6.8, 1.2, 1] }, { t: 'sack', b: [3.6, 8, 1.2, 1] },
            { t: 'fence', b: [0.6, 2, 0.5, 8] }, { t: 'fence', b: [13.9, 2, 0.5, 8] }
        ],
        looks: [{ x: 8, y: 5.4, n: 'The mill door', d: 'Bern told you to rehearse out here because the loft carries sound and the town does not need to hear you learn.\n\nHe meant it kindly. He is like that.' }],
        exits: [
            { x: 6.8, y: 12.3, w: 3, to: 'lane', n: 'back down the lane' },
            { x: 7.9, y: 4.9, w: 1.6, to: 'loft', n: 'up the ladder, into the loft', needs: 'rehearsed',
              shut: 'A ladder into the dark. There is no reason to climb it. Rehearse first.' }
        ],
        speakDraws: 4,
        script: 'mill'
    },
    loft: {
        n: 'The grain loft', sub: 'a crowd of voices with no bodies',
        floor: 'loft', w: 13, h: 13,
        props: [
            { t: 'beam', b: [0, 3.2, 13, 0.6] }, { t: 'beam', b: [0, 9.2, 13, 0.6] },
            { t: 'sack', b: [1.4, 5.4, 1.2, 1] }, { t: 'sack', b: [10.4, 6.6, 1.2, 1] }
        ],
        exits: [{ x: 6, y: 12.3, w: 3, to: 'mill', n: 'back down', needs: 'chorusDown',
              shut: 'It is still going. You are not walking out on it.' }],
        script: 'loft', boss: 'chorus'
    },
    village: {
        n: 'Grelling — the next village', sub: 'an empty hat and a bad performance',
        floor: 'town', calm: 1, w: 15, h: 12,
        props: [
            { t: 'house', b: [0, 0, 3.6, 3] }, { t: 'house', b: [11.4, 0, 3.6, 3.4] }, { t: 'house', b: [0, 9, 4, 3] },
            { t: 'cart', b: [9.6, 7.4, 2.2, 1.2] }, { t: 'well', b: [3.4, 5.6, 1.6, 1.6] }
        ],
        npcs: ['busker'],
        looks: [{ x: 7.4, y: 3.4, n: 'His hat', d: 'On the ground, open, with two coins in it that he almost certainly put there himself.' }],
        exits: [
            { x: 0.7, y: 6, h: 3, to: 'lane', n: 'west, back to the lane' },
            { x: 14.3, y: 6, h: 3, to: 'mark', n: 'east, past the fence' }
        ]
    },
    mark: {
        n: 'The mark', sub: 'she walked out past the mill, the well, the mark',
        floor: 'mill', calm: 1, w: 13, h: 11,
        props: [
            { t: 'markstone', b: [6, 4.6, 1.4, 1.6] },
            { t: 'fence', b: [0.6, 1, 0.5, 9] },
            { t: 'tree', b: [10.2, 2.4, 1.4, 1.4] }
        ],
        looks: [{ x: 6.7, y: 6.6, n: 'The marker stone', d: 'Two names cut into it. The upper one is HAL, and it has been recut so many times it is nearly through the stone.\n\nThe lower one has been scratched out. Not weathered. Scratched, with something hard, by somebody who took their time.\n\nYou cannot read it. You get the shape of four letters and nothing else.', key: 'markstone' }],
        npcs: ['hal'],
        exits: [{ x: 0.7, y: 5.4, h: 3, to: 'village', n: 'back west' }]
    },
    arena: {
        n: 'Dev — free arena', sub: 'nothing here means anything. hit things.',
        floor: 'mill', w: 17, h: 17, arena: 1, endless: 1, props: [], exits: []
    }
};
var PLACE_IDS = Object.keys(PLACES);

/* ─────────────── people ───────────────
   Every one of these can be walked away from. The busker is the
   accessibility valve the design doc asks for: he says the whole
   thing out loud, in plain words, for anybody who does not hear
   meter. */
var NPCS = {
    bern: {
        n: 'Bern', x: 7.4, y: 7.2, col: ['#6a4f3a', '#8a6a4a', '#d8b48c'], hat: 1,
        talk: function () {
            if (!S.seen.bern1) {
                S.seen.bern1 = 1;
                return [['Bern', 'There he is. The new Emberwright.'],
                        ['Bern', 'My father played him. I played him thirty years. Now you play him, and one day some child watches you and thinks, I could do that.'],
                        ['Bern', 'That is the whole of it. That is why we do it.'],
                        ['You', 'What if I get a line wrong?'],
                        ['Bern', 'Then say it again correctly. It is not a difficult play. It is a true one.']];
            }
            if (S.frags[1]) {
                return [['You', 'Bern. The third stanza. Heard, and alone.'],
                        ['Bern', 'Mm.'],
                        ['You', 'They do not rhyme.'],
                        ['Bern', 'No, I suppose they do not. Never noticed. Four hundred years and nobody noticed, how about that.'],
                        ['Bern', 'Sing it the way it is written, lad. It is written that way for a reason.'],
                        ['', 'He does not say what the reason is. He does not know. He has never once needed to.']];
            }
            return [['Bern', 'Learn it out at the mill where the town cannot hear you. No shame in it. I was worse.'],
                    ['Bern', 'Take the lantern. Mind the ladder.']];
        }
    },
    child: {
        n: 'A child with a skipping rope', x: 10.6, y: 9.8, col: ['#4a5a7a', '#6a7a9a', '#e8c8a0'], small: 1,
        talk: function () {
            S.heard.child = 1;
            if (!S.seen.child1) {
                S.seen.child1 = 1;
                return [['', 'She is skipping and counting under her breath. You catch the end of it.'],
                        ['The child', '"...and we would not say a word."'],
                        ['You', 'That is not the line.'],
                        ['The child', 'It is when you skip. The other one does not fit.'],
                        ['You', 'The other one is the line.'],
                        ['The child', 'Then the line is wrong.'],
                        ['', 'She does not stop skipping. Children cannot tolerate a broken rhyme; they repair them by instinct, without knowing what they are preserving.']];
            }
            return [['The child', '"...and we would not say a word." You have to say it like that or you miss.']];
        }
    },
    widow: {
        n: 'A woman setting out a lamp', x: 12.2, y: 8.6, col: ['#3a3448', '#4e465e', '#d8b48c'],
        talk: function () {
            return [['', 'She sets the lamp on the sill and squares it up, twice.'],
                    ['The woman', 'For the man who went out. My mother did it, her mother did it.'],
                    ['You', 'Do you ever set out two?'],
                    ['The woman', 'Two? Whatever for?'],
                    ['', 'She laughs, and goes inside, and the lamp burns in the window for one person.']];
        }
    },
    shepherd: {
        n: 'A shepherd', x: 9.2, y: 5.6, col: ['#4a4a38', '#6a6a50', '#d8b48c'],
        talk: function () {
            S.heard.shepherd = 1;
            if (!S.seen.shep1) {
                S.seen.shep1 = 1;
                return [['', 'He is singing the last verse to nobody, the way you sing when your hands are busy.'],
                        ['The shepherd', '"...not for the man who came back down — but for the girl who never will."'],
                        ['You', 'That is not how it goes.'],
                        ['The shepherd', 'It is how my mother sang it.'],
                        ['You', 'Where did she get it?'],
                        ['The shepherd', 'Her mother, I should think. Nobody gets a song from anywhere else.'],
                        ['', 'He has no idea he is the only person for four hundred years who has been singing it correctly.']];
            }
            return [['The shepherd', '"...but for the girl who never will." Aye. That is the one.']];
        }
    },
    busker: {
        n: 'A busker', x: 7.6, y: 4.4, col: ['#5a3a4a', '#7a5060', '#e8c8a0'],
        talk: function () {
            S.heard.busker = 1;
            if (!S.seen.busk1) {
                S.seen.busk1 = 1;
                return [['', 'He is doing your play, badly, to four people and a dog.'],
                        ['The busker', 'You are the new one. Wick\'s new Emberwright. I can tell by the walk.'],
                        ['You', 'You are doing it wrong.'],
                        ['The busker', 'I am doing it RIGHT. That is why the hat is empty.'],
                        ['The busker', 'Listen. Your version says he stood up, he spoke, we all heard, and he went alone. Heard. Alone. Those two words do not rhyme, and every other verse in that song rhymes like a bell.'],
                        ['The busker', 'Somebody snapped the end off and nailed a new one on. Four hundred years ago. They used the same patch twice because one was cheaper.'],
                        ['You', 'What was the real one?'],
                        ['The busker', 'Word. "And we would not say a word." Because nobody answered her.'],
                        ['You', 'Her.'],
                        ['The busker', '...Ask me again when you have heard it from somebody who is not being paid to say it. If you get that far, come find me. I will not be here.']];
            }
            return [['The busker', 'Heard. Alone. Say them out loud, one after the other, and tell me that is a rhyme.']];
        }
    },
    hal: {
        n: 'A man at the fence', x: 2.8, y: 6.2, col: ['#2a2434', '#3d3350', '#c8b8a8'],
        talk: function () {
            S.heard.hal = 1; sSave();
            return [['', 'He is older than he should be. He has the look of somebody who has been trying to finish a sentence for a very long time.'],
                    ['You', 'Who was she?'],
                    ['', 'He opens his mouth. Four letters start to come out, and the air takes them and turns them over, and what you hear is:'],
                    ['Hal', '"...the Emberwright."'],
                    ['', 'He tries again. The same thing happens. He kneels and writes it in the dirt with one finger, and the dirt says THE EMBERWRIGHT.'],
                    ['Hal', 'She talked to it. That is the whole story. She was the only one of us who would say anything to it.'],
                    ['', 'He does not expand on it. He never will.']];
        }
    }
};

/* ─────────────── scripts ─────────────── */
var SCRIPTS = {
    prologue: function () {
        say('<b>Twelve years ago.</b> You are nine, and the mask is too big.', 'big');
        beat(3.0, function () { say('Your whole part is to walk across the stage and be the thing that ate the light. Walk to the far side.'); });
        beat(7.5, function () { say('You trip. The hall laughs, kindly. Your mother crouches down and fixes the mask.', 'dim'); });
        beat(11, function () { bigLine('twelve years later', '', '#c9a94a', 2.6); });
        beat(13.4, function () { gotoPlace('square', true); });
    },
    wick: function () {
        say('<b>Wick.</b> They are building the stage in the square. You have been given the crown and the lantern.', 'big');
        beat(3.4, function () { say('Talk to people. Look at things. Nothing here wants to hurt you.', 'dim'); });
        beat(6.4, function () { say('When you are ready, the lane runs north to the mill.', 'dim'); });
    },
    mill: function () {
        if (S.seen.millIntro) return;
        S.seen.millIntro = 1;
        say('<b>The mill.</b> Nobody can hear you out here. That is the point of out here.', 'big');
        beat(3.2, function () { say('Rehearse. <i>Say the lines out loud</i> — left click — and see what the dark does with them.', 'dim'); });
    },
    loft: function () {
        say('<b>The grain loft.</b> Something up here is already saying your part.', 'big');
        beat(2.6, function () { say('It strips the rhyme off everything on a pulse. You cannot build slowly here.', 'dim'); });
        beat(4.6, function () { bigLine('THE CHORUS', 'burst between pulses', '#d2c8e1', 2.4); spawnFoe('chorus', 6.5, 3.5); });
    }
};

/* ─────────────── the realisation ───────────────
   Fragment 1 is NOT a boss drop. You get it when you have heard
   the town's refrain in earnest AND heard somebody carrying the
   true line, and the two rub together in your head. Understanding,
   not looting. */
function checkRealisation() {
    if (S.frags[1] || !S.heard.refrain) return;
    var src = S.heard.child || S.heard.busker || S.heard.shepherd;
    if (!src) return;
    RT.realising = 1;
    beat(1.0, function () { bigLine('he spoke and we all heard', '', '#e8e2ee', 2.4); });
    beat(3.4, function () { bigLine('and he went alone', '', '#e8e2ee', 2.4); });
    beat(6.0, function () {
        bigLine('those are not a rhyme', '', '#ffe66e', 3);
        ach('hear');
        say('Somebody snapped the end off the song and nailed a lie onto it, four hundred years ago, and you have just heard the join.', 'good');
    });
    beat(9.4, function () { RT.realising = 0; grantFragment(1); });
}

/* FRAGMENT II — the mark. The stone has a name scratched off it.
   Hal cannot say a name. Neither fact is a clue on its own. */
function checkMark() {
    if (S.frags[2] || !S.frags[1]) return;
    if (!S.seen.markstone || !S.heard.hal) return;
    RT.realising2 = 1;
    beat(1.2, function () { bigLine('four letters', '', '#e8e2ee', 2.4); });
    beat(3.6, function () { bigLine('scratched out of a stone', '', '#e8e2ee', 2.4); });
    beat(6.2, function () {
        bigLine('and out of a man', '', '#8a6ad0', 3);
        say('It is not that nobody remembers her. It is that the remembering was taken out, once, properly, by somebody who had the time.', 'good');
    });
    beat(9.6, function () { RT.realising2 = 0; grantFragment(2); });
}

/* the loop still calls this each frame: run queued beats, keep the
   dev arena stocked, and notice when a place goes quiet. */
function stepScene(dt) {
    for (var i = RT.beats.length - 1; i >= 0; i--) {
        var b = RT.beats[i]; b.t -= dt;
        if (b.t <= 0) { RT.beats.splice(i, 1); try { b.fn(); } catch (e) {} }
    }
    var p = place(), alive = RT.foes.filter(function (f) { return !f.dead; }).length;
    if (p.endless) {
        RT.waveT -= dt;
        if (alive < 6 && RT.waveT <= 0) {
            RT.waveT = 2.5;
            var a = rnd(0, TAU);
            spawnFoe(pick(['mouth', 'mouth', 'thief', 'droner', 'deaf']), pw() / 2 + Math.cos(a) * 6, ph() / 2 + Math.sin(a) * 6);
        }
        return;
    }
    if (!RT.cleared && RT.wave > 0 && alive === 0) {     // the place goes quiet again
        RT.cleared = true;
        if (!RT.tookHit) ach('nohit');
        coin(irnd(2, 5));
        say('Quiet again.', 'dim');
        RT.timers.push(setTimeout(function () { if (RT) { RT.cleared = false; RT.wave = 0; } }, 6000));
    }
}
function beat(after, fn) { RT.beats.push({ t: after, fn: fn }); }

/* ═══════════════ WORLD SYSTEMS ═══════════════
   Travel, solid things, people you can walk up to, and the rule
   that draws hearsay: speaking. */

function place() { return PLACES[RT.place] || PLACES.square; }
function pw() { return place().w || GRID; }
function ph() { return place().h || GRID; }

/* solid props: simple AABB rejection so you slide along walls */
function blocked(x, y, r) {
    var ps = place().props || [];
    for (var i = 0; i < ps.length; i++) {
        var b = ps[i].b;
        if (x + r > b[0] && x - r < b[0] + b[2] && y + r > b[1] && y - r < b[1] + b[3]) return true;
    }
    return false;
}
function moveActor(nx, ny, r) {
    r = r || 0.3;
    var W = pw(), H = ph();
    nx = clamp(nx, 0.5, W - 0.5); ny = clamp(ny, 0.5, H - 0.5);
    if (!blocked(nx, RT.py, r)) RT.px = nx;          // axis-separated, so walls slide
    if (!blocked(RT.px, ny, r)) RT.py = ny;
}

/* ─────────────── travel ─────────────── */
function exitAt(x, y) {
    var xs = place().exits || [];
    for (var i = 0; i < xs.length; i++) {
        var e = xs[i], w = e.w || 0.9, h = e.h || 0.9;
        if (x > e.x - w / 2 && x < e.x + w / 2 && y > e.y - h / 2 && y < e.y + h / 2) return e;
    }
    return null;
}
/* You leave a place by walking off the side of it. The arm flag
   stops you bouncing straight back through the door you came in:
   the exit you arrive standing on does nothing until you have
   stepped off it once. */
function stepTravel() {
    if (RT.dialog || RT.mapOpen || RT.dead) return;
    var e = exitAt(RT.px, RT.py);
    if (!e) { RT.armed = true; RT.nagged = null; return; }
    if (!RT.armed) return;
    if (exitOpen(e)) { gotoPlace(e.to, false); return; }
    if (RT.nagged !== e.n) { RT.nagged = e.n; say(e.shut || 'Not yet.', 'dim'); hudNudge('breath'); }
}
/* never wake up inside a wall */
function unstick() {
    if (!blocked(RT.px, RT.py)) return;
    for (var r = 0.5; r <= 8; r += 0.5) {
        for (var a = 0; a < 16; a++) {
            var x = RT.px + Math.cos(a / 16 * TAU) * r, y = RT.py + Math.sin(a / 16 * TAU) * r;
            if (x > 0.5 && y > 0.5 && x < pw() - 0.5 && y < ph() - 0.5 && !blocked(x, y)) { RT.px = x; RT.py = y; return; }
        }
    }
}
function exitOpen(e) {
    if (!e.needs) return true;
    return !!S.seen[e.needs];
}
function gotoPlace(id, fresh) {
    if (!PLACES[id]) id = 'square';
    var prev = RT.place;
    RT.place = id; S.place = id; S.seen['been_' + id] = 1; sSave();
    if (RT.realising) { RT.realising = 0; grantFragment(1); }   // you walked out on it; you still heard it
    if (RT.realising2) { RT.realising2 = 0; grantFragment(2); }
    RT.foes.length = 0; RT.fproj.length = 0; RT.calls.length = 0;
    RT.beats = []; RT.typo.length = 0; RT.slams.length = 0; RT.lines.length = 0;
    RT.dialog = null; RT.pressure = 0; RT.cleared = false;
    var p = PLACES[id];
    // walk in from the exit that points back where you came from
    var back = (p.exits || []).filter(function (e) { return e.to === prev; })[0];
    if (back) { RT.px = clamp(back.x, 1, (p.w || GRID) - 1); RT.py = clamp(back.y, 1, (p.h || GRID) - 1);
        RT.px += back.h ? (back.x < 2 ? 1.2 : -1.2) : 0; RT.py += back.h ? 0 : (back.y < 2 ? 1.2 : -1.2); }
    else { RT.px = (p.w || GRID) / 2; RT.py = (p.h || GRID) - 2.2; }
    RT.moveTo = null; RT.armed = false; RT.nagged = null;
    unstick();
    RT.hp = RT.hpm; RT.breath = stats().breathMax; RT.winded = 0; RT.dead = false;
    buildFloor(p.floor, p.w || GRID, p.h || GRID);
    updateHud(0);
    bigLine(p.n, '', '#e8e2ee', 2.2);
    if (fresh && p.script) delete S.seen[p.script + 'Intro'];
    if (p.script && SCRIPTS[p.script]) SCRIPTS[p.script]();
    else if (p.boss) { /* handled by script */ }
    if (p.endless) { RT.phase = 'fight'; }
    beat(1.6, checkRealisation); // idempotent: catches anything a doorway interrupted
    beat(1.8, checkMark);
}

/* ─────────────── things you can interact with ─────────────── */
function interactables() {
    var out = [], p = place();
    (p.npcs || []).forEach(function (id) {
        var n = NPCS[id]; if (!n) return;
        out.push({ k: 'npc', id: id, x: n.x, y: n.y, label: 'talk to ' + n.n, n: n });
    });
    (p.looks || []).forEach(function (l, i) {
        out.push({ k: 'look', i: i, x: l.x, y: l.y, label: 'look at ' + l.n, l: l });
    });
    (p.exits || []).forEach(function (e) {
        out.push({ k: 'exit', x: e.x, y: e.y, label: exitOpen(e) ? 'go to ' + e.n : 'not yet', e: e, shut: !exitOpen(e) });
    });
    return out;
}
function nearestInteract() {
    if (RT.dialog) return null;
    var best = null, bd = 1.9;
    interactables().forEach(function (o) {
        var d = Math.hypot(o.x - RT.px, o.y - RT.py);
        if (d < bd) { bd = d; best = o; }
    });
    return best;
}
function doInteract() {
    var o = RT.prompt;
    if (RT.dialog) { advanceDialog(); return; }
    if (!o) return;
    if (o.k === 'npc') openDialog(o.n.talk(), o.n.n);
    else if (o.k === 'look') {
        RT.looked = RT.looked || {};
        RT.looked[RT.place + ':' + o.i] = 1;
        openDialog([['', o.l.d]], o.l.n, o.l.key);
    }
    else if (o.k === 'exit') {
        if (o.shut) { say(o.e.shut || 'Not that way. Not yet.', 'dim'); return; }
        gotoPlace(o.e.to, false);
    }
}

/* ─────────────── dialogue ───────────────
   The slow channel. Full lines are allowed here because nothing
   is trying to kill you while you read them. */
function openDialog(lines, who, key) {
    RT.dialog = { lines: lines, i: 0, who: who, key: key };
    RT.moveTo = null;
    showDialog();
    sfx('ui');
}
function showDialog() {
    var d = RT.dialog, el = RT.root.querySelector('.nn-dlg');
    if (!d) { el.hidden = true; return; }
    var ln = d.lines[d.i];
    el.hidden = false;
    el.querySelector('.nn-dlg-who').textContent = ln[0] || d.who || '';
    el.querySelector('.nn-dlg-tx').innerHTML = esc(ln[1]).replace(/\n/g, '<br>');
    el.querySelector('.nn-dlg-more').textContent = d.i < d.lines.length - 1 ? 'E / click — more' : 'E / click — done';
}
function advanceDialog() {
    var d = RT.dialog; if (!d) return;
    d.i++;
    if (d.i >= d.lines.length) {
        var key = d.key;
        RT.dialog = null;
        RT.root.querySelector('.nn-dlg').hidden = true;
        if (key === 'markstone') { S.seen.markstone = 1; sSave(); }
        checkRealisation();
        checkMark();
        sSave();
        return;
    }
    showDialog();
    sfx('ui');
}

/* ─────────────── hearsay is drawn by SPEAKING ───────────────
   You can cross most of this world without a fight. Say the lines
   out loud somewhere that does not want them said, and the loose
   bits of the story come to see who is talking. */
function speakPressure() {
    var p = place();
    if (!p.speakDraws || RT.cleared || RT.dialog) return;
    RT.pressure += 1;
    var need = 6 + RT.wave * 2;
    if (RT.pressure < need) return;
    RT.pressure = 0; RT.wave++;
    var n = Math.min(p.speakDraws, 1 + RT.wave);
    say(pick(['Something in the dark starts saying it back.', 'The dark has opinions about your delivery.', 'Somewhere behind you, your own line, slightly wrong.']), 'bad');
    for (var i = 0; i < n; i++) {
        var a = rnd(0, TAU), rr = rnd(4.5, 6.5);
        spawnFoe(RT.wave >= 3 && i === 0 ? 'thief' : 'mouth',
            clamp(RT.px + Math.cos(a) * rr, 1, pw() - 1), clamp(RT.py + Math.sin(a) * rr, 1, ph() - 1));
    }
    if (RT.place === 'mill' && RT.wave >= 2 && !S.seen.rehearsed) {
        S.seen.rehearsed = 1; sSave();
        say('Something up in the loft is saying your part along with you.', 'big');
    }
}

/* ─────────────── drawing the world ─────────────── */
function drawProps(cx, layer) {
    var ps = place().props || [];
    for (var i = 0; i < ps.length; i++) {
        var o = ps[i], b = o.b;
        var cxp = b[0] + b[2] / 2, cyp = b[1] + b[3] / 2;
        if (layer === 'back' && (cxp + cyp) > RT.px + RT.py) continue;
        if (layer === 'front' && (cxp + cyp) <= RT.px + RT.py) continue;
        drawProp(cx, o);
    }
}
function drawProp(cx, o) {
    var b = o.b, t = o.t;
    var x0 = isoX(b[0], b[1]), x1 = isoX(b[0] + b[2], b[1]), x2 = isoX(b[0] + b[2], b[1] + b[3]), x3 = isoX(b[0], b[1] + b[3]);
    var y0 = isoY(b[0], b[1]), y1 = isoY(b[0] + b[2], b[1]), y2 = isoY(b[0] + b[2], b[1] + b[3]), y3 = isoY(b[0], b[1] + b[3]);
    var hgt = t === 'house' ? 78 : t === 'mill' ? 96 : t === 'curtain' ? 120 : t === 'stagewip' ? 26
        : t === 'tree' ? 62 : t === 'well' ? 26 : t === 'markstone' ? 40 : t === 'wheel' ? 70
        : t === 'fence' ? 22 : t === 'beam' ? 16 : t === 'cart' ? 22 : t === 'crate' ? 20 : t === 'sack' ? 14 : t === 'foot' ? 6 : 18;
    var pal = t === 'house' ? ['#3b3340', '#2c2532', '#4a4150']
        : t === 'mill' ? ['#4a3f30', '#37301f', '#5c5040']
        : t === 'tree' ? ['#243626', '#1a2a1c', '#2f4632']
        : t === 'curtain' ? ['#3a1c22', '#2a1218', '#4a262e']
        : t === 'markstone' ? ['#4a4a52', '#3a3a42', '#5c5c66']
        : t === 'fence' || t === 'beam' ? ['#3a2f24', '#2c231a', '#4a3d2e']
        : ['#43392e', '#332b22', '#544738'];
    // top face
    cx.beginPath(); cx.moveTo(x0, y0 - hgt); cx.lineTo(x1, y1 - hgt); cx.lineTo(x2, y2 - hgt); cx.lineTo(x3, y3 - hgt); cx.closePath();
    cx.fillStyle = pal[2]; cx.fill();
    // two visible walls
    cx.beginPath(); cx.moveTo(x3, y3 - hgt); cx.lineTo(x2, y2 - hgt); cx.lineTo(x2, y2); cx.lineTo(x3, y3); cx.closePath();
    cx.fillStyle = pal[0]; cx.fill();
    cx.beginPath(); cx.moveTo(x1, y1 - hgt); cx.lineTo(x2, y2 - hgt); cx.lineTo(x2, y2); cx.lineTo(x1, y1); cx.closePath();
    cx.fillStyle = pal[1]; cx.fill();
    if (t === 'house') {
        // a roof, so it reads as somewhere people sleep and not as a box
        var rh = 26, mx = (x0 + x2) / 2, my = (y0 + y2) / 2 - hgt;
        cx.fillStyle = '#241d29';
        cx.beginPath(); cx.moveTo(x3, y3 - hgt); cx.lineTo(x2, y2 - hgt); cx.lineTo(mx, my - rh); cx.closePath(); cx.fill();
        cx.fillStyle = '#1b1520';
        cx.beginPath(); cx.moveTo(x1, y1 - hgt); cx.lineTo(x2, y2 - hgt); cx.lineTo(mx, my - rh); cx.closePath(); cx.fill();
        cx.fillStyle = '#332a3a';
        cx.beginPath(); cx.moveTo(x0, y0 - hgt); cx.lineTo(x3, y3 - hgt); cx.lineTo(mx, my - rh); cx.closePath(); cx.fill();
        // a door on the face you can see
        var dx = x3 + (x2 - x3) * 0.5, dy = y3 + (y2 - y3) * 0.5;
        cx.fillStyle = '#191320'; cx.fillRect(dx - 6, dy - 30, 12, 30);
        cx.fillStyle = '#2e2436'; cx.fillRect(dx - 6, dy - 30, 12, 3);
        // one lit window: the ninth night is a lamp on every sill
        cx.fillStyle = 'rgba(255,196,110,.2)'; cx.fillRect(x3 + 8, y3 - hgt + 16, 17, 19);
        cx.fillStyle = 'rgba(255,196,110,.8)'; cx.fillRect(x3 + 12, y3 - hgt + 20, 9, 11);
        cx.strokeStyle = 'rgba(20,14,26,.9)'; cx.lineWidth = 1.5;
        cx.beginPath(); cx.moveTo(x3 + 16.5, y3 - hgt + 20); cx.lineTo(x3 + 16.5, y3 - hgt + 31); cx.stroke();
    }
    if (t === 'tree') {
        // three overlapping blobs read as a canopy; one ellipse reads as a lozenge
        var tx = (x0 + x2) / 2, ty = (y0 + y2) / 2 - hgt;
        cx.fillStyle = '#1c2c1f';
        cx.beginPath(); cx.ellipse(tx - 12, ty + 4, 19, 13, 0, 0, TAU); cx.fill();
        cx.beginPath(); cx.ellipse(tx + 13, ty + 2, 17, 12, 0, 0, TAU); cx.fill();
        cx.fillStyle = '#2c4430';
        cx.beginPath(); cx.ellipse(tx, ty - 9, 24, 16, 0, 0, TAU); cx.fill();
        cx.fillStyle = '#3a5840';
        cx.beginPath(); cx.ellipse(tx - 6, ty - 15, 13, 8, 0, 0, TAU); cx.fill();
    }
    if (t === 'stagewip') {                               // the play, half built
        cx.strokeStyle = '#6a5638'; cx.lineWidth = 2;
        for (var pz = 0; pz < 3; pz++) {
            var qx = x3 + (x2 - x3) * (0.2 + pz * 0.3), qy = y3 + (y2 - y3) * (0.2 + pz * 0.3);
            cx.beginPath(); cx.moveTo(qx, qy - hgt); cx.lineTo(qx + 2, qy - hgt - 30); cx.stroke();
        }
    }
    if (t === 'markstone') {                              // two names, one scratched out
        cx.fillStyle = '#7a7a86'; cx.fillRect((x0 + x2) / 2 - 9, (y0 + y2) / 2 - hgt + 6, 18, 2);
        cx.fillStyle = '#2a2a30'; cx.fillRect((x0 + x2) / 2 - 9, (y0 + y2) / 2 - hgt + 13, 18, 3);
        cx.strokeStyle = '#6a6a76'; cx.lineWidth = 1;
        for (var s = 0; s < 4; s++) { cx.beginPath(); cx.moveTo((x0 + x2) / 2 - 9 + s * 5, (y0 + y2) / 2 - hgt + 11); cx.lineTo((x0 + x2) / 2 - 4 + s * 5, (y0 + y2) / 2 - hgt + 17); cx.stroke(); }
    }
    if (t === 'well') { cx.fillStyle = '#12101a'; cx.beginPath(); cx.ellipse((x0 + x2) / 2, (y0 + y2) / 2 - hgt, 14, 7, 0, 0, TAU); cx.fill(); }
}
/* Something you can look at has to be visible before you are told
   you can look at it. A small mark, brighter once you are close,
   duller once you have read it. */
function drawLooks(cx) {
    (place().looks || []).forEach(function (l, i) {
        var sx = isoX(l.x, l.y), sy = isoY(l.x, l.y) + TILE_H / 2;
        var near = Math.hypot(l.x - RT.px, l.y - RT.py) < 2.4;
        var read = !!(RT.looked && RT.looked[RT.place + ':' + i]);
        var pu = 0.5 + Math.sin(RT.t * 2.2 + i * 1.7) * 0.5;
        cx.save();
        cx.globalAlpha = (read ? 0.22 : near ? 0.85 : 0.45 + pu * 0.25);
        cx.translate(sx, sy - 16 - pu * 2);
        cx.fillStyle = read ? '#6a6278' : '#c9a94a';
        cx.beginPath(); cx.moveTo(0, -5); cx.lineTo(4, 0); cx.lineTo(0, 5); cx.lineTo(-4, 0); cx.closePath(); cx.fill();
        if (!read) {
            cx.globalAlpha *= 0.3; cx.beginPath(); cx.arc(0, 0, 9 + pu * 3, 0, TAU); cx.fill();
        }
        cx.restore();
    });
}
function drawExits(cx) {
    (place().exits || []).forEach(function (e) {
        var open = exitOpen(e);
        var sx = isoX(e.x, e.y), sy = isoY(e.x, e.y) + TILE_H / 2;
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5);
        var pul = 0.35 + Math.sin(RT.t * 2.4) * 0.12;
        cx.strokeStyle = open ? 'rgba(201,169,74,' + pul + ')' : 'rgba(120,110,130,.22)';
        cx.lineWidth = 2.5;
        cx.beginPath(); cx.arc(0, 0, 22, 0, TAU); cx.stroke();
        cx.restore();
        if (open) {                                       // a little lamp marking the way out
            cx.globalCompositeOperation = 'lighter';
            var g = cx.createRadialGradient(sx, sy - 8, 2, sx, sy - 8, 30);
            g.addColorStop(0, 'rgba(255,200,110,.18)'); g.addColorStop(1, 'rgba(255,190,90,0)');
            cx.fillStyle = g; cx.beginPath(); cx.arc(sx, sy - 8, 30, 0, TAU); cx.fill();
            cx.globalCompositeOperation = 'source-over';
        }
    });
}
function drawNpc(cx, n) {
    var sx = isoX(n.x, n.y), sy = isoY(n.x, n.y) + TILE_H / 2;
    var bob = Math.sin(RT.t * 1.8 + n.x) * 0.9;
    var h = n.small ? 26 : 40, w = n.small ? 7 : 9;
    cx.save(); cx.translate(sx, sy - bob);
    cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(0, bob, 9, 3.6, 0, 0, TAU); cx.fill();
    cx.fillStyle = n.col[0]; cx.beginPath();
    cx.moveTo(-w, 0); cx.lineTo(-w * 0.7, -h * 0.7); cx.lineTo(w * 0.7, -h * 0.7); cx.lineTo(w, 0); cx.closePath(); cx.fill();
    cx.fillStyle = n.col[1]; cx.fillRect(-w * 0.7, -h * 0.72, w * 1.4, h * 0.24);
    cx.fillStyle = n.col[2]; cx.beginPath(); cx.arc(0, -h * 0.86, w * 0.62, 0, TAU); cx.fill();
    if (n.hat) { cx.fillStyle = '#2a2018'; cx.fillRect(-w * 0.95, -h * 1.06, w * 1.9, 3); cx.fillRect(-w * 0.55, -h * 1.22, w * 1.1, 4); }
    cx.restore();
    // a quiet mark so you know they will talk to you
    cx.save(); cx.globalAlpha = 0.5 + Math.sin(RT.t * 2.6 + n.y) * 0.2;
    cx.fillStyle = '#c9a94a'; cx.font = 'bold 9px "Press Start 2P", monospace'; cx.textAlign = 'center';
    cx.fillText('·', sx, sy - h - 12); cx.restore(); cx.textAlign = 'left';
}
function drawPrompt(cx) {
    var o = RT.prompt; if (!o || RT.dialog) return;
    var sx = isoX(o.x, o.y), sy = isoY(o.x, o.y) + TILE_H / 2;
    var txt = (o.shut ? '' : 'E — ') + o.label;
    cx.save(); cx.textAlign = 'center'; cx.font = '11px "Pixelify Sans"';
    var w = cx.measureText(txt).width + 16;
    cx.fillStyle = 'rgba(8,6,14,.86)'; cx.fillRect(sx - w / 2, sy - 74, w, 19);
    cx.fillStyle = o.shut ? '#6a6278' : '#c9a94a'; cx.fillRect(sx - w / 2, sy - 74, 2, 19);
    cx.fillStyle = o.shut ? '#8a8296' : '#f0e9df';
    cx.fillText(txt, sx, sy - 61); cx.restore(); cx.textAlign = 'left';
}

/* ─────────────── the map ───────────────
   Places you have been, and what joins them. */
var MAP_POS = { stage: [1, 4], square: [2, 3], lane: [2, 2], mill: [2, 1], loft: [2, 0], village: [3, 2], mark: [4, 2], arena: [0, 0] };
function drawMap(cx) {
    if (!RT.mapOpen) return;
    cx.fillStyle = 'rgba(6,4,10,.9)'; cx.fillRect(0, 0, VW, VH);
    cx.textAlign = 'center';
    cx.fillStyle = '#d8cfa8'; cx.font = '16px "Press Start 2P", monospace';
    cx.fillText('WHERE YOU HAVE BEEN', VW / 2, 70);
    var ox = VW / 2 - 160, oy = 150, cell = 118;
    // links first
    cx.lineWidth = 2;
    PLACE_IDS.forEach(function (id) {
        if (!MAP_POS[id] || !S.seen['been_' + id] || id === 'arena') return;
        (PLACES[id].exits || []).forEach(function (e) {
            if (!MAP_POS[e.to]) return;
            // a road you have walked is solid; one you have only heard of is dashed
            var known = S.seen['been_' + e.to];
            cx.strokeStyle = known ? 'rgba(140,130,160,.4)' : 'rgba(120,110,145,.18)';
            cx.setLineDash(known ? [] : [4, 6]);
            cx.beginPath();
            cx.moveTo(ox + MAP_POS[id][0] * cell, oy + MAP_POS[id][1] * cell);
            cx.lineTo(ox + MAP_POS[e.to][0] * cell, oy + MAP_POS[e.to][1] * cell);
            cx.stroke();
        });
    });
    cx.setLineDash([]);
    PLACE_IDS.forEach(function (id) {
        var m = MAP_POS[id]; if (!m || id === 'arena') return;
        var seen = S.seen['been_' + id], here = RT.place === id;
        var x = ox + m[0] * cell, y = oy + m[1] * cell;
        cx.fillStyle = here ? '#c9a94a' : seen ? '#3d3350' : '#1a1620';
        cx.beginPath(); cx.arc(x, y, here ? 12 : 9, 0, TAU); cx.fill();
        cx.strokeStyle = here ? '#ffe66e' : seen ? '#6a5f82' : '#241f2e'; cx.lineWidth = 2; cx.stroke();
        cx.fillStyle = seen ? (here ? '#ffe66e' : '#b9b0c6') : '#3a3446';
        cx.font = '10px "Pixelify Sans"';
        cx.fillText(seen ? PLACES[id].n.split('—')[0].trim() : '?', x, y + 26);
    });
    cx.fillStyle = '#6a6278'; cx.font = '10px "Pixelify Sans"';
    cx.fillText('M to close', VW / 2, VH - 40);
    cx.textAlign = 'left';
}

/* ─────────────── capture harness ───────────────
   ?dev=ninth&ndev=<place>[&nfr=frames][&nat=x,y][&nfoes=n][&ndlg=npc]
   Headless Chrome never runs rAF, so every frame here is stepped by
   hand. This exists so screenshots are of a known frame, not of
   whatever the scheduler felt like. */
function devDemo() {
    var q = {};
    location.search.slice(1).split('&').forEach(function (kv) { var a = kv.split('='); q[a[0]] = decodeURIComponent(a[1] || ''); });
    var id = q.ndev || 'square';
    if (q.nwipe) { try { localStorage.removeItem('comp_ninth'); } catch (e) {} }
    if (q.nfrag) for (var i = 1; i <= +q.nfrag; i++) grantFragment(i);
    if (PLACES[id]) gotoPlace(id, true);
    if (q.nat) { var xy = q.nat.split(','); RT.px = +xy[0]; RT.py = +xy[1]; RT.armed = false; unstick(); }
    if (q.nfoes) for (var j = 0; j < +q.nfoes; j++) {
        var a = j / +q.nfoes * TAU;
        spawnFoe(j === 0 ? 'thief' : 'mouth', clamp(RT.px + Math.cos(a) * 4, 1, pw() - 1), clamp(RT.py + Math.sin(a) * 4, 1, ph() - 1));
    }
    var fr = q.nfr ? +q.nfr : 90;
    for (var f = 0; f < fr; f++) { try { step(1 / 60); draw(); } catch (e) { console.error('devDemo step', e); break; } }
    if (q.ndlg && NPCS[q.ndlg]) { var n = NPCS[q.ndlg]; openDialog(n.talk(), n.n); }
    if (q.nmap) RT.mapOpen = true;
    if (q.npanel) panel(q.npanel);
    draw();
    window.__nnReady = true;
}

/* ─────────────── lifecycle ─────────────── */
function close() {
    var hrs = RT ? (Date.now() - RT.started) / 3600000 : 0;
    if (RT) {
        cancelAnimationFrame(RT.raf);
        RT.timers.forEach(function (t) { clearTimeout(t); });
        window.removeEventListener('pointerup', RT.mup);
        if (RT.ac) { try { RT.ac.close(); } catch (e) {} }
        RT = null;
    }
    if (S) sSave();
    if (window.__ninth) delete window.__ninth;
    return hrs;
}
window.NINTH = { render: render, init: init, close: close, steamAch: steamAch };
})();
