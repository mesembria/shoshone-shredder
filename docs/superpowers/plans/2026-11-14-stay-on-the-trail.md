# Stay on the Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On every timed run, leaving the trail to skip part of it crashes you and puts you back on the trail at the furthest point you'd reached.

**Architecture:** Each timed run gets a **route**: a chain of trail stretches in riding order (`src/world/route.ts`, built
in `src/world/places/hill.ts` beside the start and finish lines). A small tracker (`src/game/stayOnTrail.ts`) follows the
rider's progress along the route each step. It reports a **cut** after 10 m ridden off the route, or on coming back more
than the skip distance ahead. The game and the robots both call the same `routeTick`. On a cut they crash the bike with
a get-up spot (`crashBack` in `src/lab/bike.ts`). The ↕ runs lose their `via` line, because the route already includes
the top.

**Tech Stack:** TypeScript, Three.js, Rapier (headless in robots), vitest, vite-node for `checks/`.

**Spec:** `docs/superpowers/specs/2026-11-13-stay-on-the-trail-design.md`

## Global Constraints

- The rule: "Stay on the trail. Cut it and you crash, back where you left it." It applies only during timed runs (`goal.kind === 'run'`). Free ride and Cone Zone are unchanged.
- The callout reads `You cut the trail!`, with sub `back where you left it` and tone `bad`, on the same frame as the cut.
- A cut is a real crash: outcome `'wipeout'` (its usual penalties), the tumble, the get-up after `CRASH.getUpSeconds`. The clock keeps running.
- Tolerances start at lateral `2` m past the trail's half width, `10` m ridden off, and skip `10` m. Tune them only with the robots (Task 6). They live in one exported constant, `ROUTE`, in `src/world/route.ts`.
- Nothing per physics step may scan a whole trail. Use `TrailPath.probe` (bounding boxes, cached per point) and don't allocate per step, except when a crash starts (`docs/building-an-area.md`, "Speed on the iPad").
- There is no `.git`. "Commit" steps mean snapshotting into `.superpowers/sdd-git`, the same way earlier plans did. Run checks with `npx vite-node checks/<x>.ts`, tests with `npx vitest run`, and types with `npx tsc --noEmit`.
- Use the dev server at `http://127.0.0.1:5173`, not localhost.

## Review Focus

1. **Turning round on Hairpin's top platform (↕).** You ride past the top mark onto the platform (`hairpinTop`), loop, and come back down. This must never trip a cut, and progress must move onto the second leg. Pinned by the `also` zones test in Task 3 and the ↕ heading test in Task 1.
2. **A natural crash that tumbles off the edge or down onto a lower leg.** You get up back at the furthest point, with no second crash and no callout. Pinned by the Task 3 test "a crash that tumbles off the route gets up where you'd got to".
3. **Corner cuts at switchbacks, each shorter than the skip distance.** Each one is legal, but four of them on Hairpin ↓ could add up to more than the 2.75 s gap from 2★ to 3★. Measured by `CORNERS=1` in Task 6. If the total gain is ≥ 1 s, lower `ROUTE.skip`.
4. **A teleport mid-run (Again, a station warp, the get-up jump).** A single step of more than 3 m never counts as metres ridden off the route. Pinned in Task 3.
5. **Crossing the finish line while tumbling, or after skipping.** It counts only within `ROUTE.skip` of the route's end. Otherwise it is ignored while crashing, and is a cut while riding. Pinned in Task 3.

---

### Task 1: Routes in the world

**Files:**
- Create: `src/world/route.ts`
- Modify: `src/lab/course.ts:40-41` (the `runs` type and its comment)
- Modify: `src/world/places/hill.ts:432-444` (a route per run)
- Test: `tests/route.test.ts`

**Interfaces:**
- Produces (in `src/world/route.ts`):
  - `export const ROUTE = { lateral: 2, off: 10, skip: 10, heading: 3, jump: 3 }`. `jump` is the step length above which a step is a teleport and never counts as ridden.
  - `interface RouteLeg { trail: Trail; u0: number; u1: number }`: ridden from u0 to u1. When u1 < u0, the leg is ridden backward.
  - `interface Route { legs: RouteLeg[]; top?: number; also?: TrailZone[] }`. `top` is the route distance of the top on the ↕ runs. `also` lists ground that counts as on the route but gives no progress, such as Hairpin's turnaround.
  - `routeLength(r: Route): number`
  - `routePoint(r: Route, d: number): { pos: THREE.Vector3; yaw: number }`: on the trail at d (clamped), 2 cm up, facing the riding direction.
  - `locate(r: Route, x: number, z: number, yaw: number, near: number): number | null`
- Produces (in `src/lab/course.ts`): `runs: Record<string, { start: Gate; finish: Gate; via?: Gate; route: Route }>`. `via` stays until Task 4.

`locate` works as follows. For each leg, call `leg.trail.path.probe(x, z)`. The leg is a candidate when the probe's `u` lies between u0 and u1, and `dist ≤ trail.width / 2 + ROUTE.lateral`. Its distance is `d = legStart + |u − u0|`. Each candidate scores `|d − near|`, plus `ROUTE.heading` when `Math.cos(yaw − alongYaw) < 0`. `alongYaw` is `path.at(u).yaw`, plus π on a backward leg. The lowest score wins. With no candidate, return null. Several legs on one trail (Hairpin ↕) share the probe's cached answer.

The routes in `hill.ts`, using the marks already there:
- goatUp: `up [marks.start → marks.top]`
- goatDown: `down [marks.downStart → marks.foot]`
- goatBoth: `up [marks.start → up.path.length]`, then `down [0 → marks.foot]`, with `top = marks.top − marks.start`
- hairpinUp: `hpt [bottom → top]`
- hairpinDown: `hpt [top → bottom]`
- hairpinBoth: `hpt [bottom → top]`, then `hpt [top → bottom]`, with `top = top − bottom`, and also:
  - `{ trail: hpt, u0: top, u1: hpt.path.length }`
  - `{ trail: <the platform trail 'hairpinTop'>, u0: 0, u1: its length }`
  - both with `off0/off1 = ∓(width / 2 + ROUTE.lateral)`
- boulderDash: `chute [bd.marks.startU + 1 → bd.marks.finishU]`

Use these exact bottom and top values: `hp.marks.bottom` and `hp.marks.top`. They are the u values the start and finish gates already use.

- [ ] **Step 1: Write the failing tests** in `tests/route.test.ts`. Build the hill once with `buildPlace('shredderHills')`.
  - `it('every timed run has a route from its start line to its finish line')`: for each run id, expect `routePoint(r, 0).pos` within 0.5 m of the start gate's midpoint. Expect `routePoint(r, routeLength(r)).pos` within 0.5 m of the finish gate's midpoint.
  - `it('riding a route down its middle reads steady progress')`: walk each leg every 0.5 m, calling `locate` with yaw along the riding direction and `near` = the last answer. Each answer is within 0.6 m of the walked distance. None is null.
  - `it('counts the grass band but not past it')`: on hairpinDown at d = 30, a point `width/2 + 1.9` m off to either side gives a number. `width/2 + 2.1` m off gives null.
  - `it('on the ↕ runs, which way you face picks the leg')`: on hairpinBoth, take the point 3 m below the top on the trail. Facing up with `near = top − 3`, expect ≈ `top − 3`. Facing down with `near = top`, expect ≈ `top + 3`.
  - `it('the ↕ runs\' top is the ↑ run\'s finish')`: `routePoint(both, both.top).pos` is within 0.5 m of the ↑ run's finish midpoint, for goat and hairpin.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run tests/route.test.ts`. Expected: FAIL, because `src/world/route.ts` does not exist.
- [ ] **Step 3: Implement** `src/world/route.ts`, the `runs` type, and the routes in `hill.ts`. In `routePoint`, find the leg holding d by walking the legs (at most two) and use `trailPoint(t, u, 0, 0.02)`.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run tests/route.test.ts && npx tsc --noEmit`. Expected: PASS, tsc clean.
- [ ] **Step 5: Snapshot.**

### Task 2: A crash that gets up somewhere else

**Files:**
- Modify: `src/lab/bike.ts` (`LabState`, `createLabState`, `getUp`, the crash branch of `stepLab`, a new export)
- Modify: `src/lab/ride.ts` (the `Ride` interface and `createRide`'s returned object)
- Test: `tests/labRide.test.ts`

**Interfaces:**
- Produces:
  - `LabState.getUpAt: { pos: THREE.Vector3; yaw: number } | null`, null by default. When the get-up timer ends, the bike stands there, then runs `standClear`. Again (`input.again`), `placeBike` and `getUp(s, true)` clear it.
  - `crashBack(s: LabState, at: { pos: THREE.Vector3; yaw: number }): void`, exported from `bike.ts`. It calls `startCrash(s, 'wipeout')` and sets `s.getUpAt` to a copy of `at`. The speed is left alone, so `ride.ts` spawns the tumble moving.
  - `Ride.crashBack(at: { pos: THREE.Vector3; yaw: number }): void`. It calls `crashBack`, then `fx.burst(s.pos, s.surface)` and `sound.crash(false)`.

- [ ] **Step 1: Write the failing tests** in `tests/labRide.test.ts`, using the yard already there.
  - `it('a crash sent back gets up at its spot, facing its way')`: riding at 6 m/s, `crashBack(s, { pos: V(spot), yaw: 1.2 })`. Then step until `!s.crash`. Expect it to take about `CRASH.getUpSeconds` (±1 step), `s.pos` within 0.1 m of the spot, `s.yaw` 1.2, `s.getUpAt` null, and `s.stars > 0` (wipeout penalties).
  - `it('Again during a crash sent back still goes to the respawn')`: after `crashBack`, a step with `again: true` puts the bike at `s.respawn.pos`, with `getUpAt` null.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run tests/labRide.test.ts`. Expected: FAIL, because `crashBack` is not exported.
- [ ] **Step 3: Implement** the changes listed in Interfaces.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run tests/labRide.test.ts && npx tsc --noEmit`. Expected: PASS, with every existing labRide test still passing.
- [ ] **Step 5: Snapshot.**

### Task 3: The stay-on-the-trail tracker

**Files:**
- Create: `src/game/stayOnTrail.ts`
- Test: `tests/stayOnTrail.test.ts`

**Interfaces:**
- Consumes: Task 1 (`ROUTE`, `Route`, `routeLength`, `routePoint`, `locate`, and `inZone` for `also`). Task 2 (`crashBack`, `LabState.getUpAt`).
- Produces:
  - `interface RouteTrack { route: Route; furthest: number; offRidden: number; topped: boolean; spot: { pos: THREE.Vector3; yaw: number } | null }`
  - `startTrack(route: Route): RouteTrack`. Progress starts at 0.
  - `type RouteCall = { finish?: true; top?: true; cut?: true; at?: { pos: THREE.Vector3; yaw: number } }`
  - `routeTick(t: RouteTrack, s: LabState, prev: { x: number; z: number }, finishCrossed: boolean): RouteCall`. It judges one step and does not crash anything. `at` is set together with `cut`.
  - `metresLeft(t: RouteTrack): { m: number; to: 'top' | 'finish' }`. For the how-close text: the route metres from the furthest point to the top (↕, not yet topped) or to the finish.

`routeTick` works as follows, in this order:
1. **While crashing** (`s.crash`): don't judge. If the spot where the bike would get up (`s.pos`) is off the route, or more than `skip` past `furthest`, set `s.getUpAt = spotOf(t)`. Otherwise set it to null. Here `spotOf` caches `routePoint(route, furthest)` in `t.spot` and only recomputes it when `furthest` has changed. A finish crossing counts (`finish: true`) only when `routeLength − furthest ≤ skip`.
2. If the point is in any `also` zone, it is on the route: set `offRidden = 0` and leave progress alone.
3. Call `d = locate(route, x, z, s.yaw, furthest)`. If d is null, add the step's length to `offRidden` (unless the step is longer than `jump`). When `offRidden ≥ off`, it's a cut.
4. If `d > furthest + skip`, it's a cut. Otherwise set `furthest = max(furthest, d)` and `offRidden = 0`. When `route.top` is set and `furthest ≥ top` for the first time, set `topped` and return `top: true`.
5. If `finishCrossed` and `routeLength − furthest > skip`, it's a cut. If `finishCrossed` otherwise, return `finish: true`.

On a cut, set `offRidden = 0` and return `{ cut: true, at: spotOf(t) }`. The caller crashes the bike.

- [ ] **Step 1: Write the failing tests** in `tests/stayOnTrail.test.ts`, on the built hill's routes. Use a stub `LabState`: `createLabState` at the route start, then move `s.pos` and `s.yaw` by hand. Don't use physics.
  - `it('riding the whole route never cuts, and reaches its end')`: walk every route at 0.25 m steps, crossing the finish at the end. Expect no `cut`, `furthest ≈ routeLength`, and the last call returns `finish`. For ↕, `top` is returned exactly once.
  - `it('riding the grass band beside the trail never cuts')`: hairpinDown walked at `off = width/2 + 1.8`. No cut.
  - `it('10 m ridden off the trail is a cut, 9.5 m is not')`: from d = 30 on hairpinDown, step straight out sideways. The cut comes once `offRidden` passes 10 (with 0.25 m steps, at 10 m, not 9.5). `at` is `routePoint(route, 30)`.
  - `it('coming back more than the skip ahead is a cut')`: at d = 30, jump in 0.25 m steps across to a point on the route at d = 30 + 15, staying within lateral reach. Expect a cut. For d = 30 + 8, expect no cut and `furthest = 38`.
  - `it('the finish counts only from near the end')`: with `furthest = routeLength − 30`, crossing the finish is a cut. With `furthest = routeLength − 5`, it returns `finish`. While crashing (`s.crash` set), the far-off crossing returns neither a cut nor `finish`, and the near one returns `finish`.
  - `it('Hairpin ↕: the top platform turnaround is on the route')`: walk up to the top, out along `hairpinTop`, and back down the trail. No cut. Progress passes `top`.
  - `it('a crash that tumbles off the route gets up where you\'d got to')`: with `s.crash` set and `s.pos` 8 m off the trail at d = 30, `s.getUpAt` is within 0.1 m of `routePoint(route, 30).pos`. With `s.pos` on the trail at d = 28, `getUpAt` is null.
  - `it('a teleport is not ridden')`: one step that jumps 20 m off the route adds nothing to `offRidden`.
  - `it('metresLeft counts route metres to the top, then the finish')`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run tests/stayOnTrail.test.ts`. Expected: FAIL, because the module does not exist.
- [ ] **Step 3: Implement** `src/game/stayOnTrail.ts`. Keep every per-step path free of allocation: no new vectors or objects except in `spotOf` when `furthest` has changed, and in the returned call object. Hold one `RouteCall` per track and reset its fields.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run tests/stayOnTrail.test.ts && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Snapshot.**

### Task 4: The ↕ runs without the top line

**Files:**
- Modify: `src/game/challenges.ts`:
  - the `Goal` comment, line 20: `via: true` now means "a top to reach first, on its route"
  - `Tick.run`: `'start' | 'finish'`, and a new `top?: true`
  - the 'run' case of `tick`
- Modify: `src/game/spots.ts` (`runEvent` loses `via`)
- Modify: `src/lab/course.ts` (`runs` drops `via?`)
- Modify: `src/world/places/hill.ts` (drop the `via:` gates)
- Test: `tests/challenges.test.ts:168-174`, `tests/hill.test.ts:46-68`, `tests/spots.test.ts:250-289`

**Interfaces:**
- Produces:
  - `tick` on a 'run' goal: `k.top` sets `run.checked`, but only once `run.on`. The finish completes when `run.on && k.run === 'finish'`. The route enforces the top, so tick no longer checks it. Progress text: `'Go!'` before the start. `'To the top!'` while `g.via && !run.checked`. Otherwise `'To the finish!'`.
  - `runEvent(...)` returns `'start' | 'finish' | null`.

- [ ] **Step 1: Update the tests.**
  - `challenges.test`: the both-ways test uses `top: true` in place of `run: 'via'`. A finish before the top is now done, because the route stops it. Replace that line with `play(both, [start, wait(5), { dt: 1, top: true }]) → progress 'To the finish!'`. Keep "the top only counts after the start" (`top` before `start` leaves 'To the top!').
  - `hill.test` walks expect `['start', 'finish']` for goatBoth and hairpinBoth.
  - `spots.test` drops the via assertions. "Runs each both-ways run up its ↑ and back down its ↓" now asserts `r[both].route.top` is set and `routePoint(r[both].route, top)` is within 0.5 m of `r[up].finish`'s midpoint.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run tests/challenges.test.ts tests/hill.test.ts tests/spots.test.ts`. Expected: FAIL (the `via` event is still emitted, and `top` is unknown).
- [ ] **Step 3: Implement** the changes listed in Interfaces. `tsc` will point at `main.ts` `howClose` reading `line?.via`. Leave a minimal fix there (always the finish) for Task 5 to replace.
- [ ] **Step 4: Run them and see them pass.** Run `npx vitest run && npx tsc --noEmit`. Expected: the whole suite passes (447 tests, plus Tasks 1–3's).
- [ ] **Step 5: Snapshot.**

### Task 5: Wire it into the game

**Files:**
- Modify: `src/game/main.ts`:
  - the step hook, at about lines 143–157
  - `startChallenge`, at about line 403
  - `stopRun`
  - `howClose`, at about line 375
  - `window.__game`, at about line 585
- Modify: `checks/game.mjs` (one new case)

**Interfaces:**
- Consumes: Task 2 (`Ride.crashBack`) and Task 3 (`startTrack`, `routeTick`, `metresLeft`).
- Produces: `window.__game.track(): RouteTrack | null`, for the browser check.

The game's side:
- `let track: RouteTrack | null`. It is null outside 'run' goals. It's set by `startTrack(course.runs[id].route)` on the first `k.run === 'start'` of the run, and cleared in `stopRun`.
- In the step hook, once the run has started:
  1. Compute `e = runEvent(...)`.
  2. Call `c = routeTick(track, s, prevWhere, e === 'finish')`.
  3. Set `k.run = e === 'start' ? 'start' : c.finish ? 'finish' : undefined` and `k.top = c.top`.
  4. On `c.cut`: call `r.crashBack(c.at!)` and `r.hud.callout({ text: 'You cut the trail!', sub: 'back where you left it', tone: 'bad' })`.
  The start event still comes straight from `runEvent`, before any track exists.
- `howClose` for 'run': `"You didn't cross the start"` when not on. Otherwise `` `${Math.round(m)} m from the ${to}` `` from `metresLeft(track)`.

- [ ] **Step 1: Add the browser check case** to `checks/game.mjs`, after the Hairpin Hollow ↑ case. Steps:
  1. `__game.start('hairpinDown')` and wait for `run()?.on`.
  2. Set the bike 6 m off the trail beside it, facing away: `__game.ride.s.pos`/`yaw`, with y from `castDown` via the ride's `phys`. Hold throttle with the stick, the way the check already pushes.
  3. Wait (condition-based, ≤ 8 s) for the callout text `You cut the trail!`.
  4. Wait for `!__game.ride.s.crash`. Then check the bike is within 1 m of the route point at `__game.track().furthest`.
  5. `PASS`/`FAIL` lines in the check's style.
- [ ] **Step 2: Run it and see it fail.** Start the dev server if it isn't running. Run `node checks/game.mjs`. Expected: that case FAILs (no callout); the others PASS.
- [ ] **Step 3: Implement** the game's side as described above.
- [ ] **Step 4: Run it and see it pass.** Run `node checks/game.mjs && npx tsc --noEmit && npx vitest run`. Expected: every check PASSes, tsc is clean, and the tests pass.
- [ ] **Step 5: Snapshot.**

### Task 6: Robots ride by the same rule; tune; docs

**Files:**
- Modify: `checks/ladder-robots.ts:520-540`, `checks/showcase-robots.ts:165-170`, `checks/hairpin-cut.ts`
- Modify: `src/world/route.ts` (`ROUTE` values, only if the robots say so)
- Modify: `docs/handoff-2026-11-01.md` (checks table: hairpin-cut's new output and `CORNERS=1`), `docs/building-an-area.md` (a "The rider's world" point: every timed run needs a route in `Course['runs']`, and `also` zones for any turnaround)

The robots' side:
- Each robot keeps a `track`, started on the 'start' event. It calls `routeTick` exactly as main.ts does. On a cut, it calls `crashBack(s, c.at)` from `bike.ts`.
- ladder-robots adds `cuts: number` to `Result` and prints `cuts N` on any run where N > 0. Its summary line counts runs with cuts, per challenge.
- hairpin-cut prints, per run:
  - the number of cuts;
  - whether it finished, and its time;
  - whether that time beats the run's 3★.
  `CORNERS=1` adds a mode: for each switchback on the run's route, start on the route 12 m before the turn. Aim for the route 12 m after the turn's end. Report the route metres gained (`furthest` after, minus the trail distance actually ridden) and whether a cut fired.

- [ ] **Step 1: Update the three robots** as described above.
- [ ] **Step 2: Run the shortcut robots.** Run `RUN=<id> npx vite-node checks/hairpin-cut.ts` for each of the 7 runs. Expected:
  - no run finishes under its 3★ time by cutting;
  - Hairpin ↓ and ↑ show cuts;
  - 0 traps, as before.
- [ ] **Step 3: Run the corner probe.** Run `CORNERS=1 RUN=hairpinDown npx vite-node checks/hairpin-cut.ts` and the same for `RUN=hairpinUp`. Expected: the summed gain across switchbacks is under 1 s at the robot's speed. If it isn't, lower `ROUTE.skip` (try 6), rerun Task 3's tests and this step, and say so in the report.
- [ ] **Step 4: Run the ladder.** Run `ONLY=<id> npx vite-node checks/ladder-robots.ts`, 4–5 at a time, for all 15 challenges. Kill any leftovers afterwards. Expected:
  - the same verdicts as `/private/tmp/claude-501/-Users-pmoore-Source-shoshone-shedder/6600f204-c4ab-47cc-a6ac-3a05be9a5037/scratchpad/ladder-final.txt`: 14/15, with Cone Zone the known break, and the Goat Ladder ↓ edge rider reaching 2★ (accepted);
  - **zero cuts by any trail or edge rider**.

  If a rider cuts, read its trace (`TRACEAT=`) and widen `ROUTE.lateral` or `ROUTE.off` just enough. Don't change any challenge time. Report any verdict that changes: a constraint the user approved has broken, so ask the user.
- [ ] **Step 5: Run the full suite.** Run `npx vitest run && npx tsc --noEmit`. Expected: pass, clean.
- [ ] **Step 6: Update the docs.** Update the two docs listed under Files. Update the playtest-findings memory to "built, awaiting playtest".
- [ ] **Step 7: Snapshot.**
