# One page: combine the game and the feel lab (design)

Nov 3, 2026. Second piece of the progression redesign. Follows
`docs/superpowers/specs/2026-11-01-two-bikes-design.md`.

## Why

`/play.html` (the game) and `/lab.html` (the feel lab) run the same ride engine (`createRide`), and the boys use
both. Two pages means two sets of controls and checks to keep in step, and the new bikes only exist in the lab. The
user: "we really should just combine play and lab. They are basically the same thing."

Progression is being rebuilt from the bike types up, so for now the combined page strips progression back to what
the bike types need: no upgrades, no stars, no bolts. Those come back later, once the bike types are locked in.

## Decided (by the user)

- Combine the two pages into one.
- Three bikes: Orange Dirt Jumper, Teal Enduro, Tan Bolinas Ridge. The Black Bayview Trail is dropped: "The bikes
  are basically the same" (it and the Bolinas).
- No upgrades yet (no garage, no parts, no bolts).
- Drop the stars for now; bring them back later.
- Tie the tricks to the bikes for now, as in the table below (confirmed Nov 3: "the split looks good").
- Tune and Swap are in the combined page.

## Goals

- One page, `/play.html`: "Who's riding?" profiles, the glowing-ring challenges, the Spots sheet, Tune, Swap, and the
  three bikes.
- Each bike has its own tricks. A trick the bike can't do says so, and says which bike can.
- Challenges still run (countdown, banner, result) and report the time or trick points, with no stars.

## Non-goals

- No upgrades, bolts, stars, lessons or locked challenges.
- No new bikes, tricks, spots or ride settings.
- No changes to the old `/` prototype.

## Anti-goals

- Losing the boys' saved progress. Bolts, parts, stars and learned tricks stay in the save untouched, for when
  progression comes back.
- A page that's harder to start riding than either page today.

## Approaches

| | Approach | Trade-off |
|---|---|---|
| **A (picked)** | Build on `/play.html`: strip garage, bolts, stars and lessons out of `src/game/main.ts`; bring in the lab's Tune, Swap and bikes. `/lab.html` becomes a redirect | Keeps profiles, rings and challenges, which work; the lab's code is small |
| B | Build on `/lab.html`: port profiles, rings and challenges into the lab | More code moves; same result |
| C | Keep both pages, share more code | Doesn't do what the user asked |

## Tricks per bike (confirmed by the user)

Everyone keeps the bunny hop, manual and tabletop. The air swipes are tied to bikes:

| Trick (swipe in the air) | Dirt Jumper | Bolinas | Enduro |
|---|---|---|---|
| No-hander (↑) | ✓ | ✓ | ✓ |
| 360 (← →) | ✓ | ✓ | |
| Backflip (↓) | ✓ | | |

Why: the dirt jumper is the trick bike, the trail bike keeps the 360, the enduro is the downhill bike. The table is
one data file, so changing it is a one-line edit.

A blocked trick: nothing happens, and a callout says "No Backflip on the Teal Enduro" / "The Orange Dirt Jumper
can!". The hints round the Jump button list only the bike's tricks.

## The page (my calls)

- **Who's riding?** Each rider card shows the three bikes (Dirt Jumper, Enduro, Trail). No stars or bolts line.
- **Dropping the Bayview:** it leaves the lab bikes (`LAB_BIKES`, `LAB_ORDER`, the Swap cycle) and the picker. A
  rider saved on the Bayview loads on the Bolinas. The old `/` prototype keeps both trail bikes (`BIKES` in
  `src/rules/bikes.ts` is untouched).
- **Start:** saved Tune values load, then the bike's own numbers (as in the lab today).
- **Swap** names the bike you're riding, with "tap to swap ▸". Swapping saves the new bike to the rider, so the next
  ride starts on it. Swap hides while Tune, a sheet, a card or a countdown is open.
- **Tune** drawer as in the lab, including its station warps.
- **Challenges:** every challenge open; no lessons (tricks come from the bike). Rings are all yellow. Result card:
  "Slalom!" with "11.2 s" or "650 trick points", then Again / Ride on. Failed results as today.
- **Menu:** Spots only (challenges with Go, and Just ride warps). No Garage, no wallet.
- **URL options:** `?at=`, `?debug`, `?slow=`, `?autoland=0` (from the lab), and `?bike=<id>`, which skips "Who's
  riding?" and rides as rider 1 on that bike without saving it. That's the quick lab-style start for the grown-up
  and for the browser checks.
- `/lab.html` redirects to `/play.html`, keeping its query string.

## Left to the builder

- How `src/game/main.ts` is split if it stays large after the strip.
- The welcome card's wording.

## How we'll know

- The game browser check runs end to end on the combined page: pick the enduro, ride the slalom (time, no stars),
  a blocked backflip on the enduro, swap to the dirt jumper and land one, Tune opens and Swap hides.
- The boys can get from the home screen to riding in two taps, on any of the three bikes.
