# /comp/ comedy review, v2 (Sep 24)

Everything still to do, in your priority order: what's visible in /comp/ first, then what only /tcomp/ has, then the games. Anything changed in /comp/ also gets changed in /tcomp/, since tcomp has the same strings (the three places where the two copies already differ, the Downloads folder, chrome://downloads and the secret.txt on D:, are noted in their rows).

**Status column.** `ruled` follows a call you've already made and just needs applying. `mostly ruled` is the same with a small leftover you might want to glance at. `open` needs your call. `keep` means I'd leave it (skip unless you disagree). `pending` is waiting on the cow or the sleeping policeman. `fix` is a plain mistake, not comedy. `gone` means the string no longer exists, because the page it was on was replaced, so there is nothing left to do.

**How to read a row.** Left is what's there now, verbatim. " / " separates lines of a file, and X or N stands for something that changes. Right is my suggestion. "cut" means delete that bit and leave whatever plain label is around it. Nothing behind ?dev= URLs or the NINTH NIGHT dev menu is here, since visitors never see it.

Rows 1 to 15 are the patterns you already ruled on (or asked examples for), now split by where each instance lives.

# Tier 1: /comp/ (the public cut)

Everything visible in /comp/. Every change here also goes into /tcomp/, which has the same strings.


## Patterns across both builds


These are the rule-once rows. Each one names where every instance lives: **comp** means it's in /comp/ (and so also in /tcomp/), **tcomp** means only the testing build has it, **game** means one of the games. The instance rows below carry the actual changes.


| # | now | suggestion | status |
|---|---|---|---|
| 1 | **Em dashes.** In comp's visible strings there are about 60, plus the window title suffix in comp.css (` — full screen`), the index.html meta description, and four lone `—`s (three placeholders: Properties size, the `dir` size column, number formatting; plus the separator in front of address-bar suggestion notes). tcomp's own code adds about 65 more (Steam, Edge, Chrome Setup), and the games about 38 (VEILFALL 14, Terraria 9, NINTH NIGHT 9, Cookie Clicker 4, Minecraft 2). Most are a label-plus-subtitle (`X — added to cart.`, `v1.4 — Night Roads`) or a mid-sentence pivot. | Settled: all visible ones go, code comments stay. Each has its replacement in its own row. Where a rewrite reads better than a punctuation swap it's rewritten; where the dash only joined a label to a subtitle it's a colon or a middle dot. One conflict to settle is in the open questions: real products (Notepad, Wikipedia) write titles with a spaced hyphen, `Untitled - Notepad`, which you count as an em dash. | mostly ruled |
| 2 | **"one (1)"**: a number written twice, as a word and then a numeral, the way contracts do. comp: `the party shares one (1) enchanted hatchback.` (session 0 notes) / `It has appeared in one (1) arcade game, one (1) management sim, and one (1) CRPG` (fake Wikipedia GTI article) / `One (1) unread message.` (Gmail search blurb) / `INVOICE #0042 — one (1) wing, as discussed` (Gmail inbox). tcomp: `Nothing downloaded yet. Edge has one (1) idea.` (Downloads) / `UreOS 11 Pixel Edition · one (1) user: isaac` (Chrome Setup EULA) / `we can afford exactly one (1) wing` (Steam chat). | Drop the "(1)" in all seven. URE QUEST's signpost does it once too (`Topiary, squirrels, one (1) wizard.`), so if you actually like the tic, say so and they stay. | open |
| 3 | **"load-bearing"**: the structural word (a wall that holds the building up) used as a joke for "important". comp: `N item(s). they are all load-bearing.` (Terminal `dir`) / `This is a load-bearing file. The operating system is standing on it as we speak.` (the delete confirm before the blue screen) / `Now load-bearing to party morale.` (the cow.pdf). tcomp: `Gwent is a load-bearing minigame.` (Witcher 3 on Steam) / `X cannot be blocked. They are load-bearing.` (Steam friend toast). game: `Squid are load-bearing!` (Minecraft splash). The FSAE page's `(one is load-bearing)` is gone with the old page. | Cut all six. Each row has the replacement. | open |
| 4 | **"vibes"**: slang for a mood, used as the punchline for "no particular reason" or "nobody checked". comp: `vibes.dll` in System32 (deleting it blue-screens with stop code `VIBES_NOT_FOUND`) / win.ini ending `[vibes] / level=maximum / source=bloom` / 7-Zip History.txt `- everything since has been vibes.` / the filler .ini generator, which can write `vibes=true` into any made-up .ini. tcomp: EULA clause 10 `...the laws of UreOS, which are mostly vibes.` / Steam verify-files `All files validated. 0 failed. It was mostly vibes, and the vibes check out.` The isaacure.com footer's `some vibes` is gone with the old page. | Cut the word everywhere. Drop `vibes.dll` and move its blue-screen onto `ure32.dll`. Drop `vibes` from the .ini key list (the other keys are real-looking: `enabled`, `verbose`, `retries`...). | open |
| 5 | **A one-word sentence tagged on the end** to turn a flat line into a joke. comp: `A perfectly clean desktop. Suspicious.` (empty desktop) / `A USB drive with nothing on it? Impossible.` (empty E: drive). Neither can actually show, since the desktop and E: always have items that can't be deleted. tcomp: `This game has no achievements. It respects your time. Suspicious.` (Steam achievements page). Same family, each in its own row: `instructive.`, `Legally.`, `Optimistic.`, `Aggressively.`, `(obviously)`, `Physics.`, `Classic.`, `Impressive, honestly.`, `Mysterious.` (comp); `artisanal.`, `Obviously.`, `Generous.`, `Revolutionary.` (tcomp); `Yet.`, `beautiful.`, `Blue.`, `Iconic.` (game). | Cut the tag in all three, and the cousins in their rows. | open |
| 6 | **"the museum"** (the site calling itself one). comp: `This is a museum inbox.` (Gmail) / `ERR_NAME_NOT_RESOLVED_ (it’s a museum)` (error page) / `Museum floor plan.` (chrome://settings toast) / `GitHub gives anonymous museums 60 requests an hour.` / `actually reachable from inside the museum` (Wikipedia) / `the museum spends them wisely` (GitHub search blurb). tcomp: six in Steam (`Museum checkout`, `This museum only honors URE-codes.`, `(museum data)`, `the museum hasn't catalogued`, `DLC is décor in this museum`, `Only Isaac has a profile in this museum.`). | Settled: cut. When something isn't real, the real product's own error copy is drier. | ruled |
| 7 | **"it's pixels"** and the machine saying it's fake. comp: the font viewer's `The pixels for this font are stored somewhere very safe.` / 7-Zip's `abridged for pixel reasons` / `… the tree keeps going. pixel budget does not.` (Terminal) / Settings' `Canvas 2D, pixelated` and `pixel-bit operating system` / Chrome's `(it can only hear pixels)`, `It’s pixels.`, `also pixels, but sideways.`, `restyled into pixels`, `The real API, in pixels`, `not the pixels`, `pixels all the way down`, and the search blurbs `The pixels are ours; the words are theirs.` (Wikipedia) and `fetched live into the pixel desktop` (Open-Meteo) / `NO PIXEL CODEC` / `Version 126.0.pixel.1` (chrome://settings). tcomp: Steam's `Canvas 2D, pixelated` (requirements and System Information) and `--pixels=all --thumbs=up`. The launcher's pixel lines were already removed on Sep 6. | Settled: cut. The pixel art speaks for itself. `UreOS 11 Pixel Edition` is the fake OS's product name, so it has its own open row. | ruled |
| 8 | **The machine talking about itself, apps with feelings.** comp: `The machine would notice.`, `UreOS is quite attached to this folder.`, the Comic Sans preview's `Not installed on this machine. Some doors we keep closed.`, `UreOS keeps its furniture where it can see it.`, `Notepad would like a different job.`, `The Store has reviewed your request and would prefer not to be involved.`, `The browser turned full screen down.` tcomp: `Edge is thrilled.`, `The profile mourns.`, `Edge has been consoled. It says it understands.`, `It knows what it did.` | Settled: replace with the flat message the real OS would show. Individual lines in their rows. | ruled |
| 9 | **Explaining the bit.** tcomp: `Not enough points. Go earn XP. (You can't. That's the joke.)` (Steam). game: Minecraft's hidden splash `This splash cannot be shown, which is the joke.` | Settled: cut the explanation every time. Each line has its own row. | ruled |
| 10 | **Chamomile.** comp: the About spec `Runs on: chamomile, not caffeine`, `chamomile.sys`, the real-analysis notes, a study track, the Thresher line judge. tcomp: the Euro Truck blurb, the Steam friend `chamomile`, a Labs reason. | Settled: it's real, and it stays wherever it's a fact about you. Every instance is in the kept-gags sections (comp and tcomp). Two use it as a punchline rather than a fact, the Thresher line judge and the Labs reason. I'd cut those, but that part is your call. | mostly ruled |
| 11 | **The intercooler in the box.** comp: service log, install plan, `intercooler receipt.pdf`, a photo, the DnD `intercooler arc`, the dyno sheet, the DM cheatsheet's HEAT SOAK line, and the boss's name on a screenshot, a video and a track. tcomp: the URE QUEST readme. game: VEILFALL's unique item `The Box`. It's canon in your URE QUEST cartridge too: main quest `THE INTERCOOLER`, boss `HEAT SOAK, TYRANT OF SUMMER`, the car's full name `Argentina Artemis Ure`. | Settled: real, so the thread stays. How each instance is written is still your call; they're all in the kept-gags sections. | ruled |
| 12 | **The cow.** comp: `nerf the cow?` (URE QUEST balance.txt), the npc voices note, `the cow.pdf`, the age-7 essay, the college brainstorm line. tcomp: the `Moo` launcher skin. It's canon in URE QUEST: `THE COW` is a party member whose bio (`You said you would be a cow one day. Close enough.`) quotes the essay. | Pending. Each instance has a call for both outcomes in the kept-gags section. | pending |
| 13 | **Camus and the boulder.** comp: `boulder.sys`, `THE BOULDER.pdf`, session 3 notes, the Sisyphus notes, `camus response paper.docx`, the DM cheatsheet's boulder line, the reading list, the About tag `absurdist philosophy`. tcomp: the absurdism essay (it left comp with the games), the Stanley Parable and Disco Elysium blurbs, the Absurdist Games Weekly curator. game: three "one must imagine" lines in VEILFALL. `THE BOULDER` is a URE QUEST party member too. | Settled: Camus stays. Every instance is listed so you can judge the wording. The exception I'd make is VEILFALL's three "one must imagine" lines: that game should sound like the ARPG it copies, so I'd cut two. The third, `The dummy respawns. One must imagine it happy.`, fits its spot (a respawning dummy is the boulder), so it could stay. That part is your call. | mostly ruled |
| 14 | **"real" / "actual" / "genuinely"**: the fake site insisting things are real, about 35 times in Chrome (all comp): `Boot the real URE BOY ↗`, `Search 6,800,000 real articles`, `Loading the real X in a window`, `Open in a real tab ↗`, `Fetching the real X…`, `The real API, in pixels`, `Real results for “X”`, `Searching the real web for “X”…`, `Type a query to search the real web.`, `X, right now, for real`, the Wikipedia and weather search blurbs, and riceracing.org's `Open the real riceracing.org` and `live on the real site`. | Settled: drop the word. `Open URE BOY`, `Search Wikipedia`, `Loading X`, `Open in a new tab`, `Fetching X…`, `Results for “X”`, `Searching for “X”…`, `Search the web.`, `X, right now`. The live chip already says `● live`. | ruled |
| 15 | **The sleeping policeman.** All four are in comp: the GTI RUN readme, DnD session 2, a car-songs track, the font preview sentence. He's the Hedges road boss in URE QUEST. | Pending (you said later). Each instance has a call for both outcomes in the kept-gags section, plus which one I'd pick. | pending |

## Desktop, File Explorer, and what's in the files


| # | now | suggestion | status |
|---|---|---|---|
| 16 | Empty desktop message: `A perfectly clean desktop. Suspicious.` (never shows: This PC and the Recycle Bin can't be deleted, so the desktop is never empty) | `This folder is empty.` (what Windows says) or nothing. Low priority since nobody can see it. | open |
| 17 | System32 empty: `You should not be able to see this message.` (also dead text, System32 always has protected files) | keep or cut, it never shows either way. | open |
| 18 | System32\config empty: `The registry lives here. It prefers not to be perceived.` (dead text: the folder always has the SAM/SYSTEM hive files in it, so nobody can ever see this) | cut. | ruled |
| 19 | hosts file: `127.0.0.1       isaacure.com   # wait. no. how would that even` | Keep the entry (the site pointing at localhost is the actual joke), cut the comment. | open |
| 20 | spool\PRINTERS empty: `No printer has ever worked. Not once. Not anywhere.` | `No printer has ever worked.` or cut. | open |
| 21 | SysWOW64 empty: `The same thing as System32, but narrower. Do not ask which one is 64.` (only shows if you delete its four dlls) | cut. The folder name is the joke. | open |
| 22 | Program Files (x86) empty: `The same programs, but narrower.` (dead text, it always has folders) | cut. | open |
| 23 | Fake system files in System32: `vibes.dll` (protected, blue-screens with `VIBES_NOT_FOUND`), plus `gti_turbo.sys`, `argent.sys`, `ure32.dll`. (`chamomile.sys` and `boulder.sys` are in the kept-gags section.) | Keep `gti_turbo.sys`, `argent.sys`, `ure32.dll`. Cut `vibes.dll` and move its blue-screen onto `ure32.dll` with a real stop code (`CRITICAL_PROCESS_DIED`, which the machine already uses for winlogon and friends). While there: `winload.exe` is protected too but falls through to the made-up `SYSTEM_FILE_MISSED_IMMEDIATELY`, so give it a real one (`INACCESSIBLE_BOOT_DEVICE`). | open |
| 24 | Fonts folder has `Comic Sans MS.ttf`, `Papyrus.ttf`, `Wingdings.ttf`. Opening them: `Not installed on this machine. Some doors we keep closed.` / `Not installed. The avatar of fonts.` / `Installed, allegedly. Every preview renders as a duck, an envelope and a bomb.` Other fonts: `The pixels for this font are stored somewhere very safe.` The three real fonts: `This one actually renders. It’s one of the three fonts this entire website is built from.` | Font preview that can't render: `Preview not available.` The three real ones: `One of the three fonts this site is built from.` Keep the font files themselves. | mostly ruled |
| 25 | Fonts folder: `Segoe UI Pixel.ttf`, an invented font among real ones (the site's three web fonts `Press Start 2P.ttf`, `VT323.ttf`, `Silkscreen.ttf`, plus `consola.ttf`, `arial.ttf`, `times.ttf` and the Comic Sans, Papyrus and Wingdings files) | Borderline. Keep, or swap it for Windows 11's own UI font, `SegUIVar.ttf` (its real file name). | open |
| 26 | Windows\Temp empty: `Windows cleans this folder. Windows has never cleaned this folder.` (only shows if you delete both files in it) | cut. | open |
| 27 | C:\Temp empty: `The other Temp. There are always at least two.` (only shows if you delete its three files) | cut. | open |
| 28 | AppData\Local\Temp empty: `Deleting these does nothing. They respawn. Everyone knows this.` (only shows once you delete all five, at which point it's also a lie) | cut. | open |
| 29 | LocalLow empty: `Nobody knows what LocalLow is for. It knows what it did.` | cut. | open |
| 30 | win.ini ends with ` / [vibes] / level=maximum / source=bloom` | cut the [vibes] block. | open |
| 31 | system.ini ends with `; nobody has read this file since 1998. hi.` | cut. | open |
| 32 | autoexec.bat: `@echo off / rem 2003 called. it can keep it.` | `@echo off` only, or cut the file. | open |
| 33 | Downloads folder empty (comp's copy): `Nothing downloaded yet.` | `This folder is empty.`, what Windows says. Every visitor who opens Downloads sees this, since it's always empty. | open |
| 34 | 7-Zip History.txt: `9.20 2010-11-18 / - everything since has been vibes. / / (this changelog abridged for pixel reasons)` | `9.20 2010-11-18 / (abridged)` | open |
| 35 | Microsoft Office (trial)\trial expired.txt: `The Office trial expired in 2022. / Google Docs won. Everyone knew Google Docs would win.` | `The Office trial expired in 2022.` | open |
| 36 | Package Cache folder GUID `{4f8a1c2e-77ure-4bo0-y114-argent5ilver}` | keep. Hidden and quiet. | keep |
| 37 | D: drive empty: `Empty. The drive hums anyway.` (dead text, D: has folders) | cut. | open |
| 38 | old laptop\6th grade\typing practice results.txt: `WPM: 34 / WPM after practice: 33 / instructive.` | cut `instructive.` | open |
| 39 | `science fair data (real).xlsx` / `science fair data (better).xlsx`, and on the old laptop `idle tycoon place v13 REAL.rbxl` | keep. That's a real thing kids do. | keep |
| 40 | college apps\essay brainstorm.txt: `ideas: / - the car thing? too obvious / - the DM thing? too niche / - the cow essay?? too honest / - something about systems. everything is systems.` | keep. The cow line follows the cow call (row 227). | keep |
| 41 | roblox\how to script.txt: `day 1: what is a variable / day 9: made the button give 2 money instead of 1 / day 30: the tycoon has an economy. i do not fully control it anymore. / day 31: i understand economics now (i did not, but it planted the flag)` | Keep, but `day 31: i understand economics now.` without the parenthetical. | open |
| 42 | DO NOT DELETE.zip\DO NOT OPEN\final warning.txt: `you were warned. / / — past isaac` | `you were warned. / / past isaac` (em dash) | ruled |
| 43 | D:\...\ok fine\the secret.txt: `there was never anything in here. / the folder was the friend we made along the way.` (comp's copy; tcomp's also ends with the Minecraft seed line) | `there was never anything in here.` The "friend we made along the way" line is a meme. In tcomp, keep the seed line after it (Tier 2 has that copy). | open |
| 44 | D:\movies (legal) empty: `Nothing to see here. Legally.` | The folder name is the joke. Cut the message. | open |
| 45 | E: (URE DRIVE) empty: `A USB drive with nothing on it? Impossible.` (dead text, E: has folders) | cut. | open |
| 46 | E:\New folder\New folder (2) empty: `We have all been here.` | Keep the folders, cut the message. | open |
| 47 | E:\for school: `print this.pdf`, `print this 2.pdf`, `PRINT THIS ONE.pdf`; E:\`resume v8 FINAL (use this one).docx` | keep. | keep |
| 48 | E:\autorun.inf: `[autorun] / ; nothing autoruns anymore. this file is a fossil. respect it.` | `[autorun]` only. | open |
| 49 | ECON 200 notes.txt: `week 6: everything is opportunity cost. / week 7: including reading week. / week 12: the marginal utility of one more practice exam is, ironically, diminishing.` | Keep weeks 6 and 7, cut week 12 ("ironically" is the tell). | open |
| 50 | MATH 355 linear algebra notes.txt: `a matrix is a spreadsheet with self-esteem. / eigenvectors: directions the matrix refuses to change. respect it. / proof strategy: assume it works, panic, cite a theorem.` | `eigenvectors: directions the matrix does not change.` and cut the other two. | open |
| 51 | FWIS 100: `essay draft.docx`, `essay FINAL.docx`, `essay FINAL final.docx`, `essay FINAL final ACTUALLY SUBMITTED.docx` | keep. | keep |
| 52 | ECON 375 metrics notes.txt: `correlation is not causation but it IS a great opener. / instrumental variables: an alibi for your regression.` | cut both, or keep only the IV line. | open |
| 53 | FSAE: `budget v7 FINAL.xlsx`, `budget v8 (v7 was not final).xlsx` | keep. | keep |
| 54 | FSAE kickoff notes.txt: `first meeting of the first FSAE team Rice has ever had. / we have: ambition, a whiteboard, and me doing the money. / we need: everything else. / note to self: sponsors say yes to "invest in engineers," not "please buy us a car."` | keep. This one reads like a real note. | keep |
| 55 | Deep Blue jv notes.txt: `rule 1: nobody has ever complained that a newsletter was too short.` and the same line again in `water industry update — sent.pdf`: `As always: this update is short on purpose. Nobody has ever complained that a newsletter was too short.` Also the file names `water industry update — draft.docx` / `water industry update — sent.pdf` (em dashes). | Keep the line once (in the notes), cut the duplicate in the PDF. Rename the files `water industry update (draft).docx` / `water industry update (sent).pdf` (the Reader looks the PDF up by name, so its key has to change too). | mostly ruled |
| 56 | DnD session 0 notes.txt: `pitch: low-fantasy road campaign. the party shares one (1) enchanted hatchback. / house rule: nat 20 on a persuasion check against me and I legally have to say yes.` | Drop the "(1)". Rest is fine if the campaign is real. | open |
| 57 | `session 1 — the silver garage.txt`: `party met the mechanic-oracle. she speaks only in torque specs. / the party talked its way OUT of a fight for the first time in table history. / loot: a coupler of dubious provenance.` | Rename `session 1 (the silver garage).txt` (a spaced hyphen would be the same thing you're trying to get rid of). Content ok if real. | ruled |
| 58 | `session 2 — hedges road.txt` (file name) and its second line `malachi cast something he had not prepared. ruled it worked because it was funny.` (the first line is the sleeping policeman, row 229) | Rename `session 2 (hedges road).txt`. Keep the malachi line. One rules nit, since these are your DM notes: Malachi is a sorcerer, and 5e sorcerers know spells rather than prepare them, so `malachi cast a spell he does not know.` would be the accurate version. | mostly ruled |
| 59 | character sheets: `MALACHI — chaos sorcerer.pdf`, `SAMMY — beast barbarian.pdf` (the boulder and cow sheets are in the kept-gags section) | Parentheses, since the file system already uses them: `MALACHI (chaos sorcerer).pdf`, `SAMMY (beast barbarian).pdf`. | ruled |
| 60 | Documents\ideas.txt: `website but it is a game boy / game boy but it is a room / room but it is first person / first person but there is a computer / computer but it has a website on it (careful)` | keep, minus `(careful)`. | open |
| 61 | Documents\karaoke setlist.txt: `opener: something safe. / mid-set: sad girl autumn. non-negotiable. / closer: the one that wrecks the voice. worth it every time.` | keep. You said on Sep 24 that the karaoke setlist is yours. | keep |
| 62 | Pictures file names: `car wash receipt (why).jpg`, `the tree branch (memorial).jpg`, `game day 2 (better).jpg` (the intercooler box photo is in the kept-gags section) | Keep `(better)` and `(memorial)`. Cut `(why)`. | open |
| 63 | Music file names: car songs `boost line.mp3`, `night drive 114.mp3`, `silver.mp3`, `flex fuel anthem.mp3`, `the on-ramp song.mp3`, `stage one and a half.mp3`; study `lofi for psets.mp3`, `rain on martel.mp3`, `library at 1am.mp3`, `proofs and consequences.mp3`; karaoke `the one i always pick.mp3`, `sad girl autumn (do not distribute).mp3`, `crowd work practice.mp3`; `ure boy theme.mp3` (the chamomile, HEAT SOAK and sleeping policeman tracks are in the kept-gags section) | Mostly fine as texture. I'd cut `crowd work practice` and the `(do not distribute)` tag. | open |
| 64 | Videos: `karaoke (deleted scene).mp4`, `argent cold start.mp4`, Captures folder | keep. | keep |
| 65 | Projects\website\comp.js contents: `you are reading the file that is, at this exact moment, rendering the window you are reading it in. / please do not delete it while you are inside it.` | Cut both, and fill it with the real first twenty lines of comp.js. The file rendering itself is the joke without saying so. | open |
| 66 | Projects\website\todo.txt: `make the computer feel deeper. folders all the way down. / (if you are reading this inside the computer: it worked.)` | Cut the parenthetical. | open |
| 67 | Explorer address bar, bad path: `Windows can’t find “X”` / `Check the spelling and try again. Or type C:\ and wander. Wandering works.` | `Check the spelling and try again.` | open |
| 68 | Opening iexplore.exe: `Internet Explorer` / `This machine has suffered enough.` | `Internet Explorer has been retired.` (Microsoft actually did.) | ruled |
| 69 | Opening any other .exe: `This app can’t run on your PC` / `To find a version for your PC, check with the software publisher. They will also be confused.` | Cut `They will also be confused.` The first sentence is the real Windows text. | open |
| 70 | DVD drive: `Insert a disc` / `The tray is decorative. It has always been decorative.` | `Insert a disc into drive F:.` | open |
| 71 | Open With dialog rows: Notepad `It will try. It will really try.` / Photos `Optimistic.` / Microsoft Store `Do not do this.` | Cut all three subtitles (Windows shows none). | mostly ruled |
| 72 | Open With → Photos: `Photos gave it a look. It’s not a picture. It was never a picture.` | `Photos can’t open this file.` | ruled |
| 73 | Open With → Store: `The Store has reviewed your request and would prefer not to be involved.` | `The Microsoft Store isn’t available on this machine.` | ruled |
| 74 | Deleting a protected file: `You need permission from UreOS to delete this file` / `X is currently in use by Windows. By all of Windows. Right now.` then `No, really` / `This is a load-bearing file. The operating system is standing on it as we speak.` button `I understand what I’m doing` | Keep the two-step, use something close to Windows' own dialogs: `File Access Denied` / `You’ll need to provide administrator permission to delete this file.` button `Continue`, then `Delete File` / `This is a system file. If you delete it, Windows or another program may no longer work correctly.` button `Yes`. The blue screen still lands at the end. | open |
| 75 | Deleting a system item: `Can’t delete “X”` / `That one is part of the machine. The machine would notice.` | `This item is part of Windows and can’t be deleted.` | ruled |
| 76 | Deleting a folder: `UreOS is quite attached to this folder. All of the folders, actually. Try a file.` | `This folder can’t be deleted.` | ruled |
| 77 | Renaming a system item: `The machine gets confused when its parts change names.` | `This item can’t be renamed.` | ruled |
| 78 | Renaming a protected file: `File in use` / `This file is open in System. It is always open in System. Renaming it would be a whole thing.` | `This file is open in System and can’t be renamed.` | open |
| 79 | Properties dialog: `Dimensions: 160 × 144 (everything here is, if you zoom out enough)` / `Status: Protected. Aggressively.` / `Owner: isaac (obviously)` / `Created: came with the machine` | `160 × 144` / `Protected` / `isaac` / a real date. | open |
| 80 | Drag-and-drop refusals: `Can’t move “X”` / `UreOS keeps its furniture where it can see it.` and `That one is bolted to the desktop.` / `Folders live where UreOS put them.` | `This item can’t be moved.` for all three. | ruled |
| 81 | Recycle Bin empty: `Recycle Bin is empty` / `Nothing thrown out. Tidy machine.` | Cut the second line. | open |
| 82 | Permanently delete confirm: `This skips every bin there is. Gone gone.` | `This can’t be undone.` | open |
| 83 | Empty bin confirm: `N items will be permanently deleted. UreOS will remember the tidiness fondly.` | `N items will be permanently deleted.` | ruled |
| 84 | Properties dialog `Size: —` (shows only for This PC, the Recycle Bin and the empty DVD drive), and the size column of Terminal `dir` for the same items | Drop the Size row for those three; Windows has no Size row for any of them (or give the DVD drive the Used/Free/Capacity rows a drive gets). In `dir`, leave the column blank. | ruled |
| 85 | Filler .ini files end with `; do not edit below this line / ; (someone edited below this line in 2022 and we are still finding out why)` | Keep the first comment, cut the second. | open |
| 86 | Filler .log lines include `retry worked. no notes.`, `scheduled task ran early out of enthusiasm`, `GPU woke up`, `disk is fine, stop asking`, `everything nominal` | `retry succeeded`, `scheduled task ran`, `GPU initialized`, `disk check ok`, keep `everything nominal`. | mostly ruled |
| 87 | Filler .css: `/* TODO: center it. actually center it. */` and `.thing.is-centered { /* it was not */ }` | `/* TODO: center it */` and cut the second. | open |
| 88 | Filler .html: `if you can read this, the css did not load, and honestly it reads fine.` | `if you can read this, the css did not load.` | open |
| 89 | Filler .bat: `rem (there is no thing. there was never a thing.)` | cut. | open |
| 90 | Filler .json: `"honest": true` | cut. | open |
| 91 | Filler .js: `// it works. do not touch it. / // update (a year): touched it. it no longer works. / // update same day: fixed. DO NOT TOUCH.` | Keep only `// it works. do not touch it.` That's the real trope; the twist and the caps callback are the generated part. | open |
| 92 | Filler .txt notes pick from: `- draft one exists, which is legally a draft.`, `- middle is two bullet points and a promise.`, `- ends mid-sen`, `- stuck the landing, somehow.` | The lists already contain plain options (`- started strong.`, `- middle needs work.`, `- ending TBD.`). Change `- draft one exists, which is legally a draft.` to `- draft one exists.` and delete the other three. | open |
| 93 | Opening a binary in Notepad ends with `[Notepad has done its best. Notepad would like a different job.]` | cut (real Notepad just shows the garbage). | ruled |
| 94 | Terminal `type` on a long file: `… (truncated. the file continues. the file always continues.)` (never shows today: no file in comp is long enough to hit the cutoff) | `… (truncated)`, for whenever a long file exists. | open |
| 95 | File names with a spaced hyphen: `book report - hatchet.docx`, `science fair - does music help plants grow.pptx` (old laptop) | These are how a 6th grader names files, so they read as real. Keep, or `book report (hatchet).docx` if you want the pattern gone everywhere. | open |
| 96 | ECON 200: `pset 3 (redemption arc).pdf` | `pset 3 (retake).pdf` or plain `pset 3.pdf`. | open |
| 97 | C:\Windows\Cursors: `possessed.ani`; Screenshots: `gti run PB 114.png`, `pit lane photo finish.png` | Keep the screenshots. `possessed.ani` was the Edge gag's possessed cursor, which no longer exists in either build (Edge stopped driving on Sep 6, and comp has no Edge), so it now points at nothing. Cut it in both. | open |

## Notepad, Terminal, Settings


| # | now | suggestion | status |
|---|---|---|---|
| 98 | Notepad placeholder: `Start typing. It saves itself.` | keep (it's informative), or `Start typing.` | keep |
| 99 | Notepad Alt+S flash: `✓ Not saved (edit all you want, the disk isn’t listening)` / `✓ Saved (it always is)` | `Not saved` / `Saved` (the file isn't actually read-only, edits just don't persist) | mostly ruled |
| 100 | Notepad window title `Untitled — Notepad` and `X — Notepad` (em dash). Screen readers also hear it in the find box's label, `Find in Untitled — Notepad`. | Real Windows 11 Notepad writes `Untitled - Notepad`. Since you count a spaced hyphen as an em dash, the other option is `Untitled · Notepad`, or just `Notepad` for an untitled file. Your call (it's in the open questions). | open |
| 101 | Terminal banner: `UreOS 11 [Pixel Edition]  ·  type 'help' to get around.` | keep. | keep |
| 102 | Terminal `dir` footer: `N item(s). they are all load-bearing.` | `N item(s)` | open |
| 103 | Terminal `cd ..` at the top: `you are already as up as it gets.` | `Already at the root.` | open |
| 104 | Terminal `del`: `use the Recycle Bin like a civilized person.` / `del what? (no. either way, no.)` | `Access is denied.` with a file, `The syntax of the command is incorrect.` with nothing (both real cmd lines). | open |
| 105 | Terminal `sudo`: `nice try. this is a personal machine.` and `rm`/`format`: `absolutely not.` | Drop the sudo special case so it falls through to the shell's own `ure-sh: command not found: sudo`. `rm`/`format`: `Access is denied.` | open |
| 106 | Terminal `gti`: `silver MK8 VW GTI, callsign "Argent". runs the FSAE money and the back roads.` | `silver MK8 GTI, "Argent".` | open |
| 107 | Terminal `open` errors: `open what? try: open notepad, or open a file that is sitting right here` / `nothing here by that name. 'dir' shows what is.` | `open what? try: open notepad` / `nothing here by that name.` | open |
| 108 | Terminal `help`: `paths work like you hope: cd C:\Windows\System32 · cd .. · cd ~` and `keys`: `... Alt+L clears me` | Borderline. `paths: cd C:\Windows\System32 · cd .. · cd ~` and `Alt+L clears the screen`. | open |
| 109 | Terminal `tree` overflow: `… the tree keeps going. pixel budget does not.` | `… (truncated)` | ruled |
| 110 | Terminal `neofetch`: `Uptime: since you got here` | Make it a real number counted from page load (`Uptime: 4 mins`). Same fact, no wink at the reader. | open |
| 111 | Settings > Personalization: `The whole system follows this. Isaac ships with URE Red.` | `Default: URE Red.` | open |
| 112 | Settings > Personalization, under Regenerate Bloom: `A fresh pixel Bloom, rendered on the spot.` | Borderline. The button redraws the same Bloom at the current window size, so `Redraws the wallpaper at the current window size.`, or drop the hint. | open |
| 113 | Settings > Taskbar hint: `Shift+F11 anywhere does the same thing. For one window instead of the whole page, press F11 — or use the ⛶ button in its title bar.` (em dash) | `... press F11, or use the ⛶ button in its title bar.` | ruled |
| 114 | Settings > Taskbar shortcuts: Alt+Enter `the same, the way games have always done it` (and the shortcut card's `Alt+Enter: The same thing, the game way`) | `Same as F11` in both. | open |
| 115 | Settings > System: `Installed RAM: 640 KB (ought to be enough)` / `System type: pixel-bit operating system` / `Pen and touch: thumbs supported` / `Version: 26H (the room)` / `Installed: the day you visited` | `640 KB` / `64-bit operating system` / `Touch support` / `26H2` / today's date, formatted the Windows way. | open |
| 116 | Settings > About: `The computer is a corner of isaacure.com — a pixel Windows 11 built as the hub for Isaac’s stuff. Made with vanilla JS, a canvas Bloom, and no frameworks.` (em dash) | `The computer is a corner of isaacure.com: a pixel Windows 11 built as the hub for Isaac’s stuff. Vanilla JS, a canvas Bloom, no frameworks.` | mostly ruled |
| 117 | Settings > Accounts (new on Sep 15, opened from Start's account flyout): `The only account on this machine. Sign out and you sign back in as him.` / Sign-in options `Password: none (it’s a website)` / `PIN: not set` / `Windows Hello: recognizes exactly one face` / Lock hint `The lock screen, then the sign-in tile. Signing in is one click; there is no password to type.` / Sign out hint `You come back to everything where you left it.` | Cut the first line. Sign-in options the way Windows lists them: `Password: Not set` / `PIN (Windows Hello): Not set` / `Facial recognition (Windows Hello): Not set up`. `(it’s a website)` says the machine is fake, and `recognizes exactly one face` is a quip. The two hints are plain and fine. | open |
| 118 | The fake OS's name: `UreOS 11 Pixel Edition` (Settings > System and neofetch) and `UreOS 11 [Pixel Edition]` (Terminal banner), plus neofetch's `Theme: Pixel Fluent` | It's the product name, so I'd keep it; Windows editions have names like this (`Windows 11 Home`). If you want it gone: `UreOS 11 Home`. If it stays, the other "pixel" names stay with it: Chrome's `Pixel (system)` theme and neofetch's `Theme: Pixel Fluent`. | open |

## Chrome and the fake web


The isaacure.com page is now your real root page copied over line for line (Sep 6), and riceracing.org is the team's real site (Sep 17), so neither has anything to cut apart from the rows below.


| # | now | suggestion | status |
|---|---|---|---|
| 119 | Incognito new tab: `Chrome won’t save your history here. From whom, Isaac? This machine only visits your own website.` / `What Incognito does: nothing gets written to chrome://history.` / `What it can’t do: hide the GTI RUN high score. That’s public.` | Chrome's current copy: `Others who use this device won’t see your activity, so you can browse more privately.` / `Chrome won’t save the following information:` then `Your browsing history · Cookies and site data · Information entered in forms`. Cut the GTI line. | open |
| 120 | Voice search icon tooltip: `Voice search (it can only hear pixels)` | `Search by voice` (Google's actual tooltip) | ruled |
| 121 | Customize Chrome toast: `This Chrome is already customized. It’s pixels.` | no toast. | ruled |
| 122 | Add shortcut toast: `Star a page to bookmark it — the shortcuts follow.` (em dash) | `Star a page to add it here.` | ruled |
| 123 | Search snippet for "dino": `You appear to be looking for the dinosaur. He is employed here.` | Cut the sentence. The card already has a `chrome://dino` heading and a `Play the dino game` link. | open |
| 124 | Clicking Images/Videos/News/Maps tabs: `X results: also pixels, but sideways.` | no toast. | ruled |
| 125 | Results count: `About N Wikipedia results — plus live GitHub and Hacker News` (em dash) | `About N results (0.42 seconds)`, Google's own format. Nobody needs to be told where results come from. | ruled |
| 126 | Calculator answer status: `Answered without touching the network.` | cut. Google's calculator card shows no status. | open |
| 127 | isaacure.com/ureboy: `This page is a whole console.` / `The browser inside the computer can’t also hold the Game Boy. Physics.` | `URE BOY runs full screen.` with the button. | open |
| 128 | isaacure.com/1p: `The room is out there.` / `Leaving the desktop to walk to the desk you are sitting at raises questions.` | `The room runs full screen.` with the button. | open |
| 129 | isaacure.com/comp (the recursion page): tab title `the computer (recursion)`, `You are already here.`, `This browser runs on the desktop this page would load. Going deeper voids the warranty.`, button `Go deeper anyway`, toasts `Recursion level N. The Bloom is watching.` and `Stack overflow averted. Please enjoy the desktop you already have.`, button ends as `No.` | Keep the nested frames, `You are already here.`, the button, and `No.` Cut `voids the warranty`, `The Bloom is watching`, and the stack-overflow toast (just let the button die). Tab title `the computer`. | open |
| 130 | GitHub page description: `Rice ’29. One repo that keeps growing rooms. Commit messages in “Area: what and why” or else.` | Gone: the made-up profile was replaced by a live copy of the real github.com/IsaacUre, which has no description, header line or private repos to show. | gone |
| 131 | GitHub header: `Rice ’29 · Mathematical Economic Analysis · builds operating systems by accident` | Gone: the made-up profile was replaced by a live copy of the real github.com/IsaacUre, which has no description, header line or private repos to show. | gone |
| 132 | GitHub repo blurb: `isaacure.com — URE BOY, three rooms, a pixel Windows 11, and now a browser inside the browser.` (em dash) | Gone: the repo's description now comes from GitHub, which says `Website`. | gone |
| 133 | GitHub private repos: `fsae-financing` / `Spreadsheets. So many spreadsheets.` and `dm-notes` / `If my players find this repo the campaign is over.` | Gone: the made-up profile was replaced by a live copy of the real github.com/IsaacUre, which has no description, header line or private repos to show. | gone |
| 134 | Search results page: the local results are grouped under a header `From isaacure.com` | Borderline. It tells you the Gmail, Wikipedia and Thresher pages are this site's own. Google has result modules like the Wikipedia and Hacker News sections below it, but it never labels results as coming from one site, so drop this header and let these lead as ordinary results. | open |
| 135 | Search results tab title: `X - Google Search` | This is Google's real format, spaced hyphen and all. Same question as Notepad's title: keep the real format, or `X · Google Search`. Separate bug while you're there: with the engine set to URE Search the tab reads `X - URE Search Search`, because the engine name already ends in Search and the title adds it again. | open |
| 136 | Tooltip on the `● live` chip (search results and live pages): `Fetched from the real site just now` | `Fetched just now` | ruled |
| 137 | Wikipedia GTI article: `practical enough for errands, quick enough to make errands optional.` | keep. | keep |
| 138 | Wikipedia GTI: `The eighth generation pairs a 2.0L turbocharged inline-four with opinions about touch controls. Enthusiasts report the chassis forgives what the infotainment does not.` | `...with widely criticized touch controls. Enthusiasts report the chassis forgives what the infotainment does not.` Second sentence is a real enthusiast take; keep it. | open |
| 139 | GTI Wikipedia search snippet: `The Volkswagen Golf GTI is a hot hatch. One particular silver MK8, designated “Argent”, has achieved local notability.` and the article's See also link `GTI RUN (video game)` | Keep both, or swap the snippet for the article's own first sentence, the way Google pulls it: `The Volkswagen Golf GTI is a hot hatchback produced since 1976.` `has achieved local notability` nods at Wikipedia's notability rule rather than being something Wikipedia would say. I'd keep the See also link either way; it's a quiet cross-reference. | open |
| 140 | Wikipedia GTI: `is maintained by an undergraduate economist. It has appeared in one (1) arcade game, one (1) management sim, and one (1) CRPG as a party member.` | `...It has appeared in an arcade game, a management sim, and a CRPG.` | open |
| 141 | Wikipedia GTI infobox: `Top speed: redacted per mom` and `Best example: Argent (silver, MK8)` | `Top speed: 155 mph (limited)`. Keep `Best example`, that's the article's whole reason to exist. | open |
| 142 | Thresher description: `Photo desk currently overstaffed by one very keen sophomore.` | cut. | open |
| 143 | Thresher masthead: `Est. 1916 · Houston, Texas · student-run since before your major existed` | `Est. 1916 · Houston, Texas` | open |
| 144 | Thresher lead: `“We can afford exactly one wing,” said the team’s financing lead, who asked to be described as “fiscally undefeated.”` | `...secured its initial budget this week, the team’s financing lead said.` If you like the one-wing bit (it ties to the Gmail invoice), keep the quote and cut `fiscally undefeated`. | open |
| 145 | Thresher A&E: `Local website now contains entire computer` / `Critics call it “recursive” and “a cry for help rendered at 60fps.”` | Keep the headline. `Critics call it “recursive.”` | open |
| 146 | riceracing.org search result title: `Rice Racing — Rice University Formula SAE` (em dash) | `Rice Racing · Rice University Formula SAE` | ruled |
| 147 | riceracing.org, three em dashes: `No experience required — just the willingness to learn and build.` (Join) / `Sponsors make that possible — and get a direct line to a driven, hands-on group of Rice engineers.` (Sponsors) / `Full roster and bios live on the real site — riceracing.org ↗` (Team) | `No experience required, just the willingness to learn and build.` / `Sponsors make that possible, and get a direct line to a driven, hands-on group of Rice engineers.` / `Full roster and bios at riceracing.org ↗`. If the first two are the live site's own words, see the open question on real copy. | mostly ruled |
| 148 | riceracing.org wordmark tooltip `Open the real riceracing.org` and button `Sponsorship on the live site ↗` | `Open riceracing.org` / `Sponsorship at riceracing.org ↗` | ruled |
| 149 | riceracing.org Team tab subteam blurbs, for example Suspension `Kinematics, uprights, and getting the tires to do their job.` | Keep if that's the real site's wording. If it was written for this page: `Kinematics, uprights, and tire setup.` (serial comma, like the other subteam lines) | open |
| 150 | Gmail description: `One (1) unread message. It is from fsae_treasury. It is an invoice.` | `One unread message.` | open |
| 151 | Gmail rows: `INVOICE #0042 — one (1) wing, as discussed` (em dash) / `Your fall assignment (do not reply) (we mean it)` / `RE: newsletter draft — “love the GTI metaphor, cut the other twelve”` (em dash) | `INVOICE #0042: one wing, as discussed` / `Your fall assignment (do not reply)` / subject `RE: newsletter draft` with `love the GTI metaphor, cut the other twelve` as the grey preview text the way Gmail shows a snippet (that line's good). | open |
| 152 | Gmail footer: `This is a museum inbox. The real one is safe, private, and also mostly invoices.` | cut. | ruled |
| 153 | Dino tip: `Press SPACE, ↑, or click to jump. The desert is procedurally hostile.` / restart `Run, pixel lizard, run.` / game over `G A M E  O V E R — space to try again. The cactus sends its regards.` (em dash) | `Press SPACE, ↑, or click to jump.` / on restart put the same tip back (the restart text replaces the game-over text, so it can't just be empty) / `G A M E  O V E R. Space to try again.` | open |
| 154 | Error page: `X doesn’t exist on this machine’s tiny, curated internet.` / `ERR_NAME_NOT_RESOLVED_ (it’s a museum)` | Chrome's real copy: `X’s server IP address could not be found.` / `ERR_NAME_NOT_RESOLVED` | ruled |
| 155 | Offline error: `The real internet didn’t answer` / `X needs the outside world, and the outside world is offline` (or `not picking up`) / `ERR_INTERNET_ACTUALLY_DISCONNECTED` / button `Play the dino — he was built for this` (em dash) | `No internet` / `X couldn’t be reached.` / `ERR_INTERNET_DISCONNECTED` / `Play the dino` | ruled |
| 156 | Rate limited: `GitHub gives anonymous museums 60 requests an hour. They ran out.` | `GitHub allows 60 anonymous requests an hour. This machine has used them.` | ruled |
| 157 | Generic live error: `X answered strangely (err). The real web does that sometimes.` | `X returned an error (err).` | ruled |
| 158 | No such city: `The real atlas has no “X”.` (page and toast) | `No results for “X”.` | ruled |
| 159 | chrome://settings: `isaacoure@gmail.com · Sync is on (trust me)` / theme `Pixel (system) — the only theme` (em dash) / default browser `✓ Finally` / `Version 126.0.pixel.1 (Official Build) (64-bit) (UreOS)` | `· Sync is on` / `Pixel (system)` / `✓` (in comp there's no Edge story for `Finally` to refer to) / a real Chrome version, `Version 126.0.6478.127 (Official Build) (64-bit)`. | open |
| 160 | chrome://settings toasts: `Sync stays on. The cloud is a gist and it loves you.` / `Nearly updated itself mid-sentence. Classic.` / `It all lives on one page here. Museum floor plan.` | `Sync stays on.` / cut / cut | mostly ruled |
| 161 | chrome://history empty: `Your browsing history appears here. It is currently as clean as your conscience.` and clear toast `Browsing data cleared. You were never here. (You were on your own website.)` | `Your browsing history appears here.` / `Browsing data cleared.` | open |
| 162 | chrome://bookmarks empty: `No bookmarks. The star button is right there.` | `No bookmarks yet.` | open |
| 163 | chrome://downloads empty (comp's copy): `Nothing downloaded.` | `Files you download appear here`, Chrome's own line. | open |
| 164 | Wikipedia home: `The free encyclopedia — actually reachable from inside the museum` (em dash) and search-empty `The real Wikipedia has nothing. Impressive, honestly.` | `The free encyclopedia` / `No results.` | ruled |
| 165 | Wikipedia article footer: `Text from the real en.wikipedia.org, CC BY-SA, restyled into pixels. Blue words are real articles — keep clicking.` (em dash) | `Text from en.wikipedia.org, CC BY-SA.` | ruled |
| 166 | Loading skeleton: `Fetching the real X…` / `an actual network request is happening inside the fake computer` | `Fetching X…` and cut the second line. | ruled |
| 167 | Hacker News description: `The actual front page, fetched live. Orange as ever. The comments are real people being confidently wrong in real time.` and footers `Trimmed at 150 comments — the rest live on the real orange site.` / `The real front page, via the Algolia HN API. Story links go where they really go — most will open in a framed window.` (em dashes) | `The front page, fetched live.` / `Trimmed at 150 comments.` / `Via the Algolia HN API. Most story links open in a framed window.` | mostly ruled |
| 168 | GitHub live: description `Type any github.com/user or /user/repo and the API answers for real. Sixty anonymous requests an hour; the museum spends them wisely.` / home `The real API, in pixels` / footers `Stars are real; give them somewhere else.` / `No README the API will admit to.` / `The README refused to decode. Mysterious.` | `Type any github.com/user or /user/repo.` / `api.github.com` (the heading above it already says GitHub) / `Live from api.github.com.` / `No README.` / `Couldn’t load the README.` | mostly ruled |
| 169 | Weather: `X, right now, for real` and footer `If it says rain, blame the sky, not the pixels.` | `X, right now` / cut. | ruled |
| 170 | Framed sites note: `big sites refuse to be framed — if it stays blank, that’s X saying no` (em dash) | `Some sites refuse to load in a frame. If it stays blank, that’s why.` | ruled |
| 171 | Profile toast: `Synced as isaacoure@gmail.com — profile “Isaac (the only one)”.` (em dash) | `Synced as isaacoure@gmail.com.` | mostly ruled |
| 172 | Extensions toast: `URE Blocker: 0 ads blocked. This internet is pure.` | `URE Blocker: 0 ads blocked.` | open |
| 173 | Star on new tab: `The New Tab page is already everyone’s favorite.` | no toast. | open |
| 174 | Incognito toggle toasts: `Incognito: history is off. Your regular tabs are waiting where you left them.` / `Back to regular browsing. The record resumes.` | `New Incognito window` / no toast. | open |
| 175 | Print/Cast/Inspect toasts: `Saved as bloom.pdf to a printer that isn’t real.` / `No devices found. The room’s TV is decorative.` / `Inspected. It’s pixels all the way down.` | `Saved as bloom.pdf.` / `No devices found.` / no toast. | ruled |
| 176 | Search-result and tab titles with em dashes: `The Rice Thresher — student newspaper`, `Gmail — email by Google`, `GitHub — the real one`, `Open-Meteo — real weather`, plus the live pages' tab titles `X — Wikipedia`, `X — Hacker News`, `X — GitHub` (repos and profiles), `X weather — Open-Meteo` | Use each site's real format where it has one: live profiles `login (Name) · GitHub` (the IsaacUre profile already builds its title this way from the API, so today it reads `IsaacUre · GitHub`, as on github.com), live Hacker News items with the story title followed by a vertical bar and `Hacker News` (HN's real format). The rest: `The Rice Thresher · student newspaper`, `Gmail · email by Google`, `GitHub`, `Open-Meteo · weather`, `X weather · Open-Meteo`. Wikipedia (`X - Wikipedia`, which the GTI page already uses) and GitHub repos (`GitHub - owner/repo`) really do use a spaced hyphen, so those two wait on the spaced-hyphen question. | open |
| 177 | Default bookmark: `Golf GTI — Wikipedia` (em dash) | `Golf GTI` (a bookmark name doesn't need the site). Or match the page title, per the spaced-hyphen question. | open |
| 178 | Address-bar suggestion rows: the note after a suggestion is set off with `— ` | Use ` · ` there. | ruled |
| 179 | The search page's unit-conversion answer shows a bare `—` when a number overflows (rare) | Don't show an answer box at all in that case, the way the calculator already handles 1/0; the search just runs normally. | ruled |
| 180 | github.com home page `Try:` chips include `anthropics/claude-code` | Borderline. It's a real repo, but next to `IsaacUre` it reads as a note about how the site was built. Swap it for another real repo you'd plausibly look up, or keep it if that's the point. | open |
| 181 | Search rate-limit note: `X allows only a few anonymous searches a minute — it just hit the limit. Try again shortly.` (em dash) | `X allows only a few anonymous searches a minute. Try again shortly.` | ruled |
| 182 | Fake Wikipedia GTI article: `MK8 (2020–present)` and `1976–present` (en dashes) | Wikipedia itself writes date ranges with an en dash, so this is house style rather than a joke. Keep, or `2020-present` if you want zero dashes. | open |
| 183 | GitHub page, fsae-financing repo chip: `Excel-adjacent · Updated Friday` | Gone: the made-up profile was replaced by a live copy of the real github.com/IsaacUre, which has no description, header line or private repos to show. | gone |

## Reader (PDFs), media player, blue screen


| # | now | suggestion | status |
|---|---|---|---|
| 184 | dyno day.pdf: `DYNO SHEET — ARGENT (MK8 GTI, Stage 1+, IE intake, flex fuel)` (em dash) / `Pull 1: strong. / Pull 2: stronger (the fuel got fancier). / Pull 3: operator grinned, data unusable.` / `Note from tech: "car is healthy. driver keeps saying 'she.' this is normal."` (its intercooler line is in the kept-gags section) | `DYNO SHEET: ARGENT (MK8 GTI, Stage 1+, IE intake, flex fuel)` / `Pull 1: strong. / Pull 2: stronger. / Pull 3: consistent.` / cut the tech note. | open |
| 185 | transcript (unofficial).pdf: `RICE UNIVERSITY — UNOFFICIAL TRANSCRIPT` (em dash) / `[grades redacted by the student, who is being modest in a way that tells you everything]` / `Dean’s note: none. Deans only write when something is wrong.` | `RICE UNIVERSITY` on one line, `UNOFFICIAL TRANSCRIPT` on the next / `[grades redacted]` / cut the dean line. (Your About says GPA 4.00, so the modesty bit contradicts it anyway.) | open |
| 186 | DM screen cheatsheet.pdf: header `BEHIND THE SCREEN — QUICK TABLES` (em dash) and lines `1. If the plan is funny, it works on a 10+.` / `2. If someone nat 20s persuasion against me, start writing the new plot.` / `4. When in doubt: a stranger arrives with a car problem.` (lines 3 and 5 are in the kept-gags section) | `BEHIND THE SCREEN: QUICK TABLES`. Keep 1, 2 and 4. | mostly ruled |
| 187 | Any receipt PDF (filler): `performance part ........ a number`, `shipping (freight, heavy) ... more`, `the confidence it brings .... included`, `core charge ................. refundable, allegedly`, `tax ......................... inevitable`, `TOTAL: worth it`, `warranty void if: asked about` | Make it look like a receipt: real-looking line items with dollar amounts, a subtotal, tax, total. No commentary. | open |
| 188 | Any pset PDF (filler): `Problem 1. Show that the statement is true. (It is. Showing it is your problem.)`, `Problem 2. Consider an agent maximizing utility. The agent is you. The utility is sleep.`, `Problem 3. Prove or disprove. Then prove, because it was true the whole time.`, `Problem 4 (bonus). Left as an exercise for the grader.` | Plain problem statements. If one survives, `Problem 4 (bonus). Left as an exercise for the grader.` | open |
| 189 | Any syllabus PDF (filler): `Week 1–3: hope.`, `Week 4–6: the midterm bends spacetime toward itself.`, `Week 7: reading week (nobody reads. everybody recovers.)`, `Week 8–12: the material accelerates. so do you, eventually.`, `Finals: cumulative, like all consequences.`, `Office hours: yes. Go. They are free and they work.` | Real-looking syllabus lines (topics per week, exam dates). Maybe keep `Office hours: go.` | open |
| 190 | Any rules PDF (filler): `ARTICLE 4.1.2: the part must exist before it is mounted.`, `ARTICLE 7.3: budgets shall be justified line by line, feeling by feeling.`, `ARTICLE 9.9: any team member may say "is it supposed to do that." all work stops.`, `ARTICLE 12: safety wire everything. safety wire the safety wire.` | Real-looking rule numbering and dry text. `safety wire everything.` can stay; cut `safety wire the safety wire.` | open |
| 191 | Any other PDF (filler): `This document is exactly as long as it needs to be, which is a lie all documents tell.`, `The figures referenced herein appear on pages that could not be reached for comment.`, `Further detail is available upon request. Please do not request it.`, `The author reserves the right to have meant something slightly different.`, `This page intentionally left about 80% blank, for gravitas.` | Plain filler (`Section 1. Overview.` and a couple of neutral sentences). | open |
| 192 | Reader / media window titles `X — Reader`, `X — URE Media` (em dashes) | Same spaced-hyphen question as Notepad: `X - Reader` (the real format) or `X · Reader`. | open |
| 193 | Video playback overlay: `NO PIXEL CODEC — AUDIO ONLY` (em dash) | `NO VIDEO CODEC. AUDIO ONLY` | ruled |
| 194 | Blue screen: `Your PC ran into a problem because someone deleted X and needs to restart. We’re just collecting some error info, and then we’re going to sit quietly and think about what happened.` / `For more information about this issue, ask whoever deleted X.` / stop codes include `VIBES_NOT_FOUND` and `SYSTEM_FILE_MISSED_IMMEDIATELY` | The real copy: `Your device ran into a problem and needs to restart. We’re just collecting some error info, and then we’ll restart for you.` / `For more information about this issue and possible fixes, visit https://www.windows.com/stopcode` / keep `What failed: X` (that's what tells you). Stop codes: cut `VIBES_NOT_FOUND`, replace `SYSTEM_FILE_MISSED_IMMEDIATELY` with `CRITICAL_PROCESS_DIED`. | open |
| 195 | After the reboot: `System restored to a moment before you deleted X. You’re welcome.` | `System restored. X was recovered.` | open |

## System-wide bits (Start, toasts, shortcut card, CSS, index.html)


| # | now | suggestion | status |
|---|---|---|---|
| 196 | Power button: `Shutting down…` then `Just kidding. Welcome back.` | Keep `Shutting down…`, fade out and back, then `Welcome` (Windows' own sign-in word). No text at all also works. | open |
| 197 | Shortcut card header: `Alt is this machine’s Ctrl — the real one belongs to your browser` (em dash) | `Alt is this machine’s Ctrl. The real one belongs to your browser.` | ruled |
| 198 | Shortcut card row: `Alt+Enter: The same thing, the game way` | `Alt+Enter: Same as F11` (the Settings copy of this line is in the Settings section). | open |
| 199 | Full-screen window title suffix in comp.css: ` — full screen` (em dash) | ` (full screen)` or ` · full screen` | ruled |
| 200 | index.html meta description: `Isaac Ure's computer — a pixel-art Windows 11 desktop hub.` (em dash) | `Isaac Ure's computer: a pixel-art Windows 11 desktop hub.` | ruled |
| 201 | Taskbar clock and date placeholders in index.html: `—` (shows for a moment before the script fills in the time) | Leave them empty. | ruled |
| 202 | Full-screen toasts: `Full screen. Press F11, or reach for the top edge.` / `The browser turned full screen down.` / `This browser will not give the page the whole screen.` | Keep the first. The other two personify the browser: `Full screen was blocked.` / `This browser doesn't support full screen.` | ruled |

## The gags you said keep (or maybe), comp instances


Chamomile is real, the intercooler is real, Camus stays, the cow is undecided, the sleeping policeman is for later. Every comp instance is here once, with what I'd do under that ruling. The DnD campaign in Documents is your URE QUEST party (Sammy, Malachi, THE BOULDER, THE COW, HEAT SOAK, THE SLEEPING POLICEMAN), so most of these are callbacks to your own game.


### Chamomile (real)

| # | now | suggestion | status |
|---|---|---|---|
| 203 | About app spec row: `Runs on: chamomile, not caffeine` | keep as is. | keep |
| 204 | System32 file `chamomile.sys` | keep. Same kind of quiet filler file as `argent.sys` (row 23 lists them). | keep |
| 205 | MATH 302 `real analysis scars.txt`: `epsilon: arbitrarily small. / delta: depends on epsilon. / me: depends on chamomile.` | keep. It reads like a real note once the tea is real. | keep |
| 206 | Study playlist track `chamomile steep timer.mp3` | keep (row 63). | keep |
| 207 | Thresher sports: `The line judge was chamomile tea.` | cut. Still nonsense even with the tea being real. The other two columns keep a one-line body, so give this one a flat one too: `The tennis club has appealed.` | open |

### The intercooler (real, and canon in URE QUEST)

| # | now | suggestion | status |
|---|---|---|---|
| 208 | DnD `the intercooler arc.txt`: `big bad: HEAT SOAK, tyrant of summer. / the prophecy is a parts list. the quest is an install. / finale: they have to finish the install MID-FIGHT. do not let them know the box has been in the trunk since session 1.` | keep all three lines. `HEAT SOAK, TYRANT OF SUMMER` is the boss's real name in URE QUEST. | keep |
| 209 | `argent service log.txt`: `ARGENT — silver MK8 GTI. full name Argentina Artemis Ure. she earned it.` / `- unitronic stage 1+: done. she pulls now.` / `- IE intake: done. she breathes now.` / `- flex fuel: done. she sips fancy now.` / `- intercooler: purchased. boxed. the box is fine. the box is FINE.` | `ARGENT. silver MK8 GTI. full name Argentina Artemis Ure.` / `- unitronic stage 1+: done` / `- IE intake: done` / `- flex fuel: done` / `- intercooler: bought. still in the box.` The full name is canon (URE QUEST spells it out), so it stays. | open |
| 210 | `intercooler installation plan.txt`: `step 1: open the box. / step 2: (this step intentionally left blank) / / status: pending since purchase. the box and i have an understanding.` | `step 1: open the box. / step 2: / / status: pending since purchase.` | open |
| 211 | `intercooler receipt.pdf` (file name; the contents are the generic receipt filler) | keep the file. Contents per row 187. | keep |
| 212 | Pictures: `the box the intercooler lives in.jpg` | keep (row 62). | keep |
| 213 | `dyno day.pdf`: `Next appointment: after the intercooler leaves the box. (rescheduled x4)` | keep as is (row 184). | keep |
| 214 | DM cheatsheet line 5: `HEAT SOAK monologues until interrupted. He wants to be interrupted.` | `5. HEAT SOAK monologues until interrupted.` (row 186) | open |
| 215 | File names that reference the boss: URE QUEST screenshot `heat soak fight.png`, video `urequest heat soak fight.mp4`, car-songs track `heat soak.mp3` | keep all three. | keep |

### Camus and the boulder (keep)

| # | now | suggestion | status |
|---|---|---|---|
| 216 | System32 file `boulder.sys` | keep, same reasoning as `chamomile.sys` (row 23). | keep |
| 217 | PHIL 104 file `camus response paper.docx` | keep. | keep |
| 218 | PHIL 104 `sisyphus notes.txt`: `the boulder is not the punishment. / the boulder is the routine. the routine is survivable. the routine can even be good. / one must imagine the problem set finished.` | keep the first two lines. The third is the meme format; I'd cut it, but it's yours. | open |
| 219 | DnD `session 3 — the depths.txt`: `the boulder puzzle took 90 minutes. / the party named the boulder. the party now refuses to leave the boulder. / i have written a stat block for the boulder. this is my life now.` | rename to `session 3 (the depths).txt`; keep the first two lines; `i have written a stat block for the boulder.` | open |
| 220 | `THE BOULDER.pdf`: `CHARACTER SHEET — THE BOULDER / / Class: Boulder. Level: yes. / STR 20  DEX 1  CON 20  INT —  WIS 14  CHA 17 / / Skills: Rolling (expertise). Being Pushed (passive). / Personality: content. / Bonds: the hill. the party. the routine. / Flaw: none found. we looked. / / DM note: the party will not leave it behind. stat it or lose the table.` | `CHARACTER SHEET: THE BOULDER`, drop `Level: yes.`, `INT 1` (the 5e floor, matching `DEX 1`), `Flaw: none found.` Everything else stays. | open |
| 221 | DM cheatsheet line 3: `The boulder is CR 0 and morale +5. Do not touch.` | keep (row 186). | keep |
| 222 | `reading list.txt`: `camus — the myth of sisyphus (again) / camus — the stranger (again again) / something about water infrastructure that i will absolutely finish / the FSAE rulebook (573 pages, riveting, five stars)` | `camus, the myth of sisyphus (again) / camus, the stranger (again again) / something about water infrastructure / the FSAE rulebook`. The real rulebook is about 143 pages, so once the exaggeration goes the number would just be wrong. | open |
| 223 | About app tag `absurdist philosophy` | keep. | keep |

### The cow (pending, and canon in URE QUEST)

| # | now | suggestion | status |
|---|---|---|---|
| 224 | URE QUEST `balance.txt`: `nerf the cow? (no. never. the cow stays.)` | stays: `nerf the cow? no.` (a balance note about a real party member) / goes: drop the file. | pending |
| 225 | `npc voices.txt`: `mechanic-oracle: gravel, slow. / ferryman: just my normal voice but sadder. / the cow: i will not do a cow voice. (i did the cow voice.)` | The first two lines stay either way. Cow stays: `the cow: moo.` (all it says in the game, and it fits the format of the other two lines). Cow goes: cut the line. | pending |
| 226 | `the cow.pdf`: `CHARACTER SHEET — THE COW / / Race: cow. Class: cow. / Special ability: STANDS IN GRASS. Nobody asks the cow anything. The cow has achieved what the party seeks. / / DM note: added as a joke in session 2. Now load-bearing to party morale. The cow stays.` | stays: `CHARACTER SHEET: THE COW / / Race: cow. Class: cow. / Special ability: STANDS IN GRASS. Nobody asks the cow anything. / / DM note: added as a joke in session 2. The cow stays.` / goes: delete the file. | pending |
| 227 | Essays `why i wanted to be a cow (age 7, recovered).txt`: `RECOVERED FROM THE OLD LAPTOP. PRESERVED VERBATIM. / / when i grow up i want to be a cow because cows get to stand in the grass all day and nobody asks them anything. / / (editor’s note, age 19: the kid had a point.)` and the college brainstorm line `- the cow essay?? too honest` | Cow stays: keep only the kid's line, and keep the brainstorm line (URE QUEST's cow is quoting the essay). The RECOVERED header repeats the file name and the editor's note explains the joke. One thing to settle: URE QUEST says the plan was made at four, the file name says seven. Cow goes: delete the essay and the brainstorm line. | pending |

### The sleeping policeman (later)

| # | now | suggestion | status |
|---|---|---|---|
| 228 | GTI RUN readme.txt: `hold A to not die. the sleeping policeman is not sleeping.` | Stays: keep the file as is. It nods at URE QUEST's Hedges road boss rather than anything in GTI RUN, which is fine for a readme sitting next to it. Goes: `GTI RUN. / hold A to not die.` (A really is boost in GTI RUN.) I'd keep it. | pending |
| 229 | DnD `session 2 — hedges road.txt`: `random encounter table came up "sleeping policeman" and no one was ready.` | I'd keep it. It's the same fight as the game: URE QUEST's own rumour line is `something sleeps on the Hedges road. Do not hit it at speed.`, and this is the hedges road session. If he goes, cut the line and keep the malachi one (row 58). | pending |
| 230 | Car-songs track `sleeping policeman (remix).mp3` | stays: keep, same as `heat soak.mp3` (row 215) / goes: cut (row 63). | pending |
| 231 | Fonts preview sentence: `The quick silver GTI jumps the sleeping policeman. 0123456789` | Stays: keep yours, it's a nice hidden one. Goes: the line Windows' own Font Viewer uses, `The quick brown fox jumps over the lazy dog. 1234567890`. I'd keep it. | pending |

# Tier 2: /tcomp/ only

Things only the testing build has: Steam, Edge, the Chrome Setup wizard, the Minecraft Launcher, and the lore files that left comp with the games.


## Files that only tcomp has


These are the lore files that left comp with the games (CLAUDE.md lists them) and come back with them.


| # | now | suggestion | status |
|---|---|---|---|
| 232 | Downloads empty (tcomp's copy): `Nothing downloaded yet. Edge has one (1) idea.` (comp's copy already reads `Nothing downloaded yet.` and has its own Tier 1 row) | `This folder is empty.`, same as comp. | open |
| 233 | Steam libraryfolders.vdf label: `"label"		"the one drive that matters"` | blank label (real Steam leaves it empty) or `"main"`. | open |
| 234 | Terraria\Content\Images empty: `Every tree you have ever chopped, as .xnb files.` | cut. | open |
| 235 | VEILFALL story.txt: `[this file intentionally left blank] / / (the writer says it is coming. the writer says it will be short but sweet. the dummy waits.)` | `[this file intentionally left blank]` only. | open |
| 236 | NINTH NIGHT readme.txt: `NINTH NIGHT — proof of concept.` | `NINTH NIGHT. Proof of concept.` The ballad.txt note and `nothing rhymes with sword. this is deliberate.` are in the game's own voice; keep those. | ruled |
| 237 | minecraft worlds backup\the good seed.txt: `seed: 4-1-1-4 / village at spawn. do not lose this again.` | keep. | keep |
| 238 | the secret.txt, tcomp's copy: `there was never anything in here. / the folder was the friend we made along the way. / / (also the good minecraft seed is 4-1-1-4, in case the other note is gone.)` | `there was never anything in here. / / (the good minecraft seed is 4-1-1-4, in case the other note is gone.)` | open |
| 239 | Terraria worlds: `hardcore attempt 3 (RIP).wld`; Screenshots: `cookie clicker 1 trillion.png` | keep, they're things a real save folder would have. | keep |

## Edge (the Chrome-install gag)


On Sep 6 Edge stopped driving itself: nothing moves on its own now, every address just resolves to google.com/chrome. That removed the old toasts and address-bar suggestions, but most of the copy on the pages stayed.


| # | now | suggestion | status |
|---|---|---|---|
| 240 | Welcome page: `The last browser you’ll ever need.* Fast, secure, and already set as your default.` with footnote `*Results guaranteed.` (it used to say "not guaranteed") | `Fast, secure, and already set as your default.` Cut `The last browser you’ll ever need.` along with the asterisk and the footnote: the headline only exists to set up the footnote, and without it the line reads like Edge's own welcome copy, which is enough for the Edge joke. | open |
| 241 | Welcome cards: Import favorites `Bring your stuff over from that other browser.` / Set as default `✓ Already done for you.` / Get started `Just start browsing. Try the address bar ↑` | `Import from another browser.` / `✓ Edge is your default browser` / keep the third. | open |
| 242 | Bing results count: `About 4,120,000,000 results · we get it, everybody does this` | `About 4,120,000,000 results` (it's styled as Bing, and Bing shows no timing) | open |
| 243 | First result blurb: `Get the fast, free web browser everyone on this machine was going to install anyway. Now on UreOS 11.` | Google's real copy: `Get more done with the new Google Chrome. A more simple, secure, and faster web browser than ever.` | open |
| 244 | Third result: `Microsoft Edge — wait, are you sure? You can stay.` / `We’ve changed. We have coupons now. Please don’t do this.` at `microsoft.com › edge › please` (em dash) | Microsoft's real Bing interstitial for a "chrome" search is drier and funnier because it's real: title `Microsoft Edge`, blurb `Microsoft Edge runs on the same technology as Chrome, with the added trust of Microsoft.` If you want exactly one wink, keep `› please` in the URL and nothing else. | mostly ruled |
| 245 | Chrome download page: `The browser built to be yours` / `Fast. Secure. Yours. And, crucially, not Edge.` | Keep the heading (that one is Google's real headline) and cut the sub line entirely, which is what the real page does. | open |
| 246 | The redirect mechanic's own copy on the fake Bing page: `Including results for chrome install. Search only for X?` / `No results for X. Showing results for chrome install.` / the snippet `X works best in Google Chrome. Download Chrome to continue.` / People also ask `Can I keep using Microsoft Edge?` / address-bar suggestions `X in google chrome` and `chrome install [Trending]` | Keep. This is the Edge gag itself. To match Bing word for word, its notice asks `Do you want results only for X?` rather than `Search only for X?` (that's Google's phrasing; from an old write-up, since I couldn't reach a live Bing page). | keep |
| 247 | Fake Bing result titles with em dashes: your own query's result `X — best experienced in Google Chrome` and the ad `Google Chrome — Download the Fast, Secure Browser` | `X` alone for the first (the snippet under it already says Chrome). The ad copies Google's own title, which Google writes with a spaced hyphen, so it goes with the spaced-hyphen question: `Google Chrome - Download the Fast, Secure Browser` or `Google Chrome · Download the Fast, Secure Browser`. | mostly ruled |
| 248 | Titles written with a spaced hyphen, the way the real sites do it: the Bing tab `X - Search`, the Wikipedia result `Google Chrome - Wikipedia`, the download page's tab `Google Chrome - Download the fast, secure browser from Google` | Same open question as Notepad's title: keep the real format or use a middle dot. | open |
| 249 | Chrome download page fine print: `For Windows 11 · UreOS Pixel Edition · 64-bit` | `For Windows 11/10 64-bit.`, Google's own line. It names the Windows version and never an edition, so it works however the `UreOS 11 Pixel Edition` question lands. | open |

## Chrome pages and settings only in tcomp


| # | now | suggestion | status |
|---|---|---|---|
| 250 | Steam website description: `Why browse the website? This machine has the client installed. It has your library, your points, and your friends.` and page `The website is just the app with more cookies. Opening the real thing:` | `This machine has the client installed.` / cut the paragraph (the heading `You have Steam installed.` and the button already say it). | open |
| 251 | chrome://settings default-browser card: row `Microsoft Edge` with button `Console it`, and its toast `Edge has been consoled. It says it understands.` | Cut the Edge row and the toast. | ruled |
| 252 | chrome://downloads empty (tcomp's copy): `Nothing downloaded. The Edge gag usually leaves a ChromeSetup.exe here — that’s how you got me.` (em dash) | `Files you download appear here`, Chrome's own line (the same wording the comp row proposes; comp currently reads `Nothing downloaded.`). | mostly ruled |
| 253 | Search-result titles only in tcomp: `Steam — the game store`, `Minecraft — official site` | `Steam · the game store`, `Minecraft · official site` | ruled |

## Chrome Setup wizard


| # | now | suggestion | status |
|---|---|---|---|
| 254 | EULA header: `UreOS 11 Pixel Edition · one (1) user: isaac` | `UreOS 11 Pixel Edition · user: isaac` | open |
| 255 | EULA clause 1: `By installing Google Chrome you agree to stop pretending you were ever going to keep using Edge.` | cut (and renumber whatever survives, the numbers are typed into the text). | open |
| 256 | Clause 2: `Chrome may use some of your memory. Chrome may use all of your memory. Chrome does not recognize the distinction.` | Keep the first two sentences, cut the third. | open |
| 257 | Clause 3: `You will open tabs. The tabs will multiply. There is no support for this and there never will be.` | cut. | open |
| 258 | Clause 4: `The address bar is also a search bar. There has only ever been one bar.` | cut. | open |
| 259 | Clause 5: `Any telemetry collected is anonymized, aggregated, and honestly not that interesting: you visit isaacure.com and you play GTI RUN.` | cut. | open |
| 260 | Clause 6: `In the event of a dispute, both parties agree to settle it in URE QUEST. Best of one. No healing potions.` | cut. | open |
| 261 | Clause 7: `Microsoft Edge will remain installed, quietly, for emergencies. It knows what it did.` | `Microsoft Edge will remain installed.` | ruled |
| 262 | Clause 8: `Clause 8 was removed for morale reasons.` | cut. | open |
| 263 | Clause 9: `Updates will install themselves whenever they feel like it, usually mid-sentence.` | `Updates install automatically, usually mid-sentence.` | open |
| 264 | Clause 10: `This agreement is governed by the laws of UreOS, which are mostly vibes.` | `This agreement is governed by the laws of UreOS.` | open |
| 265 | EULA footer: `Scroll complete. You are legally unstoppable.` | cut. | open |
| 266 | Progress lines: `Unpacking a faster browser…`, `Uninstalling Bing…`, `Importing 0 favorites…`, `Setting Chrome as default…`, `Reserving RAM (all of it)…`, `Tidying the Start menu…` | `Unpacking…`, keep `Uninstalling Bing…`, keep `Importing 0 favorites…`, keep `Setting Chrome as default…`, `Reserving RAM…`, keep `Tidying the Start menu…`. | open |
| 267 | Progress file names: `ram_reservation.bin`, `not_edge.manifest`, `gti_easter_egg.rom`, `sync_isaac.json` (alongside real-looking `chrome.exe`, `bloom.pak`, `tabs64.dll`, `omnibox.dat`) | Cut `ram_reservation.bin`, `not_edge.manifest`, `gti_easter_egg.rom`. Keep the rest. | open |
| 268 | Welcome step: `This will install Google Chrome on your computer. You were always going to do this; the wizard just makes it official.` | Cut the second sentence. | open |
| 269 | Welcome step: `It is recommended that you close Microsoft Edge before continuing. It took the download surprisingly well, but it shouldn’t have to watch this part.` | `It is recommended that you close all other applications before continuing.` (the stock Inno Setup wizard line this screen is modeled on) | ruled |
| 270 | Welcome step: `Click Next to continue, or Cancel to keep living like this.` | `Click Next to continue, or Cancel to exit Setup.` | open |
| 271 | License step: `Please read the following important information. Nobody ever has, but please.` | `Please read the following important information before continuing.` | open |
| 272 | Declining the license: `That’s fine. Edge is thrilled. (Next stays off until you accept.)` | `You must accept the agreement to continue.` | ruled |
| 273 | Options: `Set Chrome as the default browser (this one isn’t optional, sorry)` | `Set Chrome as the default browser` (the disabled checkbox already says it). | open |
| 274 | Options: `Space required: 640 KB · Space available: yes` | `Space required: 640 KB` | open |
| 275 | Installing: `Please wait while the wizard does the only thing Edge was ever used for.` | `Please wait while Setup installs Google Chrome on your computer.` | open |
| 276 | Finish: `Google Chrome has been installed on your computer. The desktop feels faster already. That’s placebo, but enjoy it.` | Cut the second and third sentences. | open |
| 277 | Cancel mid-install: `Cancel Chrome installation?` / `Are you sure? Somewhere, Edge just perked up.` | `Setup is not complete. If you exit now, the program will not be installed.` | ruled |
| 278 | Browse button: `It goes in Program Files. It has always gone in Program Files.` | `Chrome installs to Program Files.` | open |
| 279 | Finish toasts: `Google Chrome installed — welcome home.` (em dash, also used by the Edge gag) / `Chrome installed. It waits patiently in the taskbar.` | `Google Chrome installed.` / `Chrome installed.` | ruled |

## Steam


| # | now | suggestion | status |
|---|---|---|---|
| 280 | Store home: `Special Offers` / `Weekend Deal — the sale ends when Isaac says` (em dash) | `Special Offers` alone, like you said. | ruled |
| 281 | Store home: `Under $10` / `big games, small numbers` and `From URE Softworks` / `made upstairs` | `Under $10` and `From URE Softworks`, no subtitles. (`Because you play Factorio` is Steam's format, but Steam says `Because you played`.) | open |
| 282 | GTI RUN blurb: `A hand-built arcade racer for the URE BOY. One car, one road, infinite nerve. Every near-miss banks boost; every wreck resets the clock. Built by Isaac on a 160×144 backbuffer.` | Cut `infinite nerve`: `One car, one road.` Rest is fine. | open |
| 283 | GTI RUN reviews: `Isaac made this in his dorm and it slaps.` / `My actual GTI is jealous.` | `Made in a dorm. It's good.` / cut. | open |
| 284 | PIT LANE short: `Call the strategy from the wall. Tyres, fuel, undercuts — win the race you never drive.` (em dash) | `...Tyres, fuel, undercuts. Win the race you never drive.` | ruled |
| 285 | URE QUEST blurb: `A tiny turn-based CRPG for the URE BOY with a DM's heart. Reworked in the big PR #44 that finally made the GTI's name canon.` The short description `A pocket CRPG. Roll initiative, mind your MP, and find out who Argent really is.` and the DLC row `The Argent Saga` | `A tiny turn-based CRPG for the URE BOY.` The short description and the DLC row are callbacks to your own game; keep both. | open |
| 286 | VEILFALL short: `An isometric ARPG in Early Access. One arena, nine spells, one very patient dummy. The story isn't written yet. The violence is.` | `An isometric ARPG in Early Access. One arena, nine spells, a training dummy.` | open |
| 287 | VEILFALL blurb: `...flasks that refill on violence, ... a training dummy with configurable resistances and infinite forgiveness. Bring opinions about cast speed. Early Access roadmap: 'a short but sweet intriguing story' — the writer has been informed.` (em dash) | `...flasks that refill on kills, ... a training dummy with configurable resistances.` Cut the last two sentences. | open |
| 288 | VEILFALL news: `v0.1 — the proving grounds` (em dash) / `VEILFALL enters Early Access with a test arena, nine spells and a dummy that respawns with fresh optimism. The story arrives when it arrives. The meteor arrives in 1.1 seconds.` | `v0.1: the proving grounds` / `VEILFALL enters Early Access with a test arena, nine spells and a training dummy.` | open |
| 289 | NINTH NIGHT news title: `v0.1 — proof of concept` (em dash) | `v0.1: proof of concept`. The NINTH NIGHT store text itself is in the game's voice and is good; leave it. | ruled |
| 290 | Cookie Clicker short: `An idle game about baking cookies. Click the cookie. Employ grandmas. Question nothing.` | `Click the cookie. Buy grandmas.` | open |
| 291 | Cookie Clicker blurb: `...and an ascension formula you will do actual math about. Your grandmas keep the ovens on while the window is open.` | `...and the real ascension formula. Production keeps running while the window is open.` | mostly ruled |
| 292 | Cookie Clicker news: `v1.0 — the UreOS port` (em dash) / `...Achievements sync to this very Steam client. The grandmas came with the port; we did not ask them to.` | `v1.0: the UreOS port` / cut the grandma sentence. | open |
| 293 | SUNSET RUNNER blurb: `The GTI RUN sequel UreOS deserved, running in a live window.` | `The GTI RUN sequel, running in a window.` | open |
| 294 | SUNSET RUNNER reviews: `It runs IN the Steam that runs IN the website. I had to sit down.` / `Won the title on the last corner of Storm Harbor. Yelled out loud.` | cut the first, keep the second. | open |
| 295 | SUNSET RUNNER news titles: `v1.1 — the season update` / `v1.0 — on the grid` (em dashes) | `v1.1: the season update` / `v1.0: on the grid` | ruled |
| 296 | Baldur's Gate 3 blurb: `Mind flayers, moral rot, and a thousand ways to fail forward. The DM in Isaac never stood a chance against this one.` | Keep the first sentence, cut the second. | open |
| 297 | Factorio blurb: `A game about spaghetti becoming a cathedral. Made for a systems-and-optimization brain that cannot leave a bottleneck alone.` | Keep the first sentence, cut the second. | open |
| 298 | Satisfactory blurb: `Factorio's philosophy at eye height. Isaac walks his own main bus here and calls it cardio.` and short `...building massive factories — in first person, at conveyor level.` (em dash) | `Factorio's philosophy at eye height.` / `...building massive factories, in first person, at conveyor level.` | mostly ruled |
| 299 | Slay the Spire blurb: `Every run is a math problem wearing a fantasy costume. Isaac's kind of costume party.` | Keep the first sentence, cut the second. | open |
| 300 | Tabletop Simulator blurb: `The DM's remote toolkit. Isaac's dice tower is modded, his battle maps are labeled, his players still ignore the plot hooks.` | `The DM's remote toolkit.` | open |
| 301 | The Witcher 3 blurb: `The sidequests out-write other games' main plots. Gwent is a load-bearing minigame.` | `...Gwent is its own game.` | open |
| 302 | Rocket League blurb: `Car soccer. Somehow the most stressful sport ever invented. Free, so no excuses.` | Cut `Free, so no excuses.` | open |
| 303 | F1 Manager blurb: `Basically PIT LANE with a licensing budget. Isaac built his version first — this is opposition research.` (em dash) | `PIT LANE with a licensing budget.` | open |
| 304 | Dyson Sphere Program blurb: `Factorio, but the factory eventually eats a sun. The logical endpoint of Isaac's whole personality.` | Keep the first sentence, cut the second. | open |
| 305 | Terraria blurb: `2D Minecraft's cooler older sibling, ported to run IN a window on this desktop: a real generated world of biomes — forest, snow, desert, jungle, corruption, ocean shores and floating islands over an ash-and-hellstone underworld — with flowing water and lava, ...` (two em dashes) `...Isaac's 94 hours came with the shelf copy; yours count from here.` | `...ported to run in a window on this desktop: a real generated world of biomes (forest, snow, desert, jungle, corruption, ocean shores and floating islands over an ash-and-hellstone underworld) with flowing water and lava, ...` Cut the 94 hours sentence. | open |
| 306 | Terraria news: `v2.0 — the deep port` (em dash) / `...and the Guide who did (eventually) survive the port after all.` | `v2.0: the deep port` / `...and the Guide.` | open |
| 307 | Elden Ring blurb: `A open world that does not respect your time and is better for it.` (also Outer Wilds short `A open-world mystery`) | Typo: `An open world...` / `An open-world mystery...` | fix |
| 308 | The real games on the shelf (about 26). Each store page has a short line at the top and an About text. Most short lines are already the game's real Steam description, but six add a joke: Portal 2 `Think with portals. The best comedy duo in games is a rogue AI and a potato battery.`, Kerbal Space Program `Build a rocket out of parts and hope. Fly little green optimists to places they should not go.`, Civilization VI `Build an empire to stand the test of time. One. More. Turn.`, Papers, Please `Glory to Arstotzka. A border checkpoint, a stamp, and your slowly compressing soul.`, Vampire Survivors `...Cheap as chips, sharp as garlic.`, Assetto Corsa `...The sim racer's sim racer.` The About texts are opinionated one-liners, for example Hollow Knight `A kingdom of bugs with better worldbuilding than most trilogies. The map seller is doing his best.` and Stardew Valley `One human made this entire game. The most relaxing 200 hours you'll never notice passing.` | Last time I said leave all of these. Your "use the real product's line" rule changes that for the six short lines: trim each back to the game's real description. For the About texts: (a) replace each with the game's real About copy (long on Steam), (b) drop the About line so the box shows just the real short description, or (c) keep them as your takes on games you like, since none of them winks at the site. Your call on the About texts. | open |
| 309 | The only two real games with their own store-page reviews: Baldur's Gate 3 `“I role-played a bard for 60 hours and have no regrets.”` / `“Failed a persuasion check and it made the game better.”` and Factorio `“Told my roommate I'd play for 20 minutes. Sunrise disagreed.”` / `“I have restructured my main bus four times. Send help.”` | keep. Jokey user reviews are how real Steam reviews read, so these are faithful copy. | keep |
| 310 | Patch note `Patch 8 — the last big one` (em dash) and `1.1 — vertical logistics` (em dash) | `Patch 8: the last big one` / `1.1: vertical logistics` | ruled |
| 311 | Steam Deck notes: `Verified — it IS a handheld` (three URE games) / `Unsupported — anti-cheat` / `Playable — keyboard advised` / `Playable — small text` / `Playable — bring reading glasses` (all em dashes) | The badge already prints `Steam Deck Verified` / `Playable` / `Unsupported` in bold above the note, so the note should be a short flat second line: `Fully functional` / `Anti-cheat not supported` / `Keyboard advised` / `Small text` / `Small text` | mostly ruled |
| 312 | Curator line: `X — a curator you follow — says: “...”` (two em dashes) | `X · Recommended: “...”`, which is closer to how the real client shows a followed curator (name, a Recommended badge, their line). | ruled |
| 313 | Curator blurbs: `We measured. It is optimal.` / `Meaningless, and therefore essential.` / `Approved for rig night.` / `Fits in 160×144 of your heart.` / `Our DM cried. Ten out of ten.` | Keep the first three. `Fits in 160×144.` / `Ten out of ten.` | open |
| 314 | Shared reviews for games without their own: only the first two ever show, `Ran it on a potato. Ran beautifully.` and `Came for the mechanics, stayed for the existential dread.` The other four (`My wallet says no. My library says yes.`, `10/10 would optimize again.`, `Not enough cars. (There are four hundred cars.)`, `Told myself one more turn. It is now dawn.`) never display. | Keep `Ran it on a potato. Ran beautifully.` and delete the other five, so games without their own reviews show just that one. If you want two, the second has to fit any genre, since the pair shows on about 40 store pages (Counter-Strike 2, Forza, Celeste...). | open |
| 315 | Friend chat lines: throttle_body `dude the new GTI RUN update is so good` / `argent looking CLEAN in the last pic 🔧`; nat20nate `my bard just seduced the lich. again.`; spaghetti_bus `sleep is a bottleneck, isaac`; fsae_treasury `we can afford exactly one (1) wing` (chamomile's lines are in the kept-gags section) | All fine as chat except drop the `(1)`. The rest of the canned lines (`box box box`, `the bus. it grew.`, `roll initiative`, `wanna run laps later?`, `invoice approved`, and the others) are fine too. | open |
| 316 | Points Shop: `earned by existing. spent on looking good.` / `equipping actually restyles your profile` | cut both hints. | open |
| 317 | Animated avatar item: `Owned. It blinks.` / toasts `It blinks. Trust me.` / `It blinked. You saw it.` / menu `Inspect closely` | Card `Owned`, purchase toast `Purchased`, cut `Inspect closely` and its toast (and don't open an empty right-click menu on it). | open |
| 318 | Points toasts: `Not enough points. Go earn XP. (You can't. That's the joke.)` / `X — equipped. Check your profile.` (em dash) / `X — unequipped. The profile mourns.` (em dash) | `Not enough points.` / `X equipped.` / `X unequipped.` | ruled |
| 319 | Library achievements filler: `Unlocked — nice.` (em dash) | `Unlocked` | ruled |
| 320 | Library news fallback: `X — you own this` (em dash) / `It's in your library and ready when you are.` | `No recent updates.` | mostly ruled |
| 321 | Achievements page: `This game has no achievements. It respects your time. Suspicious.` (probably never shows: the page is only reachable for games that have achievements) / `…plus N more the museum hasn't catalogued.` | `This game has no achievements.` / `…plus N more`. (`N hidden achievements remaining` would be wrong for games like Hades, where N includes some unlocked ones.) | mostly ruled |
| 322 | News page subtitle: `your games, your site, your propaganda` | cut. | open |
| 323 | Site news: `The pixel Windows 11 desktop keeps growing — Steam client, possessed Edge, Task View. The Game Boy stays.` (em dash) / `Three carts and counting. Cloud saves via gist. The DMG palette abides.` | `The pixel Windows 11 desktop keeps growing: Steam client, Edge, Task View. The Game Boy stays.` / `Three carts and counting. Cloud saves via gist.` | mostly ruled |
| 324 | Labs: `Experiment 042 — The URE Interactive Recommender` (em dash) / `A machine-learning model trained exclusively on Isaac. Ask it what to play.` / reasons `because your playtime graph looks like a cry for help`, `because the algorithm knows about the GTI`, `because you finished your homework (citation needed)`, `because entropy comes for us all, but not your backlog` / `Experiment 007 — Deep Dive` / `Closed. It dove too deep.` (the chamomile reason is in the kept-gags section) | Both experiments were real, under other numbers: Steam called the recommender `Experiment 002: The Interactive Recommender`, and Deep Dive was Experiment 005. So `Experiment 002: The Interactive Recommender` / `Trained on one library. Ask it what to play.` / reasons based on tags (`because you play Factorio`, `because you like racing games`, `because it's on your wishlist`) / `Experiment 005: Deep Dive` with a flat line like `Start from a game you like and explore similar ones.`, or cut that card. Only `Closed. It dove too deep.` is a joke. | open |
| 325 | Notifications: `X is -N% — it's on your wishlist` (em dash) / `Your Steam Replay 2025 is ready. It is mostly Factorio.` | `X is N% off. It's on your wishlist.` / `Your Steam Replay 2025 is ready.` | mostly ruled |
| 326 | Properties modal: `X — Properties` (em dash) / `Install size: N KB of localStorage` / `Build: 2026 (latest — updates are instant when nothing changes)` (em dash) / launch options `--pixels=all --thumbs=up` / verify result `All files validated. 0 failed. It was mostly vibes, and the vibes check out.` | `X Properties` / `N KB` / `2026 (latest)` / leave launch options blank / `All files validated. 0 failed.` | mostly ruled |
| 327 | Activate a product: `Code accepted. You already own everything URE makes — it's that kind of store.` (em dash) / `Product activated: the warm feeling of ownership.` / `Invalid product code. This museum only honors URE-codes.` | `Code accepted.` / `Product activated.` / `Invalid product code.` | mostly ruled |
| 328 | About Steam box: `Client: Pixel Edition` / `Built: isaacure.com/comp` / `Renderer: Canvas 2D, dithered` / `Framework: none. vanilla. artisanal.` | Match real Steam's About box: `Steam Client Build:` with a date like `Sep 17 2026` (the path is stale anyway, since Steam only exists in /tcomp/ now). Cut `Renderer` (pixels ruling). Cut the Framework row: real Steam has none, and it's the site describing its own code. `Client: Pixel Edition` follows the `UreOS 11 Pixel Edition` question. | open |
| 329 | Steam profile: `Houston, Texas · Rice ’29` / tagline `Building a GTI, DMing on weekends, optimizing everything else.` / `Level 42` | keep. It's all true about you, and a Steam profile summary is the one place a line like that belongs. | keep |
| 330 | Profile badges: `Years of Service`, `Community Ambassador`, `Pixel Pioneer`, `Steam Awards ’26`, `URE BOY Owner` | Swap `Pixel Pioneer` for a real Steam badge from a different family, like `Game Collector` (`Pillar of Community` would clash, since it's a lower level of the `Community Ambassador` badge already there). Keep the rest; `URE BOY Owner` is a fair in-joke for a badge. | open |
| 331 | System Information: `RAM: 640 KB (ought to be enough)` / `Display: WxH (this one)` / `Steam: the one you are looking at` | `640 KB` / `WxH` / `Pixel Edition` | open |
| 332 | Steam Settings: `Enable Big Picture on wake: No.` / `Download region: Houston (the good rack)` / `Steam Cloud: synced, allegedly` / `Client beta participation: URE Client Beta ✓` | `Off` / `Houston` / `On` / the real option is `Steam Beta Update`, so `Client beta participation: Steam Beta Update`. | open |
| 333 | Menu toasts: `You are now pretending to be offline.` / `Your friend code: URE-BOY-1. Choose wisely.` / `Status: Online. The green dot of honor.` / `Every game here is a non-Steam game if you think about it.` / `Support ticket #0001 filed with Isaac. Response time: whenever.` / `Account: it's Isaac. The details are Isaac.` / `Preference saved: more racing games. Obviously.` / `Nice try — this is Isaac's machine.` (em dash) | `Steam is now in Offline Mode.` / `Your friend code: URE-BOY-1` / no toast / no toast / no toast / no toast / no toast / `Signed in as Isaac.` | open |
| 334 | Cart: `Museum checkout: no card, no charge, no tax (it's the one perk). Games land straight in your library.` / gift toast `A gift? Generous. It will still end up in Isaac's library.` / `Purchase complete — N items added (+P points).` (em dash) | Cut the note entirely (the totals and the button say enough). / no toast / `Purchase complete. N items added (+P points).` (keep the points, that's real feedback for the Points Shop) | mostly ruled |
| 335 | Downloads toasts and status: `X — added to downloads.` / `X — installed. Ready to play.` / `X — download cancelled.` / status bar `X — N% (N MB/s)` (all em dashes) | `X added to downloads.` / `X installed. Ready to play.` / `X download cancelled.` / `X · N% (N MB/s)` | ruled |
| 336 | Playing a shelf game (BG3, Factorio, etc.): `Preparing to launch X…` then `Played X. (The real thing lives on Isaac's actual shelf.)` | Keep the fake launch (the library shows them installed, and it banks the 0.1 hrs) and either `Played X.` or no toast. | ruled |
| 337 | Cart/wishlist toasts: `X — added to cart.` / `X — added to wishlist.` / `X — removed from wishlist.` (em dashes) / buttons `In Cart — View` / `In cart — view cart` (em dashes) / DLC rows `X — Y` (em dash) | `X added to cart.` / `X added to wishlist.` / `X removed from wishlist.` / `In Cart` / `View cart` / `X: Y` | ruled |
| 338 | Right-click toasts: `DLC is décor in this museum — admire it from here.` (em dash) / `The Community Hub is just the friends list with extra steps.` / `Favorites are earned in hours here, not assigned. Play more X.` / `Local files: one corner of localStorage. You are technically inside them right now.` / `X — uninstalled. The shelf space was imaginary, but still.` (em dash) / `Page URL copied. It only resolves on this desktop.` | `DLC isn't available here.` / no toast / `Favorites are based on recent playtime.` (there's no favorites list to add to) / open Explorer at the game's folder for the five games that have one (Terraria, Cookie Clicker, URE QUEST, VEILFALL, NINTH NIGHT), `No local files.` for the rest / `X uninstalled.` / `Page URL copied.` | mostly ruled |
| 339 | Friend right-click toasts: `X is already in Y. Consider joining THEM.` / `Invite sent. X typed “one more?” before it arrived.` / `Only Isaac has a profile in this museum. X prefers the mystery.` / `Nickname saved: “X”. Revolutionary.` / `X cannot be blocked. They are load-bearing.` / chat `Said is said.` | `X is already in Y.` / `Invite sent.` / no toast / `Nickname saved.` / `X can't be blocked.` / no toast | open |
| 340 | Browse empty: `Nothing here. Isaac has a small but tasteful catalogue.` | `No results.` | open |
| 341 | Friends panel headers: `ONLINE — N` / `OFFLINE — N` (em dashes) | `ONLINE (N)` / `OFFLINE (N)` | ruled |
| 342 | System requirements block: `Storage: a corner of localStorage` / `Notes: Thumbs supported` / `Memory: 640 KB RAM` / `Processor: Bloom Core @ 60fps` | `Storage: 1 MB available space` / cut Notes / keep `640 KB RAM` and `Bloom Core @ 60fps` (same as the Settings page, so they match). | open |
| 343 | Wallet `$13.37` | keep. | keep |
| 344 | PIT LANE store page: `...gamble the undercut. Saves live in ub_pitlane_save.` | Cut the last sentence. It names the website's storage key, which is the machine saying it's a web page. | open |
| 345 | Points Shop item `Pixel Gold Frame` (next to `URE Red`, `Bloom Blue`, `DMG Green`) | `Gold Frame` | open |
| 346 | Friend names: `throttle_body`, `nat20nate`, `pit_boss`, `spaghetti_bus`, `chamomile`, `the_thresher`, `fsae_treasury`, `critfail_kelsey`, `argent_owner` | keep. Gamer handles really are puns like these. | keep |
| 347 | Review histogram tooltip: `Reviews over time (museum data)` | `Reviews over time` | ruled |
| 348 | Activate a Product: `Enter your product code. Codes look like URE0Y-XXXXX-XXXXX.` | keep. A fake code in the real format is exactly the kind of detail that works. | keep |

## Minecraft Launcher


On Sep 6 a chat rewrote the launcher "everywhere it read like a wink instead of a program": patch notes, Settings, About, sign-in, other games, logs, crash reports, options.txt and minecraft.net now read like the product. That cleared every launcher row from the last table. What's left:


| # | now | suggestion | status |
|---|---|---|---|
| 349 | Crash-report file names can get a numbered copy, `crash-(date)-client (2).txt` | Keep. It's deliberate (two crashes can land in the same second) and takes two forced crashes to see. Real Minecraft uses the timestamp alone, so dropping the suffix is the only change if you want it exact. | keep |

## System-wide bits only in tcomp


| # | now | suggestion | status |
|---|---|---|---|
| 350 | Start menu "Recommended" row: `Steam` / `Weekend Deal live` (index.html) | If the weekend deal goes, this should go too. `Recently added` is what Windows actually prints under a Recommended app. | open |
| 351 | Missing-script placeholders (only shown if a game file fails to load): `The oven never preheated (cookie.js missing).`, `The veil failed to fall (arpg.js missing).`, `Nobody said anything (ninth.js missing).`, `World generation failed to start (terraria.js missing).`, `The world fell into the void (minecraft.js missing).`, `The engine never turned over (racer.js missing).` | `X failed to load.` Low priority since visitors shouldn't see these. | open |

## The gags you said keep, tcomp instances


### Chamomile (real)

| # | now | suggestion | status |
|---|---|---|---|
| 352 | Euro Truck Simulator 2 blurb: `Chamomile in game form. Set cruise control on the A8, put on a podcast, feel your heart rate drop.` | Keep, now that the tea is real. | keep |
| 353 | Steam friend `chamomile` (Away, `idle 22m`) with chat lines `tea?` / `you've been on the computer for four hours` / `hydrate` | keep (row 315). | keep |
| 354 | Steam Labs recommender reason: `because it pairs well with chamomile` | cut with the rest of that list; the reasons become tag-based (row 324). | open |

### The intercooler (real)

| # | now | suggestion | status |
|---|---|---|---|
| 355 | URE QUEST readme.txt: `URE QUEST v4 — the party rebuild. / If the game asks you to install an intercooler mid-boss, that is not a bug. That is the plot.` | `URE QUEST v4. party rebuild. / the intercooler is a main quest item.` (lowercase to match the GTI RUN readme next to it; the mid-boss install really is the game's plot, so a plain mention does the job) | open |

### Camus (keep)

| # | now | suggestion | status |
|---|---|---|---|
| 356 | essays\absurdism and idle games.txt: `thesis: the idle game is the most honest genre. / the numbers go up. it means nothing. you keep going anyway. / camus would have played cookie clicker. camus would have ASCENDED.` | Cut `camus would have ASCENDED.` Keep the rest. | open |
| 357 | Steam blurbs `Absurdist philosophy with a door budget. The closest a game has come to reading Camus in an office chair.` (Stanley Parable) and `...Absurdist philosophy with a badge and a hangover.` (Disco Elysium); curator `Absurdist Games Weekly` / `Meaningless, and therefore essential.` | keep all of it. | keep |

### The cow (pending)

| # | now | suggestion | status |
|---|---|---|---|
| 358 | Launcher skin `Moo` (a cow skin next to Steve, Alex and URE BOY) | keep either way. A cow skin is a normal thing to have. Not part of this, but noticed: the in-game achievement `Cow Tipping` / `Obtain leather` is misnamed; the real one is `Cow Tipper` / `Harvest some leather`. | pending |
| 359 | Minecraft Launcher Play tab art: a pixel cow in the landscape (the code comment says `a cow (of course there is a cow)`, which visitors don't see) | Art, not text. Keep either way: it's a cow in a Minecraft field. | keep |

# Tier 3: the games

Cookie Clicker, Sunset Runner, VEILFALL, Terraria, Minecraft and NINTH NIGHT. They only run in /tcomp/ now, and none of their files changed since the last table except one Minecraft splash.


## Cookie Clicker (cookie.js)


| # | now | suggestion | status |
|---|---|---|---|
| 360 | News ticker lines 1 to 11 (`cookie farms suspected of employing undeclared elderly workforce!`, `cookies found to be addictive, says study funded by the cookie industry.`, `"cookies are the new bread," claims economist.`, `man eats cookie, reportedly "likes it quite a bit."`, `doctors warn against "cookie diets"; cookie lobby unmoved.`, `cookie prices spike as demand reaches "frankly ridiculous" levels.`, `local hero saves cookie from certain doom (a glass of milk).`, `archaeologists unearth ancient cookie; immediately eat it.`, `"we just want to bake," say grandmas. Nobody believes them.`, `scientists announce cookies still delicious, funding renewed.`, `cookie-based economy "surprisingly stable," says confused analyst.`, `moon confirmed to not be a cookie. Disappointment widespread.`) | These read like paraphrases of the real game's ticker (the first one is a real line). That's the game's own register, so I'd leave them. | keep |
| 361 | News: `local student clicks cookie instead of studying for econ midterm.` | keep. It fits the format. | keep |
| 362 | News: `silver GTI spotted making suspiciously fast cookie deliveries.` | keep. It's in the ticker's format and it's your car, not a generated bit. | keep |
| 363 | News: `URE BOY sales dip as entire household plays Cookie Clicker instead.` | cut. | open |
| 364 | News: `Edge browser reportedly "happy for Chrome, really." Sources doubt it.` | cut. | open |
| 365 | News: `kitten workforce demands more milk; management folds instantly.` / `time travelers arrive from the future to eat cookies "before they run out."` / `wizards insist cookie magic is "a legitimate school of thaumaturgy."` / `antimatter cookie briefly erases hunger from the universe.` | keep all four; they're in the game's voice. | keep |
| 366 | Grandma news (at 50+ grandmas): `grandmas "multiplying at an alarming rate," reports local man.` / `thousands of grandmas spotted moving in perfect unison.` / `do not look at the grandmas. Do not let the grandmas know you know.` / `"everything is fine," says grandma council in unified voice.` | Keep (the grandmapocalypse is the real game's bit). Maybe cut `Do not let the grandmas know you know.` | keep |
| 367 | Offline earnings: `Welcome back. The grandmas baked N cookies while you were gone. They want to talk about overtime.` | `Welcome back! You earned N cookies while you were away.` (plain, no grandmas) | open |
| 368 | Big cookie aria-label: `The cookie. Click it.` | `Big cookie` | open |
| 369 | Mystery building tooltip: `???` / `A mysterious building. Keep baking.` | `???` alone. | open |
| 370 | No upgrades: `Bake more. Upgrades will come.` | leave empty. | open |
| 371 | Wipe save: `Really wipe the whole save? No bin for this one` | `Really wipe the whole save?` | open |
| 372 | Ascend news: `local bakery ascends to a higher plane; returns with N heavenly chips and a hunger.` | `News : local bakery ascends; returns with N heavenly chips.` | open |
| 373 | Legacy tab: `Ascend to shed this mortal bakery and gain heavenly chips — each one a permanent +1% CpS across every future life.` (em dash), button `Ascend — gain N heavenly chips` (em dash), and the locked state `Next chip at N all-time cookies. Keep baking.` | `Ascend to reset your bakery and gain heavenly chips. Each one is a permanent +1% CpS.` / `Ascend (+N heavenly chips)` / `Next chip at N all-time cookies.` | mostly ruled |
| 374 | Achievement tooltip `X — desc` (em dash). Also the store's sell mode shows a bare `—` as the price when you own none of a building. | `X: desc` / leave the sell price blank when you own none. | ruled |
| 375 | Kitten upgrade tooltip: `You gain more CpS the more milk you have. (You gotta pet the kittens.)` | First sentence is the real game's; cut the parenthetical. | open |

## Sunset Runner (racer.js)


| # | now | suggestion | status |
|---|---|---|---|
| 376 | Car blurbs: `The all-rounder. A silver soul in a red shell.` / `Top-end monster. Loose in the corners.` / `Corner carver. Point and shoot.` / `Nitro tank. Live on the boost.` | `The all-rounder.` for ARGENT; keep the other three. Everything else in the racer is HUD text and is fine. | open |

## VEILFALL (arpg.js)


VEILFALL imitates Path of Exile, which is deadpan by design, so a lot of it works. These are the lines that break register. The Camus and intercooler instances are marked.


| # | now | suggestion | status |
|---|---|---|---|
| 377 | Fireball: `Hurl a searing bolt that bursts on impact. 25% chance to ignite, because fire remembers.` | Cut `, because fire remembers`. | open |
| 378 | Glacial Ray: `Channel a beam of murdering cold.` | `Channel a beam of cold.` | open |
| 379 | Arc: `Lightning does not aim. It decides.` | keep. | keep |
| 380 | Voidfall Meteor: `Mark the ground. Regret arrives 1.1 seconds later from a very great height.` | keep, honestly. | keep |
| 381 | Umbral Coil: `Chaos damage ignores half of resistance, because chaos.` | `Chaos damage ignores half of resistance.` | open |
| 382 | Flame Dash: `Be somewhere else, leave fire where you were. Two charges. The trail lightly singes regret into the floor.` | Cut the last sentence. (The trail is cosmetic, it does no damage, so `The trail burns.` would promise a mechanic that isn't there.) | open |
| 383 | Arcane Surge: `Overclock the veil for 8s: ... The comedown is not modelled. Yet.` | Cut the last two sentences. | open |
| 384 | Sigil of Ruin: `Cursed targets take 25% increased damage from everything, including opinions.` | Cut `, including opinions`. | open |
| 385 | Basalt Spear: `No element, no tricks — the one thing on this list the dummy’s armour actually argues with.` (em dash) | `No element, no tricks. The one thing on this list that armour actually resists.` | mostly ruled |
| 386 | Keystones: `Your hits can never be critical — but they deal +45% more damage and never stray. Consistency is its own violence.` / `Fire, Cold and Lightning damage +50% — but your critical multiplier is fixed at 1.5. The elements do not care how sharp your knife is.` (em dashes) / Avatar of Fire tail `Everything burns eventually.` / Glass Cannon tail `The proving grounds will teach you why the name.` | `Your hits can never be critical, but they deal +45% more damage and never miss.` / `Fire, Cold and Lightning damage +50%, but your critical multiplier is fixed at 1.5.` Cut all four tails. | mostly ruled |
| 387 | The unique item (intercooler, kept): `The Box` / `Intercooler-Shaped Reliquary` / `It has been in the trunk since session one. / It is fine. It is FINE.` and the drop line `THE BOX DROPS. It has been in the trunk since session one.` and bench line `The Box keeps its own counsel.` and achievement `It Was In The Trunk` / `Loot The Box` | Keep the item, its base, the drop line and the achievement. The flavour becomes `It has been in the trunk since session one.` on its own. The bench line goes blank: the panel header above it already says uniques can't be crafted (row 405), so the item shouldn't repeat it. | open |
| 388 | Achievements: `Hit the training dummy. It forgives you` / `Reduce the dummy to its component philosophies` / `Fall in the proving grounds (it happens to everyone)` | `Hit the training dummy` / `Destroy the dummy` / `Fall in the proving grounds` | open |
| 389 | Warden description: `...It does not have a name in the story yet either.` | cut that sentence. | open |
| 390 | HUD: `TRAINING DUMMY, THE PATIENT` / subtitle `wave N · one must imagine it survivable` (Camus) in the Trials and `act 0 · the story is still being written` outside them | Keep `TRAINING DUMMY, THE PATIENT`: that's how PoE names bosses (Kitava, the Insatiable), and the achievement `The Patient One` (stand 60 seconds without casting) echoes it. Subtitles `wave N` / `act 0`. | open |
| 391 | Welcome line: `Welcome to the proving grounds. The dummy has been informed.` | `Welcome to the proving grounds.` | open |
| 392 | Dummy respawn lines: `The dummy returns. It holds no grudge. It holds nothing. It is a dummy.` / `A new dummy is winched into place. The old one is compost now.` / `The dummy respawns. One must imagine it happy.` (Camus) / `Management sends another dummy. Management says nothing.` | One line: `The dummy respawns.`, or `The dummy respawns. One must imagine it happy.` That second one is the Camus line that fits its spot (a dummy that respawns forever is the boulder), and you said you generally keep Camus. The other three go either way. | open |
| 393 | Combat log: `the dummy is ignited. it does not scream. it never screams.` / `void shards. It will be back. It is always back.` / `not enough mana. the globe judges you.` / `SHATTER! the ice goes everywhere. beautiful.` / `Arcane Surge — the veil hums.` (em dash) | `the dummy is ignited.` / `void shards.` / `not enough mana.` / `SHATTER!` / `Arcane Surge: +30% cast, +20% damage, 8s.` | open |
| 394 | Log em dashes: `support gem drops — socket it in the Spellbook (B).` / `drops X — check your Character panel (C).` / `LEVEL UP — you are now level N.` / `Achievement — X` / `WAVE N — WARDEN` / `THE WARDEN — AWAKENED` / `slot — empty` | `support gem drops. Socket it in the Spellbook (B).` / `drops X. Check your Character panel (C).` / `LEVEL UP: you are now level N.` / `Achievement: X` / `WAVE N: WARDEN` / `THE WARDEN: AWAKENED` / `slot: empty` | ruled |
| 395 | Banners: `the veil catches you — one moment` (em dash) / `survive. it is the whole design.` / `the arena exhales` | `the veil catches you` / `survive.` / cut. Same for `the proving grounds are quiet again` under WARDEN DOWN: cut. | mostly ruled |
| 396 | Death: `You are set back on your feet at the veil-mark. Try that again.` | `You are set back on your feet at the veil-mark.` | open |
| 397 | Panels: `the dummy has not been generous yet. correct this.` / `dummy and DPS meter reset. clean slate. new sins.` / `Resistances cap at 75%. Chaos ignores half. The dummy read the patch notes.` / `No items to craft. The Trials are generous to the violent.` / `not enough shards. the Trials await.` / `the web forgets nothing, but it forgives.` / `is empty. hit things to refill it.` | `no items yet.` / `dummy and DPS meter reset.` / `Resistances cap at 75%. Chaos ignores half.` / `No items to craft.` / `not enough shards.` / cut / `is empty. Refills on hit.` (the refill hint is a real mechanic, so keep a flat version of it) | open |
| 398 | Flasks: `Restores 35% life. Tastes like cranberry and denial.` / `Restores 40% mana. Carbonated. Do not shake.` / `+40% movement speed for 4s. Legal in most leagues.` | Cut the tails on all three. | open |
| 399 | Erase save: `Save erased. A clean exile. Reopen VEILFALL for a fresh start.` | `Save erased. Reopen VEILFALL for a fresh start.` | open |
| 400 | Boss bar while the dummy respawns: `composting…` | `respawning…` | open |
| 401 | Spellbook empty state: `no support gems yet — they drop from enemies in the Trials.` (em dash) | `no support gems yet. They drop from enemies in the Trials.` | ruled |
| 402 | Spell cards and skill tooltips show damage ranges as `N–M` (en dash) | That's just a number range; I'd leave it. Say if you want a hyphen. | open |
| 403 | Passive tree flavour lines under the notables (all six have one): HEARTWOOD `The dummy respects nothing but staying power.` / PYRECALLER `Everything you cast smells faintly of campfire. This is a buff.` / THE STILL POINT `Frozen things break beautifully. +50% shatter damage.` / TEMPEST LOGIC `Lightning does not aim. You, however, have started to.` / VOIDTOUCHED `Your damage-over-time now ticks with intent.` / THE LONG GAME `One must imagine the exile levelling.` (Camus). Plus the start node The First Spark `Where every exile starts. Allocating this costs nothing and means everything.` | Real PoE notables carry stats and nothing else, so cut all six flavour lines together (the stat lines stay; cutting only one would leave a single bare notable). First Spark: `Where every exile starts. Costs no passive points.`, or no line at all, since real PoE's start node has none. THE LONG GAME's line is a Camus one; the respawn line is the one I'd keep if VEILFALL keeps any. | open |
| 404 | Achievements: `Orbital Opinion` (`Land Voidfall Meteor dead centre`) / `It Fights Back` (`Kill something that was trying to kill you`) / the rest of the names (`Serial Offender`, `Critical Acclaim`, `Perfect Storm`, `The Patient One`, `Speedrun Strats`, `Well Linked`, `Bench Time`, `Point of No Return`, `Mortal After All`) | `Dead Centre` (the opinions gag is going) / `Kill your first enemy in the Trials` / the rest are PoE-style puns and read fine; keep. | open |
| 405 | Trials copy: log line `THE TRIALS BEGIN. Kill everything. Stay standing.` / wave-clear banner subtitle `breathe. the next is worse.` / crafting bench hint `Void shards reshape loot. Uniques are beyond the bench.` | `THE TRIALS BEGIN.` / cut (leave `WAVE N CLEARED` on its own; `a Warden stirs…` before a boss wave is fine) / `Void shards reforge items. Uniques can't be crafted.` | open |
| 406 | Support gem: `Area of effect +45%. Bigger meteors, wider novas, splashier bolts.` | Keep; it's describing what the gem does. If you want it flat, `Area of effect +45%.` | keep |

## Terraria (terraria.js)


| # | now | suggestion | status |
|---|---|---|---|
| 407 | Item tooltips written jokey: `The trusty starter. Swings forever.` / `Chews stone properly.` / `Shiny AND practical.` / `Mining in style.` / `Mines hellstone. Bad dreams included.` / `For trees. Works on zombies too.` / `Timber, efficiently.` / `Pointy end goes in the slime.` / `A proper arc. A proper sword.` / `Werewolves not included.` / `Heavy, soft, gorgeous.` / `The finest gem bolt of all.` / `It lights torches. And enemies.` / `Made from sand. Passes for ice here.` / `Providing light since 2011.` / `Background wall. Blocks spawns, keeps a house a house.` / `A house needs one.` / `For real tools and real swords.` / `Furniture. A house wants one.` / `Sittable, notionally.` / `It is warm. Very warm.` / `Flammable. Wobbly. Blue.` / `It is looking at you.` / `Sticky. Spin it into silk.` / `Peeled from the Eater of Worlds.` / `You emit light. Handy underground.` / `Press the Grapple key to swing. Iconic.` / `Summons King Slime. Any time.` | The real game gives most of these no tooltip at all (an empty tip renders fine here), so cut the whole tip on: all four plain pickaxes, both axes, all four plain swords, Diamond Staff, Flaming Arrow, Glass, Wood Wall, Wooden Door, Iron Anvil, Table, Chair, Hellstone, Lens, Cobweb, Shadow Scale. Where the real game has one, use it: Nightmare Pickaxe `Able to mine Hellstone`, Torch `Provides light`, Gel `'Both tasty and flammable'`, Grappling Hook `'Get over here!'`, Slime Crown `Summons King Slime`. Trim to the plain hint on the rest: Shine Potion `You emit light.`, Suspicious Looking Eye and Worm Food keep their night/corruption clause. | open |
| 408 | Death line: `The dirt sends its regards.` | cut (the real game just says `You were slain...`). | open |
| 409 | Eye of Cthulhu at dawn: `The Eye flees the sunrise. It will remember this.` | `The Eye of Cthulhu has fled.` | open |
| 410 | NPC arrival: `The Merchant has moved in. He has torches. He always has torches.` / `The Nurse has moved in. She frowns at your life total.` | `The Merchant has arrived!` / `The Nurse has arrived!` (real game copy). | open |
| 411 | Nurse line: `“Hold still. This will only cost you.”` | Real nurse lines work: `“Show me where it hurts.”` | open |
| 412 | Merchant line: `“You look like someone who needs torches.”` | Keep. If you'd rather use a real Merchant line, `“The sun is high, but my prices are not.”` needs no player name (most of his real lines do). | keep |
| 413 | Guide lines: `Try chopping a tree — wood is the start of everything.` (em dash) / `Torches keep the dark honest. Wood plus gel.` / `Six lenses make something suspicious. Use it at night, if you are brave.` | `Try chopping a tree. Wood is the start of everything.` / `Wood and gel make a torch.` (it's shown as speech, so keep it a sentence) / `Six lenses make something suspicious. Use it at night.` Other Guide lines are fine. | mostly ruled |
| 414 | Nurse button when broke: `Too poor` | `Not enough` | open |
| 415 | New world toast: `A new World of Ure spins into being.` | `New world generated.` | open |
| 416 | Em dashes: map hint `Fullscreen map — M or Esc to close` / `Inventory full — some loot remains in the chest.` / tooltips `Name — tip` / buffs `Ironskin — 40s left` / recipes `ingredients — at Work Bench` / `Trash — drops the held stack` / `Click again to confirm — this erases the world` | `Fullscreen map · M or Esc to close` / `Inventory full. Some loot remains in the chest.` / item and shop tooltips `Name · 8 dmg · tip` (the middle dot is the separator the tooltip already uses for stats) / `Ironskin: 40s left` / `ingredients (at Work Bench)` / `Trash: drops the held stack` / `Click again to confirm (this erases the world)` | ruled |
| 417 | Not comedy, but noticed: several achievement names are real Terraria names attached to different tasks (`Watch Your Step!` for wearing armor, `It’s Getting Hot` for building a house, `Sticky Situation` for looting a chest, `The Frequent Flyer` for casting a spell, `Where's My Honey?` for reaching the caverns). | Leave or fix later; flagging so you know. | fix |
| 418 | Summon-item refusals: `A boss already stalks you.` / `The eye only answers to the night.` / `The Eater stirs only in the corruption.` | Fine as they are, they're in the game's register. Keep. | keep |

## Minecraft (minecraft.js)


| # | now | suggestion | status |
|---|---|---|---|
| 419 | Title-screen splashes. The whole list is yours (the real game's file isn't copied). The ones that wink at the site or explain the bit: `As seen on a website!`, `Runs on a computer inside a computer!`, `Squid are load-bearing!`, `Straight down is a choice!`, `Lava is a learning experience!`, `git blame says you!`, `Isaac made this!`, `Better than the real thing? No!`, `Close enough!`, `Good enough to ship!`, `Ninety percent there!`, `The last ten percent!`, `Runs in a window in a window!`, `The desktop is also fake!`, `The file system is also fake!`, `The launcher is also fake!`, `This splash is real though!`, `You have to click something!`, `Ship it on a Tuesday!`, `Merge to main!`, `Squash and merge!`, `The commit message is honest!`, `Made of arrays!`, `It is a big file!`, `It is all one file!`, `Written in a text editor!`, `It has a real command parser!`, `No frameworks were installed!`, `Voxels all the way down!` | Cut those, plus eight more that wink at the web page just as much: `Now in your browser!`, `No install required!`, `Powered by requestAnimationFrame!`, `WebGL, one context!`, `Runs in a window!`, `Alt-tab friendly!`, `Not affiliated with anyone!`, `Press Singleplayer!` (`pixelsAlreadyPerfect=true!` is already gone). The three date splashes (`Merry X-mas!`, `Happy new year!`, `OOoooOOOoooo! Spooky!`) are the real game's, word for word. The rest (advice like `Never dig straight down!`, `Bring two buckets!`, `Torch the cave first!`, machine facts like `The lighting is a BFS!`, `Clouds at y=88!`, `Sixteen by ninety-six!`, seed callbacks like `Seed 4-1-1-4!`, `SMP with malachi!`) are in the real game's register and can stay. | open |
| 420 | The never-shown splash: `This splash cannot be shown, which is the joke.` (hidden by hash, an homage to the real game's mechanic) | `This splash will never be shown!` and keep the mechanic. Cut `which is the joke`. | ruled |
| 421 | Server list MOTDs: `we rebuilt the roof / again` / `Whitelist only. Ask Isaac.` / localhost `It's you. You're the server.` | Keep the first two. localhost `A Minecraft Server` (the default MOTD). | open |
| 422 | Third-party play warning: `Online play is offered by servers that are not owned, operated or supervised by anyone here. This computer is a drawing of a computer, so none of these servers exist and none of them will let you in. The refusals are, at least, the real ones.` | `Online play is offered by servers that are not owned, operated or supervised by anyone here. None of them can be reached from this machine.` | ruled |
| 423 | Language screen: `The menu is written in English. The rest is a promise.` | The real screen's grey caption: `(Language translations may not be 100% accurate)` | open |
| 424 | Realms: `There is no Realm here, and there is nobody to bill.` / `This machine is a picture of a machine and its network cable goes nowhere.` | `Realms isn’t available here.` | mostly ruled |
| 425 | Online Options: `Nothing is online.` / `No account is signed in, no session is open, and no chat is reported anywhere.` and Telemetry: `Nothing is collected.` / `There is no server to send it to and no one is curious enough to build one.` | Cut the second line on each. The first lines already say it. | open |
| 426 | Skin customization: `Skins are chosen in the launcher. This world renders you from the outside only when you drop something.` | `Skins are chosen in the launcher.` | open |
| 427 | Game rules screen: `Open the world and use /gamerule — the parser is real and it lists what it accepts.` (em dash) | `Open the world and use /gamerule.` | ruled |
| 428 | WebGL failure: `WebGL fell out of the world. (This machine refused a 3D context.)` | `WebGL isn’t available in this browser.` | open |
| 429 | Waking up: `Rise and shine` | cut (the real game shows nothing), or `Good morning`. | open |
| 430 | Everything else in the game (achievement names, death screen, command errors, `You died!`, `Achievement Get!`) is real Minecraft copy. | leave. | keep |
| 431 | Options > Resource Packs: `Available: none.` / `The textures in this game are drawn at boot by code in this file, so there is nothing on disk for a pack to replace.` | `Available: none.` on its own. | open |
| 432 | Credits & Attribution: `Minecraft is made by Mojang Studios. This is not that.` / `This is a recreation of its title screen, written from scratch for a personal site: the font, the wordmark, the widgets and the world behind them are all drawn by code in this file.` / `No Mojang assets are used, and nothing here is sold.` | Keep the attribution, lose the wink: `Minecraft is made by Mojang Studios.` / `This is a from-scratch recreation of its title screen for a personal site. No Mojang assets are used and nothing here is sold.` | open |
| 433 | Key Binds panel last line: `These are fixed. Rebinding is not built yet.` | `Key binds are fixed.` | open |
| 434 | F3 debug overlay first line: `Minecraft (comp/urecraft)` | The real overlay's format is `Minecraft <version> (vanilla)`. Use that with whatever version the launcher shows; the repo path is the wink. | open |

## NINTH NIGHT (ninth.js)


Written in its own serious voice; I wouldn't touch the writing. Only the punctuation:


| # | now | suggestion | status |
|---|---|---|---|
| 435 | Place names: `Wick — the square` / `Grelling — the next village` / `Wick — the ninth night` (em dashes) | `Wick, the square` / `Grelling, the next village` / `Wick, the ninth night` | ruled |
| 436 | Milestone text: `WICK — 1/4 MILE.` (em dash) | `WICK 1/4 MILE` | ruled |
| 437 | Dialogue prompts: `up / down — E to answer` / `E — more` / `E — done` (em dashes) | `up / down · E to answer` / `E to continue` / `E to close` (the in-world prompt is a bare key cap, so plain `E to ...` matches it) | ruled |
| 438 | Wings menu: `Wipe save — click again to confirm` (em dash) | `Wipe save (click again to confirm)` | ruled |

# Already done since the last table

Other chats changed these between Sep 6 and Sep 17, so they're off the list:

- **Edge's toasts and address-bar suggestions** (the old rows 133 to 143 and 148). Edge stopped driving itself on Sep 6, and the right-click toasts went with it.
- **The old isaacure.com hub page** (old rows 157 and 158). Chrome's isaacure.com is now your real holding page, copied line for line.
- **The fake FSAE page** (old rows 175 to 177). It's now riceracing.org, the team's real site. Its few leftovers are in Tier 1.
- **minecraft.net** (old row 179). Its footer now reads `A fan recreation. Not affiliated with Mojang or Microsoft.`
- **The whole Minecraft Launcher section** (old rows 316 to 347): patch notes, settings hints, About, licenses.txt, sign-in, other editions, folder messages, logs, crash report, options.txt and the version json all read like the real launcher now.
- **Comp's own copies of the Edge references.** comp's Downloads folder already reads `Nothing downloaded yet.`, and its chrome://downloads page already reads `Nothing downloaded.`
- **One person out of the lore** (your Sep 24 call). PR #163 takes her out of the DnD session 1 note, the character sheets, the karaoke setlist and music folder, the DM cheatsheet and one photo name, in both copies. THE SOCKET takes her URE QUEST slot and THE BOULDER takes her GTI RUN race, and a Rice Village billboard that carried initials now reads KARAOKE. The rows for those files quote them as they read after it.
- **The shortcut card's launcher row.** `Alt+P: Press the big green button` already reads `Alt+P: Play`.
