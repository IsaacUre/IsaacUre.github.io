# Job 1: The ninth night

Branch `claude/ninth-ending`. Read `README.md` and `PARALLEL.md` first.

## The problem

The game has no ending.

Get all three fragments and the world is byte for byte what it was
before, plus 12 max Breath. Nothing branches on `fragCount() === 3`.
No NPC reacts to knowing. There is no performance, no confrontation, no
credits, no post-story state.

And the thing that was clearly meant to carry it is sitting there
finished and switched off. `doVerse` is a genuinely spectacular seven
stanza recital: 28 lines of the corrected ballad, 260ms apart, dilated
time, monochrome, and on every fourth line it deals 999 closed `-ight`
damage to everything alive. It runs today. It is gated behind `S.verse`,
which has exactly one writer in the entire file: a dev menu toggle. The
comment on its default says it out loud: "R stays dark for the entire
game."

Two of the seven true stanzas are also unreachable. `fillBook` only
swaps in the corrected text for stanzas 3, 4 and 7, so stanzas 5 and 6
(the hollow at the world's north end, and the man coming back down off
the fence with the coal still whole) are written, are the actual reveal,
and cannot be read anywhere in the game by any means.

## What to build

**The ninth night itself.** The play is performed. You are in it. You
know what the song actually says. What you do with that is the game's
last decision and it should be a real one.

The shape I would reach for, though you should push back if you see
better:

Wick, the square, the night of the performance. The whole town is there.
The stage that has been half built since the first time you saw it is
finished. You walk on and the play runs, and it runs on rails, and your
part comes.

Then you choose. Not from a menu: with the verb the whole game has been
teaching you. **Sing it as written**, or **sing it true**. Call and
Answer is the entire input vocabulary of the game and the ending should
use it, not a dialogue box with two options.

What that costs is the interesting part. Singing it true in front of
four hundred people is not a triumphant button. The town has been
telling this lie for four hundred years, and everybody standing in that
square learned it as children, and one of them is Bern.

The Verse is the true version cast at full volume. Unlock `S.verse` for
this and nothing earlier. The R key staying dark for the entire game is
not a bug, it is a setup, and the payoff is that it lights up once.

**What has to exist for that to work:**

- A path from three fragments to Act 3. Not automatic on the third
  fragment: give the player a beat to go and do the reading first.
  Somebody should tell you the play is tonight.
- Act 3 places, id prefixed `a3`. At minimum the square at night, full
  of people. Keep them 17x17 or smaller unless job 3's camera has
  landed.
- The performance itself, on rails, using the beat scheduler.
- The choice, expressed through Call and Answer.
- At least two endings that differ in more than a text string.
- Credits, and a return to a post-story world state so the save is not
  a dead end.
- `fillBook` showing the whole corrected ballad once you have earned it,
  including stanzas 5 and 6.

## Things you should know before you start

**`S.heard.refrain` has exactly one non-dev writer: `onChorusDown`.**
Which means Fragment I, the one the code documents as "understanding,
not looting", is in practice hard gated behind killing a boss. That
contradicts the design and it is yours to resolve. Either give the
refrain a second source (hearing the town rehearse it in the square is
right there) or accept the gate and delete the comment.

**Two clocks.** Story beats run on sim `dt`, so a stanza cast or the dev
time scale stretches every queued cinematic. `doVerse` instead uses
`setTimeout`, so it ignores dilation entirely even though the line above
sets `RT.dilate = 6`. Pick one for the ending and say which in a
comment. If job 2 is running, its scheduler declares the rule and you
match it.

**`beat()` does not tick while the player is dead**, and `gotoPlace`
wipes the whole beat queue. Any cinematic needs the belt and braces the
fragments already use: an interrupt fallback in `gotoPlace` plus an
idempotent re-check. Look at `landRealisation`. That function exists
because walking through a doorway mid-realisation used to silently eat
both the achievement and the only line that explained what you had
understood.

**`bigLine` stacks by array index**, so its vertical position re-flows
as earlier lines expire. Fine for one to three lines. A 28 line crawl
will visibly jitter. `doVerse` gets away with it because the lines are
short lived. If your ending holds more text on screen, that renderer
needs a second mode.

**`STANZAS[].bal` and `.frag` are declared and read nowhere**, and each
stanza's four lines are a hand copy of `BALLAD[bal].r` that can silently
drift out of sync. Wire them up or delete them.

**`grantFragment` fires `ach()` only for fragment 1.** There is no
achievement for II or III, for the ending, or for anything else in the
story. A real playthrough currently caps at 12 of 14 because two of the
fourteen need the dev menu. You own `ACH`: fix the coverage. Note that
`ach()` now refuses ids that are not in `ACH`, so add the entry in the
same commit as the call.

**`RT.mono` is decayed every frame and read by nothing.** `doVerse` sets
it to 6 expecting the world to desaturate. That effect does not exist.
Either build it (it would be lovely under the Verse) or stop setting it.

## Done looks like

- A new player can reach an ending. Time it: the whole game start to
  credits should be short, because Isaac asked for short and sweet.
- R lights up exactly once, at the right moment, and casting it is the
  best thing in the game.
- Both endings are reachable and the save reflects which one you got.
- The corrected ballad is readable in full in the book, all seven
  stanzas.
- Achievements cover the story, and 14 of 14 are obtainable without the
  dev menu (or the two that are not get removed).
- A new DEV **STORY** tab: jump to any act, force any ending, replay the
  performance, set fragment count. You get the one new tab. Use it well:
  the point of the dev menu is that Isaac can see any part of the story
  in two clicks.
- The whole ending is reachable through `devDemo` for screenshots.

## Worth reading in the file

`BALLAD` (both versions of all seven stanzas, and read them, they are
the game), `SCRIPTS`, `beat`, `checkRealisation` / `landRealisation` /
`checkMark` / `checkSill`, `grantFragment`, `doVerse`, `fillBook`,
`ACH`, `STANZAS`, `bigLine` / `drawLines`.
