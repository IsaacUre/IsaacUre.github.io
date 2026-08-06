# Job 4: What you fight

Branch `claude/ninth-combat`. Read `README.md` and `PARALLEL.md` first.

## The problem

Isaac's original ask for this game was to "test around how the combat
will feel". Call and Answer is good. What you point it at is not.

**Half the bestiary never appears.** There are exactly four `spawnFoe`
calls in normal play: the loft script spawns the Chorus, the Chorus
spawns Mouth adds, and the world's only encounter seeder picks between
Mouth and Thief. That is it. The Droner and the Deaf appear only in the
dev arena, and **the Sword appears nowhere at all**, not even there. All
three are implemented, have counters designed for them, and have never
been seen by a player.

**There is exactly one AI: walk at the player and bite.** Every
archetype shares it. The differences are a flag each, and two of the
four specials have no telegraph at all, so the player cannot read them:
the Thief stealing your detonation and the Droner overwriting itself
just happen.

**No difficulty curve, no scaling, no elites, no modifiers.** An
encounter in the mill on minute two is the same encounter as one on
minute forty.

**Echo is a fully plumbed resource with no consumer.** It is written
from five places, decays, has a HUD bar, and nothing in the game ever
spends it. One of the six purchasable charms exists only to make it fill
faster.

**Combat pays almost nothing.** A few coin. There is no other reason to
fight anything, and since the world layer is deliberately sparse, most
players will fight less than ten things before the boss.

**No second boss is possible** without unpicking `f.def.boss`, which is
used as a synonym for "is the Chorus" in eight separate places.

## What to build

**Make the six archetypes play differently.** They already have the
right ideas on paper. The Thief steals your detonation, so it should be
the enemy you kill first and it should be obvious why. The Droner
overwrites its own rhyme, so it is a race. The Deaf ignores sound and
only `-ill` touches it, so it is a wall you have to change your build
for. The Sword carries no rhyme at all, cannot be stacked and cannot be
detonated, so you kill it slowly with raw Call damage while everything
else on screen explodes beautifully, and that joke only lands if the
player ever meets one.

**Tells.** Every special needs a readable windup. The player's job is
reading the screen and answering at the right moment: give them
something to read.

**A second AI shape, at least.** Something that keeps its distance,
something that comes in waves, something that runs. Right now positioning
is nearly free because everything walks straight at you.

**Elites and modifiers.** A cheap composable layer (this one is
armoured, this one is fast, this one drones) multiplies the six
archetypes into something that can carry a whole game.

**Encounter design, not spawn tables.** Composed encounters with a
reason: this fight teaches slant, this one teaches you to shut up and
let Breath ramp, this one punishes standing still. Extract the roster
out of `speakPressure` into a table you own so per place encounters can
be authored.

**Give Echo a consumer.** It is the one place the game has a spare
resource and a spare gesture. Something that spends a full Echo bar and
feels enormous is the natural bridge between the Stanzas and the Verse.

**A second boss**, if job 1 wants one for the ending. Generalise the
boss hooks first: replace `f.def.boss` used as identity with named
behaviour hooks and an `onDown` callback. Coordinate with job 1 rather
than guessing.

**A death moment.** Enemies currently stop existing. In a game where
everything is a misremembered line, something dying should sound and
look like a sentence being cut off.

## Things you should know before you start

**Settle the Droner's self damage before you tune anything.** Its self
applied stacks expire like any other and route through `breakStack`,
which subtracts HP directly, bypasses i-frames, bypasses `hurtPlayer`
entirely, and can kill. After the first few seconds that is roughly
3 HP/sec of unavoidable untelegraphed chip damage, more than the
Droner's actual bite. Anything that raises stack counts or shortens
stack life multiplies it. Decide whether it is intended.

**The frozen/silence `continue` sits above the boss branch**, so `-ill`
and `-erd` do not slow the Chorus's pulse, spawn and voice timers, they
stop them outright. Any new boss behind that gate inherits the same
chain stun.

**`spawnFoe` returns the foe even when the 70 foe cap rejects the
push.** A caller that keeps the reference is holding something that is
not in the world and will never be stepped or drawn.

**`addStack` silently returns for `norhyme` foes.** Any "when a stack
lands" hook has to handle the stack having been refused.

**`stepFoes` splices dead foes inside a reverse loop, `foeDie` only sets
a flag, and `spawnFoe` pushes to the end**, so foes born this frame are
skipped this frame. `draw()` builds its own painter sorted array.
Mutating `RT.foes` from anywhere else during the step is how you get an
undefined deref that kills the rAF loop, which has happened on this
codebase before and froze the whole game.

**`gotoPlace` wipes `RT.foes`, `RT.wave`, `RT.tookHit` and
`RT.cleared`.** Encounter state that must survive a doorway lives on
`S`. Use `onPlaceChange(fn)` rather than editing `gotoPlace`.

**`stats()` and `charmSum()` allocate on every call** and are invoked
per hit and per foe. A single Answer against ten enemies rebuilds the
charm modifier object a dozen times. Fine now, not at your target scale.

**The Deaf does not do what its blurb says**, and does two different
things in two places. Reconcile it.

**One tunable is two edits:** the default in `TUNE` and a `num` row in
the DEV FEEL tab. Four existing numbers have no row and cannot be moved
in play, and one (`answerRange`) is read nowhere at all.

## Done looks like

- All six archetypes appear in the game through normal play, and each
  one demands something different.
- Every special has a tell the player can read.
- At least two AI shapes beyond walk-and-bite.
- An elite/modifier layer.
- Encounters are composed and authored per place, not drawn from one
  hardcoded pair.
- Echo has a consumer that feels worth saving for.
- Boss hooks are generalised, `f.def.boss` is no longer identity.
- Enemies die like a line being cut off.
- The Droner question is answered explicitly in the PR.
- Every new archetype, elite and boss is spawnable from the DEV SPAWN
  tab (it auto enumerates `FOES`, so new archetypes are free) and
  reachable through `devDemo`.
- Time to kill numbers before and after, measured, not guessed. The
  Chorus is currently about 21 DPS of competent play against 900 HP,
  which is a 45 second fight.

## Worth reading in the file

`FOES`, `TUNE`, `spawnFoe`, `stepFoes`, `stepChorus`, `foeDie`,
`addStack` / `stepStacks` / `breakStack`, `doAnswer` / `snapStacks` /
`famEffect` / `hurtFoe`, `drawFoe` and the per archetype draw functions,
`drawBossBar`, `speakPressure`, `stepScene`, `hurtPlayer` /
`downPlayer` / `revive`.
