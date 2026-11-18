# Two very different bikes: dirt jumper and enduro (design)

Nov 1, 2026. Small change. First piece of the progression redesign.

## Why

Progression will rest on three layers: the **bike type** sets the base feel and hard limits, **parts** move the
feel within that bike's range, and **rider skill** is what the park and trails test. Before building parts or
prices, prove the bottom layer: two bike types that feel fundamentally different, ridden back to back in the park.
Today the lab's two bikes (Bolinas, Bayview) differ only in spin speed and look.

In the user's words: the dirt jumper is "great at tricks and quick movements, but awful at downhill." The enduro is
the reverse.

## Goals

- Add a **Dirt Jumper** and an **Enduro** to the feel lab (`/lab.html`), each a clearly different ride.
- Each looks like its type: the dirt jumper small, low, with much smaller wheels; the enduro long, slack, with big
  wheels. The rider stays the same size on both.
- Swap bikes mid-ride, in place, so the boys can ride the same spot on each.
- The Tune panel still works on top, so the bikes can be tuned live with the boys.

## Non-goals

- No parts, bolts, prices or unlocks. No changes to `/play.html` or the save game.
- No bike-only behaviors yet (that's iteration B, below).
- No new park features.

## Anti-goals

- Bikes that differ only on paper. If the boys can't tell them apart in a minute of riding, it failed.
- A dirt jumper so bad downhill that it's no fun to try. "Awful" means hard and funny, not impossible.

## Approaches

| | Approach | Trade-off |
|---|---|---|
| **A (picked)** | Each bike type is a set of overrides on the lab's existing ride settings (the way `tuningFor` works for garage parts), plus its own look | Cheap, tunable live; bikes can only differ in ways existing settings cover |
| B (next) | A, plus one or two behaviors only that bike has (dirt jumper speed wobble when fast downhill; enduro rolls through small rocks) | More "fundamentally" different; a little bike-rule code |
| C (rejected) | Real geometry numbers (wheelbase, head angle, travel) that ride settings are derived from | The big build we're avoiding; the boys would feel the same result as A/B |

The user picked **A, then B**: build A, playtest, then add B's behaviors where A isn't different enough.

## Decided

- Approach A, then B.
- The look changes, and the dirt jumper has much smaller wheels.

## The ride (my call, starting points to tune in playtests)

Relative to the lab defaults (`src/lab/tune.ts`):

| Setting | Dirt Jumper | Enduro | Why |
|---|---|---|---|
| Hop, full hold (`hopFull`, 6) | 7.5 | 5.2 | DJ pops; enduro is lazy |
| Lip pop (`lipPop`, 0.45) | 0.65 | 0.35 | Same |
| Spin speed (bike `spin`) | ×1.35 | ×0.8 | DJ is light and short |
| Steer response (`steerResponse`, 14) | 22 | 10 | DJ snappy; enduro steady |
| Tightest slow turn (`minRadius`, 1.5) | 1.1 | 2.1 | Short vs long wheelbase |
| Pump (`pump`, 8) | 10 | 6 | DJ made for pump tracks |
| Sprint (`sprint`, 9.5) | 8.5 | 10 | Single speed vs gears |
| Top speed from hills (`maxSpeed`, 16) | 13 | 19 | Enduro bombs |
| Brakes (`brake`, 9) | 6 | 13 | DJ often rear brake only |
| Grip (`grip`, 9) | 7.5 | 10.5 | Small hard tires vs big knobbies |
| Rock/log wipeout speed (`rockCrash`, 5) | 3 | 8.5 | Enduro eats rocks |
| Speed kept on flat landing (`flatKeep`, 0.85) | 0.75 | 0.95 | No suspension vs lots |
| Leg power on climbs (`legs`, 4.1) | 3.2 | 4.6 | Low seat, one gear |
| Front wheel rolls up (`rollUp`, 0.15) | 0.12 | 0.22 | Big wheels roll over more |

## The look (my call)

- Split bike geometry from rider size in `src/bike/rider.ts`: the rider is no longer scaled by wheel size. Each bike
  type carries its own wheel radius, wheelbase and frame points.
- **Dirt Jumper:** about 24" wheels (radius ~0.29 m), short wheelbase, low top tube, slammed seat, rigid-looking
  fork, bright frame color.
- **Enduro:** 29" wheels (radius ~0.38 m), long wheelbase, slack front, chunky fork, a visible rear shock, dark or
  bold frame color.
- Existing Bolinas and Bayview stay in the picker as the in-between reference and keep their current look.

## In the lab (my call)

- The start picker lists all four bikes.
- A **Swap bike** button in the lab overlay cycles bikes in place: same spot, same speed. The rider model is rebuilt
  and the bike's settings applied.
- Choosing or swapping a bike applies that bike's settings over the current tuning. Tune panel edits apply live on
  top and last until the next swap. "Copy" exports them so tuned values can be folded back into the bike file.

## Left to the builder

- Exact names and colors (plain "Dirt Jumper" / "Enduro" are fine for now).
- Where bike types live (extending `src/rules/bikes.ts` is the obvious place) and how the geometry is
  parameterized.
- How the robot checks pick a bike; adding a dirt jumper and enduro pass to `checks/downhill-robots.ts` is the
  cheapest way to confirm "awful at downhill" before a playtest.

## How we'll know

- Robots: the enduro rides the downhill clean at a speed where the dirt jumper wipes out. The dirt jumper scores
  more trick points on the jump lanes.
- Playtest: the boys ride the jump lanes, pump track and downhill on each bike and can say which is which, and why.
