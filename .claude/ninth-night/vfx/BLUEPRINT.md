# NINTH NIGHT — THE MAGIC LAYER, MERGED

The single buildable specification for the magic visual overhaul, assembled from
eight parallel designs (`design-eat`, `design-ight`, `design-erd`, `design-ark`,
`design-ill`, `design-punch`, `design-proj`, and the six `design-deton-*` files),
their sixteen critiques, and `RECON.md`. Where a design and a critique disagree,
this file rules. Where two designs invented the same thing twice, this file names
the survivor and says why the other lost.

Line numbers are `comp/ninth.js` at `88c665c` (8279 lines). Grep the symbol, not
the line: eight branches are moving these same lines.

**Nothing in this file is conditional on another branch landing first.** The two
previous plans both contained the sentence "if -punch has landed" and both of
them were, in different places, a `ReferenceError` on the number row. This is one
specification for one file. There is no landing order to get wrong.

---

## 1. THE LOOK

### What you see now

A word leaves your mouth and travels as one soft blob with the word written on
it, identical in all five families except for the tint. It lands, and a 13px cell
with three overlapping characters in it appears above a body. You press a number.
Somewhere on the board a 2px horizontal line shrinks to nothing, a handful of
identical squares fly out at `grav: 130`, six words fade in from a hash-derived
cloud that has never seen an enemy, a 62px word slams at exactly the size it
slams at for every rhyme in the game, and the whole screen buzzes for a third of
a second at an amplitude that is 9 whether you closed one syllable or thirty.

Every part of that is one gesture, recoloured five times.

### What you see instead

**The typography is still the backbone and it is now the only thing that is
allowed to be loud.** Words getting bigger is the game's own stated visual
language and this overhaul spends its whole budget making that sentence true:
the word on the projectile, the syllable in the cell, the syllable in flight, the
line it lands in, the rule struck under the line, and the tag word over the top.
Everything else in the layer is matter, and matter exists to say what the words
are made of and what they leave behind. A frame grab with a beautiful flare and
no readable word is a failure, and the fix is always less matter, never less word.

**Each family is a different piece of physics, not a different swatch.** With the
screen turned to greyscale you can still name the sound that closed, because
`-eat` matter rises and is eaten, `-ight` matter falls and lands and casts a hard
shadow, `-erd` matter is cut off mid-gesture, `-ark` matter is a hole in the light
rather than a thing in it, and `-ill` matter does not move at all. The five
families differ in the direction their matter travels, in whether it is additive
or opaque, in how long it hangs, in how the screen shakes, and in how much light
they put in the room. Colour is the last of six differences, not the only one.

**The board is legible before it goes off.** The stack row comes out from under
the night wash and stops being the darkest magic on screen while a burst that
lasts a third of a second is the brightest. One glyph per cell, not three
overlapping ones. A pile that is about to lapse says so.

**Then you press a number and the room gathers.** Every syllable still stuck on
the board tears loose at once, and for the next fifth of a second the whole screen
is moving inward. Nothing is brighter than it was. The stack rows lift off the
bodies and leave through a hard clipped edge, the survivors slide up to close the
gap, and one glyph per spent syllable peels off each body a letter at a time and
arcs toward the middle of the screen. One foe and they go up and over its head.
Six foes and they drop to the floor and skate in low from every corner. You know
which you are looking at from the shape of the motion with the colour off.

**Then the line lands and the room takes it, in that order.** The words hit their
slots, overshoot, come back, and press a 1px mark into a plate that grew wider
with every arrival. A rule strikes under them, made out of the syllables that
arrived rather than drawn from a number, one abutting segment per body that heard
you, notched once per syllable, brass end caps on both ends because it is
finished. On the same frame the frame itself catches for a tenth of a second, the
picture takes one chunky step toward the blast in that sound's own colour, the
letters come apart into two copies of themselves, the family's light lands on the
ground as an enormous flattened lantern pool, the town's own lamps dip while it
does, and the shake goes one direction on whole pixels instead of buzzing. Every
one of those is scaled by how many syllables you just spent, and all of it is
behind one option with four settings.

**And the room goes down so that the line is the only thing in it.** For the
length of the hold, everything behind the words darkens and the light comes off
the line. That is the image the whole design exists for and it is two fillRects.

**Then it hands the room back.** The halo drops, the line goes, the rule outlives
it and closes from both ends to a single 2px caesura in the middle of where it
was, which is the same mark the game already puts on a word it swallowed. The
last pixel of a detonation is a punctuation mark.

### The three failures look like failures

A **slant** is the same event with one thing broken. The words still fly, because
you still said something, and they land on a broken baseline, grey, with no
overshoot and no press mark. The rule strikes to 60% and then splits at the
centre, and a small plate with two nails in it goes over the break. That is what
the town did to the ballad, drawn on you for doing it to your own line, and it is
never explained.

A **drag** is quiet. It throws no matter at all, which in a game where everything
bursts is the loudest way to say this was a different kind of move. A rope of hard
marks goes out from your feet, takes hold of somebody else's sounds, and walks
them over: each cell's old glyph drops out of the row and the new one is struck in
behind one flat frame of colour, left to right, and the life bar under each cell
visibly loses the 35% the move charges. The flyers leave in the colour of the
sound they used to be and change, on one frame, at 60% of travel.

A **refusal** is twenty-five ropes going out into the square and coming back with
nothing. Nothing in any row moves. Four hundred years of the same sound not
moving, in eleven pixels of rope.

### The size of it

One syllable is the same event as twelve, smaller: one glyph over one head, a 2px
rule 9px wider than the words, 22ms of held frame, gone in 0.59s. Twelve is eight
glyphs peeling off one body over 98ms, two hard coronas, 94ms of held frame, a
6px rule with a comb of notches under it and a bracket closed around the line.
Twenty-five folk in the square is not louder than twelve. It is the same loudest
with twenty-five separate pieces of rule under it, one per person who heard you,
and that is the only way the ending survives being drawn.

---

## 2. THE SHARED VFX LAYER

Everything below is written once and consumed by all eight areas. If a primitive
appears here, no area may declare its own. Two `function spray(...)` declarations
in the same IIFE do not throw: the later one silently wins, and if the signatures
have drifted the failure is at runtime and looks like a rendering bug
(`crit-eng-proj.md:396`). Deduplication is not tidiness here, it is the only
defence there is.

### 2.0 Where it goes, and in what order

Two new banners and four edited functions. Nothing else in the file grows a new
top-level block.

| # | block | position | contents |
|---|---|---|---|
| A | `EFFECT SPINE` banner | new, immediately **above** the `CALL AND ANSWER` banner at 2150 | 2.2 registry, 2.3 scalars and geometry, 2.4 colour, `fxBoot` |
| B | particle extension | **inside** the existing `particles` block at 1383-1410 | 2.5 `spray`, `partCol`, the rewritten `drawParts`, `p.sh` |
| C | `SCREEN PUNCH` banner | new, immediately **after** `shake()` at 1505 | 2.6 the glow bake, 2.7 `punch()` and its channels |
| D | `slam` / `drawSlams` | 1442-1468, edited in place | 2.8 |
| E | `draw()`, `step()`, `frame()`, `screenToWorld`, `drawVignette`, `drawLights` | edited in place | 2.9, and the option and the tunables in 2.10 |

Banner A must be **above** 2150 and banner C must be **below** 1505, so C's
module-scope tables are evaluated before A's `fxBoot` is *called* (it is called
from the tail of the file at 8249) and A's `fxP` is defined before C's `punchP`
alias is *called* (never at load). Nothing at module scope in either banner reads
anything from the other. `FAM_IDS` (149), `FAMS` (142), `clamp`, `rnd`, `irnd`,
`lerp`, `TAU`, `VW`, `VH`, `TILE_W`, `TILE_H`, `isoX`, `isoY`, `hex2rgb` (2859)
and `onPlaceChange` (33) are all in scope at both, but `hex2rgb` and
`onPlaceChange` are only *safe to call* from `fxBoot`/`punchBoot` at the tail,
which is why both boots exist. That is the same reason the comment at 8249 gives
about `KEYS`.

### 2.1 The collision ledger

Every name two or more designs invented independently, ruled once, here.

| name | claimed by | ruling | why the other lost |
|---|---|---|---|
| `fxP(n)` / `punchP(n)` | deton 3:118, punch:621 | **One body, `fxP`, in banner A. `punchP` is a one line alias in banner C.** Neither is ever deleted; the call sites in eleven places never move | deton 3:116-118 says "if -punch has landed this declaration is dropped", which is `crit-eng-deton.md` B11: a `ReferenceError` on the first close. deton 6:176-180 has it right. Two names is one line; two bodies is a drift bug three months out |
| `foeH(f)` | deton 3:146, proj:446, asked for by ight:1572 | **deton's, in banner A** | It also owns `FOE_H.chorus` and the `drawFoe` 3488 edit, so one branch touches all three |
| `foeStackY(f)` | deton 3:150 | **kept, and made mandatory.** `detGather`, `snapStacks` and `-proj`'s pip row all call it | `crit-eng-deton.md` N2: its own author open-coded the expression at both of his call sites. A helper nobody calls is the 104px Chorus bug with extra steps |
| `spray(x,y,z,n,ang,spread,o)` | proj:450, wanted by eat, ark, deton | **proj's body, moved into banner B** beside `burst` | Same body, no argument. It belongs next to the thing it is a variant of |
| `mixRgb(a,b,k)`, `fampx()` | proj:412-440 | **proj's, moved into banner A** (2.3) | Five family branches were each about to build `'rgba(' + hex2rgb(...) + ...)` inside a draw loop |
| the baked glow: `bloomSprite(rgb)` / `glowSpr(fam)` / `glowAt` / `GLOW_ROWS` | punch:800, proj:1813, RECON 7.1-7.2 | **One sprite, `glowSpr(rgb)`, banded, in banner C. One blitter, `glowAt`. The screen bloom uses the same sprite** | `bloomSprite` loses on doctrine and on scope. It is a smooth 128px radial, and `crit-art-punch.md` #10 is right that the file's own comment at 6702 is the argument *against* smooth falloff, and that reserving the smooth one for the full-screen pass while telling five families to use the banded one institutionalises two techniques in one game |
| the screen shake | punch:753, plus a `shake(n)` in eat, erd, ill, deton and the Verse | **`punch()` only.** `shake()` keeps its signature and its thirteen legacy callers and is not called by any new code | Eight ideas of what a big hit is. `design-punch.md:1518` states the rule and this file enforces it |
| the hitstop: `RT.hitstop` / `erdStop` / `illHold` / `-ark`'s H | erd:492, ill:169, ark:411, punch:655 | **`RT.punch.stop`, written only by `punch()`.** The three families get a `stop` multiplier in `FAM_PUNCH` instead | Three fields summing into a hang (deton 6, risk 6). `punch()` takes the max of every channel; three raw writers cannot |
| `RT.bloom = {a, col}` | ight:1490 | **Refused as a field, applied as a fact.** `RT.flash` keeps its name and gains `RT.punch.fcol` beside it | `RT.flash` already exists, already decays, and `onChorusDown` (3442) already writes it. A second channel means job 4's line needs an edit |
| the `fx: {}` slot in the `RT` literal | deton 1:75 says between `combat:` and `items:`; eat:1336 and erd:1277 say between `items:` and `world:` | **Between `combat:` and `items:`** | `world:` has no trailing comma (verified at 1568), so the eat/erd slot edits somebody else's line. deton's does not edit a single existing character |
| the travel reset | deton 1:210, eat's clear-down, erd's `erdBoot`, proj:1254 | **One `onPlaceChange` in `fxBoot`.** It rebuilds `RT.fx` from each `make()` and takes the four legacy arrays with it | Four registrations that each forget a different field |
| `FAM_PIP` / `FAM_TRAIL` / `FAM_CALL` / `FAM_PROJ` / `FAM_LAND` / `FAM_WORD` / `FAM_MISS` / `FAM_FADE` | eat:1321, ight:1449, erd:1256 | **`-proj` owns all of them**, declared in its own block, all with a live default row rather than an empty object | Not shared-layer machinery: they are the projectile and pip layer's dispatch and only `-proj` restructures those functions. Listed here so nobody else declares one. The seeding rule from `FAM_SNAP` applies to every one of them (2.1a) |
| `FAM_DET` / `regDet`, `FAM_SNAP` / `regSnap` | deton 1:280, deton 3:946 | **deton's, in banner A** | Uncontested |
| `FOE_SIL` / `foeSilSpr` / `silPal` | eat:—, wanted by ight and ill | **`-eat`'s body, moved to sit beside `FOE_H` and `FOE_DRAW` at 3684**, not inside `-eat`'s block | `crit-eng-eat.md` #1: declared at module scope above the `var`s it reads, so the literal captures `undefined` and the first `-eat` detonation throws inside `draw()`. Moving it next to the sprite rows fixes the defect and the ownership in the same edit |
| `punch()`'s power on the slant row | punch:1279 wants `hitFoes`, deton 3:578 sends `d.wide` | Same number. `pw = d.kind === 'slant' ? d.wide : d.total` stands | No conflict, recorded because two documents describe it differently |

**2.1a The seeding rule, for every registry in this overhaul.** A registry whose
default is nothing means five visuals disappearing the moment the first branch
lands and coming back one at a time. Every one of `FAM_SNAP`, `FAM_DET`,
`FAM_PIP`, `FAM_TRAIL`, `FAM_CALL`, `FAM_PROJ`, `FAM_LAND` and `FAM_LINE` is
declared **seeded with a working default row for all five families plus `none`**,
and a family design replaces its row. Opting out is `regX('erd', null)` and the
consumer tests for truth. `crit-eng-eat.md` #7 is the failure mode: a lookup with
no fallback on a table with one row in it is `undefined` and a thrown call.

---

### 2.2 The registry

**One line in the `RT` init literal**, between `combat:` and `items:` (1566-1567).
Both of those lines already end in a comma, so **no existing character is edited.**

```js
        combat: { cuts: [], rep: null, encI: 0, lull: 0 },
        fx: {},                          // vfx: per-effect state, keyed by regFx id. See regFx.
        items: { freeSlant: 0, tack: 0, atShop: false },
```

There is no `det: null` line and no `punch: {}` line on the literal. `RT.det` is
`undefined` until the first detonation, which reads exactly like `null` to the
four places that test it for truth, and the punch layer's state lives on
`RT.fx.punch` through the same registry as everything else. One line in a shared
literal is one merge conflict; three is three. This supersedes
`design-punch.md:867`, which put a fifteen-field `punch:` object on the literal,
and it also disposes of `crit-eng-punch.md` #16 (`RT._dms` as a stray field):
the perf counter is `fxOf('punch').dms`.

**The banner.** Goes above `CALL AND ANSWER` at 2150.

```js
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
    for (var i = 0; i < FX.length; i++) if (FX[i].world) FX[i].world(cx, dt, fxOf(FX[i].id));
}
function drawFxS(cx, dt) {
    for (var i = 0; i < FX.length; i++) if (FX[i].screen) FX[i].screen(cx, dt, fxOf(FX[i].id));
}
```

**`regFx(id, step, draw, o)`, final signature.** `regFx('erd', stepErd, drawErd)`
is valid verbatim, which is what `-erd` already wrote.

| key | default | meaning |
|---|---|---|
| `screen` | none | a second drawer, at the screen seam, after `drawMap`, outside the shake |
| `make` | `{ a: [] }` | builds fresh state, and **is** the travel reset |
| `cap` | 192 | the list cap `fxPush` enforces. Declare your own honestly |
| `ord` | 50 | draw order, low first, shared by the world and screen passes |

**The `ord` map is closed. Take a row, do not invent one.**

| ord | pass | owner |
|---|---|---|
| 10 | world | ground scars, anything under the bodies' feet |
| 30 | screen | passes that **darken** before the line exists. `-ight`'s pre-darken |
| 42 / 44 / 46 / 48 / 50 | world | `eat` / `ight` / `erd` / `ark` / `ill`, in `FAM_IDS` order |
| 70 | world | `-proj`: the pip row and the projectile layer |
| 86 | world | the haul (the slant and the drag at the bodies) |
| 87 | world + screen | the Reprise: the underlines, the tally, the voices |
| 88 | screen | the room going down under the line |
| 90 | world + screen | the detonation: the tear, the flyers, the line, the rule |
| 90.5 | screen | `FAM_LINE`: the five families' one gesture on the line itself |
| 92 | screen | the slant patch. **Over** the rule it patches |
| 93 | screen | the Verse column |

`ord: 92` for the patch is `crit-eng-deton.md` B14 applied: `design-deton-4` put it
at 86, `regFx` sorts ascending and `drawFxS` iterates in order, so the rule painted
over eight of the fourteen pixels of a plate whose own comment says it goes "over
the break". An entry needing a world pass at one depth and a screen pass at another
registers **twice**; two `regFx` calls are free, because the seam rule in
`PARALLEL.md:113-118` is about calls in `draw()` and there are still exactly two.

**The sound gate.** One sound per name per window, because eight foes each playing
`seen` on one frame is not eight sounds.

```js
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
```

That ruling means `stanzaWave` and `versePulse` may now route through `fxSfx`
safely, and `design-deton-5`'s carve-out for them is withdrawn. They still call
`sfx` directly today and nothing forces them to change.

**`fxBoot`, called from the tail of the file at 8249.**

```js
/* Registered from the foot of the file, beside combatBoot(), for the
   reason the comment at 8249 gives about KEYS: onPlaceChange writes
   into RESETS and every var these lines name is declared above, but a
   module-scope call up in the banner runs before the function
   declarations further down the file are reachable in the order a
   reviewer expects. One boot, one place, no ordering to remember. */
function fxBoot() {
    punchBoot();                 // the family colour tables, derived off FAMS
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
        RT.det = null;
        RT.parts.length = 0; RT.snaps.length = 0; RT.rings.length = 0;
        RT.assembly = null;
        RT.shake = 0; RT.chroma = 0; RT.flash = 0;
        FX_T = 0; FX_SFX = {};
    });
}
function fxNul() { return {}; }
```

`regFx('punch', ...)` with no drawer is how the punch layer gets its state onto
`RT.fx` and its stepper onto the one `stepFx` call. `ord: 99` is inert (it has
neither a `world` nor a `screen` function) and is chosen so that a future reader
who gives it a drawer gets it last. **Families do not register their own travel
reset**; `-erd`'s `erdBoot` and `-eat`'s clear-down both collapse into their
`make()`.

Pure memo tables (`PCOL`, `MIXC`, `FAMPX`, `SPR`, `SHADE`, `GLOWS`) are module
scope and deliberately survive both a doorway and `close()`: they are pure
functions of their keys. **Anything holding an `f`, an `RT` reference or a screen
position must not.** `crit-eng-proj.md` #16 is the live example: `PIP_ORD` holds
foe references from the last drawn frame, so it gets `PIP_ORD.length = 0` in this
same handler when `-proj` lands.

---

### 2.3 The scalars, and the geometry nobody may re-derive

Four curves come out of a detonation and eight documents were inventing their own.
These are the curves. There are no others, and **nothing anywhere else in this
overhaul may hold a `Math.sqrt`, a magic `/ 8` or a `clamp(n, 1, 12)`.**

```js
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
```

`fxP` — 1 → 0.20 · 2 → 0.36 · 3 → 0.48 · 4 → 0.58 · 6 → 0.74 · 8 → 0.85 ·
12 → 1.00 · 25 → 1.00
`fxS` — 1 → 1.00 · 2 → 1.26 · 4 → 1.62 · 8 → 2.13 · 12 → 2.53 · 16+ → 2.60
`fxW` — 1 → 1.00 · 2 → 0.95 · 4 → 0.84 · 8 → 0.62 · 16 → 0.35 · 25 → 0.34

**Geometry.** Three expressions the file hides inside functions nobody else can
reach, and one that four designs got wrong in the same way.

```js
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
function foeStackY(f) { return isoY(f.x, f.y) + TILE_H / 2 - foeH(f) - 18 - (f.so || 0); }

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
```

`T` is the tunable accessor (480) and is used 200+ times. **Never declare a local
called `T`.** Two world drawers in `design-deton-3` and `-4` do, and neither
throws today only because neither calls `T('...')` yet; the first person to wire a
tunable into a drawer gets `T is not a function` from a line that looks correct.
Use `tr` or `rec`.

---

### 2.4 Colour, built once

Every design independently discovered that `drawParts` builds an `rgba()` string
and a `toFixed(3)` per particle per frame, calls it the file's worst habit, and
then four of them were about to do the same thing in their own loop.

```js
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
        FAMPX[id] = { rgb: rgb, grgb: g, col: F.col, glow: F.glow, tag: F.tag,
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
```

**The closed palette, restated, because eight branches will each reach for a
bright.** Five family `col`, five family `glow`, `#e8e2ee` the strike white,
`#f0e9df` body text, `#c9a94a` brass (fourteen uses: lamps, the crown, the
milestone), `#6a5f72` the colour of a thing nobody wrote down, `#3d3350` and
`#2a2028` the two violet-darks, `#08060c` the drop shadow every glyph in the file
has at `+1,+1` or `+2,+2`. **No pure white anywhere**, and `#3a3340` does not
exist in `comp/ninth.js`: `design-deton-4` and `-5` invented it for the patch
plate, the tally and the Verse column while arguing three paragraphs earlier that
`#e8e2ee` must be used instead of `#fff` because the palette is closed. All three
become `#3d3350`.

Two paper whites for one gesture is also cut. The 14ms strike frame is `#e8e2ee`
everywhere it appears: the rule, the arrival tick, the press mark, the Verse mark,
the drag's flat frame. `#f0e9df` stays what it is in the file today, which is
body text.

---

### 2.5 The particle system, extended

Three changes inside the existing `particles` block at 1383-1410. `part()` and
`burst()` keep their signatures and every one of their nine existing call sites
is byte-identical afterwards. A particle with none of the new fields draws exactly
the pixels it draws today.

**Two new optional fields.** RECON's audit: *"`burst()` is the whole matter
vocabulary and it is one shape. Axis-aligned squares... Every explosion, every
death, every impact, every detonation in the game is that one square."* An
overhaul whose brief is five different visuals cannot ship on one square.

| field | default | what it does |
|---|---|---|
| `sh` | `0` | `0` the square it is today. `1` a chip **lying on the floor**, drawn `2:1`, which is the file's ground-plane idiom in the one place it was never applied. `2` a **standing** sliver, 1px wide and `2x` tall: frost needles, embers, rain |
| `fr` | `0` | per-second velocity damping. `0` is ballistic, which is every particle in the game today. `-ill`'s frost stops; `-ark`'s murk hangs; a spark that slows is not a spark that falls |

**No `spin`.** Cut. It costs a `rotate` per particle per frame, and a rotated
2px square with `imageSmoothingEnabled` false is four grey pixels. It shows
nothing and it costs the most expensive thing in the loop.

```js
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
```

`burst()` gains the same two pass-throughs on its `part()` literal and nothing
else. `stepParts` gains one guarded line:

```js
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.grav * dt;
        if (p.fr) { var q = Math.max(0, 1 - p.fr * dt); p.vx *= q; p.vy *= q; p.vz *= q; }
        if (p.z < 0) { p.z = 0; p.vz *= -0.28; p.vx *= 0.6; p.vy *= 0.6; }
```

**`drawParts` rewritten.** This is the single largest performance change in the
overhaul and it is what pays for five families' worth of matter.

```js
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
        var sx = isoX(p.x, p.y), sy = isoY(p.x, p.y) + TILE_H / 2 - p.z;
        var s = p.size * (0.4 + 0.6 * k);
        cx.fillStyle = partCol(p.col, k);
        /* Three shapes. The default arm is the line this function has
           always had. The other two are the reason five families can
           have matter that is not the same square: one lies on the
           ground plane, which is the 1:0.5 idiom the whole rest of the
           file uses for anything on the floor, and one stands up. */
        if (p.sh === 1) cx.fillRect(sx - s, sy - s * 0.25, s * 2, Math.max(1, s * 0.5));
        else if (p.sh === 2) cx.fillRect(sx - 0.5, sy - s, Math.max(1, s * 0.5), s * 2);
        else cx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
}
```

**No frustum cull, deliberately.** All 900 are still drawn even on the 11x34 road
where most are off screen. Two `isoX`/`isoY` and a compare per particle is not
obviously cheaper than the `fillRect` a clipped-out rect already costs, and a cull
is the kind of change that silently eats the one particle you are debugging.
Noted as available if the budget ever needs it.

**Budget after this change.** The busiest existing moment in the game uses about
200 of the 900 cap. The measured detonation cases in the merged design are 96
particles at 8 foes by 8 stacks and 50 in the 25-folk square, both after `fxW`
thinning. The house split, so that eight areas do not each assume the whole
budget: **112 for the snap, 300 for the whole detonation including the five
families' own emission, 600 left for everything already in the room.** A family
that wants more asks here rather than calling `part()` more often.

---

### 2.6 One glow, baked once, banded

There is exactly one soft light source in this overhaul and every layer uses it:
the family bloom on the screen, a syllable's halo in the world, the pool under a
projectile, the light off a burning body. Five branches were about to bake five.

```js
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
```

**The key is an `"r,g,b"` triple and the key space is closed.** Five family
`glow`s, five family `col`s, and the warm white: eleven entries at 64 KB each,
708 KB worst case, against one `FLOORS` entry at 2.5 MB and a `SPRITE_BUDGET` of
10 MB. **Do not pass a `mixRgb` result to `glowSpr`.** That is the one way to turn
a closed key space into an unbounded cache of full canvases, which is the mistake
`FLOORS` is the cautionary tale for. If a family needs a light that changes
colour, blit two and cross-fade the alphas.

`freeGlows()` goes into `close()` at 8242 beside `freeFloors()` and `freeSprites()`.

**`bake()` was considered and rejected for this.** `bake(key, rows, pal)` at 1841
takes row strings at a fixed `PXS = 2`, so a 32-row glow is 64px and there is no
way to ask for another size; and its cache key does not include the palette, so
every caller has to fold the colour into the key by hand. `glowSpr` is nine lines,
has the same shape and the same lifetime, and does not make the next person read
`bake` to understand a circle.

---

### 2.7 `punch()`: the whole screen, one entry point

Goes in the `SCREEN PUNCH` banner, immediately after `shake()` at 1505.

```js
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
```

**The trailing fringe colours this produces**, for the record, since a critique
proposed `hex2rgb(pxShade(col, 0.42))` for exactly this and that composition
returns a flat grey (`pxShade` returns `'rgb(r,g,b)'`, `hex2rgb` returns
`'200,200,200'` for anything not starting with `#`):
`eat 97,61,24` · `ight 107,96,46` · `erd 67,94,84` · `ark 58,45,87` ·
`ill 47,89,107` · `none 74,63,27`. Every one is the same hue at a lower value.
No new saturated hue enters the palette, which is what "walking a hue down into
the dark end" was supposed to mean.

#### The entry point

```js
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
        ex = isoX(o.x, o.y); ey = isoY(o.x, o.y) + TILE_H / 2;
        ax = Math.round(clamp(ex, VW / 2 - 150, VW / 2 + 150));
        ay = Math.round(clamp(ey, VH / 2 - 80, VH / 2 + 80));
        dx = ex - isoX(RT.px, RT.py); dy = ey - isoY(RT.px, RT.py) - TILE_H / 2;
    }

    // the held frame
    st = clamp(T('punchStop') * w.stop * p * lv.stop * F.stop, 0, T('punchStopCap'));
    if (st > pz.stop) { pz.stop = st; pz.stopMax = st; }

    /* The lurch. No attack: the peak lands on the frame the sound
       lands, because the frame is being held anyway and an eased zoom
       inside a hitstop is an eased zoom nobody can see. The gate is
       against the zoom that is ON SCREEN, not against the last punch's
       latched peak: comparing against the peak meant every beat of a
       Reprise after the first, and a boss dying 0.15s after a big
       close, got no lurch at all. */
    zz = clamp(T('punchZoom') * w.zoom * p * lv.zoom, 0, T('punchZoomCap'));
    if (zz > pz.zoom) { pz.zoom = zz; pz.ax = ax; pz.ay = ay; }
    pz.zHold = Math.max(pz.zHold, st * F.zhold);
    pz.hard = F.hard; pz.cut = F.cut;

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
       730px around one body at one syllable; 1790 and the room is full
       at twelve. */
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
```

#### The stepper, and the two transforms

```js
/* Real time, always. pz.stop is the thing holding the sim clock down;
   count it on the clock it is holding and it never reaches zero and
   the game is frozen with no way out but the dev menu. Same trick as
   RT.dilate at 3816 and the reason that line carries a comment.
   Registered through regFx, so stepFx has already resolved `real` and
   the harness case (__ninth.tick calls step with one argument) is
   handled once for the whole layer rather than in nine steppers. */
function stepPunch(dt, real, pz) {
    var lv = punchLv(), stp, ph, w;
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
    pz.z = lv.zoom > 0 ? Math.min(1.12, 1 + Math.round(pz.zoom / stp) * stp) : 1;
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
```

**Peak channel addition, honestly, because that number is what an accessibility
audit reads.** The core's brightest band is alpha 1 in the sprite, so the peak
addition is `RT.flash * FAM_BLOOM[fam].a * 255`. At level 2 the worst case is
`-ight` at full power: `0.55 * 0.304 * 255 = 43 of 255`. At level 3, `0.80 *
0.304 * 255 = 62`. `onChorusDown`'s bare `RT.flash = 0.5` is `0.5 * 0.5 * 255 =
64`. **The ceiling of the whole layer is 64 of 255, for under a fifth of a
second, at most three times a second (`RT.answerCd` is 0.34).** The bloom
coalesces by `Math.max`, so rapid punches sustain a wash rather than strobing it.

There is no white bleach and no full-frame inversion. `design-punch.md`'s
`'screen'` pass is +68 of 255 and its `'difference'` pass is +107, which is 2.2x
the number that document quoted as its own safety budget, and a 45% lerp toward
the inverse of a dark image is a flash to mid grey rather than the inversion it
is described as. Both are cut, and `-ight` gets the un-hiding instead, which is
better fiction, cheaper, and has no photosensitivity profile at all.

---

### 2.8 `slam()`, merged once

Two branches rewrote this function with two different bodies. This is the merged
body and it supersedes both. `-punch`'s hook 8 and `design-deton-3`'s hook 9 are
withdrawn.

```js
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
   o.y is the detonation's: at 2.6x opening scale a 74px word anchored
   at VH*0.44 reaches y 225 and would print straight over the line at
   174 and the rule at 187 on the exact frame both of them strike.
   VH*0.62 puts the composition back in the order it is designed in:
   line, rule, notches, tag, sub. */
function slam(txt, col, sub, o) {
    var p, t = 0.55, px = 62, y = VH * 0.44;
    if (o) {
        p = fxP(o.power == null ? 1 : o.power);
        t = o.dur ? o.dur : 0.55 + p * 0.14;
        px = Math.round(44 + 30 * p);
        if (o.y != null) y = o.y;
    }
    RT.slams.push({ txt: txt, col: col, sub: sub || '', t: t, max: t, px: px, y: y });
    if (o) punch(o);
    else { RT.shake = shake(9); RT.chroma = 0.5; }
}
```

Three lines change in `drawSlams` (1446-1468) and nothing else in it moves:

```js
        cx.translate(VW / 2, s.y || VH * 0.44); cx.scale(scale, scale); cx.globalAlpha = a;
        cx.textAlign = 'center';
        cx.font = 'bold ' + (s.px || 62) + 'px "Press Start 2P", monospace';
        // chromatic split: RT.chroma drives the offset and the family
        // drives the two colours, so a shadow slam fringes violet
        // instead of the print misregistration red and blue this was.
        // `scale` is passed so the split is 5 device pixels and not 13.
        chromaText(cx, s.txt, 0, 0, 1 - k, scale);
```

`|| 62` and `|| VH * 0.44` rather than the bare fields, because `bigLine`'s
neighbours and every story slam push through `slam(txt, col, sub)` with no bag
and must come out at exactly the size and place they came out at yesterday.
`k = 1 - s.t / s.max` already reads the record rather than the literal 0.55, so
`o.dur` needs nothing here.

---

### 2.9 The hooks

Every edit outside the two banners. Line numbers are `88c665c`; grep the quoted
line, not the number.

**1. `sLoad()`, one default, after 463.**

```js
    if (S.opts.bigtext == null) S.opts.bigtext = true;
    /* 0 off, 1 light, 2 full, 3 too much. A level rather than a
       boolean because "no hitstop but keep the colour" is a real
       preference and a switch cannot express it. Shake keeps its own
       toggle above. */
    if (S.opts.punch == null) S.opts.punch = 2;
```

`sLoad` opens with `if (S) return;` and `close()` never nulls `S`, so this only
lands on a full page reload or a save wipe. `punchLvI()` returns 2 for `null`, so
nothing depends on the write; the line exists so the value is in the save schema
where a reader can find it.

**2. `TUNE`, the tail at 187.** This is one of exactly two guaranteed merge
conflicts in the whole overhaul (the other is the FEEL reset button at 967).
`rhymeCost: 15` has no trailing comma. **The comma is added once, here, and the
other seven areas only ever append below.**

```js
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
    punchBloom: 0.55      // RT.flash written at full power
};
```

**3. `screenToWorld`, 62-66, the one backwards conversion in the file.**

```js
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
```

The shake is deliberately **not** undone here. It is not undone today either, and
undoing it would make the aim jitter along with the camera, which is worse than
being nine pixels out for a fifth of a second. `stepCamera` re-derives
`RT.mouse.wx/wy` from the screen point every frame (113-114), so the zoom error
self-heals the moment the punch ends and cannot accumulate.

**4. `frame()`, one term, 3809.**

```js
    // time thickens while a stanza writes itself, and stops dead when
    // something lands. RT.timeScale is the dev slider and stays out of it.
    var scale = RT.timeScale * (RT.dilate > 0 ? T('dilation') : 1) *
                (fxOf('punch').stop > 0 ? T('punchStopScale') : 1);
```

`frame()` reads the stop **before** `step()` decrements it, so the hold applies on
the frame it was requested. `punchStopScale` is 0.04 and not 0: a true zero
freezes `RT.t`, which drives every idle sine in the game (the actor bob 2112, the
lantern 2135, the foe wobble and tell 3481-3482, the exit ring 7895, the lamp
flicker 7844), and it silently freezes `RT.callCd` and `RT.answerCd` too. At 0.04
a 94ms stop advances the sim 3.8ms. Nothing is exactly stopped and everything
looks exactly stopped, which is what hitstop means everywhere else.

**5. `step()`, one new call, above the `RT.dead` branch at 3823.**

```js
    stepItems(dt);                                          // job 5: the wax goes cold, the shop closes behind you
    stepFx(dt, real);                                       // vfx: every registered effect, one call. Matter freezes, letters do not.
    if (RT.dead) {
```

Above the branch on purpose: a detonation keeps resolving through a death instead
of freezing half assembled behind the red wash, and a punch must be able to expire
while you are dead. It is above `stepCamera` (3838) so `pz.z` is settled before
`stepCamera` re-derives the mouse through `screenToWorld`.

**6. `step()`, the three decays, 3840-3842, replaced.**

```js
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
```

**7. `shake()`, 1505, one expression.** The thirteen legacy call sites and the
`S.opts.shake` gate are unchanged.

```js
function shake(a, cap) {
    if (!S.opts.shake) return RT.shake;
    /* punch() can leave the amplitude above the legacy cap of 14, and
       a legacy call arriving after it used to return min(14, 18 + 4),
       which is 14: a small hit QUIETENING a big one, and the rising
       edge detector above not firing either. A legacy call may raise
       an amplitude and may never lower one it did not set. */
    return Math.min(Math.max(cap == null ? 14 : cap, RT.shake), RT.shake + a);
}
```

**8. `draw()`, 3847-3932, in full.** Every changed line is marked. Everything
unmarked is byte-identical to the file today. This is the highest risk edit in the
overhaul because `PARALLEL.md` tells every other area to append at this function's
two seams while this restructures it: **both seams survive** (world space is still
between `drawParts` and `drawTypo`, screen space is still after `drawMap`), and
neither seam line itself is touched.

```js
function draw(rdt) {
    // was hard-coded to 1/60: on a 144Hz screen every typographic
    // effect outlived its intent by more than double
    var cx = RT.cx, dt = Math.min(0.05, rdt || 1 / 60);
    var pf = fxOf('punch'), t0 = RT.dbgPerf ? performance.now() : 0;   // NEW
    /* Three save/restore pairs now instead of one, so a throw anywhere
       inside leaks three levels of context state PER FRAME, forever,
       which is both a compounding transform and an unbounded internal
       stack. One idempotent line removes the whole class: a bad frame
       is still a bad frame and still gets noticed, but it cannot
       become every subsequent frame. */
    cx.setTransform(1, 0, 0, 1, 0, 0);                                 // NEW
    startBuildBudget();
    cx.save();
    punchShakeXY(cx);                                                  // CHANGED, was the inline re-rolled translate
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
    cx.save(); punchZoom(cx);                                          // NEW: zoom block A
    var fl = buildFloor(place().floor, pw(), ph()), c0 = cam();
    cx.fillStyle = '#07060a'; fullRect(cx);                            // CHANGED, was fillRect(0,0,VW,VH)
    cx.drawImage(fl.cv, Math.round(fl.box.x - c0.x), Math.round(fl.box.y - c0.y));
    if (RT.dilate > 0) {
        cx.fillStyle = 'rgba(6,4,10,' + (0.55 * clamp(RT.dilate / T('dilationT'), 0, 1)).toFixed(3) + ')';
        fullRect(cx);                                                  // CHANGED
    }
    drawExits(cx);
    drawLooks(cx);
    drawRings(cx, dt);
    if (RT.moveTo && !S.opts.wasd) { /* unchanged */ }
    var ents = [];
    RT.rdt = dt;
    RT.hide = [{ x: RT.px, y: RT.py, k: RT.px + RT.py, h: 44 }];
    /* the ents block is unchanged, all sixteen lines of it */
    ents.sort(function (a, b) { return a.k - b.k; });
    ents.forEach(function (e) { e.fn(); });
    drawLights(cx);
    cx.restore();                                                      // NEW: /A. the vignette is the eye, not the world
    drawVignette(cx);
    cx.save(); punchZoom(cx);                                          // NEW: zoom block B
    drawCalls(cx);
    drawFproj(cx);
    drawParts(cx);
    drawCuts(cx, dt);            // job 4: the cut-off last line, world space
    drawSnaps(cx, dt);
    drawFx(cx, dt);              // NEW: vfx world seam. every registered world effect, one call. See regFx.
    drawTypo(cx, dt);
    cx.restore();                                                      // NEW: /B
    drawBloom(cx);                                                     // CHANGED, was the flat RT.flash fillRect
    if (RT.hurt > 0 || RT.dead) { cx.fillStyle = 'rgba(150,10,25,' + (RT.dead ? 0.34 : RT.hurt * 0.3) + ')'; fullRect(cx); }   // CHANGED
    drawPrompt(cx);
    if (RT.mono > 0) {
        cx.save();
        cx.globalCompositeOperation = 'saturation';
        cx.globalAlpha = clamp(RT.mono / 1.4, 0, 1);
        cx.fillStyle = 'hsl(0,0%,50%)';
        fullRect(cx);                                                  // CHANGED
        cx.restore();
    }
    cx.restore();
    drawSlams(cx, dt);           // CHANGED: drawAssembly above it is DELETED, not moved
    drawLines(cx, dt);
    drawBossBar(cx);
    drawToasts(cx);
    drawMap(cx);
    drawFxS(cx, dt);             // NEW: vfx screen seam, over everything, outside the shake
    if (RT.dbgPerf) {                                                  // CHANGED: the whole block
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
    if (RT.dead) { /* unchanged */ }
}
```

`drawFxS` is **after** `drawMap` and therefore over it, deliberately: the map is
opaque and anything under it is simply gone. A pass that would fight it opens with
`if (RT.mapOpen) return;`, and every screen pass in this overhaul does.

`drawAssembly` is deleted rather than moved: the line is drawn by the detonation's
own screen pass now. `RT.assembly` stays on the `RT` literal (it is not this
area's line to edit and it costs one property) and `fxBoot`'s reset keeps nulling
it, so a stale one from any path cannot survive a doorway.

**Count the saves.** After this edit `draw()` has **three** `cx.save()` at its own
top level and three `cx.restore()`. Re-read the merged function, not your diff,
and count them. That is the check.

**9. `drawVignette`, 7857-7869, two changes.** This function belongs to job 3 and
both edits are one line each.

```js
    var ind = place().indoor, pz = fxOf('punch');
    if (pz.rev > 0) return;                       // -ight: for fifty milliseconds, nothing is hidden
    /* The frame narrows onto the blast and opens back up. It is the
       closest thing to a camera this game will ever have, it costs two
       terms in a gradient that is constructed every frame anyway, and
       unlike the zoom and the hold it still works at option level 1. */
    var sq = RT.flash * 70, cxx = lerp(VW / 2, pz.bx, clamp(RT.flash * 1.4, 0, 0.45));
    var vg = cx.createRadialGradient(cxx, VH / 2 - 30, (ind ? 300 : 250) - sq, cxx, VH / 2, 680);
    ...
    cx.fillStyle = vg; fullRect(cx);              // was fillRect(0,0,VW,VH): a 0.8 alpha wash nine pixels short of one edge
```

The gradient's radius is 680 from the centre and the corner of the extended rect
is about 650 away, so `fullRect` is safe with no change to the stops.

**10. `drawLights`, 7830-7853, two one-line changes.** Also job 3's.

```js
    if (p.indoor) cx.fillStyle = 'rgba(14,8,10,.34)';
    else cx.fillStyle = 'rgba(6,5,14,' + (p.night >= 2 ? 0.66 : 0.5) + ')';
    /* -ight drops the night by 60% for fifty milliseconds. The corners
       of the room, which are dark in every other frame of this game,
       are visible, and so is anybody standing in them. That is a
       reveal. A white flash is a camera. */
    cx.globalAlpha = fxOf('punch').rev > 0 ? 0.4 : 1;
    fullRect(cx);                                 // was fillRect(0,0,VW,VH); pre-existing 9px shortfall
    cx.globalAlpha = 1;
```
and one term inside the per-light loop:
```js
        var fk = (l.self ? 1 : 0.88 + Math.sin(RT.t * 6.2 + l.x * 2.7 + l.y) * 0.12) * (1 - RT.flash * 0.6);
```
The town's own lamps dip while a rhyme goes off and come back. It is the
difference between a coloured rectangle composited over the frame and the light
in the room changing, in a game named for a lamp on a sill, and it gives `-ark`
its darkness on top of the `dark` pass for one multiply.

**11. `drawLines`, 1493-1495, one allocation removed and one added.**

```js
        var txt = L.txt.slice(0, chars);          // once, not three times. arguments evaluate before an early return
        cx.fillStyle = '#08060c'; cx.fillText(txt, VW / 2 + 2, y + 2);
        chromaText(cx, txt, VW / 2, y, 0.5);      // the Reprise sets chroma to 1 and this is its line
        cx.fillStyle = L.col; cx.fillText(txt, VW / 2, y);
```

Pinned lines never expire, so the third `slice` would have run forever once a held
cue was up. Net: one allocation fewer per line per frame than the file has today.

**12. `drawTypo` gets nothing.** `design-punch.md`'s hook 10 offered
`chromaText` to every word at 13px or over. Refused. `hurtFoe` writes closed
answers at 16px and slant numbers at 12, so the fringe would land on eight small
drifting overlapping numbers after a *good* close and on nothing at all after a
slant, which is backwards; and a damage number's job is to be read as a value.
The big words carry the big moments. The budget goes to the detonation's line.

**13. `close()`, 8242, one line beside the two frees that exist.**

```js
    freeFloors();       // the cache is megabytes of prerendered ground; it does not outlive the window
    freeSprites();      // and neither do the prop bitmaps
    freeGlows();        // eleven 64 KB banded radials, same rule
```

**14. The tail, 8249, one line.**

```js
combatBoot();          // job 4: keybind + travel reset, once every var above exists
fxBoot();              // vfx: the effect registry, the punch tables, and the one shared travel reset
```

---

### 2.10 The option, the numbers, and who is allowed to call `punch()`

**The option.** One row, appended at the **tail** of the DEV DEBUG tab, after the
existing `wasd` row at 1014 and before the SOUND note at 1016. The tail is the
convention and the tail is where merges do not conflict.

```js
      /* A level, not a switch. Turning it down does not turn events
         off: the same punch() runs with smaller numbers, so nothing
         anywhere else in the file grows a branch. fillDev rebuilds the
         rows after every action, so the name follows the number. */
      { k: 'num', t: 'Screen punch. Hitstop, zoom, split, bloom: ' + PUNCH_LV_N[punchLvI()],
        sub: 'off / light / full / too much',
        get: function () { return punchLvI(); },
        set: function (v) { S.opts.punch = clamp(Math.round(v), 0, 3); sSave(); }, step: 1 },
```

No em dash in the label. It is a string a human reads.

| level | name | stop | zoom | shake | chroma | bloom | what you lose |
|---|---|---|---|---|---|---|---|
| 0 | off | 0 | 0 | 1.00 | 0 | 0 | everything but the shake, which keeps its own toggle |
| 1 | light | 0 | 0 | 0.85 | 0.50 | 0.50 | the freeze and the zoom. The vignette pull still works |
| 2 | full | 1.0 | 1.0 | 1.00 | 1.00 | 1.00 | nothing. default |
| 3 | too much | 1.4 | 1.4 | 1.25 | 1.40 | 1.30 | your composure |

**At level 0 the slam still prints, the line still assembles and the rule still
strikes.** The option is the *screen* punch. The typography is not optional; it is
the game.

**The FEEL rows**, appended at the tail of the FEEL tab (926-968), **before** the
`Reset every number to default` button at 967, which is the one row that must stay
last. `get` goes through `T(k)`, `set` writes `S.tune[k]` and never `TUNE[k]`, and
`fillDev` calls `sSave()` after every action.

```js
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
```

**`FAM_BLOOM` and `FAM_PUNCH` are not tunable, deliberately.** They are art: five
rows of a closed set, and the four numbers in each are the family's character
rather than the layer's feel. `punchShakeHz` moves all five shake rates together
and `punchBloom` moves all five brightnesses together, which is what you want
while tuning. `fxP`'s knee of 7, `fxS`'s 0.62 and `fxW`'s 0.055 are not tunable
either: they are the shape of the whole overhaul and thirteen documents quote
their output tables.

**Every call site, final.** The rule is **once per thing the player did**, never
inside a per-foe loop, never on a burn tick, never per particle.

| site | line | today | becomes |
|---|---|---|---|
| `landCall` | 2456 | `RT.shake = shake(0.7, 4);` | `punch({ fam: c.fam, power: 1 + f.stacks.length, kind: 'tap', x: f.x, y: f.y })`. The eighth syllable onto a pile taps harder than the first, which is the only escalation the Call has ever had. The `tap` row's own `cap: 5` keeps it near the old ceiling of 4 at five a second |
| `doRhyme`, all three outcomes | 2650-2661 | three `slam` calls plus two bare `shake()` | one `detonate(...)` per branch; the punch fires from `detFire` at `TSET`, not on the keypress |
| `stepReprise` | 2781 | `if (hit) RT.shake = shake(5);` | one `detonate(r.fam, hits, B.kind)` per beat |
| `stanzaWave` | 2919 | `RT.shake = shake(big ? 10 : 4);` | `punch({ fam: sz.fam, power: big ? 9 : 3, kind: big ? 'close' : 'wave', x: RT.px, y: RT.py })`, **before the loop and unconditionally**, because a stanza into an empty room has no hits, `detonate` returns null, and the biggest cooldown in the game would otherwise go off in silence. Double punching is free by construction: `punch()` takes the larger of every channel |
| `versePulse` | 2956 area | `shake(12)` once for the whole Verse | `punch({ fam: VERSE_FAM[k], power: 4 + 1.4 * k, kind: last ? 'close' : 'wave', x: RT.px, y: RT.py })` per stanza, same reason |
| `stepStacks` | after the double loop at 2477 | `breakStack` sets `RT.hurt` per stack | **one** `punch({ fam: firstSour.fam, power: soured, kind: 'sour', x: f0.x, y: f0.y })` after both loops. `design-punch.md` offered this *inside* `breakStack`, which is called from `for each foe { for each stack }`: twenty-five folk with a full pile lapsing on one frame is 200 `punch()` calls in one frame, and the document's own rule forbids it |
| `famEffect` execute | 2843 | nothing | a counter, and **one** `punch({ fam: 'ill', power: executes, kind: 'kill' })` after `live.forEach` at 2645. Same defect: `famEffect` is called per foe from three separate loops |
| `hurtPlayer` | 1770 | `RT.shake = shake(4);` | `punch({ power: n / 8, kind: 'hurt', x: RT.px, y: RT.py })`. **`n`, not `dmg`.** The parameter is `function hurtPlayer(n, src)`, the file is `'use strict'`, and `dmg` is a thrown `ReferenceError` from inside `stepFoes`, which kills the rAF loop on the first enemy hit |
| `onChorusDown` | 3442 | `RT.shake = shake(14); RT.flash = 0.5;` | unchanged. It keeps the warm white through `FAM_BLOOM.none` and needs no edit to job 4's function |
| `a3Mark`, the last cue | 5581 area | — | `punch({ fam: 'ill', power: 25, kind: 'toll' })`, no `x`/`y`, so it centres |
| `a3True` / `doVerse` | 5864 / 2957 | `shake(10)` / `shake(12)` | still work exactly as they do today. Job 1 may take a `punch` bag when it wants one |

The centroid for `doRhyme` is four lines in the existing loop: `hx += f.x;
hy += f.y; hn++;` next to `hitFoes++` at 2620 (**not** inside `if (takes)`, which
is false by construction on the drag and never fires on a slant), and
`if (hn) { hx /= hn; hy /= hn; } else { hx = RT.px; hy = RT.py; }` at 2645. That
plus the `isFinite` guard in `punch()` is the whole fix for the NaN anchor.

---

### 2.11 What the shared layer costs

**Idle: four numeric comparisons and one branch.** `punchShakeXY` returns unless
`pz.ox || pz.oy`; `punchZoom` returns on `pz.z <= 1`; `drawBloom` returns on
`RT.flash <= 0`; `chromaText` returns on `RT.chroma <= 0.02`. `stepFx` walks a
twelve entry array. The two extra `save`/`restore` pairs in `draw()` run
unconditionally: four calls a frame, no allocation, the cheapest thing on a 2D
context.

**Active, at the worst case in the game (8 foes x 8 stacks, 144Hz, 45 frames):**
two full surface operations (the darkening `fullRect` and one `drawImage` of a
128px source clipped to the canvas), two `Math.sin`, one `translate`, two
`scale`, and `chromaText` on one word. One extra full screen additive pass is
about a 20% increase in fill against a floor blit that is already 656k source
pixels, so the punch is roughly a 40% fill increase for a third of a second, at
most three times a second.

**Net allocations: negative.** The layer adds `partCol`, which removes 1800
strings and 900 CSS colour parses per frame at the particle cap, and removes one
`slice` per line per frame from `drawLines`. It adds one `toFixed` inside the
`RT.dbgPerf` block, which is off by default. Every CSS string it uses is built
once: `FAM_CHROMA` and `PUNCH_RGB` in `punchBoot`, the rest through `partCol` and
`fampx`.

**Memory:** eleven 128x128 canvases at 64 KB, 708 KB worst case, freed in
`close()`. One `FLOORS` entry is 2.5 MB.

**New sound names owned by this layer.** `sfx()` drops an unknown name off the
end of its chain with no throw and no console noise, so all three are safe to
ship before job 2 fills them in.

| name | when | what it wants to be |
|---|---|---|
| `hold` | the top of any hitstop over 0.05s | not a sample. A gesture on `RT.ac.currentTime`: a master gain dip of about 4 dB and a lowpass sweep down to ~800Hz over 20ms, back up over the length of the stop. The room going underwater for a tenth of a second. **The only one that matters** |
| `lurch` | the zoom lands, same frame | a very short low thump, 60 to 90Hz, 40ms, no tail. Felt, not heard |
| `settle` | the last rung of the ladder reaching 1.0 | almost nothing. A soft click, so the punch has an end and not just a fade |

`bleach` is not in this list because the white bleach it belonged to is cut.

---

### 2.12 Ledger: every critique finding against the shared layer

Applied or refused. Nothing dropped. Findings that belong to the detonation or to
a family are marked MOVED and are ruled in the sections that own them.

**`crit-eng-punch.md`**

| # | finding | ruling |
|---|---|---|
| 1 | NaN anchor on the drag and slant paths kills the whole frame | **APPLIED.** `isFinite` in `punch`, `!(m >= 1)` in `punchDir`, and the centroid accumulated on every hit rather than inside `if (takes)` |
| 2 | `hurtPlayer` hook is a `ReferenceError` on `dmg` | **APPLIED.** `power: n / 8` |
| 3 | `sour` punch inside `breakStack`, 200 calls in a frame | **APPLIED.** Hoisted to after `stepStacks`' double loop, one call with `power = soured` |
| 4 | execute punch inside `famEffect`, three calling loops | **APPLIED.** Hoisted to after `live.forEach`, one call with `power = executes` |
| 5 | `shake()` adds, so the one channel that summed was the loudest one | **APPLIED.** `punch` writes `RT.shake` directly by max and keeps the `S.opts.shake` gate |
| 6 | `chromaText` inside `drawSlams`' 2.6x scale is a 13px split | **APPLIED.** `sc` argument, division in device space |
| 7 | `pz.zTo` swallows the zoom on the second of two punches | **APPLIED.** Gate against `pz.zoom`; `zTo` deleted |
| 8 | the chroma pair is never reset, so legacy slams fringe in the last family | **APPLIED.** Reset beside the flash reset |
| 9 | the Chorus flash gets dimmer, not brighter | **APPLIED**, with the real numbers: `FAM_BLOOM.none.a = 0.50`, centre 72 against the old uniform 70, corners 25. Called out rather than asserted |
| 10 | `fullRect` misses `drawVignette`, the 0.8 alpha wash | **APPLIED** |
| 11 | the photosensitivity budget omits the bleach: +68 and +107 of 255 | **APPLIED by deletion.** The bleach is cut. The layer ceiling is restated as 64 of 255 |
| 12 | hook 11 allocates a `slice` per line per frame forever | **APPLIED.** One `slice`, a net reduction against today |
| 13 | a `tap` re-phases the big shake five times a second | **APPLIED.** Re-phase only on `sa > RT.shake * 0.6 \|\| RT.shake < 0.5` |
| 14 | `landCall`'s ceiling goes from 4 to 18 | **APPLIED.** Per-row `cap`, `tap: 5` |
| 15 | `ca`/`cb` written even when the punch loses the max | **APPLIED.** Latched behind the same test |
| 16 | `RT._dms` is a stray field on the `RT` literal | **APPLIED.** `fxOf('punch').dms`, and the whole `punch:` sub-object is off the literal too |
| 17 | the `size >= 13` gate catches more than the table counts | **MOOT.** `chromaText` is removed from `drawTypo` entirely (`crit-art-punch` #14) |
| 18 | a legacy `shake()` after a punch *lowers* the amplitude | **APPLIED** |
| 19 | under the harness the decays run 3.3x slow in a recital | **ACCEPTED and recorded.** Harness only, and the same pattern already affects `RT.dilate` at 3816 |
| 20 | two documentation claims that do not survive a read | **APPLIED.** `drawVignette` does not move, it is bracketed; 3442 is `onChorusDown`, reached from `foeDie` through `BOSS_DOWN` |
| 21 | the DEBUG row lands mid-tab | **APPLIED.** Appended at the tail |
| 22 | the FEEL clamps multiply out to `z = 1.32` | **APPLIED.** `pz.z` clamped at 1.12 and the row's `sub` says so |
| 23 | three save/restore pairs, a compounding leak | **APPLIED differently.** `cx.setTransform(1,0,0,1,0,0)` as the first line of `draw()`. It is one idempotent line, it cannot hide a bad frame the way a `try`/`catch` would, and it removes the compounding |

**`crit-art-punch.md`**

| # | finding | ruling |
|---|---|---|
| 1 | the word does not get bigger, which is the whole doctrine | **APPLIED.** `slam` carries `px` 44 to 74 and a longer life at power |
| 2 | `-ark` is shadow and the design makes the room brighter | **APPLIED.** `dark: 1.00`, `a: 0.109`: a small violet core and the town falling away around it |
| 3 | the flat additive lift is the wrong sign for every family | **APPLIED.** The lift is replaced by the darkening pass. Contrast, not addition |
| 4 | five families, one envelope: the differentiation is a recolour | **APPLIED.** `FAM_PUNCH` gains `stop`, `cut`, `zhold` and `hard`: `-eat` outlasts its own bang, `-erd` is cut off mid word, `-ill` stops instead of fading, `-ark` darkens, `-ight` un-hides |
| 5 | the drag gets a single-family fringe | **APPLIED.** `o.fam2` takes the trailing copy |
| 6 | the `-ight` bleach is a camera flash; reveal is nothing being hidden | **APPLIED.** The vignette does not draw and the night wash drops 60% for 50ms. No white at all, and cheaper than the fill it replaces |
| 7 | `FAM_CHROMA` invents five saturated hues | **APPLIED**, and the fix's own composition is corrected: `hex2rgb(pxShade(...))` returns a flat grey, so `rgbMul` exists |
| 8 | `none` keeps the red and blue the document condemns | **APPLIED.** Brass into tarnish |
| 9 | pure white in the one place the bible names | **MOOT.** The bleach is cut |
| 10 | the bloom is a smooth radial and the doc cites the comment that forbids it | **APPLIED.** Six hard bands, `bloomSprite` deleted, one glow technique in the game. The offered bonus of marching the brightest band outward is **REFUSED**: an expanding ring is the shockwave the detonation's own thesis forbids |
| 11 | every light in this town is a 1:0.62 ellipse and the bloom is a circle | **APPLIED.** `glowAt` takes `w` and `h`; `flat` defaults to 0.62 |
| 12 | the bloom radius never changes, only its alpha | **APPLIED.** `VW * (0.65 + 0.95 * p)`, 730px to 1790px |
| 13 | luminance-normalising deletes the one difference worth keeping | **APPLIED.** Intent multipliers folded into `a`: `-ight` brightest, `-ark` darkest |
| 14 | the closed path fringes eight damage numbers and the slant fringes none | **APPLIED by removal** from `drawTypo` |
| 15 | one frame of light per rung down the ladder | **REFUSED.** It re-lights the room after the event is over and fights the room going down under the line, which is the image the whole detonation is for |
| 16 | the vignette is moved and then not used | **APPLIED.** The frame narrows onto the blast and opens back up, and it works at option level 1 where the zoom and the hold are off |
| 17 | the town's lights do not notice | **APPLIED.** One term in `drawLights`' loop |
| 18 | the words split but their shadows do not | **APPLIED.** A leaning `#08060c` copy inside `chromaText` |
| 19 | `drawAssembly` is the one drawer omitted | **MOVED.** `drawAssembly` is deleted; the fringe on the setting words is the detonation's call and is ruled in §3 |
| 20 | a tap mid-slam recolours a word already on screen | **APPLIED.** Latched behind the max |
| 21 | `a3Mark` fires the loudest event in the game on the quietest beat | **APPLIED.** The `toll` row |
| 22 | an em dash in the one string a human reads | **APPLIED** |

**`crit-eng-deton.md`, the findings that land in the shared layer**

| # | finding | ruling |
|---|---|---|
| B2 | the area is a hard `ReferenceError` on `punch()`, and two files disagree about landing order | **RESOLVED BY CONSTRUCTION.** One specification, one file, no ordering. The three line `var punch = window.punch \|\| ...` shim is not written |
| B7 | the gather is drawn outside the shake and the zoom while its origins are inside both | **APPLIED.** `pz.ox`/`pz.oy` computed once in `stepPunch`, `punchWX`/`punchWY` for any screen pass anchored on a world point |
| B10 | `detFlyMax = 0` gives *more* flyers, not none | **APPLIED** in `fxBudget` |
| B11 | dropping `fxP` leaves eleven call sites pointing at nothing | **APPLIED.** One body, one alias, no conditional call sites |
| B12 | `slam()` is rewritten by two branches with two different bodies | **APPLIED.** One merged body in 2.8; both hooks withdrawn |
| B16 | `T` shadowed as a local in two world drawers | **APPLIED** as a standing rule |
| N2 | `foeStackY` and `fxPush` are declared and never called | **APPLIED.** Both are mandatory: `foeStackY` is the only legal way to get the stack row's y, and every family list goes through `fxPush` |
| N1 | `d.sc` and `d.pb` are computed and read by nothing | **MOVED to §3.** They are the documented interface for five `regDet` bodies that are not written yet |
| others | B1, B3-B6, B8, B9, B13-B15, N3-N14 | **MOVED.** Detonation, stanza and Verse findings, ruled in §3 and §4 |

**`crit-art-deton.md`, the findings that land in the shared layer**

| # | finding | ruling |
|---|---|---|
| 8 | the bloom is a ball of light at the enemy centroid, which the thesis forbids | **APPLIED.** `o.bx`, `o.by` and `o.flat` on the bag, so the detonation lights its own line rather than the bodies |
| 12 | `#3a3340` does not exist in `comp/ninth.js` | **APPLIED.** All three uses become `#3d3350` |
| 13 | two paper whites for one gesture | **APPLIED.** `#e8e2ee` is the strike everywhere; `#f0e9df` stays body text |
| 10, 11, 14 | the word fills with `glow`; the halo clips to white; the apparatus and the element are one colour | **MOVED to §3**, and the palette rule in 2.4 is written so those rulings have something to stand on: brass is the mark for measured and finished, `glow` is light, `col` is ink |
| others | 1-7, 9, 15-30 | **MOVED.** Detonation and family findings |

**RECON traps the shared layer closes outright:** 1 (nothing here re-draws a list
that ages itself), 2 and 10 (the one travel reset, and the four legacy arrays),
4 (the three decays move to the real clock), 5 (`RT.chroma` is read at last),
6 (the hitstop counts on `real` and never touches `RT.timeScale`), 7 (`fxBudget`
divides before the loop), 8 and 9 (`glowSpr` folds the colour into the key and
`glowAt` centres instead of anchoring at the feet), 15 (`shake()` still returns
and can no longer be made to lower), 16 (`slam()` has a size and a duration),
and the sub-pixel jitter in trap 10 of the audit (the shake is rounded).

---

## 3. THE FIVE FAMILIES

Five sounds, five slots each: **projectile, pip, detonation, status, finisher.**
Twenty-five pieces of code. The user's first requirement is that they are
genuinely different from each other, so this section opens by fixing the axes
they differ *on* and closes by auditing whether they actually did.

### 3.0 The family contract

#### 3.0.1 One registration, one block, one family

Every family design independently proposed a five-way `if (c.fam === 'eat')`
chain inside `callTrail`, `callHead`, `callMark`, `callWord`, `drawStacks`,
`breakStack`, `famEffect` and `drawFoe`. That is eight shared functions each
carrying five branches from five authors: forty guaranteed merge conflicts, and
`crit-eng-ill` #24, `crit-eng-ight` #10, `crit-eng-ark` #25 and
`crit-eng-eat` #13 all name it independently. `FOE_DRAW` (3769) is the file's own
answer and its comment already says *"drawFoe never grows another branch."*

**So: one `regFam(id, row)` per family, at the foot of that family's block, and
it fans out into the tables `2.1` already named.** The tables stay because three
sibling documents and four critiques quote them by name; the *registration* is
one call so a family is one contiguous block of the file that a reviewer can read
end to end.

```js
/* ═══════════════ THE FIVE SOUNDS ═══════════════
   One block per family, below this banner, in FAM_IDS order, each
   ending in one regFam(). Everything a sound does lives in its own
   block: nothing above this line has a branch on a family id in it,
   and that is the point. Eight shared functions were about to grow
   five branches each from five authors.
   Every row is seeded from `none` (2.1a), so a family that has not
   landed yet draws the plain thing rather than throwing, and a family
   that wants a slot gone passes null for it and the consumer tests
   for truth. */
var FAM_CALL = {}, FAM_PIP = {}, FAM_FADE = {}, FAM_LAND = {},
    FAM_ST = {}, FAM_FIN = {}, FAM_SOUR = {}, FAM_LINE = {};
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
```

**Four names from `2.1` are cut, with reasons.** `FAM_TRAIL`, `FAM_PROJ`,
`FAM_WORD` and `FAM_MISS` all describe one object in flight and all four would be
looked up on the same frame from the same two functions. They are keys on
`FAM_CALL`'s row (`trail`, `mark`, `head`, `word`, `fizz`) instead. Four tables
whose keys are always the same five strings is four lookups and four places to
forget a row.

**`FAM_FADE` survives as its own table** and is the one exception, because
`crit-eng-ight` #5 is right about why: `drawStacks` computes `fade` at 3550 and
the pip drawer runs after it, so a family that wants the *letter* to flicker
cannot do it from inside the pip. `FAM_FADE[s.fam](s)` returns a multiplier and
is applied to the shared `fade` before anything is drawn.

#### 3.0.2 The row, every key, and what calls it

| key | signature | called from | clock |
|---|---|---|---|
| `call` | a row of numbers plus `trail(c, dt)`, `mark(cx, c, sx, sy, P)`, `head(cx, c, sx, sy, P)`, `word(cx, c, sx, sy, P)`, `fizz(c)` | `stepCalls` / `drawCalls` | sim / real |
| `land` | `land(f, c)` | `landCall`, once | — |
| `pip` | `pip(cx, s, x, sy, w, fade)` | `drawStacks`, per stack | real |
| `fade` | `fade(s)` returns a multiplier | `drawStacks`, before the alpha | real |
| `sour` | `sour(f, s, i)` | `breakStack`, once per lapse | — |
| `det` | `det(f, n, d)` | `detonate`, once per body | — |
| `snap` | `snap(cx, s, k, sx, sy)` or `null` | `drawSnaps` | sim |
| `st` | `st(cx, f, h, sx, sy)` | `drawFoe`, inside the body transform | real, state on sim |
| `fin` | `fin(f)` | `foeDie`, before the default burst; returns 1 to suppress it | — |
| `line` | `line(cx, d, k, x, y, w)` | `drawFamLine`, ord 90.5 | real |
| `step` / `draw` | `(dt, real, st)` / `(cx, dt, st)` | `stepFx` / `drawFx` at the family's ord | both |

**`st` is the only slot with a rule about state.** `drawFoe` (3478) and
`drawStacks` (3538) take no `dt`, and `crit-eng-ark` #1 and `crit-eng-ill` #6 are
both right that ageing a timer or pushing a `part()` from inside a drawer is the
bug RECON's trap 1 is about: `devDemo` calls `draw()` bare at 8143, 8152 and
8221, and `__ninth.tick` calls `step()` then `draw()`, so a draw-side timer
advances on frames that never simulated and a draw-side emitter makes the
particle count depend on how many times you painted. **Every `st` drawer is
pure.** All of its state is a `f._fx` object written by the family's own
`step`, which `stepFx` calls with a real `dt`.

```js
/* The per-body private bag. One object per foe per family that wants
   one, made on demand, dying with the body. `f._fv` at 3468 is the
   house precedent for the underscore.
   Nothing in FX ever holds an `f`: foeDie sets f.dead = 1 (3421),
   stepFoes splices on the next frame (3068) and gotoPlace does
   RT.foes.length = 0, so a record holding a foe keeps a corpse alive
   and redraws it at a tile that means something else in the next
   room. Copy f.x, f.y and foeH(f) at emit time; that rule has no
   exceptions in this section. */
function famOf(f, id) {
    var b = f._fx || (f._fx = {});
    return b[id] || (b[id] = {});
}
```

#### 3.0.3 The four things all five share, written once

```js
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

/* THE SILHOUETTE. -eat asked for it, -ight, -ill and -ark all need
   it, and it is the single most valuable shared primitive in this
   section, so it is written once and lives beside FOE_H and
   FOE_DRAW at 3684 rather than inside any family's block.
   crit-eng-eat #1 is why the position matters and it is a hard
   ReferenceError, not a style note: MOUTH_SHUT (3573), THIEF_SPR
   (3603), DRONER_SPR (3624), DEAF_SPR (3643) and SWORD_SPR (3663)
   are plain `var`s at module scope, and `var` hoists the binding and
   not the initialiser, so a FOE_SIL literal evaluated up in the
   families banner captures five undefineds and the first -eat close
   throws inside draw() with three unrestored saves on the context.
   The file already carries this scar twice, at 2785 and at 8249.
     rows  the sprite's own row strings, so the mask is per pixel
           accurate and free: bake() already skips any character not
           in the palette (1852).
     lo/hi per row, the first and last non-air column. crit-art-eat #2:
           every family that places a mark "on the rim" was placing
           it on f.r * 22, which is the HIT radius and is 4 to 10
           pixels inside the ink on every archetype. Twenty-two
           numbers per kind, computed once, and they are the
           difference between a bite out of a body and a black
           rectangle floating in front of its chest.
     dx    the drawer's own blit offset: drawThief is x=2 (3699),
           drawSword x=3 (3712). crit-eng-ill #8.
   The Sword's tell wraps its blit in translate/rotate/translate
   (3712-3716) and this mask reproduces no such transform, so a mask
   on a Sword mid-tell slides off. The Sword is `norhyme` (206) so it
   can never be detonated, but it CAN be frozen, and -ill's ice path
   below checks for it by name. */
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
   bake()'s key (1841), which is why every existing caller folds the
   varying part into the key by hand (`foe.thiefT` vs `foe.thief`), so
   the colour goes in the key here too. One canvas per kind per
   colour, forever, against a 10 MB SPRITE_BUDGET. */
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
```

`PXS` is 2, so a mask column index `c` is `c * 2` screen pixels from the sprite's
left edge and the sprite is drawn by `blit` at `Math.round(x - w / 2)` (1865).
**The one expression every family uses to get from a mask row to a body-local
x**, written here so nobody derives it twice:

```js
/* row r of kind K, in drawFoe's body transform (origin at the feet,
   up negative). `+ d.dx` is the drawer's blit offset and `- d.w / 2`
   is blit's own centring. */
function silX(d, c) { return c * PXS + d.dx - d.w / 2; }
function silY(d, r) { return r * PXS - d.h; }
```

#### 3.0.4 The pip glyph set, closed

`drawStacks` lays `fam.tag.slice(0, 3)` at 8px `Press Start 2P` into a 13px cell.
Press Start 2P has a square advance, so that is 24 pixels of ink in a 13 pixel
slot and adjacent tags overlap by eleven. Every family design independently
concluded that one glyph per cell is the honest version, and `-eat` claimed `E`
unilaterally. `crit-art-eat` #8 caught the collision: the tags' first letters are
**E, I, E, A, I**, so `-eat`/`-erd` and `-ight`/`-ill` are two pairs separated by
colour alone, under the night wash, at 8px.

**The set, chosen so no two collide and each is the sound's own letter rather
than the tag's first:**

| family | glyph | why |
|---|---|---|
| eat | `E` | the vowel of the sound |
| ight | `I` | the vowel of the sound |
| erd | *none* | `-erd`'s pip is two bars and an ink fill. It is the only empty cell on the board and that is the family |
| ark | `K` | the consonant the four words end on. `A` collides with nothing but says nothing |
| ill | `L` | the consonant the four words end on |

`-erd`'s empty cell is not a fifth glyph dodged, it is the strongest single idea
in `crit-art-erd` (#7): `singReduced` (4258) *"walks 5 4 3 2 and leaves the last
slot empty, which is the hole in the song, in the song"*, and `fillBook` renders
every false line with an `<s>?</s>` in it. **An empty slot in a row of slots is
this game's established mark for the line that was cut out**, and `-erd`'s own
truth-word is `word`. The cell is filled with ink between its two bars rather
than left blank, so it reads as *covered* and not as *absent*.

#### 3.0.5 The distinctness matrix

This is the table the whole section is accountable to. If two columns agree on a
row, one of them is wrong.

| | **eat** | **ight** | **erd** | **ark** | **ill** |
|---|---|---|---|---|---|
| **the verb** | takes a piece out | points a lamp | gives an order | takes the light away | stops |
| **composite** | `lighter` | `lighter` | **`source-over`, opaque** | **`multiply` on bodies, `source-over` ink on the floor** | `source-over` |
| **matter shape** (`p.sh`) | `0` squares + `1` splinters | `1` chips lying flat | *no particles at all*: hard bars | `0` heavy drops | `2` standing slivers |
| **matter physics** | falls, bounces, cools by index | falls hard (`grav 240`), lands and stays flat | flies **sideways only**, no gravity, cut mid-air | falls heavy, no bounce, `add: 0` | **hangs** (`fr`), then drops |
| **the shape it draws** | the notch, a hole | the wedge and the cast quad | the bar and the rule | the ellipse of ink and the waterline | the **broken** ring, three arcs with gaps |
| **its motion** | **contracts** inward | **opens** outward from you | closes, then is **cut** | spreads and **stays** | contracts, then **holds** |
| **its clock** | sim, and it outlasts its own bang | real, and it is over in 0.34 | real, and it is over in 0.33 | sim, and it lasts five seconds | **sim, so the hitstop freezes it too** |
| **the word** | bitten through with `drawCuts`' idiom | lit from above, long hard shadow | **redacted**: a bar closes over it | **hollow**: `strokeText`, the only one in 8279 lines | **held still**, with one frost spur per stack |
| **the body** | holes in its own silhouette | one lit half, one dark half, a long shadow | a black band with two nails | a shadow climbing it like a waterline | **repaletted cold**, pose held |
| **the floor** | a ring of teeth closing | two ticks and a spoke per body | one struck rule at your feet | a stain that **never goes away** | a pool of lamplight with a bite out of it |
| **what it leaves** | 3s of burn, then the holes close | 5s of reveal | 0.33s, then 3.6s of gag | 5s of rot, then a permanent mark | 1.4-3.0s of freeze, then a shudder |
| **the player** | is **lit** and grows | throws his own shadow back, hard | nothing. An order costs the giver nothing | the lantern is **hooded** | the lantern **dips**, and stays down |
| **the punch** (2.7) | `zhold 2.2`, outlasts its bang | `rev`, un-hides the room | `cut 0.09`, cut off mid word | `dark 1.00`, the room falls away | `hard 1`, the light stops instead of fading |

#### 3.0.6 Three shared edits the five families make together

**A. `drawFoe`'s contact ellipse, 3510.** Four of the five want this line and it
is one line, so it is a field rather than four branches.

```js
    /* the contact shadow, and it is now a channel. -eat spreads it as
       the ground gives under something being eaten, -ark swells it
       because under this family shadows get bigger, -ill tightens and
       darkens it because a thing that has stopped is pinned to the
       floor, and -ight suppresses it outright for the length of a
       reveal because the reveal REPLACES the ambient rather than
       arguing with it (crit-art-ight #4: a body with two shadows
       pointing different ways is the sticker failure the prop comment
       at 6683 warns about). Two numbers, read with == null defaults so
       nothing has to be added to spawnFoe, written only by a family
       stepper and always cleared by the same stepper. */
    var cr = f.csr == null ? 1 : f.csr, ca = f.csa == null ? 0.42 : f.csa;
    if (ca > 0) {
        cx.fillStyle = partCol('0,0,0', ca);
        cx.beginPath(); cx.ellipse(0, 0, f.r * 21 * cr, f.r * 8 * cr, 0, 0, TAU); cx.fill();
    }
```

**B. `drawFoe`, the status seam, after the frozen rect at 3515.** One line, inside
the body transform, inside the existing `save`/`restore`, and **after** both the
hit flash (3513) and the freeze tint (3515). `crit-eng-ark` #6: `hurtFoe` sets
`f.flash = 0.09` on the same frame `doRhyme` runs (2853) and 3513 paints it as a
`lighter` white over the whole body box, so a status inserted before it spends its
first 90 milliseconds under a white wash. `crit-eng-erd` N3 is the same argument
from the other side: `-ill`'s 45% `#cfeeff` rect is at 3515 and would wash out
`-erd`'s band, both nails and its lit edge.

```js
    if (f.frozen > 0) { /* -ill replaces this line entirely: see 3.5 */ }
    var stn = FAM_ST[famStatus(f)];                  // one lookup, no branch
    if (stn) stn(cx, f, h, sx, sy);
    cx.restore();
```

```js
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
    return 'none';
}
```

`-erd`'s band, brackets and strike still need to draw on a frozen body, and
`-ight`'s cast shadow is in world space and never went through here at all. Both
are handled the same way: **anything a family wants drawn regardless of who owns
the body goes in that family's own `draw` at its own `ord`**, not in `st`. `st` is
only for the layers that must be inside the body transform, and only one family
gets it per frame.

**C. `f.burn` gains `fam` and `max`.** `crit-eng-eat` #3 and `crit-eng-ark` #2 are
the same defect from two sides: `famEffect` writes `{ dps: 5 * n, t: 3 }` at 2822
and `{ dps: 3.5 * n, t: 5 }` at 2834, neither carries a family, and the tick at
3072 hard-codes `'eat'` as the attributing family and `'255,140,60'` as the ember
colour. So `-ark`'s five-second rot has always thrown orange sparks, and any
`b.t / b.max` a family writes is `NaN`.

```js
        f.burn = { dps: 5 * n, t: 3, max: 3, fam: 'eat' };            // 2822
        f.burn = { dps: 3.5 * n, t: 5, max: 5, fam: 'ark' };          // 2834
```
```js
        /* stepFoes 3072, the 0.5s tick. One dispatch instead of one
           hard-coded ember. The `else` is the literal line that is
           there today, so a family that has not registered a tick
           still burns exactly as it burns now. */
        var tk = FAM_BURN[f.burn.fam];
        if (tk) tk(f); else part({ x: f.x, y: f.y, z: rnd(10, 40), vx: 0, vy: 0, vz: rnd(6, 16),
                                   life: 0.4, size: 2, col: '255,140,60', add: 1, grav: 0 });
        hurtFoe(f, f.burn.dps * 0.5, f.burn.fam, { dot: 1 });
```

`FAM_BURN` is a two-entry table declared in this banner; only `-eat` and `-ark`
have one. Do **not** claim, as `design-eat.md` did, that this fixes a charm
interaction: `crit-eng-eat` #10 checked, and `famDmgMul` (513) is applied at 2444,
2602, 2613, 2615, 2773 and 2917 only, never at the tick. The misattribution is
currently inert. The dispatch and the ember colour are the reasons.

---

### 3.1 `-eat` — hunger

> *"We burned the doors, we burned the pews, we burned the market street."*

**The one image.** Hard black notches chewed inward through the sprite's own
outline, the crumbs falling and cooling on the floor, and the missing pieces
flying back across the square to land in your chest.

Nothing in this family is added to the world. Every layer is something taken out
and moved somewhere else, and there is one primitive, **the notch**, which appears
on the body, in the word and on the floor. Stanza 1 is the one stanza the town did
not falsify (`t` and `r` are identical at `BALLAD[0]`): nobody lied about being
hungry. If you find yourself drawing a flame, stop.

**The ramp.** Five values, one fewer than the design had.

```js
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
function eatBoot() {                                  // called from fxBoot: rgbMul needs hex2rgb
    EAT_LIT = hex2rgb(FAMS.eat.glow);                 // 255,194,113
    EAT_HOT = hex2rgb(FAMS.eat.col);                  // 232,145,58
    EAT_COOL = rgbMul(FAMS.eat.col, 0.78);            // 181,113,45
    EAT_CHAR = rgbMul(FAMS.eat.col, 0.38);            // 88,55,22
}
function evenPx(v) { return Math.round(v / 2) * 2; }  // PXS is 2 and the town is on a 2px lattice
```

`evenPx`, not `p2`: `crit-eng-eat` #18 found `var p2` already live as a local at
6816 and 7674. A module-scope `function p2` is legally shadowed at both and
nothing breaks today, which is exactly the kind of thing that breaks in a year.

#### 3.1.1 The projectile: it eats its way forward

```js
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
        cx.fillStyle = 'rgba(24,10,4,.30)';
        cx.beginPath(); cx.arc(0, 0, r, 0, TAU); cx.fill();
        cx.globalCompositeOperation = 'lighter';
        cx.globalAlpha = 0.34 + c.near * 0.34; cx.strokeStyle = P.col; cx.lineWidth = 2;
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
       heat->HE, wheat->WHE, street->STRE, eat->EA. Three of four are
       letter salad, and the fourth is the pronoun this entire game is
       about a town writing over another one. Worse, it is a SPELLING
       event in a game whose physics is that rhyme is how the world
       checks whether something is true: the tail of the word IS the
       rhyme, so eating it made the picture lie about the mechanic.
       From the front: street->TREET->EET, wheat->HEAT->EAT,
       heat->EAT, eat->EAT. Every result is legible, every result
       still rhymes, and what lands is the syllable, which is exactly
       what sticks. The rhyme is the last thing to go.
       Two crumbs are thrown on the frame a letter comes off, so the
       letter visibly falls rather than being edited out. */
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
    }
};
/* The chewed word, computed and not stored, so nothing has to be
   cleared. c.max is on the call literal (2390) as `max: T('callRange')
   / 13`: crit-eng-ill #19 is right that recomputing T('callRange')
   per frame is wrong the moment somebody drags the FEEL slider mid
   flight, and it is the same field typo, slam and snap all carry.
   Words of four or fewer never chew, so `eat` stays `EAT`. */
function eatWord(c) {
    var w = c.word.toUpperCase();
    if (w.length < 5) return w;
    return w.slice(c.age > 0.82 ? 2 : c.age > 0.55 ? 1 : 0);
}
```

`landCall` passes `eatWord(c)` into its arrival `typo`, not `c.word`
(`crit-eng-eat` #17): a projectile that has visibly shortened and then pops back
to four characters at the exact moment of impact is worse than not chewing at all.

**The cast.** `crit-art-eat` #15: the chain of falling matter starts one link too
late. Three `EAT_CHAR` crumbs at the barrel point on `doCall`, `vz` negative,
falling immediately. Then the material runs unbroken from your mouth, through the
flight, into the body, out of the wound and back into your chest. One substance,
five stations, three particles per call. This goes in `FAM_CALL.eat.cast(x, y, a)`,
called from `doCall` through the same registry.

#### 3.1.2 The pip: `E`, and the bottom is eaten

```js
/* Four layers in a 13px cell, and the fourth is the one that matters.
   crit-art-eat #10: the core loop is build a pile, watch it get
   scary, close it, and the design rendered the close magnificently
   and the build not at all. */
function eatPip(cx, s, x, sy, w, fade) {
    /* the seed. crit-eng-eat #11: addStack sets born (2467) but the
       Droner's self-write at 3351 does not, so every drone -eat pip
       seeded off `(s.born||0)*1000` came out flat-bottomed and
       identical. `born: RT.t` is added at 3351 in this commit (it is
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
   makes the particle count depend on how many times you painted. */
function eatShed(f, dt) {
    var n = 0, i;
    for (i = 0; i < f.stacks.length; i++) if (f.stacks[i].fam === 'eat') n++;
    if (n < 2) return;
    var e = famOf(f, 'eat');
    e.shed = (e.shed || 0) - dt;
    if (e.shed > 0) return;
    e.shed = Math.max(0.125, 0.5 / n);
    var pw = f.stacks.length * 13 + 8;
    part({ x: f.x + rnd(-pw / 2, pw / 2) / TILE_W, y: f.y - rnd(-pw / 2, pw / 2) / TILE_W,
           z: foeH(f) + 18 + (f.so || 0) - 4, vx: 0, vy: 0, vz: rnd(-8, 0),
           life: rnd(0.5, 0.9), size: rnd(1.4, 2.4), col: EAT_CHAR, add: 0, grav: 120, sh: 1 });
}
```

The `x`/`y` nudge is the identity `isoX(x + d, y - d) === isoX(x, y) + d * TILE_W`
with `isoY` unchanged, which is exact in this projection and is the only legal way
to put a world particle at a screen-pixel offset. It is used three more times in
this family and once in `-ark`.

**The sour.** `crit-art-eat` #14: the erosion has no ending, the glyph gets thin
and then somebody else's grey word replaces it.

```js
/* The stack ate you instead. Hunger that goes unanswered should be
   the one that reads worst: the erosion finishes in one frame, three
   char crumbs come off the plate, and the self-damage number is char
   rather than the shared white. */
function eatSour(f, s, i) {
    var pw = f.stacks.length * 13 + 8, j;
    for (j = 0; j < 3; j++)
        part({ x: f.x + rnd(-pw / 2, pw / 2) / TILE_W, y: f.y, z: foeH(f) + 14 + (f.so || 0),
               vx: 0, vy: 0, vz: rnd(-14, -4), life: rnd(0.5, 0.9), size: rnd(1.6, 2.8),
               col: EAT_CHAR, add: 0, grav: 150, sh: 1 });
    return EAT_CHAR;                    // breakStack tints its own number with the return
}
```

#### 3.1.3 The detonation: the bite

```js
/* One body, n syllables, d the shared detonation context (3.0.2).
   Nothing here stores f. Everything here reads d and writes only
   fxOf('eat') and famOf(f,'eat').
   crit-eng-eat #7: a Reprise fires this THREE times per foe inside
   0.68 seconds with the full pile each time, which is 912 crumbs, 24
   words and 24 rings against a 900 cap, and it re-seeds the notch set
   twice mid-effect so the holes jump. `d.kind === 'beat'` is the
   repeat signal and it is already on the record, so no new argument
   is needed: a repeat halves the matter, skips the ring and the word,
   and does not re-seed. */
function eatDet(f, n, d) {
    var st = fxOf('eat'), e = famOf(f, 'eat'), rep = d.kind === 'beat' || d.kind === 'wave';
    var h = foeH(f), sil = foeSil(f.def.draw), sc = fxS(n), i, cb, sp;
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
```

**Every scaling decision in that function, and why it is that number.**

| | n=1 | n=2 | n=4 | n=6 | n=8 |
|---|---|---|---|---|---|
| notches `nb` | 3 | 4 | 6 | 7 | 10 |
| notch w x h | 4x4 | 6x4 | 6x6 | 8x6 | 8x8 |
| crumbs, one foe | 10 | 14 | 22 | 30 | 38 |
| ring teeth | 12 | 12 | 14 | 16 | 16 |
| word px (`18 * fxS(best)`) | 18 | 23 | 29 | 34 | 38 |
| word eaten through | no | no | no | **yes** | **yes** |

`crit-art-eat` #9: from n=6 to n=8 the design's own table moved everything by
twenty percent, and nobody has ever felt a nineteen percent font size increase.
The game already believes in a number — `ach('six')` fires at `best >= 6` (2648) —
so at six the family does something categorical that it does not do below six:
**the word is eaten through.** The same notch shapes are punched through the
glyphs in `#08060c`, so the typography and the matter become one object at exactly
the moment the doctrine most needs them to. That is `thru` above, and it is three
`fillRect`s.

```js
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
    cx.translate(Math.round(isoX(o.x, o.y)), Math.round(isoY(o.x, o.y) + TILE_H / 2));
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
    var sx = Math.round(punchWX(isoX(o.x, o.y))), sy = Math.round(punchWY(isoY(o.x, o.y) + TILE_H / 2 - o.z - k * 26));
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
```

`punchWX`/`punchWY`: this word is drawn at the world seam, **inside** the shake and
the zoom, so it needs neither — but the drain motes below and the `+N` are on the
same list and one of them is anchored on the player at the screen seam. The rule
from 2.3 is that anything whose origin is a body and whose pass is outside the
transforms applies both, and it is cheaper to apply the identity than to remember
which list is where. At `pz.z === 1` and `pz.ox === 0` both functions are two
additions and a multiply by one.

**The snap.** `-eat` keeps `snapDefault`. Two brackets closing on the row the
sounds were sitting in is already the right gesture for a family whose verb is
*take*, and a second bespoke snap on top of a bite, a ring, a word and forty
crumbs is the noise `crit-art-eat` #6 is complaining about.

#### 3.1.4 The status: the burn, while it cooks

```js
/* Drawn inside drawFoe's body transform, after the flash and the
   freeze. Pure: every number it reads was written by stepEat.
   Three layers and one of them is subtraction. */
function eatBody(cx, f, h, sx, sy) {
    if (!f.burn || f.burn.fam !== 'eat') { if (!famOf(f, 'eat').shut) return; }
    var e = famOf(f, 'eat'), b = f.burn;
    var k = b ? clamp(1 - b.t / (b.max || 3), 0, 1) : 1;
    var shut = e.shut > 0 ? e.shut / 0.30 : 1;               // 1 open, 0 closed over
    var d = foeSil(f.def.draw), spr, i, o = EAT_N, rim;
    if (shut <= 0) return;
    /* THE BODY LOSES VALUE. Per-pixel accurate because it is the
       sprite's own bitmap: the one flat rect over a silhouette that
       drawFoe does twice (3513, 3515) is the thing this exists not to
       be. The foe converges on the same dark its holes are made of. */
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
       four to ten pixels inside the ink on every archetype
       (crit-art-eat #2, crit-eng-eat #4). */
    rim = k < 0.5 ? mixRgb(EAT_LIT, EAT_HOT, k * 2) : mixRgb(EAT_HOT, EAT_CHAR, (k - 0.5) * 2);
    for (i = 0; i < e.nb; i++) {
        eatNotchAt(d, e, i, f, o, shut);
        if (o.w < 1 || o.h < 1) continue;
        cx.fillStyle = EAT_BITE; cx.fillRect(o.x, o.y, o.w, o.h);
        /* the inner rim: the only lit pixel this family ever ADDS to a
           sprite. It does not fade to nothing (crit-art-eat #1c): it
           cools to char and holds there. A cold rim is still an edge.
           No edge is no wound. */
        cx.fillStyle = partCol(rim, 0.75 * shut);
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
    var s = frac(e.seed + i * 7.31), t = frac(e.seed + i * 3.77), r, c, side;
    /* the closing path eases on shut*shut so the last two frames are
       sub-pixel. crit-eng-eat #15: a Math.max(2,...) floor made both
       dimensions stop at 2 and then get switched off, and a 2x2 black
       square blinking out is not "it survived and it healed over". */
    o.w = Math.round(e.nw * shut * shut); o.h = Math.round(e.nh * shut * shut);
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
```

**The chew advances**, on the burn's own 0.5s tick, through `FAM_BURN.eat`: one
notch — cycling by tick index — grows by 2px in each dimension, and
`clamp(2 + round(n * 0.4), 2, 6)` crumbs come off **that notch** rather than off
the foe's centre, through the `x + d` / `y - d` identity. **The ground gives**:
`f.csr = 1 + k * 0.35` on the shared contact channel from 3.0.6. **No scorch
decal**: scorch is fire leaving a mark and this family does not leave marks, it
takes things away.

**When the burn ends**, `stepEat` sets `e.shut = 0.30` and the notches close over.
An effect that ends is worth three that switch off.

#### 3.1.5 The finisher: the drain, and the husk

```js
/* THE DRAIN, and it runs whether or not you have room for it.
   crit-eng-eat #8 and crit-art-eat #4: the design gated the whole
   layer on `heal > 0`, and gotoPlace refills you on every transition
   (6153), so the family's headline effect was silently skipped in the
   commonest state of the game and the first hunger detonation a new
   player ever casts showed them nothing. It is also wrong per foe in
   a multi-foe close, because live.forEach runs in list order and the
   first body consumes the whole deficit.
   The theft happens either way. At full health the pieces still come
   out of the wound and arrive; the number just does not appear.
   crit-art-eat #5: counted off n, not off heal. `clamp(round(n*1.5),
   1, 4)` gave 2,3,4,4,4,4 across n=1..8, so countability died on the
   third rung of an eight-rung ladder. The count stays capped at four
   and the POWER moves into weight and rhythm, which the eye reads
   faster than a count anyway: the motes get fatter and the stagger
   tightens into a drumroll. */
function eatDrain(f, n, h, d) {
    var st = fxOf('eat'), per = clamp(Math.round(n * 1.5), 1, 4), i, e = famOf(f, 'eat');
    var gap = Math.max(0.02, 0.09 - n * 0.008), side, o = EAT_N;
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
    var u = k * k, px = isoX(RT.px, RT.py), py = isoY(RT.px, RT.py) + TILE_H / 2 - 26;
    var x0 = isoX(m.x0, m.y0), y0 = isoY(m.x0, m.y0) + TILE_H / 2 - m.z0, j, uu, mx, my, s;
    for (j = 0; j < 3; j++) {
        uu = clamp(u - j * 0.06, 0, 1);
        mx = Math.round(lerp(x0, px, uu)); my = Math.round(lerp(y0, py, uu) - Math.sin(uu * Math.PI) * m.arc);
        s = m.sz - j;
        cx.fillStyle = j === 0 ? EAT_MOTE0 : j === 1 ? EAT_MOTE1 : EAT_MOTE2;
        cx.fillRect(mx - s / 2, my - s / 2, s, s);
        if (j === 0) { cx.fillStyle = '#08060c'; cx.fillRect(mx - s / 2 - 1, my - s / 2 + 1, 1, s - 1); }
    }
}
```

`EAT_MOTE0/1/2` are three module-scope strings built once in `eatBoot`
(`'rgba(255,194,113,1)'`, `.45`, `.20`), because the three alphas are constant and
this is the one drawer in the family that runs per frame per mote.

**Arrival**, in `stepEat`, on the frame `m.t >= m.max`:

- `st.fed += m.hp`, and **`fed` is the consumer growing**. `crit-art-eat` #3: the
  bible's line is *"`-eat` is consumption **and the consumer growing**"*, the enemy
  got seven layers and the player got a 0.11 second tint at 17% alpha. `fed`
  decays at `fed * 0.55` per second, so a big drain leaves you visibly lit for
  about a second and a half and a nibble does not light you at all. It drives
  three things you can see without being told: a warm `foeSilSpr`-equivalent blit
  over the player at `clamp(fed * 0.05, 0, 0.4)`, `+ clamp(fed * 0.5, 0, 7)` on
  the lantern arc radius at 2137, and the player's own contact ellipse at 2117
  scaling `1 + clamp(fed * 0.03, 0, 0.25)`. You should be able to look at the
  player and tell they just ate.
- `st.pend += m.hp`, `st.flush = 0.12`. When the flush expires, **one** number.
  `crit-art-eat` #16: not a `typo` at 14px in the same voice as a damage number.
  The largest number that ever comes *off* an enemy and *into* you is the family's
  own type, `Math.round(14 * fxS(st.pend))` px `Press Start 2P`, rising out of the
  chest at `z: 26`. If `pend < 1` — you were full — it prints `full` at 11px in
  `#8a8090` and two `EAT_CHAR` crumbs fall off your chest. *You took it anyway and
  you could not use it.* No longer line than that.
- `fxSfx('eatmote', 0.03)`, once per arrival. The gate is 30ms so a four-mote
  drumroll gets four ticks and eight simultaneous foes do not get thirty-two.

```js
/* THE HUSK. crit-art-eat #13: foeDie was in nobody's hook list, so a
   Hearsay finished by hunger died with the same grey 16-particle
   burst (3424) as one that bled out. The family whose whole thesis is
   that things get consumed had nothing to say about the moment
   something is finished.
   Returning 1 suppresses the default burst. The notches outlive the
   body by half a second and then fall: you ate it, and the holes are
   the last thing left. */
function eatFin(f) {
    if (!(f.burn && f.burn.fam === 'eat')) return 0;
    var st = fxOf('eat'), e = famOf(f, 'eat'), i, o = EAT_N, d = foeSil(f.def.draw);
    burst(f.x, f.y, foeH(f) * 0.5, 14, { col: EAT_CHAR, add: 0, sp0: 0.4, sp1: 1.8,
                                          l0: 0.5, l1: 1.1, grav: 190, sh: 1 });
    for (i = 0; i < e.nb; i++) {
        eatNotchAt(d, e, i, f, o, 1);
        fxPush(st.a, { k: 'husk', x: f.x, y: f.y, ox: o.x, oy: o.y, w: o.w, h: o.h,
                       t: 0, max: 0.62 }, 96);
    }
    return 1;
}
```

A husk holds for two frames, then falls `k * k * 40` pixels and fades. It is one
`fillRect` per notch per frame for six tenths of a second, it is the only thing in
the game that survives the body, and it is three lines.

**Everything in `-eat`, one table.**

| slot | what it is | where it draws | clock |
|---|---|---|---|
| projectile | a mouth with a bite out of its back, a falling cooling trail with splinters in it, a word eaten from the front | `drawCalls` | sim |
| pip | `E` in a cell with a bitten bottom edge, eroding to a bare stroke; the pile sheds off the plate | `drawStacks` | real |
| detonation | notches at full depth, 38 falling crumbs, a ring of teeth closing inward, one word cut with `drawCuts`' idiom | `ord 42` | sim |
| status | the notches persist and cool, the body dims to the colour of its own holes, the ground gives, the chew advances on the tick | `drawFoe`, `FAM_ST` | sim |
| finisher | four motes out of the wounds and into your chest, the lantern flares, `+N` in the family's own type, the husk | `ord 42` + `foeDie` | real (motes), sim (`fed`) |

---

### 3.2 `-ight` — reveal

> *"There was a woman, and we would not stand the sight."*

**The one image.** Hard spokes of lamplight snap out of the actor and touch every
single thing the sound closed on, and each of them is nailed to a long black
shadow with the cut line written inside it.

**Three rules.** *Hard edges*: no radial gradient, no soft falloff, no baked glow;
where something fades it fades in flat bands the way `dither` does, so this is the
cheapest of the five to draw and the only one that allocates nothing.
*Hard shadows*: the matter of this family is not the light, it is the shadow the
light throws, which is the only family layer in the game that adds something
**black**. *Never white*: `#fffbe8` may appear as a one pixel line and never as a
fill, and never for longer than 0.42s.

`#c9a83c` is deleted. `crit-art-ight` #8: the game's brass is **`#c9a94a`**,
`pxPal`'s `m` at 1834, in every sprite in the file, and inventing a value one step
off it is exactly the failure the closed-palette rule guards. It is also the
narration colour (5479, 5613, 5804, 5880), the interact prompt (8003) and the
Droning elite (226), so the shards take `rgbMul('#c9a94a', 0.62)` for the body
with a 1px `#ffe66e` lit edge: brass in shadow, which is what a plate that just
came off looks like, and which is literally the sprite palette's own `m`/`M` pair.

#### 3.2.1 The projectile: it is a light, and it makes things visible

```js
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

    /* A chevron, and three flat bands behind it. Three alphas, no
       interpolation: on a nearest-neighbour canvas a banded taper
       reads as AUTHORED and a smooth one reads as broken. Down the
       centre of all three, one 1px filament, and it is the only
       continuous thing in the effect. */
    head: function (cx, c, sx, sy, P) {
        var sa = isoAng(c.a), i, bx, by, cs = Math.cos(sa), sn = Math.sin(sa);
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
        for (j = 0; j < 3; j++) {
            ii = (c.ti - off[j] + 24) % 12; gx = c.tr[ii]; gy = c.tr[ii + 1];
            if (gx == null) continue;
            cx.globalAlpha = al[j];
            cx.font = 'bold ' + sz[j] + 'px "Press Start 2P", monospace';
            cx.fillStyle = P.col;
            cx.fillText(c.word, isoX(gx, gy), isoY(gx, gy) + TILE_H / 2 - 26);
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
    }
};
```

**The pip.** Three things inside the cell, and the third is the family.

- **The slot.** Two hard 1px `#ffe66e` rules at the **inboard** rows `sy - 9` and
  `sy + 1`, spanning `w - 2`, with no sides: a shutter seen edge on, deliberately
  open at the ends because the light is going somewhere. Inboard because
  `crit-art-ight` #12 caught the collision: the design's `sy - 11` is the plate's
  own top row (3544) and the row rule's `sy - 12` is adjacent to it, so at four or
  more `-ight` stacks the two devices touch and make a 2px double stroke, half of
  it out of the rationed near-white the family's own rule says may never exceed
  1px.
- **Its own shadow**, and it is a real hole. `crit-eng-ight` #6: a
  `rgba(8,6,12,.85)` rect over a `rgba(8,6,12,.72)` plate is the same hex over
  itself, a few percent of luminance on a value that is already almost black, and
  then the cell's additive tint adds the same amount to the shadowed and the clear
  pixels alike. Forty-eight pixels of nothing, every frame, on every `-ight` stack
  on the board. It is `globalCompositeOperation = 'destination-out'` at 0.5
  instead, offset 2px away from the player, which cuts the plate **and** the tint
  together and is the same two `fillRect`s.
- **It lights the row.** Once per row, an additive
  `rgba(255,246,194, 0.05 + 0.05 * lit)` wash over the whole plate, where `lit` is
  how many stacks in that row are `-ight`. At four or more the per-pip slot rules
  are **suppressed** and a single 1px `#fffbe8` rule runs the length of the plate
  instead. One `-ight` in a row of five: the row has a lamp in it. Five of five:
  the row *is* a filament and you can see from across the square that this body is
  ready. That staging is `crit-art-ight` #12's own fix and it is better than the
  original because the escalation is now a change of kind.

```js
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
```

#### 3.2.2 The detonation: the spokes

**The cone is deleted.** `crit-art-ight` #1 is the sharpest finding in the pack:
RHYME closes **every** stack of that sound wherever it is on the board, which is
the whole reason this game is not Diablo, and a single cone at the centroid of
what closed points at empty floor between two flanking foes and contains neither
of the things it just nailed. A cone from the caster is also the one shape in
these five documents that could be lifted into another game without changing a
token.

**One hard spoke per closed body, all in the same frame, all out of the actor.**
One foe gets an interrogation line. Six foes get a star of light out of the player
that physically touches every single thing it closed. It is truthful to the
mechanic, it is cheaper than the triangle fill, and no other game has it because
no other game has this mechanic.

```js
/* Per closed body. d.i * d.stag rides the outward sort, so the star
   opens from the middle of what closed rather than all at once. */
function ightDet(f, n, d) {
    var st = fxOf('ight'), g = famOf(f, 'ight'), rep = d.kind === 'beat' || d.kind === 'wave';
    var h = foeH(f), i, sh, mat;
    if (d.dead) {                                 // crit-eng-ight #12: no status on a corpse
        ightSpoke(st, f, n, d); return;           // it still gets the light. It just does not get five seconds
    }
    /* the reveal itself. On a repeat beat this REFRESHES and nothing
       else fires: crit-eng-ight #2, three beats 0.34s apart re-ran
       f.revealed = 5 and the cast shadow collapsed to zero length and
       regrew three times, which looks like a bug, on top of 1248
       particle pushes against a 900 cap. */
    g.max = 5; g.n = n;
    g.lit = clamp(0.10 + 0.03 * n, 0.10, 0.34);
    /* how many shadows. crit-art-ight #10: bracket alpha 0.30 to 0.60
       is eight fillRects a frame doing nothing, because nobody can see
       a 0.05 alpha step, and pin travel 78 to 134px is not readable at
       the speed the bars move. The power goes somewhere COUNTABLE
       instead, and the best channel this family has is how many lights
       are on you. One at n 1-2, two at 3-4, three at 5+, each a few
       degrees off the last. You can count them without thinking. */
    g.sh = n >= 5 ? 3 : n >= 3 ? 2 : 1;
    ightAim(f, g);                                // which way they point. See below.
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
    mat = fxBudget(1, d.wide, 1) ? d.th : 0;
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
    /* two 4px ticks on the ground plane at ±f.r*15, held for the
       reveal: the mark on the boards where the actor hits
       (crit-art-ight #13). Stored on g, drawn by the status. */
    g.tick = 1;
    fxSfx(f.armor > 0 ? 'bare' : 'seen', 0.09);
}
```

`part()`'s `sh: 1` on the shards is `crit-art-ight` #13's landing detail delivered
by the shared field rather than by a special case: `sh: 1` draws the chip **2:1 on
the ground plane** (2.5), so a shard that has bounced and is lying at `z = 0`
renders as a flat sliver instead of a square. That is the whole difference between
debris and sparks and it is one field that already exists.

**`SEEN` and `BARE`.** `crit-art-ight` #15: `SEEN` is what a debug overlay says,
and it fired identically whether armour came off or not, which is the same lost
read as #7. Two words, both four characters so they fit at 13px over a Mouth,
`'pop'` rather than `'drift'` because this one should arrive and not leave, and
one ternary picks between them. The word is `-ight`'s only small typography and it
now tells you which of the two things happened.

```js
/* WHICH WAY THE SHADOW POINTS, and it is not away from you.
   crit-art-ight #6: the bible says -ight is "being looked at by
   people who would rather not look". The design staged YOU as the
   lamp, which is the generic reading; the true one is that the TOWN
   is looking and you only opened the shutter. So the shadow points
   away from the nearest entry in lightsOf(place()) — the list is
   already built every frame by drawLights — and falls back to
   pointing away from the player when there is no light in range.
   A reveal in the lane throws the body's shadow off somebody's lit
   window. In the hollow, which is authored `night: 2, dark: 1` with
   the comment "no lamp out here, that is the whole point of out
   here", it falls away from YOU, because out there you are the only
   light. That is Stanza 9 rendered as a shadow direction for one
   array lookup.
   Recomputed at 4Hz in the stepper, not per frame: twenty-five bodies
   times a light list is the only loop in this family that could ever
   matter, and a shadow that re-aims sixty times a second is a shadow
   that swims. */
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
```

#### 3.2.3 The status: five seconds that survive twenty-five bodies

Four layers, and `crit-eng-ight` #1 and `crit-art-ight` #2 split them by depth
rather than by convenience. `drawLights` (3892) lays `rgba(6,5,14,.5)` — `.66` in
the hollow — and `drawVignette` reaches `.8` at the corners, and **every place in
this game is a night place**. A source-over black over both the floor and a shadow
halves the absolute contrast between them; in a corner of the hollow the family's
primary readout was down to about a tenth of its authored delta while its 0.34s
beam sat over the wash and was bright. The family that named legibility as its
brief had its five-second layer in the darkest part of the frame.

| layer | where | why there |
|---|---|---|
| the ink quad | `drawFoe`, under the body | a house must occlude a shadow, and the body must stand on it |
| the 1px lit lip and the outward outline | `ord 44`, world seam, **over** the wash | 1px marks do not need occlusion and under the wash they are nothing |
| the four brackets | `ord 44` | same |
| the keylight rim | `drawFoe`, body transform | local space, on the sprite |
| the cut line inside the quad | `drawFoe`, clipped to the quad | it is part of the shadow |

```js
/* (a) THE CAST SHADOW, and the fill is not what carries it.
   The quad's two far vertices are quantised to the floor's own 2px
   dither lattice (crit-art-ight #13), so it lights THIS floor rather
   than floating above it as a free polygon.
   crit-art-ight #4: the foe's own rgba(0,0,0,.42) contact ellipse is
   SUPPRESSED for the length of the reveal, faded out over the first
   80ms as the quad grows in, through the shared f.csa channel from
   3.0.6. A body with two shadows pointing different ways is precisely
   the sticker failure the prop comment at 6683 warns about, and the
   reveal is allowed to break the town's key only if it is seen to
   REPLACE the ambient rather than argue with it.
   Folk get no cast shadow at all (crit-art-ight #11, crit-eng-ight
   #9): twenty-four seated bodies packed close, all throwing 30-70px
   wedges the same way, merge into one continuous black field, which
   is not twenty-five reveals, it is a hole in the floor. hurtFoe
   returns 0 for folk (2847) so a reveal on them is mechanically
   meaningless anyway. */
function ightQuad(cx, f, g, i, out) {
    var a = Math.atan2(g.ay, g.ax) + (i - (g.sh - 1) / 2) * 0.13;   // a few degrees off each other
    var len = (26 + 7 * g.n) * clamp(foeH(f) / 30, 0.8, 2.2) * clamp(g.age / 0.05, 0, 1);
    var ca = Math.cos(a), sa = Math.sin(a), hw0 = f.r * 15, hw1 = f.r * 15 + 10;
    var lx = len / TILE_W * 2, ly = len / TILE_W * 2;               // world length along the heading
    out[0] = -sa * hw0; out[1] = ca * hw0 * 0.5;
    out[2] = ca * len - sa * hw1; out[3] = sa * len * 0.5 + ca * hw1 * 0.5;
    out[4] = ca * len + sa * hw1; out[5] = sa * len * 0.5 - ca * hw1 * 0.5;
    out[6] = sa * hw0; out[7] = -ca * hw0 * 0.5;
    out[2] = evenPx(out[2]); out[3] = evenPx(out[3]);
    out[4] = evenPx(out[4]); out[5] = evenPx(out[5]);
}
```

**The cut line goes inside the quad**, and this is the answer to `crit-art-ight`
#3, which is the finding that turns this family from a yellow elemental into
NINTH NIGHT.

> *Doctrine, stated in the file's own banner at 1411: "The whole visual language.
> Spells are words getting bigger." The `-ight` detonation is a cone, two bars, one
> bar, twenty-two squares, ten motes, a screen darken and a bloom.*

The cast shadow is a quad of ink with nothing in it, and `BALLAD[8].r` is right
there. Clip to the quad, rotate to its axis, `scale(1, 0.5)` onto the ground
plane, **18px `VT323`** in `rgba(255,230,110,.16)`, one `fillText`, once per
revealed non-folk body per frame. *The light falls on a thing and the true half
line is written on the floor behind it.* Reveal, true damage, and a lie coming off
are all three that image. No other family can take it, and it costs one text call
inside geometry that is already being built. Folk and the Chorus get the four-word
tag `we would not stand` rather than the whole line, because the quad is shorter.

```js
/* (b) THE KEYLIGHT, and it is a RIM.
   crit-art-ight #4: the design lit whichever body half faces the
   player with a flat rgba(255,246,194,.13) fill, so half the time it
   was lighting the half the sprite has BAKED as shade, and a
   half-rect fill argues with the row strings while a rim does not.
   One pixel down the player-facing silhouette edge, taken off
   foeSil's per-row lo/hi, and the far half darkened. Twenty-two
   fillRects on a Hearsay, all integer, all on the ink.
   crit-eng-ight #20: the Chorus has no rows and drawChorus spans ±46
   while f.r*22 is 35, so the boss falls back to the box at its real
   half-width of 92 rather than lighting a 35px column out of a 92px
   crowd. */
function ightBody(cx, f, h, sx, sy) {
    var g = famOf(f, 'ight'), d = foeSil(f.def.draw), s = playerSide(sx), r, c, a;
    a = g.lit * (0.82 + Math.sin(f.anim * 2.2) * 0.18);
    cx.globalCompositeOperation = 'lighter';
    cx.fillStyle = partCol(IGHT_HOT, a);
    if (d) {
        for (r = 0; r < d.rows.length; r++) {
            c = s > 0 ? d.lo[r] : d.hi[r];
            if (c < 0) continue;
            cx.fillRect(silX(d, c), silY(d, r), PXS, PXS);
        }
    } else {
        var w = f.def.boss ? 92 : f.r * 44;
        cx.fillRect(s > 0 ? -w / 2 : w / 2 - 2, -h, 2, h);
    }
    cx.globalCompositeOperation = 'source-over';
    cx.fillStyle = 'rgba(8,6,12,.22)';
    cx.fillRect(s > 0 ? 0 : -(f.def.boss ? 92 : f.r * 44) / 2, -h, (f.def.boss ? 92 : f.r * 44) / 2, h);
}
```

**(c) The brackets**, four corner marks at 1px with 5px arms, at `ord 44` over the
wash. In the last 0.8 seconds they close inward by 4px, drop 3px, dim, and
hard-flicker at `sin(RT.t * 30) < -0.2`, so you can watch the +25% window
expiring, which is a tactical read the game has never offered. Suppressed for
folk. **(d)** the health-bar tint at 3522 is unchanged: it was never wrong, it was
just alone. And **one line elsewhere**: while `f.revealed > 0` the non-closed
damage number in `hurtFoe` draws in `FAMS.ight.col` instead of
`rgba(230,225,240,.9)`. You can see the 25% being paid, on every hit, for five
seconds, for one ternary.

#### 3.2.4 The finisher: the plate peels

`f.armor = 0` at 2828. Today, on a Sealed elite, a `strokeRect`'s alpha drops from
0.85 to 0.2; on the Deaf, which carries `armor0: 3` from birth, nothing at all
happens and never has. The peel is keyed on `f.armor > 0` at the moment the
detonation lands, **not** on the elite mark, so the Deaf gets it too.

- **One frame white.** The first 8% of the peel draws the whole plate in `#fffbe8`
  rather than `#ffe66e`. That is the rationed near-white and it is 34ms, expressed
  as a fraction of the record's own timer rather than as a frame count.
- **Four edges, four pieces**, on `drawMod`'s own plate geometry
  (`-w*0.8, -h*0.75, w*1.6, h*0.5`) but drawn as four separate 2px bars: the top
  edge tips over, rotating `u * 0.42` rad; the two sides slide outward; the bottom
  drops straight. `drop = Math.min(u * u * 210, p.h)` — `crit-eng-ight` #14, the
  unclamped version put a 30% alpha bar 103px below a 32px foe's feet, inside the
  body transform, occluded by nothing.
- **`drawMod` skips its `plate` branch while `f._peel` is set**, and the 0.2 ghost
  outline is deleted outright rather than left stroking the identical rect for the
  rest of the fight. `crit-eng-ight` #8: the design's whole pitch is *"the only
  thing in the game that looks like an object coming apart"*, and the object was
  visibly still there under the pieces falling off it.
- **No word.** `SEEN`/`BARE` already fired. Four falling pieces say it better than
  a caption.

**The snap.** `regSnap('ight', ightDrop)`. The vertical bar falling through the
body **is** this family's snap and it replaces `snapDefault` rather than sitting
next to it: `crit-eng-ight` #3 found that nothing in the design's hooks removed
the shared one, so `-ight` was shipping the new vertical bar, the old horizontal
line at the hard-coded wrong height, and twenty particles per body. Vertical
because every other family's snap is horizontal, and it carries `foeH(f)` from the
snap record, so on the Chorus it is not 104 pixels wrong.

**The pre-darken**, `ord 30`, screen pass, **before** the line exists.

```js
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
```

`save`/`restore` because `crit-eng-ight` #11 is right that both hygiene
conventions are live in this file and a leaked `fillStyle` poisons everything
after it; `fullRect` because a `fillRect(0,0,VW,VH)` inside the shake leaves up to
nine pixels of one edge undarkened (2.7); and it is a **screen** pass, outside the
zoom, so `crit-eng-ight` #11's second half — a full-screen fill inside
`scale(z, z)` stops covering the screen above about `z = 1.1` — cannot happen.

**And the actor changes.** `crit-art-ight` #13: the whole fiction is that a lamp is
being pointed by somebody who would rather not look, and the player's sprite was
untouched from the first frame to the last. On the frame the shutter opens, **the
actor's own contact shadow is thrown backwards, hard**, for 0.03 seconds: the
ellipse at 2117 offsets 7px away from the aim and doubles its long radius. Two
`fillRect`-equivalents, and it says *the light came from here* better than the
spokes do.

**Everything in `-ight`, one table.**

| slot | what it is | where | clock |
|---|---|---|---|
| projectile | a shutter at the barrel, three flat bands and a filament, dust hanging in the beam, the only projectile in the game that throws a shadow | `drawCalls` | sim |
| pip | a shutter seen edge on, a hole cut in the plate behind the glyph, a row that lights up and becomes one filament at four | `drawStacks` | real |
| detonation | one hard spoke per closed body out of the actor, a pin of two fixed bars that arrive and stop, a vertical drop bar, shards if it had cover and dust if it did not | `ord 44` + `ord 30` | real |
| status | one to three cast shadows aimed away from the nearest lamp with the cut line written inside them, a 1px keylight rim on the ink, brackets that close as the window expires | `drawFoe` + `ord 44` | sim (`f.revealed`), real (marks) |
| finisher | the plate comes off in four authored pieces, one frame of near-white, brass in shadow falling and landing flat | `ord 44` | real |

---

### 3.3 `-erd` — command

> *"and nobody said a word."*

**The one image.** Two hard bars close on a body like quotation marks snapping
shut, the body is one frame of solid green-white and then one frame of solid
black, and then the black is cut away from the top and the bottom until there is
nothing there.

**Say the thing the design would not say.** `crit-art-erd` #12: what is specified
here is redaction, strikeout, underline, dotted leader, brackets and quotation
marks, which is an office, in a game about a town singing a song badly for four
hundred years. It is defensible on exactly one reading and that reading has to be
the first line of the header comment rather than a decoration halfway down:

```js
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
```

**The palette, and the fifth value is derived.** `crit-art-erd` #10:
`ERD_INK #0b1512` differs from the house shadow by (3, 15, 6) and at 0.92 over a
night-washed scene nobody will ever perceive that the redaction has the family in
it, so the closed palette was opened for a value that buys no image. Commit or
drop. It commits, and it does so without authoring anything:

```js
var ERD_INK, ERD_COL, ERD_LIT, ERD_SEG;
function erdBoot() {
    ERD_COL = hex2rgb(FAMS.erd.col);            // 159,224,200
    ERD_LIT = hex2rgb(FAMS.erd.glow);           // 214,255,240
    ERD_INK = rgbMul(FAMS.erd.col, 0.10);       // 16,22,20: a black the eye reads as green at 80px wide
}
```

`MODS.quick.col` is exactly `#9fe0c8`, so the discipline that keeps them apart is
**shape, not hue**: `ERD_COL` appears only on a hard axis-aligned bar, never on an
ellipse and never on a streak. The Quick mark is three small rects; these are
full-height bars and a horizontal rule.

#### 3.3.1 The projectile: it does not fly, it is issued

```js
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
       crit-eng-erd B5: sx and sy arrive raw from drawCalls (3938) and
       every rounded local coordinate downstream of an unrounded
       origin is decoration. Rounded here, at the top, once. */
    word: function (cx, c, sx, sy, P) {
        sx = Math.round(sx); sy = Math.round(sy);
        var i, q, tk = c.tk;
        for (i = 0; i < 18; i += 3) {           // the dotted leader, six slots, oldest overwritten
            if (!(tk[i + 2] > 0)) continue;
            cx.fillStyle = partCol(ERD_COL, (tk[i + 2] / 0.20) > 0 ? 0.55 : 0);
            cx.fillRect(Math.round(isoX(tk[i], tk[i + 1])) - 1,
                        Math.round(isoY(tk[i], tk[i + 1]) + TILE_H / 2 - 30), 2, 6);
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
    fizz: function (c) { var i; for (i = 0; i < 18; i += 3) if (c.tk[i + 2] > 0) c.tk[i + 2] = 0.06; },

    /* The launch: two 3x7 chips flying apart perpendicular to the aim
       and cut at 0.05s. One bar splitting to let the word through. It
       is not a muzzle flash and it must never look like one. */
    cast: function (x, y, a) {
        fxPush(fxOf('erd').a, { k: 'open', x: x, y: y, a: isoAng(a), t: 0, max: 0.05 }, 16);
    }
};
```

**The tick spacing is screen distance, not world distance.** `crit-art-erd` #15:
the projection is `(x-y)*29` and `(x+y)*14.5`, so a call thrown along the screen
horizontal lays dashes 19.7px apart and one thrown along the screen vertical lays
them 9.9px apart. That is the design's own argument against the frame-rate version
arriving from a different direction — a dotted leader whose dash pitch changes
with your aim is not a dotted leader. `stepCalls` accumulates
`Math.hypot((c.vx - c.vy) * 29, (c.vx + c.vy) * 14.5) * c.sp * dt` and drops a tick
every 12 pixels. `Math.hypot` is already used in sixteen places in this file.

#### 3.3.2 The pip: the hole in the song

**`-erd`'s pip has no glyph at all**, and the reason is not that the sound that
shuts things up is laconic. `crit-art-erd` #7: `singReduced` (4258) — *"The town's
one walks 5 4 3 2 and leaves the last slot empty, which is the hole in the song,
in the song"* — and `fillBook` renders every false line with `<s>?</s>` in it. An
empty slot in a row of slots is this game's established mark for the line that was
cut out, and `-erd`'s own truth-word is `word`, the word the town took out. This
is the only place in the entire fight where that mark can appear eight times in a
row over an enemy's head.

```js
function erdPip(cx, s, x, sy, w, fade) {
    /* crit-eng-erd B1, and it is a real freeze: the Droner's producer
       at 3351 pushes a stack with no `born`, so `s.born || RT.t` was
       the CURRENT frame's clock on every frame, the subtraction was
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
       s.t / s.max: the drag at 2635 multiplies s.t and never updates
       s.max, so any freshness ratio off s.max is wrong after a drag. */
    var top = Math.round(sy - 10 + (1 - clamp(s.t, 0, 1)) * 12);
    cx.fillStyle = s.drone ? '#8a8090' : FAMS.erd.glow;
    cx.fillRect(xx, top, iw, 2);
    cx.fillRect(xx, sy + 2, iw, 2);
    /* the drag misregistration: a stack a slant pulled over offsets
       its two bars one pixel against each other for the rest of its
       life. A word pushed out of place. crit-eng-erd N8: `s.drag` has
       no producer today, reads as undefined, degrades silently, and
       the detonation section is asked for the one token at 2635. */
    if (s.drag) cx.fillRect(xx + 1, sy + 2, iw, 2);
}
/* The second FAM_FADE row, and the last. -erd never fades, so its
   contribution is to make the SHARED fade stop fading: drawStacks'
   clamp(s.t/1.2, 0.3, 1) is a dissolve and this family does not
   dissolve. It returns the reciprocal, so the cell is at full
   strength until the knock takes it away in one step. */
function erdFade(s) { return 1 / clamp(s.t / 1.2, 0.3, 1); }
```

**The sour.** `crit-art-erd` #16: the pip's best idea is the top bar walking down
onto the bottom bar, and then they touch, `breakStack` takes HP off you, and the
design drew nothing for it. The clock had no chime.

> The two bars merge into one solid `ERD_INK` bar the width of the cell, hold for
> 0.10s, then get cut from the top and the bottom exactly like the detonation's
> beat 4. **The success and the failure are the same picture at two scales.** For a
> family whose subject is whether the answer came, that is the right rhyme.

#### 3.3.3 The detonation: the clap

Four beats, and `crit-art-erd` #14 fixes the shape of the whole thing:

> At n=8 the bars start 152px out, full body height, two per foe. Eight foes is
> sixteen mint full-height bars sweeping the arena, and because `CT` is per foe
> every pair is on its own clock, so they arrive at eight different times. That is
> a picket fence.

**`CT` and `D` are derived once per rhyme from `best`, not per foe from `n`.**
`d.pb` and `d.sc` are exactly those numbers and this is what they are for
(`crit-eng-deton` N1). Every bar on the board closes on the same frame. Unison is
the Chorus's entire idea and it is what turns eight karate chops into one order
given to a room. `RA`, `RH`, the chip count and the redaction stay per foe, so the
individual bodies still scale.

```js
/* nn is this body's own count. Everything with a TIME in it comes off
   the detonation, everything with a WEIGHT in it comes off the body. */
function erdDet(f, n, d) {
    var st = fxOf('erd'), g = famOf(f, 'erd'), nn = clamp(n, 1, 12);
    var h = foeH(f), w = f.def.boss ? 92 : Math.round(f.r * 24);
    var CT = 0.075 + 0.048 * d.pb, D = 40 + 168 * d.pb;      // ONE close, ONE reach, for the whole board
    var rec;
    /* crit-eng-erd B4: Stanza I is -erd (2879), stepRecital calls
       stanzaWave once per line for four lines and stepReprise three
       more times, and neither path knows about the other, so this
       fired four times per foe inside 1.5 dilated seconds and the
       one-image moment became a stutter. Replace per foe, never
       append. */
    for (rec = 0; rec < st.a.length; rec++)
        if (st.a[rec].k === 'clap' && st.a[rec].id === f.id) { st.a.splice(rec, 1); break; }
    fxPush(st.a, { k: 'clap', id: f.id, x: f.x, y: f.y, h: h, w: w, nn: nn,
                   /* crit-eng-erd N1: doRhyme calls hurtFoe (2618)
                      before famEffect (2619) and 3883 filters corpses
                      out of the ents pass, so beats 1-3 of the family's
                      payoff shot played over bare floor, and did it
                      wrongest on the biggest hits. A dead body skips
                      beat 2, which is the beat that needs a silhouette
                      under it, and shortens to the cut. */
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
    g.chips = fxBudget(Math.min(4 + 3 * nn, 22), d.wide, 96);
    g.gag = 1;
}
```

**Beat 1, the close**, `u = 0` to `CT`. Two bars at `±(D + w)`, full body height
plus 8 so they overhang the head and bite two pixels into the ground, closing on
`easeOutExpo` (`1 - 2^(-11t)`): 87% of the distance is gone in the first quarter,
and that easing is the entire reason this reads as an order obeyed rather than a
door swinging shut. They widen from 1px to `BW` as they travel, so a bar arriving
is a bar getting heavier. Each has a `+1,+1 #08060c` shadow, which is the house
convention and also stops a mint bar over a mint elite from disappearing. A 1px
`ERD_COL` rule at mouth height joins them and shortens as they close: without it
you see two loose bars, with it you see one bracket pair closing.

**And the bars are segmented.** `crit-art-erd` #8: every scaling term in this
family was a continuous magnitude and not one of them could be read as a number,
which is a strange failure in the family whose stacks *are* syllables. The closing
bar is **`nn` segments with 1px gaps between them**. The bar you see has your
stack count in it, "the bar gets heavier" becomes something you can point at, and
at `n >= T('stackMax')` the **last segment is left empty** — the full count and
the hole, in the same shape, tying the biggest close in the family to the pip.

**Anticipation.** `crit-art-erd` #19: an expo with no held first frame does not
read as a snap, it reads as a pop-in, because there is no frame in which you see
where the bars came from. Both bars hold static at full start position and full
`BW` for **0.02s** before the ease begins. Three frames at 144Hz, one at 60, free.

**Beat 2, the block**, `RH` seconds: the bars meet, overlap, and the body box
fills flat `ERD_LIT` at `RA`. The silhouette is gone. 20ms at n=1 and 48ms at n=8,
and you can feel the difference in exactly the place a fighting game would put it.
**This is the frame the matter fires and the frame the sound lands.**

```js
/* crit-art-erd #1: the design's own best sentence is "the effect is
   silent and then it is not", and its hook called sfx() on the
   KEYPRESS, 81 to 123 milliseconds before the block. Fired from the
   stepper, on the frame cl.fired flips, which is a branch that
   already exists and already runs exactly once per clap.
   crit-art-erd #2: erdclap is NOT a new instrument. voxAnswer('erd')
   (4172) is already "a full stop, it ends where it ends and there is
   no ring-out", two flat squares at 152 and 304, and voxSay (4138)
   already says -erd is the only family with no pitch move. The audio
   job built this family's identity and it is the same one. erdclap is
   the 4ms wood transient that goes IN FRONT of that, and job 2 is
   asked to delay the existing 152Hz square to CT so the consonant and
   the vowel are one event. `erdtick` at 22 a second is cut.
   crit-eng-erd N7: sfx('answer') fires seven lines later at 2651 and
   both are real, so job 2 is told they always play together. */
if (!cl.fired && cl.t >= cl.CT) { cl.fired = 1; erdBurst(cl); fxSfx('erdclap', 0.05); }
```

**Beat 3, the redaction**, a fixed 50ms that does not scale, because a redaction is
a redaction: the bright block becomes `ERD_INK` at 0.92 with a 1px `ERD_LIT` line
on its top and bottom edge and one merged bar `BW * 2` wide down its centre. It is
now a black bar with a word under it that you cannot read.

**Beat 4, the cut**, `VT`: the block is not dimmed and does not shrink from its
sides. Its top edge travels down and its bottom edge travels up until they meet,
and on the frame they meet everything is gone. The two lit edges ride the cut
inward the whole way, so the last thing on screen is two bright lines a pixel
apart at full alpha. `crit-art-erd` #11: those two lines are `FAMS.erd.glow`, which
`comp.css:2997` uses for a stanza the book has repaired. **The lit edges are what
survives the redaction.** One sentence, and it retro-justifies the entire beat.

Total: **0.235s at n=1, 0.333s at n=8.** Weight without duration.

**The matter, fired once at beat 2.** `min(4 + 3nn, 22)` chips, and a chip is a
hard 5x2 or 3x2 rectangle alternating `ERD_COL` and `ERD_LIT` one in four. They
are chips of a letterform broken across the grain, they are not squares, and they
**cannot go through `part()`** for that reason: they live on `fxOf('erd').chips`
and are the one family whose matter is not particles.

They fly **sideways only**. `isoX = ORX + (x-y)*29` and `isoY = ORY + (x+y)*14.5`,
so a velocity of `(+s, -s)` moves a thing in pure screen horizontal and not at all
vertically. Speed `rnd(3.0 + 0.25nn, 6.5 + 0.7nn)` tiles/s, alternating left and
right, spawned across the body's vertical extent, hard exponential decel, life
`rnd(0.09, 0.17)`, **no gravity, no bounce, no fade**. Two flat sprays running
along the line of the bar. Nothing about this family is round and a ball of sparks
would say *explosion* where the whole design says *line*.

```js
/* crit-eng-erd N6: `1 - 6*dt` is the first-order expansion of
   e^(-6dt), accurate to 2% at 60 and 144Hz and 5% wrong on the one
   frame after a hitch, because `real` is clamped to 0.05 at 3804.
   One pow per frame, not per chip. */
var dec = Math.pow(0.0025, dt);
```

**The ground.** `crit-art-erd` #13 is right that the only floor mark in the family
was at the *player's* feet, so a 0.235s event left nothing at any of the places it
actually happened, and that *"real elemental MATTER around the words"* is not
satisfied by 22 dashes for 0.15s.

- **At each target's feet**, `-erd`'s matter is the air that did not move: twelve
  short tangential bars on the 1:0.5 ground ellipse, out on `easeOutExpo` over
  0.08s, then cut. No stroke, no round path, no gradient, twelve `fillRect`s. It is
  the only physical thing a clap makes and it gives the crowd case something to
  read after the bars are gone.
- **At the player's feet**, one straight horizontal rule struck across the picture:
  half-width `clamp(2.4 + 0.5 * d.best, 2.4, 9)` tiles, 2px `ERD_COL` with a 1px
  `ERD_LIT` core on its upper edge and a `+1 #08060c` shadow, a 1px 7px-tall
  vertical tick at each end. A rule with terminals is a measured span; a rule
  without them is a laser and this game does not have lasers in it. In on
  `easeOutExpo` over 0.10s, hold 0.06s, both ends retract to the centre over 0.07s.
  **And it measures something**: one 1px tick at the screen-x of every foe that
  closed (`crit-art-erd` #8), so the line at your feet becomes a line of verse with
  a beat per body it reached.
- **After the cut, one caret.** A single 1px `ERD_COL` caret at the foot of where
  the block was, 0.08s, then gone. A caret is the mark for *something is missing
  here*, it is three `fillRect`s, and it is the only thing in the family that
  admits what it just did.

**The drag gets a different mark.** `crit-art-erd` #22: a slant that closed nothing
was drawing the same authority rule, taking the same hitstop and playing the same
clap, so a wrong answer looked exactly like an order obeyed. The drag **is** the
most `-erd` thing in the mechanics — commanding every other sound to become yours
is the crime in the couplet — so it gets a mark, and not this one. **Terminals
only, no body**: two 7px vertical ticks at the span's ends and nothing between
them. The span was measured and it is empty. No clap, no chips, no `erdclap`. You
can tell a drag from a close from across the room with the sound off.

**The snap is `regSnap('erd', null)`.** The clap *is* the snap. This is the opt-out
the shared registry was written for (2.1a) and `-erd` is the only family that
takes it.

#### 3.3.4 The status: the gag

`f.silence` is `1.6 + n * 0.25` up to 3.6 seconds and it draws nothing today, so
the counter lands and nobody can tell. Three marks, all still, because stillness
is the point.

**(a) The band.** Solid `ERD_INK`, `f.def.boss ? 100 : f.r * 50` wide,
`clamp(4 + min(3, n/3), 3, 14)` px tall, centred at `-h * 0.70`, which is mouth
height on every humanoid sprite and just under the Mouth's single feature. A 1px
`ERD_COL` line on its top edge, a `+1,+1 #08060c` shadow, and **two nails**: single
1px `ERD_LIT` columns inset 2px from each end, running its height. *The false line
nailed over the hole is the fiction of the whole game and here you can see where
it was nailed.*

**(b) The brackets.** Two 2px `ERD_COL` vertical rules at
`±(f.def.boss ? 103 : f.r * 25 + 3)`, running the body's height, each with a 5px
foot turning inward top and bottom. The body is in brackets: quoted, not speaking.

**(c) The strike.** 1px `#08060c` rules every 3px from `-h*0.95` to `-h*0.35`, head
and shoulders only. At one-third coverage it reads as *crossed out* without erasing
the sprite, which is precisely what the `f.frozen` flat rect gets wrong.

**The Chorus gets its own width and its own paragraph.** `crit-art-erd` #5:
`f.r * 24` is 38 on the boss while `drawChorus` puts 22 mouths on a ring of radius
up to 77 with a 9px ellipse on each, so the visible crowd spans about ±86 and the
bars stopped 48 pixels *inside* it — the block and the redaction covered the middle
third of a boss and left two thirds of the mouths chewing in plain sight either
side of a mint rectangle. `f.def.boss ? 92 : Math.round(f.r * 24)`, two ternaries,
both in code this family owns.

**The band and the brackets are drawn at `ord 46`, in screen space, not in
`drawFoe`.** Three findings agree and they are the same finding:
`crit-eng-erd` B5 (everything inside `drawFoe`'s transform is multiplied by `pop`
and translated by a fractional `wob`, so the 1px nails and the 1px band edge are
sub-pixel for the whole 0.45s spawn ramp and shimmer after every hit),
`crit-eng-erd` N3 (`-ill`'s 45% `#cfeeff` rect at 3515 washes out the middle 88% of
the band), and 3.0.6 (`famStatus` gives a frozen body to `-ill`). The strike is the
one mark that is *on* the silhouette, so the strike goes through `FAM_ST` and is
suppressed while `f.frozen > 0`; the band and the brackets are outside the
silhouette, so they are drawn by the family's own world pass at whole pixels off
`Math.round(isoX(f.x, f.y))` and are visible on a frozen body, which is correct,
because a body can be both.

**Entry and release.** The band arrives from 14px above over 0.06s, which is inside
the detonation's beat-2 hold, so on the frame the body flashes white the gag is
already under it. Release reads straight off `f.silence` so it can never desync
from the mechanic: `rel = clamp(f.silence / 0.30, 0, 1)`, the band **splits at the
centre and the two halves retract outward** (the mouth is the first thing that
comes free), the bracket rules shorten from both ends toward their own midpoints
and their feet shorten to nothing, and the strike's lower bound rises back to its
upper bound so the crossing-out is un-drawn from the bottom up. Nothing fades. You
know to the tenth of a second when the thing starts moving again.

**One blink.** `crit-art-erd` #20: stillness is correct for two seconds and not for
three and a half; the eye stops reading a static overlay after one, and then 152
`fillRect`s a frame are buying nothing. At exactly 1.0s remaining the whole gag
blinks off for two frames, once. It re-reads the status at the moment the
information becomes actionable, and it is the same *knock* the pip already uses,
which is how a family gets a vocabulary instead of a list of effects.

**And the body actually stops.** `crit-art-erd` #21, two lines in job 4's territory
that do more for this family than the 132 strike scanlines: `drawMouth`'s
`gape = tell > 0.3 || Math.sin(f.anim * 7) > 0.45` becomes
`gape = !(f.silence > 0) && (...)`, and `drawDroner`'s `lighter` ellipse at
`y = -28` — which is literally its droning voice, animated off `f.anim` — is
skipped while silenced. The enemy that **is a mouth** was flapping continuously
under a bar nailed across it saying it cannot speak.

**Crowd guard**, and it counts rects rather than bodies (`crit-eng-erd` N10): past
a budget of about 180 rects the gag drops to the band alone, six rects instead of
nineteen, because the strike loop is `0.6 * h / 3` and the Chorus's `h` is 130, so
a boss plus nine mouths is 174 rects and read as "not full" under a body count.

#### 3.3.5 The finisher: the counter, in three tiers

The best thing this family does, and today it is a grey 9px word that says
*cut off*, or for a bite interrupt nothing at all.

**Tier 1, a bite tell** (`f.state === 'tell'`). The red wind-up ring is **thrown
back open**: twelve short tangential bars on the 1:0.5 ground ellipse expanding
from `f.r + 0.6` to `f.r + 2.8` tiles over 0.07s at full alpha, then cut. Plus a
1px `strokeRect` box around the body inflating from 0 to 8px of margin over 0.06s.
0.16s total, two shapes, no word, because a bite is not worth a word.

Twelve bars and not an arc, and this is two findings at once. `crit-art-erd` #17:
the family's own discipline paragraph bans the ellipse and six hundred words later
the counter throws a stroked circle in the family's best moment.
`crit-eng-erd` N4: `lineWidth` is in user space, so under `scale(1, 0.5)` the top
and bottom of that ellipse stroke at **half a device pixel** and antialias to
roughly half alpha, which is why every existing flat ring in the file (3491, 3500,
2991) uses 2 or more. Bars have no `lineWidth`, read as a ring, obey the rule, cost
less than a stroke, and share a shape with the ground burst above.

**Tier 2, a special** (`f.sp === 'steal' || 'drone'`). Everything from tier 1, plus
**the word it was about to say is struck out**: the same word, same 9px, same
position, in `ERD_COL` with the house shadow, and a 3px `ERD_LIT` bar sweeps
**left to right** through it over 0.13s, clipping the word away behind it. When the
bar reaches the right edge, bar and word are both gone. `drawCuts` eats a word from
the right as it rises; this one is struck from the left and does not rise, because
a counter is not a death.

**Tier 3, the Chorus, and it is worth the branch.** `crit-art-erd` #6 found the
biggest miss in the pack: `stepFoes:3079` skips a silenced foe's AI entirely, so a
silenced Chorus never reaches `stepChorus`, so `pulseT` stops, so **the refrain
does not fire** — and the refrain is `slam('AND HE WENT ALONE')`, the false line,
five syllables where six to eight are needed, the hole in the song. `-erd` is the
only thing in the game that can stop the town from singing the lie, and the design
handed it the same 0.333s clap a Hearsay gets. Worse, the tiering could not even
see it: the Chorus's wind-up is `f.warn` (3367), which is neither `state === 'tell'`
nor `f.sp`, so interrupting the refrain was tier 0, no mark at all.

- `if (f.def.boss && f.warn)` enters it.
- The band is not one band. It is one 1px `ERD_INK` bar with an `ERD_LIT` top edge
  across **each of the 22 mouths**, using `drawChorus`'s own
  `a = i / 22 * TAU + f.anim * 0.25` ring geometry so they land where the mouths
  actually are. Forty-four `fillRect`s, once.
- The struck word is `AND HE WENT ALONE`, in `ERD_COL`, with the left-to-right bar
  going through it. **You strike out the false line with the family whose true
  rhyme is the word it replaced.**
- It is the one place the family's own restraint is lifted:
  `punch({ fam: 'erd', power: 12, kind: 'close', x: f.x, y: f.y })` with no cap.

```js
/* crit-eng-erd B2, and it is a silent theft of somebody else's word.
   The handshake flag is only ever read by cancelSpecial (3309), which
   is only ever called from 3080 behind `if (f.sp)`. A tier 1 counter
   has no f.sp, so the flag was never consumed and sat on the body for
   the rest of its life, and the next thing to cancel a real special
   on that foe — an -ill freeze, a second -erd on a steal — read the
   stale flag and swallowed the grey `cut off` typo. A Thief carries
   both a steal and a bite tell, so it is reachable in the lane on the
   second encounter.
   crit-eng-erd N2: and none of it runs on a corpse. hurtFoe at 2618
   can already have killed this body, in which case erdCommand was
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
    if (!(f.silence > 0)) famOf(f, 'erd').t0 = 0;
    fxSfx('erdgag', 0.09);              // crit-eng-erd N8: named in the design, called by nothing
}
```

**The line.** `FAM_LINE.erd` is the family's one gesture on the assembled line, at
`ord 90.5`. `crit-art-erd` #18 is right that the assembly is the largest `-erd`
typography in the game and that `shadowBlur = 14` is the only blurred edge in 8279
lines, about to become the money shot of the family whose technique bans blurred
edges. So: **`shadowBlur 0`, a hard `+1,+1 #08060c` shadow, and the closing rule
drawn to the ground rule's own profile** — 2px `ERD_COL`, a 1px `ERD_LIT` core on
the upper edge, a 7px terminal tick at each end. The rule under the line and the
rule at your feet are the same object at two scales.

**Refused, with a reason:** the same finding also asks for the words to be *clipped
in from the left rather than lerped in from scattered start points*. That is the
flyer path, which belongs to the detonation and is one easing shared by all five
families. Five easings on the assembly is five code paths inside the one function
that must never fork, for a difference nobody will see at 0.1 seconds. The rule
profile and the caret carry it.

**Everything in `-erd`, one table.**

| slot | what it is | where | clock |
|---|---|---|---|
| projectile | a word that does not fly but arrives at 5.5 positions a second, in quotation marks, over an even dotted leader measured in screen pixels | `drawCalls` | sim |
| pip | two bars and an ink fill and no glyph: the empty slot, which is this game's mark for the line that was cut out | `drawStacks` | real |
| detonation | one close and one reach for the whole board, segmented bars you can count, a flat block, a redaction, a cut from both edges, sideways chips, a measured rule at your feet with a tick per body | `ord 46` | real |
| status | a black band with two nails, brackets, a strike, one blink at one second left, and the mouth actually stops moving | `ord 46` + `FAM_ST` | sim |
| finisher | three tiers of counter, the ring thrown back open as twelve bars, the word it was about to say struck through, and the town's false line struck out on the boss | `ord 46` | real |

---

### 3.4 `-ark` — shadow

> *"She walked out past the mill, the well, she walked out past the mark,
> and he held the last coal in the town and he watched her from the dark."*

**The liquid is deleted.** This is the largest single change any family takes and
`crit-art-ark` #1 earns it:

> The design opens with *"its own shadow climbs up its body like a waterline"*,
> which is specific, cheap and unmistakably this game. Then it renders that as a
> pool, a splash, sixteen heavy droplets, specks, drips, a bead, and a waterline
> that *"settles slow because a splash goes up fast and everybody knows that"*.
> **Shadows do not splash.** What is specified is purple ooze rising up a body,
> which is Blight, which is Hades' Doom, which is every shadow DoT shipped since
> 2001. Nothing in the ballad, the stanza, the Fragment II beat or the family's own
> sound cue contains ink. The sfx comment at 4174 already fixed this family's image
> and it is not liquid: *"something leaving the room: the pitch walks out and the
> air it was standing in takes another half second to close."*

**The one image, restated.** A thing standing in its own cast shadow while that
shadow climbs up its body, thrown by the one light in this game, and neither the
shadow on the floor nor the line on the body ever goes back down.

**The rule.** `-ark` is the only family that does not glow. Every `-ark` surface
over a lit sprite is `'multiply'`; every `-ark` surface on the floor is
`'source-over'` in the ink colour; and the only bright pixel anywhere in the family
is a one-pixel `#c9a1ff` rim on the edge of a dark shape. Three reasons and all
three are load-bearing: **fiction** (he had the light, he kept it, a shadow family
rendered as a purple firework is the same category error as the orange embers
coming off it today), **legibility** (`MODS.loud` is exactly `FAMS.eat.col`,
`MODS.quick` is exactly `FAMS.erd.col` and `MODS.sealed` is exactly `FAMS.ill.col`,
and a multiplied shape can never be confused with an additive one whatever hue it
is, so `-ark` opts out of the elite-colour collision entirely), and **cost**
(`'multiply'` is separable and in the same class as the `'saturation'` at 3909 the
file already pays for).

**The floor is `source-over`, not `multiply`, and that is `crit-eng-ark` #9.**
`'multiply'` does not saturate the way `'lighter'` clamps: each layer scales the
backdrop by about 0.2 at `A = 0.72`, so eight overlapping stains leave `0.2^8` of
the floor, which is zero, and the player's contact ellipse, the foes' and the
lantern pool all vanish into a hole cut in the level for six and a half seconds.
Drawn `source-over` in `ARK_DEEP`, the single-stain read on this floor is
identical and overlap converges to the ink colour instead of to black.

**The palette: four values, all derived.** `crit-art-ark` #4 counted **fifteen**
near-identical desaturated violets in a section headed *"the palette, closed, five
values"*, and the worst offender was `rgba(176,166,198)`, a light neutral
violet-grey that exists nowhere in this game's dark end.

```js
var ARK_INK, ARK_DEEP, ARK_RIM, ARK_MOTE;
function arkBoot() {
    ARK_INK  = rgbMul(FAMS.ark.col, 0.28);      // 39,30,58   the body of a shadow
    ARK_DEEP = rgbMul(FAMS.ark.col, 0.16);      // 22,17,33   the core, and every ground shape
    ARK_RIM  = hex2rgb(FAMS.ark.glow);          // 201,161,255 the only light in the family
    ARK_MOTE = rgbMul(FAMS.ark.col, 0.62);      // 86,66,129  falling matter, add: 0
}
```

The pallor is **cut**. `crit-art-ark` #4 offers a `'saturation'` fill instead and
the honest answer is that the body is already going dark under a climbing shadow,
so desaturating it as well is two ideas doing one job, and a per-body
`'saturation'` rect is the most expensive composite in the family for the least
visible of its layers.

**And the rim is the read, not the fill.** `crit-art-ark` #5: the ground layer goes
in before `drawLights` and `drawVignette`, so an `n=1` stain at 0.36 on a dark
floor, dimmed twice, at the edge of the screen, is invisible, and the design's
answer was one FEEL number for eight surfaces sitting at four different depths of
the draw order, which is a note saying this was not resolved. **Every ground shape
gets a 1px `#c9a1ff` edge whose alpha is authored against the post-wash value, and
the fill alpha drops by a third.** Two knobs, not one, because they will always be
two different numbers: `arkRimGround` (under the wash) and `arkRimBody` (under the
wash *and* over a lit sprite).

#### 3.4.1 The projectile: a hole in the light

```js
var ARK_CALL = {
    fly: { rate: 34, acc: 0, accL: 1, wob: 3.4, step: 0, grav: -8 },

    /* The drip. It is the opposite of every other trail in the game:
       the others emit vz rnd(2,10), add 1, grav 0 — sparks rising and
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
        var w = 10 + Math.sin(RT.t * 9 + c.seed) * 1.2;
        cx.fillStyle = partCol(ARK_DEEP, 0.92);
        cx.beginPath(); cx.arc(0, -8, w, 0, TAU); cx.fill();
        cx.globalCompositeOperation = 'lighter';
        cx.strokeStyle = partCol(ARK_RIM, 0.30); cx.lineWidth = 1;
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
        if (!flat) { cx.fillStyle = partCol(hex2rgb(FAMS.ark.col), 0.62); cx.fillText(w, sx - 1, sy - 1); }
        cx.fillStyle = '#0d0916'; cx.fillText(w, sx, sy);
    },

    /* MARK. The despawn stain is not a disc, it is a SCRATCH: three
       1px strokes crossing, life 1.6s. Fragment II at 5960 is "four
       letters / scratched out of a stone / and out of a man", there is
       a place called `mark` whose one prop is a stone with a name
       taken off it, and this ties every missed -ark call to it.
       (crit-art-ark #17.) */
    fizz: function (c) {
        fxPush(fxOf('ark').g, { k: 'scratch', x: c.x, y: c.y, s: irnd(0, 999),
                                t: 0, max: 1.6 }, 96);
        spray(c.x, c.y, 20, 3, c.a, 1.2, { col: ARK_MOTE, add: 0, sp0: 0.1, sp1: 0.5,
                                            vz0: -10, vz1: 4, l0: 0.3, l1: 0.6, grav: 160 });
    }
};
```

#### 3.4.2 The pip: the clock is in the letter

The cell is **stained, not lit**: where the other four fill `rgba(fam,.3)` with
`'lighter'`, `-ark` fills `partCol(ARK_INK, 0.55 * fade)` with `'multiply'`, which
on the `.72` plate takes the cell down to nearly black. The glyph `K` is
`FAMS.ark.glow` at full brightness on ink: the highest contrast of any pip on the
board, which is the right answer for a family whose material is darkness.

**And the drip is deleted.** `crit-art-ark` #14: a drip that lengthens as the stack
ages is a real clock and a real idea, and it is also five pixels hanging under a
13px cell that already has too much in it, under the night wash, potentially 148
pixels up in the air on the Chorus, and `crit-eng-ark` #24 adds that on two foes
sharing a tile the taller row's drips cross the shorter row's plate.

> **Put the clock in the glyph.** The `K` fills with ink from the baseline upward
> as `s.t` runs down, so a nearly-sour stack is a black letter with a violet outline
> and a healthy one is solid `#c9a1ff`. Same information, fewer pixels, and it is a
> letter, which is the backbone.

```js
function arkPip(cx, s, x, sy, w, fade) {
    var k = 1 - clamp(s.t / 1.2, 0, 1);          // never s.t / s.max: the drag at 2635 does not update max
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
```

**The sour**, and it is the best unclaimed idea in the family. `crit-art-ark` #16:
an `-ark` stack that expires unanswered takes HP off you and the design did not
mention it, in the family whose fiction is *a thing left unanswered*.

> A sour `-ark` stack is the only one that leaves a mark **on the foe**: a single
> 1px `#c9a1ff` tally scratched into the sprite box, persisting for the life of the
> body, stacking up to five. **You can look across a room and see which enemies you
> have already failed to answer.**

#### 3.4.3 The detonation: the shadow stands up, and the row is scratched out

**The primary object is a word**, and it is the biggest of the five.
`crit-art-ark` #2 counted seventeen specified surfaces against three words, and
#9 measured the one word the design did author at 19.2px at n=8, against a `typo`
default of 15 and a slam of 62: *"if the picture is the room goes out and the word
does not, the word has to be the loudest thing on screen, not a label."*

```js
/* THE HOLLOW WORD. Nothing else in 8279 lines strokes text.
   A word with the inside taken out is the shape of the whole game.
   Drawn at the family's SCREEN pass, not its world pass, and that is
   crit-eng-ark #3 and crit-art-ark #6: the design put the word in
   typo() (3899) and its own screen dim before 3906, so the one word
   the -ark detonation specified was multiplied by its own darkness
   along with everything else, and the claim "everything goes dark and
   the line you said is still lit" held only for objects this family
   does not draw. drawFx is inside the world block; drawBloom (which
   is where -ark's dark now lives) is after it; drawFxS is after THAT.
   A screen registration at ord 48 is the only place the word survives
   the family's own dim, and it costs one extra regFx line. */
function drawArkWord(cx, o, k) {
    var sx = Math.round(punchWX(isoX(o.x, o.y))), sy = Math.round(punchWY(isoY(o.x, o.y) + TILE_H / 2 - o.z - k * 26));
    cx.save(); cx.textAlign = 'center';
    cx.font = 'bold ' + o.px + 'px "Press Start 2P", monospace';
    cx.globalAlpha = clamp((1 - k) * 2.4, 0, 1);
    cx.fillStyle = '#0d0916'; cx.fillText('ARK', sx, sy);
    cx.strokeStyle = FAMS.ark.glow; cx.lineWidth = 1;
    cx.strokeText('ARK', sx, sy);
    cx.restore(); cx.textAlign = 'left';
}
```

`o.px` is `Math.round(22 * d.sc)`, which is 22 at one syllable and 57 at the cap:
the largest world-space family word in the game, as against `-eat`'s 18 base and
`-ill`'s 14. It rises `k * 26` rather than the usual 34, because a shadow is heavy.

**And it un-prints.** `crit-art-ark` #3 is the finding that gives this family a
verb nobody else has:

> Fragment II is *"four letters / scratched out of a stone / and out of a man"*.
> There is a place called `mark` whose one prop is a stone with a name taken off it.
> The `-ark` words are dark, mark, spark, stark. The design does not mention erasure
> once and reaches instead for a puddle.

Over 0.12s, each closed tag in that body's stack row is **struck with one hard 1px
`#c9a1ff` line**, then the glyph blanks to `#0d0916` and the plate is left behind
for 0.4s before it goes. The row you built is scratched out in front of you. It
uses glyphs the game already draws, it is unambiguously good news because it is
*your* stacks cashing in, and it is the only detonation in the game whose verb is
deletion. **The strike goes on the tags and never on your own word**, or the
effect reads as failure.

**The shadow stands up.** Per body, `t = 0`:

- **The stain** lands on the floor at radius `clamp(1.05 + 0.155n, 1.05, 2.6)`
  tiles, spreading from 0.35R to 1.0R over 0.30s on an ease-out, offset along the
  angle away from the lantern, `source-over` in `ARK_DEEP` at
  `clamp(0.20 + 0.037n, 0.20, 0.48)` with a 1px `#c9a1ff` edge at the post-wash
  alpha. Life `clamp(3.2 + 0.42n, 3.2, 8.5)` seconds on the sim clock, which makes
  it **the longest-lived visual in the game by a factor of four**, and that is the
  point: the fiction is a thing that does not come out. **Gated on `n >= 2`**
  exactly as the specks already were (`crit-art-ark` #8): twenty-five 70px stains
  in an eleven-wide square overlap into one undifferentiated dark field, in the one
  scene whose whole point is that you can see individual people.
- **The waterline** climbs the body from the feet to
  `clamp(0.62 + 0.036n, 0.62, 0.92)` of the sprite height on a smoothstep over
  0.18s, then falls over 0.55s to `clamp(0.16 + 0.026n, 0.16, 0.40)` and stays
  there. The recede is three times the rise.
- **The shadow that does not come back** (`crit-art-ark` #17). On the detonation
  frame the body's existing 42% contact ellipse **detaches** and slides 0.4 tiles
  away from the lantern over 0.18s and stays there for the rest of the body's life,
  through the shared `f.cso` offset beside `f.csr`/`f.csa` from 3.0.6. One lerp,
  and it is the most unsettling thing available here.

```js
/* THE WATERLINE, columned on the sprite's own grid.
   crit-art-ark #13: five columns of f.r*44/5 is 18px each on a Sword,
   which reads as a staircase and not as a surface, and blit()'s own
   comment is "half a pixel of drift and the whole grid softens".
   The rows are 16 to 20 characters at PXS 2, so the waterline is one
   2px column per character column with a 1px cap each, all integer,
   landing on the same lattice as the art.
   crit-eng-ark #5: and it is clipped to a baked INK TWIN of the
   sprite rather than filled as a rect. A multiply over
   (-f.r*22, -h) to (f.r*22, 0) includes the floor either side of the
   legs and the air above the shoulders, and at 0.88 over the lantern
   pool that box edge is visible. foeSilSpr gives an exact silhouette
   for one cached drawImage.
   crit-art-ark #1: the column tops are HIGHER ON THE SIDE FACING THE
   LANTERN by cos(a - colAngle), so the shadow is thickest where your
   own lamp is not reaching, and walking around a rotting foe swings
   it. One atan2 per foe per frame, and nothing in any effect pack
   does it. */
function arkBody(cx, f, h, sx, sy) {
    var g = famOf(f, 'ark'), d = foeSil(f.def.draw), spr = foeSilSpr(f.def.draw, '#271e3a');
    var a = Math.atan2(sy - (isoY(RT.px, RT.py) + TILE_H / 2), sx - isoX(RT.px, RT.py));
    var lv = g.line, i, cols, cw, top, ang, lift;
    if (!(lv > 0)) return;
    cx.save();
    if (spr) {
        cols = d ? d.rows[0].length : 8; cw = d ? PXS : f.r * 44 / 8;
        for (i = 0; i < cols; i++) {
            ang = Math.atan2(0.5, silX(d, i) || 0.01);
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
            cx.fillStyle = partCol(ARK_RIM, T('arkRimBody') * (0.4 + 0.6 * clamp(lv / 0.5, 0, 1)));
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
```

`drawChorus` (3744) is 22 hand-drawn ellipse pairs with no `bake` call anywhere and
`drawDroner` (3701) paints live over its blit, so both fall back to the box form
above with `cols = 8`. `crit-art-ark` #17 asked for that paragraph and this is it:
on the Chorus the waterline is eight 11px columns across `f.r * 44`, the caps still
lift toward the lantern, and it reads because the boss is 130 pixels tall.

**The screen is `-ark`'s only negative, and it is already built.** `2.7` gives this
family `FAM_BLOOM.ark = { a: 0.109, dark: 1.00 }`: a small violet core and a
full-strength darkening pass under it, plus `drawLights`' `1 - RT.flash * 0.6` term
so the town's own lamps dip while the rhyme goes off. That is *the room falling
away around the one thing that is lit*, for no new full-screen fill, and it
disposes of `crit-eng-ark` #20 (a `fillRect(0,0,VW,VH)` inside the shake leaves
seven pixels of one edge un-dimmed) because `fullRect` is what `drawBloom` uses.

`crit-art-ark` #7 (a) and (c) are in `2.7` as the additive core and
`FAM_PUNCH.ark = { hz: 14, ring: 1.30 }`, the slowest and longest-ringing shake of
the five. **(b) is refused**: a dim that wipes in from the four screen edges as
four animated `fillRect`s is a vignette animation, `drawVignette` already narrows
onto the blast and opens back up (2.9 hook 9), and two authored vignettes on one
frame fight.

**And the dim is sized by `best`, not by `total`.** `crit-art-ark` #8: twenty-five
ones is not a bigger moment than one eight and the design's formula said it was by
a factor of three. `-ark`'s `regDet` fires **once**, on `d.i === 0`, with
`power: d.best`; `punch()` takes the larger of every channel, so this coexists with
whatever the detonation fires for the room without either of them summing.

#### 3.4.4 The status: the rot, five seconds, and the one permanent thing

Ten ticks at 0.5s, and per tick three things move and all three move one way: the
detached shadow takes a little more floor, the waterline takes a little more body
(`+0.014`, so from the boots to the belt over ten ticks), and one or two dark
motes detach from the waterline and run **down**. That is the whole ambient
signature and it is deliberately almost nothing: a five-second effect that emits a
fountain is exhausting by second two.

`crit-art-ark` #17: the motes are **2px squares in the foe's own coat colour shaded
down**, taken from `FOE_PAL[kind].C` through `rgbMul(_, 0.5)`, not a generic
violet. *The thing is losing itself, not leaking.*

**And it walks**, at a rate rather than at a distance. `crit-eng-ark` #8 did the
arithmetic the design did not: a stain every 0.35 tiles at 2.5 tiles/s is 7.1 a
second and not "under three", `thief` is 3.2 and a Quick thief is 4.96, so one
Quick thief lays about seventy stains over a five-second rot and thirty-six are
live at once, and eight rotting foes is roughly 250 live ground entries each
costing an ellipse and a composite switch every frame.

```js
    /* an interval WITH a distance gate, not a distance trigger. Caps
       one body at 3.6/s at any speed, which is the number the design
       thought it was writing, and makes the ground array bounded by
       foe count rather than by how fast the thing runs. */
    g.trailT -= dt;
    if (g.trailT <= 0 && moved > 0.35) { arkStain(f, 0.20 + g.pool * 0.16, 2.6, 0.18); g.trailT = 0.28; }
```

**The one permanent thing.** `crit-art-ark` #10: the section sells permanence three
times and then drains the waterline at 1.6 a second, and nothing in the family
outlives about nine seconds.

> A foe **killed while rotting** leaves a stain with **no life field**, held in a
> capped ring buffer of 24 entries cleared only by the travel reset. Walk back into
> the mill after clearing it and the floor still has the outlines. The game has
> never had a persistent consequence and this is the family that should introduce
> one.

That is `FAM_FIN.ark`, it is four lines, and the ring buffer goes through `fxPush`
so the twenty-fifth outline shifts the first one off rather than growing forever.

#### 3.4.5 Conceal: the hood on the lamp

`RT.conceal = 4`. Four seconds where a Thief cannot read the board, and it draws
nothing today. The fiction hands this one over whole: *he held the last coal and he
watched her from the dark.* **The lamp does not go out. It gets covered.**

- **The lantern.** Both glow radii at 2134-2138 scale by `1 - 0.5k`, both alphas by
  `1 - 0.72k`, and then a hood: `#17121e`, `fillRect(-4, -9, 8, round(9k))`, with a
  1px `#c9a1ff` line along its lower edge. At `k = 1` the lantern is a black box
  with one violet line under the lid and a three-pixel ember leaking out below it.
  **After 2139, in its own `save`/`restore`** — `crit-eng-ark` #13: the design drew
  it "after the glow so it occludes it", and the glow runs under
  `globalCompositeOperation = 'lighter'` with the reset at 2139, so a near-black
  fill under `'lighter'` adds approximately nothing and paints no pixels you can
  see.
- **The floor pool** collapses from 120px to 44 and lerps violet, and **both
  numbers move**: `crit-eng-ark` #22, the gradient's radius and the arc that
  rasterises it are separate literals at 2145 and 2147, so shrinking one paid a
  120px fill for a 44px gradient every frame. `crit-art-ark` E3 calls this the
  single largest read in the effect and it reuses a gradient already paid for.
- **You are rimmed, not smudged.** `crit-art-ark` #12: a `'multiply'` rect over the
  player at 0.55, plus the pool collapsing, plus a bigger darker contact shadow,
  for four seconds, in combat, is the player losing their own read on where they
  are as the *reward* for landing a spell. `bake()` a second palette of the same
  row strings in flat `#c9a1ff` and `blit` it at ±1 on both axes under the real
  sprite: one extra cached canvas, four blits, and the player reads as **unlit and
  outlined** rather than smudged. Better fiction too, since the point is that he
  kept the light and you do not have it.
- **The board veil.** Every stack row on every foe gets one `'multiply'` fill of
  `partCol(ARK_INK, 0.75k)` over the plate plus two 1px `#c9a1ff` rules along its
  top and bottom edges. **The tags themselves are not touched**: hidden from them
  is not hidden from you. A dark plate becomes a black plate with violet rails,
  which is a bracket, which is the universally understood mark for *this is sealed*.

**The ring is the line.** `crit-art-ark` #11: a radial sweep unwinding clockwise
from `-PI/2` is the single most generic buff timer in games, and expressing
duration as a pie chart in a game whose entire vocabulary is words, lines and rhyme
is a category error.

> `she walked out past the mill, the well` set in 8px around a 1.15-tile circle on
> the floor plane in `rgba(201,161,255,.5k)`, one `rotate` and one `fillText` per
> glyph, about forty glyphs. **It erases from the end backwards** as the buff runs
> out. `drawLines` already owns a typewriter; this is that typewriter in reverse.

Forty small `fillText`s for four seconds is the same order of cost as the gradient
the design was already happy to pay for, and it is drawn **outside** the actor
transform off raw `sx`/`sy` the way the lantern pool already is — `crit-eng-ark`
#12: `drawActor` does `scale(west, 1)` at 2118, so an arc swept clockwise runs
anticlockwise whenever you face west and the clock unwound backwards, and
`translate(sx, sy - bob)` lifted the whole thing off the ground, which the existing
contact shadow compensates for by drawing at `ellipse(0, bob, ...)`.

```js
/* crit-eng-ark #11: RT.conceal = 4 is a flat assignment (2835), so a
   second -ark detonation at conceal 2.0 writes 4 again, the envelope's
   (4 - conceal)/0.18 term falls to 0, and the hood snaps open, the
   pool snaps 44 -> 120 -> 44 and the rim drops off you for 0.18s.
   -ark is the family most likely to be pressed twice in a row because
   the couplet is the game's best play.
   Hold the rise on its own accumulator, which cannot jump backwards.
   The fall still reads off RT.conceal so it can never desync from the
   mechanic. RT.conceal decays on the SIM clock (3821) and this rises
   on real, which is the answer to the same critique's second half: the
   hood shuts at wall speed and lifts at story speed, and during a
   recital a four second conceal is thirteen seconds of held breath. */
    g.k = Math.min(1, g.k + real / 0.18);
    var k = Math.min(g.k, RT.conceal / 0.55);
```

**The denial.** 3320, when a Thief reaches and finds nothing: the same `'???'`, plus
three drips thrown from the Thief toward the player that die at 40% of the
distance. Its hand goes out and stops. `fxSfx('arkdeny', 0.2)`.

**`-ark` plus `-ill`.** `crit-art-ark` #17's last bullet, and 3.0.6 answers it:
`famStatus` gives a frozen body to `-ill`, so the waterline does not draw over the
ice. The **stain, the detached shadow and the tallies still do**, because they are
`-ark`'s own world pass at `ord 48` and not `FAM_ST`. A frozen rotting foe is a
cold body standing in a shadow that is still spreading, which is a better picture
than either alone and needed no arbitration beyond the status order.

**Everything in `-ark`, one table.**

| slot | what it is | where | clock |
|---|---|---|---|
| projectile | a hole in the floor with a violet rim, a cut-out word lit from behind, drips that fall and tick off the ground, a scratch where it missed | `drawCalls` | sim |
| pip | a stained cell, `K` in full brightness on ink, and the ink climbing the letter as the clock runs down | `drawStacks` | real |
| detonation | the row scratched out tag by tag, a hollow 22-57px word, the stain, the waterline, the contact shadow detaching and never coming back | `ord 48` world + `ord 48` screen | sim |
| status | five seconds of the line creeping up, motes of the body's own colour running down, a walked trail, and one stain that outlives the room | `FAM_ST` + `ord 48` | sim |
| finisher | the outline of where the thing was standing, permanent, in a ring of 24 | `foeDie` | — |
| conceal | the hood, the pool collapsing to a puddle, you rimmed instead of smudged, and the line she left by written round your feet and erasing backwards | `drawActor` + `ord 48` | real (rise), sim (fall) |

---

### 3.5 `-ill` — still

> *"but for the girl who never will."*

**The one image.** A person caught mid-step going grey-blue and furred with frost,
held there while the whole world holds with them, and then coming apart into their
own pixels, which fall, bounce once, and go out.

**The rule that generates everything.** Four of the five families are things
happening. `-ill` is a thing **not** happening, so every decision is the inverse of
the decision the other four make: the effect contracts or holds rather than
expanding, matter hangs and then falls hard rather than rising, the word lands at
full size and does not move, the body is repaletted rather than painted over, and
the screen stops rather than shaking.

**And the split between the clocks is the family's thesis, stated once so nobody
"fixes" it later.** `crit-art-ill` #14 caught the design contradicting itself twice
in its own implementation notes:

> **All matter on the sim clock. All typography on the real clock. The world stops
> and the sound does not.**

`-ill` asks for the longest hitstop in the game (`FAM_PUNCH.ill.stop = 1.50`) and
it is the only family whose own matter honours it: close a big `-ill` and the world
stops, the ice stops with it, and the only things still moving on screen are the
word and `drawCuts` writing the dead thing's last line. Everybody else's sparks
keep flying. That is a stronger sentence than the design's original, it matches
what `drawCuts` already does, and it means nothing has to fight the draw layer.

**Put the lamp in it.** `crit-art-ill` #1: search that document for *lamp*, for
*leaving*, for *nobody answered*, and you get zero hits; what is there instead is
frost, rime, crust, icicle, flake, shatter, thaw, crack, powder and hexagon, which
is Ice, the freezing element, from any pack, with this game's hex codes typed over
it. And this is *her* sound: `a3Mark` pins a 999-second `-ill` stack on all
twenty-five townspeople and `a3True` writes *"but for the girl who never will."* in
`#6fd4ff`.

- **The player's lantern is the only thing in the game that dims when you cast.**
  On an `-ill` call the arm's glow at 2135-2137 drops over 0.25s, and it stays
  dimmer than it left for as long as any freeze is on the board. Nothing else dims
  your own light.
- **The ground mark under a frozen body is not a snowflake.** It is **a pool of
  lamplight with no lamp in it**: a flat 1:0.5 ellipse of cold light with a hard
  dark bite out of the middle where the lamp should be. Ground-plane doctrine, one
  new shape, and it says *somebody stopped here and put the light down*.

**The palette: two new values, not four.** `crit-art-ill` #7 and #8 delete two of
the design's four. `ILL_DEEP #0d1620` is a blue-black, a new hue at the bottom of
the ramp, and its stated purpose is false: the floor base fill is `#07060a` at luma
7 and `#0d1620` is luma 19, so a frozen outline in it is **lighter** than what it
sits on and the silhouette gets softer, not harder — and the hardening job is
already done better by the rime coat, since a light rim on the existing dark
outline is a harder edge than dark on dark. `ILL_WHITE #f2fbff` is pure white in
practice: `.ice2` lifts every luma 72% toward 255 before the cold remap, so the
brightest body pixels land near `rgb(232,244,255)` and blitting that additively at
0.5 over itself clips most of the figure to 255,255,255. Four new values per family
times five families is twenty and the end of a closed palette.

| name | value | where |
|---|---|---|
| `ILL_COL` | `#6fd4ff` | `FAMS.ill.col`. Rings, cell tint, the ground pool. |
| `ILL_GLOW` | `#c8f0ff` | `FAMS.ill.glow`. The caesura bar, motes, the word's rim. |
| `ILL_RIME` | `#e6f6ff` | new. The frost crust, and **the word**. Two steps above glow, still not white. |
| `ILL_DUST` | `198,228,246` | new, as an `r,g,b` for `part()`. The dry pale mote, **`add: 0`**. |

**And the value hierarchy is inverted for the first 0.15s of a close.**
`crit-art-ill` #3: the design gave `STILL` the fill `#6fd4ff` and then surrounded it
with rime at `#e6f6ff`, motes at `198,228,246` and a ground stroke at
`rgba(200,240,255)` — every piece of matter a higher value than the word, in a
doctrine whose line is *spells are words getting bigger*. `STILL` is drawn in
`ILL_RIME` and is the only thing on screen above `#c8f0ff`; every mote, coat and
ring is held at or below `FAMS.ill.col` until the word starts to fade, then they
come up. One alpha ramp shared by the matter layers, one colour swap on the word,
and it is what makes the eye go to the typography rather than size doing it alone.

#### 3.5.1 The projectile: it freezes the air it passed through

```js
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
       drawPartPass that ROUNDS its x (see the amendment below), so
       the material this family stakes its identity on arrives hard
       rather than as a 2x2 of quarter alpha. */
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
       budget was inverted against frequency — repalette, two coats,
       held pose, ground disc, residue, thaw cracks, cooling shards, a
       bounce, a grind and a late foot for the execute, which a player
       sees twenty times a run, and three identical ghosts for the
       call, which they see four hundred times. STILL / TILL / ILL /
       LL. The trail is the sound decaying rather than the same word
       four times. It is typography-first, it is free, and it is the
       only trail in the game that MEANS something.
       No shadow and no halo on a ghost: the shadow is what makes the
       live word feel present, so withholding it is what makes the
       ghosts feel absent. c.max is on the call literal
       (crit-eng-ill #19) so the tail grows out of the muzzle rather
       than existing fully formed at the barrel. */
    word: function (cx, c, sx, sy, P) {
        var w = c.word.toUpperCase(), age = c.max ? 1 - c.life / c.max : 1, j, gx, gy;
        var al = [0.34, 0.19, 0.09], gate = [0, 0.07, 0.12];
        cx.textAlign = 'center';
        cx.font = 'bold 12px "Press Start 2P", monospace';
        for (j = 2; j >= 0; j--) {
            if (age * (c.max || 0.58) < gate[j]) continue;
            gx = c.x - c.vx * (j + 1) * 0.042; gy = c.y - c.vy * (j + 1) * 0.042;
            cx.globalAlpha = al[j]; cx.fillStyle = P.col;
            cx.fillText(w.slice(j + 1), isoX(gx, gy), isoY(gx, gy) + TILE_H / 2 - 26);
        }
        cx.globalAlpha = 1;
        cx.fillStyle = '#08060c'; cx.fillText(w, sx + 1.5, sy + 1.5);
        cx.fillStyle = P.col; cx.fillText(w, sx, sy);
    },

    /* The syllable falls on the ground and goes out. Four dust motes
       and the word one last time, NOT rising.
       crit-eng-ill #13: the design asked for "the word at 0.18 alpha",
       and drawTypo paints a hard #08060c shadow at +2,+2 BEFORE the
       fill (1433) with no alpha control on it, so passing
       rgba(111,212,255,.18) as the colour faded the fill and left the
       shadow at full strength: a solid dark word with a faint blue
       ghost on it. It does not go through typo() at all. */
    fizz: function (c) {
        spray(c.x, c.y, 20, 4, c.a, 1.0, { col: ILL_DUST, add: 0, sp0: 0.05, sp1: 0.3,
                                            vz0: -8, vz1: 0, l0: 0.4, l1: 0.8, grav: 40, sh: 2 });
        fxPush(fxOf('ill').a, { k: 'fizz', x: c.x, y: c.y, w: c.word.toUpperCase(), t: 0, max: 0.12 }, 32);
    },

    /* the lamp goes down when you say it. 0.25s, and it stays down
       while anything on the board is frozen. */
    cast: function (x, y, a) { fxOf('ill').lamp = Math.max(fxOf('ill').lamp, 0.25); }
};
```

**Amendment to 2.5, one operation.** `crit-art-ill` #19 is right that
`fillRect(sx - s / 2, ...)` at unrounded `isoX`/`isoY` renders a size-1
non-additive mote as a 2x2 of quarter alpha, and that dryness *is* this family's
signature. A private draw path for `add: 0` particles is **refused** — a second
particle loop for one family is the thing 2.5 was written to delete — but the
`sh === 2` arm of `drawPartPass` already exists as its own branch, so it rounds:

```js
        else if (p.sh === 2) cx.fillRect(Math.round(sx), Math.round(sy - s), Math.max(1, Math.round(s * 0.5)), Math.round(s * 2));
```

One `Math.round` on a branch that is already there, benefiting the one family that
needs hard specks, costing nothing on the other two arms.

#### 3.5.2 The pip: a thermometer emptying

`crit-art-ill` #11: the design put 1px edge lines, corner pixels, midpoint pixels,
then 2px edge lines, then a 1px diagonal crack over the glyph into a 13px cell
whose neighbours' ink already bleeds eleven pixels into it. The edges are precisely
where the neighbour's ink is; the crack is indistinguishable from a neighbour's
stroke. Three of its four states cannot be seen, and *"it does not move"* is a
differential cue that only reads if you can resolve the cells it differs across.

> **One state change, and it is a shape change.** The `-ill` pip is the only pip
> drawn as a **solid filled cell**, and as `s.t` runs down the fill **drains from
> the top**. One `fillRect` whose height is `s.t / s.max`. It reads at 13px, it
> reads while overlapped, it reads at a glance across a row, and it is a continuous
> timer instead of three thresholds.

```js
function illPip(cx, s, x, sy, w, fade) {
    var k = clamp(s.t / 1.2, 0, 1), hh = Math.round(14 * k);
    cx.fillStyle = partCol(hex2rgb(FAMS.ill.col), 0.55);      // solid: the only filled cell on the board
    cx.fillRect(x - w / 2 + 1, sy + 4 - hh, w - 2, hh);
    cx.fillStyle = partCol(ILL_RIME_RGB, 0.75);               // the meniscus
    cx.fillRect(x - w / 2 + 1, sy + 4 - hh, w - 2, 1);
    cx.fillStyle = s.drone ? '#8a8090' : (k < 0.2 ? '#9fc8dc' : FAMS.ill.glow);
    cx.fillText('L', x, sy);
}
```

`-ill` registers **no `FAM_FADE` row**: the cell does not breathe and does not
flicker. In a row of five sounds where four of them pulse, the still one is
instantly findable, and finding your `-ill` stacks fast is the whole reason you
press 5.

**The sour is one thing, not two.** `crit-art-ill` #22: the design offered *"one
`typo` with a new fall behaviour, or, cheaper and equally good, four dust motes"*,
and two options in a spec is two implementations. It is the motes: four, straight
down out of the cell, `vz: -10, grav: 220, add: 0, sh: 2`. An icicle coming off a
gutter. The vertical drop is exact through
`z = foeH(f) + 18 + (f.so || 0)`; the **horizontal** placement into the stack's own
cell goes through the `x + d` / `y - d` identity, which is `crit-eng-ill` #18's
"not without a new particle field" answered without a new field.

#### 3.5.3 The detonation: the ring closes and the body stops

**The hexagon is deleted everywhere it appears** — the chord ring, the freeze disc
and the execute ring. `crit-art-ill` #2: six chords with alternate vertices pulled
in is snowflake symmetry, the most tired ice signifier in the medium; it breaks the
1:0.5 ellipse rule every other ground mark in the file follows; under that squash
it is a lumpy squashed circle and at twenty-five bodies it reads as a circle drawn
badly; and the design's own justification — that it distinguishes this ring from
four others — is already done by **the contraction**, because no other ring in this
game closes.

> Keep the ellipse, keep the contraction, and get the *not a normal ring* read from
> the game's own idiom: **three arcs with two-pixel gaps.** A broken ring, and the
> gaps stay put as it closes. That is `drawCuts`' language — a line with a piece
> taken out of it — on the floor. 1px stroke, integer-snapped.

```js
/* t = 0. The ring closes on the body like a hand, from
   (f.r + 1.1 + 0.10n) tiles to f.r over 0.15 + 0.01n seconds on an
   ease-out, and on the frame it reaches f.r it stops existing, which
   is also the frame the freeze lands, so it reads as the ring
   BECOMING the ice. Sim clock: it freezes with everything else. */
function illDet(f, n, d) {
    var st = fxOf('ill'), g = famOf(f, 'ill'), h = foeH(f), i, mo, sp;
    if (d.i === 0) st.wordN = 0;
    fxPush(st.a, { k: 'ring', x: f.x, y: f.y, r0: f.r + 1.1 + n * 0.10, r1: f.r,
                   t: 0, max: 0.15 + n * 0.01, d: d.i * d.stag }, 64);
    /* the pips go out. crit-eng-ill #4: the design said drawStacks
       runs after the close on the same frame so this is "a comparison
       against RT.t". It does not: famEffect runs at 2619, f.stacks is
       zeroed by the wax at 2622 and reassigned by the filter at 2624,
       all inside the same synchronous live.forEach, long before draw()
       is next called, so by the time drawStacks runs the cells do not
       exist and the row has reflowed. Capture the count HERE, where
       `match` has not been spent, as a short-lived per-foe transient
       in the house _ idiom, and let drawStacks paint n ghost cells to
       the right of the live row while it lasts. In SECONDS, not
       frames (crit-eng-ill #10). */
    g.pip = { n: n, t: 0.05 };
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
       bar, and the square gets ONE STILL in screen space over it,
       which is the picture the ending wants and which the design did
       not contain. */
    if (st.wordN < 4) {
        st.wordN++;
        fxPush(st.a, { k: 'word', x: f.x, y: f.y, z: h + 30, n: n,
                       px: Math.min(24, 12 + n * 1.4),
                       rim: clamp((n - 2) / 4, 0, 1) * 0.5,      // continuous, not a binary gate at n>=4
                       t: 0, max: 0.57, d: d.i * d.stag }, 16);
    }
}
```

**The word does not move.** `STILL` at `min(24, 12 + 1.4n)` px in `ILL_RIME`, at
full size on frame one, held for 0.45s and then gone over 0.12s by dropping alpha
only. No pop scale-in, no drift. Under it at `(1, 1)` the same word in `#08060c`,
and at `(-1, -1)` a rime rim in `rgba(200,240,255, rim)` — **continuous**, not the
design's hard gate at `n >= 4` with nothing at three (`crit-art-ill` #21). The word
hold ramp (0.48s at n=1 against 0.69s at n=8) is **dropped**: nobody times a word.

**And the scaling channel this game is uniquely entitled to.** `crit-art-ill` #21:

> **One 1px frost spur per closed stack, rising off the cap height of the word,
> capped at eight.** The player can *count* them. This is a game about counting
> syllables. Counting beats measuring, and it costs `n` `fillRect`s.

**The drop shadow offsets up.** For this family alone (`crit-art-ill` #22): the
word's hard copy goes to `(-1, -1)` and the rime rim to `(1, 1)`. A body lit by a
lamp that is on the ground. One sign flip, and it is the only lighting cue in the
family.

#### 3.5.4 The status: `f.frozen`, and the body is repaletted

Today: one `fillRect(-f.r*22, -h, f.r*44, h)` at 45% `#cfeeff`, which is the same
rectangle as the hit flash, over a sprite that has a silhouette. Replaced entirely.

**The body is not painted, it is repaletted, and the ice sprite replaces the
drawer.** This supersedes `crit-eng-ill` #8's six-edit fix with a one-edit fix that
is strictly better. The critique is right that a generic rime blit from `drawFoe`
lands 2-3px off on two archetypes, does not follow the Sword's rotation and does
not sway with a folk — but the answer is not to put the ice inside all six
`FOE_DRAW` entries. It is that **a frozen body does not call its drawer at all**:

```js
    /* 3511, one line. A frozen body is a static blit of a repaletted
       bake, so it inherits no drawer's offset, no drawer's rotation
       and no drawer's animation — which also delivers crit-eng-ill's
       "held pose" for free and without the six-line snapshot the
       design proposed. A Sword frozen mid-swing keeps the pose it was
       baked into rather than continuing to swing; f.anim advances
       above the frozen guard at 3053 and drives the Hearsay's gape and
       the Droner's inner glow, and none of them can reach a bitmap.
       icy() returns null for anything with no rows (the Chorus) or
       when the bake budget is spent, and then the normal drawer runs
       under the fallback tint. */
    var ice = f.frozen > 0 ? icy(f) : null;
    if (ice) blit(cx, ice, 0, 0); else (FOE_DRAW[f.def.draw] || drawMouth)(cx, f, tell);
```

```js
/* pxShade (1822) hands back 'rgb(r,g,b)' and pxPal (1827) is half full
   of them, and hex2rgb (2859) opens with
   `if (h.charAt(0) !== '#') return '200,200,200'`. So a coldPal
   written the obvious way silently turns the coat shadow, the trim
   light, the skin shade, the hair light and the boots of EVERY
   archetype into one identical mid-grey before the cold remap: the
   frozen figure loses exactly the five values that give it shading,
   which is the one thing the repalette promises it keeps. The design's
   worked example only used the three literal hexes, so the failure was
   invisible in the doc and unmissable on screen. crit-eng-ill #1.
   Note T is a literal hex in four of the six FOE_PAL rows and a
   pxShade value in `sword` (3691): both forms appear inside one
   palette. */
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
/* crit-eng-ill #15: a3Mark puts an -ill stack on all 25 folk, one `5`
   closes all 25, and folk bake keys carry coat, skin and seat (3471),
   so the square holds up to 25 distinct keys and this would add three
   coats to each: 75 bake() calls in one frame, ~13,500 fillRects and
   75 canvas allocations, landing on the single most important frame in
   the game beside 25 detonations and 300 particles.
   startBuildBudget / mayBuild (6618) exist because "entering the
   square used to build every sprite at once, 150ms, nine dropped
   frames, at the moment the place is supposed to open up". Behind the
   budget, exactly as drawProp does at 6629, with the flat tint as the
   one-frame fallback.
   .ice2 is skipped for folk entirely: hurtFoe returns 0 for folk at
   2847 so a folk can never be executed, and the second palette would
   be 48 dead canvases. */
function icy(f) {
    var d = foeSil(f.def.draw); if (!d || d.noMask) return null;
    var k = 'ice.' + foeKey(f) + (f._exec ? '.2' : '');
    if (SPR[k]) return SPR[k];
    if (!mayBuild()) return null;
    return bake(k, d.rows, coldPal(FOE_PAL[f.def.draw], f._exec ? 0.72 : 0));
}
```

**The rime, in two coats, growing from the bottom up.** `crit-art-ill` #10: coat 1
maps only the outline character `o` and fades to alpha **1**, and on a 36x24
Hearsay the outline is a large fraction of the painted pixels with every interior
outline being `o` too, so at alpha 1 that is a near-white wireframe of the whole
figure, brighter in total than the flat 45% rect it replaces. Coat 1 caps at
**0.55** and coat 2, which covers far fewer pixels, runs to 0.85. And they grow as
**one clip rect climbing the sprite box** rather than as a uniform alpha ramp:
*cold comes off the ground*, it costs one `rect`/`clip` on a blit, it makes the
growth timer spatial instead of alpha-only, and alpha-only growth is invisible at
twenty-five bodies while a rising line is not. Both coats are `source-over`, never
`lighter`: additive frost blows the figure out to a white blob and loses the
silhouette, which is the exact failure of the thing being replaced.

`crit-eng-ill` #21: `DRONER_SPR`'s top row is `'mmmmmm'` with no outline, so coat 1
leaves the bell bare and coat 2, which includes `m`, catches it. That is correct
and worth keeping.

**`f.frozenM`.** `crit-eng-ill` #7: the rime alpha divides by it, `famEffect` at
2838 is the only writer of `f.frozen` and `spawnFoe` initialises `frozen: 0` at
3009 with no `frozenM`, and `cx.globalAlpha = NaN` is **silently ignored** by the
canvas, so the blit inherits whatever alpha the previous draw left. A leak that
looks like a flicker. Written on the same line as 2838, defaulted in `spawnFoe`,
and still read as `(f.frozenM || f.frozen || 1)`.

**Three marks that are not frost.**

- **The caesura bar.** `crit-art-ill` #5: the design correctly identifies the full
  stop as its best idea and then uses it exactly once in five moments, while
  `f.frozen` gets its identity from the generic bit. **A frozen foe carries a 2px
  `#c8f0ff` vertical caesura bar floating beside its head for the whole duration.**
  One `fillRect`. It survives twenty-five enemies, it distinguishes frozen from
  silenced at a glance, and it puts the game's best existing idiom in permanent
  service instead of in a two-frame cameo. **That, not the hexagon, is `-ill`'s
  shape.**
- **The elite mark does not draw.** `crit-art-ill` #6: `-erd` sets `f.silence` and
  `-ill` sets `f.frozen` and both mean *the enemy is not doing the thing*;
  `#9fe0c8` and `#6fd4ff` are adjacent cool hues; and `MODS.sealed` is **exactly**
  `#6fd4ff`, which RECON puts on the must-resolve list. `-ill` claims **value and
  stillness, not hue**: every `-ill` body state sits in the top third of the ramp,
  `-erd` stays mid-value, and while `f.frozen > 0` `drawMod` does not draw at all.
  *A thing that has stopped shows no other status.* One branch, and it deletes the
  `sealed` collision outright.
- **The contact shadow tightens and darkens** over the freeze, through 3.0.6's
  channel: `f.csr = 1 - 0.25 * age`, `f.csa = 0.42 + 0.16 * age`. A thing that has
  stopped is pinned to the floor.

**The residue is one mote per frame, board-wide.** `crit-art-ill` #18: one mote per
`0.5 / (0.6 + 0.12n)` seconds *per frozen body* for up to three seconds is roughly
280 particles from this layer alone at eight foes, and twenty-five frozen folk emit
continuously. A single module index walks the frozen foes and emits **one mote per
frame total**, distributed round-robin. Visually identical, and it is sixty
particles a second however many bodies are standing there.

**The thaw**, which today does not exist: the tint just stops. The last 0.28
seconds get `clamp(1 + floor(n/3), 1, 3)` cracks appearing one at a time, each a
1px `#e6f6ff` line across the sprite box at an angle seeded off `frac()` so it is
stable frame to frame; then the rime alpha drops fast; and on the frame `f.frozen`
crosses zero, `f.wob = 0.35` (the existing hit-recoil sine, so the body shudders
back to life using machinery that is already there), eight dust motes, and
`fxSfx('illthaw')`. **The crossing is latched in `stepFoes` at 3060, not in
`drawFoe`** — `crit-eng-ill` #23: `devDemo` calls `draw()` by hand at 8143 and 8152
to step frames for headless capture, so a zero-crossing detected in a drawer fires
the sound from a draw function and can be double-fired by a second pass.

#### 3.5.5 The finisher: the execute

Under 18% hp a closed `-ill` kills. Today it prints `STILL` and nothing else.

**The execute prints no word of yours at all.** `crit-art-ill` #4 caught the design
cancelling its own best sentence: it says the executed foe's cut is *its own last
word, uncut, with the bar after the last letter* — which is the best line of
fiction available anywhere in this job, because *the sound that ends the ballad is
the only sound that lets anything finish speaking* — and then two lines later prints
`STILL` at 13px over the corpse, which is talking over it. `STILL` is also already
the close word and the current `famEffect` execute word, so the family's biggest
moment said the same thing as its smallest.

> The foe's own `deathLine` fragment **completes**, the caesura bar lands **after**
> the final letter instead of through the middle, and that is the whole typographic
> content of the biggest effect in the family. One flag on the cut record and three
> lines in `drawCuts`. The close says `STILL`. The execute says nothing. Silence is
> the payoff for the family of silence.

```js
/* crit-eng-ill #2, and it is a live bug today. doRhyme calls hurtFoe
   at 2618 and famEffect at 2619, hurtFoe calls foeDie on lethal, and
   famEffect's execute test at 2839 is
   `if (f.hp / f.hpm < 0.18 && !f.def.boss)` — which is ALWAYS TRUE for
   anything the rhyme itself killed, because a corpse has hp <= 0. The
   inner hurtFoe returns 0 at 2847 on f.dead, which is the only reason
   the spurious STILL has never been noticed. Under the new design that
   path would fire the hold, the longest hitstop in the game,
   sfx('illexec'), the held ring and a 30-shard shatter of a body that
   burst into grey smoke a line earlier. Every ordinary -ill kill in
   the game becomes an execute. */
if (!f.dead && f.hp > 0 && f.hp / f.hpm < 0.18 && !f.def.boss) { f._exec = 1; hurtFoe(f, f.hp + 1, 'ill', { exec: 1 }); }
```

**Folk do not shatter.** `crit-art-ill` #20:

> At the climax the player is asked to close `-ill` on twenty-five seated
> neighbours, and the family's set piece explodes a person into thirty pieces of
> themselves. That may well be the right call for a town that cut a woman out of
> its own song, but the document never notices that the target is a person, and
> shipping the decision by accident is how a game about a moral failure ends up
> looking like it is enjoying one.

`if (f.def.folk)` the body stops, the frost climbs, the cut line finishes, and they
stay standing. Nobody breaks. It is one branch, it is far more disturbing than the
shatter, and it means the shatter stays reserved for the things that were coming
for you.

**The beat sheet**, real seconds, because this is the one thing that has to outlive
the freeze it caused.

**t = 0, the stop.** The body goes to `.ice2` (`coldPal(pal, 0.72)`), both rime
coats to full instantly — the execute skips the whole freeze arc and lands on its
last frame. One `source-over` blit of the same sprite at 1.35x and **0.55 in
`ILL_RIME`**, for **0.03 real seconds**, not "two frames": a halo in the exact shape
of the thing that just died. One **held** ring at `f.r + 0.4` tiles, three arcs with
gaps, which does not expand and does not contract — every other ring in the game
moves and this one is nailed to the floor. And `punch({ fam: 'ill', power: n,
kind: 'kill', x: f.x, y: f.y })`, which through `FAM_PUNCH.ill.stop = 1.50` and
`hard = 1` is the longest hold in the game and the one that **stops** rather than
fading. `fxSfx('illexec')`.

**t = 0 to 0.12, the hold.** Nothing else happens. The sim clock is at 4%. The foe
is pale and still and nailed to a ring, and the only thing moving anywhere on
screen is `drawCuts` writing the dead thing's last word, because `drawCuts` is on
the real clock. This is the beat the family is named for and it must be long enough
to notice and short enough not to annoy.

**t = 0.12, the shatter, and it throws the foe's actual pixels.** The body is a
baked canvas in `SPR` and `drawImage` takes a source rect, so a shard is
`drawImage(spr, sx0, sy0, 6, 6, dx, dy, 6, 6)`: one call, no allocation, no path,
no colour parse. A 26-shard body is cheaper per frame than 26 particles and it is
made of the enemy instead of made of squares.

- **Occupancy comes from the row strings**, not from `getImageData`.
  `crit-eng-ill` #14: a readback on a canvas Chrome has promoted to the GPU forces
  a sync, on the frame that also sets the longest hitstop in the game and resolves
  the whole detonation, and `bake` returns only a canvas so there is nowhere to
  cache it. `foeSil`'s `lo`/`hi` (3.0.3) already are the occupancy map, computed
  once at first use, and a 6px cell is occupied if any row it covers has
  `lo <= c*3 <= hi`.
- **Shards carry world tiles and `z`, like every other piece of matter.**
  `crit-art-ill` #15: screen-space shards do not sort against bodies, fly over
  houses they should be behind, and the ones that "stick" lie on the *screen* and
  slide across the square as the camera eases, which is the bug the camera comment
  at 108 is the history of. `vx`/`vy` in tiles/s, `vz` and `grav` in px, converted
  at draw, and the anchor reconstructs `blit`'s own rounding through `silX`/`silY`
  (`crit-eng-ill` #17: get it wrong by a pixel and the body visibly jumps on the
  frame it shatters).
- **Gravity 330** against the particle system's 130. Ice is heavy, the shards are
  down inside 0.4s, nothing floats. Bounce at `voz *= -0.22, vox *= 0.55`, the same
  restitution shape as `stepParts` but deader; after the second bounce it sticks.
  Pieces of the enemy end up lying on the floor.
- **They cool as they fall**: drawn from `.ice2` for their first 0.12s and from
  `.ice` after. Two canvas references and one boolean compare per shard, and it is
  the detail that will make people rewatch it.
- **They grind, in steps, and they tumble by flipping.** `crit-art-ill` #16:
  shrinking a 6px destination continuously to 2px with nearest-neighbour resamples
  a different subset of source pixels every frame, which is not grinding away, it
  is a 3px square strobing. Snapped to **6, 4, 2**, each stable for its own stretch,
  destination coordinates rounded. For tumble, no rotation: one of **four flips**
  per shard chosen at birth via a negative scale on `drawImage`. Free, four
  orientations, no interpolation, and it kills the *the sprite has been cut into a
  grid* read that an unflipped grid always gives away.
- **One shard lands late.** The bottom-row shard gets `life *= 1.6` and
  `grav *= 0.7`. Something always hits the ground a quarter of a second after
  everything else. One line, and it is the single most satisfying detail here.
- `foeDie`'s own grey 16-particle cloud is **suppressed** through `FAM_FIN.ill`
  returning 1: it is a different material, it is grey, and it lands on top of the
  one moment in the game that has a material of its own.

**And the record lives in `ents`.** `crit-eng-ill` #3 is the finding that decides
where all of this can run from: `ents` skips corpses (`if (!f.dead)` at 3883) and
`stepFoes` splices them out the next frame, so from the instant of the execute
`drawFoe` is never called for that body again and **everything at t = 0 has no
drawer**. The world seam is wrong twice — it is after `ents`, so a pale body would
paint over any foe, prop or NPC standing in front of it and break the only z sort
in the game, and it is after `drawLights`, so it would be the one body in the scene
not touched by the night wash. The hold record and the shard set are pushed into
`ents` every frame with `k = rec.x + rec.y`, which is exactly the convention
`PARALLEL.md` states for new world entities; the powder and the held ring stay at
`ord 50` where they belong.

**Multiple executes.** Everything runs per foe, the hold takes the longest requested
value rather than summing (which `punch()` already guarantees), and the shard cell
grows to 8px at three or more simultaneous executes and 10px at five or more,
cutting a Deaf from 36 shards to 20 to 14. The stop gets longer, the pieces get
chunkier, and the frame cost stays flat: six simultaneous executes cost about 2.4
times one, not six times. `X` is resolved **after** the loop, not inside
`famEffect`, which has no batch context and is called from three places with three
different notions of *this keypress* (`crit-eng-ill` #12); 2.10 already hoists the
`kill` punch to after `live.forEach` for exactly this reason and the shard cell is
decided at t = 0.12 anyway, so it can read the final count.

`crit-eng-ill` #21's corrections stand: `DEAF_SPR` is a solid 16x16 and yields
about 36 occupied cells rather than 30; `SWORD_SPR` yields fewer than 25 and is
`norhyme` anyway; the Deaf's face bar is a `fillRect` at 3710 and not part of the
sprite; and the game has **three** non-additive bursts (2498, 3044, 3424), not one.

**The board-wide statement, which the design did not contain.** `crit-art-ill` #17:
one `STILL` in screen space over a square of quietly frosting people. It is
`FAM_LINE.ill` — the family's one gesture on the assembled line at `ord 90.5` — and
it is the only `FAM_LINE` row of the five that draws a word: the line's own rule
grows **eight 1px frost spurs off its upper edge**, one per syllable up to eight,
and the tally under it goes still. Everything else on the line stops moving for the
length of the hold.

**Everything in `-ill`, one table.**

| slot | what it is | where | clock |
|---|---|---|---|
| projectile | a word that slows and then commits, three ghosts each a letter shorter, a ring of eight hard pixels, frozen air that does not move, and the player's own lamp going down | `drawCalls` | sim (matter), real (letters) |
| pip | the only solid cell on the board, draining from the top like a thermometer, `L`, and it does not breathe | `drawStacks` | real |
| detonation | a broken ring closing on the body, matter that hangs, four `STILL`s at most in `ILL_RIME` with one countable frost spur per syllable | `ord 50` | sim |
| status | the body repaletted cold and pose-held, two rime coats climbing from the ground up, a caesura bar beside the head, no elite mark, a pool of lamplight with a bite out of it, and a thaw that shudders | `drawFoe` + `ord 50` | sim |
| finisher | the hold, and then the body comes apart into 6px pieces of itself that fall, bounce, cool, flip, grind in three steps and stick, while its own last word finishes and nothing of yours is printed over it | `ents` + `ord 50` | real |

---

### 3.6 What the five families change outside their own blocks

Twelve edits, and **every one of them is shared by all five**, which is the whole
point of 3.0.1. Five families times eight functions was forty branches from five
authors; this is twelve lines from one.

| # | site | edit |
|---|---|---|
| 1 | `drawFoe` 3510 | the contact ellipse reads `f.csr` / `f.csa` / `f.cso` (3.0.6 A) |
| 2 | `drawFoe` 3511 | `var ice = f.frozen > 0 ? icy(f) : null; if (ice) blit(...) else (FOE_DRAW[...])(...)` |
| 3 | `drawFoe` 3512 | `if (f.m && !(f.frozen > 0)) drawMod(cx, f, h);` — a thing that has stopped shows no other status |
| 4 | `drawFoe` 3515 | the flat `#cfeeff` freeze rect is **deleted**; `FAM_ST[famStatus(f)]` in its place (3.0.6 B) |
| 5 | `drawStacks` 3550 | `if (FAM_FADE[s.fam]) fade *= FAM_FADE[s.fam](s);` before the alpha |
| 6 | `drawStacks` 3552-3556 | the cell tint and the tag are `FAM_PIP[s.fam](cx, s, x, sy, w, fade)`; the plate keeps its own line, and one row-level pass runs after the loop for `-ight`'s filament and `-ark`'s veil |
| 7 | `stepCalls` 2424 | the trail is `FAM_CALL[c.fam].trail`, on the shared `c.et` accumulator at `fly.rate` per second. This is the 144Hz over-emission fix and it lands for all five at once |
| 8 | `drawCalls` 3939 | `mark` inside the ground transform, then `head`, then `word`. Three registry calls, no branch |
| 9 | `doCall` 2390 | five tokens on the call literal: `max: T('callRange') / 13`, `seed: rnd(0, TAU)`, `et: 0`, `tk: []`, `tki: 0`; and `FAM_CALL[fam].cast` fires after the push |
| 10 | `landCall` 2450 | `FAM_LAND[c.fam](f, c)`, and the arrival `typo` takes the family's own word rather than `c.word` |
| 11 | `breakStack` 2484 | `var col = FAM_SOUR[s.fam] && FAM_SOUR[s.fam](f, s, i);` and the self-damage number takes `col` when it returns one |
| 12 | `foeDie` 3424 | `if (!(FAM_FIN[famStatus(f)] && FAM_FIN[famStatus(f)](f))) burst(...)` — the default cloud is suppressed by a family that has something better |

**And one edit to a function 3.4 requires.** `snapStacks` (2800) currently pushes
the record **and** bursts `4 + n * 2` particles in the closing family's colour with
`add` defaulting to 1. **The burst comes out of `snapStacks` entirely.** Three
findings converge on it: `crit-eng-ark` #4 (twenty glowing violet squares per body
break `-ark`'s one non-negotiable rule on the money frame, from a shared function
the design never mentions), `crit-eng-eat` #6 (`snapStacks` fires *after*
`famEffect`, so it is the thing the 900 cap silently truncates and the perf tables
were short by 160), and `crit-eng-ight` #3 (`-ight` was shipping both snaps and
twenty particles it had already budgeted away). Each family's `det` owns its own
snap matter, which it already emits, already budgets through `fxBudget` and already
colours correctly. `snapStacks` keeps the record push, the `foeH` fix and the
registry lookup, and gets four lines shorter.

**The tunables.** Twenty-two keys, appended below `2.9`'s punch block at the tail of
`TUNE`, each with one `num` row in the FEEL tab under a `{ k: 'note' }` divider per
family — the tab already has two dividers at 927 and 945, and five families at six
knobs each without them is unreadable (`crit-eng-ark` #14). `arkRim` is promoted to
**two** shared keys, `vfxRimGround` and `vfxRimBody`, because *the rims assume a
50-66% dim* is true of every family and it is two different numbers at two
different depths, always.

| key | default | what it moves |
|---|---|---|
| `eatBites` | 1 | notch scale. **0 is reachable**: the family becomes pure typography and holes (`crit-eng-eat` #16) |
| `eatMatter` | 1 | crumb count |
| `eatFed` | 1 | how lit you get when you eat |
| `ightShadow` | 1 | cast shadow length. 0 removes the family's primary readout, deliberately |
| `ightSpoke` | 1 | spoke length and edge alpha |
| `ightDark` | 1 | the pre-darken, on top of the `punch` option level |
| `erdClap` | 0.075 | the close, before `best` |
| `erdReach` | 40 | bar start distance, before `best` |
| `erdGag` | 4 | band height |
| `erdRule` | 0.5 | ground rule half-width per unit of `best` |
| `erdChips` | 3 | chips per syllable |
| `arkStain` | 1 | ground stain alpha and life |
| `arkCreep` | 1 | how fast the line climbs on the tick |
| `arkCloak` | 1 | the conceal rim and the hood |
| `arkKeep` | 24 | how many permanent outlines a room keeps |
| `illFreeze` | 1 | rime coat alphas |
| `illHold` | 0.12 | the execute hold, 0.04 to 0.40 |
| `illShard` | 6 | shard cell px at one execute |
| `illResidue` | 1 | motes per second, board-wide |
| `vfxRimGround` | 1 | every family's 1px edge on a ground shape |
| `vfxRimBody` | 1 | every family's 1px edge over a lit sprite |
| `vfxStatus` | 1 | all five status layers at once, for a low-spec look |

**New sound names**, all of them safe to ship before job 2 fills them in because
`sfx()` drops an unknown kind off the end of its chain with no throw. Every one
goes through `fxSfx` (2.2), so eight foes on one frame is one sound.

| name | family | what it wants to be |
|---|---|---|
| `eatmote` | eat | a soft tick per drain arrival, gate 0.03. Job 2 gets a run of two to four and can make a rising figure out of the tempo |
| `bare` | ight | the plate coming off. Metal, once, dry |
| `erdclap` | erd | **not a new instrument.** The 4ms wood transient that goes *in front of* `voxAnswer('erd')` (4172), which is already *"a full stop, it ends where it ends and there is no ring-out"*. Job 2 delays the existing 152Hz square to `CT` so the consonant and the vowel are one event. `erdtick` is cut |
| `erdgag` | erd | one soft closure when silence starts |
| `arkdeny` | ark | the Thief's hand going out and stopping |
| `illthaw` | ill | the shudder, on the frame `f.frozen` crosses zero |
| `illexec` | ill | the stop |
| `illshatter` | ill | the pieces, 0.12s after `illexec` |

`crit-eng-erd` N7 for the PR body: `erdclap` and `sfx('answer')` at 2651 always
play together on an `-erd` close, and job 2 needs to decide which of them ducks.

### 3.7 What the five families cost

The house split from 2.5 is **112 for the snap, 300 for the whole detonation
including the five families' own emission, 600 left for everything already in the
room.** Measured against it, after `fxW` thinning and with the snap burst removed:

| case | particles pushed | live peak | per-frame draw added |
|---|---|---|---|
| one `-eat` close, n=8, one foe | 38 | ~38 | 10 notch rects, 1 sil blit, 16 ring teeth, 1 clipped word |
| 8 foes x 8 stacks, `-eat` | 96 (`fxW(8) = 0.62`, `fxBudget` caps at 40/8) | ~180 with the trail | 80 rects, 8 blits, 128 teeth, 1 word, 4 motes |
| 8 x 8 `-ight` | 88 shards + 40 dust | ~150 | 8 quads + 8 clipped `fillText`, 24 bracket corners, 22 rim rects per body |
| 8 x 8 `-erd` | **0** (chips are not particles) | 0 | 176 chips as `fillRect`, 16 bars, 96 ground bars, 1 rule |
| 8 x 8 `-ark` | 64 motes | ~120 with the walk trail | 8 clipped blits + 128 column caps, 8 stains, 1 hollow word |
| 8 x 8 `-ill` | 96 motes, then 1/frame board-wide | ~140 | 8 ice blits (replacing 8 normal blits), 16 rime blits, 8 pools, 8 bars |
| 25-folk square, `-ill` | 50 (`fxW(25) = 0.34`) | ~90 | 25 ice blits behind `mayBuild`, 25 pools, **4** words |
| one execute, `X = 1` | 0 particles, 26 shards | 26 | 26 `drawImage`, no allocation after creation |
| six executes | 72 shards at a 10px cell | 72 | 2.4x one execute, not 6x |

**The three cases that were wrong in the source documents**, recorded so nobody
re-derives them: `-eat`'s 8x8 was published as 304 and the real figure including
`snapStacks` was 464 (`crit-eng-eat` #6); `-ight`'s Reprise case was uncounted at
1248 pushes inside 0.68s (`crit-eng-ight` #2); and `-ark`'s walk trail was
published at 3 a second and was 7.1 for the slowest hostile in the table and 14 for
a Quick thief (`crit-eng-ark` #8). All three are fixed by the same two mechanisms:
`fxBudget` divides before the loop, and `d.kind === 'beat'` halves a repeat.

**Bakes.** `foeSilSpr` is one 36x24-class canvas per kind per colour: five kinds x
three colours (`-eat`'s bite dark, `-ark`'s ink, `-ight`'s player rim) is fifteen,
about 60 KB. `icy` is one per foe **variant**, which is five archetypes plus up to
24 folk keys, behind `mayBuild()`. Against a `SPRITE_BUDGET` of 10 MB and one
`FLOORS` entry at 2.5 MB, the whole section is under 400 KB. `SPR` (1840) is a
different cache from `SPRITES` and `freeSprites()` (6529) does not touch it, which
is correct and deliberate: these are pure functions of their keys and they should
survive a doorway.

**Allocations added per frame: zero.** Every colour string in this section goes
through `partCol`, `fampx` or a module constant built in one of the five `*Boot`
functions. `EAT_N` is one scratch object written rather than allocated. The two
`measureText` calls are cached on their records. The only `toFixed` is inside font
strings that are built once at push time.

### 3.8 The distinctness audit

The test is `crit-art-ark`'s: **take the words out and show somebody the remaining
pixels.** For each family, what is left, and whether it could belong to another
game.

| family | with the words removed | could it be lifted? |
|---|---|---|
| **eat** | holes chewed through a body's own outline, a ring of teeth closing inward on the floor, crumbs and splinters falling and cooling and lying there | No. Every effect pack expands; this one closes and subtracts, and the holes are per-pixel accurate to the sprite |
| **ight** | one to six hard spokes out of a person, each ending in a body nailed to a long black quad with a line of verse written inside it, and the quads point away from a lit window | No. The shadow direction is authored off the town's own lamp list, and nothing else in the medium writes text inside a cast shadow |
| **erd** | bars closing in unison across the whole board, a flat block, a black bar, and the block cut away from both edges to nothing, plus a measured rule at your feet with one tick per body | No. It is a page being edited, at 0.33 seconds, with no round shape anywhere in it |
| **ark** | a shadow climbing a body from the ground, thickest where your lamp is not reaching, and a stain on the floor that is still there when you come back | Half. The stain is generic; the swing of the line as you walk around the body is not, and the permanence is not |
| **ill** | a person who has stopped, repaletted cold, with frost climbing from the ground up, a caesura bar beside their head, and a broken ring that closed instead of opening | No. Everything else stops *briefly*; this one holds, and the ring with gaps in it is `drawCuts` on the floor |

**Where two families still touch, and the ruling.**

| collision | ruling |
|---|---|
| `-ight` and `-ark` both use a light direction | Opposite lights, on purpose. `-ight` points away from **the nearest town lamp**, and falls back to you only in the hollow where there is none. `-ark` points away from **your lantern**, always, because he had the light. Walk into a lit lane and the two families point different ways |
| `-erd` and `-ill` both mean *it stopped* | `-erd` is mid-value marks **outside** the silhouette that the body still animates under until job 4's two lines land; `-ill` is the body itself, in the top third of the ramp, not animating at all. And `famStatus` gives a body to one of them per frame |
| `-eat` and `-ark` share `f.burn` | They are never both on: `f.burn` is one field and the second write replaces the first. `f.burn.fam` dispatches the tick, the ember colour and `FAM_ST`, so the ink runs off and the notches take over inside a quarter second |
| `-eat` and `-ill` both bake off the sprite rows | Same primitive, opposite use: `-eat` blits a **one-colour** mask to subtract value, `-ill` blits a **repalette** to replace it. One `foeSil`, two consumers, and the Sword's `noMask` flag protects both |
| three elite marks are exactly a family colour | `MODS.loud` = `-eat`, `MODS.quick` = `-erd`, `MODS.sealed` = `-ill`. Resolved three different ways and none of them edits `MODS`: `-eat`'s ring is teeth rather than an ellipse, `-erd`'s hue only ever appears on an axis-aligned bar, and `-ill` suppresses `drawMod` outright while frozen. `-ark` opts out by never being additive, and `2.7` blooms on `glow` rather than `col` |
| all five want the contact ellipse | One channel, three numbers, 3.0.6 A |

---

### 3.9 Ledger: every critique finding against the five families

Applied or refused with a reason. Nothing dropped.

**`crit-eng-eat.md`**

| # | finding | ruling |
|---|---|---|
| 1 | `FOE_SIL` initialised from `var`s that are `undefined`; first `-eat` close throws inside `draw()` | **APPLIED.** `foeSil()` is lazy and lives beside `FOE_H` at 3684 (3.0.3) |
| 2 | `famTrailPlain` does not exist; every non-`-eat` projectile throws every frame | **APPLIED.** `FAM_CALL.none` is a live seeded row (2.1a, 3.0.1) and the accumulator is `stepCalls`' own |
| 3 | `arkTick` does not exist; first `-ark` tick throws | **APPLIED.** `FAM_BURN` dispatch with the literal existing line as the `else` (3.0.6 C) |
| 4 | notches placed off `f.r * 22`, the hit radius, so they never touch the silhouette | **APPLIED.** `foeSil`'s per-row `lo`/`hi`, and every notch overhangs the real ink edge by 2px |
| 5 | side notches hang below the feet over the contact shadow | **APPLIED.** `o.y = Math.min(o.y, -o.h - 2)` |
| 6 | the `> 720` guard is per foe, not per detonation | **APPLIED.** `fxBudget` before the loop, and the snap burst is deleted so the pool is one pool |
| 7 | the Reprise fires it three times per foe in 0.68s and re-seeds the notches twice | **APPLIED.** `d.kind === 'beat'` halves the matter, skips the ring and the word, and does not re-seed |
| 8 | the drain is invisible at full health, and wrong per foe in a multi-foe close | **APPLIED.** Counted off `n`, flown always, the number suppressed rather than the effect |
| 9 | the 25-foe square is unreachable for `-eat` and the folk branches are dead code | **APPLIED.** Two-line guard kept, the perf case deleted |
| 10 | the `f.burn` attribution rationale is factually wrong | **APPLIED.** The field lands, the charm justification is deleted (3.0.6 C) |
| 11 | drone stacks have no `born`, so drone `-eat` pips get no bitten edge | **APPLIED.** `born: RT.t` at 3351 *and* the stack index as a fallback, so it does not depend on that landing |
| 12 | `RT.eatPulse` is a stray `RT` field | **APPLIED.** `fxOf('eat').fed` |
| 13 | five `drawXFx` at the world seam breaks one-call-per-job | **APPLIED.** `regFx`, one seam call, five `ord` rows |
| 14 | the mote is spliced before it is drawn at `u = 1` | **APPLIED.** Flagged, drawn once at `k = 1`, spliced the frame after |
| 15 | the notches heal to 2px and pop | **APPLIED.** `shut * shut`, no floor, reaches zero sub-pixel |
| 16 | `eatBites = 0` does not do what the table says | **APPLIED.** Early return after the silhouette dim |
| 17 | `EAT` chews to `EA`, and the impact word snaps back to full length | **APPLIED.** Chewed from the front, words under five never chew, and `landCall` takes `eatWord(c)` |
| 18 | `p2` and `open` shadow existing names | **APPLIED.** `evenPx` and `shut` |
| 19 | `SWORD_SPR` in `FOE_SIL` is dead and its mask would slide off under the tell rotate | **APPLIED.** `noMask: 1` and the comment, and `-ill` reads it |
| 20 | per-frame allocations named | **APPLIED.** `T()` hoisted above the notch loop, key strings cached on the `FOE_SIL` entry, the font built at push time, `measureText` cached on the record, `fig()` not rebuilt on a cache hit |
| 21 | things checked and unbroken | **NOTED.** No action; the `save`/`restore` balance and the no-dangling-`f` rule are restated in 3.0.2 |

**`crit-art-eat.md`**

| # | finding | ruling |
|---|---|---|
| 1 | the one image is invisible: `#120d18` is the Hearsay's own teeth-shadow, under the night wash, with the body dimming to the same value | **APPLIED, all three parts.** The notch breaks the outline, the fill is `#08060c`, and the rim cools to `EAT_CHAR` and holds rather than fading to zero |
| 2 | the notches are placed off the bounding box, the exact sin the design indicts | **APPLIED.** `lo`/`hi` at bake time |
| 3 | the consumer never grows | **APPLIED.** `fed` accumulates and decays over ~1.8s, driving the player's silhouette, lantern and contact ellipse |
| 4 | at full HP the best layer does not run | **APPLIED.** It runs; the arrival prints `full` at 11px in grey and drops two crumbs |
| 5 | countability saturates at n=3 and is driven by missing HP | **APPLIED.** Off `n`, cap kept, power moved into mote size and stagger tempo |
| 6 | nine copies of the word `EAT` in one frame | **APPLIED.** One word, on the body carrying `best`, latched off `d.i === 0` |
| 7 | the word erodes into nonsense, and once into `HE` | **APPLIED.** Chewed from the front. The rhyme is the last thing to go |
| 8 | `E` is not available; two pairs of families collide on first letters | **APPLIED.** E / I / *none* / K / L (3.0.4) |
| 9 | scaling is linear where the game already has a threshold at six | **APPLIED.** At `best >= 6` the word is eaten through with the body's own notches |
| 10 | the pile has no danger read and `EAT_ASH` is unused | **APPLIED.** `eatShed` lands with its hook, off the **plate**; `EAT_ASH` is deleted |
| 11 | the closing ring is the right shape in the wrong material, and collides with `MODS.loud` | **APPLIED.** A ring of teeth |
| 12 | the crumbs have no grain | **APPLIED.** One in four is a splinter, through 2.5's existing `sh: 1` rather than a new field |
| 13 | the family does not own its kills | **APPLIED.** `FAM_FIN.eat`: a char burst and the husk |
| 14 | the family owns the pip's life and abandons its death | **APPLIED.** `FAM_SOUR` |
| 15 | the chain of falling matter starts one link too late | **APPLIED.** `FAM_CALL.eat.cast`, three crumbs at the barrel |
| 16 | six missing fine details | **APPLIED:** the outer lip, the seeded bite column, the `+N` in the family's own type from the chest, the dark trailing pixel on the lead mote, and the stagger (through `d.i * d.stag`, which rides `detonate`'s outward sort and is better than the proposed distance-from-player because the ripple has a centre). **REFUSED:** the six-pixel floor decal held 3s — the husk already survives the body and two persistent floor marks in a family whose rule is *this family does not leave marks* is one too many |

**`crit-eng-ight.md`**

| # | finding | ruling |
|---|---|---|
| 1 | the whole persistent layer is under the night wash | **APPLIED.** Split by depth: quad and keylight in `drawFoe`, every 1px mark at `ord 44` over the wash |
| 2 | the Reprise fires it three times per foe; the shadow collapses and regrows three times | **APPLIED.** `d.kind === 'beat'` refreshes and nothing else fires |
| 3 | nothing removes `snapStacks`, so the family ships both snaps | **APPLIED.** `regSnap('ight', ightDrop)` replaces it, and the shared burst is deleted outright (3.6) |
| 4 | the pin bars shrink onto the body; they do not travel | **APPLIED.** Fixed length 14, moving position |
| 5 | the filament flicker lands on two 1px rules | **APPLIED.** `FAM_FADE` multiplies the shared `fade` |
| 6 | the pip's own shadow is ink on ink and then tinted flat | **APPLIED.** `destination-out` at 0.5, which cuts the plate and the tint together |
| 7 | `S.opts.punch` does not exist and the failure is silent | **APPLIED in 2.9.** `sLoad` default plus `punchLvI()` returning 2 for `null` |
| 8 | the peel and the mod plate draw on top of each other; the ghost never leaves | **APPLIED.** `drawMod` skips `plate` while `_peel`, and the 0.2 ghost is deleted |
| 9 | 25 revealed folk is 800 pushes in one frame for zero damage | **APPLIED.** `f.def.folk ? 0.25 : 1` on the matter, no cast shadow, no brackets |
| 10 | hooks 5, 6 and 8 reopen three blocks all five families edit | **APPLIED.** 3.0.1 |
| 11 | the pre-darken has no `save`/`restore` and breaks under the zoom | **APPLIED.** Own pair, `fullRect`, and it is a **screen** pass at `ord 30`, outside the zoom |
| 12 | `ightSeen` runs on corpses | **APPLIED.** `d.dead` gets the light and not the five seconds |
| 13 | the wedge starts at t=0, not t=0.030 | **APPLIED.** The spoke record carries `d` and the stepper counts it down before `t` |
| 14 | the peel pieces fall 210px through the floor | **APPLIED.** `Math.min(u * u * 210, p.h)` |
| 15 | `groundDir`'s single scratch is a loaded gun | **APPLIED by deletion.** The helper is cut; the spoke computes its own vertices |
| 16 | `side` and `near` use opposite conventions and the comment says otherwise | **APPLIED.** `playerSide(sx)` (3.0.3) |
| 17 | quantise the two per-foe alpha strings | **APPLIED.** `partCol` everywhere |
| 18 | two clocks, and the doc should say which | **APPLIED.** Stated per slot in the family's table |
| 19 | the Reprise gets no beam, no shutter, no pre-darken | **APPLIED.** A repeat beat still fires the spokes, at `d.pb`-scaled length, with no pre-darken. The family's biggest moment is no longer its least legible |
| 20 | the keylight covers three quarters of the Chorus | **APPLIED.** The rim walks `foeSil`'s rows; the boss falls back to its real 92px half-width |
| 21 | a stray code fence mid-listing | **NOTED.** Documentation defect in the source; this listing has none |
| 22 | `RT.chroma` looks like the hook and is not | **APPLIED in 2.7.** `chromaText` is the reader and the hard-coded pair at 1459 is gone |

**`crit-art-ight.md`**

| # | finding | ruling |
|---|---|---|
| 1 | the headline image lies about the headline mechanic; a centroid cone is the most generic shape in the vocabulary | **APPLIED.** One hard spoke per closed body |
| 2 | the primary readout is in the darkest layer | **APPLIED.** Split by depth, plus a 2px lit lip at the feet and a 1px outline on the outward edges: read the edge, not the fill |
| 3 | there is no typography in the detonation | **APPLIED.** `BALLAD[8].r` in 18px `VT323`, clipped to the shadow quad, rotated and squashed onto the ground plane |
| 4 | two contradictory shadows under one body | **APPLIED.** The contact ellipse is suppressed for the reveal, and the keylight is a 1px rim rather than a half-rect fill |
| 5 | the town is already full of warm lamplight | **APPLIED.** The projectile's ground pool is deleted; the hard little shadow survives on its own; the spokes carry on their edges |
| 6 | the lamp is pointed by the wrong person | **APPLIED.** `ightAim` points away from the nearest `lightsOf` entry and falls back to you |
| 7 | shards mean *it had cover* and are fired in both cases | **APPLIED.** Shards for armour, more dust for bare |
| 8 | brass is invented one value off the game's brass and collides with narration | **APPLIED.** `rgbMul('#c9a94a', 0.62)` body with a `#ffe66e` lit edge: the sprite palette's own `m`/`M` |
| 9 | the chroma pair paints `-ight` in `-ark`'s hue | **APPLIED in 2.7.** `FAM_CHROMA` is derived off `FAMS`: `-ight` splits into its own glow and its own dark |
| 10 | half the scaling is invisible | **APPLIED.** Alpha and travel channels cut, the count of shadows added |
| 11 | 25 hard black wedges pointing the same way is a hole in the floor | **APPLIED.** No cast shadow for folk |
| 12 | the pip slot and the row rule make a fat 2px double stroke | **APPLIED.** Slot rules inboard *and* suppressed at `lit >= 4`, which stages the escalation |
| 13 | the projectile passes and the detonation does not | **APPLIED:** motes seeded along the spoke axis, shards landing flat via `sh: 1`, two ground ticks at the feet, the actor's own shadow thrown back for 0.03s, and the quad's far vertices quantised to the 2px lattice. All five |
| 14 | the pre-darken stacks with three other darkenings | **APPLIED.** Darkens toward a level, clamped against `RT.dilate` and `place().night` |
| 15 | `SEEN` is a state label | **APPLIED.** `SEEN` / `BARE`, one ternary, `'pop'` not `'drift'` |

**`crit-eng-erd.md`**

| # | finding | ruling |
|---|---|---|
| B1 | `s.born \|\| RT.t` freezes every Droner `-erd` stack at 1px forever | **APPLIED.** `(b == null) ? 1 : ...` |
| B2 | `f._erdCut` is armed on tier 1 and never consumed, so a later interrupt loses its word | **APPLIED.** `if (tier > 1)` |
| B3 | the shake cap of 11 is defeated two lines later by `slam()` | **APPLIED in 2.7/2.8.** `punch()` takes the max and never sums; `FAM_PUNCH.erd.cut` stops it dead at 0.09s |
| B4 | Stanza I is `-erd`, so it fires four times per foe per recital with no dedup | **APPLIED.** The clap replaces per foe, and the gag's entry clock is only stamped when the gag is not already up |
| B5 | rule three is broken at the two call sites the design does not control | **APPLIED.** `word` rounds its own inputs; the band and brackets move out of the body transform entirely |
| B6 | `RT.hitstop` is undeclared and never decayed: a hard soft-lock | **APPLIED in 2.7.** One field, one writer, counted down on `real` in `stepPunch` |
| N1 | the clap plays over bare floor for anything the rhyme killed | **APPLIED.** `d.dead` skips beat 2 and shortens to the cut |
| N2 | `erdCounter` on a corpse pays hitstop for interrupting nothing | **APPLIED.** `if (!f.dead)` around the tier test |
| N3 | `-ill`'s freeze tint draws on top of the gag | **APPLIED.** `famStatus` order plus the band and brackets at `ord 46` |
| N4 | the thrown-open ring strokes at half a pixel under `scale(1, 0.5)` | **APPLIED.** Twelve tangential bars, no stroke at all |
| N5 | the chip cap starves the last foes: `part()`'s trap re-implemented | **APPLIED.** `fxBudget` |
| N6 | the chip decel is 5% wrong on the frame after a hitch | **APPLIED.** `Math.pow(0.0025, dt)`, one `pow` per frame |
| N7 | two detonation sounds on one keypress | **APPLIED.** `fxSfx`, and it is in the PR body for job 2 |
| N8 | three behaviours in prose and absent from the code | **APPLIED.** The despawn blink is one flag on the tick record, `erdgag` is called from `erdCommand`, and `s.drag` gets its one token at 2635 with the fallback documented |
| N9 | every family edits the same `TUNE` line | **APPLIED in 2.9.** The comma lands once |
| N10 | the Chorus gag is twice the rect count claimed, and the crowd guard counts bodies | **APPLIED.** The guard counts rects |

**`crit-art-erd.md`**

| # | finding | ruling |
|---|---|---|
| 1 | the sound fires 81-123ms before the clap | **APPLIED.** Fired from the stepper on the frame `cl.fired` flips |
| 2 | the `-erd` voice already exists and this invents a second | **APPLIED.** `erdclap` is the transient in front of `voxAnswer('erd')`; `erdtick` is cut |
| 3 | the 81ms of silence does not exist | **APPLIED by construction.** The detonation's shared timeline fires the punch and the slam at `TSET`, not on the keypress (2.10) |
| 4 | the shake cap is defeated by `slam` | **APPLIED in 2.7** |
| 5 | the clap is 44% too narrow on the Chorus | **APPLIED.** `f.def.boss ? 92 : round(f.r * 24)` and `? 100 :` on the gag |
| 6 | silencing the Chorus is the thesis of the game and gets the default clap | **APPLIED.** Tier 3: 22 mouth bars on `drawChorus`' own ring geometry, `AND HE WENT ALONE` struck out, and the restraint lifted |
| 7 | the empty pip has a much better reason than the one given | **APPLIED.** The hole in the song, and the interior is covered rather than blank |
| 8 | nothing in this family is countable | **APPLIED, all three.** Segmented bars, a tick per body on the ground rule, and the last segment left empty at `stackMax` |
| 9 | "alpha is 1 or it is 0" is false | **APPLIED.** Restated as *no alpha in this family ever animates*, in the header comment |
| 10 | `ERD_INK` buys nothing at `#0b1512` | **APPLIED.** `rgbMul(FAMS.erd.col, 0.10)`: committed, and derived rather than authored |
| 11 | `ERD_LIT` is already this game's colour for a restored true line | **APPLIED.** *The lit edges are what survives the redaction*, in the header |
| 12 | it has become a desk, not a town | **APPLIED.** The header opens with *you are casting the town's crime*, and the caret lands |
| 13 | no ground contact at the target | **APPLIED.** Twelve tangential bars at the target's feet |
| 14 | eight claps at once is a picket fence | **APPLIED.** `CT` and `D` derived once per rhyme from `d.pb`; `RA`, `RH`, chips and the redaction stay per foe |
| 15 | the dashed trail's pitch doubles depending on your aim | **APPLIED.** Screen distance, 12px |
| 16 | the sour has no image | **APPLIED.** The two bars merge and are cut from both edges: the success and the failure are the same picture at two scales |
| 17 | the tier 1 counter throws a round ring in the family that banned round | **APPLIED.** Twelve bars |
| 18 | `drawAssembly` is untouched and is the largest `-erd` typography in the game | **APPLIED in part.** `FAM_LINE.erd`: `shadowBlur 0`, a hard shadow, and the rule drawn to the ground rule's profile. **REFUSED:** words clipped in from the left. That is the flyer path, one easing shared by five families, and five easings inside the one function that must never fork is not worth a difference nobody sees in 0.1s |
| 19 | the clap has no anticipation frame | **APPLIED.** 0.02s held at full start position |
| 20 | the gag is 3.6s of a picture that never changes | **APPLIED.** One two-frame blink at exactly 1.0s remaining |
| 21 | the Hearsay keeps chewing under the gag | **APPLIED.** `gape = !(f.silence > 0) && (...)`, and the Droner's halo is skipped |
| 22 | a drag gets the family's authority mark for free | **APPLIED.** Terminals only, no body, no clap, no chips |

**`crit-eng-ark.md`**

| # | finding | ruling |
|---|---|---|
| 1 | the per-foe timeline has no owner and the design puts it in `draw` | **APPLIED.** `stepArk` through `regFx`; `FAM_ST` is pure and mutates nothing (3.0.2) |
| 2 | `f.burn.fam` does not exist, so the drain never fires and every `-eat` burn renders the `-ark` ink | **APPLIED.** 3.0.6 C, both literals and the tick, in one commit |
| 3 | the screen ink dims the detonation word | **APPLIED.** The word is a **screen** registration at `ord 48`, after `drawBloom`; the dim is `FAM_BLOOM.ark.dark` and no longer a fill this family owns |
| 4 | `snapStacks` fires an additive violet burst on every `-ark` foe | **APPLIED.** The burst leaves `snapStacks` entirely (3.6) |
| 5 | `multiply` over the sprite box is a dark rectangle, not a silhouette | **APPLIED.** A baked ink twin through `foeSilSpr`, clipped to the waterline with `rect`/`clip`, with the Chorus and the Droner falling back to the box form |
| 6 | the white hit flash covers the first 90ms | **APPLIED.** 3.0.6 B inserts after 3515 |
| 7 | the ground layer has no seam, no reset and no cap | **APPLIED.** `regFx` at `ord 48`, `make()` **is** the reset, `fxPush` is the cap |
| 8 | the walk-trail rate is wrong by 3x and blows the budget | **APPLIED.** An interval with a distance gate: 3.6/s at any speed |
| 9 | overlapping `multiply` drives the floor to literal black | **APPLIED.** Ground shapes are `source-over` in `ARK_DEEP` |
| 10 | `c.dripT` is never initialised, so the trail silently never fires | **APPLIED.** No new field: the shared `c.et` accumulator at `fly.rate` |
| 11 | re-casting inside a conceal snaps the hood open | **APPLIED.** An own-accumulator rise that cannot jump backwards, and the two clocks are stated |
| 12 | the conceal ring draws mirrored under `scale(west, 1)` and rides the idle bob | **MOOT and APPLIED.** The pie chart is deleted (art #11); the line that replaces it is drawn outside the actor transform off raw `sx`/`sy` |
| 13 | the lantern hood is invisible where the design puts it | **APPLIED.** After 2139, in its own `save`/`restore` |
| 14 | six tunables, zero FEEL rows, and `arkRim` should be shared | **APPLIED.** Rows plus a `note` divider per family, and `arkRim` becomes `vfxRimGround` / `vfxRimBody` (3.6) |
| 15 | no smoothstep, no hash, and `f.anim` is not a seed | **APPLIED.** `frac()` in 3.0.3 and a stamped integer seed |
| 16 | `typo()` cannot carry the `-ark` word | **MOOT.** The word does not go through `typo()`; it is the family's own screen record, so the 60-entry cap is not touched either |
| 17 | "`#0d0916` darker than the backdrop" is false | **APPLIED.** Wording: darker than the floor bitmap, which is what the effect needs |
| 18 | non-additive 2px particles may not read at all | **APPLIED.** Size floor 2.6, and one drip in four is an additive rim bead so the material never reads as a rendering fault |
| 19 | the 25-body square cannot happen for `-ark` | **APPLIED.** The folk guard is kept as free insurance and the budget is re-anchored on `speakDraws` 2-4 and the mill's authored wave of about 6 |
| 20 | the full-screen ink sits inside the shake | **MOOT.** The dim is `drawBloom`'s `fullRect` (2.7) |
| 21 | composite hygiene, said once | **APPLIED.** Every `-ark` block is `save`/`restore` wrapped, and `globalAlpha` and `textAlign` are reset on the way out |
| 22 | shrinking the floor pool means moving two numbers | **APPLIED.** The gradient radius, the arc at 2147, and `k` clamped so the inner stop never exceeds the outer |
| 23 | `arkdeny` is a new sound name | **APPLIED.** In the table in 3.6 |
| 24 | the pip drip hangs into the row below and crosses a shorter row's plate | **MOOT.** The drip is deleted; the clock is in the glyph |
| 25 | `drawStacks` is edited by all five family designs | **APPLIED.** 3.0.1 |

**`crit-art-ark.md`**

| # | finding | ruling |
|---|---|---|
| E1 | the no-glow rule is the best single rule anybody wrote | **KEPT, and everyone is held to it.** No `-ark` surface is additive except the 1px rim |
| E2 | the cut-out word | **KEPT verbatim**, and extended to `stark` and `spark` |
| E3 | conceal collapsing the existing lantern gradient | **KEPT** |
| 1 | the one image is two, and the second one is generic purple ooze | **APPLIED.** The liquid is deleted. The rising line is a cast shadow, it is thrown by the lantern, and the column tops lift toward it |
| 2 | matter has eaten typography roughly nine to one | **APPLIED.** The detonation's primary object is a word and it is the family's biggest |
| 3 | the scratched-out name is unused and is this family's signature | **APPLIED.** The stack row is un-printed tag by tag: the only detonation whose verb is deletion |
| 4 | fifteen violets in a palette headed "closed, five values" | **APPLIED.** Four derived values, and the pallor is cut outright rather than replaced |
| 5 | `multiply` on an already-multiplied floor, and one knob for eight surfaces | **APPLIED.** The rim is the read, the fill drops a third, and the knob splits in two |
| 6 | the centrepiece claim is false in the draw order the design cites | **APPLIED.** A screen registration; and the family writes its own slam sub |
| 7 | a shadow family's answer to *make it punchy* is a darker screen | **APPLIED (a) and (c)** through 2.7's additive core and `FAM_PUNCH.ark`. **(b) REFUSED:** a dim that wipes in from the four edges is a second authored vignette on a frame where `drawVignette` is already narrowing onto the blast |
| 8 | legibility at 25 bodies fails and the design calls it a success | **APPLIED.** The ground stain is gated on `n >= 2`, and the dim is sized by `best` through a single `d.i === 0` punch |
| 9 | the detonation word is the smallest of the five and is the only light in its own effect | **APPLIED.** The biggest of the five, and hollow: `strokeText`, which nothing else in 8279 lines does |
| 10 | "it never goes back down" is broken after five seconds | **APPLIED.** One permanent stain per rot-kill, in a ring of 24 cleared only by travel |
| 11 | the conceal ring is a World of Warcraft cooldown swirl | **APPLIED.** The ring is the line, set in 8px around the circle, erasing from the end backwards |
| 12 | cloaking the player is self-inflicted blindness | **APPLIED.** Rimmed, not multiplied |
| 13 | the waterline is five 18px steps and will shimmer for eight seconds | **APPLIED.** One 2px column per sprite column with a 1px cap, all integer, and every ground centre rounded |
| 14 | the pip drip is good information where nobody can see it | **APPLIED.** The clock is in the glyph |
| 15 | the slant is unaddressed and is the most `-ark` mechanic in the game | **APPLIED in part.** A dragged tag leaves a 1px violet trail on the plate for 0.25s. **REFUSED:** the one-cell slide, which is the haul's animation at `ord 86` and cannot have two authors moving the same glyph on the same frame |
| 16 | the sour path gets nothing, in the family whose fiction is a thing left unanswered | **APPLIED.** A 1px tally scratched into the sprite box for the life of the body, up to five |
| 17 | seven named fine details | **APPLIED:** `spark`'s one-frame rim, `stark`'s flat cut-out, `mark`'s despawn scratch, the shadow that detaches and does not come back, the rot shedding the body's own coat colour, the Chorus paragraph, and the `-ark`+`-ill` ruling through `famStatus` |
| 18 | the ground layer is at an illegal seam with no travel reset | **APPLIED.** `regFx`, `ord 48`, and 2.2's one shared `onPlaceChange` |

**`crit-eng-ill.md`**

| # | finding | ruling |
|---|---|---|
| 1 | `coldPal` cannot read five of twenty palette keys and greys them | **APPLIED.** `palRgb`, a two-form parser |
| 2 | the execute fires on foes that are already dead: every `-ill` kill becomes an execute | **APPLIED.** `!f.dead && f.hp > 0 && ...`, and it fixes a live bug |
| 3 | nothing draws a dead foe, and the world seam draws over every body | **APPLIED.** The hold and shard record goes into `ents` at `k = x + y` |
| 4 | "the pips go out" cannot work: the row has reflowed before `draw` | **APPLIED.** `g.pip = { n: n, t: 0.05 }` captured in the detonation, in seconds |
| 5 | no effect array is named, parked or reset | **APPLIED.** `regFx` + `make()` |
| 6 | the clock the family is named for is not the clock the code gets | **APPLIED.** Matter on sim, typography on real, stated in the family header |
| 7 | `f.frozenM` is undefined on the only path that exists, and `globalAlpha = NaN` is silently ignored | **APPLIED.** Written at 2838, defaulted at 3009, and still read as `(f.frozenM \|\| f.frozen \|\| 1)` |
| 8 | the rime cannot be blitted from `drawFoe`; three drawers have their own offsets | **APPLIED DIFFERENTLY, and better.** The ice **replaces** the drawer at 3511 rather than overlaying it: one edit instead of six, no offset to reproduce, and the held pose comes free because a bitmap cannot animate. `foeSil`'s `dx` covers the remaining cases and the Sword is `noMask` |
| 9 | the Chorus has no sprite and can be frozen | **APPLIED.** `icy()` returns null on no rows and the fallback tint runs, gated on the drawer and not on `f.def.boss` |
| 10 | "two frames" and "one frame" are frame-rate dependent | **APPLIED.** 0.03s and 0.05s on record timers |
| 11 | four `TUNE` keys, `RT.hitstop` and `punchKick` do not exist | **APPLIED.** The keys land with their FEEL rows (3.6); the hold and the kick are `punch()` |
| 12 | `X` is not available where the design spends it | **APPLIED.** Resolved after the loop; 2.10 already hoists the `kill` punch |
| 13 | the 0.18-alpha miss word draws as a black smear | **APPLIED.** It does not go through `typo()` |
| 14 | `getImageData` for occupancy is a stall and unnecessary | **APPLIED.** `foeSil`'s `lo`/`hi`, computed from the row strings at first use |
| 15 | the a3 square bakes 60-75 sprites in one frame | **APPLIED.** Behind `mayBuild()` with the flat tint as the one-frame fallback, and `.ice2` skipped for folk |
| 16 | `SPR` is unbounded and `close()` does not free it | **ACCEPTED and recorded.** Lazy baking caps it at the variants that actually freeze; `SPR` surviving `close()` is deliberate (1809) and these keys are pure functions of their inputs |
| 17 | the shard anchor must reconstruct `blit`'s rounding | **APPLIED.** `silX` / `silY` |
| 18 | the sour drop cannot be placed in its own cell horizontally | **APPLIED.** The `x + d` / `y - d` identity, no new particle field |
| 19 | the ghost tail needs the call's start life | **APPLIED.** `max` on the call literal, one token, shared with `-eat`'s chew |
| 20 | fix the 144Hz over-emission while you are in there | **APPLIED for all five.** The shared `c.et` accumulator in `stepCalls` |
| 21 | five factual corrections | **APPLIED.** Three non-additive bursts not one; `DEAF_SPR` yields ~36 cells; `SWORD_SPR` fewer than 25 and `norhyme` besides; `DRONER_SPR`'s bell is bare under coat 1 and caught by coat 2; the Deaf's face bar is a `fillRect` at 3710 |
| 22 | hygiene the new drawers must match | **APPLIED.** `textAlign` reset inside the save, `globalAlpha` set explicitly by anything drawn inside `drawStacks`' loop, no additive blit without its own restore, and the ground pool applies its own 1:0.5 squash rather than inheriting `pop` |
| 23 | put the thaw crossing in `stepFoes`, not `drawFoe` | **APPLIED.** One latched compare at 3060 |
| 24 | five families are about to edit the same five functions | **APPLIED.** 3.0.1 |
| 25 | sound names for the PR body | **APPLIED.** 3.6 |

**`crit-art-ill.md`**

| # | finding | ruling |
|---|---|---|
| 1 | the family is an element, and this is her sound | **APPLIED.** The player's own lamp dips on cast and stays down while anything is frozen, and the ground mark is a pool of lamplight with the lamp taken out of it |
| 2 | the hexagon is the most generic object here and breaks ground doctrine | **APPLIED.** Deleted everywhere. Three arcs with 2px gaps, and the gaps stay put as it closes |
| 3 | the word is the dimmest thing in its own detonation | **APPLIED.** `STILL` in `ILL_RIME`, everything else held at or below `FAMS.ill.col` for the first 0.15s |
| 4 | the execute prints `STILL` over the best fiction in the document | **APPLIED.** The execute prints nothing. The foe's own line finishes |
| 5 | the caesura is used once and it is the family's actual mark | **APPLIED.** A 2px vertical bar beside the head for the whole freeze |
| 6 | `-erd` and `-ill` both mean *it stopped*, and `MODS.sealed` is exactly `-ill` blue | **APPLIED.** Value and stillness, not hue; `drawMod` does not draw while frozen |
| 7 | `ILL_DEEP` is a sixth dark, it is blue, and its stated purpose is false | **APPLIED.** Deleted |
| 8 | `ILL_WHITE` is pure white in practice and measured in frames | **APPLIED.** Deleted; the halo is `source-over` at 0.55 in `ILL_RIME` on a 0.03s real timer |
| 9 | the ground disc is under the night veil and at n=1 does not exist | **APPLIED.** It is at `ord 50`, over the wash, and the alphas are authored post-veil. It draws over the legs of whatever stands on it, which is accepted: the alternative is invisible |
| 10 | rime coat 1 at alpha 1 is the white blob the design says it is avoiding | **APPLIED.** Coat 1 caps at 0.55, coat 2 runs to 0.85, and both grow bottom-up through a climbing clip rect |
| 11 | the pip has four states and three cannot be seen | **APPLIED.** One solid cell draining from the top |
| 12 | the detail budget is inverted against frequency | **APPLIED.** The ghosts lose a letter each: `STILL` / `TILL` / `ILL` / `LL` |
| 13 | the projectile halo loses the read | **APPLIED.** Eight 2x2 rects at radius 11, plus a 0.10 disc so it is findable |
| 14 | section 0 contradicts sections 4 and 6 | **APPLIED.** Matter on sim, typography on real, and it is a better sentence than the original |
| 15 | the shards are in screen space and will slide when the camera moves | **APPLIED.** Tiles and `z`, converted at draw |
| 16 | the grind-out will flicker, and nothing tumbles | **APPLIED.** Snapped to 6/4/2, coordinates rounded, and four flips via negative scale |
| 17 | nothing here is board-wide and the climax is twenty-five of everything | **APPLIED.** Four words at most, bakes behind `mayBuild`, and one `STILL` in screen space over the square through `FAM_LINE.ill` |
| 18 | the residue is the only persistent per-foe emitter in the game | **APPLIED.** Round-robin, one mote per frame board-wide |
| 19 | motes at fractional coordinates are not dry specks | **APPLIED.** The `sh === 2` arm of `drawPartPass` rounds. **REFUSED:** a private draw path for `add: 0` particles, which is a second particle loop for one family and is the thing 2.5 exists to delete |
| 20 | shattering a townsperson is a decision the document does not make | **APPLIED.** Folk do not shatter. They stop, the frost climbs, the line finishes, and they stay standing |
| 21 | half the scaling ramps are imperceptible | **APPLIED.** The word-hold ramp and the binary rim gate are dropped, the rim is continuous, and one countable 1px frost spur is added per closed stack |
| 22 | six small things | **APPLIED:** the typo is fixed in this text, the sour picks the motes and drops the alternative, the contact shadow tightens and darkens, the drop shadow offsets **up** for this family alone, and two motes per batch hang instead of falling. **REFUSED:** breath refilling visibly faster while the board is frozen. It is a good idea and it is a **mechanics** readout, not a magic visual; it belongs to whoever owns the breath meter, and a family reaching into the HUD to reward a state it caused is the kind of cross-cutting edit this whole document exists to prevent |

---

**Section 3 ends here.** Twenty-five slots, five families, one registration each,
twelve shared edits, and one hundred and seventy-nine critique findings ruled. The
detonation these five plug into is §4; the two numbers every one of them reads off
it are `d.sc` and `d.pb`, which `crit-eng-deton` N1 correctly noted were computed
and read by nothing, and which are now the size and the intensity of every gesture
that belongs to a whole detonation rather than to one body.

---

## 4. THE DETONATION, AND THE WORD THAT GETS THERE

This section owns everything between the key going down and the room going quiet:
the projectile that plants a syllable, the row that holds it, the sour that bills
you for it, and the detonation that spends the lot. Six design files and four
critiques went into it. Where they disagreed the ruling is in the text at the
point of disagreement and again in the ledger at 4.16.

### 4.0 The shape of it, and the one thing every layer now shares

**One detonation has two zeroes.**

- **`T0`**, the press. `doRhyme` resolves, damage lands, `detonate()` runs, every
  `FAM_DET` fires, the row tears, the syllables come off the bodies. The screen
  gets a `tap` and nothing else. Nothing on screen is brighter than it was.
- **`TSET`**, the landing. The words set, the rule strikes, `slam()` prints,
  `punch()` hits, the room goes down, the bracket closes. `TSET = 0.035 + FLY`,
  which is 121ms after the press at one syllable and 225ms at twelve.

That gap is the thesis in time: **it converges, then it expands.** Everything
between the two zeroes moves inward. `slam()` is called on the frame of the
keypress in the file today and carries `shake(9)` with it, so the room takes the
hit 150 to 225ms before the picture that earns it exists. **Moving that call to
`TSET` is the single most valuable change in this document.**

**Three clocks, and 2.2 already chose them.** Typography on `real` (`stepDet`,
`stepStz`, `stepVrs`, the row, the call words); matter on `dt` (every family
stepper, `stepParts`, the crowd's chips); `RT.t` for nothing but seeded noise and
the repeat gate. Matter freezes. Letters do not.

**One record, one scalar.** `RT.det` is a single object and `d.t` is real seconds
since the press. Every position, alpha, length and colour below is a pure function
of `d.t` and of numbers frozen onto `d` at `T0`. Nothing integrates a velocity,
nothing decays toward a target, no drawer ages anything. That is not tidiness: it
is what makes a record safe to draw twice, at `dt = 0`, through a hitstop, while
dead, and in `devDemo`'s bare `draw()` calls at 8143. `stepDet` is the only thing
in the whole section that mutates a detonation.

**`RT.det` is replaced, never queued.** `RT.answerCd` is 0.34 and a big close runs
0.83, so a player at the cooldown floor cuts the old line off mid-lift. Correct:
two lines at once is two events.

#### 4.0.1 The rhyme, on screen, at last

`crit-art-deton` #1 and `crit-art-proj` #2 are the same finding arrived at from
two ends, and between them they are the largest hole in the overhaul:

> The game is about rhyme. Six files describe a line of words, a bar under it, a
> bracket beside it and a tag word over it, and at no point does anything on
> screen show two sounds being the same sound.

It is sitting in the data. `FAMS.eat.words` is `['eat','street','heat','wheat']`
and every one of them ends in `FAMS.eat.tag`. So **every word this overhaul draws
is drawn in two tones: the head in the family's `col`, the rhyming tail in its
`glow`.** `WHEAT` leaves the mouth as a dim `WH` and a bright `EAT`. It lands as a
dim `WH` and a bright `EAT`. The `EAT` is what sticks to the body. The line at
`TSET` prints `STREET WHEAT HEAT` with three bright `EAT`s aligned on one
baseline, and the rhyme becomes **a repeated shape across the line**, which is
what a rhyme is.

This also disposes of `crit-art-deton` #15, the rainbow: the heads carry each
word's family hue at its lower value and only the tails are bright, so a six-word
mixed line reads as one line with marked endings rather than six competing
colours.

```js
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
```

`P` is `fampx()[fam]` from 2.4 and gains one key so a drawer holding a paint row
can still name its family: `FAMPX[id].id = id` inside `fampx()`'s loop.

#### 4.0.2 One measured number, and every width comes off it

`Press Start 2P` is a fixed pitch font. Every width this section needs — the fit
loop, the two halves of a word, the pip cell, the flyer, the impact word, the
falling half of a sour chip — is `characters * px * PSA`. So **one** advance ratio
is measured, with the re-measure guard `crit-eng-proj` #9 correctly says was
promised and never written, and nothing in the overhaul calls `measureText` in a
loop again. It also corrects `crit-eng-deton` N4: the fit loop's "up to 30
`TextMetrics`" was really up to 84, and is now zero.

```js
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
```

Called from the top of `drawFx`, once a frame, before anything in this section
draws. `PSA` and `RIME` are pure functions of their inputs and deliberately
survive `close()`, in the same class as `PCOL` and `FAMPX` (2.2).

#### 4.0.3 The board is addressed before it answers

`crit-art-proj` #18. RHYME says a sound to the whole board at once, and there has
never been a frame in which the board has heard you and not yet answered, which is
the game's entire subject. It is also the beat `T0` was short of.

`doRhyme` sets `RT.said = { fam: fam, t: 0.05 }` on its first line, before any
resolution. For fifty real milliseconds every cell of that sound on the board is
struck to `#e8e2ee` and every cell that is not that sound drops its plate alpha by
0.2. Everything of the sound leans in and everything else looks away. One field,
two branches in the row drawer, and it is free at twenty-five bodies because the
row drawer is already walking every cell.

---

### 4.1 `detonate`, the outcomes, and the repeat gate

```js
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
   RT.dilate the beats stretch and the window has to stretch with them
   or the gate quietly stops gating.
   Player actions are never gated. A close 0.34s after a close is the
   player getting a second pile up and spending it, which is the best
   thing that happens in this game. */
var DET_AGAIN = 0.5;                 // sim seconds
var DET_AGAIN_TH = 0.18;             // what a repeat may emit, as a share of th
var DET_AUTO = { rep1: 1, rep2: 1, rep3: 1, wave: 1, verse: 1 };
```

**The contract, and every family gets it free:** `d.again` means *the matter is
already on this body*. Refresh your timer and return. Do not push, do not seed, do
not play a sound, and above all do not reset an age — `crit-eng-ight` #3 found
`f._seenMax = 5` re-running three times inside a Reprise and collapsing the shadow
twice, which reads as a bug because it is one.

```js
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
        if (det) det(h.f, h.n, d);
    }
    /* Put every per hit field back. Four of them are otherwise left
       holding the last source's values, and a family stepper that
       reads d.th one frame later gets 0.18 on a repeat and draws
       almost nothing (crit-eng-deton B15, design-deton-6 risk 3).
       `d` is read-only to families and this is the line that makes
       that promise true. */
    d.i = 0; d.th = d.th0; d.dead = 0; d.folk = 0; d.again = 0;
    return d;
}
```

**`d`, restated, because five branches write against it.** `d.p` the one screen
event. `d.pb` per-foe intensity that must saturate: alpha, brightness. `d.sc`
per-foe **size**: multiply a radius or a font size by it and nothing else. `d.th`
multiply every emission count by it, then floor at 1. `d.total`, `d.best`,
`d.wide` raw, for thresholds and counts only, never geometry. `d.i`, `d.dead`,
`d.folk`, `d.again` mean *this hit* and are valid only inside your own `FAM_DET`
call. **Do not retain `d` and do not write to it.** `d.sc` and `d.pb` are read by
the five family blocks in §3 and by nothing in this section, which is why
`crit-eng-deton` N1 found them computed and unread: they are the documented
interface and they stay.

---

### 4.2 The gather: the line, the segments, the flyers

Three populations leave the bodies at `T0` and they all start **on** them: the
tear is the row lifting off, the flyers are the syllables, the words are the line.
Today the words start at `((i * 97) % 13) / 13` (2698), a hash-derived cloud in
screen space that has never seen an enemy, inside a function whose own comment
says the whole idea of the game is scattered words becoming a line.

#### 4.2.1 Which body said which word

`crit-art-deton` #2 is right and it is unanswerable: `i % wide` is round robin, so
with six words and two foes the words alternate, and with twenty-five sources
nineteen bodies contribute no word at all. It replaced a hash-derived scatter with
a modulo-derived scatter and called it truth.

The real mapping is one field away. `landCall` (2442) has the word in scope as
`c.word` and calls `addStack(f, c.fam)`, which pushes `{ fam, t, max, born }`.
**`addStack(f, fam, word)` stores `w`**, `doRhyme`'s `cells` copy carries it onto
the hit, and `detGather` matches each poem word to the body whose spent cells
actually hold that word. `STREET` then genuinely leaves the Mouth you said
`STREET` at.

The fallback is `i % wide` and it is reached honestly: the Droner's self-write at
3351 plants a stack with no word, and soft wax spends sounds that were never said
at that body. Both are cases where no body said it, and round robin is the right
answer to a question with no answer.

#### 4.2.2 `assembleLine`

```js
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
```

#### 4.2.3 The rule is made of the bodies: `detSegs`

`crit-art-deton` #4 and #5, merged into one object, because they are the same
idea and doing them separately would cost twice as much and read as less.

> Forty-eight flyers aimed at one pixel is a blob, and it covers the rule it is
> supposed to be building. The rule is a bar; it should be the object that carries
> `total`, `wide` and `best` on the last frame, and it carries none of them.

So the rule is **`wide` abutting segments with 1px gaps, laid out left to right in
the sources' own screen order, each one as long as that body's share of the pile**,
and **a flyer flies to its own body's segment**, not to the centre. Then:

- **`wide` is countable.** Twenty-five people heard you and there are twenty-five
  pieces of rule. One person heard you and it is one solid stroke.
- **`best` is visible.** The longest piece is obvious.
- **The arrivals spread along the whole width** instead of piling into a 40px
  circle under the words on the exact frames the words are setting.
- **The thesis is literal.** The line under the words is physically made of the
  bodies it came from, in the order they were standing in.

```js
/* THE SEGMENTS. Called at the end of detGather and again by any post
   dressing that moves rule.half (repDress, dressStanza), because the
   layout is a pure function of half and of the hits' own n.
   Order along the rule is SCREEN X, so the leftmost body owns the
   leftmost piece and a kill upright stands over the place its body
   stood. detonate's own sort is centre-outward and stays that way: one
   is timing, the other is space, and they are different questions. */
function detSegs(d, hits) {
    var i, n = d.wide, ord = [], seg = [], run, tot = Math.max(1, d.total);
    var full = d.rule.half * 2, gaps = (n - 1), body = Math.max(n * 6, full - gaps);
    for (i = 0; i < n; i++) ord.push({ i: i, sx: isoX(hits[i].f.x, hits[i].f.y), n: hits[i].n });
    ord.sort(function (a, b) { return a.sx - b.sx; });
    run = Math.round(VW / 2 - full / 2);
    for (i = 0; i < n; i++) {
        var w = Math.max(6, Math.round(body * ord[i].n / tot));
        seg[ord[i].i] = { x: run, w: w, mid: run + Math.round(w / 2),
                          n: ord[i].n, got: 0, kill: 0 };
        run += w + 1;
    }
    d.seg = seg;
    /* the true right edge after rounding, so the end cap, the couplet
       bracket and the notches all agree with the pixels rather than
       with the arithmetic. */
    d.segR = run - 1;
    d.segL = Math.round(VW / 2 - full / 2);
}
```

#### 4.2.4 `detGather`

```js
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
```

#### 4.2.5 One flyer, one word

```js
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
       target that moves is a slot that moves. */
    var over = d.K.miss ? 0 : Math.round(2 + 5 * d.p);
    var x0 = isoX(w.wx, w.wy), y0 = isoY(w.wx, w.wy) + TILE_H / 2 - w.wh;
    var my = w.low ? (isoY(d.x, d.y) + TILE_H / 2 + 10) : (y0 + d.lineY) / 2 + w.arc;
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
```

**One factoring, so the segments can be re-laid without `hits`.** The Reprise and
the recital both move `d.rule.half` after `detonate` has returned and `hits` has
gone out of scope. The x assignment in 4.2.3 is therefore its own function, and
`detSegs` ends by calling it:

```js
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
    d.segR = run - 1;
}
```

and `detSegs` becomes: build `seg[i] = { o: rank, n: hits[i].n, got: 0, kill: 0,
perN: 0 }`, count `perN` by walking `d.fl` once (`seg[d.fl[j].hi].perN++`), then
`detSegLay(d)`.

---

### 4.3 The clock, the frame the room takes it, and the four pure readers

```js
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
       anchor are about where it happened. */
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
        slam(word, col, sub, { fam: K.lit ? d.fam : null, power: pw, kind: K.punch,
                               x: d.x, y: VH * 0.62, bx: VW / 2, by: d.lineY + 6,
                               flat: 0.28 });
        fxSfx(d.kind === 'close' ? 'answer' : 'slant', 0.10);
    } else {
        punch(bag);                       // the wave, the Reprise and the Verse slam elsewhere
    }
    fxSfx('rule', 0.06);
    if (d.cpl) fxSfx('bracket', 0.20);
    if (d.K.brk) fxSfx('crack', 0.10);
}
```

**One collision in that bag, written out because it is the kind of thing a reviewer
skims past.** `punch()` reads `o.x`/`o.y` as **world tiles** for the shake direction while
`slam()` reads `o.y` as a **screen pixel** for its own anchor. That collision is
real and it is resolved in `slam`'s favour, because `punch` already ignores a
non-finite or out-of-range anchor and clamps into the camera dead zone, and
because the detonation's shake direction is carried by `bx/by` anyway. `slam`
passes the bag straight through to `punch`, so one object, one allocation, and the
screen anchor wins. `detFire` therefore passes `x: d.x` and **omits `y`** from the
punch-only path and sets `y: VH * 0.62` only on the slam path.

#### The four pure readers

Everything drawn in 4.4 comes out of these. They take `d` and the clock and return
a picture; they hold nothing and change nothing, so calling one twice in a frame is
free and calling one at `dt = 0` gives the same answer.

```js
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
    var y0 = punchWY(isoY(r.wx, r.wy) + TILE_H / 2 - r.wh);
    var mx = (x0 + tx) / 2;
    var my = r.low ? (isoY(d.x, d.y) + TILE_H / 2 + 10) : (y0 + ty) / 2 + (r.arc || 0);
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
```

**The caesura.** The last pixel of every detonation is one 2px mark in the middle
of where the rule was, which is the same mark `drawCuts` puts on a swallowed word:
the file's own vocabulary saying it is finished with the line. It is punctuation,
it is flat at every power, and it is the best ending in the six files.

---

### 4.4 The five drawers

Neither world drawer ages anything and neither takes a `dt`. That is the point of
4.0: `drawFx` and `drawFxS` hand a `dt` to every registered drawer and these ignore
it, so a second pass, a `dt` of zero, a hitstop and a death all give one picture.

#### 4.4.1 `drawDetWorld` — the tear, seam one, `ord 90`

```js
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
        y0 = isoY(tr.wx, tr.wy) + TILE_H / 2 - tr.wh;      // where the row WAS
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
```

#### 4.4.2 `drawRoomDown` — the room goes out, `ord 88`

`crit-art-deton` #7. File 1's one image is *"for the one held frame before it goes
out the room is lit by that line and nothing else"*, and nothing in five subsequent
files darkens anything or lights anything. The hold is 132 to 260ms in which the
world carries on exactly as bright as it was, with family matter, snap brackets, hp
bars, elite marks and the night wash all competing. The held frame is not held; the
line just stops moving inside a busy picture.

Two `fillRect`, at `ord 88`, under the line and over everything else.

```js
/* The room goes down so the line is the only thing in it, and then a
   flat band of the sound's own colour lies along the line: the light
   coming OFF it. Two rects, no gradient, no bake, and file 1's image
   finally exists.
   The dim is authored against d.p, so a one stack close barely touches
   the room and a twelve stack close takes a third of it. It ramps in
   over 40ms from TSET and out over the first third of OUT, so the room
   is darkest on exactly the frames the line is still. */
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
```

`0.30 * d.p` is the whole budget. It is deliberately below the `dark` pass
`FAM_PUNCH` already runs (2.7): that one is the family's own appetite for the
room's light and fires at `TSET` too, so `-ark` compounds to a genuinely dark room
and `-ight` barely dims at all, which is correct for both.

#### 4.4.3 The one bracket, three spans

`crit-art-deton` #22. `design-deton-5` ruled that the couplet bracket, the stanza
bracket and the Verse column bracket must stay three separate geometries because
*"a shared `bracket()` would take six arguments"*. That is an engineering answer to
an art question: a mark that changes shape every time it appears never becomes a
symbol, and this mark carries the entire thesis of the game. Six arguments is fine.

```js
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
```

#### 4.4.4 `drawDetScreen` — the line, seam two, `ord 90`

Outside the shake, after `drawMap`, and therefore the last thing `draw()` paints
apart from the four passes above it in the `ord` table. The map is opaque, so the
guard on the first line is not politeness: it is the difference between a rule
drawn over the map and a rule that is simply gone.

```js
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
```

#### 4.4.5 `drawFamLine` — the one place the five families own the line, `ord 90.5`

`crit-art-deton` #16 is the finding that most directly answers the brief. Five
families get bespoke matter at the bodies, bespoke snaps and bespoke `FAM_DET`
bodies, and then every one of them produces an identical line, an identical rule,
identical caps, an identical bracket and an identical halo, differing only in hue.
**The place the player is looking during the payoff is the one place the families
are interchangeable.**

One registry, one function per family, called between the rule and the words, each
of them typographic, each a handful of `fillRect`, none of them matter. The five
bodies belong to the five family blocks in §3 and are written there. This is the
dispatcher and the contract.

```js
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
   Nothing here may push a particle, hold an f, or age anything. */
var FAM_LINE = {};
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
```

The five, one line each, so the whole idea is on one page:

| family | the gesture |
|---|---|
| `-eat` | **the rule is eaten.** Notches are bitten out of it from the right during the hold, three per 100ms, each a 2px gap in the plate colour. By the caesura the rule is a dotted line. Hunger consumes the thing that measures it |
| `-ight` | **the line casts.** One hard offset copy of the whole line in `#08060c` at `+0, +6`, struck at `TSET` and held. Reveal is the family whose crime is being looked at, and a thing that is lit has a shadow. Nothing else in the game does |
| `-erd` | **the line is commanded into order.** The end caps close inward 3px on the frame after the strike and stay closed, and the word gaps snap 2px tighter in one frame. Hearing perfectly and answering nothing, at line scale |
| `-ark` | **the rule is a hole.** `#08060c` fill with a 1px `#8a6ad0` rim, and the notches show through as violet. It holds the light and does not hand it over. `.hole = 1` |
| `-ill` | **nothing moves.** `.still = 1`: the jolt is zero, the overshoot is zero and the press marks stay struck for the whole hold, and the rule grows a 1px frost serif at every notch. The family that stops is the only family whose line does not bounce |

`.still` costs one more clause, in `detWordPath`, where `over` is computed:
`var over = (d.K.miss || (FAM_LINE[d.fam] && FAM_LINE[d.fam].still)) ? 0 : Math.round(2 + 5 * d.p);`

---

### 4.5 The snap

Cheque 3 from `crit-eng-deton`, ruled: the signature is
`snapStacks(f, col, n, fam, th)`, the opt-out is a falsy `FAM_SNAP[fam]`, and the
snap stores the row's real height instead of the literal `-44` it has used since it
was written, which is a hundred and four pixels wrong on the Chorus and has been
wrong in every screenshot of the best effect in the game.

**`FAM_SNAP` is seeded, not empty** (2.1a). All five rows and the grey row start at
one default shape and a family design replaces its row; `-erd` calls
`regSnap('erd', null)` because its clap **is** the snap. **The call moves from
`doRhyme`'s loop into `detGather`**, which is not a new caller, it is the same call
one scope out, and it buys the thing four critiques asked for: `d.th` is known, so
the burst is divided before the loop instead of `part()` dropping the tail of the
Act 3 square in silence. After this edit `snapStacks` has exactly one caller and
`drawSnaps` exactly one call site (3898), which is what makes `design-deton-6`'s
double-ageing risk a non-risk (`crit-eng-deton` N14).

```js
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
        var sx = Math.round(isoX(s.x, s.y)), sy = Math.round(isoY(s.x, s.y) + TILE_H / 2 - s.h);
        cx.save();
        fn(cx, s, k, sx, sy);
        cx.globalAlpha = 1;
        cx.restore();
    }
}
```

`drawSnaps` keeps ageing its own list and keeps its own line in `draw()`. It is a
list and that is the file's pattern; nobody registers a snap drawer with `regFx`,
and `drawFx` runs immediately after it, so the snap is under everything this
section draws and over the family matter.

---

### 4.6 The slant, the drag, and the patch

Bad rhyme, good poem. 4.2 and 4.4 gave the failure paths their screen half: grey
words on a broken baseline, a rule that strikes to 60% and breaks, no caps. This is
the other half, at the bodies, plus the one mark that says why.

**The image: a drag is a manoeuvre, and manoeuvres are quiet.** A close throws
matter. A drag reaches out, takes hold of somebody else's sounds and walks them
over to its own, and the sounds are visibly worn by the trip. **It pushes no
particles at all.** Every close in the game bursts; being the one loud thing in the
game that makes no sparks is most of what says this is a different kind of move.

#### 4.6.1 The four outcomes, all reachable from one keypress

`doRhyme` picks one `kind` for the whole detonation by priority, so a board of two
Thieves and four folk fires as `'drag'` and the folk in it are not dragged. The
per-hit truth is already on the record.

| what happened | test | mechanic | picture |
|---|---|---|---|
| closed | `h.took` | spent, full damage | 4.4.1, the tear |
| dragged | `!h.took && h.was != null` | converted, aged 35%, nothing spent | THE HAUL |
| refused | `!h.took && f.def.folk` | nothing happens at all | THE SNAP BACK |
| wasted | anything else | the whole pile spent for half damage | THE DROP |

The fourth is the worst outcome in the game and nobody has ever seen it: with
`slantShift` off, a wrong sound **burns the pile** for half damage, and it has
looked exactly like a successful drag since the drag was written. It now looks like
dropping something.

#### 4.6.2 `dressSlant`, and who owns the row

`detonate` returns `d` and `hits` is still in scope at the call site, so the caller
that knows *why* this detonation happened adds what only it knows, on the same
frame, before anything has drawn. **Post-dressing only ever adds fields to `d`,
only on the frame `d` was made, and only from the one caller that built `hits`.**
The five `FAM_DET` functions have already run and never see it, which is the point:
a family must not have to know whether it was a drag or the second beat of a
Reprise.

**One author per pixel.** Three documents wanted to animate the same row: the
tear (4.4.1), the haul's wipe, and `design-proj`'s chip slide with its own
crossover and its own leash. The ruling is one line: **the haul owns the row of any
body it touches for 0.42s and the row drawer skips that body for the same 0.42s.**
That resolves the double-draw (`crit-eng-deton` B6), it gives the drag's merge the
one visual `design-proj` E.1 promised and never implemented (`crit-eng-proj` #14),
and it deletes the leash outright, which takes `crit-eng-proj` #6 and half of #7
with it.

```js
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
```

**The rope comes off the player, and there are at most six of them.**
`crit-art-deton` #20: `design-deton-4` ran a tether from `d.x, d.y` to every body,
which in the Act 3 square is twenty-five dotted lines radiating from one point in
the middle of the screen. That is chain lightning from any ARPG, on a 600-rect
budget, and file 1's own list of betrayals opens with radial symmetry. It is also
anchored wrong in the fiction: nothing at the centroid is doing the dragging. **You
are.** So the rope leaves the player, which is a directional gesture that says who
did it, and `hits` is already sorted centre-outward so `i < 6` is the nearest six
for free. Bodies past the sixth get the wipe and no rope, which is correct: the
rope is the reach and the wipe is the result. Six hundred rects become a hundred
and fifty.

#### 4.6.3 `drawHaulWorld`, `ord 86`

```js
/* Registered at ord 86, under the line and over the families. It ages
   nothing, holds nothing and takes no dt: every pixel is a function of
   d.t, so a second pass or a held frame draws the same picture. */
function drawHaulWorld(cx) {
    var d = RT.det; if (!d || !d.haul || !d.haul.length) return;
    var P = fampx()[d.fam];
    var ax = Math.round(isoX(RT.px, RT.py)), ay = Math.round(isoY(RT.px, RT.py) + TILE_H / 2 - 34);
    var i, j, H, c, t, sx, sy, x, dist, steps, m, u, k, tf, a, bw, fam, tg;
    cx.save(); cx.textAlign = 'center';
    cx.font = 'bold 8px "Press Start 2P", monospace';
    for (i = 0; i < d.haul.length; i++) {
        H = d.haul[i]; t = d.t - H.t0;
        if (t < 0 || t > 0.42) continue;
        sx = Math.round(isoX(H.wx, H.wy));
        sy = Math.round(isoY(H.wx, H.wy) + TILE_H / 2 - H.wh);
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
               The crossing is a BAR, not a white flash. drawCuts (3788)
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
```

`P.tag3` is one more key on the paint row: `FAMS[id].tag.slice(0, 3)`, computed
once in `fampx()`. `design-deton-4` sliced it up to six times per cell per frame,
which at sixteen foes is about six hundred and forty short strings a frame for the
length of a drag (`crit-eng-deton` N5). The tear's cells carry the same string
pre-sliced as `c.t`.

#### 4.6.4 The patch, `ord 92`

The rule breaks under a slant. One thing goes over the gap.

The town cut a woman out of the ballad and nailed a false line over the hole, and
used the same false line twice because it was cheaper than writing two. You can
hear the join because the false lines do not rhyme. So when *your* line does not
rhyme, the game patches it the way the town did.

```js
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
```

**The same plate belongs on the false line wherever the ballad is displayed**, so
that by the time the plates fall off the Verse column the player has been looking
at them for hours (`crit-art-deton` #25). That screen is `fillBook`'s and job 1's,
not this overhaul's, and a magic-layer branch editing a story screen is exactly the
cross-cutting edit `PARALLEL.md` exists to prevent. **Handed over rather than
done**, with the geometry above and one sentence: 14px wide, `#3d3350`, `#08060c`
border, two `#6a5f72` nails at opposite corners, over the `<s>?</s>`.

---

### 4.7 The Reprise

A full Echo bar on G: the last thing you said comes back three times and everything
counts as closed, matching or not. It is the only thing in the game that treats a
slant as closed, which is the whole point. Today it is three identical rings and
three identical shakes 0.34s apart.

**It must get louder, and what gets louder is the line, not the bodies.** The
repeat gate has already taken the matter away from beats two and three, which is
correct and is also the design: the bodies say it once, the room says it three
times, and each time more of the line comes back and more voices say it.
Escalation in typography, not in particles.

```js
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
```

| | beat 1 | beat 2 | beat 3 |
|---|---|---|---|
| words in the line | last 2 | last 4 | all 6 |
| voices | 1 | 2 | 3 |
| rule overhang | 1.0x | 1.45x | edge to edge |
| couplet bracket | if it is one | if it is one | **always** |
| per-body matter | full | 18% | 18% |
| tally | one mark struck | two | three, and the bracket closes |

Beat one gives you the rhyme word and its neighbour. Beat three gives you the whole
line, three voices deep, with a rule that runs off both edges of the screen and a
bracket closed around it **whether or not it rhymes**. That last one is the
argument: for three beats everything you said counts, so the bracket that can never
be drawn over the false line in the ballad gets drawn over yours.

```js
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
         { fam: fam, power: pile || 6, kind: 'close', x: RT.px, dur: 0.8, y: VH * 0.62 });
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
```

Two stateless passes, both pure functions of `d.t` and `r.age`, at `ord 87`, under
the line at 90 so a ghost is behind the word it is echoing.

```js
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
        sy = Math.round(isoY(tr.wx, tr.wy) + TILE_H / 2 - tr.wh);
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
```

---

### 4.8 The recital and the Verse

Two set pieces that are not fired by a rhyme. They share the whole spine and
diverge in exactly three places, all three of which are about **whose line the
syllables are ruling**.

#### 4.8.1 What dilation is for

Four lines of the real ballad, 0.375 real seconds apart, while the world runs at
30%. Inside a recital the house rule stops being an implementation note and becomes
the picture:

> The syllables tear off the bodies and fly at full speed. The ink, the embers, the
> frost and the motes they leave behind hang in the air at a third of a second per
> second. Four lines of the true ballad cut through a room that has not caught up
> with the first one yet. At 1.5s the dilation ends and the whole suspended cloud
> starts moving at once.

That last beat is free: `RT.dilate` hits zero, `frame()`'s `scale` returns to 1,
and a second and a half of banked family matter resumes mid-flight on one frame.
Things have to be written only to stop anyone breaking it. **No family may put its
matter on the real clock to "fix" the crawl.** The crawl is the effect. **The
letters must not be thinned**: flyers, tears, rule and words stay at full count and
full speed, and what gets thinned is matter, which the repeat gate has already
done. And 2.9's hook 6 has already moved `RT.shake`, `RT.chroma` and `RT.flash` off
the sim clock, without which a stanza is four overlapping shakes that never decay.

**Three durations change, and one of them fixes an old bug.** `bigLine(..., 1.1)`
gives each line 1.1s and they land 0.375s apart, so line one is dead before line
four arrives and the couplet on lines two and four is never two objects on the
canvas at once. Line `i` now gets `1.35 + (3 - i) * 0.375`, which lands all four
together, holds the whole stanza for half a second after the last, and takes them
out in the order they came in. And `drawLines`' typewriter runs off
`k = 1 - L.t / L.max`, so **how fast a line types depends on how long it lives**: a
1.1s recital line types in 0.385s and a 3.4s story line in 1.19s, for no reason
anybody chose. `L.age` is already on every record and already stepped for pinned
lines; it types off age now, which is what a rate is.

#### 4.8.2 The syllables give up their own line

`drawLines` puts the stanza's first line at `VH * 0.30` and `assembleLine` put the
detonation's there too. 4.2.2's `hasLoudLine()` moves the player's own line to 96,
which is the right answer for a rhyme answered mid-recital. But the recital's own
waves should not print a second line at all:

> The syllables you tore off the board do not assemble your line. They fly in and
> **rule the real ballad's line**, the one that just landed, one arrival at a time,
> and the mark under the true words is made out of the enemies that heard them.

Four lines, four rules, each built by whatever was standing in the room when that
line was said.

```js
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
       VT323 is what drawLines sets at 1493 and this has to agree with
       it or the rule is the wrong width for the words above it. VT323
       is not fixed pitch, so this is the one measureText in the whole
       section and it runs once per stanza line. */
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
   line i out at VH*0.3 + i*44 (1489) and RT.lines splices as lines
   expire, so the y of a line that has not moved changes whenever an
   older one dies. indexOf on an array never longer than six, four
   times a frame, is cheaper than any alternative and cannot go stale.
   design-deton-5 set d.ruleY once from a constant and never re-pointed
   it, so during a recital the rule was drawn 65 pixels above the words
   it was ruling and the syllables converged on empty screen, and then
   the finished rule jumped 78px down onto the line at the handoff
   (crit-eng-deton B4). */
function stzRowY(L) {
    var i = RT.lines.indexOf(L);
    return (i >= 0 ? Math.round(VH * 0.3 + i * 44) : (L._y || Math.round(VH * 0.3))) + 13;
}
```

`drawDetScreen` re-reads `d.ruleY` and `d.lineY` off the record every frame, so the
one live rule follows its line down the screen as earlier lines expire. `stepStz`
re-points it once a frame while a stanza detonation is alive:
`if (d && d.stz && d.stz.L) { d.ruleY = stzRowY(d.stz.L); d.lineY = d.ruleY - 13; }`.

```js
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
                   x: RT.px, y: VH * 0.62, bx: VW / 2, by: d.lineY + 6, flat: 0.28 });
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
```

#### 4.8.3 The Verse

Twenty-eight lines over 7.28 seconds, once per save. It currently reuses `bigLine`
and one `shake(12)`.

> The whole song, written down, correctly, at the top of the screen. Seven short
> columns of four marks each, dark, with three visible repairs on them. Each line
> that is sung lights its mark. Each stanza that closes gets a bracket around the
> two marks that rhyme. When a repaired stanza closes, the nails come out and the
> plate falls off the top of the screen. Underneath, in a room that has no colour
> left in it, four hundred people stand up in order, from the stage outward, in
> slow motion.

The room is grey and the song is not: `RT.mono`'s saturation fill is drawn inside
the shake restore and seam two runs after `drawMap`, so **nothing at seam two is
desaturated** and the column is the only colour on the canvas for eight seconds.
That is not a trick, it is where the two calls sit, and it is why the column
belongs at seam two.

**The marks are miniature rules.** `crit-art-deton` #30: twenty-eight 2px dashes in
a grid is a loading bar with a pun on it, above the most important seven seconds in
the game. Each mark is 2px with 1px brass end caps, which is exactly the shape the
player has been closing rhymes with for three hours at a fortieth of the scale, the
brackets are the same brackets, and the falling plates are the same plates. Nothing
new is invented and the whole song is drawn in the language the game taught.

```js
/* The colour of each stanza of the corrected ballad, off its own
   rhyme. Two of the seven are null and that is the point: -oo and -and
   are sounds the game never gave you a word for, so those two stanzas
   come out in paper rather than in a family colour. The ballad is
   bigger than your spellbook and this is the only place that says so.
   MECHANICALLY the pulse stays hurtFoe(f, 999, 'ight') exactly as it
   is at 2956: routing the damage through five families would put five
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
```

**The Verse escalates on its index, and that is allowed.** In the Act 3 square it
has **zero** legal targets: `hurtFoe` returns 0 on folk before it does anything, so
`total`, `best` and `wide` are all zero and every curve returns its floor. It is
the only place in this overhaul where a picture is sized by a position in a list
rather than by power, and it is allowed because a song has a shape that does not
depend on who is listening. `k`, the stanza index, drives `punch` power
`4 + 1.4 * k` (4.0 to 12.4, which saturates `fxP` on the last), the ring radius and
the column's fill. `j`, the line, drives the mark. Real foes, when there are any,
drive the detonation.

`versePulse` and `stanzaWave` both call `punch()` **themselves, unconditionally,
before the loop**, and never rely on the detonation for the room hit: a stanza is
castable into an empty room, `detonate` returns null, and the biggest cooldown in
the game would otherwise go off in silence in the one room it was written for.
Double punching costs nothing by construction, because `punch()` takes the larger
of every channel and never sums.

**Four consequences of `close()` killing `RT.timers`, all of them requirements
rather than problems.** No Verse visual lives inside a timer closure: the timers
set an index and the stepper and the drawer read it. The column is built whole at
`T0`, dark, so a Verse cut off at line twelve is visibly a song that stopped rather
than an effect that broke. Cancellation needs no cleanup, because the state is in
`RT.fx` and 2.2's one reset rebuilds it. And a backgrounded tab clamps `setTimeout`
to a second or more, so `verseStamp` **takes the index it was given** rather than
assuming it is the next one, lights every mark it skipped without their flash, and
runs the pulse for the last skipped stanza only.

**One duration is wrong today.** `RT.dilate = 6` against a song that runs
`28 * 260 + 1200` = 8.48 seconds, and dilation counts down on real time, so the
last five lines of the ballad, including the one the whole game is about, are the
only ones that play at full speed. It reads as the song being hurried at the end.
Derived off the line count instead: `RT.dilate = i * 0.26 + 0.9`,
`RT.mono = i * 0.26 + 1.3`, `s.life = i * 0.26 + 2.6`, so it can never drift from
`BALLAD` again.

**`standWave`, and what the most lethal thing in the game does instead.** `hurtFoe`
is a no-op on folk, so the Verse finds four hundred people and does nothing to any
of them. What it does is stand them up, **nearest first**: the original took four
at random, which stands the square up in a scatter. Sorted by distance from the
stage the crowd comes up in rings, the front row on the first stanza and the back
of the square on the last, and the one man still sitting when the song ends is the
one at the back outside the lamps, who is left out here on purpose and stands on
his own in `a3Hal`. The chips are on the sim clock like every particle in the file,
so during the dilation they come off a coat at a third speed under a song running
at full speed: the house rule at four hundred people, and the best look the clock
split ever gets.

---

### 4.9 The projectile

A call lives about 0.577s (`T('callRange') / 13`) and there are rarely more than
three or four in the air. That is a generous per-object budget and it currently
spends almost none of it: one 12px word, one flat additive disc, and a `part()`
call gated on `Math.random() < 0.6`, which emits 2.4 times more matter at 144Hz
than at 60.

#### 4.9.1 The record

Seven fields on the literal at 2390, all cheap, and every one of them is something
the current code computes and throws away or needs and guesses.

| field | what |
|---|---|
| `max` | life at birth, so there is finally an age fraction |
| `a` | the aim angle, computed at 2388 and discarded. Every ground mark, spray and impact cone needs it |
| `sa` | `isoAng(a)`, the **screen** heading. See below |
| `et` | a seconds accumulator for trail emission, so the trail is dt-driven and identical at 60 and 144Hz |
| `near` | 0 to 1, how close it is to something it can hit |
| `thin` | how out of breath you were when you said it |
| `tr` | a flat ring buffer of six past screen points, twelve numbers, allocated once at launch and never again. Read by `-ight`'s afterimages, `-ark`'s hole and `-ill`'s rime |

**Two angles, because a world heading is not a screen heading.** `crit-eng-proj`
#1, and it is the largest defect in the projectile half: `isoX` is `(x-y)*29` and
`isoY` is `(x+y)*14.5`, so a world angle of 0 leaves the barrel at 26.6 degrees on
screen and a world angle of `PI/4` at 90. Four families point a jaw, a chevron, a
needle and a downbeat along the raw world angle and are **up to 63 degrees out**,
while the `spray()` beside them is correct because it writes world velocities, so
the matter and the shape disagree. `c.a` stays world, for the physics and the
spray. `c.sa = isoAng(c.a)` (2.3) is what every drawn shape uses, with a plain
`(cos, sin)` and no `* 0.5` fudge. Inside a `translate; scale(1, 0.5)` ground frame
the answer is simply `c.a + Math.PI / 4`, because the iso basis is a 45 degree
rotation.

**`near` is a distance, not a boolean ramp.** `crit-eng-proj` #2 proves the ramp
cannot work: the proximity ring is at `1.15 + f.r` and the hit at `0.45 + f.r`, so
the gap is a constant 0.70 tiles for every enemy in the game, which at 13 tiles/s
is 54ms, so `near` peaks at 0.48 and **five of the six "last frames" beats never
fire**, including the `-ill` hesitation the art critique calls the best beat in the
document. So it is driven off the real distance, which `firstFoeAt` already
computes and throws away:

```js
/* firstFoeAt returns the foe; this returns how far the nearest live
   one is, in tiles, past its own radius. Same loop, one more subtract,
   and it is what makes every family's arrival beat reachable. */
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
```

`c.near = clamp(1 - (nearFoeD(c.x, c.y, c.hit) - 0.45) / 2.1, 0, 1)`, so it reaches
1 exactly at contact and 0 at about two and a half tiles out, on every foe in the
bestiary regardless of radius.

**Breath.** `crit-art-proj` #17, and it is the single biggest missing detail in the
projectile document: breath is the resource, the game periodically asks you to shut
up, and a call thrown at 90 breath and a call thrown at 6 are the same object.
`c.thin = clamp(1 - RT.breath / stats().breathMax, 0, 1)`, read once in `doCall`,
and three terms use it. Above `thin > 0.6` the word is drawn **hollow**: the
four-offset rim pass in `FAMS[fam].col` with no fill, a word with nothing behind
it. The trail rate multiplies by `1 - 0.7 * thin`, so it stops leaving matter. The
ground mark's radius multiplies by `1 - 0.4 * thin`, so it stops reaching the
floor. Three terms, no new draw code, and the player can see themselves running out
from the shape of what they are saying.

#### 4.9.2 `stepCalls`

```js
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
        c.near = clamp(1 - (nearFoeD(c.x, c.y, c.hit) - 0.45) / 2.1, 0, 1);
        /* THE TRAIL, dt-driven. Math.random() < 0.6 per frame (2424)
           is 36 particles a second at 60Hz and 86 at 144, which is the
           bug crit-eng-ill 20 found in all five families at once. An
           accumulator emits the same count on any machine. */
        if (R.trail && R.rate) {
            c.et += dt * R.rate * (1 + 0.55 * c.couplet) * (1 - 0.7 * c.thin);
            while (c.et >= 1) { c.et -= 1; R.trail(c, dt); }
        }
        /* six past screen points, written every 0.028s into a buffer
           allocated at launch. -ight reads it for its afterimages. */
        c.trT -= dt;
        if (c.trT <= 0) { c.trT = 0.028; c.tri = (c.tri + 1) % 6;
                          c.tr[c.tri * 2] = c.x; c.tr[c.tri * 2 + 1] = c.y; }
        var f = firstFoeAt(c.x, c.y, 0.45, c.hit);
        if (f) { c.hit.push(f); landCall(f, c); RT.calls.splice(i, 1); continue; }
        if (c.life <= 0 || c.x < -1 || c.x > pw() + 1 || c.y < -1 || c.y > ph() + 1) {
            callFizz(c);
            RT.calls.splice(i, 1);
        }
    }
}
```

#### 4.9.3 `drawCalls`, and the contract every family drawer keeps

```js
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
        sy = Math.round(isoY(R.step ? c.qx : c.x, R.step ? c.qy : c.y) + TILE_H / 2);
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
        cx.lineWidth = 1;                 // no family may raise it. See below
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
```

**The contract, and it is enforced by the caller.** `drawCalls` sets
`cx.lineWidth = 1` before every dispatch and no family drawer may raise it.
`crit-art-proj` #10: `lineWidth = 1.5` on a canvas with `imageSmoothingEnabled`
false is a 2px band of half-alpha mud straddling a pixel boundary, and the bible's
technique clause forbids both fat strokes and blurred edges. Where a family wants
weight it uses two 1px lines 1px apart, which is what `-erd`'s caesura and the
couplet double rule already do. Every coordinate feeding a `moveTo`, `lineTo` or
`fillRect` is rounded. **Two corrections to §3 in passing**, both one token:
`-eat`'s `mark` uses `cx.lineWidth = 2` and the brown-black `rgba(24,10,4,.30)`,
which is a new colour in a closed violet-black palette (`crit-art-proj` #8); they
become `1` and `rgba(8,6,12,.34)`, and the warmth comes from the additive arc that
is already on top of it.

#### 4.9.4 The muzzle comes out of the mouth

`crit-art-proj` #1. `design-proj` anchored the muzzle at the lantern hand, derived
by reading `drawActor`'s transform stack, so the single most important gesture in
the game comes out of a lamp, 0.13s after `drawActor` has already swelled that same
lamp in `rgba(255,190,90)`. Two lights of two different colours out of one fist
every 0.19s forever, and the player reads the lantern as the wand: **she is not a
mage with a lamp, she is a woman saying something out loud while holding a light
she will not hand over.**

So it is at the mouth, `isoY(RT.px, RT.py) + TILE_H / 2 - 38` and
`isoX(...) + west * 4`, with the actor's own bob subtracted so it does not detach
while walking. **And the cone is deleted.** The mouth flash is the word itself: one
`rimeText` of `c.word` at 0.55 scale at `0.5 * k` alpha for 0.13s, so the first
thing you see is the word leaving and getting bigger. That is *spells are words
getting bigger* delivered on frame one instead of asserted in a doctrine note. The
expanding 1px ring stays, the four forward sparks stay (`spray` from `doCall`, so
they inherit the aim), and the couplet mark stays as a second ring at 0.7x radius
and 1.4x alpha. For a rhyme (`RT.casting.max === 0.22`) the same layers run at 1.9x
and the ring is the whole gesture, because a rhyme is not aimed at anything.

`RT.casting` also moves to the real clock and decays while dead: it is decremented
in `stepPlayer`, which `step()` does not call when `RT.dead`, so a bright
family-coloured mouth flash would otherwise sit frozen over the corpse for 2.2
seconds and last 3.3x longer during a recital (`crit-eng-proj` #18). One line beside
the other real-clock decays.

#### 4.9.5 The fizz

`crit-art-proj` #19. A call that hits nothing is *"she asked and nobody
answered"*, mechanically, and today it is spliced at 2434 and produces **nothing**.
`design-proj` gave it a grey drift down 18px in 0.30s and called it "0.30s of
feedback on a whiffed 4 breath", which is a feedback framing rather than an art
framing.

**It hangs first.** The word holds at full size and full colour, dead still, for
0.22s at the point it ran out. Then it falls, slowly, 22px over 0.5s, going grey
**from the tail forward** through `rimeText`'s `dim`, so the rhyme is the part that
goes last. No particles at all: the silence is the point, and `sfx('callfizz')`
should be a breath. A question hanging in the air and then dropping is worth 0.7s
of screen time in this game specifically.

```js
function callFizz(c) {
    fxOf('proj').lands.push({ kind: 'fizz', wx: c.x, wy: c.y, fam: c.fam,
                              txt: c.word, t: 0, life: 0.72 });
    fxSfx('callfizz', 0.15);
}
```

---

### 4.10 The impact

Today: `typo(f.x, f.y, c.word, col, 0.5, 13, 'pop')`, whose own comment says
"deliberately underwhelming", plus a five-particle circular `burst`, plus
`shake(0.7, 4)`. `dmg` is fully computed at 2446 and used only as an argument, and
`f.stacks.length` after the adds is the *this pile is dangerous now* number and is
read by nothing.

Two scalars, both already in scope. **`n`** is `f.stacks.length` after the adds.
**`frac`** is how close this call came to taking a fifth of the thing's life, which
is the honest measure of "was that a big hit" and is one divide:

```js
    /* folk have hpm 1 and hurtFoe returns 0 on them before it does
       anything, so dmg/(1*0.18) is 50, clamped to the 1.6 ceiling,
       EVERY TIME: a Call into the crowd at the climax of the game
       fired the biggest impact in the game, with four ground cracks
       and thirty-four particles, for no damage at all
       (crit-eng-proj 8). The !f.hpm arm also kills a live NaN path:
       T('ttk') is DEV settable, 0/0 is NaN, clamp returns it, and a
       NaN in a font string makes cx.font invalid, which the canvas
       silently ignores, so the impact word renders in whatever font
       was last set. */
    var frac = (f.def.folk || !f.hpm) ? 0 : clamp(dmg / (f.hpm * 0.18), 0, 1.6);
```

**Beat by beat**, `t` in seconds from contact.

**`t = 0` — the spray.** `spray(f.x, f.y, 26, P, c.a, 0.62, ...)`: a directional
cone, not `burst`'s circle. `P = clamp(7 + round(1.6n) + round(6 * frac) + 4 * cpl,
7, 34)`. A call comes *from* somewhere and the matter should know it; `burst` cannot
express that, which is why `spray` exists (2.5).

**`t = 0` — the stamp.** A ground scuff at the feet: a flat ellipse, radius
`0.35 + 0.05n + 0.25 * frac` tiles, additive at 0.22, life 0.18s, shrinking to 0.6x.
Four 1px radial cracks at `c.a + PI/4 + i * 1.57`, which is the ground-frame angle
and not the raw one.

**`t = 0` to `0.05 + 0.015n` — the hold.** The word arrives at 1.55x its flight
size and **does not move**. No rise, no scale, no fade. Everything in this game's
typography moves the instant it appears and the one thing that sells a hit is a
frame where nothing does. At `n = 1` that is 65ms; at `n = 8` it is 170ms. The pile
getting heavier makes the word sit longer.

**`n >= 5` is a threshold, not a ramp.** `crit-art-proj` #13: every impact quantity
was linear in `n` — word 13.7 to 18.6px, spray 11 to 22, hold 0.065 to 0.170s — and
nothing ever changed *kind*, while the audio layer already switches to `stick.big`
at five. So at five the word is **double-struck**, the same mark a couplet gets,
because a deep pile and a couplet are the same statement: *this sound, again*. The
cracks appear unconditionally instead of waiting on `frac > 0.7`. Three lines, and
the player gets a word for it: that one is loaded.

**`t = 0.05 + 0.015n` — the word breaks and the sound stays.** `crit-art-proj` #3,
and it is the beat that makes the whole system one mechanism instead of three.
`design-proj` flew `FAMS[fam].tag` into the row: a three-letter abbreviation that
was never on screen a frame earlier, while the word you actually said died at the
impact point. There is no continuity between the thing you threw and the thing that
stuck.

So the impact word **splits**. The head glyphs fall away as grey matter on
`grav: 210` in `#6a5f72`. The **tail** — which `rimeCut` has already isolated and
which has been drawn as a separate colour since the muzzle — is what flies into the
row, at its impact size, decelerating into the slot over 0.16s on an ease-in, while
the plate behind that cell pops 1.35x with a `glow` wash. One word arrives, breaks,
and the sound is what stays.

With `c.couplet` two stacks land, so two tails fly, and the second is delayed 0.05s.
Two syllables, one after the other. You can hear the couplet and now you can see it.

```js
/* the impact record. One per landing, in fxOf('proj').lands, world
   tiles so it cannot detach from the body while the camera eases
   (crit-eng-proj 7: design-proj stored screen pixels and a 0.55s
   record slips ~50px on the road north). */
    fxOf('proj').lands.push({ kind: 'hit', wx: f.x, wy: f.y, fam: c.fam, txt: c.word,
                              n: n, frac: frac, cpl: c.couplet, a: c.a,
                              hold: 0.05 + 0.015 * n, t: 0, life: 0.05 + 0.015 * n + 0.19 });
```

**The overflow.** Line 2468, `while (f.stacks.length > st.stackMax) f.stacks.shift()`,
silently bins the oldest syllable at the cap: four breath vanishing in silence. The
shifted stack pushes a `spill` record — the cell's glyph tumbles off the left end of
the row, greys, and falls 22px over 0.36s, with `sfx('spill')`. No damage and no
red. A tag falling off a full plate reads instantly as *that one was wasted*.

**The punch.** One `punch({ fam: c.fam, power: 1 + n, kind: 'tap', x: f.x, y: f.y })`,
which is 2.10's `landCall` row: the eighth syllable onto a pile taps harder than the
first, which is the only escalation the Call has ever had, and the `tap` row's own
`cap: 5` keeps it near the old ceiling of 4.

---

### 4.11 The row

This is the game's most important readout: the player reads the board and picks a
sound off it. It has to answer three questions at a glance on a screen with
twenty-five bodies on it — **which sounds, how many, how much life is left** — and
it currently answers none of them, because `fam.tag.slice(0, 3)` at 8px in a 13px
cell is 24 pixels of ink in a 13 pixel slot and adjacent tags overlap by eleven.

**§3 already settled the cell**: one glyph per stack, from the closed set
`E / (none) / K / L` with `-erd`'s deliberately empty cell, each family drawing its
own erosion through `FAM_PIP`. That decision **supersedes `design-proj`'s grouped
chip wholesale**, and with it four art findings resolve by deletion rather than by
design: the eleven-layer debuff frame (`crit-art-proj` #4), `IGHT` running 5px past
a chip sized off `EAT` (#5), an 11x11 saturated count badge being the brightest
object in the magic layer (#6), and twenty-five identical dark plates with coloured
borders reading as a picket fence over a scene whose whole point is that these are
people (#16). One glyph per syllable, the count **is** the number of cells, and the
rot is in the type.

What is left is the **row**, and this section owns it: where it is, what it is
drawn on, and the four things that happen to it that are not a family's business.

```js
/* THE ROW. One cell per syllable, 13px pitch, the width the file has
   always used and now a named constant because four other things read
   it back out: the tear, the haul, the flyer's launch offset and the
   Reprise underline all reconstruct this layout, and design-proj's
   pipScale would have moved it under them (crit-eng-deton, overlaps).
   pipScale is CUT. It scaled four literals out of eleven, so at 1.3 it
   gave a 30% bigger empty box around the same 8px text and at 0.7 it
   put the baseline below the plate (crit-eng-proj 12), and with one
   glyph per cell the thing it was for is gone. */
var PIP_W = 13, PIP_ORD = [];
```

**It moves out of the body pass.** `drawFoe` stops calling `drawStacks` at 3526.
The row is drawn from the projectile layer's world pass at `ord 70`, which is
**after `drawLights` and after `drawVignette`**, so it stops being the darkest
magic on screen and becomes as bright as the detonation that spends it. Painter
order is preserved by sorting into a module-scope scratch array on `f.x + f.y`,
exactly the key `ents` uses at 3883, with the length reset each frame so there is
no steady-state allocation. `PIP_ORD.length = 0` also goes in the shared travel
reset, because it holds foe references from the last drawn frame (2.2,
`crit-eng-proj` #16).

**A merge hazard worth one line in the PR body.** This edit deletes a line from
`drawFoe`, which is job 4's function, and leaves a comment in its place. A
both-sides merge that keeps the old call draws the row twice, once under the lights
and once over them, and it will look like a shadow rather than like a bug.

```js
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
```

**`drawStacks`, rebuilt.** Everything below the dispatch is shared; everything
inside it is §3's.

```js
function drawStacks(cx, f, sx, sy) {
    var n = f.stacks.length; if (!n) return;
    var i, s, x, fade, fam, P, k, plate = n * PIP_W + 8, said = RT.said;
    var crowd = RT.foes.length > 12;
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
           it (2492) and it must read as not yours. Three dashes rather
           than a border, a 1px strike through the glyph, and no alarm
           at all, because it is not counting down to anything that
           costs you. */
        if (s.drone) {
            cx.globalAlpha = 0.72;
            cx.fillStyle = '#8a8090';
            cx.fillRect(x - 5, sy - 4, 10, 1);
            cx.fillRect(x - 6, sy - 11, 3, 1); cx.fillRect(x - 1, sy - 11, 3, 1);
            cx.fillRect(x + 3, sy - 11, 3, 1);
        }
        cx.globalAlpha = 1;
    }
    if (RT.dbgStacks) {                   // the DEV toggle at 1008 keeps its readout
        cx.font = '9px monospace'; cx.fillStyle = '#ffe66e';
        cx.fillText(n + '×', sx, sy - 14);
    }
    cx.restore(); cx.textAlign = 'left';
}
```

**One stepper for the four timers**, in the projectile layer's `step`, on the real
clock, because all four are typography: `s.fly`, `s.slT`, `f.rowT` and `RT.said.t`.
None of them is aged in a drawer. `devDemo` calls `draw()` bare at 8143, 8152 and
8221 and `__ninth.tick` calls `step()` then `draw()`, so a draw-side timer advances
on frames that never simulated (RECON's trap 1), and `design-proj`'s `drawLeash`
did exactly that with an un-scaled `lerp`, which also ran 2.4x faster at 144Hz than
at 60 (`crit-eng-proj` #6). The leash is gone with the haul, and nothing else in
this section mutates from a drawer.

---

### 4.12 Sour

`breakStack` at 2484. Today: `typo(f.x, f.y, 'sour', '#6a5f72', 0.7, 9, 'drift')`,
one grey particle, `RT.hurt`, and `RT.hp -= T('breakSelfDmg')` **directly**,
bypassing `hurtPlayer` and the i-frames. `s.fam` is in scope and the visual is
grey, so a sour `-ill` and a sour `-eat` are the same event, and the player has no
idea what hit them or where it came from. It is also the commonest way to die.

Three requirements: legible as **your** fault, **survivable to look at** when six
lapse on one frame, and it should feel like a failure rather than a nuisance.

**The sound goes off-rhyme before anything else happens.** `crit-art-proj` #14 is
the most on-theme object anybody proposed across eight jobs. The premise of the
game is that a false line does not rhyme and you can hear the join. A stack going
sour is a sound that was set up and never answered — and `design-proj` rendered
that as an accounts payable notification with a red thread and a damage number. So
for two frames before the cell breaks, **the glyph is replaced by the wrong one**,
in `#6a5f72`:

```js
/* The sound coming apart. One wrong letter, from a fixed table, drawn
   for 0.06s in the colour of a thing nobody wrote down, before the
   cell breaks. It is one fillText and it is the whole thesis of the
   game in a glyph.
   Keyed off the family rather than the pip glyph, so it survives
   whatever -erd does with its empty cell: -erd's off-rhyme is the one
   case where a mark APPEARS in the empty slot, which is the hole in
   the song filling with the wrong thing. */
var RIME_OFF = { eat: 'R', ight: 'S', erd: 'T', ark: 'M', ill: 'T' };
```

`EAT` goes to `EAR`, `IGHT` to `IGHS`, `ARK` to `ARM`, `ILL` to `ILT`. Nothing
explains it. The first thing the eye catches is the sound breaking, not the
invoice.

**Then the cell breaks.** Not a fade: the plate splits on a diagonal and the two
halves fall. Two records per lapse, each drawn as a triangular `clip` from opposite
corners with the plate, the glyph and the border drawn inside it, tumbling on
`grav: 260` and landing over 0.55s. This is the only place in the section that uses
`clip` for a shape rather than a wipe, and `drawCuts` already establishes clipping a
word mid-letter as this game's idiom for something being cut off. A sour stack is a
line that did not get finished; it should look like the cut.

The glyph goes grey **as it falls**, through `mixRgb(P.rgb, '106,95,114', k / 0.35)`.
Grey is right for the word — it is this game's colour for a thing that failed to be
a rhyme, at `doSwallow` 2416, the `lapses` path 2493 and the slant slam 2658 — but
the *pieces* must start in the family colour or the player cannot tell which sound
they just lost, and losing the last `-ill` on a nearly dead elite is a very
different mistake from losing a spare `-eat`. It starts as the sound and ends as
grey.

**The bill travels to you.** A 1px thread from the break point to the player,
`rgba(201,72,74,.55)`, drawn as a quadratic with 14px of sag, contracting toward
the player over 0.22s so the line eats itself from the foe end. Both endpoints are
**world tiles**, projected in the drawer, and the contraction is a `k0` stepped in
`stepProj`, not a `lerp` of stored screen pixels mutated inside the drawer
(`crit-eng-proj` #6, #7).

**One number, however many lapsed.** The player takes 3 HP and gets no number,
ever, while every other damage source in the game pops one. Several stacks lapsing
on one frame is common with a Droner in the pack, so there is a coalescer:

```js
/* SOUR, coalesced. Six full sour events at once is a screen full of
   red thread, so the first three of a burst get the whole treatment
   and the rest get pieces only, at half size, with no thread. One
   number is popped at the player 0.22s later, when the thread lands:
   '-9' for three lapses, with '3 lapsed' under it in 8px.
   Scale the information, not the assault.
   The counter is incremented BEFORE the pieces are made, because
   design-proj read SOURQ.n inside sourBreak and incremented it after,
   so the gate fired on the fourth lapse and not the third
   (crit-eng-proj 17). The sum is rounded, because breakSelfDmg is DEV
   settable and 2.5 x 3 prints -7.5 (crit-eng-proj 23).
   It lives on fxOf('proj') and not at module scope, so it is rebuilt
   by make() on travel and cannot carry a count through a doorway. */
```

`sfx('sour')` for one and `sfx('sourmulti')` for three or more, fired **once** from
the coalescer rather than once per stack, which also fixes six overlapping copies of
one sample. `sfx('pipwarn')` gets the same treatment through `fxSfx`: a slant drag
multiplies every stack on every dragged foe by `1 - dragAge` in one call, so eight
foes at eight stacks can all cross `pipWarn` on the same frame, which was sixty-four
calls into `sfx` (`crit-eng-proj` #22).

**The Droner's lapse.** `breakStack` returns early for a Droner's own words with
`typo(f.x, f.y, 'lapses', ...)`. That stays, and the cell gets the same break and
fall at 0.6 alpha in `#8a8090`, with no thread, no number and no off-rhyme glyph.
It should be visible that something ended without being visible that it cost you;
today those two events are almost identically presented and one of them takes 3 HP.

**And it goes through `hurtPlayer`.** `RT.hp -= T('breakSelfDmg')` at 2495 bypasses
the i-frames and `hurtPlayer`'s own `punch({ kind: 'hurt' })` (2.10), so the one
damage source with no number is also the one with no screen reaction. The
coalescer calls `hurtPlayer(SOURQ.hp, 'sour')` once, which pops the number, shakes
once for the burst, and respects i-frames the way every other source does. **This
is a mechanical change, small and deliberate, and it is called out in the PR body**:
it makes a six-stack lapse survivable in a way it currently is not.

---

### 4.13 Scaling, all of it, in two tables

Everything is 2.3's four curves and the numbers frozen at `T0`. No other curve
exists in this section.

```
FLY    = T('detFly') + 0.13 * d.p       TSET  = 0.035 + FLY
HOLD   = T('detHold') + 0.16 * d.p      OUT   = T('detOut') + 0.12 * d.p
wordPx = round(T('detWord') + 9 * d.p)  gap   = round(wordPx * 1.05)
over   = round(2 + 5 * d.p)             jolt  = round(1 + 3 * d.p)
haloA  = 0.22 + T('detHalo') * d.p      haloS = 1.05 + 0.09 * d.p
ruleW  = clamp(2 + floor(total/5), 2, 6)
ruleO  = min(round(6 + T('detRuleOver') * total), 190)
segment i width = (2*ruleHalf - (wide-1)) * n_i / total, floor 6
notches per segment = n <= 12 ? n : 12 + floor((n-12)/4), capped by segW/3
flyPx  = round(8 * fxS(n))              flyers = fxBudget(n, wide, T('detFlyMax'))
release= min(0.014, 0.10 / n) each      STAG   = min(0.018, T('detSpread')/wide)
ARC    = tall ? -(46 + 54*fxP(n)) : control y = ground y under the centroid + 10
tall   = (max screen x - min screen x) < 260
```

**One foe, `total = best = n`, `wide = 1`.** The bottom four rows are 2.7's `close`
row at option level 2, quoted rather than re-derived: `fxP` **is** `punchP`, which
is why they line up.

| n | 1 | 2 | 3 | 4 | 6 | 8 |
|---|---|---|---|---|---|---|
| `d.p` | 0.200 | 0.356 | 0.480 | 0.582 | 0.738 | 0.853 |
| `d.sc` | 1.00 | 1.26 | 1.45 | 1.62 | 1.90 | 2.13 |
| release spread s | 0 | 0.014 | 0.028 | 0.042 | 0.070 | 0.098 |
| `FLY` s | 0.086 | 0.106 | 0.122 | 0.136 | 0.156 | 0.171 |
| `TSET` s | 0.121 | 0.141 | 0.157 | 0.171 | 0.191 | 0.206 |
| `HOLD` s | 0.132 | 0.157 | 0.177 | 0.193 | 0.218 | 0.237 |
| `OUT` s | 0.204 | 0.223 | 0.238 | 0.250 | 0.269 | 0.282 |
| line life s | 0.457 | 0.521 | 0.572 | 0.614 | 0.678 | 0.725 |
| word px | 23 | 24 | 25 | 26 | 28 | 29 |
| overshoot px | 3 | 4 | 4 | 5 | 6 | 6 |
| jolt px | 2 | 2 | 2 | 3 | 3 | 4 |
| halo α | 0.28 | 0.33 | 0.36 | 0.40 | 0.44 | 0.48 |
| second halo | no | no | no | no | no | yes |
| rule px | 2 | 2 | 2 | 2 | 3 | 3 |
| overhang px | 9 | 12 | 15 | 18 | 24 | 30 |
| **notches** | **1** | **2** | **3** | **4** | **6** | **8** |
| segments | 1 | 1 | 1 | 1 | 1 | 1 |
| flyers | 1 | 2 | 3 | 4 | 6 | 8 |
| flyer px | 8 | 10 | 12 | 13 | 15 | 17 |
| `ARC` px | -57 | -65 | -72 | -77 | -86 | -92 |
| hitstop s | 0.022 | 0.039 | 0.053 | 0.064 | 0.081 | 0.094 |
| shake | 3.2 | 5.7 | 7.7 | 9.3 | 11.8 | 13.7 |
| bloom | 0.110 | 0.196 | 0.264 | 0.320 | 0.406 | 0.469 |

**n = 1.** One syllable peels off a body, arcs 57px over its head, lands in 86ms,
the words set with a 3px overshoot, a 2px rule 9px wider than the line strikes
under them with one notch and two brass caps, and it is gone in 0.56s with 22ms of
hitstop. Crisp, complete, over before you finished pressing the key. It is the
*same* event as the big one, which is what stops a small close feeling like a
downgrade.

**n = 8.** Eight syllables peel off *one* body one at a time over 98ms, each arcing
92px overhead. The line is 29px instead of 23. It takes 206ms to land, overshoots
6px, jolts 4px, carries two hard coronas, holds 237ms with the frame frozen for
94ms of it, and the rule is 3px, overhangs 30px and has **eight notches under it
you can count**. 0.73s against 0.56s.

**Widening, `n = 3` per foe.**

| wide | 1 | 2 | 3 | 4 | 6 | 8 | 16 | 25 |
|---|---|---|---|---|---|---|---|---|
| `total` | 3 | 6 | 9 | 12 | 18 | 24 | 48 | 75 |
| `d.p` | 0.480 | 0.738 | 0.900 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 |
| `d.th` | 1.00 | 0.945 | 0.890 | 0.835 | 0.725 | 0.615 | 0.35 | 0.34 |
| flyers/foe | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 1 |
| flyers total | 3 | 6 | 9 | 12 | 18 | 24 | 32 | 25 |
| **segments** | **1** | **2** | **3** | **4** | **6** | **8** | **16** | **25** |
| segment px | 30 | 24 | 22 | 21 | 20 | 19 | 18 | 15 |
| `STAG` s | .018 | .018 | .018 | .018 | .018 | .018 | .0138 | .0088 |
| spread s | 0 | .018 | .036 | .054 | .090 | .126 | .206 | .211 |
| `TSET` s | 0.157 | 0.191 | 0.212 | 0.225 | 0.225 | 0.225 | 0.225 | 0.225 |
| word px | 25 | 28 | 29 | 30 | 30 | 30 | 30 | 30 |
| rule px | 2 | 3 | 3 | 4 | 5 | 6 | 6 | 6 |
| overhang px | 15 | 24 | 33 | 42 | 60 | 78 | 150 | 190 |

**What saturates and what does not.** `d.p` pins at 1 from twelve syllables, so
hitstop, zoom, shake, bloom, word size and every duration stop growing there:
that is 2.7's cap doing its job, and the Act 3 square must not be four times the
loudest fight. What keeps growing is the **rule**, and now it grows in a way that
can be read: at twenty-five sources it is **twenty-five separate pieces** with
twenty-five notches, 380px wider than a one-stack close, made of the twenty-five
people who heard you. Width is area covered, never volume. That is the only way the
ending survives being drawn.

**What is deliberately flat.** The number of words in the line (the poem decides).
The easing curves. The 14ms overshoot return, at every size, because a settle that
takes longer at high power reads as sluggish rather than heavy. The rule's 0.10s
tail and its 900 px/s close. The 3px break, the patch, the two nails, the tally,
the caesura. All of it is punctuation and punctuation does not scale.

---

### 4.14 What it costs

Counted off the code above at 144Hz, where a frame is 6.94ms.

**Case A, 8 foes x 8 stacks.** `wide = 8`, `total = 64`, `d.th = 0.615`,
`per = fxBudget(8, 8, 32) = 4`, so **32 flyers**, `TSET` 0.225.

At `T0`, once: 8 `cells` arrays and 64 cell objects, 8 hit objects, one sort, `d`,
`d.rule`, 8 segments, 32 flyer objects, 8 tear objects, 8 snap records, one `ws`
array of 6, **zero `TextMetrics`**. About 200 short-lived objects on one frame, none
of it recurring. Particles: `8 * max(2, round(20 * 0.615)) = 96` against the 900
cap and the 112-for-the-snap house split (2.5).

| peak pass | count |
|---|---|
| tears, 3 concurrent x (1 clip + 1 rect + 16 fillText) | ~54 |
| flyers, ~30 live x 2 fillText | ~60 |
| words, 6 x (2 halo + 3 fill) | ~30 fillText |
| rule: 8 segments x 2 rect + ~48 notches + 2 caps + uprights | ~70 fillRect |
| the room down, the band | 2 fullRect |
| `drawSnaps` | 40 fillRect, 8 save/restore |
| **total** | **~145 fillText, ~115 fillRect** |

RECON puts the existing stack rows at about 50 rects and 50 text fills per frame at
their ceiling, so the detonation roughly **triples the text fills for a fifth of a
second** and is then gone. At 3 to 15µs per short `fillText` that is 0.4 to 2.2ms,
6% to 32% of the frame.

**Case B, the 25-folk square.** `wide = 25`, `total = 25`, `d.th = 0.34`,
`per = 1`. `hurtFoe` returns 0 for folk **before** the typo, so the square produces
zero damage numbers and zero deaths. **50 particles**, not 150. 25 flyers at 2
fillText. 6 concurrent tears. 25 segments at 2 rects plus 25 notches. The rows lose
their plates to the crowd collapse, so the row costs 25 `fillText` instead of 25
plates and 25 glyphs. **The square is cheaper than case A**, which is `fxW` and the
crowd branch doing what they were written for.

**The in-game ceiling.** The encounter tables never produce 8x8: waves cap at 2 to
6, the Chorus loft at 16, the square at 25. Sixteen foes at eight stacks is
`total = 128`, `th = 0.35`, `per = 2`, which is 32 flyers again, because
`detFlyMax` is a **board** cap and 32 is the ceiling of the design at every crowd
size. Nothing in the game exceeds case A.

**Every per-frame allocation, named.** `detAt` returns `{k, x, y}`, one per live
flyer and in-flight word, peak ~36. `detRule` returns one object, now **once** per
frame rather than three times, because it is cached on `d` under the clock it was
computed at. `PIP_ORD.sort`'s comparator closure, one per frame. Nothing else: the
flyer's font string is built at `T0`, the tear's glyphs are pre-sliced into the
cells at `T0`, `P.tag3` is built once in `fampx`, and every colour goes through
`partCol`, `fampx` or `mixRgb` (2.4). The four power functions are pure arithmetic.

---

### 4.15 Sound

`sfx()` (4467) drops an unknown name off the end of its chain: no throw, no console
noise, so every one of these is safe to ship before job 2 fills it in. All of them
are for the PR body.

| name | fired from | gate | what it wants to be |
|---|---|---|---|
| `tear` | `detGather`, once per detonation | `fxSfx 0.06` | the syllables coming off the bodies. A short dry intake, no pitch: paper lifted rather than torn. Twenty-five folk make one of these, not twenty-five |
| `nib` | `stepDet`, when the landed count rises | `fxSfx 0.03` | the tick. Tiny, dry, pitched, and the run is the point: thirty-two arrivals over 200ms is a stitching sound and it should climb slightly, so a big close audibly fills up. This is what makes the rule feel earned |
| `rule` | `detFire`, under the slam | `fxSfx 0.06` | the strike. One hard mark with a short wooden body. It plays *with* `answer` and must sit under it: narrow, low, mostly felt |
| `bracket` | `detFire`, when `d.cpl` | `fxSfx 0.20` | the join. Two taps 30ms apart, the second lower. The rarest sound in the game and the one players should learn to want |
| `crack` | `detFire`, on a slant | `fxSfx 0.10` | the break. Not a crash: a dry snap with no ring |
| `caesura` | `stepDet`, the last 2px mark | once per record | almost silence. One low click at very low gain, so the detonation has an end and not just a fade. If it cannot be made subliminal, cut it |
| `stick` / `stick.big` | `landCall`, `n >= 5` for the second | `fxSfx 0.05` | a syllable going into a body, and the same thing into a full one |
| `spill` | the overflow shift at the stack cap | `fxSfx 0.10` | something falling off a full plate. No tone |
| `callfizz` | `callFizz` | `fxSfx 0.15` | a breath. Not a whiff, not a descending tone: the sound of asking and getting nothing |
| `pipwarn` | the row crossing `pipWarn` | `fxSfx 0.25` | one soft knock. The gate is doing real work: a drag can cross sixty-four stacks over the threshold on one frame |
| `sour` / `sourmulti` | the coalescer, once per burst | once | the sound coming apart, and several of them |
| `drag` | `doRhyme`'s drag branch | once | the haul. A pull, low, with a length to it |
| `reprise` | `doReprise` | `fxSfx 0.3` | the announcement. `verse` carries it until job 2 writes one |

Two existing names change **when** they play and not what they are. `sfx('answer')`
and `sfx('slant')` move out of `doRhyme`'s tail and into `detFire`, so they land at
`TSET` with the line rather than 121 to 225ms before it. That is the same retiming
as the slam and it is the most audible change in the branch: today the game says
"answer" while the syllables are still sitting on the bodies.

---

### 4.16 Ledger: every critique finding against the detonation and the projectile

Applied or refused. Nothing dropped.

**`crit-eng-deton.md` — blocking**

| # | finding | ruling |
|---|---|---|
| B1 | `d.life` is never assigned, so `stepDet` deletes every detonation on its first tick | **APPLIED.** The assignment is the last statement **inside** `detGather` (4.2.4), and `stepDet` carries a 1.2s floor for a future caller that forgets |
| B2 | the area is a hard `ReferenceError` on `punch()`, and file 6 says it lands first | **APPLIED by merging.** There are no two branches: `punch`, `PUNCH_KIND`, `punchLv` and the thirteen `TUNE` keys are §2 of this document and land in the same commit. The shim is unnecessary and is not written |
| B3 | `detRule` defeats its own `K.rule`: a slant's rule reaches full length | **APPLIED.** Each segment's grown length is `w * K.rule * max(kk, strike)`, so the flyers can only ever build what the outcome is allowed to have |
| B4 | the recital's rule is drawn 65px above the line it rules and then jumps 78px | **APPLIED.** `stzRowY(L)` is the one function both halves use, `stepStz` re-points `d.ruleY` and `d.lineY` every frame, and `drawStzScreen` re-reads it per row |
| B5 | `versePulse(pk, ..., null)` is a TypeError, once per frame if the stanza is the seventh | **APPLIED.** `dressStanza` opens with `if (!L)`, and `stepStz`'s slam tests `d.stz.L` before reading `.txt` |
| B6 | every slant and drag draws the stack row twice for 45ms | **APPLIED.** A tear is pushed only when `h.took`, and the haul owns the row of anything it touches for 0.42s through `f.rowT` |
| B7 | the gather is drawn outside the shake and the zoom but its origins are inside both | **APPLIED.** `detAt` puts `P0` through `punchWX`/`punchWY` (2.3) |
| B8 | `VH * 0.30` collides with `drawLines` for the Reprise and the Verse | **APPLIED twice.** `hasLoudLine()` replaces the `RT.recital` guard, **and** `doReprise` stops calling `bigLine` at all, which is the cheaper half of the fix and removes a third object saying the same thing |
| B9 | nine tunables are specified and none is wired | **APPLIED.** All nine read inside `detonate`/`detGather`/`assembleLine`, once, at `T0`, and frozen onto `d`. `detHalo` is lifted onto `d.halo` for exactly that reason |
| B10 | `detFlyMax = 0` gives *more* flyers, not none | **APPLIED in 2.3.** `cap == null` and `cap <= 0` are separate answers, and `detGather` skips a zero `per` |
| B11 | `fxP` and `punchP`: the instruction as written breaks the file | **APPLIED in 2.1.** One body, two names, and the alias is what is conditional |
| B12 | `slam()` is rewritten by two branches with two bodies | **APPLIED in 2.8.** One merged body with `px`, `dur` and `y`; both hooks withdrawn |
| B13 | file 5's own acceptance item 2 is unreachable with file 5's own code | **APPLIED.** `dressStanza` files a row with `d === null`, using the `Math.max(9, ...)` floor file 5 wrote and then made unreachable |
| B14 | the patch is drawn under the rule it is patching | **APPLIED in 2.2.** `ord 92`, and the ord map is closed |
| B15 | `d.dead`, `d.folk`, `d.th` and `d.i` are left holding the last hit's values | **APPLIED.** One line at the tail of `detonate` puts all five back, `d.again` included |
| B16 | `T` is shadowed as a local in two world drawers | **APPLIED.** `tr` in `drawDetWorld`, `tr` in `drawRepWorld`, and 2.3 states the rule for everyone |

**`crit-eng-deton.md` — nice to have**

| # | finding | ruling |
|---|---|---|
| N1 | `d.sc` and `d.pb` are computed and read by nothing | **APPLIED as documentation.** They are the family contract, §3 reads both, and 4.1 says so in the text so a reviewer does not delete them |
| N2 | `foeStackY` and `fxPush` are declared and never called | **APPLIED.** `foeStackY` is mandatory (2.1) and is what `drawPips`, `detGather`, `snapStacks` and the haul all use. `fxPush` is the families' backstop and 2.2 requires every family list to go through it |
| N3 | the flyer stagger contradicts file 2's table above n = 7 | **APPLIED.** `min(0.014, 0.10/n)` per flyer wins, and the tables in 4.13 are recomputed against it |
| N4 | the fit loop can run 84 `measureText` calls, not 30 | **APPLIED and then deleted.** `PSA` makes the fit a single divide and the whole section runs **zero** per frame |
| N5 | two per-frame string allocations file 6 does not name | **APPLIED.** `c.t` pre-sliced into the cells at `T0`, `P.tag3` built once in `fampx`, and the haul's tether pitch already thinned |
| N6 | `detRule` is walked twice per frame once the patch lands | **APPLIED.** Cached on `d.rt` under `d.rtT`, and three passes now share one answer |
| N7 | `drawStzScreen`'s couplet detection breaks during the fade-out | **APPLIED.** Rows carry `li`, the stanza line index, and the bracket keys off it |
| N8 | `fxOf('stz').sz` is written and never read | **APPLIED.** The line goes; `dressStanza` needs only `fam`, which it takes off the detonation |
| N9 | `stepStz`'s handoff keeps `r` undefined across iterations | **APPLIED.** `r = null` at declaration and the push is inside the branch that built it |
| N10 | the slam's opening box reaches ~y 134, not y 175 | **APPLIED by moving the slam.** `o.y = VH * 0.62` (2.8), so the arithmetic no longer matters and the composition is line, rule, notches, tag, sub |
| N11 | the tear loses the Droner's grey | **APPLIED.** `dr` on the cell copy, and the row draws it too |
| N12 | the `beat` row of `DET_KIND` is unreachable | **APPLIED.** Deleted |
| N13 | `DET_AUTO` gates the Reprise's first beat if you closed recently | **APPLIED.** `f.detG[fam]` is stamped only when `auto` |
| N14 | `snapStacks` has one caller and that is worth stating | **APPLIED.** Stated in 4.5, where the person deleting the third argument will be reading |

**`crit-art-deton.md`**

| # | finding | ruling |
|---|---|---|
| 1 | the money shot never shows a rhyme | **APPLIED, and it is the largest change in this section.** `rimeCut`/`rimeText`, head in `col` and rhyming tail in `glow`, in the muzzle, the flight, the impact, the row, the flyer and the line |
| 2 | `i % wide` is a shuffle, not the bodies the words came from | **APPLIED.** `addStack(f, fam, word)` carries `w` onto the cell and `detGather` matches word to body; `i % wide` survives only as the honest answer for a stack nobody said |
| 3 | the syllable degrades into a letter at the moment it becomes interesting | **APPLIED.** The flyer is the whole tag at `round(8 * fxS(n))`, and `detFlyMax` drops to 32 to pay for the ink |
| 4 | forty-eight flyers aimed at one pixel is a blob over the rule it builds | **APPLIED.** Each flyer flies to its own body's segment |
| 5 | the rule carries none of `total`, `wide` or `best` | **APPLIED.** `wide` abutting segments, each as long as its body's share |
| 6 | `total` has no readout a player can see | **APPLIED.** Notches, one per syllable to twelve then one per four, under each body's own piece |
| 7 | file 1's one image is not implemented anywhere in files 2 to 6 | **APPLIED.** `drawRoomDown` at `ord 88`: the room down by `0.30 * d.p` and a flat band of the sound's colour along the line |
| 8 | the bloom is a ball of light at the enemy centroid, which file 1 forbids | **APPLIED.** `bx/by` at the line and `flat: 0.28`, so the light lies along the rule. `x/y` stay the centroid for the shake direction |
| 9 | the slam sits on top of the rule on the frame the rule strikes | **APPLIED.** `o.y = VH * 0.62` |
| 10 | four of five families print the line in near-white | **APPLIED.** The fill is `col`; `glow` is reserved for the rhyming tail and the press mark |
| 11 | the halo clips to pure white on three families | **APPLIED.** The halo is `col`, and `detHalo` clamps the summed alpha at 0.55 |
| 12 | `#3a3340` does not exist in `comp/ninth.js` | **APPLIED in 2.4.** All three uses become `#3d3350` |
| 13 | two paper whites for one gesture | **APPLIED in 2.4.** `#e8e2ee` is the strike everywhere; `#f0e9df` stays body text |
| 14 | the apparatus and the element are the same colour, and brass is unused | **APPLIED.** The rule stays the sound; every cap and every bracket is `#c9a94a` |
| 15 | a six-word line in five saturated hues is a rainbow | **APPLIED via #1.** Heads carry the hue at its lower value, tails are the only bright thing, and the line reads as one object |
| 16 | the loudest object in the game has no family character | **APPLIED.** `FAM_LINE` at `ord 90.5`, five bodies, none over twelve lines |
| 17 | the tear fades, which is what the design says a sour stack does | **APPLIED.** No alpha at all: a clip to the row's own box and a 16px lift, so the row leaves through a hard edge, which is `drawCuts`' idiom |
| 18 | the tear draws the whole row on top of the row that is still there | **APPLIED, both halves.** Only `go` cells tear, and the survivors slide into the gap over the same 45ms |
| 19 | nothing on the line knows that anybody died | **APPLIED.** One brass upright standing on the rule at the dead body's own segment, struck at `TSET`, held to the caesura |
| 20 | the drag draws a twenty-five arm starburst, centred | **APPLIED.** The rope leaves the **player**, and only the nearest six are drawn; the other nineteen get the wipe, which is the result rather than the reach |
| 21 | the rarest mark in the game gets 1px, 60% alpha, 90ms, behind the slam | **APPLIED.** 2px brass, full alpha, `TSET` to the caesura, and the slam is no longer over it |
| 22 | three brackets with three geometries is three symbols | **APPLIED.** One `bracket()`, three spans: the couplet, the stanza, the Verse column, and the Reprise tally makes four |
| 23 | the slant reads as a rendering bug | **APPLIED.** The baseline breaks and `x` is untouched |
| 24 | there is no paper | **APPLIED.** One `rgba(8,6,12,.72)` plate behind the line, struck by the first arrival and grown with each one |
| 25 | the patch is the best idea in six files and it is fourteen pixels wide | **APPLIED in part.** It is sized off `d.rule.w`. **REFUSED here and handed over:** the same plate over the false line in `fillBook` belongs to job 1's screen, and a magic-layer branch editing a story screen is the cross-cutting edit `PARALLEL.md` exists to prevent. The geometry is written out in 4.6.4 for whoever takes it |
| 26 | 187ms of near-silence, and a 59ms difference nobody can feel | **APPLIED.** `FLY = 0.06 + 0.13 * d.p`, `detFly`'s default and clamp floor move with it |
| 27 | the subtitle prints the number because the picture does not carry it | **APPLIED.** The close prints `FAMS[fam].n`; the drag and the slant keep their numbers, because the drag has no other readout |
| 28 | the out has no destination, so it should not travel | **APPLIED, the "stop" arm.** No lift: a hard bottom-up clip over 60ms, the same technique as the tear and the cut. **REFUSED, the "commit" arm:** flying the line to the Echo bar is a magic layer reaching into the HUD to reward a state it caused, which is the same call refused for `-ill`'s breath meter in §3 |
| 29 | `flyPx` uses the wrong curve by the design's own doctrine | **APPLIED.** `round(8 * fxS(n))` |
| 30 | the Verse column admits it is a progress bar and ships anyway | **APPLIED.** Every mark is a miniature rule with 1px brass caps, the brackets are the same bracket, the plates are the same plate |
| — | the caveat: the `ARC` sign flip keys off the wrong thing | **APPLIED.** It keys off the screen spread of the hits, computed in the loop that already computes the centroid, and the wide case's control point is an absolute ground y so the syllables genuinely skate |

**`crit-art-proj.md`**

| # | finding | ruling |
|---|---|---|
| 1 | the muzzle comes out of the lantern; the verb is speech | **APPLIED.** The mouth, the cone deleted, and the flash is the word itself at 0.55 scale getting bigger |
| 2 | the rhyme is never on screen | **APPLIED.** 4.0.1, and it is the same fix as `crit-art-deton` #1 |
| 3 | the stack is a syllable and you fly in a UI badge | **APPLIED.** The impact word splits: the head falls as grey matter, the rhyming tail is what flies into the row |
| 4 | the pip chip is a debuff bar with a tilt | **APPLIED by §3, harder than asked.** The eleven layers are gone: one glyph per cell, the family's own erosion, the plate, and the alarm |
| 5 | `FAMS.ight.tag` is four characters in a 24px chip | **MOOTED.** One glyph per cell, no tag in the row, no width to overrun |
| 6 | the brightest pixels in the magic layer belong to a counter | **APPLIED by deletion.** There is no badge; the count is the number of cells |
| 7 | every leading edge is drawn inside the word's own ink | **APPLIED.** The head is offset by half the word's advance plus 6px along `c.sa` |
| 8 | the palette is opened in seven places | **APPLIED in 2.4**, plus the two `-eat` literals corrected in 4.9.3. One dark, `#08060c` and alpha; one red for a cost paid and one for a cost coming |
| 9 | the head glow is a flat disc | **APPLIED.** `glowAt` with the one banded sprite (2.6) |
| 10 | every new stroke is subpixel anti-aliased | **APPLIED.** `drawCalls` sets `lineWidth = 1` before every dispatch, the contract forbids raising it, weight is two 1px lines, and every fed coordinate is rounded |
| 11 | `-ark` wobbles; the fiction is hoarding, not shyness | **APPLIED in §3.4.** Recorded here because the ruling is shared: no wobble, a 2x2 bright core inside the dark head, and the ground hole drawn over the lamp pools so it eats them |
| 12 | the `-erd` ground mark claims an idiom it is not | **APPLIED in §3.3.** One vertical bar per quantisation step, which merges the ground mark and the tick trail into one object |
| 13 | power is a smooth ramp; humans read steps | **APPLIED.** One threshold at `n >= 5`, matched to the sound that already exists: the impact word double-strikes and the cracks stop waiting on `frac` |
| 14 | sour is generic damage attribution and the thesis is right there | **APPLIED.** `RIME_OFF`: the glyph goes to the wrong letter for two frames before the cell breaks |
| 15 | the drag's word swap flashes white; the house idiom is the bar | **APPLIED.** A 2px bar in the destination glow sweeps the cell, old sound ahead of it and new sound behind, two clips and one rect, which is `drawCuts`' structure |
| 16 | twenty-five folk, twenty-five chips, over the vignette: a fence | **APPLIED.** The crowd collapse: over twelve foes, a single-cell row loses its plate and is one glyph over a head |
| 17 | nothing here has ever been out of breath | **APPLIED.** `c.thin`: the word goes hollow, the trail thins, the ground mark stops reaching the floor |
| 18 | the board never acknowledges being addressed | **APPLIED.** `RT.said`, 50ms, and it is the `T0` beat the two-zeroes structure was short of |
| 19 | the fizz is a whiff animation and should be the game's central image | **APPLIED.** It hangs 0.22s, then falls 22px over 0.5s going grey from the tail forward, and there are no particles |
| 20 | the `-ight` afterimages will mush | **APPLIED in §3.2.** Each ghost drops a leading letter: `WHEAT`, `HEAT`, `EAT`, `AT`, so they shorten as they recede and the thing left hanging furthest back is the rhyme |

**`crit-eng-proj.md`**

| # | finding | ruling |
|---|---|---|
| 1 | every directional shape uses a world angle as a screen angle, 26° to 63° wrong | **APPLIED.** `c.a` world, `c.sa = isoAng(c.a)` screen, and `c.a + PI/4` inside a ground frame |
| 2 | `c.near` cannot exceed ~0.5, so most of the last-frames design is dead code | **APPLIED.** `nearFoeD` returns the distance `firstFoeAt` already computes, and `near` reaches 1 at contact on every radius in the bestiary |
| 3 | `stepSyl` sits in the alive-only branch, and the commonest death is a lapse | **APPLIED.** The layer is a `regFx` stepper and `stepFx` is above the `RT.dead` branch (2.9 hook 5), so the wreckage resolves and the number pops on the lapse that killed you |
| 4 | `pipChip` applies the chip height twice: 11px above its stated anchor | **MOOTED and guarded.** There is no chip; the row is drawn at `foeStackY(f)`, which is the one helper every consumer now uses |
| 5 | the pip fly-in reads the impact point from the wrong origin | **APPLIED.** The fly-in lerps between `punchWX(isoX(s.fx, s.fy))` and the cell's own x, both in the same space |
| 6 | `drawLeash` mutates its own list inside the drawer, unscaled by dt | **APPLIED by deletion.** The leash is the haul's rope and the haul is a pure function of `d.t` |
| 7 | leash endpoints and sour pieces are stored in screen pixels | **APPLIED.** World tiles everywhere, projected in the drawer, for the haul, the lands, the sours and the thread |
| 8 | `frac` is pinned at maximum for the entire audience | **APPLIED.** `(f.def.folk \|\| !f.hpm) ? 0 : ...`, which also closes the `0/0` NaN font-string path |
| 9 | `PIP_TAGW` is measured once, possibly pre-webfont, and cached for the session | **APPLIED and generalised.** One `PSA`, with the two-agreeing-measurements guard the design promised, and every width in the section derives from it |
| 10 | the life bar divides by `T('stackLife')` while the crown makes stacks 5.5s | **APPLIED differently.** No bar: the fade and the family's erosion run off `s.t / s.max`, which is written at birth and is correctly *reduced* by the drag |
| 11 | the drag's "9% overshoot" is a 13% snap | **MOOTED.** The chip slide is gone; the haul's cells do not travel, they are wiped in place |
| 12 | eleven chip layers do not fit in fifteen pixels and `pipScale` scales four | **APPLIED.** The layers are gone and `pipScale` is cut, with the reason stated in 4.11 |
| 13 | `-erd` is drawn at the muzzle for the first 31% of its flight | **APPLIED.** `st: 1` in the literal, so the first step fires on frame one |
| 14 | the drag's destination chip never merges | **APPLIED.** The haul owns the whole row and wipes it cell by cell, so the merge is the wipe |
| 15 | per-frame allocations the Perf section does not name | **APPLIED.** Every one named in 4.14, and four of the six removed |
| 16 | `MIXC`'s memo is bigger than stated and outlives `close()`; `PIP_ORD` holds foes | **APPLIED.** `MIXC` is bounded in 2.4, `PIP_ORD` is cleared at the end of its own pass **and** in the travel reset |
| 17 | the `small` gate fires on the fourth lapse, not the third | **APPLIED.** The counter increments before the pieces are made |
| 18 | `RT.casting` freezes while dead and ages on the sim clock | **APPLIED.** Real clock, decayed beside the other real-clock lines |
| 19 | the hand point is ~4px off and justified with a bad reason | **MOOTED.** The muzzle is at the mouth and the comment is gone with it |
| 20 | four promised beats the code omits | **APPLIED.** The `pipWarn` ring is one `RT.rings` push from `stepStacks`; `dragland` is cut with the leash; the `-erd` ground bar is one vertical per step (`crit-art-proj` #12); the drag's life tick flies off the haul's bar |
| 21 | `drawSours` draws a fixed 32x15 half regardless of the chip | **APPLIED.** The piece is one cell wide, `PIP_W + 4`, because there is no chip to be the wrong size |
| 22 | `sfx('pipwarn')` can fire dozens of times in one frame | **APPLIED.** `fxSfx('pipwarn', 0.25)` |
| 23 | small correctness and tidiness items | **APPLIED, each:** `dragAge` and `rhymeCost` are not re-declared and the comma is added once (2.9 hook 2); `RT.dbgStacks` keeps its readout in the rebuilt `drawStacks`; `callMark` is renamed `mark` on the row, so nothing collides with `RT.story.callMark`; the dead `f` and `k` parameters are gone with the chip; `T('stackLife')` is not called per tick; `SOURQ.hp` is rounded; `spray` and `foeH` have one owner each (2.1); `RT.rings` is cleared by the shared travel reset (2.2); the `RT` literal takes **one** line, not three; and the `drawFoe` deletion is called out in the PR body because a both-sides merge draws the row twice |

**What the critiques said to keep, kept:** the two-zeroes structure and the retiming
of `slam` out of the keypress; converge before expand; the `ARC` sign flip, on a
better axis; the rule outliving the line and closing to a caesura; the patch, the
nails, and the bracket that can never be drawn over the false line; matter freezes
and letters do not; the `-erd` stutter-step; the `-ill` hesitation; the impact hold;
the `-ill` stationary trail; the sour chip clipped on a diagonal; and the drag's
colour crossover, which is now a bar sweep and is the same idea with the house's own
edge on it.

**Section 4 ends here.** One entry point, nine outcomes, one record, one scalar, and
one hundred and eight critique findings ruled.

---

## 5. THE EDIT LIST

Every existing function that changes, in the order to work through them. Line
numbers are `88c665c`; **grep the quoted line, not the number**, because the edits
above an edit move the ones below it.

### 5.0 How to work through it

1. `node --check comp/ninth.js` **before you start**, so you know the baseline is
   clean, and again after every numbered step. The whole game is one IIFE: a
   missing comma in an object literal is a `SyntaxError`, which is a blank canvas
   on every page of the site, and the two shared lines in 5.1 are where it will
   happen.
2. Work top down. The order below is dependency order: the tables and the helpers
   land before the functions that call them, so the file is loadable at every step
   even though it is not yet correct.
3. **Two things must be tested with real key events, not `window.__ninth`.** A
   build once shipped where pressing E did nothing and the dev handle reported
   everything working (`TESTING.md`). The two are: closing a rhyme on the number
   row, and a Call landing on a body. Everything else in this section hangs off
   those two.
4. The three grep assertions that catch the likely merges:
   `assembleLine(` appears exactly **twice** (the declaration and `detGather`'s
   call); `drawStacks(` appears exactly **twice** (the declaration and `drawPips`'
   call, **never** in `drawFoe`); and `function fxP` appears exactly **once**.

### 5.1 `TUNE`, the tail at 187, and the FEEL rows — one change, both files

This is one of exactly two guaranteed merge conflicts in the overhaul. `rhymeCost:
15` has **no trailing comma**. §2.9 hook 2 adds the comma once and appends the
thirteen punch keys; **this section appends ten more below them and edits no
existing character.**

```js
    rhymeCost: 15,       // what closing a rhyme costs. answerCost is its old name
    ... the thirteen punch keys from 2.9 ...
    punchBloom: 0.55,    // RT.flash written at full power
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
    pipWarn: 1.0         // seconds of stack life left when the row starts shouting
};
```

**`pipWarn` is new**, and `design-proj` read it in three places without ever adding
it: `T('pipWarn')` on an absent key returns `undefined`, so `s.t < undefined` is
`false` and the whole three-stage alarm is dead code. That is a defect neither
critique caught and it is one line.

The FEEL rows go at the tail of the FEEL tab, **before** the
`Reset every number to default` button at 967, which is the one row that must stay
last. `get` goes through `T(k)`, `set` writes `S.tune[k]` and never `TUNE[k]`, and
`fillDev` already calls `sSave()` after every row action.

```js
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
```

**Not tunable, deliberately.** `fxP`'s knee of 7, because `fxP` **is** `punchP` and
2.7 owns that curve; `fxS`'s 0.62 and `fxW`'s 0.055, because they are the shape of
the whole overhaul and thirteen documents quote their output tables; `VH * 0.30`
and `VH * 0.62`, because the line and the slam are a composition and not two
numbers; and every duration called punctuation in 4.13.

### 5.2 The `RT` literal, 1566-1568 — one line, and it is §2.2's

No new line is added by section 4. `RT.det` and `RT.said` are **not** on the
literal: they are assigned lazily and read as `undefined` until first use, which is
exactly how every consumer tests them, and both are nulled by the one shared
`onPlaceChange`. Every other new field in section 4 lives either on `RT.fx`
(through a `regFx` `make()`), on a foe (`f.rowT`, `f.detG`, the precedent is
`f.burn`) or on a stack (`s.fly`, `s.sl`, `s.slT`, `s.w`, `s.i`). **One line in a
shared literal is one merge conflict; four is four.**

### 5.3 The new code, and where it goes

Banner A (above `CALL AND ANSWER` at 2150) gains section 4 in this order, after
2.4's colour block:

| order | block | from |
|---|---|---|
| 1 | `RIME`, `rimeCut`, `rimeText`, `rimeHollow`, `PSA`, `psaBoot` | 4.0.1, 4.0.2 |
| 2 | `DET_KIND`, `FAM_DET`, `regDet`, `DET_AGAIN`, `DET_AGAIN_TH`, `DET_AUTO` | 4.1 |
| 3 | `detonate` | 4.1 |
| 4 | `assembleLine`, `hasLoudLine`, `detSegs`, `detSegLay`, `detGather`, `detFlyer`, `detWordPath`, `detCells` | 4.2 |
| 5 | `stepDet`, `detFire`, `detEase`, `detAt`, `detJolt`, `detRule` | 4.3 |
| 6 | `drawDetWorld`, `drawRoomDown`, `bracket`, `drawDetScreen`, `detHalo`, `FAM_LINE`, `drawFamLine` | 4.4 |
| 7 | `FAM_SNAP`, `regSnap`, `snapStacks`, `snapDefault`, `drawSnaps` | 4.5 |
| 8 | `dressSlant`, `drawHaulWorld`, `drawSlantScreen` | 4.6 |
| 9 | `REP_BEAT`, `repDress`, `repTrim`, `drawRepWorld`, `drawRepScreen` | 4.7 |
| 10 | `dressStanza`, `stzRowY`, `stepStz`, `stzWord`, `drawStzScreen` | 4.8 |
| 11 | `VERSE_FAM`, `verseCol`, `VRS_TOP`/`VRS_PITCH`/`VRS_COLW`, `verseCols`, `vrsX`, `stepVrs`, `drawVrsScreen` | 4.8.3 |
| 12 | `PIP_W`, `PIP_ORD`, `nearFoeD`, `RIME_OFF`, `drawPips`, `callFizz`, `stepProj`, `drawProjWorld`, `drawMuzzle` | 4.9 to 4.12 |

Nothing in it runs at load: `FX`, `FAM_DET`, `FAM_SNAP`, `FAM_LINE`, `DET_KIND`,
`RIME`, `PSA`, `PIP_W` and `PIP_ORD` are plain `var`s at file scope and every
function body only runs after `init`. The one exception is
`FAM_IDS.forEach(function (q) { FAM_SNAP[q] = snapDefault; })` at the foot of block
7, which reads `FAM_IDS` (149) and is therefore below it. That is the whole
ordering constraint.

**One helper the edits below all call**, so the row copy is written once rather
than in five call sites:

```js
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
```

### 5.4 `bigLine`, 1471-1474 — one word

```js
function bigLine(txt, sub, col, dur, pin) {
    RT.lines.push({ txt: txt, sub: sub || '', col: col || '#f0e9df', t: dur || 2.2, max: dur || 2.2, pin: pin ? 1 : 0, age: 0 });
}
```
becomes
```js
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
```

### 5.5 `drawLines`, 1482-1495 — the typewriter is a rate

```js
        } else {
            L.t -= dt;
            if (L.t <= 0) { RT.lines.splice(i, 1); continue; }
            k = 1 - L.t / L.max;
            a = clamp(L.t / 0.5, 0, 1);
            y = VH * 0.3 + i * 44;
        }
        var chars = Math.ceil(L.txt.length * clamp(k / 0.35, 0, 1));      // typewriter in
```
becomes
```js
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
```

`k` keeps its other two readers (the sub's fade at 1496 and the pinned branch) and
nothing else moves. **This is a shared drawer and §2.9 hook 11 also edits it**:
whoever lands second keeps whichever version is in the file and re-applies the
other change. The two do not touch the same line.

### 5.6 `fampx()`, in 2.4 — two keys

```js
        FAMPX[id] = { rgb: rgb, grgb: g, col: F.col, glow: F.glow, tag: F.tag,
```
becomes
```js
        FAMPX[id] = { id: id, rgb: rgb, grgb: g, col: F.col, glow: F.glow, tag: F.tag,
            tag3: F.tag.slice(0, 3),                 // the row's glyph, sliced once, not per cell per frame
```

`id` is what lets `rimeText` name the family from a paint row alone; `tag3` is what
`design-deton-4` sliced up to six times per cell per frame.

### 5.7 `doCall`, 2383-2392 — the record

```js
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
```
becomes
```js
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
        qx: RT.px + Math.cos(a) * 0.5, qy: RT.py + Math.sin(a) * 0.5, st: 1,
        /* how out of breath you were when you said it. Read once, here,
           because the word does not get its wind back mid flight. */
        thin: clamp(1 - RT.breath / Math.max(1, stats().breathMax), 0, 1) });
    /* the muzzle throws its matter FORWARD, once, on the frame the key
       went down, rather than in a circle every frame from a drawer. */
    spray(RT.px, RT.py, 30, 4 + (couplet ? 3 : 0), a, 0.5,
          { col: fampx()[fam].rgb, sp0: 1.2, sp1: 3.4, l0: 0.12, l1: 0.3, s0: 1, s1: 2.2, grav: 90 });
```

`st: 1` is `crit-eng-proj` #13: `-erd`'s quantiser started at 0, so the word was
drawn in your hand for the first 182ms of a 577ms flight.

### 5.8 `stepCalls`, 2419-2436 — replaced

Before is 2419-2436 verbatim; after is 4.9.2 in full. Three behaviours change: the
trail is dt-driven through `c.et` instead of `Math.random() < 0.6` (which emits 2.4x
more at 144Hz than at 60), `c.near` is a real distance, and a call that runs out
calls `callFizz` instead of vanishing.

### 5.9 `landCall`, 2442-2459 — replaced

```js
function landCall(f, c) {
    var st = stats();
    var dmg = st.callDmg * famDmgMul(c.fam) * deafMul(f, c.fam);
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
```
becomes
```js
function landCall(f, c) {
    var st = stats(), q;
    var dmg = st.callDmg * famDmgMul(c.fam) * deafMul(f, c.fam);
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
    punch({ fam: c.fam, power: 1 + n, kind: 'tap', x: f.x, y: f.y });
    fxSfx('hit', 0.04);
    fxSfx(n >= 5 ? 'stick.big' : 'stick', 0.05);
}
```

The `typo` and the `burst` are gone: the impact word is the `lands` record, which
holds still for `0.05 + 0.015n` and then breaks, and the circle is the cone. `sfx`
becomes `fxSfx` because a couplet lands two stacks on one frame.

### 5.10 `addStack`, 2461-2469 — the word, the arrival, the overflow

```js
function addStack(f, fam) {
    if (f.def.norhyme) {                      // nothing rhymes with sword
        typo(f.x, f.y, 'NO RHYME', '#8a8090', 0.55, 9, 'drift');
        return;
    }
    var st = stats();
    f.stacks.push({ fam: fam, t: st.stackLife, max: st.stackLife, born: RT.t });
    while (f.stacks.length > st.stackMax) f.stacks.shift();
}
```
becomes
```js
/* `word` is what was said to plant it, and it is what lets the
   detonation assemble its line out of the bodies the words actually
   came from instead of out of i % wide. fx/fy is where the call
   landed, so the syllable can fly from there into its slot. dly is the
   couplet's second stack, 50ms behind the first. All four are
   optional: the Droner's self-write at 3351 passes none of them. */
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
```

The Droner's own push at 3351 gains `born: RT.t` in the same edit, because
`crit-eng-eat` #11 found every drone `-eat` pip seeded off `(s.born || 0)` coming
out identical and flat-bottomed. It stays a raw literal rather than an `addStack`
call, because it deliberately bypasses the `norhyme` guard and the cap.

### 5.11 `stepStacks`, 2470-2480 — the warning, once

```js
            var s = f.stacks[j]; s.t -= dt;
            if (s.t <= 0) { f.stacks.splice(j, 1); breakStack(f, s); }
```
becomes
```js
            var s = f.stacks[j], was = s.t; s.t -= dt;
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
            if (s.t <= 0) { f.stacks.splice(j, 1); breakStack(f, s); }
```

### 5.12 `breakStack`, 2484-2502 — replaced

```js
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
```
becomes
```js
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
    /* Counted BEFORE the pieces are made, so the third lapse of a burst
       is the third and not the fourth. */
    q.n++; q.hp += T('breakSelfDmg'); q.t = 0.05;
    sourBreak(f, s, q.n <= 3 ? 1 : 0, 1);
    RT.sourN = (RT.sourN || 0) + 1;
    if (RT.sourN >= 4) ach('sour');
```

and the HP comes off **in the coalescer**, one frame later, through the front door:

```js
/* One number, one red, one event, however many lapsed. RT.hp -= at
   2495 bypassed hurtPlayer and therefore the i-frames and the screen
   reaction every other damage source in the game gets, and it was also
   the one source that never popped a number. Rounded, because
   breakSelfDmg is DEV settable and 2.5 x 3 prints -7.5. */
    if (q.t > 0) {
        q.t -= real;
        if (q.t <= 0) {
            if (!RT.god) hurtPlayer(Math.round(q.hp), 'sour');
            if (q.n > 1) typo(RT.px, RT.py + 0.55, q.n + ' lapsed', '#6a5f72', 0.6, 8, 'drift');
            fxSfx(q.n >= 3 ? 'sourmulti' : 'sour', 0.05);
            q.n = 0; q.hp = 0;
        }
    }
```

**This is a mechanical change and it is in the PR body**: a six-stack lapse now
respects i-frames. `downPlayer()` is `hurtPlayer`'s job and it already does it.

### 5.13 `doRhyme`, 2578-2668 — collect, then fire

The largest edit in the branch, in five pieces. **No mechanic changes.** Every
`hurtFoe`, every `f.stacks` mutation, every achievement and the whole soft-wax
branch are byte-identical afterwards.

**(a) the head, 2578-2581.**

```js
    var word = FAMS[fam].tag;
    RT.lastWord = word; RT.lastFam = fam;          // the Reprise says the last thing you said
    var totalMatched = 0, hitFoes = 0, best = 0, dragged = 0;
```
becomes
```js
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
```

**(b) the row copy and the survivors' slide, above `hurtFoe` at 2618.**

```js
        dmg *= deafMul(f, fam);          // the deaf hear nothing: only -ill touches them
        hurtFoe(f, dmg, fam, { answer: 1, closed: takes, n: n });
        if (takes) { totalMatched += n; if (n > best) best = n; famEffect(f, fam, n); }
        hitFoes++;
```
becomes
```js
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
        /* dead, honestly. hurtFoe calls foeDie on lethal (2856) and
           foeDie only sets f.dead = 1 (3421), so this is readable on
           the very next line and the visual can decide to draw its
           matter free standing instead of through a sprite that will
           never be drawn again. */
        hits.push({ f: f, n: n, dead: f.dead ? 1 : 0, took: takes ? 1 : 0,
                    was: wasFam, cells: cells });
        if (takes) { totalMatched += n; if (n > best) best = n; famEffect(f, fam, n); }
        hitFoes++;
```

**(c) the drag branch, 2632-2636** gains one token, so the haul can draw a bar off
a life the drag has already spent, and so the row drawer stands down while the haul
owns it:

```js
            var age = clamp(T('dragAge'), 0, 0.95);
            f.stacks.forEach(function (t) { t.fam = fam; t.t *= (1 - age); dragged++; });
```
becomes
```js
            var age = clamp(T('dragAge'), 0, 0.95);
            f.stacks.forEach(function (t) { t.fam = fam; t.t *= (1 - age); t.slT = 0; dragged++; });
            f.rowT = 0.42;              // the haul owns this row. See dressSlant
```

**(d) the last line of the loop, 2639, goes entirely.**

```js
        snapStacks(f, takes ? FAMS[fam].col : '#6a5f72', n);
    });
```
becomes
```js
        // snapStacks has moved into detGather, where the width of the
        // detonation is known and the burst can be divided before the
        // loop instead of part() dropping the tail of the Act 3 square
        // in silence
    });
```

**(e) the tail, 2642-2661 — one call per outcome.**

```js
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
        // the town, who cannot be dragged, and anyone the drag toggle is off for
        ach('slant');
        slam(word, '#6a5f72', 'slant');
        RT.shake = shake(3);
        sfx('slant');
    } else {
```
becomes
```js
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
```

The `else` branch is unchanged: a rhyme with nothing to rhyme with cost nothing, it
still ended the line, and it still gets one grey word at your feet. `hits` is empty
there and `detonate` returns null on an empty list anyway, so the branch *could*
call it harmlessly. It does not, because a shout in an empty room is not a
detonation and should not be drawn like one.

`best` above is still the one assigned only inside `if (takes)`, so it is still 0
on a drag and a slant. **Leave it.** It feeds `ach('six')` and nothing else now,
and the detonation computes its own `best` over every hit regardless of `takes`,
which is the bug `crit-eng-deton` describes and the reason nothing geometric may
read this one.

### 5.14 `assembleLine` 2670-2682 rebuilt, `drawAssembly` 2683-2713 deleted

Before is 2670-2682; after is 4.2.2. The signature changes from `(fam, n)` to
`(d)`, the only caller is `detGather`, and the `if (!n) return;` guard goes with
it: `detonate` already returned on an empty `hits`, and a line allowed to exist
with no words is how `RT.assembly` became a singleton nobody could clear.

`drawAssembly` goes **entirely**, and with it:

- `cx.shadowBlur = 14 * ease` (2702), **the only blurred edge in 8279 lines**,
  replaced by `detHalo`: a hard scaled copy of the same glyphs, additive.
- the hash scatter `((i * 97) % 13) / 13` (2698), a cloud in screen space that has
  never seen an enemy, in a function whose own comment says the whole idea is
  scattered words becoming a line.
- `RT.assembly`. The field stays on the `RT` literal (it is not this branch's line
  to edit and it costs one property) and the shared reset keeps nulling it, so a
  stale one from any path cannot survive a doorway.

Its call in `draw()` is deleted, not moved: §2.9 hook 8 already shows the merged
`draw()` with `drawAssembly` gone and `drawFxS` after `drawMap`.

### 5.15 `doAnswer`, 2717-2725 — one word

```js
    doRhyme(best || (rhymeReady(answerFam()) ? answerFam() : FAM_IDS.filter(rhymeReady)[0] || 'eat'));
}
```
becomes
```js
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
```

### 5.16 `doReprise` and `stepReprise`, 2736-2784 — replaced

Before is 2736-2784; after is 4.7 in full, plus `repDress` and `repTrim` in banner
A. Four behaviours change: the announcement's `shake(9)`/`chroma = 1` become one
`slam` bag, the `bigLine('again', ...)` goes, each beat fires one `detonate` on its
own rung of `REP_BEAT`, and the record outlives the last beat by 0.45s so the tally
can close.

### 5.17 `snapStacks` and `drawSnaps`, 2799-2815 — replaced

Before is 2799-2815 verbatim; after is 4.5. Three behaviours change: the height
stops being a literal `- 44` and is stored per record, the family gets an opt-out,
and the burst is thinned by the detonation's width and by `detSnap`. `RT.snaps`
records gain `h` and `fam`; `drawSnaps` keeps ageing its own list and keeps its own
line in `draw()`.

### 5.18 `hurtFoe`, 2854 — `o.n`, read at last

Four call sites have passed it since the answer was written and none has read it,
so closing one stack and closing twelve print the same 16px number.

```js
    if (o.answer) typo(f.x + rnd(-.2, .2), f.y, String(dmg), o.closed ? FAMS[fam].col : '#8a8090', 0.8, o.closed ? 16 : 12, 'drift');
```
becomes
```js
    if (o.answer) typo(f.x + rnd(-.2, .2), f.y, String(dmg), o.closed ? FAMS[fam].col : '#8a8090',
                       /* fxS is the file's one size curve: 13px at one
                          syllable, 21 at four, 34 at the cap. The
                          number is a readout of the pile and not just
                          of the damage. */
                       o.closed ? 0.8 + 0.25 * fxP(o.n || 1) : 0.55,
                       o.closed ? Math.round(13 * fxS(o.n || 1)) : 12, 'drift');
```

No other line of `hurtFoe` moves, and it already returns the damage it did, which
is what lets `doRhyme` fill in `dead` honestly instead of guessing.

### 5.19 `doStanza` 2886-2900, `stepRecital` 2901-2913, `stanzaWave` 2915-2928

**`doStanza`**, two lines after `RT.recital = { ... }`:

```js
    /* the stanza layer's four rules and its bracket. Built here rather
       than on the first wave, because the block has to exist before
       anything can be filed into it, and because a recital cast into an
       empty room still draws its rules: they are made of the syllables
       that arrived, and none arriving is a true statement about the
       room. */
    fxOf('stz').rows = [];
    fxOf('stz').fam = sz.fam;
```

**`stepRecital`**, the `while` body:

```js
        bigLine(r.sz.lines[r.line], isLast ? r.sz.lines[r.line].split(' ').pop().replace(/[.,]/g, '').toUpperCase() : '', FAMS[r.sz.fam].col, 1.1);
        stanzaWave(r.sz, isLast);
```
becomes
```js
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
```

**`stanzaWave`** is replaced by 4.8's version. The `RT.shake = shake(big ? 10 : 4)`
line goes and one unconditional `punch()` before the loop takes its place, because
a stanza into an empty room has no hits, `detonate` returns null, and the biggest
cooldown in the game would otherwise go off in silence. The `cells` copy goes
through `detCells(f, null, 1)`, the `hits` are collected, and the fourth line fires
`'land'` while the other three fire `'wave'`.

### 5.20 `doVerse` 2947-2982 — the state, the stamps, the dilation

Everything above 2947 is untouched: the lock, the nudge, `verseSpent`. The 28
`setTimeout`s stay and each one now calls `verseStamp(i, ln, col)` and nothing
else; the `j === 3` block and its four `irnd` picks come out of the timer entirely
and become `versePulse`, called from `verseStamp`. `RT.dilate = 6` becomes
`i * 0.26 + 0.9`, `RT.mono` becomes `i * 0.26 + 1.3`, and `fxOf('vrs')` is filled
with `cols`, `i`, `a` and `life` on the frame the key goes down. `standWave` sorts
by distance instead of taking four at random. All four functions are in 4.8.3.

`S.a3.verseSpent` stays exactly where it is, committed in the last timer with the
doorway guard at 5535-5538 behind it. Nothing here touches the one-shot.

### 5.21 `drawFoe`, 3488 and 3526 — two lines

```js
    var h = f.def.boss ? 130 : (FOE_H[f.def.draw] || 30);
```
becomes
```js
    var h = foeH(f);
```
and
```js
    drawStacks(cx, f, sx, sy - h - 18 - (f.so || 0));
```
becomes
```js
    // the rhyme row is drawn by drawPips at the world seam now, OVER
    // drawLights and drawVignette instead of under them. Do not restore
    // this line in a merge: a both-sides merge draws the row twice, once
    // dark and once bright, and it looks like a shadow rather than a bug.
```

### 5.22 `drawStacks`, 3536-3563 — replaced

Before is 3536-3563 verbatim; after is 4.11's version plus `drawPips`. The `n`,
`w`, `plateW` layout and the `13px` pitch are preserved exactly, as `PIP_W`. The
`RT.dbgStacks` readout is carried over, so the DEV toggle at 1008 is not orphaned.

### 5.23 `FOE_H`, 3684 — one row

```js
var FOE_H = { mouth: 24, thief: 34, droner: 30, deaf: 32, sword: 36, folk: 30 };
```
becomes
```js
/* sprite rows times PXS, kept beside the art so the two cannot drift.
   `chorus` was missing and every caller fell through to the `|| 30`,
   which is why foeH's boss branch exists and why it now has a belt as
   well as braces. */
var FOE_H = { mouth: 24, thief: 34, droner: 30, deaf: 32, sword: 36, folk: 30, chorus: 130 };
```

### 5.24 `drawCalls`, 3933-3949 — replaced

Before is 3933-3949 verbatim; after is 4.9.3. It keeps its own name and its own
line in `draw()` inside zoom block B, so no seam changes. `drawFproj` three lines
below it is **not** touched by this section, and its `createRadialGradient` is
§2.6's to replace.

### 5.25 `revive()`, 1785 — three lists

```js
    var p = fxOf('proj');
    p.lands.length = 0; p.sours.length = 0; p.q.n = 0; p.q.hp = 0; p.q.t = 0;
```

A lapse is the commonest way to die, so the wreckage of the lapse that killed you
is on screen when you go down; `stepFx` keeps ageing it through the death, which is
correct, but it must not still be there when you get up two and a fifth seconds
later.

### 5.26 `fxBoot` — the registrations

§2.2's `fxBoot` already lists `det`, `haul`, `mend`, `rep`, `dim`, `line`, `stz`,
`vrs` and `punch`. Section 4 adds one and fills in the drawers:

```js
    regFx('proj', stepProj, drawProjWorld, { ord: 70,
          make: function () { return { lands: [], sours: [], q: { n: 0, hp: 0, t: 0 } }; } });
```

and three lines in the one shared `onPlaceChange`:

```js
        RT.det = null; RT.said = null;
        PIP_ORD.length = 0;               // it holds foe references from the last drawn frame
        RT.rings.length = 0;              // uncapped, never cleared by gotoPlace, and the drag pushes one
```

`drawProjWorld` is the single world pass for the whole projectile layer, in this
internal order: the rows (far to near through `PIP_ORD`), then the impact records,
then the sour pieces and their threads, then the muzzle. One registration, one
`ord`, one sort.

### 5.27 `__ninth`, at 1581 — two lines

```js
            det: function () { var d = RT.det; return d ? { fam: d.fam, kind: d.kind, total: d.total, best: d.best, wide: d.wide, t: d.t, fired: d.fired, segs: d.seg.length } : null; },
            rep: function () { var r = RT.combat.rep; return r ? { i: r.i, of: r.of, fam: r.fam, done: r.done } : null; },
```

So a harness can assert the ladder and the segment count rather than counting
pixels. Both are read-only and neither is on the hot path.

### 5.28 The order, as a checklist

| # | file position | what | `node --check` |
|---|---|---|---|
| 1 | 187 | `TUNE`: the comma, then ten keys | yes |
| 2 | 967 | ten FEEL rows before the reset button | yes |
| 3 | 1471 | `bigLine` returns its record | |
| 4 | 1482 | `drawLines` ages, and types off age | |
| 5 | 1785 | `revive()` clears the three lists | |
| 6 | 2150 | banner A: all twelve blocks of 5.3 | yes |
| 7 | 2383 | `doCall`: the record, the muzzle, the forward spray | |
| 8 | 2419 | `stepCalls` replaced | |
| 9 | 2442 | `landCall` replaced | |
| 10 | 2461 | `addStack` takes a word, and the overflow spills | |
| 11 | 2470 | `stepStacks` fires the crossing once | |
| 12 | 2484 | `breakStack` replaced | |
| 13 | 2578 | `doRhyme`, five pieces | yes |
| 14 | 2670 | `assembleLine` rebuilt, `drawAssembly` deleted | yes |
| 15 | 2717 | `doAnswer` returns the sound | |
| 16 | 2736 | `doReprise` and `stepReprise` replaced | |
| 17 | 2799 | `snapStacks` and `drawSnaps` replaced | |
| 18 | 2854 | `hurtFoe` reads `o.n` | |
| 19 | 2886 | `doStanza`, `stepRecital`, `stanzaWave` | |
| 20 | 2947 | `doVerse`, `verseStamp`, `versePulse`, `standWave` | yes |
| 21 | 3351 | the Droner's stack push gains `born` | |
| 22 | 3488 | `drawFoe` calls `foeH` | |
| 23 | 3526 | `drawFoe` stops drawing the row | |
| 24 | 3536 | `drawStacks` replaced, `drawPips` added | |
| 25 | 3684 | `FOE_H.chorus` | |
| 26 | 3933 | `drawCalls` replaced | |
| 27 | 1581 | two `__ninth` handles | |
| 28 | tail | `fxBoot`: `regFx('proj', ...)` and three reset lines | yes |

### 5.29 Acceptance, driven with real key events

1. **One `-ark` stack on one Thief.** One `ARK` arcs 57px over its head, lands in
   86ms, the words set with a 3px overshoot, a 2px rule strikes 9px wider than the
   line with **one notch** and two brass caps, and it is gone in 0.56s.
2. **Eight stacks on one elite.** Eight `ARK`s peel off one body one at a time over
   98ms, two coronas, 94ms of hitstop, a 3px rule overhanging 30px with **eight
   notches you can count**.
3. **Two `-eat` foes and one `-ark`.** The line prints three words, the heads dim
   and the three `EAT`s bright and aligned; the rule is three pieces.
4. **A kill.** A brass upright stands on the dead body's own piece of the rule and
   is still there when the caesura closes.
5. **A slant.** The words are grey and the baseline staggers, the rule strikes to
   60% and breaks, no caps, and the patch goes over the break **on top of the
   rule**.
6. **A drag.** The rope leaves the player, the cells wipe left to right with a bar
   sweep, the bars shorten by 35% as each flips, and **zero particles are emitted**.
7. **The Act 3 square.** Twenty-five tears, twenty-five flyers, twenty-five pieces
   of rule, fifty particles, the whole spread inside 0.22s, and it reads as one
   event. `RT.parts.length` never reaches 900.
8. **A recital.** Four lines of the true ballad stay on screen together, four rules
   strike under them, a bracket closes lines two and four, and the fourth line's
   rhyme word slams. Answer a rhyme mid-recital and your line assembles at y 96,
   above the ballad's, with neither drawn over the other.
9. **A stanza into an empty room.** No hits, no detonation, and **the shake and the
   four rules still happen.**
10. **A Reprise on a loft of sixteen.** Two words, then four, then six; one voice,
    then two, then three; a rule off both edges on the third; three marks and the
    bracket closing.
11. **The Verse in the square.** Twenty-eight marks light as miniature rules, seven
    brackets close, three plates fall, the crowd stands front to back, one man is
    still sitting at the end, and `WILL` slams once.
12. **A Call into a body carrying four.** The word holds still for 110ms, the head
    falls away grey, the `EAT` flies into the fifth cell and the plate pops, and
    the sound switches to `stick.big`.
13. **A lapse.** The glyph goes to the wrong letter for two frames, the cell breaks
    on a diagonal and falls, the thread eats itself toward you, and **one** number
    pops. Six at once still pops one number.
14. **A doorway mid-detonation, mid-Reprise and mid-Verse.** Nothing is on screen
    on the first frame in the new room.
15. `node --check comp/ninth.js` is clean, and `S.opts.punch = 0` still prints the
    line, the rule and the slam.

### 5.30 For the PR body

**New sound names**, all safe to ship silent: `tear`, `nib`, `rule`, `bracket`,
`crack`, `caesura`, `stick`, `stick.big`, `spill`, `callfizz`, `pipwarn`,
`sourmulti`, `drag`, `reprise`. Plus §2's `hold`, `lurch` and `settle`.
`answer` and `slant` move from the keypress to `TSET`.

**Three changes that are not visual and must be called out:**

1. A sour lapse goes through `hurtPlayer` instead of `RT.hp -=`, so it respects
   i-frames and pops a number. Six lapses on one frame are now one bill.
2. `RT.dilate` for the Verse is derived from the line count instead of a flat 6, so
   the last five lines of the ballad are no longer the only ones at full speed.
3. The recital's lines live `1.35 + (3 - i) * 0.375` seconds instead of 1.1, so all
   four are on screen together.

**Two merge hazards**, both worth a reviewer's eye: the `drawFoe` line that stops
drawing the row (a both-sides merge draws it twice), and `TUNE`'s trailing comma
after `rhymeCost: 15`.

---

## 6. THE SCALING TABLE

One table. Every quantity in the overhaul that moves with the pile, at the six
counts a player actually meets. **`n` is syllables**: stacks closed on one body for
a family row, `total` for a board row, `power` for a punch row. Where a quantity
depends on the *number of bodies* instead, the column head is read as **`wide`**
and the row says so.

Everything here is derived from §2.3's three curves and the frozen defaults at
`T0`. **No number below is independently authored.** If an implementation disagrees
with a cell, the formula wins and this cell is the erratum; the four that are known
to disagree are footnoted, and §12 rules on them.

`round()` is `Math.round`. Seconds are seconds. A frame is 6.94ms at 144Hz and
16.7ms at 60.

| quantity | formula | n=1 | n=2 | n=3 | n=4 | n=6 | n=8 |
|---|---|---|---|---|---|---|---|
| **THE THREE CURVES** (§2.3) | | | | | | | |
| `fxP(n)` = `punchP(n)`, "how loud" | `n/(n+7)*1.6`, cap 1 | 0.200 | 0.356 | 0.480 | 0.582 | 0.738 | 0.853 |
| `fxS(n)`, "how big" | `1+0.62*(√n-1)`, cap 2.6 | 1.000 | 1.257 | 1.454 | 1.620 | 1.899 | 2.134 |
| `fxW(wide)`, "how thin" — **read the column as `wide`** | `1-(w-1)*0.055`, floor 0.34 | 1.000 | 0.945 | 0.890 | 0.835 | 0.725 | 0.615 |
| `fxBudget(n, 1, 32)` at one body | `min(n, 32)` | 1 | 2 | 3 | 4 | 6 | 8 |
| **THE SCREEN PUNCH** (§2.7, `kind: 'close'`, `fam: 'none'`, option level 2) | | | | | | | |
| hitstop s | `0.11*p`, cap 0.17 | 0.022 | 0.039 | 0.053 | 0.064 | 0.081 | 0.094 |
| frames held at 144Hz | `stop/0.00694` | 3 | 6 | 8 | 9 | 12 | 14 |
| frames held at 60Hz | `stop/0.0167` | 1 | 2 | 3 | 4 | 5 | 6 |
| hitstop s, `-ill` (`stop 1.50`) | `×1.50`, cap 0.17 | 0.033 | 0.059 | 0.079 | 0.096 | 0.122 | 0.141 |
| hitstop s, `-erd` (`stop 0.45`) | `×0.45` | 0.010 | 0.018 | 0.024 | 0.029 | 0.037 | 0.042 |
| sim seconds elapsed during the hold | `stop * 0.04` | 0.001 | 0.002 | 0.002 | 0.003 | 0.003 | 0.004 |
| zoom target | `0.075*p`, cap 0.08 | 0.015 | 0.027 | 0.036 | 0.044 | 0.055 | 0.064 |
| **`pz.z`, the ladder rung actually drawn** | `1+round(zoom/0.02)*0.02` | **1.02** | **1.02** | **1.04** | **1.04** | **1.06** | **1.06** |
| rungs on the way back down (50ms each) | `(z-1)/0.02` | 1 | 1 | 2 | 2 | 3 | 3 |
| max screen displacement from the zoom, 250px out | `250*(z-1)` | 5 | 5 | 10 | 10 | 15 | 15 |
| `RT.shake` | `16*p`, cap 18 | 3.20 | 5.69 | 7.68 | 9.31 | 11.82 | 13.65 |
| peak shake offset, x (gain 0.5) px | `round(shake*0.5)` | 2 | 3 | 4 | 5 | 6 | 7 |
| peak shake offset, y (gain 0.35) px | `round(shake*0.35)` | 1 | 2 | 3 | 3 | 4 | 5 |
| `RT.chroma` | `0.85*p`, cap 1.2 | 0.170 | 0.302 | 0.408 | 0.495 | 0.628 | 0.725 |
| letter split, px each side | `round(1+chroma*5)` | 2 | 3 | 3 | 3 | 4 | 5 |
| `RT.flash` | `0.55*p`, cap 0.8 | 0.110 | 0.196 | 0.264 | 0.320 | 0.406 | 0.469 |
| bloom width px | `1120*(0.65+0.95p)` | 941 | 1106 | 1239 | 1347 | 1514 | 1636 |
| bloom height px, detonation `flat 0.28` | `bw*0.28` | 263 | 310 | 347 | 377 | 424 | 458 |
| added luminance at the core, `-ight` (the brightest family, `a .304`) | `flash*a*255` | 9 | 15 | 20 | 25 | 31 | 36 |
| added luminance at the core, `none` (`a .500`) | `flash*a*255` | 14 | 25 | 34 | 41 | 52 | 60 |
| `-ight`'s un-hiding fires | `p >= 0.55` | no | no | no | **yes** | **yes** | **yes** |
| **THE PUNCH, `kind: 'tap'`** (`landCall`, power = `1 + stacks already there`) | | | | | | | |
| `RT.shake` from a Call landing | `16*0.30*p`, cap 5 | 0.96 | 1.71 | 2.30 | 2.79 | 3.54 | 4.10 |
| `RT.chroma` from a Call landing | `0.85*0.20*p` | 0.034 | 0.060 | 0.082 | 0.099 | 0.126 | 0.145 |
| letter split from a Call, px | `round(1+ch*5)` | 1 | 1 | 1 | 1 | 2 | 2 |
| hitstop from a Call | `w.stop = 0` | 0 | 0 | 0 | 0 | 0 | 0 |
| **THE DETONATION, one body** (§4.13; `total = best = n`, `wide = 1`) | | | | | | | |
| `d.p` | `fxP(total)` | 0.200 | 0.356 | 0.480 | 0.582 | 0.738 | 0.853 |
| `d.sc` | `fxS(best)` | 1.00 | 1.26 | 1.45 | 1.62 | 1.90 | 2.13 |
| `d.th` (one body) | `fxW(1)` | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 | 1.00 |
| syllable release stagger, each s | `min(0.014, 0.10/n)` | — | 0.0140 | 0.0140 | 0.0140 | 0.0140 | 0.0125 |
| total release spread s | `(n-1)*rel` | 0 | 0.014 | 0.028 | 0.042 | 0.070 | 0.0875 [^a] |
| `FLY` s | `0.06+0.13p` | 0.086 | 0.106 | 0.122 | 0.136 | 0.156 | 0.171 |
| `TSET` s, the frame the room takes it | `0.035+FLY` | 0.121 | 0.141 | 0.157 | 0.171 | 0.191 | 0.206 |
| `HOLD` s | `0.10+0.16p` | 0.132 | 0.157 | 0.177 | 0.193 | 0.218 | 0.237 |
| `OUT` s | `0.18+0.12p` | 0.204 | 0.223 | 0.238 | 0.250 | 0.269 | 0.282 |
| **whole line life s** | `TSET+HOLD+OUT` | **0.457** | **0.521** | **0.572** | **0.614** | **0.678** | **0.725** |
| word px | `round(21+9p)` | 23 | 24 | 25 | 26 | 28 | 29 |
| word pitch px | `round(wordPx*1.05)` | 24 | 25 | 26 | 27 | 29 | 30 |
| set overshoot px | `round(2+5p)` | 3 | 4 | 4 | 5 | 6 | 6 |
| jolt px | `round(1+3p)` | 2 | 2 | 2 | 3 | 3 | 4 |
| halo α | `0.22+0.30p` | 0.28 | 0.33 | 0.36 | 0.39 [^b] | 0.44 | 0.48 |
| halo scale | `1.05+0.09p` | 1.068 | 1.082 | 1.093 | 1.102 | 1.116 | 1.127 |
| second corona | `n >= 8` | no | no | no | no | no | **yes** |
| rule thickness px | `clamp(2+⌊total/5⌋,2,6)` | 2 | 2 | 2 | 2 | 3 | 3 |
| rule overhang px | `min(round(6+3*total),190)` | 9 | 12 | 15 | 18 | 24 | 30 |
| **notches under the rule, countable** | `n` (to 12) | **1** | **2** | **3** | **4** | **6** | **8** |
| rule segments | `wide` | 1 | 1 | 1 | 1 | 1 | 1 |
| flying syllables | `fxBudget(n, 1, 32)` | 1 | 2 | 3 | 4 | 6 | 8 |
| flyer px | `round(8*fxS(n))` | 8 | 10 | 12 | 13 | 15 | 17 |
| flyer arc height px, tall board | `-(46+54p)` | -57 | -65 | -72 | -77 | -86 | -92 |
| **THE FIVE FAMILIES, per body** (§3) | | | | | | | |
| `-eat` notches | `clamp(2+round(0.9n),3,10)` | 3 | 4 | 5 | 6 | 7 | 9 [^c] |
| `-eat` notch w×h px | authored, 3 steps | 4×4 | 6×4 | 6×4 | 6×6 | 8×6 | 8×8 |
| `-eat` crumbs | `clamp(6+4n,8,40)*th`, cap 40 | 10 | 14 | 18 | 22 | 30 | 38 |
| `-eat` ring teeth | `clamp(10+n,12,16)` | 12 | 12 | 13 | 14 | 16 | 16 |
| `-eat` ring radius, tiles | `min(f.r+1.1+0.14n, 3.4)` | 1.66 | 1.80 | 1.94 | 2.08 | 2.36 | 2.64 |
| `-eat` world word px | `round(18*fxS(best))` | 18 | 23 | 26 | 29 | 34 | 38 |
| **`-eat` word eaten through** | `n >= 6`, and `ach('six')` is 6 | no | no | no | no | **yes** | **yes** |
| `-ight` cast-shadow lit α | `clamp(0.10+0.03n,.10,.34)` | 0.13 | 0.16 | 0.19 | 0.22 | 0.28 | 0.34 |
| **`-ight` spokes, countable** | `n>=5?3:n>=3?2:1` | **1** | **1** | **2** | **2** | **3** | **3** |
| `-ight` pin travel from px | `70+8n` | 78 | 86 | 94 | 102 | 118 | 134 |
| `-ight` shards, armoured body | `min(22,4+3n)*th` | 7 | 10 | 13 | 16 | 22 | 22 |
| `-ight` dust, bare body | `min(14,4+2n)*th` | 6 | 8 | 10 | 12 | 14 | 14 |
| `-erd` close `CT` s | `0.075+0.048*pb` | 0.085 | 0.092 | 0.098 | 0.103 | 0.110 | 0.116 |
| `-erd` bar reach `D` px | `40+168*pb` | 74 | 100 | 121 | 138 | 164 | 183 |
| `-erd` bar width `BW` px | `clamp(2+⌊n/3⌋,2,5)` | 2 | 2 | 3 | 3 | 4 | 4 |
| **`-erd` bar segments, countable** | `n`, last empty at `stackMax` | **1** | **2** | **3** | **4** | **6** | **8** |
| `-erd` block α `RA` | `clamp(0.55+0.05n,.55,.95)` | 0.60 | 0.65 | 0.70 | 0.75 | 0.85 | 0.95 |
| `-erd` block hold `RH` s | `0.016+0.004n` | 0.020 | 0.024 | 0.028 | 0.032 | 0.040 | 0.048 |
| `-erd` cut `VT` s | `0.08+0.004n` | 0.084 | 0.088 | 0.092 | 0.096 | 0.104 | 0.112 |
| **`-erd` whole clap s** | `CT+RH+0.05+VT` | **0.239** | **0.254** | **0.268** | **0.281** | **0.304** | **0.326** |
| `-erd` chips (not particles) | `min(4+3n,22)*th` | 7 | 10 | 13 | 16 | 22 | 22 |
| `-ark` world word px | `round(22*fxS(best))` | 22 | 28 | 32 | 36 | 42 | 47 |
| `-ark` stain radius, tiles | `clamp(1.05+0.155n,1.05,2.6)` | — | 1.36 | 1.52 | 1.67 | 1.98 | 2.29 |
| `-ark` stain α | `clamp(0.20+0.037n,.20,.48)` | — | 0.27 | 0.31 | 0.35 | 0.42 | 0.48 |
| `-ark` stain life s (sim) | `clamp(3.2+0.42n,3.2,8.5)` | — | 4.04 | 4.46 | 4.88 | 5.72 | 6.56 |
| `-ark` stain at all | `n >= 2` | **no** | yes | yes | yes | yes | yes |
| `-ark` waterline peak, share of body | `clamp(0.62+0.036n,.62,.92)` | 0.66 | 0.69 | 0.73 | 0.76 | 0.84 | 0.91 |
| `-ark` waterline settle | `clamp(0.16+0.026n,.16,.40)` | 0.19 | 0.21 | 0.24 | 0.26 | 0.32 | 0.37 |
| `-ill` motes | `min(18,round(4+1.8n))*th` | 6 | 8 | 9 | 11 | 15 | 18 |
| `-ill` world word px | `min(24,12+1.4n)` | 13 | 15 | 16 | 18 | 20 | 23 |
| `-ill` rime rim α | `clamp((n-2)/4,0,1)*0.5` | 0 | 0 | 0.13 | 0.25 | 0.50 | 0.50 |
| **`-ill` frost spurs, countable** | `min(n, 8)` | **1** | **2** | **3** | **4** | **6** | **8** |
| **THE BOARD** (widening; read the column as `wide`, `n = 3` on each body) | | | | | | | |
| `total` | `3*wide` | 3 | 6 | 9 | 12 | 18 | 24 |
| `d.p` | `fxP(total)` | 0.480 | 0.738 | 0.900 | 1.000 | 1.000 | 1.000 |
| `d.th` | `fxW(wide)` | 1.00 | 0.945 | 0.890 | 0.835 | 0.725 | 0.615 |
| flyers per body | `fxBudget(3, wide, 32)` | 3 | 3 | 3 | 3 | 3 | 3 |
| flyers on the board | `per*wide` | 3 | 6 | 9 | 12 | 18 | 24 |
| **rule segments, one per body** | `wide` | **1** | **2** | **3** | **4** | **6** | **8** |
| segment px (of a ~230px rule) | `2*ruleHalf/wide`, floor 6 | 30 | 24 | 22 | 21 | 20 | 19 |
| source stagger `STAG` s | `min(0.018, 0.22/wide)` | .018 | .018 | .018 | .018 | .018 | .018 |
| whole spread s | `(wide-1)*STAG` | 0 | .018 | .036 | .054 | .090 | .126 |
| `TSET` s | `0.035+0.06+0.13*p` | 0.157 | 0.191 | 0.212 | 0.225 | 0.225 | 0.225 |
| rule thickness px | `clamp(2+⌊total/5⌋,2,6)` | 2 | 3 | 3 | 4 | 5 | 6 |
| rule overhang px | `min(round(6+3*total),190)` | 15 | 24 | 33 | 42 | 60 | 78 |
| particles emitted, `-eat` | `wide*clamp(6+12,8,40)*th` | 18 | 34 | 48 | 60 | 78 | 88 |

[^a]: §4.13 prints 0.098 for `n = 8`, which is `7 × 0.014`. The code at §4.2.4 is
`rel = Math.min(0.014, 0.10 / Math.max(1, n))`, so from `n = 8` the stagger tightens
to 0.0125 and the spread is 0.0875. The code is right and the table cell is the
erratum: the whole point of the `0.10/n` arm is that a big pile does not take longer
to leave than a small one. Nothing downstream reads it; `TSET` is not derived from it.

[^b]: §4.13 prints 0.40. `0.22 + 0.30 × 0.5818 = 0.3945`. Same pixel.

[^c]: §3.1's own table prints 10 at `n = 8`. `clamp(2 + round(8 × 0.9), 3, 10)` is 9.
Nine notches is also the better answer, because ten reaches the clamp and a Hearsay
carrying twelve would draw the same number of holes as one carrying eight.

**How to read the whole thing in one sentence.** Between one syllable and eight,
the *duration* of a close grows by 59%, the *word* by 26%, the *held frame* by
327%, and the *count of things you can point at* by 700%. That ratio is the design:
**power is expressed as countability first, size second, time last.**

**What deliberately does not scale**, restated here so no engineer looks for a
missing row: the number of words in the line (the poem decides), every easing
curve, the 14ms overshoot return, the rule's 0.10s tail and its 900px/s close, the
3px break, the patch, the two nails, the tally, the caesura, `-erd`'s 50ms
redaction, `-ill`'s 0.05s pip ghost, and the sour glyph's 0.06s. Punctuation does
not scale.

---

## 7. NEW TUNABLES, NEW SFX NAMES, NEW SAVE FIELDS, NEW RT FIELDS

Flat, final, and complete. If a name is not on one of these five lists, the
overhaul does not add it. Anything you find in a design document that is not here
was cut in §11.

### 7.1 `TUNE`, forty-five new keys

Appended at the tail of `TUNE` (187) in exactly this order, in three blocks. **The
one edited character in the whole list is the comma after `rhymeCost: 15`**, added
once by §2.9 hook 2. Everything else appends.

```
punchStop         0.11    s of held frame at full power, before FAM_PUNCH.stop
punchStopCap      0.17    -ill asks for the longest hold in the game; this is where it stops
punchStopScale    0.04    what the sim clock runs at while held. NEVER 0: RT.t drives every idle sine
punchZoom         0.075   extra scale at full power
punchZoomCap      0.08    also the release rate: cap per punchZoomOut seconds
punchZoomStep     0.02    the ladder rung. the nearest-neighbour crawl lives here
punchZoomOut      0.20    s from the top rung back to 1
punchShake        16      amplitude at full power
punchShakeCap     18      14 was the old ceiling; the clearRect margin allows 60
punchShakeHz      22      moves all five FAM_PUNCH rates together
punchChroma       0.85    RT.chroma written at full power
punchSplit        5       px of letter split per unit of RT.chroma
punchBloom        0.55    RT.flash written at full power

detFly            0.06    s from the press to the line, before power
detHold           0.10    how long the line is the loudest thing on screen
detOut            0.18    how long it takes to go
detWord           21      base word px before power. The fit rule claws it back
detRuleOver       3       px of rule overhang per syllable, capped at 190
detFlyMax         32      board-wide ceiling on flying syllables. 0 is a supported look
detSpread         0.22    how long ALL the sources take to go off, at any width
detSnap           1       the dust the snap throws. 0 leaves the bracket and nothing else
detHalo           0.30    how lit the words are while they arrive
pipWarn           1.0     s of stack life left when the row starts shouting

eatBites          1       notch scale. 0 is reachable: the family becomes typography and holes
eatMatter         1       crumb count
eatFed            1       how lit you get when you eat
ightShadow        1       cast-shadow length. 0 removes the family's primary readout
ightSpoke         1       spoke length and edge alpha
ightDark          1       the pre-darken, on top of the punch option level
erdClap           0.075   the close, before best
erdReach          40      bar start distance px, before best
erdGag            4       band height px
erdRule           0.5     ground-rule half-width per unit of best
erdChips          3       chips per syllable
arkStain          1       ground stain alpha and life
arkCreep          1       how fast the waterline climbs on the tick
arkCloak          1       the conceal rim and the hood
arkKeep           24      how many permanent outlines a room keeps
illFreeze         1       rime coat alphas
illExecHold       0.12    the execute hold, 0.04 to 0.40   [renamed: see §12]
illShard          6       shard cell px at one execute
illResidue        1       motes per second, board-wide
vfxRimGround      1       every family's 1px edge on a ground shape
vfxRimBody        1       every family's 1px edge over a lit sprite
vfxStatus         1       all five status layers at once, for a low-spec look
```

**Six of these are read by code that currently hard-codes the number**, and the
engineer must wire them or delete them; a tunable nothing reads is worse than no
tunable, because the FEEL slider moves and nothing happens. `erdClap` and
`erdReach` are the two literals in `CT = 0.075 + 0.048 * d.pb` and
`D = 40 + 168 * d.pb` (§3.3.3) and must become `T('erdClap')` and `T('erdReach')`.
`erdChips` is the `3` in `min(4 + 3 * nn, 22)`. `eatMatter` and `eatBites` are
already wired. `arkRimBody` at §3.4.4 is a name that no longer exists and must be
`vfxRimBody`.

**Forty-five FEEL rows, one per key.** §2.10 writes the thirteen punch rows, §5.1
the ten detonation rows, §3.6 says *each with one `num` row in the FEEL tab*, and
those three lists are the same forty-five keys. Every row is appended **before** the
`Reset every number to default` button at 967, which is the one row that must stay
last, under a `{ k: 'note' }` divider per block. **Seven dividers**: *How it hits*,
*The rhyme landing*, one per family, and *Shared* for the three `vfx*` keys — the
tab already has two dividers at 927 and 945, and forty-five rows without them is
unreadable (`crit-eng-ark` #14).

### 7.2 Sound, twenty-five new names

`sfx()` (4467) drops an unknown name off the end of its chain: no throw, no console
noise. **Every one of these is safe to ship silent**, and the whole overhaul can
land before job 2 writes a single sample. All of them fire through `fxSfx(name,
gap)` (§2.2), so eight foes on one frame is one sound.

```
hold        the top of any hitstop over 0.05s. A master-gain dip and a lowpass
            sweep on RT.ac.currentTime, not a sample. THE ONE THAT MATTERS
lurch       the zoom lands, same frame. 60-90Hz, 40ms, no tail
settle      the last rung of the ladder reaching 1.0. A soft click

tear        the syllables coming off the bodies, once per detonation
nib         each arrival into the line. The RUN is the point; it should climb
rule        the strike under the slam. Narrow, low, mostly felt
bracket     the couplet closing. Two taps 30ms apart, the second lower
crack       the slant. A dry snap with no ring
caesura     the last 2px mark. Almost silence, or cut
stick       a syllable going into a body
stick.big   the same, into a body already carrying five
spill       the overflow shift at the stack cap. No tone
callfizz    a Call that found nobody. A breath
pipwarn     the row crossing pipWarn
sourmulti   several stacks lapsing on one frame
drag        the haul. A pull, low, with a length to it

eatmote     a soft tick per drain arrival. Gate 0.03, and the tempo is a figure
bare        armour coming off. Metal, once, dry
seen        the same beat with no armour to take. NOT the same sample
erdclap     a 4ms wood transient IN FRONT of the existing voxAnswer('erd')
erdgag      one soft closure when silence starts
arkdeny     the Thief's hand going out and stopping
illthaw     the shudder, on the frame f.frozen crosses zero
illexec     the stop
illshatter  the pieces, 0.12s after illexec
```

**Four existing names are reused and none is redefined.** `answer` and `slant` move
from the keypress to `TSET`, 121 to 225ms later, which is the most audible change in
the branch. `sour` and `reprise` already exist in `comp/ninth.js` and keep their
samples; §5.30 lists `reprise` under *new sound names* and is wrong about that. The
`erdtick` at 22 a second that `design-erd` asked for is cut.

### 7.3 Save, one field

```
S.opts.punch    0-3, default 2    the screen punch level. off / light / full / too much
```

Written once in `sLoad`'s defaults block beside the five that are there today
(459-463), as `if (S.opts.punch == null) S.opts.punch = 2;`. `punchLvI()` returns 2
for `null`, so **nothing depends on the write**; the line exists so the value is in
the schema where a reader can find it. `sLoad` opens with `if (S) return;` and
`close()` never nulls `S`, so it only lands on a full reload or a save wipe.

`S.tune` is an existing free-form override bag read through `T(k)` with a fall
through to `TUNE`. The forty-five new keys need **no** schema change and **no**
migration: an old save simply has none of them and gets the defaults. No new
achievement ids, no new charm ids, no new fragment. The magic layer writes nothing
persistent except this one integer.

### 7.4 `RT`, one line on the literal

```
fx: {}       between combat: (1566) and items: (1567). Both already end in a comma,
             so no existing character is edited
```

**That is the entire diff to the `RT` literal.** Everything else the overhaul needs
is assigned lazily and read as `undefined` until first use, which is exactly how
every consumer tests it:

```
RT.det        the live detonation record, or null. Assigned in detonate()
RT.said       the last thing the board was told, for the repeat gate
RT.fx.<id>    per-effect state, built on first fxOf(id) from the entry's make()
```

Registered `RT.fx` ids, final, with their `ord`: `det` 90, `haul` 86, `mend` 92,
`rep` 87, `dim` 88, `line` 90.5, `stz` 91, `vrs` 93, `proj` 70, `punch` 99 (inert),
`eat` 42, `ight` 44, `erd` 46, `ark` 48, `ill` 50. Fifteen entries, one array walk
per frame in `stepFx`, `drawFx` and `drawFxS`.

`RT.fx.punch`'s twenty-nine fields are built by `punchMake()` and are listed in
§2.7; they are named here only so nobody adds a thirtieth to the `RT` literal:
`stop stopMax zoom zHold z ax ay ox oy sx sy st was fresh hz ring cut hard fhold
ca cb fcol fbl bx by bw bh rev revCd dms`.

**Five new fields on a foe**, precedent `f.burn`:

```
f.rowT     the row's own transient (the ghost cells, the warning flash)
f.detG     which detonation this body is currently part of
f.csr      contact-shadow radius multiplier      \  §3.0.6, one channel,
f.csa      contact-shadow alpha multiplier        }  three numbers, five
f.cso      contact-shadow offset in tiles        /   families
```

`f.armor`, `f.burn`, `f.drone`, `f.frozen`, `f.silence` and `f.so` already exist and
are reused as they are. **Five new fields on a stack**, beside the existing `fam`,
`t`, `max`, `born`, `aged` and `drone`:

```
s.w      the word that was said to plant it, for the recital's byWord map
s.i      its index in the row at the moment it was gathered
s.fly    the flyer record that is carrying it, while one is
s.sl     it was dragged by a slant
s.slT    when, so the drag's colour lerp has a clock
```

**Module scope, surviving both a doorway and `close()` because they are pure
functions of their keys:** `PCOL`, `PCOL_N`, `MIXC`, `MIXC_N`, `FAMPX`, `SPR`,
`GLOWS`, `SHADE`. **Module scope, cleared by the one shared `onPlaceChange`:**
`FX_T`, `FX_SFX`, `PIP_ORD`. **Module scope, constant after `fxBoot`:** `FX`,
`PUNCH_RGB`, `FAM_CHROMA`, `FAM_BLOOM`, `FAM_PUNCH`, `PUNCH_KIND`, `PUNCH_LV`,
`PUNCH_LV_N`, `PIP_W`, `RIME`, `RIME_OFF`, `PSA`, `DET_KIND`, `DET_AGAIN`,
`DET_AGAIN_TH`, `DET_AUTO`, `FAM_DET`, `FAM_SNAP`, `FAM_LINE`, `REP_BEAT`,
`VERSE_FAM`, `VRS_TOP`, `VRS_PITCH`, `VRS_COLW`, and the five families' colour
constant blocks.

**Two `__ninth` handles**, read-only, off the hot path: `det()` and `rep()`. A
harness can assert the ladder and the segment count instead of counting pixels.

---

## 8. PERFORMANCE BUDGET, COUNTED

One canvas, 1120x580, `imageSmoothingEnabled` false. A frame is **6.94ms at 144Hz**
and 16.7ms at 60. Every number below is counted off the code in §2 to §4, not
estimated from a feeling, and the per-call costs are the conservative end of the
range RECON measured: a short `fillText` at 3 to 15µs, a small `fillRect` at 0.3 to
1µs, a `drawImage` of a small source at 5 to 20µs, a full-surface `fillRect` at
about 0.30ms, a composite-mode flip at about 2µs.

### 8.1 The floor: what a frame costs today, before any of this

| pass | count | ~cost |
|---|---|---|
| the floor blit, 656k source pixels | 1 `drawImage` | 0.30ms |
| entities, 8 foes plus the player | ~40 blits, ~60 rects | 0.35ms |
| the stack rows at their ceiling | ~50 rects, ~50 `fillText` | 0.45ms |
| particles at the busiest existing moment | ~200 `fillRect` **plus 400 string builds and 200 CSS colour parses** | 0.55ms |
| lights, vignette, HUD | 3 full-surface fills, ~30 rects | 1.00ms |
| **steady state** | | **~2.7ms of 6.94** |

`drawParts`'s 400 strings and 200 parses per frame are **deleted** by `partCol`
(§2.5) before this overhaul adds a single particle. At the 900 cap the saving is
1800 strings and 900 parses a frame, 144 times a second. **The overhaul starts from
a lower floor than the file has today**, and that is what pays for the matter.

### 8.2 The worst frame in the game, counted

**Case A: eight foes, eight `-eat` stacks each, `total = 64`, `wide = 8`.** The
frame at `TSET`, where the tear, the flyers, the line, the rule, the room-down, the
bloom, the family gesture and the snap are all on screen at once. This is the peak
and nothing in the encounter tables exceeds it (waves cap at 2-6, the Chorus loft
at 16, the square at 25; sixteen foes at eight stacks hits the same 32-flyer board
cap and thins harder).

| pass | `fillText` | `fillRect` | `drawImage` | full-surface | ~cost |
|---|---|---|---|---|---|
| the floor, entities, lights, vignette, HUD | 0 | ~90 | ~41 | 3 | 1.65ms |
| the row, at `ord 70`, 64 cells | 64 | ~24 | 0 | 0 | 0.55ms |
| tears, 3 concurrent × (1 clip + 1 rect + 16 glyphs) | 48 | 3 | 0 | 0 | 0.40ms |
| flyers, ~30 live × 2 (hard copy + face) | 60 | 0 | 0 | 0 | 0.50ms |
| the line, 6 words × (2 halo + 3 fill) | 30 | 0 | 0 | 0 | 0.30ms |
| the rule: 8 segments × 2 + 48 notches + 2 caps + uprights | 0 | ~70 | 0 | 0 | 0.05ms |
| `drawSnaps`, 8 records | 0 | 40 | 0 | 0 | 0.03ms |
| `-eat`: 80 notch rects, 8 silhouette blits, 128 teeth × 2, 1 cut word | 1 | 336 | 8 | 0 | 0.35ms |
| particles: 96 new + ~200 already in the room | 0 | ~300 | 0 | 0 | 0.25ms |
| the room going down, the band | 0 | 0 | 0 | 2 | 0.60ms |
| `drawBloom`: one 128px source, six bands, clipped | 0 | 0 | 1 | 1 | 0.55ms |
| `chromaText` on the slam and the line | (in the 30) | 0 | 0 | 0 | — |
| **total** | **~203** | **~863** | **~50** | **6** | **~5.2ms** |

**5.2ms of 6.94.** It fits at 144Hz with 25% headroom, and it fits at 60Hz with
three times that. It lasts **0.225s at the very most** and the peak itself is two
or three frames. At most three of these can happen a second, because that is what
`rhymeCost: 15` against the breath meter allows.

**The two things that make it fit** are both in §2. `fxW` thins per-source emission
as the board widens, and `fxBudget` divides the budget **before** the loop instead
of letting `part()`'s silent tail-drop starve the last nine bodies. Remove either
and case A is 464 particles and 32 flyers per body.

**Case B: the Act 3 square, 25 folk, one stack each.** `wide = 25`, `total = 25`,
`d.th = 0.34`, `per = 1`. Twenty-five tears, twenty-five flyers, twenty-five pieces
of rule, twenty-five notches, **50 particles**. `hurtFoe` returns 0 for folk before
the typo, so there are **zero damage numbers and zero deaths**, and the crowd
collapse drops the row plates. **~120 `fillText`, ~180 `fillRect`, ~3.4ms.** The
biggest scene in the game is cheaper than case A, which is exactly what `fxW` and
the crowd branch were written for.

**Case C: the Reprise on a loft of sixteen**, three beats 0.34s apart. Each beat is
`kind: 'beat'`, which halves the repeat's matter by construction, and the beats
never overlap because `repriseGap` is longer than a beat's line life at that width.
Peak is one beat, which is case A at `wide = 16`, `per = 2`: **32 flyers again**,
because `detFlyMax` is a **board** cap and 32 is the ceiling of the design at every
crowd size.

### 8.3 Memory, and what is baked

| bake | size | freed by |
|---|---|---|
| the glow sprite, one 128x128, six bands | 64 KB | `close()` |
| `foeSilSpr`: 5 kinds × 3 colours | ~60 KB | `close()` |
| `icy`: one per foe **variant**, behind `mayBuild()` | ~120 KB worst | `close()` |
| the punch layer's **ten further** 128x128 bakes (the glow above is the eleventh) | 644 KB worst | `close()` |
| **the whole overhaul** | **under 1 MB** | |
| for scale: one `FLOORS` entry | 2.5 MB | `freeSprites()` |
| for scale: `SPRITE_BUDGET` | 10 MB | |

`SPR` is a different cache from `SPRITES` and `freeSprites()` (6529) does not touch
it. That is deliberate: these are pure functions of their keys and they should
survive a doorway.

**Allocations per frame: net negative.** The layer removes 1800 strings and 900 CSS
parses at the particle cap and one `slice` per line per frame from `drawLines`. It
adds `detAt`'s `{k,x,y}` (peak ~36 on one frame), one `detRule` object per frame
now that it is cached under the clock it was computed at, and `PIP_ORD.sort`'s
comparator closure. At `T0` a detonation allocates about 200 short-lived objects on
**one** frame and none of it recurs. Zero `TextMetrics`: every width is measured
once in §4.0.2 and every other width is derived from it.

### 8.4 The degradation path

Four levels, and **turning it down never turns an event off**: the same `punch()`
runs with smaller numbers, so nothing anywhere in the file grows a branch.

| level | name | what stops being drawn | frame saved on the peak | what you lose |
|---|---|---|---|---|
| **3** | too much | nothing; the ramp to the same ceilings is faster | −0.1ms | your composure |
| **2** | full | nothing. **Default** | 0 | nothing |
| **1** | light | the hitstop and the zoom entirely (`lv.stop = lv.zoom = 0`, so `pz.z` is pinned at 1 and `punchZoom` returns immediately); the bloom and the chroma run at half, so the split falls from 5px to 2-3px and one of the six bloom bands falls under the alpha floor | **−0.35ms** | the freeze and the lurch. The vignette pull still works |
| **0** | off | `drawBloom` returns on `RT.flash <= 0`; `chromaText` returns on `RT.chroma <= 0.02`, which removes **two `fillText` per word on screen**; `punchZoom` returns on `z <= 1`; the hitstop never starts | **−0.95ms** | everything but the shake, which keeps its own separate toggle |

**At level 0 the slam still prints, the line still assembles, the rule still
strikes, and every family still draws its matter.** The option is the *screen*
punch. The typography is not optional; it is the game.

**Below level 0**, for a machine that still cannot hold the frame, the tunables are
the real escape hatches and each one is honest about what it removes:

| set | to | removes | saved |
|---|---|---|---|
| `detFlyMax` | 0 | all 32 flyers, 64 `fillText`. **A real look**: pure typography, and the rule only arrives on the strike | 0.50ms |
| `vfxStatus` | 0 | all five status layers at once | 0.40ms |
| `eatBites` | 0 | the notches and the silhouette blits; `-eat` becomes typography and holes | 0.20ms |
| `detSnap` | 0 | the snap dust; the bracket stays | 0.10ms |
| `illResidue` | 0 | the board-wide one-mote-per-frame residue | 0.05ms |
| `ightShadow` | 0 | the cast shadows. **This removes the family's primary readout** and is listed for completeness, not recommended | 0.15ms |
| `arkKeep` | 0 | the permanent outlines a room keeps | 0.02ms |

Set all seven and the peak frame is **~3.3ms**, which is the game as it ships today
plus the line, the rule and the slam.

### 8.5 Three costs that are easy to forget

1. **A hitstop does not save any drawing.** `pz.stop` holds the *sim* clock at
   `punchStopScale`; `draw()` runs every frame regardless, and the letters are on
   the real clock on purpose. The frozen frame is the **most** expensive frame, not
   the cheapest, and it is held for up to 141ms with `-ill`. This is fine — it is
   one composition being redrawn — but nobody should budget as if the freeze were
   free.
2. **Full-surface fills are the single most expensive thing here.** Six of them on
   the peak frame, 1.8ms of the 5.2. Three already exist (night wash, vignette,
   HUD scrim). The overhaul adds the room-down, the band and the bloom's darken.
   **No seventh is permitted**, which is why `crit-art-ark` #7(b), a dim that wipes
   in from the four edges, was refused: `drawVignette` is already narrowing onto
   the blast on that exact frame.
3. **`part()` caps at 900 silently and `typo()` caps at 60 by shifting the oldest
   off.** Neither fails loudly. The house split for particles is **112 for the
   snap, which is spent inside the detonation's 300**, and 600 left for everything
   already in the room; see §12, because two sections currently print a split that
   sums to 1012. `typo`'s 60 is the tighter one in the square: twenty-five damage
   numbers plus twenty-five `STILL`s would evict the numbers, which is why only the
   four biggest piles get a word and the square gets one.

---

## 9. RISKS AND TRAPS

Ordered by **how likely it is to bite during this implementation**, not by how bad
it is when it does. Each one has the guard that prevents it and the observation
that catches it if the guard was not written. The first six are all but certain;
they are the ones to check before the first screenshot.

---

**1. `hurtPlayer(dmg, ...)` is a `ReferenceError` and kills the whole game.**
Near-certain, because three source documents wrote it. The signature is
`function hurtPlayer(n, src)`. The file is `'use strict'`. `dmg` is not in scope, so
the throw comes out of `stepFoes` and takes the rAF loop with it **on the first
enemy hit of the first fight**.
*Guard:* the call site is `punch({ power: n / 8, kind: 'hurt', x: RT.px, y: RT.py })`,
with `n`. *Catch:* `node --check` will not see this. Take one hit in the arena and
watch the console. Acceptance item 16.

**2. The `TUNE` trailing comma, and the FEEL reset button.** The two guaranteed
merge conflicts in the overhaul. `rhymeCost: 15` has no trailing comma, and four
areas want to append below it; `Reset every number to default` at 967 must stay the
last row, and six areas want to append rows.
*Guard:* §2.9 hook 2 adds the comma **once** and everybody else appends only.
Every FEEL row goes **above** the reset button. *Catch:* `node --check`, immediately.

**3. A local named `T` in a world drawer.** `T` is the tunable accessor at 480 with
200+ call sites. Two source designs declare `var T` inside a drawer. Neither throws
*today* only because neither calls `T('...')` yet, so the trap is armed and fires
the first time somebody wires a tunable into a drawer that looks correct.
*Guard:* use `tr` or `rec`. *Catch:* `grep -nE "var .*\bT\b *=|function .*\(T[,)]" comp/ninth.js`
before commit.

**4. A `NaN` anchor makes the entire canvas stop drawing.** The drag and the slant
paths both compute their centroid as `0/0` when nothing was hit. `clamp(NaN)` is
`NaN`, `Math.round(NaN)` is `NaN`, and `translate(NaN, NaN)` makes the transform
non-invertible: **nothing draws at all**, for as long as the shake runs, with no
error in the console.
*Guard:* `isFinite(o.x) && isFinite(o.y)` in `punch()`, and the centroid falls back
to `RT.px/RT.py` when `hn` is 0. *Catch:* say a sound nothing on the board carries.
Acceptance item 6.

**5. `punch()` called from inside a per-foe loop.** Three source documents put it
inside `breakStack`, inside `famEffect` and inside a burn tick. `breakStack` is
called from `for each foe { for each stack }`: twenty-five bodies with a full pile
lapsing on one frame is **200 `punch()` calls in one frame**.
*Guard:* the call-site table in §2.10 is **closed**, and the rule is *once per thing
the player did*. The sour path coalesces after both loops; the execute path counts
and fires once after `live.forEach`. *Catch:* `grep -n "punch(" comp/ninth.js` and
read the enclosing function. There must be exactly the rows in that table.

**6. Six sours on one frame, or eight `seen`s, become six sounds.** Same shape as
5, in the audio layer.
*Guard:* every new name goes through `fxSfx(name, gap)`. *Catch:* stand in the
square and let a full board lapse.

---

**7. An effect walks through a doorway.** `gotoPlace` clears foes, projectiles,
calls, beats, typo, slams and lines (6124-6125) and has **never** cleared `parts`,
`snaps`, `rings` or the assembly. All four have always survived a doorway and kept
drawing at tile coordinates that mean something else in the next room.
*Guard:* one shared `onPlaceChange` in `fxBoot` that does `RT.fx = {}` (so every
state is **rebuilt from its `make()`** rather than emptied field by field), nulls
`RT.det` and `RT.said`, empties `parts`, `snaps`, `rings`, `assembly` and
`PIP_ORD`, zeroes `shake`, `chroma`, `flash`, and resets `FX_T`/`FX_SFX`.
*Catch:* acceptance item 15. Walk out mid-detonation, mid-Reprise, mid-Verse.

**8. `stepPunch` counts the hitstop on the clock the hitstop is holding.** It never
reaches zero. The game is frozen with no way out but the dev menu. The file already
carries this scar at `RT.dilate` (3816) and that line has a comment saying so.
*Guard:* `pz.stop = Math.max(0, pz.stop - real)`. Everything in `stepPunch` that
decays is on `real`. *Catch:* one `-ill` close. If the game stops, this is it.

**9. `real` is `undefined` in the harness.** `__ninth.tick` calls `step(dt)` with
one argument (1584), so a stepper that does `real = real || dt` in its own body
gets it right and a stepper that forgets gets `NaN` propagated into a life field,
and the effect either never ages or vanishes on frame one — **only in the harness**,
which is where every screenshot in this job comes from.
*Guard:* `stepFx` resolves `real` **once** for the whole layer and hands every
stepper `(dt, real, state)` already resolved. No stepper writes that line.

**10. `shake()` adds.** Line 1505 is `Math.min(cap, RT.shake + a)`. Routing the
punch through it makes shake the one channel that **sums**, so twenty-five
simultaneous anythings drive it to the cap regardless of how big each event was.
*Guard:* `punch()` writes `RT.shake` directly, by `max`, keeping the `S.opts.shake`
gate that `shake()` was providing. Every channel takes the larger of what is running
and what is asked. *Catch:* the square. If the last cue of Act 3 rattles, this is it.

**11. Three separate hitstop fields summing into a hang.** `-erd`, `-ill` and
`-ark` each wrote their own (`erdStop`, `illHold`, `-ark`'s `H`). Three raw writers
cannot take a max.
*Guard:* one field, `RT.fx.punch.stop`, written only by `punch()`. The three
families get a `stop` **multiplier** in `FAM_PUNCH` instead. Note the surviving
name collision: the `illHold` **tunable** is the execute hold, not the hitstop, and
§7.1 renames it `illExecHold` for that reason.

**12. The zoom breaks every backwards conversion in the file.** `screenToWorld`
(62-66) is the one place the game converts screen to world, and `RT.face`,
`doCall`'s aim, `doDash` and click-to-move all read it. At `z = 1.08` an unpatched
cursor at the screen edge is wrong by about 40px, which is most of a tile — so
during a punch you aim at the wrong body.
*Guard:* undo the zoom in `screenToWorld`, before the camera. *Catch:* hold the
mouse still at the screen edge and close a rhyme; the aim reticle must not move.

**13. A full-surface fill inside the shake translate leaves a bright band.** Every
wash in `draw()` is a `fillRect(0, 0, VW, VH)` laid down **inside** the shake, so at
full shake up to nine pixels of one edge is never covered. The vignette is one of
them at 0.8 alpha, so a nine-pixel strip at full brightness runs down one side of
the screen at the exact moment of the biggest punch.
*Guard:* `fullRect(cx)` = `fillRect(-14, -14, VW + 28, VH + 28)`. Fourteen, because
the cap is 18 and the x gain is 0.5. *Catch:* eight stacks, one foe, look at the
screen edges. Nobody has noticed this in the shipped game because `#07060a` and
`#06050a` are the same colour; with the vignette it is obvious.

**14. A screen-space pass anchored on a world point detaches by 22 pixels.**
`drawFx` runs **inside** the shake and the zoom; `drawFxS` runs **outside** both.
7px of shake plus 15px of zoom displacement at 250px from the anchor, on the one
frame the design most wants the syllable glued to the body it is peeling off.
*Guard:* `punchWX(sx)` / `punchWY(sy)`, which apply both transforms, reading the
frame's shake offset from `pz.ox`/`pz.oy` — computed once in `stepPunch` off the
same phase `punchShakeXY` uses, so the two cannot disagree.

**15. The stack row is 104 pixels away from where you drew.** `drawFoe` has
computed the body height inline at 3488 since the sprites landed, and nothing else
could reach it, which is why `snapStacks` has been drawing 104px below the Chorus's
row for as long as the Chorus has existed.
*Guard:* `foeH(f)` and `foeStackY(f)`, one truth each, and `drawFoe` calls them too.
`FOE_H` gains its missing `chorus` row in the same edit. **Nobody may re-derive
either expression**, including the two call sites in the source design that
open-coded it. *Catch:* a Chorus with stacks on it.

**16. A world angle is not a screen angle.** `isoX` is `(x-y)*29` and `isoY` is
`(x+y)*14.5`, so a world angle of 0 leaves at 26.6 degrees on screen and `PI/4`
leaves at 90. Four designs point a chevron, a jaw, a needle and a downbeat along the
raw world angle and are **up to 63 degrees out** — while the `spray()` beside them
is correct, because it writes world velocities.
*Guard:* keep the world angle for the physics, use `isoAng(a)` for anything drawn.
Inside a `translate(sx, sy); scale(1, 0.5)` ground frame the answer is simply
`a + PI/4`, because the iso basis **is** a 45 degree rotation.

**17. `part()` starves the end of a loop, silently.** It drops past 900 with no
throw and no console noise, and `fxPush` evicts the oldest. A loop that emits its
full wish per body does not fail loudly; it quietly gives the last nine people in
the square nothing.
*Guard:* `fxBudget(want, wide, cap)` divides **before** the loop. Two sub-traps
inside it, both live in a source document: `cap || 96` turned a cap of **zero** into
ninety-six, so the one documented escape hatch gave *more* matter when switched off;
and a `Math.max(1, ...)` floor made zero unreachable. **Zero is a supported answer**
and every caller handles it with one `if (!per) continue;`.

**18. The row is reflowed before the drawer sees it.** `famEffect` runs at 2619,
`f.stacks` is zeroed by the wax at 2622 and reassigned by the filter at 2624, all
inside the same synchronous `live.forEach` — long before `draw()` is next called.
A drawer that reads the row "after the close on the same frame" reads an empty one.
*Guard:* capture what you need where `match` has not been spent, as a short-lived
per-foe transient (`g.pip`, `f.rowT`, `detCells(f, fam, all)` copying the row
**before** it is spent). Everything in seconds, never in frames.

**19. `pipWarn` was read three times and never declared.** `T('pipWarn')` on an
absent key returns `undefined`; `s.t < undefined` is `false`; the whole three-stage
alarm is dead code that looks correct.
*Guard:* the key is in §7.1. *Catch:* the same trap is available to any new key —
**grep every `T('...')` in the diff against the `TUNE` literal** before commit.

**20. `RT.fx` state cached across a frame.** The travel reset replaces the object
wholesale, so a cached reference is a write into a dead object and the effect
silently stops updating one room later.
*Guard:* call `fxOf(id)` where you need it; never hold it. It is one property lookup
on a hit.

**21. Unbounded memo growth.** `mixRgb`'s key space is `from>to@step`, and a family
that lerps a colour per frame can reach thousands of keys; `partCol`'s is
`rgb|bucket`.
*Guard:* both reset at 4096 entries. Twelve lerp steps and sixteen alpha buckets are
the other half of the bound.

**22. Photosensitivity.** Additive full-screen light, up to three times a second,
on a near-black scene.
*Guard:* the layer's ceiling is **+43 of 255** at the brightest family and +64 for
the scripted Chorus flash, which is what the old flat wash already did; **no pure
white anywhere**, no bleach (cut); six hard bands rather than a smooth ramp, so
there is no shimmer; the whole channel is behind an option with three lower
settings and level 0 removes it entirely. *Catch:* set `punch` to 3, close eight
stacks on eight foes, and look at it for a minute.

**23. A both-sides merge draws the stack row twice.** The overhaul **deletes** the
`drawStacks` call from `drawFoe` at 3526 and redraws the row from `ord 70`. A merge
that keeps both gets two rows, 18 pixels apart, one of them under the night wash.
*Guard:* it is one of the two merge hazards called out in the PR body. *Catch:* any
screenshot with a stack on it.

**24. The detonation outlives the player.** A sour lapse is the commonest way to
die, so the wreckage of the lapse that killed you is on screen when you go down.
`stepFx` correctly keeps ageing it through the death, but it must not still be
there when you get up 2.2 seconds later.
*Guard:* `revive()` clears the three projectile lists.

**25. `hurtFoe` takes an `o.n` it has never read.** Pre-existing, and the reason the
detonation's damage does not scale visibly with the pile today.
*Guard:* §5.18. Listed here because it is the one *mechanical* change hiding inside
a visual overhaul, and a reviewer should see it flagged rather than discover it.

---

**Two traps that are not code.** First: `RT.toasts` parks three gold achievement
cards over the right third of every capture, because a fresh save earns half of them
the first time it says anything — the lab empties the queue every frame, and any
other harness must too. Second: the desktop shell renders the game into a draggable
window about 700px wide, so a screenshot taken through it is at 60% scale with a
taskbar under it, and **a 8px rhyme pip is unreadable in that**. Use the lab.

---

## 10. ACCEPTANCE CHECKLIST

Runnable. Every command below is a real command against the two tools that already
exist: `.claude/ninth-night/tools/vfx-lab.html`, which mounts the game at native
1120x580 on black with no shell, and `.claude/ninth-night/tools/shot.py`, which
drives headless Chrome and crops the PNG so the detail survives being looked at.

**Crops matter more than they sound.** Whatever reads the PNG back downscales it to
about 280px wide, and a 1120x580 frame at 280 is quarter scale, where a rhyme pip is
two pixels of mud. Every preset in `shot.py` is 280 wide or narrower and is 1:1 for
that reason. Use `full` only for composition.

### 10.0 The rig

```bash
cd /c/Users/isaac/IsaacUre.github.io/.claude/worktrees/suspicious-driscoll-00fbd8

# 1. syntax, first and after every block
node --check comp/ninth.js

# 2. the server the lab and shot.py both expect. Leave it running.
python -m http.server 8677 &

# 3. prove the rig works before you trust a single frame of it
python .claude/ninth-night/tools/shot.py rig-000 "scene=idle&foes=0" full
```

`shot.py` reads `NNPORT` and defaults to 8677; PNGs land in `.claude/shots/`. If
`rig-000` is black, the server is not up or the fonts have not loaded, and every
shot after it is worthless.

**One patch to the lab, and it is acceptance step zero.** The lab drives the game
through `window.__ninth`, which is exactly what `TESTING.md`'s one rule says not to
trust: *a build once shipped where pressing E did nothing and the dev handle
reported everything working.* Add a `?drive=key` mode so the same scenarios can be
fired through the real keydown chain:

```js
  // ?drive=key fires the number row instead of calling doRhyme, so the
  // screenshots that matter are taken through the same path a player
  // uses. RHYME is the number row; the family's index in FAM_IDS plus
  // one is its key. Everything else about the scenario is unchanged.
  var RKEY = { eat: '1', ight: '2', erd: '3', ark: '4', ill: '5' };
  function fire(ff) {
    if (q.drive !== 'key') { D.rhyme(ff); return; }
    var root = document.querySelector('.nn'); root.focus();
    var k = RKEY[ff] || '1';
    root.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    root.dispatchEvent(new KeyboardEvent('keyup',   { key: k, bubbles: true }));
  }
```

and every `D.rhyme(fam)` in the scenario block becomes `fire(fam)`. Confirm the two
paths agree before believing any of the rest:

```bash
python .claude/ninth-night/tools/shot.py key-off "scene=rhyme&f=ark&n=6&foes=3&tank=8&at=13" slam
python .claude/ninth-night/tools/shot.py key-on  "scene=rhyme&f=ark&n=6&foes=3&tank=8&at=13&drive=key" slam
```

**The two frames must be identical.** If `key-on` is empty, the number row is not
bound to `doRhyme` any more and nothing else in this checklist means anything.

`at=` is frames of `1/60`, so `at = round(seconds * 60)`. The timings below come
straight off §6.

### 10.1 The detonation, which is the money shot

| # | command | crop | what must be true |
|---|---|---|---|
| 1 | `shot.py det-n1 "scene=rhyme&f=ark&n=1&foes=1&kind=thief&tank=8&at=8"` | `slam` | One `ARK`. A **2px** rule, **9px** wider than the word, **one** notch under it, two brass caps. The whole thing is gone by `at=28` |
| 2 | `shot.py det-n1-fly "scene=rhyme&f=ark&n=1&foes=1&kind=thief&tank=8&at=4"` | `centre` | The syllable is **in the air**, off the body, about 57px over its head. Not on the body, not in the line |
| 3 | `shot.py det-n8 "scene=rhyme&f=ark&n=8&foes=1&kind=thief&tank=12&at=12"` | `slam` | A **3px** rule overhanging **30px** with **eight notches you can count**. Two coronas. The word is 29px against shot 1's 23 |
| 4 | `shot.py det-n8-peel "scene=rhyme&f=ark&n=8&foes=1&kind=thief&tank=12&at=4"` | `centre` | Eight syllables peeling off **one** body, staggered, not eight leaving together |
| 5 | `shot.py det-wide "scene=rhyme&f=eat&n=3&foes=8&kind=mix&tank=8&at=14"` | `full` | The rule is **eight pieces** with gaps. Segment widths are proportional to each body's pile |
| 6 | `shot.py det-3word "scene=rhyme&f=eat&n=4&foes=3&kind=mouth&tank=8&at=11"` | `slam` | Three words in the line, the heads dim, the three `EAT`s bright and aligned on one baseline |
| 7 | `shot.py det-kill "scene=rhyme&f=ill&n=6&foes=2&kind=mouth&hp=0.2&at=20"` | `centre` | A **brass upright** standing on the dead body's own piece of the rule, still there when the caesura closes |
| 8 | `shot.py det-slant "scene=slant&f=ill&n=4&foes=3&tank=8&at=13"` | `slam` | Grey words, a staggered baseline, the rule strikes to **60%** and breaks, **no caps**, and the patch sits **on top of** the rule over the break |
| 9 | `shot.py det-drag "scene=slant&f=erd&n=4&foes=3&tank=8&at=6"` | `full` | The rope leaves the player, the cells wipe left to right, the bars shorten as each flips. **Zero particles**: confirm with 10.4 |
| 10 | `shot.py det-square "scene=rhyme&f=ill&n=1&foes=25&kind=mouth&tank=40&at=14&place=arena"` | `full` | Twenty-five tears, twenty-five flyers, **twenty-five pieces of rule**, and it reads as **one event**. Not twenty-five events |
| 11 | `shot.py det-out "scene=rhyme&f=ark&n=8&foes=1&kind=thief&tank=12&at=40"` | `slam` | The line is being **cut off bottom-up**, not lifted and not faded |
| 12 | `shot.py det-rep "scene=reprise&f=ight&n=4&foes=6&kind=mix&tank=12&at=30"` | `full` | Beat two: four words, two voices, a wider rule. Rerun at `at=8` and `at=52` for beats one and three |
| 13 | `shot.py det-stanza-empty "scene=stanza&f=erd&foes=0&at=6"` | `full` | **No hits, no detonation, and the four rules and the shake still happen.** The biggest cooldown in the game must not go off in silence |
| 14 | `shot.py det-verse "scene=verse&f=ill&foes=25&kind=mouth&tank=40&at=60"` | `full` | Twenty-eight marks lit as miniature rules, seven brackets closed, the crowd front to back, one man still sitting |

### 10.2 The five families, side by side

Shoot all five at the same `n`, the same crop and the same `at`, and put the PNGs
next to each other. **If two of them read as the same event with a different
colour, the overhaul has failed its brief** and §3.8's audit is the argument, not
the palette.

```bash
for f in eat ight erd ark ill; do
  python .claude/ninth-night/tools/shot.py fam-det-$f \
    "scene=rhyme&f=$f&n=6&foes=2&kind=mouth&tank=10&at=11" east
done
for f in eat ight erd ark ill; do
  python .claude/ninth-night/tools/shot.py fam-st-$f \
    "scene=status&f=$f&n=6&foes=2&kind=mouth&tank=10&at=110" east
done
for f in eat ight erd ark ill; do
  python .claude/ninth-night/tools/shot.py fam-call-$f \
    "scene=flight&f=$f&foes=2&kind=mouth&tank=10&at=5" centre
done
```

| shot | what must be true |
|---|---|
| `fam-det-eat` | Holes chewed **through the body's own outline**, a ring of **teeth** closing inward (never an orange ellipse: `MODS.loud` is that colour), crumbs falling and cooling |
| `fam-det-ight` | Two hard spokes, each ending in a body **nailed to a long black quad**, pointing away from the nearest **town lamp** and not away from you |
| `fam-det-erd` | Bars closing in unison, a flat block, a black bar, then cut away from **both edges** to nothing. **No round shape anywhere in it** |
| `fam-det-ark` | The shadow climbing the body from the ground, the stack row **scratched out**, and a stain on the floor |
| `fam-det-ill` | The body repaletted cold and **not animating**, frost climbing from the ground up, a caesura bar, and a ring with **gaps** in it that closed rather than opened |
| `fam-st-*` at `at=110` | Something is still happening 1.8s later, and it is a different something per family |
| `fam-call-*` | Five different projectiles in flight. The word is legible; the matter around it is the family |

Two collisions to check by eye, because they are the ones the audit admits are
close: `fam-det-ight` and `fam-det-ark` must point **different ways** in a lit lane
(`&place=` any place with lamps), and `fam-det-erd` against `fam-det-ill` must read
as *a page being edited* against *a person who has stopped*.

### 10.3 The screen punch, at all four levels

The option is `S.opts.punch`, and the lab does not take it as a query parameter, so
drive it from the URL through the dev handle the same way the lab sets `S.verse`.
Add one line to the lab beside `S.opts.shake = true`:

```js
  if (q.punch != null && q.punch !== '') S.opts.punch = +q.punch;
```

```bash
for lv in 0 1 2 3; do
  python .claude/ninth-night/tools/shot.py punch-$lv \
    "scene=rhyme&f=ight&n=8&foes=4&kind=mouth&tank=12&at=13&punch=$lv" full
done
```

| level | what must be true |
|---|---|
| 0 | **The line, the rule and the slam are all still there.** No bloom, no colour fringe on the letters, no zoom. This is the single most important frame in the checklist: the typography is not optional |
| 1 | Bloom and fringe at half. No zoom: the frame edges line up with level 0's exactly |
| 2 | Everything |
| 3 | Everything, harder, and **not brighter than level 2 at the core** — level 3 is a faster ramp to the same ceiling, not a new ceiling |

### 10.4 What a screenshot cannot show

Five things, all checked from the console on the lab page (`?dev=ninth`), none of
them optional.

```js
// A. the particle cap is never reached, in the worst scene in the game
var RT = __ninth.RT(), peak = 0;
for (var i = 0; i < 240; i++) { __ninth.tick(1); peak = Math.max(peak, RT.parts.length); }
peak;                                  // must be < 900, and < 400 in the square

// B. the detonation record is shaped right and the segments equal the bodies
__ninth.det();                         // { fam, kind, total, best, wide, t, fired, segs }
                                       // segs === wide, total === sum of the piles

// C. nothing survives a doorway
__ninth.rhyme('ark'); __ninth.place('arena');
[RT.det, RT.parts.length, RT.snaps.length, RT.rings.length, RT.assembly,
 RT.shake, RT.chroma, RT.flash, Object.keys(RT.fx).length];
                                       // null, 0, 0, 0, null, 0, 0, 0, 0

// D. the hitstop always ends, including -ill's longest
__ninth.rhyme('ill');
for (var j = 0; j < 200; j++) __ninth.tick(1);
__ninth.RT().fx.punch.stop;            // must be exactly 0

// E. no tunable is read that does not exist. Needs a THIRD dev handle,
//    one line beside det() and rep() at 1581, read-only and dev-only:
//      tune: function (k) { return k == null ? TUNE : T(k); },
//    without it the console cannot see inside the IIFE at all and the
//    pipWarn class of defect (risk 19) is unfindable from outside.
['detFly','detHold','detOut','detWord','detRuleOver','detFlyMax','detSpread',
 'detSnap','detHalo','pipWarn','punchStop','punchStopCap','punchStopScale',
 'punchZoom','punchZoomCap','punchZoomStep','punchZoomOut','punchShake',
 'punchShakeCap','punchShakeHz','punchChroma','punchSplit','punchBloom',
 'eatBites','eatMatter','eatFed','ightShadow','ightSpoke','ightDark',
 'erdClap','erdReach','erdGag','erdRule','erdChips','arkStain','arkCreep',
 'arkCloak','arkKeep','illFreeze','illExecHold','illShard','illResidue',
 'vfxRimGround','vfxRimBody','vfxStatus']
  .filter(function (k) { return __ninth.tune(k) == null; });
                                       // must be []. 45 keys, and the
                                       // grep for T('...') in the diff
                                       // must not find a 46th
```

### 10.5 The real keyboard, which is the only proof that any of it is reachable

`devDemo()` (8125) drives the **real keydown chain** through `nkey=`, which is the
one thing the dev handle cannot prove. These run against the game itself, not the
lab, so they come back at shell scale: they are reachability tests, not look tests.

```bash
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
SHOT=/c/Users/isaac/IsaacUre.github.io/.claude/shots

# say a word, then close the rhyme, entirely through keydown
"$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1440,900 --virtual-time-budget=9000 \
  --screenshot="$SHOT/key-rhyme.png" \
  "http://localhost:8677/comp/?dev=ninth&nwipe=1&ndev=square&nat=8,8&nfoes=4&nfr=180&nkey=1"

# the stanza keys, which have their own binding path
"$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1440,900 --virtual-time-budget=9000 \
  --screenshot="$SHOT/key-stanza.png" \
  "http://localhost:8677/comp/?dev=ninth&nwipe=1&ndev=square&nat=8,8&nfoes=4&nfr=180&nkey=q"

# the option row exists, is reachable, and says its own name
"$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1440,900 --virtual-time-budget=9000 \
  --screenshot="$SHOT/key-opt.png" \
  "http://localhost:8677/comp/?dev=ninth&nwipe=1&ndev=square&ndevtab=DEBUG&nfr=60&nkey=\`"
```

`key-rhyme.png` must show a detonation one frame old. `key-opt.png` must show
**Screen punch. Hitstop, zoom, split, bloom: full** at the tail of the DEV DEBUG
tab, under the `wasd` row and above the SOUND note, and the name must follow the
number when it changes.

### 10.6 The fifteen sentences

The list from §5.29 stands, and these are the eight that are not covered by a
command above. Drive them in the game with the keyboard.

1. **A Call into a body carrying four.** The word holds still for 110ms, the head
   falls away grey, the fifth cell takes the `EAT`, the plate pops, and the sound
   switches to `stick.big`.
2. **A lapse.** The glyph goes to the **wrong letter** for two frames, the cell
   breaks on a diagonal and falls, and **one** number pops. Six at once still pops
   one number and bills you once, through `hurtPlayer`, respecting i-frames.
3. **A recital.** Four lines of the true ballad on screen **together**, four rules
   under them, a bracket closing lines two and four. Answer a rhyme mid-recital and
   your line assembles at y 96, above the ballad's, neither drawn over the other.
4. **A couplet.** The bracket closes and `bracket` plays. It is the rarest sound in
   the game and the one players should learn to want.
5. **Take a hit.** No `ReferenceError` in the console. Risk 1.
6. **Die, and revive.** The wreckage of the lapse that killed you is not on screen
   when you get up.
7. **A Chorus with stacks on it.** The row is at its head, not 104px below it, and
   the tear comes off the row and not off empty air.
8. **A Droner's stack.** The grey cell says *you did not put this here*, and the
   flyer that comes off it is grey too.

---

## 11. CUT

Everything the eight designs and sixteen critiques put on the table that is **not**
in this blueprint, with one line of reason each. Nothing is dropped silently. The
per-section ledgers (§2.12, §3.9, §4.16) rule on every finding one at a time; this
is the roll-up of the ones that came back **no**, plus the machinery that went with
them, plus the four things this merge pass cut on its own authority.

### 11.1 Critique findings refused

| finding | ruling |
|---|---|
| `crit-art-punch` #10 bonus, march the brightest bloom band outward | An expanding ring is the shockwave the detonation's own thesis forbids: things came **together**, they did not blow apart |
| `crit-art-punch` #15, one frame of light per rung down the zoom ladder | It re-lights the room after the event is over and fights the room going down under the line, which is the image the whole detonation is for |
| `crit-art-punch` #9, pure white in the one place the bible names | Moot: the bleach it belonged to is cut, so there is no gesture left to paint white |
| `crit-art-punch`'s `hex2rgb(pxShade(col, 0.42))` chroma table | It returns a flat grey. `pxShade` gives `'rgb(r,g,b)'` and `hex2rgb` gives `'200,200,200'` for anything not starting with `#`. Replaced by `rgbMul`, same arithmetic, right type |
| `crit-art-eat` #16, a 6px floor decal held 3s | The husk already survives the body, and two persistent floor marks in the family whose rule is *this family does not leave marks* is one too many |
| `crit-art-erd` #18, the line's words clipped in from the left | The flyer path is one easing shared by five families; five easings inside the one function that must never fork is not worth a difference nobody sees in 0.1s |
| `crit-art-ark` #7(b), a dim that wipes in from the four edges | A second authored vignette on the exact frame `drawVignette` is already narrowing onto the blast. Also the seventh full-surface fill on the peak frame (§8.5) |
| `crit-art-ark` #15, the dragged tag slides one cell | Two authors moving the same glyph on the same frame. The haul owns that animation at `ord 86`; `-ark` gets the 1px violet trail on the plate instead |
| `crit-art-ark` #19, a private draw path for `add: 0` particles | A second particle loop for one family, which is the exact thing §2.5 exists to delete. The `sh === 2` arm rounds and that was the real complaint |
| `crit-art-ill` #22, breath refilling visibly faster while the board is frozen | A good idea and a **mechanics** readout, not a magic visual. A family reaching into the HUD to reward a state it caused is the cross-cutting edit this document exists to prevent |
| `crit-art-deton` #25, the same patch plate over the false line in `fillBook` | Refused **here and handed over**: a magic-layer branch editing a story screen is job 1's. The geometry is written out in §4.6.4 for whoever takes it |
| `crit-art-deton` #28, the "commit" arm — fly the line to the Echo bar | Same call as `-ill`'s breath meter: the magic layer must not reach into the HUD to reward a state it caused. The "stop" arm is applied |
| `crit-eng-deton` B2's shim for a missing `punch()` | There are no two branches. `punch`, `PUNCH_KIND`, `punchLv` and the thirteen `TUNE` keys are §2 of this document and land in the same commit |
| `design-deton-3`'s conditional `punchP` declaration | *"If -punch has landed this declaration is dropped"* is a `ReferenceError` on the first close. One body (`fxP`), one permanent alias (`punchP`), neither ever deleted |

### 11.2 Machinery cut

| cut | reason |
|---|---|
| `spin` on particles | A `rotate` per particle per frame to produce four grey pixels at `imageSmoothingEnabled` false. The most expensive thing in the loop for the least visible result |
| The white bleach, and the `bleach` sound | +68 and +107 of 255 on a near-black scene, three times a second. The layer ceiling is +43, there is no pure white in the palette, and the family light replaces it |
| `bloomSprite`'s smooth radial gradient | The file's own comment forbids `createRadialGradient` in a loop, and a smooth ramp bands anyway at this depth. Six hard bands, baked once, blitted with `lighter` |
| `#3a3340` | It does not exist in `comp/ninth.js`. Invented by two designs for the patch plate, the tally and the Verse column while arguing that the palette is closed. All three are `#3d3350` |
| The second paper white | Two whites for one gesture. The 14ms strike frame is `#e8e2ee` everywhere it appears |
| `FAM_TRAIL`, `FAM_PROJ`, `FAM_WORD`, `FAM_MISS` | Four tables whose keys are always the same five strings, looked up on the same frame from the same two functions. Keys on `FAM_CALL`'s row instead |
| `groundDir`'s shared scratch object | A single mutable scratch returned to two callers on one frame is a loaded gun. The spoke computes its own vertices |
| `erdtick`, at 22 a second | `voxAnswer('erd')` already **is** this family's voice. `erdclap` is the 4ms transient in front of it, and a tick at 22Hz is a texture nobody asked for |
| `pipScale` | It scaled four literals out of eleven: at 1.3 a 30% bigger empty box round the same 8px text, at 0.7 the baseline below the plate. One glyph per cell removes the thing it was for |
| `design-proj`'s grouped chip, the eleven-layer debuff frame, the 11x11 count badge, the twenty-five bordered plates | All four resolve by **deletion**: one glyph per syllable, the count **is** the number of cells, and twenty-five dark plates over a crowd read as a picket fence in the one scene whose point is that these are people |
| The `snapStacks` burst, `4 + n * 2` particles | Twenty glowing squares per body in the closing family's colour, from a shared function, on the money frame. It broke `-ark`'s one rule, double-counted `-ight`'s budget, and was the 160 particles every perf table was short by. Each family owns its own snap matter |
| The leash, and `dragland` | The drag's own bar sweep already says what the leash said, and a second attachment to the player on the same frame is two ropes |
| `drawAssembly` (2683-2713) | Replaced wholesale. It is the crude two-colour offset the brief calls out by name |
| `RT.punch`, a fifteen-field object on the `RT` literal | One line in a shared literal is one merge conflict. The state lives on `RT.fx.punch` through the same registry as everything else |
| `RT._dms` | Same reason. The perf counter is `fxOf('punch').dms` |
| `RT.hitstop`, `erdStop`, `illHold`-as-a-field, `-ark`'s `H` | Four fields summing into a hang. One `pz.stop`, written only by `punch()`, and the families get a `stop` multiplier |
| The per-frame shake re-roll | Frame-rate dependent by construction: identical amplitude looks like a rattle at 144Hz and a lurch at 60. A decaying two-sine phase, rounded, looks the same at both |
| Routing the punch through `shake()` | It **adds**. Twenty-five events drive it to the cap regardless of size |
| `-ight`'s bracket alpha 0.30-0.60 and pin travel 78-134 as the power channels | Eight `fillRect`s a frame doing nothing: nobody sees a 0.05 alpha step, and nobody reads pin travel at that speed. The power goes to something countable — **how many lights are on you** |
| `-ill`'s word hold ramp, 0.48s against 0.69s | Nobody times a word |
| `-ill`'s hard rim gate at `n >= 4` | A visual cliff between three and four with nothing at three. Continuous: `clamp((n-2)/4, 0, 1) * 0.5` |
| `design-deton-5`'s `fxSfx` carve-out for `stanzaWave` and `versePulse` | Withdrawn: the gate is on `FX_T`, which is **real** seconds, so it no longer swallows anything under dilation |
| `design-deton-4`'s `RT.t` sound gate | Under a recital, 0.26 real seconds is 0.078 sim seconds. A gate whose window changes length when time thickens is not a gate |
| The two local `var T` declarations | `T` is the tunable accessor with 200+ call sites. `tr` or `rec` |

### 11.3 Cut by this pass

Four things the eight designs all kept and none of them owned.

| cut | reason |
|---|---|
| The `caesura` **sound** | Its own specification says *almost silence... if it cannot be made subliminal, cut it*, and `settle` is already the subliminal click that ends a punch. Two inaudible clicks is one too many. **The 2px caesura mark stays**: it is the visual full stop and it costs one `fillRect` |
| `-ight`'s `g.tick`, the two 4px ground marks | Kept, but **only inside the reveal window**. Held past the reveal they are a third persistent floor mark competing with `-ark`'s stain and `-erd`'s ground rule, in the family that is supposed to be about light rather than about the floor |
| The 60 to 90Hz `lurch` firing on every punch | Gated to `kind: 'close'`, `'wave'` and `'toll'`. A Call landing five times a second with a sub-bass thump under each is a mud generator, and `tap`'s zoom is one ladder rung it will not even reach |
| Any per-frame `toFixed` outside `RT.dbgPerf` | Not a proposal so much as a habit four designs shared. Every colour goes through `partCol`, `fampx` or `mixRgb`, all of which build their string once |

### 11.4 Doubted, and kept anyway

Recorded so nobody re-litigates them at review. Each of these was questioned by at
least one critic and survives for the reason given.

| kept | why |
|---|---|
| `-ark`'s permanent floor outlines, 24 per room | The game has never had a persistent consequence and this is the family that should introduce one. Bounded ring buffer, cleared only by travel |
| `-ark`'s detached contact shadow that never returns | One `lerp` on a field three other families already write, and the most unsettling thing available anywhere in the overhaul |
| `-erd`'s ground rule at your feet **and** the detonation's rule under the line, on the same frame | They measure different things and are drawn in different spaces: the ground rule is 2:1 on the floor plane with **one tick per body**, the detonation rule is a screen rule with **one notch per syllable**. See §12 |
| `PUNCH_LV[3]`, "too much" | Free: every clamp still applies, so it is a faster ramp to the same ceiling and not a new ceiling |
| No frustum cull on particles | Two `isoX`/`isoY` and a compare per particle is not obviously cheaper than the `fillRect` a clipped-out rect already costs, and a cull silently eats the one particle you are debugging. Noted as available if the budget ever needs it |
| `stick` **and** `stick.big` | Two samples for one condition, and the condition is *this body is nearly full*, which is the single most useful thing the Call can tell you |

---

## 12. CONSISTENCY PASS

Read end to end after §11 was written. Fourteen things are still contradictory or
still unowned, and **the engineer must decide each one before writing the code, not
during it.** Each has my recommendation. Nine are one line; three are real
engineering calls; two are arithmetic errata that only matter because thirteen
documents quote the tables.

---

**1. The particle house split sums to 1012 against a cap of 900.** §2.5 and §3.7
both print *112 for the snap, 300 for the whole detonation, 600 for everything
already in the room.* `part()` caps at 900.
**Recommend:** the snap's 112 is **inside** the detonation's 300, not beside it,
which is the only reading consistent with §3.6 taking the burst out of `snapStacks`
and giving each family's `det` its own snap matter. **300 + 600 = 900.** Restate it
that way in both places and the measured cases (96 at 8x8, 50 in the square) fit
with the room to spare they were counted with.

**2. `ord: 91` is not on the closed `ord` map.** §2.2 says *the map is closed, take
a row, do not invent one*, lists 10, 30, 42-50, 70, 86, 87, 88, 90, 90.5, 92, 93 —
and then `fxBoot` four paragraphs later registers `stz` at 91.
**Recommend:** add the row. `91 | screen | the stanza and recital rows`. It sits
where it should, between the family gesture on the line and the slant patch. This
is a documentation fix, not a code fix, and it is the kind of omission that makes
the next person invent 89.5.

**3. `arkRimBody` is a name that no longer exists.** §3.6 promotes `arkRim` to two
shared keys, `vfxRimGround` and `vfxRimBody`, and §3.4.4's code still reads
`T('arkRimBody')`, which returns `undefined` and makes the whole alpha expression
`NaN` — a rim that draws nothing, with no error.
**Recommend:** `T('vfxRimBody')`. This is exactly risk 19 with a different key, and
it is why §10.4 E enumerates all forty-five.

**4. The `illHold` tunable has the name of a deleted field.** §2.1 deletes
`illHold` as one of the four competing hitstop fields; §3.6 introduces `illHold` as
a `TUNE` key for the execute hold. Two different things, one name, in the same
overhaul.
**Recommend:** `illExecHold`, as §7.1 already writes it. Cheaper than the review
comment it will otherwise generate every time.

**5. Three `-erd` tunables are declared and never read.** `erdClap` (0.075),
`erdReach` (40) and `erdChips` (3) are the three literals in §3.3.3's
`CT = 0.075 + 0.048 * d.pb`, `D = 40 + 168 * d.pb` and `min(4 + 3 * nn, 22)`.
**Recommend:** wire all three. A FEEL slider that moves and changes nothing is worse
than no slider, because it costs a debugging session to discover.

**6. `punch()` writes `pz.hard` and `pz.cut` last-writer-wins while every other
channel takes a max.** Close an `-ill` rhyme — `hard: 1`, so the light holds flat and
then **stops**, and the zoom releases in one hard step — and then land any Call from
any other family 50ms later. `pz.hard = F.hard` runs unconditionally, `hard` flips to
0 mid-hold, and the family that stops fades out instead. It is the one place the
"take the larger" rule has a hole, and it will read as an intermittent bug in the
one family whose whole character is the thing that breaks.
**Recommend:** latch both behind the same comparison the hold uses:
`if (st >= pz.stop) { pz.hard = F.hard; pz.cut = F.cut; }`, evaluated **before** the
`pz.stop` assignment. The character of the loudest event on screen wins, which is
the rule everywhere else in `punch()`.

**7. `RT.chroma` decays on the sim clock, and the split is a letter effect.**
Line 3841 is `RT.chroma = Math.max(0, RT.chroma - dt * 2.4)`. §2.2's doctrine is
*matter freezes, letters do not*, and `chromaText` splits letters. Under a recital
at `RT.dilate ≈ 0.3` the fringe lingers three and a third times as long as it was
tuned to, on the four biggest words in the game.
**Recommend:** move that one line to `real`. **Leave `RT.flash` on `dt`**: the light
holding flat through a freeze is what `pz.fhold` and `-ill`'s `hard` arm both
assume, and it is right. Two adjacent lines, two different clocks, and the comment
must say why or somebody will "fix" it back.

**8. `RT.shake`'s amplitude is frozen through a hitstop while its phase is not.**
`RT.shake` decays on `dt` at 3840; `pz.st += real` in `stepPunch`. So during
`-ill`'s 141ms hold the frame vibrates at **full undecayed amplitude** for the whole
freeze. Nobody has seen this, because the hitstop does not exist yet.
**Recommend:** ship it as written and look at it first. It is plausibly excellent —
a held frame that judders is a fighting-game idiom — and if it reads as a rattle the
one-line fix is to decay `RT.shake` on `real`. Flagged here so the first person to
see it knows it was a choice.

**9. Two erratum cells in the frozen tables.** §4.13's release spread at `n = 8`
prints 0.098, which is `7 × 0.014`; the code is `min(0.014, 0.10/n)`, so from eight
syllables the stagger tightens to 0.0125 and the spread is **0.0875**. §3.1's notch
table prints 10 at `n = 8`; `clamp(2 + round(0.9 × 8), 3, 10)` is **9**.
**Recommend:** the code wins in both. Nine notches is also the better picture,
because ten reaches the clamp and a body carrying twelve would then draw the same
number of holes as one carrying eight. §6 prints the corrected values with
footnotes.

**10. §2.7's prose and §2.7's formula disagree about the bloom radius.** The comment
says *730px around one body at one syllable; 1790 and the room is full at twelve.*
`VW * (0.65 + 0.95 * p)` is 941 at `p = 0.2` and 1792 at `p = 1`. The second number
is exact and the first is 22% out.
**Recommend:** the formula is right and the comment is describing the **visible**
extent, where the outer two of the six bands are under the alpha floor on a
near-black scene. Reword the comment to say so rather than changing a number that
thirteen documents quote.

**11. `seen` is fired and never declared.** §3.2 has
`fxSfx(f.armor > 0 ? 'bare' : 'seen', 0.09)`; §3.6's new-sound table lists only
`bare`. Harmless — `sfx()` drops an unknown name silently — but job 2 will write one
sample and ship a family whose two-state read is audible half the time.
**Recommend:** `seen` is on §7.2's list of twenty-five. It is explicitly **not the
same sample as `bare`**: that difference is the whole point of `crit-art-ight` #7.

**12. §5.30 calls `reprise` and `sour` new sound names.** Both already exist in
`comp/ninth.js` (4467's table). Only their **timing** and their **coalescing**
change.
**Recommend:** strike both from the PR body's "new" list. Twenty-five new names is
already a lot to ask of job 2 and two of them being wrong costs credibility on the
other twenty-five.

**13. Two rules can be on screen on the same frame, counting two different
things.** `-erd`'s ground rule at your feet has **one tick per body**; the
detonation's rule under the line has **one notch per syllable**. Close an `-erd`
rhyme on four bodies carrying three each and there are two measured rules in frame
saying 4 and 12.
**Recommend:** keep both, and make the difference structural rather than hoping the
player infers it. The ground rule is drawn on the **1:0.5 ground plane** in
`ERD_COL`, at the player's feet, under the bodies; the detonation rule is
**axis-aligned in screen space** in the strike white, under the line. Different
plane, different colour, different anchor. If they still read as one thing in
`fam-det-erd` (§10.2), the ground rule is the one that goes: the detonation's rule
is shared by five families and this one is not.

**14. The whole panel's screenshots come from a rig that bypasses the input
chain.** `vfx-lab.html` drives everything through `window.__ninth`, and
`TESTING.md`'s one rule exists because a build shipped where pressing E did nothing
and the dev handle reported everything working. Every design in this overhaul was
illustrated through that handle.
**Recommend:** the `?drive=key` patch in §10.0 is **acceptance step zero**, not an
optional extra, and `key-off` must equal `key-on` before any other frame in the
checklist is believed. It is twelve lines in a file that is never published.

---

**Everything else reconciles.** The four clocks are consistent across all eight
areas (sim for matter, real for letters, `FX_T` real for the sound gate, `pz.st`
real for the shake phase). The two draw seams still take exactly two calls. `fxP`,
`fxS`, `fxW` and `fxBudget` are the only power curves in the document and every
quoted table in every section derives from them. There is one `punch()`, one
hitstop field, one shake writer, one glow bake, one particle colour memo, one row
geometry, one body-height function and one iso angle conversion. No section reaches
into the HUD, no section edits `MODS`, and no section adds a sixth family.

The typography is the backbone, the matter is elemental and different in all five
families, the power is countable before it is loud, and the screen punch is one
entry point behind one option with four honest levels.

---

*End of the blueprint.*
