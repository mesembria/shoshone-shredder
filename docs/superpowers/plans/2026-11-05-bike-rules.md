# Bike Rules, Energy and Showcase Terrain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each of the three bikes rules of its own (one gear, speed wobble, pop soak, rock plow, cheap climbing),
add energy, let every bike try every air trick on physics alone, and add four park places where each bike shines.

**Architecture:** Approach A from the spec: every rule is a ride setting in `DEFAULTS` (`src/lab/tune.ts`), off at
its default, switched on per bike in `BIKE_RIDE` (`src/lab/bikes.ts`). The math lives in two small pure modules
(`src/lab/energy.ts`, `src/lab/wobble.ts`) that `stepLab` (`src/lab/bike.ts`) calls; the view reads new fields on
`LabState`. The four places are built in a new `src/lab/showcase.ts` that `buildCourse` calls.

**Tech Stack:** TypeScript 5.6, three.js 0.170, Rapier 0.14 (works inside Vitest; see `tests/physics.test.ts`),
Vite 5.4, Vitest 2.1. Robots: `npx vite-node checks/<file>.ts`. Browser checks: `node checks/<file>.mjs` (Playwright's
cached Chromium over CDP, pattern in `checks/bike-swap.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-05-bike-rules-design.md` (read it first; every "my call" number there is a
starting point to tune). Also read `docs/handoff-2026-11-01.md` for how to run things.

## Global Constraints

- Dev server at `http://127.0.0.1:5173` (not `localhost`); `npm run dev` if it isn't running.
- Not a git repo: no commit steps. Before Task 1, snapshot `src tests checks docs play.html lab.html` into the session
  scratchpad, for the final review's diff.
- `npm run check` and `npm test` pass at the end of every task.
- Every new rule is a plain number in `DEFAULTS`; a value of 0 turns it off. No logic may branch on a bike id (parts
  will override these numbers later).
- Bike-owned settings go in `BIKE_RIDE` so they join `RIDE_KEYS`; energy settings shared by all bikes stay out of it.
- Kid-facing copy, exactly: "Burnt! Catch your breath" (foot down on an incline), "Burnt! Ease off" (on the flat),
  "Pushing hard uses energy" (once, first time below half), "Not enough air for a <trick>!" with sub
  "Try a bigger jump" (or "pop it" when the jump wasn't popped).
- Never drop fields from the save (`shredder-save`).
- No changes to the old `/` prototype (`index.html`, `src/game.ts`, `src/main.ts`, `src/bike/controller.ts`).
- Robots must stay deterministic: no `Math.random` in the ride step (use the clock and position for any noise).

## Review Focus

1. **Burnt mid-air or mid-trick:** energy hits empty while airborne. Expected: nothing until you land; no foot down in
   the air. (Task 2 test: "burnt in the air waits for the ground".)
2. **Burnt on the pump track:** `input.coast` never drains, so it can't happen there. (Task 2 test: "coasting never
   drains".)
3. **Swap bikes while wobbling or burnt:** the wobble level resets on swap (new bike, new feel); energy carries over.
   (Task 3 test: "setBike clears the wobble, keeps energy" against `resetRide`.)
4. **Braking to a stop on a hill then pushing up:** the restart must not foot-down straight away. (Task 2 test:
   "restart after a rest gets the stall grace".)
5. **A crash or warp while burnt:** getting up after a crash keeps energy; a warp (`placeBike`) fills it and clears
   burnt. (Task 2 test: "placeBike fills the tank".)

---

### Task 1: The new settings and each bike's numbers

**Files:**
- Modify: `src/lab/tune.ts` (`DEFAULTS` and two new Tune groups)
- Modify: `src/lab/bikes.ts` (`BIKE_RIDE`)
- Test: `tests/labBikes.test.ts`

**Interfaces:**
- Produces, in `DEFAULTS` (0 = off unless noted):
  - Energy (shared, not in `BIKE_RIDE`): `energyTank: 8` (s of full sprint on the flat; 0 = energy off),
    `energyRefill: 0.12` (share of tank per s while coasting), `energyRest: 1.5` (refill multiplier when stopped),
    `energyClimb: 6` (extra load per unit of sin(slope)), `energySteady: 0.75` (load that breaks even),
    `burntUntil: 0.33`, `burntSlope: 0.05` (rad; incline that turns burnt into a foot down), `burntRest: 2` (s, the
    longest a burnt foot-down lasts).
  - Bike rules (bike-owned): `energyCost: 1`, `gearTop: 0` (m/s; 0 = no gear limit), `gearBog: 0`,
    `wobbleSpeed: 0`, `wobbleKick: 0`, `wobbleGain: 1.5`, `wobbleLimit: 1`, `popSoak: 0`, `plowSize: 0` (m).
- Tune groups: "Bike rules" (`energyCost`, `gearTop`, `gearBog`, `wobbleSpeed`, `wobbleKick`, `wobbleGain`,
  `wobbleLimit`, `popSoak`, `plowSize`) and "Energy" (the rest), with kid-plain labels like the existing rows.
- `BIKE_RIDE` additions and changes (starting points):

| key | dirtjumper | enduro | bolinas |
|---|---|---|---|
| `legs` | 3.8 | 4.0 (was 4.6) | 4.4 |
| `energyCost` | 1 | 1.25 | 0.8 |
| `gearTop` | 8.5 | – | – |
| `gearBog` | 1 | – | – |
| `wobbleSpeed` | 10 | 18 | 14 |
| `wobbleKick` | 1 | 0.3 | 0.6 |
| `popSoak` | – | 0.4 | – |
| `plowSize` | – | 0.35 | – |
| `pedalAccel` | – | 3.5 | – |
| `minRadius` | 1.1 | 2.1 | 1.1 |
| `looseLimit` | – | – | 0.75 |

The Bolinas gets its own `BIKE_RIDE` entries for the first time.

- [ ] **Step 1: Write the failing tests** in `tests/labBikes.test.ts`:
  - `'makes the Bolinas the climber'`: `BIKE_RIDE.bolinas.legs` > both others' `legs`; `energyCost` lowest;
    `looseLimit` > `DEFAULTS.looseLimit`; `minRadius` ≤ the dirt jumper's.
  - `'every bike wobbles, the dirt jumper first and hardest'`: for each id, `0 < wobbleSpeed < maxSpeed ?? DEFAULTS.maxSpeed`;
    `dirtjumper.wobbleSpeed < bolinas.wobbleSpeed < enduro.wobbleSpeed`; `wobbleKick` in the reverse order.
  - `'only the dirt jumper has one gear, only the enduro soaks and plows'`: after `applyBike(id, x)`, `x.gearTop > 0`
    only for the dirt jumper; `x.popSoak > 0` and `x.plowSize > 0` only for the enduro.
  - `'energy settings belong to no bike'`: `RIDE_KEYS` contains none of `energyTank`, `energyRefill`,
    `energyRest`, `energyClimb`, `energySteady`, `burntUntil`, `burntSlope`, `burntRest`.
  - Update `'makes the dirt jumper the trick bike and the enduro the downhill bike'`: drop `'legs'` from the
    enduro-greater list (the Bolinas is the climber now).
- [ ] **Step 2:** `npx vitest run tests/labBikes.test.ts` → the new cases FAIL (missing keys).
- [ ] **Step 3:** Add the settings, Tune rows and `BIKE_RIDE` values above.
- [ ] **Step 4:** `npm run check && npm test` → PASS.

---

### Task 2: Energy, gears and resting

**Files:**
- Create: `src/lab/energy.ts`
- Modify: `src/lab/bike.ts` (`LabState`, `createLabState`, `placeBike`, `getUp`, `groundStep`, `climbStops`,
  `airStep`), `src/lab/ride.ts` (callouts)
- Test: `tests/energy.test.ts` (pure), `tests/labRide.test.ts` (new: `stepLab` on a small Rapier yard)

**Interfaces:**
- Produces in `src/lab/energy.ts`:
  - `interface Effort { push: number; pedaling: boolean; slope: number; speed: number; stopped: boolean }`
    (`push` 0..1 = stick up; `pedaling` false when coasting, braking, in the air or crashed; `slope` rad, uphill +).
  - `energyLoad(e: Effort, t = T): number`: what the legs are working, in units where `t.energySteady` breaks even.
    `t.energyCost × (push + steady share when pedaling + t.energyClimb × max(0, sin slope) + bog)`, where `bog` =
    `t.gearBog × max(0, sin(slope) − 0.08) × 10` and, when `t.gearTop > 0` and `speed ≥ t.gearTop`, `push` still
    counts (spinning out costs energy for nothing). "Steady share" is `t.steadyLegs × 0.5` while pedaling.
  - `stepEnergy(energy: number, e: Effort, dt: number, t = T): number` → new energy in 0..1. Load above
    `energySteady` drains at `(load − energySteady) / (flatExcess × t.energyTank)` per s, where `flatExcess` =
    `1 + 0.5 × t.steadyLegs − t.energySteady` (the load above break-even of `push` 1 on the flat at cost 1), so that
    sprint empties a full tank in `energyTank` s, ±10%; below it, refills at `t.energyRefill` per s scaled by how far
    below (full rate when not pedaling), ×`t.energyRest` when `stopped`. `t.energyTank === 0` → always 1.
  - `gearLimit(speed: number, t = T): number` → multiplier 0..1 on pedal acceleration: 1 below `t.gearTop − 1`,
    falling to 0 at `t.gearTop`; always 1 when `t.gearTop === 0`.
- Produces on `LabState`: `energy: number` (0..1, starts 1), `burnt: boolean`, `resting: boolean` (stopped by
  choice, foot down, no penalty), `told: { energy: boolean }` (the one-time callout).
- Produces on `LabEvents`: `dab` gains `'burnt'`; new `burnt?: 'climb' | 'flat'` (the moment you burn out),
  `energyHint?: true` (first drop below half).

Behavior in `groundStep` (my calls, from the spec):
- Each grounded step: build the `Effort` (`push` = max(0, throttle); `pedaling` = !coast && throttle > −0.05),
  `s.energy = stepEnergy(...)`. In the air: `stepEnergy` with `pedaling: false`. During a crash: no change.
- Burnt: when energy reaches 0, `s.burnt = true` until `energy ≥ T.burntUntil`. While burnt, pedal power is capped
  at `T.steadyLegs` (multiply into `pedal`). At the moment of burning out on the ground: if `s.slope > T.burntSlope`,
  `footDown(s, ev, 'burnt')` with `s.dab` held until `energy ≥ burntUntil` or `T.burntRest` s, whichever is first,
  and `ev.burnt = 'climb'`; else `ev.burnt = 'flat'`. A burnt foot-down counts in `s.dabs` (it's a foot down on the
  climb). This works outside the climb areas too: the incline test is the slope, not `input.climb`.
- Gear: multiply `accel` by `gearLimit(v)`.
- Resting: grounded, `speed === 0`, throttle < −0.05 → `s.resting = true` (refill uses `stopped`), no `dabs` count.
  Leaving rest (throttle ≥ 0) sets `s.dabGrace = 1.2` so the restart doesn't stall straight away.
- `placeBike` (a warp) fills energy and clears `burnt`; `getUp` after a crash leaves energy alone. A challenge
  start must fill it too: check that `src/game/main.ts`'s challenge start goes through `ride.teleport` (→
  `placeBike`); if it doesn't, set `s.energy = 1; s.burnt = false` there.
- `ride.ts` callouts: `dab: 'burnt'` → `{ text: 'Burnt! Catch your breath', tone: 'meh' }`; `burnt: 'flat'` →
  `{ text: 'Burnt! Ease off', tone: 'meh' }`; `energyHint` → `{ text: 'Pushing hard uses energy', tone: 'meh' }`.

- [ ] **Step 1: Write the failing pure tests** in `tests/energy.test.ts` (use `{ ...DEFAULTS }` as `t`):
  - `'a full sprint on the flat empties the tank in about energyTank seconds'`: step `push 1, slope 0, speed 8` at
    1/60 s from 1 until ≤ 0; elapsed within ±10% of 8 s.
  - `'a steady push on a 10% climb roughly breaks even on the Bolinas'`: `t` with Bolinas `energyCost` 0.8,
    `push 0, pedaling true, slope atan(0.1)`; energy after 30 s ≥ 0.85 from 1, and after 30 s from 0.5 it's within
    0.5 ± 0.15.
  - `'sprinting up a climb drains faster than on the flat'`.
  - `'the dirt jumper bogs on steep pitches'`: same 15% pitch, push 0.5, DJ settings drain > 1.3 × Bolinas.
  - `'spinning out above gearTop still costs energy'`: DJ settings, `speed 9, push 1` drains; `gearLimit(9)` is 0,
    `gearLimit(5)` is 1, and `gearLimit(anything)` is 1 when `gearTop` is 0.
  - `'coasting refills most of the tank in a few seconds'`: `pedaling false` from 0 for 4 s → ≥ 0.45.
  - `'stopped refills fastest'`: from 0, 1 s stopped > 1 s coasting; 0 → 0.33 stopped takes 1.5–2.5 s.
  - `'coasting never drains'` (Review Focus 2): `pedaling false, push 1` never lowers energy.
  - `'energyTank 0 turns energy off'`: always returns 1.
- [ ] **Step 2:** `npx vitest run tests/energy.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `src/lab/energy.ts` as specified.
- [ ] **Step 4:** `npx vitest run tests/energy.test.ts` → PASS.
- [ ] **Step 5: Write the failing ride tests** in `tests/labRide.test.ts`. Build a yard like `tests/physics.test.ts`:
  a 200 m flat `'dirt'` slab plus a 60 m 12% ramp (`'dirt'`) beside it; `T` reset to `DEFAULTS` in `beforeEach`;
  `createLabState(LAB_BIKES.bolinas, …)`, `applyBike`, step with `stepLab(s, intent, 1/60, phys, [])`.
  - `'burning out on the flat never stops you'`: set `s.energy = 0.02`, ride flat with throttle 1 → `ev.burnt ===
    'flat'` once, `s.dab` stays 0, speed > 4 throughout, `s.burnt` true.
  - `'burning out on a climb puts a foot down and rests to a third'`: on the ramp at 3 m/s, `s.energy = 0.02`,
    throttle 1 → an event with `dab === 'burnt'`; speed 0 while `s.dab > 0`; when the dab ends, `s.energy` ≥ 0.3 or
    `burntRest` s have passed.
  - `'burnt in the air waits for the ground'` (Review Focus 1): airborne (hop on the flat), energy 0 → no `dab`
    until grounded.
  - `'braking to a stop on a hill holds still and refills fastest'`: on the ramp, throttle −1 to a stop; 1 s later
    `s.pos` unchanged (±1 cm), `s.resting` true, energy rose more than 1 s of coasting would.
  - `'restart after a rest gets the stall grace'` (Review Focus 4): after the rest, throttle 1 for 0.5 s → no `dab`.
  - `'placeBike fills the tank'` (Review Focus 5): energy 0.1 and burnt → `placeBike` → 1 and not burnt; a crash
    and `getUp` leave energy as it was.
  - `'the dirt jumper tops out at its gear on the flat'`: DJ, throttle 1 for 15 s on the flat → speed ≤ `gearTop`
    + 0.3.
- [ ] **Step 6:** `npx vitest run tests/labRide.test.ts` → FAIL.
- [ ] **Step 7:** Wire energy, burnt, gear and resting into `src/lab/bike.ts` and the callouts into `src/lab/ride.ts`
  as described above.
- [ ] **Step 8:** `npm run check && npm test` → PASS. Then `npx vite-node checks/climb-robots.ts` for each `BIKE`;
  note the times and feet down in the task report (tuning comes in Task 7).

---

### Task 3: Speed wobble

**Files:**
- Create: `src/lab/wobble.ts`
- Modify: `src/lab/bike.ts` (`LabState`, `LabIntent`, `groundStep`, `airStep` touchdown, `moveBody` bonks),
  `src/lab/ride.ts` (`setBike`, `intent.rough`, callouts)
- Test: `tests/wobble.test.ts` (pure), `tests/labRide.test.ts` (add cases)

**Interfaces:**
- Produces in `src/lab/wobble.ts`:
  - `wobbleOver(speed: number, t = T): number` → 0 at or below `t.wobbleSpeed` (and always 0 when it's 0), rising to
    1 at `t.maxSpeed`.
  - `steerGain(over: number, t = T): number` → `1 + t.wobbleGain × over`: multiplies the turn curvature.
  - `bumpKick(over: number, size: number, phase: number, t = T): number` → a yaw kick in rad:
    `t.wobbleKick × over × size × sin(phase)`-shaped, signed. `size`: 1 for a landing or a rock/log bonk, 0.3 per
    step on rough ground. `phase` comes from `s.clock` and position (deterministic).
  - `stepWobble(level: number, i: { over: number; yawJerk: number; braking: boolean; steady: boolean }, dt: number,
    t = T): number`: rises with `|yawJerk| × over` (yawJerk = change of yaw rate per s); drains fast (×4) when
    `braking` or `over === 0`, slowly when `steady` (|steer| < 0.1), not at all otherwise. Calibrate so a full
    left-right swing at `over` 0.5 for ~1 s reaches `wobbleLimit`.
- Produces on `LabState`: `wobble: number` (0..`wobbleLimit`), `yawRate: number` (last step's, for `yawJerk`).
- Produces on `LabIntent`: `rough?: boolean` (set by `ride.ts` from `course.rough`, Task 6; until then always false).
- Produces on `LabEvents`: `wobbleOut?: true` (the tank-slapper wipeout).
- Behavior: in `groundStep`, `k *= steerGain(over)`; add `bumpKick` on rough ground each step, on a non-crash rock or
  log bonk, and at touchdown in `airStep` (size 1, scaled by impact/6); update `s.wobble`; at `≥ T.wobbleLimit` →
  `startCrash(s, 'wipeout')`, `ev.landed = 'wipeout'`, `ev.wobbleOut = true`. `getUp` and `placeBike` zero the wobble.
- `ride.ts`: `setBike` zeroes `s.wobble` and keeps `s.energy`. Wipeout callout when `ev.wobbleOut`:
  `{ text: 'Speed wobble!', sub: 'brake before it gets scary', tone: 'bad' }` (use the existing wipeout tone).

- [ ] **Step 1: Write the failing pure tests** in `tests/wobble.test.ts`:
  - `'no wobble below the bike's wobble speed, or when it is off'`.
  - `'steering gets touchier, not calmer, above it'`: `steerGain(0.5) > 1`.
  - `'bumps kick harder the faster you go and the bigger the kick setting'`.
  - `'swinging hard above the line builds to the limit in about a second'`: alternate `yawJerk` ±6 at `over` 0.5;
    reaches `wobbleLimit` between 0.6 and 1.6 s.
  - `'braking drains it fast; a still thumb drains it slowly'`.
- [ ] **Step 2:** `npx vitest run tests/wobble.test.ts` → FAIL.
- [ ] **Step 3:** Implement `src/lab/wobble.ts`.
- [ ] **Step 4:** `npx vitest run tests/wobble.test.ts` → PASS.
- [ ] **Step 5: Add failing ride tests** to `tests/labRide.test.ts` (flat yard, a rough area flag via `intent.rough`):
  - `'the dirt jumper weaving fast on rough ground wobbles out'`: DJ at 12 m/s, steer alternating ±1 every 0.3 s,
    `rough: true`, `T.maxSpeed` raised so speed holds → `ev.wobbleOut` within 3 s.
  - `'braking below the wobble speed saves it'`: same, but throttle −1 from the start → no `wobbleOut`.
  - `'the enduro shrugs off the same ride'`: enduro at 12 m/s, same input → no `wobbleOut`.
  - `'setBike clears the wobble, keeps energy'` (Review Focus 3): test the pure part: export
    `resetRide(s: LabState): void` from `bike.ts` (zeroes `wobble`, keeps `energy`) and call it from `setBike`.
- [ ] **Step 6:** run → FAIL. **Step 7:** wire it in. **Step 8:** `npm run check && npm test` → PASS; run
  `BIKE=… npx vite-node checks/downhill-robots.ts` for all three bikes and note the results.

---

### Task 4: The enduro's pop soak and rock plow

**Files:**
- Modify: `src/lab/bike.ts` (`takeOff`, `pop`, `moveBody`), `src/lab/ride.ts` (plow shake)
- Test: `tests/labRide.test.ts` (add cases)

**Interfaces:**
- Pop soak: off a lip, a rolled launch's `vy` and a non-perfect lip pop's added speed are multiplied by
  `1 − T.popSoak`; a perfect pop (`perfect` true) gets `1 − T.popSoak × 0.15`. Hops on the flat are unchanged.
- Plow: in `moveBody`, a `'rock'` hit whose top is under `T.plowSize` above the ground at the front wheel (use
  `castDown` there) is ridden over: no crash, no bonk, no stop; lift the bike onto it like `rollUp` does, set
  `ev.plow = true` (new `LabEvents` field) for a small shake and sound in `ride.ts`. `plowSize` 0 = off.

- [ ] **Step 1: Failing tests** (yard with a 1.8 m tabletop lip built with the same `Line` shape `tabletop` uses, and
  a 0.3 m rock):
  - `'the enduro rolled off a lip gets less air than the Bolinas'`: same speed, no pop → enduro `vy` at takeoff ≤
    0.65 × Bolinas.
  - `'a perfect pop gets the enduro most of its air back'`: perfect-timed pop → ≥ 0.9 × the same pop with
    `popSoak` 0.
  - `'the enduro rides through a small rock the dirt jumper crashes on'`: 7 m/s into the 0.3 m rock → enduro no
    crash, `ev.plow`; dirt jumper `wipeout`.
  - `'a rock bigger than plowSize still bonks the enduro'`.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** `npm run check && npm test` → PASS.

---

### Task 5: Tricks on physics, and the energy and wobble you can see

**Files:**
- Modify: `src/game/main.ts` (drop the swipe gate), `src/game/unlocks.ts` (hints for all tricks; `allowSwipe`
  goes), `src/game/bikeTricks.ts` (keep `AirTrick`, `TRICK_NAMES`, `airTrickFor`; drop `BIKE_TRICKS`, `whoCan`)
- Modify: `src/lab/ride.ts` (unfinished-trick callout, plow/wobble effects), `src/lab/touch.ts` + `src/lab/lab.css`
  (energy ring), `src/bike/rider.ts` (foot-down pose when `resting` or `dab`, pant when low), `src/lab/camera.ts`
  (wobble shake), `src/view/sound.ts` (rattle), `src/game/game.css` or `lab.css` (red edge pulse)
- Test: `tests/unlocks.test.ts`, `tests/bikeTricks.test.ts` (rewrite), `checks/game.mjs`, `checks/lab-tricks.mjs`,
  new `checks/energy.mjs`

**Interfaces:**
- `airHints(): { above: string; below: string }` → always `{ above: 'swipe ↑ No-hander', below: '↓ Backflip · ←→ 360\nhold: Tabletop' }`.
- Unfinished-trick callout: when a landing ends with a 360 or backflip not all the way round (the touchdown branch in
  `airStep` with `moveLeft > 0`), set `ev.short = 'spin' | 'flip'` (new `LabEvents` field) and `ev.shortPopped` (was
  this air popped). `ride.ts` → `{ text: \`Not enough air for a ${MOVE_INFO[m].name}!\`, sub: popped ? 'Try a bigger jump' : 'pop it', tone: 'meh' }`.
- Energy ring: a ring round `.knob` drawn with a `conic-gradient` whose share is `s.energy`; yellow above 0.35, red
  below, flashing (CSS class `burnt`) while `s.burnt`. Passed in through the existing `controls.update(...)` state
  object as `energy` and `burnt`.
- Wobble you can see: rider bars swing ∝ `s.wobble`, camera shake adds `s.wobble × 0.08`, a rattle sound whose
  volume follows `s.wobble`, and a red edge vignette (`.wobble-edge`, opacity = `max(0, (s.wobble/T.wobbleLimit − 0.5) × 2)`).
- Rider: foot-down pose (reuse the stall dab pose if there is one, else a leg out to the side) while `s.dab > 0` or
  `s.resting`; the Winded bob also plays while `s.energy < 0.2`.

- [ ] **Step 1: Failing tests:** `tests/unlocks.test.ts` asserts `airHints()` as above; `tests/bikeTricks.test.ts`
  keeps `airTrickFor` cases only. `checks/game.mjs`: replace "blocked backflip on the enduro" with "a backflip
  swiped on the enduro starts a flip (`s.move.id === 'flip'`)". New `checks/energy.mjs` (`?bike=bolinas&at=Street&debug`):
  hold the stick up 9 s → the ring's share ≤ 0.1 and a "Burnt! Ease off" callout; let go 5 s → share ≥ 0.5.
- [ ] **Step 2:** `npm test` and `node checks/game.mjs` → FAIL.
- [ ] **Step 3:** implement. **Step 4:** `npm run check && npm test`, `node checks/game.mjs`,
  `node checks/lab-tricks.mjs`, `node checks/energy.mjs`, `node checks/bike-swap.mjs` → PASS. Screenshot the
  ring full, low and burnt into the scratchpad for the user.

---

### Task 6: Four showcase places

**Files:**
- Create: `src/lab/showcase.ts`
- Modify: `src/lab/course.ts` (`Course` gains `rough: Area[]` and `runs: Record<string, { start: Gate; finish: Gate }>`;
  `buildCourse` calls `buildShowcase`), `src/lab/ride.ts` (`intent.rough`), `src/lab/tune.ts` (station warps list
  if it's hard-coded), `src/game/spots.ts` (`ZONES`, `RINGS`, `runEvent`), `src/game/challenges.ts` (goal kind
  `'run'`, four defs), `src/game/main.ts` (tick `run` events)
- Test: `tests/spots.test.ts`, `tests/challenges.test.ts`, `tests/world.test.ts` if it counts stations

**Interfaces:**
- `buildShowcase(w: THREE.Group, lines: Line[], climbTop: { x: number; y: number; z: number }): { stations: Record<string, Station>; coast: Area[]; rough: Area[]; runs: Course['runs'] }`
  in `src/lab/showcase.ts`, using `course.ts`'s helpers (export `Profile`, `extrude`, `tabletop`, `lipBar`, `rock`,
  `slab`, `berm` from `course.ts` as needed).
- The places (layout is the builder's, in free park space; keep clear of existing zones):

| Station / spot | What | Challenge def |
|---|---|---|
| `Rhythm` | 5–6 doubles (gap jumps, 2.5–4 m apart, 0.6–0.9 m tall), coast-only (add its pad to `coast`) | `{ id: 'rhythm', name: 'Rhythm line', goal: { kind: 'jumps', count: 5, limit: 30, points: [600, 1000] } }` |
| `Rock chute` | From the Summit, a second steeper way down: rough ground (`rough` areas), root and rock gardens with rocks 0.2–0.4 m (under and over the enduro's `plowSize`), then a 40 m+ fast open straight steep enough that the Bolinas passes 14 m/s and the enduro nears 18 | `{ id: 'chute', name: 'Rock chute', goal: { kind: 'run', times: [60, 30, 22] } }` |
| `Switchbacks` | Twisty rolling singletrack: 4+ tight switchbacks (radius ~2 m, so the enduro's 2.1 m turn is tight) up and down, two punchy 15% climbs, one gravel patch (add to `climb.loose` and `climb.area`) | `{ id: 'switchbacks', name: 'Switchback trail', goal: { kind: 'run', times: [90, 45, 35] } }` |
| `Jumps XL` | One table bigger than `JUMPS.L` (add `JUMPS.XL`, ~2.4 m tall, sized in Task 7 so only a perfect-popped enduro fits a backflip) | `{ id: 'xlTable', name: 'Big table XL', goal: { kind: 'jumps', count: 1, limit: 30, points: [400, 800] } }` |

  Star numbers are placeholders (stars are hidden for now); tell lines follow the existing ones' style.
- `Goal` gains `{ kind: 'run'; times: [number, number, number] }`; `Tick` gains `run?: 'start' | 'finish'`; `tick`
  returns done on `finish` after `start`, failed past `times[0]`, progress "Go!" / "To the bottom!".
- `runEvent(name: string, prev: Where, cur: Where, runs: Course['runs']): 'start' | 'finish' | null` in `spots.ts`,
  using `segmentsCross` logic (move `segmentsCross` from `ride.ts` to `spots.ts` and import it back).

- [ ] **Step 1: Failing tests:**
  - `tests/spots.test.ts`: every new spot has a `ZONES` area, a `RINGS` entry and a course station; `runEvent`
    fires `'start'` crossing the chute's start gate downhill, `null` the wrong way, `'finish'` at its finish gate.
  - `tests/challenges.test.ts`: `'run'` goal: done after start then finish, failed past `times[0]`, a crash fails it.
  - A course test: `buildCourse().rough.length > 0`; every new station's `castDown` hits ground (not a wall) within
    0.3 m of its `pos.y`.
- [ ] **Step 2:** run → FAIL. **Step 3:** build the places and wiring. **Step 4:** `npm run check && npm test` →
  PASS; `node checks/game.mjs` still passes; screenshot each new place from its station into the scratchpad.

---

### Task 7: Robots and tuning

**Files:**
- Create: `checks/showcase-robots.ts` (all three bikes on each new place: a careful style and a reckless style)
- Modify: `checks/climb-robots.ts` (report energy: burnouts and min energy), `checks/downhill-robots.ts`,
  `checks/jump-lanes.ts` (report burnouts; `tuningFor` is still used only for the old trail-bike parts path, leave it)
- Modify (numbers only): `src/lab/bikes.ts`, `src/lab/tune.ts`, `src/lab/showcase.ts`

**Interfaces:** none new; this task tunes numbers until the spec's "How we'll know" list holds.

- [ ] **Step 1:** Write `checks/showcase-robots.ts` (reuse the line planner from `checks/downhill-robots.ts`). Styles
  per place: chute — "stick up the whole way" and "brakes before the straight to the bike's `wobbleSpeed` − 1";
  switchbacks — "full stick" and "steady, rests at a corner when below 0.3"; rhythm — "pops every lip" and "rolls";
  XL — "perfect pop + backflip" and "rolled + backflip". Print per bike: finished, time, crashes, wobble-outs,
  burnouts, feet down, landed tricks.
- [ ] **Step 2:** Run it and the existing robots for all three bikes. Tune numbers until every line holds:
  - Chute: the enduro has the best clean time; the DJ with the stick up wobbles out, braking gets it through; the
    Bolinas wobbles out with the stick up unless it brakes; the enduro with the stick up is clean.
  - Switchbacks: the Bolinas has the best clean time; every bike finishes with the careful style.
  - Rhythm: the DJ scores the most; every bike finishes popping.
  - XL: the enduro lands a perfect-pop backflip and fails a rolled one; on `Jumps L` the enduro's backflip doesn't
    fit; the DJ lands a backflip on `Jumps M`.
  - Climb: the steady robot never burns out; full stick burns out and is slower overall on every bike; the Bolinas
    has the best climb time.
  - Existing: jump lanes clean on all bikes with no burnouts; slalom and pump laps still finish; the downhill's
    braking Bolinas is clean.
- [ ] **Step 3:** `npm run check && npm test` → PASS (update test numbers only where a tuned value is asserted
  exactly, and say so in the report).

---

### Task 8: Hand-off notes

**Files:**
- Modify: `docs/handoff-2026-11-01.md` ("Next up", a "Nov 5: bike rules" section with the robot results, the new
  checks, and "press Reset in Tune on the iPad")
- Modify: `README.md` only if it lists pages or checks

- [ ] **Step 1:** Write the section: what each bike's rules are, the tuned numbers that ended up different from the
  spec, robot results, known rough edges, and that piece 3 (garage wall and parts) is next.
- [ ] **Step 2:** `npm run check && npm test` → PASS; all `checks/*.mjs` pass against the dev server.
