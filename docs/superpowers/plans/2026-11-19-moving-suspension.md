# Moving Suspension and Brakes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork, rear end, shock and brakes are drawn from the bike plus its fitted parts, move with the ride, and a landing too big for the bike's travel bottoms out through the existing landing outcomes.

**Architecture:** One `Kit` description on `BikeSpec` (fork, rear, brakes), patched by parts in `loadout()`. The ride (`stepLab`) decides bottoming from `impact` against a capacity built from the kit. The rig shows it with animation-only springs (never fed back into the ride) and per-piece meshes with pivots.

**Tech Stack:** TypeScript, three.js 0.170, vitest, vite-node for robot checks, headless Chrome (CDP) for browser checks.

**Spec:** `docs/superpowers/specs/2026-11-19-moving-suspension-design.md`

## Global Constraints

- The ride rule may only use the ride's own state, never the animation spring or frame time.
- iPad budget: each bike rig (`createRider(spec, { rider: false })`) has at most 23 meshes. Today it is 8, or 9 on the Enduro. Non-moving pieces merge by color through `piece()`.
- The rigid hardtail's capacity is exactly 6, today's heavy-landing number.
- No save data changes. The look comes from part ids already in saves.
- Phase-0 `BIKES` (`src/rules/bikes.ts`, used by `src/game.ts`) have no kit, so they get `DEFAULT_KIT` (rigid, hardtail, no brakes) and look as they do today.
- Robot runs: the full ladder takes 20+ minutes. Run it only in Task 2 (baseline) and Task 9 (verification), split by challenge, 4 or 5 at a time in the background (`ONLY=<id> npx vite-node checks/ladder-robots.ts`). Kill leftover runs afterwards.
- The repo is public. Commit and PR text stays free of family and personal details.
- Dev server: `http://127.0.0.1:5173`, not localhost.

## Review Focus

1. **Swapping bikes or parts mid-ride** (`setBike`, garage swaps): the new rig gets the new kit, the springs and O-ring start fresh, and no old meshes stay in the scene. Pinned in Task 6.
2. **A crash mid-compression**: `detach` and `reattach` must carry the moving pieces with the bike, and reattach must zero the springs. Pinned in Task 5.
3. **The garage stand**: `standPose()` with each kit sits at rest, wheels on the floor, and the O-ring at the top. Pinned in Task 5.
4. **A slow frame** (dt 0.25 s on the iPad): the springs never pass full travel or go NaN. Pinned in Task 4.
5. **Parts whose spec text and data drift apart**: a catalog test checks that each mm in the spec text matches its kit patch. Pinned in Task 1.

---

### Task 1: The kit description, stock kits and part patches

**Files:**
- Modify: `src/rules/bikes.ts` (types, `DEFAULT_KIT`, `kitOf`, `withKit`; remove `fork` and `shock` from `FrameShape`)
- Modify: `src/lab/bikes.ts` (stock kits; `bolinas` becomes `{ ...BIKES.bolinas, kit }`; drop `fork:`/`shock:` from frames)
- Modify: `src/game/catalog.ts` (`PartDef.kit?: KitPatch`, merged in `loadout()`)
- Modify: `src/bike/rider.ts` (read `kitOf(bike)` where it read `f.fork`/`f.shock`, so it keeps drawing as today)
- Test: `tests/kit.test.ts` (new), `tests/catalog.test.ts`

**Interfaces:**
- Produces, in `src/rules/bikes.ts`:
  ```ts
  export type SpringKind = 'air' | 'coil';
  export type RearDesign = 'singlePivot' | 'linkage' | 'shortLink';
  export type Brake = 'none' | 'rim' | number; // a number is a disc rotor, mm
  export interface Kit {
    fork: { kind: 'rigid' | SpringKind; travel: number }; // mm, 0 when rigid
    rear: { design: 'hardtail' | RearDesign; shock: SpringKind; travel: number }; // travel 0 on a hardtail
    brakeFront: Brake; brakeRear: Brake;
  }
  export interface KitPatch { fork?: Kit['fork']; rear?: Partial<Kit['rear']>; brakeFront?: Brake; brakeRear?: Brake }
  export const DEFAULT_KIT: Kit; // rigid 0, hardtail air 0, 'none', 'none'
  export function kitOf(spec: BikeSpec): Kit; // spec.kit ?? DEFAULT_KIT
  export function withKit(kit: Kit, patch: KitPatch): Kit; // rear merges shallowly
  // BikeSpec gains: kit?: Kit
  ```

Stock kits: hardtail rigid / hardtail / `'rim'` / `'rim'`; dirtjumper rigid / hardtail / `'none'` / `160`; bolinas air 130 / hardtail / `180` / `180`; enduro air 170 / `linkage` air 170 / `180` / `180`.
Part patches: `hardtail-air-fork` fork air 120; `hardtail-hydraulic-brakes` 160/160; `bolinas-long-fork` air 140; `bolinas-short-fork` air 120; `enduro-coil-shock` rear `{ shock: 'coil' }`; `enduro-air-shock` rear `{ shock: 'air' }`; `enduro-4-piston-brakes` 203/203.

- [ ] **Step 1: Write the failing tests** in `tests/kit.test.ts`:
  - `phase-0 bikes get the default kit`: `kitOf(BIKES.bolinas)` and `kitOf(BIKES.bayview)` equal `DEFAULT_KIT`.
  - `stock kits match the spec table`: `kitOf(LAB_BIKES.bolinas).fork` equals `{ kind: 'air', travel: 130 }`, `kitOf(LAB_BIKES.enduro).rear` equals `{ design: 'linkage', shock: 'air', travel: 170 }`, `kitOf(LAB_BIKES.dirtjumper).brakeFront` is `'none'` and its `brakeRear` is `160`.
  - `withKit merges rear shallowly`: `withKit(kitOf(LAB_BIKES.enduro), { rear: { shock: 'coil' } }).rear` equals `{ design: 'linkage', shock: 'coil', travel: 170 }`.

  In `tests/catalog.test.ts`:
  - `a fitted part changes the kit`: `loadout('hardtail', { suspension: 'hardtail-air-fork' }).spec.kit!.fork` equals `{ kind: 'air', travel: 120 }`, and `loadout('enduro', { brakes: 'enduro-4-piston-brakes' }).spec.kit!.brakeFront` is `203`. The stock loadout's kit equals the bike's stock kit, and `LAB_BIKES.hardtail.kit` is unchanged afterwards (no mutation).
  - `spec text and kit data agree`: for every part in the `suspension` and `brakes` slots whose `spec` matches `/(\d+) mm/`, the number equals the loadout kit's value. Use the rear travel for the Enduro's suspension, the fork travel for other suspension, and the rotor (`brakeFront` if it's a number, else `brakeRear`) for brakes.
- [ ] **Step 2: Run** `npx vitest run tests/kit.test.ts tests/catalog.test.ts`. Expected: FAIL, because `kitOf` isn't exported.
- [ ] **Step 3: Implement** the types and functions above, the stock kits, `PartDef.kit` and the merge in `loadout()` (`spec.kit = withKit(spec.kit ?? DEFAULT_KIT, p.kit)` per fitted part). Then update `rider.ts`: `travel` fork drawing when `kitOf(bike).fork.kind !== 'rigid'`, and the shock rod when `kitOf(bike).rear.design !== 'hardtail'`. The Bolinas now draws fat stanchions. That's intended.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 5: Commit**: `git commit -m "Describe each bike's fork, rear and brakes as a kit that parts patch"`

### Task 2: Landing log and the baseline ladder run

**Files:**
- Modify: `checks/ladder-robots.ts` (a `LANDLOG=<dir>` option)
- Create: `checks/landing-log.ts` (reads the log, prints the summary)
- Modify: `.gitignore` is not needed: logs go under `.superpowers/landing-log/`, which is already ignored

**Interfaces:**
- Produces: JSON lines, one file per process at `<LANDLOG>/<challenge ids>.jsonl`. Each line is one finished `ride()`: `{ challenge, bike, fit, style, ok, stars, t, points, landings: [{ impact, slope, outcome, airTime, fromLip }] }`. `impact` and `slope` come from `ev.impact` and `ev.slope`.
- Produces: `npx vite-node checks/landing-log.ts <dir>` prints, per challenge and bike, the largest `impact`, and the largest `impact` among rides with `stars >= 1` and with `stars >= 2`. It also prints the largest hardtail `impact` on a star-earning ride across all challenges.

- [ ] **Step 1: Add the option.** Collect landings inside `ride()` from each step's `ev.landed`, and append the record where `ride()` returns. It's off unless `LANDLOG` is set, so default output stays byte-identical.
- [ ] **Step 2: Check default output is unchanged**: `ONLY=tableSmall npx vite-node checks/ladder-robots.ts > .superpowers/landing-log/pre.txt` before and after the change, then `diff`. Expected: no difference.
- [ ] **Step 3: Write `checks/landing-log.ts`** and check it on that one-challenge log.
- [ ] **Step 4: Commit**: `git commit -m "Robots can log every landing for tuning"`
- [ ] **Step 5: Baseline run (milestone, background).** Use all 15 challenge ids from `CHALLENGES` in `src/game/challenges.ts`, 4 or 5 processes at a time, each with `LANDLOG=.superpowers/landing-log/baseline`. Tee each process's normal output to `.superpowers/landing-log/baseline/<id>.txt`. Kill leftovers afterwards. Record the summary's hardtail max star-earning impact. Task 3 needs it.

### Task 3: The bottoming rule in the ride

**Files:**
- Create: `src/rules/suspension.ts`
- Modify: `src/lab/tune.ts` (keys and a "Suspension" group)
- Modify: `src/lab/bike.ts` (touchdown block; `LabEvents`)
- Modify: `src/lab/ride.ts` (the callout)
- Test: `tests/suspension.test.ts` (new), `tests/labRide.test.ts`

**Interfaces:**
- Produces, in `src/rules/suspension.ts`:
  ```ts
  export interface BottomTune { bottomBase: number; bottomPerMm: number; airFactor: number; coilFactor: number; bottomMargin: number }
  export function landingCapacity(kit: Kit, t: BottomTune): number;
  // base + perMm * (forkMm * factor(fork) + rearMm * factor(rear)) / 2, where factor(rigid) never matters (travel 0)
  export type BottomTier = 'within' | 'bottomed' | 'slammed';
  export function bottomTier(used: number, margin: number): BottomTier; // > 1 + margin slammed, > 1 bottomed
  ```
- Produces: `LabEvents.used?: number` (impact / capacity, set on every touchdown) and `LabEvents.bottomed?: boolean`.
- Tune defaults (new `DEFAULTS` keys): `bottomBase: 6, bottomPerMm: 0.025, airFactor: 1.1, coilFactor: 1, bottomMargin: 0.5`. `bottomMargin` and `bottomPerMm` are then set from the baseline log in Step 5.

- [ ] **Step 1: Write the failing tests** in `tests/suspension.test.ts`:
  - `the rigid hardtail takes exactly 6`: `landingCapacity(kitOf(LAB_BIKES.hardtail), DEFAULTS)` is `6`.
  - `travel adds, averaged front and rear`: a kit with fork air 130 and a hardtail rear gives `6 + 0.025 * 130 * 1.1 / 2`.
  - `air resists bottoming more than coil`: the Enduro's capacity with `shock: 'air'` is greater than with `shock: 'coil'`.
  - `tiers`: `bottomTier(1, 0.5)` is `'within'`, `bottomTier(1.01, 0.5)` is `'bottomed'`, `bottomTier(1.51, 0.5)` is `'slammed'`.

  In `tests/labRide.test.ts`, drop a bike flat from a height giving impact ≈ 8, using the existing test helpers in that file:
  - On the stock hardtail: `ev.bottomed` is true, speed is multiplied by its `flatKeep`, and the outcome is unchanged.
  - On the stock Enduro: `ev.bottomed` is false and `ev.used < 1`.
  - Impact above `6 * (1 + bottomMargin)` on the hardtail, landed square: `ev.landed` is `'bobble'`.
- [ ] **Step 2: Run** `npx vitest run tests/suspension.test.ts tests/labRide.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** In the touchdown block, replace `if (impact > 6 && Math.abs(gp) < 0.1) after *= T.flatKeep;` with: `used = impact / landingCapacity(kitOf(s.bike), T)`, the tier, `after *= T.flatKeep` when the tier isn't `'within'`, and `outcome = 'bobble'` when the tier is `'slammed'` and the outcome was `'clean'`. Make `outcome` a `let`, and decide it before `ev.landed` and the bobble effects. Set `ev.used` and `ev.bottomed`. In `ride.ts`, the "Heavy landing" callout fires on `big && ev.bottomed`, as `{ text: 'Bottomed out!', sub: 'land on the slope to save your speed', tone: 'meh' }`. Add Tune rows: "Landing: rider's legs take (m/s)" 3–10 step 0.1; "Landing: extra per mm of travel" 0–0.06 step 0.001; "Air spring resists bottoming" 0.8–1.4 step 0.05; "Coil spring resists bottoming" 0.8–1.4 step 0.05; "Bobble once past bottoming by (share)" 0–1.5 step 0.05.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 5: Set the numbers from the log** (no robot run). With the baseline log, set `bottomMargin` so `6 * (1 + margin)` sits just above the hardtail's largest star-earning impact (round up to 0.05). Then list every logged landing whose tier or speed would change under the new rule: compute it from `impact`, `slope` and each ride's kit. That includes slope-free bottoming where today's rule needed flat ground. If any falls on a ride that set a row's best result, either keep the flat-only gate for the speed loss (`Math.abs(gp) < 0.1`, with the clunk and `used` still slope-free), or lower `bottomPerMm`, and say which in the commit. Write the numbers and the reason into the comment above the defaults.
- [ ] **Step 6: Commit**: `git commit -m "Bottoming out: a landing too big for the bike's travel costs speed or bobbles"`

### Task 4: The animation spring

**Files:**
- Create: `src/bike/springs.ts`
- Modify: `src/lab/tune.ts` (look keys)
- Test: `tests/springs.test.ts` (new)

**Interfaces:**
- Produces:
  ```ts
  export interface Spring { x: number; v: number; deepest: number } // x: share of travel, 0 top-out .. 1 bottom; below 0 is stretched (manual)
  export function createSpring(): Spring;
  export function landKick(used: number, kind: SpringKind): number; // the v that makes a landing peak near min(used, 1)
  export function stepSpring(sp: Spring, dt: number, rest: number, kind: SpringKind, t: { suspStiff: number; suspDamp: number }): void;
  export function resetSpring(sp: Spring): void;
  ```
  `stepSpring` works in 1/120 s slices like today's squash. Air adds stiffness rising steeply toward x = 1, and coil is linear. `x` is clamped to [-0.3, 1], and hitting 1 zeroes any further inward `v` (the bump stop). `deepest = max(deepest, x)`.
- Tune defaults: `suspStiff: 160, suspDamp: 14, suspLand: 1, suspChatter: 1, suspPump: 1, suspDive: 1, suspManual: 1, suspScale: 1, squashShare: 0.4`, with rows in the Suspension group.

- [ ] **Step 1: Write the failing tests:**
  - `a landing kick peaks and settles back to rest`: kick with `landKick(0.5, 'air')`, step 2 s at 1/60. The peak is between 0.35 and 0.65 and the end is within 0.02 of `rest`.
  - `used 1 reaches the bump stop`: the peak is ≥ 0.95 and never > 1.
  - `coil sinks deeper than air for the same kick`.
  - `a slow frame stays sane`: `stepSpring(sp, 0.25, ...)` after a big kick gives a finite `x` in [-0.3, 1].
  - `deepest remembers the biggest hit until reset`.
- [ ] **Step 2: Run** `npx vitest run tests/springs.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** per the interface.
- [ ] **Step 4: Run** `npx vitest run tests/springs.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "An animation-only spring for forks and shocks"`

### Task 5: The kit's meshes, and a frame that sinks while the wheels stay down

**Files:**
- Create: `src/bike/kit.ts` (builds fork, O-ring, rear designs, shocks, brakes; poses them)
- Modify: `src/bike/rider.ts` (uses `buildKit`; the sprung and unsprung split; squash share; `standPose`, `detach`/`reattach`)
- Test: `tests/rider.test.ts`

**Interfaces:**
- Consumes: `Kit`/`kitOf` (Task 1), `Spring` (Task 4).
- Produces:
  ```ts
  export interface KitPose { fork: number; rear: number; clampFront: number; clampRear: number; ring: number } // fork/rear: Spring.x; clamps 0..1; ring: deepest fork x
  export interface KitRig { pose(p: KitPose): void }
  export function buildKit(kit: Kit, f: FrameShape & { wheel: number }, g: { chassis: THREE.Group; frontWheel: THREE.Group; rearWheel: THREE.Group }, frameColor: number): KitRig;
  ```
  Named meshes, for the tests: `forkLowers`, `oring` (travel forks only), `swingarm`, `shockBody`, `shockShaft`, `rocker` (linkage), `links` (shortLink), `rotorFront`/`rotorRear`, `caliperFront`/`caliperRear`, `rimBrakeFront`/`rimBrakeRear`. A piece only exists where the kit has it.
- The look, per the spec's "The look". The fork's crown-to-axle length is fixed by the frame, so travel shows as **exposed stanchion length** (visual travel = `travel / 1000 * 0.8 * T.suspScale` model units). Rear designs: `singlePivot` pivots just above and ahead of the bottom bracket with the shock from the down tube to the swingarm. `linkage` has the chainstay pivot near the bottom bracket, a rocker on the seat tube driven by the seatstays, and the shock from the rocker to the down tube. `shortLink` hangs the rear triangle on two short links behind the bottom bracket, with the shock tucked low. Coil shocks draw a helix in a bright color, and air shocks a smooth can. Rotors sit on the wheel groups (so they spin), sized `mm / 2000 / riderScale` in radius. Calipers sit on the lowers and the swingarm or chainstay. The clamp moves the pads or rim arms visibly inward, exaggerated for the chase camera.
- The motion: fork compression moves `forkLowers` plus the front wheel up along the fork axis, and rear compression swings `swingarm` plus the rear wheel up around the design's pivot. `chassis` (frame, bars, seat, cranks, fork stanchions, shock body) and `riderPart` sink and pitch by the matching amounts, so the wheels stay put. On a hardtail rear and a rigid fork, that end doesn't move. The body squash multiplies by `1 - (1 - T.squashShare) * min(1, (forkMm + rearMm) / 340)`, so a rigid bike squashes as today.

- [ ] **Step 1: Write the failing tests** in `tests/rider.test.ts`:
  - `each kit builds its pieces`: the hardtail stock has `rimBrakeFront` and no `forkLowers`; the Bolinas has `forkLowers`, `oring` and `rotorFront`, and no `swingarm`; the Enduro has `swingarm`, `shockBody` and `rocker`; a coil Enduro's `shockBody` differs from an air one (a different geometry vertex count); the dirt jumper has `caliperRear` and no front brake.
  - `the mesh budget holds`: for every lab bike and every part mix from `partsFor`, `createRider(spec, { rider: false })` has at most 23 meshes.
  - `full compression sinks the frame, not the wheels`: on the Enduro, pose fork 1 and rear 1 (through a test hook or a big `land(1.5, 1)` stepped to its peak). The `frontTire`/`rearHub` anchors' world y moves less than 0.02 m, and the `bars` anchor drops more than 0.05 m.
  - `a rigid hardtail's frame doesn't sink`: the same pose leaves `bars` within 0.005 m.
  - `the stand pose sits at rest`: after `standPose()` on each lab bike, the wheel bottoms sit on y = 0 (within 0.01 m, as the stand measures), and on the Bolinas `oring` is at the top of its stanchion.
  - `a crash carries the pieces`: `detach` then `followTumble` keeps `forkLowers` under `bikePart`. After `reattach()` the springs are zero (the bars anchor is back at rest after one update).
  - Update `keeps the Bolinas and Bayview frames as they are` to compare `frameOf()` without the removed `fork`/`shock` fields.
- [ ] **Step 2: Run** `npx vitest run tests/rider.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `buildKit`**, then restructure `createRider`: `bikePart` holds `chassis`, with the wheels under the kit's unsprung groups. Keep `bikePart`/`riderPart` as the two pieces `detach` moves. Keep the old shock rod and fat stanchion code only if `buildKit` replaces it entirely. No duplicate drawing.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: all pass, including the existing foot-down and stand tests.
- [ ] **Step 5: Commit**: `git commit -m "Forks, rear ends, shocks and brakes as moving pieces built from the kit"`

### Task 6: Drive the motion from the ride

**Files:**
- Modify: `src/bike/rider.ts` (`RiderRig` API; springs stepped in `update`)
- Modify: `src/lab/ride.ts` (pass cues; call `land`, `pump`, `bump`, `resetHits`)
- Modify: `src/view/sound.ts` (`bottom()`)
- Modify: `src/game.ts` only if the compiler needs it (it passes no cues)
- Test: `tests/rider.test.ts`

**Interfaces:**
- Consumes: `buildKit`/`KitPose` (Task 5), `Spring` functions (Task 4), `LabEvents.used`/`bottomed` (Task 3).
- Produces, on `RiderRig`:
  ```ts
  update(s: BikeState, dt: number, crouching: boolean, cues?: { braking: number; rough: boolean }): void; // braking 0..1 from max(0, -throttle)
  land(strength: number, used?: number): void; // used 0 keeps today's squash-only kick
  pump(): void;
  bump(): void;
  resetHits(): void; // the O-ring back to the top
  ```
  `Sound` gains `bottom(): void`, a short low clunk. Rest targets in `update`: braking dives the fork (`+0.25 * braking * T.suspDive`) and lifts the rear (`-0.1 * braking * T.suspDive`). A manual (`s.manual > 0`) stretches the fork (`-0.3 * T.suspManual`) and squats the rear (`+0.1 * T.suspManual`). `rough` adds a small random kick each step (`T.suspChatter`). Clamps ease toward `braking`.

- [ ] **Step 1: Write the failing tests:**
  - `braking dives the fork and clamps the brakes`: on the Bolinas, updating 0.5 s with `cues.braking = 1` lowers the `bars` anchor and moves `caliperFront` from its rest position. Without cues, neither moves.
  - `a manual stretches the fork`: `s.manual = 1` raises the front relative to rest.
  - `the O-ring keeps the deepest hit until resetHits`.
  - `swapping bikes starts fresh`: a new rig from `createRider(LAB_BIKES.bolinas)` after a landing on another rig has the O-ring at the top.
- [ ] **Step 2: Run** `npx vitest run tests/rider.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `ride.ts`, keep the last `readIntent()` result from `step()`, and pass `{ braking: Math.max(0, -intent.throttle), rough: !!intent.rough }` to `rig.update`. In `react()`, call `rig.land(strength, ev.used ?? 0)` where `land` is called today, plus `sound.bottom()` when `ev.bottomed`. Also call `rig.pump()` on `ev.pumping` and `rig.bump()` on `ev.bump`. Call `rig.resetHits()` in `teleport` and when a respawn (`again`) places the bike. `setBike` already builds a fresh rig.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 5: Commit**: `git commit -m "Suspension moves with landings, bumps, pumping, braking and manuals"`

### Task 7: The rear-design switch in the Tune drawer

**Files:**
- Modify: `src/lab/tune.ts` (`labRear` key and row; `createPanel` gains `on.change?(key: TuneKey)`)
- Modify: `src/game/main.ts` (rebuild the rig on `labRear` change)
- Test: `tests/labBikes.test.ts`

**Interfaces:**
- Produces: `DEFAULTS.labRear = 0`, with the row "Rear design (Enduro only): 0 its own, 1 single pivot, 2 linkage, 3 short link", 0–3 step 1. Also `export function withLabRear(spec: BikeSpec, n: number): BikeSpec` in `src/lab/bikes.ts`. It returns the spec unchanged when `n === 0` or the kit's rear is `'hardtail'`, and otherwise a copy with that design.

- [ ] **Step 1: Write the failing test**: `withLabRear(LAB_BIKES.enduro, 3).kit!.rear.design` is `'shortLink'`; `withLabRear(LAB_BIKES.bolinas, 2)` is `LAB_BIKES.bolinas` unchanged; `LAB_BIKES.enduro` is not mutated.
- [ ] **Step 2: Run** `npx vitest run tests/labBikes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `main.ts`, when the panel reports a `labRear` change, call `r.setBike(withLabRear(loadoutOf(me).spec, T.labRear))`, and apply `withLabRear` wherever `main.ts` builds a ride spec while `?tune=1` is on. `labRear` is not in `WRITTEN`, so loadouts never touch it.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit`. Expected: all pass.
- [ ] **Step 5: Commit**: `git commit -m "Tune drawer can switch the Enduro's rear design"`

### Task 8: Browser check with screenshots

**Files:**
- Create: `checks/suspension-shots.mjs` (copy the CDP harness from `checks/bike-swap.mjs`)

**Interfaces:**
- Consumes: `window.__lab` from `src/game/main.ts` (`s`, `T`, `swap`, `look`). Add a debug hook only if needed. It must be read-only and live under `__lab`.

- [ ] **Step 1: Write the check.** With the dev server up (`npm run dev`, at `http://127.0.0.1:5173/play.html?bike=...&tune=1`), take side-on shots of each bike stock, the hardtail with the air fork and the hydraulic brakes, the Enduro with coil and with air, and the Enduro with `labRear` 1, 2 and 3. Shoot each at rest and mid-compression right after a landing (drop the bike from a height through `__lab`, and wait for `s.grounded`, never a fixed sleep). Assert no page exceptions, and that the draw calls in `renderer.info` rise by at most 15 over the same scene before the change (record the old number in the check as a literal, with a comment saying where it came from).
- [ ] **Step 2: Run** `node checks/suspension-shots.mjs`. Expected: all PASS lines. Look at every screenshot: the rear designs read differently, the coil shock shows its spring, the rotors show, and the wheels stay on the ground mid-compression.
- [ ] **Step 3: Commit**: `git commit -m "Browser check: every kit and rear design, at rest and compressed"`

### Task 9: Verification, issues and PR

- [ ] **Step 1: Verification ladder run (milestone, background).** Run the same split as Task 2, with `LANDLOG=.superpowers/landing-log/after`. Expected: "four-way rule holds" on at least 14 of 15, no new 2★ for the Bolinas or Enduro stock-careless rows (`c`), and a hardtail row `a` that never reaches 2★. Diff against the baseline `.txt` files and note every changed row in the PR. Kill leftovers.
- [ ] **Step 2: Run** `npm run check && npm test`. Expected: all pass.
- [ ] **Step 3: Issues.** Comment on #2 with the playtest questions: do they notice the squish, does bottoming out read, does it make landings feel better, and does anyone check the O-ring. Comment on #24 that `LANDLOG` plus `checks/landing-log.ts` let thresholds be set from one logged run instead of repeated ladder runs. File an issue for any loose end found during the build.
- [ ] **Step 4: PR.** `git push -u origin feat/moving-suspension`, then `gh pr create` with a real description: what changed, the ladder diff, the chosen thresholds and why, `Closes #12`, and the attribution line. Merge only once the user approves.
