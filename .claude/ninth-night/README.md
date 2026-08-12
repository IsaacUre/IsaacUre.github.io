# NINTH NIGHT

Read this before doing any job. It is the context every job assumes.

Live at `/comp/` on isaacure.com: open the fake Windows desktop, then the
NINTH NIGHT shortcut (or Steam, or the Start menu). `?dev=ninth` opens it
straight away and installs the `window.__ninth` dev handle.

## The fiction

Every year the town of Wick performs a play about the man who saved them
from the long winter. The ninth year of the thin sun, nothing left to
eat, and one person stood up in the empty square, asked for a single
coal, and walked out north alone. He came back at dawn with the coal
burnt out in his hand and the sun came up.

You have just been cast as him.

The play is a lie in three places. It was a woman. She asked and nobody
answered. She walked out and did not come back, and the man who did come
back never went past the fence, and his coal was still whole. Four
hundred years ago the town cut her out of the song and nailed a false
line over the hole, and used the same false line twice because it was
cheaper than writing two.

You can hear the join, because the false lines do not rhyme.

Every closing line in the ballad runs six to eight syllables. "And he
went alone" is five. That is the whole game in one observation.

## What the player does

Learning your lines teaches you magic, because a spell is a line of
verse and rhyme is how the world checks whether something is true.

**CALL** (left mouse) is cheap, fast, and leaves a rhyme stack on what
it hits. **ANSWER** (right mouse) is expensive and detonates every stack
on screen that matches its sound. That is the entire combat verb set.
Everything else hangs off it.

Words belong to five rhyme families and each family has a nature:

| family | element | does |
|---|---|---|
| `-eat` | hunger | burn, drain |
| `-ight` | reveal | strip armour, true damage |
| `-erd` | command | silence, counter |
| `-ark` | shadow | damage over time, conceal |
| `-ill` | still | stun, freeze, execute |

You slot one word to Call and one to Answer. Matching families close the
couplet. Mismatched is a **slant**: it works, it just falls flat (half
damage). A stack that expires before you answer it goes **sour** and
hurts you.

**Breath** is the resource. It refills faster the longer you say
nothing, which means the game asks you to shut up periodically. Run it
to zero and you are **WINDED** and cannot speak at all.

Your starting kit is the town's version of the ballad. Every spell you
begin the game with is a lie you can cast. Nobody says this out loud.

## What is built right now

Roughly 8280 lines in `comp/ninth.js`, one IIFE, vanilla ES5-style, no
build step, no modules, no dependencies.

- **Combat**: Call/Answer, five families, rhyme stacks, slant, sour,
  Breath with a silence ramp and WINDED, Echo (a meter that fills and is
  read by nothing), three Stanzas on 1/2/3 that dilate time and recite
  four lines, Verse on R (written, spectacular, and permanently locked).
- **World**: seven walkable places plus a dev arena. Wick's square, the
  lane, the mill, the grain loft, Grelling, the mark, and the prologue
  stage. Solid props, walk-through exits, a map on M, six NPCs you talk
  to with E, examinables, dialogue.
- **Story**: three fragments, each recovered by understanding rather
  than by killing anything. Each is two facts you were told separately
  that mean nothing apart. The Chorus is the only boss.
- **Economy**: coin, seven charms (wear two), a word shop.
- **Enemies**: six archetypes, three of which never appear in the game.
- **Dev menu** on backtick: WORLD, PEOPLE, SPAWN, FEEL, KIT, CHEAT,
  DEBUG. Jump anywhere, hear anybody, spawn anything, tune every number
  live.
- **Achievements** wired into the fake Steam client.

## What is not built

That is what the five jobs are. See `JOBS.md`.

The single most important gap: **the game has no ending.** After the
third fragment the world is byte for byte what it was before, plus 12
max Breath. There is no performance of the play, no confrontation, no
credits. The R key that would carry it has exactly one writer in the
whole file and it is a dev-menu toggle.

## Architecture, briefly

`comp/ninth.js` exports `window.NINTH = { render, init, close, steamAch }`
and nothing else. The desktop shell in `comp/comp.js` owns the app
registry, the Steam catalogue, the filesystem and the icons. Styles are
the `.nn-*` block at the end of `comp/comp.css`. The SVG icon symbol and
the script tag are in `comp/index.html`.

Inside `ninth.js`:

- `S` is the save (localStorage key `comp_ninth`), built by `sLoad()`.
- `RT` is the runtime, rebuilt by `init()` and destroyed by `close()`.
  Anything that must survive a window close lives on `S`.
- `frame()` computes real elapsed time and calls `step(dt, real)` then
  `draw(real)`. During a stanza recital the sim clock runs at 30%, so
  **know which clock you are on**: sim `dt` for game logic, `real` for
  anything that must not slow down, `ac.currentTime` for audio.
- Rendering is isometric, painter sorted, onto one 1120x580 canvas.
  **There is a camera now.** `isoXB`/`isoYB` are the fixed projection;
  `isoX`/`isoY` are that minus wherever the eye is looking, and they are
  what everything draws with. Anything converting the other way (the
  mouse) has to add the camera back: use `screenToWorld`. A place
  smaller than the canvas centres and never scrolls, so the small rooms
  stay composed. The road is 11x34 and does scroll. What replaces the
  old 17x17 ceiling is memory: a floor bitmap is prerendered at
  `(w+h)` tiles across, so a place that is big on both axes costs real
  megabytes. The audit checks that.
- Sections are marked with banner comments. They are the ownership
  boundaries: see `PARALLEL.md`.

## House rules

- Feature branch, PR against `main`, squash merge. Standing approval to
  auto merge is in the repo `CLAUDE.md`. Fetch and pull after.
- Never commit a test harness to the repo root. The repo is served at
  isaacure.com. This directory is a dotfolder, so it is committed but
  never published.
- No build step, ever. No external assets, no CDN, no fetch. The game is
  one script tag on a static site.
- Isaac's writing style, which applies to everything the player reads:
  **no em dashes and no en dashes**, and no AI-speak. The game's prose
  is plain, short, and slightly flat on purpose. Match it. When you are
  writing a line for a character, read it out loud first: everything in
  this game is about how a line sounds.
