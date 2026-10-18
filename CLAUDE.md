# Claude working notes for IsaacUre.github.io

## Workflow

- When a task on a feature branch is complete, automatically create a PR against `main` (if one does not already exist for the branch) and squash-merge it. The user has standing approval for auto-merge on this repo.
- If the branch already has a prior merged PR at an older commit, open a new PR for the new commits and squash-merge that.
- Never commit a test harness or scratch file to the repo root. The repo is served at isaacure.com. Dotfolders are committed but never published.

## NINTH NIGHT

The game at `/tcomp/` (`tcomp/ninth.js`). It is being built out by several
chats working in parallel. It is not in `/comp/`, the public cut (see
**tcomp** below): the job docs, the harness pages and every path in them
mean `/tcomp/`.

If asked to **"do ninth night job N"**, read
`.claude/ninth-night/JOBS.md` and then that job's file. Read
`.claude/ninth-night/README.md` and `PARALLEL.md` first either way:
`PARALLEL.md` says which parts of the file your job owns and which
shared structures have registries instead of being edited directly.

`.claude/ninth-night/TESTING.md` is the harness playbook. The short
version: drive the game with real key events, not the `window.__ninth`
dev handle, because a build once shipped where pressing E did nothing
and the dev handle reported everything working.

## tcomp

`/comp/` is the public cut of the computer; `/tcomp/` is the full build.
`/comp/` is what the site links to and the one being polished for
release, so it ships without Steam (and the games that only ran through
it: Cookie Clicker, Terraria, VEILFALL, Sunset Runner), without Minecraft
(the launcher and the game), without NINTH NIGHT, and without the Edge
gag: Chrome is simply installed, pinned to the taskbar and Start, with a
desktop shortcut. `/tcomp/` still has all of it, at isaacure.com/tcomp,
to try things on before they move to `/comp/`.

- The lore those games left in the file system is out of `/comp/` too,
  and comes back with them. All of it still exists in `tcomp/comp.js`'s
  file tree: `Documents\My Games\Terraria` (and the `wld` and `plr` file
  kinds), `Documents\essays\absurdism and idle games.txt`, the Terraria
  and Cookie Clicker screenshots in `Pictures\Screenshots` and captures
  in `Videos\Captures`, `minecraft worlds backup` under
  `D:\archive\old laptop (2016-2019)\games`, the seed line at the end of
  `the secret.txt` on D:, NINTH NIGHT's folder under
  `C:\Program Files\URE Softworks`, and the Cookie Clicker chip on
  Chrome's Wikipedia page.
- The two directories are not interchangeable: `cp tcomp/* comp/` would
  bring everything back. Move a change across file by file, or as a
  patch. Both `index.html`s load their scripts and stylesheet by relative
  path (`comp.js`, not `/comp/comp.js`); keep it that way, since an
  absolute `/comp/` or `/tcomp/` in a loader tag makes one copy silently
  run the other's code.
- The saves are shared. Both copies sit on one origin and read and write
  the same localStorage keys, so a test build shares its saves with the
  live one.
- The NINTH NIGHT docs and every harness under `.claude/` point at
  `/tcomp/`; nothing they drive is in `/comp/` any more. The QC logs in
  `.claude/ninth-night/qc-2026-08-12/` still say `comp/` because they are
  a record, not instructions.
- Minecraft's sounds are the real game's own recordings, as files in
  `tcomp/mc-sounds/` (83 MB, most of it the soundtrack). More, already
  encoded the same way, wait in this repo's `mc-sounds-archive` release;
  `.claude/comp-tools/mc-sounds/README.md` says how to add one, where the
  full original archive is, and how to check. `minecraft.js` loads them
  from beside its own script, so a copy of the game in `/comp/` would need
  its own `mc-sounds/` beside it.
- Its textures, interface sprites, font glyphs and title wordmark are the
  game's own too, in `tcomp/mc-tex/`, built from a Minecraft client jar by
  `.claude/comp-tools/mc-tex/build.py` (its README says how, and what each
  file is). Anything missing there falls back to the drawings in
  `minecraft.js`. Block faces in the world are taken down from 16 to 12
  texels on purpose (Isaac asked for a slightly more pixel look); `WTEX` in
  `minecraft.js` sets it.
- Its screens follow Java 26.3, read out of the jar's class files with
  `.claude/comp-tools/mc-tex/jdis.py` (the README there says how). The Game
  Menu's World Options... holds the LAN scope and the world's Allow Cheats
  (26.3 has no Open to LAN screen); the `mc-play/creative.js` suite drives it.

## test

`/test/` is the face of the site being built: a "who is this guy" page in the
holding page's look (the same boot terminal, and the same LCD, which now types
the name and `whoami`). It lives at isaacure.com/test until Isaac moves it to
the root. (It was at `/new/` at first; that path is gone, not redirected.)

- It stays unlisted until he says otherwise: `noindex, nofollow`, no
  canonical or `og:url`, and no link to it from anywhere on the site. Drop
  the noindex when it moves.
- Every fact on it is one he has confirmed or published himself. Ask him
  before adding a biographical claim (a date, a title, a number), and don't
  copy one from `comp/`, `ureboy/` or `behind-the-lens/`: the computer is
  half lore, and the other two still carry old dates.
- The screen stays alive the way the holding page's does: its eye blinks
  twice every 8s and its cursor (and Contact's) keeps blinking. Isaac asked
  for that over WCAG 2.2.2's five-second rule, so don't "fix" it. Everything
  else settles within five seconds of the boot's hand-off, and without JS or
  under reduced motion it is simply the finished page, with nothing moving.
- The About pictures each have a little move (PICS in the script, drawn in
  frames like the blink). Each plays once when all of it comes into view,
  again on hover or tap, and again when you come back after 20s. They never
  loop.
- Stepped animations that fill backwards use end steps (or none): a start
  step filled backwards shows its first frame during the delay in browsers
  without the easing spec's "before flag". That is how the name once showed
  its I before typing it.
- It loads everything by absolute path (`/images/...`, `/favicon.svg`), so
  moving it to the root is a copy.
- There is no section for the rest of the site. Isaac took the "This
  site" one out and may add one back later (it would be the place for
  `comp/` and `1p/`). GitHub is off the Contact list on purpose until he has
  a GitHub he wants to show; don't put it back unless he asks.
- `.claude/test/rig/` has its checks (170 of them, plus axe and
  html-validate). Run them after any change; its README says how.

## test2

`/test2/` is the same page as `/test/` rebuilt as a Windows 11 desk of Windows
Terminal windows: the holding page's boot hands off to a desk with a taskbar
along the bottom, and every part of the page is a Windows Terminal window (the
tab row with its one tab, the caption buttons at the right, VT323 inside)
running PowerShell 7, each of which ran one command: a login shell that prints
`PowerShell 7.6.7` and the banner and answers `whoami`, `fastfetch` with the eye
for a logo, `chafa headshot.jpg`, `type readme.md`, `dir interests -Name` and
a `type` for each, `Import-Csv log.csv` and a `type` for each line, and
`type contact.txt`. It lives at isaacure.com/test2 until Isaac picks one of the
two. The chrome follows Windows Terminal's source (the 40px tab row, the tab
filled with the terminal's black, the 46px caption buttons and their colours,
Campbell's `#0c0c0c`, the bar cursor) and PowerShell's (the `PowerShell 7.6.7`
line, the default prompt, the aliases `type`, `dir`, `start`, `Import-Csv`);
the cream taskbar, the red accent frame and the palette inside are the page's
own choices, not Windows'.

- Everything in `## test` holds here too: unlisted (`noindex, nofollow`, no
  canonical or `og:url`, no link to it), only facts he has confirmed (the copy
  is `/test/`'s, word for word; the file names, the prompt, the version and the
  window titles are chrome, not facts), absolute paths, the loops kept
  (fastfetch's eye blinks on the 8s loop, the front window's cursor blinks),
  everything else still within five seconds, and the finished page with
  nothing moving under reduced motion or without JS. GitHub stays off the
  contact list.
- The prompt is PowerShell's default, `PS C:\Users\isaac> `, all of it dim. The
  windows' titles are plain names (`whoami`, `fastfetch`, `readme.md`,
  `log\rice-racing.md`, `contact.txt`); paths use backslashes; the command is
  the first line inside, and `/test/`'s section titles are comments at the
  prompt above it (`# who is this guy`, `# effectively mini resume`,
  `# say hi`). Prompt lines are `aria-hidden` decoration except where they hold
  a link or Isaac's words (the comments, with the `# ` hidden). The next prompt
  follows the output on the very next line; the only blank lines are the ones
  in the files and the ones the csv's table prints around itself. The log
  entries' `# Org` lines are `h3`s under the window's `h2`.
- The caption buttons are Windows': Minimize, Maximize, Close at the right of
  the tab row, 46px wide and the row's full height, with 10px glyphs; Maximize
  alone is a toggle (`aria-pressed`) and only its glyph changes to restore. The
  front window has the accent frame (Tornado Red), a `#2e2e2e` row, white
  glyphs and the only cursor; a window at the back has a `#333333` row, grey
  glyphs and no cursor (Windows Terminal hides an unfocused terminal's cursor).
  The tab is filled with the terminal's black and runs into the body; the `+`
  and `v` after it are drawn and inert.
- Two things break by the window's width, not the viewport's (container
  queries, with a viewport query as the fallback): fastfetch puts the eye above
  the facts in a window under 348px, and the banner breaks into its two words,
  URE under ISAAC, the way figlet wraps, in one under 310px. The `+` and `v` go
  in a window under 420px.
- The windows are a CSS grid (twelve columns on a desktop, six on a tablet,
  one on a phone) with a whole-pixel nudge each (`--nx`, `--ny`) so they
  overlap at the edges. The script only adds behaviour: the cascade (what is
  in view pops in order and lights up in turn; the rest when scrolled to,
  without taking the front), raise on click, drag by the tab row with a mouse
  (never a finger, a touchscreen laptop's included: a finger scrolls),
  minimize to the taskbar (the window shrinks toward its taskbar button and
  keeps its place on the desk, unseen; on a phone it is simply gone; its
  section's taskbar button, the window list, a link to it or Reset brings it
  back), maximize (Maximize again, a double-click on the row or Escape
  restores; the rest goes `inert`), close (the grid reflows), and the eye's
  window list in the taskbar, which also resets the desk. The login shell is
  the front window at rest (after the cascade, after a reset, and under reduced
  motion), so its cursor is the one blinking.
- The taskbar is Windows 11's in the LCD's cream: Start (the eye) and a
  labelled button per part of the page in the middle, the tray and the
  two-line clock at the right, the running indicator under a part with windows
  up and the long accent one under the part you are in (`aria-current`, set by
  scroll: `home` while the login shell's top half is on screen, the part in the
  upper half of the screen below that, `contact` at the bottom). As it narrows,
  in ems, it moves left and loses the tray, then the icons and the date, then
  the clock; the labels always stay. The skip link goes to the taskbar, the one
  thing after the windows. The window list is a flyout up from Start with a
  row per window and its state in words.
- The boot terminal is `.term`; a terminal window is `.win`. Don't reuse the
  boot's class for a window: its rule once leaked onto every terminal window
  (16px text, `touch-action: none`).
- Its boot flag is `iu2.booted`, its own, so a visit to `/test/` in the same
  session doesn't skip it.
- `.claude/test2/rig/` has its checks (the probe, axe, html-validate, the
  screenshots). Run them after any change; its README says how. The fonts
  come from `.claude/test/rig/fonts`.
