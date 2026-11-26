# Ladder Weak Spots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the star ladder hold on Cone Zone, Boulder Dash, The Plank, Table Row XL, Whoop-de-Doo and Hairpin Hollow by changing courses and locks, then resetting star targets from the robots.

**Architecture:** Courses are code (`src/lab/course.ts`, `src/lab/showcase.ts`); challenges and locks are data (`src/game/challenges.ts`); star targets come from `checks/ladder-robots.ts`, which rides each challenge through the game's own challenge code on five loadouts and prints a rule verdict. Each task changes one place, updates its unit tests and robots, reruns the robots for that challenge, and sets targets from the output.

**Tech Stack:** TypeScript 5.6, three.js 0.170, Rapier 0.14, Vitest 2.1, vite-node (robots), headless Chromium over CDP (browser checks).

**Spec:** `docs/superpowers/specs/2026-11-07-ladder-weak-spots-design.md`

## Global Constraints

- The ladder rule (what every target must give): (a) bare hardtail 1★, never 2★; (b) hardtail with all parts 2★, never 3★; (c) matching bike stock ridden carelessly never 3★; (d) matching bike with parts ridden well 3★ just reachable. Matching bikes: Trail → Bolinas, Downhill → Enduro, Park → Dirt Jumper.
- Times are `[limit, 2★, 3★]` seconds; Park points are `[1★, 2★, 3★]`.
- Stat locks stay 0.15 clear of every reachable value (`tests/challenges.test.ts` checks it).
- New hazards are marked: yellow lip bars on every lip and gap edge; boulders taller than the Enduro plows (plow is under 0.35 m; use radius ≥ 0.5 with `rock()`).
- Do not touch Goat Ladder (`goatUp`, `goatDown`, `goatBoth`) or its course.
- Never run a full robot sweep at the same time as a browser check (CPU starvation fails browser lines).
- Git (updated Nov 24): the project is now a real repo. Work on a branch, commit normally (read "snapshot" steps as commits), push, open a PR with `gh pr create`; `main` is protected. The `.superpowers/sdd-git` snapshots mentioned in this document are old history kept for reference.
- Dev server for browser checks: `http://127.0.0.1:5173` (never `localhost`).
- Kid-facing text: short, plain, no jargon.

## Review Focus

1. A kid rolls slowly into the plank gap without hopping: the run ends "Fell off the plank" (not stuck, not "end"). Test in Task 3.
2. A kid rides the wide plank (no gap) during The Plank: it doesn't start or finish the challenge, so the gap can't be skipped; the `tell` says to ride the narrow plank. Test in Task 3.
3. The hardtail build that opens Boulder Dash (Air fork + Wide bars) can still find a line through the boulders and finish for 1★. Robot check in Task 4 (the `a+`-style row for the lock build must finish).
4. Hairpin Hollow ↑ on the bare hardtail still finishes inside its limit: no permanent stall on the steeper legs or the backs of the step-downs. Robot check in Task 5 (row `a` finishes).
5. Nobody falls off the raised hillside: steering hard into the edges on an upper Hairpin leg keeps the bike between the edge rocks. Test in Task 5 (`rockPin.test.ts` gets an upper-leg place).

---

### Task 1: Open Table Row XL and Whoop-de-Doo to every bike

**Files:**
- Modify: `src/game/challenges.ts` (the `tableXL` and `whoop` entries, about lines 63-64)
- Test: `tests/challenges.test.ts` (the stat-lock tests, about lines 186-213)

**Interfaces:**
- Produces: `tableXL.need = { stars: 5 }`; `whoop.need = { stars: 4 }` (no `stat`).

- [ ] **Step 1: Change the tests**
  - In 'a stat lock opens with the right bike or part': replace the three `tableXL` lines with
    ```ts
    expect(canStart(fresh, ch('tableXL'), loadoutOf(fresh))).toBe(false);
    expect(lockText(fresh, ch('tableXL'), loadoutOf(fresh))).toBe('Ride 5 ★ in Shredder Hills');
    const five = withStars(fresh, { goatUp: 2, goatDown: 2, tableSmall: 1 });
    expect(canStart(five, ch('tableXL'), loadoutOf(five))).toBe(true); // the bare hardtail can try it
    expect(canStart(withStars(fresh, { goatUp: 2, goatDown: 2 }), ch('whoop'), loadoutOf(fresh))).toBe(true);
    ```
  - In 'the stat thresholds…': drop the `tableXL` and `whoop` pairs from the loop.
  - New test 'no Park challenge is locked to one bike': `expect(CHALLENGES.filter((c) => c.group === 'park' && c.need?.stat?.[0] === 'pop')).toEqual([])`.
- [ ] **Step 2: Run** `npx vitest run tests/challenges.test.ts`. Expected: the new lines FAIL.
- [ ] **Step 3: Edit the two entries** in `challenges.ts`: `tableXL` gets `need: { stars: 5 }`; `whoop` keeps `stars: 4` and loses `stat`.
- [ ] **Step 4: Run** `npx vitest run tests/challenges.test.ts`. Expected: PASS.
- [ ] **Step 5: Robots.** `ONLY=tableXL,whoop npx vite-node checks/ladder-robots.ts`. Set both `points` targets so the verdict reads `holds`: 1★ ≤ row a's best; row a's best < 2★ ≤ row b's best; row b's best < 3★ ≤ row d's best (and above row c's). If row a can't finish XL at all (no clean landing on any style), stop and report back (spec: don't reshape the table without the user).
- [ ] **Step 6: Run** `npx vitest run` (all). Expected: PASS. Snapshot: "Open Table Row XL and Whoop-de-Doo to every bike".

### Task 2: Cone Zone: ten tighter gates

**Files:**
- Modify: `src/lab/course.ts` (slalom loop, about lines 299-304)
- Modify: `src/game/challenges.ts` (`coneZone`: `count`, `times`)
- Modify: `checks/slalom.ts` (the hard-coded 5 and 6), `checks/game.mjs` (Cone Zone drive, about lines 81-84)
- Test: `tests/spots.test.ts`

**Interfaces:**
- Produces: `export const SLALOM = { x0: -50, step: 6, swing: 2.5, count: 10 }` in `course.ts`; gate i at `x = x0 + i * step`, `z = i % 2 ? -swing : swing`, posts at `z ± 1.2` as today; `course.gates.length === SLALOM.count`.

- [ ] **Step 1: Write the failing test** in `tests/spots.test.ts`, 'the slalom has ten gates on the street, alternating sides': `course.gates.length === SLALOM.count === 10`; every gate's middle has `|z| ≤ 3` and `x < 70` (on the street, short of the dead-end rail at 80); consecutive middles alternate sign of z; and `CHALLENGES.find(c => c.id === 'coneZone').goal.count === course.gates.length`.
- [ ] **Step 2: Run** `npx vitest run tests/spots.test.ts`. Expected: FAIL (`SLALOM` not exported).
- [ ] **Step 3: Build the gates from `SLALOM`** in `course.ts`; set `coneZone.goal.count` to 10 (keep the current `times` for now).
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Robots that drive the gates.** `checks/slalom.ts`: use `course.gates.length - 1` and `course.gates.length` in place of 5 and 6. `checks/game.mjs`: read the gates in the page, `const gates = await ev('window.__lab.course.gates.map((g) => [(g.a.x + g.b.x) / 2, (g.a.y + g.b.y) / 2])')`, and teleport to each `[x - 0.6, z]` in turn, as the loop does now.
- [ ] **Step 6: Tune spacing and targets.** `ONLY=coneZone npx vite-node checks/ladder-robots.ts`. Aim (spec): best times of rows a, b, d each at least ~0.5 s apart. If they aren't, adjust `step` (5-7 m) and `swing` (2-3 m) and rerun. Then set `times` so the verdict is `holds`, with the 3★ line at least 0.2 s under row b's best.
- [ ] **Step 7: Verify in the browser.** With the dev server up and nothing else running: `node checks/game.mjs <scratch dir>`. Expected: every line PASS. Snapshot: "Cone Zone: ten tighter gates".

### Task 3: The Plank: a gap to hop

**Files:**
- Modify: `src/lab/course.ts` (`PLANKS`, the skinnies loop, about lines 274-277 and 350-355)
- Modify: `src/game/spots.ts` (`createPlankWatch`)
- Modify: `src/game/challenges.ts` (`plank`: `tell`, `points`)
- Modify: `checks/ladder-robots.ts` (`PLANK` styles, the manual swipe line about line 387, the `plank` paths)
- Test: `tests/spots.test.ts` ('plank watch')

**Interfaces:**
- Produces: `PLANKS[0].gap: [number, number]`, the gap's start and end x (about 1.2 m long, centered near the plank's middle); `PLANKS[1]` has no `gap`. Type: `{ z: number; width: number; x0: number; x1: number; y: number; gap?: [number, number] }`.

- [ ] **Step 1: Write the failing tests** in 'plank watch':
  - 'a slow roll into the gap is falling off': on at `x0 + 2`, then `at((gap[0] + gap[1]) / 2, p.z, 0.02)` (grounded) → `'off'`.
  - 'flying over the gap is fine': on, then `at(mid, p.z, top + 0.2, false)` → `null`, then `at(gap[1] + 0.5, p.z, top)` → `null`, then `at(p.x1 + 0.2, p.z, top)` → `'end'`.
  - Replace 'counts the wide plank too' with 'the wide plank is practice: it never starts the challenge': `createPlankWatch()(at(wide.x0 + 2, wide.z, top))` → `null`.
  - `PLANKS[0].gap` exists, its length is 0.9–1.6, and both ends are at least 3 m from `x0` and `x1`.
- [ ] **Step 2: Run** `npx vitest run tests/spots.test.ts`. Expected: FAIL.
- [ ] **Step 3: Build the gap.** In the skinnies loop, a plank with `gap` is two extruded pieces: the first is the ramp up plus the flat to `gap[0]`, and the second is the flat from `gap[1]` plus the ramp down. Lip bars go across both gap edges. A second `lines` entry at `(gap[0], y)` with `after: x1 - gap[1]` lets line assist carry a hop onto the second half. `createPlankWatch` takes `on` only from `PLANKS[0]`. `plank.tell` becomes 'Manual the narrow plank, hop the gap, manual again'.
- [ ] **Step 4: Run** the tests. Expected: PASS. Run `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Robots.** In `ladder-robots.ts`, the plank path is `PLANKS[0]` only. Add `gapHop?: number` to `Style`: the distance before `gap[0]` at which the robot hops (a ~0.1 s press), and it swipes into a new manual after landing on the second half. `PLANK` styles: 'slow, manuals, hops the gap' at a few `gapHop` values and two speeds (stick -0.5, 0), 'cruise, hops the gap, no manual', and the careless 'cruise, no manual' (rolls into the gap). `ONLY=plank npx vite-node checks/ladder-robots.ts`.
- [ ] **Step 6: Size the gap and set targets.** Aim (spec): the full hardtail can clear the gap only by riding faster or skipping the manual before it (2★); the Dirt Jumper can manual right up to it (3★). Adjust the gap length (0.9–1.6 m), then set `points` so the verdict is `holds` (the Flick 3.6 lock stays, so row a can't start and `a+` is the lock build). Snapshot: "The Plank: a gap to hop".

### Task 4: Boulder Dash: a step-down and boulders on the fast straight

**Files:**
- Modify: `src/lab/showcase.ts` (Rock chute block, about lines 62-100)
- Modify: `src/game/challenges.ts` (`boulderDash.times`, `tell`)
- Modify: `checks/ladder-robots.ts` (`CHUTE_STYLES`: one style that brakes to a speed before the boulders)
- Test: `tests/spots.test.ts` ('showcase places')

**Interfaces:**
- Produces: `CHUTE.boulders: number` (the x where the boulder section starts) exported from `showcase.ts`, so the robots and tests can find it; the step-down is a `lines` entry with `yaw: 0` and a `land`.

- [ ] **Step 1: Write the failing test** 'Boulder Dash has a lip and boulders you must swerve round': `course.lines` has a lip with `x` between `CHUTE.x0` and `CHUTE.boulders` and `z` within 2 of `CHUTE.z`. Across every 0.5 m step in x through the boulder section, a `castDown` grid over the trail width shows `rock` somewhere. No single z lane is free of rock along the whole section (there's no straight line through), but at each x some z on the trail is free (there's always a line).
- [ ] **Step 2: Run** `npx vitest run tests/spots.test.ts`. Expected: FAIL.
- [ ] **Step 3: Build it.** On straight C: a step-down table (kick, short top, landing onto the slope; drop ~0.8–1.2 m), with a lip bar and a `lines` entry, then 2–3 boulders (radius 0.5–0.7) staggered left/right/left across the 3.5 m trail, with ~6–9 m between them (far enough to swerve at a braked speed, not at top speed). `tell` becomes 'Get to the bottom. Brake before the boulders!'.
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS (including `rockPin.test.ts` 'chute top').
- [ ] **Step 5: Robots and targets.** Add CHUTE_STYLES 'brakes to N before the boulders, pops, tricks' for N in 8, 10, 12. `ONLY=boulderDash npx vite-node checks/ladder-robots.ts`. Expected: row c ('stick up the whole way', careless) no longer reaches the 3★ time (it crashes, costing time, or the boulders slow it). The lock build (Air fork + Wide bars hardtail) finishes. Then set `times` so the verdict is `holds`. If c still beats every careful style, move the boulders closer together or further up the straight and rerun. Snapshot: "Boulder Dash: step-down and boulders".

### Task 5: Hairpin Hollow climbs a hillside

**Files:**
- Modify: `src/lab/showcase.ts` (Switchbacks block, about lines 102-175)
- Modify: `src/game/challenges.ts` (`hairpinUp`, `hairpinDown`, `hairpinBoth` `times`)
- Modify: `checks/ladder-robots.ts` (`hairpinDown` gets descent styles with pop and tricks)
- Test: `tests/spots.test.ts`, `tests/rockPin.test.ts`

**Interfaces:**
- Produces: `TRAIL.rise = 2` (m each leg climbs, ridden ↑) in `showcase.ts`; `stations['Switchbacks top']` at the new top height; the two step-downs as `lines` entries with `yaw` facing the ↓ direction of their leg.

- [ ] **Step 1: Write the failing tests.**
  - `spots.test.ts`, 'Hairpin Hollow climbs: the top is about 10 m up': `course.stations['Switchbacks top'].pos.y - course.stations.Switchbacks.pos.y` is between 8 and 12. (The existing 'starts every new station on riding ground' test then checks the top station sits on the trail.)
  - 'Hairpin Hollow ↓ has two lips facing down the trail': exactly two `course.lines` with `x` in `[TRAIL.x0, TRAIL.x1]` and `z` in `[TRAIL.z0 - 2, TRAIL.z0 + 4 * TRAIL.gap + 2]`, each with `yaw` equal to the ↓ direction of its leg (legs numbered 1-5 from the bottom: legs 1, 3, 5 are ridden ↑ toward +x, so ↓ is yaw π; legs 2 and 4 are ridden ↑ toward -x, so ↓ is yaw 0).
  - `rockPin.test.ts`: add `['switchbacks leg4', TRAIL.x0 + 6, TRAIL.z0 + 3 * TRAIL.gap, 1.25]` to `places`.
- [ ] **Step 2: Run** `npx vitest run tests/spots.test.ts tests/rockPin.test.ts`. Expected: FAIL.
- [ ] **Step 3: Rebuild the legs.** Each leg rises `TRAIL.rise` ridden ↑, as one or two pitches with flats between (keep leg 1's gravel pitch). The four hairpin pads sit at the height where their legs meet. Two legs (one of 2/3, one of 4/5) get a step-down table built facing ↓, which ridden ↑ is a short steep climb up its landing. Keep that landing ≤ ~20° and ≤ ~1.2 m high so the hardtail can climb it. Trail edges stay rock-lined on every leg. `climb.area` covers every leg. `Switchbacks top` moves up to the top of leg 5.
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Robots and targets.** In `ladder-robots.ts`, `hairpinDown` gets styles like `DESCENT` (brakes for hairpins, plus pop and tricks), keeping one careless 'full stick'. Run `ONLY=hairpinUp,hairpinDown,hairpinBoth npx vite-node checks/ladder-robots.ts`. Expected: row a finishes all three. On ↓, the careful styles brake before each hairpin and 'full stick' crashes or is slowest. Set all three `times` so each verdict is `holds`. Snapshot: "Hairpin Hollow climbs a hillside".

### Task 6: Full check and handoff

**Files:**
- Modify: `docs/handoff-2026-11-01.md` (Nov 7 section, ladder table, "Tuning weak spots")
- Modify: `checks/hub.mjs` only if a line depends on a changed lock (the first-map counts stay 3 open / 12 locked).

- [ ] **Step 1:** `npx tsc --noEmit -p .` and `npx vitest run`. Expected: no type errors, all tests pass.
- [ ] **Step 2:** Full sweep, alone: `npx vite-node checks/ladder-robots.ts > <scratch>/ladder.log`. Expected: `rule: holds` on all 15, Goat Ladder rows unchanged from the handoff's table.
- [ ] **Step 3:** After the sweep, run each browser check one at a time: `node checks/hub.mjs <dir>`, `node checks/game.mjs <dir>`, `node checks/showcase-shots.mjs <dir>`. Expected: all PASS. Look at the showcase shots of the chute boulders and the hairpin hillside: the lips and boulders read clearly.
- [ ] **Step 4:** Update the handoff. Add the new ladder table, remove the fixed items from "Tuning weak spots", add a Nov 7 bullet per place, and update the test count. Snapshot: "Ladder weak spots: handoff".
