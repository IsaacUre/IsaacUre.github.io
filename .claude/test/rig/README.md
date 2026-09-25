# /new test rig

Checks for `new/index.html`, run in the container's Chromium with real key,
mouse and touch events. Nothing here is published (it's a dotfolder).

    cd .claude/new/rig && npm install                        # axe-core, html-validate
    node serve.js 8650 &                                     # the repo at /, so /new/ is new/
    node probe.js  http://127.0.0.1:8650/new/ /tmp/probe     # 88 checks
    node probe2.js http://127.0.0.1:8650/new/ /tmp/probe2    # 66 checks
    node audit.js  http://127.0.0.1:8650/new/                # axe, WCAG 2.x A/AA, 1280 and 375 wide
    npx html-validate -c htmlvalidate.json ../../../new/index.html
    node shoot.js  http://127.0.0.1:8650/new/ /tmp/shots     # screenshots and a report
    node look.js   http://127.0.0.1:8650/new/ /tmp/look      # short windows, large text, a phone, a cold hand-off

`serve.js 8650 <dir>` serves a candidate copy at /new/ instead, with
/images/ still from the repo.

- probe.js: the boot and its skips, warm visits, deep links, the pinned
  commands and the section they mark, right edges and whole-dot leaders at
  eight widths, late and blocked fonts, focus never under the bar, print,
  forced colours, nothing looping, text spacing, whole-pixel positions.
- probe2.js: the commands during the 1.8s after the hand-off (keyboard
  reaches and shows them, a stray tap falls through), edges shared on
  phones, the readout without `contain`, the blinks (live reduced motion,
  never doubled, never spent off screen), short windows, larger default
  text, copying the name, paging from the pinned commands, the screen
  settled inside 5s, and a first visit printing the first screen's part of
  the page after the commands.

T0 in probe2.js checks its own instrumentation first. If T0 fails, don't
trust any other result in that run.

Playwright is the container's global install
(`/opt/node22/lib/node_modules/playwright`). The fonts come from `fonts/`,
not Google, because this Chromium doesn't trust the session proxy's
certificate. The checks need the real faces: VT323's advances are hinted to
whole pixels here. Don't turn TLS checking off to get around it.
