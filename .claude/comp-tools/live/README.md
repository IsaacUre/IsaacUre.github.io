# The live pages' harness

Drives Wikipedia, Hacker News, the results page, Chrome's error pages and the
frame for any other site in the pixel Chrome of `/comp/` and `/tcomp/`, with
real clicks and keys. Dotfolder, so it is committed but never published.

```
node .claude/comp-tools/serve.js . 8571 &
NODE_PATH=/opt/node22/lib/node_modules node .claude/comp-tools/live/drive_wiki.js /tmp/shots [comp|tcomp]
NODE_PATH=/opt/node22/lib/node_modules node .claude/comp-tools/live/drive_hn.js /tmp/shots [comp|tcomp]
NODE_PATH=/opt/node22/lib/node_modules node .claude/comp-tools/live/drive_web.js /tmp/shots [comp|tcomp]
```

Leave off `comp|tcomp` to run both. Each writes screenshots to the folder you
name and ends with `N/N passed`. Nothing on the web is reached: every host the
copies ask for is answered by a mock, and every other one is refused.

## What it mocks

- `en.wikipedia.org` (`wikimock.js`): the action API's `parse` and `query`
  answers and the REST title search, from `data/wiki.json`. The article in
  there is made up, in the parser's output shape, and says so in its title
  (`Harness test article`); nothing in it is Wikipedia's text. `load.php`
  answers with `data/vector.css`: the Vector 2022 skin's stylesheet compiled
  from the skin's and MediaWiki core's own LESS (skins.vector.styles with
  core's skin features, skins.vector.icons as mask-image data URIs, the Codex
  components the search box uses), so the copy can be looked at without the
  network. The real page loads the real stylesheet from Wikipedia; this file is
  only the harness's stand-in, and goes stale as Vector changes. Its header
  names the upstream commits and the licence (GPL-2.0-or-later, like
  MediaWiki): it is a build of their code, kept here as a fixture.
- `hacker-news.firebaseio.com` and `hn.algolia.com` (`hnmock.js`): the lists,
  items, a thread and a user, from `data/hn.json`, made up in the APIs'
  shapes (the titles say so). `news.css` is a stub: the site's own stylesheet
  is not kept here.
- The results page's sources (`drive_web.js`): Wikipedia's search and summary,
  GitHub's repository search, Algolia, Open-Meteo, with one made-up answer each
  for a query with `harness` in it and nothing for any other.

The clock is pinned (`hn.json`'s `now`, 2026-10-19 12:00 UTC) so the ages hold.
Three of the front page's stories are 34, 100 and 400 days old, for the age
wording; the thread's story has its replies in the site's order (`kids`), which
differs from Algolia's, a deleted comment with a live reply under it, a dead
comment with a live reply, and a dead leaf (Algolia carries both with their
text; only the site's API says they are dead; a dead row keeps its name, as the
site's does, a deleted one loses it). Story 9001 is in the site's API only, not
Algolia's, for the path that builds a thread from the site's API alone. `fbDown`
makes the site's API time out, for the error page; `kidsDown` makes only the
comments (the 2xxx items) answer 503, for the memo check: a round that failed
is asked again on Reload, a round that answered is not asked again on Back.
The Wikipedia article carries a TemplateStyles block with the sanitizer's
escapes and two red links (one to a talk page).

Two things the mocks do on purpose: a document request to either site (a page
the copy does not draw, typed in) comes back with `X-Frame-Options: DENY`, as
the sites send it, so the checks see the refusal Chrome shows; and a click on
such a link is checked through `window.open`, which the checks wrap. The mocks
are routed on the browser context, so the window that opens is answered by them
too. Playwright's Chromium aborts any request for a bare `/favicon.ico`, so the
Hacker News copy's icon is the one the site's own `<link rel="icon">` names
(`y18.svg`), which loads.

## What the copies draw from

`comp/comp.js` says, above each page, which repository each piece of markup
and each string came from. The labels the English Wikipedia sets on-wiki
(MediaWiki:Sidebar, the Article/Talk tabs, the tagline, the footer's licence
sentence) are marked `ONWIKI` there: no repository holds them, and they were
written from the live site, not fetched by these checks.
