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

/* Anything that must not survive a doorway registers a callback here,
   next to its own code, instead of editing gotoPlace's reset block.
   Declared first: registrations run at module scope all through this
   file, and a `var RESETS = []` further down would either throw on the
   push or quietly throw the registrations away. */
var RESETS = [];
function onPlaceChange(fn) { RESETS.push(fn); }

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
/* ─────────────── the camera ───────────────
   isoXB/isoYB are the fixed projection: world tile to a point in an
   imaginary sheet that is as big as the place. isoX/isoY are that
   minus wherever the camera is looking, which is what everything
   draws with. A place smaller than the canvas centres and never
   scrolls, so the small rooms stay composed the way they were.
   Anything that converts the other way (the mouse) has to add the
   camera back: use screenToWorld, do not re-derive it. */
var CAM0 = { x: 0, y: 0 };
function cam() { return (RT && RT.world) ? RT.world.cam : CAM0; }
function isoXB(x, y) { return ORX + (x - y) * (TILE_W / 2); }
function isoYB(x, y) { return ORY + (x + y) * (TILE_H / 2); }
function isoX(x, y) { return ORX + (x - y) * (TILE_W / 2) - cam().x; }
function isoY(x, y) { return ORY + (x + y) * (TILE_H / 2) - cam().y; }
function screenToWorld(sx, sy) {
    var c = cam();
    var a = (sx + c.x - ORX) / (TILE_W / 2), b = (sy + c.y - ORY) / (TILE_H / 2);
    return { wx: (a + b) / 2, wy: (b - a) / 2 };
}
/* The rectangle the place occupies in base-projection space, with a
   margin so the floor bitmap has room for the prop that overhangs it. */
var FLOOR_PAD = 64;
function placeBox(gw, gh) {
    var x0 = isoXB(0, gh) - FLOOR_PAD, x1 = isoXB(gw, 0) + FLOOR_PAD;
    var y0 = isoYB(0, 0) - FLOOR_PAD, y1 = isoYB(gw, gh) + TILE_H + FLOOR_PAD;
    return { x: x0, y: y0, w: Math.ceil(x1 - x0), h: Math.ceil(y1 - y0) };
}
/* Where the camera is allowed to be, so you never see past the floor.
   Smaller than the viewport on an axis means centre it and hold still. */
function camBounds(gw, gh) {
    var b = placeBox(gw, gh);
    return {
        x0: b.w <= VW ? b.x + (b.w - VW) / 2 : b.x,
        x1: b.w <= VW ? b.x + (b.w - VW) / 2 : b.x + b.w - VW,
        y0: b.h <= VH ? b.y + (b.h - VH) / 2 : b.y,
        y1: b.h <= VH ? b.y + (b.h - VH) / 2 : b.y + b.h - VH
    };
}
/* Dead zone follow. The camera does not move until you push out of a
   box in the middle of the screen, so walking around a room does not
   swim, and walking down a road does. */
var DEAD_W = 300, DEAD_H = 150;
function camTarget(px, py) {
    var c = cam(), sx = isoXB(px, py) - c.x, sy = isoYB(px, py) + TILE_H / 2 - c.y;
    var nx = c.x, ny = c.y;
    var l = (VW - DEAD_W) / 2, r = VW - l, t = (VH - DEAD_H) / 2, bm = VH - t;
    if (sx < l) nx -= (l - sx); else if (sx > r) nx += (sx - r);
    if (sy < t) ny -= (t - sy); else if (sy > bm) ny += (sy - bm);
    return { x: nx, y: ny };
}
function stepCamera(dt, snap) {
    var w = RT.world, bd = camBounds(pw(), ph());
    var tg = camTarget(RT.px, RT.py);
    tg.x = clamp(tg.x, bd.x0, bd.x1); tg.y = clamp(tg.y, bd.y0, bd.y1);
    if (snap) { w.cam.x = tg.x; w.cam.y = tg.y; }
    else {
        var k = 1 - Math.pow(0.0016, dt);          // frame-rate independent ease
        w.cam.x += (tg.x - w.cam.x) * k;
        w.cam.y += (tg.y - w.cam.y) * k;
    }
    // The cursor stays where it is and the world slides under it. Aim is
    // a screen point, so the world point has to be re-derived every time
    // the eye moves, or you spend the walk shooting at where the ground
    // used to be. Before the camera the projection was constant and
    // caching it on pointermove was safe.
    var m = RT.mouse, p = screenToWorld(m.x, m.y);
    m.wx = p.wx; m.wy = p.wy;
}

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
    ttk: 1,              // global enemy hp multiplier, for feel testing
    /* job 4 */
    deafMul: 0.2,        // what the Deaf takes from anything that is not -ill
    eliteChance: 0.18,   // odds an authored encounter slot rolls a modifier
    eliteHp: 1,          // scales EVERY elite's hp on top of its modifier's own
    eliteCoin: 3,
    echoBreak: 6,        // echo lost when one of YOUR stacks goes sour
    repriseCost: 100,    // a full Echo bar
    repriseHits: 3, repriseMul: 0.85, repriseGap: 0.34,
    droneSelfHurt: 0,    // 0 = a Droner's own words never hurt YOU. see the PR.
    /* the line: words are dealt, rhymes are yours */
    lineSize: 4,         // the word on your tongue plus three you can see coming
    swallowCost: 5,      // breath to bin a word you do not want
    swallowCd: 0.22,
    coupletStacks: 1,    // extra stacks for saying two of a sound back to back
    coupletDmg: 0.35,    // and extra bite on the second one
    slantShift: 1,       // a slant rhyme drags every other sound over to its own
    rhymeCost: 15        // what closing a rhyme costs. answerCost is its old name
};

/* ─────────────── hearsay ───────────────
   Trash is misrememberings, loose bits of the play, crowd noise,
   applause with teeth. The counters are the lesson. */
var FOES = {
    mouth:  { n: 'Hearsay', hp: 26, dmg: 6, spd: 2.5, r: 0.42, atk: 1.0, tell: 0.3, xp: 8, coin: [0, 1],
              ai: 'walk', draw: 'mouth',
              d: 'A chattering mouth. Says a bit of the play that was never in the play.' },
    thief:  { n: 'Thief',   hp: 40, dmg: 8, spd: 3.2, r: 0.44, atk: 1.4, tell: 0.35, xp: 16, coin: [1, 2], steal: 2.2,
              ai: 'dart', draw: 'thief', stealTell: 0.8, keep: 4.2,
              d: 'Runs in, answers your stacks for you with the wrong sound, and runs off with the detonation. Kill it first. -ark hides your stacks from it.' },
    droner: { n: 'Droner',  hp: 54, dmg: 7, spd: 1.9, r: 0.5, atk: 1.6, tell: 0.5, xp: 18, coin: [1, 2], drone: 1.6,
              ai: 'hold', draw: 'droner', droneTell: 0.7, keep: 5.4, range: 7.2,
              d: 'Hangs back and says its own line over and over, writing a rhyme onto itself. Overwrite it faster than it can drone, or it never opens.' },
    deaf:   { n: 'The Deaf', hp: 70, dmg: 11, spd: 1.7, r: 0.55, atk: 1.5, tell: 0.55, xp: 24, coin: [1, 3], deaf: 1,
              ai: 'walk', draw: 'deaf', armor0: 3,
              d: 'Hears nothing. Sound slides off it: only -ill touches it, so it is the enemy you change your build for.' },
    sword:  { n: 'The Sword', hp: 150, dmg: 16, spd: 2.1, r: 0.6, atk: 1.3, tell: 0.45, xp: 40, coin: [3, 6], norhyme: 1, elite: 1,
              ai: 'walk', draw: 'sword',
              d: 'Carries no rhyme at all. Cannot be stacked. Cannot be detonated. Kill it with raw call damage, slowly, like an idiot, while everything else on screen explodes beautifully.' },
    folk:   { n: 'Wick', hp: 1, dmg: 0, spd: 0, r: 0.4, atk: 99, tell: 0, xp: 0, coin: [0, 0], folk: 1, norhyme: 1, draw: 'folk',
              d: 'A person in the audience. Cannot be hurt, cannot be moved, cannot be rhymed with. Carries one open line that nobody has ever answered.' },
    chorus: { n: 'THE CHORUS', hp: 900, dmg: 12, spd: 0, r: 1.6, atk: 2.2, tell: 0.8, xp: 300, coin: [20, 30], boss: 1, pulse: 5.5,
              ai: 'chorus', draw: 'chorus', onDown: 'chorus',
              d: 'A crowd of voices, no bodies, saying the refrain in unison. It strips rhyme off everything on a pulse. Burst between pulses.' }
};
/* ─────────────── elite modifiers ───────────────
   A thin composable layer, so six archetypes cover a whole game. A
   modifier bends numbers and adds one readable mark; it never adds a
   new AI. Applied at spawn by the encounter table or the DEV tab. */
var MODS = {
    loud:   { n: 'Loud',    col: '#e8913a', hp: 1.6, dmg: 1.3, mark: 'ring',
              d: 'Bigger, louder, hits harder. Nothing clever.' },
    quick:  { n: 'Quick',   col: '#9fe0c8', hp: 0.8, spd: 1.55, atk: 0.7, mark: 'streak',
              d: 'Half the health, twice the pace. It gets inside your rhythm.' },
    sealed: { n: 'Sealed',  col: '#6fd4ff', hp: 1.3, armor: 5, mark: 'plate',
              d: 'Armoured until something reveals it. -ight strips it.' },
    droning:{ n: 'Droning', col: '#c9a94a', hp: 1.2, drone: 2.2, mark: 'halo',
              d: 'Writes on itself like a Droner does, whatever it is underneath.' },
    thieving:{ n: 'Light-fingered', col: '#c86a6a', hp: 1.15, steal: 3.4, mark: 'hand',
              d: 'Steals a detonation like a Thief does, whatever it is underneath.' }
};
var MOD_IDS = Object.keys(MODS);

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
    ['hear', 'You Heard It', 'Notice what does not rhyme'],
    ['reprise', 'Again', 'Spend a full Echo on a Reprise'],
    ['elite', 'Worse Than Usual', 'Put down an elite'],
    ['allsix', 'The Whole Cast', 'Meet all six of them'],
    ['written', 'The Four Hundredth', 'Perform it the way it is written'],
    ['answered', 'The Answer', 'Close the couplet nobody closed'],
    ['silence', 'Nothing', 'Say neither version of it'],
    ['verse', 'The Whole Song', 'Sing the true one all the way to the end']
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
    hilt:   { n: 'A Sword Hilt', cost: 140, sell: 12, joke: 1, d: 'Prop, not weapon. Nothing rhymes with sword, so it does nothing at all, in any hand, forever. She is asking a great deal for it.',
              m: {} }
};
var CHARM_IDS = Object.keys(CHARMS);

/* ─────────────── things you carry ───────────────
   A charm is a bag of modifiers. An item is a thing. The test that
   separates them: an item can be used, given, shown to somebody, or
   lost, and a charm that adds 30% damage cannot do any of those.

   `use` returns a string to say, or false to mean "not here, not now"
   and stay in the bag. `writ` is a word burnt or scratched into the
   object: reading it teaches the word, because in this game a word is
   a line of a song and somebody had to write it down somewhere.
   `keep` items are never consumed by use. */
var ITEMS = {
    coal: {
        n: 'A Cold Coal', tag: 'keep', keep: 1, one: 1,
        d: 'Burnt through and gone out. It is not the prop from the play; the prop is whole and painted. Somebody carried this one a long way and did not bring it back.',
        use: function () { return 'You turn it over. Cold all the way through. Whoever put it out did it a long time before you were born.'; }
    },
    // NOT to be confused with the charm called The Sill Lamp, which is the
    // one the town sets out for him. This is a plain lamp you can carry.
    lamp: {
        n: 'A Tallow Lamp', tag: 'tool', keep: 1, cost: 30, sell: 8,
        d: 'Wick, tallow, a tin shade with a dent in it. The kind every house sets on the sill, before anybody decided which sill mattered. You can put it down somewhere.',
        use: function () { return setLamp(); }
    },
    // you have carried this since the prologue; it is granted to a new save
    mask: {
        n: 'The Mask', tag: 'keep', keep: 1, one: 1,
        d: 'The one you wore when you were nine. It was too big then and it is too big now, which tells you something about how long they have been handing it down.',
        // worn state lives on the save, not the runtime: a mask you put on
        // should still be on after you walk through a door. Job 1 can read
        // S.items.wearing for the ending.
        use: function () {
            var worn = S.items.wearing = S.items.wearing ? 0 : 1;
            sSave();
            return worn ? 'You put it on. The eyeholes sit too high, the way they always did. You have to turn your head to see anything.'
                        : 'You take it off. The square is wider than it was a moment ago.';
        }
    },
    wax: {
        n: 'A Stub of Wax', tag: 'use', cost: 18,
        d: 'Off the chandler\'s counter. Warm it in your hand and a mismatched pair holds for a while: slants land in full.',
        // stacks rather than resets, so a second stub is never worth less than
        // the seconds it wipes off the first. Refuses near the ceiling instead
        // of eating a stub for the two seconds it has room for.
        use: function () {
            if (RT.items.freeSlant > 30) return { no: 'The wax in your hand is still soft. Use that up first.' };
            RT.items.freeSlant = Math.min(44, RT.items.freeSlant + 22);
            return 'You work the wax soft. For a little while a slant will not fall flat.';
        }
    },
    pitch: {
        // names the refrain on purpose. The thief strips a stack too and this
        // does not stop him: a description that said "one thing that would
        // strip them" would be lying about the thief.
        n: 'A Thumb of Pitch', tag: 'use', cost: 26,
        d: 'Black, sticky, smells like the mill. Thumb it on and the refrain will not strip your rhymes off, once.',
        use: function () {
            if (RT.items.tack) return { no: 'You already have pitch on your palm. It has not been used up yet.' };
            RT.items.tack = 1;
            return 'You thumb it onto your palm. The next refrain goes through and your rhymes stay where you put them.';
        }
    },
    breath: {
        n: 'A Held Breath', tag: 'use', cost: 22,
        d: 'A stoppered jar with nothing visible in it. The chandler sells them cheap and will not explain.',
        use: function () {
            if (!RT) return false;
            if (RT.breath >= stats().breathMax - 0.5) return { no: 'You are not short of breath. It keeps.' };
            RT.breath = stats().breathMax; RT.winded = 0;
            return 'You unstopper it and somebody else\'s breath goes into you. It is not pleasant. It works.';
        }
    },
    // spends Echo, which nothing else in the game consumes. Flagged for job 4,
    // which owns whether Echo gets a real consumer: if it builds one, this
    // should become a second use of that, not a private reader.
    horn: {
        n: 'A Cracked Horn', tag: 'use', cost: 34,
        d: 'It will not sound. Hold it while a room is still ringing and it takes the ringing instead, and gives it back as breath.',
        use: function () {
            if (!RT || RT.echo < 20) return { no: 'Nothing is ringing. The horn wants a room that is still going.' };
            // Echo converts at 0.55 and tops out at 55, but breath tops out at
            // 40, so the horn used to throw the surplus away and then report
            // the number it threw away. Spend only the Echo the breath can
            // take, and say what actually went in.
            var max = stats().breathMax, room = max - RT.breath;
            if (room < 1) return { no: 'You are full of breath. The horn would only take the ring out of the room for nothing.' };
            var got = Math.min(room, Math.round(RT.echo * 0.55));
            RT.echo = Math.max(0, RT.echo - Math.ceil(got / 0.55));
            RT.breath = Math.min(max, RT.breath + got); RT.winded = 0;
            return 'The horn takes the ring out of the room. You get ' + got + ' breath back and the quiet is very sudden.';
        }
    },
    slate: {
        n: 'Hal\'s Slate', tag: 'keep', keep: 1, cost: 45, one: 1,
        d: 'The chandler had it off Hal years ago and never asked why. Hal kneels and writes her name in the dirt and rubs it out with his boot, every time. Writing on a slate stays until somebody wipes it.',
        use: function () { return 'You keep it in your coat. Nothing is written on it yet. That is the point of it.'; }
    },
    // the word market: he found them written on things, which is what the
    // shop header has claimed since the day it was written
    // Exactly the thirteen words a player does not start with and is not
    // handed by a fragment. Every one needs an object or the word has no
    // source at all: the flat 30-coin list this replaced covered all
    // thirteen, so anything missed here is a word deleted from the game.
    writ_eat:    { n: 'A Butcher\'s Tally', tag: 'writ', cost: 26, writ: 'eat',
        d: 'EAT, and then a column of numbers that stop partway down the ninth year.' },
    writ_wheat:  { n: 'A Flour Scoop', tag: 'writ', cost: 30, writ: 'wheat',
        d: 'WHEAT scratched round the handle where a thumb would sit.' },
    writ_night:  { n: 'A Shutter Slat', tag: 'writ', cost: 30, writ: 'night',
        d: 'NIGHT cut into the inside face, where it would only ever be read from indoors.' },
    writ_right:  { n: 'A Warrant Corner', tag: 'writ', cost: 34, writ: 'right',
        d: 'RIGHT, in a clerk\'s hand, on the only corner of the page that did not burn.' },
    writ_heard:  { n: 'A Vestry Ledger Page', tag: 'writ', cost: 34, writ: 'heard',
        d: 'HEARD, in the middle of a list of who paid for candles in a year nobody can read.' },
    writ_bird:   { n: 'A Cage Door', tag: 'writ', cost: 34, writ: 'bird',
        d: 'BIRD, scratched on the inside. On the inside, where the bird was.' },
    writ_third:  { n: 'A Prompt Card', tag: 'writ', cost: 36, writ: 'third',
        d: 'THIRD, and under it "wait for the hall to go quiet". Somebody has crossed that out.' },
    writ_mark:   { n: 'A Fence Post Chip', tag: 'writ', cost: 38, writ: 'mark',
        d: 'MARK, cut deep, on a chip of post from out past the fence. She does not say who brought it in.' },
    writ_spark:  { n: 'A Flint Wrap', tag: 'writ', cost: 38, writ: 'spark',
        d: 'SPARK, on the rag the flint was wrapped in, in something that is not ink.' },
    writ_stark:  { n: 'A Surveyor\'s Peg', tag: 'writ', cost: 40, writ: 'stark',
        d: 'STARK, burnt in, on a peg from a field that has not been worked since.' },
    writ_sill:   { n: 'A Window Board', tag: 'writ', cost: 40, writ: 'sill',
        d: 'SILL, written where the lamp would stand, so it would be under the lamp every year.' },
    writ_still:  { n: 'A Bell Rope End', tag: 'writ', cost: 42, writ: 'still',
        d: 'STILL, inked onto the frayed end. The rope was cut, not worn through.' },
    writ_chill:  { n: 'A Milk Pail Base', tag: 'writ', cost: 42, writ: 'chill',
        d: 'CHILL, punched into the tin from the inside, one letter at a time.' },
    // loot, not stock
    scrap: {
        n: 'A Misremembered Line', tag: 'use',
        // used to say "occasionally one has a word on the back", which sent
        // the player reading scrap after scrap for a payoff that is not on
        // this item: the word comes up as its own object in the drop table.
        d: 'A scrap of somebody else\'s memory of the play, in the wrong metre. Nothing on the back of this one. The chandler buys them anyway.',
        sell: 6,
        use: function () { return 'You read it through. It does not scan. Whoever remembered it was remembering something they had only ever heard.'; }
    }
};
var ITEM_IDS = Object.keys(ITEMS);
function writForWord(w) { for (var i = 0; i < ITEM_IDS.length; i++) if (ITEMS[ITEM_IDS[i]].writ === w) return ITEM_IDS[i]; return null; }

/* ─────────────── save ─────────────── */
var S = null;
function sLoad() {
    if (S) return;
    try { S = JSON.parse(localStorage.getItem('comp_ninth') || 'null'); } catch (e) { S = null; }
    if (!S) S = {};
    // saves written before places existed carried S.scene instead
    if (!S.place && S.scene) {
        S.place = { prologue: 'stage', wick: 'square', mill: 'mill', yard: 'lane', loft: 'loft', quiet: 'mill', arena: 'arena' }[S.scene] || 'square';
        delete S.scene;
    }
    S.place = S.place || 'stage';
    S.heard = S.heard || {};        // refrain / child / busker / shepherd — understanding, not loot
    S.fams = S.fams || { eat: 1, ight: 1 };          // the town's version is your starting kit
    S.frags = S.frags || {};
    S.stanzas = S.stanzas || {};
    S.verse = S.verse || 0;                          // R stays dark for the entire game
    S.owned = S.owned || { heat: 1, street: 1, light: 1, sight: 1 };
    // The two slotted words are gone: the line deals them now. They are kept
    // read-only so an old save still knows which sounds it had opened, and
    // so anything that has not been converted yet does not read undefined.
    S.call = WORDS[S.call] ? S.call : 'heat';
    S.answer = WORDS[S.answer] ? S.answer : 'street';
    S.poems = S.poems || {};        // the last thing you said in each place, kept
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
    if (S.opts.vol == null) S.opts.vol = 0.7;        // the taskbar slider writes this
    if (S.opts.bigtext == null) S.opts.bigtext = true;
    S.tune = S.tune || {};                           // dev-menu overrides, persisted so tuning survives a reload
    S.combat = S.combat || {};                       // job 4: { met: {kind:1} } — who you have actually faced
    S.combat.met = S.combat.met || {};
    // a save from before this existed has met nobody, and the loft refuses to
    // put the Chorus back once it is down, so the roster would be permanently
    // one short. You were there. Backfill it.
    if (S.seen && S.seen.chorusDown) S.combat.met.chorus = 1;
    // the mask is yours already: you wore it in the prologue
    S.items = S.items || { inv: { mask: 1 }, lamps: {}, wearing: 0 };
    if (!S.items.inv) S.items.inv = {}; if (!S.items.lamps) S.items.lamps = {};
    if (S.items.wearing == null) S.items.wearing = 0;
    S.a3 = S.a3 || {};                               // job 1: read, ending, verseSpent
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
    // the dev arena is explicitly a place where nothing means anything. It was
    // also the only unbounded coin faucet in the game: story play left you
    // short and ten minutes of arena left you rich.
    if (n > 0 && RT && RT.place === 'arena') return;
    S.coin = Math.max(0, S.coin + n);
    if (n > 0) sfx('coin');                 // also when x is null: a wave reward is still money
    if (n > 0 && x != null) typo(x, y, '+' + n, '#ffe66e', 0.7, 13, 'drift');
    sSave();   // every other coin source used to ride on foeDie saving right after
}
function buyCharm(id) {
    // `own` means given, not sold. The crown costs 0, and the silence
    // ending takes it away: without this you buy it straight back.
    var c = CHARMS[id]; if (!c || S.charms[id] || c.own) return false;
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
    say('The chandler pays <b>' + c.sell + '</b> coin for a piece of stage furniture and looks pleased with herself.', 'good');
    return true;
}
function wearCharm(id) {
    if (!S.charms[id]) return;
    var i = S.worn.indexOf(id);
    if (i >= 0) { S.worn.splice(i, 1); say('You put <b>' + esc(CHARMS[id].n) + '</b> away.', 'dim'); }
    else {
        // this used to evict the oldest worn charm in silence, so a player
        // reading through their charms quietly unequipped things
        if (S.worn.length >= 2) {
            var off = S.worn.shift();
            say('You take off <b>' + esc(CHARMS[off].n) + '</b> to make room for <b>' + esc(CHARMS[id].n) + '</b>.', 'dim');
        } else say('You put on <b>' + esc(CHARMS[id].n) + '</b>.', 'good');
        S.worn.push(id);
    }
    sSave();
}
function learnWord(w) {
    if (!WORDS[w] || S.owned[w]) return false;
    S.owned[w] = 1; sSave();
    if (RT) fillLine(true);            // it is in your mouth by the next draw
    say('You have the word <b style="color:' + FAMS[WORDS[w]].col + '">' + esc(w.toUpperCase()) + '</b>.', 'good');
    return true;
}

/* ─────────────── the bag ───────────────
   Counts keyed by item id. Everything goes through these four so
   there is one place that saves and one place that can refuse. */
function inv() { return S.items.inv; }
function itemCount(id) { return inv()[id] || 0; }
function hasItem(id) { return itemCount(id) > 0; }
function giveItem(id, n) {
    if (!ITEMS[id]) { if (window.console) console.warn('NINTH: giveItem("' + id + '") is not in ITEMS'); return false; }
    // there is one coal, one mask and one slate. Nothing consumes them, so a
    // second copy is dead weight in the bag forever. The boss can be respawned
    // from the dev menu and would otherwise hand out a coal every time.
    if (ITEMS[id].one && hasItem(id)) return false;
    n = n || 1;
    inv()[id] = itemCount(id) + n;
    sSave();
    return true;
}
function takeItem(id, n) {
    n = n || 1;
    if (itemCount(id) < n) return false;
    inv()[id] -= n;
    if (inv()[id] <= 0) delete inv()[id];
    sSave();
    return true;
}
/* Using a thing. `use` returns the line to say, or `{ no: 'reason' }` to
   refuse: the item stays in the bag, nothing is spent, and the player is
   told why rather than getting a flat "not here". */
function useItem(id) {
    var it = ITEMS[id];
    if (!it || !hasItem(id)) return false;
    if (it.writ) return readWrit(id);
    var msg = it.use ? it.use() : false;
    if (msg && msg.no) { say(msg.no, 'dim'); sfx('ui'); return false; }
    if (msg === false) { say('Not now.', 'dim'); sfx('ui'); return false; }
    if (!it.keep) takeItem(id, 1);
    say(msg, 'big');
    sfx('use');
    fillBag();
    return true;
}
/* Reading the word off the thing it was written on. The object is
   spent: the writing is the only copy and now it is in your head. */
function readWrit(id) {
    var it = ITEMS[id];
    if (!famOwned(WORDS[it.writ])) {
        say('You can read it. <b>' + esc(it.writ.toUpperCase()) + '</b>. It does not sound like anything you know how to say yet.', 'dim');
        return false;
    }
    if (S.owned[it.writ]) { say('You already have that one.', 'dim'); return false; }
    if (!learnWord(it.writ)) return false;            // spend the object only once the word has landed
    takeItem(id, 1);
    sfx('learn');
    fillBag();
    return true;
}
/* The lamp. You can set it down, which means you can set it down in
   the wrong place, which is the only reason it is an item. */
function setLamp() {
    var here = RT.place, p = place();
    if (S.items.lamps[here]) {
        delete S.items.lamps[here]; giveItem('lamp'); sSave(); fillBag();
        return 'You pick the lamp back up. The sill is bare again.';
    }
    // the lamp is a `keep` item so useItem will not spend it for us, and
    // setting one down has to actually cost you the lamp or you have as
    // many as you have sills
    if (!takeItem('lamp', 1)) return false;
    S.items.lamps[here] = 1; sSave();
    if (here === 'mark') {
        // past the fence. Nobody has ever set out a second lamp, and
        // nobody has ever set one out here.
        return 'You set it down on the marker stone, out past the fence, for somebody the town does not set lamps out for. It burns exactly as well here as it does on a sill.';
    }
    if (here === 'square') return 'You set it on a sill with all the others. It looks like all the others.';
    return 'You set the lamp down. It throws about a yard of light and the rest of it stays dark.';
}
/* lamps left in OTHER places. Counting the one on the sill in this room made
   the bag say "1 set down elsewhere" directly above the row offering to take
   it back off the sill here. */
function lampsElsewhere() {
    return Object.keys(S.items.lamps).filter(function (p) { return !RT || p !== RT.place; });
}
function lampsOut() { return lampsElsewhere().length; }
/* a lamp you left here, retrieved when you are carrying none: without this
   the bag shows no lamp row at all and the one on the sill is unreachable */
function takeLamp() {
    if (!RT) return false;
    if (!S.items.lamps[RT.place]) { say('There is no lamp of yours here.', 'dim'); return false; }
    delete S.items.lamps[RT.place];
    giveItem('lamp');
    say('You take the lamp back off the sill.', 'dim');
    sfx('use'); fillBag();
    return true;
}

/* ─────────────── loot ───────────────
   Coin out of a dead mouth was placeholder. Hearsay is a
   misremembering of a song, so what it leaves behind is a scrap of
   one, and once in a while the scrap has a word on the back. */
function dropLoot(f) {
    if (RT.place === 'arena') return;                  // dev arena rewards nothing
    var k = f.kind, r = Math.random();
    if (f.def.boss) {
        // giveItem refuses a second coal, so only narrate one that landed
        if (giveItem('coal')) {
            typo(f.x, f.y, 'a coal', '#ffb14e', 1.1, 12, 'drift');
            say('Something falls out of the noise and hits the boards. A coal, burnt through, cold. It has been up here a long time.', 'big');
        }
        return;
    }
    var chance = k === 'mouth' ? 0.5 : k === 'thief' ? 0.4 : k === 'sword' ? 0.9 : 0.3;
    if (r > chance) return;
    // an unlearned word you can actually read comes up rarely, and only
    // ever in a family you have already opened
    var open = [];
    FAM_IDS.forEach(function (fid) {
        if (!famOwned(fid)) return;
        // not one you are already carrying: a second copy cannot be read (the
        // first read teaches the word) and writs have no sell, so it would sit
        // in the bag forever with a button that always refuses
        FAMS[fid].words.forEach(function (w) {
            var id = writForWord(w);
            if (!S.owned[w] && id && !hasItem(id)) open.push(w);
        });
    });
    if (open.length && Math.random() < 0.16) {
        var id = writForWord(pick(open));
        giveItem(id);
        typo(f.x, f.y, 'something written', '#8a6ad0', 1.1, 11, 'drift');
        say('It leaves something behind with writing on it. <b>' + esc(ITEMS[id].n) + '</b>.', 'good');
        return;
    }
    giveItem('scrap');
    typo(f.x, f.y, 'a scrap', '#8a8296', 0.9, 10, 'drift');
}
/* ─────────────── stake ───────────────
   Dying used to cost 2.2 seconds and nothing else. It should not be
   punishing, this is not that kind of game, but it should cost
   something, and coin is the thing the game already counts. */
function deathToll() {
    if (RT.place === 'arena') return;                  // the arena pays nothing, so it takes nothing
    var lost = Math.floor(S.coin * 0.15);
    if (lost <= 0) return;
    coin(-lost);
    say('You come round with your pockets lighter by <b>' + lost + '</b>. Somebody was very quick about it.', 'dim');
}

/* the third fragment is the one that sends you back to the text */
function fragAllThree() {
    if (fragCount() !== 3 || S.a3.told) return;
    S.a3.told = 1; sSave();
    beat(2.4, function () { say('You have all of it. <b>Read it from the top.</b>', 'good'); });
}
function grantFragment(n) {
    var map = { 1: ['erd', 'word'], 2: ['ark', 'dark'], 3: ['ill', 'will'] };
    var f = map[n]; if (!f || S.frags[n]) return;
    S.frags[n] = 1; S.fams[f[0]] = 1; S.owned[f[1]] = 1; S.stanzas[n] = 1;
    if (RT) { fillLine(true); updateHud(0); }      // a new sound, and the words that carry it
    if (n === 1) ach('frag1');
    sSave();
    sfx('frag');
    bigLine('FRAGMENT ' + ['I', 'II', 'III'][n - 1], f[1].toUpperCase(), FAMS[f[0]].col);
    fragAllThree();
    say('The line closes. <b style="color:' + FAMS[f[0]].col + '">' + f[1].toUpperCase() + '</b> is yours, and so is Stanza ' + ['I', 'II', 'III'][n - 1] + '.', 'good');
}

/* ─────────────── achievements ─────────────── */
function ach(id) {
    if (!S || S.ach[id]) return;
    var a = null; ACH.forEach(function (x) { if (x[0] === id) a = x; });
    // an id that is not in ACH used to set the save flag anyway, so when
    // somebody added the entry later it was already unlocked, silently,
    // with no toast. Refuse the unknown id instead.
    if (!a) { if (window.console) console.warn('NINTH: ach("' + id + '") is not in ACH'); return; }
    S.ach[id] = 1; sSave();
    if (RT) { RT.toasts.push({ t: 3.4, n: a[1], d: a[2] }); sfx('ach'); }
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
        '<div class="nn-dlg" hidden><b class="nn-dlg-who"></b><p class="nn-dlg-tx"></p><div class="nn-dlg-opts" hidden></div><i class="nn-dlg-more"></i></div>' +

        // bottom: breath, the two slotted words, the stanza bar
        '<div class="nn-hud">' +
          '<div class="nn-left">' +
            '<div class="nn-breath"><i></i><em></em><span class="nn-breath-t"></span></div>' +
            '<div class="nn-echo"><i></i><span>ECHO</span></div>' +
          '</div>' +
          '<div class="nn-mid">' +
            '<div class="nn-hand" title="LMB says it · RMB swallows it"></div>' +
            '<div class="nn-rhymes"></div>' +
          '</div>' +
          '<div class="nn-stanzas">' +
            '<button class="nn-st" data-nn="stanza:1" type="button"><b>Z</b><i>Stanza I</i></button>' +
            '<button class="nn-st" data-nn="stanza:2" type="button"><b>X</b><i>Stanza II</i></button>' +
            '<button class="nn-st" data-nn="stanza:3" type="button"><b>C</b><i>Stanza III</i></button>' +
            '<button class="nn-st nn-verse" data-nn="verse" type="button" disabled><b>R</b><i>Verse</i></button>' +
          '</div>' +
        '</div>' +

        // panels
        '<div class="nn-panel nn-p-book" hidden><header>THE PLAY<button class="nn-x" type="button">×</button></header><div class="nn-pb"></div></div>' +
        '<div class="nn-panel nn-p-kit" hidden><header>WORDS &amp; CHARMS<button class="nn-x" type="button">×</button></header><div class="nn-pb"></div></div>' +
        '<div class="nn-panel nn-p-shop" hidden><header>THE CHANDLER<span class="nn-shop-coin"></span><button class="nn-x" type="button">×</button></header><div class="nn-pb"></div></div>' +
        '<div class="nn-panel nn-p-bag" hidden><header>WHAT YOU CARRY<span class="nn-bag-coin"></span><button class="nn-x" type="button">×</button></header><div class="nn-pb"></div></div>' +

        // dev menu — the whole point of the ask. populated from DEV below.
        '<div class="nn-dev" hidden><header>DEV MENU<i>`</i><button class="nn-x" type="button">×</button></header>' +
          '<div class="nn-dev-tabs"></div><div class="nn-dev-body"></div>' +
          '<div class="nn-dev-foot"></div></div>' +

        '<div class="nn-btns">' +
          '<button class="nn-b" data-nn="p:book" type="button" title="The play (B)">B</button>' +
          '<button class="nn-b" data-nn="p:kit" type="button" title="Your words &amp; charms (K)">K</button>' +
          '<button class="nn-b" data-nn="p:bag" type="button" title="What you carry (I)">I</button>' +
          '<button class="nn-b" data-nn="p:shop" type="button" title="The chandler (V)">V</button>' +
          '<button class="nn-b" data-nn="dev" type="button" title="Dev menu (`)">`</button>' +
        '</div>' +
        '<div class="nn-tip" hidden></div>' +
        '<div class="nn-vig"></div>' +
    '</div>';
}

/* Start over, properly. Wiping the save is only half of it: the save
   holds the story, and the runtime holds the run. `gotoPlace` clears
   foes and breath and the wave, but Echo and the cheat switches are per
   session and it never touches them, so the old button dropped you into
   the prologue with a full Verse meter and, if you had been testing with
   it, still invincible. */
function resetGame() {
    try { localStorage.removeItem('comp_ninth'); } catch (e) {}
    S = null; sLoad();
    RT.echo = 0; RT.dash = 0; RT.pressure = 0;
    RT.god = 0; RT.infBreath = 0; RT.holdStacks = 0; RT.a3Hold = 0; RT.oneShot = 0;
    RT.panel = null; RT.mapOpen = false; RT.prompt = null;
    RT.story = { cue: 0, holding: 0, tries: 0, waitT: 0, done: 0, sawCall: 0, sawAnswer: 0, callMark: 0, answerMark: 0 };
    // the mouth starts over too. Without this the gotoPlace below runs the
    // place-change reset, which stashes the pre-wipe poem into the new save,
    // and the head card survives as a word from a sound you no longer own.
    RT.line = []; RT.bag = null; RT.lastSaidFam = null; RT.lastRhyme = null;
    RT.poem = null; RT.poemPlace = null;
    if (RT.items) { RT.items.freeSlant = 0; RT.items.tack = 0; RT.items.atShop = false; }
    RT.root.querySelectorAll('.nn-panel').forEach(function (p) { p.hidden = true; });
    // and close the menu you pressed it in. The prologue is a timed
    // sequence that starts on the next frame and walks itself into the
    // square about thirteen seconds later: leave the dev panel up over the
    // top of it and the whole opening plays to nobody, which reads exactly
    // like the button having done nothing at all.
    if (RT.devOpen) toggleDev();
    gotoPlace('stage', true);
    refreshStanzaKeys();          // the options went back to their defaults with everything else
    updateHud(0);
}
/* ─────────────── dev menu data ───────────────
   Adding a control later is ONE line in here. That is the point:
   this thing is meant to grow with the game.
     btn    — do a thing
     tgl    — boolean, get/set
     num    — live number with -/+ and a readout (combat feel)
     pick   — choose one of a list
     note   — a line of text */
var wipeArmed = 0;              // one click arms it, the next one means it
var DEV = [
  { tab: 'STORY', rows: function () {
      var rows = [{ k: 'note', t: 'The ninth night. Any beat, any ending, in two clicks.' }];
      rows.push({ k: 'note', t: 'ending so far: ' + (S.a3.ending || 'not yet') + '   verse: ' + (S.verse ? 'lit' : 'dark') });
      rows.push({ k: 'btn', t: 'Give all three fragments', on: function () { for (var n = 1; n <= 3; n++) grantFragment(n); } });
      rows.push({ k: 'btn', t: 'Open the steps (skip Bern)', on: function () { S.a3.read = 1; S.seen.a3ready = 1; sSave(); } });
      // replaying has to give the Verse back too. Leave verseSpent set and
      // the replayed true ending lights R onto a key that refuses it, in a
      // place with no exits.
      rows.push({ k: 'btn', t: 'Run the performance from the top', on: function () { toggleDev(); a3Rewind(); gotoPlace('a3sq', true); } });
      rows.push({ k: 'btn', t: 'Jump to the last cue', on: function () {
          toggleDev(); a3Rewind(); gotoPlace('a3sq', true);
          RT.beats = []; RT.story = { cue: 0, holding: 0, tries: 0, waitT: 0, done: 0, sawCall: 0, sawAnswer: 0,
                                      callMark: RT.nCalls, answerMark: RT.nAnswers };
          a3Crowd(); a3Mark(); a3CueLast(); a3Watch();
      } });
      ['written', 'true', 'silence'].forEach(function (e) {
          rows.push({ k: 'btn', t: 'Force ending: ' + e, on: function () {
              // unconditional reset. Pressed while an ending was already
              // running, the old version left the first ending's beats
              // queued and ran two credit rolls over each other.
              toggleDev();
              a3Rewind();
              gotoPlace('a3sq', true);
              RT.beats = []; a3Crowd(); a3Mark();
              RT.story = { cue: 3, holding: 0, tries: 0, waitT: 0, done: 0, sawCall: 0, sawAnswer: 0,
                           callMark: RT.nCalls, answerMark: RT.nAnswers };
              a3End(e);
          } });
      });
      rows.push({ k: 'btn', t: 'Light R by hand', on: function () { S.verse = 1; delete S.a3.verseSpent; sSave(); updateHud(0); } });
      rows.push({ k: 'btn', t: 'Wipe the ending (replay it)', danger: 1, on: function () { a3Rewind(); delete S.a3.told; } });
      return rows;
  } },
  { tab: 'WORLD', rows: function () {
      var rows = [{ k: 'note', t: 'Walk anywhere. Scripts replay from the top.' }];
      PLACE_IDS.forEach(function (id) {
          rows.push({ k: 'btn', t: PLACES[id].n, sub: PLACES[id].sub, on: function () { gotoPlace(id, true); } });
      });
      rows.push({ k: 'btn', t: 'Replay this place script', on: function () { var p = place(); if (p.script) delete S.seen[p.script + 'Intro']; gotoPlace(RT.place, true); } });
      rows.push({ k: 'btn', t: 'Open every exit (ignore gates)', on: function () { S.seen.rehearsed = 1; S.seen.openAll = 1; sSave(); } });
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
      // the same six, wearing a modifier. auto-enumerated, so a new one is free.
      rows.push({ k: 'note', t: 'Elites: the same archetype, bent. Spawns at the cursor.' });
      MOD_IDS.forEach(function (mid) {
          rows.push({ k: 'btn', t: MODS[mid].n + ' (roll archetype)', sub: MODS[mid].d,
              on: function () { spawnFoe(pick(['mouth', 'thief', 'droner', 'deaf']), RT.mouse.wx, RT.mouse.wy, mid); } });
      });
      rows.push({ k: 'note', t: 'Authored encounters, dropped around you.' });
      rows.push({ k: 'btn', t: 'Next wave for this place', sub: 'walks the ladder in ENCOUNTERS',
          on: function () { RT.combat.encI = (RT.combat.encI || 0) + 1; spawnWave(encounterFor(RT.place, RT.combat.encI - 1), RT.px, RT.py); } });
      rows.push({ k: 'btn', t: 'The whole cast, at once', sub: 'one of everything, for reading them side by side',
          on: function () { spawnWave({ w: [['mouth', 1], ['thief', 1], ['droner', 1], ['deaf', 1], ['sword', 1]] }, RT.px, RT.py, [3.5, 6]); } });
      rows.push({ k: 'btn', t: 'Kill everything', on: function () { RT.foes.forEach(function (f) { if (!f.dead) foeDie(f, true); }); } });
      rows.push({ k: 'btn', t: 'Clear the arena (no rewards)', on: function () { RT.foes.length = 0; RT.fproj.length = 0; } });
      rows.push({ k: 'num', t: 'Enemy HP multiplier', get: function () { return T('ttk'); }, set: function (v) { S.tune.ttk = clamp(v, 0.1, 10); }, step: 0.25, fix: 2 });
      rows.push({ k: 'num', t: 'Elite roll chance', get: function () { return T('eliteChance'); }, set: function (v) { S.tune.eliteChance = clamp(v, 0, 1); }, step: 0.05, fix: 2 });
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
      /* job 4: every number this job added, and the four that never had a row */
      { k: 'note', t: 'What you fight.' },
      { k: 'num', t: 'Deaf damage taken (not -ill)', get: function () { return T('deafMul'); }, set: function (v) { S.tune.deafMul = clamp(v, 0, 1); }, step: 0.05, fix: 2 },
      { k: 'num', t: 'Elite HP multiplier (on top of the modifier)', get: function () { return T('eliteHp'); }, set: function (v) { S.tune.eliteHp = clamp(v, 0.2, 6); }, step: 0.1, fix: 2 },
      { k: 'num', t: 'Elite bonus coin', get: function () { return T('eliteCoin'); }, set: function (v) { S.tune.eliteCoin = clamp(v, 0, 50); }, step: 1 },
      { k: 'num', t: 'Reprise cost (echo)', get: function () { return T('repriseCost'); }, set: function (v) { S.tune.repriseCost = clamp(v, 10, 100); }, step: 5 },
      { k: 'num', t: 'Reprise hits', get: function () { return T('repriseHits'); }, set: function (v) { S.tune.repriseHits = clamp(v, 1, 8); }, step: 1 },
      { k: 'num', t: 'Reprise damage x', get: function () { return T('repriseMul'); }, set: function (v) { S.tune.repriseMul = clamp(v, 0.1, 3); }, step: 0.05, fix: 2 },
      { k: 'num', t: 'Reprise gap between beats (s)', get: function () { return T('repriseGap'); }, set: function (v) { S.tune.repriseGap = clamp(v, 0.05, 2); }, step: 0.02, fix: 2 },
      { k: 'tgl', t: 'Droner stacks hurt YOU when they lapse', get: function () { return !!T('droneSelfHurt'); }, set: function (v) { S.tune.droneSelfHurt = v ? 1 : 0; sSave(); } },
      { k: 'num', t: 'Line size (words dealt)', get: function () { return T('lineSize'); }, set: function (v) { S.tune.lineSize = clamp(Math.round(v), 1, 8); if (RT) fillLine(true); }, step: 1 },
      { k: 'num', t: 'Swallow cost (breath)', get: function () { return T('swallowCost'); }, set: function (v) { S.tune.swallowCost = clamp(v, 0, 40); }, step: 1 },
      { k: 'num', t: 'Swallow cooldown (s)', get: function () { return T('swallowCd'); }, set: function (v) { S.tune.swallowCd = clamp(v, 0, 2); }, step: 0.02, fix: 2 },
      { k: 'num', t: 'Couplet extra stacks', get: function () { return T('coupletStacks'); }, set: function (v) { S.tune.coupletStacks = clamp(Math.round(v), 0, 4); }, step: 1 },
      { k: 'num', t: 'Couplet extra damage x', get: function () { return T('coupletDmg'); }, set: function (v) { S.tune.coupletDmg = clamp(v, 0, 3); }, step: 0.05, fix: 2 },
      { k: 'tgl', t: 'Slant drags stacks to its sound', get: function () { return !!T('slantShift'); }, set: function (v) { S.tune.slantShift = v ? 1 : 0; } },
      { k: 'num', t: 'Echo per stack', get: function () { return T('echoPerStack'); }, set: function (v) { S.tune.echoPerStack = clamp(v, 0, 50); }, step: 1 },
      { k: 'num', t: 'Echo decay / s', get: function () { return T('echoDecay'); }, set: function (v) { S.tune.echoDecay = clamp(v, 0, 40); }, step: 0.5, fix: 1 },
      { k: 'num', t: 'Call range', get: function () { return T('callRange'); }, set: function (v) { S.tune.callRange = clamp(v, 1, 30); }, step: 0.5, fix: 1 },
      { k: 'num', t: 'Echo lost per sour stack', get: function () { return T('echoBreak'); }, set: function (v) { S.tune.echoBreak = clamp(v, 0, 50); }, step: 1 },
      { k: 'num', t: 'Stanza dilation length (s)', get: function () { return T('dilationT'); }, set: function (v) { S.tune.dilationT = clamp(v, 0.2, 6); }, step: 0.1, fix: 1 },
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
      rows.push({ k: 'num', t: 'Coin', get: function () { return S.coin; }, set: function (v) { S.coin = Math.max(0, Math.round(v)); sSave(); }, step: 25 });
      rows.push({ k: 'note', t: 'What you carry. Items are objects: usable, giveable, losable.' });
      rows.push({ k: 'btn', t: 'Grant one of everything', on: function () { ITEM_IDS.forEach(function (id) { giveItem(id); }); } });
      ITEM_IDS.forEach(function (id) {
          rows.push({ k: 'btn', t: ITEMS[id].n + (itemCount(id) ? ' (' + itemCount(id) + ')' : ''), sub: ITEMS[id].writ ? 'writes ' + ITEMS[id].writ.toUpperCase() : ITEMS[id].tag, on: function () { giveItem(id); } });
      });
      rows.push({ k: 'btn', t: 'Clear the bag', danger: 1, on: function () { S.items.inv = {}; S.items.lamps = {}; S.items.wearing = 0; if (RT) { RT.items.freeSlant = 0; RT.items.tack = 0; } sSave(); } });
      rows.push({ k: 'btn', danger: 1, wipe: 1,
          t: wipeArmed ? 'Wipe save — click again to confirm' : 'Wipe save (reset everything, start over)',
          sub: wipeArmed ? 'story, words, charms, coin, achievements and cheats. Any other control backs out.'
                         : 'back to the prologue with nothing, as if you had never opened it',
          on: function () {
              if (!wipeArmed) { wipeArmed = 1; return; }   // it is one click from losing a real playthrough
              wipeArmed = 0; resetGame();
          } });
      return rows;
  } },
  { tab: 'CHEAT', rows: function () { return [
      { k: 'tgl', t: 'God mode', get: function () { return !!RT.god; }, set: function (v) { RT.god = v; } },
      { k: 'tgl', t: 'Infinite breath', get: function () { return !!RT.infBreath; }, set: function (v) { RT.infBreath = v; } },
      { k: 'tgl', t: 'Stacks never decay', get: function () { return !!RT.holdStacks; }, set: function (v) { RT.holdStacks = v; } },
      { k: 'tgl', t: 'One-shot everything', get: function () { return !!RT.oneShot; }, set: function (v) { RT.oneShot = v; } },
      { k: 'btn', t: 'Fill breath', on: function () { RT.breath = stats().breathMax; RT.winded = 0; } },
      { k: 'btn', t: 'Fill echo', on: function () { RT.echo = T('echoMax'); } },
      { k: 'btn', t: 'Redeal the line', on: function () { RT.line = []; fillLine(true); updateHud(0); } },
      { k: 'btn', t: 'Read back the poem so far', on: function () { toggleDev(); poemClose(); } },
      { k: 'btn', t: 'Forget every poem', danger: 1, on: function () { S.poems = {}; poemStart(); sSave(); } },
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
      { k: 'tgl', t: 'WASD movement (left click always says the word)', get: function () { return !!S.opts.wasd; }, set: function (v) { S.opts.wasd = v; sSave(); refreshStanzaKeys(); } },
      { k: 'note', t: 'Combat may only ever show single words. If you want the player to read a line, it should not be a fight.' },
      /* ── sound. Appended at the tail of DEBUG rather than taking a tab:
            seven tabs fit across 560px and an eighth does not. ── */
      { k: 'note', t: 'SOUND · ctx ' + (RT.ac ? RT.ac.state : 'none') + ' · rig ' + (RT.audio.ready ? 'up' : 'down') +
            ' · errors ' + RT.audio.errs + (RT.audio.lastErr ? ' · last: ' + RT.audio.lastErr : '') },
      { k: 'num', t: 'Volume', get: function () { return volNow(); }, set: function (v) { audioVolume(v); }, step: 0.05, fix: 2 },
      { k: 'num', t: 'Test sound: ' + SFX_NAMES[(RT.audio.testI || 0) % SFX_NAMES.length],
        get: function () { return RT.audio.testI || 0; },
        set: function (v) { RT.audio.testI = ((Math.round(v) % SFX_NAMES.length) + SFX_NAMES.length) % SFX_NAMES.length; }, step: 1 },
      { k: 'btn', t: 'Play that sound', sub: 'the whole chain, by name', on: function () { sfx(SFX_NAMES[(RT.audio.testI || 0) % SFX_NAMES.length]); } },
      { k: 'tgl', t: 'Solo voice (the player\'s mouth)', get: function () { return RT.audio.solo === 'voice'; }, set: function (v) { audioSolo(v ? 'voice' : ''); } },
      { k: 'tgl', t: 'Solo world', get: function () { return RT.audio.solo === 'world'; }, set: function (v) { audioSolo(v ? 'world' : ''); } },
      { k: 'tgl', t: 'Solo ui', get: function () { return RT.audio.solo === 'ui'; }, set: function (v) { audioSolo(v ? 'ui' : ''); } },
      { k: 'tgl', t: 'Solo music (the ballad)', get: function () { return RT.audio.solo === 'music'; }, set: function (v) { audioSolo(v ? 'music' : ''); } },
      { k: 'btn', t: 'Force context suspend', on: function () { audioSuspend(); } },
      { k: 'btn', t: 'Force context resume', on: function () { audioResume(); } },
      /* the whole tune at singing tempo, both endings, back to back.
         Nothing in play has room for a full stanza (the text is far
         faster), so this is the only way to hear what the reductions
         are reductions OF. */
      { k: 'btn', t: 'Sing a stanza: the town\'s version', sub: 'a note short, stops on the second, never lands',
        on: function () { if (audioRig()) singStanza(RT.ac.currentTime + 0.05, false, { bpm: 108, vol: 0.055, voices: 5, det: 13, type: 'sawtooth', cut: 1600 }); } },
      { k: 'btn', t: 'Sing a stanza: the true version', sub: 'same tune, and the last line walks down to the tonic',
        on: function () { if (audioRig()) singStanza(RT.ac.currentTime + 0.05, true, { bpm: 108, vol: 0.055, voices: 3, det: 7 }); } }
  ]; } }
];

/* ─────────────── the stage floor ───────────────
   Prerendered per scene. Wick is lamplight and cobbles, the mill
   is dirt and chaff, the loft is boards and dark, the prologue is
   a plank stage with footlights and an audience you cannot see. */
/* Bitmaps are the size of the PLACE now, not of the canvas, so a road
   can be longer than one screen. They are also the memory story of the
   game, so the cache is bounded and close() empties it. */
var FLOORS = {}, FLOOR_LRU = [], FLOOR_MAX = 5;
var FLOOR_PAL = {
    stage:  ['#3a2a1c', '#2c1f14', '#4a3524'],
    town:   ['#2a2630', '#211d28', '#37323f'],
    loft:   ['#241c16', '#1a1410', '#332720'],
    mill:   ['#2e2620', '#241d19', '#3b312a'],
    road:   ['#2b2822', '#22201b', '#39342b'],   // packed dirt going north
    hollow: ['#1a1720', '#141119', '#221d2b'],   // the place that is wrong
    room:   ['#33291f', '#281f18', '#443626']    // boards, indoors
};
function floorOf(kind) { return FLOOR_PAL[kind] ? kind : 'mill'; }
function buildFloor(kind, gw, gh) {
    gw = gw || GRID; gh = gh || GRID;
    kind = floorOf(kind);
    var key = kind + gw + 'x' + gh;
    var hit = FLOORS[key];
    if (hit) { touchFloor(key); return hit; }
    var box = placeBox(gw, gh);
    var cv = document.createElement('canvas'); cv.width = box.w; cv.height = box.h;
    var g = cv.getContext('2d');
    var seed = 9; function fr() { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 16777216; }
    var pal = FLOOR_PAL[kind];
    g.fillStyle = '#07060a'; g.fillRect(0, 0, box.w, box.h);
    for (var y = 0; y < gh; y++) for (var x = 0; x < gw; x++) {
        var sx = isoXB(x, y) - box.x, sy = isoYB(x, y) - box.y;
        var edge = Math.min(x, y, gw - 1 - x, gh - 1 - y);
        g.beginPath();
        g.moveTo(sx, sy); g.lineTo(sx + TILE_W / 2, sy + TILE_H / 2);
        g.lineTo(sx, sy + TILE_H); g.lineTo(sx - TILE_W / 2, sy + TILE_H / 2); g.closePath();
        var base = pal[(x + y) % 2 ? 0 : 1];
        g.fillStyle = base; g.fill();
        g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.stroke();
        if ((kind === 'stage' || kind === 'room') && y % 2 === 0) {   // plank seams run one way
            g.strokeStyle = 'rgba(0,0,0,.3)';
            g.beginPath(); g.moveTo(sx - TILE_W / 2, sy + TILE_H / 2); g.lineTo(sx + TILE_W / 2, sy + TILE_H / 2); g.stroke();
        }
        if (fr() < 0.22) { g.fillStyle = pal[2]; g.globalAlpha = 0.35; g.fillRect(sx - 8 + fr() * 16, sy + 8 + fr() * 10, 3 + fr() * 5, 2); g.globalAlpha = 1; }
        if (kind === 'mill' && fr() < 0.14) { g.fillStyle = 'rgba(190,170,110,.3)'; g.fillRect(sx - 6 + fr() * 12, sy + 10 + fr() * 8, 2, 2); }
        if (kind === 'road') {                    // a rut worn up the middle by four hundred years of nobody
            var mid = Math.abs((x - y) - (gw - gh) / 2);
            if (mid < 1.6) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fill(); }
        }
        if (kind === 'hollow' && fr() < 0.3) { g.fillStyle = 'rgba(8,6,14,.5)'; g.fill(); }
        if (edge === 0) { g.fillStyle = 'rgba(4,3,8,.5)'; g.fill(); }
    }
    // a ring of light where the scene wants you to stand
    var cx0 = isoXB(gw / 2, gh / 2) - box.x, cy0 = isoYB(gw / 2, gh / 2) - box.y;
    g.save(); g.translate(cx0, cy0); g.scale(1, 0.5);
    var rg = g.createRadialGradient(0, 0, 20, 0, 0, 330);
    rg.addColorStop(0, kind === 'stage' ? 'rgba(255,190,90,.16)' : 'rgba(255,200,120,.07)');
    rg.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 330, 0, TAU); g.fill(); g.restore();
    // the vignette used to be baked here. With a camera it has to follow
    // the eye, not the ground, so it moved to drawVignette in screen space.
    FLOORS[key] = { cv: cv, box: box };
    touchFloor(key); trimFloors();
    return FLOORS[key];
}
function touchFloor(key) {
    var i = FLOOR_LRU.indexOf(key); if (i >= 0) FLOOR_LRU.splice(i, 1);
    FLOOR_LRU.push(key);
}
function trimFloors() {
    while (FLOOR_LRU.length > FLOOR_MAX) {
        var k = FLOOR_LRU.shift(), f = FLOORS[k];
        if (f) { f.cv.width = f.cv.height = 0; delete FLOORS[k]; }   // drop the backing store, not just the reference
    }
}
function freeFloors() {
    Object.keys(FLOORS).forEach(function (k) { FLOORS[k].cv.width = FLOORS[k].cv.height = 0; delete FLOORS[k]; });
    FLOOR_LRU.length = 0;
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
function bigLine(txt, sub, col, dur, pin) {
    RT.lines.push({ txt: txt, sub: sub || '', col: col || '#f0e9df', t: dur || 2.2, max: dur || 2.2, pin: pin ? 1 : 0, age: 0 });
}
/* the held cue sits in its own slot and does not expire, so it cannot
   reflow when a line under it dies. Nothing else pins. */
function unpin() { RT.lines = RT.lines.filter(function (l) { return !l.pin; }); }
function drawLines(cx, dt) {
    for (var i = RT.lines.length - 1; i >= 0; i--) {
        var L = RT.lines[i], k, a, y;
        if (L.pin) {
            L.age += dt;
            k = clamp(L.age / 0.5, 0, 1); a = 1; y = VH * 0.2;
        } else {
            L.t -= dt;
            if (L.t <= 0) { RT.lines.splice(i, 1); continue; }
            k = 1 - L.t / L.max;
            a = clamp(L.t / 0.5, 0, 1);
            y = VH * 0.3 + i * 44;
        }
        var chars = Math.ceil(L.txt.length * clamp(k / 0.35, 0, 1));      // typewriter in
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
    RT.timers.push(setTimeout(function () {
        if (d.parentNode) { d.classList.add('out'); RT.timers.push(setTimeout(function () { if (d.parentNode) d.remove(); }, 700)); }
    }, 5200));
}

/* ─────────────── runtime ─────────────── */
var RT = null;
/* Extra keybinds register here rather than reopening the chain above.
   The chain wins on conflict, and w/a/s/d must keep falling through to
   `else return` so movement never calls preventDefault. */
var KEYS = {};
function bindKey(k, fn) { KEYS[k.toLowerCase()] = fn; }
// The number row belongs to the rhymes now: they are the verb you press
// most, so they get the best keys. Stanzas are big cooldowns and move to
// the Z row. E is interact in every scheme and always was.
function stanzaKeys() { return ['z', 'x', 'c']; }
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
        callCd: 0, answerCd: 0, swallowCd: 0, conceal: 0, sourN: 0,
        line: [], bag: null, poem: null, lastSaidFam: null, lastRhyme: null, assembly: null,
        place: S.place, wave: 0, waveT: 0, phase: 'idle', pending: [],
        dialog: null, prompt: null, pressure: 0, cleared: false, mapOpen: false,
        shake: 0, chroma: 0, flash: 0, dilate: 0, mono: 0, timeScale: 1,
        stanzaCd: [0, 0, 0], casting: null, recital: null, verseCast: 0,
        toasts: [], panel: null, devTab: 'WORLD', devOpen: false,
        nCalls: 0, nAnswers: 0,          // monotonic: a beat cannot observe RT.calls, see stepScene order
        story: { cue: 0, holding: 0, tries: 0, waitT: 0, done: 0, sawCall: 0, sawAnswer: 0, callMark: 0, answerMark: 0 },
        god: 0, infBreath: 0, holdStacks: 0, a3Hold: 0, oneShot: 0,
        dbgStacks: 0, dbgAI: 0, dbgHit: 0, dbgPerf: 0,
        fps: 0, _fc: 0, _ft: 0, ac: null, tookHit: false,
        audio: { ready: 0, held: 0, errs: 0, lastErr: '', master: null, bus: null, noise: null, amb: null, ambKind: '', evT: 0, stepT: 0.35, solo: '' },
        combat: { cuts: [], rep: null, encI: 0, lull: 0 },
        items: { freeSlant: 0, tack: 0, atShop: false },
        world: { cam: { x: 0, y: 0 }, npc: {}, seenLine: null }
    };
    wireInput(root, cv);
    wireHud(root);
    poemStart();
    fillLine(true);
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
            spawn: function (k, x, y, mod) { return spawnFoe(k, x == null ? GRID / 2 : x, y == null ? GRID / 2 - 3 : y, mod); },
            wave: function (n) { return spawnWave(encounterFor(RT.place, n == null ? RT.wave : n), RT.px, RT.py); },
            reprise: function () { doReprise(); },
            place: function (id) { gotoPlace(id, true); },
            talk: function (id) { var n = NPCS[id]; if (n) openDialog(n.talk(), n.n); },
            interact: function () { RT.prompt = nearestInteract(); doInteract(); },
            slot: function (c, a) { if (c) S.call = c; if (a) S.answer = a; sSave(); updateHud(0); },
            line: function () { return RT.line.slice(); },
            deal: function (w) { if (WORDS[w]) { RT.line.unshift(w); RT.line.length = Math.max(1, Math.round(T('lineSize'))); updateLine(); } return RT.line.slice(); },
            say: function () { doCall(); },
            swallow: function () { doSwallow(); },
            rhyme: function (f) { doRhyme(f); },
            board: function () { var o = {}; FAM_IDS.forEach(function (f) { var n = boardCount(f); if (n) o[f] = n; }); return o; },
            poem: function () { return RT.poem; },
            frag: function (n) { grantFragment(n); },
            sfx: function (k) { sfx(k); return RT.audio.errs; },
            audio: function () { var A = RT.audio; return { ctx: RT.ac ? RT.ac.state : 'none', rig: !!A.ready, vol: volNow(), amb: A.ambKind, solo: A.solo, errs: A.errs, last: A.lastErr, names: SFX_NAMES }; },
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
        var w = screenToWorld(mx, my);          // adds the camera back; do not re-derive it here
        return { x: mx, y: my, wx: w.wx, wy: w.wy };
    }
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // answering a question with the mouse, since the whole world layer is
    // otherwise reachable both ways
    root.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('.nn-opt');
        if (!b || !RT || !RT.dialog) return;
        e.stopPropagation();
        pickDlgOpt(+b.getAttribute('data-opt'));
        root.focus();
    });
    cv.addEventListener('pointermove', function (e) {
        if (!RT) return; var p = toWorld(e);
        RT.mouse.x = p.x; RT.mouse.y = p.y; RT.mouse.wx = p.wx; RT.mouse.wy = p.wy;
    });
    cv.addEventListener('pointerdown', function (e) {
        if (!RT) return; root.focus();
        var p = toWorld(e);
        RT.mouse.x = p.x; RT.mouse.y = p.y; RT.mouse.wx = p.wx; RT.mouse.wy = p.wy;
        if (e.button === 2) { RT.mouse.rdown = true; doSwallow(); }
        else if (e.button === 0) {
            RT.mouse.down = true;
            if (!S.opts.wasd && !e.shiftKey && !foeNear(p.wx, p.wy, 1.2)) RT.moveTo = { x: clamp(p.wx, 0.7, pw() - 0.7), y: clamp(p.wy, 0.7, ph() - 0.7) };
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
        if (k === 'escape') {
            // only eat it if it actually closed something, or the desktop
            // never sees Escape while the game holds focus
            var had = RT.devOpen || RT.mapOpen || RT.dialog || RT.panel;
            if (RT.devOpen) toggleDev(); else if (RT.mapOpen) RT.mapOpen = false;
            else if (RT.dialog) closeDialog(); else if (RT.panel) panel(null);
            if (had) { e.stopPropagation(); e.preventDefault(); }
            return;
        }
        RT.keys[k] = true;
        if (e.repeat) { e.preventDefault(); return; }
        // interact first, always. It used to sit after the stanza chain,
        // which bound E to Stanza II and made the entire world layer
        // unreachable from the keyboard.
        var sk = stanzaKeys(), rk = rhymeKeys().indexOf(k);
        if (k === 'e') doInteract();
        else if (rk >= 0) doRhyme(FAM_IDS[rk]);
        else if (k === sk[0]) doStanza(1);
        else if (k === sk[1]) doStanza(2);
        else if (k === sk[2]) doStanza(3);
        else if (k === 'r') doVerse();
        else if (k === ' ') doDash();
        else if (k === 'm') { if (!RT.dialog) RT.mapOpen = !RT.mapOpen; }
        else if (k === 'b') panel('book');
        else if (k === 'k') panel('kit');
        else if (k === 'v') panel('shop');
        else if (KEYS[k]) { if (KEYS[k]() === false) return; }   // a registered key may decline and let the event through
        else return;
        e.preventDefault(); e.stopPropagation();
    });
    root.addEventListener('keyup', function (e) { if (RT) RT.keys[e.key.toLowerCase()] = false; });
    root.addEventListener('focusout', function (e) {
        if (!RT || (e.relatedTarget && root.contains(e.relatedTarget))) return;
        RT.keys = {}; RT.mouse.down = false; RT.mouse.rdown = false;
    });
}
function foeNear(x, y, r) { return !!RT.foes.filter(function (f) { return !f.dead && !f.def.folk && Math.hypot(f.x - x, f.y - y) < r + f.r; })[0]; }

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
    if (RT.dead || RT.dash > 0 || RT.dialog || RT.mapOpen) return;
    var a = Math.atan2(RT.mouse.wy - RT.py, RT.mouse.wx - RT.px);
    var d = Math.min(Math.hypot(RT.mouse.wx - RT.px, RT.mouse.wy - RT.py), T('dashDist'));
    // walked in steps, not teleported: a dash used to pass clean through
    // fences, beams and house walls whenever the far side happened to be clear
    var steps = Math.max(1, Math.ceil(d / 0.2));
    for (var i = 0; i < steps; i++) moveActor(RT.px + Math.cos(a) * (d / steps), RT.py + Math.sin(a) * (d / steps));
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
    if (RT.hp <= 0) downPlayer();
}
/* going down is not the same as being hit: a stack going sour while
   you have i-frames used to leave you at zero and still standing. */
function downPlayer() {
    if (RT.dead) return;
    RT.hp = 0; RT.dead = true; RT.deadT = 2.2;
    bigLine('you lose your place', '', '#ff5a6a', 2);
    say('You lose your place in the line. Bern would tell you to take it from the top.', 'bad');
    deathToll();                                      // job 5: dying costs coin, not time
    sfx('down');
}
function revive() {
    RT.dead = false; RT.hp = RT.hpm; RT.breath = stats().breathMax; RT.iframe = 1.6;
    RT.px = pw() / 2; RT.py = ph() - 2;
    RT.foes.forEach(function (f) { f.stacks.length = 0; });
    // going down cuts the line off, the same way a doorway does: a reprise
    // must not resume after the respawn and fire its last beats into an
    // empty room, seconds after the line that started it
    if (RT.combat) { RT.combat.rep = null; RT.combat.cuts.length = 0; }
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

/* ═══════════════ THE LINE ═══════════════
   You do not choose your words. You choose your rhymes.

   Every word you own sits in a bag. The line deals you four of them,
   face up: the one on your tongue and three you can see coming. Left
   click says the head word at whatever you are pointing at and sticks
   a syllable of its sound to what it hits. Right click swallows it
   instead, which costs breath and puts a struck-out word in your poem.

   The rhymes are on the number row and they are the part that is
   actually yours. Each one answers every syllable of its own sound on
   the board at once. Which means the board is now a mixture, because
   your words are, and reading it is the game: three -eat on the big
   one, one -ill on the runner, a stray -ark you have not closed yet.

   A shuffled bag rather than a die roll. You see every word you own
   before you see any of them twice, which is the difference between a
   hand you can plan around and a slot machine. */

function poolWords() {
    var out = [];
    for (var w in S.owned) if (S.owned[w] && WORDS[w] && famOwned(WORDS[w])) out.push(w);
    if (!out.length) out.push('heat');            // never deal from nothing
    return out;
}
function refillBag() {
    var q = poolWords();
    for (var i = q.length - 1; i > 0; i--) { var j = irnd(0, i), t = q[i]; q[i] = q[j]; q[j] = t; }
    RT.bag = q;
}
function drawWord(avoid) {
    if (!RT.bag || !RT.bag.length) refillBag();
    // Never deal a word that is already face up, or the one just spat out.
    // The starting bag is four words and the line is four cards, so without
    // this the hand is full of duplicates and a swallow hands you straight
    // back the thing you swallowed. Falls through to a plain draw when the
    // bag genuinely has nothing else, which is the four-word case.
    for (var i = RT.bag.length - 1; i >= 0; i--) {
        var w = RT.bag[i];
        if (w === avoid) continue;
        if (RT.line && RT.line.indexOf(w) >= 0) continue;
        return RT.bag.splice(i, 1)[0];
    }
    return RT.bag.pop();
}
/* `fresh` rebuilds the bag, so a word you just learned is in your mouth
   by the next draw rather than whenever the bag happens to turn over.
   The head word survives it: you do not lose the thing you were about
   to say because you walked past a shop. */
function fillLine(fresh) {
    if (!RT.line) RT.line = [];
    if (fresh) {
        if (RT.line.length > 1) RT.line.length = 1;
        refillBag();
        // whatever is still in your mouth comes out of the new bag, or the
        // reshuffle deals you the word you are already looking at
        RT.line.forEach(function (w) { var i = RT.bag.indexOf(w); if (i >= 0) RT.bag.splice(i, 1); });
    }
    var want = Math.max(1, Math.round(T('lineSize')));
    while (RT.line.length < want) RT.line.push(drawWord());
    if (RT.line.length > want) RT.line.length = want;
}
function headWord() { fillLine(); return RT.line[0]; }

/* ─────────────── the poem ───────────────
   Everything you say goes down. A rhyme ends a line, which is true of
   verse and happens to be exactly true of this game: the detonation IS
   the line break. So the shape of your poem is the shape of how you
   fought, with no scoring rule bolted on top of the play. */
function poemStart() { RT.poem = { lines: [], cur: [], blots: 0 }; RT.poemPlace = RT.place; }
/* Leaving mid-verse does not throw it away. It goes in the book under the
   place you said it, and you start a clean page wherever you turn up. */
function poemStash() {
    if (RT.poem && RT.poem.cur.length) poemBreak(null);
    if (RT.poem && RT.poem.lines.length && RT.poemPlace) { S.poems[RT.poemPlace] = RT.poem; sSave(); }
    poemStart();
}
function poemSay(word, fam, couplet) {
    if (!RT.poem) poemStart();
    RT.poem.cur.push({ w: word, fam: fam, couplet: couplet ? 1 : 0 });
    // Talk long enough without closing anything and it breaks anyway, on
    // nothing. A line that does not end on a sound does not rhyme with
    // anything, which is the correct punishment for rambling.
    if (RT.poem.cur.length >= 8) poemBreak(null);
}
function poemSwallow(word) {
    if (!RT.poem) poemStart();
    RT.poem.blots++;
    RT.poem.cur.push({ w: word, fam: WORDS[word] || null, cut: 1 });
}
function poemBreak(fam) {
    if (!RT.poem || !RT.poem.cur.length) return;
    RT.poem.lines.push({ ws: RT.poem.cur, end: fam || null });
    RT.poem.cur = [];
}
function poemWords(p) {
    var n = 0;
    (p.lines || []).forEach(function (L) { L.ws.forEach(function (w) { if (!w.cut) n++; }); });
    return n;
}
/* Lines ending on the same sound rhyme with each other. Count the
   pairs, count the couplets, dock the crossings out. */
function poemScore(p) {
    var by = {}, pairs = 0, couplets = 0;
    (p.lines || []).forEach(function (L) {
        L.ws.forEach(function (w) { if (w.couplet) couplets++; });
        if (!L.end) return;
        by[L.end] = (by[L.end] || 0) + 1;
    });
    for (var f in by) pairs += Math.floor(by[f] / 2);
    var lines = (p.lines || []).length;
    // rhyming lines are worth most: the couplet already pays you in damage
    // when you say it, so it should not also carry the grade.
    return { pairs: pairs, couplets: couplets, blots: p.blots || 0, lines: lines,
             words: poemWords(p), score: pairs * 4 + couplets - (p.blots || 0) };
}
function poemGrade(sc) {
    if (!sc.lines) return 'nothing at all';
    if (sc.score >= 14) return 'that was a ballad';
    if (sc.score >= 9) return 'nearly a ballad';
    if (sc.score >= 5) return 'a serviceable verse';
    if (sc.score >= 2) return 'doggerel, but it scans';
    if (sc.score >= 0) return 'doggerel';
    return 'you were making noise';
}
/* Rendered the way the book renders the real ballad, so the two can sit
   on the same page and you can see how far off you are. */
function poemHtml(p) {
    if (!p || !(p.lines || []).length) return '<p class="nn-note dim">Nothing yet. Say something.</p>';
    var h = '';
    (p.lines || []).forEach(function (L) {
        h += '<div class="nn-pline">' + L.ws.map(function (w) {
            if (w.cut) return '<s>' + esc(w.w) + '</s>';
            var c = w.fam ? FAMS[w.fam].col : '#8a8296';
            return '<b style="color:' + c + '">' + esc(w.w) + '</b>' + (w.couplet ? '<sup>&middot;</sup>' : '');
        }).join(' ') + '</div>';
    });
    var sc = poemScore(p);
    h += '<p class="nn-note">' + sc.lines + ' lines, ' + sc.pairs + ' rhyming, ' + sc.couplets +
         ' couplet' + (sc.couplets === 1 ? '' : 's') +
         (sc.blots ? ', ' + sc.blots + ' crossed out' : '') + '. <i>' + esc(poemGrade(sc)) + '</i></p>';
    return h;
}
/* Called when a place goes quiet. Says it back at you, a line at a
   time, and keeps it. */
function poemClose() {
    if (!RT.poem) { poemStart(); return; }
    poemBreak(null);
    var p = RT.poem;
    if (!p.lines.length) { poemStart(); return; }
    // the book keeps a page, not a transcript: a long grind in one room
    // would otherwise put hundreds of lines in localStorage forever
    S.poems[RT.place] = { lines: p.lines.slice(-12), blots: p.blots };
    sSave();
    var sc = poemScore(p), shown = p.lines.slice(-4);
    shown.forEach(function (L, i) {
        beat(0.5 + i * 0.9, function () {
            say(L.ws.map(function (w) {
                return w.cut ? '<s>' + esc(w.w) + '</s>' : esc(w.w);
            }).join(' ') + (L.end ? ' <b style="color:' + FAMS[L.end].col + '">' + FAMS[L.end].n + '</b>' : ''), 'dim');
        });
    });
    beat(0.5 + shown.length * 0.9 + 0.6, function () {
        say('<b>' + esc(poemGrade(sc)) + '</b>', sc.score >= 5 ? 'good' : 'dim');
    });
    poemStart();
}

/* ─────────────── CALL ───────────────
   The word itself is the projectile. It flies, it lands, it pops
   small, and it leaves a syllable stuck to whatever it touched. The
   word is whatever the line dealt you. */
function doCall() {
    if (!RT || RT.dead || RT.devOpen || RT.dialog || RT.mapOpen) return;
    if (RT.winded > 0) { hudNudge('breath'); return; }
    if (RT.callCd > 0) return;
    var st = stats();
    if (!spendBreath(st.callCost)) { hudNudge('breath'); return; }
    RT.callCd = 0.19;
    RT.casting = { t: 0.13, max: 0.13 };
    var word = headWord(), fam = WORDS[word] || 'eat';
    var couplet = RT.lastSaidFam === fam;      // two of a sound in a row bites harder
    RT.lastSaidFam = fam;
    RT.line.shift(); fillLine();
    var a = Math.atan2(RT.mouse.wy - RT.py, RT.mouse.wx - RT.px);
    RT.nCalls++;
    RT.calls.push({ x: RT.px + Math.cos(a) * 0.5, y: RT.py + Math.sin(a) * 0.5,
        vx: Math.cos(a) * 13, vy: Math.sin(a) * 13, life: T('callRange') / 13,
        word: word.toUpperCase(), fam: fam, hit: [], couplet: couplet ? 1 : 0 });
    poemSay(word, fam, couplet);
    if (couplet) typo(RT.px, RT.py + 0.5, 'couplet', FAMS[fam].col, 0.6, 10, 'drift');
    ach('firstcall');
    speakPressure();          // saying it out loud is what brings them
    sfx('call');
    updateLine();
}
/* The word you did not want. It costs breath, it goes to the bottom of
   the bag, and it goes into the poem with a line through it, because
   the thing you nearly said is part of what you said. */
function doSwallow() {
    if (!RT || RT.dead || RT.devOpen || RT.dialog || RT.mapOpen || RT.panel) return;
    if (RT.swallowCd > 0) return;
    if (RT.winded > 0) { hudNudge('breath'); return; }
    var word = headWord();
    if (!spendBreath(T('swallowCost'))) { hudNudge('breath'); return; }
    RT.swallowCd = T('swallowCd');
    RT.line.shift();
    RT.line.push(drawWord(word));         // the replacement first, and never the same word
    if (!RT.bag) refillBag();
    RT.bag.unshift(word);                 // then it goes to the bottom, so you get it back
    fillLine();
    poemSwallow(word);
    typo(RT.px, RT.py + 0.3, word.toUpperCase(), '#6a5f72', 0.55, 11, 'drift');
    sfx('empty');
    updateLine();
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
        // bound by the place, not by the old fixed grid: the road north
        // is 34 deep and every call cast on it used to die on frame one
        if (c.life <= 0 || c.x < -1 || c.x > pw() + 1 || c.y < -1 || c.y > ph() + 1) RT.calls.splice(i, 1);
    }
}
/* The Deaf hears nothing, and that has to mean the same thing everywhere:
   it used to be quarter damage from an Answer, fully immune to a Stanza,
   and take Calls at FULL price, which is why the wall you were supposed to
   change your build for died in a second to the starting kit. */
function deafMul(f, fam) { return (f.def.deaf && fam !== 'ill') ? T('deafMul') : 1; }
function landCall(f, c) {
    var st = stats();
    var dmg = st.callDmg * famDmgMul(c.fam) * deafMul(f, c.fam);
    // said two of a sound in a row: the second one bites, and sticks twice
    if (c.couplet) dmg *= 1 + T('coupletDmg');
    if (f.def.deaf && c.fam !== 'ill') typo(f.x, f.y, 'deaf', '#6a5f72', 0.4, 8, 'drift');
    hurtFoe(f, dmg, c.fam, { call: 1 });
    // tier 1: a small word pops at the impact point. deliberately underwhelming.
    typo(f.x, f.y, c.word, FAMS[c.fam].col, 0.5, 13, 'pop');
    burst(f.x, f.y, 26, 5, { col: hex2rgb(FAMS[c.fam].col), sp0: 0.3, sp1: 1.3, l0: 0.15, l1: 0.4 });
    if (!f.dead) {
        addStack(f, c.fam);
        for (var q = 0; q < (c.couplet ? Math.round(T('coupletStacks')) : 0); q++) addStack(f, c.fam);
    }
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
            if (RT.holdStacks || RT.a3Hold) continue;
            var s = f.stacks[j]; s.t -= dt;
            if (s.t <= 0) { f.stacks.splice(j, 1); breakStack(f, s); }
        }
    }
}
/* BREAK — an unfinished line goes sour. this is the mechanical
   statement of Hal's entire condition, and it is what stops you
   spamming call forever. */
function breakStack(f, s) {
    // A sour line is YOUR unfinished line. A Droner's own words are not
    // yours and never were, so they cost you nothing when they lapse. The
    // Droner is a race to overwrite, not an aura that bills you 3 HP a
    // second for standing near it, untelegraphed, through the i-frames.
    // NOTHING is billed above this guard: the Echo drain used to sit up
    // here, which quietly taxed a lone Droner's owner 2.6 Echo a second for
    // words they never said, on the bar the Reprise now costs all of.
    var mine = !s.drone || T('droneSelfHurt');
    if (!mine) { typo(f.x, f.y, 'lapses', '#6a5f72', 0.5, 8, 'drift'); return; }
    RT.echo = Math.max(0, RT.echo - T('echoBreak'));
    if (!RT.god) { RT.hp -= T('breakSelfDmg'); RT.hurt = Math.max(RT.hurt, 0.25); }
    typo(f.x, f.y, 'sour', '#6a5f72', 0.7, 9, 'drift');
    sfx('sour');
    part({ x: f.x, y: f.y, z: 34, vx: 0, vy: 0, vz: -6, life: 0.5, size: 3, col: '106,95,114', add: 0, grav: 0 });
    RT.sourN = (RT.sourN || 0) + 1;
    if (RT.sourN >= 4) ach('sour');
    if (RT.hp <= 0) downPlayer();
}

/* ─────────────── ANSWER ───────────────
   Detonates every rhyme on screen that matches its sound. Damage
   per enemy scales with that enemy's own stack count. Answer a
   stack with the wrong sound and you get a slant: half damage,
   no element, no echo. Weak, not punishing. */

/* How many of a sound are out there right now. The HUD draws this on
   every rhyme pip, which is the whole readability problem solved: you
   can see at a glance that there are four -eat on the board and one
   stray -ark you have not closed. */
function boardCount(fam) {
    var n = 0;
    RT.foes.forEach(function (f) {
        if (f.dead || heldOpen(f)) return;
        f.stacks.forEach(function (t) { if (t.fam === fam) n++; });
    });
    return n;
}
function boardTotal() {
    var n = 0;
    RT.foes.forEach(function (f) { if (!f.dead && !heldOpen(f)) n += f.stacks.length; });
    return n;
}
function rhymeReady(fam) { return famOwned(fam); }
function rhymeKeys() { return ['1', '2', '3', '4', '5']; }

/* ─────────────── THE RHYME ───────────────
   The verb that is actually yours. It finds every syllable of its own
   sound on the board and closes all of it at once, wherever it is.

   Miss, and it slants. A slant used to be a slap on the wrist: half
   damage and nothing else, which meant the only correct play was never
   to slant. Now a slant DRAGS: it does half damage to everything it
   touched and pulls all of those syllables over into its own sound.
   Which makes rhyming badly a real move. The board is three -eat and
   two -ark, you have -ark up next: slant with -ark to haul the whole
   lot over, then close -ark on five instead of two. Bad rhyme, good
   poem. */
function doRhyme(fam) {
    if (!RT || RT.dead || RT.devOpen || RT.dialog || RT.mapOpen) return;
    if (!FAMS[fam]) return;
    if (!rhymeReady(fam)) {
        hudNudge('rhyme:' + fam);
        say('You do not have that sound yet.', 'dim');
        return;
    }
    if (RT.winded > 0) { hudNudge('breath'); return; }
    if (RT.answerCd > 0) return;
    var st = stats();
    if (!spendBreath(st.answerCost)) { hudNudge('breath'); return; }
    RT.answerCd = 0.34;
    RT.nAnswers++;
    RT.lastRhyme = fam;
    RT.casting = { t: 0.22, max: 0.22 };
    var word = FAMS[fam].tag;
    RT.lastWord = word; RT.lastFam = fam;          // the Reprise says the last thing you said
    var live = RT.foes.filter(function (f) { return !f.dead && f.stacks.length && !heldOpen(f); });
    var totalMatched = 0, hitFoes = 0, best = 0, dragged = 0;

    live.forEach(function (f) {
        var match = 0, other = 0;
        f.stacks.forEach(function (t) { if (t.fam === fam) match++; else other++; });
        if (!match && !other) return;
        var closed = match > 0;
        var n = closed ? match : other;
        var dmg = (st.answerBase + st.answerPerStack * n) * famDmgMul(fam);
        // soft wax holds a mismatched pair together: a slant lands in full
        if (!closed) { dmg *= (RT.items.freeSlant > 0 ? 1 : st.slantMul); }
        dmg *= deafMul(f, fam);          // the deaf hear nothing: only -ill touches them
        hurtFoe(f, dmg, fam, { answer: 1, closed: closed, n: n });
        if (closed) { totalMatched += match; if (match > best) best = match; famEffect(f, fam, match); }
        hitFoes++;
        if (closed) {
            f.stacks = f.stacks.filter(function (t) { return t.fam !== fam; });
        } else if (f.def.folk) {
            // The town's open line is not draggable. It has been the same
            // sound for four hundred years and a wrong answer does not move
            // it: that refusal is the entire act.
        } else if (T('slantShift')) {
            // the drag. Nothing is spent: the sounds are pulled over.
            f.stacks.forEach(function (t) { t.fam = fam; dragged++; });
        } else {
            f.stacks.length = 0;
        }
        snapStacks(f, closed ? FAMS[fam].col : '#6a5f72', n);
    });

    poemBreak(fam);                       // a rhyme is where the line ends
    assembleLine(fam, totalMatched);

    if (totalMatched > 0) {
        RT.echo = Math.min(T('echoMax'), RT.echo + T('echoPerStack') * totalMatched * st.echoGain);
        ach('couplet');
        if (best >= 6) ach('six');
        if (hitFoes >= 8) ach('crowd');
        slam(word, FAMS[fam].col, totalMatched + ' closed');
        sfx('answer');
    } else if (dragged > 0) {
        ach('slant');
        slam(word, FAMS[fam].col, dragged + ' dragged over');
        RT.shake = shake(4);
        sfx('slant');
    } else if (hitFoes > 0) {
        ach('slant');
        slam(word, '#6a5f72', 'slant');
        RT.shake = shake(3);
        sfx('slant');
    } else {
        // a rhyme with nothing to rhyme with: it goes out and finds no sound
        typo(RT.px, RT.py, word, '#4d4757', 0.5, 12, 'pop');
        sfx('empty');
    }
}
/* The money shot. Everything you said that matched flies in from where
   it was stuck and sets itself into one line across the middle of the
   screen before it goes off. Scattered words becoming a line is the
   whole idea of the game, so it should be the thing you see. */
function assembleLine(fam, n) {
    if (!n) return;
    var ws = [];
    (RT.poem && RT.poem.lines.length ? RT.poem.lines[RT.poem.lines.length - 1].ws : []).forEach(function (w) {
        if (!w.cut && w.fam === fam) ws.push(w.w.toUpperCase());
    });
    if (!ws.length) ws = [FAMS[fam].tag];
    RT.assembly = { ws: ws.slice(-6), fam: fam, t: 0.85, max: 0.85 };
}
function drawAssembly(cx, dt) {
    var a = RT.assembly; if (!a) return;
    a.t -= dt;
    if (a.t <= 0) { RT.assembly = null; return; }
    var k = 1 - a.t / a.max;                       // 0 gathering, 1 gone
    var ease = k < 0.55 ? (k / 0.55) : 1;
    var fade = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    cx.save();
    cx.font = 'bold 21px "Press Start 2P", monospace';
    cx.textAlign = 'center';
    var gap = 22, total = 0, widths = [];
    a.ws.forEach(function (w) { var wd = cx.measureText(w).width; widths.push(wd); total += wd + gap; });
    total -= gap;
    var x = VW / 2 - total / 2, y = VH * 0.40;
    a.ws.forEach(function (w, i) {
        var from = ((i * 97) % 13) / 13, sx = lerp(VW * (0.12 + from * 0.76), x + widths[i] / 2, ease);
        var sy = lerp(VH * (0.30 + ((i * 53) % 11) / 11 * 0.34), y, ease);
        cx.globalAlpha = fade * (0.35 + 0.65 * ease);
        cx.fillStyle = FAMS[a.fam].glow;
        cx.shadowColor = FAMS[a.fam].col; cx.shadowBlur = 14 * ease;
        cx.fillText(w, sx, sy);
        cx.shadowBlur = 0;
        x += widths[i] + gap;
    });
    if (ease >= 1) {                                // the rule under the finished line
        cx.globalAlpha = fade * 0.8;
        cx.strokeStyle = FAMS[a.fam].col; cx.lineWidth = 2;
        cx.beginPath(); cx.moveTo(VW / 2 - total / 2, y + 10); cx.lineTo(VW / 2 + total / 2, y + 10); cx.stroke();
    }
    cx.restore(); cx.textAlign = 'left';
}
/* Kept for the dev handle, the act, and anything else that just wants
   "answer with whatever is most worth answering". Picks the sound you
   have the most of on the board, which is what a player would do. */
function doAnswer() {
    var best = null, bn = 0;
    FAM_IDS.forEach(function (f) {
        if (!rhymeReady(f)) return;
        var n = boardCount(f);
        if (n > bn) { bn = n; best = f; }
    });
    doRhyme(best || (rhymeReady(answerFam()) ? answerFam() : FAM_IDS.filter(rhymeReady)[0] || 'eat'));
}
/* ─────────────── THE REPRISE ───────────────
   Echo was a fully plumbed resource with no consumer: written from five
   places, decayed, drawn on the HUD, spent by nothing. It is what the
   room gives back when you close a couplet, so spending it should sound
   like the room saying your line with you.

   A full bar, on G: the last thing you said comes back three times, and
   every rhyme on screen answers it, matching or not. It is the only
   thing in the game that treats a slant as closed, which is the whole
   point: for three beats, everything you said counts. */
function doReprise() {
    if (!RT || RT.dead || RT.devOpen || RT.dialog || RT.mapOpen) return;
    if (RT.combat.rep) return;
    if (RT.echo < T('repriseCost')) { hudNudge('echo'); typo(RT.px, RT.py, 'NOT YET', '#6a5f72', 0.5, 10, 'pop'); return; }
    RT.echo = 0;
    var word = (RT.lastWord || S.answer || 'again').toUpperCase();
    var fam = RT.lastFam || answerFam();
    RT.combat.rep = { n: T('repriseHits'), t: 0, gap: T('repriseGap'), word: word, fam: fam };
    poemBreak(fam);
    RT.dilate = Math.max(RT.dilate, 0.5);
    slam(word, FAMS[fam].col, 'reprise');
    bigLine('again', 'and again, and again', FAMS[fam].col, 2);
    RT.shake = shake(9); RT.chroma = 1;
    sfx('reprise'); sfx('verse');   // 'reprise' is job 2's to write; 'verse' carries it until then
    ach('reprise');
}
function stepReprise(dt) {
    var r = RT.combat.rep; if (!r) return;
    r.t -= dt;
    if (r.t > 0) return;
    r.t = r.gap; r.n--;
    // The line comes back THREE times, so the rhyme has to still be there for
    // the second and third. Wiping the stacks on beat one meant beats two and
    // three found nothing on anything and detonated air: a full Echo bar
    // bought 0.85 of a single Answer, which costs fifteen breath and no Echo
    // at all. Only the last beat takes the words away.
    var last = r.n <= 0;
    var st = stats(), hit = 0;
    RT.foes.forEach(function (f) {
        if (f.dead || !f.stacks.length) return;
        var n = f.stacks.length;
        // everything counts as closed, whatever sound it was
        var dmg = (st.answerBase + st.answerPerStack * n) * T('repriseMul') * famDmgMul(r.fam) * deafMul(f, r.fam);
        hurtFoe(f, dmg, r.fam, { answer: 1, closed: 1, n: n });
        famEffect(f, r.fam, n, 1);
        if (last) f.stacks.length = 0;
        snapStacks(f, FAMS[r.fam].col, n);
        hit++;
    });
    RT.rings.push({ x: RT.px, y: RT.py, r: 0.5, max: 13, col: hex2rgb(FAMS[r.fam].col), t: 0.5, life: 0.5 });
    if (hit) { RT.shake = shake(5); sfx('answer'); }
    typo(RT.px, RT.py + 0.4, r.word, FAMS[r.fam].col, 0.6, 15, 'pop');
    if (r.n <= 0) RT.combat.rep = null;
}
/* Registered from combatBoot() at the foot of the file, not here: KEYS is a
   `var` declared further down, so a module-scope call up here runs before it
   exists and takes the whole script out with it. RESETS has since been
   hoisted to the top for the same reason; KEYS has not. */
function combatBoot() {
    bindKey('g', doReprise);
    // a doorway ends the reprise and clears the cut-off lines with it, rather
    // than carrying a half-finished detonation into the next place
    onPlaceChange(function () {
        if (!RT || !RT.combat) return;
        RT.combat.rep = null; RT.combat.cuts.length = 0; RT.combat.encI = 0; RT.combat.lull = 0;
    });
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
function famEffect(f, fam, n, noHeal) {
    if (fam === 'eat') {                              // hunger, burn, drain
        f.burn = { dps: 5 * n, t: 3 };
        // noHeal: a Reprise hits every enemy three times, and -eat's drain
        // would turn one button into a full heal. It is a detonation, not a meal.
        if (!RT.god && !noHeal) RT.hp = Math.min(RT.hpm, RT.hp + n * 1.5);
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
    if (f.dead || f.def.folk) return 0;      // you cannot hurt the town. The Verse finds them and does nothing.
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
    if (!RT || RT.dead || RT.devOpen || RT.dialog || RT.mapOpen) return;
    var sz = STANZAS[n - 1]; if (!sz) return;
    if (!S.stanzas[n]) { hudNudge('stanza' + n); say('You do not have that stanza yet.', 'dim'); return; }
    if (RT.stanzaCd[n - 1] > 0) { hudNudge('stanza' + n); return; }
    if (RT.winded > 0) { hudNudge('breath'); return; }
    if (!spendBreath(sz.cost)) { hudNudge('breath'); return; }
    RT.stanzaCd[n - 1] = sz.cd;
    RT.dilate = T('dilationT');
    RT.recital = { sz: sz, t: 0, line: -1, n: n };
    RT.lastRhyme = sz.fam;
    poemBreak(sz.fam);            // four lines of the real thing ends yours
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
    if (!RT || RT.devOpen || RT.dialog || RT.mapOpen) return;
    if (!S.verse) {
        hudNudge('verse');
        var lines = ['Not yet.', 'You do not have all of it.', 'Something is still missing from the end.'];
        say('<i>' + pick(lines) + '</i>', 'dim');
        return;
    }
    if (RT.verseCast) return;
    if (S.a3.verseSpent) {                    // it lights up once. It does not keep going off.
        say('<i>You have sung it. It stays sung.</i>', 'dim');
        return;
    }
    RT.verseCast = 1;
    RT.dilate = 6; RT.mono = 8.4;             // mono now runs the length of the recital
    var i = 0;
    BALLAD.forEach(function (st, k) {
        st.r.forEach(function (ln, j) {
            RT.timers.push(setTimeout(function () {
                if (!RT) return;
                bigLine(ln, '', k === 6 && j === 3 ? '#ffe66e' : '#f0e9df', 1.4);
                if (j === 3) {
                    RT.foes.forEach(function (f) { if (!f.dead) hurtFoe(f, 999, 'ight', { answer: 1, closed: 1, n: 4 }); });
                    RT.shake = shake(12);
                    // hurtFoe is a no-op on folk. The most lethal thing in
                    // the game, cast at the climax of the game, finds four
                    // hundred people and does nothing to any of them.
                    // What it does instead: they stand up. By the last
                    // line the whole town is on its feet, which is the
                    // opposite of the one stanza both versions agree on.
                    var sitting = RT.foes.filter(function (f) { return f.def.folk && f.seat && !f.isHal; });
                    for (var q = 0; q < 4 && sitting.length; q++) sitting.splice(irnd(0, sitting.length - 1), 1)[0].seat = 0;
                }
            }, (i++) * 260));
        });
    });
    RT.timers.push(setTimeout(function () {
        if (!RT) return;
        RT.verseCast = 0;
        // spent when it finishes, not when the key goes down. These are
        // setTimeouts: close() kills them and a reload never had them, so
        // committing the flag on the keypress burned the one-shot and
        // skipped everything it pays for. Not keyed on place either, or
        // the Verse is repeatable forever anywhere else.
        S.a3.verseSpent = 1; sSave();
        if (RT.place === 'a3sq') { ach('verse'); a3Hal(); }
        else say('The ballad closes. Every rhyme lands.', 'good');
    }, i * 260 + 1200));
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
function spawnFoe(kind, x, y, mod) {
    var def = FOES[kind]; if (!def || !RT) return null;
    var m = MODS[mod] || null;
    var f = {
        kind: kind, def: def, mod: m ? mod : null, m: m, x: clamp(x, 0.8, pw() - 0.8), y: clamp(y, 0.8, ph() - 0.8),
        hp: def.hp * T('ttk'), hpm: def.hp * T('ttk'), r: def.r,
        stacks: [], state: 'walk', tell: 0, atkT: rnd(0, 0.6), flash: 0, wob: 0, dead: 0,
        silence: 0, frozen: 0, burn: null, revealed: 0, armor: def.armor0 || 0, spawn: 0.45,
        anim: rnd(0, TAU), steal: def.steal || 0, drone: def.drone || 0, pulse: def.pulse || 0, said: 0,
        spd: def.spd, dmg: def.dmg, atk: def.atk,
        so: irnd(0, 2) * 9          // stack-row stagger: piled enemies must stay readable
    };
    if (m) {                                   // an elite is the same archetype, bent
        f.hp = f.hpm = Math.round(f.hpm * (m.hp || 1) * T('eliteHp'));
        f.spd *= m.spd || 1; f.dmg = Math.round(f.dmg * (m.dmg || 1)); f.atk *= m.atk || 1;
        if (m.armor) f.armor += m.armor;
        if (m.drone) f.drone = f.drone || m.drone;
        if (m.steal) f.steal = f.steal || m.steal;
        f.r *= 1.08;
    }
    if (blocked(f.x, f.y, f.r * 0.7)) {           // never spawn inside a wall
        for (var a2 = 0; a2 < 24; a2++) {
            var rr2 = 1 + (a2 >> 3), xx = clamp(f.x + Math.cos(a2 / 8 * TAU) * rr2, 0.8, pw() - 0.8),
                yy = clamp(f.y + Math.sin(a2 / 8 * TAU) * rr2, 0.8, ph() - 0.8);
            if (!blocked(xx, yy, f.r * 0.7)) { f.x = xx; f.y = yy; break; }
        }
    }
    // the cap rejects the push, so hand back nothing rather than a foe that
    // is not in the world and will never be stepped or drawn
    if (RT.foes.length >= 70) return null;
    RT.foes.push(f);
    if (S.combat) {                          // the roster you have actually faced
        if (!S.combat.met) S.combat.met = {};
        if (!S.combat.met[kind]) {
            S.combat.met[kind] = 1; sSave();   // a first sighting has to survive a reload on its own
            // the audience are in FOES because that is the only way to put
            // people on the floor, but they are not one of the six and you do
            // not "meet" them. Counting them made the roster unfinishable
            // until the last scene of the game.
            if (Object.keys(FOES).every(function (k) { return FOES[k].folk || S.combat.met[k]; })) ach('allsix');
        }
    }
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
        // frozen decays above the folk skip: an -ill answer lands on all
        // twenty five of them at once, and if it never ticked down the
        // whole square would stay under the ice tint for the rest of the
        // ending. A second and a half of the town going still is the point.
        f.frozen = Math.max(0, f.frozen - dt);
        if (f.def.folk) {
            alive++;
            // they sit. That is the whole of their AI, except for the one
            // man at the back, who at the end of it stands up and walks.
            if (f.walk) f.y -= Math.min(f.y - f.walkTo, dt * 1.0);
            continue;
        }
        if (f.dead) { RT.foes.splice(i, 1); continue; }
        alive++;
        if (f.burn) {                                  // -eat and -ark leave something cooking
            f.burn.t -= dt; f.burn.tick = (f.burn.tick || 0) - dt;
            if (f.burn.tick <= 0) { f.burn.tick = 0.5; hurtFoe(f, f.burn.dps * 0.5, 'eat', { dot: 1 });
                part({ x: f.x, y: f.y, z: rnd(10, 40), vx: 0, vy: 0, vz: rnd(6, 16), life: 0.4, size: 2, col: '255,140,60', add: 1, grav: 0 }); }
            if (f.burn.t <= 0) f.burn = null;
        }
        // its own burn just finished it: a corpse does not get to complete the
        // steal it was winding up. This guard has to sit ABOVE stepSpecials.
        if (f.dead) continue;
        if (f.frozen > 0 || f.silence > 0) {           // -ill holds it, -erd shuts it up
            if (f.sp) cancelSpecial(f);                // interrupted means interrupted, not paused
            continue;
        }
        var dx = RT.px - f.x, dy = RT.py - f.y, d = Math.hypot(dx, dy) || 0.001;
        f.face = Math.atan2(dy, dx);
        f.atkT = Math.max(0, f.atkT - dt);
        stepSpecials(f, dt, d);
        if (f.dead) continue;
        // a special winding up roots it: the tell is a real window to punish
        if (f.sp) { f.state = 'walk'; continue; }
        (AI[f.def.ai] || AI.walk)(f, dt, d, dx, dy);
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

/* ─────────────── what a place sends at you ───────────────
   The roster used to be one hardcoded pair, so every fight in the game
   was mouths plus a thief on wave three. Encounters are authored per
   place instead, each wave with a reason to exist. `teach` is a note to
   the next person, not shown to the player.

   A wave is a list of [kind, count, mod]. mod may be null, a modifier
   id, or '?' to roll one at TUNE.eliteChance.

   Put the enemy the wave exists to TEACH in the first slot. A place's
   speakDraws caps the wave, spawnWave spends that cap one-per-slot, and
   what does not fit falls off the end. */
var ENCOUNTERS = {
    square: [
        { teach: 'call, answer, nothing else', w: [['mouth', 2]] },
        { teach: 'a thief in a crowd: kill it first', w: [['mouth', 2], ['thief', 1]] },
        { teach: 'the sword is unanswerable, and it is the joke', w: [['mouth', 2], ['sword', 1]] }
    ],
    lane: [
        { teach: 'a droner holds the back and writes over itself', w: [['mouth', 2], ['droner', 1]] },
        { teach: 'two shapes at once: one closes, one will not', w: [['droner', 1], ['thief', 1], ['mouth', 1]] },
        { teach: 'the first elite', w: [['mouth', 2], ['mouth', 1, 'quick']] }
    ],
    mill: [
        { teach: 'the wall: -ill or nothing', w: [['deaf', 1], ['mouth', 2]] },
        { teach: 'armour wants -ight before anything else', w: [['mouth', 2], ['deaf', 1, 'sealed']] },
        // The Sword has to be met SOMEWHERE on the critical path or its whole
        // joke never lands. The mill is the only place before the loft that
        // draws hearsay at all, so it is here or nowhere — and early enough
        // in the ladder that a player who fights at all will reach it.
        { teach: 'the sword: no rhyme on it at all, and that is the joke', w: [['sword', 1], ['mouth', 2]] },
        { teach: 'shut up and let breath ramp, or you get caught winded', w: [['thief', 1, 'quick'], ['mouth', 3]] },
        { teach: 'everything at once', w: [['deaf', 1], ['droner', 1], ['sword', 1], ['thief', 1], ['mouth', 2]] }
    ],
    /* Job 3's road north. You are past the fence with the whole kit, and the
       road is long enough that range finally means something. */
    road: [
        { teach: 'out here it answers with more of itself than the town did', w: [['thief', 1], ['mouth', 2]] },
        { teach: 'two droners on a road with nowhere to stand still', w: [['droner', 2], ['mouth', 1]] },
        { teach: 'a wall that also hits: -ight first, then -ill', w: [['deaf', 1, 'loud'], ['mouth', 2]] },
        { teach: 'everything the town taught you, on the way out of it', w: [['sword', 1], ['thief', 1, 'quick'], ['droner', 1], ['mouth', 1]] }
    ],
    /* The hollow. Job 3's brief for it is "the one place that should feel
       wrong", so nothing ordinary spawns here after the first wave. */
    hollow: [
        { teach: 'it is already answering before you have finished', w: [['deaf', 1, 'sealed'], ['droner', 1], ['mouth', 2]] },
        { teach: 'the dark is full of hands', w: [['thief', 2, 'quick'], ['mouth', 2]] },
        { teach: 'nothing out here is ordinary any more', w: [['deaf', 1, 'droning'], ['sword', 1, 'loud'], ['thief', 1]] },
        { teach: 'the whole cast, and all of it wrong', w: [['sword', 1, '?'], ['deaf', 1, '?'], ['droner', 1, '?'], ['thief', 1, '?'], ['mouth', 2, '?']] }
    ],
    // The square, Grelling and the mark do not draw hearsay today (no
    // speakDraws on their PLACES entry, which is job 3's to set; the square is
    // deliberately `calm`). These are authored and waiting for that field.
    village: [
        { teach: 'droners in a pair force you to move', w: [['droner', 2], ['mouth', 1]] },
        { teach: 'a loud one hits hard enough to respect', w: [['mouth', 2], ['mouth', 1, 'loud']] },
        { teach: 'the sword, again, but you are busy now', w: [['sword', 1], ['mouth', 2], ['thief', 1]] }
    ],
    mark: [
        { teach: 'thieves hunt in pairs out here', w: [['thief', 2], ['mouth', 1]] },
        { teach: 'a droning deaf: it writes on itself and cannot hear you', w: [['deaf', 1, 'droning'], ['mouth', 2]] },
        { teach: 'the full roster before the loft', w: [['deaf', 1], ['sword', 1], ['thief', 1], ['droner', 1]] }
    ]
};
/* the dev arena walks this and then rolls elites forever */
var ARENA_LADDER = [
    { teach: 'arena 1', w: [['mouth', 3]] },
    { teach: 'arena 2', w: [['mouth', 2], ['thief', 1]] },
    { teach: 'arena 3', w: [['droner', 1], ['mouth', 2]] },
    { teach: 'arena 4', w: [['deaf', 1], ['mouth', 2]] },
    { teach: 'arena 5', w: [['sword', 1], ['mouth', 2]] },
    { teach: 'arena 6', w: [['thief', 1, 'quick'], ['mouth', 2]] },
    { teach: 'arena 7', w: [['deaf', 1, 'sealed'], ['droner', 1]] },
    { teach: 'arena 8+', w: [['mouth', 2, '?'], ['thief', 1, '?'], ['droner', 1, '?']] }
];
var ENC_DEFAULT = [
    { teach: 'generic pressure', w: [['mouth', 2]] },
    { teach: 'generic pressure, with a thief', w: [['mouth', 2], ['thief', 1]] },
    { teach: 'generic pressure, elite', w: [['mouth', 2], ['mouth', 1, '?']] }
];
function encounterFor(placeId, wave) {
    var list = ENCOUNTERS[placeId] || ENC_DEFAULT;
    return list[Math.min(wave, list.length - 1)];
}
/* roll the modifier for one slot: null, a named id, or '?' for a dice roll */
function slotMod(mod) {
    if (!mod) return null;
    if (mod !== '?') return MODS[mod] ? mod : null;
    return Math.random() < T('eliteChance') ? pick(MOD_IDS) : null;
}
/* spawn one authored wave in a ring around the player.
   `cap` is the place's own speakDraws: how much noise it is willing to
   answer with. The old roster respected it and so does this one, or the
   mill's fourth wave quietly becomes six enemies in a grain loft. */
function spawnWave(enc, cx0, cy0, spread, cap) {
    if (!enc) return 0;
    var n = 0, room = cap == null ? 99 : cap, want = [];
    enc.w.forEach(function (slot) { want.push({ kind: slot[0], left: slot[1] || 1, mod: slotMod(slot[2]) }); });
    // Spend the budget one-per-slot and go round again, rather than draining
    // it in slot order. Slot order truncates the tail, and the tail is where
    // the interesting enemy usually is: the lane's speakDraws of 2 meant its
    // two mouths ate the whole wave and its authored Droner and its first
    // elite could never spawn at all, in any wave, ever.
    for (var pass = 0; n < room && pass < 40; pass++) {
        var moved = 0;
        for (var s = 0; s < want.length && n < room; s++) {
            if (!want[s].left) continue;
            want[s].left--; moved = 1;
            var a = rnd(0, TAU), rr = spread ? rnd(spread[0], spread[1]) : rnd(4.5, 6.5);
            var f = spawnFoe(want[s].kind, clamp(cx0 + Math.cos(a) * rr, 1, pw() - 1), clamp(cy0 + Math.sin(a) * rr, 1, ph() - 1), want[s].mod);
            if (f) n++;
        }
        if (!moved) break;
    }
    return n;
}

/* ─────────────── how they move ───────────────
   Named shapes, one per behaviour, so a new archetype picks a shape
   instead of adding another branch to one walk-and-bite loop. Every
   shape ends in a telegraphed bite: the ring you can read is the
   whole contract of this game. */
function foeSep(f) {                       // shove apart so packs read as a crowd
    var sx = 0, sy = 0;
    for (var k = 0; k < RT.foes.length; k++) {
        var o = RT.foes[k]; if (o === f || o.dead) continue;
        var ox = f.x - o.x, oy = f.y - o.y, od = Math.hypot(ox, oy);
        if (od > 0.01 && od < f.r + o.r + 0.25) { sx += ox / od; sy += oy / od; }
    }
    return [sx, sy];
}
/* axis-separated, same as the player: they used to drift straight
   through the mill wall and bite you from inside the building */
function moveFoe(f, mx, my, dt, spd) {
    var s = foeSep(f);
    mx += s[0] * 0.55; my += s[1] * 0.55;
    var ml = Math.hypot(mx, my) || 1;
    var nx = clamp(f.x + mx / ml * spd * dt, 0.7, pw() - 0.7);
    var ny = clamp(f.y + my / ml * spd * dt, 0.7, ph() - 0.7);
    if (!blocked(nx, f.y, f.r * 0.7)) f.x = nx;
    if (!blocked(f.x, ny, f.r * 0.7)) f.y = ny;
}
function foeBite(f, dt, d) {
    var reach = f.r + 0.75;
    if (d <= reach && f.atkT <= 0 && f.state !== 'tell') { f.state = 'tell'; f.tell = f.def.tell; }
    if (f.state === 'tell') {
        f.tell -= dt;
        if (f.tell <= 0) {
            f.state = 'walk'; f.atkT = f.atk;
            if (Math.hypot(RT.px - f.x, RT.py - f.y) <= reach + 0.35) hurtPlayer(f.dmg, f);
            typo(f.x, f.y, pick(['HA', 'HEARD', 'ALONE', 'SO THEY SAY']), '#c86a6a', 0.4, 9, 'pop');
            sfx('bite');
        }
        return true;
    }
    return false;
}
var AI = {
    /* straight at you, and bite. the baseline everything is read against */
    walk: function (f, dt, d, dx, dy) {
        if (!foeBite(f, dt, d) && d > f.r + 0.75) { moveFoe(f, dx / d, dy / d, dt, f.spd); f.state = 'walk'; }
    },
    /* in, take something, out. the Thief runs its steal and then keeps
       its distance while the cooldown comes back, so the player gets a
       window to punish it and a reason to want to. */
    dart: function (f, dt, d, dx, dy) {
        var keep = f.def.keep || 4;
        var wants = f.stealT != null && f.stealT < 0.9;      // closing for the steal
        if (f.state === 'tell') { foeBite(f, dt, d); return; }
        if (f.flee > 0) {
            f.flee -= dt;
            moveFoe(f, -dx / d, -dy / d, dt, f.spd * 1.15);
            f.state = 'flee';
            return;
        }
        if (wants || d > keep + 2) {
            if (!foeBite(f, dt, d) && d > f.r + 0.75) { moveFoe(f, dx / d, dy / d, dt, f.spd); f.state = 'walk'; }
        } else if (d < keep) {
            moveFoe(f, -dx / d, -dy / d, dt, f.spd * 0.8); f.state = 'walk';
        } else { f.state = 'walk'; foeBite(f, dt, d); }
    },
    /* stands off and says its line at you. it will not close, so you
       cannot ignore it and you cannot melee-range your way out of it. */
    hold: function (f, dt, d, dx, dy) {
        var keep = f.def.keep || 5;
        if (d < keep - 0.6) { moveFoe(f, -dx / d, -dy / d, dt, f.spd); f.state = 'walk'; }
        else if (d > keep + 0.8) { moveFoe(f, dx / d, dy / d, dt, f.spd * 0.85); f.state = 'walk'; }
        else { f.state = 'walk'; }
        foeBite(f, dt, d);                                   // only if you walk into it
    },
    chorus: function (f, dt, d) { stepChorus(f, dt, d); }
};

/* ─────────────── the specials, with something to read ───────────────
   Both of these used to just happen. A special the player cannot see
   coming is not difficulty, it is noise. Each one now winds up, says
   what it is doing, and can be interrupted by -erd or -ill like
   anything else.

   `f.sp` is a LOCK, not a mode flag. One body can carry both specials
   (a droning Thief, a light-fingered Droner), and when both blocks
   guarded on `f.sp !== <their own name>` they overwrote each other's
   windup every frame: neither ever reached zero, neither cooldown ever
   reset, and the foe stood rooted under a telegraph that could never
   close, forever. Enter only when the lock is free. Whichever special
   loses the race keeps its already-negative timer and takes the next
   opening. */
function cancelSpecial(f) {
    if (f.sp === 'steal') f.stealT = f.steal;
    else if (f.sp === 'drone') f.droneT = f.drone;
    f.sp = null; f.wind = 0;
    typo(f.x, f.y, 'cut off', '#6a5f72', 0.45, 8, 'drift');
}
function stepSpecials(f, dt, d) {
    if (f.steal) {
        f.stealT = (f.stealT == null ? f.steal : f.stealT) - dt;
        if (f.stealT <= 0 && !f.sp) {
            var pool0 = RT.foes.filter(function (q) { return !q.dead && q.stacks.length; });
            if (RT.conceal > 0) { typo(f.x, f.y, '???', FAMS.ark.col, 0.5, 9, 'drift'); f.stealT = f.steal * 0.5; }
            else if (pool0.length) { f.sp = 'steal'; f.wind = f.def.stealTell || 0.8; f.windMax = f.wind; }
            else f.stealT = 0.4;
        }
        if (f.sp === 'steal') {
            f.wind -= dt;
            if (f.wind <= 0) {
                f.sp = null; f.stealT = f.steal; f.flee = 1.5;
                var pool = RT.foes.filter(function (q) { return !q.dead && q.stacks.length; });
                if (RT.conceal > 0 || !pool.length) { typo(f.x, f.y, 'nothing to take', '#6a5f72', 0.5, 9, 'drift'); }
                else {
                    var v = pick(pool), n = v.stacks.length;
                    v.stacks.length = 0;
                    hurtFoe(v, stats().answerBase * 0.4, 'eat', { answer: 1, closed: 0, n: n });
                    typo(v.x, v.y, 'STOLEN', '#c86a6a', 0.7, 11, 'drift');
                    RT.echo = Math.max(0, RT.echo - 8);
                    say('A thief answers your line for you. Wrongly.', 'bad');
                    sfx('steal');
                }
            }
        }
    }
    if (f.drone) {
        f.droneT = (f.droneT == null ? f.drone : f.droneT) - dt;
        if (f.droneT <= 0 && !f.sp) { f.sp = 'drone'; f.wind = f.def.droneTell || 0.7; f.windMax = f.wind; }
        if (f.sp === 'drone') {
            f.wind -= dt;
            if (f.wind <= 0) {
                f.sp = null; f.droneT = f.drone;
                var st = stats(), mine = callFam();
                var other = FAM_IDS.filter(function (x) { return x !== mine; });
                f.stacks.push({ fam: pick(other), t: st.stackLife, max: st.stackLife, drone: 1 });
                while (f.stacks.length > st.stackMax) f.stacks.shift();
                typo(f.x, f.y, 'ON AND ON', '#c9a94a', 0.45, 9, 'drift');
                sfx('drone'); sfx('voice');   // same: 'drone' is job 2's, 'voice' carries it
            }
        }
    }
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
        // a thumb of pitch holds one pulse's worth of rhyme on
        var held = !!RT.items.tack;
        if (held) RT.items.tack = 0;
        else RT.foes.forEach(function (q) { if (!q.dead) { stripped += q.stacks.length; q.stacks.length = 0; } });
        slam('AND HE WENT ALONE', held ? '#c9a94a' : '#d2c8e1', held ? 'the pitch holds' : 'the refrain strips everything');
        if (held) say('The refrain comes through and the pitch holds your rhymes on.', 'good');
        RT.shake = shake(held ? 5 : 8);
        if (stripped) { RT.echo = Math.max(0, RT.echo - stripped * 2); }
        if (Math.hypot(RT.px - f.x, RT.py - f.y) < 3) hurtPlayer(f.dmg);
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
        f.voiceT = f.atk;
        var an = Math.atan2(RT.py - f.y, RT.px - f.x);
        for (var j = -1; j <= 1; j++) {
            RT.fproj.push({ x: f.x, y: f.y, vx: Math.cos(an + j * 0.22) * 5.5, vy: Math.sin(an + j * 0.22) * 5.5, life: 2.6, dmg: f.dmg });
        }
        sfx('voice');
    }
}

/* ─────────────── death ─────────────── */
/* What happens when a boss goes down is a named hook, not an if. A second
   boss registers here and gets its own ending without touching foeDie. */
var BOSS_DOWN = { chorus: function (f) { onChorusDown(f); } };
function onBossDown(name, fn) { BOSS_DOWN[name] = fn; }

/* ─────────────── a line, cut off ───────────────
   They used to stop existing. In a game where everything is a
   misremembered line, dying should sound like being interrupted: the
   thing gets most of a word out, and the word is cut where it stands. */
var LAST_WORDS = ['AND HE WENT', 'SHE ASKED FOR A', 'THE NINTH', 'WE ALL HE', 'NOT FOR THE MAN', 'SO LIGHT YOUR', 'ALONE, ALO', 'HE CAME BACK D'];
function deathLine(f) {
    var w = pick(LAST_WORDS);
    var cut = Math.max(2, Math.round(w.length * rnd(0.45, 0.8)));
    RT.combat.cuts.push({ x: f.x, y: f.y, w: w.slice(0, cut), t: 0.55, max: 0.55, big: f.def.boss ? 1 : 0 });
}
function foeDie(f, quiet) {
    if (f.dead) return;
    f.dead = 1; S.kills++;
    var boss = !!f.def.boss;
    var rgb = boss ? '210,200,225' : '170,160,185';
    burst(f.x, f.y, 14, boss ? 50 : 16, { col: rgb, sp0: 0.6, sp1: boss ? 3.6 : 2.4, l0: 0.3, l1: 1, add: 0, grav: 140 });
    deathLine(f);
    var c = irnd(f.def.coin[0], f.def.coin[1]);
    if (f.m) c += T('eliteCoin');                       // elites are worth the trouble
    if (c) coin(c, f.x, f.y);
    dropLoot(f);                                      // job 5: items, with fiction
    if (f.kind === 'sword' && f.callDmg && !f.otherDmg) ach('sword');
    if (f.m) ach('elite');
    if (f.def.onDown && BOSS_DOWN[f.def.onDown]) BOSS_DOWN[f.def.onDown](f);
    // 'bossdie' is a name job 2 has not written a case for yet, and sfx()
    // silently ignores unknown kinds — so 'die' still fires underneath it,
    // or killing the Chorus would be the one death in the game with no sound.
    if (!quiet) { sfx('die'); if (boss) sfx('bossdie'); }
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
/* a person in the audience. Seated until the Verse stands them up. */
function drawFolk(cx, f) {
    var seat = f.seat ? 1 : 0, h = seat ? 17 : 27, w = 7;
    var sway = Math.sin(RT.t * 1.1 + f.x * 2.3) * (seat ? 0.6 : 1.4);
    cx.save(); cx.translate(sway, 0);
    cx.fillStyle = f.isHal ? '#2a2434' : '#3a3346';
    cx.beginPath();
    cx.moveTo(-w, 0); cx.lineTo(-w * 0.68, -h); cx.lineTo(w * 0.68, -h); cx.lineTo(w, 0);
    cx.closePath(); cx.fill();
    cx.fillStyle = f.isHal ? '#c8b8a8' : '#8a8296';
    cx.beginPath(); cx.arc(0, -h - 4.6, 4.4, 0, TAU); cx.fill();
    if (!seat) {                                    // lamplight catches them standing
        cx.globalAlpha = 0.5;
        cx.fillStyle = '#ffc271';
        cx.fillRect(-w * 0.7, -h, w * 1.4, 2);
        cx.globalAlpha = 1;
    }
    cx.restore();
}
function drawFoe(cx, f) {
    var sx = isoX(f.x, f.y), sy = isoY(f.x, f.y) + TILE_H / 2;
    var pop = f.spawn > 0 ? 0.5 + (0.45 - f.spawn) : 1;
    var wob = Math.sin(RT.t * 22) * f.wob * 3;
    var tell = f.state === 'tell' ? 0.5 + 0.5 * Math.sin(RT.t * 30) : 0;
    var h = f.def.boss ? 130 : 26 + f.r * 68;
    if (f.state === 'tell' && !f.def.boss) {          // the wind-up ring
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5);
        cx.strokeStyle = 'rgba(255,90,80,' + (0.35 + tell * 0.4) + ')'; cx.lineWidth = 2;
        cx.beginPath(); cx.arc(0, 0, (f.r + 0.75) * TILE_W / 2, 0, TAU); cx.stroke(); cx.restore();
    }
    // a special winding up: the ring closes on the beat it lands, and the
    // word above says which special it is. Both are interruptible.
    if ((f.sp === 'steal' || f.sp === 'drone') && f.windMax) {
        var k2 = clamp(1 - f.wind / f.windMax, 0, 1);
        var col2 = f.sp === 'steal' ? '#c86a6a' : '#c9a94a';
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5);
        cx.strokeStyle = col2; cx.lineWidth = 2; cx.globalAlpha = 0.85;
        cx.beginPath(); cx.arc(0, 0, (2.6 - k2 * 1.9) * TILE_W / 2, 0, TAU); cx.stroke();
        cx.globalAlpha = 0.3; cx.beginPath(); cx.arc(0, 0, 0.7 * TILE_W / 2, 0, TAU); cx.stroke();
        cx.restore();
        cx.save(); cx.font = 'bold 8px "Press Start 2P", monospace'; cx.textAlign = 'center';
        cx.fillStyle = col2; cx.globalAlpha = 0.6 + Math.sin(RT.t * 26) * 0.4;
        cx.fillText(f.sp === 'steal' ? 'REACHING' : 'ON AND ON', sx, sy - h - 30);
        cx.restore(); cx.textAlign = 'left';
    }
    cx.save(); cx.translate(sx, sy - Math.abs(wob) * 0.4); cx.scale(pop, pop);
    cx.fillStyle = 'rgba(0,0,0,.42)'; cx.beginPath(); cx.ellipse(0, 0, f.r * 21, f.r * 8, 0, 0, TAU); cx.fill();
    (FOE_DRAW[f.def.draw] || drawMouth)(cx, f, tell);
    if (f.m) drawMod(cx, f, h);                      // the elite mark rides on top of the body
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
/* one mark per modifier, drawn over whatever it is riding on, so an
   elite reads as "that thing, but wrong" rather than as a new enemy */
function drawMod(cx, f, h) {
    var m = f.m, w = f.r * 44;
    cx.save();
    cx.strokeStyle = m.col; cx.fillStyle = m.col;
    if (m.mark === 'ring') {
        cx.globalAlpha = 0.5 + Math.sin(RT.t * 3) * 0.2; cx.lineWidth = 2;
        cx.save(); cx.scale(1, 0.5); cx.beginPath(); cx.arc(0, 0, w * 1.15, 0, TAU); cx.stroke(); cx.restore();
    } else if (m.mark === 'streak') {
        cx.globalAlpha = 0.7;
        for (var i = 0; i < 3; i++) cx.fillRect(-w - 6 - i * 5, -h * 0.55 - i * 4, 4, 1.5);
    } else if (m.mark === 'plate') {
        cx.globalAlpha = f.armor > 0 ? 0.85 : 0.2;
        cx.lineWidth = 2; cx.strokeRect(-w * 0.8, -h * 0.75, w * 1.6, h * 0.5);
    } else if (m.mark === 'halo') {
        cx.globalAlpha = 0.25 + Math.abs(Math.sin(f.anim * 4)) * 0.35;
        cx.save(); cx.scale(1, 0.4); cx.beginPath(); cx.arc(0, -h * 2.1, w * 1.1, 0, TAU); cx.fill(); cx.restore();
    } else if (m.mark === 'hand') {
        cx.globalAlpha = 0.8; cx.fillRect(w * 0.7, -h * 0.62, w * 0.55, 3);
        cx.fillRect(w * 1.2, -h * 0.68, 3, 8);
    }
    cx.restore();
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

/* name → body. A new archetype brings its own drawer and registers it
   here; drawFoe never grows another branch. */
var FOE_DRAW = { mouth: drawMouth, thief: drawThief, droner: drawDroner, deaf: drawDeaf, sword: drawSword, chorus: drawChorus, folk: drawFolk };

/* the cut-off line left behind by a death. The word is drawn, then the
   canvas is clipped mid-letter and a hard caesura bar sits on the cut:
   a sentence stopped in the middle, which is what happened to her. */
function drawCuts(cx, dt) {
    var c2 = RT.combat.cuts;
    for (var i = c2.length - 1; i >= 0; i--) {
        var c = c2[i]; c.t -= dt;
        if (c.t <= 0) { c2.splice(i, 1); continue; }
        var k = 1 - c.t / c.max;
        var sx = isoX(c.x, c.y), sy = isoY(c.x, c.y) + TILE_H / 2 - 34 - k * 16;
        var size = c.big ? 15 : 9;
        cx.save();
        cx.font = 'bold ' + size + 'px "Press Start 2P", monospace';
        cx.textAlign = 'left';
        var w = cx.measureText(c.w).width;
        var cutAt = w * (1 - Math.min(1, k * 1.6));            // the cut travels in
        cx.globalAlpha = clamp(1 - k, 0, 1) * 0.95;
        cx.beginPath(); cx.rect(sx - w / 2, sy - size - 4, Math.max(0, cutAt), size + 8); cx.clip();
        cx.fillStyle = c.big ? '#d2c8e1' : '#b9b0c6';
        cx.fillText(c.w, sx - w / 2, sy);
        cx.restore();
        if (cutAt > 1) {                                        // the bar sitting on the cut
            cx.save(); cx.globalAlpha = clamp(1 - k, 0, 1);
            cx.fillStyle = c.big ? '#fff' : '#e6e1f0';
            cx.fillRect(sx - w / 2 + cutAt, sy - size - 2, 2, size + 5);
            cx.restore();
        }
    }
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
    draw(real);
    RT.raf = requestAnimationFrame(frame);
}
function step(dt, real) {
    RT.t += dt;
    RT.dilate = Math.max(0, RT.dilate - (real || dt));      // dilation runs on real time
    RT.mono = Math.max(0, RT.mono - (real || dt));
    RT.callCd = Math.max(0, (RT.callCd || 0) - dt);
    RT.answerCd = Math.max(0, (RT.answerCd || 0) - dt);
    RT.swallowCd = Math.max(0, (RT.swallowCd || 0) - dt);
    RT.conceal = Math.max(0, (RT.conceal || 0) - dt);
    stepItems(dt);                                          // job 5: the wax goes cold, the shop closes behind you
    if (RT.dead) {
        RT.deadT -= (real || dt);
        stepParts(dt);
        if (RT.deadT <= 0) revive();
    } else {
        stepPlayer(dt);
        stepCalls(dt);
        stepStacks(dt);
        stepReprise(dt);
        stepFoes(dt);
        stepParts(dt);
        stepRecital(real || dt);
        stepScene(dt);
        stepNpcs(dt);
    }
    stepCamera(real || dt);          // the eye keeps moving while you are dead, and while time is thick
    stepAudio(real || dt);                                  // real time: see the clock rule in SOUND
    RT.shake = Math.max(0, RT.shake - dt * 24);
    RT.chroma = Math.max(0, RT.chroma - dt * 2.4);
    RT.flash = Math.max(0, RT.flash - dt * 2.2);
    for (var i = RT.toasts.length - 1; i >= 0; i--) { RT.toasts[i].t -= (real || dt); if (RT.toasts[i].t <= 0) RT.toasts.splice(i, 1); }
    RT.hudT = (RT.hudT || 0) - (real || dt);
    if (RT.hudT <= 0) { RT.hudT = 0.05; updateHud(0.05); }
}
function draw(rdt) {
    // was hard-coded to 1/60: on a 144Hz screen every typographic
    // effect outlived its intent by more than double
    var cx = RT.cx, dt = Math.min(0.05, rdt || 1 / 60);
    cx.save();
    if (S.opts.shake && RT.shake > 0.2) cx.translate(rnd(-RT.shake, RT.shake) * 0.5, rnd(-RT.shake, RT.shake) * 0.35);
    cx.clearRect(-30, -30, VW + 60, VH + 60);
    var fl = buildFloor(place().floor, pw(), ph()), c0 = cam();
    cx.fillStyle = '#07060a'; cx.fillRect(0, 0, VW, VH);
    cx.drawImage(fl.cv, Math.round(fl.box.x - c0.x), Math.round(fl.box.y - c0.y));
    // during a recital the world drains away until the letters are the only light
    if (RT.dilate > 0) {
        cx.fillStyle = 'rgba(6,4,10,' + (0.55 * clamp(RT.dilate / T('dilationT'), 0, 1)).toFixed(3) + ')';
        cx.fillRect(0, 0, VW, VH);
    }
    drawExits(cx);
    drawLooks(cx);
    drawRings(cx, dt);
    if (RT.moveTo && !S.opts.wasd) {
        var mx = isoX(RT.moveTo.x, RT.moveTo.y), my = isoY(RT.moveTo.x, RT.moveTo.y) + TILE_H / 2;
        cx.save(); cx.translate(mx, my); cx.scale(1, 0.5);
        cx.strokeStyle = 'rgba(200,190,220,.4)'; cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(0, 0, 7 + Math.sin(RT.t * 8) * 2, 0, TAU); cx.stroke(); cx.restore();
    }
    /* painter-sorted world. Props are IN this list now: they used to be
       two crude passes split on the player's depth alone, which is why
       every NPC and every foe drew straight through a house. */
    var ents = [];
    RT.foes.forEach(function (f) { if (!f.dead) ents.push({ k: f.x + f.y, fn: function () { drawFoe(cx, f); } }); });
    (place().npcs || []).forEach(function (id) { var n = NPCS[id]; if (n) ents.push({ k: npcX(n) + npcY(n), fn: function () { drawNpc(cx, n); } }); });
    (place().props || []).forEach(function (o) {
        ents.push({ k: o.b[0] + o.b[2] / 2 + o.b[1] + o.b[3] / 2, fn: function () { drawProp(cx, o); } });
    });
    ents.push({ k: RT.px + RT.py, fn: function () { drawActor(cx); } });
    ents.sort(function (a, b) { return a.k - b.k; });
    ents.forEach(function (e) { e.fn(); });
    drawLights(cx);
    drawVignette(cx);
    drawCalls(cx);
    drawFproj(cx);
    drawParts(cx);
    drawCuts(cx, dt);            // job 4: the cut-off last line, world space
    drawSnaps(cx, dt);
    drawTypo(cx, dt);
    if (RT.flash > 0) { cx.fillStyle = 'rgba(255,250,235,' + (RT.flash * 0.5) + ')'; cx.fillRect(0, 0, VW, VH); }
    if (RT.hurt > 0 || RT.dead) { cx.fillStyle = 'rgba(150,10,25,' + (RT.dead ? 0.34 : RT.hurt * 0.3) + ')'; cx.fillRect(0, 0, VW, VH); }
    drawPrompt(cx);
    // The world drains away until the letters are the only light. mono has
    // been set by the Verse and read by nothing since it was written; the
    // big typographic lines are drawn after this restore, so they keep
    // their colour while everything behind them goes grey.
    if (RT.mono > 0) {
        cx.save();
        cx.globalCompositeOperation = 'saturation';
        cx.globalAlpha = clamp(RT.mono / 1.4, 0, 1);
        cx.fillStyle = 'hsl(0,0%,50%)';
        cx.fillRect(0, 0, VW, VH);
        cx.restore();
    }
    cx.restore();
    drawAssembly(cx, dt);      // the words gathering into a line
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

/* ═══════════════ SOUND ═══════════════
   A game about rhyme, meter, a refrain and a crowd of voices.
   Small, dry, close. Voices and paper, not an orchestra.

   WHICH CLOCK (the rule for the whole file, because this is the
   area that has to pick one). There are four, not three:

   `dt`, the sim clock step() receives. Multiplied by the dilation
   factor, so it crawls at 30% during a recital. Game logic.

   `real`, wall time. Anything that must not slow down when somebody
   casts: ambience, and the audio frame itself.

   `ac.currentTime`. Anything AUDIBLE schedules against this and
   nothing else. A scheduler driven off dt slows the music down with
   the game, and a tune that rubatos every time you cast is not a
   tune.

   beat(), the story sequencer, which every scripted sequence in the
   file already uses. Its timers are decremented inside stepScene,
   which takes the sim dt, so BEATS ARE DILATED. doVerse holds
   RT.dilate at 6 for six seconds: a beat(2, fn) queued in that
   window fires at about 6.2 real seconds, while the text beside it
   runs on setTimeout and the music beside that runs on currentTime,
   both at full speed. Sequencing an ending against audio means
   real time or currentTime, not beat().

   Distance is not a clock but it is the fourth answer: footsteps
   pace off the ground actually covered, because that is the only
   quantity that stays right under both dilation and a wall.

   Everything lives on RT.audio, never at module scope: close()
   closes the context and nulls RT, so state parked outside would
   come back on reopen pointing at a dead context. */

/* the graph:  osc/noise -> [filter] -> gain -> bus -> master -> out
   Four buses so one can duck under another: `voice` is the player's
   mouth, `world` is everything else in the fiction, `ui` is the
   menus, `music` is the ballad. */
var BUSES = ['voice', 'world', 'ui', 'music'];

function volNow() { var v = S && S.opts ? S.opts.vol : null; return clamp(v == null ? 0.7 : v, 0, 1); }
/* The catch below used to swallow everything: a bad ramp target, a
   null node, a typo, all of it silent. Count and surface instead. */
function audioErr(e) {
    if (!RT || !RT.audio) return;
    RT.audio.errs++;
    RT.audio.lastErr = (e && e.message) || String(e);
    if (RT.audio.errs <= 3 && window.console && console.warn) console.warn('NINTH audio: ' + RT.audio.lastErr);
}
/* exponentialRampToValueAtTime throws on a zero target and on a zero
   starting value, and any level computed from game state (stack
   count, boss health, distance) can reach zero. Everything ramps
   through here so that can never be the bug. */
function ramp(p, to, at) { p.exponentialRampToValueAtTime(Math.max(0.0001, to), at); }

function audioRig() {
    if (!S || !S.opts.sound || !RT || !RT.audio) return null;
    try {
        if (!RT.ac) RT.ac = new (window.AudioContext || window.webkitAudioContext)();
        var ac = RT.ac, A = RT.audio;
        if (ac.state === 'suspended' && !A.held) ac.resume();
        if (ac.state !== 'running') return null;
        if (!A.ready) {
            A.master = ac.createGain();
            A.master.gain.value = volNow();
            A.master.connect(ac.destination);
            A.bus = {};
            BUSES.forEach(function (k) {
                var g = ac.createGain(); g.gain.value = 1; g.connect(A.master); A.bus[k] = g;
            });
            /* one noise buffer for the life of the context. The old code
               allocated a fresh one per shot, inside the hit loop. */
            var len = Math.floor(ac.sampleRate * 2), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
            for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
            A.noise = b;
            A.ready = 1;
        }
        return A;
    } catch (e) { audioErr(e); return null; }
}
function busGain(name) {
    var A = RT && RT.audio; if (!A || !A.ready) return null;
    return A.bus[name] || A.bus.world;
}
/* one sound. Everything in the game is built out of this. */
function snd(o) {
    var A = audioRig(); if (!A) return;
    try {
        var ac = RT.ac;
        var t0 = (o.at || ac.currentTime) + (o.delay || 0);
        var dur = o.dur == null ? 0.2 : o.dur;
        var n = o.voices || 1;
        var vol = (o.vol == null ? 0.1 : o.vol) / Math.sqrt(n);
        var g = ac.createGain(), tail = g;
        if (o.cut) {
            var fl = ac.createBiquadFilter();
            fl.type = o.cutType || 'lowpass';
            fl.frequency.setValueAtTime(Math.max(30, o.cut), t0);
            if (o.cut1) fl.frequency.exponentialRampToValueAtTime(Math.max(30, o.cut1), t0 + dur);
            if (o.q != null) fl.Q.value = o.q;
            g.connect(fl); tail = fl;
        }
        tail.connect(busGain(o.bus) || A.master);
        var atk = o.atk == null ? 0.006 : o.atk;
        g.gain.setValueAtTime(0.0001, t0);
        ramp(g.gain, vol, t0 + atk);
        if (o.hold) g.gain.setValueAtTime(Math.max(0.0001, vol), t0 + atk + o.hold);
        ramp(g.gain, 0.0001, t0 + Math.max(atk + 0.01, dur));
        if (o.noise) {
            var src = ac.createBufferSource();
            src.buffer = A.noise; src.loop = true;
            if (o.rate) src.playbackRate.value = o.rate;
            src.connect(g); src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.06);
        } else {
            for (var i = 0; i < n; i++) {
                var osc = ac.createOscillator();
                osc.type = o.type || 'sine';
                if (n > 1) osc.detune.value = (i - (n - 1) / 2) * (o.det || 7);
                osc.frequency.setValueAtTime(Math.max(20, o.f0), t0);
                if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + dur);
                osc.connect(g); osc.start(t0); osc.stop(t0 + dur + 0.06);
            }
        }
    } catch (e) { audioErr(e); }
}

/* ─────────────── the five voices ───────────────
   Hunger, reveal, command, shadow, stillness. They are the whole
   mechanical vocabulary and they are colour coded in the UI, so
   they get five timbres you can tell apart with your eyes shut.
   A family sounds like itself all the way through: the Call that
   plants the stack, the stack landing, and the Answer that
   detonates it are the same instrument at three sizes.
   The family is read out of game state here rather than passed in,
   so no call site anywhere else in the file has to change. */
function famOf(kind) {
    if (kind === 'answer' || kind === 'slant') return typeof answerFam === 'function' ? answerFam() : 'eat';
    return typeof callFam === 'function' ? callFam() : 'eat';
}
function voxCall(f) {
    if (f === 'eat')       { snd({ bus: 'voice', type: 'sawtooth', f0: 300, f1: 168, dur: 0.14, vol: 0.075, cut: 1500, cut1: 430, q: 5 });
                             snd({ bus: 'voice', noise: 1, dur: 0.06, vol: 0.022, cut: 800 }); }
    /* struck glass. The tone carries this one, so it is not filtered:
       a highpass above the fundamental would take the note away and
       leave only the tick. The tick is highpassed, the tone is not. */
    else if (f === 'ight') { snd({ bus: 'voice', type: 'triangle', f0: 1180, f1: 1460, dur: 0.10, vol: 0.055, atk: 0.002 });
                             snd({ bus: 'voice', noise: 1, dur: 0.05, vol: 0.02, cut: 4200, cutType: 'highpass' }); }
    /* flat, no slide: -erd is a word said plainly, and a spoken word
       does not glissando. It is the only family with no pitch move. */
    else if (f === 'erd')  { snd({ bus: 'voice', type: 'square', f0: 232, dur: 0.11, vol: 0.06, cut: 760, cutType: 'bandpass', q: 7, atk: 0.004 }); }
    else if (f === 'ark')  { snd({ bus: 'voice', type: 'triangle', f0: 430, f1: 205, dur: 0.24, vol: 0.06, cut: 1250, cut1: 300, q: 3, atk: 0.02 }); }
    /* -ill stops. Short, hard, and then nothing: the silence after it
       is the effect, so it gets no tail at all. It sits in the middle
       register and stays dry, which is what keeps it clear of -ight:
       one of them rings and the other one is cut off. */
    else if (f === 'ill')  { snd({ bus: 'voice', type: 'square', f0: 660, dur: 0.05, vol: 0.055, cut: 1400, atk: 0.001 });
                             snd({ bus: 'voice', noise: 1, dur: 0.03, vol: 0.03, cut: 6000, cutType: 'highpass' }); }
}
function voxLand(f) {
    if (f === 'eat')       { snd({ bus: 'world', type: 'sawtooth', f0: 215, f1: 145, dur: 0.10, vol: 0.05, cut: 900, cut1: 300, q: 4 }); }
    /* the glass rings, with a partial well off the harmonic series so
       it reads as struck rather than played */
    else if (f === 'ight') { snd({ bus: 'world', type: 'sine', f0: 1620, dur: 0.22, vol: 0.04, atk: 0.001 });
                             snd({ bus: 'world', type: 'sine', f0: 4471, dur: 0.13, vol: 0.014, atk: 0.001 }); }
    else if (f === 'erd')  { snd({ bus: 'world', type: 'square', f0: 196, dur: 0.075, vol: 0.045, cut: 700, cutType: 'bandpass', q: 6 }); }
    else if (f === 'ark')  { snd({ bus: 'world', type: 'sine', f0: 300, f1: 176, dur: 0.20, vol: 0.045, cut: 900, cut1: 260 }); }
    /* and this one does not ring. Same event, opposite behaviour. */
    else if (f === 'ill')  { snd({ bus: 'world', type: 'square', f0: 520, dur: 0.03, vol: 0.05, cut: 1200, atk: 0.001 }); }
    snd({ bus: 'world', noise: 1, dur: 0.04, vol: 0.025, cut: 1800 });
}
function voxAnswer(f, flat) {
    var v = flat ? 0.5 : 1;                       // a slant works, it just falls flat
    if (f === 'eat') {
        snd({ bus: 'voice', type: 'sawtooth', f0: 186, f1: 66, dur: 0.52, vol: 0.10 * v, voices: 3, det: 11, cut: 1900, cut1: 250, q: 3 });
        snd({ bus: 'world', noise: 1, dur: 0.34, vol: 0.055 * v, cut: 1100, cut1: 300 });
    } else if (f === 'ight') {
        [900, 1350, 1802].forEach(function (fq, i) {
            snd({ bus: 'voice', type: 'sine', f0: fq, dur: 0.42 - i * 0.07, vol: 0.055 * v, atk: 0.002 });
        });
        snd({ bus: 'world', noise: 1, dur: 0.26, vol: 0.05 * v, cut: 1400, cut1: 8000, cutType: 'bandpass', q: 1.2 });
    } else if (f === 'erd') {
        /* a full stop. It ends where it ends and there is no ring-out. */
        snd({ bus: 'voice', type: 'square', f0: 152, dur: 0.24, vol: 0.085 * v, cut: 900, cut1: 480, cutType: 'bandpass', q: 5 });
        snd({ bus: 'voice', type: 'square', f0: 304, dur: 0.20, vol: 0.04 * v, cut: 1100, cutType: 'bandpass', q: 6 });
        snd({ bus: 'world', noise: 1, dur: 0.08, vol: 0.04 * v, cut: 500 });
    } else if (f === 'ark') {
        /* something leaving the room: the pitch walks out and the air
           it was standing in takes another half second to close. */
        snd({ bus: 'voice', type: 'sawtooth', f0: 205, f1: 46, dur: 0.78, vol: 0.085 * v, voices: 2, det: 9, cut: 950, cut1: 140, q: 2 });
        snd({ bus: 'world', noise: 1, dur: 0.85, vol: 0.05 * v, cut: 700, cut1: 160, atk: 0.09 });
    } else if (f === 'ill') {
        /* everything stops, and then the floor goes. The top half is
           cut off short on purpose so the gap before the sub is
           audible: the silence is the sound. Squares rather than the
           sines -ight uses, or the two families meet in the middle. */
        snd({ bus: 'voice', type: 'square', f0: 660, dur: 0.07, vol: 0.06 * v, cut: 1500, atk: 0.001 });
        snd({ bus: 'voice', type: 'square', f0: 990, dur: 0.05, vol: 0.035 * v, cut: 1900, atk: 0.001 });
        snd({ bus: 'world', noise: 1, dur: 0.05, vol: 0.045 * v, cut: 5200, cutType: 'highpass' });
        snd({ bus: 'world', type: 'sine', f0: 84, f1: 58, dur: 0.5, vol: 0.07 * v, atk: 0.004, delay: 0.14 });
    }
}

/* ─────────────── the tune ───────────────
   D Dorian: minor, but with the raised sixth that keeps it from
   settling into plain grief. It is where this kind of song lives.

   The town's version and the true version are THE SAME TUNE with
   the ending changed, because that is literally the plot. Somebody
   snapped the last line off and nailed a shorter one over the hole.
   So the town's last line is a note short and stops on the second
   degree, hanging, never resolving. The true one walks the last
   four notes down and lands on the tonic.

   Your three Stanzas are the true version, so they resolve. The
   Chorus is the town's, so it does not. Nobody says this out loud
   either. */
var KEYHZ = 146.83;                                        // D3
var DORIAN = [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17];
function deg(d, oct) { return KEYHZ * Math.pow(2, (DORIAN[clamp(d, 1, 11) - 1] + (oct || 0) * 12) / 12); }
var MEL = {
    a: [[1, 1], [1, 1], [3, 1], [5, 1], [5, 1], [6, 1], [5, 2]],            // first line, opens upward
    b: [[5, 1], [5, 1], [4, 1], [3, 1], [2, 2]],                            // second, half cadence, hangs on 2
    c: [[1, 1], [1, 1], [3, 1], [5, 1], [5, 1], [6, 1], [7, 1], [5, 1]],    // third, reaches highest
    d: [[5, 1], [4, 1], [3, 1], [2, 1], [1, 2]],                            // fourth, walks down and lands
    lie: [[5, 1], [4, 1], [3, 1], [2, 2]]                                   // the nailed-on ending: a note short, stops on 2
};
var MEL_LINES = ['a', 'b', 'c', 'd'];
/* doVerse lays every BALLAD line this far apart. The number is job
   1's, written as 260 inside doVerse; this is the music's copy of it.
   Everything else about the Verse score is derived from BALLAD, so
   adding a stanza cannot run the words past the end of the tune. If
   doVerse's 260 ever moves, this moves with it. */
var VERSE_SPL = 0.26;
/* schedule one line. Returns how long it runs, so a caller can lay
   the next line straight after it without a timer. */
function sing(mel, at, o) {
    o = o || {};
    var sp = 60 / (o.bpm || 96), t = at, i;
    for (i = 0; i < mel.length; i++) {
        var b = mel[i][1] * sp;
        snd({ bus: 'music', at: t, type: o.type || 'triangle', f0: deg(mel[i][0], o.oct || 0),
              dur: b * (o.legato == null ? 0.94 : o.legato), vol: o.vol == null ? 0.055 : o.vol,
              atk: o.atk == null ? 0.02 : o.atk, cut: o.cut || 2400, q: o.q,
              voices: o.voices || 1, det: o.det || 0 });
        t += b;
    }
    return t - at;
}
/* a whole four line stanza. `true` gives it the ending that rhymes. */
function singStanza(at, trueEnd, o) {
    var t = at, i;
    for (i = 0; i < 4; i++) {
        var m = i === 3 ? (trueEnd ? MEL.d : MEL.lie) : MEL[MEL_LINES[i]];
        t += sing(m, t, o);
    }
    return t - at;
}
/* The tune reduced to one note a line: the peak of each phrase, and
   then the note the phrase ends on.
   This exists because the text is much faster than the tune. A stanza
   recital is 1.5s for four lines and the Verse gives each line 260ms,
   while the melody above wants about thirteen seconds a stanza. Sung
   in full it would drift a bar behind the words inside one stanza and
   a mile behind by the end of the Verse. So where the text sets the
   pace, the skeleton is what plays: same contour, same crucial last
   note, locked to the line it belongs to.
   The fourth line is NOT reduced, and that is the point of the whole
   job. The Chorus hammers the town's last line at the player every
   5.5 seconds, so that descent is the only tune they actually learn.
   If the true version answered it with a single held note they would
   have nothing to compare, and the ending would land on nobody. So
   line four plays the real phrase at both endings, on the same five
   slots at the same speed. The true one walks 5 4 3 2 1 and fills
   them. The town's one walks 5 4 3 2 and leaves the last slot empty,
   which is the hole in the song, in the song. */
function singReduced(at, secPerLine, trueEnd, o) {
    o = o || {};
    var degs = [5, 2, 7], i;
    function note(d, tAt, dur) {
        snd({ bus: 'music', at: tAt, type: o.type || 'triangle', f0: deg(d, o.oct || 0),
              dur: dur, vol: o.vol == null ? 0.055 : o.vol,
              atk: Math.min(o.atk == null ? 0.02 : o.atk, dur * 0.25),
              cut: o.cut || 2400, q: o.q, voices: o.voices || 1, det: o.det || 0 });
    }
    for (i = 0; i < 3; i++) note(degs[i], at + i * secPerLine, secPerLine * 0.9);
    var end = trueEnd ? MEL.d : MEL.lie, sp = secPerLine / 5;
    for (i = 0; i < end.length; i++) note(end[i][0], at + 3 * secPerLine + i * sp, sp * 0.9);
    return secPerLine * 4;
}

/* ─────────────── ambience ───────────────
   Between discrete events this game used to be completely silent.
   Each place gets a bed: a drone, a filtered noise layer, and its
   own occasional one-shots.

   dhz multiplies the base drone, which is deg(1, -1) = 73.4 Hz. Keep
   every product above about 50 Hz. Below that a laptop reproduces
   nothing and below 20 Hz nobody hears anything at all, so a place
   tuned down there reads as the audio having failed rather than as
   atmosphere. The mark used to sit at 18 Hz for exactly that reason
   and it was silent, not uneasy.

   d2 is the second drone's ratio and d2v its relative level. The loft
   puts one a tritone above the other. The mark puts one 1.2 Hz off
   the other at equal level, so the pair beats against itself about
   once a second: audible, and unpleasant to stand in the way the
   place is supposed to be. */
var AMB = {
    stage:   { drone: 1, dhz: 1, dvol: 0.014, cut: 460, hiss: 0.010, ev: 'crowd', evT: [2.2, 5.0] },
    square:  { drone: 1, dhz: 1, dvol: 0.010, cut: 700, hiss: 0.013, ev: 'town',  evT: [3.0, 7.5] },
    lane:    { drone: 0,          dvol: 0,     cut: 900, hiss: 0.018, ev: 'bird',  evT: [4.5, 11] },
    mill:    { drone: 1, dhz: 1.5, dvol: 0.010, cut: 820, hiss: 0.017, ev: 'wheel', evT: [1.5, 1.9] },
    loft:    { drone: 2, dhz: 1, d2: 1.414, dvol: 0.020, cut: 330, hiss: 0.007, ev: 'creak', evT: [3.5, 9] },
    village: { drone: 1, dhz: 1, dvol: 0.008, cut: 650, hiss: 0.011, ev: 'town',  evT: [4.5, 11] },
    mark:    { drone: 2, dhz: 1, d2: 1.0163, d2v: 1, dvol: 0.011, cut: 190, hiss: 0.003, ev: 'tick', evT: [6, 15] },
    arena:   { drone: 0, dvol: 0, cut: 600, hiss: 0.006, ev: '', evT: [9, 9] }
};
function ambStop(fade) {
    var A = RT && RT.audio; if (!A || !A.amb) return;
    var a = A.amb; A.amb = null; A.ambKind = '';
    try {
        var ac = RT.ac, t = ac.currentTime, f = fade == null ? 0.4 : fade;
        ramp(a.g.gain, 0.0001, t + f);
        a.nodes.forEach(function (n) { try { n.stop(t + f + 0.05); } catch (e) {} });
        /* unhook the bed's gain when its last source actually ends, rather
           than on a timer. A timer here would be one entry per doorway in
           RT.timers, which is only emptied by close(), and would leave a
           dead gain node hanging off the bus for every place you ever
           walked through. */
        var last = a.nodes[a.nodes.length - 1];
        if (last) last.onended = function () { try { a.g.disconnect(); } catch (e) {} };
        else a.g.disconnect();
    } catch (e) { audioErr(e); }
}
function ambStart(kind) {
    var A = audioRig(); if (!A) return;
    if (A.ambKind === kind) return;
    ambStop();
    var spec = AMB[kind] || AMB.arena;
    try {
        var ac = RT.ac, t = ac.currentTime;
        var g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        ramp(g.gain, 1, t + 0.8);
        g.connect(busGain('world') || A.master);
        var nodes = [];
        if (spec.hiss > 0) {
            var src = ac.createBufferSource(), ng = ac.createGain(), nf = ac.createBiquadFilter();
            src.buffer = A.noise; src.loop = true; src.playbackRate.value = 0.55;
            nf.type = 'lowpass'; nf.frequency.value = spec.cut; nf.Q.value = 0.6;
            ng.gain.value = spec.hiss;
            src.connect(nf); nf.connect(ng); ng.connect(g); src.start(t);
            nodes.push(src);
        }
        for (var i = 0; i < (spec.drone || 0); i++) {
            var o = ac.createOscillator(), og = ac.createGain();
            o.type = 'sine';
            /* the loft's second drone is a tritone above the first. It is
               the only interval in the game that is wrong on purpose. */
            o.frequency.value = deg(1, -1) * (spec.dhz || 1) * (i === 1 ? (spec.d2 || 1.414) : 1);
            og.gain.value = i === 1 ? spec.dvol * (spec.d2v == null ? 0.5 : spec.d2v) : spec.dvol;
            o.connect(og); og.connect(g); o.start(t);
            nodes.push(o);
        }
        A.amb = { g: g, nodes: nodes, spec: spec };
        A.ambKind = kind;
        A.evT = rnd(spec.evT[0], spec.evT[1]);
    } catch (e) { audioErr(e); }
}
/* the occasional things on top of the bed */
function ambEvent(ev) {
    if (ev === 'crowd')      { snd({ bus: 'world', noise: 1, dur: rnd(0.5, 1.1), vol: 0.014, cut: 520, atk: 0.25, rate: 0.5 }); }
    else if (ev === 'town')  { snd({ bus: 'world', type: 'triangle', f0: deg(pick([1, 3, 5]), 0), dur: 0.5, vol: 0.012, atk: 0.12, cut: 900 }); }
    else if (ev === 'bird')  { snd({ bus: 'world', type: 'sine', f0: rnd(1700, 2300), f1: rnd(2400, 3000), dur: 0.09, vol: 0.016, atk: 0.01 }); }
    /* the wheel: a wooden knock and the water it drags round with it */
    else if (ev === 'wheel') { snd({ bus: 'world', type: 'triangle', f0: 96, f1: 62, dur: 0.13, vol: 0.03, cut: 420 });
                               snd({ bus: 'world', noise: 1, dur: 0.36, vol: 0.012, cut: 1300, atk: 0.05, delay: 0.06 }); }
    else if (ev === 'creak') { snd({ bus: 'world', type: 'sawtooth', f0: rnd(150, 230), f1: rnd(90, 130), dur: rnd(0.3, 0.7), vol: 0.016, cut: 500, q: 4, atk: 0.14 }); }
    else if (ev === 'tick')  { snd({ bus: 'world', noise: 1, dur: 0.025, vol: 0.012, cut: 3000, cutType: 'highpass' }); }
}
/* footsteps. sfx('step') fires only from the dash and never was one;
   this is the real thing, off RT.walking, with the surface under it. */
var SURF = { stage: 'wood', town: 'stone', mill: 'grass', loft: 'wood' };
var STEP_TILES = 2.38;                       // one stride, in world tiles
function footstep() {
    var p = typeof place === 'function' ? place() : null;
    var s = SURF[(p && p.floor) || 'town'] || 'stone';
    if (s === 'wood')       { snd({ bus: 'world', type: 'triangle', f0: rnd(120, 160), f1: 80, dur: 0.07, vol: 0.03, cut: 700 });
                              snd({ bus: 'world', noise: 1, dur: 0.04, vol: 0.014, cut: 1600 }); }
    else if (s === 'grass') { snd({ bus: 'world', noise: 1, dur: 0.07, vol: 0.022, cut: 2600, cutType: 'bandpass', q: 0.9 }); }
    else                    { snd({ bus: 'world', noise: 1, dur: 0.05, vol: 0.018, cut: 2000 });
                              snd({ bus: 'world', type: 'sine', f0: rnd(90, 120), dur: 0.05, vol: 0.018 }); }
}

/* ─────────────── the audio frame ───────────────
   Real time only. Never dt: ambience and footsteps must not slow
   down because somebody cast a stanza. */
function stepAudio(real) {
    var A = RT && RT.audio; if (!A) return;
    /* Sound off has to stop what is already on the timeline, not only
       what has not started yet. A stanza runs 1.5s, the Chorus refrain
       2.3s and the Verse drone 7.6s, so gating new calls alone leaves
       the ballad playing under a setting that reads OFF. */
    if (!S.opts.sound) {
        if (A.amb) ambStop(0.2);
        if (A.ready && !A.muted && RT.ac) {
            A.muted = 1;
            try { ramp(A.master.gain, 0.0001, RT.ac.currentTime + 0.12); } catch (e) { audioErr(e); }
        }
        return;
    }
    if (A.muted) { A.muted = 0; audioVolume(volNow()); }
    if (!audioRig()) return;
    if (A.ambKind !== RT.place) { ambStart(RT.place); A.settle = 0.35; }
    if (A.amb && A.amb.spec.ev) {
        A.evT -= real;
        if (A.evT <= 0) { A.evT = rnd(A.amb.spec.evT[0], A.amb.spec.evT[1]); ambEvent(A.amb.spec.ev); }
    }
    /* footsteps, paced by the ground actually covered.
       Reading RT.walking alone is not enough: stepPlayer sets it from
       the keys held, before moveActor decides whether the move was
       legal, so holding W against a wall walks on the spot forever.
       And pacing off real time is wrong the moment anything dilates:
       the Verse holds RT.dilate at 6 for six seconds, over which the
       legs run at 30% and the feet would run at 100%, about three
       steps for every one stride. The distance is the only thing that
       knows both, so the distance is what counts. */
    if (RT.dead || RT.dialog || !RT.walking) { A.stepT = STEP_TILES * 0.35; A.lx = RT.px; A.ly = RT.py; }
    else {
        var ddx = RT.px - (A.lx == null ? RT.px : A.lx), ddy = RT.py - (A.ly == null ? RT.py : A.ly);
        A.lx = RT.px; A.ly = RT.py;
        var moved = Math.sqrt(ddx * ddx + ddy * ddy);
        if (moved > 1.5) moved = 0;                    // a doorway, not a stride
        if (moved > 0) {
            A.stepT -= moved;
            if (A.stepT <= 0) { A.stepT = STEP_TILES; footstep(); }
        }
    }
    /* getting your breath back, read off the runtime rather than by
       putting a call into stepPlayer, which is not mine to edit */
    if (RT.winded > 0) A.wasWinded = 1;
    else if (A.wasWinded) { A.wasWinded = 0; sfx('breath'); }
    /* one pass over the foes, doing two things.
       Arrivals get a sound. They are tagged here rather than in
       spawnFoe, whose object literal is job 4's and is the single line
       in the file they are most certain to rewrite.
       And the Chorus telegraphs its pulse: stepChorus sets f.warn 1.1s
       out, so there is something to hear before there is a ring to
       see. Rising edge only, and no field initialiser needed for it
       because !undefined is already true on the first frame. */
    if (A.settle > 0) A.settle -= real;
    var alive = 0, arrived = 0;
    for (var i = 0; i < RT.foes.length; i++) {
        var f = RT.foes[i];
        if (!f) continue;
        if (!f.dead) alive++;
        if (!f._as) { f._as = 1; if (!f.dead) arrived++; }
        if (f.dead || !f.def || !f.def.boss) continue;
        if (f.warn && !f._aw) { f._aw = 1; sfx('pulsewarn'); }
        else if (!f.warn && f._aw) f._aw = 0;
    }
    /* a room filling up is a different event from one more thing
       wandering into a fight already in progress, and a big draw is
       different again. All three are read off the arrivals rather
       than off RT.wave, which counts pending waves and is job 4's.
       Nothing at all until the room has settled, because walking
       through a doorway means meeting everything already in there. */
    if (arrived && !(A.settle > 0)) {
        if (A.alive) sfx('spawn');
        else sfx(arrived >= 4 ? 'wave2' : 'wave');
    }
    A.alive = alive;
}

/* ─────────────── sfx ───────────────
   Everyone else in the file calls this with whatever name reads
   right at the call site. An unknown name falls off the end and
   does nothing: no throw, no console noise. */
function sfx(kind) {
    if (!S || !S.opts.sound || !RT) return;
    var A = audioRig(); if (!A) return;
    try {
        var f = famOf(kind);
        /* ---- the verbs ---- */
        if (kind === 'call') voxCall(f);
        else if (kind === 'hit') voxLand(f);
        else if (kind === 'answer') voxAnswer(f, false);
        else if (kind === 'slant') { voxAnswer(f, true); snd({ bus: 'voice', type: 'square', f0: 132, f1: 118, dur: 0.26, vol: 0.03, cut: 480, q: 2 }); }
        else if (kind === 'empty') snd({ bus: 'ui', type: 'sine', f0: 258, f1: 244, dur: 0.13, vol: 0.022, cut: 900 });
        /* a stack you never answered. It should sound like your own
           line coming apart, so it is the call timbre played backwards
           into a thud. */
        else if (kind === 'sour' || kind === 'break') {
            snd({ bus: 'voice', type: 'sawtooth', f0: 190, f1: 74, dur: 0.34, vol: 0.07, cut: 700, cut1: 200, q: 3 });
            snd({ bus: 'world', noise: 1, dur: 0.2, vol: 0.045, cut: 900, cut1: 220 });
        }
        else if (kind === 'winded') { snd({ bus: 'voice', noise: 1, dur: 0.5, vol: 0.055, cut: 1500, cut1: 400, atk: 0.02 });
                                      snd({ bus: 'voice', type: 'sine', f0: 152, f1: 58, dur: 0.55, vol: 0.05 }); }
        else if (kind === 'breath') { snd({ bus: 'voice', noise: 1, dur: 0.42, vol: 0.03, cut: 500, cut1: 1900, atk: 0.16 }); }
        /* ---- the ballad ---- */
        else if (kind === 'stanza') {
            /* your stanzas are the corrected ballad, so they resolve.
               doStanza sets RT.recital immediately before calling this,
               which is where the stanza number comes from. */
            var rn = RT.recital && RT.recital.n;
            var fam = rn && STANZAS[rn - 1] ? STANZAS[rn - 1].fam : f;
            /* one note a line, on the recital's own clock, so the note
               lands with the line rather than a bar behind it */
            singReduced(RT.ac.currentTime + 0.02, T('dilationT') / 4, true,
                        { vol: 0.05, voices: 2, det: 6, cut: 2600 });
            voxCall(fam);
        }
        else if (kind === 'wave')  { snd({ bus: 'world', type: 'sine', f0: 300, f1: 118, dur: 0.28, vol: 0.05, cut: 1600, cut1: 400 });
                                     snd({ bus: 'world', noise: 1, dur: 0.14, vol: 0.04, cut: 1200 }); }
        else if (kind === 'wave2') { snd({ bus: 'world', type: 'sine', f0: 200, f1: 54, dur: 0.55, vol: 0.09, cut: 1400, cut1: 220 });
                                     snd({ bus: 'world', noise: 1, dur: 0.34, vol: 0.07, cut: 1000, cut1: 260 }); }
        /* the whole corrected ballad, sung under the 28 lines. 27 of
           them used to land in silence. */
        else if (kind === 'verse') {
            /* the music runs on doVerse's own grid, counted off BALLAD.
               Every stanza ends on the note the town's version never
               reaches, and the last one goes up an octave. */
            var t0 = RT.ac.currentTime + 0.05, k, n = BALLAD.length, lines = 0;
            for (k = 0; k < n; k++) lines += BALLAD[k].r.length;
            for (k = 0; k < n; k++) {
                t0 += singReduced(t0, VERSE_SPL, true, { vol: 0.05, voices: 3, det: 8, cut: 2800, oct: k === n - 1 ? 1 : 0 });
            }
            snd({ bus: 'music', type: 'sine', f0: deg(1, -1), dur: lines * VERSE_SPL + 0.4, vol: 0.03, atk: 0.5 });
        }
        /* ---- the Chorus ---- */
        else if (kind === 'pulsewarn') {
            /* you hear it coming before you see it */
            snd({ bus: 'world', type: 'sawtooth', f0: 62, f1: 128, dur: 1.0, vol: 0.045, voices: 4, det: 16, cut: 300, cut1: 900, atk: 0.35 });
        }
        else if (kind === 'pulse') {
            /* a crowd, in unison, saying the line that does not rhyme.
               Detuned stacked voices and the ending that stops short. */
            sing(MEL.lie, RT.ac.currentTime + 0.02, { bpm: 132, vol: 0.05, voices: 7, det: 15, type: 'sawtooth', cut: 1500, q: 1, legato: 0.99 });
            snd({ bus: 'world', type: 'sawtooth', f0: 118, f1: 52, dur: 0.7, vol: 0.075, voices: 3, det: 12, cut: 900, cut1: 200 });
            snd({ bus: 'world', noise: 1, dur: 0.45, vol: 0.06, cut: 1100, cut1: 250 });
        }
        else if (kind === 'voice') { snd({ bus: 'world', type: 'square', f0: 300, f1: 196, dur: 0.22, vol: 0.04, voices: 3, det: 14, cut: 1300, q: 2 }); }
        /* ---- enemies and the body ---- */
        else if (kind === 'bite')  { snd({ bus: 'world', noise: 1, dur: 0.07, vol: 0.05, cut: 2200, cutType: 'bandpass', q: 1.4 });
                                     snd({ bus: 'world', type: 'square', f0: 262, f1: 136, dur: 0.09, vol: 0.04, cut: 1400 }); }
        else if (kind === 'steal') { snd({ bus: 'world', type: 'sawtooth', f0: 510, f1: 176, dur: 0.22, vol: 0.05, cut: 2200, cut1: 700, q: 3 }); }
        else if (kind === 'die')   { snd({ bus: 'world', noise: 1, dur: 0.18, vol: 0.05, cut: 1500, cut1: 400 });
                                     snd({ bus: 'world', type: 'triangle', f0: 182, f1: 68, dur: 0.26, vol: 0.05, cut: 1100 }); }
        else if (kind === 'spawn') { snd({ bus: 'world', type: 'sawtooth', f0: 70, f1: 150, dur: 0.28, vol: 0.035, cut: 400, cut1: 1100, atk: 0.06, voices: 2, det: 9 }); }
        else if (kind === 'hurt')  { snd({ bus: 'world', noise: 1, dur: 0.11, vol: 0.07, cut: 1800, cut1: 500 });
                                     snd({ bus: 'world', type: 'sawtooth', f0: 172, f1: 78, dur: 0.15, vol: 0.05, cut: 1200 }); }
        else if (kind === 'down')  { snd({ bus: 'world', noise: 1, dur: 0.45, vol: 0.08, cut: 1200, cut1: 200 });
                                     snd({ bus: 'world', type: 'sine', f0: 132, f1: 42, dur: 0.8, vol: 0.08 });
                                     sing(MEL.lie, RT.ac.currentTime + 0.15, { bpm: 78, vol: 0.03, voices: 4, det: 18, type: 'sawtooth', cut: 700 }); }
        else if (kind === 'step')  { snd({ bus: 'world', noise: 1, dur: 0.06, vol: 0.03, cut: 2400, cutType: 'bandpass', q: 0.8 }); }
        /* ---- world and ui ---- */
        else if (kind === 'travel') { snd({ bus: 'ui', type: 'triangle', f0: deg(1, 0), dur: 0.3, vol: 0.03, atk: 0.02 });
                                      snd({ bus: 'ui', type: 'triangle', f0: deg(5, 0), dur: 0.35, vol: 0.025, atk: 0.02, delay: 0.09 }); }
        else if (kind === 'coin')  { snd({ bus: 'ui', type: 'square', f0: 720, f1: 1040, dur: 0.07, vol: 0.03, cut: 4000 });
                                     snd({ bus: 'ui', type: 'square', f0: 1080, dur: 0.06, vol: 0.02, delay: 0.05 }); }
        /* a fragment landing is the point of the whole game. It gets a
           rising open fifth and the tonic under it. */
        else if (kind === 'frag')  { [1, 5, 8].forEach(function (d, i) {
                                        snd({ bus: 'music', type: 'triangle', f0: deg(d, 0), dur: 1.5 - i * 0.2, vol: 0.05, atk: 0.03, delay: i * 0.13 });
                                     });
                                     snd({ bus: 'music', type: 'sine', f0: deg(1, -1), dur: 2.0, vol: 0.035, atk: 0.2 }); }
        else if (kind === 'ach')   { [5, 8, 10].forEach(function (d, i) {
                                        snd({ bus: 'ui', type: 'triangle', f0: deg(d, 0), dur: 0.4, vol: 0.03, atk: 0.01, delay: i * 0.085 });
                                     }); }
        else if (kind === 'ui')    { snd({ bus: 'ui', type: 'square', f0: 530, f1: 620, dur: 0.05, vol: 0.022, cut: 3000 }); }
        /* ---- names the other jobs called for ---- */
        /* something coming out of the bag and being used. Cloth and a
           small wooden knock: an object, not a note. */
        else if (kind === 'use')   { snd({ bus: 'ui', noise: 1, dur: 0.09, vol: 0.024, cut: 1800, cutType: 'bandpass', q: 1.1 });
                                     snd({ bus: 'ui', type: 'triangle', f0: 260, f1: 210, dur: 0.06, vol: 0.022, cut: 900 }); }
        /* a word landing in your vocabulary. The same kind of event as
           a fragment and the same scale, but it stops on the fifth
           instead of climbing: you have the word, not the whole song. */
        else if (kind === 'learn') { [3, 5].forEach(function (d, i) {
                                        snd({ bus: 'music', type: 'triangle', f0: deg(d, 0), dur: 0.5 - i * 0.1, vol: 0.04, atk: 0.015, delay: i * 0.11 });
                                     });
                                     snd({ bus: 'music', type: 'sine', f0: deg(1, -1), dur: 0.9, vol: 0.025, atk: 0.12 }); }
        /* The Chorus is a crowd saying the refrain in unison. When it
           goes down the crowd stops, so what you hear is the refrain
           starting and not getting to the end of itself. */
        else if (kind === 'bossdie') {
            sing([[5, 1], [4, 1]], RT.ac.currentTime + 0.06,
                 { bpm: 108, vol: 0.05, voices: 7, det: 22, type: 'sawtooth', cut: 900 });
            snd({ bus: 'world', noise: 1, dur: 1.4, vol: 0.07, cut: 1400, cut1: 160, atk: 0.05, delay: 0.55 });
            snd({ bus: 'music', type: 'sine', f0: deg(1, -1), f1: deg(1, -1) / 2, dur: 2.2, vol: 0.06, atk: 0.1, delay: 0.5 });
        }
        /* ON AND ON. Two flat tones a couple of Hz apart, beating
           against each other, going nowhere. It is the only sound in
           the game with no pitch move and no shape: that is the joke. */
        else if (kind === 'drone') {
            snd({ bus: 'world', type: 'square', f0: 174, dur: 1.1, vol: 0.030, cut: 620, q: 2, atk: 0.12 });
            snd({ bus: 'world', type: 'square', f0: 176.6, dur: 1.1, vol: 0.026, cut: 620, q: 2, atk: 0.12 });
        }
        /* again, and again, and again: your own last word coming back
           at you, twice more and further off each time. Combat parks
           the family you actually cast on RT.lastFam. */
        else if (kind === 'reprise') {
            voxAnswer(RT.lastFam || famOf('answer'), false);
            for (var ri = 1; ri <= 2; ri++) {
                snd({ bus: 'voice', type: 'sawtooth', f0: 176 / (1 + ri * 0.22), f1: 60, dur: 0.4,
                      vol: 0.05 / (ri + 1), voices: 2, det: 10, cut: 1200, cut1: 200, delay: ri * 0.22 });
            }
        }
        /* An unknown name used to fall off the end of this chain in
           silence. That is how 'bossdie', 'drone' and 'reprise' each
           shipped mute: three jobs called them, nothing answered, and
           nothing anywhere said so. Job 4 found it and worked around
           it by firing 'die' underneath 'bossdie', with a comment
           explaining why. Nobody should have to do that again, so an
           unknown name is now a reported failure like any other. */
        else audioErr(new Error('no sound named ' + kind));
    } catch (e) { audioErr(e); }
}
/* every name sfx() answers to, for the DEV tester */
var SFX_NAMES = ['call', 'hit', 'answer', 'slant', 'empty', 'sour', 'winded', 'breath',
    'bossdie', 'drone', 'reprise', 'use', 'learn',
    'stanza', 'wave', 'wave2', 'verse', 'pulsewarn', 'pulse', 'voice', 'bite', 'steal',
    'die', 'spawn', 'hurt', 'down', 'step', 'travel', 'coin', 'frag', 'ach', 'ui'];
/* solo one bus to hear it on its own */
function audioSolo(b) {
    var A = RT && RT.audio; if (!A) return;
    A.solo = b || '';
    if (!A.ready) return;
    try {
        BUSES.forEach(function (k) {
            A.bus[k].gain.setTargetAtTime(!A.solo || A.solo === k ? 1 : 0.0001, RT.ac.currentTime, 0.02);
        });
    } catch (e) { audioErr(e); }
}
/* the desktop shell drives these: the game must go quiet behind a
   minimized window, and the taskbar volume slider is real. */
function audioSuspend() { var A = RT && RT.audio; if (!A) return; A.held = 1; if (RT.ac) { try { RT.ac.suspend(); } catch (e) {} } }
function audioResume() { var A = RT && RT.audio; if (!A) return; A.held = 0; if (RT.ac) { try { RT.ac.resume(); } catch (e) {} } }
function audioVolume(v) {
    sLoad();
    if (v == null) return volNow();
    S.opts.vol = clamp(v, 0, 1); sSave();
    var A = RT && RT.audio;
    if (A && A.ready && RT.ac) { try { A.master.gain.setTargetAtTime(volNow(), RT.ac.currentTime, 0.02); } catch (e) { audioErr(e); } }
    return volNow();
}

/* ─────────────── HUD ─────────────── */

/* ─────────────── the line, drawn ───────────────
   Four cards. The head one is the word in your mouth and it is lit;
   the three behind it are what is coming, dimming with distance, which
   is the whole reason the deal is a queue and not a die roll. */
function updateLine() {
    if (!RT || !RT.root) return;
    fillLine();
    // `.nn-hand`, not `.nn-line`: say() has built every narration div with
    // class nn-line since the first commit, and .nn-say sits above .nn-hud in
    // the markup, so querySelector('.nn-line') hands you a story line and the
    // word queue gets painted into the narration box.
    var el = RT.root.querySelector('.nn-hand');
    if (el && el._k !== RT.line.join(',')) {
        el._k = RT.line.join(',');
        el.innerHTML = RT.line.map(function (w, i) {
            var f = FAMS[WORDS[w] || 'eat'];
            return '<span class="nn-lw' + (i ? '' : ' head') + '" style="--wc:' + f.col + '">' +
                   '<b>' + esc(w.toUpperCase()) + '</b><em>' + esc(f.n) + '</em></span>';
        }).join('');
    }
    var rz = RT.root.querySelector('.nn-rhymes');
    if (!rz) return;
    var keys = rhymeKeys(), sig = [];
    var html = FAM_IDS.map(function (fam, i) {
        var have = rhymeReady(fam), n = have ? boardCount(fam) : 0, f = FAMS[fam];
        sig.push(fam + (have ? 1 : 0) + n);
        return '<button class="nn-rh' + (have ? '' : ' off') + (n ? ' live' : '') +
               '" data-nn="rhyme:' + fam + '" type="button" style="--wc:' + f.col + '" title="' + esc(f.n + ' · ' + f.d) + '">' +
               '<u>' + keys[i] + '</u><b>' + f.tag + '</b><span>' + (have ? (n || '') : '') + '</span></button>';
    }).join('');
    if (rz._k !== sig.join('|')) { rz._k = sig.join('|'); rz.innerHTML = html; }
}
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
    updateLine();          // the words you were dealt, and what is on the board
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
        : what === 'echo' ? RT.root.querySelector('.nn-echo')
        : what === 'verse' ? RT.root.querySelector('.nn-verse')
        : what.indexOf('rhyme:') === 0 ? RT.root.querySelector('.nn-rh[data-nn="rhyme:' + what.slice(6) + '"]')
        : RT.root.querySelector('.nn-st:nth-child(' + (parseInt(what.slice(6), 10) || 1) + ')');
    if (!el) return;
    el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny');
}

/* ─────────────── panels ─────────────── */
function panel(name) {
    // The shop is a person, not a menu. It used to open from anywhere,
    // including the middle of the Chorus fight, because panel() pauses
    // nothing. It now needs the chandler within earshot. The bag stays
    // openable anywhere on purpose: consumables exist to be used under
    // pressure, and a pause would take that away.
    if (name === 'shop' && RT.panel !== 'shop' && !chandlerNear()) {
        // two different refusals: standing in her shop and not bothering to
        // walk to the counter is not the same as being somewhere she is not
        say((place().npcs || []).indexOf('chandler') >= 0
            ? 'She is behind the counter. You would have to walk over.'
            : 'The chandler is not here. Her shop is off the east side of the square.', 'dim');
        sfx('ui');
        return;
    }
    var open = RT.panel === name ? null : name;
    RT.panel = open;
    ['book', 'kit', 'shop', 'bag'].forEach(function (p) { RT.root.querySelector('.nn-p-' + p).hidden = open !== p; });
    if (open === 'book') fillBook();
    else if (open === 'kit') fillKit();
    else if (open === 'shop') fillShop();
    else if (open === 'bag') fillBag();
    sfx('ui');
}
/* Per-frame item upkeep. The shop closing is not decoration: the open
   check alone was bypassable, because panel() pauses nothing and you can
   walk out of earshot with the counter still on screen and keep buying. */
function stepItems(dt) {
    RT.items.freeSlant = Math.max(0, RT.items.freeSlant - dt);   // the wax goes cold
    if (RT.panel === 'shop' && !chandlerNear()) {
        panel(null);
        say('You have walked away from the counter. She waits.', 'dim');
    }
}
/* her counter, in her own shop: close enough to talk across it */
function chandlerNear() {
    if (!RT) return false;
    if (RT.items.atShop) return true;
    var n = NPCS.chandler;
    if (!n || (place().npcs || []).indexOf('chandler') < 0) return false;
    // Measured to where she LIVES, not to where she has wandered. She drifts
    // up to 1.1 either way at 0.7 a second, and the counter is 1.2 deep, so a
    // live-position check flickers in and out while the player stands
    // perfectly still at the counter: the shop refused to open, then opened,
    // then shut itself and blamed the player for walking away. Her home spot
    // does not move, so this does not either. 4.0 reaches the whole customer
    // side of the counter and still stops well short of the door.
    return Math.hypot(n.x - RT.px, n.y - RT.py) < 4.0;
}
/* THE PLAY — the ballad as you currently know it. Full lines are
   allowed here because nothing is trying to kill you. */
function fillBook() {
    if (fragCount() === 3 && !S.a3.read) { S.a3.read = 1; sSave(); }
    var b = RT.root.querySelector('.nn-p-book .nn-pb');
    var html = '<p class="nn-note">The play, as Wick performs it. Learning a line is learning a spell. Something in it does not rhyme.</p>';
    BALLAD.forEach(function (st, i) {
        // each fragment fixes its own stanza. Hold all three and the whole
        // song resolves, including 5 and 6, which carry the reveal and had
        // no fragment of their own to unlock them.
        var known = fragCount() === 3 || S.frags[1] && i === 2 || S.frags[2] && i === 3 || S.frags[3] && i === 6;
        var lines = known ? st.r : st.t;
        html += '<div class="nn-stanza' + (known ? ' fixed' : '') + '"><b>' + (i + 1) + '</b><div>' +
            lines.map(function (l, j) {
                var isBreak = st.brk && j === 3 && !known;
                return '<i class="' + (isBreak ? 'nn-broken' : '') + '">' + esc(l) + (isBreak ? ' <s>?</s>' : '') + '</i>';
            }).join('') + '</div></div>';
    });
    html += fragCount() === 3
        ? '<p class="nn-note dim">All of it, then. Four hundred years of a song about a man who stood at a fence.</p>'
        : '<p class="nn-note dim">Every closing line runs six to eight syllables. "And he went alone" is five. Something was taken out and you can hear the hole.</p>';

    /* And the other ballad. Four hundred years of careful verse on one
       page and, on the next, whatever came out of your mouth in a barn.
       Same book on purpose. */
    var mine = Object.keys(S.poems || {});
    if (RT.poem && RT.poem.lines.length) { S.poems[RT.place] = RT.poem; if (mine.indexOf(RT.place) < 0) mine.push(RT.place); }
    html += '<h4>WHAT YOU HAVE BEEN SAYING</h4>';
    if (!mine.length) {
        html += '<p class="nn-note dim">Nothing yet. Every word you say out loud goes down here, and every sound you close ends a line. That is all a stanza is.</p>';
    } else {
        // the place you are in first, then the rest, newest work at the top
        mine.sort(function (a2, b2) { return (a2 === RT.place ? -1 : b2 === RT.place ? 1 : 0); });
        mine.slice(0, 4).forEach(function (id) {
            var pm = S.poems[id];
            if (!pm || !(pm.lines || []).length) return;
            html += '<div class="nn-poem"><header>' + esc((PLACES[id] || {}).n || id) + '</header>' + poemHtml(pm) + '</div>';
        });
    }
    b.innerHTML = html;
}
/* WORDS AND CHARMS — the build layer. One call word, one answer
   word, two charms. That is the whole thing. */
function fillKit() {
    var b = RT.root.querySelector('.nn-p-kit .nn-pb');
    var pool = poolWords(), keys = rhymeKeys();
    var html = '<p class="nn-note">You do not pick your words. Every word you have learned goes in the bag and the line deals you four at a time: <b>left click</b> says the one on your tongue, <b>right click</b> swallows it. The <b>sounds</b> are yours, on the number row, and each one closes every syllable of itself on the board at once.</p>';
    html += '<p class="nn-note dim">Learn more words in a sound and you will draw that sound more often. That is the build.</p>';
    html += '<h4>YOUR BAG <i>· ' + pool.length + ' word' + (pool.length === 1 ? '' : 's') + '</i></h4>';
    FAM_IDS.forEach(function (fid, i) {
        var fam = FAMS[fid], have = famOwned(fid);
        var mine = fam.words.filter(function (w) { return !!S.owned[w]; }).length;
        var share = pool.length ? Math.round(mine / pool.length * 100) : 0;
        html += '<div class="nn-fam' + (have ? '' : ' locked') + '"><header style="color:' + fam.col + '">' +
            (have ? '<kbd>' + keys[i] + '</kbd> ' : '') + fam.n +
            '<i>' + fam.d + '</i>' +
            (have ? '<em>' + mine + ' in the bag · ' + share + '% of your draws</em>'
                  : '<em>' + fam.from + '</em>') + '</header><div class="nn-wordrow">';
        fam.words.forEach(function (w) {
            var own = !!S.owned[w];
            html += '<span class="nn-wchip' + (own ? '' : ' dim') + '">' + esc(w.toUpperCase()) +
                (own ? '' : '<i class="nn-lock">not learned</i>') + '</span>';
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
    b.querySelectorAll('[data-charm]').forEach(function (el) {
        el.addEventListener('click', function () { wearCharm(el.getAttribute('data-charm')); fillKit(); sfx('ui'); RT.root.focus(); });
    });
}
/* WHAT YOU CARRY — things, as opposed to modifier bags */
function fillBag() {
    var el = RT.root.querySelector('.nn-p-bag');
    if (!el || el.hidden) return;                     // called from useItem too
    var b = el.querySelector('.nn-pb');
    RT.root.querySelector('.nn-bag-coin').textContent = '◦ ' + S.coin;
    var ids = ITEM_IDS.filter(function (id) { return hasItem(id); });
    var html = '<p class="nn-note">Things, rather than numbers. Some of them do something when you use them. Some of them are only worth carrying because of who they belonged to.</p>';
    if (!ids.length) html += '<p class="nn-note dim">You are carrying nothing at all. The crown does not count; you are wearing that.</p>';
    var groups = [['use', 'USE ONCE'], ['writ', 'WRITTEN ON'], ['tool', 'TOOLS'], ['keep', 'KEPT']];
    groups.forEach(function (g) {
        var mine = ids.filter(function (id) { return (ITEMS[id].tag || 'keep') === g[0]; });
        if (!mine.length) return;
        html += '<h4>' + g[1] + '</h4>';
        mine.forEach(function (id) {
            var it = ITEMS[id], n = itemCount(id);
            var label = it.writ ? 'read' : 'use';
            var extra = '';
            if (id === 'lamp' && lampsOut()) extra = '<em class="nn-bag-note">' + lampsOut() + ' set down elsewhere</em>';
            if (id === 'mask' && S.items.wearing) extra = '<em class="nn-bag-note">on your face</em>';
            html += '<div class="nn-buy"><div><b>' + esc(it.n) + (n > 1 ? ' <i class="nn-bag-x">x' + n + '</i>' : '') + '</b><i>' + esc(it.d) + '</i>' + extra + '</div>' +
                '<span class="nn-bagbtns"><button class="nn-mini" data-use="' + id + '">' + label + '</button>' +
                (it.sell ? '<button class="nn-mini" data-give="' + id + '">give ◦' + it.sell + '</button>' : '') + '</span></div>';
        });
    });
    if (S.items.lamps[RT.place]) {
        html += '<h4>ON A SILL HERE</h4><div class="nn-buy"><div><b>' + esc(ITEMS.lamp.n) +
            '</b><i>You set this one down here. It is still burning.</i></div>' +
            '<span class="nn-bagbtns"><button class="nn-mini" data-takelamp="1">take</button></span></div>';
    }
    var elsewhere = lampsElsewhere();
    if (elsewhere.length) {
        html += '<h4>LAMPS YOU HAVE LEFT SOMEWHERE</h4><p class="nn-note">' +
            elsewhere.map(function (p) { return esc((PLACES[p] && PLACES[p].n) || p); }).join(', ') +
            '. They stay where you put them.</p>';
    }
    b.innerHTML = html;
    var tl = b.querySelector('[data-takelamp]');
    if (tl) tl.addEventListener('click', function (e) { e.stopPropagation(); takeLamp(); fillBag(); RT.root.focus(); });
    b.querySelectorAll('[data-use]').forEach(function (x) {
        x.addEventListener('click', function (e) { e.stopPropagation(); useItem(x.getAttribute('data-use')); fillBag(); RT.root.focus(); });
    });
    b.querySelectorAll('[data-give]').forEach(function (x) {
        x.addEventListener('click', function (e) {
            e.stopPropagation();
            var id = x.getAttribute('data-give');
            if (!chandlerNear()) { say('There is nobody here to give it to.', 'dim'); return; }
            if (!takeItem(id, 1)) return;
            coin(ITEMS[id].sell);
            say('You hand over <b>' + esc(ITEMS[id].n) + '</b>. She does not ask where it came from.', 'good');
            sfx('coin'); fillBag(); RT.root.focus();
        });
    });
}
/* THE CHANDLER — the economy the design doc told me to cut */
function fillShop() {
    var b = RT.root.querySelector('.nn-p-shop .nn-pb');
    RT.root.querySelector('.nn-shop-coin').textContent = '◦ ' + S.coin;
    var html = '<p class="nn-note">She sells wax, wick and small objects out of other people\'s attics. She does not ask what you want them for.</p>';
    html += '<h4>CHARMS <i>· wear two</i></h4>';
    CHARM_IDS.forEach(function (id) {
        var c = CHARMS[id], owned = !!S.charms[id];
        // `own` means given, not sold. It stays on the list while it is yours
        // and goes off it the moment it is not: the only thing that takes one
        // away is the silence ending, and she does not sell that back at ◦0.
        if (c.own && !owned) return;
        // an owned charm with nothing to sell used to vanish from the shop
        // permanently, which left the late-game shop as one "sell the hilt"
        // row under an always-rendered empty WORDS header
        html += '<div class="nn-buy' + (owned ? ' got' : '') + '"><div><b>' + esc(c.n) + '</b><i>' + esc(c.d) + '</i></div>' +
            (owned ? (c.sell ? '<button class="nn-mini" data-sell="' + id + '">sell ◦' + c.sell + '</button>' : '<em class="nn-have">yours</em>')
                   : '<button class="nn-mini' + (S.coin < c.cost ? ' poor' : '') + '" data-buy="' + id + '">◦' + c.cost + '</button>') + '</div>';
    });
    // Stock, and the word market. She does not sell words: she sells the
    // things people wrote them on, and reading one is how you learn it.
    html += '<h4>OFF THE COUNTER <i>· wax, wick and small objects</i></h4>';
    var stock = ITEM_IDS.filter(function (id) { return ITEMS[id].cost && !ITEMS[id].writ; });
    stock.forEach(function (id) {
        var it = ITEMS[id], got = it.one && hasItem(id);   // there is only one slate
        html += '<div class="nn-buy' + (got ? ' got' : '') + '"><div><b>' + esc(it.n) + '</b><i>' + esc(it.d) + '</i></div>' +
            (got ? '<em class="nn-have">yours</em>'
                 : '<button class="nn-mini' + (S.coin < it.cost ? ' poor' : '') + '" data-item="' + id + '">◦' + it.cost + '</button>') + '</div>';
    });
    var writs = ITEM_IDS.filter(function (id) {
        var it = ITEMS[id];
        if (!it.writ || S.owned[it.writ]) return false;
        return famOwned(WORDS[it.writ]);              // he will not sell you a sound you cannot make
    });
    html += '<h4>WRITTEN ON THINGS <i>· somebody had to remember it</i></h4>';
    if (!writs.length) {
        // two reasons the list is empty, and only one of them is fixable. Once
        // every word is yours there is no sixth family to go and open.
        var allWords = Object.keys(WORDS).every(function (w) { return S.owned[w]; });
        html += '<p class="nn-note dim">' + (allWords
            ? 'Nothing on the counter you cannot already say. She looks almost sorry about it.'
            : 'Nothing on the counter you can read. She shrugs. Open another family and come back.') + '</p>';
    }
    writs.forEach(function (id) {
        var it = ITEMS[id], fam = FAMS[WORDS[it.writ]], got = hasItem(id);   // bought, not read yet
        html += '<div class="nn-buy' + (got ? ' got' : '') + '"><div><b>' + esc(it.n) + ' <i class="nn-writ" style="color:' + fam.col + '">' + it.writ.toUpperCase() + '</i></b><i>' + esc(it.d) + '</i></div>' +
            (got ? '<em class="nn-have">in your bag</em>'
                 : '<button class="nn-mini' + (S.coin < it.cost ? ' poor' : '') + '" data-item="' + id + '">◦' + it.cost + '</button>') + '</div>';
    });
    b.innerHTML = html;
    b.querySelectorAll('[data-buy]').forEach(function (el) { el.addEventListener('click', function () { if (buyCharm(el.getAttribute('data-buy'))) { sfx('coin'); fillShop(); } }); });
    b.querySelectorAll('[data-sell]').forEach(function (el) { el.addEventListener('click', function () { if (sellCharm(el.getAttribute('data-sell'))) { sfx('coin'); fillShop(); } }); });
    b.querySelectorAll('[data-item]').forEach(function (el) {
        el.addEventListener('click', function () { if (buyItem(el.getAttribute('data-item'))) { sfx('coin'); fillShop(); } });
    });
}
/* one transaction, validated before any coin moves. The word rows used to
   read `S.coin -= 30; learnWord(w);` and learnWord returns false for an
   unknown or already-owned word, so the cost was paid either way. */
function buyItem(id) {
    var it = ITEMS[id];
    if (!it || !it.cost) return false;
    if (S.coin < it.cost) { say('Not enough coin.', 'dim'); return false; }
    if (it.writ && S.owned[it.writ]) { say('You already have that word.', 'dim'); return false; }
    // a second copy would be dead weight: a writ is read once, and there is
    // only one slate
    if (it.writ && hasItem(id)) { say('You are already carrying that one. Read it first.', 'dim'); return false; }
    if (it.one && hasItem(id)) { say('You have one of those already.', 'dim'); return false; }
    if (!giveItem(id)) return false;                  // refuses before the coin moves
    coin(-it.cost);
    say('You take <b>' + esc(it.n) + '</b>' + (it.writ ? '. Read it when you have a moment.' : '.'), 'good');
    return true;
}

/* ═══════════════ DEV MENU ═══════════════
   The ask: test any aspect, jump anywhere, and grow with the
   game. Every control is one line in the DEV table above. */
function toggleDev() {
    wipeArmed = 0;                   // an armed wipe does not survive closing the menu
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
        b.addEventListener('click', function () { wipeArmed = 0; RT.devTab = b.getAttribute('data-dtab'); fillDev(); RT.root.focus(); });
    });
    body.querySelectorAll('[data-di]').forEach(function (b) {
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            var r = rows[+b.getAttribute('data-di')];
            if (!r) return;
            if (!r.wipe) wipeArmed = 0;             // touching anything else backs out of the confirm
            if (r.k === 'btn') r.on();
            else if (r.k === 'tgl') r.set(!r.get());
            else if (r.k === 'num') r.set(+(r.get() + (r.step || 1) * (+b.getAttribute('data-dd'))).toFixed(4));
            sSave(); fillDev(); updateHud(0); sfx('ui'); RT.root.focus();
        });
    });
    d.querySelector('.nn-dev-foot').textContent = place().n + ' · foes ' + RT.foes.filter(function (f) { return !f.dead; }).length +
        ' · breath ' + Math.round(RT.breath) + ' · echo ' + Math.round(RT.echo) + ' · coin ' + S.coin + ' · ` to close';
}

function wireHud(root) {
    // The rhyme pips are re-rendered from innerHTML whenever the board
    // changes, which throws away anything bound directly to them. Delegated,
    // once, on the container that survives.
    root.querySelector('.nn-rhymes').addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('[data-nn]') : null;
        if (!b) return;
        e.stopPropagation();
        doRhyme(b.getAttribute('data-nn').slice(6));
        root.focus();
    });
    root.querySelectorAll('[data-nn]').forEach(function (b) {
        b.addEventListener('click', function (e) {
            e.stopPropagation();
            var a = b.getAttribute('data-nn');
            if (a === 'dev') toggleDev();
            else if (a.indexOf('p:') === 0) panel(a.slice(2));
            else if (a.indexOf('rhyme:') === 0) doRhyme(a.slice(6));
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
        floor: 'town', calm: 1, script: 'wick', w: 17, h: 15, night: 1,
        props: [
            { t: 'house', b: [0, 0, 4, 3.4] }, { t: 'house', b: [5.2, 0, 3.6, 2.8] }, { t: 'house', b: [13, 0, 4, 3.6] },
            { t: 'house', b: [0, 11.6, 4.2, 3.4] }, { t: 'house', b: [13.4, 11, 3.6, 4] },
            { t: 'stagewip', b: [6.4, 3.6, 4.6, 2.6] },
            { t: 'well', b: [8, 9.4, 1.6, 1.6] },
            { t: 'cart', b: [3.4, 8.2, 2.2, 1.2] },
            { t: 'lamp', b: [11.8, 7.6, 0.5, 0.5] }, { t: 'lamp', b: [4.6, 5.2, 0.5, 0.5] }
        ],
        npcs: ['bern', 'child', 'widow'],
        looks: [
            { x: 12.4, y: 8.2, n: 'A lamp on a sill', d: 'Set out on the ninth night for the man who walked out past the fence. Every house on the square has one. Nobody has ever set out a second.' },
            { x: 7.2, y: 6.6, n: 'The playbill', d: 'THE NINTH NIGHT. A true account. The same four hundredth time.\n\nUnder the cast list somebody has pencilled your name, and then gone over it twice, harder.' }
        ],
        exits: [
            { x: 8.5, y: 14.3, w: 3, to: 'lane', n: 'the lane, north' },
            { x: 2.1, y: 3.6, w: 1.6, to: 'bernhouse', n: 'Bern\'s door' },
            { x: 15, y: 3.8, w: 1.6, to: 'chandler', n: 'the chandler\'s shop' },
            { x: 8.7, y: 6.6, w: 2.4, to: 'a3sq', n: 'up the steps, onto the stage', needs: 'a3ready', over: 1,
              shut: function () {
                  return S.a3.ending ? 'They have the boards up on the cart already. It was last night now.'
                                     : 'They are still building it. It is not tonight yet.';
              } }
        ]
    },
    /* ── interiors. Somewhere with a roof on it, and one lamp that is
          not for anybody, which is the only one in the game that is not. ── */
    bernhouse: {
        n: 'Bern\'s house', sub: 'he has kept the part for forty years and never played it',
        floor: 'room', calm: 1, mends: 1, w: 11, h: 9, night: 1, indoor: 1,
        props: [
            { t: 'wall', b: [0, 0, 11, 0.6] }, { t: 'wall', b: [0, 0, 0.6, 9] }, { t: 'wall', b: [10.4, 0, 0.6, 9] },
            { t: 'table', b: [4.2, 3.4, 2.6, 1.6] },
            { t: 'bed', b: [8.2, 1.2, 1.8, 3.2] },
            { t: 'shelf', b: [1, 1.2, 2.4, 0.8] },
            { t: 'lamp', b: [5.3, 3.0, 0.5, 0.5] },
            { t: 'crate', b: [1.2, 6.4, 1.2, 1.2] }
        ],
        looks: [
            { x: 5.4, y: 5.2, n: 'His script', d: 'Forty years of it. The paper has gone soft as cloth at the corner he turns.\n\nEvery closing line is marked in the margin with the number of syllables. Six. Eight. Seven. Six.\n\nAnd on the third page, and again on the last, the number is five, and it is circled, and beside it he has written nothing at all.', key: 'bernscript' },
            { x: 2.2, y: 2.6, n: 'The shelf', d: 'Cups, a jar of nails, and a child\'s wooden crown with the gilt worn off the points.\n\nHe was cast once too, then. Nobody has ever mentioned it.' }
        ],
        exits: [{ x: 5.5, y: 8.3, w: 2.4, to: 'square', n: 'out to the square' }]
    },
    chandler: {
        n: 'The chandler\'s shop', sub: 'she sells the lamps the whole town sets out',
        floor: 'room', calm: 1, mends: 1, w: 12, h: 9, night: 1, indoor: 1,
        props: [
            { t: 'wall', b: [0, 0, 12, 0.6] }, { t: 'wall', b: [0, 0, 0.6, 9] }, { t: 'wall', b: [11.4, 0, 0.6, 9] },
            { t: 'counter', b: [3.4, 4.4, 4.8, 1.2] },
            { t: 'shelf', b: [1, 1.2, 3.2, 0.8] }, { t: 'shelf', b: [7.4, 1.2, 3.4, 0.8] },
            { t: 'vat', b: [1.2, 6.2, 1.8, 1.8] },
            { t: 'lamp', b: [9.4, 4.8, 0.5, 0.5] }, { t: 'lamp', b: [2.2, 3.4, 0.5, 0.5] },
            { t: 'barrel', b: [9.8, 6.6, 1.2, 1.2] }
        ],
        npcs: ['chandler'],
        looks: [
            { x: 6, y: 6.2, n: 'The ledger', d: 'Lamps sold, by the year, in a hand that does not waste ink.\n\nThis year: four hundred and eleven. Same as the count of houses, near enough.\n\nFour hundred years of it, and the number at the top of every page is the number of houses. Never one more.', key: 'ledger' }
        ],
        exits: [{ x: 6, y: 8.3, w: 2.4, to: 'square', n: 'out to the square' }]
    },
    lane: {
        n: 'The lane out of Wick', sub: 'in the play it is a day\'s walk',
        floor: 'mill', w: 13, h: 17,
        props: [
            { t: 'fence', b: [0.6, 4, 0.5, 9] }, { t: 'fence', b: [11.6, 3, 0.5, 3.2] }, { t: 'fence', b: [11.6, 10.2, 0.5, 2.8] },
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
            { x: 7.9, y: 5.6, w: 1.8, to: 'loft', n: 'up the ladder, into the loft', needs: 'rehearsed',
              shut: 'A ladder into the dark. There is no reason to climb it. Rehearse first.' }
        ],
        speakDraws: 4,
        script: 'mill'
    },
    loft: {
        n: 'The grain loft', sub: 'a crowd of voices with no bodies',
        floor: 'loft', w: 13, h: 13,
        props: [
            { t: 'beam', b: [0, 3.2, 4.8, 0.6] }, { t: 'beam', b: [8.2, 3.2, 4.8, 0.6] },
            { t: 'beam', b: [0, 9.2, 4.4, 0.6] }, { t: 'beam', b: [8.6, 9.2, 4.4, 0.6] },
            { t: 'sack', b: [1.4, 5.4, 1.2, 1] }, { t: 'sack', b: [10.4, 6.6, 1.2, 1] }
        ],
        exits: [{ x: 6, y: 12.3, w: 3, to: 'mill', n: 'back down', needs: 'chorusDown',
              shut: 'It is still going. You are not walking out on it.' }],
        script: 'loft'
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
            { t: 'fence', b: [0.6, 1, 0.5, 2.4] }, { t: 'fence', b: [0.6, 7.6, 0.5, 2.4] },
            { t: 'tree', b: [10.2, 2.4, 1.4, 1.4] }
        ],
        looks: [{ x: 6.7, y: 6.6, n: 'The marker stone', d: 'Two names cut into it. The upper one is HAL, and it has been recut so many times it is nearly through the stone.\n\nThe lower one has been scratched out. Not weathered. Scratched, with something hard, by somebody who took their time.\n\nYou cannot read it. You get the shape of four letters and nothing else.', key: 'markstone' }],
        npcs: ['hal'],
        exits: [
            { x: 0.7, y: 5.4, h: 3, to: 'village', n: 'back west' },
            { x: 6.6, y: 0.7, w: 3, to: 'road', n: 'north, the way she went' }
        ]
    },
    /* ── the road north. In the play it is a night's walk. It has never
          been longer than one screen before, which is the whole reason
          the camera exists. ── */
    road: {
        n: 'The road north', sub: 'past the mill, the well, the mark, and then past the fence',
        floor: 'road', w: 11, h: 34, night: 1,
        props: [
            { t: 'lamp', b: [8.2, 30.4, 0.5, 0.5] },                       // the last lamp in the world, off the walking line
            { t: 'fence', b: [0.8, 23.6, 0.5, 8.4] }, { t: 'fence', b: [9.7, 23.6, 0.5, 8.4] },
            { t: 'post', b: [0.9, 22.4, 0.6, 0.6] }, { t: 'post', b: [9.6, 22.4, 0.6, 0.6] },
            { t: 'tree', b: [1.5, 18.4, 1.4, 1.4] }, { t: 'tree', b: [8.1, 15.2, 1.4, 1.4] },
            { t: 'tree', b: [1.3, 12.2, 1.4, 1.4] }, { t: 'hedge', b: [8.4, 20.2, 1.6, 1.2] },
            { t: 'cairn', b: [6.0, 9.4, 1.2, 1.2] },
            { t: 'stone', b: [2.4, 6.8, 1, 1] }, { t: 'stone', b: [7.8, 4.4, 1, 1] },
            { t: 'cairn', b: [3.6, 2.6, 1.2, 1.2] }
        ],
        looks: [
            { x: 7.4, y: 30.2, n: 'The last lamp', d: 'The furthest one out. Somebody walks up here on the ninth night and lights it and walks back.\n\nIt faces the town. All of them face the town.' },
            { x: 5.2, y: 22.2, n: 'Where the fence ends', d: 'Two posts and nothing between them. The fence does not carry on. It stops here because this is as far as anyone goes.\n\nIn the song he walks out past the fence. He is the only one in it who is ever said to have done that.\n\nYou are standing past it now. It took nine steps.', key: 'fenceend' },
            { x: 5.0, y: 10.4, n: 'A cairn', d: 'A heap of stones the height of your knee, on the west side of the road, where somebody kneeling would have had their back to Wick.\n\nThere is no name on it. There is no name on any of them. There are four before the hollow and you will count them without meaning to.' },
            { x: 4.4, y: 2.4, n: 'The road, ahead', d: 'It stops being a road about here. It goes on being a way through, which is not the same thing.\n\nThe ground ahead is lower. You can feel it in your knees before you can see it.' }
        ],
        exits: [
            { x: 5.4, y: 33.3, w: 3, to: 'mark', n: 'back south, to the mark' },
            { x: 5.4, y: 0.7, w: 3, to: 'hollow', n: 'the hollow, north' }
        ],
        speakDraws: 3      // say it out loud out here and the loose bits come to look
    },
    /* ── the hollow. The one place in the game that should feel wrong.
          Job 1 puts the ending here; this is the ground it stands on. ── */
    hollow: {
        n: 'The hollow', sub: 'at the world\'s north end',
        floor: 'hollow', w: 15, h: 13, night: 2, dark: 1,   // no lamp out here. That is the whole point of out here.
        props: [
            { t: 'cairn', b: [7.0, 5.4, 1.4, 1.4] },
            { t: 'stone', b: [4.2, 3.6, 1, 1] }, { t: 'stone', b: [10.2, 4.2, 1, 1] },
            { t: 'stone', b: [3.8, 8.2, 1, 1] }, { t: 'stone', b: [10.6, 8.4, 1, 1] },
            { t: 'stone', b: [7.2, 2.2, 1, 1] },
            { t: 'tree', b: [1.4, 1.6, 1.4, 1.4] }, { t: 'tree', b: [12.2, 10.2, 1.4, 1.4] }
        ],
        looks: [
            { x: 7.6, y: 7.2, n: 'The ground', d: 'The stones are not scattered. They are set, in a ring, with the gap facing south, facing the road, facing the town.\n\nSomebody sat down in the middle of this and made it tidy, and then it snowed for four hundred years.', key: 'hollowground' },
            { x: 5.4, y: 4.2, n: 'The cold', d: 'It is not colder here. That is the wrong thing about it. You walked north all night and the air stopped getting colder about a mile back and it has been exactly this ever since.\n\nSomething took the difference.' },
            { x: 11.2, y: 6.4, n: 'North of here', d: 'Nothing. Not a view, not a drop, not a wall. The ground goes on being ground and the dark goes on being dark and there is no line where one ends.\n\nShe would have had to decide to stop. Nothing here would have stopped her.' }
        ],
        exits: [{ x: 7.4, y: 12.3, w: 3, to: 'road', n: 'back down the road' }],
        speakDraws: 4
    },
    a3sq: {
        n: 'Wick — the ninth night', sub: 'the four hundredth performance',
        floor: 'town', w: 17, h: 15, script: 'a3', a3: 1, oneway: 1,
        props: [
            { t: 'house', b: [0, 0, 3.4, 2.6] }, { t: 'house', b: [13.6, 0, 3.4, 2.8] },
            { t: 'house', b: [0, 12.4, 3.6, 2.6] }, { t: 'house', b: [13.4, 12.2, 3.6, 2.8] },
            { t: 'stagewip', b: [4.6, 1.0, 8, 3.2] },
            { t: 'foot', b: [4.6, 4.3, 8, 0.35] }
        ],
        exits: []
    },
    arena: {
        n: 'Dev — free arena', sub: 'nothing here means anything. hit things.',
        floor: 'mill', w: 17, h: 17, endless: 1, props: [], exits: []
    }
};
var PLACE_IDS = Object.keys(PLACES);

/* ─────────────── people ───────────────
   Every one of these can be walked away from. The busker is the
   accessibility valve the design doc asks for: he says the whole
   thing out loud, in plain words, for anybody who does not hear
   meter. */
var NPCS = {
    /* The chandler used to be a panel header, a tooltip, a comment and one
       line of sell flavour. Job 3 gave her a shop off the square and a
       ledger four hundred years long, so job 5 only hangs the stock on
       her: see chandlerNear and fillShop. */
    bern: {
        n: 'Bern', x: 7.4, y: 7.2, col: ['#6a4f3a', '#8a6a4a', '#d8b48c'], hat: 1,
        talk: function () {
            if (fragCount() === 3 && !S.a3.ending && !S.seen.a3ready) {
                if (!S.a3.read && !S.seen.bernA3) {
                    S.seen.bernA3 = 1; sSave();
                    return [['Bern', "They finished it at four o'clock. Forty years I have watched them finish it at four o'clock."],
                            ['Bern', 'Go over your last verse. You have until dark.'],
                            ['You', 'I have been over it.'],
                            ['Bern', 'Go over it again. Read it from the top.']];
                }
                S.seen.a3ready = 1; sSave();
                return [['Bern', 'It is tonight.'],
                        ['You', 'I know the lines.'],
                        ['Bern', 'That is what I said.'],
                        ['', 'He goes to look for his hat. He has worn the same hat for thirty years and he loses it every year.'],
                        ['', 'The steps up to the stage are open.']];
            }
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
        // she is described as skipping in her own dialogue, so she skips
        skip: 1, speed: 1.9, path: [[10.6, 9.8], [10.6, 12.6], [7.4, 12.6], [7.4, 10.0]],
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
            S.heard.widow = 1; sSave();
            return [['', 'She sets the lamp on the sill and squares it up, twice.'],
                    ['The woman', 'For the man who went out. My mother did it, her mother did it.'],
                    ['You', 'Do you ever set out two?'],
                    ['The woman', 'Two? Whatever for?'],
                    ['', 'She laughs, and goes inside, and the lamp burns in the window for one person.']];
        }
    },
    shepherd: {
        n: 'A shepherd', x: 9.2, y: 5.6, col: ['#4a4a38', '#6a6a50', '#d8b48c'], wander: 1.7, speed: 0.85,
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
    },
    /* She sells the lamp every house sets out, so she is the only person
       in Wick who has ever counted them, and the count is the thing. */
    chandler: {
        n: 'The chandler', x: 5.8, y: 3.2, col: ['#4a3a4a', '#63506a', '#e0bc94'], wander: 1.1, speed: 0.7,
        talk: function () {
            S.heard.chandler = 1; sSave();
            if (!S.seen.chandler1) {
                S.seen.chandler1 = 1;
                return [['', 'She is trimming wicks with a knife older than the shop.'],
                        ['The chandler', 'You are the new one. Mind the crown, the gilt comes off on your hands.'],
                        ['You', 'How many lamps do you make for the ninth night?'],
                        ['The chandler', 'One a house. Four hundred and eleven this year.'],
                        { ask: 'One a house. She says it like a measurement.', who: 'You',
                          opts: [
                            { t: 'And if somebody wanted two?',
                              do: function (S) { S.seen.askedTwo = 1; },
                              go: [['', 'The knife stops.'],
                                   ['The chandler', 'Nobody wants two. There is one man to remember, and he has got one.'],
                                   ['You', 'For somebody else, then.'],
                                   ['The chandler', 'There is no somebody else. That is what a count is for.'],
                                   ['', 'She goes back to the wicks. She is not being careful with you. She has simply never had the thought, and it did not fit anywhere when it arrived.']] },
                            { t: 'Has it always been one?',
                              go: [['The chandler', 'Since there were houses. My mother sold four hundred and six.'],
                                   ['You', 'And before her?'],
                                   ['The chandler', 'Before her it is not a number, it is a song. Ask Bern, he keeps the words.'],
                                   ['', 'She has told you the shape of it without once looking up.']] },
                            { t: 'Who lights the one out past the fence?',
                              if: function (S) { return !!S.seen.been_road; },
                              do: function (S) { S.seen.askedLastLamp = 1; },
                              go: [['', 'She looks up. This is the first thing you have said that she has to think about.'],
                                   ['The chandler', 'I do. Walk up, light it, walk back.'],
                                   ['You', 'Why that far out?'],
                                   ['The chandler', 'Because that is where the fence stops. You put the last one where the last one goes.'],
                                   ['You', 'It faces the town.'],
                                   ['The chandler', 'They all face the town.'],
                                   ['', 'She says it without hearing it. A lamp set out for a man who walked away, turned so it lights the way back, by somebody who has never once walked past it.']] }
                          ] }];
            }
            return [['The chandler', 'One a house. It has been one a house since there were houses.'],
                    ['', 'She says it the way you say a line you have never once had to check.']];
        }
    }
};
/* every person carries their own key, so their live position can be
   looked up from the def alone */
Object.keys(NPCS).forEach(function (k) { NPCS[k].id = k; });

/* ─────────────── scripts ─────────────── */
var SCRIPTS = {
    a3: function () { a3Start(); },
    prologue: function () {
        say('<b>Twelve years ago.</b> You are nine, and the mask is too big.', 'big');
        beat(3.0, function () { say('Your whole part is to walk across the stage and be the thing that ate the light. Walk to the far side.'); });
        beat(7.5, function () { say('You trip. The hall laughs, kindly. Your mother crouches down and fixes the mask.', 'dim'); });
        beat(11, function () { bigLine('twelve years later', '', '#c9a94a', 2.6); });
        beat(13.4, function () { gotoPlace('square', true); });
    },
    wick: function () {
        if (S.a3.ending) return;                   // it is the morning after. a3Home has its own line.
        say('<b>Wick.</b> They are building the stage in the square. You have been given the crown and the lantern.', 'big');
        beat(3.4, function () { say('Talk to people. Look at things. Nothing here wants to hurt you.', 'dim'); });
        beat(6.4, function () { say('When you are ready, the lane runs north to the mill.', 'dim'); });
    },
    mill: function () {
        if (S.seen.millIntro) return;
        S.seen.millIntro = 1;
        say('<b>The mill.</b> Nobody can hear you out here. That is the point of out here.', 'big');
        beat(3.2, function () { say('Rehearse. <i>Left click</i> says the word on your tongue. You do not get to pick it: you get the four in front of you and you make them work.', 'dim'); });
        beat(7.4, function () { say('<i>Right click</i> swallows one you cannot use. It costs breath and it goes in the book with a line through it.', 'dim'); });
        beat(11.6, function () { say('The <b>numbers</b> are the sounds you know. Press one and every syllable of that sound out there closes at once.', 'dim'); });
    },
    loft: function () {
        if (S.seen.chorusDown) {                       // it is over; the room is just a room
            say('The loft is quiet. Dust, sacks, and the shape of where a crowd was.', 'dim');
            return;
        }
        say('<b>The grain loft.</b> Something up here is already saying your part.', 'big');
        beat(2.6, function () { say('It strips the rhyme off everything on a pulse. You cannot build slowly here.', 'dim'); });
        beat(4.6, function () { bigLine('THE CHORUS', 'burst between pulses', '#d2c8e1', 2.4); spawnFoe('chorus', 6.5, 6.2); });
    }
};


/* ═══════════════ THE NINTH NIGHT ═══════════════
   The four hundredth performance. The town is a crowd of foes with a
   folk flag, so every part of the combat system points at them
   unmodified: the Call projectile, the stack renderer, the Answer
   sweep, the detonation. Nothing here reimplements anything.

   One rule holds the whole act together. Every person in this square
   is carrying one open rhyme that was put on them before they could
   walk, and nothing has ever answered it. The player has spent twenty
   minutes learning that an open stack is a thing you close. */

var A3_ROWS = [[5.4, 6.4], [7.0, 6.9], [8.6, 6.4], [10.2, 6.9], [11.8, 6.4],
               [4.8, 8.2], [6.4, 8.7], [8.0, 8.2], [9.6, 8.7], [11.2, 8.2], [12.6, 8.7],
               [5.2, 10.1], [6.8, 10.6], [8.4, 10.1], [10.0, 10.6], [11.6, 10.1],
               [4.4, 12.0], [6.2, 12.4], [8.0, 12.0], [9.8, 12.4], [11.6, 12.0], [13.2, 12.4],
               [7.2, 13.6], [9.4, 13.6]];

/* Leaving the act by any route has to unfreeze stack decay, or nothing in
   the game ever goes sour again for the rest of the session. Its own flag
   rather than the dev CHEAT's RT.holdStacks: sharing them meant walking
   through any doorway quietly switched the cheat off. a3Mark sets it again
   on arrival. */
onPlaceChange(function () {
    RT.a3Hold = 0; unpin();
    poemStash();                  // the page you were on goes in the book
    RT.lastSaidFam = null;
    fillLine(true);               // a fresh hand for a fresh room
    // A doorway clears RT.timers, and the Verse lives in them, including the
    // timer that marks it spent. It was still sung. Without this, casting it
    // and walking through a door leaves R armed for another 7x999 forever.
    if (RT.verseCast && !S.a3.verseSpent) { S.a3.verseSpent = 1; sSave(); }
});

/* The world after the true ending is module state, not saved state, so it
   has to be re-applied on every load. Registered rather than called from
   one script, because the old version only ran on arrival in the square:
   reload anywhere else and Hal was back at the fence. */
onPlaceChange(a3After);

function a3Folk() { return RT.foes.filter(function (f) { return !f.dead && f.def.folk; }); }
function a3Open() { return a3Folk().reduce(function (a, f) { return a + f.stacks.length; }, 0); }

/* Four hundred years of open line, and doAnswer would strip all of it on
   any click from the moment the crowd is marked. The line is not
   answerable until the play has actually asked for it: before the last
   cue is holding, an Answer goes out over their heads and finds nothing.
   Without this, one early click empties the square, the last cue reads
   zero open lines the frame it lands, and the game hands out its own
   biggest ending for an input made two cues earlier. */
function heldOpen(f) {
    if (!f.def.folk) return false;
    return !(RT.story && RT.story.holding && RT.story.cue >= 3);
}

/* the crowd, and the one man standing outside the lamps at the back */
function a3Crowd() {
    A3_ROWS.forEach(function (xy, i) {
        var f = spawnFoe('folk', xy[0], xy[1]);
        if (f) { f.spawn = 0; f.so = (i % 3) * 4; f.seat = 1; }
    });
    var hal = spawnFoe('folk', 8.6, 14.4);
    if (hal) { hal.spawn = 0; hal.isHal = 1; hal.seat = 1; }
}

/* one open line on every person in the square. Pushed straight onto the
   stack array: addStack refuses norhyme foes, and the refusal is the
   point everywhere else in this act. */
function a3Mark() {
    RT.a3Hold = 1;
    // set, not add. a3Answered re-marks on every slant retry, and pushing
    // gave everybody in the square a second and a third open line.
    a3Folk().forEach(function (f) {
        f.stacks.length = 0;
        f.stacks.push({ fam: 'ill', t: 999, max: 999, born: RT.t, aged: 1 });
    });
}

function a3Say(t, cls) { say(t, cls || 'dim'); }

/* a cue is three lines that land on their own and a fourth that holds
   with a hole in it. */
function a3Cue(lines, blank, then) {
    RT.story.holding = 0;
    lines.forEach(function (ln, i) { beat(i * 1.7, function () { bigLine(ln, '', '#d8d2e0', 2.6); }); });
    beat(lines.length * 1.7, function () {
        unpin();
        bigLine(blank, '', '#e8e2ee', 999, 1);
        RT.story.holding = 1;
        RT.story.sawCall = 0;
        RT.story.sawAnswer = 0;
        RT.story.stanza3 = 0;
        RT.story.n1 = 0;
        RT.story.n2 = 0;
        RT.story.waitT = 0;
        RT.story.lastT = null;
        RT.story.callMark = RT.nCalls;
        RT.story.answerMark = RT.nAnswers;
        if (then) then();
    });
}

function a3Start() {
    if (S.a3.ending) { a3Resume(); return; }
    RT.story = { cue: 0, holding: 0, tries: 0, waitT: 0, done: 0, sawCall: 0, sawAnswer: 0 };
    RT.px = 8.6; RT.py = 5.4;
    bigLine('the ninth night', 'THE FOUR HUNDREDTH', '#c9a94a', 3.2);
    beat(3.4, function () { a3Say('Every sill in the square has a lamp on it. They light them before the play, not after, so the man has something to come back to.'); });
    beat(6.0, function () { a3Crowd(); sfx('ui'); });
    beat(7.4, function () {
        a3Mark();
        bigLine('one open line on every person in the square', '', '#6fd4ff', 3.4);
    });
    beat(11.0, function () { a3Say('None of them put it there. It was on them before they could walk.'); });
    beat(14.0, function () { a3Say('Nothing has ever answered it.', 'big'); });
    beat(17.5, function () { say('<b>Bern:</b> Emberwright. You are on.', 'big'); });
    beat(20.0, function () { a3CueOne(); a3Watch(); });
}

/* You can arrive here with the night already behind you: a reload while
   the credits were still rolling, a dev jump, an old save whose S.place
   is a3sq. a3sq has no exits, so anything that returns without putting
   the player somewhere is a permanent softlock that survives a reload.
   Nobody gets left standing in an empty square. */
/* Put the night back the way it was before it happened. Every dev route
   that replays the act goes through here, because clearing the ending and
   leaving the Verse spent produces an act that ends by lighting a key that
   refuses it, in a place with no exits. */
function a3Rewind() {
    delete S.a3.ending; delete S.a3.verseSpent;
    S.verse = 0;
    sSave();
    if (RT) updateHud(0);
}

function a3Resume() {
    RT.story = { cue: 3, holding: 0, tries: 0, waitT: 0, done: 2, sawCall: 0, sawAnswer: 0,
                 callMark: RT.nCalls, answerMark: RT.nAnswers };
    // The consequences of an ending are spread over the beats that follow
    // it, and a reload does not wait for them. Anything the ending owes the
    // player or the save has to be settled here, on the way back in.
    if (S.a3.ending === 'silence') dropCrown();
    // verseSpent, not S.verse: a3End commits the ending on the frame the
    // Answer lands and a3True does not light R until 8.6s later, so gating
    // on S.verse threw the whole payoff away for a reload inside that window
    // and shut the steps behind it. If the couplet is closed and the Verse
    // is unsung, the player is owed it, and this is where it gets paid.
    if (S.a3.ending === 'true' && !S.a3.verseSpent) {
        // put the square back the way they left it and wait for R again
        S.verse = 1; sSave();
        RT.px = 8.6; RT.py = 5.4;
        a3Crowd();
        beat(0.8, function () { a3Say('Nothing has moved. The curtain is still halfway down.'); });
        beat(3.2, function () { updateHud(0); hudNudge('verse'); say('<i>R</i>', 'big'); });
        return;
    }
    beat(0.8, function () { a3Say('The stage is down to the boards. Whatever happened up here has happened.'); });
    beat(3.2, function () { a3Home(); });
}

function a3CueOne() {
    RT.story.cue = 1;
    a3Cue(['He stood up in the empty square,', 'he spoke and we all heard.', 'He asked us for a single coal,'], 'and ______');
}
function a3CueTwo() {
    RT.story.cue = 2;
    a3Cue(['He walked out past the mill, the well,', 'he walked out past the mark,', 'and he held the last coal in the town,'], 'and he ______', function () {
        beat(2.0, function () {
            a3Say('At the back of the square, outside the lamps, there is a man carrying the same open line as everybody else.');
        });
        beat(5.2, function () { a3Say('He has been standing there the whole time.'); });
    });
}
function a3CueLast() {
    RT.story.cue = 3;
    a3Cue(['So light your lamps on the ninth night', 'and set one on the sill,', 'for the man who walked out past the fence,'], 'and ______', function () {
        beat(1.6, function () { a3Say('The same hole as the third stanza. They patched two stanzas with one cheap line.'); });
    });
}

/* the dead call: the word lands on somebody and builds nothing, because
   folk carry norhyme. addStack already owns that path. */
function a3DeadCall() {
    RT.story.holding = 0;
    unpin();
    var lie = RT.story.cue === 2 ? 'and he carried it out of sight.' : 'and he went alone.';
    bigLine(lie, '', '#8a8090', 2.8);
    beat(1.2, function () { a3Say('They say it back, a half beat behind you.'); });
}

function a3Watch() {
    if (!RT || RT.place !== 'a3sq' || RT.story.done) return;
    var st = RT.story;
    // every frame, not every tenth of a second: a Call fired into the front
    // row lives about five frames before it lands, and a 10Hz poll misses it
    // Nothing that happens behind a panel, a dialogue, the map or the dev
    // menu is a choice. doCall checks none of them, so a click beside an
    // open panel used to deliver the town's line and end the play.
    var mute = RT.devOpen || RT.dialog || RT.mapOpen || RT.panel;
    if (mute) { st.callMark = RT.nCalls; st.answerMark = RT.nAnswers; }
    if (st.holding) {
        if (RT.nCalls > st.callMark) st.sawCall = 1;
        if (RT.nAnswers > st.answerMark) st.sawAnswer = 1;
        // dt-correct, so the wait is the same at 60Hz and 144Hz, and it only
        // runs while the player could actually have spoken.
        var el = RT.t - (st.lastT == null ? RT.t : st.lastT);
        st.lastT = RT.t;
        var canSpeak = !mute && RT.winded <= 0;
        if (st.cue < 3) {
            if (st.sawCall) {
                st.sawCall = 0; st.callMark = RT.nCalls;
                a3DeadCall();
                beat(4.0, st.cue === 1 ? a3CueTwo : a3CueLast);
            } else {
                // These two cues wait on a Call and nothing else, and a3sq has
                // no exits: a player who does not know to click is looking at
                // a hole in a line forever. Bern says it, and then Bern says
                // it for them.
                if (canSpeak && RT.breath >= T('callCost')) st.waitT += el;
                if (st.waitT > 7.0 && !st.n1) { st.n1 = 1; say('<b>Bern:</b> <i>(from the wings)</i> Say the line, lad. Out loud.', 'dim'); }
                if (st.waitT > 16.0) {
                    st.waitT = 0; st.n1 = 0; st.callMark = RT.nCalls;
                    say('<b>Bern:</b> <i>(saying it for you, from the wings)</i>', 'dim');
                    a3DeadCall();
                    beat(4.0, st.cue === 1 ? a3CueTwo : a3CueLast);
                }
            }
        } else {
            // An Answer, not the absence of open lines. a3Open() is state,
            // and state can reach zero for reasons that were not a choice
            // the player made at this cue. The Answer is checked first: in
            // WASD mode holding left mouse says a word every frame, and
            // somebody who presses a rhyme at the last cue meant to answer.
            // Stanza III is the -ill stanza and its fourth line IS the true
            // line. Reciting it into the hole is answering, and it used to
            // run the silence clock underneath the recital and then tell a
            // player halfway through it that they had said nothing.
            if (RT.recital && RT.recital.n === 3) st.stanza3 = 1;
            else if (st.stanza3) { st.stanza3 = 0; a3End('true'); return; }
            else if (st.sawAnswer) { st.sawAnswer = 0; st.answerMark = RT.nAnswers; a3Answered(); }
            else if (st.sawCall) { st.sawCall = 0; a3End('written'); }
            else {
                // a3Answered tells them to go and re-slot the word, and
                // reading the panel that does it is not a decision to say
                // nothing. Neither is being winded, nor being mid recital.
                if (canSpeak && !RT.recital && RT.breath >= T('answerCost')) st.waitT += el;
                if (st.waitT > 4.5 && !st.n1) { st.n1 = 1; say('<b>Bern:</b> <i>(from the wings)</i> and ______', 'dim'); }
                if (st.waitT > 9.0 && !st.n2) { st.n2 = 1; say('<b>Bern:</b> Say the line, lad.', 'dim'); }
                if (st.waitT > 14.0) { a3End('silence'); return; }
            }
        }
    }
    beat(0, a3Watch);
}

/* they answered the last cue. answerFam() has not changed since the
   click, so it tells closed from slant without hooking anything. */
function a3Answered() {
    var st = RT.story;
    // the rhyme they actually pressed. There is no slotted answer word any
    // more: the line deals words and the number row holds the sounds.
    if (RT.lastRhyme === 'ill') { a3End('true'); return; }
    st.holding = 0; st.tries++;
    slam(FAMS[RT.lastRhyme || 'eat'].tag, '#6a5f72', 'slant');
    beat(0.9, function () {
        a3Mark();
        st.holding = 1; st.waitT = 0; st.lastT = null;
        st.sawCall = 0; st.callMark = RT.nCalls;
        st.sawAnswer = 0; st.answerMark = RT.nAnswers;
        st.n1 = 0; st.n2 = 0;      // Bern nags again, or the silence arrives with no warning at all
        if (st.tries === 1) say('<b>Bern:</b> <i>(from the wings)</i> Wrong sound. It has to be the sound of the line before it.', 'dim');
        else if (st.tries === 2) say('<b>Bern:</b> Sill. Still. <i>Will.</i>', 'dim');
        else {
            var k = rhymeKeys()[FAM_IDS.indexOf('ill')];
            say('<b>Bern:</b> <i>(not quite whispering)</i> <b style="color:' + FAMS.ill.col + '">' + k + '</b>.', 'good');
            hudNudge('rhyme:ill');
        }
    });
}



/* Hal is the only one still sitting. Bern's first line in the game is
   "There he is. The new Emberwright." This is that line with the
   pronoun corrected and the title given back. */
function a3Hal() {
    var hal = RT.foes.filter(function (f) { return f.isHal && !f.dead; })[0];
    beat(1.6, function () { a3Say('Everybody in the square is standing except one man at the back, outside the lamps.'); });
    beat(5.0, function () {
        // stepFoes moves him, one tile a second, from the back of the
        // square to the footlights. Seven and a half seconds, which lands
        // him at the front on "Jill." It takes him a while.
        if (hal) { hal.seat = 0; hal.walk = 1; hal.walkTo = 6.6; }
        a3Say('Then he stands, and he is the last one, and he comes up the square to the front of the stage. It takes him a while.');
    });
    beat(9.5, function () { a3Say('Four letters come out. The air does not take them.'); });
    beat(12.5, function () { bigLine('Jill.', '', '#6fd4ff', 3.4); });
    beat(16.0, function () { bigLine('There she is.', '', '#c9a94a', 3.6); });
    beat(20.0, function () { a3Say('You are still wearing the crown.'); });
    beat(23.5, function () {
        a3Credits(['THE EMBERWRIGHT ....... JILL', 'THE MAN AT THE FENCE ....... HAL']);
    });
}

/* ─────────────── the three endings ─────────────── */
function a3End(which) {
    var st = RT.story;
    if (st.done) return;
    st.done = 1; st.holding = 0;
    unpin();
    S.a3.ending = which; sSave();
    ach(which === 'true' ? 'answered' : which);
    if (which === 'written') a3Written();
    else if (which === 'silence') a3Silence();
    else a3True();
}

/* the line the town wrote, delivered on time, into people who have
   never heard it any other way. Bern means every word of it. */
function a3Written() {
    bigLine('and he went alone.', '', '#8a8090', 3);
    beat(2.6, function () { a3Say('Four hundred people say it back. They have been waiting all year to say it back.'); });
    beat(5.6, function () { say('<b>Bern:</b> Word perfect, lad.', 'good'); });
    beat(9.0, function () { a3Say('They do it again next year.'); });
    beat(12.0, function () { a3Credits(['THE EMBERWRIGHT ....... HAL']); });
}

/* The crown comes off, and it is a real build change: one fewer stack and
   1.5s less on every one of them for the rest of the save. Idempotent, and
   its own function, because the beat that narrates it lands ten seconds
   after the ending is committed and a reload in between must not keep it. */
function dropCrown() {
    if (!S.charms.crown) return;
    delete S.charms.crown;
    S.worn = (S.worn || []).filter(function (c) { return c !== 'crown'; });
    sSave();
    if (RT) updateHud(0);
}

/* you did not tell the lie and you did not perform her either */
function a3Silence() {
    a3Say('You do not say it.');
    beat(2.4, function () { a3Say('Four hundred people watch a man in a crown not say a line. It goes on longer than you would think.'); });
    beat(6.4, function () { a3Say('Somebody at the back starts it for you, and stops.'); });
    beat(10.0, function () {
        dropCrown();
        a3Say('You put the crown on the boards and go down the steps at the side.');
    });
    beat(13.6, function () { bigLine('You did not say his line.', '', '#8a8090', 3); });
    beat(16.4, function () { bigLine('You did not say hers either.', '', '#8a8090', 3.2); });
    beat(20.0, function () { a3Credits(['THE EMBERWRIGHT .......................']); });
}

/* four hundred years of open couplet, closed at once */
function a3True() {
    beat(0.0, function () {
        bigLine('but for the girl who never will.', '', '#6fd4ff', 3.4);
        RT.shake = shake(10);
    });
    beat(2.0, function () { a3Say('The square stops. Bern stops. The curtain stops halfway down.'); });
    beat(5.2, function () { a3Say('That is the end of the song. It has been the end of the song the whole time.'); });
    beat(8.6, function () {
        S.verse = 1; sSave();                 // the only non-dev writer in the file
        updateHud(0);
        hudNudge('verse');
        say('<i>R</i>', 'big');
    });
}

/* ─────────────── the cast list ─────────────── */
function a3Credits(extra) {
    RT.story.done = 2;
    RT.a3Hold = 0;
    beat(0.0, function () { bigLine('THE NINTH NIGHT', '', '#c9a94a', 3.4); });
    beat(2.4, function () { bigLine('the four hundredth performance', '', '#8a8090', 3.2); });
    (extra || []).forEach(function (ln, i) {
        beat(5.0 + i * 3.0, function () { bigLine(ln, '', '#d8d2e0', 3.4); });
    });
    beat(5.0 + (extra || []).length * 3.0 + 3.4, function () { a3Home(); });
}

/* back into the square by daylight. The save is not a dead end. */
function a3Home() {
    S.place = 'square'; sSave();
    gotoPlace('square', false);
    beat(1.2, function () {
        if (S.a3.ending === 'true') a3Say('They are taking the stage down. Nobody is talking much.');
        else if (S.a3.ending === 'silence') a3Say('They are taking the stage down. Bern has your crown and does not mention it.');
        else a3Say('They are taking the stage down. Somebody says it was the best one in years.');
    });
}

/* the world after. Called on arrival, idempotent, so no other job's
   code has to be reopened to mutate a place. */
var A3_WAS = null;
function a3After() {
    // snapshot the pristine world before touching it. This has to be
    // reversible, not just applicable: the dev save wipe rebuilds S in place
    // without reloading the page, and a fresh save with Hal deleted off the
    // fence cannot reach Fragment II at all, silently.
    if (!A3_WAS) A3_WAS = { npcs: (PLACES.mark.npcs || []).slice(),
                            stone: lookText('mark', 'The marker stone'),
                            lamp: lookText('square', 'A lamp on a sill') };
    if (S.a3.ending === 'true') {
        PLACES.mark.npcs = [];                       // the fence is empty
        // found by name, not by index: job 3 owns these arrays and may reorder them
        reLook('mark', 'The marker stone', 'Two names cut into it. The upper one is HAL.\n\nThe lower one is JILL.\n\nIt is not freshly cut. It has been there the whole time.');
        reLook('square', 'A lamp on a sill', 'Two lamps on the sill.\n\nThere are two on every sill in the square, and nobody here could tell you when that started.');
    } else {
        PLACES.mark.npcs = A3_WAS.npcs.slice();
        reLook('mark', 'The marker stone', A3_WAS.stone);
        reLook('square', 'A lamp on a sill', A3_WAS.lamp);
    }
}
function lookText(id, name) {
    var ls = (PLACES[id] || {}).looks || [];
    for (var i = 0; i < ls.length; i++) if (ls[i].n === name) return ls[i].d;
    return '';
}
function reLook(id, name, d) {
    if (!d) return;
    var ls = (PLACES[id] || {}).looks || [];
    for (var i = 0; i < ls.length; i++) if (ls[i].n === name) { ls[i].d = d; return; }
}

/* ─────────────── the realisation ───────────────
   Fragment 1 is NOT a boss drop. You get it when you have heard
   the town's refrain in earnest AND heard somebody carrying the
   true line, and the two rub together in your head. Understanding,
   not looting. */
function checkRealisation() {
    if (S.frags[1] || RT.realising || !S.heard.refrain) return;
    var src = S.heard.child || S.heard.busker || S.heard.shepherd;
    if (!src) return;
    RT.realising = 1;
    beat(1.0, function () { bigLine('he spoke and we all heard', '', '#e8e2ee', 2.4); });
    beat(3.4, function () { bigLine('and he went alone', '', '#e8e2ee', 2.4); });
    beat(6.0, function () { bigLine('those are not a rhyme', '', '#ffe66e', 3); });
    beat(9.4, function () { landRealisation(); });
}

/* The point of the realisation is the sentence, not the item. If a
   doorway interrupts the sequence you still get both — losing the
   only line that explains what you understood, and an achievement
   that is granted nowhere else, is worse than losing the ceremony. */
function landRealisation() {
    if (S.frags[1]) { RT.realising = 0; return; }
    RT.realising = 0;
    ach('hear');
    say('Somebody snapped the end off the song and nailed a lie onto it, four hundred years ago, and you have just heard the join.', 'good');
    grantFragment(1);
}

/* FRAGMENT II — the mark. The stone has a name scratched off it.
   Hal cannot say a name. Neither fact is a clue on its own. */
function checkMark() {
    if (S.frags[2] || RT.realising2 || !S.frags[1]) return;
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

/* FRAGMENT III — the lamp. Every house in Wick sets one out on the
   ninth night for the man who walked out past the fence. You have
   stood at the stone. You know who did the walking. The lamps have
   been pointed at the wrong person for four hundred years. */
function checkSill() {
    if (S.frags[3] || RT.realising3 || !S.frags[2]) return;
    if (!S.heard.widow || !S.seen.markstone) return;
    RT.realising3 = 1;
    beat(1.2, function () { bigLine('set one on the sill', '', '#e8e2ee', 2.4); });
    beat(3.6, function () { bigLine('for the man who walked out past the fence', '', '#e8e2ee', 2.6); });
    beat(6.4, function () {
        bigLine('he never went past the fence', '', '#6fd4ff', 3);
        say('Four hundred years of lamps, every one of them set out for the man who came back down. Nobody has ever lit one for the girl who did not.', 'good');
    });
    beat(10.0, function () { RT.realising3 = 0; grantFragment(3); });
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
        // the arena escalates: it walks the authored ladder and then keeps
        // rolling elites, so the dev arena is a real difficulty read
        RT.waveT -= dt;
        if (alive < 6 && RT.waveT <= 0) {
            RT.waveT = 2.5;
            RT.combat.encI = (RT.combat.encI || 0) + 1;
            var lad = ARENA_LADDER[Math.min(RT.combat.encI - 1, ARENA_LADDER.length - 1)];
            spawnWave(lad, pw() / 2, ph() / 2, [5, 7]);
        }
        return;
    }
    // Going quiet costs the place ONE rung now, not the whole ladder. Zeroing
    // it meant no place could ever send its third wave: you cleared the room,
    // the counter went back to nothing, and every authored late encounter in
    // the game — the mill's Sword, its everything-at-once, every '?' elite
    // slot — was content no player could reach. `lull` is what the zero used
    // to do incidentally: stop an empty room re-triggering the reward every
    // six seconds forever. speakPressure clears it when something answers.
    if (RT.cleared && (RT.quietT -= dt) <= 0) {
        RT.cleared = false; RT.combat.lull = 1;
        RT.wave = Math.max(0, RT.wave - 1);
    }
    if (!RT.cleared && !RT.combat.lull && RT.wave > 0 && alive === 0) {  // the place goes quiet again
        RT.cleared = true;
        if (!RT.tookHit) ach('nohit');
        coin(irnd(2, 5));
        say('Quiet again.', 'dim');
        poemClose();                            // and here is what you said
        RT.lastSaidFam = null;
        RT.quietT = 6;                          // sim seconds, like everything else
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
    if (RT.nagged !== e.n) { RT.nagged = e.n; say(shutText(e), 'dim'); hudNudge('breath'); }
}
/* never wake up inside a wall */
function unstick() {
    if (!blocked(RT.px, RT.py, 0.3)) return;
    for (var r = 0.5; r <= 8; r += 0.5) {
        for (var a = 0; a < 16; a++) {
            var x = RT.px + Math.cos(a / 16 * TAU) * r, y = RT.py + Math.sin(a / 16 * TAU) * r;
            if (x > 0.5 && y > 0.5 && x < pw() - 0.5 && y < ph() - 0.5 && !blocked(x, y, 0.3)) { RT.px = x; RT.py = y; return; }
        }
    }
}
/* keyed by what a thing IS, not by where it happens to sit in an array */
function lookKey(l) { return RT.place + ':' + l.n; }
/* `needs` understood exactly one predicate, "is this S.seen key truthy",
   which is not enough to gate an ending on. It now takes:
     needs: 'flagName'                a save flag, as before
     needs: ['a', 'b']                all of them
     needs: function (S) { ... }      anything at all
   The dev flag still opens everything. */
function exitOpen(e) {
    // `over` shuts a door for good once the night has happened. openAll
    // does not lift it: there is nothing on the other side any more.
    if (e.over && S.a3.ending) return false;
    if (!e.needs) return true;
    if (S.seen.openAll) return true;
    return testNeed(e.needs);
}
function testNeed(n) {
    if (!n) return true;
    if (typeof n === 'function') { try { return !!n(S); } catch (err) { return false; } }
    if (Array.isArray(n)) return n.every(testNeed);
    return !!S.seen[n];
}
/* a shut line is allowed to be a function, because one door refuses you
   for two different reasons at two different points in the story */
function shutText(e) { return (typeof e.shut === 'function' ? e.shut() : e.shut) || 'Not yet.'; }
function gotoPlace(id, fresh) {
    if (!PLACES[id]) id = 'square';
    var prev = RT.place;
    RT.place = id; S.place = id; S.seen['been_' + id] = 1; sSave();
    if (RT.realising) landRealisation();      // you walked out on it; you still heard it
    if (RT.realising2) { RT.realising2 = 0; grantFragment(2); }
    if (RT.realising3) { RT.realising3 = 0; grantFragment(3); }
    RESETS.forEach(function (fn) { try { fn(); } catch (e) {} });
    RT.foes.length = 0; RT.fproj.length = 0; RT.calls.length = 0;
    RT.beats = []; RT.typo.length = 0; RT.slams.length = 0; RT.lines.length = 0;
    RT.dialog = null; RT.pressure = 0; RT.cleared = false;
    RT.wave = 0; RT.tookHit = false;                       // per place, not per session
    RT.verseCast = 0; RT.recital = null; RT.dilate = 0; RT.mono = 0; RT.timeScale = 1;
    RT.timers.forEach(function (t) { clearTimeout(t); }); RT.timers.length = 0;
    // those timers were what faded the narration out. Clear the log with them,
    // and shut the dialogue panel the nulled RT.dialog used to own.
    var sayEl = RT.root.querySelector('.nn-say'); while (sayEl.firstChild) sayEl.removeChild(sayEl.firstChild);
    RT.root.querySelector('.nn-dlg').hidden = true;
    var p = PLACES[id];
    // walk in from the exit that points back where you came from
    var back = (p.exits || []).filter(function (e) { return e.to === prev; })[0];
    var W = p.w || GRID, H = p.h || GRID;
    if (back) { RT.px = clamp(back.x, 1, W - 1); RT.py = clamp(back.y, 1, H - 1);
        // step INTO the room, which is toward its middle — not toward wherever
        // tile 2 happens to be. An exit partway along a wall used to shove you
        // further into the wall.
        RT.px += back.h ? (back.x < W / 2 ? 1.2 : -1.2) : 0;
        RT.py += back.h ? 0 : (back.y < H / 2 ? 1.2 : -1.2); }
    else { RT.px = W / 2; RT.py = H - 2.2; }
    RT.moveTo = null; RT.armed = false; RT.nagged = null;
    RT.world.npc = {};                       // everybody back to their own doorstep
    unstick();
    stepCamera(0, true);                     // the eye arrives with you, it does not pan in from the last place
    /* This used to be a full heal on every transition, which made
       walking next door and back a free rest and meant nothing north of
       the fence could ever wear you down. Somewhere safe still mends
       you; a road does not. */
    if (p.calm || p.mends) RT.hp = RT.hpm;
    else RT.hp = clamp(RT.hp, RT.hpm * 0.35, RT.hpm);
    RT.breath = stats().breathMax; RT.winded = 0; RT.dead = false;
    buildFloor(p.floor, p.w || GRID, p.h || GRID);
    updateHud(0);
    bigLine(p.n, '', '#e8e2ee', 2.2);
    if (fresh && p.script) delete S.seen[p.script + 'Intro'];
    if (p.script && SCRIPTS[p.script]) SCRIPTS[p.script]();
    RT.phase = p.endless ? 'fight' : p.calm ? 'calm' : 'world';
    beat(1.6, checkRealisation); // idempotent: catches anything a doorway interrupted
    beat(1.8, checkMark);
    beat(2.0, checkSill);
}

/* ─────────────── people who are not furniture ───────────────
   The def's x/y is where a person lives; RT.world.npc holds where they
   actually are this second. The audit still reads the def, so a walker
   has to be reachable from home as well as on the day.
     path  a loop they walk, in tiles
     wander r  they drift within r of home
   Nobody moves while they are talking to you. */
function npcRT(id) {
    var w = RT.world.npc[id];
    if (!w) { var n = NPCS[id]; w = RT.world.npc[id] = { x: n.x, y: n.y, hx: n.x, hy: n.y, i: 0, wait: rnd(0.4, 2.2), bob: rnd(0, TAU), face: 1, moving: 0 }; }
    return w;
}
function npcX(n) { return n.id && RT.world.npc[n.id] ? RT.world.npc[n.id].x : n.x; }
function npcY(n) { return n.id && RT.world.npc[n.id] ? RT.world.npc[n.id].y : n.y; }
function stepNpcs(dt) {
    var p = place(), ids = p.npcs || [];
    for (var i = 0; i < ids.length; i++) {
        var id = ids[i], n = NPCS[id]; if (!n) continue;
        var w = npcRT(id);
        w.bob += dt * (n.skip ? 7.5 : 2.4);
        var talking = RT.dialog && RT.dialog.who === n.n;
        if (talking || (!n.path && !n.wander)) { w.moving = Math.max(0, w.moving - dt * 4); continue; }
        if (w.wait > 0) { w.wait -= dt; w.moving = Math.max(0, w.moving - dt * 4); continue; }
        var tx, ty;
        if (n.path && n.path.length) { var pt = n.path[w.i % n.path.length]; tx = pt[0]; ty = pt[1]; }
        else {
            if (w.tx == null) { var a = rnd(0, TAU), r = rnd(0.6, n.wander); w.tx = w.hx + Math.cos(a) * r; w.ty = w.hy + Math.sin(a) * r; }
            tx = w.tx; ty = w.ty;
        }
        var dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy);
        if (d < 0.16) {
            w.i++; w.tx = null; w.wait = n.skip ? rnd(0.2, 0.8) : rnd(1.2, 3.4); w.moving = 0; continue;
        }
        var sp = (n.speed || 1.5) * dt;
        var nx = w.x + dx / d * sp, ny = w.y + dy / d * sp;
        // people do not walk through walls either
        if (!blocked(nx, w.y, 0.28)) w.x = nx;
        if (!blocked(w.x, ny, 0.28)) w.y = ny;
        w.x = clamp(w.x, 0.6, pw() - 0.6); w.y = clamp(w.y, 0.6, ph() - 0.6);
        w.face = dx >= 0 ? 1 : -1; w.moving = 1;
        if (Math.hypot(tx - w.x, ty - w.y) > d - 0.001) { w.i++; w.tx = null; w.wait = 0.6; }   // stuck against a wall: give up on this leg
    }
}

/* ─────────────── things you can interact with ─────────────── */
function interactables() {
    var out = [], p = place();
    (p.npcs || []).forEach(function (id) {
        var n = NPCS[id]; if (!n) return;
        var w = npcRT(id);
        out.push({ k: 'npc', id: id, x: w.x, y: w.y, label: 'talk to ' + n.n, n: n });
    });
    (p.looks || []).forEach(function (l, i) {
        out.push({ k: 'look', i: i, x: l.x, y: l.y, label: 'look at ' + l.n, l: l });
    });
    (p.exits || []).forEach(function (e) {
        var open = exitOpen(e);
        out.push({ k: 'exit', x: e.x, y: e.y, e: e, shut: !open,
                   label: open ? 'go to ' + e.n : (e.over && S.a3.ending ? 'over' : 'not yet') });
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
    if (!RT || RT.dead || RT.devOpen || RT.mapOpen) return;
    var o = RT.prompt;
    if (RT.dialog) { advanceDialog(); return; }
    if (!o) return;
    if (o.k === 'npc') openDialog(o.n.talk(), o.n.n);
    else if (o.k === 'look') {
        S.looked = S.looked || {};
        S.looked[lookKey(o.l)] = 1;          // by name, not by index: reordering a place's looks used to
        openDialog([['', o.l.d]], o.l.n, o.l.key);   // silently rewrite which ones you had read
    }
    else if (o.k === 'exit') {
        if (o.shut) { say(shutText(o.e), 'dim'); return; }
        gotoPlace(o.e.to, false);
    }
}

/* ─────────────── dialogue ───────────────
   The slow channel. Full lines are allowed here because nothing
   is trying to kill you while you read them. */
/* ─────────────── talking ───────────────
   A line is ['Who', 'what they say']. A line can also be a question:

     { ask: 'what you are choosing between', who: 'You',
       opts: [ { t: 'the reply', if: fn, do: fn, go: [ ...more lines ] } ] }

   and any entry may carry `if: function () { return ... }`, which is
   read against the save when the conversation opens. That is what job 1
   needs to write an ending you can talk your way through.

   Escape and "press E past the last line" used to be two different code
   paths that both had to remember to run the fragment checks, and they
   had already drifted apart. There is one ending now: endDialog. */
function dlgLines(lines) {
    return (lines || []).filter(function (l) { return !l || !l.if || !!l.if(S); });
}
function openDialog(lines, who, key) {
    RT.dialog = { lines: dlgLines(lines), i: 0, who: who, key: key, sel: 0 };
    RT.moveTo = null;
    if (!RT.dialog.lines.length) { RT.dialog = null; return; }
    showDialog();
    sfx('ui');
}
function dlgAsk() { var d = RT.dialog; if (!d) return null; var l = d.lines[d.i]; return (l && l.ask) ? l : null; }
function dlgOpts(a) { return (a.opts || []).filter(function (o) { return !o.if || !!o.if(S); }); }
function showDialog() {
    var d = RT.dialog, el = RT.root.querySelector('.nn-dlg');
    if (!d) { el.hidden = true; return; }
    var ln = d.lines[d.i], ask = ln && ln.ask ? ln : null;
    // a question whose every answer is conditioned out is not a question.
    // job 1 writes the conditions here, and a dead end reads as a hang.
    if (ask && !dlgOpts(ask).length) ask = null;
    el.hidden = false;
    var opts = el.querySelector('.nn-dlg-opts');
    if (ask) {
        el.querySelector('.nn-dlg-who').textContent = ask.who || d.who || '';
        el.querySelector('.nn-dlg-tx').innerHTML = esc(ask.ask).replace(/\n/g, '<br>');
        var os = dlgOpts(ask);
        d.sel = clamp(d.sel, 0, Math.max(0, os.length - 1));
        opts.hidden = false;
        opts.innerHTML = os.map(function (o, i) {
            return '<button class="nn-opt' + (i === d.sel ? ' on' : '') + '" data-opt="' + i + '">' + esc(o.t) + '</button>';
        }).join('');
        el.querySelector('.nn-dlg-more').textContent = 'up / down — E to answer';
    } else {
        el.querySelector('.nn-dlg-who').textContent = (ln && (ln.who || ln[0])) || d.who || '';
        el.querySelector('.nn-dlg-tx').innerHTML = esc((ln && (ln.ask || ln[1])) || '').replace(/\n/g, '<br>');
        opts.hidden = true; opts.innerHTML = '';
        el.querySelector('.nn-dlg-more').textContent = d.i < d.lines.length - 1 ? 'E — more' : 'E — done';
    }
}
/* the one place a conversation ends, whichever way it ended */
function endDialog() {
    var d = RT.dialog; if (!d) return;
    var key = d.key;
    RT.dialog = null;
    RT.root.querySelector('.nn-dlg').hidden = true;
    if (key) S.seen[key] = 1;                 // a look with a key is a fact you now hold
    checkRealisation(); checkMark(); checkSill(); sSave();
}
function closeDialog() { endDialog(); }
/* Up and down pick an answer. They are registered rather than wired into
   the keydown chain, and they return false when no question is on screen,
   which is what stops the chain swallowing the arrow keys game wide. */
bindKey('arrowup', function () { return moveDlgSel(-1); });
bindKey('arrowdown', function () { return moveDlgSel(1); });
function moveDlgSel(dir) {
    var a = dlgAsk(); if (!a) return false;
    var n = dlgOpts(a).length; if (!n) return false;
    RT.dialog.sel = (RT.dialog.sel + dir + n) % n;
    showDialog(); sfx('ui');
    return true;
}
function pickDlgOpt(i) {
    var a = dlgAsk(); if (!a) return;
    var os = dlgOpts(a), o = os[i == null ? RT.dialog.sel : i];
    if (!o) return;
    if (o.do) { try { o.do(S); } catch (e) {} }
    var d = RT.dialog;
    var rest = d.lines.slice(d.i + 1);
    d.lines = d.lines.slice(0, d.i).concat(dlgLines(o.go || []), o.end ? [] : rest);
    d.i = Math.max(0, d.i);
    d.sel = 0;
    sfx('ui');
    if (d.i >= d.lines.length) { endDialog(); return; }
    showDialog();
}
function advanceDialog() {
    var d = RT.dialog; if (!d) return;
    var a = dlgAsk();
    if (a && dlgOpts(a).length) { pickDlgOpt(); return; }   // E answers the question you are being asked
    d.i++;
    if (d.i >= d.lines.length) { endDialog(); return; }
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
    RT.pressure = 0; RT.wave++; RT.combat.lull = 0;   // the room is answering again
    say(pick(['Something in the dark starts saying it back.', 'The dark has opinions about your delivery.', 'Somewhere behind you, your own line, slightly wrong.']), 'bad');
    // the roster is authored per place now (ENCOUNTERS), not one hardcoded
    // pair. speakDraws still caps how much a place is willing to send.
    var enc = encounterFor(RT.place, RT.wave - 1);
    // the place's own ceiling still applies, and it still opens up as the
    // waves go on, exactly as the hardcoded roster did
    var sent = spawnWave(enc, RT.px, RT.py, null, Math.min(p.speakDraws, 1 + RT.wave));
    if (!sent) spawnFoe('mouth', clamp(RT.px + 5, 1, pw() - 1), RT.py);
    S.draws = (S.draws || 0) + 1;                   // counted in the save, not in a frame counter
    if (RT.place === 'mill' && S.draws >= 2 && !S.seen.rehearsed) {
        S.seen.rehearsed = 1; sSave();
        say('Something up in the loft is saying your part along with you.', 'big');
    }
}

/* ─────────────── drawing the world ─────────────── */
/* (the old two-pass drawProps is gone: props are entities in the one
   painter sort now, which is what stopped people walking through walls) */
/* Every prop type in one table. It used to be two ternary chains, which
   is how `stone` ended up matching neither of them and drawing as an
   anonymous brown box in the middle of the lane. Unknown types now fall
   to `_` on purpose rather than by accident. */
var PROP = {
    house:     { h: 78, pal: ['#3b3340', '#2c2532', '#4a4150'] },
    mill:      { h: 96, pal: ['#4a3f30', '#37301f', '#5c5040'] },
    curtain:   { h: 120, pal: ['#3a1c22', '#2a1218', '#4a262e'] },
    stagewip:  { h: 26, pal: ['#43392e', '#332b22', '#544738'] },
    tree:      { h: 62, ins: 0.34, pal: ['#33291f', '#241c14', '#3e3225'] },
    well:      { h: 26, body: 'cyl', pal: ['#43392e', '#332b22', '#544738'] },
    markstone: { h: 40, pal: ['#4a4a52', '#3a3a42', '#5c5c66'] },
    wheel:     { h: 70, pal: ['#43392e', '#332b22', '#544738'] },
    fence:     { h: 22, pal: ['#3a2f24', '#2c231a', '#4a3d2e'] },
    beam:      { h: 16, pal: ['#3a2f24', '#2c231a', '#4a3d2e'] },
    cart:      { h: 22, pal: ['#43392e', '#332b22', '#544738'] },
    crate:     { h: 20, pal: ['#4a3d2c', '#382e21', '#5c4c38'] },
    sack:      { h: 14, body: 'round', pal: ['#5a4f36', '#463d29', '#6c5f44'] },
    foot:      { h: 6,  pal: ['#4a4030', '#3a3224', '#5c5040'] },
    stone:     { h: 20, body: 'round', pal: ['#4a4a52', '#3a3a42', '#5c5c66'] },
    lamp:      { h: 34, pal: ['#2e2a26', '#232019', '#3c3630'] },
    post:      { h: 30, pal: ['#3a2f24', '#2c231a', '#4a3d2e'] },
    cairn:     { h: 26, body: 'round', pal: ['#454550', '#35353f', '#565662'] },
    hedge:     { h: 24, pal: ['#22301f', '#182417', '#2c3f28'] },
    table:     { h: 20, pal: ['#4a3a28', '#382c1e', '#5e4a34'] },
    shelf:     { h: 46, pal: ['#413224', '#31261b', '#54412f'] },
    counter:   { h: 24, pal: ['#4a3a28', '#382c1e', '#5e4a34'] },
    bed:       { h: 14, pal: ['#3e3446', '#2f2836', '#4e4258'] },
    barrel:    { h: 22, body: 'cyl', pal: ['#46372a', '#352a20', '#584636'] },
    wall:      { h: 68, pal: ['#332b30', '#272026', '#42383e'] },
    vat:       { h: 26, body: 'cyl', pal: ['#3e3a34', '#2f2c27', '#514c44'] },
    _:         { h: 18, pal: ['#43392e', '#332b22', '#544738'] }
};
function propDef(t) { return PROP[t] || PROP._; }
function drawProp(cx, o) {
    var b = o.b, t = o.t;
    var x0 = isoX(b[0], b[1]), x1 = isoX(b[0] + b[2], b[1]), x2 = isoX(b[0] + b[2], b[1] + b[3]), x3 = isoX(b[0], b[1] + b[3]);
    var y0 = isoY(b[0], b[1]), y1 = isoY(b[0] + b[2], b[1]), y2 = isoY(b[0] + b[2], b[1] + b[3]), y3 = isoY(b[0], b[1] + b[3]);
    if (Math.max(x0, x1, x2, x3) < -80 || Math.min(x0, x1, x2, x3) > VW + 80) return;   // off camera
    if (Math.min(y0, y1, y2, y3) - 130 > VH + 40 || Math.max(y0, y1, y2, y3) < -160) return;
    var d = propDef(t), hgt = d.h, pal = d.pal;
    var mx0 = (x0 + x2) / 2, my0 = (y0 + y2) / 2;             // centre of the footprint
    var rrx = (x1 - x3) / 2, rry = (y2 - y0) / 2;             // and its half extents, in px
    /* The solid underneath the art. It used to be a box for everything,
       always, and the round props then painted a lump on the lid that
       covered about half of it, so the hollow read as six grey crates.
       A prop that is round in the world gets a round solid. */
    if (d.body === 'round') {
        cx.fillStyle = pal[1];                                // the whole silhouette, in shadow
        cx.beginPath(); cx.ellipse(mx0, my0 - hgt / 2, rrx * 0.96, rry + hgt / 2, 0, 0, TAU); cx.fill();
        cx.fillStyle = pal[0];                                // the side that faces the light
        cx.beginPath(); cx.ellipse(mx0 - rrx * 0.09, my0 - hgt * 0.6 - rry * 0.2, rrx * 0.8, (rry + hgt / 2) * 0.72, 0, 0, TAU); cx.fill();
        cx.fillStyle = pal[2];
        cx.beginPath(); cx.ellipse(mx0 - rrx * 0.2, my0 - hgt * 0.8 - rry * 0.4, rrx * 0.46, (rry + hgt / 2) * 0.34, 0, 0, TAU); cx.fill();
    } else if (d.body === 'cyl') {                            // round in plan: a foot, a straight side, a lid
        cx.fillStyle = pal[0];
        cx.fillRect(mx0 - rrx, my0 - hgt, rrx * 2, hgt);
        cx.beginPath(); cx.ellipse(mx0, my0, rrx, rry, 0, 0, TAU); cx.fill();
        cx.fillStyle = pal[1];
        cx.fillRect(mx0 + rrx * 0.3, my0 - hgt, rrx * 0.7, hgt);
        cx.fillStyle = pal[2];
        cx.beginPath(); cx.ellipse(mx0, my0 - hgt, rrx, rry, 0, 0, TAU); cx.fill();
    } else {
        // some props stand on less ground than they own: a tree is a
        // trunk in the middle of its canopy, not a green cube
        var k = d.ins || 1, gx0 = x0, gx1 = x1, gx2 = x2, gx3 = x3, gy0 = y0, gy1 = y1, gy2 = y2, gy3 = y3;
        if (k !== 1) {
            gx0 = mx0 + (x0 - mx0) * k; gx1 = mx0 + (x1 - mx0) * k; gx2 = mx0 + (x2 - mx0) * k; gx3 = mx0 + (x3 - mx0) * k;
            gy0 = my0 + (y0 - my0) * k; gy1 = my0 + (y1 - my0) * k; gy2 = my0 + (y2 - my0) * k; gy3 = my0 + (y3 - my0) * k;
        }
        // top face
        cx.beginPath(); cx.moveTo(gx0, gy0 - hgt); cx.lineTo(gx1, gy1 - hgt); cx.lineTo(gx2, gy2 - hgt); cx.lineTo(gx3, gy3 - hgt); cx.closePath();
        cx.fillStyle = pal[2]; cx.fill();
        // two visible walls
        cx.beginPath(); cx.moveTo(gx3, gy3 - hgt); cx.lineTo(gx2, gy2 - hgt); cx.lineTo(gx2, gy2); cx.lineTo(gx3, gy3); cx.closePath();
        cx.fillStyle = pal[0]; cx.fill();
        cx.beginPath(); cx.moveTo(gx1, gy1 - hgt); cx.lineTo(gx2, gy2 - hgt); cx.lineTo(gx2, gy2); cx.lineTo(gx1, gy1); cx.closePath();
        cx.fillStyle = pal[1]; cx.fill();
    }
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
        // three overlapping blobs read as a canopy; one ellipse reads as
        // a lozenge. The trunk is the inset solid underneath.
        var tx = (x0 + x2) / 2, ty = (y0 + y2) / 2 - hgt;
        cx.fillStyle = '#1c2c1f';
        cx.beginPath(); cx.ellipse(tx - rrx * 0.28, ty + rry * 0.26, rrx * 0.44, rry * 0.64, 0, 0, TAU); cx.fill();
        cx.beginPath(); cx.ellipse(tx + rrx * 0.3, ty + rry * 0.16, rrx * 0.4, rry * 0.6, 0, 0, TAU); cx.fill();
        cx.beginPath(); cx.ellipse(tx, ty + rry * 0.5, rrx * 0.34, rry * 0.46, 0, 0, TAU); cx.fill();   // the skirt, over the trunk top
        cx.fillStyle = '#2c4430';
        cx.beginPath(); cx.ellipse(tx, ty - rry * 0.38, rrx * 0.56, rry * 0.94, 0, 0, TAU); cx.fill();
        cx.fillStyle = '#3a5840';
        cx.beginPath(); cx.ellipse(tx - rrx * 0.16, ty - rry * 0.8, rrx * 0.3, rry * 0.44, 0, 0, TAU); cx.fill();
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
    if (t === 'well') {                                   // a shaft, and a rim you could sit on
        cx.fillStyle = '#12101a';
        cx.beginPath(); cx.ellipse(mx0, my0 - hgt, rrx * 0.66, rry * 0.66, 0, 0, TAU); cx.fill();
        cx.strokeStyle = 'rgba(30,24,18,.6)'; cx.lineWidth = 1.5;
        cx.beginPath(); cx.ellipse(mx0, my0 - hgt, rrx * 0.84, rry * 0.84, 0, 0, TAU); cx.stroke();
    }
    /* ── the nine that used to be coloured boxes, plus the indoor set ── */
    var tx = (x0 + x2) / 2, ty = (y0 + y2) / 2 - hgt;        // centre of the top face
    var fw = Math.hypot(x2 - x3, y2 - y3) || 1;              // the south-west face, in px
    function plank(n, col) {                                  // n seams across the south face
        cx.strokeStyle = col; cx.lineWidth = 1;
        for (var i = 1; i < n; i++) {
            var q = i / n, ax = x3 + (x2 - x3) * q, ay = y3 + (y2 - y3) * q;
            cx.beginPath(); cx.moveTo(ax, ay - hgt); cx.lineTo(ax, ay); cx.stroke();
        }
    }
    if (t === 'fence') {                                      // pickets and a rail, not a wall
        var long = b[2] >= b[3], n = Math.max(2, Math.round((long ? b[2] : b[3]) * 1.6));
        cx.strokeStyle = '#5a4a36'; cx.lineWidth = 2;
        for (var fi = 0; fi <= n; fi++) {
            var q2 = fi / n;
            var px = long ? isoX(b[0] + b[2] * q2, b[1] + b[3] / 2) : isoX(b[0] + b[2] / 2, b[1] + b[3] * q2);
            var py = long ? isoY(b[0] + b[2] * q2, b[1] + b[3] / 2) : isoY(b[0] + b[2] / 2, b[1] + b[3] * q2);
            cx.beginPath(); cx.moveTo(px, py + TILE_H / 2); cx.lineTo(px, py + TILE_H / 2 - hgt - 6); cx.stroke();
        }
        cx.strokeStyle = '#463a2a'; cx.lineWidth = 2.5;
        cx.beginPath(); cx.moveTo(x3, y3 - hgt - 2); cx.lineTo(x2, y2 - hgt - 2); cx.stroke();
        cx.beginPath(); cx.moveTo(x3, y3 - hgt + 8); cx.lineTo(x2, y2 - hgt + 8); cx.stroke();
    }
    if (t === 'beam' || t === 'post') { plank(3, 'rgba(0,0,0,.35)'); cx.fillStyle = 'rgba(255,240,210,.06)'; cx.fillRect(tx - fw * 0.3, ty - 1, fw * 0.6, 2); }
    if (t === 'crate') {
        plank(3, 'rgba(0,0,0,.4)');
        cx.strokeStyle = '#6a5a40'; cx.lineWidth = 1.5;
        cx.beginPath(); cx.moveTo(x3, y3 - hgt * 0.55); cx.lineTo(x2, y2 - hgt * 0.55); cx.stroke();
        cx.strokeStyle = 'rgba(120,100,70,.5)';
        cx.beginPath(); cx.moveTo(x3, y3); cx.lineTo(x2, y2 - hgt); cx.stroke();
    }
    if (t === 'barrel') {                                     // staves down, hoops around
        cx.strokeStyle = 'rgba(0,0,0,.32)'; cx.lineWidth = 1;
        for (var bs = -2; bs <= 2; bs++) {
            var bx = mx0 + rrx * bs * 0.3;
            cx.beginPath(); cx.moveTo(bx, my0 - hgt + 2); cx.lineTo(bx, my0 + rry * 0.5); cx.stroke();
        }
        cx.strokeStyle = '#6a5a40'; cx.lineWidth = 1.5;
        [0.72, 0.24].forEach(function (q) {
            cx.beginPath(); cx.ellipse(mx0, my0 - hgt * q, rrx, rry, 0, 0, Math.PI); cx.stroke();
        });
    }
    if (t === 'sack') {                                       // a grain sack slumps, and it is tied at the neck
        cx.fillStyle = '#463d29'; cx.fillRect(tx - 3, ty - rry + 1, 6, 5);
        cx.strokeStyle = 'rgba(40,34,22,.5)'; cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(tx - rrx * 0.36, ty + rry * 0.3); cx.lineTo(tx + rrx * 0.34, ty + rry * 0.5); cx.stroke();
    }
    if (t === 'cart') {                                       // two wheels and a bed with rails
        cx.fillStyle = '#2a2118';
        [[-0.3, 0.34], [0.32, 0.3]].forEach(function (w) {
            cx.beginPath(); cx.arc(tx + fw * w[0], ty + hgt * 0.9, 7, 0, TAU); cx.fill();
        });
        cx.strokeStyle = '#5c4a32'; cx.lineWidth = 2;
        cx.beginPath(); cx.moveTo(x3, y3 - hgt - 10); cx.lineTo(x2, y2 - hgt - 10); cx.stroke();
        cx.beginPath(); cx.moveTo(x3, y3 - hgt); cx.lineTo(x3, y3 - hgt - 10); cx.stroke();
        cx.beginPath(); cx.moveTo(x2, y2 - hgt); cx.lineTo(x2, y2 - hgt - 10); cx.stroke();
    }
    if (t === 'mill') {                                       // roof, door, and the sails behind it
        var rh2 = 30, mmx = tx, mmy = ty;
        cx.fillStyle = '#2a2318';
        cx.beginPath(); cx.moveTo(x3, y3 - hgt); cx.lineTo(x2, y2 - hgt); cx.lineTo(mmx, mmy - rh2); cx.closePath(); cx.fill();
        cx.fillStyle = '#221c12';
        cx.beginPath(); cx.moveTo(x1, y1 - hgt); cx.lineTo(x2, y2 - hgt); cx.lineTo(mmx, mmy - rh2); cx.closePath(); cx.fill();
        cx.fillStyle = '#1a1410'; cx.fillRect(tx - 7, ty + hgt * 0.42, 14, hgt * 0.58);
        cx.fillStyle = '#3a2f1e'; cx.fillRect(tx - 7, ty + hgt * 0.42, 14, 3);
        plank(5, 'rgba(0,0,0,.28)');
    }
    if (t === 'wheel') {                                      // the mill wheel, spokes and all
        var wr = Math.min(34, hgt * 0.46);
        cx.strokeStyle = '#4a3d2a'; cx.lineWidth = 4;
        cx.beginPath(); cx.arc(tx, ty + hgt * 0.42, wr, 0, TAU); cx.stroke();
        cx.lineWidth = 2; cx.strokeStyle = '#5c4c34';
        for (var sp = 0; sp < 8; sp++) {
            var an = sp / 8 * TAU + RT.t * 0.25;
            cx.beginPath(); cx.moveTo(tx, ty + hgt * 0.42);
            cx.lineTo(tx + Math.cos(an) * wr, ty + hgt * 0.42 + Math.sin(an) * wr); cx.stroke();
        }
    }
    if (t === 'stone' || t === 'cairn') {                     // a boulder, not a crate
        cx.strokeStyle = 'rgba(18,16,24,.45)'; cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(tx - rrx * 0.34, ty - rry * 0.1);
        cx.lineTo(tx - rrx * 0.02, ty + rry * 0.26);
        cx.lineTo(tx + rrx * 0.3, ty + rry * 0.16);
        cx.stroke();
        cx.fillStyle = 'rgba(210,210,230,.09)';
        cx.beginPath(); cx.ellipse(tx - rrx * 0.26, ty - rry * 0.6, rrx * 0.16, rry * 0.34, -0.5, 0, TAU); cx.fill();
        if (t === 'cairn') {                                  // one more stone on top, because somebody stacked it
            var cy2 = ty - rry - hgt * 0.14;
            cx.fillStyle = pal[1];
            cx.beginPath(); cx.ellipse(tx + 1, cy2, rrx * 0.42, rry * 0.42, 0, 0, TAU); cx.fill();
            cx.fillStyle = pal[2];
            cx.beginPath(); cx.ellipse(tx - rrx * 0.05, cy2 - rry * 0.12, rrx * 0.26, rry * 0.24, 0, 0, TAU); cx.fill();
        }
    }
    if (t === 'hedge') {
        cx.fillStyle = '#22331f';
        for (var hb = 0; hb < 4; hb++) {
            var hq = hb / 3, hx = x3 + (x2 - x3) * hq, hy = y3 + (y2 - y3) * hq;
            cx.beginPath(); cx.ellipse(hx, hy - hgt, 13, 9, 0, 0, TAU); cx.fill();
        }
        cx.fillStyle = '#2f4429'; cx.beginPath(); cx.ellipse(tx, ty - 5, fw * 0.4, 8, 0, 0, TAU); cx.fill();
    }
    if (t === 'curtain') {                                    // heavy folds, and it hangs
        cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = 3;
        for (var cf = 1; cf < 14; cf++) {
            var cq = cf / 14, ax2 = x3 + (x2 - x3) * cq, ay2 = y3 + (y2 - y3) * cq;
            cx.beginPath(); cx.moveTo(ax2, ay2 - hgt + 4);
            cx.lineTo(ax2 + Math.sin(cf * 1.7) * 2, ay2 - 2); cx.stroke();
        }
        cx.fillStyle = '#5c3038'; cx.fillRect(Math.min(x3, x2), Math.min(y3, y2) - hgt, Math.abs(x2 - x3), 5);
    }
    if (t === 'foot') {                                       // footlights, the reason the stage is lit
        for (var fl = 0; fl < 9; fl++) {
            var lq = (fl + 0.5) / 9, lx = x3 + (x2 - x3) * lq, ly = y3 + (y2 - y3) * lq;
            cx.fillStyle = '#1a1410'; cx.fillRect(lx - 3, ly - hgt - 4, 6, 5);
            cx.globalCompositeOperation = 'lighter';
            var fg = cx.createRadialGradient(lx, ly - hgt - 4, 1, lx, ly - hgt - 4, 22);
            fg.addColorStop(0, 'rgba(255,190,90,.5)'); fg.addColorStop(1, 'rgba(255,190,90,0)');
            cx.fillStyle = fg; cx.beginPath(); cx.arc(lx, ly - hgt - 4, 22, 0, TAU); cx.fill();
            cx.globalCompositeOperation = 'source-over';
        }
    }
    if (t === 'lamp') {                                       // the whole title of the game
        cx.strokeStyle = '#2a2620'; cx.lineWidth = 3;
        cx.beginPath(); cx.moveTo(tx, ty + hgt); cx.lineTo(tx, ty - 6); cx.stroke();
        var flick = 0.82 + Math.sin(RT.t * 7 + b[0]) * 0.18;
        cx.fillStyle = 'rgba(30,24,18,.95)'; cx.fillRect(tx - 6, ty - 18, 12, 13);
        cx.fillStyle = 'rgba(255,206,120,' + (0.55 + flick * 0.4).toFixed(2) + ')'; cx.fillRect(tx - 4, ty - 16, 8, 9);
        cx.globalCompositeOperation = 'lighter';
        var lg = cx.createRadialGradient(tx, ty - 11, 2, tx, ty - 11, 34);
        lg.addColorStop(0, 'rgba(255,200,110,' + (0.3 * flick).toFixed(2) + ')'); lg.addColorStop(1, 'rgba(255,190,90,0)');
        cx.fillStyle = lg; cx.beginPath(); cx.arc(tx, ty - 11, 34, 0, TAU); cx.fill();
        cx.globalCompositeOperation = 'source-over';
    }
    if (t === 'table' || t === 'counter') {
        plank(4, 'rgba(0,0,0,.3)');
        cx.fillStyle = 'rgba(255,240,210,.05)'; cx.beginPath();
        cx.moveTo(x0, y0 - hgt); cx.lineTo(x1, y1 - hgt); cx.lineTo(x2, y2 - hgt); cx.lineTo(x3, y3 - hgt); cx.closePath(); cx.fill();
        if (t === 'counter') { cx.fillStyle = '#2a2118'; cx.fillRect(tx - fw * 0.36, ty + 4, fw * 0.72, 3); }
    }
    if (t === 'shelf') {
        cx.strokeStyle = 'rgba(0,0,0,.4)'; cx.lineWidth = 2;
        for (var sh = 1; sh < 3; sh++) {
            cx.beginPath(); cx.moveTo(x3, y3 - hgt * sh / 3); cx.lineTo(x2, y2 - hgt * sh / 3); cx.stroke();
        }
        var jars = ['#6a5a3a', '#4a5a5a', '#6a4a4a', '#5a5a3a'];
        for (var jr = 0; jr < 5; jr++) {
            var jq = (jr + 0.5) / 5, jx = x3 + (x2 - x3) * jq, jy = y3 + (y2 - y3) * jq;
            cx.fillStyle = jars[jr % 4]; cx.fillRect(jx - 3, jy - hgt + 4, 6, 8);
            cx.fillStyle = jars[(jr + 1) % 4]; cx.fillRect(jx - 3, jy - hgt * 2 / 3 + 3, 6, 7);
        }
    }
    if (t === 'bed') {
        cx.fillStyle = '#514463';
        cx.beginPath(); cx.moveTo(x0, y0 - hgt); cx.lineTo(x1, y1 - hgt); cx.lineTo(x2, y2 - hgt); cx.lineTo(x3, y3 - hgt); cx.closePath(); cx.fill();
        cx.fillStyle = '#d8cfc0';
        var hx2 = x3 + (x0 - x3) * 0.72, hy2 = y3 + (y0 - y3) * 0.72;
        cx.beginPath(); cx.ellipse(hx2, hy2 - hgt - 1, 9, 5, 0, 0, TAU); cx.fill();
    }
    if (t === 'vat') {                                        // wax, cooling, with a skin on it
        cx.fillStyle = '#1b1a16';
        cx.beginPath(); cx.ellipse(mx0, my0 - hgt, rrx * 0.84, rry * 0.84, 0, 0, TAU); cx.fill();
        cx.fillStyle = 'rgba(230,220,190,.5)';
        cx.beginPath(); cx.ellipse(mx0, my0 - hgt + 2, rrx * 0.7, rry * 0.7, 0, 0, TAU); cx.fill();
        cx.fillStyle = 'rgba(255,244,214,.28)';
        cx.beginPath(); cx.ellipse(mx0 - rrx * 0.2, my0 - hgt, rrx * 0.24, rry * 0.24, 0, 0, TAU); cx.fill();
    }
    if (t === 'wall') { plank(Math.max(2, Math.round(fw / 26)), 'rgba(0,0,0,.3)'); }
}
/* ─────────────── light ───────────────
   Every house sets a lamp on the sill. That is the name of the game, so
   it gets a pass of its own: darkness laid down flat, then punched back
   out around every flame in the place and around the lantern they put
   in your hand. */
function lightsOf(p) {
    var out = [];
    (p.props || []).forEach(function (o) {
        var b = o.b;
        if (o.t === 'house') out.push({ x: b[0] + b[2] * 0.18, y: b[1] + b[3] + 0.2, r: 3.6, c: '255,196,110', i: 0.95 });
        else if (o.t === 'lamp') out.push({ x: b[0] + b[2] / 2, y: b[1] + b[3] / 2, r: 3.2, c: '255,206,120', i: 1 });
        else if (o.t === 'foot') out.push({ x: b[0] + b[2] / 2, y: b[1] + b[3] / 2, r: 4.4, c: '255,190,90', i: 0.7 });
        else if (o.t === 'mill') out.push({ x: b[0] + b[2] / 2, y: b[1] + b[3] + 0.3, r: 2.4, c: '255,190,120', i: 0.45 });
    });
    (p.lights || []).forEach(function (l) { out.push(l); });
    return out;
}
function drawLights(cx) {
    var p = place(); if (!p.night) return;
    cx.fillStyle = 'rgba(6,5,14,' + (p.night >= 2 ? 0.66 : 0.5) + ')';
    cx.fillRect(0, 0, VW, VH);
    var ls = lightsOf(p);
    if (!RT.dead) ls.push({ x: RT.px, y: RT.py, r: 3.4, c: '255,214,150', i: 0.8, self: 1 });
    cx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < ls.length; i++) {
        var l = ls[i], sx = isoX(l.x, l.y), sy = isoY(l.x, l.y) + TILE_H / 2;
        var rad = l.r * 30;
        if (sx < -rad || sx > VW + rad || sy < -rad * 2 || sy > VH + rad * 2) continue;
        var fk = l.self ? 1 : 0.88 + Math.sin(RT.t * 6.2 + l.x * 2.7 + l.y) * 0.12;
        cx.save(); cx.translate(sx, sy - (l.self ? 14 : 10)); cx.scale(1, 0.62);
        var g = cx.createRadialGradient(0, 0, 2, 0, 0, rad);
        g.addColorStop(0, 'rgba(' + l.c + ',' + (0.24 * l.i * fk).toFixed(3) + ')');
        g.addColorStop(0.45, 'rgba(' + l.c + ',' + (0.085 * l.i * fk).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + l.c + ',0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(0, 0, rad, 0, TAU); cx.fill(); cx.restore();
    }
    cx.globalCompositeOperation = 'source-over';
}
/* The vignette used to be baked into the floor bitmap, which meant it
   sat under every prop and, with a camera, scrolled away off the side
   of the screen. It belongs to the eye. */
function drawVignette(cx) {
    var vg = cx.createRadialGradient(VW / 2, VH / 2 - 30, 210, VW / 2, VH / 2, 620);
    vg.addColorStop(0, 'rgba(4,3,8,0)'); vg.addColorStop(1, 'rgba(4,3,8,.92)');
    cx.fillStyle = vg; cx.fillRect(0, 0, VW, VH);
}
/* Something you can look at has to be visible before you are told
   you can look at it. A small mark, brighter once you are close,
   duller once you have read it. */
function drawLooks(cx) {
    (place().looks || []).forEach(function (l, i) {
        var sx = isoX(l.x, l.y), sy = isoY(l.x, l.y) + TILE_H / 2;
        var near = Math.hypot(l.x - RT.px, l.y - RT.py) < 2.4;
        var read = !!(S.looked && S.looked[lookKey(l)]);
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
    var w2 = n.id ? npcRT(n.id) : { x: n.x, y: n.y, bob: RT.t * 2.4, moving: 0, face: 1 };
    var sx = isoX(w2.x, w2.y), sy = isoY(w2.x, w2.y) + TILE_H / 2;
    if (sx < -70 || sx > VW + 70 || sy < -90 || sy > VH + 90) return;
    // standing still is a slow breath; walking is a step; the child skips
    var stride = w2.moving ? (n.skip ? 5.5 : 2.2) : 0.9;
    var bob = Math.abs(Math.sin(w2.bob)) * stride + (w2.moving ? 0 : Math.sin(w2.bob) * 0.4);
    var lean = w2.moving ? Math.sin(w2.bob) * 0.09 * (n.skip ? 2 : 1) : 0;
    var h = n.small ? 26 : 40, w = n.small ? 7 : 9;
    cx.save(); cx.translate(sx, sy - bob);
    cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(0, bob, 9, 3.6, 0, 0, TAU); cx.fill();
    cx.rotate(lean);
    cx.fillStyle = n.col[0]; cx.beginPath();
    cx.moveTo(-w, 0); cx.lineTo(-w * 0.7, -h * 0.7); cx.lineTo(w * 0.7, -h * 0.7); cx.lineTo(w, 0); cx.closePath(); cx.fill();
    cx.fillStyle = n.col[1]; cx.fillRect(-w * 0.7, -h * 0.72, w * 1.4, h * 0.24);
    // legs, so a walk reads as a walk
    if (w2.moving) {
        var sw = Math.sin(w2.bob) * w * 0.55;
        cx.strokeStyle = n.col[0]; cx.lineWidth = 2.4;
        cx.beginPath(); cx.moveTo(-w * 0.25, -1); cx.lineTo(-w * 0.25 + sw, 3); cx.stroke();
        cx.beginPath(); cx.moveTo(w * 0.25, -1); cx.lineTo(w * 0.25 - sw, 3); cx.stroke();
    }
    cx.fillStyle = n.col[2]; cx.beginPath(); cx.arc(0, -h * 0.86, w * 0.62, 0, TAU); cx.fill();
    if (n.hat) { cx.fillStyle = '#2a2018'; cx.fillRect(-w * 0.95, -h * 1.06, w * 1.9, 3); cx.fillRect(-w * 0.55, -h * 1.22, w * 1.1, 4); }
    cx.restore();
    // a quiet mark so you know they will talk to you
    cx.save(); cx.globalAlpha = 0.5 + Math.sin(RT.t * 2.6 + w2.y) * 0.2;
    cx.fillStyle = '#c9a94a'; cx.font = 'bold 9px "Press Start 2P", monospace'; cx.textAlign = 'center';
    cx.fillText('·', sx, sy - h - 12 - bob); cx.restore(); cx.textAlign = 'left';
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
/* the stage is a memory and the arena is furniture: neither is
   somewhere you can walk, so neither belongs on a map of where
   you have been. */
var MAP_HIDE = { arena: 1, stage: 1, a3sq: 1 };
/* The map used to be a hand maintained table, and any place you forgot
   to add vanished from it silently, along with every road leading to
   it. It is derived from the exit graph now: which wall an exit sits on
   says which way the next place lies, and a breadth first walk from the
   square lays them all out. MAP_SEED only pins the root and anything
   the graph cannot reach. */
var MAP_SEED = { square: [2, 3], stage: [1, 4], arena: [0, 0] };
function exitDir(p, e) {
    var W = p.w || GRID, H = p.h || GRID;
    var dx = e.x < W * 0.25 ? -1 : e.x > W * 0.75 ? 1 : 0;
    var dy = e.y < H * 0.25 ? -1 : e.y > H * 0.75 ? 1 : 0;
    if (dx && dy) { if (Math.abs(e.x - W / 2) / W > Math.abs(e.y - H / 2) / H) dy = 0; else dx = 0; }
    if (!dx && !dy) dy = -1;                      // a door in the middle of a room leads "in"
    return [dx, dy];
}
function buildMap() {
    var pos = {}, taken = {}, k;
    for (k in MAP_SEED) if (PLACES[k]) { pos[k] = MAP_SEED[k].slice(); taken[pos[k].join(',')] = k; }
    var q = ['square'], guard = 0;
    while (q.length && guard++ < 400) {
        var id = q.shift(), p = PLACES[id]; if (!p || !pos[id]) continue;
        (p.exits || []).forEach(function (e) {
            if (!PLACES[e.to] || pos[e.to]) return;
            var d = exitDir(p, e), c = [pos[id][0] + d[0], pos[id][1] + d[1]], slip = 0;
            // an occupied cell slides along the axis it did not travel on
            while (taken[c.join(',')] && slip < 12) {
                slip++;
                if (d[0]) c[1] = pos[id][1] + (slip % 2 ? 1 : -1) * Math.ceil(slip / 2);
                else c[0] = pos[id][0] + (slip % 2 ? 1 : -1) * Math.ceil(slip / 2);
            }
            pos[e.to] = c; taken[c.join(',')] = e.to; q.push(e.to);
        });
    }
    // anything the graph never reached still gets a cell, off to one side
    var spare = 0;
    PLACE_IDS.forEach(function (id) {
        if (pos[id] || MAP_HIDE[id]) return;
        while (taken[(-1) + ',' + spare] && spare < 40) spare++;
        pos[id] = [-1, spare]; taken[pos[id].join(',')] = id; spare++;
    });
    return pos;
}
var MAP_POS = buildMap();
function drawMap(cx) {
    if (!RT.mapOpen) return;
    cx.fillStyle = 'rgba(6,4,10,.9)'; cx.fillRect(0, 0, VW, VH);
    cx.textAlign = 'center';
    cx.fillStyle = '#d8cfa8'; cx.font = '16px "Press Start 2P", monospace';
    cx.fillText('WHERE YOU HAVE BEEN', VW / 2, 70);
    /* derived coordinates are not hand tuned to fit the panel, so the
       panel fits itself around them */
    var lo = [1e9, 1e9], hi = [-1e9, -1e9], any = false;
    PLACE_IDS.forEach(function (id) {
        var m = MAP_POS[id]; if (!m || MAP_HIDE[id] || !S.seen['been_' + id]) return;
        any = true;
        lo[0] = Math.min(lo[0], m[0]); lo[1] = Math.min(lo[1], m[1]);
        hi[0] = Math.max(hi[0], m[0]); hi[1] = Math.max(hi[1], m[1]);
    });
    if (!any) { lo = [0, 0]; hi = [0, 0]; }
    var spanX = hi[0] - lo[0], spanY = hi[1] - lo[1];
    var cell = Math.min(100, Math.floor(Math.min(spanX ? 620 / spanX : 100, spanY ? 330 / spanY : 100)));
    cell = Math.max(46, cell);
    var ox = VW / 2 - (lo[0] + spanX / 2) * cell, oy = 150 + 130 - (lo[1] + spanY / 2) * cell;
    // links first
    cx.lineWidth = 2;
    PLACE_IDS.forEach(function (id) {
        if (!MAP_POS[id] || !S.seen['been_' + id] || MAP_HIDE[id]) return;
        (PLACES[id].exits || []).forEach(function (e) {
            if (!MAP_POS[e.to] || MAP_HIDE[e.to]) return;
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
        var m = MAP_POS[id]; if (!m || MAP_HIDE[id]) return;
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
    if (q.nwipe) {                       // wipe AND rebuild, or the old save is still in S
        try { localStorage.removeItem('comp_ninth'); } catch (e) {}
        S = null; sLoad();
    }
    if (q.nfrag) for (var i = 1; i <= +q.nfrag; i++) grantFragment(i);
    if (q.nitems) { ITEM_IDS.forEach(function (it) { giveItem(it); }); S.coin = Math.max(S.coin, +q.nitems || 250); sSave(); }
    if (PLACES[id]) gotoPlace(id, true);
    if (q.nat) { var xy = q.nat.split(','); RT.px = +xy[0]; RT.py = +xy[1]; RT.armed = false; unstick(); }
    if (q.ndevtab) RT.devTab = q.ndevtab.toUpperCase();   // which dev tab nkey=` should land on
    if (q.nfoes) for (var j = 0; j < +q.nfoes; j++) {
        var a = j / +q.nfoes * TAU;
        spawnFoe(j === 0 ? 'thief' : 'mouth', clamp(RT.px + Math.cos(a) * 4, 1, pw() - 1), clamp(RT.py + Math.sin(a) * 4, 1, ph() - 1));
    }
    var fr = q.nfr ? +q.nfr : 90;
    for (var f = 0; f < fr; f++) { try { step(1 / 60); draw(); } catch (e) { console.error('devDemo step', e); break; } }
    if (q.ndlg && NPCS[q.ndlg]) { var n = NPCS[q.ndlg]; openDialog(n.talk(), n.n); }
    /* nkey=e,e,arrowdown drives the real keydown chain rather than calling
       the handlers, because the one bug this harness exists to catch was
       E being bound to something else entirely. */
    if (q.nkey) q.nkey.split(',').forEach(function (k) {
        if (!k) return;
        RT.root.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
        RT.root.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
        draw();
    });
    if (q.na3) {                       // na3=crowd|cue|verse|written|true|silence
        RT.beats = [];
        RT.story = { cue: 0, holding: 0, tries: 0, waitT: 0, done: 0, sawCall: 0, sawAnswer: 0,
                     callMark: RT.nCalls, answerMark: RT.nAnswers };
        a3Crowd(); a3Mark();
        if (q.na3 === 'cue') { a3CueLast(); a3Watch(); }   // the watcher too, or no ending can fire
        else if (q.na3 === 'verse') { S.verse = 1; RT.story.cue = 3; a3End('true'); for (var v = 0; v < 400; v++) step(1 / 60); doVerse(); }
        else if (q.na3 === 'hal') {
            // the far side of the Verse, without waiting on its timers: the
            // town on its feet and the last man walking up to the front.
            S.verse = 1; RT.story.cue = 3; a3End('true');
            for (var w3 = 0; w3 < 400; w3++) step(1 / 60);
            RT.foes.forEach(function (f) { if (f.def.folk && !f.isHal) f.seat = 0; });
            a3Hal();
        }
        else if (q.na3 !== 'crowd') { RT.story.cue = 3; a3End(q.na3); }
        // per branch, because a shared 90 frames is 1.5 seconds and every one
        // of these states is a beat further out than that. na3=hal at 90 gives
        // you a man still sitting at the back of the square, which is exactly
        // the frame the branch exists to not produce.
        var A3FR = { cue: 400, hal: 780, verse: 120, crowd: 90 };
        for (var b3 = 0; b3 < (+q.na3fr || A3FR[q.na3] || 90); b3++) { step(1 / 60); draw(1 / 60); }
    }
    if (q.nmap) RT.mapOpen = true;
    // the shop is gated on standing at the chandler; a capture has no legs
    if (q.npanel === 'shop') RT.items.atShop = true;
    if (q.npanel) panel(q.npanel);
    /* nsfx: fire every sound name and report what the graph did.
       This cannot tell you whether the game SOUNDS right, and nothing
       automated can. What it does catch is the whole class of failure
       that used to be invisible: a bad ramp target, a null node, a
       typo in a name, an exception swallowed by the catch. Run headless
       with --autoplay-policy=no-user-gesture-required or the context
       never leaves 'suspended' and every one of these is a no-op. */
    if (q.nsfx) {
        audioRig();
        SFX_NAMES.forEach(function (k) { sfx(k); });
        var A = RT.audio;
        window.__nnAudio = { ctx: RT.ac ? RT.ac.state : 'none', rig: A.ready ? 'up' : 'down',
                             tried: SFX_NAMES.length, errs: A.errs, last: A.lastErr, amb: A.ambKind };
        document.title = 'nnAudio ' + JSON.stringify(window.__nnAudio);
    }
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
        /* closing the context stops every scheduled node, ambience
           included. Mark the rig dead first so anything still in flight
           this tick cannot rebuild it against a closing context. */
        if (RT.audio) { RT.audio.ready = 0; RT.audio.amb = null; RT.audio.ambKind = ''; }
        if (RT.ac) { try { RT.ac.close(); } catch (e) {} }
        RT = null;
    }
    freeFloors();       // the cache is megabytes of prerendered ground; it does not outlive the window
    if (S) sSave();
    if (window.__ninth) delete window.__ninth;
    return hrs;
}
combatBoot();          // job 4: keybind + travel reset, once every var above exists
/* ─────────────── job 5 registrations ───────────────
   Down here because bindKey and onPlaceChange write into KEYS and
   RESETS, and those are plain `var`s that are still undefined higher up
   the file. Registering next to ITEMS threw on load. */
bindKey('i', function () { panel('bag'); });
/* Soft wax goes cold in a doorway and the counter is behind you. The pitch
   stays on your palm until something tries to strip a stack, and the mask
   stays on your face: it lives on the save, not the runtime. */
onPlaceChange(function () {
    if (!RT) return;
    RT.items.freeSlant = 0; RT.items.atShop = false;   // the wax and the shop do not follow you; the mask does
    // The bag renders "on a sill HERE" and "left somewhere else" from RT.place
    // at render time, and you can walk through a door with it open. Left
    // alone it offers a take button for a lamp in the room you just left, and
    // hides the one in the room you just entered.
    if (RT.panel === 'bag') fillBag();
});

/* Travelling used to be silent. Registered here rather than in
   gotoPlace's reset block, which is shared. The rig is only ready
   once a real gesture has started the context, so the gotoPlace
   inside init() cannot fire this on first load. */
onPlaceChange(function () { if (RT && RT.audio && RT.audio.ready) sfx('travel'); });

window.NINTH = {
    render: render, init: init, close: close, steamAch: steamAch,
    /* the desktop shell owns the window; these let it stop the sound
       behind a minimized one and drive the taskbar volume slider */
    suspend: audioSuspend, resume: audioResume, volume: audioVolume
};
})();
