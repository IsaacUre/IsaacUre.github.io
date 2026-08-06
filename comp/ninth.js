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
    droneSelfHurt: 0     // 0 = a Droner's own words never hurt YOU. see the PR.
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
    ['allsix', 'The Whole Cast', 'Meet all six of them']
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
    hilt:   { n: 'A Sword Hilt', cost: 140, sell: 12, joke: 1, d: 'Prop, not weapon. Nothing rhymes with sword, so it does nothing at all, in any hand, forever. He is asking a great deal for it.',
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
        d: 'Off the chandler\'s bench. Warm it in your hand and a mismatched pair holds for a while: slants land in full.',
        // stacks rather than resets, so a second stub is never worth less
        // than the seconds it wipes off the first
        use: function () {
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
            var got = Math.round(RT.echo * 0.55); RT.echo = 0;
            RT.breath = Math.min(stats().breathMax, RT.breath + got); RT.winded = 0;
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
        d: 'MARK, cut deep, on a chip of post from out past the fence. He does not say who brought it in.' },
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
        d: 'A scrap of somebody else\'s memory of the play, in the wrong metre. The chandler buys these. Occasionally one has a word on the back.',
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
    if (n > 0 && x != null) typo(x, y, '+' + n, '#ffe66e', 0.7, 13, 'drift');
    sSave();   // every other coin source used to ride on foeDie saving right after
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
function lampsOut() { return Object.keys(S.items.lamps).length; }
/* a lamp you left here, retrieved when you are carrying none: without this
   the bag shows no lamp row at all and the one on the sill is unreachable */
function takeLamp() {
    if (!RT || !S.items.lamps[RT.place]) return false;
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
        giveItem('coal');
        typo(f.x, f.y, 'a coal', '#ffb14e', 1.1, 12, 'drift');
        say('Something falls out of the noise and hits the boards. A coal, burnt through, cold. It has been up here a long time.', 'big');
        return;
    }
    var chance = k === 'mouth' ? 0.5 : k === 'thief' ? 0.4 : k === 'sword' ? 0.9 : 0.3;
    if (r > chance) return;
    // an unlearned word you can actually read comes up rarely, and only
    // ever in a family you have already opened
    var open = [];
    FAM_IDS.forEach(function (fid) {
        if (!famOwned(fid)) return;
        FAMS[fid].words.forEach(function (w) { if (!S.owned[w] && writForWord(w)) open.push(w); });
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
function grantFragment(n) {
    var map = { 1: ['erd', 'word'], 2: ['ark', 'dark'], 3: ['ill', 'will'] };
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
    var a = null; ACH.forEach(function (x) { if (x[0] === id) a = x; });
    // an id that is not in ACH used to set the save flag anyway, so when
    // somebody added the entry later it was already unlocked, silently,
    // with no toast. Refuse the unknown id instead.
    if (!a) { if (window.console) console.warn('NINTH: ach("' + id + '") is not in ACH'); return; }
    S.ach[id] = 1; sSave();
    if (RT) RT.toasts.push({ t: 3.4, n: a[1], d: a[2] });
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
        '<div class="nn-panel nn-p-bag" hidden><header>WHAT YOU CARRY<span class="nn-bag-coin"></span><button class="nn-x" type="button">×</button></header><div class="nn-pb"></div></div>' +

        // dev menu — the whole point of the ask. populated from DEV below.
        '<div class="nn-dev" hidden><header>DEV MENU<i>`</i><button class="nn-x" type="button">×</button></header>' +
          '<div class="nn-dev-tabs"></div><div class="nn-dev-body"></div>' +
          '<div class="nn-dev-foot"></div></div>' +

        '<div class="nn-btns">' +
          '<button class="nn-b" data-nn="p:book" type="button" title="The play (B)">B</button>' +
          '<button class="nn-b" data-nn="p:kit" type="button" title="Words &amp; charms (C)">C</button>' +
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
    RT.god = 0; RT.infBreath = 0; RT.holdStacks = 0; RT.oneShot = 0;
    RT.panel = null; RT.mapOpen = false; RT.prompt = null;
    RT.root.querySelectorAll('.nn-panel').forEach(function (p) { p.hidden = true; });
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
function stanzaKeys() { return ['1', '2', '3']; }   // E is interact, in every scheme
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
        toasts: [], panel: null, devTab: 'WORLD', devOpen: false,
        god: 0, infBreath: 0, holdStacks: 0, oneShot: 0,
        dbgStacks: 0, dbgAI: 0, dbgHit: 0, dbgPerf: 0,
        fps: 0, _fc: 0, _ft: 0, ac: null, tookHit: false,
        combat: { cuts: [], rep: null, encI: 0, lull: 0 },
        items: { freeSlant: 0, tack: 0, atShop: false },
        world: { cam: { x: 0, y: 0 }, npc: {}, seenLine: null }
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
            spawn: function (k, x, y, mod) { return spawnFoe(k, x == null ? GRID / 2 : x, y == null ? GRID / 2 - 3 : y, mod); },
            wave: function (n) { return spawnWave(encounterFor(RT.place, n == null ? RT.wave : n), RT.px, RT.py); },
            reprise: function () { doReprise(); },
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
        if (e.button === 2) { RT.mouse.rdown = true; doAnswer(); }
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
        var sk = stanzaKeys();
        if (k === 'e') doInteract();
        else if (k === sk[0]) doStanza(1);
        else if (k === sk[1]) doStanza(2);
        else if (k === sk[2]) doStanza(3);
        else if (k === 'r') doVerse();
        else if (k === ' ') doDash();
        else if (k === 'm') { if (!RT.dialog) RT.mapOpen = !RT.mapOpen; }
        else if (k === 'b') panel('book');
        else if (k === 'c') panel('kit');
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
    if (f.def.deaf && c.fam !== 'ill') typo(f.x, f.y, 'deaf', '#6a5f72', 0.4, 8, 'drift');
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
function doAnswer() {
    if (!RT || RT.dead || RT.devOpen || RT.dialog || RT.mapOpen) return;
    if (RT.winded > 0) { hudNudge('breath'); return; }
    if (RT.answerCd > 0) return;
    var st = stats();
    if (!spendBreath(st.answerCost)) { hudNudge('breath'); return; }
    RT.answerCd = 0.34;
    RT.casting = { t: 0.22, max: 0.22 };
    var fam = answerFam(), word = S.answer.toUpperCase();
    RT.lastWord = word; RT.lastFam = fam;          // the Reprise says the last thing you said
    var live = RT.foes.filter(function (f) { return !f.dead && f.stacks.length; });
    var totalMatched = 0, hitFoes = 0, best = 0, anySlant = false;

    live.forEach(function (f) {
        var match = 0, other = 0;
        f.stacks.forEach(function (s) { if (s.fam === fam) match++; else other++; });
        if (!match && !other) return;
        var closed = match > 0;
        var n = closed ? match : other;
        var dmg = (st.answerBase + st.answerPerStack * n) * famDmgMul(fam);
        // soft wax holds a mismatched pair together: a slant lands in full
        if (!closed) { dmg *= (RT.items.freeSlant > 0 ? 1 : st.slantMul); anySlant = true; }
        dmg *= deafMul(f, fam);          // the deaf hear nothing: only -ill touches them
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
/* Registered from combatBoot() at the foot of the file, not here: KEYS and
   RESETS are `var`s declared further down, so a module-scope call up here
   runs before they exist and takes the whole script out with it. */
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
    if (!RT || RT.dead || RT.devOpen || RT.dialog || RT.mapOpen) return;
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
    if (!RT || RT.devOpen || RT.dialog || RT.mapOpen) return;
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
            if (Object.keys(FOES).every(function (k) { return S.combat.met[k]; })) ach('allsix');
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
        f.frozen = Math.max(0, f.frozen - dt);
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
var FOE_DRAW = { mouth: drawMouth, thief: drawThief, droner: drawDroner, deaf: drawDeaf, sword: drawSword, chorus: drawChorus };

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
    RT.conceal = Math.max(0, (RT.conceal || 0) - dt);
    stepItems(dt);                                          // job 5: the wax goes cold, the bench closes behind you
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
        : what === 'echo' ? RT.root.querySelector('.nn-echo')
        : what === 'verse' ? RT.root.querySelector('.nn-verse')
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
        // two different refusals: standing in his square and not bothering to
        // walk over is not the same as being somewhere he has never been
        say((place().npcs || []).indexOf('chandler') >= 0
            ? 'He is at his bench, across the square. You would have to walk over.'
            : 'The chandler is not here. He keeps a bench on the square.', 'dim');
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
   walk out of earshot with the bench still on screen and keep buying. */
function stepItems(dt) {
    RT.items.freeSlant = Math.max(0, RT.items.freeSlant - dt);   // the wax goes cold
    if (RT.panel === 'shop' && !chandlerNear()) {
        panel(null);
        say('You have walked away from the bench. He waits.', 'dim');
    }
}
/* his bench is on the square: close enough to talk, or standing on it */
function chandlerNear() {
    if (!RT) return false;
    if (RT.items.atShop) return true;
    var n = NPCS.chandler;
    if (!n || (place().npcs || []).indexOf('chandler') < 0) return false;
    return Math.hypot(n.x - RT.px, n.y - RT.py) < 2.6;
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
    var elsewhere = Object.keys(S.items.lamps).filter(function (p) { return p !== RT.place; });
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
            say('You hand over <b>' + esc(ITEMS[id].n) + '</b>. He does not ask where it came from.', 'good');
            sfx('coin'); fillBag(); RT.root.focus();
        });
    });
}
/* THE CHANDLER — the economy the design doc told me to cut */
function fillShop() {
    var b = RT.root.querySelector('.nn-p-shop .nn-pb');
    RT.root.querySelector('.nn-shop-coin').textContent = '◦ ' + S.coin;
    var html = '<p class="nn-note">He sells wax, wick and small objects out of other people\'s attics. He does not ask what you want them for.</p>';
    html += '<h4>CHARMS <i>· wear two</i></h4>';
    CHARM_IDS.forEach(function (id) {
        var c = CHARMS[id], owned = !!S.charms[id];
        // an owned charm with nothing to sell used to vanish from the shop
        // permanently, which left the late-game shop as one "sell the hilt"
        // row under an always-rendered empty WORDS header
        html += '<div class="nn-buy' + (owned ? ' got' : '') + '"><div><b>' + esc(c.n) + '</b><i>' + esc(c.d) + '</i></div>' +
            (owned ? (c.sell ? '<button class="nn-mini" data-sell="' + id + '">sell ◦' + c.sell + '</button>' : '<em class="nn-have">yours</em>')
                   : '<button class="nn-mini' + (S.coin < c.cost ? ' poor' : '') + '" data-buy="' + id + '">◦' + c.cost + '</button>') + '</div>';
    });
    // Stock, and the word market. He does not sell words: he sells the
    // things people wrote them on, and reading one is how you learn it.
    html += '<h4>OFF THE BENCH <i>· wax, wick and small objects</i></h4>';
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
    if (!writs.length) html += '<p class="nn-note dim">Nothing on the bench you can read. He shrugs. Open another family and come back.</p>';
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
        floor: 'town', calm: 1, script: 'wick', w: 17, h: 15, night: 1,
        props: [
            { t: 'house', b: [0, 0, 4, 3.4] }, { t: 'house', b: [5.2, 0, 3.6, 2.8] }, { t: 'house', b: [13, 0, 4, 3.6] },
            { t: 'house', b: [0, 11.6, 4.2, 3.4] }, { t: 'house', b: [13.4, 11, 3.6, 4] },
            { t: 'stagewip', b: [6.4, 3.6, 4.6, 2.6] },
            { t: 'well', b: [8, 9.4, 1.6, 1.6] },
            { t: 'cart', b: [3.4, 8.2, 2.2, 1.2] },
            { t: 'lamp', b: [11.8, 7.6, 0.5, 0.5] }, { t: 'lamp', b: [4.6, 5.2, 0.5, 0.5] }
        ],
        npcs: ['bern', 'child', 'widow', 'chandler'],
        looks: [
            { x: 12.4, y: 8.2, n: 'A lamp on a sill', d: 'Set out on the ninth night for the man who walked out past the fence. Every house on the square has one. Nobody has ever set out a second.' },
            { x: 7.2, y: 6.6, n: 'The playbill', d: 'THE NINTH NIGHT. A true account. The same four hundredth time.\n\nUnder the cast list somebody has pencilled your name, and then gone over it twice, harder.' }
        ],
        exits: [
            { x: 8.5, y: 14.3, w: 3, to: 'lane', n: 'the lane, north' },
            { x: 2.1, y: 3.6, w: 1.6, to: 'bernhouse', n: 'Bern\'s door' },
            { x: 15, y: 3.8, w: 1.6, to: 'chandler', n: 'the chandler\'s shop' }
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
    /* The chandler. He was a panel header, a tooltip, a comment and one
       line of sell flavour. He keeps a bench on the square, and the shop
       opens because you are standing in front of him. */
    chandler: {
        n: 'The chandler', x: 4.6, y: 5.4, col: ['#4a3a2a', '#6a5238', '#d8b48c'], hat: 1,
        talk: function () {
            S.heard.chandler = 1; sSave();
            if (!S.seen.chandler1) {
                S.seen.chandler1 = 1;
                return [['The chandler', 'Wax, wick, and whatever comes out of other people\'s attics.'],
                        ['You', 'Do you sell words?'],
                        ['The chandler', 'I sell what they were written on. The word comes free with the object. That is not the same as selling words.'],
                        ['You', 'Who writes them down?'],
                        ['The chandler', 'People who are worried about forgetting.'],
                        ['', 'He turns a cask lid over so you can see the underside, and waits. Press V while you are standing here to look over the bench.']];
            }
            if (hasItem('coal')) {
                return [['The chandler', 'That is a real one.'],
                        ['You', 'How can you tell?'],
                        ['The chandler', 'The prop is painted. That one is burnt. I am not buying it and I would put it away before Bern sees it.'],
                        ['', 'Press V to look over the bench.']];
            }
            return [['The chandler', 'Have a look. I do not ask what you want it for.'],
                    ['', 'Press V while you are standing here.']];
        }
    },
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
        if (S.seen.chorusDown) {                       // it is over; the room is just a room
            say('The loft is quiet. Dust, sacks, and the shape of where a crowd was.', 'dim');
            return;
        }
        say('<b>The grain loft.</b> Something up here is already saying your part.', 'big');
        beat(2.6, function () { say('It strips the rhyme off everything on a pulse. You cannot build slowly here.', 'dim'); });
        beat(4.6, function () { bigLine('THE CHORUS', 'burst between pulses', '#d2c8e1', 2.4); spawnFoe('chorus', 6.5, 6.2); });
    }
};

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
        RT.quietT = 6;                          // sim seconds, like everything else
    }
}
function beat(after, fn) { RT.beats.push({ t: after, fn: fn }); }

/* Anything that must not survive a doorway registers a callback here,
   next to its own code, instead of editing gotoPlace's reset block.
   Five people adding features to one file all want that block; this is
   how they get it without touching the same nine lines. */
var RESETS = [];
function onPlaceChange(fn) { RESETS.push(fn); }

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
    RT.verseCast = 0; RT.recital = null; RT.dilate = 0; RT.timeScale = 1;
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
        if (o.shut) { say(o.e.shut || 'Not that way. Not yet.', 'dim'); return; }
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
var MAP_HIDE = { arena: 1, stage: 1 };
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
    if (q.nmap) RT.mapOpen = true;
    // the shop is gated on standing at the chandler; a capture has no legs
    if (q.npanel === 'shop') RT.items.atShop = true;
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
/* Soft wax goes cold in a doorway and the bench is behind you. The pitch
   stays on your palm until something tries to strip a stack, and the mask
   stays on your face: it lives on the save, not the runtime. */
onPlaceChange(function () {
    if (!RT) return;
    RT.items.freeSlant = 0; RT.items.atShop = false;   // the wax and the bench do not follow you; the mask does
});

window.NINTH = { render: render, init: init, close: close, steamAch: steamAch };
})();
