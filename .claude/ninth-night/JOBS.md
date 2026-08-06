# NINTH NIGHT: the five jobs

Say **"do ninth night job N"** and the chat picks up that file.

Read first, in this order: `README.md` (what the game is),
`PARALLEL.md` (what you own and what you must not touch), then your job
file. `TESTING.md` when you get to verifying.

| # | job | one line | branch |
|---|---|---|---|
| 1 | [The ninth night](job-1-the-ninth-night.md) | The game has no ending. Build it. | `claude/ninth-ending` |
| 2 | [The sound of it](job-2-the-sound-of-it.md) | A game about rhyme that nobody has scored. | `claude/ninth-audio` |
| 3 | [The road north](job-3-the-road-north.md) | Seven single screens and no camera. | `claude/ninth-world` |
| 4 | [What you fight](job-4-what-you-fight.md) | One AI, and half the bestiary never appears. | `claude/ninth-combat` |
| 5 | [What you carry](job-5-what-you-carry.md) | No inventory, and the shop is cosmetic. | `claude/ninth-items` |

## Can they really run at once

Yes, with two caveats worth knowing before you start five chats.

**Job 3 should start first if you only start one.** It owns the camera,
and the camera is what lifts the 17x17 ceiling that every other job is
quietly designing around. Nothing is blocked on it, but job 1's Act 3
places and job 4's arena will both be built small if it is not there.

**Job 1 wants a second boss from job 4.** Job 1 can build the whole
ending against the Chorus and swap later, or job 4 can land its boss
hooks early. Either works. If you are running both, tell job 1 to write
the confrontation against a named callback rather than against
`f.def.boss`, which is currently used as a synonym for "is the Chorus"
in eight places.

Everything else is genuinely independent. The seams that made that true
are already on `main`: `onPlaceChange`, `bindKey`, and the rule that
`sfx()` belongs to job 2 and silently ignores names it does not know, so
everyone else invents sound names freely and job 2 fills them in later.

## What every job owes

- One PR, squash merged, rebased onto `main` rather than merging `main`
  in.
- `node --check comp/ninth.js` clean, `node .claude/ninth-night/tools/audit-geometry.js`
  clean if you touched `PLACES`.
- The full critical path still playable: prologue, Bern, the lane, the
  mill, the loft, the Chorus, all three fragments. That is the
  regression suite. It is also about four minutes of play.
- An adversarial review pass before the PR. On this codebase it has
  found a dead interact key, a one way trap, a permanent softlock, and
  four regressions introduced by the previous round of fixes. It earns
  its cost every time.
- Any sound names you invented, listed in the PR body, for job 2.
- Any new content reachable through the `devDemo` capture harness.

## Not in scope, deliberately

Kept out so the five stay independent and roughly equal in size. Good
candidates for a job 6 onward:

- **Options and accessibility.** There is no player facing settings
  panel at all. Sound is a dev toggle. No colourblind consideration in a
  game that encodes five mechanics as five colours. No rebinding.
- **Onboarding.** Nothing teaches Call and Answer except one `say()`
  line. The slant and sour mechanics are never explained.
- **Save slots and new game plus.** One save, one key, no way to replay
  the reveal.
- **Performance.** `stats()` and `charmSum()` allocate inside per foe
  loops, and `FLOORS` never frees.
