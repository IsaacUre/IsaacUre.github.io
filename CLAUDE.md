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

`/tcomp/` is the testing copy of `/comp/`. Try changes there, at
isaacure.com/tcomp, before they move to `/comp/`, which is the copy the
site links to. The two directories are meant to be identical apart from
whatever is being tested.

- Both `index.html`s load their scripts and stylesheet by relative path
  (`comp.js`, not `/comp/comp.js`), so a copy in either direction needs
  no edits: `cp tcomp/* comp/` promotes, `cp comp/* tcomp/` refreshes.
  Keep it that way. An absolute `/comp/` or `/tcomp/` in a loader tag
  makes one copy silently run the other's code.
- The saves are shared. Both copies sit on one origin and read and write
  the same localStorage keys, so a test build shares its saves with the
  live one.
- The harness pages under `.claude/` and the NINTH NIGHT docs still point
  at `/comp/`. A change made in `/tcomp/` will not show up in them.
