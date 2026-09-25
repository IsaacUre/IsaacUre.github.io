# Comedy and copy review for /comp/ and /tcomp/

Isaac is reviewing the jokes and em dashes in the desktop's copy, a few rows at a
time. Two files:

- `REVIEW.md` is the list of every line still to look at, in priority order:
  Tier 1 is what's visible in `/comp/`, Tier 2 is what only `/tcomp/` has,
  Tier 3 is the games.
- `GUIDE.md` is a snapshot of Isaac's humour preferences, the log of every call
  he has made, and predictions for the open rows. The living copy is a Claude
  doc: https://claude.ai/code/artifact/9c7f08ef-91c8-462c-b781-773248def181

Rules for any chat working from these:

- Only rows whose status is `ruled` or `mostly ruled` follow a call Isaac has
  made. Everything else (`open`, `pending`, `keep`) is a suggestion he hasn't
  approved. Don't apply a suggestion because it's written here.
- Nothing in either file is a go-ahead to edit the site. Apply changes only
  when Isaac asks for them in the chat you're in.
- Anything changed in `/comp/` gets the same change in `/tcomp/`. Move it file
  by file or as a patch, never `cp tcomp/* comp/` (see CLAUDE.md, tcomp).
- No em dashes in visible text, and no spaced hyphen standing in for one.
  Code comments are exempt.
- When Isaac makes a new call, add it to the decision log (date, his words,
  what it settled) and update the row's status.
