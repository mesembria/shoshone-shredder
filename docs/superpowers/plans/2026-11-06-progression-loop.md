# Progression loop, first slice: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the game on a Colorado map; ride Shredder Hills' named trails and park on a starter hardtail; earn cogs;
spend them in a shop on parts (locked to one bike) and new bikes; admire and fit them in a garage with a 360° stand.

**Architecture:** Bikes, parts and stats are data (`src/game/catalog.ts`, `src/game/stats.ts`) that turn into a
`Loadout` (a `BikeSpec` plus ride settings) the existing ride engine already understands, so the engine gets no bike or
part logic. The page becomes two modes in one HTML file: the **hub** (Who's riding → map → area list, garage, shop;
DOM plus one small three.js canvas for the stand) and the **ride** (today's `createRide`). Moving between them is a page
navigation (`?rider=0` for the hub, `?rider=0&go=<challengeId>` or `&at=<station>` to ride), so each mode starts clean
and only one big WebGL scene ever exists. Tune leaves the page (kept behind `?tune=1` for development).

**Tech Stack:** TypeScript 5.6, three.js 0.170, Rapier 0.14 (compat), Vite 5.4, Vitest 2.1. Robots:
`npx vite-node checks/<file>.ts`. Browser checks: `node checks/<file>.mjs [folder]` against `http://127.0.0.1:5173`.

**Spec:** `docs/superpowers/specs/2026-11-06-progression-loop-design.md`

## Global Constraints

- iPad Safari, landscape, touch first; nothing below 44 px to tap. Chunky toy look: cream panels `#fff8e8`, yellow
  buttons `#ffd84a`, text `#2f3d2e` (as in the mockups).
- No new dependencies.
- No logic in `src/lab/` may branch on a bike id or part id: bikes and parts reach the engine only as settings
  (`T`) and a `BikeSpec`.
- The currency is **cogs** everywhere in copy and code (`cogs`, never `bolts`); its icon is "⚙" (not 🔩).
- Copy for kids: short, plain, no jargon in sentences; real spec numbers only on the spec sheet and part cards.
- Names (spec): area **Shredder Hills**; starter **Hand-me-down Hardtail**; trails **Goat Ladder** (↑ ↓ ↕),
  **Hairpin Hollow** (↑ ↓ ↕), **Boulder Dash** (↓); park **Whoop-de-Doo**, **Table Row** (Small, Medium, Big, XL),
  **The Pump House**, **Cone Zone**, **The Plank**.
- Slots, fixed: **Suspension, Tires, Brakes, Cockpit, Drivetrain.**
- Stats: **Trail:** Climb, Speed · **Downhill:** Grip, Stop, Stable, Plow · **Park:** Pop, Flick. 0–10 each.
- Both riders start fresh on the hardtail with 0 cogs. `?bike=<id>` rides any bike without saving (as today).
- Tune is not reachable without `?tune=1`. Saved Tune values never apply to a ride without `?tune=1`.
- Not a git repo: commit steps are replaced by a ledger line (`Task N: complete (tests: … → …)`).

## Review Focus

1. **An old (v1) or corrupt save** loads as two fresh riders keeping their names, never a crash or a blank map (Task 4
   test "loads a v1 save as fresh riders with their names").
2. **Buying twice, or with too few cogs** (a double tap on Buy) never charges twice or goes negative (Task 4 test
   "buying is idempotent and never overdraws").
3. **A saved `riding` bike that isn't owned, or an unknown part id** in the save falls back to the hardtail / stock
   part instead of breaking the ride (Task 4 test "a broken loadout falls back to stock").
4. **Swapping bikes mid-challenge** to one that fails the challenge's lock: locks gate starting only; the run carries
   on and pays (Task 5 test "locks gate starting, not finishing").
5. **Leaving for the map mid-run** pays nothing and saves nothing half-done; `?bike=` rides never touch the save (Task 9
   browser check lines).

---

### Task 1: The Hand-me-down Hardtail

**Files:**
- Modify: `src/lab/bikes.ts` (add `hardtail` to `LabBikeId`, `LAB_BIKES`, `LAB_ORDER` first, `BIKE_RIDE`)
- Test: `tests/labBikes.test.ts` (add a `describe('hardtail')`)

**Interfaces:**
- Produces: `LabBikeId = 'hardtail' | 'dirtjumper' | 'enduro' | 'bolinas'`; `LAB_BIKES.hardtail: BikeSpec` named
  `'Hand-me-down Hardtail'`, a plain hardtail frame (`fork: 'plain'`, `shock: false`), dull color `0x7d8a96`,
  `wheelRadius` between the dirt jumper's and the Bolinas's.

- [ ] **Step 1: Write the failing tests** — "the hardtail does everything a little worse than the bike built for it":

```ts
const r = (id: LabBikeId, k: TuneKey) => BIKE_RIDE[id][k] ?? DEFAULTS[k];
expect(r('hardtail', 'legs')).toBeLessThan(r('bolinas', 'legs'));
expect(r('hardtail', 'energyCost')).toBeGreaterThan(r('bolinas', 'energyCost'));
expect(r('hardtail', 'wobbleSpeed')).toBeLessThan(r('bolinas', 'wobbleSpeed'));
expect(r('hardtail', 'wobbleKick')).toBeGreaterThan(r('bolinas', 'wobbleKick'));
expect(r('hardtail', 'plowSize')).toBe(0);
expect(r('hardtail', 'hopFull')).toBeLessThan(r('dirtjumper', 'hopFull'));
expect(LAB_BIKES.hardtail.spin).toBeLessThan(LAB_BIKES.bolinas.spin);
expect(LAB_BIKES.hardtail.spin).toBeGreaterThan(LAB_BIKES.enduro.spin);
```
  and "every lab bike stands on the ground" in `tests/rider.test.ts` already loops `LAB_ORDER`, so it covers the
  new frame.

- [ ] **Step 2:** `rtk proxy npx vitest run tests/labBikes.test.ts` → FAIL (`hardtail` missing).
- [ ] **Step 3:** Add the bike. Numbers are yours within the test; it must still clear 1★ on Goat Ladder ↑/↓ and Table
  Row Small (checked in Task 12).
- [ ] **Step 4:** `npm run check && npm test` → PASS (fix any `Record<LabBikeId, …>` that now needs a hardtail entry,
  e.g. `SHORT` in `main.ts`).
- [ ] **Step 5:** Ledger line.

### Task 2: Parts catalog and loadouts

**Files:**
- Create: `src/game/catalog.ts`
- Delete: `src/game/parts.ts` and `tests/parts.test.ts` (old frame/fork/tires/pedals tiers); remove its imports.
- Test: `tests/catalog.test.ts`

**Interfaces:**
- Consumes: `LabBikeId`, `LAB_BIKES`, `BIKE_RIDE`, `DEFAULTS`, `TuneKey`.
- Produces:
```ts
export type Slot = 'suspension' | 'tires' | 'brakes' | 'cockpit' | 'drivetrain';
export const SLOTS: Slot[];                       // in that order
export interface PartDef {
  id: string; bike: LabBikeId; slot: Slot; name: string; spec: string; // spec: "Air fork · 120 mm"
  price: number; stock?: true;                   // exactly one stock part per bike per slot
  ride: Partial<Record<TuneKey, number>>;        // ADDED to the bike's base value
  spin?: number; headAngle?: number; weight?: number; // added to the BikeSpec spin, the sheet's head angle (deg), kg
  does: string;                                  // one kid sentence: "Calmer on rough downhills, a bit slower up switchbacks"
}
export const PARTS: PartDef[];
export const SLOT_KEYS: Record<Slot, TuneKey[]>; // keys a part in that slot may touch
export interface BikeSheet { type: string; price: number; wheels: string; headAngle: number; wheelbase: number; reach: number; weight: number }
export const SHEETS: Record<LabBikeId, BikeSheet>;
export type Fitted = Record<Slot, string>;        // part id per slot
export interface Loadout { bike: LabBikeId; spec: BikeSpec; tune: Record<TuneKey, number>; sheet: BikeSheet; fitted: Fitted }
export function stockFitted(bike: LabBikeId): Fitted;
export function loadout(bike: LabBikeId, fitted: Partial<Fitted>, color?: number): Loadout; // unknown/foreign ids → stock
export function applyLoadout(l: Loadout, t?: Record<TuneKey, number>): void;              // sets RIDE_KEYS ∪ part keys
export function partsFor(bike: LabBikeId, slot?: Slot): PartDef[];
```

`SLOT_KEYS` (spec): suspension `wobbleKick, wobbleSpeed, plowSize, popSoak, flatKeep, rockCrash`; tires `grip,
bermGrip, looseLimit, looseDrag, rolling, rollUp, wobbleKick` (+ `spin` via `PartDef.spin` for lighter wheels);
brakes `brake, skidDecel`; cockpit `wobbleSpeed, steerResponse, minRadius`; drivetrain `legs, energyCost, gearTop,
gearBog, sprint, pedalAccel`.

Starting parts (few, per spec; numbers yours, directions fixed):
- **Hardtail:** stock in every slot, plus one upgrade each: Air fork 120 mm (kick −, wobble speed +, head angle −1°),
  Sticky 2.4 in (grip, berm grip, gravel +, rolling +), Hydraulic brakes (brake +), 760 mm bars (wobble speed +, steer
  response −), 1 × 11 (legs +, energy cost −).
- **Dirt Jumper:** Big gear vs Small gear (gear top + / pickup −, and the reverse), Fast tires (rolling −, grip −).
- **Enduro:** Coil vs Air shock (plow + soak +, vs pop + plow −), Light wheels (spin +, soak −), 4-piston brakes.
- **Bolinas:** Long 140 mm fork vs Short 120 mm (stable + turns wider, vs the reverse), Sticky tires.

Sheet values (spec, display): hardtail Hardtail · 27.5" · 68° · 1130 mm · 420 mm · 15.5 kg; Bolinas Trail bike · 29"
· 66.5° · 1180 · 450 · 13.1; Dirt Jumper · 26" · 69° · 1050 · 400 · 12.0; Enduro · 29" · 64° · 1260 · 480 · 15.0.
Bike prices: Task 4 sets them.

- [ ] **Step 1: Write the failing tests:**
  - "every bike has exactly one stock part per slot"
  - "a part only touches its slot's keys and belongs to one bike"
  - "the stock loadout rides exactly as the bike does today": for each bike,
    `applyLoadout(loadout(b, stockFitted(b)), t)` gives `t[k] === (BIKE_RIDE[b][k] ?? DEFAULTS[k])` for every
    `k` in `RIDE_KEYS`, and `spec.spin === LAB_BIKES[b].spin`.
  - "sticky tires grip more and roll slower; fast tires the reverse"; "better brakes stop harder"; "the long fork
    slackens the head angle a degree".
  - "geometry and ride agree": across the four stock bikes, a slacker `headAngle` never has a lower `wobbleSpeed`,
    a smaller `minRadius` or a higher `spin` than a steeper one (ties allowed).
  - "the strongest brakes are grabby": the enduro's 4-piston brakes raise `brake` the most and also move `skidDecel`.
  - "a part for another bike, or an unknown id, fits as stock" (Review Focus 3).
  - "a color paints the spec's frame" (`loadout(b, f, 0xff0000).spec.frameColor === 0xff0000`).
- [ ] **Step 2:** `rtk proxy npx vitest run tests/catalog.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `catalog.ts`. `loadout` adds part deltas to the base (`BIKE_RIDE[b][k] ?? DEFAULTS[k]`).
- [ ] **Step 4:** `npm run check && npm test` → PASS.
- [ ] **Step 5:** Ledger line.

### Task 3: Stats

**Files:**
- Create: `src/game/stats.ts`
- Test: `tests/stats.test.ts`

**Interfaces:**
- Consumes: `Loadout` (Task 2).
- Produces:
```ts
export type Stat = 'climb' | 'speed' | 'grip' | 'stop' | 'stable' | 'plow' | 'pop' | 'flick';
export const STAT_GROUPS: { name: 'Trail' | 'Downhill' | 'Park'; stats: Stat[] }[];
export const STAT_NAMES: Record<Stat, string>;     // 'Climb' … 'Flick'
export function statsFor(l: Loadout): Record<Stat, number>; // each 0..10, one decimal
```
Each stat is a fixed formula of `l.tune` / `l.spec.spin` (climb: legs, energyCost, gearBog; speed: sprint, maxSpeed,
gearTop, rolling; grip: grip, bermGrip, looseLimit; stop: brake; stable: wobbleSpeed, wobbleKick, steerResponse; plow:
plowSize, popSoak, rockCrash; pop: hopFull, lipPop, popSoak; flick: spin). Scales are yours.

- [ ] **Step 1: Write the failing tests** (stock loadouts unless noted):
  - every value within 0..10;
  - `flick`: dirtjumper > bolinas > hardtail > enduro; `plow`: enduro highest; `climb`: bolinas highest, dirtjumper
    lowest; `stable`: enduro highest, dirtjumper lowest; `pop`: dirtjumper highest;
  - the hardtail is below the Bolinas on climb and stable;
  - sticky tires raise grip and lower speed; hydraulic brakes raise stop; nothing else moves for a part that touches
    only one key family.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** `npm test` → PASS. **Step 5:** Ledger line.

### Task 4: Save v2, cogs and buying

**Files:**
- Modify (rewrite): `src/game/progress.ts`
- Test: `tests/progress.test.ts` (replace the bolts/parts tests)

**Interfaces:**
- Consumes: catalog (Task 2), `ChallengeDef` (Task 5 adds fields; this task uses `id` only).
- Produces:
```ts
export interface OwnedBike { parts: string[]; fitted: Fitted; color: number }
export interface Profile { name: string; cogs: number; riding: LabBikeId; bikes: Partial<Record<LabBikeId, OwnedBike>>; stars: Record<string, number>; paid: Record<string, number> }
export interface SaveGame { version: 2; riders: Profile[] }
export const SAVE_KEY = 'shredder-save';
export const PAY = { tiers: [20, 45, 110], repeatShare: 0.2 }; // starting numbers; Task 12 may retune
export const PAINTS: number[];                                    // 8 basic colors, free; [0] per bike = its own color
export function newProfile(name: string): Profile;                // hardtail, stock, 0 cogs
export function loadGame(store: Store): SaveGame;                 // v1/corrupt → fresh riders, names kept
export function saveGame(store: Store, g: SaveGame): void;
export function loadoutOf(p: Profile, bike?: LabBikeId): Loadout; // riding bike by default; not owned → hardtail
export function payFor(p: Profile, challengeId: string, stars: number): { profile: Profile; cogs: number; newStars: number };
export function buyBike(p: Profile, bike: LabBikeId): Profile | null;   // null: owned already or too few cogs
export function buyPart(p: Profile, partId: string): Profile | null;    // null: bike not owned, owned already, too few cogs, stock part
export function fitPart(p: Profile, partId: string): Profile | null;    // must own it; replaces that slot
export function paint(p: Profile, bike: LabBikeId, color: number): Profile | null;
export function rideBike(p: Profile, bike: LabBikeId): Profile | null;
```
Pay rule: each new star tier pays `PAY.tiers[tier-1]` once (going 0 → 3★ in one run pays all three); a run that
finishes with no new star pays `round(PAY.tiers[0] * PAY.repeatShare)`; `paid[id]` counts payouts. Failing pays 0.

- [ ] **Step 1: Write the failing tests:**
  - "a new rider has the hardtail, stock, 0 cogs"
  - "loads a v1 save as fresh riders with their names" (Review Focus 1): a v1 JSON with `bolts: 900`, `parts`, `stars`
    → `cogs 0`, only the hardtail, `stars {}`, names kept; garbage JSON → `Rider 1`, `Rider 2`.
  - "a broken loadout falls back to stock" (Review Focus 3): `riding: 'enduro'` not owned → `loadoutOf` is the
    hardtail; a fitted id that isn't owned or doesn't exist → stock in that slot.
  - "pays each new star once, a little for repeats": 0→1★ pays 20; 1★→3★ pays 45+110; another 3★ pays 4.
  - "buying is idempotent and never overdraws" (Review Focus 2): `buyPart` with cogs = price − 1 → null; buying
    twice → second null, cogs charged once; buying a part for an unowned bike → null.
  - "parts are locked to their bike": `fitPart` with another bike's part → null.
  - "unknown parts survive a save": a v2 save whose `parts` holds `'retiredFork'` loads and saves back with it still
    there (spec: the save keeps unknown parts harmlessly), while `loadoutOf` treats it as absent.
  - Remove `boltsForBank`, `learn`, `meets`, `missing`, `needText`, `fill`: banked combos no longer pay, and locks
    move to `challenges.ts` (Task 5). `unlocks.ts`'s `airHints()` stays as is.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** `npm run check && npm test` → PASS (fix
  `main.ts` compile errors minimally; the page is reworked in Tasks 8–9).
- [ ] **Step 5:** Ledger line.

### Task 5: Challenges, the area, and the new runs

**Files:**
- Modify: `src/game/challenges.ts` (new list, `group`, `via` on runs, `Need` rewrite)
- Create: `src/game/areas.ts`
- Modify: `src/game/spots.ts` (zones/rings for the new spots, `runEvent` via), `src/lab/showcase.ts` or
  `src/lab/course.ts` (run lines for Goat Ladder ↑ ↓ ↕ and Hairpin Hollow ↓ ↕), `Course['runs']` type gains
  `via?: Gate`.
- Test: `tests/challenges.test.ts`, `tests/spots.test.ts`, `tests/areas.test.ts`

**Interfaces:**
- Produces:
```ts
export type Group = 'trail' | 'downhill' | 'park';
export interface Need { stars?: number; stat?: [Stat, number]; bike?: LabBikeId[]; cleared?: string[]; hint?: string }
export interface ChallengeDef { id: string; name: string; group: Group; spot: string; tell: string; goal: Goal; need?: Need }
// run goal: { kind: 'run'; times: [limit, two, three] } and Tick.run gains 'via'; finish counts only after via when the run has one
export function canStart(p: Profile, def: ChallengeDef, l: Loadout): boolean;
export function lockText(p: Profile, def: ChallengeDef, l: Loadout): string | null; // "Needs Pop 5 · try the Dirt Jumper"
// areas.ts
export interface AreaDef { id: string; name: string; symbol: 'green' | 'blue' | 'black'; map: { x: number; y: number }; challenges: string[] }
export const AREAS: AreaDef[];                     // one: Shredder Hills
export const PLACE_NAMES: Record<string, string>;  // spot/station key → display name ('Jumps S' → 'Table Row Small')
export function areaStars(p: Profile, a: AreaDef): number;
```
The list (ids fixed; times/points start from today's or a first guess, Task 12 calibrates):

| id | name | group | spot | need |
|---|---|---|---|---|
| goatUp | Goat Ladder ↑ | trail | Goat Ladder (bottom of today's climb) | — |
| goatDown | Goat Ladder ↓ | downhill | Goat Ladder top (Summit) | — |
| tableSmall | Table Row Small | park | Jumps S | — |
| goatBoth | Goat Ladder ↕ | trail | Goat Ladder | cleared goatUp, goatDown |
| hairpinUp / hairpinDown / hairpinBoth | Hairpin Hollow ↑ ↓ ↕ | trail / downhill / trail | Switchbacks bottom / top | stars 3; ↕ cleared ↑ ↓ |
| boulderDash | Boulder Dash | downhill | Rock chute | stars 4, stat stable ≥ (Task 12) |
| tableMedium, tableBig, tableXL | Table Row Medium / Big / XL | park | Jumps M / L / XL | stars 2 / 5 / stat pop ≥ |
| whoop | Whoop-de-Doo | park | Rhythm | stars 4, stat pop ≥ |
| pumpHouse | The Pump House | park | Pump track | stars 2 |
| coneZone | Cone Zone | park | Slalom | stars 1 |
| plank | The Plank | park | Skinny | stars 2 |

The old `hillLine` and lesson challenges are dropped (their terrain stays for Just ride).

Ruling (plan): the spec's "a part tier on the bike you're riding" becomes `stat`: parts no longer have tiers, and a
stat threshold is met by either the right part or the right bike, which is what the lock text promises ("Needs Pop 5 ·
try the Dirt Jumper"). `lockText` names the matching bike or the owned bike's part that meets it.

- [ ] **Step 1: Write the failing tests:**
  - "a fresh rider can start exactly Goat Ladder ↑, Goat Ladder ↓ and Table Row Small"
  - "a ↕ run opens once its ↑ and ↓ are cleared"
  - "a stat lock opens with the right bike or part": fresh hardtail can't start `tableXL`; the same profile on a
    dirt-jumper loadout can.
  - "locks gate starting, not finishing" (Review Focus 4): `tick` never reads the profile; a run started then
    finished on a bike that fails the need still returns `done` with stars.
  - "a both-ways run needs the top before the finish counts": `run` goal with `via` → `finish` before `via` keeps
    running; `via` then `finish` → done.
  - `runEvent` returns `'via'` crossing the via line forward; every challenge's `spot` has a `ZONES` and `RINGS`
    entry (and a start ring at the top for ↓ runs).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement; place run lines across the trail at the climb's bottom and
  summit, and Hairpin Hollow's two ends, facing the riding direction (`across()` in `showcase.ts`).
- [ ] **Step 4:** `npm run check && npm test` → PASS. **Step 5:** Ledger line.

### Task 6: Downhill speed boost

**Files:**
- Modify: `src/lab/tune.ts` (`trickBoost: 0` m/s, `trickBoostTime: 0.6` s, rows in the Bike rules group),
  `src/lab/bike.ts` (`LabState.boost: number`; set on a clean landing after an air that completed a trick or move;
  adds `trickBoost` × scale to the pedal push while `boost > 0`)
- Test: `tests/labRide.test.ts`

**Interfaces:**
- Produces: `T.trickBoost` (0 = off), `T.trickBoostTime`; `LabState.boost` (seconds left). Bigger tricks boost more:
  scale = `min(1, airPoints / 400)` (yours to adjust).

- [ ] **Step 1: Write the failing tests** (on the kicker yard): "a clean landing with a trick gives a short burst of
  speed" (trickBoost 3: speed 0.3 s after landing > the same landing with no trick by ≥ 1 m/s; after
  trickBoostTime + 0.5 s the difference is < 0.3 m/s); "the boost can carry you past sprint speed" (peak
  speed > `T.sprint` on flat ground with trickBoost 3); "trickBoost 0 changes nothing"; "a bobble or crash gives no
  boost".
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** `npm test` → PASS. **Step 5:** Ledger line.

### Task 7: The stand rig (rider beside the bars, color, slot anchors)

**Files:**
- Modify: `src/bike/rider.ts`
- Test: `tests/rider.test.ts`

**Interfaces:**
- Produces: `createRider(bike: BikeSpec, opts?: { rider?: boolean })` (default true; `false` builds the bike alone);
  `RiderRig.setColor(color: number): void`; `RiderRig.setRiderVisible(v: boolean): void`; `RiderRig.standPose():
  void` (the stopped pose, foot down, as when `resting` is true in the game: the rider astride the bike with one shoe
  on the floor, bike leaning a little); `RiderRig.anchors(): Record<'fork' | 'frontTire' | 'rearHub' | 'bars' |
  'cranks', THREE.Object3D>` (markers parented to the bike's parts, so they follow lean and spin; read with
  `getWorldPosition`). `src/bike/` does not import `src/game/`: Task 10 maps slots to anchors.

Ruling (user, Nov 6): the garage shows the rider with the bike, so the rider's gear can be shown off later (the gear
project dresses this same rig). The rider stands astride the bike with a foot down rather than beside it: it reuses the
rig's own stopped pose (no new skeleton), and keeps the whole rider and the whole bike in one view.

- [ ] **Step 1: Write the failing tests:** "the stand pose puts a shoe on the floor and keeps both wheels on it" (for
  every bike, after `standPose()`: lowest shoe within ±0.04 of the wheels' lowest point); "a rig without a rider has
  no rider meshes" (bounding box top below the bars + 0.1); "setRiderVisible(false) hides the rider and nothing of the
  bike"; "setColor repaints the frame"; "anchors sit on the bike" (each inside the bike's bounding box, all five
  distinct, and still inside it after `standPose()` leans the bike).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** `npm test` → PASS. **Step 5:** Ledger line.

### Task 8: Hub: Who's riding, the map, the area list

**Files:**
- Create: `src/game/hub/map.ts`, `src/game/hub/hub.css`, `public/map/README.md` (where `colorado.png` goes and the
  Nano Banana prompt from the spec)
- Modify: `src/game/main.ts` (split into `startHub(index)` and `startRide(index, opts)`), `play.html` if it needs a
  hub container
- Test: `checks/hub.mjs` (new browser check)

**Interfaces:**
- Consumes: Tasks 2, 4, 5.
- Produces: URL contract: `/play.html` → Who's riding; `?rider=<0|1>` → that rider's map; `?rider=i&go=<challengeId>`
  → ride straight into that challenge's countdown; `?rider=i&at=<station>` → just ride there; `?bike=<id>` as today
  (rides as rider 1, never saves). `?rider` out of range → Who's riding.

Behavior: Who's riding shows the two names (rename stays) and Ride!, no bike buttons. The map fills the screen:
`public/map/colorado.png` if it loads, else a drawn placeholder (sky, mountains left, plains right, in the palette);
pins drawn on top from `AREAS[].map` (fractions of width/height) with the difficulty symbol, plus Garage (Lafayette)
and Shop; top bar: rider · bike, ⚙ cogs, Switch rider. Tapping the area opens a sheet: three groups (Trail, Downhill,
Park), each row the challenge name, ★★☆, what the next star pays ("+45 ⚙"), and Go, or its `lockText` instead of Go;
"Just ride" warps at the bottom (display names from `PLACE_NAMES`). Go / a warp navigates to the ride URL.

- [ ] **Step 1: Write the failing browser check `checks/hub.mjs`:** fresh localStorage → Who's riding → Ride! → map
  shows Shredder Hills, Garage, Shop and "0 ⚙"; area sheet shows exactly three rows with Go (Goat Ladder ↑, Goat
  Ladder ↓, Table Row Small) and the rest with lock text; Go on Table Row Small lands in the ride with the countdown;
  `?rider=5` shows Who's riding; screenshots of the map and sheet.
- [ ] **Step 2:** `node checks/hub.mjs` → FAIL. **Step 3:** implement. **Step 4:** `npm run check && npm test` and
  `node checks/hub.mjs` → PASS. **Step 5:** Ledger line.

### Task 9: Ride side: pay, locks, names, owned bikes, no Tune

**Files:**
- Modify: `src/game/main.ts` (ride mode), `src/lab/tune.ts` (`loadTune` only under `?tune=1`), `checks/game.mjs`,
  `checks/bike-swap.mjs`
- Test: `checks/hub.mjs` (extend), `checks/game.mjs`

**Interfaces:**
- Consumes: Tasks 2, 4, 5, 6, 8.

Behavior:
- The ride starts from `loadoutOf(profile)`: `applyLoadout` then `createRide({ bike: l.spec })`; Tune values from
  storage never load unless `?tune=1` (which also shows the Tune drawer, as today).
- Menu: **🗺 Map** (navigates to `?rider=i`; a run in progress is dropped, nothing paid) and **📍 Shredder Hills**
  (the same grouped list as the hub sheet, plus Just ride).
- Rings show `PLACE_NAMES`; a locked challenge's ring card shows its `lockText` instead of Go.
- Downhill-group runs set `T.trickBoost` to the boost value while running and 0 otherwise.
- Result card: the time or points, the stars (★★☆), and "+N ⚙" from `payFor`; the profile is saved. `?bike=` rides
  show the result but never pay or save.
- Swap cycles only owned bikes (hidden with one bike); it re-applies that bike's loadout and saves `riding`.
- The welcome card text: "Ride into a glowing ring to try a challenge. Earn ⚙ cogs, then spend them in the Shop."

- [ ] **Step 1: Extend the failing checks:** `checks/hub.mjs`: finish Table Row Small (drive it as `checks/game.mjs`
  does today) → result shows stars and "+20 ⚙"; back to the map shows "20 ⚙"; `?rider=0` after leaving mid-run shows
  unchanged cogs (Review Focus 5); `?bike=enduro` finishing a challenge leaves the save unchanged (Review Focus 5).
  `checks/game.mjs`: drop the Tune lines, Who's-riding bike buttons and the old swap cycle; keep the slalom and trick
  lines under the new names. `checks/bike-swap.mjs`: a profile owning two bikes swaps between exactly those; the
  side-on shots stay.
- [ ] **Step 2:** run them → FAIL. **Step 3:** implement. **Step 4:** `npm run check && npm test`, `node
  checks/hub.mjs`, `node checks/game.mjs`, `node checks/bike-swap.mjs`, `node checks/energy.mjs`,
  `node checks/lab-tricks.mjs` → PASS. **Step 5:** Ledger line.

### Task 10: Garage

**Files:**
- Create: `src/game/hub/stand.ts` (three.js canvas: a rig from Task 7 in `standPose()` with the rider, soft studio light, a
  turntable floor; `setRider(v)` to hide the rider; drag to spin, a slow idle spin; `anchor(slot)` → screen point for hotspots, mapping suspension→fork, tires→frontTire, brakes→rearHub,
  cockpit→bars, drivetrain→cranks), `src/game/hub/garage.ts`
- Modify: `src/game/hub/map.ts` (Garage pin opens it), `src/game/hub/hub.css`
- Test: `checks/hub.mjs` (extend)

**Interfaces:**
- Consumes: Tasks 2, 3, 4, 7.
- Produces: `createStand(canvas: HTMLCanvasElement): { show(l: Loadout): void; setRider(v: boolean): void; spin(rad: number): void; anchor(slot: Slot): { x: number; y: number } | null; dispose(): void }`.

Behavior (the chosen mockup "B with A's spec sheet"): the bike big in the middle with the rider astride it, foot
down; a 👤 button hides and shows the rider (to see the whole frame); a dot hidden behind the rider at the current
angle fades out rather than vanishing; five glowing dots on the slots;
tap one → part card: the part on now, owned parts for this slot ("on the wall"), and the shop's next one for this bike
with price and Buy; each shows only the stats it moves (bars with green gain / red striped loss vs what's fitted);
"Put it on" fits. Tabs **Parts · Paint · Specs**: Paint is a row of `PAINTS` swatches (free, applies at once); Specs
is the sheet (name, type, wheels, head angle, wheelbase, reach, weight with part deltas, each slot's part and `spec`)
and the eight bars in their three groups. A strip of owned bikes switches the stand; "Ride this one" sets `riding`.
Back → map.

- [ ] **Step 1: Extend the failing check:** give the rider 200 cogs via localStorage; Garage shows the hardtail and
  five dots; tap Tires → card lists stock (on now) and Sticky (shop, price); Buy → cogs drop by its price; Put it on
  → Specs tab lists "Sticky"; Grip bar is higher than before; Paint a swatch → the stand's frame color changes
  (read via a test hook); screenshots of Parts, Paint, Specs.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** checks + `npm test` → PASS. **Step 5:** Ledger line.

### Task 11: Shop

**Files:**
- Create: `src/game/hub/shop.ts`
- Modify: `src/game/hub/map.ts`, `hub.css`
- Test: `checks/hub.mjs` (extend)

**Interfaces:**
- Consumes: Tasks 2, 3, 4, 10 (`createStand`).

Behavior: two tabs, **Bikes** and **Parts**. Bikes: each bike you don't own on the same stand (with the rider, as in the garage), its sheet and eight
bars, its price, Buy (disabled with "Need N more ⚙" when short). Parts: grouped by your owned bikes, then slot; each
part's `does`, price, the stats it moves vs that bike's fitted part, Buy. Owned things show "In your garage".

- [ ] **Step 1: Extend the failing check:** with cogs one short of the Dirt Jumper, Buy is disabled and says how many
  more; with enough, Buy → Garage strip shows two bikes; the Parts tab lists Dirt Jumper parts; a double tap on Buy
  charges once (Review Focus 2).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** checks + `npm test` → PASS. **Step 5:** Ledger line.

### Task 12: Ladder calibration with robots

**Files:**
- Create: `checks/ladder-robots.ts`
- Modify: `src/game/challenges.ts` (times, points, stat thresholds), `src/game/catalog.ts` (part numbers, prices),
  `src/game/progress.ts` (`PAY`, bike prices in `SHEETS`), existing robot scripts as needed to accept a loadout
  (`BIKE=hardtail PARTS=stock|all`)
- Test: `tests/pacing.test.ts`

**Interfaces:**
- Consumes: everything above. Reuse the existing robot styles (climb, downhill, showcase, jump lanes, slalom, pump);
  add down-direction styles for Hairpin Hollow and ↕ runs.

For every challenge, run four loadouts and record the best result per style in the ledger:
(a) bare hardtail, (b) hardtail with all its parts, (c) the matching bike stock ridden carelessly, (d) the matching
bike with its parts ridden well (matching bike: Bolinas for Trail runs, Enduro for Downhill, Dirt Jumper for Park).
Then set targets so that: **1★** is reachable by (a) on every challenge it can start (and by whatever its lock asks
for); **2★** is reachable by (b) but not (a); **3★** is reachable by (d) but not (b) or (c), set near (d)'s best clean
run. Where a hard limit separates them (top gear speed, wobble speed, spin), put the target past the weaker bike's
limit (spec anti-goal: a skilled kid beats robots). Record any challenge where this can't be met as a ruling.

- [ ] **Step 1: Write the failing pacing tests** (pure, from `PAY`, prices and the challenge list):
  "the first upgrade is affordable after about three first clears" (cheapest hardtail part ≤ 1★ pay of the three
  starting challenges, and > 1★ pay of any two); "the first new bike takes most of the area's 2★ clears" (cheapest
  bike between 60% and 90% of the sum of 1★+2★ pay over all area challenges); "bikes cost far more than parts"
  (cheapest bike ≥ 5 × dearest part).
- [ ] **Step 2:** run → FAIL or PASS; adjust numbers until PASS.
- [ ] **Step 3:** Write `ladder-robots.ts`; run it; set targets; rerun until the four-loadout rule holds or a ruling
  is recorded.
- [ ] **Step 4:** `npm run check && npm test`; all browser checks → PASS. **Step 5:** Ledger line with the table.

### Task 13: Hand-off

**Files:**
- Modify: `docs/handoff-2026-11-01.md` (a "Nov 6: progression loop" section: the screens, URL contract, cogs and
  pacing numbers, the ladder table from Task 12, how to add a part or a challenge, `?tune=1`, where the map image
  goes; Next up: playtest, then the later projects list from the spec), `README.md` only if it lists pages or checks.

- [ ] **Step 1:** Write the section. **Step 2:** `npm run check && npm test` and every `checks/*.mjs` → PASS.
  **Step 3:** Ledger line.
