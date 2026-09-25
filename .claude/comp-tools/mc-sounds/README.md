# mc-sounds: the Minecraft build's audio

The game at `/tcomp/` (`tcomp/minecraft.js`) plays Minecraft's own sounds and C418's
soundtrack, from `tcomp/mc-sounds/`. Nothing in it is synthesized any more. This folder
builds those files and checks them.

## Where they come from

A fan-kept archive of every sound file in Minecraft Java and Bedrock: the "Minecraft Audio
Files" Google Drive folder and the documentation spreadsheet that indexes it, downloaded on
2026-09-24 and checked for malware before use (Defender, plus a byte-level audit of every
zip and WAV). It is 5 GB, so it lives outside the repo, on Isaac's PC at

    C:\Users\isaac\code\site-assets\Minecraft sounds\

(`MC_SOUND_LIB` overrides it). Its folders mirror the game's own `assets/minecraft/sounds/`
tree (`dig/`, `step/`, `mob/`, `music/`, ...) as 16-bit WAV, and the spreadsheet beside them
lists each file's sound event, volume and pitch as the game's `sounds.json` has them. These
are Mojang's and C418's recordings, published on a public repo and site: keep that in mind
before adding more.

## What ships

- `tcomp/mc-sounds/<java path>.m4a`: 378 effects (7.3 MB) and 25 music tracks (76 MB),
  AAC-LC at 96 kbps, the floor of the Windows encoder. AAC in MP4 because it is the one
  compressed format every browser decodes, Safari included.
- `manifest.json`: every effect's true length, the pad in front of it, the calibration time.
- `cal.m4a`: the calibration pulse (below).

Effects are encoded with 64 ms of silence in front. The Windows encoder softens the first
~20 ms of a file, which ate the attack of any effect that starts at once, and browsers need
not agree on where an AAC stream with no edit list begins. `cal.m4a` is the same pad and a
pulse at 74 ms; the game decodes it once, sees where this browser put the pulse, and trims
every effect by exactly that much. Music streams through an `<audio>` element instead of
being decoded, and has its `moov` box moved to the front so a stream starts without first
fetching the end of the file.

## Adding or replacing a sound

1. Add the path to `SFX` (or `MUSIC`) in `build.py`, and to whichever table in
   `minecraft.js` plays it: `MAT` (block SoundTypes), `MOBSND` (mob voices), `SFX` (one-shot
   events, `snd(name, arg, x, y, z)`), `SVOL` (a per-sample volume from sounds.json) or
   `MUSIC`.
2. `python .claude/comp-tools/mc-sounds/build.py <path prefix>` (Windows; Media Foundation's
   AAC encoder through `mf_encode.ps1`, nothing to install). With no arguments it rebuilds
   everything in about a minute and a half. Encodes are not byte-identical run to run (the
   MP4 header carries timestamps), so rebuild only what changed.
3. `python .claude/comp-tools/mc-sounds/check.py paths` confirms the game and the folder
   agree; run the other passes too.

## Checking

    node .claude/comp-tools/serve.js . 8571 &
    python .claude/comp-tools/mc-sounds/check.py

Headless Edge over the DevTools protocol (`cdp.py`, stdlib Python, no Playwright), audio muted
but metered. Passes: `paths`, `title` (the shipped route with no dev handle), `events` (every
one-shot, mob voice and SoundType × use, real footsteps, music picks), `world` (rain, going
under water, mobs left alone, closing the window) and `desktop` (the `/tcomp/` icon, PLAY, one
click). The in-game QC handles it leans on: `__mc._sndlog(true)` logs every sample that starts
with its gain, pitch and bus; `__mc._sounds()` reports the loader and the soundtrack;
`__mc._sndPaths()` lists every path the game can ask for.
