# Building an area: lessons from Shredder Hills and Mesa Jump Park (Nov 2026)

Read this before you plan a new area. Every point below cost a fix round, a review finding or a playtest surprise
when the first area was split into a trail hill and a jump park (plan
`docs/superpowers/plans/2026-11-07-first-area-redesign.md`). The tools now exist: `src/world/trail.ts` (curved trails
with height profiles), `src/world/terrain.ts` (a hill fitted under them), `src/world/places/` (one builder per place,
with station data in `data.ts`) and `src/look/scenery.ts` (a SceneryPlan per place).

## The rider's world

- **A place must end where you can see it end.** Past the course, the ground the bike rides on, the land you see
  and what's solid have to agree. The first build had flat rideable ground, hills you could ride through and trees
  you could pass through. The fix was a boundary wall at extent + 30 m with the land starting to rise right at
  the wall. Every pine and boulder inside the wall gets a collider. If the wall feels abrupt, a fence is the next
  step.
- **Features keep their run-up surface.** Moving the Plank onto bare grass added drag. The hop-along robot stopped
  reaching it, so its guard test went blind with no test failing. Put every jump, plank and pump section on a hard
  pad (`slab(..., 'ground', true)`).
- **Grass edges slow, they don't wall.** Trail edges are tall-grass bands plus plant clumps (`Course.bumpers`,
  `T.tallGrassDrag = 1.8`). Tests that asked "stays between the edges" no longer make sense. The edge-rider robot
  is the real check, and it reports whether its best run left the dirt.
- **No dead ends and no side drops.** A trail top must connect onward: Hairpin's top got a dirt spur to the
  shoulder. A trail start on a hillside must not have a drop beside it (the chute start had a 2.2 m drop). Check
  `castDown` everywhere inside the extent; the camera's ground ray must always hit.
- **The terrain goes under the trail, never through it.** The terrain needed a lower-side-of-step rule at ledges, a
  detrended windowed minimum in concave dips and a final keep-under pass, and it was still a few mm proud before
  that last pass. Test it with rays down the whole ribbon, not samples.
- **Seed rock shapes from trail coordinates** (`trailSeed`: trail id, distance along, offset), not world position.
  Otherwise rocks change shape every time a trail moves and ladder times shift for no visible reason.
- **Wire anything per-area across all places.** The result card announced unlocks only for the current place's
  challenges, but locks count stars from both. Anything that lists challenges, stations or unlocks should loop over
  `AREAS`. Old station keys in bookmarks (`?at=Street`) go through `homeFor`.

## Stars and the ladder

- **The ladder rule is the gate:** on the bare hardtail, 1★ is possible and 2★ isn't, on at least 14 of 15
  challenges (`checks/ladder-robots.ts`). Matching old times within ±8% per robot style is meaningless for downhill
  styles, because some are chaotic: a 1 µm start shift flips the outcome.
- **Retune only 2★, and only where the rule actually fails.** List margins under 0.3 s as fragile. Today's fragile
  ones are goatDown 0.07 s, pumpHouse 0.18 s and hairpinDown 0.27 s.
- **When a constraint the user approved breaks, ask the user.** The edge rider getting 2★ on Goat Ladder ↓ was
  ruled acceptable mid-build. It should have gone to the user at the time. On Nov 12 they kept it, because only 42
  of 528 edge runs finish.

## Speed on the iPad

- **Nothing per physics step may scan a whole trail.** Zone tests scanned every 0.1 m of every trail: 0.4 ms per
  step, and more when catching up. Bounding boxes per block of 32 segments brought it to 0.03 ms. Watch per-frame
  allocations too.
- **Build-time scans add up.** The terrain's `heightAt` used a linear scan; a binary search took the hill build
  from 1.8 s to 0.4 s, and also speeds up every robot run.
- **Heavy scenery makes the first seconds slow.** The resolution governor read that as a slow device and stepped
  down once a second, and each step blanked the canvas, so the screen flashed. It now waits out the first
  `GOVERNOR_WARMUP` (4 s).
- **Budget per place: about 650k triangles and 90 draw calls.** The first area landed around 390–534k and 40–66.
  Headless numbers aren't fps; measure the iPad with `&debug`.

## Checks and robots

- **Headless Chromium runs at about 10 fps with scenery on.** Browser checks must wait for a condition and assert
  the wait's result, never sleep a fixed time.
- **The full ladder takes 20+ minutes.** Run it once per area, split by challenge in parallel:
  `ONLY=<id> npx vite-node checks/ladder-robots.ts`, 4–5 at a time. Kill leftover runs afterwards. Duplicate runs
  kept eating CPU for hours.
- **Before a refactor, capture robot output and require byte-identical output after it.** That caught every
  accidental behaviour change in the first area.
- **When deleting old geometry, freeze its numbers as literals** in tests that compared against it. Write a comment
  saying where they came from.

## Running the build with agents (cost)

- **Use sonnet implementers and batched sonnet reviews**, every 2–3 tasks, with one opus review of the whole branch
  at the end. Opus everywhere cost about a million tokens by Task 7.
- **Hand agents files, not pasted history.** That means the task brief, the ledger rulings that apply to the task
  and a report file path.
- **Closing the laptop lid stops every agent and robot.** Agents can be resumed afterwards, but a long robot run
  may restart. Don't start the long ladder run right before travelling.
