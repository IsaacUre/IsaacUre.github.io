# Job 3: The road north

Branch `claude/ninth-world`. Read `README.md` and `PARALLEL.md` first.

Start this one first if you only start one. The camera is what every
other job is quietly designing around.

## The problem

**There is no camera.** `isoX` and `isoY` have a fixed origin and
`buildFloor` bakes a single 1120x580 bitmap drawn at (0,0). At 17x17
tiles the far corner is at y=577 of a 580px canvas. So every place in
the game is one static screen, and 17x17 is a hard ceiling, and the
whole world is seven rooms you see all of at once.

The brief was "you explore new towns and places". You cannot explore a
room you can already see all of.

Under that, the world is thinner than it looks:

- **Nine of the fourteen prop types are literally coloured boxes.** Only
  house, tree, well, markstone and stagewip have bespoke art. And one
  prop type actually used in the lane, `stone`, is unknown to the
  renderer entirely: it matches neither the height ternary nor the
  palette, so it draws as a generic brown box.
- **Props are excluded from the painter sort**, so NPCs and enemies
  render straight through buildings.
- **No lighting, no time of day, no weather, no interior.** In a game
  named after a night when every house sets a lamp on the sill.
- **NPCs are static furniture.** No movement, no idle, no reaction.
- **Dialogue is a flat array.** No choices, no conditions within a run,
  no re-entry state except hand rolled `S.seen` flags.
- **No place has a reason to exist** except as a corridor between story
  beats. Two of the seven generate encounters and both use the same
  hardcoded two enemy table.
- `MAP_POS` is a hand maintained parallel table that silently drops any
  place you forget to add.

## What to build

**The camera, first.** Everything else in this job and in job 1 is
sized by it. It changes `isoX`/`isoY`, `buildFloor`, and every screen to
world conversion including the mouse. Do it before you build content on
top of the old assumption.

Decide the feel deliberately: hard follow, or a dead zone the player
moves inside before it pans, or per place (a small room stays static,
the road scrolls). A dead zone is usually right for this kind of game
and it keeps the small rooms feeling composed the way they do now.

Watch out: `buildFloor` caches a full size canvas per (kind, width,
height) at about 2.6 MB each and `close()` never frees it. With a camera
and bigger places that cache becomes the memory story of the game.
Either tile the floor, or bound the cache, or free it on close.

**Then the road north.** The ballad says she walked out past the mill,
the well, the mark, to the hollow at the world's north end. Right now
that is four hundred yards and you can see both ends of it. With a
camera it can be a road.

Where the fiction wants you to go:

- **Wick, properly.** Interiors: Bern's house, the chandler's shop (job
  5 needs it to exist as a place), the hall where the play is performed.
- **The road north past the mark**, and the hollow at the end of it. The
  hollow is where the truth physically is. It is the one place in the
  game that should feel wrong.
- **Reasons to be in a place.** Something to find, someone to overhear,
  a view, a thing that is different at night.

**Lighting and the ninth night.** Every house sets a lamp on the sill.
That is the title of the game and it is currently a static yellow
rectangle. A simple additive light pass with a warm falloff around lamps
and the player's lantern would carry more atmosphere than any amount of
new geometry.

**Props that are not boxes.** Nine types need art. And put props in the
painter sort so people stop walking through walls visually.

**NPCs that are alive.** Idle animation, a walk cycle, somewhere to be.
The child skipping is described in her own dialogue and does not move.

**Dialogue with choices**, and conditions that read story state, so job
1 has something to write an ending conversation in.

## Things you should know before you start

**Run the geometry audit constantly.** `node .claude/ninth-night/tools/audit-geometry.js`.
Every category it checks has been a real shipped bug. The mark's only
exit was once entirely inside its own fence, which made it a one way
trap that survived a reload, and it looked completely fine in a
screenshot. Add checks to the tool as you add world features.

**Every new place needs a `MAP_POS` row.** Without one the place and
every road to it vanish from the map, silently. Better: derive the map
from the exit graph so this class of bug stops existing.

**`floor: 'mill'` does not hit a mill palette.** `buildFloor` branches
on stage, town, loft and a default. Three of eight places fall into the
default and nobody noticed.

**Three place fields look meaningful and are read nowhere:** `arena`,
`boss` (the loft's Chorus is actually spawned by its script), and `calm`
(it writes a field only the dev harness reads). Delete or implement, but
do not model new work on them.

**`gotoPlace` fully heals the player and refills Breath on every
transition.** Walking next door and back is a free full heal. If you
want the road north to have any attrition, that line is the first
problem.

**Fragment checks are duplicated** in `advanceDialog` and `closeDialog`,
and the two are not identical. Escape and "press E past the last line"
take different paths that both have to call the same checks. Unify them
before job 1 adds a fourth check, or it will fire for only half of
players.

**`S.looked` keys are place plus array index**, so reordering a place's
`looks` corrupts which ones the player has read. Key them by name.

**Exit gating understands exactly one predicate**, "is this `S.seen` key
truthy". Job 1 will want richer conditions.

## Done looks like

- A camera, and at least one place that is meaningfully bigger than one
  screen, and it feels good to walk through.
- The floor cache is bounded or freed.
- The road north exists and the hollow is at the end of it.
- At least one interior.
- Lamps light the square on the ninth night.
- No prop is an untextured box, and nothing renders through a building.
- People move.
- Dialogue supports choices and conditions.
- The geometry audit is clean and has new checks in it.
- The map is derived from the world, not hand maintained.
- Screenshots of every new place, plus a before and after of the camera.

## Worth reading in the file

`isoX` / `isoY`, `buildFloor` and `FLOORS`, `PLACES` (every field, and
which places use which), `NPCS`, `gotoPlace` / `stepTravel` / `exitAt` /
`unstick` / `blocked` / `moveActor`, `interactables` / `nearestInteract`
/ `doInteract`, the four dialogue functions, `drawProp` and every branch
in it, `drawMap` / `MAP_POS`, `devDemo`.
