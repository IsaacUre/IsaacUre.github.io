# Working in parallel on one 2760 line file

Five jobs, five branches, one file. This is how that survives.

Most of it comes down to one idea: **append at a known point, never
reorder, and never reopen a block somebody else also has to edit.**

Line numbers in these docs will drift the moment anyone merges. Grep for
the symbol, not the line.

## Who owns what

Ownership means: you may restructure it. Everyone else may only append
to it by the conventions below.

| job | owns |
|---|---|
| 1 story | `BALLAD`, `ACH`, `grantFragment`, the VERSE banner and `doVerse`, `fillBook`, `SCRIPTS`, `checkRealisation` / `landRealisation` / `checkMark` / `checkSill`, `beat`, the stanza *text*, new places with an `a3` id prefix |
| 2 audio | `sfx()` entirely, `RT.ac`, `S.opts.sound`, and **`comp/comp.js` and `comp/index.html` as sole owner** |
| 3 world | `buildFloor` and `FLOORS`, `PLACES` (shape and existing entries), `NPCS`, `blocked` / `moveActor` / `exitAt` / `stepTravel` / `unstick` / `gotoPlace`, the dialogue functions, `interactables` / `doInteract`, every `draw*` for props, npcs, looks, exits, prompts, `MAP_POS` / `drawMap`, `devDemo`, `isoX` / `isoY` |
| 4 combat | `TUNE`, `FOES`, `stats()`, the whole CALL AND ANSWER banner, `STANZAS` mechanics (not their text), `spawnFoe` / `stepFoes` / `stepChorus` / `foeDie`, every `drawFoe*`, `drawBossBar`, the arena and quiet halves of `stepScene` |
| 5 items | `CHARMS`, `charmSum`, `coin` / `buyCharm` / `sellCharm` / `wearCharm` / `learnWord`, `panel()`, `fillKit`, `fillShop`, the coin HUD |

## The shared structures, and the rule for each

**`RT` init literal.** Add exactly one line: a named sub-object, right
before the closing `};`. Fixed order so two branches never pick the same
line: `audio`, `combat`, `items`, `story`, `world`.

```js
    story: { act: 0, sung: null },
};
```

Do not edit any existing line in that literal. Do not add a stray field
outside it (there are already seven of those and they are why nobody can
tell what RT contains).

**`sLoad` defaults.** One line each, same fixed order, between the
`S.tune` line and `return S;`:

```js
    S.story = S.story || {};
```

Do not add save fields lazily at the use site. Two already do that and
they are the reason there is no single place to read the save schema.

**`sLoad` runs once per page, not once per window.** It opens with
`if (S) return;` and `close()` never nulls `S`. Closing and reopening
the window will *not* pick up your new defaults. Test save changes with
a full page reload, or the KIT tab's "Wipe save" button, which is the
only path that nulls `S`.

**Resets on travel.** Do not edit `gotoPlace`'s reset block. Register
next to your own code:

```js
onPlaceChange(function () { RT.story.act = 0; });
```

**Keybinds.** Do not reopen the keydown chain. Register:

```js
bindKey('j', function () { ... });
```

The built-in chain wins on conflict. `e` must stay first in it: that
ordering is a fix for a shipped bug where `e` was bound to Stanza II and
the entire world interaction layer was unreachable from the keyboard.
`w`/`a`/`s`/`d` must keep falling through to `else return` so movement
never calls `preventDefault`.

Free single letters, roughly: `g h j k l n o p x y z`. `i` reads as
inventory and belongs to job 5. Alt, Ctrl and Meta combinations return
early and are not available.

**`sfx()` belongs to job 2 alone.** Everyone else calls
`sfx('whatever')` freely. An unknown kind falls off the end of the chain
and does nothing: no throw, no console noise. **List the sound names you
invented in your PR body** so job 2 can fill them in. This one rule
turns the worst five way conflict in the file into zero conflicts.

**`ach()`.** Never call it with an id you have not added to `ACH` in the
same commit. It now refuses unknown ids with a console warning rather
than silently burning the save flag, but a refused achievement is still
an achievement nobody gets.

**`comp/comp.js` and `comp/index.html` have one owner: job 2.** Job 2
has a mandatory change there (`onMinimize` / `onRestore` on `APPS.ninth`,
without which looping audio keeps playing behind a minimized window).
Everything else reaches the desktop through the four keys on
`window.NINTH` and needs no edit there at all. If you genuinely need
one, hand it to job 2 rather than opening the file.

**`comp/comp.css` is append only, at EOF.** One
`/* NINTH NIGHT: <your area> */` block after the last line. Do not edit
anything inside the existing `.nn-*` block, including its `@media`
query: put responsive rules in your own `@media` inside your own block.
All three files are CRLF with a trailing newline, so EOF appends are
"both sides keep" in a merge.

**`PLACES`.** Append before the closing brace, never reorder. Job 1's
Act 3 places take an `a3` id prefix. **Every new place also needs a
`MAP_POS` row** or it, and every road leading to it, vanish from the map
with no warning. Cap `w` and `h` at 17 until job 3 lands a camera.

**The DEV menu.** At most one new tab, and job 1 gets it (a STORY tab).
The panel is 560px with no wrap: seven tabs fit, twelve do not.
Everyone else appends rows at the tail of the tab that already matches
them. Copy rows you want rather than moving anyone else's.

**`draw()` has exactly two seams and they are not interchangeable.**
World space goes between `drawParts` and `drawTypo`, inside the shake
transform. Screen space goes after `drawMap`, outside it. One call per
job. New world entities push `{ k: x + y, fn: ... }` into the `ents`
array: that is the only z sort in the game.

**`TUNE`.** One tunable is two edits in the same commit: the default in
`TUNE` and a `num` row in the DEV FEEL tab. A number with no FEEL row
cannot be moved in play, which is already true of four of them.

## Merge protocol

1. Branch from current `main`. Do not start from another job's branch.
2. Rebase onto `main` before opening the PR. Do not merge `main` in:
   squashing a merge commit in a single file game is where lines get
   silently lost.
3. After rebasing, re-read the four shared regions **in the merged
   file**, not in your diff, and confirm every job's line is still
   there: the `RT` literal, `sLoad`, the keydown chain, the `step()`
   call list.
4. `node --check comp/ninth.js` before every commit. It is the only
   build check that exists.
5. Run `node .claude/ninth-night/tools/audit-geometry.js` if you touched
   `PLACES` at all. It catches unreachable exits, buried NPCs, arrivals
   inside walls, and places missing from the map.
6. Re-run your own acceptance checks after the rebase, not before.

## Known cross cutting traps

These have all bitten already. They are not hypothetical.

- **rAF never runs in the Browser pane or in headless capture on this
  project.** Screenshots come from headless Chrome plus the `devDemo`
  harness stepping frames by hand. See `TESTING.md`.
- **`gotoPlace` fully heals the player and refills Breath on every
  transition.** Walking to the lane and back is a free full heal. Any
  attrition design has to deal with that line first.
- **`breakStack` subtracts HP directly**, bypassing i-frames and
  `hurtPlayer`. Several stacks expiring on one frame stack fully.
  Anything that raises stack counts or shortens stack life multiplies
  unavoidable chip damage.
- **The Droner damages the player just by existing**, through the above.
  Roughly 3 HP/sec of untelegraphed chip after the first few seconds,
  more than its actual bite. Decide whether that is intended before
  tuning anything near it.
- **`f.def.boss` is used as a synonym for "is the Chorus"** in eight
  places. A second boss added to `FOES` without touching them will
  think, look and die like the Chorus.
- **`FLOORS` is an unbounded cache** of full size canvases keyed by
  kind plus dimensions, about 2.6 MB each, and `close()` never frees it.
  Eight entries exist. Reuse an existing floor kind where you can.
- **`stats()` and `charmSum()` allocate on every call** and are invoked
  inside per hit and per foe loops. Fine at current scale, not at ten
  times it.
- **`panel()` pauses nothing.** The shop is bound to `v` globally and
  enemies keep attacking while it is open.
- Three place fields look meaningful and are read nowhere: `arena`,
  `calm` (writes a field only the dev harness reads), and `boss`.
