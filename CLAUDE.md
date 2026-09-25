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
- Nothing on it loops, and the screen settles within five seconds of the
  boot's hand-off (WCAG 2.2.2). Without JS, or under reduced motion, it is
  simply the finished page. Keep both true.
- It loads everything by absolute path (`/images/...`, `/favicon.svg`), so
  moving it to the root is a copy.
- There is no section for the rest of the site yet. Isaac took the "This
  site" one out and will add one when `comp/` and `1p/` are ready to link.
- `.claude/test/rig/` has its checks (154 of them, plus axe and
  html-validate). Run them after any change; its README says how.
