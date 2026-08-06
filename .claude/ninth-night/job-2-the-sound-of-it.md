# Job 2: The sound of it

Branch `claude/ninth-audio`. Read `README.md` and `PARALLEL.md` first.

## The problem

This is a game about rhyme, meter, a refrain, and a crowd of voices, and
nobody has scored it.

What exists is `sfx(kind)`: one function, a flat if/else over 20
hardcoded names, each one or two oscillators or a burst of unfiltered
white noise straight into `ac.destination`. No master gain, so no volume
control. No filters, so every noise in the game is full spectrum white.
No envelopes worth the name. No ambience, so between discrete events the
game is completely silent.

Three things follow from that, and they are the job:

**The five rhyme families sound identical.** Hunger, reveal, command,
shadow and stillness are the whole mechanical vocabulary, they are
colour coded in the UI, and they all make the same noise. A player who
closed their eyes could not tell you which spell they cast.

**The Chorus does not sound like a chorus.** It is described in its own
blurb as "a crowd of voices, no bodies, saying the refrain in unison".
It is one sawtooth and one square blip.

**The ballad is never heard.** The entire game is about a song. There is
no melody in it anywhere. The Verse recites 28 lines of the corrected
ballad over 7.3 seconds and 27 of them land in silence.

## What to build

**A real synthesis layer.** Master gain bus, per category sub buses
(voice, world, ui) so you can duck one under another, filters, proper
envelopes, and a cached noise buffer instead of allocating one on every
shot.

**A voice per family.** Five families, five timbres, consistent from the
Call through the stack landing through the Answer detonation. `-ill`
should sound like the air stopping. `-ark` should sound like something
leaving the room. The player should learn them the way they learned the
colours.

**The ballad as music.** Pick a key and a mode and put the whole game in
it. The town's version and the true version should be the same tune with
the ending changed, because that is literally the plot: somebody snapped
the last line off and nailed a different one on. If a player who has
heard the refrain forty times feels the true version land differently
without being told why, that is the whole game working.

**The Chorus.** Detuned stacked voices, actual unison, the refrain
audible as a phrase rather than a blip. The pulse should have a warning
you can hear before you can see it.

**Ambience per place.** Wick has people in it. The mill is outdoors and
empty and the wheel turns. The loft is enclosed and wrong. The mark is
silent in a way that should be uncomfortable. Places are already tagged
with a `floor` kind you can key off, though a dedicated field is
cleaner.

**A volume control the player can find.** There is a Sound toggle in the
DEV menu. That is not a setting, that is a debug flag. Note the desktop
shell has an unwired taskbar volume slider: wiring the game to it would
be very much in the spirit of the thing.

## Things you should know before you start

**You cannot verify this with any automated path, and you must say so in
your PR.** `devDemo` has no user gesture, so the AudioContext is created
suspended and `sfx()` returns immediately on `state !== 'running'`.
Every sound is a silent no-op in every capture path. rAF does not run in
the Browser pane or headless either. Verify by hand, in a real browser,
after a real click.

**The entire body of `sfx()` is inside one try/catch that swallows
everything.** A bad ramp target, a null node, a typo: no sound, no
console output, no clue. **First thing to build: a dev visible error
counter inside that catch.** Otherwise you will lose hours.

**`exponentialRampToValueAtTime` throws on a target of zero and on a
starting value of zero.** The existing code dodges it by always ramping
to 0.0005. Any volume you compute from game state (stack count, boss
health, distance) can reach zero, so clamp before you ramp.

**Do not drive a scheduler from `step()`'s `dt`.** It is multiplied by
the dilation factor, so during a stanza recital the sim clock runs at
30% and your music slows to a crawl with it. Use `real`, or better,
`ac.currentTime`. You are the area that has to pick a clock anyway, so
**declare the rule for the whole file in a comment**: job 1 is writing
an ending whose pacing depends on it.

**`close()` calls `RT.ac.close()` and nulls `RT`.** Any audio state you
park at module scope rather than on `RT` survives a window close and
will reference a dead context on reopen. Everything goes on `RT.audio`.

**You own `comp/comp.js` and `comp/index.html`.** You have a mandatory
change there: `APPS.ninth` has no `onMinimize` / `onRestore`, and rAF
keeps running behind a minimized window, so the moment you ship a
looping node it will keep playing when the player minimizes the game.
`APPS.minecraft` has the precedent to copy. You are also the one who
adds SVG symbols or `comp.js` entries on behalf of any other job that
needs one: they hand it to you rather than opening the file.

**`sfx('step')` is not a footstep.** It fires only from the dash. There
is no footstep system. `RT.walking` is the flag one would key off.

**Everyone else is inventing sound names while you work.** An unknown
kind falls off the end of the chain and does nothing, so their code is
safe. Their PR bodies list the names they invented. Collect them and
fill them in.

**Silent events that should not be**, as a starting list: the sour
break, picking up coin, a fragment landing, an achievement toast,
travelling between places, an enemy spawning, the Chorus pulse warning,
getting your breath back, and every line of the Verse.

## Done looks like

- Every sound goes through a master bus and a volume control the player
  can reach without the dev menu.
- The five families are distinguishable with your eyes shut.
- The Chorus sounds like a crowd.
- Every place has ambience, and it stops when the window is minimized.
- The ballad exists as music, the town's version and the true version
  are the same tune with a different ending, and the Verse is scored.
- No sound plays after `close()`.
- The catch block reports failures somewhere visible.
- A DEV audio section: play any sound by name, solo a bus, force the
  context state.

## Worth reading in the file

`sfx()` and every one of its 20 names, every `sfx(` call site (read what
each one means dramatically, not just where it fires), `RT.ac` and its
teardown in `close()`, `S.opts.sound`, the DEBUG tab's `num` row for a
slider precedent, and `APPS.ninth` plus `APPS.minecraft` in `comp.js`.
