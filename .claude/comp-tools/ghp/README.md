# The GitHub copy's harness

`drive.js` drives github.com/IsaacUre in the pixel Chrome of `/comp/` and `/tcomp/`
with real clicks and keys, and checks it against what github.com shows a
logged-out visitor. Dotfolder, so it is committed but never published.

```
node .claude/comp-tools/serve.js . 8571 &
NODE_PATH=/opt/node22/lib/node_modules node .claude/comp-tools/ghp/drive.js /tmp/shots [comp|tcomp]
```

Leave off `comp|tcomp` to run both. It writes screenshots to the folder you
name and ends with `N/N passed`.

## What it mocks

- `api.github.com`: answers shaped like the real ones. Commits and pull requests
  are this repo's real history, from `data/mockdata.json`.
- `github-contributions-api.jogruber.de`: the calendar mirror, from
  `data/ghsnap.json`.
- `github.githubassets.com`: a 1x1 PNG for the achievement pictures, or a 404
  in the scenario that checks the medallion fallback.

The page's clock is pinned to three hours after `ghsnap.json`'s `asOf`, so the
expectations (377 contributions, October 2026 first, and so on) hold on any
later day.

## When the saved copy in comp.js is refreshed

`GHP_SNAP` in `comp/comp.js` (and `tcomp/comp.js`) is the copy drawn when GitHub
does not answer. `data/` must describe the same moment:

1. Save the real API answers somewhere outside the repo (they hold commit
   e-mails, so they never get committed):
   `curl -sS "https://api.github.com/repos/IsaacUre/IsaacUre.github.io/commits?per_page=100&page=N" -o DIR/commits_N.json`
   for each page, and the same with
   `pulls?state=all&sort=created&direction=desc&per_page=100&page=N` into
   `DIR/pulls_N.json`.
2. `python3 .claude/comp-tools/ghp/gen_mock.py <asOf> .claude/comp-tools/ghp/data DIR`,
   with the same `asOf` as `GHP_SNAP.asOf`.
3. Check the calendar it built against github.com's own: WebFetch
   `https://github.com/users/IsaacUre/contributions` and compare the heading
   and every non-zero day. On 2026-10-19 they matched on every day (377).
4. Put the new counts, months and total into `GHP_SNAP` in both copies, as the
   same patch.

`gen_mock.py` counts what GitHub counts: commits on the default branch whose
author is IsaacUre, pull requests IsaacUre opened (any state), and one for
creating each repository, all by America/Chicago day.
