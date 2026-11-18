# Bike rules, energy and showcase terrain (design)

Nov 5, 2026. Third piece of the progression redesign. Follows `2026-11-01-two-bikes-design.md` (iteration B of the
bike types) and `2026-11-03-one-page-design.md`.

## Why

The user: "I really want these bikes to feel different AND have a path to upgrading them, such that each upgrade
feels different." Today the three bikes (Orange Dirt Jumper, Teal Enduro, Tan Bolinas Ridge) ride by the same rules
with different numbers, and some numbers are backwards from real life (the enduro has the strongest legs). The
Bolinas has no numbers of its own. Tricks are blocked per bike instead of being hard or easy on a bike.

The real bikes differ in kind, not just degree: a dirt jumper has one gear, small wheels and no rear suspension
(pops and spins instantly, tops out early, hates climbs, gets twitchy and wobbles at speed); an enduro is long, slack,
heavy and plush (stable and plows rocks at speed, slow to get going, the suspension soaks up a lazy pop); a trail bike
is the all-rounder and the best climber.

The user also wants the fundamentals to feel more like real riding: "In real life, you are trying to manage your
energy. You can go fast for a short burst, but then you're burnt. Or, you can go slow for a long time without burning
out. Different inclines require different strategies."

This piece gives each bike rules of its own, adds energy, switches tricks to physics, and adds park terrain where each
bike's rules matter. Parts and the garage come after (piece 3 below), built on the same settings.

## Decided (by the user)

- **Upgrades sharpen a bike's strength, plus a few trade-off parts**, "similar to real life". Trade-offs stay on a
  bike's home turf (set it up for one of its own jobs vs another); they never fix its weak spot. "It probably doesn't
  make sense to make a dirt jumper good at climbing. What's the payoff exactly?"
- **Tricks run on physics, not bike blocks.** "Once they learn how to do a trick, they can in theory do it on any
  bike." Whether a trick fits depends on the bike's pop and spin.
- **Parts are bought once, hang on a garage wall, and swap on and off freely.** (Piece 3; recorded here so the
  settings are built for it.)
- **New terrain goes in the park for now**, not behind the family car.
- **Approach A** (below): every bike rule is a setting, off by default, that bikes switch on.
- **Energy everywhere you pedal hard**, not only on climbs. "Easy enough to back it off later if needed."
- **Burnt on an incline puts a foot down to rest; burnt on the flat only softens your legs.** Braking to a stop is
  how you rest by choice.
- **Every bike has a speed wobble**, starting at a different speed per bike, shown on the bike and screen, not as a
  meter.
- **Three areas of skill: climbing, descending, tricks.** The user's idea; challenges to master in each area are
  progression (piece 3), not this piece.

## Goals

- Each bike has at least one rule of its own the boys can feel in a minute of riding.
- Energy: bursts cost, a steady pace lasts, coasting and descending refill. Different inclines want different
  strategies.
- Every bike can try every air trick; a slow-spinning, low-popping bike needs a bigger jump to land it.
- Four new park places, each where one bike shines.
- **The right bike makes it easier; skill makes it possible.** Every bike can finish every place with careful riding.

## Non-goals

- No parts, garage wall, bolts, prices, stars, lessons or trick learning (piece 3).
- No per-area challenge sets yet (piece 3).
- No trails behind the family car.
- No changes to the old `/` prototype.

## Anti-goals

- **Wobble that feels like broken controls.** It must warn loudly before it crashes you, and braking always saves you.
- **Burnt means waiting.** Running out of energy is short and sharp, never 20 seconds of crawling.
- **Energy nagging in the jump lanes**, the part the boys love most. If it does, back it off there first.
- **A place a bike can't finish at all.**
- Losing saved progress (bolts, parts, stars, learned tricks stay in the save untouched).

## Approaches

| | Approach | Trade-off |
|---|---|---|
| **A (picked)** | Every bike rule is a new ride setting, off by default; a bike's ride table switches its own on. One shared ride engine | All live in Tune for playtests; parts later just move settings. Each rule has to fit the shape of a setting (all of ours do) |
| B | Each bike gets its own code hooks for its behavior | Allows odder behaviors, but not tunable live, and every part would need code too |
| C (rejected Nov 1) | A physical model (mass, gear ratios, travel) that settings derive from | The big build; the boys would feel the same result as A |

## The bike rules (my calls; starting points to tune)

New settings join `DEFAULTS` in `src/lab/tune.ts` and a new Tune group, "Bike rules". A value of 0 means the rule is
off. Bikes set them in `BIKE_RIDE` (`src/lab/bikes.ts`) the way they set existing ones, so they join `RIDE_KEYS`
automatically.

### Dirt Jumper: one gear, small and twitchy

- **Gear top (`gearTop`).** Above this speed pedaling stops helping: the legs spin out. Only hills, pumping and
  landings take you faster. Start ~8.5 m/s, so its sprint target is effectively capped there.
- **Steep bog (`gearBog`).** One gear is too hard for steep pitches: the energy cost and the drop-off in leg power
  grow with slope beyond what geared bikes feel. Carry speed into a climb or suffer.
- **Wobbles first** (see "Speed wobble: every bike" below): the lowest wobble speed and the hardest kicks.
- Keeps: big pop, fast spins, snappy steering, strong pump, weak brakes, small wheels (rolls up less).

### Teal Enduro: heavy and plush

- **Heavy.** Slower to pick up speed (`pedalAccel` lower) and energy costs more (`energyCost` above 1).
- **Soaks the pop (`popSoak`).** Rolling off a lip or popping off-time loses this share of the air. A perfect-timed
  pop gets close to full air. Skill, not a block.
- **Plows rocks (`plowSize`).** Rocks and roots shorter than this are ridden over with a shake, no bonk, no wipeout.
  Works with the existing `rockCrash` and `rollUp`.
- **Stable.** Wobbles last, only near its top speed, and bumps barely kick it. Highest top speed from hills,
  strongest brakes, most grip, as today.
- Slow spins (spin ×0.8) and low pop mean a backflip only fits off the biggest jump.

### Tan Bolinas Ridge (trail bike): the climber

- **Cheapest climbing (`energyCost` below 1)** and the strongest legs. Fix the backwards numbers: Bolinas legs highest,
  Enduro and Dirt Jumper below it. Starting points: Bolinas 4.4, Enduro 4.0, Dirt Jumper 3.8.
- **Tightest turns in switchbacks** (`minRadius` lowest of the three, or matching the dirt jumper).
- **Forgives gravel** (`looseLimit` higher, so it takes more push before the wheel spins).
- Never awful anywhere, never the best on a downhill or a jump line.

### Speed wobble: every bike (decided by the user)

Every bike has a speed where it gets scary; the bikes differ in where it starts and how hard bumps kick. That way
future steep descents can trouble the Bolinas and even the enduro. Settings: `wobbleSpeed` and `wobbleKick` per bike,
`wobbleGain` and `wobbleLimit` shared. `wobbleSpeed` 0 turns it off.

| | `wobbleSpeed` (start) | Top speed from hills (`maxSpeed`) | `wobbleKick` |
|---|---|---|---|
| Dirt Jumper | ~10 m/s (22 mph) | 13 | Hard |
| Bolinas | ~14 m/s (31 mph) | 16 | Medium |
| Enduro | ~18 m/s (40 mph) | 19 | Gentle |

`wobbleSpeed` must sit below each bike's `maxSpeed` or it never happens.

Above `wobbleSpeed`:
- Steering gets *touchier* with speed instead of calmer (`wobbleGain`).
- Bumps kick the heading sideways, bigger the faster you go and scaled by the bike's `wobbleKick`: landings, rock and
  log bonks, and rough ground (a new surface on the Rock chute).
- Swinging side to side builds a hidden wobble level; past `wobbleLimit` it's a wipeout ("tank-slapper"). It builds
  over about a second so there's time to react.
- Braking below `wobbleSpeed` drains it fast. Holding the thumb very still drains it slowly.

**Shown on the bike, not as a meter (decided by the user):** the handlebars swing more and more, the camera shakes,
a rattle gets louder, and the screen edges pulse red near the limit. The stick's energy ring stays the only gauge.

In today's park mostly the dirt jumper feels it; the Rock chute's straight pushes the Bolinas too. Watch the Bolinas
on the existing downhill: braking before the fast bits must get it through clean.

A garage lever later: e.g. the Bolinas's longer fork raises its `wobbleSpeed`.

## Energy (my calls; starting points to tune)

One energy tank per rider, shared by all bikes (bikes change cost, not tank size, for now).

- **Drains** with how hard you pedal and how steep it is. Stick up (sprint) drains; a hard climb drains faster. A
  steady push on a climb (stick centered or lightly up) roughly breaks even, so going slow lasts forever.
- **Refills** whenever you're not pushing: coasting, rolling downhill, braking, in the air, stopped. Fast: a downhill
  or a flat stretch refills most of the tank in a few seconds. The pump track is coast-only, so it never drains there.
- **Burnt (decided by the user):** what happens at empty depends on the ground.
  - **On an incline** (the same slope the climb's stall check uses): the rider puts a foot down and rests, about
    2 s, until the tank is back to about a third, then rides on with the same grace period a stall gets. The foot-down
    callout says "Burnt! Catch your breath".
  - **On the flat or downhill:** never a forced stop. Pedal power drops to the steady level (like `steadyLegs`) until
    the tank is back to about a third; you keep rolling, and coasting refills fast.
- **Resting by choice:** pull the stick all the way back to a stop. A stopped rider puts a foot down (the dab pose,
  no penalty) and refills fastest; on a hill the bike holds still while stopped. Restarting gets the stall grace
  period. A smart rider rests at a flat switchback corner on their own terms, before the hill makes them.
- **Bikes:** `energyCost` multiplies the drain (Bolinas ~0.8, Dirt Jumper 1, Enduro ~1.25); the dirt jumper's
  `gearBog` adds extra drain on steep pitches; spinning out above `gearTop` costs energy for nothing.
- **Settings:** `energyTank` (seconds of full sprint on the flat, start ~8), `energyRefill`, `energySteady` (the push
  that breaks even on a climb), `burntUntil`, `energyCost`. Setting `energyTank` to 0 turns energy off.
- **Showing it, where their eyes already are:** a ring around the stick's knob that empties, yellow then red; the
  rider pants and bobs when low (reuse the Winded bob in `src/bike/rider.ts`). At empty the knob flashes red and a
  callout says "Burnt! Ease off" on the flat (on a climb, "Burnt! Catch your breath"). The first time energy drops below half, a one-time callout: "Pushing hard uses
  energy". Discoverability is first-class (the boys missed hidden controls before).
- **Resets:** a warp or a challenge start fills the tank; a bike swap keeps it.
- Existing **Winded** (after a big crash, pedal at 40% for 3 s) stays as is, separate from energy.

## Tricks on physics (my calls)

- Every bike can try the no-hander, 360 and backflip. Remove the per-bike block (`BIKE_TRICKS`, `whoCan` and the
  "No Backflip on the Teal Enduro" callout in `src/game/main.ts`; `src/game/bikeTricks.ts` goes or shrinks).
- The ride engine already decides whether a trick fits: spin time ÷ the bike's spin speed vs air time, and landing
  mid-trick is a bobble or a wipeout. The bike's pop, `popSoak` and spin do the rest.
- New teaching callout when a trick lands unfinished: "Not enough air for a Backflip! Try a bigger jump" (or "pop it").
- The hints round the Jump button list all air tricks again on every bike.

## Showcase terrain (my calls)

Four new stations in `src/lab/course.ts`, each with a ring and a Spots entry like the existing ones (`src/game/spots.ts`,
`src/game/challenges.ts`). Exact layout and placement are the builder's, within the existing park.

| Place | Favors | What it is | Challenge |
|---|---|---|---|
| **Rhythm line** | Dirt Jumper | 5–6 back-to-back doubles, tight spacing, coast-only (no pedaling), so speed comes only from pumping and popping well | Clean run with trick points |
| **Rock chute** | Enduro | A second, steeper way down from the Summit: rough ground, root and rock gardens, then a long fast open straight where the dirt jumper wobbles unless it brakes | Time to the bottom |
| **Switchback trail** | Bolinas | Twisty rolling singletrack with tight switchbacks both up and down, short punchy climbs where energy matters, a gravel patch | Time, start to finish |
| **Big table** (Jumps XL) | Tricks on any bike | A bigger table beside Jumps L, sized so the enduro fits a backflip only with a perfect pop | Trick points |

"Rough ground" is a new surface: it shakes every bike, kicks each bike's heading above its `wobbleSpeed` (by its `wobbleKick`), and the
enduro plows its small rocks and roots.

## Left to the builder

- Exact setting names, formulas and starting numbers (the ones above are starting points).
- How energy maps onto the existing climb pedaling code in `groundStep` (`src/lab/bike.ts`), which already has legs,
  effort and `steadyLegs`.
- Layout and placement of the four places in the park, and their station warps in Tune.
- Sounds and art for the wobble, the energy ring and rough ground.
- How the wobble meter and kicks are modeled, as long as it warns for about a second and braking always saves you.

## Known issue to carry forward

Tune saves every number on any change, so new defaults don't reach a device that has ever touched Tune until someone
presses Reset there. New bike-rule settings are bike settings (in `RIDE_KEYS`), so a bike pick sets them, but energy
settings are not; the iPad will need a Reset in Tune after this ships.

## Piece 3 (later, not built here): the garage wall and parts

Recorded so this piece's settings are built for it. Parts are bought once, hang on a garage wall, and swap freely.
Each bike gets its own parts; most sharpen its strength, a few are home-turf trade-offs that move settings from this
piece. Examples:

- Dirt Jumper gearing: big gear (higher `gearTop`, slower pickup: big tables) vs small gear (lower `gearTop`, quick
  pickup: pump track, rhythm line).
- Enduro shock: coil (bigger `plowSize`, more `popSoak`) vs air (more pop, less plow). Lighter wheels: faster spin,
  less soak, so the backflip fits off smaller jumps.
- Bolinas fork: longer (better downhill, wider turns) vs short (climbs and turns sharp, rattled on descents).

**Bump kick and wobble speed come from the parts, not just the bike (decided by the user).** The bike sets starting
values; parts move them:

| Part | Bumps kick less (`wobbleKick`) | Wobble starts later (`wobbleSpeed`) |
|---|---|---|
| Fork / shock (more or better suspension) | ✓ | ✓ |
| Tires (bigger, softer) | ✓ | |
| Bars (wider) | | ✓ |

Wheel size stays part of the bike's identity (a dirt jumper frame can't take 29" wheels), which is why the enduro
starts calm. A dirt jumper with a better fork and fatter tires gets calmer, but still wobbles first. So both wobble
numbers must stay plain ride settings in `BIKE_RIDE` that a part can override, with no logic tied to bike ids.

Challenges to master in each area (climbing, descending, tricks) and "learn a trick before you can do it" come back
with progression in piece 3.

## How we'll know

- **Robots** (`checks/`), one pass per bike on each place:
  - Each place's favored bike has the best clean time or score.
  - Every bike can finish every place with a careful robot (brakes before the straight, paces the climb, pops on
    time).
  - Dirt Jumper with the stick up the whole way down the Rock chute wobbles out; braking for the straight gets it
    through. The Bolinas wobbles on the chute's straight unless it brakes; the Enduro doesn't.
  - Existing downhill: the Bolinas braking before the fast bits gets through clean despite its new wobble.
  - Burning out on a climb puts a foot down and refills to about a third; burning out on the flat never stops you.
  - Braking to a stop on a climb holds the bike still, refills fastest, and the restart doesn't stall straight away.
  - Climb: a steady robot never burns out; a full-stick robot burns out and is slower overall on every bike; the
    Bolinas has the best climb time.
  - Enduro: a perfect-pop backflip lands on the Big table, and a rolled one doesn't; it doesn't fit on Jumps L.
  - Existing checks (jump lanes, slalom, pump laps, downhill) still pass, and energy doesn't burn out the jump-lane
    robots.
- **Browser check:** the energy ring empties on a held sprint and refills on coasting; a backflip on the enduro is no
  longer blocked.
- **Playtest:** the boys ride each new place on each bike and can say which bike it's for and why. They notice energy
  without being told and change how they push on climbs.
