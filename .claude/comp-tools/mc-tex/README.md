# mc-tex: the Minecraft build's textures

The game at `/tcomp/` (`tcomp/minecraft.js`) draws with Minecraft's own block, item,
particle and interface textures, its font and its title wordmark, from `tcomp/mc-tex/`.
This folder builds those files.

## Where they come from

The client jar the official launcher downloads, `%APPDATA%\.minecraft\versions\<version>\<version>.jar`,
read the way a resource pack author reads it (a jar is a zip; the textures are under
`assets/minecraft/textures/`). The shipped files were built from **26.3** on 2026-09-25. This
is Mojang's art; `/tcomp/` is Isaac's personal test build and he asked for it there.

    python .claude/comp-tools/mc-tex/build.py [path\to\client.jar]

With no path it takes the newest release (no snapshots) under `%APPDATA%\.minecraft\versions`.
Standard library only: `pngio.py` beside it reads every PNG the jar holds and writes RGBA ones.
It runs in a few seconds and prints anything it looked for and could not find.

## What ships

- `tiles.png`: 16x16 cells, 16 to a row: blocks (crops included), items, spawn eggs, the bow's
  pulling frames, the ten destroy stages, fire, the XP orb's first four sizes, the smoke puff and
  the heart particle.
- `sky.png`: the sun and the eight moon phases at their own 32x32, in MoonPhase's order (full
  moon first), in one strip.
- `gui.png`: every interface sprite at its own size, shelf-packed: the HUD, hearts, food,
  armour and air, effect icons, every container background, the creative tabs (one per column,
  as the game has them), the recipe book, buttons, text fields, sliders, tabs, toasts,
  Advancements and Statistics pieces, the menu backgrounds.
- `logo.png`: `gui/title/minecraft.png` (1024x256) over `gui/title/edition.png` (512x64).
- `tex.json`: the jar's version, `tiles` (name to cell), `gui` (name to `[x, y, w, h]`), `logo`,
  `sky` (where the sun and each moon sit in `sky.png`), `font`: the glyphs of `font/ascii.png`
  for `!` to `~` as rows of `#` and `.`, and `sga`: `font/ascii_sga.png`'s `a` to `z`, the
  enchanting table's runes.

Every name is the one `minecraft.js` gives the texture: a `tile('name', ...)` in `buildAtlas()`
or an `mk('name', w, h, ...)` in `guiSprites()`. A GUI sprite is only used when its size is the
size `mk()` asks for.

## How the game uses them

They start loading the moment `minecraft.js` is read, and `init()` waits for them (eight
seconds at most). Anything missing, or everything if the files are gone, falls back name by
name to the drawings in `minecraft.js`, so the game never depends on them.

The world samples its own copy of the atlas, in which block faces are taken down from 16 to 12
texels: each new texel is the colour that covers most of its square, so edges stay hard and no
new colours appear. Isaac asked for it to look "a little more pixel" than the game. `WTEX` in
`minecraft.js` sets it (16 is the game's own look). Items, mobs, plants and the interface keep all
sixteen.

What the build does to the jar's files on the way:

- Grass, leaves, short grass, water and stems are grey in the jar and tinted by biome in the
  game. They are baked here in the plains colours (grass `#91BD59`, foliage `#77AB2F`, water
  `#3F76E4`) and a half-grown stem's green. The grass block's side is its side plus the tinted
  overlay.
- Undyed leather armour is the grey base in `#A06540` under its overlay.
- Animated textures (water, lava, fire, the lit furnace) give their first frame.
- The chest is a block entity in the game; its three faces are cut from
  `entity/chest/normal.png` (lid over base, the latch on the front) and opened out to 16x16.
- The destroy stages are the jar's `destroy_oit_stage_N`, the game's own alpha form of its
  multiply-blended cracks; a jar without them gets the multiply ones turned into an alpha
  overlay (black where they darken, white where they lighten).
- The sun and moons ship as they are; the game adds them onto the sky, as Minecraft does.
- The pause menu's bug and player-reporting icons are stretched to 15x15, which is how
  SpriteIconButton draws them.
- The menu backgrounds are 16x16 textures the game draws two GUI pixels to a texel, so they are
  doubled into the 32x32 tiles the menus repeat.
- The chest screen is the top rows of `generic_54` over its inventory half.

The first-person arm is not from the jar: it wears the skin the launcher chose (the one the
inventory figure wears), painted into the atlas at boot and again when the skin changes.

## Not taken (yet)

Mob skins (our mobs are boxes, not the game's models, so the skins would not map), rain and snow,
the enchantment glint, the panorama (the title screen shows a live world instead) and the
enchanting table's book. The launcher window in `comp.js` still lists 26.2 as the newest release.
