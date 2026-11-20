# Suspension and brakes that look and ride like the real thing

Design for #12, widened. Agreed with the user on 2026-11-19.

## Why

The bikes should look more like real bikes while keeping the toy look. The user's words: "if a bike has suspension,
it should look and behave like it", and "not all rear suspensions look the same". Today a landing squashes the whole
bike and rider together (`pose.squash` in `src/bike/rider.ts`, applied as `body.scale`). The bike's look comes from
its frame only, not from its parts. The Bolinas ships with an "Air fork · 130 mm" and the hardtail can buy an
"Air fork · 120 mm", but both draw a rigid fork. Only the Teal Enduro draws a travel fork and a shock, and nothing
on any bike moves except the wheels and cranks. There are no rotors or calipers at all.

This is a feel change as much as a look change. It's a playtest question too: do the kids notice the squish, and
does it make landings feel better?

## Goals

- **The fitted parts decide the look.** Fork, rear end, shock and brakes are drawn from the bike plus its fitted
  parts. Buying the hardtail's air fork visibly changes the bike, and so does swapping the Enduro's coil and air
  shocks.
- **The suspension moves with the ride**, on one spring per fork and per shock:

  | Moment | Fork | Rear |
  |---|---|---|
  | Landing | Compresses by hit size and travel | Same |
  | Rough ground and rock gardens | Small fast chatter | Small fast chatter |
  | Pumping | A compression on each press | A compression on each press |
  | Hard braking | Dives | Rises a little |
  | Manual | Stretches to full length | Squats a little |
  | Rigid fork, rim brakes | Doesn't move. Rim brake pads clamp the rim | — |

- **Travel and kind shape the motion.** Longer travel moves further and runs out later. Coil moves easily all the
  way. Air gets stiffer toward the end of its travel. The rider's whole-body squash shrinks by however much the
  suspension took, so a rigid dirt jumper's rider still squashes the most.
- **Bottoming out is a real ride rule** (approved ladder):

  | Landing | What happens |
  |---|---|
  | Within travel | Clean: the parts squish, nothing else changes |
  | Uses all the travel | Clunk sound, hard squash, a small speed loss (like today's heavy landing) |
  | Well past the travel | A bobble: the existing wobbly landing, with the bike visibly slammed |
  | The existing crash limits | Unchanged |

  A short fork reaches each step sooner, so a rigid bike bobbles on a drop the Enduro soaks up.
- **An O-ring** on each travel fork's stanchion shows the deepest hit of the run.
- **Brakes are drawn from the part and clamp when braking** (throttle below 0, which includes the Brake button).
- **Different rear designs exist and can be seen and ridden in the feel lab**, even though only the Enduro has rear
  suspension in the game.

## Non-goals

- **No new bike in the game.** A second full-suspension bike is #23, blocked by the playtest (#4).
- **No full suspension physics** (real ride height, rebound kicking you off a lip, pump and pop changing with travel).
  That was approach 3 below, deferred until this proves the squish is worth it.
- **No Blender models.** #14 comes after this, and only if this proves the bike is worth more detail.
- **No new part sounds beyond the bottoming clunk.** Freehub ticking, suspension thunk and brake squeal stay in #13.
- **No price, part or star target changes**, other than retuning if the ladder rerun demands it.
- **No real linkage geometry.** Each rear design swings round fake pivots that read right at this size.

## Anti-goals

- Bottoming out must never feel like a new penalty to learn. It's how the bike shows a landing that was too big for
  it, through the outcomes kids already know (heavy landing, bobble).
- Don't let a slow iPad frame change a ride outcome. The ride decides, the drawing only shows.
- Don't blow the iPad draw-call budget (see Constraints).

## Approaches

1. **The visual spring decides bottoming.** The animated fork reaching its end triggers the clunk and the bobble.
   Simplest, but the rule would live in drawing code the robots never run, and frame rate would change outcomes.
   Dropped.
2. **The ride decides, the bike shows it.** Picked by the user. On touchdown, the ride code compares the hit against
   the bike's travel and picks clean, clunk or bobble through the existing landing code, so robots and every device
   agree. A separate animation-only spring per fork and shock shows the result and all the in-between motion.
3. **Full suspension in the ride.** The most real, but it changes how every bike rides everywhere and the whole
   ladder would need retuning before the playtest. Deferred.

## The design

### One description of the bike's suspension and brakes

Replace `FrameShape.fork: 'plain' | 'travel'` and `FrameShape.shock: boolean` with a description that both the look
and the ride read. It lives on the `BikeSpec`, so the sim reaches it through `s.bike` and the rig through the spec it
is built from:

- **fork:** `rigid`, or `air` / `coil` with a travel in mm.
- **rear:** `hardtail`, or a design (`singlePivot`, `linkage`, `shortLink`) with a shock kind (`air` / `coil`) and a
  travel in mm.
- **brakes, front and rear:** `none`, `rim`, or a disc with its rotor size in mm.

Each bike in `src/lab/bikes.ts` carries its stock description. Each `PartDef` in `src/game/catalog.ts` can carry the
piece of it that part changes, applied in `loadout()` the same way `spin` and `headAngle` are. Stock parts set what
their spec text says:

| Bike | Fork | Rear | Brakes |
|---|---|---|---|
| Hardtail | rigid; Air fork upgrade: air 120 | hardtail | rim front and rear; Hydraulic upgrade: disc 160 both |
| Dirt Jumper | rigid | hardtail | rear disc only (160, my call) |
| Bolinas | air 130; Long fork 140; Short fork 120 | hardtail | disc 180 both |
| Enduro | air 170 (not a part; part of the bike) | a design (builder picks; `linkage` suggested), air 170; Coil shock: coil 170; Tuned air: air 170 | disc 180; 4-piston upgrade: disc 203 |

Parts carry the description as structured data: a partial `suspension` or `brakes` patch, merged in `loadout()`. On
the Enduro the shock parts patch only `rear.shock` and its travel, while its fork and rear design come from the bike.
The Bolinas fork parts patch only the fork. The shown spec strings stay hand-written. A catalog test checks that every
mm in a spec string matches its part's data, so they can't drift apart.

No save data changes: the look comes from part ids that saves already hold. The old phase-0 bikes in
`src/rules/bikes.ts` (`BIKES`, used by `src/game.ts`) default to rigid fork, hardtail, no brakes. They look as they
do today, and `src/game.ts` only has to keep working, not show braking.

### The look

Each moving piece gets its own mesh and pivot, built by the description:

- **Fork.** Rigid: thin straight legs, as today. Travel fork: fat stanchions sliding into lowers with an arch. Longer
  travel draws a longer fork (exaggerate a little so 120 and 170 read differently). The lowers slide up the
  stanchions as it compresses.
- **O-ring:** a bright ring on one stanchion, pushed down to the deepest compression since the run started.
- **Rear designs**, each a cartoon a kid could tell apart:
  - `singlePivot`: one swingarm, one pivot above the bottom bracket, shock from the front triangle to the swingarm.
  - `linkage`: chainstays pivot near the bottom bracket, seatstays drive a small rocker plate on the seat tube, and
    the rocker drives the shock.
  - `shortLink`: the rear triangle hangs on two short links near the bottom bracket, the shock tucked low.
- **Shock.** Air: a smooth can. Coil: a visible spring in a bright color. The shock shortens as the rear compresses.
- **Brakes.** Disc: a rotor on the hub that spins with the wheel, sized by its mm, and a caliper on the fork leg or
  rear stay. Rim: brake arms on the fork and seatstays at the rim. Braking visibly clamps: pads or arms close in.
  Exaggerate enough to see from the chase camera.

The garage stand (`src/game/hub/stand.ts`) uses the same rig through `standPose()`, so every piece must sit right at
rest there.

### The ride rule: bottoming out

In the touchdown code in `src/lab/bike.ts` (the block after `classifyLanding`), compare the landing's `impact` (the
speed into the slope it already computes) against what the bike can take:

```
capacity = base + perMm · (forkMm + rearMm) / 2 · kind
used     = impact / capacity
```

- `base` is the rider's legs: 6 m/s, today's heavy-landing number, so the rigid hardtail's capacity is exactly 6.
- Fork and rear travel are averaged, so a 130 mm hardtail gets half the benefit of a 130/130 full-suspension bike.
  A hardtail's rear counts as 0.
- `kind` is a small factor per spring kind: air is progressive and resists bottoming a little more than coil. So on
  the Enduro, the coil and air shock parts change landings slightly, even though both are 170 mm.
- `base`, `perMm`, the kind factors and the bobble margin are Tune rows.

The result is the approved ladder:

- **`used` ≤ 1:** nothing changes.
- **`used` > 1 (bottomed):** a small speed loss and the clunk. This replaces today's heavy-landing rule
  (`if (impact > 6 && Math.abs(gp) < 0.1) after *= T.flatKeep`). `flatKeep` stays the per-bike and per-part "speed
  kept" value. The rule ignores slope, as real suspension does (my call). `impact` is already small on a landing that
  matches its slope, so "land on the slope" still holds. If dropping the flat-only gate breaks the ladder, keep the
  gate for the speed loss only, and keep the clunk and the motion slope-free.
- **`used` > 1 + margin:** the outcome becomes a bobble, if it would otherwise have been clean. Wipeout and big crash
  limits are unchanged.

The touchdown event reports `used`, so the rig and HUD can show it. The existing "Heavy landing" callout in
`src/lab/ride.ts` becomes the bottomed-out callout.

The bobble tier is new for every bike, including the hardtail. Measure first: log the `impact` values the ladder
robots produce on the hardtail on every challenge. Then set the margin so the bobble starts just above the largest
one on a challenge line. It should only bite on landings bigger than a line asks for, like a flat drop or a casing.
Then rerun `checks/ladder-robots.ts`. The ladder rule must still hold: on the bare hardtail, 1★ possible and 2★ not,
on at least 14 of 15. The rerun must also show that the Bolinas's and Enduro's bigger capacity doesn't open a 2★
early.

### The motion

An animation-only spring per fork and per shock, stepped in the rig's `update()` in small slices like today's squash
spring. It never feeds back into the ride. Inputs:

- **landing:** a kick sized by the travel used from the ride event, reaching the end of travel when the ride says it
  bottomed, with the clunk sound;
- **rough ground and bumps:** small fast chatter (the ride already flags `rough` zones and `ev.bump`);
- **pumping:** a compression per stroke (`ev.pumping`);
- **braking:** fork dive and a little rear rise;
- **manual:** fork stretched to full length, rear squats a little.

The rig needs to know about braking, rough ground and pumping, which it doesn't today (`update` only gets
`BikeState`). Pass what it needs from `src/lab/ride.ts` and keep `src/game.ts` working. The interface is the
builder's call. Braking means the ride intent's throttle below 0 (the Brake button sets it to -1). Where no intent
is passed (`src/game.ts`, the stand), the brakes stay open.

A hardtail rear has no motion at all. On a rigid fork, the only motion is the brakes clamping (rim pads or a
caliper), plus the whole-body squash.

The whole-body squash keeps whatever the suspension didn't take: a rigid bike squashes as today, a plush one much
less.

### Tune panel

Add a Suspension group to `src/lab/tune.ts` so it can be tuned by feel: the bottoming base and per-mm amounts, the
bobble margin, spring stiffness and damping for the look, how far each source moves it (landing, chatter, pump, brake
dive, manual), the visual travel scale and the rider's squash share. In the feel lab only, a row that switches the
Enduro's rear design, so all three designs can be seen and ridden without a new bike (my call, instead of a lab-only
test bike, which would need catalog entries). Tune rows are numeric, so this is a 0 to 2 row with step 1, like the
existing on/off rows (`stickFollow`). Changing it rebuilds the rig the way a bike swap already does (`setBike` in
`src/lab/ride.ts`). It doesn't have to swap meshes live.

## Constraints

- **iPad draw calls.** About 10 to 15 more per bike is fine. Merge every non-moving piece by color, as `piece()` does
  today.
- **Robots decide.** The ride rule runs in `stepLab`, which robots and both pages share. Rerun
  `checks/ladder-robots.ts` and keep `tests/pacing.test.ts` passing.
- **Determinism.** The ride rule may only use the ride's own state, never the animation spring or frame time.
- **Existing tests** in `tests/rider.test.ts` pin the Bolinas frame to `DEFAULT_FRAME`. That changes on purpose now
  (it gets a travel fork). Update the test, don't work around it.
- **Public repo:** issue and doc text stays free of family and personal details.

## Checks

- Unit tests for the bottoming rule (thresholds by travel, the three tiers, rigid hardtail matches today's
  heavy-landing numbers).
- Rig tests: each description builds, each moving piece exists and moves the right way, the stand pose sits right.
- A browser check in `checks/` with screenshots of each bike and parts combination and each rear design, at rest and
  compressed.
- The ladder rerun and pacing test, with results noted in the PR.
- Add the questions to the playtest issue (#2): do they notice the squish, does bottoming out read, does it make
  landings feel better.

## Left to the builder

- Exact thresholds, spring constants and visual scales (start them in the Tune panel).
- Which rear design the Enduro gets by default (`linkage` suggested).
- The rig's new interface for braking, rough, pumping and travel used.
- Where the O-ring resets during riding (run start, respawn, station warp). On the garage stand it sits at the top
  (no hits yet).
- Whether the bike shows sag at rest when ridden.
- Mesh details, within the toy look in `src/look/toyLook.ts`.
