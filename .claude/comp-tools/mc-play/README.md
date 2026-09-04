# mc-play: the Minecraft game driven like a player

Playwright + headless Chromium, real events only (see ../mc-drive.js). Start
the static server first, then run a suite; each prints PASS/FAIL lines and
ends with ALL PASS or FAILURES: n. Screenshots land in ../shots/ (gitignored).

    node .claude/comp-tools/serve.js . 8571 &
    node .claude/comp-tools/mc-play/drag.js             drag-split, double-click gather, throw-outside
    node .claude/comp-tools/mc-play/creative.js         create screen, Allow Cheats, Open to LAN, the console
    node .claude/comp-tools/mc-play/creative-screen.js  Java catalogue clicks, hover shortcuts, E/Esc fixes, creative eating
    node .claude/comp-tools/mc-play/desktop-focus.js    the shell keeps the keyboard on the game
    node .claude/comp-tools/mc-play/save-fail.js        a full browser store says so; /me and /list without cheats
    node .claude/comp-tools/mc-play/avatar-shots.js     the inventory figure, to look at (also avatar-shots-2.js, menu-shots.js)

The two probe-*.js scripts only print what they see; they are the first
things that were run when "creative isn't working" came in.
