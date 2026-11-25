# First Area Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn today's one flat test park into two foothills places: Shredder Hills, a trail hill whose curved trails
keep how they ride today, and a jump park strung on one flow line. Make the look test's scenery permanent.

**Architecture:**
- A trail becomes a curved path on the ground plus today's height `Profile` (`src/world/trail.ts`). Everything placed
  on a trail uses trail coordinates: distance along `u`, offset across `off`.
- Each place has its own builder returning the same `Course` shape (`src/world/places/`). Place-specific data that is
  hard-coded today moves into `Course`: rings, zones, trails, the home station and the scenery plan. That way the ride
  loop, spots, robots and tests stay place-agnostic.
- A generated hill surface fits under the trails (`src/world/terrain.ts`). The look test becomes `src/look/scenery.ts`.

**Tech Stack:** TypeScript 5.6, three.js 0.170, Rapier 0.14 (compat, trimesh colliders), Vite 5.4, Vitest 2.1. Robot
checks run with `npx vite-node checks/<file>.ts`, browser checks with `node checks/<file>.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-07-first-area-redesign-design.md`

## Global Constraints

- iPad 10th gen, Safari, 60 fps. **Per-place budget: about 650k triangles and 90 draw calls** (the look test's measured
  numbers). Going over means measuring on the iPad again.
- Rapier trimesh colliders come from meshes tagged `userData.collide`, before `mergeStatic`.
- Challenge ids, the station keys used as challenge `spot`s, stars and cogs don't change. Saved profiles must keep
  working.
- The ladder rule: on the bare hardtail, every unlocked challenge can be cleared at 1★ but not 2★. It must hold on
  **at least 14 of 15** (Cone Zone is the known exception). Check it with `checks/ladder-robots.ts`, and rerun its
  hop-chain guard styles (lines over features).
- **The edge rider** (rides beside a trail to skip obstacles) must never beat a trail challenge's 2★ time.
- Profiles carry over unchanged: Goat Ladder up and down, Hairpin Hollow and Boulder Dash keep their profiles and
  feature positions in `u`. The summit is Boulder Dash's start at **20 m**. Goat Ladder (12.1 m) and Hairpin (10.7 m)
  top out on a **shoulder**, joined to the summit by a connector trail with no challenge.
- Switchback arcs keep today's pad radii: **Goat Ladder SR 3.5, Hairpin `TRAIL.SR` 2**. Trail widths stay: **Goat 3,
  Hairpin 2.5, Boulder Dash 3.5**.
- The hill surface matches the trail height within **1.5 m** of a trail's edge and never pokes above any trail.
- The jump park's features keep their geometry and run-ups. Only their positions change, plus new berms and paths.
- Place ids are the area ids: **`shredderHills`** and **`mesaJumpPark`**. The park's name is **"Mesa Jump Park"**.
- Locks count stars from **both** places. Lock text: **`Ride ${n} ★`**.
- Both places use the one baked backdrop (`public/backdrop/baked/`). No `?look` flag after Task 11.
- Git (updated Nov 24): the project is now a real repo. Work on a branch, commit normally (read "snapshot" steps as commits), push, open a PR with `gh pr create`; `main` is protected. The `.superpowers/sdd-git` snapshots mentioned in this document are old history kept for reference.
- Dev server: `http://127.0.0.1:5173` (localhost is another project). Headless browser checks use the Playwright
  Chromium described in the existing `checks/*.mjs`.

## Review Focus

1. **Arriving by an old URL.** `?at=Street`, `?at=Hill top`, `?at=U-turn` and similar keys from bookmarks or browser
   history must land at the right place's home station, not throw. Test in Task 9.
2. **Riding off the hill's open sides.** On a face with no trail, a rider can go anywhere. The terrain must have no
   holes and no cliff edges to fall through, and the camera's ground ray must always hit. Test in Task 4 (no-holes
   grid) and Task 6 (castDown everywhere inside the extent).
3. **Teleporting onto a curved trail.** A station or ring on a curve or a slope must put the bike on the ribbon, facing
   along the trail, not inside the terrain. Test in Task 6 (every station's height is within 0.1 m of castDown).
4. **Line crossings on curves.** Start, finish and via lines on a bend must still count when crossed forward and not
   when crossed backward, and runs whose lines share a ring (Goat ↑ and ↕) must still tell apart. Test in Task 1
   (`gateAcross` on an arc) and Task 6 (the run lines in order).
5. **Old saves.** A profile saved before this change, with stars on all 15, must show the same stars and the same open
   challenges across the two places. Test in Task 10.

---

### Task 1: The trail tool

**Files:**
- Create: `src/world/trail.ts`
- Test: `tests/trail.test.ts`

**Interfaces:**
- Consumes: `Profile`, `heightAt` from `src/lab/course.ts`; `Gate`, `Area` types from `src/lab/course.ts`.
- Produces:
  - `class TrailPath { constructor(x: number, z: number, yaw: number); straight(len: number): this; arc(radius: number, turnDeg: number): this; get length(): number; at(u: number): { x: number; z: number; yaw: number }; nearest(x: number, z: number): { u: number; off: number; dist: number } }`.
    `yaw` follows the bike's convention: 0 is +x, and forward is `(cos yaw, -sin yaw)` in (x, z). A positive
    `turnDeg` turns left. `off` is positive to the rider's right. The right vector for heading `(fx, fz)` is `(-fz, fx)`.
  - `interface Trail { id: string; path: TrailPath; profile: Profile; width: number; y0: number }`
  - `trailY(t: Trail, u: number): number` (= `y0 + heightAt(profile, u)`)
  - `trailPoint(t: Trail, u: number, off = 0, lift = 0): THREE.Vector3`
  - `trailRibbon(t: Trail, opts?: { u0?: number; u1?: number; skirt?: number; step?: number }): THREE.BufferGeometry`.
    The riding surface across `width`, swept along the path, with side skirts `skirt` (default 0.4) m down.
  - `interface TrailZone { trail: Trail; u0: number; u1: number; off0?: number; off1?: number }` and
    `type Zone = Area | TrailZone`
  - `inZone(z: Zone, x: number, zz: number): boolean`
  - `gateAcross(t: Trail, u: number, half: number, reverse = false): Gate`. With `a` on the rider's right and `b` on
    the left, as `across()` does today, `runEvent`'s forward test passes when riding in the trail's direction (the
    opposite when `reverse`).

To avoid an import cycle, `src/world/trail.ts` imports the values `Profile` and `heightAt` from `src/lab/course.ts`,
and `course.ts` imports only types from `trail.ts` (`import type`). The types `Ledge` (Task 2) and `TrailFeatures`
(Task 5) also live in `trail.ts`.

- [ ] **Step 0: SNAPSHOT "Before the first-area redesign: look test, backdrop bake, spec"** (captures the current
  working state, including the uncommitted changes already in the folder)

- [ ] **Step 1: Write the failing tests** in `tests/trail.test.ts`:

```ts
it('a straight path runs along its yaw', () => {
  const p = new TrailPath(0, 0, 0).straight(10);
  expect(p.length).toBeCloseTo(10);
  expect(p.at(10)).toMatchObject({ x: expect.closeTo(10, 3), z: expect.closeTo(0, 3) });
});
it('a left 180° arc of radius 3.5 ends 7 m to the left, facing back', () => {
  const p = new TrailPath(0, 0, 0).straight(5).arc(3.5, 180);
  const end = p.at(p.length);
  expect(p.length).toBeCloseTo(5 + Math.PI * 3.5, 2);
  expect(end.x).toBeCloseTo(5, 2);
  expect(end.z).toBeCloseTo(-7, 2); // left of +x is -z
  expect(Math.cos(end.yaw)).toBeCloseTo(-1, 3);
});
it('nearest finds distance along and signed offset (right is +)', () => {
  const p = new TrailPath(0, 0, 0).straight(20);
  expect(p.nearest(8, 1.5)).toMatchObject({ u: expect.closeTo(8, 2), off: expect.closeTo(1.5, 2) });
  expect(p.nearest(8, -1).off).toBeCloseTo(-1, 2);
});
it('trailY follows the profile, steps included', () => {
  const prof = new Profile(); prof.flat(5); prof.pts.push([5, 0.3]); prof.flat(5);
  const t: Trail = { id: 't', path: new TrailPath(0, 0, 0).straight(10), profile: prof, width: 3, y0: 2 };
  expect(trailY(t, 2)).toBeCloseTo(2);
  expect(trailY(t, 7)).toBeCloseTo(2.3);
});
it('a trail zone covers its stretch and width only', () => {
  const t: Trail = { id: 't', path: new TrailPath(0, 0, 0).straight(30), profile: new Profile().flat(30), width: 3, y0: 0 };
  const z: TrailZone = { trail: t, u0: 10, u1: 20, off0: -1.8, off1: 1.8 };
  expect(inZone(z, 15, 1)).toBe(true);
  expect(inZone(z, 25, 0)).toBe(false);
  expect(inZone(z, 15, 3)).toBe(false);
  expect(inZone({ x0: 0, x1: 1, z0: 0, z1: 1 }, 0.5, 0.5)).toBe(true);
});
it('gateAcross on an arc counts forward crossings only', () => {
  const t: Trail = { id: 't', path: new TrailPath(0, 0, 0).straight(5).arc(4, 90).straight(5), profile: new Profile().flat(20), width: 3, y0: 0 };
  const u = 5 + (Math.PI * 4) / 4; // the end of the bend
  const g = gateAcross(t, u, 2), before = t.path.at(u - 0.3), after = t.path.at(u + 0.3);
  const runs = { x: { start: g, finish: g } };
  expect(runEvent('x', { x: before.x, y: 0, z: before.z, grounded: true }, { x: after.x, y: 0, z: after.z, grounded: true }, runs)).toBe('start');
  expect(runEvent('x', { x: after.x, y: 0, z: after.z, grounded: true }, { x: before.x, y: 0, z: before.z, grounded: true }, runs)).toBeNull();
});
it('the ribbon spans the width at the profile height', () => {
  const t: Trail = { id: 't', path: new TrailPath(0, 0, 0).arc(6, 90), profile: new Profile().flat(10), width: 3, y0: 1 };
  const g = trailRibbon(t, { skirt: 0 }); g.computeBoundingBox();
  expect(g.boundingBox!.max.y).toBeCloseTo(1, 2);
  expect(g.boundingBox!.min.y).toBeCloseTo(1, 2);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/trail.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/world/trail.ts`.** `TrailPath` stores a dense polyline sampled every 0.1 m from
  straights and arcs, with a cumulative-distance array. `at(u)` interpolates. `nearest` does a linear scan, which is
  fine at these sizes. `trailRibbon` samples the path at every 0.25 m (`step`) plus every profile point's `u`,
  duplicated where the profile has a vertical step, so ledges stay vertical. It emits a top strip and two skirts with
  normals. Non-indexed is fine.

- [ ] **Step 4: Run** `npx vitest run tests/trail.test.ts`. Expected: PASS (7 tests).

- [ ] **Step 5: SNAPSHOT "Trail tool: a profile along a curved path"**

---

### Task 2: Zones and ledges that work on any heading (old park, same behavior)

The ride loop and the robots stop assuming trails run along x. Today's park still builds them, so every robot result
must come out the same.

**Files:**
- Modify: `src/lab/course.ts` (the `Climb`, `Course` and ledge types; where the climb pushes ledges)
- Modify: `src/lab/showcase.ts` (where it pushes ledges and zones)
- Modify: `src/lab/ride.ts:160-175` (coast, climb and loose checks) and the ledge crossing and ledge warning (about
  lines 318-345)
- Modify: `checks/climb-robots.ts`, `checks/downhill-robots.ts`, `checks/ladder-robots.ts`,
  `checks/showcase-robots.ts`, `checks/trail-edges.ts` (where they read `ledge.dir` or `ledge.pos.x`)
- Test: `tests/ledges.test.ts`

**Interfaces:**
- Consumes: `Zone`, `inZone` from Task 1.
- Produces:
  - `interface Ledge { pos: THREE.Vector3; yaw: number; half: number; log?: boolean }`. `yaw` is the riding direction
    up and over it; `pos` is the middle of its top edge.
  - `Climb { area: Zone[]; loose: Zone[]; ledges: Ledge[]; start: Gate; top: Gate }`.
  - `Course.coast: Zone[]` and `Course.rough: Zone[]`.
  - `ledgeGate(l: Ledge): Gate` and `ledgeAhead(l: Ledge, x: number, z: number, yaw: number): number`, both in
    `src/world/trail.ts`. `ledgeGate` is a line across the ledge, forward along `l.yaw`. `ledgeAhead` is the metres
    ahead along `l.yaw`, or `Infinity` when facing away (`cos(yaw - l.yaw) <= 0.5`) or outside `half + 0.3`.

- [ ] **Step 1: Write the failing test** in `tests/ledges.test.ts`. Use a ledge at (10, 0.3, 5) with `yaw: Math.PI`
  (ridden toward -x) and `half: 1.5`:
  - `runEvent`, with `ledgeGate` as start and finish, returns `'start'` going from x 10.4 to 9.6 at z 5.
  - It returns `null` going from 9.6 to 10.4.
  - `ledgeAhead(l, 14, 5, Math.PI)` is about 4.
  - `ledgeAhead(l, 14, 5, 0)` is `Infinity`.
  - `ledgeAhead(l, 14, 7.5, Math.PI)` is `Infinity`.

- [ ] **Step 2: Run** `npx vitest run tests/ledges.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `ledgeGate` and `ledgeAhead`. Change the types. Old `dir` ±1 becomes `yaw` 0 or `Math.PI`.
  `ride.ts` replaces `inside`/`inArea` with `inZone`, and replaces the `(prev.x - L.x) * dir` crossing with
  `segmentsCross` against `ledgeGate`. The ledge warning uses `ledgeAhead(...) < Math.max(4.5, s.speed * 0.9)`. The
  robots read `yaw` where they read `dir`.

- [ ] **Step 4: Run the full check**:
  - `npx vitest run`: expect PASS.
  - Then `npx vite-node checks/climb-robots.ts`, `npx vite-node checks/downhill-robots.ts` and
    `npx vite-node checks/ladder-robots.ts`. Expect output identical to a run made before Step 3. Save the "before"
    output in the scratchpad first.

- [ ] **Step 5: SNAPSHOT "Zones and ledges work on any heading"**

---

### Task 3: Place data lives in the Course (old park, same behavior)

**Files:**
- Modify: `src/lab/course.ts` (the `Course` type; `buildCourse` fills the new fields)
- Modify: `src/game/spots.ts` (`ZONES` and `RINGS` move out; `lapEvent` and `createPlankWatch` stay)
- Modify: `src/game/main.ts`, `checks/game.mjs`, `checks/hub.mjs` (read `course.rings` and `course.zones`)
- Modify: `src/lab/ride.ts:113` (the fallback station becomes `course.home`)
- Test: `tests/spots.test.ts` (update)

**Interfaces:**
- Consumes: Task 2's `Zone`.
- Produces: `Course` gains:
  - `place: string`
  - `home: string` (the station a ride starts at when none is given; `'Street'` for the old park)
  - `trails: Record<string, Trail>` (empty for the old park)
  - `rings: Record<string, { x: number; z: number }>`
  - `zones: Record<string, Zone>`

- [ ] **Step 1: Update `tests/spots.test.ts`** to read rings and zones from `buildCourse()`. Add:
  - every `CHALLENGES[].spot` has a ring and a zone in the course;
  - every ring is inside its own zone.

- [ ] **Step 2: Run** `npx vitest run tests/spots.test.ts`. Expected: FAIL (`course.rings` undefined).

- [ ] **Step 3: Move** `RINGS` and `ZONES` into `buildCourse`, with the same values, and point readers at the course.

- [ ] **Step 4: Run** `npx vitest run`, then `node checks/game.mjs` (dev server running). Expected: PASS, with the
  browser check printing no failures.

- [ ] **Step 5: SNAPSHOT "Rings, zones and home station live in the Course"**

---

### Task 4: The hill surface

**Files:**
- Create: `src/world/terrain.ts`
- Test: `tests/terrain.test.ts`

**Interfaces:**
- Consumes: `Trail`, `trailY`, `TrailPath.nearest` from Task 1.
- Produces:
  - `interface HillShape { height(x: number, z: number): number }` (the natural hill without trails)
  - `buildTerrain(trails: Trail[], shape: HillShape, extent: { x0: number; x1: number; z0: number; z1: number }, cell = 1.5): { mesh: THREE.Mesh; heightAt(x: number, z: number): number }`.
    The mesh is flat-shaded, vertex-coloured gold with sage patches (colours as in `src/look/foothills.ts`'s land),
    with `userData.collide = 'grass'`.

The rule, per grid vertex:
- Let `d` be the distance to the nearest trail's centreline and `ty` that trail's `trailY` at the nearest `u`.
- Inside `width/2 + 1.5` the height is `ty - 0.03`. That's the bench.
- Out to a further 4 m it blends to `shape.height` (smoothstep).
- Then clamp so the result never exceeds `ty - 0.03` for any trail whose ribbon is within `width/2 + 0.3` of the
  vertex. When two trails are close, the lower one wins near it.
- Outside every bench it's `shape.height`.

- [ ] **Step 1: Write the failing tests** in `tests/terrain.test.ts`. Use two trails on a 30 m cone hill: one climbing
  0 to 6 m along a curve, one crossing below it. Assert:
  - On 500 random points inside each trail's width, `heightAt <= trailY - 0.02`.
  - At `off = width/2 + 1.0`, `|heightAt - trailY| < 0.06`.
  - 20 m from any trail, `heightAt` equals `shape.height` within 1e-6.
  - The mesh has no holes: its triangle count is exactly `2 * nx * nz` for its grid, and every vertex position is
    finite.

- [ ] **Step 2: Run** `npx vitest run tests/terrain.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `buildTerrain`.** For speed, precompute each trail's polyline samples into a uniform 2 m
  bucket grid, so the nearest-trail query only checks nearby buckets.

- [ ] **Step 4: Run** `npx vitest run tests/terrain.test.ts`. Expected: PASS.

- [ ] **Step 5: SNAPSHOT "Hill surface fitted to the trails"**

---

### Task 5: Goat Ladder on a test hill (the riskiest part)

Goat Ladder moves onto curved trails, built in the new hill place. The old park stays in place, still serving the
game, until Task 9.

**Files:**
- Create: `src/world/trails/goatLadder.ts` (the up and down profiles and features, moved from `src/lab/course.ts`'s
  climb section)
- Create: `src/world/places/hill.ts` (only Goat Ladder, its terrain and the trailhead for now)
- Create: `checks/follow.ts` (the robots' path steering)
- Modify: `checks/climb-robots.ts`, `checks/downhill-robots.ts` (a `PLACE=hill` environment switch to run on the new
  hill)
- Test: `tests/goatLadder.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - `goatLadder(): { up: Trail; down: Trail; features: TrailFeatures }`, where
    `interface TrailFeatures { ledges: { trail: Trail; u: number; off?: number; half: number; log?: boolean }[]; rocks: { trail: Trail; u: number; off: number; r: number }[]; gravel: { trail: Trail; u0: number; u1: number; off0: number; off1: number }[]; jumps: { trail: Trail; lipU: number; lipH: number; knuckle: number; landLen: number; drop: number }[]; slabs: { trail: Trail; u: number; off: number; len: number; wid: number }[]; logs: { trail: Trail; u: number; r: number }[] }`
    (put this type in `src/world/trail.ts`).
  - `placeFeatures(w: THREE.Group, f: TrailFeatures, lines: Line[], climb: Climb, decor: THREE.Object3D[]): void` in
    `src/world/trail.ts`. It turns trail-coordinate features into meshes, `Line`s, `Ledge`s and loose zones, the way
    the climb section does today.
  - `buildHill(): Course`, with `place: 'shredderHills'`, `home: 'Trailhead'`, and stations `Trailhead`, `Climb` and
    `Summit` for now.
  - `pathSteer(t: Trail, x: number, z: number, yaw: number, ahead = 3): number` in `checks/follow.ts`. The steer in
    [-1, 1] toward the point `ahead` metres further along the path.

Porting the features:
- The three climb legs and the two switchbacks become **one** `up` trail: `straight(L1)`, then
  `arc(3.5, ±180)`, `straight(L2)`, `arc`, `straight(L3)` to the summit hairpin. The profile is the legs' profiles
  joined, flat through each arc at that switchback's height.
- The descent `D` is the `down` trail.
- Old `dz` becomes `off = dz * dir` (old `dir` +1 rode +x, where +z is the rider's right).
- The paths may bend gently on the legs (arcs of radius 25 m or more) to wind round the hill. Bending is the builder's
  choice within the hill.
- The terrain's `HillShape` is a rounded foothill peaking just above **20 m**. Goat Ladder climbs its gentle face and
  tops out at the **shoulder** (12.1 m).
- The trailhead is a gravel pad at the bottom, with the family car (low-poly, `C.suv`), a split-rail fence and a trail
  sign as solid scenery. `Trailhead` faces up the hill.
- `?place=hill` (read in `src/game/main.ts`, temporary until Task 9) rides this place.

- [ ] **Step 1: Write the failing tests** in `tests/goatLadder.test.ts`:
  - `goatLadder().up.profile.h` is about 12.1, and `down` starts at that height;
  - `up` has exactly 2 arcs of radius 3.5;
  - `buildHill()` has ledges and gravel zones in the same counts as the old course's `climb`, and the same count of
    jump `lines` on the descent;
  - after `createPhysics(buildHill().world)`, `castDown` at 200 points along both trails' centrelines returns
    `surface === 'dirt'` at `trailY` within 0.05.

- [ ] **Step 2: Run** `npx vitest run tests/goatLadder.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `goatLadder`, `placeFeatures`, `buildHill` (Goat only) and `pathSteer`. Then switch both
  robots to `pathSteer` under `PLACE=hill`.

- [ ] **Step 4: Run** the tests, then the robots:
  - `npx vitest run tests/goatLadder.test.ts`: expect PASS.
  - `PLACE=hill npx vite-node checks/climb-robots.ts` and `PLACE=hill npx vite-node checks/downhill-robots.ts`.
  - Expected: every style that finished on the old course finishes. Each style's time is within **±8%** of its old
    time; record both in the task report. If a style misses by more, tighten that section's bends (larger radius)
    before retuning anything.

- [ ] **Step 5: Ride it in the browser.** Headless screenshots from `Trailhead`, mid-climb and `Summit`, saved to the
  scratchpad. They must show trails winding over a hill, with no slab walls and no terrain showing through the trail.
  Ask the user to ride `?place=hill&rider=0&at=Climb` on the iPad.

- [ ] **Step 6: SNAPSHOT "Goat Ladder on curved trails over a real hill"**

---

### Task 6: The whole hill

**Files:**
- Create: `src/world/trails/hairpin.ts`, `src/world/trails/boulderDash.ts` (moved from `src/lab/showcase.ts`)
- Modify: `src/world/places/hill.ts`
- Modify: `checks/showcase-robots.ts`, `checks/ladder-robots.ts`, `checks/trail-edges.ts` (accept `PLACE=hill`, use
  `pathSteer`)
- Test: `tests/hill.test.ts`

**Interfaces:**
- Consumes: Task 5's `TrailFeatures`, `placeFeatures`, `pathSteer`.
- Produces:
  - `hairpin(): { trail: Trail; features: TrailFeatures }` (up and down are the same trail; the down run is ridden in
    reverse)
  - `boulderDash(): { trail: Trail; features: TrailFeatures; rough: TrailZone[] }`
  - `buildHill()` has all hill stations: `Trailhead`, `Climb`, `Summit` (Goat Ladder's top, on the shoulder),
    `Switchbacks`, `Switchbacks top`, `Rock chute` (the summit), `Shoulder` and `Hilltop`. It also has runs for
    `goatUp`, `goatDown`, `goatBoth`, `hairpinUp`, `hairpinDown`, `hairpinBoth` and `boulderDash`, plus rings and zones
    for every hill challenge spot.

The layout:
- The summit (Boulder Dash's start) is at **20 m**.
- Goat Ladder tops out on the shoulder at 12.1 m and Hairpin at 10.7 m, on different faces. A connector trail (dirt, no
  run) climbs from the shoulder to the summit.
- Boulder Dash drops off the steep face, and its long straight runs out onto the flat toward the trailhead.
- Every trail bottom meets at the trailhead pad.
- Hairpin's switchbacks are 180° arcs of radius 2, with the boulder in the middle kept (the `post` with `'rock'`).

- [ ] **Step 1: Write the failing tests** in `tests/hill.test.ts`:
  - **Stations:** `Object.keys(buildHill().stations)` equals the eight names above.
  - **Heights:** `stations['Rock chute'].pos.y` is about 20, `Summit` about 12.1, `Switchbacks top` about 10.7.
  - **Teleport targets:** after physics is built, every station's `pos.y` is within 0.1 of `castDown` there, and its
    yaw points along its trail (`cos(yaw - path.at(u).yaw) > 0.95`).
  - **Run lines in order:** each hill run's start, via and finish lines are crossed forward, in that order, by walking
    its trail's path at 0.2 m steps through `runEvent`. `hairpinDown` walks the trail in reverse. `goatBoth` walks up,
    then down.
  - **Ground everywhere:** `castDown` from 60 m hits something at every 3 m grid point inside the hill's extent.

- [ ] **Step 2: Run** `npx vitest run tests/hill.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** Hairpin and Boulder Dash (profiles and features moved unchanged in `u`), the connector,
  shoulder and summit, and the runs, rings and zones.

- [ ] **Step 4: Run** the tests and the robots:
  - `npx vitest run`: expect PASS.
  - `PLACE=hill npx vite-node checks/showcase-robots.ts`: each Hairpin and Boulder Dash style's time is within ±8% of
    the old one.
  - `PLACE=hill ONLY=goatUp,goatDown,goatBoth,hairpinUp,hairpinDown,hairpinBoth,boulderDash npx vite-node checks/ladder-robots.ts`:
    the 1★-yes, 2★-no rule holds on all 7. Retune star times in `CHALLENGES` only where a curve moved a robot past a
    boundary, and list every change in the task report.

- [ ] **Step 5: SNAPSHOT "The whole Shredder Hills hill"**

---

### Task 7: Trail edges: tall grass and plants instead of rock lines

**Files:**
- Modify: `src/world/physics.ts` (add `'tallgrass'` to `Surface`)
- Modify: `src/lab/bike.ts:596-597` (the drag), `src/lab/tune.ts` (a new `tallGrassDrag` in `T` and `DEFAULTS`),
  `src/view/sound.ts` (a `TIRE` entry for `'tallgrass'`, like grass but louder: `{ freq: 2600, q: 0.5, level: 0.2 }`)
- Modify: `src/world/trail.ts` (`edgeBand(t: Trail, side: -1 | 1, u0: number, u1: number, width = 1.6): THREE.BufferGeometry`,
  a strip beside the trail tagged `'tallgrass'`)
- Modify: `src/lab/course.ts` (`Bushes` becomes `Bumpers`, with the same `update(dt, at)`, built from a list of
  `{ x: number; z: number; r: number; kind: 'yucca' | 'cactus' | 'bush' }`)
- Modify: `src/world/places/hill.ts`, `src/world/trails/*.ts` (remove the rock-line edges except the rock garden and
  the chute; add tall-grass bands; add clumps where an edge must be firm: beside obstacles that could be skipped, and
  outside switchbacks)
- Modify: `checks/ladder-robots.ts` (add the `edge` style)
- Test: `tests/edges.test.ts`

**Interfaces:**
- Consumes: Task 6's hill.
- Produces: `Surface` includes `'tallgrass'`; `T.tallGrassDrag: number`; `edgeBand`; `Bumpers`, with the `Course`
  field `bushes: Bushes` renamed to `bumpers: Bumpers` (`ride.ts` calls `course.bumpers.update`); and the `edge` robot
  style, which follows the trail at `off = ±(width/2 + 1.0)` wherever an obstacle (rock, ledge, gravel, log) is within
  3 m ahead, and rides the centre otherwise.

- [ ] **Step 1: Write the failing tests** in `tests/edges.test.ts`:
  - `castDown` at `trailPoint(t, u, ±(t.width/2 + 0.8))` returns `'tallgrass'` along Goat Ladder up, Hairpin and Boulder
    Dash, except within the rock garden's and the chute's spans.
  - A bike coasting at 6 m/s on flat `'tallgrass'` stops in less than half the distance it takes on `'grass'`. Use
    `stepLab` as `tests/labRide.test.ts` does.

- [ ] **Step 2: Run** `npx vitest run tests/edges.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Start `tallGrassDrag` at 3× `grassDrag`, then let the edge-rider robot set it (Step 4).

- [ ] **Step 4: Run** the edge rider and the rule:
  - `PLACE=hill ONLY=goatUp,goatDown,hairpinUp,hairpinDown,boulderDash npx vite-node checks/ladder-robots.ts`.
  - Expected: the `edge` style never beats 2★ on any of them, and the 1★/2★ rule still holds.
  - If the edge rider beats 2★ anywhere, raise `tallGrassDrag` or add a clump at that spot, then rerun. Report the
    final value.

- [ ] **Step 5: SNAPSHOT "Grass and plant trail edges; edge rider can't beat 2★"**

---

### Task 8: The jump park

**Files:**
- Create: `src/world/places/park.ts`. It moves the jump lanes, `JUMPS` use, the pump track, the planks, the slalom,
  Whoop-de-Doo (`RHYTHM`) and Jumps XL (`XL_LANE`) out of `src/lab/course.ts` and `src/lab/showcase.ts`. Their
  constants (`PUMP_TRACK`, `PLANKS`, `SLALOM`, `RHYTHM`, `XL_LANE`, the lane offsets) are re-exported from here with
  new positions.
- Modify: `src/game/spots.ts` (`lapEvent` and `createPlankWatch` import from `park.ts`)
- Modify: `checks/jump-lanes.ts`, `checks/pump-laps.ts`, `checks/slalom.ts`, `checks/showcase-robots.ts` (Whoop and
  XL), `checks/ladder-robots.ts` (accept `PLACE=park`)
- Test: `tests/park.test.ts`

**Interfaces:**
- Consumes: Task 3's `Course` fields; `berm`, `tabletop`, `extrude` from `src/lab/course.ts`.
- Produces: `buildPark(): Course`, with:
  - `place: 'mesaJumpPark'` and `home: 'Park lot'`;
  - stations `Park lot`, `Jumps S`, `Jumps M`, `Jumps L`, `Jumps XL`, `Rhythm`, `Pump track`, `Slalom`, `Skinny` and
    `Start hill`;
  - rings and zones for every park challenge spot; `coast` zones (boxes) for the pump track and Whoop-de-Doo.

The layout:
- A start hill with a roll-in at one end. The four Table Row lanes drop off it side by side, and Whoop-de-Doo's roll-in
  comes off it too.
- Berms at the lanes' far end turn into Whoop-de-Doo, and its run-out berms into the Pump House entrance.
- The Plank and Cone Zone sit on flat ground by a gravel lot with the car and a fence.
- Each feature's own geometry and run-up length is unchanged: the same profiles, the same distances from ring to first
  lip.
- Dirt paths over golden grass connect everything into one ride-round loop.

- [ ] **Step 1: Write the failing tests** in `tests/park.test.ts`:
  - **Stations:** `Object.keys(buildPark().stations)` equals the ten names above.
  - **Run-ups:** for each lane, the distance from its station to its first `Line.lip` equals the old course's within
    0.01 m.
  - **Plank watch:** the plank watch reports `'on'` then `'end'` when walked along `PLANKS[0]`.
  - **Lap line:** `lapEvent` reports `'start'` then `'check'` for a lap walked along the pump track.

- [ ] **Step 2: Run** `npx vitest run tests/park.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `buildPark`.** No scenery yet beyond golden ground.

- [ ] **Step 4: Run** the tests and the robots:
  - `npx vitest run`: expect PASS.
  - `PLACE=park npx vite-node checks/jump-lanes.ts`, `checks/pump-laps.ts`, `checks/slalom.ts`: results identical to
    the old park's (same features, same run-ups).
  - `PLACE=park ONLY=tableSmall,tableMedium,tableBig,tableXL,whoop,pumpHouse,coneZone,plank npx vite-node checks/ladder-robots.ts`:
    the rule holds on 7 of 8 (Cone Zone, as before).

- [ ] **Step 5: SNAPSHOT "Mesa Jump Park on one flow line"**

---

### Task 9: Two places in the game; the old park goes

**Files:**
- Create: `src/world/places/index.ts`
- Modify: `src/lab/ride.ts` (`RideOptions.place: string`; `createRide` calls `buildPlace(o.place)`)
- Modify: `src/game/main.ts`:
  - `AREA` comes from the ride's place;
  - `startAt` resolves through `homeFor`;
  - remove `?place=`;
  - `go=<id>` picks the challenge's place.
- Modify: `src/lab/course.ts` (delete `buildCourse` and everything only it used: the street, old kickers, old hill,
  pump section, bump walls and their bush spots, lollipop trees, flat slab. Keep the shared helpers, the `Bumpers`
  type from Task 7, and: `Profile`, `heightAt`,
  `extrude`, `berm`, `tabletop`, `slab`, `mesh`, `post`, `rock`, `rockGeo`, `lipBar`, `JUMPS`, `V`, `DIRT` and the
  types)
- Delete: `src/lab/showcase.ts` (its pieces now live in `src/world/trails/` and `park.ts`)
- Modify: every `checks/*.ts`, `checks/*.mjs` and `tests/*.ts` that called `buildCourse()` (use `buildPlace`; drop the
  `PLACE` switches, since each check picks its place by what it tests)
- Test: `tests/places.test.ts`

**Interfaces:**
- Consumes: `buildHill` and `buildPark`.
- Produces:
  - `type PlaceId = 'shredderHills' | 'mesaJumpPark'`
  - `buildPlace(id: PlaceId): Course`
  - `PLACE_STATIONS: Record<PlaceId, string[]>`, pure data matching each builder's station keys
  - `placeOfStation(key: string): PlaceId | null`
  - `homeFor(key: string | null): { place: PlaceId; station: string }`. A known station gives its place. An unknown or
    old key (`Street`, `U-turn`, `Hill top`, `Old kickers`, ...) or null gives `{ place: 'shredderHills', station: 'Trailhead' }`.

- [ ] **Step 1: Write the failing tests** in `tests/places.test.ts`:
  - **Matching data:** for each place, `Object.keys(buildPlace(id).stations).sort()` equals
    `[...PLACE_STATIONS[id]].sort()`.
  - **Unique stations:** no station key is in both places.
  - **Spots:** every `CHALLENGES[].spot` is in exactly one place.
  - **Old keys:** `homeFor('Street')` and `homeFor('Hill top')` both equal
    `{ place: 'shredderHills', station: 'Trailhead' }`; `homeFor('Jumps M')` equals
    `{ place: 'mesaJumpPark', station: 'Jumps M' }`.

- [ ] **Step 2: Run** `npx vitest run tests/places.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**, then delete the old park.

- [ ] **Step 4: Run** the tests, type check and browser check:
  - `npx vitest run` and `npx tsc --noEmit -p .`: expect PASS and no output.
  - Then `node checks/game.mjs` and `node checks/hub.mjs`, updated to visit both places through `go=` and `at=`. Expect
    no failures.

- [ ] **Step 5: SNAPSHOT "Two places; the old test park is gone"**

---

### Task 10: The map, the place sheets and locks

**Files:**
- Modify: `src/game/areas.ts`:
  - `AREAS` gets a second entry: `{ id: 'mesaJumpPark', name: 'Mesa Jump Park', symbol: 'green', map: { x: <open ground near Shredder Hills>, y: <...> }, challenges: [...the 8 park ids] }`.
  - Shredder Hills keeps the 7 hill ids.
  - `PLACE_NAMES` adds `Trailhead: 'Trailhead'`, `Shoulder: 'The shoulder'`, `Hilltop: 'The summit'`,
    `'Park lot': 'Park lot'` and `'Start hill': 'Start hill'`, and drops `Street`.
- Modify: `src/game/challenges.ts:78-82` (`starsFor` returns `totalStars(p)`) and line ~136 (the lock text becomes
  `` `Ride ${n.stars} ★` ``)
- Modify: `src/game/hub/map.ts` (`placeName` drops the `Street` → `Start` special case; the sheet's Just Ride buttons
  list only that place's stations)
- Modify: `tests/areas.test.ts`, `tests/challenges.test.ts`, `tests/targets.test.ts:95`, `tests/pacing.test.ts:25`
  (use `AREAS.flatMap((a) => a.challenges)` wherever they meant "all challenges")
- Test: `tests/areas.test.ts`, `tests/progress.test.ts`

**Interfaces:**
- Consumes: Task 9's `PLACE_STATIONS`.
- Produces: two `AREAS`; lock behaviour unchanged in effect.

- [ ] **Step 1: Write the failing tests:**
  - `AREAS.map((a) => a.name)` equals `['Shredder Hills', 'Mesa Jump Park']`.
  - Every challenge is in exactly one area, and each area's challenges' spots are in that place's `PLACE_STATIONS`.
  - **Old save** (Review Focus 5): a profile with known stars on all 15 challenges (built with `newProfile` and set
    `stars`). `areaStars` over both areas sums to the old single-area total. `canStart` gives the same answer for every
    challenge as before the change; take the expected values from running the test on the Task 9 snapshot.
  - `lockText` for `tableMedium` with 1 star total is `'Ride 2 ★'`.

- [ ] **Step 2: Run** `npx vitest run tests/areas.test.ts tests/progress.test.ts tests/challenges.test.ts`. Expected:
  FAIL.

- [ ] **Step 3: Implement.** Pick the pin's fractions by looking at `public/map/colorado.png`: on open grass beside the
  mesas, not overlapping Shredder Hills' pin.

- [ ] **Step 4: Run** `npx vitest run`, then `node checks/hub.mjs`. Expected: PASS, with both pins opening their
  sheets.

- [ ] **Step 5: SNAPSHOT "Two places on the map; locks count all stars"**

---

### Task 11: The look, made permanent

**Files:**
- Create: `src/look/scenery.ts` (from `src/look/foothills.ts`)
- Delete: `src/look/foothills.ts`; the `scenery` option and `?look` handling in `src/lab/ride.ts` and
  `src/game/main.ts`
- Modify: `src/lab/course.ts` (`Course.scenery: SceneryPlan`), `src/world/places/hill.ts`, `src/world/places/park.ts`
  (fill it)
- Test: `tests/scenery.test.ts`

**Interfaces:**
- Consumes: `Course.trails`, `Course.world`.
- Produces:
  - `interface SceneryPlan { seed: number; extent: { x0: number; x1: number; z0: number; z1: number }; clearance(x: number, z: number): number; towns: { x: number; z: number }[]; groves: { x: number; z: number; r: number; n: number }[]; ground(x: number, z: number): number }`.
    `clearance` is the metres to the nearest thing that must stay clear: a trail edge, a lip, a station, a ring, a
    feature footprint. `ground` is the height at (x, z) inside the extent: the terrain's `heightAt`, or 0 in the park.
  - `createScenery(look: Look, course: Course): { update(dt: number, at: THREE.Vector3): void }`, called by
    `createRide` before `createPhysics`.

What it keeps from the look test:
- The baked backdrop: `SPAN = 80°`, `SQUASH = 0.8`, `R_BACK = 640`, base at y −6, loaded from
  `/backdrop/baked/info.json`.
- The rolling land past the extent, with the far rim low within ±72°–100° of +x.
- `SUN_OFFSET (-78, 42, 40)`, sun colour `0xffd29a`, `Fog(0xeee2cf, 150, 1000)`, hemisphere ground `0x9c8a55`,
  lawn → `0xc8b76c`.
- The instanced pines, swaying tufts, yucca, prickly pear and boulders; prairie dogs that duck within 14 m; the hawk.

What changes:
- Placement uses `clearance`: tufts need 2 m or more, pines and boulders 6 m or more, prairie dog mounds 4 m or more.
- Towns and groves come from the plan.
- Solid pines and boulders inside the extent get real colliders: a trunk cylinder and a boulder hull, tagged `'wall'`.
  The look test used invisible cylinders.

- [ ] **Step 1: Write the failing tests** in `tests/scenery.test.ts`. Call `createScenery` with a stub `Look`: a
  `THREE.Scene` and a sun, with `renderer.capabilities.getMaxAnisotropy` returning 1. Stub `fetch` to reject, so the
  backdrop falls back. Then, for both places:
  - no pine, boulder, yucca or cactus instance has `clearance < 2` (read the instance matrices back);
  - every prairie dog mound is within 25 m of a town in the plan;
  - colliders were added for every pine and boulder inside the extent.

- [ ] **Step 2: Run** `npx vitest run tests/scenery.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**, then delete `foothills.ts` and the flag.

- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit -p .`. Then take headless screenshots with `&debug` from
  `Trailhead`, `Hilltop` (facing west, then turned ±1.5 rad), `Shoulder`, `Park lot` and `Start hill`. Read off the
  triangles and draw calls in each place. Expected: tests PASS, and each place is at or under **650k triangles and
  90 draw calls**.

- [ ] **Step 5: SNAPSHOT "Foothills scenery in both places"**

---

### Task 12: Full verification and handoff

**Files:**
- Modify: `docs/handoff-2026-11-01.md` (a "Nov 7: first area redesign" section: the two places, the trail tool, the
  bake script, star-time changes, the edge-rider drag value, and what to playtest)
- Modify: `public/backdrop/README.md` (drop "look test" wording: the backdrop is live)

- [ ] **Step 1: Run the whole ladder:** `npx vite-node checks/ladder-robots.ts`. Expected: the rule holds on at least
  14 of 15, the edge rider never beats 2★, and the hop-chain guard styles score nothing on flat ground.
- [ ] **Step 2: Run every robot check and browser check:** the `checks/*.ts` robots and `node checks/game.mjs`,
  `node checks/hub.mjs`, `node checks/bike-swap.mjs`, `node checks/lab-tricks.mjs`, `node checks/energy.mjs`. Expected:
  no failures.
- [ ] **Step 3: Run** `npx vitest run` and `npx tsc --noEmit -p .`. Expected: PASS and no output.
- [ ] **Step 4: Write the handoff section.** Ask the user to measure both places on the iPad with `&debug` (fps, draw
  calls, triangles, resolution) and to playtest with the boys.
- [ ] **Step 5: SNAPSHOT "First area redesign: verified, handoff written"**
