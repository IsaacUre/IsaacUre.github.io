# Claude working notes for IsaacUre.github.io

## Workflow

- When a task on a feature branch is complete, automatically create a PR against `main` (if one does not already exist for the branch) and squash-merge it. The user has standing approval for auto-merge on this repo.
- If the branch already has a prior merged PR at an older commit, open a new PR for the new commits and squash-merge that.
- Never commit a test harness or scratch file to the repo root. The repo is served at isaacure.com. Dotfolders are committed but never published.

## NINTH NIGHT

The game at `/comp/` (`comp/ninth.js`). It is being built out by several
chats working in parallel.

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
(the launcher and the game), and without the Edge gag: Chrome is simply
installed, pinned to the taskbar and Start, with a desktop shortcut.
NINTH NIGHT ships in both. `/tcomp/` still has all of it, at
isaacure.com/tcomp, to try things on before they move to `/comp/`.

- The two directories are not interchangeable any more: `cp tcomp/*
  comp/` would bring Steam and Minecraft back. Move a change across file
  by file, or as a patch. Both `index.html`s load their scripts and
  stylesheet by relative path (`comp.js`, not `/comp/comp.js`); keep it
  that way, since an absolute `/comp/` or `/tcomp/` in a loader tag makes
  one copy silently run the other's code.
- The saves are shared. Both copies sit on one origin and read and write
  the same localStorage keys, so a test build shares its saves with the
  live one.
- The harness pages under `.claude/` and the NINTH NIGHT docs still point
  at `/comp/`. The Minecraft and Terraria harnesses under
  `.claude/comp-tools/` only have something to drive at `/tcomp/` now.
