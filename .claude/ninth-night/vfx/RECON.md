=== RECON: callsites ===
# NINTH NIGHT — magic visual call-site map

All line numbers are `comp/ninth.js` @ `88c665c`. File is 8279 lines.

---

## 0. THE FRAME, THE CLOCKS, AND THE TWO SEAMS

**`frame(now)` 3802-3813.** `real` = clamped real dt. `scale = RT.timeScale * (RT.dilate > 0 ? T('dilation') : 1)` (3809). `step(real * scale, real)` then `draw(real)`.

**`step(dt, real)` 3814-3846.** `dt` is the sim clock (30% during a stanza). `real` is the second argument and is what every timeline that must not crawl uses (`RT.dilate` 3816, `RT.mono` 3817, `stepRecital` 3834, `stepCamera` 3838, `stepAudio` 3839, toasts 3843, hud 3844). Decays on the sim clock: `RT.shake -= dt*24` (3840), `RT.chroma -= dt*2.4` (3841), `RT.flash -= dt*2.2` (3842).

> **HITSTOP TRAP.** `RT.timeScale` is multiplied into `dt` *before* `step` is called. A hitstop timer decremented with `dt` inside `step` can never expire, because you set `timeScale` to 0 and `dt` becomes 0. It must be decremented with `real`. `gotoPlace` resets `RT.timeScale = 1` (6128). The only current writer is the dev CHEAT row (1005).

**`draw(rdt)` 3847-3932.** `dt = Math.min(0.05, rdt || 1/60)`. Every `draw*(cx, dt)` is on the **real** clock, which means typographic effects do NOT slow down during a stanza while the sim does.

Draw order, exact:

| line | call | space |
|---|---|---|
| 3852 | `cx.save()` | — |
| 3853 | shake translate, gated on `S.opts.shake && RT.shake > 0.2` | — |
| 3855-3857 | floor blit | world |
| 3859-3862 | dilate dim overlay, `rgba(6,4,10, 0.55*RT.dilate/dilationT)` | screen, under shake |
| 3863-3864 | `drawExits`, `drawLooks` | world |
| **3865** | **`drawRings(cx, dt)`** | world, ground plane, UNDER bodies |
| 3875-3891 | `ents[]` painter sort: foes, npcs, props, actor | world |
| 3892-3893 | `drawLights`, `drawVignette` | screen |
| **3894** | **`drawCalls(cx)`** | world |
| 3895 | `drawFproj` | world |
| **3896** | **`drawParts(cx)`** | world |
| **3897** | `drawCuts(cx, dt)` | world |
| **3898** | **`drawSnaps(cx, dt)`** | world |
| **3899** | **`drawTypo(cx, dt)`** | world |
| 3900 | `RT.flash` white flat | screen |
| 3901 | `RT.hurt` red flat | screen |
| 3902 | `drawPrompt` | screen |
| 3907-3914 | `RT.mono` saturation wipe | screen |
| 3915 | `cx.restore()` — **shake ends here** | — |
| **3916** | **`drawAssembly(cx, dt)`** | screen, NO shake |
| **3917** | **`drawSlams(cx, dt)`** | screen, NO shake |
| 3918 | `drawLines(cx, dt)` | screen, NO shake |
| 3919-3921 | boss bar, toasts, map | screen |

`PARALLEL.md` names the two legal insertion seams: **world space between `drawParts` (3896) and `drawTypo` (3899)** (inside shake), and **screen space after `drawMap` (3921)** (outside shake). One call per job. Anything that must sit *behind* bodies has to go into `ents` as `{ k: x + y, fn: ... }` (3875-3891) or piggyback on `drawRings` at 3865.

**`RT.rdt = dt`** is parked on the runtime at 3881, before `ents` are drawn. That is how any per-foe drawer gets the real dt without a parameter change. Currently read only by 6649.

**What `gotoPlace` clears** (6124-6129): `foes, fproj, calls, beats, typo, slams, lines, dialog, pressure, cleared, wave, tookHit, verseCast, recital, dilate, mono, timeScale, timers`.
**What survives a doorway**: `RT.parts`, `RT.snaps`, `RT.rings`, `RT.assembly`, `RT.shake`, `RT.chroma`, `RT.flash`, `RT.hurt`, `RT.casting`, `RT.conceal`, `RT.lastRhyme/lastWord/lastFam`. `RT.combat.cuts` is cleared, but only because `combatBoot` registered an `onPlaceChange` for it (2793-2796). **Any new effect array needs its own `onPlaceChange` registration or particles from the mill will draw at their old tile coordinates in the lane.**

---

## 1. DATA SHAPES

### A rhyme stack entry, `f.stacks[i]`

Three producers, three different shapes. There is no constructor.

| producer | line | shape |
|---|---|---|
| `addStack` | 2467 | `{ fam, t: st.stackLife, max: st.stackLife, born: RT.t }` |
| Droner special | 3351 | `{ fam: pick(other), t: st.stackLife, max: st.stackLife, drone: 1 }` — **no `born`** |
| `a3Mark` (the ending) | 5581 | `{ fam: 'ill', t: 999, max: 999, born: RT.t, aged: 1 }` |

- `fam` — one of `FAM_IDS`. Mutated in place by the drag (2635).
- `t` — remaining life, sim seconds. Ticked at 2476. Multiplied by `(1 - dragAge)` at 2635.
- `max` — life at birth. **Never updated by the drag**, so `s.t / s.max` is wrong after a drag and `s.t` can exceed `s.max` never but the ratio jumps. `drawStacks` sidesteps this with `clamp(s.t / 1.2, 0.3, 1)` (3550) rather than using `max`. Any visual scaled by "how fresh is this stack" must do the same or fix `max` at 2635.
- `born` — `RT.t` at creation. Present on 2 of 3 producers. Useful for a per-stack phase offset so a row of stacks does not pulse in lockstep; guard it (`s.born || 0`).
- `drone: 1` — not yours. `breakStack` refuses to bill you for it (2492-2493) and `drawStacks` greys the tag (3556).
- `aged: 1` — set only by `a3Mark`, read by nothing. A free flag if you want "four hundred years old" to look different.

> **`f.stacks` is REASSIGNED, not spliced, on a close**: `f.stacks = f.stacks.filter(...)` at 2624. Nothing may cache the array identity.

All 22 accesses: 1607, 1788, 2467-2468, 2474-2477, 2523, 2529, 2561, 2585, 2622, 2624, 2635, 2637, 2765, 2771, 2776, 3319, 3328, 3331-3332, 3351-3352, 3375, 3539-3548, 5548, 5580-5581.

### A foe

Built in `spawnFoe` 3005-3013:
```
kind, def, mod, m, x, y, hp, hpm, r, stacks[], state, tell, atkT,
flash, wob, dead, silence, frozen, burn, revealed, armor, spawn,
anim, steal, drone, pulse, said, spd, dmg, atk, so
```
Elite bend 3014-3021. Fields bolted on later at their use sites: `stealT droneT sp wind windMax flee pulseT warn spawnT voiceT callDmg otherDmg face seat isHal walk walkTo _fv burn.tick`.

- **`f.x` / `f.y`** are world tiles, floats. Set at 3006, moved by `moveFoe` 3239-3242.
- **`f.r`** is the hit radius in tiles (0.42 to 1.6). `r * TILE_W / 2` is its pixel radius on the ground plane; `r * 21` / `r * 8` is the shadow ellipse (3510); `r * 22` / `r * 44` is the body box used by the flash and freeze rects (3513-3515); `r * 60` is the health bar width (3519).
- **`f.anim`** = `rnd(0, TAU)` at spawn, `+= dt` every frame (3053). This is the existing per-foe animation phase. Use it, do not mint another.
- **`f.so`** — stack-row vertical stagger, `irnd(0,2) * 9` (3012), `(i%3)*4` for the audience (5566). Applied at 3526.

### `FOE_H` → a foe's pixel height

`var FOE_H = { mouth: 24, thief: 34, droner: 30, deaf: 32, sword: 36, folk: 30 };` **line 3684.** Keyed by `f.def.draw`, not by kind. It is sprite rows × `PXS` (2), kept beside the art so the two cannot drift.

Read in exactly one place, `drawFoe` 3488:
```js
var h = f.def.boss ? 130 : (FOE_H[f.def.draw] || 30);
```
`chorus` has no `FOE_H` row and takes the 130 branch. Anything wanting height outside `drawFoe` must re-derive this expression; there is no helper. Derived positions inside `drawFoe`: special-windup word at `sy - h - 30` (3506), health bar at `sy - h - 10` (3521), stack row at `sy - h - 18 - (f.so||0)` (3526).

Ground point for any foe: `sx = isoX(f.x, f.y)`, `sy = isoY(f.x, f.y) + TILE_H / 2` (3479). Head point: `sy - h`.

### Where a per-foe transient can safely be parked

Straight onto the foe object. That is already the house pattern and there is precedent for a lazily-initialised private: `if (f._fv == null) f._fv = ...` in `drawFolk` (3468), with a comment explaining exactly why it is cached rather than re-derived.

Safe because:
- dead non-folk are spliced out of `RT.foes` on the next `stepFoes` frame (3068), so the field dies with the body;
- `gotoPlace` does `RT.foes.length = 0` (6124);
- nothing serialises a foe.

Conventions to hold to: prefix `_`, lazy-init with `== null`, and never read it from a drawer without a default. **Do not** put it on `f.def` or `f.m` — those are the shared `FOES` / `MODS` table entries and are the same object for every instance.

`f.burn` is the one existing nested transient (`{dps, t, tick}`, 2822 / 2834 / 3071). It is `null` when absent, which is a different idiom from the numeric timers (`silence`, `frozen`, `revealed`, all 0-when-absent, all decayed at 3054-3060).

> **Death-time visuals cannot live on the foe.** `foeDie` sets `f.dead = 1` (3421); `drawFoe` is never called for it again (filter at 3883). Push into a global array instead: that is what `RT.combat.cuts` is (3417).

### The effect arrays

| array | init | element | stepped/drawn | cleared on travel |
|---|---|---|---|---|
| `RT.parts` | 1551 | `{x,y,z,vx,vy,vz,life,max,size,col,add,grav}` | 1393 / 1401 | **no** |
| `RT.typo` | 1551 | `{x,y,txt,col,life,max,size,style,z:40}` | 1422 | yes |
| `RT.slams` | 1551 | `{txt,col,sub,t,max}` | 1446 | yes |
| `RT.lines` | 1551 | `{txt,sub,col,t,max,pin,age}` | 1478 | yes |
| `RT.calls` | 1552 | `{x,y,vx,vy,life,word,fam,hit[],couplet}` | 2420 / 3934 | yes |
| `RT.snaps` | 1552 | `{x,y,col,n,t,max}` | 2804 | **no** |
| `RT.rings` | 1552 | `{x,y,r,max,col,t,life}` | 2986 | **no** |
| `RT.assembly` | 1554 | `{ws[],fam,t,max}` (singleton) | 2683 | **no** |
| `RT.combat.cuts` | 1566 | `{x,y,w,t,max,big}` | 3774 | yes (2795) |

Caps: `part()` silently drops above 900 (1385). `typo()` shifts the oldest above 60 (1420). `RT.slams`, `RT.snaps`, `RT.rings` are **uncapped**.

Dead fields: `RT.rings[].r` is written by all three producers and read by nobody — `drawRings` computes `rr = g.max * (0.15 + 0.85*k)` (2990). `RT.calls[]` stores no starting life, so a call has no age fraction available for a taper without adding one.

---

## 2. CALL-SITE MAP

### `spendBreath(cost)` — 2159-2173

In scope: `cost`, `st = stats()` (allocated at 2160 and **never used** — dead line), `RT.winded`, `RT.infBreath`, `RT.breath`, `RT.silence`.

Visuals today: only on the zero crossing (2165-2171) — `ach('winded')`, `slam('WINDED', '#8a8090', 'doubled over, and everything can see you')` (2168), `sfx('winded')`, `say(...)`.

Hook: the *ordinary* spend is silent. `RT.breath` before and after the subtraction is right here, and so is `RT.silence` (zeroed at 2164), which is the "you have been talking" signal the whole breath economy runs on. A breath-drain wisp off the player, or the depth of the WINDED punch scaled by `cost`, both fit without restructuring. Called from `doCall` 2381, `doSwallow` 2408, `doRhyme` 2574, `doStanza` 2892.

### `doCall()` — 2376-2399

In scope by line 2392: `st = stats()` (2380), `word` (lowercase, from `headWord()`), `fam` (2384), `couplet` (2385, `RT.lastSaidFam === fam`), `a` = the aim angle (2388), `RT.px/RT.py`, `RT.mouse.wx/wy`, `RT.nCalls` (2389).

Visuals today:
- `RT.casting = { t: 0.13, max: 0.13 }` (2383) — the only cast-pose signal. **It carries no family.** `drawActor` reads it at 2114 and raises the lantern arm (2129-2130) and swells the lantern glow (2135-2137), always in `rgba(255,190,90)`.
- `RT.calls.push({...})` (2390-2392) — the projectile. `word` uppercased, `fam`, `couplet` flag, `hit: []`.
- `if (couplet) typo(RT.px, RT.py + 0.5, 'couplet', FAMS[fam].col, 0.6, 10, 'drift')` (2394).
- `sfx('call')` (2397).

Hooks without restructuring: add `fam` and `couplet` to the `RT.casting` literal at 2383 (one token each) and `drawActor` gets a family-coloured muzzle. A launch burst at the barrel point (`RT.px + cos(a)*0.5`, computed at 2390) is a one-line insert. `couplet` is a free intensity multiplier that currently buys one 10px word.

### `doSwallow()` — 2403-2419

In scope: `word` (2407), `RT.px/RT.py`. `WORDS[word]` gives the family it *would* have been; `poemSwallow` (2415) uses exactly that at 2277.

Visuals today: `typo(RT.px, RT.py + 0.3, word.toUpperCase(), '#6a5f72', 0.55, 11, 'drift')` (2416) and `sfx('empty')`. Deliberately grey — the word is being binned.

Hook: this is the only "un-cast" in the game. A word crumbling / being struck through in its own family colour, then greying, reads the fiction. `WORDS[word]` is in scope and unused for the visual.

### `stepCalls(dt)` — 2420-2436

Per call `c` in scope: `c.x, c.y, c.vx, c.vy, c.life, c.word, c.fam, c.hit, c.couplet`. Also `f = firstFoeAt(c.x, c.y, 0.45, c.hit)` (2426).

Visuals today: **the entire trail is one line.** 2424-2425:
```js
if (Math.random() < 0.6) part({ x: c.x, y: c.y, z: 26 + rnd(-3,3), vx:0, vy:0, vz: rnd(2,10),
    life: rnd(0.15,0.35), size: rnd(1,2.4), col: hex2rgb(FAMS[c.fam].col), add: 1, grav: 0 });
```
Frame-rate dependent: a 0.6 probability per frame emits 2.4× as many particles at 144Hz as at 60Hz. Should be `dt`-driven; it is a real (if invisible) bug and the right place to fix it while replacing it.

Hook: per-family trail matter goes here and only here. `c.couplet` is available and unused by any visual after `landCall`. There is no age fraction (`c.life` counts down from `T('callRange')/13` and the start is not stored), so a taper needs one added field to the literal at 2390.

Despawn at 2434 (out of bounds or expired) produces **nothing at all** — a call that misses just vanishes. That is a hook: a syllable falling on the ground and going out.

### `landCall(f, c)` — 2442-2458

In scope: `f` (the foe, full object), `c` (the projectile, with `c.fam`, `c.word`, `c.couplet`), `st = stats()` (2443), `dmg` after multipliers (2444-2446: `st.callDmg * famDmgMul(c.fam) * deafMul(f, c.fam)`, then `*= 1 + T('coupletDmg')`).

Visuals today:
- 2447: deaf case, `typo(f.x, f.y, 'deaf', '#6a5f72', 0.4, 8, 'drift')`.
- 2448: `hurtFoe(f, dmg, c.fam, { call: 1 })` — which itself pops a white damage number at 2855.
- 2450: `typo(f.x, f.y, c.word, FAMS[c.fam].col, 0.5, 13, 'pop')` — "deliberately underwhelming", per the comment.
- 2451: `burst(f.x, f.y, 26, 5, {col: hex2rgb(FAMS[c.fam].col), sp0:0.3, sp1:1.3, l0:0.15, l1:0.4})`.
- 2456: `RT.shake = shake(0.7, 4)` — capped at 4.
- 2457: `sfx('hit')`.
- 2452-2455: `addStack` once, plus `Math.round(T('coupletStacks'))` more if `c.couplet`.

**Power thrown away here:** `dmg` is fully computed at 2446 and used only as an argument. Nothing scales off it. `f.stacks.length` *after* the adds (2452-2455) is the "this pile is getting dangerous" number and is never read. The impact is identical whether it is the first syllable on a fresh mouth or the eighth on an elite.

### `addStack(f, fam)` — 2461-2469

In scope: `f`, `fam`, `st = stats()` (2466), and after the push, `f.stacks.length` and `st.stackMax`.

Visuals today: **one**, and only on refusal — `typo(f.x, f.y, 'NO RHYME', '#8a8090', 0.55, 9, 'drift')` for `f.def.norhyme` (2462-2464). A successful stack has no visual of its own at all; the syllable simply appears in `drawStacks` on the next frame.

Line 2468 `while (f.stacks.length > st.stackMax) f.stacks.shift()` silently discards the oldest at the cap. A player at max stacks gets no feedback that they are wasting breath.

Hooks: the syllable arriving (a letter dropping into the row), and the overflow at 2468 (the oldest one falling off the plate). Both need only `f`, the new stack object, and its index. This is the correct place to stamp a `_born`-style visual seed onto the new stack entry, since the literal is right there at 2467.

### `stepStacks(dt)` — 2470-2480

In scope: `st = stats()`, `f`, `j`, `s = f.stacks[j]`, `s.t` after the decrement. `RT.holdStacks` / `RT.a3Hold` freeze decay (2475).

Visuals today: none. The only expiry cue is `drawStacks`'s alpha fade, `clamp(s.t / 1.2, 0.3, 1)` (3550), which bottoms out at 0.3 and never reaches zero.

Hook: the last second before a stack goes sour is the highest-tension moment in the loop and it is currently 0.3 alpha. `s.t` crossing 1.2, 0.6, 0.3 is a free three-stage warning. Cheap: this loop already runs over every stack on every foe every frame, so a per-stack shake/flicker computed here and stored on `s` costs nothing extra.

### `breakStack(f, s)` — 2484-2502

In scope: `f`, `s` (already spliced out at 2477, so `s.fam`, `s.drone`, `s.max` still readable), `mine` (2492), `T('breakSelfDmg')`, `T('echoBreak')`, `RT.hp`, `RT.hurt`, `RT.sourN` (2499).

Visuals today:
- 2493 not-mine path: `typo(f.x, f.y, 'lapses', '#6a5f72', 0.5, 8, 'drift')`, then return.
- 2496: `typo(f.x, f.y, 'sour', '#6a5f72', 0.7, 9, 'drift')`.
- 2497: `sfx('sour')`.
- 2498: one single grey non-additive particle falling downward (`vz: -6`, `grav: 0`).
- 2495: `RT.hurt = Math.max(RT.hurt, 0.25)` — which is the red screen tint at 3901.

**`s.fam` is in scope and the visual is grey.** A sour `-ill` and a sour `-eat` look identical. The self-damage is real and bypasses i-frames (see `PARALLEL.md`), so this needs to read as an attack on the player, and today it is one grey word 9px tall.

### `doRhyme(fam)` — 2547-2669 · THE DETONATION

Top-level scope from 2560 onward: `fam`, `st = stats()`, `live` (the array of eligible foes, 2561), `word = FAMS[fam].tag` (2579), and the four accumulators declared at 2581:

```js
var totalMatched = 0, hitFoes = 0, best = 0, dragged = 0;
```

Also set before the loop: `RT.answerCd = 0.34` (2575), `RT.nAnswers++` (2576), `RT.lastRhyme = fam` (2577), `RT.casting = { t: 0.22, max: 0.22 }` (2578), `RT.lastWord`/`RT.lastFam` (2580).

**Per-foe, inside `live.forEach` 2583-2640**, in scope: `f`, `match`, `other` (2584-2585), `closed` (2587), `waxed` (2596), `takes` (2597), `n` (2598), `willDrag` (2599), `dmg` (2600-2617), and `deafMul(f, fam)`.

Branch by branch:

| branch | condition | line | damage | stacks | visual today |
|---|---|---|---|---|---|
| **closed** | `match > 0` | 2601-2602 | `(answerBase + answerPerStack*n) * famDmgMul` | filtered out, 2624 | `hurtFoe` big coloured number 2854; `famEffect` 2619; `snapStacks(f, FAMS[fam].col, n)` 2639 |
| **waxed** | `other>0 && RT.items.freeSlant>0 && !folk` | 2596-2602 | same as closed, over `match+other` | whole pile wiped, 2622 | identical to closed. The wax is mechanically enormous and visually invisible |
| **drag** | `!takes && !folk && T('slantShift')` | 2603-2613 | `answerBase * slantMul * dragMul * famDmgMul` — **flat** | `t.fam = fam; t.t *= (1-dragAge)` for every stack, 2635 | `snapStacks(f, '#6a5f72', n)` 2639. **The sounds physically change family and nothing marks it.** |
| **folk slant** | `f.def.folk` | 2625-2628 | full slant damage computed, then `hurtFoe` returns 0 at 2847 | untouched | grey snap only |
| **plain slant** | drag toggle off | 2636-2637 | `(base + perStack*n) * slantMul * famDmgMul` | whole pile wiped | grey snap only |

Accumulation, 2619-2620: `if (takes) { totalMatched += n; if (n > best) best = n; famEffect(f, fam, n); }` then `hitFoes++`.

**Resolution, 2645-2668:**

- **closed** (`totalMatched > 0`), 2645-2651: echo added; `ach('couplet')`; `ach('six')` at `best >= 6`; `ach('crowd')` at `hitFoes >= 8`; `slam(word, FAMS[fam].col, totalMatched + ' closed')` (2650); `sfx('answer')`. `slam` itself does `RT.shake = shake(9); RT.chroma = 0.5` (1444).
- **drag** (`dragged > 0`), 2652-2656: `ach('slant')`; `slam(word, FAMS[fam].col, dragged + ' dragged over')`; `RT.shake = shake(4)`; `sfx('slant')`.
- **slant with no drag** (`hitFoes > 0`), 2657-2662: `slam(word, '#6a5f72', 'slant')`; `shake(3)`; `sfx('slant')`.
- **nothing** (`else`), 2663-2668: `typo(RT.px, RT.py, word, '#4d4757', 0.5, 12, 'pop')`; `sfx('empty')`. Free, no cooldown refund, still ends the poem line.

Also 2642-2643: `poemBreak(fam)` then `assembleLine(fam, totalMatched)`.

> **THE BIGGEST PILE OF DISCARDED POWER IN THE FILE.** At line 2645 the function holds `totalMatched` (syllables spent), `best` (the largest single pile), `hitFoes` (how wide it went), `dragged`, and `fam`. All four are used only to pick an achievement and to build a subtitle string. `slam()` takes `(txt, col, sub)` and hard-codes 62px, 0.55s, `shake(9)`, `chroma = 0.5`. **A one-stack close on one mouth and a 25-stack close across eight foes produce a pixel-identical screen event.** Every requirement in the brief about scaling off power is asking for those four numbers to reach `slam` / the screen-punch layer.

Also discarded: the per-foe `dmg` (2600-2617) is never seen by the per-foe visual, and `n` reaches `snapStacks` (2639) only as a line-length term (`12 + s.n * 7`, 2811) and a particle count (`4 + n*2`, 2802).

### `assembleLine(fam, n)` — 2674-2682 and `drawAssembly` — 2683-2713

In scope in `assembleLine`: `fam`, `n` (= `totalMatched`), and the last poem line's word list, walked at 2677-2679 to collect every uncut word of that family the player actually said. Falls back to `[FAMS[fam].tag]` (2680). Stores `{ ws: ws.slice(-6), fam, t: 0.85, max: 0.85 }` (2681).

**`n` is passed in and used only as a truthiness guard at 2675.** The assembly of one word and the assembly of twenty-five are the same size, the same duration, and the same glow.

`drawAssembly` (2683-2713), screen space, no shake: 21px `Press Start 2P`, gap 22, scatter positions derived from `((i*97)%13)/13` and `((i*53)%11)/11` (2698-2699), `shadowBlur = 14*ease` (2702), a 2px rule struck under the finished line once `ease >= 1` (2707-2711). `cx.shadowBlur` on text is the one genuinely expensive call in here and it runs per word per frame.

Hooks: size/duration/scatter radius/rule weight all off `n`; family-specific set behaviour (the `-ill` line freezing into place vs the `-eat` line burning in).

### `doAnswer()` — 2717-2725

In scope: `best` (the family id, shadowing nothing), `bn` (its board count, 2718). Picks the sound with the most on the board via `boardCount(f, 1)` (2721) and delegates to `doRhyme`.

Visuals: none of its own. Called by `window.__ninth.answer()` (1583) and nothing else in play. Note `bn` — the count that made it pick — is thrown away and not passed on.

### `doReprise()` — 2736-2751

In scope: `word` (2741, from `RT.lastWord || S.answer || 'again'`), `fam` (2742, `RT.lastFam || answerFam()`), `RT.echo` (zeroed at 2740), `T('repriseHits')`, `T('repriseGap')`.

Visuals today:
- refusal path 2739: `hudNudge('echo')` + `typo(RT.px, RT.py, 'NOT YET', '#6a5f72', 0.5, 10, 'pop')`.
- 2745: `RT.dilate = Math.max(RT.dilate, 0.5)` — half a second of 30% time, plus the 3859 dim overlay.
- 2746: `slam(word, FAMS[fam].col, 'reprise')`.
- 2747: `bigLine('again', 'and again, and again', FAMS[fam].col, 2)`.
- 2748: `RT.shake = shake(9); RT.chroma = 1` — **the only place in the file that sets chroma to 1, and it is read by nothing.**
- 2749: `sfx('reprise'); sfx('verse')`.

This is a full-Echo-bar spend, i.e. the single most expensive button in the game, and its unique visual is a `bigLine`. `RT.combat.rep` is set at 2743 as `{n, t, gap, word, fam}` and is a live, drawable object for the whole 3-beat duration that nothing draws.

### `stepReprise(dt)` — 2752-2784

In scope: `r = RT.combat.rep` (`r.n`, `r.t`, `r.gap`, `r.word`, `r.fam`), `last = r.n <= 0` (2762), `st = stats()`, `hit` (2763), and per foe `f` and `n = f.stacks.length` (2771) and `dmg` (2773).

Visuals today:
- per foe: `hurtFoe` number (2774), `famEffect(f, r.fam, n, 1)` with `noHeal` (2775), `snapStacks(f, FAMS[r.fam].col, n)` (2777).
- once per beat: `RT.rings.push({x: RT.px, y: RT.py, r: 0.5, max: 13, col, t: 0.5, life: 0.5})` (2780) — one flat ellipse; `if (hit) RT.shake = shake(5)` (2781); `typo(RT.px, RT.py + 0.4, r.word, FAMS[r.fam].col, 0.6, 15, 'pop')` (2782).

`hit` (how many foes the beat found) is computed at 2778 and used only as a boolean at 2781. `r.n` (which of the three beats this is) is in scope and unused visually — beats one, two and three are identical, when the obvious design is escalation.

### `snapStacks(f, col, n)` — 2800-2803 and `drawSnaps` — 2804-2815

The single shared "a stack detonated on this body" visual. Three callers: `doRhyme` 2639, `stepReprise` 2777, and nothing else.

```js
RT.snaps.push({ x: f.x, y: f.y, col: col, n: n, t: 0.32, max: 0.32 });
burst(f.x, f.y, 30, 4 + n * 2, { col: hex2rgb(col), sp0: 0.5, sp1: 2.4, l0: 0.2, l1: 0.6 });
```
`drawSnaps` (2804-2815): a **2px horizontal line** at `isoY(...) + TILE_H/2 - 44`, half-width `12 + s.n * 7`, shrinking to zero over 0.32s, alpha `1 - k`. That is it. **This is the whole "your rhyme just went off on this enemy" language.**

Note the hard-coded `- 44`: it does not use `FOE_H`, so on a Mouth (h 24) the line floats well above the head and on the Chorus (h 130) it cuts through the body. `f` is passed in whole, so `FOE_H[f.def.draw]` is available here at zero cost.

`n` is the per-foe stack count and it is the only power term reaching a world-space visual anywhere in the detonation. `col` is a hex string, already reduced to "family colour or grey" by the caller at 2639 — **the family id itself is not passed**, so a per-family snap needs one extra argument. Both call sites have `fam` / `r.fam` in scope.

Budget: 8 foes × 8 stacks = 8 snaps and `8 * (4+16) = 160` particles in one frame, plus 8 `hurtFoe` typos and 8 `famEffect` typos = 16 typos against a 60 cap. The ending detonates on 25 folk at once (`a3Mark`, n=1 each): 25 snaps, 150 particles, 25 typos → the typo array shifts.

### `famEffect(f, fam, n, noHeal)` — 2820-2842 · THE ONLY PER-FAMILY DIFFERENCE

Callers: `doRhyme` 2619 (n = stacks closed), `stepReprise` 2775 (n = whole pile, `noHeal` set), `stanzaWave` 2925 (n = `big ? 3 : 1`).

In scope: `f` (full foe), `fam`, `n`, `noHeal`, and inside each branch the status field it just wrote.

| fam | line | mechanics | visual |
|---|---|---|---|
| `eat` | 2821-2826 | `f.burn = {dps: 5*n, t: 3}`; heals you `n*1.5` unless `noHeal` | `typo(f.x, f.y, 'BURN', FAMS.eat.col, 0.5, 10, 'drift')` |
| `ight` | 2827-2829 | `f.revealed = 5; f.armor = 0` | `typo(..., 'SEEN', ..., 0.5, 10, 'drift')` |
| `erd` | 2830-2832 | `f.silence = 1.6 + n*0.25; f.state='walk'; f.tell=0` | `typo(..., 'HUSH', ..., 0.5, 10, 'drift')` |
| `ark` | 2833-2836 | `f.burn = {dps: 3.5*n, t: 5}`; `RT.conceal = 4` | `typo(..., 'DARK', ..., 0.5, 10, 'drift')` |
| `ill` | 2837-2840 | `f.frozen = 1.4 + n*0.2`; executes under 18% hp (non-boss) | `typo(..., 'STILL', ..., 0.7, 13, 'drift')` **only on execute** |

**Five families, five 10px drifting words in five different colours. That is the entire elemental vocabulary of the game.** Every branch has `n` in hand and every branch's duration and strength already scales with `n` while the visual does not.

The `-eat` heal at 2825 (`RT.hp = Math.min(RT.hpm, RT.hp + n*1.5)`) is a player-side event with **no visual at all** — no number, no flash, nothing.

The `-ark` `RT.conceal = 4` at 2835 is a player-side buff with **no visual at all**. It is read at 3320 and 3329 by the Thief and shown only as the Thief's own `'???'`.

### Status rendering today — all wide open

- **`f.burn`** (`-eat` and `-ark`): drawn **nowhere**. The only mark is one 2px orange particle emitted every 0.5s inside `stepFoes` at 3073, hard-coded `col: '255,140,60'` — so an `-ark` burn (shadow, purple) emits orange embers. The tick at 3072 also passes `'eat'` as the family regardless of which family lit it.
- **`f.silence`** (`-erd`): drawn **nothing**. Read at 3055 (decay), 3079 (skip AI), 3529 (debug text only).
- **`f.revealed`** (`-ight`): tints the health bar and nothing else — 3522, `f.revealed > 0 ? FAMS.ight.col : '#c9484a'`. Also `dmg *= 1.25` at 2849. The armour strip at 2828 is invisible unless the foe happens to be `sealed`, whose `plate` mark drops from 0.85 to 0.2 alpha (3733).
- **`f.frozen`** (`-ill`): line 3515, one flat rectangle:
  ```js
  if (f.frozen > 0) { cx.globalAlpha = 0.45; cx.fillStyle = '#cfeeff'; cx.fillRect(-f.r*22, -h, f.r*44, h); cx.globalAlpha = 1; }
  ```
  Directly above it at 3513-3514 is the hit flash, the same rect in `#fff` with `'lighter'`.

All four sit inside `drawFoe`'s body transform (`cx.save()` 3509 … `cx.restore()` 3516), which is already `translate(sx, sy - |wob|*0.4); scale(pop, pop)`. `h`, `f.r`, `f.anim`, `RT.t` and `RT.rdt` are all in scope there.

### `hurtFoe(f, dmg, fam, o)` — 2845-2858

In scope: `f`, `dmg` (pre- and post-modifier), `fam`, and the options bag `o` with `{call}`, `{answer, closed, n}`, `{dot}`, `{exec}`. Multipliers applied here: `RT.oneShot` (2848), `f.revealed > 0 → *1.25` (2849), `f.armor` subtraction (2850), round and floor at 1 (2851).

Visuals today:
- 2853: `f.flash = 0.09` (the white rect at 3513) and `f.wob = min(1, f.wob + 0.5)` (the sine wobble at 3481 and the vertical nudge at 3509).
- 2854: answer numbers — `typo(f.x + rnd(-.2,.2), f.y, String(dmg), o.closed ? FAMS[fam].col : '#8a8090', 0.8, o.closed ? 16 : 12, 'drift')`.
- 2855: everything else — `typo(..., 'rgba(230,225,240,.9)', 0.55, 10, 'drift')`. Suppressed for `o.dot`.
- 2856: `foeDie` on lethal.

`o.n` is passed by every answer path (2618, 2774, 2924, 2956) and read by **nothing** in this function. The damage number already scales its size 12→16 on `closed`; that is the only size scaling in the game. `dmg` relative to `f.hpm` (i.e. "that was a quarter of its life") is computable here and is not.

Called from: `landCall` 2448, `doRhyme` 2618, `stepReprise` 2774, `famEffect` execute 2839, burn tick 3072, thief steal 3333, `stanzaWave` 2924, `doVerse` 2956.

### `foeDie(f, quiet)` — 3419-3439

In scope: `f` (position, `f.def`, `f.m`, `f.hpm`, `f.stacks` — **still populated**, nothing clears them on death), `boss` (3422), `rgb` (3423), `c` = coin (3426).

Visuals today:
- 3424: `burst(f.x, f.y, 14, boss ? 50 : 16, {col: rgb, sp0:0.6, sp1: boss?3.6:2.4, l0:0.3, l1:1, add: 0, grav: 140})`. Grey, non-additive.
- 3425: `deathLine(f)` → `RT.combat.cuts.push(...)` (3417), the cut-off last word, drawn at 3774-3799 with a clip and a caesura bar. This is the best-looking effect in the file and it is monochrome.
- 3428: `coin(c, f.x, f.y)` → `typo` gold `+n` at 526.
- 3436: `sfx('die')`, plus `sfx('bossdie')`.

**Thrown away:** whether the kill was a detonation or a call, which family did it, and `f.stacks` at the moment of death. `hurtFoe` knows the family (2845) but does not pass it down (2856 is a bare `foeDie(f)`). A `-ill` execute and a chip death from a burn tick look the same.

`onChorusDown` 3440-3446: `RT.shake = shake(14); RT.flash = 0.5` (3442) — the only `RT.flash` writer in the game — plus `bigLine('the refrain stops', '', '#d2c8e1', 3)`.

### `doStanza(n)` — 2886-2900

In scope: `n` (1-3), `sz = STANZAS[n-1]` (2888) with `sz.fam`, `sz.lines`, `sz.cd`, `sz.cost`, `sz.bal`, `sz.frag`.

Visuals today: `RT.dilate = T('dilationT')` (2894, default 1.5s) which drives the 3859 dim overlay and the 3809 time scale; `RT.recital = {sz, t: 0, line: -1, n}` (2895); `sfx('stanza')`. **The cast itself has no visual.** The screen dims and then `stepRecital` starts writing lines 0.375s later.

### `stepRecital(dt)` — 2901-2913

Runs on `real` (called at 3834 with `real || dt`). In scope: `r` (`r.sz`, `r.t`, `r.line`, `r.n`), `dur = T('dilationT')`, `want` (2905), `isLast` (2908).

Visuals: 2909 `bigLine(r.sz.lines[r.line], isLast ? <last word, uppercased> : '', FAMS[r.sz.fam].col, 1.1)`, then `stanzaWave(r.sz, isLast)` (2910). Lines stack vertically via `y = VH*0.3 + i*44` in `drawLines` (1489).

Hook: `r.line` (0-3) is the escalation index and only `isLast` is used.

### `stanzaWave(sz, big)` — 2915-2928

In scope: `sz`, `big`, `st`, `dmg` (2917), the radius `big ? 7.5 : 5.5` (2918/2922), `RT.px/RT.py`, and per foe `f`.

Visuals today:
- 2918: `RT.rings.push({x: RT.px, y: RT.py, r: 0.4, max: big?7.5:5.5, col: hex2rgb(FAMS[sz.fam].col), t: 0.5, life: 0.5})` — one flat ellipse ring.
- 2919: `RT.shake = shake(big ? 10 : 4)`.
- 2923: deaf `typo`.
- 2924-2925: `hurtFoe` then `famEffect(f, sz.fam, big ? 3 : 1)`.
- 2927: `sfx(big ? 'wave2' : 'wave')`.

The ring is drawn at 3865, i.e. **under every body**, so a stanza wave passes beneath the enemies it is hitting.

### `doVerse()` — 2934-2983

In scope: `S.verse`, `S.a3.verseSpent`, `RT.verseCast`, and inside the nested `setTimeout` chain (2952-2967) `st`, `k` (stanza index 0-6), `ln`, `j` (line index 0-3), `i` (the global 260ms step counter).

Visuals today:
- 2948: `RT.dilate = 6; RT.mono = 8.4`. `RT.mono` is the `'saturation'` composite wipe at 3907-3914 and this is its only writer.
- 2954: `bigLine(ln, '', k===6 && j===3 ? '#ffe66e' : '#f0e9df', 1.4)` per line, one every 260ms, 28 lines total.
- 2956-2957: on every 4th line, `hurtFoe(f, 999, 'ight', {answer:1, closed:1, n:4})` on everything, then `RT.shake = shake(12)`.
- 2964-2965: four seated folk stand up per stanza end.

This is the climax of the game and it is `bigLine` × 28 plus a saturation wipe. `k` and `j` give a clean 0-1 progress ramp through the whole ballad and neither is used for intensity. No family colouring at all except the last line's `#ffe66e`.

### The act's magic beats (job 1 territory, but they call the same primitives)

- `a3Mark` 5575-5583: pushes the 999s `-ill` stack onto every folk. `bigLine('one open line on every person in the square', '', '#6fd4ff', 3.4)` at 5618. 25 stacks appear with no arrival visual.
- `a3DeadCall` 5689-5695: the call that builds nothing. `bigLine(lie, '', '#8a8090', 2.8)`.
- `a3Answered` 5764-5785: wrong sound. `slam(FAMS[RT.lastRhyme || 'eat'].tag, '#6a5f72', 'slant')` (5770).
- `a3True` 5861-5874: `bigLine('but for the girl who never will.', '', '#6fd4ff', 3.4)` + `shake(10)`.
- `heldOpen(f)` 5557-5560 gates folk out of `live` (2561), `boardCount` (2521), `boardTotal` (2529) until cue 3.

---

## 3. POWER ALREADY COMPUTED AND DISCARDED — the short list

| value | computed at | consumed by | wasted on |
|---|---|---|---|
| `totalMatched` | 2581/2619 | echo (2646), subtitle string (2650) | screen intensity, slam size, zoom, chroma |
| `best` (largest single pile) | 2581/2619 | `ach('six')` (2648) | **nothing else at all** |
| `hitFoes` | 2581/2620 | `ach('crowd')` (2649), branch test (2657) | screen-wide vs single-target read |
| `dragged` | 2581/2635 | subtitle string (2654) | the drag has no world-space visual whatsoever |
| per-foe `n` | 2598 | `hurtFoe` `o.n` (ignored), `famEffect`, `snapStacks` line length | per-foe detonation size |
| per-foe `dmg` | 2600-2617 | `hurtFoe` argument | nothing reads it after rounding |
| `o.n` in `hurtFoe` | passed by 4 call sites | **nothing** | 2845-2858 never touches it |
| `assembleLine`'s `n` | 2674 | truthiness guard 2675 | assembly size, duration, scatter |
| `landCall` `dmg` + `c.couplet` | 2444-2446 | damage only | impact scale |
| `stepReprise` `hit`, `r.n` | 2778, 2756 | boolean at 2781 | beat-over-beat escalation |
| `f.hp / f.hpm` after damage | free in `hurtFoe` | health bar only | "that was most of its life" |
| `famEffect` `n` | argument | duration/dps maths | every one of the five visuals |
| `RT.chroma` | written 1444, 2748 | **read by nothing** | it is the chromatic aberration channel, already plumbed and decaying at 3841 |

---

## 4. SCREEN-PUNCH WIRING POINTS

- **Hitstop** — `RT.timeScale` (init 1557, multiplied in 3809, reset 6128). Must be decayed with `real`, not `dt`, inside `step` (which receives `real` as its second parameter at 3814). Writers today: dev row 1005 only.
- **Chromatic aberration** — `RT.chroma`, init 1557, written 1444 (`0.5` on every slam) and 2748 (`1` on reprise), decayed 3841 (`dt * 2.4` — note: sim clock, so it lasts 3× longer during a stanza). Read by nothing. The cheap read-out point is a screen-space pass after 3921, or the existing crude split inside `drawSlams` at 3458-3461 which currently hard-codes `rgba(255,60,90)` / `rgba(60,180,255)` and is not family-aware.
- **Zoom punch** — no hook exists. The only global transform is the shake translate at 3853. A scale about `(VW/2, VH/2)` would sit in that same `cx.save()` block; note the floor blit at 3857 and the clearRect margin at 3854 (`-30, -30, VW+60, VH+60`) assume translation only.
- **Shake** — `shake(a, cap)` at 1505 already returns early when `!S.opts.shake`, and 3853 gates again. Cap defaults to 14. Current values: 0.7/cap 4 (call), 3 (slant), 4 (drag, hurtPlayer), 5 (reprise beat), 8 (chorus pulse), 9 (slam, reprise), 10 (stanza big, a3True), 12 (verse), 14 (chorus down).
- **Bloom / family colour wash** — no hook. `RT.flash` (3900) is the nearest thing: one flat `rgba(255,250,235, flash*0.5)` with exactly one writer (3442). It has no colour field. `RT.mono` (3907) shows the pattern for a full-screen composite pass.
- **The options toggle.** `S.opts` is the persisted bag (456-463) with `wasd`, `shake`, `sound`, `vol`, and `bigtext` — **`bigtext` is defaulted and read by nothing, an orphan.** There is no player-facing options panel; `S.opts.shake/sound/wasd` are exposed through DEV → DEBUG rows 1012-1014. A new toggle is: one `sLoad` default line in the block at 456-463, one `tgl` row appended to DEBUG (1007-1039) or FEEL (926-968), and `sSave()` in the setter. Per `PARALLEL.md`, a tunable number is two edits — the `TUNE` default (158-188) plus a FEEL `num` row.

---

## 5. BUDGET AND CORRECTNESS TRAPS FOR WHOEVER BUILDS THIS

1. **The 900 particle cap** (1385) is a silent drop, not a queue. A detonation on 8 foes × 8 stacks already asks for 160 from `snapStacks` alone. Anything richer needs its own budget, not more `part()` calls.
2. **The 60 typo cap** (1420) shifts the oldest out. Eight foes already produce 16 typos per detonation; the ending produces 25 at once.
3. **`stats()` and `charmSum()` allocate on every call** (483-512) and are already called per-hit. `famDmgMul` (513) calls `charmSum()` again. Do not add another `stats()` inside a per-foe or per-particle loop.
4. **`createRadialGradient` per particle per frame is out.** The existing precedent for caching is `bake(key, rows, pal)` at 1841-1859 (keyed offscreen canvas, `SPR{}`, never evicted) and `propSprite` at 6477-6497 (LRU with a 10MB `SPRITE_BUDGET`, `trimSprites` at 6523). `FLOORS` is the cautionary tale: unbounded, ~2.6MB per entry, never freed.
5. **`imageSmoothingEnabled = false`** is set once on the context (1570). Any new offscreen canvas gets its own context and its own default of `true`.
6. **Ground-plane geometry** is always `translate(sx, sy); scale(1, 0.5)` then a full-radius `arc` — see 2992-2995, 3490-3492, 3499-3503, 3728, 3737. Radius in tiles × `TILE_W / 2`.
7. **The dilated clock.** `drawSlams`, `drawTypo`, `drawSnaps`, `drawAssembly`, `drawCuts`, `drawLines`, `drawRings` all receive real dt from `draw()` and therefore do NOT slow down in a stanza, while `stepStacks`, `stepFoes` and `stepParts` do. A new effect must pick a side deliberately. `RT.shake` and `RT.chroma` decay on the sim clock (3840-3841) and therefore last 3.3× longer during a recital; `RT.dilate` and `RT.mono` decay on real (3816-3817).
8. **`stepCalls`' trail probability is frame-rate dependent** (2424, `Math.random() < 0.6` per frame). Fix it when you replace it.
9. **`snapStacks`' `- 44`** (2809) is a magic number that ignores `FOE_H`. `f` is in scope at 2800 and is not stored on the snap; storing `FOE_H[f.def.draw]` there is the fix.
10. **`RT.parts`, `RT.snaps`, `RT.rings` and `RT.assembly` survive a doorway** (6124-6129 does not touch them). Register an `onPlaceChange` next to any new array, the way `combatBoot` does at 2793-2796.
11. **`f.stacks` is reassigned at 2624**, so no cached reference to the array is valid across a close.
12. **`hurtFoe` returns 0 immediately for folk** (2847), but `doRhyme` still runs `snapStacks` on them (2639) and `hitFoes++` (2620). Twenty-five audience members will each take the full per-foe detonation visual at the climax of the game. Budget for it or gate on `f.def.folk`.

=== RECON: render ===
# NINTH NIGHT rendering primitives: a VFX author's map

All line numbers are against `C:/Users/isaac/IsaacUre.github.io/.claude/worktrees/suspicious-driscoll-00fbd8/comp/ninth.js` at HEAD (8279 lines).

---

## 0. The four things you must know before you touch anything

### 0.1 There are three clocks and the draw layer is on the wrong one

`frame(now)` (3802) computes `real = min(0.05, elapsed)`, then:

```js
var scale = RT.timeScale * (RT.dilate > 0 ? T('dilation') : 1);   // 3809
step(real * scale, real);                                          // 3810
draw(real);                                                        // 3811
```

- **Sim clock** = `dt` inside `step()`. Dilated to 30% during a stanza, multiplied by `RT.timeScale`. Drives `RT.t` (3815), `stepParts` (3833), all foe timers, `RT.shake`/`RT.chroma`/`RT.flash` decay (3840-3842).
- **Real clock** = `rdt` inside `draw()`, clamped to 0.05 at 3850. Drives every typographic timer (see 0.2).
- **`ac.currentTime`** for audio, documented at 3988-4010.

**Consequence you will hit immediately:** during a stanza recital, `drawTypo`/`drawSlams`/`drawSnaps`/`drawRings`/`drawCuts`/`drawAssembly`/`drawLines` all run at full speed while `stepParts` crawls at 30%. Words and rings finish while the sparks are still hanging in the air. If you want matter and typography to move together during dilation you have to pick one clock and pass it explicitly.

Second consequence: `RT.shake`, `RT.chroma` and `RT.flash` decay on the **sim** clock (3840-3842), so during a stanza they last 3.3x longer than intended. `RT.dilate` and `RT.mono` deliberately decay on real time (3816-3817).

### 0.2 Seven draw functions mutate their own lists while drawing

These decrement a timer and `splice()` inside the draw loop:

| function | line | mutation |
|---|---|---|
| `drawTypo` | 1424-1425 | `w.life -= dt`, splice |
| `drawSlams` | 1448-1449 | `s.t -= dt`, splice |
| `drawLines` | 1482 / 1485-1486 | `L.age += dt` or `L.t -= dt`, splice |
| `drawAssembly` | 2685-2686 | `a.t -= dt`, nulls `RT.assembly` |
| `drawSnaps` | 2806-2807 | `s.t -= dt`, splice |
| `drawRings` | 2988-2989 | `g.t -= dt`, splice |
| `drawCuts` | 3777-3778 | `c.t -= dt`, splice |

**If you build an additive bloom pass that re-draws any of these lists, everything in them ages twice per frame and half your effects vanish.** All seven are safe to call with `dt = 0` (they only subtract and derive `k` from the remainder), so the cheap fix for a second pass is `drawTypo(cx, 0)`. The clean fix is to split each into `stepX(dt)` / `drawX(cx)`. Nothing else in the file does the step-inside-draw thing: `stepParts` (1393) and `drawParts` (1401) are already properly split, and are the model to copy.

`drawProp` also mutates while drawing: it writes the cutaway fade into `RT.world.cut[o._ci]` at 6650 using `RT.rdt`, and `RT.rdt` is set once per frame at 3881. A second pass over props would double-ease the cutaway.

### 0.3 Two seams, and what is inside the shake transform

`draw()` (3847-3932) in order:

```
3851  startBuildBudget()
3852  cx.save()                       <-- shake transform opens
3853  shake translate (if S.opts.shake && RT.shake > 0.2)
3854  clearRect(-30,-30,VW+60,VH+60)  <-- the margins exist because of the shake
3855-3857  buildFloor + full-bitmap drawImage
3859-3862  dilate wash (full screen fill)
3863  drawExits        world, ground level
3864  drawLooks        world
3865  drawRings        world, ground level, UNDER everything
3866-3871 move-to marker
3875-3891 ents[]: foes, npcs, props, player. built, sorted, called
3892  drawLights       full-screen darkness + per-light radial gradients
3893  drawVignette     full-screen radial gradient
3894  drawCalls        world
3895  drawFproj        world
3896  drawParts        world
3897  drawCuts         world      <-- job 4's world-space seam entry
3898  drawSnaps        world      <-- job 4's world-space seam entry
3899  drawTypo         world
3900  flash            full screen
3901  hurt/dead red    full screen
3902  drawPrompt       world
3907-3914 mono 'saturation' pass, full screen
3915  cx.restore()                    <-- shake transform closes
3916  drawAssembly     SCREEN
3917  drawSlams        SCREEN
3918  drawLines        SCREEN
3919  drawBossBar      SCREEN
3920  drawToasts       SCREEN
3921  drawMap          SCREEN
3922-3931 perf readout, death text
```

`PARALLEL.md` names the two seams: world space goes between `drawParts` and `drawTypo`, screen space goes after `drawMap`. One call per job.

The thing that matters for this overhaul: **anything drawn before line 3892 gets dimmed by the night wash.** `drawLights` lays `rgba(6,5,14,.66)` over the whole canvas at `night >= 2`, `.5` otherwise (7835). So foe bodies, `drawStacks` plates, `drawMod` marks, the frozen tint and `drawRings` are all darkened by up to 66%, while particles, calls, cuts, snaps and typo are not. If a family effect is meant to look like it is lighting the room, it has to go after 3892 or it will read as murky.

`drawRings` at 3865 is under the props. A ground shockwave from a detonation currently draws *behind* a house.

### 0.4 Coordinate spaces

- `isoX(x,y)` / `isoY(x,y)` (60-61) take **world tiles** and return **screen pixels with the camera already subtracted**. Do not add the camera back.
- The universal ground-point idiom is `sy = isoY(x, y) + TILE_H / 2`. Every world-space drawer uses it.
- **`z` in the particle and typo systems is screen pixels of height, not tiles.** `drawParts` at 1403 does `- p.z`; `typo` hardcodes `z: 40` at 1419.
- Ground ellipses are `translate(sx, sy); scale(1, 0.5)` then a circle: 1490-1492, 2992, 3728, 3868, 3894, 6704 area. `TILE_W = 58`, `TILE_H = 29` (46). A ring of radius `r` tiles is `arc(0, 0, r * TILE_W / 2, ...)` inside that scale.
- Canvas backing store is 1120x580 (`VW`/`VH`, 45) but CSS stretches it (`comp.css:2919`, `width:100%;height:100%;object-fit:contain`) with `image-rendering: pixelated` (`comp.css:3204`). One canvas pixel is not one device pixel. A 1px chromatic offset will be visible as more than 1px on most screens.
- `RT.cx.imageSmoothingEnabled = false`, set once at 1570, never touched again. It **is** part of the state saved by `save()`/`restore()`, so `cx.save(); cx.imageSmoothingEnabled = true; ...; cx.restore()` is the safe way to get a smooth blit.

---

## 1. Particles

### `part(p)` — 1385
```js
function part(p) { p.max = p.life; if (RT.parts.length < 900) RT.parts.push(p); }
```
Fields read downstream: `x, y` (world tiles), `z` (screen px), `vx, vy` (tiles/s), `vz` (px/s), `life` (s), `max`, `size` (px), `col` (an **`"r,g,b"` string**, not a hex, see `hex2rgb` at 2859), `add` (truthy = `'lighter'`), `grav` (px/s²).

**The cap is checked per push, not per burst.** A `burst` of 200 issued when 850 are live silently drops 150, and it drops the *tail*. A detonation loop that emits per foe will starve the last foes in the loop and there is no signal. Space: world. Clock: none (it is a constructor).

### `burst(x, y, z, n, o)` — 1386-1392
Options with defaults: `sp0 .4, sp1 2.2, vz0 15, vz1 80, l0 .3, l1 .9, s0 1.4, s1 3.2, col, add 1, grav 130`. `z` is jittered `+rnd(-3,5)`.

Existing emitters and their sizes, so you know what the current vocabulary costs:

| site | line | count |
|---|---|---|
| dash | 1764 | 10 |
| call trail | 2424 | 1 per frame at 60% chance, per live call |
| call lands | 2451 | 5 |
| stack goes sour | 2498 | 1 |
| `snapStacks` | 2802 | `4 + n * 2` |
| foe spawn | 3044 | 8 |
| burn tick | 3073 | 1 every 0.5s per burning foe |
| foe death | 3424 | 16, or 50 for a boss |

### `stepParts(dt)` — 1393-1400
Sim clock. Reverse loop with `splice`. Bounces at `z < 0` with `vz *= -0.28`.

### `drawParts(cx)` — 1401-1410
Per particle, per frame:
```js
cx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
cx.fillStyle = 'rgba(' + p.col + ',' + clamp(...).toFixed(3) + ')';
cx.fillRect(...);
```
Three real costs here. A string concatenation **plus a `toFixed(3)` allocation** per particle per frame; a CSS colour **parse** per particle per frame; and a composite-op state change per particle (not batched by `add`). At the 900 cap that is 1800 short-lived strings and 900 style parses every frame, 144 times a second. No frustum cull: all 900 are drawn even on the 11x34 road where most are off screen.

If you are going to lean on particles for "matter", this function is the first thing worth rewriting: sort by `add`, and quantise alpha to 16 steps so the `fillStyle` strings can come out of a memo table the way `shadeHex` (6601) already memoises shades.

`RT.parts` is **never cleared on travel**. `gotoPlace` clears foes, fproj, calls, beats, typo, slams and lines (6124-6125) and nothing else. Particles, snaps, rings and `RT.assembly` all survive a doorway and keep drawing at their old world coordinates in the new place.

---

## 2. Typography

### `typo(x, y, txt, col, life, size, style)` — 1418-1421
World point. `size` defaults 15, `style` defaults `'pop'` (the other is `'drift'`). Pushes onto `RT.typo` and **`shift()`s the oldest once past 60** (1420). A detonation on the 25-person square already produces 25 of these from `hurtFoe` alone, so the cap is reachable in one keypress.

### `drawTypo(cx, dt)` — 1422-1438
Real clock, mutates. `a = clamp(life/max * 1.6, 0, 1)`, `k = 1 - life/max`. `'drift'` rises 34px over its life; `'pop'` starts 10px up, rises 16 more, and scales `0.7 -> 1.2`. Font is always `bold Npx "Press Start 2P"`. Draws a hard `#08060c` shadow at +2,+2 then the fill. Leaves `textAlign = 'left'` on exit (1437) which is the file's convention: **every text drawer resets `textAlign` to `'left'` on the way out** (1437, 1467, 1503, 3507, 3564, 3718, 3762, 3930, 3969, 8015). Match it or you will break the HUD.

### `slam(txt, col, sub)` — 1442-1445
```js
RT.slams.push({ txt, col, sub, t: 0.55, max: 0.55 });
RT.shake = shake(9); RT.chroma = 0.5;
```
No arguments for size or duration. Every slam in the game is 62px and 0.55s. This is the function that most obviously wants a `power` argument.

### `drawSlams(cx, dt)` — 1446-1468
**Screen space, outside the shake transform.** Anchored at `VW/2, VH*0.44`. Scale punches `2.6 -> 1` over the first 18% then drifts out to `1.13`. Alpha holds at 1 until `k = 0.18` then falls. The chromatic split at 1458-1461 is two `'lighter'` fills at `±3 * (1-k)` px in `rgba(255,60,90,.55)` and `rgba(60,180,255,.55)`, drawn *under* the solid text. This is the existing, working, cheap aberration idiom in this codebase and it is per-draw-site, not a post pass.

### `bigLine(txt, sub, col, dur, pin)` — 1472-1474, `unpin()` — 1477, `drawLines(cx, dt)` — 1478-1504
Screen space. 30px `"VT323"` typewriting in over the first 35% of its life; the `sub` is 22px `"Press Start 2P"` appearing after 30%. Unpinned lines stack at `VH*0.3 + i*44` **using the array index**, so a line dying reflows the ones above it. That is exactly why the pinned cue exists (1475-1476). Pinned lines sit at `VH*0.2` and never expire; only `unpin()` removes them, and it is called from the travel reset at 5531.

### `shake(a, cap)` — 1505
```js
function shake(a, cap) { if (!S.opts.shake) return RT.shake; return Math.min(cap == null ? 14 : cap, RT.shake + a); }
```
It **returns** a value, it does not assign. Every caller writes `RT.shake = shake(n)`. Default hard cap is 14 and every current caller respects it, so 14 is the loudest the screen has ever been. Decays at `24/s` on the sim clock (3840). Applied at 3853 as `translate(rnd(-s,s)*0.5, rnd(-s,s)*0.35)`, so at max shake the picture moves ±7px horizontally and ±4.9px vertically. The `clearRect(-30,-30,...)` margin at 3854 exists for that, but the black background fill at 3856 is only `0,0,VW,VH`, so a shaken frame leaves up to 7px of transparent edge showing `.nn`'s `#06050a` (`comp.css:2918`). Harmless today; if you add a zoom punch, do it as a scale about the centre and the edge problem goes away by itself.

Screen punch note: `S.opts.shake` (460) is the only visual option that exists, and its dev row is at 1012. A "screen punch" toggle is one `S.opts` default in `sLoad` plus one `tgl` row in the DEBUG tab, following that exact pattern.

---

## 3. Combat-specific drawers

### `assembleLine(fam, n)` — 2674-2682, `drawAssembly(cx, dt)` — 2683-2713
Screen space, outside shake. Up to 6 words, 21px `"Press Start 2P"`, gap 22, lands on a line at `VH*0.40` over the first 55% of 0.85s, then fades over the last 30%. Uses `cx.shadowColor` / `cx.shadowBlur = 14 * ease` (2702) which is **the only `shadowBlur` in the whole file**. Canvas shadow blur is the most expensive text operation available and this does it once per word per frame, up to 6. It is currently affordable because there is at most one assembly on screen; do not copy the idiom into a per-foe loop.

### `snapStacks(f, col, n)` — 2800-2803, `drawSnaps(cx, dt)` — 2804-2815
This is the entire "a stack detonated" visual. A 2px horizontal stroke, width `12 + n*7`, shrinking to nothing over 0.32s, at a **hardcoded 44px above the ground point** (2809) with no reference to the foe's actual height, so on the Chorus (`h = 130`, 3488) it draws through the chest. Position is captured at fire time, so it does not follow a moving foe.

### `drawRings(cx, dt)` — 2986-2997
Ground ellipse, `'lighter'`, one stroke. `rr = g.max * (0.15 + 0.85*k)` in tiles, `lineWidth = 5*(1-k) + 1`, alpha `0.85*(1-k)`. Fields: `{x, y, r, max, col ("r,g,b"), t, life}`. Note `r` is written by every caller and read by nothing; `max` is the radius in tiles. Three producers: `stanzaWave` 2918, `stepReprise` 2780, a boss pulse 3370. Drawn at 3865, i.e. under the props and under the night wash.

### `drawCalls(cx)` — 3934-3949
No timer, no mutation, pure. Per call: one `'lighter'` flat `arc` of radius 12 at 28% alpha, then the word in 12px `"Press Start 2P"` with a `+1.5,+1.5` shadow, at `isoY + TILE_H/2 - 26`. **Identical for all five families except the colour.** `RT.calls` rarely exceeds 3 or 4 (call cooldown 0.19s at 2382, flight time `callRange/13` ≈ 0.58s).

### `drawFproj(cx)` — 3950-3958
```js
var g = cx.createRadialGradient(sx, sy, 1, sx, sy, 9);
g.addColorStop(0, 'rgba(235,225,250,.9)'); g.addColorStop(1, 'rgba(150,140,190,0)');
cx.fillStyle = g; cx.beginPath(); cx.arc(sx, sy, 9, 0, TAU); cx.fill();
```
**This is the anti-pattern the brief is asking about, in the file, today.** One gradient object allocated and one gradient rasterised per projectile per frame. It survives because `RT.fproj` is boss-only (the Chorus voice waves, pushed at 3397, a handful at a time) and the boss fight is one room. Do not scale it.

### `drawStacks(cx, f, sx, sy)` — 3538-3565
Called from `drawFoe` at 3526 with `sy = groundY - h - 18 - f.so`, where `f.so` is a per-foe 0/9/18 row stagger dealt at spawn (3012) so piled enemies stay readable.

Per stack row: one `rgba(8,6,12,.72)` plate `n*13 + 8` wide, then per stack a `'lighter'` tinted rect at 30% alpha plus the 3-letter tag in 8px `"Press Start 2P"`. `fade = clamp(s.t / 1.2, 0.3, 1)` is the visible run-out-of-time. Drone stacks render in `#8a8090` instead of the family glow (3556).

Cost at the ceiling: 25 folk x 1 stack in the a3 square, or 6 foes x 8 stacks in the mill. 8 stacks is `TUNE.stackMax` (161), raised by the Tin Crown charm. So the real worst case is about 50 tinted rects plus 50 text fills per frame. Fine now; that is also the budget any per-stack matter effect is competing with.

### `drawFoe(cx, f)` — 3478-3535, the whole composite
```
3479  sx, sy = ground point
3480  pop  = f.spawn > 0 ? 0.5 + (0.45 - f.spawn) : 1        spawn scale-in, 0.45s
3481  wob  = sin(RT.t * 22) * f.wob * 3                      hit recoil, f.wob decays *3/s (3052)
3482  tell = state==='tell' ? 0.5 + 0.5*sin(RT.t*30) : 0     wind-up pulse
3488  h    = f.def.boss ? 130 : FOE_H[f.def.draw] || 30      authored beside the art at 3684
3489-3493  tell ring: flat ellipse, radius (f.r+0.75) tiles, rgba(255,90,80,...)
3496-3508  special wind-up: closing ring + a word at sy - h - 30
3509  save(); translate(sx, sy - abs(wob)*0.4); scale(pop, pop)
3510  contact shadow ellipse f.r*21 x f.r*8 at 42% black
3511  FOE_DRAW[f.def.draw](cx, f, tell)                      <-- the body
3512  drawMod(cx, f, h)                                      <-- elite mark, over the body
3513  flash: 'lighter', alpha f.flash*3.4, WHITE fillRect(-f.r*22, -h, f.r*44, h)
3515  frozen: alpha .45, #cfeeff fillRect(-f.r*22, -h, f.r*44, h)
3516  restore()
3518-3525  hp bar, only when hp < hpm, w = f.r*60, at sy - h - 10
3526  drawStacks
3527-3534  debug overlays
```

Everything from 3509 to 3516 is inside the `pop`/`wob` transform and in **local space with the origin at the foe's feet and up negative**, which is the same convention `blit()` (1864) and the prop painters (6431-6433) use.

The two status renders you were told about:
- `f.flash` is one white rect the width of `f.r*44` and the height of `h`. It is a **rectangle over the sprite**, not a silhouette flash, because there is no alpha mask to key off.
- `f.frozen` is one flat 45% `#cfeeff` rect, same geometry.
- `f.burn` draws **nothing** in `drawFoe`. Its only visual is one orange particle every 0.5s at 3073.
- `f.silence` draws **nothing** at all.
- `f.revealed` only tints the hp bar (3522).

That is four of the five families with no persistent body state on screen. All the geometry you need is already computed: `sx, sy, h, f.r, pop, wob, tell`.

The bodies, all `blit(bake(...))` of one-character-per-pixel row strings: `drawMouth` 3693 (two frames, shut/wide), `drawThief` 3697 (two palettes, the tell recolours the eye to `#ffd06a`), `drawDroner` 3701 (blit plus one animated `'lighter'` ellipse, the only foe with live paint over its sprite), `drawDeaf` 3708, `drawSword` 3712 (rotates the whole sprite on the tell), `drawChorus` 3744 (fully hand drawn, 22 ellipse-pairs a frame, no sprite), `drawFolk` 3461 (bake key carries coat + skin + seated, so the whole square is at most 48 baked canvases).

`FOE_DRAW` at 3769 is the registry. A new body registers there and `drawFoe` never grows a branch.

### `drawMod(cx, f, h)` — 3722-3743
Called inside the `pop`/`wob` transform, local space. Five marks keyed off `m.mark`: `ring` (pulsing flat ellipse at `w*1.15`), `streak` (three small rects trailing left), `plate` (a `strokeRect`, alpha `.85` while armour holds and `.2` after), `halo` (a filled flat ellipse above the head), `hand` (two rects out to the right). `w = f.r * 44`. Colour is `m.col`. This is the closest thing in the file to a "status marker vocabulary" and it is the right shape to extend for burn / silence / reveal / freeze.

### `drawCuts(cx, dt)` — 3774-3799
World space, real clock, mutates `RT.combat.cuts`. Draws the word, then **clips mid-letter** (`rect` + `clip` at 3788) with the cut travelling in at `k*1.6`, and puts a 2px caesura bar on the cut (3792-3797). Hardcoded to 34px above the ground point plus `k*16` of rise. `size` is 15 for `big`, 9 otherwise. Uses `cx.measureText` per cut per frame.

This is the single most distinctive existing effect in the file and the one whose idiom (clip a word, put a bar on the cut) is most worth stealing for a family.

---

## 4. The pixel sprite system

### `PXS = 2` — 1821
Every authored sprite pixel is 2 screen pixels. There is no way to pass a different scale to `bake`.

### `pxShade(hex, f)` — 1822-1826, `pxPal(coat, trim, skin, hair, extra)` — 1827-1839
Returns a 20-key palette object mapping single characters to CSS colour strings. Documented at 1817-1820:

```
o outline   k coat shadow  c coat    C coat trim  L trim lit
s skin      S skin shade   T deep shade
h hair      H hair lit     e eye     w white      b boot
m brass     M brass lit    f cloth
n wood      N wood lit     r red     g green
```

`extra` overrides or adds keys. The values are plain CSS colour strings, so **`'rgba(255,194,113,0.35)'` is a legal palette entry** and passes straight to `fillStyle`. That matters for section 6.

### `bake(key, rows, p)` — 1841-1859
```js
var SPR = {};                       // 1840
function bake(key, rows, p) {
    var c = SPR[key]; if (c) return c;
    var h = rows.length, w = rows[0].length;
    c = document.createElement('canvas');
    c.width = w * PXS; c.height = h * PXS;
    ...
    for each row, for each char: col = p[row.charAt(j)]; if (!col) continue; fillRect(j*PXS, i*PXS, PXS, PXS);
    SPR[key] = c; return c;
}
```

Gotchas, all real:
- **The key is the whole cache identity.** The palette is not part of it. `bake('x', rows, palA)` then `bake('x', rows, palB)` returns the first bitmap. Every caller therefore folds the varying part into the key by hand: `'pc' + lk` (2127), `'foe.thiefT'` vs `'foe.thief'` (3699), `'folk' + coat + '.' + skin + seat` (3472), `'npc.' + n.id + lk` (7975).
- `w` is taken from `rows[0].length` only. Ragged rows do not throw, they just paint short. (`THIEF_SPR` at 3603 is 20 wide and all rows are padded to 20 for exactly this reason.)
- Any unmapped character is air, including `'.'` (1852). There is no explicit transparent key.
- **`SPR` is unbounded and `close()` does not free it.** 8242-8243 free `FLOORS` and `SPRITES`; `SPR` is untouched, deliberately, per the comment at 1809-1811: "sprites hold no context and no runtime state, they are pixels, and they are still correct after `close()` throws `RT` away." The dev handle counts them at 1610. Worst case today is roughly 48 folk variants plus 18 or so named figures, at 32x40x4 = 5,120 bytes each. Under 400 KB. It is unbounded but the key space is tiny.

### `blit(cx, spr, x, y)` — 1864-1866
```js
cx.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height));
```
**x is the horizontal centre, y is the ground under the feet.** Both rounded, deliberately (1860-1862). It does not touch `imageSmoothingEnabled`, on purpose, so it does not leave a flag flipped on a shared context (1862-1863).

### Row-string format
`MOUTH_SHUT` 3573, `MOUTH_WIDE` 3587, `THIEF_SPR` 3603, `DRONER_SPR` 3624, `DEAF_SPR` 3643, `SWORD_SPR` 3663, `ADULT_TOP` 1873, `LEGS_STAND/PASS/WIDE` 1893-1895, `fig(top, legs)` 1896 just concatenates. `FOE_H` at 3684 is "sprite rows times PXS, kept beside the art so the two cannot drift".

### `SPRITES` / `SPRITE_LRU` / `SPRITE_BUDGET` — the prop cache, 6434-6532
Completely separate from `SPR`. `SPRITE_BUDGET = 10 << 20` bytes of backing store (not entries), `SPRITE_PAD = 30` px of headroom for eaves. `propSprite(t, bw, bh, v, mayBuild)` at 6477 keys on `type|bw|bh|variant`, paints once via `paintProp` (6688) into a canvas sized off the footprint plus `hgt + over`, and stores `{cv, ax, ay, bytes, anchors, box}`. `touchSprite` 6518 / `trimSprites` 6522 are a byte-budget LRU that zeroes `cv.width`/`cv.height` before deleting, which is the only way to actually release the backing store. `anchorAt(sp, name, mxc, myc)` at 6514 converts a named point painted into a sprite back to screen coordinates, and exists because the animated layer and the painter used to disagree about where the fire was (6469-6473).

The rationale block at 6420-6433 is the codebase's own statement of the paint-once-blit-forever doctrine and is worth quoting in any design doc: "Cost per prop per frame is one drawImage, and the detail budget goes from about twenty canvas calls to as many as it takes."

The primitives every painter uses, all integer-snapped: `px` 6536, `poly` 6537, `line` 6543, `dither` 6549 (2px blocks, one path one fill, scanline-walks the quad instead of its bounding box), `qp` 6580 (bilinear inside a quad), `bar` 6597, `shadeHex` 6601 (memoised, quantised to 64 steps, "a fixed number of shades per colour is what makes a palette a palette").

`PAINT` (6687) is the once-per-sprite registry, `LIVE` (6711) is the per-frame overlay registry called by `propLive` (6710) after the blit. `LIVE.lamp` (7591) and `LIVE.foot` (7551) are the model for "baked matter plus a small animated layer on top", which is structurally exactly what the family effects want. Note they both create radial gradients per frame (7564, 7612) and `LIVE.foot` does nine of them.

---

## 5. Floors and the build budget

### `FLOORS` — 1053
```js
var FLOORS = {}, FLOOR_LRU = [], FLOOR_MAX = 7;
```
`PARALLEL.md` says `FLOORS` is unbounded and never freed. **That is stale.** There is an LRU (`touchFloor` 1369, `trimFloors` 1373) capped at 7 entries and `close()` calls `freeFloors()` at 8242.

### `buildFloor(kind, gw, gh)` — 1308-1368
Key is `kind + gw + 'x' + gh`. Canvas is `placeBox(gw, gh)` (70-74), which is `w = 128 + 29*(gw+gh)`, `h = 157 + 14.5*(gw+gh)`.

Real sizes:
- 17x15 town (the square and `a3sq`): 1056 x 621 = **2.50 MiB**
- 17x17 arena: 1114 x 650 = 2.76 MiB
- 11x34 road: 1433 x 810 = **4.43 MiB**

Seven of those is up to about 20 MB, plus 10 MB of `SPRITE_BUDGET`, plus whatever `SPR` holds. `FLOOR_MAX` is 7 rather than 5 for a stated reason at 1049-1052: five evicted the square on the ordinary loop through Wick.

Inside: pass one is the tile diamonds (1325-1336), pass two is the `GROUND[kind]` painter clipped to the place outline (1338-1355), then a warm ring where the scene wants you to stand (1357-1362). The `f` object handed to a ground painter carries `px(u,v)` / `py(u,v)` converting **tile space to bitmap space**, plus a seeded `fr()` so the ground is stable across rebuilds (1317).

### The floor blit — 3855-3857
```js
var fl = buildFloor(place().floor, pw(), ph()), c0 = cam();
cx.fillStyle = '#07060a'; cx.fillRect(0, 0, VW, VH);
cx.drawImage(fl.cv, Math.round(fl.box.x - c0.x), Math.round(fl.box.y - c0.y));
```
**The whole bitmap is blitted every frame with no source rect.** On the square that is 656k source pixels; on the road it is 1.16M. At 144Hz that is 94 to 167 megapixels a second of source-over copy, and it is the single largest fixed cost in the frame. Passing the visible rect as the 9-argument form of `drawImage` would cut it to at most 650k on the road, and is free to do. Worth knowing because it sets the scale: **one extra full-screen additive pass costs roughly what the floor blit already costs.**

### `startBuildBudget()` / `mayBuild()` — 6618-6620
```js
var BUILD_MS = 5, buildT0 = 0;
function startBuildBudget() { buildT0 = performance.now(); }
function mayBuild() { return performance.now() - buildT0 < BUILD_MS; }
```
Called once at the top of `draw()` (3851). The only consumer is `drawProp` at 6629, which passes `mayBuild()` as `propSprite`'s `mayBuild` argument; if the budget is spent, `propSprite` returns `null` (6481) and `drawProp` draws the plain extruded solid instead until the prop's turn comes (6630-6637). Rationale at 6611-6617: entering the square used to build every sprite at once, 150ms, nine dropped frames, at the moment the place is supposed to open up.

**`buildFloor` is not budgeted.** It runs unconditionally at 3855 and a cache miss costs a full ground painter (thousands of blobs) in one frame. That is the hitch you feel walking through a door.

If you bake glow sprites lazily, put them behind `mayBuild()` the same way and fall back to a flat `arc` until the bake lands. If you bake them eagerly at module scope, five 128px sprites is 320 KB and about a millisecond, and there is no reason not to.

---

## 6. Lights, vignette, and the full-screen passes

### `lightsOf(p)` — 7812-7829, `drawLights(cx)` — 7830-7853
Skipped entirely unless `place().night`. Lays a full-screen darkness (`rgba(14,8,10,.34)` indoors, `rgba(6,5,14,.5)` or `.66` outdoors), then punches back out with one `'lighter'` radial gradient per light. Culled off screen at 7843. `rad = l.r * 30`, drawn inside `translate(sx, sy - 10ish); scale(1, 0.62)`. **One `createRadialGradient` per light per frame** (7846). The square has two lamps plus five house sills plus the player, so seven or eight per frame. That is the current price point for "per effect per frame is fine".

The player's own lantern is pushed at 7838, and `drawActor` draws a *second* 120px radial gradient for the floor pool at 2145.

### `drawVignette(cx)` — 7857-7869
One `createRadialGradient` and one full-screen `fillRect` per frame, unconditional. History at 7854-7862: it used to be baked into the floor bitmap and had to move to screen space when the camera landed.

### The full-screen fill count, per frame, today
1. `clearRect` 3854
2. black background 3856
3. dilate wash 3860 (only during a stanza)
4. `drawLights` darkness 7836 (night places)
5. `drawVignette` 7868
6. flash 3900 (transient)
7. hurt/dead red 3901 (transient)
8. mono `'saturation'` 3907-3913 (Verse only)

So a normal night frame is four full-screen fills plus one full-bitmap floor blit plus about eight radial gradients. **That is your baseline. One more full-screen additive composite is about a 20% increase in fill, not a 200% one.**

Caution on 8: `'saturation'` is a non-separable blend mode and is the slowest composite operation available on a 2D canvas. It is confined to the Verse. For family bloom use `'lighter'`, `'screen'` or `'overlay'`, all separable and all fast.

---

## 7. The design questions

### 7.1 The cheapest correct soft glow on this canvas

**Baked offscreen sprite, blitted with `globalCompositeOperation = 'lighter'`, is the right answer, and it is not close.**

What `drawFproj` (3950) does, per blob per frame:
1. allocate a `CanvasGradient` object,
2. build two colour stops (two CSS colour parses),
3. `beginPath` + `arc` + `fill`, which rasterises the gradient by evaluating the ramp per pixel inside a path that also has to be scan-converted and antialiased.

What a baked blit does, per blob per frame:
1. set `globalAlpha`,
2. `drawImage(spr, x, y, w, h)`.

Step 2 is a scaled RGBA copy, which is the operation a 2D canvas backend is fastest at and the only one it will reliably hand to the GPU. No allocation, no parse, no path, no per-pixel ramp evaluation. On a detonation with 8 foes at 8 stacks, if each stack throws a glow blob that is 64 gradient constructions per frame versus 64 `drawImage` calls, and 64 gradient constructions per frame is where you lose the frame. The file has already made this exact argument twice and won it: 6420-6433 for props, 1806-1811 for figures.

Three things to get right:

**Smoothing.** `imageSmoothingEnabled` is false (1570), so a baked 32px falloff scaled up to 96px comes out as visible 3px blocks. Three options, in order of how well they fit the game:

1. *Let it be blocky.* Read the comment at 6702: "Three banded rings rather than a gradient, because a soft radial falloff is the one thing on screen that is not made of pixels." The game's own doctrine, written in its own voice, is that smooth falloff is off-model. A glow baked as 5 or 6 concentric alpha bands, magnified nearest-neighbour, is *more* correct here than a smooth one, and it also happens to be the cheapest thing to author. This is my recommendation.
2. *Bake a ladder.* 16 / 32 / 64 / 128 px, pick the nearest and only ever scale within about 2x. Four sizes x five families x 4 bytes: at 128px that is 65,536 bytes for the largest, and the whole ladder for all five families is well under 1.5 MB. Compare one floor entry at 2.5 MB.
3. *Flip the flag.* `cx.save(); cx.imageSmoothingEnabled = true; ...blits...; cx.restore();` is safe, because smoothing is part of the state `save()` captures. Do not set it outside a save/restore, and do not put the flip inside `blit()`: 1862-1863 says why.

**Tinting.** Bake one sprite per family with the family colour already in it. Five families is the whole space (`FAM_IDS`, 149, and the doc says do not add a sixth, 139). Do not bake white and tint at draw time: tinting a blit on a 2D canvas needs a second offscreen and a `'multiply'` fill, which throws away everything you just saved.

**Intensity.** `globalAlpha` scales the whole blit for free and composes correctly under `'lighter'`. Scale it off stack count. Size scales off `drawImage`'s destination rect. Both are free.

The `'lighter'` idiom is everywhere already: 1404, 1458, 2134, 2144, 2992, 3513, 3552, 3703, 3747, 3940, 3953, 6960, 7555, 7611, 7776, 7839, 7901, 7986. Every one of them pairs with an explicit reset to `'source-over'` or sits inside a `save`/`restore`. Match that. `drawParts` (1409) resets without a save/restore and gets away with it; do not copy that specific shortcut into anything with an early return.

### 7.2 Is there an existing helper for baking a tinted radial falloff?

**Three offscreen canvases are created in the file and none of them is the right shape, but one is close enough to abuse.**

- `buildFloor` 1315: place-sized, keyed to a ground kind. Wrong.
- `propSprite` 6487: sized off a prop footprint, needs a `propDef`, writes anchors, charges against `SPRITE_BUDGET`. Wrong.
- `bake` 1841: `document.createElement('canvas')`, paint once, memo in `SPR`, return the canvas. **Right shape.**

`bake` will do it as-is, with no new machinery, because the palette values go straight to `fillStyle` and can be `rgba()` strings. A glow is a row-string sprite whose palette is an alpha ramp:

```js
/* Matter needs an edge you can see, the same way the dither does. This is
   five bands, not a gradient: a smooth radial falloff is the one thing on
   screen that is not made of pixels, which is the note contactShadow was
   written to. Palette values go straight to fillStyle, so an alpha ramp
   is a legal palette. */
var GLOW_ROWS = [ '...11111...', '..1222221..', /* ... */ ];
function glowPal(rgb) {
    return { 1: 'rgba(' + rgb + ',.10)', 2: 'rgba(' + rgb + ',.22)',
             3: 'rgba(' + rgb + ',.40)', 4: 'rgba(' + rgb + ',.66)',
             5: 'rgba(' + rgb + ',.92)' };
}
// keyed by family, because bake's cache key does not include the palette
var spr = bake('glow.' + fam, GLOW_ROWS, glowPal(hex2rgb(FAMS[fam].col)));
```

Two things this buys you: `bake` already handles the caching, and the result is authored pixel art rather than a generated ramp, which is what the rest of the file is.

Two things it does not: `PXS` is fixed at 2, so a 32-row glow is 64px and that is your only size unless you author more row sets; and `blit` anchors at bottom-centre (1864), which is wrong for a glow you want centred on a point. Write a sibling rather than reusing `blit`:

```js
/* blit() puts a figure's feet on the point, which is right for people and
   wrong for light. Centre, additive, alpha and size off the caller. */
function glowAt(cx, spr, x, y, size, a) {
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    cx.globalAlpha = a;
    cx.drawImage(spr, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    cx.restore();
}
```

If you would rather generate the falloff than author it, write a `glowSprite(key, r, rgb)` that follows `bake`'s conventions exactly: module-scope cache object, string key that carries every varying input, `document.createElement('canvas')`, one `createRadialGradient` **at bake time only**, return the canvas. Bound it if the key space is not obviously small; five families times four radii is 20 entries and needs no eviction, but a key that includes stack count does and would need the `touchSprite`/`trimSprites` pattern from 6518-6527.

### 7.3 What the frame actually costs today

Fixed, every frame, in a night place like the square:

| cost | line | magnitude |
|---|---|---|
| floor `drawImage`, whole bitmap, no source rect | 3857 | 656k source pixels (2.50 MiB); 1.16M on the road |
| full-screen fills | 3854, 3856, 7836, 7868 | 4 x 650k pixels |
| radial gradients | 7846, 2145, 7612, 7564 | 8 to 18 constructions + rasterisations |
| `ents` array + closures + sort | 3875-3891 | one array and one closure per entity per frame, then `Array.sort` |
| prop blits | 6653/6658 | one `drawImage` each, 10 in the square |
| figure blits | 1865 | one `drawImage` each, cached |
| prop cutaway ease | 6646-6650 | one `coversSomeone` scan per prop per frame |
| `stats()` / `charmSum()` | 496 / 483 | allocate two objects per call, called inside per-hit and per-foe loops |

Entity counts, real, from the data:
- Ordinary combat: `speakDraws` caps waves at **2** (lane, 5170), **3** (road, 5257), **4** (loft 5187, hollow 5277). `spawnWave` (3196) spends the cap one-per-slot. The square, Grelling and the mark have no `speakDraws` and draw nothing. So **hostile foe counts are 2 to 4, occasionally 6 in the mill's authored "everything at once" wave** (3134). The brief's "8 foes with 8 stacks each" is above anything the encounter tables can currently produce outside the a3 square.
- The a3 square: `A3_ROWS` is 24 seats (5519-5523) plus Hal (5568) = **25 foes**, each carrying exactly one `-ill` stack (5581), plus 6 props and the player. 32 sorted entities. This is the real crowd case and it is a scripted scene, not a fight.

The worst detonation that exists today, measured off the code: an `-ill` rhyme in the a3 square at the last cue. `doRhyme` (2547) walks 25 live foes; per foe `hurtFoe` fires a `typo` (2854), `snapStacks` (2800) pushes a snap and a `burst` of `4 + n*2 = 6`, `famEffect` sets `f.frozen` on all 25 (2838). Result on one keypress: **25 snaps, 150 particles, 25 typo entries** into a list capped at 60 that silently `shift()`s (1420), and 25 flat frozen rects for the next 1.6 seconds. That is the ceiling you are designing against, and it is already close enough to the `typo` cap that a family effect adding one more word per foe would start dropping words.

Headroom summary for a designer: the particle cap is 900 (1385) and the busiest moment in the game currently uses about 200 of it, so there is real room in the particle budget. The expensive things are not counts, they are per-item allocations: the `rgba()` string built per particle per frame at 1405, the closures built per entity per frame at 3883-3889, and any `createRadialGradient` you put inside a loop.

---

## 8. Traps, collected

1. Seven draw functions age their own lists. A second pass double-ages them. Pass `dt = 0`, or split step from draw. (1424, 1448, 1485, 2685, 2806, 2988, 3777)
2. `RT.parts`, `RT.snaps`, `RT.rings` and `RT.assembly` are not cleared by `gotoPlace` (6124-6125) and keep drawing at old world coordinates in the new place.
3. Typography ticks on real time, particles tick on sim time. They desync by 3.3x during a stanza.
4. `RT.shake` / `RT.chroma` / `RT.flash` decay on sim time (3840-3842), so a stanza makes them last three times as long.
5. `RT.chroma` is written at 1444 and 2748, initialised at 1557, decayed at 3841, and **read by nothing**. It is dead and it is free.
6. `RT.timeScale` (1557) multiplies the sim clock at 3809 and is reset to 1 by `gotoPlace` (6128). Nothing decays it. **A hitstop timer must count down on `real`, not `dt`, or it deadlocks: at `timeScale = 0` the sim `dt` is zero and a `dt`-driven countdown never finishes.** `step(dt, real)` gets both.
7. `part()` drops silently past 900 and drops the tail, so a per-foe emit loop starves its last foes.
8. `bake()`'s cache key does not include the palette. Fold every varying input into the key by hand.
9. `blit()` anchors bottom-centre, not centre.
10. `imageSmoothingEnabled` is false globally. It is saved by `save()`/`restore()`, so flip it locally or not at all.
11. Everything before line 3892 is darkened by the night wash by up to 66%. Everything after it is not.
12. `drawRings` (3865) draws under the props.
13. Every text drawer resets `textAlign` to `'left'` on exit. Keep doing that.
14. `'saturation'`, `'hue'`, `'color'` and `'luminosity'` are non-separable blend modes and slow. `'lighter'`, `'screen'`, `'overlay'` are fine.
15. `shake(a, cap)` returns a value and does not assign. Cap is 14.
16. `slam()` has no size or duration argument; every slam in the game is 62px and 0.55s.
17. `drawSnaps` (2809) and `drawCuts` (3780) hardcode their height above the ground point and ignore `FOE_H`.
18. `buildFloor` is not covered by `startBuildBudget`. A cache miss is a full ground repaint in one frame.
19. `PARALLEL.md`'s claim that `FLOORS` is unbounded and never freed is out of date: `FLOOR_MAX = 7` (1053), `trimFloors` (1373), `freeFloors` in `close()` (8242).
20. `stats()` and `charmSum()` allocate on every call (483, 496) and are called inside per-foe loops. Hoist them out of any loop you write.

=== RECON: post ===
# SCREEN AND POST-PROCESS LAYER — `comp/ninth.js`

All line numbers are against `C:/Users/isaac/IsaacUre.github.io/.claude/worktrees/suspicious-driscoll-00fbd8/comp/ninth.js` at HEAD (`88c665c`), 8279 lines.

---

## 1. `draw(rdt)` — 3847 to 3932, line by line

`draw` is called from `frame()` at **3811** as `draw(real)`, always with the **real** wall clock, never the sim clock. `devDemo` calls it bare as `draw()` at **8143** and **8152**, so `rdt` can be `undefined`.

| line | what | notes |
|---|---|---|
| 3850 | `var cx = RT.cx, dt = Math.min(0.05, rdt \|\| 1/60);` | the comment above it is the history: it was hard-coded `1/60` and every typographic effect ran 2.4x too long at 144Hz. This `dt` is **real seconds**, and it is the clock for every effect list drawn below. |
| 3851 | `startBuildBudget()` | resets `buildT0` (6618-6619). `mayBuild()` gives prop sprite baking 5ms per frame. Not a post-process concern but it is the only other per-frame budget in the file. |
| **3852** | **`cx.save()`** | **the one and only top-level save in `draw()`.** |
| 3853 | shake translate | `if (S.opts.shake && RT.shake > 0.2) cx.translate(rnd(-RT.shake,RT.shake)*0.5, rnd(-RT.shake,RT.shake)*0.35);` |
| 3854 | `cx.clearRect(-30,-30, VW+60, VH+60)` | cleared **in the translated space**, 30px oversize on all sides so the shake offset cannot leave a smear trail. |
| 3855 | `var fl = buildFloor(place().floor, pw(), ph()), c0 = cam();` | |
| 3856 | backdrop `fillStyle '#07060a'; fillRect(0,0,VW,VH)` | **also inside the translate**, so at max shake up to 7px of one edge is left transparent. Invisible today because `.nn` is `#06050a` (comp.css:2918) and the backdrop is `#07060a`. |
| 3857 | floor blit `cx.drawImage(fl.cv, Math.round(fl.box.x - c0.x), Math.round(fl.box.y - c0.y))` | the only camera subtraction done by hand rather than via `isoX/isoY`. **This is the line a zoom punch breaks first.** |
| 3859-3862 | `RT.dilate` darken | `rgba(6,4,10, 0.55 * clamp(RT.dilate/T('dilationT'),0,1))` over the full rect. Drawn **after the floor and before everything else**, so it darkens the ground only. Props, NPCs, foes and the player are drawn on top at full brightness. |
| 3863 | `drawExits(cx)` (7890) | ground ellipses + one `createRadialGradient` per open exit per frame |
| 3864 | `drawLooks(cx)` (7873) | |
| 3865 | `drawRings(cx, dt)` (2986) | the whole "detonation ring" vocabulary. One flat ellipse, `lighter`, `lineWidth 5*(1-k)+1` |
| 3866-3871 | click-to-move marker | own `cx.save()`/`cx.restore()`, gated `RT.moveTo && !S.opts.wasd` |
| 3875-3891 | **the painter-sorted world** | `ents` array built at 3875; `RT.rdt = dt` cached at 3881 for the prop cutaway ease (read at 6649); `RT.hide` at 3882; foes 3883, NPCs 3884, props 3885-3888, player 3889; `ents.sort(a.k - b.k)` at 3890; `ents.forEach(e.fn())` at 3891. **This is the only z sort in the game.** |
| 3892 | `drawLights(cx)` (7830) | full-screen night wash then one `createRadialGradient` per light per frame, `lighter`. Resets composite to `source-over` at 7852 by hand. |
| 3893 | `drawVignette(cx)` (7857) | one `createRadialGradient` per frame, full rect. Note there is **also** a CSS vignette `.nn-vig` (comp.css:2920) sitting over the canvas in the DOM. Two vignettes. |
| 3894 | `drawCalls(cx)` (3934) | the flying word. Identical for all five families except `FAMS[c.fam].col`. |
| 3895 | `drawFproj(cx)` (3950) | enemy projectiles, `createRadialGradient` **per projectile per frame** (3954). The one existing violation of the per-particle-gradient rule. |
| 3896 | `drawParts(cx)` (1401) | 3px additive squares. Resets composite to `source-over` at 1409 by hand, no save/restore. |
| **3897** | `drawCuts(cx, dt)` | **SEAM 1 (world space) starts here.** Job 4's call, marked `// job 4: the cut-off last line, world space` |
| 3898 | `drawSnaps(cx, dt)` (2804) | the entire "stack detonated" visual: a 2px horizontal line that shrinks |
| **3899** | `drawTypo(cx, dt)` (1422) | **SEAM 1 ends here.** |
| 3900 | `RT.flash` | `rgba(255,250,235, RT.flash*0.5)` full rect |
| 3901 | `RT.hurt` / `RT.dead` | `rgba(150,10,25, RT.dead ? 0.34 : RT.hurt*0.3)` full rect |
| 3902 | `drawPrompt(cx)` (8006) | drawn **over** the flash and the hurt tint |
| 3907-3914 | `RT.mono` | own nested `save()`/`restore()` at 3908/3913. `globalCompositeOperation = 'saturation'`, `globalAlpha = clamp(RT.mono/1.4,0,1)`, `fillStyle 'hsl(0,0%,50%)'`, full rect. |
| **3915** | **`cx.restore()`** | **the one and only top-level restore. Everything below is screen space with no shake.** |
| 3916 | `drawAssembly(cx, dt)` (2683) | |
| 3917 | `drawSlams(cx, dt)` (1446) | |
| 3918 | `drawLines(cx, dt)` (1478) | |
| 3919 | `drawBossBar(cx)` (3959) | |
| 3920 | `drawToasts(cx)` (3971) | |
| **3921** | `drawMap(cx)` (8067) | **SEAM 2 (screen space) is immediately after this line.** |
| 3922-3925 | the perf HUD, gated `RT.dbgPerf` | |
| 3926-3931 | `FROM THE TOP` death text | |

### The two seams, stated exactly

- **World space: lines 3896 to 3899**, between `drawParts` and `drawTypo`, **inside** the `cx.save()` at 3852. Occupied today by `drawCuts` (3897) and `drawSnaps` (3898). Anything here gets the shake for free, is drawn under the flash/hurt/mono passes, and must project with `isoX/isoY`.
- **Screen space: line 3922**, after `drawMap`, **outside** the restore at 3915. Occupied today by the `RT.dbgPerf` block and the death text. Anything here draws in raw canvas pixels, never shakes, and is not desaturated by mono.

The comment at **3903-3906** is the design statement for why mono sits where it does: the big typographic lines are drawn after the restore so they keep their colour while everything behind them goes grey. Moving `drawSlams`/`drawLines` inside the block would grey out the words.

### What is inside the shake and what is not

**Inside** (shakes): the backdrop, the floor blit, the dilate darken, exits, looks, rings, the move marker, every sorted entity (props, NPCs, foes, the player), lights, the canvas vignette, calls, foe projectiles, particles, cuts, snaps, world typo, the flash wash, the hurt wash, the interact prompt, the mono pass.

**Outside** (does not shake): the assembly line, slams, big lines, the boss bar, toasts, the map, the perf HUD, the death text. And everything in the DOM: `.nn-hud`, `.nn-say`, `.nn-vig`, `.nn-toasts`, `.nn-dev`, the four panels.

That split is deliberate and correct: the world shakes, the words hold still. Any "screen punch" that shakes the slam word too is changing an existing decision, not filling a gap.

---

## 2. `RT.shake` and `shake(a, cap)`

```js
function shake(a, cap) { if (!S.opts.shake) return RT.shake; return Math.min(cap == null ? 14 : cap, RT.shake + a); }
```
**Line 1505.** Note the shape: it is a **pure function returning a value**, and every caller writes it back with `RT.shake = shake(n)`. When `S.opts.shake` is off it returns the current value, so the assignment is a no-op and `RT.shake` never leaves 0.

- **Init**: `shake: 0` in the RT literal at **1557**.
- **Default cap**: **14**. Overridable per call; only one caller does (`shake(0.7, 4)` at 2456, the Call hit).
- **Decay**: **3840**, `RT.shake = Math.max(0, RT.shake - dt * 24)`. On the **sim clock**. From the cap that is 14/24 = 0.583s to zero, and during a stanza (`dilation` 0.3) it is 1.94s.
- **Draw gate**: **3853**, `RT.shake > 0.2`, so the effective life is 0.575s.
- **Amplitude**: `rnd(-RT.shake, RT.shake) * 0.5` in x and `* 0.35` in y. At the cap that is **±7px x, ±4.9px y**. The 30px clearRect margin at 3854 means the cap can rise to **60** before the shake outruns the clear and starts smearing.
- **Double gate**: `S.opts.shake` is checked in `shake()` at 1505 **and** in `draw()` at 3853.

**Every writer** (13 sites): 1444 `slam()` 9 · 1770 `hurtPlayer` 4 · 2456 `landCall` 0.7 cap 4 · 2655 rhyme-that-dragged 4 · 2661 rhyme-that-slanted 3 · 2748 `doReprise` 9 · 2781 reprise beat that hit 5 · 2919 `stanzaWave` 10 big / 4 · 2957 Verse line four 12 · 3378 Chorus pulse 8 (5 if pitch held) · 3442 `onChorusDown` 14 · 5864 `a3True` 10.

**Two findings that matter for "heavier shake":**

1. **The shake re-randomises every frame, so its character is frame-rate dependent even though its amplitude is not.** At 144Hz you get 2.4x as many distinct offsets per second as at 60Hz, which reads as a high-frequency buzz rather than a shake. Anything that wants a punchy, directional, satisfying shake should switch to a decaying sinusoid on a fixed frequency with a direction vector, driven off `RT.t` or a real-time accumulator, so 60Hz and 144Hz look the same. This is the single biggest cheap win in the whole punch layer.
2. **The decay is on the sim clock (3840) while the draw is on the real clock.** A stanza's shake lasts 3.3x longer in wall time than the same amplitude outside one. That is currently a happy accident that makes stanzas feel weighty. Moving it to `real` for hitstop reasons (see section 5) changes that feel and needs re-tuning.

---

## 3. `RT.flash`, `RT.hurt`, `RT.dilate`, `RT.mono`

All four are initialised in the RT literal: `flash: 0, dilate: 0, mono: 0` at **1557**, `hurt: 0` at **1548**.

### `RT.flash`
- **Written**: exactly once, **3442** `onChorusDown`: `RT.shake = shake(14); RT.flash = 0.5;`
- **Decayed**: **3842**, `RT.flash = Math.max(0, RT.flash - dt * 2.2)` — **sim clock**. 0.5 / 2.2 = 0.227s.
- **Drawn**: **3900**, inside the shake, `rgba(255,250,235, RT.flash*0.5)` so it peaks at 25% alpha.
- One writer for the whole game. This is a wide-open channel for family-coloured bloom: it wants to become `RT.flash = {a: 0.5, col: '255,194,113'}` or a parallel `RT.bloom`.

### `RT.hurt`
- **Written**: **1726** decay in `stepPlayer` (`RT.hurt = Math.max(0, RT.hurt - dt)`, sim clock, a straight one-second-per-second countdown), **1769** `hurtPlayer` sets `0.4`, **2495** `breakStack` sets `Math.max(RT.hurt, 0.25)`.
- **Decayed twice**: once at 1726 in `stepPlayer` and again at **3842**'s neighbours? No — only 1726. But note `stepPlayer` does not run when `RT.dead`, so `RT.hurt` freezes on death. That is masked because 3901 ORs in `RT.dead`.
- **Drawn**: **3901**, `rgba(150,10,25, RT.dead ? 0.34 : RT.hurt*0.3)`, inside the shake, over the world and under `drawPrompt`.

### `RT.dilate`
- **Written**: **2745** `doReprise` `Math.max(RT.dilate, 0.5)` · **2894** `doStanza` `= T('dilationT')` (default 1.5) · **2948** `doVerse` `= 6` · **6128** `gotoPlace` reset `= 0`.
- **Decayed**: **3816**, `RT.dilate = Math.max(0, RT.dilate - (real || dt))` — **real clock, deliberately**, with the comment `// dilation runs on real time`. This is the load-bearing line: it is what stops a slow-motion effect from slowing down its own timer and never ending.
- **Read**: **3809** in `frame()` as the sim-clock multiplier, **3859-3862** in `draw()` as the ground darken, **1608** in the dev handle's `state()`.

### `RT.mono`
- **Written**: **2948** `doVerse` `= 8.4` (`// mono now runs the length of the recital`), **6128** `gotoPlace` reset `= 0`.
- **Decayed**: **3817**, real clock, same pattern as dilate.
- **Drawn**: **3907-3914**, the last thing before the top-level restore.

```js
cx.save();
cx.globalCompositeOperation = 'saturation';
cx.globalAlpha = clamp(RT.mono / 1.4, 0, 1);
cx.fillStyle = 'hsl(0,0%,50%)';
cx.fillRect(0, 0, VW, VH);
cx.restore();
```

**This is the hint you were told to read.** `'saturation'` is a CSS blend mode from the compositing spec, not a Porter-Duff operator, and Chrome implements it on 2D canvas. Its presence establishes that **separable and non-separable blend modes are considered fair game in this codebase**, not just `lighter`/`source-over`. That opens up, for a family-coloured bloom pass over the whole screen: `'screen'` (cheap additive-ish, does not blow out to white the way `lighter` does), `'overlay'`, `'color-dodge'` (the classic bloom op, expensive), `'hue'` and `'color'` (tint the whole frame toward the family colour without touching luminance, which would be a gorgeous one-line family signature on a detonation), and `'difference'` for a one-frame inversion pop.

The rest of the file uses only `'lighter'` (23 sites) and `'source-over'`. `RT.mono` is the sole exception and the sole precedent.

**Note also the composite hygiene convention**: some sites wrap in `save()`/`restore()` (2992, 3703, 3953, 3908), and some just set the op and set it back to `'source-over'` by hand (1404/1409, 1458/1461, 2134/2140, 3513/3514, 3552/3555, 3747/3750, 7839/7852, 7901/7905). Both patterns are in use. A new full-screen pass should use `save`/`restore` because `'saturation'` and friends are sticky and a leaked non-separable op poisons everything drawn after it.

---

## 4. `RT.chroma` is dead. The proof, and what to do about it.

**Every occurrence in the file** (`grep -n chroma ninth.js`, 4 hits plus 1 comment):

- **1444** `slam()`: `RT.shake = shake(9); RT.chroma = 0.5;` — write
- **1457** a comment, `// chromatic split — cheap, reads as impact` — the inline hard-coded version in `drawSlams`, which does **not** reference `RT.chroma`
- **1557** the RT init literal: `chroma: 0,` — declaration
- **2748** `doReprise()`: `RT.shake = shake(9); RT.chroma = 1;` — write
- **3841** `step()`: `RT.chroma = Math.max(0, RT.chroma - dt * 2.4);` — decay

There is **no read**. Not in `draw()`, not in any `draw*` function, not in the dev handle's `state()` (1604-1609), not in `window.__ninth`, not in the DEV table. `RT` is module-private inside the IIFE so `comp/comp.js` cannot see it either (confirmed: comp.js touches only `window.NINTH.{render,init,close,steamAch,suspend,resume,volume}`). Three writes, one decay, zero reads. It is dead and it is yours.

The only thing in the game that actually does a chromatic split is **`drawSlams` at 1458-1460**, and it is hard-coded:

```js
cx.globalCompositeOperation = 'lighter';
cx.fillStyle = 'rgba(255,60,90,.55)'; cx.fillText(s.txt, -3 * (1 - k), 0);
cx.fillStyle = 'rgba(60,180,255,.55)'; cx.fillText(s.txt,  3 * (1 - k), 0);
```

Fixed 3px, fixed red/blue, driven off the slam's own `k`, ignoring `RT.chroma` entirely. Whoever wrote `RT.chroma` at 1444 wrote it on the same line as the `slam()` that already did this inline, and never wired the global version.

### Three ways to implement it, honestly costed

**(a) The right one for this game: chroma at the source, on the typography.**
Extract the 1458-1460 pattern into one shared helper and have it read `RT.chroma` for the offset. Something like `chromaText(cx, txt, x, y, k)` that draws a red pass at `-d`, a blue pass at `+d`, then the core, where `d = 1 + RT.chroma * 6 * k`. Call it from `drawSlams` (replacing the inline version), `drawLines` (1494-1495), `drawTypo` (1433-1434) when the word is a detonation word, and `drawStacks` (3557) at high stack counts. Cost: two extra `fillText` per word, only on frames where `RT.chroma > 0`. No buffer, no allocation, no composite risk beyond the `lighter` already there. It is **real** chromatic fringing on the thing the player is actually looking at, it obeys the art doctrine ("typography stays the backbone"), and it scales naturally off stack count because you already know `n` at every call site. **This is what I would ship.**

**(b) Zero-buffer full-screen, honestly labelled: it is bloom, not aberration.**
A canvas may draw itself: `cx.drawImage(cx.canvas, dx, dy)` is legal and Chrome snapshots the source. So after the world is drawn you can do

```js
cx.globalCompositeOperation = 'lighter';
cx.globalAlpha = 0.4 * RT.chroma;
cx.drawImage(RT.cv, -d, 0);
cx.drawImage(RT.cv,  d, 0);
```

Two full-screen `drawImage`s, no allocation. But you **cannot isolate a colour channel** with `lighter` alone, so what you get is a symmetric brightened ghost, not a red-left/blue-right fringe. On this dark palette it reads as a smeared impact bloom, which is honestly a decent effect and would sell a detonation. Call it what it is. Do not call it chromatic aberration.

**(c) Real full-screen per-channel aberration: one 1120x580 scratch canvas.**
Channel isolation on 2D canvas needs two ops you cannot do in place: draw the source offset into the scratch, then `globalCompositeOperation = 'multiply'` and fill the scratch with pure `#f00`, which zeroes green and blue; then composite the scratch back with `'lighter'`. Repeat for `#0ff` at the opposite offset. That is 2 full-screen `drawImage` into scratch, 2 full-screen `fillRect` with `multiply`, 2 full-screen `drawImage` back = **6 full-surface operations per frame while active**.

The memory cost is one canvas of 1120 x 580 x 4 = **2.6 MB**. For scale: `FLOORS` entries are ~2.6 MB each (PARALLEL.md says so, and `placeBox` at 70-74 confirms the size), `FLOOR_MAX` is 7 (1053), and `SPRITE_BUDGET` is 10 MB (6434). So the scratch buffer is **one seventh of the floor cache and a quarter of the sprite budget**. That is cheap in this file's terms. It must be allocated lazily on first use, kept at module scope next to `FLOORS`/`SPRITES`, and **freed in `close()` at 8242-8243 alongside `freeFloors()` and `freeSprites()`** by setting `width = height = 0`, which is exactly the pattern `freeFloors` uses at 1380.

The frame cost is the real question. Six full-surface ops at 1120x580 is roughly 3.9 megapixels of fill per frame. That is affordable for the 0.2s a detonation lasts, and it will be the most expensive thing in the frame while it runs. If it lands, it must be gated on `RT.chroma > 0.01` so it costs literally nothing 99% of the time, and it must sit behind the screen-punch option toggle.

**Where it goes, if you take (b) or (c):** immediately before the mono pass, at line **3906**, still inside the shake transform. Before mono so that a desaturated Verse frame does not have coloured fringing floating on top of it. After `drawPrompt` so the prompt gets the treatment too (or before 3902 if you want the prompt to stay clean; I would put it after, the prompt does not appear during detonations).

One thing to check if you do it: `cx.drawImage(cx.canvas, ...)` while `imageSmoothingEnabled = false` (set once at **1570**) does nearest-neighbour at non-integer offsets. Round `d` to whole pixels or the offset passes will alias against the pixel grid.

---

## 5. `RT.timeScale`, `RT.dilate`, and what a hitstop must not break

### How `frame()` composes them

```js
function frame(now) {                                        // 3802
    if (!RT) return;
    var real = Math.min(0.05, (now - RT.last) / 1000);       // 3804  clamped to 20fps
    RT.last = now;                                           // 3805
    RT._fc++; RT._ft += real;                                // 3806
    if (RT._ft >= 0.5) { RT.fps = Math.round(RT._fc / RT._ft); RT._fc = 0; RT._ft = 0; }  // 3807
    var scale = RT.timeScale * (RT.dilate > 0 ? T('dilation') : 1);   // 3809
    step(real * scale, real);                                // 3810
    draw(real);                                              // 3811
    RT.raf = requestAnimationFrame(frame);                   // 3812
}
```

`RT.dilate` is a **boolean gate on a fixed factor**, not a curve: any positive value gives exactly `T('dilation')` (default 0.3, FEEL row at 943, range 0.05 to 1). `RT.timeScale` is a straight multiplier, init `1` at **1557**, reset to `1` at **6128** on travel, written only by the DEV CHEAT row at **1005** with `clamp(v, 0.05, 3)`.

### What runs on which clock inside `step(dt, real)` (3814-3846)

**Sim `dt`** (freezes when scale goes to 0): `RT.t` (3815), `callCd`/`answerCd`/`swallowCd`/`conceal` (3818-3821), `stepItems` (3822), `stepParts` (3825, 3833), `stepPlayer` (3828), `stepCalls` (3829), `stepStacks` (3830), `stepReprise` (3831), `stepFoes` (3832), `stepScene` (3835), `stepNpcs` (3836), and **`RT.shake` (3840), `RT.chroma` (3841), `RT.flash` (3842)**.

**Real `(real || dt)`**: `RT.dilate` (3816), `RT.mono` (3817), `RT.deadT` (3824), `stepRecital` (3834), `stepCamera` (3838), `stepAudio` (3839), toasts (3843), `hudT`/`updateHud` (3844-3845).

**`RT.ac.currentTime`**: everything audible. The doctrine is spelled out at **3988-4013**, and the fourth clock is named there too: distance, for footsteps, because it is the only quantity that survives both dilation and a wall (4407-4426).

**`draw`'s own real `dt`**: every effect list. `drawTypo` (1424), `drawSlams` (1448), `drawLines` (1482, 1485), `drawSnaps` (2806), `drawRings` (2988), `drawCuts` (3777), `drawAssembly` (2685). **These keep animating during a hitstop.**

### What a hitstop implementation must do

**Do not write `RT.timeScale`.** It is the dev slider's variable (1005) and a hitstop that borrows it fights the slider, and worse, a hitstop that sets it to 0 and then hits an exception before restoring it leaves the game permanently frozen with no way back except the dev menu.

**Add a separate field and compose it.** One line in the RT literal next to 1557, one line in `step()` next to 3816 decrementing on **real** time exactly the way dilate does, and one term in the 3809 product:

```js
var scale = RT.timeScale * (RT.dilate > 0 ? T('dilation') : 1) * (RT.hitstop > 0 ? T('hitstopScale') : 1);
```

The decrement must be on `real` and it must be inside `step()`, because `step()` is still called every frame with `dt = 0`. That is the same trick `RT.dilate` uses and it is why 3816's comment exists.

**Do not use exactly 0.** Use something like 0.02. A true zero freezes `RT.t`, and `RT.t` drives every idle animation in the game by `Math.sin(RT.t * k)`: the actor bob (2112), the lantern pulse (2135), foe wobble and tell flicker (3481-3482), the exit ring pulse (7895), the look markers (7878), the lamp flicker (7844), the special wind-up ring text (3505). Freezing all of that is what a hitstop wants for the world, but a hard zero also means `RT.callCd` and `RT.answerCd` stop, so a 90ms hitstop adds 90ms to every cooldown. At 0.02 they still creep and nothing is exactly frozen, which is also what "hitstop" means in most engines.

**Composition with dilate is already safe.** `0.02 * 0.3 = 0.006`. A hitstop inside a stanza is a hitstop inside a stanza. And because dilate counts down on real time (3816), a hitstop cannot lengthen a stanza.

**Audio is safe and cannot participate.** Everything audible is on `RT.ac.currentTime`, a hardware clock, so nothing desynchronises. `stepAudio` takes `real || dt` (3839) and keeps running: ambience event timers keep firing, and footsteps pace off distance covered, which is zero while frozen, so no phantom steps. If you want the audio to feel the stop it has to be a deliberate gesture scheduled on `currentTime` (a master gain dip, a lowpass sweep), and `sfx()`/`RT.ac` belong to job 2 (PARALLEL.md), so it is a `sfx('hitstop')` call and a note in the PR body.

**The one thing it genuinely breaks: `RT.shake`, `RT.chroma` and `RT.flash` stop decaying.** They are on sim `dt` at 3840-3842. During a hitstop the shake holds at full amplitude and the flash holds at full brightness. For shake that is arguably the correct look (a frozen frame that is buzzing), for a 0.25-alpha white wash held 90ms it is too much. Three options, pick one deliberately:

1. Move all three to `real`. Cleanest, but it changes existing stanza feel: a Stanza's shake currently lasts 1.94s of wall time and would drop to 0.583s. Needs re-tuning and should be called out.
2. Decay by `Math.max(dt, real * hitstopActive)`. Ugly and hard to explain.
3. Leave them on `dt` and design around it: cap the hitstop at ~80ms and lower the `RT.flash` peak. The held buzz is a feature.

**Also note `draw()` keeps animating everything typographic** during the freeze, because `draw(real)` is unconditional. A slam is 0.55s and an 80ms hitstop eats 15% of its scale-in. That is probably what you want (the world stops, the word keeps coming at you) but it is a decision, not a default.

---

## 6. Zoom punch: exactly where the transform goes, and exactly what it breaks

### Where

There is one candidate slot: **immediately after line 3853 and before line 3854**, inside the existing `cx.save()`. The transform is the standard scale-about-a-point:

```js
cx.translate(ax, ay); cx.scale(z, z); cx.translate(-ax, -ay);
```

It has to be after the shake translate (so the shake is in screen pixels and does not get amplified by the zoom) and before the clearRect (so the clear covers the enlarged area). It is released by the existing `cx.restore()` at 3915, which is exactly right: **everything you want to zoom is already inside that block and everything you want to hold still is already outside it.** The structure is unusually cooperative here.

### The anchor point

`isoX/isoY` already subtract the camera, so there is no world-space anchor to compute: the anchor is a screen point. Two choices:

- `(VW/2, VH/2)`. Simplest, always safe. The dead-zone follow (`DEAD_W 300, DEAD_H 150` at 89, `camTarget` at 90-97) keeps the player within ±150px x and ±75px y of centre, so a centre zoom always keeps the player on screen.
- `(isoX(RT.px,RT.py), isoY(RT.px,RT.py) + TILE_H/2)`. More "correct" for a hit punch, but when the camera is clamped against a bound (`camBounds` at 77-85) the player can be far off centre and the world lurches sideways on every punch. I would not do this.

There is a third option worth considering for detonations specifically: anchor on the **centroid of the foes that were hit**, computed in `doRhyme` and stashed on an `RT.punch` object. That gives you a genuine "the camera lunges at the kill" feel. Same clamping caveat.

### What it breaks, concretely

**1. The mouse. This is the real one.** `screenToWorld(sx, sy)` at **62-66** knows about the camera and nothing else. It is called from `wireInput.toWorld` at **1636** (pointermove 1649-1652, pointerdown 1653-1663) and from `stepCamera` at **113-114**, which re-derives `RT.mouse.wx/wy` every frame precisely because the world slides under a stationary cursor. With a zoom active, every one of those is wrong by the zoom factor about the anchor. `RT.face` (1751), `doCall`'s aim, `doDash` (1757-1758) and the click-to-move target (1660) all read `RT.mouse.wx/wy`. During a 120ms punch at z=1.08 the aim error at the screen edge is about 40px of screen, which is most of a tile.

The fix is one place, not many: `screenToWorld` must undo the zoom before it undoes the camera. The camera-comment at 48-55 already says *"Anything that converts the other way (the mouse) has to add the camera back: use screenToWorld, do not re-derive it"*, and the codebase honours that — there is exactly one implementation. So it is a three-line change inside `screenToWorld`, reading the same `RT.punch` state the draw transform reads. The comment at 108-112 in `stepCamera` is the history of exactly this class of bug ("or you spend the walk shooting at where the ground used to be").

**2. The floor blit and the floor edge.** Line 3857 offsets the bitmap by hand. Under a scale about a point that offset is still correct (the transform handles it), but the *coverage* is not. `camBounds` (77-85) guarantees only that the **unzoomed** viewport sits inside the floor box, and the box has only `FLOOR_PAD = 64` (69) of margin. Zooming **out** by more than about `VW / (VW + 128)` = 0.90 shows past the edge of the floor bitmap into cleared canvas. So: **zoom in only**, or clamp the zoom-out to 0.90 and accept that `camBounds` was not written for it.

**3. Prop culling pops.** `drawProp` culls at **6625-6626** against hard-coded `VW + 80` / `VH + 40` bounds. Zooming in shows less world, so the cull is merely wasteful. Zooming out shows more world than the cull allows and props at the edges vanish. Another reason for zoom-in only.

**4. Pixel shimmer.** `imageSmoothingEnabled = false` is set once at **1570**, and the comment says why: *"people are pixels; never interpolate them"*. The floor is one `drawImage` (3857), every prop is a `drawImage` (`propSprite` / 6487), every figure is a `drawImage` (`blit` at 1864-1866, which already rounds to integers for exactly this reason). At z = 1.06, nearest-neighbour duplicates an irregular 6% of rows and columns, and because z is animating, *which* rows duplicate changes every frame. That is a visible crawl across the whole screen. Three mitigations: snap z to a small ladder (1.0, 1.05, 1.10) so the crawl happens 3 times instead of 60; keep the punch under ~120ms so nobody reads the crawl; or flip `imageSmoothingEnabled = true` for the duration of the punch, which contradicts 1570's comment but is only wrong for two frames. I would snap the ladder.

**5. Everything drawn after 3915 does not zoom, and that is correct.** Slams, big lines, the assembly, the boss bar, toasts, the map, the death text. The DOM HUD, the narration channel and the CSS vignette are not on the canvas at all so they can never zoom. Good.

**6. One thing on the wrong side: `drawVignette` (3893).** It is inside the block and will zoom with the world, which is wrong — the comment at 7854-7856 says the vignette "belongs to the eye" and was moved out of the floor bitmap for exactly this reason. A zoom punch that scales the vignette scales the frame around the picture. Hoist `drawVignette` (and arguably `drawLights`' full-screen wash at 7834-7836, though the per-light gradients must stay in) to after the zoom is popped. That means the zoom cannot simply ride the single top-level save/restore: you need a second `cx.save()`/`cx.restore()` pair *inside* the outer one, opening at 3853 and closing just before 3893. The full-screen washes at 3859, 3900, 3901 and the mono pass at 3907 have the same problem: at z > 1 a `fillRect(0,0,VW,VH)` no longer covers the screen. So the honest structure is:

```
cx.save()                  // 3852, shake only
  shake translate
  clearRect / backdrop
  cx.save()                // new: the zoom
    zoom transform
    floor blit, dilate darken, exits, looks, rings, marker, ents, per-light gradients
  cx.restore()             // new: pop the zoom before anything full-screen
  drawVignette, drawCalls, drawFproj, drawParts, drawCuts, drawSnaps, drawTypo,
  flash, hurt, drawPrompt, mono
cx.restore()               // 3915
```

But that moves `drawCalls`, `drawFproj`, `drawParts`, `drawCuts`, `drawSnaps`, `drawTypo` out of the zoom, and those are world-space effects that should zoom. The clean resolution is: **keep the zoom around everything from 3855 to 3899, and change the four full-screen `fillRect(0,0,VW,VH)` calls to cover a rect derived from the zoom** (or pop the zoom for just those four). The dilate darken at 3860 is the awkward one because it is deliberately sandwiched between the floor and the props. Simplest correct answer: make a tiny helper `fullRect(cx)` that emits the right rect under the current punch, and call it from all four sites. Four one-line edits, no restructuring, and it keeps the seams where PARALLEL.md says they are.

**7. `drawLights`' full-screen night wash** (7834-7836) has the same coverage problem and lives in a job-3-owned function.

---

## 7. `S.opts`: every option, default, readers, and the UI

Defaults are set in `sLoad()` at **456-463**. `S.opts = S.opts || {}` at 456, then five `if (... == null)` lines. Persisted by `sSave()` (478) to `localStorage['comp_ninth']`.

| option | line | default | read at | written at |
|---|---|---|---|---|
| `wasd` | 459 | `true` | 1660 (click-to-move vs Call on pointerdown), 1733 (WASD movement), 1753 (hold LMB to keep calling), 3866 (draw the move marker) | DEV DEBUG 1014 |
| `shake` | 460 | `true` | **1505 (`shake()` early-out), 3853 (`draw` gate)** | DEV DEBUG 1012 |
| `sound` | 461 | `true` | 4041 (`sfx` gate), 4392 (`stepAudio` mute-what-is-already-playing), 4468 | DEV DEBUG 1013 |
| `vol` | 462 | `0.7` | `volNow()` 4025, DEV DEBUG 1020 | `audioVolume(v)` 4630; the taskbar slider via `window.NINTH.volume` (8277) and comp.js 8673/8677 |
| `bigtext` | 463 | `true` | **NOTHING** | nothing |

**`S.opts.bigtext` is a second dead flag.** Only line 463 mentions it in the entire repo (checked across `.js`, `.css`, `.html`, `.md`). It is the same shape of dead as `RT.chroma`: somebody wrote the storage and never wrote the consumer. Worth knowing because it is a free, already-persisted boolean sitting in the save schema, and "big text" is close enough to "screen punch" that reusing it would be confusing. Do not reuse it. Add a new one.

### Where the options UI lives: nowhere

**There is no player-facing options screen.** The only surface for `shake`, `sound` and `wasd` is the **DEV menu, DEBUG tab, backtick** (rows 1012-1014). Volume alone has a real player surface, and it is in the shell's taskbar, not in the game.

To surface a new option to a player you would build the fifth panel. The pattern is fully established and needs **no edit to `comp/comp.js` or `comp/index.html`** (which job 2 owns exclusively):

1. One `<div class="nn-panel nn-p-opts" hidden>...</div>` in `render()`, next to 787-790. `render()` is ninth.js's own markup.
2. Add `'opts'` to the `['book','kit','shop','bag']` array in `panel()` at **4739** and one `else if (open === 'opts') fillOpts();` at 4743.
3. Write `fillOpts()` on the model of `fillKit`/`fillBag`, writing into `.nn-p-opts .nn-pb`.
4. One `<button class="nn-b" data-nn="p:opts" ...>` in `.nn-btns` at 797-803. The delegated handler at 5050 already routes any `p:<name>`.
5. One keybind. PARALLEL.md lists `g h j k l n o p x y z` as roughly free, minus `g` (Reprise, 2790), `i` (bag, 8253), `k` (kit, 1697), `x` (Stanza II, 1691). `o` is free and reads as "options". Register with `bindKey('o', function () { panel('opts'); });` **at the foot of the file**, next to 8253, not at the definition site — the comment at 8249-8252 is the history of why (`KEYS` is a `var` declared at 1527 and registering above it throws on load).
6. Styles: one `/* NINTH NIGHT: options panel */` block appended at **EOF of `comp/comp.css`**, never inside the existing `.nn-*` block. CRLF, trailing newline.

### Surfacing the same option to the DEV menu

One row appended at the **tail of the DEBUG tab**, after 1014 and before the SOUND note at 1016, matching the existing shape exactly:

```js
{ k: 'tgl', t: 'Screen punch (hitstop, zoom, chroma)', get: function () { return !!S.opts.punch; }, set: function (v) { S.opts.punch = v; sSave(); } },
```

`fillDev` (4995-5032) renders `tgl` at 5006 and dispatches at 5025, then calls `sSave(); fillDev(); updateHud(0); sfx('ui')` at 5027. Nothing else is needed. **One new tab maximum and job 1 has it** (PARALLEL.md): the panel is 560px, seven tabs fit and eight do not, which is why the whole SOUND section lives at the tail of DEBUG (see the comment at 1016-1017). Do not add a tab.

---

## 8. The DEV FEEL tab convention

From PARALLEL.md, and it is enforced by nothing but discipline:

> **`TUNE`.** One tunable is two edits in the same commit: the default in `TUNE` and a `num` row in the DEV FEEL tab. A number with no FEEL row cannot be moved in play, which is already true of four of them.

`TUNE` is **158-188**. The FEEL tab is **926-968**. The `num` row shape:

```js
{ k: 'num', t: 'Stanza time dilation', get: function () { return T('dilation'); },
  set: function (v) { S.tune.dilation = clamp(v, 0.05, 1); }, step: 0.05, fix: 2 },
```

`get` **must** go through `T(k)` (480: `S.tune[k]` first, then `TUNE[k]`), `set` **must** write `S.tune[k]`, never `TUNE[k]` — `TUNE` is the default and `S.tune` is the persisted override, and `fillDev` calls `sSave()` after every row action (5027). `step` is the increment, `fix` is `toFixed` digits in the readout (5010). Add a `{ k: 'note', t: '...' }` header when you are adding a group; FEEL already has two (927, 945).

For a boolean tunable the same rule applies with `tgl`; see `droneSelfHurt` at 953 and `slantShift` at 959, both of which store `1`/`0` rather than `true`/`false` because `T()` returns them into arithmetic.

**Append at the tail**, before the `Reset every number to default` button at **967** (which does `S.tune = {}; sSave();` and is the one row that must stay last).

For this job that means every new number gets a row: hitstop duration, hitstop scale, zoom amount, zoom in/out timing, chroma strength, bloom alpha, shake cap, shake frequency, and whatever per-family knobs the matter systems need. That is a lot of rows and FEEL is already 42 of them. A `{ k: 'note', t: 'How it hits.' }` divider before the block is the right call.

---

## 9. The perf HUD (`RT.dbgPerf`)

- **Declared**: **1563**, `dbgStacks: 0, dbgAI: 0, dbgHit: 0, dbgPerf: 0`. Default off. Session-only, not on `S`, so it does not survive a window close.
- **Toggled**: DEV DEBUG row **1011**.
- **Drawn**: **3922-3925**, after `drawMap`, **outside** the shake transform, `11px monospace`, `#9fe0c8`, at `(12, VH - 12)`.

```js
cx.fillText(RT.fps + ' fps · foes ' + RT.foes.length + ' · parts ' + RT.parts.length +
            ' · typo ' + RT.typo.length + ' · calls ' + RT.calls.length, 12, VH - 12);
```

**What each number actually is:**

- **`RT.fps`** — computed in `frame()` at **3806-3807** as a half-second bucket: `_fc` frames divided by `_ft` accumulated **real** seconds, rounded, then both reset. Updates twice a second. Immune to `timeScale` and `dilate`, which is right. Note `real` is clamped to `0.05` at 3804, so a stall longer than 20ms is undercounted in `_ft` and the reported fps is optimistic during a hitch. Also: a hitch longer than 0.5s reports as a single very low number and then recovers, so a one-frame 200ms spike shows as ~28fps for half a second, which is easy to misread.
- **`RT.foes.length`** — **not the live foe count.** It includes folk (25 of them in the Act 3 square, never removed, `f.def.folk` short-circuits at 3062-3068) and it includes corpses for one frame (`f.dead` foes are spliced at the top of the *next* `stepFoes`, line 3068). The DEV footer at **5030** does it properly with `.filter(function (f) { return !f.dead; })`; the perf HUD does not.
- **`RT.parts.length`** — hard capped at **900** by `part()` at **1385**, which silently drops the push past the cap. So this number saturating at 900 means you are losing particles, not that you are at budget.
- **`RT.typo.length`** — capped at **60** by `typo()` at **1420**, which `shift()`s the oldest off. Same reading: 60 means words are being dropped.
- **`RT.calls.length`** — **uncapped.** Bounded only by breath and by the 0.45-radius foe test / place bounds at 2426-2434.

**What it does not count, and would need to for this job:** `RT.rings`, `RT.snaps`, `RT.slams`, `RT.lines`, `RT.fproj`, `RT.combat.cuts`, `RT.assembly`, `RT.beats`, `RT.toasts`, total stacks on the board (`boardTotal()` at 2527 already computes it), draw ms, step ms, sprite cache MB, floor cache MB.

The memory half already exists but only in the console: **`window.__ninth.gfx()`** at **1611-1621** reports `sprites`, `spriteMB`, `spriteBudgetMB` (budget 10 MB, 6434), `floors`, `floorMB`, `keys` and `anchors`. `window.__ninth` is only installed when `location.search` matches `/[?&]dev=/` (1580).

**For an overhaul of this size the perf HUD is your acceptance test and it is currently too thin to pass or fail anything.** The scenario the brief names — 8 foes with 8 stacks each detonating at once — produces 64 stacks, 64 `snapStacks` bursts of `4 + n*2` = 20 particles each (2802) which is 1280 particles against a 900 cap, 8 snaps, 8 `famEffect` typos, 8 damage typos, 1 assembly, 1 slam, 1 ring. The current HUD would show `parts 900` (saturated, dropping) and tell you nothing else. Before writing a single new effect I would add, in the same 3922 block: a `ms` field measuring `performance.now()` around the body of `draw()`, a `rings/snaps/slams/lines/cuts` group, and `boardTotal()`. That is a handful of lines in a block nobody else owns, on the screen-space side of the seam, and it is what will tell you whether the detonation you build tanks the frame.

---

## 10. Short list of what is open, and where

- **`RT.chroma`** (1444, 2748, 3841) — three writes, one decay, zero reads. Yours entirely.
- **`RT.flash`** (3442, 3842, 3900) — one writer in the whole game, white only, no colour field. The natural home for family-coloured bloom.
- **`f.burn`** (2822, 2834, set by `-eat` and `-ark`) — draws **nothing**. The only trace is one 2px particle per 0.5s tick at 3074.
- **`f.silence`** (2831, set by `-erd`) — draws **nothing** except a `SIL` tag under `RT.dbgAI` at 3529.
- **`f.revealed`** (2828, set by `-ight`) — tints the hp bar and nothing else (3522).
- **`f.frozen`** (2838, set by `-ill`) — one flat 45%-alpha `#cfeeff` `fillRect` over the sprite box at **3515**.
- **`drawSnaps`** (2804-2815) — the entire "a rhyme stack detonated" visual is a 2px line that shrinks.
- **`drawCalls`** (3934-3949) — identical for all five families, only `FAMS[c.fam].col` differs.
- **`S.opts.bigtext`** (463) — dead flag, persisted, read by nothing.
- **`refreshStanzaKeys()` on the wasd toggle** (1014) — vestigial. `stanzaKeys()` (1532) returns a fixed `['z','x','c']` regardless of the option.
- **`'saturation'` at 3909** — the precedent that non-separable blend modes are acceptable here. `'screen'`, `'color'`, `'hue'` and `'overlay'` are all on the table for a family-coloured pass.
- **The shake re-randomises per frame** (3853), so its character is frame-rate dependent at 144Hz even though its amplitude is not. A decaying directional sinusoid would look identical at 60 and 144 and would hit much harder.

=== RECON: bible ===
eat` burn, ten over a five second `-ark` rot. At a hardcoded `col: '255,140,60'`.
- **`f.silence`**: nothing. Zero pixels. The only feedback that a foe is silenced is the `HUSH` word that has already faded and the `RT.dbgAI` debug overlay, which is off.
- **`f.revealed`**: tints the health bar to `FAMS.ight.col` (ninth.js:3522), and the health bar only draws when `f.hp < f.hpm`. Reveal a full-health Sealed elite and the *only* change on screen is `drawMod`'s plate alpha dropping from `.85` to `.2`, which is a 2px rectangle going dim.
- **`f.frozen`**: one flat `#cfeeff` rect at `.45` covering `(-r*22, -h)` to `(r*22, 0)`. A rectangle over a sprite that has a silhouette. It is the same rect as the hit flash with a different fill colour.

Two of the five families therefore have a status the player cannot see.

### 6. `-ark` and `-eat` are literally the same code path

Both set `f.burn`. `stepFoes` ticks it with:

```js
hurtFoe(f, f.burn.dps * 0.5, 'eat', { dot: 1 });
part({ ..., col: '255,140,60', add: 1, grav: 0 });
```

So the **shadow** family's damage over time emits orange embers, is attributed to `'eat'`, and is therefore scaled by `charmSum().famDmg.eat`. A player who buys an `-eat` damage charm buffs their `-ark` rot and watches fire come off a shadow. The two families with the most opposed fiction in the game share one field, one colour and one attribution.

### 7. `RT.chroma` is dead, and the "chromatic aberration" that exists is not one

`RT.chroma` is written in exactly three places (init `0`, `slam()` sets `0.5`, `doReprise` sets `1`), decayed in `step()` at `2.4/s`, and **read by nothing**. Confirmed by grep across all 8279 lines.

Meanwhile the effect it was presumably meant to drive is hardcoded inside `drawSlams`:

```js
cx.fillStyle = 'rgba(255,60,90,.55)'; cx.fillText(s.txt, -3 * (1 - k), 0);
cx.fillStyle = 'rgba(60,180,255,.55)'; cx.fillText(s.txt,  3 * (1 - k), 0);
```

That is two coloured copies of the same word at a fixed offset, not a channel separation. It is also the only saturated red and the only saturated blue in the game, in a palette where nothing else exceeds 55% saturation. It reads as a print misregistration, not as impact, and it does not scale with anything.

### 8. `RT.flash` fires once in the entire game

Its sole writer is `onChorusDown` (ninth.js:3442, `RT.flash = 0.5`). A full-screen `rgba(255,250,235, f*0.5)` wash exists, is tested every frame in `draw()`, decays at `2.2/s`, and one boss death is the only thing that ever triggers it.

### 9. The effects layer is split across two clocks and nobody chose the split

`draw(rdt)` passes real `dt` to `drawSnaps`, `drawTypo`, `drawSlams`, `drawLines`, `drawAssembly`, `drawRings` and `drawCuts`. Correct. But the burn tick, the stack timers and `stepParts` all run on the sim `dt`, which is 30% during a stanza.

So during a recital the letters fly at full speed while the embers crawl, the stacks age at a third rate, and the burn ticks four times slower than the word that announced it. The file has an explicit four-clock doctrine written out at ninth.js:3988, and the effects layer does not follow it.

### 10. Every spell in the game is anti-aliased against a pixel-perfect world

`drawTypo`, `drawCalls`, `drawSnaps` and `drawRings` pass unrounded `isoX()`/`isoY()` results straight into `fillText` and `stroke`. The sprite layer rounds obsessively and says why: `blit()` carries the comment *"half a pixel of drift and the whole grid softens."* `px()`, `poly()`, `line()`, the floor blit and every 1px ground detail all round.

The result is that the town is hard pixels and the magic is soft sub-pixel type sliding over it, shimmering as the camera eases. That is not a stylistic contrast anybody designed. It is the two halves of the renderer disagreeing.

### 11. The stacks are under the night veil and the detonation is over it

`drawStacks` runs inside `drawFoe`, which runs inside the `ents` pass, which is **before** `drawLights` and `drawVignette`. So the stack row is drawn, then darkened by `rgba(6,5,14,.5)` (or `.66` in the hollow), then vignetted up to `.8` at the edges. `drawSnaps` and `drawTypo` run after both.

The element whose own comment says *"legible at speed is the only rule"* and *"these must read at a glance, at speed"* is the **darkest** magic on screen. The element that is over in a third of a second is the brightest.

### 12. `drawSnaps` is 104 pixels wrong on the boss

`drawFoe` computes the real height as `f.def.boss ? 130 : (FOE_H[f.def.draw] || 30)` and places the stack row at `sy - h - 18 - f.so`, where `f.so` is a per-foe stagger of 0, 9 or 18. `drawSnaps` ignores all of it and draws at a literal `sy - 44`.

- Mouth (`h` 24): row at -42 to -60, snap at -44. Close enough.
- Sword (`h` 36): row at -54 to -72, snap at -44. Ten pixels low.
- Chorus (`h` 130): row at -148 to -166, snap at -44. **Over a hundred pixels below the stacks it claims to be snapping.**

The comment says the stacks "snap into alignment before it goes." On the only boss in the game they are not on the same part of the screen.

### 13. The stack tags almost certainly do not fit their cells

`drawStacks` sets `font = 'bold 8px "Press Start 2P"'` with `textAlign = 'center'` and steps the cell by `w = 13`. Press Start 2P is exactly square: one em of advance per glyph. At 8px that is **24px of ink per three-character tag in a 13px slot.** Eight stacks means 192px of glyph laid into a 104px row, centred, so adjacent tags overlap by roughly 11px each.

Two things follow. First, `slice(0, 3)` was chosen for legibility and the arithmetic works against it. Second, only about 1.6 characters actually fit per cell, so **one glyph per stack** is the honest version of this design. Measure it in a browser before redesigning around it, but the numbers are not ambiguous.

### 14. `drawAssembly` is the one soft, expensive thing in the file

`cx.shadowColor` / `cx.shadowBlur = 14 * ease` is set **per word, per frame**, for up to six words (ninth.js:2702). It is the only use of `shadowBlur` in 8279 lines, so it is simultaneously the most expensive text in the game and the only blurred edge in a game whose entire technique is hard edges and offset shadows.

It is also, ironically, the closest thing the game currently has to the "money shot" its own comment promises: *"Scattered words becoming a line is the whole idea of the game, so it should be the thing you see."* It is a good idea rendered in a technique the rest of the game does not use, sitting in screen space where it cannot see the enemies it came from.

### 15. Three of the five elite marks are exactly a family colour

```
MODS.loud    #e8913a  ==  FAMS.eat.col
MODS.quick   #9fe0c8  ==  FAMS.erd.col
MODS.sealed  #6fd4ff  ==  FAMS.ill.col
```

A Loud elite wears a slowly pulsing ground ring in precisely the colour of a hunger detonation. A Quick elite trails three streaks in command green. **Any plan that adds family-coloured bloom has to resolve this first or it will make an existing confusion much worse**, because bloom is exactly the effect that destroys the shape information currently distinguishing "a ring on the floor" from "a spell going off."

### 16. `shake()` is the entire screen punch and it does not scale

`shake(a, cap)` caps at 14 by default. Callers: `slam()` always 9, Chorus pulse 8 (5 if the pitch holds), stanza wave 4 or 10, Verse 12, `onChorusDown` 14, a slant 3 or 4, a Call landing 0.7 capped at 4. **A one-stack rhyme and a thirty-stack rhyme both ask for 9.**

And it is applied as `cx.translate(rnd(-s, s) * 0.5, rnd(-s, s) * 0.35)` at unrounded values, which on a nearest-neighbour canvas is a sub-pixel jitter of the entire world. The shake softens the pixel grid rather than punching it.

### 17. `burst()` is the whole matter vocabulary and it is one shape

Axis-aligned squares, `size` 1.4 to 3.2, `grav: 130`, `add: 1`, bouncing off `z = 0` with `vz *= -0.28`, alpha and size both tied linearly to `life / max`. Every explosion, every death, every impact, every detonation in the game is that one square.

The cap is 900 (`part()`, ninth.js:1385). A detonation on eight foes carrying eight stacks each spends `8 * (4 + 16) = 160`. **There is a factor of five of headroom on the existing budget and none of it is used.**

### 18. There are two feel options and one of them is dead

`S.opts.shake` is the only feel toggle wired to anything (`shake()` early-returns, `draw()` guards the translate). `S.opts.bigtext` is defaulted to `true` in `sLoad` at ninth.js:463 and **read by nothing in the file** — the second dead switch after `RT.chroma`. The DEV DEBUG tab exposes shake, sound and WASD, and that is the whole of it.

The SCREEN PUNCH toggle the brief asks for has no home yet. `S.opts.punch` next to `shake`, one row appended at the tail of the DEV DEBUG tab, one line in `sLoad`, is the shape the file already expects.

---

## What this document is for

Eight designers working in parallel on one file will each reach for "make it bigger and brighter" and will each pick a different bright. The three things that stop that:

1. **The palette is closed.** Five family hues, six flame values, brass, and a violet-black dark end. No pure white, no neutral black, no sixth saturated hue, no fat strokes, no blurred edges.
2. **The technique is closed.** Hard pixels, flat matter, gradients only for light, the 1:0.5 ellipse for anything on the floor, drop shadow by offset in `#08060c`, Press Start 2P for spells and VT323 for the ballad, and anything repeated goes in a cached canvas once.
3. **The fiction assigns the image.** `-eat` is consumption and the consumer growing. `-ight` is being looked at by people who would rather not look. `-erd` is hearing perfectly and answering nothing. `-ark` is holding the only light and not handing it over. `-ill` is stopping, and setting a lamp down. Five crimes, not five elements.

Everything in Part 4 is a specific line of `comp/ninth.js` that can be pointed at in a review.