# First area redesign: Shredder Hills and a jump park, in the Front Range foothills

Nov 7, 2026. Brainstormed with the user. The look test (`?look=foothills`, `src/look/foothills.ts`) was the spike
behind it.

## Why

Shredder Hills is "a bunch of features scattered around" on flat lawn: straight trail strips that look like gold
blocks, a street, leftover test pieces. Real areas will have one or two features, connected. The user wants the first
area to feel like a real Colorado place, with atmosphere: "mountains in the distance, some pines or cactus near by,
rocks and other various features." It's also the pattern every later area copies.

## Decided with the user

- **Look: Front Range foothills.** Golden grass mesa, red Flatiron slabs, snowy peaks far off, ponderosa pines,
  yucca, prickly pear, sandstone boulders. (The pine-forest and red-rock looks could be later areas.)
- **Backdrops are Nano Banana pictures** in the style of the map (`public/map/colorado.png`). Three 4K pictures
  (`public/backdrop/{south,west,north}.jpg`) are baked by `scripts/bake-backdrop.ts` into `public/backdrop/baked/`.
  The user approved the result on the iPad, including the ends, which sink below the horizon instead of fading.
- **Two places instead of one.**
  - **Shredder Hills becomes a trail hill:** Goat Ladder, Hairpin Hollow and Boulder Dash come off one hill and meet
    at a trailhead with the family car.
  - **A new jump park** gets Table Row (Small, Medium, Big, XL), Whoop-de-Doo, the Pump House, the Plank and Cone
    Zone, strung on one flow line.
- **Both places are open from the start.** The starters stay the same (Goat Ladder ↑ and ↓ on the hill, Table Row
  Small at the park).
- **How the hill gets built: curved trails that keep how each one rides (approach C, below).**
- **Atmosphere** the user liked "if we can really do it": grass edges instead of rock lines everywhere, the low warm
  sun, the hawk, prairie dogs, and later grasshoppers, dust, and wind and bird sounds.
- **Stay in the browser.** Measured on the iPad with the look test: a steady 60 fps, and the resolution never
  dropped below 1.35x, at about 630k triangles and 80 draw calls.

## Goals

1. Two places on the map, each its own world, loaded when picked: the Shredder Hills trail hill and the jump park.
2. Shredder Hills is one foothill. Its trails wind over it and meet at the top and at the trailhead. Each trail rides
   the way it does today, with its climbs, pitches, gravel, ledges, step-downs, log, rock garden and boulders.
3. The jump park's features flow into each other on one line you can ride round, without the challenges changing.
4. Both places wear the foothills look: the painted mountains, golden grass, rolling land past the edge, pines,
   yucca, prickly pear, boulders, prairie dogs, the hawk, and the lower, warmer sun.
5. Trail edges are grass and plants, not rock lines everywhere, and still keep riders on the trail.
6. Saved progress carries over: same challenge ids, same stars, same cogs.

## Non-goals

- Real Marshall Mesa trails (Doudy Draw). That's the next area, built with the trail tool from this project.
- Sounds, grasshoppers and dust. That's a small follow-up right after this one.
- New challenges, new tricks, scoring changes (lines over features stays), bike feel changes.
- A separate backdrop per place. Both use the same painting for now.

## Anti-goals (a failure even if it works)

- The trails stop riding the way the boys like: Goat Ladder's pitches, the gravel that needs a little push, the
  ledges, the step-downs.
- Riders skip obstacles by riding beside the trail. The boys did this on the climb before the rock edges went in.
- The iPad drops below 60 fps.
- It still looks built: flat slab sides, straight spokes, features dropped on lawn.

## Constraints

- three.js on iPad Safari (10th-generation iPad), 60 fps. **Budget per place: the look test's numbers** (about 650k
  triangles and 90 draw calls). Going over means measuring on the iPad again.
- Rapier trimesh colliders, built from meshes tagged `userData.collide` before `mergeStatic`.
- The challenge rule: on the bare hardtail, every unlocked challenge can be cleared at 1★ but not 2★. It holds on 14
  of 15 today (Cone Zone is the known exception). Check it with `checks/ladder-robots.ts`.
- Scoring model: points come from lines over features. Rerun the hop-chain guard robot styles.
- Git (updated Nov 24): the project is now a real repo. Work on a branch, commit normally (read "snapshot" steps as commits), push, open a PR with `gh pr create`; `main` is protected. The `.superpowers/sdd-git` snapshots mentioned in this document are old history kept for reference.
- Pacing is pinned by `tests/pacing.test.ts`. This project shouldn't need to change it (see Locks).

## Approaches considered

- **A. Straight trails, hill filled in around them.** Each trail stays a straight strip pointing out from one summit,
  and a hill surface fills the gaps. The least work, and the trails ride exactly as now. But it still looks built
  (three straight ramps), and the trail tops sit at different heights.
- **B. Sculpt the hill first, lay trails over it.** It looks the most natural, but every climb and descent gets
  rebuilt, every star time retuned and the robots rewritten. The most work, and it puts the anti-goal at risk.
- **C. Curve the trails, keeping how each one rides (picked).** Each trail keeps its height profile (height by
  distance along the trail) but follows a curved path on the ground. The hill surface is generated to fit under and
  between the trails. Real trails later are the same thing: a path on the ground plus a profile. The cost: curves
  change speed a little, so star times get re-checked, and the robots follow paths instead of straight lines.

## The design

### Trails: a profile along a path

Today a trail is a `Profile` (height by distance `u`) extruded along a straight line in x (`extrude` in
`src/lab/course.ts`). Switchbacks are separate straight legs joined by flat turn pads.

New: a **trail** is a path on the ground (a 2D curve, with distance along it) plus a profile. The riding surface is a
ribbon swept along the path, its height from the profile at each distance, its width from the trail. Everything
placed on a trail uses trail coordinates (distance along, offset across) instead of world x and z:

- Ledges, logs, step-downs, kicks and lip bars.
- Rocks and boulders, the rock garden, and gravel patches.
- Rough ground and the climb zones.
- Start, finish and via lines, slalom-style gates, and line assist (`Line.lip` and `yaw` come from the path).

This replaces the x-aligned assumptions:

- `across()` gates.
- The axis-aligned `Area` boxes for `climb.area`, `climb.loose`, `rough` and `coast`.
- `climb.ledges` with `dir` and `half` along x.
- The ledge warning in `ride.ts`, which tests `cos(yaw) * dir`.

These become "inside trail T between distances u0 and u1". A trail's turns are arcs in its path. A switchback is a
tight arc with the same radius as today's pads, so riders take it the same way.

**Profiles carry over.** Goat Ladder up (three legs and the summit hairpin), Goat Ladder down (two step-down tables,
the rock garden, the log, the drop), Hairpin Hollow (four legs, each rising `TRAIL.rise`, with its step-downs and
gravel) and Boulder Dash keep their profiles and feature positions in distance along the trail. Only where they lie
on the ground changes.

### The Shredder Hills hill

- One foothill. **The summit is Boulder Dash's start (20 m).** Goat Ladder's top (12.1 m today) and Hairpin Hollow's
  top (10.7 m) sit on a **shoulder** below the summit, on different faces. A short connector trail (no challenge,
  just riding) climbs from the shoulder to the summit, so the whole hill links up. *(My call: raising Goat Ladder and
  Hairpin to 20 m would add 8–9 m of climbing and change their times. Lowering Boulder Dash would cost the speed its
  long straight needs.)*
- **The trailhead** is at the foot of the hill: a gravel lot with the family car, a split-rail fence and a trail
  sign. All the trail bottoms meet there: Goat Ladder's start and its descent's finish, Hairpin Hollow's start and
  finish, and Boulder Dash's finish. A new rider arrives here.
- **Goat Ladder** climbs the gentle face in its three legs. Its descent comes down a different line. **Hairpin
  Hollow** zigzags up a steeper face (up and down are the same trail). **Boulder Dash** drops straight off the summit
  down the steep face. Its long fast straight runs out onto the flat toward the trailhead.
- **The hill surface** is generated to fit the trails. Near a trail (within about 1.5 m of its edge) the ground
  matches the trail's height, like a bench cut into the hillside. Further away it blends into the natural hill shape.
  Between trails it never pokes above a trail. It's flat-shaded, low-poly, gold with sage patches, like the look
  test's land.
- The rough faces between trails are steep, grassy and slow (see Trail edges).

### The jump park

- **A start hill** (a raised mound with a roll-in) at one end. **Table Row's four lanes** (Small, Medium, Big, XL)
  drop off it side by side, as today.
- **Berms** at the lanes' far end turn the line round into **Whoop-de-Doo** (its own roll-in comes off the start
  hill too). Its run-out berms into the **Pump House** entrance. The Pump House keeps its loop of rollers and banked
  turns.
- **The Plank and Cone Zone** sit on flat ground by the park's lot (gravel, the car, a fence), so they keep the
  run-ups they have now.
- The features themselves don't change shape: lanes, the rhythm line, the pump track loop, the slalom and the skinny
  keep their geometry and their run-ups. Only the berms and dirt paths that link them are new. You can ride the whole
  park round in Just Ride. Challenges still start at their rings and are timed or scored per feature, as today.
- Ground: dirt paths over golden grass, with the same scenery as the hill, kept clear of every line.
- The park's features stay straight, so its no-pedal zones (the Pump House, Whoop-de-Doo) can stay boxes; only trail
  zones on the hill move to trail coordinates. *(My call.)*
- Just Ride warps list only the place you're in. Switching places goes through the map. *(My call.)*

### What goes away

The street, the U-turn, the old kickers, the old hill (Hill top and Hill climb), the bump section and bush walls, the
lollipop street trees, and the flat lawn slab. The Just Ride warps become each place's own spots (the trailhead, the
challenge starts, the summit, the shoulder).

### The look, made permanent

`src/look/foothills.ts` becomes a real module, **`src/look/scenery.ts`**, applied to every place (no `?look` flag).
It keeps what the look test proved:

- The baked backdrop on a far cylinder (`SPAN`, `SQUASH`, `R_BACK`).
- The rolling land past the playable area, with low far hills where the painting is.
- Instanced pines, swaying grass tufts, yucca, prickly pear and boulders, placed by a mask of what's clear.
- Prairie dog towns that duck when you ride close, and the hawk.
- The lower, warmer sun (`SUN_OFFSET`), the warm haze, and golden grass.

What changes from the spike:

- Scatter is clear of trails by distance from the trail paths, not by bounding boxes. Each place says where its
  prairie dog towns go and where trees cluster, so they sit beside trails and lines and are never in the way.
- Solid trees and boulders get real colliders (the spike used invisible cylinders).
- One place's scenery seed and densities are data, so later areas can reuse it with other settings.

The bake script and `public/backdrop/` stay as they are. Both places use the same baked painting.

### Trail edges

Rock lines everywhere go away. Instead, as the progression spec planned:

- **Tall grass** along most edges: a visible band of taller tufts that slows you hard. It's a stronger drag than
  today's `grass` surface, enough that no line beside the trail is faster than the trail.
- **Clumps** of yucca, prickly pear and boulders where an edge needs to be firm (beside obstacles riders would skip,
  the outside of switchbacks). Yucca and prickly pear bump you like the bushes do (a burst, a slowdown). Boulders are
  solid.
- **The hillside itself** is steep and grassy between trails.
- Rock lines stay only where they are part of the trail's character (the rock garden, the chute).

**The requirement:** an "edge rider" robot that rides beside the trail to skip obstacles must never beat the 2★ time
on any trail challenge. Add it to `checks/ladder-robots.ts` with the other styles.

### Places, the map and progress

- `AREAS` gets a second entry: **the jump park, with a placeholder name ("Mesa Jump Park") the boys can rename**.
  Its pin sits near Shredder Hills on the map, on open ground. Challenges move to the place they're built in: the
  hill has the six trail and downhill ones plus Boulder Dash; the park has the eight park ones.
- **Each place is its own world, built by the place's own course builder.** `buildCourse` splits into one builder
  per place. Each returns the same `Course` shape (world, stations, runs, lines, gates and zones), so the ride loop
  doesn't care which place it's in. `createRide` takes the place.
- **The URL contract stays.** `?go=<challengeId>` and `?at=<station>` find their place from the challenge or the
  station (station keys stay unique across places). The map's place sheet lists that place's challenges.
- **Locks count stars from both places**, as they do today (where one place held everything), so unlocking and pacing
  don't change. The lock text drops "in Shredder Hills": "Ride 2 ★". *(My call: it keeps the pacing tests as they
  are.)*
- Saved profiles keep working: challenge ids, station keys for challenge spots, stars and cogs are unchanged.

## Checking it

- **Robots:** rerun `checks/ladder-robots.ts`, with every style updated to follow trail paths, plus the new edge
  rider. The rule (1★ yes, 2★ no on the bare hardtail) must hold on at least the same 14 of 15. The edge rider must
  never beat 2★. Retune star times only where curves moved them, and say which.
- **The other robots** (`climb-robots`, `downhill-robots`, `showcase-robots`, `pump-laps`, `jump-lanes`, `slalom`,
  `trail-edges`) and the rock-pin tests (`tests/rockPin.test.ts`) move to the new trails.
- **Tests:** challenge and area guards (`tests/challenges.test.ts`, `tests/areas.test.ts`) cover two places. Every
  challenge is in exactly one place, and every spot station exists in its place's course.
- **Browser checks:** `checks/game.mjs` and `checks/hub.mjs` go through both places. Screenshots from the summit, the
  shoulder, the trailhead and the park's start hill.
- **The iPad:** fps, draw calls, triangles and resolution with `&debug`, in both places, inside the budget.

## Left to the builder

- The hill's exact shape, the trail routes on it, and the arc radii (keeping switchbacks as tight as today's pads).
- How trail coordinates are stored and queried (the path representation, nearest-point lookup).
- The park's exact arrangement and berm shapes.
- Scatter densities and the cluster and town placements, within the triangle budget.
- The tall-grass drag value (set by the edge-rider robot).
- The order of work. One sensible order: the trail tool with Goat Ladder on a test hill first (the riskiest part),
  then the rest of the hill, then the park, then the scenery module, then the map and places.

## Calls I made (for the user to check)

1. The summit is Boulder Dash's 20 m start; Goat Ladder and Hairpin top out on a shoulder, linked by a connector.
2. Locks count stars from both places, so pacing doesn't change.
3. The jump park's placeholder name is "Mesa Jump Park".
4. Both places share the one baked painting.
5. The street, old kickers, old hill, bump walls and lollipop trees go away.
6. The car at each trailhead is scenery. The Map button stays the way back to the map.
7. Sounds, grasshoppers and dust are the next small project, not this one.
