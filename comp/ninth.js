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
/* Which way a figure faces, given a direction in WORLD space. Every
   figure in the game is mirrored with cx.scale(-1, 1), which is a flip in
   SCREEN x, and screen x is (x - y). Three separate call sites tested
   sign(dx) alone, which is right for three quadrants and backwards for
   the fourth: the two disagree on exactly 25% of directions, and every
   one of them is somebody walking mostly along y, which on screen is
   left or right. The child was drawn walking backwards 44% of the time
   because one of her legs has dx = 0 authored and the sign fell out of
   float noise. One helper now, so the next drawer cannot get it wrong. */
function faceX(dx, dy) { return (dx - dy) >= 0 ? 1 : -1; }
/* Where a FIGURE standing at world (x, y) has its feet on screen.
   buildFloor draws the diamond it calls tile (x,y) with its corners at
   the projections of world (x,y), (x+1,y), (x+1,y+1) and (x,y+1), and
   drawProp takes every footprint corner off isoX/isoY raw. So isoY(x,y)
   with nothing added IS the ground at (x, y), and it is what props and
   the floor already use.
   Every actor, ring, light, particle, prompt and the camera target used
   to add TILE_H/2 on top of that, which is the projection of
   (x+0.5, y+0.5): half a tile south-east of where they collide. It was
   consistent across all seventy call sites, so nothing looked broken,
   but it meant contact and occlusion were half a tile out against the
   only two things that were not doing it. One name for the convention
   now, and one number. */
var ACTOR_DY = 0;
function isoYA(x, y) { return isoY(x, y) + ACTOR_DY; }
function screenToWorld(sx, sy) {
    var c = cam(), pz = (RT && RT.fx) ? fxOf('punch') : null;
    /* The zoom punch scales the whole world about a screen point, so
       the cursor is over a different tile than it was a frame ago.
       Undo it here, before the camera, in the one place that converts
       backwards; the comment above isoX says why there is only one
       place. At z = 1.08 an unpatched cursor at the screen edge is
       wrong by about 40px, which is most of a tile, and RT.face,
       doCall's aim, doDash and click to move all read it. */
    if (pz && pz.z > 1) { sx = pz.ax + (sx - pz.ax) / pz.z; sy = pz.ay + (sy - pz.ay) / pz.z; }
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
    var r = {
        x0: b.w <= VW ? b.x + (b.w - VW) / 2 : b.x,
        x1: b.w <= VW ? b.x + (b.w - VW) / 2 : b.x + b.w - VW,
        y0: b.h <= VH ? b.y + (b.h - VH) / 2 : b.y,
        y1: b.h <= VH ? b.y + (b.h - VH) / 2 : b.y + b.h - VH
    };
    /* On an axis that scrolls, the eye also has to be able to REACH every
       walkable tile. Clamping to the bitmap alone is not the same thing:
       for a long thin place the bitmap's box is mostly empty triangle, so
       on the road the eye ran out of travel after about a third of the
       walk and the player crossed the rest of a static frame, ending up
       99 pixels from the left edge in one corner and 1021 in another.
       Widen by exactly enough to bring the extreme walkable tiles inside
       the dead zone, never more. It shows a little more of the dark
       beyond the ground at the two far corners, and it is the difference
       between walking down a road and watching one slide past. */
    if (b.w > VW) {
        var xa = isoXB(0.5, gh - 0.5), xb = isoXB(gw - 0.5, 0.5);
        r.x0 = Math.min(r.x0, Math.min(xa, xb) - (VW + DEAD_W) / 2);
        r.x1 = Math.max(r.x1, Math.max(xa, xb) - (VW - DEAD_W) / 2);
    }
    if (b.h > VH) {
        r.y0 = Math.min(r.y0, isoYB(0.5, 0.5) + ACTOR_DY - (VH + DEAD_H) / 2);
        r.y1 = Math.max(r.y1, isoYB(gw - 0.5, gh - 0.5) + ACTOR_DY - (VH - DEAD_H) / 2);
    }
    return r;
}
/* Dead zone follow. The camera does not move until you push out of a
   box in the middle of the screen, so walking around a room does not
   swim, and walking down a road does. */
var DEAD_W = 300, DEAD_H = 150;
function camTarget(px, py) {
    var c = cam(), sx = isoXB(px, py) - c.x, sy = isoYB(px, py) + ACTOR_DY - c.y;   // frame the figure where the figure is drawn
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
    dragMul: 0.7,        // what a drag hits for, as a share of one slant of answerBase. FLAT: see doRhyme
    dragAge: 0.35,       // and the share of their remaining life it costs the sounds it pulls
    rhymeCost: 15,       // what closing a rhyme costs. answerCost is its old name
    /* the screen punch. Everything here is multiplied by a kind
       weight, a power curve, a family character and an option level
       before it reaches the frame. */
    punchStop: 0.11,      // seconds of held frame at full power, before FAM_PUNCH.stop
    punchStopCap: 0.17,   // -ill asks for the longest hold in the game and this is where it stops
    punchStopScale: 0.04, // what the sim clock runs at while held. NOT zero: RT.t drives every idle sine in the game
    punchZoom: 0.075,     // extra scale at full power
    punchZoomCap: 0.08,
    punchZoomStep: 0.02,  // the ladder. the nearest neighbour crawl lives here
    punchZoomOut: 0.20,   // seconds from the top rung back to 1
    punchShake: 16,       // shake amplitude at full power
    punchShakeCap: 18,    // 14 was the old ceiling; the clearRect margin allows 60
    punchShakeHz: 22,     // moves all five FAM_PUNCH rates together. 22 leaves them where they are
    punchChroma: 0.85,    // RT.chroma written at full power
    punchSplit: 5,        // pixels of letter split per unit of RT.chroma
    punchBloom: 0.55,     // RT.flash written at full power
    /* the rhyme landing. Every one of these is read ONCE, at the
       keypress, and frozen onto the detonation record: dragging a
       slider cannot deform a detonation that is already in the air. */
    detFly: 0.06,        // seconds from the press to the line, before power
    detHold: 0.10,       // how long the line sits there being the loudest thing on screen
    detOut: 0.18,        // how long it takes to go
    detWord: 21,         // base word size before power. The fit rule claws it back
    detRuleOver: 3,      // pixels of rule overhang per syllable, capped at 190
    detFlyMax: 32,       // board-wide ceiling on flying syllables. 0 is a supported look
    detSpread: 0.22,     // how long all the sources take to go off, at any width
    detSnap: 1,          // the dust the snap throws. 0 leaves the bracket and nothing else
    detHalo: 0.30,       // how lit the words are while they arrive
    pipWarn: 1.0,        // seconds of stack life left when the row starts shouting
    /* the five families. One number each for the things an artist
       actually reaches for, plus three shared ones at the tail.
       arkRim was promoted to vfxRimGround and vfxRimBody: "the rims
       assume a 50-66% dim" is true of every family, and it is two
       different numbers at two different depths, always. */
    eatBites: 1,         // notch scale. 0 is reachable: the family becomes typography and holes
    eatMatter: 1,        // crumb count
    eatFed: 1,           // how lit you get when you eat
    ightShadow: 1,       // cast-shadow length. 0 removes the family's primary readout, deliberately
    ightSpoke: 1,        // spoke length and edge alpha
    ightDark: 1,         // the pre-darken, on top of the punch option level
    erdClap: 0.075,      // the close, before best
    erdReach: 40,        // bar start distance px, before best
    erdGag: 4,           // band height px
    erdRule: 0.5,        // ground-rule half-width per unit of best
    erdChips: 3,         // chips per syllable
    arkStain: 1,         // ground stain alpha and life
    arkCreep: 1,         // how fast the waterline climbs on the tick
    arkCloak: 1,         // the conceal rim and the hood
    arkKeep: 24,         // how many permanent outlines a room keeps
    illFreeze: 1,        // rime coat alphas
    illExecHold: 0.12,   // the execute hold, 0.04 to 0.40. NOT illHold: that name belonged to a deleted field
    illShard: 6,         // shard cell px at one execute
    illResidue: 1,       // motes per second, board-wide
    vfxRimGround: 1,     // every family's 1px edge on a ground shape
    vfxRimBody: 1,       // every family's 1px edge over a lit sprite
    vfxStatus: 1         // all five status layers at once, for a low-spec look
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
    chalk:  { n: 'Rehearsal Chalk', cost: 45, d: 'For marking where to stand. Your drag hits 60% harder, and a slant that does not drag keeps 80% of its damage instead of half.',
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
        d: 'Off the chandler\'s counter. Warm it in your hand and a mismatched pair holds for a while: any sound you answer takes the whole pile with it, at full strength.',
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
    /* 0 off, 1 light, 2 full, 3 too much. A level rather than a
       boolean because "no hitstop but keep the colour" is a real
       preference and a switch cannot express it. Shake keeps its own
       toggle above. */
    if (S.opts.punch == null) S.opts.punch = 2;
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
    /* Where you put it, not just that you did. This used to be a bare 1,
       and nothing outside the bag panel ever read it: no prop, no sprite,
       no light. In a game named after a lamp on a sill you could set one
       down on the marker stone, be told it burns exactly as well out here
       as it does on a sill, and watch the stone not change at all. An
       array is still truthy, so lampsElsewhere, takeLamp and fillBag are
       untouched; lampAt() below handles a 1 from an older save. */
    S.items.lamps[here] = [+RT.px.toFixed(2), +RT.py.toFixed(2)]; sSave();
    if (here === 'mark') {
        // past the fence. Nobody has ever set out a second lamp, and
        // nobody has ever set one out here.
        return 'You set it down on the marker stone, out past the fence, for somebody the town does not set lamps out for. It burns exactly as well here as it does on a sill.';
    }
    if (here === 'square') return 'You set it on a sill with all the others. It looks like all the others.';
    return 'You set the lamp down. It throws about a yard of light and the rest of it stays dark.';
}
/* The lamp itself, standing on the ground where you put it. Same rows the
   widow carries, so it is recognisably the same object in her hand and on
   your sill, and it gets the shadow every other solid thing has. */
var LAMP_PAL = null;
function drawSetLamp(cx, at) {
    var sx = isoX(at.x, at.y), sy = isoYA(at.x, at.y);
    if (sx < -40 || sx > VW + 40 || sy < -40 || sy > VH + 40) return;
    if (!LAMP_PAL) LAMP_PAL = pxPal('#2e2a26', '#c9a94a', '#d8b48c', '#241c26');
    cx.save();
    cx.fillStyle = 'rgba(0,0,0,.4)';
    cx.beginPath(); cx.ellipse(sx, sy, 7, 3, 0, 0, TAU); cx.fill();
    blit(cx, bake('prop.lamp.set', PROP_LAMP, LAMP_PAL), sx, sy);
    // the flame itself, which is the one part that must not be a still frame
    var f = 0.72 + Math.sin(RT.t * 7.3 + at.x) * 0.14;
    cx.globalCompositeOperation = 'lighter';
    var g = cx.createRadialGradient(sx, sy - 9, 1, sx, sy - 9, 22);
    g.addColorStop(0, 'rgba(255,206,120,' + (0.34 * f).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,190,90,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(sx, sy - 9, 22, 0, TAU); cx.fill();
    cx.restore();
}
/* Where the lamp you left in this place is standing, or null. A save
   written before lamps had positions stored a bare 1: put that one in the
   middle of the floor rather than dropping it, so an old save still sees
   the thing it left behind. */
function lampAt(id) {
    var v = S.items.lamps[id];
    if (!v) return null;
    if (v === 1 || !v.length) return { x: (PLACES[id].w || GRID) / 2, y: (PLACES[id].h || GRID) / 2 };
    return { x: v[0], y: v[1] };
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
            /* The player's health had no readout at all: the only thing that
               ever said you were being hurt was a red wash over the whole
               canvas, and the only thing that said how close you were to the
               floor was nothing. Same three elements as the breath gauge so
               the pair reads as one instrument. */
            '<div class="nn-life"><i></i><em></em><span class="nn-life-t"></span></div>' +
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
          // Escape does not exist on a touchscreen. wireHud's [data-nn] loop
          // falls through every branch to root.focus(), so an unrecognised
          // value costs nothing there; wireWings attaches the real listener.
          '<button class="nn-b nn-b-wings" data-nn="wings" type="button" title="The wings (Escape)">ESC</button>' +
        '</div>' +
        '<div class="nn-tip" hidden></div>' +

        // THE WINGS. Last in the DOM, so it is over everything without
        // having to out-bid anybody for a z-index.
        '<div class="nn-wings" hidden>' +
          '<div class="nn-wings-veil"></div>' +
          '<div class="nn-wings-book">' +
            '<header><b class="nn-wings-t">THE WINGS</b><i class="nn-wings-where"></i><span class="nn-wings-cue"></span></header>' +
            '<div class="nn-wings-mood"></div>' +
            '<div class="nn-wings-join"><i></i><b></b><em></em></div>' +
            '<div class="nn-wings-pg"></div>' +
            '<div class="nn-wings-foot"></div>' +
          '</div>' +
        '</div>' +
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
      { k: 'num', t: 'Drag damage (x answer base, flat)', get: function () { return T('dragMul'); }, set: function (v) { S.tune.dragMul = clamp(v, 0, 2); }, step: 0.05, fix: 2 },
      { k: 'num', t: 'Drag ages what it moves (share of life)', get: function () { return T('dragAge'); }, set: function (v) { S.tune.dragAge = clamp(v, 0, 0.95); }, step: 0.05, fix: 2 },
      { k: 'num', t: 'Echo per stack', get: function () { return T('echoPerStack'); }, set: function (v) { S.tune.echoPerStack = clamp(v, 0, 50); }, step: 1 },
      { k: 'num', t: 'Echo decay / s', get: function () { return T('echoDecay'); }, set: function (v) { S.tune.echoDecay = clamp(v, 0, 40); }, step: 0.5, fix: 1 },
      { k: 'num', t: 'Call range', get: function () { return T('callRange'); }, set: function (v) { S.tune.callRange = clamp(v, 1, 30); }, step: 0.5, fix: 1 },
      { k: 'num', t: 'Echo lost per sour stack', get: function () { return T('echoBreak'); }, set: function (v) { S.tune.echoBreak = clamp(v, 0, 50); }, step: 1 },
      { k: 'num', t: 'Stanza dilation length (s)', get: function () { return T('dilationT'); }, set: function (v) { S.tune.dilationT = clamp(v, 0.2, 6); }, step: 0.1, fix: 1 },
      /* vfx: the forty-five keys of the magic overhaul, one row each, under a
         note divider per block. The tab already had two dividers and forty-five
         more rows without them is a wall. Everything here appends: the reset
         button below is the one row that must stay last. */
      { k: 'note', t: 'How it hits.' },
      { k: 'num', t: 'Hitstop at full power (s)', sub: 'each family multiplies this: -ill 1.5x, -erd 0.45x', get: function () { return T('punchStop'); }, set: function (v) { S.tune.punchStop = clamp(v, 0, 0.4); }, step: 0.01, fix: 3 },
      { k: 'num', t: 'Hitstop cap (s)', get: function () { return T('punchStopCap'); }, set: function (v) { S.tune.punchStopCap = clamp(v, 0, 0.5); }, step: 0.01, fix: 3 },
      { k: 'num', t: 'Sim clock while held', sub: 'never 0: RT.t drives every idle sine in the game', get: function () { return T('punchStopScale'); }, set: function (v) { S.tune.punchStopScale = clamp(v, 0.01, 1); }, step: 0.01, fix: 2 },
      { k: 'num', t: 'Zoom at full power', get: function () { return T('punchZoom'); }, set: function (v) { S.tune.punchZoom = clamp(v, 0, 0.3); }, step: 0.005, fix: 3 },
      { k: 'num', t: 'Zoom cap', sub: 'also the release rate: cap per release seconds', get: function () { return T('punchZoomCap'); }, set: function (v) { S.tune.punchZoomCap = clamp(v, 0, 0.3); }, step: 0.005, fix: 3 },
      { k: 'num', t: 'Zoom ladder step', sub: 'the pixel crawl lives here. bigger is chunkier and calmer. z is clamped at 1.12 whatever this says', get: function () { return T('punchZoomStep'); }, set: function (v) { S.tune.punchZoomStep = clamp(v, 0.005, 0.08); }, step: 0.005, fix: 3 },
      { k: 'num', t: 'Zoom release (s)', get: function () { return T('punchZoomOut'); }, set: function (v) { S.tune.punchZoomOut = clamp(v, 0.02, 1.5); }, step: 0.02, fix: 2 },
      { k: 'num', t: 'Shake at full power', sub: '9 puts a full close back where every slam used to be', get: function () { return T('punchShake'); }, set: function (v) { S.tune.punchShake = clamp(v, 0, 40); }, step: 1 },
      { k: 'num', t: 'Shake cap', sub: 'the clearRect margin gives out at 60', get: function () { return T('punchShakeCap'); }, set: function (v) { S.tune.punchShakeCap = clamp(v, 0, 60); }, step: 1 },
      { k: 'num', t: 'Shake frequency (hz)', sub: 'moves all five families together. low is a lurch, high is a rattle', get: function () { return T('punchShakeHz'); }, set: function (v) { S.tune.punchShakeHz = clamp(v, 4, 60); }, step: 1 },
      { k: 'num', t: 'Letter split at full power', get: function () { return T('punchChroma'); }, set: function (v) { S.tune.punchChroma = clamp(v, 0, 2); }, step: 0.05, fix: 2 },
      { k: 'num', t: 'Letter split pixels per unit', sub: 'past about 8 the word stops being one word', get: function () { return T('punchSplit'); }, set: function (v) { S.tune.punchSplit = clamp(v, 0, 20); }, step: 1 },
      { k: 'num', t: 'Bloom at full power', get: function () { return T('punchBloom'); }, set: function (v) { S.tune.punchBloom = clamp(v, 0, 1); }, step: 0.05, fix: 2 },
      { k: 'note', t: 'The rhyme landing. Timings are frozen at the keypress.' },
      { k: 'num', t: 'Rhyme flight (s)', sub: 'below 0.05 the gather is a smear and the syllables never read as leaving bodies', get: function () { return T('detFly'); }, set: function (v) { S.tune.detFly = clamp(v, 0.03, 0.4); }, step: 0.01, fix: 2 },
      { k: 'num', t: 'Rhyme line holds (s)', get: function () { return T('detHold'); }, set: function (v) { S.tune.detHold = clamp(v, 0, 0.5); }, step: 0.01, fix: 2 },
      { k: 'num', t: 'Rhyme line leaves (s)', get: function () { return T('detOut'); }, set: function (v) { S.tune.detOut = clamp(v, 0.05, 0.8); }, step: 0.02, fix: 2 },
      { k: 'num', t: 'Rhyme word size (px)', sub: 'the fit rule claws it back, so this mostly lifts SMALL closes', get: function () { return T('detWord'); }, set: function (v) { S.tune.detWord = clamp(Math.round(v), 12, 40); }, step: 1 },
      { k: 'num', t: 'Rule overhang per syllable (px)', sub: 'the one unbounded readout of the pile. At 0 a twelve stack close draws a one stack rule', get: function () { return T('detRuleOver'); }, set: function (v) { S.tune.detRuleOver = clamp(v, 0, 12); }, step: 0.5, fix: 1 },
      { k: 'num', t: 'Flying syllables, board cap', sub: '0 is a real look: pure typography, the rule only arrives on the strike', get: function () { return T('detFlyMax'); }, set: function (v) { S.tune.detFlyMax = clamp(Math.round(v), 0, 96); }, step: 4 },
      { k: 'num', t: 'Sources spread over (s)', sub: 'what keeps twenty-five people reading as one event', get: function () { return T('detSpread'); }, set: function (v) { S.tune.detSpread = clamp(v, 0.05, 0.6); }, step: 0.02, fix: 2 },
      { k: 'num', t: 'Snap dust x', get: function () { return T('detSnap'); }, set: function (v) { S.tune.detSnap = clamp(v, 0, 2); }, step: 0.1, fix: 1 },
      { k: 'num', t: 'Rhyme halo', sub: 'past about 0.6 the rim fills the counters of the letters', get: function () { return T('detHalo'); }, set: function (v) { S.tune.detHalo = clamp(v, 0, 0.8); }, step: 0.05, fix: 2 },
      { k: 'num', t: 'Stack alarm at (s left)', get: function () { return T('pipWarn'); }, set: function (v) { S.tune.pipWarn = clamp(v, 0, 3); }, step: 0.1, fix: 1 },
      { k: 'note', t: '-eat: hunger. It eats its way there and it takes something with it.' },
      { k: 'num', t: '-eat bite size x', sub: '0 is a real look: the family becomes typography and holes', get: function () { return T('eatBites'); }, set: function (v) { S.tune.eatBites = clamp(v, 0, 2); }, step: 0.1, fix: 2 },
      { k: 'num', t: '-eat matter (crumb counts x)', get: function () { return T('eatMatter'); }, set: function (v) { S.tune.eatMatter = clamp(v, 0, 2); }, step: 0.1, fix: 2 },
      { k: 'num', t: '-eat how lit you get when you eat', get: function () { return T('eatFed'); }, set: function (v) { S.tune.eatFed = clamp(v, 0, 2); }, step: 0.1, fix: 2 },
      { k: 'note', t: '-ight: reveal. The only family that changes what you can see.' },
      { k: 'num', t: '-ight shadow length x', sub: '0 removes the family primary readout, deliberately', get: function () { return T('ightShadow'); }, set: function (v) { S.tune.ightShadow = clamp(v, 0, 3); }, step: 0.1, fix: 2 },
      { k: 'num', t: '-ight spoke length and edge', get: function () { return T('ightSpoke'); }, set: function (v) { S.tune.ightSpoke = clamp(v, 0, 2); }, step: 0.1, fix: 2 },
      { k: 'num', t: '-ight pre-darken x', sub: 'on top of the screen punch level. 0 and the flash has nothing to come out of', get: function () { return T('ightDark'); }, set: function (v) { S.tune.ightDark = clamp(v, 0, 2); }, step: 0.1, fix: 2 },
      { k: 'note', t: '-erd: command. The family that is over before you expect it.' },
      { k: 'num', t: '-erd bars close (s)', get: function () { return T('erdClap'); }, set: function (v) { S.tune.erdClap = clamp(v, 0.02, 0.3); }, step: 0.005, fix: 3 },
      { k: 'num', t: '-erd bars start out (px)', get: function () { return T('erdReach'); }, set: function (v) { S.tune.erdReach = clamp(v, 8, 200); }, step: 4 },
      { k: 'num', t: '-erd silence band (px)', get: function () { return T('erdGag'); }, set: function (v) { S.tune.erdGag = clamp(Math.round(v), 0, 14); }, step: 1 },
      { k: 'num', t: '-erd ground rule per stack (tiles)', get: function () { return T('erdRule'); }, set: function (v) { S.tune.erdRule = clamp(v, 0, 2); }, step: 0.05, fix: 2 },
      { k: 'num', t: '-erd chips per stack', get: function () { return T('erdChips'); }, set: function (v) { S.tune.erdChips = clamp(Math.round(v), 0, 8); }, step: 1 },
      { k: 'note', t: '-ark: shadow. It takes the light away and it leaves a mark.' },
      { k: 'num', t: '-ark ground stain x', sub: 'alpha and life together', get: function () { return T('arkStain'); }, set: function (v) { S.tune.arkStain = clamp(v, 0, 2); }, step: 0.1, fix: 2 },
      { k: 'num', t: '-ark waterline climb x', get: function () { return T('arkCreep'); }, set: function (v) { S.tune.arkCreep = clamp(v, 0, 3); }, step: 0.1, fix: 2 },
      { k: 'num', t: '-ark conceal rim and hood x', get: function () { return T('arkCloak'); }, set: function (v) { S.tune.arkCloak = clamp(v, 0, 2); }, step: 0.1, fix: 2 },
      { k: 'num', t: '-ark outlines a room keeps', sub: 'the permanent ones. 0 and nothing you did is still there when you come back', get: function () { return T('arkKeep'); }, set: function (v) { S.tune.arkKeep = clamp(Math.round(v), 0, 96); }, step: 4 },
      { k: 'note', t: '-ill: still. The longest hold in the game, and the only one that stops a body.' },
      { k: 'num', t: '-ill rime coat x', get: function () { return T('illFreeze'); }, set: function (v) { S.tune.illFreeze = clamp(v, 0, 2); }, step: 0.1, fix: 2 },
      { k: 'num', t: '-ill execute hold (s)', get: function () { return T('illExecHold'); }, set: function (v) { S.tune.illExecHold = clamp(v, 0.04, 0.4); }, step: 0.01, fix: 2 },
      { k: 'num', t: '-ill shard cell at one execute (px)', get: function () { return T('illShard'); }, set: function (v) { S.tune.illShard = clamp(Math.round(v), 2, 16); }, step: 1 },
      { k: 'num', t: '-ill residue (motes / s, board-wide)', get: function () { return T('illResidue'); }, set: function (v) { S.tune.illResidue = clamp(v, 0, 3); }, step: 0.1, fix: 2 },
      { k: 'note', t: 'Shared by all five. The low-spec knobs.' },
      { k: 'num', t: 'Rim on a ground shape', sub: 'the 1px edge every family draws on the floor', get: function () { return T('vfxRimGround'); }, set: function (v) { S.tune.vfxRimGround = clamp(v, 0, 2); }, step: 0.1, fix: 2 },
      { k: 'num', t: 'Rim over a lit sprite', sub: 'the same edge at body depth, which is never the same number', get: function () { return T('vfxRimBody'); }, set: function (v) { S.tune.vfxRimBody = clamp(v, 0, 2); }, step: 0.1, fix: 2 },
      { k: 'num', t: 'All five status layers', sub: '0 turns every family status off at once and leaves the pips saying what is on', get: function () { return T('vfxStatus'); }, set: function (v) { S.tune.vfxStatus = clamp(v, 0, 2); }, step: 0.1, fix: 2 },
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
      /* A level, not a switch. Turning it down does not turn events
         off: the same punch() runs with smaller numbers, so nothing
         anywhere else in the file grows a branch. fillDev rebuilds the
         rows after every action, so the name follows the number. */
      { k: 'num', t: 'Screen punch. Hitstop, zoom, split, bloom: ' + PUNCH_LV_N[punchLvI()],
        sub: 'off / light / full / too much',
        get: function () { return punchLvI(); },
        set: function (v) { S.opts.punch = clamp(Math.round(v), 0, 3); sSave(); }, step: 1 },
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
/* Seven, not five: a floor is the one thing that cannot be faked for a
   frame while it builds, and five meant the ordinary loop through Wick
   — square, house, shop, lane, mill, loft — evicted the square before
   you walked back into it and paid for it again every time. */
/* Floors are capped in BYTES, not in entries, because they are not the
   same size as each other: room11x9 is 1.21 MB and road11x34 is 4.43,
   a 3.7x spread, and seven entries was anywhere from 11.4 MB to 17.9
   depending on which seven. The sprite cache next door has been byte
   capped from the start for exactly this reason.
   FLOOR_MIN keeps the reason the 7 was picked: the ordinary loop through
   Wick is town17x15, room11x9, room12x9, mill13x17, mill15x13, loft13x13,
   which is 11.08 MB and six entries, and it must never evict the square
   before you walk back into it. */
var FLOORS = {}, FLOOR_LRU = [], FLOOR_MIN = 7, FLOOR_BUDGET = 13 << 20, FLOOR_BYTES = 0;
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
/* ── what each ground is actually made of ──
   These run once per place into a cached bitmap, so they can afford to
   place four thousand cobbles one at a time. Everything is positioned in
   TILE space and converted, so detail sits where it is in the world and
   does not visibly repeat with the tile grid. */
function blob(g, x, y, rx, ry, col) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill(); }
/* A cobbled square is about thirteen thousand of those, and thirteen
   thousand draw calls is most of what it cost to walk into Wick. Same
   colour goes down in one path. It needs the shade quantised to a fixed
   number of steps to be worth anything, which is what pixel art wants
   in the first place: a palette, not a continuum. */
function blobBatch(g) {
    var by = {};
    return {
        add: function (x, y, rx, ry, col) { (by[col] || (by[col] = [])).push(x, y, rx, ry); },
        flush: function () {
            Object.keys(by).forEach(function (col) {
                var a = by[col];
                g.beginPath();
                for (var i = 0; i < a.length; i += 4) {
                    g.moveTo(a[i] + a[i + 2], a[i + 1]);        // start a subpath, or they chain together
                    g.ellipse(a[i], a[i + 1], a[i + 2], a[i + 3], 0, 0, TAU);
                }
                g.fillStyle = col; g.fill();
            });
            by = {};
        }
    };
}
function lattice(f, step, jit, fn) {                        // a jittered grid in tile space
    for (var v = -0.5; v < f.gh + 0.5; v += step)
        for (var u = -0.5; u < f.gw + 0.5; u += step) {
            var uu = u + (f.fr() - 0.5) * jit, vv = v + (f.fr() - 0.5) * jit;
            fn(uu, vv, f.px(uu, vv), f.py(uu, vv));
        }
}
var GROUND = {};
GROUND.town = function (g, f) {                             // cobbles, and the mud where the cobbles went
    var fr = f.fr;
    var joints = blobBatch(g), stones = blobBatch(g), tops = blobBatch(g);
    lattice(f, 0.3, 0.2, function (u, v, x, y) {
        var d = Math.hypot(u - f.gw / 2, v - f.gh / 2);
        if (fr() < 0.1 + d * 0.012) return;                 // worn through to earth, more so at the edges
        var rx = 3.4 + fr() * 2.6, ry = rx * 0.52;
        joints.add(x, y + 1.5, rx + 0.6, ry + 0.6, 'rgba(8,6,12,.45)');    // the joint
        var k = 0.82 + fr() * 0.44;
        stones.add(x, y, rx, ry, shadeHex(f.pal[2], k));
        tops.add(x - rx * 0.2, y - ry * 0.28, rx * 0.5, ry * 0.42, shadeHex(f.pal[2], k * 1.22));
    });
    joints.flush(); stones.flush(); tops.flush();           // joints under every stone, then every lit face
    for (var m = 0; m < 90; m++) {                          // mud pushed up between the stones
        var u2 = fr() * f.gw, v2 = fr() * f.gh;
        blob(g, f.px(u2, v2), f.py(u2, v2), 6 + fr() * 12, 3 + fr() * 6, 'rgba(34,28,20,.3)');
    }
    for (var p = 0; p < 7; p++) {                           // standing water, because the drains gave up
        var u3 = 1 + fr() * (f.gw - 2), v3 = 1 + fr() * (f.gh - 2);
        var x3 = f.px(u3, v3), y3 = f.py(u3, v3), pr = 9 + fr() * 14;
        blob(g, x3, y3, pr, pr * 0.5, 'rgba(10,10,18,.55)');
        blob(g, x3 - pr * 0.2, y3 - pr * 0.12, pr * 0.5, pr * 0.2, 'rgba(90,104,130,.14)');
    }
    for (var s = 0; s < 130; s++) {                         // straw and muck, trodden in
        var u4 = fr() * f.gw, v4 = fr() * f.gh;
        var a = fr() * TAU, l = 2 + fr() * 5;
        g.strokeStyle = fr() < 0.5 ? 'rgba(122,108,72,.3)' : 'rgba(60,52,36,.35)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(f.px(u4, v4), f.py(u4, v4));
        g.lineTo(f.px(u4, v4) + Math.cos(a) * l, f.py(u4, v4) + Math.sin(a) * l * 0.55); g.stroke();
    }
};
GROUND.road = function (g, f) {                             // packed dirt, and the ruts stop before the end
    var fr = f.fr;
    for (var i = 0; i < 900; i++) {                         // grit
        var u = fr() * f.gw, v = fr() * f.gh;
        blob(g, f.px(u, v), f.py(u, v), 1 + fr() * 2.2, 0.7 + fr() * 1.2, fr() < 0.5 ? 'rgba(96,88,72,.3)' : 'rgba(20,17,13,.4)');
    }
    /* The fence ends at v = gh*0.66, two posts and nothing between them.
       The cart ruts end there too. They break into dashes for the last
       couple of tiles and then simply stop, and the ground north of the
       posts has never had a wheel on it, because nobody has ever had a
       reason to take a cart past the end of the fence. */
    var fence = f.gh * 0.66;
    [0.34, 0.63].forEach(function (q) {
        for (var v2 = f.gh; v2 > fence - 0.6; v2 -= 0.12) {
            var give = clamp((v2 - fence) / 2.2, 0, 1);     // the last two tiles come apart
            if (give < 1 && fr() > 0.25 + give * 0.75) continue;
            var u2 = f.gw * q + Math.sin(v2 * 0.4) * 0.22;
            var x = f.px(u2, v2), y = f.py(u2, v2);
            blob(g, x, y, 7, 3.4, 'rgba(12,10,8,.3)');
            blob(g, x - 1, y - 1, 4, 1.8, 'rgba(70,62,48,.12)');
        }
    });
    // and a clean strip straight through the gap, never trodden
    for (var cu = 0; cu < f.gw; cu += 0.25) {
        blob(g, f.px(cu, fence - 0.2), f.py(cu, fence - 0.2), 9, 3, 'rgba(120,110,92,.05)');
    }
    /* The green gives out as you go north. Living weeds this side of the
       fence, dead stubs for a while after it, and then nothing at all. */
    for (var t = 0; t < 320; t++) {
        var u3 = fr() * f.gw, v3 = fr() * f.gh;
        var edge = Math.min(u3, f.gw - u3);
        if (edge > 2.2 && fr() < 0.85) continue;
        if (v3 < f.gh * 0.24) continue;                     // nothing grows near the hollow
        var dead = v3 < fence;
        var x2 = f.px(u3, v3), y2 = f.py(u3, v3);
        if (dead) {
            g.strokeStyle = 'rgba(96,92,80,.4)'; g.lineWidth = 1;
            g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 + (fr() - 0.5) * 3, y2 - 2 - fr() * 3); g.stroke();
        } else {
            g.strokeStyle = fr() < 0.4 ? 'rgba(74,86,54,.5)' : 'rgba(52,58,38,.5)'; g.lineWidth = 1;
            for (var b = 0; b < 3; b++) {
                g.beginPath(); g.moveTo(x2, y2);
                g.lineTo(x2 + (fr() - 0.5) * 7, y2 - 3 - fr() * 5); g.stroke();
            }
        }
    }
    for (var s2 = 0; s2 < 26; s2++) {                       // stones the frost pushed up
        var u4 = fr() * f.gw, v4 = fr() * f.gh;
        blob(g, f.px(u4, v4), f.py(u4, v4), 2.5 + fr() * 3, 1.4 + fr() * 1.6, 'rgba(96,92,86,.35)');
    }
};
GROUND.mill = function (g, f) {                             // trampled earth, and the only grain left in Wick
    var fr = f.fr;
    for (var i = 0; i < 420; i++) {
        var u = fr() * f.gw, v = fr() * f.gh;
        blob(g, f.px(u, v), f.py(u, v), 3 + fr() * 9, 1.6 + fr() * 4, fr() < 0.5 ? 'rgba(72,60,44,.25)' : 'rgba(22,18,14,.3)');
    }
    for (var c = 0; c < 340; c++) {                         // chaff, blown into drifts against nothing
        var u2 = fr() * f.gw, v2 = fr() * f.gh;
        var x = f.px(u2, v2), y = f.py(u2, v2);
        g.fillStyle = 'rgba(206,186,132,' + (0.14 + fr() * 0.26).toFixed(3) + ')';
        g.fillRect(Math.round(x), Math.round(y), 1 + (fr() < 0.3 ? 1 : 0), 1);
    }
    for (var p = 0; p < 5; p++) {                           // a path worn between the door and the road
        var v3 = p / 5 * f.gh;
        blob(g, f.px(f.gw / 2, v3), f.py(f.gw / 2, v3), 30, 14, 'rgba(96,82,60,.1)');
    }
};
GROUND.loft = function (g, f) {                             // boards, gaps, and grain dust in every one
    var fr = f.fr;
    for (var v = 0; v < f.gh; v += 0.5) {
        var y0 = f.py(0, v), y1 = f.py(f.gw, v);
        g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(f.px(0, v), y0); g.lineTo(f.px(f.gw, v), y1); g.stroke();
        g.strokeStyle = 'rgba(84,66,46,' + (0.1 + fr() * 0.16).toFixed(3) + ')'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(f.px(0, v + 0.06), f.py(0, v + 0.06)); g.lineTo(f.px(f.gw, v + 0.06), f.py(f.gw, v + 0.06)); g.stroke();
        if (fr() < 0.3) {                                   // a board that has sprung, and the dark under it
            var u = fr() * f.gw * 0.7;
            g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = 3;
            g.beginPath(); g.moveTo(f.px(u, v), f.py(u, v)); g.lineTo(f.px(u + 2.4, v), f.py(u + 2.4, v)); g.stroke();
        }
    }
    for (var n = 0; n < 120; n++) {                         // nail heads, in pairs, at the joists
        var u2 = Math.round(fr() * f.gw * 2) / 2, v2 = Math.round(fr() * f.gh * 2) / 2;
        g.fillStyle = 'rgba(120,104,80,.35)'; g.fillRect(Math.round(f.px(u2, v2)), Math.round(f.py(u2, v2)), 1, 1);
    }
    for (var d = 0; d < 300; d++) {
        var u3 = fr() * f.gw, v3 = fr() * f.gh;
        g.fillStyle = 'rgba(196,178,132,' + (0.06 + fr() * 0.14).toFixed(3) + ')';
        g.fillRect(Math.round(f.px(u3, v3)), Math.round(f.py(u3, v3)), 1, 1);
    }
};
GROUND.hollow = function (g, f) {
    /* The one ground that has to feel wrong. Everywhere else in the game
       the tile grid is something you stop seeing. Here the frost picks
       every edge out in white, so the ground looks ruled, like somebody
       set it out. And there is not one living thing scattered on it. */
    var fr = f.fr;
    /* On the EDGES, at k - 0.5, not through the middles at integer k. The
       tile pass draws tile (x,y) as the diamond with corners at world
       (x,y),(x+1,y),(x+1,y+1),(x,y+1), so the edges are the half-integer
       lines. Ruling the integers put the white lattice exactly TILE_H/2
       below the black one and gave the one ground that is meant to look
       ruled two interleaved grids at half-tile pitch. */
    for (var v = -0.5; v <= f.gh - 0.5; v++) {
        g.strokeStyle = 'rgba(178,190,214,.16)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(f.px(0, v), f.py(0, v)); g.lineTo(f.px(f.gw, v), f.py(f.gw, v)); g.stroke();
    }
    for (var u = -0.5; u <= f.gw - 0.5; u++) {
        g.strokeStyle = 'rgba(178,190,214,.16)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(f.px(u, 0), f.py(u, 0)); g.lineTo(f.px(u, f.gh), f.py(u, f.gh)); g.stroke();
    }
    for (var i = 0; i < 500; i++) {                         // rime, gathered in the low places
        var u2 = fr() * f.gw, v2 = fr() * f.gh;
        var d = Math.hypot(u2 - f.gw / 2, v2 - f.gh / 2);
        g.fillStyle = 'rgba(196,206,226,' + (0.03 + fr() * 0.09 * clamp(d / 5, 0, 1)).toFixed(3) + ')';
        g.fillRect(Math.round(f.px(u2, v2)), Math.round(f.py(u2, v2)), 1 + (fr() < 0.2 ? 1 : 0), 1);
    }
    // the ground is lower in the middle, and it gets darker the further in you go
    var cx0 = f.px(f.gw / 2, f.gh / 2), cy0 = f.py(f.gw / 2, f.gh / 2);
    g.save(); g.translate(cx0, cy0); g.scale(1, 0.5);
    var gr = g.createRadialGradient(0, 0, 10, 0, 0, 230);
    gr.addColorStop(0, 'rgba(4,3,10,.72)'); gr.addColorStop(1, 'rgba(4,3,10,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 230, 0, TAU); g.fill(); g.restore();
    for (var r = 0; r < 26; r++) {                          // and the frost is scored, outward, all the way round
        var a = r / 26 * TAU;
        var u3 = f.gw / 2 + Math.cos(a) * 3.4, v3 = f.gh / 2 + Math.sin(a) * 3.4;
        var u4 = f.gw / 2 + Math.cos(a) * 5.6, v4 = f.gh / 2 + Math.sin(a) * 5.6;
        g.strokeStyle = 'rgba(170,182,206,.09)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(f.px(u3, v3), f.py(u3, v3)); g.lineTo(f.px(u4, v4), f.py(u4, v4)); g.stroke();
    }
};
GROUND.stage = function (g, f) {                            // boards that get walked on every ninth night
    var fr = f.fr;
    for (var v = 0; v < f.gh; v += 0.5) {
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(f.px(0, v), f.py(0, v)); g.lineTo(f.px(f.gw, v), f.py(f.gw, v)); g.stroke();
        g.strokeStyle = 'rgba(126,96,58,' + (0.1 + fr() * 0.18).toFixed(3) + ')'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(f.px(0, v + 0.06), f.py(0, v + 0.06)); g.lineTo(f.px(f.gw, v + 0.06), f.py(f.gw, v + 0.06)); g.stroke();
    }
    for (var k = 0; k < 200; k++) {                         // scuffs from four hundred years of the same three steps
        var u = fr() * f.gw, v2 = fr() * f.gh;
        blob(g, f.px(u, v2), f.py(u, v2), 3 + fr() * 8, 1.4 + fr() * 3, 'rgba(120,92,54,.1)');
    }
    g.strokeStyle = 'rgba(226,216,196,.3)'; g.lineWidth = 2;   // chalk: your mark, and the line you walk
    g.beginPath(); g.moveTo(f.px(f.gw * 0.3, f.gh * 0.62), f.py(f.gw * 0.3, f.gh * 0.62));
    g.lineTo(f.px(f.gw * 0.7, f.gh * 0.62), f.py(f.gw * 0.7, f.gh * 0.62)); g.stroke();
    var mx = f.px(f.gw * 0.5, f.gh * 0.62), my = f.py(f.gw * 0.5, f.gh * 0.62);
    g.beginPath(); g.moveTo(mx - 7, my - 4); g.lineTo(mx + 7, my + 4); g.stroke();
    g.beginPath(); g.moveTo(mx + 7, my - 4); g.lineTo(mx - 7, my + 4); g.stroke();
};
GROUND.room = function (g, f) {                             // somebody lives on this floor
    var fr = f.fr;
    for (var v = 0; v < f.gh; v += 0.45) {
        g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(f.px(0, v), f.py(0, v)); g.lineTo(f.px(f.gw, v), f.py(f.gw, v)); g.stroke();
        g.strokeStyle = 'rgba(132,104,70,' + (0.1 + fr() * 0.2).toFixed(3) + ')'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(f.px(0, v + 0.05), f.py(0, v + 0.05)); g.lineTo(f.px(f.gw, v + 0.05), f.py(f.gw, v + 0.05)); g.stroke();
        for (var u = 1.5; u < f.gw; u += 2.5 + fr()) {      // board ends, staggered
            g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1;
            g.beginPath(); g.moveTo(f.px(u, v), f.py(u, v)); g.lineTo(f.px(u, v + 0.45), f.py(u, v + 0.45)); g.stroke();
        }
    }
    var rx0 = f.gw * 0.28, ry0 = f.gh * 0.3, rx1 = f.gw * 0.72, ry1 = f.gh * 0.72;
    g.fillStyle = 'rgba(74,44,40,.5)';                      // a rug, worn to the backing in the middle
    g.beginPath();
    g.moveTo(f.px(rx0, ry0), f.py(rx0, ry0)); g.lineTo(f.px(rx1, ry0), f.py(rx1, ry0));
    g.lineTo(f.px(rx1, ry1), f.py(rx1, ry1)); g.lineTo(f.px(rx0, ry1), f.py(rx0, ry1));
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,72,60,.4)'; g.lineWidth = 1; g.stroke();
    for (var s = 0; s < 90; s++) {
        var su = rx0 + fr() * (rx1 - rx0), sv = ry0 + fr() * (ry1 - ry0);
        g.fillStyle = fr() < 0.5 ? 'rgba(132,80,66,.3)' : 'rgba(44,26,26,.4)';
        g.fillRect(Math.round(f.px(su, sv)), Math.round(f.py(su, sv)), 2, 1);
    }
    blob(g, f.px((rx0 + rx1) / 2, (ry0 + ry1) / 2), f.py((rx0 + rx1) / 2, (ry0 + ry1) / 2), 34, 17, 'rgba(30,20,18,.3)');
    for (var d = 0; d < 60; d++) {                          // dust and crumbs at the edges of the room
        var du = fr() * f.gw, dv = fr() * f.gh;
        g.fillStyle = 'rgba(150,130,100,.16)';
        g.fillRect(Math.round(f.px(du, dv)), Math.round(f.py(du, dv)), 1, 1);
    }
};
function buildFloor(kind, gw, gh) {
    gw = gw || GRID; gh = gh || GRID;
    kind = floorOf(kind);
    var key = kind + gw + 'x' + gh;
    var hit = FLOORS[key];
    if (hit) { touchFloor(key); return hit; }
    var box = placeBox(gw, gh);
    var cv = document.createElement('canvas'); cv.width = box.w; cv.height = box.h;
    var g = cv.getContext('2d');
    /* Math.imul, not `*`. A uint32 times 1103515245 reaches 2^62, a double
       carries 53 bits of mantissa, and the low nine bits were being rounded
       away before `>>> 0` ever saw them. That is not an LCG with a 2^32
       period: from seed 9 it visited 5078 states and then cycled on 419
       forever. GROUND.town draws 16188 numbers for the square, so 71% of
       the cobbles under the hub were coming out of those 419. */
    var seed = 9; function fr() { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) / 16777216; }
    var pal = FLOOR_PAL[kind];
    g.fillStyle = '#07060a'; g.fillRect(0, 0, box.w, box.h);
    /* Pass one: the tiles, which is what keeps the iso grid legible.
       Kept deliberately quiet — all the character goes on in pass two,
       scattered across the whole bitmap rather than per tile, because
       anything laid out tile by tile reads as graph paper the moment
       you look at more than four of them. */
    for (var y = 0; y < gh; y++) for (var x = 0; x < gw; x++) {
        var sx = isoXB(x, y) - box.x, sy = isoYB(x, y) - box.y;
        var edge = Math.min(x, y, gw - 1 - x, gh - 1 - y);
        g.beginPath();
        g.moveTo(sx, sy); g.lineTo(sx + TILE_W / 2, sy + TILE_H / 2);
        g.lineTo(sx, sy + TILE_H); g.lineTo(sx - TILE_W / 2, sy + TILE_H / 2); g.closePath();
        g.fillStyle = shadeHex(pal[(x + y) % 2 ? 0 : 1], 0.92 + fr() * 0.2);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 1; g.stroke();
        if (edge === 0) { g.fillStyle = 'rgba(4,3,8,.45)'; g.fill(); }
        if (edge === 1) { g.fillStyle = 'rgba(4,3,8,.18)'; g.fill(); }
    }
    // pass two happens inside the outline of the place, never over its edge
    var shape = [
        [isoXB(0, 0) - box.x, isoYB(0, 0) - box.y],
        [isoXB(gw - 1, 0) - box.x + TILE_W / 2, isoYB(gw - 1, 0) - box.y + TILE_H / 2],
        [isoXB(gw - 1, gh - 1) - box.x, isoYB(gw - 1, gh - 1) - box.y + TILE_H],
        [isoXB(0, gh - 1) - box.x - TILE_W / 2, isoYB(0, gh - 1) - box.y + TILE_H / 2]
    ];
    g.save();
    g.beginPath(); g.moveTo(shape[0][0], shape[0][1]);
    for (var si = 1; si < 4; si++) g.lineTo(shape[si][0], shape[si][1]);
    g.closePath(); g.clip();
    (GROUND[kind] || GROUND.mill)(g, {
        w: box.w, h: box.h, gw: gw, gh: gh, pal: pal, fr: fr,
        // tile coords to bitmap coords, so detail can be placed by where
        // it is in the world rather than by where it is on the canvas
        px: function (u, v) { return isoXB(u, v) - box.x; },
        py: function (u, v) { return isoYB(u, v) - box.y + TILE_H / 2; }
    });
    g.restore();
    // a ring of light where the scene wants you to stand
    var cx0 = isoXB(gw / 2, gh / 2) - box.x, cy0 = isoYB(gw / 2, gh / 2) - box.y;
    g.save(); g.translate(cx0, cy0); g.scale(1, 0.5);
    var rg = g.createRadialGradient(0, 0, 20, 0, 0, 330);
    rg.addColorStop(0, kind === 'stage' ? 'rgba(255,190,90,.16)' : 'rgba(255,200,120,.05)');
    rg.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 330, 0, TAU); g.fill(); g.restore();
    // the vignette used to be baked here. With a camera it has to follow
    // the eye, not the ground, so it moved to drawVignette in screen space.
    FLOORS[key] = { cv: cv, box: box, bytes: box.w * box.h * 4 };
    FLOOR_BYTES += FLOORS[key].bytes;
    touchFloor(key); trimFloors();
    return FLOORS[key];
}
function touchFloor(key) {
    var i = FLOOR_LRU.indexOf(key); if (i >= 0) FLOOR_LRU.splice(i, 1);
    FLOOR_LRU.push(key);
}
function trimFloors() {
    while (FLOOR_LRU.length > FLOOR_MIN && FLOOR_BYTES > FLOOR_BUDGET) {
        var k = FLOOR_LRU.shift(), f = FLOORS[k];
        if (!f) continue;
        FLOOR_BYTES -= f.bytes;
        f.cv.width = f.cv.height = 0; delete FLOORS[k];              // drop the backing store, not just the reference
    }
}
function freeFloors() {
    Object.keys(FLOORS).forEach(function (k) { FLOORS[k].cv.width = FLOORS[k].cv.height = 0; delete FLOORS[k]; });
    FLOOR_BYTES = 0;
    FLOOR_LRU.length = 0;
}

/* ─────────────── particles ─────────────── */
function part(p) { p.max = p.life; if (RT.parts.length < 900) RT.parts.push(p); }
function burst(x, y, z, n, o) {
    for (var i = 0; i < n; i++) {
        var a = rnd(0, TAU), sp = rnd(o.sp0 || 0.4, o.sp1 || 2.2);
        part({ x: x, y: y, z: z + rnd(-3, 5), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(o.vz0 == null ? 15 : o.vz0, o.vz1 == null ? 80 : o.vz1),
               life: rnd(o.l0 || 0.3, o.l1 || 0.9), size: rnd(o.s0 || 1.4, o.s1 || 3.2), col: o.col, add: o.add == null ? 1 : o.add, grav: o.grav == null ? 130 : o.grav,
               sh: o.sh || 0, fr: o.fr || 0 });
    }
}
/* burst() throws a circle, which is right for a death and wrong for an
   impact: a call arrives FROM somewhere and the matter should know it.
   Same option bag as burst plus a heading and a half spread. The
   heading is a WORLD angle, because these are world velocities; if you
   are drawing a shape to go with it, that shape wants isoAng(ang). */
function spray(x, y, z, n, ang, spread, o) {
    for (var i = 0; i < n; i++) {
        var a = ang + rnd(-spread, spread), sp = rnd(o.sp0 || 0.4, o.sp1 || 2.2);
        part({ x: x, y: y, z: z + rnd(-3, 5), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
               vz: rnd(o.vz0 == null ? 15 : o.vz0, o.vz1 == null ? 80 : o.vz1),
               life: rnd(o.l0 || 0.3, o.l1 || 0.9), size: rnd(o.s0 || 1.4, o.s1 || 3.2),
               col: o.col, add: o.add == null ? 1 : o.add, grav: o.grav == null ? 130 : o.grav,
               sh: o.sh || 0, fr: o.fr || 0 });
    }
}
function stepParts(dt) {
    for (var i = RT.parts.length - 1; i >= 0; i--) {
        var p = RT.parts[i]; p.life -= dt;
        if (p.life <= 0) { RT.parts.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.grav * dt;
        if (p.fr) { var q = Math.max(0, 1 - p.fr * dt); p.vx *= q; p.vy *= q; p.vz *= q; }
        if (p.z < 0) { p.z = 0; p.vz *= -0.28; p.vx *= 0.6; p.vy *= 0.6; }
    }
}
/* Alpha to a finished string, once per bucket per colour, forever.
   drawParts built one 'rgba(...)' plus one toFixed(3) per particle per
   frame, so at the 900 cap that is 1800 short lived strings and 900
   CSS colour parses, 144 times a second, and every design in this
   overhaul names it as the file's worst existing habit. Sixteen
   buckets is invisible on a value that is already tied to a life
   fraction. Bounded, because a family that mixes colours per frame
   through mixRgb has a key space of thousands. */
var PCOL = {}, PCOL_N = 0;
function partCol(rgb, a) {
    var q = a <= 0 ? 0 : a >= 1 ? 16 : Math.round(a * 16), k = rgb + '|' + q, v = PCOL[k];
    if (v) return v;
    if (++PCOL_N > 4096) { PCOL = {}; PCOL_N = 1; }
    return (PCOL[k] = 'rgba(' + rgb + ',' + (q / 16).toFixed(3) + ')');
}
/* Two passes, not one, so globalCompositeOperation flips exactly twice
   per frame instead of up to nine hundred times. A state change on a
   2D context is far more expensive than an array step, and the old
   loop set the op unconditionally on every particle even when it had
   not changed. Opaque matter first, light on top of it, which is also
   the more correct order and was previously whatever order the array
   happened to be in. */
function drawParts(cx) {
    drawPartPass(cx, 0);
    if (RT.parts.length) {
        cx.globalCompositeOperation = 'lighter';
        drawPartPass(cx, 1);
        cx.globalCompositeOperation = 'source-over';
    }
}
function drawPartPass(cx, add) {
    for (var i = 0; i < RT.parts.length; i++) {
        var p = RT.parts[i];
        if ((p.add ? 1 : 0) !== add) continue;
        var k = clamp(p.life / p.max, 0, 1);
        var sx = isoX(p.x, p.y), sy = isoYA(p.x, p.y) - p.z;
        var s = p.size * (0.4 + 0.6 * k);
        cx.fillStyle = partCol(p.col, k);
        /* Three shapes. The default arm is the line this function has
           always had. The other two are the reason five families can
           have matter that is not the same square: one lies on the
           ground plane, which is the 1:0.5 idiom the whole rest of the
           file uses for anything on the floor, and one stands up.
           The standing arm ROUNDS, and it is the only one that does:
           a size 1 non additive mote at an unrounded isoX renders as a
           2x2 of quarter alpha, and -ill's frost is the one material
           in the game that has to arrive hard and dry. */
        if (p.sh === 1) cx.fillRect(sx - s, sy - s * 0.25, s * 2, Math.max(1, s * 0.5));
        else if (p.sh === 2) cx.fillRect(Math.round(sx), Math.round(sy - s), Math.max(1, Math.round(s * 0.5)), Math.round(s * 2));
        else cx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
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
        var sx = isoX(w.x, w.y), sy = isoYA(w.x, w.y) - w.z;
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
/* The fourth argument is the punch, and the size, and the length, and
   where. Without it this is byte for byte the function it was: 62px,
   0.55s, a flat 9 of shake and half a unit of chroma, which is what
   every story slam in the file still wants and gets.
   With it: 44px at one syllable and 74 at twelve. The banner above
   this block says spells are words getting bigger, and every slam in
   the game has been exactly 62px since it was written, so the one
   channel the player actually reads is the one channel that never
   scaled. Shaking the screen around a word that has not noticed is
   not a punch layer.
   o.dur is -erd's, whose bars need the word held past the clap.
   o.sy is the detonation's: at 2.6x opening scale a 74px word anchored
   at VH*0.44 reaches y 225 and would print straight over the line at
   174 and the rule at 187 on the exact frame both of them strike.
   VH*0.62 puts the composition back in the order it is designed in:
   line, rule, notches, tag, sub.

   IT IS `sy` AND NOT `y`, AND THAT IS THE WHOLE POINT OF THE NAME.
   The same bag goes on to punch(), which reads o.x and o.y as WORLD
   TILES. This read them as a screen pixel, so all three slams that
   position themselves (the detonation, the stanza and the Reprise)
   handed punch() a y of 359.6 as a tile coordinate. punch()'s guard is
   isFinite, which 359.6 passes, so it took the anchor seriously: it
   projected a point about five thousand pixels off the bottom of the
   world and then clamped it into the dead-zone box, which means every
   rhyme in the game leaned the frame the same direction by the same
   amount and the shake direction was a constant. The one feature the
   punch layer exists for, on the one event it exists for, was
   measuring a screen coordinate as a place in the town. */
function slam(txt, col, sub, o) {
    var p, t = 0.55, px = 62, y = VH * 0.44;
    if (o) {
        p = fxP(o.power == null ? 1 : o.power);
        t = o.dur ? o.dur : 0.55 + p * 0.14;
        px = Math.round(44 + 30 * p);
        if (o.sy != null) y = o.sy;
    }
    RT.slams.push({ txt: txt, col: col, sub: sub || '', t: t, max: t, px: px, y: y });
    if (o) punch(o);
    else { RT.shake = shake(9); RT.chroma = 0.5; }
}
function drawSlams(cx, dt) {
    for (var i = RT.slams.length - 1; i >= 0; i--) {
        var s = RT.slams[i]; s.t -= dt;
        if (s.t <= 0) { RT.slams.splice(i, 1); continue; }
        var k = 1 - s.t / s.max;
        var scale = k < 0.18 ? lerp(2.6, 1, k / 0.18) : 1 + (k - 0.18) * 0.16;
        var a = k < 0.18 ? 1 : clamp(1 - (k - 0.5) * 2.4, 0, 1);
        cx.save();
        cx.translate(VW / 2, s.y || VH * 0.44); cx.scale(scale, scale); cx.globalAlpha = a;
        cx.textAlign = 'center';
        cx.font = 'bold ' + (s.px || 62) + 'px "Press Start 2P", monospace';
        // chromatic split: RT.chroma drives the offset and the family
        // drives the two colours, so a shadow slam fringes violet
        // instead of the print misregistration red and blue this was.
        // `scale` is passed so the split is 5 device pixels and not 13.
        chromaText(cx, s.txt, 0, 0, 1 - k, scale);
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
    var L = { txt: txt, sub: sub || '', col: col || '#f0e9df', t: dur || 2.2, max: dur || 2.2, pin: pin ? 1 : 0, age: 0 };
    RT.lines.push(L);
    /* returned so a caller that needs to draw UNDER a line can find it
       again. RT.lines reflows as lines expire (drawLines puts line i at
       VH*0.3 + i*44), so a rule that wants to stay under its own line
       has to look its index up every frame, and holding the record is
       the only way to do that. Nothing that ignores the return value
       changes. */
    return L;
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
            L.t -= dt; L.age += dt;      // age every line, not just the pinned one
            if (L.t <= 0) { RT.lines.splice(i, 1); continue; }
            k = 1 - L.t / L.max;
            a = clamp(L.t / 0.5, 0, 1);
            y = VH * 0.3 + i * 44;
        }
        /* the typewriter ran off k, which is a fraction of the line's
           own duration, so a line that lived three times as long typed
           three times as slowly: a 1.1s recital line typed in 0.385s
           and a 3.4s story line in 1.19s, for no reason anybody chose.
           It is a rate, so it runs off age. */
        var chars = Math.ceil(L.txt.length * clamp(L.age / 0.34, 0, 1));
        cx.save(); cx.globalAlpha = a; cx.textAlign = 'center';
        cx.font = '30px "VT323", monospace';
        var txt = L.txt.slice(0, chars);          // once, not three times. arguments evaluate before an early return
        cx.fillStyle = '#08060c'; cx.fillText(txt, VW / 2 + 2, y + 2);
        chromaText(cx, txt, VW / 2, y, 0.5);      // the Reprise sets chroma to 1 and this is its line
        cx.fillStyle = L.col; cx.fillText(txt, VW / 2, y);
        if (L.sub && k > 0.3) {
            cx.font = 'bold 22px "Press Start 2P", monospace';
            cx.fillStyle = L.col; cx.globalAlpha = a * clamp((k - 0.3) * 3, 0, 1);
            cx.fillText(L.sub, VW / 2, y + 34);
        }
        cx.restore();
    }
    cx.textAlign = 'left';
}
function shake(a, cap) {
    if (!S.opts.shake) return RT.shake;
    /* punch() can leave the amplitude above the legacy cap of 14, and
       a legacy call arriving after it used to return min(14, 18 + 4),
       which is 14: a small hit QUIETENING a big one, and the rising
       edge detector above not firing either. A legacy call may raise
       an amplitude and may never lower one it did not set. */
    return Math.min(Math.max(cap == null ? 14 : cap, RT.shake), RT.shake + a);
}

/* THE ONE GLOW. Six hard bands, not a gradient, and this is the
   doctrine rather than a saving: the comment at 6702 says a soft
   radial falloff is the one thing on screen that is not made of
   pixels, which is why contactShadow is three banded rings and why
   dither exists. Magnified nearest neighbour, six bands read as
   concentric rings of light going out from a thing, which is a better
   detonation than a blur and is the same visual language as the
   banded ground.
   Painted innermost first with destination-over, so every band lands
   at exactly the alpha it is authored at instead of compounding with
   the one over it. Bake time only: one canvas per colour, ever. The
   thing this replaces is drawFproj (3950), which allocates a
   CanvasGradient and rasterises a per pixel ramp per blob per frame,
   and which is the anti-pattern the prop cache at 6420 and the figure
   cache at 1806 were both written to argue against. */
var GLOWS = {};
function glowSpr(rgb) {
    var c = GLOWS[rgb]; if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 128;
    var b = c.getContext('2d'), i;
    var R = [11, 21, 32, 43, 53, 64], A = [1, 0.72, 0.46, 0.26, 0.12, 0.05];
    b.globalCompositeOperation = 'destination-over';
    for (i = 0; i < 6; i++) {
        b.fillStyle = 'rgba(' + rgb + ',' + A[i] + ')';
        b.beginPath(); b.arc(64, 64, R[i], 0, TAU); b.fill();
    }
    return (GLOWS[rgb] = c);
}
/* blit() puts a figure's feet on the point, which is right for people
   and wrong for light. Centre, additive, and w and h taken separately
   so the ground squash costs no transform: every light in this town is
   a 1:0.62 ellipse (drawLights 7845) and a perfect circle is the one
   light in the game standing up. Rounded, because everything is.
   imageSmoothingEnabled is NOT flipped: the bands are the point. */
function glowAt(cx, rgb, x, y, w, h, a) {
    if (a <= 0.004) return;
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = clamp(a, 0, 1);
    cx.drawImage(glowSpr(rgb), Math.round(x - w / 2), Math.round(y - h / 2), Math.round(w), Math.round(h));
    cx.restore();
}
function freeGlows() { Object.keys(GLOWS).forEach(function (k) { GLOWS[k].width = GLOWS[k].height = 0; delete GLOWS[k]; }); }

/* ═══════════════ SCREEN PUNCH ═══════════════
   Everything the frame itself does when something lands: the held
   frame, the lurch toward it, the split on the letters, the family's
   own light in the room, and a shake that goes one direction instead
   of buzzing.
   ONE entry point, because eight areas are writing effects against
   this file and if each of them reaches for shake() by hand we end up
   with eight ideas of what a big hit is. That is how we got here:
   shake() is asked for 9 by a one stack rhyme and 9 by a thirty stack
   rhyme, and three of the five families had begun writing their own
   hitstop into their own field.
   Five rules that are not negotiable.
     The hitstop counts down on REAL time, inside stepFx, or it
       deadlocks the instant the sim clock it is holding reaches zero.
     RT.timeScale is the dev slider's variable. Do not borrow it.
     The zoom goes IN only and snaps to a ladder, because the world is
       nearest neighbour pixels and a continuous scale crawls.
     Every channel takes the LARGER of what is running and what is
       asked for. NOTHING SUMS, including the shake, which is the one
       the first draft of this got wrong.
     Nothing in here is ever called from inside a per-foe loop. Once
       per thing the player did. */

var FLASH0 = '255,250,235';          // what the flash was before it had a family
var PX_BRASS = '#c9a94a';            // fourteen uses: lamps, the crown, the milestone

/* Two copies of a word pushed apart. NOT the red and cyan hard coded
   into drawSlams at 1459: those are the only saturated red and the
   only saturated blue in a palette where nothing else passes 55%, and
   they read as a printing fault rather than as force. A family fringes
   into its own light on one side and into its own hue at the palette's
   dark end on the other, and both are DERIVED off FAMS in punchBoot so
   the table cannot drift from the colours. The greys fringe brass into
   tarnish, because a slant is the town's own false line coming apart
   and the town is brass. */
var FAM_CHROMA = { none: ['rgba(255,230,110,.55)', 'rgba(74,63,27,.55)'] };

/* How much light each sound puts in the room, and how much it takes
   out. Three numbers each and every one of them is doing work.
     a     peak alpha of the core, normalised by the colour's own
           luminance so five very different hues do not clip, then
           multiplied by intent so they are not all the same brightness
           either. Normalising alone was a clipping guard being used as
           an art decision: -ight is the bright one and -ark is the
           dark one and flattening that is where five sounds become
           five swatches.
     dark  a flat source-over of the violet dark end BEFORE the core.
           The room loses light and the light moves to the detonation.
           -ark spends its entire budget here: the family whose fiction
           is holding the only light and not handing it over cannot be
           the family that puts the most light in the room.
   The colour is the family's GLOW, not its col. Three of the five
   elite marks are exactly a family col (MODS.loud, quick, sealed), and
   blooming on the col is the one change that would make that existing
   confusion materially worse. Blooming on the glow costs nothing and
   resolves it without an edit to MODS, which is job 4's. */
var FAM_BLOOM = {
    eat:  { a: 0.272, dark: 0.35 },
    ight: { a: 0.304, dark: 0.30 },
    erd:  { a: 0.190, dark: 0.35 },
    ark:  { a: 0.109, dark: 1.00 },
    ill:  { a: 0.212, dark: 0.30 },
    /* 0.50, and it is not a typo next to the five above. onChorusDown
       (3442) writes a bare RT.flash = 0.5 and gets no anchor and no
       colour, and the old flat source-over wash put every pixel of a
       near black scene at 70 of 255. At 0.50 the centre of the new
       bloom is 72, which matches; the corners are 25, which does not.
       That is the change and it is deliberate: a flash with a centre,
       on the frame the boss dies in front of you, is better than a
       flat one. dark is 0 so the biggest scripted flash in the game
       does not darken the room first. */
    none: { a: 0.500, dark: 0 }
};

/* Each sound shakes differently, stops differently and holds
   differently, and it is five numbers each in a table that already
   had to exist. This is the per family structure the whole layer was
   missing: without it the punch is one gesture with a colour picker.
     hz    how fast the frame swings
     ring  divides the decay, so a bigger ring hangs longer
     stop  multiplies the held frame. -ill asks for the longest hold in
           the game and -erd for the shortest, and both of them had
           written their own hitstop field to get it
     cut   seconds after which the shake is ZEROED outright rather than
           damped. -erd only: ring 0.55 decays it, cutting it stops it,
           and being cut off mid word is the family
     zhold multiplies the hold at the top zoom rung. -eat only:
           hunger outlasts its own bang
     hard  the release is one hard step instead of the ladder, and the
           light holds flat and then stops instead of fading. -ill
           only: a wash that fades is a thing ending, a wash that stops
           is the family that stops */
var FAM_PUNCH = {
    eat:  { hz: 17, ring: 1.15, stop: 0.60, cut: 0, zhold: 2.2, hard: 0 },
    ight: { hz: 26, ring: 0.85, stop: 0.80, cut: 0, zhold: 1.0, hard: 0 },
    erd:  { hz: 30, ring: 0.55, stop: 0.45, cut: 0.09, zhold: 1.0, hard: 0 },
    ark:  { hz: 14, ring: 1.30, stop: 1.10, cut: 0, zhold: 1.0, hard: 0 },
    ill:  { hz: 24, ring: 0.40, stop: 1.50, cut: 0, zhold: 1.0, hard: 1 },
    none: { hz: 22, ring: 1.00, stop: 1.00, cut: 0, zhold: 1.0, hard: 0 }
};

/* How hard each kind of event hits, before power. A call landing is a
   tap and a closed rhyme is the whole screen: same code, different
   weights, so nobody has to invent a second shake. `cap` is optional
   and overrides the shake ceiling for a row that fires often.
   `toll` is the ending. Twenty-five folk at the last cue of act three
   is arithmetically the loudest event in the game and dramatically the
   quietest: a scripted scene where the town is sitting in a square and
   the player is meant to be reading a line. Grief is a held frame, not
   a rattle. Job 1 passes kind: 'toll' and nothing else changes. */
var PUNCH_KIND = {
    tap:   { stop: 0.00, zoom: 0.10, shake: 0.30, chroma: 0.20, bloom: 0.10, cap: 5 },
    close: { stop: 1.00, zoom: 1.00, shake: 1.00, chroma: 1.00, bloom: 1.00 },
    drag:  { stop: 0.35, zoom: 0.35, shake: 0.65, chroma: 1.00, bloom: 0.35 },
    slant: { stop: 0.20, zoom: 0.20, shake: 0.55, chroma: 0.90, bloom: 0.20 },
    beat:  { stop: 0.45, zoom: 0.55, shake: 0.70, chroma: 0.55, bloom: 0.60 },
    wave:  { stop: 0.30, zoom: 0.70, shake: 0.85, chroma: 0.40, bloom: 0.75 },
    kill:  { stop: 0.55, zoom: 0.45, shake: 0.55, chroma: 0.35, bloom: 0.45 },
    sour:  { stop: 0.25, zoom: 0.00, shake: 0.50, chroma: 0.60, bloom: 0.00 },
    hurt:  { stop: 0.40, zoom: 0.25, shake: 0.85, chroma: 0.70, bloom: 0.00 },
    toll:  { stop: 1.20, zoom: 0.60, shake: 0.15, chroma: 0.50, bloom: 1.00 }
};
/* The option is a level and not a switch, and turning it down never
   turns an event off: the same punch() runs and the numbers get
   smaller, so nothing anywhere else in the file grows a branch. Level
   0 is the game as it shipped minus the frame rate dependent jitter,
   which was a bug and not a taste. Shake keeps its own toggle:
   motion sensitivity and a dislike of camera shake are not the same
   complaint. Every clamp still applies at level 3, so "too much" is a
   faster ramp to the same ceiling and not a new ceiling. */
var PUNCH_LV = [
    { stop: 0,   zoom: 0,   shake: 1,    chroma: 0,   bloom: 0    },
    { stop: 0,   zoom: 0,   shake: 0.85, chroma: 0.5, bloom: 0.5  },
    { stop: 1,   zoom: 1,   shake: 1,    chroma: 1,   bloom: 1    },
    { stop: 1.4, zoom: 1.4, shake: 1.25, chroma: 1.4, bloom: 1.3  }
];
var PUNCH_LV_N = ['off', 'light', 'full', 'too much'];
function punchLvI() { var v = S && S.opts ? S.opts.punch : null; return clamp(v == null ? 2 : v | 0, 0, 3); }
function punchLv() { return PUNCH_LV[punchLvI()]; }
/* Two names, one body, and the alias is what is conditional, never
   the call sites. fxP is the body because the world layer is the one
   with eleven call sites; punchP is kept because three sibling
   designs and two critiques quote it by name. */
function punchP(n) { return fxP(n); }

var PUNCH_RGB = {};
function punchMake() {
    return { stop: 0, stopMax: 0, zoom: 0, zHold: 0, z: 1,
             ax: VW / 2, ay: VH / 2, ox: 0, oy: 0,
             sx: 0, sy: 0, st: 0, was: 0, fresh: 0,
             hz: 22, ring: 1, cut: 0, hard: 0, fhold: 0,
             ca: FAM_CHROMA.none[0], cb: FAM_CHROMA.none[1],
             fcol: FLASH0, fbl: FAM_BLOOM.none,
             bx: VW / 2, by: VH / 2, bw: VW * 1.9, bh: VW * 1.9 * 0.62,
             rev: 0, revCd: 0, dms: 0 };
}
/* Derived rather than typed, so the tables cannot drift from FAMS.
   Called from fxBoot at the foot of the file, because hex2rgb (2859)
   and rgbMul are both below this banner. */
function punchBoot() {
    FAM_IDS.forEach(function (f) {
        PUNCH_RGB[f] = hex2rgb(FAMS[f].glow);          // light is the family's glow, never its col
        FAM_CHROMA[f] = ['rgba(' + hex2rgb(FAMS[f].glow) + ',.55)',
                         'rgba(' + rgbMul(FAMS[f].col, 0.42) + ',.55)'];
    });
    PUNCH_RGB.none = FLASH0;
    FAM_CHROMA.none = ['rgba(255,230,110,.55)', 'rgba(' + rgbMul(PX_BRASS, 0.37) + ',.55)'];
}

/* THE ONE ENTRY POINT.
     fam    a family id, or nothing for the greys
     fam2   optional: the family the stacks were dragged FROM. The
            trailing fringe copy takes it, so for the length of a drag
            every word on screen is literally two sounds pulling apart,
            the new one leading in its own light and the old one
            trailing into its own dark. That is the mechanic, drawn, in
            the only layer that can draw it, for one line
     power  syllables: stacks closed, stacks dragged, 1 for a call
     kind   a row of PUNCH_KIND, default 'close'
     x, y   WORLD TILES, where it happened. Optional
     bx,by  optional SCREEN pixels for the light only, when the light
            belongs somewhere the event did not. The detonation sends
            the line's own anchor, because a ball of light at the enemy
            centroid is a shockwave saying "a thing went off here" and
            the thing that happened was that things which were apart
            came together
     flat   the light's height as a share of its width. Default 0.62,
            which is drawLights' own ellipse and makes the bloom an
            enormous lantern pool on the ground rather than the only
            light in this town standing up. The detonation sends ~0.28
            and gets a bar of colour lying along its line
   Every channel takes the LARGER of what is already running and what
   this asks for. Twenty-five calls in one frame make one punch the
   size of the biggest, and that is the only thing standing between
   the last cue of act three and a seizure. */
function punch(o) {
    if (!RT) return;
    o = o || {};
    var pz = fxOf('punch'), lv = punchLv(), w = PUNCH_KIND[o.kind] || PUNCH_KIND.close;
    var p = fxP(o.power == null ? 1 : o.power);
    var fam = (o.fam && FAMS[o.fam]) ? o.fam : 'none', F = FAM_PUNCH[fam];
    var ax = VW / 2, ay = VH / 2, dx = 0, dy = 0, ex, ey, st, zz, sa, cap, ch, fl;

    /* Where. World tiles in, screen pixels out, clamped into a box the
       size of the camera's own dead zone: pure centre is safe and
       dull, pure event position lurches sideways every time the camera
       is clamped against the edge of the floor, which on the road is
       most of the time. Rounded, because the anchor decides which
       pixel rows the zoom duplicates and a moving anchor is the crawl.
       isFinite, because the drag and the slant paths both compute
       their centroid as 0/0: clamp(NaN) returns NaN, Math.round(NaN)
       is NaN, translate(NaN, NaN) makes the transform non invertible
       and NOTHING DRAWS AT ALL for as long as the shake runs. */
    if (o.x != null && isFinite(o.x) && isFinite(o.y)) {
        ex = isoX(o.x, o.y); ey = isoYA(o.x, o.y);
        ax = Math.round(clamp(ex, VW / 2 - 150, VW / 2 + 150));
        ay = Math.round(clamp(ey, VH / 2 - 80, VH / 2 + 80));
        dx = ex - isoX(RT.px, RT.py); dy = ey - isoYA(RT.px, RT.py);
    }

    // the held frame
    st = clamp(T('punchStop') * w.stop * p * lv.stop * F.stop, 0, T('punchStopCap'));
    /* hard and cut latch behind the same comparison the hold uses, and
       are evaluated BEFORE it. They were the one place in this
       function that was last writer wins: close an -ill rhyme, land
       any other Call fifty milliseconds later, and hard flipped to 0
       mid hold so the family that stops faded out instead. The
       character of the loudest event on screen wins, which is the rule
       everywhere else in here. */
    if (st >= pz.stop) { pz.hard = F.hard; pz.cut = F.cut; }
    if (st > pz.stop) {
        pz.stop = st; pz.stopMax = st;
        /* THE HOLD. The sound of the frame catching, and the one sound
           in this layer that matters: it is what tells you the game
           stopped on purpose rather than dropped a frame. Only for a
           stop long enough to see, so a Call landing does not click
           five times a second, and only when the stop actually grew,
           so twenty-five sources on one frame make one click. */
        if (st > 0.05) fxSfx('hold');
    }

    /* The lurch. No attack: the peak lands on the frame the sound
       lands, because the frame is being held anyway and an eased zoom
       inside a hitstop is an eased zoom nobody can see. The gate is
       against the zoom that is ON SCREEN, not against the last punch's
       latched peak: comparing against the peak meant every beat of a
       Reprise after the first, and a boss dying 0.15s after a big
       close, got no lurch at all. */
    zz = clamp(T('punchZoom') * w.zoom * p * lv.zoom, 0, T('punchZoomCap'));
    if (zz > pz.zoom) {
        pz.zoom = zz; pz.ax = ax; pz.ay = ay;
        // the picture stepping toward the blast. Only the three kinds
        // big enough to move the eye: a tap that lurched would make
        // walking through a fight feel like a loose camera mount.
        if (o.kind === 'close' || o.kind === 'wave' || o.kind === 'toll') fxSfx('lurch');
    }
    pz.zHold = Math.max(pz.zHold, st * F.zhold);

    /* The shake. shake() ADDS (1505: Math.min(cap, RT.shake + a)), so
       routing through it made this the one channel that summed, and
       twenty-five simultaneous anything drove it to the cap regardless
       of how big each event was. Written directly, by max, keeping the
       S.opts.shake gate shake() was providing.
       Re-phase only for a real hit: punchDir resets the sinusoid to
       zero, and landCall taps up to five times a second, so an
       unconditional re-phase during the 0.74s tail of an -ark close is
       the frame rate independent version of the per frame re-roll this
       channel exists to delete. */
    sa = T('punchShake') * w.shake * p * lv.shake;
    cap = Math.min(w.cap == null ? 99 : w.cap, T('punchShakeCap'));
    if (S.opts.shake && sa > 0) {
        if (sa > RT.shake * 0.6 || RT.shake < 0.5) {
            punchDir(dx, dy);
            pz.hz = F.hz * (T('punchShakeHz') / 22); pz.ring = F.ring;
        }
        RT.shake = Math.min(cap, Math.max(RT.shake, sa));
    }

    /* The split on the letters. The pair is latched behind the same
       comparison the magnitude uses, or a tap or a hit mid slam
       recolours a word that is already on screen: close an eight stack
       -ark couplet, throw an -ill call, and the violet fringe on the
       still visible ARK flips to frost mid word. */
    ch = Math.min(1.2, T('punchChroma') * w.chroma * p * lv.chroma);
    if (ch > RT.chroma) {
        RT.chroma = ch;
        pz.ca = FAM_CHROMA[fam][0];
        pz.cb = FAM_CHROMA[(o.fam2 && FAMS[o.fam2]) ? o.fam2 : fam][1];
    }

    /* The family's light. Radius scales and alpha barely does, because
       the eye ranks a size instantly and cannot rank the brightness of
       a translucent wash in a dark room for two tenths of a second.
       About 730px of VISIBLE light around one body at one syllable,
       where the outer two of the six bands sit under the alpha floor
       on a near black scene and the sprite itself is 941 wide; 1792 at
       twelve, and the room is full. */
    fl = Math.min(0.8, T('punchBloom') * w.bloom * p * lv.bloom);
    if (fl > RT.flash) {
        RT.flash = fl;
        pz.fcol = PUNCH_RGB[fam]; pz.fbl = FAM_BLOOM[fam];
        pz.bx = o.bx == null ? ax : Math.round(o.bx);
        pz.by = o.by == null ? ay : Math.round(o.by);
        pz.bw = VW * (0.65 + 0.95 * p);
        pz.bh = pz.bw * (o.flat == null ? 0.62 : o.flat);
    }

    /* -ight, and it uses no white at all. Being looked at by people
       who would rather not look is not a bright light, it is nothing
       being hidden: for fifty milliseconds the vignette does not draw
       and the night wash drops by 60%, so the corners of the room,
       which are dark in every other frame of this game, are visible,
       and so is every foe standing in them. Then the dark comes back.
       It costs LESS than the two fills it replaces. */
    if (fam === 'ight' && p >= 0.55 && lv.bloom >= 1 && pz.revCd <= 0) {
        pz.rev = 0.05; pz.revCd = 0.5;
    }
}
/* The direction the frame throws itself, plus a phase reset so the
   first swing is the punch rather than wherever the last sinusoid
   happened to be. !(m >= 1) rather than m < 1, because a NaN fails
   BOTH comparisons and would otherwise skip the fallback and write a
   NaN unit vector into the transform. */
function punchDir(dx, dy) {
    var pz = fxOf('punch'), m = Math.sqrt(dx * dx + dy * dy), a;
    if (!(m >= 1)) { a = rnd(0, TAU); dx = Math.cos(a); dy = Math.sin(a) * 0.6; m = Math.sqrt(dx * dx + dy * dy); }
    pz.sx = dx / m; pz.sy = dy / m; pz.st = 0; pz.fresh = 1;
    pz.hz = FAM_PUNCH.none.hz; pz.ring = FAM_PUNCH.none.ring;
}

/* Real time, always. pz.stop is the thing holding the sim clock down;
   count it on the clock it is holding and it never reaches zero and
   the game is frozen with no way out but the dev menu. Same trick as
   RT.dilate at 3816 and the reason that line carries a comment.
   Registered through regFx, so stepFx has already resolved `real` and
   the harness case (__ninth.tick calls step with one argument) is
   handled once for the whole layer rather than in nine steppers. */
function stepPunch(dt, real, pz) {
    var lv = punchLv(), stp, ph, w, was;
    pz.stop = Math.max(0, pz.stop - real);
    pz.revCd = Math.max(0, pz.revCd - real);
    pz.rev = Math.max(0, pz.rev - real);
    if (pz.zHold > 0) pz.zHold = Math.max(0, pz.zHold - real);
    else if (pz.zoom > 0) {
        /* Linear out at a fixed RATE rather than over a fixed duration,
           so every rung of the ladder holds the same fifty
           milliseconds whatever the punch started at and the way back
           reads as four steps rather than a slide. -ill takes one hard
           step instead, because it is the family that stops. */
        pz.zoom = pz.hard ? 0 : Math.max(0, pz.zoom - real * (T('punchZoomCap') / Math.max(0.02, T('punchZoomOut'))));
    }
    /* One snapped value per frame, read by draw(), by screenToWorld
       and by punchWX/punchWY, which is the whole reason it is computed
       here and at none of them. The ladder is what kills the nearest
       neighbour crawl: at a fixed rung and a rounded anchor the same
       source rows duplicate every frame, so a punch is four
       re-registrations instead of sixty. Clamped at 1.12 because the
       FEEL clamps on the cap and the step multiply out to 1.32, at
       which a third of all rows are duplicated. */
    stp = Math.max(0.005, T('punchZoomStep'));
    was = pz.z;
    pz.z = lv.zoom > 0 ? Math.min(1.12, 1 + Math.round(pz.zoom / stp) * stp) : 1;
    // the last rung reaching 1.0: the picture arriving back where it
    // started. Off the LADDER and not off pz.zoom, so it lands on the
    // frame the world stops moving rather than a frame either side.
    if (was > 1 && pz.z <= 1) fxSfx('settle');
    pz.st += real;
    if (pz.cut && pz.st > pz.cut && RT.shake > 0) RT.shake = 0;      // -erd, cut off mid word
    /* This frame's shake offset, computed ONCE. draw() translates by
       it and any screen space pass anchored on a world point adds it
       through punchWX/punchWY, so the two cannot disagree and a
       syllable cannot detach from the body it is peeling off on the
       one frame the room takes the hit. Two detuned sines rather than
       one, so it is a knock and not a note; rounded, because the town
       is whole pixels and a sub pixel translate of the entire world
       softens the grid instead of hitting it; and a decaying sinusoid
       rather than a re-roll, so it looks identical at 60Hz and 144. */
    if (S.opts.shake && RT.shake > 0.2) {
        ph = pz.st * pz.hz * TAU;
        w = Math.sin(ph) * 0.76 + Math.sin(ph * 1.7 + 1.1) * 0.24;
        pz.ox = Math.round(pz.sx * RT.shake * 0.5 * w);
        pz.oy = Math.round(pz.sy * RT.shake * 0.35 * w);
    } else { pz.ox = 0; pz.oy = 0; }
    // -ill: the light holds flat through the stop and then stops, once
    if (pz.hard) { if (pz.stop > 0) pz.fhold = 1; else if (pz.fhold) { pz.fhold = 0; RT.flash = 0; } }
}
function punchShakeXY(cx) { var pz = fxOf('punch'); if (pz.ox || pz.oy) cx.translate(pz.ox, pz.oy); }
/* Scale about a latched screen point. IN only: camBounds (77-85)
   leaves exactly zero slack at the clamp in any place bigger than the
   canvas, so one percent out shows past the edge of the floor bitmap
   on the road every time you walk to the end of it. In has no coverage
   problem at all, at any anchor, because scaling up maps the viewport
   to a strict sub-rectangle of itself. */
function punchZoom(cx) {
    var pz = fxOf('punch'); if (pz.z <= 1) return;
    cx.translate(pz.ax, pz.ay); cx.scale(pz.z, pz.z); cx.translate(-pz.ax, -pz.ay);
}
/* Every full screen wash in draw() is a fillRect(0,0,VW,VH) laid down
   inside the shake translate, so at full shake up to nine pixels of
   one edge is never covered. Nobody has noticed because #07060a and
   #06050a are the same colour to the eye, but the VIGNETTE is one of
   them at 0.8 alpha, and a nine pixel strip of one edge keeping its
   full brightness floor while everything inboard is under an 80% black
   falloff is a bright band down the side of the screen at exactly the
   moment of the biggest punch. Fourteen because the cap is 18 and the
   x gain is 0.5. The zoom needs no allowance: it only ever goes in. */
function fullRect(cx) { cx.fillRect(-14, -14, VW + 28, VH + 28); }

/* The split, in one place, so every word on screen splits by the same
   amount and the amount is the size of the hit that caused it.
     mul  0 to 1, the caller's own strength
     sc   the scale of the space this is being drawn in, so the split
          is a fixed number of DEVICE pixels. drawSlams draws inside a
          2.6x transform, where an unscaled 5px split is thirteen
          screen pixels and the design's own cap table says seven stops
          being a fringe and becomes three words.
   The leaning shadow is the difference between letters coming off the
   page and a print fault: every glyph in this file has a hard #08060c
   copy at +2,+2, and without this one the word comes apart while its
   shadow stays welded to the grid. */
function chromaText(cx, txt, x, y, mul, sc) {
    if (RT.chroma <= 0.02) return;
    var pz = fxOf('punch'), op = cx.globalCompositeOperation;
    var d = Math.round(1 + RT.chroma * T('punchSplit') * (mul == null ? 1 : mul)) / (sc || 1);
    if (d < 0.5) return;
    cx.fillStyle = '#08060c'; cx.fillText(txt, x + 2 + d * 0.45, y + 2);
    cx.globalCompositeOperation = 'lighter';
    cx.fillStyle = pz.ca; cx.fillText(txt, x - d, y);
    cx.fillStyle = pz.cb; cx.fillText(txt, x + d, y);
    cx.globalCompositeOperation = op;
}

/* The light the detonation put in the room, and the light it took out
   of it first. Two operations, no gradient built here, no smoothing
   flip, nothing allocated: partCol is the particle layer's quantised
   colour memo and this is one more consumer of it.
   Additive for the core, and that is the answer to the elite marks
   rather than a hope: addition preserves differences exactly, so it
   cannot flatten the edge of a ring that happens to be painted in the
   same colour. source-over can, and would. */
function drawBloom(cx) {
    if (RT.flash <= 0) return;
    var pz = fxOf('punch'), B = pz.fbl || FAM_BLOOM.none, f = RT.flash;
    if (B.dark > 0) { cx.fillStyle = partCol('9,6,18', B.dark * f * 0.20); fullRect(cx); }
    glowAt(cx, pz.fcol, pz.bx, pz.by, pz.bw, pz.bh, clamp(f * B.a, 0, 0.36));
}

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
        fx: {},                          // vfx: per-effect state, keyed by regFx id. See regFx.
        items: { freeSlant: 0, tack: 0, atShop: false },
        world: { cam: { x: 0, y: 0 }, npc: {}, seenLine: null, cut: {} },
        wings: { on: 0, page: '', sel: 0, root: 0, armed: '', wired: 0, fsWas: 0, held: [] }
    };
    RT.cx.imageSmoothingEnabled = false;    // people are pixels; never interpolate them
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
            board: function () { var o = {}; FAM_IDS.forEach(function (f) { var n = boardCount(f, 1); if (n) o[f] = n; }); return o; },
            /* so a harness can assert the ladder and the segment count
               rather than counting pixels. Both are read-only and
               neither is on the hot path. */
            det: function () { var d = RT.det; return d ? { fam: d.fam, kind: d.kind, total: d.total, best: d.best, wide: d.wide, t: d.t, fired: d.fired, segs: d.seg.length } : null; },
            rep: function () { var r = RT.combat.rep; return r ? { i: r.i, of: r.of, fam: r.fam, done: r.done } : null; },
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
            sprites: function () { return Object.keys(SPR).length; },   // baked figures held
            gfx: function () {                     // what the prop and floor caches are actually holding
                var fb = 0; Object.keys(FLOORS).forEach(function (k) { var f = FLOORS[k]; fb += f.cv.width * f.cv.height * 4; });
                return { sprites: Object.keys(SPRITES).length, spriteMB: +(SPRITE_BYTES / 1048576).toFixed(2),
                         spriteBudgetMB: +(SPRITE_BUDGET / 1048576).toFixed(2),
                         floors: Object.keys(FLOORS).length, floorMB: +(fb / 1048576).toFixed(2),
                         keys: Object.keys(SPRITES),
                         anchors: Object.keys(SPRITES).reduce(function (a, k) {
                             if (Object.keys(SPRITES[k].anchors).length) a[k] = SPRITES[k].anchors;
                             return a;
                         }, {}) };
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
            // Escape closes the top thing first and, with nothing left to
            // close, steps you off the stage. The game claims the key
            // unconditionally now, which costs the desktop its keyboard
            // route out of window full screen: THE MARGINS gives that back
            // as a row, and F11 and the title bar never went anywhere.
            // The wings-is-open case never reaches here. wingsKey catches
            // it in the capture phase, one element up.
            // This branch sits above the repeat guard below, so it needs its
            // own: without it, holding Escape strobes the menu open and shut
            // at the auto-repeat rate.
            if (!e.repeat) wingsEscape();
            e.stopPropagation(); e.preventDefault();
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
    /* `n`, not `dmg`. The parameter is (n, src), the file is
       'use strict', and a `dmg` here is a thrown ReferenceError from
       inside stepFoes, which kills the rAF loop on the first enemy
       hit. i-frames are checked above, so this is once per hit taken
       and never per burn tick. */
    punch({ power: n / 8, kind: 'hurt', x: RT.px, y: RT.py });
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
    /* gotoPlace does breath and winded on one line. This only did the
       first half, and the lockout does not even run down while you are
       dead: `RT.winded -= dt` lives in stepPlayer, which step() skips on
       the dead branch. So a 1.5s silence expired twice over during the
       2.2s death animation and was handed back to you intact, and you
       got up with a full bar reading WINDED and no verbs for 1.5 of
       your 1.6 invulnerable seconds. */
    RT.winded = 0;
    RT.px = pw() / 2; RT.py = ph() - 2;
    /* A teleport invalidates a click-to-move destination, which is why
       gotoPlace nulls it. Left standing, the first live frame walked you
       back toward the tile you clicked before you died, which is by
       definition the tile you were fighting on, with i-frames burning. */
    RT.moveTo = null; RT.armed = false; RT.nagged = null;
    unstick();                // the one teleport in the game that had no guard behind it. All 13 spawn points are clear today; the next place authored is not this function's problem any more
    stepCamera(0, true);      // the eye arrives with you: dying at one end of the road and getting up at the other used to pan the whole map
    RT.foes.forEach(function (f) { f.stacks.length = 0; });
    /* A lapse is the commonest way to die, so the wreckage of the lapse
       that killed you is on screen when you go down; stepFx keeps
       ageing it through the death, which is correct, but it must not
       still be there when you get up two and a fifth seconds later. */
    var p = fxOf('proj');
    p.lands.length = 0; p.sours.length = 0; p.q.n = 0; p.q.hp = 0; p.q.t = 0;
    // going down cuts the line off, the same way a doorway does: a reprise
    // must not resume after the respawn and fire its last beats into an
    // empty room, seconds after the line that started it
    if (RT.combat) { RT.combat.rep = null; RT.combat.cuts.length = 0; }
    say('Take it from the top.', 'dim');
}

/* ═══════════════ PEOPLE ═══════════════
   Everyone in this town used to be a tapered quad with a circle on
   top. No face, no hands, no clothes, and the only way to tell the
   widow from the chandler was the colour of the quad.

   They are sprites now. A sprite is rows of characters, one character
   per pixel, indexing a palette. PXS is how many screen pixels a
   sprite pixel occupies, so an adult is 16x20 authored and 32x40 on
   the canvas, which is the height the old quads were.

   Baking. Filling 320 rects per figure per frame, for a dozen figures,
   is not free, so each sprite is drawn once into an offscreen canvas
   and kept. The cache key carries the palette, so recolouring is just
   another entry. Unlike the audio rig this lives at module scope on
   purpose: sprites hold no context and no runtime state, they are
   pixels, and they are still correct after close() throws RT away.

   Palettes. NPCS already stored three colours per person and those
   still drive everything: coat, trim, skin. The rest of the ramp is
   derived, so a new person needs no new art.

   o  outline      k  coat shadow   c  coat        C  coat trim
   s  skin         S  skin shade    T  deep shade  h  hair   H  hair lit
   e  eye          w  white         b  boot        m  brass  M  brass lit
   f  cloth        n  wood          N  wood lit    r  red    g  green   */
var PXS = 2;
function pxShade(hex, f) {
    var v = hex2rgb(hex).split(',');
    function q(i) { return clamp(Math.round(+v[i] * f), 0, 255); }
    return 'rgb(' + q(0) + ',' + q(1) + ',' + q(2) + ')';
}
function pxPal(coat, trim, skin, hair, extra) {
    var p = {
        o: '#17121e',
        k: pxShade(coat, 0.62), c: coat, C: trim, L: pxShade(trim, 1.3),
        s: skin, S: pxShade(skin, 0.74), T: pxShade(skin, 0.55),
        h: hair || '#2a2028', H: pxShade(hair || '#2a2028', 1.5),
        e: '#100c14', w: '#e4dcd0', b: pxShade(coat, 0.45),
        m: '#c9a94a', M: '#ffe66e', f: '#d8c8a8',
        n: '#6a5a3a', N: '#9a8258', r: '#8a3a3a', g: '#6a7a4a'
    };
    if (extra) for (var q in extra) p[q] = extra[q];
    return p;
}
var SPR = {};
function bake(key, rows, p) {
    var c = SPR[key];
    if (c) return c;
    var h = rows.length, w = rows[0].length, i, j;
    c = document.createElement('canvas');
    c.width = w * PXS; c.height = h * PXS;
    var g = c.getContext('2d');
    for (i = 0; i < h; i++) {
        var row = rows[i];
        for (j = 0; j < row.length; j++) {
            var col = p[row.charAt(j)];
            if (!col) continue;                       // '.' and anything unmapped is air
            g.fillStyle = col;
            g.fillRect(j * PXS, i * PXS, PXS, PXS);
        }
    }
    SPR[key] = c;
    return c;
}
/* x is the centre of the figure, y is the ground under its feet.
   Both are rounded: half a pixel of drift and the whole grid softens.
   Smoothing is turned off once when the context is made rather than
   here, so this does not leave a flag flipped on a shared context. */
function blit(cx, spr, x, y) {
    cx.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height));
}

/* Rows 0-6 head, 7 neck, 8 lit shoulders, 9-11 chest with the arms on
   the silhouette edge and the hands at 11, 12 belt, 13-15 coat. The
   top of the head and the shoulders always carry the light tone: this
   town is lit by lanterns held low, and a rim on top is what keeps a
   dark figure off dark ground. */
var ADULT_TOP = [
    '......oooo......',
    '.....ohHHho.....',
    '....ohhHhhho....',
    '....ohssssho....',
    '....osesseso....',
    '....osssSsso....',
    '.....osSsso.....',
    '.....oSssSo.....',
    '..occCCCCCCcco..',
    '..okcCffffCcko..',
    '..okcCCffCCcko..',
    '..oskcCCCCckso..',
    '..okbbbmMbbbko..',
    '..okcccckcccko..',
    '..okcccckcccko..',
    '...okccccccko...'
];
/* three pairs of legs under the same body: standing, passing, mid
   stride. Those three and the bob the code already had are a walk. */
var LEGS_STAND = ['...occcooccco...', '...okkkookkko...', '...obbboobbbo...', '...oooooooooo...'];
var LEGS_PASS = ['....occoocco....', '....okkookko....', '....obboobbo....', '....oooooooo....'];
var LEGS_WIDE = ['..occcooooccco..', '..okkkooookkko..', '..obbboooobbbo..', '..ooooo..ooooo..'];
function fig(top, legs) { return top.concat(legs); }

/* Seven people, not one person in seven colours. Same frame, so the
   walk is shared; different half, the half you actually look at. */

/* Bern. Thirty years in the same part, and he loses that hat every
   single year. The brim is wide enough to lose his eyes under. */
var BERN_TOP = [
    '................',
    '.....onnnno.....',
    '....onnnnnno....',
    '..onnnnnnnnnno..',
    '....osesseso....',
    '....osssSsso....',
    '....owwwwwwo....',
    '.....owwwwo.....',
    '..occCCCCCCcco..',
    '..okcCffffCcko..',
    '..okcCCffCCcko..',
    '..oskcCCCCckso..',
    '..okbbbmMbbbko..',
    '..okcccckcccko..',
    '..okcccckcccko..',
    '...okccccccko...'
];
/* The widow. Headscarf, and nothing showing at the throat: she is not
   dressed for company, she is dressed to go out and set a lamp down. */
var WIDOW_TOP = [
    '................',
    '.....oCCCCo.....',
    '....oCCCCCCo....',
    '....oCssssCo....',
    '....osesseso....',
    '....osssSsso....',
    '....oCsSsCo.....',
    '....oCCCCCCo....',
    '..occCCCCCCcco..',
    '..okcCkkkkCcko..',
    '..okcCkkkkCcko..',
    '..oskcCkkCckso..',
    '..okbbbmMbbbko..',
    '..okcccckcccko..',
    '..okcccckcccko..',
    '...okccccccko...'
];
/* The shepherd. Flat cap down, heavy collar up. */
var SHEP_TOP = [
    '................',
    '................',
    '...onnnnnnno....',
    '..onnnnnnnnno...',
    '....ohssssho....',
    '....osesseso....',
    '....osssSsso....',
    '.....oSssSo.....',
    '..occCCCCCCcco..',
    '..okCCCffCCCko..',
    '..okcCCffCCcko..',
    '..oskcCCCCckso..',
    '..okbbbmMbbbko..',
    '..okcccckcccko..',
    '..okcccckcccko..',
    '...okccccccko...'
];
/* The busker. A band round the head and patches where the coat gave
   out. Nothing he owns matches anything else he owns. */
var BUSK_TOP = [
    '......oooo......',
    '.....ohhhho.....',
    '....ohhhhhho....',
    '....orrrrrro....',
    '....osesseso....',
    '....osssSsso....',
    '.....osSsso.....',
    '.....oSssSo.....',
    '..occCCCCCCcco..',
    '..okgCffffCcko..',
    '..okcCCffCCgko..',
    '..oskcCCCCckso..',
    '..okbbbmMbbbko..',
    '..okccggkcccko..',
    '..okcccckcggko..',
    '...okccccccko...'
];
/* Hal, at the fence, arms folded. He has stood like that all evening
   and he will be standing like that when you come back. */
var HAL_TOP = [
    '................',
    '................',
    '....okkkkkko....',
    '...okkkkkkkko...',
    '....ohssssho....',
    '....osesseso....',
    '....osssSsso....',
    '.....oSssSo.....',
    '..occCCCCCCcco..',
    '..okcCCCCCCcko..',
    '..okcCssssCcko..',
    '..okcsssssscko..',
    '..okbbbmMbbbko..',
    '..okcccckcccko..',
    '..okcccckcccko..',
    '...okccccccko...'
];
/* The chandler. The apron is the whole of the man. */
var CHAN_TOP = [
    '......oooo......',
    '.....ohHHho.....',
    '....ohhHhhho....',
    '....ohssssho....',
    '....osesseso....',
    '....osssSsso....',
    '.....osSsso.....',
    '.....oSssSo.....',
    '..occCCCCCCcco..',
    '..okcCfCCfCcko..',
    '..okcCffffCcko..',
    '..oskCffffCkso..',
    '..okbCffffCbko..',
    '..okcCffffCcko..',
    '..okcCffffCcko..',
    '...okCffffCko...'
];
/* the child, whole, because a child is not an adult with short legs */
var CHILD_SPR = [
    '................',
    '................',
    '................',
    '................',
    '.....oooo.......',
    '....ohHhho......',
    '....ohsssho.....',
    '....oseseso.....',
    '.....ossso......',
    '.....oSsSo......',
    '...occCCCcco....',
    '...oskCCCkso....',
    '....obmmbo......',
    '...okcccccko....',
    '....okcccko.....',
    '....occooco.....',
    '....okkooko.....',
    '....obboobo.....',
    '....oooooooo....',
    '................'
];
/* the audience: smaller, because they are the back of the room */
var FOLK_TOP = [
    '....oooo....',
    '...ohhhho...',
    '...oseeso...',
    '...osssso...',
    '....oSSo....',
    '..occCCcco..',
    '..okcCCcko..',
    '..okcCCcko..',
    '..oskCCkso..',
    '..okbmmbko..'
];
var FOLK_LEGS = ['..okccccko..', '..okccccko..', '..occoocco..', '..obboobbo..', '..oooooooo..'];
var FOLK_LAP = ['..okkkkkko..', '..obboobbo..', '..oooooooo..'];

/* Props live beside the person instead of being crammed into a frame
   sixteen wide. A crook is taller than a shepherd, and that is the
   point of a crook. */
var PROP_CROOK = [
    '..ooo.', '.oNNNo', 'oNo.oN', 'oN..oN', 'oNo.oN', '.oNNo.',
    '..No..', '..No..', '..No..', '..No..', '..No..', '..No..',
    '..No..', '..No..', '..No..', '..No..', '..No..', '..oo..'
];
var PROP_LAMP = ['..o..', '.omo.', 'omMmo', 'oMwMo', 'oMwMo', 'omMmo', '.ooo.'];
var PROP_LUTE = ['....oo.', '...oNo.', '...oNo.', '..oNNo.', '.oNffNo', 'oNfffNo', 'oNfffNo', '.oNNNo.'];
/* the rope at the top of its arc, wide enough to clear her and hemp
   coloured, because a bright loop over a child's head reads as a halo */
var PROP_ROPE = [
    '....NNNN....',
    '..NN....NN..',
    '.N........N.',
    'N..........N',
    'N..........N',
    '.N........N.'
];

var NPC_TOP = { bern: BERN_TOP, widow: WIDOW_TOP, shepherd: SHEP_TOP, busker: BUSK_TOP, hal: HAL_TOP, chandler: CHAN_TOP };
/* what each of them is carrying, and where it hangs off them */
var NPC_PROP = {
    shepherd: { s: PROP_CROOK, k: 'crook', dx: 13, dy: 2 },
    widow: { s: PROP_LAMP, k: 'lamp', dx: 13, dy: -12, glow: 1 },
    busker: { s: PROP_LUTE, k: 'lute', dx: -13, dy: -14 },
    child: { s: PROP_ROPE, k: 'rope', dx: 0, dy: -17 }
};
function npcPal(n) { return pxPal(n.col[0], n.col[1], n.col[2], n.hair || '#2a2028'); }

/* the actor: a young Emberwright in a tin crown, carrying a lantern
   that is the most powerful object in the world and also a prop. */
var PLAYER_TOP = [
    '....M.M..M.M....',
    '....ommmmmmo....',
    '.....ohhhho.....',
    '....ohssssho....',
    '....osesseso....',
    '....osssSsso....',
    '.....osSsso.....',
    '.....oSssSo.....',
    '..occCCCCCCcco..',
    '..okcCffffCcko..',
    '..okcCCffCCcko..',
    '..oskcCCCCckso..',
    '..okbbbmMbbbko..',
    '..okcccckcccko..',
    '..okcccckcccko..',
    '...okccccccko...'
];
var P_PLAYER = null;                 // built on first draw, so hex2rgb exists
function drawActor(cx) {
    var sx = isoX(RT.px, RT.py), sy = isoYA(RT.px, RT.py);
    var bob = RT.walking ? Math.sin(RT.t * 12) * 1.8 : Math.sin(RT.t * 2.2) * 0.7;
    var west = faceX(Math.cos(RT.face), Math.sin(RT.face));   // screen x is (x - y), see faceX
    var cast = RT.casting ? clamp(RT.casting.t / RT.casting.max, 0, 1) : 0;
    /* The three families that reach the actor, read here and written
       nowhere else in this function. -eat: `fed` is the consumer
       growing, and you should be able to look at the player and tell
       they just ate. -ill: the player's lantern is the only thing in
       the game that dims when YOU cast, and it stays dimmer than it
       left for as long as any freeze is on the board. -ark: the lamp
       does not go out, it gets COVERED. Each is one multiplier or one
       small shape, and none of them is a new pass. */
    var fed = RT.fx && RT.fx.eat ? clamp(RT.fx.eat.fed || 0, 0, 12) : 0;
    var dip = RT.fx && RT.fx.ill && RT.fx.ill.lamp > 0 ? 1 : 0;
    var hood = (RT.fx && RT.fx.ark && RT.conceal > 0) ? Math.min(RT.fx.ark.k || 0, RT.conceal / 0.55) * T('arkCloak') : 0;
    cx.save(); cx.translate(sx, sy - bob);
    if (RT.iframe > 0 && !RT.dead) cx.globalAlpha = 0.55 + Math.sin(RT.t * 26) * 0.35;
    cx.fillStyle = 'rgba(0,0,0,.45)'; cx.beginPath();
    cx.ellipse(0, bob, 10 * (1 + clamp(fed * 0.03, 0, 0.25)), 4 * (1 + clamp(fed * 0.03, 0, 0.25)), 0, 0, TAU);
    cx.fill();
    cx.scale(west, 1);
    if (RT.dead) { cx.rotate(1.2); }
    if (!P_PLAYER) P_PLAYER = pxPal('#2b2434', '#3a3048', '#d8b48c', '#241c26');
    /* the legs read the same walk the feet do: standing, passing, mid
       stride, picked off the bob that is already driving the body */
    var legs = LEGS_STAND, lk = 'S';
    if (RT.walking && !RT.dead) {
        if (Math.sin(RT.t * 12) > 0) { legs = LEGS_WIDE; lk = 'W'; } else { legs = LEGS_PASS; lk = 'P'; }
    }
    blit(cx, bake('pc' + lk, fig(PLAYER_TOP, legs), P_PLAYER), 0, 0);
    // lantern arm, rises as you cast
    var arm = lerp(0.35, -0.75, 1 - cast);
    cx.save(); cx.translate(9, -21); cx.rotate(RT.casting ? arm : 0.35);
    cx.fillStyle = '#2b2434'; cx.fillRect(0, -1.5, 8, 3);
    cx.save(); cx.translate(9, 2);
    cx.fillStyle = '#6a5a3a'; cx.fillRect(-3, -8, 6, 8);
    cx.globalCompositeOperation = 'lighter';
    var pul = 0.55 + Math.sin(RT.t * 5) * 0.16 + (RT.casting ? 0.5 : 0);
    /* the -ill dip and the -ark hood both multiply the same two
       numbers, and -eat's fed adds to the arc radius, so a player who
       has just eaten carries a bigger light and a player who has just
       said `still` carries a smaller one. */
    var lamp = (dip ? 0.55 : 1) * (1 - 0.72 * hood), lrad = 1 - 0.5 * hood;
    cx.fillStyle = 'rgba(255,190,90,' + (0.5 * pul * lamp) + ')';
    cx.beginPath(); cx.arc(0, -4, (7 + (RT.casting ? 4 : 0) + clamp(fed * 0.5, 0, 7)) * lrad, 0, TAU); cx.fill();
    cx.fillStyle = 'rgba(255,240,200,' + (0.9 * pul * lamp) + ')';
    cx.beginPath(); cx.arc(0, -4, 2.4 * lrad, 0, TAU); cx.fill();
    cx.globalCompositeOperation = 'source-over';
    /* THE HOOD, and it goes in its OWN save/restore AFTER the glow.
       crit-eng-ark #13: the design drew it "after the glow so it
       occludes it", and the glow runs under 'lighter', so a near-black
       fill under 'lighter' adds approximately nothing and paints no
       pixels you can see. At k = 1 the lantern is a black box with one
       violet line under the lid and a three-pixel ember leaking out
       below it. */
    if (hood > 0) {
        cx.save();
        cx.fillStyle = '#17121e'; cx.fillRect(-4, -9, 8, Math.round(9 * hood));
        cx.fillStyle = FAMS.ark.glow; cx.fillRect(-4, -9 + Math.round(9 * hood), 8, 1);
        cx.restore();
    }
    cx.restore(); cx.restore();
    cx.restore();
    /* the lantern throws real light on the floor. Under a conceal it
       collapses from 120px to 44 and lerps violet, and BOTH numbers
       move: crit-eng-ark #22, the gradient's radius and the arc that
       rasterises it are separate literals, so shrinking one paid a
       120px fill for a 44px gradient every frame. */
    /* Squashed to 0.62, the same as every light in drawLights. It was a
       true circle, so the one pool in the game that is always on screen
       was the one that did not lie on the ground; against the flattened
       pool the same lantern also throws through drawLights it read as
       two lights with two different ideas about where the floor is. */
    var pr = lerp(120, 44, hood);
    cx.save(); cx.globalCompositeOperation = 'lighter';
    cx.translate(sx, sy - 10); cx.scale(1, 0.62);
    var lg = cx.createRadialGradient(0, 0, 6, 0, 0, pr);
    lg.addColorStop(0, hood > 0 ? partCol(mixRgb('255,190,90', ARK_RIM || '201,161,255', hood), 0.14)
                                : 'rgba(255,190,90,.14)');
    lg.addColorStop(1, 'rgba(255,180,70,0)');
    cx.fillStyle = lg; cx.beginPath(); cx.arc(0, 0, pr, 0, TAU); cx.fill(); cx.restore();
}

/* ═══════════════ EFFECT SPINE ═══════════════
   draw() has two seams and PARALLEL allows one call per job at each.
   Eight areas of this overhaul want to draw. So they register here and
   the two calls in draw() are made once, by this block, forever.
   Registration is page-scoped and RT is not: FX lives beside RESETS at
   file scope, the mutable state lives on RT.fx, and each state is
   REBUILT from its make() rather than emptied field by field, so a
   family that later adds a sixth field cannot leave it behind a
   doorway and have the bug surface three rooms later as an effect
   anchored to a foe that died somewhere else. */
var FX = [];                        // { id, step, world, screen, make, cap, ord }
function regFx(id, step, draw, o) {
    o = o || {};
    var e = { id: id, step: step || null, world: draw || null, screen: o.screen || null,
              make: o.make || function () { return { a: [] }; },
              cap: o.cap || 192, ord: o.ord == null ? 50 : o.ord };
    /* Insertion sort on ord, not Array.sort: draw order is layering and
       two entries at the same ord must come out in registration order.
       A stable sort is only guaranteed from ES2019 and this file makes
       no assumption about the engine anywhere else either. */
    var i = FX.length;
    while (i > 0 && FX[i - 1].ord > e.ord) i--;
    FX.splice(i, 0, e);
}
/* The state for one id, made on first use. Never cache the returned
   object across a frame: the travel reset replaces it wholesale. */
function fxOf(id) {
    var f = RT.fx, i;
    if (f[id]) return f[id];
    for (i = 0; i < FX.length; i++) if (FX[i].id === id) return (f[id] = FX[i].make());
    return (f[id] = { a: [] });
}
/* Push onto a capped list. Evicts the OLDEST, the way typo() does
   (1420), not the newest, the way part() does (1385). part()'s policy
   silently starves the last foes of a per-foe loop, which is how the
   Act 3 square ends up with fifteen people detonating and ten going
   quiet. The real defence is fxBudget() before the loop; this is the
   backstop, and every family list must go through it. */
function fxPush(list, rec, cap) {
    if (list.length >= (cap || 192)) list.shift();
    list.push(rec);
    return rec;
}
/* Every stepper is handed (dt, real, state) with real ALREADY resolved,
   so no stepper writes `real = real || dt` and no stepper gets it wrong
   in the harness, where __ninth.tick calls step(dt) with one argument
   (1584) and `real` is undefined.
     dt   the sim clock. MATTER runs on this and therefore freezes
          inside a hitstop and crawls through a recital, with the body
          it is stuck to.
     real the wall clock. LETTERS run on this. A word held mid flight
          for 90ms reads as a dropped frame, and every typographic
          drawer in the file is already on real dt from draw(rdt).
   Matter freezes. Letters do not. That is the whole rule and it is the
   one RECON says nobody chose. It is chosen. */
function stepFx(dt, real) {
    real = real || dt;
    FX_T += real;                   // the sound gate's clock, and it is real. See fxSfx.
    for (var i = 0; i < FX.length; i++) if (FX[i].step) FX[i].step(dt, real, fxOf(FX[i].id));
}
function drawFx(cx, dt) {
    psaBoot(cx);                 // 4.0.2: the one measured advance, before anything in section 4 draws
    for (var i = 0; i < FX.length; i++) if (FX[i].world) FX[i].world(cx, dt, fxOf(FX[i].id));
}
function drawFxS(cx, dt) {
    for (var i = 0; i < FX.length; i++) if (FX[i].screen) FX[i].screen(cx, dt, fxOf(FX[i].id));
}

/* Module scope, and both of these are cleared together on travel: a
   stamp taken before the clock restarted is a stamp in the future and
   it locks its name out forever. FX_T is REAL seconds, not RT.t.
   design-deton-4 gated on RT.t, and under a recital 0.26 real seconds
   is 0.078 sim seconds, so a per line Verse sound would be swallowed
   twenty-one times out of twenty-eight (design-deton-5, "Not shared").
   A gate whose window changes length when time thickens is not a gate. */
var FX_T = 0, FX_SFX = {};
function fxSfx(name, gap) {
    var o = FX_SFX[name];
    if (o != null && o <= FX_T && FX_T - o < (gap || 0.12)) return 0;
    FX_SFX[name] = FX_T; sfx(name); return 1;
}

/* THE SATURATING ONE. How loud. Knee at three or four, where the loop
   actually lives; twelve is the loudest the game ever gets and
   twenty-five is the same loud, because the ending detonates on the
   whole square and the screen has to survive it. */
function fxP(n) { n = Math.max(0, n || 0); return clamp(n / (n + 7) * 1.6, 0, 1); }

/* THE SIZE ONE. Square root, because a pile of twelve is not twelve
   times the picture of a pile of one, and because size reads as area.
   Starts at exactly 1 so a single stack is full sized and legible
   rather than a speck: the smallest close in the game is still a close.
   Anything that multiplies a radius or a font size uses THIS one. */
function fxS(n) { return clamp(1 + 0.62 * (Math.sqrt(Math.max(1, n || 1)) - 1), 1, 2.6); }

/* THE THINNING ONE. The more bodies took it, the less each is allowed
   to emit, so twenty-five sources read as one event rather than as
   twenty-five. Floors at a third: below that the folk in the square
   stop registering as sources at all and the ending loses its point. */
function fxW(wide) { return wide <= 1 ? 1 : clamp(1 - (wide - 1) * 0.055, 0.34, 1); }

/* Divide the budget BEFORE the loop, never inside it. part() drops
   silently past 900 (1385) and fxPush evicts the oldest, so a loop
   that emits its full wish per foe does not fail loudly, it quietly
   gives the last nine people in the square nothing.
   Two guards the original did not have. `cap || 96` turned a cap of
   zero into ninety-six, so the one documented performance escape hatch
   in the whole overhaul gave MORE matter when you switched it off; and
   the Math.max(1,...) floor made zero unreachable even when it did
   not. Zero is now a supported answer and every caller must handle it,
   which is one `if (!per) continue;` at the top of the emit loop. */
function fxBudget(want, wide, cap) {
    cap = cap == null ? 96 : cap;
    if (cap <= 0) return 0;
    return Math.max(1, Math.min(want, Math.floor(cap / Math.max(1, wide))));
}

/* How tall this thing actually is. drawFoe has computed this inline at
   3488 since the sprites landed and nobody else could reach it, which
   is why snapStacks has been drawing 104 pixels below the Chorus's
   stack row for as long as the Chorus has existed. One function, one
   truth, and drawFoe calls it too. FOE_H gains its missing `chorus`
   row in the same edit so the boss branch is a belt and not the only
   thing holding the Chorus up. */
function foeH(f) { return f.def.boss ? 130 : (FOE_H[f.def.draw] || 30); }

/* Where the rhyme stacks are ACTUALLY drawn (3526). Every effect that
   wants to start at a syllable starts here and none of them may guess
   again: not detGather, not snapStacks, not -proj's pip row, not the
   haul, not the Reprise underline. f.so is the row's own per foe nudge
   (3012). This helper existed in design-deton-3 and its own author
   open-coded the expression at both of his call sites, which is
   exactly how the 104 pixels happened the first time. */
function foeStackY(f) { return isoYA(f.x, f.y) - foeH(f) - 18 - (f.so || 0); }

/* A world heading is not a screen heading. isoX is (x-y)*29 and isoY
   is (x+y)*14.5, so a world angle of 0 leaves at 26.6 degrees on
   screen and a world angle of PI/4 leaves at 90. Four designs point a
   chevron, a jaw, a needle and a downbeat along the raw world angle
   and are up to 63 degrees out, while the spray() beside them is
   correct because it writes world velocities. Compute both once at
   launch: keep the world angle for the physics and use this for
   anything drawn.
   Inside a `translate(sx, sy); scale(1, 0.5)` ground frame the answer
   is simply a + PI/4, because the iso basis IS a 45 degree rotation;
   this function is for the unsquashed case. */
function isoAng(a) {
    return Math.atan2((Math.sin(a) + Math.cos(a)) * TILE_H / 2,
                      (Math.cos(a) - Math.sin(a)) * TILE_W / 2);
}

/* A screen-space pass that has to sit on a world point must apply the
   two transforms it is drawn outside of. drawFx runs inside the shake
   and inside the zoom; drawFxS runs outside both. So a syllable whose
   origin is a body, drawn at the screen seam, detaches from that body
   by up to 22 pixels on exactly the frame the room takes the hit: 7px
   of shake plus 15px of zoom displacement at 250px from the anchor.
   That is the frame the design most wants them glued.
   pz.ox / pz.oy are the frame's shake offset, computed once in
   stepPunch off the same phase punchShakeXY uses, so the two cannot
   disagree. */
function punchWX(sx) { var p = fxOf('punch'); return p.ax + (sx - p.ax) * p.z + p.ox; }
function punchWY(sy) { var p = fxOf('punch'); return p.ay + (sy - p.ay) * p.z + p.oy; }

/* pxShade (1822) returns 'rgb(r,g,b)' and hex2rgb (2859) returns
   '200,200,200' for anything that does not start with a #, so
   hex2rgb(pxShade(col, 0.42)) is a silent grey. That composition is
   written out in crit-art-punch as the fix for the chroma table and it
   does not work. This is the same arithmetic returning the triple the
   rest of the file actually passes around. */
function rgbMul(hex, f) {
    var v = hex2rgb(hex).split(',');
    return clamp(Math.round(+v[0] * f), 0, 255) + ',' +
           clamp(Math.round(+v[1] * f), 0, 255) + ',' +
           clamp(Math.round(+v[2] * f), 0, 255);
}

/* The per family paint cache. Every one of the five family branches
   was about to build 'rgba(' + hex2rgb(FAMS[fam].col) + ',...)' inside
   a draw loop. Lazy, because FAMS is above it but the table costs
   nothing to defer, and adding a key is one line. */
var FAMPX = null;
function fampx() {
    if (FAMPX) return FAMPX;
    FAMPX = {};
    for (var i = 0; i < FAM_IDS.length; i++) {
        var id = FAM_IDS[i], F = FAMS[id], rgb = hex2rgb(F.col), g = hex2rgb(F.glow);
        FAMPX[id] = { id: id, rgb: rgb, grgb: g, col: F.col, glow: F.glow, tag: F.tag,
            tag3: F.tag.slice(0, 3),                 // the row's glyph, sliced once, not per cell per frame
            dark: rgbMul(F.col, 0.42),               // the same hue at the palette's dark end
            edge: 'rgba(' + rgb + ',.55)',
            wash: 'rgba(' + rgb + ',.22)',
            badge: 'rgba(' + rgb + ',.90)' };
    }
    return FAMPX;
}

/* A memoised colour lerp returning an 'r,g,b' triple. The drag turns
   one sound into another in mid air, the burn cools, the conceal
   recedes: all three want a colour that changes over time and none of
   them may build a string per frame to get it. Twelve steps, because
   nobody has ever seen the thirteenth. */
var MIXC = {}, MIXC_N = 0;
function mixRgb(a, b, k) {
    var q = Math.round(clamp(k, 0, 1) * 12), key = a + '>' + b + '@' + q, v = MIXC[key];
    if (v) return v;
    var A = a.split(','), B = b.split(','), t = q / 12;
    v = Math.round(lerp(+A[0], +B[0], t)) + ',' +
        Math.round(lerp(+A[1], +B[1], t)) + ',' +
        Math.round(lerp(+A[2], +B[2], t));
    if (++MIXC_N > 4096) { MIXC = {}; MIXC_N = 1; }   // the key space is bounded; the memo is bounded too
    MIXC[key] = v;
    return v;
}

/* ─────────────── the detonation ───────────────
   Section 4 of the blueprint, in the order 5.3 gives: the rhyme split
   and the one measured advance, then the outcome table, then the entry
   point, then the gather, then the clock and the four pure readers,
   then the drawers. Nothing here runs at load. */

/* THE RHYME, SPLIT. Every castable word ends in its family's tag
   (FAMS at 142: eat/street/heat/wheat, dark/mark/spark/stark) and
   nothing in eight thousand lines has ever drawn that. Twenty words in
   the whole game, so the split is memoised at first use and never
   computed again.
   The head may be empty: 'EAT' is all tail, which is correct. A word
   that does not end in its own tag is all head, which is the correct
   rendering of a word that does not rhyme. */
var RIME = {};
function rimeCut(w, fam) {
    var k = w + '|' + fam, v = RIME[k], tg;
    if (v) return v;
    tg = FAMS[fam] ? FAMS[fam].tag : '';
    v = (tg && w.length > tg.length && w.slice(-tg.length) === tg)
        ? { hd: w.slice(0, -tg.length), tl: tg }
        : { hd: w, tl: '' };
    return (RIME[k] = v);
}
/* Draw one word head dim, tail bright, centred as a whole, with the
   house shadow. cx.font is the CALLER's: this is called from six
   places at six sizes and it must not set it.
   px is passed because the halves are placed by advance and Press
   Start 2P is a fixed pitch font (4.0.2), so no measureText happens
   here and none happens per frame anywhere in this section.
   `dim` overrides both tones with one colour, which is what a slant,
   a fizz and a sour piece all want: a word that stopped rhyming. */
function rimeText(cx, w, x, y, P, px, dim) {
    var c = rimeCut(w, P.id), adv = px * PSA, x0;
    cx.textAlign = 'left';
    x0 = Math.round(x - w.length * adv / 2);          // the caller means centred; we place by advance
    cx.fillStyle = '#08060c';
    cx.fillText(w, x0 + 1, y + 1);                    // one shadow for the whole word, not two
    cx.fillStyle = dim || P.col;
    if (c.hd) cx.fillText(c.hd, x0, y);
    if (c.tl) {
        cx.fillStyle = dim || P.glow;
        cx.fillText(c.tl, x0 + Math.round(c.hd.length * adv), y);
    }
    cx.textAlign = 'center';
}
/* A word with nothing behind it: four offset copies in the family's
   col and no fill. The same rim -ark's word uses, at the one moment
   every family needs it. */
function rimeHollow(cx, w, x, y, P, px) {
    cx.fillStyle = P.col;
    cx.textAlign = 'center';
    cx.fillText(w, x - 1, y); cx.fillText(w, x + 1, y);
    cx.fillText(w, x, y - 1); cx.fillText(w, x, y + 1);
    cx.fillStyle = '#08060c'; cx.fillText(w, x, y);
}

/* The advance of one character of Press Start 2P as a share of the
   font size. Measured, not assumed, because it is a webfont (comp.css
   17) and the first draw() of a cold session very often measures the
   monospace fallback: design-proj's PIP_TAGW was measured once on
   frame one, cached for the session, and survived close() because it
   is module scope. Two consecutive agreeing measurements is the whole
   guard. It costs one measureText per frame for the two or three
   frames before the font arrives and then never again.
   1 is the right fallback: the font is square, and if the guard never
   settles then every width in this section is out by the same factor
   and the layout is still internally consistent. */
var PSA = 1, PSA_N = 0;
function psaBoot(cx) {
    if (PSA_N > 1) return;
    cx.save();
    cx.font = 'bold 40px "Press Start 2P", monospace';
    var w = cx.measureText('MMMM').width / 160;
    cx.restore();
    if (!(w > 0.2 && w < 3)) return;                  // a broken metric is not a measurement
    PSA_N = (Math.abs(w - PSA) < 0.001) ? PSA_N + 1 : 0;
    PSA = w;
}

/* HOW A DETONATION ENDS. Nine rows, one dispatch, and the failure
   paths are rows and not branches on purpose: a slant has to be the
   SAME event as a close with exactly one thing wrong about it, or the
   player never learns which thing. Read down the columns and the whole
   difference between saying it right and saying it nearly right is
   eight numbers.
     punch  the PUNCH_KIND row forwarded at TSET (2.7)
     slam   does the tag word slam. The Reprise slams once at doReprise
            and must not slam again on every beat
     rule   fraction of full length the rule strikes to
     caps   end caps. A rule without them has not finished
     brk    the rule breaks at the centre one frame after it strikes
     miss   the words land off the baseline instead of on it
     lit    the words keep their colour and their halo
   There is no `beat` row: design-deton-3 wrote one, design-deton-4
   superseded it with rep1/rep2/rep3 before anything called it, and a
   dead row in the table the whole section dispatches through reads as
   a live one (crit-eng-deton N12). */
var DET_KIND = {
    close: { punch: 'close', slam: 1, tap: 1, rule: 1.00, caps: 1, brk: 0, miss: 0, lit: 1 },
    drag:  { punch: 'drag',  slam: 1, tap: 1, rule: 0.80, caps: 1, brk: 0, miss: 0, lit: 1 },
    slant: { punch: 'slant', slam: 1, tap: 1, rule: 0.60, caps: 0, brk: 1, miss: 1, lit: 0 },
    wave:  { punch: 'wave',  slam: 0, tap: 0, rule: 1.00, caps: 1, brk: 0, miss: 0, lit: 1 },
    verse: { punch: 'close', slam: 0, tap: 0, rule: 1.00, caps: 1, brk: 0, miss: 0, lit: 1 },
    /* THE LANDING: the fourth line of a stanza and the last pulse of
       the Verse. It IS a closed rhyme, it is the line that answers
       line two, and it is ABSENT FROM DET_AUTO, so the one wave that
       has to be the loudest is the one wave the repeat gate leaves
       alone. One row and one absence rather than an exemption flag
       nobody can find later. */
    land:  { punch: 'close', slam: 0, tap: 0, rule: 1.00, caps: 1, brk: 0, miss: 0, lit: 1 },
    /* the Reprise ladder. rep1 and rep2 punch on the beat row and rep3
       on close: the third time, the room saying your line with you
       hits as hard as saying it yourself did. */
    rep1:  { punch: 'beat',  slam: 0, tap: 0, rule: 1.00, caps: 1, brk: 0, miss: 0, lit: 1 },
    rep2:  { punch: 'beat',  slam: 0, tap: 0, rule: 1.00, caps: 1, brk: 0, miss: 0, lit: 1 },
    rep3:  { punch: 'close', slam: 0, tap: 0, rule: 1.00, caps: 1, brk: 0, miss: 0, lit: 1 }
};
/* Five families, five registrations, one dispatch. famEffect's five
   branches at 2821-2840 stay one line each and keep owning the
   mechanic; the visual is not theirs and never was. */
var FAM_DET = {};
function regDet(fam, fn) { FAM_DET[fam] = fn || null; }

/* THE REPEAT GATE. A body cannot be detonated on twice in half a
   second and get the whole picture twice. The Reprise hits every
   stacked foe three times 0.34s apart with the same sound, a recital's
   four waves overlap, and the second and third of those are the room
   repeating itself rather than new events. Four critiques found this
   hole independently and each proposed its own per family fix
   (crit-eng-eat 210 = 912 crumbs against a 900 cap, crit-eng-ight 65,
   crit-eng-erd 128, crit-eng-ill 214): five fixes, five windows, five
   chances to forget one. This is one fix, in the spine, through the
   obligation all five already have, which is to multiply their counts
   by d.th.
   SIM clock, because that is the clock repriseGap is counted on: under
   RT.dilate the beats stretch and the window has to stretch with it
   or the gate quietly stops gating.
   Player actions are never gated. A close 0.34s after a close is the
   player getting a second pile up and spending it, which is the best
   thing that happens in this game. */
var DET_AGAIN = 0.5;                 // sim seconds
var DET_AGAIN_TH = 0.18;             // what a repeat may emit, as a share of th
var DET_AUTO = { rep1: 1, rep2: 1, rep3: 1, wave: 1, verse: 1 };

/* THE ENTRY POINT. One detonation, N sources.
     fam    the sound that closed
     hits   [{ f, n, dead, took, was, cells }], one per body that heard it
              f      the foe. Read here and NEVER stored past this call
              n      syllables spent on it
              dead   1 if it died to this
              took   1 if the sound closed on it, 0 for a slant or a drag
              was    the sound its stacks used to be, for the drag
              cells  a copy of the row taken BEFORE the row was spent
     kind   a row of DET_KIND
   Called ONCE per player action, after the loop that built hits, never
   from inside it. Firing inside the loop is what the file does today
   and it is wrong four ways: the centroid is still accumulating, so
   foe one aims at foe one and foe eight aims at the average; the foe
   count is not known, so emission cannot be scaled down before it
   starts and part() drops the tail in silence; famEffect runs on
   corpses, because doRhyme has no !f.dead guard where stanzaWave has
   one; and twenty-five bodies firing separately is twenty-five events,
   which the thesis forbids. */
function detonate(fam, hits, kind) {
    if (!RT || !hits || !hits.length) return null;
    var K = DET_KIND[kind] || DET_KIND.close, auto = DET_AUTO[kind] ? 1 : 0;
    var total = 0, best = 0, wide = hits.length, ax = 0, ay = 0, i, h, g, sx;
    var lo = 1e9, hi = -1e9;
    for (i = 0; i < wide; i++) {
        h = hits[i];
        total += h.n; if (h.n > best) best = h.n;
        ax += h.f.x; ay += h.f.y;
        /* the screen spread, for the arc. crit-art-deton's caveat is
           right: a sign flip keyed on `wide` gives three foes stacked
           in a doorway the wide treatment and two foes at opposite
           ends of the mill the tall one. It has to key off the thing
           the eye is measuring, and that is one min and one max in a
           loop that is already running. */
        sx = isoX(h.f.x, h.f.y); if (sx < lo) lo = sx; if (sx > hi) hi = sx;
        /* the repeat gate, per hit, stamped only when this kind is
           automatic. A player close 0.34s before beat one of a Reprise
           used to poison the beat the close paid for, because Echo is
           earned by closing rhymes (crit-eng-deton N13). */
        g = h.f.detG || (h.f.detG = {});
        h.again = (auto && g[fam] != null && g[fam] > RT.t - DET_AGAIN) ? 1 : 0;
        if (auto) g[fam] = RT.t;
    }
    ax /= wide; ay /= wide;
    /* Outward from the middle of what closed. Sorted by screen x this
       is a wipe and reads as a sequence; sorted by distance from the
       centroid it is a ripple with a shape and reads as one thing.
       Squared distance, because Math.hypot inside a sort over
       twenty-five entries is twenty-five square roots for an ordering
       that does not need them. */
    hits.sort(function (a, b) {
        var adx = a.f.x - ax, ady = a.f.y - ay, bdx = b.f.x - ax, bdy = b.f.y - ay;
        return (adx * adx + ady * ady) - (bdx * bdx + bdy * bdy);
    });
    var d = RT.det = {
        fam: fam, kind: kind || 'close', K: K,
        total: total, best: best, wide: wide,
        x: ax, y: ay,                        // hitAt: the centroid of what actually closed
        p: fxP(total), pb: fxP(best), sc: fxS(best), th: fxW(wide), th0: fxW(wide),
        tall: (hi - lo) < 260 ? 1 : 0,       // over the top, or along the floor
        t: 0, i: 0, dead: 0, folk: 0, again: 0,
        /* Every duration in the detonation, frozen here, in real
           seconds from T0, each read ONCE from TUNE: a slider dragged
           mid flight must not deform a detonation that is already in
           the air, which is the failure crit-eng-ill 308 describes.
           The next keypress picks the new value up. This is also
           crit-eng-deton B9 applied: design-deton-6 specified nine
           tunables and printed nine FEEL rows against code that
           hardcoded all nine, which is nine sliders that save forever
           and change nothing. */
        fly: 0, tset: 0, hold: 0, out: 0, life: 0,
        stag: Math.min(0.018, T('detSpread') / wide),
        halo: 0.22 + T('detHalo') * fxP(total),
        fired: 0, cpl: 0, rt: null, rtT: -1,
        ws: null, fl: null, tears: null, rule: null, seg: null
    };
    /* crit-art-deton 26: FLY ran 0.118s at one stack and 0.177s at
       eight, so the small-against-large difference the timeline lists
       as one of its three felt scaling axes was 59 milliseconds, which
       nobody can feel, and the floor made the commonest close in the
       game feel laggy rather than heavy. 0.06 + 0.13p is 86ms at one
       and 190ms at twelve: a snap and a throw, a ratio of 2.2 to 1,
       which is about the smallest ratio a person reliably reads. */
    d.fly = T('detFly') + 0.13 * d.p;
    d.tset = 0.035 + d.fly;
    d.hold = T('detHold') + 0.16 * d.p;
    d.out = T('detOut') + 0.12 * d.p;
    for (i = 0; i < wide; i++) hits[i].th = hits[i].again ? d.th0 * DET_AGAIN_TH : d.th0;
    /* The acknowledgement, and nothing more. A hundred and eighty-seven
       milliseconds is a long time to wait for a keypress to mean
       something, and the thesis forbids the room getting any louder
       yet: tap is zero stop, zero zoom, two pixels of movement, capped
       at 5. Anchored at the PLAYER, because this beat is the mouth
       opening. Every later beat is anchored at the line. */
    if (K.tap) punch({ fam: fam, power: best, kind: 'tap', x: RT.px, y: RT.py });
    detGather(d, hits);                  // tears, flyers, slots, segments, rule, life
    var det = FAM_DET[fam];
    for (i = 0; i < wide; i++) {
        h = hits[i]; d.i = i; d.th = h.th; d.again = h.again;
        /* Corpses get the visual and only the visual. A body that burst
           on this frame (3424) is spliced out of RT.foes on the next
           stepFoes (3068) and drawFoe is never called for it again, so
           a family effect that draws THROUGH the foe must check d.dead
           and draw its matter free standing instead. It must not set
           status on it and it must not heal off it twice. A foe dying
           to the rhyme still gives up the syllable it was holding:
           swallow that and the rule comes up short and the biggest
           closes look like the smallest. */
        d.dead = h.dead ? 1 : 0;
        d.folk = h.f.def.folk ? 1 : 0;
        /* The row as it was BEFORE doRhyme spent it. Everything in here
           runs at TSET, which is a fifth of a second after the keypress
           that emptied f.stacks, so a family reading f.stacks.length to
           find out how much it just closed reads whatever is LEFT, and
           on a clean close that is zero. -ark's un-print struck through
           a row of nothing for exactly that reason. detCells already
           makes this copy for the tear; this is the line that hands it
           to the families as well. */
        d.cells = h.cells || null;
        if (det) det(h.f, h.n, d);
    }
    /* Put every per hit field back. Four of them are otherwise left
       holding the last source's values, and a family stepper that
       reads d.th one frame later gets 0.18 on a repeat and draws
       almost nothing (crit-eng-deton B15, design-deton-6 risk 3).
       `d` is read-only to families and this is the line that makes
       that promise true. */
    d.i = 0; d.th = d.th0; d.dead = 0; d.folk = 0; d.again = 0; d.cells = null;
    return d;
}

/* The money shot. Everything on the board flies in from where it was
   stuck and sets itself into one line across the middle of the screen.
   Scattered words becoming a line is the whole idea of the game, so it
   should be the thing you see.
   Layout only: measured once, here, and never again. Every width is
   `characters * px * PSA` because Press Start 2P is fixed pitch
   (4.0.2), which removes the eighty-four measureText calls the old fit
   loop could run and makes the head/tail split free.
   The FILTER LOSES `w.fam === fam`. Files 1 and 2 could be read two
   ways: "collected exactly as assembleLine already collects them" and
   "each word carries its own family colour". Line 2678 is
   `if (!w.cut && w.fam === fam)`, which can only ever produce one
   colour. The mixed line wins, because several sounds and one ending
   is the picture of a line and it is the argument the game is making;
   4.0.1's head/tail split is what stops it being a rainbow. */
function assembleLine(d) {
    var ws = [], last = (RT.poem && RT.poem.lines.length)
                        ? RT.poem.lines[RT.poem.lines.length - 1] : null;
    (last ? last.ws : []).forEach(function (w) {
        if (!w.cut) ws.push({ w: w.w.toUpperCase(), fam: (w.fam && FAMS[w.fam]) ? w.fam : d.fam });
    });
    if (!ws.length) ws.push({ w: FAMS[d.fam].tag, fam: d.fam });
    ws = ws.slice(-6);                       // the end of a line is the part that rhymed
    var px = Math.round(T('detWord') + 9 * d.p), gap = 0, tot = 0, i, ch = 0;
    for (i = 0; i < ws.length; i++) ch += ws[i].w.length;
    /* Six words at 30px measure about 1020 against a 1120 canvas and
       this file has no wrapping anywhere, so a big close could run off
       both edges at once. Solved in closed form instead of by fifteen
       re-measuring passes: the whole run is ch*px*PSA + (n-1)*gap and
       gap is 1.05*px, so the largest px that fits is one divide.
       Floor 16, below which it stops being the loudest object on
       screen and the detonation has failed anyway. */
    var room = VW - 120, denom = ch * PSA + (ws.length - 1) * 1.05;
    if (denom > 0 && px * denom > room) px = Math.max(16, Math.floor(room / denom));
    gap = Math.round(px * 1.05);
    for (i = 0; i < ws.length; i++) {
        ws[i].wd = Math.round(ws[i].w.length * px * PSA);
        tot += ws[i].wd + gap;
    }
    tot -= gap;
    var x = Math.round(VW / 2 - tot / 2);
    /* THE KERNING SNAP. Slots computed once and rounded, so a word can
       never land between two pixels and the line can never reflow
       under its own rule. */
    for (i = 0; i < ws.length; i++) { ws[i].sx = x + Math.round(ws[i].wd / 2); x += ws[i].wd + gap; }
    d.ws = ws; d.wordPx = px; d.gap = gap; d.half = Math.round(tot / 2);
    /* WHERE IT LANDS. VH*0.30, and slam is at VH*0.62 (2.8), so the
       composition down the screen is line, rule, notches, tag, sub,
       and nothing overlaps. design-deton-2 wanted the tag word to
       blast up THROUGH the line at its 2.6x opening scale and called
       it designed rather than tolerated; crit-art-deton 9 did the
       arithmetic and found every punctuation mark in the design firing
       underneath a 161px word. The one thing legible on that frame was
       the tag, which is the one thing that needed no help.
       96 when the screen is already carrying a loud line. drawLines
       puts unpinned line i at VH*0.3 + i*44 (1489), which is exactly
       here. design-deton-5 guarded on RT.recital only, which left the
       Reprise printing `again` and your line on the same row of pixels
       for two seconds and left the Verse's rule pinned under whichever
       of six live lines happened to be at index 0 (crit-eng-deton B8,
       B4). The guard is "is a loud line alive", which is the true
       question. */
    d.lineY = (RT.recital || RT.verseCast || hasLoudLine()) ? 96 : Math.round(VH * 0.30);
    d.ruleY = d.lineY + 13;
    return ws;
}
/* RT.lines is never longer than about six and this runs once per
   keypress. `pin` is the held story cue, which sits at its own y. */
function hasLoudLine() {
    for (var i = 0; i < RT.lines.length; i++) if (!RT.lines[i].pin) return 1;
    return 0;
}

/* THE SEGMENTS. Called at the end of detGather and again by any post
   dressing that moves rule.half (repDress, dressStanza), because the
   layout is a pure function of half and of the hits' own n.
   Order along the rule is SCREEN X, so the leftmost body owns the
   leftmost piece and a kill upright stands over the place its body
   stood. detonate's own sort is centre-outward and stays that way: one
   is timing, the other is space, and they are different questions.
   The x assignment is detSegLay's, so the Reprise and the recital can
   move rule.half after `hits` has gone out of scope and re-lay the
   pieces without it. */
function detSegs(d, hits) {
    var i, n = d.wide, ord = [], seg = [];
    for (i = 0; i < n; i++) ord.push({ i: i, sx: isoX(hits[i].f.x, hits[i].f.y), n: hits[i].n });
    ord.sort(function (a, b) { return a.sx - b.sx; });
    for (i = 0; i < n; i++) seg[ord[i].i] = { o: i, n: ord[i].n, got: 0, kill: 0, perN: 0 };
    d.seg = seg;
    /* how many flyers this body actually sent, counted once, because
       detRule reads got/perN every frame and must not divide by the
       whole board's flyer count. */
    for (i = 0; i < d.fl.length; i++) seg[d.fl[i].hi].perN++;
    detSegLay(d);
}
/* Lay the segments out across the current rule.half. Pure, idempotent,
   and it reads only what is already on d, so repDress and dressStanza
   can move the rule and call this alone. `o` is the left-to-right rank
   computed once by detSegs; `n` is the body's own pile. */
function detSegLay(d) {
    var seg = d.seg, i, k, run, tot = Math.max(1, d.total), n = seg.length;
    var full = d.rule.half * 2, body = Math.max(n * 6, full - (n - 1));
    var by = [];
    for (i = 0; i < n; i++) by[seg[i].o] = seg[i];
    run = Math.round(VW / 2 - full / 2);
    d.segL = run;
    for (k = 0; k < n; k++) {
        by[k].w = Math.max(6, Math.round(body * by[k].n / tot));
        by[k].x = run; by[k].mid = run + Math.round(by[k].w / 2);
        run += by[k].w + 1;
    }
    /* the true right edge after rounding, so the end cap, the couplet
       bracket and the notches all agree with the pixels rather than
       with the arithmetic. */
    d.segR = run - 1;
}

/* Everything that leaves a body, built once, at T0, with the whole
   detonation already known.
   Nothing here stores f. Every source is world tiles plus a head
   height, re-projected each frame, so a syllable stays glued to the
   place it was said while the camera pans off it. */
function detGather(d, hits) {
    var i, j, h, n, per, rel, fl = [], tears = [], byWord = {};
    var P = fampx()[d.fam], cap = T('detFlyMax');
    assembleLine(d);
    for (i = 0; i < d.wide; i++) {
        h = hits[i]; n = h.n;
        /* the row's real position, through the one helper (2.3). Not
           the literal -44 drawSnaps has used since it was written,
           which is a hundred and four pixels wrong on the Chorus. */
        h.wx = h.f.x; h.wy = h.f.y; h.wh = foeH(h.f) + 18 + (h.f.so || 0);
        h.t0 = i * d.stag;
        h.th = h.th == null ? d.th0 : h.th;
        /* THE TEAR, and only for a body that actually spent something.
           design-deton-3 pushed one per hit unconditionally and file 4
           then drew the haul over the same cells at the same y, so for
           45ms every slant and every drag drew the row twice at
           fractional offsets, which is exactly the smear the whole
           design exists to avoid and was the only thing on screen for
           a slant (crit-eng-deton B6). A spent row lifts; a row that
           was not spent belongs to the haul and does not move.
           The cells carry `t` pre-sliced and `dr` for a Droner's grey,
           because the tear is where the row is most legible and the
           grey is the one piece of information in it that says you did
           not put this here (crit-eng-deton N11, N5). */
        if (h.took) tears.push({ wx: h.wx, wy: h.wy, wh: h.wh, cells: h.cells || [],
                                 t0: h.t0, col: P.col });
        snapStacks(h.f, h.took ? P.col : '#6a5f72', n, d.fam, h.th);
        /* THE FLYERS. fxBudget divides before the loop, so twenty-five
           folk send one each and one elite holding eight sends eight,
           and a cap of 0 is a supported look that now actually
           produces zero (2.3). */
        per = fxBudget(n, d.wide, cap);
        rel = Math.min(0.014, 0.10 / Math.max(1, n));
        for (j = 0; j < per; j++) fl.push(detFlyer(d, h, i, j, per, rel));
        /* which words this body was carrying, for 4.2.1 */
        for (j = 0; j < (h.cells || []).length; j++) {
            var cw = h.cells[j].w;
            if (cw && byWord[cw] == null) byWord[cw] = i;
        }
    }
    d.tears = tears;
    d.fl = fl;
    /* THE RULE. Not decoration and not drawn from a number: built out
       of the syllables that arrive, one at a time, and its length is a
       readout of total that nobody has to be told about. */
    d.rule = {
        half: d.half + Math.min(Math.round(6 + T('detRuleOver') * d.total), 190),
        w: clamp(2 + Math.floor(d.total / 5), 2, 6),
        cap: 4 + Math.round(3 * d.p)
    };
    detSegs(d, hits);
    /* THE WORDS. Word i starts at the head of the body that actually
       said it, and at i % wide only when nobody did. */
    for (i = 0; i < d.ws.length; i++) {
        var owner = byWord[d.ws[i].w];
        detWordPath(d, d.ws[i], hits[owner == null ? (i % d.wide) : owner], i);
    }
    /* THE COUPLET, knowable without storing anything new. poemBreak
       has already run by the time detonate is called, so the line
       before the one we just ended is lines[len-2] and its `end` field
       is the sound that closed it. Two lines held together by a sound
       is a couplet and this is the only place in the game that can see
       one. */
    var L = RT.poem ? RT.poem.lines : null;
    d.cpl = (L && L.length >= 2 && L[L.length - 2].end === d.fam && !d.K.miss) ? 1 : 0;
    /* WHEN IT IS OVER, computed rather than guessed, so a twenty-five
       folk close cannot outlive its own record. This line lived
       outside detGather's closing brace in design-deton-3 and was
       therefore never executed: d.life stayed 0, stepDet nulled
       RT.det on the first tick, and every rhyme in the game drew one
       frame of flyers and nothing else. It was the single most likely
       way the branch shipped broken (crit-eng-deton B1). */
    d.life = d.tset + d.hold + d.out + 0.10 + d.rule.half / 900 + 0.08;
    fxSfx('tear', 0.06);
}

/* THE FLYER: a whole syllable, not a letter. design-deton-2 sent
   tag.charAt(j % tag.length), so eight stacks off one elite released
   E A T E A T E A, which spells nothing, and forty-eight of them
   converging is alphabet soup. A rhyme stack is one syllable of a
   sound; `E` is not a syllable, and the one object in the game whose
   entire identity is a sound lost that identity at the exact moment it
   became the star of the effect (crit-art-deton 3).
   So it is the tag, whole, at the size the row wore it, growing with
   the pile: round(8 * fxS(n)) is 8px at one syllable, 13 at four, 17
   at eight. fxS and not fxP, because file 1's own rule is that
   anything multiplying a font size uses the size curve and nothing
   else in eight documents may hold a Math.sqrt (crit-art-deton 29).
   The font string is built HERE and stored, because px is frozen at T0
   and takes seven distinct values in the whole game, and building it
   in the drawer is forty-six string allocations a frame
   (design-deton-6, guard 3). */
function detFlyer(d, h, hi, j, per, rel) {
    var pf = fxS(h.n), px = Math.round(8 * pf), P = fampx()[d.fam];
    return {
        txt: P.tag, px: px, hi: hi,
        font: 'bold ' + px + 'px "Press Start 2P", monospace',
        /* peels off the cell it was actually sitting in: drawStacks
           packs the row at PIP_W a cell, centred, and this is that
           layout read back out. */
        ox: (j - (Math.max(1, per) - 1) / 2) * PIP_W,
        wx: h.wx, wy: h.wy, wh: h.wh,
        /* h.t0 so the syllables leave the middle of the room first and
           the edge of it last, and j * rel so a pile of eight peels
           off ONE body one at a time over 98ms. The second one is most
           of the difference between a pop and an event and it costs
           one multiply. design-deton-2's table said min(0.10,
           0.014*(n-1)) and design-deton-3 implemented min(0.014,
           0.10/n); they agree to n = 7 and diverge above it
           (crit-eng-deton N3). The implemented one wins: it is a
           per-flyer gap rather than a total, so it cannot make the
           last flyer of a huge pile land after the rule has closed. */
        t0: h.t0 + j * rel,
        col: h.took ? P.col : '#6a5f72',
        glow: h.took ? P.glow : '#6a5f72',
        /* THE DRAG, and it is the whole mechanic in one frame: the
           flyer leaves in the colour of the sound it used to be and
           changes, hard, at 60% of travel. Six green syllables and two
           violet ones set out and eight violet ones arrive. Today this
           is a grey 2px line that shrinks. */
        was: (h.was && FAMS[h.was]) ? fampx()[h.was] : null,
        hi2: h.n >= 4 ? 1 : 0             // one additive copy of itself, over four
    };
}
/* One word's path. Travel is FLY seconds on easeOutQuint: 76% of the
   distance goes in the first third, so the word is thrown and then it
   is ARRIVING for a long time, and the long arrival is where the
   weight lives. Arrivals ladder a couple of frames apart and the LAST
   word lands exactly on TSET, the frame the rule strikes and the slam
   fires, so the jolts stack into one settling bounce instead of six
   taps. */
function detWordPath(d, w, h, i) {
    var nw = d.ws.length, dw = Math.min(0.009, 0.045 / Math.max(1, nw - 1));
    w.arr = d.tset - (nw - 1 - i) * dw;
    w.t0 = Math.max(0, w.arr - d.fly);
    w.dur = Math.max(0.03, w.arr - w.t0);
    w.wx = h.wx; w.wy = h.wy; w.wh = h.wh;
    w.P = fampx()[w.fam];
    /* THE ARC, and the most legible scaling in the design. A TALL
       picture (every source inside 260 screen pixels): the syllables
       go UP, climb off the body, over the top, and come down into the
       line like something lifted out. A WIDE one: they drop to the
       FLOOR and sweep in low across it from every corner. You know
       which you are looking at from the shape of the motion alone with
       the colour off.
       The wide case's control point is an absolute ground y under the
       centroid rather than a relative offset, because design-deton-2's
       +34px bow at three sources is a sag and not a floor sweep
       (crit-art-deton, the caveat). It is recomputed live in detAt
       from d.x/d.y so it holds still while the camera pans. */
    w.arc = d.tall ? -(46 + 54 * fxP(h.n)) : 0;
    w.low = d.tall ? 0 : 1;
    /* THE OVERSHOOT, and there is no cheaper way to say a thing has
       mass. The word flies PAST its slot along its own arrival
       direction and comes back over 14ms, fixed at every size, because
       a settle that takes longer at high power reads as sluggish
       rather than heavy. The direction is the Bezier's terminal
       tangent taken once, here, against the anchor as it stood at T0:
       over 190ms the camera cannot drift far enough to matter and a
       target that moves is a slot that moves.
       -ill's line does not bounce, so -ill's words do not overshoot
       either: FAM_LINE.still is the one flag and it is read here and
       in detJolt (4.4.5). */
    var over = (d.K.miss || (FAM_LINE[d.fam] && FAM_LINE[d.fam].still))
               ? 0 : Math.round(2 + 5 * d.p);
    var x0 = isoX(w.wx, w.wy), y0 = isoYA(w.wx, w.wy) - w.wh;
    var my = w.low ? (isoYA(d.x, d.y) + 10) : (y0 + d.lineY) / 2 + w.arc;
    var mx = (x0 + w.sx) / 2;
    var vx = w.sx - mx, vy = d.lineY - my, m = Math.sqrt(vx * vx + vy * vy) || 1;
    w.tx = w.sx + Math.round(vx / m * over);
    w.ty = d.lineY + Math.round(vy / m * over);
    /* THE SLANT: break the BASELINE, not the kerning. design-deton-3
       landed each word 3 + irnd(0,4) px off its slot at a random
       angle, which at 30px type with 30px gaps is indistinguishable
       from the subpixel drift this file has a documented history of:
       the read is "the text jittered", not "I said the wrong sound"
       (crit-art-deton 23). A staggered baseline is unmistakably
       crooked at a glance and drift does not stagger. x is untouched,
       so the line is still a line and it is still wrong. */
    if (d.K.miss) {
        w.tx = w.sx;
        w.ty = d.lineY + (i % 2 ? 1 : -1) * irnd(2, 6);
    }
}

/* The row, copied BEFORE it is spent, because the tear redraws the row
   it is tearing off and the caller is about to empty it.
     go   which cells the sound actually took. The wax takes the whole
          pile, matched or not
     k    the cell's remaining life as a fraction, for the haul's bar
     t    the glyph, pre-sliced, so no drawer builds a string per cell
          per frame
     dr   a Droner's grey, which is the one piece of information in the
          row that says you did not put this here
     w    the word that was said to plant it, for 4.2.1 */
function detCells(f, fam, all) {
    return f.stacks.map(function (s) {
        return { fam: s.fam, go: (all || s.fam === fam) ? 1 : 0,
                 k: s.t / Math.max(0.001, s.max),
                 t: (FAMS[s.fam] ? FAMS[s.fam].tag : '???').slice(0, 3),
                 dr: s.drone ? 1 : 0, w: s.w || null };
    });
}

/* The only mutating thing in a detonation. Letters do not freeze, so
   this is REAL dt: a word held mid flight for 90ms of hitstop reads as
   a dropped frame, and every typographic drawer in the file is already
   on real dt from draw(rdt) (3811). The family matter under it is on
   the sim clock and DOES hold, and that split is what makes a held
   frame read as held rather than as a stall.
   The life floor is a belt: a caller that forgets to set d.life would
   otherwise have its record deleted on the first tick, which is the
   failure mode that ate design-deton-3 (4.2.4). */
function stepDet(dt, real, st) {
    var d = RT.det; if (!d) return;
    if (!d.life) d.life = 1.2;
    d.t += real;
    if (!d.fired && d.t >= d.tset) { d.fired = 1; detFire(d); }
    /* THE NIB. One tick per syllable as it presses its mark into the
       rule, which is what makes the rule feel earned rather than
       drawn: you hear the line being counted out before you see it
       finished. detRule is already computing the landed count for the
       three drawers and caching it under d.rtT, so this is a read and
       not a second walk. Capped at the gap fxSfx enforces, because an
       Act 3 close lands twenty-five of these inside 0.22s and
       twenty-five nibs is a buzz, not a count. */
    var lc = detRule(d).n;
    if (lc > (d.nibN || 0)) { d.nibN = lc; fxSfx('nib', 0.03); }
    if (d.t >= d.life) RT.det = null;
}
/* TSET. The single most important retiming in this document.
   slam() is called at 2650 today, on the frame of the keypress, and it
   carries shake(9) and chroma 0.5 with it. A 74px word at 2.6x scale
   is the loudest thing this canvas can do and it currently happens
   BEFORE the picture that earns it: the room takes the hit while the
   syllables are still sitting on the bodies. Now it lands when the
   line lands, and the two sounds move with it. */
function detFire(d) {
    var K = d.K, P = fampx()[d.fam];
    var word = P.tag, col = K.lit ? P.col : '#6a5f72';
    /* -punch's hook table asks for hitFoes on the slant row and the
       pile on the other two. On a pure drag the two are the same
       number anyway: a dragged foe contributes n = its whole row and
       dragged++ runs once per stack, so total IS dragged. */
    var pw = d.kind === 'slant' ? d.wide : d.total;
    /* THE LIGHT GOES WHERE THE LINE IS, NOT WHERE THE BODIES WERE.
       crit-art-deton 8: file 1 forbids radial symmetry in as many
       words, and -punch then delivers a 1792px radial centred on the
       enemy centroid, so on the exact frame the design has spent 190ms
       earning, the loudest coloured event on screen says "a thing went
       off here" when what happened is that things which were apart
       came together. bx/by and flat are already in punch()'s bag
       (2.7): the bloom becomes a bar of colour lying along the line.
       x/y stay the centroid, because the shake direction and the zoom
       anchor are about where it happened.
       punch() reads o.x/o.y as WORLD TILES and slam() reads o.sy as a
       SCREEN pixel for its own anchor. Two keys, deliberately, because
       one key meaning both is how the slam path spent its first day
       telling punch() that the detonation happened at tile 359.6. */
    var bag = { fam: K.lit ? d.fam : null, power: pw, kind: K.punch,
                x: d.x, y: d.y, bx: VW / 2, by: d.lineY + 6, flat: 0.28 };
    if (K.slam) {
        /* THE SUB. `12 closed` is the code telling the player what the
           picture failed to; the rule is segmented and notched now and
           the number is on screen in a form you can count
           (crit-art-deton 27). So the close prints the SOUND, which is
           the one thing the tag word above it does not already say.
           The drag and the slant keep their numbers, because the drag
           has no other readout of how much it moved. */
        var sub = d.kind === 'close' ? FAMS[d.fam].n
                : d.kind === 'drag' ? d.total + ' dragged over' : 'slant';
        bag.sy = VH * 0.62;
        slam(word, col, sub, bag);        // one bag, so the two paths cannot drift apart
        fxSfx(d.kind === 'close' ? 'answer' : 'slant', 0.10);
    } else {
        punch(bag);                       // the wave, the Reprise and the Verse slam elsewhere
    }
    fxSfx('rule', 0.06);
    if (d.cpl) fxSfx('bracket', 0.20);
    if (d.K.brk) fxSfx('crack', 0.10);
}

/* easeOutQuint. 76% of the distance in the first third: the word is
   thrown, and then it is arriving for a long time. */
function detEase(t) { var u = 1 - t; return 1 - u * u * u * u * u; }

/* One record on its quadratic Bezier, rounded. Nothing in this section
   travels subpixel: imageSmoothingEnabled is false and a letter on a
   half pixel is a letter with a soft edge in a game with no soft
   edges.
   P0 is LIVE, re-projected from world tiles every frame, so a syllable
   stays on the body it was said at while the camera pans. And it is
   put through the punch transform, because drawFx runs inside the
   shake and inside the zoom and drawFxS runs outside both: on the
   frame the room takes the hit, an untransformed origin detaches from
   the body it is peeling off by up to 22 pixels, which is the exact
   frame the design most wants them glued (crit-eng-deton B7, and
   punchWX/punchWY in 2.3). */
function detAt(d, r, tx, ty, dur, t) {
    var k = clamp((t - r.t0) / Math.max(0.001, dur), 0, 1), e = detEase(k), u = 1 - e;
    var x0 = punchWX(isoX(r.wx, r.wy) + (r.ox || 0));
    var y0 = punchWY(isoYA(r.wx, r.wy) - r.wh);
    var mx = (x0 + tx) / 2;
    var my = r.low ? (isoYA(d.x, d.y) + 10) : (y0 + ty) / 2 + (r.arc || 0);
    return { k: k,
             x: Math.round(u * u * x0 + 2 * u * e * mx + e * e * tx),
             y: Math.round(u * u * y0 + 2 * u * e * my + e * e * ty) };
}

/* THE JOLT. Every arrival kicks the WHOLE line down and it comes back
   over 50ms, linear. Words land within a few frames of each other, so
   the kicks stack into one settling bounce and the line reads as an
   object being loaded. The largest live kick wins; nothing sums, which
   is the discipline punch() keeps on every one of its channels.
   -ill returns zero through FAM_LINE's `still` flag: the family that
   stops is the one family whose line does not bounce (crit-art-deton
   16). */
function detJolt(d) {
    if (d.K.miss || (FAM_LINE[d.fam] && FAM_LINE[d.fam].still)) return 0;
    var best = 0, i, w, u;
    for (i = 0; i < d.ws.length; i++) {
        w = d.ws[i];
        if (d.t < w.arr) continue;
        u = (d.t - w.arr) / 0.05;
        if (u < 1 && 1 - u > best) best = 1 - u;
    }
    return Math.round((1 + 3 * d.p) * best);
}

/* THE RULE, read out of the flyers that have landed, segment by
   segment. Cached on the record under the clock it was computed at:
   three passes want it in one frame (the line, the patch, the family
   line) and it walks up to thirty-two flyers and allocates
   (crit-eng-deton N6). Two of those passes would otherwise recompute
   an identical answer.
     Each segment grows from its own centre as ITS OWN body's
     syllables arrive, so the piece under the place a body stood is as
     long as what that body gave up. At TSET every segment strikes to
     full together over 45ms, easeOutExpo. `built` can never exceed
     what this outcome is allowed to have: design-deton-3 clamped it to
     r.half rather than to full, so a six word slant with eight sources
     built 432px of rule, clamped to 250, against a 150px allowance,
     and the 60%-and-broken image never appeared at any power above
     three syllables (crit-eng-deton B3). */
function detRule(d) {
    if (d.rtT === d.t && d.rt) return d.rt;
    var i, f, at, n = 0, tick = 0, seg = d.seg, s, kk;
    for (i = 0; i < seg.length; i++) seg[i].got = 0;
    for (i = 0; i < d.fl.length; i++) {
        f = d.fl[i]; at = f.t0 + d.fly;
        if (d.t < at) continue;
        n++; seg[f.hi].got++;
        if (d.t - at < 0.05) tick = 1;
    }
    var mul = d.K.rule, strike = 0;
    if (d.t >= d.tset) strike = 1 - Math.pow(2, -10 * clamp((d.t - d.tset) / 0.045, 0, 1));
    /* the close, from both ends inward at 900 px/s, 0.10s after the
       line has gone. Punctuation does not scale, so the 0.10 and the
       900 are the same at every size. */
    var end = d.tset + d.hold + d.out, eat = 0;
    if (d.t > end + 0.10) eat = (d.t - end - 0.10) * 900;
    for (i = 0; i < seg.length; i++) {
        s = seg[i];
        kk = s.perN ? clamp(s.got / s.perN, 0, 1) : 0;
        s.len = Math.round(s.w * mul * Math.max(kk, strike));
    }
    var half = Math.round(d.rule.half * mul), len = Math.max(0, half - eat);
    var r = { len: len, half: half, eat: eat, n: n, tick: tick,
              a: d.t >= d.tset ? 1 : (n ? clamp(0.35 + 0.06 * n, 0.35, 1) : 0),
              /* the break. A rule under a slant strikes to 60% and then
                 opens a 3px gap at the centre on the NEXT frame, and
                 the two halves sit there for the hold. A broken rule
                 under a crooked line, and no end caps, because it is
                 not finished. */
              gap: (d.K.brk && d.t > d.tset + 0.045) ? 3 : 0,
              caesura: (len <= 2 && d.t > end) ? 1 : 0 };
    d.rt = r; d.rtT = d.t;
    return r;
}

/* THE TEAR. For 45ms the spent row is redrawn, lifted, and LEAVES.
   design-deton-2 made the distinction load bearing ("a fade is what a
   stack going sour does, and a spent stack must never look like a sour
   one") and design-deton-3 then wrote globalAlpha = 1 - k over a 45ms
   window with a 10px rise, which at 60Hz is three frames of a fade
   with a nudge on it (crit-art-deton 17).
   So there is no alpha on it at all. It is clipped to the box the row
   was standing in and it rises out of the top of that box: the row
   leaves the frame through a hard edge, which is drawCuts' own idiom
   (3774-3799), the most distinctive effect in the file and the one
   technique this design should be stealing rather than the one it
   forbids.
   It carries only the cells that GO. The survivors are still on the
   body and drawStacks is still drawing them, re-packed and re-centred;
   drawing all the original cells over them at the original centring
   put five mis-registered cells at two brightnesses on a foe that had
   three sounds and closed one (crit-art-deton 18). The survivors get
   their own detail in 4.11: they SLIDE into the gap the answered sound
   left.
   The first 14ms of it is the cells LIGHTING: the closing cells filled
   flat in the family colour, no scale, no offset. It is the only frame
   in the game where a body carrying three sounds shows you which one
   you answered, and it costs nothing, because the tear is a copy of
   the row taken before the row was spent and drawing that copy with
   the fill turned up IS the light. */
function drawDetWorld(cx) {
    var d = RT.det; if (!d || !d.tears) return;
    var i, j, tr, k, n, sx, sy, y0, x, c, lit, plate;
    cx.save(); cx.textAlign = 'center';
    cx.font = 'bold 8px "Press Start 2P", monospace';
    for (i = 0; i < d.tears.length; i++) {
        tr = d.tears[i];
        k = (d.t - tr.t0) / 0.045;
        if (k < 0 || k >= 1) continue;
        n = tr.cells.length; if (!n) continue;
        sx = isoX(tr.wx, tr.wy);
        y0 = isoYA(tr.wx, tr.wy) - tr.wh;      // where the row WAS
        sy = y0 - Math.round(k * 16);                      // where it is now
        lit = (d.t - tr.t0) < 0.014;
        plate = n * PIP_W + 8;
        cx.save();
        cx.beginPath();
        cx.rect(sx - plate / 2 - 2, y0 - 11, plate + 4, 16);
        cx.clip();
        cx.fillStyle = 'rgba(8,6,12,.72)';
        cx.fillRect(sx - plate / 2, sy - 11, plate, 16);
        for (j = 0; j < n; j++) {
            c = tr.cells[j];
            x = Math.round(sx + (j - (n - 1) / 2) * PIP_W);
            if (lit) {
                cx.fillStyle = tr.col;
                cx.fillRect(x - 5, sy - 10, 11, 14);
                cx.fillStyle = '#08060c'; cx.fillText(c.t, x, sy);
            } else {
                cx.fillStyle = '#08060c'; cx.fillText(c.t, x + 1, sy + 1);
                cx.fillStyle = c.dr ? '#8a8090' : (FAMS[c.fam] ? FAMS[c.fam].glow : '#6a5f72');
                cx.fillText(c.t, x, sy);
            }
        }
        cx.restore();
    }
    cx.restore(); cx.textAlign = 'left';    // every text drawer in this file does this
}

/* The room goes down so the line is the only thing in it, and then a
   flat band of the sound's own colour lies along the line: the light
   coming OFF it. Two rects, no gradient, no bake, and file 1's image
   finally exists.
   The dim is authored against d.p, so a one stack close barely touches
   the room and a twelve stack close takes a third of it. It ramps in
   over 40ms from TSET and out over the first third of OUT, so the room
   is darkest on exactly the frames the line is still.
   0.30 * d.p is the whole budget. It is deliberately below the `dark`
   pass FAM_PUNCH already runs (2.7): that one is the family's own
   appetite for the room's light and fires at TSET too, so -ark
   compounds to a genuinely dark room and -ight barely dims at all,
   which is correct for both. */
function drawRoomDown(cx) {
    var d = RT.det; if (!d || RT.mapOpen || d.t < d.tset) return;
    var end = d.tset + d.hold, k;
    if (d.t < end) k = clamp((d.t - d.tset) / 0.04, 0, 1);
    else k = 1 - clamp((d.t - end) / Math.max(0.02, d.out * 0.34), 0, 1);
    if (k <= 0.01) return;
    var P = fampx()[d.fam];
    cx.save();
    cx.fillStyle = 'rgba(8,6,12,' + (0.30 * d.p * k).toFixed(3) + ')';
    fullRect(cx);
    /* the band. Three tiles tall in screen terms, additive, centred on
       the line, at a tenth alpha: light lying along a bar rather than
       a ball of it behind the enemies. */
    cx.globalCompositeOperation = 'lighter';
    cx.fillStyle = 'rgba(' + P.rgb + ',' + (0.10 * d.p * k).toFixed(3) + ')';
    cx.fillRect(0, d.lineY - 26, VW, 44);
    cx.restore();
}

/* THE BRACKET. Two verticals joined at the top, drawn from the ends
   inward, always brass, at three spans: around one line (the couplet),
   around two lines of a stanza, and around two marks in the Verse
   column. Brass because crit-art-deton 14 is right that the rule, the
   caps and every bracket being FAMS[fam].col renders the sound that
   closed and the fact that it closed in one hue: the rule stays the
   sound, written down, and the apparatus goes to #c9a94a, which is the
   colour of every lamp, instrument and fitting in this town, is
   already in the player's eye, and is the only mid warm value in a set
   of five saturated hues, so it survives the greyscale test.
   2px and full alpha, struck at TSET and held to the caesura, because
   it is a fact about the line and not a sparkle on the hit
   (crit-art-deton 21: 1px at 60% for 90ms underneath a 161px slam was
   the rarest mark in the game rendered as the least visible). */
function bracket(cx, x0, x1, y, h, a) {
    if (x1 - x0 < 6) return;
    cx.globalAlpha = clamp(a == null ? 1 : a, 0, 1);
    cx.fillStyle = '#08060c';
    cx.fillRect(Math.round(x0) + 1, Math.round(y) + 1, Math.round(x1 - x0), 2);
    cx.fillStyle = PX_BRASS;
    cx.fillRect(Math.round(x0), Math.round(y), Math.round(x1 - x0), 2);
    cx.fillRect(Math.round(x0), Math.round(y), 2, Math.round(h));
    cx.fillRect(Math.round(x1) - 2, Math.round(y), 2, Math.round(h));
    cx.globalAlpha = 1;
}

/* Outside the shake, after drawMap, and therefore the last thing
   draw() paints apart from the four passes above it in the ord table.
   The map is opaque, so the guard on the first line is not politeness:
   it is the difference between a rule drawn over the map and a rule
   that is simply gone. */
function drawDetScreen(cx) {
    var d = RT.det; if (!d || RT.mapOpen) return;
    var i, j, w, p, e, k, col, s, nn, nx, f;
    var jolt = detJolt(d), R = detRule(d);
    var end = d.tset + d.hold, ko = d.t - end, inked = 0, wipe = 0;
    if (ko > 0) {
        /* THE OUT, and it is not a fade and no longer a drift. Stage
           one, 40ms: the word goes from lit to inked, one hard step,
           because a hard cut is on model and a colour ramp is not.
           Stage two: the line is CUT OFF, bottom up, over 60ms, by the
           same clip the tear uses. design-deton-2 lifted it 14px and
           faded it, and admitted in the same paragraph that there is
           no poem readout on the canvas for it to travel to;
           crit-art-deton 28 is right that 14px at 30px type is the
           line sagging upward rather than going anywhere. Commit or
           stop. This stops, and the rule outlives it exactly as
           designed. */
        inked = 1;
        wipe = clamp((ko - (d.out - 0.06)) / 0.06, 0, 1);
        if (wipe >= 1) return;
    }
    var ry = d.ruleY + jolt, ly = d.lineY + jolt, rw = d.rule.w;
    cx.save();
    cx.textAlign = 'center';

    /* THE PAPER. crit-art-deton 24: the press mark is "type being
       pressed into paper", the rule flashes to "the file's paper
       colour", and there is no paper anywhere in six files, only the
       night. The file already owns the surface: rgba(8,6,12,.72) is
       the stack row plate at 3542. One rect, struck by the first
       arrival and growing in width with each one, so the paper is fed
       into the machine as the words land. */
    if (R.n || d.t >= d.tset) {
        k = d.t >= d.tset ? 1 : clamp(R.n / Math.max(1, d.fl.length), 0.25, 1);
        w = Math.round((d.half + 12) * k);
        cx.fillStyle = 'rgba(8,6,12,.72)';
        cx.fillRect(VW / 2 - w, ly - d.wordPx - 6, w * 2, d.wordPx + 20);
    }

    /* THE RULE, in pieces, one per body. Struck in near white for 50ms
       and then settling to the family's ink: #e8e2ee, not #fff,
       because the palette has no pure white and #e8e2ee is this file's
       strike frame in every other place it appears (2.4). A rule that
       flashes to paper and settles to ink is the sound being written
       down. */
    if (R.a > 0) {
        var fresh = d.t >= d.tset && d.t < d.tset + 0.05;
        col = !d.K.lit ? '#6a5f72' : fresh ? '#e8e2ee' : fampx()[d.fam].col;
        cx.globalAlpha = R.a;
        for (i = 0; i < d.seg.length; i++) {
            s = d.seg[i];
            if (s.len <= 0) continue;
            /* each piece grows from its own centre, so an arrival
               pushes an end outward at the place its body stood */
            var sx0 = s.mid - Math.round(s.len / 2), sw = s.len;
            /* the slant's 3px break, taken out of whichever piece
               straddles the middle */
            if (R.gap && sx0 < VW / 2 && sx0 + sw > VW / 2) {
                cx.fillStyle = '#08060c';
                cx.fillRect(sx0 + 1, ry + 1, VW / 2 - 2 - sx0, rw);
                cx.fillRect(VW / 2 + 2, ry + 1, sx0 + sw - VW / 2 - 1, rw);
                cx.fillStyle = col;
                cx.fillRect(sx0, ry, VW / 2 - 2 - sx0, rw);
                cx.fillRect(VW / 2 + 1, ry, sx0 + sw - VW / 2 - 1, rw);
            } else {
                cx.fillStyle = '#08060c'; cx.fillRect(sx0 + 1, ry + 1, sw, rw);
                cx.fillStyle = col; cx.fillRect(sx0, ry, sw, rw);
            }
            if (d.t < d.tset) continue;
            /* THE NOTCHES. crit-art-deton 6: word size 23 to 30px,
               overhang 9 to 30px inside a 600px object and duration
               0.59 to 0.83s are three readouts of `total` that nobody
               can perceive without a side by side capture. Counting is
               instant and length is not. One 2px notch per syllable
               under this body's own piece, up to twelve, then one per
               four beyond that: a four stack close has four notches, a
               twelve stack close has a comb, and the player learns the
               scale in three fights without being told. It is also
               what a MEASURED rule is, which is the word file 2 used
               to justify the end caps. */
            nn = s.n <= 12 ? s.n : 12 + Math.floor((s.n - 12) / 4);
            nn = Math.min(nn, Math.floor(sw / 3));
            cx.globalAlpha = R.a * 0.8;
            cx.fillStyle = col;
            for (j = 0; j < nn; j++) {
                nx = sx0 + Math.round((j + 0.5) * sw / nn) - 1;
                cx.fillRect(nx, ry + rw + 2, 2, 2);
            }
            /* THE UPRIGHT. crit-art-deton 19: d.dead is computed per
               hit and used only to tell families to draw free
               standing, so a close that wipes four Mouths and a close
               that tickles four Mouths draw the same line. One 2px
               mark standing ON the rule where that body's piece is:
               the same shape as an end cap pointed the other way,
               which is the right family of shape, because a cap says
               the rule ended and an upright says a voice did. */
            if (s.kill) {
                cx.globalAlpha = R.a;
                cx.fillStyle = PX_BRASS;
                cx.fillRect(s.mid - 1, ry - 5, 2, 5 + rw);
            }
            cx.globalAlpha = R.a;
        }
        /* END CAPS, brass, at the true ends. What makes a rule a
           measured rule rather than a stroke that ran out, which is
           the cheapest way to say finished, and finished is the
           emotional content of a closed rhyme. A slant gets none,
           because it is not. */
        if (d.K.caps && d.t >= d.tset && !R.eat) {
            cx.fillStyle = PX_BRASS;
            cx.fillRect(d.segL, ry - Math.round(d.rule.cap / 2), 2, d.rule.cap + rw);
            cx.fillRect(d.segR - 2, ry - Math.round(d.rule.cap / 2), 2, d.rule.cap + rw);
        }
        /* an end still ringing from an arrival: 2px, paper, 50ms. The
           rule visibly receiving a syllable. */
        if (R.tick) {
            cx.fillStyle = '#e8e2ee';
            for (i = 0; i < d.seg.length; i++) {
                s = d.seg[i];
                if (!s.len || !s.got) continue;
                cx.fillRect(s.mid + Math.round(s.len / 2) - 2, ry - 1, 2, rw + 2);
            }
        }
        cx.globalAlpha = 1;
    }
    if (R.caesura) {
        cx.fillStyle = d.K.lit ? fampx()[d.fam].col : '#6a5f72';
        cx.fillRect(VW / 2 - 1, d.ruleY, 2, d.rule.w);
    }

    /* THE COUPLET, and it is the game's argument in six pixels. A
       couplet is two lines held together by a sound, so the join is a
       thing you can see: the previous line's rule, remembered, at 60%
       length above this one, and the bracket closing the two together.
       It holds from TSET to the caesura. No text, no toast. If it
       needs a label it has failed. The false line in the ballad is the
       one place this bracket can never be drawn, because the false
       line does not rhyme. */
    if (d.cpl && d.t >= d.tset) {
        var l2 = Math.round(R.len * 0.6), y2 = ly - 26;
        cx.globalAlpha = 0.6; cx.fillStyle = fampx()[d.fam].col;
        cx.fillRect(VW / 2 - l2, y2, l2 * 2, d.rule.w);
        cx.globalAlpha = 1;
        bracket(cx, VW / 2 - l2, VW / 2 + l2, y2, ry - y2, 1);
    }

    /* THE FLYERS. One whole syllable each, on the same Bezier and the
       same easing as the words, each to ITS OWN body's piece of the
       rule. They do not join the line, they BUILD THE RULE UNDER IT,
       and because they land where their body's piece is they spread
       along the whole width instead of collapsing into a forty pixel
       blob over the middle of it (crit-art-deton 4). */
    for (i = 0; i < d.fl.length; i++) {
        f = d.fl[i];
        if (d.t < f.t0 || d.t >= f.t0 + d.fly) continue;
        s = d.seg[f.hi];
        p = detAt(d, f, s.mid, d.ruleY, d.fly, d.t);
        col = (f.was && p.k < 0.6) ? f.was.col : f.col;   // the drag, on one frame
        cx.globalAlpha = 1;
        cx.font = f.font;
        cx.fillStyle = '#08060c'; cx.fillText(f.txt, p.x + 1, p.y + 1);
        cx.fillStyle = col; cx.fillText(f.txt, p.x, p.y);
        if (f.hi2) {
            cx.globalCompositeOperation = 'lighter';
            cx.globalAlpha = 0.3;
            cx.fillStyle = (f.was && p.k < 0.6) ? f.was.glow : f.glow;
            cx.fillText(f.txt, p.x, p.y);
            cx.globalCompositeOperation = 'source-over';
        }
    }

    /* THE WORDS. Everything below is inside one clip, so the out is a
       hard bottom up cut rather than an alpha ramp. */
    cx.save();
    if (wipe > 0) {
        var top = ly - d.wordPx - 4, bot = ly + 6;
        cx.beginPath();
        cx.rect(0, top, VW, Math.max(0, (bot - top) * (1 - wipe)));
        cx.clip();
    }
    cx.font = 'bold ' + d.wordPx + 'px "Press Start 2P", monospace';
    for (i = 0; i < d.ws.length; i++) {
        w = d.ws[i];
        if (d.t < w.t0) continue;
        var wx, wy;
        if (d.t < w.arr) {
            p = detAt(d, w, w.tx, w.ty, w.dur, d.t);
            wx = p.x; wy = p.y; e = detEase(p.k);
        } else {
            /* the return. It flew PAST the slot and comes back into it
               over 14ms, and that is the whole of the weight. */
            var u = clamp((d.t - w.arr) / 0.014, 0, 1);
            wx = Math.round(lerp(w.tx, w.sx, u));
            wy = Math.round(lerp(w.ty, d.lineY, u));
            e = 1;
        }
        wy += jolt;
        /* THE HALO, and the end of shadowBlur. cx.shadowBlur = 14*ease
           (2702) is the only blurred edge in 8279 lines and it looks
           like a different game. One extra fillText of the same
           glyphs, additive, scaled about the word's centre, is a HARD
           halo: at 24px, 1.09 is a two pixel rim made of letter
           shapes. One draw call instead of a per word per frame
           Gaussian, and it is gone at ease = 1, so the set word is the
           clean word.
           The halo is the family's COL and not its glow. Additive glow
           over a glow fill saturates every channel on -ight, -erd and
           -ill, and the bible's first rule is no pure white
           (crit-art-deton 11). Stacking a saturated hue additively
           drives toward the hue, which is what a corona made of the
           sound's own colour should do. */
        if (d.K.lit && e < 1) {
            var ha = d.halo * (1 - e);
            detHalo(cx, d, w.w, wx, wy, 1.05 + 0.09 * d.p, ha, w.P.col);
            if (d.total >= 8) detHalo(cx, d, w.w, wx, wy, 1.18, ha / 3, w.P.col);
        }
        cx.globalAlpha = 1;
        /* The word: head in the family's col, rhyming tail in its
           glow, one shadow under both (4.0.1). `inked` drops the whole
           word to col, so the out stops being a colour ramp and
           becomes the halo leaving, which is what it always should
           have been. A slant is grey throughout, because nobody wrote
           it down. */
        rimeText(cx, w.w, wx, wy, w.P, d.wordPx,
                 !d.K.lit ? '#6a5f72' : inked ? w.P.col : null);
        /* THE PRESS MARK. Type pressed into paper: a 1px rect the
           exact width of the word, on its baseline, for 14ms, in
           #e8e2ee, which is the same strike white the rule and the
           arrival tick use, because design-deton-2 says in as many
           words that these are the same gesture at the two ends of the
           throw and then drew them in two colours (crit-art-deton 13,
           2.4). -ill's press marks stay struck for the whole hold:
           see FAM_LINE. */
        if (!d.K.miss && d.t >= w.arr &&
            (d.t < w.arr + 0.014 || (FAM_LINE[d.fam] && FAM_LINE[d.fam].still && !inked))) {
            cx.fillStyle = '#e8e2ee';
            cx.fillRect(wx - Math.round(w.wd / 2), wy + 3, w.wd, 1);
        }
    }
    cx.restore();
    cx.globalAlpha = 1;
    cx.restore(); cx.textAlign = 'left';
}
/* A scaled copy of a hard glyph about its own CENTRE rather than its
   baseline, which is why this is a function and not three inline
   lines: get the pivot wrong and the halo grows upward only and the
   line looks lit from below. The whole word in one call, because the
   halo is a rim and not a readout: the head/tail split is in the fill
   underneath it. */
function detHalo(cx, d, txt, x, y, sc, a, col) {
    if (a <= 0.004) return;
    var cy = y - d.wordPx * 0.36;
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = clamp(a, 0, 0.55);      // -ight's yellow is the brightest thing in the palette
    cx.fillStyle = col;
    cx.textAlign = 'center';
    cx.translate(x, cy); cx.scale(sc, sc);
    cx.fillText(txt, 0, y - cy);
    cx.restore();
}

/* The family's one gesture on the line itself. ord 90.5: over the rule
   and under the words, so a family can eat the rule and cannot eat the
   line.
     cx   the context, textAlign 'center', font already the line's
     d    the detonation, read only
     k    0 to 1 across the hold: 0 at TSET, 1 when the out begins
     x,y  the line's centre and its baseline, jolt already applied
     w    the line's half width
   Two flags may be hung on the function object itself:
     .still  detJolt returns 0 and the press marks stay struck (-ill)
     .hole   the rule is drawn as a hole rather than a stroke (-ark)
   Nothing here may push a particle, hold an f, or age anything.
   Declared with the same `|| {}` guard 3.0.1's tables use: whichever
   block a merge puts first wins the allocation and a bare second
   `= {}` further down the file would silently drop five rows. */
var FAM_LINE = FAM_LINE || {};
function drawFamLine(cx) {
    var d = RT.det; if (!d || RT.mapOpen || d.t < d.tset) return;
    var fn = FAM_LINE[d.fam]; if (!fn) return;
    var k = clamp((d.t - d.tset) / Math.max(0.02, d.hold), 0, 1);
    var jolt = detJolt(d);
    cx.save();
    cx.textAlign = 'center';
    cx.font = 'bold ' + d.wordPx + 'px "Press Start 2P", monospace';
    fn(cx, d, k, VW / 2, d.lineY + jolt, d.half);
    cx.restore(); cx.textAlign = 'left';
}

/* ─────────────── the snap ─────────────── */

/* every stack on screen snaps into alignment before it goes */
var FAM_SNAP = {};
function regSnap(fam, fn) { FAM_SNAP[fam] = fn || null; }
function snapStacks(f, col, n, fam, th) {
    var k = (fam && FAM_SNAP.hasOwnProperty(fam)) ? fam : 'none';
    if (!FAM_SNAP[k]) return;             // this family draws its own. -erd's clap IS the snap
    th = th == null ? 1 : th;
    RT.snaps.push({ x: f.x, y: f.y, h: foeH(f) + 18 + (f.so || 0),
                    col: col, n: n, fam: k, t: 0.32, max: 0.32 });
    /* Thinned by the width of the detonation. Twenty-five folk asking
       for six each is 150 particles into a list that silently stops
       accepting at 900, and the ones who lose are always the last in
       the loop. detSnap is a tunable and 0 is a supported look: the
       snap is then its bracket and nothing else, which is clean. */
    var q = Math.round((4 + n * 2) * th * T('detSnap'));
    if (q > 0) burst(f.x, f.y, 30, Math.max(2, q),
                     { col: hex2rgb(col), sp0: 0.5, sp1: 2.4, l0: 0.2, l1: 0.6 });
}
/* The default shape, and the five families replace it. Two brackets
   closing on the row the sounds were sitting in and a hairline where
   they met: the same gesture as the 2px line this replaces, and a
   punctuation mark rather than a stroke that ran out. */
function snapDefault(cx, s, k, sx, sy) {
    var w = Math.round((12 + s.n * 7) * (1 - k)) + 2, t = 1 - k;
    cx.globalAlpha = t; cx.fillStyle = s.col;
    cx.fillRect(sx - w, sy - 1, 5, 2);
    cx.fillRect(sx + w - 5, sy - 1, 5, 2);
    cx.fillRect(sx - w, sy - 5, 2, 10);
    cx.fillRect(sx + w - 2, sy - 5, 2, 10);
    cx.globalAlpha = t * t;               // the hairline between them, going first
    cx.fillRect(sx - w, sy, w * 2, 1);
}
FAM_IDS.forEach(function (q) { FAM_SNAP[q] = snapDefault; });
FAM_SNAP.none = snapDefault;              // the grey one, for a slant

function drawSnaps(cx, dt) {
    for (var i = RT.snaps.length - 1; i >= 0; i--) {
        var s = RT.snaps[i]; s.t -= dt;
        if (s.t <= 0) { RT.snaps.splice(i, 1); continue; }
        var fn = FAM_SNAP[s.fam] || snapDefault;
        var k = 1 - s.t / s.max;
        // the row's real height, stored at push time, because foeH needs
        // the foe and no record may outlive the frame holding one
        var sx = Math.round(isoX(s.x, s.y)), sy = Math.round(isoYA(s.x, s.y) - s.h);
        cx.save();
        fn(cx, s, k, sx, sy);
        cx.globalAlpha = 1;
        cx.restore();
    }
}

/* ─────────────── the slant, the drag and the patch ───────────────
   Bad rhyme, good poem. A close throws matter. A drag reaches out,
   takes hold of somebody else's sounds and walks them over to its
   own, and the sounds are visibly worn by the trip. It pushes no
   particles at all: every close in the game bursts, and being the one
   loud thing that makes no sparks is most of what says this is a
   different kind of move. */

/* Post dressing, from doRhyme's two failure branches. Reads hits once
   more and drops them: nothing below stores f, and every source is
   world tiles plus a head height, so a haul stays glued to the body it
   took hold of while the camera pans off it. */
function dressSlant(d, hits) {
    if (!d) return;                                 // a shout in an empty room
    var i, h, hl = [], age = clamp(T('dragAge'), 0, 0.95);
    for (i = 0; i < hits.length; i++) {
        h = hits[i];
        if (h.took) continue;                       // it closed. Not our business
        h.f.rowT = 0.42;                            // the row drawer stands down for this body
        hl.push({
            kind: h.was != null ? 'haul' : (h.f.def.folk ? 'refuse' : 'drop'),
            wx: h.f.x, wy: h.f.y, wh: foeH(h.f) + 18 + (h.f.so || 0),
            cells: h.cells, n: h.cells.length,
            st: Math.min(0.024, 0.14 / Math.max(1, h.cells.length)),
            t0: h.t0 || 0,
            rope: i < 6 ? 1 : 0                     // nearest six only. See below
        });
    }
    d.haul = hl;
    d.age = age;
    d.rope = Math.round(7 + 9 * (1 - d.th0));       // mark pitch, thinned like everything else
}

/* Registered at ord 86, under the line and over the families. It ages
   nothing, holds nothing and takes no dt: every pixel is a function of
   d.t, so a second pass or a held frame draws the same picture. */
function drawHaulWorld(cx) {
    var d = RT.det; if (!d || !d.haul || !d.haul.length) return;
    var P = fampx()[d.fam];
    var ax = Math.round(isoX(RT.px, RT.py)), ay = Math.round(isoYA(RT.px, RT.py) - 34);
    var i, j, H, c, t, sx, sy, x, dist, steps, m, u, k, tf, a, bw, fam, tg;
    cx.save(); cx.textAlign = 'center';
    cx.font = 'bold 8px "Press Start 2P", monospace';
    for (i = 0; i < d.haul.length; i++) {
        H = d.haul[i]; t = d.t - H.t0;
        if (t < 0 || t > 0.42) continue;
        sx = Math.round(isoX(H.wx, H.wy));
        sy = Math.round(isoYA(H.wx, H.wy) - H.wh);
        /* THE ROPE, a run of 2px marks rather than a stroke. A diagonal
           stroke is the one soft edge a canvas gives you for free and
           this game has no soft edges; a rope of hard marks also makes
           the reach and the recoil a count rather than an alpha. */
        u = H.kind === 'refuse' && t > 0.11
            ? 1 - clamp((t - 0.11) / 0.08, 0, 1)    // whips back at twice the speed
            : clamp(t / 0.06, 0, 1) * (1 - clamp((t - 0.19) / 0.14, 0, 1));
        if (H.rope && u > 0.01) {
            dist = Math.sqrt((sx - ax) * (sx - ax) + (sy - ay) * (sy - ay));
            steps = Math.min(24, Math.round(dist / d.rope));
            cx.globalAlpha = 0.85 * u;
            cx.fillStyle = H.kind === 'refuse' ? '#6a5f72' : P.col;
            for (m = 0; m <= steps; m++) {
                k = m / Math.max(1, steps);
                if (k > u) break;
                cx.fillRect(Math.round(ax + (sx - ax) * k) - 1,
                            Math.round(ay + (sy - ay) * k) - 1, 2, 2);
            }
        }
        // the row jolts when the rope lets go of somebody who will not move
        if (H.kind === 'refuse' && t >= 0.11) sy += Math.round(1 - clamp((t - 0.11) / 0.08, 0, 1));
        for (j = 0; j < H.n; j++) {
            c = H.cells[j];
            fam = fampx()[c.fam] || P;
            x = Math.round(sx + (j - (H.n - 1) / 2) * PIP_W);
            tf = 0.06 + j * H.st;                   // the frame this cell flips
            if (H.kind === 'drop') {
                /* THE DROP. The whole pile spent for half damage, which
                   is the worst thing that can come out of the number
                   row, and it has looked exactly like a good drag since
                   the drag was written. It falls. Ease IN, because
                   nothing threw it. */
                k = clamp(t / 0.35, 0, 1);
                cx.globalAlpha = 1 - k;
                cx.fillStyle = '#08060c'; cx.fillText(c.t, x + 1, sy + 1 + Math.round(14 * k * k));
                cx.fillStyle = '#6a5f72'; cx.fillText(c.t, x, sy + Math.round(14 * k * k));
                continue;
            }
            if (H.kind === 'refuse') {
                /* THE REFUSAL. doRhyme's folk branch does nothing on
                   purpose and the comment there calls that refusal the
                   entire act. So the rope reaches them, goes taut,
                   holds 50ms and whips back, and NOTHING IN THE ROW
                   MOVES. They keep every letter. Four hundred years of
                   the same sound not moving, in eleven pixels of rope,
                   twenty-five times at once in the square. */
                cx.globalAlpha = 1;
                cx.fillStyle = '#08060c'; cx.fillText(c.t, x + 1, sy + 1);
                cx.fillStyle = FAMS[c.fam] ? FAMS[c.fam].glow : '#6a5f72';
                cx.fillText(c.t, x, sy);
                continue;
            }
            /* THE WIPE, one cell at a time, left to right, and the
               order is the whole reading of the move: something took
               hold of these and walked them over.
               The crossing is a BAR, not a white flash. drawCuts
               sweeps a 2px bar across a word and behind the bar the
               word is gone; a drag is a word being overwritten by a
               wrong rhyme that works anyway, which is the same gesture
               and is what the town did to the ballad
               (crit-art-proj 15). Ahead of the bar is the old sound,
               behind it is the new one, and there is no white and no
               crossfade. */
            a = clamp((t - tf) / 0.14, 0, 1);
            if (t < tf) {
                cx.globalAlpha = 1;
                cx.fillStyle = '#08060c'; cx.fillText(c.t, x + 1, sy + 1);
                cx.fillStyle = fam.glow; cx.fillText(c.t, x, sy);
            } else {
                var bx = x - 6 + Math.round(13 * clamp(a / 0.45, 0, 1));
                cx.globalAlpha = 1;
                cx.save();
                cx.beginPath(); cx.rect(bx, sy - 12, x + 7 - bx, 18); cx.clip();
                cx.fillStyle = '#08060c'; cx.fillText(c.t, x + 1, sy + 1);
                cx.fillStyle = fam.col; cx.fillText(c.t, x, sy);
                cx.restore();
                cx.save();
                cx.beginPath(); cx.rect(x - 7, sy - 12, bx - x + 7, 18); cx.clip();
                cx.fillStyle = '#08060c'; cx.fillText(P.tag3, x + 1, sy + 1);
                cx.fillStyle = P.glow; cx.fillText(P.tag3, x, sy);
                cx.restore();
                if (a < 0.45) { cx.fillStyle = P.glow; cx.fillRect(bx - 1, sy - 11, 2, 16); }
            }
            /* THE BAR, and the chip coming off it. Thirty-five percent
               of remaining life is what the drag charges and it has
               never been on screen. Now it is a length that visibly
               shortens on the frame the cell flips, and the piece it
               lost leaves. It also teaches the alpha ramp in
               drawStacks, which has never been legible, on the way
               past. */
            k = c.k == null ? 1 : c.k;
            if (t >= tf) k *= (1 - d.age);
            bw = Math.max(1, Math.round(11 * clamp(k, 0, 1)));
            cx.globalAlpha = 0.75;
            cx.fillStyle = 'rgba(8,6,12,.72)'; cx.fillRect(x - 5, sy + 4, 11, 1);
            cx.fillStyle = t >= tf ? P.col : fam.col; cx.fillRect(x - 5, sy + 4, bw, 1);
            a = t - tf;
            if (a >= 0 && a < 0.25) {
                cx.globalAlpha = 1 - a / 0.25;
                cx.fillStyle = '#c9484a';
                cx.fillRect(x - 5 + bw + Math.round(a * 40), sy + 4 - Math.round(a * 30), 1, 1);
            }
        }
    }
    cx.globalAlpha = 1;
    cx.restore(); cx.textAlign = 'left';
}

/* THE PATCH. A small plate over the break, in the colour of a thing
   nobody wrote down, with two nails in it. It is the only place in the
   game that draws what the town did to the ballad, it is drawn on the
   player for doing the same thing, and it is never explained. If it
   needs a label it has failed.
   ord 92, OVER the rule. design-deton-4 registered it at 86 and regFx
   sorts ascending, so the rule painted over eight of the fourteen
   pixels of a plate whose own comment says it goes over the break
   (crit-eng-deton B14).
   The plate is sized off the rule it is patching rather than being a
   fixed stamp, because a 14x8 plate under a 6px rule is a chip and not
   a repair (crit-art-deton 25). #3d3350 and not the invented #3a3340,
   which does not exist anywhere in comp/ninth.js (2.4). */
function drawSlantScreen(cx) {
    var d = RT.det;
    if (!d || RT.mapOpen || !d.K.brk || d.t < d.tset + 0.09) return;
    var R = detRule(d); if (!R.len || !R.gap) return;
    var rw = d.rule.w, w = 7 + rw, h = rw + 6, y = d.ruleY - 2 + detJolt(d);
    cx.save();
    cx.fillStyle = '#08060c'; cx.fillRect(VW / 2 - w, y - 1, w * 2, h + 2);
    cx.fillStyle = '#3d3350'; cx.fillRect(VW / 2 - w + 1, y, w * 2 - 2, h);
    cx.fillStyle = '#6a5f72';                       // the two nails
    cx.fillRect(VW / 2 - w + 3, y + 1, 1, 1);
    cx.fillRect(VW / 2 + w - 4, y + h - 2, 1, 1);
    // and the shim under the right hand half, because the join does not sit flat
    cx.fillRect(VW / 2 + w, d.ruleY + rw + detJolt(d), 4, 1);
    cx.restore();
}

/* ─────────────── the Reprise ───────────────
   It must get louder, and what gets louder is the line, not the
   bodies. The repeat gate has already taken the matter away from beats
   two and three: the bodies say it once, the room says it three times,
   and each time more of the line comes back and more voices say it.
   Escalation in typography, not in particles. */

/* The ladder. Everything that escalates across the three beats is in
   this table and nowhere else.
     words  how much of the line comes back
     ghost  voices behind the line, offset copies
     rule   multiplier on the overhang. 99 is edge to edge
     hold   added to the held frame
     px     the word at the player's feet
     ring   the ring on the floor */
var REP_BEAT = [
    { kind: 'rep1', words: 2, ghost: 0, rule: 1.0,  hold: 0.00, px: 13, ring: 9  },
    { kind: 'rep2', words: 4, ghost: 1, rule: 1.45, hold: 0.06, px: 15, ring: 13 },
    { kind: 'rep3', words: 6, ghost: 2, rule: 99,   hold: 0.14, px: 18, ring: 17 }
];

/* Post dressing, and the only place the Reprise touches a detonation.
   It runs on the frame detonate() returned, before anything has drawn
   and before stepDet has advanced d.t by one tick, so every field it
   changes is still a field nothing has read. */
function repDress(d, r, B) {
    d.rep = r.i + 1; d.repOf = r.of; d.ghost = B.ghost;
    repTrim(d, B.words);
    /* Edge to edge on the last beat: the rule leaves the screen on both
       sides, which is the one length that cannot be read as a number
       and is therefore the only honest way to say "all of it". */
    var base = d.half + Math.min(Math.round(6 + T('detRuleOver') * d.total), 190);
    var cap = Math.round(VW / 2 + 30);
    d.rule.half = B.rule >= 9 ? cap : Math.min(Math.round(base * B.rule), cap);
    d.hold += B.hold;
    if (B.ghost >= 2) d.cpl = 1;          // the bracket, over sounds that did not match
    detSegLay(d);                         // the pieces re-lay across the new rule
    d.life = d.tset + d.hold + d.out + 0.10 + d.rule.half / 900 + 0.08;
}
/* Keep the last few words and re-centre. Layout only, and it costs no
   measureText: every width is characters * px * PSA and has been on
   the records since assembleLine. Each slot moves by some dx and the
   overshoot target moves with it, because tx was sx plus a fixed nudge
   along the arrival direction and that direction has not changed. */
function repTrim(d, keep) {
    var ws = d.ws, i, tot = 0, x, was;
    if (ws.length > keep) ws = d.ws = ws.slice(-keep);
    for (i = 0; i < ws.length; i++) tot += ws[i].wd + d.gap;
    tot -= d.gap;
    x = Math.round(VW / 2 - tot / 2);
    for (i = 0; i < ws.length; i++) {
        was = ws[i].sx;
        ws[i].sx = x + Math.round(ws[i].wd / 2);
        ws[i].tx += ws[i].sx - was;
        x += ws[i].wd + d.gap;
    }
    d.half = Math.round(tot / 2);
}

/* THE UNDERLINE. One rule struck under each answering body's row per
   beat, so beat three has three stacked under every foe in the room.
   It is the big rule under the line, at body scale, and it is the only
   thing beats two and three add at the bodies: the repeat gate has
   taken their matter away on purpose and this is what fills the hole
   it left. Three fillRects a foe; sixteen in the Chorus loft is
   forty-eight rects and no particles at all. */
function drawRepWorld(cx) {
    var d = RT.det; if (!d || !d.rep || !d.tears || d.t > 0.34) return;
    var i, j, tr, sx, sy, w, k;
    cx.save();
    cx.fillStyle = fampx()[d.fam].col;
    for (i = 0; i < d.tears.length; i++) {
        tr = d.tears[i];
        k = clamp((d.t - tr.t0) / 0.05, 0, 1);
        if (k <= 0) continue;
        sx = Math.round(isoX(tr.wx, tr.wy));
        sy = Math.round(isoYA(tr.wx, tr.wy) - tr.wh);
        w = Math.round((tr.cells.length * PIP_W + 8) / 2 * k);   // struck from the centre out
        cx.globalAlpha = 0.9 * (1 - clamp((d.t - 0.18) / 0.16, 0, 1));
        for (j = 0; j < d.rep; j++) cx.fillRect(sx - w, sy + 7 + j * 3, w * 2, 1);
    }
    cx.globalAlpha = 1;
    cx.restore();
}
/* Three things, and the first outlives a single beat: RT.combat.rep is
   what holds the Reprise together while RT.det is replaced under it
   twice. */
function drawRepScreen(cx) {
    var r = RT.combat ? RT.combat.rep : null, d = RT.det;
    if (RT.mapOpen || (!r && (!d || !d.rep))) return;
    var i, j, w, x, y, a, k, col;
    cx.save();
    /* THE TALLY. Three marks. One is struck per beat and flashes to
       paper for 50ms; when the third lands the bracket closes over all
       three. It is the same bracket the couplet draws and it means the
       same thing, which is why it is not a progress bar and has no
       numbers on it. */
    if (r) {
        col = FAMS[r.fam] ? FAMS[r.fam].col : '#e8e2ee';
        y = Math.round(VH * 0.30) + 30;
        a = r.done > 0 ? clamp(r.done / 0.45, 0, 1) : 1;
        x = Math.round(VW / 2 - (r.of * 14 - 4) / 2);
        cx.globalAlpha = a;
        for (i = 0; i < r.of; i++) {
            k = r.mark.length > i ? r.age - r.mark[i] : -1;
            if (k < 0) { cx.fillStyle = '#3d3350'; cx.fillRect(x + i * 14, y + 4, 10, 2); continue; }
            cx.fillStyle = k < 0.05 ? '#e8e2ee' : col;
            cx.fillRect(x + i * 14, y, 10, 10);
        }
        if (r.mark.length >= r.of) bracket(cx, x, x + r.of * 14 - 4, y - 4, 5, a);
        cx.globalAlpha = 1;
    }
    if (!d || !d.rep || !d.ws) { cx.restore(); cx.textAlign = 'left'; return; }
    var jolt = detJolt(d), end = d.tset + d.hold, ko = d.t - end, wa = 1;
    if (ko > 0) wa = 1 - clamp((ko - (d.out - 0.06)) / 0.06, 0, 1);
    if (d.t < d.tset || wa <= 0) { cx.restore(); cx.textAlign = 'left'; return; }
    y = d.lineY + jolt;
    col = fampx()[d.fam].col;
    /* THE VOICES. The room joining in: one offset copy of the whole
       line on beat two, two on beat three, additive, slightly out of
       time. Not a chroma fringe and not a drop shadow: the offset is
       on both axes and the copies sit at a third of the alpha, so at a
       glance it is more mouths and not a blur. */
    cx.font = 'bold ' + d.wordPx + 'px "Press Start 2P", monospace';
    cx.textAlign = 'center';
    cx.globalCompositeOperation = 'lighter';
    for (j = 1; j <= (d.ghost || 0); j++) {
        a = (0.30 - 0.10 * (j - 1)) * wa;
        if (a <= 0.004) continue;
        cx.globalAlpha = a;
        cx.fillStyle = col;
        for (i = 0; i < d.ws.length; i++) {
            w = d.ws[i];
            cx.fillText(w.w, w.sx - (4 + 3 * j) * (j % 2 ? 1 : -1), y + j);
        }
    }
    cx.globalCompositeOperation = 'source-over';
    /* THE UNDERWRITING. A Reprise closes sounds that did not match, so
       every word in the line that is not the sound being said gets a
       1px rule under it in the sound's colour: the room putting its
       name to a word that did not rhyme. On the last beat they join
       into one stroke under the whole line, which is the same gesture
       the rule makes and is why this is a rule and not a highlight. */
    cx.globalAlpha = 0.8 * wa;
    cx.fillStyle = col;
    if (d.rep >= 3) {
        cx.fillRect(Math.round(VW / 2 - d.half), y + 5, d.half * 2, 1);
    } else {
        for (i = 0; i < d.ws.length; i++) {
            w = d.ws[i];
            if (w.fam === d.fam) continue;
            cx.fillRect(w.sx - Math.round(w.wd / 2), y + 5, w.wd, 1);
        }
    }
    cx.globalAlpha = 1;
    cx.restore(); cx.textAlign = 'left';
}

/* ─────────────── the recital and the Verse ───────────────
   Two set pieces that are not fired by a rhyme. They share the whole
   spine and diverge in exactly three places, all three of which are
   about whose line the syllables are ruling. */

/* THE REDIRECTION. Post dressing, from stanzaWave and versePulse.
     d     the detonation, or NULL when the room was empty
     L     the bigLine record this rule goes under, or NULL on the
           hidden tab catch-up path
     li    which line of the stanza, 0 to 3
     big   the fourth line: the landing
     file  keep this rule after the next detonation replaces it. A
           recital does. The Verse does not: its lines come every 260ms
           for seven seconds and seven frozen rules under lines that
           have expired is a ladder of marks in mid air.
   BOTH null cases are real and both used to throw. A stanza into an
   empty room returns no detonation, and design-deton-5's `if (!d)
   return;` then meant fxOf('stz').det was never set, no row was ever
   filed, and a recital cast into an empty room drew no rule under any
   of its four lines. That is also the whole of the Verse in the Act 3
   square, where hurtFoe returns 0 on folk before it does anything and
   there are zero legal targets: the climax of the game drew none of
   its seven rules (crit-eng-deton B13). And versePulse's catch-up path
   passes L as null explicitly, which was an unguarded
   measureText(null.txt) inside a setTimeout, and if the skipped stanza
   was the seventh it was a throw inside stepFx once per frame, which
   takes draw() with it: a black canvas until the record expires
   (crit-eng-deton B5).
   So the half that files a row needs neither d nor hits, and only the
   half that points the flyers at it needs d. */
function dressStanza(d, L, li, big, file) {
    var s = fxOf('stz'), cx = RT.cx, w, y;
    if (!L) { if (d) d.ws.length = 0; return; }
    /* the rule is measured off the line it goes under, once, here. 30px
       VT323 is what drawLines sets and this has to agree with it or the
       rule is the wrong width for the words above it. VT323 is not
       fixed pitch, so this is the one measureText in the whole section
       and it runs once per stanza line. */
    cx.save(); cx.font = '30px "VT323", monospace';
    w = Math.round(cx.measureText(L.txt).width);
    cx.restore();
    y = stzRowY(L);
    if (!d) {
        /* no hits. The row is still a true statement about the room:
           the line landed and nothing answered it. */
        s.rows.push({ L: L, li: li, y: y, len: Math.round(w / 2) + 9, w: big ? 3 : 2,
                      cap: 5, col: FAMS[(fxOf('stz').fam) || 'ight'].col, last: big ? 1 : 0, a: 1 });
        return;
    }
    d.ws.length = 0;                      // no words of yours over the words of the ballad
    d.stz = { L: L, i: li, last: big ? 1 : 0, file: file ? 1 : 0, fired: 0 };
    d.half = Math.round(w / 2);
    /* Math.max, because in the square there is nobody to send a
       syllable and d.total is 0: the overhang would be 6px and the
       rule would sit inside the line. A rule shorter than its own line
       is not a rule. */
    d.rule.half = d.half + Math.max(9, Math.min(Math.round(6 + T('detRuleOver') * d.total), 190));
    d.rule.w = big ? Math.max(3, d.rule.w) : d.rule.w;
    d.lineY = y - 13; d.ruleY = y;
    detSegLay(d);
    s.det = d;                            // stepStz watches this for the handoff
}
/* Where a live bigLine record is on screen RIGHT NOW. drawLines lays
   line i out at VH*0.3 + i*44 and RT.lines splices as lines expire, so
   the y of a line that has not moved changes whenever an older one
   dies. indexOf on an array never longer than six, four times a frame,
   is cheaper than any alternative and cannot go stale.
   design-deton-5 set d.ruleY once from a constant and never re-pointed
   it, so during a recital the rule was drawn 65 pixels above the words
   it was ruling and the syllables converged on empty screen, and then
   the finished rule jumped 78px down onto the line at the handoff
   (crit-eng-deton B4). */
function stzRowY(L) {
    var i = RT.lines.indexOf(L);
    return (i >= 0 ? Math.round(VH * 0.3 + i * 44) : (L._y || Math.round(VH * 0.3))) + 13;
}

/* THE STANZA LAYER. Four finished rules and the bracket around the two
   that rhyme. RT.det is a singleton, replaced and not queued, and a
   recital replaces it every 0.375s: when the second line's detonation
   arrives the first line's rule is already a fact about the world and
   stops being an animation. That is what this layer is for. */
function stepStz(dt, real, s) {
    var d = RT.det, r = null;
    if (s.det && s.det !== d) {
        /* THE HANDOFF. Whatever the flyers built is finished and
           becomes a row. detRule is a pure reader so asking it one
           last time costs a walk over the flyers and changes nothing. */
        if (s.det.stz && s.det.stz.file && s.det.stz.L) {
            r = { L: s.det.stz.L, li: s.det.stz.i, y: s.det.ruleY, len: detRule(s.det).len,
                  w: s.det.rule.w, cap: s.det.rule.cap, col: fampx()[s.det.fam].col,
                  last: s.det.stz.last, a: 1 };
            s.rows.push(r);
        }
        s.det = null;
    }
    if (d && d.stz) {
        if (d.stz.L) { d.ruleY = stzRowY(d.stz.L); d.lineY = d.ruleY - 13; }
        /* THE SLAM, at TSET, one per stanza and one in the whole Verse.
           The last line's rhyme word used to be printed as a 22px sub
           under a 30px line, and it is the word the stanza is built to
           arrive at. It is not a subtitle. It is the sound. */
        if (d.stz.last && d.stz.L && !d.stz.fired && d.t >= d.tset) {
            d.stz.fired = 1;
            slam(stzWord(d.stz.L.txt), fampx()[d.fam].col, FAMS[d.fam].n,
                 { fam: d.fam, power: Math.max(9, d.total), kind: 'close',
                   x: RT.px, y: RT.py, sy: VH * 0.62,
                   bx: VW / 2, by: d.lineY + 6, flat: 0.28 });
        }
        s.det = d;
    }
    /* the block goes out together, half a second after the recital
       ends, so the bracket has time to be read. Real clock: it is
       typography. */
    if (!RT.recital && !RT.verseCast && s.rows.length) {
        for (var i = s.rows.length - 1; i >= 0; i--) {
            s.rows[i].a -= real * 2.2;
            if (s.rows[i].a <= 0) s.rows.splice(i, 1);
        }
    }
}
/* the rhyme word of a line: its last word, stripped of what the ballad
   punctuates it with. */
function stzWord(ln) { return ln.split(' ').pop().replace(/[.,]/g, '').toUpperCase(); }

function drawStzScreen(cx, dt, s) {
    if (!s.rows.length || RT.mapOpen) return;
    var i, r, y, two = null, four = null;
    cx.save();
    for (i = 0; i < s.rows.length; i++) {
        r = s.rows[i]; if (r.len <= 0) continue;
        y = r.y = stzRowY(r.L);
        cx.globalAlpha = clamp(r.a, 0, 1);
        cx.fillStyle = '#08060c';
        cx.fillRect(VW / 2 - r.len + 1, y + 1, r.len * 2, r.w);
        cx.fillStyle = r.col;
        cx.fillRect(VW / 2 - r.len, y, r.len * 2, r.w);
        cx.fillStyle = PX_BRASS;
        cx.fillRect(VW / 2 - r.len, y - Math.round(r.cap / 2), 2, r.cap + r.w);
        cx.fillRect(VW / 2 + r.len - 2, y - Math.round(r.cap / 2), 2, r.cap + r.w);
        /* by the STANZA LINE INDEX, not by the position in this array.
           stepStz splices rows out as they fade, so once row 0 has gone
           the old row 1 sits at index 0 and the bracket jumps a line up
           on the frame the first rule dies (crit-eng-deton N7). */
        if (r.li === 1) two = r; else if (r.li === 3 || r.last) four = r;
    }
    /* THE COUPLET, at stanza scale. The ballad rhymes ABCB: heard/word,
       mark/dark, sill/will. Lines two and four are the couplet and this
       is the only place in the game where both halves of one are on the
       canvas at the same time, which is why the recital's lines were
       given durations that keep them there. The same bracket, at a
       second span. */
    if (two && four) {
        var l = Math.min(two.len, four.len);
        bracket(cx, VW / 2 - l, VW / 2 + l, two.y, four.y - two.y,
                clamp(Math.min(two.a, four.a), 0, 1) * 0.9);
    }
    cx.globalAlpha = 1;
    cx.restore(); cx.textAlign = 'left';
}

/* The colour of each stanza of the corrected ballad, off its own
   rhyme. Two of the seven are null and that is the point: -oo and -and
   are sounds the game never gave you a word for, so those two stanzas
   come out in paper rather than in a family colour. The ballad is
   bigger than your spellbook and this is the only place that says so.
   MECHANICALLY the pulse stays hurtFoe(f, 999, 'ight') exactly as it
   is: routing the damage through five families would put five
   resistance tables and famDmgMul between the last cast in the game
   and its own kill. */
var VERSE_FAM = ['eat', null, 'erd', 'ark', 'ight', null, 'ill'];
function verseCol(k) { var f = VERSE_FAM[k]; return f ? FAMS[f].col : '#e8e2ee'; }
var VRS_TOP = 22, VRS_PITCH = 5, VRS_COLW = 26;
function verseCols() {
    var cols = [], k, j, st, m;
    for (k = 0; k < BALLAD.length; k++) {
        st = BALLAD[k]; m = [];
        for (j = 0; j < st.r.length; j++)
            m.push({ w: clamp(Math.round(st.r[j].length * 0.36), 10, 22), lit: 0, t: 0 });
        cols.push({ m: m, col: verseCol(k), brk: st.brk ? 1 : 0, fall: 0, done: 0 });
    }
    return cols;
}
function vrsX(k) { return Math.round(VW / 2 + (k - (BALLAD.length - 1) / 2) * VRS_COLW); }
/* Real clock, all of it. The column is typography and the crowd under
   it is matter, and the whole point of the Verse is that you can see
   which is which. */
function stepVrs(dt, real, s) {
    if (!s.cols) return;
    var k, j, c;
    for (k = 0; k < s.cols.length; k++) {
        c = s.cols[k];
        if (c.fall > 0) c.fall += real;
        for (j = 0; j < c.m.length; j++) if (c.m[j].t > 0) c.m[j].t -= real;
    }
    s.life -= real;
    if (s.life < 0.6) s.a = clamp(s.life / 0.6, 0, 1);
    if (s.life <= 0) { s.cols = null; s.a = 1; }
}
function drawVrsScreen(cx, dt, s) {
    if (!s.cols || RT.mapOpen) return;
    var k, j, c, m, x, y, l, py, hw;
    cx.save();
    for (k = 0; k < s.cols.length; k++) {
        c = s.cols[k]; x = vrsX(k);
        for (j = 0; j < c.m.length; j++) {
            m = c.m[j]; y = VRS_TOP + j * VRS_PITCH; hw = m.w >> 1;
            cx.globalAlpha = s.a;
            if (!m.lit) { cx.fillStyle = '#3d3350'; cx.fillRect(x - hw, y, m.w, 2); continue; }
            cx.fillStyle = '#08060c'; cx.fillRect(x - hw + 1, y + 1, m.w, 2);
            cx.fillStyle = m.t > 0 ? '#e8e2ee' : c.col;      // one frame of paper, then the ink
            cx.fillRect(x - hw, y, m.w, 2);
            cx.fillStyle = PX_BRASS;                          // the same end caps, at 1/40 scale
            cx.fillRect(x - hw, y - 1, 1, 4);
            cx.fillRect(x + hw - 1, y - 1, 1, 4);
            /* the tick: the line arriving, 2px over its own mark, 220ms.
               The same mark a rule end gets when a syllable lands on
               it. Same event, same mark. */
            if (m.t > 0) { cx.globalAlpha = s.a * clamp(m.t / 0.22, 0, 1); cx.fillRect(x - 1, y - 4, 2, 2); }
        }
        /* THE BRACKET, third span, same geometry. The ballad rhymes
           ABCB, so lines two and four are the couplet, and in the
           corrected version every one of the seven closes. The false
           line is the one place this can never be drawn, because the
           false line does not rhyme. */
        if (c.done) bracket(cx, x - (Math.min(c.m[1].w, c.m[3].w) >> 1),
                            x + (Math.min(c.m[1].w, c.m[3].w) >> 1),
                            VRS_TOP + VRS_PITCH, VRS_PITCH * 2 + 2, s.a * 0.9);
        /* THE PATCH, and it coming off. Three of the seven stanzas
           carry one. It sits on the last mark from the first frame of
           the song, and on the frame that line is finally sung the
           nails go and the plate drops off the bottom of the screen.
           Nothing says so. */
        if (c.brk) {
            py = c.fall > 0 ? Math.round(900 * c.fall * c.fall) : 0;
            if (py > VH) continue;
            y = VRS_TOP + VRS_PITCH * 3 - 2 + py;
            cx.globalAlpha = s.a;
            cx.fillStyle = '#08060c'; cx.fillRect(x - 8, y - 1, 16, 8);
            cx.fillStyle = '#3d3350'; cx.fillRect(x - 7, y, 14, 6);
            if (!c.fall) {
                cx.fillStyle = '#6a5f72';
                cx.fillRect(x - 5, y + 1, 1, 1); cx.fillRect(x + 4, y + 4, 1, 1);
            }
        }
    }
    cx.globalAlpha = 1;
    cx.restore();
}

/* ─────────────── the projectile layer ───────────────
   The row, the impact, the fizz, sour, and the mouth. One registry
   row, one ord, one sort, and every record in it is world tiles and
   the real clock: nothing here is aged inside a drawer, because
   devDemo calls draw() bare and __ninth.tick steps then draws, so a
   draw-side timer advances on frames that never simulated. */

/* THE ROW. One cell per syllable, 13px pitch, the width the file has
   always used and now a named constant because four other things read
   it back out: the tear, the haul, the flyer's launch offset and the
   Reprise underline all reconstruct this layout, and design-proj's
   pipScale would have moved it under them.
   pipScale is CUT. It scaled four literals out of eleven, so at 1.3 it
   gave a 30% bigger empty box around the same 8px text and at 0.7 it
   put the baseline below the plate (crit-eng-proj 12), and with one
   glyph per cell the thing it was for is gone. */
var PIP_W = 13, PIP_ORD = [];
/* 3.0.4's closed set, in one place. The five pip drawers each fillText
   their own letter and nothing outside them could name it, which the
   spill and the sour break both need: a cell coming off the row has to
   be the sound you lost and not a generic chip. -erd's cell is empty
   on purpose and stays empty here, so a spilled -erd cell is a bare
   plate, which is exactly that family's read. */
var PIP_GLYPH = { eat: 'E', ight: 'I', erd: '', ark: 'K', ill: 'L' };

/* firstFoeAt returns the foe; this returns how far the nearest live
   one is, in tiles, past its own radius. Same loop, one more subtract,
   and it is what makes every family's arrival beat reachable.
   The old c.near was a ramp between the proximity ring at 1.15 + f.r
   and the hit at 0.45 + f.r, which is a constant 0.70 tiles for every
   enemy in the game and 54ms at 13 tiles/s: near peaked at 0.48 and
   five of the six last-frames beats never fired (crit-eng-proj 2). */
function nearFoeD(x, y, skip) {
    var best = 99, i, f, dd;
    for (i = 0; i < RT.foes.length; i++) {
        f = RT.foes[i];
        if (f.dead || (skip && skip.indexOf(f) >= 0)) continue;
        dd = Math.hypot(f.x - x, f.y - y) - f.r;
        if (dd < best) best = dd;
    }
    return best;
}

/* The sound coming apart. One wrong letter, from a fixed table, drawn
   for 0.06s in the colour of a thing nobody wrote down, before the
   cell breaks. It is one fillText and it is the whole thesis of the
   game in a glyph. EAT goes to EAR, IGHT to IGHS, ARK to ARM, ILL to
   ILT, and nothing explains it.
   Keyed off the family rather than the pip glyph, so it survives
   whatever -erd does with its empty cell: -erd's off-rhyme is the one
   case where a mark APPEARS in the empty slot, which is the hole in
   the song filling with the wrong thing. */
var RIME_OFF = { eat: 'R', ight: 'S', erd: 'T', ark: 'M', ill: 'T' };

/* The row moves out of the body pass and is drawn from here, at ord
   70, which is AFTER drawLights and AFTER drawVignette: it stops being
   the darkest magic on screen and becomes as bright as the detonation
   that spends it. Painter order is preserved by sorting into a
   module-scope scratch array on f.x + f.y, exactly the key ents uses,
   with the length reset each frame so there is no steady-state
   allocation. */
function drawPips(cx) {
    var i, f;
    psaBoot(cx);
    PIP_ORD.length = 0;
    for (i = 0; i < RT.foes.length; i++) {
        f = RT.foes[i];
        if (f.dead || !f.stacks.length) continue;
        if (f.rowT > 0) continue;             // the haul owns this row for 0.42s (4.6.2)
        PIP_ORD.push(f);
    }
    PIP_ORD.sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
    for (i = 0; i < PIP_ORD.length; i++) {
        f = PIP_ORD[i];
        drawStacks(cx, f, Math.round(isoX(f.x, f.y)), Math.round(foeStackY(f)));
    }
    PIP_ORD.length = 0;                       // nothing in FX holds an f past the frame
}

/* THE FIZZ. A call that hits nothing is "she asked and nobody
   answered", mechanically, and it used to be spliced out of RT.calls
   and produce nothing at all. It hangs first: full size, full colour,
   dead still, for 0.22s at the point it ran out, and then it falls.
   No particles. The silence is the point. */
function callFizz(c) {
    fxOf('proj').lands.push({ kind: 'fizz', wx: c.x, wy: c.y, fam: c.fam,
                              txt: c.word, t: 0, life: 0.72 });
    fxSfx('callfizz', 0.15);
}

/* SOUR, the break itself.
     full  this is one of the first three of a burst, so it gets the
           whole treatment. Past the third it is pieces only, half
           size, no thread: scale the information, not the assault
     mine  it cost you. A Droner's own word ending is visible without
           being visible that it cost you, which is the one thing the
           old grey "lapses" typo could not say
   Two records per lapse, drawn as a triangular clip from opposite
   corners with the plate, the glyph and the border inside it. drawCuts
   already established clipping a word mid-letter as this game's idiom
   for a line that did not get finished, and a sour stack is exactly
   that. Both halves carry the off-rhyme glyph, because by the time the
   plate splits the sound has already gone wrong; the LEAD frames draw
   the intact cell once, off half 0, so the wrong letter is not inked
   twice. */
function sourBreak(f, s, full, mine) {
    var q = fxOf('proj'), P = fampx()[s.fam] || fampx().eat, i, o;
    var wh = foeH(f) + 18 + (f.so || 0);
    var g = RIME_OFF[s.fam] || 'R';
    for (i = 0; i < 2; i++) {
        if (q.sours.length > 24) break;       // a hard ceiling: this is a failure, not a firework
        o = { kind: 'sour', wx: f.x, wy: f.y, wh: wh, fam: s.fam, glyph: g, half: i,
              ox: 0, oy: 0, vx: (i ? 28 : -28) * (full ? 1 : 0.6), vy: -34,
              rot: 0, spin: rnd(-7, 7), sc: full ? 1 : 0.5, mine: mine ? 1 : 0,
              t: 0, life: 0.61 };
        q.sours.push(o);
    }
    /* THE BILL TRAVELS TO YOU. Both endpoints are world tiles,
       projected in the drawer, and the contraction is a k0 stepped in
       stepProj rather than a lerp of stored screen pixels mutated
       inside a draw call (crit-eng-proj 6, 7). */
    if (mine && full && q.sours.length <= 24) {
        q.sours.push({ kind: 'thread', wx: f.x, wy: f.y, wh: wh, k0: 0, t: 0, life: 0.22 });
    }
    spray(f.x, f.y, 30, full ? 5 : 2, -1.57, 1.4,
          { col: mine ? '150,60,72' : '106,95,114',
            sp0: 0.1, sp1: 0.6, l0: 0.2, l1: 0.5, grav: 190, add: 0 });
}

/* One stepper for everything in this layer, and for the four row
   timers, all on the REAL clock because all of them are typography.
   s.fly, s.slT, f.rowT and RT.said.t are aged here and nowhere else:
   none of them may be aged in a drawer. */
function stepProj(dt, real, s) {
    var i, j, o, f, st, q = s.q;
    for (i = s.lands.length - 1; i >= 0; i--) {
        o = s.lands[i]; o.t += real;
        if (o.t >= o.life) s.lands.splice(i, 1);
    }
    for (i = s.sours.length - 1; i >= 0; i--) {
        o = s.sours[i]; o.t += real;
        if (o.t >= o.life) { s.sours.splice(i, 1); continue; }
        /* the halves hold for the off-rhyme frames and then fall.
           grav 260, and the spin is stamped once at the break, so a
           held frame or a second pass draws the same picture. */
        if (o.kind === 'sour' && o.t > 0.06) {
            o.ox += o.vx * real; o.oy += o.vy * real;
            o.vy += 260 * real; o.rot += o.spin * real;
        }
        if (o.kind === 'thread') o.k0 = clamp(o.t / o.life, 0, 1);
    }
    for (i = 0; i < RT.foes.length; i++) {
        f = RT.foes[i];
        if (f.rowT > 0) f.rowT -= real;
        for (j = 0; j < f.stacks.length; j++) {
            st = f.stacks[j];
            if (st.fly > 0) st.fly -= real;
            if (st.slT > 0) st.slT -= real;
        }
    }
    /* the fifty milliseconds in which the board has heard you and not
       yet answered (4.0.3). It is the beat T0 was short of. */
    if (RT.said) { RT.said.t -= real; if (RT.said.t <= 0) RT.said = null; }
    /* One number, one red, one event, however many lapsed. RT.hp -= in
       breakStack bypassed hurtPlayer and therefore the i-frames and the
       screen reaction every other damage source in the game gets, and
       it was also the one source that never popped a number. Rounded,
       because breakSelfDmg is DEV settable and 2.5 x 3 prints -7.5. */
    if (q.t > 0) {
        q.t -= real;
        if (q.t <= 0) {
            if (!RT.god) hurtPlayer(Math.round(q.hp), 'sour');
            if (q.n > 1) typo(RT.px, RT.py + 0.55, q.n + ' lapsed', '#6a5f72', 0.6, 8, 'drift');
            fxSfx(q.n >= 3 ? 'sourmulti' : 'sour', 0.05);
            q.n = 0; q.hp = 0;
        }
    }
}

/* The single world pass for the whole projectile layer, in this
   internal order: the rows far to near, then the impact records, then
   the sour pieces and their threads, then the muzzle. */
function drawProjWorld(cx, dt, s) {
    var i, j, o, P, sx, sy, k, u, held, size, wy, gk, gr, a2, l2, cut, adv, x0, col;
    var px2, py2, tx, ty, mx, my;
    drawPips(cx);
    /* THE IMPACTS. World tiles, so a 0.24s record cannot slip fifty
       pixels sideways while the camera eases on the road north
       (crit-eng-proj 7). */
    for (i = 0; i < s.lands.length; i++) {
        o = s.lands[i]; P = fampx()[o.fam];
        sx = Math.round(isoX(o.wx, o.wy));
        sy = Math.round(isoYA(o.wx, o.wy));
        if (o.kind === 'fizz') {
            /* IT HANGS FIRST. Dead still at full colour for 0.22s, and
               then it falls 22px over 0.5s. It greys through rimeText's
               dim, crossfaded over the ordinary head-dim tail-bright
               split, so the rhyming tail is the last colour to leave:
               a question hanging in the air and then dropping. */
            u = Math.max(0, o.t - 0.22) / 0.5;
            k = clamp((o.t - 0.28) / 0.34, 0, 1);
            cx.save();
            cx.font = 'bold 12px "Press Start 2P", monospace';
            wy = sy - 26 + Math.round(22 * u);
            if (k < 1) {
                cx.globalAlpha = (1 - u) * (1 - k);
                rimeText(cx, o.txt, sx, wy, P, 12);
            }
            if (k > 0) {
                cx.globalAlpha = (1 - u) * k;
                rimeText(cx, o.txt, sx, wy, P, 12, '#6a5f72');
            }
            cx.globalAlpha = 1;
            cx.restore();
            continue;
        }
        /* THE STAMP, on the ground plane at the standard 1:0.5. Four
           1px cracks at the GROUND FRAME angle, a + PI/4, because
           inside a scale(1, 0.5) the iso basis is a 45 degree
           rotation and the raw world angle is up to 63 degrees out.
           They are unconditional now: crit-art-proj 13 found every
           impact quantity linear in n and nothing ever changing kind,
           while the audio layer already switches sample at five. */
        if (o.t < 0.18) {
            gk = o.t / 0.18;
            gr = (0.35 + 0.05 * o.n + 0.25 * o.frac) * (1 - gk * 0.4) * TILE_W / 2;
            cx.save();
            cx.translate(sx, sy); cx.scale(1, 0.5);
            cx.globalCompositeOperation = 'lighter';
            cx.globalAlpha = 0.22 * (1 - gk); cx.fillStyle = P.col;
            cx.beginPath(); cx.arc(0, 0, gr, 0, TAU); cx.fill();
            cx.globalAlpha = 0.34 * (1 - gk); cx.strokeStyle = P.col; cx.lineWidth = 1;
            cx.beginPath();
            for (j = 0; j < 4; j++) {
                a2 = o.a + Math.PI / 4 + j * 1.57;
                l2 = 6 + 5 * o.frac;
                cx.moveTo(Math.round(Math.cos(a2) * gr), Math.round(Math.sin(a2) * gr));
                cx.lineTo(Math.round(Math.cos(a2) * (gr + l2)), Math.round(Math.sin(a2) * (gr + l2)));
            }
            cx.stroke();
            cx.restore();
        }
        /* THE HOLD. Everything typographic in this game starts moving
           on the frame it appears, and the one thing that sells a hit
           is a frame where nothing does. A heavier pile holds it
           longer: 65ms at one syllable, 170ms at eight. */
        held = o.t < o.hold;
        size = clamp(13 + 0.7 * o.n + 3 * o.frac, 13, 22) * 1.55;
        wy = sy - 30;
        cx.save();
        cx.font = 'bold ' + size.toFixed(1) + 'px "Press Start 2P", monospace';
        if (held) {
            /* AT FIVE THE WORD IS DOUBLE STRUCK, the same mark a
               couplet gets, because a deep pile and a couplet are the
               same statement: this sound, again. */
            if (o.cpl || o.n >= 5) {
                cx.globalAlpha = 0.55;
                rimeText(cx, o.txt, sx - 2, wy - 2, P, size);
                cx.globalAlpha = 1;
            }
            rimeText(cx, o.txt, sx, wy, P, size);
        } else {
            /* THE WORD BREAKS AND THE SOUND STAYS. The head glyphs
               fall away as grey matter on grav 210; the tail, which
               rimeCut has already isolated and which has been drawn as
               a separate colour since the muzzle, is not drawn here at
               all, because it is flying into its slot in the row and
               drawStacks owns it from this frame on. One word arrives,
               breaks, and the sound is what stays. */
            u = o.t - o.hold;
            cut = rimeCut(o.txt, o.fam);
            adv = size * PSA;
            x0 = Math.round(sx - o.txt.length * adv / 2);
            cx.globalAlpha = clamp(1 - u / 0.19, 0, 1);
            cx.textAlign = 'left';
            for (j = 0; j < cut.hd.length; j++) {
                k = Math.round(105 * u * u) + j;      // grav 210, halved, plus a stagger
                cx.fillStyle = '#08060c';
                cx.fillText(cut.hd.charAt(j), x0 + Math.round(j * adv) + 1, wy + k + 1);
                cx.fillStyle = '#6a5f72';
                cx.fillText(cut.hd.charAt(j), x0 + Math.round(j * adv), wy + k);
            }
            cx.textAlign = 'center';
            cx.globalAlpha = 1;
        }
        cx.restore();
    }
    /* THE SOUR PIECES, and the thread that carries the bill. */
    cx.save();
    cx.font = 'bold 8px "Press Start 2P", monospace';
    for (i = 0; i < s.sours.length; i++) {
        o = s.sours[i];
        sx = Math.round(isoX(o.wx, o.wy));
        sy = Math.round(isoYA(o.wx, o.wy) - o.wh);
        if (o.kind === 'thread') {
            /* it eats itself from the foe end, so the line arrives
               rather than merely fading. Quadratic, 14px of sag, one
               pixel wide, and the number lands when it does. */
            tx = Math.round(isoX(RT.px, RT.py));
            ty = Math.round(isoYA(RT.px, RT.py) - 20);
            px2 = lerp(sx, tx, o.k0); py2 = lerp(sy, ty, o.k0);
            mx = (px2 + tx) / 2; my = (py2 + ty) / 2 + 14;
            cx.globalAlpha = clamp(1 - o.k0, 0, 1) * 0.55;
            cx.strokeStyle = 'rgba(201,72,74,.55)'; cx.lineWidth = 1;
            cx.beginPath(); cx.moveTo(px2, py2);
            cx.quadraticCurveTo(mx, my, tx, ty);
            cx.stroke();
            continue;
        }
        if (o.kind === 'spill') {
            /* THE OVERFLOW. The cap used to bin the oldest syllable in
               silence: four breath vanishing with no pixel. Now the
               glyph tumbles off the left end of the row, greys, and
               falls 22px. No damage and no red, because a tag falling
               off a full plate reads instantly as "that one was
               wasted". */
            k = clamp(o.t / o.life, 0, 1);
            P = fampx()[o.fam] || fampx().eat;
            cx.globalAlpha = 1 - k;
            cx.textAlign = 'center';
            cx.fillStyle = 'rgb(' + mixRgb(P.rgb, '106,95,114', clamp(k / 0.35, 0, 1)) + ')';
            cx.fillText(PIP_GLYPH[o.fam] == null ? '' : PIP_GLYPH[o.fam],
                        sx + Math.round(o.ox) - Math.round(k * 9),
                        sy + Math.round(22 * k * k));
            continue;
        }
        P = fampx()[o.fam] || fampx().eat;
        if (o.t < 0.06) {
            /* THE OFF-RHYME, and it is drawn once, off half 0, so the
               wrong letter is not inked twice. The premise of the game
               is that a false line does not rhyme and you can hear the
               join, and this is that in one glyph. */
            if (o.half) continue;
            cx.globalAlpha = o.mine ? 1 : 0.6;
            cx.textAlign = 'center';
            cx.fillStyle = 'rgba(8,6,12,.72)';
            cx.fillRect(sx - 6, sy - 10, 12, 14);
            cx.fillStyle = '#6a5f72';
            cx.fillText(o.glyph, sx, sy);
            continue;
        }
        /* THE CELL BREAKS. Not a fade: the plate splits on a diagonal
           and the two halves fall, going grey on the way down. The
           pieces must START in the family colour or the player cannot
           tell which sound they just lost, and losing the last -ill on
           a nearly dead elite is a very different mistake from losing
           a spare -eat. It starts as the sound and ends as grey. */
        k = clamp((o.t - 0.06) / (o.life - 0.06), 0, 1);
        col = mixRgb(P.rgb, '106,95,114', clamp(k / 0.35, 0, 1));
        cx.save();
        cx.translate(sx + Math.round(o.ox), sy + Math.round(o.oy));
        cx.rotate(o.rot); cx.scale(o.sc, o.sc);
        cx.globalAlpha = clamp(1 - k, 0, 1) * (o.mine ? 1 : 0.6);
        cx.beginPath();
        if (o.half) { cx.moveTo(-7, -11); cx.lineTo(7, -11); cx.lineTo(7, 4); }
        else { cx.moveTo(-7, -11); cx.lineTo(7, 4); cx.lineTo(-7, 4); }
        cx.closePath(); cx.clip();
        cx.fillStyle = 'rgba(8,6,12,.86)'; cx.fillRect(-7, -11, 14, 15);
        cx.strokeStyle = 'rgba(' + col + ',.55)'; cx.lineWidth = 1;
        cx.strokeRect(-6.5, -10.5, 13, 14);
        cx.textAlign = 'center';
        cx.fillStyle = 'rgb(' + col + ')';
        cx.fillText(o.glyph, 0, 0);
        cx.restore();
    }
    cx.globalAlpha = 1;
    cx.restore();
    drawMuzzle(cx);
    cx.textAlign = 'left';
}

/* THE MOUTH. design-proj anchored this at the lantern hand, derived by
   reading drawActor's transform stack, so the single most important
   gesture in the game came out of a lamp 0.13s after drawActor had
   already swelled that same lamp in rgba(255,190,90): two lights of
   two different colours out of one fist every 0.19s forever, and the
   player reads the lantern as the wand. She is not a mage with a lamp,
   she is a woman saying something out loud while holding a light she
   will not hand over. So it is at the mouth, with the actor's own bob
   subtracted so it does not detach while walking.
   AND THE CONE IS DELETED. The mouth flash is the word itself, at 0.55
   scale, so the first thing you see is the word leaving and getting
   bigger. That is "spells are words getting bigger" delivered on frame
   one instead of asserted in a doctrine note. */
function drawMuzzle(cx) {
    var C = RT.casting;
    if (!C || !C.fam) return;
    var k = clamp(C.t / C.max, 0, 1), P = fampx()[C.fam];
    var big = C.max > 0.18 ? 1.9 : 1;      // a rhyme is not aimed at anything
    var west = faceX(Math.cos(RT.face), Math.sin(RT.face));   // screen x is (x - y), see faceX
    var bob = RT.walking ? Math.sin(RT.t * 12) * 1.8 : Math.sin(RT.t * 2.2) * 0.7;
    var hx = Math.round(isoX(RT.px, RT.py) + west * 4);
    var hy = Math.round(isoYA(RT.px, RT.py) - 38 - bob);
    var wpx = 12 * 0.55 * big, r = Math.round((4 + (1 - k) * 11) * big);
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    if (C.word) {
        cx.globalAlpha = 0.5 * k;
        cx.font = 'bold ' + wpx.toFixed(1) + 'px "Press Start 2P", monospace';
        rimeText(cx, C.word, hx, hy, P, wpx);
    }
    // the expanding ring stays, and it is the whole gesture for a rhyme
    cx.globalAlpha = 0.6 * k; cx.strokeStyle = P.glow; cx.lineWidth = 1;
    cx.beginPath(); cx.arc(hx, hy, r, 0, TAU); cx.stroke();
    if (C.cpl) {                           // the couplet mark: tighter, and harder
        cx.globalAlpha = 0.84 * k; cx.strokeStyle = P.col;
        cx.beginPath(); cx.arc(hx, hy, Math.round(r * 0.7), 0, TAU); cx.stroke();
    }
    cx.globalAlpha = 1;
    cx.restore(); cx.textAlign = 'left';
}

/* Registered from the foot of the file, beside combatBoot(), for the
   reason the comment at 8249 gives about KEYS: onPlaceChange writes
   into RESETS and every var these lines name is declared above, but a
   module-scope call up in the banner runs before the function
   declarations further down the file are reachable in the order a
   reviewer expects. One boot, one place, no ordering to remember. */
function fxBoot() {
    punchBoot();                 // the family colour tables, derived off FAMS
    /* the five sounds' own ramps, all derived off FAMS through
       hex2rgb and rgbMul so they cannot drift, and all here rather
       than at module scope for the reason the comment above gives
       about hex2rgb. Each family's regFam() has already run; only the
       colours wait for the boot. */
    eatBoot(); ightBoot(); erdBoot(); arkBoot(); illBoot();
    /* the detonation and its four dependants. Every family adds its own
       regFx line beside its own code, not here. */
    regFx('det',  stepDet, drawDetWorld,  { screen: drawDetScreen, ord: 90, make: fxNul });
    regFx('haul', null,    drawHaulWorld, { ord: 86, make: fxNul });
    regFx('mend', null,    null,          { screen: drawSlantScreen, ord: 92, make: fxNul });
    regFx('rep',  null,    drawRepWorld,  { screen: drawRepScreen, ord: 87, make: fxNul });
    regFx('dim',  null,    null,          { screen: drawRoomDown, ord: 88, make: fxNul });
    regFx('line', null,    null,          { screen: drawFamLine, ord: 90.5, make: fxNul });
    regFx('stz',  stepStz, null,          { screen: drawStzScreen, ord: 91,
                                            make: function () { return { rows: [], det: null }; } });
    regFx('vrs',  stepVrs, null,          { screen: drawVrsScreen, ord: 93,
                                            make: function () { return { cols: null, i: 0, life: 0, a: 1 }; } });
    regFx('punch', stepPunch, null,       { ord: 99, make: punchMake });
    /* the whole projectile layer through one seam: drawProjWorld draws
       the rows far to near through PIP_ORD, then the impact records,
       then the sour pieces and their threads, then the muzzle. One
       registration, one ord, one sort. */
    regFx('proj', stepProj, drawProjWorld, { ord: 70,
          make: function () { return { lands: [], sours: [], q: { n: 0, hp: 0, t: 0 } }; } });
    /* ONE reset for the whole effects layer, and it takes the four
       legacy arrays with it. gotoPlace clears foes, fproj, calls,
       beats, typo, slams and lines (6124-6125) and has never cleared
       parts, snaps, rings or the assembly, so all four have always
       walked through a doorway and kept drawing at tile coordinates
       that mean something else in the next room. All eight areas asked
       for this once, here, rather than eight times. */
    onPlaceChange(function () {
        if (!RT) return;
        RT.fx = {};
        RT.det = null; RT.said = null;
        PIP_ORD.length = 0;               // it holds foe references from the last drawn frame
        // rings is uncapped, never cleared by gotoPlace, and the drag pushes one
        RT.parts.length = 0; RT.snaps.length = 0; RT.rings.length = 0;
        RT.assembly = null;
        RT.shake = 0; RT.chroma = 0; RT.flash = 0;
        FX_T = 0; FX_SFX = {};
    });
}
function fxNul() { return {}; }

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

   Every word you own sits in a bag. The line deals them face up: the
   one on your tongue and the ones you can see coming. It always keeps
   one back, so it is four cards once you know five words and three
   before that, and swallowing can always hand you something else. Left
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
    // Last resort, and the order matters: a duplicate of something already
    // face up is untidy, handing back the word you just swallowed is a
    // refund of nothing. Take the duplicate.
    for (var j = RT.bag.length - 1; j >= 0; j--) if (RT.bag[j] !== avoid) return RT.bag.splice(j, 1)[0];
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
    // The line never holds every word you know. A new save owns four words
    // and the line wants four cards, so the bag ran dry every single draw:
    // swallowing handed you straight back the word you had just paid five
    // breath to be rid of, because there was nothing else in the world to
    // deal. Keeping one word in reserve means the swallow always changes
    // something, and the line growing from three cards to four as you learn
    // a fifth word reads as your voice getting wider, which it is.
    var pool = poolWords().length;
    var want = clamp(Math.round(T('lineSize')), 1, Math.max(1, pool - 1));
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
    if (RT.poem && RT.poem.lines.length && RT.poemPlace) poemKeep(RT.poemPlace, RT.poem);
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
    if (!RT.poem) return;
    if (!RT.poem.cur.length) {
        // the eighth word already forced the break, so the rhyme you then
        // pressed had nothing left to close. It still ended that line.
        var last = RT.poem.lines[RT.poem.lines.length - 1];
        if (fam && last && !last.end) last.end = fam;
        return;
    }
    RT.poem.lines.push({ ws: RT.poem.cur, end: fam || null });
    RT.poem.cur = [];
}
/* The book keeps a page, not a transcript: a long grind in one room would
   otherwise put hundreds of lines in localStorage forever. Blots are
   recounted from the lines that survive, or the kept page scores worse than
   the one the game just read out loud. */
function poemKeep(place, p) {
    if (!place || !p || !(p.lines || []).length) return;
    var lines = p.lines.slice(-12), blots = 0;
    lines.forEach(function (L) { L.ws.forEach(function (w) { if (w.cut) blots++; }); });
    S.poems[place] = { lines: lines, blots: blots };
    sSave();
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
    poemKeep(RT.place, p);
    var sc = poemScore(S.poems[RT.place] || p), shown = p.lines.slice(-4);
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
    if (!RT || RT.dead || RT.devOpen || RT.dialog || RT.mapOpen || RT.panel) return;
    if (RT.winded > 0) { hudNudge('breath'); return; }
    if (RT.callCd > 0) return;
    var st = stats();
    if (!spendBreath(st.callCost)) { hudNudge('breath'); return; }
    RT.callCd = 0.19;
    var word = headWord(), fam = WORDS[word] || 'eat';
    var couplet = RT.lastSaidFam === fam;      // two of a sound in a row bites harder
    RT.lastSaidFam = fam;
    RT.line.shift(); fillLine();
    var a = Math.atan2(RT.mouse.wy - RT.py, RT.mouse.wx - RT.px);
    /* the muzzle carries the sound now. It used to be a bare timer read
       only by drawActor, which raised the lantern arm in the same warm
       orange whatever you said. */
    RT.casting = { t: 0.13, max: 0.13, fam: fam, cpl: couplet ? 1 : 0, a: a, word: word.toUpperCase() };
    RT.nCalls++;
    var life = T('callRange') / 13;
    RT.calls.push({ x: RT.px + Math.cos(a) * 0.5, y: RT.py + Math.sin(a) * 0.5,
        vx: Math.cos(a) * 13, vy: Math.sin(a) * 13, life: life, max: life,
        word: word.toUpperCase(), fam: fam, hit: [], couplet: couplet ? 1 : 0,
        /* a is the WORLD heading, for the physics and for spray(); sa
           is the SCREEN heading, for every shape that is drawn. isoX is
           (x-y)*29 and isoY is (x+y)*14.5, so a world angle of PI/4
           leaves the barrel at 90 degrees on screen and every leading
           edge drawn with the raw angle is up to 63 degrees out. */
        a: a, sa: isoAng(a), et: 0, near: 0, trT: 0, tri: 0,
        tr: [0,0,0,0,0,0,0,0,0,0,0,0],
        /* ti is tri * 2, the same six points addressed as a flat
           stride-2 cursor, because -ight's afterimages walk the buffer
           backwards as (ti - off + 24) % 12 and cannot do that off an
           index that counts points. One assignment in stepCalls keeps
           the two agreeing; nothing writes ti anywhere else. */
        ti: 0,
        qx: RT.px + Math.cos(a) * 0.5, qy: RT.py + Math.sin(a) * 0.5, st: 1,
        /* 3.6 row 9's remaining tokens. age is the flight fraction
           -eat chews its word off and -ark flashes its glow on; seed
           holds -ark's wobble still while the word moves; tk is -erd's
           six-slot dotted leader, three numbers a slot, allocated once
           here and never again, with tki as its write cursor; sp is
           the speed multiplier callFly walks toward fly.accL. */
        age: 0, seed: rnd(0, TAU), sp: 1, tki: 0,
        tk: [0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0, 0,0,0],
        /* how out of breath you were when you said it. Read once, here,
           because the word does not get its wind back mid flight. */
        thin: clamp(1 - RT.breath / Math.max(1, stats().breathMax), 0, 1) });
    /* the muzzle throws its matter FORWARD, once, on the frame the key
       went down, rather than in a circle every frame from a drawer. */
    spray(RT.px, RT.py, 30, 4 + (couplet ? 3 : 0), a, 0.5,
          { col: fampx()[fam].rgb, sp0: 1.2, sp1: 3.4, l0: 0.12, l1: 0.3, s0: 1, s1: 2.2, grav: 90 });
    /* and the family's own launch beat, 3.6 row 9: -eat's three char
       crumbs at the barrel, -ight's flare, -erd's two chips opening,
       -ill's lamp. -ark has none on purpose. */
    var R = FAM_CALL[fam];
    if (R && R.cast) R.cast(RT.px, RT.py, a);
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
/* THE FAMILY'S OWN FLIGHT, off `fly`'s six numbers and never off an
   id. `acc` walks c.sp toward `accL` a second at a time: -eat gets
   faster because it is eating and -ill slows because it is stopping.
   A family that DECELERATES is by definition the family that hesitates
   and then commits, so the late commit reads off the sign of acc
   rather than off a branch on 'ill'; ILL_CALL's own comment says those
   two lines live in stepCalls' shared row, and this is that row.
   `step` and `wob` are draw-only. Neither touches the hit test: this
   writes qx/qy and the six-slot dotted leader and leaves x and y
   exactly where the straight line put them, so the picture and the
   collision can never disagree. */
function callFly(c, F, dt) {
    var want, j;
    if (F.acc) {
        want = c.sp + F.acc * dt;
        c.sp = F.acc > 0 ? Math.min(F.accL, want) : Math.max(F.accL, want);
        if (F.acc < 0 && c.near > 0.62) c.sp = Math.min(1.05, c.sp + 1.4 * dt);
        /* rewritten off the launch heading rather than multiplied in
           place, so accL is a hard ceiling on the launch speed and not
           a ceiling on a number that has been compounding all flight. */
        c.vx = Math.cos(c.a) * 13 * c.sp; c.vy = Math.sin(c.a) * 13 * c.sp;
    }
    if (F.step) {
        /* the quantiser, doubling as it closes. st starts at 1 so the
           first step fires on frame ONE: design-proj started it at 0
           with a 5.5/s accumulator, so the word was drawn in your hand
           for the first 182ms of a 577ms flight (crit-eng-proj 13). */
        c.st += dt * F.step * (c.near > 0.6 ? 2 : 1);
        if (c.st >= 1) {
            c.st -= 1; c.qx = c.x; c.qy = c.y;
            c.tk[c.tki] = c.x; c.tk[c.tki + 1] = c.y; c.tk[c.tki + 2] = 0.30;
            c.tki = (c.tki + 3) % 18;
        }
        for (j = 2; j < 18; j += 3) if (c.tk[j] > 0) c.tk[j] -= dt;
    } else { c.qx = c.x; c.qy = c.y; }
}
function stepCalls(dt) {
    var i, c, P, R;
    for (i = RT.calls.length - 1; i >= 0; i--) {
        c = RT.calls[i];
        R = FAM_CALL[c.fam] || FAM_CALL.none;
        /* the family's own flight: acceleration (-eat), deceleration
           and its late commit (-ill), the quantised step (-erd). All
           of it multiplies the velocity; none of it touches the hit
           test, which is the same straight line it has always been. */
        if (R.fly) callFly(c, R.fly, dt);
        c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt;
        c.age = clamp(1 - c.life / c.max, 0, 1);      // max is on the literal so there is finally a fraction
        c.near = clamp(1 - (nearFoeD(c.x, c.y, c.hit) - 0.45) / 2.1, 0, 1);
        /* THE TRAIL, dt-driven. Math.random() < 0.6 per frame is 36
           particles a second at 60Hz and 86 at 144, which is the bug
           crit-eng-ill 20 found in all five families at once. An
           accumulator emits the same count on any machine. */
        if (R.trail && R.fly && R.fly.rate) {
            c.et += dt * R.fly.rate * (1 + 0.55 * c.couplet) * (1 - 0.7 * c.thin);
            while (c.et >= 1) { c.et -= 1; R.trail(c, dt); }
        }
        /* six past screen points, written every 0.028s into a buffer
           allocated at launch. -ight reads it for its afterimages. */
        c.trT -= dt;
        if (c.trT <= 0) { c.trT = 0.028; c.tri = (c.tri + 1) % 6; c.ti = c.tri * 2;
                          c.tr[c.tri * 2] = c.x; c.tr[c.tri * 2 + 1] = c.y; }
        var f = firstFoeAt(c.x, c.y, 0.45, c.hit);
        if (f) { c.hit.push(f); landCall(f, c); RT.calls.splice(i, 1); continue; }
        // bound by the place, not by the old fixed grid: the road north
        // is 34 deep and every call cast on it used to die on frame one
        if (c.life <= 0 || c.x < -1 || c.x > pw() + 1 || c.y < -1 || c.y > ph() + 1) {
            callFizz(c);
            RT.calls.splice(i, 1);
        }
    }
}
/* The Deaf hears nothing, and that has to mean the same thing everywhere:
   it used to be quarter damage from an Answer, fully immune to a Stanza,
   and take Calls at FULL price, which is why the wall you were supposed to
   change your build for died in a second to the starting kit. */
function deafMul(f, fam) { return (f.def.deaf && fam !== 'ill') ? T('deafMul') : 1; }
function landCall(f, c) {
    var st = stats(), q;
    var dmg = st.callDmg * famDmgMul(c.fam) * deafMul(f, c.fam);
    // said two of a sound in a row: the second one bites, and sticks twice
    if (c.couplet) dmg *= 1 + T('coupletDmg');
    if (f.def.deaf && c.fam !== 'ill') typo(f.x, f.y, 'deaf', '#6a5f72', 0.4, 8, 'drift');
    hurtFoe(f, dmg, c.fam, { call: 1 });
    if (!f.dead) {
        addStack(f, c.fam, c.word, c.x, c.y, 0);
        for (q = 0; q < (c.couplet ? Math.round(T('coupletStacks')) : 0); q++)
            addStack(f, c.fam, c.word, c.x, c.y, 0.05);
    }
    var n = f.stacks.length;
    /* how close this came to taking a fifth of the thing's life, which
       is the honest measure of "was that a big hit" and is one divide.
       Folk have hpm 1 and hurtFoe returns 0 on them before it does
       anything, so the unguarded version pinned at the 1.6 ceiling for
       the entire audience and fired the biggest impact in the game into
       the crowd for nothing. !f.hpm also kills the 0/0 NaN that makes
       cx.font invalid and silently renders the word in whatever font
       was last set. */
    var frac = (f.def.folk || !f.hpm) ? 0 : clamp(dmg / (f.hpm * 0.18), 0, 1.6);
    /* THE SPRAY. A cone, not a circle: a call comes FROM somewhere and
       the matter should know it. burst() cannot express that. */
    var P = clamp(7 + Math.round(1.6 * n) + Math.round(6 * frac) + (c.couplet ? 4 : 0), 7, 34);
    spray(f.x, f.y, 26, P, c.a, 0.62,
          { col: fampx()[c.fam].rgb, sp0: 0.5, sp1: 2.1 + 0.9 * frac, l0: 0.15, l1: 0.45 });
    /* the word, the hold, the split and the tail flying into the row:
       one record, world tiles, aged on the real clock in stepProj. */
    fxOf('proj').lands.push({ kind: 'hit', wx: f.x, wy: f.y, fam: c.fam, txt: c.word,
                              n: n, frac: frac, cpl: c.couplet, a: c.a,
                              hold: 0.05 + 0.015 * n, t: 0, life: 0.05 + 0.015 * n + 0.19 });
    /* 3.6 row 10, and it is the last thing that runs so a family can
       react to the record above it. The consumer tests for truth
       because 2.1a lets a family with nothing to add register no row
       at all, which is what all five do today. */
    if (FAM_LAND[c.fam]) FAM_LAND[c.fam](f, c);
    punch({ fam: c.fam, power: 1 + n, kind: 'tap', x: f.x, y: f.y });
    fxSfx('hit', 0.04);
    fxSfx(n >= 5 ? 'stick.big' : 'stick', 0.05);
}
/* a rhyme stack: a glowing syllable stuck to an enemy, four
   seconds of shelf life, and a promise you have to keep */
/* `word` is what was said to plant it, and it is what lets the
   detonation assemble its line out of the bodies the words actually
   came from instead of out of i % wide. fx/fy is where the call
   landed, so the syllable can fly from there into its slot. dly is the
   couplet's second stack, 50ms behind the first. All four are
   optional: the Droner's self-write passes none of them. */
function addStack(f, fam, word, fx, fy, dly) {
    if (f.def.norhyme) {                      // nothing rhymes with sword
        typo(f.x, f.y, 'NO RHYME', '#8a8090', 0.55, 9, 'drift');
        return;
    }
    var st = stats(), fly = 0.16 + (dly || 0);
    f.stacks.push({ fam: fam, t: st.stackLife, max: st.stackLife, born: RT.t,
                    w: word || null, fx: fx == null ? f.x : fx, fy: fy == null ? f.y : fy,
                    fly: word ? fly : 0, flyMax: fly, sl: 0, slT: 0 });
    /* THE OVERFLOW. This line silently binned the oldest syllable at
       the cap: four breath vanishing with no pixel and no sound. Now
       the glyph tumbles off the left end of the row, greys, and falls.
       No damage and no red: a tag falling off a full plate reads
       instantly as "that one was wasted". */
    while (f.stacks.length > st.stackMax) {
        var old = f.stacks.shift();
        fxOf('proj').sours.push({ kind: 'spill', wx: f.x, wy: f.y, wh: foeH(f) + 18 + (f.so || 0),
                                  fam: old.fam, t: 0, life: 0.36, ox: -(st.stackMax * PIP_W) / 2 });
        fxSfx('spill', 0.10);
    }
}
function stepStacks(dt) {
    // stats() allocates two objects and nothing in here reads one
    var soured = 0, sourFam = null, sourX = 0, sourY = 0;
    for (var i = 0; i < RT.foes.length; i++) {
        var f = RT.foes[i]; if (f.dead) continue;
        for (var j = f.stacks.length - 1; j >= 0; j--) {
            if (RT.holdStacks || RT.a3Hold) continue;
            var s = f.stacks[j], was = s.t; s.t -= dt;
            if (s.dragT > 0) s.dragT = Math.max(0, s.dragT - dt);
            /* the crossing, once, on the frame it happens. The loop is
               already walking every stack every frame, so it is free,
               and the ring and the knock are what make the alarm an
               event rather than a state you notice late. fxSfx,
               because a drag can push sixty-four stacks over this
               threshold on one frame. */
            if (was >= T('pipWarn') && s.t < T('pipWarn') && !s.drone) {
                RT.rings.push({ x: f.x, y: f.y, r: 0.3, max: 1.1,
                                col: '201,72,74', t: 0.28, life: 0.28 });
                fxSfx('pipwarn', 0.25);
            }
            if (s.t <= 0) {
                f.stacks.splice(j, 1); breakStack(f, s, j);
                // the first one is the one the screen leans toward, and
                // it is the only one whose sound the punch takes
                if (!s.drone || T('droneSelfHurt')) {
                    if (!soured) { sourFam = s.fam; sourX = f.x; sourY = f.y; }
                    soured++;
                }
            }
        }
    }
    /* THE ONE THING THAT KILLS YOU AND DID NOT MOVE THE SCREEN.
       breakStack coalesces six lapses on one frame into one bill
       through hurtPlayer, so the punch has to coalesce with it: one
       call, out here, after both loops, powered by how many went at
       once. Six stacks going sour is a bigger event than one and the
       frame should say so, but it is still ONE event. */
    if (soured) punch({ fam: sourFam, power: soured, kind: 'sour', x: sourX, y: sourY });
}
/* BREAK — an unfinished line goes sour. this is the mechanical
   statement of Hal's entire condition, and it is what stops you
   spamming call forever. */
/* `i` is the cell's index in the row it just left, so -erd's shut mark
   and -ill's dust land under the plate that lapsed rather than under
   the middle of the row. stepStacks has already spliced by the time we
   get here, which is why it has to be passed rather than looked up. */
function breakStack(f, s, i) {
    // A sour line is YOUR unfinished line. A Droner's own words are not
    // yours and never were, so they cost you nothing when they lapse. The
    // Droner is a race to overwrite, not an aura that bills you 3 HP a
    // second for standing near it, untelegraphed, through the i-frames.
    // NOTHING is billed above this guard: the Echo drain used to sit up
    // here, which quietly taxed a lone Droner's owner 2.6 Echo a second for
    // words they never said, on the bar the Reprise now costs all of.
    var mine = !s.drone || T('droneSelfHurt');
    var q = fxOf('proj').q, half;
    if (!mine) {
        /* Somebody else's line ending. Visible that something ended,
           not visible that it cost you: the same break and fall at 0.6
           alpha in the Droner's grey, no off-rhyme glyph, no thread,
           no number. Today this and a 3 HP lapse are almost identically
           presented. */
        typo(f.x, f.y, 'lapses', '#6a5f72', 0.5, 8, 'drift');
        sourBreak(f, s, 0, 0);
        return;
    }
    RT.echo = Math.max(0, RT.echo - T('echoBreak'));
    /* 3.6 row 11. The family's own matter for the cell that lapsed:
       -eat's char crumbs, -erd's shut mark, -ark's tally and motes,
       -ill's dust. It returns the family colour, and the colour is no
       longer used, because the number below is one number for however
       many lapsed on the frame and five families cannot tint it. */
    if (FAM_SOUR[s.fam]) FAM_SOUR[s.fam](f, s, i || 0);
    /* Counted BEFORE the pieces are made, so the third lapse of a burst
       is the third and not the fourth. */
    q.n++; q.hp += T('breakSelfDmg'); q.t = 0.05;
    sourBreak(f, s, q.n <= 3 ? 1 : 0, 1);
    RT.sourN = (RT.sourN || 0) + 1;
    if (RT.sourN >= 4) ach('sour');
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
/* `withFolk` is for the dev handle's auto-answer, which wants the real best
   sound. The HUD never passes it: the pip is a combat readout, and at the
   last cue the whole square is carrying -ill, so it would light up with 25
   and hand the player the answer to the only question the game asks. */
function boardCount(fam, withFolk) {
    var n = 0;
    RT.foes.forEach(function (f) {
        if (f.dead || heldOpen(f)) return;
        if (f.def.folk && !withFolk) return;
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
    // RT.panel matters here in a way it never did for the old doAnswer: that
    // was on a mouse button, and a panel physically covers the canvas. This
    // is on the number row, and keydown is on the root.
    if (!RT || RT.dead || RT.devOpen || RT.dialog || RT.mapOpen || RT.panel) return;
    if (!FAMS[fam]) return;
    if (!rhymeReady(fam)) {
        hudNudge('rhyme:' + fam);
        say('You do not have that sound yet.', 'dim');
        return;
    }
    if (RT.winded > 0) { hudNudge('breath'); return; }
    if (RT.answerCd > 0) return;
    var st = stats();
    var live = RT.foes.filter(function (f) { return !f.dead && f.stacks.length && !heldOpen(f); });
    // A rhyme with nothing to rhyme with is a shout in an empty room, and it
    // is free. Charging for it made the 0.9s gap after a wrong answer in the
    // act into a trap: Bern tells you the sound, you say it inside a second,
    // and you are billed fifteen breath for silence.
    //
    // Free, but NOT skipped. Returning early here quietly broke two things,
    // because everything below this line still has to happen: you said the
    // sound, so it ends your poem line (that is the poem's only player-driven
    // break), and it counts as an Answer, which is the event the act's watcher
    // reads. Skip it and a rhyme pressed into an empty square folds three
    // words into the next line with no end sound, and the last cue can be
    // made unanswerable.
    if (live.length && !spendBreath(st.answerCost)) { hudNudge('breath'); return; }
    RT.answerCd = 0.34;
    RT.nAnswers++;
    RT.lastRhyme = fam;
    RT.casting = { t: 0.22, max: 0.22 };
    var word = FAMS[fam].tag;
    RT.lastWord = word; RT.lastFam = fam;          // the Reprise says the last thing you said
    var totalMatched = 0, hitFoes = 0, best = 0, dragged = 0;
    /* One detonation, N sources. The loop COLLECTS and one call after
       it FIRES. Firing inside the loop is what this has done for two
       years and it is wrong four ways; detonate()'s comment lists
       them. */
    var hits = [];
    /* THE BOARD IS ADDRESSED. Fifty milliseconds in which everything of
       this sound leans in and everything else looks away, before a
       single stack has resolved. It is the only frame in the game
       between hearing you and answering you, and it is the beat the
       press was missing: TSET is 121ms away and the acknowledgement
       cannot be the answer. */
    RT.said = { fam: fam, t: 0.05 };

    /* Hoisted, because famDmgMul calls charmSum, which allocates an
       object with a nested object in it and walks everything you are
       wearing, and `fam` does not change across the loop. Twenty five
       bodies in the square was twenty five charm sums on one keypress
       to arrive at the same number twenty five times. */
    var fdm = famDmgMul(fam);

    live.forEach(function (f) {
        var match = 0, other = 0;
        f.stacks.forEach(function (t) { if (t.fam === fam) match++; else other++; });
        if (!match && !other) return;
        var closed = match > 0;
        // Soft wax holds a mismatched pair together, which means it CLOSES:
        // full damage and the sounds are spent. Two things it must not do.
        // It must not grant full damage on top of the drag, which was the
        // same pile hit at full strength over and over for the whole time
        // the wax was warm. And it must not sit behind `!closed`, which made
        // pressing a sound the foe was carrying strictly worse than pressing
        // one it was not: the mixed pile is exactly the pair the wax is for,
        // so with it warm the whole pile counts as one sound.
        var waxed = other > 0 && RT.items.freeSlant > 0 && !f.def.folk;
        var takes = closed || waxed;
        var n = waxed ? match + other : closed ? match : other;
        var willDrag = !takes && !f.def.folk && !!T('slantShift');
        var dmg;
        if (takes) {
            dmg = (st.answerBase + st.answerPerStack * n) * fdm;
        } else if (willDrag) {
            // The drag is a manoeuvre, not an attack, and it is FLAT: it does
            // not scale with the pile. Scaling it made gathering a big pile
            // pay better than closing it (six alternating drags on a pile of
            // six did 240 and left all six standing, against 95 for the close
            // that spends them), so the best play in a game about closing the
            // couplet was to never close one.
            // Still billed through st.slantMul, because a drag IS a slant and
            // Rehearsal Chalk buys that number. Give the drag its own constant
            // and the chalk becomes a 45 coin charm that does nothing.
            dmg = st.answerBase * st.slantMul * T('dragMul') * fdm;
        } else {
            dmg = (st.answerBase + st.answerPerStack * n) * st.slantMul * fdm;
        }
        dmg *= deafMul(f, fam);          // the deaf hear nothing: only -ill touches them
        /* the row, copied before it is spent, four lines above the line
           that spends it */
        var cells = detCells(f, fam, waxed ? 1 : 0);
        var wasFam = (willDrag && f.stacks.length) ? f.stacks[0].fam : null;
        /* THE SURVIVORS SLIDE. Stamp each cell's current x offset now,
           while the row is still the row; drawStacks lerps from it to
           the new packed position over 45ms, so the row visibly closes
           up over the gap the answered sound left. It is the one moment
           the row is worth looking at and it is two lines. */
        var oN = f.stacks.length;
        f.stacks.forEach(function (s, si) { s.sl = (si - (oN - 1) / 2) * PIP_W; s.slT = 0.045; });
        hurtFoe(f, dmg, fam, { answer: 1, closed: takes, n: n });
        /* dead, honestly. hurtFoe calls foeDie on lethal and foeDie
           only sets f.dead = 1, so this is readable on the very next
           line and the visual can decide to draw its matter free
           standing instead of through a sprite that will never be
           drawn again. */
        hits.push({ f: f, n: n, dead: f.dead ? 1 : 0, took: takes ? 1 : 0,
                    was: wasFam, cells: cells });
        if (takes) { totalMatched += n; if (n > best) best = n; famEffect(f, fam, n); }
        hitFoes++;
        if (waxed) {
            f.stacks.length = 0;              // the wax takes the whole pile, matched or not
        } else if (closed) {
            f.stacks = f.stacks.filter(function (t) { return t.fam !== fam; });
        } else if (f.def.folk) {
            // The town's open line is not draggable. It has been the same
            // sound for four hundred years and a wrong answer does not move
            // it: that refusal is the entire act.
        } else if (willDrag) {
            // the drag. Nothing is spent, but a sound pulled over is a sound
            // wearing out: every drag costs what it moves part of its life,
            // so you can gather a board onto one rhyme and you cannot do it
            // forever.
            var age = clamp(T('dragAge'), 0, 0.95);
            /* dragT is the -ark pip's violet trail, and it is the one
               thing on the board that says a cell was HAULED here
               rather than said here. The pip has read it since the
               family landed; this is the line that writes it. */
            f.stacks.forEach(function (t) { t.fam = fam; t.t *= (1 - age); t.slT = 0; t.dragT = 0.25; dragged++; });
            f.rowT = 0.42;              // the haul owns this row. See dressSlant
        } else {
            f.stacks.length = 0;
        }
        // snapStacks has moved into detGather, where the width of the
        // detonation is known and the burst can be divided before the
        // loop instead of part() dropping the tail of the Act 3 square
        // in silence
    });

    poemBreak(fam);                       // a rhyme is where the line ends

    /* The mechanics stay here and the picture moves to detonate().
       Every slam, every shake and every sfx above fired on the frame of
       the KEYPRESS, which is 121 to 225ms before the line it is
       celebrating exists. They fire from detFire at TSET now, on the
       frame the words set and the rule strikes, and that retiming is
       the single most important change in this branch. */
    if (totalMatched > 0) {
        RT.echo = Math.min(T('echoMax'), RT.echo + T('echoPerStack') * totalMatched * st.echoGain);
        ach('couplet');
        if (best >= 6) ach('six');
        if (hitFoes >= 8) ach('crowd');
        detonate(fam, hits, 'close');
    } else if (dragged > 0) {
        ach('slant');
        dressSlant(detonate(fam, hits, 'drag'), hits);
        fxSfx('drag', 0.10);
    } else if (hitFoes > 0) {
        // the town, who cannot be dragged, and anyone the drag toggle is off for
        ach('slant');
        dressSlant(detonate(fam, hits, 'slant'), hits);
    } else {
        // a rhyme with nothing to rhyme with: it goes out and finds no sound.
        // It cost nothing, and it still ended the line.
        typo(RT.px, RT.py, word, '#4d4757', 0.5, 12, 'pop');
        sfx('empty');
    }
}
/* assembleLine used to sit here as (fam, n), with a screen drawer under
   it that read RT.assembly. Both are gone. The builder is up in banner
   A as assembleLine(d), called once from detGather with the whole
   detonation known, and the picture is drawn by drawDetScreen.
   What went with the old drawer, and must not come back in a merge:
   the shadowBlur, which was the only blurred edge in the file, replaced
   by detHalo drawing a hard scaled copy of the same glyphs additively;
   and the ((i * 97) % 13) / 13 hash scatter, a cloud in screen space
   that had never seen an enemy, in a function whose own comment said
   the whole idea was scattered words becoming a line.
   RT.assembly stays on the RT literal and the shared reset keeps
   nulling it, so a stale one from any path cannot survive a doorway. */
/* Kept for the dev handle, the act, and anything else that just wants
   "answer with whatever is most worth answering". Picks the sound you
   have the most of on the board, which is what a player would do. */
function doAnswer() {
    var best = null, bn = 0;
    FAM_IDS.forEach(function (f) {
        if (!rhymeReady(f)) return;
        var n = boardCount(f, 1);          // the town counts here: this is __ninth.answer()
        if (n > bn) { bn = n; best = f; }
    });
    var fam = best || (rhymeReady(answerFam()) ? answerFam() : FAM_IDS.filter(rhymeReady)[0] || 'eat');
    doRhyme(fam);
    /* Returned so the act and the harness can assert which sound went
       off. It matters more than it used to: the slam is no longer on
       the frame of the call, so __ninth.answer() followed by one tick()
       and a screenshot now shows an empty middle of the screen and a
       detonation 121ms away. TESTING.md's rule about driving the game
       with real key events applies here more than anywhere. */
    return fam;
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
    /* How loud the announcement is: everything that is going to answer
       it, counted once, here. A Reprise into an empty room and a
       Reprise into a loft of sixteen have been the same screen event
       since it was written, and they are the two ends of what this
       button is for. */
    var pile = 0;
    RT.foes.forEach(function (f) {
        if (!f.dead && !f.def.folk && !heldOpen(f)) pile += f.stacks.length;
    });
    RT.combat.rep = { n: T('repriseHits'), t: 0, gap: T('repriseGap'), word: word, fam: fam,
                      i: 0, of: T('repriseHits'), age: 0, done: 0, mark: [], pile: pile };
    poemBreak(fam);
    RT.dilate = Math.max(RT.dilate, 0.5);
    /* The announcement, and it is the one slam in this section that
       fires on the frame of the keypress rather than at TSET. It is
       allowed to, because it is not a detonation: nothing has been
       answered yet and it is not celebrating a line, it is saying one.
       The three lines it announces arrive after it.
       RT.shake = shake(9) and RT.chroma = 1 go: punch() owns both, and
       crit-eng-punch 159 found this exact call fringing in whatever
       family pair the last detonation happened to leave behind.
       bigLine('again', ...) goes too. It printed a 2 second unpinned
       line at VH*0.30, which is the row the three detonations then
       assemble their own lines on, so `again` and your line shared a
       row of pixels for the whole set piece (crit-eng-deton B8). The
       slam now holds 0.8s and the tally carries the count, so the
       bigLine was saying a third time what two other objects already
       said. */
    slam(word, FAMS[fam].col, 'reprise',
         { fam: fam, power: pile || 6, kind: 'close',
           x: RT.px, y: RT.py, dur: 0.8, sy: VH * 0.62 });
    fxSfx('reprise', 0.3); fxSfx('verse', 0.3);   // 'reprise' is job 2's; 'verse' carries it until then
    ach('reprise');
}

function stepReprise(dt) {
    var r = RT.combat.rep; if (!r) return;
    r.age += dt;                          // monotonic, for the tally. r.t is a countdown
    /* The record outlives the last beat by 0.45s so the tally can close
       its bracket and go out instead of vanishing on the frame it
       finished. Echo is zero by now, so nothing can start a second one
       inside the outro. */
    if (r.done > 0) { r.done -= dt; if (r.done <= 0) RT.combat.rep = null; return; }
    r.t -= dt;
    if (r.t > 0) return;
    r.t = r.gap; r.n--;
    var last = r.n <= 0;
    /* The rung. Three rows against a tunable number of hits, so the dev
       panel can set eight and still get an opening, a middle and an
       end rather than one row repeated. One hit is the end: a single
       beat should be the finale, not the smallest third of one. */
    var B = REP_BEAT[r.of <= 1 ? 2 : clamp(Math.round(r.i * 2 / (r.of - 1)), 0, 2)];
    var st = stats(), hit = 0, hits = [];
    RT.foes.forEach(function (f) {
        if (f.dead || !f.stacks.length) return;
        // never the town. The Reprise is everything YOU said coming back,
        // and the town's open line is not something you said.
        if (heldOpen(f) || f.def.folk) return;
        var n = f.stacks.length;
        var cells = detCells(f, null, 1);
        var dmg = (st.answerBase + st.answerPerStack * n) * T('repriseMul') * famDmgMul(r.fam) * deafMul(f, r.fam);
        hurtFoe(f, dmg, r.fam, { answer: 1, closed: 1, n: n });
        famEffect(f, r.fam, n, 1);
        // The line comes back THREE times, so the rhyme has to still be
        // there for the second and third. Wiping the stacks on beat one
        // meant beats two and three found nothing and detonated air: a
        // full Echo bar bought 0.85 of a single Answer. Only the last
        // beat takes the words away.
        if (last) f.stacks.length = 0;
        hits.push({ f: f, n: n, dead: f.dead ? 1 : 0, took: 1, was: null, cells: cells });
        hit++;
    });
    RT.rings.push({ x: RT.px, y: RT.py, r: 0.5, max: B.ring, col: hex2rgb(FAMS[r.fam].col), t: 0.5, life: 0.5 });
    r.mark.push(r.age);                   // the tally strikes whether or not anyone was there
    if (hit) {
        var d = detonate(r.fam, hits, B.kind);
        if (d) repDress(d, r, B);
        fxSfx('answer', 0.12);
    }
    typo(RT.px, RT.py + 0.4, r.word, FAMS[r.fam].col, 0.6, B.px, 'pop');
    r.i++;
    if (last) r.done = 0.45;
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

/* snapStacks and drawSnaps used to sit here. They are 4.5's now, up in
   banner A beside FAM_SNAP and regSnap, because the five families
   register a snap shape through regFam and the registry has to be
   declared above that call. Two declarations of one name would have
   been a silent last-wins, so the old pair is deleted rather than
   shadowed: the height they used was the literal -44, which is a
   hundred and four pixels wrong on the Chorus. */

/* ─────────────── what each family DOES ───────────────
   Words that rhyme share a nature. The detonation is where the
   nature shows up. */
/* f.burn gains `fam` and `max`. crit-eng-eat #3 and crit-eng-ark #2
   are the same defect from two sides: famEffect wrote { dps, t } from
   both families, neither carried a family, and the 0.5s tick
   hard-coded 'eat' as the attributing family and '255,140,60' as the
   ember colour. So -ark's five-second rot has always thrown orange
   sparks, and any b.t / b.max a family writes is NaN. Do not claim
   this fixes a charm interaction: famDmgMul is applied at six sites
   and never at the tick, so the misattribution is currently inert.
   The dispatch and the ember colour are the reasons. */
function famEffect(f, fam, n, noHeal) {
    if (fam === 'eat') {                              // hunger, burn, drain
        f.burn = { dps: 5 * n, t: 3, max: 3, fam: 'eat' };
        // noHeal: a Reprise hits every enemy three times, and -eat's drain
        // would turn one button into a full heal. It is a detonation, not a meal.
        if (!RT.god && !noHeal) RT.hp = Math.min(RT.hpm, RT.hp + n * 1.5);
        typo(f.x, f.y, 'BURN', FAMS.eat.col, 0.5, 10, 'drift');
    } else if (fam === 'ight') {                      // reveal, strip armour, true damage
        f.revealed = 5; f.armor = 0;
        typo(f.x, f.y, 'SEEN', FAMS.ight.col, 0.5, 10, 'drift');
    } else if (fam === 'erd') {                       // command, silence, counter
        f.silence = 1.6 + n * 0.25; f.state = 'walk'; f.tell = 0;
        erdCommand(f, n, null);                       // the counter, in three tiers, and the gag's entry clock
        typo(f.x, f.y, 'HUSH', FAMS.erd.col, 0.5, 10, 'drift');
    } else if (fam === 'ark') {                       // shadow, damage over time, conceal
        f.burn = { dps: 3.5 * n, t: 5, max: 5, fam: 'ark' };
        RT.conceal = 4;                               // thieves cannot read your stacks for a while
        typo(f.x, f.y, 'DARK', FAMS.ark.col, 0.5, 10, 'drift');
    } else if (fam === 'ill') {                       // stun, freeze, execute
        /* f.frozenM: crit-eng-ill #7. The rime alpha divides by it,
           this is the only writer of f.frozen, and spawnFoe has no
           frozenM, and cx.globalAlpha = NaN is SILENTLY IGNORED by
           the canvas, so the blit inherits whatever alpha the previous
           draw left. A leak that looks like a flicker. */
        f.frozen = f.frozenM = 1.4 + n * 0.2;
        /* crit-eng-ill #2, and it is a live bug today. doRhyme calls
           hurtFoe and then famEffect, hurtFoe calls foeDie on lethal,
           and the execute test `f.hp / f.hpm < 0.18` is ALWAYS TRUE
           for anything the rhyme itself killed, because a corpse has
           hp <= 0. The inner hurtFoe returns 0 on f.dead, which is the
           only reason the spurious STILL has never been noticed. Under
           the new design that path would fire the longest hitstop in
           the game and a 30-shard shatter of a body that burst into
           grey smoke a line earlier. */
        if (!f.dead && f.hp > 0 && f.hp / f.hpm < 0.18 && !f.def.boss) {
            f._exec = 1; illExec(f, n); hurtFoe(f, f.hp + 1, 'ill', { exec: 1 });
        }
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
    /* o.n has been passed by four call sites since the answer was
       written and read by none of them, so closing one stack and
       closing twelve printed the same 16px number. */
    if (o.answer) typo(f.x + rnd(-.2, .2), f.y, String(dmg), o.closed ? FAMS[fam].col : '#8a8090',
                       /* fxS is the file's one size curve: 13px at one
                          syllable, 21 at four, 34 at the cap. The
                          number is a readout of the pile and not just
                          of the damage. */
                       o.closed ? 0.8 + 0.25 * fxP(o.n || 1) : 0.55,
                       o.closed ? Math.round(13 * fxS(o.n || 1)) : 12, 'drift');
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
    /* the stanza layer's four rules and its bracket. Built here rather
       than on the first wave, because the block has to exist before
       anything can be filed into it, and because a recital cast into an
       empty room still draws its rules: they are made of the syllables
       that arrived, and none arriving is a true statement about the
       room. */
    fxOf('stz').rows = [];
    fxOf('stz').fam = sz.fam;
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
        /* Every line of the stanza stays up until the stanza ends, so
           the couplet on lines two and four is two objects on the
           canvas at once and the bracket has something to close around.
           1.1s each, landing 0.375s apart, meant line one was dead
           before line four arrived.
           The last line's rhyme word is not a 22px sub any more: it is
           the slam, and stepStz fires it at TSET. It is not a subtitle,
           it is the sound. */
        var L = bigLine(r.sz.lines[r.line], '', FAMS[r.sz.fam].col, 1.35 + (3 - r.line) * 0.375);
        stanzaWave(r.sz, isLast, L, r.line);
    }
    if (r.t >= dur) RT.recital = null;
}
/* each line lands as its own wave, the last one twice as hard.
     L   the bigLine record this wave's rule goes under
     li  which line of the stanza, 0 to 3 */
function stanzaWave(sz, big, L, li) {
    var st = stats(), hits = [];
    var dmg = (st.answerBase * (big ? 2.6 : 1.1) + st.answerPerStack * (big ? 3 : 1)) * famDmgMul(sz.fam);
    RT.rings.push({ x: RT.px, y: RT.py, r: 0.4, max: big ? 7.5 : 5.5, col: hex2rgb(FAMS[sz.fam].col), t: 0.5, life: 0.5 });
    /* Unconditionally, before the loop, and NOT inside detonate. A
       stanza into an empty room has no hits, detonate returns null, and
       the biggest cooldown in the game would go off with no shake at
       all. punch() takes the larger of every channel and never sums, so
       detFire's own punch a moment later is free. */
    punch({ fam: sz.fam, power: big ? 9 : 3, kind: big ? 'close' : 'wave', x: RT.px, y: RT.py });
    RT.foes.forEach(function (f) {
        if (f.dead) return;
        if (Math.hypot(f.x - RT.px, f.y - RT.py) > (big ? 7.5 : 5.5)) return;
        if (f.def.deaf && sz.fam !== 'ill') { typo(f.x, f.y, 'deaf', '#6a5f72', 0.4, 9, 'drift'); return; }
        var n = big ? 3 : 1;
        var cells = detCells(f, null, 1);       // the row, copied before the wave spends it
        hurtFoe(f, dmg, sz.fam, { answer: 1, closed: 1, n: n });
        hits.push({ f: f, n: n, dead: f.dead ? 1 : 0, took: 1, was: null, cells: cells });
        if (!f.dead) famEffect(f, sz.fam, n);
    });
    /* 'land' on the fourth line: absent from DET_AUTO, so the one wave
       that must be the loudest is the one wave the repeat gate does not
       touch. The other three are 'wave' and are gated to 18%, which is
       what stops 1.5 seconds of thirty-percent time filling with fog. */
    dressStanza(detonate(sz.fam, hits, big ? 'land' : 'wave'), L, li, big, 1);
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
    var i = 0, s = fxOf('vrs');
    /* The whole song, dark, on the frame the key goes down. The column
       is a picture of the entire ballad from the first line, so a Verse
       cut off at line twelve by a doorway is visibly a song that
       stopped rather than an effect that broke. No visual state lives
       in the timers below: they set an index and nothing else. */
    s.cols = verseCols(); s.i = 0; s.a = 1;
    BALLAD.forEach(function (st, k) {
        st.r.forEach(function (ln, j) {
            RT.timers.push(heldTimeout(function () {
                if (!RT) return;
                verseStamp((k * 4 + j), ln, k === 6 && j === 3 ? '#ffe66e' : '#f0e9df');
            }, (i++) * 260));
        });
    });
    /* was a flat 6, against a song that runs 28*260 + 1200 = 8.48s, and
       dilation counts down on real time. The last five lines, the ones
       the whole game is for, were the only ones at full speed. Derived
       off i so it cannot drift from BALLAD again. */
    RT.dilate = i * 0.26 + 0.9; RT.mono = i * 0.26 + 1.3;
    s.life = i * 0.26 + 2.6;
    /* heldTimeout and not setTimeout, which is #126's: stepping off the
       stage parks a pending line instead of firing it into a room the
       player has left. The Verse is the one thing in the game long
       enough for that to happen mid song. */
    RT.timers.push(heldTimeout(function () {
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
/* One line of the song arrives. Takes the index it was given rather
   than assuming it is the next one: a hidden tab clamps setTimeout to a
   second or more, so alt-tabbing through the Verse queues the rest of
   it and fires the lot in one frame. Everything skipped is marked read
   without its flash, only the line actually arrived at is printed, and
   only the LAST skipped pulse runs, because seven kill pulses and seven
   crowd waves on one frame is not seven events. punch() already takes
   the max and never sums, so the screen survives the burst by itself. */
function verseStamp(i, ln, col) {
    var s = fxOf('vrs'); if (!s.cols) return;
    var k = Math.floor(i / 4), j = i % 4, pk = -1, m;
    while (s.i < i) {
        m = s.cols[Math.floor(s.i / 4)].m[s.i % 4];
        m.lit = 1;
        if (s.i % 4 === 3) { pk = Math.floor(s.i / 4); s.cols[pk].done = 1; }
        s.i++;
    }
    s.i = i + 1;
    m = s.cols[k].m[j];
    m.lit = 1; m.t = 0.22;                     // the flash and the tick over it
    var L = bigLine(ln, '', col, 1.4);
    if (pk >= 0 && pk !== k) versePulse(pk, pk === 6, null);
    if (j === 3) { s.cols[k].done = 1; versePulse(k, k === 6, L); }
}
/* Every fourth line. It is the same detonation as everything else in
   this overhaul, run on an index instead of a pile, and in the one room
   it was written for it hits nothing at all. */
function versePulse(k, last, L) {
    var hits = [], fam = VERSE_FAM[k], col = verseCol(k), s = fxOf('vrs');
    /* First, unconditionally, and NOT through detonate. In the square
       hurtFoe returns 0 on folk before it does anything, so hits comes
       back empty, detonate returns null, and the biggest cast in the
       game would take the room in silence. Power is the stanza number:
       a song has a shape that does not depend on who is listening.
       Stanza one is 4 and stanza seven is 12.4, which is punchP
       saturated, which is the loudest the game gets. */
    punch({ fam: fam, power: 4 + 1.4 * k, kind: last ? 'close' : 'wave', x: RT.px, y: RT.py });
    RT.rings.push({ x: RT.px, y: RT.py, r: 0.5, max: 5 + 1.8 * k, col: hex2rgb(col), t: 0.6, life: 0.6 });
    RT.foes.forEach(function (f) {
        if (f.dead || f.def.folk) return;      // the folk are not targets. They are the audience.
        var n = Math.max(1, f.stacks.length);
        var cells = detCells(f, null, 1);
        /* the damage stays hurtFoe(f, 999, 'ight') exactly as it was:
           routing it through five families would put five resistance
           tables and famDmgMul between the last cast in the game and
           its own kill. */
        hurtFoe(f, 999, 'ight', { answer: 1, closed: 1, n: n });
        hits.push({ f: f, n: n, dead: f.dead ? 1 : 0, took: 1, was: null, cells: cells });
    });
    /* 'land' on the seventh, for the same reason the fourth line of a
       stanza gets it: absent from DET_AUTO, so the last pulse of the
       song is the one pulse the repeat gate cannot quieten. The other
       six are 'verse', which IS in DET_AUTO, and a body caught by two
       pulses 1.04s apart gets the second at 18%. Right: the second one
       is the song repeating itself, and the escalation is in the column
       and the line, never in the matter. */
    dressStanza(detonate(fam || 'ight', hits, last ? 'land' : 'verse'), L, 3, last, 0);
    /* and the three lines out of twenty-eight that are the whole game */
    if (BALLAD[k].brk) s.cols[k].fall = 0.001;
    standWave(k);
    sfx(last ? 'wave2' : 'wave');
}
/* hurtFoe is a no-op on folk. The most lethal thing in the game, cast
   at the climax of the game, finds four hundred people and does nothing
   to any of them. What it does instead is stand them up.
   Nearest first, not at random. The original took four with irnd, which
   stands the square up in a scatter. Sorted by distance from the stage
   the crowd comes up in rings: the front row on the first stanza, the
   back of the square on the last, and the one man still sitting when
   the song ends is the one at the back outside the lamps, who is left
   out here on purpose and stands on his own in a3Hal.
   The chips are on the sim clock like every particle in the file, so
   during the dilation they come off a coat at a third speed under a
   song running at full speed. That is the house rule at four hundred
   people and it is the best look the recital's clock split ever gets. */
function standWave(k) {
    var sit = RT.foes.filter(function (f) { return f.def.folk && f.seat && !f.isHal; }), i, f;
    sit.sort(function (a, b) {
        return (a.x - RT.px) * (a.x - RT.px) + (a.y - RT.py) * (a.y - RT.py) -
               (b.x - RT.px) * (b.x - RT.px) - (b.y - RT.py) * (b.y - RT.py);
    });
    for (i = 0; i < 4 && i < sit.length; i++) {
        f = sit[i]; f.seat = 0;
        burst(f.x, f.y, 12, 3, { col: '232,226,238', sp0: 0.2, sp1: 0.9,
                                 l0: 0.5, l1: 1.1, s0: 1, s1: 2, grav: 60, add: 0 });
    }
}

/* expanding ground rings, shared by stanzas and boss pulses */
function drawRings(cx, dt) {
    for (var i = RT.rings.length - 1; i >= 0; i--) {
        var g = RT.rings[i]; g.t -= dt;
        if (g.t <= 0) { RT.rings.splice(i, 1); continue; }
        var k = 1 - g.t / g.life, rr = g.max * (0.15 + 0.85 * k);
        var sx = isoX(g.x, g.y), sy = isoYA(g.x, g.y);
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
        silence: 0, frozen: 0, frozenM: 0, burn: null, revealed: 0, armor: def.armor0 || 0, spawn: 0.45,
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
            if (f.burn.tick <= 0) {
                f.burn.tick = 0.5;
                /* One dispatch instead of one hard-coded ember. The
                   `else` is the literal line that has always been
                   here, so a family that has not registered a tick
                   still burns exactly as it burns now. */
                var tk = FAM_BURN[f.burn.fam];
                if (tk) tk(f); else part({ x: f.x, y: f.y, z: rnd(10, 40), vx: 0, vy: 0, vz: rnd(6, 16),
                                           life: 0.4, size: 2, col: '255,140,60', add: 1, grav: 0 });
                hurtFoe(f, f.burn.dps * 0.5, f.burn.fam || 'eat', { dot: 1 });
            }
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
            // the denial: its hand goes out and stops. Three drips thrown
            // toward you that die at 40% of the distance, and a sound.
            if (RT.conceal > 0) { typo(f.x, f.y, '???', FAMS.ark.col, 0.5, 9, 'drift'); arkDeny(f); f.stealT = f.steal * 0.5; }
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
                /* born, because crit-eng-eat #11 found every drone -eat pip
                   seeded off (s.born || 0) coming out identical and
                   flat-bottomed. It stays a raw literal rather than an
                   addStack call, because it deliberately bypasses the
                   norhyme guard and the cap. */
                f.stacks.push({ fam: pick(other), t: st.stackLife, max: st.stackLife, born: RT.t, drone: 1 });
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
    /* the default cloud is suppressed by a family that has something
       better to say about the moment a thing is finished. -eat's husk
       outlives the body; -ill's shatter is made of the enemy instead
       of made of squares. -ark's outline is permanent and is drawn
       BESIDE the cloud, so its row returns 0 on purpose. */
    var fin = FAM_FIN[famStatus(f)];
    if (!(fin && fin(f)))
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
/* the audience. Smaller than the people you can talk to, because they
   are the back of the room, but they are people and not posts: the
   crowd is what the whole game is about. Each one is dealt a coat out
   of a small set off their own position, so the rows do not repeat. */
var FOLK_COATS = [
    ['#3a3346', '#4e465e'], ['#43384a', '#5a4c62'], ['#33384a', '#465066'],
    ['#4a3a3a', '#63504e'], ['#38423a', '#4c5a4c'], ['#2f2b3e', '#413c54']
];
var FOLK_SKINS = ['#d8b48c', '#e8c8a0', '#c8a078', '#e0bc94'];
function drawFolk(cx, f) {
    var seat = f.seat ? 1 : 0;
    var sway = Math.sin(RT.t * 1.1 + f.x * 2.3) * (seat ? 0.6 : 1.4);
    /* dealt once and kept on the foe. Deriving it from f.x every frame
       would be fine today, because folk have spd 0 and never move, but
       the day somebody gives the audience a shuffle it would mint a
       new palette and a new baked canvas every frame. */
    if (f._fv == null) f._fv = Math.abs(Math.round(f.x * 7 + f.y * 3));
    var i = f._fv;
    var co = f.isHal ? ['#2a2434', '#3d3350'] : FOLK_COATS[i % FOLK_COATS.length];
    var sk = f.isHal ? '#c8b8a8' : FOLK_SKINS[(i >> 1) % FOLK_SKINS.length];
    var key = 'folk' + (f.isHal ? 'H' : i % FOLK_COATS.length + '.' + ((i >> 1) % FOLK_SKINS.length)) + (seat ? 'S' : 'U');
    var p = pxPal(co[0], co[1], sk, i % 3 ? '#2a2028' : '#4a3a30');
    cx.save(); cx.translate(sway, 0);
    blit(cx, bake(key, FOLK_TOP.concat(seat ? FOLK_LAP : FOLK_LEGS), p), 0, 0);
    cx.restore();
}
function drawFoe(cx, f) {
    var sx = isoX(f.x, f.y), sy = isoYA(f.x, f.y);
    var pop = f.spawn > 0 ? 0.5 + (0.45 - f.spawn) : 1;
    var wob = Math.sin(RT.t * 22) * f.wob * 3;
    var tell = f.state === 'tell' ? 0.5 + 0.5 * Math.sin(RT.t * 30) : 0;
    /* how tall this thing actually is, so the health bar and the rhyme
       stacks sit just over its head. The old formula was derived from
       the hit radius and guessed about fifty pixels too high for every
       archetype, which was invisible while the bodies were flat shapes
       and is not invisible now they have heads. */
    var h = foeH(f);
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
    /* -ight's ink quad, and it is the one family layer that has to be
       UNDER the body: a house must occlude a shadow and the body must
       stand on it. Everything else -ight draws is 1px and goes at
       ord 44 over the night wash. */
    ightCast(cx, f, sx, sy);
    cx.save(); cx.translate(sx, sy - Math.abs(wob) * 0.4); cx.scale(pop, pop);
    /* the contact shadow, and it is now a channel. -eat spreads it as
       the ground gives under something being eaten, -ark swells it and
       DETACHES it because under this family shadows get bigger and do
       not come back, -ill tightens and darkens it because a thing that
       has stopped is pinned to the floor, and -ight suppresses it
       outright for the length of a reveal because the reveal REPLACES
       the ambient rather than arguing with it (crit-art-ight #4: a
       body with two shadows pointing different ways is the sticker
       failure the prop comment warns about). Three numbers, read with
       == null defaults so nothing has to be added to spawnFoe, written
       only by a family stepper and always cleared by the same stepper. */
    var cr = f.csr == null ? 1 : f.csr, ca = f.csa == null ? 0.42 : f.csa;
    if (ca > 0) {
        cx.fillStyle = partCol('0,0,0', ca);
        cx.beginPath();
        cx.ellipse((f.cso || 0) * TILE_W / 2, 0, f.r * 21 * cr, f.r * 8 * cr, 0, 0, TAU);
        cx.fill();
    }
    /* A frozen body is a static blit of a repaletted bake, so it
       inherits no drawer's offset, no drawer's rotation and no
       drawer's animation, which also delivers the held pose for free
       and without the six-line snapshot the design proposed. A Sword
       frozen mid-swing keeps the pose it was baked into rather than
       continuing to swing; f.anim advances above the frozen guard in
       stepFoes and drives the Hearsay's gape and the Droner's inner
       glow, and none of them can reach a bitmap. icy() returns null
       for anything with no rows (the Chorus) or when the bake budget
       is spent, and then the normal drawer runs under the fallback
       tint inside illBody. */
    var ice = f.frozen > 0 ? icy(f) : null;
    if (ice) blit(cx, ice, 0, 0); else (FOE_DRAW[f.def.draw] || drawMouth)(cx, f, tell);
    /* a thing that has stopped shows no other status: -ill claims
       value and stillness, not hue, and this deletes the MODS.sealed
       colour collision outright. -ight's peel deletes the plate branch
       for the rest of the fight rather than leaving it stroking the
       identical rect at 0.2. */
    if (f.m && !(f.frozen > 0) && !(f._peel && f.m.mark === 'plate')) drawMod(cx, f, h);
    if (f.flash > 0) { cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = f.flash * 3.4; cx.fillStyle = '#fff';
        cx.fillRect(-f.r * 22, -h, f.r * 44, h); cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over'; }
    /* the flat 45% #cfeeff rect is gone. It was the same rectangle as
       the hit flash over a sprite that has a silhouette, and -ill
       replaces it entirely. One lookup, no branch, and famStatus
       states the order: stopped beats shut up beats being looked at
       beats rotting beats burning. It is AFTER the flash, because
       hurtFoe sets f.flash on the same frame doRhyme runs and a status
       inserted before it spends its first 90 milliseconds under a
       white wash. */
    if (T('vfxStatus') > 0) {
        var stn = FAM_ST[famStatus(f)];               // one lookup, no branch
        if (stn) stn(cx, f, h, sx, sy);
    }
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
    // the rhyme row is drawn by drawPips at the world seam now, OVER
    // drawLights and drawVignette instead of under them. Do not restore
    // this line in a merge: a both-sides merge draws the row twice, once
    // dark and once bright, and it looks like a shadow rather than a bug.
    if (RT.dbgAI) {
        cx.font = '9px monospace'; cx.fillStyle = '#9fe0c8'; cx.textAlign = 'center';
        cx.fillText(f.state + (f.frozen > 0 ? ' FRZ' : '') + (f.silence > 0 ? ' SIL' : ''), sx, sy + 12); cx.textAlign = 'left';
    }
    if (RT.dbgHit) {
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5); cx.strokeStyle = 'rgba(0,255,180,.5)';
        cx.beginPath(); cx.arc(0, 0, f.r * TILE_W / 2, 0, TAU); cx.stroke(); cx.restore();
    }
}
/* the rhyme stacks: one cell per syllable, in a row, above the thing
   they are stuck to. legible at speed is the only rule. Everything
   below the FAM_PIP dispatch is shared; everything inside it is the
   family's. Called from drawPips at the projectile layer's world pass
   (4.11), not from drawFoe: it is over drawLights and drawVignette now
   rather than under them, so the readout you buy the whole game off is
   as bright as the detonation that spends it. */
function drawStacks(cx, f, sx, sy) {
    var n = f.stacks.length; if (!n) return;
    var i, s, x, fade, fam, P, k, plate = n * PIP_W + 8, said = RT.said;
    var crowd = RT.foes.length > 12;
    /* How many of this row are -ight, stamped onto every cell before
       any of them draw. The family's pip reads it to decide whether it
       is drawing its own two slot rules or getting out of the way of
       the one filament that runs the length of the plate at four or
       more, which its own comment calls a change of kind and not of
       degree. It read `s.rowLit` and nothing on earth wrote it, so the
       escalation never happened and a row of eight -ight drew eight
       separate lamps for as long as this file has existed. A row can
       be mixed, so it has to be counted rather than taken from n. */
    var lit = 0;
    for (i = 0; i < n; i++) if (f.stacks[i].fam === 'ight') lit++;
    for (i = 0; i < n; i++) f.stacks[i].rowLit = lit;
    cx.save(); cx.textAlign = 'center';
    cx.font = 'bold 8px "Press Start 2P", monospace';
    /* THE PLATE. One dark plate behind the row so overlapping packs
       never smear into each other. Dropped entirely in a crowd when
       the row is a single cell: twenty-five 30px plates across the
       middle of the square is a fence, and twenty-five small words
       floating over twenty-five heads is a chorus (crit-art-proj 16).
       It is also strictly cheaper. */
    if (!(crowd && n === 1)) {
        cx.globalAlpha = (said && said.fam !== f.stacks[0].fam) ? 0.8 : 1;
        cx.fillStyle = 'rgba(8,6,12,.72)';
        cx.fillRect(sx - plate / 2, sy - 11, plate, 16);
        cx.globalAlpha = 1;
    }
    for (i = 0; i < n; i++) {
        s = f.stacks[i]; fam = FAMS[s.fam]; P = fampx()[s.fam];
        x = sx + (i - (n - 1) / 2) * PIP_W;
        /* THE SURVIVORS SLIDE. The row closes up over the gap the
           answered sound left, over the same 45ms the tear takes to
           leave. It is the one moment the row is worth looking at and
           it is the cheapest legible detail in this whole section
           (crit-art-deton 18). s.sl is the old x offset, stamped in
           doRhyme before the row was spent, and s.slT is counted down
           in the proj stepper on the real clock. */
        if (s.slT > 0) x = lerp(sx + s.sl, x, 1 - s.slT / 0.045);
        /* THE ARRIVAL. The rhyming tail of the word that was said flies
           in from the impact point and is driven into the slot: k*k,
           ease IN, like something being nailed down (4.10). */
        if (s.fly > 0) {
            k = 1 - s.fly / s.flyMax;
            x = lerp(punchWX(isoX(s.fx, s.fy)), x, k * k);
        }
        x = Math.round(x);
        /* the fade, and the family may override it: drawStacks
           computes it before the pip runs, so a family that wants the
           LETTER to flicker cannot do it from inside the pip
           (crit-eng-ight 5). s.t / s.max and not T('stackLife'):
           stackLife is 4.0 in TUNE but a stack is born with
           stats().stackLife and the Tin Crown, which Bern presses into
           your hands in the prologue, adds 1.5s, so a bar divided by
           the tunable reads full for the first 27% of every stack's
           life (crit-eng-proj 10). max is written at birth and the
           drag deliberately does not touch it, which is what makes the
           ratio DROP by 35% when a sound is dragged: the cost of the
           move, for free, in the readout. */
        fade = clamp(s.t / Math.max(0.001, s.max) * 3, 0.3, 1);
        if (FAM_FADE[s.fam]) fade *= FAM_FADE[s.fam](s);
        /* THE BOARD IS ADDRESSED (4.0.3). For 50ms every cell of the
           sound just said is struck to paper and everything else looks
           away. It is the only frame in the game between hearing you
           and answering you. */
        if (said) {
            if (said.fam === s.fam) { cx.fillStyle = '#e8e2ee'; cx.fillRect(x - 6, sy - 11, 12, 16); }
            else fade *= 0.72;
        }
        /* THE ALARM, on absolute seconds, because a lapse costs the
           same 3 HP whether it is the first stack or the eighth.
           Border red at pipWarn; the plate BLINKS on a square wave
           under 0.55, because a fade reads as decoration and a blink
           reads as an alarm; and under 0.25 the cell shivers a whole
           pixel and fills with the damage it is about to do to you. */
        if (s.t < T('pipWarn') && !s.drone) {
            if (s.t < 0.25) {
                x += (Math.sin(RT.t * 54) > 0) ? 1 : -1;
                cx.fillStyle = 'rgba(201,72,74,.55)';
                cx.fillRect(x - 6, sy - 10, Math.round((1 - s.t / 0.25) * 12), 14);
            } else if (s.t < 0.55 && ((RT.t * 11) | 0) % 2) {
                cx.fillStyle = 'rgba(201,72,74,.45)';
                cx.fillRect(x - 6, sy - 10, 12, 14);
            }
            cx.fillStyle = '#ff5a6a';
            cx.fillRect(x - 6, sy - 11, 12, 1);
            cx.fillRect(x - 6, sy + 4, 12, 1);
        }
        cx.globalAlpha = fade * (s.drone ? 0.72 : 1);
        if (s.fly > 0) {                  // the arrival wash, on the cell it is landing in
            cx.globalCompositeOperation = 'lighter';
            cx.fillStyle = 'rgba(' + P.grgb + ',' + (0.9 * (s.fly / s.flyMax)).toFixed(2) + ')';
            cx.fillRect(x - 6, sy - 10, 12, 14);
            cx.globalCompositeOperation = 'source-over';
        }
        s.i = i;                          // the family's seed index, for its own texture
        (FAM_PIP[s.fam] || FAM_PIP.none)(cx, s, x, sy, PIP_W, fade);
        /* THE DRONE. Somebody else's word, written on the same body, in
           a hand that is not yours: breakStack refuses to bill you for
           it and it must read as not yours. Three dashes rather than a
           border, a 1px strike through the glyph, and no alarm at all,
           because it is not counting down to anything that costs you. */
        if (s.drone) {
            cx.globalAlpha = 0.72;
            cx.fillStyle = '#8a8090';
            cx.fillRect(x - 5, sy - 4, 10, 1);
            cx.fillRect(x - 6, sy - 11, 3, 1); cx.fillRect(x - 1, sy - 11, 3, 1);
            cx.fillRect(x + 3, sy - 11, 3, 1);
        }
        cx.globalAlpha = 1;
    }
    if (RT.dbgStacks) {                   // the DEV toggle keeps its readout
        cx.font = '9px monospace'; cx.fillStyle = '#ffe66e';
        cx.fillText(n + '×', sx, sy - 14);
    }
    cx.restore(); cx.textAlign = 'left';
}
/* The bestiary in the same pixels as the cast. These are townspeople
   who went wrong, mostly, so they are built on the same bones: the
   Thief still has shoulders, the Sword is still an actor holding a
   prop. Only the Mouth gave up on having a body. */

/* applause with teeth, and nothing behind it. Two gapes: shut, and
   the one it opens on the beat it bites. */
var MOUTH_SHUT = [
    '......oooooo......',
    '....ooCCCCCCoo....',
    '...oCCCCCCCCCCo...',
    '..oCccccccccccCo..',
    '..oCccccccccccCo..',
    '..oCwTwTwTwTwTCo..',
    '..oCwTwTwTwTwTCo..',
    '..oCccccccccccCo..',
    '..oCccccccccccCo..',
    '...oCCCCCCCCCCo...',
    '....ooCCCCCCoo....',
    '......oooooo......'
];
var MOUTH_WIDE = [
    '......oooooo......',
    '....ooCCCCCCoo....',
    '...oCCCCCCCCCCo...',
    '..oCccccccccccCo..',
    '..oCwTwTwTwTwTCo..',
    '..oCTTTTTTTTTTCo..',
    '..oCTTTTTTTTTTCo..',
    '..oCwTwTwTwTwTCo..',
    '..oCccccccccccCo..',
    '...oCCCCCCCCCCo...',
    '....ooCCCCCCoo....',
    '......oooooo......'
];
/* hood down over the face, and one arm always out. It is not sneaking
   up on you, it is asking. */
var THIEF_SPR = [
    '.....oooooo.........',
    '....okkkkkko........',
    '...okkkkkkkko.......',
    '...okkTTTTTkko......',
    '...okkTrrTTkko......',
    '...okkkkkkkko.......',
    '..occkkkkkkcco......',
    '..okcCCCCCCcko......',
    '..okcCCCCCCckkkss...',
    '..okcCCCCCCcko..o...',
    '..okbbbbbbbbko......',
    '..okccccccccko......',
    '..okccccccccko......',
    '...okccccccko.......',
    '...occcooccco.......',
    '...obbboobbbo.......',
    '...oooooooooo.......'
];
/* it never stops and it never changes pitch. Wide, slumped, and lit
   from inside by the brass note it will not let go of. */
var DRONER_SPR = [
    '.....mmmmmm.......',
    '....ommmmmmo......',
    '...oMMMMMMMMo.....',
    '..occCCCCCCcco....',
    '..okcCTTTTCcko....',
    '..okcCTmmTCcko....',
    '..okcCTTTTCcko....',
    '..oskcCCCCckso....',
    '..okbbbbbbbbko....',
    '..okccccccccko....',
    '.okccccccccccko...',
    '.okccccccccccko...',
    '.occcooooooccco...',
    '.obbboooooobbbo...',
    '.oooooooooooooo...'
];
/* no ears, and a bar where the face should be. Whatever you say it is
   not going to hear it, which is the whole of the fight. */
var DEAF_SPR = [
    '..oooooooooooo..',
    '.oCCCCCCCCCCCCo.',
    '.oCccccccccccco.',
    '.oCccooooooccco.',
    '.oCccoTTTToccco.',
    '.oCccooooooccco.',
    '.oCccccccccccco.',
    '.occcccccccccco.',
    '.okccccccccccko.',
    '.okbbbbbbbbbbko.',
    '.okccccccccccko.',
    '.okccccccccccko.',
    '.okccccccccccko.',
    '.occccoooocccco.',
    '.obbbboooobbbbo.',
    '.oooooooooooooo.'
];
/* an actor with a prop, and no line to say. The sword is tin, like
   the crown, and it is the only thing he has left of the part. */
var SWORD_SPR = [
    '.....oooooo........',
    '....ohhhhhho.......',
    '....ohssssho.......',
    '....osesseso.......',
    '....osssSsso.......',
    '.....oSssSo........',
    '..occCCCCCCcco.....',
    '..okcCffffCcko.....',
    '..okcCCffCCckso....',
    '..oskcCCCCcksomo...',
    '..okbbbmMbbbkomo...',
    '..okcccckcccko.mo..',
    '..okcccckcccko.mo..',
    '...okccccccko.wwo..',
    '...occcooccco..wo..',
    '...okkkookkko..wo..',
    '...obbboobbbo..wo..',
    '...oooooooooo...o..'
];
/* sprite rows times PXS, kept beside the art so the two cannot drift */
/* sprite rows times PXS, kept beside the art so the two cannot drift.
   `chorus` was missing and every caller fell through to the `|| 30`,
   which is why foeH's boss branch exists and why it now has a belt as
   well as braces. */
var FOE_H = { mouth: 24, thief: 34, droner: 30, deaf: 32, sword: 36, folk: 30, chorus: 130 };
var FOE_PAL = {
    mouth: pxPal('#7d7086', '#8d8096', '#d8b48c', '#2a2028', { T: '#120c17', w: '#efe9f4' }),
    thief: pxPal('#463a5e', '#57497a', '#d8b48c', '#2a2338', { T: '#191322', r: '#c86a6a' }),
    thiefT: pxPal('#463a5e', '#57497a', '#d8b48c', '#2a2338', { T: '#191322', r: '#ffd06a' }),
    droner: pxPal('#584a36', '#6d5c44', '#d8b48c', '#3a3020', { T: '#1d1712' }),
    deaf: pxPal('#585862', '#6a6a74', '#d8b48c', '#2a2a30', { T: '#1a1a20' }),
    sword: pxPal('#6a5745', '#7a6a52', '#d8b48c', '#3a2f26', { w: '#b9b2c4' })
};
function drawMouth(cx, f, tell) {
    var gape = tell > 0.3 || Math.sin(f.anim * 7) > 0.45;
    blit(cx, bake(gape ? 'foe.mouthW' : 'foe.mouthS', gape ? MOUTH_WIDE : MOUTH_SHUT, FOE_PAL.mouth), 0, 0);
}
function drawThief(cx, f, tell) {
    var t = tell > 0.3;
    blit(cx, bake(t ? 'foe.thiefT' : 'foe.thief', THIEF_SPR, t ? FOE_PAL.thiefT : FOE_PAL.thief), 2, 0);
}
function drawDroner(cx, f, tell) {
    blit(cx, bake('foe.droner', DRONER_SPR, FOE_PAL.droner), 0, 0);
    cx.save(); cx.globalCompositeOperation = 'lighter';
    cx.fillStyle = 'rgba(200,170,90,' + (0.16 + Math.abs(Math.sin(f.anim * 4)) * 0.26) + ')';
    cx.beginPath(); cx.ellipse(0, -28, 26, 7, 0, 0, TAU); cx.fill();
    cx.restore();
}
function drawDeaf(cx, f, tell) {
    blit(cx, bake('foe.deaf', DEAF_SPR, FOE_PAL.deaf), 0, 0);
    if (tell > 0.3) { cx.fillStyle = 'rgba(255,120,90,' + tell + ')'; cx.fillRect(-16, -36, 32, 3); }
}
function drawSword(cx, f, tell) {
    cx.save();
    if (tell > 0.3) { cx.translate(6, -24); cx.rotate(-0.5); cx.translate(-6, 24); }
    blit(cx, bake('foe.sword', SWORD_SPR, FOE_PAL.sword), 3, 0);
    cx.restore();
    cx.fillStyle = '#8a8090'; cx.font = 'bold 8px "Press Start 2P", monospace'; cx.textAlign = 'center';
    cx.fillText('NO RHYME', 0, -54); cx.textAlign = 'left';
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

/* ═══════════════ THE FIVE SOUNDS ═══════════════
   One block per family, below this banner, in FAM_IDS order, each
   ending in one regFam(). Everything a sound does lives in its own
   block: nothing above this line has a branch on a family id in it,
   and that is the point. Eight shared functions were about to grow
   five branches each from five authors.
   Every row is seeded from `none` (2.1a), so a family that has not
   landed yet draws the plain thing rather than throwing, and a family
   that wants a slot gone passes null for it and the consumer tests
   for truth.
   The banner sits here, immediately under FOE_DRAW, for one reason
   that is a hard ReferenceError and not a style note: THE SILHOUETTE
   below reads MOUTH_SHUT, THIEF_SPR, DRONER_SPR, DEAF_SPR and
   SWORD_SPR, which are plain `var`s, and `var` hoists the binding and
   not the initialiser. See foeSil. */
/* The tables are named in two places, 2.1 (which gives them to -proj)
   and 3.0.1 (which gives them this banner), and they are the same set
   of names. Whichever block a merge puts first wins the allocation and
   the other keeps it: a bare second `= {}` further down the file would
   silently drop a `none` row that had already been seeded into it, and
   the failure is a lookup returning undefined and a thrown call, which
   is crit-eng-eat #7 with the numbers changed. */
var FAM_CALL = FAM_CALL || {}, FAM_PIP = FAM_PIP || {}, FAM_FADE = FAM_FADE || {},
    FAM_LAND = FAM_LAND || {}, FAM_ST = FAM_ST || {}, FAM_FIN = FAM_FIN || {},
    FAM_SOUR = FAM_SOUR || {}, FAM_LINE = FAM_LINE || {};
/* Two entries, -eat and -ark, and it is why the 0.5s burn tick stopped
   hard-coding 'eat' and an orange ember. 3.0.6 C. */
var FAM_BURN = {};
function regFam(id, r) {
    var base = FAM_CALL.none ? null : 1;               // the `none` row registers first
    FAM_CALL[id] = r.call || FAM_CALL.none;
    FAM_PIP[id]  = r.hasOwnProperty('pip')  ? r.pip  : FAM_PIP.none;
    FAM_FADE[id] = r.fade || null;                     // opt in: only -ight and -erd have one
    FAM_LAND[id] = r.hasOwnProperty('land') ? r.land : FAM_LAND.none;
    FAM_ST[id]   = r.st   || null;                     // opt in: not every family marks a body
    FAM_FIN[id]  = r.fin  || null;
    FAM_SOUR[id] = r.sour || null;
    FAM_LINE[id] = r.line || null;
    if (id !== 'none') {
        regDet(id, r.det || null);
        regSnap(id, r.hasOwnProperty('snap') ? r.snap : snapDefault);
        /* the family's own world pass. ord is fixed by 2.7's table and
           is not negotiable: 42/44/46/48/50 in FAM_IDS order, so five
           families layer in a stated order instead of in whatever
           order the branches merged. */
        regFx(id, r.step || null, r.draw || null,
              { ord: r.ord, cap: r.cap || 96, make: r.make || function () { return { a: [] }; } });
    }
    return base;
}

/* THE `none` ROW, and it registers before any family (2.1a).
   Three call sites already reach for it and until this line existed
   all three of them found `undefined`: stepCalls and drawCalls do
   `FAM_CALL[c.fam] || FAM_CALL.none` and then read a property off the
   answer, and drawStacks does `(FAM_PIP[s.fam] || FAM_PIP.none)(...)`,
   which is a thrown call rather than a missing decoration. Nothing
   reaches the fallback today because all five families supply all
   three, so this is a guard against the next sound anybody adds, or
   against a stack whose family was renamed out from under a save.

   The call row is deliberately EMPTY. Every read of it in stepCalls
   and drawCalls is already guarded (`if (R.fly)`, `if (R.mark)`,
   `if (R.head)`, `if (R.word)`, `R.step ? ... : ...`), and the else
   branch of the word draws the plain double-struck rime, which is
   exactly the right default: a sound with no design of its own still
   flies, still reads, and still says which word it is.

   The pip is the one thing that has to be real, because it is called
   unguarded. One cell, one glyph, the family's own glow, and the
   drone grey. It is the pre-overhaul drawStacks cell, kept as the
   floor nobody can fall through. */
regFam('none', {
    call: {},
    pip: function (cx, s, x, sy, w, fade) {
        var fam = FAMS[s.fam];
        cx.fillStyle = partCol(hex2rgb(fam ? fam.col : '#8a8090'), 0.3 * fade);
        cx.fillRect(x - w / 2 + 1, sy - 10, w - 2, 14);
        cx.fillStyle = s.drone ? '#8a8090' : (fam ? fam.glow : '#8a8090');
        cx.fillText((fam ? fam.tag : '?').slice(0, 1), x, sy);
    },
    land: null
});

/* The per-body private bag. One object per foe per family that wants
   one, made on demand, dying with the body. `f._fv` at 3468 is the
   house precedent for the underscore.
   Nothing in FX ever holds an `f`: foeDie sets f.dead = 1 (3421),
   stepFoes splices on the next frame (3068) and gotoPlace does
   RT.foes.length = 0, so a record holding a foe keeps a corpse alive
   and redraws it at a tile that means something else in the next
   room. Copy f.x, f.y and foeH(f) at emit time; that rule has no
   exceptions in this section. */
/* famBag and not famOf, which is what 3.0.2 calls it: there is
   already a `function famOf(kind)` in the audio block, the one whose
   comment starts "S.call and S.answer were the verbs when this was
   written". Function declarations hoist and the LAST one wins, so
   naming this famOf would have handed every per-body bag in all five
   families to a function that returns 'eat'. No collision ledger
   entry caught it because the audio one is not a magic-layer name.
   The two live at opposite ends of the file and neither knows about
   the other; this one keeps the argument order and the body it was
   specified with. */
function famBag(f, id) {
    var b = f._fx || (f._fx = {});
    return b[id] || (b[id] = {});
}

/* Which side of a body the player is on. crit-eng-ight #16: the -ight
   design wrote `< sx ? 1 : -1` in the pip and `< sx ? -1 : 1` in the
   body, called them "the same sign" in a comment, and both were
   individually correct. One helper, and every use site writes out
   which way it is pointing. +1 means the player is to the LEFT on
   screen, so the lit face is the left face and the shadow goes right. */
function playerSide(sx) { return isoX(RT.px, RT.py) < sx ? 1 : -1; }

/* A stable pseudo-random in [0,1) from an integer. crit-eng-ark #15:
   -ark's five waterline column tops, -eat's notch placement and
   -ill's thaw cracks are all seeded shapes that must hold still on a
   body while the body wobbles under them, and rnd() re-rolls them at
   144Hz, which is a strobe rather than a texture. `f.anim` is not a
   seed either: it is rnd(0,TAU) at spawn and += dt every frame (3053),
   so anything seeded off it crawls. Stamp an integer once and hash it.
   Two multiplies and a subtraction, no allocation, deterministic. */
function frac(n) { var s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); }

/* Which family currently owns this body's look. A foe can be burning
   and silenced and frozen at once and three overlays on one
   silhouette is mud, so there is an order and it is stated: stopped
   beats shut up beats being looked at beats rotting beats burning.
   -ill wins because it is the only one that repaints the whole body;
   -erd is next because its marks are mostly OUTSIDE the silhouette
   and it can draw them itself even when it does not own the body. */
function famStatus(f) {
    if (f.frozen > 0) return 'ill';
    if (f.silence > 0) return 'erd';
    if (f.revealed > 0) return 'ight';
    if (f.burn) return f.burn.fam === 'ark' ? 'ark' : 'eat';
    /* and -eat keeps the body for the third of a second its notches
       take to close over. An effect that ENDS is worth three that
       switch off, and without this line the ending is dead code:
       stepEat arms e.shut on the frame f.burn goes null, which is the
       same frame this function would otherwise stop returning 'eat'. */
    if (f._fx && f._fx.eat && f._fx.eat.shut > 0) return 'eat';
    return 'none';
}

/* THE SILHOUETTE. -eat asked for it, -ight, -ill and -ark all need
   it, and it is the single most valuable shared primitive in this
   section, so it is written once and lives beside FOE_H and
   FOE_DRAW rather than inside any family's block.
   crit-eng-eat #1 is why the position matters and it is a hard
   ReferenceError, not a style note: MOUTH_SHUT, THIEF_SPR,
   DRONER_SPR, DEAF_SPR and SWORD_SPR are plain `var`s at module
   scope, and `var` hoists the binding and not the initialiser, so a
   FOE_SIL literal evaluated up in the families banner captures five
   undefineds and the first -eat close throws inside draw() with three
   unrestored saves on the context. The file already carries this scar
   twice.
     rows  the sprite's own row strings, so the mask is per pixel
           accurate and free: bake() already skips any character not
           in the palette.
     lo/hi per row, the first and last non-air column. crit-art-eat #2:
           every family that places a mark "on the rim" was placing
           it on f.r * 22, which is the HIT radius and is 4 to 10
           pixels inside the ink on every archetype. Twenty-two
           numbers per kind, computed once, and they are the
           difference between a bite out of a body and a black
           rectangle floating in front of its chest.
     dx    the drawer's own blit offset: drawThief is x=2,
           drawSword x=3. crit-eng-ill #8.
   The Sword's tell wraps its blit in translate/rotate/translate and
   this mask reproduces no such transform, so a mask on a Sword
   mid-tell slides off. The Sword is `norhyme` so it can never be
   detonated, but it CAN be frozen, and -ill's ice path below checks
   for it by name. */
var FOE_SIL = null;
function foeSil(kind) {
    if (!FOE_SIL) FOE_SIL = {
        mouth:  { rows: MOUTH_SHUT, alt: MOUTH_WIDE, dx: 0 },
        thief:  { rows: THIEF_SPR,  dx: 2 },
        droner: { rows: DRONER_SPR, dx: 0 },
        deaf:   { rows: DEAF_SPR,   dx: 0 },
        sword:  { rows: SWORD_SPR,  dx: 3, noMask: 1 }
    };
    var d = FOE_SIL[kind];
    if (!d) return null;                        // the Chorus has no rows. Every caller has a fallback.
    if (!d.lo) {
        d.lo = []; d.hi = [];
        for (var r = 0; r < d.rows.length; r++) {
            var row = d.rows[r], a = -1, b = -1;
            for (var c = 0; c < row.length; c++)
                if (row.charAt(c) !== '.') { if (a < 0) a = c; b = c; }
            d.lo.push(a); d.hi.push(b);
        }
        d.w = d.rows[0].length * PXS; d.h = d.rows.length * PXS;
    }
    return d;
}
/* A flat one-colour bake of the same rows. The palette is not part of
   bake()'s key, which is why every existing caller folds the varying
   part into the key by hand (`foe.thiefT` vs `foe.thief`), so the
   colour goes in the key here too. One canvas per kind per colour,
   forever, against a 10 MB SPRITE_BUDGET. */
function foeSilSpr(kind, col) {
    var d = foeSil(kind); if (!d) return null;
    var k = 'sil.' + kind + '.' + col, s = SPR[k];
    if (s) return s;
    var pal = {}, i, ch, seen = {};
    for (i = 0; i < d.rows.length; i++)
        for (var j = 0; j < d.rows[i].length; j++) {
            ch = d.rows[i].charAt(j);
            if (ch !== '.' && !seen[ch]) { seen[ch] = 1; pal[ch] = col; }
        }
    return bake(k, d.rows, pal);
}
/* row r of kind K, in drawFoe's body transform (origin at the feet,
   up negative). `+ d.dx` is the drawer's blit offset and `- d.w / 2`
   is blit's own centring. */
function silX(d, c) { return c * PXS + d.dx - d.w / 2; }
function silY(d, r) { return r * PXS - d.h; }

/* ─────────────── -eat, hunger ───────────────
   "We burned the doors, we burned the pews, we burned the market
   street." Nothing in this family is ADDED to the world. Every layer
   is something taken out and moved somewhere else, and there is one
   primitive, the notch, which appears on the body, in the word and on
   the floor. Stanza 1 is the one stanza the town did not falsify:
   nobody lied about being hungry. If you find yourself drawing a
   flame, stop. */
/* A cooling curve, not a fire palette. Derived off FAMS.eat so it
   cannot drift, and the hole is the house shadow rather than a
   sixth dark. crit-art-eat #1: the design's #120d18 differs from the
   Hearsay's own T value #120c17 by one, one and one, so a bite out of
   the commonest enemy in the game was drawn in the colour that
   enemy's teeth-shadow is already made of, and then washed 50% by
   drawLights. #08060c is darker than any body pixel in the game.
   EAT_ASH is deleted: crit-art-eat #10 is right that a palette entry
   read by nothing is a table telling a lie, and the shed crumbs it
   was for are EAT_CHAR, which is the same idea one value warmer. */
var EAT_LIT, EAT_HOT, EAT_COOL, EAT_CHAR, EAT_BITE = '#08060c';
var EAT_MOTE0, EAT_MOTE1, EAT_MOTE2;
function eatBoot() {                                  // called from fxBoot: rgbMul needs hex2rgb
    EAT_LIT = hex2rgb(FAMS.eat.glow);                 // 255,194,113
    EAT_HOT = hex2rgb(FAMS.eat.col);                  // 232,145,58
    EAT_COOL = rgbMul(FAMS.eat.col, 0.78);            // 181,113,45
    EAT_CHAR = rgbMul(FAMS.eat.col, 0.38);            // 88,55,22
    /* three constant alphas on the one drawer in the family that runs
       per frame per mote, so they are built once and never in a loop */
    EAT_MOTE0 = 'rgba(' + EAT_LIT + ',1)';
    EAT_MOTE1 = 'rgba(' + EAT_LIT + ',.45)';
    EAT_MOTE2 = 'rgba(' + EAT_LIT + ',.20)';
}
function evenPx(v) { return Math.round(v / 2) * 2; }  // PXS is 2 and the town is on a 2px lattice

/* -eat's row. `fly` is read by stepCalls, the four drawers by
   drawCalls. It gets FASTER as it goes because it is eating. */
var EAT_CALL = {
    fly: { rate: 46, acc: 0.55, accL: 1.35, wob: 0, step: 0, grav: 46 },

    /* The trail falls. -ark's hangs, -ill's holds still, -erd has none
       and -ight's is dust: you can tell which sound is in the air with
       the volume off and the word illegible, which is the cheapest
       family read in the game.
       One crumb in four is a SPLINTER: sh:1, the 2:1 floor chip from
       2.5, at twice the length. crit-art-eat #12 is right that a
       shower of identical squares is burst() with extra steps, and
       that this stanza is a town feeding its own furniture into a
       stove. A shower of squares with plank ends in it is a pew going
       into a fire, and it costs one field that already exists. */
    trail: function (c, dt) {
        var sp = Math.random(), col = sp < 0.25 ? EAT_LIT : sp < 0.75 ? EAT_HOT : EAT_COOL;
        part({ x: c.x, y: c.y, z: 24 + rnd(-3, 3), vx: 0, vy: 0,
               vz: rnd(-14, 4),                       // today it is rnd(2,10). It falls.
               life: rnd(0.18, 0.42), size: rnd(1, 2.2), col: col, add: 1, grav: 55,
               sh: sp < 0.25 ? 1 : 0 });
    },

    /* The floor mark: a scorch, and the arc opens the way the word is
       going. Ground plane, 1:0.5, like everything else on this floor. */
    mark: function (cx, c, sx, sy, P) {
        var r = (0.30 + c.near * 0.10) * TILE_W / 2;
        /* 4.9.3's two corrections in passing: the brown-black was a new
           colour in a closed violet-black palette (crit-art-proj 8), and
           lineWidth 1.5 or 2 with imageSmoothingEnabled false is a band
           of half-alpha mud straddling a pixel boundary (crit-art-proj
           10). The warmth comes from the additive arc on top of it. */
        cx.fillStyle = 'rgba(8,6,12,.34)';
        cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill();
        cx.globalCompositeOperation = 'lighter';
        cx.globalAlpha = 0.34 + c.near * 0.34; cx.strokeStyle = P.col; cx.lineWidth = 1;
        cx.beginPath(); cx.arc(0, 0, r * 0.86, c.a - 1.22, c.a + 1.22); cx.stroke();
    },

    /* The head is a mouth: the shared lit disc, then a hard bite out
       of the BACK of it, offset along the reversed heading. A lit
       crescent leading, a dark bite behind. The jaw shuts as it
       arrives. isoAng, because a world heading of 0 leaves the barrel
       at 26.6 degrees on screen and the raw angle is up to 63 degrees
       wrong (2.3). */
    head: function (cx, c, sx, sy, P) {
        var k = c.near, sa = isoAng(c.a), jaw = lerp(0.42, 0.10, k);
        cx.globalCompositeOperation = 'lighter';
        cx.globalAlpha = 0.26 + (c.couplet ? 0.14 : 0); cx.fillStyle = P.col;
        cx.beginPath(); cx.arc(sx, sy - 4, 9 + (c.couplet ? 3 : 0) + k * 2, 0, TAU); cx.fill();
        cx.globalCompositeOperation = 'source-over';
        cx.globalAlpha = 0.72; cx.fillStyle = EAT_BITE;
        cx.beginPath(); cx.arc(sx - Math.cos(sa) * 5, sy - 4 - Math.sin(sa) * 5, 8, 0, TAU); cx.fill();
        cx.globalCompositeOperation = 'lighter';
        cx.globalAlpha = 0.5 + k * 0.4; cx.strokeStyle = P.glow; cx.lineWidth = 1.5;
        cx.beginPath();
        cx.moveTo(sx, sy); cx.lineTo(sx + Math.cos(sa - jaw) * 7, sy + Math.sin(sa - jaw) * 7);
        cx.moveTo(sx, sy); cx.lineTo(sx + Math.cos(sa + jaw) * 7, sy + Math.sin(sa + jaw) * 7);
        cx.stroke();
    },

    /* THE WORD IS EATEN FROM THE FRONT.
       crit-art-eat #7 caught what chewing the tail actually produces:
       heat to HE, wheat to WHE, street to STRE, eat to EA. Three of
       four are letter salad, and the fourth is the pronoun this entire
       game is about a town writing over another one. Worse, it is a
       SPELLING event in a game whose physics is that rhyme is how the
       world checks whether something is true: the tail of the word IS
       the rhyme, so eating it made the picture lie about the mechanic.
       From the front: street to TREET to EET, wheat to HEAT to EAT,
       heat to EAT, eat to EAT. Every result is legible, every result
       still rhymes, and what lands is the syllable, which is exactly
       what sticks. The rhyme is the last thing to go. */
    word: function (cx, c, sx, sy, P) {
        var w = eatWord(c), size = (12 + (c.couplet ? 1.5 : 0) + c.near * 1.6) * (1 + c.age * 0.14);
        cx.textAlign = 'center';
        cx.font = 'bold ' + size.toFixed(1) + 'px "Press Start 2P", monospace';
        cx.fillStyle = '#08060c'; cx.fillText(w, sx + 1.5, sy + 1.5);
        if (c.couplet) { cx.globalAlpha = 0.55; cx.fillStyle = P.glow; cx.fillText(w, sx - 1, sy - 1); cx.globalAlpha = 1; }
        cx.fillStyle = P.col; cx.fillText(w, sx, sy);
    },

    fizz: function (c) {
        /* four char crumbs, no upward push, straight down. The
           syllable fell on the ground and went out. */
        spray(c.x, c.y, 22, 4, c.a, 1.1, { col: EAT_CHAR, add: 0, sp0: 0.1, sp1: 0.5,
                                           vz0: -10, vz1: 2, l0: 0.4, l1: 0.9, grav: 90, sh: 1 });
    },

    /* THE CAST. crit-art-eat #15: the chain of falling matter started
       one link too late. Three char crumbs at the barrel point, vz
       negative, falling immediately, so the material runs unbroken
       from your mouth, through the flight, into the body, out of the
       wound and back into your chest. One substance, five stations,
       three particles per call. */
    cast: function (x, y, a) {
        spray(x, y, 20, 3, a, 0.9, { col: EAT_CHAR, add: 0, sp0: 0.1, sp1: 0.6,
                                     vz0: -12, vz1: 0, l0: 0.35, l1: 0.7, grav: 120, sh: 1 });
    }
};
/* The chewed word, computed and not stored, so nothing has to be
   cleared. c.max is on the call literal as `max: T('callRange') / 13`:
   crit-eng-ill #19 is right that recomputing T('callRange') per frame
   is wrong the moment somebody drags the FEEL slider mid flight, and
   it is the same field typo, slam and snap all carry.
   Words of four or fewer never chew, so `eat` stays `EAT`. */
function eatWord(c) {
    var w = c.word.toUpperCase();
    if (w.length < 5) return w;
    return w.slice(c.age > 0.82 ? 2 : c.age > 0.55 ? 1 : 0);
}

/* Four layers in a 13px cell, and the fourth is the one that matters.
   crit-art-eat #10: the core loop is build a pile, watch it get
   scary, close it, and the design rendered the close magnificently
   and the build not at all. */
function eatPip(cx, s, x, sy, w, fade) {
    /* the seed. crit-eng-eat #11: addStack sets born but the Droner's
       self-write does not, so every drone -eat pip seeded off
       `(s.born||0)*1000` came out flat-bottomed and identical.
       `born: RT.t` is added at the Droner's push in this commit (it is
       one token and it is job 4's line), and the index is the
       fallback so this cannot depend on that landing. */
    var seed = ((s.born || 0) * 1000 | 0) + (s.i || 0) * 17, i, nx;
    cx.globalCompositeOperation = 'lighter';
    cx.fillStyle = fampx().eat.wash;
    cx.fillRect(x - w / 2 + 1, sy - 10, w - 2, 14);
    cx.globalCompositeOperation = 'source-over';
    /* the bottom is bitten. Two or three notches in the PLATE colour
       out of the bottom edge of the wash, deterministic per stack so
       they hold still, different between neighbours so a row of four
       -eat pips has a ragged edge instead of four identical cells. */
    cx.fillStyle = 'rgba(8,6,12,.72)';
    for (i = 0; i < 3; i++) if (seed & (1 << i)) {
        nx = x - w / 2 + 2 + i * 4;
        cx.fillRect(nx, sy + 2 - (2 + (seed >> (i + 3) & 1) * 2), 2, 4);
    }
    /* the glyph, and it erodes. This replaces drawStacks' alpha fade,
       which bottoms out at 0.3 and never reaches zero, with a SHAPE
       change you can read at the edge of vision. The crossbars of the
       E go first and it ends as a bare vertical stroke. */
    cx.fillStyle = s.drone ? '#8a8090' : FAMS.eat.glow;
    cx.fillText('E', x, sy);
    if (s.t < 1.2) {
        cx.fillStyle = 'rgba(8,6,12,.72)';
        cx.fillRect(x - 1, sy - 8, clamp((1.2 - s.t) / 1.2 * 5, 0, 5), 9);
    }
}
/* THE PILE SHEDS. A foe carrying two or more -eat stacks drops one
   char crumb every 0.5/nEat seconds OFF THE PLATE, not off its head:
   the row is the pile and the pile is overflowing, which is a
   typographic object shedding matter and is the doctrine in one
   gesture. Rate limited PER FOE, so eight foes at eight stacks is 64
   a second against a 900 cap, and a single stack is silent, because
   one syllable is not yet an appetite.
   In the family stepper, never in drawStacks: a drawer that emits
   makes the particle count depend on how many times you painted.
   The x/y nudge is the identity isoX(x + d, y - d) === isoX(x, y) +
   d * TILE_W with isoY unchanged, which is exact in this projection
   and is the only legal way to put a world particle at a screen-pixel
   offset. It is used three more times in this family and once in -ark. */
function eatShed(f, dt) {
    var n = 0, i;
    for (i = 0; i < f.stacks.length; i++) if (f.stacks[i].fam === 'eat') n++;
    if (n < 2) return;
    var e = famBag(f, 'eat');
    e.shed = (e.shed || 0) - dt;
    if (e.shed > 0) return;
    e.shed = Math.max(0.125, 0.5 / n);
    var pw2 = f.stacks.length * 13 + 8;
    part({ x: f.x + rnd(-pw2 / 2, pw2 / 2) / TILE_W, y: f.y - rnd(-pw2 / 2, pw2 / 2) / TILE_W,
           z: foeH(f) + 18 + (f.so || 0) - 4, vx: 0, vy: 0, vz: rnd(-8, 0),
           life: rnd(0.5, 0.9), size: rnd(1.4, 2.4), col: EAT_CHAR, add: 0, grav: 120, sh: 1 });
}
/* The stack ate you instead. Hunger that goes unanswered should be
   the one that reads worst: the erosion finishes in one frame, three
   char crumbs come off the plate, and the self-damage number is char
   rather than the shared white. */
function eatSour(f, s, i) {
    var pw2 = f.stacks.length * 13 + 8, j;
    for (j = 0; j < 3; j++)
        part({ x: f.x + rnd(-pw2 / 2, pw2 / 2) / TILE_W, y: f.y, z: foeH(f) + 14 + (f.so || 0),
               vx: 0, vy: 0, vz: rnd(-14, -4), life: rnd(0.5, 0.9), size: rnd(1.6, 2.8),
               col: EAT_CHAR, add: 0, grav: 150, sh: 1 });
    return EAT_CHAR;                    // breakStack tints its own number with the return
}

/* One body, n syllables, d the shared detonation context (3.0.2).
   Nothing here stores f. Everything here reads d and writes only
   fxOf('eat') and famBag(f,'eat').
   crit-eng-eat #7: a Reprise fires this THREE times per foe inside
   0.68 seconds with the full pile each time, which is 912 crumbs, 24
   words and 24 rings against a 900 cap, and it re-seeds the notch set
   twice mid-effect so the holes jump. `d.kind === 'beat'` is the
   repeat signal and it is already on the record, so no new argument
   is needed: a repeat halves the matter, skips the ring and the word,
   and does not re-seed. */
function eatDet(f, n, d) {
    var st = fxOf('eat'), e = famBag(f, 'eat'), rep = d.kind === 'beat' || d.kind === 'wave';
    var h = foeH(f), i, cb, sp;
    if (d.i === 0) st.wordAt = -1;              // a new detonation starts: re-arm the one word
    if (f.def.folk) return;                     // crit-eng-eat #9: unreachable today, two lines to keep it that way

    // 1. THE BITE. Instant, at full depth, no grow-in. A bite is not a process.
    if (!(rep && e.nb)) {
        e.seed = e.seed == null ? irnd(0, 100000) : e.seed;
        e.nb = clamp(2 + Math.round(n * 0.9), 3, 10);
        e.nw = evenPx(clamp(4 + n * 0.6, 4, 9));
        e.nh = evenPx(clamp(3 + n * 0.5, 3, 8));
    }
    e.shut = 0;                                  // the closing-over timer, armed when the burn ends
    e.on = 1;

    // 2. THE CRUMBS, and the budget is divided BEFORE the loop.
    cb = fxBudget(clamp(6 + n * 4, 8, 40), d.wide, Math.round(T('eatMatter') * 40)) * (rep ? 0.5 : 1);
    for (i = 0; i < cb; i++) {
        sp = i / cb;                             // the shower cools by INDEX, which costs nothing
        part({ x: f.x + rnd(-.12, .12), y: f.y + rnd(-.12, .12), z: rnd(4, h * 0.9),
               vx: Math.cos(i * 2.399) * rnd(0.5, 1.9 + n * 0.06),
               vy: Math.sin(i * 2.399) * rnd(0.5, 1.9 + n * 0.06),
               vz: rnd(-30, 25),                 // DOWNWARD, against every other burst in the game
               grav: 190,
               life: sp < 0.34 ? rnd(0.30, 0.55) : sp < 0.67 ? rnd(0.45, 0.85) : rnd(0.70, 1.25),
               size: sp < 0.34 ? rnd(1.6, 3.0) : sp < 0.67 ? rnd(1.4, 2.6) : rnd(1.2, 2.2),
               col:  sp < 0.34 ? EAT_LIT : sp < 0.67 ? EAT_HOT : EAT_CHAR,
               add:  sp < 0.67 ? 1 : 0,
               sh: (i & 3) === 3 ? 1 : 0 });     // one in four is a splinter
    }

    // 3. THE MOUTH CLOSES. A ring of TEETH, not a stroke.
    if (!rep) fxPush(st.a, { k: 'ring', x: f.x, y: f.y, r0: Math.min(f.r + 1.1 + n * 0.14, 3.4),
                             nt: clamp(10 + n, 12, 16), t: 0, max: 0.27, d: d.i * d.stag }, 64);

    // 4. THE WORD. ONE of them, on the body carrying the biggest pile.
    if (!rep && n >= d.best && st.wordAt < 0) {
        st.wordAt = d.i;
        fxPush(st.a, { k: 'word', x: f.x, y: f.y, z: h + 30, seed: e.seed,
                       px: Math.round(18 * d.sc), thru: d.best >= 6,
                       font: 'bold ' + Math.round(18 * d.sc) + 'px "Press Start 2P", monospace',
                       w: 0, t: 0, max: 0.44 + 0.22 * d.pb, d: d.i * d.stag }, 64);
    }

    // 5. THE DRAIN. Always, whatever your health is.
    eatDrain(f, n, h, d);
}
/* THE RING OF TEETH. crit-art-eat #11: MODS.loud.col is EXACTLY
   FAMS.eat.col and a Loud elite wears a steady pulsing ground ring in
   it, so an additive orange ellipse on the floor is the one shape
   this family may not use. The line-weight argument the design made
   holds with three foes on screen and fails at twenty-five, where
   nobody is reading stroke weight, they are reading "orange ellipse".
   Teeth: twelve to sixteen hard notch rects on the 1:0.5 ellipse,
   each with one lit inner edge, marching inward and converging. Same
   maths, same cost bracket, and now the family has exactly ONE
   primitive appearing on the body, in the word and on the floor.
   Every other detonation in this game expands. This one closes. */
function drawEatRing(cx, o, k) {
    var r = (1 - k * k) * o.r0 * TILE_W / 2, a = 0.85 * (1 - k), i, ang, tx, ty;
    if (r < 3) return;
    cx.save();
    cx.translate(Math.round(isoX(o.x, o.y)), Math.round(isoYA(o.x, o.y)));
    cx.scale(1, 0.5);
    for (i = 0; i < o.nt; i++) {
        ang = i * TAU / o.nt + o.r0;             // seeded off its own radius: no two rings phase-lock
        tx = Math.round(Math.cos(ang) * r); ty = Math.round(Math.sin(ang) * r);
        cx.globalAlpha = a; cx.fillStyle = EAT_BITE;
        cx.fillRect(tx - 2, ty - 3, 4, 6);
        cx.globalCompositeOperation = 'lighter';
        cx.fillStyle = partCol(EAT_LIT, a * 0.8);
        cx.fillRect(tx - (Math.cos(ang) > 0 ? 2 : -1), ty - 3, 1, 6);   // the lit edge faces IN
        cx.globalCompositeOperation = 'source-over';
    }
    cx.restore();
}
/* THE WORD. drawCuts' idiom: clip a word, put a hard bar on the cut.
   A death cuts a word off at the END; a hunger detonation takes a
   piece out of the MIDDLE. The same technique says two related
   things, which is what a closed vocabulary is.
   The bite column is seeded off the body (crit-art-eat #16): a fixed
   0.42 gave eight foes eight identical mutilations of the same word.
   measureText is called ONCE and cached on the record
   (crit-eng-eat #20): it returns a TextMetrics object and this is a
   draw loop. */
function drawEatWord(cx, o, k) {
    var sx = Math.round(punchWX(isoX(o.x, o.y))), sy = Math.round(punchWY(isoYA(o.x, o.y) - o.z - k * 26));
    var i, cut, bw, a = clamp((1 - k) * 2.2, 0, 1);
    cx.save(); cx.textAlign = 'center'; cx.font = o.font; cx.globalAlpha = a;
    if (!o.w) o.w = cx.measureText('EAT').width;
    cut = sx - o.w / 2 + Math.round(o.w * (0.30 + frac(o.seed) * 0.26));
    bw = Math.round(o.w * 0.16 + o.px * 0.12);
    cx.fillStyle = '#08060c'; cx.fillText('EAT', sx + 2, sy + 2);
    cx.fillStyle = FAMS.eat.col;
    cx.save(); cx.beginPath(); cx.rect(sx - o.w, sy - o.px * 1.4, cut - (sx - o.w), o.px * 1.8); cx.clip();
    cx.fillText('EAT', sx, sy); cx.restore();
    cx.save(); cx.beginPath(); cx.rect(cut + bw, sy - o.px * 1.4, o.w, o.px * 1.8); cx.clip();
    cx.fillText('EAT', sx + 2, sy + 1); cx.restore();          // the far half slips
    cx.fillStyle = partCol(EAT_LIT, a); cx.fillRect(cut - 2, sy - o.px * 0.9, 2, o.px * 1.05);
    if (o.thru) {                                 // n >= 6: the same holes the body has
        cx.fillStyle = '#08060c';
        for (i = 0; i < 3; i++)
            cx.fillRect(Math.round(sx - o.w * 0.34 + frac(o.seed + i * 5.5) * o.w * 0.7),
                        Math.round(sy - o.px * (0.28 + frac(o.seed + i * 9.1) * 0.42)),
                        evenPx(o.px * 0.22), evenPx(o.px * 0.22));
    }
    cx.restore(); cx.textAlign = 'left';
}

/* Drawn inside drawFoe's body transform, after the flash and the
   freeze. Pure: every number it reads was written by stepEat.
   Three layers and one of them is subtraction. */
function eatBody(cx, f, h, sx, sy) {
    if (!f.burn || f.burn.fam !== 'eat') { if (!famBag(f, 'eat').shut) return; }
    var e = famBag(f, 'eat'), b = f.burn;
    var k = b ? clamp(1 - b.t / (b.max || 3), 0, 1) : 1;
    var shut = e.shut > 0 ? e.shut / 0.30 : 1;               // 1 open, 0 closed over
    var d = foeSil(f.def.draw), spr, i, o = EAT_N, rim;
    if (shut <= 0) return;
    /* THE BODY LOSES VALUE. Per-pixel accurate because it is the
       sprite's own bitmap: the one flat rect over a silhouette that
       drawFoe does twice is the thing this exists not to be. The foe
       converges on the same dark its holes are made of. */
    spr = foeSilSpr(f.def.draw, EAT_BITE);
    if (spr) { cx.globalAlpha = (0.10 + 0.16 * k) * shut; blit(cx, spr, 0, 0); cx.globalAlpha = 1; }
    if (T('eatBites') <= 0) return;              // crit-eng-eat #16: the low-spec look, actually reachable
    /* THE NOTCHES. crit-art-eat #1a: a notch is defined by breaking
       the OUTLINE and not by its fill. A hole in the interior of a
       dark body under a 50% night wash is nothing; a bite out of the
       profile is readable at 34% brightness because the reference is
       the floor behind it. Every notch overhangs the real ink edge by
       two pixels, and the real ink edge comes off foeSil's per-row
       lo/hi rather than off f.r * 22, which is the HIT radius and is
       four to ten pixels inside the ink on every archetype. */
    rim = k < 0.5 ? mixRgb(EAT_LIT, EAT_HOT, k * 2) : mixRgb(EAT_HOT, EAT_CHAR, (k - 0.5) * 2);
    for (i = 0; i < e.nb; i++) {
        eatNotchAt(d, e, i, f, o, shut);
        if (o.w < 1 || o.h < 1) continue;
        cx.fillStyle = EAT_BITE; cx.fillRect(o.x, o.y, o.w, o.h);
        /* the inner rim: the only lit pixel this family ever ADDS to a
           sprite. It does not fade to nothing (crit-art-eat #1c): it
           cools to char and holds there. A cold rim is still an edge.
           No edge is no wound. */
        cx.fillStyle = partCol(rim, 0.75 * shut * T('vfxRimBody'));
        cx.fillRect(o.dir > 0 ? o.x : o.x + o.w - 2, o.y, 2, o.h);
        /* and the lip: one cool pixel on the OUTER edge, so you can
           see the inside of the hole and it stops reading as a
           sticker. One fillRect per notch (crit-art-eat #16). */
        cx.fillStyle = partCol(EAT_COOL, 0.5 * shut);
        cx.fillRect(o.dir > 0 ? o.x + o.w - 1 : o.x, o.y, 1, o.h);
    }
}
var EAT_N = { x: 0, y: 0, w: 0, h: 0, dir: 0 };   // one scratch, written not allocated
/* Where notch i lands on kind d's actual ink. Two thirds bite inward
   from the left and right rims; every third bites DOWN through the
   crown. Seeded once per foe, so the holes hold still while the body
   wobbles under them. */
function eatNotchAt(d, e, i, f, o, shut) {
    var s = frac(e.seed + i * 7.31), t = frac(e.seed + i * 3.77), r, c, side, bt = T('eatBites');
    /* the closing path eases on shut*shut so the last two frames are
       sub-pixel. crit-eng-eat #15: a Math.max(2,...) floor made both
       dimensions stop at 2 and then get switched off, and a 2x2 black
       square blinking out is not "it survived and it healed over". */
    o.w = Math.round(e.nw * shut * shut * bt); o.h = Math.round(e.nh * shut * shut * bt);
    if (!d) {                                     // the Chorus: no rows, fall back to the box
        side = (i & 1) ? 1 : -1;
        o.x = evenPx(side * f.r * 22) - (side > 0 ? o.w : 0);
        o.y = evenPx(-foeH(f) * (0.18 + s * 0.66)); o.dir = side;
    } else if (i % 3 === 2) {
        r = Math.floor(1 + t * 2);
        c = d.lo[r] + Math.round(s * Math.max(0, d.hi[r] - d.lo[r]));
        o.x = evenPx(silX(d, c)); o.y = evenPx(silY(d, r)) - 2; o.dir = 0;
    } else {
        r = Math.floor(d.rows.length * (0.18 + s * 0.62));
        side = (i & 1) ? 1 : -1;
        c = side > 0 ? d.hi[r] : d.lo[r];
        if (c < 0) c = side > 0 ? d.rows[0].length - 1 : 0;      // an all-air row
        o.x = evenPx(silX(d, c) + (side > 0 ? PXS - o.w + 2 : -2));
        o.y = evenPx(silY(d, r)); o.dir = side;
    }
    /* crit-eng-eat #5: the rect grows DOWNWARD from y, so a low notch
       on a small foe put four opaque pixels below the ground line, on
       top of the contact ellipse, on every small body. */
    o.y = Math.min(o.y, -o.h - 2);
}
/* THE CHEW ADVANCES, on the burn's own 0.5s tick, through FAM_BURN.
   One notch, cycling by tick index, grows by 2px in each dimension,
   and the crumbs come off THAT notch rather than off the foe's
   centre, through the x + d / y - d identity. No scorch decal: scorch
   is fire leaving a mark and this family does not leave marks, it
   takes things away. */
FAM_BURN.eat = function (f) {
    var e = famBag(f, 'eat'), o = EAT_N, i, cn;
    if (e.seed == null) return;
    e.tick = (e.tick || 0) + 1;
    e.nw += 2; e.nh += 2;
    eatNotchAt(foeSil(f.def.draw), e, e.tick % Math.max(1, e.nb), f, o, 1);
    cn = clamp(2 + Math.round((f.burn.dps / 5) * 0.4), 2, 6);
    for (i = 0; i < cn; i++)
        part({ x: f.x + o.x / TILE_W, y: f.y - o.x / TILE_W, z: foeH(f) + o.y,
               vx: rnd(-.3, .3), vy: rnd(-.3, .3), vz: rnd(-12, 6),
               life: rnd(0.4, 0.9), size: rnd(1.2, 2.4),
               col: i & 1 ? EAT_CHAR : EAT_COOL, add: 0, grav: 170, sh: (i & 1) });
};

/* THE DRAIN, and it runs whether or not you have room for it.
   crit-eng-eat #8 and crit-art-eat #4: the design gated the whole
   layer on `heal > 0`, and gotoPlace refills you on every transition,
   so the family's headline effect was silently skipped in the
   commonest state of the game and the first hunger detonation a new
   player ever casts showed them nothing. It is also wrong per foe in
   a multi-foe close, because live.forEach runs in list order and the
   first body consumes the whole deficit.
   The theft happens either way. At full health the pieces still come
   out of the wound and arrive; the number just does not appear.
   crit-art-eat #5: counted off n, not off heal. The count stays
   capped at four and the POWER moves into weight and rhythm, which
   the eye reads faster than a count anyway: the motes get fatter and
   the stagger tightens into a drumroll. */
function eatDrain(f, n, h, d) {
    var st = fxOf('eat'), per = clamp(Math.round(n * 1.5), 1, 4), i, e = famBag(f, 'eat');
    var gap = Math.max(0.02, 0.09 - n * 0.008), o = EAT_N;
    for (i = 0; i < per; i++) {
        eatNotchAt(foeSil(f.def.draw), e, i, f, o, 1);        // it leaves from a HOLE, not from the centre
        fxPush(st.motes, { x0: f.x + o.x / TILE_W, y0: f.y - o.x / TILE_W,
                           z0: h + o.y, hp: n * 1.5 / per,
                           sz: Math.min(6, 3 + per), arc: rnd(18, 32),
                           t: -(d.i * d.stag + i * gap),
                           max: Math.max(0.20, 0.30 - clamp(n, 1, 8) * 0.012), done: 0 }, 40);
    }
}
/* Three rects and no allocation, on a u*u lag so it loiters near the
   corpse and then accelerates into you: something with an appetite is
   pulling on the far end of that line. The lead square gets one dark
   pixel on its trailing side (crit-art-eat #16), which is the
   difference between a smear and an object with a front and a back.
   crit-eng-eat #14: the mote used to be spliced before it was drawn
   at u = 1, so it vanished 6.6% short of your chest. It is flagged,
   drawn once at k = 1, and spliced on the following frame. */
function drawEatMote(cx, m, k) {
    var u = k * k, px = isoX(RT.px, RT.py), py = isoYA(RT.px, RT.py) - 26;
    var x0 = isoX(m.x0, m.y0), y0 = isoYA(m.x0, m.y0) - m.z0, j, uu, mx, my, s;
    for (j = 0; j < 3; j++) {
        uu = clamp(u - j * 0.06, 0, 1);
        mx = Math.round(lerp(x0, px, uu)); my = Math.round(lerp(y0, py, uu) - Math.sin(uu * Math.PI) * m.arc);
        s = m.sz - j;
        cx.fillStyle = j === 0 ? EAT_MOTE0 : j === 1 ? EAT_MOTE1 : EAT_MOTE2;
        cx.fillRect(mx - s / 2, my - s / 2, s, s);
        if (j === 0) { cx.fillStyle = '#08060c'; cx.fillRect(mx - s / 2 - 1, my - s / 2 + 1, 1, s - 1); }
    }
}
/* THE HUSK. crit-art-eat #13: foeDie was in nobody's hook list, so a
   Hearsay finished by hunger died with the same grey 16-particle
   burst as one that bled out. The family whose whole thesis is that
   things get consumed had nothing to say about the moment something
   is finished.
   Returning 1 suppresses the default burst. The notches outlive the
   body by half a second and then fall: you ate it, and the holes are
   the last thing left. */
function eatFin(f) {
    if (!(f.burn && f.burn.fam === 'eat')) return 0;
    var st = fxOf('eat'), e = famBag(f, 'eat'), i, o = EAT_N, d = foeSil(f.def.draw);
    burst(f.x, f.y, foeH(f) * 0.5, 14, { col: EAT_CHAR, add: 0, sp0: 0.4, sp1: 1.8,
                                          l0: 0.5, l1: 1.1, grav: 190, sh: 1 });
    for (i = 0; i < e.nb; i++) {
        eatNotchAt(d, e, i, f, o, 1);
        fxPush(st.a, { k: 'husk', x: f.x, y: f.y, ox: o.x, oy: o.y, w: o.w, h: o.h,
                       t: 0, max: 0.62 }, 96);
    }
    return 1;
}

/* Matter on the sim clock, the one word and the drain on real.
   Nothing in here holds an f across a frame. */
function stepEat(dt, real, st) {
    var i, o, F = RT.foes, f, e, k;
    for (i = st.a.length - 1; i >= 0; i--) {
        o = st.a[i];
        o.t += (o.k === 'word' || o.k === 'plus') ? real : dt;
        if (o.t >= (o.d || 0) + o.max) st.a.splice(i, 1);
    }
    for (i = st.motes.length - 1; i >= 0; i--) {
        o = st.motes[i];
        if (o.done) { st.motes.splice(i, 1); continue; }   // drawn once at k = 1, spliced the frame after
        o.t += real;
        if (o.t >= o.max) { o.done = 1; eatArrive(st, o); }
    }
    /* fed is the consumer growing, and it is on the sim clock with the
       body it came out of. A big drain leaves you visibly lit for
       about a second and a half; a nibble does not light you at all. */
    if (st.fed > 0) st.fed = Math.max(0, st.fed - st.fed * 0.55 * dt - dt * 0.02);
    if (st.flush > 0) {
        st.flush -= real;
        if (st.flush <= 0) { eatNumber(st); st.pend = 0; }
    }
    for (i = 0; i < F.length; i++) {
        f = F[i]; if (!f || f.dead) continue;
        eatShed(f, dt);
        e = f._fx && f._fx.eat; if (!e) continue;
        if (f.burn && f.burn.fam === 'eat') {
            k = clamp(1 - f.burn.t / (f.burn.max || 3), 0, 1);
            e.on = 1; f.csr = 1 + k * 0.35;          // THE GROUND GIVES, on the shared channel
        } else if (e.on) {
            /* When the burn ends the notches close over. An effect
               that ends is worth three that switch off. */
            e.on = 0; e.shut = 0.30; f.csr = null;
        }
        if (e.shut > 0) e.shut = Math.max(0, e.shut - dt);
    }
}
function eatArrive(st, m) {
    st.fed += m.hp * T('eatFed');
    st.pend += m.hp;
    st.flush = 0.12;
    /* the gate is 30ms so a four-mote drumroll gets four ticks and
       eight simultaneous foes do not get thirty-two */
    fxSfx('eatmote', 0.03);
}
/* ONE number, and it is the family's own type rather than a damage
   number in the same voice (crit-art-eat #16). The largest number
   that ever comes off an enemy and into you. If you were full it says
   so in nine characters and two crumbs fall off your chest. */
function eatNumber(st) {
    var full = st.pend < 1;                                // the heal itself is famEffect's, not the picture's
    fxPush(st.a, { k: 'plus', x: RT.px, y: RT.py, z: 26,
                   txt: full ? 'full' : '+' + Math.round(st.pend),
                   px: full ? 11 : Math.round(14 * fxS(st.pend)),
                   col: full ? '#8a8090' : FAMS.eat.glow,
                   t: 0, max: 0.62 }, 16);
    if (full)
        for (var i = 0; i < 2; i++)
            part({ x: RT.px, y: RT.py, z: 24, vx: rnd(-.2, .2), vy: rnd(-.2, .2), vz: rnd(-6, 2),
                   life: rnd(0.4, 0.8), size: 2, col: EAT_CHAR, add: 0, grav: 150, sh: 1 });
}
function drawEatWorld(cx, dt, st) {
    var i, o, k, sx, sy;
    /* You should be able to look at the player and tell they just ate.
       A warm blit over the actor, and the lantern arc and the contact
       ellipse are widened in drawActor off the same number. */
    if (st.fed > 0.05) {
        cx.save();
        cx.globalCompositeOperation = 'lighter';
        cx.globalAlpha = clamp(st.fed * 0.05, 0, 0.4);
        cx.fillStyle = FAMS.eat.glow;
        sx = isoX(RT.px, RT.py); sy = isoYA(RT.px, RT.py);
        cx.beginPath(); cx.ellipse(sx, sy - 22, 11, 20, 0, 0, TAU); cx.fill();
        cx.restore();
    }
    for (i = 0; i < st.a.length; i++) {
        o = st.a[i];
        if (o.t < (o.d || 0)) continue;
        k = clamp((o.t - (o.d || 0)) / o.max, 0, 1);
        if (o.k === 'ring') drawEatRing(cx, o, k);
        else if (o.k === 'word') drawEatWord(cx, o, k);
        else if (o.k === 'husk') drawEatHusk(cx, o, k);
        else if (o.k === 'plus') drawEatPlus(cx, o, k);
    }
    for (i = 0; i < st.motes.length; i++) {
        o = st.motes[i];
        if (o.t < 0) continue;
        drawEatMote(cx, o, clamp(o.t / o.max, 0, 1));
    }
}
/* A husk holds for two frames, then falls and fades. It is one
   fillRect per notch per frame for six tenths of a second, and it is
   the only thing in the game that survives the body. */
function drawEatHusk(cx, o, k) {
    var fall = k < 0.06 ? 0 : k * k * 40;
    var sx = Math.round(isoX(o.x, o.y)) + o.ox;
    var sy = Math.round(isoYA(o.x, o.y)) + o.oy + fall;
    cx.globalAlpha = 1 - k * k;
    cx.fillStyle = EAT_BITE; cx.fillRect(sx, sy, o.w, o.h);
    cx.fillStyle = partCol(EAT_CHAR, 0.6 * (1 - k));
    cx.fillRect(sx, sy, 1, o.h);
    cx.globalAlpha = 1;
}
function drawEatPlus(cx, o, k) {
    var sx = Math.round(punchWX(isoX(o.x, o.y)));
    var sy = Math.round(punchWY(isoYA(o.x, o.y) - o.z - k * 22));
    cx.save(); cx.textAlign = 'center';
    cx.globalAlpha = clamp((1 - k) * 2.2, 0, 1);
    cx.font = 'bold ' + o.px + 'px "Press Start 2P", monospace';
    cx.fillStyle = '#08060c'; cx.fillText(o.txt, sx + 2, sy + 2);
    cx.fillStyle = o.col; cx.fillText(o.txt, sx, sy);
    cx.restore(); cx.textAlign = 'left';
}
/* -eat keeps snapDefault. Two brackets closing on the row the sounds
   were sitting in is already the right gesture for a family whose
   verb is take, and a second bespoke snap on top of a bite, a ring, a
   word and forty crumbs is noise. */
regFam('eat', {
    call: EAT_CALL, pip: eatPip, sour: eatSour, det: eatDet, st: eatBody, fin: eatFin,
    ord: 42, cap: 96, step: stepEat, draw: drawEatWorld,
    make: function () { return { a: [], motes: [], wordAt: -1, fed: 0, pend: 0, flush: 0 }; }
});

/* ─────────────── -ight, reveal ───────────────
   "There was a woman, and we would not stand the sight."
   Three rules. HARD EDGES: no radial gradient, no soft falloff, no
   baked glow; where something fades it fades in flat bands the way
   dither does, so this is the cheapest of the five to draw and the
   only one that allocates nothing. HARD SHADOWS: the matter of this
   family is not the light, it is the shadow the light throws, which
   is the only family layer in the game that adds something BLACK.
   NEVER WHITE: #fffbe8 may appear as a one pixel line and never as a
   fill, and never for longer than 0.42s.
   #c9a83c is deleted. crit-art-ight #8: the game's brass is #c9a94a,
   pxPal's `m`, in every sprite in the file, and inventing a value one
   step off it is exactly the failure the closed-palette rule guards.
   The shards take rgbMul('#c9a94a', 0.62) with a 1px #ffe66e lit
   edge: brass in shadow, which is literally the sprite palette's own
   m/M pair. */
var IGHT_HOT, IGHT_LIT, IGHT_BRASS, IGHT_BAND;
function ightBoot() {
    IGHT_HOT = hex2rgb(FAMS.ight.col);                // 255,230,110
    IGHT_LIT = hex2rgb(FAMS.ight.glow);               // 255,246,194
    IGHT_BRASS = rgbMul('#c9a94a', 0.62);             // 125,105,46: brass in shadow
    /* three alphas, no interpolation. On a nearest-neighbour canvas a
       banded taper reads as AUTHORED and a smooth one reads as broken. */
    IGHT_BAND = [partCol(IGHT_HOT, 0.55), partCol(IGHT_HOT, 0.30), partCol(IGHT_HOT, 0.14)];
}
var IGHT_CALL = {
    fly: { rate: 30, acc: 0, accL: 1, wob: 0, step: 0, grav: 0 },

    /* Dust, not sparks. Size 1, no gravity, hanging where the beam
       passed. Dust in a beam is the single most recognisable image of
       light as a physical thing and it costs one particle per 45ms.
       Placed BEHIND the head along the velocity vector, so the beam
       has a length rather than a source. */
    trail: function (c, dt) {
        var b = rnd(0.02, 0.34);
        part({ x: c.x - Math.cos(c.a) * b + rnd(-.05, .05), y: c.y - Math.sin(c.a) * b + rnd(-.05, .05),
               z: 26 + rnd(-3, 3), vx: 0, vy: 0, vz: rnd(-2, 8), life: rnd(0.22, 0.44),
               size: 1, col: IGHT_HOT, add: 1, grav: 0 });
    },

    /* THE ONLY PROJECTILE IN THE GAME THAT THROWS A SHADOW, and the
       pool of light it used to sit in is deleted.
       crit-art-ight #5: lightsOf puts 255,196,110 in every window,
       255,206,120 on every lamp and 255,190,90 on the footlights, and
       drawLights gives the PLAYER a 255,214,150 pool at r 3.4 every
       frame. Warm yellow on the ground is the town's ambient
       vocabulary, so an additive radius-11 pool at 13% is dimmer than
       the light it is flying through and literally invisible under a
       house window. -ight cannot win on more yellow. The hard little
       shadow offset six pixels away survives on its own and is the
       best tell in the section. */
    mark: function (cx, c, sx, sy, P) {
        var s = playerSide(sx);
        cx.fillStyle = 'rgba(8,6,12,.45)';
        cx.beginPath(); cx.arc(-s * 6, 0, 7, 0, TAU); cx.fill();
    },

    /* A chevron, and three flat bands behind it. Down the centre of
       all three, one 1px filament, and it is the only continuous
       thing in the effect. */
    head: function (cx, c, sx, sy, P) {
        var sa = isoAng(c.a), i;
        cx.save(); cx.translate(Math.round(sx), Math.round(sy)); cx.rotate(sa);
        cx.globalCompositeOperation = 'lighter';
        for (i = 0; i < 3; i++) {
            cx.fillStyle = IGHT_BAND[i];
            cx.fillRect(-13 - i * 9, -1.5, 9, 3);
        }
        cx.fillStyle = 'rgba(255,251,232,.75)'; cx.fillRect(-30, 0, 26, 1);
        cx.restore();
        cx.globalCompositeOperation = 'lighter';
        cx.globalAlpha = 0.26 + (c.couplet ? 0.14 : 0); cx.fillStyle = P.col;
        cx.beginPath(); cx.arc(sx, sy - 4, 9 + c.near * 2, 0, TAU); cx.fill();
        cx.globalAlpha = 1; cx.strokeStyle = P.glow; cx.lineWidth = 1.5;
        cx.beginPath();
        cx.moveTo(sx + Math.cos(sa - 0.55) * 7, sy + Math.sin(sa - 0.55) * 7);
        cx.lineTo(sx + Math.cos(sa) * 9, sy + Math.sin(sa) * 9);
        cx.lineTo(sx + Math.cos(sa + 0.55) * 7, sy + Math.sin(sa + 0.55) * 7);
        cx.stroke();
    },

    /* The word, with a longer harder drop shadow than the shared one:
       +3,+3 in #08060c rather than +1.5,+1.5. Same reason the ground
       ellipse has one. Three afterimages off the history buffer, which
       is the one family whose trail is the word again. */
    word: function (cx, c, sx, sy, P) {
        var off = [2, 4, 6], al = [0.30, 0.18, 0.09], sz = [11, 10, 9], j, ii, gx, gy;
        cx.textAlign = 'center';
        if (c.tr) for (j = 0; j < 3; j++) {
            ii = (c.ti - off[j] + 24) % 12; gx = c.tr[ii]; gy = c.tr[ii + 1];
            if (gx == null) continue;
            cx.globalAlpha = al[j];
            cx.font = 'bold ' + sz[j] + 'px "Press Start 2P", monospace';
            cx.fillStyle = P.col;
            cx.fillText(c.word, isoX(gx, gy), isoYA(gx, gy) - 26);
        }
        cx.globalAlpha = 1;
        cx.font = 'bold ' + (12 + c.near * 1.6).toFixed(1) + 'px "Press Start 2P", monospace';
        cx.fillStyle = '#08060c'; cx.fillText(c.word, sx + 3, sy + 3);
        cx.fillStyle = P.col; cx.fillText(c.word, sx, sy);
    },

    /* The lamp swept past and found nobody. Four motes and one 0.18s
       flat ellipse at radius 9. */
    fizz: function (c) {
        var st = fxOf('ight');
        spray(c.x, c.y, 24, 4, c.a, 1.4, { col: IGHT_HOT, sp0: 0.1, sp1: 0.6, vz0: -4, vz1: 10,
                                            l0: 0.2, l1: 0.5, grav: 0, fr: 3 });
        fxPush(st.a, { k: 'miss', x: c.x, y: c.y, t: 0, max: 0.18 }, 32);
    },

    /* THE SHUTTER. Two hard bars separating vertically at the barrel
       point over 90ms, 18 wide, 2 tall, with a single 2px #fffbe8 bar
       spanning the gap between them. A lantern shutter being worked,
       not a muzzle flash: somebody moved a catch. It is the only cast
       tell in the game that is not the actor's arm going up. */
    cast: function (x, y, a) {
        fxPush(fxOf('ight').a, { k: 'shut', x: x, y: y, t: 0, max: 0.09 }, 32);
        /* and the actor's own contact shadow is thrown backwards, hard,
           for 0.03 seconds. crit-art-ight #13: the whole fiction is
           that a lamp is being pointed by somebody who would rather
           not look, and the player's sprite was untouched from the
           first frame to the last. */
        var st = fxOf('ight'); st.kick = 0.03; st.ka = isoAng(a);
    }
};

/* The pip. Three things inside the cell, and the third is the family.
   The slot is two hard 1px #ffe66e rules at the INBOARD rows sy - 9
   and sy + 1, spanning w - 2, with no sides: a shutter seen edge on,
   deliberately open at the ends because the light is going somewhere.
   Inboard because crit-art-ight #12 caught the collision: sy - 11 is
   the plate's own top row and the row rule's sy - 12 is adjacent to
   it, so at four or more -ight stacks the two devices touch and make
   a 2px double stroke, half of it out of the rationed near-white the
   family's own rule says may never exceed 1px.
   Its own shadow is a real hole. crit-eng-ight #6: an rgba(8,6,12,.85)
   rect over an rgba(8,6,12,.72) plate is the same hex over itself,
   forty-eight pixels of nothing every frame on every -ight stack on
   the board. destination-out at 0.5 instead, offset 2px away from the
   player, which cuts the plate AND the tint together. */
function ightPip(cx, s, x, sy, w, fade) {
    var side = playerSide(x), lit = s.rowLit || 0;
    cx.globalCompositeOperation = 'lighter';
    cx.fillStyle = fampx().ight.wash;
    cx.fillRect(x - w / 2 + 1, sy - 10, w - 2, 14);
    cx.globalCompositeOperation = 'destination-out';
    cx.globalAlpha = 0.5;
    cx.fillStyle = '#000';
    cx.fillRect(x - w / 2 + 1 - side * 2, sy - 8, w - 2, 11);
    cx.globalAlpha = fade;
    cx.globalCompositeOperation = 'source-over';
    cx.fillStyle = s.drone ? '#8a8090' : FAMS.ight.glow;
    cx.fillText('I', x, sy);
    /* at four or more in the row the per-pip slot rules are
       SUPPRESSED and one rule runs the length of the plate instead:
       the row stops being lamps and becomes a filament. That
       escalation is a change of kind, not of degree. */
    if (lit < 4) {
        cx.fillStyle = '#ffe66e';
        cx.fillRect(x - w / 2 + 1, sy - 9, w - 2, 1);
        cx.fillRect(x - w / 2 + 1, sy + 1, w - 2, 1);
    }
}
/* THE FILAMENT FLICKER, and it has to modify the SHARED fade.
   crit-eng-ight #5: the design put the flicker inside its own pip
   drawer, where it could only reach two hairlines, while the glyph and
   the cell tint were drawn by drawStacks off a `fade` the pip cannot
   see. The letter sat perfectly steady while two pixels blinked.
   A hard two-value flicker at about 2.7Hz, phase-offset per stack so a
   row does not blink in unison. A lamp about to go out flickers. A
   dissolve fades. This is the only FAM_FADE row besides -erd's. */
function ightFade(s) {
    if (s.t >= 1.2) return 1;
    return Math.sin(RT.t * 17 + (s.born || 0) * 7) < -0.2 ? 0.45 : 1;
}

/* Per closed body. d.i * d.stag rides the outward sort, so the star
   opens from the middle of what closed rather than all at once. */
function ightDet(f, n, d) {
    var st = fxOf('ight'), g = famBag(f, 'ight'), rep = d.kind === 'beat' || d.kind === 'wave';
    var h = foeH(f), i, sh;
    if (d.dead) {                                 // crit-eng-ight #12: no status on a corpse
        ightSpoke(st, f, n, d); return;           // it still gets the light. It just does not get five seconds
    }
    /* the reveal itself. On a repeat beat this REFRESHES and nothing
       else fires: crit-eng-ight #2, three beats 0.34s apart re-ran
       f.revealed = 5 and the cast shadow collapsed to zero length and
       regrew three times, which looks like a bug, on top of 1248
       particle pushes against a 900 cap. */
    g.max = 5; g.n = n; g.age = g.age || 0;
    g.lit = clamp(0.10 + 0.03 * n, 0.10, 0.34);
    /* how many shadows. crit-art-ight #10: bracket alpha 0.30 to 0.60
       is eight fillRects a frame doing nothing, because nobody can see
       a 0.05 alpha step, and pin travel 78 to 134px is not readable at
       the speed the bars move. The power goes somewhere COUNTABLE
       instead, and the best channel this family has is how many lights
       are on you. One at n 1-2, two at 3-4, three at 5+, each a few
       degrees off the last. You can count them without thinking. */
    g.sh = n >= 5 ? 3 : n >= 3 ? 2 : 1;
    ightAim(f, g);                                // which way they point
    if (rep) return;
    ightSpoke(st, f, n, d);
    /* THE PIN. Two bars of FIXED length arriving and stopping.
       crit-eng-ight #4: the design's barW WAS the remaining distance
       with the inner end nailed to the body, so it was drawSnaps'
       shrinking line rotated ninety degrees, and on a Chorus it went
       from 43px to 1px and then held two single pixels for 0.15s. */
    fxPush(st.a, { k: 'pin', x: f.x, y: f.y, h: h, r: f.r, n: n,
                   from: 70 + 8 * n, t: 0, max: 0.24, d: 0.03 + d.i * d.stag }, 64);
    /* THE MATTER, and which matter depends on whether it had cover.
       crit-art-ight #7: shards are a piece of what was covering it,
       and the design fired 22 of them at a Mouth wearing nothing,
       where opaque falling squares mean nothing and read as exactly
       the generic debris the brief forbids. Shards belong to the peel.
       A bare body throws DUST, and more of it: a thing lit hard in a
       dark room throws dust up. The player learns a real read in three
       fights. */
    if (f.armor > 0) {
        ightPeel(f, g, h);
        sh = Math.round(fxBudget(Math.min(22, 4 + 3 * n), d.wide, 96) * (f.def.folk ? 0.25 : 1));
        for (i = 0; i < sh; i++)
            part({ x: f.x + rnd(-.2, .2), y: f.y + rnd(-.2, .2), z: rnd(0.3 * h, 0.9 * h),
                   vx: rnd(-1.4, 1.4), vy: rnd(-1.4, 1.4), vz: rnd(30, 120),
                   life: rnd(0.5, 0.85), size: rnd(3, 6),
                   col: i % 3 ? IGHT_BRASS : IGHT_HOT, add: 0, grav: 240, sh: 1 });
    } else {
        sh = Math.round(fxBudget(Math.min(14, 4 + 2 * n), d.wide, 64) * (f.def.folk ? 0.25 : 1));
        for (i = 0; i < sh; i++)
            part({ x: f.x + rnd(-.3, .3), y: f.y + rnd(-.3, .3), z: rnd(0.2 * h, 1.1 * h),
                   vx: rnd(-.3, .3), vy: rnd(-.3, .3), vz: rnd(-2, 12),
                   life: rnd(0.5, 1.1), size: 1, col: IGHT_HOT, add: 1, grav: 0 });
    }
    /* two 4px ticks on the ground plane at plus and minus f.r*15, held
       for the reveal and NEVER past it: the mark on the boards where
       the actor hits (crit-art-ight #13). Stored on g, drawn at ord 44. */
    g.tick = 1;
    /* THE PRE-DARKEN. Before anything gets brighter, the whole picture
       gets darker. No other family may do this. */
    st.dark = 0.062; st.darkA = clamp(0.10 + 0.03 * d.best, 0.10, 0.34) * T('ightDark');
    /* SEEN and BARE. crit-art-ight #15: SEEN is what a debug overlay
       says, and it fired identically whether armour came off or not.
       Two words, both four characters so they fit at 13px over a
       Mouth, and one ternary picks between them. */
    typo(f.x, f.y, f.armor > 0 ? 'BARE' : 'SEEN', FAMS.ight.col, 0.5, 13, 'pop');
    fxSfx(f.armor > 0 ? 'bare' : 'seen', 0.09);
}
/* WHICH WAY THE SHADOW POINTS, and it is not away from you.
   crit-art-ight #6: the bible says -ight is "being looked at by
   people who would rather not look". The design staged YOU as the
   lamp, which is the generic reading; the true one is that the TOWN
   is looking and you only opened the shutter. So the shadow points
   away from the nearest entry in lightsOf(place()) and falls back to
   pointing away from the player when there is no light in range.
   A reveal in the lane throws the body's shadow off somebody's lit
   window. In the hollow, which is authored night 2 dark 1 with the
   comment "no lamp out here, that is the whole point of out here", it
   falls away from YOU, because out there you are the only light. That
   is Stanza 9 rendered as a shadow direction for one array lookup.
   Recomputed at 4Hz in the stepper, not per frame. */
function ightAim(f, g) {
    var L = lightsOf(place()), i, dx, dy, dd, bd = 1e9, bx = RT.px, by = RT.py;
    for (i = 0; i < L.length; i++) {
        dx = L[i].x - f.x; dy = L[i].y - f.y; dd = dx * dx + dy * dy;
        if (dd < bd && dd < 64) { bd = dd; bx = L[i].x; by = L[i].y; }
    }
    g.ax = f.x - bx; g.ay = f.y - by;
    dd = Math.sqrt(g.ax * g.ax + g.ay * g.ay) || 1;
    g.ax /= dd; g.ay /= dd;
    g.re = 0.25;
}
/* ONE HARD SPOKE PER CLOSED BODY, all in the same frame, all out of
   the actor. The cone is deleted: crit-art-ight #1, RHYME closes
   every stack of that sound wherever it is on the board, and a single
   cone at the centroid of what closed points at empty floor between
   two flanking foes and contains neither of the things it just
   nailed. One foe gets an interrogation line. Six foes get a star of
   light out of the player that physically touches every single thing
   it closed. */
function ightSpoke(st, f, n, d) {
    fxPush(st.a, { k: 'spoke', x: f.x, y: f.y, h: foeH(f), n: n,
                   t: 0, max: 0.34, d: d.i * d.stag }, 64);
}
/* THE PLATE PEELS. f.armor = 0 happens in famEffect. Today, on a
   Sealed elite, a strokeRect's alpha drops from 0.85 to 0.2; on the
   Deaf, which carries armor0: 3 from birth, nothing at all happens
   and never has. The peel is keyed on f.armor > 0 at the moment the
   detonation lands, not on the elite mark, so the Deaf gets it too.
   drawMod skips its plate branch while f._peel is set, and the 0.2
   ghost outline is deleted outright rather than left stroking the
   identical rect for the rest of the fight (crit-eng-ight #8). */
function ightPeel(f, g, h) {
    f._peel = 1;
    fxPush(fxOf('ight').a, { k: 'peel', x: f.x, y: f.y, h: h, w: f.r * 44,
                             t: 0, max: 0.52 }, 32);
}

/* (a) THE CAST SHADOW, and the fill is not what carries it.
   The quad's two far vertices are quantised to the floor's own 2px
   dither lattice (crit-art-ight #13), so it lights THIS floor rather
   than floating above it as a free polygon.
   Folk get no cast shadow at all: twenty-four seated bodies packed
   close, all throwing 30-70px wedges the same way, merge into one
   continuous black field, which is not twenty-five reveals, it is a
   hole in the floor. */
function ightQuad(cx, f, g, i, out) {
    var a = Math.atan2(g.ay, g.ax) + (i - (g.sh - 1) / 2) * 0.13;   // a few degrees off each other
    var len = (26 + 7 * g.n) * clamp(foeH(f) / 30, 0.8, 2.2) * clamp(g.age / 0.05, 0, 1) * T('ightShadow');
    var ca = Math.cos(a), sa = Math.sin(a), hw0 = f.r * 15, hw1 = f.r * 15 + 10;
    out[0] = -sa * hw0; out[1] = ca * hw0 * 0.5;
    out[2] = ca * len - sa * hw1; out[3] = sa * len * 0.5 + ca * hw1 * 0.5;
    out[4] = ca * len + sa * hw1; out[5] = sa * len * 0.5 - ca * hw1 * 0.5;
    out[6] = sa * hw0; out[7] = -ca * hw0 * 0.5;
    out[2] = evenPx(out[2]); out[3] = evenPx(out[3]);
    out[4] = evenPx(out[4]); out[5] = evenPx(out[5]);
    out[8] = a; out[9] = len;
    return out;
}
var IGHT_Q = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
/* THE INK QUAD, drawn UNDER the body in drawFoe, because a house must
   occlude a shadow and the body must stand on it. Everything else
   this family draws is 1px and goes at ord 44 OVER the wash, because
   drawLights lays rgba(6,5,14,.5) and .66 in the hollow and
   drawVignette reaches .8 at the corners, and every place in this
   game is a night place. The family that named legibility as its
   brief had its five-second layer in the darkest part of the frame.
   THE CUT LINE GOES INSIDE THE QUAD. This is crit-art-ight #3, and it
   is the finding that turns this family from a yellow elemental into
   NINTH NIGHT: the cast shadow is a quad of ink with nothing in it,
   and BALLAD[8].r is right there. The light falls on a thing and the
   true half line is written on the floor behind it. */
function ightCast(cx, f, sx, sy) {
    var g = f._fx && f._fx.ight, i, q, a, txt;
    if (!g || !(g.sh > 0) || f.def.folk || T('ightShadow') <= 0) return;
    /* BALLAD[4].r[3] is "There was a woman, and we would not stand the
       sight.", the true half line of the -ight stanza and the family's
       own epigraph. The blueprint indexes it as BALLAD[8]; the array
       has seven stanzas and Stanza 5 is index 4, which is what FAMS
       already says. Folk and the Chorus get the four-word tag instead,
       because the quad is shorter. */
    txt = (f.def.boss || f.def.folk) ? 'we would not stand' : (BALLAD[4] && BALLAD[4].r ? BALLAD[4].r[3] : 'we would not stand');
    cx.save(); cx.translate(Math.round(sx), Math.round(sy));
    for (i = 0; i < g.sh; i++) {
        q = ightQuad(cx, f, g, i, IGHT_Q);
        if (q[9] < 6) continue;
        cx.save();
        cx.beginPath();
        cx.moveTo(q[0], q[1]); cx.lineTo(q[2], q[3]); cx.lineTo(q[4], q[5]); cx.lineTo(q[6], q[7]);
        cx.closePath();
        cx.fillStyle = 'rgba(8,6,12,.62)'; cx.fill();
        if (i === 0) {                       // the line is written in the first shadow only
            cx.clip();
            a = q[8];
            cx.rotate(a); cx.scale(1, 0.5);
            cx.font = '18px VT323, monospace'; cx.textAlign = 'left';
            cx.fillStyle = 'rgba(255,230,110,.16)';
            cx.fillText(txt, f.r * 16, 6);
            cx.textAlign = 'left';
        }
        cx.restore();
    }
    cx.restore();
}
/* (b) THE KEYLIGHT, and it is a RIM.
   crit-art-ight #4: the design lit whichever body half faces the
   player with a flat rgba(255,246,194,.13) fill, so half the time it
   was lighting the half the sprite has BAKED as shade, and a
   half-rect fill argues with the row strings while a rim does not.
   One pixel down the player-facing silhouette edge, taken off
   foeSil's per-row lo/hi, and the far half darkened.
   crit-eng-ight #20: the Chorus has no rows and drawChorus spans plus
   and minus 46 while f.r*22 is 35, so the boss falls back to the box
   at its real half-width of 92. */
function ightBody(cx, f, h, sx, sy) {
    var g = famBag(f, 'ight'), d = foeSil(f.def.draw), s = playerSide(sx), r, c, a, w;
    a = (g.lit || 0.10) * (0.82 + Math.sin(f.anim * 2.2) * 0.18) * T('vfxRimBody');
    cx.globalCompositeOperation = 'lighter';
    cx.fillStyle = partCol(IGHT_HOT, a);
    if (d) {
        for (r = 0; r < d.rows.length; r++) {
            c = s > 0 ? d.lo[r] : d.hi[r];
            if (c < 0) continue;
            cx.fillRect(silX(d, c), silY(d, r), PXS, PXS);
        }
    } else {
        w = f.def.boss ? 92 : f.r * 44;
        cx.fillRect(s > 0 ? -w / 2 : w / 2 - 2, -h, 2, h);
    }
    cx.globalCompositeOperation = 'source-over';
    cx.fillStyle = 'rgba(8,6,12,.22)';
    cx.fillRect(s > 0 ? 0 : -(f.def.boss ? 92 : f.r * 44) / 2, -h, (f.def.boss ? 92 : f.r * 44) / 2, h);
}
/* (c) THE BRACKETS, four corner marks at 1px with 5px arms, at ord 44
   over the wash. In the last 0.8 seconds they close inward by 4px,
   drop 3px, dim, and hard-flicker, so you can watch the +25% window
   expiring, which is a tactical read the game has never offered.
   Suppressed for folk. */
function drawIghtMarks(cx, f, g) {
    var sx = Math.round(isoX(f.x, f.y)), sy = Math.round(isoYA(f.x, f.y));
    var h = foeH(f), w = Math.round((f.def.boss ? 100 : f.r * 26)), i, cxx, cyy, dx, dy;
    var end = clamp(f.revealed / 0.8, 0, 1), inw = (1 - end) * 4, drop = (1 - end) * 3;
    if (f.def.folk) return;
    if (end < 1 && Math.sin(RT.t * 30) < -0.2) return;      // the hard flicker of a window closing
    cx.fillStyle = partCol(IGHT_LIT, (0.30 + 0.30 * end) * T('vfxRimGround'));
    for (i = 0; i < 4; i++) {
        dx = (i & 1) ? 1 : -1; dy = (i & 2) ? 1 : -1;
        cxx = sx + dx * (w - inw); cyy = sy - h * (dy < 0 ? 1 : 0) + drop + (dy > 0 ? 2 : -2);
        cx.fillRect(cxx - (dx > 0 ? 5 : 0), cyy, 5, 1);
        cx.fillRect(cxx - (dx > 0 ? 1 : 0), cyy - (dy > 0 ? 5 : 0), 1, 5);
    }
    /* the two ground ticks, and ONLY inside the reveal window: held
       past it they are a third persistent floor mark competing with
       -ark's stain and -erd's ground rule. */
    if (g.tick) {
        cx.fillStyle = partCol(IGHT_HOT, 0.42 * T('vfxRimGround'));
        cx.fillRect(sx - f.r * 15 - 2, sy - 1, 4, 1);
        cx.fillRect(sx + f.r * 15 - 2, sy - 1, 4, 1);
    }
}
/* THE SNAP. regSnap('ight', ightDrop). The vertical bar falling
   through the body IS this family's snap and it REPLACES snapDefault
   rather than sitting next to it: crit-eng-ight #3 found that nothing
   in the design's hooks removed the shared one, so -ight was shipping
   the new vertical bar, the old horizontal line at the hard-coded
   wrong height, and twenty particles per body. Vertical because every
   other family's snap is horizontal, and it carries foeH from the
   snap record, so on the Chorus it is not 104 pixels wrong. */
function ightDrop(cx, s, k, sx, sy) {
    var h = s.h || 30, y0 = sy - h - 18, len = h + 18;
    cx.globalAlpha = 1 - k;
    cx.fillStyle = FAMS.ight.glow;
    cx.fillRect(Math.round(sx) - 1, Math.round(y0 + len * k), 2, Math.round(len * (1 - k)));
    cx.globalAlpha = 1;
}
/* Before anything gets brighter, the whole picture gets darker.
   Physiologically the next frame reads as roughly twice as bright for
   free; dramatically it is the room being turned down so that one
   light can be pointed, which is the entire fiction in two frames. No
   other family may do this.
   crit-art-ight #14: it needs a floor, not a fixed alpha. RT.dilate
   already lays rgba(6,4,10,.55) during a recital, the hollow's night
   wash is .66 and the corner vignette is .8, so a stanza -ight press
   in the hollow near a corner was a near-black screen for nine frames
   and the "twice as bright" argument stops working the moment there
   was nothing left to take away. Darken TOWARD a level. */
function drawIghtDark(cx, dt, st) {
    if (RT.mapOpen || st.dark <= 0) return;
    var room = (place().night >= 2 ? 0.66 : 0.5) + (RT.dilate > 0 ? 0.3 : 0);
    var a = clamp(st.darkA * (st.dark / 0.062) * clamp(1 - room, 0, 1) * 1.9, 0, 0.34);
    if (a <= 0.004) return;
    cx.save(); cx.fillStyle = partCol('6,5,12', a); fullRect(cx); cx.restore();
}
/* Everything on the real clock. This is the one family whose whole
   detonation is over in 0.34 seconds and whose status is five
   seconds, and neither of them is matter. */
function stepIght(dt, real, st) {
    var i, o, F = RT.foes, f, g;
    for (i = st.a.length - 1; i >= 0; i--) {
        o = st.a[i]; o.t += real;
        // f._peel is never cleared: the plate is gone, so drawMod's
        // branch stays off for the rest of the body's life.
        if (o.t >= (o.d || 0) + o.max) st.a.splice(i, 1);
    }
    if (st.dark > 0) st.dark = Math.max(0, st.dark - real);
    if (st.kick > 0) st.kick = Math.max(0, st.kick - real);
    for (i = 0; i < F.length; i++) {
        f = F[i]; if (!f || f.dead) continue;
        g = f._fx && f._fx.ight; if (!g) continue;
        if (f.revealed > 0) {
            g.age = (g.age || 0) + real;
            /* the ambient contact ellipse is SUPPRESSED for the length
               of the reveal, faded out over the first 80ms as the quad
               grows in. A body with two shadows pointing different
               ways is the sticker failure the prop comment warns
               about, and the reveal is allowed to break the town's key
               only if it is seen to REPLACE the ambient. */
            f.csa = 0.42 * clamp(1 - g.age / 0.08, 0, 1);
            g.re -= real;
            if (g.re <= 0) ightAim(f, g);          // 4Hz. A shadow that re-aims 60 times a second swims.
        } else if (g.sh) {
            g.sh = 0; g.tick = 0; g.age = 0; f.csa = null;
        }
    }
}
function drawIghtWorld(cx, dt, st) {
    var i, o, k, F = RT.foes, f, g;
    for (i = 0; i < st.a.length; i++) {
        o = st.a[i];
        if (o.t < (o.d || 0)) continue;
        k = clamp((o.t - (o.d || 0)) / o.max, 0, 1);
        if (o.k === 'spoke') drawIghtSpoke(cx, o, k);
        else if (o.k === 'pin') drawIghtPin(cx, o, k);
        else if (o.k === 'peel') drawIghtPeel(cx, o, k);
        else if (o.k === 'shut') drawIghtShutter(cx, o, k);
        else if (o.k === 'miss') drawIghtMiss(cx, o, k);
    }
    for (i = 0; i < F.length; i++) {
        f = F[i]; if (!f || f.dead || !(f.revealed > 0)) continue;
        g = f._fx && f._fx.ight; if (!g || !g.sh) continue;
        drawIghtMarks(cx, f, g);
    }
    if (st.kick > 0) {                            // the actor's shadow, thrown backwards, hard
        var ax = isoX(RT.px, RT.py), ay = isoYA(RT.px, RT.py);
        cx.fillStyle = 'rgba(8,6,12,.55)';
        cx.beginPath();
        cx.ellipse(ax - Math.cos(st.ka) * 7, ay - Math.sin(st.ka) * 3.5, 20, 4, 0, 0, TAU);
        cx.fill();
    }
}
function drawIghtSpoke(cx, o, k) {
    var px = isoX(RT.px, RT.py), py = isoYA(RT.px, RT.py) - 22;
    var tx = isoX(o.x, o.y), ty = isoYA(o.x, o.y) - o.h * 0.55;
    var a = clamp((1 - k) * 1.8, 0, 1) * T('ightSpoke'), u = clamp(k * 3.2, 0, 1);
    var ex = lerp(px, tx, u), ey = lerp(py, ty, u);
    cx.save(); cx.globalCompositeOperation = 'lighter';
    cx.strokeStyle = partCol(IGHT_HOT, a * 0.55); cx.lineWidth = 3;
    cx.beginPath(); cx.moveTo(px, py); cx.lineTo(ex, ey); cx.stroke();
    cx.strokeStyle = partCol(IGHT_LIT, a); cx.lineWidth = 1;
    cx.beginPath(); cx.moveTo(px, py); cx.lineTo(ex, ey); cx.stroke();
    cx.restore();
}
function drawIghtPin(cx, o, k) {
    var sx = Math.round(isoX(o.x, o.y)), sy = Math.round(isoYA(o.x, o.y) - o.h * 0.6);
    var travel = o.from * (1 - k) * (1 - k), bl = 18 + o.n * 2;
    cx.fillStyle = partCol(IGHT_LIT, clamp((1 - k) * 2, 0, 1));
    cx.fillRect(sx - travel - bl, sy - 1, bl, 2);
    cx.fillRect(sx + travel, sy - 1, bl, 2);
}
/* Four edges, four pieces, on drawMod's own plate geometry but drawn
   as four separate 2px bars: the top edge tips over, the two sides
   slide outward, the bottom drops straight. The drop is CLAMPED:
   crit-eng-ight #14, the unclamped version put a 30% alpha bar 103px
   below a 32px foe's feet, inside the body transform, occluded by
   nothing. The first 8% draws the whole plate in #fffbe8 rather than
   #ffe66e. That is the rationed near-white and it is 34ms. */
function drawIghtPeel(cx, o, k) {
    var sx = Math.round(isoX(o.x, o.y)), sy = Math.round(isoYA(o.x, o.y));
    var w = o.w, h = o.h, u = k, drop = Math.min(u * u * 210, h), a = clamp((1 - k) * 1.6, 0, 1);
    var col = k < 0.08 ? '#fffbe8' : '#ffe66e';
    cx.save(); cx.translate(sx, sy); cx.globalAlpha = a; cx.fillStyle = col;
    cx.save(); cx.translate(0, -h * 0.75 - drop * 0.3); cx.rotate(u * 0.42);
    cx.fillRect(-w * 0.8, 0, w * 1.6, 2); cx.restore();
    cx.fillRect(-w * 0.8 - u * u * 60, -h * 0.75 + drop * 0.2, 2, h * 0.5);
    cx.fillRect(w * 0.8 + u * u * 60, -h * 0.75 + drop * 0.2, 2, h * 0.5);
    cx.fillRect(-w * 0.8, -h * 0.25 + drop, w * 1.6, 2);
    cx.restore();
}
function drawIghtShutter(cx, o, k) {
    var sx = Math.round(isoX(o.x, o.y)), sy = Math.round(isoYA(o.x, o.y) - 26);
    var g = Math.round(k * 5);
    cx.fillStyle = '#ffe66e';
    cx.fillRect(sx - 9, sy - 1 - g, 18, 2);
    cx.fillRect(sx - 9, sy - 1 + g, 18, 2);
    cx.fillStyle = 'rgba(255,251,232,' + (1 - k).toFixed(2) + ')';
    cx.fillRect(sx - 1, sy - g, 2, g * 2);
}
function drawIghtMiss(cx, o, k) {
    var sx = isoX(o.x, o.y), sy = isoYA(o.x, o.y);
    cx.save(); cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = (1 - k) * 0.5; cx.fillStyle = FAMS.ight.col;
    cx.translate(sx, sy); cx.scale(1, 0.5);
    cx.beginPath(); cx.arc(0, 0, 9, 0, TAU); cx.fill();
    cx.restore();
}
regFam('ight', {
    call: IGHT_CALL, pip: ightPip, fade: ightFade, det: ightDet, st: ightBody, snap: ightDrop,
    ord: 44, cap: 96, step: stepIght, draw: drawIghtWorld,
    make: function () { return { a: [], dark: 0, darkA: 0, kick: 0, ka: 0 }; }
});
/* The pre-darken is ord 30, a SCREEN pass, before the line exists.
   fullRect because a fillRect(0,0,VW,VH) inside the shake leaves up
   to nine pixels of one edge undarkened, and screen because
   crit-eng-ight #11's second half is that a full-screen fill inside
   scale(z, z) stops covering the screen above about z = 1.1.
   One extra regFx line, which is what a second seam costs. */
regFx('ightdark', null, null, {
    screen: function (cx, dt) { drawIghtDark(cx, dt, fxOf('ight')); },
    ord: 30, make: fxNul
});

/* ─────────────── -erd, command ───────────────
   YOU ARE CASTING THE TOWN'S CRIME. The band with two nails is the
   false line nailed over the hole. The block is the lie; the two lit
   lines that eat it are FAMS.erd.glow, which comp.css:2997 already
   uses for a stanza the book has REPAIRED, so the last thing on
   screen before nothing is two pixels of the true colour. -erd is the
   player doing to a Hearsay what the town did to her, and getting a
   good outcome for it.
   Three rules.
     No alpha in this family ever ANIMATES. Things leave by being
       CUT: the geometry is clipped away and the last frame of it is
       at full strength. drawCuts already knew this and its comment
       says why. (The design said "alpha is 1 or it is 0", which
       crit-art-erd #9 disproved in ten seconds by counting seven
       constant alphas. The rule as intended is right; this is it,
       stated so it survives a reviewer.)
     -erd is over before you expect it. The longest single event here
       is 0.333 seconds. An order given and obeyed does not have a
       tail.
     Every coordinate is a whole pixel. A 2px bar at x = 411.63 is a
       3px bar with two grey edges, and three of those at once is a
       smudge rather than an order. */
var ERD_INK, ERD_COL, ERD_LIT;
function erdBoot() {
    ERD_COL = hex2rgb(FAMS.erd.col);            // 159,224,200
    ERD_LIT = hex2rgb(FAMS.erd.glow);           // 214,255,240
    ERD_INK = rgbMul(FAMS.erd.col, 0.10);       // 16,22,20: a black the eye reads as green at 80px wide
}
/* MODS.quick.col is exactly #9fe0c8, so the discipline that keeps
   them apart is SHAPE, not hue: ERD_COL appears only on a hard
   axis-aligned bar, never on an ellipse and never on a streak. The
   Quick mark is three small rects; these are full-height bars and a
   horizontal rule. */
var ERD_UID = 0;
function erdId(f) { return f._eid || (f._eid = ++ERD_UID); }   // foes carry no id of their own

var ERD_CALL = {
    /* the only family with `step`: the word does not travel, it
       arrives at a series of positions. 5.5 quantisations a second,
       doubling as it closes. That, and nothing else, is why it reads
       as an order given rather than a thing thrown. No trail rate at
       all: -erd has no particles anywhere in flight. */
    fly: { rate: 0, acc: 0, accL: 1, wob: 0, step: 5.5, grav: 0 },
    trail: null,

    /* A caesura on the floor: the same two-rule mark drawCuts puts on
       a cut word, closing as the word arrives. */
    mark: function (cx, c, sx, sy, P) {
        var gap = 4 - c.near * 3;
        cx.fillStyle = partCol(ERD_COL, 0.30);
        cx.fillRect(-7, -Math.round(gap), 14, 1);
        cx.fillRect(-7, Math.round(gap), 14, 1);
    },

    head: function (cx, c, sx, sy, P) {
        cx.fillStyle = FAMS.erd.glow;
        cx.fillRect(Math.round(sx) - 1, Math.round(sy) - 3, 2, 6);
    },

    /* Two quotation marks and a rule under it. The word is being
       QUOTED, which is what the town did to her: repeated, and not
       answered. Press Start 2P is square-advance so measureText is
       exact, and RT.calls is three or four entries.
       crit-eng-erd B5: sx and sy arrive raw from drawCalls and every
       rounded local coordinate downstream of an unrounded origin is
       decoration. Rounded here, at the top, once. */
    word: function (cx, c, sx, sy, P) {
        sx = Math.round(sx); sy = Math.round(sy);
        var i, q, tk = c.tk;
        if (tk) for (i = 0; i < 18; i += 3) {   // the dotted leader, six slots, oldest overwritten
            if (!(tk[i + 2] > 0)) continue;
            cx.fillStyle = partCol(ERD_COL, 0.55);
            cx.fillRect(Math.round(isoX(tk[i], tk[i + 1])) - 1,
                        Math.round(isoYA(tk[i], tk[i + 1]) - 30), 2, 6);
        }
        cx.textAlign = 'center';
        cx.font = 'bold 12px "Press Start 2P", monospace';
        q = Math.round(cx.measureText(c.word).width / 2) + 6;
        cx.fillStyle = FAMS.erd.glow; cx.globalAlpha = 0.8;
        cx.fillRect(sx - q - 2, sy - 9, 2, 5); cx.fillRect(sx - q + 2, sy - 9, 2, 5);
        cx.fillRect(sx + q - 2, sy - 9, 2, 5); cx.fillRect(sx + q + 2, sy - 9, 2, 5);
        cx.globalAlpha = 1;
        cx.fillStyle = partCol(ERD_COL, 0.55); cx.fillRect(sx - q, sy + 4, q * 2, 1);
        cx.fillStyle = '#08060c'; cx.fillText(c.word, sx + 1, sy + 1);
        cx.fillStyle = FAMS.erd.col; cx.fillText(c.word, sx, sy);
    },

    /* The despawn. crit-eng-erd N8: this was three lines of prose with
       no flag and no code. The flag is on the tick record and it is
       one field: the last three ticks blink out TOGETHER instead of in
       sequence, so a missed order stops rather than trails off. */
    fizz: function (c) { var i; if (c.tk) for (i = 0; i < 18; i += 3) if (c.tk[i + 2] > 0) c.tk[i + 2] = 0.06; },

    /* The launch: two 3x7 chips flying apart perpendicular to the aim
       and cut at 0.05s. One bar splitting to let the word through. It
       is not a muzzle flash and it must never look like one. */
    cast: function (x, y, a) {
        fxPush(fxOf('erd').a, { k: 'open', x: x, y: y, a: isoAng(a), t: 0, max: 0.05 }, 16);
    }
};

/* -erd's pip has no glyph at all, and the reason is not that the
   sound that shuts things up is laconic. crit-art-erd #7: singReduced
   walks 5 4 3 2 and leaves the last slot empty, which is the hole in
   the song, in the song, and fillBook renders every false line with
   an <s>?</s> in it. An empty slot in a row of slots is this game's
   established mark for the line that was cut out, and -erd's own
   truth-word is `word`, the word the town took out. */
function erdPip(cx, s, x, sy, w, fade) {
    /* crit-eng-erd B1, and it is a real freeze: the Droner's producer
       pushes a stack with no `born`, so `s.born || RT.t` was the
       CURRENT frame's clock on every frame, the subtraction was
       exactly zero forever, and Math.max(1, round(ww * 0)) rendered
       one Droner stack in four as two single pixels in the middle of
       a 13px cell for its entire four-second life. Test for absence.
       A stack that was not yours did not slam in: it was already
       there. */
    var b = s.born, ent = (b == null) ? 1 : clamp((RT.t - b) / 0.09, 0, 1);
    var ww = w - 4, iw = Math.round(ww * ent), xx = Math.round(x - iw / 2);
    /* the knock. Below 0.2s the whole pip blinks at 6Hz. A hard blink,
       not a pulse, and it is the family's register. */
    if (s.t < 0.2 && (Math.floor(RT.t * 12) & 1)) return;
    /* the interior is COVERED, not empty. crit-art-erd #7: an empty
       bracket pair beside four lettered tags reads as NO STACK. Ink
       between the bars is the redaction at pip scale, which ties the
       pip to the detonation. */
    cx.fillStyle = partCol(ERD_INK, 0.92);
    cx.fillRect(xx, sy - 8, iw, 10);
    /* the clock: over the last second the TOP bar walks down onto the
       bottom bar, linearly, and when they touch the stack is sour. The
       cell closes like a mouth. s.t against absolute seconds, never
       s.t / s.max: the drag multiplies s.t and never updates s.max, so
       any freshness ratio off s.max is wrong after a drag. */
    var top = Math.round(sy - 10 + (1 - clamp(s.t, 0, 1)) * 12);
    cx.fillStyle = s.drone ? '#8a8090' : FAMS.erd.glow;
    cx.fillRect(xx, top, iw, 2);
    cx.fillRect(xx, sy + 2, iw, 2);
    /* the drag misregistration: a stack a slant pulled over offsets
       its two bars one pixel against each other for the rest of its
       life. A word pushed out of place. */
    if (s.drag) cx.fillRect(xx + 1, sy + 2, iw, 2);
}
/* The second FAM_FADE row, and the last. -erd never fades, so its
   contribution is to make the SHARED fade stop fading: drawStacks'
   clamp(s.t/1.2, 0.3, 1) is a dissolve and this family does not
   dissolve. It returns the reciprocal, so the cell is at full
   strength until the knock takes it away in one step. */
function erdFade(s) { return 1 / clamp(s.t / 1.2, 0.3, 1); }
/* THE SOUR. crit-art-erd #16: the pip's best idea is the top bar
   walking down onto the bottom bar, and then they touch, breakStack
   takes HP off you, and the design drew nothing for it. The clock had
   no chime. The two bars merge into one solid bar the width of the
   cell, hold for 0.10s, then get cut from the top and the bottom
   exactly like the detonation's beat 4. The success and the failure
   are the same picture at two scales. */
function erdSour(f, s, i) {
    fxPush(fxOf('erd').a, { k: 'shut', x: f.x, y: f.y, z: foeH(f) + 18 + (f.so || 0),
                            ox: (i - (f.stacks.length - 1) / 2) * 13,
                            t: 0, max: 0.18 }, 32);
    return ERD_COL;
}

/* THE CLAP. Four beats. nn is this body's own count. Everything with
   a TIME in it comes off the detonation, everything with a WEIGHT in
   it comes off the body: CT and D are derived once per rhyme from
   `best`, not per foe from `n`, so every bar on the board closes on
   the same frame. crit-art-erd #14: at n=8 the bars start 152px out,
   two per foe, and because CT was per foe every pair arrived at a
   different time. That is a picket fence. Unison is the Chorus's
   entire idea and it is what turns eight karate chops into one order
   given to a room. */
function erdDet(f, n, d) {
    var st = fxOf('erd'), g = famBag(f, 'erd'), nn = clamp(n, 1, 12);
    var h = foeH(f), w = f.def.boss ? 92 : Math.round(f.r * 24);
    var CT = T('erdClap') + 0.048 * d.pb, D = T('erdReach') + 168 * d.pb;   // ONE close, ONE reach, whole board
    var rec;
    /* crit-eng-erd B4: Stanza I is -erd, stepRecital calls stanzaWave
       once per line for four lines and stepReprise three more times,
       and neither path knows about the other, so this fired four times
       per foe inside 1.5 dilated seconds and the one-image moment
       became a stutter. Replace per foe, never append. */
    for (rec = 0; rec < st.a.length; rec++)
        if (st.a[rec].k === 'clap' && st.a[rec].id === erdId(f)) { st.a.splice(rec, 1); break; }
    fxPush(st.a, { k: 'clap', id: erdId(f), x: f.x, y: f.y, h: h, w: w, nn: nn,
                   /* crit-eng-erd N1: doRhyme calls hurtFoe before
                      famEffect and the ents pass filters corpses out,
                      so beats 1-3 of the family's payoff shot played
                      over bare floor, and did it wrongest on the
                      biggest hits. A dead body skips beat 2, which is
                      the beat that needs a silhouette under it, and
                      shortens to the cut. */
                   dead: d.dead,
                   CT: CT, D: D,
                   BW: clamp(2 + Math.floor(nn / 3), 2, 5),
                   RA: clamp(0.55 + 0.05 * nn, 0.55, 0.95),
                   RH: 0.016 + 0.004 * nn,
                   VT: 0.08 + 0.004 * nn,
                   t: 0, fired: 0, max: CT + 0.016 + 0.004 * nn + 0.05 + 0.08 + 0.004 * nn }, 32);
    /* the chips, fired at beat 2 by the stepper and not here, because
       the whole conceit is that nothing has happened yet. Budgeted,
       not capped: crit-eng-erd N5, `if (c.length >= MAX) return` is
       part()'s silent tail drop re-implemented, and twenty-five foes
       asking four each against a 260 cap gives the first sixteen
       everything and the last nine nothing. */
    g.chips = fxBudget(Math.min(4 + T('erdChips') * nn, 22), d.wide, 96);
    g.gag = 1; g.n = nn;                          // the band height reads it
    /* the ground rule at YOUR feet, once per rhyme, and it measures
       something: one 1px tick at the screen-x of every foe that
       closed. A rule with terminals is a measured span; a rule without
       them is a laser and this game does not have lasers in it. */
    /* erdDragRule was written for exactly this and then never called,
       so a slant that closed nothing drew the same authority rule as
       an order obeyed, which is the thing crit-art-erd 22 asked for
       and the thing that did not land. Terminals only, no body: the
       span was measured and it is empty. */
    if (d.i === 0) {
        if (d.kind === 'drag' || d.kind === 'slant') erdDragRule(d.best);
        else fxPush(st.a, { k: 'rule', hw: clamp(2.4 + T('erdRule') * d.best, 2.4, 9),
                            ticks: [], drag: 0, t: 0, max: 0.23 }, 8);
    }
    erdRuleTick(st, f);
}
/* one tick per body the order reached, pushed onto whichever rule
   record is live. The line at your feet becomes a line of verse with
   a beat per body it reached. */
function erdRuleTick(st, f) {
    var i, o;
    for (i = st.a.length - 1; i >= 0; i--) {
        o = st.a[i];
        if (o.k === 'rule') { o.ticks.push(isoX(f.x, f.y) - isoX(RT.px, RT.py)); return; }
    }
}
/* THE DRAG gets a different mark. crit-art-erd #22: a slant that
   closed nothing was drawing the same authority rule, taking the same
   hitstop and playing the same clap, so a wrong answer looked exactly
   like an order obeyed. TERMINALS ONLY, NO BODY: two 7px vertical
   ticks at the span's ends and nothing between them. The span was
   measured and it is empty. No clap, no chips, no erdclap. */
function erdDragRule(best) {
    fxPush(fxOf('erd').a, { k: 'rule', hw: clamp(2.4 + T('erdRule') * (best || 1), 2.4, 9),
                            ticks: [], drag: 1, t: 0, max: 0.23 }, 8);
}
/* THE MATTER, fired once at beat 2. A chip is a hard 5x2 or 3x2
   rectangle alternating ERD_COL and ERD_LIT one in four. They are
   chips of a letterform broken across the grain, they are not
   squares, and they CANNOT go through part() for that reason: they
   live on fxOf('erd').chips and are the one family whose matter is
   not particles.
   They fly SIDEWAYS ONLY. isoX is (x-y)*29 and isoY is (x+y)*14.5, so
   a velocity of (+s, -s) moves a thing in pure screen horizontal and
   not at all vertically. Two flat sprays running along the line of
   the bar. Nothing about this family is round and a ball of sparks
   would say explosion where the whole design says line. */
function erdBurst(cl) {
    var st = fxOf('erd'), n = cl.chips || 0, i, s, dir;
    for (i = 0; i < n; i++) {
        dir = (i & 1) ? 1 : -1;
        s = rnd(3.0 + 0.25 * cl.nn, 6.5 + 0.7 * cl.nn) * dir;
        fxPush(st.chips, { x: cl.x, y: cl.y, z: rnd(4, cl.h),
                           vx: s, vy: -s,               // pure screen horizontal in this projection
                           lit: (i & 3) === 3 ? 1 : 0, lg: (i & 1) ? 5 : 3,
                           t: 0, max: rnd(0.09, 0.17) }, 260);
    }
    /* the air that did not move: twelve short tangential bars on the
       1:0.5 ground ellipse, out on easeOutExpo over 0.08s, then cut.
       No stroke, no round path, no gradient, twelve fillRects. It is
       the only physical thing a clap makes. */
    fxPush(st.a, { k: 'gust', x: cl.x, y: cl.y, r: 0.7 + cl.nn * 0.09, t: 0, max: 0.08 }, 64);
}
/* THE COUNTER, in three tiers.
   crit-eng-erd B2, and it is a silent theft of somebody else's word.
   The handshake flag is only ever read by cancelSpecial, which is
   only ever called behind `if (f.sp)`. A tier 1 counter has no f.sp,
   so the flag was never consumed and sat on the body for the rest of
   its life, and the next thing to cancel a real special on that foe
   read the stale flag and swallowed the grey `cut off` typo. A Thief
   carries both a steal and a bite tell, so it is reachable in the
   lane on the second encounter.
   crit-eng-erd N2: and none of it runs on a corpse. hurtFoe can
   already have killed this body, in which case erdCommand was
   awarding tier 2 and spending hitstop and shake on interrupting a
   deathLine. */
function erdCommand(f, n, d) {
    var tier = 0, word = null;
    if (!f.dead) {
        if (f.def.boss && f.warn) { tier = 3; word = 'AND HE WENT ALONE'; }
        else if (f.sp === 'steal') { tier = 2; word = 'REACHING'; }
        else if (f.sp === 'drone') { tier = 2; word = 'ON AND ON'; }
        else if (f.state === 'tell') tier = 1;
    }
    if (tier) { erdCounter(f, tier, word); if (tier > 1) f._erdCut = 1; }
    /* crit-eng-erd B4, the second half: only stamp the entry clock when
       the gag is NOT already up, or four recital waves re-slam the band
       in from 14px above, four times. */
    if (!(f.silence > 0)) famBag(f, 'erd').t0 = 0;
    fxSfx('erdgag', 0.09);              // crit-eng-erd N8: named in the design, called by nothing
}
/* Tier 1, a bite tell: the red wind-up ring is THROWN BACK OPEN, as
   twelve short tangential bars and not an arc. crit-art-erd #17: the
   family's own discipline paragraph bans the ellipse and six hundred
   words later the counter throws a stroked circle in the family's
   best moment. crit-eng-erd N4: lineWidth is in user space, so under
   scale(1, 0.5) the top and bottom of that ellipse stroke at half a
   device pixel and antialias to roughly half alpha, which is why
   every existing flat ring in the file uses 2 or more.
   Tier 2 adds the word it was about to say, struck out left to right.
   Tier 3 is the Chorus, and it is worth the branch: stepFoes skips a
   silenced foe's AI entirely, so a silenced Chorus never reaches
   stepChorus, so pulseT stops, so the refrain does not fire, and the
   refrain is the false line. -erd is the only thing in the game that
   can stop the town from singing the lie. */
function erdCounter(f, tier, word) {
    var st = fxOf('erd'), h = foeH(f);
    fxPush(st.a, { k: 'ctr', x: f.x, y: f.y, h: h, r: f.r, tier: tier, w: word,
                   boss: f.def.boss ? 1 : 0, anim: f.anim,
                   t: 0, max: tier > 1 ? 0.19 : 0.16 }, 32);
    if (word) fxPush(st.a, { k: 'strike', x: f.x, y: f.y, z: h + 30, w: word,
                             t: 0, max: 0.13 }, 32);
    if (tier === 3) {
        /* the one place the family's own restraint is lifted */
        punch({ fam: 'erd', power: 12, kind: 'close', x: f.x, y: f.y });
    }
}
/* THE STRIKE, the one gag mark that is ON the silhouette, so it goes
   through FAM_ST and is suppressed while f.frozen > 0 by famStatus.
   1px #08060c rules every 3px from -h*0.95 to -h*0.35, head and
   shoulders only. At one-third coverage it reads as crossed out
   without erasing the sprite, which is precisely what the f.frozen
   flat rect gets wrong. */
function erdBody(cx, f, h, sx, sy) {
    var g = famBag(f, 'erd'), rel = clamp(f.silence / 0.30, 0, 1), y;
    var w = f.def.boss ? 100 : f.r * 50, lo = -h * 0.95, hi = -h * 0.35;
    if (g.blink > 0) return;                       // the one blink, two frames, at 1.0s remaining
    hi = lerp(lo, hi, rel);                        // the crossing-out is un-drawn from the bottom up
    cx.fillStyle = '#08060c';
    for (y = Math.round(lo); y < hi; y += 3) cx.fillRect(-w / 2, y, w, 1);
}
/* THE BAND AND THE BRACKETS, at ord 46, in SCREEN space and not in
   drawFoe. Three findings agree and they are the same finding:
   crit-eng-erd B5 (everything inside drawFoe's transform is
   multiplied by `pop` and translated by a fractional `wob`, so the
   1px nails and the 1px band edge are sub-pixel for the whole 0.45s
   spawn ramp and shimmer after every hit), crit-eng-erd N3 (-ill's
   45% #cfeeff rect washes out the middle 88% of the band), and 3.0.6
   (famStatus gives a frozen body to -ill). They are outside the
   silhouette, so they are drawn at whole pixels and are visible on a
   frozen body, which is correct, because a body can be both. */
function drawErdGag(cx, f, g) {
    var sx = Math.round(isoX(f.x, f.y)), sy = Math.round(isoYA(f.x, f.y));
    var h = foeH(f), n = g.n || 1;
    var w = Math.round(f.def.boss ? 100 : f.r * 50);
    var bh = Math.round(clamp(T('erdGag') + Math.min(3, n / 3), 3, 14));
    var ent = clamp((g.t0 || 0) / 0.06, 0, 1), rel = clamp(f.silence / 0.30, 0, 1);
    var by = Math.round(sy - h * 0.70 - (1 - ent) * 14);
    var bx = Math.round(sx - w / 2), half = Math.round(w / 2), gap, i, bw2;
    var rects = 0, budget = 180;
    if (g.blink > 0) return;
    /* Crowd guard, and it counts RECTS rather than bodies
       (crit-eng-erd N10): the strike loop is 0.6 * h / 3 and the
       Chorus's h is 130, so a boss plus nine mouths is 174 rects and
       read as "not full" under a body count. */
    rects = g.rects || 0;
    /* (a) THE BAND. Solid ERD_INK, a 1px ERD_COL line on its top edge,
       a +1,+1 shadow, and TWO NAILS: single 1px ERD_LIT columns inset
       2px from each end, running its height. The false line nailed
       over the hole is the fiction of the whole game and here you can
       see where it was nailed.
       Release splits it at the centre and the two halves retract
       outward: the mouth is the first thing that comes free. */
    gap = Math.round((1 - rel) * half);
    cx.fillStyle = '#08060c';
    cx.fillRect(bx + 1, by + 1, half - gap, bh); cx.fillRect(sx + gap + 1, by + 1, half - gap, bh);
    cx.fillStyle = partCol(ERD_INK, 0.98);
    cx.fillRect(bx, by, half - gap, bh); cx.fillRect(sx + gap, by, half - gap, bh);
    cx.fillStyle = partCol(ERD_COL, 0.9);
    cx.fillRect(bx, by, half - gap, 1); cx.fillRect(sx + gap, by, half - gap, 1);
    cx.fillStyle = partCol(ERD_LIT, 1);
    cx.fillRect(bx + 2, by, 1, bh); cx.fillRect(sx + half - 3, by, 1, bh);
    if (rects > budget) return;                    // past the budget the gag drops to the band alone
    /* (b) THE BRACKETS. Two 2px vertical rules, each with a 5px foot
       turning inward top and bottom. The body is in brackets: quoted,
       not speaking. Release shortens them from both ends toward their
       own midpoints. */
    bw2 = Math.round(f.def.boss ? 103 : f.r * 25 + 3);
    cx.fillStyle = partCol(ERD_COL, 0.92);
    for (i = -1; i <= 1; i += 2) {
        var bxx = sx + i * bw2, top = Math.round(sy - h + (1 - rel) * h * 0.5);
        var len = Math.round(h * rel);
        if (len < 2) continue;
        cx.fillRect(bxx - 1, top, 2, len);
        cx.fillRect(bxx - 1 - (i > 0 ? 5 : 0), top, 5, 1);
        cx.fillRect(bxx - 1 - (i > 0 ? 5 : 0), top + len - 1, 5, 1);
    }
}
/* THE LINE. FAM_LINE.erd is the family's one gesture on the assembled
   line, at ord 90.5. crit-art-erd #18 is right that the assembly is
   the largest -erd typography in the game and that shadowBlur 14 is
   the only blurred edge in the file, about to become the money shot
   of the family whose technique bans blurred edges. So: shadowBlur 0,
   a hard +1,+1 shadow, and the closing rule drawn to the ground
   rule's own profile. The rule under the line and the rule at your
   feet are the same object at two scales. */
function erdLine(cx, d, k, x, y, w) {
    cx.save(); cx.shadowBlur = 0;
    cx.fillStyle = partCol(ERD_COL, 0.92);
    cx.fillRect(Math.round(x - w / 2), Math.round(y) + 1, Math.round(w), 2);
    cx.fillStyle = partCol(ERD_LIT, 1);
    cx.fillRect(Math.round(x - w / 2), Math.round(y) + 1, Math.round(w), 1);
    cx.fillRect(Math.round(x - w / 2), Math.round(y) - 3, 1, 7);
    cx.fillRect(Math.round(x + w / 2) - 1, Math.round(y) - 3, 1, 7);
    cx.restore();
}

function stepErd(dt, real, st) {
    var i, o, F = RT.foes, f, g, dec;
    /* Everything in this family is on the real clock. It is over in a
       third of a second and none of it is matter in the sense the sim
       clock is for. */
    for (i = st.a.length - 1; i >= 0; i--) {
        o = st.a[i]; o.t += real;
        if (o.k === 'clap' && !o.fired && o.t >= o.CT) {
            /* crit-art-erd #1: the design's own best sentence is "the
               effect is silent and then it is not", and its hook
               called sfx() on the KEYPRESS, 81 to 123 milliseconds
               before the block. Fired from the stepper, on the frame
               cl.fired flips, which is a branch that already exists
               and already runs exactly once per clap.
               crit-art-erd #2: erdclap is NOT a new instrument.
               voxAnswer('erd') is already "a full stop, it ends where
               it ends and there is no ring-out". erdclap is the 4ms
               wood transient that goes IN FRONT of that. */
            o.fired = 1; erdBurst(o); fxSfx('erdclap', 0.05);
        }
        if (o.t >= o.max) st.a.splice(i, 1);
    }
    /* crit-eng-erd N6: `1 - 6*dt` is the first-order expansion of
       e^(-6dt), accurate to 2% at 60 and 144Hz and 5% wrong on the one
       frame after a hitch, because `real` is clamped to 0.05.
       One pow per frame, not per chip. */
    dec = Math.pow(0.0025, real);
    for (i = st.chips.length - 1; i >= 0; i--) {
        o = st.chips[i]; o.t += real;
        if (o.t >= o.max) { st.chips.splice(i, 1); continue; }   // cut mid-air, never faded
        o.x += o.vx * real; o.y += o.vy * real;
        o.vx *= dec; o.vy *= dec;
    }
    for (i = 0; i < F.length; i++) {
        f = F[i]; if (!f || f.dead) continue;
        g = f._fx && f._fx.erd; if (!g) continue;
        if (f.silence > 0) {
            g.t0 = (g.t0 || 0) + real;
            g.n = g.n || 1;
            /* ONE BLINK. crit-art-erd #20: stillness is correct for
               two seconds and not for three and a half; the eye stops
               reading a static overlay after one, and then 152
               fillRects a frame are buying nothing. At exactly 1.0s
               remaining the whole gag blinks off for two frames, once.
               It is the same knock the pip already uses, which is how
               a family gets a vocabulary instead of a list. */
            if (!g.blinked && f.silence <= 1.0) { g.blinked = 1; g.blink = 0.033; }
            if (g.blink > 0) g.blink = Math.max(0, g.blink - real);
            g.rects = Math.round(0.6 * foeH(f) / 3) + 19;
        } else if (g.gag) { g.gag = 0; g.blinked = 0; g.blink = 0; g.t0 = 0; }
    }
}
function drawErdWorld(cx, dt, st) {
    var i, o, k, F = RT.foes, f, g;
    for (i = 0; i < st.a.length; i++) {
        o = st.a[i]; k = clamp(o.t / o.max, 0, 1);
        if (o.k === 'clap') drawErdClap(cx, o);
        else if (o.k === 'gust') drawErdGust(cx, o, k);
        else if (o.k === 'rule') drawErdRule(cx, o);
        else if (o.k === 'ctr') drawErdCounter(cx, o, k);
        else if (o.k === 'strike') drawErdStrike(cx, o, k);
        else if (o.k === 'shut') drawErdShut(cx, o, k);
        else if (o.k === 'open') drawErdOpen(cx, o, k);
    }
    drawErdChips(cx, st);
    for (i = 0; i < F.length; i++) {
        f = F[i]; if (!f || f.dead || !(f.silence > 0)) continue;
        g = f._fx && f._fx.erd; if (!g) continue;
        drawErdGag(cx, f, g);
    }
}
/* Beat 1, the close: two bars at plus and minus (D + w), full body
   height plus 8 so they overhang the head and bite two pixels into
   the ground, closing on easeOutExpo. 87% of the distance is gone in
   the first quarter, and that easing is the entire reason this reads
   as an order obeyed rather than a door swinging shut. They widen
   from 1px to BW as they travel, so a bar arriving is a bar getting
   heavier. AND THE BARS ARE SEGMENTED: crit-art-erd #8, every scaling
   term in this family was a continuous magnitude and not one of them
   could be read as a number, which is a strange failure in the family
   whose stacks ARE syllables. nn segments with 1px gaps, and at the
   stack cap the LAST SEGMENT IS LEFT EMPTY: the full count and the
   hole, in the same shape, tying the biggest close in the family to
   the pip.
   ANTICIPATION: both bars hold static at the full start position for
   0.02s before the ease begins. crit-art-erd #19, an expo with no
   held first frame does not read as a snap, it reads as a pop-in,
   because there is no frame in which you see where the bars came
   from. Three frames at 144Hz, one at 60, free. */
function drawErdClap(cx, o) {
    var sx = Math.round(isoX(o.x, o.y)), sy = Math.round(isoYA(o.x, o.y));
    var t = o.t, top = Math.round(sy - o.h - 8), bh = o.h + 10;
    var u, dist, bw, i, seg, sh2, y2, hole = o.nn >= T('stackMax');
    var t2 = o.CT + o.RH, t3 = t2 + 0.05, t4 = t3 + o.VT;
    if (t < o.CT) {                                  // beat 1
        u = t < 0.02 ? 0 : 1 - Math.pow(2, -11 * ((t - 0.02) / Math.max(0.001, o.CT - 0.02)));
        dist = Math.round((o.D + o.w) * (1 - u));
        bw = Math.max(1, Math.round(1 + (o.BW - 1) * u));
        for (i = -1; i <= 1; i += 2) {
            var bx = sx + i * dist - (i > 0 ? 0 : bw);
            cx.fillStyle = '#08060c'; cx.fillRect(bx + 1, top + 1, bw, bh);
            seg = Math.max(1, o.nn); sh2 = Math.floor((bh - (seg - 1)) / seg);
            cx.fillStyle = partCol(ERD_COL, 1);
            for (var s2 = 0; s2 < seg; s2++) {
                if (hole && s2 === seg - 1) continue;   // the hole in the song, in the bar
                y2 = top + s2 * (sh2 + 1);
                cx.fillRect(bx, y2, bw, sh2);
            }
        }
        /* a 1px rule at mouth height joins them and shortens as they
           close: without it you see two loose bars, with it you see
           one bracket pair closing. */
        cx.fillStyle = partCol(ERD_COL, 0.55);
        cx.fillRect(sx - dist, Math.round(sy - o.h * 0.70), dist * 2, 1);
        return;
    }
    if (t < t2) {                                    // beat 2, the block
        if (o.dead) return;                          // a dead body skips the beat that needs a silhouette
        cx.fillStyle = partCol(ERD_LIT, o.RA);
        cx.fillRect(sx - o.w, top, o.w * 2, bh);
        return;
    }
    if (t < t3) {                                    // beat 3, the redaction, a fixed 50ms
        cx.fillStyle = partCol(ERD_INK, 0.92);
        cx.fillRect(sx - o.w, top, o.w * 2, bh);
        cx.fillStyle = partCol(ERD_LIT, 1);
        cx.fillRect(sx - o.w, top, o.w * 2, 1);
        cx.fillRect(sx - o.w, top + bh - 1, o.w * 2, 1);
        cx.fillStyle = partCol(ERD_COL, 1);
        cx.fillRect(sx - o.BW, top, o.BW * 2, bh);
        return;
    }
    if (t < t4) {                                    // beat 4, the cut
        /* the block is not dimmed and does not shrink from its sides.
           Its top edge travels down and its bottom edge travels up
           until they meet, and on the frame they meet everything is
           gone. The two lit edges ride the cut inward the whole way,
           so the last thing on screen is two bright lines a pixel
           apart at FULL alpha, in the colour comp.css uses for a
           stanza the book has repaired. The lit edges are what
           survives the redaction. */
        u = (t - t3) / o.VT;
        var cy = top + bh / 2, hh = Math.round(bh / 2 * (1 - u));
        if (hh < 1) return;
        cx.fillStyle = partCol(ERD_INK, 0.92);
        cx.fillRect(sx - o.w, cy - hh, o.w * 2, hh * 2);
        cx.fillStyle = partCol(ERD_LIT, 1);
        cx.fillRect(sx - o.w, cy - hh, o.w * 2, 1);
        cx.fillRect(sx - o.w, cy + hh - 1, o.w * 2, 1);
        return;
    }
    /* AFTER THE CUT, ONE CARET. A caret is the mark for something is
       missing here, it is three fillRects, and it is the only thing
       in the family that admits what it just did. */
    cx.fillStyle = partCol(ERD_COL, 1);
    cx.fillRect(sx - 1, top + bh, 2, 1);
    cx.fillRect(sx - 3, top + bh + 2, 2, 1);
    cx.fillRect(sx + 1, top + bh + 2, 2, 1);
}
function drawErdGust(cx, o, k) {
    var u = 1 - Math.pow(2, -11 * k), r = o.r * u * TILE_W / 2, i, a;
    cx.save();
    cx.translate(Math.round(isoX(o.x, o.y)), Math.round(isoYA(o.x, o.y)));
    cx.scale(1, 0.5);
    cx.fillStyle = partCol(ERD_COL, 0.8);
    for (i = 0; i < 12; i++) {
        a = i * TAU / 12;
        cx.fillRect(Math.round(Math.cos(a) * r) - 2, Math.round(Math.sin(a) * r) - 1, 4, 2);
    }
    cx.restore();
}
/* In on easeOutExpo over 0.10s, hold 0.06s, both ends retract to the
   centre over 0.07s. Drawn on the 1:0.5 GROUND PLANE at the player's
   feet in ERD_COL, which is what keeps it structurally different from
   the detonation's screen rule under the line (see 12.13): different
   plane, different colour, different anchor. */
function drawErdRule(cx, o) {
    var sx = Math.round(isoX(RT.px, RT.py)), sy = Math.round(isoYA(RT.px, RT.py));
    var t = o.t, hw = o.hw * TILE_W / 2, u, i, tx;
    if (t < 0.10) u = 1 - Math.pow(2, -11 * (t / 0.10));
    else if (t < 0.16) u = 1;
    else u = clamp(1 - (t - 0.16) / 0.07, 0, 1);
    hw = Math.round(hw * u);
    if (hw < 2) return;
    cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5);
    if (!o.drag) {
        cx.fillStyle = '#08060c'; cx.fillRect(-hw, 1, hw * 2, 2);
        cx.fillStyle = partCol(ERD_COL, 1); cx.fillRect(-hw, 0, hw * 2, 2);
        cx.fillStyle = partCol(ERD_LIT, 1); cx.fillRect(-hw, 0, hw * 2, 1);
        for (i = 0; i < o.ticks.length; i++) {
            tx = Math.round(clamp(o.ticks[i], -hw, hw));
            cx.fillRect(tx, -3, 1, 7);
        }
    }
    cx.fillStyle = partCol(ERD_LIT, 1);
    cx.fillRect(-hw, -3, 1, 7); cx.fillRect(hw - 1, -3, 1, 7);
    cx.restore();
}
function drawErdChips(cx, st) {
    var i, o, sx, sy;
    if (!st.chips.length) return;
    for (i = 0; i < st.chips.length; i++) {
        o = st.chips[i];
        sx = Math.round(isoX(o.x, o.y)); sy = Math.round(isoYA(o.x, o.y) - o.z);
        cx.fillStyle = o.lit ? partCol(ERD_LIT, 1) : partCol(ERD_COL, 1);
        cx.fillRect(sx, sy, o.lg, 2);
    }
}
function drawErdCounter(cx, o, k) {
    var sx = Math.round(isoX(o.x, o.y)), sy = Math.round(isoYA(o.x, o.y));
    var u = clamp(k / 0.44, 0, 1), r, i, a, m;
    if (k < 0.44) {
        r = (o.r + 0.6 + u * 2.2) * TILE_W / 2;
        cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5);
        cx.fillStyle = partCol(ERD_COL, 1);
        for (i = 0; i < 12; i++) {
            a = i * TAU / 12;
            cx.fillRect(Math.round(Math.cos(a) * r) - 2, Math.round(Math.sin(a) * r) - 1, 4, 2);
        }
        cx.restore();
    }
    m = Math.round(clamp(k / 0.38, 0, 1) * 8);
    cx.strokeStyle = partCol(ERD_LIT, 1); cx.lineWidth = 1;
    cx.strokeRect(sx - o.r * 22 - m + 0.5, sy - o.h - m + 0.5, o.r * 44 + m * 2, o.h + m * 2);
    /* Tier 3: one 1px ERD_INK bar with an ERD_LIT top edge across EACH
       of the 22 mouths, on drawChorus's own ring geometry so they land
       where the mouths actually are. Forty-four fillRects, once. */
    if (o.tier === 3) {
        var h2 = 118;
        for (i = 0; i < 22; i++) {
            a = i / 22 * TAU + o.anim * 0.25;
            var rr = 26 + (i % 4) * 17;
            var mx = Math.round(sx + Math.cos(a) * rr), my = Math.round(sy - h2 * 0.55 + Math.sin(a) * rr * 0.55);
            cx.fillStyle = partCol(ERD_INK, 0.96); cx.fillRect(mx - 9, my - 1, 18, 3);
            cx.fillStyle = partCol(ERD_LIT, 1); cx.fillRect(mx - 9, my - 1, 18, 1);
        }
    }
}
/* The same word, same 9px, same position, in ERD_COL with the house
   shadow, and a 3px ERD_LIT bar sweeps LEFT TO RIGHT through it,
   clipping the word away behind it. When the bar reaches the right
   edge, bar and word are both gone. drawCuts eats a word from the
   right as it rises; this one is struck from the left and does not
   rise, because a counter is not a death. */
function drawErdStrike(cx, o, k) {
    var sx = Math.round(isoX(o.x, o.y)), sy = Math.round(isoYA(o.x, o.y) - o.z);
    var w, bx;
    cx.save(); cx.textAlign = 'center';
    cx.font = 'bold 9px "Press Start 2P", monospace';
    w = cx.measureText(o.w).width;
    bx = sx - w / 2 + w * k;
    cx.save();
    cx.beginPath(); cx.rect(bx, sy - 12, w, 16); cx.clip();
    cx.fillStyle = '#08060c'; cx.fillText(o.w, sx + 1, sy + 1);
    cx.fillStyle = FAMS.erd.col; cx.fillText(o.w, sx, sy);
    cx.restore();
    cx.fillStyle = partCol(ERD_LIT, 1);
    cx.fillRect(Math.round(bx) - 3, sy - 10, 3, 12);
    cx.restore(); cx.textAlign = 'left';
}
function drawErdShut(cx, o, k) {
    var sx = Math.round(isoX(o.x, o.y)) + o.ox, sy = Math.round(isoYA(o.x, o.y) - o.z);
    var hh;
    if (k < 0.55) { cx.fillStyle = partCol(ERD_INK, 0.98); cx.fillRect(sx - 5, sy - 6, 11, 10); return; }
    hh = Math.round(5 * (1 - (k - 0.55) / 0.45));
    if (hh < 1) return;
    cx.fillStyle = partCol(ERD_INK, 0.98); cx.fillRect(sx - 5, sy - 1 - hh, 11, hh * 2);
    cx.fillStyle = partCol(ERD_LIT, 1);
    cx.fillRect(sx - 5, sy - 1 - hh, 11, 1); cx.fillRect(sx - 5, sy - 2 + hh, 11, 1);
}
function drawErdOpen(cx, o, k) {
    var sx = Math.round(isoX(o.x, o.y)), sy = Math.round(isoYA(o.x, o.y) - 26);
    var px = Math.round(-Math.sin(o.a) * k * 7), py = Math.round(Math.cos(o.a) * k * 7);
    cx.fillStyle = partCol(ERD_LIT, 1);
    cx.fillRect(sx + px - 1, sy + py - 3, 3, 7);
    cx.fillRect(sx - px - 1, sy - py - 3, 3, 7);
}
/* The snap is regSnap('erd', null). The clap IS the snap. This is the
   opt-out the shared registry was written for and -erd is the only
   family that takes it. */
regFam('erd', {
    call: ERD_CALL, pip: erdPip, fade: erdFade, sour: erdSour, det: erdDet,
    st: erdBody, line: erdLine, snap: null,
    ord: 46, cap: 96, step: stepErd, draw: drawErdWorld,
    make: function () { return { a: [], chips: [] }; }
});

/* ─────────────── -ark, shadow ───────────────
   "She walked out past the mill, the well, she walked out past the
   mark, and he held the last coal in the town and he watched her from
   the dark."
   THE LIQUID IS DELETED. crit-art-ark #1: the design opens with "its
   own shadow climbs up its body like a waterline", which is specific,
   cheap and unmistakably this game, and then renders it as a pool, a
   splash, sixteen heavy droplets, specks, drips, a bead and a
   waterline that settles slow. SHADOWS DO NOT SPLASH. What was
   specified is purple ooze rising up a body, which is every shadow
   DoT shipped since 2001. The sfx comment already fixed this family's
   image and it is not liquid: "something leaving the room: the pitch
   walks out and the air it was standing in takes another half second
   to close."
   THE RULE. -ark is the only family that does not glow. Every -ark
   surface over a lit sprite is 'multiply'; every -ark surface on the
   floor is 'source-over' in the ink colour; and the only bright pixel
   anywhere in the family is a one-pixel #c9a1ff rim on the edge of a
   dark shape. The floor is source-over and not multiply, and that is
   crit-eng-ark #9: multiply does not saturate the way lighter clamps,
   so eight overlapping stains leave 0.2^8 of the floor, which is a
   hole cut in the level for six and a half seconds. */
var ARK_INK, ARK_DEEP, ARK_RIM, ARK_MOTE;
function arkBoot() {
    ARK_INK  = rgbMul(FAMS.ark.col, 0.28);      // 39,30,58   the body of a shadow
    ARK_DEEP = rgbMul(FAMS.ark.col, 0.16);      // 22,17,33   the core, and every ground shape
    ARK_RIM  = hex2rgb(FAMS.ark.glow);          // 201,161,255 the only light in the family
    ARK_MOTE = rgbMul(FAMS.ark.col, 0.62);      // 86,66,129  falling matter, add: 0
}
var ARK_CALL = {
    fly: { rate: 34, acc: 0, accL: 1, wob: 3.4, step: 0, grav: -8 },

    /* The drip. It is the opposite of every other trail in the game:
       the others emit vz rnd(2,10), add 1, grav 0, sparks rising and
       hanging. This falls, hits z=0, and bounces at vz *= -0.28, which
       is a one-pixel hop that reads exactly like a droplet ticking off
       a floor. The word leaves a dotted line on the ground behind it
       and you can see where it came from.
       crit-eng-ark #18: at size rnd(1.4,2.4), shrunk further by
       drawParts' size * (0.4 + 0.6*k) and faded with life, a
       dark-violet square at 40% over a night-washed floor is close to
       nothing. The floor is 2.6 to 3.8 and one in four is a hole
       rather than a drop.
       crit-eng-ark #10: the design's `c.dripT -= dt` had no
       initialiser on the call literal, so frame one was
       `undefined - dt` = NaN, `NaN <= 0` is false, and the family had
       no trail at all for the entire flight, with no throw and no
       console noise. There is no new field: the accumulator is
       stepCalls' shared `c.et`, driven by `fly.rate`. */
    trail: function (c, dt) {
        if (Math.random() < 0.25)
            part({ x: c.x, y: c.y, z: 27 + rnd(-3, 3), vx: 0, vy: 0, vz: rnd(2, 7),
                   life: rnd(0.2, 0.4), size: rnd(1, 1.8), col: ARK_RIM, add: 1, grav: 0 });
        else
            part({ x: c.x + rnd(-.08, .08), y: c.y + rnd(-.08, .08), z: 27 + rnd(-4, 4),
                   vx: 0, vy: 0, vz: rnd(-6, 2), life: rnd(0.45, 0.75), size: rnd(2.6, 3.8),
                   col: ARK_MOTE, add: 0, grav: 150 });
    },

    /* A HOLE, not a halo. A source-over disc darker than the floor
       bitmap, radius 10 + 1.2*sin(RT.t*9 + c.seed), which at 1.4Hz is
       slow enough to read as breathing and not as a strobe, with a
       1px rim. Over the floor that is a twenty-pixel bite taken out
       of the ground, and without the rim it vanishes over a dark prop.
       (crit-eng-ark #17: the design called #0d0916 "darker than the
       backdrop" and the backdrop is #07060a, which is darker. It is
       darker than the FLOOR BITMAP, which is what the effect needs.
       Wording, not behaviour.) */
    mark: function (cx, c, sx, sy, P) {
        var w = 10 + Math.sin(RT.t * 9 + (c.seed || 0)) * 1.2;
        cx.fillStyle = partCol(ARK_DEEP, 0.92);
        cx.beginPath(); cx.arc(0, -8, w, 0, TAU); cx.fill();
        cx.globalCompositeOperation = 'lighter';
        cx.strokeStyle = partCol(ARK_RIM, 0.30 * T('vfxRimGround')); cx.lineWidth = 1;
        cx.beginPath(); cx.arc(0, -8, w + 0.5, 0, TAU); cx.stroke();
    },

    head: function (cx, c, sx, sy, P) {
        cx.fillStyle = 'rgba(4,3,10,.70)';
        cx.beginPath(); cx.arc(sx + Math.cos(isoAng(c.a)) * 9, sy + Math.sin(isoAng(c.a)) * 9,
                               3 + c.near * 2, 0, TAU); cx.fill();
    },

    /* THE CUT-OUT WORD, and it is the best free idea in the pack
       (crit-art-ark E2). Every other family fills the word in its own
       colour with a #08060c shadow at +1.5,+1.5. -ark inverts it: the
       word is filled darker than the floor and the OFFSET COPY is the
       light one, at -1,-1. The word is a hole with a violet edge on
       its upper left, as though the only light in the scene is behind
       it. Two fillTexts, which is what the other four already pay.
       Two of the four castable words get one frame each, never
       explained, noticed on the fourth cast (crit-art-ark #17):
       `stark` gets NO offset copy at all, flat and edgeless, the
       hardest read in the family; `spark` flashes a bright rim on the
       hole for a single frame at launch and then goes out. */
    word: function (cx, c, sx, sy, P) {
        var w = c.word.toUpperCase(), flat = w === 'STARK';
        cx.textAlign = 'center';
        cx.font = 'bold ' + (12 + (c.couplet ? 1.5 : 0) + c.near * 1.6).toFixed(1) + 'px "Press Start 2P", monospace';
        if (c.couplet) { cx.fillStyle = partCol(ARK_INK, 0.32); cx.fillText(w, sx - 2, sy - 2); }
        if (w === 'SPARK' && c.age < 0.04) { cx.fillStyle = FAMS.ark.glow; cx.fillText(w, sx - 1, sy - 1); }
        else if (!flat) { cx.fillStyle = partCol(hex2rgb(FAMS.ark.col), 0.62); cx.fillText(w, sx - 1, sy - 1); }
        cx.fillStyle = '#0d0916'; cx.fillText(w, sx, sy);
    },

    /* MARK. The despawn stain is not a disc, it is a SCRATCH: three
       1px strokes crossing, life 1.6s. Fragment II is "four letters /
       scratched out of a stone / and out of a man", there is a place
       called `mark` whose one prop is a stone with a name taken off
       it, and this ties every missed -ark call to it. */
    fizz: function (c) {
        fxPush(fxOf('ark').g, { k: 'scratch', x: c.x, y: c.y, s: irnd(0, 999),
                                t: 0, max: 1.6 }, 96);
        spray(c.x, c.y, 20, 3, c.a, 1.2, { col: ARK_MOTE, add: 0, sp0: 0.1, sp1: 0.5,
                                            vz0: -10, vz1: 4, l0: 0.3, l1: 0.6, grav: 160 });
    }
};

/* The cell is STAINED, not lit: where the other four fill
   rgba(fam,.3) with 'lighter', -ark fills partCol(ARK_INK, 0.55*fade)
   with 'multiply', which on the .72 plate takes the cell down to
   nearly black. The glyph K is FAMS.ark.glow at full brightness on
   ink: the highest contrast of any pip on the board, which is the
   right answer for a family whose material is darkness.
   And the drip is deleted. crit-art-ark #14: five pixels hanging
   under a 13px cell that already has too much in it, under the night
   wash, potentially 148 pixels up in the air on the Chorus, and on
   two foes sharing a tile the taller row's drips cross the shorter
   row's plate. PUT THE CLOCK IN THE GLYPH instead. */
function arkPip(cx, s, x, sy, w, fade) {
    var k = 1 - clamp(s.t / 1.2, 0, 1);          // never s.t / s.max: the drag does not update max
    cx.save();
    cx.globalCompositeOperation = 'multiply';
    cx.fillStyle = partCol(ARK_INK, 0.55 * fade);
    cx.fillRect(x - w / 2 + 1, sy - 10, w - 2, 14);
    cx.restore();
    cx.fillStyle = s.drone ? '#8a8090' : FAMS.ark.glow;
    cx.fillText('K', x, sy);
    if (k > 0) {                                  // the ink climbs the letter from the baseline
        cx.save();
        cx.beginPath(); cx.rect(x - w / 2, sy - Math.round(8 * k), w, Math.round(8 * k) + 2); cx.clip();
        cx.fillStyle = '#0d0916'; cx.fillText('K', x, sy);
        cx.restore();
    }
    /* the drag trail. crit-art-ark #15: a wrong rhyme DRAGS every
       other sound over to its own, and pulling every other voice into
       yours and keeping it is the exact crime in the couplet, so -ark
       is the one family for which the drag should look like a win for
       the family and a loss for you. A dragged tag leaves a 1px violet
       trail on the plate for 0.25s.
       REFUSED, with a reason: the same finding also asks for every
       dragged tag to SLIDE one cell toward the -ark tag before it
       changes letters. The drag at the bodies is the haul, ord 86, and
       it owns the tags' positions for the length of the pull; a second
       author moving the same glyphs on the same frame is two
       animations fighting over one x. */
    if (s.dragT > 0) {
        cx.fillStyle = partCol(ARK_RIM, s.dragT / 0.25 * 0.5);
        cx.fillRect(x - w / 2, sy - 10, w, 1);
    }
}
/* THE SOUR, and it is the best unclaimed idea in the family.
   crit-art-ark #16: an -ark stack that expires unanswered takes HP
   off you and the design did not mention it, in the family whose
   fiction is a thing left unanswered. A sour -ark stack is the only
   one that leaves a mark ON THE FOE: a single 1px #c9a1ff tally
   scratched into the sprite box, persisting for the life of the body,
   stacking up to five. You can look across a room and see which
   enemies you have already failed to answer. */
function arkSour(f, s, i) {
    var g = famBag(f, 'ark');
    g.tally = Math.min(5, (g.tally || 0) + 1);
    if (g.seed == null) g.seed = irnd(0, 100000);
    spray(f.x, f.y, foeH(f) * 0.7, 3, rnd(0, TAU), 3.14,
          { col: ARK_MOTE, add: 0, sp0: 0.05, sp1: 0.4, vz0: -12, vz1: 0,
            l0: 0.4, l1: 0.8, grav: 170 });
    return ARK_MOTE;
}

/* THE PRIMARY OBJECT IS A WORD, and it is the biggest of the five.
   crit-art-ark #2 counted seventeen specified surfaces against three
   words, and #9 measured the one word the design did author at
   19.2px at n=8, against a typo default of 15 and a slam of 62.
   THE HOLLOW WORD. Nothing else in this file strokes text. A word
   with the inside taken out is the shape of the whole game.
   Drawn at the family's SCREEN pass, not its world pass, and that is
   crit-eng-ark #3 and crit-art-ark #6: the design put the word in
   typo() and its own screen dim before it, so the one word the -ark
   detonation specified was multiplied by its own darkness along with
   everything else. drawFx is inside the world block; drawBloom, which
   is where -ark's dark now lives, is after it; drawFxS is after THAT.
   A screen registration at ord 48 is the only place the word survives
   the family's own dim, and it costs one extra regFx line. */
function drawArkWord(cx, o, k) {
    var sx = Math.round(punchWX(isoX(o.x, o.y))), sy = Math.round(punchWY(isoYA(o.x, o.y) - o.z - k * 26));
    cx.save(); cx.textAlign = 'center';
    cx.font = 'bold ' + o.px + 'px "Press Start 2P", monospace';
    cx.globalAlpha = clamp((1 - k) * 2.4, 0, 1);
    cx.fillStyle = '#0d0916'; cx.fillText('ARK', sx, sy);
    cx.strokeStyle = FAMS.ark.glow; cx.lineWidth = 1;
    cx.strokeText('ARK', sx, sy);
    cx.restore(); cx.textAlign = 'left';
}
/* The stain. source-over in ARK_DEEP with a 1px #c9a1ff edge at the
   post-wash alpha, offset along the angle away from the lantern.
   Life on the sim clock, which makes it the longest-lived visual in
   the game by a factor of four, and that is the point: the fiction is
   a thing that does not come out. */
function arkStain(f, a, r, sp) {
    var st = fxOf('ark'), ang = Math.atan2(f.y - RT.py, f.x - RT.px);
    fxPush(st.g, { k: 'stain', x: f.x + Math.cos(ang) * 0.25, y: f.y + Math.sin(ang) * 0.25,
                   r: r, a: a * T('arkStain'), t: 0, grow: sp,
                   life: clamp(3.2 + 0.42 * (f._arkN || 1), 3.2, 8.5) * T('arkStain') }, 96);
}
function arkDet(f, n, d) {
    var st = fxOf('ark'), g = famBag(f, 'ark'), h = foeH(f);
    if (g.seed == null) g.seed = irnd(0, 100000);
    f._arkN = n;
    /* THE SHADOW STANDS UP. The waterline climbs from the feet on a
       smoothstep over 0.18s, then falls over 0.55s and STAYS. The
       recede is three times the rise. */
    g.line = 0.001; g.rise = 1; g.top = clamp(0.62 + 0.036 * n, 0.62, 0.92);
    g.rest = clamp(0.16 + 0.026 * n, 0.16, 0.40); g.rt = 0;
    g.trailT = 0.28;
    /* THE SHADOW THAT DOES NOT COME BACK (crit-art-ark #17). On the
       detonation frame the body's existing 42% contact ellipse
       DETACHES and slides 0.4 tiles away from the lantern over 0.18s
       and stays there for the rest of the body's life, through the
       shared f.cso offset. One lerp, and it is the most unsettling
       thing available here. */
    g.det = 1; g.off = 0;
    g.oa = Math.atan2(f.y - RT.py, f.x - RT.px);
    /* Gated on n >= 2 exactly as the specks already were
       (crit-art-ark #8): twenty-five 70px stains in an eleven-wide
       square overlap into one undifferentiated dark field, in the one
       scene whose whole point is that you can see individual people. */
    if (n >= 2) arkStain(f, clamp(0.20 + 0.037 * n, 0.20, 0.48),
                         clamp(1.05 + 0.155 * n, 1.05, 2.6), 0.30);
    /* THE HOLLOW WORD, and it un-prints the row that paid for it.
       crit-art-ark #3: Fragment II is "four letters / scratched out of
       a stone / and out of a man". The -ark words are dark, mark,
       spark, stark, and the design does not mention erasure once. The
       strike goes on the TAGS and never on your own word, or the
       effect reads as failure. */
    fxPush(st.s, { k: 'word', x: f.x, y: f.y, z: h + 30, px: Math.round(22 * d.sc),
                   t: 0, max: 0.52 + 0.2 * d.pb, d: d.i * d.stag }, 16);
    /* The row that PAID for it, not the row that is left. f.stacks was
       emptied by doRhyme about a fifth of a second ago and this counted
       the survivors, so the strike that is meant to scratch out four
       letters scratched out none on every clean close and only showed
       up at all when the body happened to still be carrying another
       sound. d.cells is the pre-spend copy; `go` is the cells this
       sound actually took. */
    var gone = 0, gi;
    for (gi = 0; gi < (d.cells || []).length; gi++) if (d.cells[gi].go) gone++;
    fxPush(st.s, { k: 'unprint', x: f.x, y: f.y, z: h + 18 + (f.so || 0),
                   n: gone || n, t: 0, max: 0.52 }, 32);
    /* AND THE DIM IS SIZED BY best, NOT BY total. crit-art-ark #8:
       twenty-five ones is not a bigger moment than one eight and the
       design's formula said it was by a factor of three. Once, on
       d.i === 0; punch() takes the larger of every channel, so this
       coexists with whatever the detonation fires for the room. */
    if (d.i === 0) punch({ fam: 'ark', power: d.best, kind: 'close', x: f.x, y: f.y });
}
/* THE WATERLINE, columned on the sprite's own grid.
   crit-art-ark #13: five columns of f.r*44/5 is 18px each on a Sword,
   which reads as a staircase and not as a surface, and blit()'s own
   comment is "half a pixel of drift and the whole grid softens".
   The rows are 16 to 20 characters at PXS 2, so the waterline is one
   2px column per character column with a 1px cap each, all integer,
   landing on the same lattice as the art.
   crit-eng-ark #5: and it is clipped to a baked INK TWIN of the
   sprite rather than filled as a rect. A multiply over (-f.r*22, -h)
   to (f.r*22, 0) includes the floor either side of the legs and the
   air above the shoulders, and at 0.88 over the lantern pool that box
   edge is visible. foeSilSpr gives an exact silhouette for one cached
   drawImage.
   crit-art-ark #1: the column tops are HIGHER ON THE SIDE FACING THE
   LANTERN by cos(a - colAngle), so the shadow is thickest where your
   own lamp is not reaching, and walking around a rotting foe swings
   it. One atan2 per foe per frame, and nothing in any effect pack
   does it. */
function arkBody(cx, f, h, sx, sy) {
    var g = famBag(f, 'ark'), d = foeSil(f.def.draw), spr = foeSilSpr(f.def.draw, '#271e3a');
    var a = Math.atan2(sy - (isoYA(RT.px, RT.py)), sx - isoX(RT.px, RT.py));
    var lv = g.line, i, cols, cw, top, ang, lift;
    if (!(lv > 0)) return;
    cx.save();
    if (spr) {
        cols = d ? d.rows[0].length : 8; cw = d ? PXS : f.r * 44 / 8;
        for (i = 0; i < cols; i++) {
            ang = Math.atan2(0.5, (d ? silX(d, i) : -f.r * 22 + i * cw) || 0.01);
            lift = Math.cos(a - ang) * h * 0.07 + (frac(g.seed + i * 3.7) - 0.5) * h * 0.05;
            top = Math.round(-h * lv - lift);
            cx.save();
            cx.beginPath(); cx.rect(d ? silX(d, i) : -f.r * 22 + i * cw, top, cw, -top + 2); cx.clip();
            cx.globalAlpha = 0.30 + 0.58 * clamp(lv / 0.5, 0, 1);
            blit(cx, spr, 0, 0);
            cx.restore();
            /* the surface: one 1px violet cap per column, at slightly
               different heights. Those caps ARE the effect. */
            cx.globalCompositeOperation = 'lighter';
            cx.fillStyle = partCol(ARK_RIM, T('vfxRimBody') * (0.4 + 0.6 * clamp(lv / 0.5, 0, 1)));
            cx.fillRect(d ? silX(d, i) : -f.r * 22 + i * cw, top, cw, 1);
            cx.globalCompositeOperation = 'source-over';
        }
    }
    /* the tallies: one 1px scratch per stack you failed to answer,
       up to five, for the life of the body. */
    for (i = 0; i < g.tally && i < 5; i++) {
        cx.fillStyle = partCol(ARK_RIM, 0.65);
        cx.fillRect(Math.round(-f.r * 16 + i * 5), Math.round(-h * 0.55), 1, 7);
    }
    cx.restore();
}
/* Ten ticks at 0.5s, and per tick three things move and all three
   move one way: the detached shadow takes a little more floor, the
   waterline takes a little more body, and one or two dark motes
   detach from the waterline and run DOWN. That is the whole ambient
   signature and it is deliberately almost nothing: a five-second
   effect that emits a fountain is exhausting by second two.
   crit-art-ark #17: the motes are 2px squares in the foe's OWN coat
   colour shaded down, not a generic violet. The thing is losing
   itself, not leaking. */
FAM_BURN.ark = function (f) {
    var g = famBag(f, 'ark'), i, n = 1 + (Math.random() < 0.4 ? 1 : 0), pal = FOE_PAL[f.def.draw];
    var col = pal && pal.C ? rgbMul(pal.C.charAt(0) === '#' ? pal.C : FAMS.ark.col, 0.5) : ARK_MOTE;
    g.line = Math.min(0.95, (g.line || 0) + 0.014 * T('arkCreep'));
    g.rest = Math.min(0.95, (g.rest || 0.16) + 0.014 * T('arkCreep'));
    g.off = Math.min(0.55, (g.off || 0) + 0.02);
    for (i = 0; i < n; i++)
        part({ x: f.x + rnd(-.2, .2), y: f.y + rnd(-.2, .2), z: foeH(f) * (g.line || 0.2),
               vx: 0, vy: 0, vz: rnd(-14, -4), life: rnd(0.5, 1.0), size: 2,
               col: col, add: 0, grav: 60 });
};
/* THE ONE PERMANENT THING. crit-art-ark #10: the section sells
   permanence three times and then drains the waterline at 1.6 a
   second, and nothing in the family outlives about nine seconds.
   A foe killed while rotting leaves a stain with NO LIFE FIELD, held
   in a capped ring buffer cleared only by the travel reset. Walk back
   into the mill after clearing it and the floor still has the
   outlines. The game has never had a persistent consequence and this
   is the family that should introduce one. */
function arkFin(f) {
    if (!(f.burn && f.burn.fam === 'ark')) return 0;
    var st = fxOf('ark');
    fxPush(st.keep, { x: f.x, y: f.y, r: f.r * 1.1, kind: f.def.draw }, Math.max(1, T('arkKeep')));
    return 0;                                   // the grey cloud still fires: -ark is not the finisher
}
/* CONCEAL: THE HOOD ON THE LAMP. RT.conceal = 4, four seconds where a
   Thief cannot read the board, and it draws nothing today. The
   fiction hands this one over whole: he held the last coal and he
   watched her from the dark. THE LAMP DOES NOT GO OUT. IT GETS
   COVERED.
   crit-eng-ark #11: RT.conceal = 4 is a flat assignment, so a second
   -ark detonation at conceal 2.0 writes 4 again, the envelope's
   (4 - conceal)/0.18 term falls to 0, and the hood snaps open, the
   pool snaps 44 to 120 to 44 and the rim drops off you for 0.18s.
   -ark is the family most likely to be pressed twice in a row because
   the couplet is the game's best play. Hold the rise on its own
   accumulator, which cannot jump backwards. The fall still reads off
   RT.conceal so it can never desync from the mechanic. RT.conceal
   decays on the SIM clock and this rises on real: the hood shuts at
   wall speed and lifts at story speed, and during a recital a four
   second conceal is thirteen seconds of held breath. */
function arkCloakK() {
    var g = fxOf('ark');
    if (!(RT.conceal > 0)) { g.k = 0; return 0; }
    return Math.min(g.k, RT.conceal / 0.55) * T('arkCloak');
}
/* THE RING IS THE LINE. crit-art-ark #11: a radial sweep unwinding
   clockwise from -PI/2 is the single most generic buff timer in
   games, and expressing duration as a pie chart in a game whose
   entire vocabulary is words, lines and rhyme is a category error.
   "she walked out past the mill, the well" set in 8px around a
   1.15-tile circle on the floor plane, one rotate and one fillText
   per glyph. IT ERASES FROM THE END BACKWARDS as the buff runs out.
   drawLines already owns a typewriter; this is that typewriter in
   reverse. Drawn OUTSIDE the actor transform off raw sx/sy the way
   the lantern pool already is: crit-eng-ark #12, drawActor does
   scale(west, 1), so an arc swept clockwise runs anticlockwise
   whenever you face west. */
var ARK_LINE = 'she walked out past the mill, the well';
function drawArkCloak(cx, k) {
    var sx = isoX(RT.px, RT.py), sy = isoYA(RT.px, RT.py);
    var n = ARK_LINE.length, keep = Math.ceil(n * clamp(RT.conceal / 4, 0, 1)), i, a;
    cx.save();
    cx.translate(sx, sy); cx.scale(1, 0.5);
    cx.font = '8px "Press Start 2P", monospace'; cx.textAlign = 'center';
    cx.fillStyle = partCol(ARK_RIM, 0.5 * k);
    for (i = 0; i < keep; i++) {
        a = -Math.PI / 2 + i / n * TAU;
        cx.save(); cx.rotate(a); cx.translate(0, -1.15 * TILE_W / 2); cx.rotate(Math.PI / 2);
        cx.fillText(ARK_LINE.charAt(i), 0, 0);
        cx.restore();
    }
    cx.restore(); cx.textAlign = 'left';
    /* YOU ARE RIMMED, NOT SMUDGED. crit-art-ark #12: a multiply rect
       over the player at 0.55, plus the pool collapsing, plus a bigger
       darker contact shadow, for four seconds, in combat, is the
       player losing their own read on where they are as the REWARD
       for landing a spell. A flat violet twin of the same row strings
       blitted at plus and minus 1 on both axes under the real sprite:
       the player reads as unlit and OUTLINED. Better fiction too,
       since the point is that he kept the light and you do not have
       it. It is drawn here rather than in drawActor because the actor
       is already painted by the time this pass runs, so the rim goes
       round the outside where a blit underneath could not. */
    cx.save();
    cx.globalAlpha = 0.55 * k;
    cx.strokeStyle = FAMS.ark.glow; cx.lineWidth = 1;
    cx.strokeRect(Math.round(sx) - 9.5, Math.round(sy) - 39.5, 19, 39);
    cx.restore();
}
/* THE DENIAL, when a Thief reaches and finds nothing: three drips
   thrown from the Thief toward the player that die at 40% of the
   distance. Its hand goes out and stops. */
function arkDeny(f) {
    var a = Math.atan2(RT.py - f.y, RT.px - f.x), i, dd = Math.hypot(RT.px - f.x, RT.py - f.y) * 0.4;
    for (i = 0; i < 3; i++)
        part({ x: f.x, y: f.y, z: foeH(f) * 0.6, vx: Math.cos(a) * dd * 2.4, vy: Math.sin(a) * dd * 2.4,
               vz: rnd(-4, 6), life: 0.42, size: rnd(2.4, 3.4), col: ARK_MOTE, add: 0, grav: 120 });
    fxSfx('arkdeny', 0.2);
}
function stepArk(dt, real, st) {
    var i, o, F = RT.foes, f, g, moved;
    for (i = st.g.length - 1; i >= 0; i--) {
        o = st.g[i]; o.t += dt;                    // the ground is matter: it freezes with the room
        if (o.life != null && o.t >= o.life) st.g.splice(i, 1);
        else if (o.max != null && o.t >= o.max) st.g.splice(i, 1);
    }
    for (i = st.s.length - 1; i >= 0; i--) {
        o = st.s[i]; o.t += real;                  // the word and the un-print are letters
        if (o.t >= (o.d || 0) + o.max) st.s.splice(i, 1);
    }
    if (RT.conceal > 0) st.k = Math.min(1, (st.k || 0) + real / 0.18);
    else st.k = 0;
    for (i = 0; i < F.length; i++) {
        f = F[i]; if (!f || f.dead) continue;
        g = f._fx && f._fx.ark; if (!g) continue;
        if (g.line > 0) {
            if (g.rise) {
                g.rt += dt;
                /* smoothstep over 0.18s, then fall over 0.55s to rest.
                   The recede is three times the rise. */
                var u = clamp(g.rt / 0.18, 0, 1);
                g.line = g.top * (u * u * (3 - 2 * u));
                if (g.rt >= 0.18) { g.rise = 0; g.rt = 0; }
            } else if (g.rt < 0.55) {
                g.rt += dt;
                g.line = lerp(g.top, g.rest, clamp(g.rt / 0.55, 0, 1));
            }
            if (!(f.burn && f.burn.fam === 'ark')) g.line = Math.max(0, g.line - dt * 0.9);
        }
        if (g.det) {
            g.off = Math.min(0.4, g.off + dt * 0.4 / 0.18);
            f.cso = g.off; f.csa = 0.42; f.csr = 1.15;   // it detaches, and it never comes back
        }
        /* AND IT WALKS, at a rate rather than at a distance.
           crit-eng-ark #8 did the arithmetic the design did not: a
           stain every 0.35 tiles at 2.5 tiles/s is 7.1 a second and
           not "under three", and one Quick thief lays about seventy
           stains over a five-second rot. An interval WITH a distance
           gate, not a distance trigger. Caps one body at 3.6/s at any
           speed, which is the number the design thought it was
           writing, and makes the ground array bounded by foe count. */
        if (f.burn && f.burn.fam === 'ark') {
            moved = Math.hypot(f.x - (g.lx == null ? f.x : g.lx), f.y - (g.ly == null ? f.y : g.ly));
            g.trailT = (g.trailT || 0) - dt;
            if (g.trailT <= 0 && moved > 0.35) {
                arkStain(f, 0.20 + (g.pool || 0) * 0.16, 2.6, 0.18); g.trailT = 0.28;
                g.lx = f.x; g.ly = f.y;
            }
            if (g.lx == null) { g.lx = f.x; g.ly = f.y; }
        }
    }
}
function drawArkWorld(cx, dt, st) {
    var i, o, F = RT.foes, f, ck;
    for (i = 0; i < st.g.length; i++) {
        o = st.g[i];
        if (o.k === 'stain') drawArkStain(cx, o);
        else if (o.k === 'scratch') drawArkScratch(cx, o, clamp(o.t / o.max, 0, 1));
    }
    /* the permanent outlines. No life field, cleared only by travel. */
    for (i = 0; i < st.keep.length; i++) {
        o = st.keep[i];
        cx.save();
        cx.translate(Math.round(isoX(o.x, o.y)), Math.round(isoYA(o.x, o.y)));
        cx.scale(1, 0.5);
        cx.fillStyle = partCol(ARK_DEEP, 0.5);
        cx.beginPath(); cx.arc(0, 0, o.r * TILE_W / 2, 0, TAU); cx.fill();
        cx.strokeStyle = partCol(ARK_RIM, 0.22 * T('vfxRimGround')); cx.lineWidth = 1;
        cx.beginPath(); cx.arc(0, 0, o.r * TILE_W / 2, 0, TAU); cx.stroke();
        cx.restore();
    }
    ck = arkCloakK();
    if (ck > 0) drawArkCloak(cx, ck);
    /* THE BOARD VEIL. Every stack row on every foe gets one multiply
       fill over the plate plus two 1px violet rules along its top and
       bottom edges. THE TAGS THEMSELVES ARE NOT TOUCHED: hidden from
       them is not hidden from you. A dark plate becomes a black plate
       with violet rails, which is a bracket, which is the universally
       understood mark for this is sealed. */
    if (ck > 0) for (i = 0; i < F.length; i++) {
        f = F[i]; if (!f || f.dead || !f.stacks.length) continue;
        var pw3 = f.stacks.length * 13 + 8;
        var rx = Math.round(isoX(f.x, f.y) - pw3 / 2), ry = Math.round(foeStackY(f) - 11);
        cx.save();
        cx.globalCompositeOperation = 'multiply';
        cx.fillStyle = partCol(ARK_INK, 0.75 * ck);
        cx.fillRect(rx, ry, pw3, 16);
        cx.restore();
        cx.fillStyle = partCol(ARK_RIM, 0.55 * ck * T('vfxRimGround'));
        cx.fillRect(rx, ry, pw3, 1); cx.fillRect(rx, ry + 15, pw3, 1);
    }
}
function drawArkStain(cx, o) {
    var age = clamp(o.t / (o.grow || 0.3), 0, 1), fade = o.life ? clamp((o.life - o.t) / 0.8, 0, 1) : 1;
    var r = o.r * (0.35 + 0.65 * (1 - (1 - age) * (1 - age))) * TILE_W / 2;
    cx.save();
    cx.translate(Math.round(isoX(o.x, o.y)), Math.round(isoYA(o.x, o.y)));
    cx.scale(1, 0.5);
    cx.fillStyle = partCol(ARK_DEEP, o.a * fade);
    cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill();
    cx.strokeStyle = partCol(ARK_RIM, 0.28 * fade * T('vfxRimGround')); cx.lineWidth = 1;
    cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.stroke();
    cx.restore();
}
function drawArkScratch(cx, o, k) {
    var sx = Math.round(isoX(o.x, o.y)), sy = Math.round(isoYA(o.x, o.y)), i, a, l;
    cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5);
    cx.strokeStyle = partCol(ARK_RIM, (1 - k) * 0.55 * T('vfxRimGround')); cx.lineWidth = 1;
    cx.beginPath();
    for (i = 0; i < 3; i++) {
        a = frac(o.s + i * 4.1) * Math.PI; l = 7 + frac(o.s + i * 9.3) * 7;
        cx.moveTo(-Math.cos(a) * l, -Math.sin(a) * l);
        cx.lineTo(Math.cos(a) * l, Math.sin(a) * l);
    }
    cx.stroke(); cx.restore();
}
function drawArkScreen(cx, dt) {
    var st = fxOf('ark'), i, o, k;
    for (i = 0; i < st.s.length; i++) {
        o = st.s[i];
        if (o.t < (o.d || 0)) continue;
        k = clamp((o.t - (o.d || 0)) / o.max, 0, 1);
        if (o.k === 'word') drawArkWord(cx, o, k);
        else if (o.k === 'unprint') drawArkUnprint(cx, o, k);
    }
}
/* Over 0.12s each closed tag in that body's stack row is struck with
   one hard 1px #c9a1ff line, then the glyph blanks and the plate is
   left behind for 0.4s before it goes. The row you built is scratched
   out in front of you. It is the only detonation in the game whose
   verb is deletion. */
function drawArkUnprint(cx, o, k) {
    var sx = Math.round(punchWX(isoX(o.x, o.y))), sy = Math.round(punchWY(isoYA(o.x, o.y) - o.z));
    var w = 13, n = o.n, i, x0, u;
    if (!n) return;
    cx.save();
    for (i = 0; i < n; i++) {
        x0 = sx + (i - (n - 1) / 2) * w;
        u = clamp((k * o.max - i * 0.12 / Math.max(1, n)) / 0.12, 0, 1);
        cx.fillStyle = partCol(ARK_INK, 0.9 * (1 - k * 0.6));
        cx.fillRect(x0 - w / 2 + 1, sy - 10, w - 2, 14);
        if (u > 0) {
            cx.fillStyle = partCol(ARK_RIM, 1);
            cx.fillRect(x0 - w / 2 + 1, sy - 4, Math.round((w - 2) * u), 1);
        }
    }
    cx.restore();
}
regFam('ark', {
    call: ARK_CALL, pip: arkPip, sour: arkSour, det: arkDet, st: arkBody, fin: arkFin,
    ord: 48, cap: 96, step: stepArk, draw: drawArkWorld,
    make: function () { return { a: [], g: [], s: [], keep: [], k: 0 }; }
});
/* the one extra regFx line 3.4.3 buys: a screen pass at the same ord,
   so the hollow word survives the family's own darkening. */
regFx('arkscreen', null, null, { screen: drawArkScreen, ord: 48, make: fxNul });

/* ─────────────── -ill, still ───────────────
   "but for the girl who never will."
   THE RULE THAT GENERATES EVERYTHING. Four of the five families are
   things happening. -ill is a thing NOT happening, so every decision
   is the inverse of the decision the other four make: the effect
   contracts or holds rather than expanding, matter hangs and then
   falls hard rather than rising, the word lands at full size and does
   not move, the body is repaletted rather than painted over, and the
   screen stops rather than shaking.
   AND THE SPLIT BETWEEN THE CLOCKS IS THE FAMILY'S THESIS, stated
   once so nobody fixes it later: ALL MATTER ON THE SIM CLOCK, ALL
   TYPOGRAPHY ON THE REAL CLOCK. THE WORLD STOPS AND THE SOUND DOES
   NOT. -ill asks for the longest hitstop in the game and it is the
   only family whose own matter honours it: close a big -ill and the
   world stops, the ice stops with it, and the only things still
   moving on screen are the word and drawCuts writing the dead thing's
   last line. Everybody else's sparks keep flying.
   PUT THE LAMP IN IT. crit-art-ill #1: search the design for lamp,
   for leaving, for nobody answered, and you get zero hits; what is
   there instead is frost, rime, crust, icicle, flake, shatter, thaw,
   crack, powder and hexagon, which is Ice from any pack with this
   game's hex codes typed over it. And this is HER sound. */
var ILL_RIME = '#e6f6ff', ILL_RIME_RGB, ILL_DUST = '198,228,246', ILL_COLR, ILL_GLOWR;
function illBoot() {
    ILL_RIME_RGB = hex2rgb(ILL_RIME);           // 230,246,255. Two steps above glow, still not white.
    ILL_COLR = hex2rgb(FAMS.ill.col);           // 111,212,255
    ILL_GLOWR = hex2rgb(FAMS.ill.glow);         // 200,240,255
    /* ILL_DEEP and ILL_WHITE are both cut. crit-art-ill #7 and #8:
       #0d1620 is luma 19 against a floor base of luma 7, so a frozen
       outline in it is LIGHTER than what it sits on and the
       silhouette gets softer; and #f2fbff is pure white in practice,
       because .ice2 lifts every luma 72% toward 255 before the cold
       remap. Four new values per family times five families is twenty
       and the end of a closed palette. */
}
var ILL_CALL = {
    /* it slows, and then it commits. Two lines in stepCalls' shared
       row and it is the best beat any of the five has in flight. */
    fly: { rate: 26, acc: -0.30, accL: 0.80, wob: 0, step: 0, grav: 0 },

    /* Frozen air. These do not move at all, which nothing else in the
       game does, so the track is still hanging there after the word
       has already landed. add: 0, because every other emitter in this
       file glows and frost does not glow, it DUSTS. One mote in five
       is additive at size 2 and life 0.25: a single grain catching the
       lantern. That ratio is the difference between dust and glitter.
       sh: 2 is 2.5's standing sliver, and it is the one arm of
       drawPartPass that ROUNDS its x, so the material this family
       stakes its identity on arrives hard rather than as a 2x2 of
       quarter alpha. */
    trail: function (c, dt) {
        var g = Math.random() < 0.2;
        part({ x: c.x + rnd(-.06, .06), y: c.y + rnd(-.06, .06), z: 22 + rnd(-4, 4),
               vx: c.vx * -0.06, vy: c.vy * -0.06, vz: rnd(-3, 5),
               life: g ? 0.25 : rnd(0.4, 0.85), size: g ? 2 : (Math.random() < 0.5 ? 2 : 4),
               col: ILL_DUST, add: g ? 1 : 0, grav: 14, fr: 2.2, sh: 2 });
    },

    /* A RING MADE OF PIXELS, not a stroke. crit-art-ill #13: two 1px
       stroked arcs at unrounded isoX/isoY is the softest primitive on
       this canvas, and removing the additive disc the other four keep
       made the -ill projectile the hardest of the five to find, in the
       family whose whole point is legibility of stillness. "A ring is
       a rim of frost around a hole" is good writing and a bad picture
       at one pixel.
       Eight 2x2 fillRects at radius 11, integer-rounded, not
       rotating. It cannot shimmer. Under it a very low additive disc
       at 0.10, purely so the thing is findable. */
    mark: function (cx, c, sx, sy, P) {
        var i, a;
        cx.globalCompositeOperation = 'lighter';
        cx.globalAlpha = 0.10; cx.fillStyle = P.col;
        cx.beginPath(); cx.arc(0, -8, 11, 0, TAU); cx.fill();
        cx.globalAlpha = 0.55 + c.near * 0.35; cx.fillStyle = P.glow;
        for (i = 0; i < 8; i++) {
            a = i * TAU / 8;
            cx.fillRect(Math.round(Math.cos(a) * 11) - 1, Math.round(Math.sin(a) * 5.5) - 9, 2, 2);
        }
    },

    head: function (cx, c, sx, sy, P) {
        var sa = isoAng(c.a), tx = sx + Math.cos(sa) * 12, ty = sy + Math.sin(sa) * 12;
        cx.globalCompositeOperation = 'lighter';
        cx.strokeStyle = P.glow; cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(sx, sy); cx.lineTo(tx, ty); cx.stroke();
        cx.fillStyle = P.glow; cx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 2, 2);
    },

    /* THE GHOSTS LOSE A LETTER EACH. crit-art-ill #12: the detail
       budget was inverted against frequency, with nine layers for the
       execute, which a player sees twenty times a run, and three
       identical ghosts for the call, which they see four hundred
       times. STILL / TILL / ILL / LL. The trail is the sound decaying
       rather than the same word four times. It is typography-first,
       it is free, and it is the only trail in the game that MEANS
       something.
       No shadow and no halo on a ghost: the shadow is what makes the
       live word feel present, so withholding it is what makes the
       ghosts feel absent. */
    word: function (cx, c, sx, sy, P) {
        var w = c.word.toUpperCase(), age = c.max ? 1 - c.life / c.max : 1, j, gx, gy;
        var al = [0.34, 0.19, 0.09], gate = [0, 0.07, 0.12];
        cx.textAlign = 'center';
        cx.font = 'bold 12px "Press Start 2P", monospace';
        for (j = 2; j >= 0; j--) {
            if (age * (c.max || 0.58) < gate[j]) continue;
            gx = c.x - c.vx * (j + 1) * 0.042; gy = c.y - c.vy * (j + 1) * 0.042;
            cx.globalAlpha = al[j]; cx.fillStyle = P.col;
            cx.fillText(w.slice(j + 1), isoX(gx, gy), isoYA(gx, gy) - 26);
        }
        cx.globalAlpha = 1;
        cx.fillStyle = '#08060c'; cx.fillText(w, sx + 1.5, sy + 1.5);
        cx.fillStyle = P.col; cx.fillText(w, sx, sy);
    },

    /* The syllable falls on the ground and goes out. Four dust motes
       and the word one last time, NOT rising.
       crit-eng-ill #13: the design asked for "the word at 0.18 alpha",
       and drawTypo paints a hard #08060c shadow at +2,+2 BEFORE the
       fill with no alpha control on it, so passing
       rgba(111,212,255,.18) as the colour faded the fill and left the
       shadow at full strength: a solid dark word with a faint blue
       ghost on it. It does not go through typo() at all. */
    fizz: function (c) {
        spray(c.x, c.y, 20, 4, c.a, 1.0, { col: ILL_DUST, add: 0, sp0: 0.05, sp1: 0.3,
                                            vz0: -8, vz1: 0, l0: 0.4, l1: 0.8, grav: 40, sh: 2 });
        fxPush(fxOf('ill').a, { k: 'fizz', x: c.x, y: c.y, w: c.word.toUpperCase(), t: 0, max: 0.12 }, 32);
    },

    /* the lamp goes down when you say it. 0.25s, and it stays down
       while anything on the board is frozen. The player's lantern is
       the only thing in the game that dims when you cast. */
    cast: function (x, y, a) { var s = fxOf('ill'); s.lamp = Math.max(s.lamp || 0, 0.25); }
};

/* crit-art-ill #11: the design put 1px edge lines, corner pixels,
   midpoint pixels, then 2px edge lines, then a 1px diagonal crack
   over the glyph into a 13px cell whose neighbours' ink already
   bleeds eleven pixels into it. Three of its four states cannot be
   seen. ONE STATE CHANGE, AND IT IS A SHAPE CHANGE: the -ill pip is
   the only pip drawn as a solid filled cell, and as s.t runs down the
   fill DRAINS FROM THE TOP. It reads at 13px, it reads while
   overlapped, it reads at a glance across a row, and it is a
   continuous timer instead of three thresholds. */
function illPip(cx, s, x, sy, w, fade) {
    var k = clamp(s.t / 1.2, 0, 1), hh = Math.round(14 * k);
    cx.fillStyle = partCol(ILL_COLR, 0.55);                   // solid: the only filled cell on the board
    cx.fillRect(x - w / 2 + 1, sy + 4 - hh, w - 2, hh);
    cx.fillStyle = partCol(ILL_RIME_RGB, 0.75);               // the meniscus
    cx.fillRect(x - w / 2 + 1, sy + 4 - hh, w - 2, 1);
    cx.fillStyle = s.drone ? '#8a8090' : (k < 0.2 ? '#9fc8dc' : FAMS.ill.glow);
    cx.fillText('L', x, sy);
}
/* -ill registers NO FAM_FADE row: the cell does not breathe and does
   not flicker. In a row of five sounds where four of them pulse, the
   still one is instantly findable, and finding your -ill stacks fast
   is the whole reason you press 5. */
/* THE SOUR IS ONE THING, NOT TWO. crit-art-ill #22: the design
   offered "one typo with a new fall behaviour, OR, cheaper and
   equally good, four dust motes", and two options in a spec is two
   implementations. It is the motes: four, straight down out of the
   cell. An icicle coming off a gutter. The vertical drop is exact
   through z = foeH(f) + 18 + f.so; the HORIZONTAL placement into the
   stack's own cell goes through the x + d / y - d identity, which is
   crit-eng-ill #18's "not without a new particle field" answered
   without a new field. */
function illSour(f, s, i) {
    var j, ox = (i - (f.stacks.length - 1) / 2) * 13;
    for (j = 0; j < 4; j++)
        part({ x: f.x + (ox + rnd(-4, 4)) / TILE_W, y: f.y - (ox + rnd(-4, 4)) / TILE_W,
               z: foeH(f) + 18 + (f.so || 0), vx: 0, vy: 0, vz: -10,
               life: rnd(0.4, 0.8), size: (j & 1) ? 2 : 4, col: ILL_DUST,
               add: 0, grav: 220, sh: 2 });
    return ILL_DUST;
}

/* t = 0. The ring closes on the body like a hand, from
   (f.r + 1.1 + 0.10n) tiles to f.r over 0.15 + 0.01n seconds on an
   ease-out, and on the frame it reaches f.r it stops existing, which
   is also the frame the freeze lands, so it reads as the ring
   BECOMING the ice. Sim clock: it freezes with everything else.
   THE HEXAGON IS DELETED everywhere it appears. crit-art-ill #2: six
   chords with alternate vertices pulled in is snowflake symmetry, the
   most tired ice signifier in the medium; it breaks the 1:0.5 ellipse
   rule every other ground mark in the file follows; and the design's
   own justification, that it distinguishes this ring from four
   others, is already done by THE CONTRACTION, because no other ring
   in this game closes. Keep the ellipse, keep the contraction, and
   get the "not a normal ring" read from the game's own idiom: THREE
   ARCS WITH TWO-PIXEL GAPS. That is drawCuts' language, a line with a
   piece taken out of it, on the floor. */
function illDet(f, n, d) {
    var st = fxOf('ill'), g = famBag(f, 'ill'), h = foeH(f), i, mo, sp;
    if (d.i === 0) st.wordN = 0;
    fxPush(st.a, { k: 'ring', x: f.x, y: f.y, r0: f.r + 1.1 + n * 0.10, r1: f.r,
                   t: 0, max: 0.15 + n * 0.01, d: d.i * d.stag }, 64);
    /* the pips go out. crit-eng-ill #4: the design said drawStacks
       runs after the close on the same frame so this is "a comparison
       against RT.t". It does not: famEffect runs, f.stacks is zeroed
       by the wax and reassigned by the filter, all inside the same
       synchronous live.forEach, long before draw() is next called, so
       by the time drawStacks runs the cells do not exist and the row
       has reflowed. Capture the count HERE, where `match` has not been
       spent, as a short-lived per-foe transient in the house _ idiom,
       and let drawStacks paint n ghost cells to the right of the live
       row while it lasts. In SECONDS, not frames. */
    g.pip = { n: n, t: 0.05 };
    g.n = n;                                      // the thaw reads it for the crack count
    if (g.seed == null) g.seed = irnd(0, 100000);
    /* t = 0.02, the matter, and its velocities are backwards from
       every other burst in the file: a third of snapStacks' speed, a
       fifth of its upward push, a sixth of the gravity and twice the
       life. It barely leaves and then hangs there, settling. -eat
       throws sparks; -ill leaves motes still drifting down a second
       later when the fight has moved on, and that residue is the most
       important texture in the family because it is the only one that
       persists long enough to be seen out of the corner of the eye.
       Emitted up the body rather than at the feet, so the shape of the
       thing is briefly described by where the ice came off it. */
    mo = fxBudget(Math.min(18, Math.round(4 + n * 1.8)), d.wide, 72);
    for (i = 0; i < mo; i++) {
        sp = rnd(0.15, 0.8);
        part({ x: f.x, y: f.y, z: 6 + rnd(0, h * 0.8),
               vx: Math.cos(i * 2.399) * sp, vy: Math.sin(i * 2.399) * sp,
               vz: rnd(4, 30), grav: i < 2 ? 0 : 22, fr: i < 2 ? 1.6 : 0,
               life: i < 2 ? rnd(1.0, 1.5) : rnd(0.55, 1.2),
               size: i < 2 ? rnd(4, 6) : (Math.random() < 0.5 ? 2 : 4),
               col: ILL_DUST, add: 0, sh: 2 });
    }
    /* crit-art-ill #22: two per batch never fall. They hold their z
       and go out where they are. Ice fog, grav 0, one flag, and it is
       the only thing in the game that hangs. That is the i < 2 arm. */

    /* THE WORD, and only the four biggest piles get one.
       crit-art-ill #17: a3Mark puts an -ill stack on 25 folk, and
       twenty-five held STILLs against a 60-typo cap that also holds
       twenty-five damage numbers is not twenty-five times one STILL,
       it is a wall. Everybody else gets the body, the pool and the
       bar, and the square gets ONE STILL in screen space over it. */
    if (st.wordN < 4) {
        st.wordN++;
        fxPush(st.a, { k: 'word', x: f.x, y: f.y, z: h + 30, n: n,
                       px: Math.min(24, 12 + n * 1.4),
                       rim: clamp((n - 2) / 4, 0, 1) * 0.5,      // continuous, not a binary gate at n>=4
                       t: 0, max: 0.57, d: d.i * d.stag }, 16);
    }
}
/* THE WORD DOES NOT MOVE. STILL at min(24, 12 + 1.4n) px in
   ILL_RIME, at full size on frame one, held for 0.45s and then gone
   over 0.12s by dropping alpha only. No pop scale-in, no drift.
   THE DROP SHADOW OFFSETS UP. For this family alone: the hard copy
   goes to (-1, -1) and the rime rim to (1, 1). A body lit by a lamp
   that is on the ground. One sign flip, and it is the only lighting
   cue in the family.
   AND THE SCALING CHANNEL THIS GAME IS UNIQUELY ENTITLED TO: one 1px
   frost spur per closed stack, rising off the cap height of the word,
   capped at eight. The player can COUNT them. This is a game about
   counting syllables. Counting beats measuring, and it costs n
   fillRects. */
function drawIllWord(cx, o, k) {
    var sx = Math.round(punchWX(isoX(o.x, o.y))), sy = Math.round(punchWY(isoYA(o.x, o.y) - o.z));
    var a = k < 0.79 ? 1 : clamp((1 - k) / 0.21, 0, 1), i, n = Math.min(8, o.n), w, sx0;
    cx.save(); cx.textAlign = 'center'; cx.globalAlpha = a;
    cx.font = 'bold ' + Math.round(o.px) + 'px "Press Start 2P", monospace';
    w = cx.measureText('STILL').width;
    cx.fillStyle = '#08060c'; cx.fillText('STILL', sx - 1, sy - 1);
    cx.fillStyle = partCol(ILL_GLOWR, o.rim); cx.fillText('STILL', sx + 1, sy + 1);
    cx.fillStyle = ILL_RIME; cx.fillText('STILL', sx, sy);
    cx.fillStyle = ILL_RIME;
    sx0 = Math.round(sx - w / 2);
    for (i = 0; i < n; i++)
        cx.fillRect(sx0 + Math.round(i * w / Math.max(1, n)) + 1, Math.round(sy - o.px) - 4, 1, 4);
    cx.restore(); cx.textAlign = 'left';
}
/* THREE ARCS WITH TWO-PIXEL GAPS, and the gaps stay put as it closes.
   1px stroke, integer-snapped, on the 1:0.5 ground plane. */
function drawIllRing(cx, o, k, held) {
    var r = (held ? o.r0 : lerp(o.r0, o.r1, 1 - (1 - k) * (1 - k))) * TILE_W / 2, i, a0;
    cx.save();
    cx.translate(Math.round(isoX(o.x, o.y)), Math.round(isoYA(o.x, o.y)));
    cx.scale(1, 0.5);
    cx.strokeStyle = partCol(ILL_COLR, held ? 0.9 : 1 - k * 0.3); cx.lineWidth = 2;
    for (i = 0; i < 3; i++) {
        a0 = i * TAU / 3;
        cx.beginPath(); cx.arc(0, 0, Math.round(r), a0 + 0.12, a0 + TAU / 3 - 0.12); cx.stroke();
    }
    cx.restore();
}

/* pxShade hands back 'rgb(r,g,b)' and pxPal is half full of them, and
   hex2rgb opens with `if (h.charAt(0) !== '#') return '200,200,200'`.
   So a coldPal written the obvious way silently turns the coat
   shadow, the trim light, the skin shade, the hair light and the
   boots of EVERY archetype into one identical mid-grey before the
   cold remap: the frozen figure loses exactly the five values that
   give it shading, which is the one thing the repalette promises it
   keeps. The design's worked example only used the three literal
   hexes, so the failure was invisible in the doc and unmissable on
   screen. crit-eng-ill #1. */
function palRgb(v) {
    if (v.charAt(0) === '#') return hex2rgb(v);
    return v.slice(v.indexOf('(') + 1, v.lastIndexOf(')'));
}
/* Throw away hue, keep luma, remap onto a cold ramp. The Hearsay's
   coat #7d7086 (luma 118) becomes rgb(93,121,154); skin #d8b48c
   (186) becomes rgb(140,180,220); the white #efe9f4 (235) becomes
   rgb(174,222,255). The figure keeps its own shape, its own shading
   and its own read, and has plainly stopped being a colour. */
function coldPal(pal, lift) {
    var out = {}, k, v, l;
    for (k in pal) if (pal.hasOwnProperty(k)) {
        v = palRgb(pal[k]).split(',');
        l = (+v[0] * 0.30 + +v[1] * 0.59 + +v[2] * 0.11);
        if (lift) l = l + (255 - l) * lift;
        out[k] = 'rgb(' + Math.round(clamp(l * 0.70 + 10, 0, 255)) + ',' +
                          Math.round(clamp(l * 0.86 + 20, 0, 255)) + ',' +
                          Math.round(clamp(l * 0.98 + 38, 0, 255)) + ')';
    }
    return out;
}
/* the bake key for one body's own look. Folk carry coat, skin and
   seat in theirs, which is why the square can hold up to 25 distinct
   keys; everything else is its archetype. */
function foeKey(f) {
    if (!f.def.folk) return f.def.draw;
    if (f._fv == null) f._fv = Math.abs(Math.round(f.x * 7 + f.y * 3));
    return 'folk' + (f.isHal ? 'H' : (f._fv % 6) + '.' + ((f._fv >> 1) % 4)) + (f.seat ? 'S' : 'U');
}
/* crit-eng-ill #15: a3Mark puts an -ill stack on all 25 folk, one `5`
   closes all 25, and folk bake keys carry coat, skin and seat, so
   this would add three coats to each: 75 bake() calls in one frame,
   about 13,500 fillRects and 75 canvas allocations, landing on the
   single most important frame in the game beside 25 detonations and
   300 particles. startBuildBudget / mayBuild exist because "entering
   the square used to build every sprite at once, 150ms, nine dropped
   frames, at the moment the place is supposed to open up". Behind the
   budget, exactly as drawProp does, with the flat tint as the
   one-frame fallback.
   .ice2 is skipped for folk entirely: hurtFoe returns 0 for folk so a
   folk can never be executed, and the second palette would be 48 dead
   canvases. */
/* `force` is the execute's, and it is not a convenience.
   startBuildBudget() opens a five millisecond window at the top of
   draw(), and illExec runs from famEffect, which runs from doRhyme,
   which runs on a KEYDOWN. By then the last draw() is most of a frame
   old, so mayBuild() is false almost every time and both of the bakes
   illExec's own comment calls "forced HERE, while the rows are still
   reachable" were quietly declining to happen. The body is spliced out
   of RT.foes on the next stepFoes, so there is no later frame in which
   to try again: the halo and every shard then look up a canvas nothing
   ever made and the whole set piece is a held ring and no body.
   Forcing is correct here in a way it would not be in a drawer. This
   is one bake, twice, on a thing the player did, once per execute. The
   budget exists to stop a frame baking forty props it happened to walk
   past, not to stop the game drawing the payoff of a keypress. */
function icy(f, force) {
    var d = foeSil(f.def.draw); if (!d || d.noMask) return null;
    var k = 'ice.' + foeKey(f) + (f._exec ? '.2' : '');
    if (SPR[k]) return SPR[k];
    if (!force && !mayBuild()) return null;
    return bake(k, d.rows, coldPal(FOE_PAL[f.def.draw] || FOE_PAL.mouth, f._exec ? 0.72 : 0));
}
/* THE RIME, IN TWO COATS, GROWING FROM THE BOTTOM UP.
   crit-art-ill #10: coat 1 maps only the outline character `o` and
   the design faded it to alpha 1, and on a 36x24 Hearsay the outline
   is a large fraction of the painted pixels with every interior
   outline being `o` too, so at alpha 1 that is a near-white wireframe
   of the whole figure, brighter in total than the flat 45% rect it
   replaces. Coat 1 caps at 0.55 and coat 2, which covers far fewer
   pixels, runs to 0.85. And they grow as ONE CLIP RECT CLIMBING THE
   SPRITE BOX rather than as a uniform alpha ramp: cold comes off the
   ground, it costs one rect/clip on a blit, it makes the growth timer
   spatial instead of alpha-only, and alpha-only growth is invisible
   at twenty-five bodies while a rising line is not. Both coats are
   source-over, never lighter: additive frost blows the figure out to
   a white blob and loses the silhouette, which is the exact failure
   of the thing being replaced.
   crit-eng-ill #21: DRONER_SPR's top row is 'mmmmmm' with no outline,
   so coat 1 leaves the bell bare and coat 2, which includes m,
   catches it. That is correct and worth keeping. */
function rimeSpr(f, coat, force) {
    var d = foeSil(f.def.draw); if (!d || d.noMask) return null;
    var k = 'rime' + coat + '.' + f.def.draw, pal = {}, i, j, ch;
    if (SPR[k]) return SPR[k];
    if (!force && !mayBuild()) return null;
    for (i = 0; i < d.rows.length; i++)
        for (j = 0; j < d.rows[i].length; j++) {
            ch = d.rows[i].charAt(j);
            if (ch === '.') continue;
            if (coat === 1 ? ch === 'o' : (ch === 'o' || ch === 'm' || ch === 'b' || ch === 'k'))
                pal[ch] = ILL_RIME;
        }
    return bake(k, d.rows, pal);
}
/* Drawn inside drawFoe's body transform, in place of the flat 45%
   #cfeeff rect, which is the same rectangle as the hit flash over a
   sprite that has a silhouette. Pure: everything it reads was written
   by stepIll. The BODY itself is not drawn here at all: drawFoe swaps
   its drawer for a static blit of the repaletted bake, which is how
   the held pose arrives for free. */
function illBody(cx, f, h, sx, sy) {
    var g = famBag(f, 'ill'), i, n, a, spr, m = (f.frozenM || f.frozen || 1);
    var age = clamp(1 - f.frozen / m, 0, 1), grow = clamp(age / 0.22, 0, 1);
    var top = Math.round(-h * grow), fz = T('illFreeze');
    if (f._exec) grow = 1;
    for (i = 1; i <= 2; i++) {
        spr = rimeSpr(f, i);
        if (!spr) {
            if (i === 1) { cx.globalAlpha = 0.34 * fz; cx.fillStyle = '#cfeeff';
                           cx.fillRect(-f.r * 22, -h, f.r * 44, h * grow); cx.globalAlpha = 1; }
            continue;
        }
        cx.save();
        cx.beginPath(); cx.rect(-f.r * 24, top, f.r * 48, -top + 2); cx.clip();
        cx.globalAlpha = (i === 1 ? 0.55 : 0.85) * grow * fz;
        blit(cx, spr, 0, 0);
        cx.restore();
    }
    /* THE THAW. Today it does not exist: the tint just stops. The last
       0.28 seconds get one to three cracks appearing one at a time,
       each a 1px line across the sprite box at an angle seeded off
       frac() so it is stable frame to frame. */
    if (f.frozen < 0.28 && !f._exec) {
        n = clamp(1 + Math.floor((g.n || 1) / 3), 1, 3);
        for (i = 0; i < n; i++) {
            if (f.frozen > 0.28 - (i + 1) * (0.28 / n)) continue;
            a = frac((g.seed || 1) + i * 5.7) * Math.PI;
            cx.strokeStyle = partCol(ILL_RIME_RGB, 0.8); cx.lineWidth = 1;
            cx.beginPath();
            cx.moveTo(-Math.cos(a) * f.r * 22, -h * 0.5 - Math.sin(a) * h * 0.5);
            cx.lineTo(Math.cos(a) * f.r * 22, -h * 0.5 + Math.sin(a) * h * 0.5);
            cx.stroke();
        }
    }
    /* THE CAESURA BAR. crit-art-ill #5: the design correctly
       identifies the full stop as its best idea and then uses it
       exactly once in five moments, while f.frozen gets its identity
       from the generic bit. A frozen foe carries a 2px #c8f0ff
       vertical caesura bar floating beside its head for the whole
       duration. One fillRect. It survives twenty-five enemies, it
       distinguishes frozen from silenced at a glance, and it puts the
       game's best existing idiom in permanent service instead of in a
       two-frame cameo. THAT, not the hexagon, is -ill's shape. */
    cx.fillStyle = FAMS.ill.glow;
    cx.fillRect(Math.round(f.r * 22 + 4), Math.round(-h - 2), 2, Math.round(h * 0.34));
}

/* THE EXECUTE. Under 18% hp a closed -ill kills. Today it prints
   STILL and nothing else.
   THE EXECUTE PRINTS NO WORD OF YOURS AT ALL. crit-art-ill #4 caught
   the design cancelling its own best sentence: the executed foe's cut
   is its own last word, uncut, with the bar after the last letter,
   which is the best line of fiction available anywhere in this job,
   because the sound that ends the ballad is the only sound that lets
   anything finish speaking, and then two lines later it prints STILL
   at 13px over the corpse, which is talking over it. The close says
   STILL. The execute says nothing. Silence is the payoff for the
   family of silence.
   FOLK DO NOT SHATTER. crit-art-ill #20: at the climax the player is
   asked to close -ill on twenty-five seated neighbours, and the
   family's set piece explodes a person into thirty pieces of
   themselves. The body stops, the frost climbs, the cut line
   finishes, and they stay standing. Nobody breaks. It is one branch,
   it is far more disturbing than the shatter, and it means the
   shatter stays reserved for the things that were coming for you. */
function illExec(f, n) {
    var st = fxOf('ill'), g = famBag(f, 'ill'), h = foeH(f);
    if (g.seed == null) g.seed = irnd(0, 100000);
    st.execN = (st.execN || 0) + 1;
    /* crit-eng-ill #3 is the finding that decides where all of this
       can run from: ents skips corpses and stepFoes splices them out
       the next frame, so from the instant of the execute drawFoe is
       never called for that body again. Both bakes are forced HERE,
       while the rows are still reachable, or the halo and every shard
       would look up a canvas nothing ever made. They cool as they
       fall, so the shatter needs the plain .ice as well as the .2. */
    icy(f, 1); f._exec = 0; icy(f, 1); f._exec = 1;
    rimeSpr(f, 1, 1); rimeSpr(f, 2, 1);          // the shatter wears both coats
    /* t = 0, the stop. One held ring at f.r + 0.4 tiles, three arcs
       with gaps, which does not expand and does not contract: every
       other ring in the game moves and this one is nailed to the
       floor. One source-over blit of the same sprite at 1.35x and
       0.55 in ILL_RIME for 0.03 real seconds, not "two frames": a
       halo in the exact shape of the thing that just died. */
    fxPush(st.a, { k: 'held', x: f.x, y: f.y, r0: f.r + 0.4, r1: f.r + 0.4,
                   t: 0, max: T('illExecHold') + 0.5 }, 32);
    fxPush(st.a, { k: 'halo', x: f.x, y: f.y, h: h, kind: f.def.draw, key: foeKey(f),
                   t: 0, max: 0.03 }, 16);
    /* The punch is BANKED here and spent once, in illFrame. famEffect
       is called per foe out of three separate loops (doRhyme's
       live.forEach, stepReprise and stanzaWave), so a punch() on this
       line is one call per executed body per frame rather than one per
       thing the player did, which is the case 2.10's closed call-site
       table and risk 5 were both written against. A Stanza III over a
       worn crowd executes six people on one frame; six punches is six
       chances to take the max of the same number and one guaranteed
       reading of the shake phase reset. Bank the largest pile and the
       last position, and let the frame spend it. */
    st.exBank = Math.max(st.exBank || 0, n);
    st.exX = f.x; st.exY = f.y;
    fxSfx('illexec');
    if (f.def.folk) return;
    /* t = 0.12, the shatter, AND IT THROWS THE FOE'S ACTUAL PIXELS.
       The body is a baked canvas in SPR and drawImage takes a source
       rect, so a shard is drawImage(spr, sx0, sy0, 6, 6, dx, dy,
       6, 6): one call, no allocation, no path, no colour parse. A
       26-shard body is cheaper per frame than 26 particles and it is
       made of the enemy instead of made of squares. */
    fxPush(st.a, { k: 'break', x: f.x, y: f.y, h: h, kind: f.def.draw, key: foeKey(f),
                   seed: g.seed, t: 0, max: T('illExecHold') }, 16);
}
/* Occupancy comes from the row strings, not from getImageData.
   crit-eng-ill #14: a readback on a canvas Chrome has promoted to the
   GPU forces a sync, on the frame that also sets the longest hitstop
   in the game and resolves the whole detonation, and bake returns
   only a canvas so there is nowhere to cache it. foeSil's lo/hi
   already ARE the occupancy map, computed once at first use, and a
   cell is occupied if any row it covers has lo <= c <= hi.
   MULTIPLE EXECUTES: the shard cell grows to 8px at three or more
   simultaneous executes and 10px at five or more, cutting a Deaf from
   36 shards to 20 to 14. The stop gets longer, the pieces get
   chunkier, and the frame cost stays flat: six simultaneous executes
   cost about 2.4 times one, not six times. X is resolved AFTER the
   loop, and the shard cell is decided at t = 0.12 anyway, so it can
   read the final count. */
function illShatter(o) {
    var st = fxOf('ill'), d = foeSil(o.kind), X = st.execN || 1;
    var cell = X >= 5 ? 10 : X >= 3 ? 8 : T('illShard');
    var cols, rows, r, c, r0, c0, occ, i, low, n = 0;
    if (!d) { o.done = 1; return; }
    cell = Math.max(2, Math.round(cell));
    cols = Math.ceil(d.w / cell); rows = Math.ceil(d.h / cell);
    for (r = 0; r < rows; r++) for (c = 0; c < cols; c++) {
        occ = 0;
        for (i = 0; i < cell / PXS; i++) {
            r0 = Math.floor((r * cell) / PXS) + i;
            if (r0 >= d.rows.length) break;
            c0 = Math.floor((c * cell) / PXS);
            if (d.lo[r0] >= 0 && c0 >= d.lo[r0] && c0 <= d.hi[r0]) { occ = 1; break; }
        }
        if (!occ) continue;
        low = r === rows - 1;
        n++;
        /* SHARDS CARRY WORLD TILES AND z, like every other piece of
           matter. crit-art-ill #15: screen-space shards do not sort
           against bodies, fly over houses they should be behind, and
           the ones that stick lie on the SCREEN and slide across the
           square as the camera eases, which is the bug the camera
           comment is the history of. vx/vy in tiles/s, vz and grav in
           px, converted at draw, and the anchor reconstructs blit's
           own rounding through silX/silY: get it wrong by a pixel and
           the body visibly jumps on the frame it shatters. */
        fxPush(st.sh, { x: o.x, y: o.y, z: d.h - r * cell,
                        sx0: c * cell, sy0: r * cell, cell: cell,
                        ox: c * cell + d.dx - d.w / 2,
                        vx: rnd(-1.6, 1.6), vy: rnd(-1.6, 1.6), vz: rnd(40, 150),
                        /* GRAVITY 330 against the particle system's
                           130. Ice is heavy, the shards are down
                           inside 0.4s, nothing floats. ONE SHARD LANDS
                           LATE: the bottom-row shard gets life * 1.6
                           and grav * 0.7. Something always hits the
                           ground a quarter of a second after
                           everything else. */
                        grav: low ? 231 : 330, bounce: 0,
                        flip: irnd(0, 3),          // four flips, no rotation. No interpolation.
                        key: o.key, kind: o.kind,
                        t: 0, max: (low ? 1.6 : 1) * rnd(0.7, 1.0) }, 120);
    }
    if (n) fxSfx('illshatter');
    o.done = 1;
}
/* They cool as they fall: drawn from .ice2 for their first 0.12s and
   from .ice after. Two canvas references and one boolean compare per
   shard, and it is the detail that will make people rewatch it.
   They grind, in steps, and they tumble by flipping. crit-art-ill
   #16: shrinking a 6px destination continuously to 2px with
   nearest-neighbour resamples a different subset of source pixels
   every frame, which is not grinding away, it is a 3px square
   strobing. Snapped to 6, 4, 2, each stable for its own stretch,
   destination coordinates rounded. */
function drawIllShard(cx, s) {
    var spr = SPR['ice.' + s.key + '.2'], k = clamp(s.t / s.max, 0, 1);
    var dst = k < 0.45 ? s.cell : k < 0.78 ? Math.max(2, s.cell - 2) : 2;
    var dx, dy, fx, fy;
    if (s.t >= 0.12 || !spr) spr = SPR['ice.' + s.key] || spr;
    if (!spr) return;
    dx = Math.round(isoX(s.x, s.y) + s.ox);
    dy = Math.round(isoYA(s.x, s.y) - s.z);
    fx = (s.flip & 1) ? -1 : 1; fy = (s.flip & 2) ? -1 : 1;
    cx.save();
    cx.translate(dx + dst / 2, dy + dst / 2); cx.scale(fx, fy);
    cx.drawImage(spr, s.sx0, s.sy0, s.cell, s.cell, -dst / 2, -dst / 2, dst, dst);
    cx.restore();
}
/* THE POOL OF LAMPLIGHT WITH NO LAMP IN IT: a flat 1:0.5 ellipse of
   cold light with a hard dark bite out of the middle where the lamp
   should be. Ground-plane doctrine, one new shape, and it says
   somebody stopped here and put the light down. crit-art-ill #1
   asked the family to stop being Ice and be HER sound, and this is
   the sentence that does it. */
function drawIllPool(cx, f) {
    var sx = Math.round(isoX(f.x, f.y)), sy = Math.round(isoYA(f.x, f.y));
    var r = f.r * 26;
    cx.save(); cx.translate(sx, sy); cx.scale(1, 0.5);
    cx.globalCompositeOperation = 'lighter';
    cx.fillStyle = partCol(ILL_COLR, 0.13);
    cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill();
    cx.globalCompositeOperation = 'source-over';
    cx.fillStyle = '#07060a';
    cx.beginPath(); cx.arc(-r * 0.28, -r * 0.1, r * 0.34, 0, TAU); cx.fill();
    cx.strokeStyle = partCol(ILL_GLOWR, 0.45 * T('vfxRimGround')); cx.lineWidth = 2;
    cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.stroke();
    cx.restore();
}
/* THE BOARD-WIDE STATEMENT, which the design did not contain.
   crit-art-ill #17: one STILL in screen space over a square of
   quietly frosting people. It is FAM_LINE.ill, the family's one
   gesture on the assembled line, and it is the only FAM_LINE row of
   the five that draws a word: the line's own rule grows eight 1px
   frost spurs off its upper edge, one per syllable up to eight, and
   the tally under it goes still. */
function illLine(cx, d, k, x, y, w) {
    var n = Math.min(8, (d && d.best) || 1), i, x0 = Math.round(x - w / 2);
    cx.save();
    cx.fillStyle = partCol(ILL_COLR, 0.9);
    cx.fillRect(x0, Math.round(y) + 1, Math.round(w), 2);
    cx.fillStyle = ILL_RIME;
    for (i = 0; i < n; i++)
        cx.fillRect(x0 + Math.round((i + 0.5) * w / n), Math.round(y) - 4, 1, 5);
    cx.restore();
}
/* The flag the FAM_LINE contract says may be hung on the function
   object, hung on it. detJolt returns 0 for a family whose line is
   `still` and the press marks stay struck, which is the whole of -ill
   in one boolean: four families' lines bounce when the room takes the
   hit and this one does not move at all.
   It has to live HERE, on the function, and not as a row on the
   registry, because regFam stores r.line straight into FAM_LINE[id].
   The three readers were written against FAM_LINE[d.fam].still, which
   is a property lookup on a function object, so the flag was
   unsettable from the registry and the family that is named for
   holding still was the only one that jolted. */
illLine.still = 1;

/* ALL MATTER ON THE SIM CLOCK, ALL TYPOGRAPHY ON THE REAL CLOCK. */
function stepIll(dt, real, st) {
    var i, o, F = RT.foes, f, g, any = 0, live = [];
    for (i = st.a.length - 1; i >= 0; i--) {
        o = st.a[i];
        o.t += (o.k === 'word' || o.k === 'fizz') ? real : dt;
        if (o.k === 'break' && !o.done && o.t >= o.max) illShatter(o);
        if (o.t >= (o.d || 0) + o.max) st.a.splice(i, 1);
    }
    for (i = st.sh.length - 1; i >= 0; i--) {
        o = st.sh[i]; o.t += dt;
        if (o.t >= o.max) { st.sh.splice(i, 1); continue; }
        if (o.bounce >= 2) continue;               // after the second bounce it sticks
        o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt; o.vz -= o.grav * dt;
        if (o.z < 0) { o.z = 0; o.vz *= -0.22; o.vx *= 0.55; o.vy *= 0.55; o.bounce++; }
    }
    if (st.lamp > 0) st.lamp = Math.max(0, st.lamp - real);
    for (i = 0; i < F.length; i++) {
        f = F[i]; if (!f || f.dead) continue;
        g = f._fx && f._fx.ill;
        if (f.frozen > 0) {
            any = 1; live.push(f);
            if (!g) g = famBag(f, 'ill');
            if (g.seed == null) g.seed = irnd(0, 100000);
            if (!g.was) { g.was = 1; g.n = g.n || 1; }
            /* the contact shadow tightens and darkens over the freeze,
               through 3.0.6's channel. A thing that has stopped is
               pinned to the floor. */
            var m = (f.frozenM || f.frozen || 1), age = clamp(1 - f.frozen / m, 0, 1);
            f.csr = 1 - 0.25 * age; f.csa = 0.42 + 0.16 * age;
        } else if (g && g.was) {
            /* THE CROSSING IS LATCHED IN THE STEPPER, not in drawFoe.
               crit-eng-ill #23: devDemo calls draw() by hand to step
               frames for headless capture, so a zero-crossing detected
               in a drawer fires the sound from a draw function and can
               be double-fired by a second pass.
               f.wob = 0.35 is the existing hit-recoil sine, so the
               body shudders back to life using machinery that is
               already there. */
            g.was = 0; f.wob = 0.35; f.csr = null; f.csa = null;
            burst(f.x, f.y, foeH(f) * 0.5, 8, { col: ILL_DUST, add: 0, sp0: 0.1, sp1: 0.6,
                                                l0: 0.4, l1: 0.9, grav: 200, sh: 2 });
            fxSfx('illthaw', 0.05);
        }
        if (g && g.pip) { g.pip.t -= real; if (g.pip.t <= 0) g.pip = null; }
    }
    /* THE RESIDUE IS ONE MOTE PER FRAME, BOARD-WIDE. crit-art-ill #18:
       one mote per 0.5/(0.6+0.12n) seconds PER FROZEN BODY for up to
       three seconds is roughly 280 particles from this layer alone at
       eight foes, and twenty-five frozen folk emit continuously. A
       single module index walks the frozen foes and emits one mote per
       frame total, distributed round-robin. Visually identical, and it
       is sixty particles a second however many bodies are standing
       there. */
    st.res = (st.res || 0) + dt * 60 * T('illResidue');
    if (any && st.res >= 1) {
        st.res = 0;
        st.ri = ((st.ri || 0) + 1) % live.length;
        f = live[st.ri];
        part({ x: f.x + rnd(-.3, .3), y: f.y + rnd(-.3, .3), z: rnd(2, foeH(f)),
               vx: 0, vy: 0, vz: rnd(-2, 2), life: rnd(0.6, 1.2),
               size: (st.ri & 1) ? 2 : 4, col: ILL_DUST, add: 0, grav: 10, fr: 1.2, sh: 2 });
    }
    /* and it stays down while anything on the board is frozen. Nothing
       else in the game dims your own light. */
    if (any) st.lamp = Math.max(st.lamp, 0.05); else st.execN = 0;
    // the banked execute, spent once for however many bodies stopped
    if (st.exBank) {
        punch({ fam: 'ill', power: st.exBank, kind: 'kill', x: st.exX, y: st.exY });
        st.exBank = 0;
    }
}
function drawIllWorld(cx, dt, st) {
    var i, o, k, F = RT.foes, f;
    for (i = 0; i < st.a.length; i++) {
        o = st.a[i];
        if (o.t < (o.d || 0)) continue;
        k = clamp((o.t - (o.d || 0)) / o.max, 0, 1);
        if (o.k === 'ring') drawIllRing(cx, o, k, 0);
        else if (o.k === 'held') drawIllRing(cx, o, k, 1);
        else if (o.k === 'word') drawIllWord(cx, o, k);
        else if (o.k === 'halo') drawIllHalo(cx, o, k);
        else if (o.k === 'fizz') drawIllFizz(cx, o, k);
    }
    for (i = 0; i < st.sh.length; i++) drawIllShard(cx, st.sh[i]);
    for (i = 0; i < F.length; i++) {
        f = F[i];
        if (f && !f.dead && f.frozen > 0) drawIllPool(cx, f);
    }
}
function drawIllHalo(cx, o, k) {
    var spr = SPR['ice.' + o.key + '.2'] || SPR['ice.' + o.key];
    if (!spr) return;
    var sx = isoX(o.x, o.y), sy = isoYA(o.x, o.y);
    cx.save(); cx.globalAlpha = 0.55 * (1 - k);
    cx.translate(sx, sy); cx.scale(1.35, 1.35);
    blit(cx, spr, 0, 0);
    cx.restore();
}
function drawIllFizz(cx, o, k) {
    var sx = isoX(o.x, o.y), sy = isoYA(o.x, o.y) - 24;
    cx.save(); cx.textAlign = 'center';
    cx.globalAlpha = (1 - k) * 0.5;
    cx.font = 'bold 11px "Press Start 2P", monospace';
    cx.fillStyle = FAMS.ill.col; cx.fillText(o.w, sx, sy);
    cx.restore(); cx.textAlign = 'left';
}
/* foeDie's own grey 16-particle cloud is suppressed: it is a
   different material, it is grey, and it lands on top of the one
   moment in the game that has a material of its own. */
function illFin(f) {
    if (!f._exec) return 0;          // a frozen foe finished by something else still gets the grey cloud
    return 1;
}
regFam('ill', {
    call: ILL_CALL, pip: illPip, sour: illSour, det: illDet, st: illBody,
    fin: illFin, line: illLine,
    ord: 50, cap: 96, step: stepIll, draw: drawIllWorld,
    make: function () { return { a: [], sh: [], wordN: 0, lamp: 0, res: 0, ri: 0, execN: 0 }; }
});

/* the cut-off line left behind by a death. The word is drawn, then the
   canvas is clipped mid-letter and a hard caesura bar sits on the cut:
   a sentence stopped in the middle, which is what happened to her. */
function drawCuts(cx, dt) {
    var c2 = RT.combat.cuts;
    for (var i = c2.length - 1; i >= 0; i--) {
        var c = c2[i]; c.t -= dt;
        if (c.t <= 0) { c2.splice(i, 1); continue; }
        var k = 1 - c.t / c.max;
        var sx = isoX(c.x, c.y), sy = isoYA(c.x, c.y) - 34 - k * 16;
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
    // time thickens while a stanza writes itself, and stops dead when
    // something lands. RT.timeScale is the dev slider and stays out of it.
    var scale = RT.timeScale * (RT.dilate > 0 ? T('dilation') : 1) *
                (fxOf('punch').stop > 0 ? T('punchStopScale') : 1);
    step(real * scale, real);
    draw(real);
    RT.raf = requestAnimationFrame(frame);
}
function step(dt, real) {
    /* The play holds. Everything below this line is the performance, and
       none of it runs while you are standing in the wings.
       stepAudio is the one thing that carries on, and it is not optional:
       A.muted is cleared nowhere else, so skipping it makes the Sound row
       a one way trip. The house keeps its sound because an actor stepping
       off does not empty it. The guard is here rather than in frame()
       because devDemo and __ninth.tick both call step() and draw() by
       hand and never touch frame(), so a guard up there could not be
       tested by the only harness this project has. */
    if (RT.wings.on) {
        stepAudio(real || dt);
        /* The full screen row reads the shell's class, and the shell can be
           driven from outside this menu while it is open: F11 and the peeked
           title bar both still work. Nothing else re-fills the page, so
           without this the row sits there stating the opposite of the truth
           and its next press appears to do the wrong thing. */
        if (RT.wings.page === 'margins') {
            var fs = isWinFs();
            if (fs !== RT.wings.fsWas) { RT.wings.fsWas = fs; fillWings(); }
        }
        return;
    }
    RT.t += dt;
    RT.dilate = Math.max(0, RT.dilate - (real || dt));      // dilation runs on real time
    RT.mono = Math.max(0, RT.mono - (real || dt));
    /* The muzzle is on real time, and it used to be one line inside
       stepPlayer on the sim clock. Two things came of that. stepPlayer
       is not called while RT.dead, so the family-coloured flash at the
       mouth stopped dead the frame a Droner killed you and sat there
       over the body for the whole 2.2 second respawn. And on the sim
       clock a 0.13s flash lasts 0.43s inside a recital, which is the
       one place the arm is already doing something else. */
    if (RT.casting) { RT.casting.t -= (real || dt); if (RT.casting.t <= 0) RT.casting = null; }
    RT.callCd = Math.max(0, (RT.callCd || 0) - dt);
    RT.answerCd = Math.max(0, (RT.answerCd || 0) - dt);
    RT.swallowCd = Math.max(0, (RT.swallowCd || 0) - dt);
    RT.conceal = Math.max(0, (RT.conceal || 0) - dt);
    stepItems(dt);                                          // job 5: the wax goes cold, the shop closes behind you
    stepFx(dt, real);                                       // vfx: every registered effect, one call. Matter freezes, letters do not.
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
    /* shake() is a pure function returning a number and thirteen call
       sites write it back by hand, so the only signal a legacy shake
       can give us is that the amplitude went up. A rise is a new hit
       and a new hit gets a fresh direction and a phase starting at
       zero, or the second of a pair looks like the tail of the first.
       Anything that came through punch() set a direction already. */
    var pz = fxOf('punch');
    if (RT.shake > pz.was + 0.01 && !pz.fresh) punchDir(0, 0);
    pz.fresh = 0;
    /* These three used to decay on the sim clock, which stretched them
       3.3x inside a stanza by accident and, once there was a hitstop,
       would have frozen them solid at full amplitude for the length of
       the stop: a held wash is a strobe and a frozen fringe is a stuck
       misregistration. Real clock now, with the stanza stretch written
       down rather than inherited. Outside a recital this is
       arithmetically the line it replaces, in both directions. */
    var fade = (real || dt) * (RT.dilate > 0 ? T('dilation') : 1);
    RT.shake = Math.max(0, RT.shake - fade * 24 / (pz.ring || 1));
    RT.chroma = Math.max(0, RT.chroma - fade * 2.4);
    if (!pz.fhold) RT.flash = Math.max(0, RT.flash - fade * 2.2);
    /* Both pairs go back to the greys when their channel empties, or
       every legacy writer fringes and blooms in whatever family the
       last detonation left behind: get winded after an -ark close and
       WINDED splits violet, and the grey slant slam does not look
       grey. onChorusDown's bare RT.flash = 0.5 depends on the second
       of these for its warm white. */
    if (RT.chroma <= 0) { pz.ca = FAM_CHROMA.none[0]; pz.cb = FAM_CHROMA.none[1]; }
    if (RT.flash <= 0) { pz.fcol = FLASH0; pz.fbl = FAM_BLOOM.none; pz.bw = VW * 1.9; pz.bh = VW * 1.9 * 0.62; }
    pz.was = RT.shake;
    for (var i = RT.toasts.length - 1; i >= 0; i--) { RT.toasts[i].t -= (real || dt); if (RT.toasts[i].t <= 0) RT.toasts.splice(i, 1); }
    RT.hudT = (RT.hudT || 0) - (real || dt);
    if (RT.hudT <= 0) { RT.hudT = 0.05; updateHud(0.05); }
}
function draw(rdt) {
    /* The stage keeps the last thing it was. Returning here is the whole
       freeze frame: no snapshot, no second canvas. It also stops the
       shake jitter picking a new offset every frame over a still world,
       and stops drawTypo and drawSlams and drawLines draining the
       lifetimes of the letters they are drawing, which they do inside
       draw and not inside step. */
    if (RT.wings.on) return;
    // was hard-coded to 1/60: on a 144Hz screen every typographic
    // effect outlived its intent by more than double
    var cx = RT.cx, dt = Math.min(0.05, rdt || 1 / 60);
    var pf = fxOf('punch'), t0 = RT.dbgPerf ? performance.now() : 0;
    /* Three save/restore pairs now instead of one, so a throw anywhere
       inside leaks three levels of context state PER FRAME, forever,
       which is both a compounding transform and an unbounded internal
       stack. One idempotent line removes the whole class: a bad frame
       is still a bad frame and still gets noticed, but it cannot
       become every subsequent frame. */
    cx.setTransform(1, 0, 0, 1, 0, 0);
    startBuildBudget();
    cx.save();
    punchShakeXY(cx);
    cx.clearRect(-30, -30, VW + 60, VH + 60);
    /* The zoom opens here and shuts before the vignette, then opens
       again for the world-space effects. Two pairs rather than one
       because drawVignette belongs to the eye: scaling it scales the
       frame around the picture, which is the exact bug the comment
       above it was written for. Everything between them is world and
       wants the zoom; everything after the second close is a full
       screen wash and would be wrong inside it. The clearRect stays
       OUTSIDE, in shake space, at the size it already is, because
       zooming in shrinks what has to be cleared. */
    cx.save(); punchZoom(cx);
    var fl = buildFloor(place().floor, pw(), ph()), c0 = cam();
    cx.fillStyle = '#07060a'; fullRect(cx);
    cx.drawImage(fl.cv, Math.round(fl.box.x - c0.x), Math.round(fl.box.y - c0.y));
    // during a recital the world drains away until the letters are the only light
    if (RT.dilate > 0) {
        cx.fillStyle = 'rgba(6,4,10,' + (0.55 * clamp(RT.dilate / T('dilationT'), 0, 1)).toFixed(3) + ')';
        fullRect(cx);
    }
    drawExits(cx);
    drawLooks(cx);
    drawRings(cx, dt);
    if (RT.moveTo && !S.opts.wasd) {
        var mx = isoX(RT.moveTo.x, RT.moveTo.y), my = isoYA(RT.moveTo.x, RT.moveTo.y);
        cx.save(); cx.translate(mx, my); cx.scale(1, 0.5);
        cx.strokeStyle = 'rgba(200,190,220,.4)'; cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(0, 0, 7 + Math.sin(RT.t * 8) * 2, 0, TAU); cx.stroke(); cx.restore();
    }
    /* painter-sorted world. Props are IN this list now: they used to be
       two crude passes split on the player's depth alone, which is why
       every NPC and every foe drew straight through a house. */
    var ents = [];
    /* Only you. An NPC authored under a roof would hold the cutaway open
       for the whole scene, and a house that is permanently half there
       looks like a bug rather than a courtesy. Somebody standing in a
       place you can never see them is an authoring mistake, and the
       geometry audit is where that gets caught. */
    RT.rdt = dt;
    RT.hide = [{ x: RT.px, y: RT.py, k: RT.px + RT.py, h: 44 }];
    RT.marks = [];                                       // talk marks, drawn in screen space after the veil
    RT.foes.forEach(function (f) { if (!f.dead) ents.push({ k: f.x + f.y, fn: function () { drawFoe(cx, f); } }); });
    (place().npcs || []).forEach(function (id) { var n = NPCS[id]; if (n) ents.push({ k: npcX(n) + npcY(n), fn: function () { drawNpc(cx, n); } }); });
    (place().props || []).forEach(function (o, oi) {
        o._ci = oi;                                          // a stable handle for its cutaway fade
        ents.push({ k: o.b[0] + o.b[2] / 2 + o.b[1] + o.b[3] / 2, fn: function () { drawProp(cx, o); } });
    });
    ents.push({ k: RT.px + RT.py, fn: function () { drawActor(cx); } });
    // the lamp you set down. In the sort like everything else, so you can
    // walk behind it and it stays where you left it
    var myLamp = lampAt(RT.place);
    if (myLamp) ents.push({ k: myLamp.x + myLamp.y, fn: function () { drawSetLamp(cx, myLamp); } });
    ents.sort(function (a, b) { return a.k - b.k; });
    ents.forEach(function (e) { e.fn(); });
    drawLights(cx);
    cx.restore();                // /A. the vignette is the eye, not the world
    drawVignette(cx);
    cx.save(); punchZoom(cx);    // zoom block B
    drawCalls(cx);
    drawFproj(cx);
    drawParts(cx);
    drawCuts(cx, dt);            // job 4: the cut-off last line, world space
    drawSnaps(cx, dt);
    drawFx(cx, dt);              // vfx world seam. every registered world effect, one call. See regFx.
    drawTypo(cx, dt);
    cx.restore();                // /B
    drawBloom(cx);
    if (RT.hurt > 0 || RT.dead) { cx.fillStyle = 'rgba(150,10,25,' + (RT.dead ? 0.34 : RT.hurt * 0.3) + ')'; fullRect(cx); }
    drawTalkMarks(cx);
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
        fullRect(cx);
        cx.restore();
    }
    cx.restore();
    drawSlams(cx, dt);
    drawLines(cx, dt);
    drawBossBar(cx);
    drawToasts(cx);
    drawMap(cx);
    drawFxS(cx, dt);             // vfx screen seam, over everything, outside the shake
    if (RT.dbgPerf) {
        /* An overhaul this size needs an acceptance test and one line
           of counts was not one. ms is an exponential average so a
           single slow frame does not make the number unreadable. */
        pf.dms = pf.dms * 0.9 + (performance.now() - t0) * 0.1;
        cx.font = '11px monospace'; cx.fillStyle = '#9fe0c8';
        cx.fillText(RT.fps + ' fps · ' + pf.dms.toFixed(2) + ' ms · foes ' + RT.foes.length +
            ' · parts ' + RT.parts.length + ' · typo ' + RT.typo.length + ' · calls ' + RT.calls.length, 12, VH - 26);
        cx.fillText('stacks ' + boardTotal() + ' · snaps ' + RT.snaps.length + ' · rings ' + RT.rings.length +
            ' · cuts ' + RT.combat.cuts.length + ' · slams ' + RT.slams.length +
            ' | stop ' + pf.stop.toFixed(3) + ' · z ' + pf.z.toFixed(2) +
            ' · shake ' + RT.shake.toFixed(1) + ' · chroma ' + RT.chroma.toFixed(2) +
            ' · flash ' + RT.flash.toFixed(2), 12, VH - 12);
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
    var i, c, R, P, sx, sy, k;
    for (i = 0; i < RT.calls.length; i++) {
        c = RT.calls[i];
        R = FAM_CALL[c.fam] || FAM_CALL.none;
        P = fampx()[c.fam];
        /* -erd draws at its quantised position: the word advances in
           discrete jumps and holds dead still between them, which is
           the only thing in the game that moves that way. st starts at
           1 so the first step fires on frame ONE: design-proj started
           it at 0 with a 5.5/s accumulator, so the word was drawn in
           your hand for the first 182ms of a 577ms flight and at any
           range under 2.4 tiles it landed without ever visibly moving
           (crit-eng-proj 13). */
        sx = Math.round(isoX(R.step ? c.qx : c.x, R.step ? c.qy : c.y));
        sy = Math.round(isoYA(R.step ? c.qx : c.x, R.step ? c.qy : c.y));
        cx.save();
        /* THE GROUND MARK. One flat ellipse per call per frame on the
           ground plane at the standard 1:0.5, which is what makes the
           word feel like it is over the town rather than painted on
           the glass. What is IN it is the family's. */
        if (R.mark) {
            cx.save();
            cx.translate(sx, sy); cx.scale(1, 0.5);
            cx.lineWidth = 1;
            R.mark(cx, c, sx, sy, P);
            cx.restore();
        }
        /* THE HEAD, out in FRONT of the word rather than inside it.
           callHead put the head at cos(a)*9 from the centre of a
           centred string, and WHEAT at 12px is 60px wide, so the jaws,
           the chevron, the downbeat, the hole and the needle, which
           are the thing you identify a family by from the far corner,
           were all drawn on top of the third letter (crit-art-proj 7). */
        var wpx = 12 + c.couplet * 1.5 + c.near * 1.6;
        var hw = c.word.length * wpx * PSA * 0.5 + 6;
        var hx = Math.round(sx + Math.cos(c.sa) * hw);
        var hy = Math.round(sy - 26 - c.near * 3 + Math.sin(c.sa) * hw * 0.5);
        /* the shared light under every head: the ONE baked banded glow
           (2.6). design-proj drew a single alpha arc, which is a
           coloured coin with a hard edge, and declined RECON's baked
           sprite on the grounds that four arcs a frame is cheap. Cheap
           was not the objection: a flat disc is off model in both
           directions at once, neither a gradient nor banded
           (crit-art-proj 9). */
        glowAt(cx, P.grgb, hx, hy, 26 + c.couplet * 6, 26 + c.couplet * 6,
               0.26 + c.couplet * 0.14);
        cx.lineWidth = 1;                 // no family may raise it. See 4.9.3
        if (R.head) R.head(cx, c, hx, hy, P);
        /* THE WORD. Head dim, rhyming tail bright (4.0.1), so the
           mechanic is legible in the air before anything has landed.
           Hollow when you are out of breath. */
        cx.textAlign = 'center';
        cx.font = 'bold ' + wpx.toFixed(1) + 'px "Press Start 2P", monospace';
        k = Math.round(sy - 26 - c.near * 3);
        if (R.word) R.word(cx, c, sx, k, P);
        else if (c.thin > 0.6) rimeHollow(cx, c.word, sx, k, P, wpx);
        else {
            if (c.couplet) {              // double struck: a couplet is a word inked twice
                cx.globalAlpha = 0.55;
                rimeText(cx, c.word, sx - 1, k - 1, P, wpx);
                cx.globalAlpha = 1;
            }
            rimeText(cx, c.word, sx, k, P, wpx);
        }
        cx.restore();
    }
    cx.textAlign = 'left';
}
function drawFproj(cx) {
    for (var i = 0; i < RT.fproj.length; i++) {
        var p = RT.fproj[i], sx = isoX(p.x, p.y), sy = isoYA(p.x, p.y) - 24;
        cx.save(); cx.globalCompositeOperation = 'lighter';
        var g = cx.createRadialGradient(sx, sy, 1, sx, sy, 9);
        g.addColorStop(0, 'rgba(235,225,250,.9)'); g.addColorStop(1, 'rgba(150,140,190,0)');
        cx.fillStyle = g; cx.beginPath(); cx.arc(sx, sy, 9, 0, TAU); cx.fill(); cx.restore();
    }
}
function drawBossBar(cx) {
    var b = null; RT.foes.forEach(function (f) { if (f.def.boss && !f.dead) b = f; });
    if (!b) return;
    /* The Chorus is the only boss in the game and it used to get a grey
       progress bar. It gets the same gauge the player's own two do now:
       a name plate cut into the left of it, a notched fill, and a warning
       that is a lit plate rather than a line of loose orange text. */
    var w = 560, h = 24, x = Math.round((VW - w) / 2), y = 30, cap = 116;
    uiSheet(cx, x, y, w, h, { rule: '#5a2f34', face: '#0b0711', orn: '#c86a6a', drop: 4 });
    var ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
    cx.fillStyle = '#1d1424'; cx.fillRect(ix + cap, iy, iw - cap, ih);
    var k = clamp(b.hp / b.hpm, 0, 1), fw = Math.round((iw - cap) * k);
    var g = cx.createLinearGradient(0, iy, 0, iy + ih);
    g.addColorStop(0, '#e6d8ff'); g.addColorStop(0.16, '#9a86d8');
    g.addColorStop(0.6, '#5a4a8c'); g.addColorStop(1, '#2c2350');
    cx.fillStyle = g; cx.fillRect(ix + cap, iy, fw, ih);
    // the notches, so it reads as a gauge rather than as a slab
    cx.fillStyle = 'rgba(0,0,0,.55)';
    for (var n = ix + cap + 14; n < ix + iw; n += 16) cx.fillRect(n, iy, 2, ih);
    // the name plate
    cx.fillStyle = '#241a2e'; cx.fillRect(ix, iy, cap, ih);
    cx.fillStyle = UI_KEY; cx.fillRect(ix + cap - 2, iy, 2, ih);
    cx.fillStyle = 'rgba(255,255,255,.07)'; cx.fillRect(ix, iy, cap, 2);
    cx.save(); cx.textBaseline = 'alphabetic';
    cx.font = '8px "Press Start 2P", monospace'; cx.fillStyle = '#e6d8ff';
    cx.fillText(String(b.def.n).toUpperCase().slice(0, 13), ix + 9, iy + 12);
    cx.textAlign = 'right'; cx.fillStyle = '#f2ecff';
    cx.fillText(Math.max(0, Math.ceil(b.hp)) + '', ix + iw - 9, iy + 12);
    if (b.warn) {
        var ww = 396, wx = Math.round((VW - ww) / 2), wy = y + h + 12;
        uiSheet(cx, wx, wy, ww, 26, { rule: '#7a5a1c', face: '#2a1c06', orn: '#ffd06a', drop: 4 });
        cx.textAlign = 'center'; cx.font = '8px "Press Start 2P", monospace';
        cx.fillStyle = '#ffd06a';
        cx.fillText('PULSE INCOMING. SPEND YOUR STACKS.', VW / 2, wy + 17);
    }
    cx.restore(); cx.textAlign = 'left';
}
function drawToasts(cx) {
    for (var i = 0; i < RT.toasts.length; i++) {
        var a = RT.toasts[i], y = 72 + i * 52;
        var k = clamp(Math.min(a.t, 3.4 - a.t) / 0.35, 0, 1);
        cx.save(); cx.globalAlpha = k;
        /* It slides in from the trim rather than fading in place, and it
           is a sheet like everything else. The slide is 8 whole pixels in
           4 steps so it never lands between two of them. */
        cx.translate(Math.round((1 - k) * 3) * 4, 0);
        var x = VW - 306, w = 286, h = 44, tx = x + 32, tw = w - 44;
        uiSheet(cx, x, y, w, h, { rule: '#6d5a2c', face: '#120d19', drop: 5 });
        uiDiamond(cx, x + 17, y + 22, 5, '#ffe66e');
        cx.textBaseline = 'alphabetic';
        cx.font = '8px "Press Start 2P", monospace'; cx.fillStyle = '#ffe66e';
        cx.fillText(uiFit(cx, String(a.n).toUpperCase(), tw), tx, y + 19);
        cx.font = '13px "Pixelify Sans"'; cx.fillStyle = '#a99c8a';
        cx.fillText(uiFit(cx, a.d, tw), tx, y + 34);
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
    // S.call and S.answer were the verbs when this was written. They are not
    // any more: the line deals the word and the number row holds the sound,
    // so reading the old slots gave every Call, every landing and every
    // Answer in the game the -eat voice. Read what was actually said.
    if (kind === 'answer' || kind === 'slant') return RT && RT.lastRhyme || 'eat';
    return RT && RT.lastSaidFam || 'eat';
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
    var keys = rhymeKeys();
    // Built once, then updated in place. Rebuilding from innerHTML every time
    // the board count changed threw away hudNudge's `deny` flash mid
    // animation, and the board count changes several times a second in a
    // fight: the act's last-resort hint, which flashes the -ill pip and tells
    // you the key outright, never survived long enough to be seen.
    if (!rz.children.length) {
        rz.innerHTML = FAM_IDS.map(function (fam, i) {
            var f = FAMS[fam];
            return '<button class="nn-rh" data-nn="rhyme:' + fam + '" type="button" style="--wc:' + f.col +
                   '" title="' + esc(f.n + ' · ' + f.d) + '">' +
                   '<u>' + keys[i] + '</u><b>' + f.tag + '</b><span></span></button>';
        }).join('');
    }
    FAM_IDS.forEach(function (fam, i) {
        var b = rz.children[i]; if (!b) return;
        var have = rhymeReady(fam), n = have ? boardCount(fam) : 0;
        b.classList.toggle('off', !have);
        b.classList.toggle('live', !!n);
        var txt = have ? (n ? String(n) : '') : '';
        var sp = b.lastChild;
        if (sp && sp.textContent !== txt) sp.textContent = txt;
    });
}
function updateHud(dt) {
    if (!RT) return;
    var st = stats(), r = RT.root;
    var lf = r.querySelector('.nn-life');
    if (lf) {
        var lk = clamp(RT.hp / (RT.hpm || 1), 0, 1);
        lf.querySelector('i').style.width = (lk * 100) + '%';
        lf.classList.toggle('low', lk <= 0.34);
        lf.querySelector('.nn-life-t').textContent =
            Math.max(0, Math.ceil(RT.hp)) + ' / ' + Math.round(RT.hpm);
    }
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
    /* The map is painted on the canvas and the narration is a DOM sibling
       above it, so the chart used to open with two lines of story printed
       across the middle of it. One class, set where every other per-frame
       HUD state is set. */
    if (r._map !== !!RT.mapOpen) { r._map = !!RT.mapOpen; r.classList.toggle('nn-map', !!RT.mapOpen); }
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
    // NOT written into S: a render function that assigns the live RT.poem
    // into the save aliases them together, so the graded page the game kept
    // is replaced by whatever scrap is in your mouth, the 12 line cap stops
    // applying, and every later sSave re-serialises a growing transcript.
    var live = (RT.poem && RT.poem.lines.length) ? RT.poem : null;
    // only hide the current place's kept page when there is a live one
    // standing in for it, or clearing a fight and opening the book straight
    // afterwards shows you nothing at all
    var mine = Object.keys(S.poems || {}).filter(function (id) { return !live || id !== RT.place; });
    mine.sort(function (a2, b2) { return (a2 === RT.place ? -1 : b2 === RT.place ? 1 : 0); });
    if (live) html += '<h4>WHAT YOU HAVE BEEN SAYING</h4><div class="nn-poem"><header>' +
                      esc(place().n) + ' <i>· still going</i></header>' + poemHtml(live) + '</div>';
    else html += '<h4>WHAT YOU HAVE BEEN SAYING</h4>';
    if (!mine.length && !live) {
        html += '<p class="nn-note dim">Nothing yet. Every word you say out loud goes down here, and every sound you close ends a line. That is all a stanza is.</p>';
    } else {
        // the place you are in first, then the rest, newest work at the top
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
    var html = '<p class="nn-note">You do not pick your words. Every word you have learned goes in the bag and the line deals them out a few at a time, always keeping one back: <b>left click</b> says the one on your tongue, <b>right click</b> swallows it. Learn more words and the line gets longer. The <b>sounds</b> are yours, on the number row, and each one closes every syllable of itself on the board at once.</p>';
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
            /* `num` rows carry a sub now, because twenty two of them were
               written with one and this branch rendered only the label,
               so every explanation of what a slider does and where its
               useful range ends was in the source and nowhere else.
               Same <i> the btn branch uses, so it takes the same style. */
            return '<div class="nn-drow"><span>' + esc(r.t) +
                (r.sub ? '<i>' + esc(r.sub) + '</i>' : '') + '</span><span class="nn-dnum">' +
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
            { x: 4.6, y: 2.6, n: 'A lamp on a sill', d: 'Set out on the ninth night for the man who walked out past the fence. Every house on the square has one. Nobody has ever set out a second.' },
            { x: 7.2, y: 6.6, n: 'The playbill', d: 'THE NINTH NIGHT. A true account. The same four hundredth time.\n\nUnder the cast list somebody has pencilled your name, and then gone over it twice, harder.' }
        ],
        exits: [
            // the one door in the game whose name and whose wall disagree:
            // Wick's north side is built up, so you leave for the lane off
            // the south edge. `dir` tells the map what the name says.
            { x: 8.5, y: 14.3, w: 3, to: 'lane', n: 'the lane, north', dir: [0, -1] },
            { x: 2.1, y: 3.6, w: 1.6, to: 'bernhouse', n: 'Bern\'s door' },
            { x: 15, y: 3.8, w: 1.6, to: 'chandler', n: 'the chandler\'s shop' },
            // a full tile clear of the playbill at 7.2. This band is the only
            // point of no return in the game and you enter it by walking
            { x: 9.2, y: 6.6, w: 1.6, to: 'a3sq', n: 'up the steps, onto the stage', needs: 'a3ready', over: 1,
              shut: function () {
                  return S.a3.ending ? 'They have the boards up on the cart already. It was last night now.'
                                     : 'They are still building it. It is not tonight yet.';
              } }
        ]
    },
    /* ── interiors. Somewhere with a roof on it, and one lamp that is
          not for anybody, which is the only one in the game that is not. ── */
    bernhouse: {
        // was "he has kept the part for forty years and never played it",
        // which the man himself contradicts in this room: "I played him
        // thirty years". The shop item and the cast comment agree with him.
        n: 'Bern\'s house', sub: 'thirty years in the part, and his father before him',
        floor: 'room', calm: 1, mends: 1, w: 11, h: 9, night: 1, indoor: 1,
        props: [
            /* North and west only. In this projection the two faces
               nearest the eye are the south and the east, and the iso
               cutaway convention drops both: the room is an L and the
               floor edge reads as the wall line, which is what the south
               has always done here. The east wall used to be kept, which
               put a nine tile wall between the camera and the whole
               south-east quarter of the room, and Bern's bed lost 81% of
               its top face to it. */
            { t: 'wall', b: [0, 0, 11, 0.6] }, { t: 'wall', b: [0, 0, 0.6, 9] },
            { t: 'table', b: [4.2, 3.4, 2.6, 1.6] },
            { t: 'bed', b: [8.2, 1.2, 1.8, 3.2] },
            { t: 'shelf', b: [1, 1.2, 2.4, 0.8] },
            { t: 'lamp', b: [7.2, 3.6, 0.5, 0.5] },
            { t: 'hearth', b: [3.9, 0.6, 2.2, 1 ] },
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
            { t: 'wall', b: [0, 0, 12, 0.6] }, { t: 'wall', b: [0, 0, 0.6, 9] },   // near walls dropped, see bernhouse
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
        floor: 'mill', w: 13, h: 17, night: 1,
        props: [
            { t: 'fence', b: [0.6, 4, 0.5, 9] }, { t: 'fence', b: [11.9, 3, 0.5, 3.2] }, { t: 'fence', b: [11.9, 10.2, 0.5, 2.8] },
            { t: 'tree', b: [2.2, 6.4, 1.4, 1.4] }, { t: 'tree', b: [9.4, 10.2, 1.4, 1.4] },
            { t: 'stone', b: [4.6, 12.6, 1, 1] },
            // the last lamp of Wick. The town lights the lane as far as it
            // thinks the town goes, and then it stops.
            { t: 'lamp', b: [7.6, 14.4, 0.5, 0.5] }
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
        floor: 'mill', w: 15, h: 13, night: 1,
        props: [
            { t: 'mill', b: [5.4, 0.6, 5, 4.4] },
            { t: 'wheel', b: [10.8, 1.6, 1.2, 3.2] },
            { t: 'sack', b: [3, 6.4, 1.2, 1 ] }, { t: 'sack', b: [4.4, 6.8, 1.2, 1] }, { t: 'sack', b: [3.6, 8, 1.2, 1] },
            { t: 'fence', b: [0.6, 2, 0.5, 8] }, { t: 'fence', b: [13.9, 2, 0.5, 8] }
        ],
        // west end of the mill's face, a clear tile from the ladder band at
        // 7.9. It used to sit exactly ON that band, so the text that tells
        // you to rehearse lost the prompt to the door it explains about
        // nine times out of ten
        looks: [{ x: 5.9, y: 5.5, n: 'The mill door', d: 'Bern told you to rehearse out here because the loft carries sound and the town does not need to hear you learn.\n\nHe meant it kindly. He is like that.' }],
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
        floor: 'loft', w: 13, h: 13, night: 1, dark: 1,
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
        floor: 'town', calm: 1, w: 15, h: 12, night: 1,
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
        floor: 'mill', calm: 1, w: 13, h: 11, night: 1, dark: 1,
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
            { t: 'fence', b: [0.5, 23.6, 0.5, 8.4] }, { t: 'fence', b: [10.0, 23.6, 0.5, 8.4] },
            { t: 'post', b: [0.45, 22.4, 0.6, 0.6] }, { t: 'post', b: [9.95, 22.4, 0.6, 0.6] },
            { t: 'tree', b: [1.5, 18.4, 1.4, 1.4] }, { t: 'tree', b: [8.1, 15.2, 1.4, 1.4] },
            { t: 'tree', b: [1.3, 12.2, 1.4, 1.4] }, { t: 'hedge', b: [8.4, 20.2, 1.6, 1.2] },
            { t: 'cairn', b: [3.4, 9.4, 1.2, 1.2] },              // west of the walking line, which is what its look says
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
            /* The second tree used to stand at 12.2,10.2, which is south-east
               of the ring, and in this projection that is in front of it:
               its canopy took the south-east stone out entirely and the
               ring the whole place is about read as four stones and a
               tree. Due east now, level with the gap, hiding nothing. */
            { t: 'tree', b: [1.4, 1.6, 1.4, 1.4] }, { t: 'tree', b: [12.2, 4.6, 1.4, 1.4] }
        ],
        looks: [
            { x: 7.6, y: 7.2, n: 'The ground', d: 'The stones are not scattered. They are set, in a ring, with the gap facing south, facing the road, facing the town.\n\nSomebody sat down in the middle of this and made it tidy, and then it snowed for four hundred years.' },
            { x: 5.4, y: 4.2, n: 'The cold', d: 'It is not colder here. That is the wrong thing about it. You walked north all night and the air stopped getting colder about a mile back and it has been exactly this ever since.\n\nSomething took the difference.' },
            { x: 11.2, y: 6.4, n: 'North of here', d: 'Nothing. Not a view, not a drop, not a wall. The ground goes on being ground and the dark goes on being dark and there is no line where one ends.\n\nShe would have had to decide to stop. Nothing here would have stopped her.' }
        ],
        exits: [{ x: 7.4, y: 12.3, w: 3, to: 'road', n: 'back down the road' }],
        speakDraws: 4
    },
    a3sq: {
        n: 'Wick — the ninth night', sub: 'the four hundredth performance',
        floor: 'town', w: 17, h: 15, night: 1, script: 'a3', a3: 1, oneway: 1,
        props: [
            { t: 'house', b: [0, 0, 3.4, 2.6] }, { t: 'house', b: [13.6, 0, 3.4, 2.8] },
            /* The south-east corner is the near corner: in this projection
               a building there opens an occlusion cone up and to the left
               across the whole square, which is exactly where the town is
               sitting. Seven of the twenty-four were behind this house and
               one of them was inside it. The square's own shut line says
               "They have the boards up on the cart already", so the thing
               that stands in the near corner on the night is the cart. */
            { t: 'house', b: [0, 12.4, 3.6, 2.6] }, { t: 'cart', b: [14.6, 13.4, 2.2, 1.2] },
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
        // he does not move, and he stood 0.63 tiles from the playbill, which
        // is the one thing in the square with the player's own name on it.
        // The playbill won the prompt on 4.9% of the floor. This is two
        // tiles east of it and still the middle of the square.
        n: 'Bern', x: 9.0, y: 7.4, col: ['#6a4f3a', '#8a6a4a', '#d8b48c'], hat: 1,
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
        n: 'A child with a skipping rope', x: 4.6, y: 10, col: ['#4a5a7a', '#6a7a9a', '#e8c8a0'], small: 1,
        /* She used to loop through the well. Her last leg ran east at
           y = 9.9, and the well's blocked band at the npc radius is
           y 9.12..11.28, so she was refused after ten frames, the
           give-up branch in stepNpcs skipped her home, and the loop was
           three legs and a wall: eleven give-ups a minute, seven seconds
           of it standing still inside the well where nothing could be
           seen of her. This loop is the open cobbles west of it. It also
           keeps her off the lane door, whose prompt she used to take
           about a third of the time she was near it. */
        // she is described as skipping in her own dialogue, so she skips
        skip: 1, speed: 1.9, path: [[4.6, 10], [4.6, 12.6], [6.8, 12.6], [6.8, 10]],
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
        n: 'A woman setting out a lamp', x: 14, y: 4.6, col: ['#3a3448', '#4e465e', '#d8b48c'],
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
                        ['The shepherd', '"...not for the man who came back down, but for the girl who never will."'],
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
                                   ['The chandler', 'Because that is as far as anybody goes. You put the last one where the last one goes.'],
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
        // the square is the hub, so this fired every time you walked back in,
        // including on the way home from the hollow. Same guard the mill has.
        if (S.seen.wickIntro) return;
        S.seen.wickIntro = 1;
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
    /* THE TOLL. Four hundred people carrying the same open sound, and
       the frame stops for it. `toll` is the one row in PUNCH_KIND with
       the hitstop turned all the way up and the shake turned almost
       all the way off (1.20 / 0.15): a bell, not a blow. The art note
       this answers is that the square was firing the LOUDEST event in
       the game on the quietest beat in the story, so the fix is a kind
       of its own rather than a smaller `close`.
       Once, and only on the last cue. a3Answered re-marks the whole
       square on every slant retry, and a toll on each of those is a
       held frame every time the player guesses wrong, which reads as
       the game hitching rather than the town answering. */
    if (RT.story.cue === 3 && !RT.story.tolled) {
        RT.story.tolled = 1;
        punch({ fam: 'ill', power: 25, kind: 'toll' });
    }
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
    /* Bern's script counts. Its look is the syllables in the margin, six
       eight seven six, and the five circled twice with nothing written
       beside it. That is this fragment's whole observation, in writing,
       from the man who has held the part longest, and it was being
       recorded as S.seen.bernscript and read by nothing. */
    var src = S.heard.child || S.heard.busker || S.heard.shepherd || S.seen.bernscript;
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
    /* The widow is not the only witness to this. The chandler's ledger is
       four hundred years of one lamp per house and never one more, and
       the end of the fence is nine steps past the line the song says only
       he ever crossed. Both were being recorded and read by nothing. */
    var lamps = S.heard.widow || S.seen.ledger || S.seen.fenceend;
    if (!lamps || !S.seen.markstone) return;
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
/* `ins` says what fraction of its footprint a prop actually is: a tree's
   trunk is 0.34 of the 1.4 tile square it is authored in, a post 0.42 of
   its 0.6. body() has always drawn at that scale and blocked() has always
   collided at 100%, so a slender prop stopped you a full tile-width short
   of a thirteen pixel trunk. One reader now, and the number means the
   same thing to both. */
function solidBox(o) {
    var b = o.b, k = propDef(o.t).ins;
    if (!k || k >= 1) return b;
    var iw = b[2] * k, ih = b[3] * k;
    return [b[0] + (b[2] - iw) / 2, b[1] + (b[3] - ih) / 2, iw, ih];
}
function blocked(x, y, r) {
    var ps = place().props || [];
    for (var i = 0; i < ps.length; i++) {
        var b = solidBox(ps[i]);
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
    // no hudNudge: that is the flash for a cost you cannot pay, and every
        // other caller is a refused spend. A locked door is not about breath,
        // and the loft one fires mid-fight when the bar is what you are reading
        if (RT.nagged !== e.n) { RT.nagged = e.n; say(shutText(e), 'dim'); }
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
    // the prompt belonged to the place you just left: a second E in the same
    // frame used to re-enter the place you were already in, which finds no
    // back exit and teleports you to its default arrival point
    RT.prompt = null; RT.mapOpen = false;
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
        /* People do not walk through walls either, and they collide the
           way you do. The radius was 0.28 against your 0.3 and the clamp
           0.6 against your 0.5, which left eight gaps in the game a
           walker fits through and you do not. The clamp also ran AFTER
           the two tests, so it was the one thing in the file that could
           put somebody inside a prop; moveActor has always clamped first
           for exactly that reason. */
        nx = clamp(nx, 0.5, pw() - 0.5); ny = clamp(ny, 0.5, ph() - 0.5);
        if (!blocked(nx, w.y, 0.3)) w.x = nx;
        if (!blocked(w.x, ny, 0.3)) w.y = ny;
        // which way they face is a SCREEN question, and screen x is (x - y).
        // Testing dx alone got a quarter of all directions backwards, and
        // every one of them was somebody walking mostly along y, which on
        // screen is left or right. See faceX().
        w.face = faceX(dx, dy); w.moving = 1;
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
                   label: open ? e.n : (e.over && S.a3.ending ? 'over' : 'not yet') });
    });
    return out;
}
function nearestInteract() {
    if (RT.dialog) return null;
    /* You arrive standing in the band of the door you came through, and
       RT.armed is false until you step off it. That door was winning the
       prompt on every single arrival in the game, so the first thing the
       world ever offered you in a new place was the way back out of it.
       It is still there the moment you step off and turn round. */
    var here = RT.armed ? null : exitAt(RT.px, RT.py);
    var best = null, bd = 1.9;
    interactables().forEach(function (o) {
        if (here && o.k === 'exit' && o.e === here) return;
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
    house:     { h: 78, over: 74, vars: 6, live: 1, pal: ['#3b3340', '#2c2532', '#4a4150'] },
    mill:      { h: 96, over: 86, vars: 2, live: 1, pal: ['#4a3f30', '#37301f', '#5c5040'] },
    curtain:   { h: 120, over: 16, pal: ['#3a1c22', '#2a1218', '#4a262e'] },
    stagewip:  { h: 26, over: 40, pal: ['#43392e', '#332b22', '#544738'] },
    tree:      { h: 62, over: 34, vars: 5, ins: 0.34, pal: ['#33291f', '#241c14', '#3e3225'] },
    well:      { h: 26, over: 54, body: 'cyl', pal: ['#43392e', '#332b22', '#544738'] },
    markstone: { h: 40, over: 12, pal: ['#4a4a52', '#3a3a42', '#5c5c66'] },
    wheel:     { h: 70, over: 16, live: 1, pal: ['#43392e', '#332b22', '#544738'] },
    fence:     { h: 22, over: 18, vars: 3, pal: ['#3a2f24', '#2c231a', '#4a3d2e'] },
    beam:      { h: 16, pal: ['#3a2f24', '#2c231a', '#4a3d2e'] },
    cart:      { h: 22, over: 24, pal: ['#43392e', '#332b22', '#544738'] },
    crate:     { h: 20, vars: 3, pal: ['#4a3d2c', '#382e21', '#5c4c38'] },
    sack:      { h: 14, vars: 3, body: 'round', pal: ['#5a4f36', '#463d29', '#6c5f44'] },
    foot:      { h: 6,  over: 16, live: 1, pal: ['#4a4030', '#3a3224', '#5c5040'] },
    stone:     { h: 20, vars: 4, body: 'round', pal: ['#4a4a52', '#3a3a42', '#5c5c66'] },
    lamp:      { h: 34, over: 30, live: 1, pal: ['#2e2a26', '#232019', '#3c3630'] },
    post:      { h: 30, vars: 2, ins: 0.42, over: 10, pal: ['#3a2f24', '#2c231a', '#4a3d2e'] },
    cairn:     { h: 26, vars: 4, body: 'round', pal: ['#454550', '#35353f', '#565662'] },
    hedge:     { h: 24, over: 16, pal: ['#22301f', '#182417', '#2c3f28'] },
    table:     { h: 20, over: 14, pal: ['#4a3a28', '#382c1e', '#5e4a34'] },
    shelf:     { h: 46, pal: ['#413224', '#31261b', '#54412f'] },
    counter:   { h: 24, over: 16, pal: ['#4a3a28', '#382c1e', '#5e4a34'] },
    bed:       { h: 14, over: 22, pal: ['#3e3446', '#2f2836', '#4e4258'] },
    barrel:    { h: 22, vars: 2, body: 'cyl', pal: ['#46372a', '#352a20', '#584636'] },
    wall:      { h: 68, pal: ['#332b30', '#272026', '#42383e'] },
    vat:       { h: 26, over: 20, body: 'cyl', pal: ['#3e3a34', '#2f2c27', '#514c44'] },
    hearth:    { h: 46, over: 30, live: 1, pal: ['#3d3a37', '#2c2a28', '#4c4844'] },
    _:         { h: 18, pal: ['#43392e', '#332b22', '#544738'] }
};
function propDef(t) { return PROP[t] || PROP._; }

/* ─────────────── prop sprites ───────────────
   Every prop used to be redrawn from scratch, in vector calls, every
   frame. That put a hard ceiling on detail: a roof could have a shingle
   course or a framerate, not both.

   Now a prop is painted ONCE into an offscreen canvas and blitted after
   that. Nothing about a prop's appearance depends on where the camera
   is — the projection only translates — so the same bitmap is correct
   forever. Cost per prop per frame is one drawImage, and the detail
   budget goes from about twenty canvas calls to as many as it takes.

   Painters work in LOCAL space: the centre of the prop's ground
   footprint is the origin, and up is negative y. `c.lx/c.ly` map a
   point inside the footprint, in tiles, into that space. */
/* 14, not 10. Every prop sprite the game can build totals 11.68 MB, so a
   10 MB cap meant the cache sat at its ceiling from mid-game on and threw
   something away on every transition that built anything. It got away
   with it because the two coldest entries are the prologue stage and the
   act 3 square, but the margin was under a megabyte and a house is a
   third of one. The audit fails the build if the total ever passes this. */
var SPRITES = {}, SPRITE_LRU = [], SPRITE_BUDGET = 14 << 20;   // bytes of backing store, not entries
var SPRITE_BYTES = 0, SPRITE_PAD = 30;                          // pad: eaves, canopies, anything that overhangs
function hash2(a, b, c) {
    var n = (Math.round(a * 16) + 1013) | 0;
    n = Math.imul(n ^ (Math.round(b * 16) + 9176), 374761393);
    n = Math.imul(n ^ ((c || 0) * 2654435761), 668265263);
    n ^= n >>> 13; n = Math.imul(n, 1274126177);
    return (n ^ (n >>> 16)) >>> 0;
}
/* Which of this type's variants this instance is.

   A hash of the position alone is not enough. With five stones and four
   variants a repeat is arithmetic, but it was worse than arithmetic: the
   hollow's five ring stones came out as two shapes, the road's three
   trees were one tree blitted three times, and the two crates on the
   prologue stage were the same crate. So the hash picks a starting
   variant and, if another prop of the same type in the same place has
   already taken it, steps on until it finds one free. Every instance is
   different until a place holds more of something than there are
   variants, and it is still fixed data: it depends on where the props
   are and the order they are written in, not on anything at run time.

   `_pv` is worked out once per prop, ever: the props arrays are static
   per place. */
function assignVars() {
    var ps = place().props || [], used = {}, i;
    for (i = 0; i < ps.length; i++) {
        var o = ps[i], d = propDef(o.t);
        if (!d.vars) { o._pv = 0; continue; }
        var v = hash2(o.b[0], o.b[1], o.t.length * 31 + o.t.charCodeAt(0)) % d.vars;
        var u = used[o.t] || (used[o.t] = {}), n = 0;
        while (u[v] && n < d.vars) { v = (v + 1) % d.vars; n++; }   // taken: step on, the way the map slides a cell
        u[v] = 1; o._pv = v;
    }
}
function propVar(o) {
    if (o._pv == null) assignVars();
    return o._pv || 0;
}
function seedRng(n) {                          // stable per sprite, so a house does not reshuffle itself
    var s = (n >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
/* The geometry every painter works in: origin at the centre of the
   footprint, on the ground. Split out of propSprite because the plain
   body is also drawn straight to the screen, for the frame or two
   before a prop's real sprite has been painted. */
function spriteCtx(t, bw, bh, v) {
    var d = propDef(t), sk = (bw - bh) * TILE_W / 4;
    var rrx = (bw + bh) * TILE_W / 4, rry = (bw + bh) * TILE_H / 4;
    var c = {
        t: t, bw: bw, bh: bh, hgt: d.h, pal: d.pal, d: d, v: v,
        rrx: rrx, rry: rry, sk: sk, tx: 0, ty: -d.h,
        x0: -sk, y0: -rry, x1: rrx, y1: (bw - bh) * TILE_H / 4,
        x2: sk, y2: rry, x3: -rrx, y3: -(bw - bh) * TILE_H / 4,
        lx: function (u, q) { return (u - q) * (TILE_W / 2) - sk; },
        ly: function (u, q) { return (u + q) * (TILE_H / 2) - rry; },
        anchors: {},
        rng: seedRng(hash2(bw * 7 + bh * 13, v * 101 + 7, t.length * 131 + t.charCodeAt(t.length - 1)))
    };
    /* Where the fire is, where the chimney pot is, where the hub of the
       wheel is. The animated layer used to work these out a second time
       from the footprint, and the two answers drifted: the smoke came
       out of the middle of the roof and the fire burned eleven pixels
       above the logs. Whatever paints a thing now says where it is. */
    c.at = function (name, x, y) { c.anchors[name] = [x, y]; return [x, y]; };
    return c;
}
function propSprite(t, bw, bh, v, mayBuild) {
    var key = t + '|' + bw + '|' + bh + '|' + v;
    var hit = SPRITES[key];
    if (hit) { touchSprite(key); return hit; }
    if (mayBuild === false) return null;
    var d = propDef(t), hgt = d.h;
    var rrx = (bw + bh) * TILE_W / 4, rry = (bw + bh) * TILE_H / 4;
    var over = d.over || 0;                    // headroom above hgt for roofs and canopies
    var w = Math.ceil(rrx * 2) + SPRITE_PAD * 2;
    var h = Math.ceil(rry * 2 + hgt + over) + SPRITE_PAD * 2;
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var g = cv.getContext('2d');
    var ax = SPRITE_PAD + Math.ceil(rrx), ay = SPRITE_PAD + Math.ceil(rry + hgt + over);
    g.translate(ax, ay);
    var c = spriteCtx(t, bw, bh, v);
    paintProp(g, c);
    var sp = { cv: cv, ax: ax, ay: ay, bytes: w * h * 4, anchors: c.anchors, box: paintedBox(c) };
    SPRITES[key] = sp; SPRITE_BYTES += sp.bytes;
    touchSprite(key); trimSprites();
    return sp;
}
/* What the sprite actually painted, in local coordinates, which is not
   the same as how big its canvas is: a house reserves 74px of headroom
   for its roof and leaves eighty rows of it empty. Anything asking
   "is this prop covering that person" has to ask about the paint. */
/* What the sprite covers, in local coordinates. Derived, not measured:
   reading the pixels back to find out cost half a megabyte per prop and
   put the whole game's build cost back where it started.

   It used to say `hgt + over` IS where the paint stops, "because that is
   exactly the room the canvas was sized to give it". It is not. Look at
   propSprite: `ay = SPRITE_PAD + ceil(rry + hgt + over)`. The rry is in
   there because the footprint's NORTH corner already sits at local
   y = -rry before anything is extruded upward, so a wall's far end
   reaches -(rry + hgt). Dropping that term made the declared top short
   by up to 91px — the chandler's north wall by 91, Bern's by 84, the
   stage footlights by 81, the curtain by 73 — for 58 of the 96 prop
   instances in the game. contactShadow's outer ring is 1.18 of the
   footprint too, wider than the 1.15 that was here. Both corrected. */
function paintedBox(c) {
    var over = c.d.over || 0;
    return {
        rrx: c.rrx, rry: c.rry, sk: c.sk,
        ex: (c.bw - c.bh) * TILE_H / 4,      // the y of the east and west corners
        hgt: c.hgt,                          // the walls, which are the same height all across
        up: c.hgt + over,                    // and the roof on top of them, which is not
        x0: -c.rrx * 1.18, x1: c.rrx * 1.18, // the outer ring of the contact shadow
        y0: -(c.rry + c.hgt + over), y1: c.rry * 1.18 + 4
    };
}
/* The vertical span the paint occupies at one local x, which is the
   footprint diamond at that x swept upward by hgt + over.

   The bounding box is not good enough for this. A fence is 0.5 by 8.4
   tiles, so its box is 300px wide and 180 tall while the fence itself is
   a ribbon along one diagonal of it; testing the box makes every prop in
   the place fade for somebody standing nowhere near them. The diamond is
   two lines up and two lines down and costs about the same. */
/* The four corners, from spriteCtx: N is (-sk, -rry), E is (rrx, ex),
   S is (sk, rry), W is (-rrx, -ex). N is always the topmost and S the
   bottommost, and W and E are always the leftmost and rightmost, so each
   hull is exactly two segments whichever way the footprint is long. */
function paintSpan(lo, lx) {
    if (lx < -lo.rrx || lx > lo.rrx) return null;
    var top, bot;
    // upper boundary: west corner -> north corner -> east corner
    if (lx <= -lo.sk) top = lerp(-lo.ex, -lo.rry, (lx + lo.rrx) / Math.max(1e-6, lo.rrx - lo.sk));
    else              top = lerp(-lo.rry, lo.ex, (lx + lo.sk) / Math.max(1e-6, lo.rrx + lo.sk));
    // lower boundary: west corner -> south corner -> east corner
    if (lx <= lo.sk) bot = lerp(-lo.ex, lo.rry, (lx + lo.rrx) / Math.max(1e-6, lo.rrx + lo.sk));
    else             bot = lerp(lo.rry, lo.ex, (lx - lo.sk) / Math.max(1e-6, lo.rrx - lo.sk));
    /* The extrusion is `hgt` everywhere, but the headroom above it is not:
       `over` is a roof or a canopy, and a roof is at its ridge in the
       middle of the footprint and down at the eave by the corners. Sweeping
       the full hgt + over across the whole width makes a house into a tall
       rectangular curtain and reports people occluded who are nowhere near
       it, which is how a third of the Act 3 audience looked hidden. */
    var taper = lo.up - (lo.up - lo.hgt) * Math.abs(lx) / Math.max(1e-6, lo.rrx);
    return { top: top - taper, bot: bot + 4 };
}
/* sprite-local point to screen. Local (0,0) is the footprint centre, and
   the sprite is blitted so that centre lands on (mxc, myc). */
function anchorAt(sp, name, mxc, myc) {
    var a = sp && sp.anchors && sp.anchors[name];
    return { x: mxc + (a ? a[0] : 0), y: myc + (a ? a[1] : 0) };
}
function touchSprite(key) {
    var i = SPRITE_LRU.indexOf(key); if (i >= 0) SPRITE_LRU.splice(i, 1);
    SPRITE_LRU.push(key);
}
function trimSprites() {
    while (SPRITE_BYTES > SPRITE_BUDGET && SPRITE_LRU.length > 1) {
        var k = SPRITE_LRU.shift(), s = SPRITES[k];
        if (!s) continue;
        SPRITE_BYTES -= s.bytes; s.cv.width = s.cv.height = 0; delete SPRITES[k];
    }
}
function freeSprites() {
    Object.keys(SPRITES).forEach(function (k) { SPRITES[k].cv.width = SPRITES[k].cv.height = 0; delete SPRITES[k]; });
    SPRITE_LRU.length = 0; SPRITE_BYTES = 0;
}
/* ── the pixel primitives every painter uses ──
   Everything lands on integer boundaries. That is the whole difference
   between pixel art and a smooth vector drawing at this size. */
function px(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
function poly(g, pts, col) {
    g.fillStyle = col; g.beginPath();
    g.moveTo(Math.round(pts[0][0]), Math.round(pts[0][1]));
    for (var i = 1; i < pts.length; i++) g.lineTo(Math.round(pts[i][0]), Math.round(pts[i][1]));
    g.closePath(); g.fill();
}
function line(g, x0, y0, x1, y1, col, w) {
    g.strokeStyle = col; g.lineWidth = w || 1;
    g.beginPath(); g.moveTo(Math.round(x0) + 0.5, Math.round(y0) + 0.5); g.lineTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5); g.stroke();
}
/* Dither in 2px blocks rather than blending: a value step you can see
   the edge of, which is what keeps this reading as pixels. */
function dither(g, quad, col, amt, rng, size) {
    var s = size || 2;
    /* Walk the quad's own scanlines rather than its bounding box.
       Every face here is a parallelogram drawn at an iso angle, so the
       box is mostly outside the shape: scanning it and clipping cost 3x
       on a house wall, 6x on the stage and 33x on the footlight strip,
       all of it spent generating random numbers for cells that were
       then clipped away. Dropping the clip drops a save/restore too. */
    var n = quad.length, ys = quad.map(function (p) { return p[1]; });
    var y0 = Math.floor(Math.min.apply(null, ys)), y1 = Math.ceil(Math.max.apply(null, ys));
    /* One path, one fill. A cell per fillRect meant about four thousand
       draw calls for a single house wall, which is where sixty of the
       sixty-six milliseconds of a wall sprite went. The cells sit on a
       grid and never overlap, so filling them together is identical. */
    g.beginPath();
    for (var y = y0; y < y1; y += s) {
        var yc = y + s / 2, lo = Infinity, hi = -Infinity;
        for (var i = 0; i < n; i++) {                       // where this scanline crosses each edge
            var a = quad[i], b = quad[(i + 1) % n];
            if ((a[1] <= yc) === (b[1] <= yc)) continue;
            var xh = a[0] + (b[0] - a[0]) * (yc - a[1]) / (b[1] - a[1]);
            if (xh < lo) lo = xh;
            if (xh > hi) hi = xh;
        }
        if (lo > hi) continue;
        for (var x = Math.floor(lo / s) * s; x < hi; x += s) if (rng() < amt) g.rect(x, y, s, s);
    }
    g.fillStyle = col; g.fill();
}
/* A filled ellipse in PIXELS, in 2px scanline steps, one path and one
   fill. ctx.ellipse anti-aliases its edge, and against a game where
   everything else lands on integer boundaries a soft rim is the one
   thing that reads as not-pixel-art: the hollow's ring, which is five
   stones and the last thing the game asks you to look at, came out as
   smooth grey eggs. */
function pxEllipse(g, cx, cy, rx, ry, col, step) {
    var s = step || 2;
    g.fillStyle = col;
    g.beginPath();
    for (var y = -ry; y <= ry; y += s) {
        var t = y / ry, w = rx * Math.sqrt(Math.max(0, 1 - t * t));
        if (w < 0.5) continue;
        g.rect(Math.round(cx - w), Math.round(cy + y), Math.max(1, Math.round(w * 2)), s);
    }
    g.fill();
}
/* The same ellipse as a polygon, so dither() can walk it. Dithering the
   bounding rectangle instead put grain in the empty corners around every
   round prop in the game. */
function ellipsePoly(cx, cy, rx, ry, n) {
    var p = [], k = n || 20;
    for (var i = 0; i < k; i++) {
        var a = i / k * TAU;
        p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return p;
}
/* bilinear point inside a quad: the only sane way to lay courses of
   anything across a face that is a parallelogram on screen */
function qp(quad, u, v) {
    var a = quad[0], b = quad[1], c = quad[2], d = quad[3];
    var tx = a[0] + (b[0] - a[0]) * u, ty = a[1] + (b[1] - a[1]) * u;
    var bx = d[0] + (c[0] - d[0]) * u, by = d[1] + (c[1] - d[1]) * u;
    return [tx + (bx - tx) * v, ty + (by - ty) * v];
}
/* k < 1 darkens, k > 1 lightens, clamped. Snapped to 64 steps and
   memoised: this runs twice per cobblestone and several times per
   course of stone in every wall in the game, and it was re-parsing a
   hex string every time. Snapping is not a compromise here — a fixed
   number of shades per colour is what makes a palette a palette. */
var SHADE = {};
/* A band running across a face, following the face. Every one of these
   was a level `px()` rect sized off `c.fw`, which was the LENGTH of a
   sloped iso edge and not a horizontal span — so the band came out too
   long, level, and sitting on bare wall at one end while the face it
   belonged to ran away underneath it. Take the points off the quad.

   `c.fw` is gone now. The cart outlived this comment by using it for its
   wheels and putting the front one on its own tailgate, so the field has
   been removed rather than left lying about for the next painter. */
function bar(g, quad, u0, u1, v, w, col) {
    var a = qp(quad, u0, v), b = qp(quad, u1, v);
    line(g, a[0], a[1], b[0], b[1], col, w);
}
function shadeHex(hex, k) {
    var q = Math.round(k * 64), key = hex + '|' + q;
    var hit = SHADE[key];
    if (hit) return hit;
    var kk = q / 64, n = parseInt(hex.slice(1), 16);
    var r = clamp(Math.round(((n >> 16) & 255) * kk), 0, 255);
    var g2 = clamp(Math.round(((n >> 8) & 255) * kk), 0, 255);
    var b2 = clamp(Math.round((n & 255) * kk), 0, 255);
    return (SHADE[key] = '#' + ((1 << 24) | (r << 16) | (g2 << 8) | b2).toString(16).slice(1));
}
/* Painting a sprite is expensive on purpose: it buys a detailed prop
   that then costs one drawImage a frame forever. What it must not do is
   spend all of it on the frame you walk through a door. Entering the
   square used to build every sprite in it at once, which is 150ms, or
   nine dropped frames, at exactly the moment the place is supposed to
   open up. So each frame gets a budget, and anything not painted yet is
   drawn as its plain solid until its turn comes. */
var BUILD_MS = 5, buildT0 = 0;
function startBuildBudget() { buildT0 = performance.now(); }
function mayBuild() { return performance.now() - buildT0 < BUILD_MS; }
function drawProp(cx, o) {
    var b = o.b, t = o.t;
    var x0 = isoX(b[0], b[1]), x1 = isoX(b[0] + b[2], b[1]), x2 = isoX(b[0] + b[2], b[1] + b[3]), x3 = isoX(b[0], b[1] + b[3]);
    var y0 = isoY(b[0], b[1]), y1 = isoY(b[0] + b[2], b[1]), y2 = isoY(b[0] + b[2], b[1] + b[3]), y3 = isoY(b[0], b[1] + b[3]);
    if (Math.max(x0, x1, x2, x3) < -80 || Math.min(x0, x1, x2, x3) > VW + 80) return;   // off camera
    if (Math.min(y0, y1, y2, y3) - 240 > VH + 40 || Math.max(y0, y1, y2, y3) < -260) return;
    var mxc = (x0 + x2) / 2, myc = (y0 + y2) / 2;
    var v = propVar(o);
    var sp = propSprite(t, b[2], b[3], v, mayBuild());
    if (!sp) {                                   // its turn is next frame; stand something there meanwhile
        var c = spriteCtx(t, b[2], b[3], v);
        cx.save(); cx.translate(Math.round(mxc), Math.round(myc));
        contactShadow(cx, c);
        if (c.d.body === 'round') roundBody(cx, c); else if (c.d.body === 'cyl') cylBody(cx, c); else body(cx, c);
        cx.restore();
        return;
    }
    /* A roof is drawn after anything standing behind it, which is right,
       and a house is three tiles of roof, which means there is a band of
       walkable ground where you are simply not on screen. You could
       stand next to the widow, read "E — talk to A woman setting out a
       lamp", and see neither her nor yourself. So a prop that is
       covering somebody thins out over them. It eases, because a roof
       that snaps to half opacity as you cross a tile line is worse than
       the problem. */
    var want = coversSomeone(o, sp, mxc, myc) ? T_CUT : 1;
    var f = RT.world.cut[o._ci], now;
    if (f == null) f = want;
    now = f + (want - f) * (1 - Math.pow(0.004, RT.rdt || 1 / 60));
    RT.world.cut[o._ci] = now;
    if (now < 0.995) {
        cx.save(); cx.globalAlpha = now;
        cx.drawImage(sp.cv, Math.round(mxc - sp.ax), Math.round(myc - sp.ay));
        if (propDef(t).live) propLive(cx, o, mxc, myc, sp);
        cx.restore();
        return;
    }
    cx.drawImage(sp.cv, Math.round(mxc - sp.ax), Math.round(myc - sp.ay));
    if (propDef(t).live) propLive(cx, o, mxc, myc, sp);
    return;
}
var T_CUT = 0.56;                            // how much of a roof is left when it is in your way
// the fades are indexed by position in the place's own prop list, so
// they cannot outlive the place they were measured in
onPlaceChange(function () { RT.world.cut = {}; });
/* Only things that sort BEHIND this prop can be hidden by it, and only
   the part of them that is actually inside the paint.

   This asked whether the prop swallows you WHOLE: `sy - a.h < y0` bailed
   the moment your head was above the declared top of the paint, which is
   the opposite of what the comment above it used to promise. Against a
   top that was also up to 91px too low (see paintedBox) the two errors
   compounded and the cutaway simply stopped: 67 tiles of walkable ground
   across eleven places put you entirely behind a wall with nothing
   thinning, a fifth of the chandler's floor among them. It is an overlap
   test now, which is what "a tall figure half behind a wall still
   counts" always meant.

   The `< 24` guard below has never fired: over the 89 authored prop
   instances the smallest box is 33 by 34. It is kept as a floor for
   whatever gets authored next, at a size that means something now that
   the box is measured properly. */
function coversSomeone(o, sp, mxc, myc) {
    var k = o.b[0] + o.b[2] / 2 + o.b[1] + o.b[3] / 2;
    var lo = sp.box;
    if (lo.rrx * 2 < 24 || lo.up + lo.rry < 24) return false;   // low things never hide anybody
    for (var i = 0; i < RT.hide.length; i++) {
        var a = RT.hide[i];
        if (a.k >= k) continue;                              // in front of it, or is it
        var sx = isoX(a.x, a.y), sy = isoYA(a.x, a.y);
        var sp2 = paintSpan(lo, sx - mxc);
        if (!sp2) continue;
        var top = myc + sp2.top, bot = myc + sp2.bot;
        // how much of the figure is inside the paint. A well or a counter
        // takes your knees and that is not worth thinning a whole prop for;
        // a wall that takes your head is
        if (Math.min(sy, bot) - Math.max(sy - a.h, top) < a.h * 0.55) continue;
        return true;
    }
    return false;
}
/* The one light rule, for every prop in the game: the key is low and
   from the west-north-west, so the SOUTH-WEST face is lit, the
   SOUTH-EAST face is in shadow, and tops catch a little sky. Anything
   that breaks this reads as a sticker rather than an object. */
var PAINT = {};
function paintProp(g, c) {
    if (c.d.shadow !== 0) contactShadow(g, c);
    (PAINT[c.t] || PAINT._)(g, c);
}
/* Nothing was touching the ground. An object with no contact shadow
   reads as a sticker laid on top of the floor, and eleven of them in a
   room read as a collage. */
function contactShadow(g, c) {
    /* Follow the footprint, not the diamond's half extents. Sized off
       rrx/rry, a prop that is long and thin got a shadow the size of its
       bounding box: the footlight strip is 13 tiles by half a tile and
       was laying a 420px black ellipse across the middle of the stage,
       over the player standing on it, in the first scene of the game.
       Three banded rings rather than a gradient, because a soft radial
       falloff is the one thing on screen that is not made of pixels. */
    var q = [[c.x0, c.y0], [c.x1, c.y1], [c.x2, c.y2], [c.x3, c.y3]];
    g.save(); g.translate(0, 2);
    [[1.18, 'rgba(5,4,9,.15)'], [1.09, 'rgba(5,4,9,.2)'], [1.0, 'rgba(5,4,9,.34)']].forEach(function (st) {
        poly(g, q.map(function (p) { return [p[0] * st[0], p[1] * st[0]]; }), st[1]);
    });
    g.restore();
}
function propLive(cx, o, mxc, myc, sp) { (LIVE[o.t] || function () {})(cx, o, mxc, myc, sp); }
var LIVE = {};

/* the plain extruded solid, for everything without bespoke geometry */
function body(g, c, palOver) {
    var pal = palOver || c.pal, hgt = c.hgt;
    var k = c.d.ins || 1;
    var gx0 = c.x0 * k, gy0 = c.y0 * k, gx1 = c.x1 * k, gy1 = c.y1 * k;
    var gx2 = c.x2 * k, gy2 = c.y2 * k, gx3 = c.x3 * k, gy3 = c.y3 * k;
    poly(g, [[gx0, gy0 - hgt], [gx1, gy1 - hgt], [gx2, gy2 - hgt], [gx3, gy3 - hgt]], pal[2]);
    poly(g, [[gx3, gy3 - hgt], [gx2, gy2 - hgt], [gx2, gy2], [gx3, gy3]], pal[0]);
    poly(g, [[gx1, gy1 - hgt], [gx2, gy2 - hgt], [gx2, gy2], [gx1, gy1]], pal[1]);
    return { sw: [[gx3, gy3 - hgt], [gx2, gy2 - hgt], [gx2, gy2], [gx3, gy3]],
             se: [[gx2, gy2 - hgt], [gx1, gy1 - hgt], [gx1, gy1], [gx2, gy2]],
             top: [[gx0, gy0 - hgt], [gx1, gy1 - hgt], [gx2, gy2 - hgt], [gx3, gy3 - hgt]] };
}
function roundBody(g, c) {
    var pal = c.pal, hgt = c.hgt, rrx = c.rrx, rry = c.rry;
    pxEllipse(g, 0, -hgt / 2, rrx * 0.96, rry + hgt / 2, pal[1]);
    pxEllipse(g, -rrx * 0.09, -hgt * 0.6 - rry * 0.2, rrx * 0.8, (rry + hgt / 2) * 0.72, pal[0]);
    pxEllipse(g, -rrx * 0.2, -hgt * 0.8 - rry * 0.4, rrx * 0.46, (rry + hgt / 2) * 0.34, pal[2]);
}
// the silhouette roundBody just drew, for anything that wants to stay inside it
function roundShape(c) { return ellipsePoly(0, -c.hgt / 2, c.rrx * 0.96, c.rry + c.hgt / 2); }
function cylBody(g, c) {
    var pal = c.pal, hgt = c.hgt, rrx = c.rrx, rry = c.rry;
    g.fillStyle = pal[0];
    g.fillRect(-rrx, -hgt, rrx * 2, hgt);
    g.beginPath(); g.ellipse(0, 0, rrx, rry, 0, 0, TAU); g.fill();
    g.fillStyle = pal[1]; g.fillRect(rrx * 0.3, -hgt, rrx * 0.7, hgt);
    g.fillStyle = pal[2];
    g.beginPath(); g.ellipse(0, -hgt, rrx, rry, 0, 0, TAU); g.fill();
}
PAINT._ = function (g, c) {
    if (c.d.body === 'round') roundBody(g, c);
    else if (c.d.body === 'cyl') cylBody(g, c);
    else body(g, c);
};

/* ── plaster, timber, thatch: the materials Wick is built out of ── */
/* Every material below is mixed for a NIGHT scene with a dark veil laid
   over it and warm pools punched back out. Painted at daylight values
   the town glowed like it was on fire, which is the opposite of a game
   about one lamp in each window. Leave the headroom for the lamps. */
function plaster(g, quad, lit, rng) {
    var base = lit ? '#4c4653' : '#332e3b';
    poly(g, quad, base);
    dither(g, quad, shadeHex(base, 1.14), 0.16, rng);        // lime wash, unevenly applied
    dither(g, quad, shadeHex(base, 0.82), 0.13, rng);
    // rain never gets the bottom of a wall dry again
    var damp = [qp(quad, 0, 0.72), qp(quad, 1, 0.72), qp(quad, 1, 1), qp(quad, 0, 1)];
    dither(g, damp, 'rgba(24,20,30,.5)', 0.5, rng);
    poly(g, [qp(quad, 0, 0.94), qp(quad, 1, 0.94), qp(quad, 1, 1), qp(quad, 0, 1)], 'rgba(18,14,24,.55)');
}
/* Nine hungry years: the daub comes off in sheets and nobody has the
   lime to put it back, so the sticks underneath show through. */
function bareWattle(g, quad, u0, v0, u1, v1, rng) {
    var patch = [qp(quad, u0, v0), qp(quad, u1, v0), qp(quad, u1, v1), qp(quad, u0, v1)];
    poly(g, patch, '#332b26');
    for (var i = 0; i <= 7; i++) {                            // woven withies
        var q = i / 7, a = qp(patch, 0, q), b = qp(patch, 1, q);
        line(g, a[0], a[1], b[0], b[1], i % 2 ? '#4a3d30' : '#3d3226', 1);
    }
    for (var j = 1; j < 4; j++) {
        var a2 = qp(patch, j / 4, 0), b2 = qp(patch, j / 4, 1);
        line(g, a2[0], a2[1], b2[0], b2[1], '#241d1a', 1);
    }
    dither(g, patch, 'rgba(0,0,0,.35)', 0.3, rng);
}
function timberFrame(g, quad, rng, braces) {
    var dark = '#2f2731', lit = '#3d3440';
    function beam(u0, v0, u1, v1, w) {                        // a squared timber, lit on its upper edge
        var a = qp(quad, u0, v0), b = qp(quad, u1, v1);
        line(g, a[0], a[1], b[0], b[1], dark, w);
        line(g, a[0], a[1] - w / 2 + 0.5, b[0], b[1] - w / 2 + 0.5, lit, 1);
    }
    beam(0.02, 0, 0.02, 1, 4); beam(0.98, 0, 0.98, 1, 4);     // corner posts
    beam(0, 0.06, 1, 0.06, 4);                                // wall plate, under the eaves
    beam(0, 0.55, 1, 0.55, 3);                                // mid rail
    beam(0, 0.985, 1, 0.985, 3);                              // sill beam on the ground
    if (braces) { beam(0.02, 0.55, 0.26, 0.06, 2); beam(0.98, 0.55, 0.74, 0.06, 2); }
    for (var s = 1; s < 4; s++) beam(s / 4, 0.06, s / 4, 0.55, 2);   // studs
}
/* Courses of thatch or slate laid across a roof plane. The plane is a
   parallelogram on screen, so every course is walked in quad space
   rather than in pixels, or the far end of the roof drifts off it. */
function thatchPlane(g, quad, rng, lit) {
    var base = lit ? '#4a3f28' : '#302819';
    poly(g, quad, base);
    var courses = 7;
    for (var i = courses; i >= 0; i--) {
        var v = i / courses;
        var band = [qp(quad, 0, Math.max(0, v - 0.16)), qp(quad, 1, Math.max(0, v - 0.16)), qp(quad, 1, v), qp(quad, 0, v)];
        poly(g, band, shadeHex(base, 0.86 + (i / courses) * 0.3));
        // the ragged lower lip of a course, tuft by tuft
        var steps = Math.max(6, Math.round(Math.abs(quad[1][0] - quad[0][0]) / 7));
        for (var s = 0; s < steps; s++) {
            var u = (s + 0.5) / steps, p = qp(quad, u, v);
            var drop = 1 + rng() * 3;
            px(g, p[0] - 3, p[1] - 1, 6, drop, shadeHex(base, 0.62));
        }
        var a = qp(quad, 0, v), b = qp(quad, 1, v);
        line(g, a[0], a[1], b[0], b[1], 'rgba(20,15,10,.4)', 1);
    }
    for (var k = 0; k < 90; k++) {                            // individual straws, catching the light
        var u2 = rng(), v2 = rng(), p2 = qp(quad, u2, v2);
        px(g, p2[0], p2[1], 1, 2 + rng() * 3, rng() < 0.5 ? shadeHex(base, 1.24) : shadeHex(base, 0.7));
    }
    for (var m = 0; m < 3; m++) {                             // moss, on the courses that never dry
        var mu = rng(), mv = 0.3 + rng() * 0.6, mp = qp(quad, mu, mv);
        g.fillStyle = 'rgba(58,78,48,.5)';
        g.beginPath(); g.ellipse(mp[0], mp[1], 4 + rng() * 6, 2 + rng() * 3, 0, 0, TAU); g.fill();
    }
    // a patch of newer straw, a repair somebody could still afford
    var pu = 0.2 + rng() * 0.5, pv = 0.24 + rng() * 0.4;
    var patch = [qp(quad, pu, pv), qp(quad, pu + 0.2, pv), qp(quad, pu + 0.2, pv + 0.3), qp(quad, pu, pv + 0.3)];
    poly(g, patch, shadeHex(base, 1.2));
    dither(g, patch, shadeHex(base, 0.8), 0.3, rng);
}
function slatePlane(g, quad, rng, lit) {
    var base = lit ? '#3a3945' : '#26262e';
    poly(g, quad, base);
    var rows = 9;
    for (var r = 0; r < rows; r++) {
        var v0 = r / rows, v1 = (r + 1) / rows;
        var cols = Math.max(5, Math.round(Math.abs(quad[1][0] - quad[0][0]) / 11));
        for (var s = 0; s < cols; s++) {
            var off = (r % 2) * 0.5 / cols;
            var u0 = s / cols + off, u1 = u0 + 1 / cols;
            if (u0 >= 1) continue;
            var tile = [qp(quad, u0, v0), qp(quad, Math.min(1, u1) - 0.004, v0), qp(quad, Math.min(1, u1) - 0.004, v1), qp(quad, u0, v1)];
            var k = 0.86 + rng() * 0.3;
            poly(g, tile, shadeHex(base, k));
            if (rng() < 0.1) poly(g, tile, 'rgba(60,80,52,.35)');        // lichen
            if (rng() < 0.05) poly(g, tile, 'rgba(12,10,16,.8)');        // gone, and the batten shows
        }
        var a = qp(quad, 0, v1), b = qp(quad, 1, v1);
        line(g, a[0], a[1], b[0], b[1], 'rgba(10,8,14,.45)', 1);
    }
}
PAINT.house = function (g, c) {
    var rng = c.rng, hgt = c.hgt, v = c.v;
    var thatched = v % 3 !== 2;                   // most of Wick is thatched; one roof in three is slate
    var flip = v % 2 === 1;                       // which way the ridge runs, so no two neighbours match
    var rh = 26 + (v % 3) * 6;
    var eo = 1.1;                                  // the eaves overhang the wall
    var E = function (p) { return [p[0] * eo, p[1] * eo]; };
    var W = { n: [c.x0, c.y0 - hgt], e: [c.x1, c.y1 - hgt], s: [c.x2, c.y2 - hgt], w: [c.x3, c.y3 - hgt] };
    var eaveN = E(W.n), eaveE = E(W.e), eaveS = E(W.s), eaveW = E(W.w);
    var mid = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - rh]; };
    var rA, rB, farPlane, nearPlane, gable, gableFlat;
    if (!flip) {                                   // ridge runs west-east: one long slope faces us, gable to the south-east
        rA = mid(eaveW, eaveN); rB = mid(eaveE, eaveS);
        farPlane  = [rA, rB, eaveE, eaveN];
        nearPlane = [rA, rB, eaveS, eaveW];
        gable = [W.e, W.s, [ (W.e[0] + W.s[0]) / 2, (W.e[1] + W.s[1]) / 2 - rh ]];
        gableFlat = [W.s, W.e, [(W.e[0] + W.s[0]) / 2, (W.e[1] + W.s[1]) / 2 - rh]];
    } else {                                       // ridge runs north-south: gable to the south-west
        rA = mid(eaveN, eaveE); rB = mid(eaveW, eaveS);
        farPlane  = [rA, rB, eaveW, eaveN];
        nearPlane = [rA, rB, eaveS, eaveE];
        gable = [W.w, W.s, [(W.w[0] + W.s[0]) / 2, (W.w[1] + W.s[1]) / 2 - rh]];
        gableFlat = gable;
    }
    /* ── the two walls you can see ── */
    var sw = [[c.x3, c.y3 - hgt], [c.x2, c.y2 - hgt], [c.x2, c.y2], [c.x3, c.y3]];
    var se = [[c.x2, c.y2 - hgt], [c.x1, c.y1 - hgt], [c.x1, c.y1], [c.x2, c.y2]];
    poly(g, [[c.x0, c.y0 - hgt], [c.x1, c.y1 - hgt], [c.x2, c.y2 - hgt], [c.x3, c.y3 - hgt]], '#2a2530');
    plaster(g, se, false, rng);
    plaster(g, sw, true, rng);
    if (v % 2 === 0) bareWattle(g, sw, 0.62, 0.16, 0.88, 0.5, rng);
    else bareWattle(g, se, 0.1, 0.6, 0.36, 0.9, rng);
    /* Two rectangles, and they are the whole game.
       Around the sill that still gets a lamp, the plaster is scrubbed
       clean, in a hard-edged rectangle, because somebody wipes the soot
       off it once a year and has done for four hundred.
       Around the sill that does not, the same rectangle is still there,
       one step lighter than the wall and no more. It was scrubbed too,
       once. This house used to set out two. */
    var lampU = houseSillU(v);
    var scrub = [qp(se, lampU - 0.05, 0.13), qp(se, lampU + 0.18, 0.13), qp(se, lampU + 0.18, 0.55), qp(se, lampU - 0.05, 0.55)];
    poly(g, scrub, 'rgba(122,114,132,.22)');
    dither(g, scrub, 'rgba(150,142,162,.3)', 0.2, rng);
    var ghostU = v % 3 === 0 ? 0.74 : 0.1;
    var ghost = [qp(sw, ghostU - 0.05, 0.13), qp(sw, ghostU + 0.18, 0.13), qp(sw, ghostU + 0.18, 0.55), qp(sw, ghostU - 0.05, 0.55)];
    poly(g, ghost, 'rgba(122,114,132,.07)');
    timberFrame(g, se, rng, false);
    timberFrame(g, sw, rng, true);

    /* ── the doorway, in the middle of the lit wall ── */
    var dTop = qp(sw, 0.42, 0.34), dBot = qp(sw, 0.42, 1), dTop2 = qp(sw, 0.6, 0.34), dBot2 = qp(sw, 0.6, 1);
    poly(g, [dTop, dTop2, dBot2, dBot], '#171220');
    var dw = dTop2[0] - dTop[0];
    for (var pl = 0; pl < 4; pl++) {                       // four planks and the light between them
        var q = pl / 4;
        px(g, dTop[0] + dw * q + 1, dTop[1] + 2, dw / 4 - 1.5, dBot[1] - dTop[1] - 2, pl % 2 ? '#241b2c' : '#2b2134');
    }
    bar(g, sw, 0.40, 0.62, 0.325, 4, '#332c3c');            // lintel, on the slope the door is on
    bar(g, sw, 0.42, 0.60, 0.40, 2, '#3a3142');             // iron strap hinges
    bar(g, sw, 0.42, 0.60, 0.88, 2, '#3a3142');
    px(g, dTop2[0] - 5, (dTop[1] + dBot[1]) / 2, 3, 3, '#6a5c3a');   // a ring handle
    bar(g, sw, 0.39, 0.63, 0.985, 4, '#3b3542');            // a step, worn hollow in the middle
    bar(g, sw, 0.44, 0.58, 0.995, 2, '#3b3442');
    /* The tally on the door post: groups of five, one for each ninth
       night this house has kept. Exactly one group has been rubbed back
       out. It is the same hand that scratched the name off the mark. */
    var tp = qp(sw, 0.37, 0.42), groups = 6 + (v % 6), rubbed = 2 + (v % 3);
    for (var tg = 0; tg < groups; tg++) {
        var ty2 = tp[1] + tg * 3.4;
        if (ty2 > dBot[1] - 8) break;
        var col = tg === rubbed ? 'rgba(100,78,51,.3)' : 'rgba(154,123,82,.7)';
        for (var tm = 0; tm < 4; tm++) px(g, tp[0] - 7 + tm * 2, ty2, 1, 3, col);
        line(g, tp[0] - 8, ty2 + 3, tp[0] - 1, ty2, col, 1);
    }
    if (v % 5 === 3) {                                       // a straw cross over the lintel, on one house in five
        px(g, dTop[0] + dw / 2 - 5, dTop[1] - 12, 10, 1, '#6f6845');
        px(g, dTop[0] + dw / 2 - 1, dTop[1] - 16, 1, 9, '#6f6845');
        line(g, dTop[0] + dw / 2 - 5, dTop[1] - 16, dTop[0] + dw / 2 + 5, dTop[1] - 8, '#6f6845', 1);
    }

    /* ── windows, and the one that matters ── */
    function window_(quad, u, wv, lit2) {
        var a = qp(quad, u, wv), b = qp(quad, u + 0.13, wv), d2 = qp(quad, u, wv + 0.2), c2 = qp(quad, u + 0.13, wv + 0.2);
        poly(g, [a, b, c2, d2], '#100c18');
        if (lit2) {
            poly(g, [[a[0] + 1, a[1] + 1], [b[0] - 1, b[1] + 1], [c2[0] - 1, c2[1] - 1], [d2[0] + 1, d2[1] - 1]], 'rgba(255,196,110,.85)');
            var w2 = b[0] - a[0];
            line(g, a[0] + w2 / 2, a[1], d2[0] + w2 / 2, d2[1], '#1a1420', 2);     // a mullion
            line(g, a[0], (a[1] + d2[1]) / 2, b[0], (b[1] + c2[1]) / 2, '#1a1420', 1);
        } else {
            dither(g, [a, b, c2, d2], 'rgba(70,62,80,.5)', 0.3, rng);              // shutters, closed
            line(g, (a[0] + b[0]) / 2, a[1], (d2[0] + c2[0]) / 2, d2[1], '#2a2334', 2);
        }
        px(g, a[0] - 2, d2[1] - 1, (b[0] - a[0]) + 4, 3, '#403949');               // the sill
        return { a: a, b: b, c: c2, d: d2 };
    }
    var litIdx = v % 3;
    window_(sw, 0.1, 0.2, litIdx === 0);
    window_(sw, 0.74, 0.2, litIdx === 1);
    var sill = window_(se, lampU, 0.24, true);
    // one pane went years ago and was greased and papered over rather
    // than replaced, and it is the colour of old fat, not of firelight
    px(g, sill.a[0] + 1, sill.a[1] + 1, (sill.b[0] - sill.a[0]) / 2 - 1, (sill.d[1] - sill.a[1]) / 2 - 1, '#b8763a');

    /* ── the lamp on the sill. This is the name of the game. ── */
    var lx2 = (sill.d[0] + sill.c[0]) / 2, ly2 = sill.d[1];
    px(g, lx2 - 3, ly2 - 7, 6, 7, '#241c18');                 // the lantern body
    px(g, lx2 - 2, ly2 - 6, 4, 5, '#ffd089');
    px(g, lx2 - 1, ly2 - 9, 2, 2, '#3a3028');                 // its little handle
    g.globalCompositeOperation = 'lighter';
    var lg = g.createRadialGradient(lx2, ly2 - 4, 1, lx2, ly2 - 4, 26);
    lg.addColorStop(0, 'rgba(255,196,104,.4)'); lg.addColorStop(1, 'rgba(255,180,80,0)');
    g.fillStyle = lg; g.beginPath(); g.arc(lx2, ly2 - 4, 26, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
    // and the tongue of soot the flame has licked up the plaster, which
    // is the same mark the lamp post outside the door carries
    var tw = [6, 6, 4, 4, 2, 2];
    for (var so = 0; so < 6; so++) px(g, lx2 - tw[so] / 2, ly2 - 12 - so * 2, tw[so], 2, 'rgba(11,9,18,' + (0.4 - so * 0.05).toFixed(2) + ')');
    /* The spill under the sill. Both bottom corners used to be taken from
       the corners of the WALL, so the wedge of light ran the whole length
       of the house from a window a few pixels wide, and which corner it
       reached for depended on a comparison between two unrelated ys. Take
       it off the face directly under the lamp. */
    var spillL = qp(se, clamp(lampU - 0.06, 0, 1), 1), spillR = qp(se, clamp(lampU + 0.24, 0, 1), 1);
    poly(g, [[lx2 - 7, ly2], [lx2 + 7, ly2], spillR, spillL], 'rgba(255,190,96,.07)');

    /* ── the roof ──
       Draw far then near, always. Which one is LIT is a different question
       and it is about the wall underneath, not about the eye: for the
       west-east ridge the near plane's eave runs south to west, so it sits
       over the lit sw wall; for the north-south ridge it runs south to
       east, over the shadowed se wall. Painting the near one lit either
       way put a bright roof on a dark wall on every flipped house in the
       game, which is half of them, and a roof lit from the wrong side is
       the one thing that makes a building read as a sticker. */
    var paint = thatched ? thatchPlane : slatePlane;
    paint(g, farPlane, rng, flip);
    paint(g, nearPlane, rng, !flip);
    // the gable end: a triangle of wall with a vent in it
    poly(g, gable, thatched ? '#3b3644' : '#37323f');
    dither(g, [gable[0], gable[1], gable[2], gable[0]], 'rgba(24,20,30,.4)', 0.2, rng);
    var gcx = (gable[0][0] + gable[1][0] + gable[2][0]) / 3, gcy = (gable[0][1] + gable[1][1] + gable[2][1]) / 3;
    px(g, gcx - 4, gcy - 6, 8, 9, '#100c18');                 // the loft vent, always open, always dark
    for (var vv = 0; vv < 3; vv++) px(g, gcx - 4, gcy - 5 + vv * 3, 8, 1, '#332b3c');
    line(g, gable[0][0], gable[0][1], gable[2][0], gable[2][1], '#2b2430', 3);   // barge boards
    line(g, gable[1][0], gable[1][1], gable[2][0], gable[2][1], '#2b2430', 3);
    // The ridge sags. Every roof over a hungry house dips in the middle,
    // because the timber under it has not been looked at in nine years.
    var sag = rh * (0.05 + (v % 4) * 0.03);
    var rM = [(rA[0] + rB[0]) / 2, (rA[1] + rB[1]) / 2 + sag];
    line(g, rA[0], rA[1], rM[0], rM[1], thatched ? '#7a6944' : '#3f3e49', 5);
    line(g, rM[0], rM[1], rB[0], rB[1], thatched ? '#7a6944' : '#3f3e49', 5);
    line(g, rA[0], rA[1] - 2, rM[0], rM[1] - 2, thatched ? '#8b7a52' : '#585767', 2);
    line(g, rM[0], rM[1] - 2, rB[0], rB[1] - 2, thatched ? '#8b7a52' : '#585767', 2);
    if (thatched) for (var rp = 0; rp < 9; rp++) {            // the hazel spars that pin the ridge down
        var rq = (rp + 0.5) / 9, rx = rA[0] + (rB[0] - rA[0]) * rq, ry = rA[1] + (rB[1] - rA[1]) * rq;
        line(g, rx - 3, ry - 4, rx + 3, ry + 1, '#463a26', 1);
    }
    poly(g, [qp(sw, 0, 0), qp(sw, 1, 0), qp(sw, 1, 0.07), qp(sw, 0, 0.07)], 'rgba(14,10,20,.5)');
    poly(g, [qp(se, 0, 0), qp(se, 1, 0), qp(se, 1, 0.07), qp(se, 0, 0.07)], 'rgba(14,10,20,.5)');

    /* ── the chimney, and everything hung off the walls ── */
    var chu = 0.18 + (v % 4) * 0.16, ch = 20 + (v % 3) * 5;
    var cp = qp(nearPlane, chu, 0.12);
    px(g, cp[0] - 7, cp[1] - ch, 14, ch + 6, '#2c2733');
    px(g, cp[0] - 7, cp[1] - ch, 7, ch + 6, '#3a3542');
    for (var br = 0; br < 4; br++) px(g, cp[0] - 7, cp[1] - ch + 3 + br * 5, 14, 1, 'rgba(16,12,22,.5)');
    px(g, cp[0] - 9, cp[1] - ch - 3, 18, 4, '#403a49');       // the cap
    px(g, cp[0] - 5, cp[1] - ch - 2, 10, 2, '#0d0a12');       // soot
    c.at('chimney', cp[0], cp[1] - ch - 3);                   // and where the smoke has to leave from
    if (v % 5 === 2) {                                        // a stick nest in the pot. Nothing has been lit here this year.
        for (var tw2 = 0; tw2 < 8; tw2++) {
            var ta = -0.4 - tw2 * 0.32;
            line(g, cp[0] - 1 + tw2 * 0.4, cp[1] - ch - 3, cp[0] - 1 + Math.cos(ta) * 7, cp[1] - ch - 5 + Math.sin(ta) * 3, '#4a3f2e', 1);
        }
    }
    poly(g, [[cp[0] + 7, cp[1] - ch], [cp[0] + 13, cp[1] - ch + 5], [cp[0] + 13, cp[1] + 8], [cp[0] + 7, cp[1] + 6]], 'rgba(12,9,18,.35)');
    if (v % 3 === 0) {                                        // kindling stacked against the wall, what is left of it
        var kb = qp(sw, 0.88, 0.98);
        for (var kk = 0; kk < 7; kk++) px(g, kb[0] - 8 + kk * 2.4, kb[1] - 9 - (kk % 3), 2, 10 + (kk % 3) * 2, kk % 2 ? '#3e3326' : '#4a3d2c');
    }
    if (v % 4 === 1) {                                        // a water butt under the eave
        var wb = qp(sw, 0.06, 0.98);
        px(g, wb[0] - 6, wb[1] - 16, 12, 16, '#3c3128');
        px(g, wb[0] - 6, wb[1] - 16, 12, 2, '#544636');
        px(g, wb[0] - 6, wb[1] - 11, 12, 1, '#6a5a40');
    }
    if (v % 5 === 2) {                                        // herbs hung to dry by the door, mostly stalks now
        var hb = qp(sw, 0.66, 0.3);
        line(g, hb[0], hb[1], hb[0], hb[1] + 9, '#5a4a34', 1);
        for (var hh = 0; hh < 5; hh++) line(g, hb[0], hb[1] + 3, hb[0] - 3 + hh * 1.6, hb[1] + 12, '#4a5238', 1);
    }
    if (v % 3 === 1) {                                        // a bird on the ridge, because somewhere still has seed
        var bq = 0.3 + rng() * 0.4;
        var bx = rA[0] + (rB[0] - rA[0]) * bq, by = rA[1] + (rB[1] - rA[1]) * bq;
        px(g, bx - 2, by - 7, 4, 3, '#1d1822'); px(g, bx + 1, by - 8, 2, 2, '#1d1822');
        px(g, bx - 3, by - 5, 2, 1, '#1d1822');
    }
    // mud kicked up the bottom of every wall in a town with no cobbles left
    dither(g, [qp(sw, 0, 0.92), qp(sw, 1, 0.92), qp(sw, 1, 1), qp(sw, 0, 1)], 'rgba(38,30,22,.55)', 0.45, rng);
};
LIVE.house = function (cx, o, mxc, myc, sp) {
    // Smoke has to move, so it cannot live in the sprite. Only the
    // houses with a fire lit get any, and in Wick that is not all of them.
    var v = propVar(o);
    if (v % 3 === 2) return;
    var ch = anchorAt(sp, 'chimney', mxc, myc);               // the pot the sprite actually drew
    var sx = ch.x, sy = ch.y - 2;
    for (var i = 0; i < 4; i++) {
        var t = (RT.t * 0.34 + i * 0.25 + (o.b[0] % 1)) % 1;
        var a = (1 - t) * 0.16 * (v % 2 ? 1 : 0.7);
        var px2 = sx + Math.sin(t * 3 + i) * 7 * t, py2 = sy - t * 46;
        cx.fillStyle = 'rgba(150,142,158,' + a.toFixed(3) + ')';
        cx.beginPath(); cx.arc(px2, py2, 3 + t * 11, 0, TAU); cx.fill();
        // now and then a puff carries an ember up with it. They burned
        // the doors and the pews nine years ago; they are burning
        // something now, and it is not seasoned wood.
        if (t < 0.34 && (Math.floor(RT.t * 0.34 + i * 0.25 + (o.b[0] % 1)) % 14) === (i * 3) % 14) {
            cx.fillStyle = 'rgba(212,87,31,' + (0.85 - t * 2).toFixed(3) + ')';
            cx.fillRect(Math.round(px2), Math.round(py2), 1, 1);
        }
    }
};
/* ── the mill: the tallest thing in Wick, and the only one still working ── */
PAINT.mill = function (g, c) {
    var rng = c.rng, hgt = c.hgt, rh = 34;
    var W = { n: [c.x0, c.y0 - hgt], e: [c.x1, c.y1 - hgt], s: [c.x2, c.y2 - hgt], w: [c.x3, c.y3 - hgt] };
    var eo = 1.08, E = function (p) { return [p[0] * eo, p[1] * eo]; };
    var eaveN = E(W.n), eaveE = E(W.e), eaveS = E(W.s), eaveW = E(W.w);
    var mid = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - rh]; };
    var rA = mid(eaveW, eaveN), rB = mid(eaveE, eaveS);
    var sw = [[c.x3, c.y3 - hgt], [c.x2, c.y2 - hgt], [c.x2, c.y2], [c.x3, c.y3]];
    var se = [[c.x2, c.y2 - hgt], [c.x1, c.y1 - hgt], [c.x1, c.y1], [c.x2, c.y2]];
    poly(g, [[c.x0, c.y0 - hgt], [c.x1, c.y1 - hgt], [c.x2, c.y2 - hgt], [c.x3, c.y3 - hgt]], '#332b20');
    // rubble stone at the bottom, weatherboard above: you build the base
    // out of what the field gives you and the rest out of what you can saw
    [[sw, true], [se, false]].forEach(function (pair) {
        var q = pair[0], lit = pair[1];
        var base = lit ? '#3e3427' : '#2a231a';
        poly(g, q, base);
        for (var r = 0; r < 9; r++) {                      // weatherboard, lapped, each board shading the one below
            var v0 = r / 9, v1 = (r + 1) / 9;
            if (v0 > 0.62) break;
            poly(g, [qp(q, 0, v0), qp(q, 1, v0), qp(q, 1, v1), qp(q, 0, v1)], shadeHex(base, 1.02 - r * 0.012));
            var a = qp(q, 0, v1), b = qp(q, 1, v1);
            line(g, a[0], a[1], b[0], b[1], 'rgba(14,10,6,.5)', 2);
        }
        var rub = [qp(q, 0, 0.62), qp(q, 1, 0.62), qp(q, 1, 1), qp(q, 0, 1)];
        poly(g, rub, lit ? '#393634' : '#373432');
        for (var s = 0; s < 34; s++) {                     // field stones, no two the same
            var p = qp(rub, rng(), rng());
            g.fillStyle = shadeHex(lit ? '#454140' : '#403c3a', 0.8 + rng() * 0.5);
            g.beginPath(); g.ellipse(p[0], p[1], 3 + rng() * 4, 2 + rng() * 2.4, 0, 0, TAU); g.fill();
        }
        dither(g, rub, 'rgba(12,10,14,.45)', 0.2, rng);
    });
    // the hoist door up in the gable, where the sacks go in
    var hd = qp(se, 0.44, 0.14);
    c.at('hoist', hd[0], hd[1] - 2);                                // flour dust comes off the sacks, here
    px(g, hd[0] - 8, hd[1] - 2, 16, 18, '#1a140e');
    px(g, hd[0] - 8, hd[1] - 4, 16, 3, '#5c4c34');
    line(g, hd[0], hd[1] - 12, hd[0], hd[1] - 4, '#2a2118', 2);     // the beam it hangs from
    px(g, hd[0] - 6, hd[1] - 14, 12, 3, '#3e3222');
    line(g, hd[0] + 3, hd[1] - 12, hd[0] + 3, hd[1] + 10, '#6a5c40', 1);   // and the rope, still rigged
    // the big door, and a chute
    var dq = qp(sw, 0.4, 0.4), dq2 = qp(sw, 0.6, 1);
    poly(g, [dq, qp(sw, 0.6, 0.4), dq2, qp(sw, 0.4, 1)], '#1c1610');
    for (var pk = 0; pk < 5; pk++) px(g, dq[0] + (dq2[0] - dq[0]) * pk / 5 + 1, dq[1] + 2, (dq2[0] - dq[0]) / 5 - 1.5, dq2[1] - dq[1] - 2, pk % 2 ? '#2a2016' : '#31261a');
    px(g, dq[0] - 2, dq[1] - 4, (dq2[0] - dq[0]) + 4, 4, '#5c4c34');
    // roof: shingles, mossy on the side that never sees sun
    slatePlane(g, [rA, rB, eaveE, eaveN], rng, false);
    slatePlane(g, [rA, rB, eaveS, eaveW], rng, true);
    line(g, rA[0], rA[1], rB[0], rB[1], '#4a4854', 5);
    line(g, rA[0], rA[1] - 2, rB[0], rB[1] - 2, '#605e6e', 2);
    var wv = [[c.x1, c.y1 - hgt], [c.x2, c.y2 - hgt], [(c.x1 + c.x2) / 2, (c.y1 + c.y2) / 2 - hgt - rh]];
    poly(g, wv, '#3a3126');
    dither(g, [wv[0], wv[1], wv[2], wv[0]], 'rgba(20,14,8,.4)', 0.22, rng);
    // a weathervane, because a mill has to know which way the wind is
    var vx = rB[0], vy = rB[1];
    line(g, vx, vy - 2, vx, vy - 20, '#3a3428', 2);
    poly(g, [[vx - 8, vy - 17], [vx + 2, vy - 19], [vx + 2, vy - 13]], '#4a4234');
    px(g, vx + 3, vy - 20, 5, 1, '#4a4234'); px(g, vx - 8, vy - 20, 5, 1, '#4a4234');
    // flour dust on every ledge, which is the one thing Wick still has
    dither(g, [qp(sw, 0, 0.6), qp(sw, 1, 0.6), qp(sw, 1, 0.66), qp(sw, 0, 0.66)], 'rgba(214,198,158,.3)', 0.5, rng);
};
LIVE.mill = function (cx, o, mxc, myc, sp) {
    // it used to hang in the air a foot above the ridge, coming from
    // nothing. It comes off the hoist door, where the sacks go in.
    var hd = anchorAt(sp, 'hoist', mxc, myc);
    for (var i = 0; i < 3; i++) {
        var t = (RT.t * 0.22 + i * 0.34) % 1;
        cx.fillStyle = 'rgba(196,184,152,' + ((1 - t) * 0.12).toFixed(3) + ')';
        cx.beginPath(); cx.arc(hd.x + t * 16, hd.y - t * 30, 3 + t * 12, 0, TAU); cx.fill();
    }
};
PAINT.wheel = function (g, c) {                          // the frame; the wheel itself turns, so it is live
    var hgt = c.hgt, hy = -hgt + hgt * 0.42;
    body(g, c, ['#3a3024', '#2a2218', '#4a3e2c']);
    px(g, -4, -hgt - 6, 8, 12, '#4a3e2c');
    px(g, -3, -hgt - 4, 6, 8, '#2a2218');
    px(g, -3, hy - 22, 6, 22, '#332b1e');                // the post the axle sits on
    px(g, -5, hy - 4, 10, 8, '#4a3e2c');                 // and the bearing block it turns in
    px(g, -4, hy - 3, 8, 6, '#241d14');
    c.at('hub', 0, hy);
};
LIVE.wheel = function (cx, o, mxc, myc, sp) {
    var hgt = propDef('wheel').h, cy = anchorAt(sp, 'hub', mxc, myc).y, wr = Math.min(34, hgt * 0.46);
    var an0 = RT.t * 0.25;
    /* The rim as a ring of short straight runs rather than one stroked
       arc. Every other line in the game goes through line(), which rounds
       both ends and sits them on the half pixel; a smooth circle in the
       middle of it was the one moving thing in Wick and the one thing not
       made of pixels. */
    for (var rr = 0; rr < 24; rr++) {
        var a1 = rr / 24 * TAU + an0 * 0.0, a2 = (rr + 1) / 24 * TAU;
        line(cx, mxc + Math.cos(a1) * wr, cy + Math.sin(a1) * wr,
                 mxc + Math.cos(a2) * wr, cy + Math.sin(a2) * wr, '#3a3022', 6);
        line(cx, mxc + Math.cos(a1) * wr, cy + Math.sin(a1) * wr,
                 mxc + Math.cos(a2) * wr, cy + Math.sin(a2) * wr, '#57492f', 3);
    }
    for (var sp = 0; sp < 12; sp++) {
        var an = sp / 12 * TAU + an0;
        line(cx, mxc, cy, mxc + Math.cos(an) * wr, cy + Math.sin(an) * wr, sp % 2 ? '#4a3d2a' : '#5c4c34', 2);
        // paddles: the part that actually catches the water
        var px2 = mxc + Math.cos(an) * wr, py2 = cy + Math.sin(an) * wr;
        // One paddle has been mended. It is the only new wood anywhere in
        // Wick, and it is on the one machine the town still needs.
        var mended = sp === 4;
        line(cx, px2, py2, px2 - Math.sin(an) * 6, py2 + Math.cos(an) * 6, mended ? '#6a5535' : '#2e2618', 4);
        if (mended) {
            cx.fillStyle = '#8a8079';
            cx.fillRect(Math.round(px2 - Math.sin(an) * 2 - 1), Math.round(py2 + Math.cos(an) * 2 - 1), 2, 2);
            cx.fillRect(Math.round(px2 - Math.sin(an) * 5 - 1), Math.round(py2 + Math.cos(an) * 5 - 1), 2, 2);
        }
        // the paddles coming up out of the race are wet, and they drip
        var lo = Math.sin(an) > 0.55;
        if (lo) {
            cx.strokeStyle = 'rgba(150,178,196,.35)'; cx.lineWidth = 1;
            cx.beginPath(); cx.moveTo(px2, py2); cx.lineTo(px2 - Math.sin(an) * 6, py2 + Math.cos(an) * 6); cx.stroke();
            if (sp % 4 === 0) {
                var dt2 = (RT.t * 2.2 + sp) % 1;
                cx.fillStyle = 'rgba(150,178,196,' + ((1 - dt2) * 0.5).toFixed(3) + ')';
                cx.fillRect(Math.round(px2), Math.round(py2 + dt2 * 16), 1, 2);
            }
        }
    }
    cx.fillStyle = '#241d14'; cx.beginPath(); cx.arc(mxc, cy, 5, 0, TAU); cx.fill();
    cx.fillStyle = '#4a3d2a'; cx.beginPath(); cx.arc(mxc, cy, 2, 0, TAU); cx.fill();
};
/* ── a tree in the ninth hungry year: thin, and half of it dead ── */
PAINT.tree = function (g, c) {
    var rng = c.rng, hgt = c.hgt, rrx = c.rrx, rry = c.rry, ty = -hgt;
    var bare = c.v === 4;                                    // one tree in five did not come back this spring
    var lean = (c.v - 2) * 1.6;
    // roots, then a trunk that is not a cylinder
    g.fillStyle = '#2b231a';
    for (var r = 0; r < 5; r++) {
        var ra = Math.PI + r / 4 * Math.PI;
        g.beginPath(); g.moveTo(-4, 0); g.lineTo(Math.cos(ra) * rrx * 0.4, 2 + Math.sin(ra) * rry * 0.3); g.lineTo(4, 2); g.closePath(); g.fill();
    }
    for (var s = 0; s < hgt; s += 2) {                       // taper and lean, drawn as stacked slabs
        var q = s / hgt, w = 13 - q * 5;
        var off = lean * q * q;
        px(g, -w / 2 + off, -s - 2, w, 3, '#332a1f');
        px(g, -w / 2 + off, -s - 2, w * 0.42, 3, '#453927');   // the lit side of the trunk
        if (rng() < 0.3) px(g, -w / 2 + off + rng() * w, -s - 2, 1, 2, '#241d15');   // bark grain
    }
    // limbs
    var lim = bare ? 7 : 5;
    for (var l = 0; l < lim; l++) {
        var la = -0.4 - l * 0.42 + rng() * 0.3, ll = rrx * (0.4 + rng() * 0.5);
        var bx = lean, by = ty + rry * 0.5 - l * 4;
        g.strokeStyle = '#332a1f'; g.lineWidth = 3 - l * 0.3;
        g.beginPath(); g.moveTo(bx, by);
        g.quadraticCurveTo(bx + Math.cos(la) * ll * 0.6, by + Math.sin(la) * ll * 0.4, bx + Math.cos(la) * ll, by - Math.abs(Math.sin(la)) * ll * 0.5 - 6);
        g.stroke();
    }
    if (bare) {                                              // dead: just the fingers
        for (var t2 = 0; t2 < 26; t2++) {
            var ta = rng() * TAU, tl = 6 + rng() * 14;
            var px2 = lean + Math.cos(ta) * rrx * 0.4, py2 = ty - rry * 0.2 + Math.sin(ta) * rry * 0.5;
            line(g, px2, py2, px2 + Math.cos(ta) * tl, py2 + Math.sin(ta) * tl * 0.6, '#2e2619', 1);
        }
        return;
    }
    // canopy: clumps, not a lollipop. Each clump is lit on its upper left.
    var clumps = [];
    for (var i = 0; i < 9; i++) {
        var a = i / 9 * TAU + rng(), d2 = 0.2 + rng() * 0.6;
        clumps.push([lean + Math.cos(a) * rrx * 0.52 * d2, ty - rry * 0.25 + Math.sin(a) * rry * 0.8 * d2,
                     rrx * (0.2 + rng() * 0.2), rry * (0.34 + rng() * 0.3)]);
    }
    clumps.forEach(function (k) { g.fillStyle = '#18261b'; g.beginPath(); g.ellipse(k[0], k[1] + 3, k[2], k[3], 0, 0, TAU); g.fill(); });
    clumps.forEach(function (k) { g.fillStyle = '#263a28'; g.beginPath(); g.ellipse(k[0], k[1], k[2] * 0.94, k[3] * 0.9, 0, 0, TAU); g.fill(); });
    clumps.forEach(function (k) {
        g.fillStyle = '#35513a';
        g.beginPath(); g.ellipse(k[0] - k[2] * 0.24, k[1] - k[3] * 0.3, k[2] * 0.56, k[3] * 0.48, 0, 0, TAU); g.fill();
    });
    // leaf speckle so the mass has a grain instead of being a flat blob
    var bb = [[lean - rrx * 0.8, ty - rry * 1.2], [lean + rrx * 0.8, ty - rry * 1.2], [lean + rrx * 0.8, ty + rry * 0.8], [lean - rrx * 0.8, ty + rry * 0.8]];
    dither(g, bb, 'rgba(66,96,70,.5)', 0.06, rng);
    dither(g, bb, 'rgba(12,20,14,.5)', 0.05, rng);
    for (var d3 = 0; d3 < 5; d3++) {                         // dead limbs poking out of the green
        var da = rng() * TAU;
        var dx2 = lean + Math.cos(da) * rrx * 0.5, dy2 = ty - rry * 0.2 + Math.sin(da) * rry * 0.6;
        line(g, dx2, dy2, dx2 + Math.cos(da) * 10, dy2 + Math.sin(da) * 7, '#2b2318', 1);
    }
};
PAINT.stagewip = function (g, c) {
    var rng = c.rng, hgt = c.hgt;
    var f = body(g, c);
    for (var i = 1; i < 5; i++) { var a = qp(f.sw, i / 5, 0), b = qp(f.sw, i / 5, 1); line(g, a[0], a[1], b[0], b[1], 'rgba(0,0,0,.35)', 1); }
    // scaffolding for a play about a man who never walked anywhere
    for (var pz = 0; pz < 4; pz++) {
        var q = 0.14 + pz * 0.25, p = qp(f.top, q, 0.5);
        var lean = (pz % 2 ? 2 : -2);
        line(g, p[0], p[1], p[0] + lean, p[1] - 30 - (pz % 3) * 6, '#6a5638', 2);
        line(g, p[0] + lean * 0.5, p[1] - 16, p[0] + lean * 0.5 + 14, p[1] - 20, '#57482e', 2);
    }
    var t0 = qp(f.top, 0.1, 0.5), t1 = qp(f.top, 0.9, 0.5);
    line(g, t0[0], t0[1] - 30, t1[0], t1[1] - 34, '#57482e', 2);
    px(g, (t0[0] + t1[0]) / 2 - 10, (t0[1] + t1[1]) / 2 - 30, 20, 12, 'rgba(120,96,60,.5)');   // a flat, half painted
    for (var n = 0; n < 12; n++) { var np = qp(f.top, rng(), rng()); px(g, np[0], np[1], 2, 1, '#6a5638'); }
    dither(g, f.top, 'rgba(200,180,130,.25)', 0.1, rng);     // sawdust
};
PAINT.markstone = function (g, c) {
    var rng = c.rng, hgt = c.hgt;
    var f = body(g, c, ['#4e4e57', '#3c3c45', '#606069']);
    dither(g, f.sw, 'rgba(150,150,168,.3)', 0.14, rng);
    dither(g, f.se, 'rgba(20,20,28,.5)', 0.18, rng);
    dither(g, f.sw, 'rgba(84,104,74,.4)', 0.1, rng);          // lichen, on the side the weather comes from
    // chisel work: a name, and a name taken off
    var a = qp(f.sw, 0.16, 0.24), w = qp(f.sw, 0.84, 0.24)[0] - a[0];
    px(g, a[0], a[1], w, 2, '#7d7d8a');
    for (var i = 0; i < 5; i++) px(g, a[0] + 2 + i * (w / 5), a[1] + 5, w / 8, 3, '#787885');
    var b2 = qp(f.sw, 0.16, 0.52);
    px(g, b2[0], b2[1], w, 5, '#2b2b33');                     // the scratched-out line, cut out to nothing
    for (var j = 0; j < 7; j++) line(g, b2[0] + j * (w / 7), b2[1] - 1, b2[0] + 3 + j * (w / 7), b2[1] + 6, '#6e6e7b', 1);
    var c3 = qp(f.sw, 0.3, 0.74);
    for (var k = 0; k < 3; k++) px(g, c3[0] + k * 6, c3[1], 4, 2, '#6a6a77');
    // the top is weathered round and there is a chip out of one corner
    poly(g, [[c.x0, c.y0 - hgt], [c.x0 + 5, c.y0 - hgt + 2], [c.x3 + 6, c.y3 - hgt + 3], [c.x3, c.y3 - hgt]], 'rgba(120,120,138,.35)');
    poly(g, [[c.x2, c.y2 - hgt], [c.x2 - 6, c.y2 - hgt + 1], [c.x2 - 3, c.y2 - hgt + 7]], '#2f2f38');
};
PAINT.well = function (g, c) {
    var rng = c.rng, hgt = c.hgt, rrx = c.rrx, rry = c.rry;
    // a drystone ring, course by course
    g.fillStyle = '#3d3830'; g.fillRect(-rrx, -hgt, rrx * 2, hgt);
    g.beginPath(); g.ellipse(0, 0, rrx, rry, 0, 0, TAU); g.fill();
    for (var row = 0; row < 4; row++) {
        var yy = -hgt + row * (hgt / 4);
        var n = Math.max(6, Math.round(rrx / 7));
        for (var s = 0; s < n; s++) {
            var u = (s + (row % 2) * 0.5) / n, ang = Math.PI * (1 - u);
            var sx = Math.cos(ang) * rrx, lit = sx < rrx * 0.2;
            g.fillStyle = shadeHex(lit ? '#57503f' : '#3a352b', 0.85 + rng() * 0.35);
            g.fillRect(Math.round(sx - rrx / n * 0.9), Math.round(yy), Math.ceil(rrx * 2 / n * 0.92), Math.ceil(hgt / 4) - 1);
        }
    }
    dither(g, [[-rrx, -hgt], [rrx, -hgt], [rrx, 0], [-rrx, 0]], 'rgba(70,92,62,.35)', 0.09, rng);   // moss in the joints
    g.fillStyle = '#4a4335'; g.beginPath(); g.ellipse(0, -hgt, rrx, rry, 0, 0, TAU); g.fill();
    g.fillStyle = '#0a0810'; g.beginPath(); g.ellipse(0, -hgt + 1, rrx * 0.66, rry * 0.66, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(120,150,190,.16)'; g.lineWidth = 1;                  // water, a long way down
    g.beginPath(); g.ellipse(0, -hgt + 3, rrx * 0.4, rry * 0.4, 0, 0, TAU); g.stroke();
    // two posts, a windlass, a rope and a bucket
    var ph = 34;
    px(g, -rrx * 0.72 - 2, -hgt - ph, 5, ph, '#3a3024');
    px(g, rrx * 0.72 - 3, -hgt - ph, 5, ph, '#453a2c');
    poly(g, [[-rrx * 0.8, -hgt - ph], [rrx * 0.8, -hgt - ph], [rrx * 0.66, -hgt - ph - 9], [-rrx * 0.66, -hgt - ph - 9]], '#2e2718');
    px(g, -rrx * 0.72, -hgt - ph + 6, rrx * 1.44, 7, '#4a3f2c');               // the barrel of the windlass
    for (var w2 = 0; w2 < 5; w2++) px(g, -rrx * 0.6 + w2 * (rrx * 0.3), -hgt - ph + 6, 1, 7, '#2a2218');
    line(g, rrx * 0.72, -hgt - ph + 9, rrx * 0.92, -hgt - ph + 14, '#4a3f2c', 3);   // the crank
    line(g, -4, -hgt - ph + 13, -4, -hgt - 12, '#5c5240', 1);                  // the rope
    px(g, -9, -hgt - 12, 11, 9, '#3e3426');                                    // and the bucket on the end
    px(g, -9, -hgt - 12, 11, 2, '#584a34');
    px(g, -9, -hgt - 6, 11, 1, '#584a34');
};
PAINT.fence = function (g, c) {
    var rng = c.rng, hgt = c.hgt, long = c.bw >= c.bh;
    var span = long ? c.bw : c.bh;
    var n = Math.max(2, Math.round(span * 2.1));
    // the run has to follow the long axis of the footprint. It used to be
    // pinned to the south-west edge, so a fence running north-south was a
    // row of sticks with its rails stacked up at one end.
    function at(q) {
        var u = long ? c.bw * q : c.bw / 2, v = long ? c.bh / 2 : c.bh * q;
        /* No + TILE_H/2 here. This is sprite-local space, where lx/ly
           already put the footprint centre at the origin, and every other
           painter and contactShadow work in it unshifted. It was a patch
           for the actor offset that used to live in isoY's callers, and
           it put nine fences' rails half a tile off their own contact
           shadow and collision box. */
        return [c.lx(u, v), c.ly(u, v)];
    }
    var A = at(0), B = at(1);
    var gap0 = 0.52, gap1 = 0.72;                                              // a stretch nobody has mended
    function rail(dy, col, w) {
        if (c.v !== 1) { line(g, A[0], A[1] - hgt - dy, B[0], B[1] - hgt - dy, col, w); return; }
        var m0 = [A[0] + (B[0] - A[0]) * gap0, A[1] + (B[1] - A[1]) * gap0];
        var m1 = [A[0] + (B[0] - A[0]) * gap1, A[1] + (B[1] - A[1]) * gap1];
        line(g, A[0], A[1] - hgt - dy, m0[0], m0[1] - hgt - dy, col, w);
        line(g, m1[0], m1[1] - hgt - dy, B[0], B[1] - hgt - dy, col, w);
    }
    rail(-10, '#3a3024', 3);                                                    // lower rail
    for (var i = 0; i <= n; i++) {
        var q = i / n;
        if (c.v === 1 && q > gap0 && q < gap1) continue;
        var p = at(q);
        var lean = ((i * 7 + c.v * 3) % 5) - 2, h2 = hgt + 5 + ((i * 5) % 4);
        line(g, p[0], p[1], p[0] + lean, p[1] - h2, '#4c3f2e', 3);
        line(g, p[0] - 1, p[1] - 2, p[0] + lean - 1, p[1] - h2 + 2, '#5e4f38', 1);
        px(g, p[0] + lean - 2, p[1] - h2 - 2, 4, 3, '#3a2f22');                 // a cut top, greyed off
        if (rng() < 0.3) px(g, p[0] + lean - 3, p[1] - h2 * 0.4, 2, 2, 'rgba(80,100,70,.5)');
    }
    rail(2, '#463a2a', 3);                                                      // top rail
    rail(3, '#5a4c36', 1);
    if (c.v === 2) {                                                            // a rail lashed back on with rope
        var m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - hgt - 2];
        for (var w3 = 0; w3 < 4; w3++) line(g, m[0] - 4, m[1] - 2 + w3, m[0] + 5, m[1] + 1 + w3, '#6a5c40', 1);
    }
};
/* The two posts at the end of the fence, with nothing between them. It
   is the thing the whole road is about, so it has to read as the end of
   a fence and not as a crate: a slender squared timber, silvered by
   weather, with the empty mortise holes the rails came out of. */
PAINT.post = function (g, c) {
    var hgt = c.hgt, rng = c.rng;
    var f = body(g, c, ['#5b5243', '#3b352b', '#6d6455']);                     // silvered, not fresh timber
    for (var i = 1; i < 3; i++) { var a = qp(f.sw, i / 3, 0), b = qp(f.sw, i / 3, 1); line(g, a[0], a[1], b[0], b[1], 'rgba(0,0,0,.35)', 1); }
    poly(g, f.top, '#7a7263');
    dither(g, f.top, 'rgba(30,26,18,.5)', 0.34, rng);                          // the sawn end, gone grey
    // the mortises, empty. This is where the rail was, and it is not here.
    [0.28, 0.6].forEach(function (v) {
        var m0 = qp(f.sw, 0.16, v), m1 = qp(f.sw, 0.84, v);
        poly(g, [m0, m1, [m1[0], m1[1] + 5], [m0[0], m0[1] + 5]], '#181410');
        line(g, m0[0], m0[1], m1[0], m1[1], 'rgba(150,142,124,.35)', 1);
        var p0 = qp(f.se, 0.12, v), p1 = qp(f.se, 0.5, v);
        poly(g, [p0, p1, [p1[0], p1[1] + 5], [p0[0], p0[1] + 5]], '#141110');
    });
    var nl = qp(f.sw, 0.3, 0.46);
    px(g, nl[0], nl[1], 2, 2, '#6d6a62');                                      // one nail left in it
    dither(g, f.sw, 'rgba(86,104,74,.3)', 0.14, rng);                          // lichen, on the weather side
    dither(g, f.sw, 'rgba(180,176,164,.16)', 0.1, rng);                        // and the silvering itself
};
PAINT.beam = function (g, c) {
    var f = body(g, c);
    for (var i = 1; i < 4; i++) { var a = qp(f.sw, i / 4, 0), b = qp(f.sw, i / 4, 1); line(g, a[0], a[1], b[0], b[1], 'rgba(0,0,0,.35)', 1); }
    bar(g, f.top, 0.2, 0.8, 0.5, 2, 'rgba(255,240,210,.07)');               // the lit top arris
    var m = qp(f.sw, 0.5, 0.4);
    px(g, m[0] - 2, m[1], 4, 4, '#241c14');                                     // a peg through the joint
};
PAINT.crate = function (g, c) {
    var rng = c.rng, f = body(g, c);
    [f.sw, f.se].forEach(function (q, qi) {
        for (var i = 1; i < 4; i++) { var a = qp(q, i / 4, 0), b = qp(q, i / 4, 1); line(g, a[0], a[1], b[0], b[1], 'rgba(0,0,0,.4)', 1); }
        var t1 = qp(q, 0, 0.3), t2 = qp(q, 1, 0.3);
        line(g, t1[0], t1[1], t2[0], t2[1], '#6a5a40', 2);                      // batten
        line(g, t1[0], t1[1] - 1, t2[0], t2[1] - 1, '#7d6b4c', 1);
        if (qi === 0) { var d1 = qp(q, 0, 1), d2 = qp(q, 1, 0.12); line(g, d1[0], d1[1], d2[0], d2[1], 'rgba(130,110,78,.5)', 1); }
        dither(g, q, 'rgba(20,14,8,.4)', 0.1, rng);
    });
    poly(g, f.top, '#63523c');
    for (var s = 1; s < 3; s++) { var a2 = qp(f.top, s / 3, 0), b2 = qp(f.top, s / 3, 1); line(g, a2[0], a2[1], b2[0], b2[1], 'rgba(0,0,0,.3)', 1); }
    if (c.v === 1) { var st = qp(f.top, 0.5, 0.5); px(g, st[0] - 5, st[1] - 2, 10, 5, 'rgba(180,150,100,.25)'); }   // a stencil, faded
};
PAINT.barrel = function (g, c) {
    var rng = c.rng, hgt = c.hgt, rrx = c.rrx, rry = c.rry;
    // a barrel bulges: draw it as stacked slices so the belly is real
    for (var s = 0; s <= hgt; s++) {
        var q = s / hgt, bulge = 1 + Math.sin(q * Math.PI) * 0.1;
        var w = rrx * bulge;
        px(g, -w, -s, w * 2, 1, '#3f3226');
        px(g, -w, -s, w * 0.72, 1, '#54432f');
        px(g, w * 0.44, -s, w * 0.56, 1, '#31271c');
    }
    g.fillStyle = '#31271c'; g.beginPath(); g.ellipse(0, 0, rrx, rry, 0, 0, TAU); g.fill();
    for (var st = -3; st <= 3; st++) {                                          // staves
        var sxx = rrx * st * 0.26;
        line(g, sxx, -hgt + 2, sxx * 1.1, -rry * 0.3, 'rgba(20,14,8,.4)', 1);
    }
    [0.78, 0.5, 0.16].forEach(function (q2, qi) {                               // iron hoops
        var yy = -hgt * q2, bulge2 = 1 + Math.sin((1 - q2) * Math.PI) * 0.1;
        g.strokeStyle = qi === 1 ? '#5a5048' : '#6a5f52'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(0, yy, rrx * bulge2, rry * bulge2 * 0.9, 0, 0, Math.PI); g.stroke();
        g.strokeStyle = 'rgba(150,140,128,.4)'; g.lineWidth = 1;
        g.beginPath(); g.ellipse(0, yy - 1, rrx * bulge2, rry * bulge2 * 0.9, 0, 0.5, Math.PI - 1.4); g.stroke();
    });
    g.fillStyle = '#4a3c2c'; g.beginPath(); g.ellipse(0, -hgt, rrx, rry, 0, 0, TAU); g.fill();
    g.fillStyle = '#3a2e22'; g.beginPath(); g.ellipse(0, -hgt, rrx * 0.86, rry * 0.86, 0, 0, TAU); g.fill();
    for (var pl = -2; pl <= 2; pl++) line(g, pl * rrx * 0.34, -hgt - rry * 0.7, pl * rrx * 0.34, -hgt + rry * 0.7, 'rgba(18,12,8,.5)', 1);
    if (c.v === 1) { px(g, -rrx * 0.2, -hgt * 0.5, 5, 4, '#2a2118'); px(g, -rrx * 0.2 + 1, -hgt * 0.5 + 1, 3, 2, '#161009'); }   // a bung
    dither(g, [[-rrx, -hgt], [rrx, -hgt], [rrx, 0], [-rrx, 0]], 'rgba(0,0,0,.3)', 0.08, rng);
};
PAINT.sack = function (g, c) {
    var rng = c.rng, hgt = c.hgt, rrx = c.rrx, rry = c.rry;
    var empty = c.v === 2;                                                      // a slack sack in a hungry year
    var sq = empty ? 0.55 : 1;
    pxEllipse(g, 0, -hgt / 2 * sq, rrx * 0.96, (rry + hgt / 2) * sq, '#463d29');
    pxEllipse(g, -rrx * 0.09, (-hgt * 0.6 - rry * 0.2) * sq, rrx * 0.8, (rry + hgt / 2) * 0.72 * sq, '#5a4f36');
    pxEllipse(g, -rrx * 0.2, (-hgt * 0.8 - rry * 0.4) * sq, rrx * 0.46, (rry + hgt / 2) * 0.34 * sq, '#6c5f44');
    var bb = ellipsePoly(0, -hgt / 2 * sq, rrx * 0.96, (rry + hgt / 2) * sq);   // the sack, not its bounding box
    dither(g, bb, 'rgba(120,106,74,.4)', 0.14, rng);                            // hessian weave
    dither(g, bb, 'rgba(40,32,18,.4)', 0.13, rng);
    for (var f = 0; f < 4; f++) {                                               // folds where the cloth gathers
        var fx = -rrx * 0.6 + f * rrx * 0.4;
        line(g, fx, -rry * 0.2 * sq, fx + 3, (-hgt * 0.7 - rry * 0.4) * sq, 'rgba(36,30,18,.45)', 1);
    }
    var ny = (-rry - hgt / 2 * sq) - (rry + hgt / 2) * sq * 0.5;
    px(g, -4, ny, 8, 5, '#3b3220');                                             // the neck, tied
    line(g, -5, ny + 2, 5, ny + 2, '#7d6c48', 1);
    px(g, -2, ny - 4, 4, 4, '#584c33');
    if (!empty) { px(g, rrx * 0.3, rry * 0.3, 3, 2, '#c8b98a'); px(g, rrx * 0.3 + 3, rry * 0.4, 2, 2, '#b3a479'); }   // spilled grain
};
PAINT.cart = function (g, c) {
    var rng = c.rng, hgt = c.hgt;
    var f = body(g, c, ['#4a3d2a', '#33291c', '#5c4d36']);
    for (var i = 1; i < 6; i++) { var a = qp(f.sw, i / 6, 0), b = qp(f.sw, i / 6, 1); line(g, a[0], a[1], b[0], b[1], 'rgba(0,0,0,.35)', 1); }
    poly(g, f.top, '#5a4b34');
    for (var s = 1; s < 5; s++) { var a2 = qp(f.top, s / 5, 0), b2 = qp(f.top, s / 5, 1); line(g, a2[0], a2[1], b2[0], b2[1], 'rgba(0,0,0,.3)', 1); }
    // rails, and the empty bed under them
    [[c.x3, c.y3], [c.x2, c.y2]].forEach(function () {});
    line(g, c.x3, c.y3 - hgt - 12, c.x2, c.y2 - hgt - 12, '#5c4a32', 3);
    line(g, c.x3, c.y3 - hgt, c.x3, c.y3 - hgt - 12, '#5c4a32', 3);
    line(g, c.x2, c.y2 - hgt, c.x2, c.y2 - hgt - 12, '#5c4a32', 3);
    for (var r = 1; r < 4; r++) {
        var rq = r / 4, rx = c.x3 + (c.x2 - c.x3) * rq, ry2 = c.y3 + (c.y2 - c.y3) * rq;
        line(g, rx, ry2 - hgt, rx, ry2 - hgt - 12, '#4a3c28', 2);
    }
    /* two wheels with real spokes, and a shaft the horse has not been in
       for a while. They used to be placed at fw * u, and c.fw is the
       LENGTH of the sloped south-west edge, not a horizontal span: 12%
       too long, centred on the origin instead of on that side, so the
       rear wheel sat on the side of the cart and the front one was
       entirely on its tailgate, fifteen pixels off the ground. bar()
       exists because this exact mistake shipped once before. Take the
       points off the footprint quad like everything else does. */
    [[0.26, 9], [0.74, 8]].forEach(function (w) {
        var wp = qp(f.sw, w[0], 1), wr = w[1];
        var wx = wp[0], wy = wp[1] - wr + 1;
        g.strokeStyle = '#241c12'; g.lineWidth = 3;
        g.beginPath(); g.arc(wx, wy, wr, 0, TAU); g.stroke();
        g.strokeStyle = '#3e3220'; g.lineWidth = 1;
        for (var sp = 0; sp < 6; sp++) { var an = sp / 6 * Math.PI; line(g, wx - Math.cos(an) * wr, wy - Math.sin(an) * wr, wx + Math.cos(an) * wr, wy + Math.sin(an) * wr, '#3e3220', 1); }
        g.fillStyle = '#4a3c28'; g.beginPath(); g.arc(wx, wy, 2, 0, TAU); g.fill();
    });
    line(g, c.x3, c.y3 - hgt + 4, c.x3 - 14, c.y3 - hgt + 12, '#4a3c28', 3);
    dither(g, f.top, 'rgba(30,22,12,.5)', 0.14, rng);
};
PAINT.stone = PAINT.cairn = function (g, c) {
    var rng = c.rng, hgt = c.hgt, rrx = c.rrx, rry = c.rry, ty = -hgt;
    roundBody(g, c);
    var bb = roundShape(c);                                                     // the stone, not the rectangle it came in
    dither(g, bb, 'rgba(150,150,172,.28)', 0.14, rng);                          // grain in the rock
    dither(g, bb, 'rgba(14,12,20,.4)', 0.14, rng);
    g.strokeStyle = 'rgba(18,16,24,.5)'; g.lineWidth = 1;                       // a fault line, and a chip out of it
    g.beginPath();
    g.moveTo(-rrx * 0.34, ty - rry * 0.1); g.lineTo(-rrx * 0.02, ty + rry * 0.26); g.lineTo(rrx * 0.3, ty + rry * 0.16);
    g.stroke();
    for (var l = 0; l < 3; l++) {                                               // lichen, only on the weather side
        var lp = [-rrx * (0.2 + rng() * 0.5), ty - rry * (0.2 + rng() * 0.7)];
        g.fillStyle = 'rgba(104,124,88,.28)';
        g.beginPath(); g.ellipse(lp[0], lp[1], 3 + rng() * 4, 2 + rng() * 3, 0, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(210,210,230,.1)';
    g.beginPath(); g.ellipse(-rrx * 0.26, ty - rry * 0.6, rrx * 0.16, rry * 0.34, -0.5, 0, TAU); g.fill();
    if (c.t === 'cairn') {                                                      // somebody stacked these, one at a time
        var y2 = ty - rry - hgt * 0.14;
        g.fillStyle = c.pal[1]; g.beginPath(); g.ellipse(1, y2, rrx * 0.42, rry * 0.42, 0, 0, TAU); g.fill();
        g.fillStyle = c.pal[2]; g.beginPath(); g.ellipse(-rrx * 0.05, y2 - rry * 0.12, rrx * 0.26, rry * 0.24, 0, 0, TAU); g.fill();
        g.fillStyle = c.pal[0]; g.beginPath(); g.ellipse(rrx * 0.06, y2 - rry * 0.5, rrx * 0.2, rry * 0.2, 0, 0, TAU); g.fill();
        dither(g, [[-rrx * 0.5, y2 - rry], [rrx * 0.5, y2 - rry], [rrx * 0.5, y2 + rry * 0.4], [-rrx * 0.5, y2 + rry * 0.4]], 'rgba(14,12,20,.4)', 0.12, rng);
    }
};
PAINT.hedge = function (g, c) {
    var rng = c.rng, hgt = c.hgt, long = c.bw >= c.bh;
    var n = Math.max(5, Math.round((long ? c.bw : c.bh) * 3));
    for (var pass = 0; pass < 3; pass++) {
        var col = ['#16220f', '#22331a', '#334a26'][pass];
        // the passes stack UP from the ground rather than all sitting at
        // hgt: the bottom of the lowest one used to be fourteen pixels
        // clear of the contact shadow it casts, so the hedge floated
        var lift = pass * 5;
        for (var i = 0; i <= n; i++) {
            var q = i / n;
            var hx = long ? c.lx(c.bw * q, c.bh / 2) : c.lx(c.bw / 2, c.bh * q);
            var hy = long ? c.ly(c.bw * q, c.bh / 2) : c.ly(c.bw / 2, c.bh * q);
            g.fillStyle = col;
            pxEllipse(g, hx + (rng() - 0.5) * 6, hy - hgt * 0.4 - lift + (rng() - 0.5) * 5, 9 + rng() * 5, 6 + rng() * 4, col);
        }
    }
    for (var t = 0; t < 40; t++) {                                              // twigs poking out of a hedge nobody cuts
        var q2 = rng();
        var tx = long ? c.lx(c.bw * q2, c.bh / 2) : c.lx(c.bw / 2, c.bh * q2);
        var tyy = long ? c.ly(c.bw * q2, c.bh / 2) : c.ly(c.bw / 2, c.bh * q2);
        var a = rng() * TAU;
        line(g, tx, tyy - hgt - 3, tx + Math.cos(a) * 8, tyy - hgt - 3 + Math.sin(a) * 6, 'rgba(58,48,32,.7)', 1);
    }
};
PAINT.curtain = function (g, c) {
    var rng = c.rng, hgt = c.hgt;
    poly(g, [[c.x3, c.y3 - hgt], [c.x2, c.y2 - hgt], [c.x2, c.y2], [c.x3, c.y3]], '#3a1c22');
    var q = [[c.x3, c.y3 - hgt], [c.x2, c.y2 - hgt], [c.x2, c.y2], [c.x3, c.y3]];
    for (var f = 0; f < 22; f++) {                                              // heavy velvet takes deep folds
        var u = f / 22, w = 0.028 + (f % 3) * 0.008;
        var dark = f % 2 === 0;
        poly(g, [qp(q, u, 0.02), qp(q, u + w, 0.02), qp(q, u + w * 1.4, 1), qp(q, u, 1)], dark ? '#2a1218' : '#48242c');
    }
    dither(g, q, 'rgba(120,50,62,.24)', 0.07, rng);                             // the nap of the cloth
    dither(g, q, 'rgba(14,6,10,.5)', 0.07, rng);
    var moth = 5;
    for (var m = 0; m < moth; m++) {                                            // it has been in a damp loft for years
        var mp = qp(q, rng(), 0.3 + rng() * 0.6);
        g.fillStyle = 'rgba(20,10,14,.7)';
        g.beginPath(); g.ellipse(mp[0], mp[1], 2 + rng() * 3, 1 + rng() * 2, 0, 0, TAU); g.fill();
    }
    poly(g, [[c.x3, c.y3 - hgt - 5], [c.x2, c.y2 - hgt - 5], [c.x2, c.y2 - hgt + 2], [c.x3, c.y3 - hgt + 2]], '#5c3038');
    poly(g, [[c.x3, c.y3 - hgt - 5], [c.x2, c.y2 - hgt - 5], [c.x2, c.y2 - hgt - 3], [c.x3, c.y3 - hgt - 3]], '#7a4450');
    for (var r = 0; r < 12; r++) {                                              // rings on the pole
        var rp = qp(q, (r + 0.5) / 12, 0);
        g.strokeStyle = '#8a7a4a'; g.lineWidth = 1.5;
        g.beginPath(); g.arc(rp[0], rp[1] - 4, 3, 0, TAU); g.stroke();
    }
};
PAINT.foot = function (g, c) {
    var hgt = c.hgt;
    body(g, c, ['#332b1f', '#241e15', '#453a28']);
    for (var fl = 0; fl < 9; fl++) {
        var lq = (fl + 0.5) / 9;
        var lx2 = c.x3 + (c.x2 - c.x3) * lq, ly2 = c.y3 + (c.y2 - c.y3) * lq;
        px(g, lx2 - 4, ly2 - hgt - 7, 8, 8, '#1a1410');                          // a tin reflector
        px(g, lx2 - 3, ly2 - hgt - 6, 6, 6, '#4a4238');
        px(g, lx2 - 1, ly2 - hgt - 4, 2, 4, '#ffe0a0');
    }
};
LIVE.foot = function (cx, o, mxc, myc) {
    var d = propDef('foot'), hgt = d.h, b = o.b;
    var x3 = isoX(b[0], b[1] + b[3]), y3 = isoY(b[0], b[1] + b[3]);
    var x2 = isoX(b[0] + b[2], b[1] + b[3]), y2 = isoY(b[0] + b[2], b[1] + b[3]);
    cx.globalCompositeOperation = 'lighter';
    // Nine oil lamps in a row, and one of them is always going out. The
    // play has been lit like this for four hundred years.
    var guttering = Math.floor(RT.t / 3.7) % 9;
    var gphase = (RT.t / 3.7) % 1;
    for (var fl = 0; fl < 9; fl++) {
        var lq = (fl + 0.5) / 9, lx2 = x3 + (x2 - x3) * lq, ly2 = y3 + (y2 - y3) * lq - hgt - 4;
        var fk = 0.72 + Math.sin(RT.t * 6 + fl * 1.7) * 0.28;
        if (fl === guttering && gphase < 0.11) fk *= 0.28;
        var fg = cx.createRadialGradient(lx2, ly2, 1, lx2, ly2, 24);
        fg.addColorStop(0, 'rgba(255,190,90,' + (0.45 * fk).toFixed(3) + ')');
        fg.addColorStop(1, 'rgba(255,190,90,0)');
        cx.fillStyle = fg; cx.beginPath(); cx.arc(lx2, ly2, 24, 0, TAU); cx.fill();
    }
    cx.globalCompositeOperation = 'source-over';
};
PAINT.lamp = function (g, c) {
    var hgt = c.hgt;
    // a post nobody has painted since before the famine, and an iron bracket
    px(g, -2, -hgt, 4, hgt + 3, '#2a2620');
    px(g, -2, -hgt, 2, hgt + 3, '#3c3630');
    for (var r = 0; r < 4; r++) px(g, -3, -hgt * (0.2 + r * 0.22), 6, 1, '#231f19');
    line(g, 0, -hgt + 4, 7, -hgt - 2, '#2a2620', 2);
    px(g, -7, -hgt - 20, 14, 15, '#231d16');                                     // the lantern housing
    px(g, -5, -hgt - 18, 10, 11, '#100c08');
    px(g, -7, -hgt - 22, 14, 3, '#39312a');                                      // its little roof
    poly(g, [[-7, -hgt - 22], [0, -hgt - 28], [7, -hgt - 22]], '#39312a');
    px(g, -1, -hgt - 30, 2, 3, '#2a241d');                                       // the ring you hang it by
    for (var m = 0; m < 3; m++) px(g, -5 + m * 4, -hgt - 18, 1, 11, '#2f2820');  // glazing bars
    // four hundred ninth nights scorch a post. This is the only mark in
    // the game that is evidence of how long the lie has been kept.
    for (var s = 0; s < 8; s++) {
        var w = 5 - s * 0.5;
        px(g, -w / 2, -hgt - 24 - s, w, 1, 'rgba(11,9,18,' + (0.5 - s * 0.05).toFixed(2) + ')');
    }
};
LIVE.lamp = function (cx, o, mxc, myc) {
    var hgt = propDef('lamp').h;
    var fx = mxc, fy = myc - hgt - 12;
    // Nothing is alive out past the fence. Inside it, every flame has
    // two or three moths on it; on the road there are none, and that is
    // the whole difference between the two halves of the world.
    var wild = RT.place === 'road' || RT.place === 'hollow';
    var moths = wild ? 0 : 2, bump = 0;
    for (var m = 0; m < moths; m++) {
        var a = RT.t * (1.6 + m * 0.7) + m * 2.3 + o.b[0];
        var mx = fx + Math.cos(a) * (11 + m * 5), my = fy + Math.sin(a * 1.3) * (7 + m * 3);
        if (Math.abs(mx - fx) < 4 && Math.abs(my - fy) < 4) bump = 1;   // it hit the glass
        cx.fillStyle = 'rgba(226,214,180,.5)';
        cx.fillRect(Math.round(mx), Math.round(my), 2, 2);
    }
    var flick = 0.8 + Math.sin(RT.t * 7 + o.b[0] * 3) * 0.14 + Math.sin(RT.t * 17 + o.b[1]) * 0.06;
    cx.fillStyle = 'rgba(255,206,120,' + (0.55 + flick * 0.4).toFixed(2) + ')';
    cx.fillRect(Math.round(fx - 3), Math.round(fy - 4 - bump), 6, 8);
    cx.fillStyle = 'rgba(255,246,214,' + (0.5 + flick * 0.5).toFixed(2) + ')';
    cx.fillRect(Math.round(fx - 1), Math.round(fy - 3 - bump + Math.sin(RT.t * 9) * 0.6), 2, 4);
    cx.globalCompositeOperation = 'lighter';
    var lg = cx.createRadialGradient(fx, fy, 2, fx, fy, 40);
    lg.addColorStop(0, 'rgba(255,200,110,' + (0.34 * flick).toFixed(3) + ')');
    lg.addColorStop(0.4, 'rgba(255,190,90,' + (0.1 * flick).toFixed(3) + ')');
    lg.addColorStop(1, 'rgba(255,190,90,0)');
    cx.fillStyle = lg; cx.beginPath(); cx.arc(fx, fy, 40, 0, TAU); cx.fill();
    cx.globalCompositeOperation = 'source-over';
};
PAINT.table = PAINT.counter = function (g, c) {
    var rng = c.rng, hgt = c.hgt, f = body(g, c);
    poly(g, f.top, '#5e4a34');
    for (var s = 1; s < 5; s++) {                                                // boards, and the gaps between them
        var a = qp(f.top, s / 5, 0), b = qp(f.top, s / 5, 1);
        line(g, a[0], a[1], b[0], b[1], 'rgba(0,0,0,.35)', 1);
    }
    for (var k = 0; k < 40; k++) {                                               // grain, running with the boards
        var p = qp(f.top, rng(), rng());
        px(g, p[0], p[1], 2 + rng() * 5, 1, rng() < 0.5 ? 'rgba(110,88,60,.5)' : 'rgba(40,30,20,.4)');
    }
    var wear = [qp(f.top, 0.3, 0.25), qp(f.top, 0.7, 0.25), qp(f.top, 0.7, 0.75), qp(f.top, 0.3, 0.75)];
    poly(g, wear, 'rgba(140,116,80,.16)');                                       // where the elbows go
    dither(g, f.top, 'rgba(24,18,10,.4)', 0.06, rng);
    for (var i = 1; i < 5; i++) { var a2 = qp(f.sw, i / 5, 0), b2 = qp(f.sw, i / 5, 1); line(g, a2[0], a2[1], b2[0], b2[1], 'rgba(0,0,0,.3)', 1); }
    if (c.t === 'counter') {
        bar(g, f.sw, 0.03, 0.97, 0.055, 3, '#2a2118');                          // the shadow line under the lip
        var sc = qp(f.top, 0.24, 0.5);                                           // scales: she sells by weight
        line(g, sc[0], sc[1] - 14, sc[0], sc[1], '#3a3228', 2);
        line(g, sc[0] - 8, sc[1] - 14, sc[0] + 8, sc[1] - 14, '#3a3228', 1);
        g.fillStyle = '#4a4238';
        g.beginPath(); g.ellipse(sc[0] - 8, sc[1] - 10, 4, 2, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(sc[0] + 8, sc[1] - 11, 4, 2, 0, 0, TAU); g.fill();
        var lg2 = qp(f.top, 0.68, 0.5);                                          // and a ledger, open
        px(g, lg2[0] - 7, lg2[1] - 3, 14, 6, '#cabf9e');
        px(g, lg2[0] - 1, lg2[1] - 3, 2, 6, '#9d9377');
        for (var ln = 0; ln < 3; ln++) px(g, lg2[0] - 5, lg2[1] - 2 + ln * 2, 4, 1, 'rgba(60,50,40,.6)');
    } else {
        var bowl = qp(f.top, 0.62, 0.44);                                        // a bowl, and not much in it
        g.fillStyle = '#4a4640'; g.beginPath(); g.ellipse(bowl[0], bowl[1], 7, 4, 0, 0, TAU); g.fill();
        g.fillStyle = '#20201c'; g.beginPath(); g.ellipse(bowl[0], bowl[1], 5, 2.6, 0, 0, TAU); g.fill();
        var cnd = qp(f.top, 0.34, 0.5);
        px(g, cnd[0] - 2, cnd[1] - 9, 4, 9, '#d8cfae');                          // a candle burned most of the way down
        px(g, cnd[0] - 1, cnd[1] - 11, 2, 2, '#3a3228');
    }
};
PAINT.shelf = function (g, c) {
    var rng = c.rng, hgt = c.hgt, f = body(g, c);
    var jars = ['#6a5a3a', '#4a5a5a', '#6a4a4a', '#5a5a3a', '#3f4a56'];
    for (var sh = 0; sh < 3; sh++) {
        var v = 0.08 + sh * 0.32;
        var a = qp(f.sw, 0, v), b = qp(f.sw, 1, v);
        // the contents first, standing on the board below
        for (var jr = 0; jr < 7; jr++) {
            if (rng() < 0.22) continue;                                          // gaps: stock she has sold, or cannot get
            var jq = (jr + 0.5) / 7, jp = qp(f.sw, jq, v);
            var jh = 6 + Math.round(rng() * 5), jw = 4 + Math.round(rng() * 3);
            px(g, jp[0] - jw / 2, jp[1] - jh, jw, jh, jars[(jr + sh) % 5]);
            px(g, jp[0] - jw / 2, jp[1] - jh, 1, jh, 'rgba(255,240,210,.16)');
            px(g, jp[0] - jw / 2, jp[1] - jh - 1, jw, 1, '#2a2620');              // a stopper
            if (rng() < 0.4) px(g, jp[0] - jw / 2, jp[1] - jh + 2, jw, 2, 'rgba(230,220,190,.3)');   // a paper label
        }
        line(g, a[0], a[1], b[0], b[1], '#2c2118', 3);                            // the board itself
        line(g, a[0], a[1] - 1, b[0], b[1] - 1, '#5c4934', 1);
    }
    for (var u = 0; u < 2; u++) { var p1 = qp(f.sw, u ? 0.97 : 0.03, 0), p2 = qp(f.sw, u ? 0.97 : 0.03, 1); line(g, p1[0], p1[1], p2[0], p2[1], '#332818', 3); }
    dither(g, f.sw, 'rgba(0,0,0,.35)', 0.09, rng);
};
PAINT.bed = function (g, c) {
    var rng = c.rng, hgt = c.hgt;
    body(g, c, ['#332b22', '#241e18', '#413528']);                                // the frame
    var top = [[c.x0, c.y0 - hgt], [c.x1, c.y1 - hgt], [c.x2, c.y2 - hgt], [c.x3, c.y3 - hgt]];
    poly(g, top, '#4a4056');                                                      // a straw mattress under a blanket
    var blanket = [qp(top, 0.06, 0.3), qp(top, 0.94, 0.3), qp(top, 0.94, 0.96), qp(top, 0.06, 0.96)];
    poly(g, blanket, '#514463');
    for (var f = 0; f < 7; f++) {                                                 // the creases of a bed slept in
        var u = f / 7;
        var a = qp(blanket, u, 0), b = qp(blanket, u + 0.03, 1);
        line(g, a[0], a[1], b[0], b[1], 'rgba(38,30,50,.5)', 2);
    }
    poly(g, [qp(blanket, 0, 0), qp(blanket, 1, 0), qp(blanket, 1, 0.12), qp(blanket, 0, 0.12)], '#6a5b7e');
    dither(g, blanket, 'rgba(90,78,110,.4)', 0.1, rng);
    var hp = qp(top, 0.2, 0.16);
    g.fillStyle = '#cfc6b6'; g.beginPath(); g.ellipse(hp[0], hp[1], 10, 6, -0.2, 0, TAU); g.fill();
    g.fillStyle = '#b3a998'; g.beginPath(); g.ellipse(hp[0] + 2, hp[1] + 2, 7, 3.4, -0.2, 0, TAU); g.fill();
    px(g, c.x3 + 2, c.y3 - hgt - 16, 3, 17, '#3a3024');                           // the head board posts
    px(g, c.x0 - 2, c.y0 - hgt - 16, 3, 17, '#453927');
    line(g, c.x3 + 3, c.y3 - hgt - 15, c.x0, c.y0 - hgt - 15, '#3f3427', 2);
};
PAINT.vat = function (g, c) {
    var rng = c.rng, hgt = c.hgt, rrx = c.rrx, rry = c.rry;
    cylBody(g, c);
    for (var s = -3; s <= 3; s++) line(g, rrx * s * 0.28, -hgt + 2, rrx * s * 0.3, -rry * 0.2, 'rgba(18,16,12,.4)', 1);
    [0.8, 0.2].forEach(function (q) {                                             // iron bands round the tub
        g.strokeStyle = '#5a5248'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(0, -hgt * q, rrx, rry * 0.92, 0, 0, Math.PI); g.stroke();
    });
    g.fillStyle = '#1b1a16'; g.beginPath(); g.ellipse(0, -hgt, rrx * 0.84, rry * 0.84, 0, 0, TAU); g.fill();
    g.fillStyle = '#e2d6ae'; g.beginPath(); g.ellipse(0, -hgt + 2, rrx * 0.7, rry * 0.7, 0, 0, TAU); g.fill();
    g.fillStyle = '#cbbd93'; g.beginPath(); g.ellipse(rrx * 0.12, -hgt + 3, rrx * 0.5, rry * 0.5, 0, 0, TAU); g.fill();
    // the skin that forms on cooling wax, and the wicks hung to dip
    g.strokeStyle = 'rgba(255,250,226,.5)'; g.lineWidth = 1;
    g.beginPath(); g.ellipse(-rrx * 0.16, -hgt + 1, rrx * 0.44, rry * 0.42, 0, 0, TAU); g.stroke();
    for (var w = 0; w < 4; w++) {
        var wx = -rrx * 0.5 + w * rrx * 0.34;
        line(g, wx, -hgt - 18, wx, -hgt + 1, '#b8a97f', 1);
        px(g, wx - 2, -hgt - 8, 4, 9, '#efe3bc');                                 // a candle taking shape
        px(g, wx - 2, -hgt - 8, 1, 9, '#fff8dc');
    }
    line(g, -rrx * 0.62, -hgt - 18, rrx * 0.62, -hgt - 18, '#4a4238', 2);
    dither(g, [[-rrx, -hgt], [rrx, -hgt], [rrx, 0], [-rrx, 0]], 'rgba(220,208,170,.16)', 0.05, rng);   // wax splashes
};
/* ── the fire. An interior with no fire in it is a set, not a room. ── */
PAINT.hearth = function (g, c) {
    var rng = c.rng, hgt = c.hgt, rrx = c.rrx;
    var f = body(g, c);
    // a rubble stone chimney breast, course by course
    [[f.sw, true], [f.se, false]].forEach(function (pair) {
        var q = pair[0], lit = pair[1];
        for (var s = 0; s < 46; s++) {
            var p = qp(q, rng(), rng());
            g.fillStyle = shadeHex(lit ? '#4c4844' : '#332f2c', 0.82 + rng() * 0.4);
            g.beginPath(); g.ellipse(p[0], p[1], 3 + rng() * 5, 2 + rng() * 2.6, 0, 0, TAU); g.fill();
        }
        dither(g, q, 'rgba(10,8,10,.45)', 0.16, rng);
    });
    // the opening, blackened, with a lintel over it
    var o0 = qp(f.sw, 0.18, 0.42), o1 = qp(f.sw, 0.82, 0.42);
    var o2 = qp(f.sw, 0.82, 1), o3 = qp(f.sw, 0.18, 1);
    poly(g, [o0, o1, o2, o3], '#0b0808');
    px(g, o0[0] - 4, o0[1] - 5, (o1[0] - o0[0]) + 8, 5, '#57524c');              // the lintel stone
    px(g, o0[0] - 4, o0[1] - 6, (o1[0] - o0[0]) + 8, 1, '#6c665e');
    dither(g, [[o0[0] - 6, o0[1] - 14], [o1[0] + 6, o1[1] - 14], [o1[0] + 6, o1[1] - 4], [o0[0] - 6, o0[1] - 4]], 'rgba(6,4,4,.6)', 0.4, rng);   // soot up the breast
    /* logs and ash in the grate. bx is the middle of the opening, so by
       has to be the floor of the opening AT THE MIDDLE. It used to take
       the y off o2, which is the opening's bottom edge at its RIGHT end,
       and the foot of this face slopes half a pixel per pixel, so the
       grate landed five pixels below the floor of its own fireplace and
       the logs marched further out westward from there. */
    var bx = (o0[0] + o1[0]) / 2, by = qp(f.sw, 0.5, 1)[1] - 5;
    c.at('fire', bx, by);                                                       // the fire burns where the logs are
    g.fillStyle = '#5a5148'; g.beginPath(); g.ellipse(bx, by + 2, (o1[0] - o0[0]) * 0.4, 4, 0, 0, TAU); g.fill();
    for (var l = 0; l < 4; l++) {
        var lxp = bx - 12 + l * 7, lyp = by - (l % 2) * 3;
        px(g, lxp, lyp, 12, 4, l % 2 ? '#2e241c' : '#3a2c20');
        px(g, lxp, lyp, 12, 1, '#4a3a2a');
        px(g, lxp + (l % 2 ? 11 : 0), lyp, 2, 4, '#1a1310');                     // the charred end
    }
    // a pot on a chain: the reason a fire is kept in at all
    px(g, bx - 2, o0[1] - 3, 2, 9, '#3a3630');
    g.fillStyle = '#2b2724';
    g.beginPath(); g.ellipse(bx, by - 11, 9, 7, 0, 0, TAU); g.fill();
    g.fillStyle = '#1b1815';
    g.beginPath(); g.ellipse(bx, by - 14, 8, 3.4, 0, 0, TAU); g.fill();
    g.strokeStyle = '#4a453e'; g.lineWidth = 1;
    g.beginPath(); g.arc(bx, by - 15, 8, Math.PI, 0); g.stroke();
    px(g, o1[0] + 2, o1[1] + 6, 3, 12, '#3a342c');                               // the poker, leaning
};
LIVE.hearth = function (cx, o, mxc, myc, sp) {
    var fp = anchorAt(sp, 'fire', mxc, myc);
    var bx = fp.x, by = fp.y;
    for (var i = 0; i < 7; i++) {                                                // tongues, each on its own clock
        var ph = RT.t * (3.4 + i * 0.6) + i * 1.9;
        var lift = (Math.sin(ph) * 0.5 + 0.5);
        var fx = bx - 13 + i * 4.4 + Math.sin(ph * 1.7) * 1.6;
        var fh = 6 + lift * 11;
        cx.fillStyle = 'rgba(216,86,26,.55)';
        cx.fillRect(Math.round(fx - 2), Math.round(by - fh), 4, Math.round(fh));
        cx.fillStyle = 'rgba(255,160,52,.75)';
        cx.fillRect(Math.round(fx - 1), Math.round(by - fh * 0.72), 2, Math.round(fh * 0.72));
        if (lift > 0.7) { cx.fillStyle = 'rgba(255,232,180,.8)'; cx.fillRect(Math.round(fx - 1), Math.round(by - fh - 2), 2, 3); }
    }
    cx.globalCompositeOperation = 'lighter';
    var fk = 0.84 + Math.sin(RT.t * 5.3) * 0.1 + Math.sin(RT.t * 13.1) * 0.06;
    var gr = cx.createRadialGradient(bx, by - 6, 2, bx, by - 6, 62);
    gr.addColorStop(0, 'rgba(255,152,60,' + (0.4 * fk).toFixed(3) + ')');
    gr.addColorStop(0.45, 'rgba(255,130,44,' + (0.12 * fk).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(255,120,40,0)');
    cx.fillStyle = gr; cx.beginPath(); cx.arc(bx, by - 6, 62, 0, TAU); cx.fill();
    for (var s = 0; s < 4; s++) {                                                // embers going up the chimney
        var t = (RT.t * 0.7 + s * 0.25) % 1;
        cx.fillStyle = 'rgba(255,170,80,' + ((1 - t) * 0.7).toFixed(3) + ')';
        cx.fillRect(Math.round(bx - 8 + s * 5 + Math.sin(t * 7 + s) * 4), Math.round(by - 8 - t * 34), 1, 1);
    }
    cx.globalCompositeOperation = 'source-over';
};
PAINT.wall = function (g, c) {
    var rng = c.rng, hgt = c.hgt;
    var f = body(g, c);
    plaster(g, f.sw, true, rng);
    plaster(g, f.se, false, rng);
    timberFrame(g, f.sw, rng, true);
    timberFrame(g, f.se, rng, false);
    poly(g, f.top, '#4a4148');
    poly(g, [qp(f.sw, 0, 0), qp(f.sw, 1, 0), qp(f.sw, 1, 0.05), qp(f.sw, 0, 0.05)], 'rgba(12,9,16,.5)');
};
/* ─────────────── light ───────────────
   Every house sets a lamp on the sill. That is the name of the game, so
   it gets a pass of its own: darkness laid down flat, then punched back
   out around every flame in the place and around the lantern they put
   in your hand. */
/* Where the lamp stands on the sill, along the lit east wall. The
   painter and the light have to agree about this or the pool lands on
   the wrong side of the house: it used to be pinned near the south-west
   corner while the lantern was painted up to a hundred and fifty pixels
   away, which in a game named after a lamp on a sill is the one light
   that has to be right. One formula, read by both. */
function houseSillU(v) { return 0.3 + (v % 2) * 0.3; }
function lightsOf(p) {
    var out = [];
    (p.props || []).forEach(function (o) {
        var b = o.b;
        if (o.t === 'house') {
            // the `se` face runs from the south corner at u 0 to the east
            // corner at u 1, and the window centre sits just past lampU
            var u = houseSillU(propVar(o)) + 0.07;
            /* Clamped inside the floor. The sill is 0.2 past the east
               face, and for a house built against the east edge that put
               the light off the world: five of the twelve in the game,
               each spilling half its pool onto the black beyond the
               ground. Pull it back to the brink rather than moving the
               house, which is where the painter draws the window. */
            var W = p.w || GRID, H = p.h || GRID;
            out.push({ x: Math.min(b[0] + b[2] + 0.2, W - 0.35), y: clamp(b[1] + b[3] * (1 - u), 0.35, H - 0.35),
                       r: 3.6, c: '255,196,110', i: 0.95 });
        }
        else if (o.t === 'lamp') out.push({ x: b[0] + b[2] / 2, y: b[1] + b[3] / 2, r: 3.2, c: '255,206,120', i: 1 });
        else if (o.t === 'foot') out.push({ x: b[0] + b[2] / 2, y: b[1] + b[3] / 2, r: 4.4, c: '255,190,90', i: 0.7 });
        else if (o.t === 'mill') out.push({ x: b[0] + b[2] / 2, y: b[1] + b[3] + 0.3, r: 2.4, c: '255,190,120', i: 0.45 });
        else if (o.t === 'hearth') out.push({ x: b[0] + b[2] / 2, y: b[1] + b[3] + 0.4, r: 4.6, c: '255,168,78', i: 1.15 });
    });
    (p.lights || []).forEach(function (l) { out.push(l); });
    // and the one you set down yourself, which is the only lamp in the
    // game that is anywhere somebody chose rather than anywhere a house is
    /* The widow is carrying a lit lamp. It was a gradient inside drawNpc,
       which is under the veil, so the one lamp in the game somebody is
       actually holding threw half the light of a lamp on a sill. */
    (p.npcs || []).forEach(function (id) {
        var n = NPCS[id], pr = NPC_PROP[id];
        if (!n || !pr || !pr.glow) return;
        out.push({ x: npcX(n), y: npcY(n), r: 1.9, c: '255,200,110', i: 0.8 });
    });
    var mine = RT && lampAt(RT.place);
    if (mine) out.push({ x: mine.x, y: mine.y, r: 3.0, c: '255,206,120', i: 1 });
    return out;
}
function drawLights(cx) {
    var p = place(); if (!p.night) return;
    // Inside, the dark is warmer and there is less of it. You are in a
    // room with a fire in it, not standing in a field.
    if (p.indoor) cx.fillStyle = 'rgba(14,8,10,.34)';
    // `dark` means the lantern is the only light here, and it now says so
    // in the one place that decides how much dark there is
    else cx.fillStyle = 'rgba(6,5,14,' + (p.night >= 2 ? 0.66 : p.dark ? 0.6 : 0.5) + ')';
    /* -ight drops the night by 60% for fifty milliseconds. The corners
       of the room, which are dark in every other frame of this game,
       are visible, and so is anybody standing in them. That is a
       reveal. A white flash is a camera. */
    cx.globalAlpha = fxOf('punch').rev > 0 ? 0.4 : 1;
    fullRect(cx);                                 // was fillRect(0,0,VW,VH); pre-existing 9px shortfall
    cx.globalAlpha = 1;
    var ls = lightsOf(p);
    if (!RT.dead) ls.push({ x: RT.px, y: RT.py, r: 3.4, c: '255,214,150', i: 0.8, self: 1 });
    cx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < ls.length; i++) {
        var l = ls[i], sx = isoX(l.x, l.y), sy = isoYA(l.x, l.y);
        var rad = l.r * 30;
        if (sx < -rad || sx > VW + rad || sy < -rad * 2 || sy > VH + rad * 2) continue;
        /* The town's own lamps dip while a rhyme goes off and come
           back. It is the difference between a coloured rectangle
           composited over the frame and the light in the room
           changing, in a game named for a lamp on a sill, and it gives
           -ark its darkness on top of the dark pass for one multiply. */
        var fk = (l.self ? 1 : 0.88 + Math.sin(RT.t * 6.2 + l.x * 2.7 + l.y) * 0.12) * (1 - RT.flash * 0.6);
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
    /* This used to reach .92 black at radius 620 against a canvas whose
       corner is at 631, so the corners were all but solid and a house
       standing in one of them was throwing away every detail painted on
       it. The falloff still frames the player; it just stops eating the
       town to do it. */
    var ind = place().indoor, pz = fxOf('punch');
    if (pz.rev > 0) return;                       // -ight: for fifty milliseconds, nothing is hidden
    /* The frame narrows onto the blast and opens back up. It is the
       closest thing to a camera this game will ever have, it costs two
       terms in a gradient that is constructed every frame anyway, and
       unlike the zoom and the hold it still works at option level 1.
       The gradient's radius is 680 from the centre and the corner of
       the extended rect is about 650 away, so fullRect is safe with no
       change to the stops. */
    var sq = RT.flash * 70, cxx = lerp(VW / 2, pz.bx, clamp(RT.flash * 1.4, 0, 0.45));
    /* Rest is the common case by a very long way, and at rest this is the
       same 650,000 pixels of three stop gradient every frame forever. On a
       software canvas that measured 2.3 to 2.8ms, which is 62% of the
       square's world frame and rather more than all eight of its lamps put
       together; a blit is 0.08. So the still version is baked once per
       kind and only a frame that is actually moving the frame pays for the
       gradient. */
    if (sq === 0 && cxx === VW / 2) { cx.drawImage(vigBake(ind), -14, -14); return; }
    cx.fillStyle = vigGrad(cx, cxx, ind, sq); fullRect(cx);   // was fillRect(0,0,VW,VH): a 0.8 alpha wash nine pixels short of one edge
}
function vigGrad(cx, cxx, ind, sq) {
    var vg = cx.createRadialGradient(cxx, VH / 2 - 30, (ind ? 300 : 250) - sq, cxx, VH / 2, 680);
    vg.addColorStop(0, 'rgba(4,3,8,0)');
    vg.addColorStop(0.55, ind ? 'rgba(7,4,7,.2)' : 'rgba(4,3,8,.3)');
    vg.addColorStop(1, ind ? 'rgba(8,5,8,.6)' : 'rgba(4,3,8,.8)');
    return vg;
}
/* Two of them, indoor and out, painted the first time each is asked for.
   fullRect covers -14 to VW+14 because the shake translates the whole
   world and the wash must not come up short of an edge, so the bake is
   that size and is blitted at -14,-14 inside the same transform. */
var VIG = [null, null];
function vigBake(ind) {
    var i = ind ? 1 : 0;
    if (VIG[i]) return VIG[i];
    var cv = document.createElement('canvas');
    cv.width = VW + 28; cv.height = VH + 28;
    var g = cv.getContext('2d');
    g.translate(14, 14);                       // so the gradient is still centred on the canvas, not on the bake
    g.fillStyle = vigGrad(g, VW / 2, ind, 0);
    g.fillRect(-14, -14, VW + 28, VH + 28);
    return (VIG[i] = cv);
}
function freeVig() { VIG.forEach(function (c) { if (c) { c.width = c.height = 0; } }); VIG[0] = VIG[1] = null; }
/* Something you can look at has to be visible before you are told
   you can look at it. A small mark, brighter once you are close,
   duller once you have read it. */
function drawLooks(cx) {
    (place().looks || []).forEach(function (l, i) {
        var sx = isoX(l.x, l.y), sy = isoYA(l.x, l.y);
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
        var sx = isoX(e.x, e.y), sy = isoYA(e.x, e.y);
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
/* ── what each of them does when they think nobody is watching ──
   One gesture per person, and every one of them is that person's
   dialogue told again without words. They repeat on their own clock,
   so you catch them by standing still, which is the only way anybody
   has ever noticed anything in this town. */
var GESTURE = {
    bern: function (cx, w, h, t) {                  // patting his hip for a hat that is on his head
        var p = (t % 7) < 0.34 ? 1 : 0;
        cx.strokeStyle = 'rgba(0,0,0,.45)'; cx.lineWidth = 2.2;
        cx.beginPath(); cx.moveTo(-w * 0.75, -h * 0.62);
        cx.lineTo(-w * 0.95, -h * (p ? 0.3 : 0.42)); cx.stroke();
    },
    widow: function (cx, w, h, t) {                 // reaching for the sill, twice, and never lifting it
        var q = t % 9, up = (q < 0.7) ? q / 0.7 : (q > 1.3 && q < 2) ? (q - 1.3) / 0.7 : 0;
        cx.strokeStyle = 'rgba(0,0,0,.45)'; cx.lineWidth = 2.2;
        cx.beginPath(); cx.moveTo(w * 0.7, -h * 0.62);
        cx.lineTo(w * (0.9 + up * 0.5), -h * (0.62 + up * 0.28)); cx.stroke();
    },
    shepherd: function (cx, w, h, t) {              // whittling, because he has no sheep left to count
        var q = (t * 1.6) % 1;
        cx.strokeStyle = 'rgba(0,0,0,.45)'; cx.lineWidth = 2.2;
        cx.beginPath(); cx.moveTo(-w * 0.6, -h * 0.58); cx.lineTo(-w * 0.2, -h * (0.44 + q * 0.08)); cx.stroke();
        cx.fillStyle = '#9aa0a8'; cx.fillRect(Math.round(-w * 0.2), Math.round(-h * (0.46 + q * 0.08)), 1, 3);
        if (q > 0.86) { cx.fillStyle = 'rgba(150,128,88,.7)'; cx.fillRect(Math.round(-w * 0.1), Math.round(-h * 0.34 + (q - 0.86) * 40), 1, 1); }
    },
    busker: function (cx, w, h, t) {                // he does the walked-out-past-the-fence arm, to nobody
        var q = t % 2.4, out = q < 0.8 ? Math.sin(q / 0.8 * Math.PI) : 0;
        cx.strokeStyle = 'rgba(0,0,0,.45)'; cx.lineWidth = 2.2;
        cx.beginPath(); cx.moveTo(w * 0.7, -h * 0.6);
        cx.lineTo(w * (0.7 + out * 1.1), -h * (0.6 + out * 0.22)); cx.stroke();
        if (out > 0.5) { cx.fillStyle = 'rgba(0,0,0,.4)'; cx.fillRect(Math.round(w * (0.7 + out * 1.1) - 1), Math.round(-h * (0.6 + out * 0.22) - 1), 3, 3); }
    },
    hal: function (cx, w, h, t) {                   // his jaw opens, and nothing comes out of it
        if ((t % 12) > 11.6) { cx.fillStyle = '#0b0912'; cx.fillRect(Math.round(-1), Math.round(-h * 0.78), 2, 1); }
    },
    child: function (cx, w, h, t) {                 // barefoot, and the mend is on her knee
        cx.fillStyle = 'rgba(196,186,168,.4)';
        cx.fillRect(Math.round(-w * 0.4), Math.round(-h * 0.2), 3, 2);
    },
    chandler: function (cx, w, h, t) {              // wax on the apron: the only person in Wick with a trade
        cx.fillStyle = '#c4b98c'; cx.fillRect(Math.round(-w * 0.3), Math.round(-h * 0.4), 2, 2);
        cx.fillStyle = '#8e8a80';                   // and tin buttons, which nobody else has
        for (var b = 0; b < 3; b++) cx.fillRect(0, Math.round(-h * (0.66 - b * 0.08)), 2, 2);
    }
};
function drawNpc(cx, n) {
    var w2 = n.id ? npcRT(n.id) : { x: n.x, y: n.y, bob: RT.t * 2.4, moving: 0, face: 1 };
    var sx = isoX(w2.x, w2.y), sy = isoYA(w2.x, w2.y);
    if (sx < -70 || sx > VW + 70 || sy < -90 || sy > VH + 90) return;
    // standing still is a slow breath; walking is a step; the child skips
    var stride = w2.moving ? (n.skip ? 5.5 : 2.2) : 0.9;
    var bob = Math.abs(Math.sin(w2.bob)) * stride + (w2.moving ? 0 : Math.sin(w2.bob) * 0.4);
    var lean = w2.moving ? Math.sin(w2.bob) * 0.09 * (n.skip ? 2 : 1) : 0;
    var h = n.small ? 26 : 40;
    cx.save(); cx.translate(sx, sy - bob);
    cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(0, bob, 9, 3.6, 0, 0, TAU); cx.fill();
    cx.rotate(lean);
    var p = npcPal(n), spr;
    if (n.small) {
        spr = bake('npc.' + n.id, CHILD_SPR, p);          // a child is not an adult with short legs
    } else {
        /* three leg frames under whichever body this person is */
        var legs = LEGS_STAND, lk = 'S';
        if (w2.moving) {
            if (Math.sin(w2.bob) > 0) { legs = LEGS_WIDE; lk = 'W'; } else { legs = LEGS_PASS; lk = 'P'; }
        }
        spr = bake('npc.' + n.id + lk, fig(NPC_TOP[n.id] || ADULT_TOP, legs), p);
    }
    cx.save();
    if (w2.face < 0) cx.scale(-1, 1);                     // they turn to walk back
    blit(cx, spr, 0, 0);
    /* whatever they are carrying, hung off the same grid. The widow's
       lamp is the only one that gives light back. */
    var pr = NPC_PROP[n.id];
    if (pr) {
        blit(cx, bake('prop.' + pr.k + '.' + n.id, pr.s, p), pr.dx, pr.dy);
        if (pr.glow) {
            cx.save(); cx.globalCompositeOperation = 'lighter';
            var gg = cx.createRadialGradient(pr.dx, pr.dy - 7, 2, pr.dx, pr.dy - 7, 34);
            gg.addColorStop(0, 'rgba(255,200,110,.30)'); gg.addColorStop(1, 'rgba(255,190,90,0)');
            cx.fillStyle = gg; cx.beginPath(); cx.arc(pr.dx, pr.dy - 7, 34, 0, TAU); cx.fill();
            cx.restore();
        }
    }
    cx.restore();
    /* The idle gestures survive the move to baked figures: standing
       still, Bern pats his hip for a hat that is on his head, and the
       widow reaches for the sill twice and never lifts it. They hang off
       the figure rather than being part of it, so they stayed hand
       drawn. Half-width is the sprite's, not the old robe's. */
    if (!w2.moving && GESTURE[n.id]) GESTURE[n.id](cx, n.small ? 7 : 9, h, RT.t);
    cx.restore();
    /* The quiet mark that says they will talk to you is queued, not
       drawn. Everything inside drawNpc lands in the ents pass, which
       runs BEFORE drawLights lays the night down over the whole canvas,
       so the mark was losing half its contrast (two thirds in the
       hollow) and measured about three lit pixels. drawPrompt carries
       the same information and is drawn after the vignette and loses
       none of it, so the mark goes with it. */
    RT.marks.push({ x: sx, y: sy - h - 12 - bob, p: w2.y });
}
function drawTalkMarks(cx) {
    for (var i = 0; i < RT.marks.length; i++) {
        var m = RT.marks[i];
        cx.save(); cx.globalAlpha = 0.5 + Math.sin(RT.t * 2.6 + m.p) * 0.2;
        cx.fillStyle = '#c9a94a'; cx.font = 'bold 9px "Press Start 2P", monospace'; cx.textAlign = 'center';
        cx.fillText('·', m.x, m.y); cx.restore(); cx.textAlign = 'left';
    }
}
function drawPrompt(cx) {
    var o = RT.prompt; if (!o || RT.dialog) return;
    var sx = isoX(o.x, o.y), sy = isoYA(o.x, o.y);
    /* The key is a key now: a cap you can see is a cap, rather than the
       letter E and an em dash inside the sentence. A shut exit gets no
       cap at all, which is the whole of what shut means. */
    var open = !o.shut, txt = o.label;
    cx.save(); cx.font = '12px "Pixelify Sans"';
    var tw = Math.round(cx.measureText(txt).width);
    var kw = open ? 26 : 0;
    var w = tw + kw + 26, h = 28, x = Math.round(sx - w / 2), y = Math.round(sy - 84);
    uiSheet(cx, x, y, w, h, { rule: open ? '#6d5a2c' : '#2b2436', face: '#0e0a15',
                              orn: open ? '#c9a94a' : '#3d3750', drop: 4 });
    if (open) uiKey(cx, 'E', x + 10, y + 5, { w: 18, h: 18 });
    cx.fillStyle = open ? '#ece2cc' : '#8a8296';
    cx.textBaseline = 'alphabetic';
    cx.fillText(txt, x + 13 + kw, y + 19);
    cx.restore(); cx.textAlign = 'left';
}

/* ═══════════════ CANVAS CHROME ═══════════════
   Four pieces of interface are painted on the canvas rather than built in
   the DOM: the interact prompt, the achievement toasts, the Chorus's bar
   and the map. They were flat rgba rectangles with a 2px bar down one
   side, which is the same idiom the narration used in CSS, and it is the
   idiom the restyle exists to replace. These three helpers draw the same
   pressed frame the sheets do, in flat rects, so the canvas half of the
   UI and the DOM half are made of the same thing.

   Everything here is integer rects and no blur. cx is in screen space:
   call these AFTER the world transforms have closed. */
var UI_KEY = '#05040a';

/* the pressed frame. Same construction as the CSS: a hard drop, a black
   keyline, a rule in the sheet's own ink, the face, and 2px of light
   along the top edge because the lamp in this game is always above. */
function uiSheet(cx, x, y, w, h, o) {
    o = o || {};
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    var rule = o.rule || '#6d5a2c', face = o.face || '#100b16', drop = o.drop == null ? 5 : o.drop;
    if (drop) { cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(x + drop, y + drop, w, h); }
    cx.fillStyle = UI_KEY; cx.fillRect(x - 2, y - 2, w + 4, h + 4);
    cx.fillStyle = rule;  cx.fillRect(x, y, w, h);
    cx.fillStyle = face;  cx.fillRect(x + 3, y + 3, w - 6, h - 6);
    cx.fillStyle = 'rgba(255,255,255,.055)'; cx.fillRect(x + 3, y + 3, w - 6, 2);
    cx.fillStyle = 'rgba(0,0,0,.45)';        cx.fillRect(x + 3, y + h - 5, w - 6, 2);
    if (o.nails !== false) uiNails(cx, x, y, w, h, o.orn || '#c9a94a');
}
/* the corner hardware. Eleven pixels each way, three thick, on the rule
   itself rather than inside it, which is where a nail goes. */
function uiNails(cx, x, y, w, h, col) {
    cx.fillStyle = col;
    var L = 11, T = 3;
    cx.fillRect(x, y, L, T);                 cx.fillRect(x, y, T, L);
    cx.fillRect(x + w - L, y, L, T);         cx.fillRect(x + w - T, y, T, L);
    cx.fillRect(x, y + h - T, L, T);         cx.fillRect(x, y + h - L, T, L);
    cx.fillRect(x + w - L, y + h - T, L, T); cx.fillRect(x + w - T, y + h - L, T, L);
}
/* the diamond. The game's ornament: the mark on the ballad's broken rule,
   and now the mark for anything that is the one you want. */
function uiDiamond(cx, x, y, r, col) {
    cx.save(); cx.translate(Math.round(x), Math.round(y)); cx.rotate(Math.PI / 4);
    cx.fillStyle = col; cx.fillRect(-r, -r, r * 2, r * 2); cx.restore();
}
/* cut a string to a real measured width rather than to a character count.
   slice(0, 40) is a guess that is wrong twice: it clips a short line that
   would have fitted and it overruns a long one, and the toasts overran. */
function uiFit(cx, txt, w) {
    if (cx.measureText(txt).width <= w) return txt;
    var t = txt;
    while (t.length > 1 && cx.measureText(t + '\u2026').width > w) t = t.slice(0, -1);
    return t.replace(/[ ,.]+$/, '') + '\u2026';
}
/* a keycap, for the letter you actually press */
function uiKey(cx, ch, x, y, o) {
    o = o || {};
    var w = o.w || 18, h = o.h || 18;
    x = Math.round(x); y = Math.round(y);
    cx.fillStyle = UI_KEY; cx.fillRect(x, y + 3, w, h);
    cx.fillStyle = o.face || '#c9a94a'; cx.fillRect(x, y, w, h);
    cx.fillStyle = 'rgba(255,255,255,.35)'; cx.fillRect(x + 2, y + 2, w - 4, 2);
    cx.fillStyle = 'rgba(0,0,0,.35)'; cx.fillRect(x + 2, y + h - 4, w - 4, 2);
    cx.save(); cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
    cx.font = '8px "Press Start 2P", monospace';
    cx.fillStyle = o.ink || '#17100a';
    cx.fillText(ch, x + w / 2, y + h / 2 + 4);
    cx.restore(); cx.textAlign = 'left';
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
/* A hidden place you can still be standing in. Act 3's square IS the
   square, so the map lights the square while you are in it rather than
   lighting nothing at all for the whole final act. */
var MAP_STANDIN = { a3sq: 'square' };
function exitDir(p, e) {
    // An exit may say which way it goes. One does: the square's door to
    // the lane is called "the lane, north" and sits on the square's SOUTH
    // wall, because the north wall is behind two houses. Read off the
    // wall it is on, that door pointed south, the lane was placed below
    // Wick, and the mill then wanted the square's own cell and slid two
    // columns east onto Wick's row. The map drew a shape the world does
    // not have.
    if (e.dir) return e.dir;
    var W = p.w || GRID, H = p.h || GRID;
    var dx = e.x < W * 0.25 ? -1 : e.x > W * 0.75 ? 1 : 0;
    var dy = e.y < H * 0.25 ? -1 : e.y > H * 0.75 ? 1 : 0;
    if (dx && dy) { if (Math.abs(e.x - W / 2) / W > Math.abs(e.y - H / 2) / H) dy = 0; else dx = 0; }
    if (!dx && !dy) dy = -1;                      // a door in the middle of a room leads "in"
    return [dx, dy];
}
function buildMap() {
    var pos = {}, taken = {}, k;
    /* A place nobody can see does not hold a cell. Act 3's square is
       hidden and used to take the one Grelling wanted, which pushed
       Grelling a row north of the road it is actually on. Hidden places
       still get a position, they just do not make anybody else slide. */
    function hold(id, c) { pos[id] = c; if (!MAP_HIDE[id]) taken[c.join(',')] = id; }
    for (k in MAP_SEED) if (PLACES[k]) hold(k, MAP_SEED[k].slice());
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
            hold(e.to, c); q.push(e.to);
        });
    }
    // anything the graph never reached still gets a cell, off to one side
    var spare = 0;
    PLACE_IDS.forEach(function (id) {
        if (pos[id] || MAP_HIDE[id]) return;
        while (taken[(-1) + ',' + spare] && spare < 40) spare++;
        hold(id, [-1, spare]); spare++;
    });
    return pos;
}
var MAP_POS = buildMap();
/* the sheet the map is printed on. Fixed, so the composition does not
   move about as you discover places; the graph is centred inside it. */
var MAP_SH = { x: 0, y: 46, w: 0, h: 468, band: 46 };
function mapSheet() {
    MAP_SH.w = Math.min(VW - 96, 780);
    MAP_SH.x = Math.round((VW - MAP_SH.w) / 2);
    return MAP_SH;
}
/* the sheet, drawn once the graph's own size is known so an early save
   gets a small chart with one town on it rather than a big empty frame */
function mapDrawSheet(cx, gw, gh) {
    var SH = MAP_SH;
    SH.w = clamp(Math.round(gw) + 200, 470, Math.min(VW - 100, 780));
    SH.h = clamp(Math.round(gh) + SH.band + 150, 260, 428);
    SH.x = Math.round((VW - SH.w) / 2);
    SH.y = Math.round(38 + (392 - SH.h) / 2);
    uiSheet(cx, SH.x, SH.y, SH.w, SH.h, { rule: '#6d5a2c', face: '#0f0a16', drop: 7 });
    // the head band, and the triple rule a bill puts under a heading
    cx.fillStyle = '#241a30'; cx.fillRect(SH.x + 3, SH.y + 3, SH.w - 6, SH.band - 3);
    cx.fillStyle = 'rgba(255,255,255,.07)'; cx.fillRect(SH.x + 3, SH.y + 3, SH.w - 6, 2);
    cx.fillStyle = '#6d5a2c'; cx.fillRect(SH.x + 3, SH.y + SH.band, SH.w - 6, 3);
    cx.fillStyle = UI_KEY;   cx.fillRect(SH.x + 3, SH.y + SH.band + 3, SH.w - 6, 3);
    cx.fillStyle = 'rgba(201,169,74,.22)'; cx.fillRect(SH.x + 3, SH.y + SH.band + 6, SH.w - 6, 3);
    cx.save();
    cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
    cx.fillStyle = '#ffe66e'; cx.font = '16px "Press Start 2P", monospace';
    var TT = 'WHERE YOU HAVE BEEN', tty = SH.y + 32;
    cx.fillText(TT, VW / 2, tty);
    var thw = cx.measureText(TT).width / 2;
    uiDiamond(cx, VW / 2 - thw - 18, tty - 6, 4, '#c9a94a');
    uiDiamond(cx, VW / 2 + thw + 18, tty - 6, 4, '#c9a94a');
    cx.restore();
    return SH;
}
function drawMap(cx) {
    if (!RT.mapOpen) return;
    /* A flat wash, not a dither: the world under this is already near
       black and .screen::after multiplies a scanline over the whole game,
       so a checker on top of it reads as a broken render. */
    cx.fillStyle = 'rgba(5,4,9,.93)'; cx.fillRect(0, 0, VW, VH);
    cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
    var SH = MAP_SH;
    /* What the map is allowed to show is what you have been to, plus the
       far end of any road out of one of those. That is the same rule the
       link pass already used for the dashed roads; the node pass had no
       rule at all and plotted the whole world, so a cold save gave away
       that there are ten places in five columns before you had left the
       square. */
    var known = {};
    PLACE_IDS.forEach(function (id) {
        if (MAP_HIDE[id] || !S.seen['been_' + id]) return;
        known[id] = 1;
        (PLACES[id].exits || []).forEach(function (e) { if (!MAP_HIDE[e.to] && PLACES[e.to]) known[e.to] = 1; });
    });
    /* derived coordinates are not hand tuned to fit the panel, so the
       panel fits itself around them. The bounds are taken over what will
       actually be DRAWN, not over what has been visited: during the
       prologue you are on a hidden place, nothing was visited, and the
       old [0,0] fallback centred the panel on a cell nothing occupies
       and put most of the map off the bottom of the canvas. */
    var lo = [1e9, 1e9], hi = [-1e9, -1e9], any = false;
    PLACE_IDS.forEach(function (id) {
        var m = MAP_POS[id]; if (!m || MAP_HIDE[id] || !known[id]) return;
        any = true;
        lo[0] = Math.min(lo[0], m[0]); lo[1] = Math.min(lo[1], m[1]);
        hi[0] = Math.max(hi[0], m[0]); hi[1] = Math.max(hi[1], m[1]);
    });
    if (!any) {                                  // nowhere known yet: say so rather than drawing an empty grid
        SH = mapDrawSheet(cx, 0, 0);
        cx.fillStyle = '#a99c8a'; cx.font = '20px "VT323", monospace';
        cx.fillText('Nowhere yet.', VW / 2, SH.y + SH.band + (SH.h - SH.band) / 2);
        mapFoot(cx, SH);
        cx.textAlign = 'left';
        return;
    }
    var spanX = hi[0] - lo[0], spanY = hi[1] - lo[1];
    var cell = Math.min(100, Math.floor(Math.min(spanX ? 560 / spanX : 100, spanY ? 230 / spanY : 100)));
    cell = Math.max(46, cell);
    /* The sheet is cut to the chart, and the chart is centred in what is
       left under the head band. An early save gets a small sheet with one
       town on it rather than a big empty frame; the sheet grows with the
       world, which is the only thing on this screen that is a reward. */
    SH = mapDrawSheet(cx, spanX * cell, spanY * cell);
    var bodyTop = SH.y + SH.band + 12, bodyH = SH.h - SH.band - 12 - 40;
    var ox = VW / 2 - (lo[0] + spanX / 2) * cell;
    var oy = bodyTop + bodyH / 2 - (lo[1] + spanY / 2) * cell;
    // links first. A road you have walked is a ruled line; one you have
    // only heard of is a row of dots, which is how a chart marks a route
    // somebody told you about rather than one anybody surveyed.
    cx.lineWidth = 3;
    PLACE_IDS.forEach(function (id) {
        if (!MAP_POS[id] || !S.seen['been_' + id] || MAP_HIDE[id]) return;
        (PLACES[id].exits || []).forEach(function (e) {
            if (!MAP_POS[e.to] || MAP_HIDE[e.to]) return;
            var known = S.seen['been_' + e.to];
            var x0 = ox + MAP_POS[id][0] * cell, y0 = oy + MAP_POS[id][1] * cell;
            var x1 = ox + MAP_POS[e.to][0] * cell, y1 = oy + MAP_POS[e.to][1] * cell;
            if (known) {
                cx.strokeStyle = 'rgba(169,156,138,.44)';
                cx.beginPath(); cx.moveTo(Math.round(x0) + .5, Math.round(y0) + .5);
                cx.lineTo(Math.round(x1) + .5, Math.round(y1) + .5); cx.stroke();
            } else {
                var d = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.round(d / 9));
                cx.fillStyle = 'rgba(140,128,160,.34)';
                for (var t = 1; t < steps; t++) {
                    cx.fillRect(Math.round(x0 + (x1 - x0) * t / steps) - 1,
                                Math.round(y0 + (y1 - y0) * t / steps) - 1, 3, 3);
                }
            }
        });
    });
    /* You are somewhere even when the place you are in is hidden. Act 3's
       square is the same square, and without this the whole final act
       drew with no gold node anywhere, on the one screen whose only job
       is telling you where you are. */
    var hereId = MAP_STANDIN[RT.place] || RT.place;
    PLACE_IDS.forEach(function (id) {
        var m = MAP_POS[id]; if (!m || MAP_HIDE[id] || !known[id]) return;
        var seen = S.seen['been_' + id], here = hereId === id;
        // a room off a place you can already see is a door, not a settlement.
        // Drawn small and unlabelled, the main road reads as the road again.
        var room = !!PLACES[id].indoor;
        var x = Math.round(ox + m[0] * cell), y = Math.round(oy + m[1] * cell);
        /* Three marks, and they are shapes rather than three greys: where
           you are is the game's diamond, lit; a place you have walked is a
           filled square; one you have only heard of is an empty one. Under
           the desktop's multiply layer a difference of tone is not a
           difference, and a shape is. */
        if (here) {
            uiDiamond(cx, x, y, 11, '#5a4212');
            uiDiamond(cx, x, y, 8, '#ffe66e');
            uiDiamond(cx, x, y, 3, '#2a1e04');
        } else if (room) {
            var rr = seen ? 4 : 3;
            cx.fillStyle = UI_KEY; cx.fillRect(x - rr - 2, y - rr - 2, rr * 2 + 4, rr * 2 + 4);
            cx.fillStyle = seen ? '#8a8296' : '#2b2436';
            cx.fillRect(x - rr, y - rr, rr * 2, rr * 2);
        } else {
            var q = 8;
            cx.fillStyle = UI_KEY; cx.fillRect(x - q - 2, y - q - 2, q * 2 + 4, q * 2 + 4);
            if (seen) {
                cx.fillStyle = '#6d5a2c'; cx.fillRect(x - q, y - q, q * 2, q * 2);
                cx.fillStyle = '#c9a94a'; cx.fillRect(x - q + 2, y - q + 2, q * 2 - 4, q * 2 - 4);
                cx.fillStyle = '#3a2c0e'; cx.fillRect(x - 2, y - 2, 4, 4);
            } else {
                cx.fillStyle = '#2b2436'; cx.fillRect(x - q, y - q, q * 2, q * 2);
                cx.fillStyle = '#0f0a16'; cx.fillRect(x - q + 3, y - q + 3, q * 2 - 6, q * 2 - 6);
            }
        }
        if (room && !here) return;
        var nm = seen ? PLACES[id].n.split('\u2014')[0].trim() : '?';
        mapLabel(cx, nm, x, y + 30, cell - 6,
                 here ? '#ffe66e' : seen ? '#ece2cc' : '#56506a');
    });
    mapFoot(cx, SH);
    cx.textAlign = 'left';
}
/* A place name is a whole phrase and the cells are 46 to 100 wide, so
   "The lane out of Wick" used to print straight through "Grelling". It
   wraps to at most two lines inside its own cell now, and anything that
   still will not fit loses its article rather than its meaning. */
function mapLabel(cx, txt, x, y, maxw, col) {
    cx.font = '13px "Pixelify Sans"';
    var lines;
    if (cx.measureText(txt).width <= maxw) lines = [txt];
    else {
        // a chart drops the article before it drops a word
        var t2 = txt.replace(/^(The|A) /, '');
        if (cx.measureText(t2).width <= maxw) lines = [t2];
        else {
            var words = t2.split(' '), cur = words.shift();
            lines = [];
            while (words.length) {
                var t = cur + ' ' + words[0];
                if (cx.measureText(t).width > maxw && lines.length === 0) { lines.push(cur); cur = words.shift(); }
                else { cur = t; words.shift(); }
            }
            lines.push(cur);            // the tail runs long rather than going missing
        }
    }
    for (var j = 0; j < lines.length && j < 2; j++) {
        cx.fillStyle = '#05040a'; cx.fillText(lines[j], x + 1, y + j * 15 + 1);
        cx.fillStyle = col;       cx.fillText(lines[j], x, y + j * 15);
    }
}
/* the key, at the foot of the sheet: what the three marks mean, and the
   key you press to put it away. Inside the frame, because the HUD is a
   DOM sibling above the canvas and anything at VH-40 sits under it. */
function mapFoot(cx, SH) {
    var y = SH.y + SH.h - 26, x0 = SH.x + 22;
    cx.fillStyle = '#6d5a2c'; cx.fillRect(SH.x + 3, y - 15, SH.w - 6, 1);
    cx.save(); cx.textAlign = 'left'; cx.font = '13px "Pixelify Sans"';
    uiDiamond(cx, x0, y - 4, 5, '#ffe66e');
    cx.fillStyle = '#a99c8a'; cx.fillText('here', x0 + 12, y);
    var x1 = x0 + 70;
    cx.fillStyle = '#c9a94a'; cx.fillRect(x1 - 5, y - 9, 10, 10);
    cx.fillStyle = '#a99c8a'; cx.fillText('walked', x1 + 12, y);
    var x2 = x1 + 92;
    cx.fillStyle = '#2b2436'; cx.fillRect(x2 - 5, y - 9, 10, 10);
    cx.fillStyle = '#0f0a16'; cx.fillRect(x2 - 3, y - 7, 6, 6);
    cx.fillStyle = '#a99c8a'; cx.fillText('heard of', x2 + 12, y);
    cx.textAlign = 'right';
    cx.font = '8px "Press Start 2P", monospace'; cx.fillStyle = '#6c6478';
    cx.fillText('M TO CLOSE', SH.x + SH.w - 22, y - 2);
    cx.restore();
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
    if (q.nmap) {
        RT.mapOpen = true;
        /* .nn-map is set in updateHud, and nothing calls updateHud after
           this line: in a live browser rAF picks it up on the next frame,
           but the headless harness has no rAF and captured the chart with
           two lines of narration printed across the middle of it. */
        updateHud(0);
    }
    /* npoem: say a stanza's worth of words and close it, so the book page and
       the readback can be captured. The poem is the one built thing that a
       screenshot could not reach: it only exists after a fight, and devDemo
       has no way to fight one. Words are drawn from the pool you actually
       own, so npoem=1 after nfrag=3 reads differently from npoem=1 cold. */
    if (q.npoem) {
        poemStart();
        /* NOT `pw`. A var declared here is hoisted to the top of devDemo and
           shadows the pw() function for the whole of it, so `nfoes` threw
           "pw is not a function" on its first spawn and took the entire
           harness run down with it: no frames, no nkey, no __nnReady, and a
           screenshot of a game that had ignored every parameter after
           ndev. It looked exactly like the feature under test not working. */
        for (var pq = 0; pq < (+q.npoem || 1) * 3; pq++) {
            var run = irnd(2, 4), fam = null;
            for (var pj = 0; pj < run; pj++) {
                var word = headWord(); RT.line.shift(); fillLine();
                fam = WORDS[word];
                if (pj === run - 1 && irnd(0, 5) === 0) poemSwallow(word);
                else poemSay(word, fam, pj > 0 && WORDS[word] === fam ? 1 : 0);
            }
            poemBreak(fam);
        }
        if (q.npoem !== 'open') poemKeep(RT.place, RT.poem);
    }
    // the shop is gated on standing at the chandler; a capture has no legs
    if (q.npanel === 'shop') RT.items.atShop = true;
    if (q.npanel) panel(q.npanel);
    // the book opens on the ballad and the poem is below the fold, so a
    // capture of the thing you came to look at needs the scroll doing for it
    if (q.nscroll) {
        var pb = RT.root.querySelector('.nn-p-' + (q.npanel || 'book') + ' .nn-pb');
        if (pb) pb.scrollTop = q.nscroll === 'end' ? pb.scrollHeight : +q.nscroll;
    }
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
    // a doorway keeps the page. The close button has to as well, or losing
    // the verse depends on whether you happened to walk somewhere first.
    if (RT) { try { poemStash(); } catch (e) {} }
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
    freeSprites();      // and neither do the prop bitmaps
    freeVig();          // nor the two baked vignettes
    freeGlows();        // eleven 64 KB banded radials, same rule
    if (S) sSave();
    if (window.__ninth) delete window.__ninth;
    return hrs;
}
combatBoot();          // job 4: keybind + travel reset, once every var above exists
fxBoot();              // vfx: the effect registry, the punch tables, and the one shared travel reset
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

/* ═══════════════ THE PRINTED NOTE ═══════════════
   Four controls carried a `title` attribute, which meant the game's only
   hover help was an operating system tooltip: a white box in the host
   OS's own font, on a delay the game does not control, over a pixel
   canvas. It was the last piece of literal browser chrome left in here.

   render() has emitted an empty `.nn-tip` since the file was written and
   nothing ever put anything in it. This is that.

   Delegated on the root rather than bound per element, because .nn-rh is
   built from innerHTML by updateLine on the first frame and .nn-lw is
   rebuilt from innerHTML every time the line changes: anything bound
   directly to them is thrown away. The title is moved to data-tip the
   first time the pointer touches the element, which is also what stops
   the OS tooltip from firing. */
function tipEl() { return RT && RT.root ? RT.root.querySelector('.nn-tip') : null; }
function hideTip() { var t = tipEl(); if (t) t.hidden = true; }
function showTip(el) {
    var t = tipEl(); if (!t || !el) return;
    var txt = el.getAttribute('data-tip');
    if (txt == null) {
        txt = el.getAttribute('title') || '';
        if (!txt) return;
        el.setAttribute('data-tip', txt);
        el.removeAttribute('title');            // and the OS one never opens again
    }
    if (!txt) return;
    /* the game writes these as "head · body", which is the same middle dot
       it sets every other pair of facts in */
    var cut = txt.indexOf(' \u00b7 ');
    t.innerHTML = cut > 0
        ? '<b>' + esc(txt.slice(0, cut)) + '</b>' + esc(txt.slice(cut + 3))
        : esc(txt);
    t.hidden = false;
    // measured after it is on, and clamped inside the stage
    var r = el.getBoundingClientRect(), h = RT.root.getBoundingClientRect();
    var w = t.offsetWidth, hh = t.offsetHeight;
    var x = r.left - h.left + r.width / 2 - w / 2;
    var y = r.top - h.top - hh - 9;
    if (y < 6) y = r.bottom - h.top + 9;        // no room above: go under it
    t.style.left = Math.round(clamp(x, 6, Math.max(6, h.width - w - 6))) + 'px';
    t.style.top = Math.round(clamp(y, 6, Math.max(6, h.height - hh - 6))) + 'px';
}
function wireTips(root) {
    if (!RT || RT.tipsWired) return;
    RT.tipsWired = 1;
    root.addEventListener('mouseover', function (e) {
        if (!RT) return;
        var el = e.target.closest ? e.target.closest('[title], [data-tip]') : null;
        if (!el || !root.contains(el)) return hideTip();
        showTip(el);
    });
    root.addEventListener('mouseout', function (e) {
        if (!RT) return;
        var el = e.target.closest ? e.target.closest('[title], [data-tip]') : null;
        if (el) hideTip();
    });
    // anything that takes the interface away takes the note with it
    root.addEventListener('mousedown', hideTip);
    root.addEventListener('mouseleave', hideTip);
}

/* ═══════════════ THE WINGS ═══════════════
   Escape steps you off the stage.

   The performance holds exactly where you left it, because the guards in
   step() and draw() hold it, and in front of you is the prompter's book
   open on a stand. Three pages: the wings themselves, the margins where
   thirty years of pencil says how it plays, and the flyleaf where
   somebody has been keeping score of your part.

   Two things this section is careful about, both learned from the file:

   It takes the keyboard in the CAPTURE phase, on the window element
   rather than on anything inside .nn. Every overlay in this game ends
   its click handlers with root.focus(), so focus lives on .nn itself,
   and a listener on a descendant would never see a keydown at all. One
   element up and one phase early beats the game's own chain (including
   the backtick, which is tested above Escape) and beats the desktop's
   Escape handler, which is a bubble listener on document.

   And nothing here goes through setTimeout. gotoPlace clears RT.timers,
   so a hide scheduled on a timer would be cancelled by the very restart
   that scheduled it, and the book would be left dead over the prologue. */

function wingsEl() { return RT && RT.root ? RT.root.querySelector('.nn-wings') : null; }
function wingsPg() { return RT && RT.root ? RT.root.querySelector('.nn-wings-pg') : null; }
/* RT.el IS the .win section: comp.js builds it, sets class 'win ...' on it,
   and hands that same element to init(). So the caption buttons are one
   querySelector away and the menu never has to reach into comp.js. */
function winCap(n) { return RT && RT.el && RT.el.querySelector ? RT.el.querySelector('.win-caps .cap[data-cap="' + n + '"]') : null; }
/* Escape used to be the desktop's way out of window full screen and the
   wings have taken the key. The MARGINS row is the replacement, and it is a
   real two way toggle rather than a synthetic event: it presses the same
   button the title bar shows. */
function isWinFs() { return !!(RT && RT.el && RT.el.classList && RT.el.classList.contains('fs')); }
function toggleWinFs() { var b = winCap('fs'); if (b) b.click(); }
/* nn-lg, NOT nn-big. say(html, 'big') has written class="nn-line nn-big"
   on the game's most important narration since narration was written, and a
   root rule using the same token out-specifies it and flattens the emphasis
   step to nothing. Two meanings, one name, and the new one was winning. */
function applyBigText() { if (RT && RT.root) RT.root.classList.toggle('nn-lg', !!(S && S.opts && S.opts.bigtext)); }
/* A timer that does not go off while the play is held.
   The freeze in step() holds everything on the sim clock, and almost
   everything is on the sim clock. The Verse is not: doVerse schedules its
   28 lines with setTimeout on the wall clock, on purpose, so they land at a
   steady 260ms while dilation slows the world around them. setTimeout does
   not care that step() returned early, so the whole recital used to play out
   behind the veil: every fourth line killed the room, foeDie banked the
   kills and the loot, and the last one set S.a3.verseSpent and sSave()d it.
   You came back to a finished ending you never saw, and 28 lines of ballad
   stacked on one frame because drawLines had not run either.
   Rather than move the recital onto sim time, which would hand it to the
   dilation it is deliberately written to ignore, a timer that comes due
   during a pause parks its body and closeWings lets it go again in order. */
function heldTimeout(fn, ms) {
    return setTimeout(function () {
        if (!RT) return;
        if (RT.wings.on) { RT.wings.held.push(fn); return; }
        fn();
    }, ms);
}
function putItDown() {
    sSave();
    closeWings();
    var b = winCap('close'); if (b) b.click();     // the shell's own path, so playtime still banks
}
function takeItFromTheTop() {
    // close first. resetGame drops you into the prologue, which is a timed
    // sequence that walks itself into the square about thirteen seconds
    // later, and an open book over the top of it reads exactly like the
    // button having done nothing at all.
    closeWings();
    resetGame();
}

/* one live sentence at the top of the page, about the thing you just
   stopped. First match wins. */
function wingsMood() {
    if (RT.dead) return 'You are on the ground. It will wait.';
    if (RT.recital) return 'The stanza is stopped halfway through a line.';
    var live = RT.foes.filter(function (f) { return !f.dead && !f.def.folk; });
    if (live.filter(function (f) { return f.def.boss; })[0]) return 'The Chorus is holding a note it is not going to finish.';
    if (RT.winded > 0) return 'You had nothing left to say anyway.';
    if (live.length > 1) return 'They stopped when you did.';
    if (live.length === 1) return 'It stopped when you did.';
    return 'You have stopped speaking. Nothing is coming.';
}
/* Wall clock, including the time you spend in here, which is why the label
   says "this sitting" and not "played for". */
function wingsSitting() {
    var mins = Math.floor((Date.now() - (RT.started || Date.now())) / 60000);
    if (mins < 1) return 'under a minute';
    if (mins === 1) return 'a minute';
    if (mins < 60) return mins + ' minutes';
    var h = Math.floor(mins / 60), m = mins % 60;
    return h + (h === 1 ? ' hour' : ' hours') + (m ? ' ' + m + (m === 1 ? ' minute' : ' minutes') : '');
}

/* ── the three pages ── */
function wingsRootRows() {
    var rows = [
        { k: 'txt', t: 'You have stepped off. Nothing out there moves until you go back on.' },
        { k: 'txt', t: 'Breath does not come back in here. Saying nothing has to cost you the same as it always did.' },
        { k: 'go', t: 'Go back on', sub: 'Pick it up where you put it down.', key: 'ESC', cue: 'go', on: closeWings },
        { k: 'go', t: 'The margins', sub: 'Thirty years of pencil. How it plays, how loud.', page: 'margins' },
        { k: 'go', t: 'Your part so far', sub: 'What you know, what you found, how long you have been out there.', page: 'part' },
        { k: 'arm', id: 'top', danger: 1, t: 'Take it from the top', sub: 'Start it again from the mask.',
          arm: 'Press it again and it is done. The pencil goes with it. There is no other copy.', on: takeItFromTheTop }
    ];
    // no window means no cross to press, and a row that cannot do its job
    // should say so rather than sit there greyed out
    if (winCap('close')) rows.push({ k: 'arm', id: 'down', danger: 1, t: 'Put it down', sub: 'It keeps where you are standing.',
        arm: 'Press it again and the window shuts.', on: putItDown });
    else rows.push({ k: 'txt', dim: 1, t: 'The window will not shut from in here. There is a cross in the corner of it.' });
    return rows;
}
function wingsMarginRows() {
    var rows = [
        { k: 'txt', t: 'Pencil in the margin. Change what you like.' },
        { k: 'tgl', t: 'How you walk', yes: 'KEYS', no: 'POINT',
          sub: function () { return S.opts.wasd ? 'W A S D walks you. The mouse says the words.'
                                                : 'Click where you want to stand. The keys say the words.'; },
          get: function () { return !!S.opts.wasd; },
          set: function (v) { S.opts.wasd = v; sSave(); refreshStanzaKeys(); } },
        { k: 'tgl', t: 'Let the stage shake', sub: 'Off, and nothing moves that you did not move.',
          get: function () { return !!S.opts.shake; },
          set: function (v) { S.opts.shake = v; sSave(); } },
        { k: 'tgl', t: 'Sound', yes: 'ON', no: 'OFF', sub: 'Off is an empty house.',
          get: function () { return !!S.opts.sound; },
          set: function (v) { S.opts.sound = v; sSave(); } },
        { k: 'num', t: 'How loud', sub: 'The same dial as the one on the taskbar.', min: 0, max: 100, step: 5,
          get: function () { return Math.round(volNow() * 100); },
          set: function (v) { audioVolume(v / 100); } },
        { k: 'tgl', t: 'Large lettering', sub: 'For the back row.',
          get: function () { return !!S.opts.bigtext; },
          set: function (v) { S.opts.bigtext = v; sSave(); applyBigText(); } }
    ];
    if (winCap('fs')) rows.push({ k: 'tgl', t: 'The whole screen', yes: 'ON', no: 'OFF', sub: 'Take it, or give it back.',
        get: isWinFs, set: toggleWinFs });
    rows.push({ k: 'go', t: 'Go back', key: 'ESC', on: wingsBack });
    return rows;
}
/* Read only, and it stays that way. It deliberately does NOT call
   fillBook: that writes S.a3.read as a side effect, and that flag is the
   gate on Act 3. Opening a status page must not open the ending. */
function wingsPartRows() {
    var got = fragCount();
    var worn = (S.worn || []).map(function (c) { return CHARMS[c] ? CHARMS[c].n : c; });
    var house = 0; ACH.forEach(function (a) { if (S.ach[a[0]]) house++; });
    return [
        { k: 'txt', t: 'The flyleaf. Kept in pencil so it can be wrong.' },
        { k: 'val', t: 'This sitting', v: wingsSitting() },
        { k: 'val', t: 'Where you are', v: place().n },
        { k: 'val', t: 'Sounds you own', v: FAM_IDS.filter(famOwned).length + ' of ' + FAM_IDS.length },
        { k: 'val', t: 'Words you can say', v: poolWords().length + ' of ' + Object.keys(WORDS).length },
        // the only count on the page spelled out, because it is the only
        // one that means anything
        { k: 'val', t: 'Lines that do not rhyme', v: ['none', 'one', 'two', 'three'][got] + ' of three' },
        { k: 'val', t: 'The last verse', v: S.a3 && S.a3.verseSpent ? 'Spent' : S.verse ? 'Lit, and not yet spent' : 'Still dark' },
        { k: 'val', t: 'Coin', v: String(S.coin) },
        { k: 'val', t: 'Wearing', v: worn.length ? worn.join(', ') : 'Nothing' },
        { k: 'val', t: 'The house', v: house + ' of ' + ACH.length },
        { k: 'val', t: 'Put down', v: String(S.kills || 0) },
        { k: 'txt', dim: 1, t: ['You know the words the town gave you.',
                                'One thing does not fit.',
                                'Two things do not fit. They fit each other.',
                                'You have the whole of it now.'][got] },
        { k: 'go', t: 'Go back', key: 'ESC', on: wingsBack }
    ];
}
function wingsRows() {
    return RT.wings.page === 'margins' ? wingsMarginRows()
         : RT.wings.page === 'part' ? wingsPartRows()
         : wingsRootRows();
}
function wingsPickable(r) { return !!r && (r.k === 'go' || r.k === 'tgl' || r.k === 'num' || r.k === 'arm'); }
function wingsFirst() {
    var rows = wingsRows();
    for (var i = 0; i < rows.length; i++) if (wingsPickable(rows[i])) return i;
    return 0;
}
function wingsText(t) { return typeof t === 'function' ? t() : (t || ''); }

/* ── drawing the book ── */
function wingsRowHtml(r, i) {
    if (r.k === 'txt') return '<p class="nn-wnote' + (r.dim ? ' dim' : '') + '">' + esc(wingsText(r.t)) + '</p>';
    if (r.k === 'val') return '<div class="nn-wrow nn-wstatic"><span class="nn-wlab">' + esc(r.t) +
        '</span><b class="nn-wval">' + esc(r.v) + '</b></div>';
    // A div, not a button. The number rows carry two stepper buttons and a
    // button inside a button is not a thing the parser will keep: it hoists
    // them straight back out and the row falls apart. Nothing here is ever
    // focused anyway, so there is nothing to lose by not being one.
    var armed = !!(r.id && RT.wings.armed === r.id);
    var h = '<div class="nn-wrow' + (r.danger ? ' danger' : '') + (armed ? ' armed' : '') +
            '" role="button" data-wi="' + i + '">';
    if (r.key) h += '<span class="nn-wkey">' + esc(r.key) + '</span>';
    h += '<span class="nn-wlab">' + esc(wingsText(r.t)) + '</span>';
    var sub = armed ? r.arm : wingsText(r.sub);
    if (sub) h += '<span class="nn-wsub">' + esc(sub) + '</span>';
    if (r.k === 'tgl') h += '<b class="nn-wval">' + esc(r.get() ? (r.yes || 'YES') : (r.no || 'NO')) + '</b>';
    if (r.k === 'num') h += '<span class="nn-wnum"><button class="nn-wstep" type="button" data-wd="-1">&lt;</button>' +
        '<b>' + esc(r.get()) + '</b><button class="nn-wstep" type="button" data-wd="1">&gt;</button></span>';
    return h + '</div>';
}
/* `top` means this is a page you have just arrived on, so start it at the
   top rather than scrolled to the caret. Your part so far is eleven lines
   of readout with one takeable row at the very bottom, and chasing the
   caret opened it scrolled past its own first line every time. */
function fillWings(top) {
    var el = wingsEl(); if (!el) return;
    var W = RT.wings, rows = wingsRows();
    el.querySelector('.nn-wings-t').textContent =
        W.page === 'margins' ? 'THE MARGINS' : W.page === 'part' ? 'YOUR PART SO FAR' : 'THE WINGS';
    el.querySelector('.nn-wings-where').textContent = String(place().n).toUpperCase();
    el.querySelector('.nn-wings-mood').textContent = wingsMood();
    var html = '<span class="nn-wcaret">&gt;</span>';
    rows.forEach(function (r, i) { html += wingsRowHtml(r, i); });
    el.querySelector('.nn-wings-pg').innerHTML = html;
    el.querySelector('.nn-wings-foot').textContent =
        W.page === 'margins' ? 'Escape goes back. It writes itself down the moment you touch it.'
      : W.page === 'part' ? 'Escape goes back. Nothing on this page can be spent.'
      : 'Up and down to move. Enter to take it. Escape goes back on.';
    if (top) el.querySelector('.nn-wings-pg').scrollTop = 0;
    markWings(top);
}
/* The caret is one element for the whole page rather than a class on every
   row, so it slides down the stanza instead of blinking between lines. */
function markWings(noScroll) {
    var pg = wingsPg(); if (!pg) return;
    var rows = wingsRows(), sel = null;
    pg.querySelectorAll('.nn-wrow[data-wi]').forEach(function (b) {
        var on = +b.getAttribute('data-wi') === RT.wings.sel;
        b.classList.toggle('on', on);
        if (on) sel = b;
    });
    var caret = pg.querySelector('.nn-wcaret');
    if (caret) {
        caret.style.display = sel ? '' : 'none';
        if (sel) caret.style.top = (sel.offsetTop + 6) + 'px';
    }
    /* Red for stand by, green for go. It answers the caret rather than
       blinking on a timer, so it is the one light in the wings and it means
       something: green is the line that puts you back on. */
    var r = rows[RT.wings.sel], go = !!(r && r.cue === 'go');
    var cue = RT.root.querySelector('.nn-wings-cue');
    if (cue) { cue.classList.toggle('go', go); cue.classList.toggle('on', !go); }
    // scroll by hand rather than scrollIntoView, which will happily scroll
    // the desktop behind us as well
    if (sel && !noScroll) {
        var top = sel.offsetTop, bot = top + sel.offsetHeight;
        if (top < pg.scrollTop) pg.scrollTop = top - 8;
        else if (bot > pg.scrollTop + pg.clientHeight) pg.scrollTop = bot - pg.clientHeight + 8;
    }
}
function wingsTurn() {
    var pg = wingsPg(); if (!pg) return;
    pg.classList.remove('turn'); void pg.offsetWidth; pg.classList.add('turn');
}
function wingsDeny() {
    var pg = wingsPg(); if (!pg) return;
    var row = pg.querySelector('.nn-wrow.on');
    if (row) { row.classList.remove('deny'); void row.offsetWidth; row.classList.add('deny'); }
    sfx('empty');
}

/* ── opening, closing, moving ── */
function openWings() {
    if (!RT || RT.wings.on) return;
    var el = wingsEl(); if (!el) return;
    RT.wings.on = 1; RT.wings.page = ''; RT.wings.armed = ''; RT.wings.root = 0;
    RT.wings.sel = wingsFirst();
    /* Let go of everything, the way focusout already does. Otherwise you
       press Escape with W held, read the book for a minute, close it and
       walk north into a wall because the key never came up. */
    RT.keys = {}; RT.mouse.down = false; RT.mouse.rdown = false; RT.moveTo = null;
    RT.root.classList.add('nn-off');
    el.hidden = false;
    fillWings(1);
    sfx('travel');
    RT.root.focus();
}
function closeWings() {
    if (!RT || !RT.wings.on) return;
    var el = wingsEl();
    RT.wings.on = 0; RT.wings.armed = ''; RT.wings.page = '';
    if (el) el.hidden = true;                 // synchronously: see the note at the top of the section
    RT.root.classList.remove('nn-off');
    /* Anything that came due while you were off runs now, in the order it
       was written and at its own pace, rather than all landing on the frame
       you come back on. 260ms is the Verse's own gap between lines. */
    var held = RT.wings.held; RT.wings.held = [];
    held.forEach(function (fn, i) {
        RT.timers.push(setTimeout(function () { if (RT) fn(); }, i * 260));
    });
    sfx('travel');
    RT.root.focus();
}
function wingsGo(page) {
    RT.wings.root = RT.wings.sel;             // so Escape puts the caret back where it was
    RT.wings.page = page; RT.wings.armed = '';
    RT.wings.sel = wingsFirst();
    fillWings(1); wingsTurn(); sfx('ui');
}
function wingsBack() {
    if (RT.wings.armed) { RT.wings.armed = ''; fillWings(); sfx('ui'); return; }
    if (RT.wings.page) {
        RT.wings.page = ''; RT.wings.sel = RT.wings.root;
        fillWings(1); wingsTurn(); sfx('ui'); return;
    }
    closeWings();
}
function wingsMove(d) {
    var rows = wingsRows(), idx = [];
    rows.forEach(function (r, i) { if (wingsPickable(r)) idx.push(i); });
    if (!idx.length) return;
    var at = idx.indexOf(RT.wings.sel);
    at = at < 0 ? 0 : (at + d + idx.length) % idx.length;
    RT.wings.sel = idx[at];
    // walking off an armed row backs out of the confirm, exactly as the dev
    // menu's wipe does
    if (RT.wings.armed) { RT.wings.armed = ''; fillWings(); } else markWings();
    sfx('ui');
}
function wingsNudge(d) {
    var r = wingsRows()[RT.wings.sel];
    if (!wingsPickable(r)) { if (d < 0) wingsBack(); return; }
    if (r.k === 'num') {
        RT.wings.armed = '';
        r.set(clamp((+r.get()) + d * (r.step || 1), r.min, r.max));
        fillWings(); sfx('ui'); return;
    }
    if (r.k === 'tgl') {
        RT.wings.armed = '';
        r.set(!r.get());
        fillWings(); sfx('ui'); return;
    }
    if (d < 0) wingsBack(); else wingsTake();
}
function wingsTake() {
    var r = wingsRows()[RT.wings.sel];
    if (!wingsPickable(r)) { wingsDeny(); return; }
    if (r.k === 'arm') {
        // two presses, in place, rather than a confirm screen
        if (RT.wings.armed === r.id) { RT.wings.armed = ''; r.on(); return; }
        RT.wings.armed = r.id; fillWings(); sfx('ui'); return;
    }
    RT.wings.armed = '';
    if (r.k === 'tgl' || r.k === 'num') { wingsNudge(1); return; }
    if (r.page) { wingsGo(r.page); return; }
    if (r.on) { r.on(); return; }             // may close the window: touch nothing after it
    wingsDeny();
}

/* ── input ── */
function wingsKey(e) {
    if (!RT || !RT.wings.on) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;      // the OS keeps its combinations
    /* Only keys aimed at the game. The shell appends its own UI INSIDE the
       .win element this listener sits on: the Alt+F find bar puts a focused
       text input in there, and the system menu puts a button list. Claiming
       every key in the window swallowed what the player typed into the find
       bar and drove the caret with it instead. */
    if (e.target !== RT.root && !(RT.root.contains && RT.root.contains(e.target))) return;
    var k = (e.key || '').toLowerCase();
    /* An auto-repeat is one held key, not a second press, and this menu has
       two rows that mean it. Held Enter on "Take it from the top" armed it on
       the first keydown and wiped the save on the repeat 500ms later, which
       is the exact thing arming in place exists to prevent. Repeats are
       allowed for the caret and the stepper, where holding a key to run is
       the point, and refused for anything that takes a row.
       Escape is in the refused set for a second reason: without it, holding
       it strobes the menu, because the root chain's own repeat guard sits
       BELOW its Escape branch and would happily reopen what this just shut. */
    if (e.repeat && !(k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright')) {
        e.preventDefault(); e.stopPropagation(); return;
    }
    if (k === 'arrowup' || k === 'w') wingsMove(-1);
    else if (k === 'arrowdown' || k === 's') wingsMove(1);
    else if (k === 'arrowleft' || k === 'a') wingsNudge(-1);
    else if (k === 'arrowright' || k === 'd') wingsNudge(1);
    else if (k === 'enter' || k === ' ') wingsTake();
    else if (k === 'escape' || k === 'backspace') wingsBack();
    // everything else is swallowed on purpose, including the backtick: the
    // dev menu opening underneath the book is not a state anybody wants
    e.preventDefault(); e.stopPropagation();
}
/* One ladder, two doors. Escape and the ESC button have to mean the same
   thing: close the top thing that is open, and only step off the stage when
   there is nothing left to close. The button used to call openWings()
   directly, which put the book on top of a live panel that then showed
   through the veil, and left the panel waiting underneath when you came
   back. */
function wingsEscape() {
    if (RT.devOpen) toggleDev();
    else if (RT.mapOpen) RT.mapOpen = false;
    else if (RT.dialog) closeDialog();
    else if (RT.panel) panel(null);
    else openWings();
}
function wireWings() {
    if (!RT || RT.wings.wired) return;
    RT.wings.wired = 1;
    var host = RT.el && RT.el.addEventListener ? RT.el : RT.root;
    host.addEventListener('keydown', wingsKey, true);
    var el = wingsEl();
    if (el) el.addEventListener('click', function (e) {
        if (!RT || !RT.wings.on) return;
        var row = e.target.closest ? e.target.closest('.nn-wrow[data-wi]') : null;
        if (row) {
            // only a real hit stops here. A click on bare veil has to reach
            // document, because that is what closes the desktop's own start
            // menu and context menus, and the veil covers the whole window.
            e.stopPropagation();
            var i = +row.getAttribute('data-wi');
            if (RT.wings.sel !== i) { RT.wings.sel = i; markWings(); }
            var st = e.target.closest('.nn-wstep');
            if (st) wingsNudge(+st.getAttribute('data-wd'));
            else wingsTake();
        }
        if (RT) RT.root.focus();
    });
    var pg = wingsPg();
    if (pg) pg.addEventListener('mousemove', function (e) {
        if (!RT || !RT.wings.on) return;
        var row = e.target.closest ? e.target.closest('.nn-wrow[data-wi]') : null;
        if (!row) return;
        var i = +row.getAttribute('data-wi');
        if (i === RT.wings.sel) return;                  // one sound per row, not one per pixel
        RT.wings.sel = i;
        // the mouse backs out of a confirm exactly as the caret does, or you
        // arm a danger row, move the mouse, and one click finishes it
        if (RT.wings.armed) { RT.wings.armed = ''; fillWings(); } else markWings();
        sfx('ui');
    });
    var b = RT.root.querySelector('[data-nn="wings"]');
    if (b) b.addEventListener('click', function (e) { e.stopPropagation(); wingsEscape(); });
}

/* Registered here rather than in init(), which is shared. gotoPlace runs
   inside init() and fires RESETS at the top of itself, so the wiring and
   the lettering are live from the first frame of every session, and they
   re-apply after a wipe. */
onPlaceChange(function () {
    if (!RT) return;
    wireWings();
    wireTips(RT.root);
    applyBigText();
    // gotoPlace has just cleared RT.timers, which is how walking through a
    // doorway cancels the Verse. Anything of it parked here goes with them.
    RT.wings.held.length = 0;
    if (RT.wings.on) closeWings();     // nothing that teleports you may leave the book open over it
});

window.NINTH = {
    render: render, init: init, close: close, steamAch: steamAch,
    /* the desktop shell owns the window; these let it stop the sound
       behind a minimized one and drive the taskbar volume slider */
    suspend: audioSuspend, resume: audioResume, volume: audioVolume
};
})();
