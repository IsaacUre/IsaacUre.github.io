# /test2 rig

Checks for `test2/index.html`, run in the container's Chromium with real key,
mouse and touch events. Nothing here is published (it's a dotfolder). The fonts
come from `../../test/rig/fonts` (the same three faces), so that folder has to
be there.

    cd .claude/test2/rig && npm install                        # axe-core, html-validate
    node ../../test/rig/serve.js 8650 &                        # the repo at /, so /test2/ is test2/
    node probe.js  http://127.0.0.1:8650/test2/ /tmp/probe2    # the behavioural checks
    node audit.js  http://127.0.0.1:8650/test2/                # axe, WCAG 2.x A/AA, 1280 and 375 wide
    npx html-validate -c htmlvalidate.json ../../../test2/index.html
    node shoot.js  http://127.0.0.1:8650/test2/ /tmp/shots2    # screenshots and a report

- probe.js (132 checks): the boot and its skip, the cascade (what is in view
  pops in order, the rest when scrolled to), warm visits, `?boot`, deep links,
  reduced motion (nothing moves, nothing held back, a minimize included), no JS
  (no window in front, no cursor, `PowerShell 7.6.7` printed), the windows as
  windows (raise, drag and its clamp, a drag that starts on a caption button,
  minimize to the taskbar and every way back: its taskbar button, the window
  list, a link, a hash change and Reset; maximize and Escape, double-click,
  close, the eye's window list, reset the desk), the taskbar's buttons and the
  part they mark, the clock, the title bars at twelve widths (the caption
  buttons inside the window with Close at its right edge, each 46px wide and
  the bar's height, the bar 2.5rem, the title clear of them on one line, the
  log's table never wider than its window; on a phone Minimize, Maximize and
  Close 46 by 40), a finger scrolling over a title bar, keyboard order and
  focus, the loops (fastfetch's eye, the foot's eye, the front window's 2px bar
  cursor blinking and no cursor in the others), print (a minimized and a closed
  window included), forced colours, a 24px default font, and whole pixel window
  edges. T15 and T16 are the two review rounds' findings, kept fixed: nothing
  climbs over the taskbar or the list, the boot visit's hand-off blink, a
  finger never drags (a touchscreen laptop included), the maximized window's
  edge cases (minimize, print, links, narrowing below 760, Escape with the list
  open), a drag surviving a close or a reopen, the list closing when focus
  lands elsewhere, the car's spec box, a double tap on Close, back to a closed
  window's hash, no hover fill left behind by a tap. T17 is the Windows build's
  own: no tab roles, the split button (decoration, gone in windows under
  420px), the skip link and the names it leads to (`Taskbar`, `Window list`),
  the taskbar at 320 and 390 wide with 16px and 24px default fonts, the pills
  following the scroll, the list inside a 320 screen, and no em dashes.
- shoot.js: desktop cold and warm (the cascade frames), laptop, tablet, phone,
  320, reduced motion, no JS. report.json has console errors, failed requests
  and horizontal overflow per run.

Playwright is the container's global install
(`/opt/node22/lib/node_modules/playwright`). The checks need the real faces:
VT323's advances are hinted to whole pixels here, and the typed command, the
banner and the fetch are measured in its columns. Don't turn TLS checking off
to get around the proxy; the fonts are local for that reason.
