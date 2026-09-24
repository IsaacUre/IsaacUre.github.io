# Isaac's humour guide (snapshot, Sep 24)

The living copy is a Claude doc:
https://claude.ai/code/artifact/9c7f08ef-91c8-462c-b781-773248def181
If the two differ, the doc wins.

## How to use this

This is a read of Isaac's taste in the site's copy, built only from the calls
he's made so far. It's for predicting his next calls on the review list, not a
rulebook: when a row doesn't fit a pattern here, the row gets flagged for him
instead of guessed.

- Each preference says how many of his rulings back it up, so a one-ruling guess reads as a guess.
- It applies to /comp/ first and /tcomp/ second. Anything decided for comp carries over to tcomp.
- New rulings get added to the decision log with the date and his words. If a new ruling contradicts a preference, the preference changes, not the ruling.

## Preferences

The copy should read like the real product. The desktop being a faithful copy
of a PC is the joke, so nothing on it should wink at that or explain it.

| Preference | What shows it | Confidence |
| --- | --- | --- |
| Use the real product's line when one exists (Windows, Chrome, Steam, the game being copied). | Weekend Deal: "the fact that this is already a copy of a pc is the cool part". The "real" cut. Other chats rebuilding isaacure.com and riceracing.org as the real sites. | High |
| Nothing on the machine points out that it's fake: no "museum", no "it's pixels", no "the real X", no app talking about itself. | Rulings on museum, pixels, "real". The launcher change that stopped it talking about itself. | High |
| Don't explain the joke. If it needs the explanation, cut the joke. | Ruling on "(that's the joke)" | High |
| The OS and apps don't have feelings. Errors and toasts are flat. | Ruling on apps with feelings | High |
| No em dashes, and no hyphen doing an em dash's job. Rewrite when that reads better than a punctuation swap. Code comments are exempt. | First message, em dash ruling | High |
| Drop a decorative subtitle or tagline rather than reword it. | Weekend Deal: "axing the little text" | Medium (one ruling) |
| Things that are true about him stay: chamomile, the intercooler, Camus. The target is generated filler, not personal references. | Rulings on chamomile, intercooler, Camus | High |
| One person is out of the site's lore for good. Nothing mentions or implies her: no name or initials, no matching rings, no duet, no bard sheet. Karaoke and the sad girl setlist are his and stay. | Sep 24 call (his words are in the private doc) | High |
| Kept doesn't mean kept word for word. He wants to see each instance so he can judge how it's written. | Camus ruling | High |
| Running gags he didn't choose (the cow, the sleeping policeman) are undecided, not disliked. | "I'm not sure lmao", "keep this question for later" | Low |
| Overall: nothing corny. | First message | High |

One about how to ask him rather than about the copy: quote examples, don't use labels. "load-bearing" and "trailing
tag" meant nothing until the actual lines were shown.

## Decision log

Every call Isaac has made on the review, newest first, in his words. Row
numbers are rows 1 to 15 of REVIEW.md.

| Date | Topic | His words | What it settled |
| --- | --- | --- | --- |
| Sep 24 | One person out of the lore | His words are in the private doc, not repeated here. | She stays out everywhere: no name or initials, no matching rings, no duet, no bard sheet. The 10mm socket takes her URE QUEST slot and THE BOULDER takes her GTI RUN race. Karaoke stays, as his solo. The edit is PR #163. |
| Sep 24 | comp and tcomp | "prioritise just what's visible with comp and then move onto tcomp and then the other stuff. Anything done to comp should be done to tcomp." | Work order: comp's visible copy, then tcomp-only copy, then the rest. Every comp change is mirrored in tcomp. |
| Sep 24 | This guide | "Don't treat it like the bible but maybe keeping it in mind." | Predictions get flagged as predictions. |
| Sep 6 | Row 1, em dashes | "Please get rid of all em dashes... rewrite things to not need an em dash if that's a better outcome... Code comments should be fine." | All visible em dashes go. |
| Sep 6 | Rows 2 to 5, "one (1)", "load-bearing", "vibes", trailing one-word tags | "I'm confused what this means, please give some examples." | Not ruled yet. Examples were added to the table. |
| Sep 6 | Row 6, "the museum" | "Cut" | Cut everywhere. |
| Sep 6 | Row 7, "it's pixels" | "Cut" | Cut everywhere. |
| Sep 6 | Row 8, apps with feelings | "Agree" | Flat real-OS messages. |
| Sep 6 | Row 9, explaining the joke | "Agree" | Explanations cut. |
| Sep 6 | Row 10, chamomile | "It is my thing" | Stays where it's a fact about him. |
| Sep 6 | Row 11, the intercooler | "Real" | The box thread stays, trimmed. |
| Sep 6 | Row 12, the cow | "I'm not sure lmao" | Pending. |
| Sep 6 | Row 13, Camus and the boulder | "I quite like camus so in general I like to keep it. But for all of these that I say keep, please include the individual stuff in the extended table, because I might disagree with how it's presented" | Stays. Every kept gag is listed instance by instance. |
| Sep 6 | Row 14, "real" / "actual" | "Agree" | The word goes. |
| Sep 6 | Row 15, the sleeping policeman | "I'm not sure, maybe keep this question for later" | Pending. |
| Sep 5 | Overall tone | "a lot of the comedy isn't really my style as it was just generated... I don't really want it to be like corny." | The review exists. |
| Sep 5 | Steam's Weekend Deal subtitle | "I may even just prefer axing the little text and just keeping the 'special offers', as the fact that this is already a copy of a pc is the cool part." | `Special Offers` alone. The faithful-copy principle. |
| Sep 5 | Em dashes, first mention | "I would count 'weekend deal - the sale ends when Isaac says' as pretty much an em dash" | A hyphen doing an em dash's job counts too. |
| Sep 5 | Process | "It should just be a table for now (no action yet)" | No code changes until he says so. |

Changes other chats made in the repo, probably at his direction. They're commit
messages, not his words, so they count as weaker evidence.

| Date | What changed | Commit message says |
| --- | --- | --- |
| Sep 17 | riceracing.org rebuilt | "a pixel-faithful replica of the team's actual site"; "The invented stat tiles and hero buttons are gone." |
| Sep 15 | Steam, Minecraft, the Edge gag and the games leave /comp/ | "/comp/ is what the site links to and it is going public soon, so it loses the things that are not polished yet." |
| Sep 6 | Minecraft Launcher and minecraft.net rewritten | "the launcher stops talking about itself"; changed "everywhere it read like a wink instead of a program" |
| Sep 6 | Chrome's isaacure.com | "Chrome's isaacure.com is the real one now": his real holding page, copied line for line |

## Predictions

A guess at his call for each kind of line the review still has open. A high
guess still gets shown to him; it just gets proposed first.

| Kind of line | Likely call | Why | Confidence |
| --- | --- | --- | --- |
| The machine saying it's fake: `(it's a website)`, `a drawing of a computer`, `The tray is decorative.` | Cut | Same idea as the museum, pixels and "real" rulings | High |
| A real product has its own line for this spot (Windows dialogs, Chrome pages, Steam UI, Bing) | Use the real line | Weekend Deal remark, launcher and riceracing.org rewrites | High |
| Jokes about the site's own code or process: `git blame says you!`, `It is all one file!`, the comp.js file that knows it's being read | Cut | Meta commentary, same family as "that's the joke" | High |
| Trailing one-word tags, "one (1)", "load-bearing", "vibes" | Cut | He asked for examples, but every example is the kind of wink his other rulings cut | Medium-high |
| Filler written to be funny (fake .log lines, pset and syllabus PDFs, EULA clauses) | Plain, real-looking filler | The faithful-copy rule, applied to the files | Medium-high |
| His own things (the car, the DnD party, URE QUEST, FSAE, Deep Blue) | Keep the fact, cut the generated tail (`this is my life now.`, `(careful)`, `the box is FINE.`) | Chamomile, intercooler and Camus all stayed; he asked to judge the wording | Medium |
| Decorative subtitles and taglines (`big games, small numbers`, `made upstairs`) | Cut | Weekend Deal | Medium |
| A game's own style of joke (Cookie Clicker's news ticker, Minecraft splashes that are tips, VEILFALL's deadpan skill text) | Keep | Matches the real game's register, which is the faithful-copy rule for a game | Medium |
| The Edge gag's mechanic (every address ends up at Chrome) | Keep the mechanic, cut the commentary | The Sep 6 Edge change kept the mechanic and only took away the self-driving | Medium |
| Real-product titles with a spaced hyphen (`Untitled - Notepad`) | Unsure | Two of his rules point opposite ways | Low |
| The cow and the sleeping policeman | Unsure | He hasn't decided | Low |

## Open questions

These are the calls that would change the most rows. Answering them first saves the most time.

- [ ] "one (1)", "load-bearing", "vibes", trailing tags: the review now shows every instance. Cut all four patterns?
- [ ] Spaced hyphens in real titles. Notepad, the Reader, Wikipedia and Google write titles as `Untitled - Notepad`. Keep the real format, or use a middle dot because a spaced hyphen counts as an em dash?
- [ ] Copy quoted from a real site. riceracing.org's page has em dashes that may be the live site's own words (the live site is blocked from the sandbox, so this is unconfirmed). Match the real site, or apply the no-em-dash rule anyway?
- [ ] Is URE QUEST's writing his? The intercooler, cow and boulder calls lean on them being canon in his cartridge. If URE QUEST was generated too, canon is a weaker reason to keep them.
- [ ] The cow. Keep or cut. If it stays: the essay's file name says age 7, URE QUEST says four.
- [ ] The sleeping policeman. He said later.
- [ ] `UreOS 11 Pixel Edition`: keep it as the one "pixel" that stays, or rename it?
- [ ] Steam's About texts. About 26 real games on tcomp's Steam shelf have an opinion one-liner as their About text, like Hollow Knight's "The map seller is doing his best." Swap each for the game's real About copy, drop them so only the real short description shows, or keep them as his takes on games he likes? None of them winks at the site, which is why this one is hard to predict.
- [ ] Small facts only he knows: is "again again" on the reading list true, and did the hedges road session really get the sleeping policeman?
