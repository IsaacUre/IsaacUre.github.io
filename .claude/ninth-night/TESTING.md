# How to actually test this game

Everything here was learned by getting it wrong first. The failures were
not subtle: one of them shipped a build where pressing E did nothing at
all, in a PR whose entire subject was things you press E on.

## The one rule

**Drive the game the way a player does, or you are not testing it.**

`window.__ninth` exists so you can script the game. It is also the
easiest way to prove something works when it does not. `__ninth.interact()`
calls `doInteract()` directly. Pressing `e` goes through the keydown
chain, which is where the bug was. The dev handle told me the world layer
worked. It was unreachable.

So: for anything a player triggers with an input, dispatch the real
event.

```js
var root = document.querySelector('.nn'); root.focus();
function key(k) {
  root.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
  root.dispatchEvent(new KeyboardEvent('keyup',   { key: k, bubbles: true }));
}
```

For movement, hold keys and step frames, rather than assigning `RT.px`:

```js
RT.keys = { s: 1, a: 1 };   // s+a is due south in iso; w+d is due north
for (var i = 0; i < 90; i++) __ninth.tick(1);
RT.keys = {};
```

Teleporting the player skips collision, skips exit bands, and skips
`unstick`. Three separate bugs hid behind teleporting.

## The dev handle

Installed only when the URL has `dev=`. Rebuilt on every `init`, so it
comes back after close and reopen.

| call | does |
|---|---|
| `__ninth.tick(n, dt)` | step and draw n frames |
| `__ninth.state()` | compact snapshot: place, hp, breath, foes, stacks, prompt, dialog |
| `__ninth.S()` / `__ninth.RT()` | the live save and runtime |
| `__ninth.place(id)` | jump to a place, fresh |
| `__ninth.talk(id)` | open an NPC's dialogue from anywhere |
| `__ninth.interact()` | resolve the nearest prompt and act on it |
| `__ninth.call()` / `.answer()` / `.stanza(n)` | the verbs |
| `__ninth.aim(x, y)` / `.aimFoe(i)` | point at a world position or a foe |
| `__ninth.spawn(kind, x, y)` | spawn a foe |
| `__ninth.slot(call, answer)` | set the two words |
| `__ninth.frag(n)` | grant a fragment |

## Screenshots

rAF is frozen in the Browser pane and in headless. The pane's own
screenshot action hangs on this canvas. The path that works is headless
Chrome writing a PNG to disk, with `devDemo` stepping the frames by
hand:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1440,900 --virtual-time-budget=9000 \
  --screenshot="C:/absolute/path/out.png" \
  "http://localhost:8492/comp/?dev=ninth&nwipe=1&ndev=square&nfr=240&nat=8,8"
```

Then read the PNG. Reading screenshots is a bug finding tool, not a
formality: two bugs in the world layer were found purely by looking at
one.

**Whatever reads the PNG back downscales it to about 280 pixels wide.**
A 1120x580 canvas seen at 280 is quarter scale, and at quarter scale a
rhyme pip is two pixels of mud and a frost crust is nothing at all. A
crop wider than 280 is a crop you cannot actually see. Crop tight and
crop at 1:1.

## The three harnesses under `tools/`

The shell draws the game into a window about 700px wide, so a shot of
`/comp/` is the canvas at a third of its own resolution inside a picture
of Windows. These host the same game at native size instead. All three
call the same `window.NINTH.render/init`, so anything that works in them
works in the shell.

| file | for |
|---|---|
| `canvas.html` | a region of the canvas at 1:1, with a zoom |
| `vfx-lab.html` | one combat scenario, set up and stepped to a chosen frame |
| `playtest.html` | the whole verb set driven by real key events, pass or fail as text |

`vfx-lab.html` takes `?scene=rhyme|call|status|slant|sour|reprise|stanza`
plus `f=` the sound, `n=` stacks, `foes=`, `kind=`, `tank=` a hp
multiplier so a detonation does not kill what you came to photograph,
`warm=` frames before and `at=` frames after. `shot.py` drives it:

```bash
python .claude/ninth-night/tools/shot.py <name> "scene=rhyme&f=ill&n=6&foes=4" ring
```

The last argument is a crop preset (`ring`, `pips`, `slam`, `hud`, and
others) or `x,y,w,h`, all of them 280 wide for the reason above.

`playtest.html` is the one that matters, and it is the answer to the one
rule. It dispatches real `KeyboardEvent`s and real `PointerEvent`s at the
real root and asserts on the state that results, traps `window.onerror`
and counts `console.error`, and prints PASS or FAIL lines that headless
can read:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new \
  --disable-gpu --no-sandbox --virtual-time-budget=45000 --dump-dom \
  "http://localhost:8677/.claude/ninth-night/tools/playtest.html?dev=ninth"
```

Four things it knows that cost an hour each to learn. The canvas must be
on screen at native size or `getBoundingClientRect` is empty, the pointer
maps to `NaN`, and every Call flies off along `atan2(NaN, NaN)` and
silently hits nothing. The sour bill is coalesced over 0.05s, so three
frames after a lapse reads as no damage. The town is shut out of every
board by `heldOpen` unless the act is holding on the last cue, so the
twenty five body case measures an empty room and reports a pass. And a
thrash pass that mashes every key leaves a panel and the map open, and
every verb in the game correctly refuses while they are.

`devDemo` params, in the order it applies them:

| param | does |
|---|---|
| `nwipe=1` | wipe the save and rebuild it |
| `nfrag=N` | grant fragments 1..N |
| `ndev=<place>` | which place |
| `nat=x,y` | drop the player here |
| `nfoes=N` | spawn N foes around the player |
| `nfr=N` | step N frames (each one steps **and draws**) |
| `ndlg=<npc>` | open an NPC's dialogue |
| `nmap=1` | open the map |
| `npanel=<name>` | open a panel |

Anything you build must be reachable through this harness before you
call it done. Sim affecting params go before the frame loop, frame only
params after it.

**`nfr` must step and draw.** Several renderers decrement their own
timers inside `draw`, so if you step 200 frames and draw once, every
typewriter is still on its first character. That produced a bug report
about truncated place titles that was entirely the harness's fault.

## The dev server and its cache

`.claude/launch.json` at `C:\Users\isaac\.claude\launch.json` has an
entry per clone. Start it with the preview tool, never with Bash.

The browser will serve you a **stale `ninth.js`** after you edit it. A
plain navigate is not enough. Navigate with `force: true`, or you will
spend twenty minutes debugging code that is not running. If a fix
appears to have no effect, check this first:

```js
fetch('/comp/ninth.js', {cache:'reload'}).then(r=>r.text())
  .then(t => 'served has my change: ' + t.includes('mySymbol'))
```

## The geometry audit

If you touched `PLACES`, run it:

```bash
node .claude/ninth-night/tools/audit-geometry.js
```

It re-derives every exit band against every prop footprint at the real
player radius and reports: exits with no standable point, exits mostly
buried, NPCs and examinables you cannot reach, arrivals that land inside
a wall, props outside their place, places missing from the map, and NPCs
defined but placed nowhere.

Every one of those categories has been a real shipped bug. The mark's
only exit was once entirely inside its own fence: a one way trap that
survived a reload, and it looked completely fine in a screenshot.

## Adversarial review

For anything substantial, run a review workflow before the PR: several
independent lenses over the diff, then two skeptics per finding, both
prompted to refute, and only findings that survive both get fixed.

Two things learned the hard way:

- `parallel()` takes thunks, not promises. `() => agent(...)`, not
  `agent(...)`. Getting this wrong silently drops every finding and the
  workflow reports a clean bill of health.
- A finding you cannot reproduce is not confirmed. Re-derive it
  yourself. Roughly a third of what comes back is a misreading of the
  projection maths or a guard that exists somewhere else. But of the
  findings that survived on this codebase, essentially all were real,
  including four regressions introduced by the previous round of fixes.

**Re-verify against each finding's own repro after fixing.** And re-run
the whole acceptance list after rebasing, because the last round of
fixes introduced a softlock that only appeared once two changes met.

## Acceptance floor for any job

Before you open the PR:

- `node --check comp/ninth.js` passes.
- A save wipe to your new content, played through with real key events,
  works.
- Nothing in the existing critical path broke: prologue to square, talk
  to Bern, out to the lane, rehearse at the mill, up the ladder, kill
  the Chorus, Fragment I lands, east to Grelling and the mark, Fragments
  II and III land.
- Close the window and reopen it. The game comes back and the save is
  intact.
- Thrash it: 50 rounds of place changes with projectiles in flight and
  every key mashed, zero console errors.
- Screenshots of anything visual.

## The harnesses in `.claude/comp-tools`

`serve.js` is the static server the preview tool starts (`.claude/launch.json`,
port 8571). Everything below is served from it.

| file | does |
|---|---|
| `win-shot.html` | frames one app window, or any element inside it, at 0,0 so a headless `--screenshot` at that size crops to it with no image processing. `?app=ninth&sel=.nn-wings-book&key=Escape&settle=800&q=<game query>` |
| `wings-checks.html` | acceptance suite for the Escape menu |
| `wings-regress.html` | the critical path, the thrash, and close-and-reopen |

Read the result out of the headline rather than a screenshot:

```bash
chrome --headless=new --disable-gpu --no-sandbox --virtual-time-budget=30000 \
  --dump-dom "http://localhost:8571/.claude/comp-tools/wings-checks.html" \
  | grep -o '<h1 id="h">[^<]*</h1>'
```

Four things these cost a morning to learn, all of them the harness lying
rather than the game being broken:

- **Send keys from the harness, after a settle, not through `nkey`.** `devDemo`
  runs inside `init()`, and beats it started are still in `setTimeout`. They
  land after `nkey` and call `gotoPlace`, which clears the foes you spawned
  and closes anything you just opened.
- **`nwipe=1` re-runs on every `init`.** Reopening the window wipes the save
  again on the way in, so "your settings survived the close" reads a fresh
  default and blames the game. Wipe from the harness instead.
- **The document timeline is frozen here exactly as rAF is.** Anything whose
  visibility depends on a CSS animation completing photographs part way or
  not at all. Capture with `--force-prefers-reduced-motion`, and prefer
  entrances that animate transform, which cannot cost visibility when they
  stall.
- **Dispatch `repeat: true` as well.** A held key is not a second press, and
  nothing that only ever sends `repeat: false` can see the difference. One
  held Enter used to wipe the save through a two-press confirm.
