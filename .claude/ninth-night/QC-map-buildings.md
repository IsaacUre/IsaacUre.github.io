# NINTH NIGHT: QC of the map and the buildings

> **Fixed.** Everything below was found on 12 August 2026 and fixed on the
> 13th, in the eight commits that follow this file into `main`. It is kept
> as the record of what was wrong and why, not as a list of open work. The
> line numbers were correct against the file at `b185019` and have drifted
> again since; grep for the symbol.
>
> Three harnesses came out of the fixing and they are the reason to keep
> reading this: `tools/critical-path.html` walks the acceptance floor,
> `tools/cutaway-checks.html` asserts the world layer's render rules
> against the canvas, and `audit-geometry.js` grew nine checks, one for
> each class of thing in here that got past it.

12 August 2026. Read-only pass over the world layer of `comp/ninth.js`. Nothing
under `comp/` was changed.

The pass ran against the file at `88c665c`. #126 and #127 landed while it was
running and took the file from 8,280 lines to 16,317, so every line number below
has been re-derived against the merged file and every finding re-checked to
confirm it survived. One got worse: the facing bug now has three sites, because
#127's new `drawMuzzle` copied it.

**Method.** Thirteen independent code lenses over the world layer, every one of
the 13 places captured and looked at, runtime probes driving the game with real
key events, then two adversarial skeptics per finding, both told to refute.
75 findings went into verification and 58 came out. 17 were killed, including
four that were plain wrong. The static audit (`audit-geometry.js`) reports
"geometry clean" and is telling the truth about what it checks; most of what is
below sits in the gaps between its checks.

Evidence, with the worked maths and the repro for every finding:
`.claude/ninth-night/qc-2026-08-12/round1-findings.txt` (round one, `[N]`), `.claude/ninth-night/qc-2026-08-12/round2-findings.txt`
(round two, `[NN]`), `.claude/ninth-night/qc-2026-08-12/verdicts-round1.txt` (what the skeptics said).
The capture harness written for this is
`.claude/ninth-night/tools/canvas.html`.

---

## 1. The verdict

The world is better authored than it is rendered. The place data is careful,
the painters are genuinely detailed, and the ground is the best thing in the
game. What is bugged is mostly the layer between the two: the cutaway, the
depth sort and the actor projection all disagree with each other by about half
a tile, and where that lands on a wall it puts the player behind it with
nothing thinning.

It is bugged, and the two worst ones are invisible rather than loud. The roof
cutaway has silently stopped working over 67 tiles of walkable ground across
eleven places, including a fifth of the chandler's floor. And the child in the
square has been walking into the well for as long as the well has been there,
so she spends about an eighth of every minute standing still inside it where
nobody can see her.

Nothing softlocks. Every place is reachable and leavable in every save state,
the walkable area of all 13 places is one connected region, every exit band,
person and examinable can be reached on foot, and 50 rounds of thrashed place
changes produced no console errors.

---

## 2. Broken

### The roof cutaway has stopped working [25, 17]

`comp/ninth.js:14069` and `:14237`.

`paintedBox()` declares that a prop's paint stops at `-(hgt + over)`. It does
not. `propSprite` sizes the sprite canvas with `ay = PAD + ceil(rry + hgt +
over)`, because the footprint's north corner already sits at local `y = -rry`
before anything is extruded, and `paintedBox` drops the `rry` term. Measured
against the real alpha of every sprite the game builds, the paint reaches above
the declared top for 58 of the 96 prop instances: the chandler's north wall by
91px, Bern's by 84, the stage footlights by 81, the curtain by 73.

Then `coversSomeone` asks whether the prop swallows you *whole*
(`if (sy > y1 || sy - a.h < y0) continue;`), so a figure whose head is above the
declared top counts as visible. With the top 91px too low, people who are
entirely buried read as sticking out and the roof never thins.

Fix, and both halves have to go in together:

```js
y0: -(c.rry + c.hgt + over)        // 6510, the number the canvas was already sized to
if (sy > y1 || sy - a.h > y1) continue;   // 6678, an overlap test rather than containment
```

### The child walks into the well and never comes out [N12, 7]

`NPCS.child.path` at `comp/ninth.js:12892` against the well at `:12639`.

Her fourth leg runs east from `(7.4,10.0)` to her home at `(10.6,9.8)`, along
`y ≈ 9.9`, which is inside the well's blocked band (`y 9.12..11.28` at the NPC
radius 0.28). She is refused at `x = 7.72` after ten frames, the give-up test at
`:13766` fires on the next frame, and `w.i++` skips her home entirely. The loop
is three legs and a wall, forever.

Simulated on the real code: she gives up at frame 10, stuck at `x = 7.716`,
still 2.89 tiles from home. Over 60 seconds she stalls 8 times for 7.02 seconds
total, and the well hides 100% of her while she does it. She never once reaches
her own home tile.

Fix is the path data. Route every leg clear of `x 7.72..9.88` crossed with
`y 9.12..11.28`.

Two things fall out of this. The audit checks path points for standable and
reachable but never for buried, and the well flags with 16.8px of margin once
it does. And her authored home at `(10.6,9.8)` is under the south-east house's
roof, which the audit misses by 1.1 pixels because it hard-codes a 40px figure;
that one is milder than it first read, because the roof leaves her hat and eyes
showing and she is only there for the 0.4 to 2.2 second start wait.

---

## 3. Bugs

### A quarter of all walking is drawn facing backwards [N11]

`comp/ninth.js:13765` (`stepNpcs`), `:2897` (`drawActor`) and `:5417`
(`drawMuzzle`).

`cx.scale(-1, 1)` is a mirror in screen x, and screen x is
`ORX + (x - y) * 29`. So the screen direction of travel is `sign(dx - dy)`.
Both sites test `sign(dx)` alone. The two disagree on exactly 25.0% of
directions, and the disagreement is precisely the case where somebody walks
mostly along the y axis, which on screen is left or right.

Measured over 60 seconds of real frames: the child 44.4% of her walking frames,
the chandler 25.8%, the shepherd 25.1%. The child is worst because her third
leg has `dx = 0` authored, so the sign is a tie-break on float noise.

```js
w.face = (dx - dy) >= 0 ? 1 : -1;                                  // 6206
var west = (Math.cos(RT.face) - Math.sin(RT.face)) < 0 ? -1 : 1;   // 2113
```

### The floor PRNG collapses to 419 numbers [14]

`comp/ninth.js:1468`.

`seed * 1103515245` reaches about 2^62. A double carries 53 bits, so the low
bits are gone before `>>> 0` ever sees them. From seed 9 the generator visits
5078 distinct states and then cycles with period 419. Verified: first repeat at
draw 5078, previously seen at 4659.

`GROUND.town` draws 16188 numbers for a 17x15 floor, so 71% of the square's
cobbles come out of a 419-number loop, and 2681 cobbles are drawn from 929
distinct (radius, shade) pairs. The repeat lands on a half-pixel offset so it
reads as a faint horizontality rather than obvious tiling, but the ground of
the hub is being made out of 419 numbers.

One line: `seed = (Math.imul(seed, 1103515245) + 12345) >>> 0`. No repeat in
300,000 draws after.

### Pressing M in the prologue throws the map off the bottom of the screen [28]

`comp/ninth.js:15661`.

`lo`/`hi` accumulate only over places that are visited and not `MAP_HIDE`. A
fresh save starts on `stage`, which is hidden, so `any` is false and the
fallback centres the panel on cell `(0,0)`, which nothing occupies. The node
loop still draws every place at its real cell. Derived: `cell` 100, `ox` 560,
`oy` 280, so the square, Bern's house, the chandler, the mill and the road land
at `y = 580` on a 580px canvas, the lane, Grelling and the mark at `y = 680`,
and every label at 606 or 706. What the player sees is the title, two `?` dots
for places they have never heard of, and four half circles on the bottom edge.

This is the first map the game ever shows anyone, and `m` is only guarded by
`!RT.dialog`, so it is reachable.

Fix: when `any` is false, take the bounds of everything that will actually be
drawn instead of `[0,0]`.

### The interiors' east wall is nine tiles long and sorts on its centre [N28]

`comp/ninth.js:11358`, data at `:12665` and `:12683`.

A prop is one entity with one sort key, taken at its footprint centre. Bern's
east wall spans `x+y` from 10.4 to 20 and its key is 15.2, so everybody at
`x+y > 15.2` draws after it. That is the whole south-east quadrant of the room,
which is on the far side of the wall from the camera. At `(9.2, 6.1)` there are
2.4 tiles of wall between the camera and the player, and the entire figure
renders inside the wall's painted face.

Fix is data: split both nine-tile walls into three-tile segments so each
segment's key is within 1.6 tiles of its own ground.

### Both interiors keep the near wall [N33]

`comp/ninth.js:12665`, `:12683`.

In this projection the two faces nearest the camera are the south and the east.
The standard iso cutaway drops both. These rooms drop only the south, so the
kept east wall stands between the camera and the room, and whatever is authored
behind it is behind it. Bern's bed loses 81% of its top face to it. The
chandler's east lamp is behind it too.

Fix: drop the east wall in both, and let the floor edge read as the wall line
the way the south already does.

### Half the houses are lit from the wrong side [N16]

`comp/ninth.js:14427-6874` against `:14532`.

The walls obey the light rule (`plaster(se, false)`, `plaster(sw, true)`). The
roof does not: `PAINT.house` paints `farPlane` unlit and `nearPlane` lit
unconditionally, and that only coincides with the light rule for one of the two
ridge orientations. For `flip`, `nearPlane`'s eave corners are S and E, so the
lit plane sits over the shadowed `se` wall. Every odd-variant house in the game
has a bright roof over a dark wall.

Fix: in the flip branch, hand the planes over in the order that matches the
walls rather than the camera.

### The lamp you set down leaves nothing on screen [1]

`comp/ninth.js:696`, `:15371`.

`setLamp` records `S.items.lamps[here] = 1` and nothing else. `lightsOf` builds
its list from `p.props` and `p.lights` only. Grep gives exactly six sites for
`items.lamps`: the save default, `setLamp`, `lampsElsewhere`, `takeLamp`, the
dev clear button and the bag panel. No prop is added, no sprite is painted, no
light is pushed.

The prose says otherwise. "It throws about a yard of light and the rest of it
stays dark." And at the mark, which is the one place this item exists for:
"You set it down on the marker stone, out past the fence, for somebody the town
does not set lamps out for." The stone looks exactly the same afterwards.

Fix: store the position (`S.items.lamps[here] = [RT.px, RT.py]`, still truthy)
and push a light for it in `lightsOf`.

### Dying leaves you winded and then walks you back into it [N1, N2, 3]

`comp/ninth.js:2563-1794`.

`gotoPlace` does the pair on one line: `RT.breath = stats().breathMax;
RT.winded = 0;`. `revive()` copies only the first half. Worse, `RT.winded -= dt`
lives inside `stepPlayer`, which `step()` does not call while dead, so a 1.5s
lockout that should have expired twice during the 2.2s death animation is
frozen and handed back intact. You get up with a full breath bar reading WINDED
and no verbs for 1.5 of your 1.6 invulnerable seconds.

`revive()` also leaves `RT.moveTo` standing. The first live frame walks you at
`moveSpd` 3.5 toward the tile you clicked before you died, which is by
definition the tile you were fighting on. Measured on the road: 2.27 tiles of
walking nobody asked for, and still going.

And it does not snap the camera. `stepCamera(0, true)` is called from
`gotoPlace` only, so dying at one end of the road and respawning at the other
pans the eye across the map.

Three lines, all next to the `RT.px`/`RT.py` assignment: `RT.winded = 0;`,
`RT.moveTo = null;`, `stepCamera(0, true);`.

### The map draws the lane south of Wick and the mill on Wick's own row [27]

`comp/ninth.js:15610`, data at `:12649`.

Every place in the game authors north as `-y`. The square is the one exception:
its exit named "the lane, north" sits at `y = 14.3` in a 15-tall place, so
`exitDir` returns `[0,+1]` and the lane is placed one cell *down* from Wick.
The chain then reverses. From the lane, `lane -> mill` points `[0,-1]` at the
square's own cell, the slide loop fires three times, and the mill parks two
columns east of Wick on Wick's row. `mark -> road` slides too.

The fully explored map reads left to right as "Bern's house, Wick, the
chandler's shop, the mill, the road north", with the lane hanging below Wick.
The player's own prompt behind the overlay says "go to the lane, north".

Fix: honour an explicit `dir` on an exit (`if (e.dir) return e.dir;` at the top
of `exitDir`) and set `dir: [0,-1]` on the square's lane exit. Re-authoring the
exit itself is not available, because `y = 0.7` on the square's north wall is
behind two houses.

### Three of the Act 3 audience cannot be seen [N27]

`comp/ninth.js:13063-5523` against `:12828`.

The audience are foes, and `RT.hide` is built from the player alone, so
`coversSomeone` never fades anything for them. The south-east house sorts later
than every seat. Measured against the house's real alpha: seats 15, 20 and 21
are 100% hidden, seat 10 is 70% hidden, seat 9 is 44%.

The audit never reads `A3_ROWS`, because it iterates `p.npcs` and `a3sq` has
none.

Fix: pull the right-hand end of rows 3, 4 and 5 west and south out of the
house's cone.

### The examinable the game is named after points at a street lamp [N32]

`comp/ninth.js:12645`.

"A lamp on a sill" sits at `(12.4, 8.2)`. The nearest prop is the street lamp
at `(12.05, 7.85)`, half a tile away. The nearest actual sill light is
`(9.0, 1.764)`, which is 7.28 tiles off. So the text "Set out on the ninth
night for the man who walked out past the fence. Every house on the square has
one" is read standing next to a public lamp post with no house sill within
seven tiles.

Fix: move the look to `(4.6, 2.6)`, under the north-west house's own lit
window.

### Everything that moves is drawn half a tile south of where it collides [19, 20]

Every actor, ring, light, particle, prompt and the camera target use
`isoY(x, y) + TILE_H / 2`. Props and the floor do not.

`buildFloor` draws the diamond for loop index `(x,y)` with corners at world
`(x,y)`, `(x+1,y)`, `(x+1,y+1)`, `(x,y+1)`, so `isoY(x,y)` with no offset is
the true ground point, and `+ TILE_H/2` is the projection of `(x+0.5, y+0.5)`.
Re-derived independently and it holds.

The consequence is a 14.5px registration error between actors and the world in
the direction that buries people. Stand legally north of Bern's table and you
are drawn inside its footprint, the table sorts later, and the cutaway does not
fire. `PAINT.fence` already carries a local patch for this at `:14876`, which
puts its rails 14.5px off its own contact shadow and collision box.

This one is real and it is the most invasive on the list: about 14 call sites
plus the fence. It is also the root cause underneath several of the burial
findings, so it is worth deciding on before fixing them one at a time.

### Smaller ones, same shape

- **The cart's front wheel is on its tailgate** [N18], `comp/ninth.js:15001`.
  `c.fw` is the length of a sloped iso edge, and `PAINT.cart` uses it as a
  horizontal span. It is 11.8% too long and centred on the origin rather than
  the side's midpoint, so the rear wheel is on the side and the front wheel's
  whole 16px diameter is on the end. `bar()` exists because this exact bug
  shipped once; the cart is the last reader of `c.fw`.
- **The fire in Bern's house burns on the floorboards** [N19],
  `comp/ninth.js:15303`. The fire anchor takes `bx` from `u = 0.5` and `by` from
  `u = 0.82`, and the face's foot slopes. The grate ends up 5.2px below the
  floor of its own fireplace, and the logs march further out westward.
- **You can walk past both road fences** [N30], `comp/ninth.js:12783`, `:12700`.
  `blocked()` is a strict AABB and `moveActor` clamps to `0.5 .. W-0.5`. The
  road's west fence at `b[0] = 0.8` fails `x + r > b[0]` by exactly zero at
  `x = 0.5`; the east fence fails by exactly zero at `x = 10.5`. Hold the key
  into the edge and you walk past the fence the whole game is about walking
  past. The lane's east pair leaves 0.1 tiles free the same way.
- **The frost in the hollow is ruled through the tile centres** [15],
  `comp/ninth.js:1382`. The tile edges are at `k + 0.5`; `GROUND.hollow` draws
  at integer `u` and `v`. The white lattice sits exactly 14.5px off the black
  one, so the one ground that is meant to look ruled has two interleaved grids
  at half-tile pitch. Measured down the `u == v` column: dark on every tile
  corner, bright exactly 14.5px off it, all the way down. Fix is the loop
  bounds: `for (var v = -0.5; v <= f.gh - 0.5; v++)`.
- **The square replays its tutorial every time you walk in** [N4],
  `comp/ninth.js:13026`. `SCRIPTS.mill` guards on `S.seen.millIntro`;
  `SCRIPTS.wick` guards on nothing but `S.a3.ending`. `wickIntro` appears
  nowhere in the file. So the hub fires 6.4 seconds of "Talk to people. Look at
  things" at a player who has been to the hollow.
- **Bern's house subtitle contradicts Bern** [N34], `comp/ninth.js:12662`. The
  subtitle is "he has kept the part for forty years and never played it". Bern,
  in the same room, says "I played him thirty years". The shop item and a code
  comment agree with Bern. Three to one, and the odd one out is the line the
  player reads first and every visit.
- **No "you are here" during Act 3** [31], `comp/ninth.js:15684`. `a3sq` is
  `MAP_HIDE`, so the `here` branch never fires for any node and the gold marker
  is absent from the whole final act.

---

## 4. Polish

| | |
|---|---|
| [2] | The player's lantern is drawn twice: a circle in `drawActor` and a squashed ellipse in `drawLights`, different radius, colour and offset. Only one is under the night veil, so the same lamp reads at four different strengths depending on the place. |
| [3] | Two vignettes are stacked, the canvas one and the `.nn-vig` DOM element, and the CSS one re-eats the corners the canvas one was deliberately softened to stop eating. |
| [4] | Five of the twelve house sill lights sit outside their own place (`x = 17.2` in a 17-wide place), so half of each pool falls on black. Verified by re-deriving `houseSillU` and `propVar`. |
| [9] | Eleven of the eighteen exit prompts read badly out loud, because the names are directions and the prefix is a verb: "go to back down the lane", "go to out to the square", "go to back down". Dropping "go to " fixes all eighteen; "E" already says it is an action. |
| [10] | An em dash inside a spoken line, `comp/ninth.js:12926`, the shepherd. It is the only one in the file used as sentence punctuation in prose. A comma does it. |
| [11] | The camera runs out of room on the road. It tracks for about ten tiles in the middle and is pinned at both ends, so roughly 573px of the walk is the player crossing a static frame. Caused by clamping the eye to `placeBox`, which for an 11x34 place is mostly empty triangle. |
| [24] | `drawVignette` re-rasterises a static full-screen gradient every frame. Measured on the game's own context: 2.26 to 2.76ms, which is 62% of the square's world frame and essentially all of the arena's. Baking it to two offscreen canvases makes it 0.08ms. |
| [29] | The map's node loop has no visited guard, so a cold save plots all ten places including six with no road attached. The `?` styling is deliberate, so what leaks is the world's size and shape, not the ending. |
| [32] | Both room interiors draw as peer settlements on the overland map, at the same scale as Grelling, one of them in the middle of the Wick to mill line. |
| [33] | The map's "M to close" hint is drawn at `VH - 40`, underneath the DOM HUD it cannot dim, wedged between the word chips and the rhyme keys. |
| [N5] | Walking into a locked door shakes the breath bar. `hudNudge` is the "you cannot afford this" feedback and every other caller is a cost refusal. The loft door fires it mid-fight. |
| [N6] | Every arrival hands you a prompt to walk straight back out the door you came in. |
| [N13] | The talk mark and the widow's lamp are drawn inside the ents pass, so they lose half their contrast to the night veil while `drawPrompt` loses none. Measured, the mark is about three lit pixels. |
| [N14] | A walking NPC takes the prompt off the door you are walking to. The child owns the lane-door prompt about 30% of the time. Fixing her path removes it for free. |
| [N20] | The hedge floats 15px above its own contact shadow. |
| [N21] | The dither on every round body is thrown at a bounding rectangle rather than at the object. |
| [N22] | The mill wheel is the one moving thing in Wick and the one thing not made of pixels. |
| [N24] | The house's sill light-spill quad takes its bottom corners from the far ends of the wall. |
| [N26] | The prologue's whole thirteen-tile backdrop drops to 56% while you stand at the front of the stage. |
| [N31] | Act 3's Wick drops the well, and the seat it was blocking is why. Deliberate, but the ground bitmap is shared and pixel-identical across the transition while the props are not. |
| [N35] | The road's cairn look says the cairn is on the west side of the road. The one it resolves to spans `x 6.0..7.2` in an 11-wide place. |
| [N36] | Three of the square's five houses are the same house: two share a variant outright. |
| [N37] | The lane's two trees are one bitmap and the road's three trees are one bitmap, blitted twice and three times. |
| [N38] | One of the hollow's five ring stones sits inside the tree's canopy, so the ring the story look is about reads as four stones and a tree. |
| [N40] | The chandler says the last lamp is where the fence stops. The fence stops at `y 23.6`; the lamp is at `y 30.4`, 6.8 tiles short, and both are on screen together. |

Contested prompts, measured over every standable 0.1-tile cell:

- The mill door look and the loft exit are 0.22 tiles apart. The look wins 8.9%
  of the standable area, the shut exit 41.4%. The look is the text that
  explains why you are at the mill.
- Bern stands 0.63 tiles from the playbill, and he does not move. The playbill,
  which has the player's own name pencilled on it and gone over twice, wins
  4.9%.

---

## 5. Risks

Not wrong today. Each one has an audit check that would stop the next one,
which is this repo's own habit.

- **[13] The playbill sits 0.3 tiles from the point of no return.** The a3sq
  exit band is `x 7.5..9.9`, `y 6.15..7.05`; the playbill is at `(7.2, 6.6)`,
  inside the y range. `stepTravel` takes you with no prompt and no
  confirmation, and `a3sq` has no exits and `oneway: 1`. Check: warn when a
  look is within 0.75 tiles of an exit band edge.
- **[12] Four look keys and two dialogue flags are written and read by
  nothing.** `bernscript`, `ledger`, `fenceend`, `hollowground`, `askedTwo`,
  `askedLastLamp`. Bern's script with the circled five and the ledger with four
  hundred years of one lamp per house are the two most loaded facts in the game
  and neither does anything mechanically. Check: grep the source for a reader
  of every look key.
- **[25] `SPRITE_BUDGET` is 10MB and the game's own prop sprites total
  12.07MB.** 64 distinct keys. The cache runs permanently at its ceiling from
  mid-game. Harmless today only because the 2.07MB that has to go is the
  prologue stage and a3sq. Three more houses anywhere and eviction starts
  landing on places you walk in and out of.
- **[26] `FLOORS` is capped by entry count while `SPRITES` is capped by
  bytes.** Floor bitmaps range 1.21MB to 4.43MB, so seven entries is anywhere
  from 8.6MB to 17.9MB, and the act 2 walk selects the seven biggest. Measured
  live at 17.89MB. `PARALLEL.md`'s note on this is stale in three ways;
  `close()` does free it now.
- **[N7] `RT.prompt` survives the doorway it just opened.** Two E presses in one
  frame period re-enter the place you are in, which finds no back exit, falls to
  the else branch and teleports you to `(W/2, H-2.2)`. `RT.prompt = null;` in
  `gotoPlace`.
- **[N9] The audit models `gotoPlace`'s arrival exactly and does not know
  `revive()` exists.** `revive()` is the one teleport with no `unstick()` behind
  it. All 13 spawn points are clear today, but the nearest exit band edge is
  0.85 tiles in eight of them. Check: run the same predicate over
  `(W/2, H-2)`.
- **[22, N15] NPCs collide at r 0.28 and clamp to 0.6; the player collides at
  0.3 and clamps to 0.5, and `stepNpcs` clamps *after* the blocked test while
  `moveActor` clamps before.** Eight gaps in the game admit a walker and are
  sealed to you. Nothing reaches them today, and `gotoPlace` resets
  `RT.world.npc` so nothing can stick for longer than one visit.
- **[23] The audit's buried-NPC check uses the prop projection, not the actor
  one, and only tests the authored home tile.** Wrong by half a tile in exactly
  the direction that buries somebody, and blind to `path` and `wander`.
- **[30] The audit copies `buildMap` but discards `slip`.** Two places had
  their cell decided by collision rather than by direction and it says nothing.
  `slip > 0` is the signal that the map is about to lie.
- **[6] The audit's night-light check lists `house | lamp | foot | mill` and
  `lightsOf` also emits for `hearth`.** One word. A future room lit only by its
  fire would fail the commit gate.
- **[5] `dark: 1` is read by nothing in the game.** Three places set it and only
  the audit looks at it. Either make it a third veil tier or drop it.
- **[21] `PROP.post.ins` is read by `body()` but not by `blocked()`,** so the
  post is drawn at 42% of a footprint it collides at 100% of. `PROP.tree.ins`
  is fully dead, because `PAINT.tree` never calls `body()`.
- **[N8] `RT.mapOpen` is not in `gotoPlace`'s reset block.** The player cannot
  walk through a door with the map up, but two `gotoPlace` calls are not the
  player's: the prologue's timer and `a3Home`. Press M during the credits and
  you land in the morning square with the map still over it.
- **[N29] The small-prop guard at `comp/ninth.js:14231` is dead code.** Over 89
  authored instances the smallest box is 33.35 by 33.95, so `< 24` has never
  fired. Seven lamps are already eligible to trigger the cutaway.

---

## 6. What is good

The ground is the best thing here and it is not close. Seven materials, each
one scattered rather than tiled, and six of the seven read unmistakably as what
they are named for at 2x. The cobbles in the square, the sprung boards in the
loft, the chalk mark on the stage. The cart ruts on the road land exactly where
the comment says they do and stop where the fence does, at twice the
checkerboard's amplitude.

The sprite cache is the right architecture and it is correctly implemented.
Painting once and blitting forever is what buys the detail in the house, and
`trimSprites` cannot evict the sprite `drawProp` is about to use. Two frames of
plain solids on a cold entry, and then it is done.

`close()` leaks nothing. Twenty open and close cycles moved the heap by 0.01MB
and the canvas count not at all.

The house painter is doing real work: the scrubbed rectangle around the sill
that still gets a lamp and the same rectangle one shade lighter around the one
that does not, the tally on the door post with exactly one group rubbed out,
the sagging ridge. That is the game's whole argument told in plaster, and it is
the sort of thing that is completely invisible unless you go and look, which is
why it is worth saying that it is there and it is correct.

The place data is careful. The hollow's ring genuinely is a ring: five stones,
mean centre `(7.7, 5.82)`, radii 3.12 to 4.59, and the gap centred on 91
degrees, due south, facing the road, exactly as the look says. The cairn sits
0.28 tiles off the centre.

---

## 7. Fix order

| | | invasiveness | risk |
|---|---|---|---|
| 1 | The PRNG, `Math.imul` [14] | one line | none |
| 2 | `revive()`: winded, moveTo, camera snap [N1, N2, 3] | three lines | none |
| 3 | The child's path off the well [N12] | data | none, and it fixes [N14] too |
| 4 | Facing, `(dx - dy)` [N11] | two lines | none |
| 5 | The square's tutorial guard [N4] | two lines | none |
| 6 | The hollow's frost loop bounds [15] | two lines | none |
| 7 | The prologue map fallback [28] | one function | none |
| 8 | The set-down lamp gets a position and a light [1] | one function | touches the save shape, needs a legacy fallback |
| 9 | The road and lane fences to the boundary [N30] | data | none |
| 10 | Drop "go to " from the exit label [9] | one line | none |
| 11 | The roof cutaway, `paintedBox` + `coversSomeone` [25, 17] | one function, two edits, both together | changes what fades everywhere. Capture before and after in the chandler, Bern's house and the stage |
| 12 | Split the interior walls, drop the east one [N28, N33] | data | recomposes both rooms, so look at them after |
| 13 | The house roof flip [N16] | one function | half the houses change appearance |
| 14 | Bake the vignette [24] | one function | 2.6MB each, free in `close()` |
| 15 | The map's `dir` override [27] | one line plus data | check the derived layout after |
| 16 | The a3sq seats [N27] | data | none |
| 17 | Cart wheels, hearth fire, the sill look, the subtitle [N18, N19, N32, N34] | one each | none |
| 18 | The half-tile actor offset [19, 20] | about 14 call sites plus `PAINT.fence` | the largest change here. It shifts every actor, the camera target and the cutaway test at once, and several burial findings above are downstream of it. Decide on it before fixing those individually |
| 19 | The audit checks from the risk list | `audit-geometry.js` only | none, and it is where the next one gets caught |

Everything in sections 2 to 5 has a worked repro in `.claude/ninth-night/qc-2026-08-12/`. The
capture harness is `.claude/ninth-night/tools/canvas.html`; it hosts the game
at exactly 1120x580 with zoom and pan, and `hw=x,y` aims the zoom at a world
tile, which is the only sane way to point at a prop once there is a camera.
