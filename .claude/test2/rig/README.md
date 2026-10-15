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

- probe.js: the boot and its skip, the cascade (what is in view pops in order,
  the rest when scrolled to), warm visits, `?boot`, deep links, reduced motion
  (nothing moves, nothing held back), no JS, the windows as windows (raise,
  drag and its clamp, a drag that starts on a button, shade, fill the screen
  and Escape, double-click, close, the eye's window list, reset the desk), the
  taskbar's commands and the part they mark, the title bars fitting at twelve
  widths (tight bars drop their leader and result, a log line's date moves
  into the body, no maximize button on a phone), a finger scrolling over a
  title bar, keyboard order and focus, the loops (the LCD's blink, the foot's
  eye, the cursors), print, forced colours, a 24px default font, and whole
  pixel window edges. T15 and T16 are the two review rounds' findings, kept
  fixed: nothing climbs over the taskbar or the list, the boot visit's
  hand-off blink, a finger never drags (a touchscreen laptop included), the
  screen-filling window's edge cases (shade, print, links, narrowing below
  760, Escape with the list open), a drag surviving a close or a reopen, the
  list closing when focus lands elsewhere, the car's readout keys, a double
  tap on close, back to a closed window's hash, selection on the cream, no
  hover left behind by a tap.
- shoot.js: desktop cold and warm (the cascade frames), laptop, tablet, phone,
  320, reduced motion, no JS. report.json has console errors, failed requests
  and horizontal overflow per run.

Playwright is the container's global install
(`/opt/node22/lib/node_modules/playwright`). The checks need the real faces:
VT323's advances are hinted to whole pixels here, and the title bars are
measured in its columns. Don't turn TLS checking off to get around the proxy;
the fonts are local for that reason.
