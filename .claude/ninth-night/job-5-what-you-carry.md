# Job 5: What you carry

Branch `claude/ninth-items`. Read `README.md` and `PARALLEL.md` first.

Isaac asked for this one by name: "I want an economy and items and all
of that."

## The problem

**There is no inventory.** Charms are the only carried thing and every
one of them is a bag of stat modifiers summed into a single object.
Nothing you carry is an object in the world. No consumables, no keys, no
quest items. No coal, no lamp, no mask, in a game whose entire plot
turns on a coal, a lamp and a mask.

**The chandler does not exist.** He is a panel header, a tooltip, a
comment, and one line of sell flavour. The shop is a menu bound to a key
you can open from anywhere including mid fight, because `panel()` pauses
nothing.

**The word market is cosmetic.** Thirteen words at 30 coin each is
roughly half the game's entire lifetime coin sink, and all four words in
a family are mechanically identical. You are buying a different noun.

**Buying things barely changes how you play.** Of six purchasable
charms: one does nothing on purpose (the joke hilt), one does nothing by
accident (the bell buffs Echo, which nothing spends), and one decays in
value as you progress (the lamp only boosts the two families you start
with).

**The economy is starved on the critical path and unbounded off it.**
Play the story and you cannot afford much. Farm the dev arena and you
drown. There is no middle.

**Nothing is at stake.** Death costs 2.2 seconds and returns you at full
HP and full Breath with every enemy stack cleared. `gotoPlace` fully
heals you on every transition. There is no coin or item penalty
anywhere.

## What to build

**A real inventory.** Things you carry that are things, not modifier
bags. The distinction that matters: an item should be able to be used,
given, shown to somebody, or lost. A charm that adds 30% damage cannot
do any of those.

The fiction is full of objects that should exist:

- **A coal.** The single coal the town gave her. The play has one as a
  prop. The real one is somewhere.
- **A lamp.** Every house sets one on the sill on the ninth night. You
  should be able to carry one, set one down, and set one down in the
  wrong place.
- **The mask.** You wore it when you were nine and it was too big.
- **Things Hal cannot say**, written down. He kneels and writes her name
  in the dirt and the dirt says THE EMBERWRIGHT. Something that carries
  writing, and what happens to writing, is a story object waiting.

Coordinate the story-significant ones with job 1 so the ending can use
them.

**The chandler as a person in a place.** He sells wax, wick and small
objects out of other people's attics and does not ask what you want them
for. That is a character. Job 3 is building interiors: his shop should
be one, and the shop panel should open because you are standing in front
of him, not because you pressed V in a boss fight.

**Make purchases change how you play.** Consumables. Items with
drawbacks. Something that changes a rule rather than a number: an item
that makes slants free, an item that lets a stack survive one pulse, an
item that spends Echo. Coordinate the last with job 4, which owns
whether Echo gets a consumer.

**Give the word market a point** or shrink it. Options: words within a
family get small distinct behaviour; or words are how you unlock the
family and the shop sells something else; or the market becomes about
where words come from, which is more interesting, because in this game a
word is a line of a song and somebody had to remember it.

**Loot with fiction.** Coin appearing from a dead mouth is placeholder.
Hearsay is a misremembered fragment of a song. What it drops should feel
like that.

**Something at stake.** Not a punishing death, this is not that kind of
game, but the current cost of dying is zero and the current cost of
walking next door is a free full heal. At minimum, make those deliberate
rather than accidental.

## Things you should know before you start

**`fillShop` deducts coin before the transaction validates.**
`S.coin -= 30; learnWord(w);` and `learnWord` returns false for an
unknown or already owned word. Currently unreachable because the filter
happens to be correct, which means it is a trap armed and waiting for
the next person to touch that list. Fix it first, it is a two minute
warm up that proves your loop works.

**`wearCharm` silently evicts the oldest worn charm** with no message
and no UI affordance. A player clicking through charms to read them will
quietly unequip things.

**`if (owned && !c.sell) return;` makes charms vanish from the shop
permanently once bought.** Combined with `sell` existing on exactly one
item, the late game shop is a single "sell the hilt" row plus an
always-rendered empty WORDS header.

**`coin()` does not `sSave`.** It survives today only because `foeDie`
saves right after. Any new coin source outside `foeDie` inherits the
bug. The "quiet again" clear bonus already has it.

**The clear bonus requires `RT.wave > 0`, and `gotoPlace` resets
`RT.wave`.** The loft has no `speakDraws`, so killing the Chorus never
pays the clear bonus at all.

**`charmSum`'s key list is the real schema.** A new modifier key on a
charm sums correctly and then silently does nothing unless `stats()` is
also taught to read it. No warning, no assertion, and the charm's
description will cheerfully lie to the player.

**`crown` costs 0** and is granted free at load. `buyCharm` has no zero
cost guard, so any save state where it is missing offers a free
purchase.

**`panel()` pauses nothing.** `doCall`, `doAnswer`, `doStanza` and
`doVerse` all check dead, dev, dialog and map, and never `panel`.
`stepFoes` is unconditional. If you build an inventory the player can
open, decide what it does to the world first.

**A new panel is six edits, all or nothing:** the div, the toolbar
button, the name in `panel()`'s array, a fill branch, a keybind (use
`bindKey`, and `i` is yours), and the fill function. Also add it to the
Escape close cascade or Escape will close the whole desktop window out
from under it.

**Vestigial economy data exists** that will mislead you. Check whether a
field is read anywhere before you build on it.

## Done looks like

- An inventory panel on `i`, with items that are objects rather than
  modifier bags, and at least one that can be used, given or lost.
- The chandler is a person standing in a place.
- Every purchasable thing changes how the game plays, and none of them
  lie in their description.
- A coin economy with a floor and a ceiling: you can afford the things
  the story wants you to have, and you cannot trivially farm past it.
- The word market either matters or is gone.
- Loot that reads as this game's loot.
- The shop cannot be opened mid fight, or opening it pauses the fight,
  deliberately either way.
- `fillShop`'s validation order fixed, `wearCharm`'s eviction visible,
  `coin()` saving.
- DEV KIT tab rows: grant any item, set coin, clear inventory.

## Worth reading in the file

`CHARMS`, `charmSum`, `stats()`, `coin` / `buyCharm` / `sellCharm` /
`wearCharm` / `learnWord`, `panel()` / `fillKit` / `fillShop`, `foeDie`
(the drop), the `S.owned` / `S.fams` / `S.charms` / `S.worn` shapes in
`sLoad`, and the DEV KIT tab.
